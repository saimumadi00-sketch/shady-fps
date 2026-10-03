// Presentation offsets only: camera aim, movement and ballistics remain authoritative.
export function viewmodelPose(actor, seconds, aimBlend, reload, sightHeight) {
  const aim = Math.max(0, Math.min(1, aimBlend));
  const hip = 1 - aim;
  const moving = actor.moving && !actor.sliding;
  const stride = seconds * (actor.sprinting ? 12 : 8);
  const breath = Math.sin(seconds * 1.8) * 0.0015 * hip;
  const bob = moving ? Math.sin(stride * 2) * 0.0035 * hip : 0;
  const sprint = actor.sprinting && !reload.active ? hip : 0;
  return {
    x:
      (actor.weapon === 2 ? 0.2 : 0.25) * hip -
      reload.lift * 0.1 +
      (moving ? Math.sin(stride) * 0.004 * hip : 0),
    y:
      -0.235 +
      (0.235 - sightHeight) * aim +
      breath +
      bob +
      reload.lift * 0.1 -
      sprint * 0.035 -
      (actor.sliding ? 0.045 * hip : 0),
    z: -0.77 - aim * 0.06 + actor.kick * 0.7,
    yaw:
      -0.075 * hip +
      reload.lift * 0.18 +
      (moving ? Math.sin(stride) * 0.006 * hip : 0),
  };
}
