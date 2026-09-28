// Saved cosmetic and match setup choices plus the live armory preview.
import { previewWeapon } from "./weapon-models.js";
export class Customization {
  // Restore and validate customization, then bind each control to persistence and preview updates.
  constructor() {
    this.values = {
      callsign: "You",
      finish: "graphite",
      optic: "iron",
      fov: 83,
      crosshair: "#a7ead4",
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
      crosshair: ["#a7ead4", "#ffffff", "#ffbf69", "#ff6b9d"],
    }))
      if (!choices.includes(this.values[key])) this.values[key] = choices[0];
    this.values.fov = Math.max(
      65,
      Math.min(105, Number(this.values.fov) || 83),
    );
    this.values.callsign =
      String(this.values.callsign || "You")
        .trim()
        .slice(0, 16) || "You";
    for (const key of Object.keys(this.values)) {
      const el = document.getElementById(
        key === "crosshair" ? "crosshairColor" : key,
      );
      el.value = String(this.values[key]);
      el.addEventListener("input", () => {
        this.values[key] = ["fov", "target", "duration"].includes(key)
          ? Number(el.value)
          : key === "callsign"
            ? el.value.trim().slice(0, 16) || "You"
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
    document.getElementById("fovValue").textContent = v.fov + "°";
    document.getElementById("ruleTarget").textContent = v.target;
    document.getElementById("ruleDuration").textContent =
      String(v.duration / 60).padStart(2, "0") + ":00";
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
      target: this.values.target,
      duration: this.values.duration,
    };
    document.getElementById("scoreTarget").textContent =
      "FIRST TO " + this.values.target;
  }
}
