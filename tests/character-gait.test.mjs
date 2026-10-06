import test from "node:test";
import assert from "node:assert/strict";
import { legPose } from "../src/character-gait.js";

test("walking alternates foot contact and bends fixed-length leg bones", () => {
  for (const crouched of [false, true]) {
    for (const sprinting of [false, true]) {
      const actor = { id: 0, moving: true, crouched, sprinting };
      for (let t = 0; t < 2; t += 0.025) {
        const left = legPose(actor, t, -1),
          right = legPose(actor, t, 1);
        assert.ok(Math.min(left.lift, right.lift) < 1e-12);
        for (const pose of [left, right]) {
          for (const [a, b] of [
            [pose.hip, pose.knee],
            [pose.knee, pose.ankle],
          ])
            assert.ok(
              Math.abs(Math.hypot(a.y - b.y, a.z - b.z) - 0.31) < 1e-10,
            );
          assert.ok(pose.ankle.y >= 0.13);
          assert.ok(pose.knee.z < (pose.hip.z + pose.ankle.z) / 2);
        }
      }
      assert.deepEqual(actor, { id: 0, moving: true, crouched, sprinting });
    }
  }
});

test("idle and sliding feet stay planted without cycling", () => {
  for (const actor of [
    { id: 1, moving: false },
    { id: 1, moving: true, sliding: true },
  ]) {
    assert.deepEqual(legPose(actor, 0, -1), legPose(actor, 1, -1));
    assert.equal(legPose(actor, 1, 1).lift, 0);
  }
});
