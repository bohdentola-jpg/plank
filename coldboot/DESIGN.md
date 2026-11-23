# COLD BOOT — design bible

*Спасти мир. Тихо.* — Save the world. Quietly.

A third-person open-world spy game for the browser, a sibling of MIDNIGHT FREQUENCY: the
picture is a CRT television in a dark room (now a widescreen NOVATRON), neon on snow,
bloom, scanlines, a synthesized soundtrack. Three.js r160, plain ES modules, no build step.

---

## 1. The story

### Premise
Northstar Dynamics sold the world **AURORA**, an "AI grid-stability" controller now
inside power grids on every continent. Hidden in it is **WORMWOOD (ПОЛЫНЬ)**, a dormant
payload that wakes at dawn in five days and shuts the grids down for good. Northstar's
founder **Cyrus Halloran** believes civilisation needs a *cold boot*. He runs it from
**the Dome**, a Cold War radar station on Kettle Hill above **Port Zarya, Alaska**
(pop. 1,140), a fishing town on the Bering Strait founded in 1822 as a Russian-American
Company post. Northstar bought the town: new smart streetlights (cameras), new broadband,
the gleaming **NORTHSTAR 24** corner store, and its politics.

The abort code, the **Root Key**, sits on an air-gapped drive in the Dome's vault.
Halloran's paranoia split access across the town's political tree: the vault opens with
the **Mayor's municipal key** plus **3 of 5 council "continuity cards"** (Shamir shares
the council members signed without knowing what they were), and only someone the
Development Board trusts gets inside the Dome — at the **Winter Gala** on Friday night,
day 5.

Across the strait in **Bely Mys (Белый Мыс), Chukotka**, a fish-warehouse crew of
ex-engineers found WORMWOOD in strange traffic from Alaska. They are not a government.
They are six people at a table with tea, a laptop and a restored Soviet troposcatter
dish, the only uplink that can broadcast the abort without going through Northstar.

### The player — "Rybka" (Рыбка, little fish)
Custom character (name, look, clothes). Fourteen months ago their crab boat, the
*Margaret Rose*, sank in the Bering Sea; Dmitri's crew pulled them out of the water.
Since then they have lived in Bely Mys fixing engines and roofs. Valentina named them
Rybka. The team calls them that, which is why voiced lines never need the player's
name. Cover in Port Zarya: a travelling handyman. People trust someone who fixes things.
The player is a silent protagonist in voiced scenes (choices are text).

### The team (Russian, voiced in Russian with English subtitles)
| | Who | Voice |
|---|---|---|
| **Dmitri Arkadyevich Volkov** (62) | Leader. Ex-engineer of the Bely Mys station. Grey beard, slow, dry. | male, deep |
| **Nadia (Nadezhda) Sokolova** (34) | The handler: the voice in your earpiece all game. Calm, quick, warm underneath. | female |
| **Lyosha (Alexei) Orlov** (26) | The coder. Hoodie, glasses, too much sugar in his tea. Teaches you Python at night. | male, young |
| **Grisha (Grigory) Bondarenko** (45) | Pilot and mechanic. Huge, loud, hugs. Talks you down in the finale flight. | male, big |
| **Baba Valya (Valentina Petrovna Kuznetsova)** (78) | Cryptographer (Soviet ciphers, 1970s). Knits, cooks, terrifying wit. | female, old |
| **Ivan Tikhonov** (50) | Documents. Says almost nothing. | male, quiet |

### Port Zarya — the political tree (bottom → top)
1. **Townsfolk** — friendships, the job board, Town Spirit.
2. **City Council** (each holds a continuity card; any 3 open the vault):
   - **Dolly Finch** — owns the Midnight Sun Diner. Gossip, heart of town.
   - **Hank Brubaker** — Brubaker Hardware & Fuel. Gruff, cheap, decent.
   - **Ruth Aqpik** — retired teacher, elder, the town's conscience. Distrusts Northstar.
   - **Ray Moody** — cannery foreman, union man, bitter, darts at the Rusty Anchor.
   - **Lyle Pruitt** — insurance & real estate, Northstar's yes-man, wants to be mayor.
3. **Chief Marta Kowalczyk** — police chief. Suspicious of you, honest.
4. **Gideon Shaw** — City Manager. Northstar's man inside City Hall.
5. **Mayor Walt Hennessey** — folksy, tired, in Northstar's debt. Holds the municipal key.
6. **Cyrus Halloran** — Chairman of the Port Zarya Development Board. The top.

### Others in town
- **Sasha Koshkin** (82) — Koshkin's General Merchandise, est. 1911 by his grandfather.
  Speaks old Alaskan Russian. Rents you his late brother's cabin, puts you on his 1952
  till, and on the last day dresses you for the Gala from his back room.
- **Evan Pike** — manager of NORTHSTAR 24. Perfect smile, knows your name before you say
  it. The town's eyes.
- **"Mr. Grey"** — grey parka, on your plane, everywhere after. Revealed on day 3 as
  **Special Agent Daniel Okafor**, FBI Anchorage, investigating Northstar *and* you.
- **Father Gabriel Popov** — priest of Holy Transfiguration (blue onion domes). Chess, old radios.
- **Wade Tolliver** — bush pilot at the airstrip, owns the little helicopter *Dragonfly*,
  gives flying lessons (pays off in the finale).
- **Nina Kowalczyk** (17) — the chief's daughter, runs KZRY 88.9 community radio.
- **Lou Amarok** — owns the Rusty Anchor bar. Darts champion.
- **Tommy Aqpik** — Ruth's grandson, mechanic, snowmobile racer.
- **Doc Ellen Haverford** — the clinic. **Pearl Jessup** — the post office.

### Day by day
Five days, Monday to Friday, about 35–45 minutes each (3–4 hours in all). Each day is
one `src/data/script/dayNN.js` with `DAY = { n, start, mustFinish }`: a short spine of
concrete objectives (a named place and a person), one or two clock gates (`m.waitUntil`;
T skips ahead), one field hack, and one Night School lesson. You can't sleep until the
day's `mustFinish` missions are done.

| Day | Title | Spine | ~Time |
|---|---|---|---|
| 0 | **Тихо** (prologue) | Character creator → the warehouse table at Bely Mys (voiced, Russian: Wormwood wakes "in five days, at dawn") → the plane (earpiece check, Mr. Grey takes your photo). | 8 min |
| 1 Mon | Arrival | The airstrip and Wade → the town reveal → Koshkin rents you his brother's cabin → Father Gabriel's frayed bell rope (rope from Hank's) → ring the bell, wire the relay in the belfry → home. Lesson 1 (print). | 30 min |
| 2 Tue | Cover | A shift on Koshkin's till → meet the council before tonight (Dolly at the diner, Ruth at the post office, Lyle at City Hall) → 7 pm council meeting: Gideon Shaw's "Phase Two", photograph the dais, Chief Kowalczyk at the door → a grey car with its lights off → field hack **faces**. Lesson 2 (conditions). Pearl's job board opens. | 35 min |
| 3 Wed | Ears and Eyes | A call home → Walt hires you to clean City Hall: mop, sweep, a bug under the council table and one in the mayor's office → home: the cabin was searched, a lens in the smoke alarm → sweep it → 5:30 pm loop the square's streetlight cameras (field hack **camloop**) → 8 pm the bug catches Shaw on the "continuity cards": the mayor's key plus any 3 of 5 → outside the diner, Mr. Grey is FBI Special Agent Okafor → three questions at the police station: a deal, or not. Lesson 3 (loops). | 40 min |
| 4 Thu | The Seat | Ray quits the council at the Rusty Anchor (his card) → at City Hall the charter sends the seat to a town meeting tonight; Ruth nominates you against Lyle Pruitt → the petition round (Hank, Dolly, Father Gabriel) doubles as the parts run for Walt's late wife's music box → file with Pearl → fix the music box: Walt hands you the mayor's key, or you press it into wax → Northstar's ledger at Pruitt Realty → 7 pm debate at the Parish Hall (field hack **ledger** on the projector), ballots, the count → Gala invitation (the council seat, the Board, or Halloran himself), Ruth's card, Gideon's threat. Lesson 4 (strings). | 45 min |
| 5 Fri | The Winter Gala | Dress rehearsal (Lesson 5: the shape of the finale's `unwrap(shards)`) → the third card if one is still missing → Wade and his helicopter → a 1962 suit or dress from Koshkin's back room → goodbyes → 7 pm Walt drives you up Kettle Hill → the Dome, Halloran's speech → the service door, the server room panel, the vault door: brass key + three cards (field hack **shares**) → the drive → alarm → a snowmobile down to Wade's hangar → Okafor looks the other way → `G.finale()`. | 35 min |
| 5→6 | **Cold Boot** | Flight across the strait under fire (QTE; each of Wade's lessons widens the window). Bely Mys: the warehouse is empty, border guards took the team. Plug in the drive. **Ten minutes:** write `unwrap(shards)` (field hack **final**). The lights stay on. Guards burst in. | 15 min |
| — | Epilogue | A jail cell, the sun going down over the strait, the team in the next cells. Credits. | |

### Being watched
Northstar's attention is a meter (**ATTENTION**). Cameras (NORTHSTAR 24, City Hall, smart
streetlights), Evan, night SUV patrols, drones and Mr. Grey all *see*. Doing spy things in
sight (trespass, lockpicks, bugs, hacking, tailing too close, restricted areas) raises it;
honest work, church, friends lower it. 100% = **BURNED**: the mission fails and restarts
from its checkpoint. An eye in the HUD opens when something is watching you.

### Side content (small, curated, and it pays off)
Optional, and every piece of it shows up later in the story:
- **The council's cards.** Ray hands his over when he quits (day 4), Ruth hers after the
  count (day 4). Dolly and Hank part with theirs once you're friends (level 2) or once
  you've fixed the diner sign / Hank's yard fence. Still short of three on day 5? The
  morning sends you to the nearest card holder. Friendship topics (Dolly's loan, Ray's cannery, Lyle's
  insurance, Ruth's history of the town) are the quickest way to those levels, and
  Ruth's debate prep is worth points on night four.
- **The mayor's key.** Walt hands it over if he has reason to trust you (Okafor's deal,
  standing in town, a friendly word); otherwise it's candle wax and a file.
- **Fixing the town** (**TOWN SPIRIT**): eight repairs, each with a visible result: the
  diner sign, Hank's yard fence, the school gym roof, the cannery loading door, the cabin
  roof and Koshkin's shop sign, the post office steps, the church domes. Pearl's job board
  (from day 2) and Koshkin's roof deal hand them out; materials from Hank's.
- **Work**: Koshkin's till (the story shift on day 2, then days 3–4), the cannery line
  (ask Ray), the plough route (Hank's old Ford, $300).
- **Wade's flying lessons** (from day 2, $60, three of them): each widens the finale's
  QTE window, and any lesson makes sure Wade leaves the hangar open on day 5.
- **Tommy's sled race** on Loon Lake (days 2–4).
- **Lyosha's Night School**: one lesson a night — print, conditions, loops, strings, then
  the dress rehearsal of `unwrap(shards)`. The other nine lessons unlock one by one after
  the rehearsal, as extra credit. Field hacks: faces (2), camloop (3), ledger (4),
  shares (5), final (finale). The finale is a real program written in 10 minutes.

---

## 2. Tech

- `coldboot/index.html` → `src/main.js`. Screens: `{enter, exit, update, draw, view}`
  exactly as Midnight Frequency (`go(name, params)` does the channel-change transition).
- **Renderer** (`core/renderer.js`): MF's pipeline at 16:9 — HDR target → bloom → CRT pass
  (curvature, aberration, ACES, grade, scanlines, mask, grain, vignette, letterbox).
  UI is a 1280×720 canvas composited under the glass.
- **Humans** (`src/human/`): MakeHuman hm08 base mesh (CC0) baked by
  `tools/build_humans.py` into `assets/human/*.bin`; runtime morphing (macro + face
  targets), skeleton from joint groups, skinning, facial expression morphs, procedural
  skin/eyes/hair/clothing. See `src/human/README.md`.
- **Voice** (`tools/build_voice.py`): every voiced line in `src/data/` has an id; Piper
  (+ Silero for Russian) renders `assets/vo/<id>.ogg`. The game plays it, drives lip-sync
  from its amplitude, and shows subtitles. Missing files fall back to timed subtitles.
- **Code** (`src/code/`): a Python-subset interpreter (step-limited, friendly errors),
  a canvas code editor (hidden textarea for input), lessons and challenges.
- **World** (`src/world/`): one seamless town (~2.4 × 2.4 km): terrain, sea ice, roads,
  building kit, interiors that appear as you approach, props, sky with aurora, snow.
- **Game** (`src/game/`): player controller (walk/run/crouch/drive), camera, NPC
  schedules & pathing, dialogue, missions, calendar, economy, friendship, attention,
  repairs, shop, save.

### Units & axes
Metres. Y up. The town's origin is the church square; +X east, −Z north.
