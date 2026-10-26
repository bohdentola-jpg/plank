# HARD COUNT — design notes and module contracts

HARD COUNT is a 7-on-7 tackle football game in the style of a 2003–2007 console
football game, played on the same NOVATRON CRT TV in a dark room as MIDNIGHT
FREQUENCY. Full pads, real contact, real ball physics, laterals as a core
mechanic. Plain ES modules + three.js r160 (`../vendor/three.module.js`), no
build step, no art or audio files: everything is generated in code.

## Look and feel

- **The TV.** The 3D picture renders at a CRT-ish internal resolution (480/600/720
  lines, 4:3) into an HDR target, then bloom and the CRT pass (curvature,
  aberration, ACES, grading, scanlines, aperture grille, snow, tearing, vignette).
  The 2D UI is drawn into a 1024×768 canvas that goes *under the glass*, so menus
  get the same curvature and scanlines. Screen changes are channel changes
  (static bursts). See `src/core/renderer.js`, `src/main.js`.
- **The UI kit** (`src/core/ui.js`, `src/core/font.js`): slanted smoked-glass
  panels, amber `#ffb21e` / cyan `#46e8ff` accents, the chamfered italic stroke
  font (`vText`) for titles and numbers, Bahnschrift-style body text, PlayStation
  glyphs that switch to keyboard keycaps when the keyboard is in use.
- **Graphics target:** a good-looking 2005 console game, not a modern one.
  Chunky but well-proportioned bodies, glossy helmets catching the floodlights,
  real team colours, readable numbers, painted fields with wear, crowds that move,
  bloom on the lights. Roughness is welcome; noise, mud, grain and the CRT do the
  rest.
- **Diegetic menus.** Main menu = first-person QB in the huddle, calling the mode
  off the play card on his wristband (each mode has its own stadium PA music).
  Free Play setup = the coin toss at midfield with the two captains. Options =
  the TV's own on-screen menu (blue OSD). Replays = a VCR / broadcast replay.
  Road to Glory hub = your flip phone in your bedroom/dorm/apartment. In-game =
  a TV broadcast package (score bug, yellow first-down line, closed captions).

## Directory map (who owns what)

```
hardcount/
  index.html, style.css     the TV set (same as MIDNIGHT FREQUENCY)
  src/main.js               loop, screen manager, transitions, auto quality
  src/core/                 renderer, input, ui, font, menu, settings, util, envmap
  src/audio/                audio core, sfx, crowd, music engine + themes, voice
  src/sim/                  headless football sim (no three.js): field, anims contract,
                            physics, ball, rules, plays, AI
  src/data/                 teams, rosters, names, schedules, career data
  src/gfx/                  geo/texture helpers, logos, player/ (models + animation),
                            stadium/ (venues, field paint, crowd, scoreboard), fx/ (weather)
  src/game/                 the match: sim ↔ 3D bridge, cameras, HUD, controls, replay, presentation
  src/screens/              boot, huddle (main menu), cointoss, match, options, records,
                            practice, playbook, career/*, QA screens (gallery, venueview…)
  tools/                    shot.mjs (screenshots), headless sim bench, e2e tests
```

## Units and coordinates

World units are **yards** in the sim *and* the 3D scene (models are built in
metres and scaled by `M_TO_YD`). `x` runs across the field (sideline to
sideline), `z` along it, `y` up. Goal lines at `z = ±L/2`, midfield `z = 0`.
Gravity 10.73 yd/s². See `src/sim/field.js` (`makeField('sevens' | 'full')`).

The default **SEVENS** field is 80 yards goal line to goal line, 40 yards wide,
10-yard end zones, hash marks 10 yards apart, yard numbers 10-20-30-40-30-20-10.
FULL is a regulation 100 × 53⅓ field.

Headings: `heading = atan2(dirX, dirZ)` (0 faces +z); a model faces its heading
with `group.rotation.y = heading`. Facing +z, +x is the player's **left**.

## Teams, rosters, logos

- `src/data/teams.js` — team schema (documented at the top of the file) and the
  league. Uniform kits drive every jersey, pants, sock, glove and helmet colour.
- `src/data/roster.js` — deterministic rosters per team id: ratings (0–99, keys
  listed in the file), builds (height in inches / weight in lbs by position),
  numbers by position convention, and `look` (skin tone, hair, eye black, visor,
  sleeves, gloves, towel, facemask style, body type).
- `src/gfx/logos.js` — `drawLogo(ctx, team, cx, cy, size, opts)`,
  `logoCanvas(team, px)`, `logoTexture(team, px)`.

## Player models and animation — `src/gfx/player/`

```js
import { createPlayerModel, createRefModel } from './gfx/player/index.js';
const m = createPlayerModel({ team, kit: 'home' | 'away', player, lod: 'high' | 'low' });
scene.add(m.group);            // root at the feet, units = yards, faces +z at heading 0
m.update(dt, A);               // A = animation state (src/sim/anims.js), every frame
m.setKit(team, kit);           // swap uniform (menus)
m.setPlayer(player);           // number, name on back, look, build
m.setDirt(0..1);               // grass stains / mud build up through a game
m.ballTransform(carry, pos, quat); // world transform for a carried/held ball
m.headWorld(out); m.handWorld('L' | 'R', out);
m.dispose();
```

`src/sim/anims.js` is the contract: the animation state `A`, the `BASES` and
the `ACTIONS` with their durations and key moments (ball release, catch,
contact). The sim owns timing: `A.action.t` is the time since the action began.
Locomotion (walk → jog → run → sprint, backpedal, shuffle, carrying) is
synthesised from `speed`, `moveAngle`, `accel`, `turnRate` and `effort`, with
the stride phase driven by distance travelled so feet don't skate.

Budgets: ≤ 6 draw calls and ~6k triangles per player at `high`, ≤ 3 calls /
~2k triangles at `low`; ≤ 24 bones; one ≤ 512² uniform atlas per player plus a
shared helmet decal per team. 14 players + 3 officials + sideline extras must
hold 60 fps on a mid-range laptop at 600 lines.

## Venues — `src/gfx/stadium/`

```js
import { VENUES, buildVenue } from './gfx/stadium/index.js';
const v = await buildVenue(renderer, {
  venue: 'friday', field: makeField('sevens'), home, away,
  time: 'day' | 'dusk' | 'night', weather: 'clear' | 'overcast' | 'rain' | 'snow' | 'fog',
  wind: 0..1, crowd: 0..1, quality: 'high' | 'low',
});
v.scene                // THREE.Scene: field, stadium, lights, sky, crowd (the match adds players + ball)
v.post                 // renderer.setPost() parameters for this venue / time / weather
v.update(dt, { camera, time, excitement, reaction, homeHasBall, ball })
v.setScoreboard({ home: {abbr, score, timeouts}, away: {…}, quarter, clock, playClock, down, toGo, ballOn, possession, msg })
v.setMarkers({ los, firstDown, dir, show })  // chain crew + down box, broadcast LOS (blue) / 1st-down (yellow) lines
v.focusShadow(x, z, radius)                  // fit the shadow camera to the action
v.flashes(rate)                              // camera flashes in the stands
v.dispose()
```

Venues: `friday` (small-town high school, night), `college` (big college bowl),
`bayside` (Port Halcyon's waterfront pro stadium), `dome` (indoor pro),
`foundry` (industrial pro stadium), `snowbowl` (old cold-weather horseshoe),
`park` (city park field with a chain-link fence — pickup games and practice).

## Audio — `src/audio/`

```js
sfx.ui('move' | 'select' | 'back' | 'tab' | 'error'); sfx.staticBurst(s); sfx.tvOn();
sfx.whistle('short' | 'long' | 'double'); sfx.hit(strength, 'pads' | 'helmet' | 'ground');
sfx.catchBall('hands' | 'body' | 'bobble'); sfx.kickBall('kickoff' | 'punt' | 'fg');
sfx.snap(); sfx.cadence('set' | 'hut' | 'hard'); sfx.ballBounce(strength);
sfx.pa('chime' | 'horn' | 'organ_charge' | 'organ_defense'); sfx.band('cadence' | 'fight' | null);
crowd.update(dt, { excitement, size, home }); crowd.react('cheer' | 'roar' | 'ooh' | 'groan' | 'boo' | 'gasp' | 'chant' | 'stomp', strength);
music.play(theme, { fade }); music.stinger('td' | 'turnover' | 'bigplay' | 'win' | 'lose');
voice.say(text, { kind: 'pa' | 'ref' })      // optional speech synthesis, settings.announcer
```

Menu themes (one per huddle wristband line): `hud_glory` (cinematic brass),
`hud_free` (2000s rock), `hud_practice` (drumline), `hud_book` (boom-bap),
`hud_hof` (stadium organ / brass), `hud_options` (TV smooth jazz). Game:
`playcall`, `pregame`, `halftime` (band), `postgame_win`, `postgame_loss`,
`career_hub`, `draft`.

## Controls (DualSense; keyboard in brackets)

| Situation | Controls |
| --- | --- |
| Menus | D-pad / stick, ✕ select, ◯ back, L1/R1 tabs [arrows, Enter, Esc, Q/E] |
| Play call | ← → plays, ↑ ↓ / L1 R1 formation sets, ✕ call, △ flip [A/D, W/S, Enter, I] |
| Pre-snap offense | ✕ snap, □ hard count, △ audible, R1 hot route, L1 motion, R stick look |
| QB | face button = throw to that receiver (tap = touch, hold = bullet), L stick leads, L1 pump, R2 scramble, R3 throw away |
| Ball carrier | R2 sprint, L1 lateral/pitch, ✕ dive, ◯ spin, □ stiff arm, △ hurdle, R stick juke ← → / truck ↑, R1 protect ball |
| Receiver (ball in air) | △ jump catch, ✕ dive catch, ◯ possession catch, L stick drift to the ball |
| Defense | ◯ switch player, ✕ tackle / dive, R stick ↑ hit stick, ↓ cut tackle, □ swat / strip, △ jump / play the ball, R2 sprint |
| Kicking | L stick aim, ✕ start the swing, ✕ power, ✕ accuracy |
| Anytime | OPTIONS pause, touchpad timeout, CREATE instant replay |

Keyboard play: WASD move, arrows = right stick, K/Space ✕, L ◯, J □, I △,
Q L1, E R1, Z L2, Shift R2, R CREATE, Esc OPTIONS, T touchpad, C L3, V R3.

## Rules (SEVENS)

Seven a side in full pads: QB, center, two guards and three skill players on
offense (RB/WR/TE in any mix, by formation); two linemen, two linebackers, two
corners and a safety on defense (formations realign them). Four downs to gain
ten. TD 6, PAT kick 1 (from the 5) or two-point try 2 (from the 3), FG 3,
safety 2. Kickoffs from the 20, touchbacks to the 20. One forward pass per play
from behind the line; backward passes (laterals) any time, anywhere — a lateral
that hits the ground is a live ball. Quarter length is a setting (accelerated
clock between plays). Clock stops on incompletions, out of bounds in the last two
minutes of each half, scores, changes of possession and timeouts (3 a half).
Overtime: alternate possessions from the 20 until someone leads after equal
possessions. Penalties (setting): offside/encroachment, false start on a hard
count jump, delay of game, holding, pass interference, illegal forward pass,
intentional grounding, roughing the passer, face mask.
