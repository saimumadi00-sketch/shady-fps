import test from "node:test";
import assert from "node:assert/strict";
import { viewmodelPose } from "../src/viewmodel.js";

test("aimed sights remain centered during walking, sprinting and sliding", () => {
  for (const sightHeight of [0.16, 0.205, 0.218])
    for (const sliding of [false, true]) {
      const actor = {
        weapon: 0,
        moving: true,
        sprinting: true,
        sliding,
        kick: 0,
      };
      const before = { ...actor };
      for (const time of [0, 0.13, 0.5, 1, 10]) {
        const pose = viewmodelPose(
          actor,
          time,
          1,
          { active: false, lift: 0 },
          sightHeight,
        );
        assert.equal(pose.x, 0);
        assert.ok(Math.abs(pose.y + sightHeight) < 1e-9);
        assert.equal(pose.yaw, 0);
      }
      assert.deepEqual(actor, before);
    }
});

test("hip motion stays bounded and reload lifts suppress sprint lowering", () => {
  const actor = {
    weapon: 2,
    moving: true,
    sprinting: true,
    sliding: false,
    kick: 0,
  };
  for (let time = 0; time < 5; time += 0.01) {
    const pose = viewmodelPose(
      actor,
      time,
      0,
      { active: false, lift: 0 },
      0.16,
    );
    assert.ok(Math.abs(pose.x - 0.2) <= 0.0041);
    assert.ok(pose.y > -0.28 && pose.y < -0.26);
    assert.ok(Object.values(pose).every(Number.isFinite));
  }
  actor.moving = false;
  const reload = viewmodelPose(actor, 0, 0, { active: true, lift: 1 }, 0.16);
  assert.ok(Math.abs(reload.y + 0.135) < 1e-9);
});
