// Converts normalized local input into camera aim, movement, and weapon commands.
import { loadout, slotWeapon } from "./loadouts.js";
import { clamp } from "./math.js";
import { TacticalMovement } from "./movement.js";
import { WEAPONS, handling, compensateRecoil } from "./weapons.js";
// Mouse deltas are pixels; touch drags use a larger multiplier. ADS slows aim in step
// with the weapon's zoom, so a scoped marksman rifle stays controllable.
// `sensitivity` is a number (mouse only) or { mouse, ads, touch } from Settings: touch play
// uses the touch value instead of the mouse one, and `ads` scales aim while sighted.
export function aimScale(a, input, sensitivity) {
  const s =
    typeof sensitivity === "number"
      ? { mouse: sensitivity }
      : sensitivity || {};
  const zoom = WEAPONS[a.weapon]?.adsZoom || 1.4;
  const base = input.touch ? 1.8 * (s.touch ?? 1) : (s.mouse ?? 1);
  return 0.0024 * base * (a.aim ? (0.91 / zoom) * (s.ads ?? 1) : 1);
}
// Seconds a semi-automatic press stays queued, so taps during the fire interval are not lost.
export const FIRE_BUFFER = 0.25;
export class PlayerController {
  // Keep movement state handling separate from camera and weapon decisions.
  constructor(game, input, actor = null) {
    this.game = game;
    this.input = input;
    this.actor = actor;
    this.movement = new TacticalMovement();
    this.fireBuffer = 0;
  }
  // Consume input once per simulation tick; dead players cannot issue actions.
  update(dt, sensitivity) {
    const g = this.game,
      a = this.actor || g.player,
      i = this.input;
    this.fireBuffer = Math.max(0, this.fireBuffer - dt);
    if (!a.alive) {
      i.clear();
      this.fireBuffer = 0;
      return;
    }
    // Online clients own their view angles; accept them only for the current life so a
    // late packet cannot undo the facing assigned at respawn. Offline input supplies deltas.
    if (i.view) {
      // Client angles exclude recoil; the server-owned recoil for this life is added on top.
      if (i.view.spawnId === a.spawnId) {
        // Pulling the raw aim down counts against the recoil that would otherwise recover.
        if (typeof a.viewPitch === "number")
          compensateRecoil(a, i.view.pitch - a.viewPitch);
        a.viewPitch = i.view.pitch;
        a.yaw = i.view.yaw + (a.recoilYaw || 0);
        a.pitch = clamp(i.view.pitch + (a.recoilPitch || 0), -1.45, 1.45);
      }
    } else {
      const scale = aimScale(a, i, sensitivity);
      a.yaw += i.dx * scale;
      compensateRecoil(a, -i.dy * scale);
      a.pitch = clamp(a.pitch - i.dy * scale, -1.45, 1.45);
    }
    i.dx = i.dy = 0;
    this.movement.update(a, i, g.arena, dt, handling(a));
    // ADS accuracy and zoom ramp in over the equipped weapon's ADS time.
    const w = WEAPONS[a.weapon];
    a.adsProgress = clamp(
      (a.adsProgress || 0) + (a.aim ? dt : -dt * 1.5) / w.adsTime,
      0,
      1,
    );
    // 1 selects the class primary and 2 the sidearm; Q, the mouse wheel and SWAP toggle.
    for (let slot = 1; slot <= 2; slot++)
      if (i.consume("Digit" + slot))
        g.weapons.equip(a, slotWeapon(a.classId, slot));
    if (i.consume("switch")) {
      const allowed = loadout(a.classId).weapons;
      g.weapons.equip(
        a,
        allowed[(allowed.indexOf(a.weapon) + 1) % allowed.length],
      );
    }
    if (i.consume("KeyR")) g.weapons.reload(a);
    // Automatic guns use held fire; semi-automatic guns require a new press, which is
    // buffered briefly so a tap during the cooldown fires as soon as the weapon is ready.
    if (i.consume("fire")) this.fireBuffer = FIRE_BUFFER;
    const automatic = WEAPONS[a.weapon].automatic;
    if (
      (automatic ? i.fire : this.fireBuffer > 0) &&
      g.weapons.fire(a) &&
      !automatic
    )
      this.fireBuffer = 0;
  }
}
