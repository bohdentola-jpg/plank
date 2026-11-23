// Side content — fixing up Port Zarya (TOWN SPIRIT).
//
//   REPAIRS     eight restoration projects, each with a visible result. Pearl's
//               job board, Koshkin's roof deal and the story call m.repair(id):
//               game/economy.js checks `materials` (Hank's sells them), runs
//               `minigames`, pays `pay`, adds `spirit` and restores `building`
//               visually. Two of them win a council member's trust (and card):
//               the diner sign (Dolly) and Hank's yard fence (Hank).
//               unlock: { day?, flag? } — when it can be offered.
//   'jobs.board'  Pearl's board at the post office: three cards, pick one, it
//               becomes the objective, fix it, get paid. Repeatable.
//   REACTIONS   what people say (once) after their thing is fixed — played by
//               the friendship hub in side_friends.js via reactTo(c, npc).
//   SIDE        small helpers shared by side_jobs.js and side_friends.js.
import { CAST } from '../cast.js';

// ------------------------------------------------------------------ the projects
export const REPAIRS = {
  // ---- for the council (their trust, their cards)
  'r.dolly.sign': {
    name: 'The Midnight Sun sign', building: 'diner', where: 'diner', hint: 'Midnight Sun Diner, Front St',
    materials: { wire: 3, glass: 1 }, minigames: ['wire', 'glass'], pay: 90, spirit: 10, owner: 'dolly',
    desc: "Half the neon is dead. At night it reads MIDN  HT SUN D NER, which Dolly says is 'just rude'.",
  },
  'r.hank.fence': {
    name: "Hank's yard fence", building: 'hardware', where: 'hardware.yard', hint: 'Brubaker Hardware & Fuel, the yard',
    materials: { lumber: 5, nails: 2 }, minigames: ['saw', 'hammer'], pay: 110, spirit: 5, owner: 'hank',
    desc: 'Somebody backed a fuel truck through Hank\'s yard fence. Hank says he knows who. Hank says it was Northstar. Hank says a lot of things.',
  },
  'r.school.gym': {
    name: 'School gym roof', building: 'school', where: 'school.gymDoor', hint: 'Port Zarya School',
    materials: { shingles: 6, lumber: 2, nails: 2 }, minigames: ['saw', 'hammer', 'hammer'], pay: 180, spirit: 15, owner: 'ruth',
    desc: 'The gym roof leaks like a sieve. There are eleven buckets on the basketball court. The children have named them.',
  },
  'r.cannery.door': {
    name: 'Cannery loading door', building: 'cannery', where: 'cannery', hint: 'Zarya Seafoods, Cannery Rd',
    materials: { pipe: 2, lumber: 1, nails: 1 }, minigames: ['hammer', 'hammer'], pay: 90, spirit: 6, owner: 'ray',
    desc: 'The big sliding door at Zarya Seafoods jumped its track. The line freezes every time a forklift goes through.',
  },
  // ---- around the square
  'r.koshkin.roof': {
    name: 'The cabin roof', building: 'cabin', where: 'cabin.porch', hint: "Your cabin on Shore Road (Koshkin's deal)",
    materials: { shingles: 3, lumber: 1, nails: 1 }, minigames: ['saw', 'hammer'], pay: 0, spirit: 4, unlock: { flag: 'hasCabin' }, owner: 'koshkin',
    desc: "Yuri's old cabin, your cabin, leaks on the north side. Koshkin pinned the card himself: 'Fix the roof, carpenter.' He could have just said it.",
  },
  'r.koshkin.sign': {
    name: "Repaint Koshkin's sign", building: 'koshkin', where: 'koshkin.door', hint: 'Church Square (bring a ladder)',
    materials: { paint: 2, nails: 1 }, minigames: ['hammer', 'paint'], pay: 70, spirit: 8, owner: 'koshkin',
    desc: "KOSHKIN'S GENERAL MDSE., est. 1911. His grandfather painted the gold letters. Half are gone, and Northstar's sign glows all night across the square.",
  },
  'r.post.steps': {
    name: 'Post office steps', building: 'post', where: 'post.door', hint: 'U.S. Post Office, Third Ave',
    materials: { lumber: 4, nails: 1 }, minigames: ['saw', 'hammer'], pay: 90, spirit: 8, owner: 'pearl',
    desc: 'The post office steps are split and iced. The mail carrier went down them on his back on Monday. Pearl has opinions.',
  },
  'r.church.domes': {
    name: 'Gild the dome stars', building: 'church', where: 'church.belfry', hint: 'Up the bell tower, then out on a rope',
    materials: { paint: 2, rope: 2 }, minigames: ['rope', 'paint', 'paint'], pay: 0, spirit: 15, owner: 'gabriel',
    desc: 'The gold stars on the blue onion domes have flaked to grey. Father Gabriel has the gold paint, but not the head for heights.',
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
  /** Wait for a free moment: no conversation, cutscene, overlay (shop/job) or minigame running. */
  idle(m) {
    const G = m.G;
    return m.until(() => !G.dialog?.active && !G.cinematic && !G.overlay && !G.minigames?.cur);
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
const STARTERS = ['r.dolly.sign', 'r.hank.fence', 'r.post.steps'];
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
  'st.rx.dolly.sign': { who: 'dolly', en: 'Honey, did you see my sign? You can see it from the harbour! I stood outside for twenty minutes last night, just looking at it like a fool.', emo: 'laugh' },
  'st.rx.hank.fence': { who: 'hank', en: "Fence looks good. Better than I'd have done. Don't tell anybody I said that." },
  'st.rx.ruth.gym': { who: 'ruth', en: 'They took the buckets off the gym floor. Eleven buckets. The children held a funeral for them.' },
  'st.rx.lyle.gym': { who: 'lyle', en: "Nice work on the gym roof. Folks are saying it was the city. I didn't correct them. Kidding. Mostly." },
  'st.rx.ray.door': { who: 'ray', en: "Door runs smooth. Line didn't freeze once today. Company'll take the credit, but the guys know." },
  'st.rx.koshkin.roof': { who: 'koshkin', en: "Roof doesn't leak? Yuri would be happy. He put a bucket there in nineteen ninety and called it the system.", emo: 'smile' },
  'st.rx.koshkin.sign': { who: 'koshkin', en: "My grandfather painted those letters. Now you. Is good. Is very good. Don't make me say it twice." },
  'st.rx.evan.sign': { who: 'evan', en: "Koshkin's sign looks lovely. Vintage is very in right now. We should do a collab. Ha. Kidding.", emo: 'smile' },
  'st.rx.pearl.steps': { who: 'pearl', en: 'Not one person has fallen down my steps since you fixed them. The mail carrier sends his regards. So does his tailbone.', emo: 'smile' },
  'st.rx.gabriel.domes': { who: 'gabriel', en: 'The stars on the domes! When the sun came over Kettle Hill this morning they lit up like Easter. Old Mrs. Ivanoff cried on the steps.', emo: 'smile' },
};

// npc, repair, line, friendship, standing
export const REACTIONS = [
  ['dolly', 'r.dolly.sign', 'st.rx.dolly.sign', 6],
  ['hank', 'r.hank.fence', 'st.rx.hank.fence', 6],
  ['ruth', 'r.school.gym', 'st.rx.ruth.gym', 6], ['lyle', 'r.school.gym', 'st.rx.lyle.gym', 2],
  ['ray', 'r.cannery.door', 'st.rx.ray.door', 6],
  ['koshkin', 'r.koshkin.roof', 'st.rx.koshkin.roof', 5], ['koshkin', 'r.koshkin.sign', 'st.rx.koshkin.sign', 8],
  ['evan', 'r.koshkin.sign', 'st.rx.evan.sign', 0],
  ['pearl', 'r.post.steps', 'st.rx.pearl.steps', 4],
  ['gabriel', 'r.church.domes', 'st.rx.gabriel.domes', 8],
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
