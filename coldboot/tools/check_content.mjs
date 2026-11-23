// Content checks for COLD BOOT's script modules (src/data/script/*.js):
//  • every line id used by a mission or conversation exists in some LINES
//  • every speaker has a cast entry (or is a generic voice) and a voice in tools/voices.json
//  • every mission started from content exists; DAY_START refers to real missions
//  • every conversation and mission runs against a mock game without throwing
//    (all choice branches are explored for conversations)
//  • Russian lines addressed to the player avoid gendered past-tense forms (warning)
//   node coldboot/tools/check_content.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { ALL_LINES, ALL_MISSIONS, ALL_DIALOGS } = await import(new URL('../src/data/script/index.js', import.meta.url));
const { CAST } = await import(new URL('../src/data/cast.js', import.meta.url));
const { DAY_START } = await import(new URL('../src/data/script/days.js', import.meta.url));
const { CHALLENGES } = await import(new URL('../src/code/challenges.js', import.meta.url));
const voices = JSON.parse(await readFile(root + 'tools/voices.json', 'utf8'));

const errors = [], warnings = [];
const used = new Set();

for (const [id, L] of Object.entries(ALL_LINES)) {
  if (!L.who) errors.push(`line ${id}: no speaker`);
  else if (!voices[L.who]) errors.push(`line ${id}: no voice for "${L.who}" in tools/voices.json`);
  else if (!CAST[L.who] && !/^[mf]\d$/.test(L.who) && L.who !== 'guard') warnings.push(`line ${id}: "${L.who}" has no CAST entry (no face)`);
  if (!L.en) errors.push(`line ${id}: no English text/subtitle`);
  // \b doesn't see Cyrillic letters in JS regexes: use Unicode letter lookarounds.
  // Flag "ты" followed closely by a masculine past/short form (ты был, ты сам сделал…).
  const MASC = 'был|сделал|пришёл|пришел|нашёл|нашел|сказал|видел|готов|один|должен|рад|сам|смог|понял|устал|успел|забыл|прав|уверен|занят|нужен|свободен|похож|справился|вернулся|остался|ошибся|соврал|спас|украл|взял|принёс|принес|ушёл|ушел';
  const GENDERED = new RegExp(`(?<!\\p{L})ты(?!\\p{L})(?:[\\s,]+\\p{L}+){0,2}?[\\s,]+(?:${MASC})(?!\\p{L})`, 'iu');
  if (L.ru && GENDERED.test(L.ru) && !L.ru_f) {
    warnings.push(`line ${id}: Russian may be gendered toward the player: "${L.ru}"`);
  }
}

// ---------------------------------------------------------------- mock game
function mockGame() {
  const state = {
    version: 1, name: 'Sam', day: 1, hour: 9, money: 1000, flags: {}, inv: {}, rel: {}, met: {}, attention: 0, spirit: 0, standing: 0,
    repairs: {}, missions: { active: {}, done: {} }, lessons: {}, challenges: {}, shares: {}, stats: { playSeconds: 0, repairs: 0, coffees: 0 }, objective: null,
  };
  const G = {
    state,
    hud: { toast() {}, objective: null, markers: [] },
    player: { pos: { x: 0, y: 0, z: 0 }, yaw: 0, locked: false },
    town: { points: {}, buildings: {} },
    npcs: { get: (id) => ({ id, def: {}, pos: { x: 0, z: 0 }, ch: {} }) },
    interact: { add() {}, remove() {} },
    attention: { add() {}, act() {}, zone() {}, clearZone() {} },
    director: { wait: async () => {}, say: async () => {} },
    sfx: {},
  };
  G.missions = { ear: async (l) => lineCheck(l, 'earpiece in a conversation'), start(m) { if (!ALL_MISSIONS[m]) errors.push(`starts unknown mission "${m}"`); }, emit() {}, isActive: () => true, isDone: () => false };
  return G;
}

function lineCheck(id, where, who) {
  used.add(id);
  const L = ALL_LINES[id];
  if (!L) errors.push(`${where}: unknown line "${id}"`);
  else if (who && L.who !== who && who !== 'player') errors.push(`${where}: line "${id}" belongs to ${L.who}, said by ${who}`);
}

function dialogCtx(G, npcId, path, where) {
  let pick = 0;
  const c = {
    state: G.state, G,
    get day() { return G.state.day; }, get hour() { return G.state.hour; }, get level() { return 2; }, met: false,
    flag(k, v) { if (v === undefined) return G.state.flags[k]; G.state.flags[k] = v; return v; },
    has(k) { return !!G.state.flags[k]; },
    async say(who, line) { lineCheck(line, where, who); },
    async you(t) { if (typeof t !== 'string') errors.push(`${where}: you() needs text`); },
    async choose(opts) {
      const list = opts.filter((x) => typeof x === 'string' || !x.when || x.when());
      if (!list.length) { errors.push(`${where}: choose() with no options`); return 0; }
      const i = path[pick++] ?? 0;
      const k = Math.min(i, list.length - 1);
      c._branches = Math.max(c._branches || 0, list.length);
      const p = list[k];
      return typeof p === 'string' ? opts.indexOf(p) : (p.key ?? opts.indexOf(p));
    },
    rel() {}, money(n) { G.state.money += n; }, give(item, n = 1) { G.state.inv[item] = (G.state.inv[item] || 0) + n; },
    take(item, n = 1) { if ((G.state.inv[item] || 0) < n) return false; G.state.inv[item] -= n; return true; },
    hasItem(item, n = 1) { return (G.state.inv[item] || 0) >= n; },
    start(m) { if (!ALL_MISSIONS[m]) errors.push(`${where}: starts unknown mission "${m}"`); },
    emit() {}, wait: async () => {}, attention() {}, spirit() {}, standing() {},
  };
  return c;
}

// conversations: explore choice paths (up to 3 levels × 4 options), on several days
for (const [npc, fn] of Object.entries(ALL_DIALOGS)) {
  if (!CAST[npc]) errors.push(`dialog for unknown character "${npc}"`);
  for (const day of [1, 3, 6, 9, 12, 14]) {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let d = 0; d < 3; d++) {
      const G = mockGame();
      G.state.day = day;
      if (a % 2) G.state.flags = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? true : undefined)) });
      const c = dialogCtx(G, npc, [a, b, d], `dialog ${npc} (day ${day})`);
      try { await fn(c); } catch (e) { errors.push(`dialog ${npc} (day ${day}, path ${a}${b}${d}) threw: ${e.message}`); }
    }
  }
}

// missions: run with every wait resolving immediately
for (const [id, def] of Object.entries(ALL_MISSIONS)) {
  const G = mockGame();
  const where = `mission ${id}`;
  let steps = 0;
  const m = {
    id, G, state: G.state, cancelled: false,
    cp(n, from) { if (++steps > 500) throw new Error('too many checkpoints'); return n >= from; },
    obj() {}, clear() {},
    until: async () => {}, reach: async () => {}, talk: async (npc) => { if (!CAST[npc]) errors.push(`${where}: talk to unknown "${npc}"`); },
    event: async () => {}, hour: async () => {}, wait: async () => {},
    ear: async (line) => lineCheck(line, where), ears: async (ls) => ls.forEach((l) => lineCheck(l, where)),
    spot: async () => {}, flag(k, v) { if (v === undefined) return G.state.flags[k]; G.state.flags[k] = v; return v; },
    money() {}, start(o) { if (!ALL_MISSIONS[o]) errors.push(`${where}: starts unknown mission "${o}"`); },
    minigame: async (k) => { if (!['rope', 'hammer', 'saw', 'paint', 'wire', 'lock', 'glass', 'shovel'].includes(k)) errors.push(`${where}: unknown minigame "${k}"`); return true; },
    code: async (cid) => { if (!CHALLENGES[cid]) errors.push(`${where}: unknown challenge "${cid}"`); return { pass: true }; },
    job: async (k) => { if (!['store', 'plow', 'cannery', 'radio', 'shop'].includes(k)) errors.push(`${where}: unknown job "${k}"`); return 40; },
    repair: async () => true, shop: async () => {},
    scene: async (f) => G.cutscene(f), done() {},
  };
  G.dialog = { run: async (npc, fn2) => fn2(dialogCtx(G, npc.id, [0, 0, 0], `${where} (conversation)`)), talk: async () => {} };
  G.missions = { ear: async (l) => lineCheck(l, where), start: m.start, emit() {}, isActive: () => true, isDone: () => false };
  G.fadeTeleport = async () => {}; G.reveal = async () => {}; G.sleep = async () => {}; G.coding = { challenge: async () => ({ pass: true }) };
  G.cutscene = async (f) => f({ cam() {}, wait: async () => {}, say: async (who, l) => lineCheck(l, where, who), closeUp: () => ({}), overShoulder: () => ({}), headPos: () => ({ x: 0, y: 0, z: 0 }), actors: {},
    bring: async (id) => { if (!CAST[id] && id !== 'player') errors.push(`${where}: bring unknown "${id}"`); }, choose: async () => 0, you: async () => {} });
  try { await def.run(m, 0); } catch (e) { errors.push(`${where} threw: ${e.message}\n${e.stack?.split('\n').slice(1, 3).join('\n')}`); }
  if (!def.title) warnings.push(`${where}: no title`);
}

for (const [day, d] of Object.entries(DAY_START)) {
  for (const id of [...(d.start || []), ...(d.mustFinish || [])]) if (!ALL_MISSIONS[id]) errors.push(`DAY_START[${day}] refers to unknown mission "${id}"`);
}

const unusedLines = Object.keys(ALL_LINES).filter((id) => !used.has(id) && !/^(folk\.|lesson\.|w\.|p\.|a\.)/.test(id));
if (unusedLines.length) warnings.push(`${unusedLines.length} lines never used: ${unusedLines.slice(0, 12).join(', ')}${unusedLines.length > 12 ? '…' : ''}`);

const dedupe = (list) => [...new Set(list.map((e) => e.replace(/\(day \d+, path \d+\)/, '(…)')))];
for (const w of dedupe(warnings)) console.log('warn  ', w);
for (const e of dedupe(errors)) console.log('ERROR ', e);
console.log(`\n${Object.keys(ALL_LINES).length} lines · ${Object.keys(ALL_MISSIONS).length} missions · ${Object.keys(ALL_DIALOGS).length} conversations · ${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
