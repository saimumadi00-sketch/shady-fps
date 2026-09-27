import { clamp } from "./math.js";

export const MOVEMENT = Object.freeze({
  walk: 4.5,
  sprint: 7,
  slideStart: 9.4,
  slideEnd: 3.4,
  slideDuration: 0.8,
  slideCooldown: 0.65,
  sprintToFire: 0.14,
  slideToFire: 0.12,
});

// Tactical movement is independent of camera aim: turning during a slide does
// not redirect its initial momentum. Crouch edges prevent held-key slide spam.
export class TacticalMovement {
  update(a, i, arena, dt) {
    const k = i.keys;
    let forward = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) + i.moveY;
    let side = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + i.moveX;
    const length = Math.max(1, Math.hypot(forward, side));
    forward /= length;
    side /= length;
    const crouch =
      k.has("KeyC") ||
      k.has("ControlLeft") ||
      k.has("ControlRight") ||
      i.touchCrouch;
    const crouchPressed = crouch && !a.crouchHeld;
    a.crouchHeld = crouch;
    const jump = i.consume("Space");
    const floor = arena.floor(a.x, a.z, a.y),
      grounded = a.y <= floor + 0.02;
    const standingClear = () => !arena.blocked(a.x, a.z, 0.35, a.y, 1.8);
    a.slideCooldown = Math.max(0, a.slideCooldown - dt);
    a.fireDelay = Math.max(0, a.fireDelay - dt);
    const wantsSprint =
      (k.has("ShiftLeft") ||
        k.has("ShiftRight") ||
        (i.touch && i.moveY > 0.92)) &&
      forward > 0.5 &&
      !i.aim;
    if (crouchPressed && a.sprinting && grounded && a.slideCooldown === 0) {
      a.sliding = true;
      a.slideTime = MOVEMENT.slideDuration;
      a.slideX = Math.sin(a.yaw) * forward + Math.cos(a.yaw) * side;
      a.slideZ = -Math.cos(a.yaw) * forward + Math.sin(a.yaw) * side;
      const norm = Math.hypot(a.slideX, a.slideZ) || 1;
      a.slideX /= norm;
      a.slideZ /= norm;
    }
    const stopSlide = () => {
      a.sliding = false;
      a.slideTime = 0;
      a.slideCooldown = MOVEMENT.slideCooldown;
      a.fireDelay = Math.max(a.fireDelay, MOVEMENT.slideToFire);
    };
    let cancelled = false;
    if (a.sliding && jump && standingClear()) {
      stopSlide();
      cancelled = true;
      a.vy = grounded ? 5.2 : a.vy;
      // A cancel stands up even while C is held, until a new crouch press.
      a.ignoreCrouch = true;
      i.touchCrouch = false;
    }
    if (!crouch) a.ignoreCrouch = false;
    if (a.sliding && !grounded) stopSlide();
    a.crouched =
      a.sliding ||
      (crouch && !a.ignoreCrouch) ||
      (a.crouched && !standingClear());
    const wasSprint = a.sprinting;
    a.sprinting =
      wantsSprint && !a.crouched && !a.sliding && grounded && !cancelled;
    if (wasSprint && !a.sprinting)
      a.fireDelay = Math.max(a.fireDelay, MOVEMENT.sprintToFire);
    a.aim = i.aim && !a.sliding;
    if (a.sliding) {
      const t = 1 - a.slideTime / MOVEMENT.slideDuration;
      const speed =
        MOVEMENT.slideStart +
        (MOVEMENT.slideEnd - MOVEMENT.slideStart) * clamp(t, 0, 1);
      const x = a.x,
        z = a.z;
      arena.move(a, a.slideX * speed * dt, a.slideZ * speed * dt);
      a.slideTime -= dt;
      if (a.slideTime <= 0 || Math.hypot(a.x - x, a.z - z) < speed * dt * 0.15)
        stopSlide();
      a.moving = true;
    } else {
      const speed = a.crouched
        ? 2.2
        : a.aim
          ? 3
          : a.sprinting
            ? MOVEMENT.sprint
            : MOVEMENT.walk;
      a.moving = Math.abs(forward) + Math.abs(side) > 0.05;
      arena.move(
        a,
        (Math.sin(a.yaw) * forward + Math.cos(a.yaw) * side) * speed * dt,
        (-Math.cos(a.yaw) * forward + Math.sin(a.yaw) * side) * speed * dt,
      );
    }
    if (jump && !cancelled && grounded && !a.crouched) a.vy = 6;
    a.eye +=
      ((a.sliding ? 0.78 : a.crouched ? 1.02 : 1.58) - a.eye) *
      Math.min(1, dt * 15);
    a.vy -= 18 * dt;
    const nextY = a.y + a.vy * dt;
    if (
      a.vy > 0 &&
      arena.blocked(a.x, a.z, 0.34, nextY, a.crouched ? 1.15 : 1.8)
    )
      a.vy = 0;
    else a.y = nextY;
    const landing = arena.floor(a.x, a.z, Math.max(a.y, floor));
    if (a.y <= landing) {
      a.y = landing;
      a.vy = 0;
    }
  }
}
