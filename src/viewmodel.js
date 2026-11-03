// Presentation offsets only: camera aim, movement and ballistics remain authoritative.
// `recoil` is an optional GunRecoil state; without it the legacy actor.kick push-back is used.
// `motion` is an optional ViewmodelMotion state (look sway, strafe lean, jump/land, sprint
// blend, speed-synced bob). Without it a time-based hip bob is used, as in headless tests.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Smootherstep: zero velocity and acceleration at both ends, like an authored ADS curve.
export const easeAim = (t) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

// Hip carry: gun low on the right, barrel converging slightly on the crosshair, a light cant.
export const HIP_POSE = Object.freeze({
  x: 0.25,
  pistolX: 0.2,
  y: -0.235,
  z: -0.77,
  yaw: 0.02,
  roll: 0.045,
});
// Low-ready sprint carry: muzzle swung down and across the body, rolled onto its side.
export const SPRINT_POSE = Object.freeze({
  x: -0.05,
  y: -0.07,
  z: 0.05,
  yaw: 0.42,
  pitch: -0.3,
  roll: 0.4,
});

// Draw curve: eased rise over the first 85%, then a small overshoot that settles.
export function drawOffset(t) {
  const x = clamp01(t);
  if (x >= 1) return 0;
  if (x < 0.85) {
    const u = x / 0.85;
    return 1 - (1 - (1 - u) ** 3) * 1.04;
  }
  const u = (x - 0.85) / 0.15;
  return -0.04 * (1 - u) * (1 - u);
}

export function viewmodelPose(
  actor,
  seconds,
  aimBlend,
  reload,
  sightHeight,
  recoil = null,
  motion = null,
) {
  const aim = clamp01(aimBlend);
  const hip = 1 - aim;
  // The raise follows an arc rather than a straight line: the gun lifts to the eye line first,
  // then slides across to centre, canting inward and dipping its muzzle mid-way before it
  // settles square behind the sights.
  const lift = 1 - hip * hip;
  const across = aim * aim * (3 - 2 * aim);
  const arc = Math.sin(Math.PI * aim);
  // Aimed motion is steadied heavily but not frozen, so the sights still feel hand-held.
  const steady = hip + aim * 0.12;
  const pistol = actor.weapon === 2;
  let sprint, slide, phase, amount, crouch, lower;
  if (motion) {
    sprint = reload.active ? 0 : motion.sprint * hip;
    slide = motion.slide * hip;
    phase = motion.phase;
    amount = motion.bob;
    crouch = motion.crouch * hip;
    lower = drawOffset(motion.draw);
  } else {
    sprint = actor.sprinting && !reload.active ? hip : 0;
    slide = actor.sliding ? hip : 0;
    phase = seconds * (actor.sprinting ? 12 : 8);
    amount = actor.moving && !actor.sliding ? hip : 0;
    crouch = actor.crouched ? hip : 0;
    lower = 0;
  }
  // Sprint stride: the carried gun swings with the shoulders, once per stride side to side
  // and dipping on each footfall, much larger than the walking bob.
  const stride = Math.sin(phase),
    stomp = Math.abs(Math.cos(phase)) - 0.5;
  // Figure-eight walk cycle: sideways once per stride, a vertical dip on each footfall.
  const bob = amount * (1 + sprint * 1.6) * steady;
  const footfall = Math.abs(Math.sin(phase));
  const bobX = Math.sin(phase) * 0.0045 * bob;
  const bobY = (0.5 - footfall) * 0.009 * bob;
  const bobRoll = Math.sin(phase) * 0.014 * bob;
  const bobYaw = Math.sin(phase) * 0.008 * bob;
  const bobPitch = (footfall - 0.5) * 0.012 * bob;
  // Idle breathing: a slow vertical swell with a slower lateral drift.
  const breathY = Math.sin(seconds * 1.6) * (0.0016 * hip + 0.0003 * aim);
  const breathX = Math.sin(seconds * 0.8) * (0.0009 * hip + 0.00015 * aim);
  // Draw: the gun comes up from below the frame, muzzle low and rolled in, and settles with
  // a slight overshoot. `lower` runs 1 (holstered) to 0, briefly negative at the overshoot.
  const m = motion
    ? {
        x: (motion.swayX - motion.strafe * 0.006) * steady,
        y: (motion.swayY + motion.air) * steady,
        z: motion.push * 0.012 * hip,
        yaw: motion.swayYaw * steady,
        pitch: (motion.swayPitch + motion.air * 0.6) * steady,
        roll: (motion.swayRoll - motion.strafe * 0.035) * steady,
      }
    : { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  // Keyframed reload motion of the whole gun (tilt, seating punch, bolt slam).
  const rg = reload.gun || { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  return {
    x:
      rg.x +
      (pistol ? HIP_POSE.pistolX : HIP_POSE.x) * (1 - across) -
      arc * 0.012 +
      SPRINT_POSE.x * sprint -
      reload.lift * 0.1 +
      crouch * -0.012 +
      lower * 0.05 +
      stride * 0.022 * sprint +
      bobX +
      breathX +
      m.x,
    y:
      rg.y +
      HIP_POSE.y +
      (-HIP_POSE.y - sightHeight) * lift -
      arc * 0.01 +
      SPRINT_POSE.y * sprint -
      slide * 0.05 +
      reload.lift * 0.1 +
      crouch * -0.014 -
      lower * 0.26 +
      stomp * -0.014 * sprint +
      breathY +
      bobY +
      m.y +
      (recoil ? recoil.up : 0),
    // The stock comes back toward the cheek when aiming.
    z:
      rg.z +
      HIP_POSE.z +
      aim * 0.035 +
      SPRINT_POSE.z * sprint +
      lower * 0.06 +
      m.z +
      (recoil ? recoil.back : actor.kick * 0.7),
    // Positive yaw swings the muzzle left.
    yaw:
      rg.yaw +
      HIP_POSE.yaw * hip +
      SPRINT_POSE.yaw * sprint +
      reload.lift * 0.18 +
      lower * 0.12 +
      stride * 0.055 * sprint +
      bobYaw +
      m.yaw +
      (recoil ? recoil.yaw : 0),
    // Positive pitch raises the barrel.
    pitch:
      rg.pitch -
      arc * 0.035 +
      SPRINT_POSE.pitch * sprint -
      lower * 0.7 +
      stomp * 0.03 * sprint +
      bobPitch +
      m.pitch +
      (recoil ? recoil.pitch : 0),
    // Positive roll cants the top of the gun to the left.
    roll:
      HIP_POSE.roll * hip +
      arc * 0.09 +
      SPRINT_POSE.roll * sprint +
      slide * 0.3 +
      // Crouched, the gun tucks in with a little more cant.
      crouch * 0.07 +
      lower * 0.45 +
      stride * 0.045 * sprint +
      bobRoll +
      m.roll +
      (recoil ? recoil.roll : 0),
  };
}

// Damped spring toward a target, mutating `s` = { x, v }.
function spring(s, target, omega, zeta, h) {
  s.v += (-omega * omega * (s.x - target) - 2 * zeta * omega * s.v) * h;
  s.x += s.v * h;
}
const SWAY_KEYS = ["swayX", "swayY", "swayYaw", "swayPitch", "swayRoll", "air"];

// Frame-to-frame weapon motion driven by camera turns, body velocity and stance. Pure
// presentation: fed from rendered positions/angles and never written back to the simulation.
export class ViewmodelMotion {
  constructor() {
    this.reset();
  }
  reset() {
    this.phase = this.bob = this.sprint = this.slide = this.crouch = 0;
    // Draw progress 0..1; complete unless raise() starts a draw.
    this.draw = 1;
    this.drawTime = 0.3;
    this.crouched = null;
    this.strafe = this.push = 0;
    this.last = null;
    this.springs = {};
    for (const k of SWAY_KEYS) {
      this.springs[k] = { x: 0, v: 0 };
      this[k] = 0;
    }
  }
  // Start a draw that takes `seconds` (the weapon's equip time, so the gun is up as soon as
  // it can fire).
  raise(seconds = 0.3) {
    this.draw = 0;
    this.drawTime = Math.max(0.12, seconds);
    return this;
  }
  // `actor` supplies x/z/yaw/pitch/vy and the moving/sprinting/sliding/crouched flags.
  update(dt, actor) {
    if (!(dt > 0)) return this;
    dt = Math.min(dt, 0.05);
    const prev = this.last,
      vy = actor.vy || 0;
    this.last = {
      x: actor.x,
      z: actor.z,
      yaw: actor.yaw,
      pitch: actor.pitch,
      vy,
    };
    if (!prev) return this;
    const dYaw = Math.atan2(
      Math.sin(actor.yaw - prev.yaw),
      Math.cos(actor.yaw - prev.yaw),
    );
    let vx = (actor.x - prev.x) / dt,
      vz = (actor.z - prev.z) / dt;
    // Respawns and teleports are not motion.
    if (Math.hypot(vx, vz) > 25) vx = vz = 0;
    const s = Math.sin(actor.yaw),
      c = Math.cos(actor.yaw);
    const right = vx * c + vz * s,
      forward = vx * s - vz * c,
      speed = Math.hypot(vx, vz);
    const k = (rate) => 1 - Math.exp(-rate * dt);
    // Turn rates (rad/s) make the gun trail the view; capped so fast flicks stay tidy.
    const yawRate = clamp(dYaw / dt, -6, 6),
      pitchRate = clamp((actor.pitch - prev.pitch) / dt, -6, 6);
    const targets = {
      swayX: -yawRate * 0.0065,
      swayYaw: yawRate * 0.014,
      swayRoll: yawRate * 0.024,
      swayY: -pitchRate * 0.0052,
      swayPitch: -pitchRate * 0.014,
      // Rising pulls the gun down, falling floats it up.
      air: clamp(-vy * 0.0028, -0.02, 0.02),
    };
    // Hard landing: an impulse that dips the gun and lets it spring back.
    const grounded = Math.abs(vy) < 1e-6;
    if (grounded && prev.vy < -3)
      this.springs.air.v -= Math.min(0.5, -prev.vy * 0.045);
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      for (const key of SWAY_KEYS)
        if (key === "air") spring(this.springs[key], targets[key], 16, 0.5, h);
        else spring(this.springs[key], targets[key], 14, 0.72, h);
    }
    for (const key of SWAY_KEYS) this[key] = this.springs[key].x;
    this.strafe += (clamp(right / 5, -1, 1) - this.strafe) * k(8);
    this.push += (clamp(forward / 5, -1, 1) - this.push) * k(6);
    const moving = actor.moving && !actor.sliding && grounded && speed > 0.3;
    this.bob += ((moving ? Math.min(1.3, speed / 4.5) : 0) - this.bob) * k(7);
    // Stride frequency follows ground speed so footfalls stay in step at any pace.
    if (moving)
      this.phase = (this.phase + dt * (3.2 + speed * 1.15)) % (Math.PI * 200);
    this.sprint +=
      ((actor.sprinting ? 1 : 0) - this.sprint) * k(actor.sprinting ? 9 : 13);
    this.slide += ((actor.sliding ? 1 : 0) - this.slide) * k(10);
    const crouched = !!actor.crouched;
    this.crouch += ((crouched ? 1 : 0) - this.crouch) * k(10);
    // Changing stance jolts the gun: down when dropping into a crouch, a smaller bump rising.
    if (this.crouched !== null && crouched !== this.crouched)
      this.springs.air.v += crouched ? -0.22 : 0.12;
    this.crouched = crouched;
    this.draw = Math.min(1, this.draw + dt / this.drawTime);
    return this;
  }
}

// Recoil impulse per shot for an AR-strength weapon (WEAPONS[i].kick === 0.019).
export const GUN_RECOIL = Object.freeze({
  back: 0.045,
  up: 0.01,
  pitch: 0.075,
  yaw: 0.035,
  roll: 0.04,
});
// Aimed shots drive mostly straight back into the shoulder; climb and twist are suppressed so
// the sight picture stays usable between rounds.
const AIM_SCALE = Object.freeze({
  back: 0.75,
  up: 0.35,
  pitch: 0.3,
  yaw: 0.35,
  roll: 0.25,
});
// Each channel is a critically damped spring: a shot adds velocity, the gun snaps out and
// settles back without overshoot. Omega sets recovery speed (higher recovers faster).
const CHANNELS = Object.freeze({
  back: { omega: 26, max: 0.11 },
  up: { omega: 20, max: 0.03 },
  pitch: { omega: 17, max: 0.22 },
  yaw: { omega: 20, max: 0.06 },
  roll: { omega: 18, max: 0.08 },
});
export class GunRecoil {
  constructor() {
    this.reset();
  }
  reset() {
    this.back = this.up = this.pitch = this.yaw = this.roll = 0;
    this.velocity = { back: 0, up: 0, pitch: 0, yaw: 0, roll: 0 };
  }
  // `strength` is the weapon's kick relative to the AR; `side` in [-1, 1] picks the sideways jolt.
  kick(strength, aim = 0, side = 0) {
    // Peak displacement of a critically damped spring is v / (omega * e).
    for (const [name, { omega }] of Object.entries(CHANNELS)) {
      const scale = strength * (1 - (1 - AIM_SCALE[name]) * aim);
      const peak =
        (name === "yaw" || name === "roll" ? side : 1) *
        GUN_RECOIL[name] *
        scale;
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
