// Lightweight anime-inspired characters built from the shared instanced mesh.
import { TEAM_COLORS } from "./world.js";
import { characterStyle } from "./model-style.js";
import { legPose } from "./character-gait.js";
const SKINS = [
  [0.85, 0.64, 0.51],
  [0.57, 0.36, 0.29],
  [0.96, 0.79, 0.65],
  [0.72, 0.49, 0.37],
];
const INK = [0.075, 0.085, 0.13],
  WHITE = [0.98, 0.97, 0.94],
  GUN = [0.16, 0.19, 0.21],
  STEEL = [0.09, 0.11, 0.13];
// `blockGun` builds the carried rifle from a few boxes (in matches); without it a single
// signature box is emitted, which the lobby replaces with its detailed weapon mesh.
export function drawCharacter(add, a, time, shadows, blockGun = false) {
  const team = TEAM_COLORS[a.team],
    skin = SKINS[a.id % SKINS.length],
    style = characterStyle(a.classId, a.id);
  const c = Math.cos(a.yaw),
    s = Math.sin(a.yaw),
    height = a.crouched ? 1.15 : 1.8;
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
  const head = height - 0.27,
    torso = height - 0.83;
  if (shadows) add(a.x, 0.015, a.z, 0.74, 0.015, 0.62, [0.33, 0.38, 0.35]);
  // Taper the jaw and forehead rather than using a single square face.
  part(0, head + 0.045, 0, 0.47, 0.34, 0.4, skin);
  part(0, head - 0.14, -0.018, 0.37, 0.1, 0.35, skin);
  part(0, head - 0.205, -0.025, 0.26, 0.05, 0.29, skin);
  for (const side of [-1, 1])
    part(side * 0.25, head - 0.02, 0, 0.055, 0.11, 0.075, skin);
  // Large irises, upper lashes and tiny highlights give the face an anime expression.
  for (const side of [-1, 1]) {
    part(side * 0.115, head + 0.012, -0.207, 0.145, 0.125, 0.015, WHITE);
    part(side * 0.113, head + 0.004, -0.217, 0.077, 0.107, 0.012, style.iris);
    part(side * 0.113, head + 0.008, -0.225, 0.027, 0.084, 0.01, INK);
    part(side * 0.105 - 0.014, head + 0.04, -0.233, 0.025, 0.027, 0.008, WHITE);
    part(side * 0.118, head + 0.079, -0.219, 0.155, 0.018, 0.025, INK);
    part(side * 0.118, head + 0.113, -0.211, 0.115, 0.018, 0.019, style.hair);
  }
  part(0, head - 0.092, -0.211, 0.027, 0.026, 0.03, skin);
  part(0, head - 0.15, -0.203, 0.07, 0.014, 0.015, [0.54, 0.29, 0.31]);
  // Layered bangs and asymmetrical hair silhouettes distinguish the classes.
  part(0, head + 0.214, 0.015, 0.49, 0.095, 0.43, style.hair);
  part(0, head + 0.016, 0.19, 0.48, 0.34, 0.075, style.hair);
  for (const side of [-1, 1])
    part(
      side * 0.238,
      head + 0.043,
      0.012,
      0.065,
      style.cut === "bob" ? 0.37 : 0.23,
      0.4,
      style.hair,
    );
  for (let i = 0; i < 3; i++) {
    const x = -0.17 + i * 0.14,
      drop = [0.03, 0.065, 0.005][i];
    part(x, head + 0.145 - drop, -0.218, 0.135, 0.12 + drop, 0.049, style.hair);
    part(
      x + 0.016,
      head + 0.078 - drop,
      -0.225,
      0.072,
      0.034,
      0.046,
      style.hair,
    );
  }
  if (style.cut === "spikes")
    for (let i = 0; i < 3; i++) {
      part(-0.16 + i * 0.16, head + 0.282, 0.02, 0.11, 0.085, 0.16, style.hair);
      part(
        -0.145 + i * 0.16,
        head + 0.335,
        0.02,
        0.045,
        0.025,
        0.09,
        style.hair,
      );
    }
  if (style.cut === "tail") {
    part(0.16, head - 0.09, 0.26, 0.1, 0.33, 0.1, style.hair);
    part(0.16, head + 0.045, 0.265, 0.12, 0.045, 0.115, style.accent);
  }
  part(-0.235, head + 0.12, -0.2, 0.035, 0.045, 0.048, style.accent);
  // Short fitted jackets, bright trim and visible team-colored chest panels.
  part(0, torso, 0, 0.43, 0.53, 0.29, style.cloth);
  part(0, torso + 0.047, -0.153, 0.36, 0.29, 0.025, team);
  part(0, torso - 0.018, -0.174, 0.025, 0.39, 0.015, WHITE);
  part(0, torso + 0.258, 0, 0.27, 0.065, 0.32, style.accent);
  part(0.105, torso + 0.225, -0.21, 0.075, 0.24, 0.035, style.accent);
  part(0, torso - 0.246, 0, 0.45, 0.055, 0.31, INK);
  part(0, torso - 0.245, -0.164, 0.072, 0.045, 0.018, style.accent);
  for (const side of [-1, 1]) {
    part(side * 0.185, torso - 0.24, 0.065, 0.065, 0.18, 0.28, style.cloth);
    const { hip, knee, ankle, lift } = legPose(a, time, side);
    const segment = (top, bottom, width, depth) =>
      part(
        side * 0.125,
        (top.y + bottom.y) / 2,
        (top.z + bottom.z) / 2,
        width,
        Math.hypot(top.y - bottom.y, top.z - bottom.z),
        depth,
        style.cloth,
        0,
        Math.atan2(top.z - bottom.z, top.y - bottom.y),
      );
    segment(hip, knee, 0.19, 0.21);
    segment(knee, ankle, 0.17, 0.19);
    part(side * 0.125, knee.y, knee.z - 0.11, 0.13, 0.075, 0.026, team);
    part(side * 0.125, 0.1 + lift, ankle.z - 0.025, 0.205, 0.2, 0.28, INK);
    part(
      side * 0.125,
      0.022 + lift,
      ankle.z - 0.025,
      0.205,
      0.035,
      0.28,
      WHITE,
    );
  }
  part(-0.1, torso + 0.12, -0.177, 0.062, 0.065, 0.018, WHITE);
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
  const stock = [0.17, torso + 0.09, -0.04],
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
  // Arms: shoulder cap, upper arm to an elbow hanging below the line to the hand, forearm,
  // white cuff and glove on the grip (right) and the handguard (left).
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
    const shoulder = [side * 0.27, torso + 0.13, -0.01];
    part(shoulder[0], shoulder[1], shoulder[2], 0.16, 0.13, 0.21, team);
    const mid = mixAt(shoulder, hand, 0.5),
      elbow = [mid[0] + side * 0.07, mid[1] - 0.13, mid[2] + 0.06];
    segment(shoulder, elbow, 0.14, 0.17, team);
    segment(mixAt(shoulder, elbow, 0.78), elbow, 0.145, 0.175, style.accent);
    segment(elbow, mixAt(elbow, hand, 0.8), 0.12, 0.15, style.cloth);
    segment(
      mixAt(elbow, hand, 0.74),
      mixAt(elbow, hand, 0.86),
      0.125,
      0.155,
      WHITE,
    );
    part(hand[0], hand[1], hand[2], 0.09, 0.1, 0.11, WHITE);
  }
  if (a.shield > 0)
    part(0, height + 0.14, 0, 0.38, 0.06, 0.38, [0.85, 0.95, 0.65]);
}
