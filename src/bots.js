// Bot perception and navigation are staggered; movement and shooting still run at simulation frequency.
import { distance } from "./math.js";
import { loadout } from "./loadouts.js";
// Difficulty changes reaction delay, aim error, walking speed, and perception cadence.
export const DIFFICULTY = {
  easy: { reaction: 0.6, spread: 0.16, speed: 2.9, interval: 0.3 },
  normal: { reaction: 0.32, spread: 0.085, speed: 3.6, interval: 0.22 },
  hard: { reaction: 0.16, spread: 0.035, speed: 4.2, interval: 0.16 },
};
export class BotController {
  // Start at normal difficulty until match setup chooses another preset.
  constructor(game) {
    this.game = game;
    this.difficulty = "normal";
  }
  // Advance one living bot using its cached target and route between perception updates.
  update(a, dt) {
    if (!a.alive) return;
    const g = this.game,
      b = a.brain,
      d = DIFFICULTY[this.difficulty];
    b.think -= dt;
    b.repath -= dt;
    b.reaction = Math.max(0, b.reaction - dt);
    let enemy = b.target;
    // Retain a visible target or search for the nearest visible living opponent.
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
      // A newly acquired target must wait through the reaction delay before firing.
      if (enemy !== b.target) b.reaction = d.reaction;
      b.target = enemy;
      b.state = enemy ? (a.hp < 28 ? "SeekCover" : "Attack") : "MoveToTarget";
      // When sight is lost, periodically route toward an opponent rather than recomputing every frame.
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
    // Aim toward the target torso and strafe while maintaining a useful combat distance.
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
      // Walk the cached path one waypoint at a time, using arena collision for actual movement.
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
    // Reload while reserves remain; otherwise switch to a weapon with ammunition.
    if (a.ammo[a.weapon].mag === 0) {
      if (a.ammo[a.weapon].reserve > 0) g.weapons.reload(a);
      else {
        // Search the class inventory explicitly, even if another slot contains stale ammo.
        const loaded = loadout(a.classId).weapons.find(
          (index) => a.ammo[index].mag > 0 || a.ammo[index].reserve > 0,
        );
        if (loaded !== undefined) g.weapons.equip(a, loaded);
      }
    }
  }
}
