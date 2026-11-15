// First-person hands must actually hold each weapon: fingers touching, nothing sunk into the
// gun, the trigger finger on the trigger, and every pose solved quickly enough to build at
// runtime without a hitch.
import test from "node:test";
import assert from "node:assert/strict";
import { solveHands, shapeHelpers } from "../src/viewmodel-hands.js";
import { weaponMesh, weaponSight } from "../src/weapon-models.js";
import { A2B_GUNS, a2bShapes, describe } from "../src/a2b-guns.js";
import { CLASS_IDS } from "../src/loadouts.js";

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

// Every gun, posed against the collision shapes measured from its model.
const CASES = A2B_GUNS.map((g, i) => [
  g.model,
  g.kind,
  () => solveHands(g.kind, a2bShapes(i, shapeHelpers)),
]);
for (const [label, kind, solve] of CASES)
  test(`${label}: hands grip the weapon without sinking into it`, () => {
    const start = performance.now();
    const { sdf, firing, support, magHold, shapes } = solve();
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

test("A2B guns: sight line above the grip, muzzle forward, optics raise the sight", () => {
  A2B_GUNS.forEach((gun, i) => {
    const iron = describe(i, "iron"),
      shapes = a2bShapes(i, shapeHelpers);
    assert.ok(
      iron.sightHeight > shapes.grip.top[1],
      gun.model + " sight above grip",
    );
    assert.ok(
      iron.muzzle[2] < shapes.trigger.c[2] - 0.15,
      gun.model + " muzzle ahead",
    );
    assert.equal(weaponSight(i, "iron"), iron.sightHeight);
    if (gun.kind !== "pistol" && !gun.optic)
      for (const optic of ["reflex", "scope"])
        assert.ok(
          weaponSight(i, optic) > iron.sightHeight,
          gun.model + " " + optic,
        );
  });
  // The LMG's feed cover hinges at its own front edge.
  const lmg = weaponMesh(4, "graphite", "iron");
  assert.ok(lmg.coverPivot && lmg.parts.some((p) => p.name === "cover"));
});
