// Normalizes keyboard, captured mouse, fallback dragging, and multi-pointer touch into one input state.
import { clamp } from "./math.js";
import { DEFAULT_BINDINGS, bindingMap } from "./bindings.js";
export class InputManager {
  // Install browser listeners once; active gates prevent menu interactions from firing the weapon.
  constructor(canvas, onPause, onTouch) {
    this.canvas = canvas;
    this.onPause = onPause;
    this.keys = new Set();
    this.actions = new Set();
    this.dx = 0;
    this.dy = 0;
    this.fire = false;
    // Counts fire presses so per-frame consumers can detect semi-auto edges.
    this.firePresses = 0;
    this.aim = false;
    this.active = false;
    this.mouseFallback = false;
    this.mouseDrag = false;
    this.lastMouse = null;
    this.touch = matchMedia("(pointer: coarse)").matches;
    this.moveX = 0;
    this.moveY = 0;
    this.touchCrouch = false;
    this.onTouch = onTouch;
    // Player key bindings; set from Settings. Rebound keys arrive as the default codes.
    this.invertY = false;
    this.setBindings(DEFAULT_BINDINGS);
    // Keep held keys separate from one-shot actions so jumps and semi-auto shots use press edges.
    window.addEventListener("keydown", (e) => {
      if (!this.active) return;
      const code = this.translate(e.code);
      if (
        ["Space", "ControlLeft", "ControlRight", "Tab"].includes(e.code) ||
        (code && code !== e.code)
      )
        e.preventDefault();
      if (e.code === "Escape") onPause();
      if (!code) return;
      if (!this.keys.has(code)) {
        this.actions.add(code);
        // The swap key toggles between the primary and sidearm like the touch SWAP button.
        if (code === "KeyQ") this.actions.add("switch");
      }
      this.keys.add(code);
    });
    window.addEventListener("keyup", (e) => {
      const code = this.translate(e.code);
      if (code) this.keys.delete(code);
    });
    // Captured aim uses relative deltas; fallback drag uses client-coordinate differences.
    document.addEventListener("mousemove", (e) => {
      if (this.active && document.pointerLockElement === canvas) {
        this.dx += e.movementX;
        this.dy += this.invertY ? -e.movementY : e.movementY;
      } else if (this.active && this.mouseFallback && this.mouseDrag) {
        if (this.lastMouse) {
          this.dx += e.clientX - this.lastMouse.x;
          this.dy += (this.invertY ? -1 : 1) * (e.clientY - this.lastMouse.y);
        }
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    // Only gameplay mouse presses can set fire or ADS; fallback presses must start on the canvas.
    document.addEventListener("mousedown", (e) => {
      if (
        this.active &&
        (document.pointerLockElement === canvas ||
          (this.mouseFallback && e.target === canvas))
      ) {
        this.mouseDrag = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        if (e.button === 0) {
          this.fire = true;
          this.firePresses++;
          this.actions.add("fire");
        }
        if (e.button === 2) this.aim = true;
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.aim = false;
      if (!this.fire && !this.aim) {
        this.mouseDrag = false;
        this.lastMouse = null;
      }
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    // Either wheel direction toggles weapons; throttle so one flick is one swap.
    let lastWheel = 0;
    document.addEventListener(
      "wheel",
      (e) => {
        if (
          !this.active ||
          (document.pointerLockElement !== canvas && e.target !== canvas)
        )
          return;
        e.preventDefault();
        if (e.timeStamp - lastWheel > 180 && Math.abs(e.deltaY) > 0)
          this.actions.add("switch");
        lastWheel = e.timeStamp;
      },
      { passive: false },
    );
    // Restore normal aim after capture succeeds; pause when desktop capture is lost.
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        this.mouseFallback = false;
        onTouch();
      }
      if (!document.pointerLockElement && this.active && !this.touch) onPause();
    });
    document.addEventListener("pointerlockerror", () =>
      this.enableMouseFallback(),
    );
    // Clear sticky keys and buttons when focus leaves the game.
    window.addEventListener("blur", () => {
      this.clear();
      onPause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clear();
        onPause();
      }
    });
    // Detect real device changes during capture phase, before touch elements handle the press.
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "mouse" && this.touch) {
          this.clear();
          this.touch = false;
          onTouch();
          if (this.active) this.lock();
        }
        if (e.pointerType === "touch" && !this.touch) {
          this.touch = true;
          onTouch();
        }
      },
      { passive: true, capture: true },
    );
    this.touchController = new TouchInputController(this);
  }
  // Install a binding map (see bindings.js); held keys are dropped so none stay stuck.
  setBindings(bindings) {
    this.bindings = bindings;
    const { map, reserved } = bindingMap(bindings);
    this.keyMap = map;
    this.reservedKeys = reserved;
    this.keys.clear();
  }
  // Physical key -> the default code gameplay reads, or null for a default key rebound away.
  translate(code) {
    if (this.keyMap.has(code)) return this.keyMap.get(code);
    return this.reservedKeys.has(code) ? null : code;
  }
  // Read and remove a one-shot action so catch-up ticks cannot repeat it.
  consume(k) {
    const v = this.actions.has(k);
    this.actions.delete(k);
    return v;
  }
  // Reset accumulated movement and held controls on pause, death, and mode changes.
  clear() {
    this.keys.clear();
    this.actions.clear();
    this.fire = false;
    this.aim = false;
    this.dx = 0;
    this.dy = 0;
    this.mouseDrag = false;
    this.lastMouse = null;
    this.moveX = 0;
    this.moveY = 0;
    this.touchController?.reset();
  }
  // Try native capture; a denied or unsupported request falls back to drag aiming.
  async lock() {
    if (!this.touch) {
      try {
        if (!this.canvas.requestPointerLock) {
          this.enableMouseFallback();
          return;
        }
        await this.canvas.requestPointerLock();
      } catch {
        this.enableMouseFallback();
      }
    }
  }
  // Ignore late capture failures after play stops or a successful lock has already arrived.
  enableMouseFallback() {
    if (
      !this.active ||
      this.touch ||
      document.pointerLockElement === this.canvas
    )
      return;
    this.mouseFallback = true;
    this.onTouch();
  }
}
export class TouchInputController {
  // Track joystick, look, and action buttons by pointer ID for simultaneous touch controls.
  constructor(input) {
    this.input = input;
    this.look = null;
    this.joy = null;
    this.buttons = new Map();
    const zone = document.getElementById("lookZone"),
      joy = document.getElementById("joystick");
    this.stick = joy.firstElementChild;
    // Capture each touch and treat release, cancellation, and lost capture as equivalent cleanup.
    const bind = (el, down, move, up) => {
      el.addEventListener("pointerdown", (e) => {
        if (!input.active) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        down(e);
      });
      el.addEventListener("pointermove", (e) => {
        if (input.active) move(e);
      });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        el.addEventListener(name, up);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    bind(
      zone,
      (e) => {
        if (this.look === null) {
          this.look = e.pointerId;
          this.lastX = e.clientX;
          this.lastY = e.clientY;
        }
      },
      (e) => {
        if (e.pointerId === this.look) {
          input.dx += e.clientX - this.lastX;
          input.dy += (input.invertY ? -1 : 1) * (e.clientY - this.lastY);
          this.lastX = e.clientX;
          this.lastY = e.clientY;
        }
      },
      (e) => {
        if (e.pointerId === this.look) this.look = null;
      },
    );
    // Clamp joystick displacement to its radius while preserving movement direction.
    const update = (e) => {
      const r = joy.getBoundingClientRect(),
        x = e.clientX - r.left - r.width / 2,
        y = e.clientY - r.top - r.height / 2,
        l = Math.max(1, Math.hypot(x, y) / 38);
      input.moveX = clamp(x / l / 38, -1, 1);
      input.moveY = clamp(-y / l / 38, -1, 1);
      if (this.sprintLock && input.moveY > 0.5) this.sprintRan = true;
      this.stick.style.transform = `translate(${x / l}px,${y / l}px)`;
    };
    bind(
      joy,
      (e) => {
        if (this.joy === null) {
          this.joy = e.pointerId;
          update(e);
        }
      },
      (e) => {
        if (e.pointerId === this.joy) update(e);
      },
      (e) => {
        if (e.pointerId === this.joy) {
          this.joy = null;
          input.moveX = input.moveY = 0;
          this.stick.style.transform = "";
          // Sprint lock lasts one run: letting go of the stick after running ends it.
          if (this.sprintRan) this.setSprint(false);
        }
      },
    );
    // Map touch actions to the same gameplay commands as keyboard and mouse.
    this.toggles = {};
    this.fireDrag = null;
    document.querySelectorAll("[data-action]").forEach((el) => {
      const a = el.dataset.action;
      if (el.hasAttribute("aria-pressed")) this.toggles[a] = el;
      bind(
        el,
        (e) => {
          this.buttons.set(e.pointerId, a);
          if (a === "fire") {
            input.fire = true;
            input.firePresses++;
            input.actions.add("fire");
            // The thumb holding FIRE can also steer, so aiming continues during a burst.
            this.fireDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
          } else if (a === "aim") input.aim = !input.aim;
          else if (a === "crouch") input.touchCrouch = !input.touchCrouch;
          else if (a === "sprint") this.setSprint(!this.sprintLock);
          else
            input.actions.add(
              { reload: "KeyR", jump: "Space", switch: "switch" }[a],
            );
          this.sync();
        },
        (e) => {
          const f = this.fireDrag;
          if (f && e.pointerId === f.id) {
            input.dx += e.clientX - f.x;
            input.dy += (input.invertY ? -1 : 1) * (e.clientY - f.y);
            f.x = e.clientX;
            f.y = e.clientY;
          }
        },
        (e) => {
          if (this.buttons.get(e.pointerId) === "fire") input.fire = false;
          if (this.fireDrag?.id === e.pointerId) this.fireDrag = null;
          this.buttons.delete(e.pointerId);
        },
      );
    });
  }
  // Sprint lock holds a virtual Shift, so movement (and the online server) treat it like the
  // desktop key; sprinting itself still needs the stick pushed forward and no ADS.
  setSprint(on) {
    this.sprintLock = on;
    this.sprintRan = false;
    if (on) this.input.keys.add("ShiftLeft");
    else this.input.keys.delete("ShiftLeft");
    this.sync();
  }
  // Light up toggles that are on. The game can turn them off itself (a jump cancels a slide's
  // crouch, a pause clears input), so this also runs with every HUD refresh.
  sync() {
    const i = this.input;
    if (this.sprintLock && (i.aim || i.touchCrouch)) this.setSprint(false);
    const state = {
      aim: i.aim,
      crouch: i.touchCrouch,
      sprint: !!this.sprintLock,
    };
    for (const [a, el] of Object.entries(this.toggles)) {
      const on = String(!!state[a]);
      if (el.getAttribute("aria-pressed") !== on)
        el.setAttribute("aria-pressed", on);
    }
  }
  // Forget pointer ownership and return the joystick to its neutral visual state.
  reset() {
    this.look = this.joy = this.fireDrag = null;
    this.buttons.clear();
    this.stick.style.transform = "";
    this.input.touchCrouch = false;
    this.sprintLock = this.sprintRan = false;
    this.sync?.();
  }
}
