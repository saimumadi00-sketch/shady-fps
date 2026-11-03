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
      // Magnification while fully aimed (the marksman rifle looks through its scope).
      adsZoom: 1.4,
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
      // Magnification while fully aimed (the marksman rifle looks through its scope).
      adsZoom: 1.25,
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
      // Magnification while fully aimed (the marksman rifle looks through its scope).
      adsZoom: 1.15,
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
      // Magnification while fully aimed (the marksman rifle looks through its scope).
      adsZoom: 3.5,
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
      // Magnification while fully aimed (the marksman rifle looks through its scope).
      adsZoom: 1.35,
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
// Run and gun: firing is allowed while sprinting or sliding, at a wider hip cone.
export const SPRINT_SPREAD = 1.4;
export const SLIDE_SPREAD = 1.7;
// Current cone half-angle in radians from ADS progress, movement, and stance.
export function spreadFor(a) {
  const w = WEAPONS[a.weapon],
    ads = clamp(a.adsProgress || 0, 0, 1);
  return (
    (w.hipSpread + (w.adsSpread - w.hipSpread) * ads) *
    DEG *
    (a.sliding ? SLIDE_SPREAD : a.sprinting ? SPRINT_SPREAD : 1) *
    (a.moving ? w.movingSpread : a.crouched ? 0.85 : 1)
  );
}
// Learnable recoil patterns, indexed like WEAPONS. Each burst starts with a harder `first`
// kick, climbs at 1x, then eases to `settle` after `settleAfter` shots. Horizontal kick follows
// `drift` (repeating, in units of the weapon's recoilX) plus a random `jitter`. When firing
// stops, `recover` of the climb the player did not pull down themselves returns on its own.
export const RECOIL_PATTERNS = Object.freeze(
  [
    // AR: firm first shot, pulls right, swings left mid-magazine, then steadies.
    {
      first: 1.35,
      settle: 0.85,
      settleAfter: 9,
      drift: [0.5, 0.7, 0.5, 0.2, -0.3, -0.7, -0.6, -0.2, 0.3, 0.5],
      jitter: 0.35,
      recover: 0.55,
    },
    // SMG: light, tight zigzag; easy to hold, recovers quickly.
    {
      first: 1.2,
      settle: 1,
      settleAfter: 6,
      drift: [0.6, -0.5, 0.7, -0.6, 0.5, -0.7],
      jitter: 0.45,
      recover: 0.65,
    },
    // Pistol: single kicks that return most of the way between taps.
    {
      first: 1,
      settle: 1,
      settleAfter: 1,
      drift: [0.3, -0.3],
      jitter: 0.6,
      recover: 0.75,
    },
    // DMR: one big, nearly vertical kick per shot that mostly recovers.
    {
      first: 1,
      settle: 1,
      settleAfter: 1,
      drift: [0.25, -0.15],
      jitter: 0.4,
      recover: 0.7,
    },
    // LMG: heavy start that drifts left, settles once the belt is running, recovers least.
    {
      first: 1.6,
      settle: 0.7,
      settleAfter: 12,
      drift: [-0.6, -0.8, -0.5, -0.1, 0.4, 0.6, 0.3, -0.2],
      jitter: 0.3,
      recover: 0.45,
    },
  ].map((p) => Object.freeze({ ...p, drift: Object.freeze(p.drift) })),
);
// How quickly the recoverable climb eases back once a burst ends (per second).
export const RECOIL_RECOVERY_RATE = 9;
// Vertical multiplier for the `shot`-th round (0-based) of a burst.
export function recoilScale(weapon, shot) {
  const p = RECOIL_PATTERNS[weapon] || RECOIL_PATTERNS[0];
  return shot === 0 ? p.first : shot < p.settleAfter ? 1 : p.settle;
}
// Per-shot aim displacement shared by the authoritative simulation and client-side prediction.
// `shot` is the round's index in the current burst.
export function recoilFor(a, random, shot = a.recoilShot || 0) {
  const w = WEAPONS[a.weapon],
    p = RECOIL_PATTERNS[a.weapon] || RECOIL_PATTERNS[0],
    drift = p.drift[shot % p.drift.length];
  return {
    pitch: w.recoil * DEG * (a.aim ? 0.7 : 1) * recoilScale(a.weapon, shot),
    yaw: (drift + (random() - 0.5) * 2 * p.jitter) * w.recoilX * DEG,
  };
}
// Recoil burst state lives on the simulated actor and, for online prediction, on the client.
// Record a fired round: advance the pattern and bank the share of its kick that will recover.
export function trackRecoil(state, weapon, pitch, yaw) {
  const p = RECOIL_PATTERNS[weapon] || RECOIL_PATTERNS[0];
  state.recoilShot = (state.recoilShot || 0) + 1;
  state.recoilRest = 0;
  state.recoverPitch = (state.recoverPitch || 0) + pitch * p.recover;
  state.recoverYaw = (state.recoverYaw || 0) + yaw * p.recover;
}
// The player pulling their aim down (negative pitch change) already did the recovering.
export function compensateRecoil(state, pitchChange) {
  if (pitchChange < 0 && state.recoverPitch > 0)
    state.recoverPitch = Math.max(0, state.recoverPitch + pitchChange);
}
// Advance the burst timer; once the gun has rested past its fire interval, end the burst and
// return the [pitch, yaw] amounts to take back off the view this step.
export function recoverRecoil(state, weapon, dt) {
  state.recoilRest = (state.recoilRest || 0) + dt;
  if (state.recoilRest < (WEAPONS[weapon]?.interval || 0.1) + 0.08)
    return [0, 0];
  state.recoilShot = 0;
  const k = 1 - Math.exp(-RECOIL_RECOVERY_RATE * dt),
    pitch = (state.recoverPitch || 0) * k,
    yaw = (state.recoverYaw || 0) * k;
  state.recoverPitch = (state.recoverPitch || 0) - pitch;
  state.recoverYaw = (state.recoverYaw || 0) - yaw;
  return [pitch, yaw];
}
// Clear burst state, e.g. for a new life.
export function resetRecoil(state) {
  state.recoilShot =
    state.recoilRest =
    state.recoverPitch =
    state.recoverYaw =
      0;
}
export class EffectPool {
  // Allocate a fixed ring of effect slots to keep combat allocation bounded.
  constructor() {
    this.items = Array.from({ length: 48 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      ox: 0,
      oy: 0,
      oz: 0,
      life: 0,
      kind: "impact",
      seq: 0,
    }));
    this.next = 0;
  }
  // Overwrite the oldest slot when capacity is reached instead of growing the pool.
  // `kind` is what the round struck ("impact" = world, "body", "head"); the origin is the
  // shooter's muzzle so renderers can draw a tracer. `seq` lets renderers spot new shots
  // even when a networked snapshot reuses the same slot.
  add(x, y, z, kind = "impact", ox = x, oy = y, oz = z) {
    const e = this.items[this.next % this.items.length];
    e.seq = ++this.next;
    e.x = x;
    e.y = y;
    e.z = z;
    e.ox = ox;
    e.oy = oy;
    e.oz = oz;
    e.life = 0.18;
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
    // Human-aimed guns ease back after a burst. Online players keep raw aim separate, so the
    // recovery comes off the server-held recoil total instead of the combined angle.
    const game = this.game;
    if (a === game.player || game.humanControllers?.has(a.id)) {
      const [pitch, yaw] = recoverRecoil(a, a.weapon, dt);
      if (pitch || yaw) {
        if (game.humanControllers?.has(a.id)) {
          a.recoilPitch = (a.recoilPitch || 0) - pitch;
          a.recoilYaw = (a.recoilYaw || 0) - yaw;
        }
        a.pitch = clamp(a.pitch - pitch, -1.45, 1.45);
        a.yaw -= yaw;
      }
    }
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.flash = Math.max(0, a.flash - dt);
    a.kick = Math.max(0, a.kick - dt * 0.12);
    if (a.reload > 0) {
      const before = a.reload;
      a.reload -= dt;
      if (a === this.game.player) {
        const duration = a.reloadTime || WEAPONS[a.weapon].reload;
        // Play each mechanical cue when the tick crosses its phase, even during catch-up updates.
        for (const [phase, cue] of [
          [0.34, "mag-out"],
          [0.68, "mag-in"],
          [0.84, "rack"],
        ]) {
          const threshold = duration * (1 - phase);
          if (
            before > threshold &&
            a.reload <= threshold &&
            (phase !== 0.84 || a.reloadEmpty)
          )
            this.game.audio.play(cue, 0.28, a.weapon);
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
      // Fully dry: the hammer clicks on an empty chamber, at most a few times a second.
      if (
        s.reserve === 0 &&
        a === game.player &&
        !(game.time - (a.dryAt ?? -Infinity) < 0.3)
      ) {
        a.dryAt = game.time;
        game.audio.play("dry", 0.5, a.weapon);
      }
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
    // The tracer starts at the muzzle: ahead of the eye, right of centre and slightly low.
    const right = [Math.cos(a.yaw), 0, Math.sin(a.yaw)];
    game.effects.add(
      o[0] + d[0] * length,
      o[1] + d[1] * length,
      o[2] + d[2] * length,
      victim ? (head ? "head" : "body") : "impact",
      o[0] + d[0] * 0.7 + right[0] * 0.16,
      o[1] + d[1] * 0.7 - 0.12,
      o[2] + d[2] * 0.7 + right[2] * 0.16,
    );
    // A round that strikes the world cracks off it, positioned at the point of impact.
    if (!victim && length < w.range)
      game.audio.play("impact", 0.35, a.weapon, {
        x: o[0] + d[0] * length,
        y: o[1] + d[1] * length,
        z: o[2] + d[2] * length,
      });
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
      trackRecoil(a, a.weapon, pitch - a.pitch, kick.yaw);
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

// Aim magnification for a weapon: its own ADS zoom, or at least 2.5x through a fitted
// scope on any long gun. Optics stay cosmetic for accuracy; only the view changes.
export function aimZoom(index, optic) {
  const w = WEAPONS[index];
  if (!w) return 1;
  return optic === "scope" && index !== 2
    ? Math.max(w.adsZoom, 2.5)
    : w.adsZoom;
}
// Whether aiming this weapon looks through a scope (full-screen overlay, no viewmodel).
export const isScoped = (index, optic) =>
  index === 3 || (optic === "scope" && index !== 2);
