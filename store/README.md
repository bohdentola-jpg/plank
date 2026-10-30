# DRIP LINE

*The train that never stops.*

A collecting game you can play on your phone. You're a customizable toy figure
riding a graffiti-covered subway train that loops under the city all night.
Every car is a different shop, everything is paid for in tokens you earn by
playing, and everything you buy or win, you can wear.

There is no real money anywhere. Tokens are only earned: by logging in every
day, doing daily jobs, playing the arcade, and finding loose change on the
train.

No install, no build step, no art files. The figure, the shopkeepers, the train
cars, all 93 items, the music and the sound effects are drawn or synthesized in
code.

## Run it

**Windows:** double-click **`store.bat`** in the repo root.

**Mac/Linux:**

```bash
python3 serve.py --open store/
```

Or serve the repo with any static server and open `/store/`. It needs
`http://`; opening `index.html` straight from disk won't work (the single-file
build below does).

To put it online, host the repo as a static site (GitHub Pages, Netlify,
Cloudflare Pages…) and share the `/store/` URL.

## The train

Walk car to car through the door at the end of each car (or swipe, or use the
arrows).

| Car | Who | What |
| --- | --- | --- |
| 1 · Front car | **Signal** (traffic-light head) | Daily punch-in, the job board, your closet lockers |
| 2 · Threads | **Drippy** (paint-bucket head) | Tops and bottoms |
| 3 · Kicks & Decks | **Lace** (sneaker head) | Sneakers and skate decks |
| 4 · Lids | **Cone** (traffic-cone head) | Hats and shades |
| 5 · Ice | **Mira** (disco-ball head) | Chains, grills, bags |
| 6 · Arcade | **Joy** (arcade-cabinet head) and **Eight** (8-ball head) | Tunnel Run, the Tag Wall, The Grabber, the shell game |
| 7 · Capsules | **Plug** (fire-hydrant head) | Basic and Deluxe capsule machines |

**Secret places** (spoilers):

- **The Cab**: the driver's cab behind the front car. The key comes from your
  first 7-day streak, or sometimes from The Grabber. Its lockbox refills every
  night.
- **The Vault**: knock on the graffiti panel in Car 7 and say the weekly secret
  word. Signal tells you the word when you finish all three daily jobs. The
  vault sells mythics for huge token prices.
- **The Ghost Car**: a car from 1931 that couples onto the back of the train on
  some nights (about 1 day in 7), all through the midnight hour, or when you use
  a Ghost Ticket from The Grabber. **Static** (a CRT-TV head) sells see-through
  spectral gear.
- One golden token hides somewhere on the train every day.

## Daily loop

- **Punch in** with Signal: a 7-day reward cycle (a capsule ticket on day 3, an
  Epic ticket on day 7), streak freezes, and milestones on day 14, 30 (a
  legendary visor), 60, 100 (the mythic Hundred Halo) and 365.
- **Fresh stock every midnight.** Each shop shows 6 items from its pool, and its
  featured slot can roll epic or legendary. One featured item a day is the
  **drop of the day**, 25% off.
- **A free capsule pull every day.**
- **Three jobs from Signal**, each paying tokens. All three pay a bonus, a
  capsule ticket and the vault word.
- **Minigames**, 3 paid plays each per day.
- **Loose tokens** hidden in every car.

## Rarity

Common → Uncommon → Rare → Epic → Legendary → **Mythic**.

- **Basic capsule** (250 tokens): 0.1% mythic, epic or better guaranteed within
  40 pulls.
- **Deluxe capsule** (1,200 tokens): never common, 1.5% mythic, legendary
  guaranteed within 25 pulls.
- **Prismatic**: any capsule pull has a 1 in 200 chance to come out
  shimmering, and any shop purchase 1 in 500.
- **Duplicates** turn into tokens. A prismatic duplicate upgrades the copy you
  own.
- **Mythics** come from capsules, streak milestones and the vault.
- **Auras** are wearable effects around your figure: sparkles, flames, a ghost
  glow, lightning, a rainbow, token rain. They're all legendary or mythic.

Your **drip score** adds up the rarity of everything you're wearing. A
**fit card** turns your outfit into a picture you can share.

## Controls

| | Keyboard | Touch / mouse |
| --- | --- | --- |
| Use / talk / shop | Click, or **E** to talk | Tap the thing |
| Next car / back | **→** / **←** (or W / S) | Tap the door, swipe, or the arrow buttons |
| Closet · Train map · Stats | **C** · **M** · **P** | Tap yourself, or the buttons |
| Choices | **1-9**, arrows + E | Tap |
| Close / skip | **ESC** | ✕ |

## Make it yours

| File | What to change |
| --- | --- |
| `src/data/items.js` | **Every item**: name, slot, rarity, token price, which car sells it, where else it can come from, the shopkeeper's line, and its `art` spec (drawing type + colors, patterns, finishes). Also the shops and what their keepers say. |
| `src/data/content.js` | Capsule odds and pity, streak rewards and milestones, Signal's daily jobs, weekly vault words, news headlines. |
| `src/config.js` | The game's name. |

## Under the hood

- `src/art/figure.js`: the vinyl-toy figure (4 head shapes, 6 faces, 12
  colorways), every wearable drawn on the body (front view and a side view for
  the runner), patterns, gold/chrome/glow/ghost/holo finishes, the prismatic
  shimmer, auras, and the 9 object-headed shopkeepers.
- `src/art/car.js`: the train-car interiors in one-point perspective, with
  tunnel lights streaking past the windows, swaying straps and flickering
  lights.
- `src/art/products.js`: the flat item icons used on cards.
- `src/world/ride.js`: renders the current car, lays real buttons over
  everything you can tap (so keyboards and screen readers work too), and
  animates walking between cars.
- `src/systems/econ.js`: every rule: tokens, inventory, equipping, the daily
  rotation, capsules and pity, streaks, jobs and secrets. Everything daily is
  seeded from the date, so everyone sees the same shop on the same day.
- `src/audio.js`: WebAudio only: a lo-fi loop, chimes, voices, effects.
- `src/games/`: one shared arcade cabinet (`frame.js`) and five games.

Checks: `npm run store:smoke` runs the rules (streaks, milestones, shop
rotation, buying, capsule odds and pity, the claw, the daily caps) without a
browser. `npm run store:build` bundles everything into one self-contained file,
`store/dist/drip-line.html`, that you can host anywhere or open straight from
disk.

QA helpers (they only work when served from `localhost` or `127.0.0.1`, so
players on a live site can't use them): `?quick` skips the title, `?car=kicks`
starts in a car, `?open=shop:threads` / `closet` / `capsules:deluxe` / `train` /
`me:collection`, `?game=tag`, `?day=+1` pretends it's tomorrow, and in Tunnel
Run `?qa=god` or `?qa=auto`. `dev/figures.html`, `dev/cars.html` and
`dev/products.html` render the cast, the cars and the item icons on their own.

Everything saves in the browser (`localStorage`), so progress belongs to that
device. Tokens live on the player's device too, which is fine for a game with
no money in it.

Fonts (Bungee, Gochi Hand, Permanent Marker, Sedgwick Ave Display, Rubik Wet
Paint) are bundled under their open licenses. See `fonts/LICENSES.txt`.
