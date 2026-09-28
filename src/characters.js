// Builds original voxel characters from reusable cube instances.
import { TEAM_COLORS } from "./world.js";
const SKINS = [
  [0.73, 0.48, 0.32],
  [0.48, 0.29, 0.2],
  [0.88, 0.68, 0.48],
  [0.62, 0.39, 0.26],
];
const HAIR = [
  [0.16, 0.12, 0.09],
  [0.26, 0.17, 0.1],
  [0.12, 0.14, 0.15],
];
const BOOTS = [0.13, 0.19, 0.2],
  BELT = [0.2, 0.27, 0.27],
  WHITE = [0.93, 0.92, 0.8],
  EYES = [0.1, 0.15, 0.16];

// Original voxel people: large cubic heads, square faces, broad arms and
// separate rectangular legs. All parts share the existing instanced cube mesh.
// Emit local body parts transformed by actor position/yaw; crouching changes body proportions.
export function drawCharacter(add, a, time, shadows) {
  const color = TEAM_COLORS[a.team],
    skin = SKINS[a.id % SKINS.length],
    hair = HAIR[a.id % HAIR.length];
  const c = Math.cos(a.yaw),
    s = Math.sin(a.yaw),
    height = a.crouched ? 1.15 : 1.8;
  // Convert model-local offsets into world coordinates while keeping each box oriented with the actor.
  const part = (x, y, z, w, h, d, tint) =>
    add(
      a.x + c * x - s * z,
      a.y + y,
      a.z + s * x + c * z,
      w,
      h,
      d,
      tint,
      -a.yaw,
    );
  // Offset the legs only while moving to create a lightweight walk cycle.
  const step = a.moving ? Math.sin(time * 9 + a.id) * 0.13 : 0;
  if (shadows) add(a.x, 0.015, a.z, 0.9, 0.015, 0.7, [0.33, 0.38, 0.35]);
  // Anchor upper-body parts to total stance height so crouching lowers them together.
  const head = height - 0.27,
    torso = height - 0.83;
  part(0, head, 0, 0.54, 0.54, 0.54, skin);
  part(0, head + 0.23, 0, 0.56, 0.1, 0.56, hair);
  part(0, head + 0.08, 0.235, 0.55, 0.32, 0.1, hair);
  for (const side of [-1, 1]) {
    part(side * 0.125, head + 0.025, -0.275, 0.12, 0.085, 0.018, WHITE);
    part(side * 0.12, head + 0.015, -0.288, 0.055, 0.055, 0.018, EYES);
  }
  part(0, head - 0.105, -0.283, 0.09, 0.09, 0.06, skin);
  part(0, head - 0.18, -0.28, 0.15, 0.025, 0.018, hair);
  part(0, torso, 0, 0.52, 0.58, 0.3, color);
  part(0, torso - 0.24, 0, 0.54, 0.085, 0.32, BELT);
  part(-0.13, torso + 0.12, -0.158, 0.1, 0.1, 0.02, WHITE);
  for (const side of [-1, 1]) {
    part(side * 0.36, torso + 0.01, -0.015, 0.19, 0.4, 0.23, color);
    part(side * 0.36, torso - 0.23, -0.09, 0.19, 0.15, 0.22, skin);
    const legHeight = a.crouched ? 0.22 : 0.65;
    part(
      side * 0.145,
      legHeight / 2 + 0.04,
      side * step,
      0.23,
      legHeight,
      0.25,
      BELT,
    );
    part(side * 0.145, 0.08, side * step - 0.04, 0.25, 0.16, 0.34, BOOTS);
  }
  part(0.22, torso - 0.06, -0.38, 0.13, 0.13, 0.65, BOOTS);
  // Show a simple overhead marker while spawn protection remains active.
  if (a.shield > 0)
    part(0, height + 0.14, 0, 0.38, 0.06, 0.38, [0.85, 0.95, 0.65]);
}
