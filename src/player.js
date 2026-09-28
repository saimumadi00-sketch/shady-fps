// Converts normalized local input into camera aim, movement, and weapon commands.
import { loadout } from "./loadouts.js";
import { clamp } from "./math.js";
import { TacticalMovement } from "./movement.js";
import { WEAPONS } from "./weapons.js";
export class PlayerController {
  // Keep movement state handling separate from camera and weapon decisions.
  constructor(game, input) {
    this.game = game;
    this.input = input;
    this.movement = new TacticalMovement();
  }
  // Consume input once per simulation tick; dead players cannot issue actions.
  update(dt, sensitivity) {
    const g = this.game,
      a = g.player,
      i = this.input;
    if (!a.alive) {
      i.clear();
      return;
    }
    // Apply sensitivity and ADS scaling to pixel deltas, then clamp vertical aim.
    a.yaw +=
      i.dx * 0.0024 * sensitivity * (a.aim ? 0.65 : 1) * (i.touch ? 1.8 : 1);
    a.pitch = clamp(
      a.pitch -
        i.dy * 0.0024 * sensitivity * (a.aim ? 0.65 : 1) * (i.touch ? 1.8 : 1),
      -1.45,
      1.45,
    );
    i.dx = i.dy = 0;
    this.movement.update(a, i, g.arena, dt);
    // Global weapon keys are validated by equip; SWAP visits only this class primary and sidearm.
    for (let n = 0; n < WEAPONS.length; n++)
      if (i.consume("Digit" + (n + 1))) g.weapons.equip(a, n);
    if (i.consume("switch")) {
      const allowed = loadout(a.classId).weapons;
      g.weapons.equip(
        a,
        allowed[(allowed.indexOf(a.weapon) + 1) % allowed.length],
      );
    }
    if (i.consume("KeyR")) g.weapons.reload(a);
    // Automatic guns use held fire; semi-automatic guns require a new press.
    const pressed = i.consume("fire");
    if (
      !a.sprinting &&
      a.fireDelay === 0 &&
      (WEAPONS[a.weapon].automatic ? i.fire : pressed)
    )
      g.weapons.fire(a);
  }
}
