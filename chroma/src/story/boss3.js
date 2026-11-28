// Baron Grisaille himself (final boss), in his throne room.
//   Phase 1  The Duel: he glides around behind a gray shield, firing cane volleys
//            and dashing along a telegraphed line. Paint all three easels to pop
//            the shield; he's dazed for a few seconds: hit him. The easels reset.
//   Phase 2  The Grayscale Throne: he flies his throne in circles, sweeping a
//            sniper laser (tracks, flashes red, fires) and dropping gray bombs, with
//            Glints on the pillars. Burst the four pigment tanks on the throne.
//   Phase 3  Colorless: the throne crashes, the room drains gray and floods. Paint
//            the three wall drains while dodging shockwaves; when the gray drains
//            away he's exhausted: finish it.
// The finish: a burst of colour hits him square on, and the Baron sees pink.
import * as THREE from 'three';
import { part, rod, std, gooMat, glowMat, OUTLINE_S, OUTLINE_M, OUTLINE_L, posOf, disposeTree } from './kit.js';
import { GRAY_HEX } from './enemies.js';
import * as D from './dialogue.js';

const P1_HP = 700, TANK_HP = 130, P3_HP = 600;
const SCALE = 2.3;
const LOB_G = 20;
const EASELS = ['e1', 'e2', 'e3'], DRAINS = ['d1', 'd2', 'd3'];
const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const VOLLEY = { speed: 17, range: 34, dmgDirect: 38, dmgSplash: 20, blastR: 1.7, splat: 1.2 };
const BEAM = { minRange: 46, maxRange: 46, dmgFull: 70, dmgMin: 70, splat: 1.5 };
const rand = (a, b) => a + Math.random() * (b - a);
const angleTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3();

class Part {
  constructor(boss, kind, i, hh) {
    this.boss = boss; this.kind = kind; this.i = i; this.hh = hh;
    this.team = 2; this.name = kind === 'tank' ? 'Pigment Tank' : 'Baron Grisaille';
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.alive = false; this.invuln = 0; this.hp = 1; this.submerged = false; this.form = 'kid'; this.time = 0;
    this.lastAttacker = null; this.lastAttackT = -9;
    this.stats = { kills: 0, deaths: 0, turf: 0, assists: 0, specials: 0 };
    this.boss_part = true;
  }
  get color() { return this.boss.world.colors[2]; }
  get shield() { return this.kind === 'baron' && this.boss.shielded; }
  hitHeight() { return this.hh; }
  takeDamage(dmg, attacker, kind) { this.boss.hurt(this, dmg, attacker, kind); }
}

export class BaronGrisaille {
  constructor(world, course, hooks) {
    this.world = world; this.course = course; this.hooks = hooks;
    this.team = 2; this.name = 'Baron Grisaille'; this.alive = true;
    this.state = 'dormant'; this.phase = 0; this.t = 0; this.stateT = 0;
    this.hp = [P1_HP, TANK_HP * 4, P3_HP];
    this.tankHp = [TANK_HP, TANK_HP, TANK_HP, TANK_HP];
    this.max = P1_HP + TANK_HP * 4 + P3_HP;
    this.pos = new THREE.Vector3(0, 0, 10);
    this.yaw = Math.PI;
    this.flash = 0; this.hurtSfxT = 0;
    this.lobs = []; this.rings = []; this.lobQueue = [];
    this.tide = -0.3; this.tideHurtT = 0;
    this.desat = 0;
    this.body = new Part(this, 'baron', 0, 3.8);
    this.tanks = [0, 1, 2, 3].map((i) => new Part(this, 'tank', i, 1.6));
    this.parts = [this.body, ...this.tanks];
    for (const p of this.parts) world.fighters.push(p);
    this.build();
  }

  get color() { return this.world.colors[2]; }
  get title() { return 'BARON GRISAILLE'; }
  get marks() { return [(TANK_HP * 4 + P3_HP) / this.max, P3_HP / this.max]; }
  get frac() { return Math.max(0, this.hp[0] + this.tankHp.reduce((a, b) => a + Math.max(0, b), 0) + this.hp[2]) / this.max; }
  get intro() { return D.BARON_INTRO; }
  get introShot() { return { pos: new THREE.Vector3(5, 3.6, -13), look: new THREE.Vector3(0, 3.5, 10) }; }
  get dormantText() { return 'Enter the <b>throne room</b>'; }
  get downText() { return 'Baron Grisaille is beaten!'; }
  get fighting() { return ['p1', 'p2', 'p3'].includes(this.state); }
  get shielded() { return this.state === 'p1' && !this.dazed; }
  get easelsDone() { return EASELS.filter((id) => this.hooks.mech?.flag('switch:' + id)).length; }
  get drainsDone() { return DRAINS.filter((id) => this.hooks.mech?.flag('drain:' + id)).length; }
  get tanksLeft() { return this.tankHp.filter((h) => h > 0).length; }
  get objective() {
    if (this.state === 'p1') return this.dazed ? '<b>He\'s dazed! Hit him!</b>' : `Paint the three <b>easels</b> to break his shield: <b>${this.easelsDone}/3</b>`;
    if (this.state === 'p2' || this.state === 'p2t') return `Burst the <b>pigment tanks</b> on his throne: <b>${4 - this.tanksLeft}/4</b>`;
    if (this.state === 'p3' || this.state === 'p3t') return this.exhausted ? '<b>He\'s exhausted! Finish it!</b>' : `The gray is rising! Paint the <b>drains</b>: <b>${this.drainsDone}/3</b>`;
    return 'Defeat <b>Baron Grisaille</b>';
  }
  get label() {
    if (this.state === 'p1') return this.dazed ? 'SHIELD BROKEN! STRIKE!' : `PHASE 1 · THE DUEL · PAINT THE EASELS (${this.easelsDone}/3)`;
    if (this.state === 'p2t') return 'TO THE THRONE!';
    if (this.state === 'p2') return `PHASE 2 · THE GRAYSCALE THRONE · BURST THE TANKS (${4 - this.tanksLeft}/4)`;
    if (this.state === 'p3t') return 'THE THRONE IS FALLING!';
    if (this.state === 'p3') return this.exhausted ? 'HE\'S EXHAUSTED! FINISH IT!' : `PHASE 3 · COLORLESS · PAINT THE DRAINS (${this.drainsDone}/3)`;
    if (this.state === 'dying' || this.state === 'dead') return 'COLOR WINS!';
    return '';
  }

  // ------------------------------------------------------------ visuals
  build() {
    const root = this.root = new THREE.Group();
    root.name = 'baron';
    this.world.scene.add(root);
    // the Baron (materials kept so the finish can colour them in)
    const g = this.model = new THREE.Group();
    g.scale.setScalar(SCALE);
    root.add(g);
    const M = this.mats = {
      suit: std(0x8d8a96, 0.65), skin: std(0xc9c6cf, 0.55), black: std(0x1d1b22, 0.5, 0.2), coat: std(0x3b3745, 0.7),
      band: std(0x6d5f86, 0.5), gold: std(0xc9a640, 0.3, 0.8), shirt: std(0xf4f1ea, 0.5),
    };
    part(g, new THREE.ConeGeometry(0.46, 0.75, 18), M.coat, { pos: [0, 0.37, 0], outline: OUTLINE_S });
    part(g, new THREE.CapsuleGeometry(0.3, 0.45, 6, 14), M.suit, { pos: [0, 0.82, 0], outline: OUTLINE_S });
    part(g, new THREE.BoxGeometry(0.16, 0.24, 0.05), M.shirt, { pos: [0, 0.92, 0.27], shadow: false });
    part(g, new THREE.ConeGeometry(0.05, 0.1, 4), std(0x6d2f3a, 0.5), { pos: [0, 0.98, 0.3], rot: [Math.PI, 0, 0], shadow: false });
    const head = this.head = new THREE.Group();
    head.position.y = 1.42;
    g.add(head);
    part(head, new THREE.SphereGeometry(0.3, 20, 14), M.skin, { outline: OUTLINE_S });
    for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.045, 8, 6), M.black, { pos: [0.11 * s, 0.05, 0.26], shadow: false });
    part(head, new THREE.TorusGeometry(0.08, 0.014, 6, 16), M.gold, { pos: [0.11, 0.05, 0.285], shadow: false });
    this.monocle = part(head, new THREE.CircleGeometry(0.07, 14), new THREE.MeshPhysicalMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.5, roughness: 0.05, emissive: 0x000000 }), { pos: [0.11, 0.05, 0.29], shadow: false });
    for (const s of [-1, 1]) {
      part(head, new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), std(0x4a4652, 0.6), { pos: [0.09 * s, -0.08, 0.27], rot: [0, 0, (Math.PI / 2) * s + 0.35 * s], shadow: false });
      part(head, new THREE.TorusGeometry(0.04, 0.018, 6, 10, Math.PI * 1.3), std(0x4a4652, 0.6), { pos: [0.2 * s, -0.03, 0.25], rot: [0, 0, s > 0 ? -0.4 : Math.PI + 0.4], shadow: false });
    }
    part(head, new THREE.CylinderGeometry(0.37, 0.37, 0.035, 20), M.black, { pos: [0, 0.27, 0], outline: OUTLINE_S });
    part(head, new THREE.CylinderGeometry(0.22, 0.23, 0.46, 20), M.black, { pos: [0, 0.5, 0], outline: OUTLINE_S });
    part(head, new THREE.CylinderGeometry(0.235, 0.235, 0.08, 20), M.band, { pos: [0, 0.33, 0], shadow: false });
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.34 * s, 1.08, 0);
      g.add(sh);
      part(sh, new THREE.CapsuleGeometry(0.08, 0.38, 4, 8), M.suit, { pos: [0, -0.23, 0], outline: OUTLINE_S });
      part(sh, new THREE.SphereGeometry(0.1, 10, 8), M.shirt, { pos: [0, -0.5, 0], shadow: false });
      this.arms.push(sh);
    }
    // cane in the right hand
    const cane = this.cane = new THREE.Group();
    cane.position.set(0, -0.5, 0.05);
    this.arms[1].add(cane);
    rod(cane, [0, 0.2, 0], [0, -0.85, 0.05], 0.025, M.black, { seg: 6 });
    this.tipMat = glowMat(0xb9b5c4, 1.4);
    part(cane, new THREE.SphereGeometry(0.07, 10, 8), this.tipMat, { pos: [0, 0.24, 0], shadow: false });
    // shield bubble
    this.shieldMat = new THREE.MeshPhysicalMaterial({ color: 0x9a97a3, roughness: 0.1, transparent: true, opacity: 0.32, clearcoat: 1, emissive: 0x4a4652, emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    this.shieldMesh = part(root, new THREE.SphereGeometry(2.6, 28, 18), this.shieldMat, { pos: [0, 2.1, 0], shadow: false });
    this.shieldMesh.raycast = () => {};
    // dazed stars
    this.stars = new THREE.Group(); this.stars.position.y = 4.4; root.add(this.stars);
    for (let i = 0; i < 5; i++) part(this.stars, new THREE.OctahedronGeometry(0.16, 0), glowMat(0xffd04a, 2.2), { pos: [Math.cos(i * 1.256) * 0.8, 0, Math.sin(i * 1.256) * 0.8], shadow: false });
    this.stars.visible = false;
    // the flying throne
    const th = this.throne = new THREE.Group();
    th.position.set(0, 0, 18.4);
    this.world.scene.add(th);
    const velvet = std(0x4a4652, 0.85), gold = std(0x8a7a5a, 0.35, 0.8);
    part(th, new THREE.BoxGeometry(3.2, 0.9, 2.4), velvet, { pos: [0, 0.45, 0], outline: OUTLINE_M });
    part(th, new THREE.BoxGeometry(3.2, 3.4, 0.5), velvet, { pos: [0, 2.2, -1.0], outline: OUTLINE_M });
    part(th, new THREE.BoxGeometry(3.6, 0.3, 0.7), gold, { pos: [0, 4.0, -1.0], shadow: false });
    part(th, new THREE.CylinderGeometry(1.8, 1.2, 0.5, 20), std(0x2b2833, 0.5, 0.6), { pos: [0, -0.2, 0], outline: OUTLINE_S });
    this.jetMat = glowMat(0x9a97a3, 1.2);
    part(th, new THREE.CylinderGeometry(0.8, 0.5, 0.2, 16), this.jetMat, { pos: [0, -0.5, 0], shadow: false });
    // pigment tanks: the throne's weak points
    this.tankVis = [[-1.9, -1.2], [1.9, -1.2], [-1.9, 1.0], [1.9, 1.0]].map(([x, z]) => {
      const tg = new THREE.Group(); tg.position.set(x, 1.0, z); th.add(tg);
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.4, depthWrite: false });
      part(tg, new THREE.CylinderGeometry(0.42, 0.42, 1.4, 16, 1, true), glass, { shadow: false });
      const fill = new THREE.MeshStandardMaterial({ color: 0x9a97a3, emissive: 0x6d6a76, emissiveIntensity: 0.8, roughness: 0.2 });
      const f = part(tg, new THREE.CylinderGeometry(0.36, 0.36, 1.2, 14), fill, { shadow: false });
      part(tg, new THREE.CylinderGeometry(0.5, 0.5, 0.16, 16), gold, { pos: [0, 0.76, 0], shadow: false });
      part(tg, new THREE.CylinderGeometry(0.5, 0.5, 0.16, 16), gold, { pos: [0, -0.76, 0], shadow: false });
      return { tg, glass, fill, f, broken: false, x, z };
    });
    // laser sight (phase 2)
    const lg = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); lg.rotateX(Math.PI / 2); lg.translate(0, 0, 0.5);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.6, depthWrite: false });
    this.laser = new THREE.Mesh(lg, this.laserMat);
    this.laser.frustumCulled = false; this.laser.visible = false; this.laser.raycast = () => {};
    this.world.scene.add(this.laser);
    // tide (phase 3)
    this.tideMat = gooMat(GRAY_HEX, { transparent: true, opacity: 0.9, emissive: 0x15131a });
    this.tideMesh = part(this.world.scene, new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), this.tideMat, { pos: [0, -0.3, 0], shadow: false, receive: true });
    this.tideMesh.visible = false;
    this.lobGeo = new THREE.SphereGeometry(0.4, 16, 12);
    this.lobMat = gooMat(GRAY_HEX);
    this.ringGeo = new THREE.TorusGeometry(1, 0.3, 8, 72);
    this.ringMat = glowMat(0xb9b5c4, 1.4, { transparent: true, opacity: 0.85 });
  }

  // ------------------------------------------------------------ lifecycle
  start() { if (this.state === 'dormant') { this.state = 'intro'; this.stateT = 0; } }
  begin() {
    this.state = 'p1'; this.phase = 1; this.stateT = 0;
    this.body.alive = true;
    for (const id of EASELS) this.hooks.mech?.setSwitch(id, true, true);
    this.act = { kind: 'glide', t: 0, dur: 2 };
    this.summonT = 10;
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.75 });
    this.hooks.shake(0.5, 0.6);
  }

  hurt(part, dmg, attacker, kind) {
    if (!this.fighting) return;
    const w = this.world;
    if (attacker && attacker === w.player) dmg *= w.dmgMul || 1;
    if (kind === 'blast' || kind === 'big') { if (this.blastF === this.t) return; this.blastF = this.t; }
    if (part.kind === 'tank') {
      const i = part.i;
      if (this.state !== 'p2' || this.tankHp[i] <= 0) return;
      this.tankHp[i] -= dmg;
      this.flash = 0.7;
      this.tankVis[i].tg.scale.setScalar(1.12);
      if (this.tankHp[i] <= 0) this.burstTank(i);
      this.hurtSfx(part);
      return;
    }
    // the Baron himself
    if (this.state === 'p1') {
      if (!this.dazed) { this.clank(part); return; }
      this.hp[0] = Math.max(0, this.hp[0] - dmg);
      this.flash = 1;
      this.hurtSfx(part);
      if (this.hp[0] <= 0) this.toThrone();
    } else if (this.state === 'p3') {
      if (!this.exhausted) { this.clank(part); return; }
      this.hp[2] = Math.max(0, this.hp[2] - dmg);
      this.flash = 1;
      this.hurtSfx(part);
      if (this.hp[2] <= 0) this.defeat();
    }
  }
  clank(part) {
    const w = this.world;
    if (this.t - (this.clankT || 0) > 0.12) {
      this.clankT = this.t;
      w.audio?.sfx('hit', { ...posOf(part.pos), volume: 0.35, pitch: 0.45 });
      w.fx.splash(_v.copy(this.pos).setY(2.2), UP, 0xb9b5c4, 4, 3, 0.05);
    }
  }
  hurtSfx(part) { if (this.t - this.hurtSfxT > 0.15) { this.hurtSfxT = this.t; this.world.audio?.sfx('boss_hurt', { ...posOf(part.pos), volume: 0.8, pitch: 1.1 }); } }

  // ---- phase 1: easels -> daze
  daze() {
    this.dazed = true; this.dazeT = 6.5;
    this.act = { kind: 'dazed', t: 0 };
    this.world.audio?.sfx('shield_break', { ...posOf(this.pos), volume: 1 });
    this.world.fx.explosion(this.pos.clone().setY(2.2), this.world.colors[1], 2.6);
    this.hooks.shake(0.5, 0.5);
    this.hooks.warn('⚠ <b>SHIELD BROKEN!</b> He\'s dazed: <b>hit him!</b>', 2.6);
    if (!this.saidDaze) { this.saidDaze = true; this.hooks.say([{ who: 'baron', text: 'My… my shield! You painted my EASELS? Those were ANTIQUES!' }]); }
  }
  undaze() {
    this.dazed = false;
    for (const id of EASELS) this.hooks.mech?.setSwitch(id, true, true);
    this.act = { kind: 'glide', t: 0, dur: 1.2 };
    this.hooks.toast?.('His shield is back. Paint the <b>easels</b> again!', 2.6);
  }
  toThrone() {
    this.state = 'p2t'; this.stateT = 0; this.phase = 2;
    this.dazed = false;
    this.body.alive = false;
    for (const id of EASELS) this.hooks.mech?.setSwitch(id, false, false);
    this.hooks.clearMinions();
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.9 });
    this.hooks.say([
      { who: 'baron', text: 'ENOUGH! If you insist on noise, I shall rise ABOVE it!' },
      { who: 'tint', radio: true, text: 'He\'s on his flying throne! Those four <b>tanks</b> keep it up. Burst them!' },
    ]);
    this.from = this.pos.clone();
  }
  burstTank(i) {
    const w = this.world, tv = this.tankVis[i];
    this.tankHp[i] = 0;
    this.tanks[i].alive = false;
    tv.broken = true; tv.f.visible = false; tv.glass.opacity = 0.12;
    tv.tg.getWorldPosition(_v);
    w.fx.explosion(_v.clone(), new THREE.Color().setHSL(i / 4, 0.9, 0.6), 2.4);
    w.fx.splash(_v.clone(), UP, new THREE.Color().setHSL(i / 4 + 0.1, 0.9, 0.6), 24, 6, 0.1, 1.2);
    w.audio?.sfx('explode', { ...posOf(_v), volume: 1 });
    this.hooks.shake(0.5, 0.5);
    const left = this.tanksLeft;
    if (left === 0) this.crash();
    else this.hooks.say(left === 3 ? [{ who: 'baron', text: 'That pigment was GRAY! Pure, premium gray!' }] : left === 2 ? [{ who: 'veil', radio: true, text: 'Two down, rookie! He\'s listing!' }] : [{ who: 'baron', text: 'Hold together, you velvet bucket!' }]);
  }
  crash() {
    this.state = 'p3t'; this.stateT = 0; this.phase = 3;
    for (const t of this.tanks) t.alive = false;
    this.laser.visible = false;
    this.hooks.clearMinions();
    this.world.audio?.sfx('boss_roar', { volume: 1, pitch: 0.6 });
    this.hooks.say([
      { who: 'baron', text: 'No. No! If I cannot have quiet… then NOBODY gets color! Let it ALL go gray!' },
      { who: 'tint', radio: true, text: 'The room\'s flooding! <b>Drains</b> on three walls! Get on the plinths and paint them!' },
    ]);
    this.from = this.throne.position.clone();
  }
  startTide() {
    this.state = 'p3'; this.stateT = 0;
    this.body.alive = true;
    this.exhausted = false;
    for (const id of DRAINS) this.hooks.mech?.setSwitch(id, true, true);
    this.tideOn = true;
    this.ringT = 4; this.volleyT = 3;
    this.hooks.music?.('battle_c_final');
  }
  exhaust() {
    this.exhausted = true; this.exhaustT = 7.5;
    this.tideOn = false;
    this.world.audio?.sfx('boss_hurt', { volume: 1, pitch: 0.6 });
    this.hooks.warn('⚠ The gray is draining! He\'s <b>exhausted</b>. <b>Finish it!</b>', 3);
    this.hooks.say([{ who: 'veil', radio: true, text: 'He\'s spent! Everything you\'ve got, rookie! <b>NOW!</b>' }]);
  }
  unexhaust() {
    this.exhausted = false;
    for (const id of DRAINS) this.hooks.mech?.setSwitch(id, true, true);
    this.tideOn = true;
    this.hooks.toast?.('He\'s back up and the gray is rising again. <b>Drains!</b>', 2.6);
  }
  defeat() {
    this.state = 'dying'; this.stateT = 0;
    this.body.alive = false;
    this.tideOn = false;
    for (const l of this.lobs) this.world.scene.remove(l.mesh);
    this.lobs = []; this.lobQueue = [];
    for (const r of this.rings) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.rings = [];
    this.hooks.clearMinions();
    this.hooks.music?.(null);
    this.hooks.cine?.({ pos: this.pos.clone().add(new THREE.Vector3(3.5, 3.2, -6)), look: this.pos.clone().setY(2.6) });
    this.world.audio?.sfx('core_get', { volume: 1, pitch: 0.8 });
    this.hooks.say([
      { who: 'baron', text: 'What… what is this? This… warm… this <b>noise</b>…' },
      { who: 'baron', text: 'Is that… is that <b>pink</b>? I had forgotten. I had forgotten pink.' },
      { who: 'baron', text: '…Take it. The Spectrum Crown. Put the colors back. All of them. Even the… loud ones.' },
    ]);
  }

  // ------------------------------------------------------------ attacks
  volley(p, n = 3) { for (let i = 0; i < n; i++) this.lobQueue.push({ t: 0.5 + i * 0.18, kind: 'shot' }); this.tipT = 0.5; }
  shoot(p) {
    const w = this.world;
    this.model.updateMatrixWorld(true);
    const o = this.cane.localToWorld(_v.set(0, 0.24, 0)).clone();
    const tgt = _w.set(p.pos.x + p.vel.x * 0.3, p.pos.y + (p.form === 'goo' ? 0.4 : 1.0), p.pos.z + p.vel.z * 0.3);
    const dir = tgt.sub(o).normalize();
    dir.x += rand(-0.04, 0.04); dir.y += rand(-0.03, 0.03); dir.normalize();
    w.combat.blaster(this, o, dir, VOLLEY);
    w.audio?.sfx('shoot_heavy', { ...posOf(o), volume: 0.7, pitch: 0.6 });
  }
  bomb(p, from) {
    const T = rand(1.1, 1.4);
    const tgt = p.pos.clone();
    tgt.x += p.vel.x * T * 0.6 + rand(-1.5, 1.5);
    tgt.z += p.vel.z * T * 0.6 + rand(-1.5, 1.5);
    const h = this.world.level.heightAt(tgt.x, tgt.z).y;
    tgt.y = Number.isFinite(h) ? h : 0;
    const vel = new THREE.Vector3((tgt.x - from.x) / T, (tgt.y - from.y + 0.5 * LOB_G * T * T) / T, (tgt.z - from.z) / T);
    const mesh = new THREE.Mesh(this.lobGeo, this.lobMat);
    mesh.add(new THREE.Mesh(this.lobGeo, OUTLINE_M));
    mesh.position.copy(from);
    this.world.scene.add(mesh);
    this.lobs.push({ pos: from.clone(), vel, mesh, tgt, ringT: 0, life: 0 });
    this.world.audio?.sfx('bomb_throw', { ...posOf(from), volume: 0.6, pitch: 0.6 });
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
  launchRing(at) {
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(at.x, 0.35, at.z);
    this.world.scene.add(mesh);
    this.rings.push({ r: 1.5, mesh, c: at.clone() });
    this.world.audio?.sfx('explode', { volume: 0.8, pitch: 0.6 });
    this.hooks.shake(0.5, 0.4);
  }
  updateRings(dt, p) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      const prev = r.r;
      r.r += dt * 8;
      r.mesh.scale.set(r.r, r.r, 1);
      r.mesh.material.opacity = Math.min(1, (30 - r.r) / 4);
      if (p.alive && p.invuln <= 0) {
        const pr = Math.hypot(p.pos.x - r.c.x, p.pos.z - r.c.z);
        if (pr > prev - 0.3 && pr <= r.r + 0.3 && p.pos.y < Math.max(0.75, this.tide + 0.75)) { this.world.combat.damage(p, 35, this, 'ring'); p.vel.y = Math.max(p.vel.y, 6); }
      }
      if (r.r > 30) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------ phase updates
  updateP1(dt, p) {
    const w = this.world;
    if (!this.dazed && this.easelsDone >= 3) this.daze();
    if (this.dazed) {
      this.dazeT -= dt;
      if (this.dazeT <= 0) this.undaze();
      return;
    }
    const a = this.act;
    a.t += dt;
    const toP = _a.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
    const dist = toP.length();
    if (a.kind === 'glide') {
      // keep a duelling distance, strafing round the player
      if (!a.goal || a.t > 1.2) {
        a.t = Math.min(a.t, 1.2) === 1.2 ? 0 : a.t;
        const ang = Math.atan2(this.pos.z - p.pos.z, this.pos.x - p.pos.x) + rand(-0.9, 0.9);
        const r = rand(8, 11);
        a.goal = new THREE.Vector3(Math.max(-15, Math.min(15, p.pos.x + Math.cos(ang) * r)), 0, Math.max(-15, Math.min(15, p.pos.z + Math.sin(ang) * r)));
      }
      _w.subVectors(a.goal, this.pos).setY(0);
      const l = _w.length();
      if (l > 0.1) this.pos.addScaledVector(_w, Math.min(1, (4.2 * dt) / l));
      this.yaw += angleTo(this.yaw, Math.atan2(toP.x, toP.z)) * (1 - Math.exp(-5 * dt));
      a.dur -= dt;
      if (a.dur <= 0 && p.alive) {
        const r = Math.random();
        if (r < 0.45) { this.act = { kind: 'volley', t: 0 }; this.volley(p, 3); }
        else if (r < 0.8 && dist > 4) {
          const dir = toP.clone().normalize();
          const end = this.pos.clone().addScaledVector(dir, Math.min(16, dist + 3));
          end.x = Math.max(-17, Math.min(17, end.x)); end.z = Math.max(-17, Math.min(17, end.z));
          this.act = { kind: 'dashWind', t: 0, from: this.pos.clone(), end };
          w.audio?.sfx('bomb_beep', { ...posOf(this.pos), volume: 0.7, pitch: 0.6 });
        } else this.act = { kind: 'glide', t: 0, dur: rand(1.2, 2) };
      }
    } else if (a.kind === 'volley') {
      this.yaw += angleTo(this.yaw, Math.atan2(toP.x, toP.z)) * (1 - Math.exp(-8 * dt));
      if (a.t > 1.3) this.act = { kind: 'glide', t: 0, dur: rand(1.4, 2.4) };
    } else if (a.kind === 'dashWind') {
      this.yaw = Math.atan2(a.end.x - a.from.x, a.end.z - a.from.z);
      a.dotT = (a.dotT || 0) - dt;
      if (a.dotT <= 0) { a.dotT = 0.1; for (let k = 1; k <= 6; k++) w.fx.ring(a.from.clone().lerp(a.end, k / 6).setY(0.08), 0xff5d5d, 1.0, 0.2, 0.22, { alpha: 0.85 }); }
      if (a.t > 0.85) { this.act = { kind: 'dash', t: 0, from: a.from, end: a.end, hit: false }; w.audio?.sfx('launch', { ...posOf(this.pos), volume: 0.8, pitch: 0.7 }); }
    } else if (a.kind === 'dash') {
      const T = a.from.distanceTo(a.end) / 17;
      const k = Math.min(1, a.t / Math.max(0.2, T));
      this.pos.copy(a.from).lerp(a.end, k);
      if (Math.random() < dt * 40) w.fx.spawn(this.pos.clone().setY(rand(0.3, 3)), new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)), GRAY_HEX, 0.1, 0.5);
      if (!a.hit && p.alive && p.invuln <= 0 && flat(this.pos, p.pos) < 1.7 && p.pos.y < 3.5) {
        a.hit = true;
        w.combat.damage(p, 50, this, 'dash');
        const n = _w.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
        p.vel.x += n.x * 9; p.vel.z += n.z * 9; p.vel.y = Math.max(p.vel.y, 5);
      }
      if (k >= 1) this.act = { kind: 'glide', t: 0, dur: rand(1.2, 2) };
    }
    this.summonT -= dt;
    if (this.summonT <= 0 && this.hooks.minionCount() < 3) {
      this.summonT = rand(14, 18);
      const kinds = ['smudge', 'smudge', 'warden'];
      for (let i = 0; i < 2; i++) {
        const ang = rand(0, Math.PI * 2);
        const at = new THREE.Vector3(Math.cos(ang) * 14, 0, Math.sin(ang) * 14);
        at.x = Math.max(-17, Math.min(17, at.x)); at.z = Math.max(-17, Math.min(17, at.z));
        w.fx.splash(at.clone().setY(1), UP, GRAY_HEX, 16, 5, 0.1);
        this.hooks.spawn(kinds[(Math.random() * kinds.length) | 0], at, { yaw: Math.atan2(-at.x, -at.z) });
      }
    }
  }

  updateP2(dt, p) {
    const w = this.world, th = this.throne;
    this.ang = (this.ang ?? Math.PI / 2) + dt * 0.32;
    _v.set(Math.cos(this.ang) * 11, 6.5 + Math.sin(this.t * 1.3) * 0.5, Math.sin(this.ang) * 11);
    th.position.lerp(_v, 1 - Math.exp(-2 * dt));
    th.rotation.y += angleTo(th.rotation.y, Math.atan2(p.pos.x - th.position.x, p.pos.z - th.position.z)) * (1 - Math.exp(-3 * dt));
    this.pos.copy(th.position).setY(th.position.y + 0.85);
    this.yaw = th.rotation.y;
    // tank hitboxes
    th.updateMatrixWorld(true);
    this.tankVis.forEach((tv, i) => { tv.tg.getWorldPosition(_v); this.tanks[i].pos.copy(_v).setY(_v.y - 0.8); });
    if (Math.random() < dt * 20) w.fx.spawn(th.position.clone().setY(th.position.y - 0.6), new THREE.Vector3(rand(-1, 1), -4, rand(-1, 1)), 0x9a97a3, rand(0.1, 0.2), 0.8, { grav: 0.2 });
    // laser: track 1.4s, lock 0.45s, fire; then bombs
    const a = this.act || (this.act = { kind: 'cool', t: 0, dur: 2 });
    a.t += dt;
    const o = _a.copy(th.position).setY(th.position.y + 2.6);
    if (a.kind === 'cool') {
      this.laser.visible = false;
      if (a.t > a.dur && p.alive) this.act = Math.random() < 0.6 ? { kind: 'aim', t: 0, dir: new THREE.Vector3() } : { kind: 'bombs', t: 0, n: 0 };
    } else if (a.kind === 'aim' || a.kind === 'lock') {
      if (a.kind === 'aim') a.dir.set(p.pos.x - o.x, p.pos.y + (p.form === 'goo' ? 0.35 : 1.0) - o.y, p.pos.z - o.z).normalize();
      const hit = w.level.raycast(o, a.dir, 46);
      const len = hit ? hit.t : 46;
      this.laser.visible = true;
      this.laser.position.copy(o);
      this.laser.quaternion.setFromUnitVectors(Z, a.dir);
      const lock = a.kind === 'lock';
      const th2 = lock ? 0.05 + Math.sin(this.t * 60) * 0.012 : 0.018;
      this.laser.scale.set(th2, th2, len);
      this.laserMat.color.setRGB(1, lock ? 0.15 : 0.5, lock ? 0.15 : 0.45).multiplyScalar(lock ? 3 : 1.6);
      if (a.kind === 'aim' && a.t > 1.4) { a.kind = 'lock'; a.t = 0; w.audio?.sfx('bomb_beep', { ...posOf(o), volume: 0.8, pitch: 1.6 }); }
      else if (a.kind === 'lock' && a.t > 0.45) {
        w.combat.beam(this, o.clone(), a.dir.clone(), BEAM, 1);
        this.laser.visible = false;
        this.act = { kind: 'cool', t: 0, dur: rand(1.2, 1.8) };
      }
    } else if (a.kind === 'bombs') {
      a.k = (a.k ?? 0) - dt;
      if (a.k <= 0 && a.n < 4) { a.k = 0.35; a.n++; this.bomb(p, th.position.clone().setY(th.position.y - 0.4)); }
      if (a.n >= 4 && a.t > 2) this.act = { kind: 'cool', t: 0, dur: rand(1.2, 1.8) };
    }
  }

  updateP3(dt, p) {
    const w = this.world;
    // he stands on the dais in the middle, furious
    _v.set(0, 0, 2);
    this.pos.lerp(_v, 1 - Math.exp(-2 * dt));
    this.yaw += angleTo(this.yaw, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)) * (1 - Math.exp(-4 * dt));
    if (this.exhausted) {
      this.exhaustT -= dt;
      if (this.exhaustT <= 0) this.unexhaust();
      return;
    }
    if (this.tideOn && this.drainsDone >= 3) { this.exhaust(); return; }
    this.ringT -= dt; this.volleyT -= dt;
    if (this.ringT <= 0) { this.ringT = rand(4.5, 6); this.launchRing(this.pos); this.slamT = 0.4; }
    if (this.volleyT <= 0 && p.alive) { this.volleyT = rand(3, 4.2); this.volley(p, 4); }
  }

  // ------------------------------------------------------------ update
  update(dt, ctx) {
    const p = ctx.player, w = this.world;
    this.t += dt; this.stateT += dt;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 6); }
    if (this.state === 'p1') this.updateP1(dt, p);
    else if (this.state === 'p2t') {
      const k = Math.min(1, this.stateT / 2.6);
      // he hops back to the throne, which lifts off
      this.pos.lerpVectors(this.from, new THREE.Vector3(0, 1.0, 18.4), Math.min(1, k * 1.6));
      this.pos.y += Math.sin(Math.min(1, k * 1.6) * Math.PI) * 4;
      this.throne.position.y = Math.max(0, (k - 0.6) / 0.4) * 6.5;
      if (this.stateT > 2.8) {
        this.state = 'p2'; this.stateT = 0;
        for (const t of this.tanks) t.alive = true;
        this.act = { kind: 'cool', t: 0, dur: 1.5 };
        for (const [x, z] of [[-16, 16], [16, 16]]) { w.fx.splash(new THREE.Vector3(x, 5, z), UP, GRAY_HEX, 16, 5, 0.1); this.hooks.spawn('glint', new THREE.Vector3(x, 4.2, z), { yaw: Math.atan2(-x, -z) }); }
      }
    } else if (this.state === 'p2') this.updateP2(dt, p);
    else if (this.state === 'p3t') {
      const k = Math.min(1, this.stateT / 2.2);
      this.throne.position.lerpVectors(this.from, new THREE.Vector3(0, 0, 9), k);
      this.throne.position.y = this.from.y * (1 - k * k);
      this.throne.rotation.z = Math.sin(this.t * 14) * 0.2 * (1 - k);
      this.pos.copy(this.throne.position).setY(this.throne.position.y + 0.85);
      this.desat = k * 0.55;
      if (Math.random() < dt * 30) w.fx.spawn(this.throne.position.clone(), new THREE.Vector3(rand(-2, 2), rand(1, 4), rand(-2, 2)), 0x3b3745, rand(0.15, 0.3), 1.2);
      if (k >= 1 && !this.crashed) { this.crashed = true; w.fx.explosion(this.throne.position.clone().setY(1), 0x9a97a3, 3.5); w.audio?.sfx('explode', { volume: 1, pitch: 0.5 }); this.hooks.shake(1.1, 1); this.throne.visible = false; }
      if (this.stateT > 3.2) this.startTide();
    } else if (this.state === 'p3') this.updateP3(dt, p);
    else if (this.state === 'dying') this.updateDying(dt);
    else if (this.state === 'intro' || this.state === 'dormant') this.yaw += angleTo(this.yaw, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)) * (1 - Math.exp(-2 * dt));
    // tide (phase 3): rises unless drained; resets a bit when the player is splashed
    if (this.state === 'p3' || this.tide > -0.3) {
      if (!p.alive) this.tide = Math.min(this.tide, -0.3);
      const target = this.tideOn ? 0.9 : -0.3;
      this.tide += Math.sign(target - this.tide) * Math.min(Math.abs(target - this.tide), (target > this.tide ? 0.12 : 0.8) * dt);
      this.tideMesh.visible = this.tide > -0.25;
      this.tideMesh.position.y = this.tide + Math.sin(this.t * 1.7) * 0.03;
      if (this.tide > 0.05 && p.alive && p.invuln <= 0) {
        const depth = this.tide - p.pos.y;
        if (depth > 0.1) {
          const dps = (depth > 0.8 ? 40 : 22) * (this.hooks.story?.effects?.armor ?? 1);
          p.hp -= dps * dt; p.lastDamage = p.time;
          p.vel.x *= Math.exp(-2.5 * dt); p.vel.z *= Math.exp(-2.5 * dt);
          this.tideHurtT -= dt;
          if (this.tideHurtT <= 0) { this.tideHurtT = 0.6; this.hooks.story?.onPlayerHurt?.(dps, null); }
          if (p.hp <= 0) p.splatted(this, 'goo');
        }
      }
    }
    if (this.state === 'p3' && !this.exhausted) this.desat = Math.min(0.55, this.desat + dt * 0.1);
    else if (this.state === 'p3' && this.exhausted) this.desat = Math.max(0.2, this.desat - dt * 0.2);
    for (let i = this.lobQueue.length - 1; i >= 0; i--) {
      const q = this.lobQueue[i];
      q.t -= dt;
      if (q.t <= 0) { this.lobQueue.splice(i, 1); if (this.fighting && p.alive) this.shoot(p); }
    }
    this.updateLobs(dt);
    this.updateRings(dt, p);
    this.sync(dt, p);
  }

  updateDying(dt) {
    const w = this.world, k = this.stateT;
    this.desat = Math.max(0, this.desat - dt * 0.3);
    // rainbow bursts swirl around him and soak in
    if (Math.random() < dt * 14) {
      const a = rand(0, Math.PI * 2);
      const q = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * rand(1, 3), rand(0.5, 4.5), Math.sin(a) * rand(1, 3)));
      const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.62);
      w.fx.explosion(q, col, rand(0.8, 1.6));
      w.fx.splash(q, UP, col, 10, 4, 0.08);
    }
    if (k > 1.2 && Math.random() < dt * 8) { const a = rand(0, Math.PI * 2), r = rand(3, 16); w.combat.paint(w.player, new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r), rand(1.4, 2.6), { wobble: 0.3 }); }
    // he takes on colour
    const c = Math.min(1, Math.max(0, (k - 1.5) / 3));
    const M = this.mats;
    M.suit.color.setRGB(0.55, 0.54, 0.59).lerp(new THREE.Color(0xff8ccf), c);
    M.coat.color.setRGB(0.23, 0.22, 0.27).lerp(new THREE.Color(0x7c5cff), c);
    M.skin.color.setRGB(0.79, 0.78, 0.81).lerp(new THREE.Color(0xffd9c2), c);
    M.band.color.setRGB(0.43, 0.37, 0.53).lerp(new THREE.Color(0xffd21a), c);
    if (k > 4.6 && !this.flashed) { this.flashed = true; this.hooks.flash?.(0xffffff, 0.8); w.audio?.sfx('core_get', { volume: 1 }); }
    if (k > 7) {
      this.hooks.cine?.(null);
      this.state = 'dead';
      this.hooks.onDefeated(new THREE.Vector3(this.pos.x, 0, this.pos.z - 4.5));
    }
  }

  sync(dt, p) {
    const r = this.root;
    r.position.copy(this.pos);
    r.rotation.y = this.yaw;
    const dazed = this.dazed || this.exhausted;
    this.shieldMesh.visible = this.shielded || (this.state === 'p3' && !this.exhausted);
    if (this.shieldMesh.visible) { this.shieldMat.opacity = 0.26 + Math.sin(this.t * 3) * 0.06; this.shieldMesh.rotation.y += dt * 0.4; }
    this.stars.visible = dazed;
    if (dazed) this.stars.rotation.y += dt * 4;
    // body pose
    const [L, R] = this.arms;
    const t = this.t;
    if (dazed) { this.model.rotation.z = Math.sin(t * 2.5) * 0.12; this.model.position.y = -0.4; R.rotation.x = 0.3; L.rotation.x = 0.3; }
    else if (this.state === 'dying') { this.model.rotation.z = 0; this.model.position.y = 0; R.rotation.x = -2.8; L.rotation.x = -2.8 + Math.sin(t * 6) * 0.2; }
    else {
      this.model.rotation.z = 0;
      this.model.position.y = Math.abs(Math.sin(t * 3)) * 0.04 - (this.slamT > 0 ? 0.3 : 0);
      const aiming = this.lobQueue.length > 0 || this.act?.kind === 'volley';
      R.rotation.x = aiming ? -1.5 : this.act?.kind === 'dashWind' ? -0.6 : -0.3 + Math.sin(t * 2) * 0.1;
      L.rotation.x = this.act?.kind === 'dash' ? -1.2 : 0.1;
    }
    this.slamT = Math.max(0, (this.slamT || 0) - dt);
    this.head.rotation.z = Math.sin(t * 1.3) * 0.06;
    this.tipT = Math.max(0, (this.tipT || 0) - dt);
    this.tipMat.color.setRGB(0.72, 0.7, 0.77).multiplyScalar(this.tipT > 0 ? 3.5 : 1.4);
    this.monocle.material.emissive.setRGB(this.flash, this.flash, this.flash);
    this.body.pos.copy(this.pos).setY(this.pos.y + (dazed ? -0.4 : 0));
    // throne idle + tanks wobble back
    if (this.state !== 'p2') this.tankVis.forEach((tv) => tv.tg.scale.lerp(_w.set(1, 1, 1), 1 - Math.exp(-8 * dt)));
    else this.tankVis.forEach((tv) => { tv.tg.scale.lerp(_w.set(1, 1, 1), 1 - Math.exp(-8 * dt)); if (!tv.broken) tv.fill.emissiveIntensity = 0.8 + Math.sin(this.t * 4) * 0.3; });
    this.jetMat.color.setRGB(0.6, 0.59, 0.64).multiplyScalar(this.state === 'p2' ? 2 + Math.sin(this.t * 20) * 0.5 : 0.6);
    void p;
  }

  dispose() {
    for (const l of this.lobs) this.world.scene.remove(l.mesh);
    for (const r of this.rings) { this.world.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.lobGeo.dispose(); this.lobMat.dispose(); this.ringGeo.dispose(); this.ringMat.dispose(); this.tideMat.dispose();
    this.world.scene.remove(this.laser); this.laser.geometry.dispose(); this.laserMat.dispose();
    this.world.scene.remove(this.tideMesh); this.tideMesh.geometry.dispose();
    disposeTree(this.throne);
    disposeTree(this.root);
  }
}

function flat(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
