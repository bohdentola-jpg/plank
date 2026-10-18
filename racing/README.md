# MIDNIGHT FREQUENCY

An early-2000s street racer that runs in the browser, on a CRT TV in a dark room.
It has a free-race mode where you pick a real-ish car and a road, a story
mode where you buy a beater from the classifieds, build it up in a borrowed
garage, and take Port Halcyon crew by crew, and a free roam that starts in
your own garage and drives straight out into the city: one seamless Port
Halcyon, every race track a part of town, and no loading screens. It has
full 3D, a dynamic soundtrack and real driving physics. There is no install
and no build step.

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
| Dev menu (live driving tunables) | hold L1 + R1, press OPTIONS | Shift + ~ or Ctrl + Alt + D |

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
- **CRUISE 101.1 — Free Roam.** Your garage: pick a car, fit it out, and drive
  out of the door into Port Halcyon (see below). FREE ROAM is also a race
  type in Quick Race, which puts you on that track's start line in the city.
- **TALK 104.5 — Options.** This is the TV's own on-screen menu: CRT strength,
  sharpness (internal resolution), auto quality, volumes, units, gearbox,
  assists, camera, vibration, and the full control list.

## Story: "Who runs Port Halcyon?"

You arrive with $8,000. Rosa lends you her late father Manny's body shop,
Santos Auto Body. Buy a used car from the Halcyon Gazette's classifieds, then
take the city crew by crew, eight chapters and 79 races across every road in
the game:

1. **Kings of Main** (downtown): boss **Dez**, S15
2. **Night Market** (Chinatown): boss **Jade**
3. **Harbor Rats** (the docks): boss **Tank**
4. **Kaido Ghosts** (the mountain pass): boss **Kaito**, the 20-year-old Trueno
5. **The 200 Club** (Bayshore): boss **Bishop**
6. **Paddock Club** (the raceways): boss **Sterling**
7. **Route 99 Syndicate** (the desert): boss **Vex**
8. **The Frequency** (the whole city): boss **ZERO**

The plot comes through text messages on your flip phone (150 of them): rivals
call you out, gloat when they beat you, and slowly the story of what happened
to Manny on the Bayshore bridge comes out. Each chapter opens and closes with a
title card.

- **Named rivals:** 56 of them, each always in the same car and livery, with
  a style, a bio and a line before the race. Their style is how the AI drives
  them: the hot-heads brake late and lean on you, the clean drivers don't,
  the showmen drift the hairpins. **THE LIST** shows every crew, what they
  drive, and your record against each of them.
- **Races:** circuits, sprints, knockouts, drags, drift, time attack against a
  pro's ghost, **duels** one-on-one with a named rival, and invitation-only
  **cups** (three rounds, points for every place).
- **REP:** wins, places, first wins, beating named rivals and how you won
  (a photo finish, wire to wire, clean laps, drift style) earn street REP and
  a rank from NOBODY to THE FREQUENCY. A boss calls you out once you've won
  enough of the crew's races and your REP is high enough; REP also gets you
  into the cups.
- **Pink slips:** beat a boss and you can keep their car, parts and all, or
  sell it.

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
- **Cars:** a six-bay garage and the dealer lot. Classes unlock by chapter, and
  cars sell back at 60%.
- **Cruise:** take your car (with its parts and paint) out into the city,
  starting in the chapter's part of town.

Progress saves itself in your browser (saves from the old five-chapter story
carry over: cash, cars, wins and beaten bosses). To start over, use Options ›
Game › Erase story save.

## Free roam: Port Halcyon

Port Halcyon is one city with no seams. It covers about 12 by 10 km, with
274 km of road, and you can drive all of it without a loading screen:

- **Your garage.** Free roam starts with the door shut in your own garage on
  Foundry Street. ↑ ↓ picks any car on the roster, the stick looks round it,
  and L1/R1 changes tab:
  - **PERFORMANCE:** every part's STREET, PRO and RACE tiers, or ALL PARTS at
    once.
  - **BODY:** paint, rims, kits, spoilers and the rest.
  - **DRIVE:** night, dusk or day, and the camera.

  Parts and paint are free here and kept per car. While you choose, the
  city is being built behind the door.
- **Drive out.** Press △ / F, or DRIVE OUT on the last tab. The camera swings
  round from the showroom view to the chase cam, the door rolls up, and you
  drive out into the street. There's no fade and no loading screen. Park
  back inside to get the garage again, or pick BACK TO THE GARAGE in the
  pause menu.
- **The city.** Each of its 24 districts was built by hand with its own
  buildings, props and ground, so nothing repeats from one part of town to
  the next:
  - **Downtown and Uptown:** the Meridian Tower and the Helix, the Vault,
    the Skypark helipad, Halcyon Crossing; Uptown's terraces and mews,
    the Orpheum, the Victory Arch, the Obelisk and the Boathouse on the
    park's pond.
  - **Chinatown:** the Dragon Gate, Lantern Square, the Tin Hau temple and
    the Jade Teahouse, tenements with fire escapes, steam from the stalls.
  - **Old Town:** cobbles, quays and bridges on the river (the Grand Bridge,
    Le Petit Port), the clock tower over the market square, the Jardin du
    Bastion and the old mill with its turning wheel.
  - **The Works and Eastside:** brick foundries and sheds, the Low Line
    freight railway overhead, the power station, the Foundry Stack across
    from your garage; Eastside's suburbs, the strip along Eastside Ave,
    Eastside High under its stadium lights, the water tower.
  - **The coast:** the container terminal's cranes, the lift bridge and a
    ship at the quay; the shipyard's dry docks and hulls, and a wreck on the
    beach; Pier 9's wheel, the Comet and the boardwalk; the Bayshore Bridge,
    the Three Sisters and Sunset Rock; Halcyon Point's lighthouse (its beam
    turns at night), the marina and the old battery.
  - **The west:** Halcyon Lake behind its floodlit dam, with the marina,
    cabins and a campground; the blast furnaces of Ironwood Park; the giant
    redwoods (one of them you can drive through); Crestwood's vineyards,
    château and hidden villa; the farms, the grain elevator and its railway,
    the old airfield, the Starlite Drive-In and a crop circle.
  - **The mountains:** Kaido Pass through the cedars, its shrine and the
    Miharashi lookout; the Summit's observatory, its lodge and an ice cave;
    the Ridgeline wind farm and the 92.7 tower; the North Woods' sawmill,
    Loon Lake and a hidden waterfall.
  - **The desert:** Route 99's Rocket Diner and motels, the High Desert
    Array and Silo 9, the Red Arch and the Lost Dutchman mine, the Last
    Chance Saloon and the Silver Queen headframe in Ghost Town, and the dry
    lake's drag strip.

  Freeways and viaducts join the districts, and backroads, dirt tracks and
  bridges run between them.
- **No loading screens.** The world is cut into 256 m cells. The cells round
  your car are built a few milliseconds at a time as you drive, the far city
  stands on the horizon, and the frame rate holds. The only loading screen
  is fast travel.
- **Places to find.** There are 111 of them. Drive close to a landmark to
  find it: a message, a sound, and a pin on the map. 33 are on no sign, at
  the end of a dirt road, up a trail or under a bridge.
- **M / the touchpad opens the map** of the whole city. L1/R1 zooms, and
  ✕ fast travels to any place you've found, or to any race's start line. The pause menu has the map too,
  plus "back on the road", the garage, the camera and the music.
- **Traffic** drives the real road network: in lane on the right, turning at
  junctions, and taking its turn at the crossings.
- **The race tracks are places in it.** Every track is a route through
  these streets (see Tracks below), so you can cruise any of them.
- **Race from the city.** Every track's start line stands under a column of
  light, with a chequered square on the radar and the map. You can fast
  travel to any of them. Pull up on a line and ✕ races that track in the car
  you're driving: pick the type, rivals, skill and traffic. Afterwards
  you're back in the city, past the line or past a sprint's finish. (A
  story cruise has no start lines: the story's races are its events.)

## Racing

- **Race length:** two to three minutes a race. A circuit's lap is a minute
  to a minute and a half of city streets, so circuits run two laps (three on
  the short Skyline loop, one round the long Summit). Sprints run about a minute and a half end to
  end. A lap knockout lasts two laps (three on the Skyline), and a big
  field loses more than one car a lap, so it's down to two for the last
  lap.
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

## Tracks (22)

Every track is a route through Port Halcyon's own roads, so no two tracks
share scenery: no two run on the same streets. The waypoints are joined by
the real roads between them, the corners are the real junctions and bends,
and the walls are where each road ends. A race runs in the world itself. The
districts stream round the cars, every side street the race passes is closed
with a line of barriers, and a gantry, a chequered line and painted grid
boxes mark the start. The drag runs on the dry lake's own strip, with its
own tree and timing tower.

The three raceways (Redwood, Crestwood, Ironwood) are the original circuit
designs, laid into the hills at one and a half times the size.

| Region | Track | Type | Lap / run | Where it runs | Time / weather |
|---|---|---|---|---|---|
| City | Downtown Loop | circuit, 2 laps | 2.73 km | Main St under the towers, 5th, Harbor Ave, 1st | night, wet |
| City | Uptown Run | sprint | 2.56 km | Central Ave, Park Blvd, Madison Blvd, up to Kaido Rd | night, rain |
| City | Old Town | circuit, 2 laps | 2.44 km | over the Grand Bridge, the east bank's cobbles, the stone bridge | dusk |
| City | Chinatown | circuit, 2 laps | 2.83 km | the market blocks and Grant Ave under the lanterns | night |
| City | Downtown Reverse | circuit, 2 laps | 2.76 km | Downtown the other way round | night |
| City | Old Town Reverse | circuit, 2 laps | 2.44 km | Old Town the other way round | night, rain |
| Docks | Harbor Docks | circuit, 2 laps | 2.83 km | round the container terminal and the berths | night, wet |
| Docks | Pier 9 | circuit, 2 laps | 2.48 km | Beach Blvd, the boardwalk, the sea road | night |
| Docks | Shipyard Run | sprint | 4.14 km | past the dry docks and along Harbor Blvd | dusk |
| Highway | Interstate 9 | sprint | 6.49 km | over the gorge, the viaduct, the Eastside plains to the desert | night, wet, traffic |
| Highway | Skyline Expressway | circuit, 3 laps | 2.07 km | the elevated loop between the downtown blocks | dusk, traffic |
| Highway | Bayshore Route | sprint | 3.69 km | up the cliffs and over the Bayshore Bridge | night, traffic |
| Raceway | Redwood Raceway | circuit, 2 laps | 2.26 km | the hairpin, the esses down through the redwoods, the back straight | day |
| Raceway | Crestwood Hills | circuit, 2 laps | 2.15 km | a blind crest, the hairpin, the corkscrew and the carousel in the vineyards | sunset |
| Raceway | Ironwood Park | circuit, 2 laps | 2.25 km | sweepers past the old ironworks, the hairpin, the tight infield | overcast, wet |
| Mountain | Kaido Pass | sprint | 3.11 km | downhill from the top of the pass, hairpins down the escarpment | dusk |
| Mountain | Summit Loop | circuit, 1 lap | 4.34 km | switchbacks round the peak below the observatory | night, fog |
| Mountain | Ridgeline Climb | sprint | 4.05 km | uphill from the desert floor, up the face and along the crest | day |
| Desert | Route 99 | sprint | 4.66 km | north from the cliffs past the Ghost Town turn and the diner | day |
| Desert | Red Rock Canyon | circuit, 2 laps | 3.94 km | the canyon floor and back along the rim | sunset |
| Desert | Ghost Town | circuit, 2 laps | 1.93 km | a dirt loop round the dead mining town | sunset |
| Desert | Dry Lake Drag | drag | 402 m | the salt flat's strip | sunset |

The tracks were redrawn, so best laps and times set on the old layouts were
cleared. Races and wins were kept.

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

## Dev menu

Live driving tunables, for trying a different feel without touching the
code. Open it over any screen with **Shift + ~** or **Ctrl + Alt + D**, hold
**L1 + R1 and press OPTIONS** on a pad, or pick **DEV MENU** in Options ›
Game. The game holds still underneath while it's open (the keys work the
menu, not the car), and whatever you change is in the moment you close it.

- **Pages** (L1/R1 or Q/E): **Drift** (angle, max angle, snap, damping,
  line, entry kick, min speed, arm time, how fast the keys tighten and
  loosen it, speed scrub), **Speed & grip** (power, grip, brakes, aero
  drag, nitrous power and tank, gravity), **Steering** (lock, speed, speed
  fade, countersteer, limiter), **Camera** (distance, height, field of view,
  speed FOV, follow rate, look-ahead, shake), **Collisions** (walls, car
  contact and traffic contact on or off, wall and car bounce, wall scrape,
  crash spin) and **Misc** (game speed, down to 0.25× for watching a drift in
  slow motion, and a telemetry readout: speed, drift angle and state, tire
  slip, gear, revs, FPS).
- ↑ ↓ picks, ← → adjusts (hold it to speed up), ✕ / Enter flips a switch,
  □ / X / Tab puts the value back to its default. A diamond marks every
  value that's changed. Each page ends with RESET GROUP, RESET ALL (it asks
  twice) and COPY CHANGES (the changed values as JSON, to the clipboard and
  the console).
- Walls off is a ghost mode for testing: every car drives through the
  barriers (and gets put back on the road if it strays too far).
- The handling values (drift, speed & grip, steering) act on the car you
  drive: the AI keeps the stock numbers its racing lines are planned on,
  and the garage's measured stats stay put. Collisions and game speed apply
  to every car.
- Changes are saved in the browser until you reset them. The defaults are
  the game's own handling, to the last decimal. The code is
  `src/core/tune.js` (the values) and `src/core/devmenu.js` (the panel).

## Under the hood

- three.js r160, plain ES modules (`racing/src`), no bundler.
- **Renderer:** the 3D picture is drawn at a CRT-ish internal resolution (480,
  600 or 720 lines, 4:3) into an HDR buffer, then goes through dual-filter bloom
  and a final pass with tube curvature, aberration, ACES tonemapping, grading,
  scanlines, aperture grille, snow static, interference and vignette. The page
  frames it in a CSS TV set.
- **The world** (`src/world`):
  - **The map** (`world/map`) is data: nodes and roads of a dozen types
    (freeway, avenue, cobble, mountain pass, dirt and the rest), terrain
    zones (hills, mesas, a canyon, the lake's slopes), water, the 24
    districts and the landmarks.
  - **Terrain and roads.** The terrain is graded to the roads. Each road
    gets its own mesh, with junctions, bridges on piers, viaducts and
    street lamps.
  - **District packs** (`world/districts`). Each district plans its own
    buildings and props once, on a shared occupancy grid that keeps them
    off the roads, and scatters the small things cell by cell.
  - **Streaming.** A streamer builds the 256 m cells round the cars a few
    milliseconds a frame, with the shaders warmed up first so nothing
    hitches. The far city is one skyline mesh.
  - **Physics and traffic.** The physics drives on the same roads and
    terrain and collides with the districts' buildings. Traffic follows the
    road network's lanes.
  - **Ready for multiplayer.** Every page builds the same city from the
    same data, and the streamer builds round a list of cars, so a second
    player's car is just one more on the list.
- **Audio:** all procedural WebAudio. Engines, SFX, and a 14-theme dynamic
  soundtrack (DnB, boom-bap, 2-step, jazz, house, big beat, eurobeat, trance,
  rock). The music reacts to the countdown, position, final lap, nitrous, air
  time and crashes.
- **Dev URL params:**
  - `?screen=race&track=downtown&car=lancet&type=drift&traffic=1`
  - `?screen=world`: free roam from the garage.
  - `?screen=world&car=silvio&x=700&z=790&heading=3.14`: on the road at a
    spot.
  - `?autopilot=1&sim=4`: the AI drives you, four times faster.
  - `?screen=carlab&car=m3`
  - `?screen=trackview&track=kaido`: a course in the world, race dressing
    up.
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
  - `worldmap.mjs`: the city's map as a PNG, in node with no browser. It
    can draw the terrain, the roads, the districts' plans and the course
    routes.
  - `worldshot.mjs`: screenshots of the city from chosen spots, from the
    road or the air.
  - `worldprof.mjs`: how long each world cell takes to build, step by step.
