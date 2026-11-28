// ZONE CLASH: ink the marked zone(s). A team that covers at least 70% of the
// total zone area captures it; while it holds, its count drops from 100.
// Taking the zone from the other team costs a short penalty first. Reach 0
// for a knockout, otherwise the lower count wins at time-up. If the trailing
// team holds the zone when time runs out, play goes on in overtime.
// The host runs the rules; clients render the replicated state.
import * as THREE from 'three';
import { InkSampler, stripeTexture, fadeTexture } from './modekit.js';
import { ModeHUD } from '../ui/modehud.js';
import { clamp, damp, hexToCss, pick } from '../util.js';

export const ZONE_CAP = 0.7;   // share of the total zone area needed to capture
const ZONE_LOSE = 0.5;         // holders drop to neutral below this share
const COUNT = 100;
const OT_MAX = 60;             // overtime safety cap (seconds)
const WHITE = new THREE.Color(0xffffff);

export class ZoneRules {
  constructor(battle) {
    this.b = battle;
    this.kind = 'zones';
    this.name = 'ZONE CLASH';
  }

  get client() { return this.b.net?.role === 'client'; }

  init() {
    const b = this.b, st = b.stage;
    let defs = st.def.modes?.zones;
    if (!defs?.length) { // fallback: a square around the middle at floor height
      const y = st.level.heightAt(4, 4).y;
      defs = [[-5, -5, 5, 5, Number.isFinite(y) ? y : 0]];
    }
    this.zones = defs.map(([x0, z0, x1, z1, y]) => {
      const sampler = new InkSampler(st.paint, st.level, { x0, z0, x1, z1 }, (x, yy) => Math.abs(yy - y) < 0.35);
      return { x0, z0, x1, z1, y, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, sampler, cov: { 1: 0, 2: 0 } };
    });
    this.total = this.zones.reduce((s, z) => s + z.sampler.n, 0);
    this.ctrl = 0; this.last = 0;
    this.count = { 1: COUNT, 2: COUNT };
    this.pen = { 1: 0, 2: 0 };
    this.run = { 1: 0, 2: 0 };
    this.cov = { 1: 0, 2: 0 };
    this.ot = false; this.otT = 0; this.otTeam = 0;
    this.finished = false; this.ko = 0;
    this.measureT = 0;
    this.flashT = 0;
    this.time = 0;
    this.stats = { captures: 0, neutrals: 0, drained: 0 };
    this.col = new THREE.Color(0xffffff);
    this.buildVisuals();
    this.hud = new ModeHUD(b.hudRoot, 'zones', b.player.team);
    this.cssColors = { 1: hexToCss(b.colors[1]), 2: hexToCss(b.colors[2]) };
  }

  // ---------------------------------------------------------------- visuals
  buildVisuals() {
    const scene = this.b.scene;
    this.group = new THREE.Group();
    this.group.name = 'zones';
    scene.add(this.group);
    this.mats = {
      tint: [], border: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      curtain: new THREE.MeshBasicMaterial({ map: fadeTexture(), color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
      pylon: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    };
    for (const z of this.zones) {
      const g = new THREE.Group();
      g.position.set(z.cx, z.y, z.cz);
      this.group.add(g);
      const tex = stripeTexture().clone();
      tex.userData.shared = false;
      tex.repeat.set(z.w / 1.8, z.d / 1.8);
      tex.needsUpdate = true;
      const tintMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
      this.mats.tint.push(tintMat);
      const tint = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.d), tintMat);
      tint.rotation.x = -Math.PI / 2;
      tint.position.y = 0.03;
      tint.renderOrder = 1;
      g.add(tint);
      // glowing border strips
      const bt = 0.24, bh = 0.06;
      for (const [w, d, x, zz] of [[z.w + bt, bt, 0, -z.d / 2], [z.w + bt, bt, 0, z.d / 2], [bt, z.d + bt, -z.w / 2, 0], [bt, z.d + bt, z.w / 2, 0]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), this.mats.border);
        m.position.set(x, bh / 2 + 0.01, zz);
        g.add(m);
      }
      // light curtain along the edge so the zone reads from across the map
      const ch = 1.3;
      for (const [len, x, zz, ry] of [[z.w, 0, -z.d / 2, 0], [z.w, 0, z.d / 2, 0], [z.d, -z.w / 2, 0, Math.PI / 2], [z.d, z.w / 2, 0, Math.PI / 2]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, ch), this.mats.curtain);
        m.position.set(x, ch / 2 + 0.02, zz);
        m.rotation.y = ry;
        m.renderOrder = 2;
        g.add(m);
      }
      // corner pylons with glowing caps
      const pg = new THREE.CylinderGeometry(0.07, 0.1, 2.4, 8);
      pg.translate(0, 1.2, 0);
      const cap = new THREE.SphereGeometry(0.2, 12, 8);
      for (const [x, zz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const p = new THREE.Mesh(pg, this.mats.pylon);
        p.position.set(x * z.w / 2, 0, zz * z.d / 2);
        g.add(p);
        const c = new THREE.Mesh(cap, this.mats.pylon);
        c.position.set(x * z.w / 2, 2.45, zz * z.d / 2);
        g.add(c);
      }
    }
  }

  updateVisuals(dt) {
    this.time += dt;
    const target = this.ctrl ? this.b.colors[this.ctrl] : WHITE;
    this.col.lerp(target, damp(5, dt));
    this.flashT = Math.max(0, this.flashT - dt);
    const pulse = this.ctrl ? 0.5 + 0.5 * Math.sin(this.time * 4) : 0.3;
    const fl = this.flashT;
    for (const m of this.mats.tint) {
      m.color.copy(this.col);
      m.opacity = (this.ctrl ? 0.24 : 0.14) + fl * 0.5;
      m.map.offset.x = (this.time * 0.15) % 1;
    }
    this.mats.border.color.copy(this.col).multiplyScalar(1.6 + pulse * 1.2 + fl * 3);
    this.mats.pylon.color.copy(this.col).multiplyScalar(2 + pulse + fl * 3);
    this.mats.curtain.color.copy(this.col);
    this.mats.curtain.opacity = (this.ctrl ? 0.26 + pulse * 0.12 : 0.16) + fl * 0.6;
  }

  // ---------------------------------------------------------------- rules (host)
  // per-zone shares (+ the authoritative total on the host; clients get it from the snapshot)
  measure(total = true) {
    let a = 0, b = 0;
    for (const z of this.zones) {
      z.sampler.measure();
      z.cov[1] = z.sampler.a; z.cov[2] = z.sampler.b;
      a += z.sampler.ca; b += z.sampler.cb;
    }
    if (!total) return;
    const n = Math.max(1, this.total);
    this.cov[1] = a / n; this.cov[2] = b / n;
  }

  update(dt) {
    const b = this.b;
    const playing = b.state === 'play';
    this.measureT -= dt;
    if (this.measureT <= 0) { this.measureT = this.client ? 0.3 : 0.1; this.measure(!this.client); }
    if (!this.client && playing && !this.finished) this.step(dt);
    this.updateVisuals(dt);
    this.updateHUD();
  }

  step(dt) {
    const c = this.cov;
    if (this.ctrl === 0) {
      const t = c[1] >= ZONE_CAP ? 1 : c[2] >= ZONE_CAP ? 2 : 0;
      if (t) this.capture(t);
    } else {
      const o = 3 - this.ctrl;
      if (c[o] >= ZONE_CAP) this.capture(o);
      else if (c[this.ctrl] < ZONE_LOSE) this.neutral();
    }
    const t = this.ctrl;
    if (t) {
      let d = dt;
      if (this.pen[t] > 0) { const p = Math.min(this.pen[t], d); this.pen[t] -= p; d -= p; }
      this.count[t] = Math.max(0, this.count[t] - d);
      this.run[t] += d;
      this.stats.drained += d;
      if (this.count[t] <= 0) { this.finished = true; this.ko = t; }
    }
    if (this.ot) {
      this.otT += dt;
      const tr = this.otTeam;
      if (this.ctrl !== tr || this.count[tr] < this.count[3 - tr] || this.otT > OT_MAX) this.finished = true;
    }
  }

  capture(t) {
    const prev = this.ctrl;
    let pen = 0;
    if (this.last && this.last !== t) pen = clamp(Math.round(this.run[this.last] * 0.6), 2, 15);
    this.pen[t] += pen;
    this.ctrl = t; this.last = t; this.run[t] = 0;
    this.stats.captures++;
    this.b.net?.emit?.({ e: 'md', k: 'cap', t, pv: prev, pn: pen });
    this.fxCapture(t, prev, pen);
  }

  neutral() {
    const prev = this.ctrl;
    this.ctrl = 0;
    this.stats.neutrals++;
    this.b.net?.emit?.({ e: 'md', k: 'neu', pv: prev });
    this.fxNeutral(prev);
  }

  // called by the battle every frame once the clock reads 0; true = keep playing
  holdOvertime() {
    if (this.finished) return false;
    if (!this.ot) {
      const t = this.ctrl;
      if (t && this.count[t] >= this.count[3 - t]) {
        this.ot = true; this.otTeam = t; this.otT = 0;
        this.b.net?.emit?.({ e: 'md', k: 'ot' });
        this.fxOvertime();
        return true;
      }
      return false;
    }
    return true;
  }

  endBanner() { return this.ko ? 'KNOCKOUT!' : 'TIME!'; }

  result() {
    const a = this.count[1], b = this.count[2];
    let winner = a < b ? 1 : b < a ? 2 : 0;
    if (!winner) winner = this.cov[1] > this.cov[2] ? 1 : this.cov[2] > this.cov[1] ? 2 : (this.b.stage.paint.coverage().a >= this.b.stage.paint.coverage().b ? 1 : 2);
    return { mode: 'zones', a: Math.ceil(a - 1e-6), b: Math.ceil(b - 1e-6), winner, ko: this.ko ? 1 : 0, ot: this.ot ? 1 : 0 };
  }

  // ---------------------------------------------------------------- effects (host + clients)
  fxCapture(t, prev, pen) {
    const b = this.b, my = b.player.team, col = b.colors[t];
    this.flashT = 1;
    for (const z of this.zones) {
      const c = new THREE.Vector3(z.cx, z.y + 0.1, z.cz);
      b.fx.ring(c, col, 0.5, Math.max(z.w, z.d) * 0.8, 0.8, { alpha: 0.9 });
      b.fx.splash(c.setY(z.y + 0.5), new THREE.Vector3(0, 1, 0), col, 30, 7, 0.12, 0.8);
    }
    const name = `<span style="color:${this.cssColors[t]}">`;
    if (t === my) b.hud.showBanner(`${name}ZONE CAPTURED!</span>`, pen ? `Penalty <b>+${pen}</b> first — then the count drops!` : 'Hold it to run your count down!', 'mbig', 2.2);
    else b.hud.showBanner(`${name}${prev === my ? 'ZONE LOST!' : 'ENEMY TOOK THE ZONE!'}</span>`, 'Ink it back — cover 70% to recapture!', 'mbig', 2.2);
    b.app.audio?.sfx(t === my ? 'zone_capture' : 'zone_lost', { volume: 0.9 });
    b.app.audio?.sfx('crowd_cheer', { volume: 0.45 });
    b.hud.feedMsg(`<b style="color:${this.cssColors[t]}">${t === my ? 'Your team' : 'The enemy'}</b> <span class="fx">captured the zone${pen ? ` (+${pen} penalty)` : ''}</span>`);
    this.hud.pop(t);
    b.rig?.shake(0.25, 0.25);
  }

  fxNeutral(prev) {
    const b = this.b, my = b.player.team;
    this.flashT = 0.6;
    if (prev === my) { b.hud.showBanner('ZONE LOST!', "It's neutral — ink it back!", 'mmid', 1.8); b.app.audio?.sfx('zone_lost', { volume: 0.8 }); }
    else if (prev) { b.hud.showBanner('ZONE NEUTRALIZED!', 'Keep inking to take it!', 'mmid', 1.6); b.app.audio?.sfx('zone_capture', { volume: 0.5, pitch: 0.8 }); }
  }

  fxOvertime() {
    this.b.hud.showBanner('OVERTIME!', 'Take the zone away to win!', 'mbig', 2);
    this.b.app.audio?.sfx('one_minute');
  }

  updateHUD() {
    const b = this.b;
    this.hud.setZones({ ctrl: this.ctrl, count: this.count, pen: this.pen, cov: this.cov, cap: ZONE_CAP, ot: this.ot, colors: this.cssColors });
    if (b.state !== 'play') { this.hud.status(null); return; }
    const my = b.player.team, ctrl = this.ctrl;
    let msg;
    if (this.ot) msg = ctrl === my ? 'OVERTIME — <b>hold the zone</b> until your count passes theirs!' : 'OVERTIME — <b>take the zone</b> to win!';
    else if (!ctrl) msg = `Ink <b>${Math.round(ZONE_CAP * 100)}%</b> of the zone to capture it!`;
    else if (ctrl === my) msg = this.pen[my] > 0 ? `Burning penalty — <b>keep the zone!</b>` : '<b>Your zone</b> — defend it!';
    else msg = '<b>Enemy zone!</b> Ink it back!';
    this.hud.status(msg, ctrl ? this.cssColors[ctrl] : null, !!ctrl && ctrl !== my && this.count[ctrl] < 30);
  }

  // ---------------------------------------------------------------- networking
  netPack() {
    const r = (v) => Math.round(v * 10);
    return [this.ctrl, r(this.count[1]), r(this.count[2]), r(this.pen[1]), r(this.pen[2]), Math.round(this.cov[1] * 1000), Math.round(this.cov[2] * 1000), (this.ot ? 1 : 0) | (this.finished ? 2 : 0), this.ko];
  }

  netApply(m) {
    if (!Array.isArray(m)) return;
    this.ctrl = m[0] | 0;
    this.count[1] = m[1] / 10; this.count[2] = m[2] / 10;
    this.pen[1] = m[3] / 10; this.pen[2] = m[4] / 10;
    this.cov[1] = m[5] / 1000; this.cov[2] = m[6] / 1000;
    this.ot = !!(m[7] & 1); this.finished = !!(m[7] & 2); this.ko = m[8] | 0;
  }

  event(e) {
    if (e.k === 'cap') { this.ctrl = e.t; this.stats.captures++; this.fxCapture(e.t, e.pv, e.pn); }
    else if (e.k === 'neu') { this.ctrl = 0; this.stats.neutrals++; this.fxNeutral(e.pv); }
    else if (e.k === 'ot') { this.ot = true; this.fxOvertime(); }
  }

  action() { /* zones need no client requests: painting already goes through the host */ }
  onSplat() {}

  // ---------------------------------------------------------------- bots
  // Returns a goal / aim point for a bot, or null to paint freely.
  botPlan(bot) {
    const f = bot.f, team = f.team;
    if (!this.zones.length) return null;
    const mine = this.cov[team];
    // the zone is safely ours: half the team guards it, the rest roams
    if (this.ctrl === team && mine > 0.86 && f.netId % 2 === 0) return null;
    // weakest zone first (by our share)
    let zone = this.zones[0];
    for (const z of this.zones) if (z.cov[team] < zone.cov[team]) zone = z;
    const pts = zone.sampler.points;
    if (!pts.length) return null;
    // aim at the closest point of the zone that isn't ours yet
    let aim = null, bd = 64;
    for (let i = 0; i < 18; i++) {
      const pt = pick(pts);
      const d = pt.p.distanceToSquared(f.pos);
      if (d < bd && zone.sampler.ownerOf(pt) !== team) { bd = d; aim = pt.p; }
    }
    const key = this.zones.indexOf(zone);
    const inside = f.pos.x > zone.x0 && f.pos.x < zone.x1 && f.pos.z > zone.z0 && f.pos.z < zone.z1;
    let goal = null;
    if (!inside || !aim || bot.goalT > 5) {
      // a point in the zone we don't own (or any zone point)
      for (let i = 0; i < 10 && !goal; i++) { const pt = pick(pts); if (zone.sampler.ownerOf(pt) !== team) goal = pt.p; }
      goal ||= pick(pts).p;
    }
    return { key: 'zone' + key, goal, aim, keep: inside };
  }

  dispose() {
    this.hud.dispose();
    this.group.parent?.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose?.(); });
    for (const m of [...this.mats.tint, this.mats.border, this.mats.curtain, this.mats.pylon]) { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
  }
}
