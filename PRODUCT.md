# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public players who find Crosscurrent and should want to come back. They play in a browser tab on a desktop with mouse and keyboard, or on a phone held in landscape. Sessions are short: get into a match fast, play a 5v5 against bots offline, or join friends in a private room. They know modern console and PC shooters and arrive expecting those conventions: class loadouts, an operator select, ADS, recoil, sprint and slide, and a full options menu.

## Product Purpose

A browser FPS with the feel and structure of a full modern military shooter: an operator-select front end, class-based weapons, Team Deathmatch on four maps, and Conquest with tickets, sectors and forward spawns. It needs no account and no download. Success means a stranger reaches a match in under a minute, the gunplay feels right, and they come back.

## Positioning

What players should remember about Crosscurrent compared with other browser shooters:

- **Original anime operators.** The roster is original characters with their own identities, not generic soldiers.
- **Console-grade feel.** Class roles, learnable recoil patterns, damage falloff, run-and-gun movement and slides are tuned like a full shooter (see `WEAPON_ROLE_DESIGN.md`).
- **Zero friction.** No account, no install, playable offline, and fully playable on a phone.
- **Squad fantasy.** The operator plate shows your operator at full height holding their class weapon with the squad behind them, and the kit is changed on the figure itself.
- **Recognisable settings, in both senses.** An options menu laid out the way shooter players already know (sensitivity, FOV, keybinds, graphics, audio), and maps with distinct identities that players remember and name (Yard 07, Rail Cut, Foundry, Quarry, Outpost).

## Operating Context

- Entry: the site root forwards to the front end (`arena.html`), the operator plate. Players pick an operator, change kit on the call-outs, set mode, map and bots on the operation strip and deploy; Mission (map, rules, private room) and Settings open in a drawer.
- Desktop play captures the mouse, and Escape pauses. Touch controls are detected automatically, and matches need landscape orientation.
- Private multiplayer is server-authoritative and needs the bundled Node server (`npm run multiplayer`). Static hosts serve only the offline game.
- The production build is in `dist/`, served by `main.py` or `npm run preview`. A service worker enables offline reloads on HTTPS or localhost.

## Capabilities and Constraints

- Modes: Team Deathmatch (5v5, first to 15/30/50, 3/7/10-minute timer, four maps) and Conquest on FreeDM Outpost (three sectors, 150 tickets).
- Classes: Assault (AR), Engineer (SMG), Support (LMG), Recon (DMR), each with a shared pistol. Finishes and optics are cosmetic.
- **Not built:** rankings, matchmaking, progression and party systems. The old simulated lobby that faked them was removed; design must not reintroduce fake versions or real-looking player data until they exist.
- **Touch parity is binding.** Every screen and match feature must work on a phone in landscape, not only on desktop.
- Stack: vanilla JS ES modules, Three.js, esbuild build, Playwright browser tests, Node multiplayer server.
- Open (explicitly not binding): the title "Crosscurrent — Yard 07" may change; runtime remote assets, fonts or CDNs are allowed. Third-party assets still need a verified license and a credit in `THIRD_PARTY_NOTICES.md`.

## Evidence on Hand

- Gameplay and UI captures in `docs/media/`: `gameplay.webp`, `lobby.webp` and `setup.webp` (earlier build, before the operator plate), `tdm.webp`, `conquest.webp`, `mobile.webp`.
- Weapon tuning tables in `README.md` and `WEAPON_ROLE_DESIGN.md`.
- Third-party credits in `THIRD_PARTY_NOTICES.md`: Project A2B gun models, recorded weapon sounds, FreeDM MAP01 layout.
- Absent; never fabricate: player counts, reviews, testimonials, press, rankings, store ratings, or real progression data.

## Product Principles

1. **Feel before features.** Handling, recoil, movement and hit feedback come first. A screen or system that slows the path to a good fight is a cost.
2. **Seconds to a match.** No accounts, gates or downloads. Every step between landing and playing has to earn its place.
3. **Phone is a first-class platform.** Touch parity is part of the definition of done, not a later port.
4. **Familiar where players expect it, ours where it counts.** Settings, controls and HUD conventions follow the genre's established patterns; the operators and the places carry Crosscurrent's identity.
5. **Honest about what's real.** No fake ranks, levels, chat or matchmaking; systems appear when they exist.
