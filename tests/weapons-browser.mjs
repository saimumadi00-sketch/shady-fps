// Runs the same loadout selection, persistence, ammo-preservation, and switching checks on desktop and touch.
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
  // Reuse assertions across desktop and emulated touch to keep both selection paths equivalent.
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 844, height: 390 }
        : { width: 1280, height: 720 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/?debug=1");
    assert.equal(await page.locator("#startingWeapon option").count(), 5);
    await page.selectOption("#startingWeapon", "3");
    assert.match(
      await page.locator("#startingWeaponInfo").textContent(),
      /60 damage/,
    );
    await page.reload();
    assert.equal(await page.locator("#startingWeapon").inputValue(), "3");
    if (mobile) await page.locator("#play").tap();
    else await page.click("#play");
    await page.waitForFunction(() => __arena.game.match.state === "playing");
    assert.equal(await page.evaluate(() => __arena.game.player.weapon), 3);
    await page.evaluate(() => {
      __arena.game.bots.update = () => {};
      __arena.game.player.ammo[4].mag = 7;
      __arena.pause();
    });
    await page.selectOption("#pauseWeapon", "4");
    if (mobile) await page.locator("#resume").tap();
    else await page.click("#resume");
    await page.waitForFunction(() => __arena.game.match.state === "playing");
    assert.equal(await page.evaluate(() => __arena.game.player.weapon), 4);
    assert.equal(await page.evaluate(() => __arena.game.player.ammo[4].mag), 7);
    if (mobile) await page.locator("#switch").tap();
    else await page.keyboard.press("Digit1");
    await page.waitForFunction(() => __arena.game.player.weapon === 0);
    if (!mobile) {
      await page.keyboard.press("Digit5");
      await page.waitForFunction(() => __arena.game.player.weapon === 4);
    }
    await page.evaluate(() => __arena.pause());
    await page.screenshot({
      path: `artifacts/weapons-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS weapon selection, persistence, ammo preservation, switching: " +
        (mobile ? "mobile" : "desktop"),
    );
  }
  // Always release the browser, including after a failed assertion.
} finally {
  await browser.close();
}
