# RIM CITY 🏀

*2-on-2. No refs. No mercy.*

Arcade basketball in the browser — full 3D, no install, no build step. The
spiritual cousin of NBA Jam, built on the same engine that runs VARSITY 27:
hand-keyed 16-joint rigs, procedural arena, synthesized sound, and an
announcer who lives inside your browser's speech synth.

**THE RUN** — the campaign: pick one of ten original city crews, then beat the
other nine in order, weakest to strongest. The CPU gets sharper, faster, and
meaner every rung. Lose and you can run it back; beat them all and you're
Kings of Rim City. Progress saves to the browser.

**EXHIBITION** — any crew vs any crew, one game.

**VERSUS** — couch battle: two controllers, or one controller vs keyboard.

## The rules of the blacktop

- Four quarters, **14-second shot clock**, halftime side switch, overtime.
- **No refs, but there are lines.** Step out with the ball or let it sail over
  the boundary and it's the other team's — taken out with a real **inbound
  pass**: your partner holds it overhead out of bounds while you get open
  (□ demands it now), and a defender in the lane can still tip the entry pass.
- After every bucket the other team takes it out from under that rim — no
  camping the basket for repeat dunks.
- **Shove (◯)** knocks a man flat and pops the ball loose. Costs turbo.
- **Goaltending counts** — swat the ball on the way down and the points go up
  anyway… unless *you're* the one on fire.
- **ON FIRE** — three straight buckets by the same player: flaming ball,
  infinite turbo, can't-miss range, legal goaltending. Burns until the other
  team scores.

## How to play

Hold **shoot** to rise, release **at the top of the jump** for the green
release. Sprint at the rim with turbo and shoot becomes a **dunk** — three
slam styles, and they can still get stuffed at the iron. **△ throws the
alley-oop** to your partner cutting to the rim. Spin (◯ with the ball) breaks
ankles and beats steal swipes.

| | Pad (PS5/Xbox) | Keyboard |
| --- | --- | --- |
| Move | left stick | WASD |
| Turbo | **R2** | SHIFT |
| Shoot / dunk · block / rebound | **✕** (hold–release) | SPACE |
| Pass · steal | **□** | E |
| Alley-oop · switch defender | **△** / **L1** | F |
| Spin · shove | **◯** | Q |
| Pause | OPTIONS | ESC |
| Mute | — | M |

Player 2 (when no second pad): arrows move, **L** shoot, **K** pass, **J**
shove, **O** lob/switch, **right SHIFT** turbo.

## Run it

```bash
cd plank
python3 serve.py rimcity
# or open http://localhost:8000/rimcity/ from a running server
```

**Windows:** double-click **`rimcity/play.bat`**.

## Under the hood

Everything is generated in code — no art, no models, no audio files:

- Ten crews, twenty ballers — heights, builds, hair, headbands, and seven
  ratings each that genuinely change how they play.
- Full AI for all four players: spacing, cuts, drives, kick-outs, lobs,
  man defense, help, contests, steals, shoves, and crashing the glass.
- Procedural arena: parquet court, glass backboards with kickable nets,
  four banks of animated crowd, a live four-face jumbotron, ad boards.
- WebAudio everything: ball thumps, sneaker squeaks, rim clank, dunk boom,
  buzzers, an organ, a title beat — and the speech-synthesis announcer
  ("He's on FIIIIRE!") whose pitch and pace rise with the moment. Don't like
  his voice? The pause menu cycles through every voice installed on your
  machine, and remembers your pick. Sound, announcer, and voice settings all
  auto-save.

## Dev

```bash
npm run smoke:rimcity                                   # node module checks
node tools/shot.mjs "/rimcity/?quick" rim.png --wait 9000     # screenshot QA
```

QA URL modes: `?quick` jumps straight into a game (`&team=ny&opp=chi&rung=5`
`&q=30` for short quarters, `&cpu` for CPU vs CPU), `?gallery` shows every
animation clip on a grid of rigs (`&clips=dunkTomahawk,block`).

## RIM CITY ONLINE — one file, real multiplayer

`rimcity-online.html` (repo root) is the whole game in a single HTML file with
**cross-platform online multiplayer**: PC vs phone vs whatever, over a WebRTC
data channel (PeerJS's free cloud handles the handshake — there is no server
for you to run). Pick your name and crew, **CREATE LOBBY**, and send a friend
the 4-letter code or the invite link; they JOIN from any browser. Touch
controls appear automatically on phones (stick to move — push it to the rim
for turbo — plus SHOOT / PASS / ALLEY / SPIN buttons); pads and keyboard work
everywhere. There's a PRACTICE VS CPU mode too, and your name/crew choices
save.

**Publish it:** put the file alone in a folder, rename it `index.html`, and
drag the folder onto https://app.netlify.com/drop — done, share the URL.
(Any static host works; it needs internet for the CDN engine + matchmaking.)

**Rebuild it after engine changes:** `npm run build:online` — the arcade
version in this folder is bundled read-only and stays untouched.

Netcode: the host runs the real simulation and streams ~300-byte snapshots at
20Hz; the guest renders them with interpolation and sends inputs at 30Hz. If
both players are behind very strict carrier NATs the free TURN relay does its
best, but a home Wi-Fi on at least one end is the happy path.
