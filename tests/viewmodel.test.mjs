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
        // Only a faint breathing drift remains behind the sights.
        assert.ok(Math.abs(pose.x) < 3e-4);
        assert.ok(Math.abs(pose.y + sightHeight) < 5e-4);
        assert.ok(Math.abs(pose.yaw) < 1e-9);
        assert.ok(Math.abs(pose.pitch) < 1e-9);
        assert.ok(Math.abs(pose.roll) < 1e-9);
      }
      assert.deepEqual(actor, before);
    }
});

test("hip motion stays bounded and reload lifts suppress sprint lowering", () => {
  const actor = {
    weapon: 2,
    moving: true,
    sprinting: false,
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
    assert.ok(Math.abs(pose.x - 0.2) <= 0.006);
    assert.ok(pose.y > -0.245 && pose.y < -0.225);
    assert.ok(Object.values(pose).every(Number.isFinite));
  }
  // Sprinting drops to a low-ready carry: muzzle down, swung across and rolled.
  actor.sprinting = true;
  const sprint = viewmodelPose(actor, 0, 0, { active: false, lift: 0 }, 0.16);
  assert.ok(sprint.y < -0.29 && sprint.pitch < -0.2 && sprint.roll > 0.3);
  actor.moving = false;
  const reload = viewmodelPose(actor, 0, 0, { active: true, lift: 1 }, 0.16);
  assert.ok(Math.abs(reload.y + 0.135) < 1e-9);
});

test("ADS raise follows an arc: lifts before centring and cants mid-way", async () => {
  const { easeAim } = await import("../src/viewmodel.js");
  const actor = {
    weapon: 0,
    moving: false,
    sprinting: false,
    sliding: false,
    kick: 0,
  };
  const rest = { active: false, lift: 0 };
  const at = (t) => viewmodelPose(actor, 0, easeAim(t), rest, 0.16);
  const hip = at(0),
    mid = at(0.5),
    aimed = at(1);
  const yDone = (mid.y - hip.y) / (aimed.y - hip.y),
    xDone = (hip.x - mid.x) / (hip.x - aimed.x);
  assert.ok(yDone > xDone, "height leads the sideways slide");
  assert.ok(
    mid.roll > hip.roll && mid.pitch < 0,
    "gun cants and dips in transit",
  );
  assert.ok(easeAim(0) === 0 && easeAim(1) === 1 && easeAim(0.5) === 0.5);
});

test("motion sway trails turns, settles at rest and stays tight when aimed", async () => {
  const { ViewmodelMotion } = await import("../src/viewmodel.js");
  const m = new ViewmodelMotion();
  const actor = { x: 0, z: 0, yaw: 0, pitch: 0, vy: 0, weapon: 0, kick: 0 };
  const rest = { active: false, lift: 0 };
  m.update(1 / 60, actor);
  for (let i = 0; i < 10; i++) {
    actor.yaw += 0.05; // turning right
    m.update(1 / 60, actor);
  }
  const hip = viewmodelPose(actor, 0, 0, rest, 0.16, null, m),
    aimed = viewmodelPose(actor, 0, 1, rest, 0.16, null, m);
  assert.ok(m.swayX < 0 && m.swayYaw > 0, "gun lags left of a right turn");
  assert.ok(Math.abs(aimed.x) < Math.abs(hip.x - 0.25) * 0.3);
  for (let i = 0; i < 120; i++) m.update(1 / 60, actor);
  for (const k of ["swayX", "swayY", "swayYaw", "swayPitch", "swayRoll", "air"])
    assert.ok(Math.abs(m[k]) < 1e-3, k + " settles");
  // Landing from a fall dips the gun.
  actor.vy = -8;
  m.update(1 / 60, actor);
  actor.vy = 0;
  m.update(1 / 60, actor);
  for (let i = 0; i < 3; i++) m.update(1 / 60, actor);
  assert.ok(m.air < 0);
});

test("gun recoil snaps back and up, then settles to rest", async () => {
  const { GunRecoil } = await import("../src/viewmodel.js");
  const r = new GunRecoil();
  r.kick(1, 0, 1);
  let peakBack = 0,
    peakPitch = 0;
  for (let i = 0; i < 10; i++) {
    r.update(1 / 120);
    peakBack = Math.max(peakBack, r.back);
    peakPitch = Math.max(peakPitch, r.pitch);
  }
  assert.ok(peakBack > 0.03, "gun pushes toward the camera");
  assert.ok(peakPitch > 0.05, "muzzle climbs");
  assert.ok(r.yaw > 0);
  for (let i = 0; i < 60; i++) r.update(1 / 60);
  for (const k of ["back", "up", "pitch", "yaw", "roll"])
    assert.ok(Math.abs(r[k]) < 1e-3, k + " settles");
});

test("aimed and lighter weapons kick less; sustained fire stays bounded", async () => {
  const { GunRecoil } = await import("../src/viewmodel.js");
  const peak = (strength, aim) => {
    const r = new GunRecoil();
    r.kick(strength, aim);
    let p = 0;
    for (let i = 0; i < 20; i++) p = Math.max(p, r.update(1 / 120).pitch);
    return p;
  };
  assert.ok(peak(1, 1) < peak(1, 0) * 0.5);
  assert.ok(peak(0.6, 0) < peak(2.4, 0));
  const r = new GunRecoil();
  for (let i = 0; i < 200; i++) {
    r.kick(2.4, 0, 1);
    r.update(1 / 60);
  }
  assert.ok(r.back <= 0.11 && r.pitch <= 0.22 && r.yaw <= 0.06);
});

test("viewmodel pose applies recoil offsets and muzzle pitch", async () => {
  const { GunRecoil } = await import("../src/viewmodel.js");
  const actor = {
    weapon: 0,
    moving: false,
    sprinting: false,
    sliding: false,
    kick: 0,
  };
  const reload = { active: false, lift: 0 };
  const rest = viewmodelPose(actor, 0, 0, reload, 0.16, new GunRecoil());
  const r = new GunRecoil();
  r.kick(1);
  r.update(1 / 30);
  const kicked = viewmodelPose(actor, 0, 0, reload, 0.16, r);
  assert.equal(rest.pitch, 0);
  assert.ok(kicked.z > rest.z && kicked.y > rest.y && kicked.pitch > 0);
});

test("weapon draw rises from below, overshoots slightly and settles", async () => {
  const { ViewmodelMotion, drawOffset } = await import("../src/viewmodel.js");
  assert.equal(drawOffset(0), 1);
  assert.equal(drawOffset(1), 0);
  assert.ok(drawOffset(0.9) < 0 && drawOffset(0.9) > -0.05, "small overshoot");
  const m = new ViewmodelMotion().raise(0.3);
  const actor = { x: 0, z: 0, yaw: 0, pitch: 0, vy: 0, weapon: 0, kick: 0 };
  const rest = { active: false, lift: 0 };
  const start = viewmodelPose(actor, 0, 0, rest, 0.16, null, m);
  for (let i = 0; i < 30; i++) m.update(1 / 60, actor);
  const done = viewmodelPose(actor, 0, 0, rest, 0.16, null, m);
  assert.ok(start.y < done.y - 0.2 && start.pitch < done.pitch - 0.5);
  assert.equal(m.draw, 1);
});

test("crouching tucks the gun and stance changes dip it", async () => {
  const { ViewmodelMotion } = await import("../src/viewmodel.js");
  const m = new ViewmodelMotion();
  const actor = { x: 0, z: 0, yaw: 0, pitch: 0, vy: 0, weapon: 0, kick: 0 };
  const rest = { active: false, lift: 0 };
  for (let i = 0; i < 60; i++) m.update(1 / 60, actor);
  const stand = viewmodelPose(actor, 0, 0, rest, 0.16, null, m);
  actor.crouched = true;
  for (let i = 0; i < 4; i++) m.update(1 / 60, actor);
  assert.ok(m.air < 0, "dips on crouch");
  for (let i = 0; i < 120; i++) m.update(1 / 60, actor);
  const crouch = viewmodelPose(actor, 0, 0, rest, 0.16, null, m);
  assert.ok(crouch.y < stand.y && crouch.roll > stand.roll);
  // Aiming cancels the crouch carry so the sights stay centred.
  const aimedStand = viewmodelPose(
    { ...actor, crouched: false },
    0,
    1,
    rest,
    0.16,
  );
  const aimedCrouch = viewmodelPose(actor, 0, 1, rest, 0.16, null, m);
  assert.ok(Math.abs(aimedCrouch.y - aimedStand.y) < 0.002);
});
