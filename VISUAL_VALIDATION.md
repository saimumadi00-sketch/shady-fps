# Visual pass — 2026-10-03

This pass retains the WebGL 2 renderer, local assets, offline installation,
authoritative simulation and adaptive quality settings. No remote assets or
runtime dependencies were added.

## Changes

- Curved sleeves, rounded glove surfaces, knuckle pads, stitching and weapon-specific grips.
- Smaller finger joints use fewer subdivisions to control mesh size.
- Chamfered silhouettes for small box-shaped weapon components; collision geometry is unchanged.
- Smooth aiming transitions, subtle breathing and walking offsets, sprint lowering and restrained visual recoil.
- Directional sunlight and sky ambient lighting, restrained procedural surface grain, wall-base shading and distance fog.
- Surface detail follows the existing adaptive shadow-quality flag and is visually disabled at low quality.

## Evidence

Latest desktop and landscape-mobile captures are in `artifacts/redo-*.png` for hip fire,
aiming, reload and pistol poses. `artifacts/visual-baseline.json` records build size,
draw calls, viewmodel vertex counts and CPU submission samples.

The sampled scene uses three draw calls. Chromium SwiftShader samples averaged
approximately 0.36 ms desktop and 0.25 ms mobile CPU submission time. These
measure submission cost in the test scene, not real-device GPU time or a hardware
frame-rate guarantee. Build metadata records approximately 697 KB raw deployed
payload, 191 KB gzip and 159 KB Brotli, excluding map source/provenance files.

Validation: 52 unit tests; reloads for all five weapons; pause-menu armory preview;
two-client multiplayer and mobile touch flow; Conquest gameplay and offline reload.
New unit checks ensure fully aimed sights remain centered during movement and
visual offsets do not alter authoritative actor state.

## Limits

The scene remains procedural low-poly geometry. Wall-base shading is an inexpensive
depth cue, not a new real-time contact-shadow system. Real-device performance still
needs hardware measurements. Major environment remodelling, detailed textures and
skeletal character animation remain separate work.

## Redo

The latest pass removes broad cloudy mottling, neutralizes the world palette, adds restrained steel highlights, brings the weapon closer, reduces sleeve prominence and replaces the oval firing-hand palm with a tapered glove silhouette. Darker tactical gloves and smaller finger joints replace the earlier tan glove treatment.
