// Deterministic headless simulation regressions. Seeded randomness and muted audio isolate game rules from browser timing.
import test from "node:test";
import assert from "node:assert/strict";
import { OfflineSimulation } from "../src/game.js";
import { MatchManager, TDM_RULES } from "../src/match.js";
import { Arena, NavigationSystem } from "../src/world.js";
import { WEAPONS, EffectPool } from "../src/weapons.js";
import { rayBox } from "../src/math.js";
import { QualityManager } from "../src/settings.js";
import { CLASS_IDS, LOADOUTS, classForWeapon } from "../src/loadouts.js";
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
    game.start("normal", index);
    const p = game.player,
      w = WEAPONS[index];
    p.ammo[index].mag = 0;
    game.weapons.reload(p);
    // An empty magazine uses the longer empty reload.
    game.weapons.update(p, w.reloadEmpty - 0.01);
    assert.equal(p.ammo[index].mag, 0);
    game.weapons.update(p, 0.02);
    assert.equal(p.ammo[index].mag, w.magazine);
    assert.equal(p.ammo[index].reserve, w.reserve - w.magazine);
    p.ammo[index] = { mag: 0, reserve: 3 };
    game.weapons.reload(p);
    game.weapons.update(p, w.reloadEmpty + 0.01);
    assert.deepEqual(p.ammo[index], { mag: 3, reserve: 0 });
    // A partial magazine skips the chambering action.
    p.ammo[index] = { mag: 1, reserve: w.magazine };
    game.weapons.reload(p);
    assert.equal(p.reload, w.reload);
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
  game.weapons.equip(p, 2);
  game.weapons.update(p, 5);
  assert.equal(p.reload, 0);
  assert.equal(p.ammo[0].mag, 2);
  assert.equal(p.ammo[2].mag, WEAPONS[2].magazine);
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
});
// Run and gun: sprinting and sliding keep their movement and still fire, at a wider cone.
test("run and gun: firing while sprinting and sliding, with wider hip spread", async () => {
  const { spreadFor, SPRINT_SPREAD } = await import("../src/weapons.js");
  const { game, input } = setup();
  game.bots.update = () => {};
  const p = game.player;
  Object.assign(p, { x: -10, z: -15, yaw: Math.PI / 2 });
  game.weapons.equip(p, 0);
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  input.keys.add("KeyW");
  input.keys.add("ShiftLeft");
  input.fire = true;
  const start = p.ammo[0].mag;
  for (let i = 0; i < 20; i++) game.update(1 / 60);
  assert.equal(p.sprinting, true, "firing must not cancel the sprint");
  assert.ok(p.ammo[0].mag < start, "rifle fires while sprinting");
  const sprintCone = spreadFor(p);
  assert.ok(
    Math.abs(sprintCone / spreadFor({ ...p, sprinting: false }) - SPRINT_SPREAD) < 1e-9,
  );
  input.keys.add("KeyC");
  game.update(1 / 60);
  assert.equal(p.sliding, true);
  const beforeSlideShots = p.ammo[0].mag;
  for (let i = 0; i < 12; i++) game.update(1 / 60);
  assert.ok(p.ammo[0].mag < beforeSlideShots, "rifle fires while sliding");
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

// Legacy weapon-only starts infer the owning class; SWAP stays inside its two-weapon inventory.
test("starting weapon, respawn, and selection cover each class inventory", () => {
  const { game, input } = setup();
  for (let index = 0; index < WEAPONS.length; index++) {
    game.start("normal", index);
    const classId = classForWeapon(index),
      kit = LOADOUTS[classId];
    assert.equal(game.player.classId, classId);
    assert.equal(game.player.weapon, index);
    game.spawns.spawn(game.player);
    assert.equal(game.player.classId, classId);
    assert.equal(game.player.weapon, index);
    assert.equal(game.player.ammo[index].mag, WEAPONS[index].magazine);
    game.player.cooldown = 0;
    assert.equal(game.weapons.fire(game.player), true);
    assert.equal(game.player.ammo[index].mag, WEAPONS[index].magazine - 1);
    input.actions.add("switch");
    game.controller.update(1 / 60, 1);
    assert.equal(
      game.player.weapon,
      kit.weapons[(kit.weapons.indexOf(index) + 1) % kit.weapons.length],
    );
    input.actions.add("switch");
    game.controller.update(1 / 60, 1);
    assert.equal(game.player.weapon, index);
  }
  game.start("normal", NaN);
  assert.equal(game.player.weapon, 0);
  game.weapons.equip(game.player, 1.5);
  assert.equal(game.player.weapon, 0);
});

// Assert the intended class-to-gun mapping independently of the implementation definitions.
test("classes own their primary and shared pistol, and keep both across respawns", () => {
  const expected = { assault: 0, support: 4, engineer: 1, recon: 3 };
  assert.deepEqual([...CLASS_IDS].sort(), Object.keys(expected).sort());
  for (const [classId, primary] of Object.entries(expected)) {
    const { game } = setup();
    game.start("normal", primary, classId);
    const p = game.player;
    assert.equal(p.classId, classId);
    assert.equal(p.weapon, primary);
    assert.deepEqual(LOADOUTS[classId].weapons, [primary, 2]);
    for (let index = 0; index < WEAPONS.length; index++) {
      const owned = index === primary || index === 2;
      assert.deepEqual(p.ammo[index], {
        mag: owned ? WEAPONS[index].magazine : 0,
        reserve: owned ? WEAPONS[index].reserve : 0,
      });
    }
    game.weapons.equip(p, 2);
    p.ammo[2].mag = 1;
    game.spawns.spawn(p);
    assert.equal(p.classId, classId);
    assert.equal(p.weapon, 2);
    assert.equal(p.ammo[2].mag, WEAPONS[2].magazine);
    // An explicit class wins over an incompatible requested starting weapon.
    const foreign = Object.values(expected).find((index) => index !== primary);
    game.start("normal", foreign, classId);
    assert.equal(p.weapon, primary);
  }
});

// Foreign hotkeys and direct equip calls cannot cancel a valid reload or access another class gun.
test("class restrictions reject foreign guns without changing weapon, ammo, or reload", () => {
  for (const classId of CLASS_IDS) {
    const { game, input } = setup(),
      kit = LOADOUTS[classId];
    game.start("normal", kit.primary, classId);
    const p = game.player;
    p.ammo[p.weapon].mag = 1;
    game.weapons.reload(p);
    const remaining = p.reload,
      ammunition = structuredClone(p.ammo);
    for (let index = 0; index < WEAPONS.length; index++) {
      if (kit.weapons.includes(index)) continue;
      game.weapons.equip(p, index);
      // Only slots 1 and 2 exist; other number keys are ignored.
      input.actions.add("Digit" + (3 + (index % 3)));
      game.controller.update(1 / 60, 1);
      assert.equal(p.weapon, kit.primary);
      assert.equal(p.reload, remaining);
      assert.deepEqual(p.ammo, ammunition);
      // Combat also rejects callers that bypass the validated equip method.
      p.weapon = index;
      p.reload = 0;
      p.cooldown = 0;
      p.ammo[index] = { mag: 1, reserve: 1 };
      assert.equal(game.weapons.fire(p), false);
      game.weapons.reload(p);
      assert.equal(p.reload, 0);
      p.weapon = kit.primary;
      p.reload = remaining;
      p.ammo = structuredClone(ammunition);
    }
  }
});

// Exhaustion makes bots use their pistol, even when a foreign slot contains leftover ammunition.
test("bots spawn with class guns and only switch within their assigned inventory", () => {
  const { game } = setup();
  for (const a of game.actors.slice(1)) {
    const kit = LOADOUTS[a.classId];
    assert.equal(a.weapon, kit.primary);
    for (let index = 0; index < WEAPONS.length; index++)
      if (!kit.weapons.includes(index))
        assert.deepEqual(a.ammo[index], { mag: 0, reserve: 0 });
    a.ammo[kit.primary] = { mag: 0, reserve: 0 };
    const foreign = WEAPONS.findIndex(
      (_, index) => !kit.weapons.includes(index),
    );
    a.ammo[foreign] = { mag: 1, reserve: 1 };
    a.brain.target = null;
    a.brain.think = 10;
    game.bots.update(a, 1 / 60);
    assert.equal(a.weapon, 2);
    const classId = a.classId;
    game.spawns.spawn(a);
    assert.equal(a.classId, classId);
    assert.equal(a.weapon, 2);
    assert.deepEqual(a.ammo[foreign], { mag: 0, reserve: 0 });
  }
});

// Role tuning: falloff is linear between its distances and headshots multiply after falloff.
test("damage falloff, headshot multiplier and class time-to-kill roles", async () => {
  const { damageAt, spreadFor } = await import("../src/weapons.js");
  const ar = WEAPONS[0],
    smg = WEAPONS[1];
  assert.equal(damageAt(ar, 0), 28);
  assert.equal(damageAt(ar, 50), 23);
  assert.equal(damageAt(ar, 200), 18);
  const { game } = setup(),
    p = game.player,
    e = game.actors[6];
  game.bots.update = () => {};
  for (const a of game.actors) if (a !== p && a !== e) a.alive = false;
  game.random = () => 0;
  game.arena.ray = () => 100;
  Object.assign(p, { x: 0, z: 0, y: 0, eye: 1.58, yaw: Math.PI / 2 });
  Object.assign(e, { x: 5, z: 0, y: 0, shield: 0, hp: 100, crouched: false });
  // Eye-level shots strike the head box: 28 * 1.5.
  p.cooldown = 0;
  game.weapons.fire(p, Math.PI / 2, 0);
  assert.equal(e.hp, 100 - 42);
  e.hp = 100;
  p.cooldown = 0;
  game.weapons.fire(p, Math.PI / 2, -0.15);
  assert.equal(e.hp, 72);
  // The SMG falls off much harder than the AR by medium range.
  assert.ok(damageAt(smg, 40) < damageAt(ar, 40) * 0.6);
  // Engineer handling: better hip and moving accuracy than Assault.
  const moving = (weapon) =>
    spreadFor({ weapon, moving: true, adsProgress: 0 });
  assert.ok(moving(1) < moving(0) * 0.6);
  // Recon DMR is precise when aimed and two head hits at range still need a third.
  assert.ok(
    spreadFor({ weapon: 3, adsProgress: 1 }) <
      spreadFor({ weapon: 0, adsProgress: 1 }),
  );
  assert.ok(damageAt(WEAPONS[3], 60) * 2 * 2 > 100);
});

// Number keys map to inventory slots; Q/wheel/SWAP share one switch action.
test("slot keys 1 and 2 select primary and sidearm for every class", () => {
  for (const classId of CLASS_IDS) {
    const { game, input } = setup(),
      kit = LOADOUTS[classId];
    game.start("normal", kit.primary, classId);
    const p = game.player;
    input.actions.add("Digit2");
    game.controller.update(1 / 60, 1);
    assert.equal(p.weapon, 2);
    assert.equal(p.cooldown, WEAPONS[2].equipTime);
    input.actions.add("Digit1");
    game.controller.update(1 / 60, 1);
    assert.equal(p.weapon, kit.primary);
  }
});

// ADS accuracy ramps over the weapon's ADS time instead of applying instantly.
test("ADS progress follows weapon ADS time", () => {
  const { game, input } = setup(),
    p = game.player;
  game.bots.update = () => {};
  input.aim = true;
  game.controller.update(WEAPONS[0].adsTime / 2, 1);
  assert.ok(p.adsProgress > 0.4 && p.adsProgress < 0.6);
  game.controller.update(WEAPONS[0].adsTime, 1);
  assert.equal(p.adsProgress, 1);
});

// Owned, uncontested Conquest sectors become forward spawn points.
test("conquest players deploy at owned sectors near the front", () => {
  const game = new OfflineSimulation(
    { keys: new Set(), actions: new Set(), consume: () => false, clear() {} },
    { play() {} },
    () => 0.5,
    { mode: "conquest" },
  );
  game.start("normal");
  const [a, b] = game.match.sectors;
  assert.ok(a.spawnPoints.length > 0);
  const p = game.player;
  game.spawns.spawn(p);
  assert.equal(p.spawnSector, null);
  a.owner = b.owner = 0;
  for (const e of game.actors) if (e.team === 1) e.alive = false;
  game.spawns.spawn(p);
  assert.ok(["A", "B"].includes(p.spawnSector));
  b.contested = true;
  a.owner = null;
  game.spawns.spawn(p);
  assert.equal(p.spawnSector, null);
});

// Bots re-check line of sight at the trigger and drop targets hidden behind cover.
test("bots never fire at a target behind a wall and retreat to cover when hurt", () => {
  const { game } = setup();
  const bot = game.actors[6],
    p = game.player;
  for (const a of game.actors) if (a !== bot && a !== p) a.alive = false;
  Object.assign(p, { x: -12, z: -1, y: 0, shield: 0 });
  Object.assign(bot, { x: -12, z: 12, y: 0, cooldown: 0, hp: 100 });
  // A freight stack between them blocks sight.
  bot.brain.target = p;
  bot.brain.reaction = 0;
  bot.brain.think = 10;
  const mag = bot.ammo[bot.weapon].mag;
  game.bots.update(bot, 1 / 60);
  assert.equal(bot.ammo[bot.weapon].mag, mag);
  assert.equal(bot.brain.target, null);
  // In the open and wounded, the bot picks a cover node the threat cannot see.
  Object.assign(bot, { x: -4, z: -1, hp: 20 });
  bot.brain.think = 0;
  game.bots.update(bot, 1 / 60);
  assert.equal(bot.brain.state, "SeekCover");
  const c = bot.brain.cover;
  assert.ok(c && !game.arena.visible(p, { x: c.x, y: 0, z: c.z }));
});
// Semi-automatic taps during the fire interval are queued briefly instead of being discarded.
test("semi-auto press during cooldown fires once when ready; stale presses expire", () => {
  const { game, input } = setup(),
    p = game.player;
  game.bots.update = () => {};
  game.weapons.equip(p, 2);
  p.cooldown = 0;
  input.actions.add("fire");
  game.update(1 / 60);
  assert.equal(p.ammo[2].mag, 11);
  // Second tap 1/60 s later, well inside the pistol's 0.18 s interval.
  input.actions.add("fire");
  game.update(1 / 60);
  assert.equal(p.ammo[2].mag, 11);
  for (let i = 0; i < 30; i++) game.update(1 / 60);
  assert.equal(p.ammo[2].mag, 10, "buffered tap fires exactly once");
  // A tap made while the weapon is blocked for longer than the buffer is dropped.
  p.cooldown = 1;
  input.actions.add("fire");
  for (let i = 0; i < 90; i++) game.update(1 / 60);
  assert.equal(p.ammo[2].mag, 10);
});
// A teammate standing inside the shooter's muzzle position must not eat the shot at range zero.
test("overlapping teammate does not block shots; a teammate further down the lane still does", () => {
  const { game } = setup();
  const { p, e } = isolate(game);
  const mate = game.actors[1];
  game.spawns.spawn(mate);
  Object.assign(mate, { x: p.x + 0.15, z: p.z, y: 0, shield: 0 });
  game.weapons.fire(p, p.yaw, -0.05, 0);
  assert.ok(e.hp < 100, "enemy is hit through the overlapping teammate");
  assert.equal(mate.hp, 100);
  e.hp = 100;
  Object.assign(mate, { x: 0 });
  p.cooldown = 0;
  game.weapons.fire(p, p.yaw, -0.05, 0);
  assert.equal(e.hp, 100, "teammate between shooter and enemy still blocks");
});
// Spawn protection makes a target undamageable, so bots hold fire instead of wasting rounds.
test("bots do not target or fire at spawn-protected enemies", () => {
  const { game } = setup();
  const { p, e } = isolate(game);
  game.bots.difficulty = "hard";
  // Enemy bot faces the protected player across an open lane.
  p.shield = 99;
  e.shield = 0;
  const before = e.ammo[e.weapon].mag;
  for (let i = 0; i < 120; i++) {
    p.shield = 99;
    game.bots.update(e, 1 / 60);
    game.weapons.update(e, 1 / 60);
  }
  assert.equal(e.ammo[e.weapon].mag, before);
  assert.equal(e.brain.target, null);
  p.shield = 0;
  for (let i = 0; i < 120; i++) {
    game.bots.update(e, 1 / 60);
    game.weapons.update(e, 1 / 60);
  }
  assert.ok(e.ammo[e.weapon].mag < before, "bot engages once protection ends");
});
// Switching weapons clears all reload bookkeeping, not only the timer.
test("weapon switch clears reload duration and empty-reload flag", () => {
  const { game } = setup(),
    p = game.player;
  p.ammo[p.weapon].mag = 0;
  game.weapons.reload(p);
  assert.ok(p.reloadTime > 0 && p.reloadEmpty);
  game.weapons.equip(p, 2);
  assert.equal(p.reload, 0);
  assert.equal(p.reloadTime, 0);
  assert.equal(p.reloadEmpty, false);
});
// Ammunition sources: eliminations return half a magazine; friendly bases restore reserves.
test("eliminations resupply half a magazine per carried weapon, capped at the starting reserve", async () => {
  const { resupply } = await import("../src/match.js");
  const { game } = setup();
  const { p, e } = isolate(game);
  for (const i of [0, 2]) p.ammo[i].reserve = 0;
  e.hp = 1;
  game.weapons.fire(p, p.yaw, -0.05, 0);
  assert.equal(e.alive, false);
  assert.equal(p.ammo[0].reserve, 15);
  assert.equal(p.ammo[2].reserve, 6);
  assert.equal(p.ammo[1].reserve, 0, "weapons outside the class get nothing");
  p.ammo[0].reserve = WEAPONS[0].reserve - 1;
  resupply(p);
  assert.equal(p.ammo[0].reserve, WEAPONS[0].reserve);
});
test("standing at a friendly base restores reserves but never fills the magazine directly", () => {
  const { game } = setup(),
    p = game.player;
  game.bots.update = () => {};
  Object.assign(p, { x: 0, z: -15 });
  for (const i of [0, 2]) p.ammo[i] = { mag: 0, reserve: 0 };
  game.update(1 / 60);
  assert.equal(p.ammo[0].reserve, 0, "no resupply away from base");
  const enemyBase = game.arena.spawns[1][0];
  Object.assign(p, { x: enemyBase.x, z: enemyBase.z });
  game.update(1 / 60);
  assert.equal(p.ammo[0].reserve, 0, "enemy bases do not resupply");
  const base = game.arena.spawns[0][0];
  Object.assign(p, { x: base.x, z: base.z });
  game.update(1 / 60);
  assert.equal(p.ammo[0].reserve, WEAPONS[0].reserve);
  assert.equal(p.ammo[2].reserve, WEAPONS[2].reserve);
  assert.equal(p.ammo[0].mag, 0);
  assert.equal(game.notice, "RESUPPLIED");
});
test("bots with no ammunition route home and refill instead of chasing with empty guns", () => {
  const { game } = setup();
  const bot = game.actors[3];
  for (const a of game.actors)
    if (a !== bot) Object.assign(a, { alive: false, respawn: 999 });
  Object.assign(bot, { x: 0, z: -15 });
  for (const i of [0, 1, 2, 3, 4]) bot.ammo[i] = { mag: 0, reserve: 0 };
  bot.brain.think = 0;
  for (let i = 0; i < 60 * 15 && bot.ammo[bot.weapon].reserve === 0; i++)
    game.update(1 / 60);
  assert.ok(
    bot.ammo[bot.weapon].reserve > 0,
    "bot reached a base and refilled",
  );
});
test("idle bots top up half-empty magazines; engaged bots keep firing", () => {
  const { game } = setup();
  const { p, e } = isolate(game);
  const w = WEAPONS[e.weapon];
  p.alive = false;
  p.respawn = 999;
  e.ammo[e.weapon].mag = Math.floor(w.magazine * 0.4);
  game.bots.update(e, 1 / 60);
  assert.ok(e.reload > 0, "reloads during a lull");
  const { e: e2 } = isolate(game);
  e2.ammo[e2.weapon].mag = Math.floor(WEAPONS[e2.weapon].magazine * 0.4);
  e2.brain.think = 0;
  game.bots.update(e2, 1 / 60);
  assert.equal(e2.reload, 0, "no voluntary reload with an enemy in view");
});
test("bots separate instead of stacking on one spot; conquest labels objective work", () => {
  const { game } = setup();
  const [a, b] = [game.actors[1], game.actors[2]];
  for (const x of game.actors)
    if (x !== a && x !== b) Object.assign(x, { alive: false, respawn: 999 });
  Object.assign(a, { x: 0, z: -15 });
  Object.assign(b, { x: 0, z: -15 });
  for (const x of [a, b]) x.brain.path = [];
  for (let i = 0; i < 60; i++) {
    game.bots.update(a, 1 / 60);
    game.bots.update(b, 1 / 60);
  }
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.5);
  const cq = new OfflineSimulation(
    { clear() {}, consume: () => false },
    { play() {} },
    () => 0.5,
    { mode: "conquest" },
  );
  cq.start("normal");
  for (const x of cq.actors)
    if (x.id !== 1) Object.assign(x, { alive: false, respawn: 999 });
  const bot = cq.actors[1];
  for (let i = 0; i < 30; i++) cq.bots.update(bot, 1 / 60);
  assert.ok(
    ["CaptureSector", "DefendSector"].includes(bot.brain.state),
    bot.brain.state,
  );
});
// Bodies block movement, but never trap actors that already overlap.
test("actors cannot walk through each other; overlapping or dead bodies never trap anyone", async () => {
  const { BODY_GAP } = await import("../src/world.js");
  const { game, input } = setup();
  game.bots.update = () => {};
  const p = game.player,
    bot = game.actors[6];
  for (const a of game.actors)
    if (a !== p && a !== bot) Object.assign(a, { alive: false, respawn: 999 });
  // Walk straight east (yaw pi/2) into a bot standing 3 m ahead in an open lane.
  Object.assign(p, { x: -6, z: -10, yaw: Math.PI / 2, pitch: 0 });
  Object.assign(bot, { x: -3, z: -10 });
  input.keys.add("KeyW");
  for (let i = 0; i < 90; i++) game.update(1 / 60);
  const gap = Math.hypot(p.x - bot.x, p.z - bot.z);
  assert.ok(
    gap >= BODY_GAP - 1e-6 && gap < BODY_GAP + 0.1,
    `stopped at ${gap}`,
  );
  // Sidestepping slides past along the body instead of sticking to it.
  input.keys.add("KeyD");
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.ok(p.z > bot.z + 0.5, "moved sideways around the bot");
  input.keys.clear();
  // Exactly stacked actors can still step apart.
  Object.assign(p, { x: bot.x, z: bot.z });
  input.keys.add("KeyS");
  for (let i = 0; i < 30; i++) game.update(1 / 60);
  assert.ok(Math.hypot(p.x - bot.x, p.z - bot.z) > BODY_GAP);
  input.keys.clear();
  // A dead body does not block.
  Object.assign(p, { x: -6, z: -10 });
  Object.assign(bot, { x: -3, z: -10, alive: false, respawn: 999 });
  input.keys.add("KeyW");
  for (let i = 0; i < 90; i++) game.update(1 / 60);
  assert.ok(p.x > bot.x + 1, "walked through where the dead bot lay");
});
// A fixed roster order let one team always act first within a tick; the start rotates instead.
test("every actor takes a turn acting first, so neither team always resolves first", () => {
  const { game } = setup();
  const firsts = [];
  let seen = null;
  game.bots.update = (a) => {
    if (seen === null) seen = a.id;
  };
  game.controller.update = () => {
    if (seen === null) seen = 0;
  };
  for (let i = 0; i < game.actors.length; i++) {
    seen = null;
    game.update(1 / 60);
    firsts.push(seen);
  }
  assert.deepEqual(
    [...firsts].sort((a, b) => a - b),
    game.actors.map((a) => a.id),
  );
});
