# Crosscurrent visual design: "Carbon"

One stylesheet (`style.css`) covers the front end, the in-match HUD and the dialogs. This file
is the reference for anyone changing it. It replaces the earlier field-manual design.

## Idea

A modern shooter front end: the operator stands in front of their own codename, set as large
as the stage allows. Everything else is quiet so that one yellow thing on each screen is the
thing you act on.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--carbon` | `#0b0d0f` | Ground of every screen |
| `--panel` | `#14181c` | Dialogs and the private-room card |
| `--bone` | `#f1f2ee` | Text and figures |
| `--ash` / `--smoke` | `#a3aab0` / `#7d858c` | Secondary and tertiary text |
| `--signal` | `#ffc21a` | The primary action, the selected operator, the live tab, contested sectors |
| `--team` / `--enemy` | `#3fc7b8` / `#f56130` | Cyan and Ember team data only |
| `--negative` | `#e5484d` | Low health, damage direction, kill marker |

Signal yellow never marks team data, and team colours never mark controls.

## Type

- **Barlow Condensed** 600/700, uppercase, for names, scores, clocks and actions.
- **Barlow** 400/500/600, sentence case, for everything that is read: labels, descriptions,
  settings. Labels are not set in capitals.
- Figures use tabular numerals.

Both families are bundled in `assets/fonts/`; nothing is fetched at run time.

## Front end

```
+-----------------------------------------------------------------+
| CROSSCURRENT   Operator  Mission  Settings      Offline|Private |
+-----------+---------------------------------+-------------------+
| Operators |  NOVA  (codename as backdrop)   | Weapon            |
|  NOVA  *  |        [ operator ]             | Handling          |
|  HEX      |                                 | Sight / Finish    |
|  ROOK     |  Assault - rifleman             | Sidearm           |
|  GHOST    |  short brief                    |                   |
+-----------+---------------------------------+-------------------+
| status      Mode  Map  Bots        30   07:00        [ DEPLOY ] |
+-----------------------------------------------------------------+
```

- Mission and Settings open over the stage, beside the roster.
- Under 1100 px wide, or upright, it becomes one scrolling column with the deploy bar pinned
  to the bottom. On a phone held sideways everything fits one screen without page scroll.
- Controls are at least 44 px tall on touch screens.

## HUD

- No boxes over the scene. Figures sit on soft shade in the bottom corners and along the top,
  with a tight text shadow.
- Scoreboard: each score on its team colour, the clock between them.
- Health bottom left, ammunition bottom right, both in display type. On touch they move to the
  strip between the stick and the buttons.
- Aim feedback (crosshair, hit marker, reflex dot, scope, damage arc, suppression, compass) is
  functional and documented in `README.md`; restyle with care.

## Dialogs

A panel on a dark scrim with a signal bar down its left edge, a display heading, one yellow
primary action and outlined secondary actions.

## Rules

- One primary (yellow, cut-corner) button per screen.
- Motion only answers an action; `Reduced motion` in Settings and the system preference remove
  transitions.
- Keep element IDs: the game logic and the browser tests address the interface by ID.
