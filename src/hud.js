// DOM presentation of simulation state; this module never changes combat outcomes.
import { loadout } from "./loadouts.js";
import { WEAPONS, spreadFor } from "./weapons.js";
// Compass scale: screen pixels per degree of heading.
const COMPASS_PX = 4;
export class HUDController {
  // Cache frequently updated elements to avoid repeated selector lookups.
  constructor() {
    this.nodes = {};
    for (const id of [
      "scoreA",
      "scoreB",
      "timer",
      "health",
      "healthBar",
      "ammo",
      "reserve",
      "weaponName",
      "reloadState",
      "hitmarker",
      "damage",
      "notice",
      "feed",
      "stats",
      "death",
      "countdown",
      "crosshair",
      "scope",
      "compassTape",
      "heading",
      "hurtDir",
      "suppression",
    ])
      this.nodes[id] = document.getElementById(id);
    this.healthPanel = document.querySelector(".health");
    this.lastFeed = "";
    // Set from Settings: the performance line is off by default, the hint follows key bindings.
    this.showStats = false;
    this.keyHint = "1 primary · 2 pistol · Q or wheel to swap";
    this.objectives = document.getElementById("objectives");
    this.sectorNodes = [];
    this.buildCompass();
  }
  // Heading tape: three copies of a 360-degree strip, so it can scroll past north seamlessly.
  buildCompass() {
    const tape = this.nodes.compassTape;
    if (!tape) return;
    const names = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S" };
    Object.assign(names, { 225: "SW", 270: "W", 315: "NW" });
    for (let copy = 0; copy < 3; copy++)
      for (let deg = 0; deg < 360; deg += 15) {
        const tick = document.createElement("span");
        tick.textContent = names[deg] ?? String(deg).padStart(3, "0");
        if (deg % 90 === 0) tick.className = "cardinal";
        tick.style.left = (copy * 360 + deg) * COMPASS_PX + "px";
        tape.append(tick);
      }
    this.compassMarks = [];
  }
  // Per-frame HUD elements that must follow the view without lag: the compass, the damage
  // direction arc and the suppression vignette. Everything else updates at 20 Hz in update().
  frame(game) {
    const n = this.nodes,
      a = game.player;
    if (!n.compassTape || !a) return;
    // Yaw 0 looks along -Z, which the maps treat as north; headings run clockwise.
    const heading = ((((a.yaw * 180) / Math.PI) % 360) + 360) % 360;
    n.compassTape.style.transform = `translateX(${-(360 + heading) * COMPASS_PX}px)`;
    const text = String(Math.round(heading) % 360).padStart(3, "0");
    if (n.heading.textContent !== text) n.heading.textContent = text;
    // Conquest sectors ride the tape at their bearing.
    const sectors = game.match.sectors || [];
    sectors.forEach((s, i) => {
      let mark = this.compassMarks[i];
      if (!mark) {
        mark = this.compassMarks[i] = document.createElement("b");
        mark.textContent = s.id;
        n.compassTape.parentNode.append(mark);
      }
      const bearing = Math.atan2(s.x - a.x, -(s.z - a.z)) - a.yaw,
        offset =
          (Math.atan2(Math.sin(bearing), Math.cos(bearing)) * 180) / Math.PI;
      mark.hidden = Math.abs(offset) > 62;
      mark.style.transform = `translateX(${offset * COMPASS_PX}px)`;
      const owner =
        s.owner === null ? "neutral" : s.owner === 0 ? "cyan" : "ember";
      if (mark.dataset.owner !== owner) mark.dataset.owner = owner;
    });
    // Damage direction: an arc on the side of the screen the round came from.
    const hurt = game.hurt > 0 && a.hurtX != null ? game.hurt : 0;
    n.hurtDir.style.opacity = Math.min(1, hurt * 3.5);
    if (hurt) {
      const from = Math.atan2(a.hurtX - a.x, -(a.hurtZ - a.z)) - a.yaw;
      n.hurtDir.style.transform = `rotate(${from}rad)`;
    }
    n.suppression.style.opacity = a.alive
      ? Math.min(1, (a.suppression || 0) * 1.1)
      : 0;
  }
  // Refresh score, ammo, health, notices, and death countdown from the current snapshot of state.
  update(game, quality, renderer) {
    const n = this.nodes,
      a = game.player,
      m = game.match,
      w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon],
      seconds = Math.ceil(m.remaining);
    n.scoreA.textContent = m.scores[0];
    n.scoreB.textContent = m.scores[1];
    if (m.mode === "conquest") {
      if (this.sectorNodes.length === 0) {
        this.sectorNodes = m.sectors.map(() => {
          const node = document.createElement("div");
          const title = document.createElement("strong"),
            status = document.createElement("small"),
            progress = document.createElement("progress");
          progress.max = 1;
          node.append(title, status, progress);
          this.objectives.append(node);
          return { node, title, status, progress };
        });
      }
      m.sectors.forEach((s, i) => {
        const { node, title, status, progress } = this.sectorNodes[i];
        node.dataset.owner =
          s.owner === null ? "neutral" : s.owner === 0 ? "cyan" : "ember";
        node.dataset.contested = String(s.contested);
        const angle = Math.atan2(s.x - a.x, -(s.z - a.z)) - a.yaw;
        const bearing = Math.atan2(Math.sin(angle), Math.cos(angle));
        const arrow =
          Math.abs(bearing) < 0.45
            ? "↑"
            : Math.abs(bearing) > 2.6
              ? "↓"
              : bearing < 0
                ? "←"
                : "→";
        title.textContent = `${s.id} · ${s.name} ${arrow} ${Math.round(Math.hypot(s.x - a.x, s.z - a.z))} m`;
        status.textContent = s.contested
          ? "Contested"
          : s.capturing !== null
            ? `${s.capturing === 0 ? "Cyan" : "Ember"} ${s.owner === null ? "capturing" : "neutralizing"} · ${Math.floor(s.progress * 100)}%`
            : s.owner === null
              ? "Neutral"
              : s.owner === 0
                ? "Cyan holds"
                : "Ember holds";
        progress.value = s.progress;
      });
    }
    n.timer.textContent =
      Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0") + // taste-skill-ignore: match clock
      ":" +
      (seconds % 60).toString().padStart(2, "0"); // taste-skill-ignore: match clock
    n.health.textContent = Math.ceil(a.hp);
    n.healthBar.style.width = a.hp + "%";
    // Low health is the HUD's one signal colour.
    this.healthPanel?.classList.toggle("low", a.alive && a.hp < 35);
    n.ammo.textContent = s.mag;
    n.reserve.textContent = " / " + s.reserve;
    n.weaponName.textContent = w.label;
    n.reloadState.textContent =
      a.reload > 0
        ? `Reloading ${a.reload.toFixed(1)} s`
        : s.mag === 0 && s.reserve === 0
          ? loadout(a.classId).weapons.some(
              (i) => a.ammo[i].mag > 0 || a.ammo[i].reserve > 0,
            )
            ? "No ammo · switch weapon"
            : "Out of ammo · resupply at base or eliminate"
          : a.shield > 0
            ? "Spawn shield · firing ends it"
            : game.controlHint || this.keyHint;
    // Hip crosshair: arms sit at the true spread cone and fade out as the sights come up.
    const cross = n.crosshair;
    if (cross) {
      const aim = renderer?.aimBlend || 0,
        vfov = ((renderer?.customization?.fov || 83) * Math.PI) / 180,
        cone =
          ((Math.tan(spreadFor(a)) * (renderer?.zoom || 1)) /
            Math.tan(vfov / 2)) *
          (window.innerHeight / 2),
        gap = Math.max(5, Math.min(48, cone || 6));
      this.crossGap =
        (this.crossGap ?? gap) + (gap - (this.crossGap ?? gap)) * 0.3;
      cross.style.setProperty("--gap", this.crossGap.toFixed(1) + "px");
      cross.style.opacity =
        a.sprinting || a.sprintOut > 0 || a.reload > 0
          ? 0.35
          : Math.max(0, 1 - aim * 2.5);
    }
    // Scope overlay while fully aimed through a scope (the renderer hides the gun then).
    if (n.scope) n.scope.hidden = !renderer?.scoped;
    // The marker pops out on each hit and eases back; kills hold longer and read red.
    const marker = n.hitmarker,
      kind = game.hit > 0 ? game.hitKind || "body" : "";
    if (marker.dataset.kind !== kind) marker.dataset.kind = kind;
    marker.style.opacity = game.hit > 0 ? Math.min(1, game.hit * 12) : 0;
    marker.style.setProperty("--pop", 1 + Math.min(game.hit, 0.13) * 3);
    n.damage.style.opacity = game.hurt * 0.9;
    // Name the controls of the device in use: keys on desktop, button labels on touch.
    const touch = document.body.classList.contains("touch-mode");
    n.notice.textContent =
      game.noticeTime > 0
        ? game.notice
        : a.sliding
          ? touch
            ? "Sliding · JUMP to cancel"
            : `Sliding · ${this.jumpKey || "Space"} to cancel`
          : a.sprinting
            ? touch
              ? "Sprinting · CROUCH to slide"
              : `Sprinting · ${this.slideKey || "C or Ctrl"} to slide`
            : "";
    n.death.hidden = a.alive || m.state === "ended" || m.state === "menu";
    n.countdown.textContent = Math.max(1, Math.ceil(a.respawn));
    // Rebuild the kill feed only when its visible contents change.
    const events = game.events.filter((e) => e.time > 0);
    const key = events
      .map((e) => e.killer + e.victim + e.team + (e.headshot ? "h" : ""))
      .join("|");
    if (key !== this.lastFeed) {
      n.feed.replaceChildren(
        ...events.map((e) => {
          let div = document.createElement("div");
          // Kills by your side carry an edge marker, so the team never reads from hue alone.
          if (e.team === (a.team ?? 0)) div.className = "ours";
          let killer = document.createElement("span");
          killer.className = e.team === 0 ? "cyan" : "orange";
          killer.textContent = e.killer;
          div.append(
            killer,
            document.createTextNode(
              (e.headshot ? "  ◎  " : "  ▸  ") + e.victim,
            ),
          );
          return div;
        }),
      );
      this.lastFeed = key;
    }
    n.stats.textContent = !this.showStats
      ? ""
      : `${quality.fps} fps · ${Math.round(quality.scale * 100)}% resolution · ${renderer.drawCalls} draw calls · ${game.online ? game.networkLabel || "Connecting" : "Offline"}`;
  }
  // Build a safely escaped scoreboard sorted by team and eliminations.
  end(game) {
    const m = game.match;
    document.getElementById("winner").textContent =
      m.winner === null ? "Draw" : m.winner === 0 ? "Cyan wins" : "Ember wins";
    document.getElementById("finalScore").textContent = m.scores.join(" : ");
    document.getElementById("personalStats").textContent =
      `You · ${game.player.kills} eliminations · ${game.player.deaths} deaths`;
    const table = document.createElement("table");
    const head = document.createElement("tr");
    for (const text of ["Player", "Class", "Team", "Kills", "Deaths"]) {
      const th = document.createElement("th");
      th.textContent = text;
      head.append(th);
    }
    table.append(head);
    for (const a of [...game.actors].sort(
      (a, b) => a.team - b.team || b.kills - a.kills,
    )) {
      let tr = document.createElement("tr");
      for (const [i, text] of [
        a.name,
        loadout(a.classId).name,
        a.team === 0 ? "Cyan" : "Ember",
        a.kills,
        a.deaths,
      ].entries()) {
        const td = document.createElement("td");
        td.textContent = text;
        // Team names read in their team colour; kills and deaths align as numbers.
        if (i === 2) td.className = a.team === 0 ? "cyan" : "orange";
        if (i > 2) td.className = "num";
        tr.append(td);
      }
      table.append(tr);
    }
    document.getElementById("roster").replaceChildren(table);
  }
}
