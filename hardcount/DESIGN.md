# HARD COUNT — design notes and module contracts

HARD COUNT is a 7-on-7 tackle football game in the style of a 2003–2007 console
football game, shown on the same CRT picture as MIDNIGHT FREQUENCY, with the
set's cabinet taken off: a bare 4:3 tube as big as the window allows. It has
its own identity on top: varsity block lettering, HARD COUNT red and broadcast
gold. Full pads, real contact, real ball physics, laterals as a core mechanic. Plain ES modules + three.js r160 (`../vendor/three.module.js`), no
build step, no art or audio files: everything is generated in code.

## Look and feel

- **The picture.** The page (`index.html`, `style.css`) is only the tube: 4:3,
  as tall as the window (letterboxed on wide screens), rounded tube corners,
  curved glass with an edge shadow and a glare, the screen's light on the wall
  behind it. The 3D picture renders at a CRT-ish internal resolution (480/600/720
  lines, 4:3) into an HDR target, then bloom and the CRT pass (curvature,
  aberration, ACES, grading, scanlines, aperture grille, snow, tearing, vignette).
  The bloom chain and the final pass drop NaN/Inf texels, tested by their bit
  pattern (`x == x` gets optimised away by some shader compilers). The 2D UI is
  drawn into a 1024×768 canvas that goes *under the glass*, so menus get the same
  curvature and scanlines. Screen changes are channel changes (static bursts).
  See `src/core/renderer.js`, `src/main.js`.
- **The UI kit** (`src/core/ui.js`, `src/core/font.js`): slanted smoked-glass
  panels in graphite, HARD COUNT red `#ff3a2c` / broadcast gold `#ffd23a`
  accents, and for titles and numbers the varsity block stroke font (`vText`):
  condensed, heavy, upright, square-cornered, the jersey and end zone lettering.
  Titles go in jersey twill (`twill`: white letters, red tackle-twill border,
  black edge) with a red network-bug `tag` under them; headers sit on two sleeve
  `stripes`. Body text is a condensed sports gothic (Franklin Gothic on Windows,
  Arial Narrow on macOS). PlayStation glyphs switch to keyboard keycaps when the
  keyboard is in use. The resemblance to MIDNIGHT FREQUENCY is the picture, the
  panels and the menu language; the type and the colours are HARD COUNT's own.
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
  index.html, style.css     the bare picture tube
  src/main.js               loop, screen manager, transitions, auto quality
  src/core/                 renderer, input, ui, font, menu, settings, util, envmap
  src/audio/                audio core, sfx, crowd, music engine + themes, voice
  src/sim/                  headless football sim (no three.js): field, anims contract,
                            physics, ball, rules, plays, AI
  src/data/                 teams, rosters, names, schedules, career data
  src/gfx/                  geo/texture helpers, logos, player/ (models + animation),
                            stadium/ (venues, field paint, crowd, scoreboard), fx/ (weather)
  src/match/                the broadcast around the sim: frame (sim snapshot), world (3D
                            bridge), camera, hud, wristband (play calling), playart,
                            controls (pre-snap, kick meter), commentary (the booth),
                            officials, replay, sound, statsview, practice (the drills)
  src/career/               Road to Glory engine (seasons, offers, draft, awards, saves)
  src/screens/              boot, huddle (main menu), cointoss (Free Play setup), match,
                            options, records (Hall of Fame), practice, playbook, career,
                            QA screens (gallery, venueview, logosheet, soundboard, sim2d)
  tools/                    simgame.mjs / playbench.mjs (headless sim), drive.mjs (drive
                            the real game in Chromium, virtual DualSense), shot.mjs
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
the stride phase driven by distance travelled so feet don't skate:

- **Arms** swing fore and aft from the shoulder (`armFlex`): the upper arm's
  twist follows its plane so the elbow hinge stays level and the forearm never
  folds across the chest or flares out; bent tight at the front of the swing,
  opening behind, the hands converging toward the sternum but never past it.
- **Legs**: planted feet stay put in the world, yaw included; the swing foot
  flies a keyed path (walk, jog, sprint, low shuffle, blended by gait): toe-off,
  the heel recovering up under the hips, the knee driving through, the reach and
  the paw back down under the body.
- **Trunk**: leans into acceleration, banks into a real turn as much as the
  lateral grip asks (from the travel direction's smoothed turn, with a deadzone,
  never from heading jitter), drops on a hard cut; the head is stabilised.
- **No arms through the body**: after the IK the animator pushes the elbows,
  forearms, wrists and hands out of the jersey (`dims.torso`, the build's own
  cross-sections from `torsoProfile`) and re-solves the arm, eased in by depth.

**Builds.** `makeBuild(player)` reads height, weight, `look.bodyType` and three
look fields every roster player has (drawn from the player's own seed, so they
never shift names, ratings or ids; Road to Glory players pick the first two):
`look.muscle` 0..1 (arm, leg, neck and chest girth, and the definition of the
biceps, triceps, forearms and calves), `look.pads` 0..1 (slim skill pads → big
lineman pads: width, depth and how tall the arch stands) and `look.face`
`{ jaw, chin, nose, brow, cheek, len }` each −1..1 (the face below the brow only:
the cranium the hair and helmet sit on never changes). The jersey sleeve is
geometry, stretched over the pad cap down to a hem just below the pads
(`SLEEVE_HEM`, shared with the painter); the collar is a V-neck under a visible
neck. Heads have real facial thirds and a dense face grid; the painted features
ride on the (λ, φ) grid so paint and shape always agree.

Budgets: ≤ 6 draw calls and ~7.5k triangles per player at `high` (the face
grid is most of the growth), ≤ 3 calls / ~2k triangles at `low`; ≤ 24 bones; one ≤ 512² uniform atlas per player plus a
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
sfx.pa('chime' | 'horn' | 'organ_charge' | 'organ_defense' | 'organ_letsgo'); sfx.footsteps(0..1);
sfx.prewarm(keys?)                           // render buffers now (behind LOADING); first use renders on the spot
band.play('cadence' | 'fight' | 'charge' | null)
crowd.update(dt, { excitement, size, home, indoor }); crowd.react(kind, strength, 'home' | 'away' | 'all');
crowd.prewarm(keys?)
music.play(theme, { fade }); music.stinger('td' | 'turnover' | 'bigplay' | 'kickoff' | 'win' | 'lose' | 'twominute');
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
| Play call | stick / D-pad across the wristband, L1 R1 formation sets, ✕ call, △ flip, □ coach's pick [arrows or WASD, Q/E, K, I, J] |
| Pre-snap offense | ✕ snap, □ hard count, △ audible, R1 hot route, L1 motion |
| Pre-snap defense | ◯ switch player, △ audible, L stick shift your man (careful: offside) |
| QB | face button = throw to that receiver (tap = touch, hold = bullet), hold L2 and the stick leads it (or PASS LEAD: MANUAL), L1 pump, R3 throw away; run plays hand off by themselves, the option rides and reads by itself until the stick is touched (✕ give, △ keep, L1 pitch) |
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
possessions. Penalties (setting): offside, delay of game, holding, pass
interference, illegal forward pass, intentional grounding, roughing the passer,
face mask. (A defensive lineman can jump offside at a hard count; a person's
defender lined up over the ball at the snap is offside.)

## The match screen — `src/screens/match.js` + `src/match/`

The sim steps at a fixed 60 Hz (`stepSim`, catching up to 8 steps on a slow
frame); after every step `captureFrame(m, refs)` takes a plain snapshot of the
bodies and the ball, and that frame is all the 3D world, the cameras, the
replay tape and the HUD ever read. Stages: `intro` → `toss` → `game` (the sim's
own phases: playcall / kickoff / pat → presnap → live → post → penalty /
halftime / final) with `replay` and `pause` on top.

- A person controls one man per side (`m.userEnt`); the sim asks `userControl`
  (`src/sim/user.js`) each tick, which may return `'ai'` to let the man's own
  brain run: the kicking unit until the kick is away, a career man who leaves
  the stick alone, a QB's run/option footwork until the stick is touched.
- After a handoff the person takes the carrier (`m.userTakes`) unless he still
  has a scripted trick-play pitch or handoff to make; after a catch, lateral or
  recovery they take whoever has it; after a kickoff or punt they take the cover
  man nearest the landing spot.
- The person's snap on a jet sweep sends the jet man and snaps the ball to meet
  him (`m.snap()` arms, `presnapStep` fires `m.snap(true)`).
- Params: `home`, `away`, `user` (home | away | both | none), `p1`, `difficulty`,
  `qlen`, `venue`, `time`, `weather`, `field`, `seed`, `mode` (free | career |
  practice), `drill`, `lock` / `lockReturns` / `rosters` (career), `onDone`,
  `returnTo`; QA: `qa=play` (first and ten), `qa=kick&kicking=home|away`.
- The stadium boards get `{ home: {abbr, score, timeouts}, away, quarter, clock
  ('M:SS'), playClock, down, toGo, ballOn, possession, msg }`; at halftime and
  the final the camera looks up at the venue's `cams.scoreboard`.

## Practice — `src/match/practice.js`

A `Drill` rides inside the match screen: `start(m)` sets the first situation,
the screen hands it each play's result (`pending`) and it `settle`s once the
sim has applied it (after any penalty decision), writing the rep on the
clipboard and putting the ball back (`reset`). Drills: offense and defense reps
from the 25, the two-minute drill (Q4 2:00, down 17–21, three timeouts; a lead
wins, a field goal, turnover, downs or the clock loses), the field goal ladder
(ten kicks from 25 yards, five more after every make) and kick returns. No
crowd, no booth, no play clock (except the two-minute drill); the coach talks in
the captions. Bests are kept in `practiceBests`.

## Road to Glory — `src/career/career.js` + `src/screens/career.js`

`newCareer` → a high school senior season (and its playoffs) → `endSeason`
returns the next event: `signing` (offers by star rating) → college (declare
after year 3, `runDraft` ranks you by ratings, production and awards) → `draft`
on TV → pro seasons → `retireOption` (forced at 34, or after eight pro seasons) → `retire` makes
the Hall of Fame plaque. `matchParams(c)` builds the match (your team's roster
with you on its depth chart, `lock` on your man); `applyGame(c, result)` grades
the game, adds XP and texts, sims the rest of the week and advances the season.

## QA

- `node hardcount/tools/simgame.mjs N` — N CPU-vs-CPU games: points, plays,
  completion, sacks, laterals, flags, FG, and *stuck* plays (should be 0).
- `node hardcount/tools/playbench.mjs run|pass|all N [--off id] [--def id]`.
- `node hardcount/tools/drive.mjs "<query>" steps.json` — drives the real game in
  headless Chromium (software WebGL, ~7 fps: timing-sensitive steps should use
  `until`). `{ dualsense: true }` plugs in a virtual DualSense whose presses are
  held until the game has polled them; rumble lands in `window.__rumbles`.
  `{ manual: true }` switches the game to deterministic frames, advanced with
  `{ frames: n }` or filmed with `{ film: { n, every, prefix } }` (fixed 1/60 s
  steps whatever the real frame rate: contact sheets of real plays). `VW` / `VH`
  set the viewport size.
- `screen=gallery&mode=stride&speed=10&n=7` lays one runner out as a filmstrip
  across his stride; `mode=clip&action=…` does the same for any action.
