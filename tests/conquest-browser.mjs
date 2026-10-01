import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = process.env.TEST_URL || "http://localhost:8080";
try {
  await mkdir("artifacts", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/");
  await page.waitForFunction(
    () => document.querySelector("#squad-canvas").dataset.class,
  );
  await page.selectOption("#mode", "Conquest");
  assert.match(await page.locator(".training").textContent(), /CONQUEST/);
  await page.click(".training");
  await page.waitForSelector("#matchMode");
  assert.match(page.url(), /mode=conquest/);
  assert.equal(await page.locator("#matchMode").inputValue(), "conquest");
  await page.goto(base + "/arena.html?mode=conquest&debug=1");
  await page.waitForFunction(() => !!window.__arena);
  assert.equal(await page.locator("#target").isDisabled(), true);
  assert.equal(await page.locator("#ruleTarget").textContent(), "150");
  await page.screenshot({ path: "artifacts/conquest-menu.png" });
  await page.click("#play");
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.waitForSelector("#objectives > div");
  assert.equal(await page.locator("#objectives > div").count(), 3);
  assert.match(await page.locator("#scoreTarget").textContent(), /TICKETS/);
  await page.evaluate(() => {
    const g = __arena.game;
    g.bots.update = () => {};
    for (const a of g.actors)
      if (a !== g.player) {
        a.alive = false;
        a.respawn = 9999;
      }
    Object.assign(g.player, {
      x: g.match.sectors[0].x,
      z: g.match.sectors[0].z,
      yaw: Math.PI / 2,
      pitch: 0,
      y: 0,
    });
  });
  await page.waitForFunction(
    () => __arena.game.match.sectors[0].owner === 0,
    {},
    { timeout: 20000 },
  );
  await page.waitForFunction(() => __arena.game.match.scores[1] < 150);
  assert.equal(
    await page.locator("#objectives > div").first().getAttribute("data-owner"),
    "cyan",
  );
  await page.screenshot({ path: "artifacts/conquest-desktop.png" });
  assert.equal(await page.evaluate(() => __arena.renderer.gl.getError()), 0);
  const start = await page.evaluate(() => ({
    x: __arena.game.player.x,
    z: __arena.game.player.z,
  }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  assert.ok(
    await page.evaluate(
      (before) =>
        Math.hypot(
          __arena.game.player.x - before.x,
          __arena.game.player.z - before.z,
        ) > 0.1,
      start,
    ),
  );
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  assert.ok(await page.evaluate(() => __arena.game.player.ammo[0].mag < 30));
  await page.evaluate(() => __arena.pause());
  const paused = await page.evaluate(() =>
    JSON.stringify(__arena.game.snapshot()),
  );
  await page.waitForTimeout(350);
  assert.equal(
    await page.evaluate(() => JSON.stringify(__arena.game.snapshot())),
    paused,
  );
  await page.click("#resume");
  await page.waitForFunction(() => __arena.game.match.state === "playing");
  await page.evaluate(() => {
    __arena.game.match.scores = [3, 1];
    __arena.game.match.bleedTime = __arena.game.match.rules.bleedInterval;
  });
  await page.waitForSelector("#end", { state: "visible" });
  assert.equal(await page.locator("#winner").textContent(), "CYAN WINS");
  assert.equal(await page.locator("#finalScore").textContent(), "3 : 0");
  await page.click("#restart");
  assert.deepEqual(
    await page.evaluate(() => __arena.game.match.scores),
    [150, 150],
  );
  assert.ok(
    await page.evaluate(() =>
      __arena.game.match.sectors.every((s) => s.owner === null),
    ),
  );
  await page.evaluate(() => __arena.pause());
  await page.click("#back");
  await page.selectOption("#matchMode", "tdm");
  await page.waitForFunction(() => window.__arena?.game.mode === "tdm");
  assert.equal(await page.locator("#target").isDisabled(), false);
  assert.equal(await page.locator("#briefMapName").textContent(), "YARD 07");
  await page.selectOption("#matchMode", "conquest");
  await page.waitForFunction(() => window.__arena?.game.mode === "conquest");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__arena?.game.mode === "conquest");
  await page.click("#play");
  await page.waitForFunction(() => __arena.game.match.state === "playing");
  assert.equal(await page.evaluate(() => __arena.game.nav.nodes.length), 1015);
  await context.setOffline(false);
  assert.deepEqual(errors, []);
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const touch = await mobile.newPage();
  touch.on("pageerror", (error) => errors.push(error.message));
  await touch.goto(base + "/arena.html?mode=conquest&debug=1");
  await touch.waitForFunction(() => !!window.__arena);
  await touch.tap("#play");
  await touch.waitForFunction(() => __arena.game.match.state === "playing");
  assert.equal(await touch.locator("#touch").isVisible(), true);
  assert.ok(
    await touch.evaluate(() => {
      const rect = document
        .getElementById("objectives")
        .getBoundingClientRect();
      return (
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        rect.bottom < innerHeight / 2
      );
    }),
  );
  await touch.screenshot({ path: "artifacts/conquest-mobile.png" });
  assert.equal(await touch.evaluate(() => __arena.renderer.gl.getError()), 0);
  assert.deepEqual(errors, []);
  await mobile.close();
  console.log(
    "PASS Conquest: lobby launch, imported map, capture/tickets HUD, movement/fire, pause, victory/restart, mode switching, offline reload and mobile layout",
  );
} finally {
  await browser.close();
}
