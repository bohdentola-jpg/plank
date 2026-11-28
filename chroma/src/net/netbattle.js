// In-match networking. The HOST runs the real simulation (bots, damage,
// paint, scoring) and streams snapshots + events. Each CLIENT simulates only
// its own Chromeleon (so movement feels instant), forwards what its weapon
// does, and shows everybody else as interpolated puppets.
import * as THREE from 'three';
import { v3a } from '../actors/weapons.js';
import { Bot } from '../actors/bot.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const r2 = (v) => Math.round(v * 100) / 100;

export class NetHost {
  constructor(battle, room) {
    this.role = 'host';
    this.b = battle;
    this.room = room;
    this.inbox = [];
    this.events = [];
    this.direct = [];
    this.snapT = 0;
    this.fromPeer = null;
    this.byPeer = new Map();
    this.ready = new Set();
    this.offs = [room.on('msg', (msg, peer) => this.inbox.push([msg, peer])), room.on('leave', (peer, name) => this.onLeave(peer, name))];
    room.drain();
  }

  allReady() { for (const p of this.byPeer.keys()) if (!this.ready.has(p)) return false; return true; }

  get local() { return this.b.player; }
  action() { /* the host applies its own actions directly */ }
  emit(e, except = null) { this.events.push([e, except]); }
  to(peer, e) { if (peer) this.direct.push([peer, e]); }

  onLeave(peer, name) {
    const f = this.byPeer.get(peer);
    if (!f) return;
    this.byPeer.delete(peer);
    f.puppet = null;
    f.peer = null;
    f.puppetInit = false;
    this.b.bots.push(new Bot(f, this.b.world, this.b.nav, this.b.opts.skill));
    this.b.hud.feedMsg(`<b>${name || f.name}</b> left — a CPU took over`);
  }

  update() {
    for (const [msg, peer] of this.inbox) this.handle(msg, peer);
    this.inbox.length = 0;
  }

  handle(msg, peer) {
    const f = this.byPeer.get(peer);
    if (!f) return;
    if (msg.t === 'ready') { this.ready.add(peer); return; }
    if (msg.t === 'st') f.netApply(msg.s);
    else if (msg.t === 'act' && Array.isArray(msg.a)) {
      this.fromPeer = peer;
      for (const a of msg.a) { try { this.applyAction(f, a); } catch (e) { console.warn('bad action', a, e); } }
      this.fromPeer = null;
    }
  }

  applyAction(f, a) {
    const c = this.b.combat, w = this.b.world;
    const combatOn = w.combatOn;
    switch (a.m) {
      case 'fire': if (combatOn && f.alive) c.fire(f, a.k, V(a.p), V(a.v), { ...a.o, def: f.weapon }); break;
      case 'dmg': { const v = w.fighters[a.v]; if (combatOn && f.alive && v && v.team !== f.team) c.damage(v, Math.min(+a.d || 0, 220), f, a.k); break; }
      case 'paint': if (combatOn) c.paint(f, V(a.p), Math.min(+a.r || 0, 6), a.o || undefined); break;
      case 'explode': if (combatOn) c.explode(V(a.p), f, Math.min(a.r, 6), Math.min(a.a, 240), a.b, Math.min(a.pr, 6), { extra: a.x, sound: a.s || undefined }); break;
      case 'sub': if (combatOn && f.alive) c.throwSub(f, a.k, V(a.p), V(a.d)); break;
      case 'barrage': if (combatOn) c.barrage(f, V(a.p)); break;
      case 'rain': if (combatOn) c.rainCloud(f, V(a.p), V(a.d)); break;
      case 'bubble': if (combatOn) c.bubble(f); break;
      case 'beamfx': c.beamVisual(f.team, V(a.p), V(a.d), a.l, a.c); this.emit({ e: 'beam', p: a.p, d: a.d, l: a.l, c: a.c, t: f.team }, this.fromPeer); break;
      case 'special': f.specialReady = false; f.special = 0; f.stats.specials++; w.onSpecial?.(f); break;
      case 'fell': if (f.alive) f.splatted(f.time - f.lastAttackT < 6 ? f.lastAttacker : null, 'fall'); break;
      case 'md': this.b.rules?.action(f, a); break; // mode requests (grab / throw / dunk)
    }
  }

  flush(dt) {
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 1 / 15;
      const snap = { t: 'snap', tl: Math.round(this.b.timeLeft * 10) / 10, f: this.b.world.fighters.map((f) => f.netPack()) };
      if (this.b.rules) snap.md = this.b.rules.netPack(); // compact mode state (zones / ball)
      this.room.broadcast(snap);
    }
    if (!this.events.length && !this.direct.length) return;
    for (const [id] of this.room.conns) {
      const list = [];
      for (const [e, ex] of this.events) if (ex !== id) list.push(e);
      for (const [to, e] of this.direct) if (to === id) list.push(e);
      if (list.length) this.room.sendTo(id, { t: 'ev', e: list });
    }
    this.events.length = 0;
    this.direct.length = 0;
  }

  phase(s, extra = {}) { this.room.broadcast({ t: 'phase', s, ...extra }); }
  result(r) { this.room.broadcast({ t: 'result', r }); }
  dispose() { for (const off of this.offs) off(); }
}

export class NetClient {
  constructor(battle, room) {
    this.role = 'client';
    this.b = battle;
    this.room = room;
    this.inbox = [];
    this.acts = [];
    this.stT = 0;
    this.offs = [room.on('msg', (msg) => this.inbox.push(msg)), room.on('closed', (why) => battle.onHostLost?.(why))];
    room.drain();
  }

  get local() { return this.b.player; }
  action(a, owner) { if (owner === this.b.player) this.acts.push(a); }
  emit() { /* clients never broadcast */ }

  update() {
    for (const m of this.inbox) { try { this.handle(m); } catch (e) { console.warn('net message failed', m?.t, e); } }
    this.inbox.length = 0;
  }

  handle(m) {
    const b = this.b, w = b.world;
    if (m.t === 'snap') {
      b.timeLeft = m.tl;
      m.f.forEach((a, i) => {
        const f = w.fighters[i];
        if (!f) return;
        if (f === b.player) { if (f.alive && a[11] > 0) f.hp = a[11]; f.special = a[12]; f.specialReady = !!(a[9] & 2048); }
        else f.netApply(a);
      });
      if (m.md && b.rules) b.rules.netApply(m.md);
    } else if (m.t === 'ev') {
      for (const e of m.e) this.event(e);
    } else if (m.t === 'phase') {
      b.netPhase(m);
    } else if (m.t === 'result') {
      b.netResult(m.r);
    }
  }

  event(e) {
    const b = this.b, w = b.world, c = b.combat;
    switch (e.e) {
      case 'pt': w.paint.splat(V(e.p), e.r, e.t, { phase: e.ph, wobble: e.w, drips: e.d, force: true }); break;
      case 'proj': c.fireCosmetic(e.t, e.k, V(e.p), V(e.v), e.s, e.g, e.r); break;
      case 'boom': {
        const p = V(e.p);
        w.fx.explosion(p, w.colors[e.t], e.r);
        w.audio?.sfx(e.s || 'explode', { x: p.x, y: p.y, z: p.z, volume: Math.min(1, 0.5 + e.r * 0.12) });
        // retire the nearest look-alike bomb
        let best = -1, bd = 3.5;
        c.bombs.forEach((bm, i) => { const d = bm.pos.distanceTo(p); if (bm.team === e.t && d < bd) { bd = d; best = i; } });
        if (best >= 0) { c.disposeMesh(c.bombs[best].mesh); c.bombs.splice(best, 1); }
        w.onExplosion?.(p, e.r);
        break;
      }
      case 'beam': c.beamVisual(e.t, V(e.p), V(e.d), e.l, e.c); break;
      case 'bomb': c.throwSub({ team: e.t, pos: V(e.p), alive: true }, e.k, V(e.p), V(e.d), true); break;
      case 'cloud': c.rainCloud({ team: e.t, pos: V(e.p) }, V(e.p), V(e.d), true); break;
      case 'dome': c.bubble({ team: e.t, pos: V(e.p) }, true, V(e.p)); break;
      case 'kill': {
        const v = w.fighters[e.v], a = e.a >= 0 ? w.fighters[e.a] : null;
        if (!v) break;
        if (v === b.player) { if (v.alive) v.splatted(a, e.k); }
        else if (v.alive || true) {
          v.alive = false;
          v.model.root.visible = false;
          if (e.k !== 'fall') w.fx.explosion(v.pos.clone().setY(v.pos.y + 0.6), a ? a.color : v.color, 2.2);
          w.audio?.sfx('splatted', { x: v.pos.x, y: v.pos.y, z: v.pos.z, volume: 0.8 });
          b.onSplat(v, a, e.k);
        }
        break;
      }
      case 'spawn': {
        const f = w.fighters[e.v];
        if (!f) break;
        if (f === b.player) { if (!f.alive) f.respawn(); }
        else { f.alive = true; f.model.root.visible = true; f.pos.set(f.spawnPoint.x, f.spawnPoint.y, f.spawnPoint.z); w.fx.ring(f.spawnPoint.clone().setY(f.spawnPoint.y + 0.05), f.color, 0.3, 2.2, 0.6, { alpha: 0.9 }); }
        break;
      }
      case 'hit': b.onHit(b.player, w.fighters[e.v] || { alive: e.k !== 1 }, e.d, e.k === 1); break;
      case 'hurt': { const a = w.fighters[e.a]; w.onPlayerHurt?.(e.d, a); b.player.lastDamage = b.player.time; b.player.model.flash(); break; }
      case 'sp': { const f = w.fighters[e.f]; if (f && f !== b.player) w.onSpecial?.(f); break; }
      case 'md': b.rules?.event(e); break;
    }
  }

  flush(dt) {
    this.stT -= dt;
    if (this.stT <= 0) {
      this.stT = 1 / 30;
      this.room.send({ t: 'st', s: this.b.player.netPack() });
    }
    if (this.acts.length) { this.room.send({ t: 'act', a: this.acts }); this.acts = []; }
  }

  dispose() { for (const off of this.offs) off(); }
}

export function paintEvent(p, r, team, ph, wob, drips) {
  return { e: 'pt', p: v3a(p), r: r2(r), t: team, ph: Math.round(ph * 1000) / 1000, w: wob, d: drips };
}
