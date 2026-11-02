// Bot perception and navigation are staggered; movement and shooting still run at simulation frequency.
import { distance, clamp } from "./math.js";
import { loadout } from "./loadouts.js";
import { WEAPONS } from "./weapons.js";
import { outOfAmmo } from "./match.js";
// Bots keep this much personal space from any other actor so squads do not stack in one spot.
const PERSONAL_SPACE = 0.75;
// Difficulty changes reaction delay, aim error (radians), walking speed, and perception cadence.
export const DIFFICULTY = {
  easy: { reaction: 0.6, spread: 0.16, speed: 2.9, interval: 0.3 },
  normal: { reaction: 0.32, spread: 0.085, speed: 3.6, interval: 0.22 },
  hard: { reaction: 0.16, spread: 0.035, speed: 4.2, interval: 0.16 },
};
// Health below which a bot breaks off to cover, and the level at which it re-engages.
const RETREAT_HP = 35,
  RECOVERED_HP = 75;
export class BotController {
  // Start at normal difficulty until match setup chooses another preset.
  constructor(game) {
    this.game = game;
    this.difficulty = "normal";
  }
  // Nearest graph node within reach that the threat cannot see; null when nothing qualifies.
  findCover(a, threat) {
    const g = this.game,
      nodes = g.nav.nodes
        .map((n) => ({ n, d: distance(a, n) }))
        .filter((c) => c.d > 1 && c.d < 14)
        .sort((x, y) => x.d - y.d);
    // Bound visibility casts: the nearest handful is enough for a quick retreat.
    for (let i = 0; i < Math.min(nodes.length, 24); i++) {
      const n = nodes[i].n;
      if (!g.arena.visible(threat, { x: n.x, y: 0, z: n.z })) return n;
    }
    return null;
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
    // Spawn-protected enemies cannot be damaged, so they are not worth engaging yet.
    if (b.think <= 0) {
      b.think = d.interval;
      if (
        !enemy ||
        !enemy.alive ||
        enemy.shield > 0 ||
        !g.arena.visible(a, enemy)
      ) {
        enemy = null;
        let nearest = 38;
        for (const e of g.actors)
          if (e.team !== a.team && e.alive && !(e.shield > 0)) {
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
      // Wounded bots retreat out of sight and wait for regeneration before re-engaging.
      if (a.hp < RETREAT_HP && enemy && !b.cover) {
        b.cover = this.findCover(a, enemy);
        if (b.cover) {
          b.path = g.nav.path(a, b.cover);
          b.step = 0;
        }
      }
      if (b.cover && a.hp >= RECOVERED_HP) b.cover = null;
      // A bot with no usable ammunition walks back to its nearest base spawn to resupply.
      const dry = outOfAmmo(a);
      if (dry && (b.state !== "Resupply" || b.step >= b.path.length)) {
        let base = null,
          far = Infinity;
        for (const p of g.arena.spawns[a.team])
          if (distance(a, p) < far) {
            far = distance(a, p);
            base = p;
          }
        b.path = g.nav.path(a, base);
        b.step = 0;
      }
      b.state = dry
        ? "Resupply"
        : b.cover
          ? "SeekCover"
          : enemy
            ? "Attack"
            : "MoveToTarget";
      if (g.mode === "conquest" && b.repath <= 0 && !b.cover && !dry) {
        b.objective = g.match.objectiveFor(a);
        b.path = g.nav.path(a, b.objective);
        b.step = 0;
        b.repath = 1 + g.random() * 0.5;
      }
      // Label objective work between route refreshes, not only on the refresh tick.
      if (b.state === "MoveToTarget" && g.mode === "conquest" && b.objective)
        b.state =
          b.objective.owner === a.team ? "DefendSector" : "CaptureSector";
      // When sight is lost, periodically route toward an opponent rather than recomputing every frame.
      if (g.mode !== "conquest" && !enemy && !b.cover && b.repath <= 0) {
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
    let crouch = false;
    const movePath = (keepAim = false) => {
      if (b.step >= b.path.length) return;
      const n = b.path[b.step],
        dx = n.x - a.x,
        dz = n.z - a.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.4) b.step++;
      else {
        if (!keepAim) {
          a.yaw = Math.atan2(dx, -dz);
          a.pitch = 0;
        }
        g.arena.move(a, (dx / l) * d.speed * dt, (dz / l) * d.speed * dt);
        a.moving = true;
      }
    };
    const engaged = enemy && enemy.alive && b.state !== "Resupply";
    let range = 0;
    if (engaged) {
      // Aim toward the target torso.
      const dx = enemy.x - a.x,
        dz = enemy.z - a.z;
      range = Math.hypot(dx, dz);
      a.yaw = Math.atan2(dx, -dz);
      a.pitch = Math.atan2(
        enemy.y + (enemy.crouched ? 0.55 : 1.0) - (a.y + a.eye),
        range,
      );
    }
    if (b.cover) {
      // Fall back along the route while still facing any threat; once there, hold low.
      if (b.step < b.path.length) movePath(engaged);
      else crouch = true;
    } else if (engaged) {
      const phase = Math.sin(g.time * 1.4 + a.id * 2),
        // Long sightlines: periodically settle into a crouched, aimed hold.
        hold = range > 16 && Math.sin(g.time * 0.6 + a.id * 1.7) > 0.2;
      if (g.mode === "conquest" && b.objective && range > 4) {
        if (distance(a, b.objective) > b.objective.radius * 0.6) movePath(true);
        else crouch = hold;
      } else if (hold) crouch = true;
      else {
        const forward = range > 14 ? 0.7 : range < 5 ? -0.5 : 0,
          side = phase * 0.6;
        g.arena.move(
          a,
          (Math.sin(a.yaw) * forward + Math.cos(a.yaw) * side) * d.speed * dt,
          (-Math.cos(a.yaw) * forward + Math.sin(a.yaw) * side) * d.speed * dt,
        );
        a.moving = true;
      }
      // Walk the cached path one waypoint at a time, using arena collision for actual movement.
    } else if (b.step < b.path.length) movePath();
    // Ease apart from overlapping actors; collision still applies, so walls are respected.
    for (const other of g.actors) {
      if (other === a || !other.alive) continue;
      let dx = a.x - other.x,
        dz = a.z - other.z,
        gap = Math.hypot(dx, dz);
      if (gap >= PERSONAL_SPACE) continue;
      // Exactly stacked actors separate along a stable, ID-based direction.
      if (gap < 1e-4) {
        const angle = a.id * 2.399;
        dx = Math.cos(angle);
        dz = Math.sin(angle);
        gap = 1;
      }
      const push = Math.min(
        PERSONAL_SPACE,
        (PERSONAL_SPACE - Math.min(gap, PERSONAL_SPACE)) * 4 * dt + 0.6 * dt,
      );
      g.arena.move(a, (dx / gap) * push, (dz / gap) * push);
    }
    // Stand only when the full standing volume is clear.
    a.crouched =
      (crouch && !a.moving) ||
      (a.crouched && g.arena.blocked(a.x, a.z, 0.35, a.y, 1.8));
    a.eye += ((a.crouched ? 1.02 : 1.58) - a.eye) * Math.min(1, dt * 15);
    // Aim down sights beyond close range; accuracy follows the same ADS ramp as players.
    const w = WEAPONS[a.weapon];
    a.aim = Boolean(engaged && range > 7);
    a.adsProgress = clamp(
      (a.adsProgress || 0) + (a.aim ? dt : -dt * 1.5) / w.adsTime,
      0,
      1,
    );
    // Confirm line of sight at the moment of firing so bots do not shoot into cover.
    if (
      engaged &&
      !(enemy.shield > 0) &&
      b.reaction === 0 &&
      a.cooldown === 0
    ) {
      if (g.arena.visible(a, enemy))
        g.weapons.fire(
          a,
          a.yaw + d.spread * (g.random() - 0.5),
          a.pitch + d.spread * 0.65 * (g.random() - 0.5),
          1,
        );
      else {
        b.target = null;
        b.think = Math.min(b.think, 0.05);
      }
    }
    // Top up during lulls so the next fight does not start on a nearly empty magazine.
    if (
      !engaged &&
      a.ammo[a.weapon].mag < w.magazine * 0.5 &&
      a.ammo[a.weapon].reserve > 0
    )
      g.weapons.reload(a);
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
