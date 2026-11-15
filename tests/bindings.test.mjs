// Key rebinding: swaps on conflict, invalid saves fall back, and translation keeps gameplay codes.
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BINDINGS,
  normalizeBindings,
  rebind,
  bindingMap,
  actionKeys,
  keyLabel,
} from "../src/bindings.js";

test("rebinding to a taken key swaps the two actions", () => {
  const b = rebind(DEFAULT_BINDINGS, "jump", "KeyR");
  assert.equal(b.jump, "KeyR");
  assert.equal(b.reload, "Space");
});

test("duplicate, reserved or malformed saved bindings fall back to defaults", () => {
  assert.deepEqual(normalizeBindings({ jump: "KeyW" }), DEFAULT_BINDINGS);
  assert.equal(normalizeBindings({ jump: "Escape" }).jump, "Space");
  assert.equal(normalizeBindings({ jump: "<b>" }).jump, "Space");
  assert.equal(normalizeBindings({ jump: "KeyF" }).jump, "KeyF");
});

test("physical keys translate to the default codes gameplay reads", () => {
  const b = rebind(DEFAULT_BINDINGS, "jump", "KeyF");
  const { map, reserved } = bindingMap(b);
  assert.equal(map.get("KeyF"), "Space");
  // Space is no longer bound to anything, so it must do nothing.
  assert.equal(map.has("Space"), false);
  assert.equal(reserved.has("Space"), true);
  // Ctrl still crouches while crouch keeps its default key.
  assert.equal(map.get("ControlLeft"), "ControlLeft");
  const moved = bindingMap(rebind(DEFAULT_BINDINGS, "crouch", "KeyV"));
  assert.equal(moved.map.has("ControlLeft"), false);
});

test("labels name keys the way players read them", () => {
  assert.equal(keyLabel("KeyW"), "W");
  assert.equal(keyLabel("Digit1"), "1");
  assert.equal(keyLabel("ShiftLeft"), "Shift");
  assert.equal(actionKeys(DEFAULT_BINDINGS, "crouch"), "C or Ctrl");
  assert.equal(actionKeys(DEFAULT_BINDINGS, "sprint"), "Shift");
  assert.equal(
    actionKeys(rebind(DEFAULT_BINDINGS, "crouch", "KeyV"), "crouch"),
    "V",
  );
});
