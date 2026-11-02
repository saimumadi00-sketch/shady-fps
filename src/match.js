// Match rules, roster creation, safe spawning, damage bookkeeping, and compact snapshots.
import { CLASS_IDS, loadout, canEquip } from "./loadouts.js";
import { distance } from "./math.js";
import { WEAPONS } from "./weapons.js";
import { BODY_GAP } from "./world.js";
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
    this.mode = "tdm";
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
      hitUntil: 0,
      hurtUntil: 0,
      noticeUntil: 0,
      networkNotice: "",
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
// Ammunition never refills on its own: each elimination returns half a magazine per carried
// weapon, and standing at a friendly base spawn restores the full starting reserve. Magazines
// are never filled directly, so resupplied rounds still go through a normal reload.
export const RESUPPLY_RADIUS = 2.5;
export function resupply(a, full = false) {
  let changed = false;
  for (const index of loadout(a.classId).weapons) {
    const w = WEAPONS[index],
      s = a.ammo[index];
    if (!s) continue;
    const reserve = full
      ? w.reserve
      : Math.min(w.reserve, s.reserve + Math.ceil(w.magazine / 2));
    if (reserve !== s.reserve) {
      s.reserve = reserve;
      changed = true;
    }
  }
  return changed;
}
// True when every carried weapon is completely empty.
export function outOfAmmo(a) {
  return loadout(a.classId).weapons.every(
    (i) => !a.ammo[i] || (a.ammo[i].mag === 0 && a.ammo[i].reserve === 0),
  );
}
// Enemies within this many metres of an owned sector disable spawning there.
export const FORWARD_SPAWN_CLEARANCE = 20;
export class SpawnManager {
  // Use the owning simulation for world queries and match-level bookkeeping.
  constructor(game) {
    this.game = game;
  }
  // Candidate points: team base spawns plus, in Conquest, points beside uncontested owned sectors.
  candidates(team) {
    const base = this.game.arena.spawns[team];
    const sectors = this.game.match.sectors;
    if (!sectors) return base;
    const forward = [];
    // A sector under pressure (any living enemy nearby) is not a safe deployment point;
    // this keeps a held point from becoming an unbreakable respawn wall.
    const threatened = (s) =>
      this.game.actors.some(
        (e) =>
          e.team !== team &&
          e.alive &&
          distance(e, s) < FORWARD_SPAWN_CLEARANCE,
      );
    for (const s of sectors)
      if (s.owner === team && !s.contested && !threatened(s))
        for (const p of s.spawnPoints || []) forward.push({ ...p, sector: s });
    return base.concat(forward);
  }
  // The chosen point, or the nearest position around it (rings of 0.8 m) clear of walls and bodies.
  clearSpot(p, a) {
    const g = this.game;
    const free = (x, z) =>
      !g.arena.blocked(x, z) &&
      g.actors.every(
        (o) => o === a || !o.alive || Math.hypot(o.x - x, o.z - z) >= BODY_GAP,
      );
    for (const r of [0, 0.8, 1.6])
      for (let k = 0; k < (r ? 8 : 1); k++) {
        const x = p.x + r * Math.cos((k * Math.PI) / 4),
          z = p.z + r * Math.sin((k * Math.PI) / 4);
        if (free(x, z)) return { x, z };
      }
    return p;
  }
  // Conquest spawns favour the uncontested owned point nearest the fight; TDM favours safety.
  spawn(a) {
    // Repair invalid equipped IDs before restoring only the class inventory.
    if (!canEquip(a, a.weapon)) a.weapon = loadout(a.classId).primary;
    const g = this.game,
      sectors = g.match.sectors;
    let best = null,
      score = -Infinity;
    for (const p of this.candidates(a.team)) {
      let nearest = 50;
      for (const enemy of g.actors)
        if (enemy.team !== a.team && enemy.alive)
          nearest = Math.min(nearest, distance(p, enemy));
      let safety = nearest;
      if (sectors) {
        // Prefer staying close to sectors the team still needs to take.
        let target = Infinity;
        for (const s of sectors)
          if (s.owner !== a.team) target = Math.min(target, distance(p, s));
        if (target !== Infinity) safety = Math.min(safety, 20) - target * 0.6;
      }
      // Penalties come after the Conquest clamp above, which would otherwise erase them.
      for (const friend of g.actors)
        if (
          friend !== a &&
          friend.team === a.team &&
          friend.alive &&
          distance(p, friend) < 2
        )
          safety -= 20;
      // Never deploy within close range of a living enemy when another option exists.
      if (nearest < 8) safety -= 100;
      safety += g.random() * 2;
      if (safety > score) {
        score = safety;
        best = p;
      }
    }
    // If every point is taken, step to the nearest clear spot so no one deploys inside a body.
    const spot = this.clearSpot(best, a);
    // Reset transient combat/movement state while preserving identity, score, and equipped weapon.
    Object.assign(a, {
      x: spot.x,
      z: spot.z,
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
      hitUntil: 0,
      hurtUntil: 0,
      noticeUntil: 0,
      networkNotice: "",
      adsProgress: 0,
      reloadTime: 0,
      reloadEmpty: false,
      // Server-applied recoil for networked players resets with each life.
      recoilPitch: 0,
      recoilYaw: 0,
      // Clients tag absolute view angles with this counter so stale aim cannot override a respawn.
      spawnId: (a.spawnId || 0) + 1,
      spawnSector: best.sector?.id || null,
    });
    if (best.sector) {
      const message = "DEPLOYED AT " + best.sector.id;
      if (a === g.player) {
        g.notice = message;
        g.noticeTime = 2;
      }
      if (g.humanControllers) {
        a.networkNotice = message;
        a.noticeUntil = g.time + 2;
      }
    }
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
    a.brain.cover = null;
  }
}
export class DamageSystem {
  // Use the owning simulation for world queries and match-level bookkeeping.
  constructor(game) {
    this.game = game;
  }
  // Reject invalid damage before mutating HP; one lethal hit produces one death and score event.
  apply(target, amount, attacker, headshot = false) {
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
    if (g.humanControllers) {
      attacker.hitUntil = g.time + 0.13;
      target.hurtUntil = g.time + 0.4;
    }
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
      resupply(attacker);
      if (g.humanControllers) {
        attacker.networkNotice =
          (headshot ? "HEADSHOT · " : "ELIMINATED ") +
          target.name.toUpperCase();
        attacker.noticeUntil = g.time + 2;
      }
      g.match.kill(attacker.team);
      g.events.push({
        killer: attacker.name,
        victim: target.name,
        team: attacker.team,
        headshot,
        time: 5,
      });
      if (g.events.length > 5) g.events.shift();
      if (attacker === g.player) {
        g.notice =
          (headshot ? "HEADSHOT · " : "ELIMINATED ") +
          target.name.toUpperCase();
        g.noticeTime = 2;
        g.audio.play("kill", 0.4);
      }
    }
    return true;
  }
}
// Quantized summary of match state used by deterministic tests and debugging tools.
export function snapshot(game) {
  return {
    mode: game.mode,
    sectors: game.match.sectors?.map((s) => ({
      id: s.id,
      owner: s.owner,
      progress: Math.round(s.progress * 100),
      contested: s.contested,
    })),
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
