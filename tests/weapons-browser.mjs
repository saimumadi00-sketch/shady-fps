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
    await page.goto(base + "/arena.html?debug=1");
    assert.equal(await page.locator("#loadoutClass option").count(), 4);
    // Each class exposes exactly its primary and the shared pistol in both selectors.
    for (const [classId, primary] of [
      ["assault", "0"],
      ["support", "4"],
      ["engineer", "1"],
      ["scout", "3"],
    ]) {
      await page.selectOption("#loadoutClass", classId);
      for (const id of ["startingWeapon", "pauseWeapon"])
        assert.deepEqual(
          await page
            .locator(`#${id} option`)
            .evaluateAll((options) => options.map((option) => option.value)),
          [primary, "2"],
        );
      assert.equal(await page.locator("#startingWeapon").inputValue(), primary);
    }
    // Weapon-only saves from before classes existed retain their inferred class after sidearm selection.
    await page.evaluate(() => {
      localStorage.removeItem("crosscurrent-class");
      localStorage.setItem("crosscurrent-weapon", "4");
    });
    await page.reload();
    assert.equal(await page.locator("#loadoutClass").inputValue(), "support");
    await page.selectOption("#startingWeapon", "2");
    await page.reload();
    assert.equal(await page.locator("#loadoutClass").inputValue(), "support");
    assert.equal(await page.locator("#startingWeapon").inputValue(), "2");
    await page.selectOption("#loadoutClass", "scout");
    await page.selectOption("#startingWeapon", "3");
    assert.match(
      await page.locator("#startingWeaponInfo").textContent(),
      /60 damage/,
    );
    await page.reload();
    assert.equal(await page.locator("#loadoutClass").inputValue(), "scout");
    assert.equal(await page.locator("#startingWeapon").inputValue(), "3");
    if (mobile) await page.locator("#play").tap();
    else await page.click("#play");
    await page.waitForFunction(() => __arena.game.match.state === "playing");
    assert.equal(
      await page.evaluate(() => __arena.game.player.classId),
      "scout",
    );
    assert.equal(await page.evaluate(() => __arena.game.player.weapon), 3);
    await page.evaluate(() => {
      __arena.game.bots.update = () => {};
      __arena.game.player.ammo[2].mag = 7;
      __arena.pause();
    });
    await page.selectOption("#pauseWeapon", "2");
    if (mobile) await page.locator("#resume").tap();
    else await page.click("#resume");
    await page.waitForFunction(() => __arena.game.match.state === "playing");
    assert.equal(await page.evaluate(() => __arena.game.player.weapon), 2);
    assert.equal(await page.evaluate(() => __arena.game.player.ammo[2].mag), 7);
    if (mobile) await page.locator("#switch").tap();
    else await page.keyboard.press("Digit4");
    await page.waitForFunction(() => __arena.game.player.weapon === 3);
    if (!mobile) {
      await page.keyboard.press("Digit5");
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => __arena.game.player.weapon), 3);
    }
    if (mobile) await page.locator("#switch").tap();
    else await page.keyboard.press("Digit3");
    await page.waitForFunction(() => __arena.game.player.weapon === 2);
    // A respawn keeps the chosen class and sidearm while restoring only assigned ammunition.
    await page.evaluate(() => {
      __arena.game.spawns.spawn(__arena.game.player);
    });
    assert.deepEqual(
      await page.evaluate(() => [
        __arena.game.player.classId,
        __arena.game.player.weapon,
        __arena.game.player.ammo[4],
      ]),
      ["scout", 2, { mag: 0, reserve: 0 }],
    );
    await page.evaluate(() => __arena.pause());
    // Returning to setup is the boundary for changing class; Play applies the next loadout.
    await page.click("#back");
    await page.selectOption("#loadoutClass", "support");
    if (mobile) await page.locator("#play").tap();
    else await page.click("#play");
    await page.waitForFunction(() => __arena.game.match.state === "playing");
    assert.deepEqual(
      await page.evaluate(() => [
        __arena.game.player.classId,
        __arena.game.player.weapon,
      ]),
      ["support", 4],
    );
    await page.evaluate(() => __arena.pause());
    await page.screenshot({
      path: `artifacts/weapons-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS class inventories, persistence, legacy migration, respawn, restricted switching: " +
        (mobile ? "mobile" : "desktop"),
    );
  }
  // Always release the browser, including after a failed assertion.
} finally {
  await browser.close();
}
