# Container Strike

A tactical first-person shooter set in a shipping-container yard, built for the
browser with three.js — no build step, no assets, everything (weapon models,
map textures, and every sound) generated procedurally at runtime.

## Run it

From the repository root:

```
python3 serve.py            # or: python3 -m http.server 8000
```

then open `http://localhost:8000/container-strike/` and hit **DEPLOY**.

Requires a WebGL-capable browser. Pointer lock is used for mouse look.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move (tap the opposite key to counter-strafe to a stop) |
| Shift | Walk — silent footsteps |
| Ctrl | Crouch — tighter spread, slower |
| Space | Jump |
| Mouse 1 | Fire / throw grenade (release) |
| Mouse 2 | Scope (AUG/SG/snipers) · heavy knife swing · underhand throw |
| R | Reload |
| B | Buy menu (freeze time + first 10 s, near spawn) |
| 1 / 2 / 3 / 4 | Primary / pistol / knife / cycle grenades |
| Mouse wheel | Cycle weapons |
| E | Pick up dropped weapon |
| G | Drop current weapon |
| Tab | Scoreboard |
| Esc | Pause / settings |

## The game

5v5 elimination, first to 13 rounds, sides swap at halftime. You play alongside
four bot teammates against five bot enemies (Easy / Normal / Hard).

### Gunplay

- **35 weapons** with faithful stats: damage, armor penetration, fire rate,
  magazine sizes, reload times, movement speed, range falloff, and wall
  penetration power. CT-exclusive (M4A4, AUG, FAMAS, …), T-exclusive (AK-47,
  Galil, SG 553, …), and shared arsenals are enforced in the buy menu.
- **Deterministic recoil**: every weapon has a fixed spray pattern seeded from
  its name — the same climb-then-sway every round, every session. Learn it,
  pull against it.
- **Movement accuracy**: spread balloons past ~34 % of max speed and in the
  air. Counter-strafing (tapping the opposite key) brakes roughly twice as
  fast as coasting, so you can stop-and-shoot in a few frames. The crosshair
  gap tracks your live inaccuracy.
- **Penetration**: container walls are thin metal — rifles wallbang through
  them (damage reduced per surface). Wooden crates are soft; concrete
  perimeter walls stop everything.
- **Sub-tick input**: simulation runs at a fixed 64 Hz, but trigger pulls are
  processed straight from input-event timestamps, so fire timing never
  quantizes to frame boundaries.

### Utility

Flashbang (view-angle + line-of-sight blind, with ear-ring), HE grenade
(obstruction-aware damage), Smoke (blocks bot vision; the cloud is displaced
by HE blasts and punched through by bullets, then drifts back), Molotov /
Incendiary (area denial — smokes extinguish them), and Decoy (fake gunshots
and radar blips).

### Economy

$800 pistol rounds, win reward $3250, escalating loss bonus $1400→$3400,
per-weapon kill rewards (SMGs $600, shotguns $900, AWP $100, knife $1500),
$16 000 cap. Survivors keep their guns; the dead respawn with a starter
pistol. Bots manage their own economy — they force-buy, save, and full-buy.

### Sound

Everything is synthesized with WebAudio and positional (HRTF): footsteps
(running only — walking is silent), gunshots with per-class voicing and
suppressed variants, reloads, bounces, explosions and fire crackle. Bots
*hear*: running past an enemy or spraying a wall reveals your position to
them, exactly like it reveals theirs to you.

## Code layout

```
container-strike/
  index.html          UI shell: HUD, buy menu, scoreboard, menus
  src/
    main.js           bootstrap + fixed-tick loop
    state.js          shared game context (G)
    weapons.js        all 35 weapon defs, recoil generator, grenades, economy data
    world.js          container-yard map, colliders, penetration materials, A* nav
    player.js         movement, counter-strafe, camera, input
    entity.js         shared combatant state (inventory, armor, ammo)
    combat.js         hitscan + penetration, damage, viewmodel animation, drops
    grenades.js       all six grenades, reactive smoke, fire areas, flashes
    bots.js           bot AI: perception, engagement, pathing, buying
    game.js           round state machine, economy, halftime
    hud.js            DOM HUD, radar, killfeed, buy menu
    audio.js          procedural WebAudio synthesis, positional sound
    models/           procedural weapon models (one file per family)
  test/
    checkmodels.mjs   node contract check for every weapon model
    smoke-browser.mjs headless Playwright smoke test of the full game
```

three.js r160 is vendored at `vendor/three.module.js` (repo root).

## Tests

```
node container-strike/test/checkmodels.mjs          # model contract for all 42 models
node container-strike/test/smoke-browser.mjs        # full-game headless smoke test
```
