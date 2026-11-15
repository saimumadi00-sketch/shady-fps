// Project A2B weapon models (see THIRD_PARTY_NOTICES.md) placed in the viewmodel frame, plus
// everything the rest of the game needs to hold and aim them: the collision shapes the hands
// are posed against, the sight line used for aiming down sights, and the muzzle position.
//
// Pack space: metres, +Y up, +Z toward the muzzle. Viewmodel space: +Y up, -Z toward the
// muzzle. Every gun is scaled by A2B_SCALE (the same "chunkier than life" factor as the hand
// rig) and moved so its firing-grip socket sits where the procedural guns' grips sat, which
// keeps the firing arm and the hip framing where they were tuned.
import { A2B_MODELS, A2B_QUANTUM } from "./a2b-models.js";

export const A2B_SCALE = 1.32;
// Per weapon index: model, hand kind, and the built-in optic (the marksman rifle's scope).
export const A2B_GUNS = Object.freeze([
  { model: "carbine_m4", kind: "rifle" },
  { model: "smg_mp5", kind: "smg" },
  { model: "demo_pistol", kind: "pistol" },
  { model: "br_scar_h", kind: "dmr", optic: "att_lpvo_scope" },
  { model: "lmg_m60", kind: "lmg" },
]);
const OPTICS = { reflex: "att_red_dot_t2", scope: "att_acog_scope" };
// Firing-grip socket targets: the palm centre on the procedural rifle and pistol grips.
const GRIP_AT = { rifle: [0, -0.105, 0.131], pistol: [0, -0.045, 0.106] };
// Pack parts that the reload animation moves, by the names it animates.
const ROLES = {
  magazine: "magazine",
  slide: "slide",
  charging_handle: "bolt",
  feed_cover: "cover",
};
// Body parts that take the cosmetic finish; metal parts keep their own colour.
const FURNITURE =
  /^(handguard|buttstock|stock|pistol_grip|upper_receiver|lower_receiver|receiver|frame|feed_cover)$/;

const decoded = new Map();
// Unpack a generated model once: positions in metres, indices, and colours per triangle.
function decode(name) {
  if (decoded.has(name)) return decoded.get(name);
  const m = A2B_MODELS[name],
    bytes = Uint8Array.from(atob(m.data), (c) => c.charCodeAt(0)),
    pos = new Int16Array(bytes.buffer, 0, m.vertices * 3),
    idx = new Uint16Array(bytes.buffer, m.vertices * 6, m.triangles * 3),
    col = bytes.subarray(m.vertices * 6 + m.triangles * 6);
  const parts = m.parts.map(([name, v0, vn, t0, tn]) => ({
    name,
    v0,
    vn,
    t0,
    tn,
  }));
  const out = { pos, idx, col, parts, sockets: m.sockets };
  decoded.set(name, out);
  return out;
}

// Pack metres to viewmodel units for one gun.
function placer(gun) {
  const { sockets } = decode(gun.model),
    g = sockets.grip_r,
    at = GRIP_AT[gun.kind === "pistol" ? "pistol" : "rifle"],
    k = A2B_SCALE;
  return ([x, y, z]) => [
    -(x - g[0]) * k + at[0],
    (y - g[1]) * k + at[1],
    -(z - g[2]) * k + at[2],
  ];
}
const vertex = (m, i) => [
  m.pos[i * 3] * A2B_QUANTUM,
  m.pos[i * 3 + 1] * A2B_QUANTUM,
  m.pos[i * 3 + 2] * A2B_QUANTUM,
];

// The optic fitted for a cosmetic choice, or null for iron sights. Pistols take none.
function opticFor(index, optic) {
  const gun = A2B_GUNS[index];
  if (gun.optic) return gun.optic;
  if (gun.kind === "pistol") return null;
  return OPTICS[optic] || null;
}

// Emit a gun's triangles through `tri(a, b, c, colour)`, with animated components wrapped in
// `part(name, fn)` so they occupy contiguous ranges. Returns metadata for posing and effects.
// `aimed` drops every triangle entirely behind the rear sight: aiming down sights puts the
// eye just above the stock of these slim guns, where it would fill the bottom of the view.
export function emitA2B(index, optic, finish, tri, part, aimed = false) {
  const gun = A2B_GUNS[index],
    place = placer(gun),
    m = decode(gun.model),
    mount = opticFor(index, optic);
  const tint = finish && finish.tint,
    cut = aimed ? describe(index, optic).aim[2] + 0.02 : Infinity;
  const emitPart = (model, p, offset = [0, 0, 0]) => {
    for (let t = p.t0; t < p.t0 + p.tn; t++) {
      const v = [0, 1, 2].map((j) =>
        place(vertex(model, model.idx[t * 3 + j]).map((n, i) => n + offset[i])),
      );
      if (v[0][2] > cut && v[1][2] > cut && v[2][2] > cut) continue;
      let c = [0, 1, 2].map((j) => model.col[t * 3 + j] / 255);
      // Dark body surfaces take the finish colour, keeping their relative shading.
      if (tint && FURNITURE.test(p.name)) {
        const lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
        if (lum < 0.32) {
          const s = Math.min(1.7, Math.max(0.55, lum / 0.12));
          c = tint.map((n) => Math.min(1, n * s));
        }
      }
      tri(v[0], v[1], v[2], c);
    }
  };
  // The optic rides the top rail; on the LMG that rail is on the feed cover, so it opens with it.
  const emitOptic = () => {
    if (!mount) return;
    const o = decode(mount);
    for (const p of o.parts) emitPart(o, p, m.sockets.rail_top);
  };
  const roles = new Map();
  for (const p of m.parts) {
    if (mount && p.name === "rear_sight") continue;
    const role = ROLES[p.name];
    if (role && !roles.has(role)) roles.set(role, p);
    else emitPart(m, p);
  }
  const cover = roles.get("cover");
  if (!cover) emitOptic();
  for (const [role, p] of roles)
    part(role, () => {
      emitPart(m, p);
      if (role === "cover") emitOptic();
    });
  return describe(index, optic);
}

// Sight line, muzzle and feed-cover hinge in viewmodel units, for one weapon and optic.
export function describe(index, optic) {
  const gun = A2B_GUNS[index],
    place = placer(gun),
    m = decode(gun.model),
    mount = opticFor(index, optic);
  const aim = mount
    ? place(decode(mount).sockets.aim.map((n, i) => n + m.sockets.rail_top[i]))
    : place(m.sockets.aim);
  const result = {
    aim,
    sightHeight: aim[1],
    muzzle: place(m.sockets.muzzle),
    coverPivot: null,
  };
  const cover = m.parts.find((p) => ROLES[p.name] === "cover");
  if (cover) {
    const b = bounds(m, [cover], place);
    // Hinged at its front edge (the more negative z), along the top.
    result.coverPivot = [b.max[1], b.min[2]];
  }
  return result;
}

function bounds(m, parts, place, keep = () => true) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let i = p.v0; i < p.v0 + p.vn; i++) {
      const raw = vertex(m, i);
      if (!keep(raw)) continue;
      const v = place(raw);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
  return { min, max };
}
const points = (m, parts, place, keep = () => true) => {
  const out = [];
  for (const p of parts)
    for (let i = p.v0; i < p.v0 + p.vn; i++) {
      const raw = vertex(m, i);
      if (keep(raw)) out.push(place(raw));
    }
  return out;
};
// Long axis of a cloud in the y-z plane (grips and magazines lean back), from its top end to
// its bottom end, with half its depth across that axis and half its width.
function column(pts) {
  const n = pts.length,
    my = pts.reduce((s, p) => s + p[1], 0) / n,
    mz = pts.reduce((s, p) => s + p[2], 0) / n;
  let yy = 0,
    zz = 0,
    yz = 0;
  for (const p of pts) {
    yy += (p[1] - my) ** 2;
    zz += (p[2] - mz) ** 2;
    yz += (p[1] - my) * (p[2] - mz);
  }
  const angle = 0.5 * Math.atan2(2 * yz, yy - zz);
  let d = [Math.cos(angle), Math.sin(angle)];
  if (d[0] > 0) d = [-d[0], -d[1]]; // point downward
  const e = [-d[1], d[0]];
  let t0 = Infinity,
    t1 = -Infinity,
    across = 0,
    hw = 0;
  for (const p of pts) {
    const y = p[1] - my,
      z = p[2] - mz,
      t = y * d[0] + z * d[1];
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
    across = Math.max(across, Math.abs(y * e[0] + z * e[1]));
    hw = Math.max(hw, Math.abs(p[0]));
  }
  const at = (t) => [0, my + d[0] * t, mz + d[1] * t];
  return { top: at(t0), bottom: at(t1), hw, hd: across, length: t1 - t0 };
}

// Boxes along a part, one per 6 cm of length, so a long receiver with a tall rear section
// does not wrap the slim handguard in empty space the fingers would have to stop on.
function slices(m, p, place) {
  const all = bounds(m, [p], place),
    n = Math.max(1, Math.round((all.max[2] - all.min[2]) / 0.06)),
    step = (all.max[2] - all.min[2]) / n,
    boxes = [];
  for (let i = 0; i < n; i++) {
    const z0 = all.min[2] + i * step,
      z1 = z0 + step;
    const b = {
      min: [Infinity, Infinity, z0],
      max: [-Infinity, -Infinity, z1],
    };
    for (let k = p.v0; k < p.v0 + p.vn; k++) {
      const v = place(vertex(m, k));
      if (v[2] < z0 - 1e-6 || v[2] > z1 + 1e-6) continue;
      for (const a of [0, 1]) {
        b.min[a] = Math.min(b.min[a], v[a]);
        b.max[a] = Math.max(b.max[a], v[a]);
      }
    }
    if (b.min[0] <= b.max[0]) boxes.push(b);
  }
  return boxes;
}

// Collision shapes for the hand solver (see shapeHelpers in viewmodel-hands.js), measured
// from the model. `helpers` supplies that module's box builders.
export function a2bShapes(index, { aabb, slab }) {
  const gun = A2B_GUNS[index],
    place = placer(gun),
    m = decode(gun.model),
    s = m.sockets,
    pistol = gun.kind === "pistol";
  const named = (re) => m.parts.filter((p) => re.test(p.name));
  const box = (b, pad = 0) =>
    aabb(
      b.min[0] - pad,
      b.max[0] + pad,
      b.min[1] - pad,
      b.max[1] + pad,
      b.min[2] - pad,
      b.max[2] + pad,
    );
  const triggerParts = named(/^trigger$/),
    tb = bounds(m, triggerParts, place),
    trigger = aabb(-0.006, 0.006, tb.min[1], tb.max[1], tb.min[2], tb.max[2]);
  // Raw-space trigger extent, to find the grip behind it and the guard beneath it.
  const rawTrigger = { min: Infinity, max: -Infinity, low: Infinity };
  for (const p of triggerParts)
    for (let i = p.v0; i < p.v0 + p.vn; i++) {
      const v = vertex(m, i);
      rawTrigger.min = Math.min(rawTrigger.min, v[2]);
      rawTrigger.max = Math.max(rawTrigger.max, v[2]);
      rawTrigger.low = Math.min(rawTrigger.low, v[1]);
    }
  // Grip: the pistol-grip part, or on a pistol the frame below the slide and behind the trigger.
  const gripPts = pistol
    ? points(
        m,
        named(/^frame$/),
        place,
        (v) => v[1] < s.grip_r[1] + 0.004 && v[2] < rawTrigger.min - 0.004,
      )
    : points(
        m,
        named(/^pistol_grip$/),
        place,
        // Only behind the trigger: the grip part can include the trigger housing.
        (v) => v[1] < rawTrigger.low + 0.03 && v[2] < rawTrigger.min + 0.002,
      );
  const g = column(gripPts),
    grip = { top: g.top, bottom: g.bottom, hw: g.hw, hd: g.hd };
  // Trigger guard: the lowest body point under the trigger.
  const guardPts = points(
    m,
    m.parts.filter((p) => !/^(trigger|magazine)$/.test(p.name)),
    place,
    (v) =>
      v[2] > rawTrigger.min &&
      v[2] < rawTrigger.max &&
      v[1] < rawTrigger.low &&
      Math.abs(v[0]) < 0.02,
  );
  const guardBottom = guardPts.length
    ? Math.min(...guardPts.map((p) => p[1]))
    : tb.min[1] - 0.02;
  const guard = [
    aabb(
      -0.012,
      0.012,
      guardBottom,
      guardBottom + 0.012,
      tb.min[2] - 0.016,
      tb.max[2] + 0.03,
    ),
    aabb(
      -0.012,
      0.012,
      guardBottom,
      tb.max[1],
      tb.min[2] - 0.016,
      tb.min[2] - 0.004,
    ),
  ];
  const receiver = bounds(m, named(/receiver|^frame$/), place),
    receiverHalf = Math.max(
      Math.abs(receiver.min[0]),
      Math.abs(receiver.max[0]),
    );
  // Magazine: a leaning slab for box magazines, a plain box for the LMG's ammo can.
  const magParts = named(/^magazine$/),
    mc = column(points(m, magParts, place)),
    mb = bounds(m, magParts, place),
    magBox =
      gun.kind === "lmg"
        ? box(mb)
        : slab(mc.top, mc.bottom, [1, 0, 0], mc.hw, mc.hd);
  const mag = { box: magBox, top: mc.top, bottom: mc.bottom, hw: mc.hw };
  const body = [
    ...m.parts
      .filter(
        (p) =>
          !/^(pistol_grip|magazine|trigger|fire_selector|front_sight|rear_sight|slide_stop|mag_release|charging_handle|barrel|stock|buttstock|buffer_tube)$/.test(
            p.name,
          ),
      )
      .flatMap((p) => slices(m, p, place).map((b) => box(b))),
    slab(grip.top, grip.bottom, [1, 0, 0], grip.hw, grip.hd),
    magBox,
    ...guard,
    trigger,
  ];
  const triggerPad = [
    0,
    tb.min[1] + (tb.max[1] - tb.min[1]) * 0.25,
    (tb.min[2] + tb.max[2]) / 2 + 0.008,
  ];
  const shapes = {
    grip,
    receiverHalf,
    trigger,
    body,
    mag,
    guardBottom,
    triggerPad,
  };
  // A pistol magazine sits flush, so the reload hand cups the base of the grip instead.
  if (pistol)
    shapes.magHold = {
      anchor: [-mc.hw, grip.bottom[1] - 0.015, grip.bottom[2] - 0.01],
      thumb: [0, grip.bottom[1] - 0.07, grip.bottom[2] + 0.02],
    };
  if (!pistol) {
    // Handguard: the handguard part, or (on the SCAR) the receiver around the support socket.
    const zl = s.grip_l[2];
    const hgBounds = named(/^handguard$/).length
      ? bounds(m, named(/^handguard$/), place)
      : bounds(
          m,
          named(/^upper_receiver$/),
          place,
          (v) => Math.abs(v[2] - zl) < 0.1 && v[1] < s.grip_l[1] + 0.05,
        );
    const hw = Math.max(Math.abs(hgBounds.min[0]), Math.abs(hgBounds.max[0]));
    shapes.handguard = {
      box: box(hgBounds),
      hw,
      top: hgBounds.max[1],
      bottom: hgBounds.min[1],
      front: hgBounds.min[2],
    };
    shapes.supportZ = place(s.grip_l)[2];
  }
  return shapes;
}
