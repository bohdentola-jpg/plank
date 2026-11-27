// The Gray Engine: Baron Grisaille's colour-draining machine (level 5 boss).
//   Phase 1  paint the four valve shutters to crack them open, then burst the valves
//   Phase 2  the lid opens: shoot the stolen Prism Heart between its orbiting shields
//   Phase 3  meltdown: faster double sweeps, shockwave rings, heavier mortar fire
// Attacks: a gray sweep beam you dodge by swimming under it in your own ink,
// lobbed gray mortars, and Smudges summoned from the drain pipes.
import * as THREE from 'three';
import { part, rod, std, gooMat, glowMat, OUTLINE_S, OUTLINE_M, OUTLINE_L, posOf, disposeTree } from './kit.js';
import { GRAY_HEX } from './enemies.js';

export const VALVE_HP = 160, HEART_HP = 1500;
const DIRS = [{ face: 'px', x: 1, z: 0 }, { face: 'nx', x: -1, z: 0 }, { face: 'pz', x: 0, z: 1 }, { face: 'nz', x: 0, z: -1 }];
export const DRAINS = [[-18.6, 18.6], [18.6, 18.6], [-18.6, -18.6], [18.6, -18.6]];
const UP = new THREE.Vector3(0, 1, 0);
const LOB_G = 20;
const R_IN = 4.75, R_OUT = 32;
const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);

// Hit-box proxy: a duck-typed combat target that forwards damage to the boss.
class Part {
  constructor(boss, kind, i, hh) {
    this.boss = boss; this.kind = kind; this.i = i; this.hh = hh;
    this.team = 2; this.name = kind === 'shield' ? 'Shield Plate' : kind === 'heart' ? 'Prism Heart' : 'Pressure Valve';
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.alive = false; this.invuln = 0; this.hp = 1; this.submerged = false; this.form = 'kid'; this.time = 0;
    this.lastAttacker = null; this.lastAttackT = -9;
    this.stats = { kills: 0, deaths: 0, turf: 0, assists: 0, specials: 0 };
    this.shield = kind === 'shield';
    this.boss_part = true;
  }
  get color() { return this.boss.world.colors[2]; }
  hitHeight() { return this.hh; }
  takeDamage(dmg, attacker, kind) { this.boss.hurt(this, dmg, attacker, kind); }
}

export class GrisailleEngine {
  constructor(world, course, hooks) {
    this.world = world; this.course = course; this.hooks = hooks;
    this.team = 2; this.name = 'Baron Grisaille'; this.alive = true;
    this.stats = { kills: 0, deaths: 0, turf: 0, assists: 0, specials: 0 };
    this.pos = new THREE.Vector3(0, 3, 0);
    this.state = 'dormant'; this.phase = 0; this.t = 0; this.frame = 0; this.stateT = 0;
    this.valveHp = DIRS.map(() => VALVE_HP);
    this.heartHp = HEART_HP;
    this.max = VALVE_HP * DIRS.length + HEART_HP;
    this.flash = 0; this.hurtSfxT = 0;
    this.topYaw = Math.PI; // facing the entrance (-z)
    this.lobs = []; this.rings = []; this.geysers = []; this.lobQueue = [];
    this.sweep = null; this.sweepT = 7; this.lobT = 3; this.summonT = 14; this.ringT = 5; this.sweepHitT = 0;
    this.saidValve = false;
    this.build();
    // hit boxes
    this.valves = DIRS.map((d, i) => { const p = new Part(this, 'valve', i, 2.3); p.pos.set(d.x * 4.78, 0.35, d.z * 4.78); return p; });
    this.hearts = [[0, 0], [0.78, 0], [-0.78, 0], [0, 0.78], [0, -0.78]].map(([x, z], i) => { const p = new Part(this, 'heart', i, 2.5); p.off = new THREE.Vector3(x, -1.25, z); return p; });
    this.shields = [];
    for (let s = 0; s < 3; s++) for (const k of [0.22, 0.72]) { const p = new Part(this, 'shield', s, 3.0); p.plate = s; p.k = k; this.shields.push(p); }
    this.parts = [...this.valves, ...this.hearts, ...this.shields];
    for (const p of this.parts) world.fighters.push(p);
  }

  get color() { return this.world.colors[2]; }
  get frac() { return Math.max(0, this.valveHp.reduce((a, b) => a + Math.max(0, b), 0) + Math.max(0, this.heartHp)) / this.max; }
  get valvesLeft() { return this.valveHp.filter((h) => h > 0).length; }
  get fighting() { return this.state === 'p1' || this.state === 'p2' || this.state === 'p3'; }
  get label() {
    if (this.state === 'p1') return `PHASE 1 · PAINT THE SHUTTERS, BURST THE VALVES (${DIRS.length - this.valvesLeft}/${DIRS.length})`;
    if (this.state === 'trans') return 'THE LID IS OPENING…';
    if (this.state === 'p2') return 'PHASE 2 · STRIKE THE PRISM HEART';
    if (this.state === 'p3') return 'PHASE 3 · MELTDOWN!';
    if (this.state === 'dying' || this.state === 'dead') return 'THE ENGINE IS BREAKING DOWN!';
    return '';
  }

  // ------------------------------------------------------------ visuals
  build() {
    const root = this.root = new THREE.Group();
    root.name = 'gray-engine';
    this.world.scene.add(root);
    const iron = std(0x4a4652, 0.55, 0.3);
    this.bodyMat = std(0xa19eaa, 0.45, 0.25);
    this.bodyBase = this.bodyMat.emissive.clone();
    const dark = std(0x2e2b35, 0.6, 0.3);
    part(root, new THREE.CylinderGeometry(5.5, 5.7, 0.5, 40), iron, { pos: [0, 0.25, 0], receive: true });
    this.boiler = part(root, new THREE.CylinderGeometry(4.5, 4.55, 5.4, 40), this.bodyMat, { pos: [0, 3.0, 0], outline: OUTLINE_L, receive: true });
    for (const y of [0.9, 3.1, 5.35]) part(root, new THREE.TorusGeometry(4.58, 0.13, 8, 48), dark, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    part(root, new THREE.CylinderGeometry(4.75, 4.7, 0.4, 40), iron, { pos: [0, 5.85, 0], outline: OUTLINE_M });
    // valves (behind the shutters)
    this.valveVis = DIRS.map((d) => {
      const g = new THREE.Group();
      g.position.set(d.x * 4.0, 1.75, d.z * 4.0);
      g.rotation.y = Math.atan2(d.x, d.z);
      root.add(g);
      part(g, new THREE.BoxGeometry(2.3, 2.3, 0.4), dark, { pos: [0, 0, -0.05], shadow: false });
      const bulbMat = new THREE.MeshPhysicalMaterial({ color: 0xb04a4a, roughness: 0.15, clearcoat: 1, emissive: 0x501010, emissiveIntensity: 1 });
      const bulb = part(g, new THREE.SphereGeometry(0.55, 20, 14), bulbMat, { pos: [0, 0, 0.25], outline: OUTLINE_S });
      const wheel = part(g, new THREE.TorusGeometry(0.42, 0.07, 8, 20), std(0xc8643c, 0.4, 0.6), { pos: [0, 0, 0.55], shadow: false });
      for (let i = 0; i < 3; i++) part(wheel, new THREE.BoxGeometry(0.8, 0.06, 0.06), std(0xc8643c, 0.4, 0.6), { rot: [0, 0, (i * Math.PI) / 3], shadow: false });
      return { g, bulb, bulbMat, wheel, broken: false };
    });
    // drain pipes curling into the floor (decor)
    for (const [x, z] of DRAINS) {
      const a = Math.atan2(z, x);
      rod(root, [Math.cos(a) * 4.4, 4.6, Math.sin(a) * 4.4], [Math.cos(a) * 7.2, 4.6, Math.sin(a) * 7.2], 0.42, iron);
      rod(root, [Math.cos(a) * 7.2, 4.6, Math.sin(a) * 7.2], [Math.cos(a) * 7.2, 0, Math.sin(a) * 7.2], 0.42, iron);
      part(root, new THREE.SphereGeometry(0.55, 14, 10), dark, { pos: [Math.cos(a) * 7.2, 4.6, Math.sin(a) * 7.2], shadow: false });
    }
    // sweep emitter ring
    this.emitMat = glowMat(0x9a97a3, 0.2);
    part(root, new THREE.TorusGeometry(4.78, 0.15, 8, 64), this.emitMat, { pos: [0, 0.95, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    // rotating top: dome lid, cockpit with the Baron, top-hat smokestack
    const top = this.top = new THREE.Group();
    top.position.y = 6.05;
    root.add(top);
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, 0, -2.7);
    top.add(this.lidPivot);
    this.lid = part(this.lidPivot, new THREE.SphereGeometry(2.75, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.bodyMat, { pos: [0, 0, 2.7], outline: OUTLINE_L });
    part(this.lidPivot, new THREE.TorusGeometry(2.76, 0.12, 8, 40), dark, { pos: [0, 0.05, 2.7], rot: [Math.PI / 2, 0, 0], shadow: false });
    part(this.lidPivot, new THREE.CylinderGeometry(0.35, 0.45, 0.5, 12), iron, { pos: [0, 2.85, 2.7] });
    // furnace portholes glowing around the boiler (pulse harder each phase)
    this.portMat = glowMat(0xff9a40, 1.6);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * 4.52, 4.25, Math.cos(a) * 4.52);
      g.rotation.y = a;
      root.add(g);
      part(g, new THREE.TorusGeometry(0.36, 0.07, 6, 18), dark, { shadow: false });
      part(g, new THREE.CircleGeometry(0.32, 18), this.portMat, { pos: [0, 0, 0.02], shadow: false });
    }
    // gauges ("eyes") on the lid, facing forward
    this.gaugeMats = [];
    for (const s of [-1, 1]) {
      const gm = glowMat(0xffb020, 1.2);
      this.gaugeMats.push(gm);
      const gauge = part(this.lidPivot, new THREE.CylinderGeometry(0.42, 0.42, 0.18, 20).rotateX(Math.PI / 2), iron, { pos: [s * 1.05, 1.55, 2.7 + 2.15], rot: [-0.55, 0, 0], outline: OUTLINE_S });
      part(gauge, new THREE.CircleGeometry(0.33, 20), std(0xf4f1ea, 0.4), { pos: [0, 0, 0.1], shadow: false });
      const needle = part(gauge, new THREE.BoxGeometry(0.05, 0.3, 0.02), gm, { pos: [0, 0.1, 0.12], shadow: false });
      needle.userData.s = s;
      (this.needles || (this.needles = [])).push(needle);
    }
    // smokestack shaped like a top hat
    const hat = this.hat = new THREE.Group();
    hat.position.set(-2.2, 0, -2.0);
    top.add(hat);
    const black = std(0x1d1b22, 0.55, 0.3);
    part(hat, new THREE.CylinderGeometry(1.45, 1.45, 0.2, 28), black, { pos: [0, 0.3, 0], outline: OUTLINE_M });
    part(hat, new THREE.CylinderGeometry(0.85, 0.9, 3.3, 28), black, { pos: [0, 2.0, 0], outline: OUTLINE_M });
    part(hat, new THREE.CylinderGeometry(0.91, 0.91, 0.5, 28), std(0x6d5f86, 0.5, 0.3), { pos: [0, 0.75, 0], shadow: false });
    // cockpit balcony + Baron
    const pit = new THREE.Group();
    pit.position.set(0, 0, 3.35);
    top.add(pit);
    part(pit, new THREE.CylinderGeometry(1.1, 1.0, 0.5, 20), iron, { pos: [0, 0.2, 0], outline: OUTLINE_M });
    part(pit, new THREE.TorusGeometry(1.05, 0.06, 6, 24), std(0xc9a640, 0.3, 0.8), { pos: [0, 1.05, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14); part(pit, new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), std(0xc9a640, 0.3, 0.8), { pos: [Math.cos(a) * 1.05, 0.75, Math.sin(a) * 1.05], shadow: false }); }
    this.baron = this.buildBaron();
    this.baron.position.set(0, 0.45, 0);
    pit.add(this.baron);
    this.pit = pit;
    // heart (stolen Hue Core) hidden inside until phase 2
    const heart = this.heart = new THREE.Group();
    heart.position.set(0, 4.6, 0);
    root.add(heart);
    this.heartMat = new THREE.MeshPhysicalMaterial({ color: 0xb8b4c2, roughness: 0.08, clearcoat: 1, emissive: 0x9a97a3, emissiveIntensity: 0.9, flatShading: true });
    this.heartBase = new THREE.Color(0x9a97a3);
    const hg = new THREE.OctahedronGeometry(1.35, 0); hg.scale(0.8, 1.4, 0.8);
    this.heartGem = part(heart, hg, this.heartMat, { outline: OUTLINE_M });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      rod(heart, [Math.cos(a) * 1.25, -1.8, Math.sin(a) * 1.25], [Math.cos(a) * 0.4, 2.1, Math.sin(a) * 0.4], 0.07, iron);
    }
    this.heartLight = new THREE.PointLight(0xc8c4d0, 0, 16, 1.6);
    heart.add(this.heartLight);
    // orbiting shields
    this.shieldG = new THREE.Group();
    heart.add(this.shieldG);
    this.shieldMat = std(0x6d6a76, 0.4, 0.75, { side: THREE.DoubleSide });
    this.shieldPlates = [];
    for (let s = 0; s < 3; s++) {
      const piv = new THREE.Group();
      this.shieldG.add(piv);
      const pl = part(piv, new THREE.CylinderGeometry(2.2, 2.2, 3.0, 10, 1, true, 0, 0.95), this.shieldMat, { pos: [0, 0.1, 0], outline: OUTLINE_S });
      pl.castShadow = false;
      part(piv, new THREE.TorusGeometry(2.2, 0.05, 6, 20, 0.95), glowMat(0xffb020, 1.6), { pos: [0, 1.6, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
      part(piv, new THREE.TorusGeometry(2.2, 0.05, 6, 20, 0.95), glowMat(0xffb020, 1.6), { pos: [0, -1.4, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
      this.shieldPlates.push(piv);
    }
    this.shieldG.visible = false;
    this.heart.visible = false;
    // sweep beams
    const sw = this.sweepPivot = new THREE.Group();
    root.add(sw);
    const L = R_OUT - R_IN;
    this.beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb9b5c4).multiplyScalar(1.1), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    this.edgeMat = glowMat(0xe6e2f0, 2.6, { transparent: true, opacity: 1 });
    this.beams = [0, Math.PI].map((off) => {
      const arm = new THREE.Group();
      arm.rotation.y = off;
      sw.add(arm);
      part(arm, new THREE.BoxGeometry(L, 1.1, 0.32), this.beamMat, { pos: [R_IN + L / 2, 0.95, 0], shadow: false });
      for (const y of [0.4, 1.5]) part(arm, new THREE.BoxGeometry(L, 0.07, 0.36), this.edgeMat, { pos: [R_IN + L / 2, y, 0], shadow: false });
      arm.visible = false;
      return arm;
    });
    // lob + ring meshes share geometry
    this.lobGeo = new THREE.SphereGeometry(0.4, 16, 12);
    this.lobMat = gooMat(GRAY_HEX);
    this.ringGeo = new THREE.TorusGeometry(1, 0.32, 8, 72);
    this.ringMat = glowMat(0xb9b5c4, 1.4, { transparent: true, opacity: 0.85 });
  }

  buildBaron() {
    const g = new THREE.Group();
    g.scale.setScalar(1.6);
    const suit = std(0x8d8a96, 0.65), skin = std(0xc9c6cf, 0.55), black = std(0x1d1b22, 0.5, 0.2), coat = std(0x3b3745, 0.7);
    part(g, new THREE.ConeGeometry(0.42, 0.6, 16), coat, { pos: [0, 0.3, 0], outline: OUTLINE_S });
    part(g, new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), suit, { pos: [0, 0.72, 0], outline: OUTLINE_S });
    part(g, new THREE.BoxGeometry(0.16, 0.22, 0.05), std(0xf4f1ea, 0.5), { pos: [0, 0.82, 0.27], shadow: false });
    const head = this.baronHead = new THREE.Group();
    head.position.y = 1.32;
    g.add(head);
    part(head, new THREE.SphereGeometry(0.3, 20, 14), skin, { outline: OUTLINE_S });
    for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.045, 8, 6), black, { pos: [0.11 * s, 0.05, 0.26], shadow: false });
    part(head, new THREE.TorusGeometry(0.08, 0.014, 6, 16), std(0xc9a640, 0.3, 0.8), { pos: [0.11, 0.05, 0.285], shadow: false });
    part(head, new THREE.CircleGeometry(0.07, 14), new THREE.MeshPhysicalMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.45, roughness: 0.05 }), { pos: [0.11, 0.05, 0.29], shadow: false });
    for (const s of [-1, 1]) {
      part(head, new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), std(0x4a4652, 0.6), { pos: [0.09 * s, -0.08, 0.27], rot: [0, 0, (Math.PI / 2) * s + 0.35 * s], shadow: false });
      part(head, new THREE.TorusGeometry(0.04, 0.018, 6, 10, Math.PI * 1.3), std(0x4a4652, 0.6), { pos: [0.2 * s, -0.03, 0.25], rot: [0, 0, s > 0 ? -0.4 : Math.PI + 0.4], shadow: false });
    }
    part(head, new THREE.CylinderGeometry(0.37, 0.37, 0.035, 20), black, { pos: [0, 0.27, 0], outline: OUTLINE_S });
    part(head, new THREE.CylinderGeometry(0.22, 0.23, 0.46, 20), black, { pos: [0, 0.5, 0], outline: OUTLINE_S });
    part(head, new THREE.CylinderGeometry(0.235, 0.235, 0.08, 20), std(0x6d5f86, 0.5), { pos: [0, 0.33, 0], shadow: false });
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.34 * s, 1.0, 0);
      g.add(sh);
      part(sh, new THREE.CapsuleGeometry(0.08, 0.36, 4, 8), suit, { pos: [0, -0.22, 0], outline: OUTLINE_S });
      part(sh, new THREE.SphereGeometry(0.1, 10, 8), std(0xf4f1ea, 0.5), { pos: [0, -0.48, 0], shadow: false });
      this.arms.push(sh);
    }
    return g;
  }

  // ------------------------------------------------------------ lifecycle
  start() { if (this.state === 'dormant') { this.state = 'intro'; this.stateT = 0; } }

  begin() {
    this.state = 'p1'; this.phase = 1; this.stateT = 0;
    this.sweepT = 6; this.lobT = 2.5; this.summonT = 16;
    for (const v of this.valves) v.alive = false;
    this.world.audio?.sfx('boss_roar', { volume: 1 });
    this.hooks.shake(0.6, 0.8);
    this.summon(2);
  }

  hurt(part, dmg, attacker, kind) {
    if (!this.fighting) return;
    const w = this.world;
    if (part.shield) {
      w.fx.splash(part.pos.clone().setY(part.pos.y + 1.4), UP, 0xffd04a, 4, 3, 0.04);
      if (this.t - (this.clankT || 0) > 0.12) { this.clankT = this.t; w.audio?.sfx('hit', { ...posOf(part.pos), volume: 0.35, pitch: 0.45 }); }
      return;
    }
    if (part.kind === 'heart') {
      if (kind === 'blast' || kind === 'big') { if (this.blastFrame === this.frame) return; this.blastFrame = this.frame; }
      this.heartHp -= dmg;
      this.flash = 1;
      if (this.phase === 2 && this.heartHp <= HEART_HP * 0.45) this.enterPhase3();
      if (this.heartHp <= 0) { this.heartHp = 0; this.defeat(attacker); return; }
    } else if (part.kind === 'valve') {
      const i = part.i;
      if (this.valveHp[i] <= 0) return;
      this.valveHp[i] -= dmg;
      this.flash = 1;
      this.valveVis[i].bulb.scale.setScalar(1.25);
      if (this.valveHp[i] <= 0) this.breakValve(i, attacker);
    }
    if (this.t - this.hurtSfxT > 0.15) { this.hurtSfxT = this.t; w.audio?.sfx('boss_hurt', { ...posOf(part.pos), volume: 0.7 }); }
  }

  breakValve(i, attacker) {
    const w = this.world, d = DIRS[i];
    this.valveHp[i] = 0;
    this.valves[i].alive = false;
    const vis = this.valveVis[i];
    vis.broken = true;
    vis.bulb.visible = false; vis.wheel.visible = false;
    const p = new THREE.Vector3(d.x * 5, 1.6, d.z * 5);
    const col = (attacker && attacker.color) || this.world.colors[1];
    w.fx.explosion(p, col, 2.6);
    w.audio?.sfx('explode', { ...posOf(p), volume: 1 });
    this.hooks.shake(0.5, 0.5);
    this.geysers.push({ p, n: new THREE.Vector3(d.x, 0.6, d.z).normalize(), t: 3.5 });
    if (attacker) w.combat.paint(attacker, new THREE.Vector3(d.x * 6.5, 0.05, d.z * 6.5), 3.2, { drips: 3 });
    const left = this.valvesLeft;
    if (left === 0) this.enterPhase2();
    else {
      this.summon(1);
      this.hooks.say(left === 3
        ? [{ who: 'baron', text: 'My VALVE! Do you know what pressure-grade gray COSTS?' }]
        : left === 2 ? [{ who: 'veil', radio: true, text: 'Two down! Keep painting those shutters, rookie!' }]
          : [{ who: 'baron', text: 'Stop that! Stop that this INSTANT!' }]);
    }
  }

  enterPhase2() {
    this.state = 'trans'; this.stateT = 0; this.phase = 2;
    this.sweep = null; for (const b of this.beams) b.visible = false;
    this.world.audio?.sfx('boss_roar', { volume: 1 });
    this.hooks.shake(0.9, 1.6);
    this.heart.visible = true;
    this.hooks.say([
      { who: 'baron', text: 'Insolent little <b>dab</b>! Fine. Let us see you touch my HEART.' },
      { who: 'veil', radio: true, text: 'That\'s our Prism Heart up top! Shoot between the spinning plates. And when the beam sweeps, <b>swim under it</b>!' },
    ]);
  }

  enterPhase3() {
    this.state = 'p3'; this.phase = 3; this.stateT = 0;
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 1.15 });
    this.hooks.shake(0.8, 1.2);
    this.ringT = 3; this.summonT = 6;
    this.hooks.say([
      { who: 'baron', text: 'No, no, NO! The Engine is overheating! Somebody fetch my spare hat!' },
      { who: 'veil', radio: true, text: 'Shockwaves on the floor! <b>Jump</b> the rings, <b>swim</b> the beam!' },
    ]);
  }

  defeat(attacker) {
    this.state = 'dying'; this.stateT = 0;
    this.sweep = null; for (const b of this.beams) b.visible = false;
    for (const p of this.parts) p.alive = false;
    for (const l of this.lobs) this.world.scene.remove(l.mesh);
    this.lobs = [];
    for (const r of this.rings) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.rings = [];
    this.lobQueue = [];
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.8 });
    this.hooks.clearMinions();
    this.hooks.say([
      { who: 'baron', text: 'This… isn\'t… OVER! A city can\'t stay colorful forever!' },
      { who: 'veil', radio: true, text: 'Ha! He\'s running! Grab that Prism Heart, rookie!' },
    ]);
  }

  summon(n) {
    let k = 0;
    const order = [...DRAINS].sort(() => Math.random() - 0.5);
    for (const [x, z] of order) {
      if (k >= n || this.hooks.minionCount() >= 5) break;
      const p = new THREE.Vector3(x * 0.92, 0, z * 0.92);
      this.world.fx.splash(p.clone().setY(1), UP, GRAY_HEX, 16, 5, 0.1);
      this.hooks.spawnSmudge(p);
      k++;
    }
  }

  // ------------------------------------------------------------ attacks
  startSweep(player) {
    const pa = Math.atan2(-player.pos.z, player.pos.x);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const arms = this.phase >= 2 ? 2 : 1;
    this.sweep = { state: 'warn', t: 0, ang: pa + Math.PI * 0.85 * -dir, dir, done: 0, arms, total: arms === 2 ? Math.PI * 1.25 : Math.PI * 2, speed: this.phase === 3 ? 1.55 : this.phase === 2 ? 1.25 : 1.05, paintT: 0 };
    this.hooks.warn('⚠ SWEEP! Hold <b>SHIFT</b> in your ink to swim under it!', 2.4);
    this.world.audio?.sfx('boss_roar', { volume: 0.55, pitch: 1.5 });
  }

  updateSweep(dt, player) {
    const s = this.sweep;
    this.sweepHitT = Math.max(0, this.sweepHitT - dt);
    if (!s) { this.emitMat.color.setRGB(0.14, 0.14, 0.16); return; }
    s.t += dt;
    const blink = s.state === 'warn';
    this.beams[0].visible = true;
    this.beams[1].visible = s.arms === 2;
    this.sweepPivot.rotation.y = s.ang;
    if (blink) {
      const k = s.t / 1.6;
      this.beamMat.opacity = 0.08 + (Math.sin(s.t * 26) > 0 ? 0.18 : 0.04) + k * 0.1;
      this.edgeMat.opacity = 0.3 + k * 0.4;
      this.emitMat.color.setRGB(1, 1, 1.1).multiplyScalar(1 + k * 2.5);
      if (s.t >= 1.6) { s.state = 'run'; s.t = 0; this.world.audio?.sfx('launch', { volume: 0.5, pitch: 0.6 }); }
      return;
    }
    this.beamMat.opacity = 0.62;
    this.edgeMat.opacity = 1;
    this.emitMat.color.setRGB(2.4, 2.4, 2.6);
    const prev = s.ang;
    const step = s.speed * dt;
    s.ang += s.dir * step;
    s.done += step;
    // hit test: did a beam pass over the player this frame?
    if (player.alive && player.invuln <= 0 && this.sweepHitT <= 0) {
      const r = Math.hypot(player.pos.x, player.pos.z);
      const low = player.pos.y < 1.5 && !player.submerged;
      if (low && r > R_IN - 0.4 && r < R_OUT) {
        const pa = Math.atan2(-player.pos.z, player.pos.x);
        const half = 0.55 / r;
        for (let a = 0; a < s.arms; a++) {
          const start = prev + a * Math.PI;
          const rel = wrap((pa - start) * s.dir + half);
          if (rel <= step + half * 2) {
            this.sweepHitT = 0.7;
            this.world.combat.damage(player, 55, this, 'sweep');
            const n = _v.set(player.pos.x, 0, player.pos.z).normalize();
            const tang = _w.set(-Math.sin(s.ang) * s.dir, 0, -Math.cos(s.ang) * s.dir);
            player.vel.x += tang.x * 7 + n.x * 3; player.vel.z += tang.z * 7 + n.z * 3; player.vel.y = Math.max(player.vel.y, 5);
            this.world.fx.splash(player.pos.clone().setY(player.pos.y + 0.8), UP, GRAY_HEX, 14, 5, 0.08);
            break;
          }
        }
      }
    }
    // the beam smears gray streaks behind itself
    s.paintT -= dt;
    if (s.paintT <= 0) {
      s.paintT = 0.11;
      for (let a = 0; a < s.arms; a++) {
        const ang = s.ang - s.dir * 0.32 + a * Math.PI;
        const r = rand(R_IN + 1, 21);
        const p = _v.set(Math.cos(ang) * r, 0.05, -Math.sin(ang) * r);
        if (Math.abs(p.x) < 21.5 && Math.abs(p.z) < 21.5) this.world.combat.paint(this, p, rand(0.45, 0.95), { wobble: 0.35 });
      }
    }
    if (Math.random() < dt * 30) {
      const r = rand(R_IN, 22);
      this.world.fx.spawn(new THREE.Vector3(Math.cos(s.ang) * r, rand(0.4, 1.5), -Math.sin(s.ang) * r), new THREE.Vector3(0, rand(0.5, 2), 0), 0xd8d4e2, 0.05, 0.5, { grav: 0.2 });
    }
    if (s.done >= s.total) { this.sweep = null; for (const b of this.beams) b.visible = false; }
  }

  launchLob(player) {
    // out of the top-hat smokestack
    const from = new THREE.Vector3(-2.2, 9.6, -2.0).applyAxisAngle(UP, this.topYaw);
    const T = rand(1.15, 1.45);
    const tgt = player.pos.clone();
    tgt.x += player.vel.x * T * 0.6 + rand(-1.8, 1.8);
    tgt.z += player.vel.z * T * 0.6 + rand(-1.8, 1.8);
    const h = this.world.level.heightAt(tgt.x, tgt.z).y;
    tgt.y = Number.isFinite(h) ? h : 0;
    const vel = new THREE.Vector3((tgt.x - from.x) / T, (tgt.y - from.y + 0.5 * LOB_G * T * T) / T, (tgt.z - from.z) / T);
    const mesh = new THREE.Mesh(this.lobGeo, this.lobMat);
    mesh.castShadow = true;
    const ol = new THREE.Mesh(this.lobGeo, OUTLINE_M); mesh.add(ol);
    mesh.position.copy(from);
    this.world.scene.add(mesh);
    this.lobs.push({ pos: from, vel, mesh, tgt, ringT: 0, life: 0 });
    this.world.fx.splash(from, UP, GRAY_HEX, 8, 4, 0.1);
    this.world.audio?.sfx('bomb_throw', { ...posOf(from), volume: 0.7, pitch: 0.6 });
  }

  updateLobs(dt) {
    const w = this.world;
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const l = this.lobs[i];
      l.life += dt;
      l.ringT -= dt;
      if (l.ringT <= 0) { l.ringT = 0.22; w.fx.ring(l.tgt.clone().setY(l.tgt.y + 0.06), 0xffb020, 2.6, 0.4, 0.3, { alpha: 0.9 }); }
      l.vel.y -= LOB_G * dt;
      const step = l.vel.length() * dt;
      _v.copy(l.vel).normalize();
      const hit = w.level.raycast(l.pos, _v, step);
      let boom = null;
      if (hit) boom = hit.point.clone().addScaledVector(hit.normal, 0.1);
      else {
        l.pos.addScaledVector(l.vel, dt);
        // direct hit on the player
        const p = w.player;
        if (p.alive && l.pos.distanceTo(_w.copy(p.pos).setY(p.pos.y + 0.7)) < 0.9) boom = l.pos.clone();
      }
      if (boom || l.life > 5 || l.pos.y < w.level.killY) {
        if (boom) w.combat.explode(boom, this, 2.4, 50, 14, 2.4, { extra: 3 });
        w.scene.remove(l.mesh);
        this.lobs.splice(i, 1);
        continue;
      }
      l.mesh.position.copy(l.pos);
      l.mesh.rotation.x += dt * 5;
    }
  }

  updateRings(dt, player) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      const prev = r.r;
      r.r += dt * 8;
      r.mesh.scale.set(r.r, r.r, 1);
      r.mesh.material.opacity = Math.min(1, (R_OUT - r.r) / 4);
      if (player.alive && player.invuln <= 0) {
        const pr = Math.hypot(player.pos.x, player.pos.z);
        if (pr > prev - 0.3 && pr <= r.r + 0.3 && player.pos.y < 0.75) {
          this.world.combat.damage(player, 40, this, 'ring');
          player.vel.y = Math.max(player.vel.y, 6);
        }
      }
      if (r.r > R_OUT) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
  }

  launchRing() {
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.35;
    this.world.scene.add(mesh);
    this.rings.push({ r: R_IN, mesh });
    this.world.audio?.sfx('explode', { volume: 0.8, pitch: 0.6 });
    this.hooks.shake(0.5, 0.4);
  }

  // ------------------------------------------------------------ update
  update(dt, ctx) {
    const p = ctx.player, w = this.world;
    this.t += dt; this.frame++; this.stateT += dt;
    // turn to face the player
    const want = Math.atan2(p.pos.x, p.pos.z);
    let d = (want - this.topYaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    if (this.state !== 'dormant' && this.state !== 'dead') this.topYaw += d * (1 - Math.exp(-(this.state === 'dying' ? 0.5 : 1.4) * dt));
    this.top.rotation.y = this.topYaw;
    // smoke from the hat
    if (Math.random() < dt * (this.state === 'dying' ? 40 : 9)) {
      _v.set(-2.2, 9.6, -2.0).applyAxisAngle(UP, this.topYaw);
      w.fx.spawn(_v, new THREE.Vector3(rand(-0.4, 0.4), rand(1.5, 3), rand(-0.4, 0.4)), this.state === 'dying' ? 0x3b3745 : 0x8b8794, rand(0.12, 0.22), rand(1.2, 2.2), { grav: -0.04, drag: 0.6 });
    }
    this.animBaron(dt);
    const glow = this.state === 'dead' ? 0 : this.state === 'dormant' ? 0.8 : 1.2 + this.phase * 0.5 + Math.sin(this.t * (2 + this.phase * 2)) * 0.5;
    this.portMat.color.setRGB(1, 0.6, 0.25).multiplyScalar(glow);
    for (const n of this.needles) n.rotation.z =Math.sin(this.t * (this.phase === 3 ? 14 : 3) + n.userData.s) * (this.phase === 3 ? 1.2 : 0.6);
    // flash
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      this.bodyMat.emissive.copy(this.bodyBase).lerp(WHITE, this.flash * 0.5);
      this.heartMat.emissiveIntensity = 0.9 + this.flash * 2;
    }
    // valves: shutters + bulbs
    DIRS.forEach((dd, i) => {
      const sh = this.course.shutters[i], vis = this.valveVis[i];
      vis.bulb.scale.lerp(_w.set(1, 1, 1), 1 - Math.exp(-8 * dt));
      if (!vis.broken) {
        vis.bulbMat.emissiveIntensity = 1 + (sh?.open ? Math.sin(this.t * 8 + i) * 0.8 + 1.5 : 0);
        vis.wheel.rotation.z += dt * (sh?.open ? 3 : 0.4);
      }
    });
    if (this.state === 'p1') {
      this.shutterT = (this.shutterT || 0) - dt;
      if (this.shutterT <= 0) {
        this.shutterT = 0.2;
        this.course.shutters.forEach((sh, i) => {
          if (sh.open || this.valveHp[i] <= 0) return;
          const cov = this.course.faceCoverage(sh.face, 1, 7);
          sh.cov = cov;
          if (sh.mesh) sh.mesh.material.emissive?.setRGB(cov * 0.25, cov * 0.25, cov * 0.3);
          if (cov >= 0.5) this.openShutter(i);
        });
      }
    }
    // geysers of freed colour
    for (let i = this.geysers.length - 1; i >= 0; i--) {
      const g = this.geysers[i];
      g.t -= dt;
      if (Math.random() < dt * 26) w.fx.spawn(g.p, g.n.clone().multiplyScalar(rand(4, 7)).add(new THREE.Vector3(rand(-1, 1), rand(1, 3), rand(-1, 1))), new THREE.Color().setHSL(Math.random(), 0.9, 0.6), rand(0.06, 0.12), 1.2, { stretch: 1.4 });
      if (g.t <= 0) this.geysers.splice(i, 1);
    }
    // phase logic
    if (this.state === 'trans') {
      const k = Math.min(1, this.stateT / 3);
      this.lidPivot.rotation.x = -k * 1.35;
      this.heart.position.y = 4.6 + k * 4.0;
      this.heartLight.intensity = k * 30;
      if (this.stateT > 3.2) {
        this.state = 'p2'; this.stateT = 0;
        this.shieldG.visible = true;
        for (const h of this.hearts) h.alive = true;
        for (const s of this.shields) s.alive = true;
        this.sweepT = 4; this.lobT = 2; this.summonT = 8;
      }
    }
    if (this.fighting) {
      this.sweepT -= dt; this.lobT -= dt; this.summonT -= dt;
      if (!this.sweep && this.sweepT <= 0 && !this.rings.length) {
        this.startSweep(p);
        this.sweepT = this.phase === 3 ? 7.5 : this.phase === 2 ? 9 : 11;
      }
      if (this.lobT <= 0 && p.alive) {
        const n = this.phase === 3 ? 3 : this.phase === 2 ? 2 : 1;
        for (let i = 0; i < n; i++) this.lobQueue.push(i * 0.28);
        this.lobT = this.phase === 3 ? 2.6 : this.phase === 2 ? 3.2 : 3.8;
      }
      if (this.summonT <= 0) {
        this.summon(this.phase === 1 ? 1 : 2);
        this.summonT = this.phase === 3 ? 11 : this.phase === 2 ? 14 : 18;
      }
      if (this.phase === 3) {
        this.ringT -= dt;
        if (this.ringT <= 0 && !this.sweep) { this.launchRing(); this.ringT = rand(5, 7); }
      }
    }
    for (let i = this.lobQueue.length - 1; i >= 0; i--) {
      this.lobQueue[i] -= dt;
      if (this.lobQueue[i] <= 0) { this.lobQueue.splice(i, 1); if (this.fighting && p.alive) this.launchLob(p); }
    }
    this.updateSweep(dt, p);
    this.updateLobs(dt);
    this.updateRings(dt, p);
    // heart + shields
    if (this.heart.visible) {
      this.heartGem.rotation.y += dt * (this.phase === 3 ? 2.2 : 0.8);
      const c = this.heartMat.color;
      const hue = (this.t * 0.08) % 1;
      const satK = this.state === 'dying' || this.state === 'dead' ? 0.9 : 0.12 + (1 - this.heartHp / HEART_HP) * 0.55;
      c.setHSL(hue, satK, 0.62);
      this.heartMat.emissive.setHSL(hue, satK, 0.45);
      this.heartLight.color.copy(c);
      const sp = this.phase === 3 ? 1.9 : 1.15;
      this.shieldG.rotation.y += dt * sp;
      this.heart.updateMatrixWorld(true);
      for (const h of this.hearts) h.pos.copy(this.heart.position).add(h.off);
      for (const s of this.shields) {
        const a = this.shieldG.rotation.y + (s.plate * Math.PI * 2) / 3 + s.k * 0.95;
        // CylinderGeometry theta runs from +z towards +x
        s.pos.set(this.heart.position.x + Math.sin(a) * 2.2, this.heart.position.y - 1.4, this.heart.position.z + Math.cos(a) * 2.2);
      }
      this.shieldPlates.forEach((pv, i) => { pv.rotation.y = (i * Math.PI * 2) / 3; });
    }
    if (this.state === 'dying') {
      if (Math.random() < dt * 9) {
        const a = rand(0, Math.PI * 2);
        const q = new THREE.Vector3(Math.cos(a) * rand(2, 4.6), rand(1, 8), Math.sin(a) * rand(2, 4.6));
        w.fx.explosion(q, new THREE.Color().setHSL(Math.random(), 0.9, 0.6), rand(1, 2.2));
        w.audio?.sfx('explode', { ...posOf(q), volume: 0.7 });
        this.hooks.shake(0.3, 0.3);
      }
      // the Baron makes his exit
      const k = Math.min(1, this.stateT / 3.5);
      this.baron.position.y = 0.45 + k * k * 30;
      this.baron.rotation.y += dt * 8 * k;
      this.root.position.y = -Math.min(1.6, this.stateT * 0.35);
      this.heart.position.y = 8.6 + Math.sin(this.t * 2) * 0.2;
      this.shieldG.visible = false;
      if (this.stateT > 5) {
        this.state = 'dead';
        this.heart.visible = false;
        this.baron.visible = false;
        this.hooks.onDefeated();
      }
    }
  }

  openShutter(i) {
    const sh = this.course.shutters[i];
    if (!sh || sh.open) return;
    sh.open = true;
    sh.solid.collide = false;
    if (sh.mesh) sh.mesh.visible = false;
    this.valves[i].alive = true;
    const d = DIRS[i];
    const p = new THREE.Vector3(d.x * 4.9, 1.6, d.z * 4.9);
    this.world.fx.splash(p, new THREE.Vector3(d.x, 0.3, d.z), 0x9a96a2, 30, 7, 0.12, 1.2);
    this.world.audio?.sfx('door_heavy', { ...posOf(p), volume: 0.9 });
    if (!this.saidValve) {
      this.saidValve = true;
      this.hooks.say([{ who: 'veil', radio: true, text: 'Shutter\'s off! Now burst that <b>valve</b>!' }]);
    }
  }

  animBaron(dt) {
    if (!this.baron.visible) return;
    const t = this.t;
    const angry = this.flash > 0.2;
    this.baron.position.y = this.state === 'dying' ? this.baron.position.y : 0.45 + Math.abs(Math.sin(t * (angry ? 14 : 3))) * (angry ? 0.12 : 0.05);
    this.baronHead.rotation.z = Math.sin(t * 1.3) * 0.08;
    const [L, R] = this.arms;
    R.rotation.x = -2.6 + Math.sin(t * (angry ? 16 : 5)) * 0.35;
    R.rotation.z = -0.25;
    L.rotation.x = this.fighting ? -0.4 + Math.sin(t * 2) * 0.1 : 0.1;
    L.rotation.z = 0.3;
  }

  dispose() {
    this.disposed = true;
    for (const l of this.lobs) this.world.scene.remove(l.mesh);
    for (const r of this.rings) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.lobGeo.dispose(); this.lobMat.dispose(); this.ringGeo.dispose(); this.ringMat.dispose();
    this.heartLight.dispose?.();
    disposeTree(this.root);
  }
}
