// Offline asset installation and scope-isolated cache lifecycle for development and production.
const CACHE = "crosscurrent-v1";
const VERSIONED = false;
// Include registration scope so separate installations on the same origin cannot delete each other.
const PREFIX = `crosscurrent:${encodeURIComponent(self.registration.scope)}:`;
const CACHE_NAME = PREFIX + CACHE;
// Development caches individual modules; the build replaces this list with bundled asset paths.
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./src/main.js",
  "./src/math.js",
  "./src/world.js",
  "./src/renderer.js",
  "./src/weapon-models.js",
  "./src/reload-animation.js",
  "./src/customization.js",
  "./src/characters.js",
  "./src/input.js",
  "./src/weapons.js",
  "./src/loadouts.js",
  "./src/match.js",
  "./src/player.js",
  "./src/movement.js",
  "./src/bots.js",
  "./src/settings.js",
  "./src/game.js",
  "./src/hud.js",
];
// Install atomically only after every required asset is cached; do not force takeover of active tabs.
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES))),
);
// Remove obsolete versions belonging to this scope, then control eligible clients.
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
// Leave non-GET and cross-origin traffic to the browser.
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  // Pin production requests to the active installed version, with network fallback for uncached resources.
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
  // Development favors fresh source and consults its own cache only when the network fails.
  e.respondWith(
    fetch(e.request).catch(() =>
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.match(e.request, { ignoreSearch: true }))
        .then((r) => r || Response.error()),
    ),
  );
});
