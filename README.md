# Crosscurrent — Yard 07

A Yard 07 squad lobby and browser FPS with offline training and private multiplayer. The lobby reuses the game's shared anime-inspired character builder and industrial arena geometry through bundled Three.js, with the same teal, mint and orange menu palette. No account or remote asset download is required. Offline training puts one human and four Cyan bots against five Ember bots.

## Squad lobby

The root page opens the new responsive command deck. Choose Assault, Engineer, Support, or Recon; inspect weapons by dragging, scrolling, or using arrow keys on the focused preview; customize optics, barrels, and finishes; and save three loadouts. Roster readiness, local chat with simulated replies, mode selection, cancelable matchmaking, daily drills, demo XP, audio, and reduced-motion preferences are interactive. Progress and loadouts persist on this browser.

All squadmates, rankings, matchmaking, ping, and progression are explicitly simulated. **Conquest** is playable offline on FreeDM Outpost, an adaptation of the BSD-licensed FreeDM MAP01 layout downloaded from the internet. **Team Deathmatch** remains playable on Yard 07. Domination is a lobby preview; matchmaking stays simulated. Recon maps to that arena's legacy Scout class. New weapon variants and attachment ratings are lobby previews, not new combat implementations. Models are original anime-inspired procedural geometry: expressive layered eyes, tapered faces, class-specific hair, fitted jackets and matching first-person gloves. Team-colored chest panels and sleeves preserve Cyan/Ember identification. Hitboxes and combat rules are unchanged.

Run `npm run test:lobby` against the preview server to exercise the interface. The yard backdrop is rendered from `src/world.js`; squad characters come from `src/characters.js`.

The lobby skips rendering offscreen 3D canvases. With reduced motion enabled in Operator Settings (or your system preferences), static previews render only after changes, including dragging, zooming, model selection, and resizing. This also avoids repeated shadow-map calculations while idle. Run `npm run test:lobby-performance` against the preview server to verify these paths.

## Play locally

- **PyCharm:** run `main.py`. It serves the production build and opens the browser. No Python packages are needed.
- **Node:** run `npm run preview`, then open **http://localhost:8080**. The checked-in `dist/` is ready to serve; installing npm packages is unnecessary for preview.
- If port 8080 is occupied, use `python main.py --port 8081` or `PORT=8081 npm run preview` (PowerShell: `$env:PORT=8081; npm run preview`).
- A `file://` URL is not supported. Use any ordinary static HTTP server.

Choose Conquest in the lobby and click **Play Offline Conquest**, then **Play Match**. For Team Deathmatch, choose that mode or switch modes in the arena setup. Desktop play captures the mouse; Escape pauses and releases it. Touch controls are detected automatically. Rotate phones/tablets into landscape for training; the lobby also supports portrait.

## Play with friends (private multiplayer)

The **Play with Friends** link opens real multiplayer for **Conquest** and **Team Deathmatch**. Rooms support up to **10 humans**, five per team; bots fill empty slots. The server runs movement, shooting, ammo, damage, respawns, scores and capture rules. Choose your callsign, class, starting weapon and team before joining. Room hosts start/restart matches; hosting transfers to a remaining player if the host leaves. Escape opens your personal menu while everyone else's match continues. Leaving a room restores a bot; empty rooms are removed.

### Free hosting on your computer / same Wi-Fi

1. Download or clone this repository and install **Node.js 20 or newer**. Run the next command from the repository folder. The checked-in production build and server require no npm package installation.
2. Run `npm run multiplayer` (Windows PowerShell: `npm.cmd run multiplayer`). Keep that terminal and computer running.
3. Open `http://localhost:8080`, click **Play with Friends**, choose a mode and loadout, then **Create Room**.
4. Friends on the same network open the **Friends on your Wi-Fi** address printed by the server, for example `http://192.168.1.20:8080`. If the server cannot list interfaces, find your computer's local IPv4 address in network settings. Allow Node through your firewall for the local network if necessary.
5. Send friends your room code. They choose Cyan or Ember and click **Join Room**. A full team requires choosing the other team. The host clicks **Start Shared Match**, then everyone clicks **Enter Shared Match**.

You do not need a paid server for LAN play. A link containing `localhost` works only on the hosting computer; send friends the link from the LAN address instead. Clipboard copying on plain LAN HTTP may be unavailable, so the copy button displays the full invite URL as a fallback. Browser mouse capture also has drag-aim fallback; touch controls work in landscape.

Use `PORT=8081 npm run multiplayer` to change the port (PowerShell: `$env:PORT=8081; npm.cmd run multiplayer`). `HOST=127.0.0.1` restricts access to this computer; the default is `0.0.0.0` for LAN access. `main.py` and `npm run preview` remain static/offline servers and cannot run multiplayer.

### Friends outside your Wi-Fi

Run this same Node server on a computer reachable by your friends, or a Node-capable host. Serve the game and `/api/` on the **same origin**; static-only hosting, including GitHub Pages, cannot run the match server. An internet deployment should use HTTPS through a reverse proxy, with response buffering disabled for `/api/events` (`proxy_buffering off` in nginx), because it streams snapshots continuously. A private VPN connecting friends to your computer is another way to reach a self-hosted server. Keep the host running throughout the match. Hosting costs depend on the service you choose; the game itself has no multiplayer subscription.

This first multiplayer version uses 60 Hz server simulation, 20 Hz snapshots, and up to 30 input requests per second over persistent HTTP connections. Sessions are random credentials held in memory, controls stop after 350 ms without input, and the client disconnects if snapshots stop. Room codes are invitation codes, not user accounts or password-protected lobbies. Rooms vanish when empty or when the server restarts. Inactive players are disconnected after five minutes, even if neutral heartbeat requests continue; remaining players inherit hosting and vacant slots become bots. Set `IDLE_TIMEOUT_MS` to a positive number of milliseconds to change this timeout. Remote player poses interpolate through a 100 ms snapshot buffer, with immediate snaps for respawns and large position jumps. Local camera and combat state remain authoritative. There is no cross-server room discovery, voice chat, persistence, client prediction or lag compensation; low-latency LAN play is the intended first use. Multiplayer requires a live server; offline training remains available separately.

After source changes, run `npm ci` and `npm run build` before restarting the server. `npm test` includes shared-match and HTTP transport regressions. `npm run test:multiplayer` starts its own test server and exercises two browser clients plus touch TDM (requires Playwright Chromium).

## Conquest

Play `arena.html?mode=conquest` directly or select Conquest in the lobby. Both the direct play button and simulated queue launch the selected playable mode. The arena mode selector also switches between Conquest and Team Deathmatch.

- Offline 5v5: you and four Cyan bots against five Ember bots.
- Three sectors, A / West Depot, B / Central Yard, and C / East Relay. Stay within 3.2 meters with line of sight to the flag to capture. Dead actors and actors above the capture zone cannot capture.
- A neutral flag takes 8 seconds. An enemy flag takes 5 seconds to neutralize, then 8 seconds to capture. Both teams present means contested: progress stops. Unopposed defenders or an empty zone slowly erase unfinished progress.
- Each team starts with 150 tickets. Every death consumes one ticket. Every two seconds, the team holding fewer sectors loses tickets equal to the ownership difference. Contested flags retain their existing owner until neutralized.
- Zero tickets ends the match. At the selected time limit, the team with more tickets wins; equal tickets draw. Restart resets tickets, ownership, progress, and actors. Respawn remains three seconds.
- Bots choose capture and defense objectives, navigate the map, and fight while advancing. HUD cards show owner, contested/capture progress, distance, and direction; colored world flags show the capture area.

Map provenance, the original WAD, BSD license, and credits are in `assets/maps/freedm/`. This adaptation retains the sampled layout, flattens heights and opens doors for the lightweight box renderer; original Doom textures/mechanics are not imported. The map is bundled locally and works offline. Reproduce it with `npm run import:conquest-map`; verify with `npm run test:conquest`.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD | Left joystick |
| Look | Mouse | Drag the right side |
| Fire | Left mouse | Hold FIRE; tap for pistol |
| Aim down sights | Hold right mouse | Toggle ADS |
| Reload | R | RLD |
| Jump | Space | JUMP |
| Sprint | Shift while moving | Push joystick fully forward |
| Crouch / slide | C or Ctrl; press while sprinting to slide | SLIDE; tap while sprinting to slide |
| Slide cancel | Space during a slide | JUMP during a slide |
| Switch weapon | Class primary key (below), 3 for pistol, or pause to choose | SWAP between primary/pistol, or pause to choose |
| Pause | Escape or pause icon | Pause icon |

## Class loadouts

The proposed large-scale Assault/Engineer/Support/Recon weapon-role system is specified in [WEAPON_ROLE_DESIGN.md](WEAPON_ROLE_DESIGN.md). Its tuning and new mechanics are a design target; the playable prototype below still uses the current Scout-based loadouts.

Choose a class before starting a match. Each class carries its assigned primary plus the shared pistol:

| Class | Primary | Desktop key | Sidearm |
|---|---|---|---|
| Assault | Assault rifle | 1 | Pistol (3) |
| Support | LMG | 5 | Pistol (3) |
| Engineer | SMG | 2 | Pistol (3) |
| Scout | Marksman rifle | 4 | Pistol (3) |

The class and starting weapon are saved locally. The start and pause menus show only the two assigned weapons; keyboard and touch switching enforce the same inventory. Respawning preserves the class and equipped weapon and refills only that class's ammunition. Bots use the same restrictions. Return to the start menu to change class for a new match. Classes currently determine weapons; there are no extra gadgets or class abilities.

## Armory and customization

The first-person weapons use original low-poly meshes with shaped receivers, stocks, grips, magazines, round barrels, rails, and sights. These are recognizable firearm-inspired game models, not licensed replicas. The live armory preview shows the selected weapon and finish. Choose graphite, desert sand, or olive; factory, reflex, or scope sights (cosmetic); a callsign; crosshair color; and a 65-105 degree field of view. The marksman rifle retains its scope. Match rules allow 15/30/50 kills and 3/7/10 minutes. Customization is saved locally and match rules apply when starting or restarting a match.

## Reload animation

Reloads now animate a gloved support hand, magazine removal/reinsertion, and a canted weapon pose. The pistol slide stays back during an empty reload; empty rifle reloads animate the charging handle. The LMG uses an ammo-box, feed-belt, and hinged-cover sequence. Partial reloads skip the empty-chamber action. Mechanical sounds follow the reload phases. Animations use the gameplay reload timer, pause with the match, cancel on weapon changes, and return to the ready pose on completion or respawn. These are stylized animations for the fictional game weapons.

## Tactical movement update

Mouse movement aims the camera; holding right mouse aims down sights with reduced sensitivity. Click Play/Resume to capture the mouse. If browser capture is denied or unavailable, hold right mouse and drag to aim; the HUD displays this fallback. Escape pauses, and Resume retries capture. Using a mouse on a hybrid touch laptop selects desktop controls even during a match.

Sprint forward with Shift, then press C or Ctrl to slide. The slide lasts up to 0.8 seconds, decelerates from 9.4 to 3.4 units/second, and preserves its entry direction while you aim freely. Press Space to cancel into a short hop. On mobile, push the stick fully forward, tap SLIDE, then tap JUMP to cancel. Holding crouch cannot repeatedly trigger slides. Walls stop slides and low ceilings prevent standing through cover.

A 0.65-second slide cooldown, 0.14-second sprint-to-fire delay, 0.12-second slide-exit weapon delay, disabled ADS during slides, and increased sliding hip-fire spread give movement tactical tradeoffs. Respawn clears movement state. These are original tuned mechanics inspired by the tactical FPS genre, not a recreation of a specific Call of Duty version. Characters use original voxel proportions, cubic heads, square faces, block arms and legs; no Minecraft assets are used.

## Rules and mechanics

- Team Deathmatch: 5v5, one point per kill, first to 30, seven-minute timer; highest score at timeout wins and equal scores draw.
- Three-second respawn, unlimited respawns, no friendly fire. Teammates block shots.
- 100 HP. Regenerate 8 HP/second after six seconds without damage.
- A 1.5-second spawn shield ends as soon as the actor fires. Spawn selection favors distance from enemies and avoids occupied friendly spawns.
- Five data-driven weapons: 30-round assault rifle, 30-round SMG, 12-round semi-automatic pistol, 10-round marksman rifle, and 60-round LMG. Choose a class and one of its assigned weapons in the menu; these choices are saved locally. The pause menu lets you switch between that class's primary and pistol without refilling ammo. Finite reserve ammo, reload delays, range falloff, spread, recoil, ADS, and weapon switching. Ammo resets on respawn. Switch weapons if reserves run out.
- Nine bots with Easy/Normal/Hard reaction, aim and movement parameters. Staggered perception and cached graph routes. Full bot-only simulation is supported internally for tests.
- Match results show team scores and all ten players' kills/deaths. Restart begins immediately without downloading anything.

## Development and production

Requires Node 20+ for development tools:

On Windows PowerShell, if script execution policy blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` for the commands below. No policy change is needed.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Development runs at `http://localhost:5173`; production preview runs at `http://localhost:8080`. Separate ports keep a production service worker from serving stale files during source editing. Close old game tabs before reopening the production preview to activate an updated build.

`npm run build` bundles and minifies JavaScript with esbuild, minifies CSS, versions the service-worker cache, and writes `dist/`. The build also emits gzip and Brotli sidecars. **Development dependencies and the test browser are never included in the deployed game.** See `dist/build-info.json` for exact sizes and content version.

Upload the **contents of `dist/`** to a static host. Both root and subdirectory hosting use relative paths. Serve `.js` as JavaScript, `.css` as CSS, and `.html` as HTML. On servers that support precompressed files, enable gzip/Brotli content negotiation and `Vary: Accept-Encoding`; otherwise the normal files work unchanged. Do not link directly to `.gz`/`.br` files. Serve `sw.js` and `index.html` with revalidation so upgrades are detected.

Offline gameplay works immediately after loading. Offline **page reloads** require a completed service-worker install on HTTPS or localhost. HTTP LAN addresses can play without an internet connection while the local server remains available, but do not have service-worker offline reload support. Browser cache eviction can remove offline data. New versions activate once old game tabs close, preventing a running match from mixing versions.

No public host/account has been selected or deployed by this project.

## Architecture

| Module | Responsibility |
|---|---|
| `src/main.js` | Bootstrap, lifecycle, pause/menu flow, fixed 60 Hz update loop |
| `src/game.js` | OfflineSimulation: orchestration and authority boundary |
| `src/input.js` | InputManager and simultaneous pointer-ID touch controls |
| `src/player.js` | Mouse camera and action input |
| `src/movement.js` | Sprint, slide/cancel, crouch clearance, gravity and recovery timing |
| `src/characters.js` | Original instanced voxel character parts |
| `src/weapons.js` | Weapon data, hitscan, magazine lifecycle, fixed effect pool |
| `src/match.js` | TeamDeathmatch rules, roster, damage, spawning, compact snapshots |
| `src/world.js` | Procedural map, collisions, line of sight, cached navigation |
| `src/bots.js` | Staggered perception, navigation, aiming and combat |
| `src/renderer.js` | WebGL 2 instancing, shaders, viewmodel and context recreation |
| `src/hud.js` | HUD, kill feed, death countdown and result table |
| `src/settings.js` | Persisted settings, adaptive quality and synthesized audio |
| `sw.js` | Same-origin offline cache; generated asset list in production |

The simulation owns ammo, damage, scores and respawns; rendering never decides hits. `snapshot()` provides quantized compact actor state for a later transport. Online play is **not implemented**. A future implementation should move the simulation to an authoritative server, transmit sequenced input commands, validate fire/movement there, and add interpolation/reconciliation. Do not trust client-reported damage or snapshot coordinates.

## Performance choices

- WebGL 2 baseline; no WebGPU requirement. One simple directional-light term plus ambient shading, fog, no textures, no postprocessing, no shadow maps, no anti-aliasing, no physics engine.
- Shared cube mesh for instanced environment and actors, plus a dedicated triangle mesh for each first-person weapon: one environment draw, one actor/effect draw, one viewmodel draw. 133 static instances on Yard 07; 245 on FreeDM Outpost. GPU clipping plus conservative CPU culling of characters behind the view.
- Low/Medium/High use 65% / 90% / 115% CSS-pixel render scale. Device pixel ratio is deliberately not multiplied in, avoiding excessive rendering on high-DPI phones.
- Low omits character ground shadows; Medium/High use inexpensive stylized ground shadow geometry. These are not physically accurate shadow maps. High also raises effect capacity. Texture/filtering presets are unnecessary because there are no textures.
- Auto quality responds to sustained slow samples by reducing scale and effect count, then ground shadows. It recovers slowly with sustained headroom. Minimum scale: 45% / 55% / 60%.
- Gameplay always uses 1/60-second simulation steps, independent of resolution. Long browser stalls are capped at 250 ms of catch-up to avoid an unbounded spiral; this is an offline prototype, so extreme stalls can slow match time relative to wall time.
- Navigation has 326 nodes on Yard 07 and 1,015 on FreeDM Outpost, a 256-entry cache bound and staggered perception. Neighbor lookup uses a coordinate index instead of comparing every pair of nodes. Effects use 48 reused slots. Dynamic instance buffers are reused. Short-lived audio voices are capped at 12 and disconnected on completion.
- HUD updates at 20 Hz. Menus render at 10 Hz. Hidden tabs stop simulation and rendering; focus loss pauses the match.

## Verification

```sh
npm test                       # gameplay, settings, and service-worker regressions
npx playwright install chromium
npm run preview                # leave running in another terminal
npm run test:browser            # desktop, mobile, tactical controls, mouse-capture fallbacks
npm run test:tactical           # tactical controls only; also respects TEST_URL
```

The browser suite covers pointer lock, movement, shooting, reload, weapon switching, score updates, player death/respawn, a 30-kill victory, restart, graphics loss/recovery, real simultaneous touch events, portrait pausing, and cached offline reload. It writes screenshots and `artifacts/browser-results.json`. The `?debug=1` query exposes opt-in inspection hooks solely for testing; normal URLs do not expose them.

See [VALIDATION.md](VALIDATION.md) for measured results and outstanding physical-device checks. Software-renderer FPS is not evidence of Android or integrated-GPU performance. The requested 30–60 FPS device targets still need physical hardware validation.
