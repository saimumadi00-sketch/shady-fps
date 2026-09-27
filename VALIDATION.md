# Validation record

## Tactical movement / voxel update

Current build: `c38c6b74c658`, 53,449 bytes raw / 19,598 gzip / 17,098 Brotli. Eighteen simulation tests pass, adding mouse/ADS sensitivity, sprint-slide-jump cancel, slide expiry and wall blocking, respawn reset, and low-ceiling clearance. The original performance and memory measurements below describe the initial build and have not been remeasured for the new character parts. The renderer still batches characters into one draw call.

The browser regression and new tactical controls check are recorded with this update.

## Initial-build record

Build: `c04426fd8e9d`. Tested on 2026-09-13. Production artifacts are in `dist/`.

## Completed checks

- All 14 deterministic simulation tests passed. Coverage includes three complete bot-only matches at Easy, Normal and Hard; 5v5 roster; obstruction and friendly-fire rules; spawn protection; damage/death/respawn; magazine/reserve conservation; pistol trigger semantics; weapon switching; movement, jumping and collisions; timer, draw and score-limit results; cached routes; bounded effects; and visual-only dynamic-quality changes.
- Headless Chromium 153 production tests passed at both `http://localhost:8080/` and `http://localhost:8081/dist/`. The final nested-path run exercised the final built files, not development modules.
- Thirteen browser workflow checks passed: desktop Play/pointer lock, movement/fire, reload, weapon switching, pointer-lock-loss pause, hitscan score, player death/respawn, score-limit victory/restart, WebGL loss/restoration, simultaneous joystick/look/fire, touch action buttons, portrait handling, and offline reload.
- Browser test logs recorded no page errors or desktop console errors. Screenshots were inspected for menu, gameplay and mobile layout. A mobile reload-button/ammo overlap was corrected and retested.
- `main.py` passed compilation using the configured PyCharm Python 3.12 virtual environment. The served game is JavaScript; Python is only an optional local launcher.
- Runtime source contains no external network endpoints. All production asset paths are relative.

The requested browser check after every individual development phase was not performed: a connected browser was unavailable initially, and browser validation was consolidated after an isolated Chromium runner was installed. Physical Android checks were not possible in this environment.

## Download and renderer

| Measurement | Result |
|---|---:|
| Production page + game + styles + worker, uncompressed | 50,775 bytes |
| Same files, gzip | 18,568 bytes |
| Same files, Brotli | 16,161 bytes |
| Runtime dependency downloads | 0 |
| Texture/model/audio asset downloads | 0 |
| Static cube instances | 133 |
| Navigation graph nodes | 326 |
| Active-play draw calls | Up to 3 |
| Effect pool capacity | 48 |
| Path cache limit | 256 |

Compressed sidecars require server content negotiation; without it, browsers receive the normal uncompressed files. Browser headers and `build-info.json` are not included in the transfer totals. Test dependencies, test browsers and screenshots are not part of the game payload.

## Memory and timing

`npm run profile` performed 40 complete accelerated bot matches inside Chromium, forcing garbage collection at checkpoints through the test protocol. The game itself does not request garbage collection.

| Checkpoint | Retained V8 heap | Cached paths |
|---|---:|---:|
| Before matches | 1,505,940 bytes | 0 |
| After 10 matches | 1,895,948 bytes | 256 |
| After 40 matches | 1,905,672 bytes | 256 |

The additional 30 matches retained approximately 9.7 KB more heap. This supports bounded retention for the tested simulation/restart paths, not a proof that every browser/GPU resource is leak-free. Total browser process RAM and GPU memory were not measured. See `artifacts/profile.json` for raw checkpoints and match scores.

A separate six-second render sample with ten bot-controlled actors at a 1280×720 CSS viewport measured **39 FPS average**, **16.7 ms median** and **66.7 ms p95** frame intervals at 80% render scale. It used **ANGLE / SwiftShader software rendering**, not a real integrated/mobile GPU. The sampled player could die and respawn, so the last sampled frame had two draws; a live first-person view uses three. The short workflow-test sample separately measured 36 FPS, but isolated bot AI during control checks and is not a full-combat benchmark.

**The 30–60 FPS targets on supported physical devices remain unverified.** These synthetic runs must not be presented as Windows or Android performance guarantees.

## Physical-device acceptance work

Use the production build, not `npm run dev`, for these checks:

1. Android Chrome on at least a 4 GB budget phone and a midrange phone/tablet. Run two complete seven-minute-or-score-limit matches per quality preset. Record chipset, browser version, viewport, median/p95 frame times, render scale, thermal throttling and process memory.
2. Windows Chrome/Edge on a 4 GB integrated-graphics laptop at 720p and 1080p. Record the same metrics. Repeat in Firefox where WebGL 2 and pointer lock are available.
3. Verify three-finger play, touch cancellation, gesture edges, browser UI resizing, portrait changes, tab switching and audio resume on actual phones. Emulation cannot reproduce all OEM/browser behavior.
4. Confirm startup on a throttled mobile network, cached offline reload, background/foreground recovery, ten consecutive restarts, and context loss/restoration.
5. Aim for 60 FPS on capable devices, 40–60 FPS on typical midrange devices and approximately 30 FPS on weaker supported devices. If a device misses the target at minimum scale, identify whether the bottleneck is GPU fill, driver overhead, CPU, thermal limits or browser configuration before changing simulation behavior.

No physical Android, physical Windows integrated-GPU, Firefox, or Edge test was performed here. No online multiplayer, backend or public deployment is included.

## Reproduction

```sh
npm ci
npm test
npm run build
npm run preview
# Separate terminal:
npx playwright install chromium
npm run test:browser
npm run profile
```

To repeat the nested URL test, serve the repository root on port 8081 and run `TEST_URL=http://localhost:8081/dist npm run test:browser` (set the environment variable using PowerShell syntax on Windows).

Artifacts: `artifacts/browser-results.json`, `artifacts/profile.json`, and the PNG screenshots in `artifacts/`.

API references consulted: [MDN WebGL 2 instanced drawing](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawArraysInstanced) and [MDN Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API).
