# COLD BOOT — *ХОЛОДНЫЙ ПУСК*

*Save the world. Quietly.*

A spy game in the browser, in the neon-CRT style of Midnight Frequency: the whole
game plays on an old NOVATRON widescreen TV.

**Bely Mys, Chukotka.** Six Russians sit around a table in a fish warehouse under
one lamp: Dmitri, Nadia, Lyosha, Grisha, Baba Valya and Ivan. A man named Cyrus
Halloran has built *Wormwood*, a payload that wakes at dawn on day 15 and shuts
the world's power grids down. The abort code is locked in a vault in a small
Alaskan town across the strait, held by its mayor and its council. They can't go.
You can. You are **Rybka**, the stranger with a clean passport and an earpiece.

**Port Zarya, Alaska** (pop. 1,140): a run-down fishing town with an Orthodox church,
an old general store, a diner, a bar, a cannery — and a brand-new NORTHSTAR 24
corner store whose cameras see everything. Fourteen November days. Get a job, make
friends, fix the town, learn Python on Lyosha's laptop at night, climb the town's
politics to the mayor's key and the council's vault — while Northstar watches.

Then a stolen chopper across the Bering Strait under fire, an empty warehouse, ten
minutes to write the code that saves the world, and a jail cell at sunset.

## Run it

**Windows:** double-click **`coldboot.bat`** in the repository root. It finds
Python, starts the little local server and opens the game in your browser.

**Mac / Linux:**

```bash
cd plank
python3 serve.py --open coldboot/
# or open http://localhost:8000/coldboot/
```

Any static server works (ES modules need `http://`, not `file://`). Chrome, Edge
or Firefox with WebGL2. A controller is welcome (DualSense first, any standard pad).

## Controls

| | Keyboard / mouse | Controller |
| --- | --- | --- |
| Walk / drive | WASD | left stick |
| Run | Shift | R2 |
| Look | mouse | right stick |
| Talk, use, pick up | E | ✕ |
| Get in / out of a vehicle | F | △ |
| Brake / handbrake (driving) | S / Space | L2 / □ |
| Phone (map, journal, people, town, wallet) | Tab · M map · J journal | CREATE · touchpad |
| Crouch | C | ◯ |
| Skip a line / choose | Space, Enter · 1–4 | ✕ |
| Pause, options | Esc | OPTIONS |

## What's in it

- **People that look like people.** Every character is grown at runtime from the
  MakeHuman base mesh (CC0): macro shape, face sculpting, skin shading with
  subsurface wrap, pores and wrinkles, shell hair with real hairlines, beards,
  clothes grown from the body and draped, procedural walking, sitting, gestures,
  blinks, glances and lip-sync to the voice. The character creator makes *you*.
- **Real voices.** The Russian team speaks Russian (subtitled in English, with the
  original underneath); the town speaks English. Neural TTS (Silero for Russian,
  Piper for English), checked line by line with Whisper, played through an
  earpiece filter when Nadia talks in your ear. If you play a woman, lines
  addressed to you switch to feminine Russian forms.
- **Port Zarya.** Terrain, sea ice and harbour, streets and snowbanks, 23 building
  types with interiors (run-down until you fix them), chimney smoke, sodium
  streetlights and Northstar's camera lights, a low Arctic sun, aurora nights.
- **Fourteen days of story**, an earpiece that tells you what to do, and far more
  than one day can hold: friendship lines with everyone in town (levels, gifts,
  personal quests that end up mattering), 41 restoration projects (Town Spirit),
  jobs (Koshkin's till, the cannery line, KZRY radio, the snow plough), running
  Koshkin's store against Northstar, flight lessons with Wade, Tommy's snowmobile
  races, and the political climb: council, petition, debate night, election,
  the Winter Gala.
- **Being watched.** ATTENTION rises when cameras, Evan, Mr. Grey or the black
  SUVs see you do spy things. At 100% you're burned and the mission restarts.
- **Lyosha's Night School.** Fourteen Python lessons on the cabin laptop with a
  real in-game Python interpreter, then field hacks with real mission data
  (loop a camera, clean a petition, decode a ledger, combine the vault key) —
  and the finale is a real program written against a ten-minute clock.
- **Wheels and skis.** Buy Hank's old pickup (and drive the city's snow-plough
  route for money), ride your snowmobile, race Tommy across frozen Loon Lake.
  Northstar's black SUVs patrol at night, and they see.
- **Your phone** (Tab): a map with waypoints, the journal, everyone you know and
  how close you are, the town's restoration projects, your wallet.
- **A score that follows you.** Generative music in the same engine as Midnight
  Frequency's radio: a spy-synth title theme, a quiet cue under the warehouse
  table, folk for Port Zarya's days, aurora ambience for its nights, tension
  that rises as Northstar's attention does, the chase, and the credits.
  Procedural sound for everything else — rotors, engines, gunfire, church
  bells, footsteps in snow, the till, the earpiece clicking on.
- **The finale**: a chopper chase QTE across the strait, a landing by hand, the
  empty warehouse, ten minutes, the arrest, credits over a sunset in a cell.

## Layout

```
coldboot/
  index.html, style.css      the NOVATRON TV and the canvas
  src/main.js                screens, transitions, the loop
  src/core/                  renderer (HDR → bloom → DOF → CRT), input, UI, settings
  src/human/                 MakeHuman runtime: body, face, skin, hair, clothes, animation
  src/world/                 terrain, sea, roads, buildings kit, props, sky, snow, smoke, chopper
  src/game/                  player, physics, NPCs, dialog, missions, attention, economy,
                             minigames, phone, vehicles, HUD, state/save
  src/code/                  Python interpreter, lessons, field hacks, grading
  src/scenes/                warehouse prologue, plane, finale, the cutscene director
  src/screens/               boot, title, creator, town, laptop, options, credits, labs
  src/data/                  cast, schedules, script (every line and mission)
  assets/human/              baked MakeHuman data (CC0)
  assets/vo/                 rendered voice lines (Opus) + manifest
  assets/tex/                CC0 textures (Poly Haven, ambientCG) — see CREDITS.md
  tools/                     build scripts and QA
```

## Tools

- `node coldboot/tools/check_content.mjs` — validates every line and mission
  (speakers, voices, places, missions referenced by days, gendered Russian).
- `node coldboot/tools/test_python.mjs`, `test_lessons.mjs` — the interpreter
  against CPython, every lesson and field hack solvable.
- `node coldboot/tools/shot.mjs "screen=town&ff=1" out.png --wait 60000` —
  headless screenshots into `qa/` (`ff=1` lets slow software rendering keep up;
  `&day=8` starts a story day, `&free=1` skips the arrival,
  `screen=finale&phase=jail&auto=1` jumps into the finale's scenes).
- `tools/build_humans.py` — bakes the MakeHuman data (needs the MakeHuman 1.x
  `data` folder). `tools/export_lines.mjs` + `tools/build_voice.py` — render
  voice lines (Silero, Piper, rubberband, ffmpeg; `--qa` runs Whisper).

## Credits

People: MakeHuman base mesh, targets and assets (CC0). Voices: Silero TTS v4 (ru),
Piper (LibriTTS-R voices, ru_RU voices). Textures: Poly Haven and ambientCG (CC0).
Rendering: three.js. Everything else — the town, the story, the music and sound —
is made in code.
