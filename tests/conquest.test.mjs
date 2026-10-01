import test from "node:test";
import assert from "node:assert/strict";
import { OfflineSimulation } from "../src/game.js";
import { Arena, NavigationSystem } from "../src/world.js";
import { ConquestMatch } from "../src/conquest.js";

function setup() {
  let seed = 123;
  const input = {
    keys: new Set(),
    actions: new Set(),
    dx: 0,
    dy: 0,
    moveX: 0,
    moveY: 0,
    fire: false,
    aim: false,
    touch: false,
    consume() {
      return false;
    },
    clear() {},
  };
  const game = new OfflineSimulation(
    input,
    { play() {} },
    () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
    { mode: "conquest" },
  );
  game.start("normal");
  return game;
}
function presence(sector, team) {
  return { ...sector, team, y: 0, alive: true };
}
const clear = { visible: () => true };
function tick(match, seconds, actors, arena = clear) {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    match.updateObjectives(1 / 60, actors, arena);
}

test("imported internet map has clear bases and connected objective routes", () => {
  const arena = new Arena("conquest"),
    nav = new NavigationSystem(arena);
  assert.equal(arena.map.license, "BSD-3-Clause");
  assert.equal(nav.nodes.length, 1015);
  assert.ok(
    arena.boxes.length < 300,
    "row batching bounds draw/collision geometry",
  );
  for (const spawn of arena.spawns.flat()) {
    assert.equal(arena.blocked(spawn.x, spawn.z, 0.6), false);
    for (const s of arena.sectors) {
      assert.ok(nav.path(spawn, s).length > 0);
      assert.ok(
        Math.hypot(spawn.x - s.x, spawn.z - s.z) > s.radius,
        "bases stay outside capture zones",
      );
    }
  }
  for (const s of arena.sectors)
    assert.equal(arena.blocked(s.x, s.z, 0.6), false);
  const seen = new Set([0]),
    queue = [0];
  for (let i = 0; i < queue.length; i++)
    for (const n of nav.nodes[queue[i]].links)
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  assert.equal(seen.size, nav.nodes.length);
});

test("neutral capture, contest, neutralization and enemy capture have distinct phases", () => {
  const m = new ConquestMatch([{ id: "A", x: 0, z: 0, radius: 3.2 }]);
  m.start();
  const s = m.sectors[0],
    cyan = presence(s, 0),
    ember = presence(s, 1);
  tick(m, 4, [cyan]);
  assert.ok(Math.abs(s.progress - 0.5) < 1e-9);
  tick(m, 3, [cyan, ember]);
  assert.equal(s.contested, true);
  assert.ok(Math.abs(s.progress - 0.5) < 1e-9);
  tick(m, 4, [cyan]);
  assert.equal(s.owner, 0);
  tick(m, 5, [ember]);
  assert.equal(s.owner, null);
  tick(m, 7, [ember]);
  assert.equal(s.owner, null);
  tick(m, 1, [ember]);
  assert.equal(s.owner, 1);
});

test("dead, distant, elevated and occluded actors cannot capture; empty progress decays", () => {
  const m = new ConquestMatch([{ id: "A", x: 0, z: 0, radius: 3.2 }]);
  m.start();
  const s = m.sectors[0];
  tick(m, 8, [
    { ...presence(s, 0), alive: false },
    { ...presence(s, 0), x: 10 },
    { ...presence(s, 0), y: 4 },
  ]);
  tick(m, 8, [presence(s, 0)], { visible: () => false });
  assert.equal(s.owner, null);
  assert.equal(s.progress, 0);
  tick(m, 4, [presence(s, 0)]);
  tick(m, 4, []);
  assert.equal(s.owner, null);
  assert.equal(s.capturing, null);
});

test("sector advantage bleeds tickets; kills drain victim tickets; zero and timeout decide winners", () => {
  const game = setup(),
    m = game.match;
  m.sectors[0].owner = m.sectors[1].owner = 0;
  m.sectors[2].owner = 1;
  tick(m, 2, []);
  assert.deepEqual(m.scores, [150, 149]);
  m.kill(1);
  assert.deepEqual(m.scores, [149, 149]);
  m.scores = [1, 9];
  m.kill(1);
  assert.equal(m.state, "ended");
  assert.equal(m.winner, 1);
  m.start();
  m.scores = [20, 12];
  m.update(m.remaining);
  assert.equal(m.winner, 0);
  m.start();
  m.update(m.remaining);
  assert.equal(m.winner, null);
});

test("equal sector counts do not bleed; pause freezes all progress and tickets; restart resets objectives", () => {
  const game = setup(),
    m = game.match;
  m.sectors[0].owner = 0;
  m.sectors[1].owner = 1;
  tick(m, 6, []);
  assert.deepEqual(m.scores, [150, 150]);
  tick(m, 4, [presence(m.sectors[2], 0)]);
  const before = JSON.stringify(game.snapshot());
  m.state = "paused";
  game.update(5);
  m.updateObjectives(5, [presence(m.sectors[2], 0)], clear);
  m.kill(0);
  assert.equal(JSON.stringify(game.snapshot()), before);
  game.start("normal");
  assert.deepEqual(m.scores, [150, 150]);
  assert.ok(
    m.sectors.every(
      (s) => s.owner === null && s.progress === 0 && !s.contested,
    ),
  );
});

test("both teams' bots capture sectors and a complete Conquest match resolves", () => {
  const game = setup();
  game.controller.update = (dt) => game.bots.update(game.player, dt);
  const owners = new Set();
  let ticks = 0;
  while (game.match.state === "playing" && ticks++ < 60 * 430) {
    game.update(1 / 60);
    for (const s of game.match.sectors)
      if (s.owner !== null) owners.add(s.owner);
  }
  assert.deepEqual([...owners].sort(), [0, 1]);
  assert.equal(game.match.state, "ended");
  assert.ok(game.match.scores.some((s) => s < 150));
  assert.ok(game.actors.some((a) => a.kills > 0));
  assert.ok(game.nav.cache.size <= 256);
});
