// The hotel itself: guests arriving, rooms getting dirty, money coming and going.
// This module is pure logic — no THREE, no DOM — so it can be stepped headlessly
// in a test, fast-forwarded for offline earnings, and serialised straight to a save.
import {
  DAY_SECONDS, MIN_PER_SEC, HOUR, SLOTS_PER_FLOOR, MAX_FLOORS, TIERS, TASK_SECS,
  TASK_PRIORITY, ROLES, ROLE_BY_ID, AMENITY_BY_ID, AMENITIES, BUDGETS, WALK_SPEED,
  START_CASH, START_ROOMS, START_REP, START_LINENS, BASE_LINENS, OFFLINE_CAP_HOURS, OFFLINE_EFFICIENCY,
  roomBuildCost, floorCost, TIER_UPGRADE_COST, trainCost, staffSpeed, staffWage, roleCap,
} from './data.js';
import * as nav from './nav.js';
import { genGuestName, genStaffName, REQUESTS, REVIEW_LINES, pick } from './names.js';

let nextId = 1;
const uid = (p) => `${p}${nextId++}`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);

// Guests give up after this many seconds of being ignored; lobby comforts help.
const BASE_PATIENCE = 42;
const REQUEST_PATIENCE = 70;
const REQUEST_MOOD_RATE = 0.05;

// ------------------------------------------------------------------ new game
export function newHotel(opts = {}) {
  const state = {
    v: 1,
    name: opts.name || 'The Wayside Inn',
    facade: opts.facade || 'stucco',
    ink: opts.ink || '#8f1d2c',
    accent: opts.accent || '#e0a92b',
    cash: START_CASH,
    rep: START_REP,
    day: 1,
    clock: 12 * 60,
    t: 0,
    speed: 1,
    rateMult: 1.0,
    floors: 1,
    rooms: [],
    guests: [],
    staff: [],
    tasks: [],
    amenities: {},
    you: null,
    youAuto: false,
    reviews: [],
    log: [],
    milestones: {},
    today: blankLedger(),
    yesterday: null,
    totals: { earned: 0, spent: 0, nights: 0, guests: 0, walkouts: 0, days: 0 },
    tips: {},
    lastSeen: Date.now(),
    arrivalDebt: 0,
  };
  for (let s = 0; s < SLOTS_PER_FLOOR; s++) state.rooms.push(makeRoom(1, s, s < START_ROOMS));
  state.you = makeWorker('you', 'You', 'you');
  state.you.linen = START_LINENS;
  logLine(state, `You take the keys to ${state.name}. Three rooms, a bell, and a mop.`, 'good');
  return state;
}

function blankLedger() {
  return { revenue: 0, tips: 0, incidentals: 0, wages: 0, upkeep: 0, spend: 0, nights: 0, guests: 0, walkouts: 0, cleaned: 0, fixed: 0 };
}

function makeRoom(floor, slot, built) {
  return {
    id: uid('r'), floor, slot, tier: 1, built: !!built,
    state: built ? 'empty' : 'shell',   // shell | empty | reserved | occupied | dirty | broken
    dirt: 0, wear: 0, guestId: null, brokenPart: null, seed: (Math.random() * 1e9) | 0,
  };
}

function makeWorker(kind, name, role) {
  const home = kind === 'you' ? nav.deskStaff() : nav.deskFront();
  return {
    id: uid('w'), kind, role, name, level: 1,
    x: home.x, y: 0, z: home.z + (Math.random() - 0.5) * 1.4, heading: 0,
    path: null, job: null, action: 'idle', linen: BASE_LINENS, idle: 0,
    seed: (Math.random() * 1e9) | 0, offShift: false,
  };
}

// ------------------------------------------------------------------ derived
export function builtRooms(state) { return state.rooms.filter((r) => r.built); }
export function roomById(state, id) { return state.rooms.find((r) => r.id === id) || null; }
export function guestById(state, id) { return state.guests.find((g) => g.id === id) || null; }
export function workers(state) { return [state.you, ...state.staff]; }
export function workerById(state, id) { return workers(state).find((w) => w.id === id) || null; }
export function hour(state) { return state.clock / 60; }

export function aggregate(state) {
  const a = {
    draw: 0, mood: 0, rate: 1, rep: 0, pernight: 0, upkeep: 0, linens: 0,
    cleanSpeed: 1, checkinSpeed: 1, wear: 1, patience: 0,
    instantLinen: false, elevator: false, groups: false,
  };
  for (const id of Object.keys(state.amenities)) {
    const am = AMENITY_BY_ID[id];
    if (!am || !state.amenities[id]) continue;
    a.draw += am.draw || 0;
    a.mood += am.mood || 0;
    a.rate *= am.rate || 1;
    a.rep += am.rep || 0;
    a.pernight += am.pernight || 0;
    a.upkeep += am.upkeep || 0;
    a.linens += am.linens || 0;
    a.cleanSpeed *= am.cleanSpeed || 1;
    a.checkinSpeed *= am.checkinSpeed || 1;
    a.wear *= am.wear || 1;
    if (am.instantLinen) a.instantLinen = true;
    if (am.elevator) a.elevator = true;
    if (am.groups) a.groups = true;
  }
  a.patience = (state.amenities.coffee ? 8 : 0) + (state.amenities.chandelier ? 4 : 0)
    + (state.amenities.bar ? 6 : 0) + (state.amenities.valet ? 8 : 0) + (state.amenities.giftshop ? 4 : 0);
  a.linenMax = BASE_LINENS + a.linens;
  return a;
}

export function roomRate(state, room, agg = aggregate(state)) {
  return Math.round(TIERS[room.tier].rate * state.rateMult * agg.rate);
}

export function starRating(state, agg = aggregate(state)) {
  return clamp(state.rep + agg.rep, 0, 5);
}

// You cannot review your way to five stars out of a six-room motel. Standing
// climbs toward whatever the property itself can justify — rooms, tiers, extras.
export function repCeiling(state, agg = aggregate(state)) {
  const built = builtRooms(state);
  const avgTier = built.length ? built.reduce((n, r) => n + r.tier, 0) / built.length : 1;
  const extras = Object.keys(state.amenities).filter((k) => state.amenities[k]).length;
  return clamp(1.5 + extras * 0.16 + avgTier * 0.45 + Math.min(built.length, 30) * 0.03, 1, 5);
}

// Travellers per day the sign can pull in at the current price and standing.
export function demandPerDay(state, agg = aggregate(state)) {
  const rooms = builtRooms(state).length;
  if (!rooms) return 0;
  const stars = starRating(state, agg);
  const repF = 0.45 + (stars / 5) * 0.95;
  const drawF = 1 + agg.draw;
  const price = state.rateMult / agg.rate;
  const priceF = clamp(1.62 - 0.68 * price, 0.12, 1.45);
  return rooms * 1.35 * repF * drawF * priceF;
}

export function dailyWages(state) {
  return state.staff.reduce((n, s) => n + staffWage(s), 0);
}
export function dailyUpkeep(state, agg = aggregate(state)) {
  return agg.upkeep + builtRooms(state).length * 4;
}

export function coverage(state) {
  const need = ['clerk', 'housekeeper', 'maintenance', 'bellhop'];
  const have = {};
  for (const s of state.staff) have[s.role] = (have[s.role] || 0) + 1;
  const covered = need.filter((r) => have[r]).length;
  return {
    have, covered, need,
    missing: need.filter((r) => !have[r]),
    full: covered === need.length,
    nightOk: !!have.auditor,
    auto: covered === need.length,
  };
}
export function isAutomated(state) { return coverage(state).full; }

export function offlineCapHours(state) {
  const c = coverage(state);
  if (c.have.manager) return OFFLINE_CAP_HOURS.manager;
  if (c.have.auditor) return OFFLINE_CAP_HOURS.auditor;
  return OFFLINE_CAP_HOURS.base;
}

export function occupancy(state) {
  const built = builtRooms(state);
  if (!built.length) return 0;
  return built.filter((r) => r.state === 'occupied' || r.state === 'reserved').length / built.length;
}

export function logLine(state, text, kind = 'info') {
  state.log.unshift({ day: state.day, clock: state.clock, text, kind });
  if (state.log.length > 80) state.log.length = 80;
}

// ------------------------------------------------------------------ tasks
function addTask(state, type, opts) {
  const task = { id: uid('t'), type, createdAt: state.t, claimedBy: null, ...opts };
  state.tasks.push(task);
  return task;
}
function dropTask(state, taskId) {
  const i = state.tasks.findIndex((t) => t.id === taskId);
  if (i < 0) return;
  const task = state.tasks[i];
  if (task.claimedBy) {
    const w = workerById(state, task.claimedBy);
    if (w && w.job && w.job.taskId === taskId) { w.job = null; w.path = null; w.action = 'idle'; }
  }
  state.tasks.splice(i, 1);
}
export function taskFor(state, kind, id) {
  return state.tasks.find((t) => (kind === 'room' ? t.roomId === id : t.guestId === id)) || null;
}

export function taskTitle(state, task) {
  if (task.type === 'checkin' || task.type === 'checkout') {
    const g = guestById(state, task.guestId);
    return `${task.type === 'checkin' ? 'Check in' : 'Check out'} ${g ? g.name : 'guest'}`;
  }
  const r = roomById(state, task.roomId);
  const label = r ? `Room ${roomNumber(r)}` : 'a room';
  if (task.type === 'clean') return `Clean ${label}`;
  if (task.type === 'fix') return `Fix ${task.part || 'the AC'} · ${label}`;
  if (task.type === 'service') {
    const g = guestById(state, task.guestId);
    return `${g ? g.name.split(' ')[0] : 'Guest'} wants ${task.request ? task.request.label : 'something'}`;
  }
  return 'Task';
}

export function roomNumber(room) { return room.floor * 100 + room.slot + 1; }

export function taskUrgency(state, task) {
  let u = TASK_PRIORITY[task.type] || 1;
  if (task.type === 'checkin' || task.type === 'checkout') {
    const g = guestById(state, task.guestId);
    if (g) u += (1 - g.patience) * 6;
  }
  if (task.type === 'service') {
    const g = guestById(state, task.guestId);
    if (g) u += (1 - g.reqPatience) * 4;
  }
  if (task.type === 'clean') u += clamp((state.t - task.createdAt) / 90, 0, 2);
  return u;
}

export function sortedTasks(state) {
  return [...state.tasks].sort((a, b) => taskUrgency(state, b) - taskUrgency(state, a));
}

// ------------------------------------------------------------------ guests
function newGuest(state, agg) {
  const wTotal = BUDGETS.reduce((n, b) => n + b.weight, 0);
  let roll = Math.random() * wTotal;
  let budget = BUDGETS[0];
  for (const b of BUDGETS) { roll -= b.weight; if (roll <= 0) { budget = b; break; } }
  const party = agg.groups && Math.random() < 0.18 ? 3 + ((Math.random() * 4) | 0)
    : Math.random() < 0.34 ? 2 : Math.random() < 0.9 ? 1 : 3;
  const nights = Math.random() < 0.55 ? 1 : Math.random() < 0.7 ? 2 : 3;
  const g = {
    id: uid('g'), name: genGuestName(), seed: (Math.random() * 1e9) | 0,
    budget: budget.id, want: budget.want, tolerance: budget.tolerance, tipRate: budget.tipRate,
    party, nights, mood: clamp(0.62 + starRating(state, agg) * 0.05 + agg.mood, 0.2, 1),
    patience: 1, reqPatience: 1, request: null, roomId: null,
    state: 'arriving', x: 0, y: 0, z: 0, heading: 0, path: null,
    queueIdx: -1, seatIdx: -1, timer: 0, checkoutDay: 0, checkoutMin: 0,
    bill: 0, arrivedDay: state.day, action: 'walk',
  };
  return g;
}

function reserveRoom(state, guest) {
  const free = state.rooms.filter((r) => r.built && r.state === 'empty');
  if (!free.length) return null;
  // Best fit: the cheapest room that still meets what they came for, else the best available.
  const atOrAbove = free.filter((r) => r.tier >= guest.want).sort((a, b) => a.tier - b.tier);
  const room = atOrAbove[0] || free.sort((a, b) => b.tier - a.tier)[0];
  room.state = 'reserved';
  room.guestId = guest.id;
  guest.roomId = room.id;
  return room;
}

function releaseRoom(state, guest) {
  const room = guest.roomId ? roomById(state, guest.roomId) : null;
  if (room && room.guestId === guest.id) {
    room.guestId = null;
    if (room.state === 'reserved') room.state = 'empty';
  }
  guest.roomId = null;
}

function queueIndex(state) {
  const used = new Set(state.guests.filter((g) => g.queueIdx >= 0).map((g) => g.queueIdx));
  for (let i = 0; i < 12; i++) if (!used.has(i)) return i;
  return 11;
}

function spawnGuest(state, agg, ev) {
  const g = newGuest(state, agg);
  if (!reserveRoom(state, g)) return null;
  const start = nav.street(state.guests.length);
  g.x = start.x; g.y = 0; g.z = start.z;
  g.queueIdx = queueIndex(state);
  nav.goTo(state, g, nav.queueSpot(g.queueIdx));
  state.guests.push(g);
  ev('arrive', { guest: g });
  return g;
}

// Arrivals cluster in the afternoon and evening; a trickle overnight. The
// weights average out to 1.0 across 24 hours, so a day really does deliver
// demandPerDay travellers.
function arrivalCurve(h) {
  if (h < 5) return 0.19;
  if (h < 11) return 0.16;
  if (h < 13) return 0.40;
  if (h < 16) return 1.36;
  if (h < 19) return 2.65;
  if (h < 22) return 2.49;
  return 0.88;
}

// ------------------------------------------------------------------ stepping
export function stepSim(state, dt, ev = () => {}) {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.5);
  const agg = aggregate(state);
  state.t += dt;

  const prevClock = state.clock;
  state.clock += dt * MIN_PER_SEC;
  while (state.clock >= 1440) { state.clock -= 1440; rollDay(state, agg, ev); }
  const h = hour(state);

  stepArrivals(state, agg, dt, h, ev);
  for (const g of state.guests) stepGuest(state, agg, g, dt, h, ev);
  state.guests = state.guests.filter((g) => g.state !== 'gone');

  stepRooms(state, agg, dt, prevClock, ev);
  for (const w of workers(state)) stepWorker(state, agg, w, dt, h, ev);

  state.lastSeen = Date.now();
}

function stepArrivals(state, agg, dt, h, ev) {
  const perDay = demandPerDay(state, agg);
  const rate = (perDay / DAY_SECONDS) * arrivalCurve(h) * dt;
  state.arrivalDebt += rate;
  let guard = 0;
  while (state.arrivalDebt >= 1 && guard++ < 6) {
    state.arrivalDebt -= 1;
    if (!spawnGuest(state, agg, ev)) { state.arrivalDebt = 0; break; }
  }
}

function stepGuest(state, agg, g, dt, h, ev) {
  const speed = WALK_SPEED.guest;
  switch (g.state) {
    case 'arriving': {
      if (nav.advance(state, g, speed, dt)) {
        g.state = 'queue';
        g.action = 'wait';
        if (!taskFor(state, 'guest', g.id)) addTask(state, 'checkin', { guestId: g.id });
      }
      break;
    }
    case 'queue': {
      const patSecs = BASE_PATIENCE + agg.patience + (h >= HOUR.nightFall || h < 6 ? 25 : 0);
      g.patience -= dt / patSecs;
      g.mood -= dt * 0.0028;
      if (g.patience <= 0) { walkOut(state, g, ev); }
      break;
    }
    case 'toroom': {
      if (nav.advance(state, g, speed, dt)) {
        g.state = 'inroom';
        g.action = 'idle';
        g.timer = rnd(6, 22);
      }
      break;
    }
    case 'inroom': {
      stepInRoom(state, agg, g, dt, h, ev);
      break;
    }
    case 'tocheckout': {
      if (nav.advance(state, g, speed, dt)) {
        g.state = 'checkout';
        g.action = 'wait';
        if (!taskFor(state, 'guest', g.id)) addTask(state, 'checkout', { guestId: g.id });
      }
      break;
    }
    case 'checkout': {
      g.patience -= dt / (BASE_PATIENCE + agg.patience + 30);
      if (g.patience <= 0) {
        // Nobody came. They leave the cash on the counter and a grudge in the review.
        settleBill(state, agg, g, 0.7, ev);
        g.mood = clamp(g.mood - 0.18, 0, 1);
        const t = taskFor(state, 'guest', g.id);
        if (t) dropTask(state, t.id);
        departGuest(state, agg, g, ev);
      }
      break;
    }
    case 'leaving': {
      if (nav.advance(state, g, speed, dt)) g.state = 'gone';
      break;
    }
    default: break;
  }
}

function stepInRoom(state, agg, g, dt, h, ev) {
  const room = roomById(state, g.roomId);
  if (!room) { g.state = 'leaving'; nav.goTo(state, g, nav.street(0)); return; }

  // Where their mood is heading: the room they got versus the room they wanted.
  let target = 0.74 + agg.mood * 1.2;
  target += (room.tier - g.want) * 0.14;
  target -= clamp((state.rateMult / agg.rate - g.tolerance) * 0.55, -0.08, 0.5);
  target += clamp((starRating(state, agg) - 2.5) * 0.03, -0.1, 0.1);
  if (room.state === 'broken') target -= 0.45;
  g.mood += (clamp(target, 0.05, 1) - g.mood) * dt * 0.03;

  if (g.request) {
    g.reqPatience -= dt / REQUEST_PATIENCE;
    // REQUESTS carry a per-in-game-hour annoyance; REQUEST_MOOD_RATE turns that
    // into the per-second drain the tick actually runs on.
    g.mood -= dt * (g.request.mood || 0.06) * REQUEST_MOOD_RATE;
    if (g.reqPatience <= 0) {
      g.mood = clamp(g.mood - 0.22, 0, 1);
      const t = taskFor(state, 'guest', g.id);
      if (t) dropTask(state, t.id);
      g.request = null;
      g.reqPatience = 1;
      ev('ignored', { guest: g });
    }
  } else if (Math.random() < dt * 0.008 && h > 7 && h < 23) {
    g.request = pick(REQUESTS);
    g.reqPatience = 1;
    addTask(state, 'service', { guestId: g.id, roomId: room.id, request: g.request });
    ev('request', { guest: g });
  }

  // Pottering about: chair, pool, bed, depending on the hour.
  g.timer -= dt;
  if (g.timer <= 0) {
    g.timer = rnd(8, 26);
    if (h >= 23 || h < 6) g.action = 'sleep';
    else if (state.amenities.pool && h > 10 && h < 20 && Math.random() < 0.18) g.action = 'pool';
    else g.action = Math.random() < 0.5 ? 'sit' : 'idle';
  }

  const due = state.day > g.checkoutDay || (state.day === g.checkoutDay && state.clock >= g.checkoutMin);
  if (due && h >= HOUR.checkoutOpen) {
    g.state = 'tocheckout';
    g.action = 'walk';
    g.queueIdx = queueIndex(state);
    g.patience = 1;
    nav.goTo(state, g, nav.queueSpot(g.queueIdx));
  }
}

function walkOut(state, g, ev) {
  releaseRoom(state, g);
  const t = taskFor(state, 'guest', g.id);
  if (t) dropTask(state, t.id);
  g.state = 'leaving';
  g.action = 'walk';
  g.queueIdx = -1;
  g.mood = 0.05;
  nav.goTo(state, g, nav.street(state.today.walkouts + 1));
  state.rep = clamp(state.rep - 0.055, 0.2, 5);
  state.today.walkouts++;
  state.totals.walkouts++;
  addReview(state, g);
  ev('walkout', { guest: g });
}

function settleBill(state, agg, g, factor, ev) {
  const room = roomById(state, g.roomId);
  const rate = room ? roomRate(state, room, agg) : TIERS[1].rate;
  const base = rate * g.nights;
  const extras = agg.pernight * g.nights * Math.max(1, Math.round(g.party * 0.7));
  const tip = Math.round(base * g.tipRate * clamp((g.mood - 0.6) / 0.4, 0, 1.2));
  const total = Math.round((base + extras) * factor) + tip;
  state.cash += total;
  state.today.revenue += Math.round(base * factor);
  state.today.incidentals += Math.round(extras * factor);
  state.today.tips += tip;
  state.today.nights += g.nights;
  state.today.guests++;
  state.totals.earned += total;
  state.totals.nights += g.nights;
  state.totals.guests++;
  g.bill = total;
  ev('pay', { guest: g, total });
}

function departGuest(state, agg, g, ev) {
  const room = roomById(state, g.roomId);
  if (room) {
    room.guestId = null;
    room.state = room.state === 'broken' ? 'broken' : 'dirty';
    room.dirt = clamp(0.45 + g.nights * 0.22 + g.party * 0.05, 0.3, 1);
    if (room.state === 'dirty' && !taskFor(state, 'room', room.id)) addTask(state, 'clean', { roomId: room.id });
  }
  g.roomId = null;
  g.state = 'leaving';
  g.action = 'walk';
  g.queueIdx = -1;
  nav.goTo(state, g, nav.street(state.totals.guests));
  const delta = (g.mood - 0.60) * 0.09;
  const ceil = repCeiling(state, agg);
  state.rep = clamp(state.rep + (delta > 0 && state.rep >= ceil ? 0 : delta), 0.2, 5);
  addReview(state, g);
  ev('depart', { guest: g });
}

function addReview(state, g) {
  const band = g.mood > 0.85 ? 'great' : g.mood > 0.68 ? 'good' : g.mood > 0.45 ? 'meh' : g.mood > 0.25 ? 'bad' : 'awful';
  const lines = REVIEW_LINES[band] || REVIEW_LINES.meh;
  state.reviews.unshift({ name: g.name, band, stars: Math.round(clamp(g.mood * 5, 0.5, 5) * 2) / 2, text: pick(lines), day: state.day });
  if (state.reviews.length > 40) state.reviews.length = 40;
}

// ------------------------------------------------------------------ rooms
function stepRooms(state, agg, dt, prevClock, ev) {
  const hoursPassed = (dt * MIN_PER_SEC) / 60;
  for (const room of state.rooms) {
    if (!room.built) continue;
    if (room.state === 'occupied') {
      room.dirt = clamp(room.dirt + dt * 0.012, 0, 1);
      room.wear += dt * 0.004;
    }
    if (room.state === 'broken') continue;
    const chance = 0.010 * (0.4 + room.wear * 0.5) * agg.wear * hoursPassed;
    if (Math.random() < chance && (room.state === 'occupied' || room.state === 'empty' || room.state === 'dirty')) {
      breakRoom(state, room, ev);
    }
  }
}

const BREAKABLES = ['the AC', 'the plumbing', 'a dead TV', 'the door lock', 'a leaking radiator', 'the light fixture'];

function breakRoom(state, room, ev) {
  const wasEmpty = room.state === 'empty' || room.state === 'dirty';
  room.prevState = room.state;
  room.state = 'broken';
  room.brokenPart = pick(BREAKABLES);
  room.wear = 0;
  if (!state.tasks.some((t) => t.roomId === room.id && t.type === 'fix')) {
    addTask(state, 'fix', { roomId: room.id, part: room.brokenPart });
  }
  ev('broke', { room, wasEmpty });
}

// ------------------------------------------------------------------ workers
function workSpeed(state, agg, w, type) {
  let s = w.kind === 'you' ? 1.15 : staffSpeed(w, state);
  if (type === 'clean') s *= agg.cleanSpeed;
  if (type === 'checkin' || type === 'checkout') s *= agg.checkinSpeed;
  return s;
}

function taskAnchor(state, task) {
  if (task.type === 'checkin' || task.type === 'checkout') return nav.deskStaff();
  const room = roomById(state, task.roomId);
  if (!room) return nav.deskStaff();
  return task.type === 'service' ? nav.roomDoor(room) : nav.roomInside(room);
}

function canHandle(state, w, task) {
  if (w.kind === 'you') return true;
  const role = ROLE_BY_ID[w.role];
  return role && role.handles.includes(task.type);
}

export function claimTask(state, w, taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.claimedBy) return false;
  if (!canHandle(state, w, task)) return false;
  if (w.job) releaseJob(state, w);
  task.claimedBy = w.id;
  const agg = aggregate(state);
  const needsLinen = task.type === 'clean' && !agg.instantLinen && w.linen <= 0;
  w.job = { taskId, type: task.type, phase: needsLinen ? 'restock' : 'travel', timer: 0 };
  nav.goTo(state, w, needsLinen ? nav.laundrySpot() : taskAnchor(state, task));
  w.action = 'walk';
  return true;
}

export function releaseJob(state, w) {
  if (!w.job) return;
  const task = state.tasks.find((t) => t.id === w.job.taskId);
  if (task && task.claimedBy === w.id) task.claimedBy = null;
  w.job = null;
  w.path = null;
  w.action = 'idle';
}

function onShift(state, w, h) {
  if (w.kind === 'you') return true;
  if (w.role === 'auditor' || w.role === 'manager') return true;
  if (coverage(state).nightOk) return true;
  return h >= HOUR.shiftStart && h < HOUR.shiftEnd;
}

function stepWorker(state, agg, w, dt, h, ev) {
  const shift = onShift(state, w, h);
  w.offShift = !shift;

  if (!w.job) {
    const auto = w.kind === 'you' ? state.youAuto : true;
    if (shift && auto) autoClaim(state, agg, w);
  }

  if (!w.job) {
    // Idle drift: back to a post, or off to the break room after hours.
    w.idle -= dt;
    if (w.idle <= 0) {
      w.idle = rnd(4, 12);
      const post = restPost(state, w, shift);
      if (nav.dist3(w, post) > 1.2) { nav.goTo(state, w, post); w.action = 'walk'; }
    }
    if (w.path && w.path.length) {
      if (nav.advance(state, w, walkSpeedOf(state, w), dt)) { w.path = null; w.action = 'idle'; }
    } else if (w.action !== 'desk') {
      w.action = w.role === 'clerk' ? 'desk' : 'idle';
    }
    return;
  }

  const task = state.tasks.find((t) => t.id === w.job.taskId);
  if (!task) { w.job = null; w.action = 'idle'; return; }
  if (!taskStillValid(state, task)) { dropTask(state, task.id); return; }

  if (w.job.phase === 'restock') {
    if (nav.advance(state, w, walkSpeedOf(state, w), dt)) {
      w.job.phase = 'restocking';
      w.job.timer = TASK_SECS.laundry;
      w.action = 'clean';
    }
    return;
  }
  if (w.job.phase === 'restocking') {
    w.job.timer -= dt * workSpeed(state, agg, w, 'clean');
    if (w.job.timer <= 0) {
      w.linen = agg.linenMax;
      w.job.phase = 'travel';
      nav.goTo(state, w, taskAnchor(state, task));
      w.action = 'walk';
      ev('restock', { worker: w });
    }
    return;
  }
  if (w.job.phase === 'travel') {
    w.action = task.type === 'service' ? 'carry' : 'walk';
    if (nav.advance(state, w, walkSpeedOf(state, w), dt)) {
      w.job.phase = 'work';
      w.job.dur = taskDuration(state, agg, task);
      w.job.timer = w.job.dur;
      w.action = workAction(task.type);
      ev('startwork', { worker: w, task });
    }
    return;
  }
  if (w.job.phase === 'work') {
    w.job.timer -= dt * workSpeed(state, agg, w, task.type);
    if (w.job.timer <= 0) finishTask(state, agg, w, task, ev);
  }
}

function walkSpeedOf(state, w) {
  return w.kind === 'you' ? WALK_SPEED.you : WALK_SPEED.staff * (1 + 0.06 * (w.level - 1));
}
function workAction(type) {
  return type === 'clean' ? 'clean' : type === 'fix' ? 'fix' : type === 'service' ? 'carry' : 'desk';
}
function taskDuration(state, agg, task) {
  if (task.type === 'clean') {
    const room = roomById(state, task.roomId);
    return TASK_SECS.clean * (room ? TIERS[room.tier].clean : 1) * (0.55 + (room ? room.dirt : 0.6) * 0.75);
  }
  if (task.type === 'service') return task.request?.secs || TASK_SECS.service;
  return TASK_SECS[task.type] || 6;
}

function taskStillValid(state, task) {
  if (task.type === 'checkin') {
    const g = guestById(state, task.guestId);
    return !!g && g.state === 'queue';
  }
  if (task.type === 'checkout') {
    const g = guestById(state, task.guestId);
    return !!g && g.state === 'checkout';
  }
  if (task.type === 'service') {
    const g = guestById(state, task.guestId);
    return !!g && !!g.request && g.state === 'inroom';
  }
  const room = roomById(state, task.roomId);
  if (!room) return false;
  if (task.type === 'clean') return room.state === 'dirty';
  if (task.type === 'fix') return room.state === 'broken';
  return true;
}

function autoClaim(state, agg, w) {
  let best = null, bestScore = -Infinity;
  for (const task of state.tasks) {
    if (task.claimedBy) continue;
    if (!canHandle(state, w, task)) continue;
    if (task.type === 'clean' && !agg.instantLinen && w.linen <= 0 && !state.staff.some((s) => s.role === 'laundry')) {
      // still allowed — the worker will detour to the linen room, just less eagerly
    }
    const anchor = taskAnchor(state, task);
    const travel = nav.travelSecs(state, w, anchor, walkSpeedOf(state, w));
    const score = taskUrgency(state, task) * 10 - travel;
    if (score > bestScore) { bestScore = score; best = task; }
  }
  if (best) claimTask(state, w, best.id);
}

function restPost(state, w, shift) {
  if (!shift) return { x: nav.LAUNDRY_X - 3, y: 0, z: nav.LAUNDRY_Z + 0.6, floor: 0 };
  if (w.role === 'clerk' || w.kind === 'you') return nav.deskStaff();
  if (w.role === 'housekeeper') return nav.laundrySpot();
  if (w.role === 'laundry') return { x: nav.LAUNDRY_X + 1.4, y: 0, z: nav.LAUNDRY_Z + 1, floor: 0 };
  if (w.role === 'auditor') return { x: nav.DESK_X + 2.2, y: 0, z: nav.DESK_Z - 0.8, floor: 0 };
  return nav.lobbySeat(w.seed % 4);
}

function finishTask(state, agg, w, task, ev) {
  const type = task.type;
  if (type === 'checkin') {
    const g = guestById(state, task.guestId);
    if (g) {
      const room = roomById(state, g.roomId) || reserveRoom(state, g);
      if (!room) { walkOut(state, g, ev); dropTask(state, task.id); w.job = null; return; }
      room.state = 'occupied';
      room.guestId = g.id;
      g.state = 'toroom';
      g.action = 'walk';
      g.queueIdx = -1;
      g.mood = clamp(g.mood + 0.06 + (room.tier - g.want) * 0.05, 0, 1);
      g.checkoutDay = state.day + g.nights - (state.clock < HOUR.checkoutClose * 60 ? 1 : 0);
      if (g.checkoutDay < state.day) g.checkoutDay = state.day;
      g.checkoutMin = (HOUR.checkoutOpen + Math.random() * 4.2) * 60;
      nav.goTo(state, g, nav.roomInside(room));
      ev('checkin', { guest: g, room });
    }
  } else if (type === 'checkout') {
    const g = guestById(state, task.guestId);
    if (g) { settleBill(state, agg, g, 1, ev); departGuest(state, agg, g, ev); }
  } else if (type === 'clean') {
    const room = roomById(state, task.roomId);
    if (room) {
      room.state = 'empty';
      room.dirt = 0;
      if (!agg.instantLinen) w.linen = Math.max(0, w.linen - 1);
      state.today.cleaned++;
      ev('cleaned', { room, worker: w });
    }
  } else if (type === 'fix') {
    const room = roomById(state, task.roomId);
    if (room) {
      room.state = room.guestId ? 'occupied' : (room.dirt > 0.2 ? 'dirty' : 'empty');
      room.brokenPart = null;
      room.wear = 0;
      state.today.fixed++;
      if (room.state === 'dirty' && !state.tasks.some((t) => t.roomId === room.id && t.type === 'clean')) {
        addTask(state, 'clean', { roomId: room.id });
      }
      ev('fixed', { room, worker: w });
    }
  } else if (type === 'service') {
    const g = guestById(state, task.guestId);
    if (g) {
      g.mood = clamp(g.mood + 0.12 + g.reqPatience * 0.06, 0, 1);
      g.request = null;
      g.reqPatience = 1;
      ev('served', { guest: g, worker: w });
    }
  }
  dropTask(state, task.id);
  w.job = null;
  w.action = 'idle';
  w.idle = 0;
}

// ------------------------------------------------------------------ day roll
function rollDay(state, agg, ev) {
  const wages = dailyWages(state);
  const upkeep = dailyUpkeep(state, agg);
  state.cash -= wages + upkeep;
  state.today.wages = wages;
  state.today.upkeep = upkeep;
  state.totals.spent += wages + upkeep;
  state.totals.days++;
  state.yesterday = { ...state.today, day: state.day };
  state.today = blankLedger();
  state.day++;
  state.rep = clamp(state.rep - 0.008, 0.2, 5);   // yesterday's good night fades

  if (state.cash < 0) {
    logLine(state, `The account is ${money(state.cash)}. The bank left a message.`, 'bad');
    if (state.cash < -1200 && state.staff.length) {
      const gone = state.staff.pop();
      // Hand back whatever they were holding, or the task stays claimed by a
      // worker who no longer exists and nobody can ever pick it up again.
      releaseJob(state, gone);
      logLine(state, `You could not make payroll. ${gone.name} handed back the keys.`, 'bad');
      ev('layoff', { staff: gone });
    }
  }
  ev('day', { report: state.yesterday });
}

export function money(n) {
  const v = Math.round(n);
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US');
}

// ------------------------------------------------------------------ commands
export function canAfford(state, cost) { return state.cash >= cost; }

export function buildRoom(state) {
  const built = builtRooms(state).length;
  const cost = roomBuildCost(built);
  const slot = state.rooms.find((r) => !r.built && r.floor <= state.floors);
  if (!slot) return { ok: false, why: 'Every slot on every floor is built. Add a floor.' };
  if (!canAfford(state, cost)) return { ok: false, why: `You need ${money(cost)}.` };
  state.cash -= cost;
  state.today.spend += cost;
  slot.built = true;
  slot.state = 'empty';
  logLine(state, `Room ${roomNumber(slot)} opens for business.`, 'good');
  return { ok: true, cost, room: slot };
}

export function addFloor(state) {
  if (state.floors >= MAX_FLOORS) return { ok: false, why: 'Five floors is the zoning limit.' };
  const openSlots = state.rooms.filter((r) => !r.built).length;
  if (openSlots > 0) return { ok: false, why: `Build out the ${openSlots} empty slot${openSlots > 1 ? 's' : ''} you already have first.` };
  const cost = floorCost(state.floors);
  if (!canAfford(state, cost)) return { ok: false, why: `You need ${money(cost)}.` };
  state.cash -= cost;
  state.today.spend += cost;
  state.floors++;
  for (let s = 0; s < SLOTS_PER_FLOOR; s++) state.rooms.push(makeRoom(state.floors, s, false));
  logLine(state, `Floor ${state.floors} goes up. Six more doors to fill.`, 'good');
  return { ok: true, cost };
}

export function upgradeRoom(state, roomId) {
  const room = roomById(state, roomId);
  if (!room || !room.built) return { ok: false, why: 'Nothing there yet.' };
  if (room.tier >= 3) return { ok: false, why: 'That is already a suite.' };
  if (room.state === 'occupied' || room.state === 'reserved') return { ok: false, why: 'Somebody is in there.' };
  const cost = TIER_UPGRADE_COST[room.tier + 1];
  if (!canAfford(state, cost)) return { ok: false, why: `You need ${money(cost)}.` };
  state.cash -= cost;
  state.today.spend += cost;
  room.tier++;
  logLine(state, `Room ${roomNumber(room)} is now a ${TIERS[room.tier].name.toLowerCase()}.`, 'good');
  return { ok: true, cost };
}

export function buyAmenity(state, id) {
  const am = AMENITY_BY_ID[id];
  if (!am) return { ok: false, why: 'No such thing.' };
  if (state.amenities[id]) return { ok: false, why: 'You already have that.' };
  if (!canAfford(state, am.cost)) return { ok: false, why: `You need ${money(am.cost)}.` };
  state.cash -= am.cost;
  state.today.spend += am.cost;
  state.amenities[id] = true;
  if (am.linens) {
    const agg = aggregate(state);
    for (const w of workers(state)) w.linen = agg.linenMax;
  }
  logLine(state, `${am.name} installed.`, 'good');
  return { ok: true, cost: am.cost };
}

export function hire(state, roleId) {
  const role = ROLE_BY_ID[roleId];
  if (!role) return { ok: false, why: 'No such job.' };
  const have = state.staff.filter((s) => s.role === roleId).length;
  const cap = roleCap(roleId, builtRooms(state).length);
  if (have >= cap) return { ok: false, why: role.unique ? `You only need one ${role.name}.` : `A hotel this size supports ${cap}. Build more rooms.` };
  if (!canAfford(state, role.hire)) return { ok: false, why: `You need ${money(role.hire)}.` };
  state.cash -= role.hire;
  state.today.spend += role.hire;
  const w = makeWorker('staff', genStaffName(), roleId);
  state.staff.push(w);
  logLine(state, `${w.name} starts as your ${role.name.toLowerCase()}.`, 'good');
  return { ok: true, staff: w, cost: role.hire };
}

export function fire(state, staffId) {
  const i = state.staff.findIndex((s) => s.id === staffId);
  if (i < 0) return { ok: false, why: 'Not on the payroll.' };
  const s = state.staff[i];
  releaseJob(state, s);
  state.staff.splice(i, 1);
  logLine(state, `${s.name} clocks out for the last time.`, 'bad');
  return { ok: true };
}

export function train(state, staffId) {
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return { ok: false, why: 'Not on the payroll.' };
  if (s.level >= 3) return { ok: false, why: `${s.name} has learned everything you can teach.` };
  const cost = trainCost(s.level);
  if (!canAfford(state, cost)) return { ok: false, why: `You need ${money(cost)}.` };
  state.cash -= cost;
  state.today.spend += cost;
  s.level++;
  logLine(state, `${s.name} trains up to level ${s.level}.`, 'good');
  return { ok: true, cost };
}

export function setRate(state, mult) {
  state.rateMult = clamp(mult, 0.6, 1.8);
}

// ------------------------------------------------------------------ offline
// Wall-clock time passed with the tab closed (or frozen). Rather than stepping
// the whole simulation for hours, model a day of trading and multiply.
export function offlineCatchUp(state, realSeconds) {
  const agg = aggregate(state);
  const capped = Math.min(realSeconds, offlineCapHours(state) * 3600);
  const days = capped / DAY_SECONDS;
  const cov = coverage(state);
  const rooms = builtRooms(state).length;
  const report = {
    hours: realSeconds / 3600, cappedHours: capped / 3600, capped: capped < realSeconds - 300,
    days, revenue: 0, wages: 0, upkeep: 0, net: 0, nights: 0, walkouts: 0,
    repFrom: starRating(state, agg), repTo: 0, note: '', unattended: !cov.have.clerk,
  };
  if (days < 0.02 || !rooms) { report.repTo = report.repFrom; return report; }

  // Anything still in a room settles up before the fast-forward. settleBill
  // already banks the cash, so this is kept out of report.net and folded into
  // report.revenue only for display.
  let preSettled = 0;
  for (const g of state.guests) {
    if (g.state === 'inroom' || g.state === 'checkout' || g.state === 'toroom' || g.state === 'tocheckout') {
      settleBill(state, agg, g, cov.have.clerk ? 1 : 0.7, () => {});
      preSettled += g.bill;
    }
  }
  report.settled = preSettled;

  // Throughput per day for the crew you left behind.
  const nightFactor = cov.have.auditor ? 1 : 0.68;
  const hk = state.staff.filter((s) => s.role === 'housekeeper');
  const hkThroughput = hk.reduce((n, s) => n + (DAY_SECONDS * 0.55 * staffSpeed(s, state) * agg.cleanSpeed) / TASK_SECS.clean, 0);
  const clerks = state.staff.filter((s) => s.role === 'clerk');
  const deskThroughput = clerks.reduce((n, s) => n + (DAY_SECONDS * 0.5 * staffSpeed(s, state) * agg.checkinSpeed) / (TASK_SECS.checkin + TASK_SECS.checkout), 0);
  const demand = demandPerDay(state, agg) * nightFactor;

  // What a perfect crew could have sold, versus what this crew actually could.
  // The gap is the only thing that counts as turning somebody away — travellers
  // who never came because the place was full are not a service failure.
  const avgNights = 1.62;
  const servable = Math.min(demand, rooms / avgNights);
  const arrivalsPerDay = Math.max(0, Math.min(servable, hkThroughput, deskThroughput));
  const unmet = Math.max(0, servable - arrivalsPerDay);
  const unmetShare = servable > 0 ? unmet / servable : 0;
  const occ = clamp((arrivalsPerDay * avgNights) / rooms, 0, 1);
  const avgTier = builtRooms(state).reduce((n, r) => n + TIERS[r.tier].rate, 0) / rooms;
  const perNight = avgTier * state.rateMult * agg.rate + agg.pernight;
  const efficiency = cov.have.manager ? OFFLINE_EFFICIENCY.manager : OFFLINE_EFFICIENCY.base;
  const grossPerDay = occ * rooms * perNight * efficiency
    * (cov.have.maintenance ? 1 : 0.9) * (cov.have.bellhop ? 1 : 0.94);
  const wagesPerDay = dailyWages(state);
  const upkeepPerDay = dailyUpkeep(state, agg);

  const gross = grossPerDay * days;
  report.wages = wagesPerDay * days;
  report.upkeep = upkeepPerDay * days;
  report.nights = Math.round(arrivalsPerDay * avgNights * days);
  report.walkouts = Math.round(unmet * days);
  report.net = gross - report.wages - report.upkeep;

  state.cash += Math.round(report.net);
  state.totals.earned += Math.round(gross);
  report.revenue = gross + preSettled;
  state.totals.spent += Math.round(report.wages + report.upkeep);
  state.totals.nights += report.nights;
  state.totals.walkouts += report.walkouts;

  // Standing drifts toward what this crew can actually deliver. Judge them on
  // the share of servable guests they missed, not the raw count — a hundred-day
  // absence must not read a hundred times worse than a one-day absence.
  const serviceQuality = clamp(0.35 + cov.covered * 0.16 + (cov.have.auditor ? 0.1 : 0) - unmetShare * 0.45, 0, 1);
  const repTarget = Math.min(repCeiling(state, agg), clamp(serviceQuality * 5.2, 0.3, 5));
  state.rep = clamp(state.rep + (repTarget - state.rep) * clamp(days * 0.35, 0, 0.8), 0.2, 5);

  // Clear the floor and hand back a plausible morning.
  state.guests = [];
  state.tasks = [];
  for (const w of workers(state)) { w.job = null; w.path = null; w.action = 'idle'; }
  const dirtyShare = hkThroughput > 0 ? clamp(0.12 + (arrivalsPerDay / Math.max(1, hkThroughput)) * 0.25, 0, 0.6) : 0.75;
  for (const room of state.rooms) {
    if (!room.built) continue;
    room.guestId = null;
    if (room.state === 'broken' && !cov.have.maintenance) continue;
    room.state = Math.random() < dirtyShare ? 'dirty' : 'empty';
    room.dirt = room.state === 'dirty' ? rnd(0.4, 0.95) : 0;
    if (room.state === 'dirty') addTask(state, 'clean', { roomId: room.id });
  }
  for (const room of state.rooms) {
    if (room.state === 'broken' && !state.tasks.some((t) => t.roomId === room.id && t.type === 'fix')) {
      addTask(state, 'fix', { roomId: room.id, part: room.brokenPart || 'the AC' });
    }
  }

  const wholeDays = Math.floor(days);
  state.day += wholeDays;
  state.clock = (state.clock + (days - wholeDays) * 1440) % 1440;
  state.totals.days += wholeDays;
  report.repTo = starRating(state, aggregate(state));

  if (!rooms) report.note = 'Nothing to sell.';
  else if (!cov.have.clerk) report.note = 'With nobody on the desk, arrivals turned around in the lot.';
  else if (!hk.length) report.note = 'Nobody flipped the rooms, so the ones you had stayed dirty.';
  else if (!cov.have.auditor) report.note = 'The place shut down overnight — a night auditor would keep it open.';
  else if (report.capped) report.note = `Your crew can hold the fort for ${offlineCapHours(state)} hours. After that they went home.`;
  else report.note = 'The crew ran the place without you.';
  return report;
}

// ------------------------------------------------------------------ save
export function serialize(state) {
  const strip = (w) => ({
    id: w.id, kind: w.kind, role: w.role, name: w.name, level: w.level,
    x: w.x, y: w.y, z: w.z, linen: w.linen, seed: w.seed,
  });
  // Guests mid-stay are not saved, so bank what they already owe and pay it out
  // on the next load rather than quietly losing the night.
  const agg = aggregate(state);
  let escrow = 0;
  for (const g of state.guests) {
    if (g.state === 'inroom' || g.state === 'toroom' || g.state === 'checkout' || g.state === 'tocheckout') {
      const room = g.roomId ? roomById(state, g.roomId) : null;
      escrow += (room ? roomRate(state, room, agg) : TIERS[1].rate) * g.nights + agg.pernight * g.nights;
    }
  }
  return {
    v: 1, nextId, escrow: Math.round(escrow),
    name: state.name, facade: state.facade, ink: state.ink, accent: state.accent,
    cash: state.cash, rep: state.rep, day: state.day, clock: state.clock, t: state.t,
    speed: state.speed, rateMult: state.rateMult, floors: state.floors,
    rooms: state.rooms.map((r) => ({ ...r })),
    staff: state.staff.map(strip),
    you: strip(state.you),
    youAuto: state.youAuto,
    amenities: { ...state.amenities },
    reviews: state.reviews.slice(0, 20),
    log: state.log.slice(0, 30),
    milestones: { ...state.milestones },
    totals: { ...state.totals },
    yesterday: state.yesterday,
    tips: { ...state.tips },
    lastSeen: Date.now(),
  };
}

// Guests and tasks are deliberately not saved — the offline model settles their
// bills and hands back a fresh morning, which is both simpler and fairer.
export function deserialize(data) {
  if (!data || !data.rooms) return null;
  const state = newHotel({ name: data.name, facade: data.facade, ink: data.ink, accent: data.accent });
  Object.assign(state, {
    cash: data.cash, rep: data.rep, day: data.day, clock: data.clock, t: data.t || 0,
    speed: data.speed || 1, rateMult: data.rateMult || 1, floors: data.floors || 1,
    rooms: data.rooms.map((r) => ({ ...r, guestId: null, state: r.state === 'occupied' || r.state === 'reserved' ? 'dirty' : r.state })),
    amenities: data.amenities || {},
    reviews: data.reviews || [],
    log: data.log || [],
    milestones: data.milestones || {},
    totals: { ...state.totals, ...(data.totals || {}) },
    yesterday: data.yesterday || null,
    tips: data.tips || {},
    youAuto: !!data.youAuto,
    guests: [],
    tasks: [],
    lastSeen: data.lastSeen || Date.now(),
  });
  nextId = Math.max(nextId, data.nextId || 1);
  state.you = { ...makeWorker('you', 'You', 'you'), ...(data.you || {}), kind: 'you', role: 'you', job: null, path: null, action: 'idle' };
  state.staff = (data.staff || []).map((s) => ({
    ...makeWorker('staff', s.name, s.role), ...s, kind: 'staff', job: null, path: null, action: 'idle',
  }));
  for (const room of state.rooms) {
    if (room.state === 'dirty') addTask(state, 'clean', { roomId: room.id });
    if (room.state === 'broken') addTask(state, 'fix', { roomId: room.id, part: room.brokenPart || 'the AC' });
  }
  return state;
}

export { clamp };
