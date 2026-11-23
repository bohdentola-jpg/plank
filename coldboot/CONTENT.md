# Writing content for COLD BOOT

Read `DESIGN.md` first (story bible, cast, the day-by-day spine). Then read
`src/data/script/day01.js` — it is the reference example for everything below.

## Where content lives

`src/data/script/*.js` — each module exports:

| export | what |
|---|---|
| `LINES` | voiced lines: `id → { who, ru?, en, emo? }` |
| `MISSIONS` | `id → { title, main?, day?, run: async (m, from) => {…}, onDone?(G) }` |
| `DIALOG` | `npcId → async (c, prev) => {…}` conversations |
| `DIALOG_OVERRIDE = true` | your DIALOG wraps earlier modules': call `return prev(c)` when your content doesn't apply |
| `DAY` | (day modules only) `{ n, start: [mission ids started that morning], mustFinish: [missions that must be done before sleeping] }` |

Modules are already registered in `src/data/script/index.js` (day02 … day14,
side_friends, side_jobs, side_town). **Only edit your own files.** Order of
composition: day01 → side_jobs → side_town → side_friends → day02 → … → day14.

## Lines

- `who`: a cast id from `src/data/cast.js` (dmitri nadia lyosha grisha valya
  ivan pilot okafor wade koshkin dolly hank ruth ray lyle marta gideon walt
  halloran evan gabriel nina lou tommy ellen pearl) or a generic townsperson
  voice `m1`–`m6`, `f1`–`f6`.
- The Russian team (Nadia, Lyosha, Grisha, Dmitri, Valya, Ivan) speaks
  **Russian** (`ru`, spoken) with an English subtitle (`en`). Everyone in Port
  Zarya speaks **English** (`en` only). Koshkin may drop a Russian word.
- **The player is a silent protagonist of either gender.** Russian lines
  addressed to the player must avoid gendered forms: no past tense of verbs
  with ты as subject (не «ты сделал/сделала» — use present/future, imperative,
  impersonal or noun phrases: «Отличная работа», «Получилось!», «Ты на месте?»),
  no gendered short adjectives («готов/готова», «рад/рада») for the player.
  If unavoidable, add `ru_f` with the feminine version. The team calls the
  player «Рыбка» (Rybka, "little fish"); townsfolk never say the player's name
  aloud (they say "friend", "kid", "neighbour", "carpenter"…).
- Lines are rendered by neural TTS: write speakable text. Spell out numbers
  ("a hundred and fifty dollars", «четырнадцать»), no emoji, no stage
  directions inside lines, no ALL CAPS, short-to-medium sentences (≤ 35 words).
- Keep ids namespaced by file: `d2.n.morning`, `d2.k.shift1`, `sf.ruth.q1a`…
- `emo`: smile | laugh | serious | frown | worry | surprise | angry.

## Missions (`m` API)

```js
'd2.shift': { title: 'Work Ethic', main: true, day: 2, async run(m, from) {
  if (m.cp(1, from)) { m.obj('Open the store with Koshkin', 'koshkin', 'Before 9:00'); await m.talk('koshkin'); }
  if (m.cp(2, from)) { const earned = await m.job('store', { hours: 3 }); m.money(earned, 'wages'); }
  m.done(); m.start('d2.council');
} }
```

- `m.cp(n, from)` — checkpoint n; returns false when resuming past it. Wrap every step.
- `m.obj(text, where?, sub?)` / `m.clear()` — HUD objective + radar marker.
- `await m.reach(where, radius=4)` — wait until the player is within radius.
- `await m.talk(npcId)` — wait until the npc's conversation calls `c.emit('talk:<id>')`.
  **Your DIALOG for that npc must emit it** when the relevant conversation happens.
- `await m.event('name')` / `G.missions.emit('name')` — custom events.
- `await m.until(() => bool)` — poll a condition. `await m.hour(19)` — wait for the clock.
- `await m.wait(sec)`
- `await m.ear('line.id')` / `m.ears([...])` — earpiece lines (queued, radio-filtered).
- `await m.spot(spotId, where, 'Prompt text', r)` — a temporary interaction point; resolves when used.
- `await m.minigame(kind, { title })` → bool. kinds: `rope hammer saw paint wire lock glass shovel`.
- `await m.code(challengeId)` → `{pass}` — a field hack on the phone/laptop.
  ids (see `src/code/challenges.js`): `faces keypad camloop petition ledger shares vault final`.
- `await m.job(kind, opts)` → dollars earned. kinds: `store` (till + stocking at
  Koshkin's), `plow` (snowplough route), `cannery` (fish line), `radio` (KZRY DJ shift), `shop` (running Koshkin's yourself, day 5+).
- `await m.repair(projectId)` → bool. A repair project (see `side_town.js`
  `REPAIRS`): checks materials in inventory, runs its minigames, restores the
  building visually, adds Town Spirit.
- `await m.shop('hardware' | 'koshkin' | 'northstar' | 'diner')` — open a store's buy menu.
- `await m.scene(async (d) => {…})` — a cutscene. `d` is the Director:
  `await d.bring(npcId, where, { sit, face })` puts a character on stage,
  `await d.say(who, lineId, { cam: d.closeUp(who) })`, `d.cam({pos, look, fov, dur})`,
  `d.closeUp(id, {side, dist})`, `d.overShoulder(a, b)`, `await d.choose([...])`, `await d.wait(s)`.
  `'player'` is always an actor.
- `m.flag(k, v)`, `m.money(n, why)`, `m.start(otherMission)`, `m.done()`.
- `m.G` — the live game: `G.state` (save data), `G.attention.act(strength, secs)`
  (doing something suspicious now), `G.attention.zone(id, x, z, r, rate)` /
  `clearZone(id)` (restricted area), `G.attention.add(n)`, `G.hud.toast(title, body)`,
  `G.npcs.get(id)` (`.scripted = true` + `.goal = {x, z, activity}` to move someone),
  `G.fadeTeleport({x, z, yaw})`, `G.sleep()`.

### Places (`where`)
A building id from `src/world/townplan.js` (church koshkin northstar hall
cityhall police post clinic school radio diner bar hardware fueltanks cannery
harbor cabin terminal hangar dome lighthouse cemetery, house0 … house39), an
NPC id (their current position), a building point `'building.point'` (e.g.
`koshkin.counter`, `cabin.laptop`, `cityhall.mayor` — if a point doesn't exist
the building's front is used), or `{ x, z }` in metres (+x east, −z north;
Church Square is the origin).

## Conversations (`c` API)

```js
koshkin: async (c, prev) => {
  if (c.day !== 2 || c.flag('d2.k.done')) return prev(c);
  await c.say('koshkin', 'd2.k.morning');
  const k = await c.choose(['Where do you want me?', { label: 'About the roof…', when: () => c.flag('fixKoshkinRoof'), key: 'roof' }]);
  if (k === 'roof') { … }
  c.flag('d2.k.done', true);
  c.emit('talk:koshkin');
}
```

`c.say(who, id)`, `c.you('text')` (the player's unvoiced reply, shown as a
subtitle), `c.choose([...])` (strings or `{label, when, key}`; returns the
index, or the `key`), `c.flag(k, v)`, `c.has(k)`, `c.day`, `c.hour`,
`c.level` (friendship 0–5 with this npc), `c.state`, `c.rel(n)` (friendship
points, 20 per level), `c.money(n, why)`, `c.give(item, n)`, `c.take(item)`,
`c.hasItem(item)`, `c.start(mission)`, `c.emit(evt)`, `c.attention(n)`,
`c.spirit(n)` (Town Spirit), `c.standing(n)` (political standing), `c.wait(s)`.

Every named character should always have *something* to say (fall back to a
short line about the day), and react to what the player has done (flags).

## Validation

```
node coldboot/tools/check_content.mjs
```
must report **0 errors**. It checks line ids, speakers and voices, explores
every conversation branch on several days, runs every mission against a mock
game, and warns about gendered Russian. Fix all warnings about gender.

Do not run git. Do not edit files you don't own. Do not generate audio (the
voice build runs later over everything).
