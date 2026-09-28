// Pure visual reload pose generation and mesh deformation; ammunition stays owned by WeaponController.
import { WEAPONS } from "./weapons.js";
// Ease between two normalized timeline points with zero velocity at either endpoint.
const smooth = (t, a, b) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
// Normalize the remaining reload timer into phases; inactive/dead actors use the rest pose.
export function reloadPose(actor) {
  const active = actor.reload > 0 && actor.alive;
  const t = active
    ? Math.max(0, Math.min(1, 1 - actor.reload / WEAPONS[actor.weapon].reload))
    : 0;
  const lmg = actor.weapon === 4;
  const lift = active ? smooth(t, 0, 0.13) * (1 - smooth(t, 0.86, 1)) : 0;
  const remove = smooth(t, lmg ? 0.22 : 0.16, lmg ? 0.38 : 0.34);
  const insert = smooth(t, lmg ? 0.48 : 0.48, lmg ? 0.64 : 0.68);
  const travel = active ? remove * (1 - insert) : 0;
  // Only empty reloads include a charging/slide-release action.
  const chamber =
    active && actor.reloadEmpty
      ? smooth(t, 0.72, 0.79) * (1 - smooth(t, 0.81, 0.88))
      : 0;
  return {
    active,
    t,
    roll: lift * (actor.weapon === 2 ? -0.38 : -0.55),
    lift,
    magY: -travel * (lmg ? 0.34 : 0.42),
    magX: -travel * 0.12,
    cover:
      lmg && active ? smooth(t, 0.1, 0.22) * (1 - smooth(t, 0.68, 0.79)) : 0,
    belt:
      lmg && active ? smooth(t, 0.23, 0.36) * (1 - smooth(t, 0.57, 0.67)) : 0,
    bolt: chamber * 0.085,
    slide:
      actor.weapon === 2 && active && actor.reloadEmpty
        ? 0.075 * (1 - smooth(t, 0.77, 0.84))
        : 0,
    hand: lift,
    pistol: actor.weapon === 2,
    reachAction:
      active && actor.reloadEmpty
        ? smooth(t, 0.7, 0.77) * (1 - smooth(t, 0.84, 0.92))
        : 0,
    stage: !active
      ? ""
      : t < 0.16
        ? "REACH"
        : t < 0.4
          ? "REMOVE"
          : t < 0.7
            ? "INSERT"
            : actor.reloadEmpty
              ? "CHAMBER"
              : "READY",
  };
}
// Reuse one typed array per cached mesh; reload frames never add cache entries.
// Copy the immutable base mesh, move named components, then cant the whole weapon.
export function animateWeapon(base, out, pose) {
  out.set(base);
  // Transform only each component range; untouched vertices retain their original positions.
  for (const { name, start, end } of base.parts || []) {
    for (let k = start; k < end; k += 9) {
      if (name === "magazine") {
        out[k] += pose.magX;
        out[k + 1] += pose.magY;
      }
      if (name === "slide") out[k + 2] += pose.slide;
      if (name === "bolt") out[k + 2] += pose.bolt;
      if (name === "belt") {
        out[k] += pose.belt * 0.18;
        out[k + 1] += pose.belt * 0.06;
      }
      if (name === "support") {
        out[k] += pose.hand * 0.1 + pose.magX + pose.reachAction * 0.04;
        out[k + 1] += pose.hand * 0.04 + pose.magY + pose.reachAction * 0.17;
        out[k + 2] +=
          pose.hand * (pose.pistol ? 0.035 : 0.23) + pose.reachAction * 0.08;
      }
      // Rotate the LMG cover about its hinge and rotate its normals by the same angle.
      if (name === "cover") {
        const a = -pose.cover * 1.25,
          c = Math.cos(a),
          s = Math.sin(a),
          y = out[k + 1] - 0.105,
          z = out[k + 2] + 0.11;
        out[k + 1] = 0.105 + y * c - z * s;
        out[k + 2] = -0.11 + y * s + z * c;
        const ny = out[k + 4],
          nz = out[k + 5];
        out[k + 4] = ny * c - nz * s;
        out[k + 5] = ny * s + nz * c;
      }
    }
  }
  // Apply the overall reload cant after local part motion so hands and magazine stay in weapon space.
  const c = Math.cos(pose.roll),
    s = Math.sin(pose.roll);
  for (let k = 0; k < out.length; k += 9) {
    const x = out[k],
      y = out[k + 1],
      nx = out[k + 3],
      ny = out[k + 4];
    out[k] = x * c - y * s;
    out[k + 1] = x * s + y * c;
    out[k + 3] = nx * c - ny * s;
    out[k + 4] = nx * s + ny * c;
  }
  return out;
}
