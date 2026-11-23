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
payload that wakes at dawn on day 15 and shuts the grids down for good. Northstar's
founder **Cyrus Halloran** believes civilisation needs a *cold boot*. He runs it from
**the Dome**, a Cold War radar station on Kettle Hill above **Port Zarya, Alaska**
(pop. 1,140), a fishing town on the Bering Strait founded in 1822 as a Russian-American
Company post. Northstar bought the town: new smart streetlights (cameras), new broadband,
the gleaming **NORTHSTAR 24** corner store, and its politics.

The abort code, the **Root Key**, sits on an air-gapped drive in the Dome's vault.
Halloran's paranoia split access across the town's political tree: the vault opens with
the **Mayor's municipal key** plus **3 of 5 council "continuity cards"** (Shamir shares
the council members signed without knowing what they were), and only someone the
Development Board trusts gets inside the Dome — at the **Winter Gala** on day 14.

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
  Speaks old Alaskan Russian. Rents you his late brother's cabin, gives you a job, and
  when his heart gives out on day 5 he leaves you the store to run.
- **Evan Pike** — manager of NORTHSTAR 24. Perfect smile, knows your name before you say
  it. The town's eyes.
- **"Mr. Grey"** — grey parka, on your plane, everywhere after. Revealed day 10 as
  **Special Agent Daniel Okafor**, FBI Anchorage, investigating Northstar *and* you.
- **Father Gabriel Popov** — priest of Holy Transfiguration (blue onion domes). Chess, old radios.
- **Wade Tolliver** — bush pilot at the airstrip, owns the little helicopter *Dragonfly*,
  gives flying lessons (pays off in the finale).
- **Nina Kowalczyk** (17) — the chief's daughter, runs KZRY 88.9 community radio.
- **Lou Amarok** — owns the Rusty Anchor bar. Darts champion.
- **Tommy Aqpik** — Ruth's grandson, mechanic, snowmobile racer.
- **Doc Ellen Haverford** — the clinic. **Pearl Jessup** — the post office.

### Day by day
| Day | Title | Spine |
|---|---|---|
| 0 | **Тихо** (prologue) | Character creator → the warehouse table at Bely Mys (voiced, Russian) → the plane cabin (earpiece check, Mr. Grey takes your photo) → rural airstrip → town reveal → Koshkin's cabin. |
| 1 | Hello, Port Zarya | Meet Koshkin, Dolly, Hank (buy the truck), Evan greets you by name. Fix Father Gabriel's bell rope → plant the relay antenna in the bell tower. Lesson 1. |
| 2 | Work Ethic | First shift at Koshkin's. Council meeting at 7 pm: photograph the five members. Lesson 2. |
| 3 | The Fixer | Job board repairs; tail Gideon Shaw to the Dome road. Mr. Grey. Lesson 3. |
| 4 | Ears Everywhere | Bug City Hall during a cleaning job. Hear about the "continuity cards". Lesson 4. |
| 5 | Fish Fry | Church hall fish fry: council members' troubles (personal quests open). Koshkin collapses; the store is yours. Lesson 5. |
| 6 | Open for Business | Run Koshkin's against NORTHSTAR 24. Snowmobile race. Lesson 6. |
| 7 | Sunday | Liturgy and bells. A call home. Your cabin was searched — a camera in the smoke alarm. Lesson 7. |
| 8 | Counter-Surveillance | Sweep the cabin; loop the streetlight cameras with code. Mr. Grey warns you. Lesson 8. |
| 9 | The Vacant Seat | A council seat falls vacant; special election day 13. Petition, posters. Lesson 9. |
| 10 | Mr. Grey | Okafor reveals himself; interrogation; a deal. Lesson 10. |
| 11 | The Mayor's Ear | Walt's personal quest; the Gala; the municipal key. Lesson 11. |
| 12 | Debate Night | Town hall debate vs Lyle Pruitt with evidence you decoded. Lesson 12. |
| 13 | Election Day | Win the seat (or the mayor's appointment) → Gala invitation. Last shares. Lesson 13. |
| 14 | The Winter Gala | Dress up, mingle, slip away, vault (key + 3 shares), the drive. Alarm. Wade's chopper. |
| 14→15 | **Cold Boot** | Flight across the strait under fire (QTE), land at Bely Mys. The warehouse is empty — border guards took the team. Plug in the drive. **Ten minutes.** Write the code. The lights stay on. Guards burst in. |
| — | Epilogue | A jail cell, the sun going down over the strait, the team in the next cells. Credits. |

### Being watched
Northstar's attention is a meter (**ATTENTION**). Cameras (NORTHSTAR 24, City Hall, smart
streetlights), Evan, night SUV patrols, drones and Mr. Grey all *see*. Doing spy things in
sight (trespass, lockpicks, bugs, hacking, tailing too close, restricted areas) raises it;
honest work, church, friends lower it. 100% = **BURNED**: the mission fails and restarts
from its checkpoint. An eye in the HUD opens when something is watching you.

### Long game (target 10+ hours)
Fourteen days, each with a story mission plus far more than one day can hold:
- **Friendships**: every named NPC has levels 0–5, likes/dislikes, a schedule and a
  personal quest line whose end helps the main story.
- **Fixing the town** (**TOWN SPIRIT**): ~24 restoration projects (church dome gilding,
  houses, the dock, streetlights, the school, the radio transmitter…) with materials from
  Hank's and repair minigames. Buildings visibly change. Spirit and standing gate the
  political climb.
- **Work**: shifts at Koshkin's (till, stocking), snowplow route, cannery line, KZRY radio;
  from day 5 you run Koshkin's: stock, prices, customers, NORTHSTAR undercutting you.
- **Lyosha's Night School**: 14 Python lessons on the cabin laptop + field hacks. The
  finale is a real program written in 10 minutes.
- Fishing, darts, chess, snowmobile races, flight lessons, banya, cooking, 40 hidden
  matryoshkas, Nadia's dead drops.

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
