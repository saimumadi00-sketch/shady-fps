import { Arena, NavigationSystem } from "./world.js";
import {
  MatchManager,
  TeamManager,
  SpawnManager,
  DamageSystem,
  snapshot,
} from "./match.js";
import { WeaponController, EffectPool } from "./weapons.js";
import { BotController } from "./bots.js";
import { PlayerController } from "./player.js";
export class OfflineSimulation {
  constructor(input, audio, random = Math.random) {
    this.random = random;
    this.audio = audio;
    this.arena = new Arena();
    this.nav = new NavigationSystem(this.arena);
    this.match = new MatchManager();
    this.actors = TeamManager.createActors();
    this.player = this.actors[0];
    this.effects = new EffectPool();
    this.spawns = new SpawnManager(this);
    this.damage = new DamageSystem(this);
    this.weapons = new WeaponController(this);
    this.bots = new BotController(this);
    this.controller = new PlayerController(this, input);
    this.events = [];
    this.time = 0;
    this.hit = 0;
    this.hurt = 0;
    this.notice = "";
    this.noticeTime = 0;
    for (const a of this.actors) this.spawns.spawn(a);
  }
  start(difficulty) {
    this.match.start();
    this.bots.difficulty = difficulty;
    this.events.length = 0;
    this.time = 0;
    this.hit = this.hurt = this.noticeTime = 0;
    for (const e of this.effects.items) e.life = 0;
    for (const a of this.actors) {
      a.kills = a.deaths = 0;
      a.alive = false;
      a.weapon = a.id === 0 ? 0 : a.id % 3;
      a.brain.think = a.id * 0.025;
    }
    for (const a of this.actors) this.spawns.spawn(a);
  }
  update(dt, sensitivity = 1) {
    if (this.match.state !== "playing") return;
    this.time += dt;
    this.match.update(dt);
    if (this.match.state === "ended") return;
    this.effects.update(dt);
    this.hit = Math.max(0, this.hit - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    for (const e of this.events) e.time -= dt;
    for (const a of this.actors) {
      if (this.match.state !== "playing") break;
      if (!a.alive) {
        a.respawn -= dt;
        if (a.respawn <= 0) this.spawns.spawn(a);
        continue;
      }
      a.shield = Math.max(0, a.shield - dt);
      a.lastDamage += dt;
      if (a.lastDamage > 6) a.hp = Math.min(100, a.hp + 8 * dt);
      this.weapons.update(a, dt);
      if (a === this.player) this.controller.update(dt, sensitivity);
      else this.bots.update(a, dt);
    }
  }
  snapshot() {
    return snapshot(this);
  }
}
