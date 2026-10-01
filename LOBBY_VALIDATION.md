# Yard 07 lobby validation

Validated locally in Chromium with software WebGL on 2026-09-29.

- `npm test`: 32 tests passed.
- `npm run test:browser`: all seven existing FPS browser suites passed after moving their entry URL to `arena.html`; aiming, class inventories, mobile controls, customization, preview updates, reload animations and offline gameplay remain covered.
- `npm run test:lobby`: passed class/model changes, two weapons per class, attachment and finish selection, preview dragging, loadout save/equip/reload persistence, escaped chat and simulated replies, readiness, mode/region changes, queue cancel/completion, preferences, portrait layout, offline lobby reload and Recon-to-Scout training handoff. No page errors.
- Desktop 1920×1080, laptop 1366×768, and portrait 390×844 screenshots are in `artifacts/lobby-*.png`. Short desktop windows scroll the complete lobby; touch layouts stack panels.
- Production build includes both lobby and training routes, bundled Three.js, a yard map SVG and service-worker assets. Lobby scenery and characters reuse `Arena` and `drawCharacter` from the game. The space backdrop is excluded from the build. No runtime CDN dependency.

## Prototype boundaries

Squad members, chat replies, ping, rankings, matchmaking and progression are local simulations. Only the existing offline Team Deathmatch bot arena is playable; Conquest and Domination are lobby mode previews. Weapon variants and attachment ratings describe lobby profiles rather than new arena ballistics. Soldiers and weapons are original procedural geometry, not scanned AAA assets. Hardware GPU performance, physical phones and browsers other than Chromium have not been measured in this pass.
