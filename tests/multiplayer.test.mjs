import test from "node:test";
import assert from "node:assert/strict";
import {
  RoomService,
  NetworkInput,
  INPUT_LIMIT_PER_SECOND,
} from "../server/rooms.mjs";
import { WEAPONS } from "../src/weapons.js";
import { createMultiplayerServer } from "../server/index.mjs";
function setup(mode = "tdm") {
  let now = 0;
  const service = new RoomService({ now: () => now });
  const host = service.join({ name: "Host", team: 0, mode }, true);
  const friend = service.join({
    name: "Friend",
    team: 1,
    code: host.room.code,
    classId: "recon",
  });
  host.stream = friend.stream = { end() {} };
  service.start(host);
  host.room.game.bots.update = () => {};
  return {
    service,
    host,
    friend,
    advance: (n) => {
      for (let i = 0; i < n; i++) {
        now += 1000 / 60;
        service.tick(1 / 60);
      }
    },
    clock: (n) => (now = n),
  };
}
test("rooms assign independent humans, preserve loadouts and fill remaining slots with bots", () => {
  const { host, friend, service } = setup();
  assert.equal(service.snapshot(host).playerId, 0);
  assert.equal(service.snapshot(friend).playerId, 5);
  assert.equal(friend.actor.weapon, 3);
  assert.equal(host.room.controllers.size, 2);
  assert.equal(host.room.game.actors.length, 10);
  assert.throws(() => service.start(friend), /Only the room host/);
  assert.throws(() => service.start(host), /already playing/);
  const second = service.join({ mode: "conquest" }, true);
  assert.notEqual(second.room, host.room);
  assert.equal(second.room.game.mode, "conquest");
  assert.equal(second.room.game.match.state, "menu");
});
test("team capacity, host transfer, disconnect bot replacement and empty cleanup", () => {
  const { service, host, friend } = setup();
  for (let i = 0; i < 4; i++) service.join({ code: host.room.code, team: 0 });
  assert.throws(
    () => service.join({ code: host.room.code, team: 0 }),
    /team is full/,
  );
  service.leave(host);
  assert.equal(friend.room.host, friend.token);
  assert.equal(friend.room.controllers.has(0), false);
  for (const client of [...service.sessions.values()]) service.leave(client);
  assert.equal(service.rooms.size, 0);
  assert.equal(service.sessions.size, 0);
});
test("network controls reject malformed values, duplicate edges and client combat authority", () => {
  const input = new NetworkInput();
  input.accept({
    seq: 1,
    dx: Infinity,
    dy: NaN,
    moveX: 100,
    keys: ["KeyW", "hack"],
    actions: ["Space", "hack"],
    fire: "true",
  });
  assert.equal(input.dx, 0);
  assert.equal(input.dy, 0);
  assert.equal(input.moveX, 1);
  assert.equal(input.fire, false);
  assert.deepEqual([...input.keys], ["KeyW"]);
  assert.equal(input.consume("Space"), true);
  assert.equal(input.accept({ seq: 1, actions: ["Space"] }), false);
  assert.equal(input.consume("Space"), false);
  const { service, host, friend } = setup();
  const before = {
    x: host.actor.x,
    hp: friend.actor.hp,
    score: [...host.room.game.match.scores],
  };
  service.input(host, {
    seq: 1,
    x: 9999,
    hp: 0,
    scores: [30, 0],
    target: friend.actor.id,
  });
  assert.equal(host.actor.x, before.x);
  assert.equal(friend.actor.hp, before.hp);
  assert.deepEqual(host.room.game.match.scores, before.score);
  for (let i = 0; i < INPUT_LIMIT_PER_SECOND - 1; i++)
    service.input(host, { seq: 2 + i });
  assert.throws(() => service.input(host, { seq: 999 }), /Too many/);
});
test("both clients receive server movement, stale controls stop and classes cannot equip forbidden guns", () => {
  const { service, host, friend, advance } = setup();
  const before = host.actor.x;
  service.input(host, { seq: 1, keys: ["KeyW"], actions: ["Digit5"] });
  advance(12);
  assert.notEqual(host.actor.x, before);
  assert.equal(host.actor.weapon, 0);
  assert.equal(
    service.snapshot(friend).actors[0].x,
    service.snapshot(host).actors[0].x,
  );
  advance(15);
  const stopped = host.actor.x;
  advance(12);
  assert.equal(host.actor.x, stopped);
});
test("shared TDM shot, ammo, deaths, score and respawn are authoritative for either team", () => {
  const { service, host, friend, advance } = setup();
  const g = host.room.game;
  for (const a of g.actors)
    if (a !== host.actor && a !== friend.actor) {
      a.alive = false;
      a.respawn = 999;
    }
  Object.assign(host.actor, {
    x: -4,
    z: 0,
    y: 0,
    yaw: Math.PI / 2,
    pitch: 0,
    shield: 0,
    cooldown: 0,
    hp: 1,
  });
  Object.assign(friend.actor, {
    x: 4,
    z: 0,
    y: 0,
    yaw: -Math.PI / 2,
    pitch: 0,
    shield: 0,
    cooldown: 0,
    weapon: 3,
  });
  g.random = () => 0;
  g.arena.ray = () => 100;
  service.input(friend, { seq: 1, actions: ["fire"], fire: true });
  advance(1);
  assert.equal(host.actor.alive, false);
  assert.equal(friend.actor.ammo[3].mag, WEAPONS[3].magazine - 1);
  assert.deepEqual(service.snapshot(host).match.scores, [0, 1]);
  assert.equal(service.snapshot(host).actors[5].kills, 1);
  advance(181);
  assert.equal(host.actor.alive, true);
  assert.equal(host.actor.hp, 100);
});
test("shared conquest capture, contested sectors, tickets and victory replicate identically", () => {
  const { service, host, friend, advance } = setup("conquest");
  const g = host.room.game,
    s = g.match.sectors[0];
  for (const a of g.actors)
    if (a !== host.actor && a !== friend.actor) {
      a.alive = false;
      a.respawn = 999;
    }
  Object.assign(host.actor, { x: s.x, z: s.z, y: 0 });
  Object.assign(friend.actor, { x: s.x, z: s.z, y: 0 });
  advance(60);
  assert.equal(service.snapshot(host).match.sectors[0].contested, true);
  Object.assign(friend.actor, {
    x: g.arena.spawns[1][0].x,
    z: g.arena.spawns[1][0].z,
  });
  advance(500);
  assert.equal(s.owner, 0);
  advance(120);
  assert.ok(g.match.scores[1] < 150);
  assert.deepEqual(
    service.snapshot(host).match,
    service.snapshot(friend).match,
  );
  g.match.scores[1] = 1;
  advance(120);
  assert.equal(g.match.state, "ended");
  assert.equal(g.match.winner, 0);
  service.start(host);
  assert.deepEqual(g.match.scores, [150, 150]);
  assert.equal(s.owner, null);
  assert.equal(friend.actor.classId, "recon");
});
test("HTTP create/join, authenticated streaming, start permissions and static files work together", async () => {
  const app = createMultiplayerServer({ realtime: false });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (path, data = {}, token) => {
    const res = await fetch(base + "/api/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(data),
    });
    return { status: res.status, data: await res.json() };
  };
  let abort;
  try {
    const host = await post("create", { mode: "conquest", name: "Host" });
    assert.equal(host.status, 200);
    const friend = await post("join", { code: host.data.code, team: 1 });
    assert.equal(friend.status, 200);
    assert.equal((await post("start", {}, friend.data.token)).status, 400);
    assert.equal((await post("start", {}, host.data.token)).status, 200);
    assert.equal((await post("input", { seq: 1 }, "invalid")).status, 401);
    const bad = await fetch(base + "/api/create", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(bad.status, 403);
    abort = new AbortController();
    const stream = await fetch(base + "/api/events", {
      headers: { Authorization: "Bearer " + friend.data.token },
      signal: abort.signal,
    });
    const reader = stream.body.getReader();
    const { value } = await reader.read();
    const state = JSON.parse(new TextDecoder().decode(value).trim());
    assert.equal(state.playerId, 5);
    assert.equal(state.match.state, "playing");
    assert.equal(state.players.length, 2);
    assert.equal((await fetch(base + "/arena.html")).status, 200);
    assert.equal((await post("leave", {}, host.data.token)).status, 200);
    assert.equal(
      app.service.sessions.get(friend.data.token).room.host,
      friend.data.token,
    );
  } finally {
    abort?.abort();
    app.close();
  }
});

test("two real network clients stream the same match and pausing sends neutral input without pausing the server", async () => {
  const { NetworkClient } = await import("../src/network.js");
  const { OfflineSimulation } = await import("../src/game.js");
  const app = createMultiplayerServer();
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (check) => {
    for (let i = 0; i < 120; i++) {
      if (check()) return;
      await sleep(25);
    }
    assert.ok(check(), "stream did not deliver expected state");
  };
  function client() {
    const input = new NetworkInput();
    input.active = true;
    const game = new OfflineSimulation(input, { play() {} }, Math.random, {
      mode: "conquest",
    });
    const client = new NetworkClient(game, input, {
      base,
      onState() {},
      onDisconnect() {},
    });
    return { input, game, client };
  }
  const a = client(),
    b = client();
  let timer;
  try {
    await a.client.join({ mode: "conquest", team: 0, name: "Cyan" }, true);
    await until(() => a.client.ready);
    await b.client.join(
      { code: a.client.code, team: 1, name: "Ember", classId: "recon" },
      false,
    );
    await until(() => b.client.ready);
    await a.client.request("start");
    await until(() => b.game.match.state === "playing");
    const room = app.service.rooms.get(a.client.code);
    room.game.bots.update = () => {};
    timer = setInterval(() => {
      a.client.send();
      b.client.send();
    }, 1000 / 30);
    assert.equal(b.game.player.id, 5);
    assert.equal(b.game.player.weapon, 3);
    const before = b.game.player.x;
    b.input.keys.add("KeyW");
    await until(() => Math.abs(b.game.player.x - before) > 0.3);
    b.input.keys.clear();
    await until(() => Math.abs(a.game.actors[5].x - b.game.player.x) < 0.1);
    await until(() => room.game.actors[5].cooldown === 0);
    b.input.actions.add("fire");
    b.input.fire = true;
    await until(() => b.game.player.ammo[3].mag === WEAPONS[3].magazine - 1);
    b.input.fire = false;
    assert.equal(a.game.match.scores[0], b.game.match.scores[0]);
    b.input.active = false;
    b.input.keys.add("KeyW");
    const remaining = b.game.match.remaining;
    await sleep(150);
    const stopped = room.game.actors[5].x;
    await sleep(150);
    assert.equal(room.game.actors[5].x, stopped);
    assert.ok(b.game.match.remaining < remaining - 0.1);
    assert.equal(room.game.match.state, "playing");
    room.game.match.scores = [5, 0];
    room.game.match.finish();
    await until(
      () => a.game.match.state === "ended" && b.game.match.state === "ended",
    );
    assert.deepEqual(a.game.match.scores, b.game.match.scores);
    assert.equal(b.game.match.winner, 0);
    await a.client.request("start");
    await until(() => b.game.match.state === "playing");
    assert.deepEqual(b.game.match.scores, [150, 150]);
    await a.client.leave();
    await until(() => b.client.host);
    assert.equal(room.controllers.has(0), false);
    await b.client.leave();
    assert.equal(app.service.rooms.size, 0);
  } finally {
    clearInterval(timer);
    a.client.disconnect();
    b.client.disconnect();
    app.close();
  }
});

test("abandoned reservations expire and API snapshot streams bypass the offline worker", async () => {
  let now = 0;
  const service = new RoomService({ now: () => now });
  service.join({}, true);
  now = 10001;
  service.tick(1 / 60);
  assert.equal(service.rooms.size, 0);
  const { readFile } = await import("node:fs/promises");
  const { default: vm } = await import("node:vm");
  const source = await readFile("sw.js", "utf8");
  const handlers = {};
  vm.runInNewContext(source, {
    URL,
    location: { origin: "https://game.test" },
    self: {
      registration: { scope: "https://game.test/" },
      addEventListener: (name, cb) => (handlers[name] = cb),
    },
  });
  handlers.fetch({
    request: { method: "GET", url: "https://game.test/api/events" },
    respondWith() {
      assert.fail("stream should bypass cache");
    },
  });
});

test("idle clients expire despite neutral heartbeats, transfer hosting and release capacity", () => {
  let now = 0;
  const service = new RoomService({
    now: () => now,
    maxRooms: 1,
    idleTimeoutMs: 1000,
  });
  const host = service.join({}, true);
  const friend = service.join({ code: host.room.code, team: 1 });
  let closed = 0;
  host.stream = friend.stream = {
    end() {
      closed++;
    },
  };
  now = 900;
  service.input(host, { seq: 0, keys: [], actions: [], dx: 0, dy: 0 });
  service.input(friend, { seq: 0, keys: ["KeyW"] });
  now = 1000;
  service.tick(1 / 60);
  assert.equal(service.sessions.has(host.token), false);
  assert.equal(service.sessions.has(friend.token), true);
  assert.equal(friend.room.host, friend.token);
  assert.equal(friend.room.controllers.has(host.actor.id), false);
  assert.equal(closed, 1);
  now = 1900;
  service.tick(1 / 60);
  assert.equal(service.rooms.size, 0);
  assert.equal(service.sessions.size, 0);
  assert.equal(closed, 2);
  assert.ok(service.join({}, true));
});

test("idle timeout is renewed by valid activity and host start, not stale input", () => {
  let now = 0;
  const service = new RoomService({ now: () => now, idleTimeoutMs: 1000 });
  const host = service.join({}, true);
  host.stream = { end() {} };
  now = 500;
  service.start(host);
  now = 1400;
  service.tick(1 / 60);
  assert.equal(service.sessions.size, 1);
  service.input(host, {
    seq: 1,
    view: { yaw: 0.2, pitch: 0, spawnId: host.actor.spawnId },
  });
  now = 2200;
  service.input(host, { seq: 1, keys: ["KeyW"] });
  service.tick(1 / 60);
  assert.equal(service.sessions.size, 1);
  now = 2400;
  service.tick(1 / 60);
  assert.equal(service.sessions.size, 0);
});

test("remote presentation interpolates poses and wrapped angles without changing authority", async () => {
  const { SnapshotInterpolator } =
    await import("../src/network-interpolation.js");
  const buffer = new SnapshotInterpolator({ delayMs: 100 });
  const actor = {
    id: 1,
    x: 0,
    y: 0,
    z: 0,
    eye: 1.5,
    pitch: 0,
    yaw: Math.PI - 0.1,
    alive: true,
    shield: 0,
  };
  const packet = (a, time = 1, state = "playing") => ({
    code: "ROOM",
    playerId: 0,
    time,
    match: { state },
    actors: [{ ...a }],
  });
  buffer.push(packet(actor), 0);
  const latest = { ...actor, x: 1, yaw: -Math.PI + 0.1 };
  buffer.push(packet(latest, 1.05), 50);
  const local = { ...actor, id: 0, x: 8 };
  const poses = buffer.sample([local, latest], 0, 125);
  assert.equal(poses[0], local);
  assert.equal(poses[1].x, 0.5);
  assert.ok(Math.abs(poses[1].yaw - Math.PI) < 1e-9);
  assert.equal(latest.x, 1);
  assert.equal(buffer.sample([latest], 0, 1000)[0].x, 1);
  assert.equal(
    buffer.sample([{ ...latest, alive: false }], 0, 125)[0].alive,
    false,
  );
  assert.equal(buffer.sample([{ ...latest, x: 20 }], 0, 125)[0].x, 20);
  assert.equal(buffer.sample([{ ...latest, shield: 2 }], 0, 125)[0].x, 1);
  buffer.push(packet({ ...latest, x: 10 }, 0), 100);
  assert.equal(buffer.sample([{ ...latest, x: 10 }], 0, 150)[0].x, 10);
  buffer.push(packet({ ...latest, x: 12 }, 0, "menu"), 150);
  assert.equal(buffer.frames.length, 1);
  for (let i = 0; i < 50; i++)
    buffer.push(packet(latest, i, "menu"), 200 + i * 50);
  assert.ok(buffer.frames.length <= 12);
  buffer.clear();
  assert.equal(buffer.sample([local], 0, 5000)[0], local);
});

// Clients own view angles for the current life only; stale lives and bad values are ignored.
test("absolute client view angles are validated and tied to the current life", () => {
  const { service, host, advance } = setup();
  const a = host.actor;
  service.input(host, {
    seq: 1,
    view: { yaw: 1.25, pitch: 9, spawnId: a.spawnId },
  });
  advance(1);
  assert.equal(a.yaw, 1.25);
  assert.equal(a.pitch, 1.45);
  const spawnYaw = (host.room.game.spawns.spawn(a), a.yaw);
  service.input(host, {
    seq: 2,
    view: { yaw: -2, pitch: 0, spawnId: a.spawnId - 1 },
  });
  advance(1);
  assert.equal(a.yaw, spawnYaw);
  service.input(host, { seq: 3, view: { yaw: NaN, pitch: 0, spawnId: 1 } });
  assert.equal(host.input.view, null);
});

// Other players' snapshots omit private ammo and internal movement state.
test("snapshots hide other players' private state", () => {
  const { service, host, friend } = setup();
  const snap = service.snapshot(host);
  const self = snap.actors[host.actor.id],
    other = snap.actors[friend.actor.id];
  assert.ok(Array.isArray(self.ammo));
  assert.equal(other.ammo, undefined);
  assert.equal(other.fireDelay, undefined);
  assert.equal(typeof other.x, "number");
  assert.ok(Array.isArray(host.actor.ammo));
});
// Recoil applied by the server accumulates across ticks even though the client keeps sending
// the same raw view, and it resets with each new life.
test("server recoil accumulates on top of held client aim and resets on respawn", () => {
  const { service, host, advance } = setup();
  const g = host.room.game,
    a = host.actor;
  for (const b of g.actors)
    if (b !== a) Object.assign(b, { alive: false, respawn: 999 });
  Object.assign(a, { shield: 0, cooldown: 0 });
  service.input(host, {
    seq: 1,
    view: { yaw: 0.5, pitch: 0, spawnId: a.spawnId },
    fire: true,
  });
  advance(20);
  const fired = WEAPONS[a.weapon].magazine - a.ammo[a.weapon].mag;
  assert.ok(fired >= 2);
  const expected = fired * WEAPONS[a.weapon].recoil * (Math.PI / 180);
  assert.ok(Math.abs(a.recoilPitch - expected) < 1e-9);
  assert.ok(Math.abs(a.pitch - expected) < 1e-9, "raw pitch 0 + server recoil");
  assert.ok(Math.abs(a.yaw - (0.5 + a.recoilYaw)) < 1e-9);
  // Raw aim beyond the view limit is allowed, but the combined angle is clamped.
  service.input(host, {
    seq: 2,
    view: { yaw: 0.5, pitch: -5, spawnId: a.spawnId },
  });
  advance(1);
  assert.equal(a.pitch, -1.45);
  g.spawns.spawn(a);
  assert.equal(a.recoilPitch, 0);
  assert.equal(a.recoilYaw, 0);
});
// Another player's snapshot hides recoil, and sector spawn lists never leave the server.
test("snapshots omit others' recoil and static sector spawn points", () => {
  const { service, host, friend } = setup("conquest");
  const snap = service.snapshot(host);
  assert.equal("recoilPitch" in snap.actors[friend.actor.id], false);
  assert.equal("recoilPitch" in snap.actors[host.actor.id], true);
  assert.ok(snap.match.sectors.length > 0);
  for (const s of snap.match.sectors) {
    assert.equal("spawnPoints" in s, false);
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.radius));
  }
  assert.ok(host.room.game.match.sectors[0].spawnPoints.length > 0);
});
// Player-facing room errors keep their text; internal exceptions do not leak details.
test("HTTP errors keep room messages but hide internal exception text", async () => {
  const app = createMultiplayerServer({ realtime: false });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const missing = await fetch(base + "/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "NOPE" }),
    });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /Room not found/);
    const malformed = await fetch(base + "/%E0%A4%A");
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "Request failed.");
  } finally {
    app.close();
  }
});
// The client sends raw aim, shows predicted recoil on top, and settles on server recoil after a burst.
test("network client keeps raw aim separate from predicted and server recoil", async () => {
  const { NetworkClient } = await import("../src/network.js");
  const { OfflineSimulation } = await import("../src/game.js");
  const { service, host } = setup();
  const local = new OfflineSimulation(
    { clear() {} },
    { play() {} },
    Math.random,
  );
  const input = {
    active: true,
    dx: 0,
    dy: 0,
    fire: false,
    firePresses: 0,
    touch: false,
    clear() {},
  };
  const client = new NetworkClient(local, input, {
    onState() {},
    onDisconnect() {},
  });
  const a = host.actor;
  Object.assign(a, { shield: 0, cooldown: 0, pitch: 0.1, yaw: 0.3 });
  client.apply(service.snapshot(host));
  const me = local.player;
  assert.equal(client.view.pitch, 0.1);
  // A predicted semi-auto shot raises the displayed pitch but not the raw view sent upstream.
  me.weapon = 2;
  client.predicted.weapon = 2;
  client.predicted.mag = 5;
  input.firePresses++;
  client.updateView(1 / 60, 1);
  const kick = WEAPONS[2].recoil * (Math.PI / 180);
  assert.equal(client.view.pitch, 0.1);
  assert.ok(Math.abs(me.pitch - (0.1 + kick)) < 1e-9);
  // After the burst, the server's recoil total replaces the prediction.
  a.recoilPitch = 2 * kick;
  a.recoilYaw = 0.01;
  a.pitch = 0.1 + 2 * kick;
  client.predicted.lastShot = -Infinity;
  client.apply(service.snapshot(host));
  assert.equal(client.predicted.recoilPitch, 2 * kick);
  assert.ok(Math.abs(me.pitch - (0.1 + 2 * kick)) < 1e-9);
  assert.ok(Math.abs(me.yaw - (client.view.yaw + 0.01)) < 1e-9);
  // A new life adopts server angles with any recoil already stripped from the raw view.
  host.room.game.spawns.spawn(a);
  a.recoilPitch = kick;
  a.pitch += kick;
  client.apply(service.snapshot(host));
  assert.ok(Math.abs(client.view.pitch + kick - a.pitch) < 1e-9);
  assert.ok(Math.abs(me.pitch - a.pitch) < 1e-9);
});
