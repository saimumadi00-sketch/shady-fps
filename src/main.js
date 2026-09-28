// Application entry point: connects DOM menus, input, simulation, rendering, and offline installation.
import { InputManager } from "./input.js";
import { SettingsManager, QualityManager, AudioManager } from "./settings.js";
import { OfflineSimulation } from "./game.js";
import { Renderer } from "./renderer.js";
import { HUDController } from "./hud.js";
import { Customization } from "./customization.js";
import { CLASS_IDS, LOADOUTS, loadout, classForWeapon } from "./loadouts.js";
import { WEAPONS } from "./weapons.js";
const $ = (id) => document.getElementById(id);
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
  game.match.state = "paused";
  input.active = false;
  input.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $("pauseReason").textContent =
    typeof reason === "string" ? reason : "Combat is paused.";
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
  game = new OfflineSimulation(input, audio);
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
      if (id === "pauseWeapon") game.weapons.equip(game.player, selectedWeapon);
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
    game.match.state = "playing";
    input.clear();
    input.active = true;
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
    customization.apply(game);
    game.start(settings.values.difficulty, selectedWeapon, selectedClass);
    quality.configure();
    resume();
  }
  // Return to setup and refresh the preview after in-match weapon changes.
  function menu() {
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
        game.update(fixed, settings.values.sensitivity);
        accumulator -= fixed;
      }
      // Release controls once and populate results when a simulation tick finishes the match.
      if (game.match.state === "ended") {
        input.active = false;
        input.clear();
        if (document.pointerLockElement) document.exitPointerLock();
        $("touch").hidden = true;
        $("pause").hidden = true;
        $("end").hidden = false;
        hud.end(game);
      }
    } else accumulator = 0;
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
