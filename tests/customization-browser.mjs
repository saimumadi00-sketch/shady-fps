// Exercises saved customization and custom rules, then checks every weapon mesh and mobile startup.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
// Software rendering makes automation portable; these samples are not physical-GPU benchmarks.
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    (process.env.TEST_URL || "http://localhost:8080") + "/?debug=1",
  );
  await page.waitForFunction(() => !!window.__arena);
  await page.selectOption("#finish", "sand");
  await page.selectOption("#optic", "reflex");
  await page.fill("#callsign", "Ranger");
  await page.locator("#fov").fill("95");
  await page.locator("summary").filter({ hasText: "MATCH RULES" }).click();
  await page.selectOption("#target", "15");
  await page.selectOption("#duration", "180");
  await page.selectOption("#crosshairColor", "#ffbf69");
  await page.screenshot({ path: "artifacts/armory-menu.png", fullPage: true });
  // A new page load must recover saved preferences before Play applies them to the simulation.
  await page.reload();
  await page.waitForFunction(() => !!window.__arena);
  assert.equal(await page.locator("#finish").inputValue(), "sand");
  await page.click("#play");
  await page.waitForFunction(() => __arena.game.match.state === "playing");
  assert.deepEqual(
    await page.evaluate(() => [
      __arena.game.player.name,
      __arena.game.match.rules.target,
      __arena.game.match.rules.duration,
      __arena.renderer.customization.fov,
    ]),
    ["Ranger", 15, 180, 95],
  );
  await page.evaluate(() => {
    __arena.game.bots.update = () => {};
  });
  // Render every weapon variant and capture screenshots while checking the WebGL error state.
  for (let i = 0; i < 5; i++) {
    // Return through the real menu to select the class owning the next primary.
    await page.evaluate(() => __arena.pause());
    await page.click("#back");
    await page.selectOption(
      "#loadoutClass",
      ["assault", "engineer", "assault", "scout", "support"][i],
    );
    await page.selectOption("#startingWeapon", String(i));
    await page.click("#play");
    await page.keyboard.press("Digit" + (i + 1));
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => __arena.game.player.weapon), i);
    assert.equal(await page.evaluate(() => __arena.renderer.gl.getError()), 0);
    await page.screenshot({ path: `artifacts/weapon-model-${i}.png` });
  }
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "artifacts/weapon-ads.png" });
  await page.mouse.up({ button: "right" });
  assert.deepEqual(errors, []);
  await page.close();
  const mobile = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  await mobile.goto(
    (process.env.TEST_URL || "http://localhost:8080") + "/?debug=1",
  );
  await mobile.selectOption("#finish", "olive");
  await mobile.locator("#play").tap();
  await mobile.waitForFunction(() => __arena.game.match.state === "playing");
  await mobile.close();
  console.log(
    "PASS customization persistence, rules, FOV, five meshes, mobile menu",
  );
  // Always release the browser, including after a failed assertion.
} finally {
  await browser.close();
}
