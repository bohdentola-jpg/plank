// CPU opponents. A CPU plays through the same button snapshot a human does,
// so it can only do what a player could. Level 1 dawdles and whiffs; level 9
// spaces, shields, punishes and edge-guards.

import { G } from '../core/config.js';
import { blankSnap } from '../core/input.js';
import { RNG, clamp, sign } from '../core/util.js';
import { groundBelow, ledgesOf } from './physics.js';

// ---- what each move reaches, worked out once per character -----------------
const infoCache = new Map();
export function analyze(def) {
  if (infoCache.has(def.id)) return infoCache.get(def.id);
  const st = Object.assign({}, G.stats, def.stats);
  const out = {};
  const mk = (grounded) => ({ def, st, w: st.w, h: st.h, scale: 1, x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, facing: 1, grounded, state: 'move', sf: 0, t: 0, cycle: 0, mf: 0, charge: 0,
    move: null, moveId: '', inp: blankSnap(), v: {}, pal: def.costumes[0].pal, tumble: false, lag: 0, rollDir: 1, pummelT: 0, stunKind: '', jumps: 1, hook() {}, isDummy: true, m: null });
  for (const id in def.moves) {
    const mv = def.moves[id];
    const info = { id, start: 99, end: 0, x1: 1e9, x2: -1e9, y1: 1e9, y2: -1e9, dmg: 0, power: 0, hasHit: false, grab: false, frames: mv.frames, air: mv.kind === 'air' };
    if (mv.hits) {
      const d = mk(mv.kind !== 'air');
      d.move = mv; d.moveId = id;
      if (def.hooks && def.hooks.init) { try { def.hooks.init(d, null); } catch (e) { /* fine */ } }
      for (const hb of mv.hits) {
        info.start = Math.min(info.start, hb.f[0]); info.end = Math.max(info.end, hb.f[1]);
        if (hb.grab) info.grab = true;
        info.dmg = Math.max(info.dmg, hb.dmg || 0);
        info.power = Math.max(info.power, (hb.dmg || 0) * (hb.kg === undefined ? 50 : hb.kg) / 100 + (hb.bk || 0) * 0.45);
        const step = Math.max(1, Math.floor((hb.f[1] - hb.f[0]) / 4));
        for (let fr = hb.f[0]; fr <= hb.f[1]; fr += step) {
          d.mf = fr;
          try {
            const pose = def.pose(d, null), pts = def.points ? def.points(d, pose) : {};
            const add = (px, py) => {
              const rx = hb.w ? hb.w / 2 : (hb.r || 12), ry = hb.h ? hb.h / 2 : (hb.r || 12);
              info.x1 = Math.min(info.x1, px - rx); info.x2 = Math.max(info.x2, px + rx);
              info.y1 = Math.min(info.y1, py - ry); info.y2 = Math.max(info.y2, py + ry);
            };
            let p = hb.at ? (pts[hb.at] || [0, -st.h / 2]) : [hb.x || 0, hb.y === undefined ? -st.h / 2 : hb.y];
            add(p[0] + (hb.off ? hb.off[0] : 0), p[1] + (hb.off ? hb.off[1] : 0));
            if (hb.to && pts[hb.to]) add(pts[hb.to][0], pts[hb.to][1]);
            info.hasHit = true;
          } catch (e) { /* a move that needs a live match to pose: skip */ }
        }
      }
    }
    if (def.ai && def.ai[id]) Object.assign(info, def.ai[id]);
    out[id] = info;
  }
  infoCache.set(def.id, out);
  return out;
}

const GROUND_ATK = ['jab', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'grab'];
const AIR_ATK = ['nair', 'fair', 'bair', 'uair', 'dair'];

export class CPU {
  constructor(level = 5) {
    this.level = clamp(level, 1, 9);
    this.isCPU = true; this.tapJump = false;
    this.snap = blankSnap(); this.snap.digital = false;
    this.q = [];                 // queued input steps
    this.wait = 0; this.mode = 'approach'; this.modeT = 0;
    this.px = 0; this.py = 0;
    this.holds = {};
    this.rng = new RNG(1234 + level);
    this.target = null; this.ledgeT = 0; this.cool = 0; this.dodgeCool = 0;
  }
  bind(f, m) {
    this.f = f; this.rng = new RNG((m.rng.next() * 1e9) | 0);
    this.info = analyze(f.def);
    this.hints = f.def.ai || {};
  }

  // ---- low-level button plumbing ----
  begin() {
    const s = this.snap;
    for (const a in s.p) s.p[a] = false;
    for (const a in s.h) { if (this.holds[a] > 0) { this.holds[a]--; s.h[a] = true; } else s.h[a] = false; }
    this.nx = 0; this.ny = 0;
  }
  press(a, hold = 1) { const s = this.snap; if (!s.h[a]) s.p[a] = true; s.h[a] = true; this.holds[a] = Math.max(this.holds[a] || 0, hold - 1); }
  stick(x, y) { this.nx = x; this.ny = y; }
  end() {
    const s = this.snap;
    s.tapX = Math.abs(this.nx) > 0.8 && Math.abs(this.px) < 0.4 ? sign(this.nx) : 0;
    s.tapY = Math.abs(this.ny) > 0.8 && Math.abs(this.py) < 0.4 ? sign(this.ny) : 0;
    s.x = this.nx; s.y = this.ny; this.px = this.nx; this.py = this.ny;
  }
  queue(...steps) { for (const s of steps) this.q.push(Object.assign({ n: 1 }, s)); }

  read(f, m) {
    this.begin();
    try { this.think(f, m); } catch (e) { if (typeof console !== 'undefined' && !this._warned) { this._warned = true; console.warn('CPU error', e); } }
    this.end();
    return this.snap;
  }

  // ---- the brain ----
  think(f, m) {
    const L = this.level, r = this.rng;
    if (this.cool > 0) this.cool--;
    if (this.dodgeCool > 0) this.dodgeCool--;
    if (m.state !== 'fight' && m.state !== 'over') return;
    if (f.def.hooks && f.def.hooks.ai && f.def.hooks.ai(f, m, this) === true) return;

    const st = f.state;
    if (st === 'dead') { this.q.length = 0; return; }
    if (st === 'respawn') { if (f.respawnT > 50 + (9 - L) * 8) this.stick(0, 1); return; }
    if (st === 'grabbed' || st === 'stun') { if (m.frame % (11 - L) === 0) { this.press('attack'); this.stick(r.sign(), 0); } return; }
    if (st === 'hitstun' || st === 'trapped') {
      // hold toward the stage and a little up: decent survival DI
      const c = this.centerX(m);
      this.stick(sign(c - f.x) * 0.9, L >= 5 ? -0.5 : 0);
      if (L >= 6 && f.tumble && f.ky + f.vy > 2 && groundBelow(m.stage, f.x, f.y, 26) && r.chance(0.5)) this.press('shield');
      this.q.length = 0;
      return;
    }
    if (st === 'down') { if (f.sf > 14 + (9 - L) * 5) { const o = r.next(); if (o < 0.35) this.stick(0, -1); else if (o < 0.7) this.stick(r.sign(), 0); else this.press('attack'); } return; }
    if (st === 'ledge') return this.onLedge(f, m);

    // off the stage? getting back comes before everything
    if (!f.grounded && this.needsRecovery(f, m)) { this.q.length = 0; return this.recover(f, m); }

    // run any queued inputs
    if (this.q.length) {
      const s = this.q[0];
      if (s.when && !s.when(f, m)) { if (--s.timeout <= 0) this.q.shift(); else { this.stick(s.x || 0, s.y || 0); return; } }
      this.stick(s.x || 0, s.y || 0);
      if (s.press) for (const a of s.press) this.press(a, s.hold || 1);
      if (s.charge) f.v.aiCharge = s.charge;
      if (--s.n <= 0) this.q.shift();
      return;
    }
    if (f.state === 'move' || f.state === 'land' && f.sf < f.lag - 1) { this.holdSpecial(f, m); return; }

    const t = this.pickTarget(f, m);
    this.target = t;
    if (this.defend(f, m)) return;
    if (this.wait > 0) { this.wait--; return this.footsies(f, m, t); }

    if (f.superReady && t && this.trySuper(f, m, t)) return;
    const star = m.items.star;
    if (star && !star.leaving && !f.superReady && (!t || Math.hypot(star.x - f.x, star.y - f.cy) < 420 || r.chance(0.02))) return this.chase(f, m, star.x, star.y, true);
    if (!t) { this.wander(f, m); return; }

    if (this.tryAttack(f, m, t)) return;
    this.approach(f, m, t);
  }

  centerX(m) { const st = m.stage; return st.focusX || 0; }

  pickTarget(f, m) {
    let best = null, bs = 1e9;
    for (const o of m.fighters) {
      if (o === f || o.out || o.team === f.team || o.state === 'dead') continue;
      let d = Math.hypot(o.x - f.x, (o.y - f.y) * 1.3);
      if (o.state === 'respawn' || o.invuln > 30) d += 500;
      d -= Math.min(120, o.pct) * 0.6;
      if (o === this.target) d -= 60;
      if (d < bs) { bs = d; best = o; }
    }
    return best;
  }

  // Is there floor under (or near) us to land on?
  needsRecovery(f, m) {
    if (f.def.floats) return false;
    const st = m.stage;
    if (groundBelow(st, f.x, f.y - 4, 900)) return false;
    // still over nothing: only "fine" if we're rising toward a platform we can reach
    return true;
  }

  recoverTarget(f, m) {
    let best = null, bd = 1e9;
    for (const L of ledgesOf(m.stage)) {
      const d = Math.abs(L.x - f.x) + Math.max(0, f.y - L.y) * 0.6;
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }

  recover(f, m) {
    const L = this.level, r = this.rng, tg = this.recoverTarget(f, m);
    if (!tg) { this.stick(sign(this.centerX(m) - f.x), 0); return; }
    const dx = tg.x - f.x, dir = sign(dx) || 1;
    this.stick(dir, 0);
    if (f.state === 'helpless' || f.state === 'airdodge') return;
    if (f.state === 'move') { this.holdSpecial(f, m); return; }
    const below = f.y - tg.y;             // + = we're lower than the ledge
    const falling = f.vy + f.ky > -1;
    const hint = this.hints.recovery || {};
    const upReach = hint.up === undefined ? 200 : hint.up;
    if (L <= 2 && r.chance(0.02)) return;
    if (falling && f.jumps > 0 && (below > -40 || Math.abs(dx) > 260)) { this.press('jump', 12); return; }
    if (falling && f.jumps <= 0 && f.def.moves.uspecial) {
      const mv = f.def.moves.uspecial;
      const can = !mv.can || mv.can(f, m);
      if (can && (below > upReach * 0.25 || Math.abs(dx) < 120 && below > -10 || below > 30)) { this.stick(dir * 0.6, -1); this.press('special', hint.holdUp || 1); return; }
    }
    // a side special that travels can help cover distance
    if (hint.side && falling && Math.abs(dx) > hint.side && f.jumps <= 0 && below < 60 && r.chance(0.3)) { this.stick(dir, 0); this.press('special'); }
  }

  holdSpecial(f, m) {
    // keep steering during moves that can be aimed (recoveries, chargeable specials)
    const tg = this.target;
    if (!f.grounded && this.needsRecovery(f, m)) { const L = this.recoverTarget(f, m); if (L) this.stick(sign(L.x - f.x), -0.6); if (this.hints.recovery && this.hints.recovery.holdUp) this.snap.h.special = true; return; }
    if (tg) this.stick(sign(tg.x - f.x) * 0.6, 0);
  }

  onLedge(f, m) {
    const r = this.rng;
    if (++this.ledgeT < 16 + (9 - this.level) * 5 + (f.id.charCodeAt(1) % 3) * 6) return;
    this.ledgeT = 0;
    const o = r.next(), Lg = f.ledge;
    const danger = m.foes(f).some((e) => Math.abs(e.x - Lg.x) < 90 && e.grounded);
    if (danger && this.level >= 5) { if (o < 0.4) this.press('shield'); else if (o < 0.7) this.press('jump'); else this.press('attack'); return; }
    if (o < 0.6) this.stick(-Lg.dir, 0); else if (o < 0.8) this.press('jump'); else this.press('attack');
  }

  // shield / dodge incoming attacks
  defend(f, m) {
    const L = this.level, r = this.rng;
    if (L < 3 || this.dodgeCool > 0 || !f.grounded || f.def.noShield) return false;
    let threat = false, projThreat = null;
    for (const o of m.foes(f)) {
      if (o.state !== 'move' || !o.move || !o.move.hits) continue;
      const dx = Math.abs(o.x - f.x), dy = Math.abs(o.cy - f.cy);
      if (dx > 150 || dy > 110) continue;
      const mv = o.move;
      let soon = false;
      for (const hb of mv.hits) if (!hb.grab && o.mf >= hb.f[0] - 7 && o.mf <= hb.f[1]) soon = true;
      if (soon && sign(f.x - o.x) === o.facing || soon && dx < 46) threat = true;
    }
    if (!threat) for (const e of m.entities) {
      if (!e.hit || e.dead || e.owner === f || (e.owner && e.team === f.team)) continue;
      const dx = e.x - f.x, dy = e.y - f.cy;
      if (Math.abs(dy) < 60 && Math.abs(dx) < 130 && (Math.abs(e.vx || 0) < 0.5 ? Math.abs(dx) < 40 : sign(e.vx) === -sign(dx))) { projThreat = e; break; }
    }
    if (!threat && !projThreat) return false;
    const p = (L - 2) * 0.1;            // chance to react at all, per frame of threat
    if (!r.chance(p)) return false;
    this.dodgeCool = 26 + (9 - L) * 4;
    const o = r.next();
    if (projThreat && o < 0.35) { this.queue({ press: ['jump'], hold: 10 }); return true; }
    if (o < 0.62) this.queue({ press: ['shield'], hold: 14 + r.int(0, 10) });
    else if (o < 0.82) this.queue({ press: ['shield'], hold: 3 }, { x: r.sign(), press: ['shield'], hold: 2 });
    else this.queue({ press: ['shield'], hold: 3 }, { y: 1, press: ['shield'], hold: 2 });
    return true;
  }

  footsies(f, m, t) {
    if (!t) return;
    const dx = t.x - f.x;
    if (this.mode === 'retreat') this.safeMove(f, m, -sign(dx) * 0.9);
    else if (Math.abs(dx) > 150) this.safeMove(f, m, sign(dx) * 0.5);
  }

  // walk somewhere without strolling off a cliff
  safeMove(f, m, x) {
    if (f.grounded && f.ground && x) {
      const g = f.ground, ahead = f.x + sign(x) * 46;
      if (ahead < g.x || ahead > g.x + g.w) {
        if (!groundBelow(m.stage, ahead + sign(x) * 30, f.y - 30, 400)) { this.stick(0, 0); return false; }
      }
    }
    this.stick(x, 0);
    return true;
  }

  wander(f, m) { const c = this.centerX(m); if (Math.abs(f.x - c) > 120) this.safeMove(f, m, sign(c - f.x) * 0.6); }

  chase(f, m, x, y, attack) {
    const dx = x - f.x, dy = y - f.cy;
    if (attack && Math.abs(dx) < 46 && Math.abs(dy) < 50) { this.stick(sign(dx), dy < -24 ? -1 : 0); this.press('attack'); this.cool = 12; return; }
    if (Math.abs(dx) > 20) this.safeMove(f, m, sign(dx));
    if (dy < -50 && (f.grounded || (f.jumps > 0 && f.vy > 0)) && Math.abs(dx) < 160 && this.cool <= 0) { this.press('jump', 14); this.cool = 14; }
    if (!f.grounded && attack && Math.abs(dx) < 60 && Math.abs(dy) < 70 && this.cool <= 0) { this.stick(sign(dx) * 0.5, dy < -20 ? -1 : dy > 30 ? 1 : 0); this.press('attack'); this.cool = 20; }
  }

  trySuper(f, m, t) {
    const h = this.hints.super || {};
    const range = h.range === undefined ? 190 : h.range, dy = Math.abs(t.cy - f.cy);
    const dx = t.x - f.x;
    if (Math.abs(dx) > range || dy > (h.dy === undefined ? 90 : h.dy)) return false;
    if (h.grounded && !f.grounded) return false;
    if (t.invuln > 10) return false;
    if (sign(dx) !== f.facing && Math.abs(dx) > 12 && !h.anyFacing) { this.stick(sign(dx), 0); return true; }
    this.stick(0, 0); this.press('special');
    return true;
  }

  // score every move against where the target is about to be
  tryAttack(f, m, t) {
    const L = this.level, r = this.rng, I = this.info;
    if (this.cool > 0) return false;
    if (t.invuln > 12 && L >= 4) return false;
    const dxW = t.x - f.x, adx = Math.abs(dxW), dir = sign(dxW) || f.facing;
    const tw = t.w * t.scale / 2 + 4, tTop = (t.y - t.h * t.scale) - f.y, tBot = t.y - f.y;
    const rvx = (t.vx + t.kx - f.vx) * dir;       // closing speed (negative = getting closer)
    const cand = [];
    const consider = (id, w) => {
      const a = I[id];
      if (!a || !f.def.moves[id]) return;
      const mv = f.def.moves[id];
      if (mv.can && !mv.can(f, m)) return;
      if (a.range) {       // hinted ranged move
        if (adx >= a.range[0] && adx <= a.range[1] && Math.abs(t.cy - f.cy) < (a.dy || 70)) cand.push([id, w * (a.w || 1)]);
        return;
      }
      if (!a.hasHit) return;
      const lead = a.start + 1, px = adx + rvx * lead * 0.6;
      const ty1 = tTop + (t.vy + t.ky) * lead * 0.5, ty2 = tBot + (t.vy + t.ky) * lead * 0.5;
      if (px - tw > a.x2 + 4 || px + tw < a.x1 - 4) return;
      if (ty1 > a.y2 + 6 || ty2 < a.y1 - 6) return;
      let s = w;
      const killing = t.pct > 85 + (t.st.weight - 100) * 0.5;
      if (killing) s *= 0.5 + a.power / 22; else s *= 1.4 - Math.min(1, a.start / 26) + a.dmg / 30;
      if (a.grab) s *= t.shielding ? 4 : (t.state === 'move' ? 0.2 : 0.8);
      else if (t.shielding) s *= 0.5;
      cand.push([id, Math.max(0.05, s)]);
    };
    if (f.grounded) {
      for (const id of GROUND_ATK) consider(id, id === 'grab' ? 0.8 : id === 'jab' ? 0.9 : 1);
      if ((f.state === 'run' || f.state === 'dash') && f.def.moves.dash) consider('dash', 1.2);
      for (const id of ['nspecial', 'sspecial', 'dspecial']) consider(id, 0.55);
      if (I.uspecial && I.uspecial.hasHit && !this.hints.noUpB) consider('uspecial', 0.12);
    } else {
      // aerials: reach boxes are in facing space, so mirror for what's behind us
      const front = dir === f.facing;
      for (const id of AIR_ATK) {
        const a = I[id]; if (!a || !a.hasHit || !f.def.moves[id]) continue;
        const lead = a.start + 1;
        const relx = (dxW + (t.vx + t.kx - f.vx) * lead * 0.6) * f.facing;
        const ty1 = tTop + (t.vy + t.ky - f.vy) * lead * 0.5, ty2 = tBot + (t.vy + t.ky - f.vy) * lead * 0.5;
        if (relx - tw > a.x2 + 4 || relx + tw < a.x1 - 4) continue;
        if (ty1 > a.y2 + 6 || ty2 < a.y1 - 6) continue;
        let s = 1 + a.dmg / 20;
        if (id === 'dair' && groundBelow(m.stage, f.x, f.y, 500) === null) s *= 0.15;
        cand.push([id, s]);
      }
      for (const id of ['nspecial', 'sspecial']) consider(id, 0.3);
    }
    if (!cand.length) return false;
    // lower levels hesitate and choose worse
    if (!r.chance(0.25 + L * 0.085)) { this.wait = r.int(2, 14 - L); return true; }
    let tot = 0; for (const c of cand) { if (L >= 6) c[1] = c[1] * c[1]; tot += c[1]; }
    let pick = r.next() * tot, id = cand[0][0];
    for (const c of cand) { pick -= c[1]; if (pick <= 0) { id = c[0]; break; } }
    this.doMove(f, m, id, dir, t);
    return true;
  }

  doMove(f, m, id, dir, t) {
    const r = this.rng, L = this.level;
    const a = this.info[id] || {};
    this.cool = Math.max(6, (14 - L) * 2) + r.int(0, 8);
    const after = () => { if (r.chance(0.35 - L * 0.02)) { this.wait = r.int(10, 40); this.mode = r.chance(0.5) ? 'retreat' : 'hold'; } };
    switch (id) {
      case 'jab': this.queue({ x: 0, press: ['attack'] }, { n: 5 }, { press: ['attack'] }, { n: 6 }, { press: ['attack'] }); break;
      case 'ftilt': this.queue({ x: dir, press: ['attack'] }); break;
      case 'utilt': this.queue({ y: -1, press: ['attack'] }); break;
      case 'dtilt': this.queue({ y: 1, press: ['attack'] }); break;
      case 'dash': this.queue({ x: dir, press: ['attack'] }); break;
      case 'fsmash': this.queue({ x: dir, press: ['strong'], charge: L >= 5 && t.state === 'stun' ? 40 : r.chance(0.2) ? r.int(8, 26) : 0 }); break;
      case 'usmash': this.queue({ y: -1, press: ['strong'], charge: r.chance(0.15) ? r.int(6, 20) : 0 }); break;
      case 'dsmash': this.queue({ y: 1, press: ['strong'] }); break;
      case 'grab': this.queue({ press: ['grab'] }, { n: 14 }, { x: r.chance(0.5) ? dir : -dir, y: r.chance(0.3) ? -1 : 0, n: 6 }, { press: ['attack'] }, { n: 10 }, { x: r.pick([-1, 1, 0]), y: r.pick([-1, 0, 1, 0]), n: 4 }, { x: dir, n: 3 }); break;
      case 'nspecial': this.queue({ x: 0, y: 0, n: 1 }, { press: ['special'], hold: a.hold || 1 }); if (sign(dir) !== f.facing && f.grounded) this.q.unshift({ x: dir, n: 2 }); break;
      case 'sspecial': this.queue({ x: dir, press: ['special'], hold: a.hold || 1 }); break;
      case 'dspecial': this.queue({ y: 1, press: ['special'], hold: a.hold || 1 }); break;
      case 'uspecial': this.queue({ y: -1, press: ['special'] }); break;
      case 'nair': this.queue({ x: 0, y: 0, press: ['attack'] }); break;
      case 'fair': this.queue({ x: f.facing, press: ['attack'] }); break;
      case 'bair': this.queue({ x: -f.facing, press: ['attack'] }); break;
      case 'uair': this.queue({ y: -1, press: ['attack'] }); break;
      case 'dair': this.queue({ y: 1, press: ['attack'] }); break;
      default: this.queue({ press: ['attack'] });
    }
    after();
  }

  approach(f, m, t) {
    const L = this.level, r = this.rng;
    const dx = t.x - f.x, adx = Math.abs(dx), dy = t.y - f.y, dir = sign(dx) || 1;
    if (++this.modeT > 50 + r.int(0, 60)) {
      this.modeT = 0;
      const o = r.next();
      this.mode = o < 0.62 + L * 0.02 ? 'approach' : o < 0.85 ? 'hold' : 'retreat';
      if (L <= 3 && r.chance(0.4)) this.wait = r.int(10, 50);
    }
    // keep-away characters (ranged) like some room
    const keep = this.hints.keep || 0;
    if (keep && adx < keep && f.grounded && r.chance(0.5)) { if (this.safeMove(f, m, -dir)) return; }
    if (this.mode === 'retreat' && adx < 220) { if (!this.safeMove(f, m, -dir * 0.9)) this.mode = 'approach'; return; }
    if (this.mode === 'hold' && adx < 170 && adx > 80) { this.stick(0, 0); return; }

    const targetOff = !groundBelow(m.stage, t.x, t.y - 4, 900);
    if (targetOff && f.grounded) {
      // edge-guard: go and wait at the lip rather than leap after them
      const g = f.ground, edge = dx > 0 ? g.x + g.w - 26 : g.x + 26;
      if (L >= 5 && Math.abs(f.x - edge) > 14) this.safeMove(f, m, sign(edge - f.x));
      else { this.stick(0, 0); if (L >= 5 && f.facing !== dir) this.stick(dir * 0.3, 0); }
      return;
    }
    if (f.grounded) {
      if (!this.safeMove(f, m, dir)) {
        // gap between us: hop it if the far side has floor
        if (groundBelow(m.stage, f.x + dir * 150, f.y - 60, 400) || dy < -40) this.press('jump', 14);
        return;
      }
      if (dy < -60 && adx < 150 && r.chance(0.2)) { this.press('jump', dy < -110 ? 14 : 2); return; }
      if (dy > 40 && f.ground && f.ground.soft && adx < 120 && r.chance(0.2)) { this.queue({ y: 1, n: 11 }); return; }
      // jump-in from mid range
      if (adx > 70 && adx < 190 && r.chance(0.012 + L * 0.004) && !this.hints.noJumpIn) { this.press('jump', r.chance(0.5) ? 2 : 14); return; }
    } else {
      this.stick(dir * (adx > 24 ? 1 : 0.2), 0);
      if (dy < -70 && f.jumps > 0 && f.vy > 1 && adx < 140 && r.chance(0.1)) this.press('jump', 10);
      if (dy > 60 && f.vy > 0 && adx < 60 && r.chance(0.08)) this.stick(dir * 0.3, 1);
    }
  }
}
