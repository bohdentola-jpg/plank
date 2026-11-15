// A match: owns the stage, the fighters and everything flying around, and
// referees every hit, knockout and respawn.

import { G, W, H, PLAYER_COLORS } from '../core/config.js';
import { RNG, clamp, DEG, circleRect, rectsOverlap, sign } from '../core/util.js';
import { Fighter } from './fighter.js';
import { Fx } from './fx.js';
import { Camera } from './camera.js';
import { refreshSurfaces } from './physics.js';
import { ItemDirector, HELPERS } from './items.js';
import './helpers.js';

export function calcKB(pct, dmg, weight, bk, kg) {
  return ((((pct / 10 + (pct * dmg) / 20) * (200 / (weight + 100)) * 1.4) + 18) * (kg / 100)) + bk;
}

export class Match {
  // opts: { stageDef, players:[{def, ctl, costume, cpuLevel, tag}], rules:{stocks,time,items,hazards},
  //         seed, audio, skipIntro, shakeScale }
  constructor(opts) {
    this.opts = opts;
    this.rules = Object.assign({ stocks: 3, time: 0, items: true, hazards: true }, opts.rules);
    this.rng = new RNG(opts.seed || ((Math.random() * 1e9) | 0));
    this.audio = opts.audio || null;
    this.shakeScale = opts.shakeScale === undefined ? 1 : opts.shakeScale;
    this.frame = 0; this.real = 0;
    this.fx = new Fx(this);
    this.entities = [];
    this.fighters = [];
    this.stageDef = opts.stageDef;
    this.stage = opts.stageDef.build(this);
    this.stage.def = opts.stageDef;
    let sid = 0;
    for (const s of this.stage.solids) if (!s.id) s.id = 's' + sid++;
    for (const s of this.stage.plats) if (!s.id) s.id = 'p' + sid++;
    refreshSurfaces(this.stage);
    this.cam = new Camera(this);

    opts.players.forEach((p, i) => {
      const f = new Fighter(this, p.def, i, p);
      f.tag = p.tag || (f.isCPU ? 'CPU' : 'P' + (i + 1));
      f.color = f.isCPU && !p.keepColor ? PLAYER_COLORS[i] : PLAYER_COLORS[i];
      const sp = this.stage.spawns[i % this.stage.spawns.length];
      f.x = sp[0]; f.y = sp[1]; f.facing = sp[0] > (this.stage.focusX || 0) ? -1 : 1;
      f.grounded = false;
      if (p.ctl && p.ctl.bind) p.ctl.bind(f, this);
      this.fighters.push(f);
    });

    this.state = opts.skipIntro ? 'fight' : 'intro';
    this.stateT = 0;
    this.timer = this.rules.time ? this.rules.time * 60 : 0;
    this.hold = 0;               // whole-game freeze (super cut-ins)
    this.slow = 1; this.slowT = 0; this._acc = 0;
    this.banner = null;          // {text, t, life, ...}
    this.count = null;           // countdown digit {n, t}
    this.cut = null;             // super cut-in {f, t}
    this.cines = [];             // running super/cinematic controllers
    this.overlays = [];          // extra screen-space draw callbacks {draw(ctx,m), dead}
    this.done = false; this.result = null; this.overT = 0;
    this.elim = [];              // slots in the order they went out
    this.paused = false;
    this.items = new ItemDirector(this);
    if (this.stage.init) this.stage.init(this);
    for (const f of this.fighters) f.updatePose();
    this.cam.snap();
    if (opts.skipIntro) for (const f of this.fighters) f.setState('air');
  }

  // ------------------------------------------------------------- services --
  sfx(name, o) { if (this.audio) this.audio.sfx(name, o); }
  shake(a) { this.cam.shake(a); }
  spawn(e) { this.entities.push(e); return e; }
  announce(text, o = {}) { this.banner = Object.assign({ text, t: 0, life: 90 }, o); }
  alive() { return this.fighters.filter((f) => !f.out); }
  foes(f) { return this.fighters.filter((o) => o !== f && !o.out && o.team !== f.team && o.state !== 'dead' && o.state !== 'respawn'); }
  ledgeTaken(L, who) {
    for (const f of this.fighters) if (f !== who && f.ledge && f.ledge.key === L.key && (f.state === 'ledge' || f.state === 'ledgeclimb')) return true;
    return false;
  }
  slowmo(scale, frames) { this.slow = scale; this.slowT = frames; }

  superCutIn(f) {
    this.hold = 38; this.cut = { f, t: 0 };
    this.sfx('super');
    this.cam.focus = { x: f.x, y: f.cy - 10, zoom: 1.25, t: 44 };
    f.invuln = Math.max(f.invuln, 50);
  }

  // ---------------------------------------------------------------- frame --
  update() {
    this.real++;
    if (this.paused) return;
    if (this.banner && ++this.banner.t > this.banner.life) this.banner = null;
    for (let i = this.overlays.length - 1; i >= 0; i--) if (this.overlays[i].dead) this.overlays.splice(i, 1);

    if (this.hold > 0) {
      this.hold--;
      if (this.cut && ++this.cut.t > 44) this.cut = null;
      this.cam.update(); this.fx.update();
      return;
    }
    if (this.cut && ++this.cut.t > 44) this.cut = null;

    if (this.slowT > 0) {
      this.slowT--;
      this._acc += this.slow;
      if (this._acc < 1) { this.cam.update(); return; }
      this._acc -= 1;
      if (this.slowT === 0) this.slow = 1;
    }
    this.step();
  }

  step() {
    this.frame++;
    this.stateT++;
    if (this.state === 'intro') this.intro();
    if (this.stage.update) this.stage.update(this);

    for (const f of this.fighters) if (!f.out) f.readInput();
    for (const f of this.fighters) if (!f.out) f.update();

    const E = this.entities;
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (!e.dead) e.update(this); }
    for (let i = E.length - 1; i >= 0; i--) if (E[i].dead) E.splice(i, 1);

    for (let i = this.cines.length - 1; i >= 0; i--) {
      const c = this.cines[i];
      if (c.update(this) === true || c.dead) { if (c.end) c.end(this); this.cines.splice(i, 1); }
    }

    this.processHits();
    this.pushApart();
    if (this.state === 'fight') this.items.update();

    this.fx.update();
    this.cam.update();

    if (this.state === 'fight' && this.timer > 0) {
      this.timer--;
      if (this.timer === 600) { this.sfx('v_hurry'); this.announce('HURRY UP!', { life: 70, size: 44 }); }
      if (this.timer <= 300 && this.timer > 0 && this.timer % 60 === 0) { this.sfx('tick'); this.count = { n: this.timer / 60, t: 0 }; }
      if (this.timer === 0) this.finish('time');
    }
    if (this.count && ++this.count.t > 50) this.count = null;
    if (this.state === 'over') {
      this.overT++;
      if (this.overT > 190) this.done = true;
    }
  }

  intro() {
    const t = this.stateT;
    const say = (n, v) => { this.count = { n, t: 0 }; this.sfx(v); };
    if (t === 24) say(3, 'v_3');
    if (t === 62) say(2, 'v_2');
    if (t === 100) say(1, 'v_1');
    if (t === 138) {
      this.count = null; this.state = 'fight'; this.stateT = 0;
      this.announce('GO!', { life: 46, size: 120, pop: true, color: '#ffe23a' });
      this.sfx('v_go'); this.sfx('bell');
    }
  }

  // ----------------------------------------------------------------- hits --
  // world-space shapes for one hitbox of a fighter's move
  shapesFor(f, hb) {
    const s = f.scale, P = f.pts || {};
    const out = [];
    const base = hb.at ? (P[hb.at] || [0, -f.h / 2]) : [hb.x || 0, hb.y === undefined ? -f.h / 2 : hb.y];
    const ox = hb.off ? hb.off[0] : 0, oy = hb.off ? hb.off[1] : 0;
    const wx = f.x + f.facing * (base[0] + ox) * s, wy = f.y + (base[1] + oy) * s;
    if (hb.w) { out.push({ x: wx - (hb.w * s) / 2, y: wy - (hb.h * s) / 2, w: hb.w * s, h: hb.h * s }); return out; }
    const r = (hb.r || 12) * s;
    out.push({ x: wx, y: wy, r });
    if (hb.to) {      // a capsule from `at` to `to`, sampled as circles
      const b2 = P[hb.to] || base;
      const x2 = f.x + f.facing * b2[0] * s, y2 = f.y + b2[1] * s;
      const d = Math.hypot(x2 - wx, y2 - wy), n = Math.max(1, Math.ceil(d / (r * 1.1)));
      for (let i = 1; i <= n; i++) out.push({ x: wx + ((x2 - wx) * i) / n, y: wy + ((y2 - wy) * i) / n, r });
    }
    return out;
  }

  overlap(shapes, boxes) {
    for (const s of shapes) for (const b of boxes) {
      if (s.r !== undefined ? circleRect(s.x, s.y, s.r, b.x, b.y, b.w, b.h) : rectsOverlap(s, b)) return s;
    }
    return null;
  }

  canBeHit(t) {
    return !t.out && t.state !== 'dead' && t.state !== 'respawn' && t.state !== 'entrance' && !t.intangible && !t.superActive;
  }

  processHits() {
    const pend = [];
    // fighters' moves
    for (const f of this.fighters) {
      if (f.out || f.state !== 'move' || !f.move || !f.move.hits) continue;
      const fr = f.mf, mv = f.move;
      for (const t of this.fighters) {
        if (t === f || t.team === f.team && !mv.friendly) continue;
        if (!this.canBeHit(t)) continue;
        let boxes = null;
        for (let i = 0; i < mv.hits.length; i++) {
          const hb = mv.hits[i];
          if (fr < hb.f[0] || fr > hb.f[1]) continue;
          if (hb.only === 'g' && !t.grounded) continue;
          if (hb.only === 'a' && t.grounded) continue;
          const key = t.id + '|' + (hb.group === undefined ? 0 : hb.group);
          const last = f.hitLog.get(key);
          if (last !== undefined && (!hb.rehit || this.frame - last < hb.rehit)) continue;
          if (t.grabbedBy === f && !hb.hitsGrabbed) continue;
          boxes = boxes || t.hurtboxes();
          const s = this.overlap(this.shapesFor(f, hb), boxes);
          if (!s) continue;
          f.hitLog.set(key, this.frame);
          pend.push({ src: { owner: f, fighter: f, x: f.x, y: f.cy, facing: f.facing, mul: this.chargeMul(f) * f.dmgMul }, t, hb, at: s });
          break;
        }
      }
      // hittable entities (the gold star, breakables...)
      for (const e of this.entities) {
        if (!e.hurt || e.dead) continue;
        for (const hb of mv.hits) {
          if (fr < hb.f[0] || fr > hb.f[1] || hb.grab) continue;
          const key = e.id + '|' + (hb.group === undefined ? 0 : hb.group);
          const last = f.hitLog.get(key);
          if (last !== undefined && (!hb.rehit || this.frame - last < hb.rehit)) continue;
          const s = this.overlap(this.shapesFor(f, hb), e.hurt());
          if (!s) continue;
          f.hitLog.set(key, this.frame);
          const dmg = hb.dmg * this.chargeMul(f) * f.dmgMul;
          e.onHurt(this, f, hb, dmg, f.facing);
          f.freeze = Math.max(f.freeze, Math.min(8, 2 + (dmg * 0.3 | 0)));
          f.moveHit = true;
          break;
        }
      }
    }
    // projectiles, hazards, helpers
    for (const e of this.entities) {
      if (e.dead || !e.hit) continue;
      const shapes = e.hitShapes();
      if (!shapes) continue;
      for (const t of this.fighters) {
        if (!this.canBeHit(t)) continue;
        if (e.owner && (t === e.owner || t.team === e.team) && !e.hitsOwner) continue;
        if (e.ignore && e.ignore(t)) continue;
        const key = t.id;
        const last = e.hitLog.get(key);
        if (last !== undefined && (!e.hit.rehit || this.frame - last < e.hit.rehit)) continue;
        const s = this.overlap(shapes, t.hurtboxes());
        if (!s) continue;
        e.hitLog.set(key, this.frame);
        pend.push({ src: { owner: e.owner, fighter: null, ent: e, x: e.x, y: e.y, facing: e.facing || (t.x >= e.x ? 1 : -1), mul: e.mul || 1 }, t, hb: e.hit, at: s });
      }
      // projectiles can pop hittable entities too
      if (e.kind === 'proj') for (const o of this.entities) {
        if (o === e || !o.hurt || o.dead || e.dead) continue;
        if (e.hitLog.has(o.id)) continue;
        if (!this.overlap(shapes, o.hurt())) continue;
        e.hitLog.set(o.id, this.frame);
        o.onHurt(this, e.owner, e.hit, e.hit.dmg, e.facing || 1);
        if (!e.pierce) e.die(this);
      }
    }
    for (const p of pend) {
      const res = this.applyHit(p.src, p.t, p.hb, p.at);
      if (p.src.ent && p.src.ent.onHit) p.src.ent.onHit(p.t, res, this);
    }
  }

  chargeMul(f) {
    const mv = f.move;
    if (!mv || !mv.charge || !f.charge) return 1;
    return 1 + (f.charge / (mv.charge.max || 60)) * ((mv.charge.mul || 1.4) - 1);
  }

  // Returns 'hit' | 'shield' | 'perfect' | 'grab' | 'armor' | false
  applyHit(src, t, hb, at) {
    const atk = src.fighter, owner = src.owner;
    if (t.invuln > 0 && !hb.grab) return false;
    if (t.invuln > 0 && hb.grab) return false;
    let dmg = (hb.dmg || 0) * (src.mul || 1);
    if (owner && owner.def.tune && owner.def.tune.dmg) dmg *= owner.def.tune.dmg;      // per-fighter balance dial
    const hx = at ? (at.r !== undefined ? at.x : at.x + at.w / 2) : t.x;
    const hy = at ? (at.r !== undefined ? at.y : at.y + at.h / 2) : t.cy;
    const px = clamp(hx, t.x - t.w / 2, t.x + t.w / 2), py = clamp(hy, t.y - t.h * t.scale, t.y);

    let dir = src.facing || 1;
    if (hb.radial || src.ent) {
      if (src.ent && Math.abs(src.ent.vx) > 0.6 && !hb.radial) dir = src.ent.vx > 0 ? 1 : -1;
      else dir = t.x >= src.x ? 1 : -1;
    }
    if (hb.rev) dir = -dir;

    // ---- grabs go through shields ----
    if (hb.grab) {
      if (!atk || t.def.noGrab || t.grabbedBy || t.state === 'grabbed' || t.state === 'ledge' || t.state === 'ledgeclimb' || t.state === 'trapped') return false;
      t.interrupt();
      atk.grabbing = t; t.grabbedBy = atk; t.setState('grabbed');
      atk.setState('grabhold'); atk.grabT = 70 + t.pct * 0.8; atk.pummelT = 0; atk.vx *= 0.3;
      atk.holdVictim();
      this.sfx('grab');
      return 'grab';
    }

    if (t.hook('onHurt', src, hb, dmg) === false) return false;

    // ---- shields ----
    if (t.shielding && !hb.unblockable) {
      const perfect = t.state === 'shield' && t.shieldT <= G.perfectShieldFrames;
      const hl = clamp(Math.floor((G.hitlagBase + dmg * G.hitlagPerDmg) * 0.7), 2, 12);
      if (atk) { atk.freeze = Math.max(atk.freeze, hl); atk.moveHit = true; if (atk.grounded) atk.vx -= dir * Math.min(3.5, 0.5 + dmg * 0.1); }
      if (perfect) {
        t.setState('shieldstun', 3); t.shieldT = 99;
        this.sfx('perfect'); this.fx.ring(px, py, 34, '#ffffff'); this.fx.spark(px, py, 6, '#bff3ff');
        t.flash = 6; t.flashColor = '#ffffff';
        if (src.ent && src.ent.kind === 'proj' && src.ent.reflectable) {
          const e = src.ent; e.vx = -e.vx * 1.15; e.vy = -e.vy * 0.5; e.owner = t; e.team = t.team; e.hitLog.clear(); e.t = 0; e.mul = (e.mul || 1) * 1.3;
          return 'reflect';
        }
        return 'perfect';
      }
      t.shieldHP -= dmg * G.shieldDmgMul + (hb.shieldDmg || 0);
      t.freeze = hl;
      t.setState('shieldstun', Math.floor(dmg * 0.45 + 3));
      t.vx = dir * Math.min(6.5, 1.2 + dmg * 0.22);
      this.sfx('shieldhit', { vol: clamp(0.4 + dmg * 0.03, 0.4, 0.9) }); this.fx.spark(px, py, 5, '#ffffff'); this.fx.ring(px, py, 22, t.color);
      if (t.shieldHP <= 0) t.shieldBreak();
      return 'shield';
    }

    // ---- damage ----
    t.pct = Math.min(999, t.pct + dmg);
    t.stats.taken += dmg;
    if (owner) { owner.stats.dealt += dmg; if (owner !== t) { t.lastHitBy = owner.slot; t.lastHitFrame = this.frame; } }
    if (atk) atk.moveHit = true;

    let kb = hb.set ? hb.set : calcKB(t.pct, dmg, t.st.weight, hb.bk || 0, hb.kg === undefined ? 50 : hb.kg);
    kb *= t.kbMul * (hb.kbMul || 1);
    if (t.state === 'crouch') kb *= 0.86;
    let hitlag = clamp(Math.floor((G.hitlagBase + dmg * G.hitlagPerDmg) * (hb.hl === undefined ? 1 : hb.hl)), hb.hl === 0 ? 0 : 2, G.hitlagMax);
    if (hb.fx === 'elec') hitlag = Math.min(G.hitlagMax, Math.floor(hitlag * 1.5));
    if (atk) atk.freeze = Math.max(atk.freeze, hitlag);

    const power = clamp(kb / 170, 0.15, 1.5);
    this.fx.hit(px, py, hb.fx || 'punch', power);
    this.sfx(hb.sfx || (dmg >= 13 ? 'hitL' : dmg >= 6 ? 'hitM' : 'hitS'), { vol: clamp(0.55 + power * 0.4, 0.5, 1) });
    if (kb > 85) this.shake(Math.min(13, kb / 16));
    if (kb > 150) { this.cam.punch = 0.05; this.sfx('smashhit', { vol: 0.8 }); }
    if (owner && owner !== t) owner.hook('onHit', t, hb, dmg);
    if (hb.onHit) hb.onHit(owner, t, this, src);

    // fighters with no knockback at all (they have a stamina bar instead)
    if (t.def.noKnockback) {
      t.flash = 8; t.flashColor = '#ffffff'; t.freeze = Math.min(hitlag, 6);
      t.hook('onDamage', src, hb, dmg);
      if (t.def.stamina && t.pct >= t.def.stamina) this.ko(t, 'crash');
      return 'hit';
    }
    const armor = Math.max(t.armor, t.permArmor);
    if (armor > 0 && kb < armor) {
      t.flash = 6; t.flashColor = '#ffffff'; t.freeze = Math.min(hitlag, 4);
      return 'armor';
    }
    if (hb.status && (t.grounded || hb.status.air)) {       // stun effects (zaps, etc.)
      t.interrupt(); t.freeze = hitlag; t.stun(hb.status.t, hb.status.kind || 'zap');
      t.flash = 6; t.flashColor = '#ffffff';
      return 'hit';
    }

    let ang = hb.ang === undefined ? 361 : hb.ang;
    if (ang === 361) ang = t.grounded && kb < 86 ? 0 : 42;
    t.interrupt();
    t.launch = { kb, ang: ang * DEG, dir, hitstun: Math.max(4, Math.floor(kb * G.hitstunMul) + (hb.stun || 0)), face: true };
    t.freeze = hitlag;
    t.setState('hitstun');
    t.flash = Math.min(8, hitlag + 2); t.flashColor = '#ffffff';
    t.hook('onDamage', src, hb, dmg);
    return 'hit';
  }

  // the moment a throw lets go
  throwRelease(atk, v, th) {
    const dmg = th.dmg * atk.dmgMul;
    v.pct = Math.min(999, v.pct + dmg); v.stats.taken += dmg; atk.stats.dealt += dmg;
    v.lastHitBy = atk.slot; v.lastHitFrame = this.frame;
    const kb = calcKB(v.pct, dmg, v.st.weight, th.bk || 40, th.kg === undefined ? 60 : th.kg) * v.kbMul;
    let dir = atk.facing; if (th.rev) dir = -dir;
    v.grounded = false; v.ground = null;
    if (v.def.noKnockback) { v.setState('air'); v.flash = 8; if (v.def.stamina && v.pct >= v.def.stamina) this.ko(v, 'crash'); return; }
    v.launch = { kb, ang: (th.ang === undefined ? 45 : th.ang) * DEG, dir, hitstun: Math.max(6, Math.floor(kb * G.hitstunMul)), face: true };
    v.freeze = 3; atk.freeze = 3;
    v.setState('hitstun');
    v.flash = 5; v.flashColor = '#ffffff';
    this.fx.hit(v.x, v.cy, th.fx || 'punch', clamp(kb / 170, 0.3, 1.2));
    this.sfx(th.sfx || 'hitM'); if (kb > 100) this.shake(6);
  }

  // Direct damage + launch from scripted things (supers, stage hazards).
  blast(owner, t, o) {
    if (!this.canBeHitScript(t)) return false;
    const src = { owner, fighter: null, x: o.x === undefined ? t.x - (o.dir || 1) : o.x, y: o.y || t.cy, facing: o.dir || 1, mul: 1 };
    const keep = t.invuln; if (o.force) t.invuln = 0;
    const superWas = t.superActive; if (o.force) t.superActive = false;
    const r = this.applyHit(src, t, Object.assign({ dmg: 10, ang: 60, bk: 40, kg: 80, unblockable: !!o.force }, o), null);
    if (o.force) { t.invuln = Math.max(t.invuln, 0); t.superActive = superWas; }
    else t.invuln = keep;
    return r;
  }
  canBeHitScript(t) { return !t.out && t.state !== 'dead' && t.state !== 'respawn'; }

  // fighters standing in each other get nudged apart
  pushApart() {
    const F = this.fighters;
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      if (a.out || !a.grounded || a.def.noPush) continue;
      if (a.state === 'grabbed' || a.state === 'grabhold' || a.state === 'dead' || a.state === 'roll' || a.state === 'trapped') continue;
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j];
        if (b.out || !b.grounded || b.def.noPush || a.ground !== b.ground) continue;
        if (b.state === 'grabbed' || b.state === 'grabhold' || b.state === 'dead' || b.state === 'roll' || b.state === 'trapped') continue;
        if (a.state === 'move' && a.move && a.move.noPush) continue;
        if (b.state === 'move' && b.move && b.move.noPush) continue;
        const min = (a.w * a.scale + b.w * b.scale) * 0.42, dx = b.x - a.x;
        if (Math.abs(dx) >= min || Math.abs(a.y - b.y) > 8) continue;
        const d = dx === 0 ? (a.slot < b.slot ? 1 : -1) : sign(dx);
        const push = Math.min(1.1, (min - Math.abs(dx)) * 0.25);
        const g = a.ground;
        a.x = clamp(a.x - d * push, g.x + 1, g.x + g.w - 1);
        b.x = clamp(b.x + d * push, g.x + 1, g.x + g.w - 1);
      }
    }
  }

  // ------------------------------------------------------- KO and respawn --
  ko(f, side) {
    if (f.out || f.state === 'dead') return;
    const b = this.stage.blast;
    f.interrupt();
    this.fx.koBlast(clamp(f.x, b.l, b.r), clamp(f.cy, b.t, b.b), side === 'crash' ? 'b' : side, f.color);
    this.sfx('ko'); this.shake(14);
    f.hook('onKO', side);
    f.stats.falls++;
    const killer = this.frame - f.lastHitFrame < 600 ? this.fighters[f.lastHitBy] : null;
    if (killer && killer !== f) { killer.stats.kos++; f.stats.lastKiller = killer.slot; } else f.stats.sds++;
    if (f.superReady) { f.superReady = false; this.items.starLost(); }
    f.superActive = false; f.scale = 1; f.dmgMul = 1; f.kbMul = 1; f.permArmor = 0; f.silence = 0; f.overrideDraw = null;
    f.setState('dead'); f.deadT = G.respawnDelay;
    f.vx = f.vy = f.kx = f.ky = 0; f.grounded = false; f.ground = null;
    if (this.rules.stocks) {
      f.stocks--;
      if (f.stocks <= 0) { f.out = true; this.elim.push(f.slot); }
    }
    this.checkEnd();
  }

  respawn(f) {
    const st = this.stage, rp = st.respawnAt ? st.respawnAt(this, f) : st.respawn;
    f.pct = 0; f.x = rp[0] + (f.slot - 1.5) * 26; f.y = rp[1] - 260; f.v.respY = rp[1];
    f.vx = f.vy = f.kx = f.ky = 0; f.grounded = false; f.ground = null;
    f.jumps = f.st.airJumps; f.shieldHP = G.shieldMax; f.facing = f.x > (st.focusX || 0) ? -1 : 1;
    f.launched = false; f.tumble = false; f.launch = null; f.freeze = 0; f.respawnT = 0;
    f.setState('respawn');
    f.hook('onRespawn');
  }

  checkEnd() {
    if (this.state !== 'fight' && this.state !== 'intro') return;
    if (!this.rules.stocks) return;
    const teams = new Set(this.alive().map((f) => f.team));
    if (teams.size <= 1 && this.fighters.length > 1) this.finish('stock');
    else if (this.fighters.length === 1 && this.alive().length === 0) this.finish('stock');
  }

  score(f) { return f.stats.kos - f.stats.falls; }

  finish(reason) {
    if (this.state === 'over') return;
    this.state = 'over'; this.overT = 0; this.count = null;
    let order;
    if (this.rules.stocks && reason === 'stock') {
      const left = this.alive().map((f) => f.slot);
      order = left.concat(this.elim.slice().reverse());
    } else {
      order = this.fighters.slice().sort((a, b) => {
        if (this.rules.stocks) { if (b.stocks !== a.stocks) return b.stocks - a.stocks; }
        else if (this.score(b) !== this.score(a)) return this.score(b) - this.score(a);
        return a.pct - b.pct || a.slot - b.slot;
      }).map((f) => f.slot);
    }
    this.result = { order, reason, stats: this.fighters.map((f) => Object.assign({ slot: f.slot, score: this.score(f), stocks: f.stocks, pct: f.pct }, f.stats)) };
    this.slowmo(0.3, 54);
    this.announce(reason === 'time' ? 'PENCILS DOWN!' : 'CLASS DISMISSED!', { life: 190, size: reason === 'time' ? 70 : 62, pop: true, color: '#ffe23a', big: true });
    this.sfx('bell_end'); this.sfx(reason === 'time' ? 'v_time' : 'v_game', { delay: 0.45 });
    if (this.audio && this.audio.duck) this.audio.duck();
  }
}
