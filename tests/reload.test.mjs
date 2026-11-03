// Pure mesh/pose regressions verify moving components, finite geometry, empty actions, and restoration without base-mesh mutation.
import test from "node:test";
import assert from "node:assert/strict";
import { weaponMesh } from "../src/weapon-models.js";
import { reloadPose, animateWeapon } from "../src/reload-animation.js";
import { WEAPONS } from "../src/weapons.js";
for (let weapon = 0; weapon < WEAPONS.length; weapon++)
  test(`reload mesh ${weapon}: removable parts, empty action, reset, finite geometry`, () => {
    const actor = {
      weapon,
      alive: true,
      reload: WEAPONS[weapon].reload * 0.55,
      reloadEmpty: true,
    };
    const base = weaponMesh(weapon, "sand", "reflex", false, true),
      out = new Float32Array(base.length);
    assert.ok(base.parts.some((p) => p.name === "magazine"));
    const moving = animateWeapon(base, out, reloadPose(actor));
    assert.ok(moving.every(Number.isFinite));
    assert.notDeepEqual(moving, Float32Array.from(base));
    // Keep an immutable reference so each pose can be checked for accidental base-geometry mutation.
    const snapshot = Array.from(base);
    // Only an empty reload works the action (bolt, charging handle or pistol slide).
    const action = (empty) => {
      let most = 0;
      for (let t = 0; t <= 1; t += 0.01) {
        actor.reloadEmpty = empty;
        actor.reload = WEAPONS[weapon][empty ? "reloadEmpty" : "reload"] * (1 - t) || 1e-6;
        const p = reloadPose(actor);
        most = Math.max(most, p.bolt, p.slide);
      }
      return most;
    };
    assert.ok(action(true) > 0.05, "empty reload works the action");
    assert.equal(action(false), 0, "a tactical reload leaves the action alone");
    actor.reloadEmpty = true;
    actor.reload = 0;
    animateWeapon(base, out, reloadPose(actor));
    assert.ok(
      out.every((value, index) => Math.abs(value - snapshot[index]) < 1e-7),
    );
    assert.deepEqual(Array.from(base), snapshot);
    actor.reload = 1;
    actor.alive = false;
    assert.equal(reloadPose(actor).active, false);
  });

// The support hand morphs from the handguard grip to a magazine grip and rides with the mag.
for (let weapon = 0; weapon < WEAPONS.length; weapon++)
  test(`reload ${weapon}: support hand grips the magazine mid-reload`, () => {
    const base = weaponMesh(weapon, "graphite", "iron", false, true),
      out = new Float32Array(base.length),
      support = base.parts.find((p) => p.name === "support"),
      mag = base.parts.find((p) => p.name === "magazine");
    // Same topology is what makes the vertex-by-vertex morph valid.
    assert.equal(base.supportAlt.length, support.end - support.start);
    const centre = (data, { start, end }) => {
      const c = [0, 0, 0];
      for (let k = start; k < end; k += 9)
        for (let i = 0; i < 3; i++) c[i] += data[k + i];
      return c.map((v) => v / ((end - start) / 9));
    };
    // Hand-only centroid: vertices in front of the forearm (the pistol is held further back).
    const handLimit = weapon === 2 ? 0.25 : 0.05;
    const handCentre = (data) => {
      const c = [0, 0, 0];
      let n = 0;
      for (let k = support.start; k < support.end; k += 9)
        if (data[k + 2] < handLimit) {
          for (let i = 0; i < 3; i++) c[i] += data[k + i];
          n++;
        }
      return c.map((v) => v / n);
    };
    const actor = { weapon, alive: true, reloadEmpty: false };
    const at = (t) => {
      actor.reload = WEAPONS[weapon].reload * (1 - t);
      return animateWeapon(base, out, reloadPose(actor));
    };
    const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const rest = handCentre(Float32Array.from(base));
    // While the magazine is out, the hand stays with it.
    const moving = at(0.3);
    const magNow = centre(moving, mag),
      handNow = handCentre(moving);
    assert.ok(
      dist(handNow, magNow) < dist(rest, magNow),
      "hand moved to the mag",
    );
    assert.ok(
      dist(handNow, magNow) < 0.16,
      `hand ${dist(handNow, magNow)} from mag`,
    );
    assert.ok(moving.every(Number.isFinite));
  });

// The sequence reads like a real reload: the magazine leaves the gun, is away below the frame,
// returns and is seated; the gun cants, then settles back exactly to rest.
const at = (weapon, t, empty) =>
  reloadPose({
    weapon,
    alive: true,
    reloadEmpty: empty,
    reload: WEAPONS[weapon][empty ? "reloadEmpty" : "reload"] * (1 - t) || 1e-6,
  });
for (let weapon = 0; weapon < WEAPONS.length; weapon++)
  for (const empty of [false, true])
    test(`reload ${weapon} ${empty ? "empty" : "tactical"}: magazine out, away, back and seated`, () => {
      let lowest = 0,
        mostRoll = 0;
      for (let t = 0; t <= 1; t += 0.01) {
        const p = at(weapon, t, empty);
        lowest = Math.min(lowest, p.magOffset[1]);
        mostRoll = Math.max(mostRoll, Math.abs(p.roll));
      }
      assert.ok(lowest < -0.4, `magazine goes below the frame (${lowest})`);
      assert.ok(mostRoll > 0.15, "the gun cants toward the eye");
      const end = at(weapon, 0.999, empty);
      assert.ok(Math.abs(end.magOffset[1]) < 1e-6 && Math.abs(end.magPitch) < 1e-6, "magazine seated");
      assert.ok(Math.abs(end.roll) < 0.01 && end.hand < 0.01, "gun and hand back at rest");
    });

test("an empty magazine falls under gravity", () => {
  const ys = [0.14, 0.18, 0.22, 0.26].map((t) => at(0, t, true).magOffset[1]);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1]);
  // Accelerating: each step falls further than the one before.
  assert.ok(ys[1] - ys[2] > ys[0] - ys[1] && ys[2] - ys[3] > ys[1] - ys[2]);
});

// Hands and gun move continuously: no frame-to-frame pops anywhere in the reload. Speeds are
// per real second (metres, radians or grip blend), so long and short reloads are held to the
// same limit; a pop shows up as a spike far above it.
for (let weapon = 0; weapon < WEAPONS.length; weapon++)
  test(`reload ${weapon}: hand and gun motion is continuous`, () => {
    for (const empty of [false, true]) {
      const dt = 0.004 * WEAPONS[weapon][empty ? "reloadEmpty" : "reload"];
      let prev = at(weapon, 0, empty);
      for (let t = 0.004; t <= 1; t += 0.004) {
        const p = at(weapon, t, empty);
        const jump = Math.max(
          Math.hypot(...p.handOffset.map((v, i) => v - prev.handOffset[i])),
          Math.abs(p.roll - prev.roll),
          Math.abs(p.hand - prev.hand),
          ...["x", "y", "z", "yaw", "pitch"].map((k) => Math.abs(p.gun[k] - prev.gun[k])),
        );
        assert.ok(jump / dt < 10, `weapon ${weapon} ${empty} t=${t.toFixed(3)} speed ${jump / dt}`);
        prev = p;
      }
    }
  });
