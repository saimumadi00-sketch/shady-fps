// Mocks browser settings controls to verify unknown saved fields and invalid toggles cannot break startup.
import test from "node:test";
import assert from "node:assert/strict";
import { SettingsManager } from "../src/settings.js";
test("unknown persisted fields do not crash startup and invalid toggles use defaults", () => {
  const originals = Object.fromEntries(
    ["matchMedia", "localStorage", "document"].map((k) => [k, globalThis[k]]),
  );
  const elements = Object.fromEntries(
    ["quality", "difficulty", "sensitivity", "sound", "autoQuality"].map(
      (k) => [
        k,
        {
          type: ["sound", "autoQuality"].includes(k) ? "checkbox" : "range",
          addEventListener() {},
        },
      ],
    ),
  );
  try {
    globalThis.matchMedia = () => ({ matches: false });
    globalThis.localStorage = {
      getItem: () =>
        JSON.stringify({
          oldSetting: 1,
          sound: "false",
          autoQuality: null,
          sensitivity: 1.5,
        }),
    };
    globalThis.document = { getElementById: (id) => elements[id] };
    const settings = new SettingsManager();
    assert.equal(settings.values.oldSetting, undefined);
    assert.equal(settings.values.sound, true);
    assert.equal(settings.values.autoQuality, true);
    assert.equal(settings.values.sensitivity, 1.5);
    // Restore globals even after assertion failures so other tests do not inherit the mocked DOM.
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
