// The rules of the underground: tokens, streaks, the Operator's jobs, daily
// deals, floor tokens, stickers, coupons, the claw pit, the bag and orders.
// UI listens with on('tokens' | 'bag' | 'sticker' | ...).
import { load, save } from './save.js';
import * as D from './daily.js';
import { PRODUCTS, productById, SHOPS } from '../data/catalog.js';
import {
  STICKERS, stickerById, STICKER_PAGES, MISSIONS, STREAK_REWARDS, EXCHANGE, PASSWORDS, HEADLINES,
} from '../data/content.js';
import { CONFIG } from '../config.js';
import { SCENES } from '../world/scenes.js';

const listeners = {};
export function on(evt, fn) { (listeners[evt] ||= []).push(fn); }
export function emit(evt, data) {
  for (const fn of listeners[evt] || []) fn(data);
  for (const fn of listeners['*'] || []) fn(evt, data);
}

export const S = load();
export const commit = (now) => save(S, now);
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- days

function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollMissions(key) {
  const r = D.dayRng('missions', key);
  return shuffle(MISSIONS, r).slice(0, 3).map((m) => ({ id: m.id, progress: 0, done: false, uniq: [] }));
}

export function freshDay(key) {
  return {
    key, missions: rollMissions(key), clawWon: [], pickups: [], rewarded: {}, cupsWins: 0,
    opHeard: false, opClaimed: false, crack: false, petted: false, tipped: false, ghostRolls: 0,
  };
}

// Call often: rolls the day over at midnight.
export function ensureDay() {
  const key = D.dayKey();
  if (S.day && S.day.key === key) return false;
  S.day = freshDay(key);
  const w = D.weekIndex();
  if (S.week.idx !== w) S.week = { idx: w, backroom: false };
  dealCache = null;
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

export function spend(n) {
  if (S.tokens < n) return false;
  S.tokens -= n;
  commit();
  emit('tokens', { n: -n, why: 'spend' });
  return true;
}

// ---------------------------------------------------------------- streak

export function canCheckIn() {
  ensureDay();
  return S.streak.last !== S.day.key;
}

// What happens to the streak if you swipe today (for the booth UI).
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
  st.freezes -= pv.freezesNeeded > 0 && !pv.broken ? pv.freezesNeeded : 0;
  st.count = pv.next;
  st.last = key;
  st.best = Math.max(st.best, st.count);
  S.checkins.push(key);
  if (S.checkins.length > 60) S.checkins.splice(0, S.checkins.length - 60);
  const dayIdx = (st.count - 1) % 7;
  const R = STREAK_REWARDS[dayIdx];
  const out = {
    day: dayIdx + 1, count: st.count, tokens: R.tokens + (perfect ? 5 : 0), perfect,
    stickers: [], key: false, usedFreezes: pv.broken ? 0 : pv.freezesNeeded, broke: pv.broken,
  };
  addTokens(out.tokens, 'checkin');
  if (!S.stickers.shelly && addSticker('shelly')) out.stickers.push('shelly');
  if (R.sticker) {
    const sid = randomUnowned([R.sticker]);
    if (sid && addSticker(sid)) out.stickers.push(sid);
  }
  if (R.key && !S.keys.maint) {
    S.keys.maint = true;
    out.key = true;
  }
  if (dayIdx === 6) {
    st.cycles += 1;
    if (addSticker('goldtoken')) out.stickers.push('goldtoken');
  }
  commit();
  emit('streak', out);
  return out;
}

// ---------------------------------------------------------------- missions

export const missionDef = (id) => MISSIONS.find((m) => m.id === id);
const GRADES = ['D', 'C', 'B', 'A', 'S'];

export function missions() {
  ensureDay();
  return S.day.missions.map((m) => ({ ...m, def: missionDef(m.id) }));
}

export function track(event, value = 1, meta = null) {
  ensureDay();
  let changed = false;
  for (const m of S.day.missions) {
    const def = missionDef(m.id);
    if (!def || m.done || def.event !== event) continue;
    if (def.min && GRADES.indexOf(meta) < GRADES.indexOf(def.min)) continue;
    if (def.unique) {
      if (m.uniq.includes(value)) continue;
      m.uniq.push(value);
      m.progress = m.uniq.length;
    } else if (def.mode === 'max') m.progress = Math.max(m.progress, value);
    else m.progress += value;
    if (m.progress >= def.goal) {
      m.progress = def.goal;
      m.done = true;
      addTokens(def.reward, 'mission');
      emit('mission', { m, def });
    }
    changed = true;
  }
  if (changed) {
    commit();
    emit('missions');
    if (allMissionsDone()) emit('missionsAll');
  }
}

export const allMissionsDone = () => S.day && S.day.missions.every((m) => m.done);

// The phone rings when there's news: first call of the day, or all jobs done.
export function phoneRinging() {
  if (!S.day) return false;
  return !S.day.opHeard || (allMissionsDone() && !S.day.opClaimed);
}

export function claimOperatorBonus() {
  if (!allMissionsDone() || S.day.opClaimed) return null;
  S.day.opClaimed = true;
  addTokens(50, 'jobs');
  const sid = randomUnowned(['street', 'under']);
  if (sid) addSticker(sid);
  commit();
  return { tokens: 50, sticker: sid };
}

// ---------------------------------------------------------------- deals

let dealCache = null;
export function deals() {
  ensureDay();
  if (dealCache && dealCache.key === S.day.key) return dealCache;
  const r = D.dayRng('deals', S.day.key);
  const pool = shuffle(PRODUCTS.filter((p) => !SHOPS[p.shop].secret), r);
  const pcts = shuffle([15, 20, 25], r);
  const map = {};
  const dotd = { product: pool[0], pct: 40 };
  map[pool[0].id] = 40;
  const list = [1, 2, 3].map((i, k) => {
    map[pool[i].id] = pcts[k];
    return { product: pool[i], pct: pcts[k] };
  });
  for (const shop of Object.keys(SHOPS).filter((s) => SHOPS[s].secret)) {
    const items = PRODUCTS.filter((p) => p.shop === shop);
    const pick = items[Math.floor(r() * items.length)];
    map[pick.id] = 20;
    list.push({ product: pick, pct: 20, secret: true });
  }
  dealCache = { key: S.day.key, dotd, list, map };
  return dealCache;
}

export function priceOf(p) {
  const pct = deals().map[p.id] || 0;
  if (!pct) return { price: p.price, was: null, pct: 0 };
  return { price: round2(p.price * (1 - pct / 100)), was: p.price, pct };
}

export function stockLeft(p) {
  if (p.stock == null) return null;
  return Math.max(0, p.stock - (S.sold[p.id] || 0));
}

export function shopUnlocked(shopId) {
  const sh = SHOPS[shopId];
  if (!sh.secret) return true;
  return { backroom: S.secrets.backroom, sewer: S.secrets.sewer, ghost: S.secrets.ghost }[shopId];
}

export function headlines() {
  ensureDay();
  const d = deals();
  const r = D.dayRng('news', S.day.key);
  const dealLines = d.list.filter((x) => !x.secret).map((x) => `${x.product.name} is ${x.pct}% off today at ${SHOPS[x.product.shop].name}`);
  const fun = shuffle(HEADLINES, r).slice(0, 5);
  const out = [`DEAL OF THE DAY: ${d.dotd.product.name}, ${d.dotd.pct}% off at ${SHOPS[d.dotd.product.shop].name}`];
  for (let i = 0; i < Math.max(dealLines.length, fun.length); i++) {
    if (fun[i]) out.push(fun[i]);
    if (dealLines[i]) out.push(dealLines[i]);
  }
  return out;
}

// ---------------------------------------------------------------- floor tokens

export function pickups(sceneId) {
  ensureDay();
  const def = SCENES[sceneId];
  const r = D.dayRng(`pick:${sceneId}`, S.day.key);
  const n = def.secret ? 3 : 5;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = def.minX + 120 + r() * (def.maxX - def.minX - 240);
    out.push({ id: `${sceneId}:${i}`, x, h: r() < 0.4 ? 66 : 0, value: 5 });
  }
  const main = ['token', 'drip', 'bodega'];
  const bigIn = main[Math.floor(D.dayRng('bigtoken', S.day.key)() * 3)];
  if (bigIn === sceneId) {
    out.push({ id: `${sceneId}:big`, x: def.minX + 200 + r() * (def.maxX - def.minX - 400), h: 78, value: 25, big: true });
  }
  return out.filter((p) => !S.day.pickups.includes(p.id));
}

export function collect(p) {
  if (S.day.pickups.includes(p.id)) return;
  S.day.pickups.push(p.id);
  addTokens(p.value, 'pickup');
  track('pickup', 1);
}

// ---------------------------------------------------------------- stickers

export function addSticker(id) {
  if (!stickerById[id]) return false;
  const isNew = !S.stickers[id];
  S.stickers[id] = (S.stickers[id] || 0) + 1;
  commit();
  emit('sticker', { id, isNew });
  checkPages();
  return isNew;
}

export function randomUnowned(pages) {
  const pool = STICKERS.filter((s) => pages.includes(s.page) && !S.stickers[s.id]);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function stickerCount() { return STICKERS.filter((s) => S.stickers[s.id]).length; }

function checkPages() {
  for (const page of STICKER_PAGES) {
    if (S.pagesClaimed[page.id]) continue;
    const all = STICKERS.filter((s) => s.page === page.id).every((s) => S.stickers[s.id]);
    if (!all) continue;
    S.pagesClaimed[page.id] = true;
    if (page.reward.kind === 'golden') S.golden = true;
    else addCoupon(page.reward, `${page.name} page`);
    commit();
    emit('page', page);
  }
}

// ---------------------------------------------------------------- coupons + exchange

export function addCoupon(c, src = '') {
  const coupon = { id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, kind: c.kind, value: c.value, label: c.label, src };
  S.coupons.push(coupon);
  commit();
  emit('coupon', coupon);
  return coupon;
}

export function exchange(id) {
  const item = EXCHANGE.find((e) => e.id === id);
  if (!item) return { err: 'That deal is gone.' };
  if (item.freeze && S.streak.freezes >= 2) return { err: 'You can only hold 2 streak freezes.' };
  if (S.tokens < item.cost) return { err: `You need ${item.cost - S.tokens} more tokens.` };
  spend(item.cost);
  if (item.freeze) {
    S.streak.freezes += 1;
    commit();
    emit('freeze');
  } else addCoupon(item.coupon, 'Token Booth');
  return { ok: true, item };
}

// ---------------------------------------------------------------- claw machine

const CLAW_KINDS = ['tokens', 'tokens', 'tokens', 'tokens', 'sticker', 'sticker', 'sticker', 'coupon', 'coupon', 'freeze'];

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
  if (!S.keys.maint) prizes[8 + Math.floor(r() * 3)].kind = 'key';
  if (!S.ghostTicket && r() < 0.5) prizes[Math.floor(r() * 7)].kind = 'rare';
  return prizes.filter((p) => !S.day.clawWon.includes(p.i));
}

export function clawWin(i) {
  const prize = clawPrizes().find((p) => p.i === i);
  if (!prize) return null;
  S.day.clawWon.push(i);
  let out = { kind: prize.kind };
  switch (prize.kind) {
    case 'tokens': out.tokens = 30; addTokens(30, 'claw'); out.label = '+30 TOKENS'; break;
    case 'sticker': {
      const sid = randomUnowned(['street', 'under']);
      if (sid) { addSticker(sid); out.sticker = sid; out.label = `STICKER: ${stickerById[sid].name.toUpperCase()}`; }
      else { addTokens(40, 'claw'); out.tokens = 40; out.label = '+40 TOKENS'; }
      break;
    }
    case 'coupon': {
      const c = Math.random() < 0.5 ? { kind: 'off', value: 5, label: '$5 OFF' } : { kind: 'ship', value: 0, label: 'FREE SHIPPING' };
      addCoupon(c, 'The Grabber');
      out.label = `COUPON: ${c.label}`;
      break;
    }
    case 'freeze':
      if (S.streak.freezes < 2) { S.streak.freezes += 1; out.label = 'STREAK FREEZE'; }
      else { addTokens(40, 'claw'); out.tokens = 40; out.label = '+40 TOKENS'; }
      break;
    case 'key':
      S.keys.maint = true;
      out.label = 'MAINTENANCE KEY';
      break;
    case 'rare':
      S.ghostTicket = true;
      out.label = 'GHOST TICKET';
      break;
    default: break;
  }
  commit();
  track('win:claw');
  emit('claw', out);
  return out;
}

// ---------------------------------------------------------------- minigame rewards

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

// ---------------------------------------------------------------- secrets

export function weekPassword() {
  const n = PASSWORDS.length;
  return PASSWORDS[((D.weekIndex() % n) + n) % n];
}

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
export const checkPassword = (s) => norm(s) === norm(weekPassword().word);

export function rollGhost() {
  ensureDay();
  if (S.ghostTicket) {
    S.ghostTicket = false;
    commit();
    return true;
  }
  if (D.isMidnightHour()) return true;
  const r = D.dayRng(`ghost${S.day.ghostRolls++}`, S.day.key);
  commit();
  return r() < 0.12;
}

export function discover(which) {
  if (S.secrets[which]) return false;
  S.secrets[which] = true;
  commit();
  emit('secret', which);
  return true;
}

export function crackLoot() {
  ensureDay();
  if (!S.secrets.crack) {
    S.secrets.crack = true;
    S.day.crack = true;
    addTokens(100, 'crack');
    commit();
    return { first: true, tokens: 100 };
  }
  if (!S.day.crack) {
    S.day.crack = true;
    addTokens(15, 'crack');
    commit();
    return { first: false, tokens: 15 };
  }
  return null;
}

// ---------------------------------------------------------------- bag + orders

export function addToBag(pid, size, qty = 1) {
  const line = S.bag.find((l) => l.pid === pid && l.size === size);
  if (line) line.qty = Math.min(9, line.qty + qty);
  else S.bag.push({ pid, size, qty });
  commit();
  emit('bag');
  track('bag');
}

export function setQty(i, q) {
  if (!S.bag[i]) return;
  if (q <= 0) S.bag.splice(i, 1);
  else S.bag[i].qty = Math.min(9, q);
  commit();
  emit('bag');
}

export const bagCount = () => S.bag.reduce((a, l) => a + l.qty, 0);

export function totals(couponId = null) {
  let subtotal = 0, saved = 0;
  const lines = S.bag.map((l, i) => {
    const p = productById[l.pid];
    if (!p) return null;
    const pr = priceOf(p);
    subtotal += pr.price * l.qty;
    if (pr.was) saved += (pr.was - pr.price) * l.qty;
    return { i, p, size: l.size, qty: l.qty, price: pr.price, was: pr.was, pct: pr.pct, line: round2(pr.price * l.qty) };
  }).filter(Boolean);
  subtotal = round2(subtotal);
  const coupon = S.coupons.find((c) => c.id === couponId) || null;
  let discount = 0;
  let ship = subtotal === 0 || subtotal >= CONFIG.shipping.freeOver ? 0 : CONFIG.shipping.flat;
  if (S.golden) discount += subtotal * 0.1;
  if (coupon) {
    if (coupon.kind === 'pct') discount += (subtotal - discount) * (coupon.value / 100);
    else if (coupon.kind === 'off') discount += Math.min(coupon.value, subtotal - discount);
    else if (coupon.kind === 'ship') ship = 0;
  }
  discount = round2(discount);
  const total = round2(Math.max(0, subtotal - discount + ship));
  return { lines, subtotal, saved: round2(saved), discount, ship, total, coupon, golden: S.golden };
}

function orderNumber() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '3R-';
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return `${s}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export function placeOrder(couponId = null) {
  const t = totals(couponId);
  if (!t.lines.length) return null;
  const order = {
    id: orderNumber(), date: Date.now(),
    items: t.lines.map((l) => ({ pid: l.p.id, name: l.p.name, size: l.size, qty: l.qty, price: l.price })),
    subtotal: t.subtotal, discount: t.discount, ship: t.ship, total: t.total, coupon: t.coupon ? t.coupon.label : null,
  };
  for (const l of t.lines) S.sold[l.p.id] = (S.sold[l.p.id] || 0) + l.qty;
  if (t.coupon) S.coupons = S.coupons.filter((c) => c.id !== t.coupon.id);
  S.orders.unshift(order);
  if (S.orders.length > 30) S.orders.length = 30;
  S.bag = [];
  const tokens = Math.round(t.total * CONFIG.tokensPerDollar);
  addTokens(tokens, 'cashback');
  commit(true);
  emit('bag');
  emit('order', order);
  return { order, tokens };
}

export function setProfile(p) {
  S.profile = { ...p };
  commit(true);
  emit('profile', S.profile);
}
