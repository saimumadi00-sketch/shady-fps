// Footstep cadence and 3D shot routing are pure logic, so they are tested without Web Audio.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  FootstepTracker,
  STRIDE,
  SAMPLE_FILES,
  sampleFor,
} from "../src/audio.js";
import { WEAPONS } from "../src/weapons.js";
import { OfflineSimulation } from "../src/game.js";

const walker = (id, extra = {}) => ({
  id,
  x: 0,
  y: 0,
  z: 0,
  alive: true,
  moving: true,
  sprinting: false,
  crouched: false,
  sliding: false,
  aim: false,
  ...extra,
});
// Move one actor in small steps and collect the cues the tracker emits.
// Positions use integer step counts (and exact quarter-metre steps) to avoid float drift.
function walk(actor, metres, localId = -1, step = 0.25) {
  const tracker = new FootstepTracker(),
    cues = [],
    start = actor.x;
  const emit = (kind, volume, source) => cues.push({ kind, volume, source });
  tracker.update([actor], localId, emit);
  for (let i = 1; i <= Math.round(metres / step); i++) {
    actor.x = start + i * step;
    tracker.update([actor], localId, emit);
  }
  return cues;
}

test("footsteps follow stride length for walking, sprinting and crouching", () => {
  assert.equal(walk(walker(1), 10).length, Math.floor(10 / STRIDE.walk));
  assert.equal(
    walk(walker(1, { sprinting: true }), 11).length,
    Math.floor(11 / STRIDE.sprint),
  );
  assert.equal(
    walk(walker(1, { crouched: true }), 9).length,
    Math.floor(9 / STRIDE.crouch),
  );
});

test("sprint steps are loudest, crouch and aim steps are quieter", () => {
  const loud = walk(walker(1, { sprinting: true }), 3)[0].volume,
    normal = walk(walker(1), 3)[0].volume,
    aimed = walk(walker(1, { aim: true }), 3)[0].volume,
    sneak = walk(walker(1, { crouched: true }), 3)[0].volume;
  assert.ok(loud > normal && normal > aimed && aimed > sneak);
});

test("remote steps are positioned at the actor; the local player's are not", () => {
  const remote = walk(walker(3, { z: 4 }), 3, 0);
  assert.deepEqual(
    { x: remote[0].source.x, z: remote[0].source.z },
    { x: 2, z: 4 },
  );
  const own = walk(walker(0), 3, 0);
  assert.equal(own[0].source, null);
  assert.ok(own[0].volume < remote[0].volume);
});

test("no steps while sliding, airborne, standing, dead or teleporting; landing makes a sound", () => {
  for (const extra of [{ sliding: true }, { y: 1 }, { moving: false }])
    assert.equal(walk(walker(1, extra), 6).length, 0);
  const tracker = new FootstepTracker(),
    cues = [],
    a = walker(1),
    emit = (kind) => cues.push(kind);
  tracker.update([a], -1, emit);
  a.x += 20; // respawn-sized jump
  tracker.update([a], -1, emit);
  assert.equal(cues.length, 0);
  a.alive = false;
  for (let i = 0; i < 40; i++) {
    a.x += 0.1;
    tracker.update([a], -1, emit);
  }
  assert.equal(cues.length, 0);
  a.alive = true;
  a.y = 1;
  tracker.update([a], -1, emit);
  tracker.update([a], -1, emit);
  a.y = 0;
  tracker.update([a], -1, emit);
  assert.deepEqual(cues, ["land"]);
});

test("other actors' shots carry a 3D source; local shots advance the viewmodel counter", () => {
  const calls = [];
  const game = new OfflineSimulation(
    { clear() {} },
    { play: (...args) => calls.push(args) },
    () => 0.5,
  );
  game.start("normal");
  const bot = game.actors[6];
  Object.assign(bot, { cooldown: 0, shield: 0 });
  game.weapons.fire(bot);
  const shot = calls.find((c) => c[0] === "shot");
  assert.deepEqual(shot[3], { x: bot.x, y: bot.y + bot.eye, z: bot.z });
  assert.equal(game.localShots || 0, 0);
  Object.assign(game.player, { cooldown: 0, shield: 0 });
  game.weapons.fire(game.player);
  assert.equal(game.localShots, 1);
  assert.equal(calls.at(-1)[3], undefined, "own gun is not positioned");
});

test("walls muffle positioned sounds; open ground and low crates do not", async () => {
  const { propagation, lineOfSound, OCCLUDED } =
    await import("../src/audio.js");
  const { Arena } = await import("../src/world.js");
  const blocked = lineOfSound(new Arena());
  const ear = { x: -6, y: 1.58, z: 0 };
  // The central block (3.4 m wide at x=0) stands between these two points.
  assert.equal(blocked(ear, { x: 6, y: 0, z: 0 }), true);
  // An open lane between the freight stacks and the crates.
  assert.equal(blocked({ ...ear, z: -10 }, { x: 6, y: 0, z: -10 }), false);
  // A 1.3 m crate between the ear and a standing body does not muffle it.
  assert.equal(
    blocked({ x: -9, y: 1.58, z: -13 }, { x: -1, y: 0, z: -13 }),
    false,
  );
  // Muffled sounds lose highs and level; clear ones keep the distance filter only.
  const clear = propagation(10),
    muffled = propagation(10, true);
  assert.equal(clear.gain, 1);
  assert.equal(muffled.gain, OCCLUDED.gain);
  assert.ok(muffled.cutoff <= OCCLUDED.cutoff && muffled.cutoff < clear.cutoff);
  assert.ok(
    propagation(40).cutoff < propagation(5).cutoff,
    "distance dulls highs",
  );
});

test("every weapon's shot and reload stages map to a shipped recording", () => {
  for (const file of SAMPLE_FILES)
    assert.ok(
      existsSync(new URL("../assets/audio/" + file, import.meta.url)),
      file,
    );
  const used = new Set();
  WEAPONS.forEach((_, w) => {
    for (const kind of ["shot", "mag-out", "mag-in", "rack"]) {
      const s = sampleFor(kind, w);
      assert.ok(SAMPLE_FILES.includes(s.file), kind + " " + w);
      assert.ok(s.tail > 0 && s.rate > 0 && s.gain > 0);
      used.add(s.file);
    }
  });
  // Automatic weapons fade their report quickly so sustained fire cannot exhaust the voices.
  for (const w of [0, 1, 4]) assert.ok(sampleFor("shot", w).tail <= 0.6);
  for (const kind of ["impact", "hurt", "death", "dry"])
    assert.ok(SAMPLE_FILES.includes(sampleFor(kind).file), kind);
  // Footsteps, hit markers and the kill chime stay synthesized.
  for (const kind of ["step", "land", "hit", "headshot", "kill", "reload"])
    assert.equal(sampleFor(kind), null);
});

test("world hits sound at the impact point; an empty gun clicks dry", () => {
  const cues = [];
  const audio = {
    play: (kind, volume, weapon, source) => cues.push({ kind, source }),
  };
  const g = new OfflineSimulation({}, audio, () => 0.5);
  const p = g.player;
  g.match.state = "playing";
  p.alive = true;
  p.cooldown = p.reload = 0;
  p.pitch = -1.2; // straight at the floor
  g.weapons.fire(p);
  const impact = cues.find((c) => c.kind === "impact");
  assert.ok(impact && impact.source, "impact is positioned");
  assert.ok(impact.source.y < p.y + p.eye);
  cues.length = 0;
  p.cooldown = 0;
  const s = p.ammo[p.weapon];
  s.mag = s.reserve = 0;
  g.weapons.fire(p);
  g.weapons.fire(p);
  assert.equal(
    cues.filter((c) => c.kind === "dry").length,
    1,
    "dry fire is throttled",
  );
});
