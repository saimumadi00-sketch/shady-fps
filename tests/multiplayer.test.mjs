import test from "node:test";
import assert from "node:assert/strict";
import { RoomService, NetworkInput } from "../server/rooms.mjs";
import { createMultiplayerServer } from "../server/index.mjs";
function setup(mode = "tdm") {
  let now = 0;
  const service = new RoomService({ now: () => now });
  const host = service.join({ name: "Host", team: 0, mode }, true);
  const friend = service.join({
    name: "Friend",
    team: 1,
    code: host.room.code,
    classId: "scout",
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
  for (let i = 0; i < 89; i++) service.input(host, { seq: 2 + i });
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
  g.random = () => 0.5;
  g.arena.ray = () => 100;
  service.input(friend, { seq: 1, actions: ["fire"], fire: true });
  advance(1);
  assert.equal(host.actor.alive, false);
  assert.equal(friend.actor.ammo[3].mag, 9);
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
  assert.equal(friend.actor.classId, "scout");
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
      { code: a.client.code, team: 1, name: "Ember", classId: "scout" },
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
    await until(() => b.game.player.ammo[3].mag === 9);
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
