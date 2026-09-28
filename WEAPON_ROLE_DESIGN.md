# Weapon-role design

Status: proposed gameplay specification, not an implemented balance patch. All numbers below are fictional starting values for playtesting. They are not measured balance results or real firearm specifications.

Exactly four canonical classes: **Assault, Engineer, Support, Recon**. Recon replaces the existing Scout identity; it is not a fifth class.

## Class identities and access

| Class | Exclusive primary categories | Main strength | Deliberate weakness |
|---|---|---|---|
| Assault | Full-size assault rifles | Versatile close-to-medium-range infantry fighting; strongest overall mobile rifle performance at medium range | Less mobile than Engineer, less persistent than an established Support gunner, less precise at long range than Recon |
| Engineer | Carbines, SMGs, compact automatic rifles | Fast deployment, quick ADS, strong moving/hip fire around vehicles, structures, and objectives | Earlier damage falloff, lower velocity, weaker medium/long-range accuracy and magazine endurance |
| Support | LMGs | Long firing windows, sustained damage, suppression, and stable lane control | Slow draw/ADS/sprint recovery, long reloads, poor moving accuracy; must establish position |
| Recon | DMRs and bolt-action sniper rifles | Precision, target selection, headshots, and deliberate medium/long-range fire | Slow reactive handling, poor hip fire, movement-induced instability, limited magazine capacity |

The weapon category defines its role; class selection does not secretly multiply the damage of the same gun. Engineer's anti-vehicle identity comes from a future gadget slot and mobility around vehicles. Its primary remains an anti-infantry weapon and does not gain a damage bonus against armor.

A loadout contains **one selected primary and one sidearm**. A class's allowed-primary catalog is not its carried inventory. Switching class is allowed at deployment or before a new match, never as an immediate mid-fight refill. For the current prototype, keep the existing new-match boundary.

## Limited universal access

Universals occupy the primary slot and replace the class specialist weapon, except sidearms, which occupy the sidearm slot. A player cannot carry an LMG plus a universal shotgun as two primaries.

| Shared option | Alternative role | Boundaries that protect class identity |
|---|---|---|
| Sidearms | Emergency backup; fast draw | Small magazines, short useful range, weaker sustained performance than primaries |
| Shotguns | Room-clearing ambush weapon | Very short reliable lethal range, wide pellet pattern, low capacity, slow follow-up; no universal long-range slug variant at launch |
| Selected PDWs | Compact personal defense | Better handling than heavy primaries, but smaller magazines or lower fire rate than Engineer SMGs and steep falloff; no long-range configuration |
| Selected light semi-auto rifles | Deliberate general-purpose alternative | Moderate damage, lower velocity and precision than Recon DMRs, limited optics; no sniper headshot lethality |

Start with a shared pistol only. Add one universal primary at a time after the exclusive categories meet their role targets. Do not make all carbines, all semi-auto rifles, or all compact weapons universal. Universals receive no Support stabilization bonus. Judge them against specialists in the relevant scenario, rather than expecting a shotgun to lose a point-blank ambush to every rifle.

## Range expectations

Assume 100 HP, no armor, and one world unit approximately one game meter for the proposed large-scale environment. These assumptions must be explicit in tests.

| Distance / situation | Intended leaders | Counterplay |
|---|---|---|
| Close: 0-20 m | Engineer in reactive/mobile combat; Assault remains strong | Support or Recon can win with preparation, but should lose comparable sprint/hip-fire reactions |
| Medium: 20-60 m | Assault strongest overall across changing angles and movement | Settled Support wins prolonged exposed lanes; DMR Recon competes through accurate shot placement |
| Long: 60-180 m | Recon precision | Assault and Support remain dangerous with disciplined bursts, but cannot match precision reliability |
| Extreme: 180-350 m | Sniper Recon | Travel time, drop, scope glint, cover, and low follow-up rate make misses costly |
| Sustained engagement | Support | Long reload windows, limited repositioning, flanks, and breaking line of sight |

These are overlapping advantages, not immunity zones or hard bullet cutoffs. A prepared Support gunner winning a medium-range lane does not contradict Assault being the best general-purpose medium-range class.

## Initial weapon archetypes

Damage is unarmored torso damage. Damage interpolates linearly between the two falloff distances and then remains at the listed minimum. Effective range describes practical use; it is separate from projectile lifetime.

| Archetype | Class | Near -> far damage | Falloff start -> end (m) | RPM | Magazine | Reload partial / empty (s) | Velocity (m/s) | Intended useful range (m) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| General-purpose AR | Assault | 28 -> 18 | 20 -> 80 | 650 | 30 | 2.15 / 2.65 | 650 | 10-70 |
| Mobile carbine | Engineer | 26 -> 14 | 12 -> 55 | 700 | 30 | 1.80 / 2.30 | 500 | 5-40 |
| Compact SMG | Engineer | 24 -> 10 | 10 -> 45 | 850 | 28 | 1.80 / 2.15 | 380 | 0-25 |
| Belt-fed LMG | Support | 26 -> 17 | 30 -> 110 | 700 | 100 | 4.80 / 5.80 | 650 | 20-100 when established |
| Precision DMR | Recon | 45 -> 34 | 45 -> 160 | 260 | 16 | 2.50 / 3.10 | 780 | 35-150 |
| Bolt-action sniper | Recon | 85 -> 70 | 90 -> 300 | 50 | 5 | 3.20 / 4.00 | 850 | 70-300 |

DMRs are semi-automatic: listed RPM is the maximum supported follow-up cadence, not forced automatic fire. Sniper cycling is mandatory between shots and cannot be skipped by switching weapons. No full-health sniper torso one-shot: two torso hits are required. A 2x sniper headshot multiplier rewards precise hits; AR/carbine/SMG/LMG use 1.5x and DMR uses 2x. At these seed values a DMR still needs two headshots against full health. Damage falloff applies before the head multiplier. Separate head and body collision regions are a prerequisite.

Close-range perfect torso-shot time from first shot to lethal impact, excluding handling and travel: AR approximately 277 ms, carbine 257 ms, SMG 282 ms, LMG 257 ms, DMR 462 ms, sniper 1,200 ms. This is only one diagnostic: Engineer wins many reactive fights through handling and moving accuracy, not a universal lowest damage-only TTK.

## Handling, accuracy, recoil, and weight

Handling values are milliseconds. Spread and recoil values are degrees, converted to radians at the simulation boundary. Spread denotes cone half-angle; horizontal recoil denotes a bounded per-shot signed kick. Values assume a fully aimed, stationary, unbraced weapon unless stated otherwise.

| Archetype | ADS | Sprint-to-fire | Equip ready | Weight points | ADS strafe multiplier | ADS / hip spread | Moving spread multiplier | Vertical / horizontal recoil per shot |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AR | 220 | 200 | 280 | 3.5 | 0.65 | 0.10 / 1.70 | 1.50 | 0.30 / +/-0.08 |
| Carbine | 170 | 140 | 220 | 2.8 | 0.75 | 0.14 / 1.40 | 1.30 | 0.25 / +/-0.10 |
| SMG | 140 | 100 | 180 | 2.2 | 0.85 | 0.16 / 1.15 | 1.20 | 0.20 / +/-0.10 |
| LMG | 380 | 400 | 550 | 7.5 | 0.40 | 0.20 / 3.20 | 2.30 | 0.38 / +/-0.15 |
| DMR | 340 | 320 | 400 | 4.6 | 0.40 | 0.025 / 4.00 | 3.00 | 0.80 / +/-0.04 |
| Sniper | 520 | 480 | 600 | 6.2 | 0.25 | 0.012 / 6.50 | 5.00 | 1.40 / +/-0.02 |

- Weight points are gameplay bulk, not real kilograms. Derive walking multiplier as `clamp(1.08 - 0.02 * primaryWeight, 0.88, 1.05)` and sprint multiplier as `clamp(1.025 - 0.008 * primaryWeight, 0.94, 1.02)`. Carried-primary weight remains while the pistol is drawn; switching sidearms cannot erase loadout mass. Apply the ADS strafe multiplier to the resulting walking speed once, not as a second generic weight penalty.
- Interpolate hip-to-ADS spread throughout ADS time. Zoom presentation and accurate aiming must use the same progress; a scope overlay alone never grants instant sniper precision.
- Base shot cone is `lerp(hipSpread, adsSpread, adsProgress) + shotBloom`; then apply movement, stance, and valid support-state modifiers. Derive movement from actual velocity/displacement, not animation flags.
- Recoil moves the aim direction; spread is bounded shot dispersion. Keep these independently tunable. Use readable recoil patterns with small bounded variation rather than large unpredictable horizontal kicks.
- Initial bloom growth / cap / recovery in degrees: AR `0.025 / 0.40 / 1.0 per second`; carbine `0.030 / 0.45 / 1.1`; SMG `0.035 / 0.55 / 1.4`; unprepared LMG `0.040 / 0.50 / 0.6`; DMR `0.12 / 0.28 / 0.7`; sniper `0.30 / 0.50 / 0.7`. Recovery starts after a 100 ms firing gap. This rewards controlled fire and prevents weapon switching from resetting accumulated instability.
- Track ready deadlines independently: reload, equip, sprint exit, and bolt cycle. A shot is allowed only after all required deadlines. Sprint-to-fire and ADS can run concurrently; aimed firing waits for the slower requirement. Hip fire can occur earlier, with its full hip spread.
- Attachments must trade benefits for costs: a larger magazine adds reload time/weight, faster handling sacrifices stability, and magnification adds ADS time/sway. No attachment combination should turn a compact SMG into a long-range rifle or an LMG into a fast-entry weapon.

## Support: earning a firing position

Use an LMG-only `stability` value from 0 to 1, owned by simulation.

1. Qualify only while grounded, aiming, outside reload/equip/sprint recovery, and moving below 0.15 m/s. Begin building after 250 ms of stillness; reach full stability after another 1.5 seconds.
2. Crouching beside valid support geometry or deploying a bipod reaches full stability in 0.75 seconds after that delay. Require an actual support query; being near a wall alone is insufficient.
3. Interpolate LMG ADS spread from 0.20 to 0.08 degrees, recoil multipliers from 1.0 to 0.70, and bloom growth/cap from `0.040/0.50` to `0.010/0.20`. Benefits are capped; damage and RPM never ramp with time.
4. Movement above 0.35 m/s, displacement exceeding 0.10 m from the anchor, jumping, sprinting, switching, death, or respawn resets stability. Intermediate motion does not build stability. Reloading removes half the current stability once and stops further buildup until completion. Traversing beyond 35 degrees from the established facing resets it, preventing instant flanking coverage.
5. A deployed bipod constrains traverse to its supported arc; movement exits deployment immediately. The player never receives an unbounded accuracy buff from idling or firing into a wall.

Sustained output includes reload downtime. For repeated full-magazine cycles, with an immediate empty reload after the last shot and immediate firing on completion, the ideal steady-cycle formula `magazine * damage / ((magazine - 1) * 60/RPM + emptyReloadSeconds)` gives about 182 torso DPS for LMG, 166 for SMG, and 158 for AR at near damage, before misses. Use the empty-reload durations here; a partial-reload strategy must instead model the rounds retained and actually fired. These are sanity checks, not claimed match results. Use measured shot/reload timelines, finite reserves, and moving targets in actual tests. The LMG's much longer firing window and stable medium-range fire matter as much as this average.

Suppression uses nearby hostile bullet trajectories, not a passive aura. A visible, unobstructed hostile trajectory passing within 1.5 m can build a capped threat indicator with approximately 0.75 s decay; cap contribution per attacker over time. Stop evaluating at the first blocking surface. Use peripheral/audio feedback without moving the target's aim, adding random misses, lowering damage, or making the center unreadable. Support produces more sustained pressure because it sends credible fire down a lane. Bots can respond by seeking cover; human players retain full aim control. Never grant rewards simply for firing at empty geometry.

## Recon: precision with a reaction cost

DMRs cover accurate medium-to-long-range follow-up fire. Snipers exchange follow-up speed, handling, and capacity for a reliable precision headshot. Both suffer strong hip/moving penalties. In addition to the table's movement multipliers, impose a moving ADS cone floor of 0.55 degrees for DMR and 0.80 degrees for sniper at movement speeds of at least 0.35 m/s. Blend that floor from zero to full between 0 and 0.35 m/s, taking the maximum of the resulting floor and the otherwise calculated spread. This keeps precision weapons from retaining near-perfect accuracy while strafing simply because their stationary spread starts very low.

Track this movement-instability contribution as state: after stopping, smoothly decay it to zero over 200 ms for DMR or 350 ms for sniper. Renewed movement raises it immediately. ADS tapping and weapon switching must not clear it early. Show matching reticle expansion/weapon sway and a clear stable sight picture rather than silently changing hit probability.

Optional sniper hold-breath steadies sway for up to three seconds, with a two-second recovery after release; it cannot cancel ADS time or recoil. High-magnification glint appears when aimed toward an observer with line of sight, giving long lanes readable counterplay. A miss still consumes ammunition and the complete bolt cycle. Switching, ADS tapping, and reloading must not bypass that cycle.

## Damage and projectile rules

Use `damage(d) = lerp(nearDamage, farDamage, clamp((d - falloffStart) / (falloffEnd - falloffStart), 0, 1))`. Avoid the current abrupt 28% damage drop and weapon-specific invisible range walls.

Velocity must change target leading and flight time. Simulate projectile travel, sweeping every traveled segment against geometry and actors to prevent tunneling; resolve only the nearest intersection along that segment. Query current target hit regions at collision time. Tracers are presentation, not hit authority. A cosmetic tracer or a delayed hitscan damage event does not implement ballistics.

Initial global game gravity for bullets: 6 m/s², with no wind or drag for the first implementation. Use a common 600 m travel cap and three-second lifetime as performance/simulation bounds beyond the intended combat envelope, not class effective ranges. Friendly actors and world cover stop bullets consistently. For future online play, the server owns projectile state and damage; clients predict visuals only.

## Implementation contract for this repository

Keep one shared weapon schema for simulation, menus, bots, and preview:

- Identity/access: `id`, `category`, `allowedClasses`, `slot`.
- Combat: near/far damage, falloff start/end, head multiplier, RPM/fire mode, recoil axes, bloom growth/cap/recovery, velocity, projectile lifetime.
- Ammunition: magazine, reserve, partial/empty reload durations and animation phase metadata.
- Handling: ADS/equip/sprint-to-fire times, hip/ADS spread, moving spread multiplier, ADS strafe multiplier, weight points, practical range band.
- Support/recon: stabilization parameters, settling time, optic magnification and sway configuration.

Per actor/loadout, separate `classId`, `selectedPrimaryId`, `selectedSidearmId`, and `equippedWeaponId`. Keep ammo/timers keyed by stable weapon IDs. `allowedPrimaryIds` is a catalog, while `carriedWeaponIds` contains exactly the selected primary and sidearm. Equip, fire, reload, respawn, and bot fallback validate the carried set.

Map existing weapons without reordering indices: AR 0 -> Assault; SMG 1 -> Engineer; pistol 2 -> shared sidearm; DMR 3 -> Recon; LMG 4 -> Support. Add carbine and sniper with new stable IDs. Migrate saved `scout` to `recon` before validation; use Recon in menus, HUD, roster, and class definitions. Preserve saved weapon selections when compatible; otherwise select the class default. Do not expose a fifth Scout class.

Current integration gaps:

- `src/loadouts.js`: split permitted categories/catalogs from the two carried weapons and migrate Scout saves.
- `src/weapons.js`: replace scalar spread and stepped falloff; centralize readiness gates so bots cannot bypass player-only checks; introduce projectile and hit-region logic.
- `src/movement.js`, `src/player.js`, `src/match.js`: add ADS progress, velocity-based movement penalties, loadout weight, and reset rules for handling/stability. Pausing freezes timers. Switching cannot cancel penalties tied to the weapon or sprint state.
- `src/bots.js`: use measured motion before shooting. Current bots clear `moving` before firing and then strafe, which can evade the moving penalty. Engineer should close through cover; Assault should contest medium lanes; Support should establish positions; Recon should hold stand-off positions. Shared perception/range and universal strafing cannot demonstrate distinct roles.
- `src/reload-animation.js`, `src/weapon-models.js`, `src/settings.js`, `src/renderer.js`: move new-family behavior to weapon metadata rather than extending numeric-index branches. Animation, FOV, and sounds consume simulation timing and never determine ammunition transfer or readiness.
- The existing arena is about 50 by 38 units, has ten actors, and uses a camera far plane of 120 with fog tuned for the yard. Add suitable longer test lanes, cover, rendering bounds, and scale/performance tests before claiming large-scale or extreme-range balance. Vehicle gameplay and anti-vehicle gadgets are separate work.
- Preserve shot scheduling remainder in the fixed-step loop. Measure actual RPM; resetting cooldown each 60 Hz tick can lower the configured cadence. Process due shots with simulation timestamps, without unbounded catch-up or multiple semi-auto shots from one press.

Suggested delivery order: class/save/schema migration -> shared handling and falloff -> Support positioning and bot behavior -> hit regions and projectiles -> Recon sniper and longer test lanes -> optional universals. Keep each phase separately testable.

## Balance acceptance gates

Measure new values on repeatable encounter scripts before tuning from public match averages:

- At 10, 40, 100, and 250 m, compare body/head breakpoints, measured fire cadence, first-hit time, target-leading error, and hit probability. Test equally skilled stationary, strafing, sprint-exit, and pre-aimed actors.
- Engineer should lead or tie close reactive encounters through handling/movement; Assault should win the broadest medium-range scenarios; Recon should lead precision hit reliability at long range; an established Support should lead 10/20/30-second lane-fire output including reloads and finite ammo.
- Include a flank, forced reposition, reload interruption, and low-ammo case. No class should lead all scenario groups. An existing advantage must be paid for in at least one other tested group.
- Verify Support buildup, cap, traverse boundary, actual-motion resets, respawn, switching, pause/resume, and reload decay. Verify suppression cannot pass through cover or impose aim displacement.
- Verify partial and empty reload timelines, ADS/sprint/equip concurrency, bolt-cycle preservation, projectile cover interception, head/body hit priority, and deterministic results at different render rates.
- Verify exactly four classes, Scout-save migration, universal slot rules, two carried weapons, class-consistent UI, and identical permission/readiness checks for bots and players.
- Test universals individually against their intended specialists. Reject upgrades that are equal or better in damage delivery, handling, precision, and endurance simultaneously.

No balance is considered validated from configuration values or a short software-renderer sample alone.
