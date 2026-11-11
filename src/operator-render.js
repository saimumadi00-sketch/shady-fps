// Draws the operator plate on a 2D canvas from the same box model the match renderer uses
// (characters.js), with the class's real weapon (the Project A2B mesh) in the operator's hands
// and the squad standing dimmed behind. Boxes and weapon triangles are projected in
// perspective, back faces culled, painted far to near and flat-shaded by a key light from
// the front left. Returns where the kit sits on screen, so call-outs can point at it.
import { drawCharacter } from "./characters.js";
import { weaponMesh } from "./weapon-models.js";
import { describe, a2bShapes } from "./a2b-guns.js";
import { shapeHelpers } from "./viewmodel-hands.js";
import { LOADOUTS } from "./loadouts.js";

const LIGHT = norm([-0.45, 0.75, -0.5]);
function norm(v) {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
}
const CUBE_FACES = [
  [
    [1, 0, 0],
    [
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
    ],
  ],
  [
    [-1, 0, 0],
    [
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, -0.5],
    ],
  ],
  [
    [0, 1, 0],
    [
      [-0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
  ],
  [
    [0, -1, 0],
    [
      [-0.5, -0.5, 0.5],
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
    ],
  ],
  [
    [0, 0, 1],
    [
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, -0.5, 0.5],
    ],
  ],
  [
    [0, 0, -1],
    [
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5],
    ],
  ],
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
// Viewmodel units are drawn "chunkier than life"; held by a squad model they scale down.
const GUN_SCALE = 0.8;

// Weapon triangles centred on their bounding box, cached per weapon, finish and optic.
const GUNS = new Map();
function gunModel(index, finish, optic, classId) {
  const key = `${index}:${finish}:${optic}`;
  if (GUNS.has(key)) return GUNS.get(key);
  const data = weaponMesh(index, finish, optic, false, false, classId);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.length; i += 9)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], data[i + k]);
      max[k] = Math.max(max[k], data[i + k]);
    }
  const centre = min.map((v, k) => (v + max[k]) / 2);
  const local = (p) => p.map((v, k) => (v - centre[k]) * GUN_SCALE);
  const tris = [];
  for (let i = 0; i < data.length; i += 27)
    tris.push({
      pts: [0, 9, 18].map((o) =>
        local([data[i + o], data[i + o + 1], data[i + o + 2]]),
      ),
      n: [data[i + 3], data[i + 4], data[i + 5]],
      color: [data[i + 6], data[i + 7], data[i + 8]],
    });
  const d = describe(index, optic),
    shapes = a2bShapes(index, shapeHelpers),
    grip = shapes.grip.top.map((v, k) => (v + shapes.grip.bottom[k]) / 2);
  const model = {
    tris,
    // Kit points in the gun's own frame: sight, muzzle, receiver and stock.
    points: {
      sight: local(d.aim),
      muzzle: local(d.muzzle),
      weapon: [0, -0.045, 0.02],
      finish: [0.02, -0.02, (max[2] - centre[2]) * GUN_SCALE * 0.62],
    },
    // Where the hands go: the middle of the pistol grip, and just under the handguard where
    // the first-person support hand sits.
    holdPoints: {
      grip: local(grip),
      // A pistol has no handguard: the support hand cups the base of the grip instead.
      support: shapes.handguard
        ? local([0, shapes.handguard.bottom - 0.03, shapes.supportZ])
        : local([0, shapes.grip.bottom[1] - 0.02, shapes.grip.bottom[2] - 0.03]),
    },
  };
  GUNS.set(key, model);
  return model;
}

// Collect one character's boxes and its held-gun pose (the signature placeholder box).
function character(
  classId,
  { x = 0, z = 0, yaw = 0, team = 0, id, holdPoints },
) {
  const boxes = [];
  let hold = null;
  drawCharacter(
    (bx, by, bz, w, h, d, color, angle = 0, pitch = 0) => {
      if (w === 0.13 && h === 0.13 && d === 0.65) {
        hold = { c: [bx, by, bz], angle, pitch };
        return;
      }
      boxes.push({ x: bx, y: by, z: bz, w, h, d, color, angle, pitch });
    },
    {
      x,
      y: 0,
      z,
      yaw,
      team,
      id: id ?? OPERATOR_IDS[classId] ?? 0,
      classId,
      alive: true,
      shield: 0,
      lowReady: true,
      holdPoints,
    },
    0,
    false,
    false,
  );
  return { boxes, hold };
}

// `view`: "full" frames the whole body, "portrait" the head and shoulders.
// `frameX` places the operator across the canvas (0-1). `squad` lists class ids standing
// behind, drawn dimmed. Returns { anchors } in canvas pixels for sight, muzzle, weapon,
// finish and sidearm.
export function drawOperator(
  canvas,
  classId,
  {
    yaw = 0,
    view = "full",
    team = 0,
    weapon = LOADOUTS[classId]?.primary ?? 0,
    finish = "graphite",
    optic = "iron",
    frameX = 0.5,
    squad = [],
  } = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { anchors: {} };
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const portrait = view === "portrait",
    eyeY = portrait ? 1.47 : 0.98,
    dist = portrait ? 2.2 : 5.2,
    // Full view: the operator stands about 0.84 of the canvas height, feet near the bottom.
    focal = portrait ? 3.5 * Math.min(W, H * 0.62) : 2.4 * H,
    horizon = H * (portrait ? 0.58 : 0.5);
  const project = (p) => {
    const z = p[2] + dist;
    return [
      W * frameX - (focal * p[0]) / z,
      horizon - (focal * (p[1] - eyeY)) / z,
    ];
  };
  const faces = [];
  const shade = (n, color, dim) => {
    const light =
      0.42 +
      0.5 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) +
      0.12 * Math.max(0, n[1]);
    // Squadmates recede into the plate: mixed toward its olive-black ground.
    const ground = [0.043, 0.055, 0.047];
    return `rgb(${color
      .map((c, k) => {
        const lit = Math.min(1, c * light);
        return Math.round((lit * (1 - dim) + ground[k] * dim) * 255);
      })
      .join(",")})`;
  };
  const addFace = (pts, n, color, dim) => {
    const centre = pts
      .reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0])
      .map((v) => v / pts.length);
    const toCam = [-centre[0], eyeY - centre[1], -dist - centre[2]];
    if (n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] <= 0) return;
    faces.push({
      depth: Math.hypot(...toCam),
      pts: pts.map(project),
      fill: shade(n, color, dim),
    });
  };
  const addBoxes = (boxes, dim) => {
    for (const b of boxes) {
      if (b.h < 0.02) continue; // ground shadow plate
      for (const [n, corners] of CUBE_FACES)
        addFace(
          corners.map((c) => {
            const r = rotate(
              [c[0] * b.w, c[1] * b.h, c[2] * b.d],
              b.angle,
              b.pitch,
            );
            return [r[0] + b.x, r[1] + b.y, r[2] + b.z];
          }),
          rotate(n, b.angle, b.pitch),
          b.color,
          dim,
        );
    }
  };
  const place = (hold, p) => {
    const r = rotate(p, hold.angle, hold.pitch);
    return [r[0] + hold.c[0], r[1] + hold.c[1], r[2] + hold.c[2]];
  };
  const addGun = (hold, model, dim) => {
    for (const t of model.tris)
      addFace(
        t.pts.map((p) => place(hold, p)),
        rotate(t.n, hold.angle, hold.pitch),
        t.color,
        dim,
      );
  };
  // Squadmates stand back and to the sides, turned a little toward the operator.
  const SLOTS = [
    [-1.55, 3.4, 0.3],
    [-0.35, 4.6, 0.1],
    [1.25, 4.1, -0.25],
  ];
  squad.slice(0, SLOTS.length).forEach((id, i) => {
    const [x, z, turn] = SLOTS[i];
    const gun = gunModel(LOADOUTS[id]?.primary ?? 0, finish, "iron", id);
    const mate = character(id, {
      x,
      z,
      yaw: turn,
      team,
      holdPoints: gun.holdPoints,
    });
    addBoxes(mate.boxes, 0.72);
    if (mate.hold) addGun(mate.hold, gun, 0.72);
  });
  const model = gunModel(weapon, finish, optic, classId);
  const op = character(classId, { yaw, team, holdPoints: model.holdPoints });
  addBoxes(op.boxes, 0);
  const anchors = {};
  if (op.hold) {
    addGun(op.hold, model, 0);
    for (const [name, p] of Object.entries(model.points))
      anchors[name] = project(place(op.hold, p));
  }
  // The pistol rides on the right thigh.
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    hip = [0.27, 0.69, 0.02];
  anchors.sidearm = project([
    c * hip[0] - s * hip[2],
    hip[1],
    s * hip[0] + c * hip[2],
  ]);
  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) {
    ctx.beginPath();
    ctx.moveTo(...f.pts[0]);
    for (let i = 1; i < f.pts.length; i++) ctx.lineTo(...f.pts[i]);
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    // A hairline in the same colour closes anti-aliasing seams between neighbouring faces.
    ctx.strokeStyle = f.fill;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  return { anchors };
}
