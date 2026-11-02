// Shared weapon tuning plus ammunition, hitscan, damage dispatch, and reusable visual effects.
// Tuning follows WEAPON_ROLE_DESIGN.md. Angles are authored in degrees (cone half-angles) and
// converted to radians at the simulation boundary; handling times are seconds.
import { canEquip, loadout } from "./loadouts.js";
import { clamp, direction, rayBox } from "./math.js";
const DEG = Math.PI / 180;
// Array indices are stable loadout IDs used by saves, actors, selectors, audio, and meshes.
export const WEAPONS = Object.freeze(
  [
    {
      name: "AR / ASSAULT RIFLE",
      label: "Assault rifle",
      short: "AR",
      description:
        "Versatile automatic rifle; strongest all-round at medium range.",
      automatic: true,
      magazine: 30,
      reserve: 120,
      damage: [28, 18],
      falloff: [20, 80],
      headshot: 1.5,
      rpm: 650,
      reload: 2.15,
      reloadEmpty: 2.65,
      hipSpread: 1.7,
      adsSpread: 0.1,
      movingSpread: 1.5,
      recoil: 0.3,
      recoilX: 0.08,
      kick: 0.019,
      adsTime: 0.22,
      sprintToFire: 0.2,
      equipTime: 0.28,
      weight: 3.5,
      adsMove: 0.65,
    },
    {
      name: "SMG / COMPACT",
      label: "Submachine gun",
      short: "SMG",
      description:
        "Fast handling and accurate moving fire; falls off quickly at range.",
      automatic: true,
      magazine: 28,
      reserve: 140,
      damage: [24, 10],
      falloff: [10, 45],
      headshot: 1.5,
      rpm: 850,
      reload: 1.8,
      reloadEmpty: 2.15,
      hipSpread: 1.15,
      adsSpread: 0.16,
      movingSpread: 1.2,
      recoil: 0.2,
      recoilX: 0.1,
      kick: 0.012,
      adsTime: 0.14,
      sprintToFire: 0.1,
      equipTime: 0.18,
      weight: 2.2,
      adsMove: 0.85,
    },
    {
      name: "P / SIDEARM",
      label: "Pistol",
      short: "PISTOL",
      description:
        "Quick-drawing semi-automatic backup with a short useful range.",
      automatic: false,
      magazine: 12,
      reserve: 60,
      damage: [30, 18],
      falloff: [12, 40],
      headshot: 1.5,
      rpm: 330,
      reload: 1.3,
      reloadEmpty: 1.6,
      hipSpread: 1.0,
      adsSpread: 0.15,
      movingSpread: 1.2,
      recoil: 0.45,
      recoilX: 0.1,
      kick: 0.026,
      adsTime: 0.12,
      sprintToFire: 0.08,
      equipTime: 0.15,
      weight: 1.2,
      adsMove: 0.8,
    },
    {
      name: "DMR / MARKSMAN RIFLE",
      label: "Marksman rifle",
      short: "DMR",
      description:
        "Precise semi-automatic shots and 2x headshots; poor hip fire.",
      automatic: false,
      magazine: 16,
      reserve: 64,
      damage: [45, 34],
      falloff: [45, 160],
      headshot: 2,
      rpm: 260,
      reload: 2.5,
      reloadEmpty: 3.1,
      hipSpread: 4.0,
      adsSpread: 0.025,
      movingSpread: 3.0,
      recoil: 0.8,
      recoilX: 0.04,
      kick: 0.045,
      adsTime: 0.34,
      sprintToFire: 0.32,
      equipTime: 0.4,
      weight: 4.6,
      adsMove: 0.4,
    },
    {
      name: "LMG / SUPPORT",
      label: "Light machine gun",
      short: "LMG",
      description:
        "100-round belt for sustained lane control; slow to handle and reload.",
      automatic: true,
      magazine: 100,
      reserve: 200,
      damage: [26, 17],
      falloff: [30, 110],
      headshot: 1.5,
      rpm: 700,
      reload: 4.8,
      reloadEmpty: 5.8,
      hipSpread: 3.2,
      adsSpread: 0.2,
      movingSpread: 2.3,
      recoil: 0.38,
      recoilX: 0.15,
      kick: 0.024,
      adsTime: 0.38,
      sprintToFire: 0.4,
      equipTime: 0.55,
      weight: 7.5,
      adsMove: 0.4,
    },
  ].map((w) =>
    Object.freeze({
      ...w,
      damage: Object.freeze(w.damage),
      falloff: Object.freeze(w.falloff),
      interval: 60 / w.rpm,
      // Hitscan length only; damage falloff, not a hard cutoff, limits effective range.
      range: 150,
    }),
  ),
);
// Linear falloff between the two distances, holding the near/far values outside them.
export function damageAt(w, distance) {
  const [start, end] = w.falloff,
    t = clamp((distance - start) / (end - start), 0, 1);
  return w.damage[0] + (w.damage[1] - w.damage[0]) * t;
}
// Movement multipliers derive from the carried primary's bulk, even with the pistol drawn.
export function handling(a) {
  const primary = WEAPONS[loadout(a.classId).primary],
    w = WEAPONS[a.weapon] || primary;
  return {
    walk: clamp(1.08 - 0.02 * primary.weight, 0.88, 1.05),
    sprint: clamp(1.025 - 0.008 * primary.weight, 0.94, 1.02),
    adsMove: w.adsMove,
    sprintToFire: w.sprintToFire,
  };
}
// Separate head and body volumes. Heights match the drawn character (head top at stance height).
export const HEAD_HEIGHT = 0.5;
export function hitboxes(target) {
  const h = target.crouched ? 1.15 : 1.8,
    body = h - HEAD_HEIGHT;
  return [
    {
      x: target.x,
      y: target.y + body / 2,
      z: target.z,
      w: 0.68,
      h: body,
      d: 0.58,
      head: false,
    },
    {
      x: target.x,
      y: target.y + body + HEAD_HEIGHT / 2,
      z: target.z,
      w: 0.5,
      h: HEAD_HEIGHT,
      d: 0.46,
      head: true,
    },
  ];
}
// Current cone half-angle in radians from ADS progress, movement, and stance.
export function spreadFor(a) {
  const w = WEAPONS[a.weapon],
    ads = clamp(a.adsProgress || 0, 0, 1);
  return (
    (w.hipSpread + (w.adsSpread - w.hipSpread) * ads) *
    DEG *
    (a.sliding ? 1.7 : 1) *
    (a.moving ? w.movingSpread : a.crouched ? 0.85 : 1)
  );
}
// Per-shot aim displacement shared by the authoritative simulation and client-side prediction.
export function recoilFor(a, random) {
  const w = WEAPONS[a.weapon];
  return {
    pitch: w.recoil * DEG * (a.aim ? 0.7 : 1),
    yaw: (random() - 0.5) * 2 * w.recoilX * DEG,
  };
}
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
    a.reload = a.reloadTime = 0;
    a.reloadEmpty = false;
    a.adsProgress = 0;
    a.cooldown = WEAPONS[index].equipTime;
  }
  // Begin only if reserve ammo can fill missing rounds; an empty magazine takes the longer reload.
  reload(a) {
    if (!canEquip(a, a.weapon)) return;
    const w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon];
    if (a.alive && a.reload <= 0 && s.mag < w.magazine && s.reserve > 0) {
      a.reloadEmpty = s.mag === 0;
      a.reloadTime = a.reloadEmpty ? w.reloadEmpty : w.reload;
      a.reload = a.reloadTime;
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
        const duration = a.reloadTime || WEAPONS[a.weapon].reload;
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
    a.kick = Math.min(0.075, a.kick + w.kick);
    // Sample uniformly inside the spread cone rather than along a square.
    const cone = spreadFor(a) * accuracy * Math.sqrt(game.random()),
      angle = game.random() * Math.PI * 2;
    const d = direction(
        yaw + cone * Math.cos(angle),
        pitch + cone * Math.sin(angle),
      ),
      o = [a.x, a.y + a.eye, a.z];
    // Start with the nearest wall/floor hit and shorten the ray for closer actor intersections.
    let length = game.arena.ray(o, d, w.range),
      victim = null,
      head = false;
    // Include teammates as blockers; DamageSystem separately rejects friendly damage.
    for (const target of game.actors) {
      if (target === a || !target.alive) continue;
      for (const box of hitboxes(target)) {
        const t = rayBox(o, d, box, length);
        // A teammate whose volume overlaps the muzzle cannot absorb the shot at distance zero.
        if (t === 0 && target.team === a.team) continue;
        if (t < length) {
          length = t;
          victim = target;
          head = box.head;
        }
      }
    }
    game.effects.add(
      o[0] + d[0] * length,
      o[1] + d[1] * length,
      o[2] + d[2] * length,
    );
    // Falloff applies first, then the head multiplier.
    if (victim)
      game.damage.apply(
        victim,
        damageAt(w, length) * (head ? w.headshot : 1),
        a,
        head,
      );
    if (a === game.player || game.humanControllers?.has(a.id)) {
      const kick = recoilFor(a, game.random),
        pitch = Math.min(1.45, a.pitch + kick.pitch);
      // Online players send raw aim; the server keeps the recoil it applied this life and adds it
      // on top every tick, so a client cannot discard recoil by omitting it from its view angles.
      if (game.humanControllers?.has(a.id)) {
        a.recoilPitch = (a.recoilPitch || 0) + (pitch - a.pitch);
        a.recoilYaw = (a.recoilYaw || 0) + kick.yaw;
      }
      a.pitch = pitch;
      a.yaw += kick.yaw;
      // Presentation counter: the renderer kicks the viewmodel once per local shot.
      if (a === game.player) game.localShots = (game.localShots || 0) + 1;
      game.audio.play("shot", 1, a.weapon);
    } else
      // Other actors' shots are positioned in 3D; the audio layer handles distance falloff.
      game.audio.play("shot", 0.75, a.weapon, {
        x: a.x,
        y: a.y + a.eye,
        z: a.z,
      });
    return true;
  }
}
