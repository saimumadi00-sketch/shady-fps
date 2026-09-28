# Crosscurrent — Yard 07

A complete, original offline browser FPS prototype. One human joins four Cyan bots against five Ember bots. No account, runtime dependency, external font, texture, model, or audio download is required.

## Play locally

- **PyCharm:** run `main.py`. It serves the production build and opens the browser. No Python packages are needed.
- **Node:** run `npm run preview`, then open **http://localhost:8080**. The checked-in `dist/` is ready to serve; installing npm packages is unnecessary for preview.
- If port 8080 is occupied, use `python main.py --port 8081` or `PORT=8081 npm run preview` (PowerShell: `$env:PORT=8081; npm run preview`).
- A `file://` URL is not supported. Use any ordinary static HTTP server.

Press **Play Match**. Desktop play captures the mouse; Escape pauses and releases it. Touch controls are detected automatically. Rotate phones/tablets into landscape.

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
| Switch weapon | 1 / 2 / 3 / 4 / 5, or pause to choose | SWAP, or pause to choose |
| Pause | Escape or pause icon | Pause icon |

## Armory and customization

The first-person weapons use original low-poly meshes with shaped receivers, stocks, grips, magazines, round barrels, rails, and sights. These are recognizable firearm-inspired game models, not licensed replicas. The live armory preview shows the selected weapon and finish. Choose graphite, desert sand, or olive; factory, reflex, or scope sights (cosmetic); a callsign; crosshair color; and a 65?105 degree field of view. The marksman rifle retains its scope. Match rules allow 15/30/50 kills and 3/7/10 minutes. Customization is saved locally and match rules apply when starting or restarting a match.

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
- Five data-driven weapons: 30-round assault rifle, 30-round SMG, 12-round semi-automatic pistol, 10-round marksman rifle, and 60-round LMG. Choose your starting weapon in the menu; this choice is saved locally. The pause menu lets you equip any weapon without refilling its ammo. Finite reserve ammo, reload delays, range falloff, spread, recoil, ADS, and weapon switching. Ammo resets on respawn. Switch weapons if reserves run out.
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
- Shared cube mesh for instanced environment and actors, plus a dedicated triangle mesh for each first-person weapon: one environment draw, one actor/effect draw, one viewmodel draw. 133 static instances. GPU clipping plus conservative CPU culling of characters behind the view.
- Low/Medium/High use 65% / 90% / 115% CSS-pixel render scale. Device pixel ratio is deliberately not multiplied in, avoiding excessive rendering on high-DPI phones.
- Low omits character ground shadows; Medium/High use inexpensive stylized ground shadow geometry. These are not physically accurate shadow maps. High also raises effect capacity. Texture/filtering presets are unnecessary because there are no textures.
- Auto quality responds to sustained slow samples by reducing scale and effect count, then ground shadows. It recovers slowly with sustained headroom. Minimum scale: 45% / 55% / 60%.
- Gameplay always uses 1/60-second simulation steps, independent of resolution. Long browser stalls are capped at 250 ms of catch-up to avoid an unbounded spiral; this is an offline prototype, so extreme stalls can slow match time relative to wall time.
- Navigation has 326 nodes, a 256-entry cache bound and staggered perception. Effects use 48 reused slots. Dynamic instance buffers are reused. Short-lived audio voices are capped at 12 and disconnected on completion.
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
