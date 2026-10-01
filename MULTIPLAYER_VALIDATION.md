# Private multiplayer validation

## Implementation

- Two playable room modes: Conquest / FreeDM Outpost and Team Deathmatch / Yard 07.
- Up to ten humans with five team slots each; empty slots use existing bot AI.
- A Node HTTP server runs the existing movement, weapon, damage, respawn and objective simulation at 60 Hz. Clients send bounded, sequenced controls at up to 30 Hz and receive presentation snapshots at 20 Hz.
- Random room codes and per-client session credentials; authenticated input/stream/start/leave; host start/restart permission and automatic host transfer.
- Personal pause clears controls while server time and other players continue. Dead/stale/disconnected controls are cleared. Empty rooms and abandoned reservations are removed.
- Room setup, roster, invite link/code, enter match, results and restart UI; desktop and touch input reuse existing controls. Offline training retains its local simulation.
- Checked-in production assets rebuilt. Multiplayer requires `npm run multiplayer`, not a static preview/Python/GitHub Pages server.

## Passed checks

- `npm test`: 47 tests, including nine new multiplayer tests.
- The new tests exercise independent human controllers on both teams, team capacity, bot replacement, separate rooms, start/restart authorization, host transfer and empty-room cleanup.
- Malformed controls, unsupported actions, nonfinite values, duplicate sequence numbers, foreign class weapons, excess input requests, untrusted positions/health/scores, invalid session credentials and cross-origin API requests are rejected or ignored.
- Shared TDM hitscan/ammo/death/score/respawn and shared Conquest contest/capture/ticket bleed/victory/restart are checked on the authoritative simulation.
- Real HTTP create/join/authenticated snapshot streaming and static serving pass. Two instances of the actual `NetworkClient` connect to a running server, stream shared positions, fire from the Ember slot, pause only their controls, receive matching results, restart and transfer hosting.
- Multiplayer API streams bypass the service worker's offline cache.
- `npm run build` passes. `PORT=8099 npm run multiplayer` starts successfully even when this environment blocks local interface enumeration.

## Browser verification limitation

`npm run test:multiplayer` could not launch Chromium in this execution environment: the browser exited with SIGTRAP before opening a page. A full Chromium binary also exited at launch. No browser UI/visual pass is claimed for this change.

The checked-in browser suite starts its own multiplayer server and covers two pages joining opposite teams, replicated movement/fire, actual shared Conquest capture and ticket bleed, personal pause, results/restart, host transfer, disconnect cleanup and mobile/touch TDM. Run it on a machine with Playwright Chromium installed:

```sh
npm ci
npx playwright install chromium
npm run build
npm run test:multiplayer
```

The first version targets low-latency LAN use. It has no client prediction, lag compensation, voice chat or persistent rooms. Internet play requires a reachable Node server; HTTPS reverse proxies must preserve the Host header and disable buffering for `/api/events`.
