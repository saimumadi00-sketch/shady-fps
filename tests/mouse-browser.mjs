// Simulates denied, missing, and hybrid pointer capture to verify aiming remains usable.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
// Software rendering makes automation portable; these samples are not physical-GPU benchmarks.
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = (process.env.TEST_URL || "http://localhost:8080").replace(
  /\/$/,
  "",
);
try {
  // Simulate browser API limitations and touch-to-mouse changes without relying on host hardware.
  for (const mode of ["denied", "missing", "hybrid"]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((mode) => {
      if (mode === "denied")
        HTMLCanvasElement.prototype.requestPointerLock = () =>
          Promise.reject(new Error("denied"));
      if (mode === "missing")
        HTMLCanvasElement.prototype.requestPointerLock = undefined;
    }, mode);
    await page.goto(base + "/?debug=1");
    await page.click("#play");
    await page.evaluate(() => {
      __arena.game.bots.update = () => {};
      if (!__arena.input.mouseFallback) {
        // Reproduce a touch-to-mouse switch during an already running match.
        __arena.input.touch = true;
      }
    });
    if (mode === "hybrid") {
      await page.mouse.click(640, 360);
      await page.waitForFunction(
        () => !__arena.input.touch && !!document.pointerLockElement,
      );
    } else {
      await page.waitForFunction(() => __arena.input.mouseFallback);
      assert.equal(
        await page.evaluate(() => __arena.game.match.state),
        "playing",
      );
      assert.match(await page.locator("#hint").textContent(), /DRAG TO AIM/);
    }
    const before = await page.evaluate(() => __arena.game.player.yaw);
    await page.mouse.move(640, 360);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(740, 390, { steps: 8 });
    await page.waitForFunction(
      (before) => Math.abs(__arena.game.player.yaw - before) > 0.03,
      before,
    );
    assert.equal(await page.evaluate(() => __arena.game.player.aim), true);
    await page.mouse.up({ button: "right" });
    await page.waitForFunction(() => !__arena.game.player.aim);
    assert.deepEqual(errors, []);
    await page.close();
    console.log("PASS mouse aiming: " + mode);
  }
  // Always release the browser, including after a failed assertion.
} finally {
  await browser.close();
}
