// Deterministic headless simulation regressions. Seeded randomness and muted audio isolate game rules from browser timing.
import test from "node:test";
import assert from "node:assert/strict";
import { OfflineSimulation } from "../src/game.js";
import { MatchManager, TDM_RULES } from "../src/match.js";
import { Arena, NavigationSystem } from "../src/world.js";
import { WEAPONS, EffectPool } from "../src/weapons.js";
import { rayBox } from "../src/math.js";
import { QualityManager } from "../src/settings.js";
// Reset a seeded simulation and lightweight input adapter for each independent rule test.
function setup() {
  let seed = 42;
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
    consume(k) {
      let result = this.actions.has(k);
      this.actions.delete(k);
      return result;
    },
    clear() {
      this.actions.clear();
      this.fire = false;
    },
  };
  const game = new OfflineSimulation(
    input,
    { play() {} },
    () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
  );
  game.start("normal");
  return { game, input };
}
// Remove other actors and place one opposing pair in a clear lane for unambiguous hitscan assertions.
function isolate(game) {
  for (const a of game.actors) a.alive = false;
  for (const i of [0, 5]) {
    game.spawns.spawn(game.actors[i]);
    game.actors[i].shield = 0;
  }
  const p = game.player,
    e = game.actors[5];
  Object.assign(p, {
    x: -5,
    z: -15,
    y: 0,
    yaw: Math.PI / 2,
    pitch: 0,
    cooldown: 0,
  });
  Object.assign(e, { x: 5, z: -15, y: 0 });
  return { p, e };
}
// Lock down roster and default rules so UI, bots, and scoring agree on match structure.
test("5v5 roster and regulation settings", () => {
  const { game } = setup();
  assert.equal(game.actors.filter((a) => a.team === 0).length, 5);
  assert.equal(game.actors.filter((a) => a.team === 1).length, 5);
  assert.deepEqual(TDM_RULES, {
    teamSize: 5,
    target: 30,
    duration: 420,
    respawn: 3,
  });
});
// Exercise degenerate rays explicitly: division by zero and inside origins are common collision edge cases.
test("raycasts handle parallel rays, inside origins and occluders", () => {
  const b = { x: 0, y: 1, z: 0, w: 2, h: 2, d: 2 };
  assert.equal(rayBox([-4, 1, 0], [1, 0, 0], b), 3);
  assert.equal(rayBox([-4, 4, 0], [1, 0, 0], b), Infinity);
  assert.equal(rayBox([0, 1, 0], [1, 0, 0], b), 0);
});
// Repeated lethal shots must count once, then the actor becomes available exactly at respawn time.
test("hitscan kills, gives one point, prevents repeated death, respawns at 3 seconds", () => {
  const { game } = setup(),
    { p, e } = isolate(game);
  for (let i = 0; i < 4; i++) {
    p.cooldown = 0;
    game.weapons.fire(p, Math.PI / 2, 0, 0);
  }
  assert.equal(e.alive, false);
  assert.equal(e.respawn, 3);
  assert.equal(p.kills, 1);
  assert.equal(game.match.scores[0], 1);
  assert.equal(game.damage.apply(e, 100, p), false);
  game.bots.update = () => {};
  for (let i = 0; i < 179; i++) game.update(1 / 60);
  assert.equal(e.alive, false);
  game.update(1 / 60);
  game.update(1 / 60);
  assert.equal(e.alive, true);
  assert.equal(e.hp, 100);
  assert.equal(e.ammo[0].mag, 30);
});
// Protection rules must prevent both HP changes and score side effects.
test("friendly fire and spawn protection cannot damage or score", () => {
  const { game } = setup(),
    { p, e } = isolate(game);
  e.team = p.team;
  assert.equal(game.damage.apply(e, 100, p), false);
  e.team = 1;
  e.shield = 1;
  assert.equal(game.damage.apply(e, 100, p), false);
  assert.equal(e.hp, 100);
  assert.deepEqual(game.match.scores, [0, 0]);
});
// Place solid cover between the pair to distinguish geometric obstruction from aim error.
test("map cover stops hitscan", () => {
  const { game } = setup(),
    { p, e } = isolate(game);
  Object.assign(p, { x: -5, z: 0 });
  Object.assign(e, { x: 5, z: 0 });
  game.weapons.fire(p, Math.PI / 2, 0, 0);
  assert.equal(e.hp, 100);
});
// Validate conservation of total ammunition for full, partial, and exhausted reserves on every weapon.
test("magazines, reserves and reload conservation for every weapon", () => {
  for (let index = 0; index < WEAPONS.length; index++) {
    const { game } = setup();
    const p = game.player,
      w = WEAPONS[index];
    game.weapons.equip(p, index);
    p.ammo[index].mag = 0;
    game.weapons.reload(p);
    game.weapons.update(p, w.reload - 0.01);
    assert.equal(p.ammo[index].mag, 0);
    game.weapons.update(p, 0.02);
    assert.equal(p.ammo[index].mag, w.magazine);
    assert.equal(p.ammo[index].reserve, w.reserve - w.magazine);
    p.ammo[index] = { mag: 0, reserve: 3 };
    game.weapons.reload(p);
    game.weapons.update(p, w.reload + 0.01);
    assert.deepEqual(p.ammo[index], { mag: 3, reserve: 0 });
  }
});
// Separate edge-triggered semi-auto fire from held automatic input.
test("pistol requires another press; automatic weapon repeats", () => {
  const { game, input } = setup(),
    p = game.player;
  game.bots.update = () => {};
  game.weapons.equip(p, 2);
  p.cooldown = 0;
  input.fire = true;
  input.actions.add("fire");
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.equal(p.ammo[2].mag, 11);
  input.actions.add("fire");
  game.update(1 / 60);
  assert.equal(p.ammo[2].mag, 10);
  game.weapons.equip(p, 0);
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.ok(p.ammo[0].mag < 27);
});
// Cancelling a reload cannot transfer rounds into another weapon or finish the abandoned reload.
test("weapon switching cancels reload and does not transfer ammo", () => {
  const { game } = setup(),
    p = game.player;
  p.ammo[0].mag = 2;
  game.weapons.reload(p);
  game.weapons.equip(p, 1);
  game.weapons.update(p, 5);
  assert.equal(p.reload, 0);
  assert.equal(p.ammo[0].mag, 2);
  assert.equal(p.ammo[1].mag, 30);
});
// Verify displacement and stance against arena collision with bot interference disabled.
test("walking, sprinting, crouching, jumping and solid collision", () => {
  const { game, input } = setup(),
    p = game.player;
  game.bots.update = () => {};
  Object.assign(p, { x: -5, z: -15, yaw: 0 });
  input.keys.add("KeyW");
  game.update(1 / 60);
  assert.ok(p.z < -15);
  input.keys.clear();
  input.actions.add("Space");
  for (let i = 0; i < 10; i++) game.update(1 / 60);
  assert.ok(p.y > 0.5);
  for (let i = 0; i < 80; i++) game.update(1 / 60);
  assert.equal(p.y, 0);
  input.keys.add("KeyC");
  game.update(1 / 60);
  assert.equal(p.crouched, true);
  Object.assign(p, { x: -2.1, z: 0 });
  game.arena.move(p, 1, 0);
  assert.equal(p.x, -2.1);
});
// Check all match termination paths plus paused time and restart reset semantics.
test("scoring, timer, ties, pause and instant restart", () => {
  const m = new MatchManager();
  m.start();
  for (let i = 0; i < 30; i++) m.kill(1);
  assert.equal(m.state, "ended");
  assert.equal(m.winner, 1);
  m.kill(0);
  assert.deepEqual(m.scores, [0, 30]);
  m.start();
  m.kill(0);
  m.state = "paused";
  m.update(500);
  assert.equal(m.remaining, 420);
  m.state = "playing";
  m.update(420);
  assert.equal(m.winner, 0);
  m.start();
  m.update(420);
  assert.equal(m.winner, null);
  m.start();
  assert.equal(m.remaining, 420);
  assert.deepEqual(m.scores, [0, 0]);
});
// Ensure each team can reach the opposing side and repeated queries reuse the cached path.
test("all spawns have cached routes across the map", () => {
  const arena = new Arena(),
    nav = new NavigationSystem(arena);
  for (const a of arena.spawns[0])
    for (const b of arena.spawns[1]) {
      const path = nav.path(a, b);
      assert.ok(path.length > 0);
      assert.strictEqual(path, nav.path(a, b));
      for (const n of path) assert.equal(arena.blocked(n.x, n.z, 0.6), false);
    }
  assert.ok(nav.cache.size <= 256);
});
// Seeded full matches catch integration failures that isolated damage tests cannot expose.
test("three complete seeded bot matches finish with kills and valid totals", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    const { game } = setup();
    game.bots.difficulty = difficulty;
    game.controller.update = (dt) => game.bots.update(game.player, dt);
    for (let tick = 0; tick < 25201 && game.match.state === "playing"; tick++)
      game.update(1 / 60);
    assert.equal(game.match.state, "ended", difficulty);
    assert.ok(game.match.scores[0] + game.match.scores[1] > 20, difficulty);
    assert.equal(
      game.actors.reduce((sum, a) => sum + a.kills, 0),
      game.match.scores[0] + game.match.scores[1],
    );
    assert.equal(
      game.actors.reduce((sum, a) => sum + a.deaths, 0),
      game.match.scores[0] + game.match.scores[1],
    );
    assert.ok(game.nav.cache.size <= 256);
    game.start(difficulty);
    assert.equal(game.player.kills, 0);
    assert.equal(game.player.hp, 100);
  }
});
// Stress the ring buffer and check the transport representation stays compact.
test("fixed-size effects and compact transport snapshot", () => {
  const pool = new EffectPool();
  for (let i = 0; i < 5000; i++) pool.add(i, 0, 0);
  assert.equal(pool.items.length, 48);
  pool.update(1);
  assert.ok(pool.items.every((e) => e.life === 0));
  const { game } = setup();
  assert.equal(game.snapshot().actors.length, 10);
  assert.ok(JSON.stringify(game.snapshot()).length < 800);
});
// Feed synthetic frame timing to quality adaptation without depending on the test machine speed.
test("sustained slow frames reduce only rendering quality", () => {
  const settings = { values: { quality: "high", autoQuality: true } },
    q = new QualityManager(settings);
  for (let i = 0; i < 200; i++) q.update(1 / 25);
  assert.ok(q.scale < 1.15);
  assert.ok(q.effects < 48);
  settings.values.autoQuality = false;
  const scale = q.scale;
  for (let i = 0; i < 200; i++) q.update(1 / 20);
  assert.equal(q.scale, scale);
});

// Camera rotation must remain independent of movement, with reduced sensitivity while aiming.
test("mouse deltas control yaw/pitch independently of movement and ADS slows aim", () => {
  const { game, input } = setup();
  game.bots.update = () => {};
  const p = game.player;
  input.dx = 100;
  input.dy = 40;
  const yaw = p.yaw;
  game.update(1 / 60);
  assert.ok(Math.abs(p.yaw - yaw - 0.24) < 1e-8);
  assert.ok(p.pitch < 0);
  assert.equal(input.dx, 0);
  assert.equal(input.dy, 0);
  input.aim = true;
  game.update(1 / 60);
  const aimed = p.yaw;
  input.dx = 100;
  game.update(1 / 60);
  assert.ok(Math.abs(p.yaw - aimed - 0.156) < 1e-8);
});
// Freeze the entry direction through a slide and verify jump cancellation exits into a hop.
test("sprint crouch starts directional slide; jump cancels and restores standing", () => {
  const { game, input } = setup();
  game.bots.update = () => {};
  const p = game.player;
  Object.assign(p, { x: -10, z: -15, yaw: Math.PI / 2 });
  input.keys.add("KeyW");
  input.keys.add("ShiftLeft");
  game.update(1 / 60);
  assert.equal(p.sprinting, true);
  input.keys.add("KeyC");
  game.update(1 / 60);
  assert.equal(p.sliding, true);
  assert.equal(p.crouched, true);
  const x = p.x,
    z = p.z;
  input.dx = 400;
  game.update(1 / 60);
  assert.ok(p.x > x);
  assert.ok(Math.abs(p.z - z) < 0.01);
  input.actions.add("Space");
  game.update(1 / 60);
  assert.equal(p.sliding, false);
  assert.equal(p.crouched, false);
  assert.ok(p.y > 0);
  assert.ok(p.slideCooldown > 0);
  assert.ok(p.fireDelay > 0);
});
// Cover slide prerequisites, expiry, collision, and reset to prevent persistent movement-state bugs.
test("slide needs sprint, expires, respects collision and resets on respawn", () => {
  const { game, input } = setup();
  game.bots.update = () => {};
  const p = game.player;
  Object.assign(p, { x: -10, z: -15, yaw: Math.PI / 2 });
  input.keys.add("KeyC");
  game.update(1 / 60);
  assert.equal(p.sliding, false);
  input.keys.clear();
  game.update(1 / 60);
  input.keys.add("KeyW");
  input.keys.add("ShiftLeft");
  game.update(1 / 60);
  input.keys.add("KeyC");
  game.update(1 / 60);
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.equal(p.sliding, false);
  assert.equal(p.crouched, true); // Holding crouch never starts another slide.
  game.spawns.spawn(p);
  assert.equal(p.slideCooldown, 0);
  assert.equal(p.sliding, false);
  input.keys.clear();
  Object.assign(p, { x: -2.11, z: 0, yaw: Math.PI / 2 });
  input.keys.add("KeyW");
  input.keys.add("ShiftLeft");
  game.update(1 / 60);
  input.keys.add("KeyC");
  game.update(1 / 60);
  for (let i = 0; i < 10; i++) game.update(1 / 60);
  assert.ok(p.x < -2.05);
  assert.equal(p.sliding, false);
});
// A low ceiling must prevent a jump-cancel from expanding the actor through solid geometry.
test("slide cancellation cannot stand up through a low ceiling", () => {
  const { game, input } = setup();
  game.bots.update = () => {};
  const p = game.player;
  Object.assign(p, { x: -10, z: -15, yaw: Math.PI / 2 });
  input.keys.add("KeyW");
  input.keys.add("ShiftLeft");
  game.update(1 / 60);
  input.keys.add("KeyC");
  game.update(1 / 60);
  game.arena.box(p.x, 1.55, p.z, 3, 0.3, 3, [0.5, 0.5, 0.5]);
  input.actions.add("Space");
  game.update(1 / 60);
  assert.equal(p.sliding, true);
  assert.equal(p.crouched, true);
  assert.equal(p.y, 0);
});

// Input recorded while dead must not execute automatically on the first living tick.
test("dead player input is cleared before respawn", () => {
  const { game, input } = setup();
  game.player.alive = false;
  game.player.respawn = 0.01;
  input.actions.add("fire");
  input.actions.add("KeyR");
  input.fire = true;
  game.update(1 / 60);
  assert.equal(game.player.alive, true);
  assert.equal(input.fire, false);
  assert.equal(input.actions.size, 0);
});

// Iterate the complete arsenal to catch new weapons missing from spawn, fire, or cycling logic.
test("starting weapon, respawn, and selection cover the full arsenal", () => {
  const { game, input } = setup();
  for (let index = 0; index < WEAPONS.length; index++) {
    game.start("normal", index);
    assert.equal(game.player.weapon, index);
    game.spawns.spawn(game.player);
    assert.equal(game.player.weapon, index);
    assert.equal(game.player.ammo[index].mag, WEAPONS[index].magazine);
    game.player.cooldown = 0;
    assert.equal(game.weapons.fire(game.player), true);
    assert.equal(game.player.ammo[index].mag, WEAPONS[index].magazine - 1);
    input.actions.add("switch");
    game.controller.update(1 / 60, 1);
    assert.equal(game.player.weapon, (index + 1) % WEAPONS.length);
  }
  game.start("normal", NaN);
  assert.equal(game.player.weapon, 0);
  game.weapons.equip(game.player, 1.5);
  assert.equal(game.player.weapon, 0);
});
