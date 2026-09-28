import { InputManager } from "./input.js";
import { SettingsManager, QualityManager, AudioManager } from "./settings.js";
import { OfflineSimulation } from "./game.js";
import { Renderer } from "./renderer.js";
import { HUDController } from "./hud.js";
import { Customization } from "./customization.js";
import { WEAPONS } from "./weapons.js";
const $ = (id) => document.getElementById(id);
let game,
  renderer,
  input,
  contextLost = false,
  rotationPaused = false;
function fatal(error) {
  console.error(error);
  $("fatalText").textContent = error.message || String(error);
  $("fatal").hidden = false;
}
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
function weaponInfo(selectId, infoId) {
  const w = WEAPONS[Number($(selectId).value)];
  $(infoId).textContent =
    `${w.description} ${w.magazine} rounds · ${w.damage} damage · ${w.reload}s reload`;
}
function controls() {
  document.body.classList.toggle("touch-mode", input.touch);
  $("touch").hidden = !input.touch || !input.active;
  $("hint").textContent =
    input.mouseFallback && !input.touch
      ? "MOUSE CAPTURE UNAVAILABLE: HOLD RIGHT MOUSE + DRAG TO AIM"
      : "MOUSE AIM · SHIFT + C SLIDE · SPACE CANCEL";
  if (!input.touch)
    $("controlsHelp").textContent =
      "Mouse aim · Right mouse ADS · WASD move · Shift sprint · C / Ctrl slide while sprinting · Space jump / slide cancel · R reload · 1–5 weapons · Esc pause";
  if (input.touch)
    $("controlsHelp").textContent =
      "Left stick move / push fully to sprint · Right drag aim · FIRE shoot · ADS aim · RLD reload · JUMP · SLIDE crouch / slide while sprinting · JUMP cancel · SWAP weapon";
  orientation();
}
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
  let selectedWeapon = 0;
  try {
    const saved = Number(localStorage.getItem("crosscurrent-weapon"));
    if (Number.isInteger(saved) && WEAPONS[saved]) selectedWeapon = saved;
  } catch {}
  for (const id of ["startingWeapon", "pauseWeapon"]) {
    WEAPONS.forEach((w, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${w.name}`;
      $(id).append(option);
    });
    $(id).value = String(selectedWeapon);
    const infoId =
      id === "startingWeapon" ? "startingWeaponInfo" : "pauseWeaponInfo";
    weaponInfo(id, infoId);
    $(id).addEventListener("change", () => {
      selectedWeapon = Number($(id).value);
      $("startingWeapon").value = String(selectedWeapon);
      weaponInfo("startingWeapon", "startingWeaponInfo");
      weaponInfo(id, infoId);
      if (id === "pauseWeapon") game.weapons.equip(game.player, selectedWeapon);
      try {
        localStorage.setItem("crosscurrent-weapon", String(selectedWeapon));
      } catch {}
    });
  }
  const customization = new Customization();
  renderer.customization = customization.values;
  $("progress").textContent = "100%";
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
  function start() {
    customization.apply(game);
    game.start(settings.values.difficulty, selectedWeapon);
    quality.configure();
    resume();
  }
  function menu() {
    game.match.state = "menu";
    input.active = false;
    input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    for (const id of ["pause", "end", "hud", "touch", "death"])
      $(id).hidden = true;
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
      while (accumulator >= fixed) {
        game.update(fixed, settings.values.sensitivity);
        accumulator -= fixed;
      }
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
