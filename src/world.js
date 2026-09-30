// Procedural arena geometry doubles as collision data; navigation uses a coarse walkable graph.
import { rayBox } from "./math.js";
import { FREEDM_MAP } from "./maps/freedm-dm01.js";
export const TEAM_COLORS = [
  [0.25, 0.78, 0.72],
  [0.96, 0.38, 0.19],
];
export class Arena {
  // Build visual boxes, collidable solids, and team spawn lists once.
  constructor(mode = "tdm") {
    this.boxes = [];
    this.solids = [];
    this.spawns = [[], []];
    this.name = mode === "conquest" ? FREEDM_MAP.name : "Yard 07";
    if (mode === "conquest") this.buildConquest();
    else this.build();
  }
  // The actual FreeDM MAP01 footprint is sampled at import time, then flattened
  // into this engine's box geometry. Row runs keep collision and GPU cost low.
  buildConquest() {
    const { rows, cellSize: cell } = FREEDM_MAP;
    const width = rows[0].length,
      height = rows.length;
    const point = (x, z) => ({
      x: (x - (width - 1) / 2) * cell,
      z: (z - (height - 1) / 2) * cell,
    });
    this.map = FREEDM_MAP;
    this.navStep = cell;
    this.navigationPoints = [];
    this.box(0, -0.22, 0, width * cell, 0.4, height * cell, [0.34, 0.4, 0.4]);
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width;) {
        if (rows[z][x] === ".") {
          this.navigationPoints.push(point(x, z));
          x++;
          continue;
        }
        const start = x;
        while (x < width && rows[z][x] === "#") x++;
        const p = point((start + x - 1) / 2, z);
        this.box(p.x, 1.8, p.z, (x - start) * cell, 3.6, cell, [
          0.5 + (z % 3) * 0.03,
          0.57,
          0.56,
        ]);
        this.box(
          p.x,
          3.64,
          p.z,
          (x - start) * cell,
          0.08,
          cell,
          [0.2, 0.3, 0.31],
          false,
        );
      }
    }
    this.sectors = [
      { id: "A", name: "West Depot", ...point(8, 20), radius: 3.2 },
      { id: "B", name: "Central Yard", ...point(28, 15), radius: 3.2 },
      { id: "C", name: "East Relay", ...point(45, 24), radius: 3.2 },
    ];
    this.spawns = [
      [14, 16, 20, 24, 26].map((z) => point(5, z)),
      [12, 16, 18, 26, 28].map((z) => point(46, z)),
    ];
    for (let team = 0; team < 2; team++)
      for (const p of this.spawns[team])
        this.box(p.x, 0.005, p.z, 1.25, 0.02, 1.25, TEAM_COLORS[team], false);
  }
  box(x, y, z, w, h, d, color, solid = true) {
    const b = { x, y, z, w, h, d, color };
    this.boxes.push(b);
    if (solid) this.solids.push(b);
    return b;
  }
  build() {
    const b = this.box.bind(this),
      sand = [0.55, 0.59, 0.54],
      wall = [0.69, 0.71, 0.62],
      dark = [0.22, 0.32, 0.32],
      teal = [0.19, 0.43, 0.43],
      rust = [0.66, 0.36, 0.24];
    b(0, -0.22, 0, 50, 0.4, 38, sand);
    b(0, 2, -19, 50, 4, 1, wall);
    b(0, 2, 19, 50, 4, 1, wall);
    b(-25, 2, 0, 1, 4, 38, wall);
    b(25, 2, 0, 1, 4, 38, wall);
    // Separated freight stacks define north, middle and south routes, with open crossovers.
    for (const x of [-12, 12])
      for (const z of [-7, 7]) {
        b(x, 1.5, z, 9, 3, 4, x * z > 0 ? teal : rust);
        b(x, 3.05, z, 9.2, 0.12, 4.2, dark, false);
        for (let i = -4; i <= 4; i++)
          b(
            x + i,
            1.5,
            z + (z > 0 ? 2.02 : -2.02),
            0.055,
            2.8,
            0.07,
            [0.32, 0.39, 0.34],
            false,
          );
      }
    b(0, 1.9, 0, 3.4, 3.8, 4.8, wall);
    b(0, 3.88, 0, 3.8, 0.16, 5.2, dark, false);
    for (const [x, z] of [
      [-5, -13],
      [5, 13],
      [-6, 3],
      [6, -3],
      [-19, -2],
      [19, 2],
    ]) {
      b(x, 0.65, z, 2.6, 1.3, 2.1, [0.53, 0.49, 0.34]);
      b(x, 0.7, z, 2.67, 0.13, 2.17, dark, false);
    }
    for (const z of [-17, 17])
      for (const x of [-17, 0, 17]) {
        b(x, 2.6, z, 0.22, 5.2, 0.22, dark);
        b(x, 5.15, z, 1.8, 0.15, 0.7, [0.86, 0.85, 0.62], false);
      }
    // Painted route stripes and spawn pads are geometry: no textures to fetch.
    for (const z of [-13, 0, 13])
      for (let x = -22; x < 23; x += 4)
        b(x, 0.003, z, 1.6, 0.015, 0.12, [0.81, 0.76, 0.48], false);
    for (let t = 0; t < 2; t++) {
      let x = t ? 22 : -22;
      b(x, 0.006, 0, 3, 0.025, 31, TEAM_COLORS[t], false);
      for (const z of [-14, -7, 0, 7, 14]) this.spawns[t].push({ x, z });
    }
    // Original dock gantries and distant industrial silhouettes.
    for (const x of [-22, 22]) {
      b(x, 5.5, -12, 0.45, 11, 0.45, dark, false);
      b(x, 5.5, 12, 0.45, 11, 0.45, dark, false);
      b(x, 10.7, 0, 0.6, 0.6, 25, rust, false);
    }
    for (let i = 0; i < 14; i++)
      b(
        -38 + i * 6,
        2 + (i % 3),
        -30,
        4,
        4 + 2 * (i % 3),
        5,
        [0.34, 0.45, 0.46],
        false,
      );
  }
  // Expand solid bounds by the actor radius and compare vertical spans with a small tolerance.
  blocked(x, z, r = 0.36, y = 0, height = 1.8) {
    return this.solids.some(
      (b) =>
        y < b.y + b.h / 2 - 0.02 &&
        y + height > b.y - b.h / 2 + 0.02 &&
        Math.abs(x - b.x) < b.w / 2 + r &&
        Math.abs(z - b.z) < b.d / 2 + r,
    );
  }
  // Resolve X and Z separately so actors can slide along a wall instead of sticking to it.
  move(a, dx, dz) {
    if (!this.blocked(a.x + dx, a.z, 0.36, a.y, a.crouched ? 1.15 : 1.8))
      a.x += dx;
    if (!this.blocked(a.x, a.z + dz, 0.36, a.y, a.crouched ? 1.15 : 1.8))
      a.z += dz;
  }
  // Choose the highest supporting solid below the actor, allowing a small step tolerance.
  floor(x, z, y) {
    let top = 0;
    for (const b of this.solids) {
      const t = b.y + b.h / 2;
      if (
        t <= y + 0.12 &&
        Math.abs(x - b.x) < b.w / 2 + 0.3 &&
        Math.abs(z - b.z) < b.d / 2 + 0.3
      )
        top = Math.max(top, t);
    }
    return top;
  }
  // Find the nearest solid intersection and include the ground plane for downward shots.
  ray(o, d, max = 100) {
    let hit = max;
    for (const b of this.solids) hit = Math.min(hit, rayBox(o, d, b, hit));
    if (d[1] < 0) hit = Math.min(hit, -o[1] / d[1]);
    return hit;
  }
  // Cast from eye height toward the target body with a small endpoint tolerance.
  visible(a, b) {
    const o = [a.x, a.y + 1.45, a.z],
      v = [b.x - a.x, b.y + 1.1 - o[1], b.z - a.z],
      l = Math.hypot(...v);
    return (
      this.ray(
        o,
        v.map((n) => n / l),
        l,
      ) >=
      l - 0.05
    );
  }
}
export class NavigationSystem {
  // Sample walkable grid points and connect adjacent orthogonal neighbors.
  constructor(arena) {
    this.arena = arena;
    this.nodes = [];
    this.cache = new Map();
    const points = arena.navigationPoints || [];
    if (!arena.navigationPoints)
      for (let z = -16; z <= 16; z += 2)
        for (let x = -22; x <= 22; x += 2)
          if (!arena.blocked(x, z, 0.6)) points.push({ x, z });
    this.nodes = points.map((p) => ({ ...p, links: [] }));
    const step = arena.navStep || 2;
    const key = (x, z) => `${Math.round(x / step)}:${Math.round(z / step)}`;
    const indices = new Map(this.nodes.map((n, i) => [key(n.x, n.z), i]));
    for (const n of this.nodes)
      for (const [dx, dz] of [
        [-step, 0],
        [step, 0],
        [0, -step],
        [0, step],
      ]) {
        const neighbor = indices.get(key(n.x + dx, n.z + dz));
        if (neighbor !== undefined) n.links.push(neighbor);
      }
  }
  // Use squared distance to map an arbitrary actor position onto a graph node.
  nearest(a) {
    let best = 0,
      d = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i],
        v = (n.x - a.x) ** 2 + (n.z - a.z) ** 2;
      if (v < d) {
        best = i;
        d = v;
      }
    }
    return best;
  }
  // Cache paths by endpoint node IDs; breadth-first search is sufficient for equal-cost edges.
  path(a, b) {
    const start = this.nearest(a),
      end = this.nearest(b),
      key = start + ":" + end;
    if (this.cache.has(key)) return this.cache.get(key);
    // Use predecessor markers for both visitation and later path reconstruction.
    const prev = new Int16Array(this.nodes.length).fill(-1),
      queue = [start];
    prev[start] = start;
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      if (n === end) break;
      for (const v of this.nodes[n].links)
        if (prev[v] < 0) {
          prev[v] = n;
          queue.push(v);
        }
    }
    // Backtrack from the destination and reverse to return waypoints in travel order.
    const path = [];
    if (prev[end] >= 0) {
      let v = end;
      while (v !== start) {
        path.push(this.nodes[v]);
        v = prev[v];
      }
      path.reverse();
    }
    // Evict the oldest inserted route to bound memory across repeated matches.
    if (this.cache.size >= 256)
      this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, path);
    return path;
  }
}
