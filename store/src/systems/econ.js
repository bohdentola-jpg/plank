// The rules of the Drip Line. Tokens are the only currency: you earn them by
// showing up and playing, and spend them on wearable items, capsules and
// streak freezes. UI listens with on('tokens' | 'item' | 'equip' | ...).
import { load, save } from './save.js';
import * as D from './daily.js';
import { ITEMS, itemById, RARITIES, RARITY_ORDER, SLOTS, SHOPS, STARTERS } from '../data/items.js';
import {
  CAPSULES, TICKETS, PRISMATIC_CHANCE, SHOP_PRISMATIC_CHANCE, FREEZE_COST, DROP_DISCOUNT,
  STREAK, MILESTONES, JOBS, JOBS_BONUS, PASSWORDS, HEADLINES,
} from '../data/content.js';

const listeners = {};
export function on(evt, fn) { (listeners[evt] ||= []).push(fn); }
export function emit(evt, data) {
  for (const fn of listeners[evt] || []) fn(data);
  for (const fn of listeners['*'] || []) fn(evt, data);
}

export const S = load();
export const commit = (now) => save(S, now);

export const CARS = ['front', 'threads', 'kicks', 'lids', 'ice', 'arcade', 'capsules'];
export const SHOP_CARS = ['threads', 'kicks', 'lids', 'ice'];

function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weighted(table, r) {
  const entries = Object.entries(table).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [k, w] of entries) {
    x -= w;
    if (x <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------- days

export function freshDay(key) {
  const r = D.dayRng('jobs', key);
  return {
    key,
    jobs: shuffle(JOBS, r).slice(0, 3).map((j) => ({ id: j.id, progress: 0, done: false, uniq: [] })),
    jobsHeard: false, jobsClaimed: false,
    pickups: [], rewarded: {}, cupsWins: 0, clawWon: [],
    freePull: true, lockbox: false, ghostTicketUsed: false,
    ghostDay: D.dayRng('ghostday', key)() < 0.15,
  };
}

export function ensureDay() {
  const key = D.dayKey();
  if (S.day && S.day.key === key) return false;
  S.day = freshDay(key);
  const w = D.weekIndex();
  if (S.week.idx !== w) S.week = { idx: w, vault: false, heard: false };
  stockCache = {};
  commit();
  emit('day', key);
  return true;
}

// ---------------------------------------------------------------- tokens

export function addTokens(n, why = '') {
  if (!n) return;
  S.tokens += n;
  if (n > 0) S.lifetime += n;
  commit();
  emit('tokens', { n, why });
}

export function spend(n, why = 'spend') {
  if (S.tokens < n) return false;
  S.tokens -= n;
  commit();
  emit('tokens', { n: -n, why });
  return true;
}

// ---------------------------------------------------------------- inventory

export const owns = (id) => !!S.owned[id];
export const isPrismatic = (id) => !!(S.owned[id] && S.owned[id].prismatic);

// Give the player an item. Duplicates become tokens, unless the copy is
// prismatic and the owned one isn't — then it upgrades.
export function grant(id, o = {}) {
  const item = itemById[id];
  if (!item) return null;
  const have = S.owned[id];
  const res = { item, prismatic: !!o.prismatic, isNew: false, upgraded: false, scrap: 0 };
  if (!have) {
    S.owned[id] = { n: 1, prismatic: !!o.prismatic, at: Date.now() };
    res.isNew = true;
    if (!S.fresh.includes(id)) S.fresh.push(id);
  } else if (o.prismatic && !have.prismatic) {
    have.prismatic = true;
    have.n += 1;
    res.upgraded = true;
    if (!S.fresh.includes(id)) S.fresh.push(id);
  } else {
    have.n += 1;
    res.scrap = RARITIES[item.rarity].scrap * (o.prismatic ? 2 : 1);
    S.tokens += res.scrap;
    S.lifetime += res.scrap;
    emit('tokens', { n: res.scrap, why: 'scrap' });
  }
  commit();
  emit('item', res);
  return res;
}

export function equip(slot, id) {
  if (!SLOTS.includes(slot)) return false;
  if (id && (!owns(id) || itemById[id].slot !== slot)) return false;
  if (S.equipped[slot] === id) return true;
  S.equipped[slot] = id || null;
  if (id) track('equip', id);
  commit();
  emit('equip', { slot, id });
  return true;
}

export function markSeen(ids) {
  S.fresh = S.fresh.filter((x) => !ids.includes(x));
  commit();
}

// art specs for drawFigure, with the prismatic flag folded in
export function outfitOf(equipped = S.equipped, extra = null) {
  const out = {};
  for (const slot of SLOTS) {
    let id = equipped[slot];
    if (extra && extra.slot === slot) id = extra.id;
    if (!id || !itemById[id]) continue;
    const prism = extra && extra.slot === slot ? !!extra.prismatic : isPrismatic(id);
    out[slot] = prism ? { ...itemById[id].art, prismatic: true } : itemById[id].art;
  }
  return out;
}

export function dripScore(equipped = S.equipped) {
  let n = 0;
  for (const slot of SLOTS) {
    const id = equipped[slot];
    if (!id || !itemById[id]) continue;
    n += RARITIES[itemById[id].rarity].points * (isPrismatic(id) ? 2 : 1);
  }
  return n * 10;
}

export function collection() {
  const by = Object.fromEntries(RARITY_ORDER.map((r) => [r, [0, 0]]));
  let owned = 0, prismatic = 0;
  for (const it of ITEMS) {
    by[it.rarity][1]++;
    if (S.owned[it.id]) {
      owned++;
      by[it.rarity][0]++;
      if (S.owned[it.id].prismatic) prismatic++;
    }
  }
  return { total: ITEMS.length, owned, prismatic, by };
}

export function rarest(equipped = S.equipped) {
  let best = null;
  for (const slot of SLOTS) {
    const id = equipped[slot];
    if (!id) continue;
    const it = itemById[id];
    if (!best || RARITIES[it.rarity].rank > RARITIES[best.rarity].rank) best = it;
  }
  return best;
}

export function setProfile(p) {
  const first = !S.profile;
  S.profile = { name: p.name, body: { ...p.body } };
  if (first) {
    for (const id of STARTERS) {
      if (!S.owned[id]) S.owned[id] = { n: 1, prismatic: false, at: Date.now() };
      const slot = itemById[id].slot;
      if (!S.equipped[slot]) S.equipped[slot] = id;
    }
  }
  commit(true);
  emit('profile', S.profile);
}

// ---------------------------------------------------------------- daily shop stock

let stockCache = {};

// The day's rotation for one shop car: four everyday pieces, one rare, and a
// featured slot that can roll epic or legendary. Seeded by the date.
function rollStock(shopId) {
  const r = D.dayRng(`stock:${shopId}`, S.day.key);
  const pool = ITEMS.filter((i) => i.shop === shopId && i.price != null);
  const by = (rar) => pool.filter((i) => i.rarity === rar);
  const chosen = [];
  const take = (list) => {
    const left = list.filter((i) => !chosen.includes(i));
    if (!left.length) return null;
    const it = left[Math.floor(r() * left.length)];
    chosen.push(it);
    return it;
  };
  for (let k = 0; k < 4; k++) take(r() < 0.6 ? by('common') : by('uncommon')) || take(by('common')) || take(by('uncommon'));
  take(by('rare')) || take(by('uncommon'));
  const fr = r();
  const featured = take(by(fr < 0.12 ? 'legendary' : fr < 0.5 ? 'epic' : 'rare')) || take(by('epic')) || take(by('rare'));
  return { chosen, featured };
}

export function stock(shopId) {
  ensureDay();
  if (stockCache[shopId]) return stockCache[shopId];
  const { chosen, featured } = rollStock(shopId);
  const drop = dropOfDay();
  const out = chosen.map((item) => {
    const isDrop = !!drop.item && drop.item.id === item.id;
    const price = isDrop ? Math.round((item.price * (100 - DROP_DISCOUNT)) / 100) : item.price;
    return { item, price, was: isDrop ? item.price : null, pct: isDrop ? DROP_DISCOUNT : 0, featured: item === featured, drop: isDrop };
  });
  stockCache[shopId] = out;
  return out;
}

// One shop's featured item is the drop of the day, 25% off.
let dropCache = null;
export function dropOfDay() {
  ensureDay();
  if (dropCache && dropCache.key === S.day.key) return dropCache;
  const r = D.dayRng('drop', S.day.key);
  const shopId = SHOP_CARS[Math.floor(r() * SHOP_CARS.length)];
  dropCache = { key: S.day.key, shop: shopId, item: rollStock(shopId).featured };
  return dropCache;
}

export function secretStock(kind) {
  ensureDay();
  return ITEMS.filter((i) => (kind === 'vault' ? i.vault : i.ghost)).map((item) => ({ item, price: item.price, was: null, pct: 0, featured: item.rarity === 'mythic' }));
}

export function buy(id, price) {
  const item = itemById[id];
  if (!item || price == null) return { err: 'That isn’t for sale.' };
  if (owns(id)) return { err: 'You already own this one.' };
  if (S.tokens < price) return { err: `You need ${(price - S.tokens).toLocaleString('en-US')} more tokens.` };
  spend(price, 'buy');
  const prismatic = Math.random() < SHOP_PRISMATIC_CHANCE;
  const res = grant(id, { prismatic, src: 'shop' });
  track('buy');
  return { ok: true, ...res };
}

// ---------------------------------------------------------------- capsules

export const freePullReady = () => { ensureDay(); return !!S.day.freePull; };

function rollRarity(odds, r) {
  return weighted(odds, r);
}

function poolFor(rarity) {
  return ITEMS.filter((i) => i.capsule && i.rarity === rarity);
}

// how = 'basic' | 'deluxe' | 'free' | 'ticket:basic' | 'ticket:epic' | 'ticket:legendary'
export function pull(how) {
  ensureDay();
  let machine = 'basic', odds;
  if (how === 'free') {
    if (!S.day.freePull) return { err: 'Your free pull is used. Come back tomorrow.' };
    S.day.freePull = false;
    odds = CAPSULES.basic.odds;
  } else if (how.startsWith('ticket:')) {
    const kind = how.slice(7);
    if (!S.tickets[kind]) return { err: 'You don’t have that ticket.' };
    S.tickets[kind] -= 1;
    odds = TICKETS[kind].odds;
    machine = kind === 'basic' ? 'basic' : 'ticket';
  } else {
    const cap = CAPSULES[how];
    if (!cap) return { err: 'No such machine.' };
    if (!spend(cap.cost, 'capsule')) return { err: `You need ${(cap.cost - S.tokens).toLocaleString('en-US')} more tokens.` };
    machine = how;
    odds = cap.odds;
  }
  const r = Math.random;
  let rarity = rollRarity(odds, r);
  // pity: count pulls without a hit and force one at the threshold
  if (machine === 'basic' || machine === 'deluxe') {
    const p = CAPSULES[machine].pity;
    const hit = RARITIES[rarity].rank >= RARITIES[p.min].rank;
    if (hit) S.pity[machine] = 0;
    else {
      S.pity[machine] += 1;
      if (S.pity[machine] >= p.at) {
        S.pity[machine] = 0;
        rarity = p.min;
      }
    }
  }
  let pool = poolFor(rarity);
  if (!pool.length) pool = poolFor('rare');
  const item = pool[Math.floor(r() * pool.length)];
  const prismatic = r() < PRISMATIC_CHANCE;
  S.pulls += 1;
  const res = grant(item.id, { prismatic, src: 'capsule' });
  track('capsule');
  commit();
  return { ok: true, machine, rarity, ...res };
}

export function pityLeft(machine) {
  const p = CAPSULES[machine].pity;
  return p.at - (S.pity[machine] || 0);
}

// ---------------------------------------------------------------- streak

export function canCheckIn() {
  ensureDay();
  return S.streak.last !== S.day.key;
}

export function streakPreview() {
  ensureDay();
  const st = S.streak, key = S.day.key;
  if (!st.last) return { next: 1, broken: false, freezesNeeded: 0 };
  const gap = D.daysBetween(st.last, key);
  if (gap <= 0) return { next: st.count, broken: false, freezesNeeded: 0, done: true };
  if (gap === 1) return { next: st.count + 1, broken: false, freezesNeeded: 0 };
  const missed = gap - 1;
  if (st.freezes >= missed) return { next: st.count + 1, broken: false, freezesNeeded: missed };
  return { next: 1, broken: st.count > 0, freezesNeeded: missed };
}

export function checkIn(perfect = false) {
  ensureDay();
  const key = S.day.key, st = S.streak;
  if (st.last === key) return null;
  const pv = streakPreview();
  if (!pv.broken && pv.freezesNeeded) st.freezes -= pv.freezesNeeded;
  st.count = pv.next;
  st.last = key;
  st.best = Math.max(st.best, st.count);
  S.checkins.push(key);
  if (S.checkins.length > 60) S.checkins.splice(0, S.checkins.length - 60);
  const dayIdx = (st.count - 1) % 7;
  const R = STREAK[dayIdx];
  const out = {
    day: dayIdx + 1, count: st.count, tokens: R.tokens + (perfect ? 10 : 0), perfect,
    tickets: [], items: [], key: false, usedFreezes: pv.broken ? 0 : pv.freezesNeeded, broke: pv.broken,
  };
  addTokens(out.tokens, 'checkin');
  if (R.ticket) {
    S.tickets[R.ticket] += 1;
    out.tickets.push(R.ticket);
  }
  const M = MILESTONES[st.count];
  if (M && !S.milestones[st.count]) {
    S.milestones[st.count] = true;
    if (M.ticket) {
      S.tickets[M.ticket] += 1;
      out.tickets.push(M.ticket);
    }
    if (M.item) {
      grant(M.item, { src: 'milestone' });
      out.items.push(M.item);
    }
  }
  if (st.count >= 7 && !S.keys.cab) {
    S.keys.cab = true;
    out.key = true;
  }
  commit();
  emit('streak', out);
  return out;
}

export function buyFreeze() {
  if (S.streak.freezes >= 2) return { err: 'You can hold 2 streak freezes at most.' };
  if (!spend(FREEZE_COST, 'freeze')) return { err: `A freeze costs ${FREEZE_COST} tokens.` };
  S.streak.freezes += 1;
  commit();
  emit('freeze');
  return { ok: true };
}

export function nextMilestone() {
  const n = S.streak.count;
  const days = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b);
  const next = days.find((d) => d > n);
  return next ? { day: next, left: next - n, reward: MILESTONES[next] } : null;
}

// ---------------------------------------------------------------- jobs

export const jobDef = (id) => JOBS.find((j) => j.id === id);
const GRADES = ['D', 'C', 'B', 'A', 'S'];

export function jobs() {
  ensureDay();
  return S.day.jobs.map((j) => ({ ...j, def: jobDef(j.id) }));
}

export function track(event, value = 1, meta = null) {
  ensureDay();
  let changed = false;
  for (const j of S.day.jobs) {
    const def = jobDef(j.id);
    if (!def || j.done || def.event !== event) continue;
    if (def.min && GRADES.indexOf(meta) < GRADES.indexOf(def.min)) continue;
    if (def.unique) {
      if (j.uniq.includes(value)) continue;
      j.uniq.push(value);
      j.progress = j.uniq.length;
    } else if (def.mode === 'max') j.progress = Math.max(j.progress, value);
    else j.progress += value;
    if (j.progress >= def.goal) {
      j.progress = def.goal;
      j.done = true;
      addTokens(def.reward, 'job');
      emit('job', { j, def });
    }
    changed = true;
  }
  if (changed) {
    commit();
    emit('jobs');
    if (allJobsDone()) emit('jobsAll');
  }
}

export const allJobsDone = () => !!S.day && S.day.jobs.every((j) => j.done);

export function claimJobsBonus() {
  if (!allJobsDone() || S.day.jobsClaimed) return null;
  S.day.jobsClaimed = true;
  S.tickets.basic += 1;
  S.week.heard = true;
  addTokens(JOBS_BONUS, 'jobs');
  commit();
  return { tokens: JOBS_BONUS, ticket: 'basic', password: weekPassword() };
}

// ---------------------------------------------------------------- loose change

export function pickups(car, spotCount = 8) {
  ensureDay();
  if (!CARS.includes(car)) return [];
  const r = D.dayRng(`change:${car}`, S.day.key);
  const spots = shuffle([...Array(spotCount).keys()], r);
  const n = 1 + (r() < 0.5 ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: `${car}:${i}`, spot: spots[i], value: 10 });
  const goldCar = CARS[Math.floor(D.dayRng('goldcoin', S.day.key)() * CARS.length)];
  if (goldCar === car) out.push({ id: `${car}:gold`, spot: spots[n], value: 50, big: true });
  return out.filter((p) => !S.day.pickups.includes(p.id));
}

export function collect(p) {
  if (S.day.pickups.includes(p.id)) return;
  S.day.pickups.push(p.id);
  if (p.big && !S.secrets.change) S.secrets.change = true;
  addTokens(p.value, 'pickup');
  track('pickup', 1);
}

// ---------------------------------------------------------------- minigames

export const GAME_CAP = 3;
export function rewardsLeft(game) {
  ensureDay();
  return Math.max(0, GAME_CAP - (S.day.rewarded[game] || 0));
}
export function gameReward(game, tokens) {
  ensureDay();
  if (tokens <= 0 || rewardsLeft(game) <= 0) return 0;
  S.day.rewarded[game] = (S.day.rewarded[game] || 0) + 1;
  addTokens(tokens, game);
  return tokens;
}

export function achieve(id) {
  if (S.achievements[id]) return null;
  S.achievements[id] = true;
  const item = ITEMS.find((i) => i.secret === id);
  commit();
  return item ? grant(item.id, { src: 'achievement' }) : null;
}

// ---------------------------------------------------------------- the claw

const CLAW_KINDS = ['tokens', 'tokens', 'tokens', 'tokens', 'ticket', 'ticket', 'item', 'item', 'item', 'freeze'];

export function clawPrizes() {
  ensureDay();
  const r = D.dayRng('claw', S.day.key);
  const prizes = [];
  for (let i = 0; i < 11; i++) {
    const kind = CLAW_KINDS[Math.floor(r() * CLAW_KINDS.length)];
    const layer = i < 7 ? 0 : 1;
    const x = layer === 0 ? 0.07 + i * 0.143 + (r() - 0.5) * 0.03 : 0.16 + (i - 7) * 0.22 + (r() - 0.5) * 0.05;
    prizes.push({ i, kind, x, y: layer * 0.55 + r() * 0.08, layer });
  }
  if (!S.keys.cab) prizes[8 + Math.floor(r() * 3)].kind = 'key';
  if (!S.ghostTicket && r() < 0.5) prizes[Math.floor(r() * 7)].kind = 'rare';
  return prizes.filter((p) => !S.day.clawWon.includes(p.i));
}

export function clawWin(i) {
  const prize = clawPrizes().find((p) => p.i === i);
  if (!prize) return null;
  S.day.clawWon.push(i);
  const out = { kind: prize.kind };
  switch (prize.kind) {
    case 'tokens': out.tokens = 40; addTokens(40, 'claw'); out.label = '+40 TOKENS'; break;
    case 'ticket': S.tickets.basic += 1; out.label = 'CAPSULE TICKET'; emit('ticket'); break;
    case 'item': {
      const pool = ITEMS.filter((it) => it.capsule && (it.rarity === 'common' || it.rarity === 'uncommon') && !owns(it.id));
      if (pool.length) {
        const it = pool[Math.floor(Math.random() * pool.length)];
        grant(it.id, { src: 'claw' });
        out.item = it.id;
        out.label = it.name.toUpperCase();
      } else {
        addTokens(60, 'claw');
        out.tokens = 60;
        out.label = '+60 TOKENS';
      }
      break;
    }
    case 'freeze':
      if (S.streak.freezes < 2) { S.streak.freezes += 1; out.label = 'STREAK FREEZE'; emit('freeze'); }
      else { addTokens(60, 'claw'); out.tokens = 60; out.label = '+60 TOKENS'; }
      break;
    case 'key': S.keys.cab = true; out.label = 'CAB KEY'; break;
    case 'rare': S.ghostTicket = true; out.label = 'GHOST TICKET'; break;
    default: break;
  }
  commit();
  track('win:claw');
  emit('claw', out);
  return out;
}

// ---------------------------------------------------------------- secrets

export function weekPassword() {
  const n = PASSWORDS.length;
  return PASSWORDS[((D.weekIndex() % n) + n) % n];
}
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
export const checkPassword = (s) => norm(s) === norm(weekPassword().word);

export function openVault() {
  S.week.vault = true;
  const first = discover('vault');
  if (first) addTokens(200, 'secret');
  commit();
  return first;
}

// The ghost car is coupled on: some days at random, all through the midnight
// hour, or for the rest of the day after you use a ghost ticket.
export function ghostOpen() {
  ensureDay();
  return D.isMidnightHour() || S.day.ghostDay || S.day.ghostTicketUsed;
}

export function useGhostTicket() {
  if (!S.ghostTicket) return false;
  S.ghostTicket = false;
  S.day.ghostTicketUsed = true;
  commit();
  return true;
}

export function discover(which) {
  if (S.secrets[which]) return false;
  S.secrets[which] = true;
  commit();
  emit('secret', which);
  return true;
}

export function openLockbox() {
  ensureDay();
  if (S.day.lockbox) return null;
  S.day.lockbox = true;
  const out = { tokens: 60 + Math.floor(Math.random() * 61), item: null };
  addTokens(out.tokens, 'lockbox');
  if (!S.achievements.cab) out.item = achieve('cab');
  else if (Math.random() < 0.05) {
    const pool = ITEMS.filter((i) => i.capsule && (i.rarity === 'rare' || i.rarity === 'epic'));
    out.item = grant(pool[Math.floor(Math.random() * pool.length)].id, { src: 'lockbox' });
  }
  commit();
  return out;
}

// ---------------------------------------------------------------- news

export function headlines() {
  ensureDay();
  const r = D.dayRng('news', S.day.key);
  const drop = dropOfDay();
  const out = [];
  if (drop.item) out.push(`DROP OF THE DAY: ${drop.item.name}, ${DROP_DISCOUNT}% off in ${SHOPS[drop.shop].name}`);
  for (const sid of SHOP_CARS) {
    const big = stock(sid).find((s) => s.featured && (s.item.rarity === 'legendary' || s.item.rarity === 'epic'));
    if (big && (!drop.item || big.item.id !== drop.item.id)) out.push(`${RARITIES[big.item.rarity].name} IN STOCK: ${big.item.name} at ${SHOPS[sid].name}, today only`);
  }
  if (ghostOpen()) out.push('Riders report the ghost car is coupled to the back of the train tonight');
  const fun = shuffle(HEADLINES, r).slice(0, 5);
  const mixed = [];
  for (let i = 0; i < Math.max(out.length, fun.length); i++) {
    if (out[i]) mixed.push(out[i]);
    if (fun[i]) mixed.push(fun[i]);
  }
  return mixed;
}
