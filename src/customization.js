// Saved cosmetic and match setup choices plus the live armory preview.
import { previewWeapon } from "./weapon-models.js";
export class Customization {
  // Restore and validate customization, then bind each control to persistence and preview updates.
  // Callsign, field of view and crosshair are player settings (SettingsManager); they are exposed
  // here as read-only views so the renderer and match setup keep one object to read.
  constructor(settings) {
    this.settings = settings;
    this.values = {
      finish: "graphite",
      optic: "iron",
      target: 30,
      duration: 420,
    };
    try {
      const saved = JSON.parse(
        localStorage.getItem("crosscurrent-custom") || "{}",
      );
      for (const k of Object.keys(this.values))
        if (saved && Object.prototype.hasOwnProperty.call(saved, k))
          this.values[k] = saved[k];
    } catch {}
    // Reject unknown enum values before using them in rendering or match rules.
    for (const [key, choices] of Object.entries({
      finish: ["graphite", "sand", "olive"],
      optic: ["iron", "reflex", "scope"],
      target: [15, 30, 50],
      duration: [180, 420, 600],
    }))
      if (!choices.includes(this.values[key])) this.values[key] = choices[0];
    for (const key of Object.keys(this.values)) {
      const el = document.getElementById(key);
      el.value = String(this.values[key]);
      el.addEventListener("input", () => {
        this.values[key] = ["target", "duration"].includes(key)
          ? Number(el.value)
          : el.value;
        try {
          localStorage.setItem(
            "crosscurrent-custom",
            JSON.stringify(this.values),
          );
        } catch {}
        this.refresh();
      });
    }
    const v = settings.values;
    Object.defineProperties(this.values, {
      fov: { get: () => v.fov },
      crosshair: { get: () => v.crosshair },
      callsign: { get: () => v.callsign || "You" },
    });
    settings.onChange((key) => key === "crosshair" && this.refresh());
    document
      .getElementById("startingWeapon")
      .addEventListener("change", () => this.refresh());
    this.refresh();
  }
  // Update presentation immediately; score/time choices apply to gameplay only when a match starts.
  refresh() {
    const v = this.values;
    document.documentElement.style.setProperty(
      "--crosshair-color",
      v.crosshair,
    );
    const conquest = document.getElementById("matchMode")?.value === "conquest";
    document.getElementById("ruleTarget").textContent = conquest
      ? 150
      : v.target;
    document.getElementById("ruleDuration").textContent =
      String(v.duration / 60).padStart(2, "0") + ":00"; // taste-skill-ignore: match clock
    previewWeapon(
      document.getElementById("weaponPreview"),
      Number(document.getElementById("startingWeapon").value) || 0,
      v.finish,
      v.optic,
    );
  }
  // Copy selected rules into the match before its timer is initialized and update the HUD target.
  apply(game) {
    game.player.name = this.values.callsign;
    game.match.rules = {
      ...game.match.rules,
      ...(game.mode === "conquest" ? {} : { target: this.values.target }),
      duration: this.values.duration,
    };
    document.getElementById("scoreTarget").textContent =
      game.mode === "conquest"
        ? "Tickets · hold sectors"
        : "First to " + this.values.target;
  }
}
