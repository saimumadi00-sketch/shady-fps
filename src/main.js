// Application entry point: connects DOM menus, input, simulation, rendering, and offline installation.
import { NetworkClient } from "./network.js";
import { InputManager } from "./input.js";
import { SettingsManager, QualityManager, AudioManager } from "./settings.js";
import { FootstepTracker, lineOfSound } from "./audio.js";
import { outpostMap } from "./outpost-map.js";
import { TDM_MAPS, tdmMap, tdmOverview } from "./maps/tdm-maps.js";
import { OfflineSimulation } from "./game.js";
import { Renderer } from "./renderer.js";
import { HUDController } from "./hud.js";
import { Customization } from "./customization.js";
import { initOperatorSelect } from "./operator-select.js";
import {
  CLASS_IDS,
  LOADOUTS,
  loadout,
  classForWeapon,
  normalizeClass,
} from "./loadouts.js";
import { WEAPONS } from "./weapons.js";
import { weaponMesh } from "./weapon-models.js";
const $ = (id) => document.getElementById(id);
let network,
  localPaused = false;
let game,
  renderer,
  input,
  contextLost = false,
  rotationPaused = false;
// Surface initialization failures in the page as well as the console.
function fatal(error) {
  console.error(error);
  $("fatalText").textContent = error.message || String(error);
  $("fatal").hidden = false;
}
// Freeze gameplay and clear held controls before releasing pointer capture.
function pause(reason = "Combat is paused.") {
  if (!game || game.match.state !== "playing") return;
  if (network && !input.active) return;
  if (network) localPaused = true;
  else game.match.state = "paused";
  input.active = false;
  input.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $("pauseReason").textContent = network
    ? "Your controls are stopped. The shared match continues."
    : typeof reason === "string"
      ? reason
      : "Combat is paused.";
  $("pause").hidden = false;
  $("pauseWeapon").value = String(game.player.weapon);
  weaponInfo("pauseWeapon", "pauseWeaponInfo");
}
// Render weapon descriptions from the same data used by combat.
function weaponInfo(selectId, infoId) {
  const w = WEAPONS[Number($(selectId).value)];
  $(infoId).textContent =
    `${w.description} ${w.magazine} rounds · ${w.damage[0]}→${w.damage[1]} damage (${w.falloff[0]}–${w.falloff[1]} m) · ${w.headshot}x head · ${w.rpm} RPM · ${w.reload}s reload`;
}
// Switch control hints and touch overlays without restarting the match.
function controls() {
  document.body.classList.toggle("touch-mode", input.touch);
  if (game) game.controlHint = input.touch ? "Swap: primary or pistol" : "";
  $("touch").hidden = !input.touch || !input.active;
  $("hint").textContent =
    input.mouseFallback && !input.touch
      ? "Mouse capture unavailable: hold the right button and drag to aim"
      : "Mouse aim · Shift then C to slide · Space cancels";
  if (!input.touch)
    $("controlsHelp").textContent =
      "Mouse aim · Right mouse ADS · WASD move · Shift sprint · C / Ctrl slide while sprinting · Space jump / slide cancel · R reload · 1 primary / 2 pistol · Q or wheel swap · Esc pause";
  if (input.touch)
    $("controlsHelp").textContent =
      "Left stick move · SPRINT locks a run (or push the stick fully) · Drag the right side to look · Hold FIRE and drag to steer while shooting · AIM toggles sights · CROUCH, or slide while sprinting · JUMP, also cancels a slide · RELOAD · SWAP primary / pistol · PAUSE top right";
  orientation();
}
// Pause touch gameplay in portrait so hidden controls cannot leave the player vulnerable.
// The setup screen works in portrait, so the prompt only covers an active match.
function orientation() {
  const portrait = input.touch && innerHeight > innerWidth;
  $("rotate").hidden = !(portrait && $("menu").hidden);
  if (portrait && game?.match.state === "playing") {
    rotationPaused = true;
    pause("Device rotated. Return to landscape, then resume.");
  }
  if (!portrait && rotationPaused) rotationPaused = false;
}
try {
  const settings = new SettingsManager(),
    quality = new QualityManager(settings),
    audio = new AudioManager(settings);
  input = new InputManager($("canvas"), pause, controls);
  $("progress").textContent = "30%";
  const params = new URLSearchParams(location.search);
  game = new OfflineSimulation(input, audio, Math.random, {
    mode: params.get("mode"),
    map: params.get("map"),
  });
  $("matchMode").value = game.mode;
  $("matchMode").addEventListener("change", () => {
    params.set("mode", $("matchMode").value);
    location.search = params.toString();
  });
  // Team Deathmatch map choice; changing it reloads onto the new arena like the mode does.
  for (const m of TDM_MAPS) {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.name;
    $("matchMap").append(option);
  }
  $("matchMapField").hidden = game.mode === "conquest";
  $("matchMap").value = game.mode === "conquest" ? TDM_MAPS[0].id : game.mapId;
  $("matchMap").addEventListener("change", () => {
    params.set("map", $("matchMap").value);
    location.search = params.toString();
  });
  if (game.mode !== "conquest") {
    const map = tdmMap(game.mapId);
    document.title = `Crosscurrent · ${map.name}`;
    $("mapName").textContent = $("briefMapName").textContent = map.name;
    $("briefDescription").textContent = map.description;
    $("tagline").textContent = map.tagline;
    $("mapOverview").outerHTML = tdmOverview(game.arena, "mapOverview");
    $("mapCredit").textContent =
      `${map.name} · drawn to scale · grid squares 5 m`;
  }
  if (game.mode === "conquest") {
    document.title = "Crosscurrent · Conquest setup";
    $("mapName").textContent = $("briefMapName").textContent = game.arena.name;
    $("modeLabel").textContent = $("briefMode").textContent = "Conquest";
    $("briefDescription").textContent =
      "Capture A, B and C. Holding more sectors drains the enemy's tickets, and every death costs a ticket. The team with tickets left wins.";
    $("tagline").textContent = "Three sectors, two teams, one outpost";
    $("ruleTargetLabel").textContent = "Tickets per team";
    // Conquest's score is the fixed 150 tickets shown in the rules strip; Time limit takes the row.
    $("target").disabled = true;
    $("target").closest("label").hidden = true;
    $("duration").closest("label").classList.add("wide");
    $("mapOverview").outerHTML = outpostMap("mapOverview");
    $("mapCredit").textContent =
      "FreeDM Outpost, from Freedoom (BSD-3-Clause), drawn to scale";
    $("objectives").hidden = false;
  }
  renderer = new Renderer($("canvas"), game.arena);
  // Walls between the listener and a sound muffle it.
  audio.occluded = lineOfSound(game.arena);
  const hud = new HUDController();
  // Restore only a valid arsenal index; unavailable storage must not block play.
  let selectedWeapon = 0;
  try {
    const saved = Number(localStorage.getItem("crosscurrent-weapon"));
    if (Number.isInteger(saved) && WEAPONS[saved]) selectedWeapon = saved;
  } catch {}
  // Keep menu and pause selectors synchronized; equipping never replenishes ammunition.
  let selectedClass = classForWeapon(selectedWeapon);
  try {
    const saved = normalizeClass(localStorage.getItem("crosscurrent-class"));
    if (CLASS_IDS.includes(saved)) selectedClass = saved;
  } catch {}
  for (const id of CLASS_IDS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = LOADOUTS[id].name;
    $("loadoutClass").append(option);
  }
  $("loadoutClass").value = selectedClass;
  // Online equips travel as the same slot keys a player would press.
  const slotKey = (index) =>
    "Digit" + (loadout(selectedClass).weapons.indexOf(index) + 1);
  // Rebuild both weapon selectors from the class definition; never expose other class guns.
  function refreshLoadout() {
    const kit = loadout(selectedClass);
    if (!kit.weapons.includes(selectedWeapon)) selectedWeapon = kit.primary;
    $("classInfo").textContent =
      `${kit.description} Carries the ${WEAPONS[kit.primary].label.toLowerCase()} and a pistol.`;
    for (const id of ["startingWeapon", "pauseWeapon"]) {
      $(id).replaceChildren();
      kit.weapons.forEach((index) => {
        const w = WEAPONS[index];
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${kit.weapons.indexOf(index) === 0 ? "Primary" : "Sidearm"} · ${w.label}`;
        $(id).append(option);
      });
      $(id).value = String(selectedWeapon);
      const infoId =
        id === "startingWeapon" ? "startingWeaponInfo" : "pauseWeaponInfo";
      weaponInfo(id, infoId);
    }
  }
  refreshLoadout();
  for (const id of ["startingWeapon", "pauseWeapon"]) {
    const infoId =
      id === "startingWeapon" ? "startingWeaponInfo" : "pauseWeaponInfo";
    $(id).addEventListener("change", () => {
      selectedWeapon = Number($(id).value);
      $("startingWeapon").value = String(selectedWeapon);
      weaponInfo("startingWeapon", "startingWeaponInfo");
      weaponInfo(id, infoId);
      if (id === "pauseWeapon") {
        if (network) input.actions.add(slotKey(selectedWeapon));
        else game.weapons.equip(game.player, selectedWeapon);
      }
      try {
        // Persist the inferred class too, so legacy primary saves retain their class after selecting a pistol.
        localStorage.setItem("crosscurrent-class", selectedClass);
        localStorage.setItem("crosscurrent-weapon", String(selectedWeapon));
      } catch {}
    });
  }
  const customization = new Customization();
  renderer.customization = customization.values;
  $("loadoutClass").addEventListener("change", () => {
    selectedClass = $("loadoutClass").value;
    selectedWeapon = loadout(selectedClass).primary;
    refreshLoadout();
    customization.refresh();
    try {
      localStorage.setItem("crosscurrent-class", selectedClass);
      localStorage.setItem("crosscurrent-weapon", String(selectedWeapon));
    } catch {}
  });
  // Operator cards, stage and tabs drive the class and weapon selects above.
  const operators = initOperatorSelect();
  $("progress").textContent = "100%";
  // Resume from a user gesture so the browser can grant pointer lock and audio access.
  async function resume() {
    if (contextLost) return;
    if (network && (!network.ready || game.match.state !== "playing")) return;
    if (!network) game.match.state = "playing";
    localPaused = false;
    input.clear();
    input.active = true;
    if (network && selectedWeapon !== game.player.weapon)
      input.actions.add(slotKey(selectedWeapon));
    $("pause").hidden = true;
    $("menu").hidden = true;
    $("end").hidden = true;
    $("hud").hidden = false;
    audio.unlock(); // taste-skill-ignore: audio.unlock() call, not copy
    controls();
    if (game.match.state === "playing") await input.lock();
  }
  // Apply saved match rules before resetting scores, actors, and timers.
  function start() {
    if (network) {
      if (network.ready) {
        quality.configure();
        resume();
      }
      return;
    }
    customization.apply(game);
    game.start(settings.values.difficulty, selectedWeapon, selectedClass);
    quality.configure();
    resume();
  }
  // Return to setup and refresh the preview after in-match weapon changes.
  function menu() {
    if (network) {
      network.leave().then(() => location.reload());
      return;
    }
    game.match.state = "menu";
    input.active = false;
    input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    for (const id of ["pause", "end", "hud", "touch", "death"])
      $(id).hidden = true;
    customization.refresh();
    $("menu").hidden = false;
    orientation();
  }
  $("play").disabled = false;
  // Solve each gun's hand poses in idle time (they are cached per gun), so the first draw or
  // switch to a weapon never stalls a frame. The selected class's guns go first.
  {
    const order = [
        ...new Set([...loadout(selectedClass).weapons, 0, 1, 2, 3, 4]),
      ],
      idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
    const next = () => {
      if (!order.length) return;
      weaponMesh(order.shift(), "graphite", "iron", false, true);
      idle(next);
    };
    idle(next);
  }
  $("play").textContent = "Deploy";
  $("status").textContent = "ready: you and 9 bots, no network needed";
  $("play").onclick = start;
  $("resume").onclick = resume;
  $("restart").onclick = start;
  $("back").onclick = menu;
  $("endMenu").onclick = menu;
  $("pauseButton").onclick = () => pause();
  if (params.has("online")) {
    $("roomPanel").hidden = false;
    operators.showTab("mission");
    $("arenaEdition").textContent = "Private room";
    customization.values.duration = 420;
    customization.values.target = 30;
    customization.refresh();
    $("duration").value = "420";
    $("target").value = "30";
    $("roomCode").value = params.get("room") || "";
    $("roomTeam").value = params.get("team") === "1" ? "1" : "0";
    $("play").disabled = true;
    $("play").textContent = "Waiting for room";
    $("status").textContent = "private room for up to 10 players";
    $("tagline").textContent = "Invite friends, pick a team, play together";
    $("scoreTarget").textContent =
      game.mode === "conquest" ? "Tickets · hold sectors" : "First to 30";
    $("duration").disabled =
      $("target").disabled =
      $("difficulty").disabled =
        true;
    network = new NetworkClient(game, input, {
      sensitivity: () => settings.values.sensitivity,
      onState(packet) {
        $("matchMode").disabled = $("matchMap").disabled = true;
        $("roomCode").value = packet.code;
        $("roomMessage").textContent =
          `Room ${packet.code} · ${packet.host ? "you are the host" : "the host starts the match"} · ${{ menu: "waiting", playing: "playing", ended: "ended", paused: "paused" }[packet.match.state] || packet.match.state}`;
        $("roomRoster").textContent = packet.players
          .map(
            (p) =>
              `${p.name} / ${p.team ? "Ember" : "Cyan"}${p.host ? " (host)" : ""}`,
          )
          .join(" · ");
        $("createRoom").disabled =
          $("joinRoom").disabled =
          $("roomTeam").disabled =
          $("loadoutClass").disabled =
          $("startingWeapon").disabled =
          $("callsign").disabled =
            true;
        $("copyRoom").hidden = $("leaveRoom").hidden = false;
        $("startRoom").hidden = !packet.host;
        $("startRoom").disabled = packet.match.state === "playing";
        $("startRoom").textContent =
          packet.match.state === "ended"
            ? "Restart shared match"
            : "Start shared match";
        $("play").disabled = packet.match.state !== "playing";
        $("play").textContent = "Enter shared match";
        $("restart").disabled = !packet.host;
        $("restart").textContent = packet.host
          ? "Restart shared match"
          : "Waiting for host";
        game.networkLabel = `Room ${packet.code} · ${network.ping} ms`;
        if (
          packet.match.state === "playing" &&
          !input.active &&
          !localPaused &&
          $("menu").hidden &&
          $("end").hidden === false
        ) {
          $("end").hidden = true;
          $("menu").hidden = false;
        }
      },
      onDisconnect(reason) {
        if (document.pointerLockElement) document.exitPointerLock();
        $("pause").hidden =
          $("end").hidden =
          $("touch").hidden =
          $("hud").hidden =
            true;
        $("menu").hidden = false;
        $("roomMessage").textContent = reason || "Left the room.";
        $("play").disabled = true;
        for (const id of [
          "createRoom",
          "joinRoom",
          "roomTeam",
          "loadoutClass",
          "startingWeapon",
          "callsign",
          "matchMode",
          "matchMap",
        ])
          $(id).disabled = false;
        $("copyRoom").hidden =
          $("startRoom").hidden =
          $("leaveRoom").hidden =
            true;
      },
    });
    async function joinRoom(create) {
      localPaused = false;
      $("createRoom").disabled = $("joinRoom").disabled = true;
      try {
        await network.join(
          {
            code: $("roomCode").value.trim(),
            mode: game.mode,
            map: game.mapId,
            team: Number($("roomTeam").value),
            name: $("callsign").value,
            classId: selectedClass,
            weapon: selectedWeapon,
          },
          create,
        );
      } catch (error) {
        $("roomMessage").textContent = error.message;
        $("createRoom").disabled = $("joinRoom").disabled = false;
      }
    }
    $("leaveRoom").onclick = menu;
    $("createRoom").onclick = () => joinRoom(true);
    $("joinRoom").onclick = () => joinRoom(false);
    async function startShared() {
      try {
        await network.request("start");
      } catch (error) {
        $("roomMessage").textContent = error.message;
      }
    }
    $("startRoom").onclick = startShared;
    $("restart").onclick = async () => {
      await startShared();
      $("end").hidden = true;
      $("menu").hidden = false;
      localPaused = false;
    };
    $("back").textContent = $("endMenu").textContent = "Leave room";
    $("copyRoom").onclick = async () => {
      const url = new URL(location.href);
      url.searchParams.set("room", network.code);
      url.searchParams.delete("debug");
      try {
        await navigator.clipboard.writeText(url.href);
        $("roomMessage").textContent = "Invite link copied.";
      } catch {
        $("roomMessage").textContent = `Send friends this link: ${url.href}`;
      }
    };
    setInterval(() => network.send(), 1000 / 30);
    window.addEventListener("pagehide", () => {
      if (network.token)
        fetch("/api/leave", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + network.token,
          },
          body: "{}",
          keepalive: true,
        }).catch(() => {});
    });
  }
  controls();
  window.addEventListener("resize", orientation);
  window.addEventListener("orientationchange", orientation);
  // Suspend rendering while GPU resources are invalid; restore them before allowing play.
  $("canvas").addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
    pause("Graphics context lost. Waiting for the browser to restore it…");
  });
  $("canvas").addEventListener("webglcontextrestored", () => {
    try {
      renderer.initialize();
      contextLost = false;
      $("pauseReason").textContent = "Graphics restored. Resume when ready.";
    } catch (e) {
      fatal(e);
    }
  });
  const footsteps = new FootstepTracker();
  let last = performance.now(),
    accumulator = 0,
    hudTime = 0,
    idleRenderTime = 0;
  const fixed = 1 / 60;
  // Use wall time for presentation and bounded fixed steps for deterministic gameplay.
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    if (document.hidden || contextLost) {
      accumulator = 0;
      return;
    }
    if (game.match.state === "playing") {
      quality.update(raw);
      accumulator += Math.min(raw, 0.25);
      // Catch up simulation ticks without tying movement speed to monitor refresh rate.
      while (accumulator >= fixed) {
        if (!network) game.update(fixed, settings.values.sensitivity);
        else {
          game.hit = Math.max(0, game.hit - fixed);
          game.hurt = Math.max(0, game.hurt - fixed);
        }
        accumulator -= fixed;
      }
    } else accumulator = 0;
    // Online end snapshots arrive asynchronously, outside the local tick loop.
    if (game.match.state === "ended" && $("menu").hidden && $("end").hidden) {
      input.active = false;
      input.clear();
      if (document.pointerLockElement) document.exitPointerLock();
      $("touch").hidden = $("pause").hidden = true;
      $("end").hidden = false;
      localPaused = false;
      hud.end(game);
    }
    if (network && game.match.state === "playing") network.updateView(raw);
    // Static menus do not need a full-rate GPU loop.
    idleRenderTime += raw;
    if (game.match.state === "playing" || idleRenderTime >= 0.1) {
      network?.renderActors(now);
      // Surround audio: the listener follows the camera; footsteps come from (interpolated) poses.
      if (game.match.state === "playing") {
        const p = game.player;
        audio.setListener(p.x, p.y + p.eye, p.z, p.yaw, p.pitch);
        footsteps.update(
          game.renderActors || game.actors,
          p.id,
          (kind, volume, source) => audio.play(kind, volume, 0, source),
        );
      } else footsteps.clear();
      renderer.render(game, quality, game.time);
      idleRenderTime = 0;
    }
    // Throttle DOM updates separately from the rendering frame rate.
    hudTime += raw;
    if (hudTime > 0.05) {
      hud.update(game, quality, renderer);
      if (input.touch) input.touchController.sync();
      hudTime = 0;
    }
  }
  requestAnimationFrame(frame);
  // Opt-in diagnostics for deterministic test harnesses; absent in normal URLs.
  if (new URLSearchParams(location.search).has("debug"))
    window.__arena = {
      game,
      network,
      input,
      renderer,
      quality,
      start,
      pause,
      resume,
      settings,
    };
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("./sw.js").catch(() => {}),
    );
} catch (e) {
  fatal(e);
}
