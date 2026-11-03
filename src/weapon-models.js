// Weapon meshes as packed position/normal/colour vertices: the Project A2B models (see
// a2b-guns.js), the reflex dot, the muzzle flash and, in gameplay, the hands. Named part ranges
// let the reload animation move components without rebuilding topology.
import { characterStyle } from "./model-style.js";
import { buildHands, shapeHelpers } from "./viewmodel-hands.js";
import { A2B_GUNS, emitA2B, describe, a2bShapes } from "./a2b-guns.js";

const FINISH_TINT = { sand: [0.49, 0.4, 0.27], olive: [0.28, 0.33, 0.22] };

export function weaponMesh(
  index,
  finish = "graphite",
  optic = "iron",
  firing = false,
  hands = false,
  classId = ["assault", "engineer", "assault", "recon", "support"][index],
  team = 0,
  // Aimed-down-sights variant: leaves out the stock behind the sights.
  aimed = false,
) {
  const out = [],
    parts = [];
  // Record contiguous float ranges belonging to independently movable components.
  const part = (name, fn) => {
    const start = out.length;
    fn();
    parts.push({ name, start, end: out.length });
  };
  // Compute a flat-shaded face normal and emit three interleaved vertices.
  function tri(a, b, c, col) {
    const u = b.map((v, i) => v - a[i]),
      v = c.map((n, i) => n - a[i]);
    const n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const l = Math.hypot(...n) || 1;
    for (const p of [a, b, c]) out.push(...p, ...n.map((x) => x / l), ...col);
  }
  // Extrude a side silhouette (z,y) across a width.
  function profile(points, width, col, cx = 0) {
    for (const side of [-1, 1]) {
      const ps = points.map(([z, y]) => [cx + (side * width) / 2, y, z]);
      for (let i = 1; i < ps.length - 1; i++)
        side > 0
          ? tri(ps[0], ps[i], ps[i + 1], col)
          : tri(ps[0], ps[i + 1], ps[i], col);
    }
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const p = [cx - width / 2, a[1], a[0]],
        q = [cx + width / 2, a[1], a[0]],
        r = [cx + width / 2, b[1], b[0]],
        s = [cx - width / 2, b[1], b[0]];
      tri(p, q, r, col);
      tri(p, r, s, col);
    }
  }
  const gun = A2B_GUNS[index],
    tint = FINISH_TINT[finish];
  const info = emitA2B(index, optic, tint && { tint }, tri, part, aimed);
  // The reflex sight's dot, at the optic's aim point.
  if (optic === "reflex" && gun.kind !== "pistol" && !gun.optic) {
    const [, y, z] = info.aim,
      d = 0.003;
    profile(
      [
        [z - d, y - d],
        [z + d, y - d],
        [z + d, y + d],
        [z - d, y + d],
      ],
      0.006,
      [1, 0.2, 0.1],
    );
  }
  // A brief muzzle flash on the firing variant, at the barrel tip.
  if (firing) {
    const [, y, tip] = info.muzzle;
    profile(
      [
        [tip, y + 0.03],
        [tip - 0.12, y],
        [tip, y - 0.03],
      ],
      0.07,
      [1, 0.76, 0.25],
    );
  }
  // Hands appear only in gameplay meshes; armory previews show the weapon by itself.
  // The support hand's magazine grip is kept as a same-topology alternate for reloads.
  let sink = out,
    supportAlt = null;
  if (hands)
    ({ supportAlt } = buildHands(
      (a, na, b, nb, c, nc, col) =>
        sink.push(
          ...a,
          ...na,
          ...col,
          ...b,
          ...nb,
          ...col,
          ...c,
          ...nc,
          ...col,
        ),
      part,
      {
        kind: gun.kind,
        outfit: characterStyle(classId),
        team,
        shapes: a2bShapes(index, shapeHelpers),
        key: gun.model,
      },
      (fn) => {
        const kept = sink;
        sink = [];
        fn();
        const captured = sink;
        sink = kept;
        return captured;
      },
    ));
  const result = new Float32Array(out);
  result.parts = parts;
  if (info.coverPivot) result.coverPivot = info.coverPivot;
  if (supportAlt) result.supportAlt = new Float32Array(supportAlt);
  return result;
}

// Project the same mesh into a 2D canvas for a lightweight static armory preview.
export function previewWeapon(canvas, index, finish, optic) {
  const ctx = canvas.getContext("2d"),
    mesh = weaponMesh(index, finish, optic);
  const w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const faces = [];
  for (let i = 0; i < mesh.length; i += 27) {
    const points = [];
    let depth = 0;
    for (let j = 0; j < 3; j++) {
      const k = i + j * 9,
        x = mesh[k],
        y = mesh[k + 1],
        z = mesh[k + 2];
      points.push([
        w * 0.52 - z * w * 0.64 + x * w * 0.23,
        h * 0.5 - y * w * 0.64 + x * w * 0.13,
      ]);
      depth += x - z * 0.18;
    }
    const light =
      0.64 +
      0.36 *
        Math.max(0, mesh[i + 3] * 0.5 + mesh[i + 4] * 0.8 + mesh[i + 5] * 0.3);
    faces.push({
      points,
      depth,
      color: `rgb(${[6, 7, 8].map((k) => Math.round(mesh[i + k] * light * 255)).join(",")})`,
    });
  }
  // Paint back-to-front to approximate triangle visibility without creating a second WebGL context.
  faces.sort((a, b) => a.depth - b.depth);
  for (const f of faces) {
    ctx.beginPath();
    f.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.fill();
  }
}

// Height of the sight line above the viewmodel origin, for aiming down sights.
export const weaponSight = (index, optic) => describe(index, optic).sightHeight;
