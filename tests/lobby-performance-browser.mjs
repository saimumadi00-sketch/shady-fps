// Count actual GPU draws to catch unnecessary rendering, independent of GPU speed.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__draws = {};
    for (const method of [
      "drawArrays",
      "drawElements",
      "drawArraysInstanced",
      "drawElementsInstanced",
    ]) {
      const original = WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method] = function (...args) {
        const id = this.canvas.id;
        window.__draws[id] = (window.__draws[id] || 0) + 1;
        return original.apply(this, args);
      };
    }
  });
  await page.goto(process.env.TEST_URL || "http://localhost:8080");
  await page.waitForFunction(
    () => document.querySelector("#squad-canvas").dataset.class === "assault",
  );
  const draws = () => page.evaluate(() => ({ ...window.__draws }));
  const settle = () => page.waitForTimeout(500);
  await settle();
  const idle = await draws();
  assert.ok(idle["squad-canvas"] > 0 && idle["weapon-canvas"] > 0);
  await settle();
  assert.deepEqual(
    await draws(),
    idle,
    "Reduced motion must stop idle GPU draws",
  );

  await page.click('[data-class="recon"]');
  await settle();
  const changed = await draws();
  assert.ok(changed["squad-canvas"] > idle["squad-canvas"]);
  assert.ok(changed["weapon-canvas"] > idle["weapon-canvas"]);
  await settle();
  assert.deepEqual(
    await draws(),
    changed,
    "Changed models must become idle again",
  );

  await page.focus("#weapon-canvas");
  await page.keyboard.press("ArrowRight");
  await settle();
  const inspected = await draws();
  assert.ok(inspected["weapon-canvas"] > changed["weapon-canvas"]);
  assert.equal(inspected["squad-canvas"], changed["squad-canvas"]);
  await page.locator("#weapon-canvas").hover();
  await page.mouse.wheel(0, 80);
  await settle();
  assert.ok((await draws())["weapon-canvas"] > inspected["weapon-canvas"]);
  const rect = await page.locator("#weapon-canvas").boundingBox();
  const beforeDrag = await draws();
  await page.mouse.move(rect.x + 30, rect.y + 30);
  await page.mouse.down();
  await page.mouse.move(rect.x + 70, rect.y + 45);
  await page.mouse.up();
  await settle();
  assert.ok((await draws())["weapon-canvas"] > beforeDrag["weapon-canvas"]);

  await page.setViewportSize({ width: 1280, height: 720 });
  await settle();
  const resized = await draws();
  await settle();
  assert.deepEqual(await draws(), resized, "Resizing must settle back to idle");
  await page.click("#settings");
  await page.selectOption("#motion", "full");
  await page.click("#save-settings");
  await settle();
  const full = await draws();
  await settle();
  assert.ok((await draws())["squad-canvas"] > full["squad-canvas"]);
  assert.ok((await draws())["weapon-canvas"] > full["weapon-canvas"]);

  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll("canvas"))
      canvas.style.transform = "translateY(10000px)";
  });
  await settle();
  const offscreen = await draws();
  await settle();
  assert.deepEqual(
    await draws(),
    offscreen,
    "Offscreen scenes must stop GPU draws",
  );
  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll("canvas"))
      canvas.style.transform = "";
  });
  await settle();
  assert.ok((await draws())["squad-canvas"] > offscreen["squad-canvas"]);
  assert.deepEqual(errors, []);
  console.log(
    "PASS lobby performance: zero idle/offscreen draws; model changes, keyboard, zoom, drag, resize and animation resume correctly",
  );
} finally {
  await browser.close();
}
