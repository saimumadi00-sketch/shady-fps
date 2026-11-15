// Persisted preferences, adaptive rendering quality, and synthesized sound without external assets.
import { normalizeBindings } from "./bindings.js";
const KEY = "crosscurrent-settings";
// One store for every player preference, shared by the lobby and the arena. Form controls
// bind by id; a key can drive several controls (the pause menu mirrors a few sliders).
const CONTROLS = {
  crosshair: ["crosshairColor"],
  fov: ["fov", "pauseFov"],
  sensitivity: ["sensitivity", "pauseSensitivity"],
  adsSensitivity: ["adsSensitivity", "pauseAdsSensitivity"],
  touchSensitivity: ["touchSensitivity", "pauseTouchSensitivity"],
};
const RANGES = {
  sensitivity: [0.4, 2, 1],
  adsSensitivity: [0.5, 1.5, 1],
  touchSensitivity: [0.4, 2, 1],
  volume: [0, 100, 80],
  fov: [65, 105, 83],
};
const BOOLEANS = [
  "sound",
  "autoQuality",
  "invertY",
  "showStats",
  "reducedMotion",
];
const CROSSHAIRS = ["#a7ead4", "#ffffff", "#ffbf69", "#ff6b9d"];
// Read-outs shown next to sliders, so a value can be restored after experimenting.
export function formatSetting(key, v) {
  if (key === "fov") return v + "°";
  if (key === "volume") return v + "%";
  return Number(v).toFixed(1) + "×";
}
export class SettingsManager {
  // Load known settings only; invalid or blocked storage must never prevent startup.
  constructor() {
    this.values = {
      quality: matchMedia("(pointer:coarse)").matches ? "low" : "medium",
      difficulty: "normal",
      sensitivity: 1,
      adsSensitivity: 1,
      touchSensitivity: 1,
      invertY: false,
      sound: true,
      volume: 80,
      autoQuality: true,
      showStats: false,
      reducedMotion: false,
      callsign: "",
      fov: 83,
      crosshair: CROSSHAIRS[0],
      bindings: normalizeBindings(null),
    };
    this.listeners = [];
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {}
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
    for (const key of Object.keys(this.values))
      if (Object.prototype.hasOwnProperty.call(saved, key))
        this.values[key] = saved[key];
    // Callsign, field of view and crosshair used to live in separate lobby and arena stores.
    if (!Object.prototype.hasOwnProperty.call(saved, "callsign"))
      this.migrate();
    this.normalize();
    this.bind(document);
  }
  migrate() {
    const read = (k) => {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        return v && typeof v === "object" ? v : {};
      } catch {
        return {};
      }
    };
    const custom = read("crosscurrent-custom"),
      lobby = read("crosscurrent-orbital-v1");
    if (typeof custom.callsign === "string" && custom.callsign !== "You")
      this.values.callsign = custom.callsign;
    else if (typeof lobby.name === "string" && lobby.name !== "NOVA")
      this.values.callsign = lobby.name;
    if (custom.fov !== undefined) this.values.fov = custom.fov;
    if (custom.crosshair !== undefined)
      this.values.crosshair = custom.crosshair;
    if (typeof lobby.reduced === "boolean")
      this.values.reducedMotion = lobby.reduced;
    if (typeof lobby.sound === "boolean") this.values.sound = lobby.sound;
  }
  normalize() {
    const v = this.values;
    if (!["low", "medium", "high"].includes(v.quality)) v.quality = "medium";
    if (!["easy", "normal", "hard"].includes(v.difficulty))
      v.difficulty = "normal";
    for (const [key, [min, max, def]] of Object.entries(RANGES)) {
      const n = Number(v[key]);
      v[key] = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
    }
    for (const key of BOOLEANS)
      if (typeof v[key] !== "boolean")
        v[key] = !["invertY", "showStats", "reducedMotion"].includes(key);
    if (!CROSSHAIRS.includes(v.crosshair)) v.crosshair = CROSSHAIRS[0];
    v.callsign =
      typeof v.callsign === "string" ? v.callsign.trim().slice(0, 16) : "";
    v.bindings = normalizeBindings(v.bindings);
  }
  // Sensitivities in the shape aimScale() expects.
  get aim() {
    const v = this.values;
    return {
      mouse: v.sensitivity,
      ads: v.adsSensitivity,
      touch: v.touchSensitivity,
    };
  }
  // Called with (key, value) after every change, from any control or from set().
  onChange(fn) {
    this.listeners.push(fn);
  }
  set(key, value, source = null) {
    this.values[key] = value;
    this.normalize();
    this.save();
    this.sync(key, source);
    for (const fn of this.listeners) fn(key, this.values[key]);
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {}
  }
  // Show the current value in every control (and read-out) bound to a key.
  // `skip` is the control being typed in, which keeps its raw text until it loses focus.
  sync(key, skip = null) {
    for (const id of CONTROLS[key] || [key]) {
      const el = this.root?.getElementById?.(id);
      if (!el) continue;
      if (el === skip && el.type === "text") continue;
      if (el.type === "checkbox") el.checked = this.values[key];
      else el.value = String(this.values[key]);
      const out = this.root.getElementById(id + "Value");
      if (out && key in RANGES)
        out.textContent = formatSetting(key, this.values[key]);
    }
  }
  // Bind every control present in `root` (a document); missing controls are skipped.
  bind(root) {
    this.root = root;
    for (const key of Object.keys(this.values)) {
      if (key === "bindings") continue;
      for (const id of CONTROLS[key] || [key]) {
        const el = root.getElementById(id);
        if (!el || el.dataset?.settingBound) continue;
        if (el.dataset) el.dataset.settingBound = "1";
        const read = () =>
          el.type === "checkbox"
            ? el.checked
            : el.type === "range"
              ? Number(el.value)
              : el.value;
        const live = el.type === "range" || el.type === "text";
        el.addEventListener(live ? "input" : "change", () =>
          this.set(key, read(), el),
        );
        if (live && el.type === "text")
          el.addEventListener("change", () => this.sync(key));
      }
      this.sync(key);
    }
  }
}
// Render scale ignores device pixel ratio to keep high-DPI screens within a predictable GPU budget.
export const PRESETS = {
  low: { scale: 0.65, min: 0.45, effects: 10, shadows: false },
  medium: { scale: 0.9, min: 0.55, effects: 24, shadows: true },
  high: { scale: 1.15, min: 0.6, effects: 48, shadows: true },
};
export class QualityManager {
  // Retain preferences so menu changes are observed by the runtime subsystem.
  constructor(settings) {
    this.settings = settings;
    this.preset = "";
    this.elapsed = 0;
    this.frames = 0;
    this.slow = 0;
    this.fast = 0;
    this.fps = 60;
    this.configure();
  }
  // Reset adaptation only when the selected quality preset changes.
  configure() {
    const name = this.settings.values.quality;
    if (name !== this.preset) {
      this.preset = name;
      const p = PRESETS[name];
      this.scale = p.scale;
      this.effects = p.effects;
      this.shadows = p.shadows;
      this.elapsed = this.frames = this.slow = this.fast = 0;
    }
  }
  // Estimate FPS over two-second windows; reduce quality faster than it recovers.
  update(dt) {
    this.configure();
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed < 2) return;
    this.fps = Math.round(this.frames / this.elapsed);
    this.elapsed = 0;
    this.frames = 0;
    if (!this.settings.values.autoQuality) return;
    this.slow = this.fps < 43 ? this.slow + 1 : 0;
    this.fast = this.fps > 57 ? this.fast + 1 : 0;
    const p = PRESETS[this.preset];
    // Lower visual cost after sustained slow frames without changing simulation tick speed.
    if (this.slow >= 2) {
      this.scale = Math.max(p.min, this.scale - 0.1);
      this.effects = Math.max(6, Math.floor(this.effects * 0.7));
      if (this.scale < 0.7) this.shadows = false;
      this.slow = 0;
    }
    // Restore detail cautiously after several windows with frame-time headroom.
    if (this.fast >= 4) {
      this.scale = Math.min(p.scale, this.scale + 0.05);
      this.effects = Math.min(p.effects, this.effects + 4);
      this.shadows = p.shadows && this.scale >= 0.7;
      this.fast = 0;
    }
  }
}
// Audio lives in its own module; re-exported so existing imports keep working.
export { AudioManager } from "./audio.js";
