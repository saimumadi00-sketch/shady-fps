// Presentation offsets only: camera aim, movement and ballistics remain authoritative.
// `recoil` is an optional GunRecoil state; without it the legacy actor.kick push-back is used.
export function viewmodelPose(
  actor,
  seconds,
  aimBlend,
  reload,
  sightHeight,
  recoil = null,
) {
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
      (actor.sliding ? 0.045 * hip : 0) +
      (recoil ? recoil.up : 0),
    z: -0.77 - aim * 0.06 + (recoil ? recoil.back : actor.kick * 0.7),
    yaw:
      -0.075 * hip +
      reload.lift * 0.18 +
      (moving ? Math.sin(stride) * 0.006 * hip : 0) +
      (recoil ? recoil.yaw : 0),
    // Muzzle climb; positive pitch raises the barrel.
    pitch: recoil ? recoil.pitch : 0,
  };
}

// Recoil impulse per shot for an AR-strength weapon (WEAPONS[i].kick === 0.019).
export const GUN_RECOIL = Object.freeze({
  back: 0.045,
  up: 0.01,
  pitch: 0.075,
  yaw: 0.035,
  // Aimed shots kick less so the sights stay usable between rounds.
  aimScale: 0.45,
});
// Each channel is a critically damped spring: a shot adds velocity, the gun snaps out and
// settles back without overshoot. Omega sets recovery speed (higher recovers faster).
const CHANNELS = Object.freeze({
  back: { omega: 26, max: 0.11 },
  up: { omega: 20, max: 0.03 },
  pitch: { omega: 17, max: 0.22 },
  yaw: { omega: 20, max: 0.06 },
});
export class GunRecoil {
  constructor() {
    this.reset();
  }
  reset() {
    this.back = this.up = this.pitch = this.yaw = 0;
    this.velocity = { back: 0, up: 0, pitch: 0, yaw: 0 };
  }
  // `strength` is the weapon's kick relative to the AR; `side` in [-1, 1] picks the sideways jolt.
  kick(strength, aim = 0, side = 0) {
    const scale = strength * (1 - (1 - GUN_RECOIL.aimScale) * aim);
    // Peak displacement of a critically damped spring is v / (omega * e).
    for (const [name, { omega }] of Object.entries(CHANNELS)) {
      const peak = (name === "yaw" ? side : 1) * GUN_RECOIL[name] * scale;
      this.velocity[name] += peak * omega * Math.E;
    }
  }
  // Advance in small substeps so large frame gaps stay stable.
  update(dt) {
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      for (const [name, { omega, max }] of Object.entries(CHANNELS)) {
        const v =
          this.velocity[name] +
          (-omega * omega * this[name] - 2 * omega * this.velocity[name]) * h;
        this.velocity[name] = v;
        this[name] = Math.max(-max, Math.min(max, this[name] + v * h));
      }
    }
    return this;
  }
}
