import { WEAPONS } from "./weapons.js";
// Game audio with 3D positioning. Gunshots, reloads, impacts and pain use recorded samples
// (assets/audio, cached offline); every cue also has a synthesized version, built from
// oscillators and a shared noise buffer, that plays until the recordings have decoded.
// World coordinates match Web Audio: +Y up, forward along -Z, so positions pass through unchanged.
import { rayBox } from "./math.js";

// Cues beyond this distance are inaudible and skipped before allocating nodes.
export const MAX_HEARING = 90;
// Footsteps are low priority: drop them first when many voices are already playing.
const MAX_VOICES = 36,
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
// Per weapon: how long the recorded report may ring, its playback rate and level, and the
// pitch of the low thump layered under it. Your own gun's previous report is cut off by the
// next shot (see CHOKE), so automatic fire stays tight and only the last round's tail rings out.
const SHOT_SAMPLE = [
  { tail: 1.3, rate: 1, gain: 0.85, thump: 82 }, // AR, 5.56
  { tail: 1.0, rate: 1.06, gain: 0.8, thump: 105 }, // SMG, 9 mm
  { tail: 1.0, rate: 0.94, gain: 0.95, thump: 115 }, // Pistol, 9 mm close-mic
  { tail: 1.8, rate: 1, gain: 0.95, thump: 62 }, // DMR, .308
  { tail: 1.3, rate: 1, gain: 0.9, thump: 68 }, // LMG, 7.62x54R
];
// Which recording a cue uses for a weapon, or null to keep the synthesized one. The SMG has
// no magazine recordings of its own and reuses the rifle's, played slightly faster and lighter.
// `positioned` is true for other actors' guns: nothing chokes those, so their recording is
// kept short and the reverb carries the tail instead.
export function sampleFor(kind, weapon = 0, positioned = false) {
  // Added weapons use the recordings of the weapon they are based on; a gun may borrow
  // another weapon's report (`sound`) and shift its pitch (`soundRate`).
  const w = WEAPONS[weapon],
    base = w?.base ?? 0,
    key = WEAPON_KEY[base] || "ar";
  if (kind === "shot") {
    const voice = w?.sound ?? base,
      s = SHOT_SAMPLE[voice] || SHOT_SAMPLE[0];
    return {
      file: `shot-${WEAPON_KEY[voice] || "ar"}.mp3`,
      ...s,
      rate: s.rate * (w?.soundRate ?? 1),
      tail: positioned ? Math.min(s.tail, 0.55) : s.tail,
      jitter: 0.03,
    };
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

// Seconds over which the previous local report fades when the next round fires.
export const CHOKE = 0.09;
// Sound takes time to arrive: distant gunfire lags its muzzle flash.
export const SPEED_OF_SOUND = 343;
// Share of a cue sent to the outdoor reverb. Distant cues are mostly echo.
export function reverbSend(kind, range = 0) {
  if (kind === "shot") return Math.min(0.75, 0.24 + range / 70);
  if (kind === "impact" || kind === "snap") return 0.18;
  if (kind === "land" || kind === "death" || kind === "hurt") return 0.08;
  return 0;
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
    // Gain node of the local gun's ringing report, faded when the next shot fires.
    this.report = null;
  }
  // An outdoor impulse response: a few hard slap-backs off nearby structures, then a tail
  // that darkens as it decays. Generated once; no file to download.
  buildReverb(c) {
    const seconds = 1.7,
      length = Math.floor(c.sampleRate * seconds),
      impulse = c.createBuffer(2, length, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < length; i++) {
        const time = i / c.sampleRate,
          // One-pole low-pass whose cutoff falls with time: late echoes lose their highs.
          k = 0.55 * Math.exp(-time * 2.6) + 0.04;
        low += (Math.random() * 2 - 1 - low) * k;
        data[i] =
          low * Math.exp(-time * 3.4) * (time < 0.012 ? time / 0.012 : 1);
      }
      for (const [at, level] of ch
        ? [
            [0.052, 0.5],
            [0.118, 0.34],
            [0.207, 0.2],
          ]
        : [
            [0.041, 0.5],
            [0.097, 0.36],
            [0.171, 0.22],
          ]) {
        const start = Math.floor(at * c.sampleRate);
        for (let i = 0; i < 260; i++)
          data[start + i] +=
            (Math.random() * 2 - 1) * level * Math.exp(-i / 70);
      }
    }
    return impulse;
  }
  // Incoming fire dulls hearing: 0 is clear, 1 is heavily muffled.
  setMuffle(amount) {
    const c = this.context;
    if (!c || !this.muffle) return;
    const a = Math.max(0, Math.min(1, amount || 0));
    if (Math.abs(a - (this.muffled || 0)) < 0.02) return;
    this.muffled = a;
    this.muffle.frequency.setTargetAtTime(
      18000 * Math.pow(1500 / 18000, a),
      c.currentTime,
      0.05,
    );
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
        this.master.attack.value = 0.002;
        this.master.release.value = 0.12;
        // Suppression muffle (see setMuffle), then master volume from Settings.
        this.muffle = c.createBiquadFilter();
        this.muffle.type = "lowpass";
        this.muffle.frequency.value = 18000;
        this.volume = c.createGain();
        this.volume.gain.value = (this.settings.values.volume ?? 80) / 100;
        this.master.connect(this.muffle);
        this.muffle.connect(this.volume);
        this.volume.connect(c.destination);
        // Shared outdoor reverb; cues send to it by kind and distance (reverbSend).
        try {
          this.reverb = c.createConvolver();
          this.reverb.buffer = this.buildReverb(c);
          this.reverb.connect(this.master);
        } catch {
          this.reverb = null;
        }
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
    const level = (this.settings.values.volume ?? 80) / 100;
    if (level <= 0) return;
    if (this.volume) this.volume.gain.value = level;
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
    // A positioned cue is heard after the sound has crossed the distance.
    const lag = source ? range / SPEED_OF_SOUND : 0;
    const t = c.currentTime + lag,
      out = c.createGain(),
      nodes = [out];
    out.gain.value = volume * (path ? path.gain : 1);
    const wet = this.reverb ? reverbSend(kind, range) : 0;
    if (wet > 0) {
      const send = c.createGain();
      // Walls soak up the direct sound more than the echo around them.
      send.gain.value = wet * (path && path.gain < 1 ? 0.7 : 1);
      out.connect(send);
      send.connect(this.reverb);
      nodes.push(send);
    }
    // Your own gun: the next shot cuts the last report short, and brass lands a moment later.
    if (kind === "shot" && !source) {
      if (this.report) {
        this.report.gain.cancelScheduledValues(t);
        this.report.gain.setTargetAtTime(0.0001, t, CHOKE / 3);
      }
      this.report = out;
      if (Math.random() < 0.45)
        setTimeout(() => this.play("brass", 0.5), 420 + Math.random() * 260);
    }
    // A bolt-action rifle is cycled by hand after every round.
    if (kind === "shot" && WEAPONS[weapon]?.bolt)
      setTimeout(
        () => this.play("rack", source ? 0.45 : 0.6, weapon, source),
        (lag + 0.42) * 1000,
      );
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
    const length = this.voice(kind, weapon, t, out, nodes, Boolean(source));
    this.voices++;
    // Disconnect finished voices so audio nodes do not accumulate during long matches.
    let live = true;
    const done = () => {
      if (!live) return;
      live = false;
      for (const n of nodes) n.disconnect();
      this.voices--;
    };
    // A choked report is silent within a few CHOKE lengths: free its voice then, not after
    // the full tail, so automatic fire cannot crowd out footsteps and other guns.
    if (kind === "shot" && !source) {
      if (this.reportDone) setTimeout(this.reportDone, CHOKE * 4000);
      this.reportDone = done;
    }
    setTimeout(done, (lag + length + 0.1) * 1000);
  }
  // Build the synthesis graph for one cue into `out`; returns its length in seconds.
  voice(kind, weapon, t, out, nodes, positioned = false) {
    const c = this.context;
    // A decoded recording replaces the synthesized cue; it is faded out after `tail` seconds.
    const sample = sampleFor(kind, weapon, positioned),
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
      if (kind === "shot") {
        // Chest thump under the recording, and the action cycling just after it.
        const o = c.createOscillator(),
          og = c.createGain(),
          from = sample.thump || 80;
        o.frequency.setValueAtTime(from * 1.6, t);
        o.frequency.exponentialRampToValueAtTime(from * 0.5, t + 0.11);
        og.gain.setValueAtTime(0.0001, t);
        og.gain.linearRampToValueAtTime(0.55, t + 0.004);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        o.connect(og);
        og.connect(out);
        o.start(t);
        o.stop(t + 0.15);
        const click = c.createBufferSource(),
          cf = c.createBiquadFilter(),
          cg = c.createGain();
        click.buffer = this.noise;
        cf.type = "bandpass";
        cf.frequency.value = 2900;
        cf.Q.value = 2.5;
        cg.gain.setValueAtTime(0.0001, t);
        cg.gain.setValueAtTime(0.16, t + 0.03);
        cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
        click.connect(cf);
        cf.connect(cg);
        cg.connect(out);
        click.start(t + 0.03, Math.random() * 0.8, 0.04);
        nodes.push(o, og, click, cf, cg);
      }
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
      burst("highpass", 2400, 0.7, 0.014, 0.9);
      burst("bandpass", w.crack, 0.9, 0.05, 0.6);
      burst("lowpass", 900, 0.7, w.tail, 0.36);
      tone("sawtooth", w.body, Math.max(35, w.body * 0.3), 0.09, 0.14);
      tone("sine", w.body * 0.9, 38, w.tail * 0.8, 0.5);
      // Slap-back: the report returns off the yard's containers and walls a moment later.
      burst("lowpass", 1400, 0.6, w.tail * 0.9, 0.11, 0.075);
      burst("lowpass", 700, 0.6, w.tail * 1.2, 0.06, 0.16);
      return w.tail + 0.2;
    }
    if (kind === "hit") {
      // Hit confirm: a dry, tight tick with a little body, short enough to hear every round
      // of a burst land.
      burst("highpass", 4200, 0.7, 0.012, 0.75);
      burst("bandpass", 1500, 1.6, 0.03, 0.5);
      tone("sine", 240, 120, 0.035, 0.3);
      return 0.05;
    }
    if (kind === "headshot") {
      // A harder crack and a short ring off the helmet.
      burst("highpass", 5200, 0.7, 0.012, 0.9);
      burst("bandpass", 2300, 2.4, 0.04, 0.55);
      tone("sine", 2050, 1900, 0.14, 0.2, 0.004);
      tone("sine", 3080, 2900, 0.09, 0.09, 0.004);
      tone("sine", 200, 90, 0.05, 0.3);
      return 0.16;
    }
    if (kind === "kill") {
      // Kill confirm: a weighty knock followed by two rising ticks.
      burst("lowpass", 700, 1, 0.07, 0.7);
      tone("sine", 150, 52, 0.14, 0.6);
      burst("highpass", 4000, 0.7, 0.012, 0.55, 0.05);
      tone("triangle", 1250, 1150, 0.05, 0.3, 0.05);
      burst("highpass", 4600, 0.7, 0.012, 0.55, 0.125);
      tone("triangle", 1750, 1650, 0.08, 0.3, 0.125);
      return 0.22;
    }
    if (kind === "ping") {
      // The M1's empty clip springing clear: a bright steel ring that hangs for a moment.
      burst("highpass", 5000, 0.8, 0.01, 0.5);
      tone("sine", 3120, 3080, 0.34, 0.3);
      tone("sine", 4690, 4640, 0.26, 0.16);
      tone("sine", 6250, 6200, 0.16, 0.07);
      return 0.36;
    }
    if (kind === "brass") {
      // A spent case bouncing on concrete: two or three small, quickly fading rings.
      const pitch = 4300 + Math.random() * 1700;
      let at = 0;
      for (let i = 0, level = 0.16; i < 2 + (Math.random() < 0.5); i++) {
        tone(
          "sine",
          pitch * (1 + i * 0.07),
          pitch * (0.97 + i * 0.07),
          0.05,
          level,
          at,
        );
        tone("sine", pitch * 1.52, pitch * 1.5, 0.03, level * 0.5, at);
        at += 0.07 + Math.random() * 0.06;
        level *= 0.5;
      }
      return at + 0.06;
    }
    if (kind === "snap") {
      // Supersonic crack of a round passing close, then the falling hiss of it going by.
      burst("highpass", 3600, 0.8, 0.022, 1);
      burst("bandpass", 2100, 1.2, 0.05, 0.4, 0.008);
      const s = c.createBufferSource(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      s.buffer = this.noise;
      f.type = "bandpass";
      f.Q.value = 3;
      f.frequency.setValueAtTime(3200, t + 0.02);
      f.frequency.exponentialRampToValueAtTime(600, t + 0.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
      s.connect(f);
      f.connect(g);
      g.connect(out);
      s.start(t + 0.02, Math.random() * 0.7, 0.22);
      nodes.push(s, f, g);
      return 0.24;
    }
    if (kind === "step") {
      // Boot on grit: the heel's dull thud, then the sole rolling onto loose stone.
      const pitch = 0.85 + Math.random() * 0.3,
        roll = 0.045 + Math.random() * 0.02;
      burst("lowpass", 420 * pitch, 1, 0.06, 0.4);
      tone("sine", 88 * pitch, 46, 0.07, 0.28);
      burst("bandpass", 1500 * pitch, 0.9, 0.05, 0.16, roll);
      burst("highpass", 3800, 0.6, 0.03, 0.05, roll + 0.01);
      return roll + 0.07;
    }
    if (kind === "land") {
      burst("lowpass", 500, 1, 0.12, 0.4);
      tone("sine", 80, 40, 0.1, 0.35);
      return 0.13;
    }
    const duration = kind === "reload" ? 0.12 : 0.075;
    const f = kind === "hurt" ? 85 : 350;
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
