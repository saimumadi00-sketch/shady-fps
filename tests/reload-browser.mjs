// Checks all timed reloads in Chromium: no early ammo refill, clean GPU state, and switch cancellation.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
// Software rendering makes automation portable; these samples are not physical-GPU benchmarks.
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    (process.env.TEST_URL || "http://localhost:8080") + "/?debug=1",
  );
  await page.click("#play");
  await page.evaluate(() => {
    __arena.game.bots.update = () => {};
  });
  // Force an empty magazine, observe an intermediate pose, then wait for the real timer to complete.
  for (let weapon = 0; weapon < 5; weapon++) {
    await page.evaluate((w) => {
      const g = __arena.game;
      g.weapons.equip(g.player, w);
      g.player.ammo[w].mag = 0;
      g.player.cooldown = 0;
      g.weapons.reload(g.player);
    }, weapon);
    const total = await page.evaluate(() => __arena.game.player.reload);
    await page.waitForTimeout(total * 400);
    assert.equal(
      await page.evaluate(
        () => __arena.game.player.ammo[__arena.game.player.weapon].mag,
      ),
      0,
    );
    await page.screenshot({ path: `artifacts/reload-${weapon}.png` });
    assert.equal(await page.evaluate(() => __arena.renderer.gl.getError()), 0);
    await page.waitForFunction(() => __arena.game.player.reload === 0);
    assert.ok(
      await page.evaluate(
        () => __arena.game.player.ammo[__arena.game.player.weapon].mag > 0,
      ),
    );
  }
  await page.evaluate(() => {
    const g = __arena.game;
    g.player.ammo[4].mag = 1;
    g.weapons.reload(g.player);
  });
  // Switching during an unfinished reload must immediately discard the old animation/timer.
  await page.keyboard.press("Digit1");
  await page.waitForFunction(() => __arena.game.player.weapon === 0);
  assert.equal(await page.evaluate(() => __arena.game.player.reload), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS all five timed reloads, ammo completion, GL checks and weapon-switch cancellation",
  );
  // Always release the browser, including after a failed assertion.
} finally {
  await browser.close();
}
