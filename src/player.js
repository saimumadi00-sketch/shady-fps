import { clamp } from "./math.js";
import { TacticalMovement } from "./movement.js";
import { WEAPONS } from "./weapons.js";
export class PlayerController {
  constructor(game, input) {
    this.game = game;
    this.input = input;
    this.movement = new TacticalMovement();
  }
  update(dt, sensitivity) {
    const g = this.game,
      a = g.player,
      i = this.input;
    if (!a.alive) {
      i.clear();
      return;
    }
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
    for (let n = 0; n < 3; n++)
      if (i.consume("Digit" + (n + 1))) g.weapons.equip(a, n);
    if (i.consume("switch")) g.weapons.equip(a, (a.weapon + 1) % 3);
    if (i.consume("KeyR")) g.weapons.reload(a);
    const pressed = i.consume("fire");
    if (
      !a.sprinting &&
      a.fireDelay === 0 &&
      (WEAPONS[a.weapon].automatic ? i.fire : pressed)
    )
      g.weapons.fire(a);
  }
}
