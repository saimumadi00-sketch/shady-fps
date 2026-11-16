// Gun models built in code, in the same form as the imported Project A2B models (see
// a2b-models.js and decode() in a2b-guns.js): named parts, sockets in metres, positions in
// 1/20000 m, one colour per triangle. Because they share that form, the hand solver, the
// reload animation, optics and finishes treat them exactly like the imported guns.
//
// Model space: metres, +Y up, +Z toward the muzzle, -X the right-hand (ejection) side. Each
// gun is laid out around its trigger (z 0 to 0.012) with the bore near y 0.05.
//
// Part names matter: `trigger`, `pistol_grip`, a part matching /receiver/, `magazine` and
// `handguard` are measured for the hands; `magazine`, `charging_handle`, `slide` and
// `feed_cover` are moved by the reload animation; stocks, grips, receivers and handguards
// darker than mid-grey take the cosmetic finish, so wood is kept lighter than that.
import { A2B_QUANTUM } from "./a2b-models.js";

const WOOD = [0.5, 0.33, 0.19],
  WALNUT = [0.47, 0.31, 0.19],
  STEEL = [0.25, 0.26, 0.28],
  BLUED = [0.18, 0.19, 0.21],
  POLY = [0.16, 0.16, 0.17],
  POLY_LIGHT = [0.23, 0.23, 0.24],
  BAKELITE = [0.45, 0.2, 0.08],
  OLIVE = [0.25, 0.27, 0.19],
  SLOT = [0.05, 0.05, 0.06];

// Collects triangles part by part. Every face is wound so its normal points outward.
function builder() {
  const pos = [],
    idx = [],
    col = [],
    parts = [];
  let open = null;
  const close = () => {
    if (!open) return;
    parts.push({
      name: open.name,
      v0: open.v0,
      vn: pos.length / 3 - open.v0,
      t0: open.t0,
      tn: idx.length / 3 - open.t0,
    });
    open = null;
  };
  const tri = (a, b, c, color, out) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) [b, c] = [c, b];
    const first = pos.length / 3;
    for (const p of [a, b, c])
      pos.push(...p.map((n) => Math.round(n / A2B_QUANTUM)));
    idx.push(first, first + 1, first + 2);
    col.push(...color.map((n) => Math.round(Math.min(1, n) * 255)));
  };
  const quad = (a, b, c, d, color, out) => {
    tri(a, b, c, color, out);
    tri(a, c, d, color, out);
  };
  const g = {
    part(name) {
      close();
      open = { name, v0: pos.length / 3, t0: idx.length / 3 };
      return g;
    },
    box(x0, x1, y0, y1, z0, z1, color) {
      const p = (x, y, z) => [x, y, z];
      quad(
        p(x0, y0, z0),
        p(x0, y1, z0),
        p(x0, y1, z1),
        p(x0, y0, z1),
        color,
        [-1, 0, 0],
      );
      quad(
        p(x1, y0, z0),
        p(x1, y1, z0),
        p(x1, y1, z1),
        p(x1, y0, z1),
        color,
        [1, 0, 0],
      );
      quad(
        p(x0, y0, z0),
        p(x1, y0, z0),
        p(x1, y0, z1),
        p(x0, y0, z1),
        color,
        [0, -1, 0],
      );
      quad(
        p(x0, y1, z0),
        p(x1, y1, z0),
        p(x1, y1, z1),
        p(x0, y1, z1),
        color,
        [0, 1, 0],
      );
      quad(
        p(x0, y0, z0),
        p(x1, y0, z0),
        p(x1, y1, z0),
        p(x0, y1, z0),
        color,
        [0, 0, -1],
      );
      quad(
        p(x0, y0, z1),
        p(x1, y0, z1),
        p(x1, y1, z1),
        p(x0, y1, z1),
        color,
        [0, 0, 1],
      );
      return g;
    },
    // A side profile, as [z, y] points in order around the outline, extruded from x0 to x1.
    prism(profile, x0, x1, color) {
      let area = 0;
      for (let i = 0; i < profile.length; i++) {
        const [z, y] = profile[i],
          [nz, ny] = profile[(i + 1) % profile.length];
        area += z * ny - nz * y;
      }
      const sign = area > 0 ? 1 : -1;
      for (const [x, nx] of [
        [x0, -1],
        [x1, 1],
      ])
        for (const [a, b, c] of earClip(profile, sign))
          tri(
            [x, profile[a][1], profile[a][0]],
            [x, profile[b][1], profile[b][0]],
            [x, profile[c][1], profile[c][0]],
            color,
            [nx, 0, 0],
          );
      for (let i = 0; i < profile.length; i++) {
        const [z, y] = profile[i],
          [nz, ny] = profile[(i + 1) % profile.length];
        // Outward is to the right of the edge when the outline runs counter-clockwise.
        const out = [0, -(nz - z) * sign, (ny - y) * sign];
        quad([x0, y, z], [x1, y, z], [x1, ny, nz], [x0, ny, nz], color, out);
      }
      return g;
    },
    // A straight tube along the bore direction: z0 to z1, centred on (x, y).
    tube(z0, z1, y, r, color, sides = 8, x = 0) {
      const ring = Array.from({ length: sides }, (_, i) => {
        const a = ((i + 0.5) / sides) * Math.PI * 2;
        return [x + Math.cos(a) * r, y + Math.sin(a) * r];
      });
      for (let i = 0; i < sides; i++) {
        const [ax, ay] = ring[i],
          [bx, by] = ring[(i + 1) % sides];
        quad([ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1], color, [
          (ax + bx) / 2 - x,
          (ay + by) / 2 - y,
          0,
        ]);
        tri([x, y, z0], [ax, ay, z0], [bx, by, z0], color, [0, 0, -1]);
        tri([x, y, z1], [ax, ay, z1], [bx, by, z1], color, [0, 0, 1]);
      }
      return g;
    },
    // A disc with its axis across the gun: a drum magazine or a wheel.
    drum(zc, yc, r, x0, x1, color, sides = 12) {
      return g.prism(
        Array.from({ length: sides }, (_, i) => {
          const a = (i / sides) * Math.PI * 2;
          return [zc + Math.cos(a) * r, yc + Math.sin(a) * r];
        }),
        x0,
        x1,
        color,
      );
    },
    // The same shape on both sides of the gun.
    pair(fn) {
      fn(1);
      fn(-1);
      return g;
    },
    // Trigger and guard, shared by every gun.
    trigger(color, front = 0.05) {
      g.part("trigger").box(-0.003, 0.003, -0.028, 0, 0, 0.012, color);
      g.part("trigger_guard")
        .box(-0.005, 0.005, -0.041, -0.036, -0.01, front, color)
        .box(-0.005, 0.005, -0.041, 0, front - 0.005, front, color);
      return g;
    },
    finish(sockets) {
      close();
      return {
        pos: Int16Array.from(pos),
        idx: Uint16Array.from(idx),
        col: Uint8Array.from(col),
        parts,
        sockets,
      };
    },
  };
  return g;
}

// Triangulate a simple outline by cutting ears; returns index triples.
function earClip(points, sign) {
  const left = points.map((_, i) => i),
    out = [];
  const cross = (a, b, c) =>
    ((points[b][0] - points[a][0]) * (points[c][1] - points[a][1]) -
      (points[b][1] - points[a][1]) * (points[c][0] - points[a][0])) *
    sign;
  const inside = (p, a, b, c) =>
    cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (left.length > 3 && guard++ < 400) {
    let cut = false;
    for (let i = 0; i < left.length; i++) {
      const a = left[(i + left.length - 1) % left.length],
        b = left[i],
        c = left[(i + 1) % left.length];
      if (cross(a, b, c) <= 0) continue;
      if (left.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c)))
        continue;
      out.push([a, b, c]);
      left.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (left.length === 3) out.push(left);
  return out;
}

// A raked grip behind the trigger; `drop` is how far it hangs below the frame.
const grip = (g, color, top = 0, drop = 0.1, hw = 0.014) =>
  g.part("pistol_grip").prism(
    [
      [-0.05, top],
      [-0.008, top],
      [-0.03, top - drop],
      [-0.075, top - drop],
    ],
    -hw,
    hw,
    color,
  );
// The wrist of a one-piece wooden stock, held like a shallow pistol grip.
const wrist = (g, color) =>
  g.part("pistol_grip").prism(
    [
      [-0.05, 0.006],
      [-0.008, 0],
      [-0.03, -0.08],
      [-0.078, -0.078],
    ],
    -0.016,
    0.016,
    color,
  );
// Front sight: a post between two protective ears.
const frontSight = (g, z, base, top, color) =>
  g
    .part("front_sight")
    .box(-0.003, 0.003, base, top, z, z + 0.007, color)
    .box(-0.011, 0.011, base - 0.006, base + 0.004, z - 0.01, z + 0.018, color)
    .pair((s) =>
      g.box(
        s * 0.008,
        s * 0.011,
        base,
        top + 0.004,
        z - 0.006,
        z + 0.014,
        color,
      ),
    );

const GUNS = {
  // ---------------------------------------------------------------- Modern
  proc_ak74() {
    const g = builder();
    g.part("lower_receiver").box(-0.017, 0.017, 0, 0.062, -0.07, 0.19, BLUED);
    g.part("upper_receiver").prism(
      [
        [-0.065, 0.062],
        [0.13, 0.062],
        [0.13, 0.076],
        [0.11, 0.08],
        [-0.05, 0.08],
        [-0.065, 0.074],
      ],
      -0.016,
      0.016,
      BLUED,
    );
    g.part("rear_sight")
      .box(-0.009, 0.009, 0.076, 0.086, 0.135, 0.17, BLUED)
      .pair((s) =>
        g.box(s * 0.004, s * 0.009, 0.086, 0.094, 0.14, 0.15, BLUED),
      );
    g.part("gas_tube")
      .box(-0.013, 0.013, 0.064, 0.085, 0.2, 0.34, WOOD)
      .tube(0.34, 0.44, 0.073, 0.007, BLUED)
      .box(-0.01, 0.01, 0.04, 0.082, 0.43, 0.452, BLUED);
    g.part("handguard").prism(
      [
        [0.19, 0.052],
        [0.37, 0.052],
        [0.37, 0.02],
        [0.35, 0.01],
        [0.21, 0.01],
        [0.19, 0.02],
      ],
      -0.02,
      0.02,
      WOOD,
    );
    g.part("barrel")
      .tube(0.19, 0.6, 0.047, 0.0085, BLUED)
      .tube(0.6, 0.665, 0.047, 0.012, BLUED);
    frontSight(g, 0.545, 0.058, 0.094, BLUED);
    g.part("magazine").prism(
      [
        [0.05, 0.002],
        [0.112, 0.002],
        [0.13, -0.07],
        [0.165, -0.165],
        [0.105, -0.175],
        [0.075, -0.085],
      ],
      -0.013,
      0.013,
      BAKELITE,
    );
    grip(g, BAKELITE, 0, 0.097, 0.013);
    g.trigger(BLUED);
    g.part("buttstock").prism(
      [
        [-0.07, 0.06],
        [-0.07, 0.015],
        [-0.3, -0.05],
        [-0.315, -0.045],
        [-0.315, 0.045],
        [-0.3, 0.05],
      ],
      -0.014,
      0.014,
      WOOD,
    );
    g.part("charging_handle").box(
      -0.032,
      -0.017,
      0.048,
      0.058,
      0.05,
      0.07,
      STEEL,
    );
    return g.finish({
      grip_r: [0, -0.048, -0.038],
      grip_l: [0, 0.01, 0.28],
      muzzle: [0, 0.047, 0.665],
      aim: [0, 0.094, 0.145],
      rail_top: [0, 0.08, 0.03],
    });
  },
  proc_ump45() {
    const g = builder();
    g.part("upper_receiver")
      .box(-0.02, 0.02, 0.03, 0.085, -0.09, 0.26, POLY)
      .box(-0.008, 0.008, 0.085, 0.091, -0.04, 0.2, POLY_LIGHT);
    g.part("lower_receiver").box(-0.018, 0.018, 0, 0.03, -0.07, 0.13, POLY);
    g.part("handguard").prism(
      [
        [0.13, 0.03],
        [0.26, 0.03],
        [0.26, 0.016],
        [0.24, 0.006],
        [0.13, 0.006],
      ],
      -0.021,
      0.021,
      POLY,
    );
    g.part("barrel").tube(0.26, 0.33, 0.055, 0.009, BLUED);
    g.part("rear_sight")
      .box(-0.011, 0.011, 0.085, 0.092, -0.075, -0.05, POLY_LIGHT)
      .pair((s) =>
        g.box(s * 0.005, s * 0.011, 0.092, 0.104, -0.07, -0.058, POLY_LIGHT),
      );
    frontSight(g, 0.215, 0.09, 0.1, POLY_LIGHT);
    g.part("magazine").prism(
      [
        [0.05, 0.002],
        [0.1, 0.002],
        [0.1, -0.19],
        [0.05, -0.19],
      ],
      -0.012,
      0.012,
      POLY_LIGHT,
    );
    grip(g, POLY);
    g.trigger(POLY);
    // Folding skeleton stock, shown open.
    g.part("buttstock")
      .box(-0.012, 0.012, 0.052, 0.076, -0.3, -0.09, POLY)
      .box(-0.013, 0.013, -0.03, 0.078, -0.32, -0.3, POLY)
      .prism(
        [
          [-0.09, 0.03],
          [-0.09, 0.012],
          [-0.3, -0.03],
          [-0.3, -0.012],
        ],
        -0.01,
        0.01,
        POLY,
      );
    g.part("charging_handle").box(
      0.02,
      0.034,
      0.068,
      0.078,
      0.16,
      0.18,
      POLY_LIGHT,
    );
    return g.finish({
      grip_r: [0, -0.05, -0.04],
      grip_l: [0, 0, 0.2],
      muzzle: [0, 0.055, 0.33],
      aim: [0, 0.104, -0.064],
      rail_top: [0, 0.091, 0.02],
    });
  },
  proc_svd() {
    const g = builder();
    g.part("upper_receiver")
      .box(-0.016, 0.016, 0.03, 0.07, -0.07, 0.16, BLUED)
      .box(-0.014, 0.014, 0.07, 0.078, -0.06, 0.12, BLUED);
    g.part("lower_receiver").box(-0.016, 0.016, 0, 0.03, -0.06, 0.13, BLUED);
    // Skeleton stock: comb, lower rail, butt and a cheek rest.
    g.part("buttstock")
      .prism(
        [
          [-0.07, 0.07],
          [-0.07, 0.04],
          [-0.33, 0.02],
          [-0.33, 0.052],
        ],
        -0.014,
        0.014,
        WOOD,
      )
      .prism(
        [
          [-0.07, -0.07],
          [-0.07, -0.094],
          [-0.33, -0.06],
          [-0.33, -0.03],
        ],
        -0.014,
        0.014,
        WOOD,
      )
      .box(-0.015, 0.015, -0.066, 0.056, -0.352, -0.33, WOOD)
      .box(-0.016, 0.016, 0.066, 0.086, -0.26, -0.12, POLY);
    grip(g, WOOD, 0, 0.094);
    g.part("handguard").prism(
      [
        [0.16, 0.072],
        [0.38, 0.066],
        [0.38, 0.026],
        [0.16, 0.012],
      ],
      -0.019,
      0.019,
      WOOD,
    );
    g.part("barrel")
      .tube(0.16, 0.72, 0.05, 0.0075, BLUED)
      .tube(0.72, 0.79, 0.05, 0.0105, BLUED)
      .box(-0.009, 0.009, 0.045, 0.078, 0.44, 0.46, BLUED);
    frontSight(g, 0.69, 0.06, 0.09, BLUED);
    g.part("rear_sight").box(-0.008, 0.008, 0.078, 0.088, 0.16, 0.19, BLUED);
    g.part("magazine").prism(
      [
        [0.045, 0.002],
        [0.105, 0.002],
        [0.118, -0.06],
        [0.135, -0.11],
        [0.075, -0.116],
        [0.062, -0.06],
      ],
      -0.013,
      0.013,
      BLUED,
    );
    g.trigger(BLUED);
    g.part("charging_handle").box(
      -0.031,
      -0.016,
      0.046,
      0.056,
      0.04,
      0.06,
      STEEL,
    );
    return g.finish({
      grip_r: [0, -0.047, -0.046],
      grip_l: [0, 0.008, 0.27],
      muzzle: [0, 0.05, 0.79],
      aim: [0, 0.092, 0.175],
      rail_top: [0, 0.078, 0.02],
    });
  },
  proc_m249() {
    const g = builder();
    g.part("upper_receiver").box(-0.022, 0.022, 0.02, 0.08, -0.07, 0.22, BLUED);
    g.part("feed_cover").prism(
      [
        [-0.03, 0.08],
        [0.18, 0.08],
        [0.18, 0.094],
        [0.02, 0.102],
        [-0.03, 0.095],
      ],
      -0.022,
      0.022,
      BLUED,
    );
    g.part("lower_receiver").box(-0.016, 0.016, 0, 0.02, -0.07, 0.08, BLUED);
    g.part("handguard").prism(
      [
        [0.22, 0.072],
        [0.43, 0.072],
        [0.43, 0.03],
        [0.22, 0.012],
      ],
      -0.022,
      0.022,
      POLY,
    );
    g.part("barrel")
      .tube(0.22, 0.6, 0.055, 0.01, BLUED)
      .tube(0.6, 0.65, 0.055, 0.0125, BLUED)
      .tube(0.43, 0.55, 0.034, 0.007, BLUED)
      // Carrying handle over the barrel.
      .box(-0.004, 0.004, 0.066, 0.1, 0.25, 0.262, BLUED)
      .box(-0.004, 0.004, 0.066, 0.1, 0.32, 0.332, BLUED)
      .box(-0.006, 0.006, 0.096, 0.106, 0.25, 0.332, POLY);
    // Bipod folded back under the barrel.
    g.part("bipod").pair((s) =>
      g.box(s * 0.008, s * 0.014, 0.012, 0.024, 0.44, 0.6, STEEL),
    );
    g.part("buttstock").prism(
      [
        [-0.07, 0.075],
        [-0.07, 0.03],
        [-0.27, 0],
        [-0.3, -0.03],
        [-0.3, 0.075],
      ],
      -0.016,
      0.016,
      POLY,
    );
    grip(g, POLY);
    g.part("magazine").box(-0.035, 0.035, -0.12, 0, 0.07, 0.19, OLIVE);
    frontSight(g, 0.52, 0.068, 0.11, BLUED);
    g.part("rear_sight")
      .box(-0.011, 0.011, 0.095, 0.103, -0.04, -0.012, BLUED)
      .pair((s) =>
        g.box(s * 0.005, s * 0.011, 0.103, 0.115, -0.034, -0.02, BLUED),
      );
    g.trigger(BLUED);
    g.part("charging_handle").box(
      -0.036,
      -0.022,
      0.04,
      0.052,
      0.02,
      0.045,
      STEEL,
    );
    return g.finish({
      grip_r: [0, -0.05, -0.04],
      grip_l: [0, 0.008, 0.32],
      muzzle: [0, 0.055, 0.65],
      aim: [0, 0.114, -0.027],
      rail_top: [0, 0.102, 0.06],
    });
  },
  // ---------------------------------------------------------------- Second World War
  proc_stg44() {
    const g = builder();
    g.part("lower_receiver").box(
      -0.018,
      0.018,
      -0.006,
      0.05,
      -0.06,
      0.2,
      STEEL,
    );
    g.part("upper_receiver")
      .box(-0.017, 0.017, 0.05, 0.088, -0.07, 0.36, STEEL)
      .tube(0.36, 0.5, 0.078, 0.008, STEEL);
    g.part("handguard").box(-0.019, 0.019, 0.02, 0.05, 0.2, 0.33, STEEL);
    g.part("barrel")
      .tube(0.36, 0.56, 0.052, 0.008, STEEL)
      .tube(0.56, 0.585, 0.052, 0.011, STEEL);
    // Hooded front sight.
    g.part("front_sight")
      .box(-0.003, 0.003, 0.086, 0.106, 0.53, 0.537, STEEL)
      .box(-0.008, 0.008, 0.058, 0.09, 0.52, 0.548, STEEL)
      .box(-0.013, 0.013, 0.11, 0.115, 0.52, 0.548, STEEL)
      .pair((s) =>
        g.box(s * 0.011, s * 0.014, 0.088, 0.115, 0.52, 0.548, STEEL),
      );
    g.part("rear_sight")
      .box(-0.01, 0.01, 0.088, 0.096, 0.12, 0.165, STEEL)
      .pair((s) => g.box(s * 0.004, s * 0.01, 0.096, 0.104, 0.13, 0.14, STEEL));
    g.part("magazine").prism(
      [
        [0.07, -0.004],
        [0.125, -0.004],
        [0.14, -0.1],
        [0.175, -0.22],
        [0.118, -0.228],
        [0.09, -0.105],
      ],
      -0.012,
      0.012,
      STEEL,
    );
    grip(g, WOOD, -0.006, 0.096, 0.013);
    g.trigger(STEEL);
    g.part("buttstock").prism(
      [
        [-0.07, 0.086],
        [-0.07, 0.03],
        [-0.29, -0.04],
        [-0.31, -0.035],
        [-0.31, 0.07],
        [-0.29, 0.086],
      ],
      -0.016,
      0.016,
      WOOD,
    );
    g.part("charging_handle").box(
      0.017,
      0.031,
      0.068,
      0.078,
      0.13,
      0.15,
      STEEL,
    );
    return g.finish({
      grip_r: [0, -0.054, -0.036],
      grip_l: [0, 0.018, 0.265],
      muzzle: [0, 0.052, 0.585],
      aim: [0, 0.106, 0.135],
      rail_top: [0, 0.088, 0.02],
    });
  },
  proc_garand() {
    const g = builder();
    g.part("buttstock").prism(
      [
        [-0.1, 0.04],
        [-0.1, -0.025],
        [-0.34, -0.075],
        [-0.355, -0.07],
        [-0.355, 0.03],
        [-0.34, 0.04],
      ],
      -0.019,
      0.019,
      WOOD,
    );
    wrist(g, WOOD);
    // The stock runs under the action; the steel receiver sits in it.
    g.part("lower_receiver")
      .box(-0.02, 0.02, 0, 0.045, -0.06, 0.12, WOOD)
      .prism(
        [
          [-0.1, 0.04],
          [-0.06, 0.045],
          [-0.06, 0.006],
          [-0.1, -0.025],
        ],
        -0.019,
        0.019,
        WOOD,
      );
    g.part("upper_receiver").box(
      -0.016,
      0.016,
      0.045,
      0.076,
      -0.05,
      0.13,
      STEEL,
    );
    g.part("rear_sight")
      .box(-0.013, 0.013, 0.076, 0.084, -0.04, -0.008, STEEL)
      .pair((s) =>
        g.box(s * 0.005, s * 0.013, 0.084, 0.096, -0.034, -0.02, STEEL),
      );
    g.part("handguard").prism(
      [
        [0.12, 0.046],
        [0.47, 0.046],
        [0.47, 0.022],
        [0.12, 0],
      ],
      -0.02,
      0.02,
      WOOD,
    );
    g.part("gas_tube")
      .box(-0.015, 0.015, 0.052, 0.074, 0.15, 0.36, WOOD)
      .tube(0.47, 0.6, 0.04, 0.008, STEEL);
    g.part("barrel").tube(0.13, 0.61, 0.058, 0.008, STEEL);
    frontSight(g, 0.585, 0.066, 0.094, STEEL);
    // The fixed magazine shows only as the belly ahead of the trigger guard.
    g.part("magazine").box(-0.014, 0.014, -0.016, 0.002, 0.035, 0.1, STEEL);
    g.trigger(STEEL, 0.04);
    g.part("charging_handle").box(
      -0.031,
      -0.016,
      0.05,
      0.06,
      0.07,
      0.09,
      STEEL,
    );
    return g.finish({
      grip_r: [0, -0.034, -0.058],
      grip_l: [0, 0.006, 0.3],
      muzzle: [0, 0.058, 0.61],
      aim: [0, 0.094, -0.027],
      rail_top: [0, 0.076, 0.02],
    });
  },
  proc_kar98k() {
    const g = builder();
    g.part("buttstock").prism(
      [
        [-0.1, 0.035],
        [-0.1, -0.03],
        [-0.36, -0.08],
        [-0.375, -0.075],
        [-0.375, 0.02],
        [-0.36, 0.035],
      ],
      -0.019,
      0.019,
      WALNUT,
    );
    wrist(g, WALNUT);
    g.part("lower_receiver")
      .box(-0.02, 0.02, 0, 0.04, -0.06, 0.14, WALNUT)
      .prism(
        [
          [-0.1, 0.035],
          [-0.06, 0.04],
          [-0.06, 0.006],
          [-0.1, -0.03],
        ],
        -0.019,
        0.019,
        WALNUT,
      );
    g.part("upper_receiver").tube(-0.07, 0.14, 0.054, 0.015, STEEL);
    // Bolt handle: turned down on the right, with a round knob.
    g.part("charging_handle")
      .box(-0.04, -0.012, 0.046, 0.056, -0.05, -0.036, STEEL)
      .box(-0.052, -0.036, 0.022, 0.05, -0.052, -0.034, STEEL);
    g.part("handguard").prism(
      [
        [0.14, 0.042],
        [0.56, 0.042],
        [0.56, 0.024],
        [0.14, 0],
      ],
      -0.019,
      0.019,
      WALNUT,
    );
    g.part("gas_tube").box(-0.014, 0.014, 0.048, 0.067, 0.2, 0.42, WALNUT);
    g.part("barrel")
      .tube(0.14, 0.7, 0.054, 0.0075, STEEL)
      .box(-0.021, 0.021, 0.02, 0.07, 0.42, 0.44, STEEL)
      .box(-0.021, 0.021, 0.022, 0.066, 0.545, 0.562, STEEL);
    g.part("front_sight")
      .box(-0.003, 0.003, 0.062, 0.084, 0.68, 0.686, STEEL)
      .box(-0.01, 0.01, 0.086, 0.09, 0.67, 0.695, STEEL)
      .pair((s) => g.box(s * 0.008, s * 0.011, 0.06, 0.09, 0.67, 0.695, STEEL));
    g.part("rear_sight").box(-0.008, 0.008, 0.066, 0.076, 0.18, 0.225, STEEL);
    g.part("magazine").box(-0.013, 0.013, -0.014, 0.002, 0.04, 0.1, STEEL);
    g.trigger(STEEL, 0.04);
    return g.finish({
      grip_r: [0, -0.034, -0.058],
      grip_l: [0, 0.005, 0.33],
      muzzle: [0, 0.054, 0.7],
      aim: [0, 0.084, 0.2],
      rail_top: [0, 0.069, 0.04],
    });
  },
  proc_thompson() {
    const g = builder();
    g.part("upper_receiver").box(-0.02, 0.02, 0.03, 0.08, -0.08, 0.2, BLUED);
    g.part("lower_receiver").box(-0.016, 0.016, 0, 0.03, -0.07, 0.12, BLUED);
    g.part("buttstock").prism(
      [
        [-0.08, 0.06],
        [-0.08, 0.01],
        [-0.3, -0.06],
        [-0.32, -0.055],
        [-0.32, 0.035],
        [-0.3, 0.045],
      ],
      -0.016,
      0.016,
      WOOD,
    );
    grip(g, WOOD);
    g.part("handguard").prism(
      [
        [0.2, 0.032],
        [0.36, 0.032],
        [0.36, 0],
        [0.34, -0.008],
        [0.22, -0.008],
        [0.2, 0],
      ],
      -0.021,
      0.021,
      WOOD,
    );
    g.part("barrel").tube(0.2, 0.46, 0.055, 0.01, BLUED);
    g.part("front_sight")
      .box(-0.003, 0.003, 0.065, 0.092, 0.445, 0.452, BLUED)
      .box(-0.012, 0.012, 0.042, 0.068, 0.44, 0.458, BLUED);
    g.part("rear_sight")
      .box(-0.013, 0.013, 0.08, 0.086, -0.065, -0.04, BLUED)
      .pair((s) =>
        g.box(s * 0.006, s * 0.013, 0.086, 0.096, -0.06, -0.048, BLUED),
      );
    g.part("magazine").prism(
      [
        [0.13, 0.002],
        [0.165, 0.002],
        [0.165, -0.19],
        [0.13, -0.19],
      ],
      -0.011,
      0.011,
      BLUED,
    );
    g.trigger(BLUED);
    g.part("charging_handle").box(
      -0.032,
      -0.02,
      0.056,
      0.07,
      0.06,
      0.08,
      STEEL,
    );
    return g.finish({
      grip_r: [0, -0.05, -0.04],
      grip_l: [0, -0.01, 0.28],
      muzzle: [0, 0.055, 0.46],
      aim: [0, 0.095, -0.054],
      rail_top: [0, 0.08, 0],
    });
  },
  proc_mp40() {
    const g = builder();
    g.part("upper_receiver").tube(-0.1, 0.22, 0.055, 0.018, BLUED);
    g.part("lower_receiver").prism(
      [
        [-0.09, 0.042],
        [0.19, 0.042],
        [0.19, 0.012],
        [0.06, 0],
        [-0.09, 0],
      ],
      -0.016,
      0.016,
      BAKELITE.map((n) => n * 0.62),
    );
    g.part("mag_housing").box(-0.014, 0.014, -0.04, 0.042, 0.19, 0.236, BLUED);
    // The fore-end the support hand holds, and the resting bar under the barrel.
    g.part("handguard").box(-0.016, 0.016, 0.012, 0.04, 0.236, 0.33, BAKELITE);
    g.part("barrel")
      .tube(0.22, 0.47, 0.055, 0.008, BLUED)
      .tube(0.47, 0.49, 0.055, 0.011, BLUED)
      .box(-0.004, 0.004, 0.022, 0.048, 0.33, 0.43, BLUED);
    g.part("front_sight")
      .box(-0.003, 0.003, 0.063, 0.088, 0.45, 0.456, BLUED)
      .box(-0.01, 0.01, 0.09, 0.094, 0.44, 0.466, BLUED)
      .pair((s) =>
        g.box(s * 0.008, s * 0.011, 0.062, 0.094, 0.44, 0.466, BLUED),
      );
    g.part("rear_sight").box(-0.008, 0.008, 0.072, 0.086, 0.02, 0.042, BLUED);
    g.part("magazine").prism(
      [
        [0.197, -0.04],
        [0.229, -0.04],
        [0.229, -0.22],
        [0.197, -0.22],
      ],
      -0.01,
      0.01,
      BLUED,
    );
    grip(g, BAKELITE, 0, 0.095);
    g.trigger(BLUED);
    // Folding stock, shown open: two struts and the butt plate.
    g.part("buttstock")
      .pair((s) => g.box(s * 0.009, s * 0.014, 0.02, 0.03, -0.33, -0.09, BLUED))
      .box(-0.016, 0.016, -0.05, 0.05, -0.342, -0.33, BLUED);
    g.part("charging_handle").box(0.018, 0.032, 0.05, 0.06, 0.1, 0.116, STEEL);
    return g.finish({
      grip_r: [0, -0.048, -0.04],
      grip_l: [0, 0, 0.28],
      muzzle: [0, 0.055, 0.49],
      aim: [0, 0.09, 0.03],
      rail_top: [0, 0.073, 0],
    });
  },
  proc_mg42() {
    const g = builder();
    g.part("upper_receiver").box(-0.022, 0.022, 0.02, 0.085, -0.08, 0.2, STEEL);
    g.part("feed_cover").box(-0.022, 0.022, 0.085, 0.1, -0.02, 0.16, STEEL);
    g.part("lower_receiver").box(-0.016, 0.016, 0, 0.02, -0.07, 0.06, STEEL);
    // Barrel shroud with its cooling slots.
    g.part("handguard").box(-0.02, 0.02, 0.03, 0.08, 0.2, 0.62, STEEL);
    g.part("shroud_slots");
    for (let i = 0; i < 5; i++)
      g.box(
        -0.0206,
        0.0206,
        0.045,
        0.066,
        0.24 + i * 0.072,
        0.285 + i * 0.072,
        SLOT,
      );
    g.part("barrel")
      .tube(0.62, 0.66, 0.055, 0.011, STEEL)
      .tube(0.66, 0.7, 0.055, 0.016, STEEL);
    g.part("bipod").pair((s) =>
      g.box(s * 0.008, s * 0.014, 0.008, 0.022, 0.36, 0.6, STEEL),
    );
    g.part("buttstock").prism(
      [
        [-0.08, 0.076],
        [-0.08, 0.03],
        [-0.3, -0.02],
        [-0.33, -0.032],
        [-0.33, 0.07],
        [-0.3, 0.076],
      ],
      -0.016,
      0.016,
      WOOD,
    );
    grip(g, WOOD, 0, 0.09);
    // Fifty-round belt drum on the left of the feed.
    g.part("magazine").drum(0.09, 0.012, 0.062, 0.022, 0.092, STEEL);
    g.part("front_sight").box(-0.003, 0.003, 0.08, 0.112, 0.6, 0.607, STEEL);
    g.part("rear_sight")
      .box(-0.009, 0.009, 0.1, 0.106, 0.14, 0.172, STEEL)
      .pair((s) =>
        g.box(s * 0.004, s * 0.009, 0.106, 0.116, 0.15, 0.16, STEEL),
      );
    g.trigger(STEEL);
    g.part("charging_handle").box(-0.04, -0.022, 0.04, 0.054, 0, 0.03, STEEL);
    return g.finish({
      grip_r: [0, -0.045, -0.04],
      grip_l: [0, 0.022, 0.33],
      muzzle: [0, 0.055, 0.7],
      aim: [0, 0.116, 0.155],
      rail_top: [0, 0.1, 0.03],
    });
  },
  // A plain tube scope on two rings, for the Kar98k and the SVD.
  proc_scope() {
    const g = builder();
    g.part("scope_body")
      .tube(-0.11, 0.11, 0.034, 0.0125, BLUED)
      .tube(-0.145, -0.11, 0.034, 0.017, BLUED)
      .tube(0.11, 0.165, 0.034, 0.019, BLUED)
      .box(-0.008, 0.008, 0.044, 0.06, -0.01, 0.012, BLUED)
      .box(-0.03, -0.012, 0.028, 0.04, -0.01, 0.012, BLUED);
    g.part("scope_mount")
      .box(-0.01, 0.01, 0, 0.024, -0.075, -0.055, STEEL)
      .box(-0.01, 0.01, 0, 0.024, 0.055, 0.075, STEEL);
    return g.finish({ aim: [0, 0.034, -0.15] });
  },
};

const built = new Map();
// The built model for a name, or null when it is not one of the code-built guns.
export function procModel(name) {
  if (!GUNS[name]) return null;
  if (!built.has(name)) built.set(name, GUNS[name]());
  return built.get(name);
}
export const PROC_NAMES = Object.freeze(Object.keys(GUNS));
