// Every Team Deathmatch map must be fair, navigable by bots and actually playable.
import test from "node:test";
import assert from "node:assert/strict";
import { OfflineSimulation } from "../src/game.js";
import { Arena, NavigationSystem } from "../src/world.js";
import { TDM_MAPS, tdmMap, tdmOverview } from "../src/maps/tdm-maps.js";

const near = (a, b) => Math.abs(a - b) < 1e-6;

test("map registry falls back to Yard 07 and every id is unique", () => {
  assert.equal(tdmMap("nope").id, "yard");
  assert.equal(new Set(TDM_MAPS.map((m) => m.id)).size, TDM_MAPS.length);
  assert.ok(TDM_MAPS.length >= 4);
  assert.equal(new Arena("conquest", "railcut").mapId, "outpost");
});

for (const map of TDM_MAPS)
  test(`${map.name}: fair, enclosed, navigable spawns`, () => {
    const arena = new Arena("tdm", map.id);
    assert.equal(arena.name, map.name);
    // Five clear spawns per team, mirrored across the centre.
    assert.deepEqual(
      arena.spawns.map((s) => s.length),
      [5, 5],
    );
    for (const team of arena.spawns)
      for (const p of team) {
        assert.equal(arena.blocked(p.x, p.z, 0.6), false, JSON.stringify(p));
        assert.ok(
          Math.abs(p.x) < map.bounds.w / 2 && Math.abs(p.z) < map.bounds.d / 2,
        );
      }
    for (const p of arena.spawns[0])
      assert.ok(
        arena.spawns[1].some((q) => near(q.x, -p.x) && near(q.z, -p.z)),
      );
    // Point symmetry: every solid has a twin at (-x, -z).
    for (const b of arena.solids)
      assert.ok(
        arena.solids.some(
          (o) =>
            near(o.x, -b.x) &&
            near(o.z, -b.z) &&
            near(o.y, b.y) &&
            near(o.w, b.w) &&
            near(o.d, b.d) &&
            near(o.h, b.h),
        ),
        "unmirrored solid " + JSON.stringify(b),
      );
    // No way out: points just beyond the playable floor are walled off.
    for (const [x, z] of [
      [map.bounds.w / 2 + 0.4, 0],
      [-map.bounds.w / 2 - 0.4, 0],
      [0, map.bounds.d / 2 + 0.4],
      [0, -map.bounds.d / 2 - 0.4],
    ])
      assert.ok(arena.blocked(x, z, 0.1), `edge ${x},${z}`);
    // Bots can walk from every spawn to every enemy spawn without stepping through walls.
    const nav = new NavigationSystem(arena);
    assert.ok(nav.nodes.length > 80);
    for (const a of arena.spawns[0])
      for (const b of arena.spawns[1]) {
        const path = nav.path(a, b);
        assert.ok(path.length > 5, `${map.id} path ${a.z} -> ${b.z}`);
        for (let i = 1; i < path.length; i++) {
          const p = path[i - 1],
            q = path[i];
          assert.equal(
            arena.blocked((p.x + q.x) / 2, (p.z + q.z) / 2, 0.3),
            false,
          );
        }
      }
    // The overview draws the cover but not the perimeter.
    const svg = tdmOverview(arena, "mapOverview");
    assert.match(svg, /^<svg id="mapOverview"/);
    assert.ok((svg.match(/<rect/g) || []).length > 6);
  });

for (const map of TDM_MAPS)
  test(`${map.name}: a bot-only match produces fights on both sides`, () => {
    let seed = 7;
    const game = new OfflineSimulation(
      { keys: new Set(), actions: new Set(), consume: () => false, clear() {} },
      { play() {} },
      () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
      { map: map.id, humanControllers: new Map() },
    );
    assert.equal(game.mapId, map.id);
    game.start("hard");
    for (let i = 0; i < 120 * 60 && game.match.state === "playing"; i++)
      game.update(1 / 60);
    const kills = [0, 1].map((t) =>
      game.actors.filter((a) => a.team === t).reduce((n, a) => n + a.kills, 0),
    );
    assert.ok(kills[0] > 0 && kills[1] > 0, `${map.id} kills ${kills}`);
    for (const a of game.actors) {
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
      assert.ok(
        Math.abs(a.x) < map.bounds.w / 2 && Math.abs(a.z) < map.bounds.d / 2,
      );
    }
  });
