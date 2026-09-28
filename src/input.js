import { clamp } from "./math.js";
export class InputManager {
  constructor(canvas, onPause, onTouch) {
    this.canvas = canvas;
    this.onPause = onPause;
    this.keys = new Set();
    this.actions = new Set();
    this.dx = 0;
    this.dy = 0;
    this.fire = false;
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
    window.addEventListener("keydown", (e) => {
      if (!this.active) return;
      if (["Space", "ControlLeft", "ControlRight", "Tab"].includes(e.code))
        e.preventDefault();
      if (!this.keys.has(e.code)) this.actions.add(e.code);
      this.keys.add(e.code);
      if (e.code === "Escape") onPause();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("mousemove", (e) => {
      if (this.active && document.pointerLockElement === canvas) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      } else if (this.active && this.mouseFallback && this.mouseDrag) {
        if (this.lastMouse) {
          this.dx += e.clientX - this.lastMouse.x;
          this.dy += e.clientY - this.lastMouse.y;
        }
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
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
  consume(k) {
    const v = this.actions.has(k);
    this.actions.delete(k);
    return v;
  }
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
  constructor(input) {
    this.input = input;
    this.look = null;
    this.joy = null;
    this.buttons = new Map();
    const zone = document.getElementById("lookZone"),
      joy = document.getElementById("joystick");
    this.stick = joy.firstElementChild;
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
          input.dy += e.clientY - this.lastY;
          this.lastX = e.clientX;
          this.lastY = e.clientY;
        }
      },
      (e) => {
        if (e.pointerId === this.look) this.look = null;
      },
    );
    const update = (e) => {
      const r = joy.getBoundingClientRect(),
        x = e.clientX - r.left - r.width / 2,
        y = e.clientY - r.top - r.height / 2,
        l = Math.max(1, Math.hypot(x, y) / 38);
      input.moveX = clamp(x / l / 38, -1, 1);
      input.moveY = clamp(-y / l / 38, -1, 1);
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
        }
      },
    );
    document.querySelectorAll("[data-action]").forEach((el) => {
      const a = el.dataset.action;
      bind(
        el,
        (e) => {
          this.buttons.set(e.pointerId, a);
          if (a === "fire") {
            input.fire = true;
            input.actions.add("fire");
          } else if (a === "aim") input.aim = !input.aim;
          else if (a === "crouch") input.touchCrouch = !input.touchCrouch;
          else
            input.actions.add(
              { reload: "KeyR", jump: "Space", switch: "switch" }[a],
            );
        },
        () => {},
        (e) => {
          if (this.buttons.get(e.pointerId) === "fire") input.fire = false;
          this.buttons.delete(e.pointerId);
        },
      );
    });
  }
  reset() {
    this.look = this.joy = null;
    this.buttons.clear();
    this.stick.style.transform = "";
    this.input.touchCrouch = false;
  }
}
