// The one Settings screen, rendered into the lobby's Settings dialog and the arena's Settings
// tab, so both pages show the same options grouped the way shooter players expect:
// Profile, Controls, Key bindings, Audio, Video. Values live in SettingsManager.
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  RESERVED,
  keyLabel,
  rebind,
} from "./bindings.js";

const range = (id, label, min, max, step) =>
  `<label class="set-range" for="${id}"><span>${label}<output id="${id}Value" for="${id}"></output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" /></label>`;
const check = (id, label) =>
  `<label class="set-check"><input id="${id}" type="checkbox" /> ${label}</label>`;
const select = (id, label, options) =>
  `<label class="set-field">${label}<select id="${id}">${options
    .map(([v, t]) => `<option value="${v}">${t}</option>`)
    .join("")}</select></label>`;

// `buttonClass` follows each page's button vocabulary (arena: secondary-button, lobby: secondary).
export function settingsPanelHTML({ buttonClass = "secondary-button" } = {}) {
  return `<div class="settings-panel">
  <section class="set-group" aria-labelledby="set-profile">
    <h3 id="set-profile">Profile</h3>
    <label class="set-field">Callsign<input id="callsign" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="You" /></label>
  </section>
  <section class="set-group" aria-labelledby="set-controls">
    <h3 id="set-controls">Controls</h3>
    ${range("sensitivity", "Mouse sensitivity", 0.4, 2, 0.1)}
    ${range("adsSensitivity", "Aim-down-sights sensitivity", 0.5, 1.5, 0.05)}
    ${range("touchSensitivity", "Touch look sensitivity", 0.4, 2, 0.1)}
    ${check("invertY", "Invert vertical look")}
    <p id="controlsHelp" class="set-note"></p>
  </section>
  <section class="set-group keys-group" aria-labelledby="set-keys">
    <h3 id="set-keys">Key bindings</h3>
    <div id="keybinds" class="keybinds"></div>
    <p id="keybindStatus" class="set-note" aria-live="polite">Select a key to change it. Esc cancels.</p>
    <p class="set-note">Mouse: left fire · right aim · wheel swap · Esc pause</p>
    <button id="resetBindings" type="button" class="${buttonClass}">Reset keys</button>
  </section>
  <section class="set-group" aria-labelledby="set-audio">
    <h3 id="set-audio">Audio</h3>
    ${check("sound", "Sound")}
    ${range("volume", "Volume", 0, 100, 5)}
  </section>
  <section class="set-group" aria-labelledby="set-video">
    <h3 id="set-video">Video</h3>
    ${range("fov", "Field of view", 65, 105, 1)}
    ${select("crosshairColor", "Crosshair", [
      ["#a7ead4", "Mint"],
      ["#ffffff", "White"],
      ["#ffbf69", "Amber"],
      ["#ff6b9d", "Pink"],
    ])}
    ${select("quality", "Graphics", [
      ["low", "Low"],
      ["medium", "Medium"],
      ["high", "High"],
    ])}
    ${check("autoQuality", "Auto resolution")}
    ${check("showStats", "Show performance stats")}
    ${check("reducedMotion", "Reduced motion")}
  </section>
</div>`;
}

// Fill the key-binding list and handle "press a key" capture. Capture listens on window in
// the capture phase so lobby shortcuts and gameplay never see the key being assigned.
export function mountKeybinds(root, settings) {
  const list = root.getElementById("keybinds"),
    status = root.getElementById("keybindStatus");
  if (!list) return;
  let waiting = null;
  const render = () => {
    const b = settings.values.bindings;
    list.replaceChildren(
      ...ACTIONS.map((a) => {
        const row = document.createElement("div");
        row.className = "keybind";
        const name = document.createElement("span");
        name.textContent = a.label;
        const key = document.createElement("button");
        key.type = "button";
        key.className = "keycap";
        key.dataset.action = a.id;
        key.textContent = keyLabel(b[a.id]);
        key.setAttribute(
          "aria-label",
          `${a.label}: ${keyLabel(b[a.id])}. Change key`,
        );
        key.addEventListener("click", () => start(a, key));
        row.append(name, key);
        return row;
      }),
    );
  };
  const stop = (message) => {
    window.removeEventListener("keydown", onKey, true);
    waiting = null;
    render();
    if (message) status.textContent = message;
  };
  const onKey = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const { action } = waiting;
    if (e.code === "Escape") return stop("Unchanged.");
    if (RESERVED.has(e.code) || !e.code)
      return void (status.textContent = `${keyLabel(e.code)} is reserved. Choose another key.`);
    const before = settings.values.bindings;
    const swapped = ACTIONS.find(
      (a) => before[a.id] === e.code && a.id !== action.id,
    );
    settings.set("bindings", rebind(before, action.id, e.code));
    stop(
      swapped
        ? `${action.label}: ${keyLabel(e.code)}. ${swapped.label} moved to ${keyLabel(before[action.id])}.`
        : `${action.label}: ${keyLabel(e.code)}.`,
    );
  };
  const start = (action, button) => {
    if (waiting) stop();
    waiting = { action };
    button.textContent = "Press a key";
    button.setAttribute("aria-pressed", "true");
    status.textContent = `Press a key for ${action.label}. Esc cancels.`;
    window.addEventListener("keydown", onKey, true);
    button.addEventListener("blur", () => waiting && stop("Unchanged."), {
      once: true,
    });
  };
  root.getElementById("resetBindings")?.addEventListener("click", () => {
    settings.set("bindings", { ...DEFAULT_BINDINGS });
    render();
    status.textContent = "Keys reset to defaults.";
  });
  settings.onChange((k) => k === "bindings" && !waiting && render());
  render();
}
