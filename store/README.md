# 3RD RAIL MARKET

*The shop under the city.*

A browser store you walk around in. You're a rat in a hoodie on a night-time
subway platform. The shops are kiosks run by critters, and every day there's a
reason to come back: a streak to keep, three jobs from a mystery caller, new
deals, tokens on the floor, minigames, and secret stores that only open for
people who dig.

No install, no build step, no art files. Everything (characters, the station,
58 product illustrations, stickers, music and sound) is drawn or synthesized in
code.

## Run it

**Windows:** double-click **`store.bat`** in the repo root.

**Mac/Linux:**

```bash
python3 serve.py --open store/
```

Or serve the repo with any static server and open `/store/`. It needs `http://`;
opening the file directly with `file://` won't work.

To put it online for anyone, host the repo as a static site (GitHub Pages,
Netlify, Cloudflare Pages…) and share the `/store/` URL.

## What's in it

**Stations on the 3 train** (ride between them from the map or by tapping a stop):

| Stop | What's there |
| --- | --- |
| **Token Sq** | Shelly's token booth (daily swipe + token exchange), the phone booth, the WANTED poster (deal of the day), **Threads** (apparel), **Top Shelf** (hats, chains, bags), **The Grabber** claw machine, **3-Cup Charlie** |
| **Drip St** | **Sole Train** (sneakers), **Rascal's Cans** (spray paint, art), **Tracks** (tapes, vinyl, headphones), the **Legal Wall** (Tag It), the **Rat Race** arcade cabinet |
| **Bodega Blvd** | **Bodega** (snacks, candles, mystery bags), a door marked EMPLOYEES ONLY, a locked maintenance door, a mural with a clue |

**Secret stores** (spoilers):

- **The Back Room**: knock on the EMPLOYEES ONLY door at Bodega Blvd and give
  the weekly password. The phone booth gives a riddle for it every day, and the
  answer outright once you finish all three daily jobs.
- **Big Al's** (the sewers): the maintenance door needs a key. The Grabber
  sometimes holds one, and Shelly hands one over on your first 7-day streak.
- **Old Hall** (a ghost station): sometimes the train that shows up isn't the 3.
  12% of rides, guaranteed during the midnight hour, or with a Ghost Ticket from
  The Grabber. You get 3 minutes to shop before the last train comes back.
- A cracked tile at Drip St. Knock on it.

**Daily loop:**

- **Swipe in** at the token booth: a 7-day reward cycle (day 3 sticker, day 7
  big payout plus a key), streak freezes, perfect-swipe bonus.
- **Three jobs a day** from the voice on the phone (play a game, visit shops,
  ride the train…). Each pays tokens; all three pay a bonus, a sticker and the
  password.
- **Deals** roll at midnight, seeded by the date, so everyone sees the same
  ones. The news ticker and the WANTED poster announce them.
- **Tokens on the floor** in every station, some up high (hop with SPACE). One
  big token hides somewhere each day.
- **Minigames**, each with 3 paid plays per day: Tag It (spray-paint the
  outline), Rat Race (endless runner), 3-Cup Charlie (bet tokens), The Grabber
  (claw machine).
- **Sticker book**: 24 stickers on 3 pages. A full page gives a coupon, and
  the Legends page gives a permanent 10% off.

**Tokens** buy coupons at the booth (free shipping, $5, 10%, 20%) or streak
freezes. Tokens can't be bought with money, so 3-Cup is never real gambling.

## Controls

| | Keyboard | Touch / mouse |
| --- | --- | --- |
| Walk | A/D or ←/→ (SHIFT to run) | Tap the floor |
| Talk / use / shop | E or Enter | Tap the thing (you walk there) |
| Hop | SPACE / W / ↑ | Tap your rat (tapping a floating token walks you under it and hops) |
| Map · Bag · Stash | M · B · P | Buttons (top right, or the bottom bar on phones) |
| Dialogue choices | 1-9 or arrows + E | Tap |
| Close / skip | ESC | ✕ |

A gamepad works too: stick or d-pad to walk, A to use, X/Y to hop, Start for the map.

## Make it yours

| File | What to change |
| --- | --- |
| `src/data/catalog.js` | **Products and shops.** Names, prices, descriptions, sizes, limited stock, which shop sells what, and what each shopkeeper says. Each product's `art` picks a drawing from `src/art/products.js` (hoodie, tee, low/high sneaker, cap, cassette, …) plus its colors and emblem. |
| `src/config.js` | Store name, currency, shipping rule, tokens back per dollar, **checkout mode**. |
| `src/data/content.js` | Stickers, the daily jobs, streak rewards, the token exchange menu, weekly passwords + riddles, news headlines. |
| `src/world/scenes.js` | Station layouts: move shops around or add posters, benches and NPCs. |

### Taking real orders

Out of the box, checkout runs in **demo mode**: orders are saved on the
shopper's device and nobody is charged. To sell for real, set
`checkout.mode = 'link'` and `checkout.url` in `src/config.js` to your own
hosted checkout. The bag sends the cart there as `?order=<json>` (product ids,
sizes, quantities, coupon, total). That works with a Shopify cart permalink
builder, a Stripe Checkout session created by a small serverless function, or a
Gumroad/Payhip product page.

Before going live, keep in mind:

- **The token economy runs in the browser.** Tokens, streaks and coupons live
  in `localStorage`, so a determined shopper can edit them. Validate coupons on
  your server, or cap what a coupon can be worth.
- **Price and stock are checked at checkout, not in the page.** Re-price the
  cart server-side from your own product list.

## Under the hood

- `src/ink.js`: the hand-drawn renderer. Shapes get a seeded wobble, flat
  fills, a cel-shade crescent and a thick ink outline. Characters "boil" (the
  wobble seed changes ~7×/sec) like hand-drawn animation.
- `src/world/stage.js`: static station art is baked into 512-unit background
  tiles (rebuilt on resize). Shopkeepers, lights, neon, trains and particles
  are drawn live. Quality drops automatically on slow devices.
- `src/systems/econ.js`: every rule (streaks, jobs, deals, claw pit, coupons,
  bag math). Everything daily is seeded from the date.
- `src/audio.js`: WebAudio only. A lo-fi boom-bap loop with per-station moods
  (darker in the sewer, a music box in the ghost station), door chimes, train
  rumble, voice blips.
- `src/games/`: one shared cabinet (`frame.js`) and five games.

Checks: `npm run store:smoke` runs the rules (streaks, freezes, deals, coupons,
checkout math) without a browser. `npm run store:build` bundles everything
into one self-contained file, `store/dist/3rd-rail.html`, that you can host
anywhere or open straight from disk.

QA helpers (these only work when the store is served from `localhost` or
`127.0.0.1`, so shoppers on a live site can't use them to skip secrets or farm
rewards): `?quick` skips the title, `?scene=drip&x=1500` starts anywhere,
`?open=shop:threads` / `bag` / `map` / `stash` / `catalog`, `?game=tag`,
`?day=+1` pretends it's tomorrow (for testing streaks), and in Rat Race
`?qa=god` (smash everything) or `?qa=auto` (autopilot). `dev/sheet.html`,
`dev/products.html` and `dev/world.html` render the cast, the catalog art and
the stations on their own.

Fonts (Bungee, Gochi Hand, Permanent Marker, Sedgwick Ave Display, Rubik Wet
Paint) are bundled under their open licenses. See `fonts/LICENSES.txt`.
