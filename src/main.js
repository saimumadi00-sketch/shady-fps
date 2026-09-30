// Application entry point: connects DOM menus, input, simulation, rendering, and offline installation.
import { NetworkClient } from "./network.js";
import { InputManager } from "./input.js";
import { SettingsManager, QualityManager, AudioManager } from "./settings.js";
import { OfflineSimulation } from "./game.js";
import { Renderer } from "./renderer.js";
import { HUDController } from "./hud.js";
import { Customization } from "./customization.js";
import { CLASS_IDS, LOADOUTS, loadout, classForWeapon } from "./loadouts.js";
import { WEAPONS } from "./weapons.js";
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
    `${w.description} ${w.magazine} rounds · ${w.damage} damage · ${w.reload}s reload`;
}
// Switch control hints and touch overlays without restarting the match.
function controls() {
  document.body.classList.toggle("touch-mode", input.touch);
  $("touch").hidden = !input.touch || !input.active;
  $("hint").textContent =
    input.mouseFallback && !input.touch
      ? "MOUSE CAPTURE UNAVAILABLE: HOLD RIGHT MOUSE + DRAG TO AIM"
      : "MOUSE AIM · SHIFT + C SLIDE · SPACE CANCEL";
  if (!input.touch)
    $("controlsHelp").textContent =
      "Mouse aim · Right mouse ADS · WASD move · Shift sprint · C / Ctrl slide while sprinting · Space jump / slide cancel · R reload · class primary key / 3 pistol · Esc pause";
  if (input.touch)
    $("controlsHelp").textContent =
      "Left stick move / push fully to sprint · Right drag aim · FIRE shoot · ADS aim · RLD reload · JUMP · SLIDE crouch / slide while sprinting · JUMP cancel · SWAP weapon";
  orientation();
}
// Pause touch gameplay in portrait so hidden controls cannot leave the player vulnerable.
function orientation() {
  const portrait = input.touch && innerHeight > innerWidth;
  $("rotate").hidden = !portrait;
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
  });
  $("matchMode").value = game.mode;
  $("matchMode").addEventListener("change", () => {
    params.set("mode", $("matchMode").value);
    location.search = params.toString();
  });
  if (game.mode === "conquest") {
    document.title = "Crosscurrent — Conquest / FreeDM Outpost";
    $("mapName").textContent = $("briefMapName").textContent =
      game.arena.name.toUpperCase();
    $("modeLabel").textContent = $("briefMode").textContent = "CONQUEST · 5v5";
    $("briefDescription").textContent =
      "Capture A, B and C. Hold more sectors to drain enemy tickets. Every death costs a ticket; the team with tickets remaining wins.";
    $("tagline").textContent = "Three sectors. Two teams. Control the outpost.";
    $("ruleTargetLabel").textContent = "TEAM TICKETS";
    $("target").disabled = true;
    $("target").hidden = true;
    $("scoreLimitLabel").textContent = "TICKETS: 150 PER TEAM";
    const { rows, cellSize } = game.arena.map;
    const svg = $("mapOverview");
    svg.setAttribute("viewBox", `0 0 ${rows[0].length} ${rows.length}`);
    svg.setAttribute(
      "aria-label",
      "FreeDM Outpost layout with three Conquest sectors",
    );
    svg.innerHTML =
      rows
        .map((row, z) =>
          [...row]
            .map((cell, x) =>
              cell === "."
                ? `<rect x="${x}" y="${z}" width="1" height="1" fill="#387576" stroke="none"/>`
                : "",
            )
            .join(""),
        )
        .join("") +
      game.arena.sectors
        .map((s) => {
          const x = s.x / cellSize + (rows[0].length - 1) / 2 + 0.5;
          const z = s.z / cellSize + (rows.length - 1) / 2 + 0.5;
          return `<circle cx="${x}" cy="${z}" r="2" fill="#efbd63"/><text x="${x}" y="${z + 1}" text-anchor="middle" fill="#122a30" stroke="none" font-size="3" font-weight="bold">${s.id}</text>`;
        })
        .join("");
    $("mapCredit").textContent = "MAP: FREEDOOM / BSD-3-CLAUSE";
    $("objectives").hidden = false;
  }
  renderer = new Renderer($("canvas"), game.arena);
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
    const saved = localStorage.getItem("crosscurrent-class");
    if (CLASS_IDS.includes(saved)) selectedClass = saved;
  } catch {}
  for (const id of CLASS_IDS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = LOADOUTS[id].name;
    $("loadoutClass").append(option);
  }
  $("loadoutClass").value = selectedClass;
  // Rebuild both weapon selectors from the class definition; never expose other class guns.
  function refreshLoadout() {
    const kit = loadout(selectedClass);
    if (!kit.weapons.includes(selectedWeapon)) selectedWeapon = kit.primary;
    $("classInfo").textContent =
      `${kit.description} Primary: ${WEAPONS[kit.primary].short} / Sidearm: PISTOL. Change class here before your next match.`;
    for (const id of ["startingWeapon", "pauseWeapon"]) {
      $(id).replaceChildren();
      kit.weapons.forEach((index) => {
        const w = WEAPONS[index];
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${index + 1}. ${w.name}`;
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
        if (network) input.actions.add("Digit" + (selectedWeapon + 1));
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
      input.actions.add("Digit" + (selectedWeapon + 1));
    $("pause").hidden = true;
    $("menu").hidden = true;
    $("end").hidden = true;
    $("hud").hidden = false;
    audio.unlock();
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
  }
  $("play").disabled = false;
  $("play").textContent = "PLAY MATCH ↗";
  $("status").textContent = "READY · 1 PLAYER + 9 BOTS · ZERO NETWORK REQUIRED";
  $("play").onclick = start;
  $("resume").onclick = resume;
  $("restart").onclick = start;
  $("back").onclick = menu;
  $("endMenu").onclick = menu;
  $("pauseButton").onclick = () => pause();
  if (params.has("online")) {
    $("roomPanel").hidden = false;
    $("arenaEdition").textContent = "PRIVATE MULTIPLAYER / BROWSER EDITION";
    customization.values.duration = 420;
    customization.values.target = 30;
    customization.refresh();
    $("duration").value = "420";
    $("target").value = "30";
    $("roomCode").value = params.get("room") || "";
    $("roomTeam").value = params.get("team") === "1" ? "1" : "0";
    $("play").disabled = true;
    $("play").textContent = "WAITING FOR ROOM";
    $("status").textContent = "PRIVATE MULTIPLAYER · UP TO 10 PLAYERS";
    $("tagline").textContent = "Invite friends. Choose a team. Fight together.";
    $("scoreTarget").textContent =
      game.mode === "conquest" ? "TICKETS · HOLD SECTORS" : "FIRST TO 30";
    $("duration").disabled =
      $("target").disabled =
      $("difficulty").disabled =
        true;
    network = new NetworkClient(game, input, {
      sensitivity: () => settings.values.sensitivity,
      onState(packet) {
        $("matchMode").disabled = true;
        $("roomCode").value = packet.code;
        $("roomMessage").textContent =
          `ROOM ${packet.code} · ${packet.host ? "YOU ARE HOST" : "HOST CONTROLS START"} · ${packet.match.state === "menu" ? "WAITING" : packet.match.state.toUpperCase()}`;
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
            ? "RESTART SHARED MATCH"
            : "START SHARED MATCH";
        $("play").disabled = packet.match.state !== "playing";
        $("play").textContent = "ENTER SHARED MATCH ↗";
        $("restart").disabled = !packet.host;
        $("restart").textContent = packet.host
          ? "RESTART SHARED MATCH ↗"
          : "WAITING FOR HOST";
        game.networkLabel = `ROOM ${packet.code} · ${network.ping}ms`;
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
    $("back").textContent = $("endMenu").textContent = "LEAVE ROOM";
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
    // Static menus do not need a full-rate GPU loop.
    idleRenderTime += raw;
    if (game.match.state === "playing" || idleRenderTime >= 0.1) {
      renderer.render(game, quality, game.time);
      idleRenderTime = 0;
    }
    // Throttle DOM updates separately from the rendering frame rate.
    hudTime += raw;
    if (hudTime > 0.05) {
      hud.update(game, quality, renderer);
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
