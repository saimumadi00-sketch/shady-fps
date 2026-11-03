// Presentation-only gunfire feedback: camera punch, tracers, muzzle flashes, impact debris,
// bullet marks and ejected brass. Nothing here affects aim, hits or damage; it only reads the
// simulation's shot effects (which also arrive over the network) and the local shot counter.
import { direction } from "./math.js";
import { WEAPONS } from "./weapons.js";

const GRAVITY = 9.8;
const TRACER_SPEED = 380; // m/s: slow enough to see, fast enough to read as a bullet.
const TRACER_LENGTH = 3.2;
const MAX_PARTICLES = 260;
const MAX_MARKS = 48;
const MARK_LIFE = 9;

// A critically damped spring per axis: each shot adds velocity, the view snaps and settles.
export class CameraPunch {
  constructor() {
    this.reset();
  }
  reset() {
    this.pitch = this.yaw = this.vp = this.vy = 0;
  }
  // `strength` is the weapon kick relative to the AR; aiming steadies the punch.
  kick(strength, aim, random = Math.random) {
    const scale = strength * (1 - 0.45 * aim),
      omega = 24;
    this.vp += 0.011 * scale * omega * Math.E;
    this.vy += (random() * 2 - 1) * 0.005 * scale * omega * Math.E;
  }
  update(dt) {
    const omega = 24;
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      this.vp += (-omega * omega * this.pitch - 2 * omega * this.vp) * h;
      this.vy += (-omega * omega * this.yaw - 2 * omega * this.vy) * h;
      this.pitch = Math.max(-0.06, Math.min(0.06, this.pitch + this.vp * h));
      this.yaw = Math.max(-0.03, Math.min(0.03, this.yaw + this.vy * h));
    }
    return this;
  }
}

// Orientation for a box whose long (z) axis points along unit vector d (matches the shader).
const orient = (d) => [Math.atan2(d[0], d[2]), Math.asin(-d[1])];

export class CombatFx {
  constructor(random = Math.random) {
    this.random = random;
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      life: 0,
    }));
    this.marks = Array.from({ length: MAX_MARKS }, () => ({ life: 0 }));
    this.nextParticle = this.nextMark = 0;
    this.lastSeq = 0;
  }
  reset() {
    for (const p of this.particles) p.life = 0;
    for (const m of this.marks) m.life = 0;
    this.lastSeq = 0;
  }
  particle(props) {
    const p = this.particles[this.nextParticle++ % MAX_PARTICLES];
    Object.assign(p, {
        age: 0,
        spin: 0,
        spinRate: 0,
        gravity: 0,
        grow: 0,
        angle: 0,
        pitch: 0,
        floor: undefined,
      }, props);
    p.max = p.life;
    return p;
  }
  // Spawn visuals for every shot newer than the last one seen. Sequence numbers only grow
  // within a simulation; a much lower one means a new match or server, so start over.
  scan(effects, cam) {
    let newest = this.lastSeq;
    for (const e of effects.items) {
      if (e.life <= 0 || !e.seq) continue;
      if (e.seq < this.lastSeq - 200) this.lastSeq = newest = 0;
      if (e.seq > this.lastSeq) this.shotEffect(e, cam);
      newest = Math.max(newest, e.seq);
    }
    this.lastSeq = newest;
  }
  shotEffect(e, cam) {
    const r = this.random,
      ox = e.ox ?? e.x,
      oy = e.oy ?? e.y,
      oz = e.oz ?? e.z,
      dx = e.x - ox,
      dy = e.y - oy,
      dz = e.z - oz,
      dist = Math.hypot(dx, dy, dz) || 1,
      d = [dx / dist, dy / dist, dz / dist];
    if (dist > 2)
      this.particle({
        type: "tracer",
        from: [ox, oy, oz],
        dir: d,
        dist,
        life: dist / TRACER_SPEED + TRACER_LENGTH / TRACER_SPEED,
      });
    // Other shooters get a visible flash at their muzzle; the local gun has its own.
    if (Math.hypot(ox - cam.x, oy - cam.y, oz - cam.z) > 1.6) {
      const [angle, pitch] = orient(d);
      this.particle({
        type: "flash",
        x: ox + d[0] * 0.1,
        y: oy + d[1] * 0.1,
        z: oz + d[2] * 0.1,
        size: [0.16, 0.16, 0.28],
        color: [2.2, 1.7, 0.8],
        angle,
        pitch,
        life: 0.05,
      });
    }
    // Debris kicks back toward the shooter, scattered around the reflected direction.
    const spray = (count, speed, props) => {
      for (let i = 0; i < count; i++) {
        const s = speed * (0.5 + r());
        this.particle({
          type: "bit",
          x: e.x - d[0] * 0.03,
          y: e.y - d[1] * 0.03,
          z: e.z - d[2] * 0.03,
          vx: (-d[0] * 0.6 + (r() - 0.5) * 1.4) * s,
          vy: (-d[1] * 0.6 + r() * 0.9) * s,
          vz: (-d[2] * 0.6 + (r() - 0.5) * 1.4) * s,
          spinRate: (r() - 0.5) * 30,
          ...props(),
        });
      }
    };
    if (e.kind === "impact") {
      spray(5, 4.5, () => ({
        size: [0.018, 0.018, 0.05],
        color: [1.9, 1.35, 0.55],
        gravity: GRAVITY,
        life: 0.16 + r() * 0.12,
      }));
      spray(4, 0.9, () => {
        const g = 0.5 + r() * 0.12;
        return {
          size: [0.07, 0.07, 0.07],
          color: [g, g * 0.97, g * 0.92],
          gravity: -0.6,
          grow: 2.4,
          life: 0.4 + r() * 0.25,
        };
      });
      // A chipped mark stays on the surface for a few seconds.
      const m = this.marks[this.nextMark++ % MAX_MARKS];
      Object.assign(m, {
        x: e.x - d[0] * 0.012,
        y: e.y - d[1] * 0.012,
        z: e.z - d[2] * 0.012,
        life: MARK_LIFE,
        angle: r() * Math.PI,
      });
    } else {
      const head = e.kind === "head";
      spray(head ? 11 : 6, head ? 2.6 : 1.8, () => {
        const shade = 0.42 + r() * 0.25;
        return {
          size: [0.045, 0.045, 0.045],
          color: [shade, 0.04, 0.05],
          gravity: GRAVITY * 0.7,
          grow: 1.2,
          life: 0.25 + r() * 0.2,
        };
      });
      if (head)
        this.particle({
          type: "bit",
          x: e.x,
          y: e.y,
          z: e.z,
          vx: 0,
          vy: 0.4,
          vz: 0,
          size: [0.14, 0.14, 0.14],
          color: [0.7, 0.12, 0.12],
          grow: 3,
          life: 0.22,
        });
    }
  }
  // Eject one casing to the right of the view for a local shot.
  eject(cam, weapon) {
    const r = this.random,
      f = direction(cam.yaw, cam.pitch),
      right = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)],
      long = weapon === 3 ? 0.04 : weapon === 2 ? 0.018 : 0.03;
    // The ejection port sits just right of and below the line of sight, ahead of the face.
    this.particle({
      type: "bit",
      x: cam.x + f[0] * 0.6 + right[0] * 0.15,
      y: cam.y + f[1] * 0.6 - 0.16,
      z: cam.z + f[2] * 0.6 + right[2] * 0.15,
      vx: right[0] * (1.5 + r() * 0.8) + f[0] * 0.3,
      vy: 1.1 + r() * 0.6,
      vz: right[2] * (1.5 + r() * 0.8) + f[2] * 0.3,
      floor: cam.floor,
      size: [0.009, 0.009, long],
      color: weapon === 4 ? [0.85, 0.78, 0.6] : [1.3, 0.95, 0.42],
      gravity: GRAVITY,
      spinRate: 18 + r() * 12,
      angle: cam.yaw,
      life: 1.1,
    });
  }
  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.age += dt;
      if (p.type !== "bit") continue;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.spin += p.spinRate * dt;
      // Casings bounce once off the floor they were ejected over, then settle.
      if (p.floor !== undefined && p.y < p.floor + 0.01) {
        p.y = p.floor + 0.01;
        p.vy = Math.abs(p.vy) * 0.3;
        p.vx *= 0.5;
        p.vz *= 0.5;
        p.spinRate *= 0.4;
      }
    }
    for (const m of this.marks) if (m.life > 0) m.life -= dt;
  }
  // Emit instanced boxes through `add(x, y, z, w, h, d, color, angle, pitch)` within `budget`.
  draw(add, budget) {
    let n = 0;
    for (const m of this.marks) {
      if (m.life <= 0 || n >= budget) continue;
      // Marks shrink away in their last second instead of popping out.
      const s = 0.055 * Math.min(1, m.life);
      add(m.x, m.y, m.z, s, s, s, [0.09, 0.085, 0.08], m.angle, 0.6);
      n++;
    }
    for (const p of this.particles) {
      if (p.life <= 0 || n >= budget) continue;
      n++;
      if (p.type === "tracer") {
        const head = Math.min(p.dist, p.age * TRACER_SPEED),
          tail = Math.max(0, head - TRACER_LENGTH),
          len = head - tail;
        if (len <= 0.01) continue;
        const mid = (head + tail) / 2,
          [angle, pitch] = orient(p.dir);
        add(
          p.from[0] + p.dir[0] * mid,
          p.from[1] + p.dir[1] * mid,
          p.from[2] + p.dir[2] * mid,
          0.03,
          0.03,
          len,
          [2.4, 1.9, 1.0],
          angle,
          pitch,
        );
        continue;
      }
      const k = 1 + p.grow * (p.age / p.max),
        fade = p.type === "flash" ? 1 : Math.min(1, (p.life / p.max) * 2.5);
      add(
        p.x,
        p.y,
        p.z,
        p.size[0] * k * fade,
        p.size[1] * k * fade,
        p.size[2] * k * fade,
        p.color,
        (p.angle || 0) + p.spin,
        (p.pitch || 0) + p.spin * 0.7,
      );
    }
    return n;
  }
}

// Camera punch strength for a weapon relative to the assault rifle.
export const punchStrength = (weapon) => (WEAPONS[weapon]?.kick || 0.019) / 0.019;
