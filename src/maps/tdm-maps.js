// Team Deathmatch maps, built from boxes like the rest of the engine. Each map is point
// symmetric about the origin, (x, z) -> (-x, -z), so neither team gets the better half.
// Cyan (team 0) always spawns on the west (negative x) edge, Ember on the east.
// `build(arena)` adds geometry with arena.box(x, y, z, w, h, d, color, solid) and pushes five
// spawn points per team; `bounds` is the playable floor so navigation and the overview fit it.
// world.js imports this module too; TEAM_COLORS is only read when a map is built.
import { TEAM_COLORS } from "../world.js";

const DARK = [0.22, 0.32, 0.32];

// Floor plus a perimeter wall; perimeter boxes are flagged so the overview leaves them out.
function enclose(a, w, d, floor, wall, height = 4) {
  a.box(0, -0.22, 0, w, 0.4, d, floor);
  for (const s of [-1, 1]) {
    a.box(0, height / 2, (s * (d + 1)) / 2, w + 2, height, 1, wall).edge = true;
    a.box((s * (w + 1)) / 2, height / 2, 0, 1, height, d, wall).edge = true;
  }
}
// Add a box and its point-symmetric twin (one box when it sits on the centre).
function pair(a, x, y, z, w, h, d, color, solid = true) {
  a.box(x, y, z, w, h, d, color, solid);
  if (x !== 0 || z !== 0) a.box(-x, y, -z, w, h, d, color, solid);
}
// Five spawns per team on x = -edge (Cyan) and x = +edge (Ember), with a painted pad.
function spawnColumns(a, edge, rows, padLength) {
  for (let t = 0; t < 2; t++) {
    const x = t ? edge : -edge;
    a.box(x, 0.006, 0, 3, 0.025, padLength, TEAM_COLORS[t], false);
    // Ember mirrors Cyan through the centre, so its rows are negated.
    for (const z of rows) a.spawns[t].push({ x, z: t ? -z || 0 : z });
  }
}
// An axis-aligned wall from (x1, z1) to (x2, z2), 0.6 m thick, with a darker cap.
function wall(a, x1, z1, x2, z2, color, height = 4) {
  const w = Math.abs(x2 - x1) || 0.6,
    d = Math.abs(z2 - z1) || 0.6,
    x = (x1 + x2) / 2,
    z = (z1 + z2) / 2;
  pair(a, x, height / 2, z, w, height, d, color);
  pair(a, x, height + 0.06, z, w + 0.1, 0.12, d + 0.1, DARK, false);
}

export const TDM_MAPS = Object.freeze([
  {
    id: "yard",
    name: "Yard 07",
    tagline: "Three lanes, ten fighters, one yard",
    description:
      "A sunlit freight terminal. Take a flank, hold the crossing and keep your team ahead.",
    summary:
      "four freight stacks split the yard into north, middle and south lanes around a central block",
    bounds: { w: 50, d: 38 },
    build(a) {
      const b = a.box.bind(a),
        sand = [0.55, 0.59, 0.54],
        wallColor = [0.69, 0.71, 0.62],
        teal = [0.19, 0.43, 0.43],
        rust = [0.66, 0.36, 0.24];
      b(0, -0.22, 0, 50, 0.4, 38, sand);
      b(0, 2, -19, 50, 4, 1, wallColor).edge = true;
      b(0, 2, 19, 50, 4, 1, wallColor).edge = true;
      b(-25, 2, 0, 1, 4, 38, wallColor).edge = true;
      b(25, 2, 0, 1, 4, 38, wallColor).edge = true;
      // Separated freight stacks define north, middle and south routes, with open crossovers.
      for (const x of [-12, 12])
        for (const z of [-7, 7]) {
          b(x, 1.5, z, 9, 3, 4, x * z > 0 ? teal : rust);
          b(x, 3.05, z, 9.2, 0.12, 4.2, DARK, false);
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
      b(0, 1.9, 0, 3.4, 3.8, 4.8, wallColor);
      b(0, 3.88, 0, 3.8, 0.16, 5.2, DARK, false);
      for (const [x, z] of [
        [-5, -13],
        [-6, 3],
        [-19, -2],
      ]) {
        pair(a, x, 0.65, z, 2.6, 1.3, 2.1, [0.53, 0.49, 0.34]);
        pair(a, x, 0.7, z, 2.67, 0.13, 2.17, DARK, false);
      }
      for (const z of [-17, 17])
        for (const x of [-17, 0, 17]) {
          b(x, 2.6, z, 0.22, 5.2, 0.22, DARK);
          b(x, 5.15, z, 1.8, 0.15, 0.7, [0.86, 0.85, 0.62], false);
        }
      // Painted route stripes and spawn pads are geometry: no textures to fetch.
      for (const z of [-13, 0, 13])
        for (let x = -22; x < 23; x += 4)
          b(x, 0.003, z, 1.6, 0.015, 0.12, [0.81, 0.76, 0.48], false);
      spawnColumns(a, 22, [-14, -7, 0, 7, 14], 31);
      // Dock gantries and distant industrial silhouettes.
      for (const x of [-22, 22]) {
        b(x, 5.5, -12, 0.45, 11, 0.45, DARK, false);
        b(x, 5.5, 12, 0.45, 11, 0.45, DARK, false);
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
    },
  },
  {
    id: "railcut",
    name: "Rail Cut",
    tagline: "Three tracks, long sightlines, boxcar cover",
    description:
      "A switching yard of parked boxcars. Long lanes reward marksmen; the gaps between cars are where fights are won.",
    summary:
      "three east-west rail tracks lined with parked boxcars, with crossings between the cars and two signal huts",
    bounds: { w: 60, d: 30 },
    build(a) {
      const gravel = [0.5, 0.49, 0.45],
        concrete = [0.62, 0.6, 0.55],
        steel = [0.36, 0.38, 0.38],
        cars = [
          [0.55, 0.27, 0.2],
          [0.2, 0.36, 0.42],
          [0.47, 0.42, 0.26],
        ];
      enclose(a, 60, 30, gravel, concrete);
      // Rails and sleepers are flat decoration across the full yard.
      for (const z of [-8, 0, 8]) {
        for (const s of [-0.72, 0.72])
          a.box(0, 0.06, z + s, 60, 0.1, 0.1, steel, false);
        for (let x = -29; x <= 29; x += 1.5)
          a.box(x, 0.02, z, 0.35, 0.05, 2.2, [0.33, 0.27, 0.22], false);
      }
      // Boxcars stand on wheels: the body is solid from 0.3 m up, so feet show underneath.
      const boxcar = (x, z, length, color) => {
        // A car on the centre is its own twin; anything else is mirrored.
        const put =
          x === 0 && z === 0
            ? (...args) => a.box(...args)
            : (...args) => pair(a, ...args);
        put(x, 1.65, z, length, 2.7, 3, color);
        put(x, 3.06, z, length + 0.1, 0.12, 3.1, DARK, false);
        for (const end of [-1, 1])
          for (const side of [-1, 1])
            put(
              x + end * (length / 2 - 1.2),
              0.25,
              z + side * 0.72,
              1.2,
              0.4,
              0.2,
              DARK,
              false,
            );
        // Ribbing along the sides.
        for (let i = -length / 2 + 1; i < length / 2; i += 1.5)
          for (const side of [-1, 1])
            put(x + i, 1.65, z + side * 1.52, 0.08, 2.5, 0.06, DARK, false);
      };
      boxcar(-15, -8, 10, cars[0]);
      boxcar(8, -8, 12, cars[1]);
      boxcar(-17, 0, 6, cars[2]);
      boxcar(0, 0, 8, cars[0]);
      // Signal huts by the south and north walls.
      pair(a, -5, 1.75, -12.5, 4, 3.5, 3, concrete);
      pair(a, -5, 3.56, -12.5, 4.4, 0.12, 3.4, DARK, false);
      // Low freight crates as mid-lane cover.
      for (const [x, z] of [
        [-21, -4],
        [-9, 4],
        [-3, -4],
        [-12, 12],
        [14, -12],
      ])
        pair(a, x, 0.6, z, 2, 1.2, 1.8, [0.55, 0.5, 0.34]);
      // Overhead signal gantries and lamp posts.
      for (const x of [-10, 10]) {
        a.box(x, 3.4, -14.2, 0.3, 6.8, 0.3, DARK, false);
        a.box(x, 3.4, 14.2, 0.3, 6.8, 0.3, DARK, false);
        a.box(x, 6.7, 0, 0.4, 0.4, 28.4, steel, false);
        for (const z of [-8, 0, 8])
          a.box(x, 6.2, z, 0.5, 0.7, 0.4, [0.86, 0.75, 0.3], false);
      }
      spawnColumns(a, 27, [-12, -6, 0, 6, 12], 26);
      // Distant warehouses beyond the walls.
      for (let i = 0; i < 12; i++)
        a.box(
          -36 + i * 6.5,
          3 + (i % 2),
          22,
          5,
          6 + 2 * (i % 3),
          6,
          [0.4, 0.38, 0.36],
          false,
        );
    },
  },
  {
    id: "foundry",
    name: "Foundry",
    tagline: "Rooms, doorways and corners: close quarters",
    description:
      "A gutted steel foundry. Short sightlines, tight doorways and a central casting hall make every corner a duel.",
    summary:
      "a walled casting hall in the centre with four doorways, ringed by work rooms and two long corridors",
    bounds: { w: 40, d: 40 },
    build(a) {
      const floor = [0.42, 0.41, 0.39],
        brick = [0.52, 0.33, 0.26],
        plate = [0.4, 0.42, 0.41],
        ember = [0.98, 0.55, 0.2];
      enclose(a, 40, 40, floor, brick, 5);
      // Central casting hall: 12 m square with a 4 m doorway in each side.
      wall(a, -6, -6, -6, -2, plate);
      wall(a, -6, 2, -6, 6, plate);
      wall(a, -6, -6, -2, -6, plate);
      wall(a, 2, -6, 6, -6, plate);
      // West and east building lines with two doorways each toward the spawn.
      wall(a, -12, -18, -12, -8, brick);
      wall(a, -12, -4, -12, 4, brick);
      wall(a, -12, 8, -12, 20, brick);
      // Corridor walls split off long north and south passages.
      wall(a, -8, -12, 4, -12, brick);
      // Short partitions make work rooms between the hall and the building lines.
      wall(a, -12, 8, -8, 8, brick);
      wall(a, 6, 8, 6, 12, plate);
      // Casting mould in the hall: waist-high cover.
      a.box(0, 0.55, 0, 2, 1.1, 2, [0.3, 0.3, 0.3]);
      a.box(0, 1.12, 0, 1.6, 0.04, 1.6, ember, false);
      // Furnaces with glowing mouths, and pillars along the corridors.
      pair(a, -9, 1.6, 16, 3, 3.2, 3, [0.33, 0.3, 0.29]);
      pair(a, -9, 1.2, 14.45, 1.6, 1, 0.08, ember, false);
      for (const x of [-4, 6]) {
        pair(a, x, 2.5, -16, 0.8, 5, 0.8, plate);
      }
      // Crates and steel billets for cover inside the rooms.
      for (const [x, z, w, d] of [
        [-9, -2, 1.6, 1.6],
        [-16, -10, 2, 1.4],
        [-16, 10, 1.4, 2],
        [3, -9, 2.4, 1.2],
        [-3, 9, 1.2, 2.4],
      ])
        pair(a, x, 0.55, z, w, 1.1, d, [0.5, 0.45, 0.3]);
      // Overhead crane rails and roof trusses (decoration only).
      for (const x of [-14, -4, 4, 14])
        a.box(x, 6.2, 0, 0.35, 0.5, 40, [0.3, 0.32, 0.32], false);
      for (const z of [-15, -5, 5, 15])
        a.box(0, 6.6, z, 40, 0.25, 0.25, DARK, false);
      a.box(0, 5.4, 3, 3, 0.5, 1.5, [0.85, 0.65, 0.2], false);
      // Spawns line up with the two doorways and the long corridors, not the blank wall.
      spawnColumns(a, 17, [-16, -12, -6, 6, 14], 34);
      // Chimney stacks behind the walls.
      for (const [x, z] of [
        [-26, -14],
        [-24, 10],
        [26, 14],
        [24, -10],
      ])
        a.box(x, 9, z, 2.5, 18, 2.5, [0.45, 0.3, 0.25], false);
    },
  },
  {
    id: "quarry",
    name: "Quarry",
    tagline: "Rock pillars and raised ledges: mid-range",
    description:
      "An open-cut stone quarry. Use the pillars to break sightlines and jump onto the ledges for height.",
    summary:
      "tall rock pillars spread over an open quarry floor, with low ledges you can jump onto and boulders for cover",
    bounds: { w: 52, d: 40 },
    build(a) {
      const dust = [0.66, 0.62, 0.54],
        cliff = [0.56, 0.52, 0.46],
        rock = [
          [0.58, 0.55, 0.5],
          [0.5, 0.48, 0.45],
          [0.63, 0.58, 0.5],
        ],
        ledge = [0.6, 0.53, 0.42];
      enclose(a, 52, 40, dust, cliff, 6);
      // Pillars are stacked blocks, narrower toward the top, for a carved look.
      const pillar = (x, z, w, d, h, color) => {
        pair(a, x, h * 0.3, z, w, h * 0.6, d, color);
        pair(a, x + 0.2, h * 0.8, z - 0.15, w * 0.8, h * 0.4, d * 0.8, rock[1]);
      };
      pillar(-10, -8, 4, 5, 6, rock[0]);
      pillar(0, -12, 5, 3, 5, rock[2]);
      pillar(-18, 10, 3, 4, 7, rock[0]);
      pillar(-4, 13, 3, 3, 4.5, rock[2]);
      // Ledges are 0.8 m high: a jump gets you on top.
      for (const [x, z, w, d] of [
        [-4, 4, 6, 3],
        [-16, -4, 4, 6],
        [-11, 16, 5, 2.5],
      ]) {
        pair(a, x, 0.4, z, w, 0.8, d, ledge);
        pair(a, x, 0.81, z, w - 0.2, 0.02, d - 0.2, [0.7, 0.64, 0.52], false);
      }
      // Boulders: chest-high cover.
      for (const [x, z, s] of [
        [-20, -12, 1.6],
        [-6, -3, 1.4],
        [-13, 3, 1.2],
        [-2, -17, 1.5],
      ])
        pair(a, x, s * 0.45, z, s, s * 0.9, s * 1.1, rock[1]);
      // Rusted drilling rig in the middle (frame decorative, base solid).
      a.box(0, 0.5, 0, 2.4, 1, 2.4, [0.55, 0.36, 0.22]);
      for (const [x, z] of [
        [-1, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
      ])
        a.box(x, 3.5, z, 0.15, 5, 0.15, [0.55, 0.36, 0.22], false);
      a.box(0, 6, 0, 2.4, 0.2, 2.4, DARK, false);
      // Rock strata on the cliff walls.
      for (const s of [-1, 1])
        for (const y of [1.5, 3.6])
          a.box(0, y, s * 19.95, 52, 0.25, 0.2, [0.48, 0.44, 0.38], false);
      spawnColumns(a, 22, [-14, -7, 0, 7, 14], 32);
      // Terraced quarry rim beyond the walls.
      for (let i = 0; i < 4; i++)
        for (const s of [-1, 1])
          a.box(
            0,
            6 + i * 2,
            s * (23 + i * 3),
            64 + i * 8,
            2,
            3,
            i % 2 ? cliff : rock[1],
            false,
          );
    },
  },
]);

export const DEFAULT_TDM_MAP = "yard";
export function tdmMap(id) {
  return TDM_MAPS.find((m) => m.id === id) || TDM_MAPS[0];
}

// Top-down overview of a built TDM arena in the setup screen's map-art style.
export function tdmOverview(arena, id = "") {
  const map = tdmMap(arena.mapId),
    { w, d } = map.bounds;
  const r = (v) => Math.round(v * 100) / 100;
  let solids = "",
    crates = "";
  for (const b of arena.solids) {
    // Only ground-standing boxes: stacked upper blocks would draw as duplicate outlines.
    if (b.edge || b.y + b.h / 2 < 0.2 || b.y - b.h / 2 > 0.5 || b.w >= w)
      continue;
    const rect = `<rect x="${r(b.x - b.w / 2)}" y="${r(b.z - b.d / 2)}" width="${r(b.w)}" height="${r(b.d)}"/>`;
    if (b.y + b.h / 2 >= 2) solids += rect;
    else crates += rect;
  }
  const teams = arena.spawns
    .map((points, t) => {
      const cls = t ? "team-b" : "team-a",
        x = points[0].x,
        zs = points.map((p) => p.z),
        top = Math.min(...zs) - 1.5,
        bottom = Math.max(...zs) + 1.5;
      return `<rect class="${cls}" x="${r(x - 0.8)}" y="${r(top)}" width="1.6" height="${r(bottom - top)}" rx="0.4"/><text class="${cls}" x="${x}" y="${r(top - 1.1)}"${t ? ' text-anchor="end"' : ""}>${t ? "Ember" : "Cyan"}</text>`;
    })
    .join("");
  // A 5 m map grid, lettered west to east and numbered north to south, like a briefing map.
  const GRID = 5;
  let grid = "",
    labels = "";
  for (let i = 0, x = -w / 2; x <= w / 2 + 1e-6; i++, x += GRID) {
    grid += `<line x1="${r(x)}" y1="${r(-d / 2)}" x2="${r(x)}" y2="${r(d / 2)}"/>`;
    if (x + GRID <= w / 2 + 1e-6)
      labels += `<text x="${r(x + GRID / 2)}" y="${r(d / 2 + 1.5)}" text-anchor="middle">${String.fromCharCode(65 + i)}</text>`;
  }
  for (let i = 0, z = -d / 2; z <= d / 2 + 1e-6; i++, z += GRID) {
    grid += `<line x1="${r(-w / 2)}" y1="${r(z)}" x2="${r(w / 2)}" y2="${r(z)}"/>`;
    if (z + GRID <= d / 2 + 1e-6)
      labels += `<text x="${r(-w / 2 - 0.7)}" y="${r(z + GRID / 2 + 0.45)}" text-anchor="end">${i + 1}</text>`;
  }
  const label = `${map.name}: ${map.summary}. Cyan spawns on the west edge, Ember on the east. Grid squares are ${GRID} m.`;
  return `<svg${id ? ` id="${id}"` : ""} viewBox="${-w / 2 - 2.6} ${-d / 2 - 3} ${w + 3.6} ${d + 5.4}" role="img" aria-label="${label}"><rect class="floor" x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}"/><g class="grid">${grid}</g><g class="grid-label">${labels}</g><g class="solid">${solids}</g><g class="crate">${crates}</g>${teams}</svg>`;
}
