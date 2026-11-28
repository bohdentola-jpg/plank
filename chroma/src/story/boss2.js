// The Grimewyrm: Baron Grisaille's pet goo serpent (sector 2 boss). It lives in
// the reservoir's gray pool, with Agent Tint caged above it.
//   Phase 1  it surfaces at the pool's edge (bubbles + warning ring), rears up and
//            lunges across the walkway along a telegraphed line. After a lunge its
//            head is stuck for a moment: hit the glowing eye. It also spits mortars.
//   Phase 2  high tide: the pool floods the walkway. Stand on the four raised
//            refuges and paint the four wall drains. Once the tide drains away the
//            Wyrm is left beached: punish the exposed eye.
//   Phase 3  frenzy: double lunges, mortar volleys, goo shockwaves from the pool,
//            and it sheds Splotches.
// The finish: it bursts into colour segment by segment and Tint's cage comes down.
import * as THREE from 'three';
import { Dripkin } from '../actors/character.js';
import { part, rod, std, gooMat, glowMat, OUTLINE_S, OUTLINE_M, posOf, disposeTree } from './kit.js';
import { GRAY_HEX } from './enemies.js';
import * as D from './dialogue.js';

const P1_HP = 600, P2_HP = 500, P3_HP = 700;
const SEGS = 13, SPACING = 1.45;
const POOL = 10, SURF = -0.6, WALK = 23;
const LOB_G = 20;
const UP = new THREE.Vector3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3();
const DRAINS = ['w1', 'w2', 'w3', 'w4'];

class EyePart {
  constructor(boss) {
    this.boss = boss; this.team = 2; this.name = 'Grimewyrm Eye';
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.alive = false; this.invuln = 0; this.hp = 1; this.submerged = false; this.form = 'kid'; this.time = 0;
    this.lastAttacker = null; this.lastAttackT = -9;
    this.stats = { kills: 0, deaths: 0, turf: 0, assists: 0, specials: 0 };
    this.boss_part = true;
  }
  get color() { return this.boss.world.colors[2]; }
  hitHeight() { return 2.4; }
  takeDamage(dmg, attacker, kind) { this.boss.hurt(dmg, attacker, kind); }
}

// a point on the pool edge (square pool) at angle a
function edgePoint(a, out) {
  const c = Math.cos(a), s = Math.sin(a);
  const k = POOL / Math.max(Math.abs(c), Math.abs(s));
  return out.set(c * k, 0, s * k);
}

export class Grimewyrm {
  constructor(world, course, hooks) {
    this.world = world; this.course = course; this.hooks = hooks;
    this.team = 2; this.name = 'The Grimewyrm'; this.alive = true;
    this.state = 'dormant'; this.phase = 0; this.t = 0; this.stateT = 0;
    this.hp = [P1_HP, P2_HP, P3_HP];
    this.max = P1_HP + P2_HP + P3_HP;
    this.flash = 0; this.hurtSfxT = 0;
    this.head = new THREE.Vector3(0, -4, 0);
    this.headDir = new THREE.Vector3(0, 0, -1);
    this.segs = Array.from({ length: SEGS }, (_, i) => new THREE.Vector3(0, -4 - i, 0));
    this.lobs = []; this.waves = []; this.lobQueue = [];
    this.tide = SURF; this.tideOn = false; this.tideHurtT = 0;
    this.lunges = 0; this.spitT = 4; this.waveT = 6; this.splitT = 10;
    this.eye = new EyePart(this);
    world.fighters.push(this.eye);
    this.parts = [this.eye];
    this.build();
  }

  get color() { return this.world.colors[2]; }
  get title() { return 'THE GRIMEWYRM'; }
  get marks() { return [(P2_HP + P3_HP) / this.max, P3_HP / this.max]; }
  get frac() { return Math.max(0, this.hp[0] + this.hp[1] + this.hp[2]) / this.max; }
  get intro() { return D.WYRM_INTRO; }
  get introShot() { return { pos: new THREE.Vector3(6, 4.5, -19), look: new THREE.Vector3(0, 6, 0) }; }
  get dormantText() { return 'Enter the <b>main reservoir</b>'; }
  get downText() { return 'The Grimewyrm is down!'; }
  get fighting() { return ['p1', 'p2', 'beached', 'p3'].includes(this.state); }
  get objective() {
    if (this.state === 'p2') return `High tide! Get on a <b>refuge</b> and paint the <b>drains</b>: <b>${this.drainsDone}/4</b>`;
    if (this.state === 'beached') return 'It\'s stranded! <b>Hit the eye!</b>';
    return 'Defeat <b>the Grimewyrm</b>. Hit its <b>eye</b> when it\'s stuck!';
  }
  get label() {
    if (this.state === 'p1') return 'PHASE 1 · DODGE THE LUNGE, HIT THE EYE';
    if (this.state === 'p2') return `PHASE 2 · HIGH TIDE! PAINT THE DRAINS (${this.drainsDone}/4)`;
    if (this.state === 'beached') return 'BEACHED! HIT THE EYE!';
    if (this.state === 'p3') return 'PHASE 3 · FRENZY!';
    if (this.state === 'dying' || this.state === 'dead') return 'THE GRIMEWYRM IS BURSTING!';
    return '';
  }
  get drainsDone() { return DRAINS.filter((id) => this.hooks.mech?.flag('drain:' + id)).length; }

  // ------------------------------------------------------------ visuals
  build() {
    const root = this.root = new THREE.Group();
    root.name = 'grimewyrm';
    this.world.scene.add(root);
    this.bodyMat = gooMat(0x8f8b9c);
    this.bodyBase = this.bodyMat.emissive.clone();
    const dark = std(0x3b3745, 0.5, 0.3);
    // head
    const H = this.headG = new THREE.Group();
    root.add(H);
    part(H, new THREE.SphereGeometry(1.6, 26, 18), this.bodyMat, { scale: [1, 0.85, 1.25], outline: OUTLINE_M });
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.55, 0.4); H.add(this.jaw);
    part(this.jaw, new THREE.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), this.bodyMat, { scale: [1, 0.6, 1.2], outline: OUTLINE_S });
    const tooth = std(0xf4f1ea, 0.4);
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; part(H, new THREE.ConeGeometry(0.12, 0.38, 6), tooth, { pos: [Math.sin(a) * 1.15, -0.45, 0.9 + Math.cos(a) * 0.55], rot: [Math.PI, 0, 0], shadow: false }); }
    // the big eye: the weak point
    const eyeW = part(H, new THREE.SphereGeometry(0.62, 20, 14), std(0xffffff, 0.15), { pos: [0, 0.55, 1.35], outline: OUTLINE_S });
    this.irisMat = glowMat(0xffb020, 1.6);
    this.iris = part(eyeW, new THREE.SphereGeometry(0.34, 16, 12), this.irisMat, { pos: [0, 0, 0.4], shadow: false });
    part(this.iris, new THREE.SphereGeometry(0.16, 10, 8), std(0x1b1530), { pos: [0, 0, 0.22], shadow: false });
    this.lid = part(H, new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.bodyMat, { pos: [0, 0.55, 1.35], rot: [0.4, 0, 0], shadow: false });
    for (const s of [-1, 1]) part(H, new THREE.ConeGeometry(0.28, 1.1, 8), dark, { pos: [0.75 * s, 1.2, -0.3], rot: [-0.8, 0, -0.4 * s], outline: OUTLINE_S });
    // fins along the back
    this.segG = [];
    for (let i = 0; i < SEGS; i++) {
      const r = 1.3 - (i / SEGS) * 0.8;
      const g = new THREE.Group();
      root.add(g);
      part(g, new THREE.SphereGeometry(r, 18, 12), this.bodyMat, { outline: i < 4 ? OUTLINE_M : OUTLINE_S });
      if (i % 2 === 0) part(g, new THREE.ConeGeometry(r * 0.3, r * 1.1, 6), dark, { pos: [0, r * 0.9, 0], shadow: false });
      if (i % 3 === 1) part(g, new THREE.SphereGeometry(r * 0.35, 10, 8), glowMat(0xc29bff, 0.9), { pos: [r * 0.75, r * 0.25, 0], shadow: false });
      this.segG.push(g);
    }
    // tide surface (phase 2)
    this.tideMat = gooMat(GRAY_HEX, { transparent: true, opacity: 0.88, emissive: 0x15131a });
    this.tideMesh = part(root, new THREE.PlaneGeometry(WALK * 2, WALK * 2).rotateX(-Math.PI / 2), this.tideMat, { pos: [0, SURF, 0], shadow: false, receive: true });
    this.tideMesh.visible = false;
    this.lobGeo = new THREE.SphereGeometry(0.42, 16, 12);
    this.lobMat = gooMat(GRAY_HEX);
    this.ringGeo = new THREE.TorusGeometry(1, 0.3, 8, 72);
    this.ringMat = glowMat(0xb9b5c4, 1.4, { transparent: true, opacity: 0.85 });
    this.buildCage();
  }

  buildCage() {
    const at = this.course.cageAt || new THREE.Vector3(0, 10, 0);
    const g = this.cage = new THREE.Group();
    g.position.copy(at);
    this.world.scene.add(g);
    const iron = std(0x3a3742, 0.45, 0.7);
    part(g, new THREE.CylinderGeometry(1.3, 1.3, 0.2, 18), iron, { pos: [0, -1.2, 0], outline: OUTLINE_S });
    part(g, new THREE.CylinderGeometry(1.3, 1.1, 0.2, 18), iron, { pos: [0, 1.4, 0], outline: OUTLINE_S });
    this.bars = new THREE.Group(); g.add(this.bars);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; rod(this.bars, [Math.cos(a) * 1.25, -1.2, Math.sin(a) * 1.25], [Math.cos(a) * 1.1, 1.4, Math.sin(a) * 1.1], 0.05, iron, { seg: 6 }); }
    rod(g, [0, 1.4, 0], [0, 12, 0], 0.06, iron, { seg: 6 });
    const tint = this.tint = new Dripkin({ skin: '#5fb8a6', pattern: 'bands', patternColor: '#1f4f6b', crest: 'fan', eyes: '#ffd23f', bottom: '#1d3557', hat: 'goggles', clothes: 'jacket_night', shoes: 'boots_black' }, '#2ee6c8', null);
    tint.root.position.set(0, -1.1, 0);
    tint.root.scale.setScalar(0.95);
    tint.emote = 'sad';
    g.add(tint.root);
    this.cageY = at.y;
  }

  // ------------------------------------------------------------ lifecycle
  start() { if (this.state === 'dormant') { this.state = 'intro'; this.stateT = 0; } }
  begin() {
    this.state = 'p1'; this.phase = 1; this.stateT = 0;
    this.act = { kind: 'swim', t: 0, dur: 2.2 };
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.7 });
    this.hooks.shake(0.6, 0.8);
  }

  hurt(dmg, attacker, kind) {
    if (!this.fighting || !this.eye.alive) return;
    const w = this.world;
    if (attacker && attacker === w.player) dmg *= w.dmgMul || 1;
    if (kind === 'blast' || kind === 'big') { if (this.blastF === this.t) return; this.blastF = this.t; }
    const i = this.phase - 1;
    if (this.state === 'p2') return;
    const k = this.state === 'beached' ? 1 : i;
    this.hp[k] = Math.max(0, this.hp[k] - dmg);
    this.flash = 1;
    if (this.t - this.hurtSfxT > 0.15) { this.hurtSfxT = this.t; w.audio?.sfx('boss_hurt', { ...posOf(this.eye.pos), volume: 0.8, pitch: 0.8 }); }
    if (this.hp[k] <= 0) {
      if (k === 0) this.enterTide();
      else if (k === 1) this.endBeached();
      else this.defeat();
    }
  }

  enterTide() {
    this.state = 'p2'; this.phase = 2; this.stateT = 0;
    this.eye.alive = false;
    this.act = { kind: 'dive', t: 0 };
    this.tideOn = true;
    this.tideMesh.visible = true;
    for (const id of DRAINS) this.hooks.mech?.setSwitch(id, true, true);
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.55 });
    this.hooks.shake(0.9, 1.6);
    this.hooks.warn('⚠ <b>HIGH TIDE!</b> Get on a raised refuge and paint the <b>drains</b>!', 3.5);
    this.hooks.say([
      { who: 'baron', radio: true, text: 'Swim, little stain! Oh wait. You can\'t. Not in MY gray.' },
      { who: 'tint', text: 'Rookie! There are <b>drains</b> on the walls, one on each side! Paint them all!' },
    ]);
  }
  beach() {
    this.state = 'beached'; this.stateT = 0;
    this.eye.alive = true;
    this.tideOn = false;
    // lies across the south-east walkway
    const a = Math.atan2(this.world.player.pos.z, this.world.player.pos.x);
    this.beachAt = edgePoint(a, new THREE.Vector3()).multiplyScalar(1.45);
    this.beachAt.y = 0.9;
    this.act = { kind: 'beached', t: 0 };
    this.world.audio?.sfx('boss_roar', { volume: 0.9, pitch: 1.3 });
    this.hooks.warn('⚠ It\'s <b>beached</b>! Hit the <b>eye</b> with everything!', 3);
    this.hooks.say([{ who: 'veil', radio: true, text: 'Tide\'s out and that thing is flopping like a fish! <b>The eye, rookie!</b>' }]);
  }
  endBeached() {
    // whatever was left of the beached window carries into the frenzy
    this.hp[2] += this.hp[1]; this.hp[1] = 0;
    this.state = 'p3'; this.phase = 3; this.stateT = 0;
    this.eye.alive = false;
    this.act = { kind: 'retreat', t: 0 };
    this.spitT = 2; this.waveT = 4; this.splitT = 5;
    this.hooks.music?.('battle_c_final');
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 1.2 });
    this.hooks.say([
      { who: 'baron', radio: true, text: 'Get UP, you overgrown noodle! Eat the stain! EAT IT!' },
      { who: 'tint', text: 'It\'s splitting off goo! Keep moving and watch for <b>double lunges</b>!' },
    ]);
  }
  defeat() {
    this.state = 'dying'; this.stateT = 0;
    this.eye.alive = false;
    this.tideOn = false; this.tideMesh.visible = false;
    for (const l of this.lobs) this.world.scene.remove(l.mesh);
    this.lobs = []; this.lobQueue = [];
    for (const r of this.waves) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.waves = [];
    this.hooks.clearMinions();
    this.hooks.music?.(null);
    this.hooks.cine?.({ pos: new THREE.Vector3(10, 7, -18), look: new THREE.Vector3(0, 4, 0) });
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.5 });
    this.hooks.say([
      { who: 'baron', radio: true, text: 'My darling! My beautiful gray darling! …I\'ll be in my manor. SULKING.' },
      { who: 'tint', text: 'Ha! Get me down from here, rookie!' },
    ]);
  }

  // ------------------------------------------------------------ attacks
  spit(n) { for (let i = 0; i < n; i++) this.lobQueue.push(i * 0.22); }
  launchLob(p) {
    const from = this.head.clone().addScaledVector(this.headDir, 1.4);
    from.y += 0.4;
    const T = rand(1.0, 1.35);
    const tgt = p.pos.clone();
    tgt.x += p.vel.x * T * 0.6 + rand(-1.6, 1.6);
    tgt.z += p.vel.z * T * 0.6 + rand(-1.6, 1.6);
    const h = this.world.level.heightAt(tgt.x, tgt.z).y;
    tgt.y = Number.isFinite(h) ? h : 0;
    const vel = new THREE.Vector3((tgt.x - from.x) / T, (tgt.y - from.y + 0.5 * LOB_G * T * T) / T, (tgt.z - from.z) / T);
    const mesh = new THREE.Mesh(this.lobGeo, this.lobMat);
    mesh.add(new THREE.Mesh(this.lobGeo, OUTLINE_M));
    mesh.position.copy(from);
    this.world.scene.add(mesh);
    this.lobs.push({ pos: from, vel, mesh, tgt, ringT: 0, life: 0 });
    this.world.audio?.sfx('bomb_throw', { ...posOf(from), volume: 0.7, pitch: 0.5 });
  }
  updateLobs(dt) {
    const w = this.world;
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const l = this.lobs[i];
      l.life += dt; l.ringT -= dt;
      if (l.ringT <= 0) { l.ringT = 0.22; w.fx.ring(l.tgt.clone().setY(l.tgt.y + 0.06), 0xffb020, 2.4, 0.4, 0.3, { alpha: 0.9 }); }
      l.vel.y -= LOB_G * dt;
      const step = l.vel.length() * dt;
      _v.copy(l.vel).normalize();
      const hit = w.level.raycast(l.pos, _v, step);
      let boom = null;
      if (hit) boom = hit.point.clone().addScaledVector(hit.normal, 0.1);
      else {
        l.pos.addScaledVector(l.vel, dt);
        const p = w.player;
        if (p.alive && l.pos.distanceTo(_w.copy(p.pos).setY(p.pos.y + 0.7)) < 0.9) boom = l.pos.clone();
        if (l.pos.y < SURF && Math.abs(l.pos.x) < POOL && Math.abs(l.pos.z) < POOL) boom = l.pos.clone();
      }
      if (boom || l.life > 5) {
        if (boom) w.combat.explode(boom, this, 2.3, 46, 14, 2.3, { extra: 3 });
        w.scene.remove(l.mesh);
        this.lobs.splice(i, 1);
        continue;
      }
      l.mesh.position.copy(l.pos);
    }
  }
  launchWave() {
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.35;
    this.world.scene.add(mesh);
    this.waves.push({ r: POOL, mesh });
    this.world.audio?.sfx('explode', { volume: 0.8, pitch: 0.5 });
    this.hooks.shake(0.5, 0.4);
  }
  updateWaves(dt, p) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const r = this.waves[i];
      const prev = r.r;
      r.r += dt * 8;
      r.mesh.scale.set(r.r, r.r, 1);
      r.mesh.material.opacity = Math.min(1, (34 - r.r) / 4);
      if (p.alive && p.invuln <= 0) {
        const pr = Math.max(Math.abs(p.pos.x), Math.abs(p.pos.z));
        if (pr > prev - 0.3 && pr <= r.r + 0.3 && p.pos.y < 0.75) { this.world.combat.damage(p, 35, this, 'ring'); p.vel.y = Math.max(p.vel.y, 6); }
      }
      if (r.r > 34) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); this.waves.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------ head behaviour
  // choose the next action
  nextAct(p) {
    const ph = this.phase;
    if (this.state === 'p2') { this.act = { kind: 'circle', t: 0, ang: Math.atan2(this.head.z, this.head.x) }; return; }
    const r = Math.random();
    if (r < (ph >= 3 ? 0.25 : 0.2)) this.act = { kind: 'spit', t: 0 };
    else {
      const a = Math.atan2(p.pos.z, p.pos.x) + rand(-0.4, 0.4);
      this.act = { kind: 'rise', t: 0, at: edgePoint(a, new THREE.Vector3()), double: ph >= 3 && Math.random() < 0.6 };
    }
  }

  updateHead(dt, p) {
    const a = this.act, w = this.world;
    if (!a) return;
    a.t += dt;
    const H = this.head;
    const want = _a;
    let speed = 9;
    if (a.kind === 'swim') {
      const ang = this.t * 0.8;
      want.set(Math.cos(ang) * 5, -2.5, Math.sin(ang) * 5);
      if (a.t > a.dur) this.nextAct(p);
    } else if (a.kind === 'dive') {
      want.set(H.x * 0.5, -4, H.z * 0.5);
      if (a.t > 1.5) this.act = this.state === 'p2' ? { kind: 'circle', t: 0, ang: Math.atan2(H.z, H.x) } : { kind: 'swim', t: 0, dur: 1.5 };
    } else if (a.kind === 'spit') {
      want.set(0, 3.2, 0);
      if (a.t > 0.9 && !a.done) { a.done = true; this.spit(this.phase >= 3 ? 5 : 3); this.headDir.set(p.pos.x, 0, p.pos.z).normalize(); }
      if (a.t > 2.4) this.act = { kind: 'swim', t: 0, dur: rand(1.2, 2) };
    } else if (a.kind === 'rise') {
      // bubbles + warning ring at the emergence point
      a.ringT = (a.ringT || 0) - dt;
      if (a.ringT <= 0) { a.ringT = 0.18; w.fx.ring(new THREE.Vector3(a.at.x * 0.88, SURF + 0.1, a.at.z * 0.88), 0xffb020, 2.4, 0.4, 0.25, { alpha: 0.9 }); }
      if (Math.random() < dt * 30) w.fx.spawn(new THREE.Vector3(a.at.x * 0.85 + rand(-1, 1), SURF, a.at.z * 0.85 + rand(-1, 1)), new THREE.Vector3(0, rand(1, 3), 0), GRAY_HEX, rand(0.1, 0.2), 0.5);
      want.set(a.at.x * 0.85, a.t > 1.1 ? 4.2 : -2, a.at.z * 0.85);
      speed = a.t > 1.1 ? 12 : 8;
      if (a.t > 1.1 && !a.roared) { a.roared = true; w.audio?.sfx('boss_roar', { ...posOf(H), volume: 0.7, pitch: 1.1 }); }
      if (a.t > 1.7) {
        // lock the lunge line toward the player (clamped onto the walkway)
        const dir = new THREE.Vector3(p.pos.x - a.at.x, 0, p.pos.z - a.at.z);
        const d = Math.min(Math.max(dir.length(), 4), 11);
        dir.normalize();
        const end = a.at.clone().addScaledVector(dir, d);
        end.x = Math.max(-WALK + 1.5, Math.min(WALK - 1.5, end.x)); end.z = Math.max(-WALK + 1.5, Math.min(WALK - 1.5, end.z));
        this.act = { kind: 'aim', t: 0, from: a.at.clone(), end, double: a.double };
      }
    } else if (a.kind === 'aim') {
      want.set(a.from.x * 0.95, 4.6, a.from.z * 0.95);
      speed = 6;
      this.headDir.subVectors(a.end, a.from).setY(0).normalize();
      a.dotT = (a.dotT || 0) - dt;
      if (a.dotT <= 0) { a.dotT = 0.1; for (let k = 1; k <= 5; k++) { const q = a.from.clone().lerp(a.end, k / 5); w.fx.ring(q.setY(0.08), 0xff5d5d, 0.9, 0.2, 0.22, { alpha: 0.85 }); } }
      if (a.t > 0.85) { this.act = { kind: 'lunge', t: 0, from: a.from, end: a.end, double: a.double, hit: false }; w.audio?.sfx('launch', { ...posOf(H), volume: 0.9, pitch: 0.5 }); }
    } else if (a.kind === 'lunge') {
      const k = Math.min(1, a.t / 0.45);
      want.copy(a.from).lerp(a.end, k); want.y = 4.6 * (1 - k) + 1.1 * k;
      H.copy(want);
      if (!a.hit && p.alive && p.invuln <= 0 && H.distanceTo(_w.copy(p.pos).setY(p.pos.y + 0.8)) < 2.4) {
        a.hit = true;
        w.combat.damage(p, 50, this, 'bite');
        const n = _w.copy(p.pos).sub(H).setY(0).normalize();
        p.vel.x += n.x * 9; p.vel.z += n.z * 9; p.vel.y = Math.max(p.vel.y, 6);
      }
      if (k >= 1) {
        w.audio?.sfx('land_heavy', { ...posOf(H), volume: 1, pitch: 0.5 });
        this.hooks.shake(0.6, 0.5);
        w.combat.paint(this, H.clone().setY(0.05), 2.4, { wobble: 0.3 });
        if (a.double && !a.second) {
          // a second lunge from where it landed, toward the player again
          const dir = new THREE.Vector3(p.pos.x - H.x, 0, p.pos.z - H.z);
          const d = Math.min(dir.length(), 8); dir.normalize();
          const end = H.clone().addScaledVector(dir, d); end.y = 0;
          end.x = Math.max(-WALK + 1.5, Math.min(WALK - 1.5, end.x)); end.z = Math.max(-WALK + 1.5, Math.min(WALK - 1.5, end.z));
          this.act = { kind: 'aim', t: 0.35, from: H.clone().setY(0), end, double: false, second: true };
        } else this.act = { kind: 'stuck', t: 0, at: H.clone() };
      }
      return this.chain(dt);
    } else if (a.kind === 'stuck') {
      want.copy(a.at); want.y = 1.1 + Math.abs(Math.sin(this.t * 7)) * 0.15;
      this.eye.alive = true;
      if (a.t > (this.phase >= 3 ? 2.2 : 2.8)) { this.eye.alive = false; this.act = { kind: 'retreat', t: 0 }; }
    } else if (a.kind === 'retreat') {
      want.copy(H).setY(-3); want.x *= 0.5; want.z *= 0.5;
      speed = 7;
      if (a.t > 1.4) this.act = { kind: 'swim', t: 0, dur: this.phase >= 3 ? rand(0.8, 1.4) : rand(1.4, 2.2) };
    } else if (a.kind === 'circle') {
      // high tide: it swims laps through the flooded walkway, surfacing to spit
      a.ang += dt * 0.55;
      const r = 16.5;
      want.set(Math.cos(a.ang) * r, this.tide + 0.4 + Math.sin(a.t * 2) * 0.4, Math.sin(a.ang) * r);
      this.headDir.set(-Math.sin(a.ang), 0, Math.cos(a.ang));
      speed = 10;
      a.spit = (a.spit ?? 3) - dt;
      if (a.spit <= 0) { a.spit = 4; this.spit(2); }
      if (p.alive && p.invuln <= 0 && H.distanceTo(_w.copy(p.pos).setY(p.pos.y + 0.8)) < 2.2 && this.t - (this.biteT || 0) > 1.2) {
        this.biteT = this.t;
        w.combat.damage(p, 35, this, 'bite');
        p.vel.y = Math.max(p.vel.y, 7);
      }
    } else if (a.kind === 'beached') {
      want.copy(this.beachAt); want.y = 1.0 + Math.abs(Math.sin(this.t * 5)) * 0.25;
      this.headDir.set(-this.beachAt.x, 0, -this.beachAt.z).normalize();
      if (a.t > 8) this.endBeached();
    }
    // steer the head toward its target
    _w.subVectors(want, H);
    const dl = _w.length();
    if (dl > 0.001) H.addScaledVector(_w, Math.min(1, (speed * dt) / dl));
    if (a.kind !== 'circle' && a.kind !== 'beached' && a.kind !== 'aim' && a.kind !== 'spit') {
      _w.set(p.pos.x - H.x, 0, p.pos.z - H.z);
      if (_w.lengthSq() > 0.1) this.headDir.lerp(_w.normalize(), 1 - Math.exp(-3 * dt)).normalize();
    }
    this.chain(dt);
  }

  // body segments follow the head like a rope; segments in the pool sink below the goo
  chain() {
    let prev = this.head;
    for (let i = 0; i < SEGS; i++) {
      const s = this.segs[i];
      _w.subVectors(s, prev);
      const d = _w.length() || 1;
      if (d > SPACING) s.copy(prev).addScaledVector(_w, SPACING / d);
      // body segments over the walkway stay on top of it
      const inPool = Math.abs(s.x) < POOL - 0.5 && Math.abs(s.z) < POOL - 0.5;
      if (!inPool && s.y < 0.6 && this.state !== 'p2') s.y = 0.6;
      prev = s;
    }
  }

  // ------------------------------------------------------------ update
  update(dt, ctx) {
    const p = ctx.player, w = this.world;
    this.t += dt; this.stateT += dt;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 6); this.bodyMat.emissive.copy(this.bodyBase).lerp(new THREE.Color(1, 1, 1), this.flash * 0.5); }
    if (this.state === 'intro' || this.state === 'dormant') {
      // lurking: bubbles and a lazy loop under the surface
      this.act = this.act || { kind: 'swim', t: 0, dur: 999 };
      this.updateHead(dt, p);
    } else if (this.fighting) {
      this.updateHead(dt, p);
      // phase 2: the tide rises unless drained; all four drains = beached
      if (this.state === 'p2') {
        if (!p.alive) this.tide = Math.min(this.tide, SURF);
        const n = this.drainsDone;
        const target = n >= 4 ? SURF - 0.5 : 1.0 - n * 0.35;
        this.tide += Math.sign(target - this.tide) * Math.min(Math.abs(target - this.tide), (target > this.tide ? 0.3 : 1.2) * dt);
        if (n >= 4 && this.tide <= SURF) this.beach();
      }
      if (this.phase >= 3 && this.state === 'p3') {
        this.waveT -= dt;
        if (this.waveT <= 0) { this.launchWave(); this.waveT = rand(6, 8); }
        this.splitT -= dt;
        if (this.splitT <= 0 && this.hooks.minionCount() < 3) {
          this.splitT = rand(10, 13);
          const at = edgePoint(rand(0, Math.PI * 2), new THREE.Vector3()).multiplyScalar(1.15);
          w.fx.splash(at.clone().setY(1), UP, GRAY_HEX, 18, 5, 0.1);
          this.hooks.spawn('splotch', at, { size: 'M' });
        }
      }
    } else if (this.state === 'dying') this.updateDying(dt);
    // tide surface + damage
    this.tideMesh.visible = this.tideOn || this.tide > SURF + 0.05;
    if (!this.tideOn && this.tide > SURF) this.tide = Math.max(SURF, this.tide - dt * 1.2);
    this.tideMesh.position.y = this.tide + Math.sin(this.t * 1.7) * 0.04;
    if (this.tide > 0.05 && p.alive && p.invuln <= 0) {
      const depth = this.tide - p.pos.y;
      if (depth > 0.1) {
        const dps = (depth > 1.1 ? 60 : 24) * (this.hooks.story?.effects?.armor ?? 1);
        p.hp -= dps * dt; p.lastDamage = p.time;
        p.vel.x *= Math.exp(-3 * dt); p.vel.z *= Math.exp(-3 * dt);
        this.tideHurtT -= dt;
        if (this.tideHurtT <= 0) { this.tideHurtT = 0.6; this.hooks.story?.onPlayerHurt?.(dps, null); }
        if (p.hp <= 0) p.splatted(this, 'goo');
      }
    }
    for (let i = this.lobQueue.length - 1; i >= 0; i--) {
      this.lobQueue[i] -= dt;
      if (this.lobQueue[i] <= 0) { this.lobQueue.splice(i, 1); if (this.fighting && p.alive) this.launchLob(p); }
    }
    this.updateLobs(dt);
    this.updateWaves(dt, p);
    this.sync(dt, p);
  }

  updateDying(dt) {
    const w = this.world, k = this.stateT;
    // thrash, then burst segment by segment into colour
    this.head.y = 2 + Math.sin(this.t * 9) * 0.8;
    this.chain(dt);
    const n = Math.floor(k / 0.28);
    if (n > (this.burstN ?? -1) && n <= SEGS) {
      this.burstN = n;
      const s = n === 0 ? this.head : this.segs[n - 1];
      const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
      w.fx.explosion(s.clone().setY(Math.max(s.y, 0.5)), col, 2);
      w.fx.splash(s.clone().setY(Math.max(s.y, 0.5)), UP, col, 20, 6, 0.1, 1.2);
      w.audio?.sfx('explode', { ...posOf(s), volume: 0.8 });
      if (n === 0) this.headG.visible = false; else this.segG[n - 1].visible = false;
      w.combat.paint(w.player, _v.set(s.x, 0.05, s.z), 2.4, { wobble: 0.3 });
    }
    // Tint's cage swings over and lowers onto the south walkway
    const c = Math.min(1, Math.max(0, (k - 2.5) / 2.5));
    this.cage.position.set(0, this.cageY + (1.25 - this.cageY) * c, -16 * c);
    if (k > 5.2 && !this.opened) {
      this.opened = true;
      this.bars.visible = false;
      this.tint.emote = 'cheer';
      w.fx.explosion(this.cage.position.clone(), 0x2ee6c8, 1.6);
      w.audio?.sfx('door_heavy', { volume: 0.9 });
      this.hooks.flash?.(0xffffff, 0.6);
    }
    if (k > 6.2) {
      this.hooks.cine?.(null);
      this.state = 'dead';
      this.root.visible = false;
      this.hooks.onDefeated(new THREE.Vector3(5, 0, -16));
    }
  }

  sync(dt, p) {
    const H = this.head;
    this.headG.position.copy(H);
    this.headG.rotation.y = Math.atan2(this.headDir.x, this.headDir.z);
    const open = this.act?.kind === 'aim' || this.act?.kind === 'spit' ? 0.7 : this.act?.kind === 'stuck' || this.state === 'beached' ? 0.35 + Math.sin(this.t * 6) * 0.15 : 0.15;
    this.jaw.rotation.x += (open - this.jaw.rotation.x) * (1 - Math.exp(-10 * dt));
    const exposed = this.eye.alive;
    this.lid.rotation.x = exposed ? -0.9 : 0.4;
    this.irisMat.color.setRGB(1, 0.69, 0.13).multiplyScalar(exposed ? 2.6 + Math.sin(this.t * 10) * 0.8 : 1.2);
    for (let i = 0; i < SEGS; i++) {
      const s = this.segs[i], g = this.segG[i];
      g.position.copy(s);
      const nxt = i === 0 ? H : this.segs[i - 1];
      g.lookAt(nxt);
    }
    // eye hitbox: in front of the head
    this.headG.updateMatrixWorld(true);
    this.eye.pos.copy(this.iris.getWorldPosition(_v)).setY(_v.y - 1.2);
    // ripples where the body breaks the surface
    if (this.state !== 'dying' && this.state !== 'dead' && Math.random() < dt * 8) {
      const s = this.segs[Math.floor(Math.random() * SEGS)];
      if (Math.abs(s.y - SURF) < 1 && Math.abs(s.x) < POOL && Math.abs(s.z) < POOL) this.world.fx.ring(new THREE.Vector3(s.x, SURF + 0.05, s.z), 0xb9b5c4, 0.4, 1.6, 0.6, { alpha: 0.5 });
    }
    // Tint swings gently in her cage
    if (this.state !== 'dying' && this.state !== 'dead') {
      this.cage.rotation.z = Math.sin(this.t * 0.9) * 0.05;
      this.cage.rotation.y += dt * 0.2;
    }
    this.tint.update(dt, { speed: 0, grounded: true, vy: 0, pitch: 0, weapon: null });
    void p;
  }

  dispose() {
    for (const l of this.lobs) this.world.scene.remove(l.mesh);
    for (const r of this.waves) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.lobGeo.dispose(); this.lobMat.dispose(); this.ringGeo.dispose(); this.ringMat.dispose(); this.tideMat.dispose();
    this.tint.dispose?.();
    disposeTree(this.cage);
    disposeTree(this.root);
  }
}
