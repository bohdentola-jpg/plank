# CHROMA CLASH 🦎🎨

An original 3D ink-battler for the browser. You are a **Chromeleon**: a chameleon kid with
turret eyes that swivel independently, a curly tail and a glossy team-colored crest. Your
skin shifts toward your ink color. You spray ink, dive into it to swim at high speed, climb
any wall you've painted, and fight 4v4 to cover the most floor in three minutes. Between
matches you hang out in **Prism Plaza**, a busy city square with walk-in shops, a live news
broadcast, crowds of locals, and a secret way down into a story mode. Every day starts in
**your own house**, which you can furnish and decorate however you like.

Everything is generated in code: models, textures, levels, music and sound effects. There
are no asset files and no build step.

## Run it

**Windows:** double-click `chroma/play.bat`.

**Mac/Linux:**

```bash
cd plank/chroma
python3 serve.py          # opens http://localhost:8100/chroma/
```

Any static server works if you serve the **repository root** (the game imports
`../vendor/three.module.js`) and open `/chroma/`. You need a WebGL2 browser
(Chrome, Edge, Firefox or Safari 15+).

## Controls

| Action | Keyboard + mouse | Controller |
| --- | --- | --- |
| Move | WASD | Left stick |
| Aim / look | Mouse (click the game to capture it) | Right stick |
| Fire / paint | Left mouse (hold to charge or roll) | RT |
| Dive into your ink | Hold Shift | Hold LT |
| Jump (dualies: + direction while firing = dodge roll) | Space | A / ✕ |
| Sub weapon | Right mouse | RB |
| Special | Q (or E in battle) | Y / △ |
| Turf map | Hold Tab | Back / Share |
| Interact (plaza, house) | E | X / □ |
| Decorate (house) | F | Y / △ |
| Tongue flick (plaza) | T | |
| Pause | Esc | Start / Options |
| Mute | M | |

## How it plays

- **Ink is everything.** Your shots paint every surface they touch. Enemy ink slows you and
  wears you down.
- **Dive form.** Hold Shift on your own ink to dive in as a sleek lizard shape. You swim
  about twice as fast, refill your ink in about 3 seconds, heal faster and are nearly
  invisible.
- **Climb anything.** Paint a wall, then swim into it to climb straight up.
- **Turf Rush.** After three minutes the judges count painted floor; the team with the
  higher percentage wins. You earn coins and XP either way.

### Weapons: 12 weapons in 11 classes (Blastworks)

Each weapon comes with a sub weapon and a special.

| Weapon | Class | How it works | Sub · Special |
| --- | --- | --- | --- |
| Spritzer | Shooter | Rapid mid-range spray, the all-rounder | Splash Bomb · Paint Barrage |
| Spritzer Jr. | Shooter | Huge tank, wide forgiving spray | Spritz Sprinkler · Bubble Shield |
| Twin Squirts | Dualies | One per hand; dodge-roll, then laser-tight turret shots | Pop Bomb · Jet Pack |
| Sweeper Roller | Roller | Roll a carpet of ink; fling a wave (a vertical fling if you jump first) | Skid Bomb · Ink Nova |
| Swish Brush | Brush | Sprint while painting; mash fire for rapid flicks | Pop Bomb · Chroma Camo |
| Bucketeer | Slosher | Swings arcing sloshes over walls | Splash Bomb · Rain Cloud |
| Pop Blaster | Blaster | Explosive shots; a direct hit splashes in one shot | Sticky Bomb · Ink Nova |
| Whirlpool | Splatling | Hold to spin up, release for a long torrent | Spritz Sprinkler · Paint Barrage |
| Bumbershoot | Brella | Shotgun blast; hold to open a shield that blocks shots | Sticky Bomb · Bubble Shield |
| Longshot | Charger | Charged beam with a laser sight; a full charge splashes in one hit | Pop Bomb · Rain Cloud |
| Arc Bow | Stringer | Three-arrow fan; fully drawn arrows burst after landing | Skid Bomb · Chroma Camo |
| Ink Blade | Splatana | Quick slash waves, or a charged overhead chop | Splash Bomb · Jet Pack |

**Specials:**
- **Paint Barrage:** a volley of giant ink balls.
- **Ink Nova:** leap up and slam the ground.
- **Rain Cloud:** a drifting storm that rains ink.
- **Jet Pack:** hover and fire explosive shots.
- **Chroma Camo:** go nearly invisible, move faster and refill ink, like a true chameleon.
- **Bubble Shield:** a dome that blocks enemy fire.

You can **Try** any weapon in the shop and test it on the Bopbots in the Practice Yard
before you buy it. Some weapons unlock at higher levels.

### Gear (Scale & Thread)

There are headgear, clothing and shoes; each piece has one ability:

| Ability | Effect |
| --- | --- |
| Ink Saver | Main weapon uses 12% less ink |
| Sub Saver | Sub weapons use 15% less ink |
| Ink Recovery | Tank refills 20% faster |
| Run Speed | Walk and run 8% faster |
| Swim Speed | Swim 8% faster |
| Special Charge | Special meter fills 15% faster |
| Quick Respawn | Respawn 1.5 s sooner |
| Ink Resistance | Enemy ink hurts and slows you less |

The three abilities you wear stack. Try anything on in the shop before you buy. The
**Salon** at the back of Scale & Thread changes your crest, scales, pattern, eyes and ink
color.

### Stages

| Stage | Setting | Size |
| --- | --- | --- |
| Tangerine Terminal | Shipping docks surrounded by water | 42 × 80 m |
| Skyline Courts | Sunset rooftop court with open light-wells | 40 × 72 m |
| Fizzwater Works | Soda bottling plant on a harbour pier, with climbable silos | 58 × 114 m |
| Mesa Bazaar | Desert market terraces climbing to a central plaza, canyon all around | 60 × 116 m |
| Frostbite Park | Winter skate park with a bowl, quarter-pipes and icy water | 56 × 112 m |

The Clash Tower runs a **live rotation** of two stages that changes every 20 minutes. The
news and the big screen tell you which.

### Prism Plaza

- **PRISM NEWS:** hosts Nova and Dex announce the current rotation when you arrive, then
  keep broadcasting on the Clash Tower's giant screen.
- **Blastworks** and **Scale & Thread** are real interiors. Walk through the door, talk to
  the clerk at the counter, and the shop opens.
- **Locals:** chat with dozens of Chromeleons. They hang out in groups, dance at the DJ
  booth, sit on the tower steps and swim in the ink by the fountain, and they share tips.
- **Practice Yard:** pop Bopbots with any weapon.
- **Clash Tower:** a ~95 m glass skyscraper with LED corner strips, a glowing crown and a
  spire. Walk through the doors to go inside (see below).
- **Painting:** you can paint the whole plaza, and it stays painted for the session.
- **The back alley** by the DJ booth hides a loose manhole cover…

### Inside the Clash Tower

Six levels are stacked around an open atrium, with a glass elevator riding up the middle.
Walk into the car and press **E** to pick a floor (or press **1–6**). Walking up to the doors
calls the car to your floor. Each floor's glowing terminal starts a different kind of match:

| Floor | What's there |
| --- | --- |
| **L · Lobby** | CPU Turf Rush, the rotation board, the exit back to the plaza |
| **2 · Open Battle** | Online match: the always-on queue |
| **3 · Private Rooms** | Make a room and share its code, or join a friend's |
| **4 · Zone Clash** | Zone Clash vs CPUs |
| **5 · Ink Hoops** | Ink Hoops vs CPUs |
| **R · Sky Deck** | Open-air roof with the best view in the city, and the arcade |

After a match you come back to the floor you queued from.

**Tongue Snack** is a little minigame you can play while you're searching for players or
waiting in a room: click (or press SPACE) to flick your tongue at bugs. Gold butterflies
are worth the most, gray goo gums up your tongue, and catching bugs in a row builds a
combo. Your best score is saved. You can also play it full size at the Sky Deck arcade.

## Online play (play with friends)

Go to floor **2** (online match) or **3** (private rooms) of the **Clash Tower**, or press
**PLAY ONLINE** on the title screen, which takes you straight to floor 2:

- **Online Match:** an always-on queue. The game keeps looking for other players, puts
  you in a shared lobby, and starts the match 30 seconds after a second player joins (or
  immediately with 8 players). CPUs fill any empty seats. The host can also start right
  away with CPUs.
- **Private Match:** create a room and share its **4-letter code**. Friends type it in
  under *Join room*. The host picks the mode, stage, time limit (1–5 min), whether CPUs
  fill empty seats and their skill, and how teams are chosen (players choose, or the host
  decides, with a shuffle button). Everyone picks their own weapon in the room. After a
  match, *Back to room* returns everyone to the same room for the next round.
- **CPU Match:** the offline game against bots, as before.

**How it works:** players connect **directly to each other** (WebRTC). A free public
PeerJS service introduces them, so nobody has to run a server. The player who created the
room is the **host**: their browser runs bots, scoring and the paint, and everybody else
streams it. Your own character runs on your machine, so movement and aiming feel
instant. If a player drops out, a CPU takes over their character. If the host leaves,
the match ends for everyone.

**What everybody needs:**
1. **The same version of the game.** The room rejects anyone whose version doesn't match.
2. **The game running in the browser,** in either of these ways:
   - **Easiest: GitHub Pages.** In this repository on GitHub, open *Settings → Pages*, set
     *Source: Deploy from a branch*, pick the branch with the game, folder `/ (root)`, and
     save. After a minute everyone can play at `https://<your-user>.github.io/plank/chroma/`.
     There's nothing to install, and it works on any computer with a modern browser.
   - **Or each player runs it locally** with `chroma/play.bat` / `python3 chroma/serve.py`
     from the same version of the repo. Online play still works between local copies.
3. **Internet access.** Very strict networks (some schools and offices) can block
   peer-to-peer connections.

You can also host your own PeerJS signalling server and add
`?peerhost=your.server&peerport=443&peerpath=/` to the URL. To test with two windows on one
computer without the internet, add `?net=local` to both tabs.

### Your house (Prism Heights)

**PLAY** on the title screen wakes you up at home: a sunny loft with a big window over the
city. You're not carrying anything indoors (no painting inside!). Your weapons live on the
**gear wall** by the front door, and each class is shown its own way: rollers lean against
the wall, chargers rest on wall hooks, shooters and blasters hang on a pegboard, dualies
sit crossed on a little shelf, brushes stand in a paint bucket, sloshers sit on a mat,
brellas go in an umbrella stand, splatlings rest on a floor stand, stringers hang from a
peg and splatanas lie on a sword stand. Walk up, aim at one and press **E** to grab it.
Press E on another to swap, or on the one you're holding to put it back. The front door
won't open until you've picked a weapon. Step out and you're in Prism Plaza, by the
**PRISM HEIGHTS** door on the south-east block. Press E at that door to go home again.

- **NEST & NOOK catalog:** use the laptop on your desk to buy furniture with your coins.
  There are 48 pieces in 10 categories (beds, sofas, beanbags, tables, bookshelves, lamps,
  plants, rugs, posters, a clock that shows the real time, an aquarium, an arcade cabinet,
  a DJ deck, a fridge, a fireplace and more), plus wallpapers and floors. You start with a
  bed, a TV corner, a bookshelf and a few other things, so the house never looks empty.
- **Decorate mode (F):** the roof comes off and you get an overhead view. Click a piece to
  pick it up, move it on the grid and click to place it. The ghost turns red where it won't
  fit. **R** (or right-click) rotates, **X** / Delete puts it back in storage, **Esc**
  cancels, **Q/E** turns the view, the mouse wheel zooms and **WASD** pans. Bought items wait
  in the storage tray at the bottom. Small things (lamps, the TV, plants, the globe…) also
  fit on tables, desks, dressers and counters. Posters, clocks, mirrors and shelves go on
  the walls. With a controller, the left stick moves a cursor, A picks up and places, Y
  rotates, X stores, LB/RB turn the view and B backs out.
- **Use things:** sit on chairs, sofas and beanbags, nap in the bed, switch lamps and the TV
  on and off, play INK INVADERS on the arcade, check the mirror to change your look, or start
  a house party at the DJ deck (stand still to dance).
- Big furniture blocks your way (and you can jump on the bed). Everything is saved with your
  profile.

### Story mode: The Underside

Something gray is bubbling up from under the city. Climb down the manhole in the back
alley to find Captain Veil and the secret Chroma Guard. Then take back the stolen Hue
Cores, level by level, from Baron Grisaille and his colorless Drab.

The campaign runs about an hour on a first playthrough: three sectors of five levels, each
ending in a boss.

| Sector | Levels | Boss |
| --- | --- | --- |
| 1. The Paint Works | First Splash · Ghost Walk · Turret Alley · Drone Heights | The Gray Engine (4 phases) |
| 2. The Rinse Reservoir | Sponge Sluice · Rising Tide · Bottling Line · Pump Station | The Grimewyrm (3 phases) |
| 3. Grisaille Manor | Lights Out · Crumbling Gallery · Chroma Locks · The Grand Ascent | Baron Grisaille (3 phases) |

- **Mechanics** get a level of their own before they are mixed: moving and orbiting platforms,
  crumbling floors, sponges that grow when painted, paint switches (some timed), grind rails,
  updraft fans, conveyors, rising floods you stop by painting the drains, swim-only membranes,
  wave arenas, and pitch-dark rooms lit by painting lanterns.
- **Enemies** always warn you first and can be countered: Wardens (shielded, flank them),
  Glints (laser sight, then a shot), Rumblers (they charge and stun themselves on walls),
  Goopers (hiding in gray puddles), Splotches (they split) and Pilfers (they steal your ink).
- **Collect** 39 Lost Swatches (in the Swatch Book in each hub) and Hue Shards, which Dabble's
  Swap Shop trades for upgrades: Tough Scales, Quick Refill, Super Charge, Prism Burst,
  Bold Hues and Shard Magnet.
- Each hub gets its color back as you return its cores. Clearing a boss opens the gate to
  the next sector's hub.

Progress (name, look, gear, coins, level, weapons, house, story, settings) is saved in your
browser.

## Under the hood

- **Paint system:** every paintable surface has its own region in a 2048² atlas
  (R = team A, G = team B, B = baked ambient occlusion). Splats are drawn on the CPU,
  which gives exact turf counts and "what am I standing in" checks. Only the changed
  rectangles are uploaded each frame. A shader patch turns that data into glossy, bumpy,
  noise-edged wet ink with wall drips.
- **Rendering:** HDR half-float pipeline with 4× MSAA, a mip-chain bloom, ACES tone
  mapping, sky-based image lighting, shadows that follow the player, a water shader,
  outlined characters, distance-based level of detail, and instanced props. The news
  studio renders into a texture for the plaza's big screen.
- **Gameplay:** capsule-versus-solid physics; projectile, beam, melee and shield combat;
  bomb, sticky, skid and sprinkler subs; and bots with A* grid navigation and per-class
  behaviors (they spin up splatlings, draw bows, tap brellas and dodge-roll).
- **Audio:** fully synthesized with WebAudio. Music uses distorted guitars, slap bass and a
  formant "singer" in gibberish; there are 17 tracks (three battle songs with
  final-minute variants, plus shop, news and story tracks), along with 3D-panned sound
  effects and ambience.

## Dev / QA

```bash
node chroma/tools/smoke.mjs               # paint counts, collision, raycasts, pathfinding, module imports
node chroma/tools/shot.mjs "index.html?quick&skipintro&qa&autoplay" battle.png --wait 20000
node chroma/tools/playtest.mjs plaza      # drives real keyboard/mouse input
node chroma/tools/flowtest.mjs            # title -> house (creator) -> plaza -> tower -> CPU lobby -> battle
node chroma/tools/towertest.mjs           # tower floors, elevator, terminals, minigame, exit
node chroma/tools/nettest.mjs [--peerjs]  # two-player private match (local or real transport)
node chroma/tools/quicktest.mjs [--peerjs] # two-player online quick match
node chroma/tools/housetest.mjs           # house: grab a weapon, door, plaza + back, buy, decorate, reload
node chroma/tools/storytest.mjs [s1 s2 s3 hub shop migrate cycle ending l1..l15] [--shots]  # story (STORY_SLOW=<factor> on slow machines)
```

URL flags:

| Flag | Effect |
| --- | --- |
| `?quick` | Straight into a battle |
| `?plaza` | Straight into the plaza |
| `?house` | Straight into your house |
| `?story[=hub\|hub2\|hub3\|l1..l15]` | Straight into story mode (a hub or a level) |
| `?tower[=0..5]` | Straight into the Clash Tower (optionally on a floor) |
| `&stage=terminal\|skyline\|fizzwater\|mesa\|frostbite` | Pick the stage |
| `&weapon=<id>` | Pick the weapon |
| `&skill=easy\|normal\|hard` | Bot difficulty |
| `&time=<seconds>` | Match length |
| `&skipintro` | Skip the battle intro |
| `&nonews` | Skip the news broadcast |
| `&autoplay` | A bot drives your character |
| `&qa` | Low-cost rendering for headless runs |

Screenshots go to `chroma/qa/` (git-ignored).

---

CHROMA CLASH is an original game. Its characters, names, art, music and levels are all
made for this project.
