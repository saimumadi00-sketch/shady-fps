// Match rules, roster creation, safe spawning, damage bookkeeping, and compact snapshots.
import { CLASS_IDS, loadout, canEquip } from "./loadouts.js";
import { distance } from "./math.js";
import { WEAPONS } from "./weapons.js";
export const TDM_RULES = Object.freeze({
  teamSize: 5,
  target: 30,
  duration: 420,
  respawn: 3,
});
export class MatchManager {
  // Accept alternate rules while keeping per-match score and time state separate.
  constructor(rules = TDM_RULES) {
    this.rules = rules;
    this.state = "menu";
    this.scores = [0, 0];
    this.remaining = rules.duration;
    this.winner = null;
  }
  // Reset scores and timer without rebuilding the actor roster.
  start() {
    this.state = "playing";
    this.scores = [0, 0];
    this.remaining = this.rules.duration;
    this.winner = null;
  }
  // Count kills only during active play and finish immediately at the score limit.
  kill(team) {
    if (this.state !== "playing") return;
    this.scores[team]++;
    if (this.scores[team] >= this.rules.target) this.finish();
  }
  // Clamp the countdown at zero and resolve timed matches through the same finish path.
  update(dt) {
    if (this.state !== "playing") return;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 0) this.finish();
  }
  // Represent a tied score with a null winner rather than choosing a team arbitrarily.
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
  // Create ten independent actor records with movement, weapon, and bot-brain state.
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
      classId: CLASS_IDS[(id % 5) % CLASS_IDS.length],
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
  // Use the owning simulation for world queries and match-level bookkeeping.
  constructor(game) {
    this.game = game;
  }
  // Rank team spawn points by enemy distance, friendly occupancy, and a small random tie-break.
  spawn(a) {
    // Repair invalid equipped IDs before restoring only the class inventory.
    if (!canEquip(a, a.weapon)) a.weapon = loadout(a.classId).primary;
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
    // Reset transient combat/movement state while preserving identity, score, and equipped weapon.
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
    // Keep stable global ammo indices, but unassigned weapons receive no usable ammunition.
    a.ammo = WEAPONS.map((w, index) => ({
      mag: canEquip(a, index) ? w.magazine : 0,
      reserve: canEquip(a, index) ? w.reserve : 0,
    }));
    a.brain.path = [];
    a.brain.target = null;
    a.brain.state = "Patrol";
    a.brain.step = 0;
    a.brain.reaction = 0;
  }
}
export class DamageSystem {
  // Use the owning simulation for world queries and match-level bookkeeping.
  constructor(game) {
    this.game = game;
  }
  // Reject invalid damage before mutating HP; one lethal hit produces one death and score event.
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
    // Mark dead before emitting events so additional hits cannot count the kill again.
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
// Quantize positions and angles to integer arrays for a possible future transport layer.
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
