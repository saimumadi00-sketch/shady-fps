---
name: Crosscurrent
description: A browser FPS front end briefed like a field dossier, with original operators, one signal colour and square plates.
colors:
  signal-teal: "#3fc7b8"
  signal-teal-bright: "#6fe0d3"
  signal-teal-ink: "#001412"
  signal-teal-deep: "#12302c"
  rust: "#f56130"
  rust-deep: "#351a10"
  rust-text: "#ff8a5c"
  amber-warning: "#e5a93b"
  amber-deep: "#2b2414"
  alarm-red: "#e5484d"
  alarm-text: "#ff8589"
  night-ground: "#050607"
  night-surface: "#0b0d0f"
  bone: "#f2f2ee"
  ash: "#b3b6b4"
  slate: "#8a8e8c"
  smoked-glass: "rgba(9, 11, 13, 0.74)"
  smoked-glass-dense: "rgba(9, 11, 13, 0.9)"
  glass-raised: "rgba(255, 255, 255, 0.06)"
  glass-hover: "rgba(255, 255, 255, 0.12)"
  hairline: "rgba(255, 255, 255, 0.09)"
  hairline-strong: "rgba(255, 255, 255, 0.22)"
  olive-black: "#070908"
  olive-plate: "#0d100e"
  olive-raised: "#151a15"
  field-paper: "#e9ece3"
  sage: "#a9b0a0"
  moss: "#7f8777"
  stencil-khaki: "#c8b98c"
  olive-hairline: "rgba(214, 224, 200, 0.08)"
  olive-hairline-strong: "rgba(214, 224, 200, 0.2)"
  reticle-mint: "#a7ead4"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(64px, 8.4vw, 150px)"
    fontWeight: 600
    lineHeight: 0.9
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "38px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "0.1em"
  hud-figure:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: "40px"
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.14em"
  stencil:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.18em"
  readout:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, SFMono-Regular, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    fontFeature: "tnum"
rounded:
  none: "0px"
  plate: "2px"
  round: "50%"
spacing:
  hair: "4px"
  tight: "6px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.signal-teal-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.signal-teal-bright}"
    textColor: "{colors.signal-teal-ink}"
  button-secondary:
    backgroundColor: "{colors.glass-raised}"
    textColor: "{colors.bone}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "0 20px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.glass-hover}"
    textColor: "{colors.bone}"
  button-deploy:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.signal-teal-ink}"
    rounded: "{rounded.plate}"
    width: "220px"
    height: "52px"
  mode-tile:
    backgroundColor: "{colors.glass-raised}"
    textColor: "{colors.bone}"
    rounded: "{rounded.plate}"
    padding: "0 18px"
    height: "56px"
  mode-tile-selected:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.night-ground}"
  panel-glass:
    backgroundColor: "{colors.smoked-glass}"
    textColor: "{colors.bone}"
    padding: "20px 22px"
  panel-dossier:
    backgroundColor: "{colors.olive-plate}"
    textColor: "{colors.field-paper}"
    rounded: "{rounded.none}"
    padding: "16px 18px"
  operator-card:
    backgroundColor: "{colors.olive-plate}"
    textColor: "{colors.field-paper}"
    typography: "{typography.title}"
    padding: "8px 12px 8px 8px"
  operator-card-selected:
    backgroundColor: "{colors.olive-raised}"
  hud-readout:
    backgroundColor: "{colors.smoked-glass}"
    textColor: "{colors.bone}"
    typography: "{typography.hud-figure}"
    rounded: "{rounded.plate}"
    padding: "12px 16px"
  touch-button:
    backgroundColor: "rgba(0, 0, 0, 0.45)"
    textColor: "#ffffff"
    rounded: "{rounded.round}"
    size: "56px"
  touch-fire:
    backgroundColor: "rgba(53, 26, 16, 0.7)"
    textColor: "#ffffff"
    rounded: "{rounded.round}"
    size: "80px"
---

# Design System: Crosscurrent

## Overview

**Creative North Star: "The Field Dossier"**

Every screen is a briefing handed to an operator before deployment. Codenames are set huge, labels are stencilled in tracked uppercase, data reads off in fixed-width figures, and every surface is a square, near-black plate. There is no rounded friendliness and no ornament. Personality comes from the operators and the places, presented like files on a desk: NOVA, HEX, ROOK and GHOST, then Yard 07 and Foundry.

The dossier has two dialects, chosen by what sits behind the panel. **Field glass** is used wherever a panel floats over a live 3D scene (the in-match HUD, pause and results dialogs). It uses neutral smoked glass with a hairline border, so the world stays visible behind it. **Dossier plate** is used on solid full-page screens: the front end (the operator plate) and its drawer. It uses flat olive-black plates, khaki stencil headings and monospace readouts, so it reads as paperwork rather than an overlay. Both share one type family, one signal colour, square corners and the same button grammar.

Density is closer to a console shooter front end than to a website: fixed viewport, no page scroll on large windows, keyboard hints in the footer, and one decisive action per screen (Find Match, Deploy). The interface stays still and quiet so the operators carry the colour and the motion.

**Key Characteristics:**
- Near-black ground; colour reserved for team data and the one primary action.
- Square plates (2px or 0) everywhere; circles only for touch controls and the operator floor disc.
- Uppercase, widely tracked Inter for labels and headings; tabular figures for every number.
- A 2-3px Signal Teal edge marks the active panel, the selected item or the current tab.
- The 3D scene is always the backdrop; menus sit at its edges and never cover the squad.

## Colors

A near-black, almost colourless system with one teal signal and one rust opponent. Colour means team or state, never decoration.

### Primary
- **Signal Teal** (#3fc7b8): your team, the active selection and the single primary action per screen (Find Match, Deploy). It is also the edge stripe on active panels, the underline on selected tabs, stat bars, the level badge and the brand mark. Text on it is **Signal Teal Ink** (#001412); its hover state is **Signal Teal Bright** (#6fe0d3); its tint for ready pills and the selected operator's portrait well is **Signal Teal Deep** (#12302c).

### Secondary
- **Rust** (#f56130): the opposing team only. Used for the enemy score, enemy spawns on map drawings, kill-feed names and the touch FIRE button's border, with **Rust Deep** (#351a10) as its fill. **Rust Text** (#ff8a5c) is the same signal lifted for small text (kill-feed names, sector captions), at 5.5:1 on HUD glass over the brightest sky. It is never an accent and never used for a call to action.

### Tertiary
- **Amber Warning** (#e5a93b, deep #2b2414): cautionary notices.
- **Alarm Red** (#e5484d): low health and destructive or error states, the one HUD state that needs a signal colour. Large figures use it directly; small text uses **Alarm Text** (#ff8589).

### Neutral
- **Night Ground** (#050607): HUD ground and the in-match dialogs' base.
- **Night Surface** (#0b0d0f): dialogs and solid cards in the glass dialect.
- **Bone** (#f2f2ee): primary text, and the inverted fill of a selected mode tile or segment.
- **Ash** (#b3b6b4): secondary text and labels.
- **Slate** (#8a8e8c): tertiary text, inactive tabs, footnotes.
- **Smoked Glass** (rgba 9,11,13 at 0.74) / **Dense** (0.9): panel and HUD scrims over the scene.
- **Glass Raised / Hover** (white at 0.06 / 0.12): resting and hover fills for tiles and secondary buttons.
- **Hairline / Strong** (white at 0.09 / 0.22): borders, dividers, the outline on secondary buttons.
- **Dossier palette** (the front end: operator plate, rail, drawer and operation strip): Olive Black (#070908) ground, Olive Plate (#0d100e) panels, Olive Raised (#151a15) selected cards, Field Paper (#e9ece3) text, Sage (#a9b0a0) and Moss (#7f8777) secondary text, Stencil Khaki (#c8b98c) headings and the operation line, olive-tinted hairlines.
- **Reticle Mint** (#a7ead4): the default crosshair colour; players can change it in settings.

### Named Rules
**The One Signal Rule.** Signal Teal appears on one primary action per screen, plus the edges and bars that mark what is selected. If two buttons are teal, one of them is wrong.

**The Team Truth Rule.** Teal is always your side and Rust is always the other side, on every map, HUD and scoreboard. Neither is used as a decorative accent.

**The Small Signal Rule.** Team and alarm colours below 18px use their Text variants, so they hold 4.5:1 on glass over the brightest sky.

**The Khaki Boundary Rule.** Stencil Khaki and the olive neutrals belong to the dossier-plate dialect. They don't leak onto glass panels over the live scene.

## Typography

**Display Font:** Inter (bundled `inter-latin.woff2`, weights 400-600), falling back to system-ui
**Body Font:** Inter
**Label/Mono Font:** ui-monospace stack (Cascadia Mono, Consolas, SFMono-Regular), used only for dossier readouts

**Character:** One grotesque used at two extremes: huge, tight-leaded codenames and small, widely tracked uppercase stencils. The monospace stack appears only where a number or file reference should look typed, never for prose.

### Hierarchy
- **Display** (600, clamp(64px, 8.4vw, 150px), 0.9): the selected operator's codename, set behind the 3D figure. Nothing else uses it.
- **Headline** (600, 34px/38px, -0.01em, uppercase): section titles such as QUICK PLAY. The deploy bar's operation name uses 26px/30px at 0.06em.
- **Title** (600, 20px/24px, 0.1em, uppercase): operator names on roster cards, rank names, HUD secondary figures.
- **HUD figure** (600, 32px/40px, tabular): health and ammo. The scoreboard uses 28px/36px; the results score uses 40px/48px.
- **Body** (400, 14px/20px): descriptions, chat, weapon notes (13px/19px in dense panels).
- **Label** (600, 11px/16px, 0.14em, uppercase): field labels, eyebrows, HUD captions, keyboard hints. Top-level tabs use 15px at 0.16em; buttons use 12px at 0.14em.
- **Stencil** (600, 11px/16px, 0.18em, uppercase): dossier headings and tabs, in Stencil Khaki or Moss.
- **Readout** (monospace, 11-13px, tabular): operator weapon lines, match summary, rule values, map captions on the dossier plate.

### Named Rules
**The Tabular Rule.** Every number that changes (timer, health, ammo, score, ping, level, XP) uses tabular figures so the HUD never jitters.

**The Two Extremes Rule.** Type is either very large and tight or small and widely tracked. Medium-weight, mid-size sentence-case headings don't exist in this system.

## Layout

The front end fills a fixed viewport and does not scroll on large windows; panels scroll inside themselves.

- **Front end (operator plate):** a 48px bar (brand, Offline / Private room, then Operator / Mission / Settings tabs after a hairline), the plate filling the width beside a 208px roster rail of file tabs, and the operation strip below (readiness line, Mode / Map / Bots selects, rule readouts from 1360px wide, Deploy). The operator stands left of a 300px call-out column; Mission and Settings open as a 480px drawer over the plate beside the rail. The site root forwards here.
- **HUD:** map label top left, scoreboard top centre, pause top right, health bottom left, ammo bottom right. Edges respect `env(safe-area-inset-*)` with at least 20-24px.
- **Breakpoints (observed):** large window ≥1100px wide and ≥640px tall (no scroll); ≤1099px collapses to one column in task order; ≤720px phone; ≤420px narrow phone; short landscape ≤600px and ≤500px tall for phones held sideways. On the front end: ≤1099px puts the roster as four tabs across the top and stacks the call-outs under the figure; ≤560px gives the selects full rows at the end of the page and pins Deploy to the bottom of the screen; phones held sideways (≤500px tall) keep plate and a 136px rail side by side with a compact call-out column.
- **Rhythm:** 4/6/8px inside groups, 14px between blocks, 20-22px panel padding, 28px outer edges.

**The Figure First Rule.** On the operator plate the operator is the largest thing on screen. Call-outs sit beside the figure and point at it; only the Mission / Settings drawer may cover the plate, and it never covers the roster.

## Elevation & Depth

Flat, with tonal layering. There are no drop shadows on panels or buttons. Depth comes from stacking translucent plates over the 3D scene: Smoked Glass with a backdrop blur (14px on dialogs, 10px on HUD plates), a 1px hairline border and a coloured edge stripe. On the dossier plate, depth is purely tonal (Olive Black, then Plate, then Raised), with no blur.

### Shadow Vocabulary
- **Reticle edge** (`filter: drop-shadow(0 1px 1px #000)`): only on the crosshair, so a 2px reticle stays legible over any part of the scene.
- **Floor ring** (`box-shadow: 0 0 0 1px rgba(63, 199, 184, 0.35)`): the teal ring on the disc the operator stands on.
- **Tab underline** (`box-shadow: inset 0 -2px #3fc7b8`): the selected tab marker in the front end's bar.
- **Touch ring** (`border: 1px solid rgba(255,255,255,0.55)` with `box-shadow: 0 0 0 1px rgba(0,0,0,0.6)`): the two-tone outline on touch buttons, light against dark walls and dark against bright sky.

### Named Rules
**The No-Glow Rule.** No glows, text shadows or coloured blooms. A HUD readout earns legibility from its scrim, not from light effects.

## Shapes

Square corners. Every plate, button, input, tile and dialog uses a 2px radius, which reads as square with the edge softened. Dossier inputs and panels go fully square (0). Circles are reserved for touch controls (buttons, joystick, FIRE) and the operator floor disc, so a circle on screen means "press this with a thumb". The level badge is the one polygon, a hexagon clipped from a square. The recurring mark is a **2-3px edge stripe**, a left border on active panels, dialogs, toasts and the selected operator card, or a bottom bar under the active tab.

## Components

### Buttons
Decisive and plain: square, uppercase, tracked, with no icons needed.
- **Shape:** square plate (2px), 36px in the arena, 44px full width in dialogs and on touch screens.
- **Primary:** Signal Teal fill with Signal Teal Ink text, 12px label at 0.14em, 0 20px padding. Hover brightens to Signal Teal Bright. Disabled falls back to Glass Raised with Ash text and a wait cursor.
- **Secondary:** Glass Raised fill, Hairline Strong outline, Bone text. Hover goes to Glass Hover with a Bone outline.
- **Deploy / Find Match:** the screen's one big action, 52px × 220px (Deploy, 14px at 0.24em) or 46px × 190px (Find Match). While searching, Find Match inverts to a Bone fill.
- **Icon / quiet:** transparent, Ash text, 34px; hover adds Glass Raised.
- **Press:** every button scales to 0.97 over 80ms; colour transitions take 120ms.

### Mode tiles and segments
- **Style:** 56px rows (tiles) or 38px cells (segments) on Glass Raised with a hairline. The name is set in 16px uppercase and the detail in an 11px Slate label on the right.
- **Selected:** inverts to a Bone fill with Night Ground text, plus a 5px Signal Teal stripe on the left edge. Unavailable tiles drop to 40% opacity while searching.

### Panels
- **Field glass:** Smoked Glass, 14px blur, a hairline border and a 2px Signal Teal left edge (a strong hairline on the party rail), 20/22px padding, entering with a 220ms slide from 10px left.
- **Dossier plate:** Olive Plate, a hairline border, no blur, square corners, with a three-column stencil tab bar (44px) underlined in Signal Teal.

### Inputs / Fields
- **Style:** native selects and inputs on the ground colour with a control-strength border and square corners.
- **Hover / Focus:** the border shifts to Stencil Khaki on the dossier plate. Keyboard focus is a 2px solid outline (Bone in the arena) with a 2px offset.
- **Disabled:** Slate text, not-allowed cursor, 45% opacity on selects.

### Navigation
- **Front-end tabs (Operator / Mission / Settings):** 12px uppercase at 0.16em in Moss, Field Paper on hover or when active, with a 2px Signal Teal bar on the bar's bottom edge.
- **Arena bar:** 12px tracked links in Slate, Bone for the current page.
- **Key caps:** 22px square caps with a strong hairline and a 5% white fill, 11px semibold.

### Operator card (signature)
A roster entry in the dossier: a 96px portrait well, the codename in Title type, the class in Sage and the weapon line in monospace Moss, with a number-key hint in the corner. Selected cards gain Olive Raised, a strong hairline, a 3px Signal Teal left edge, a teal-tinted portrait well and a teal key hint.

### HUD readouts (signature)
Smoked Glass plates with a 10px blur and hairline, tabular figures over 11px uppercase captions. Health carries a 4px track in Signal Teal that turns Alarm Red together with the figure below the low-health threshold. Team scores are Signal Teal and Rust; everything else stays neutral.

### Touch controls
Translucent black circles (56px) with the two-tone touch ring and 12px labels. FIRE is 80px with a Rust ring and a Rust Deep fill. The right-thumb cluster is a grid anchored to FIRE with 12px between every pair: Aim and Reload on FIRE's row (Reload never touches FIRE), with Swap, Crouch and Jump above. The joystick is a 110px ring with a 44px knob, with Sprint above it. Controls sit inside safe-area insets, and the right 58% of the screen is a look-drag surface. In touch mode the kill feed moves under the scoreboard and keeps the three newest kills, and the Pause button grows to 44px.

### Operator plate (signature)
The front end. A gridded olive-black plate (a 40px survey grid at 3.5% Field Paper) with the chosen operator at about 84% of its height, holding their class weapon (the real weapon model) with both hands, and the other three squadmates dimmed into the plate behind. Identity sits top left: the codename in 56px tracked caps (44px on short windows), then the class and role in 12px Stencil Khaki caps under it, then a one-line brief. Each piece of kit (sight, finish, weapon, handling, sidearm) is labelled by a 1px Signal Teal leader line that starts on the model in a 7px square terminal, runs straight out to a spine, and enters its call-out. Where the call-outs stack under the figure, the lines run to a gutter at the plate edge instead.

- **Call-outs:** Olive Plate panels with a strong olive hairline. Sight, Finish and Sidearm are single rows (label left, control or value right); Weapon carries its select, a side-view render and the stat line; Handling carries the five rating bars.
- **Roster rail:** four full-height file tabs (codename 20px, class, weapon). The selected tab protrudes 24px onto the plate with a 3px Signal Teal left edge; on narrow screens the tabs run across the top with a 3px top bar.
- **Operation strip:** the readiness line with its square status light, Mode / Map / Bots selects, rule readouts, and Deploy as the largest control at the bottom right.

### Kill feed
Smoked-glass rows with the killer's name in their team colour. Kills by your side also carry a 3px Signal Teal left edge, so the side reads without relying on hue.

### Settings panel
One panel (`src/settings-panel.js`) shown in the front end's Settings drawer. It has five groups in shooter order, Profile, Controls, Key bindings, Audio and Video, divided by hairlines with stencil headings. Group headings use the stencil; field labels are plain 13px sentence-case rows (the same voice as the key list), so a heading never reads as one more field. Sliders show their value in a tabular read-out; changes apply immediately, with no Save step. Key bindings are listed as action plus keycap (a 72px monospace plate). The keycap turns Signal Teal while waiting for a key, and a key that is already taken swaps with the action that had it.

### Results table
Player names in Bone, Class in Ash, Team in its team colour (Signal Teal or Rust Text). Only Kills and Deaths align right as tabular figures.

### Status lights
On/off and live states use a 7px square light rather than a filled button: lit Signal Teal when on, a Slate outline when off (the readiness line on the operation strip).

### Pills and toasts
- **Pill:** 10px tracked label with a hairline outline. Ready pills switch to a Signal Teal outline, Signal Teal Deep fill and teal text.
- **Toast:** Dense Smoked Glass with a 3px Signal Teal left edge, rising 12px into place over 200ms above the footer.

## Do's and Don'ts

### Do:
- **Do** keep one Signal Teal primary action per screen and mark selection with a 2-3px teal edge, not a teal fill.
- **Do** use Signal Teal for your team and Rust for the enemy, everywhere, without exception.
- **Do** set every changing number in tabular figures, and use the monospace readout stack on the dossier plate.
- **Do** use field glass (Smoked Glass, blur, hairline) over a live scene, and the olive dossier plate on solid full-page screens.
- **Do** keep corners square (2px, or 0 on the dossier) and reserve circles for touch controls.
- **Do** keep the operator the largest thing on the plate, with every call-out joined to its kit by a leader line.
- **Do** honour `prefers-reduced-motion` and the Reduced motion setting: transitions and panel slides switch off.
- **Do** keep every touch control at 44px or more with at least 8px between thumb targets (the in-match cluster uses 12px).
- **Do** use Rust Text and Alarm Text for small signal-coloured text.

### Don't:
- **Don't** add glows, text shadows, coloured blooms or drop shadows to panels; the only shadow is the crosshair's 1px edge.
- **Don't** use Rust, Amber or Alarm Red as decorative accents or on calls to action.
- **Don't** bring Stencil Khaki or olive neutrals onto glass panels over the scene.
- **Don't** round plates beyond 2px or introduce pill-shaped buttons.
- **Don't** set mid-size sentence-case headings; type is either huge and tight or small, uppercase and tracked.
- **Don't** set a small label as its own block above a heading; the codename leads and the class and role sit under it.
