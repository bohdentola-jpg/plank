// Side content — fixing up Port Zarya (TOWN SPIRIT).
//
//   REPAIRS     every restoration project. Pearl's job board, the friendship
//               quests and the story all call m.repair(id): game/economy.js
//               checks `materials` (Hank's sells them), runs `minigames`, pays
//               `pay`, adds `spirit` and restores `building` visually.
//               unlock: { day?, flag? } — when it can be offered. board: false —
//               never pinned on Pearl's board (a quest hands it out).
//   'jobs.board'  Pearl's board at the post office: three cards, pick one, it
//               becomes the objective, fix it, get paid. Repeatable.
//   REACTIONS   what people say (once) after their thing is fixed — played by
//               the friendship hub in side_friends.js via reactTo(c, npc).
//   SIDE        small helpers shared by side_jobs.js and side_friends.js.
import { CAST } from '../cast.js';

// ------------------------------------------------------------------ the projects
export const REPAIRS = {
  // ---- Holy Transfiguration and the old graves
  'r.church.domes': {
    name: 'Gild the dome stars', building: 'church', where: 'church.domeTop', hint: 'Holy Transfiguration, Church Square',
    materials: { paint: 2, rope: 2 }, minigames: ['rope', 'paint', 'paint'], pay: 0, spirit: 15, unlock: { day: 3 }, owner: 'gabriel',
    desc: 'The gold stars on the blue onion domes have flaked to grey. Father Gabriel has the gold paint, but not the head for heights.',
  },
  'r.church.cross': {
    name: 'Straighten the tower cross', building: 'church', where: 'church.belfry', hint: 'Top of the bell tower',
    materials: { pipe: 2, wire: 2, rope: 1 }, minigames: ['rope', 'hammer'], pay: 0, spirit: 10, owner: 'gabriel',
    desc: 'The three-bar cross on the bell tower has leaned like a tired man since the October storm. The whole town sees it every morning.',
  },
  'r.church.stairs': {
    name: 'Bell tower stairs', building: 'church', where: 'church.ladderBottom', hint: 'Inside the church, under the tower',
    materials: { lumber: 4, nails: 2 }, minigames: ['saw', 'hammer'], pay: 30, spirit: 8, owner: 'gabriel',
    desc: 'Three treads on the bell tower stairs are rotten through. Father Gabriel climbs them anyway, praying all the way up.',
  },
  'r.cemetery.fence': {
    name: 'Cemetery fence', building: 'cemetery', where: 'cemetery', hint: 'The cemetery, south end of Main St',
    materials: { lumber: 4, nails: 2, paint: 1 }, minigames: ['saw', 'hammer', 'paint'], pay: 0, spirit: 10, owner: 'gabriel',
    desc: 'The white picket fence around the old Russian graves lies flat under the snow. Some of those crosses say 1840.',
  },
  'r.house.rectory': {
    name: 'The rectory stovepipe', building: 'house34', where: 'house34.door', hint: "Father Gabriel's house, by the cemetery",
    materials: { pipe: 2, wire: 1 }, minigames: ['hammer', 'wire'], pay: 0, spirit: 6, owner: 'gabriel',
    desc: "Father Gabriel's stovepipe rattles loose in every wind and smokes out the rectory. He says it keeps him humble.",
  },

  // ---- Koshkin's
  'r.koshkin.roof': {
    name: 'The cabin roof', building: 'cabin', where: 'cabin.porch', hint: 'Your cabin on Shore Road (Koshkin\'s deal)',
    materials: { shingles: 3, lumber: 1, nails: 1 }, minigames: ['saw', 'hammer'], pay: 0, spirit: 4, unlock: { flag: 'hasCabin' }, owner: 'koshkin',
    desc: "Yuri's old cabin, your cabin, leaks on the north side. Koshkin pinned the card himself: 'Fix the roof, carpenter.' He could have just said it.",
  },
  'r.koshkin.sign': {
    name: "Repaint Koshkin's sign", building: 'koshkin', where: 'koshkin.sign', hint: 'Church Square',
    materials: { paint: 2, nails: 1 }, minigames: ['hammer', 'paint'], pay: 70, spirit: 8, owner: 'koshkin',
    desc: "KOSHKIN'S GENERAL MDSE., est. 1911. His grandfather painted the gold letters. Half are gone, and Northstar's sign glows all night across the square.",
  },
  'r.koshkin.porch': {
    name: "Koshkin's porch boards", building: 'koshkin', where: 'koshkin.porch', hint: 'Church Square',
    materials: { lumber: 3, nails: 1 }, minigames: ['saw', 'hammer'], pay: 70, spirit: 5, owner: 'koshkin',
    desc: 'The porch of the general store bounces when you walk on it. Mrs. Ivanoff says it is like a trampoline. She is ninety.',
  },

  // ---- Front Street and the waterfront
  'r.dolly.sign': {
    name: 'The Midnight Sun sign', building: 'diner', where: 'diner', hint: 'Midnight Sun Diner, Front St',
    materials: { wire: 3, glass: 1 }, minigames: ['wire', 'glass'], pay: 90, spirit: 10, owner: 'dolly',
    desc: "Half the neon is dead. At night it reads MIDN  HT SUN D NER, which Dolly says is 'just rude'.",
  },
  'r.dolly.window': {
    name: "The diner's front window", building: 'diner', where: 'diner', hint: 'Midnight Sun Diner, Front St',
    materials: { glass: 2, nails: 1 }, minigames: ['glass', 'glass'], pay: 100, spirit: 6, unlock: { day: 3 }, owner: 'dolly',
    desc: "A plough threw a block of ice through the diner's big window in October. It has been plywood and duct tape since.",
  },
  'r.anchor.sign': {
    name: "The Rusty Anchor's sign", building: 'bar', where: 'bar', hint: 'The Rusty Anchor, Front St',
    materials: { rope: 1, nails: 1, paint: 1 }, minigames: ['rope', 'paint'], pay: 60, spirit: 5, owner: 'lou',
    desc: "The bar's sign hangs by one chain and bangs on the wall all night. Lou says it is the only thing in there that's truly rusty.",
  },
  'r.hank.fence': {
    name: "Hank's yard fence", building: 'hardware', where: 'hardware', hint: 'Brubaker Hardware & Fuel',
    materials: { lumber: 5, nails: 2 }, minigames: ['saw', 'hammer'], pay: 110, spirit: 5, owner: 'hank',
    desc: 'Somebody backed a fuel truck through Hank\'s yard fence. Hank says he knows who. Hank says it was Northstar. Hank says a lot of things.',
  },
  'r.harbor.boardwalk': {
    name: 'Harbour boardwalk', building: 'harbor', where: 'harbor', hint: 'Small Boat Harbor',
    materials: { lumber: 6, nails: 2 }, minigames: ['saw', 'hammer', 'hammer'], pay: 60, spirit: 12,
    desc: 'Rotten planks along the harbour boardwalk. Two fishermen and a dog went through this year. The dog was fine.',
  },
  'r.cannery.door': {
    name: 'Cannery loading door', building: 'cannery', where: 'cannery', hint: 'Zarya Seafoods, Cannery Rd',
    materials: { pipe: 2, lumber: 1, nails: 1 }, minigames: ['hammer', 'hammer'], pay: 90, spirit: 6, unlock: { day: 3 }, owner: 'ray',
    desc: 'The big sliding door at Zarya Seafoods jumped its track. The line freezes every time a forklift goes through.',
  },

  // ---- Main St, Third Ave, the school
  'r.post.steps': {
    name: 'Post office steps', building: 'post', where: 'post.door', hint: 'U.S. Post Office, Third Ave',
    materials: { lumber: 4, nails: 1 }, minigames: ['saw', 'hammer'], pay: 90, spirit: 8, owner: 'pearl',
    desc: 'The post office steps are split and iced. The mail carrier went down them on his back on Monday. Pearl has opinions.',
  },
  'r.post.sign': {
    name: 'Post office sign', building: 'post', where: 'post.flag', hint: 'U.S. Post Office, Third Ave',
    materials: { paint: 1, nails: 1 }, minigames: ['hammer', 'paint'], pay: 45, spirit: 5, owner: 'pearl',
    desc: 'The sign reads U.S. POST OFF CE. Pearl wants her I back.',
  },
  'r.third.lights': {
    // not a building: 'third' is the street id (roads), so the rebuild is a no-op
    name: 'Streetlights on Third Ave', building: 'third', where: 'post', hint: 'Third Ave, by the post office',
    materials: { wire: 4, glass: 2 }, minigames: ['wire', 'glass'], pay: 0, spirit: 12,
    desc: 'The old sodium lamps on Third go dark every time it blows. Northstar offered to replace them with smart lights. Free. With cameras.',
  },
  'r.school.gym': {
    name: 'School gym roof', building: 'school', where: 'school.gymDoor', hint: 'Port Zarya School',
    materials: { shingles: 6, lumber: 2, nails: 2 }, minigames: ['saw', 'hammer', 'hammer'], pay: 180, spirit: 15, unlock: { day: 3 },
    desc: 'The gym roof leaks like a sieve. There are eleven buckets on the basketball court. The children have named them.',
  },
  'r.school.playground': {
    name: 'The school playground', building: 'school', where: 'school.playground', hint: 'Port Zarya School',
    materials: { rope: 2, pipe: 2, paint: 1 }, minigames: ['rope', 'hammer', 'paint'], pay: 0, spirit: 12,
    desc: 'Two swings with no chains and a slide with a hole in it. Ruth Aqpik has asked the city for a new one every year since 2009.',
  },
  'r.school.shelter': {
    name: 'School bus shelter', building: 'school', where: 'school.flag', hint: 'Main St, by the school',
    materials: { lumber: 3, shingles: 2, nails: 1 }, minigames: ['saw', 'hammer'], pay: 0, spirit: 8,
    desc: 'The bus shelter lost its roof in a storm. The children wait for the bus in the dark at minus thirty.',
  },
  'r.hall.heater': {
    name: 'Parish Hall heater', building: 'hall', where: 'hall.kitchen', hint: 'Parish Hall, Church Square',
    materials: { pipe: 2, wire: 2 }, minigames: ['wire', 'hammer'], pay: 0, spirit: 10,
    desc: 'The oil heater in the Parish Hall coughs, bangs and quits. The fish fry is Friday. Nobody wants to eat halibut in mittens.',
  },
  'r.kzry.mast': {
    name: 'KZRY transmitter mast', building: 'radio', where: 'radio.mastBase', hint: 'KZRY 88.9, west of the square',
    materials: { wire: 4, rope: 2, pipe: 1 }, minigames: ['rope', 'wire', 'wire'], pay: 0, spirit: 15, unlock: { day: 3 }, owner: 'nina',
    desc: 'Slack guy wires, a corroded feed line. KZRY reaches the harbour on a good day. Nina wants it to reach Nome.',
  },
  'r.kzry.door': {
    name: 'Radio station door', building: 'radio', where: 'radio.door', hint: 'KZRY 88.9',
    materials: { lumber: 2, nails: 1, paint: 1 }, minigames: ['saw', 'hammer'], pay: 60, spirit: 4, owner: 'nina',
    desc: "The station door is warped and won't latch. Every time somebody walks in, the wind blows the playlist off the desk.",
  },
  'r.clinic.ramp': {
    name: 'Clinic ramp', building: 'clinic', where: 'clinic.door', hint: 'Port Zarya Clinic',
    materials: { lumber: 4, pipe: 2, nails: 1 }, minigames: ['saw', 'hammer'], pay: 80, spirit: 10, owner: 'ellen',
    desc: 'The wheelchair ramp at the clinic is cracked and the railing wobbles. Doc Haverford salts it herself every morning at seven.',
  },

  // ---- out of town
  'r.lighthouse.lamp': {
    name: 'The lighthouse lamp', building: 'lighthouse', where: 'lighthouse', hint: 'Zarya Point, end of Shore Rd',
    materials: { glass: 2, wire: 3 }, minigames: ['wire', 'glass'], pay: 0, spirit: 15, unlock: { day: 5 },
    desc: 'Zarya Point light has been dark since the Coast Guard automated it and forgot it. Old fishermen still look for it on the way home.',
  },
  'r.house.dogyard': {
    name: "Joe Okpealuk's dog yard", building: 'house37', where: 'house37.yard', hint: 'East end of town',
    materials: { lumber: 4, shingles: 2, nails: 2 }, minigames: ['saw', 'hammer'], pay: 40, spirit: 8,
    desc: 'Twenty-two huskies, nine doghouses, no roofs. Old Joe ran the Iditarod twice. His back will not let him climb any more.',
  },

  // ---- houses
  'r.house.ivanoff': {
    name: "Mrs. Ivanoff's porch steps", building: 'house0', where: 'house0.door', hint: '2nd Ave, west',
    materials: { lumber: 3, nails: 1 }, minigames: ['saw', 'hammer'], pay: 30, spirit: 6,
    desc: 'Agnes Ivanoff is ninety and still shovels her own steps. The steps are losing.',
  },
  'r.house.ruth': {
    name: "Ruth Aqpik's storm windows", building: 'house1', where: 'house1.door', hint: '2nd Ave, west',
    materials: { glass: 2, nails: 1 }, minigames: ['glass', 'hammer'], pay: 0, spirit: 6, owner: 'ruth',
    desc: "Ruth's storm windows rattle like a drum kit. She says she likes the company. Tommy says she sleeps in her coat.",
  },
  'r.house.kaplan': {
    name: "Old Kaplan's siding", building: 'house2', where: 'house2.door', hint: '2nd Ave, west',
    materials: { paint: 3 }, minigames: ['paint', 'paint'], pay: 90, spirit: 6,
    desc: "Old Mr. Kaplan's house was blue in 1970. It is now the colour of weather.",
  },
  'r.house.ray': {
    name: "Ray Moody's porch roof", building: 'house3', where: 'house3.door', hint: '2nd Ave, west end',
    materials: { lumber: 2, shingles: 2, nails: 1 }, minigames: ['saw', 'hammer'], pay: 0, spirit: 6, owner: 'ray',
    desc: "Ray's porch roof sags in the middle like a hammock. He hasn't touched it since his wife moved to Fairbanks.",
  },
  'r.house.nanouk': {
    name: "The Nanouk kids' window", building: 'house5', where: 'house5.door', hint: '2nd Ave',
    materials: { glass: 1, nails: 1 }, minigames: ['glass'], pay: 0, spirit: 8,
    desc: 'Three kids and a bedroom window covered in plastic sheeting. Jimmy Nanouk was laid off from the cannery in September.',
  },
  'r.house.petrov': {
    name: "The Petrov sisters' house", building: 'house7', where: 'house7.door', hint: 'East of the square',
    materials: { paint: 3 }, minigames: ['paint', 'paint'], pay: 90, spirit: 6,
    desc: 'Vera and Lida Petrov want their house painted pink. Flamingo pink. They have been very clear about this.',
  },
  'r.house.delgado': {
    name: 'The Delgado roof', building: 'house13', where: 'house13.door', hint: '2nd Ave, east',
    materials: { shingles: 4, nails: 2 }, minigames: ['hammer', 'hammer'], pay: 100, spirit: 6,
    desc: 'The Delgados work the cannery line. Their roof lost a row of shingles in the storm, and their landlord lives in Seattle.',
  },
  'r.house.pearl': {
    name: "Pearl's porch light and mailbox", building: 'house15', where: 'house15.door', hint: 'North of Third Ave',
    materials: { wire: 1, nails: 1, paint: 1 }, minigames: ['wire', 'hammer'], pay: 50, spirit: 4, owner: 'pearl',
    desc: "The postmaster's own mailbox fell off its post. Pearl says nobody is to make a joke about it.",
  },
  'r.house.ellen': {
    name: "Doc Ellen's bird blind", building: 'house19', where: 'house19.yard', hint: 'South of Third Ave',
    materials: { lumber: 3, nails: 1 }, minigames: ['saw', 'hammer'], pay: 60, spirit: 4, owner: 'ellen',
    desc: "Doc Haverford's back-deck bird blind blew down. She says the ravens are laughing at her. She is probably right.",
  },
  'r.house.marta': {
    name: 'The Kowalczyk porch railing', building: 'house24', where: 'house24.door', hint: 'Third Ave, by the police station',
    materials: { lumber: 2, nails: 1, paint: 1 }, minigames: ['saw', 'hammer'], pay: 70, spirit: 5, owner: 'marta',
    desc: "The police chief's porch railing is held together with crime-scene tape. Nina did that. Nina thinks it is funny.",
  },
  'r.house.sorensen': {
    name: 'The Sorensen pipes', building: 'house38', where: 'house38.door', hint: 'West end of town',
    materials: { pipe: 3 }, minigames: ['hammer', 'wire'], pay: 70, spirit: 5,
    desc: 'A pipe froze and burst under the Sorensen place. They have been melting snow on the stove for a week.',
  },
  'r.house.shore': {
    name: 'Foundation on Shore Road', building: 'house29', where: 'house29.door', hint: 'Shore Rd, past your cabin',
    materials: { lumber: 4, pipe: 2 }, minigames: ['shovel', 'hammer'], pay: 0, spirit: 8, unlock: { day: 4 },
    desc: "The Okpik house on Shore Road is cracking down the middle. The ground under it is going soft. Someone sold them that lot.",
  },
  'r.house.dolly': {
    name: "Earl's workshop door", building: 'house32', where: 'house32.door', hint: 'Behind the Midnight Sun Diner',
    materials: { lumber: 2, nails: 1, pipe: 1 }, minigames: ['saw', 'hammer'], pay: 0, spirit: 4, unlock: { flag: 'sf.dolly.shed' }, board: false, owner: 'dolly',
    desc: "Earl Finch's workshop behind the diner. Dolly hasn't opened it in four years. The door has frozen into its frame.",
  },
};

// ------------------------------------------------------------------ helpers (shared)
const SIDE_RE = /^(sf|job|jobs)\./;
const REL_NAMES = ['Stranger', 'Acquaintance', 'Friendly', 'Friend', 'Close friend', 'Family'];
const MAT = { lumber: 'lumber', nails: 'nails', paint: 'paint', glass: 'glass', wire: 'wire', shingles: 'shingles', rope: 'rope', pipe: 'pipe' };

export const SIDE = {
  level(s, id) { return Math.min(5, Math.floor(((s.rel || {})[id] || 0) / 20)); },
  rel(G, id, n) {
    const s = G.state;
    s.rel ||= {};
    const before = SIDE.level(s, id);
    s.rel[id] = Math.max(0, Math.min(100, (s.rel[id] || 0) + n));
    const after = SIDE.level(s, id);
    if (after > before) G.hud?.toast?.('FRIENDSHIP', `${CAST[id]?.short || id}: ${REL_NAMES[after]}`, '#9fe8b0');
  },
  spirit(G, n) { G.state.spirit = (G.state.spirit || 0) + n; G.hud?.toast?.('TOWN SPIRIT', `+${n}`, '#ffd166'); },
  standing(G, n) { G.state.standing = (G.state.standing || 0) + n; G.hud?.toast?.('STANDING', `${n >= 0 ? '+' : '−'}${Math.abs(n)}`, '#b98cff'); },
  /** Honest work and kindness make Northstar look away a little. */
  calm(G, n) { G.attention?.add?.(-n); },
  has(G, item, n = 1) { return ((G.state.inv || {})[item] || 0) >= n; },
  give(G, item, n = 1) { const inv = G.state.inv; inv[item] = (inv[item] || 0) + n; G.hud?.toast?.('ITEM', `${item.replace(/_/g, ' ')}${n > 1 ? ' ×' + n : ''}`); },
  take(G, item, n = 1) { const inv = G.state.inv; if ((inv[item] || 0) < n) return false; inv[item] -= n; return true; },
  /** First time only: returns true once per key (save-persistent). */
  once(G, key) { if (G.state.flags[key] === true) return false; G.state.flags[key] = true; return true; },
  /** A mission's onDone that lets it be started again (repeatable jobs). */
  again(id) { return (G) => { delete G.state.missions.done[id]; }; },

  /** A safe place: a point that exists, an npc, else the building it belongs to. */
  at(G, w) {
    if (!w || typeof w !== 'string') return w;
    const T = G.town;
    if (!T || !T.points) return w;
    if (T.points[w] || T.buildings?.[w]) return w;
    const npc = G.npcs?.get?.(w);
    if (npc && !npc.def?.folk) return w;
    const b = w.split('.')[0];
    return T.buildings?.[b] ? b : w;
  },
  /** A stage mark for d.bring: the named point if the building has it, else beside the player. */
  mark(G, name, dx = 1.6, dz = 1.2) {
    if (G.town?.points?.[name]) return name;
    const p = G.player?.pos || { x: 0, z: 0 };
    return { x: p.x + dx, z: p.z + dz };
  },

  /**
   * Side objectives are polite: they show at once when the HUD is free or holds
   * another side task, never push a story objective off it, and come back by
   * themselves whenever the story leaves the HUD empty.
   */
  obj(m, text, where, sub) {
    const G = m.G;
    const spec = { text, where: SIDE.at(G, where), sub };
    m._side = spec;
    G.hud?.toast?.('SIDE TASK', text, '#7fe6ff');
    const put = () => m.obj(spec.text, spec.where, spec.sub);
    const o = G.hud?.objective;
    if (!o || o.mission === m.id || SIDE_RE.test(o.mission || '') || !G.missions?.isActive?.(o.mission)) put();
    const w = m.until(() => {
      if (m._side !== spec) return true;
      const cur = G.hud?.objective;
      if (cur && cur === m._obj) return false;
      if (!cur || !G.missions?.isActive?.(cur.mission)) put();
      return false;
    });
    w?.catch?.(() => {});
  },
  clear(m) { const G = m.G; m._side = null; if (G.hud?.objective && G.hud.objective === m._obj) m.clear(); },
  finish(m) { m._side = null; m.done(); },
  /** A quiet wait (no objective) until test() — then the objective appears. */
  async gate(m, test, text, where, sub) {
    if (!test()) { SIDE.clear(m); await m.until(test); }
    SIDE.obj(m, text, where, sub);
  },
  /** A line from someone standing next to you (a short conversation), or over the phone. */
  async say(m, who, line, o = {}) {
    const G = m.G, P = G.player?.pos, npc = G.npcs?.get?.(who);
    const near = npc && npc.ch && !npc.hidden && P && Math.hypot(npc.pos.x - P.x, npc.pos.z - P.z) < (o.near || 9);
    if (!o.phone && near && G.dialog?.run && !G.dialog.active) return G.dialog.run(npc, async (c) => { await c.say(who, line); });
    if (o.phone) return m.ear(line);
    return undefined;
  },
};

// ------------------------------------------------------------------ materials & the board
export function hasMaterials(s, R) { return Object.entries(R.materials || {}).every(([k, n]) => ((s.inv || {})[k] || 0) >= n); }
export function materialsText(R, s) {
  return Object.entries(R.materials || {})
    .map(([k, n]) => [k, s ? n - Math.min(n, (s.inv || {})[k] || 0) : n])
    .filter(([, n]) => n > 0).map(([k, n]) => `${MAT[k] || k} ×${n}`).join(', ');
}
export function repairUnlocked(s, id) {
  const u = REPAIRS[id]?.unlock;
  if (!u) return true;
  if (u.day && (s.day || 1) < u.day) return false;
  if (u.flag && !(s.flags || {})[u.flag]) return false;
  return true;
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const STARTERS = ['r.post.steps', 'r.dolly.sign', 'r.post.sign'];
/** The three cards on Pearl's board today (stable through the day). */
export function boardOffer(s) {
  const avail = Object.keys(REPAIRS).filter((id) => !(s.repairs || {})[id] && REPAIRS[id].board !== false && repairUnlocked(s, id));
  const first = STARTERS.filter((id) => avail.includes(id));
  const seed = `${s.day || 1}:${Number((s.flags || {})['board.count']) || 0}`;
  const rest = avail.filter((id) => !first.includes(id)).sort((a, b) => hash(a + seed) - hash(b + seed));
  return [...first, ...rest].slice(0, 3);
}

/**
 * The work itself, for the board and for quests: buy the materials at Hank's,
 * go to the place, fix it (m.repair pays and adds Town Spirit). Uses
 * checkpoints base+1 and base+2. Resolves true when the thing is fixed, false
 * if quit() turned true first.
 */
export async function workOrder(m, id, base, from, quit = () => false) {
  const G = m.G, s = G.state, R = REPAIRS[id];
  if (!R) return false;
  let f = from;
  for (let tries = 0; tries < 30; tries++) {
    if (s.repairs[id]) return true;
    if (quit()) return false;
    if (m.cp(base + 1, f) && !hasMaterials(s, R)) {
      SIDE.obj(m, `Materials: ${R.name}`, 'hardware', `Brubaker Hardware: ${materialsText(R, s)}`);
      await m.until(() => hasMaterials(s, R) || s.repairs[id] || quit());
      if (quit()) return false;
      if (s.repairs[id]) return true;
    }
    if (m.cp(base + 2, f)) {
      SIDE.obj(m, R.name, R.where, R.hint);
      await Promise.race([m.spot('fix', SIDE.at(G, R.where), `Fix: ${R.name}`, 3.2), m.until(() => s.repairs[id] || quit())]);
      G.interact?.remove?.(`${m.id}:fix`);
      if (quit()) return false;
      if (s.repairs[id]) return true;
      if (await m.repair(id)) { s.repairs[id] ||= true; return true; }
    }
    f = 0;
  }
  return !!s.repairs[id];
}

// ------------------------------------------------------------------ lines
export const LINES = {
  // ---- Pearl's board
  'st.pearl.first': { who: 'pearl', en: "So you're the carpenter. Everybody in Port Zarya who needs something fixed pins a card on my board. I'd say take your pick. Honestly? Take them all." },
  'st.pearl.board': { who: 'pearl', en: "Let's see what this town needs fixed this week. Pick one, and finish it. The last handyman took six and finished none." },
  'st.pearl.taken': { who: 'pearl', en: "Good. I'll write your name on the card. People will know who to thank. Or who to blame." },
  'st.pearl.notoday': { who: 'pearl', en: "Suit yourself. The board isn't going anywhere. Neither are the leaks." },
  'st.pearl.busy': { who: 'pearl', en: "You've already got a card from my board. Finish that one first. One thing at a time, carpenter." },
  'st.pearl.drop': { who: 'pearl', en: "Fine, I'll pin it back up. Nobody's keeping score. Except me. I keep score." },
  'st.pearl.empty': { who: 'pearl', en: "The board's empty. Empty! First time since nineteen ninety-eight. Go home and put your feet up." },
  // ---- the team
  'st.n.board': { who: 'nadia', ru: 'Доска объявлений — это хорошо. Чем больше чинишь, тем больше тебе доверяют. А кто доверяет — тот и рассказывает.', en: 'A job board — good. The more you fix, the more they trust you. And people who trust you, talk.' },
  'st.n.spirit': { who: 'nadia', ru: 'Видишь? Город меняется. И люди это замечают.', en: 'See? The town is changing. And people notice.', emo: 'smile' },
  'st.d.spirit': { who: 'dmitri', ru: 'Пять починок. Знаешь, в чём сила хорошей работы? Её не замечают, пока всё стоит. А всё стоит — благодаря ей.', en: 'Five repairs. You know the strength of good work? Nobody notices it while everything stands. And everything stands because of it.' },

  // ---- reactions: the town talks about what you fixed
  'st.rx.dolly.sign': { who: 'dolly', en: "Honey, did you see my sign? You can see it from the harbour! I stood outside for twenty minutes last night, just looking at it like a fool.", emo: 'laugh' },
  'st.rx.dolly.window': { who: 'dolly', en: "I can see the street again! I'd forgotten how much gossip you miss behind a sheet of plywood.", emo: 'smile' },
  'st.rx.dolly.heater': { who: 'dolly', en: "The parish hall is warm! Last year I fried two hundred pieces of halibut in there wearing mittens.", emo: 'smile' },
  'st.rx.dolly.nanouk': { who: 'dolly', en: "The Nanouk kids have a real window again. Sarah sat in my booth and cried for an hour. Happy crying. I gave her pie." },
  'st.rx.pearl.steps': { who: 'pearl', en: "Not one person has fallen down my steps since you fixed them. The mail carrier sends his regards. So does his tailbone.", emo: 'smile' },
  'st.rx.pearl.sign': { who: 'pearl', en: "I've got my I back. Post office, fully spelled, the way the federal government intended. Thank you." },
  'st.rx.pearl.house': { who: 'pearl', en: "My mailbox is back on its post. I did see you smirking. I'll allow it." },
  'st.rx.pearl.ivanoff': { who: 'pearl', en: "Agnes Ivanoff came in to mail you a thank-you card. Through the post. You live four streets away. She insisted.", emo: 'laugh' },
  'st.rx.pearl.petrov': { who: 'pearl', en: "The Petrov sisters' house is pink. Very pink. Visible from space. They're speaking to each other again. Mostly about the pink." },
  'st.rx.gabriel.domes': { who: 'gabriel', en: "The stars on the domes! When the sun came over Kettle Hill this morning they lit up like Easter. Old Mrs. Ivanoff cried on the steps.", emo: 'smile' },
  'st.rx.gabriel.cross': { who: 'gabriel', en: "The cross stands straight. People stop in the square and look up, and then they look at each other. It's a small thing. It isn't a small thing." },
  'st.rx.gabriel.stairs': { who: 'gabriel', en: "I climbed the tower stairs this morning without praying once. Well. I prayed. But out of habit, not fear.", emo: 'smile' },
  'st.rx.gabriel.fence': { who: 'gabriel', en: "The fence around the old graves. Thank you. Those are the people who built this town. They deserve a fence." },
  'st.rx.gabriel.rectory': { who: 'gabriel', en: "My stovepipe doesn't rattle any more. I slept nine hours. I didn't know I could do that." },
  'st.rx.koshkin.roof': { who: 'koshkin', en: "Roof doesn't leak? Yuri would be happy. He put a bucket there in nineteen ninety and called it the system.", emo: 'smile' },
  'st.rx.koshkin.sign': { who: 'koshkin', en: "My grandfather painted those letters. Now you. Is good. Is very good. Don't make me say it twice." },
  'st.rx.koshkin.porch': { who: 'koshkin', en: "Porch doesn't bounce. Mrs. Ivanoff is disappointed. She liked the bounce." },
  'st.rx.nina.mast': { who: 'nina', en: "We reached Nome! A guy in Nome called in! He asked for polka, which, ugh, but still. Nome!", emo: 'laugh' },
  'st.rx.nina.door': { who: 'nina', en: "The door closes! My playlist stays on the desk! Do you know what a gift that is?" },
  'st.rx.hank.fence': { who: 'hank', en: "Fence looks good. Better than I'd have done. Don't tell anybody I said that." },
  'st.rx.hank.sorensen': { who: 'hank', en: "Sorensens have water again. They bought the pipe from me, so I'm taking half the credit." },
  'st.rx.tommy.boardwalk': { who: 'tommy', en: "You fixed the boardwalk? I went through that thing on my snowmachine last year. Long story. Cold story.", emo: 'laugh' },
  'st.rx.tommy.dogs': { who: 'tommy', en: "Old Joe says his dogs have better roofs than he does now. He's thinking of moving in with them." },
  'st.rx.lou.sign': { who: 'lou', en: "Sign doesn't bang any more. First quiet night in a year. I almost missed it. Almost." },
  'st.rx.lou.kaplan': { who: 'lou', en: "Old Kaplan's house is blue again. He sat on his porch all afternoon looking at it. Then he came in here and told everybody. Twice." },
  'st.rx.ray.door': { who: 'ray', en: "Door runs smooth. Line didn't freeze once today. Company'll take the credit, but the guys know." },
  'st.rx.ray.delgado': { who: 'ray', en: "The Delgados' roof. They told the whole line. You've got a fan club at the cannery now." },
  'st.rx.ellen.ramp': { who: 'ellen', en: "Mrs. Ivanoff came up the ramp in her wheelchair this morning by herself. She waved at me like she'd won a race.", emo: 'smile' },
  'st.rx.ellen.blind': { who: 'ellen', en: "My blind's back up. I've already seen a gyrfalcon from it. A gyrfalcon! In my yard!", emo: 'surprise' },
  'st.rx.marta.lights': { who: 'marta', en: "Third Avenue's lit. Two fender-benders a week out there in the dark, and none since. That's on you. The good kind of on you." },
  'st.rx.marta.porch': { who: 'marta', en: "You fixed my railing. Nina says you took her crime-scene tape. She wants it back." },
  'st.rx.ruth.playground': { who: 'ruth', en: "The children are on the swings again. I can hear them from the post office. That's the sound a town is supposed to make.", emo: 'smile' },
  'st.rx.ruth.gym': { who: 'ruth', en: "They took the buckets off the gym floor. Eleven buckets. The children held a funeral for them." },
  'st.rx.ruth.windows': { who: 'ruth', en: "My windows don't sing any more. I'll miss them a little. Tommy won't." },
  'st.rx.ruth.shore': { who: 'ruth', en: "You shored up the Okpik house on Shore Road. Those families were sold bad land. Someone should answer for that. Meanwhile, thank you.", emo: 'serious' },
  'st.rx.wade.lighthouse': { who: 'wade', en: "Saw Zarya Point lit up from two thousand feet last night. Haven't seen that since I was a kid. Nearly flew into a cloud looking at it." },
  'st.rx.walt.lights': { who: 'walt', en: "The city thanks you. Unofficially. Officially the city has no budget, so this conversation never happened." },
  'st.rx.evan.lights': { who: 'evan', en: "Third Avenue looks so nice now! Northstar had a smart lighting proposal ready for it, but someone got there first. How enterprising.", emo: 'smile' },
  'st.rx.evan.sign': { who: 'evan', en: "Koshkin's sign looks lovely. Vintage is very in right now. We should do a collab. Ha. Kidding.", emo: 'smile' },
  'st.rx.lyle.gym': { who: 'lyle', en: "Nice work on the gym roof. Folks are saying it was the city. I didn't correct them. Kidding. Mostly." },
};

// npc, repair, line, friendship, standing
export const REACTIONS = [
  ['dolly', 'r.dolly.sign', 'st.rx.dolly.sign', 6], ['dolly', 'r.dolly.window', 'st.rx.dolly.window', 4],
  ['dolly', 'r.hall.heater', 'st.rx.dolly.heater', 3], ['dolly', 'r.house.nanouk', 'st.rx.dolly.nanouk', 3],
  ['pearl', 'r.post.steps', 'st.rx.pearl.steps', 4], ['pearl', 'r.post.sign', 'st.rx.pearl.sign', 3],
  ['pearl', 'r.house.pearl', 'st.rx.pearl.house', 4], ['pearl', 'r.house.ivanoff', 'st.rx.pearl.ivanoff', 2],
  ['pearl', 'r.house.petrov', 'st.rx.pearl.petrov', 2],
  ['gabriel', 'r.church.domes', 'st.rx.gabriel.domes', 8], ['gabriel', 'r.church.cross', 'st.rx.gabriel.cross', 5],
  ['gabriel', 'r.church.stairs', 'st.rx.gabriel.stairs', 4], ['gabriel', 'r.cemetery.fence', 'st.rx.gabriel.fence', 4],
  ['gabriel', 'r.house.rectory', 'st.rx.gabriel.rectory', 4],
  ['koshkin', 'r.koshkin.roof', 'st.rx.koshkin.roof', 5], ['koshkin', 'r.koshkin.sign', 'st.rx.koshkin.sign', 8],
  ['koshkin', 'r.koshkin.porch', 'st.rx.koshkin.porch', 4],
  ['nina', 'r.kzry.mast', 'st.rx.nina.mast', 8], ['nina', 'r.kzry.door', 'st.rx.nina.door', 4],
  ['hank', 'r.hank.fence', 'st.rx.hank.fence', 6], ['hank', 'r.house.sorensen', 'st.rx.hank.sorensen', 2],
  ['tommy', 'r.harbor.boardwalk', 'st.rx.tommy.boardwalk', 4], ['tommy', 'r.house.dogyard', 'st.rx.tommy.dogs', 3],
  ['lou', 'r.anchor.sign', 'st.rx.lou.sign', 6], ['lou', 'r.house.kaplan', 'st.rx.lou.kaplan', 2],
  ['ray', 'r.cannery.door', 'st.rx.ray.door', 5], ['ray', 'r.house.delgado', 'st.rx.ray.delgado', 3],
  ['ellen', 'r.clinic.ramp', 'st.rx.ellen.ramp', 6], ['ellen', 'r.house.ellen', 'st.rx.ellen.blind', 4],
  ['marta', 'r.third.lights', 'st.rx.marta.lights', 6], ['marta', 'r.house.marta', 'st.rx.marta.porch', 5],
  ['ruth', 'r.school.playground', 'st.rx.ruth.playground', 6], ['ruth', 'r.school.gym', 'st.rx.ruth.gym', 4],
  ['ruth', 'r.house.ruth', 'st.rx.ruth.windows', 6], ['ruth', 'r.house.shore', 'st.rx.ruth.shore', 4],
  ['wade', 'r.lighthouse.lamp', 'st.rx.wade.lighthouse', 6],
  ['walt', 'r.third.lights', 'st.rx.walt.lights', 2, 2],
  ['evan', 'r.third.lights', 'st.rx.evan.lights', 0], ['evan', 'r.koshkin.sign', 'st.rx.evan.sign', 0],
  ['lyle', 'r.school.gym', 'st.rx.lyle.gym', 2],
];

/** Once per fixed thing: the owner (or a neighbour) says something about it. */
export async function reactTo(c, npc) {
  for (const [who, rid, line, rel, standing] of REACTIONS) {
    if (who !== npc || !(c.state.repairs || {})[rid] || c.flag('rx.' + line) === true) continue;
    c.flag('rx.' + line, true);
    await c.say(npc, line);
    if (rel) c.rel(rel);
    if (standing) c.standing(standing);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ Pearl's board (a topic in her conversation)
const boardBusy = (c) => {
  const id = c.flag('board.current');
  return typeof id === 'string' && !!REPAIRS[id] && !(c.state.repairs || {})[id] && !!c.G.missions?.isActive?.('jobs.board');
};
async function boardPick(c) {
  if (c.flag('board.met') !== true) { c.flag('board.met', true); await c.say('pearl', 'st.pearl.first'); } else await c.say('pearl', 'st.pearl.board');
  const ids = boardOffer(c.state);
  if (!ids.length) { await c.say('pearl', 'st.pearl.empty'); return; }
  const opts = ids.map((id) => ({ label: `${REPAIRS[id].name} · ${REPAIRS[id].pay ? '$' + REPAIRS[id].pay : 'volunteer'} · ${materialsText(REPAIRS[id])}`, key: id }));
  opts.push({ label: 'Not today.', key: 'no' });
  const k = await c.choose(opts, { prompt: 'THE JOB BOARD' });
  if (!REPAIRS[k]) { await c.say('pearl', 'st.pearl.notoday'); return; }
  c.flag('board.current', k);
  c.flag('board.drop', false);
  await c.say('pearl', 'st.pearl.taken');
  c.rel(2);
  c.start('jobs.board');
  c.emit('board:accept');
}
async function boardStatus(c) {
  await c.say('pearl', 'st.pearl.busy');
  const k = await c.choose(["I'm on it.", 'Put it back on the board.']);
  if (k === 1) { c.flag('board.drop', true); await c.say('pearl', 'st.pearl.drop'); }
}

// Topics other modules' conversations offer (side_friends.js builds the menus).
export const TOWN_TOPICS = {
  pearl: [
    { label: 'Anything on the job board?', when: (c) => c.day >= 2 && !boardBusy(c), run: boardPick },
    { label: 'About my job from the board…', when: (c) => boardBusy(c), run: boardStatus },
  ],
};

// ------------------------------------------------------------------ missions
export const MISSIONS = {
  'jobs.board': {
    title: 'The Job Board',
    async run(m, from) {
      const G = m.G, s = G.state, F = s.flags;
      const valid = (id) => typeof id === 'string' && !!REPAIRS[id] && !s.repairs[id];
      if (m.cp(1, from) && !valid(F['board.current'])) {
        SIDE.obj(m, 'Pick a job from the board', 'post', "Pearl Jessup's board, post office, 9 am to 5 pm");
        await m.until(() => valid(F['board.current']));
        if (!valid(F['board.current'])) F['board.current'] = boardOffer(s)[0]; // started from a script without a pick
      }
      const id = F['board.current'];
      if (!valid(id)) { F['board.current'] = null; SIDE.finish(m); return; }
      if (SIDE.once(G, 'board.told')) m.ear('st.n.board');
      const fixed = await workOrder(m, id, 10, from, () => F['board.drop'] === true || F['board.current'] !== id);
      F['board.current'] = null;
      F['board.drop'] = false;
      if (fixed) {
        const n = (Number(F['board.count']) || 0) + 1;
        F['board.count'] = n;
        G.missions.emit?.('board:done');
        G.missions.emit?.('repair:' + id);
        if (n === 1) m.ear('st.n.spirit');
        if (n === 5) m.ear('st.d.spirit');
      }
      SIDE.finish(m);
    },
    onDone: SIDE.again('jobs.board'),
  },
};

export const DIALOG = {};
export const DIALOG_OVERRIDE = true;
