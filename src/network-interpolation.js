// Delayed presentation poses never modify authoritative gameplay state.
export class SnapshotInterpolator {
  constructor({ delayMs = 100 } = {}) {
    this.delayMs = delayMs;
    this.frames = [];
    this.epoch = null;
  }
  clear() {
    this.frames.length = 0;
    this.epoch = null;
  }
  push(packet, now) {
    const epoch = `${packet.code}:${packet.playerId}:${packet.match.state}`;
    const previous = this.frames[this.frames.length - 1];
    if (epoch !== this.epoch || (previous && packet.time < previous.time))
      this.clear();
    this.epoch = epoch;
    this.frames.push({
      received: now,
      time: packet.time,
      actors: packet.actors.map((a) => ({ ...a })),
    });
    if (this.frames.length > 12) this.frames.shift();
  }
  sample(actors, playerId, now) {
    if (!this.frames.length) return actors;
    const target = now - this.delayMs;
    while (this.frames.length > 2 && this.frames[1].received <= target)
      this.frames.shift();
    const first = this.frames[0];
    const second = this.frames[1] || first;
    const span = second.received - first.received;
    const t =
      span > 0 ? Math.max(0, Math.min(1, (target - first.received) / span)) : 1;
    return actors.map((actor) => {
      if (actor.id === playerId) return actor;
      const a = first.actors.find((a) => a.id === actor.id);
      const b = second.actors.find((a) => a.id === actor.id);
      if (
        !a ||
        !b ||
        a.alive !== actor.alive ||
        b.alive !== actor.alive ||
        actor.shield > a.shield + 0.1 ||
        Math.hypot(actor.x - a.x, actor.y - a.y, actor.z - a.z) > 3
      )
        return actor;
      const pose = { ...actor };
      for (const key of ["x", "y", "z", "eye", "pitch"])
        pose[key] = a[key] + (b[key] - a[key]) * t;
      const angle = Math.atan2(
        Math.sin(b.yaw - a.yaw),
        Math.cos(b.yaw - a.yaw),
      );
      pose.yaw = a.yaw + angle * t;
      return pose;
    });
  }
}
