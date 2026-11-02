// Persisted preferences, adaptive rendering quality, and synthesized sound without external assets.
export class SettingsManager {
  // Load known settings only; invalid or blocked storage must never prevent startup.
  constructor() {
    this.values = {
      quality: matchMedia("(pointer:coarse)").matches ? "low" : "medium",
      difficulty: "normal",
      sensitivity: 1,
      sound: true,
      autoQuality: true,
    };
    try {
      const saved = JSON.parse(
        localStorage.getItem("crosscurrent-settings") || "{}",
      );
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        for (const key of Object.keys(this.values))
          if (Object.prototype.hasOwnProperty.call(saved, key))
            this.values[key] = saved[key];
    } catch {}
    if (!["low", "medium", "high"].includes(this.values.quality))
      this.values.quality = "medium";
    if (!["easy", "normal", "hard"].includes(this.values.difficulty))
      this.values.difficulty = "normal";
    this.values.sensitivity = Math.max(
      0.4,
      Math.min(2, Number(this.values.sensitivity) || 1),
    );
    for (const key of ["sound", "autoQuality"])
      if (typeof this.values[key] !== "boolean") this.values[key] = true;
    // Bind form controls after normalization and persist changes when storage is available.
    for (const key of Object.keys(this.values)) {
      const el = document.getElementById(key);
      if (el.type === "checkbox") el.checked = this.values[key];
      else el.value = this.values[key];
      el.addEventListener("change", () => {
        this.values[key] =
          el.type === "checkbox"
            ? el.checked
            : el.type === "range"
              ? Number(el.value)
              : el.value;
        try {
          localStorage.setItem(
            "crosscurrent-settings",
            JSON.stringify(this.values),
          );
        } catch {}
      });
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
