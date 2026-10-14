# MIDNIGHT FREQUENCY

An early-2000s street racer that runs in the browser, on a CRT TV in a dark room.
It has a free-race mode where you pick a real-ish car and a road, and a story
mode where you buy a beater from the classifieds, build it up in a borrowed
garage, and take Port Halcyon crew by crew. It has full 3D, a dynamic soundtrack
and real driving physics. There is no install and no build step.

## Run it

**Windows:** double-click **`race.bat`** in the repo root. It starts a tiny local
server and opens the game in your browser. It uses Python if you have it and
otherwise falls back to Windows' built-in PowerShell (`serve.ps1`), so nothing
needs installing.

**Mac / Linux:** from the repo root run `python3 serve.py --open racing/` (or
`python3 serve.py` and browse to `http://localhost:8000/racing/`).

You need a recent Chrome, Edge or Firefox (plus Python 3 on Mac/Linux). Plug in a **PS5 DualSense**
(USB or Bluetooth) before or after loading, and press any button to turn the TV on.
Xbox and other standard pads work too, and so do keyboard and mouse.

## Controls

| Action | DualSense | Keyboard |
|---|---|---|
| Steer | Left stick | A / D or ← → |
| Gas / Brake–reverse | R2 / L2 | W / S or ↑ ↓ |
| Drift | L2 + steer at speed | S + A / D |
| Handbrake | □ | Space |
| Nitrous | ✕ | Shift |
| Shift up / down (manual) | R1 / L1 | E / Q |
| Camera (4 views) | △ | C |
| Look back | ◯ | B |
| Reset car | CREATE | R |
| Pause | OPTIONS | Esc / P |
| Menus | D-pad / stick, ✕ select, ◯ back, L1/R1 tabs | arrows, Enter, Esc, Q/E |

The DualSense rumbles on curbs, impacts, landings and launches. You can turn that
off in Options.

## The main menu is a car radio

You're sitting in your car at a red light, at 2 AM in the rain. Tune the dial
with ← → or the left stick. Static fills the gaps between stations, and each
station is a mode with its own music:

- **NITRO 88.1 — Quick Race.** You walk the row of cars at the Friday meet on
  level P2 of a parking garage. ← → picks a car, L1/R1 jumps class, ↑ ↓ changes
  the paint. The car you stop at fires up its own engine. Then you plan the
  route: region, track, race type, laps, rivals, skill, catch-up and traffic.
- **THE UNDERGROUND 92.7 — Story.**
- **HALL OF FAME 97.9 — Records.** Brass plaques with your best lap per road,
  the car that set it, and wins and races.
- **TALK 104.5 — Options.** This is the TV's own on-screen menu: CRT strength,
  sharpness (internal resolution), auto quality, volumes, units, gearbox,
  assists, camera, vibration, and the full control list.

## Story: "Who runs Port Halcyon?"

You arrive with $8,000. Rosa lends you her late father's body shop, Santos Auto
Body. Buy a used car from the Halcyon Gazette's classifieds, then work through
five crews and their territories:

1. **Kings of Main** (downtown): boss **Dez**
2. **Harbor Rats** (the docks): boss **Tank**
3. **Kaido Ghosts** (the mountain pass): boss **Kaito**
4. **Route 99 Syndicate** (the desert): boss **Vex**
5. **The Frequency** (highway and raceway): boss **Zero**

Each crew has five events plus a boss race (30 races in total). The events are
circuits, sprints, knockouts, drags, drift, and time attack against a pro's
ghost. Win four of a crew's races and its boss calls you out. The plot comes
through text messages on your flip phone.

In the garage you can:
- **Performance:** engine, forced induction (a supercharger on the big
  engines), intake/exhaust, ECU, transmission, suspension, tires, brakes,
  weight reduction, nitrous and aero. Every part has STREET, PRO and RACE tiers;
  higher tiers unlock as you beat crews. Every purchase shows its effect on
  measured stats and on your performance rating (PR). Rivals are tuned to each
  event's PR.
- **Body shop:** paint and finish (gloss, metallic, pearl, candy, matte,
  chrome), vinyls, rims (style, finish, size), body kits, spoilers, hoods, tint,
  underglow, ride height and calipers, all previewed live on the car.
- **Cars:** a three-bay garage and the dealer lot. Classes unlock by chapter, and
  cars sell back at 60%.

Progress saves itself in your browser. To start over, use Options › Game ›
Erase story save.

## Racing

- **Race types:** circuit, sprint, lap knockout, drag (manual shifting on a shift light, graded launches and upshifts),
  drift (angle × speed scoring with a multiplier chain that a crash wipes out),
  and time attack (a pro drives your exact car first; you chase the ghost and
  the target time).
- **Handling:** steering on the gas or coasting grips. The car corners at
  the limit, and pushed too hard it runs wide instead of swapping ends. A
  steering limiter means a full-lock stab on keys or the stick still corners
  at peak grip. **Brake while you turn at speed and the tail comes out:** that's
  a drift. Go back to the gas to hold it, steer into the turn for more angle
  (up to about 40°) or out of it to straighten up, and flick the other way to
  link the next corner. Stay on the brakes through the slide, or let the angle
  run away, and you spin. Drifts carry their speed, and the chase camera
  swings to show where the car is going.
- **Physics:** a 120 Hz tire model with load transfer, load-sensitive
  cornering stiffness, combined slip (a braking or driving tire has less left
  for cornering), ABS and brake balance, traction control and stability control
  (assists on; off means you own every slide, and drift events always run
  loose), wheelspin, clutch launches, a real gearbox in auto or manual, turbo
  lag and blow-off, nitrous, drafting, jumps and landings, and car-to-car
  contact. Kerbs and sidewalks are bumps the springs soak up, not ramps, and a
  glancing hit on a wall slides you along it instead of stopping you dead.
- **AI:** drives the racing line on the same physics, overtakes and defends,
  picks gaps in traffic by time to collision, catches its own slides, backs out
  of walls, uses nitrous, makes the occasional mistake, and has optional
  catch-up.
- **Traffic:** two-way city traffic, freeway traffic with trucks, near-miss
  nitrous bonuses, and wrecked civilians that recover.
- **HUD:** tach, digital speed, gear, boost and nitrous, a heading-up radar
  minimap that zooms out with speed, live standings with gaps, lap and best
  times, and a countdown with launch grading. Across the line, the results
  board follows in a few seconds (✕ / Enter skips straight to it).
- **Instant replay:** after any race, WATCH REPLAY plays the whole race back
  like a late-night TV broadcast. A director cuts between trackside cameras
  that pan and zoom as the pack goes by, a helicopter, a camera car, a wheel
  cam and the chase view. A VCR's transport controls it: ✕ play/pause, L1/R1
  rewind and fast-forward with tracking noise, ← → to follow another car, △
  to pick the camera, ◯ to stop the tape.

## Tracks (16)

| Region | Track | Type | Time / weather |
|---|---|---|---|
| City | Downtown Loop | circuit | night, wet |
| City | Uptown Run | sprint | night, rain |
| City | Old Town | circuit | dusk |
| City | Downtown Reverse | circuit | night |
| City | Old Town Reverse | circuit | night, rain |
| Docks | Harbor Docks | circuit | night, wet |
| Docks | Pier 9 | circuit | night |
| Highway | Interstate 9 | sprint | night, wet |
| Highway | Skyline Expressway | circuit | dusk |
| Raceway | Redwood Raceway | circuit | day |
| Raceway | Crestwood Hills | circuit | sunset |
| Mountain | Kaido Pass | sprint | dusk |
| Mountain | Summit Loop | circuit | night, fog |
| Desert | Route 99 | sprint | day |
| Desert | Red Rock Canyon | circuit | sunset |
| Desert | Dry Lake Drag | drag | sunset |

## Cars (16)

Five classes run from tuner hatches to exotics:
- **D:** Honshu Civica SiR, Volker Golfo GTi, Toyoshi Trueno 86, Mazura Miyako MX
- **C:** Nikko Silvio S15, Nikko 350X
- **B:** Seiryu Kaze STi, Mitsuma Lancet Evo VIII, Mazura RZ-7, Falcon Stallion GT, Bavaria M3 CSR
- **A:** Toyoshi Suprano RZ, Nikko Skyhawk GT-R
- **S:** Stuttgard 996 Turbo, Dixon Venom GTS, Lamberti Pipistrello V12

Every car is generated procedurally: lofted bodies, painted canvas textures,
working head, tail and brake lights, and nine rim styles. Each car also has its
own synthesized engine (I4, I6, V6, V8, V10, V12, flat-6, boxer, rotary) with
turbo whistle, blow-off, backfires and pops.

## Under the hood

- three.js r160, plain ES modules (`racing/src`), no bundler.
- **Renderer:** the 3D picture is drawn at a CRT-ish internal resolution (480,
  600 or 720 lines, 4:3) into an HDR buffer, then goes through dual-filter bloom
  and a final pass with tube curvature, aberration, ACES tonemapping, grading,
  scanlines, aperture grille, snow static, interference and vignette. The page
  frames it in a CSS TV set.
- **Audio:** all procedural WebAudio. Engines, SFX, and a 14-theme dynamic
  soundtrack (DnB, boom-bap, 2-step, jazz, house, big beat, eurobeat, trance,
  rock). The music reacts to the countdown, position, final lap, nitrous, air
  time and crashes.
- **Dev URL params:** `?screen=race&track=downtown&car=lancet&type=drift&traffic=1`,
  `?autopilot=1&sim=4` (the AI drives you, four times faster),
  `?screen=carlab&car=m3`, `?screen=trackview&track=kaido`.
- **Headless tools** (`racing/tools`):
  - `simrace.mjs`: AI-only race report.
  - `physbench.mjs`: 0-60, top speed, braking and skidpad.
  - `shot.mjs`: screenshots.
  - `sheet.mjs`: car contact sheet.
  - `perf.mjs`: track build and draw-call report.
  - `aibench.mjs`, `traffic_eval.mjs`: AI lap/contact benchmark and traffic cost.
  - `tour.mjs`: contact sheet of camera stops along each track.
  - `carviews.mjs`: car model grid from any set of camera angles.
  - `e2e_story.mjs`, `e2e_flow.mjs`: story-mode and menu-flow end-to-end tests.
  - `typesweep.mjs`: every race type driven to the results and replay.
