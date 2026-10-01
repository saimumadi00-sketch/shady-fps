import { MatchManager } from "./match.js";

export const CONQUEST_RULES = Object.freeze({
  teamSize: 5,
  tickets: 150,
  duration: 420,
  respawn: 3,
  captureTime: 8,
  neutralizeTime: 5,
  bleedInterval: 2,
});

export class ConquestMatch extends MatchManager {
  constructor(sectors) {
    super(CONQUEST_RULES);
    this.mode = "conquest";
    this.sectors = sectors.map((s) => ({ ...s }));
    this.resetObjectives();
  }
  resetObjectives() {
    this.scores = [this.rules.tickets, this.rules.tickets];
    this.bleedTime = 0;
    for (const s of this.sectors)
      Object.assign(s, {
        owner: null,
        capturing: null,
        progress: 0,
        contested: false,
        occupants: [0, 0],
      });
  }
  start() {
    super.start();
    this.resetObjectives();
  }
  // Eliminations consume the victim's team's tickets. Actor K/D stays separate.
  kill(team) {
    if (this.state !== "playing") return;
    this.scores[1 - team] = Math.max(0, this.scores[1 - team] - 1);
    if (this.scores[1 - team] === 0) this.finish();
  }
  update(dt) {
    // Simulation updates occupancy after movement, then ticks the match once.
    super.update(dt);
  }
  updateObjectives(dt, actors, arena) {
    if (this.state !== "playing") return;
    for (const s of this.sectors) {
      s.occupants[0] = s.occupants[1] = 0;
      for (const a of actors)
        if (
          a.alive &&
          Math.abs(a.y) < 1 &&
          Math.hypot(a.x - s.x, a.z - s.z) <= s.radius &&
          arena.visible(a, { ...s, y: 0 })
        )
          s.occupants[a.team]++;
      const [cyan, ember] = s.occupants;
      s.contested = cyan > 0 && ember > 0;
      if (s.contested) continue;
      const team = cyan ? 0 : ember ? 1 : null;
      if (team === null || team === s.owner) {
        s.progress = Math.max(0, s.progress - dt / this.rules.captureTime);
        if (s.progress === 0) s.capturing = null;
        continue;
      }
      if (s.capturing !== team) {
        s.progress = 0;
        s.capturing = team;
      }
      s.progress +=
        dt /
        (s.owner === null ? this.rules.captureTime : this.rules.neutralizeTime);
      if (s.progress >= 1 - 1e-9) {
        s.owner = s.owner === null ? team : null;
        s.progress = 0;
        s.capturing = null;
      }
    }
    this.bleedTime += dt;
    while (
      this.bleedTime >= this.rules.bleedInterval - 1e-9 &&
      this.state === "playing"
    ) {
      this.bleedTime = Math.max(0, this.bleedTime - this.rules.bleedInterval);
      const owned = [0, 0];
      for (const s of this.sectors) if (s.owner !== null) owned[s.owner]++;
      if (owned[0] !== owned[1]) {
        const losing = owned[0] > owned[1] ? 1 : 0;
        this.scores[losing] = Math.max(
          0,
          this.scores[losing] - Math.abs(owned[0] - owned[1]),
        );
        if (this.scores[losing] === 0) this.finish();
      }
    }
  }
  // Bots spread across sectors, prefer enemy/neutral flags, then defend owned ones.
  objectiveFor(a) {
    let best = null,
      cost = Infinity;
    for (let i = 0; i < this.sectors.length; i++) {
      const s = this.sectors[i];
      const score =
        Math.hypot(a.x - s.x, a.z - s.z) +
        (s.owner === a.team && !s.contested ? 35 : 0) +
        (i === a.id % this.sectors.length ? -12 : 0);
      if (score < cost) {
        best = s;
        cost = score;
      }
    }
    return best;
  }
}
