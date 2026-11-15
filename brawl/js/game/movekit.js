// Building blocks for writing movesets. A fighter file is mostly calls to
// these plus its own drawing code.

import { K } from '../core/util.js';
import { Projectile } from './entities.js';
export { K };

// hit(frames, where, radius, damage, angle, baseKB, growth, extras)
//   frames : [first, last] active frames
//   where  : a rig point name ('hR','fR','prop','head'...) or [x, up] offset from the feet
export function hit(f, where, r, dmg, ang, bk, kg, o) {
  const h = { f, r, dmg, ang, bk, kg };
  if (typeof where === 'string') h.at = where; else { h.x = where[0]; h.y = -where[1]; }
  return o ? Object.assign(h, o) : h;
}
// rectangular version: box centred on the point
export function box(f, where, w, hgt, dmg, ang, bk, kg, o) {
  const h = { f, w, h: hgt, dmg, ang, bk, kg };
  if (typeof where === 'string') h.at = where; else { h.x = where[0]; h.y = -where[1]; }
  return o ? Object.assign(h, o) : h;
}

// mark a move as an aerial: landing lag + the window in which landing has lag
export const air = (mv, landLag = 11, ac) => Object.assign(mv, { kind: 'air', landLag, ac });

// A standard grab. reach = how far in front of the body the grab hitbox sits.
export function stdGrab(pose, reach = 30, o = {}) {
  return Object.assign({
    kind: 'grab', frames: 30, pose, sfx: { 5: 'swishS' },
    hits: [{ f: [6, 8], x: reach, y: -(o.h || 30), r: o.r || 13, dmg: 0, grab: true }],
  }, o.move);
}

// Four throws from one description each: {dmg, ang, bk, kg, pose, f (release frame), frames, sfx}
export function stdThrows(t) {
  const mk = (d, defAng, rev) => ({
    kind: 'throw', frames: d.frames || 30, pose: d.pose,
    throw: { f: d.f || 12, dmg: d.dmg, ang: d.ang === undefined ? defAng : d.ang, bk: d.bk === undefined ? 55 : d.bk, kg: d.kg === undefined ? 60 : d.kg, rev: d.rev === undefined ? rev : d.rev, sfx: d.sfx, fx: d.fx },
    sfx: d.sfxAt, events: d.events, hits: d.hits,
  });
  const out = {};
  if (t.f) out.fthrow = mk(t.f, 42, false);
  if (t.b) out.bthrow = mk(t.b, 42, true);
  if (t.u) out.uthrow = mk(t.u, 90, false);
  if (t.d) out.dthrow = mk(t.d, 70, false);
  return out;
}

// Spawn a projectile in front of a fighter. Offsets are in the fighter's
// facing space ([forward, up]); velocity likewise.
export function shoot(f, m, o) {
  const p = new Projectile(m, Object.assign({}, o, {
    owner: f,
    x: f.x + f.facing * (o.x || 0) * f.scale, y: f.y - (o.y || 0) * f.scale,
    vx: f.facing * (o.vx || 0), vy: o.vy || 0,
  }));
  return m.spawn(p);
}

// How many of this fighter's projectiles with a given tag are alive.
export function countMine(f, m, tag) {
  let n = 0;
  for (const e of m.entities) if (e.owner === f && e.tag === tag && !e.dead) n++;
  return n;
}

// Costume helper: takes a base palette and a list of [name, overrides].
export function costumes(base, list) {
  return list.map(([name, over]) => ({ name, pal: Object.assign({}, base, over) }));
}

// A short "hold the pose" taunt from one key pose.
export function stdTaunt(pose, frames = 60, sfx) {
  return { kind: 'taunt', frames, pose: K([0, {}], [10, pose, 'back'], [frames - 12, pose], [frames, {}]), sfx: sfx ? { 8: sfx } : undefined, iasa: frames - 8 };
}
