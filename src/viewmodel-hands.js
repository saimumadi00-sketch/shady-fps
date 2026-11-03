// First-person hands and arms. Each hand is a jointed rig (palm, four fingers, thumb) that is
// posed against simplified collision shapes of the weapon it holds:
//  - the palm is seated until it rests on the surface,
//  - the fingers close joint by joint until each segment touches, like a real grasp,
//  - the index finger and thumb are solved to targets (trigger, receiver side) by a small
//    search that also avoids sinking into the gun.
// The same rig poses the firing hand, the support hand on the handguard and the support hand
// on the magazine (used for reloads), so every pose has identical topology.
// `emit(p1, n1, p2, n2, p3, n3, color)` writes one smooth-shaded triangle; `capture(fn)`
// returns what `fn` emits as a separate array instead of adding it to the mesh.

import { TEAM_COLORS } from "./world.js";

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const mix = (a, b, t) => add(a, mul(sub(b, a), t));
const reject = (v, axis) => sub(v, mul(axis, dot(v, axis)));
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- weapon collision shapes
// Oriented boxes: centre, three unit axes, half sizes. Signed distance is negative inside.
const obox = (c, axes, half) => ({ c, axes, half });
const aabb = (x0, x1, y0, y1, z0, z1) =>
  obox(
    [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2],
  );
// A box along the segment a-b, `side` picks its width axis.
function slab(a, b, side, halfSide, halfDepth) {
  const axis = norm(sub(b, a)),
    s = norm(reject(side, axis));
  return obox(
    mix(a, b, 0.5),
    [axis, s, cross(axis, s)],
    [Math.hypot(...sub(b, a)) / 2, halfSide, halfDepth],
  );
}
function boxDistance(b, p) {
  const d = sub(p, b.c);
  const q = b.axes.map((a, i) => Math.abs(dot(d, a)) - b.half[i]);
  return (
    Math.hypot(...q.map((v) => Math.max(v, 0))) + Math.min(Math.max(...q), 0)
  );
}
const field = (boxes) => (p) => {
  let d = Infinity;
  for (const b of boxes) d = Math.min(d, boxDistance(b, p));
  return d;
};

// Geometry that hands rest on, matching the meshes in weapon-models.js.
export function weaponShapes(kind) {
  const pistol = kind === "pistol",
    smg = kind === "smg",
    lmg = kind === "lmg";
  // Trigger guard (bottom bar, front post) and trigger, as drawn in weapon-models.js.
  const guard = pistol
    ? [
        aabb(-0.012, 0.012, -0.056, -0.044, -0.031, 0.059),
        aabb(-0.012, 0.012, -0.056, -0.014, -0.035, -0.021),
      ]
    : [
        aabb(-0.012, 0.012, -0.101, -0.089, -0.031, 0.059),
        aabb(-0.012, 0.012, -0.0985, -0.0335, -0.035, -0.021),
      ];
  const trigger = pistol
    ? aabb(-0.006, 0.006, -0.044, -0.018, 0.018, 0.03)
    : aabb(-0.006, 0.006, -0.078, -0.036, 0.018, 0.03);
  if (pistol) {
    const grip = {
      top: [0, 0.035, 0.085],
      bottom: [0, -0.195, 0.145],
      hw: 0.037,
      hd: 0.0435,
    };
    const gripBox = slab(grip.top, grip.bottom, [1, 0, 0], grip.hw, grip.hd);
    const mag = aabb(-0.0315, 0.0315, -0.295, -0.115, 0.111, 0.179);
    return {
      grip,
      receiverHalf: 0.0425,
      trigger,
      body: [
        aabb(-0.0425, 0.0425, 0.025, 0.135, -0.22, 0.17),
        aabb(-0.0375, 0.0375, -0.0145, 0.0305, -0.205, 0.025),
        gripBox,
        mag,
        ...guard,
        trigger,
      ],
      mag: { box: mag, top: [0, -0.2, 0.145], bottom: [0, -0.295, 0.145] },
    };
  }
  const half = lmg ? 0.07 : 0.0525,
    hw = smg ? 0.0425 : 0.0475;
  const front = smg ? -0.3 : kind === "dmr" ? -0.56 : lmg ? -0.49 : -0.43;
  const grip = {
    top: [0, -0.035, 0.11],
    bottom: [0, -0.235, 0.17],
    hw: 0.036,
    hd: 0.038,
  };
  const handguard = aabb(-hw, hw, -0.022, 0.085, front, -0.19);
  const mag = lmg
    ? {
        box: aabb(-0.09, 0.09, -0.24, -0.04, -0.17, -0.01),
        top: [0, -0.06, -0.09],
        bottom: [0, -0.2, -0.09],
      }
    : smg
      ? {
          box: aabb(-0.034, 0.034, -0.29, -0.03, -0.1, -0.025),
          top: [0, -0.03, -0.0625],
          bottom: [0, -0.29, -0.0625],
        }
      : {
          box: slab(
            [0, -0.03, -0.083],
            [0, -0.27, -0.145],
            [1, 0, 0],
            0.034,
            0.045,
          ),
          top: [0, -0.03, -0.083],
          bottom: [0, -0.27, -0.145],
        };
  return {
    grip,
    receiverHalf: half,
    handguard: { box: handguard, hw, top: 0.085, bottom: -0.022, front },
    trigger,
    body: [
      aabb(-half, half, -0.045, 0.105, -0.22, 0.21),
      slab(grip.top, grip.bottom, [1, 0, 0], grip.hw, grip.hd),
      handguard,
      mag.box,
      ...guard,
      trigger,
    ],
    mag,
  };
}

// ---------------------------------------------------------------------------- hand rig
// Stylised guns here are chunkier than real ones; hands are scaled up to match them.
const S = 1.32;
// Local hand space: x toward the fingers, y out of the back of the hand, z toward the thumb.
const FINGERS = [
  { z: 0.026, x: 0.086, len: [0.044, 0.026, 0.02], r: 0.0094, splay: 4 },
  { z: 0.0085, x: 0.089, len: [0.049, 0.03, 0.021], r: 0.0098, splay: 0 },
  { z: -0.0085, x: 0.085, len: [0.045, 0.028, 0.02], r: 0.0093, splay: -4 },
  { z: -0.025, x: 0.076, len: [0.035, 0.021, 0.018], r: 0.0082, splay: -9 },
].map((f) => ({
  ...f,
  z: f.z * S,
  x: f.x * S,
  len: f.len.map((l) => l * S),
  r: f.r * S,
}));
const THUMB = {
  base: [0.022 * S, -0.012 * S, 0.026 * S],
  // About 12% longer than life: the stylised grips are thicker than real ones.
  len: [0.045 * S, 0.035 * S, 0.029 * S],
  r: 0.0108 * S,
};
const PALM_HALF = 0.017 * S;

// A hand frame from its finger direction and back-of-hand direction; the thumb side follows
// from handedness (right hand: y x x, left hand: x x y).
function frame(X, Yhint, rightHand) {
  const x = norm(X),
    y = norm(reject(Yhint, x));
  return { o: [0, 0, 0], X: x, Y: y, Z: rightHand ? cross(y, x) : cross(x, y) };
}
const toWorld = (f, l) =>
  add(f.o, add(add(mul(f.X, l[0]), mul(f.Y, l[1])), mul(f.Z, l[2])));
const rotateAbout = (v, axis, a) =>
  add(
    add(mul(v, Math.cos(a)), mul(cross(axis, v), Math.sin(a))),
    mul(axis, dot(axis, v) * (1 - Math.cos(a))),
  );
// Place a frame so the middle finger's knuckle lands on `anchor`.
function anchorFrame(f, anchor) {
  return {
    ...f,
    o: sub(anchor, add(mul(f.X, FINGERS[1].x), mul(f.Z, FINGERS[1].z))),
  };
}

// Joint positions of one finger for flexion angles [mcp, pip, dip] (radians). Positive splay
// turns the finger toward the thumb side.
function fingerChain(f, finger, angles, splayExtra = 0) {
  const towardThumb = Math.sign(dot(f.Z, cross(f.Y, f.X))) || 1;
  const d0 = rotateAbout(
    f.X,
    f.Y,
    (finger.splay * DEG + splayExtra) * towardThumb,
  );
  const palmar = mul(f.Y, -1);
  const pts = [toWorld(f, [finger.x, 0, finger.z])];
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    sum += angles[i];
    const d = add(mul(d0, Math.cos(sum)), mul(palmar, Math.sin(sum)));
    pts.push(add(pts[i], mul(d, finger.len[i])));
  }
  return pts;
}
// Thumb: metacarpal direction from abduction (toward the thumb side) and opposition (toward
// the palm), then two flexing joints curling toward the palm centre. `twist` turns the
// flexion plane about the metacarpal, so a thumb that has crossed over the top of a grip can
// lie forward along its far side instead of only curling down into the palm.
function thumbChain(f, [abd, opp, f1, f2, twist = 0]) {
  const m = norm(
    add(
      add(
        mul(f.X, Math.cos(abd) * Math.cos(opp)),
        mul(f.Z, Math.sin(abd) * Math.cos(opp)),
      ),
      mul(f.Y, -Math.sin(opp)),
    ),
  );
  const curl = rotateAbout(
    norm(reject(add(mul(f.Y, -0.6), mul(f.Z, -0.8)), m)),
    m,
    twist,
  );
  const pts = [toWorld(f, THUMB.base)];
  let sum = 0;
  [0, f1, f2].forEach((a, i) => {
    sum += a;
    const d = add(mul(m, Math.cos(sum)), mul(curl, Math.sin(sum)));
    pts.push(add(pts[i], mul(d, THUMB.len[i])));
  });
  return pts;
}
// Sample points along a chain with the finger radius at each (tapering to the tip).
function samples(pts, r) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++)
    for (const t of [0.35, 0.7, 1]) {
      const taper = 1 - 0.2 * ((i + t) / (pts.length - 1));
      out.push([mix(pts[i], pts[i + 1], t), r * taper]);
    }
  return out;
}
// How far a chain sinks into the gun (0 when clear).
const penetration = (sdf, pts, r) =>
  samples(pts, r).reduce(
    (s, [p, rr]) => s + Math.max(0, rr * 0.92 - sdf(p)),
    0,
  );

// Close a finger like a grasp: all three joints curl together. When a segment makes contact,
// it and every joint behind it lock, while the joints beyond keep curling around the surface.
// A segment only counts as making contact when it moves deeper into the gun, so a fingertip
// that starts inside something (such as an ammo box in front of the grip) can curl back out.
function closeFinger(sdf, f, finger, limits = [88, 100, 72]) {
  const a = [0, 0, 0],
    rate = [1, 1.15, 0.85],
    locked = [false, false, false],
    step = 1.5 * DEG;
  const clearance = (pts) =>
    [0, 1, 2].map((k) =>
      samples(pts.slice(k, k + 2), finger.r).reduce(
        (m, [p, rr]) => Math.min(m, sdf(p) - rr * 1.02),
        Infinity,
      ),
    );
  let prev = clearance(fingerChain(f, finger, a));
  for (let n = 0; n < 200 && locked.includes(false); n++) {
    const before = a.slice();
    for (let j = 0; j < 3; j++)
      if (!locked[j]) {
        a[j] = Math.min(limits[j] * DEG, a[j] + step * rate[j]);
        if (a[j] >= limits[j] * DEG) locked[j] = true;
      }
    const now = clearance(fingerChain(f, finger, a));
    // The most proximal segment that has newly hit something decides what locks.
    const hit = [0, 1, 2].find((k) => now[k] < 0 && now[k] < prev[k] - 1e-9);
    if (hit !== undefined) {
      for (let j = 0; j <= hit; j++) {
        a[j] = before[j];
        locked[j] = true;
      }
      prev = clearance(fingerChain(f, finger, a));
    } else prev = now;
  }
  return a;
}
// Wrap a finger around what it holds: search all three joints together so the middle and
// distal segments lie on the surface without sinking in. Closing joint by joint alone stalls
// as soon as the fingertip touches, leaving a loose loop in front of a grip; this keeps the
// knuckle closing too. Falls back to the plain grasp when nothing is within reach.
function wrapFinger(sdf, f, finger) {
  const clear = (pts) =>
    [0, 1, 2].map((k) =>
      samples(pts.slice(k, k + 2), finger.r).reduce(
        (m, [p, rr]) => Math.min(m, sdf(p) - rr),
        Infinity,
      ),
    );
  const chain = (v) =>
    fingerChain(
      f,
      finger,
      v.map((a) => a * DEG),
    );
  const cost = (v) => {
    const pts = chain(v),
      c = clear(pts);
    return (
      Math.abs(c[2]) +
      // The pad itself on the surface, not just the segment grazing it near the joint.
      1.5 * Math.abs(sdf(pts[3]) - finger.r * 0.85) +
      0.4 * Math.abs(c[1]) +
      0.4 * Math.max(0, c[0]) +
      4 * penetration(sdf, pts, finger.r) +
      // Mild preference for the distal joint following the middle one, as real fingers do.
      0.00005 * Math.abs(v[2] - 0.7 * v[1])
    );
  };
  // Tight wraps (knuckle closed, finger lying along the surface) sit far from the coarse
  // grid's seeds, so offer them explicitly.
  const best = solve(
    cost,
    [
      [0, 88],
      [0, 105],
      [0, 88],
    ],
    [
      [86, 5, 15],
      [80, 20, 25],
      [70, 40, 35],
      [55, 60, 45],
      // Knuckle half closed, middle joint sharply bent: a long finger hooking a corner.
      [38, 87, 26],
      [30, 95, 40],
    ],
  );
  if (Math.abs(clear(chain(best))[2]) < 0.004) return best.map((a) => a * DEG);
  return closeFinger(sdf, f, finger);
}
// Joint search (degrees): a coarse seed grid, then a pattern search that shrinks its step.
// A few hundred evaluations per chain keeps first-time mesh builds fast.
function solve(cost, ranges, extraSeeds = []) {
  const clampTo = (v, i) => Math.max(ranges[i][0], Math.min(ranges[i][1], v));
  let best = null,
    bestCost = Infinity;
  const seeds = ranges.map(([lo, hi]) => [
    lo + (hi - lo) * 0.2,
    (lo + hi) / 2,
    lo + (hi - lo) * 0.8,
  ]);
  const cur = [];
  const walk = (i) => {
    if (i === seeds.length) {
      const c = cost(cur);
      if (c < bestCost) {
        bestCost = c;
        best = cur.slice();
      }
      return;
    }
    for (const v of seeds[i]) {
      cur[i] = v;
      walk(i + 1);
    }
  };
  walk(0);
  // Callers may know roughly where a good pose lies (such as a thumb wrapped over the top
  // of a grip), which the coarse grid can miss entirely.
  for (const seed of extraSeeds) {
    const c = cost(seed);
    if (c < bestCost) {
      bestCost = c;
      best = seed.slice();
    }
  }
  for (let step = 12; step >= 0.5; step /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < ranges.length; i++)
        for (const dir of [-1, 1]) {
          const trial = best.slice();
          trial[i] = clampTo(trial[i] + dir * step, i);
          const c = cost(trial);
          if (c < bestCost - 1e-7) {
            bestCost = c;
            best = trial;
            improved = true;
          }
        }
    }
  }
  return best;
}
// Slide the hand along the back-of-hand axis until the palm rests on the part it holds
// (`held`), with every knuckle clear of the whole gun (`sdf`).
function seat(held, sdf, f) {
  const gap = (s) => {
    const g = { ...f, o: add(f.o, mul(f.Y, s)) };
    let d = Infinity;
    for (const x of [0.02, 0.045, 0.07])
      for (const z of [-0.025, 0, 0.022])
        d = Math.min(d, held(toWorld(g, [x * S, -PALM_HALF, z * S])));
    for (const fi of FINGERS)
      d = Math.min(d, sdf(toWorld(g, [fi.x, 0, fi.z])) - fi.r * 1.02);
    return d - 0.0015;
  };
  let lo = -0.08,
    hi = 0.12;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) < 0) lo = mid;
    else hi = mid;
  }
  return { ...f, o: add(f.o, mul(f.Y, hi)) };
}
// A posed hand: seated frame, finger joint chains and the thumb chain. Searches weigh sinking
// into the gun heavily, so a target the finger cannot reach cleanly is approached, not forced.
function poseHand(sdf, f, { held, index, thumb, thumbSeeds = [] }) {
  f = seat(held || sdf, sdf, f);
  // A thumb target may depend on where the seated hand ended up.
  if (typeof thumb === "function") thumb = thumb(toWorld(f, THUMB.base));
  const fingers = FINGERS.map((finger, i) => {
    if (i === 0 && index) {
      const chain = ([s, p, q]) =>
        fingerChain(f, finger, [p * DEG, q * DEG, q * 0.65 * DEG], s * DEG);
      const best = solve(
        (v) => {
          const pts = chain(v);
          return (
            Math.hypot(...sub(pts[3], index)) +
            1.5 * Math.abs(sdf(pts[3]) - finger.r * 0.85) +
            3 * penetration(sdf, pts, finger.r)
          );
        },
        [
          [-30, 20],
          [-10, 85],
          [0, 105],
        ],
      );
      return { finger, pts: chain(best) };
    }
    return { finger, pts: fingerChain(f, finger, wrapFinger(sdf, f, finger)) };
  });
  const chain = (v) =>
    thumbChain(
      f,
      v.map((a) => a * DEG),
    );
  const best = solve(
    (v) => {
      const pts = chain(v);
      return (
        Math.hypot(...sub(pts[3], thumb)) +
        1.5 * Math.abs(sdf(pts[3]) - THUMB.r * 0.85) +
        3 * penetration(sdf, pts.slice(1), THUMB.r) +
        // Keep the knuckles near the gun too, so the thumb lies along it instead of
        // arching away in a loop on its way to the target.
        0.6 *
          (Math.max(0, sdf(pts[1]) - THUMB.r * 1.2) +
            Math.max(0, sdf(pts[2]) - THUMB.r * 1.1))
      );
    },
    [
      [-20, 115],
      [-40, 80],
      [0, 60],
      [0, 75],
      [-90, 90],
    ],
    thumbSeeds,
  );
  return { f, fingers, thumb: chain(best) };
}

// Every hand pose for one weapon: firing grip, support grip, support on the magazine.
export function solveHands(kind) {
  const shapes = weaponShapes(kind),
    pistol = kind === "pistol",
    smg = kind === "smg",
    lmg = kind === "lmg",
    dmr = kind === "dmr";
  const sdf = field(shapes.body);
  const { grip } = shapes;
  const down = norm(sub(grip.bottom, grip.top)),
    right = [1, 0, 0],
    front = norm(cross(right, down)); // perpendicular to the grip, pointing forward
  const along = (t) => mix(grip.top, grip.bottom, t);
  const gripField = field([
    slab(grip.top, grip.bottom, right, grip.hw, grip.hd),
  ]);
  const magField = field([shapes.mag.box]);
  // Middle finger sits just under the trigger guard; the index pad rests on the trigger.
  const guardBottom = pistol ? -0.056 : -0.101;
  const tMiddle =
    (guardBottom - 0.017 - grip.top[1]) / (grip.bottom[1] - grip.top[1]);
  const triggerPad = [0, pistol ? -0.036 : -0.068, 0.012];

  // Firing hand (right): back of the hand faces right, fingers point forward around the
  // front strap, index on the trigger, thumb over the backstrap onto the receiver's left.
  const firing = poseHand(
    sdf,
    anchorFrame(
      frame(front, right, true),
      // Knuckles at the front corner, so the palm covers the side of the grip rather than
      // hanging behind it and the fingers wrap the front strap instead of looping past it.
      add(add(along(tMiddle), mul(right, grip.hw)), mul(front, grip.hd * 1.15)),
    ),
    {
      held: gripField,
      index: triggerPad,
      thumb: pistol
        ? [-0.0375 - THUMB.r * 0.85, 0, 0.095]
        : [-grip.hw - THUMB.r * 0.85, -0.06, 0.12],
      // Across the top of the backstrap, then forward along the far side.
      thumbSeeds: [
        [107, 62, 17, 72, -78],
        [105, 73, 17, 72, -89],
      ],
    },
  );

  let support, magHold;
  if (pistol) {
    // Support hand wraps over the firing fingers: treat the grip as fattened by them.
    // The firing fingers wrap the front strap and end on its left, about this thick.
    const FAT = 0.03;
    // Only below the firing thumb, which lies along the frame, so the support thumb can rest
    // on the frame beneath it rather than hovering out at the fattened width.
    const fatGrip = slab(
      along((-0.045 - grip.top[1]) / (grip.bottom[1] - grip.top[1])),
      grip.bottom,
      right,
      grip.hw + FAT,
      grip.hd + FAT,
    );
    support = poseHand(
      field([fatGrip, ...shapes.body]),
      anchorFrame(
        frame(front, add(mul(right, -1), mul(front, -0.3)), false),
        add(
          add(along(tMiddle + 0.17), mul(right, -(grip.hw + FAT))),
          // Knuckles sit back from the front strap so the first segment wraps its corner.
          mul(front, grip.hd + FAT - FINGERS[1].len[0] * 0.75),
        ),
      ),
      // Thumb forward along the frame, just under the firing thumb, within its reach.
      {
        held: field([fatGrip]),
        thumb: (base) => [-0.0375 - THUMB.r * 0.85, -0.02, base[2] - 0.12],
      },
    );
    // Reload: fingers around the magazine base, thumb under the floorplate.
    magHold = poseHand(
      sdf,
      anchorFrame(
        frame([0, 0, -1], [-1, 0, 0.3], false),
        [-0.0315, -0.25, 0.12],
      ),
      { held: magField, thumb: [0, -0.31, 0.16] },
    );
  } else {
    const hg = shapes.handguard,
      z0 = smg ? -0.262 : dmr ? -0.4 : lmg ? -0.33 : -0.27;
    // Palm up under the handguard, fingers wrapping up its right side, thumb forward along
    // its left side pointing down the barrel, wrist low on the left.
    support = poseHand(
      sdf,
      anchorFrame(frame([1, 0.05, 0], [0.05, -1, 0], false), [
        hg.hw + FINGERS[1].r * 1.15 - FINGERS[1].len[0],
        hg.bottom,
        z0,
      ]),
      {
        held: field([hg.box]),
        // Straight forward from its base along the lower left side (so it does not read as
        // a raised thumb from behind), kept on the handguard even when it is short.
        // The SMG's handguard is too short for that, so its thumb goes over the top.
        thumb: (base) =>
          smg
            ? [-hg.hw * 0.4, hg.top + THUMB.r * 0.85, hg.front + 0.016]
            : [
                -hg.hw - THUMB.r * 0.85,
                hg.bottom + 0.03,
                Math.max(base[2] - 0.125, hg.front + 0.012),
              ],
      },
    );
    // Reload: palm on the left face of the magazine, fingers around its front.
    const magAxis = norm(sub(shapes.mag.bottom, shapes.mag.top)),
      magFront = norm(cross(right, magAxis)),
      magHalfW = lmg ? 0.09 : 0.034;
    magHold = poseHand(
      sdf,
      anchorFrame(
        frame(magFront, add([-1, 0, 0], mul(magFront, -0.3)), false),
        add(
          add(mix(shapes.mag.top, shapes.mag.bottom, lmg ? 0.45 : 0.42), [
            -magHalfW,
            0,
            0,
          ]),
          mul(magFront, lmg ? 0.02 : 0.025),
        ),
      ),
      {
        held: magField,
        thumb: add(
          add(mix(shapes.mag.top, shapes.mag.bottom, 0.22), [
            -magHalfW - THUMB.r,
            0,
            0,
          ]),
          mul(magFront, -0.03),
        ),
      },
    );
  }
  return { shapes, sdf, firing, support, magHold };
}

// ------------------------------------------------------------------------------ meshing
export function buildHands(emit, part, opts, capture) {
  const { kind, outfit } = opts;
  const pistol = kind === "pistol",
    smg = kind === "smg",
    dmr = kind === "dmr",
    lmg = kind === "lmg";
  // Matches the anime squad look of the third-person models (characters.js): off-white
  // gloves that read clearly against a dark rifle, ink palm pads and wrist strap, knuckle
  // plates in the class accent, and the same sleeve as the third-person jacket (white cuff,
  // class cloth, accent band, team-coloured shoulder). The trigger hand's index and thumb
  // tips are cut off, showing skin.
  const INK = [0.075, 0.085, 0.13],
    WHITE = [0.98, 0.97, 0.94],
    accent = outfit.accent,
    team = TEAM_COLORS[opts.team] || TEAM_COLORS[0],
    glove = [0.84, 0.83, 0.8],
    palmColor = [0.2, 0.21, 0.28],
    knuckle = outfit.accent.map((c) => c * 0.85),
    strap = INK,
    skin = [0.85, 0.64, 0.51],
    sleeve = outfit.cloth.map((c) => Math.min(1, c * 1.35));

  // Flat-shaded oriented box: ax/ay/az are orthogonal half-extent vectors. Every hand and
  // arm part is built from these so the viewmodel shares the squad's blocky, hard-edged look.
  function box(c, ax, ay, az, color) {
    for (const [n, u, v] of [
      [ax, ay, az],
      [ay, az, ax],
      [az, ax, ay],
    ])
      for (const s of [-1, 1]) {
        const f = add(c, mul(n, s)),
          N = mul(norm(n), s),
          p = (a, b) => add(f, add(mul(u, a), mul(v, b)));
        emit(p(-1, -1), N, p(1, -1), N, p(1, 1), N, color);
        emit(p(-1, -1), N, p(1, 1), N, p(-1, 1), N, color);
      }
  }
  // Former ellipsoid pads become boxes of about the same volume.
  const BLOB = 0.82;
  const blob = (c, ax, ay, az, color) =>
    box(c, mul(ax, BLOB), mul(ay, BLOB), mul(az, BLOB), color);

  // Square-section segments through control points, radius per point. `up` orients the flat
  // faces (the hand's back for fingers and forearms); each segment overruns its ends slightly
  // so neighbouring blocks overlap at the joints instead of leaving gaps.
  function limb(path, radii, colorAt, { up = [0, 1, 0], flat = 1, overrun = 0.6 } = {}) {
    const n = path.length;
    for (let i = 0; i < n - 1; i++) {
      const a = path[i],
        b = path[i + 1],
        len = Math.hypot(...sub(b, a)),
        t = mul(sub(b, a), 1 / (len || 1)),
        r = (radii[i] + radii[i + 1]) / 2;
      let u = reject(up, t);
      u = Math.hypot(...u) > 1e-4 ? norm(u) : basis(t)[0];
      const v = cross(t, u);
      box(
        mix(a, b, 0.5),
        mul(t, len / 2 + r * overrun),
        mul(u, r * flat),
        mul(v, r),
        colorAt((i + 0.5) / (n - 1)),
      );
    }
  }
  const basis = (n) => {
    const u = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    return [u, cross(n, u)];
  };

  // A finger through its joints: chunky tapering phalanges with an optional bare tip.
  // `bulk` scales each joint's radius (the thumb's base sits in the thick thenar pad).
  function finger(pts, r, tip, up, bulk = [1, 1, 1, 1]) {
    const radii = pts.map(
      (_, i) => 0.9 * r * bulk[i] * (1 - (0.2 * i) / (pts.length - 1)),
    );
    limb(pts, radii, (t) => (t > 0.8 ? tip : glove), { up, overrun: 0.85 });
  }

  // Palm, heel, thenar pad and knuckle armour, all in the hand's own frame so the fingers
  // grow out of the palm's front edge and the wrist out of its back.
  // `bareTips` shows skin at the index and thumb tips (the trigger hand's cut-off glove).
  function hand(pose, bareTips = false) {
    const { f } = pose;
    const L = (x, y, z) => toWorld(f, [x * S, y * S, z * S]);
    const ax = (v, s) => mul(v, s * S);
    blob(
      L(0.047, 0, 0),
      ax(f.X, 0.05),
      ax(f.Y, 0.017),
      ax(f.Z, 0.044),
      glove,
      6,
      16,
    );
    blob(
      L(0.012, -0.002, -0.002),
      ax(f.X, 0.026),
      ax(f.Y, 0.018),
      ax(f.Z, 0.035),
      glove,
      5,
      14,
    );
    blob(
      L(0.03, -0.008, 0.027),
      ax(f.X, 0.03),
      ax(f.Y, 0.014),
      ax(f.Z, 0.019),
      palmColor,
      5,
      12,
    );
    blob(
      L(0.076, 0.013, 0),
      ax(f.X, 0.014),
      ax(f.Y, 0.006),
      ax(f.Z, 0.04),
      knuckle,
      4,
      12,
    );
    pose.fingers.forEach(({ finger: fi, pts }, i) =>
      finger(pts, fi.r, bareTips && i === 0 ? skin : glove, f.Y),
    );
    // The web between thumb and palm: a pad hanging below the thumb as it crosses the
    // backstrap, filling it in like a real hand rather than leaving a loop of thumb.
    // Only the firing hand wraps a backstrap like this; the other grips leave the thumb free.
    if (bareTips) {
      const [b, , ip] = pose.thumb,
        along = sub(ip, b),
        len = Math.hypot(...along),
        a = mul(along, 1 / len),
        down = norm(reject(mul(f.Z, -1), a)),
        side = cross(a, down);
      blob(
        add(mix(b, ip, 0.45), mul(down, 0.018)),
        mul(a, len * 0.5),
        mul(down, 0.03),
        mul(side, 0.018),
        glove,
        5,
        14,
      );
    }
    // A thick base keeps the thumb reading as part of the hand where it crosses the
    // backstrap, rather than as a thin loop of tube.
    finger(pose.thumb, THUMB.r, bareTips ? skin : glove, f.Y, [1.75, 1.3, 1.05, 1]);
  }

  // Forearm + elbow + upper arm from the wrist toward the shoulder (off screen), laid out
  // like the third-person jacket sleeve: glove cuff, ink strap, white sleeve cuff, cloth
  // forearm, accent band above the elbow, team-coloured shoulder.
  function arm(wrist, mid, elbow, shoulder, up) {
    const dir = norm(sub(mid, wrist)),
      at = (d) => add(wrist, mul(dir, d)),
      seg = (pts, radii, color, overrun = 0.3) =>
        limb(pts, radii, () => color, { up, overrun });
    seg([at(-0.012), at(0.026)], [0.035, 0.036], glove);
    seg([at(0.022), at(0.04)], [0.039, 0.039], strap, 0);
    seg([at(0.04), at(0.072)], [0.047, 0.047], WHITE, 0);
    seg([at(0.072), mid, elbow], [0.046, 0.052, 0.056], sleeve);
    const band = mix(elbow, shoulder, 0.22);
    seg([elbow, band], [0.058, 0.06], accent, 0.15);
    seg([band, shoulder], [0.064, 0.068], team);
  }

  const { firing, support, magHold } = cachedPoses(kind);
  // Forearms leave each wrist opposite the fingers, dropping toward a low elbow.
  const forearm = (pose, drop, elbow, shoulder) =>
    arm(
      pose.f.o,
      add(add(pose.f.o, mul(pose.f.X, -0.12)), drop),
      elbow,
      shoulder,
      pose.f.Y,
    );
  part("grip", () => {
    hand(firing, true);
    // The firing forearm drops steeply from the wrist toward a low elbow.
    forearm(
      firing,
      [0.05, -0.17, -0.05],
      [0.25, -0.52, 0.4],
      [0.3, -0.72, 0.8],
    );
  });
  const z0 = smg ? -0.262 : dmr ? -0.4 : lmg ? -0.33 : -0.27;
  const supportArm = (pose, reload) => {
    hand(pose);
    if (pistol)
      forearm(
        pose,
        [-0.03, -0.08, 0.02],
        reload ? [-0.26, -0.56, 0.42] : [-0.26, -0.48, 0.44],
        reload ? [-0.32, -0.72, 0.8] : [-0.32, -0.68, 0.8],
      );
    else
      forearm(
        pose,
        [-0.04, -0.05, 0.06],
        reload ? [-0.34, -0.42, 0.3] : [-0.36, -0.33, z0 + 0.52],
        reload ? [-0.42, -0.58, 0.86] : [-0.42, -0.5, 0.86],
      );
  };
  part("support", () => supportArm(support, false));
  return { supportAlt: capture(() => supportArm(magHold, true)) };
}
// Poses depend only on the weapon, not on finish, optic or class: solve once per weapon.
const POSES = new Map();
function cachedPoses(kind) {
  if (!POSES.has(kind)) POSES.set(kind, solveHands(kind));
  return POSES.get(kind);
}
