// The specimen plate: the selected operator at full height holding their class weapon, the
// squad dimmed behind, file tabs for the roster, and call-outs joined to the kit by leader
// lines. Mission and Settings open in a drawer over the plate. It drives the existing
// #loadoutClass and #startingWeapon selects, so the game logic is unchanged.
import { drawOperator } from "./operator-render.js";
import { OPERATORS, OPERATOR_ORDER, weaponRatings } from "./operators.js";
import { LOADOUTS } from "./loadouts.js";
import { WEAPONS } from "./weapons.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";

export function initOperatorSelect() {
  const select = $("loadoutClass"),
    list = $("operatorList"),
    stage = $("operatorStage");
  if (!select || !list || !stage) return { showTab() {}, refresh() {} };

  // ---- Roster: file tabs
  const tabs = new Map();
  for (const id of OPERATOR_ORDER) {
    const op = OPERATORS[id],
      tab = document.createElement("button");
    tab.type = "button";
    tab.className = "op-card";
    tab.setAttribute("role", "radio");
    tab.dataset.class = id;
    const name = document.createElement("strong");
    name.textContent = op.codename;
    const role = document.createElement("span");
    role.textContent = LOADOUTS[id].name;
    const gun = document.createElement("small");
    gun.textContent = WEAPONS[LOADOUTS[id].primary].label;
    const key = document.createElement("kbd");
    key.textContent = op.key;
    key.setAttribute("aria-hidden", "true");
    tab.append(name, role, gun, key);
    tab.setAttribute(
      "aria-label",
      `${op.codename}, ${LOADOUTS[id].name}, ${WEAPONS[LOADOUTS[id].primary].label}`,
    );
    tab.addEventListener("click", () => choose(id));
    list.append(tab);
    tabs.set(id, tab);
  }
  function choose(id, focus = false) {
    if (select.disabled || select.value === id) return;
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (focus) tabs.get(id).focus();
  }
  list.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[
      e.key
    ];
    if (!step) return;
    e.preventDefault();
    const i = OPERATOR_ORDER.indexOf(select.value);
    choose(
      OPERATOR_ORDER[
        (i + step + OPERATOR_ORDER.length) % OPERATOR_ORDER.length
      ],
      true,
    );
  });
  // Number keys 1-4 pick an operator while the setup screen is showing.
  document.addEventListener("keydown", (e) => {
    if (
      $("menu").hidden ||
      e.target.closest?.("input, select, textarea, dialog")
    )
      return;
    if (!$("opsDrawer").hidden) return;
    const id = OPERATOR_ORDER.find((k) => OPERATORS[k].key === e.key);
    if (id) choose(id, true);
  });

  // ---- Plate: drawn on demand at the canvas's display size; drag or arrow keys turn it.
  let yaw = -0.4,
    drag = null,
    queued = 0;
  const plate = stage.parentElement,
    leaders = $("leaders"),
    callouts = [...document.querySelectorAll(".callout[data-anchor]")];
  function size() {
    const r = stage.getBoundingClientRect(),
      dpr = Math.min(2, window.devicePixelRatio || 1),
      w = Math.max(1, Math.round(r.width * dpr)),
      h = Math.max(1, Math.round(r.height * dpr));
    if (stage.width !== w || stage.height !== h) {
      stage.width = w;
      stage.height = h;
    }
    return { r, dpr };
  }
  // Where the operator stands across the plate: left of the call-outs, or centred when the
  // call-outs stack below on narrow screens.
  const frameX = () => {
    const c = $("panel-loadout").getBoundingClientRect(),
      r = stage.getBoundingClientRect();
    if (!r.width) return 0.4;
    const side = c.left > r.left + r.width * 0.45 && c.top < r.bottom - 40;
    return side
      ? Math.min(0.42, Math.max(0.24, (c.left - r.left) / r.width - 0.17))
      : 0.5;
  };
  function paint() {
    queued = 0;
    if ($("menu").hidden) return;
    const { r, dpr } = size();
    const id = select.value,
      { anchors } = drawOperator(stage, id, {
        yaw,
        weapon: Number($("startingWeapon").value) || LOADOUTS[id].primary,
        finish: $("finish").value,
        optic: $("optic").value,
        frameX: frameX(),
        squad: OPERATOR_ORDER.filter((k) => k !== id),
      });
    drawLeaders(anchors, r, dpr);
  }
  const repaint = () => {
    if (!queued) queued = requestAnimationFrame(paint);
  };
  // Leader lines, field-manual style: from a square terminal on the kit straight out to a
  // spine beside the call-out column, along it, and into the call-out. Spines step apart so
  // no two lines share a run. When the call-outs stack under the figure (narrow screens) each
  // line runs left from its terminal to a gutter at the plate edge, down, and into its
  // call-out from the left.
  function drawLeaders(anchors, r, dpr) {
    const p = plate.getBoundingClientRect();
    leaders.setAttribute("viewBox", `0 0 ${p.width} ${p.height}`);
    leaders.replaceChildren();
    if (!$("opsDrawer").hidden) return;
    const beside = [],
      below = [];
    for (const el of callouts) {
      const a = anchors[el.dataset.anchor];
      const box = el.getBoundingClientRect();
      if (!a || !box.width) continue;
      const ax = a[0] / dpr + r.left - p.left,
        ay = a[1] / dpr + r.top - p.top,
        bx = box.left - p.left,
        by = box.top - p.top + Math.min(20, box.height / 2);
      // Never to a call-out scrolled out of its column.
      if (by < 0 || by > p.height) continue;
      // Stacked under the figure (narrow screens): the call-out starts at the plate's edge.
      const stacked = bx < 60 && box.top - p.top > ay + 24;
      if (stacked) below.push({ ax, ay, bx, by });
      else if (bx >= ax + 16) beside.push({ ax, ay, bx, by });
    }
    const draw = (points, ax, ay) => {
      const line = document.createElementNS(SVG, "polyline");
      line.setAttribute("points", points.map((q) => q.join(",")).join(" "));
      const dot = document.createElementNS(SVG, "rect");
      dot.setAttribute("x", ax - 3.5);
      dot.setAttribute("y", ay - 3.5);
      dot.setAttribute("width", 7);
      dot.setAttribute("height", 7);
      leaders.append(line, dot);
    };
    // Lines that travel furthest vertically take the outermost spines.
    beside
      .sort((u, v) => Math.abs(u.by - u.ay) - Math.abs(v.by - v.ay))
      .forEach(({ ax, ay, bx, by }, i) => {
        const spine = Math.max(ax + 16, bx - 14 - i * 7);
        draw(
          [
            [ax, ay],
            [spine, ay],
            [spine, by],
            [bx, by],
          ],
          ax,
          ay,
        );
      });
    // Below: the lowest call-out takes the outermost gutter, so the runs nest.
    below.sort((u, v) => u.by - v.by);
    below.forEach(({ ax, ay, bx, by }, k) => {
      const step = Math.min(4, Math.max(2, (bx - 4) / below.length)),
        gutter = 2 + (below.length - 1 - k) * step;
      draw(
        [
          [ax, ay],
          [gutter, ay],
          [gutter, by],
          [bx, by],
        ],
        ax,
        ay,
      );
    });
  }
  stage.addEventListener("pointerdown", (e) => {
    drag = e.clientX;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    yaw -= (e.clientX - drag) * 0.012;
    drag = e.clientX;
    repaint();
  });
  const release = () => (drag = null);
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (e) => {
    const turn = { ArrowLeft: 0.2, ArrowRight: -0.2 }[e.key];
    if (!turn) return;
    e.preventDefault();
    yaw += turn;
    repaint();
  });
  new ResizeObserver(repaint).observe(plate);
  $("panel-loadout").addEventListener("scroll", repaint, { passive: true });
  new MutationObserver(() => !$("menu").hidden && repaint()).observe(
    $("menu"),
    {
      attributes: true,
      attributeFilter: ["hidden"],
    },
  );
  for (const id of ["startingWeapon", "finish", "optic"])
    $(id).addEventListener("change", () => {
      renderKit();
      repaint();
    });

  // ---- Kit read-outs follow the class and weapon selects.
  function renderKit() {
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
      dd.setAttribute(
        "aria-label",
        `${label} ${Math.round(value * 100)} of 100`,
      );
      dl.append(dt, dd);
    }
    const pistol = WEAPONS[2];
    $("sidearmInfo").textContent =
      `${pistol.label} · ${pistol.magazine} rounds`;
  }
  function sync() {
    const id = select.value,
      op = OPERATORS[id];
    for (const [k, tab] of tabs) {
      const on = k === id;
      tab.setAttribute("aria-checked", String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.disabled = select.disabled && !on;
    }
    $("operatorName").textContent = op.codename;
    $("operatorRole").textContent = op.role;
    stage.dataset.class = id;
    renderKit();
    repaint();
  }
  select.addEventListener("change", sync);
  new MutationObserver(sync).observe(select, {
    attributes: true,
    attributeFilter: ["disabled"],
  });
  sync();

  // ---- Operator / Mission / Settings: the plate is the operator view; the other two open
  // in the drawer over it.
  const names = ["loadout", "mission", "settings"];
  function showTab(name, focus = false) {
    for (const t of names) {
      const tab = $("tab-" + t),
        on = t === name;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (t !== "loadout") $("panel-" + t).hidden = !on;
      if (on && focus) tab.focus();
    }
    $("opsDrawer").hidden = name === "loadout";
    repaint();
  }
  for (const t of names)
    $("tab-" + t).addEventListener("click", () => showTab(t));
  $("closeDrawer").addEventListener("click", () => showTab("loadout", true));
  document.querySelector(".ops-tabs").addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = names.findIndex(
      (t) => $("tab-" + t).getAttribute("aria-selected") === "true",
    );
    showTab(names[(i + step + names.length) % names.length], true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("menu").hidden && !$("opsDrawer").hidden) {
      showTab("loadout", true);
    }
  });
  return { showTab, refresh: sync };
}
