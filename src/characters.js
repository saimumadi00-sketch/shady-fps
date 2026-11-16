// Soldiers at human proportions (1.8 m, hips at half height, a head about one seventh of the
// figure), built from the shared instanced box mesh. Kit differs by class; the team is shown
// by coloured tape on both arms and around the headgear, and a strip on the chest and back.
import { TEAM_COLORS } from "./world.js";
import { characterStyle } from "./model-style.js";
import { legPose } from "./character-gait.js";
const SKINS = [
  [0.8, 0.6, 0.47],
  [0.5, 0.33, 0.25],
  [0.88, 0.71, 0.58],
  [0.66, 0.46, 0.34],
];
const INK = [0.07, 0.075, 0.08],
  GUN = [0.16, 0.17, 0.18],
  STEEL = [0.09, 0.1, 0.11],
  LENS = [0.09, 0.1, 0.11];
// Height of the upper body from the hips to the top of the headgear.
const UPPER = 0.9;
// `blockGun` builds the carried rifle from a few boxes (in matches); without it a single
// signature box is emitted, which the lobby replaces with its detailed weapon mesh.
export function drawCharacter(add, a, time, shadows, blockGun = false) {
  const team = TEAM_COLORS[a.team],
    skin = SKINS[a.id % SKINS.length],
    style = characterStyle(a.classId, a.id),
    dark = (c, k = 0.72) => c.map((v) => v * k);
  const c = Math.cos(a.yaw),
    s = Math.sin(a.yaw);
  const part = (x, y, z, w, h, d, tint, twist = 0, pitch = 0) =>
    add(
      a.x + c * x - s * z,
      a.y + y,
      a.z + s * x + c * z,
      w,
      h,
      d,
      tint,
      -a.yaw + twist,
      pitch,
    );
  // The upper body hinges at the hips: upright when standing, a little forward on the move,
  // well forward in a crouch, which is what brings the head down to crouch height.
  const { y: hipY, z: hipZ } = legPose(a, time, 1).hip,
    lean = a.crouched ? 0.4 : a.sprinting ? 0.14 : a.moving ? 0.05 : 0,
    cl = Math.cos(lean),
    sl = Math.sin(lean);
  // A point in upper-body space (x right, u up from the hips, z back) placed in the body.
  const at = (x, u, z) => [x, hipY + u * cl + z * sl, hipZ + z * cl - u * sl];
  const up = (x, u, z, w, h, d, tint, pitch = -lean) => {
    const q = at(x, u, z);
    part(q[0], q[1], q[2], w, h, d, tint, 0, pitch);
  };
  // The head stays nearly level while the body leans, so the soldier keeps looking ahead.
  const hd = (x, u, z, w, h, d, tint) =>
    up(x, u, z, w, h, d, tint, -lean * 0.35);
  const pants = dark(style.uniform, 0.9),
    trim = dark(style.carrier, 0.7);
  if (shadows) add(a.x, 0.015, a.z, 0.58, 0.015, 0.46, [0.33, 0.38, 0.35]);

  // ---- Head and headgear
  hd(0, 0.59, 0.005, 0.105, 0.09, 0.11, style.scarf || skin);
  hd(0, 0.745, 0, 0.165, 0.2, 0.195, skin);
  hd(0, 0.655, -0.012, 0.135, 0.05, 0.16, style.scarf || skin);
  if (style.eyewear) hd(0, 0.765, -0.094, 0.17, 0.05, 0.03, LENS);
  else
    for (const side of [-1, 1]) {
      hd(side * 0.042, 0.768, -0.099, 0.036, 0.018, 0.008, INK);
      hd(side * 0.042, 0.792, -0.097, 0.05, 0.012, 0.012, style.hair);
    }
  if (style.scarf) hd(0, 0.69, -0.008, 0.175, 0.085, 0.2, style.scarf);
  if (style.head === "helmet") {
    hd(0, 0.845, 0.006, 0.205, 0.105, 0.24, style.headgear);
    hd(0, 0.89, 0.006, 0.165, 0.02, 0.2, style.headgear);
    // The shell drops lower at the back of the skull.
    hd(0, 0.775, 0.092, 0.2, 0.09, 0.062, style.headgear);
    // Night-vision mount, side rails and headset cups.
    hd(0, 0.85, -0.122, 0.05, 0.045, 0.02, INK);
    for (const side of [-1, 1]) {
      hd(side * 0.106, 0.8, 0.0, 0.016, 0.026, 0.13, INK);
      hd(side * 0.098, 0.742, 0.012, 0.03, 0.085, 0.07, dark(style.headgear));
    }
    // Team tape around the helmet.
    hd(0, 0.812, 0.006, 0.211, 0.022, 0.246, team);
  } else if (style.head === "cap") {
    hd(0, 0.86, 0.008, 0.18, 0.062, 0.205, style.headgear);
    hd(0, 0.838, -0.135, 0.15, 0.014, 0.085, style.headgear);
    hd(0, 0.775, 0.092, 0.168, 0.11, 0.022, style.hair);
    // Ear protection on a band over the cap.
    hd(0, 0.896, 0.012, 0.2, 0.014, 0.03, INK);
    for (const side of [-1, 1])
      hd(side * 0.098, 0.75, 0.012, 0.034, 0.09, 0.075, INK);
    hd(0, 0.834, 0.01, 0.186, 0.02, 0.211, team);
  } else {
    // Boonie hat: a soft crown over a wide brim.
    hd(0, 0.848, 0.006, 0.3, 0.014, 0.32, style.headgear);
    hd(0, 0.885, 0.006, 0.185, 0.062, 0.205, style.headgear);
    hd(0, 0.862, 0.006, 0.191, 0.02, 0.211, team);
  }

  // ---- Torso: combat shirt under a plate carrier or chest rig
  up(0, 0.33, 0, 0.35, 0.46, 0.2, style.uniform);
  up(0, 0.05, 0, 0.33, 0.14, 0.21, pants);
  up(0, 0.115, 0, 0.36, 0.05, 0.235, INK);
  const heavy = style.pack === "heavy",
    rig = style.head === "boonie";
  // Front and back plates (a chest rig sits lower and thinner), joined by the cummerbund.
  up(0, rig ? 0.3 : 0.36, -0.112, 0.3, rig ? 0.2 : 0.32, 0.05, style.carrier);
  up(0, 0.36, 0.11, 0.3, rig ? 0.24 : 0.32, 0.045, style.carrier);
  up(0, 0.27, 0, 0.375, heavy ? 0.2 : 0.14, 0.21, style.carrier);
  for (const side of [-1, 1])
    up(side * 0.105, 0.555, 0, 0.07, 0.03, 0.2, style.carrier);
  // Pouches: rifle magazines, or two large boxes for belt-fed ammunition.
  if (heavy)
    for (const side of [-1, 1])
      up(side * 0.085, 0.235, -0.16, 0.135, 0.15, 0.065, trim);
  else
    for (const x of [-0.095, 0, 0.095])
      up(x, 0.235, -0.155, 0.078, 0.125, 0.05, trim);
  if (style.pack === "radio") up(-0.09, 0.42, -0.145, 0.09, 0.11, 0.035, INK);
  // Team strip on the chest and across the back.
  up(0.07, 0.475, -0.14, 0.13, 0.04, 0.012, team);
  // Packs; the team panel rides on whatever is outermost on the back.
  let rear = 0.135;
  if (style.pack === "heavy") {
    up(0, 0.33, 0.2, 0.3, 0.38, 0.14, trim);
    up(0, 0.545, 0.2, 0.26, 0.06, 0.12, style.carrier);
    rear = 0.273;
  } else if (style.pack === "radio") {
    up(0, 0.37, 0.175, 0.24, 0.27, 0.1, trim);
    up(0.09, 0.72, 0.2, 0.012, 0.44, 0.012, INK);
    rear = 0.228;
  } else if (style.pack === "slim") {
    up(0, 0.37, 0.15, 0.17, 0.27, 0.045, trim);
    rear = 0.176;
  }
  up(0, 0.44, rear, 0.17, 0.09, 0.012, team);

  // ---- Legs: trousers with cargo pockets, knee pads, boots; a holster on the right thigh
  for (const side of [-1, 1]) {
    const { hip, knee, ankle, lift } = legPose(a, time, side);
    const x = side * 0.095;
    const bone = (top, bottom, width, depth, tint) =>
      part(
        x,
        (top.y + bottom.y) / 2,
        (top.z + bottom.z) / 2,
        width,
        Math.hypot(top.y - bottom.y, top.z - bottom.z) + 0.03,
        depth,
        tint,
        0,
        Math.atan2(top.z - bottom.z, top.y - bottom.y),
      );
    bone(hip, knee, 0.155, 0.175, pants);
    bone(knee, ankle, 0.12, 0.14, pants);
    const thigh = { y: (hip.y + knee.y) / 2, z: (hip.z + knee.z) / 2 };
    part(
      side * 0.185,
      thigh.y,
      thigh.z,
      0.035,
      0.15,
      0.11,
      side > 0 ? INK : dark(style.uniform, 0.8),
    );
    part(x, knee.y, knee.z - 0.075, 0.125, 0.11, 0.04, trim);
    part(x, 0.085 + lift, ankle.z - 0.04, 0.125, 0.15, 0.27, style.boots);
    part(x, 0.012 + lift, ankle.z - 0.04, 0.13, 0.024, 0.28, INK);
  }
  // ---- Weapon hold: the stock in the right shoulder pocket, both hands on the gun. Matches
  // carry it shouldered along the aim; the lobby squad (`a.lowReady`) holds it at low ready,
  // muzzle angled down and slightly inward, the way a squad stands between rounds.
  const gunPitch = a.lowReady
      ? -0.5
      : Math.max(-0.6, Math.min(0.6, (a.pitch || 0) * 0.85)),
    gunTwist = a.lowReady ? 0.72 : 0.04;
  const cp = Math.cos(gunPitch),
    sp = Math.sin(gunPitch),
    ct = Math.cos(gunTwist),
    st = Math.sin(gunTwist);
  // Gun-frame vector (x right, y up, z toward the stock) into body space: pitch, then twist.
  const rot = ([x, y, z]) => {
    const y1 = y * cp - z * sp,
      z1 = y * sp + z * cp;
    return [x * ct + z1 * st, y1, -x * st + z1 * ct];
  };
  // The stock sits in the pocket of the right shoulder.
  const stock = at(0.135, 0.44, -0.095),
    back = rot([0, 0, 0.325]),
    center = [stock[0] - back[0], stock[1] - back[1], stock[2] - back[2]];
  const onGun = ([x, y, z]) => {
    const r = rot([x, y, z]);
    return [center[0] + r[0], center[1] + r[1], center[2] + r[2]];
  };
  const gunPart = (x, y, z, w, h, d, tint, pitch = 0) => {
    const [px, py, pz] = onGun([x, y, z]);
    part(px, py, pz, w, h, d, tint, gunTwist, gunPitch + pitch);
  };
  if (blockGun) {
    // The same silhouette as the lobby and first-person rifles: stock, receiver with an
    // optic, magazine and grip, handguard and barrel, in the weapon finishes.
    gunPart(0, -0.02, 0.24, 0.07, 0.1, 0.2, GUN);
    gunPart(0, 0, 0.0, 0.08, 0.11, 0.34, GUN);
    gunPart(0, 0.08, -0.02, 0.05, 0.05, 0.12, INK);
    gunPart(0, -0.12, -0.06, 0.06, 0.14, 0.07, STEEL, -0.25);
    gunPart(0, -0.1, 0.09, 0.05, 0.11, 0.05, STEEL, 0.3);
    gunPart(0, 0.005, -0.24, 0.075, 0.085, 0.16, INK);
    gunPart(0, 0.02, -0.4, 0.035, 0.035, 0.18, STEEL);
  } else
    // Retain this signature (size and pose) so the lobby substitutes its detailed weapon mesh.
    gunPart(0, 0, 0, 0.13, 0.13, 0.65, INK);
  // Arms: upper arm to an elbow that hangs below the line to the hand, forearm, glove on the
  // grip (right) and the handguard (left). Team tape wraps each upper arm.
  const segment = (from, to, width, depth, tint) => {
    const vx = from[0] - to[0],
      vy = from[1] - to[1],
      vz = from[2] - to[2];
    part(
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
      (from[2] + to[2]) / 2,
      width,
      Math.hypot(vx, vy, vz),
      depth,
      tint,
      Math.atan2(vx, vz),
      Math.atan2(Math.hypot(vx, vz), vy),
    );
  };
  const mixAt = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
  // Hands on the pistol grip and under the handguard. A detailed weapon (operator plate)
  // passes its own grip and handguard points in this gun frame via `a.holdPoints`.
  const holds = a.holdPoints || {
    grip: [0, -0.1, 0.15],
    support: [0, -0.05, -0.17],
  };
  for (const [side, hand] of [
    [1, onGun(holds.grip)],
    [-1, onGun(holds.support)],
  ]) {
    const shoulder = at(side * 0.215, 0.5, 0);
    part(
      shoulder[0],
      shoulder[1],
      shoulder[2],
      0.115,
      0.1,
      0.14,
      // Shoulder and upper-arm tape in the team colour: the quickest read of friend or foe.
      team,
    );
    const mid = mixAt(shoulder, hand, 0.5),
      elbow = [mid[0] + side * 0.06, mid[1] - 0.11, mid[2] + 0.05];
    segment(shoulder, elbow, 0.1, 0.11, style.uniform);
    segment(
      mixAt(shoulder, elbow, 0.2),
      mixAt(shoulder, elbow, 0.7),
      0.108,
      0.118,
      team,
    );
    segment(elbow, mixAt(elbow, hand, 0.82), 0.085, 0.095, style.uniform);
    segment(
      mixAt(elbow, hand, 0.74),
      mixAt(elbow, hand, 0.9),
      0.09,
      0.1,
      style.gloves,
    );
    part(hand[0], hand[1], hand[2], 0.075, 0.085, 0.095, style.gloves);
  }
  if (a.shield > 0) {
    const top = at(0, UPPER + 0.14, 0);
    part(top[0], top[1], top[2], 0.3, 0.05, 0.3, [0.85, 0.95, 0.65]);
  }
}
