// Procedural firearm-inspired triangle meshes; named part ranges allow animation without rebuilding topology.
// Original low-poly firearm meshes. Dimensions are visual game units.
// Generate packed position/normal/color vertices for one weapon and optional gameplay hands.
import { characterStyle } from "./model-style.js";
export function weaponMesh(
  index,
  finish = "graphite",
  optic = "iron",
  firing = false,
  hands = false,
  classId = ["assault", "engineer", "assault", "scout", "support"][index],
) {
  const out = [],
    parts = [];
  // Record contiguous float ranges belonging to independently movable components.
  const part = (name, fn) => {
    const start = out.length;
    fn();
    parts.push({ name, start, end: out.length });
  };
  const body = {
    graphite: [0.16, 0.19, 0.21],
    sand: [0.49, 0.4, 0.27],
    olive: [0.28, 0.33, 0.22],
  }[finish] || [0.16, 0.19, 0.21];
  const steel = [0.09, 0.11, 0.13],
    edge = [0.29, 0.32, 0.34],
    rubber = [0.055, 0.065, 0.07];
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
  // Extrude a side silhouette (z,y) across the receiver's width.
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
  // Reuse the profile extrusion helper for rectangular components.
  function box(x, y, z, w, h, d, col) {
    const bevel = Math.min(w, h, d) * 0.12;
    profile(
      [
        [z - d / 2 + bevel, y - h / 2],
        [z + d / 2 - bevel, y - h / 2],
        [z + d / 2, y - h / 2 + bevel],
        [z + d / 2, y + h / 2 - bevel],
        [z + d / 2 - bevel, y + h / 2],
        [z - d / 2 + bevel, y + h / 2],
        [z - d / 2, y + h / 2 - bevel],
        [z - d / 2, y - h / 2 + bevel],
      ],
      w,
      col,
      x,
    );
  }
  // Approximate cylinders with twelve facets; open tubes provide unobstructed scope sightlines.
  function tube(x, y, z, r, len, col, open = false) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6;
      const p = [x + Math.cos(a) * r, y + Math.sin(a) * r, z - len / 2],
        q = [x + Math.cos(b) * r, y + Math.sin(b) * r, z - len / 2];
      const s = [p[0], p[1], z + len / 2],
        t = [q[0], q[1], z + len / 2];
      tri(p, q, t, col);
      tri(p, t, s, col);
      if (!open) tri([x, y, z - len / 2], q, p, rubber);
      if (!open) tri([x, y, z + len / 2], s, t, col);
    }
  }
  const pistol = index === 2,
    smg = index === 1,
    dmr = index === 3,
    lmg = index === 4;
  const front = pistol ? -0.19 : smg ? -0.3 : dmr ? -0.56 : lmg ? -0.49 : -0.43;
  // Use a short slide and angled grip instead of the rifle receiver/stock assembly.
  if (pistol) {
    part("slide", () =>
      profile(
        [
          [-0.22, 0.025],
          [0.14, 0.025],
          [0.17, 0.09],
          [0.12, 0.135],
          [-0.2, 0.135],
        ],
        0.085,
        body,
      ),
    );
    profile(
      [
        [0.04, 0.035],
        [0.13, 0.035],
        [0.2, -0.19],
        [0.09, -0.2],
      ],
      0.074,
      rubber,
    );
    box(0, 0.008, -0.09, 0.075, 0.045, 0.23, steel);
    tube(0, 0.072, -0.225, 0.019, 0.032, steel);
    part("magazine", () => box(0, -0.205, 0.145, 0.063, 0.18, 0.068, steel));
    part("slide", () => {
      for (let i = 0; i < 6; i++)
        box(0.044, 0.085, 0.07 + i * 0.012, 0.003, 0.054, 0.005, edge);
    });
  } else {
    profile(
      [
        [-0.22, -0.045],
        [0.18, -0.045],
        [0.21, 0.045],
        [0.13, 0.105],
        [-0.21, 0.105],
      ],
      lmg ? 0.14 : 0.105,
      body,
    );
    // Angled pistol grip and stock, separate from the magazine.
    profile(
      [
        [0.07, -0.035],
        [0.15, -0.035],
        [0.22, -0.23],
        [0.12, -0.24],
      ],
      0.072,
      rubber,
    );
    // The shoulder stock sits outside the first-person camera; previews retain the full model.
    if (!hands) {
      tube(0, 0.034, 0.28, 0.027, 0.22, steel);
      profile(
        [
          [0.23, 0.075],
          [0.44, 0.065],
          [0.46, -0.14],
          [0.39, -0.15],
          [0.29, -0.05],
          [0.23, -0.04],
        ],
        0.087,
        body,
      );
      box(0, -0.04, 0.455, 0.094, 0.22, 0.018, rubber);
    }
    profile(
      [
        [front, -0.018],
        [-0.19, -0.025],
        [-0.19, 0.085],
        [front + 0.025, 0.085],
      ],
      smg ? 0.085 : 0.095,
      body,
    );
    for (let i = 0; i < (dmr ? 9 : 6); i++) {
      const z = front + 0.035 + i * 0.025;
      box(0.049, 0.034, z, 0.008, 0.023, 0.014, steel);
      box(-0.049, 0.034, z, 0.008, 0.023, 0.014, steel);
    }
    tube(0, 0.035, front - 0.07, 0.018, 0.18, steel);
    tube(0, 0.035, front - 0.165, 0.025, 0.045, edge);
    // A visible dark bore instead of a solid block muzzle.
    tube(0, 0.035, front - 0.19, 0.013, 0.006, rubber);
    // Separate the ammo box, belt, and feed cover so the reload can articulate each one.
    if (lmg) {
      part("magazine", () => box(0, -0.14, -0.09, 0.18, 0.2, 0.16, body));
      part("belt", () => {
        for (let i = 0; i < 5; i++)
          box(
            0.083 + i * 0.014,
            -0.04,
            -0.08,
            0.012,
            0.015,
            0.07,
            [0.61, 0.46, 0.2],
          );
      });
      part("cover", () => box(0, 0.13, -0.025, 0.11, 0.025, 0.22, steel));
    } else {
      part("magazine", () => {
        profile(
          smg
            ? [
                [-0.095, -0.03],
                [-0.035, -0.03],
                [-0.025, -0.29],
                [-0.1, -0.29],
              ]
            : [
                [-0.13, -0.03],
                [-0.035, -0.03],
                [-0.04, -0.18],
                [-0.1, -0.28],
                [-0.19, -0.26],
                [-0.14, -0.14],
              ],
          0.068,
          steel,
        );
        for (let i = 0; i < 3; i++)
          box(0.035, -0.095 - i * 0.045, -0.094, 0.004, 0.008, 0.066, edge);
      });
    }
    box(0.057, 0.043, 0.03, 0.008, 0.039, 0.085, steel); // ejection port
    part("bolt", () => box(0.069, 0.032, 0.015, 0.027, 0.014, 0.028, edge));
    for (let i = 0; i < 13; i++)
      box(0, 0.113, -0.2 + i * 0.027, 0.075, 0.012, 0.012, steel);
  }
  // Open trigger guard, iron sights, optional optic.
  box(0, -0.095, 0.014, 0.024, 0.012, 0.09, steel);
  box(0, -0.066, -0.028, 0.024, 0.065, 0.014, steel);
  box(0, -0.057, 0.024, 0.012, 0.042, 0.012, edge);
  for (const side of [-1, 1])
    box(side * 0.027, 0.143, pistol ? 0.11 : 0.13, 0.015, 0.038, 0.021, steel);
  box(0, 0.14, pistol ? -0.18 : front + 0.03, 0.018, 0.048, 0.018, steel);
  // The marksman rifle retains its scope; other weapons follow the cosmetic sight selection.
  if (dmr || optic === "scope") {
    box(0, 0.16, -0.04, 0.045, 0.08, 0.1, steel);
    tube(0, 0.218, -0.055, 0.044, 0.25, steel, true);
    tube(0, 0.218, -0.2, 0.058, 0.07, edge, true);
    tube(0, 0.218, 0.086, 0.049, 0.045, edge, true);
    box(0.046, 0.224, -0.015, 0.03, 0.028, 0.028, steel);
  } else if (optic === "reflex") {
    box(0, 0.16, -0.055, 0.07, 0.034, 0.075, steel);
    box(-0.043, 0.21, -0.055, 0.014, 0.09, 0.035, steel);
    box(0.043, 0.21, -0.055, 0.014, 0.09, 0.035, steel);
    box(0, 0.252, -0.055, 0.1, 0.013, 0.035, steel);
    box(0, 0.205, -0.057, 0.006, 0.006, 0.008, [1, 0.2, 0.1]);
  }
  // Add a brief muzzle flash to the firing variant at the weapon-specific barrel tip.
  if (firing) {
    const tip = pistol ? -0.26 : front - 0.22;
    profile(
      [
        [tip, 0.065],
        [tip - 0.12, 0.035],
        [tip, 0.005],
      ],
      0.07,
      [1, 0.76, 0.25],
    );
  }
  // Hands appear only in gameplay meshes; armory previews show the weapon by itself.
  if (hands) {
    const outfit = characterStyle(classId);
    const glove = outfit.cloth,
      padding = outfit.accent,
      seam = [0.12, 0.15, 0.16],
      sleeve = outfit.cloth;
    // Rounded, tapered forms keep wrists and fingers distinct from weapon geometry.
    function ellipsoid(center, radii, color) {
      const start = out.length;
      const small = Math.max(...radii) <= 0.02;
      const latitudeSteps = small ? 4 : 6;
      const segments = small ? 10 : 20;
      const point = (latitude, longitude) => {
        const a = (Math.PI * latitude) / latitudeSteps;
        const b = (2 * Math.PI * longitude) / segments;
        return [
          center[0] + radii[0] * Math.sin(a) * Math.cos(b),
          center[1] + radii[1] * Math.cos(a),
          center[2] + radii[2] * Math.sin(a) * Math.sin(b),
        ];
      };
      for (let i = 0; i < latitudeSteps; i++)
        for (let j = 0; j < segments; j++) {
          const a = point(i, j),
            b = point(i + 1, j),
            c = point(i + 1, j + 1),
            d = point(i, j + 1);
          if (i > 0) tri(a, b, d, color);
          if (i < latitudeSteps - 1) tri(b, c, d, color);
        }
      // Smooth glove shading uses surface normals rather than triangle face normals.
      for (let k = start; k < out.length; k += 9) {
        const normal = radii.map((r, i) => (out[k + i] - center[i]) / (r * r));
        const length = Math.hypot(...normal) || 1;
        for (let i = 0; i < 3; i++) out[k + 3 + i] = normal[i] / length;
      }
    }
    function tapered(a, b, radiusA, radiusB, color, flatten = 1) {
      const axis = b.map((v, i) => v - a[i]);
      const length = Math.hypot(...axis);
      const n = axis.map((v) => v / length);
      const reference = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let u = [
        n[1] * reference[2] - n[2] * reference[1],
        n[2] * reference[0] - n[0] * reference[2],
        n[0] * reference[1] - n[1] * reference[0],
      ];
      const unit = Math.hypot(...u);
      u = u.map((v) => v / unit);
      const v = [
        n[1] * u[2] - n[2] * u[1],
        n[2] * u[0] - n[0] * u[2],
        n[0] * u[1] - n[1] * u[0],
      ];
      const ring = (p, r, i) =>
        p.map(
          (x, k) =>
            x +
            r *
              (Math.cos((i * Math.PI) / 6) * u[k] +
                Math.sin((i * Math.PI) / 6) * v[k] * flatten),
        );
      for (let i = 0; i < 12; i++) {
        const p = ring(a, radiusA, i),
          q = ring(a, radiusA, i + 1),
          r = ring(b, radiusB, i + 1),
          s = ring(b, radiusB, i);
        tri(p, q, r, color);
        tri(p, r, s, color);
        tri(a, q, p, color);
        tri(b, s, r, color);
      }
    }
    function finger(points, radius = 0.012) {
      for (let i = 0; i < points.length - 1; i++)
        tapered(points[i], points[i + 1], radius, radius * 0.92, glove);
      for (const point of points)
        ellipsoid(point, [radius * 0.85, radius * 0.85, radius * 0.85], glove);
    }
    function arm(wrist, elbow) {
      const axis = elbow.map((v, i) => v - wrist[i]);
      const length = Math.hypot(...axis);
      const n = axis.map((v) => v / length);
      const u0 = [n[2], 0, -n[0]],
        ul = Math.hypot(...u0);
      const u = u0.map((v) => v / ul);
      const v = [
        n[1] * u[2] - n[2] * u[1],
        n[2] * u[0] - n[0] * u[2],
        n[0] * u[1] - n[1] * u[0],
      ];
      const rings = [];
      // Continuous rounded cross-sections follow a curved forearm with restrained fabric folds.
      for (let j = 0; j <= 14; j++) {
        const t = j / 14;
        const center = wrist.map((x, i) => x + axis[i] * t);
        center[1] += Math.sin(t * Math.PI) * 0.032;
        const radius =
          0.036 +
          0.04 * Math.sin((t * Math.PI) / 2) +
          0.0025 * Math.sin(t * 36) * Math.sin(t * Math.PI);
        rings.push(
          Array.from({ length: 20 }, (_, i) => {
            const a = (i * Math.PI) / 10;
            const normal = u.map(
              (x, k) => x * Math.cos(a) + v[k] * Math.sin(a) * 0.86,
            );
            return { p: center.map((x, k) => x + radius * normal[k]), normal };
          }),
        );
      }
      const emit = (a, b, c, color) => {
        const start = out.length;
        tri(a.p, b.p, c.p, color);
        [a, b, c].forEach((point, i) => {
          const len = Math.hypot(...point.normal);
          for (let k = 0; k < 3; k++)
            out[start + i * 9 + 3 + k] = point.normal[k] / len;
        });
      };
      for (let j = 0; j < 14; j++)
        for (let i = 0; i < 20; i++) {
          const next = (i + 1) % 20;
          const color = j < 2 ? seam : sleeve;
          emit(rings[j][i], rings[j][next], rings[j + 1][next], color);
          emit(rings[j][i], rings[j + 1][next], rings[j + 1][i], color);
        }
    }
    part("grip", () => {
      // Palm sits against the right side of the pistol grip; curled fingers cross its front.
      // A tapered dorsal silhouette reads as a hand rather than an oval mitten.
      profile(
        [
          [0.115, -0.067],
          [0.165, -0.063],
          [0.19, -0.1],
          [0.205, -0.162],
          [0.181, -0.192],
          [0.143, -0.183],
          [0.111, -0.127],
        ],
        0.063,
        glove,
        0.06,
      );
      for (let i = 0; i < 3; i++)
        ellipsoid(
          [0.093, -0.094 - i * 0.026, 0.153 + i * 0.007],
          [0.008, 0.01, 0.023],
          padding,
        );
      for (let i = 0; i < 3; i++) {
        ellipsoid(
          [0.101, -0.098 - i * 0.027, 0.143 + i * 0.011],
          [0.009, 0.01, 0.02],
          padding,
        );
        tapered(
          [0.104, -0.095 - i * 0.027, 0.13],
          [0.105, -0.095 - i * 0.027, 0.16],
          0.002,
          0.002,
          seam,
        );
      }
      for (let i = 0; i < 3; i++) {
        const y = -0.105 - i * 0.027,
          z = 0.09 + i * 0.012;
        finger([
          [0.068, y, z + 0.035],
          [0.058, y, z],
          [-0.028, y, z - 0.008],
          [-0.044, y, z + 0.02],
        ]);
      }
      // Index rests along the trigger guard, clear of the receiver and sightline.
      finger(
        [
          [0.074, -0.08, 0.14],
          [0.065, -0.065, 0.055],
          [0.026, -0.06, 0.035],
        ],
        0.011,
      );
      finger(
        [
          [0.062, -0.07, 0.18],
          [0.022, -0.042, 0.15],
          [-0.022, -0.059, 0.13],
        ],
        0.014,
      );
      arm([0.067, -0.19, 0.2], [0.3, -0.44, 0.44]);
    });
    part("support", () => {
      if (pistol) {
        // A two-handed pistol grip cups the firing hand rather than the barrel.
        ellipsoid([-0.055, -0.135, 0.13], [0.039, 0.061, 0.051], glove);
        for (let i = 0; i < 3; i++) {
          const y = -0.115 - i * 0.025;
          finger(
            [
              [-0.069, y, 0.13],
              [-0.047, y, 0.075],
              [0.026, y, 0.071],
            ],
            0.011,
          );
        }
        finger(
          [
            [-0.067, -0.075, 0.15],
            [-0.054, -0.052, 0.075],
            [-0.042, -0.045, 0.032],
          ],
          0.013,
        );
        arm([-0.068, -0.19, 0.19], [-0.3, -0.44, 0.44]);
      } else {
        const z = smg ? -0.235 : -0.31;
        ellipsoid([-0.072, -0.04, z], [0.048, 0.06, 0.076], glove);
        ellipsoid([-0.109, -0.033, z], [0.013, 0.033, 0.05], padding);
        for (let i = 0; i < 4; i++) {
          const fingerZ = z - 0.045 + i * 0.028;
          finger(
            [
              [-0.073, -0.054, fingerZ],
              [-0.041, -0.093, fingerZ],
              [0.036, -0.082, fingerZ],
              [0.057, -0.027, fingerZ],
            ],
            0.011,
          );
        }
        finger(
          [
            [-0.093, -0.022, z + 0.045],
            [-0.075, 0.062, z + 0.025],
            [-0.025, 0.085, z - 0.045],
          ],
          0.014,
        );
        arm([-0.085, -0.115, z + 0.035], [-0.3, -0.43, 0.44]);
      }
    });
  }
  const result = new Float32Array(out);
  result.parts = parts;
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
