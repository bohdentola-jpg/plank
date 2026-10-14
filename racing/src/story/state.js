// Story progress: the save, your garage and parts, money, which events are
// open, rival grids for each event, payouts, and the text-message feed.
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { carStats } from '../car/stats.js';
import { store } from '../core/settings.js';
import { makeRng, clamp } from '../core/util.js';
import {
  CHAPTERS, EVENTS, BOSS_UNLOCK_WINS, START_CASH, MESSAGES, PERF_PARTS, PAINTS, NEONS,
  upgradesFor, uniformLevels, partPrice, TIER_UNLOCK, RESALE, DEALER_CLASS_UNLOCK, GARAGE_SLOTS,
} from './data.js';
import { RIM_NAMES, RIM_COLOR_NAMES } from '../car/model.js';

const KEY = 'story';
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function prFor(spec, up) {
  return Math.round(carStats(spec, up).rating * 1000);
}

class Story {
  constructor() { this.s = null; }

  // ---------------------------------------------------------------- save
  exists() { return !!store.load(KEY); }
  load() { this.s = store.load(KEY); return this.s; }
  save() { if (this.s) store.save(KEY, this.s); }
  reset() { store.remove(KEY); this.s = null; }
  start() {
    this.s = {
      v: 1, cash: START_CASH, chapter: 0, cars: [], active: null, events: {}, bosses: {},
      msgs: [], unread: 0, stats: { races: 0, wins: 0, earned: 0 }, started: Date.now(), finished: false, uid: 1,
    };
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

  addCar(id, look = {}) {
    const car = { uid: this.s.uid++, id, levels: {}, owned: {}, look: { ...look }, bought: Date.now(), partsValue: 0 };
    this.s.cars.push(car);
    this.s.active = car.uid;
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

  value(car) { return Math.round((this.spec(car).price * RESALE + car.partsValue * 0.4) / 50) * 50; }

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

  // ---------------------------------------------------------------- events
  events(ch = this.s.chapter) { return EVENTS.filter((e) => e.ch === ch); }
  winsIn(ch) { return EVENTS.filter((e) => e.ch === ch && !e.boss && this.s.events[e.id]?.won).length; }
  bossOpen(ch) { return this.winsIn(ch) >= BOSS_UNLOCK_WINS; }
  status(ev) {
    if (ev.ch > this.s.chapter) return 'locked';
    if (ev.boss && !this.bossOpen(ev.ch)) return 'locked';
    const r = this.s.events[ev.id];
    if (r?.won) return 'won';
    if (r) return 'raced';
    return 'open';
  }

  /** The grid for an event: crew members in cars tuned to the event's rating. */
  rivals(ev) {
    const tries = this.s.events[ev.id]?.tries || 0;
    const key = `${ev.id}:${tries}`;
    this._riv = this._riv || new Map();
    if (!this._riv.has(key)) this._riv.set(key, this._makeRivals(ev, tries));
    return this._riv.get(key);
  }

  _makeRivals(ev, tries) {
    const ch = CHAPTERS[ev.ch];
    if (ev.boss) {
      const b = ch.boss;
      const spec = CAR_BY_ID[b.car];
      return [{ spec, look: b.look, upgrades: upgradesFor(uniformLevels(b.tier), spec), name: b.name, skill: b.skill, boss: true }];
    }
    if (!ev.rivals || ev.type === 'timeattack') return [];
    const rng = makeRng(ev.id + ':' + tries);
    const names = ch.members.slice().sort(() => rng() - 0.5);
    const baseSkill = [0.66, 0.72, 0.78, 0.83, 0.87][ev.ch] ?? 0.8;
    const out = [];
    for (let k = 0; k < ev.rivals; k++) {
      const target = ev.pr + (rng() - 0.5) * 30;
      // every pool car at the tier that lands closest to the target
      const cands = ch.pool.map((id) => {
        const spec = CAR_BY_ID[id];
        let best = null;
        for (let t = 0; t <= 3; t++) {
          const pr = prFor(spec, upgradesFor(uniformLevels(t), spec));
          const d = Math.abs(pr - target) + (pr > target + 25 ? 60 : 0);
          if (!best || d < best.d) best = { spec, t, pr, d };
        }
        return best;
      }).sort((a, b) => a.d - b.d);
      const pick = cands[Math.min(cands.length - 1, Math.floor(rng() * Math.min(3, cands.length)))];
      out.push({
        spec: pick.spec, upgrades: upgradesFor(uniformLevels(pick.t), pick.spec), pr: pick.pr,
        look: streetLook(rng, ev.ch), name: names[k % names.length],
        skill: clamp(baseSkill + (k / Math.max(1, ev.rivals - 1) - 0.5) * 0.12, 0.4, 0.98),
      });
    }
    return out;
  }

  rivalPR(ev) {
    const r = this.rivals(ev);
    if (!r.length) return 0;
    return Math.round(r.reduce((s, x) => s + (x.pr ?? prFor(x.spec, x.upgrades)), 0) / r.length);
  }

  /** Apply a finished race. Returns a summary for the results card. */
  applyResult(ev, res) {
    const s = this.s;
    const rec = (s.events[ev.id] = s.events[ev.id] || { tries: 0, best: null, won: false });
    rec.tries++;
    s.stats.races++;
    let place = res.place;
    let won;
    if (ev.type === 'timeattack') {
      won = res.beat ?? !!(res.bestLap && res.target && res.bestLap <= res.target);
      place = won ? 1 : null;
    } else {
      won = place === 1 && !res.out;
    }
    if (place && (rec.best === null || place < rec.best)) rec.best = place;
    const share = won ? 1 : place === 2 && ev.type !== 'drag' && !ev.boss ? 0.45 : place === 3 && !ev.boss ? 0.2 : 0;
    // repeat wins pay a quarter: no farming the first event forever
    const firstWin = won && !rec.won;
    const pay = Math.round(ev.prize * share * (rec.won ? 0.25 : 1) / 50) * 50;
    s.cash += pay;
    s.stats.earned += pay;
    if (won) { s.stats.wins++; rec.won = true; }
    const out = { place, won, pay, firstWin, newMessages: 0, bossUnlocked: false, chapterUp: false, finished: false };
    const before = s.msgs.length;
    if (!ev.boss && firstWin && this.bossOpen(ev.ch) && !s.events[`boss:${ev.ch}:called`]) {
      s.events[`boss:${ev.ch}:called`] = true;
      out.bossUnlocked = true;
      this.message(`boss:${ev.ch}`);
    }
    if (ev.boss && firstWin) {
      s.bosses[ev.ch] = true;
      if (ev.ch === CHAPTERS.length - 1) {
        s.finished = true;
        out.finished = true;
        this.message('end');
      } else {
        s.chapter = Math.max(s.chapter, ev.ch + 1);
        out.chapterUp = true;
        this.message(`beat:${ev.ch}`);
      }
    }
    out.newMessages = s.msgs.length - before;
    this.save();
    this.lastSummary = { ev: ev.id, ...out };
    return out;
  }

  // ---------------------------------------------------------------- phone
  message(trigger) {
    for (const m of MESSAGES) {
      if (m.trigger !== trigger) continue;
      if (this.s.msgs.some((x) => x.id === m.id)) continue;
      this.s.msgs.push({ id: m.id, t: Date.now(), read: false });
      this.s.unread++;
    }
  }
  inbox() {
    return this.s.msgs.map((x) => ({ ...MESSAGES.find((m) => m.id === x.id), ...x })).filter((m) => m.text);
  }
  markRead() {
    for (const m of this.s.msgs) m.read = true;
    this.s.unread = 0;
    this.save();
  }
}

/** Street-racer flavor for rival cars: paint, maybe vinyl, rims, wing, glow. */
function streetLook(rng, ch) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const look = { paint: pick(PAINTS), finish: pick(['gloss', 'metallic', 'metallic', 'pearl', 'candy']) };
  if (rng() < 0.45 + ch * 0.08) { look.vinyl = pick(['stripes', 'side', 'twotone', 'flames', 'tribal', 'number', 'checker', 'sponsor', 'splash', 'kanji']); look.paint2 = pick(PAINTS); }
  if (rng() < 0.6) { look.rims = pick(RIM_NAMES); look.rimColor = pick(RIM_COLOR_NAMES); }
  if (rng() < 0.35 + ch * 0.1) look.kit = pick(['street', 'race', 'wide']);
  if (rng() < 0.3 + ch * 0.1) look.spoiler = pick(['lip', 'ducktail', 'gt', 'big', 'evo']);
  if (rng() < 0.25) look.neon = pick(NEONS.filter(Boolean));
  if (rng() < 0.4) look.ride = pick([0.35, 0.7]);
  look.number = 1 + Math.floor(rng() * 98);
  return look;
}

export const story = new Story();
export { CHAPTERS, EVENTS, CARS };
