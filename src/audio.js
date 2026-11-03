// Game audio with 3D positioning. Gunshots, reloads, impacts and pain use recorded samples
// (assets/audio, cached offline); every cue also has a synthesized version, built from
// oscillators and a shared noise buffer, that plays until the recordings have decoded.
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

// Recorded cues (credits in THIRD_PARTY_NOTICES.md). They load after the first user gesture;
// until a file has decoded, or if it fails to, the synthesized cue above plays instead.
export const SAMPLE_DIR = "./assets/audio/";
export const SAMPLE_FILES = Object.freeze([
  ...["ar", "smg", "pistol", "dmr", "lmg"].map((w) => `shot-${w}.mp3`),
  ...["ar", "pistol", "dmr", "lmg"].flatMap((w) =>
    ["out", "in", "rack"].map((stage) => `${w}-${stage}.mp3`),
  ),
  "smg-rack.mp3",
  "dry.mp3",
  "impact-1.wav",
  "impact-2.wav",
  "hurt.wav",
  "death.wav",
]);
const WEAPON_KEY = ["ar", "smg", "pistol", "dmr", "lmg"];
// Per weapon: how long the recorded report rings before it is faded out (so automatic fire
// does not stack dozens of two-second tails), its playback rate and its level.
const SHOT_SAMPLE = [
  { tail: 0.55, rate: 1, gain: 0.85 }, // AR, 5.56
  { tail: 0.42, rate: 1.06, gain: 0.8 }, // SMG, 9 mm
  { tail: 0.6, rate: 0.94, gain: 0.95 }, // Pistol, 9 mm close-mic
  { tail: 1.1, rate: 1, gain: 0.95 }, // DMR, .308
  { tail: 0.5, rate: 1, gain: 0.9 }, // LMG, 7.62x54R
];
// Which recording a cue uses for a weapon, or null to keep the synthesized one. The SMG has
// no magazine recordings of its own and reuses the rifle's, played slightly faster and lighter.
export function sampleFor(kind, weapon = 0) {
  const key = WEAPON_KEY[weapon] || "ar";
  if (kind === "shot") {
    const s = SHOT_SAMPLE[weapon] || SHOT_SAMPLE[0];
    return { file: `shot-${key}.mp3`, ...s, jitter: 0.03 };
  }
  if (kind === "mag-out" || kind === "mag-in" || kind === "rack") {
    const stage = kind === "rack" ? "rack" : kind.slice(4);
    const smg = key === "smg" && stage !== "rack";
    return {
      file: `${smg ? "ar" : key}-${stage}.mp3`,
      rate: smg ? 1.12 : 1,
      gain: 2.2,
      tail: 1.2,
      jitter: 0.02,
    };
  }
  if (kind === "impact")
    return {
      file: Math.random() < 0.7 ? "impact-1.wav" : "impact-2.wav",
      rate: 1,
      gain: 1,
      tail: 0.8,
      jitter: 0.08,
    };
  if (kind === "dry") return { file: "dry.mp3", rate: 1, gain: 1.6, tail: 0.4 };
  if (kind === "hurt")
    return { file: "hurt.wav", rate: 1, gain: 1.4, tail: 0.9, jitter: 0.05 };
  if (kind === "death")
    return { file: "death.wav", rate: 1, gain: 1.3, tail: 1.9 };
  return null;
}

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
    // Decoded recordings by file name; filled in the background after unlock().
    this.samples = new Map();
    this.loading = false;
  }
  // Fetch and decode every recording once. Failures are silent: the synth covers them.
  loadSamples() {
    const c = this.context;
    if (this.loading || !c || typeof fetch !== "function") return;
    this.loading = true;
    for (const file of SAMPLE_FILES)
      fetch(SAMPLE_DIR + file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then(
          (data) =>
            new Promise((resolve, reject) =>
              c.decodeAudioData(data, resolve, reject),
            ),
        )
        .then((buffer) => this.samples.set(file, buffer))
        .catch(() => {});
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
      this.loadSamples();
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
    // A decoded recording replaces the synthesized cue; it is faded out after `tail` seconds.
    const sample = sampleFor(kind, weapon),
      buffer = sample && this.samples.get(sample.file);
    if (buffer) {
      const s = c.createBufferSource(),
        g = c.createGain(),
        rate =
          sample.rate * (1 + (Math.random() * 2 - 1) * (sample.jitter || 0)),
        length = Math.min(sample.tail, buffer.duration / rate);
      s.buffer = buffer;
      s.playbackRate.value = rate;
      g.gain.setValueAtTime(sample.gain, t);
      g.gain.setValueAtTime(sample.gain, t + length * 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + length);
      s.connect(g);
      g.connect(out);
      s.start(t);
      s.stop(t + length + 0.02);
      nodes.push(s, g);
      return length;
    }
    // Recording-only cues with no synthesized version yet stay silent until they load.
    if (kind === "impact" || kind === "death" || kind === "dry") return 0;
    if (kind === "mag-out" || kind === "mag-in" || kind === "rack")
      kind = "reload";
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
    const burst = (filterType, frequency, q, duration, level, delay = 0) => {
      const s = c.createBufferSource(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      s.buffer = this.noise;
      f.type = filterType;
      f.frequency.value = frequency;
      f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(level, t + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
      s.connect(f);
      f.connect(g);
      g.connect(out);
      // Random offsets keep repeated footsteps and shots from sounding identical.
      s.start(t + delay, Math.random() * 0.8, duration + 0.02);
      nodes.push(s, f, g);
    };
    if (kind === "shot") {
      const w = SHOT_TONE[weapon] || SHOT_TONE[0];
      burst("bandpass", w.crack, 0.9, 0.05, 0.55);
      burst("lowpass", 900, 0.7, w.tail, 0.32);
      tone("sawtooth", w.body, Math.max(35, w.body * 0.3), 0.09, 0.12);
      tone("sine", 70, 38, w.tail * 0.8, 0.35);
      // Slap-back: the report returns off the yard's containers and walls a moment later.
      burst("lowpass", 1400, 0.6, w.tail * 0.9, 0.11, 0.075);
      burst("lowpass", 700, 0.6, w.tail * 1.2, 0.06, 0.16);
      return w.tail + 0.2;
    }
    if (kind === "hit" || kind === "headshot") {
      // A dull impact thump, plus a bright metallic tink when the round finds a helmet.
      burst("lowpass", 1100, 1.1, 0.06, 0.6);
      tone("sine", 160, 60, 0.07, 0.35);
      tone("triangle", 1900, 1700, 0.045, 0.14);
      if (kind === "headshot") {
        tone("sine", 2600, 2450, 0.16, 0.22);
        tone("sine", 3900, 3700, 0.1, 0.1);
      }
      return kind === "headshot" ? 0.17 : 0.08;
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
    const f = kind === "kill" ? 1100 : kind === "hurt" ? 85 : 350;
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
