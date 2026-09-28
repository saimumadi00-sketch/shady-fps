// End-to-end desktop/mobile workflows against a running production preview, including offline reload and context restoration.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
// Software rendering makes automation portable; these samples are not physical-GPU benchmarks.
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--enable-precise-memory-info",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [],
  results = [];
const base = process.env.TEST_URL || "http://localhost:8080";
const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  }),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(base + "/?debug=1");
await page.waitForFunction(
  () => window.__arena && document.querySelector("#play").disabled === false,
);
await page.screenshot({ path: "artifacts/menu-desktop.png" });
await page.click("#play");
await page.waitForFunction(() => document.pointerLockElement !== null);
assert.equal(await page.locator("#hud").isVisible(), true);
results.push("Desktop Play obtains pointer lock");
await page.evaluate(() => {
  __arena.game.bots.update = () => {};
});
// Compare actual browser input effects rather than merely checking key-handler state.
const beforeMove = await page.evaluate(() => ({
  x: __arena.game.player.x,
  z: __arena.game.player.z,
}));
await page.keyboard.down("KeyW");
await page.waitForTimeout(300);
await page.keyboard.up("KeyW");
const afterMove = await page.evaluate(() => ({
  x: __arena.game.player.x,
  z: __arena.game.player.z,
}));
assert.ok(
  Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z) > 0.1,
);
await page.mouse.down();
await page.waitForTimeout(420);
await page.mouse.up();
assert.ok(await page.evaluate(() => __arena.game.player.ammo[0].mag < 30));
results.push("Desktop movement and automatic fire");
await page.screenshot({ path: "artifacts/game-desktop.png" });
await page.keyboard.press("KeyR");
await page.waitForFunction(
  () => __arena.game.player.ammo[0].mag === 30,
  {},
  { timeout: 10000 },
);
assert.equal(await page.evaluate(() => __arena.game.player.ammo[0].mag), 30);
results.push("Reload completes");
await page.keyboard.press("Digit2");
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => __arena.game.player.weapon), 0);
await page.keyboard.press("Digit3");
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => __arena.game.player.weapon), 2);
results.push("Keyboard switches to the class sidearm and rejects foreign guns");
await page.evaluate(() => {
  const p = __arena.game.player;
  Object.assign(p, { x: -18, z: -13, yaw: 1.85, pitch: -0.03 });
  __arena.input.dx = __arena.input.dy = 0;
});
await page.waitForTimeout(250);
await page.screenshot({ path: "artifacts/game-desktop.png" });
await page.evaluate(() => document.exitPointerLock());
await page.waitForFunction(() => __arena.game.match.state === "paused");
// Capture the timer before waiting to prove pointer-lock loss stops simulation.
const pausedTime = await page.evaluate(() => __arena.game.match.remaining);
await page.waitForTimeout(300);
assert.equal(
  await page.evaluate(() => __arena.game.match.remaining),
  pausedTime,
);
results.push("Lost pointer lock pauses simulation and input");
await page.click("#resume");
await page.waitForFunction(() => document.pointerLockElement !== null);
// Isolate combat targets, but exercise the real weapon, damage and match systems.
await page.evaluate(() => {
  const g = __arena.game;
  g.bots.update = () => {};
  for (const a of g.actors) a.alive = false;
  for (const id of [0, 5]) g.spawns.spawn(g.actors[id]);
  Object.assign(g.player, {
    x: -5,
    z: -15,
    yaw: Math.PI / 2,
    pitch: 0,
    weapon: 0,
    cooldown: 0,
    shield: 0,
  });
  Object.assign(g.actors[5], { x: 5, z: -15, shield: 0, hp: 26 });
  g.weapons.fire(g.player, Math.PI / 2, 0, 0);
});
assert.equal(await page.evaluate(() => __arena.game.match.scores[0]), 1);
assert.equal(await page.evaluate(() => __arena.game.actors[5].alive), false);
results.push("Hitscan kill updates live score");
await page.evaluate(() => {
  const g = __arena.game;
  g.player.shield = 0;
  g.damage.apply(g.player, 100, g.actors[6]);
});
await page.waitForTimeout(100);
assert.equal(await page.locator("#death").isVisible(), true);
await page.waitForFunction(
  () => __arena.game.player.alive,
  {},
  { timeout: 10000 },
);
assert.equal(await page.evaluate(() => __arena.game.player.alive), true);
results.push("Player death overlay and timed respawn");
await page.evaluate(() => {
  const g = __arena.game;
  g.match.scores = [29, 5];
  const enemy = g.actors[5];
  Object.assign(g.player, {
    x: -5,
    z: -15,
    yaw: Math.PI / 2,
    pitch: 0,
    weapon: 0,
    cooldown: 0,
  });
  Object.assign(enemy, { x: 5, z: -15, y: 0, alive: true, shield: 0, hp: 26 });
  __arena.input.fire = true;
});
try {
  await page.waitForSelector("#end:not([hidden])");
} catch (e) {
  console.log(
    await page.evaluate(() => ({
      p: __arena.game.player,
      enemy: __arena.game.actors[5],
      match: __arena.game.match,
      input: { fire: __arena.input.fire, keys: [...__arena.input.keys] },
    })),
  );
  await browser.close();
  throw e;
}
assert.equal(await page.locator("#winner").textContent(), "CYAN WINS");
await page.screenshot({ path: "artifacts/match-end.png" });
await page.click("#restart");
await page.waitForFunction(() => document.pointerLockElement !== null);
assert.deepEqual(await page.evaluate(() => __arena.game.match.scores), [0, 0]);
results.push("30-point victory and instant restart");
// Graphics context recovery.
await page.evaluate(() => {
  const ext = __arena.renderer.gl.getExtension("WEBGL_lose_context");
  window.testExtension = ext;
  ext.loseContext();
});
await page.waitForFunction(() => __arena.game.match.state === "paused");
await page.waitForTimeout(150);
await page.evaluate(() => testExtension.restoreContext());
await page.waitForFunction(() =>
  document.querySelector("#pauseReason").textContent.includes("restored"),
);
await page.click("#resume");
await page.waitForFunction(() => document.pointerLockElement !== null);
results.push(
  "WebGL context loss pauses and restoration rebuilds GPU resources",
);
// Sample a short unthrottled run: software-renderer figures are not device targets.
// Sample rendering separately from gameplay assertions; SwiftShader timing is diagnostic only.
const perf = await page.evaluate(async () => {
  const a = __arena,
    frames = [],
    start = performance.now();
  let last = start;
  await new Promise((resolve) => {
    const step = (now) => {
      frames.push(now - last);
      last = now;
      if (now - start < 3000) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  frames.sort((a, b) => a - b);
  return {
    renderer: a.renderer.gl.getParameter(
      a.renderer.gl.getExtension("WEBGL_debug_renderer_info")
        .UNMASKED_RENDERER_WEBGL,
    ),
    frames: frames.length,
    meanFps: Math.round(frames.length / ((performance.now() - start) / 1000)),
    p95FrameMs: frames[Math.floor(frames.length * 0.95)],
    drawCalls: a.renderer.drawCalls,
    renderScale: a.quality.scale,
    geometryBoxes: a.game.arena.boxes.length,
    navigationNodes: a.game.nav.nodes.length,
    pathCache: a.game.nav.cache.size,
    heap: performance.memory
      ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
        }
      : null,
  };
});
await context.close();
// Android-shaped Chromium context, including real multi-touch CDP input.
const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  }),
  mp = await mobile.newPage();
mp.on("pageerror", (e) => errors.push(e.message));
await mp.goto(base + "/?debug=1");
await mp.waitForFunction(() => !!window.__arena);
assert.equal(await mp.evaluate(() => __arena.input.touch), true);
await mp.locator("#play").tap();
await mp.waitForFunction(() => __arena.input.active);
assert.equal(await mp.locator("#touch").isVisible(), true);
await mp.evaluate(() => {
  __arena.game.bots.update = () => {};
  __arena.game.player.shield = 100;
});
await mp.screenshot({ path: "artifacts/game-mobile.png" });
const cdp = await mobile.newCDPSession(mp),
  joy = await mp.locator("#joystick").boundingBox(),
  fire = await mp.locator("#fire").boundingBox();
let points = [
  { x: joy.x + joy.width / 2, y: joy.y + joy.height / 2, id: 1 },
  { x: 470, y: 110, id: 2 },
  { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 3 },
];
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: points,
});
points[0].y -= 28;
points[1].x += 50;
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: points,
});
await mp.waitForTimeout(350);
// Inspect all touch axes/buttons together to prove simultaneous pointers remain independent.
const multi = await mp.evaluate(() => ({
  move: __arena.input.moveY,
  yaw: __arena.game.player.yaw,
  ammo: __arena.game.player.ammo[0].mag,
}));
assert.ok(multi.move > 0.5);
assert.ok(multi.ammo < 30);
assert.ok(Math.abs(multi.yaw - Math.PI / 2) > 0.05);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
assert.equal(await mp.evaluate(() => __arena.input.moveY), 0);
results.push(
  "Mobile detects touch; simultaneous joystick + camera + fire; release clears input",
);
await mp.locator("#switch").tap();
await mp.waitForTimeout(100);
assert.equal(await mp.evaluate(() => __arena.game.player.weapon), 2);
await mp.locator("#aim").tap();
await mp.waitForTimeout(100);
assert.equal(await mp.evaluate(() => __arena.game.player.aim), true);
await mp.locator("#crouch").tap();
await mp.waitForTimeout(100);
assert.equal(await mp.evaluate(() => __arena.game.player.crouched), true);
results.push("Touch weapon, aim and crouch buttons");
await mp.setViewportSize({ width: 390, height: 844 });
await mp.waitForSelector("#rotate:not([hidden])");
assert.equal(await mp.evaluate(() => __arena.game.match.state), "paused");
await mp.screenshot({ path: "artifacts/rotate-mobile.png" });
await mp.setViewportSize({ width: 844, height: 390 });
await mp.waitForSelector("#rotate[hidden]", { state: "attached" });
results.push("Portrait rotate prompt pauses combat");
await mp.waitForFunction(() => navigator.serviceWorker.controller !== null);
// Disable networking only after the worker controls the page, then verify a complete offline reload.
await mobile.setOffline(true);
await mp.reload();
await mp.waitForFunction(() => !!window.__arena);
assert.equal(await mp.locator("#play").isEnabled(), true);
results.push("Offline reload from service-worker cache");
await mobile.close();
await browser.close();
assert.deepEqual(errors, []);
await writeFile(
  "artifacts/browser-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      results,
      errors,
      performance: perf,
      caveat:
        "Headless Chromium with SwiftShader; mobile emulation is not a physical Android performance measurement.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ results, errors, performance: perf }, null, 2));
