// Gunfire presentation: shot effects carry what renderers need, and visuals spawn once per shot.
import test from "node:test";
import assert from "node:assert/strict";
import { EffectPool } from "../src/weapons.js";
import { CameraPunch, CombatFx } from "../src/combat-fx.js";

const cam = { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, floor: 0 };
const live = (fx, type) =>
  fx.particles.filter((p) => p.life > 0 && (!type || p.type === type)).length;

test("shot effects record muzzle origin, struck surface and a growing sequence", () => {
  const pool = new EffectPool();
  pool.add(0, 1, -20, "head", 0.2, 1.5, -0.7);
  pool.add(0, 1, -20);
  const [a, b] = pool.items;
  assert.deepEqual([a.ox, a.oy, a.oz, a.kind], [0.2, 1.5, -0.7, "head"]);
  assert.equal(b.kind, "impact");
  assert.ok(b.seq > a.seq);
});

test("each shot spawns a tracer and debris exactly once, even if its slot moves", () => {
  const pool = new EffectPool(),
    fx = new CombatFx(() => 0.5);
  pool.add(0, 1, -30, "impact", 0, 1.5, -0.7);
  fx.scan(pool, cam);
  assert.equal(live(fx, "tracer"), 1);
  const spawned = live(fx);
  // A network snapshot compacts live effects into different slots; nothing new may appear.
  Object.assign(pool.items[5], pool.items[0]);
  fx.scan(pool, cam);
  assert.equal(live(fx), spawned);
  assert.equal(fx.marks.filter((m) => m.life > 0).length, 1);
  // The tracer travels and expires; debris settles and expires.
  for (let i = 0; i < 120; i++) fx.update(1 / 60);
  assert.equal(live(fx), 0);
});

test("body and head hits spray instead of marking walls; remote shooters flash", () => {
  const pool = new EffectPool(),
    fx = new CombatFx(() => 0.5);
  pool.add(0, 1.7, -15, "head", 0, 1.5, -10);
  fx.scan(pool, cam);
  assert.equal(fx.marks.filter((m) => m.life > 0).length, 0);
  assert.equal(live(fx, "flash"), 1);
  const calls = [];
  fx.draw((...args) => calls.push(args), 500);
  assert.ok(calls.length > 8);
  assert.ok(calls.every((args) => args.slice(0, 6).every(Number.isFinite)));
});

test("ejected brass falls and bounces on the floor", () => {
  const fx = new CombatFx(() => 0.5);
  fx.eject(cam, 0);
  // From eye height the casing lands after about 0.83 s.
  for (let i = 0; i < 55; i++) fx.update(1 / 60);
  const shell = fx.particles.find((p) => p.life > 0);
  assert.ok(shell.y >= 0 && shell.y < 0.3);
});

test("camera punch jolts up and settles back to zero", () => {
  const punch = new CameraPunch();
  punch.kick(1, 0, () => 0.5);
  punch.update(0.03);
  assert.ok(punch.pitch > 0.005);
  for (let i = 0; i < 30; i++) punch.update(1 / 60);
  assert.ok(Math.abs(punch.pitch) < 1e-3);
  // Aiming down sights steadies the punch.
  const aimed = new CameraPunch();
  aimed.kick(1, 1, () => 0.5);
  aimed.update(0.03);
  assert.ok(aimed.pitch < punch.pitch || aimed.pitch < 0.011);
});
