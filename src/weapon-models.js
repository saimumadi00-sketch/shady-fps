// Procedural firearm-inspired triangle meshes; named part ranges allow animation without rebuilding topology.
// Original low-poly firearm meshes. Dimensions are visual game units.
// Generate packed position/normal/color vertices for one weapon and optional gameplay hands.
export function weaponMesh(
  index,
  finish = "graphite",
  optic = "iron",
  firing = false,
  hands = false,
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
    profile(
      [
        [z - d / 2, y - h / 2],
        [z + d / 2, y - h / 2],
        [z + d / 2, y + h / 2],
        [z - d / 2, y + h / 2],
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
    const glove = [0.22, 0.25, 0.2],
      cuff = [0.13, 0.17, 0.15];
    box(0.025, -0.12, 0.155, 0.11, 0.12, 0.1, glove);
    box(0.045, -0.21, 0.24, 0.105, 0.18, 0.16, cuff);
    part("support", () => {
      box(-0.07, -0.11, pistol ? 0.1 : -0.29, 0.105, 0.105, 0.13, glove);
      for (let i = 0; i < 4; i++)
        box(
          -0.035,
          -0.075 - i * 0.02,
          pistol ? 0.08 : -0.29,
          0.07,
          0.016,
          0.085,
          glove,
        );
      box(-0.1, -0.2, pistol ? 0.16 : -0.2, 0.09, 0.16, 0.13, cuff);
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
