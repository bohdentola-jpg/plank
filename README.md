# VARSITY 27 🏈

*Sunday has Madden. Saturday has NCAA. Friday is yours.*

The high school chapter of the football-game trinity, in the browser — full 3D, no
install, no build step. Boots with a cinematic flyover of America's football towns
and an original synthesized score.

**HOMETOWN HERO** — the player career: create your QB in a full face editor (skin,
jaw, brows, eyes, hair, facial hair, eye black, visor, build), then live the week:
allocate your hours between training, film, academics, and rest; handle what comes
up (parties, scouts, chemistry finals); keep the GPA above 2.0 or watch Friday in
street clothes; play your possessions live with the defense simulated like Road to
Glory; earn XP and college offers; survive to State and pick a hat on Signing Day.

![Friday night under the lights](docs/friday-night.png)

**Build your school.** Name it, pick the colors, design the logo, and raise the actual
building — style, floors, wings, gymnasium, cupola, marquee sign, bus fleet.

**Suit up your team.** Design the uniform on a live 3D player (jersey, helmet stripes,
side panels, facemask, socks — the works), then set your varsity roster: names,
numbers, and attribute re-rolls until the depth chart feels right.

**Then it's Friday night.** Full 11-on-11 under the lights against a generated rival,
in a stadium your school overlooks from the hill behind the west end zone. Animated
crowd, light towers, working scoreboard, painted end zones, your logo at midfield.

**And it's a career.** Your week starts in a 3D coach's office overlooking the field
in daylight — click the **helmet** to play Friday's game, the **papers** for weekly
decisions (eligibility scandals, booster deals, the AD on line one), the **window**
to run practice drills (Route Tree, the Gauntlet, Hit Stick — grades become Friday
boosts), the **whiteboard** to open the play designer, the **trophy shelf** for the
season. An 8-game schedule, playoffs, a State title, an AD trust meter that can get
you fired, and a paint can to redecorate the whole office. The season starts at
training camp; the playbook has 17 plays plus whatever you draw up yourself.

| | |
| --- | --- |
| ![School builder](docs/school-builder.png) | ![Uniform lab](docs/uniform-lab.png) |
| ![Touchdown celebration](docs/touchdown.png) | ![Defense](docs/defense.png) |

## Run it

**Windows:** double-click **`play.bat`** — it finds Python, starts the server,
and opens the game in your browser. (If Python isn't installed it tells you
where to get it.)

**Mac/Linux:**

```bash
cd plank
python3 serve.py
# open http://localhost:8000
```

`serve.py` is a tiny no-cache static server: updates always show after a
refresh, it opens the game in your browser by itself, and if the port is busy
(a forgotten old window) it just picks the next free one and says so. Any
static server works too — ES modules need http://, not file://. Three.js is
vendored — no npm install required to play. The title screen shows the BUILD
number so you can confirm which version you're running.

## How to play

| Phase | Controls |
| --- | --- |
| Play call | Click a card or press its **number** |
| At the line | **SPACE** to snap |
| Quarterback | **WASD** move the pocket · **1–4** throw to that receiver · scramble past the line to run |
| Ball carrier | **WASD** steer · **SHIFT** sprint · **SPACE** juke |
| Defense | **E** switch defender · **WASD** pursue · **SPACE** dive tackle |
| Anytime | **ESC** pause · **M** mute |

**Controller (PS5 DualSense, Xbox, anything standard):** plug it in over USB and
press any button — the game announces it. **Left stick** moves (analog speed),
**✕** snaps/jukes/dives, **□ ✕ ◯ △** throw to the matching receiver icons,
**R2** sprints, **L1** switches defenders, **D-pad + ✕** picks plays,
**OPTIONS** pauses. Menus and the office stay mouse-driven.

Four 3-minute quarters. Touchdowns, extra points, field goals, punts, sacks,
interceptions, broken tackles, gang tackles, overtime. No penalties — refs swallow
their whistles on Friday night.

Your school, uniform, and roster auto-save to the browser (`CONTINUE` on the title
screen).

## Under the hood

Everything is generated in code — no art assets, no model files:

- **Players** — articulated 16-joint rigs (shoulder pads, helmets with facemasks and
  decals, number decals, four body types) posed by a hand-keyed clip system with
  crossfades: run/sprint cycles, dropbacks, throws, catches, juke moves, blocks,
  tackles, falls, celebrations, the ref's TD signal.
- **The world** — parametric school architecture, procedural canvas textures (field
  paint, brick, dusk sky, scoreboard LEDs), instanced animated crowd, light towers.
- **The game** — role-based AI for all 22 on the field: routes, man/zone coverage,
  pass rush vs. pass pro with shed timers, pursuit angles, a CPU QB that reads
  separation, play-action that fools linebackers.
- **Sound** — synthesized WebAudio: crowd bed, pea whistle, pad thud, horn.

The sim runs on its own clock (pause-safe), and quality auto-scales down
(shadows/pixel ratio/bench players) if the machine can't hold frame rate.

## Dev

```bash
npm install                  # dev tooling only (playwright for screenshots)
npm run smoke                # node-based module/clip sanity checks
node tools/shot.mjs "?gallery" g.png --wait 2500    # screenshot the anim gallery
```

QA URL modes: `?quick` jumps straight into a game, `?gallery` shows every animation
clip on a grid of rigs (`&clips=run,sprint&camr=8&camy=2&ang=0.6` to frame shots).
