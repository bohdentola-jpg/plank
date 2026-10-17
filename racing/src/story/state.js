// Story progress: the save (v2, with a migration from v1), your garage and
// parts, money, street REP and rank, which events are open, the named rivals
// on each grid and how you've done against them, duels, cups, boss pink
// slips, payouts, and the text-message feed.
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { carStats } from '../car/stats.js';
import { store } from '../core/settings.js';
import { makeRng, clamp } from '../core/util.js';
import {
  CHAPTERS, EVENTS, EVENT_BY_ID, RIVALS, BOSS_UNLOCK_WINS, START_CASH, MESSAGES, PERF_PARTS,
  upgradesFor, uniformLevels, partPrice, TIER_UNLOCK, RESALE, DEALER_CLASS_UNLOCK, GARAGE_SLOTS, SAVE_VERSION,
  CUP_POINTS, V1_EVENTS, V1_CHAPTERS, PART_PR_WEIGHT, SLIP_SALE,
} from './data.js';
import { repFor, rankOf } from './rep.js';

const KEY = 'story';
const LAST = CHAPTERS.length - 1;
const MSG_BY_ID = Object.fromEntries(MESSAGES.map((m, i) => [m.id, { ...m, i }]));
export { EVENT_BY_ID };

export function prFor(spec, up) {
  return Math.round(carStats(spec, up).rating * 1000);
}
const tierPR = (spec, t) => prFor(spec, upgradesFor(uniformLevels(t), spec));
const round50 = (n) => Math.round(n / 50) * 50;
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Part levels that put a car close to a rating: the whole tier below it,
 *  then the parts that move the rating most raised one tier until the share fits. */
export function tuneLevels(spec, target) {
  const prs = [0, 1, 2, 3].map((t) => tierPR(spec, t));
  if (target <= prs[0]) return uniformLevels(0);
  if (target >= prs[3]) return uniformLevels(3);
  let t = 0;
  while (t < 2 && target >= prs[t + 1]) t++;
  const f = (target - prs[t]) / Math.max(1, prs[t + 1] - prs[t]);
  const ids = Object.keys(PART_PR_WEIGHT).sort((a, b) => PART_PR_WEIGHT[b] - PART_PR_WEIGHT[a]);
  const total = ids.reduce((s, id) => s + PART_PR_WEIGHT[id], 0);
  const levels = {};
  let acc = 0;
  for (const id of ids) {
    const w = PART_PR_WEIGHT[id];
    if ((acc + w / 2) / total <= f) { levels[id] = t + 1; acc += w; } else levels[id] = t;
  }
  return levels;
}

/** What a set of part levels cost on this car (each part at its own tier). */
export function partsCost(spec, levels) {
  return PERF_PARTS.reduce((s, p) => s + (levels[p.id] ? partPrice(p, levels[p.id], spec) : 0), 0);
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function blank() {
  return {
    v: SAVE_VERSION, cash: START_CASH, chapter: 0, cars: [], active: null, uid: 1,
    events: {}, called: {}, bosses: {}, rep: 0, rank: 0, rivals: {}, slips: [], cup: null, seen: {}, fired: {},
    msgs: [], unread: 0, stats: { races: 0, wins: 0, earned: 0 }, started: Date.now(), finished: false,
  };
}

// ---------------------------------------------------------------- save hygiene + migration

function cleanLevels(v) {
  const out = {};
  for (const p of PERF_PARTS) {
    const lv = Math.round(num(obj(v)[p.id], 0));
    if (lv > 0) out[p.id] = clamp(lv, 0, 3);
  }
  return out;
}

function cleanCars(list, s) {
  const seen = new Set();
  const cars = [];
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || typeof c !== 'object' || !CAR_BY_ID[c.id]) continue;
    let uid = num(c.uid, 0);
    if (!uid || seen.has(uid)) uid = s.uid++;
    seen.add(uid);
    const car = {
      uid, id: c.id, levels: cleanLevels(c.levels), owned: cleanLevels(c.owned), look: { ...obj(c.look) },
      bought: num(c.bought, Date.now()), partsValue: Math.max(0, num(c.partsValue, 0)),
    };
    for (const id of Object.keys(car.levels)) car.owned[id] = Math.max(car.owned[id] || 0, car.levels[id]);
    if (typeof c.from === 'string' && RIVALS[c.from]) car.from = c.from;
    cars.push(car);
  }
  s.uid = Math.max(s.uid, ...cars.map((c) => c.uid + 1), 1);
  return cars;
}

function cleanMsgs(list) {
  const out = [];
  const ids = new Set();
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id)) continue;
    ids.add(m.id);
    out.push({ id: m.id, t: num(m.t, Date.now()), read: !!m.read });
  }
  return out;
}

function cleanRecs(v) {
  const out = {};
  for (const [id, r] of Object.entries(obj(v))) {
    if (!EVENT_BY_ID[id] || !r || typeof r !== 'object') continue;
    out[id] = { tries: Math.max(0, num(r.tries, 0)), best: num(r.best, null), won: !!r.won };
    if (r.lostOnce) out[id].lostOnce = true;
  }
  return out;
}

const chFlags = (v) => Object.fromEntries(Object.entries(obj(v)).filter(([k, x]) => x && CHAPTERS[+k]).map(([k]) => [+k, true]));

/** A v2 save from storage, with every field checked (never trust localStorage). */
function sanitize(o) {
  const s = blank();
  s.cash = Math.max(0, num(o.cash, START_CASH));
  s.chapter = clamp(Math.round(num(o.chapter, 0)), 0, LAST);
  s.uid = Math.max(1, num(o.uid, 1));
  s.cars = cleanCars(o.cars, s);
  s.active = s.cars.some((c) => c.uid === o.active) ? o.active : s.cars[0]?.uid ?? null;
  s.events = cleanRecs(o.events);
  s.called = chFlags(o.called);
  s.bosses = chFlags(o.bosses);
  s.rep = Math.max(0, Math.round(num(o.rep, 0)));
  s.rank = clamp(Math.round(num(o.rank, rankOf(s.rep))), 0, rankOf(s.rep));
  for (const [id, r] of Object.entries(obj(o.rivals))) {
    if (RIVALS[id]) s.rivals[id] = { met: num(r?.met, 0), beat: num(r?.beat, 0), lost: num(r?.lost, 0) };
  }
  s.slips = (Array.isArray(o.slips) ? o.slips : []).filter((x) => x && CAR_BY_ID[x.car] && CHAPTERS[x.ch])
    .map((x) => ({ ch: x.ch, rival: RIVALS[x.rival] ? x.rival : CHAPTERS[x.ch].boss.id, car: x.car, look: { ...obj(x.look) }, levels: cleanLevels(x.levels) }));
  const cup = o.cup && EVENT_BY_ID[o.cup.id]?.kind === 'cup' ? o.cup : null;
  if (cup) {
    const pts = {};
    for (const [n, p] of Object.entries(obj(cup.pts))) pts[n] = num(p, 0);
    s.cup = { id: cup.id, round: clamp(Math.round(num(cup.round, 0)), 0, EVENT_BY_ID[cup.id].rounds.length - 1), pts, log: Array.isArray(cup.log) ? cup.log.filter(Array.isArray) : [] };
  }
  s.seen = { ...obj(o.seen) };
  s.fired = { ...obj(o.fired) };
  s.msgs = cleanMsgs(o.msgs);
  s.unread = s.msgs.filter((m) => !m.read).length;
  const st = obj(o.stats);
  s.stats = { races: num(st.races, 0), wins: num(st.wins, 0), earned: num(st.earned, 0) };
  s.started = num(o.started, Date.now());
  s.finished = !!o.finished && !!s.bosses[LAST];
  return s;
}

/** A v1 save (five chapters) → v2. Keeps cash, cars, texts, stats, the
 *  events and bosses that still exist, and how far into the city you got. */
function migrateV1(o) {
  const s = blank();
  s.cash = Math.max(0, num(o.cash, START_CASH));
  s.uid = Math.max(1, num(o.uid, 1));
  s.cars = cleanCars(o.cars, s);
  s.active = s.cars.some((c) => c.uid === o.active) ? o.active : s.cars[0]?.uid ?? null;
  s.msgs = cleanMsgs(o.msgs);
  s.unread = s.msgs.filter((m) => !m.read).length;
  const st = obj(o.stats);
  s.stats = { races: num(st.races, 0), wins: num(st.wins, 0), earned: num(st.earned, 0) };
  s.started = num(o.started, Date.now());
  // bosses: Dez, Tank, Kaito and Vex carry over; ZERO's old race is not the new finale
  for (const [k, beaten] of Object.entries(obj(o.bosses))) {
    const i = Math.round(Number(k));
    if (beaten && i >= 0 && i < 4) s.bosses[V1_CHAPTERS[i]] = true;
  }
  for (const [id, rec] of Object.entries(obj(o.events))) {
    const called = /^boss:(\d+):called$/.exec(id);
    if (called) { const i = +called[1]; if (i < 4) s.called[V1_CHAPTERS[i]] = true; continue; }
    const nid = V1_EVENTS[id];
    if (!nid || !rec || typeof rec !== 'object') continue;
    s.events[nid] = { tries: Math.max(0, num(rec.tries, 0)), best: num(rec.best, null), won: !!rec.won };
  }
  for (const ch of Object.keys(s.bosses)) {
    const ev = EVENTS.find((e) => e.boss && e.ch === +ch);
    s.events[ev.id] = { tries: Math.max(1, s.events[ev.id]?.tries || 0), best: 1, won: true };
  }
  // as far into the city as the old save got (the new districts in between open too)
  const v1ch = clamp(Math.round(num(o.chapter, 0)), 0, 4);
  s.chapter = Math.min(LAST, Math.max(V1_CHAPTERS[v1ch], ...Object.keys(s.bosses).map((c) => +c + 1)));
  // REP for what was already won
  for (const [id, rec] of Object.entries(s.events)) {
    const ev = EVENT_BY_ID[id];
    if (rec.won) s.rep += repFor({ kind: ev.kind, ch: ev.ch, won: true, firstWin: true }).total;
  }
  s.rank = rankOf(s.rep);
  // nothing to announce for what the old save already had open
  for (let ch = 0; ch <= s.chapter; ch++) { s.seen[`intro:${ch}`] = true; if (s.bosses[ch]) s.seen[`outro:${ch}`] = true; }
  return s;
}

// ---------------------------------------------------------------- the story

class Story {
  constructor() {
    this.s = null;
    this._riv = new Map();
    this._warm = [];
    this.lastSummary = null;
  }

  // ---------------------------------------------------------------- save
  exists() { return !!store.load(KEY); }
  load() {
    let raw = null;
    try { raw = store.load(KEY); } catch { raw = null; }
    this._riv.clear();
    if (!raw || typeof raw !== 'object') { this.s = null; return null; }
    this.migrated = false;
    try {
      if (num(raw.v, 1) >= 2) this.s = sanitize(raw);
      else {
        try { store.save(KEY + '_v1', raw); } catch { /* backup is best effort */ }
        this.s = migrateV1(raw);
        this.silentUnlocks();
        this._reconcileTexts();
        this.message('migrate');
        this.migrated = true;
      }
      this.checkUnlocks();
    } catch (e) {
      console.warn('story save unreadable, starting over', e);
      try { store.save(KEY + '_broken', raw); } catch { /* */ }
      this.s = null;
      return null;
    }
    this.save();
    return this.s;
  }
  save() { if (this.s) store.save(KEY, this.s); }
  reset() { store.remove(KEY); this.s = null; this._riv.clear(); }
  start() {
    this.s = blank();
    this._riv.clear();
    this.message('start');
    this.save();
  }

  // ---------------------------------------------------------------- garage
  get car() { return this.s?.cars.find((c) => c.uid === this.s.active) || this.s?.cars[0] || null; }
  spec(car = this.car) { return car ? CAR_BY_ID[car.id] : null; }
  up(car = this.car) { return car ? upgradesFor(car.levels, this.spec(car)) : {}; }
  look(car = this.car) {
    if (!car) return {};
    // ride height follows the suspension unless the body shop set it
    const lower = (this.up(car).lower || 0);
    return { ...car.look, ride: car.look.ride ?? Math.min(1, lower * 0.6) };
  }
  pr(car = this.car) { return car ? prFor(this.spec(car), this.up(car)) : 0; }
  stats(car = this.car) { return car ? carStats(this.spec(car), this.up(car)) : null; }
  get garageFull() { return this.s.cars.length >= GARAGE_SLOTS; }

  addCar(id, look = {}, extra = {}, activate = true) {
    const car = { uid: this.s.uid++, id, levels: {}, owned: {}, look: { ...look }, bought: Date.now(), partsValue: 0, ...extra };
    this.s.cars.push(car);
    if (activate || this.s.active === null) this.s.active = car.uid;
    return car;
  }

  canBuyCar(spec, price = spec.price) {
    if (this.s.cars.length >= GARAGE_SLOTS) return 'GARAGE FULL';
    if ((DEALER_CLASS_UNLOCK[spec.cls] ?? 9) > this.s.chapter) return 'LOCKED';
    if (this.s.cash < price) return 'NOT ENOUGH CASH';
    return null;
  }

  buyCar(spec, price = spec.price, look = {}) {
    const err = this.canBuyCar(spec, price);
    if (err) return err;
    this.s.cash -= price;
    this.addCar(spec.id, look);
    this.save();
    return null;
  }

  value(car) { return round50(this.spec(car).price * RESALE + car.partsValue * 0.4); }

  sellCar(uid) {
    if (this.s.cars.length <= 1) return 'LAST CAR';
    const car = this.s.cars.find((c) => c.uid === uid);
    if (!car) return 'NO CAR';
    this.s.cash += this.value(car);
    this.s.cars = this.s.cars.filter((c) => c !== car);
    if (this.s.active === uid) this.s.active = this.s.cars[0].uid;
    this.save();
    return null;
  }

  setActive(uid) { this.s.active = uid; this.save(); }

  // ---------------------------------------------------------------- parts
  tierOpen(tier) { return this.s.chapter >= TIER_UNLOCK[tier]; }
  partPrice(partId, tier, car = this.car) {
    const part = PERF_PARTS.find((p) => p.id === partId);
    return tier ? partPrice(part, tier, this.spec(car)) : 0;
  }
  /** Install a tier: free if already owned, otherwise buy it. Returns error or null. */
  setPart(partId, tier, car = this.car) {
    const owned = car.owned[partId] || 0;
    if (tier > owned) {
      if (!this.tierOpen(tier)) return 'NOT IN STOCK YET';
      const price = this.partPrice(partId, tier, car);
      if (this.s.cash < price) return 'NOT ENOUGH CASH';
      this.s.cash -= price;
      car.partsValue += price;
      car.owned[partId] = tier;
    }
    car.levels[partId] = tier;
    this.save();
    return null;
  }

  buyLook(changes, cost, car = this.car) {
    if (this.s.cash < cost) return 'NOT ENOUGH CASH';
    this.s.cash -= cost;
    car.partsValue += Math.round(cost * 0.5);
    Object.assign(car.look, changes);
    this.save();
    return null;
  }

  // ---------------------------------------------------------------- chapters + events
  events(ch = this.s.chapter) { return EVENTS.filter((e) => e.ch === ch); }
  winsIn(ch) { return EVENTS.filter((e) => e.ch === ch && !e.boss && this.s.events[e.id]?.won).length; }
  bossWins(ch) { return CHAPTERS[ch].bossWins ?? BOSS_UNLOCK_WINS; }
  /** Every other crew's boss beaten (the Frequency only calls once the city is yours). */
  cityTaken(ch = LAST) { return CHAPTERS.every((_, i) => i === ch || this.s.bosses[i]); }
  bossOpen(ch) {
    if (ch > this.s.chapter) return false;
    if (this.s.bosses[ch]) return true;
    if (this.winsIn(ch) < this.bossWins(ch) || this.s.rep < CHAPTERS[ch].bossRep) return false;
    return ch !== LAST || this.cityTaken();
  }
  needMet(ev) {
    const n = ev.need;
    if (!n) return true;
    if (n.wins && this.winsIn(ev.ch) < n.wins) return false;
    if (n.rep && this.s.rep < n.rep) return false;
    return true;
  }
  status(ev) {
    if (ev.ch > this.s.chapter) return 'locked';
    if (this.s.cup?.id === ev.id) return 'cup';
    if (ev.boss ? !this.bossOpen(ev.ch) : !this.needMet(ev)) return 'locked';
    const r = this.s.events[ev.id];
    if (r?.won) return 'won';
    if (r) return 'raced';
    return 'open';
  }
  /** Why an event is still locked, for the flyer. */
  lockReason(ev) {
    const s = this.s;
    const ch = CHAPTERS[ev.ch];
    if (ev.ch > s.chapter) return `BEAT ${CHAPTERS[ev.ch - 1].boss.name} FIRST`;
    if (ev.boss) {
      if (ev.ch === LAST && !this.cityTaken()) return 'EVERY OTHER CREW FIRST';
      const parts = [];
      const w = this.bossWins(ev.ch) - this.winsIn(ev.ch);
      if (w > 0) parts.push(`WIN ${w} MORE`);
      if (s.rep < ch.bossRep) parts.push(`${(ch.bossRep - s.rep).toLocaleString()} MORE REP`);
      return parts.join(' · ') || 'LOCKED';
    }
    if (ev.need?.wins && this.winsIn(ev.ch) < ev.need.wins) return `WIN ${ev.need.wins} ${ch.name} RACES`;
    if (ev.need?.rep && s.rep < ev.need.rep) return `INVITE AT ${ev.need.rep.toLocaleString()} REP`;
    return 'LOCKED';
  }

  // ---------------------------------------------------------------- rivals
  rivalRec(id) { return this.s.rivals[id] || { met: 0, beat: 0, lost: 0 }; }
  /** Has the player heard of this rival yet (their crew's chapter is open)? */
  known(id) {
    const R = RIVALS[id];
    const ch = CHAPTERS.findIndex((c) => c.id === R?.crew);
    return ch >= 0 && ch <= this.s.chapter;
  }

  /** One named rival in their own car, its parts tuned to a rating. */
  racer(id, target, skill, extra = {}) {
    const R = RIVALS[id];
    const spec = CAR_BY_ID[R.car];
    const levels = tuneLevels(spec, target);
    const upgrades = upgradesFor(levels, spec);
    return { id, spec, look: { ...R.look }, upgrades, levels, name: R.name, skill: clamp(skill, 0.4, 0.98), pr: prFor(spec, upgrades), ...extra };
  }

  /** The grid for an event: the same crew members in the same cars every time. */
  rivals(ev) {
    const tries = this.s.events[ev.id]?.tries || 0;
    const key = `${ev.id}:${tries}`;
    if (!this._riv.has(key)) this._riv.set(key, this._makeRivals(ev, tries));
    return this._riv.get(key);
  }

  _makeRivals(ev, tries) {
    const ch = CHAPTERS[ev.ch];
    if (ev.boss) return [this.racer(ch.boss.id, ch.boss.pr, ch.boss.skill, { boss: true })];
    if (ev.kind === 'duel') {
      const R = RIVALS[ev.vs];
      return [this.racer(ev.vs, ev.pr + (R.edge || 0), ch.skill + 0.08 + (R.skill || 0), { duel: true })];
    }
    if (!ev.rivals || ev.type === 'timeattack' || ev.type === 'drift') return [];
    const rng = makeRng(ev.id + ':' + tries);
    const pinned = [...(ev.with || []), ...(ev.guests || [])];
    const rest = shuffle(ch.members.filter((id) => !pinned.includes(id)), rng);
    // crew members whose car can be tuned to this rating go first
    const fits = (id) => {
      const spec = CAR_BY_ID[RIVALS[id].car];
      return ev.pr >= tierPR(spec, 0) - 20 && ev.pr <= tierPR(spec, 3) + 10;
    };
    const ids = pinned.slice(0, ev.rivals);
    for (const id of rest) if (ids.length < ev.rivals && fits(id)) ids.push(id);
    for (const id of rest) if (ids.length < ev.rivals && !ids.includes(id)) ids.push(id);
    const n = Math.max(1, ids.length - 1);
    return ids.map((id, k) => {
      const R = RIVALS[id];
      const target = ev.pr + (R.edge || 0) + (rng() - 0.5) * 16;
      if (R.boss) {
        const home = CHAPTERS.find((c) => c.boss.id === id);
        return this.racer(id, target, (home?.boss.skill ?? ch.skill) - 0.04, { guest: true });
      }
      return this.racer(id, target, ch.skill + (R.skill || 0) + (k / n - 0.5) * 0.08);
    });
  }

  rivalPR(ev) {
    const r = this.rivals(ev);
    if (!r.length) return 0;
    return Math.round(r.reduce((s, x) => s + x.pr, 0) / r.length);
  }

  /** Posted scores for a drift event: three crew members, scaled by chapter. */
  driftRivals(ev) {
    const ch = CHAPTERS[ev.ch];
    const ids = (ev.with?.length ? ev.with : ch.members).slice(0, 3);
    return ids.map((id, k) => [RIVALS[id].name, [2.3, 3.6, 4.8][k] * (ch.drift || 1)]);
  }

  /** Who you beat: named rivals behind you (or knocked out before you). */
  _rivalsResult(ev, res, grid) {
    const order = Array.isArray(res.order) ? res.order : [];
    const pairs = [];
    if (ev.type === 'drift') {
      const me = res.score || 0;
      const ids = (ev.with?.length ? ev.with : CHAPTERS[ev.ch].members).slice(0, 3);
      for (const id of ids) {
        const row = order.find((o) => !o.player && o.name === RIVALS[id].name);
        if (row) pairs.push([id, me > (row.score || 0)]);
      }
    } else {
      const pIdx = order.findIndex((o) => o.player);
      for (const g of grid) {
        if (!g.id) continue;
        const idx = order.findIndex((o) => !o.player && o.name === g.name);
        const ahead = res.out ? false : idx < 0 ? true : pIdx >= 0 && pIdx < idx;
        pairs.push([g.id, ahead]);
      }
    }
    const beaten = [], fresh = [];
    for (const [id, ahead] of pairs) {
      const rec = (this.s.rivals[id] = this.s.rivals[id] || { met: 0, beat: 0, lost: 0 });
      rec.met++;
      if (ahead) {
        if (!rec.beat) fresh.push(id);
        rec.beat++;
        beaten.push(id);
      } else rec.lost++;
    }
    return { beaten, fresh };
  }

  /** How you won: photo finish, wire to wire, clean laps, style, the clock. */
  _style(ev, res, laps, won, place) {
    const o = {};
    const order = Array.isArray(res.order) ? res.order : [];
    if (ev.type === 'drift') {
      const best = Math.max(0, ...order.filter((x) => !x.player).map((x) => x.score || 0));
      if (won && best && (res.score || 0) >= best * 1.25) o.style = true;
      return o;
    }
    if (ev.type === 'timeattack') {
      if (won && res.target && res.bestLap && res.bestLap <= res.target * 0.98) o.clock = true;
      return o;
    }
    const drag = ev.type === 'drag';
    const photo = drag ? 0.08 : 0.35, wire = drag ? 0.8 : 4;
    const pIdx = order.findIndex((x) => x.player);
    const me = res.time;
    if (won && me && pIdx >= 0 && order[pIdx + 1]?.time) {
      const gap = order[pIdx + 1].time - me;
      if (gap < photo) o.photo = true;
      else if (gap > wire) o.wire = true;
    } else if (place === 2 && me && order[0]?.time && me - order[0].time < photo) o.photo = true;
    if (won && (ev.type === 'circuit' || ev.type === 'knockout') && laps > 1 && res.bestLap && me && me <= res.bestLap * laps + 3.5) o.clean = true;
    return o;
  }

  /** Apply a finished race. Returns a summary for the results card. */
  applyResult(ev, res, ctx = {}) {
    if (ev.kind === 'cup') return this._applyCup(ev, res, ctx);
    const s = this.s;
    const rec = (s.events[ev.id] = s.events[ev.id] || { tries: 0, best: null, won: false });
    rec.tries++;
    s.stats.races++;
    const before = s.msgs.length;
    let place = res.place;
    let won;
    if (ev.type === 'timeattack') {
      won = res.beat ?? !!(res.bestLap && res.target && res.bestLap <= res.target);
      place = won ? 1 : null;
    } else {
      won = place === 1 && !res.out;
    }
    if (place && (rec.best === null || place < rec.best)) rec.best = place;
    // one-on-ones and the clock pay the winner only
    const solo = ev.boss || ev.kind === 'duel' || ev.type === 'timeattack' || (ev.type !== 'drift' && (ev.rivals || 0) < 2);
    const share = won ? 1 : solo ? 0 : place === 2 ? 0.45 : place === 3 ? 0.2 : 0;
    // repeat wins pay a quarter: no farming the first event forever
    const firstWin = won && !rec.won;
    const repeat = rec.won;
    const pay = round50(ev.prize * share * (rec.won ? 0.25 : 1));
    s.cash += pay;
    s.stats.earned += pay;
    if (won) { s.stats.wins++; rec.won = true; }
    const rv = this._rivalsResult(ev, res, ctx.grid || []);
    const rep = repFor({
      kind: ev.kind, ch: ev.ch, place, won, firstWin, repeat, beaten: rv.beaten.length, fresh: rv.fresh.length,
      ...this._style(ev, res, ctx.laps || 1, won, place),
    });
    s.rep += rep.total;
    const out = this._summary(ev, { place, won, pay, firstWin, rep, rv });
    if (firstWin) this.message(`won:${ev.id}`);
    if (!won && !rec.lostOnce) { rec.lostOnce = true; this.message(`lost:${ev.id}`); }
    if (ev.boss && firstWin) {
      s.bosses[ev.ch] = true;
      out.bossDown = ev.ch;
      out.slip = this._grantSlip(ev.ch);
      if (ev.ch === LAST) {
        s.finished = true;
        out.finished = true;
        this.message('end');
      } else {
        this.message(`beat:${ev.ch}`);
        if (s.chapter < ev.ch + 1) {
          s.chapter = ev.ch + 1;
          out.chapterUp = s.chapter;
          this.message(`open:${s.chapter}`);
        }
      }
    }
    this.checkUnlocks(out);
    out.newMessages = s.msgs.length - before;
    this.save();
    this.lastSummary = out;
    return out;
  }

  _summary(ev, { place, won, pay, firstWin, rep, rv }) {
    return {
      ev: ev.id, kind: ev.kind, place, won, pay, firstWin, rep: rep.total, repLines: rep.lines,
      beaten: rv.beaten.map((id) => RIVALS[id].name), fresh: rv.fresh.map((id) => RIVALS[id].name),
      newMessages: 0, bossCalls: [], unlocked: [], rankUp: null, chapterUp: null, bossDown: null, slip: null, finished: false,
    };
  }

  // ---------------------------------------------------------------- cups
  startCup(ev) {
    this.s.cup = { id: ev.id, round: 0, pts: {}, log: [] };
    this.save();
  }
  abandonCup() { this.s.cup = null; this.save(); }
  /** Points table, leader first (a tie goes to whoever finished ahead in the last round). */
  cupStandings(cup = this.s.cup, ev = cup && EVENT_BY_ID[cup.id]) {
    if (!cup || !ev) return [];
    const names = new Set(['YOU', ...this.rivals(ev).map((r) => r.name), ...Object.keys(cup.pts)]);
    const last = cup.log[cup.log.length - 1] || [];
    const at = (n) => { const k = last.indexOf(n); return k < 0 ? 99 : k; };
    return [...names].map((name) => ({ name, pts: cup.pts[name] || 0, player: name === 'YOU' }))
      .sort((a, b) => b.pts - a.pts || at(a.name) - at(b.name));
  }

  _applyCup(ev, res, ctx) {
    const s = this.s;
    const cup = s.cup;
    const grid = ctx.grid || [];
    // a re-run of a round that's already on the table counts for nothing
    if (!cup || cup.id !== ev.id || cup.round !== ctx.round) {
      const out = this._summary(ev, { place: res.place, won: false, pay: 0, firstWin: false, rep: { total: 0, lines: [] }, rv: { beaten: [], fresh: [] } });
      out.practice = true;
      this.lastSummary = out;
      return out;
    }
    s.stats.races++;
    const before = s.msgs.length;
    const order = Array.isArray(res.order) ? res.order : [];
    const finish = order.filter((o) => !o.out).map((o) => (o.player ? 'YOU' : o.name));
    finish.forEach((n, k) => { cup.pts[n] = (cup.pts[n] || 0) + (CUP_POINTS[k] || 0); });
    for (const n of ['YOU', ...grid.map((g) => g.name)]) cup.pts[n] = cup.pts[n] || 0;
    cup.log.push(finish);
    cup.round++;
    const rv = this._rivalsResult(ev, res, grid);
    const roundPlace = res.out ? null : res.place;
    const leg = ev.rounds[ctx.round];
    const style = this._style({ ...ev, ...leg }, res, ctx.laps || 1, roundPlace === 1, roundPlace);
    const rec = (s.events[ev.id] = s.events[ev.id] || { tries: 0, best: null, won: false });
    const standings = this.cupStandings(cup, ev);
    let out;
    if (cup.round >= ev.rounds.length) {
      const pos = standings.findIndex((x) => x.player) + 1;
      const won = pos === 1;
      const firstWin = won && !rec.won;
      const repeat = rec.won;
      rec.tries++;
      if (pos && (rec.best === null || pos < rec.best)) rec.best = pos;
      const share = won ? 1 : pos === 2 ? 0.45 : pos === 3 ? 0.2 : 0;
      const pay = round50(ev.prize * share * (rec.won ? 0.25 : 1));
      s.cash += pay;
      s.stats.earned += pay;
      if (won) { s.stats.wins++; rec.won = true; }
      const rep = repFor({ kind: 'cup', ch: ev.ch, place: pos, won, firstWin, repeat, beaten: rv.beaten.length, fresh: rv.fresh.length, ...style });
      s.rep += rep.total;
      out = this._summary(ev, { place: pos, won, pay, firstWin, rep, rv });
      out.done = true;
      s.cup = null;
      if (firstWin) this.message(`won:${ev.id}`);
    } else {
      const rep = repFor({ kind: 'race', ch: ev.ch, place: null, won: false, repeat: rec.won, beaten: rv.beaten.length, fresh: rv.fresh.length, ...style });
      s.rep += rep.total;
      out = this._summary(ev, { place: null, won: false, pay: 0, firstWin: false, rep, rv });
    }
    Object.assign(out, { round: ctx.round, rounds: ev.rounds.length, roundPlace, standings });
    this.checkUnlocks(out);
    out.newMessages = s.msgs.length - before;
    this.save();
    this.lastSummary = out;
    return out;
  }

  // ---------------------------------------------------------------- pink slips
  _grantSlip(ch) {
    const b = CHAPTERS[ch].boss;
    const slip = { ch, rival: b.id, car: b.car, look: { ...b.look }, levels: tuneLevels(CAR_BY_ID[b.car], b.pr) };
    this.s.slips.push(slip);
    return slip;
  }
  slipValue(slip) {
    const spec = CAR_BY_ID[slip.car];
    return round50((spec.price * RESALE + partsCost(spec, slip.levels) * 0.4) * SLIP_SALE);
  }
  slipPR(slip) { const spec = CAR_BY_ID[slip.car]; return prFor(spec, upgradesFor(slip.levels, spec)); }
  keepSlip(i = 0) {
    const sl = this.s.slips[i];
    if (!sl) return 'NO PINK SLIP';
    if (this.garageFull) return 'GARAGE FULL';
    const spec = CAR_BY_ID[sl.car];
    this.addCar(sl.car, sl.look, { levels: { ...sl.levels }, owned: { ...sl.levels }, partsValue: partsCost(spec, sl.levels), from: sl.rival }, false);
    this.s.slips.splice(i, 1);
    this.message(`slip:${sl.ch}`);
    this.save();
    return null;
  }
  sellSlip(i = 0) {
    const sl = this.s.slips[i];
    if (!sl) return 'NO PINK SLIP';
    const v = this.slipValue(sl);
    this.s.cash += v;
    this.s.stats.earned += v;
    this.s.slips.splice(i, 1);
    this.save();
    return null;
  }

  // ---------------------------------------------------------------- unlocks
  /** Boss callouts, duels and cups that just opened, and street-rank ups:
   *  each one texts you once. */
  checkUnlocks(out = null) {
    const s = this.s;
    for (let ch = 0; ch <= s.chapter; ch++) {
      if (s.bosses[ch] || s.called[ch] || !this.bossOpen(ch)) continue;
      s.called[ch] = true;
      this.message(`boss:${ch}`);
      out?.bossCalls.push(ch);
    }
    for (const ev of EVENTS) {
      if (!ev.need || ev.ch > s.chapter || s.fired[`ev:${ev.id}`] || !this.needMet(ev)) continue;
      s.fired[`ev:${ev.id}`] = true;
      this.message(`ev:${ev.id}`);
      out?.unlocked.push(ev.id);
    }
    const k = rankOf(s.rep);
    if (k > s.rank) {
      for (let i = s.rank + 1; i <= k; i++) this.message(`rank:${i}`);
      s.rank = k;
      if (out) out.rankUp = k;
    }
  }
  /** Mark everything already open as announced (an old save moved over). */
  silentUnlocks() {
    const s = this.s;
    for (let ch = 0; ch <= s.chapter; ch++) if (this.bossOpen(ch)) s.called[ch] = true;
    for (const ev of EVENTS) if (ev.need && ev.ch <= s.chapter && this.needMet(ev)) s.fired[`ev:${ev.id}`] = true;
  }

  // ---------------------------------------------------------------- PR warm-up
  /** Measure the cars a chapter's grids will need and build its grids, a
   *  slice per frame (each measurement is a few hundredths of a second), so
   *  flipping through the board doesn't hitch: call warmStep() once a frame. */
  queueWarm(ch = this.s.chapter) {
    ch = clamp(ch, 0, LAST);
    const ids = new Set([...CHAPTERS[ch].members, CHAPTERS[ch].boss.id]);
    for (const ev of this.events(ch)) for (const g of ev.guests || []) ids.add(g);
    const specs = new Set([...ids].map((id) => CAR_BY_ID[RIVALS[id].car]));
    this._warm = [];
    for (const spec of specs) for (let t = 0; t <= 3; t++) this._warm.push(() => tierPR(spec, t));
    for (const ev of this.events(ch)) this._warm.push(() => this.rivals(ev));
  }
  warmStep(budgetMs = 6) {
    const t0 = performance.now();
    while (this._warm.length && performance.now() - t0 < budgetMs) {
      try { this._warm.shift()(); } catch (e) { console.warn('warm', e); }
    }
    return this._warm.length;
  }

  // ---------------------------------------------------------------- chapter cards
  /** A boss that fell and whose chapter card you haven't seen. */
  pendingOutro() {
    const s = this.s;
    for (let ch = 0; ch <= LAST; ch++) if (s.bosses[ch] && !s.seen[`outro:${ch}`]) return { kind: 'outro', ch };
    return null;
  }
  /** A district that opened and whose chapter card you haven't seen (once you have a car). */
  pendingIntro() {
    const s = this.s;
    if (!s.cars.length) return null;
    for (let ch = 0; ch <= s.chapter; ch++) if (!s.seen[`intro:${ch}`]) return { kind: 'intro', ch };
    return null;
  }
  markSeen(card) { this.s.seen[`${card.kind}:${card.ch}`] = true; this.save(); }
  /** What a chapter's boss still wants from you: { wins, rep } left (0 when met). */
  bossNeeds(ch) {
    return {
      wins: Math.max(0, this.bossWins(ch) - this.winsIn(ch)),
      rep: Math.max(0, CHAPTERS[ch].bossRep - this.s.rep),
      city: ch === LAST && !this.cityTaken(),
    };
  }

  // ---------------------------------------------------------------- phone
  /** Has a text's trigger already happened in this save? (for moving an old save over) */
  triggerMet(trigger) {
    const s = this.s;
    const k = trigger.indexOf(':');
    const kind = k < 0 ? trigger : trigger.slice(0, k);
    const arg = k < 0 ? '' : trigger.slice(k + 1);
    switch (kind) {
      case 'start': case 'migrate': return true;
      case 'starter': return s.cars.length > 0;
      case 'open': return +arg <= s.chapter;
      case 'boss': return !!(s.called[+arg] || s.bosses[+arg]);
      case 'beat': return !!s.bosses[+arg];
      case 'slip': return s.cars.some((c) => c.from && c.from === CHAPTERS[+arg]?.boss.id);
      case 'won': return !!s.events[arg]?.won;
      case 'lost': return !!s.events[arg]?.lostOnce;
      case 'ev': return !!s.fired[`ev:${arg}`];
      case 'rank': return +arg <= s.rank;
      case 'end': return !!s.finished;
      default: return false;
    }
  }
  /** An old save's texts, in the new story: drop the ones whose moment hasn't
   *  come yet (the old ending, ZERO's old callout), add the story beats the
   *  save has already lived through (as read), and keep them in story order. */
  _reconcileTexts() {
    const s = this.s;
    const keep = s.msgs.filter((m) => MSG_BY_ID[m.id] && this.triggerMet(MSG_BY_ID[m.id].trigger));
    const have = new Set(keep.map((m) => m.id));
    const t = Date.now();
    for (const m of MESSAGES) {
      if (have.has(m.id)) continue;
      if (/^(start|starter|open|boss|beat):?/.test(m.trigger) && this.triggerMet(m.trigger)) keep.push({ id: m.id, t, read: true });
    }
    keep.sort((a, b) => MSG_BY_ID[a.id].i - MSG_BY_ID[b.id].i);
    s.msgs = keep;
    s.unread = keep.filter((m) => !m.read).length;
  }
  message(trigger) {
    for (const m of MESSAGES) {
      if (m.trigger !== trigger) continue;
      if (this.s.msgs.some((x) => x.id === m.id)) continue;
      this.s.msgs.push({ id: m.id, t: Date.now(), read: false });
      this.s.unread++;
    }
  }
  inbox() {
    return this.s.msgs.map((x) => ({ ...MSG_BY_ID[x.id], ...x })).filter((m) => m.text);
  }
  markRead() {
    for (const m of this.s.msgs) m.read = true;
    this.s.unread = 0;
    this.save();
  }
}

export const story = new Story();
export { CHAPTERS, EVENTS, CARS, RIVALS };
