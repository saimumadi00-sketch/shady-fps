// Recoil patterns: a learnable per-weapon shape, partial recovery after a burst, and player
// compensation that recovery never doubles. Offline, server and client share the same rules.
import test from "node:test";
import assert from "node:assert/strict";
import { OfflineSimulation } from "../src/game.js";
import {
  WEAPONS,
  RECOIL_PATTERNS,
  recoilFor,
  recoilScale,
  trackRecoil,
  recoverRecoil,
} from "../src/weapons.js";

const DEG = Math.PI / 180;

function offline() {
  let seed = 7;
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
      const had = this.actions.has(k);
      this.actions.delete(k);
      return had;
    },
    clear() {
      this.fire = false;
    },
  };
  const game = new OfflineSimulation(
    input,
    { play() {} },
    () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
  );
  game.start("normal");
  game.bots.update = () => {};
  // Fire into open sky so nothing interferes with the shots.
  for (const a of game.actors) if (a !== game.player) a.alive = false;
  Object.assign(game.player, { shield: 0, cooldown: 0, pitch: 0.4, yaw: 0 });
  return { game, input, p: game.player };
}
const run = (game, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60) game.update(1 / 60);
};

test("every weapon has a pattern: harder first kick, fixed drift, bounded jitter", () => {
  assert.equal(RECOIL_PATTERNS.length, WEAPONS.length);
  for (let w = 0; w < WEAPONS.length; w++) {
    const p = RECOIL_PATTERNS[w];
    assert.ok(p.first >= 1 && p.recover > 0 && p.recover < 1);
    assert.ok(p.drift.every((d) => Math.abs(d) <= 1));
    // With the random term centred, the horizontal kick is exactly the pattern drift.
    const a = { weapon: w, aim: false };
    for (let shot = 0; shot < 12; shot++) {
      const k = recoilFor(a, () => 0.5, shot);
      assert.ok(
        Math.abs(k.yaw - p.drift[shot % p.drift.length] * WEAPONS[w].recoilX * DEG) < 1e-12,
      );
      assert.ok(
        Math.abs(k.pitch - WEAPONS[w].recoil * DEG * recoilScale(w, shot)) < 1e-12,
      );
    }
  }
  // The AR's first round kicks harder than the next, and the long-burst tail eases off.
  assert.ok(recoilScale(0, 0) > recoilScale(0, 1));
  assert.ok(recoilScale(0, 20) < recoilScale(0, 1));
  // Aiming down sights still reduces the climb.
  assert.ok(
    recoilFor({ weapon: 0, aim: true }, () => 0.5, 3).pitch <
      recoilFor({ weapon: 0, aim: false }, () => 0.5, 3).pitch,
  );
});

test("after a burst, part of the climb recovers and the pattern restarts", () => {
  const { game, input, p } = offline();
  input.fire = true;
  run(game, 0.6);
  input.fire = false;
  const climbed = p.pitch - 0.4;
  assert.ok(climbed > 0.02, "the burst climbs");
  assert.ok(p.recoilShot >= 5, "the burst advanced the pattern");
  run(game, 1);
  const kept = p.pitch - 0.4;
  const share = 1 - RECOIL_PATTERNS[0].recover;
  assert.ok(Math.abs(kept - climbed * share) < climbed * 0.03, "settles at the kept share");
  assert.equal(p.recoilShot, 0);
});

test("pulling down during the burst cancels recovery instead of overshooting", () => {
  const { game, input, p } = offline();
  // Calibrate how far one unit of mouse travel moves the aim.
  input.dy = 1;
  game.update(1 / 60);
  const perUnit = 0.4 - p.pitch;
  p.pitch = 0.4;
  assert.ok(perUnit > 0);
  input.fire = true;
  run(game, 0.6);
  input.fire = false;
  // The player drags the mouse down by exactly the climb, back onto the target.
  input.dy = (p.pitch - 0.4) / perUnit;
  game.update(1 / 60);
  assert.ok(Math.abs(p.pitch - 0.4) < 1e-6);
  run(game, 1);
  assert.ok(Math.abs(p.pitch - 0.4) < 1e-6, "aim stays where the player put it");
});

test("shared state helpers: no recovery while firing, decay after resting", () => {
  const s = {};
  trackRecoil(s, 0, 0.01, 0.002);
  assert.deepEqual(recoverRecoil(s, 0, WEAPONS[0].interval / 2), [0, 0]);
  let back = 0;
  for (let i = 0; i < 120; i++) back += recoverRecoil(s, 0, 1 / 60)[0];
  assert.ok(Math.abs(back - 0.01 * RECOIL_PATTERNS[0].recover) < 1e-6);
  assert.equal(s.recoilShot, 0);
});
