// Touch controls on a landscape phone: sprint lock, slide from a locked sprint, lock release,
// lit toggles, fire-and-steer and device-specific prompts, driven with real touch events.
import { chromium, devices } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["Pixel 7"],
  viewport: { width: 915, height: 412 },
  screen: { width: 915, height: 412 },
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://localhost:8080/arena.html?debug=1");
await page.waitForFunction(
  () => window.__arena && !document.getElementById("play").disabled,
);
await page.tap("#play");
// Bots must not kill the tester mid-check: a death clears held input by design.
await page.evaluate(() => {
  const g = __arena.game,
    apply = g.damage.apply.bind(g.damage);
  g.damage.apply = (target, ...rest) =>
    target === g.player ? false : apply(target, ...rest);
});
await page.waitForTimeout(800);
const cdp = await ctx.newCDPSession(page);
const center = async (sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
const touch = (type, pts) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
const st = () =>
  page.evaluate(() => {
    const p = __arena.game.player,
      i = __arena.input;
    return {
      sprinting: p.sprinting,
      crouched: p.crouched,
      sliding: p.sliding,
      aim: i.aim,
      shift: i.keys.has("ShiftLeft"),
      yaw: p.yaw,
      pressed: Object.fromEntries(
        [...document.querySelectorAll("#touch [aria-pressed]")].map((b) => [
          b.id,
          b.getAttribute("aria-pressed"),
        ]),
      ),
    };
  });
const r = [];
// 1. Sprint lock: tap SPRINT, push stick ~60% forward (below the old 0.92 auto-sprint threshold).
const sp = await center("#sprint"),
  joy = await center("#joystick");
await touch("touchStart", [{ x: sp.x, y: sp.y, id: 1 }]);
await touch("touchEnd", []);
await touch("touchStart", [{ x: joy.x, y: joy.y, id: 2 }]);
await touch("touchMove", [{ x: joy.x, y: joy.y - 25, id: 2 }]);
await page.waitForTimeout(400);
let s = await st();
assert.match(await page.locator("#notice").textContent(), /CROUCH to slide/);
assert.ok(
  s.shift && s.sprinting,
  "sprint lock sprints at partial stick " + JSON.stringify(s),
);
assert.equal(s.pressed.sprint, "true");
r.push("sprint lock sprints at 66% stick, button lit");
// 2. Slide: tap CROUCH while sprinting.
const cr = await center("#crouch");
await touch("touchStart", [
  { x: joy.x, y: joy.y - 25, id: 2 },
  { x: cr.x, y: cr.y, id: 3 },
]);
await page.waitForTimeout(120);
s = await st();
assert.ok(s.sliding, "slides");
assert.match(await page.locator("#notice").textContent(), /JUMP to cancel/);
assert.equal(s.shift, false, "crouch ends sprint lock");
r.push("crouch while sprinting slides and ends the lock");
await touch("touchEnd", []);
await page.waitForTimeout(1000);
// 3. Release stick after a run clears lock.
await touch("touchStart", [{ x: sp.x, y: sp.y, id: 4 }]);
await touch("touchEnd", []);
await touch("touchStart", [{ x: joy.x, y: joy.y, id: 5 }]);
await touch("touchMove", [{ x: joy.x, y: joy.y - 30, id: 5 }]);
await page.waitForTimeout(150);
await touch("touchEnd", []);
await page.waitForTimeout(100);
s = await st();
assert.equal(s.shift, false);
assert.equal(s.pressed.sprint, "false");
r.push("letting go of the stick after a run releases the lock");
// 4. Aim toggle lights up.
const aim = await center("#aim");
await touch("touchStart", [{ x: aim.x, y: aim.y, id: 6 }]);
await touch("touchEnd", []);
await page.waitForTimeout(100);
s = await st();
assert.ok(s.aim);
assert.equal(s.pressed.aim, "true");
await touch("touchStart", [{ x: aim.x, y: aim.y, id: 7 }]);
await touch("touchEnd", []);
await page.waitForTimeout(100);
s = await st();
assert.equal(s.pressed.aim, "false");
r.push("AIM toggle shows on/off");
// 5. Hold FIRE and drag to steer.
const fire = await center("#fire");
const y0 = (await st()).yaw;
await touch("touchStart", [{ x: fire.x, y: fire.y, id: 8 }]);
for (let k = 1; k <= 6; k++) {
  await touch("touchMove", [{ x: fire.x - k * 10, y: fire.y, id: 8 }]);
  await page.waitForTimeout(30);
}
const firing = await page.evaluate(() => __arena.input.fire);
await touch("touchEnd", []);
await page.waitForTimeout(100);
s = await st();
assert.ok(firing, "still firing while dragging");
assert.ok(Math.abs(s.yaw - y0) > 0.05, "yaw changed " + (s.yaw - y0));
r.push("holding FIRE and dragging turns the view while shooting");
assert.deepEqual(errs, []);
console.log("PASS touch controls: " + r.join("; "));
await browser.close();
