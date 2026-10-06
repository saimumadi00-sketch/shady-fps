// Two-bone legs: the stance foot stays down while the other clears the floor.
export function legPose(actor, time, side) {
  const moving = actor.moving && !actor.sliding;
  const phase =
    time * (actor.sprinting ? 12 : 9) +
    actor.id * 0.7 +
    (side > 0 ? Math.PI : 0);
  const stride = actor.crouched ? 0.09 : actor.sprinting ? 0.21 : 0.15;
  const lift = moving
    ? Math.max(0, Math.sin(phase)) * (actor.crouched ? 0.065 : 0.13)
    : 0;
  const hip = { y: actor.crouched ? 0.34 : 0.71, z: 0 };
  const ankle = { y: 0.13 + lift, z: moving ? Math.cos(phase) * stride : 0 };
  const dy = ankle.y - hip.y,
    dz = ankle.z - hip.z;
  const distance = Math.hypot(dy, dz);
  const thigh = 0.31,
    shin = 0.31;
  const along =
    (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  const knee = {
    y: hip.y + (dy * along - dz * bend) / distance,
    z: hip.z + (dz * along + dy * bend) / distance,
  };
  return { hip, knee, ankle, lift };
}
