import { SnapshotInterpolator } from "./network-interpolation.js";
import { aimScale, FIRE_BUFFER } from "./player.js";
import {
  WEAPONS,
  recoilFor,
  trackRecoil,
  compensateRecoil,
  recoverRecoil,
  resetRecoil,
} from "./weapons.js";
import { clamp } from "./math.js";
// Shared matches use authenticated HTTP input and a continuous snapshot stream.
// The client owns its view angles so aiming responds instantly; the server owns everything else.
export class NetworkClient {
  constructor(
    game,
    input,
    { onState, onDisconnect, sensitivity = () => 1, base = "" },
  ) {
    this.game = game;
    this.input = input;
    this.onState = onState;
    this.onDisconnect = onDisconnect;
    this.sensitivity = sensitivity;
    this.base = base;
    this.token = null;
    this.seq = 0;
    this.busy = false;
    this.host = false;
    this.ready = false;
    this.ping = 0;
    this.interpolation = new SnapshotInterpolator();
    // Local view angles for the current life, plus predicted recoil state.
    this.view = null;
    this.predicted = {
      cooldown: 0,
      mag: 0,
      lastMag: 0,
      weapon: -1,
      presses: 0,
      buffer: 0,
      recoilPitch: 0,
      recoilYaw: 0,
      // Burst pattern state, mirrored from the server's actor fields of the same names.
      recoilShot: 0,
      recoilRest: 0,
      recoverPitch: 0,
      recoverYaw: 0,
      lastShot: -Infinity,
    };
    game.online = true;
  }
  async request(path, data = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(this.base + "/api/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
        },
        body: JSON.stringify(data),
        signal: controller.signal,
        cache: "no-store",
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Multiplayer server unavailable. Run npm run multiplayer, then open its address.",
        );
      }
      if (!response.ok)
        throw new Error(result.error || "Server request failed.");
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  async join(data, create) {
    const result = await this.request(create ? "create" : "join", data);
    if (result.mode !== this.game.mode) {
      // Joining by code discovers the room map. Rejoin on the correct arena without leaving a slot reserved.
      this.token = result.token;
      await this.request("leave");
      this.token = null;
      const url = new URL(location.href);
      url.searchParams.set("mode", result.mode);
      url.searchParams.set("room", result.code);
      url.searchParams.set("team", String(data.team));
      location.href = url.href;
      return;
    }
    this.token = result.token;
    this.code = result.code;
    this.abort = new AbortController();
    this.readStream().catch((error) => this.disconnect(error.message));
  }
  async readStream() {
    const response = await fetch(this.base + "/api/events", {
      headers: { Authorization: "Bearer " + this.token },
      signal: this.abort.signal,
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error("Room connection failed. Rejoin the room.");
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let pending = "";
    this.watchdog = setInterval(() => {
      if (this.ready && performance.now() - this.received > 5000)
        this.disconnect("Connection lost. Rejoin the room.");
    }, 1000);
    while (this.token) {
      const { done, value } = await reader.read();
      if (done)
        throw new Error("Disconnected from the game server. Rejoin the room.");
      pending += decoder.decode(value, { stream: true });
      let end;
      while ((end = pending.indexOf("\n")) !== -1) {
        const packet = JSON.parse(pending.slice(0, end));
        pending = pending.slice(end + 1);
        this.apply(packet);
      }
      if (pending.length > 1024 * 1024)
        throw new Error("Invalid server response.");
    }
  }
  apply(packet) {
    this.interpolation.push(packet, performance.now());
    const g = this.game,
      old = g.player,
      oldHp = old.hp;
    // Other players' shots are not simulated locally: a fresh muzzle flash together with a
    // restarted fire cooldown marks a new shot, which plays at the shooter's position.
    for (const a of packet.actors) {
      const was = g.actors[a.id];
      if (
        this.ready &&
        a.id !== packet.playerId &&
        a.alive &&
        a.flash > 0 &&
        a.cooldown > (was.cooldown || 0) + 1e-6
      )
        g.audio.play("shot", 0.75, a.weapon, {
          x: a.x,
          y: a.y + (a.eye || 1.58),
          z: a.z,
        });
      Object.assign(was, a);
    }
    g.player = g.actors[packet.playerId];
    const me = g.player;
    const p = this.predicted,
      serverPitch = me.recoilPitch || 0,
      serverYaw = me.recoilYaw || 0;
    // Adopt server angles only for a new life; otherwise keep the locally aimed view.
    // The view holds raw aim, so strip any recoil the server already applied this life.
    if (!this.view || this.view.spawnId !== me.spawnId) {
      this.view = {
        yaw: me.yaw - serverYaw,
        pitch: me.pitch - serverPitch,
        spawnId: me.spawnId,
      };
      p.recoilPitch = p.recoilYaw = 0;
      resetRecoil(p);
      p.lastShot = -Infinity;
    }
    // Server recoil is authoritative. During a burst keep the (earlier) prediction unless the
    // server is ahead; once firing stops, settle on the server's totals.
    if (performance.now() - p.lastShot > 250) {
      p.recoilPitch = serverPitch;
      p.recoilYaw = serverYaw;
      p.recoverPitch = me.recoverPitch || 0;
      p.recoverYaw = me.recoverYaw || 0;
    } else p.recoilPitch = Math.max(p.recoilPitch, serverPitch);
    this.applyView(me);
    // Reconcile predicted ammo: refills and weapon changes reset it, otherwise trust the lower count.
    const mag = me.ammo[me.weapon]?.mag ?? 0;
    if (me.weapon !== p.weapon || mag > p.lastMag) p.mag = mag;
    else p.mag = Math.min(p.mag, mag);
    p.lastMag = mag;
    p.weapon = me.weapon;
    Object.assign(g.match, packet.match);
    g.time = packet.time;
    g.events = packet.events;
    g.effects.items.forEach((e) => (e.life = 0));
    packet.effects.forEach((e, i) => {
      if (g.effects.items[i]) Object.assign(g.effects.items[i], e);
    });
    if (this.ready && old === g.player && g.player.hp < oldHp)
      g.audio.play("hurt", 0.4);
    g.hit = Math.max(0, (g.player.hitUntil || 0) - g.time);
    g.hitKind = g.player.hitKind || "body";
    g.hurt = Math.max(0, (g.player.hurtUntil || 0) - g.time);
    g.notice = g.player.networkNotice || "";
    g.noticeTime = Math.max(0, (g.player.noticeUntil || 0) - g.time);
    if (!g.player.alive) this.input.clear();
    this.host = packet.host;
    this.received = performance.now();
    this.ready = true;
    this.onState(packet);
  }
  // Apply aim and predicted recoil every rendered frame instead of waiting for a snapshot.
  updateView(dt, sensitivity = this.sensitivity()) {
    const g = this.game,
      a = g.player,
      i = this.input,
      v = this.view,
      p = this.predicted;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.buffer = Math.max(0, p.buffer - dt);
    if (!this.ready || !v || !a.alive || !i.active) {
      i.dx = i.dy = 0;
      p.presses = i.firePresses;
      p.buffer = 0;
      return;
    }
    const scale = aimScale(a, i, sensitivity);
    // Predict the server's post-burst recovery and the player's own pull-down compensation.
    const [back, side] = recoverRecoil(p, a.weapon, dt);
    p.recoilPitch -= back;
    p.recoilYaw -= side;
    compensateRecoil(p, -i.dy * scale);
    v.yaw += i.dx * scale;
    // Keep raw aim inside the range where raw + recoil reaches the view limits.
    v.pitch = clamp(
      v.pitch - i.dy * scale,
      -1.45 - p.recoilPitch,
      1.45 - p.recoilPitch,
    );
    i.dx = i.dy = 0;
    const w = WEAPONS[a.weapon];
    // Mirror the server's semi-auto press buffer so predicted shots match authoritative ones.
    if (i.firePresses !== p.presses) p.buffer = FIRE_BUFFER;
    p.presses = i.firePresses;
    if (
      (w.automatic ? i.fire : p.buffer > 0) &&
      p.cooldown === 0 &&
      p.mag > 0 &&
      a.reload <= 0 &&
      a.cooldown <= 0
    ) {
      p.mag--;
      p.cooldown = w.interval;
      p.buffer = 0;
      const kick = recoilFor(a, Math.random, p.recoilShot),
        before = clamp(v.pitch + p.recoilPitch, -1.45, 1.45),
        applied = Math.min(1.45, before + kick.pitch) - before;
      p.recoilPitch += applied;
      p.recoilYaw += kick.yaw;
      trackRecoil(p, a.weapon, applied, kick.yaw);
      p.lastShot = performance.now();
      g.localShots = (g.localShots || 0) + 1;
      g.audio.play("shot", 1, a.weapon);
    }
    this.applyView(a);
  }
  // Displayed angles are raw aim plus predicted recoil, matching how the server combines them.
  applyView(a) {
    const v = this.view,
      p = this.predicted;
    a.yaw = v.yaw + p.recoilYaw;
    a.pitch = clamp(v.pitch + p.recoilPitch, -1.45, 1.45);
  }
  async send() {
    if (!this.token || !this.ready || this.busy) return;
    this.busy = true;
    const i = this.input;
    const data = {
      seq: this.seq++,
      keys: i.active ? [...i.keys] : [],
      actions: i.active ? [...i.actions] : [],
      view: this.view && {
        yaw: this.view.yaw,
        pitch: this.view.pitch,
        spawnId: this.view.spawnId,
      },
      moveX: i.active ? i.moveX : 0,
      moveY: i.active ? i.moveY : 0,
      fire: i.active && i.fire,
      aim: i.active && i.aim,
      touch: i.touch,
      touchCrouch: i.active && i.touchCrouch,
    };
    i.actions.clear();
    const started = performance.now();
    try {
      await this.request("input", data);
      this.ping = Math.round(performance.now() - started);
    } catch (error) {
      this.disconnect(error.message);
    } finally {
      this.busy = false;
    }
  }
  renderActors(now) {
    this.game.renderActors = this.interpolation.sample(
      this.game.actors,
      this.game.player.id,
      now,
    );
  }
  async leave() {
    if (this.token) await this.request("leave").catch(() => {});
    this.disconnect();
  }
  disconnect(reason) {
    if (!this.token) return;
    this.token = null;
    this.ready = false;
    this.abort?.abort();
    clearInterval(this.watchdog);
    this.interpolation.clear();
    this.game.renderActors = null;
    this.input.active = false;
    this.input.clear();
    this.onDisconnect(reason);
  }
}
