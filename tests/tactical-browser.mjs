import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
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
  await page.goto("http://localhost:8080/?debug=1");
  await page.waitForFunction(() => !!window.__arena);
  await page.click("#play");
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.evaluate(() => {
    const g = __arena.game;
    g.bots.update = () => {};
    Object.assign(g.player, { x: -15, z: -15, yaw: Math.PI / 2, pitch: 0 });
  });
  const before = await page.evaluate(() => {window.mouseLog=[];document.addEventListener("mousemove",e=>mouseLog.push({x:e.movementX,y:e.movementY,trusted:e.isTrusted}));return __arena.game.player.yaw;});
  await page.mouse.move(660, 370);
  await page.mouse.move(710, 390, {steps: 5});
  await page.waitForTimeout(300);
  console.log(await page.evaluate(()=>({events:mouseLog,input:{active:__arena.input.active,dx:__arena.input.dx},state:__arena.game.match.state,yaw:__arena.game.player.yaw,lock:!!document.pointerLockElement})));
  await page.waitForFunction(
    (before) => Math.abs(__arena.game.player.yaw - before) > 0.01,
    before,
  );
  await page.mouse.down({ button: "right" });
  await page.waitForFunction(() => __arena.game.player.aim);
  await page.mouse.up({ button: "right" });
  await page.evaluate(() => {
    const p = __arena.game.player;
    p.yaw = Math.PI / 2;
    p.pitch = 0;
    __arena.input.dx = __arena.input.dy = 0;
  });
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForFunction(() => __arena.game.player.sprinting);
  await page.keyboard.down("KeyC");
  await page.waitForFunction(() => __arena.game.player.sliding);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => !__arena.game.player.sliding);
  assert.ok(await page.evaluate(() => __arena.game.player.slideCooldown > 0));
  await page.keyboard.up("KeyC");
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await page.evaluate(() => {
    const g = __arena.game;
    Object.assign(g.player, {
      x: -12,
      z: -15,
      y: 0,
      yaw: Math.PI / 2,
      pitch: 0,
      eye: 1.58,
    });
    for (const a of g.actors) a.alive = false;
    g.player.alive = true;
    for (const [id, z] of [
      [1, -16],
      [5, -14],
    ])
      Object.assign(g.actors[id], {
        alive: true,
        x: -8,
        z,
        y: 0,
        yaw: -Math.PI / 2,
        moving: false,
        shield: 0,
      });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/voxel-characters.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: captured mouse aim, right-button ADS, keyboard sprint-slide-cancel, voxel renderer; no page errors.",
  );
} finally {
  await browser.close();
}
