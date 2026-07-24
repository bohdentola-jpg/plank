# EB GAMES 95 🖥

Six 3D games. One repo. Zero asset files — every model, texture, animation,
and note of music is generated in code, and it all runs straight in the
browser. No install, no build step.

Run it and you land on a **Windows-95-style desktop**: double-click a
cartridge, read the box copy, hit **▶ PLAY**, and the game opens in its own
tab. Put something on the **EB Hi-Fi** first (your own files, or paste a
Spotify link) — the desktop keeps the music going while you play.

![The shelf](docs/eb-games.png)

| Cartridge | What it is | Direct door |
| --- | --- | --- |
| 🏈 **[VARSITY 27](varsity/README.md)** | High school football under the Friday lights — careers, a play designer, a coach's office | `/varsity/` |
| ⚾ **[BIG INNING '27](baseball/README.md)** | Arcade baseball across six hand-built yards — seasons, free agents, Road to Glory | `/baseball/` |
| 🏀 **[RIM CITY](rimcity/README.md)** | 2-on-2 arcade basketball — turbo, shoves, alley-oops, ON FIRE, and THE RUN ladder | `/rimcity/` |
| ⛏ **[LOAM](loam/README.md)** | Voxel survival & building grown from any seed word, scored by a generative composer | `/loam/` |
| 🏆 **[MASCOT MELEE 64](melee/README.md)** | Twelve mascots, one trophy — a chunky 64-era platform fighter with a GAUNTLET ladder | `/melee/` |
| 📼 **[NOCLIP](backrooms/README.md)** | Found-footage backrooms horror: 23 levels, a camcorder for a torch, eighteen things that hunt | `/backrooms/` |

## The new one

**NOCLIP** is a first-person horror game shot entirely through a camcorder: the
battery is your light, the tape is your nerve, and the auto-gain is the reason you
can see anything at all down there. Twenty-three levels, generated fresh from your
tape's seed — the original yellow rooms, the poolrooms, pipe tunnels, an endless
hotel, a hospital with a nurse in it, a snowfield with a queue of people facing
away, a birthday party that has been going for decades — and a way out of every one.

| | |
| --- | --- |
| ![The lobby](docs/noclip-lobby.png) | ![The poolrooms](docs/noclip-poolrooms.png) |
| ![Terror Hotel](docs/noclip-hotel.png) | ![Lights out](docs/noclip-dark.png) |

## Run it

**Windows:** double-click **`play.bat`** — it finds Python, starts the server,
and opens the desktop. (`rimcity/play.bat` jumps straight to basketball.)

**Mac/Linux:**

```bash
cd plank
python3 serve.py               # opens the desktop — pick a game there
python3 serve.py backrooms     # or jump straight into one
```

Any static server works too — ES modules need `http://`, not `file://`.
Three.js is vendored; `npm install` is only for dev tooling.

Plug in a **PS5 (DualSense) or Xbox controller** for the sports titles and the
fighter — press any button and the games pick it up, menus included. Everything
auto-saves to the browser: Varsity careers, Big Inning seasons, Rim City runs,
Loam worlds, Melee records, Noclip's three tape slots, and the desktop's own
preferences.

## The desktop

Boots through a straight-faced fake BIOS (which now finds six cartridges and one
tape that was already in the drive), then it's 1995: teal wallpaper, beveled
windows you can drag, a Start menu, a taskbar clock, and an optional CRT scanline
mode. Each game's window has the pitch, two screenshots, and a big PLAY button.
**EB Hi-Fi** is the music app — load local audio files into a playlist, or paste
any Spotify song/album/playlist link (log in to Spotify in your browser for full
tracks). Games open in new tabs, so the tunes never stop.

## Dev

```bash
npm install              # playwright, for screenshots and browser smoke tests
npm run smoke            # every game's headless harness, back to back
npm run smoke:backrooms  # builds all 23 NOCLIP levels and walks the exit graph
npm run smoke:melee      # frame data + move drill + CPU-vs-CPU matches
node tools/shot-backrooms.mjs poolrooms --frames 3     # drive NOCLIP in Chromium
node tools/shot.mjs "/rimcity/?quick" shot.png --wait 9000   # screenshot QA
```

Each game carries its own harness, and each harness runs without a browser:
Loam checks its worldgen/lighting/crafting pipeline, Melee plays whole matches at
thousands of frames per second, and NOCLIP builds every level and proves you can
actually walk from the spawn to the exit before anybody has to load a page.
