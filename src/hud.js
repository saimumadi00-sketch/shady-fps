import { WEAPONS } from "./weapons.js";
export class HUDController {
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
  }
  update(game, quality, renderer) {
    const n = this.nodes,
      a = game.player,
      m = game.match,
      w = WEAPONS[a.weapon],
      s = a.ammo[a.weapon],
      seconds = Math.ceil(m.remaining);
    n.scoreA.textContent = m.scores[0];
    n.scoreB.textContent = m.scores[1];
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
    n.weaponName.textContent = w.name;
    n.reloadState.textContent =
      a.reload > 0
        ? `RELOADING ${a.reload.toFixed(1)}s`
        : s.mag === 0 && s.reserve === 0
          ? "NO AMMO · SWITCH WEAPON"
          : a.shield > 0
            ? "SPAWN SHIELD · FIRING ENDS IT"
            : "1 — 2 — 3 / SWITCH";
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
    n.stats.textContent = `${quality.fps} FPS · ${Math.round(quality.scale * 100)}% SCALE · ${renderer.drawCalls} DRAWS · OFFLINE`;
  }
  end(game) {
    const m = game.match;
    document.getElementById("winner").textContent =
      m.winner === null ? "DRAW" : m.winner === 0 ? "CYAN WINS" : "EMBER WINS";
    document.getElementById("finalScore").textContent = m.scores.join(" : ");
    document.getElementById("personalStats").textContent =
      `YOU / ${game.player.kills} eliminations · ${game.player.deaths} deaths`;
    const table = document.createElement("table");
    const head = document.createElement("tr");
    for (const text of ["PLAYER", "TEAM", "K", "D"]) {
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
