// Shared matches use authenticated HTTP input and a continuous snapshot stream.
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
    const g = this.game,
      old = g.player,
      oldWeapon = old.weapon,
      oldAmmo = old.ammo[old.weapon]?.mag,
      oldHp = old.hp;
    for (const a of packet.actors) Object.assign(g.actors[a.id], a);
    g.player = g.actors[packet.playerId];
    Object.assign(g.match, packet.match);
    g.time = packet.time;
    g.events = packet.events;
    g.effects.items.forEach((e) => (e.life = 0));
    packet.effects.forEach((e, i) => {
      if (g.effects.items[i]) Object.assign(g.effects.items[i], e);
    });
    if (this.ready && old === g.player) {
      if (g.player.hp < oldHp) g.audio.play("hurt", 0.4);
      if (
        g.player.weapon === oldWeapon &&
        g.player.ammo[g.player.weapon]?.mag < oldAmmo &&
        g.player.alive
      )
        g.audio.play("shot", 0.3, g.player.weapon);
    }
    g.hit = Math.max(0, (g.player.hitUntil || 0) - g.time);
    g.hurt = Math.max(0, (g.player.hurtUntil || 0) - g.time);
    g.notice = g.player.networkNotice || "";
    g.noticeTime = Math.max(0, (g.player.noticeUntil || 0) - g.time);
    if (!g.player.alive) this.input.clear();
    this.host = packet.host;
    this.received = performance.now();
    this.ready = true;
    this.onState(packet);
  }
  async send() {
    if (!this.token || !this.ready || this.busy) return;
    this.busy = true;
    const i = this.input;
    const data = {
      seq: this.seq++,
      keys: i.active ? [...i.keys] : [],
      actions: i.active ? [...i.actions] : [],
      dx: i.active ? i.dx * this.sensitivity() : 0,
      dy: i.active ? i.dy * this.sensitivity() : 0,
      moveX: i.active ? i.moveX : 0,
      moveY: i.active ? i.moveY : 0,
      fire: i.active && i.fire,
      aim: i.active && i.aim,
      touch: i.touch,
      touchCrouch: i.active && i.touchCrouch,
    };
    i.dx = i.dy = 0;
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
    this.input.active = false;
    this.input.clear();
    this.onDisconnect(reason);
  }
}
