# Conquest validation — 2026-09-30

## Implemented behavior

Offline 5v5 Conquest is playable from the lobby's direct play action, simulated
queue, or arena mode selector. Three sectors support neutral capture, contested
capture, enemy neutralization, and recapture. Both teams start with 150 tickets;
deaths consume tickets and sector advantage drains tickets every two seconds.
Ticket exhaustion, timeout, draws, pause, respawn, and restart use the existing
match lifecycle. Bots capture and defend sectors while fighting.

The map uses the actual FreeDM v0.13.0 MAP01 layout downloaded from the official
Freedoom repository. It has 1,015 connected navigation cells and 245 static box
instances. Bases are outside capture zones, and every base has a route to every
sector. The importer flattens heights, opens doors, and samples the layout into
box geometry. This is a layout adaptation, not a full Doom map/texture renderer.
The original WAD, license, credits, and reproducible importer are included.

## Checks

- `npm test`: passes, including six Conquest regressions for map connectivity,
  capture/contest/neutralization, invalid capturers and progress decay, ticket
  scoring and winners, pause/restart, and a complete match in which both bot
  teams capture sectors.
- `npm run build`: passes; the map layout is bundled in the game and the
  production offline cache is versioned for the new build.
- `npm run test:conquest`: passes for lobby launch, actual player capture and
  ticket drain, objective HUD, movement/fire, pause, victory/restart, switching
  back to Team Deathmatch, offline reload, and landscape touch layout.
- `npm run test:lobby`: passes, including persistence, queue lifecycle, and
  offline navigation.
- The existing main Team Deathmatch browser check passes, including combat,
  respawn, simultaneous touch controls, context restoration, and offline reload.
- The existing mouse-fallback/hybrid, class-inventory, customization, armory
  preview, and reload-animation browser checks all pass individually.
- The existing tactical captured-mouse check passes in isolation but
  intermittently times out at `tests/tactical-browser.mjs:34` when run after the
  main browser check. The same sequence also fails on the pre-Conquest build
  (`808e97b`) served independently. This existing test instability prevents
  reporting an entirely clean aggregate `npm run test:browser` run.

Browser checks use headless Chromium 134 with SwiftShader software rendering.
Touch is emulated. Physical-device FPS and physical Android touch behavior have
not been measured.
