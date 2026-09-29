// Exercise the visible lobby, persistence, queue lifecycle and both responsive layouts.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto((process.env.TEST_URL || "http://localhost:8080") + "/");
  await page.waitForFunction(
    () => document.querySelector("#squad-canvas").dataset.class === "assault",
  );
  await mkdir("artifacts", { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/lobby-desktop.png" });
  for (const cls of ["engineer", "support", "recon", "assault"]) {
    await page.click(`[data-class="${cls}"]`);
    assert.equal(
      await page.locator("#squad-canvas").getAttribute("data-class"),
      cls,
    );
    assert.equal(await page.locator("#weapon option").count(), 2);
  }
  await page.selectOption("#weapon", "1");
  await page.selectOption("#optic", "scope");
  await page.selectOption("#barrel", "suppressor");
  await page.click('[data-skin="sand"]');
  const preview = await page.locator("#weapon-canvas").boundingBox();
  await page.mouse.move(preview.x + 50, preview.y + 40);
  await page.mouse.down();
  await page.mouse.move(preview.x + 130, preview.y + 65, { steps: 8 });
  await page.mouse.up();
  await page.click('[data-tab="saved"]');
  await page.click("#save");
  await page.click('[data-class="recon"]');
  await page.click("#load");
  assert.equal(await page.locator("#operator-class").textContent(), "ASSAULT");
  assert.equal(await page.locator("#weapon").inputValue(), "1");
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#squad-canvas").dataset.class === "assault",
  );
  assert.equal(await page.locator("#weapon").inputValue(), "1");
  await page.fill("#chat-input", "<img src=x onerror=alert(1)>");
  await page.click("#chat-form button");
  assert.equal(await page.locator("#chat-log img").count(), 0);
  await page.waitForFunction(() =>
    document.querySelector("#chat-log").textContent.includes("GHOST [SIM]"),
  );
  await page.click("#ready");
  assert.equal(
    await page.locator("#ready").getAttribute("aria-pressed"),
    "true",
  );
  await page.selectOption("#mode", "Domination");
  await page.selectOption("#region", "EUROPE");
  assert.equal(await page.locator("#ping").textContent(), "78 MS*");
  await page.click("#find-match");
  await page.click("#find-match");
  assert.match(
    await page.locator("#match-status").textContent(),
    /SYSTEM READY/,
  );
  await page.click("#find-match");
  await page.waitForSelector("#launch", { timeout: 16000 });
  await page.click("#return-lobby");
  await page.click("#settings");
  await page.fill("#callsign", "SPECTRE");
  await page.selectOption("#motion", "reduced");
  await page.click("#save-settings");
  assert.match(await page.locator("#roster").textContent(), /SPECTRE/);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: "artifacts/lobby-laptop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/lobby-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.click('[data-class="recon"]');
  assert.equal(
    await page.locator("#squad-canvas").getAttribute("data-class"),
    "recon",
  );
  // Verify the deployed worker includes the lobby's image, bundle and training route.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#squad-canvas").dataset.class === "recon",
  );
  await page.click(".training");
  await page.waitForSelector("#loadoutClass");
  assert.equal(await page.locator("#loadoutClass").inputValue(), "scout");
  await context.setOffline(false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS lobby: classes, attachments, 3D interaction, loadout persistence, safe chat, readiness, modes, queue/cancel, settings and responsive layout",
  );
  await context.close();
} finally {
  await browser.close();
}
