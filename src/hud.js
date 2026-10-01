// DOM presentation of simulation state; this module never changes combat outcomes.
import { loadout } from "./loadouts.js";
import { WEAPONS } from "./weapons.js";
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
    ])
      this.nodes[id] = document.getElementById(id);
    this.lastFeed = "";
    this.objectives = document.getElementById("objectives");
    this.sectorNodes = [];
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
        title.textContent = `${s.id} · ${s.name} ${arrow} ${Math.round(Math.hypot(s.x - a.x, s.z - a.z))}m`;
        status.textContent = s.contested
          ? "CONTESTED"
          : s.capturing !== null
            ? `${s.owner === null ? "CAPTURING" : "NEUTRALIZING"} · ${s.capturing === 0 ? "CYAN" : "EMBER"} ${Math.floor(s.progress * 100)}%`
            : s.owner === null
              ? "NEUTRAL"
              : s.owner === 0
                ? "CYAN CONTROL"
                : "EMBER CONTROL";
        progress.value = s.progress;
      });
    }
    n.timer.textContent =
      Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0") +
      ":" +
      (seconds % 60).toString().padStart(2, "0");
    n.health.textContent = Math.ceil(a.hp);
    n.healthBar.style.width = a.hp + "%";
    n.ammo.textContent = s.mag;
    n.reserve.textContent = " / " + s.reserve;
    n.weaponName.textContent = `${loadout(a.classId).name.toUpperCase()} / ${w.short}`;
    n.reloadState.textContent =
      a.reload > 0
        ? `RELOADING ${a.reload.toFixed(1)}s`
        : s.mag === 0 && s.reserve === 0
          ? "NO AMMO · SWITCH WEAPON"
          : a.shield > 0
            ? "SPAWN SHIELD · FIRING ENDS IT"
            : `${loadout(a.classId).primary + 1} PRIMARY · 3 PISTOL / PAUSE TO CHOOSE`;
    n.hitmarker.style.opacity = game.hit > 0 ? 1 : 0;
    n.damage.style.opacity = game.hurt * 0.9;
    n.notice.textContent =
      game.noticeTime > 0
        ? game.notice
        : a.sliding
          ? "SLIDING · SPACE / JUMP TO CANCEL"
          : a.sprinting
            ? "SPRINTING · C / CTRL / SLIDE"
            : "";
    n.death.hidden = a.alive || m.state === "ended" || m.state === "menu";
    n.countdown.textContent = Math.max(1, Math.ceil(a.respawn));
    // Rebuild the kill feed only when its visible contents change.
    const events = game.events.filter((e) => e.time > 0);
    const key = events.map((e) => e.killer + e.victim + e.team).join("|");
    if (key !== this.lastFeed) {
      n.feed.replaceChildren(
        ...events.map((e) => {
          let div = document.createElement("div");
          let killer = document.createElement("span");
          killer.className = e.team === 0 ? "cyan" : "orange";
          killer.textContent = e.killer;
          div.append(killer, document.createTextNode("  ▸  " + e.victim));
          return div;
        }),
      );
      this.lastFeed = key;
    }
    n.stats.textContent = `${quality.fps} FPS · ${Math.round(quality.scale * 100)}% SCALE · ${renderer.drawCalls} DRAWS · ${game.online ? game.networkLabel || "CONNECTING" : "OFFLINE"}`;
  }
  // Build a safely escaped scoreboard sorted by team and eliminations.
  end(game) {
    const m = game.match;
    document.getElementById("winner").textContent =
      m.winner === null ? "DRAW" : m.winner === 0 ? "CYAN WINS" : "EMBER WINS";
    document.getElementById("finalScore").textContent = m.scores.join(" : ");
    document.getElementById("personalStats").textContent =
      `YOU / ${game.player.kills} eliminations · ${game.player.deaths} deaths`;
    const table = document.createElement("table");
    const head = document.createElement("tr");
    for (const text of ["PLAYER", "CLASS", "TEAM", "K", "D"]) {
      const th = document.createElement("th");
      th.textContent = text;
      head.append(th);
    }
    table.append(head);
    for (const a of [...game.actors].sort(
      (a, b) => a.team - b.team || b.kills - a.kills,
    )) {
      let tr = document.createElement("tr");
      for (const text of [
        a.name,
        loadout(a.classId).name,
        a.team === 0 ? "CYAN" : "EMBER",
        a.kills,
        a.deaths,
      ]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }
      table.append(tr);
    }
    document.getElementById("roster").replaceChildren(table);
  }
}
