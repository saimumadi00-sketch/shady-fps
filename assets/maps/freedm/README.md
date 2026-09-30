# FreeDM MAP01 — Conquest adaptation

Original map downloaded from the official Freedoom repository:
https://github.com/freedoom/freedoom/blob/v0.13.0/levels/dm01.wad

Version: FreeDM / Freedoom v0.13.0. License: BSD-3-Clause.
Copyright © 2001-2024 Contributors to the Freedoom project.
The original license is in COPYING.adoc and the original contributor list is
in CREDITS. No proprietary Doom map, texture, or engine code is included.

Original file SHA-256:
08b8fe823dec23ff72a07be8691c2f177f47719c77f99a47352b9ab97312f9d1

`scripts/import-freedm.py` reads the actual sector footprints from this WAD,
samples them on a 64-Doom-unit grid, and generates `src/maps/freedm-dm01.js`.
It keeps the largest connected area, flattens floor heights, opens doors, and
uses box walls to fit the game's existing collision and instanced renderer.
This is an adapted map layout; original textures, lifts, teleporters, weapons,
and game rules are not imported. The map is not a pixel-perfect Doom port.

The game adds opposing team bases and three Conquest objectives to this layout.
All layout data is bundled in game.js; gameplay requires no external fetch.
Run `npm run import:conquest-map` to reproduce the layout from the retained WAD.
