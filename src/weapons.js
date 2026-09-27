import { direction, rayBox } from "./math.js";
export const WEAPONS = Object.freeze([
  {
    name: "AR / ASSAULT RIFLE",
    short: "AR",
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
]);
export class EffectPool {
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
  add(x, y, z, kind = "impact") {
    const e = this.items[this.next++ % this.items.length];
    e.x = x;
    e.y = y;
    e.z = z;
    e.life = kind === "impact" ? 0.18 : 0.065;
    e.kind = kind;
  }
  update(dt) {
    for (const e of this.items) e.life = Math.max(0, e.life - dt);
  }
}
export class WeaponController {
  constructor(game) {
    this.game = game;
  }
  equip(a, index) {
    if (index === a.weapon || index < 0 || index >= WEAPONS.length) return;
    a.weapon = index;
    a.reload = 0;
    a.cooldown = 0.22;
  }
  reload(a) {
    const w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon];
    if (a.alive && a.reload <= 0 && s.mag < w.magazine && s.reserve > 0) {
      a.reload = w.reload;
      if (a === this.game.player) this.game.audio.play("reload");
    }
  }
  update(a, dt) {
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.flash = Math.max(0, a.flash - dt);
    a.kick = Math.max(0, a.kick - dt * 0.12);
    if (a.reload > 0) {
      a.reload -= dt;
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
  fire(a, yaw = a.yaw, pitch = a.pitch, accuracy = 1) {
    const game = this.game,
      w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon];
    if (!a.alive || a.cooldown > 0 || a.reload > 0) return false;
    if (s.mag === 0) {
      this.reload(a);
      return false;
    }
    s.mag--;
    a.shield = 0;
    a.cooldown = w.interval;
    a.flash = 0.055;
    a.kick = Math.min(0.075, a.kick + w.recoil);
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
    let length = game.arena.ray(o, d, w.range),
      victim = null;
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
    if (victim) {
      const damage = w.damage * (length > w.range * 0.65 ? 0.72 : 1);
      game.damage.apply(victim, damage, a);
    }
    if (a === game.player) {
      a.pitch = Math.min(1.45, a.pitch + w.recoil * (a.aim ? 0.6 : 1));
      game.audio.play("shot", 1, a.weapon);
    } else if (Math.hypot(a.x - game.player.x, a.z - game.player.z) < 28)
      game.audio.play("shot", 0.18, a.weapon);
    return true;
  }
}
