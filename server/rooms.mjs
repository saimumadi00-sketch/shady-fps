// Private rooms own the simulation. Clients can submit controls, never combat results.
import { randomBytes } from "node:crypto";
import { OfflineSimulation } from "../src/game.js";
import { PlayerController } from "../src/player.js";
import { CLASS_IDS, loadout } from "../src/loadouts.js";
const KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ShiftLeft",
  "ShiftRight",
  "KeyC",
  "ControlLeft",
  "ControlRight",
]);
const ACTIONS = new Set([
  "Space",
  "KeyR",
  "fire",
  "switch",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
]);
const finite = (v, limit) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(-limit, Math.min(limit, v))
    : 0;
export class NetworkInput {
  constructor() {
    this.clear();
    this.seq = -1;
  }
  clear() {
    this.keys = new Set();
    this.actions = new Set();
    this.dx = this.dy = this.moveX = this.moveY = 0;
    this.fire = this.aim = this.touch = this.touchCrouch = false;
  }
  consume(key) {
    const value = this.actions.has(key);
    this.actions.delete(key);
    return value;
  }
  accept(data) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= this.seq) return false;
    this.seq = data.seq;
    this.keys = new Set(
      Array.isArray(data.keys)
        ? data.keys.slice(0, 16).filter((k) => KEYS.has(k))
        : [],
    );
    for (const k of Array.isArray(data.actions)
      ? data.actions.slice(0, 16)
      : [])
      if (ACTIONS.has(k)) this.actions.add(k);
    this.dx = finite(this.dx + finite(data.dx, 1200), 2400);
    this.dy = finite(this.dy + finite(data.dy, 1200), 2400);
    this.moveX = finite(data.moveX, 1);
    this.moveY = finite(data.moveY, 1);
    for (const key of ["fire", "aim", "touch", "touchCrouch"])
      this[key] = data[key] === true;
    return true;
  }
}
export class RoomService {
  constructor({ now = Date.now, maxRooms = 20 } = {}) {
    this.now = now;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
    this.sessions = new Map();
  }
  join(data = {}, create = false) {
    let room;
    if (create) {
      if (this.rooms.size >= this.maxRooms)
        throw new Error("Server room limit reached.");
      let code;
      do {
        code = randomBytes(4).toString("hex").toUpperCase();
      } while (this.rooms.has(code));
      const controllers = new Map();
      const game = new OfflineSimulation(
        new NetworkInput(),
        { play() {} },
        Math.random,
        { mode: data.mode, humanControllers: controllers },
      );
      room = { code, game, clients: new Map(), host: null, controllers };
      room.names = game.actors.map((a) => (a.id === 0 ? "Pilot" : a.name));
      this.rooms.set(code, room);
    } else {
      room = this.rooms.get(String(data.code || "").toUpperCase());
      if (!room)
        throw new Error("Room not found. Check the code and game server.");
    }
    const team = data.team === 1 ? 1 : 0;
    const actor = room.game.actors.find(
      (a) => a.team === team && !room.controllers.has(a.id),
    );
    if (!actor) throw new Error("That team is full. Choose the other team.");
    const classId = CLASS_IDS.includes(data.classId) ? data.classId : "assault";
    const token = randomBytes(24).toString("hex");
    const input = new NetworkInput();
    const client = {
      token,
      room,
      actor,
      input,
      classId,
      weapon: loadout(classId).weapons.includes(data.weapon)
        ? data.weapon
        : loadout(classId).primary,
      lastInput: this.now(),
      created: this.now(),
      stream: null,
      rateAt: this.now(),
      requests: 0,
    };
    actor.name =
      String(data.name || "Pilot")
        .replace(/[\x00-\x1F\x7F]/g, "")
        .trim()
        .slice(0, 16) || "Pilot";
    actor.classId = classId;
    actor.weapon = client.weapon;
    actor.kills = actor.deaths = 0;
    room.game.spawns.spawn(actor);
    room.controllers.set(
      actor.id,
      new PlayerController(room.game, input, actor),
    );
    room.clients.set(token, client);
    this.sessions.set(token, client);
    if (!room.host) room.host = token;
    return client;
  }
  start(client) {
    const room = client.room;
    if (room.host !== client.token)
      throw new Error("Only the room host can start or restart.");
    if (room.game.match.state === "playing")
      throw new Error("The match is already playing.");
    room.game.start("normal");
    for (const c of room.clients.values()) {
      c.input.clear();
      c.actor.classId = c.classId;
      c.actor.weapon = c.weapon;
      room.game.spawns.spawn(c.actor);
    }
  }
  input(client, data) {
    const now = this.now();
    if (now - client.rateAt >= 1000) {
      client.rateAt = now;
      client.requests = 0;
    }
    if (++client.requests > 90) throw new Error("Too many input requests.");
    if (client.input.accept(data)) client.lastInput = now;
  }
  leave(client) {
    if (!this.sessions.has(client.token)) return;
    this.sessions.delete(client.token);
    const room = client.room;
    room.clients.delete(client.token);
    room.controllers.delete(client.actor.id);
    client.actor.name = room.names[client.actor.id];
    client.input.clear();
    if (room.host === client.token)
      room.host = room.clients.keys().next().value || null;
    if (!room.clients.size) this.rooms.delete(room.code);
    client.stream?.end();
  }
  tick(dt) {
    for (const c of this.sessions.values()) {
      if (this.now() - c.lastInput > 350) c.input.clear();
      if (!c.stream && this.now() - c.created > 10000) this.leave(c);
    }
    for (const room of this.rooms.values()) room.game.update(dt);
  }
  snapshot(client) {
    const { room, actor } = client,
      g = room.game;
    return {
      code: room.code,
      mode: g.mode,
      playerId: actor.id,
      host: room.host === client.token,
      players: [...room.clients.values()].map((c) => ({
        id: c.actor.id,
        name: c.actor.name,
        team: c.actor.team,
        host: c.token === room.host,
      })),
      time: g.time,
      match: {
        state: g.match.state,
        scores: g.match.scores,
        remaining: g.match.remaining,
        winner: g.match.winner,
        sectors: g.match.sectors,
      },
      // Keep AI paths and targets out of the transport. These are presentation fields only.
      actors: g.actors.map(({ brain, ...a }) => a),
      effects: g.effects.items.filter((e) => e.life > 0),
      events: g.events.filter((e) => e.time > 0),
    };
  }
}
