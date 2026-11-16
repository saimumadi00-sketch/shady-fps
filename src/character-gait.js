// Two-bone legs: the stance foot stays down while the other clears the floor.
// Thigh and shin length, sized for a 1.8 m figure whose hips sit at half its height.
export const LEG_BONE = 0.41;
// Hip height standing and crouched; the upper body is built upward from here.
export const HIP_STANDING = 0.9,
  HIP_CROUCHED = 0.36;
// Crouching sits the hips back, so the forward-leaning head stays over the feet (and inside
// the head hitbox, which is centred on the actor).
export const CROUCH_SIT = 0.22;
export function legPose(actor, time, side) {
  const moving = actor.moving && !actor.sliding;
  const phase =
    time * (actor.sprinting ? 12 : 9) +
    actor.id * 0.7 +
    (side > 0 ? Math.PI : 0);
  const stride = actor.crouched ? 0.1 : actor.sprinting ? 0.28 : 0.2;
  const lift = moving
    ? Math.max(0, Math.sin(phase)) * (actor.crouched ? 0.065 : 0.14)
    : 0;
  const hip = actor.crouched
    ? { y: HIP_CROUCHED, z: CROUCH_SIT }
    : { y: HIP_STANDING, z: 0 };
  const ankle = { y: 0.13 + lift, z: moving ? Math.cos(phase) * stride : 0 };
  const dy = ankle.y - hip.y,
    dz = ankle.z - hip.z;
  const distance = Math.hypot(dy, dz);
  const thigh = LEG_BONE,
    shin = LEG_BONE;
  const along =
    (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  const knee = {
    y: hip.y + (dy * along - dz * bend) / distance,
    z: hip.z + (dz * along + dy * bend) / distance,
  };
  return { hip, knee, ankle, lift };
}
