// Compares canvas output before and after pause-menu selection to catch stale armory previews.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const p = await b.newPage();
  await p.goto(
    (process.env.TEST_URL || "http://localhost:8080").replace(/\/$/, "") +
      "/?debug=1",
  );
  await p.waitForFunction(() => !!window.__arena);
  await p.selectOption("#loadoutClass", "support");
  await p.selectOption("#startingWeapon", "2");
  // Capture a known-good preview of the destination weapon for exact canvas comparison.
  const expected = await p
    .locator("#weaponPreview")
    .evaluate((c) => c.toDataURL());
  await p.selectOption("#startingWeapon", "4");
  await p.click("#play");
  await p.evaluate(() => __arena.pause());
  await p.selectOption("#pauseWeapon", "2");
  await p.click("#back");
  assert.equal(
    await p.locator("#weaponPreview").evaluate((c) => c.toDataURL()),
    expected,
  );
  console.log("PASS pause weapon selection refreshes start-menu preview");
  // Always release the browser, including after a failed assertion.
} finally {
  await b.close();
}
