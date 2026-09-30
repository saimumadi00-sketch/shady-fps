import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createMultiplayerServer } from "../server/index.mjs";
import { mkdir } from "node:fs/promises";
const app = createMultiplayerServer();
await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${app.server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [];
try {
  await mkdir("artifacts", { recursive: true });
  const hostContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const friendContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const host = await hostContext.newPage(),
    friend = await friendContext.newPage();
  for (const page of [host, friend])
    page.on("pageerror", (e) => errors.push(e.message));
  await host.goto(base + "/arena.html?online=1&mode=conquest&debug=1");
  await host.waitForFunction(() => !!window.__arena);
  await host.fill("#callsign", "Host");
  await host.click("#createRoom");
  await host.waitForFunction(() => __arena.network?.ready);
  const code = await host.inputValue("#roomCode");
  assert.match(code, /^[A-F0-9]{8}$/);
  await friend.goto(
    base + `/arena.html?online=1&mode=conquest&room=${code}&debug=1`,
  );
  await friend.waitForFunction(() => !!window.__arena);
  await friend.fill("#callsign", "Friend");
  await friend.selectOption("#roomTeam", "1");
  await friend.selectOption("#loadoutClass", "scout");
  await friend.click("#joinRoom");
  await friend.waitForFunction(() => __arena.network?.ready);
  await host.waitForFunction(() =>
    document.querySelector("#roomRoster").textContent.includes("Friend"),
  );
  assert.equal(await friend.locator("#startRoom").isVisible(), false);
  await host.click("#startRoom");
  await host.waitForFunction(() => !document.querySelector("#play").disabled);
  await host.click("#play");
  await friend.waitForFunction(() => !document.querySelector("#play").disabled);
  await friend.click("#play");
  await friend.waitForSelector("#objectives > div");
  assert.equal(await friend.evaluate(() => __arena.game.player.id), 5);
  assert.equal(await friend.evaluate(() => __arena.game.player.weapon), 3);
  assert.equal(await host.locator("#objectives > div").count(), 3);
  const room = app.service.rooms.get(code),
    g = room.game;
  g.bots.update = () => {};
  for (const a of g.actors)
    if (!room.controllers.has(a.id)) {
      a.alive = false;
      a.respawn = 9999;
    }
  // Exercise real browser controls from the Ember slot, not only the original local player.
  await friend.bringToFront();
  await friend.evaluate(() => {
    __arena.input.active = true;
    __arena.input.keys.add("KeyW");
  });
  const before = { x: g.actors[5].x, z: g.actors[5].z };
  await friend.waitForTimeout(250);
  await friend.evaluate(() => __arena.input.keys.clear());
  assert.ok(
    Math.hypot(g.actors[5].x - before.x, g.actors[5].z - before.z) > 0.1,
  );
  await host.waitForFunction(() => __arena.game.actors[5].name === "Friend");
  assert.ok(
    Math.hypot(
      (await host.evaluate(() => __arena.game.actors[5].x)) - g.actors[5].x,
      (await host.evaluate(() => __arena.game.actors[5].z)) - g.actors[5].z,
    ) < 0.5,
  );
  await friend.evaluate(() => {
    __arena.input.active = true;
    __arena.input.actions.add("fire");
    __arena.input.fire = true;
  });
  await friend.waitForFunction(() => __arena.game.player.ammo[3].mag < 10);
  await friend.evaluate(() => (__arena.input.fire = false));
  // Both pages must observe the actual server capture and subsequent ticket bleed.
  const sector = g.match.sectors[0];
  Object.assign(g.actors[0], { x: sector.x, z: sector.z, y: 0 });
  await host.waitForFunction(
    () => __arena.game.match.sectors[0].owner === 0,
    {},
    { timeout: 20000 },
  );
  await friend.waitForFunction(() => __arena.game.match.sectors[0].owner === 0);
  await friend.waitForFunction(() => __arena.game.match.scores[1] < 150);
  assert.equal(
    await friend
      .locator("#objectives > div")
      .first()
      .getAttribute("data-owner"),
    "cyan",
  );
  // Escape releases only this client: the server clock and the friend's stream continue.
  await friend.evaluate(() => __arena.pause());
  const remaining = g.match.remaining;
  await friend.waitForTimeout(400);
  assert.ok(g.match.remaining < remaining - 0.2);
  assert.equal(await friend.evaluate(() => __arena.input.active), false);
  assert.equal(g.match.state, "playing");
  await friend.click("#resume");
  await friend.waitForFunction(() => __arena.input.active);
  await friend.screenshot({ path: "artifacts/multiplayer-conquest.png" });
  assert.equal(await friend.evaluate(() => __arena.renderer.gl.getError()), 0);
  g.match.scores = [4, 0];
  g.match.finish();
  await friend.waitForSelector("#end:not([hidden])");
  await host.waitForSelector("#end:not([hidden])");
  assert.equal(await friend.locator("#restart").isDisabled(), true);
  await host.click("#restart");
  await friend.waitForSelector("#menu:not([hidden])");
  await friend.waitForFunction(() => __arena.game.match.state === "playing");
  assert.equal(g.match.scores[0], 150);
  assert.equal(g.actors[5].classId, "scout");
  await hostContext.close();
  await friend.waitForFunction(() => __arena.network.host);
  assert.equal(room.controllers.has(0), false);
  await friendContext.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(app.service.rooms.size, 0);
  // Also exercise TDM through the same public room flow on a touch client.
  const touch = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await touch.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(base + "/arena.html?online=1&mode=tdm&debug=1");
  await mobile.waitForFunction(() => !!window.__arena);
  await mobile.click("#createRoom");
  await mobile.waitForFunction(() => __arena.network.ready);
  await mobile.click("#startRoom");
  await mobile.waitForFunction(() => !document.querySelector("#play").disabled);
  await mobile.click("#play");
  await mobile.waitForSelector("#touch:not([hidden])");
  assert.equal(await mobile.evaluate(() => __arena.game.mode), "tdm");
  await mobile.screenshot({ path: "artifacts/multiplayer-touch.png" });
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(
    "Multiplayer browser: two players, both teams, movement/fire, shared capture/tickets, local pause, results/restart, host transfer, cleanup and touch TDM passed.",
  );
} finally {
  await browser.close();
  app.close();
}
