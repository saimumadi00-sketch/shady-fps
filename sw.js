const CACHE = "crosscurrent-v1";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./src/main.js",
  "./src/math.js",
  "./src/world.js",
  "./src/renderer.js",
  "./src/characters.js",
  "./src/input.js",
  "./src/weapons.js",
  "./src/match.js",
  "./src/player.js",
  "./src/movement.js",
  "./src/bots.js",
  "./src/settings.js",
  "./src/game.js",
  "./src/hud.js",
];
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("crosscurrent-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches
        .match(e.request, { ignoreSearch: true })
        .then((r) => r || Response.error()),
    ),
  );
});
