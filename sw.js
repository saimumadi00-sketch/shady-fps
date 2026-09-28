const CACHE = "crosscurrent-v1";
const VERSIONED = false;
const PREFIX = `crosscurrent:${encodeURIComponent(self.registration.scope)}:`;
const CACHE_NAME = PREFIX + CACHE;
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./src/main.js",
  "./src/math.js",
  "./src/world.js",
  "./src/renderer.js",
  "./src/weapon-models.js",
  "./src/customization.js",
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
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== CACHE_NAME)
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
  if (VERSIONED) {
    e.respondWith(
      caches
        .open(CACHE_NAME)
        .then(
          async (cache) =>
            (await cache.match(e.request, { ignoreSearch: true })) ||
            fetch(e.request),
        ),
    );
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() =>
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(e.request, { ignoreSearch: true }))
        .then((r) => r || Response.error()),
    ),
  );
});
