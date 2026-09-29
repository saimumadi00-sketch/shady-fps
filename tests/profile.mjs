// Synthetic bot-match soak and render timing. Forced test-only GC measures retained JS heap, not hardware performance.
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
// Software rendering makes automation portable; these samples are not physical-GPU benchmarks.
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-precise-memory-info",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.goto(
    (process.env.TEST_URL || "http://localhost:8080") + "/arena.html?debug=1",
  );
  await page.waitForFunction(() => !!window.__arena);
  const cdp = await page.context().newCDPSession(page);
  const heap = [];
  // Cumulative checkpoints at zero, ten, and forty completed matches reveal retained growth.
  for (const rounds of [0, 10, 30]) {
    const matches = await page.evaluate((rounds) => {
      const g = __arena.game;
      g.controller.update = (dt) => g.bots.update(g.player, dt);
      const scores = [];
      for (let match = 0; match < rounds; match++) {
        g.start("normal");
        let steps = 0;
        while (g.match.state === "playing" && steps++ < 25201) g.update(1 / 60);
        scores.push({
          seconds: 420 - g.match.remaining,
          score: [...g.match.scores],
        });
      }
      g.match.state = "paused";
      return {
        scores,
        pathCache: g.nav.cache.size,
        effectSlots: g.effects.items.length,
      };
    }, rounds);
    await cdp.send("HeapProfiler.collectGarbage");
    heap.push({
      additionalMatches: rounds,
      ...matches,
      heap: await cdp.send("Runtime.getHeapUsage"),
    });
  }
  await page.evaluate(() => {
    const a = __arena;
    a.input.touch = true;
    a.start();
    a.game.player.shield = 1000;
  });
  const timing = await page.evaluate(async () => {
    const a = __arena,
      frames = [];
    let last = performance.now(),
      start = last;
    await new Promise((resolve) => {
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        if (now - start < 6000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    frames.sort((a, b) => a - b);
    return {
      fps: Math.round(frames.length / ((performance.now() - start) / 1000)),
      p50Ms: frames[Math.floor(frames.length * 0.5)],
      p95Ms: frames[Math.floor(frames.length * 0.95)],
      scale: a.quality.scale,
      drawCalls: a.renderer.drawCalls,
      renderer: a.renderer.gl.getParameter(
        a.renderer.gl.getExtension("WEBGL_debug_renderer_info")
          .UNMASKED_RENDERER_WEBGL,
      ),
      actors: a.game.actors.length,
      score: a.game.match.scores,
    };
  });
  const result = {
    date: new Date().toISOString(),
    environment:
      "Headless Chromium / SwiftShader software rendering, 1280x720, ten active bots",
    heap,
    timing,
    limitations:
      "Synthetic simulation soak measures JS heap retention, not total browser/GPU memory. No physical Android or Windows performance measured.",
  };
  await writeFile("artifacts/profile.json", JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        heaps: heap.map((v) => ({
          matches: v.additionalMatches,
          used: v.heap.usedSize,
          cache: v.pathCache,
        })),
        timing,
      },
      null,
      2,
    ),
  );
  // Always release the browser, including after a failed assertion.
} finally {
  await browser.close();
}
