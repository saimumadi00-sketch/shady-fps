// Rebindable keyboard actions. Gameplay code keeps reading the default key codes (KeyW,
// Space, ...); InputManager translates whatever physical key the player bound into that
// canonical code, so movement, weapons and the multiplayer server need no changes.
export const ACTIONS = [
  { id: "forward", label: "Move forward", code: "KeyW" },
  { id: "back", label: "Move back", code: "KeyS" },
  { id: "left", label: "Move left", code: "KeyA" },
  { id: "right", label: "Move right", code: "KeyD" },
  { id: "jump", label: "Jump / cancel slide", code: "Space" },
  { id: "sprint", label: "Sprint", code: "ShiftLeft", alt: ["ShiftRight"] },
  {
    id: "crouch",
    label: "Crouch / slide",
    code: "KeyC",
    alt: ["ControlLeft", "ControlRight"],
  },
  { id: "reload", label: "Reload", code: "KeyR" },
  { id: "swap", label: "Swap weapon", code: "KeyQ" },
  { id: "primary", label: "Primary weapon", code: "Digit1" },
  { id: "sidearm", label: "Pistol", code: "Digit2" },
];
export const DEFAULT_BINDINGS = Object.freeze(
  Object.fromEntries(ACTIONS.map((a) => [a.id, a.code])),
);
// Keys the game or the browser owns: Escape pauses and cancels a rebind, Tab moves focus.
export const RESERVED = new Set([
  "Escape",
  "Tab",
  "MetaLeft",
  "MetaRight",
  "ContextMenu",
]);
// Accept a saved map only when every action has a distinct, bindable key code.
export function normalizeBindings(saved) {
  const out = { ...DEFAULT_BINDINGS };
  if (!saved || typeof saved !== "object") return out;
  for (const a of ACTIONS) {
    const code = saved[a.id];
    if (
      typeof code === "string" &&
      /^[A-Za-z0-9]+$/.test(code) &&
      !RESERVED.has(code)
    )
      out[a.id] = code;
  }
  const codes = Object.values(out);
  return new Set(codes).size === codes.length ? out : { ...DEFAULT_BINDINGS };
}
// Bind `code` to `action`; if another action already uses it, the two swap keys.
export function rebind(bindings, action, code) {
  const next = { ...bindings };
  const other = ACTIONS.find((a) => next[a.id] === code && a.id !== action);
  if (other) next[other.id] = next[action];
  next[action] = code;
  return next;
}
// Physical key -> canonical code. Defaults' alternates (right Shift, Ctrl) stay active only
// while their action keeps its default key and no other action has claimed them.
export function bindingMap(bindings) {
  const map = new Map(),
    reserved = new Set(),
    used = new Set(Object.values(bindings));
  for (const a of ACTIONS) {
    reserved.add(a.code);
    for (const alt of a.alt || []) reserved.add(alt);
  }
  for (const a of ACTIONS) {
    map.set(bindings[a.id], a.code);
    if (bindings[a.id] === a.code)
      for (const alt of a.alt || []) if (!used.has(alt)) map.set(alt, alt);
  }
  return { map, reserved };
}
// Short, readable key names for buttons and hints.
export function keyLabel(code) {
  if (!code) return "—";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return "Num " + code.slice(6);
  const names = {
    Space: "Space",
    ShiftLeft: "Shift",
    ShiftRight: "Right Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Right Ctrl",
    AltLeft: "Alt",
    AltRight: "Right Alt",
    CapsLock: "Caps Lock",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Enter: "Enter",
    Backspace: "Backspace",
  };
  return names[code] || code;
}
// "C or Ctrl" style label including any alternates still active for an action.
export function actionKeys(bindings, id) {
  const a = ACTIONS.find((x) => x.id === id);
  const main = keyLabel(bindings[id]);
  if (a?.alt && bindings[id] === a.code) {
    const used = new Set(Object.values(bindings));
    const free = a.alt.find((k) => !used.has(k));
    const alt = free && keyLabel(free).replace(/^Right /, "");
    if (alt && alt !== main) return `${main} or ${alt}`;
  }
  return main;
}
