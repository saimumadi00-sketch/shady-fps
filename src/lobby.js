import { classes, modes } from "./lobby-data.js";
import { createLobbyScene } from "./lobby-scene.js";
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
state.mode = modes[state.mode] ? state.mode : "Conquest";
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
function renderRoster() {
  const roster = $("roster");
  roster.replaceChildren();
  [
    {
      name: state.name,
      level: 24 + Math.floor(state.xp / 4000),
      class: state.class,
      ready,
      leader: true,
    },
    { name: "GHOST", level: 38, class: "recon", ready: true },
    { name: "ROOK", level: 31, class: "support", ready: true },
    { name: "HEX", level: 27, class: "engineer", ready: true },
  ].forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "roster-member";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = ["⟐", "⌖", "▰", "⌁"][i];
    const info = document.createElement("div"),
      name = document.createElement("strong"),
      detail = document.createElement("small");
    name.textContent = p.name + (p.leader ? " ♛" : "");
    detail.textContent = `LVL ${p.level} / ${classes[p.class].name}${p.leader ? " / YOU" : ""}`;
    info.append(name, detail);
    const status = document.createElement("span");
    status.className = "member-status";
    status.textContent = p.ready ? "✓" : "—";
    status.title = p.ready ? "Ready" : "Not ready";
    const voice = document.createElement("button");
    voice.textContent = muted.has(i) ? "×" : "◖";
    voice.setAttribute(
      "aria-label",
      `${muted.has(i) ? "Unmute" : "Mute"} ${p.name} simulated voice`,
    );
    voice.setAttribute("aria-pressed", String(muted.has(i)));
    voice.onclick = () => {
      muted.has(i) ? muted.delete(i) : muted.add(i);
      renderRoster();
    };
    row.append(avatar, info, status, voice);
    roster.append(row);
  });
  $("squad-status").textContent = `SQUAD ${ready ? "04" : "03"}/04 READY`;
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
  // Preview ratings reflect attachment tradeoffs; they do not claim to modify the legacy training simulation.
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
      return `<div class="stat">${["DAMAGE", "RANGE", "CONTROL", "HANDLING"][i]} <span>${adjusted}</span><div class="progress"><i style="width:${adjusted}%"></i></div></div>`;
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
  $("ready").textContent = ready ? "✓ READY TO DEPLOY" : "◇ MARK READY";
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
  $("deployment-mode").textContent =
    state.mode.toUpperCase() + " / DEMO OPERATION";
  $("mode-description").textContent = modes[state.mode];
  $("region").value = state.region;
  $("ping").textContent =
    { "ASIA PACIFIC": 32, EUROPE: 78, "NORTH AMERICA": 124 }[state.region] +
    " MS*";
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
  $("find-match").innerHTML = "FIND MATCH <span>→</span>";
  $("match-status").textContent = "● SYSTEM READY";
  $("mode").disabled = false;
  $("region").disabled = false;
}
$("find-match").onclick = () => {
  if (queue) {
    stopQueue();
    toast("Demo matchmaking canceled.");
    return;
  }
  setReady(true);
  let elapsed = 0;
  $("find-match").textContent = "CANCEL SEARCH ×";
  $("mode").disabled = true;
  $("region").disabled = true;
  $("match-status").textContent = "● SIMULATED SEARCH · 00:00";
  queue = setInterval(() => {
    elapsed++;
    $("match-status").textContent =
      `● ${elapsed < 4 ? "SIMULATED SEARCH" : "ASSEMBLING DEMO SQUAD"} · 00:${String(elapsed).padStart(2, "0")}`;
    if (elapsed >= 8) {
      stopQueue();
      state.drills.deployments = Math.min(
        3,
        (state.drills.deployments || 0) + 1,
      );
      renderProgress();
      modal(
        '<small>LOCAL MATCHMAKING SIMULATION</small><h2>SQUAD ASSEMBLED.</h2><p>Your demo operation is ready. The existing playable arena is offline Team Deathmatch against bots; Conquest and Domination are lobby previews.</p><button class="primary" id="launch">ENTER OFFLINE TRAINING ↗</button><button id="return-lobby" style="width:100%;margin-top:12px">RETURN TO LOBBY</button>',
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
      toast(`Daily drill complete · +${reward} demo XP`);
    }
  }
  $("challenges").innerHTML = drills
    .map(
      ([, name, n, max, reward, desc]) =>
        `<div class="challenge"><div class="challenge-header"><span>${name}</span><span>${Math.min(n, max)}/${max}</span></div><small>${desc} · ${reward} XP</small><div class="progress"><i style="width:${Math.min((n / max) * 100, 100)}%"></i></div></div>`,
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
    "<small>SEASON 04 / SIMULATED STANDINGS</small><h2>YARD CIRCUIT DIVISION</h2><p>Illustrative rankings. No live leaderboard is connected.</p><table><tr><td>01</td><td>GHOST</td><td>3,120 RP</td></tr><tr><td>02</td><td>ROOK</td><td>2,760 RP</td></tr><tr><td>03</td><td>YOU</td><td>2,480 RP</td></tr><tr><td>04</td><td>HEX</td><td>2,240 RP</td></tr></table>",
  );
$("sound").onclick = () => {
  state.sound = !state.sound;
  $("sound").textContent = state.sound ? "SOUND ON" : "SOUND OFF";
  $("sound").setAttribute("aria-pressed", String(state.sound));
  persist();
};
$("settings").onclick = () => {
  modal(
    '<small>LOCAL PREFERENCES</small><h2>OPERATOR SETTINGS</h2><label>CALLSIGN<input id="callsign" maxlength="16" autocomplete="off"></label><label>ANIMATION<select id="motion"><option value="full">Full idle animations</option><option value="reduced">Reduced motion</option></select></label><button id="save-settings" class="primary">APPLY SETTINGS</button>',
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
    toast("Operator preferences saved.");
  };
};
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-view]")
        .forEach((n) => n.classList.toggle("active", n === b));
      if (b.dataset.view === "armory") {
        $("armory").scrollIntoView({
          behavior: state.reduced ? "instant" : "smooth",
          block: "nearest",
        });
        $("armory").classList.add("highlight");
        tab("configure");
        setTimeout(() => $("armory").classList.remove("highlight"), 1800);
      }
      if (b.dataset.view === "operations") {
        modal(
          "<small>YARD OPERATIONS / LOCAL PREVIEW</small><h2>CHOOSE YOUR FRONT.</h2><p>These modes configure the simulated queue. Offline training remains the playable bot arena.</p>" +
            Object.keys(modes)
              .map(
                (m) =>
                  `<button class="operation" data-mode="${m}" style="display:block;width:100%;margin-top:10px">${m.toUpperCase()}</button>`,
              )
              .join(""),
        );
        document.querySelectorAll(".operation").forEach(
          (o) =>
            (o.onclick = () => {
              if (queue) {
                toast("Cancel the current search before changing operation.");
                return;
              }
              state.mode = o.dataset.mode;
              renderMode();
              persist();
              $("modal").close();
            }),
        );
      }
    }),
);
// Bridge only supported legacy options; new lobby weapon variants remain clearly preview profiles.
function launchTraining() {
  try {
    localStorage.setItem(
      "crosscurrent-class",
      state.class === "recon" ? "scout" : state.class,
    );
    // Carbines and sniper variants map to each class's supported training primary.
    localStorage.setItem(
      "crosscurrent-weapon",
      String({ assault: 0, engineer: 1, support: 4, recon: 3 }[state.class]),
    );
  } catch {}
  location.href = "./arena.html";
}
document.querySelector(".training").onclick = (e) => {
  e.preventDefault();
  launchTraining();
};
renderLoadout();
renderMode();
renderProgress();
scene?.setReducedMotion(state.reduced);
$("sound").textContent = state.sound ? "SOUND ON" : "SOUND OFF";
// Production registers the shared offline cache; development keeps dependency modules fresh.
if ("serviceWorker" in navigator && !import.meta.url.includes("/src/"))
  navigator.serviceWorker.register("./sw.js").catch(() => {});
