// Synthesized game audio with 3D positioning. Every cue is generated from oscillators and a
// shared noise buffer, so there are no sound files to fetch or cache.
// World coordinates match Web Audio: +Y up, forward along -Z, so positions pass through unchanged.
import { rayBox } from "./math.js";

// Cues beyond this distance are inaudible and skipped before allocating nodes.
export const MAX_HEARING = 90;
// Footsteps are low priority: drop them first when many voices are already playing.
const MAX_VOICES = 28,
  STEP_VOICE_LIMIT = 18;

// Per-weapon gunshot character: body pitch, crack filter frequency and tail length.
const SHOT_TONE = [
  { body: 145, crack: 2600, tail: 0.16 }, // AR
  { body: 190, crack: 3400, tail: 0.11 }, // SMG
  { body: 165, crack: 3000, tail: 0.1 }, // Pistol
  { body: 95, crack: 2000, tail: 0.26 }, // DMR
  { body: 115, crack: 2200, tail: 0.2 }, // LMG
];

// Wall muffling: a blocked sound loses its highs and much of its level, but stays audible.
export const OCCLUDED = Object.freeze({ cutoff: 650, gain: 0.45 });
// Low-pass cutoff and gain for a positioned cue: air dulls distant sounds, walls muffle them.
export function propagation(range, occluded = false) {
  const air = Math.max(700, 18000 / (1 + range / 6));
  return occluded
    ? { cutoff: Math.min(air, OCCLUDED.cutoff), gain: OCCLUDED.gain }
    : { cutoff: air, gain: 1 };
}
// Build a "does a wall block this sound?" test from the arena's collision raycast. Sounds are
// tested at body height so low crates do not swallow every footstep behind them.
export function lineOfSound(arena) {
  return (from, to) => {
    const target = [to.x, Math.max(to.y, 1.2), to.z],
      v = [target[0] - from.x, target[1] - from.y, target[2] - from.z],
      length = Math.hypot(...v);
    if (length < 0.5) return false;
    const d = v.map((n) => n / length);
    // Ignore the floor plane: only solids between the two points occlude.
    let hit = length;
    for (const b of arena.solids)
      hit = Math.min(hit, rayBox([from.x, from.y, from.z], d, b, hit));
    return hit < length - 0.3;
  };
}
export class AudioManager {
  // Retain preferences so menu changes are observed by the runtime subsystem.
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.lastShot = 0;
    this.voices = 0;
    this.listener = { x: 0, y: 1.6, z: 0 };
    // Optional (from, to) => boolean supplied by the game; see lineOfSound().
    this.occluded = null;
  }
  // Create/resume audio only from an interaction permitted by browser autoplay policy.
  unlock() {
    try {
      if (!this.context) {
        const c = (this.context = new (
          window.AudioContext || window.webkitAudioContext
        )());
        // A gentle compressor keeps overlapping gunfire from clipping.
        this.master = c.createDynamicsCompressor();
        this.master.threshold.value = -16;
        this.master.ratio.value = 4;
        this.master.connect(c.destination);
        // One second of white noise, reused by every percussive cue.
        this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      this.context.resume().catch(() => {});
    } catch {}
  }
  // Place the listener at the camera; called once per rendered frame.
  setListener(x, y, z, yaw, pitch) {
    this.listener = { x, y, z };
    const c = this.context;
    if (!c) return;
    const l = c.listener,
      cp = Math.cos(pitch),
      f = [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp],
      u = [
        -Math.sin(yaw) * Math.sin(pitch),
        cp,
        Math.cos(yaw) * Math.sin(pitch),
      ];
    if (l.positionX) {
      const t = c.currentTime;
      l.positionX.setValueAtTime(x, t);
      l.positionY.setValueAtTime(y, t);
      l.positionZ.setValueAtTime(z, t);
      l.forwardX.setValueAtTime(f[0], t);
      l.forwardY.setValueAtTime(f[1], t);
      l.forwardZ.setValueAtTime(f[2], t);
      l.upX.setValueAtTime(u[0], t);
      l.upY.setValueAtTime(u[1], t);
      l.upZ.setValueAtTime(u[2], t);
    } else {
      // Older Safari exposes only the deprecated setter methods.
      l.setPosition?.(x, y, z);
      l.setOrientation?.(...f, ...u);
    }
  }
  // Play a cue. With a world `source` the sound is positioned in 3D (HRTF) and muffled
  // with distance; without one it plays directly, as for the local player's own gun.
  play(kind, volume = 0.5, weapon = 0, source = null) {
    const c = this.context;
    if (!c || c.state !== "running" || !this.settings.values.sound) return;
    if (this.voices >= (kind === "step" ? STEP_VOICE_LIMIT : MAX_VOICES))
      return;
    let range = 0,
      path = null;
    if (source) {
      const l = this.listener;
      range = Math.hypot(source.x - l.x, source.y - l.y, source.z - l.z);
      if (range > MAX_HEARING) return;
      path = propagation(range, this.occluded?.(l, source) || false);
    } else if (kind === "shot") {
      if (c.currentTime - this.lastShot < 0.026) return;
      this.lastShot = c.currentTime;
    }
    const t = c.currentTime,
      out = c.createGain(),
      nodes = [out];
    out.gain.value = volume * (path ? path.gain : 1);
    if (source) {
      const panner = c.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 2.5;
      panner.maxDistance = MAX_HEARING;
      panner.rolloffFactor = 1.1;
      if (panner.positionX) {
        panner.positionX.value = source.x;
        panner.positionY.value = source.y;
        panner.positionZ.value = source.z;
      } else panner.setPosition(source.x, source.y, source.z);
      // Air absorbs high frequencies, so distant sounds are duller as well as quieter.
      const air = c.createBiquadFilter();
      air.type = "lowpass";
      air.frequency.value = path.cutoff;
      out.connect(air);
      air.connect(panner);
      panner.connect(this.master);
      nodes.push(air, panner);
    } else out.connect(this.master);
    const length = this.voice(kind, weapon, t, out, nodes);
    this.voices++;
    // Disconnect finished voices so audio nodes do not accumulate during long matches.
    setTimeout(
      () => {
        for (const n of nodes) n.disconnect();
        this.voices--;
      },
      (length + 0.1) * 1000,
    );
  }
  // Build the synthesis graph for one cue into `out`; returns its length in seconds.
  voice(kind, weapon, t, out, nodes) {
    const c = this.context;
    const tone = (type, from, to, duration, level, delay = 0) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(from, t + delay);
      o.frequency.exponentialRampToValueAtTime(to, t + delay + duration);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(level, t + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
      o.connect(g);
      g.connect(out);
      o.start(t + delay);
      o.stop(t + delay + duration + 0.02);
      nodes.push(o, g);
    };
    const burst = (filterType, frequency, q, duration, level) => {
      const s = c.createBufferSource(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      s.buffer = this.noise;
      f.type = filterType;
      f.frequency.value = frequency;
      f.Q.value = q;
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      s.connect(f);
      f.connect(g);
      g.connect(out);
      // Random offsets keep repeated footsteps and shots from sounding identical.
      s.start(t, Math.random() * 0.8, duration + 0.02);
      nodes.push(s, f, g);
    };
    if (kind === "shot") {
      const w = SHOT_TONE[weapon] || SHOT_TONE[0];
      burst("bandpass", w.crack, 0.9, 0.05, 0.55);
      burst("lowpass", 900, 0.7, w.tail, 0.32);
      tone("sawtooth", w.body, Math.max(35, w.body * 0.3), 0.09, 0.12);
      tone("sine", 70, 38, w.tail * 0.8, 0.35);
      return w.tail;
    }
    if (kind === "step") {
      // Soft heel scuff plus a low body thud, with slight variation per step.
      const pitch = 0.85 + Math.random() * 0.3;
      burst("lowpass", 650 * pitch, 1.2, 0.07, 0.28);
      burst("bandpass", 2400 * pitch, 2, 0.03, 0.05);
      tone("sine", 95 * pitch, 50, 0.06, 0.22);
      return 0.08;
    }
    if (kind === "land") {
      burst("lowpass", 500, 1, 0.12, 0.4);
      tone("sine", 80, 40, 0.1, 0.35);
      return 0.13;
    }
    const duration = kind === "reload" ? 0.12 : kind === "kill" ? 0.23 : 0.075;
    const f =
      kind === "hit"
        ? 820
        : kind === "kill"
          ? 1100
          : kind === "hurt"
            ? 85
            : 350;
    tone("sine", f, Math.max(35, f * 0.3), duration, 0.1);
    return duration;
  }
}

// Stride lengths in metres; sprinting covers more ground per step, crouching less.
export const STRIDE = Object.freeze({ walk: 2.0, sprint: 2.7, crouch: 1.5 });

// Turns actor movement into footstep and landing cues. It reads positions only, so it works
// for the offline simulation and for interpolated remote players alike.
export class FootstepTracker {
  constructor() {
    this.state = new Map();
  }
  // `emit(kind, volume, source|null)` receives each cue; the local player's cues have no source.
  update(actors, localId, emit) {
    for (const a of actors) {
      let s = this.state.get(a.id);
      if (!s || !a.alive) {
        this.state.set(a.id, {
          x: a.x,
          z: a.z,
          y: a.y,
          travelled: 0,
          airborne: false,
        });
        continue;
      }
      const moved = Math.hypot(a.x - s.x, a.z - s.z),
        airborne = a.y > 0.05,
        local = a.id === localId,
        source = local ? null : { x: a.x, y: a.y + 0.1, z: a.z };
      s.x = a.x;
      s.z = a.z;
      s.y = a.y;
      // Large jumps are respawns or network corrections, not walking.
      if (moved > 3) {
        s.travelled = 0;
        s.airborne = airborne;
        continue;
      }
      if (s.airborne && !airborne) {
        emit("land", local ? 0.35 : 0.8, source);
        s.travelled = 0;
      }
      s.airborne = airborne;
      if (airborne || a.sliding || !a.moving) continue;
      s.travelled += moved;
      const stride = a.sprinting
        ? STRIDE.sprint
        : a.crouched
          ? STRIDE.crouch
          : STRIDE.walk;
      if (s.travelled < stride) continue;
      s.travelled -= stride;
      // Sprinting is loud, careful movement quiet: crouching or aiming muffles steps.
      const loudness = a.sprinting ? 1 : a.crouched ? 0.3 : a.aim ? 0.5 : 0.7;
      emit("step", loudness * (local ? 0.45 : 1), source);
    }
  }
  clear() {
    this.state.clear();
  }
}
