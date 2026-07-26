# FOCUS GROUP 📺

*You have been selected.*

**EB AFTER DARK**'s second tape. Six mornings in a flat you have lived in for
four years. Nothing chases you. Nothing can kill you. There is no way to lose.

It opens on a television commercial from 1974 — Valco Home Products, a family of
brands, since nineteen fifty-four. A jaunty organ jingle, a family at a
breakfast table, a smiling mascot in a bowler hat called VAL, and an announcer
talking warmly at you through a wall. *VALCO — WE'RE PART OF YOUR MORNING.*

Then you wake up and it is Tuesday.

![The living room, twenty to seven](../docs/focusgroup-living.png)

## The cut

The game is first person. Every so often — with no warning, no music sting and
no explanation — the picture stops being yours and **cuts to a hidden camera**.
Grainy, wide, near-monochrome, timestamped, `CAM 03`, a red dot in the corner.
You keep the controls. You are simply now watching yourself make coffee from the
top corner of your own kitchen.

On Tuesday it lasts seven tenths of a second and you are not sure it happened.
On Sunday it never cuts back.

| | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
| --- | --- | --- | --- | --- | --- | --- |
| cuts | 1 | 3 | 5 | 7 | most of it | all of it |
| longest | 0.7s | 2.5s | 6s | 30s | 45s | — |

Two things are true of every cut and the game never says either out loud. It
always comes from a camera that is physically in the flat and that you could
have found. And it always takes a photograph.

![CAM 03, the hall](../docs/focusgroup-cam.png)

## What you actually do

**Work down the list.** Top right, on Valco notepaper: *turn off the clock
radio, open the blinds, put the coffee on, leave for work.* It reads like a
tutorial. By Friday there are two items on it in your handwriting that you do
not remember writing. On Sunday the heading stops saying YOUR MORNING.

**Look closer.** Twelve lenses are hidden in things you already own — the smoke
detector, the clock radio, the badge on the coffee maker, the flaw in the
bathroom mirror, the toggle on the blind cord. Catch a glint, press **Q**, and
it goes in your notes.

**Watch ENGAGEMENT go up.** Finding lenses fills a friendly little bar and Valco
congratulates you for it. An engaged subject is a valuable subject. You are being
rewarded for playing well and the reward is more cameras.

**Fill in the card.** Wednesday's post brings a reply-paid survey. Four
questions, real choices. Question four has four boxes and only three of them
have anything printed next to them. Whatever you tick is read back to you on
Saturday by an announcer who is being friendly about it.

## The week

1. **TUESDAY** — a normal morning, taught as a tutorial. One cut.
2. **WEDNESDAY** — *you may already be selected.* The card.
3. **THURSDAY** — a box outside the door. Four gifts, and **you** choose where
   they go. Each one is a lens. The list calls it "find a home for your gifts".
4. **FRIDAY** — the morning advertisement contains your kitchen, filmed
   yesterday. Every window in the block opposite is flickering the same blue, in
   time.
5. **SATURDAY** — no work. The list says "relax", which is worse. Tape marks on
   your floor overnight; stand on one and a key light arrives from nowhere. The
   lift has a button you have never pressed.
6. **SUNDAY** — you do not wake up in your bed.

Three endings. One of them you can only reach by having found all twelve.

## Controls

| | |
| --- | --- |
| **WASD** | walk |
| **mouse** | look |
| **SHIFT** | hurry (they like it when you hurry) |
| **E** | do the thing you are looking at |
| **Q** | look closer at something that caught your eye |
| **ESC** | pause · **M** mute |

If the frame-hold on the recorded shots is too much to watch, **OPTIONS →
CAMERA JUDDER** turns it off. The game is identical; it is just steadier.

## Under the hood

No asset files, like the rest of the shelf.

- **The lens** — one fullscreen shader with three looks in it: your eyes, a 1974
  time-lapse security deck, and 16mm film. The security look does a real **frame
  hold** — the scene stops redrawing between recorded frames while the post pass
  keeps running, so the deck judders the way a deck judders and your input
  arrives a beat late.
- **The commercials** — drawn on a 2D canvas in flat process colour with a
  shutter, dust and a hair in the gate over the top. The same painter runs at
  320×240 inside your television and at full screen for the cold open.
- **The photographs** — every cut renders one 320×240 frame from the hidden
  camera into an offscreen target, reads it back, and keeps it. Those frames are
  the ones on the Friday advertisement, on the forty monitors on Sunday, and in
  the finished commercial over the credits. Every playthrough ends with an
  advertisement made out of itself.
- **The jingle** — eight bars of G major, synthesised. Across six mornings it
  loses about 12% of its tempo and 22 cents of pitch, goes minor, and picks up a
  room humming along. Nobody remixed it. It is the same tape on a deck that is
  giving up.
- **The announcer** — no words. Three band-passed formants over a sawtooth
  larynx and a syllable envelope: a man being warm at you through a wall, with
  period burned-in captions doing the talking.

## QA

```bash
node tools/smoke-focusgroup.mjs                  # no browser; content + geometry checks
node tools/play-focusgroup.mjs --shots           # plays all six mornings headless
node tools/play-focusgroup.mjs --decline         # …and refuses the line
node tools/shot-focusgroup.mjs --day 4           # a tour of the flat
node tools/shot-focusgroup.mjs --set studio      # the soundstage
node tools/shot-focusgroup.mjs --cut smoke       # sit on a hidden camera
node tools/shot-focusgroup.mjs --ad              # the cold open, frame by frame
node tools/shot-focusgroup.mjs --props           # every model on a grid, row by row
```

URL modes: `?day=1..6` drops straight into that morning, `?quick` is `?day=1`,
`?gallery&set=flat|basement|studio&day=N` is a turntable with the HUD off, and
`?props` puts every model on a grid under one flat light — `&row=N` for one row
head-on, `&only=valMascot` for a close-up. A model that is wrong is only wrong
from one angle in one room, so there is a page that shows all of them at once.

*Valco Home Products is not a real company. Participation is voluntary where
required by law.*
