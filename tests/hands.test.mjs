// First-person hands must actually hold each weapon: fingers touching, nothing sunk into the
// gun, the trigger finger on the trigger, and every pose solved quickly enough to build at
// runtime without a hitch.
import test from "node:test";
import assert from "node:assert/strict";
import { solveHands } from "../src/viewmodel-hands.js";
import { weaponMesh } from "../src/weapon-models.js";
import { CLASS_IDS } from "../src/loadouts.js";

const KINDS = ["rifle", "smg", "pistol", "dmr", "lmg"];
// Deepest any finger segment sinks below its surface, in metres (negative = inside).
function worstSink(sdf, pose) {
  let worst = 0;
  for (const { finger, pts } of pose.fingers)
    for (let i = 0; i < 3; i++)
      for (const t of [0.5, 1]) {
        const p = pts[i].map((v, k) => v + (pts[i + 1][k] - v) * t);
        worst = Math.min(worst, sdf(p) - finger.r * 0.8);
      }
  return worst;
}

for (const kind of KINDS)
  test(`${kind}: hands grip the weapon without sinking into it`, () => {
    const start = performance.now();
    const { sdf, firing, support, magHold, shapes } = solveHands(kind);
    assert.ok(performance.now() - start < 400, "poses solve fast enough");
    // Firing hand: middle, ring and little fingertips rest on the grip.
    for (const { finger, pts } of firing.fingers.slice(1)) {
      const gap = sdf(pts[3]) / finger.r;
      assert.ok(gap > 0.5 && gap < 1.3, `${kind} firing fingertip ${gap}`);
    }
    // Index pad on the trigger.
    const index = firing.fingers[0].pts[3];
    const trigger = shapes.trigger.c;
    assert.ok(
      Math.hypot(index[0] - trigger[0], index[2] - trigger[2] + 0.012) < 0.03,
      `${kind} index reaches the trigger`,
    );
    // Support and magazine grips: at least three fingertips in contact.
    for (const [name, pose, field] of [
      ["support", support, kind === "pistol" ? null : sdf],
      ["mag", magHold, kind === "lmg" ? null : sdf],
    ]) {
      if (!field) continue;
      const touching = pose.fingers.filter(
        ({ finger, pts }) => field(pts[3]) / finger.r < 1.6,
      ).length;
      assert.ok(touching >= 3, `${kind} ${name}: ${touching} fingertips touch`);
    }
    for (const [name, pose] of [
      ["firing", firing],
      ["support", support],
      ["mag", magHold],
    ])
      assert.ok(
        worstSink(sdf, pose) > -0.005,
        `${kind} ${name} sinks into the gun`,
      );
  });

test("every class builds every weapon with hands, and reload poses share topology", () => {
  for (const classId of CLASS_IDS)
    for (let weapon = 0; weapon < 5; weapon++) {
      const mesh = weaponMesh(weapon, "graphite", "iron", false, true, classId);
      const support = mesh.parts.find((p) => p.name === "support");
      assert.equal(mesh.supportAlt.length, support.end - support.start);
      assert.ok(mesh.every(Number.isFinite), `${classId} ${weapon}`);
    }
});
