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
  for (const k of ["back", "up", "pitch", "yaw"])
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
