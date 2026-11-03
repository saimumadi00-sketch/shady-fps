// Ground movement state machine; all rates use world units and seconds rather than frame counts.
import { clamp } from "./math.js";

export const MOVEMENT = Object.freeze({
  walk: 4.5,
  sprint: 7,
  slideStart: 9.4,
  slideEnd: 3.4,
  slideDuration: 0.8,
  slideCooldown: 0.65,
});

// Tactical movement is independent of camera aim: turning during a slide does
// not redirect its initial momentum. Crouch edges prevent held-key slide spam.
const DEFAULT_HANDLING = Object.freeze({
  walk: 1,
  sprint: 1,
  adsMove: 0.65,
});
export class TacticalMovement {
  // Resolve intent, slide transitions, horizontal collision, and vertical motion in that order.
  // Handling supplies weapon-weight speed multipliers and the equipped gun's recovery time.
  update(a, i, arena, dt, h = DEFAULT_HANDLING) {
    const k = i.keys;
    let forward = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) + i.moveY;
    let side = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + i.moveX;
    // Normalize combined axes to prevent diagonal movement from exceeding forward speed.
    const length = Math.max(1, Math.hypot(forward, side));
    forward /= length;
    side /= length;
    const crouch =
      k.has("KeyC") ||
      k.has("ControlLeft") ||
      k.has("ControlRight") ||
      i.touchCrouch;
    // Detect a new crouch press so holding the key cannot chain slides.
    const crouchPressed = crouch && !a.crouchHeld;
    a.crouchHeld = crouch;
    const jump = i.consume("Space");
    const floor = arena.floor(a.x, a.z, a.y),
      grounded = a.y <= floor + 0.02;
    // Check the full standing volume before leaving a low stance under cover.
    const standingClear = () => !arena.blocked(a.x, a.z, 0.35, a.y, 1.8);
    a.slideCooldown = Math.max(0, a.slideCooldown - dt);
    const wantsSprint =
      (k.has("ShiftLeft") ||
        k.has("ShiftRight") ||
        (i.touch && i.moveY > 0.92)) &&
      forward > 0.5 &&
      !i.aim;
    // Capture slide direction at entry; subsequent camera movement does not steer momentum.
    if (crouchPressed && a.sprinting && grounded && a.slideCooldown === 0) {
      a.sliding = true;
      a.slideTime = MOVEMENT.slideDuration;
      a.slideX = Math.sin(a.yaw) * forward + Math.cos(a.yaw) * side;
      a.slideZ = -Math.cos(a.yaw) * forward + Math.sin(a.yaw) * side;
      const norm = Math.hypot(a.slideX, a.slideZ) || 1;
      a.slideX /= norm;
      a.slideZ /= norm;
    }
    // Use one exit path for expiry, wall impacts, and jump cancellation.
    const stopSlide = () => {
      a.sliding = false;
      a.slideTime = 0;
      a.slideCooldown = MOVEMENT.slideCooldown;
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
    // Keep the actor crouched when a ceiling prevents safely restoring standing height.
    a.crouched =
      a.sliding ||
      (crouch && !a.ignoreCrouch) ||
      (a.crouched && !standingClear());
    // Run and gun: sprinting never blocks or delays fire; spreadFor() widens the cone instead.
    a.sprinting =
      wantsSprint && !a.crouched && !a.sliding && grounded && !cancelled;
    a.aim = i.aim && !a.sliding;
    // Interpolate slide speed over its lifetime and stop when collision blocks travel.
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
      const walk = MOVEMENT.walk * h.walk;
      const speed = a.crouched
        ? 2.2 * h.walk
        : a.aim
          ? walk * h.adsMove
          : a.sprinting
            ? MOVEMENT.sprint * h.sprint
            : walk;
      a.moving = Math.abs(forward) + Math.abs(side) > 0.05;
      arena.move(
        a,
        (Math.sin(a.yaw) * forward + Math.cos(a.yaw) * side) * speed * dt,
        (-Math.cos(a.yaw) * forward + Math.sin(a.yaw) * side) * speed * dt,
      );
    }
    if (jump && !cancelled && grounded && !a.crouched) a.vy = 6;
    // Smooth camera height independently of collision height to avoid abrupt stance jumps.
    a.eye +=
      ((a.sliding ? 0.78 : a.crouched ? 1.02 : 1.58) - a.eye) *
      Math.min(1, dt * 15);
    // Apply gravity, reject upward ceiling penetration, then snap onto the supporting floor.
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
