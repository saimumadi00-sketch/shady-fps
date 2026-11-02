import { classes, modes } from "./lobby-data.js";
import { createLobbyScene } from "./lobby-scene.js";
import { outpostMap } from "./outpost-map.js";
const $ = (id) => document.getElementById(id),
  key = "crosscurrent-orbital-v1";
const defaults = {
  class: "assault",
  weapon: 0,
  optic: "reflex",
  barrel: "standard",
  skin: "graphite",
  name: "NOVA",
  mode: "Conquest",
  region: "ASIA PACIFIC",
  xp: 2450,
  slots: [null, null, null],
  sound: false,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  drills: {
    day: new Date().toLocaleDateString(),
    saved: 0,
    classes: [],
    deployments: 0,
    awarded: [],
  },
};
// Validate persisted choices; corrupt or outdated storage must never prevent the lobby opening.
let state = structuredClone(defaults);
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && typeof saved === "object") state = { ...state, ...saved };
} catch {}
function normalize(s) {
  return {
    ...s,
    class: classes[s.class] ? s.class : "assault",
    weapon: [0, 1].includes(s.weapon) ? s.weapon : 0,
    optic: ["iron", "reflex", "scope"].includes(s.optic) ? s.optic : "reflex",
    barrel: ["standard", "compensator", "suppressor"].includes(s.barrel)
      ? s.barrel
      : "standard",
    skin: ["graphite", "sand", "olive"].includes(s.skin) ? s.skin : "graphite",
  };
}
state = normalize(state);
state.name = typeof state.name === "string" ? state.name.slice(0, 16) : "NOVA";
state.xp = Number.isFinite(state.xp) ? Math.max(0, state.xp) : 2450;
state.slots = Array.isArray(state.slots)
  ? state.slots.slice(0, 3)
  : [null, null, null];
state.mode = Object.hasOwn(modes, state.mode) ? state.mode : "Conquest";
state.region = ["ASIA PACIFIC", "EUROPE", "NORTH AMERICA"].includes(
  state.region,
)
  ? state.region
  : "ASIA PACIFIC";
if (
  !state.drills ||
  state.drills.day !== defaults.drills.day ||
  !Array.isArray(state.drills.classes) ||
  !Array.isArray(state.drills.awarded)
)
  state.drills = structuredClone(defaults.drills);
let ready = false,
  queue = null,
  toastTimer,
  audioContext,
  scene;
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    toast("Storage unavailable; changes remain for this session.");
  }
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3200);
}
// Short synthetic interface tones start only after an explicit sound toggle / user gesture.
function sound() {
  if (!state.sound) return;
  try {
    audioContext ??= new AudioContext();
    audioContext.resume();
    const osc = audioContext.createOscillator(),
      gain = audioContext.createGain();
    osc.frequency.setValueAtTime(620, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      360,
      audioContext.currentTime + 0.07,
    );
    gain.gain.setValueAtTime(0.025, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.09,
    );
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
  } catch {}
}
document.addEventListener("click", (e) => {
  if (e.target.closest("button")) sound();
});
try {
  scene = createLobbyScene($("squad-canvas"), $("weapon-canvas"));
} catch (error) {
  console.error(error);
  toast(
    "3D preview unavailable. Enable WebGL to see your squad; lobby controls still work.",
  );
}
const muted = new Set();
// Members are listed left to right in the order their figures stand on the spawn pad.
// Each person keeps one initial and one identity tint, spaced 90 degrees apart.
const SQUAD = [
  { id: "hex", name: "HEX", level: 27, class: "engineer", hue: 30 },
  { id: "rook", name: "ROOK", level: 31, class: "support", hue: 120 },
  { id: "you", leader: true, hue: 180 },
  { id: "ghost", name: "GHOST", level: 38, class: "recon", hue: 270 },
];
function renderRoster() {
  const roster = $("roster");
  roster.replaceChildren();
  const members = SQUAD.map((m) =>
    m.leader
      ? {
          ...m,
          name: state.name,
          level: 24 + Math.floor(state.xp / 4000),
          class: state.class,
          ready,
        }
      : { ...m, ready: true },
  );
  for (const p of members) {
    const row = document.createElement("div");
    row.className = "roster-member";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = p.name.slice(0, 1);
    avatar.style.background = `hsl(${p.hue} 22% 20%)`;
    avatar.style.color = `hsl(${p.hue} 55% 82%)`;
    const info = document.createElement("div"),
      name = document.createElement("strong"),
      detail = document.createElement("small");
    name.textContent = p.leader ? `${p.name} (you)` : p.name;
    detail.textContent = `Level ${p.level} · ${classes[p.class].name}`;
    info.append(name, detail);
    const foot = document.createElement("div");
    foot.className = "member-foot";
    const status = document.createElement("span");
    status.className = "pill" + (p.ready ? " ready" : "");
    status.textContent = p.ready ? "Ready" : "Not ready";
    foot.append(status);
    if (!p.leader) {
      const voice = document.createElement("button");
      voice.className = "mute";
      voice.textContent = muted.has(p.id) ? "Muted" : "Mute";
      voice.setAttribute(
        "aria-label",
        `${muted.has(p.id) ? "Unmute" : "Mute"} ${p.name}'s simulated voice`,
      );
      voice.setAttribute("aria-pressed", String(muted.has(p.id)));
      voice.onclick = () => {
        muted.has(p.id) ? muted.delete(p.id) : muted.add(p.id);
        renderRoster();
      };
      foot.append(voice);
    }
    row.append(avatar, info, foot);
    roster.append(row);
  }
  // The screen's finding: who the squad is waiting on.
  const count = members.filter((m) => m.ready).length,
    summary = $("squad-status");
  summary.replaceChildren(`${count} of ${members.length} ready · `);
  const next = document.createElement("strong");
  next.textContent = ready ? "find a match to deploy" : "waiting on you";
  summary.append(next);
}
function config() {
  return {
    ...classes[state.class].weapons[state.weapon],
    optic: state.optic,
    barrel: state.barrel,
    skin: state.skin,
  };
}
function renderLoadout() {
  document.querySelectorAll("[data-class]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.class === state.class);
    b.setAttribute("aria-pressed", String(b.dataset.class === state.class));
  });
  const cls = classes[state.class];
  $("weapon").replaceChildren(
    ...cls.weapons.map((w, i) => new Option(w.name, i)),
  );
  $("weapon").value = state.weapon;
  const weapon = config();
  $("weapon-category").textContent = weapon.category;
  $("weapon-description").textContent = weapon.description;
  $("operator-class").textContent = cls.name;
  $("operator-role").textContent = cls.role;
  $("optic").value = state.optic;
  $("barrel").value = state.barrel;
  document.querySelectorAll("[data-skin]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.skin === state.skin);
    b.setAttribute("aria-pressed", String(b.dataset.skin === state.skin));
  });
  // Preview ratings reflect attachment tradeoffs; attachments are cosmetic in combat.
  $("stats").innerHTML = weapon.stats
    .map((value, i) => {
      const adjusted = Math.max(
        0,
        Math.min(
          100,
          value +
            (state.barrel === "compensator" && i === 2 ? 8 : 0) +
            (state.optic === "scope" && i === 3 ? -12 : 0) +
            (state.barrel === "suppressor" && i === 1 ? -7 : 0),
        ),
      );
      return `<div class="stat-row"><span>${["Damage", "Range", "Control", "Handling"][i]}</span><div class="track"><i style="width:${adjusted}%"></i></div><b>${adjusted}</b></div>`;
    })
    .join("");
  scene?.update(state.class, weapon);
  renderRoster();
  persist();
}
for (const [id, cls] of Object.entries(classes)) {
  const button = document.createElement("button");
  button.dataset.class = id;
  button.textContent = cls.name;
  button.onclick = () => {
    state.class = id;
    state.weapon = 0;
    if (!state.drills.classes.includes(id)) state.drills.classes.push(id);
    renderLoadout();
    renderProgress();
  };
  document.querySelector(".class-tabs").append(button);
}
$("weapon").onchange = (e) => {
  state.weapon = Number(e.target.value);
  renderLoadout();
};
for (const id of ["optic", "barrel"])
  $(id).onchange = (e) => {
    state[id] = e.target.value;
    renderLoadout();
  };
document.querySelectorAll("[data-skin]").forEach(
  (b) =>
    (b.onclick = () => {
      state.skin = b.dataset.skin;
      renderLoadout();
    }),
);
// Tabs expose only their own controls and preserve the current loadout while switching views.
function tab(name) {
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.tab === name)),
    );
  for (const id of ["configure", "stats", "saved"]) $(id).hidden = id !== name;
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
$("save").onclick = () => {
  state.slots[Number($("slot").value)] = {
    class: state.class,
    weapon: state.weapon,
    optic: state.optic,
    barrel: state.barrel,
    skin: state.skin,
  };
  state.drills.saved = 1;
  renderProgress();
  persist();
  toast("Loadout saved to this device.");
};
$("load").onclick = () => {
  const saved = state.slots[Number($("slot").value)];
  if (!saved || typeof saved !== "object")
    return toast("This slot is empty. Save a loadout first.");
  const valid = normalize(saved);
  for (const k of ["class", "weapon", "optic", "barrel", "skin"])
    state[k] = valid[k];
  renderLoadout();
  toast("Saved loadout equipped.");
};
function setReady(value) {
  ready = value;
  $("ready").setAttribute("aria-pressed", String(ready));
  $("ready").textContent = ready ? "Ready" : "Mark ready";
  renderRoster();
}
$("ready").onclick = () => {
  if (queue) return toast("Cancel matchmaking to change readiness.");
  setReady(!ready);
};
function appendChat(name, message) {
  const p = document.createElement("p"),
    b = document.createElement("b");
  b.textContent = name + " ";
  p.append(b, document.createTextNode(message));
  $("chat-log").append(p);
  while ($("chat-log").children.length > 40) $("chat-log").firstChild.remove();
  $("chat-log").scrollTop = $("chat-log").scrollHeight;
}
$("chat-form").onsubmit = (e) => {
  e.preventDefault();
  const message = $("chat-input").value.trim();
  if (!message) return;
  appendChat(state.name, message);
  $("chat-input").value = "";
  setTimeout(
    () => appendChat("GHOST [SIM]", "Copy that. Standing by for deployment."),
    1100,
  );
};
function renderMode() {
  $("mode").value = state.mode;
  const conquest = state.mode === "Conquest";
  const map = $("deploy-map");
  map.querySelector("svg, img")?.remove();
  if (conquest) map.insertAdjacentHTML("afterbegin", outpostMap());
  else {
    const img = new Image();
    img.src = "./assets/yard-map.svg";
    img.alt =
      "Yard 07: freight stacks split the yard into north, middle and south lanes, Cyan spawns west, Ember east";
    map.prepend(img);
  }
  document.querySelector(".friends-link").href =
    "./arena.html?online=1&mode=" + (conquest ? "conquest" : "tdm");
  const training = document.querySelector(".training");
  training.textContent = conquest
    ? "Play Conquest offline"
    : "Play Team Deathmatch offline";
  training.href = conquest ? "./arena.html?mode=conquest" : "./arena.html";
  $("mode-description").textContent = modes[state.mode];
  $("region").value = state.region;
  $("ping").textContent =
    { "ASIA PACIFIC": 32, EUROPE: 78, "NORTH AMERICA": 124 }[state.region] +
    " ms simulated";
}
for (const id of ["mode", "region"])
  $(id).onchange = (e) => {
    state[id] = e.target.value;
    renderMode();
    persist();
  };
function modal(html) {
  $("modal-content").innerHTML = html;
  $("modal").showModal();
}
$("close-modal").onclick = () => $("modal").close();
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) {
    const r = $("modal").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("modal").close();
  }
});
// A cancelable timer drives an explicitly local queue; no network matchmaking is attempted.
function stopQueue() {
  clearInterval(queue);
  queue = null;
  $("find-match").textContent = "Find match";
  $("match-status").textContent = "Not searching";
  $("mode").disabled = false;
  $("region").disabled = false;
}
$("find-match").onclick = () => {
  if (queue) {
    stopQueue();
    toast("Search cancelled.");
    return;
  }
  setReady(true);
  let elapsed = 0;
  $("find-match").textContent = "Cancel search";
  $("mode").disabled = true;
  $("region").disabled = true;
  $("match-status").textContent = "Searching · 0:00";
  queue = setInterval(() => {
    elapsed++;
    $("match-status").textContent =
      `${elapsed < 4 ? "Searching" : "Assembling squad"} · 0:${elapsed < 10 ? "0" : ""}${elapsed}`;
    if (elapsed >= 8) {
      stopQueue();
      state.drills.deployments = Math.min(
        3,
        (state.drills.deployments || 0) + 1,
      );
      renderProgress();
      modal(
        `<h2>Squad assembled</h2><p>${state.mode === "Conquest" ? "Conquest is ready on FreeDM Outpost: capture A, B and C and drain the enemy's tickets in an offline 5v5 against bots." : state.mode === "Domination" ? "Domination is still a lobby preview, so this deploys to offline Team Deathmatch on Yard 07." : "Offline Team Deathmatch is ready on Yard 07."}</p><button class="primary" id="launch">Play ${state.mode === "Conquest" ? "Conquest" : "Team Deathmatch"}</button><button class="secondary" id="return-lobby">Back to lobby</button>`,
      );
      $("launch").onclick = launchTraining;
      $("return-lobby").onclick = () => $("modal").close();
    }
  }, 1000);
};
function renderProgress() {
  const drills = [
    [
      "saved",
      "Field prepared",
      state.drills.saved || 0,
      1,
      150,
      "Save a custom loadout",
    ],
    [
      "classes",
      "Know your squad",
      state.drills.classes.length,
      4,
      250,
      "Explore all four classes",
    ],
    [
      "deployments",
      "Deployment ready",
      state.drills.deployments || 0,
      3,
      400,
      "Complete three demo queues",
    ],
  ];
  for (const [id, , n, max, reward] of drills) {
    if (n >= max && !state.drills.awarded.includes(id)) {
      state.drills.awarded.push(id);
      state.xp += reward;
      toast(`Daily drill complete: +${reward} XP`);
    }
  }
  $("challenges").innerHTML = drills
    .map(
      ([, name, n, max, reward, desc]) =>
        `<div class="challenge${n >= max ? " done" : ""}" title="${name}"><div class="challenge-header"><span>${desc} <small>· ${reward} XP</small></span><span>${Math.min(n, max)} of ${max}</span></div><div class="bar-track"><i style="width:${Math.min((n / max) * 100, 100)}%"></i></div></div>`,
    )
    .join("");
  $("level").textContent = 24 + Math.floor(state.xp / 4000);
  $("xp-text").textContent = `${(state.xp % 4000).toLocaleString()} / 4,000 XP`;
  $("xp-bar").style.width = (state.xp % 4000) / 40 + "%";
  renderRoster();
  persist();
}
$("rankings").onclick = () =>
  modal(
    '<h2>Season 04 standings</h2><p>Your squad\'s division. These rankings are simulated; no live leaderboard is connected.</p><table><tr><td>1.</td><td>GHOST</td><td>3,120 RP</td></tr><tr><td>2.</td><td>ROOK</td><td>2,760 RP</td></tr><tr class="you"><td>3.</td><td>You</td><td>2,480 RP</td></tr><tr><td>4.</td><td>HEX</td><td>2,240 RP</td></tr></table>',
  );
$("sound").onclick = () => {
  state.sound = !state.sound;
  $("sound").textContent = state.sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(state.sound));
  persist();
};
$("settings").onclick = () => {
  modal(
    '<h2>Settings</h2><p>Saved on this device.</p><label>Callsign<input id="callsign" maxlength="16" autocomplete="off"></label><label>Animation<select id="motion"><option value="full">Full idle animations</option><option value="reduced">Reduced motion</option></select></label><button id="save-settings" class="primary">Save settings</button>',
  );
  $("callsign").value = state.name;
  $("motion").value = state.reduced ? "reduced" : "full";
  $("save-settings").onclick = () => {
    state.name = $("callsign").value.trim().toUpperCase() || "NOVA";
    state.reduced = $("motion").value === "reduced";
    scene?.setReducedMotion(state.reduced);
    renderRoster();
    persist();
    $("modal").close();
    toast("Settings saved.");
  };
};
// On a phone the navigation and bar actions fold into one menu.
$("menu-toggle").onclick = () => {
  const open = $("site-nav").classList.toggle("open");
  $("menu-toggle").setAttribute("aria-expanded", String(open));
  $("menu-toggle").textContent = open ? "Close" : "Menu";
};
// Launch the arena with the selected class; preview variants deploy with the class primary.
function launchTraining() {
  try {
    localStorage.setItem("crosscurrent-class", state.class);
    localStorage.setItem(
      "crosscurrent-weapon",
      String({ assault: 0, engineer: 1, support: 4, recon: 3 }[state.class]),
    );
  } catch {}
  location.href =
    state.mode === "Conquest" ? "./arena.html?mode=conquest" : "./arena.html";
}
document.querySelector(".training").onclick = (e) => {
  e.preventDefault();
  launchTraining();
};
renderLoadout();
renderMode();
renderProgress();
scene?.setReducedMotion(state.reduced);
$("sound").textContent = state.sound ? "Sound on" : "Sound off";
$("sound").setAttribute("aria-pressed", String(state.sound));
// Production registers the shared offline cache; development keeps dependency modules fresh.
if ("serviceWorker" in navigator && !import.meta.url.includes("/src/"))
  navigator.serviceWorker.register("./sw.js").catch(() => {});
