import { distance } from "./math.js";
export const DIFFICULTY = {
  easy: { reaction: 0.6, spread: 0.16, speed: 2.9, interval: 0.3 },
  normal: { reaction: 0.32, spread: 0.085, speed: 3.6, interval: 0.22 },
  hard: { reaction: 0.16, spread: 0.035, speed: 4.2, interval: 0.16 },
};
export class BotController {
  constructor(game) {
    this.game = game;
    this.difficulty = "normal";
  }
  update(a, dt) {
    if (!a.alive) return;
    const g = this.game,
      b = a.brain,
      d = DIFFICULTY[this.difficulty];
    b.think -= dt;
    b.repath -= dt;
    b.reaction = Math.max(0, b.reaction - dt);
    let enemy = b.target;
    if (b.think <= 0) {
      b.think = d.interval;
      if (!enemy || !enemy.alive || !g.arena.visible(a, enemy)) {
        enemy = null;
        let nearest = 38;
        for (const e of g.actors)
          if (e.team !== a.team && e.alive) {
            const l = distance(a, e);
            if (l < nearest && g.arena.visible(a, e)) {
              nearest = l;
              enemy = e;
            }
          }
      }
      if (enemy !== b.target) b.reaction = d.reaction;
      b.target = enemy;
      b.state = enemy ? (a.hp < 28 ? "SeekCover" : "Attack") : "MoveToTarget";
      if (!enemy && b.repath <= 0) {
        let target = null,
          l = Infinity;
        for (const e of g.actors)
          if (e.team !== a.team && e.alive) {
            const v = distance(a, e);
            if (v < l) {
              target = e;
              l = v;
            }
          }
        if (target) {
          b.path = g.nav.path(a, target);
          b.step = 0;
        }
        b.repath = 1 + g.random() * 0.5;
      }
    }
    a.moving = false;
    if (enemy && enemy.alive) {
      const dx = enemy.x - a.x,
        dz = enemy.z - a.z,
        l = Math.hypot(dx, dz);
      a.yaw = Math.atan2(dx, -dz);
      a.pitch = Math.atan2(
        enemy.y + (enemy.crouched ? 0.65 : 1.15) - (a.y + a.eye),
        l,
      );
      if (b.reaction === 0 && a.cooldown === 0) {
        const error = d.spread * (g.random() - 0.5);
        g.weapons.fire(a, a.yaw + error, a.pitch + error * 0.65, 1);
      }
      const phase = Math.sin(g.time * 1.4 + a.id * 2),
        forward = l > 14 ? 0.7 : l < 5 ? -0.5 : 0,
        side = phase * 0.6;
      g.arena.move(
        a,
        (Math.sin(a.yaw) * forward + Math.cos(a.yaw) * side) * d.speed * dt,
        (-Math.cos(a.yaw) * forward + Math.sin(a.yaw) * side) * d.speed * dt,
      );
      a.moving = true;
    } else if (b.step < b.path.length) {
      const n = b.path[b.step],
        dx = n.x - a.x,
        dz = n.z - a.z,
        l = Math.hypot(dx, dz);
      if (l < 0.4) b.step++;
      else {
        a.yaw = Math.atan2(dx, -dz);
        a.pitch = 0;
        g.arena.move(a, (dx / l) * d.speed * dt, (dz / l) * d.speed * dt);
        a.moving = true;
      }
    }
    if (a.ammo[a.weapon].mag === 0) {
      if (a.ammo[a.weapon].reserve > 0) g.weapons.reload(a);
      else {
        const loaded = a.ammo.findIndex((s) => s.mag > 0 || s.reserve > 0);
        if (loaded >= 0) g.weapons.equip(a, loaded);
      }
    }
  }
}
