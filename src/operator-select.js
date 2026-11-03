// Operator select for the setup screen: roster cards with portraits, the selected operator
// turning on the stage, weapon ratings and the Loadout / Mission / Settings tabs. It drives
// the existing #loadoutClass and #startingWeapon selects, so the game logic is unchanged.
import { drawOperator } from "./operator-render.js";
import { OPERATORS, OPERATOR_ORDER, weaponRatings, primaryOf } from "./operators.js";
import { LOADOUTS } from "./loadouts.js";

const $ = (id) => document.getElementById(id);

export function initOperatorSelect() {
  const select = $("loadoutClass"),
    list = $("operatorList"),
    stage = $("operatorStage");
  if (!select || !list || !stage) return { showTab() {} };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Roster cards
  const cards = new Map();
  for (const id of OPERATOR_ORDER) {
    const op = OPERATORS[id],
      card = document.createElement("button");
    card.type = "button";
    card.className = "op-card";
    card.setAttribute("role", "radio");
    card.dataset.class = id;
    const portrait = document.createElement("canvas");
    portrait.width = 160;
    portrait.height = 160;
    portrait.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "op-card-text";
    const name = document.createElement("strong");
    name.textContent = op.codename;
    const role = document.createElement("span");
    role.textContent = LOADOUTS[id].name;
    const gun = document.createElement("small");
    gun.textContent = primaryOf(id).label;
    text.append(name, role, gun);
    const key = document.createElement("kbd");
    key.textContent = op.key;
    key.setAttribute("aria-hidden", "true");
    card.append(portrait, text, key);
    card.setAttribute(
      "aria-label",
      `${op.codename}, ${LOADOUTS[id].name}, ${primaryOf(id).label}`,
    );
    card.addEventListener("click", () => choose(id));
    list.append(card);
    cards.set(id, card);
    drawOperator(portrait, id, { view: "portrait", yaw: -0.35 });
  }
  function choose(id, focus = false) {
    if (select.disabled || select.value === id) return;
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (focus) cards.get(id).focus();
  }
  // Arrow keys move through the roster like any radio group.
  list.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = OPERATOR_ORDER.indexOf(select.value);
    choose(OPERATOR_ORDER[(i + step + OPERATOR_ORDER.length) % OPERATOR_ORDER.length], true);
  });
  // Number keys 1-4 pick an operator while the setup screen is showing.
  document.addEventListener("keydown", (e) => {
    if ($("menu").hidden || e.target.closest?.("input, select, textarea")) return;
    const id = OPERATOR_ORDER.find((k) => OPERATORS[k].key === e.key);
    if (id) choose(id, true);
  });

  // ---- Stage: the selected operator turns slowly; drag or arrow keys turn it by hand.
  let yaw = -0.35,
    spin = reduced ? 0 : 0.25,
    drag = null,
    last = performance.now(),
    raf = 0;
  const paint = () => drawOperator(stage, select.value, { yaw, view: "full" });
  function frame(now) {
    raf = 0;
    if ($("menu").hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drag) yaw += spin * dt;
    paint();
    if (spin) raf = requestAnimationFrame(frame);
  }
  const run = () => {
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  };
  stage.addEventListener("pointerdown", (e) => {
    drag = e.clientX;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    yaw -= (e.clientX - drag) * 0.012;
    drag = e.clientX;
    paint();
  });
  const release = () => (drag = null);
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (e) => {
    const turn = { ArrowLeft: 0.2, ArrowRight: -0.2 }[e.key];
    if (!turn) return;
    e.preventDefault();
    yaw += turn;
    paint();
  });
  // Resume the turntable whenever the setup screen comes back.
  new MutationObserver(() => !$("menu").hidden && run()).observe($("menu"), {
    attributes: true,
    attributeFilter: ["hidden"],
  });

  // ---- Dossier and weapon ratings follow the class and weapon selects.
  function renderRatings() {
    const index = Number($("startingWeapon").value);
    const dl = $("weaponRatings");
    dl.replaceChildren();
    if (!Number.isInteger(index)) return;
    for (const { label, value } of weaponRatings(index)) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd"),
        bar = document.createElement("i");
      dt.textContent = label;
      bar.style.setProperty("--v", value.toFixed(3));
      dd.append(bar);
      dd.setAttribute("aria-label", `${label} ${Math.round(value * 100)} of 100`);
      dl.append(dt, dd);
    }
  }
  function sync() {
    const id = select.value,
      op = OPERATORS[id];
    for (const [k, card] of cards) {
      const on = k === id;
      card.setAttribute("aria-checked", String(on));
      card.tabIndex = on ? 0 : -1;
      card.disabled = select.disabled && !on;
    }
    $("operatorName").textContent = op.codename;
    $("operatorRole").textContent = op.role;
    stage.dataset.class = id;
    renderRatings();
    paint();
  }
  select.addEventListener("change", sync);
  $("startingWeapon").addEventListener("change", renderRatings);
  // The online room can lock the class select; reflect that on the cards.
  new MutationObserver(sync).observe(select, {
    attributes: true,
    attributeFilter: ["disabled"],
  });
  sync();
  run();

  // ---- Tabs
  const tabs = ["loadout", "mission", "settings"];
  function showTab(name, focus = false) {
    for (const t of tabs) {
      const tab = $("tab-" + t),
        on = t === name;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      $("panel-" + t).hidden = !on;
      if (on && focus) tab.focus();
    }
  }
  for (const t of tabs) $("tab-" + t).addEventListener("click", () => showTab(t));
  document.querySelector(".ops-tabs").addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => $("tab-" + t).getAttribute("aria-selected") === "true");
    showTab(tabs[(i + step + tabs.length) % tabs.length], true);
  });
  return { showTab, refresh: sync };
}
