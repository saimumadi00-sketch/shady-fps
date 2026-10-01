// Shared weapon tuning plus ammunition, hitscan, damage dispatch, and reusable visual effects.
import { canEquip } from "./loadouts.js";
import { direction, rayBox } from "./math.js";
// Array indices are stable loadout IDs used by saves, actors, selectors, audio, and meshes.
export const WEAPONS = Object.freeze([
  {
    name: "AR / ASSAULT RIFLE",
    short: "AR",
    description: "Balanced automatic fire for medium-range fights.",
    automatic: true,
    magazine: 30,
    reserve: 120,
    damage: 26,
    interval: 0.115,
    reload: 1.9,
    recoil: 0.019,
    spread: 0.018,
    range: 55,
  },
  {
    name: "SMG / COMPACT",
    short: "SMG",
    description: "Fast automatic fire for close-range pressure.",
    automatic: true,
    magazine: 30,
    reserve: 150,
    damage: 18,
    interval: 0.075,
    reload: 1.55,
    recoil: 0.012,
    spread: 0.026,
    range: 32,
  },
  {
    name: "P / SIDEARM",
    short: "PISTOL",
    description: "Accurate semi-automatic sidearm with a quick reload.",
    automatic: false,
    magazine: 12,
    reserve: 60,
    damage: 34,
    interval: 0.27,
    reload: 1.3,
    recoil: 0.026,
    spread: 0.012,
    range: 42,
  },
  {
    name: "DMR / MARKSMAN RIFLE",
    short: "DMR",
    description: "Powerful semi-automatic shots for long-range precision.",
    automatic: false,
    magazine: 10,
    reserve: 50,
    damage: 60,
    interval: 0.55,
    reload: 2.3,
    recoil: 0.045,
    spread: 0.006,
    range: 90,
  },
  {
    name: "LMG / SUPPORT",
    short: "LMG",
    description:
      "Sustained automatic fire with a large magazine and slow reload.",
    automatic: true,
    magazine: 60,
    reserve: 180,
    damage: 23,
    interval: 0.13,
    reload: 3.4,
    recoil: 0.024,
    spread: 0.024,
    range: 65,
  },
]);
export class EffectPool {
  // Allocate a fixed ring of effect slots to keep combat allocation bounded.
  constructor() {
    this.items = Array.from({ length: 48 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      life: 0,
      kind: "impact",
    }));
    this.next = 0;
  }
  // Overwrite the oldest slot when capacity is reached instead of growing the pool.
  add(x, y, z, kind = "impact") {
    const e = this.items[this.next++ % this.items.length];
    e.x = x;
    e.y = y;
    e.z = z;
    e.life = kind === "impact" ? 0.18 : 0.065;
    e.kind = kind;
  }
  // Expire visuals without removing or reallocating their storage.
  update(dt) {
    for (const e of this.items) e.life = Math.max(0, e.life - dt);
  }
}
export class WeaponController {
  // Retain the simulation boundary used for collision, damage, effects, and audio.
  constructor(game) {
    this.game = game;
  }
  // Validate the index and cancel reloads; ammunition remains attached to its own weapon.
  equip(a, index) {
    if (
      !canEquip(a, index) ||
      index === a.weapon ||
      index < 0 ||
      index >= WEAPONS.length
    )
      return;
    a.weapon = index;
    a.reload = 0;
    a.cooldown = 0.22;
  }
  // Begin only if reserve ammo can fill missing rounds; remember whether the chamber action is needed.
  reload(a) {
    if (!canEquip(a, a.weapon)) return;
    const w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon];
    if (a.alive && a.reload <= 0 && s.mag < w.magazine && s.reserve > 0) {
      a.reload = w.reload;
      a.reloadEmpty = s.mag === 0;
      if (a === this.game.player) this.game.audio.play("reload");
    }
  }
  // Advance weapon timers and transfer reserve ammo only when the reload completes.
  update(a, dt) {
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.flash = Math.max(0, a.flash - dt);
    a.kick = Math.max(0, a.kick - dt * 0.12);
    if (a.reload > 0) {
      const before = a.reload;
      a.reload -= dt;
      if (a === this.game.player) {
        const duration = WEAPONS[a.weapon].reload;
        // Play each mechanical cue when the tick crosses its phase, even during catch-up updates.
        for (const phase of [0.34, 0.68, 0.84]) {
          const threshold = duration * (1 - phase);
          if (
            before > threshold &&
            a.reload <= threshold &&
            (phase !== 0.84 || a.reloadEmpty)
          )
            this.game.audio.play("reload", 0.28);
        }
      }
      if (a.reload <= 0) {
        a.reload = 0;
        const w = WEAPONS[a.weapon],
          s = a.ammo[a.weapon],
          n = Math.min(w.magazine - s.mag, s.reserve);
        s.mag += n;
        s.reserve -= n;
      }
    }
  }
  // Resolve a shot synchronously in the simulation; animation never decides whether it hits.
  fire(a, yaw = a.yaw, pitch = a.pitch, accuracy = 1) {
    // Reject cross-class weapons even if an external caller bypassed the equip method.
    if (!canEquip(a, a.weapon)) return false;
    const game = this.game,
      w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon];
    if (!a.alive || a.cooldown > 0 || a.reload > 0) return false;
    if (s.mag === 0) {
      this.reload(a);
      return false;
    }
    // Spend one round and remove spawn protection as soon as a valid shot is fired.
    s.mag--;
    a.shield = 0;
    a.cooldown = w.interval;
    a.flash = 0.055;
    a.kick = Math.min(0.075, a.kick + w.recoil);
    // Combine stance, movement, ADS, and caller accuracy into angular shot variation.
    const spread =
      w.spread *
      (a.sliding ? 1.7 : 1) *
      (a.aim ? 0.35 : 1) *
      (a.moving ? 1.6 : 1) *
      accuracy;
    const d = direction(
        yaw + (game.random() - 0.5) * spread,
        pitch + (game.random() - 0.5) * spread,
      ),
      o = [a.x, a.y + a.eye, a.z];
    // Start with the nearest wall/floor hit and shorten the ray for closer actor intersections.
    let length = game.arena.ray(o, d, w.range),
      victim = null;
    // Include teammates as blockers; DamageSystem separately rejects friendly damage.
    for (const target of game.actors) {
      if (target === a || !target.alive) continue;
      const h = target.crouched ? 1.15 : 1.8,
        box = {
          x: target.x,
          y: target.y + h / 2,
          z: target.z,
          w: 0.68,
          h,
          d: 0.58,
        };
      const t = rayBox(o, d, box, length);
      if (t < length) {
        length = t;
        victim = target;
      }
    }
    game.effects.add(
      o[0] + d[0] * length,
      o[1] + d[1] * length,
      o[2] + d[2] * length,
    );
    // Apply range falloff to the nearest actor hit, then delegate scoring and death handling.
    if (victim) {
      const damage = w.damage * (length > w.range * 0.65 ? 0.72 : 1);
      game.damage.apply(victim, damage, a);
    }
    if (a === game.player || game.humanControllers?.has(a.id)) {
      a.pitch = Math.min(1.45, a.pitch + w.recoil * (a.aim ? 0.6 : 1));
      game.audio.play("shot", 1, a.weapon);
    } else if (Math.hypot(a.x - game.player.x, a.z - game.player.z) < 28)
      game.audio.play("shot", 0.18, a.weapon);
    return true;
  }
}
