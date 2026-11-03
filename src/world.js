// Procedural arena geometry doubles as collision data; navigation uses a coarse walkable graph.
import { rayBox } from "./math.js";
import { FREEDM_MAP } from "./maps/freedm-dm01.js";
import { tdmMap } from "./maps/tdm-maps.js";
export const TEAM_COLORS = [
  [0.25, 0.78, 0.72],
  [0.96, 0.38, 0.19],
];
// Conquest layout in FreeDM map cells (column, row): shared by the arena and the lobby's map.
export const CONQUEST_LAYOUT = Object.freeze({
  sectors: Object.freeze([
    Object.freeze({ id: "A", name: "West Depot", cell: [8, 20] }),
    // Placed by simulation: across 48 bot-only matches this cell gives both teams an even share of
    // wins and of time holding B. One cell west or east tips matches decisively to one side.
    Object.freeze({ id: "B", name: "Central Yard", cell: [29, 16] }),
    Object.freeze({ id: "C", name: "East Relay", cell: [45, 24] }),
  ]),
  // One spawn column per team: [column, rows].
  bases: Object.freeze([
    Object.freeze([5, Object.freeze([14, 16, 20, 24, 26])]),
    Object.freeze([46, Object.freeze([12, 16, 18, 26, 28])]),
  ]),
});
// Bodies are vertical cylinders: centres closer than this collide (about the hitbox width).
export const BODY_GAP = 0.62;
export class Arena {
  // Build visual boxes, collidable solids, and team spawn lists once.
  constructor(mode = "tdm", mapId = "yard") {
    this.boxes = [];
    this.solids = [];
    this.spawns = [[], []];
    // Actors that block each other; the simulation assigns its roster.
    this.bodies = null;
    if (mode === "conquest") {
      this.mapId = "outpost";
      this.name = FREEDM_MAP.name;
      this.buildConquest();
    } else {
      const map = tdmMap(mapId);
      this.mapId = map.id;
      this.name = map.name;
      this.bounds = map.bounds;
      map.build(this);
    }
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
    this.sectors = CONQUEST_LAYOUT.sectors.map(({ id, name, cell }) => ({
      id,
      name,
      ...point(...cell),
      radius: 3.2,
    }));
    // Forward deployment points sit just outside each capture radius on open floor cells.
    for (const s of this.sectors) {
      const ring = this.navigationPoints.filter((p) => {
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        return (
          d > s.radius + 0.8 && d < s.radius + 4 && !this.blocked(p.x, p.z)
        );
      });
      const step = Math.max(1, Math.floor(ring.length / 6));
      s.spawnPoints = ring.filter((_, i) => i % step === 0).slice(0, 6);
    }
    this.spawns = CONQUEST_LAYOUT.bases.map(([x, rows]) =>
      rows.map((z) => point(x, z)),
    );
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
  // A move into another living body is refused only when it also closes the gap, so actors
  // that already overlap (a shared spawn, a respawn) can always step apart.
  bodyBlocked(a, x, z) {
    if (!this.bodies) return false;
    for (const b of this.bodies) {
      if (b === a || !b.alive || Math.abs(b.y - a.y) >= 1.7) continue;
      const next = Math.hypot(x - b.x, z - b.z);
      if (next < BODY_GAP && next < Math.hypot(a.x - b.x, a.z - b.z) - 1e-9)
        return true;
    }
    return false;
  }
  // Resolve X and Z separately so actors can slide along a wall or a body instead of sticking.
  move(a, dx, dz) {
    const h = a.crouched ? 1.15 : 1.8;
    if (
      !this.blocked(a.x + dx, a.z, 0.36, a.y, h) &&
      !this.bodyBlocked(a, a.x + dx, a.z)
    )
      a.x += dx;
    if (
      !this.blocked(a.x, a.z + dz, 0.36, a.y, h) &&
      !this.bodyBlocked(a, a.x, a.z + dz)
    )
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
    // Sample a 2 m grid inset 3 m from the walls of the map's playable floor.
    if (!arena.navigationPoints) {
      const { w, d } = arena.bounds || { w: 50, d: 38 },
        hx = w / 2 - 3,
        hz = d / 2 - 3;
      for (let z = -hz; z <= hz; z += 2)
        for (let x = -hx; x <= hx; x += 2)
          if (!arena.blocked(x, z, 0.6)) points.push({ x, z });
    }
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
        // Two clear points can still sit either side of a thin wall: check the midpoint too.
        if (
          neighbor !== undefined &&
          !arena.blocked(n.x + dx / 2, n.z + dz / 2, 0.3)
        )
          n.links.push(neighbor);
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
