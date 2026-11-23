// Helpers shared by the five day scripts (day01.js … day05.js): places and
// camera shots, people on stage, the story clock, field hacks, the continuity
// cards, and the everyday conversation fallback. No LINES of its own, so it is
// not a content module and isn't listed in index.js.
import { TOWN } from '../../world/townplan.js';
import { CAST } from '../cast.js';
import * as town from './side_town.js';

const BLD = Object.fromEntries(TOWN.buildings.map((b) => [b.id, b]));
TOWN.houseLots.forEach(([x, z, rot], i) => { BLD['house' + i] = { id: 'house' + i, x, z, rot }; });

// ------------------------------------------------------------------ places
/**
 * World position {x, y, z, rot} of a named point ('cityhall.podium') or a
 * building id, optionally moved `side` metres to its right and `fwd` metres the
 * way it faces. A missing point falls back to the front of its building (and,
 * before the town is built, to townplan.js).
 */
export function at(G, name, side = 0, fwd = 0) {
  if (name && typeof name === 'object') return { y: 0, rot: 0, ...name };
  let p = G.town?.points?.[name];
  if (!p) {
    const id = String(name).split('.')[0];
    const b = G.town?.buildings?.[id] || BLD[id];
    if (b) {
      const d = (b.b?.footprint?.d || 10) / 2 + 2;
      p = { x: b.x + Math.sin(b.rot) * d, y: b.y ?? 0, z: b.z + Math.cos(b.rot) * d, rot: b.rot + Math.PI };
    }
  }
  if (!p) return { x: 0, y: 0, z: 0, rot: 0 };
  const r = p.rot ?? 0;
  return { x: p.x + Math.sin(r) * fwd - Math.cos(r) * side, y: p.y ?? 0, z: p.z + Math.cos(r) * fwd + Math.sin(r) * side, rot: r };
}

/** A spot in a building's own frame (metres; +z = out of its front door). */
export function local(G, id, lx, lz, rot = 0) {
  const b = G.town?.buildings?.[id] || BLD[id];
  if (!b) return { x: lx, y: 0, z: lz, rot };
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return { x: b.x + lx * c + lz * s, y: b.y ?? 0, z: b.z - lx * s + lz * c, rot: rot + b.rot };
}

export const flat = (p) => ({ x: p.x, z: p.z });
export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
/** A place that faces something (a person's id, a place name, or {x, z}). */
export function facing(G, where, target) {
  const p = at(G, where);
  const t = typeof target === 'string' ? (G.npcs?.get?.(target)?.pos && target !== 'player' ? G.npcs.get(target).pos : target === 'player' ? G.player?.pos : at(G, target)) : target;
  return t ? { ...p, rot: yawTo(p, t) } : p;
}

/** Metres from the player to a place, building, point or (named) person. */
export function dist(G, w) {
  const P = G.player?.pos;
  if (!P) return 1e9;
  let t = w;
  if (typeof w === 'string') {
    const n = G.npcs?.get?.(w);
    t = n && !n.def?.folk && n.pos && CAST[w] ? n.pos : at(G, w);
  }
  return Math.hypot(P.x - t.x, P.z - t.z);
}

// ------------------------------------------------------------------ camera
export function vec(G, x, y, z) {
  const v = G.player?.pos;
  return v?.clone ? v.clone().set(x, y, z) : { x, y, z };
}
/** A fixed shot from one place (raised `ah` m) looking at another (raised `bh` m). */
export function shot(G, a, ah, b, bh, fov = 45) {
  // heights are above the floor or ground actually there: a place given as bare
  // {x, z} has y = 0, and Port Zarya stands several metres above that
  const base = (p) => Math.max(p.y || 0, G.world?.groundNear ? G.world.groundNear(p.x, p.z, p.y || undefined) : 0);
  return { pos: vec(G, a.x, base(a) + ah, a.z), look: vec(G, b.x, base(b) + bh, b.z), fov, dof: false };
}
/** A close-up, only if that actor really made it on stage. */
export function cu(d, id, o) { return d.actors?.[id] ? d.closeUp(id, o) : undefined; }
export function ovs(d, a, b, o) { return d.actors?.[a] && d.actors?.[b] ? d.overShoulder(a, b, o) : undefined; }

// ------------------------------------------------------------------ meters
const REL_NAMES = ['Stranger', 'Acquaintance', 'Friendly', 'Friend', 'Close friend', 'Family'];
export const level = (G, id) => Math.min(5, Math.floor(((G.state.rel || {})[id] || 0) / 20));
export function rel(G, id, n) {
  const s = G.state;
  const before = level(G, id);
  (s.rel ||= {})[id] = Math.max(0, Math.min(100, (s.rel[id] || 0) + n));
  s.met && (s.met[id] = true);
  if (level(G, id) > before) G.hud?.toast?.('FRIENDSHIP', `${CAST[id]?.short || id}: ${REL_NAMES[level(G, id)]}`, '#9fe8b0');
}
export function standing(G, n, why = '') { G.state.standing += n; G.hud?.toast?.('STANDING', `${n >= 0 ? '+' : '−'}${Math.abs(n)}${why ? '  ' + why : ''}`, '#b98cff'); }
export function spirit(G, n, why = '') { G.state.spirit += n; G.hud?.toast?.('TOWN SPIRIT', `+${n}${why ? '  ' + why : ''}`, '#ffd166'); }
export function item(G, k, n = 1, label) {
  const inv = G.state.inv;
  inv[k] = Math.max(0, (inv[k] || 0) + n);
  if (n > 0 && label) G.hud?.toast?.('ITEM', label, '#ffd166');
}

// ------------------------------------------------------------------ people on stage
/** Script a named person: walk to p and stay there until released. */
export function place(G, id, p, activity = 'stand') {
  const n = G.npcs?.get?.(id) || G.npcs?.ensure?.(id);
  if (!n) return null;
  n.scripted = true;
  n.hidden = false;
  n.goal = { x: p.x, z: p.z, yaw: p.rot ?? n.yaw, activity };
  return n;
}
/** …or put them there right away. */
export function warp(G, id, p, activity = 'stand') {
  const n = place(G, id, p, activity);
  if (n?.pos) { n.pos.x = p.x; n.pos.z = p.z; if (p.y !== undefined) n.pos.y = p.y; }
  return n;
}
/** Walk over if they're close and in view; otherwise just be there. */
export function stage(G, id, p, activity = 'stand') {
  const n = G.npcs?.get?.(id) || G.npcs?.ensure?.(id);
  if (!n) return null;
  const P = G.player?.pos;
  const far = !n.ch || n.hidden || !n.pos || !P || Math.hypot(n.pos.x - p.x, n.pos.z - p.z) > 25 || Math.hypot(P.x - p.x, P.z - p.z) > 40;
  return far ? warp(G, id, p, activity) : place(G, id, p, activity);
}
/** Hand people back to their schedules. */
export function release(G, ...ids) {
  for (const id of ids) {
    const n = G.npcs?.get?.(id);
    if (n) { n.scripted = false; n.goal = null; n.run = false; }
  }
}

// ------------------------------------------------------------------ the story clock
// The clock runs at a game minute per real second, far faster than a story
// day is played. Each step of a day caps the hour (cap), so the time of day
// follows the story however long the player wanders; a time-gated step lifts
// the cap to its hour (waitFor), and T skips there.
/** Call once at the top of a main mission's run(). */
export function keepTime(m) {
  const G = m.G;
  const p = m.until(() => {
    if (m.cancelled || !(m.id in (G.state.missions?.active || {}))) return true;
    const s = G.state, c = G._cap;
    if (c != null && s.hour > c && s.hour - c < 6) s.hour = c;
    return false;
  });
  p?.catch?.(() => {});
}
/** From now until the next cap, the clock stops at h (it never winds back). */
export function cap(m, h) {
  const G = m.G, s = G.state;
  G._cap = s.hour > h && s.hour - h < 6 ? s.hour : h;
}
/** Move the clock forward to h (a scene that starts at a set time). */
export function clockTo(m, h) {
  const s = m.G.state;
  if (s.hour < h) s.hour = h;
  cap(m, h);
}
/** 19 → "7 pm", 17.5 → "5:30 pm" (as game/missions.js writes it). */
export function fmtHour(h) {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  const ap = hh < 12 ? 'am' : 'pm', h12 = hh % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}
/** A time-gated step: the objective shows "Press T to wait until …" and resolves at h. */
export function waitFor(m, h, text, where, sub) {
  const s = m.G.state;
  cap(m, h);
  if (s.hour >= h) { m.obj(text, where, sub); return Promise.resolve(); }
  const tip = `Press T to wait until ${fmtHour(h)}`;
  if (m.waitUntil) return m.waitUntil(h, text, where, sub ? `${sub} · ${tip}` : tip);
  m.obj(text, where, sub ? `${sub} · ${tip}` : tip);
  return m.until(() => s.hour >= h);
}

// ------------------------------------------------------------------ steps
/** m.until() that keeps this mission's objective on the HUD (it comes back if something cleared it). */
export function hold(m, test, text, where, sub) {
  return m.until(() => {
    if (text && !m.G.hud?.objective) m.obj(text, where, sub);
    return test();
  });
}

/**
 * A story conversation at a set place: they're put there (and kept there),
 * the objective and marker point at them, and the step ends when `done()`
 * (a flag their conversation sets) is true.
 */
export async function meet(m, id, where, text, sub, done) {
  const G = m.G;
  const p = typeof where === 'object' ? where : at(G, where);
  stage(G, id, p);
  m.obj(text, p, sub);
  await hold(m, () => {
    const n = G.npcs?.get?.(id);
    if (n && !n.scripted && !n.talking) stage(G, id, p);
    return !!done();
  }, text, p, sub);
  release(G, id);
}

/** After a shift: fade, and the clock moves on to start + hours (unless the job already moved it). */
export async function passTime(m, start, hours, why) {
  const G = m.G, s = G.state;
  const want = Math.min(23.5, start + hours);
  cap(m, want);
  if (!(s.hour >= start - 0.01 && s.hour < want - 0.2)) return;
  const f = G.fadeTeleport?.({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.player.yaw }, 1.6);
  await m.wait(0.75);
  s.hour = want;
  await f;
  if (why) G.hud?.toast?.('LATER', why, '#9fd0ff');
}

/** A field hack on the phone/laptop. Backing out leaves a spot to try again. */
export async function hack(m, id, where, prompt, retryLine) {
  for (let i = 0; i < 40; i++) {
    const r = await m.code(id);
    if (r === true || r?.pass || m.G.state.challenges?.[id]) return true;
    if (retryLine) m.ear(retryLine);
    m.obj(prompt, where, 'Field hack');
    await m.spot(`hack.${id}.${i}`, where, prompt, 2.6);
  }
  return true;
}

/** Cancel another mission and take its leftover spots out of the world. */
export function drop(G, id, spots = []) {
  for (const sp of spots) G.interact?.remove?.(`${id}:${sp}`);
  if (G.missions?.isActive?.(id)) G.missions.cancel?.(id);
}

// ------------------------------------------------------------------ the continuity cards
export const SHARE_IDS = ['dolly', 'hank', 'ruth', 'ray', 'lyle'];
export const hasShare = (s, id) => !!(s.flags || {})['share.' + id] || !!(s.shares || {})[id];
export const shareCount = (s) => SHARE_IDS.filter((k) => hasShare(s, k)).length;
const CARD_EARS = ['sf.n.card1', 'sf.n.card2', 'sf.d.card3', 'sf.v.card4'];
/** Hand over a council member's card (in a conversation `c`, or a scene through `m`). */
export function takeShare(G, id, ear) {
  const s = G.state;
  if (hasShare(s, id)) return;
  s.flags['share.' + id] = true;
  (s.shares ||= {})[id] = true;
  s.inv.continuity_card = (s.inv.continuity_card || 0) + 1;
  const n = shareCount(s);
  G.hud?.toast?.('CONTINUITY CARD', `${CAST[id]?.short || id}'s card · ${n} of 3`, '#ffd166');
  G.missions?.emit?.('share:' + id);
  (ear || ((l) => G.missions?.ear?.(l)))(CARD_EARS[Math.max(0, Math.min(3, n - 1))]);
}

// ------------------------------------------------------------------ conversations
// The everyday part of a conversation. The first talk of the day opens with
// the day's line (it stands in for side_friends.js's hello), then hands over
// to the earlier modules: the friendship hub (topics, jobs, small talk). A
// stale day-one pleasantry down there becomes today's line (once); if nobody
// has anything else to say, today's line it is.
const STALE = new Set(['d1.k.again', 'd1.d.bye', 'd1.g.again', 'd1.e.no', 'd1.w.again', 'd1.h.again']);
export async function idle(c, prev, who, line) {
  const first = c.flag('dl.' + who) !== c.day;
  if (first && line) {
    c.flag('dl.' + who, c.day);
    await c.say(who, line);
    c.flag('hi.' + who, c.day); // the hub says hello once a day; this was it
  }
  let said = first && !!line;
  const c2 = Object.create(c);
  c2.say = async (w, id, o) => {
    if (STALE.has(id)) {
      if (said || !line) return undefined;
      said = true;
      return c.say(who, line);
    }
    said = true;
    return c.say(w, id, o);
  };
  c2.choose = async (opts, o) => { said = true; return c.choose(opts, o); };
  c2.you = async (t) => { said = true; return c.you(t); };
  await prev(c2);
  if (said) return;
  if (await town.reactTo?.(c, who)) return;
  if (line) await c.say(who, line);
}

/** A line said once (per flag) on this day; otherwise the everyday conversation. */
export const once = (day, npc, key, line, when = () => true) => async (c, prev) => {
  if (c.day !== day || c.flag(key) || !when(c)) return prev(c);
  const l = typeof line === 'function' ? line(c) : line;
  if (!l) return prev(c);
  c.flag(key, true);
  await c.say(npc, l);
  c.rel(2);
};
