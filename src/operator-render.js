// Draws a squad operator on a 2D canvas from the same box model the match renderer uses
// (characters.js), so the operator select shows the real in-game character without WebGL:
// boxes are projected in perspective, back faces culled, faces painted far to near and
// flat-shaded by a key light from the front left.
import { drawCharacter } from "./characters.js";

const LIGHT = norm([-0.45, 0.75, -0.5]);
function norm(v) {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
}
const CUBE_FACES = [
  [[1, 0, 0], [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]]],
  [[-1, 0, 0], [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]]],
  [[0, 1, 0], [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]]],
  [[0, -1, 0], [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]]],
  [[0, 0, 1], [[0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, 0.5]]],
  [[0, 0, -1], [[-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5]]],
];
// Same rotation as the instanced vertex shader: yaw about Y, then pitch about X.
function rotate(v, angle, pitch) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const y = cp * v[1] - sp * v[2],
    z1 = sp * v[1] + cp * v[2];
  return [c * v[0] + s * z1, y, -s * v[0] + c * z1];
}
const OPERATOR_IDS = { assault: 0, engineer: 1, recon: 2, support: 3 };

// `view`: "full" frames the whole body, "portrait" the head and shoulders.
export function drawOperator(canvas, classId, { yaw = 0, view = "full", team = 0 } = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const boxes = [];
  drawCharacter(
    (x, y, z, w, h, d, color, angle = 0, pitch = 0) =>
      boxes.push({ x, y, z, w, h, d, color, angle, pitch }),
    {
      x: 0,
      y: 0,
      z: 0,
      yaw,
      team,
      id: OPERATOR_IDS[classId] ?? 0,
      classId,
      alive: true,
      shield: 0,
    },
    0,
    true,
    true,
  );
  // Camera on the character's front (-z), looking along +z.
  const portrait = view === "portrait",
    eyeY = portrait ? 1.47 : 0.98,
    dist = portrait ? 2.2 : 5.2,
    focal = (portrait ? 3.5 : 2.35) * Math.min(W, H * 0.62);
  const faces = [];
  for (const b of boxes) {
    if (b.h < 0.02) continue; // ground shadow plate
    for (const [n, corners] of CUBE_FACES) {
      const wn = rotate(n, b.angle, b.pitch);
      const pts = corners.map((c) => {
        const r = rotate([c[0] * b.w, c[1] * b.h, c[2] * b.d], b.angle, b.pitch);
        return [r[0] + b.x, r[1] + b.y, r[2] + b.z];
      });
      const centre = pts
        .reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0])
        .map((v) => v / 4);
      const toCam = [-centre[0], eyeY - centre[1], -dist - centre[2]];
      if (wn[0] * toCam[0] + wn[1] * toCam[1] + wn[2] * toCam[2] <= 0) continue;
      const light =
        0.42 +
        0.5 * Math.max(0, wn[0] * LIGHT[0] + wn[1] * LIGHT[1] + wn[2] * LIGHT[2]) +
        0.12 * Math.max(0, wn[1]);
      faces.push({
        depth: Math.hypot(...toCam),
        pts: pts.map((p) => {
          const z = p[2] + dist;
          return [W / 2 - (focal * p[0]) / z, H * (portrait ? 0.58 : 0.47) - (focal * (p[1] - eyeY)) / z];
        }),
        fill: `rgb(${b.color.map((c) => Math.round(Math.min(1, c * light) * 255)).join(",")})`,
      });
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) {
    ctx.beginPath();
    ctx.moveTo(...f.pts[0]);
    for (let i = 1; i < 4; i++) ctx.lineTo(...f.pts[i]);
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    // A hairline in the same colour closes anti-aliasing seams between neighbouring faces.
    ctx.strokeStyle = f.fill;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}
