# Crosscurrent — Yard 07

A browser FPS with a squad lobby, offline 5v5 against bots, and private server-authoritative multiplayer. Everything is bundled locally: no account or remote asset download is required. Characters are original anime-inspired procedural models; weapons are original low-poly meshes.

## Play locally

- **PyCharm / Python:** run `main.py`. It serves the production build and opens the browser.
- **Node:** run `npm run preview`, then open **http://localhost:8080**. The checked-in `dist/` is ready to serve; no npm install is needed.
- If port 8080 is busy: `python main.py --port 8081` or `PORT=8081 npm run preview` (PowerShell: `$env:PORT=8081; npm run preview`).
- `file://` URLs are not supported; use any static HTTP server.

The root page is the squad lobby. Pick a class, then **Play Offline Conquest** or Team Deathmatch. Desktop play captures the mouse; Escape pauses. Touch controls are detected automatically (landscape required in matches).

## Modes

**Team Deathmatch — Yard 07.** 5v5, first to 30 eliminations (15/30/50 configurable), 7-minute timer (3/7/10). Higher score at timeout wins; equal scores draw.

**Conquest — FreeDM Outpost.** An adaptation of the BSD-licensed FreeDM MAP01 layout with three sectors: A / West Depot, B / Central Yard, C / East Relay.

- Stand within 3.2 m of a flag with line of sight to capture. Neutral flags take 8 s; enemy flags take 5 s to neutralize, then 8 s to capture. Both teams present = contested, progress stops. Unattended progress decays.
- Each team starts with 150 tickets. Every death costs one. Every 2 s the team holding fewer sectors loses tickets equal to the difference. Zero tickets ends the match; at the time limit, more tickets wins.
- **Forward spawns:** you deploy beside an owned, uncontested sector when no enemy is within 20 m of it, otherwise at base. Spawns prefer points closest to sectors your team still needs. The HUD shows `DEPLOYED AT <sector>`.

Bots pick capture targets (spreading across sectors), defend, fight while advancing, and retreat to cover when wounded. Easy/Normal/Hard change reaction time, aim error, speed and perception rate.

Domination is a lobby preview only. Lobby squadmates, rankings, matchmaking and progression are simulated.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD | Left joystick |
| Look | Mouse | Drag the right side |
| Fire | Left mouse | FIRE |
| Aim down sights | Hold right mouse | ADS (toggle) |
| Reload | R | RLD |
| Jump | Space | JUMP |
| Sprint | Shift while moving forward | Push joystick fully forward |
| Crouch / slide | C or Ctrl; press while sprinting to slide | SLIDE |
| Slide cancel | Space during a slide | JUMP during a slide |
| Primary / sidearm | 1 / 2 | — |
| Swap weapon | Q or mouse wheel | SWAP |
| Pause | Escape | Pause icon |

If the browser denies mouse capture, hold right mouse and drag to aim. Slides last up to 0.8 s (9.4 → 3.4 m/s), keep their entry direction, and have a 0.65 s cooldown. **Run and gun:** every weapon fires while sprinting or sliding with no sprint-to-fire delay, and firing does not break the sprint; the hip cone widens 1.4x while sprinting and 1.7x while sliding. Aiming down sights still ends a sprint.

## Classes and weapons

Every class carries its primary (slot 1) and the shared pistol (slot 2). Class is chosen before a match; respawning keeps class and equipped weapon and refills only that class's ammunition.

| Class | Primary | Role |
|---|---|---|
| Assault | AR | Best all-round medium-range rifle |
| Engineer | SMG | Fastest handling, most accurate moving and hip fire; falls off early |
| Support | LMG | 100-round belt and fastest close TTK, but slow ADS, heavy, long reloads |
| Recon | DMR | Precise aimed fire, 2x headshots; poor hip fire and mobility |

Tuning follows [WEAPON_ROLE_DESIGN.md](WEAPON_ROLE_DESIGN.md):

| Weapon | Damage near → far | Falloff (m) | RPM | Mag | Reload partial / empty (s) | Head | Hip / ADS spread (°) | ADS (s) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AR | 28 → 18 | 20 – 80 | 650 | 30 | 2.15 / 2.65 | 1.5x | 1.7 / 0.10 | 0.22 |
| SMG | 24 → 10 | 10 – 45 | 850 | 28 | 1.80 / 2.15 | 1.5x | 1.15 / 0.16 | 0.14 |
| Pistol | 30 → 18 | 12 – 40 | 330 | 12 | 1.30 / 1.60 | 1.5x | 1.0 / 0.15 | 0.12 |
| DMR | 45 → 34 | 45 – 160 | 260 | 16 | 2.50 / 3.10 | 2x | 4.0 / 0.025 | 0.34 |
| LMG | 26 → 17 | 30 – 110 | 700 | 100 | 4.80 / 5.80 | 1.5x | 3.2 / 0.20 | 0.38 |

- Damage falls off linearly between the two distances; the head multiplier applies after falloff. Actors have separate head and body hitboxes.
- Spread is a cone that blends from hip to ADS over the weapon's ADS time and is multiplied while moving (per weapon), sprinting (1.4x), sliding (1.7x) or reduced while crouched still (0.85x).
- **Recoil patterns** (`RECOIL_PATTERNS` in `src/weapons.js`): each gun climbs in a learnable shape with a harder first kick and a fixed sideways drift plus a little random jitter. The AR pulls right, then swings left mid-magazine and steadies. The SMG zigzags tightly. The LMG kicks hard, drifts left, then settles once the belt is running. The pistol and DMR give one mostly vertical kick per shot. When you stop firing, part of the climb eases back on its own: 55% AR, 65% SMG, 75% pistol, 70% DMR, 45% LMG. Pulling the mouse down during or after a burst counts against that recovery, so the view never drops below where you put it. Offline play, the server and online client prediction all run the same rules.
- Shot feedback is presentation only and never changes hits: a camera punch that settles back, tracers, muzzle flashes on other players, sparks, dust and wall marks on impact, blood on body and head hits, ejected brass, and a hitmarker that is white for body hits, gold for headshots and red for kills (each with its own sound).
- Movement speed scales with the carried primary's weight (also while the pistol is drawn); ADS strafe speed is per weapon.
- 100 HP; regenerate 8 HP/s after 6 s without damage. 3 s respawn with a 1.5 s spawn shield that firing ends. No friendly fire; teammates block shots.

Lobby attachments, finishes and optics are cosmetic. The second weapon listed per class in the lobby is a preview variant that deploys with the class primary.

## Private multiplayer

**Play with Friends** opens shared Conquest or TDM rooms for up to 10 humans (five per team); bots fill empty slots.

1. Install **Node.js 20+** and run `npm run multiplayer` (PowerShell: `npm.cmd run multiplayer`). No npm install is needed for the checked-in build.
2. Open `http://localhost:8080`, click **Play with Friends**, choose mode and loadout, then **Create Room**.
3. Friends on the same network open the **Friends on your Wi-Fi** address the server prints (e.g. `http://192.168.1.20:8080`) and join with the room code. Allow Node through your firewall if needed.
4. The host clicks **Start Shared Match**, then everyone clicks **Enter Shared Match**.

`PORT` changes the port; `HOST=127.0.0.1` restricts to this computer; `IDLE_TIMEOUT_MS` changes the 5-minute inactivity kick. `main.py` and `npm run preview` are static servers and cannot host multiplayer. For friends outside your network, run the same server on a reachable machine with HTTPS via a reverse proxy, with response buffering disabled for `/api/events` (`proxy_buffering off` in nginx). Static hosts such as GitHub Pages cannot run matches.

**How it works.** The server runs the same simulation as offline play at 60 Hz and streams snapshots at 20 Hz. Clients send input 30 times per second (the server rejects more than 60 requests per second). The server owns movement, shooting, ammo, damage, respawns and scoring. The client owns only its **view angles**: mouse movement turns the camera immediately and the client sends absolute yaw/pitch tagged with its current life, so a late packet can never override the facing assigned at respawn. Recoil and the shot sound are predicted locally. Remote players interpolate through a 100 ms buffer. Snapshots omit other players' ammo and internal movement state.

Limits: no client-side movement prediction or lag compensation, so LAN play is the intended use. Every client receives all actor positions. Room codes are invitations, not passwords. Rooms vanish when empty or when the server restarts.

## Development

Requires Node 20+. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if script policy blocks `npm.ps1`.

```sh
npm ci
npm run dev          # source server on http://localhost:5173
npm test             # simulation, weapons, conquest, multiplayer, settings, service worker
npm run build        # bundle + minify into dist/ with gzip/Brotli sidecars
npm run preview      # production build on http://localhost:8080
```

Browser suites run against the preview server (install once with `npx playwright install chromium`):

```sh
npm run test:browser            # desktop/mobile flows, tactical movement, mouse fallback, weapons, customization, reload
npm run test:lobby
npm run test:lobby-performance
npm run test:conquest
npm run test:multiplayer        # starts its own server; two clients plus touch TDM
```

Screenshots and result JSON are written to `artifacts/`, which is not committed. After source changes, run `npm run build` and commit `dist/` so the no-install play path stays current.

To deploy statically, upload the contents of `dist/`. Serve `sw.js` and `index.html` with revalidation. Offline page reloads need a completed service-worker install on HTTPS or localhost.

## Architecture

| Module | Responsibility |
|---|---|
| `src/game.js` | `OfflineSimulation`: the single authority for rules, used offline and by the server |
| `src/match.js` | TDM rules, roster, spawn selection (incl. Conquest forward spawns), damage, snapshots |
| `src/conquest.js` | Sector capture, tickets, bleed, bot objective selection |
| `src/weapons.js` | Weapon tuning, falloff, hitboxes, spread, recoil patterns and recovery, reload lifecycle, effect pool |
| `src/player.js` | Turns input into aim, movement, slot switching, ADS progress and fire |
| `src/movement.js` | Sprint, slide/cancel, crouch clearance, gravity, weight-based speed |
| `src/bots.js` | Staggered perception, navigation, ADS, line-of-sight firing, cover retreat |
| `src/world.js` | Map geometry, collision, line of sight, navigation graph, sector spawn points |
| `src/network.js` | Multiplayer client: input stream, local view angles, recoil prediction |
| `server/` | HTTP room service and streaming transport |
| `src/main.js` | Arena bootstrap, menus, fixed 60 Hz loop |
| `src/lobby*.js` | Squad lobby UI and 3D scene |
| `src/renderer.js`, `characters.js`, `weapon-models.js`, `combat-fx.js` | Rendering only; never decides hits |

Map provenance and license: `assets/maps/freedm/`; regenerate the adaptation with `npm run import:conquest-map`. Third-party notices: `THIRD_PARTY_NOTICES.md`.
