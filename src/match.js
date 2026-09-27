import { distance } from "./math.js";
import { WEAPONS } from "./weapons.js";
export const TDM_RULES = Object.freeze({
  teamSize: 5,
  target: 30,
  duration: 420,
  respawn: 3,
});
export class MatchManager {
  constructor(rules = TDM_RULES) {
    this.rules = rules;
    this.state = "menu";
    this.scores = [0, 0];
    this.remaining = rules.duration;
    this.winner = null;
  }
  start() {
    this.state = "playing";
    this.scores = [0, 0];
    this.remaining = this.rules.duration;
    this.winner = null;
  }
  kill(team) {
    if (this.state !== "playing") return;
    this.scores[team]++;
    if (this.scores[team] >= this.rules.target) this.finish();
  }
  update(dt) {
    if (this.state !== "playing") return;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 0) this.finish();
  }
  finish() {
    this.state = "ended";
    this.winner =
      this.scores[0] === this.scores[1]
        ? null
        : this.scores[0] > this.scores[1]
          ? 0
          : 1;
  }
}
export class TeamManager {
  static createActors() {
    const names = [
      "You",
      "Silt",
      "Beacon",
      "Ferry",
      "Reed",
      "Copper",
      "Ember",
      "Rivet",
      "Clay",
      "Flint",
    ];
    return names.map((name, id) => ({
      id,
      name,
      team: id < 5 ? 0 : 1,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      eye: 1.58,
      vy: 0,
      hp: 100,
      alive: true,
      respawn: 0,
      shield: 0,
      kills: 0,
      deaths: 0,
      weapon: 0,
      ammo: [],
      reload: 0,
      cooldown: 0,
      flash: 0,
      kick: 0,
      sliding: false,
      slideTime: 0,
      slideCooldown: 0,
      slideX: 0,
      slideZ: 0,
      sprinting: false,
      crouchHeld: false,
      ignoreCrouch: false,
      fireDelay: 0,
      crouched: false,
      moving: false,
      aim: false,
      lastDamage: 0,
      brain: {
        think: id * 0.033,
        path: [],
        step: 0,
        target: null,
        state: "Patrol",
        reaction: 0,
        repath: 0,
      },
    }));
  }
}
export class SpawnManager {
  constructor(game) {
    this.game = game;
  }
  spawn(a) {
    let best = null,
      score = -Infinity;
    for (const p of this.game.arena.spawns[a.team]) {
      let safety = 50;
      for (const enemy of this.game.actors)
        if (enemy.team !== a.team && enemy.alive)
          safety = Math.min(safety, distance(p, enemy));
      for (const friend of this.game.actors)
        if (
          friend !== a &&
          friend.team === a.team &&
          friend.alive &&
          distance(p, friend) < 2
        )
          safety -= 20;
      safety += this.game.random() * 2;
      if (safety > score) {
        score = safety;
        best = p;
      }
    }
    Object.assign(a, {
      x: best.x,
      z: best.z,
      y: 0,
      vy: 0,
      yaw: a.team ? -Math.PI / 2 : Math.PI / 2,
      pitch: 0,
      eye: 1.58,
      hp: 100,
      alive: true,
      respawn: 0,
      shield: 1.5,
      sliding: false,
      slideTime: 0,
      slideCooldown: 0,
      slideX: 0,
      slideZ: 0,
      sprinting: false,
      crouchHeld: false,
      ignoreCrouch: false,
      fireDelay: 0,
      crouched: false,
      moving: false,
      aim: false,
      reload: 0,
      cooldown: 0.2,
      flash: 0,
      kick: 0,
      lastDamage: 0,
    });
    a.ammo = WEAPONS.map((w) => ({ mag: w.magazine, reserve: w.reserve }));
    a.brain.path = [];
    a.brain.target = null;
    a.brain.state = "Patrol";
    a.brain.step = 0;
    a.brain.reaction = 0;
  }
}
export class DamageSystem {
  constructor(game) {
    this.game = game;
  }
  apply(target, amount, attacker) {
    const g = this.game;
    if (
      g.match.state !== "playing" ||
      !target.alive ||
      attacker.team === target.team ||
      target.shield > 0
    )
      return false;
    target.hp = Math.max(0, target.hp - amount);
    target.lastDamage = 0;
    if (attacker === g.player) {
      g.hit = 0.13;
      g.audio.play("hit", 0.35);
    }
    if (target === g.player) {
      g.hurt = 0.4;
      g.audio.play("hurt", 0.4);
    }
    if (target.hp === 0) {
      target.alive = false;
      target.sliding = target.sprinting = false;
      target.deaths++;
      target.respawn = g.match.rules.respawn;
      target.brain.state = "Dead";
      attacker.kills++;
      g.match.kill(attacker.team);
      g.events.push({
        killer: attacker.name,
        victim: target.name,
        team: attacker.team,
        time: 5,
      });
      if (g.events.length > 5) g.events.shift();
      if (attacker === g.player) {
        g.notice = "ELIMINATED " + target.name.toUpperCase();
        g.noticeTime = 2;
        g.audio.play("kill", 0.4);
      }
    }
    return true;
  }
}
// Compact transport boundary for a future server-authoritative implementation.
// OfflineSimulation owns damage, ammo, spawning and scoring; UI only submits input.
export function snapshot(game) {
  return {
    time: Math.round(game.match.remaining * 100),
    scores: [...game.match.scores],
    actors: game.actors.map((a) => [
      a.id,
      a.team,
      Math.round(a.x * 100),
      Math.round(a.y * 100),
      Math.round(a.z * 100),
      Math.round(a.yaw * 1000),
      Math.ceil(a.hp),
      a.alive ? 1 : 0,
      a.weapon,
    ]),
  };
}
