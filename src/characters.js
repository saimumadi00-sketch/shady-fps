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
  WHITE = [0.98, 0.97, 0.94];
export function drawCharacter(add, a, time, shadows) {
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
    part(side * 0.3, torso + 0.08, -0.015, 0.15, 0.3, 0.22, team);
    part(side * 0.3, torso - 0.1, -0.05, 0.15, 0.052, 0.23, style.accent);
    part(side * 0.3, torso - 0.2, -0.1, 0.13, 0.16, 0.2, style.cloth);
    part(side * 0.3, torso - 0.295, -0.12, 0.13, 0.045, 0.21, WHITE);
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
      0.215,
      0.035,
      0.29,
      WHITE,
    );
  }
  part(-0.1, torso + 0.12, -0.177, 0.062, 0.065, 0.018, WHITE);
  // Retain this signature so the lobby substitutes its detailed weapon mesh.
  part(0.22, torso - 0.06, -0.38, 0.13, 0.13, 0.65, INK);
  if (a.shield > 0)
    part(0, height + 0.14, 0, 0.38, 0.06, 0.38, [0.85, 0.95, 0.65]);
}
