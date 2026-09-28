import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
const source = await readFile(new URL("../sw.js", import.meta.url), "utf8");
function worker(versioned, offline = false) {
  const handlers = {},
    requests = [];
  const cached = { version: "installed" };
  const context = {
    URL,
    Response,
    location: { origin: "https://game.test" },
    self: {
      registration: { scope: "https://game.test/" },
      addEventListener: (name, handler) => (handlers[name] = handler),
    },
    caches: {
      open: async (name) => {
        assert.equal(
          name,
          "crosscurrent:https%3A%2F%2Fgame.test%2F:crosscurrent-v1",
        );
        return {
          match: async (request) =>
            request.url.includes("game.js") ? cached : undefined,
        };
      },
    },
    fetch: async (request) => {
      requests.push(request.url);
      if (offline) throw new Error("offline");
      return { version: "network" };
    },
  };
  vm.runInNewContext(
    source.replace(
      "const VERSIONED = false;",
      `const VERSIONED = ${versioned};`,
    ),
    context,
  );
  return {
    requests,
    request: (url) => {
      let result;
      handlers.fetch({
        request: { method: "GET", url },
        respondWith: (value) => (result = value),
      });
      return result;
    },
  };
}
test("production worker pins cached assets to its own installed version", async () => {
  const w = worker(true);
  assert.equal(
    (await w.request("https://game.test/game.js?debug=1")).version,
    "installed",
  );
  assert.equal(w.requests.length, 0);
  assert.equal(
    (await w.request("https://game.test/other.json")).version,
    "network",
  );
  assert.equal(w.request("https://other.test/game.js"), undefined);
});
test("development worker uses fresh source and falls back offline", async () => {
  assert.equal(
    (await worker(false).request("https://game.test/game.js")).version,
    "network",
  );
  assert.equal(
    (await worker(false, true).request("https://game.test/game.js")).version,
    "installed",
  );
});

test("activating one installation preserves other installation caches", async () => {
  const handlers = {},
    deleted = [];
  const scope = "https://game.test/dist/";
  const prefix = `crosscurrent:${encodeURIComponent(scope)}:`;
  const other = "crosscurrent:https%3A%2F%2Fgame.test%2F:old";
  vm.runInNewContext(source, {
    self: {
      registration: { scope },
      clients: { claim: async () => {} },
      addEventListener: (name, fn) => (handlers[name] = fn),
    },
    caches: {
      keys: async () => [
        prefix + "old",
        prefix + "crosscurrent-v1",
        other,
        "crosscurrent-legacy",
      ],
      delete: async (name) => deleted.push(name),
    },
  });
  let completion;
  handlers.activate({ waitUntil: (p) => (completion = p) });
  await completion;
  assert.deepEqual(deleted, [prefix + "old"]);
});
