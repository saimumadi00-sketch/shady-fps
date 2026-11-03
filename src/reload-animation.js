// Pure visual reload pose generation and mesh deformation; ammunition stays owned by WeaponController.
//
// Each weapon family plays a keyframed reload built from the real manual of arms:
//  - Rifles (assault rifle, SMG, marksman rifle): cant the gun, support hand to the magazine,
//    strip it and stow it (tactical) or let it fall free and go straight to the pouch (empty),
//    bring a fresh one up, rock it into the well front lip first, seat it with an upward
//    punch, then on an empty gun run the side charging handle: reach, pull, let it slam.
//  - Pistol: tilt in, drop or strip the magazine, insert straight up and seat it with the palm,
//    then on an empty gun release the locked-back slide, which snaps forward.
//  - LMG: open the feed cover, swap the ammo box, slap the cover shut, and charge it when
//    empty.
// The magazine falling from an empty gun follows real gravity over the reload's own duration.
import { WEAPONS } from "./weapons.js";

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Keyframe track: [[t, value], ...] with eased (zero-velocity) segments; values are numbers
// or arrays of numbers.
function key(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i],
      [t1, b] = keys[i + 1];
    if (t <= t1) {
      const u = smooth(clamp01((t - t0) / (t1 - t0 || 1)));
      return Array.isArray(a)
        ? a.map((v, k) => v + (b[k] - v) * u)
        : a + (b - a) * u;
    }
  }
  return keys[keys.length - 1][1];
}
// A short bump (0 → 1 → 0) starting at t0, for seating punches and bolt slams.
const bump = (t, t0, width) => {
  const u = (t - t0) / width;
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) * (1 - u * 0.5);
};
const ZERO = [0, 0, 0];
const add3 = (a, b, s = 1) => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
  a[2] + b[2] * s,
];

// Rest pose: everything at zero.
const REST = {
  active: false,
  t: 0,
  lift: 0,
  roll: 0,
  gun: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  hand: 0,
  handOffset: ZERO,
  reach: 0,
  magOffset: ZERO,
  magPitch: 0,
  bolt: 0,
  slide: 0,
  cover: 0,
  pistol: false,
  stage: "",
};

// Where the support hand and the magazine go between pulling the old one and bringing the
// new one (below the frame, toward the belt pouches), in weapon space.
const POUCH = [-0.16, -0.58, 0.14];

function rifle(t, empty, seconds, w) {
  // Straight SMG magazines barely rock; the curved rifle and DMR magazines rock in.
  const rock = w === 1 ? 0.12 : w === 3 ? 0.22 : 0.3;
  const tilt = { x: -0.075, y: 0.06, z: 0.012, yaw: 0.17, pitch: 0.07 };
  const seat = empty ? 0.61 : 0.65,
    release = 0.8;
  const out = empty ? 0.12 : 0.18;
  // The new magazine arrives at the well tipped forward, then rocks back flat as it seats.
  const approach = [-0.03, -0.12, -0.03],
    lip = [-0.008, -0.03, -0.006];
  const hand = empty
    ? key(t, [
        [0.04, 0],
        [0.16, 1],
        [0.62, 1],
        [0.72, 0],
      ])
    : key(t, [
        [0.06, 0],
        [0.17, 1],
        [0.7, 1],
        [0.82, 0],
      ]);
  // Hand path: tactical strips the magazine and carries it away; empty goes straight down.
  const handOffset = empty
    ? key(t, [
        [0.12, ZERO],
        [0.3, POUCH],
        [0.38, POUCH],
        [0.5, approach],
        [0.57, lip],
        [seat, ZERO],
      ])
    : key(t, [
        [out, ZERO],
        [0.24, [-0.01, -0.1, 0.012]],
        [0.36, POUCH],
        [0.46, POUCH],
        [0.56, approach],
        [0.61, lip],
        [seat, ZERO],
      ]);
  let magOffset, magPitch;
  if (empty && t > out && t < 0.38) {
    // Released magazine falls free: real gravity over real seconds, tumbling slightly.
    const s = (t - out) * seconds;
    magOffset = [-0.04 * s, -4.9 * s * s, 0.05 * s];
    magPitch = 1.6 * s;
  } else {
    magOffset = t > out && t < seat + 0.02 ? handOffset : ZERO;
    magPitch = key(t, [
      [out, 0],
      [0.24, empty ? 0 : rock * 0.5],
      [0.36, empty ? 0 : rock],
      [0.46, rock],
      [0.56, rock * 1.2],
      [empty ? 0.57 : 0.61, rock * 0.8],
      [seat, 0],
    ]);
  }
  // The seating punch drives hand, magazine and gun up together for an instant.
  const punch = bump(t, seat, 0.05);
  magOffset = add3(magOffset, [0, 0.012, 0], punch);
  // Empty: the side charging handle is locked back from the last shot, is pulled a little
  // further, then slams home.
  const bolt = empty
    ? t < 0.74
      ? 0.055
      : t < release
        ? key(t, [
            [0.74, 0.055],
            [0.785, 0.088],
          ])
        : 0.088 * (1 - smooth(clamp01((t - release) / 0.015)))
    : 0;
  const reach = empty
    ? key(t, [
        [0.65, 0],
        [0.73, 1],
        [0.81, 1],
        [0.9, 0],
      ])
    : 0;
  const slam = empty ? bump(t, release, 0.06) : 0;
  const envelope = key(t, [
    [0, 0],
    [0.12, 1],
    [empty ? 0.88 : 0.82, 1],
    [1, 0],
  ]);
  // While charging, the gun turns its right side toward the eye.
  const charge = empty
    ? key(t, [
        [0.64, 0],
        [0.72, 1],
        [0.84, 1],
        [0.94, 0],
      ])
    : 0;
  return {
    roll: envelope * (-0.52 + charge * 0.32) + slam * 0.04,
    gun: {
      x: tilt.x * envelope + charge * 0.02,
      y: tilt.y * envelope + punch * 0.01,
      z: tilt.z * envelope + slam * 0.014,
      yaw: tilt.yaw * envelope - charge * 0.1,
      pitch: tilt.pitch * envelope + punch * 0.035 - slam * 0.02,
    },
    hand,
    handOffset: add3(
      add3(handOffset, [0, 0.012, 0], punch),
      [0, 0, bolt - 0.055],
      reach,
    ),
    reach,
    magOffset,
    magPitch,
    bolt,
    stage:
      t < out
        ? "REACH"
        : t < 0.4
          ? "REMOVE"
          : t < seat
            ? "INSERT"
            : empty && t < 0.9
              ? "CHAMBER"
              : "READY",
  };
}

function pistol(t, empty, seconds) {
  const out = empty ? 0.1 : 0.16,
    seat = empty ? 0.6 : 0.64,
    release = 0.79;
  const below = [0, -0.11, 0.004];
  const hand = key(t, [
    [0.02, 0],
    [0.16, 1],
    [seat + 0.03, 1],
    [seat + 0.18, 0],
  ]);
  const handOffset = empty
    ? key(t, [
        [out, ZERO],
        [0.28, POUCH],
        [0.36, POUCH],
        [0.52, below],
        [seat, ZERO],
      ])
    : key(t, [
        [out, ZERO],
        [0.22, [0, -0.09, 0.006]],
        [0.34, POUCH],
        [0.44, POUCH],
        [0.56, below],
        [seat, ZERO],
      ]);
  let magOffset;
  if (empty && t > out && t < 0.36) {
    const s = (t - out) * seconds;
    magOffset = [-0.02 * s, -4.9 * s * s, 0.03 * s];
  } else magOffset = t > out && t < seat + 0.02 ? handOffset : ZERO;
  // The palm drives the magazine home.
  const punch = bump(t, seat, 0.06);
  magOffset = add3(magOffset, [0, 0.01, 0], punch);
  // Empty: the slide is locked back from the last shot until the thumb drops the release.
  const slide = empty ? 0.075 * (1 - smooth(clamp01((t - release) / 0.02))) : 0;
  const slam = empty ? bump(t, release, 0.07) : 0;
  const envelope = key(t, [
    [0, 0],
    [0.12, 1],
    [0.84, 1],
    [1, 0],
  ]);
  return {
    roll: envelope * -0.36 + slam * 0.05,
    gun: {
      x: -0.03 * envelope,
      y: 0.05 * envelope + punch * 0.012,
      z: slam * 0.016,
      yaw: 0.1 * envelope,
      pitch: 0.12 * envelope + punch * 0.05 + slam * 0.04,
    },
    hand,
    handOffset: add3(handOffset, [0, 0.01, 0], punch),
    reach: 0,
    magOffset,
    magPitch: 0,
    // Pistols have no separate bolt part; the slide carries the empty-gun action.
    bolt: slide > 0.001 ? slide : 0,
    slide,
    pistol: true,
    stage:
      t < out
        ? "REACH"
        : t < 0.36
          ? "REMOVE"
          : t < seat
            ? "INSERT"
            : empty && t < release + 0.03
              ? "CHAMBER"
              : "READY",
  };
}

function lmg(t, empty) {
  const seat = 0.6,
    slap = 0.78,
    release = 0.9;
  const cover = key(t, [
    [0.1, 0],
    [0.18, 1],
    [0.71, 1],
    [slap, 0],
  ]);
  const hand = key(t, [
    [0.22, 0],
    [0.3, 1],
    [0.62, 1],
    [0.68, 0],
  ]);
  const handOffset = key(t, [
    [0.3, ZERO],
    [0.36, [-0.02, -0.1, 0.02]],
    [0.44, POUCH],
    [0.5, POUCH],
    [0.57, [-0.02, -0.08, 0]],
    [seat, ZERO],
  ]);
  const magOffset = t > 0.3 && t < seat + 0.02 ? handOffset : ZERO;
  // The hand goes up to the feed cover to open it and again to slap it shut, then (empty)
  // to the charging handle.
  const reach = Math.max(
    key(t, [
      [0.04, 0],
      [0.12, 1],
      [0.18, 1],
      [0.23, 0],
    ]),
    key(t, [
      [0.68, 0],
      [0.73, 1],
      [slap, 1],
      [0.83, 0],
    ]),
    empty
      ? key(t, [
          [0.82, 0],
          [0.86, 1],
          [0.91, 1],
          [0.96, 0],
        ])
      : 0,
  );
  const bolt = empty
    ? t < 0.86
      ? 0
      : t < release
        ? key(t, [
            [0.86, 0],
            [0.89, 0.09],
          ])
        : 0.09 * (1 - smooth(clamp01((t - release) / 0.012)))
    : 0;
  const punch = bump(t, seat, 0.04),
    shut = bump(t, slap, 0.04),
    slam = empty ? bump(t, release, 0.04) : 0;
  const envelope = key(t, [
    [0, 0],
    [0.08, 1],
    [empty ? 0.93 : 0.86, 1],
    [1, 0],
  ]);
  return {
    roll: envelope * -0.24 + shut * 0.03,
    gun: {
      x: -0.05 * envelope,
      y: 0.05 * envelope + punch * 0.008 - shut * 0.01,
      z: 0.02 * envelope + slam * 0.012,
      yaw: 0.12 * envelope,
      pitch: 0.1 * envelope + punch * 0.025 - shut * 0.03,
    },
    hand,
    handOffset: add3(
      add3(handOffset, [0, 0.01, 0], punch),
      [0, 0, bolt],
      reach,
    ),
    reach,
    magOffset: add3(magOffset, [0, 0.01, 0], punch),
    magPitch: 0,
    bolt,
    cover,
    stage:
      t < 0.18
        ? "REACH"
        : t < 0.45
          ? "REMOVE"
          : t < slap
            ? "INSERT"
            : empty && t < 0.95
              ? "CHAMBER"
              : "READY",
  };
}

// Normalize the remaining reload timer and play the weapon's sequence; inactive or dead
// actors use the rest pose.
export function reloadPose(actor) {
  const active = actor.reload > 0 && actor.alive;
  if (!active) return { ...REST, pistol: actor.weapon === 2 };
  const seconds =
    actor.reloadTime ||
    (actor.reloadEmpty
      ? WEAPONS[actor.weapon].reloadEmpty
      : WEAPONS[actor.weapon].reload);
  const t = clamp01(1 - actor.reload / seconds),
    empty = !!actor.reloadEmpty;
  const pose =
    actor.weapon === 2
      ? pistol(t, empty, seconds)
      : actor.weapon === 4
        ? lmg(t, empty)
        : rifle(t, empty, seconds, actor.weapon);
  return { ...REST, ...pose, active, t };
}

// Top-front corner of the magazine, its pivot when rocking in and out (cached per mesh).
function magPivot(base) {
  if (base.magPivot) return base.magPivot;
  const mag = (base.parts || []).find((p) => p.name === "magazine");
  let top = -Infinity,
    front = Infinity;
  if (mag)
    for (let k = mag.start; k < mag.end; k += 9) {
      top = Math.max(top, base[k + 1]);
      front = Math.min(front, base[k + 2]);
    }
  base.magPivot = mag ? [top, front] : [0, 0];
  return base.magPivot;
}

// Reuse one typed array per cached mesh; reload frames never add cache entries.
// Copy the immutable base mesh, move named components, then cant the whole weapon.
export function animateWeapon(base, out, pose) {
  out.set(base);
  const [pivotY, pivotZ] = magPivot(base);
  const mc = Math.cos(pose.magPitch || 0),
    ms = Math.sin(pose.magPitch || 0);
  const mag = pose.magOffset || ZERO,
    handOffset = pose.handOffset || ZERO;
  for (const { name, start, end } of base.parts || []) {
    for (let k = start; k < end; k += 9) {
      if (name === "magazine") {
        // Rock about the top-front corner (pitch about the weapon's x axis), then move.
        const y = out[k + 1] - pivotY,
          z = out[k + 2] - pivotZ;
        out[k] += mag[0];
        out[k + 1] = pivotY + y * mc - z * ms + mag[1];
        out[k + 2] = pivotZ + y * ms + z * mc + mag[2];
        const ny = out[k + 4],
          nz = out[k + 5];
        out[k + 4] = ny * mc - nz * ms;
        out[k + 5] = ny * ms + nz * mc;
      }
      if (name === "slide") out[k + 2] += pose.slide || 0;
      if (name === "bolt") out[k + 2] += pose.bolt || 0;
      // The support hand morphs from its handguard grip to its magazine grip (same
      // topology, so positions and normals blend vertex by vertex), then follows its path.
      if (name === "support") {
        const alt = base.supportAlt,
          g = pose.hand || 0;
        if (alt && g > 0)
          for (let i = 0; i < 6; i++)
            out[k + i] = base[k + i] + (alt[k - start + i] - base[k + i]) * g;
        // Reaching for the charging handle or feed cover moves the hand fully and fades out
        // up the forearm, so the shoulder stays put instead of the whole arm sweeping.
        const reach =
          (pose.reach || 0) *
          clamp01((0.45 - (alt ? alt[k - start + 2] : out[k + 2])) / 0.45);
        out[k] += handOffset[0] + reach * 0.04;
        out[k + 1] += handOffset[1] + reach * 0.11;
        out[k + 2] += handOffset[2] + reach * 0.08;
      }
      // Rotate the LMG cover about its hinge and rotate its normals by the same angle.
      if (name === "cover") {
        // Hinged where the mesh measured its front-top edge.
        const [hy, hz] = base.coverPivot;
        const a = -(pose.cover || 0) * 1.25,
          c = Math.cos(a),
          s = Math.sin(a),
          y = out[k + 1] - hy,
          z = out[k + 2] - hz;
        out[k + 1] = hy + y * c - z * s;
        out[k + 2] = hz + y * s + z * c;
        const ny = out[k + 4],
          nz = out[k + 5];
        out[k + 4] = ny * c - nz * s;
        out[k + 5] = ny * s + nz * c;
      }
    }
  }
  // Apply the overall reload cant after local part motion so hands and magazine stay in weapon space.
  if (pose.roll) {
    const c = Math.cos(pose.roll),
      s = Math.sin(pose.roll);
    for (let k = 0; k < out.length; k += 9) {
      const x = out[k],
        y = out[k + 1],
        nx = out[k + 3],
        ny = out[k + 4];
      out[k] = x * c - y * s;
      out[k + 1] = x * s + y * c;
      out[k + 3] = nx * c - ny * s;
      out[k + 4] = nx * s + ny * c;
    }
  }
  return out;
}
