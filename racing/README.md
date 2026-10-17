# MIDNIGHT FREQUENCY

An early-2000s street racer that runs in the browser, on a CRT TV in a dark room.
It has a free-race mode where you pick a real-ish car and a road, a story
mode where you buy a beater from the classifieds, build it up in a borrowed
garage, and take Port Halcyon crew by crew, and a free roam where you drive
the whole map, every road in town joined up by tunnels. It has full 3D, a dynamic soundtrack
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
| Drift | hold L2 (or □) while steering at speed, let go to straighten up | hold S (or Space) while steering, let go to straighten up |
| Handbrake | □ | Space |
| Nitrous | ✕ | Shift |
| Shift up / down (manual) | R1 / L1 | E / Q |
| Camera (4 views) | △ | C |
| Look back | ◯ | B |
| Reset car | CREATE | R |
| Map (free roam) | touchpad | M |
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
- **CRUISE 101.1 — Free Roam.** The same row of cars, then pick where to start
  and drive anywhere (see below). Free roam is also a choice of race type in
  Quick Race.
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

## Free roam

No clock, no rivals: just you, the city at night and every road in the game.
Each road is a region with its own time of day and weather, and they hang
together in one big ring round Port Halcyon (city, docks, the bay, the
highways, the desert, the mountains, the raceways and back into town):

- A **circuit** has a side road off one of its straights, running to a
  tunnel portal with two bores. The signs over them say where each goes:
  back along the ring or on to the next region.
- A **point-to-point road** runs on into a tunnel at each end.
- Drive deep enough into a bore and the picture fades while the next region
  builds; you come out of its tunnel at the speed you went in. Go back the
  way you came and you're back where you were.
- The radar shows the side roads and the tunnel mouths, coloured by where
  they lead, with an arrow on the rim when they're off the edge.
- **M** / the touchpad opens the map of the whole ring, where you can fast
  travel to any region. The pause menu has the map too, traffic on/off,
  gearbox, camera and "back on the road".
- **Race from anywhere:** a column of light stands over every road's start
  line (a chequered square on the radar). Pull up in it and ✕ / Enter
  races that road in the car you're cruising in: pick the type, rivals,
  skill and traffic, and afterwards you're back on the road.
- Traffic runs in the city, at the docks and on the highways.

## Racing

- **Race length:** every race is over in one to two minutes: circuits are
  short (three laps of about half a minute), sprints run about a minute and
  a quarter, and a lap knockout lasts three laps at most (a big field loses
  more than one car a lap, so it's down to two for the last lap).
- **Race types:** circuit, sprint, lap knockout, drag (manual shifting on a shift light, graded launches and upshifts),
  drift (angle × speed scoring with a multiplier chain that a crash wipes out),
  and time attack (a pro drives your exact car first; you chase the ghost and
  the target time).
- **Handling:** the cars are tuned arcade-fast: they pull, grip (about 1.6 g
  in a corner) and stop harder than their brochures say, and the AI drives the
  same numbers.
  Steering on the gas or coasting grips. The car corners at the limit, and
  pushed too hard it runs wide instead of swapping ends. A steering limiter
  means a full-lock stab on keys or the stick still corners at peak grip.
- **Drifting:** the brake is the drift button, the way brake-to-drift works
  in the modern arcade racers. Hold it (or the handbrake) while you turn at
  speed and the car rotates into the corner with its tail out; keep holding
  it and the car stays in the drift. Let go and it stops rotating: its line
  comes round to where the nose points and the tires bite again, with no
  swinging back, so point it down the exit and let go. While you hold it, the
  stick drives it:
  - Steer into the turn and the car hangs its tail out (up to about 27°)
    and carves a far tighter line than grip alone could.
  - Ease the stick back and the angle and the line open up.
  - Steer the other way and hold it there and the tail swings across into
    a drift the other way, linking S-bends.
  - The gas holds your speed through it (the held brake then only scrubs
    a little); off the gas, the brake slows the car as it drifts. The
    handbrake adds angle and tightens the line.

  The car swings in on its springs and settles with real weight. Rear-drive
  cars hang the biggest angles, four-wheel drives drift flatter and grippier,
  and front-drives hang the least.
- **Physics:** a 120 Hz tire model with load transfer, load-sensitive
  cornering stiffness, combined slip (a braking or driving tire has less left
  for cornering), ABS and brake balance, traction control and stability control
  (assists on; off means you own every slide, and drift events always run
  loose), wheelspin, clutch launches, a real gearbox in auto or manual, turbo
  lag and blow-off, nitrous, drafting, jumps and landings, and car-to-car
  contact. Kerbs and sidewalks are bumps the springs soak up, not ramps, and a
  glancing hit on a wall slides you along it instead of stopping you dead.
- **AI:** drives the racing line on the same physics, with its own speed plan
  from its car's grip (more cautious in fast bends when someone's alongside,
  since the room to run wide isn't theirs). It picks gaps in traffic by time
  to collision, leaves a car's width when side by side and backs out when
  there's no room for two, catches its own slides, backs out of walls, uses
  nitrous, makes the occasional mistake, and has optional catch-up. Every
  rival has a temperament: the aggressive ones brake later, run closer, pull
  out to pass sooner, slip up more and cover the inside when you're right
  behind (one move per corner, never weaving). And they drift the hairpins
  now and then, an aggressive rear-driver most of all: brake, turn in, hold
  the line on the angle, let go on the way out.
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

Every race is over in one to two minutes: circuits run three short laps,
sprints about a minute and a quarter.

| Region | Track | Type | Lap / run | Time / weather |
|---|---|---|---|---|
| City | Downtown Loop | circuit | 0.89 km | night, wet |
| City | Uptown Run | sprint | 2.2 km | night, rain |
| City | Old Town | circuit | 0.74 km | dusk |
| City | Downtown Reverse | circuit | 0.89 km | night |
| City | Old Town Reverse | circuit | 0.74 km | night, rain |
| Docks | Harbor Docks | circuit | 0.92 km | night, wet |
| Docks | Pier 9 | circuit | 0.86 km | night |
| Highway | Interstate 9 | sprint | 4.6 km | night, wet |
| Highway | Skyline Expressway | circuit | 1.63 km | dusk |
| Raceway | Redwood Raceway | circuit | 1.04 km | day |
| Raceway | Crestwood Hills | circuit | 0.93 km | sunset |
| Mountain | Kaido Pass | sprint | 2.7 km | dusk |
| Mountain | Summit Loop | circuit | 0.91 km | night, fog |
| Desert | Route 99 | sprint | 4.0 km | day |
| Desert | Red Rock Canyon | circuit | 1.24 km | sunset |
| Desert | Dry Lake Drag | drag | 402 m | sunset |

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
  `?screen=roam&track=harbor&car=m3` (free roam from a region),
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
