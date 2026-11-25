# hide

A first-person horror game about hiding. There's no story. You're in a closed
supermarket at night with rain on the roof, and something tall is walking the
aisles. You have one spot that's yours: a fort of cardboard boxes in the back
corner of the stockroom with a blanket and a battery lantern.

The game is built around two feelings: getting back to that spot after a run
and feeling safe again, and lying there holding your breath while the thing
stands right outside the gap.

## Play it

There are two files. Both are fully self-contained (three.js is bundled in),
so you can double-click them. You don't need a server or an internet
connection, except for the two web fonts.

| File | For | What's different |
| --- | --- | --- |
| **`hide.html`** | computer | The bigger store (7 aisles, chest freezers, a staff room with lockers), soft shadows from your flashlight and the lantern, HDR bloom, lens grain and aberration, dust in the beam, HRTF 3D audio, a 10-minute night |
| **`hide-mobile.html`** | phone / tablet | A smaller store (4 aisles), touch controls, no shadows, lighter rendering, a 6½-minute night |

Use headphones. Most of the game is sound.

## How it plays

- **Make it to 6:00 AM.** The clock starts at midnight.
- **Your lantern is dying.** Its batteries run out in a couple of minutes, and
  sitting in the dark wears your nerves down. Battery packs (bright orange
  cards) turn up on shelves, checkout belts and stockroom stacks. Take them
  back to your spot and they go into the lantern automatically.
- **Make it yours.** A pillow, a teddy bear, string lights, a thermos and a
  comic book (desktop has all five, mobile has three) are scattered around the
  store. Each one you bring home appears in your spot, makes it calmer, and
  makes the lantern last longer.
- **It hunts by sound and light.** Running is loud. Walking is quieter.
  Crouching is nearly silent. Your flashlight helps you see, and it also makes
  you visible, especially if you shine it in its face. Its eyes catch the beam.
- **Hide.** You can crawl into your spot, under two of the checkout counters,
  or (desktop) into the slatted staff lockers. If it sees you go in, it will
  come and look.
- **Hold your breath.** When it's checking where you're hiding, it's listening.
  The more scared you are, the louder you breathe. Hold your breath until it
  leaves. If you run out of air, you gasp.
- It comes to check on your spot now and then. Lean out to peek if you dare.

### Controls

| | Computer | Phone |
| --- | --- | --- |
| Move / look | WASD + mouse | left thumb / right thumb |
| Run | Shift | **run** (hold) |
| Crouch | C | **crouch** |
| Hide / take / leave | E | **use** |
| Flashlight | F | **light** |
| Hold breath | Space (hold) or right mouse | **hold breath** (hold) |
| Peek out of your spot | W | push forward |
| Pause / mute | Esc / M | **II** |

## How it's made

Everything is generated in code at load time. There are no models, images or
audio files.

- **The store** is laid out from parameters (one profile for desktop, one for
  mobile): gondola shelving stocked with a few thousand products wearing
  labels from a procedural atlas of made-up brands, checkouts, dairy and
  freezer cases, pallet racking, the staff room, and your fort. Static
  geometry is merged into a few meshes per material and split into spatial
  chunks.
- **The textures** are painted on canvases: waxed vinyl tile with scuffs and
  grime, sealed concrete with saw cuts and cracks, cinder block, a stained
  drop ceiling, kraft cardboard, flannel tartan, mottled skin, and a
  flashlight beam pattern used as a light cookie. Normal and roughness maps
  are derived from the same height fields.
- **The monster** is a sculpted lathe-and-joint rig (ribcage, vertebrae,
  four-fingered clawed hands, digitigrade legs, a hinged jaw) animated
  procedurally: gait, hunch, sniffing, peering into gaps, head twitches and
  the lunge.
- **The AI** uses a navigation grid with A\* and line-of-sight. It wanders,
  investigates noises, stalks, chases, loses you, searches nearby hiding
  spots, and checks them while listening for your breath. A director paces
  it, pressing closer when things are quiet and backing off after a close
  call, so tension and relief alternate.
- **The sound** is all WebAudio synthesis: rain on the roof, fluorescent hum
  and a buzzing tube, freezer drone, a lantern whine, your footsteps,
  breathing and heartbeat, its claws on the tile, rasping breath, sniffing,
  growls and the scream. There's thunder, a PA chime on the hour, a tension
  drone, and a warm pad that comes in when you're safe. Everything outside
  is muffled while you're hidden.
- **Rendering** (desktop): an HDR multisampled target, a 5-level bloom chain,
  and one composite pass that applies ACES, a cold/warm grade driven by fear
  and comfort, chromatic aberration, lens distortion, a vignette that pulses
  with your heartbeat, and film grain. Resolution scales down automatically if
  the frame rate drops.

## Develop

```bash
cd hide
npm install           # three + esbuild (+ playwright, already on most CI images)
npm run build         # writes hide.html and hide-mobile.html
node tools/qa.mjs hole,aisle,check          # headless screenshots into ../qa/
node tools/qa.mjs hole --mobile
node tools/sim.mjs --secs 600 --mode hole   # soak-test the AI for a whole night
```

The source lives in `src/`: `level.js` is the store, `monster*.js` is the
creature and its AI, `audio.js` is the sound, `post.js` is the image pipeline,
and `main.js` holds the game loop. Add `?debug` to the URL to expose
`window.__hide`, and use `?mobile` or `?desktop` to force a profile.
