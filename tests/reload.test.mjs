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
    actor.reload = WEAPONS[weapon].reload * 0.2;
    const empty = reloadPose(actor);
    actor.reloadEmpty = false;
    const partial = reloadPose(actor);
    assert.equal(partial.bolt, 0);
    assert.ok(empty.bolt > 0);
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
