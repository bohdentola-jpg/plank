// MASCOT MAYHEM — a party-game elimination in oversized foam costumes.
// Four mascots on a round carnival stage. Jump the low sweeper, stay grounded
// under the high bar, dodge the rolling pumpkins, keep off tiles that are about
// to drop, brace for the confetti cannons — and don't get bumped off the edge.
// Three rounds; last mascot standing takes the round.
//
// QA hooks (query string → opts): seed=N fixes the hazard/AI random stream;
// auto=1|2|0.5 lets the same AI the CPUs use drive the player (1 = average,
// 2 = Big-Cheese sharp, 0.5 = sloppy) so runs can be scored unattended.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { toon, flat, M, rbox, box, cyl, sphere, torus, circle, lightRig, canvasTex, bake, GRADIENT } from '../art/kit.js';
import { PROPS, bunting } from '../art/props.js';
import { Character } from '../art/characters.js';
import { buildMascot, MASCOT_NAMES, MASCOT_ICONS } from '../art/mascots.js';
import { NPCS } from '../data/npcs.js';
import { clamp, lerp, rand, TAU, wrapAngle, approach, el, makeRng, ordinal } from '../core/util.js';

const R = 8;                    // stage radius
const HUB = 1.9;                // the central drum nobody can stand on
const RINGS = [[HUB, 4.0, 7], [4.0, 6.0, 10], [6.0, R, 13]];   // [inner r, outer r, sectors]
const PIT_Y = -1.3;
const SPEED = 5.4, JUMP_V = 8.2, GRAV = 19;
const JUMP_LEAD = 0.43;         // when to leave the ground so the sweeper passes under your apex
const LOW_TOP = 0.75;           // feet must clear this to hop the low sweeper
const HIGH_FROM = 4.6;          // the high bar only covers the outer part of the stage
const BODY = 0.82;              // mascot bump radius

const ROUNDS = [
  { name: 'ROUND 1', sub: 'Jump the sweeper!', time: 36, arm: [1.25, 1.8], high: null, balls: [8, 11], drops: [5.5, 1], regrow: 6, cannons: null },
  { name: 'ROUND 2', sub: 'Stay grounded under the HIGH bar!', time: 42, arm: [1.55, 2.2], high: [-0.95, -1.35], balls: [6.5, 9], drops: [4.6, 1], regrow: 8, cannons: [8, 11] },
  { name: 'FINAL ROUND', sub: 'The floor is leaving!', time: 48, arm: [1.8, 2.6], high: [1.1, 1.6], balls: [5.5, 7.5], drops: [6, 1], regrow: 9, cannons: [6.5, 9], shrink: true, reverse: true },
];
const PLACE_PTS = [60, 35, 15, 0];
const CPUS = [
  { kind: 'acorn', sigma: 0.085, pMiss: 0.1, aggro: 0.1, speed: 0.92, homeR: 4.7, aware: 0.72 },
  { kind: 'pumpkin', sigma: 0.07, pMiss: 0.075, aggro: 0.2, speed: 0.95, homeR: 4.3, aware: 0.84 },
  { kind: 'cheese', sigma: 0.035, pMiss: 0.02, aggro: 0.45, speed: 1.0, homeR: 3.6, aware: 0.98 },
];
const TILE_COLS = [[0xfff4dc, 0x58b8c9], [0xfff4dc, 0xf08a24], [0xfff4dc, 0xd4502f]];
const FOAM = [0xf08a24, 0xffd45a, 0xd4502f, 0x6aa84f, 0x58b8c9, 0x8a5aa8, 0xfff4dc];

function injectCss() {
  if (document.getElementById('mg-mascot-css')) return;
  const s = document.createElement('style');
  s.id = 'mg-mascot-css';
  s.textContent = `
  .mm-strip { position: absolute; left: 0.9em; top: 0.9em; display: flex; flex-direction: column; gap: 0.35em; }
  .mm-tag { background: rgba(255,244,220,0.95); border: 0.18em solid var(--ink); border-radius: 0.9em; padding: 0.05em 0.8em 0.05em 0.5em; font-weight: 900; box-shadow: 0 0.2em 0 rgba(43,26,51,0.4); white-space: nowrap; }
  .mm-tag.you { background: var(--gold); }
  .mm-tag.out { opacity: 0.5; text-decoration: line-through; filter: grayscale(0.8); }
  .mm-tag .pl { font-size: 0.78em; opacity: 0.75; margin-left: 0.4em; }
  .mm-you { position: absolute; transform: translate(-50%, -100%); font-size: 1.5em; font-weight: 900; color: var(--gold); -webkit-text-stroke: 0.12em var(--ink); paint-order: stroke fill; animation: bob2 .5s ease-in-out infinite alternate; pointer-events: none; }`;
  document.head.appendChild(s);
}

export default class MascotMayhem extends Minigame {
  static meta = {
    id: 'mascot', title: 'Mascot Mayhem', icon: '🎭',
    blurb: 'Four mascots, one wobbly stage. <b>Jump</b> the low sweeper, stay <b>grounded</b> under the high bar, dodge what rolls, and get off any tile that starts flashing. Last costume standing wins the round. Three rounds — and <b>Big Cheese</b> has never lost.',
    controls: [['move', 'waddle'], ['a', 'jump']],
    scoreLabel: 'points', goals: [150, 280, 400], hasHard: true, music: 'fair',
  };

  // ================================================================ scene
  setup(opts) {
    injectCss();
    this.rng = makeRng(opts.seed ? Math.round(opts.seed) : (Math.random() * 1e9) | 0);
    this.speedMul = this.hard ? 1.25 : 1;
    this.rateMul = this.hard ? 0.72 : 1;
    this.camera.fov = 22;
    this.rig = lightRig(this.scene, 'day', { shadowSize: 17, fog: [70, 160] });
    this.rig.follow(0, 0);
    this._buildWorld();
    this._buildStage();
    this._buildContestants();
    this.balls = [];
    this.cannonShot = null;
    this.phase = 'wait';
    this.roundIdx = -1;
    this.round = ROUNDS[0];
    this.score = 0;
    this.wins = 0; this.outlasted = 0; this.places = [];
    this.stats = { hits: {}, outs: [], rounds: [] };
    this._resetRound();
    this._hudStrip();
    this._placeCamera();
  }

  _buildWorld() {
    const s = this.scene;
    const tex = canvasTex(512, 512, (c) => {
      c.fillStyle = '#8fbf62'; c.fillRect(0, 0, 512, 512);
      const r = makeRng(5);
      for (let i = 0; i < 260; i++) { c.fillStyle = ['#84b55b', '#98c76c', '#8fbf5f'][i % 3]; c.beginPath(); c.ellipse(r() * 512, r() * 512, 8 + r() * 26, 6 + r() * 16, r() * 3, 0, TAU); c.fill(); }
      for (let i = 0; i < 420; i++) { c.fillStyle = ['#e8842c', '#d4502f', '#f2b632', '#c9652a'][i % 4]; c.beginPath(); c.ellipse(r() * 512, r() * 512, 2.2, 1.4, r() * 3, 0, TAU); c.fill(); }
    }, { repeat: [5, 5] });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshToonMaterial({ map: tex, gradientMap: GRADIENT }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.y = PIT_Y; lawn.receiveShadow = true;
    s.add(lawn);
    const dress = new THREE.Group();
    dress.position.y = PIT_Y;
    const put = (obj, x, z, ry = 0) => { obj.position.x += x; obj.position.z += z; obj.rotation.y += ry; dress.add(obj); return obj; };
    put(PROPS.tent({ color: 0xd4502f, r: 2.6 }), -17, -9);
    put(PROPS.tent({ color: 0x2a6f77, r: 2.2 }), 17.5, -8);
    put(PROPS.tent({ color: 0x8a5aa8, r: 2 }), 20, 3);
    put(PROPS.booth({ text: 'MASCOT MAYHEM', color: 0x8a5aa8 }), 0, -16.5);
    put(PROPS.bleachers({ len: 9, rows: 3 }), -9.5, -15.5);
    put(PROPS.bleachers({ len: 9, rows: 3 }), 9.5, -15.5);
    for (const [x, z] of [[-14, 4], [-15.5, 5.2], [14.5, 7], [-12.5, -13], [13, -13.5], [16, 8.2]]) put(PROPS.hayBale({}), x, z, rand(0.4));
    for (const [x, z, sc] of [[-13, 6.4, 1.2], [15.6, 5.4, 0.9], [-16.4, 3, 0.8], [12.6, 9, 1.1]]) put(PROPS.pumpkin({ s: sc }), x, z);
    put(PROPS.balloons({ seed: 1 }), -4.6, -15.6); put(PROPS.balloons({ seed: 2 }), 4.6, -15.6);
    for (const [x, z, sc] of [[-22, -14, 1.3], [23, -15, 1.2], [-24, 2, 1.1], [25, 8, 1.2], [-20, 12, 1], [0, -24, 1.4]]) put(PROPS.tree({ s: sc }), x, z);
    const poles = [[-13.5, -11.5], [0, -13.6], [13.5, -11.5], [16.5, 0], [-16.5, 0]];
    for (const [x, z] of poles) dress.add(M(cyl(0.08, 0.1, 4.6, 6), toon(0xfffaf0), x, 2.3, z));
    for (const [a, b] of [[4, 0], [0, 1], [1, 2], [2, 3]]) dress.add(bunting(poles[a][0], poles[a][1], poles[b][0], poles[b][1], { y: 4.4, sag: 0.8 }));
    this.wheel = PROPS.ferrisWheel({});
    put(this.wheel, -6, -27);
    this.wheel.scale.setScalar(1.25);
    s.add(this.wheel);            // keeps spinning (not baked)
    this.wheel.position.y = PIT_Y;
    bake(dress);
    s.add(dress);
    // a little crowd on and around the bleachers
    this.crowd = [];
    const fans = [[NPCS.ringmaster, 0, -14.2, 0], [NPCS.dot, -11.5, -14.3, 0.3], [NPCS.mittens, -8, -14.6, 0.2], [NPCS.hamm, 8.4, -14.5, -0.2], [NPCS.quill, 11.6, -14.2, -0.3], [NPCS.bleat, -15, 7.4, 1.2], [NPCS.nutmeg, 15.4, 9.6, -1.2]];
    for (const [n, x, z, yaw] of fans) {
      const ch = new Character(n.spec);
      ch.setPos(x, z, PIT_Y);
      ch.face(yaw);
      s.add(ch.root);
      this.crowd.push({ ch, t: rand(4), hype: 0 });
    }
  }

  _buildStage() {
    const s = this.scene;
    const st = new THREE.Group();
    // drum skirt
    const skirtTex = canvasTex(512, 64, (c) => { for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#d4502f' : '#fff4dc'; c.fillRect(i * 16, 0, 16, 64); } c.fillStyle = 'rgba(43,26,51,0.18)'; c.fillRect(0, 44, 512, 20); });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 1.3, 48, 1, true), new THREE.MeshToonMaterial({ map: skirtTex, gradientMap: GRADIENT }));
    skirt.position.y = PIT_Y / 2 - 0.02; skirt.castShadow = true;
    st.add(skirt);
    st.add(M(torus(R + 0.06, 0.13, 6, 48), toon(0xffd45a), 0, -0.36, 0, { rx: Math.PI / 2 }));
    const hole = new THREE.Mesh(circle(R - 0.05, 40), flat(0x1b1024));
    hole.rotation.x = -Math.PI / 2; hole.position.y = PIT_Y + 0.06;
    st.add(hole);
    // foam pit
    const n = 260;
    const foam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), new THREE.MeshToonMaterial({ gradientMap: GRADIENT }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    const r = makeRng(11);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rr = R + 0.45 + r() * 2.7;
      e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e);
      const k = 0.75 + r() * 0.5;
      m4.compose(v.set(Math.cos(a) * rr, PIT_Y + 0.15 + r() * 0.42, Math.sin(a) * rr), q, sc.set(k, k, k));
      foam.setMatrixAt(i, m4);
      foam.setColorAt(i, col.set(FOAM[i % FOAM.length]));
    }
    foam.castShadow = true; foam.receiveShadow = true;
    st.add(foam);
    st.add(M(torus(R + 3.55, 0.55, 8, 48), toon(0xd4502f), 0, PIT_Y + 0.3, 0, { rx: Math.PI / 2 }));
    st.add(M(torus(R + 3.55, 0.57, 8, 48), toon(0xfff4dc), 0, PIT_Y + 0.3, 0, { rx: Math.PI / 2, sz: 0.35 }));
    s.add(st);

    // tiles
    this.tiles = [];
    RINGS.forEach(([r0, r1, cnt], ri) => {
      for (let i = 0; i < cnt; i++) {
        const span = TAU / cnt, a0 = i * span + 0.012, a1 = (i + 1) * span - 0.012;
        const sh = new THREE.Shape();
        sh.moveTo(Math.cos(a0) * (r0 + 0.03), Math.sin(a0) * (r0 + 0.03));
        sh.absarc(0, 0, r1 - 0.03, a0, a1, false);
        sh.absarc(0, 0, r0 + 0.03, a1, a0, true);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false, curveSegments: 5 });
        geo.rotateX(Math.PI / 2);
        const base = TILE_COLS[ri][(i + ri) % 2];
        const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: base, gradientMap: GRADIENT }));
        mesh.receiveShadow = true;
        s.add(mesh);
        const am = (a0 + a1) / 2, rm = (r0 + r1) / 2;
        this.tiles.push({ ring: ri, idx: i, r0, r1, a0, a1, cx: Math.cos(am) * rm, cz: Math.sin(am) * rm, mesh, base: new THREE.Color(base), state: 'ok', t: 0, y: 0 });
      }
    });
    this.ringStart = [0, RINGS[0][2], RINGS[0][2] + RINGS[1][2]];

    // hub + arms
    const hub = new THREE.Group();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; hub.add(M(box(1.0, 0.56, 0.2), toon(i % 2 ? 0xd4502f : 0xfff4dc), Math.cos(a) * (HUB - 0.1), 0.28, Math.sin(a) * (HUB - 0.1), { ry: -a + Math.PI / 2 })); }
    hub.add(M(cyl(HUB - 0.12, HUB - 0.12, 0.56, 24), toon(0x8a5aa8), 0, 0.28, 0));
    hub.add(M(cyl(HUB - 0.3, HUB - 0.12, 0.2, 24), toon(0xffd45a), 0, 0.66, 0));
    hub.add(M(cyl(0.5, 0.7, 3.0, 12), toon(0xfff4dc), 0, 2.2, 0));
    for (let i = 0; i < 4; i++) hub.add(M(torus(0.6 - i * 0.045, 0.07, 5, 16), toon(0xd4502f), 0, 1.2 + i * 0.7, 0, { rx: Math.PI / 2 }));
    hub.add(M(sphere(0.5, 14, 10), toon(0xffd45a), 0, 3.95, 0));
    bake(hub);
    s.add(hub);

    const low = new THREE.Group();
    for (let i = 0; i < 7; i++) low.add(M(rbox(1.0, 0.5, 0.64, 0.14), toon(i % 2 ? 0xfff4dc : 0xd4502f), HUB + 0.5 + i * 0.985, 0.45, 0));
    low.add(M(sphere(0.42, 10, 8), toon(0xffd45a), HUB + 7.25, 0.45, 0));
    bake(low);
    s.add(low);
    this.low = { group: low, angle: 0, speed: 0, dir: 1, r0: HUB, r1: HUB + 7.5, half: 0.32 };

    const high = new THREE.Group();
    high.add(M(box(8.6, 0.16, 0.16), toon(0x6a7480), 4.5, 3.62, 0));
    for (let i = 0; i < 4; i++) high.add(M(cyl(0.36, 0.36, 1.06, 12), toon(i % 2 ? 0xffd45a : 0x8a5aa8), HIGH_FROM + 0.55 + i * 1.06, 3.3, 0, { rz: Math.PI / 2 }));
    for (const x of [HIGH_FROM + 0.05, HIGH_FROM + 4.25]) high.add(M(cyl(0.04, 0.04, 0.3, 5), toon(0x6a7480), x, 3.5, 0));
    bake(high);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.1), new THREE.MeshBasicMaterial({ color: 0x3b2148, transparent: true, opacity: 0.3, depthWrite: false }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(HIGH_FROM + 2.15, 0.03, 0); strip.renderOrder = 3;
    high.add(strip);
    s.add(high);
    this.high = { group: high, angle: 2, speed: 0, r0: HIGH_FROM, r1: HIGH_FROM + 4.3, half: 0.36, active: false };

    // confetti cannons
    this.cannons = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const g = new THREE.Group();
      g.add(M(rbox(1.3, 1.5, 1.3, 0.12), toon(0x2a6f77), 0, PIT_Y + 0.75, 0));
      const barrel = new THREE.Group();
      barrel.add(M(cyl(0.5, 0.62, 1.7, 12), toon(0x3b2148), 0, 0, 0.5, { rx: Math.PI / 2 }));
      barrel.add(M(torus(0.52, 0.09, 6, 14), toon(0xffd45a), 0, 0, 1.35));
      barrel.add(M(torus(0.6, 0.08, 6, 14), toon(0xffd45a), 0, 0, 0.1));
      barrel.position.y = 0.75; barrel.rotation.x = -0.12;
      g.add(barrel);
      g.position.set(Math.cos(a) * (R + 2.2), 0, Math.sin(a) * (R + 2.2));
      g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      s.add(g);
      const coneGeo = new THREE.CircleGeometry(10.5, 14, -0.4, 0.8);
      const decal = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0, depthWrite: false }));
      decal.rotation.x = -Math.PI / 2;
      decal.rotation.z = Math.atan2(Math.sin(a), -Math.cos(a));    // sector opens back toward the centre
      decal.position.set(g.position.x, 0.05, g.position.z);
      decal.renderOrder = 4;
      s.add(decal);
      this.cannons.push({ a, x: g.position.x, z: g.position.z, dx: -Math.cos(a), dz: -Math.sin(a), g, barrel, decal });
    }
    // lane marker for rolling things
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.9), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0, depthWrite: false }));
    this.lane.rotation.x = -Math.PI / 2; this.lane.position.y = 0.045; this.lane.renderOrder = 4;
    s.add(this.lane);
  }

  _buildContestants() {
    const mk = (kind, isPlayer, ai) => {
      const m = buildMascot(kind, { scale: 1.12 });
      this.scene.add(m.root);
      return { kind, isPlayer, name: isPlayer ? 'You' : MASCOT_NAMES[kind], icon: MASCOT_ICONS[kind], m, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, yaw: 0, grounded: true, stun: 0, out: false, outAt: 0, place: 0, armCd: 0, bumpCd: 0, ai: ai ? this._mkAi(ai, this.hard) : null };
    };
    this.cs = [mk('football', true, null), ...CPUS.map((c) => mk(c.kind, false, c))];
    this.player = this.cs[0];
    this.youRing = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.24, 28), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.95, depthWrite: false }));
    this.youRing.rotation.x = -Math.PI / 2; this.youRing.renderOrder = 5;
    this.scene.add(this.youRing);
    this.youTag = el('div.mm-you', '▼');
    this.hud.appendChild(this.youTag);
    this.cheese = this.cs.find((c) => c.kind === 'cheese');
    const a = this.opts.auto;
    if (a) this.player.ai = this._mkAi(a >= 2 ? CPUS[2] : a >= 1 ? CPUS[1] : { ...CPUS[0], sigma: 0.14, pMiss: 0.22, aware: 0.45 }, false);
  }

  _mkAi(p, h) {
    return {
      sigma: p.sigma * (h ? 0.7 : 1), pMiss: p.pMiss * (h ? 0.5 : 1), aggro: p.aggro + (h ? 0.25 : 0), speed: p.speed + (h ? 0.05 : 0),
      homeR: p.homeR, aware: p.aware, t: 0, goalX: 0, goalZ: 0, lead: JUMP_LEAD, skip: false, lastTti: 99, seen: new Map(), victim: null, shoveT: 0, shoveCd: 2,
    };
  }

  _hudStrip() {
    this.strip = el('div.mm-strip');
    this.tags = this.cs.map((c) => { const t = el(`div.mm-tag${c.isPlayer ? '.you' : ''}`, `${c.icon} ${c.name}`); this.strip.appendChild(t); return t; });
    this.hud.appendChild(this.strip);
  }

  _placeCamera() {
    const asp = this.camera.aspect || 1.78;
    const d = 43.5 * (asp < 1.6 ? 1.6 / asp : 1);
    const pitch = 0.96;
    this.camera.position.set(0, Math.sin(pitch) * d, 1.0 + Math.cos(pitch) * d);
    this.camera.lookAt(0, 0.2, 1.0);
    this.fx.applyShake(this.camera);
  }

  // ================================================================ rounds
  begin() { this._startRound(0); }

  _resetRound() {
    for (const t of this.tiles) { t.state = 'ok'; t.t = 0; t.y = 0; t.mesh.visible = true; t.mesh.position.y = 0; t.mesh.material.color.copy(t.base); }
    this.low.angle = -Math.PI / 2; this.low.speed = 0; this.low.dir = 1;
    this.high.angle = Math.PI / 2 + 0.6; this.high.active = false; this.high.group.visible = false;
    for (const b of this.balls || []) b.mesh.removeFromParent();
    this.balls = [];
    this.cannonShot = null;
    for (const c of this.cannons) c.decal.material.opacity = 0;
    this.lane.material.opacity = 0;
    this.cs.forEach((c, i) => {
      const a = Math.PI / 2 + (i * TAU) / this.cs.length;
      c.x = Math.cos(a) * 5; c.z = Math.sin(a) * 5; c.y = 0; c.vx = c.vz = c.vy = 0;
      c.yaw = Math.atan2(-c.x, -c.z);
      c.grounded = true; c.stun = 0; c.out = false; c.outAt = 0; c.place = 0; c.armCd = 0; c.cheer = false;
      c.m.root.visible = true;
      if (c.ai) { c.ai.t = 0; c.ai.lastTti = 99; c.ai.seen.clear(); c.ai.victim = null; c.ai.shoveT = 0; c.ai.shoveCd = 2 + i; }
      c.shovedT = 0;
    });
    this.roundT = 0;
    this.ballT = 0; this.dropT = 0; this.cannonT = 0; this.shrinkT = 0; this.revT = 0;
    this.playerOutT = 0;
    this.safeR = R;
  }

  _startRound(i) {
    this.roundIdx = i;
    const rd = this.round = ROUNDS[i];
    this._resetRound();
    this.high.active = !!rd.high;
    this.high.group.visible = !!rd.high;
    this.ballT = this.rng.range(rd.balls[0], rd.balls[1]) * this.rateMul * (i === 0 ? 1 : 0.7);
    this.dropT = rd.drops[0] * this.rateMul;
    this.cannonT = rd.cannons ? this.rng.range(rd.cannons[0], rd.cannons[1]) * this.rateMul : 1e9;
    this.shrinkT = 7;
    this.shrinkQueue = rd.shrink ? this._shrinkOrder() : [];
    this.revT = this.rng.range(8, 11);
    this.revWarn = 0;
    this.phase = 'intro';
    this.phaseT = i === 0 ? 0.9 : 1.9;
    G.ui.banner(rd.name, rd.sub, { dur: 1.5, cls: 'small' });
    this.tags.forEach((t, k) => { t.className = `mm-tag${this.cs[k].isPlayer ? ' you' : ''}`; t.textContent = `${this.cs[k].icon} ${this.cs[k].name}`; });
  }

  _shrinkOrder() {
    // outer ring first (starting somewhere random), then the middle ring
    const out = [];
    for (const ri of [2, 1]) {
      const cnt = RINGS[ri][2], start = this.rng.int(0, cnt - 1);
      for (let k = 0; k < cnt; k++) out.push(this.tiles[this.ringStart[ri] + ((start + k * 3) % cnt)]);
    }
    return [...new Set(out)];
  }

  _endRound() {
    const rd = this.round, p = this.player;
    const alive = this.cs.filter((c) => !c.out);
    for (const c of alive) {
      c.place = 1; c.cheer = true;
      const i = this.cs.indexOf(c);
      this.tags[i].innerHTML = `${c.icon} ${c.name}<span class="pl">${p.out && !c.isPlayer ? 'still in' : '1st'}</span>`;
    }
    const place = p.out ? p.place : 1;
    const surv = Math.round(2 * (p.out ? p.outAt : Math.min(this.roundT, rd.time)));
    const beatCheese = this.cheese.out && (!p.out || this.cheese.outAt < p.outAt);
    const pts = surv + PLACE_PTS[place - 1] + (beatCheese ? 25 : 0);
    this.score += pts;
    this.places.push(place);
    this.stats.rounds.push({ t: +this.roundT.toFixed(1), place, pts, alive: alive.map((c) => c.kind) });
    if (place === 1) this.wins++;
    if (beatCheese) this.outlasted++;
    this.phase = 'outro';
    this.phaseT = 2.7;
    G.audio.sfx(place === 1 ? 'firstdown' : 'good');
    if (place === 1) { G.audio.sfx('crowd', 0.8); this.fx.confetti({ x: p.x, y: 3, z: p.z }, 40); }
    for (const f of this.crowd) f.hype = 2.5;
    G.ui.banner(`${ordinal(place)} PLACE`, `${rd.name}: +${pts}${beatCheese ? ' — outlasted Big Cheese!' : ''}`, { dur: 2.3, cls: place === 1 ? 'small' : 'small cool' });
    this.lane.material.opacity = 0;
    for (const c of this.cannons) c.decal.material.opacity = 0;
  }

  _nextRound() {
    if (this.roundIdx + 1 < ROUNDS.length) { this._startRound(this.roundIdx + 1); return; }
    this.phase = 'done';
    const medalLine = `Places: ${this.places.map((n) => ordinal(n)).join(' · ')} — rounds won: <b>${this.wins}/3</b>${this.outlasted ? ` — outlasted Big Cheese ${this.outlasted}×` : ''}`;
    this.finish({ score: this.score, detail: medalLine, title: this.wins >= 2 ? 'Champion of the foam!' : this.wins ? 'Nice waddling!' : 'Foam-pit regular', extra: { wins: this.wins, places: this.places.slice(), outlasted: this.outlasted } });
  }

  // ================================================================ helpers
  tileAt(x, z) {
    const r = Math.hypot(x, z);
    if (r > R || r < HUB) return null;
    const ri = r < RINGS[0][1] ? 0 : r < RINGS[1][1] ? 1 : 2;
    let a = Math.atan2(z, x);
    if (a < 0) a += TAU;
    const cnt = RINGS[ri][2];
    return this.tiles[this.ringStart[ri] + Math.min(cnt - 1, Math.floor(a / (TAU / cnt)))];
  }
  solidAt(x, z) {
    const r = Math.hypot(x, z);
    if (r > R + 0.05) return false;
    if (r < HUB) return true;
    const t = this.tileAt(x, z);
    return !!t && (t.state === 'ok' || t.state === 'warn');
  }
  /** Would the AI trust this spot? (on the stage, tile solid and not about to go) */
  _safe(x, z) {
    const r = Math.hypot(x, z);
    if (r > R - 0.3) return false;
    if (r < HUB) return true;
    const t = this.tileAt(x, z);
    return !!t && t.state === 'ok';
  }
  /** Seconds until an arm's centre line reaches a contestant (Infinity if it isn't turning). */
  _tti(arm, c, relative = false) {
    const sp = arm.speed;
    if (Math.abs(sp) < 0.15) return 99;
    let d = (Math.atan2(c.z, c.x) - arm.angle) * Math.sign(sp);
    d = ((d % TAU) + TAU) % TAU;
    let closing = Math.abs(sp);
    if (relative) {
      const r2 = c.x * c.x + c.z * c.z || 1;
      closing -= ((c.x * c.vz - c.z * c.vx) / r2) * Math.sign(sp);   // walking with/against the sweep
      if (closing < 0.2) return 99;
    }
    return d / closing;
  }
  _gauss() { const r = this.rng; return (r() + r() + r() - 1.5) * 1.15; }

  _knock(c, vx, vz, vy, stun, text, src = 'arm') {
    const cls = '';
    c.vx = vx; c.vz = vz; c.vy = Math.max(c.vy, vy); c.grounded = false; c.stun = Math.max(c.stun, stun);
    c.lastHit = src; c.lastHitT = this.roundT;
    this.stats.hits[src] = (this.stats.hits[src] || 0) + 1;
    this.fx.impact({ x: c.x, y: c.y + 1.3, z: c.z }, 0xffd45a, 1);
    this.fx.shake(c.isPlayer ? 0.35 : 0.16, 0.22);
    if (text) G.ui.pop(text, { x: c.x, y: c.y + 3, z: c.z }, cls || (c.isPlayer ? 'big bad' : ''), 0.9);
  }

  _eliminate(c) {
    const alive = this.cs.filter((k) => !k.out).length;
    c.out = true; c.outAt = this.roundT; c.place = alive;
    c.m.root.visible = false;
    this.stats.outs.push({ kind: c.kind, round: this.roundIdx, t: +this.roundT.toFixed(1), how: Math.hypot(c.x, c.z) > R ? 'edge' : 'hole', after: this.roundT - (c.lastHitT ?? -99) < 2.5 ? c.lastHit : 'slip' });
    const y = Math.hypot(c.x, c.z) > R ? PIT_Y + 0.4 : PIT_Y + 0.3;
    this.fx.burst('conf', { x: c.x, y, z: c.z }, 26, { speed: 5, up: 7, g: -12, life: 1.3, s0: 0.5, s1: 0.4, flip: 7, color: FOAM, floor: PIT_Y + 0.05 });
    this.fx.burst('puff', { x: c.x, y: y + 0.3, z: c.z }, 8, { speed: 3, up: 2, life: 0.5, s0: 0.7, g: 0, color: 0xfff4dc });
    G.ui.pop(c.isPlayer ? 'YOU\'RE OUT!' : `${c.name} is OUT!`, { x: c.x, y: 1.6, z: c.z }, c.isPlayer ? 'big bad' : 'white', 1.3);
    G.audio.sfx('splash');
    G.audio.sfx('crowd', 0.5);
    for (const f of this.crowd) f.hype = Math.max(f.hype, 1.4);
    const i = this.cs.indexOf(c);
    this.tags[i].classList.add('out');
    this.tags[i].innerHTML = `${c.icon} ${c.name}<span class="pl">${ordinal(c.place)}</span>`;
    if (c.isPlayer) this.playerOutT = 1.9;
  }

  // ================================================================ hazards
  _updateArms(dt, k) {
    const rd = this.round, low = this.low, high = this.high;
    const want = lerp(rd.arm[0], rd.arm[1], k) * this.speedMul;
    if (rd.reverse) {
      if (this.revWarn > 0) {
        this.revWarn -= dt;
        if (this.revWarn <= 0) { low.dir *= -1; this.revT = this.rng.range(7, 10) * this.rateMul; }
      } else {
        this.revT -= dt;
        if (this.revT <= 0) { this.revWarn = 0.7; G.audio.sfx('alarm'); G.ui.pop('REVERSE!', { x: 0, y: 4.6, z: 0 }, 'cool', 1.0); }
      }
    }
    low.speed = approach(low.speed, want * low.dir, (this.revWarn > 0 ? 1.2 : 3.4) * dt);
    low.angle = wrapAngle(low.angle + low.speed * dt);
    if (high.active) {
      high.speed = lerp(rd.high[0], rd.high[1], k) * this.speedMul;
      high.angle = wrapAngle(high.angle + high.speed * dt);
    }
    // contacts
    for (const c of this.cs) {
      if (c.out) continue;
      c.armCd -= dt;
      if (c.armCd > 0) continue;
      const r = Math.hypot(c.x, c.z);
      const a = Math.atan2(c.z, c.x);
      for (const arm of high.active ? [low, high] : [low]) {
        if (r < arm.r0 - 0.35 || r > arm.r1 + 0.45) continue;
        const d = wrapAngle(a - arm.angle);
        if (Math.cos(d) <= 0) continue;
        if (Math.abs(Math.sin(d) * r) > arm.half + 0.36) continue;
        const isLow = arm === low;
        const hit = isLow ? c.y < LOW_TOP : c.y > 0.7;
        if (!hit) continue;
        const dir = Math.sign(arm.speed) || 1;
        const tx = -Math.sin(arm.angle) * dir, tz = Math.cos(arm.angle) * dir;
        const pw = Math.abs(arm.speed) * r * 0.4 + 3.0;
        const ox = c.x / (r || 1), oz = c.z / (r || 1);
        this._knock(c, tx * pw + ox * 1.3, tz * pw + oz * 1.3, isLow ? 3.0 : 1, 0.65, isLow ? 'BONK!' : 'CLONK!', isLow ? 'low' : 'high');
        G.audio.sfx('tackle');
        c.armCd = 0.55;
        if (c.ai) c.ai.lastTti = 0;
        break;
      }
    }
  }

  _updateTiles(dt) {
    const rd = this.round;
    // scheduled drops
    this.dropT -= dt;
    if (this.dropT <= 0) {
      this.dropT = rd.drops[0] * this.rateMul * this.rng.range(0.8, 1.2);
      for (let n = 0; n < rd.drops[1] + (this.hard ? 1 : 0); n++) {
        const ok = this.tiles.filter((t) => t.state === 'ok');
        if (ok.length < 6) break;
        let pick = null;
        if (this.rng() < 0.45) {                       // sometimes right under somebody's feet
          const alive = this.cs.filter((c) => !c.out);
          if (alive.length) { const c = this.rng.pick(alive); const t = this.tileAt(c.x, c.z); if (t && t.state === 'ok') pick = t; }
        }
        if (!pick) pick = this.rng.pick(ok);
        this._warnTile(pick, rd.regrow);
      }
    }
    // the final round eats the stage from the outside in
    if (rd.shrink && this.shrinkQueue.length) {
      this.shrinkT -= dt;
      if (this.shrinkT <= 0) {
        this.shrinkT = (this.shrinkQueue.length > RINGS[1][2] ? 1.45 : 1.9) * this.rateMul;
        const t = this.shrinkQueue.shift();
        if (t.state === 'ok') this._warnTile(t, 0);
      }
    }
    let outer = 0, mid = 0;
    for (const t of this.tiles) {
      if (t.state === 'warn') {
        t.t -= dt;
        const f = Math.sin(t.t * 22) > 0;
        t.mesh.material.color.set(f ? 0xff5a3c : 0xffd45a);
        t.mesh.position.y = Math.sin(t.t * 60) * 0.035;
        if (t.t <= 0) {
          t.state = 'gone'; t.vy = 0; t.y = 0; t.back = t.regrow;
          G.audio.sfx('thud');
          this.fx.burst('puff', { x: t.cx, y: 0.1, z: t.cz }, 5, { speed: 2, up: 1.4, life: 0.4, s0: 0.5, g: 0 });
        }
      } else if (t.state === 'gone') {
        if (t.mesh.visible) { t.vy -= 22 * dt; t.y += t.vy * dt; t.mesh.position.y = t.y; if (t.y < -2.4) t.mesh.visible = false; }
        if (t.regrow > 0) {
          t.back -= dt;
          if (t.back <= 0) { t.state = 'rise'; t.y = -1.2; t.mesh.visible = true; t.mesh.material.color.copy(t.base); }
        }
      } else if (t.state === 'rise') {
        t.y = Math.min(0, t.y + dt * 2.6);
        t.mesh.position.y = t.y;
        if (t.y >= 0) { t.state = 'ok'; G.audio.sfx('pop'); }
      }
      if (t.state === 'ok' || t.state === 'warn') { if (t.ring === 2) outer++; else if (t.ring === 1) mid++; }
    }
    this.safeR = outer >= RINGS[2][2] * 0.55 ? R : mid >= RINGS[1][2] * 0.55 ? RINGS[1][1] : RINGS[0][1];
  }

  _warnTile(t, regrow) {
    if (t.state !== 'ok') return;
    t.state = 'warn'; t.t = this.hard ? 1.05 : 1.3; t.regrow = regrow;
    G.audio.sfx('tick');
  }

  _updateBalls(dt) {
    const rd = this.round;
    this.ballT -= dt;
    if (this.ballT <= 0 && !this.balls.some((b) => b.state === 'warn')) {
      this.ballT = this.rng.range(rd.balls[0], rd.balls[1]) * this.rateMul;
      // a chord across the stage that misses the hub; half the time it's aimed at somebody
      let ang = this.rng() * TAU, off = this.rng.range(2.9, 6.2) * (this.rng() < 0.5 ? -1 : 1);
      const alive = this.cs.filter((c) => !c.out);
      if (alive.length && this.rng() < 0.5) {
        const c = this.rng.pick(alive);
        const dx = Math.cos(ang), dz = Math.sin(ang);
        const lat = c.x * -dz + c.z * dx;
        if (Math.abs(lat) > 2.8) off = clamp(lat, -6.4, 6.4);
      }
      const dx = Math.cos(ang), dz = Math.sin(ang), nx = -dz, nz = dx;
      const kind = this.rng() < 0.5 ? 'pumpkin' : 'football';
      const mesh = new THREE.Group();
      if (kind === 'pumpkin') {
        mesh.add(M(sphere(1, 16, 12), toon(0xf08a24), 0, 0, 0, { sy: 0.9 }));
        for (let i = 0; i < 4; i++) mesh.add(M(torus(1.0, 0.07, 5, 18), toon(0xc9652a), 0, 0, 0, { ry: (i / 4) * Math.PI, sy: 0.9 }));
        mesh.add(M(cyl(0.1, 0.16, 0.3, 6), toon(0x5a7a3c), 0, 0.98, 0));
      } else {
        mesh.add(M(sphere(1, 16, 12), toon(0x8a4a26), 0, 0, 0, { sx: 0.74, sy: 0.74, sz: 1.2 }));
        for (const s of [-1, 1]) mesh.add(M(torus(0.52, 0.06, 5, 16), toon(0xfff4dc), 0, 0, s * 0.72));
      }
      bake(mesh);
      mesh.scale.setScalar(0.95);
      mesh.visible = false;
      this.scene.add(mesh);
      const speed = this.rng.range(7, 9) * (this.hard ? 1.12 : 1);
      this.balls.push({ state: 'warn', t: this.hard ? 0.8 : 1.05, x: nx * off - dx * (R + 3.5), z: nz * off - dz * (R + 3.5), dx, dz, nx, nz, off, speed, mesh, r: 0.95, kind, hit: new Set() });
      this.lane.scale.set(2 * R + 5, 1, 1);
      this.lane.position.set(nx * off, 0.045, nz * off);
      this.lane.rotation.z = -Math.atan2(dz, dx);
      G.audio.sfx('alarm');
    }
    let warn = 0;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.state === 'warn') {
        b.t -= dt;
        warn = 0.22 + Math.abs(Math.sin(b.t * 14)) * 0.3;
        if (b.t <= 0) { b.state = 'roll'; b.mesh.visible = true; G.audio.sfx('push'); }
        continue;
      }
      b.x += b.dx * b.speed * dt; b.z += b.dz * b.speed * dt;
      const onStage = Math.hypot(b.x, b.z) < R + 0.3;
      b.mesh.position.set(b.x, onStage ? b.r : lerp(b.mesh.position.y, PIT_Y + b.r, 0.2), b.z);
      b.mesh.rotateOnWorldAxis(_axis.set(b.dz, 0, -b.dx), (b.speed * dt) / b.r);
      warn = Math.max(warn, 0.12);
      if (onStage && Math.random() < dt * 14) this.fx.dust(b.x - b.dx * 0.6, b.z - b.dz * 0.6, 0xfff4dc, 1);
      for (const c of this.cs) {
        if (c.out || b.hit.has(c) || c.y > 1.55) continue;
        const d = Math.hypot(c.x - b.x, c.z - b.z);
        if (d < b.r + 0.62) {
          b.hit.add(c);
          const side = Math.sign((c.x - b.x) * b.nx + (c.z - b.z) * b.nz) || 1;
          this._knock(c, b.dx * b.speed * 0.72 + b.nx * side * 2.4, b.dz * b.speed * 0.72 + b.nz * side * 2.4, 4.2, 0.8, 'WHUMP!', 'ball');
          G.audio.sfx('tackle');
        }
      }
      if ((b.x * b.dx + b.z * b.dz) > R + 4.5) { b.mesh.removeFromParent(); this.balls.splice(i, 1); }
    }
    this.lane.material.opacity = warn;
  }

  _updateCannons(dt) {
    const rd = this.round;
    if (!rd.cannons) return;
    const shot = this.cannonShot;
    if (!shot) {
      this.cannonT -= dt;
      if (this.cannonT <= 0) {
        this.cannonT = this.rng.range(rd.cannons[0], rd.cannons[1]) * this.rateMul;
        // prefer a cannon that actually has somebody in front of it
        const cands = this.cannons.map((cn) => ({ cn, n: this.cs.filter((c) => !c.out && this._inCone(cn, c.x, c.z)).length }));
        cands.sort((a, b) => b.n - a.n);
        const pick = this.rng() < 0.7 ? cands[0].cn : this.rng.pick(this.cannons);
        this.cannonShot = { cn: pick, t: this.hard ? 0.85 : 1.1 };
        G.audio.tone('sine', 280, 900, this.cannonShot.t, 0.07);
      }
      return;
    }
    const cn = shot.cn;
    shot.t -= dt;
    cn.decal.material.opacity = 0.3 + Math.abs(Math.sin(shot.t * 16)) * 0.35;
    cn.barrel.rotation.z = Math.sin(shot.t * 50) * 0.05;
    if (shot.t <= 0) {
      cn.decal.material.opacity = 0;
      cn.barrel.rotation.z = 0;
      this.cannonShot = null;
      G.audio.sfx('kick'); G.audio.sfx('pop');
      this.fx.shake(0.25, 0.25);
      for (let i = 0; i < 46; i++) {
        const a = Math.atan2(cn.dz, cn.dx) + rand(-0.36, 0.36), v = rand(7, 17);
        this.fx.emit('conf', cn.x + cn.dx * 1.6, 1.1, cn.z + cn.dz * 1.6, { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: rand(1.5, 5), g: -7, drag: 1.4, life: rand(0.9, 1.7), s0: 0.34, s1: 0.28, flip: 9, color: FOAM[i % FOAM.length], floor: 0.04 });
      }
      this.fx.burst('puff', { x: cn.x + cn.dx * 1.4, y: 1, z: cn.z + cn.dz * 1.4 }, 8, { speed: 3, up: 1, life: 0.45, s0: 0.8, g: 0 });
      for (const c of this.cs) {
        if (c.out || !this._inCone(cn, c.x, c.z)) continue;
        const d = Math.hypot(c.x - cn.x, c.z - cn.z);
        const pw = 8 * clamp(1 - d / 13, 0.3, 1);
        c.vx += cn.dx * pw; c.vz += cn.dz * pw; c.vy = Math.max(c.vy, 2.6); c.grounded = false; c.stun = Math.max(c.stun, 0.35);
        c.lastHit = 'cannon'; c.lastHitT = this.roundT;
        this.stats.hits.cannon = (this.stats.hits.cannon || 0) + 1;
        if (c.isPlayer) { G.ui.pop('FWOOSH!', { x: c.x, y: 3, z: c.z }, 'cool', 0.8); this.fx.shake(0.3, 0.2); }
      }
    }
  }
  _inCone(cn, x, z) {
    const dx = x - cn.x, dz = z - cn.z, d = Math.hypot(dx, dz);
    if (d > 10.5 || d < 0.01) return false;
    return (dx * cn.dx + dz * cn.dz) / d > Math.cos(0.4);
  }

  // ================================================================ AI
  /** Decide a CPU's (or the QA autopilot's) stick + jump this frame. */
  _think(c, dt) {
    const ai = c.ai, rng = this.rng;
    const r = Math.hypot(c.x, c.z) || 0.01;
    const maxR = this.safeR - 1.35;
    // wander goal
    ai.t -= dt;
    if (ai.t <= 0) {
      ai.t = rng.range(0.9, 2.2);
      const a = Math.atan2(c.z, c.x) + rng.range(-1.3, 1.3);
      let home = ai.homeR;
      if (this.high.active && rng() < ai.aware) home = Math.min(home, 3.7);   // keep out from under the high bar
      const gr = clamp(home + rng.range(-0.9, 0.9), HUB + 0.95, Math.max(HUB + 1, maxR));
      ai.goalX = Math.cos(a) * gr; ai.goalZ = Math.sin(a) * gr;
      // now and then: a quick shove at somebody who is nearer the edge than we are
      if (ai.shoveCd <= 0 && rng() < ai.aggro) {
        let best = null, bd = 3.4;
        for (const o of this.cs) {
          if (o === c || o.out) continue;
          const or = Math.hypot(o.x, o.z), d = Math.hypot(o.x - c.x, o.z - c.z);
          if (or > r + 0.3 && or > this.safeR - 3.2 && d < bd) { bd = d; best = o; }
        }
        if (best) { ai.victim = best; ai.shoveT = rng.range(0.6, 0.95); ai.shoveCd = rng.range(3.2, 5.5); }
      }
    }
    ai.shoveCd -= dt;
    if (ai.shoveT > 0) { ai.shoveT -= dt; if (ai.shoveT <= 0 || !ai.victim || ai.victim.out || r > maxR + 0.5) { ai.victim = null; ai.shoveT = 0; } }
    let gx = ai.goalX, gz = ai.goalZ, urgent = 0;
    if (ai.victim) { gx = ai.victim.x; gz = ai.victim.z; }
    // being shoved toward the edge? slip sideways rather than arm-wrestle
    if (c.shovedT > 0) {
      c.shovedT -= dt;
      if (r > this.safeR - 2.8) {
        const side = Math.sign(c.shoveX * -c.z + c.shoveZ * c.x) || 1;
        gx = c.x + (-c.z / r) * side * 2.2 - (c.x / r) * 1.6; gz = c.z + (c.x / r) * side * 2.2 - (c.z / r) * 1.6;
      }
    }
    // get off bad tiles (after a reaction delay)
    const here = this.tileAt(c.x, c.z);
    const react = (key, on) => {
      if (!on) { ai.seen.delete(key); return false; }
      if (!ai.seen.has(key)) ai.seen.set(key, this.roundT + rng.range(0.1, 0.3) + (1 - ai.aware) * 1.2 + (rng() < 1 - ai.aware ? 0.5 : 0));
      return this.roundT >= ai.seen.get(key);
    };
    if (here && react(here, here.state === 'warn' || here.state === 'gone')) {
      let best = null, bd = 99;
      for (const t of this.tiles) {
        if (t.state !== 'ok' || t.ring > (this.safeR >= R ? 2 : this.safeR >= RINGS[1][1] ? 1 : 0)) continue;
        const d = Math.hypot(t.cx - c.x, t.cz - c.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) { gx = best.cx; gz = best.cz; urgent = 1; ai.goalX = gx; ai.goalZ = gz; ai.t = 0.8; }
    }
    const goalTile = this.tileAt(gx, gz);
    if (!urgent && !ai.victim && goalTile && goalTile.state !== 'ok') {
      // the spot we were heading for is going away: aim for the middle of the nearest sound tile instead
      let best = null, bd = 99;
      for (const t of this.tiles) {
        if (t.state !== 'ok' || t.r1 > this.safeR + 0.01) continue;
        const d = Math.hypot(t.cx - c.x, t.cz - c.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) { ai.goalX = gx = best.cx; ai.goalZ = gz = best.cz; ai.t = Math.max(ai.t, 0.9); }
    }
    let sx = gx - c.x, sz = gz - c.z;
    const gd = Math.hypot(sx, sz);
    if (gd > 0.01) { const w = urgent ? 1.6 : clamp(gd / 1.5, 0, 1); sx = (sx / gd) * w; sz = (sz / gd) * w; }
    // personal space (unless we mean to bump)
    if (!ai.victim) {
      for (const o of this.cs) {
        if (o === c || o.out) continue;
        const ox = c.x - o.x, oz = c.z - o.z, od = Math.hypot(ox, oz);
        if (od < 2.5 && od > 0.01) { const k = (2.5 - od) * 0.9; sx += (ox / od) * k; sz += (oz / od) * k; }
      }
    }
    // rolling things: step out of the lane
    for (const b of this.balls) {
      if (!react(b, true)) continue;
      const lat = (c.x - b.nx * b.off) * b.nx + (c.z - b.nz * b.off) * b.nz;
      const along = (c.x - b.x) * b.dx + (c.z - b.z) * b.dz;
      if (Math.abs(lat) < 2.0 && along > -1.2) {
        let side = Math.sign(lat) || 1;
        const px = c.x + b.nx * side * 2, pz = c.z + b.nz * side * 2;
        if (Math.hypot(px, pz) > maxR + 0.4 || Math.hypot(px, pz) < HUB + 0.6) side = -side;
        sx += b.nx * side * 2.4; sz += b.nz * side * 2.4;
      }
    }
    // confetti cannon winding up
    const shot = this.cannonShot;
    if (shot && react(shot, true) && this._inCone(shot.cn, c.x, c.z)) {
      const cn = shot.cn;
      const lat = (c.x - cn.x) * -cn.dz + (c.z - cn.z) * cn.dx;
      const side = Math.sign(lat) || 1;
      sx += -cn.dz * side * 2.2; sz += cn.dx * side * 2.2;
    }
    // respect the edge and the hub
    if (r > maxR) { const k = (r - maxR) * 3; sx -= (c.x / r) * k; sz -= (c.z / r) * k; }
    if (r < HUB + 0.9) { sx += (c.x / r) * 1.5; sz += (c.z / r) * 1.5; }
    let sl = Math.hypot(sx, sz);
    if (sl > 1) { sx /= sl; sz /= sl; sl = 1; }
    // look before you waddle: momentum first, then the heading we want
    if (c.grounded) {
      const sp = Math.hypot(c.vx, c.vz);
      if (sp > 1.2 && !this._safe(c.x + c.vx * 0.42, c.z + c.vz * 0.42) && this.solidAt(c.x, c.z) && !urgent) { sx = -c.vx / sp; sz = -c.vz / sp; }
      else if (sl > 0.15) {
        const a0 = Math.atan2(sz, sx);
        let ok = false;
        for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]) {
          const a = a0 + da;
          if (this._safe(c.x + Math.cos(a) * 1.15, c.z + Math.sin(a) * 1.15)) { sx = Math.cos(a) * sl; sz = Math.sin(a) * sl; ok = true; break; }
        }
        if (!ok) { sx = 0; sz = 0; }
      }
    }
    // jump the low sweeper
    let jump = false;
    const tti = this._tti(this.low, c, true);
    if (tti > ai.lastTti + 0.5) { ai.lead = JUMP_LEAD + this._gauss() * ai.sigma; ai.skip = rng() < ai.pMiss; }
    ai.lastTti = tti;
    if (c.grounded && c.stun <= 0 && !ai.skip && tti < ai.lead && tti > ai.lead - 0.22) {
      jump = true;
      // …unless that hop would put our head into the high bar
      if (this.high.active && r > HIGH_FROM - 0.4 && rng() < ai.aware) {
        const th = this._tti(this.high, c);
        if (th < 0.8 || th > TAU / Math.abs(this.high.speed || 1) - 0.12) jump = false;
      }
    }
    return { ix: sx, iz: sz, jump };
  }

  // ================================================================ contestants
  _updateContestants(dt) {
    const inp = G.input;
    for (const c of this.cs) {
      if (c.out) continue;
      let ix = 0, iz = 0, jump = false;
      if (c.ai) ({ ix, iz, jump } = this._think(c, dt));
      else { const a = inp.axis(); ix = a.x; iz = a.y; jump = inp.hit('a'); }
      if (c.stun > 0) { c.stun -= dt; ix = iz = 0; jump = false; }
      const max = SPEED * (c.ai && c !== this.player ? c.ai.speed : 1);
      const tvx = ix * max, tvz = iz * max;
      const has = Math.hypot(ix, iz) > 0.05;
      const acc = (c.stun > 0 ? (c.grounded ? 7.5 : 2.2) : c.grounded ? (has ? 15 : 8.5) : 4.5) * dt;
      const dvx = tvx - c.vx, dvz = tvz - c.vz, dl = Math.hypot(dvx, dvz);
      const pvx = c.vx, pvz = c.vz;
      if (dl > 1e-4) { const s = Math.min(dl, acc) / dl; c.vx += dvx * s; c.vz += dvz * s; }
      if (jump && c.grounded && c.stun <= 0) {
        c.vy = JUMP_V; c.grounded = false;
        G.audio.sfx(c.isPlayer ? 'boing' : 'hop');
        this.fx.dust(c.x, c.z, 0xfff4dc, 2);
      }
      c.x += c.vx * dt; c.z += c.vz * dt;
      // hub
      const r = Math.hypot(c.x, c.z);
      if (r < HUB + BODY * 0.7 && c.y < 0.9) {
        const nx = c.x / (r || 1), nz = c.z / (r || 1);
        c.x = nx * (HUB + BODY * 0.7); c.z = nz * (HUB + BODY * 0.7);
        const vn = c.vx * nx + c.vz * nz;
        if (vn < 0) { c.vx -= vn * nx * 1.5; c.vz -= vn * nz * 1.5; }
      }
      // vertical
      if (!c.grounded) {
        c.vy -= GRAV * dt;
        c.y += c.vy * dt;
        if (c.y <= 0 && c.vy <= 0) {
          if (c.y > -0.45 && this.solidAt(c.x, c.z)) {
            c.y = 0; c.vy = 0; c.grounded = true;
            G.audio.sfx('land'); this.fx.dust(c.x, c.z, 0xfff4dc, 2);
          }
        }
      } else if (!this.solidAt(c.x, c.z)) { c.grounded = false; c.vy = Math.min(c.vy, 0); }
      if (c.y < PIT_Y - 0.5) { this._eliminate(c); continue; }
      // a little lean so the foam looks heavy
      const ax = (c.vx - pvx) / Math.max(dt, 1e-4), az = (c.vz - pvz) / Math.max(dt, 1e-4);
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      c.m.lean.x = clamp((ax * fx + az * fz) * 0.02, -0.3, 0.3);
      c.m.lean.z = clamp(-(ax * fz - az * fx) * 0.02, -0.3, 0.3);
      const sp = Math.hypot(c.vx, c.vz);
      if (sp > 0.8 && c.stun <= 0) c.yaw += wrapAngle(Math.atan2(c.vx, c.vz) - c.yaw) * (1 - Math.exp(-6.5 * dt));
      c.bumpCd -= dt;
    }
    // bumper-car collisions
    for (let i = 0; i < this.cs.length; i++) for (let j = i + 1; j < this.cs.length; j++) {
      const a = this.cs[i], b = this.cs[j];
      if (a.out || b.out || Math.abs(a.y - b.y) > 1.3 || a.y < -0.4 || b.y < -0.4) continue;
      let dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d >= BODY * 2 || d < 1e-4) continue;
      dx /= d; dz /= d;
      const push = (BODY * 2 - d) / 2;
      a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
      const vn = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
      if (vn < 0) {
        const jimp = -(1 + 0.35) * vn / 2;
        a.vx -= jimp * dx; a.vz -= jimp * dz; b.vx += jimp * dx; b.vz += jimp * dz;
        a.shovedT = 0.6; a.shoveX = -dx; a.shoveZ = -dz; b.shovedT = 0.6; b.shoveX = dx; b.shoveZ = dz;
        if (-vn > 2.2 && a.bumpCd <= 0) {
          a.bumpCd = b.bumpCd = 0.3;
          G.audio.sfx('pop');
          this.fx.burst('star', { x: (a.x + b.x) / 2, y: 1.6, z: (a.z + b.z) / 2 }, 4, { speed: 4, up: 3, life: 0.4, s0: 0.35, color: [0xffd45a, 0xffffff] });
          if (a.isPlayer || b.isPlayer) this.fx.shake(0.12, 0.12);
        }
      }
    }
  }

  // ================================================================ per-frame
  tick(dt) {
    const rd = this.round;
    if (this.phase === 'intro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) { this.phase = 'play'; G.audio.sfx('whistle'); }
    } else if (this.phase === 'outro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this._nextRound();
    } else if (this.phase === 'play') {
      this.roundT += dt;
      const k = clamp(this.roundT / rd.time, 0, 1);
      this._updateArms(dt, k);
      this._updateTiles(dt);
      this._updateBalls(dt);
      this._updateCannons(dt);
      this._updateContestants(dt);
      const alive = this.cs.filter((c) => !c.out).length;
      let over = alive <= 1 || this.roundT >= rd.time;
      if (this.player.out) { this.playerOutT -= dt; if (this.playerOutT <= 0) over = true; }
      if (over) this._endRound();
    }
    // hud
    const p = this.player;
    const live = this.phase === 'play' && !p.out ? Math.round(2 * this.roundT) : 0;
    this.hudScore(`⭐ ${this.score + live}`);
    this.hudTime(Math.max(0, rd.time - this.roundT));
    const left = this.cs.filter((c) => !c.out).length;
    this.hudInfo(this.phase === 'play' ? `${rd.name} · ${left} still standing${this.high.active ? ' · don\'t jump under the <b>high bar</b>' : ''}` : '');
  }

  ambient(dt) {
    this.low.group.rotation.y = -this.low.angle;
    this.high.group.rotation.y = -this.high.angle;
    if (this.phase === 'wait') { this.low.angle = wrapAngle(this.low.angle + dt * 0.5); }
    for (const c of this.cs) {
      if (c.out) continue;
      c.m.root.position.set(c.x, c.y, c.z);
      c.m.root.rotation.y = c.yaw;
      const sp = Math.hypot(c.vx, c.vz);
      const st = c.cheer ? 'cheer' : (c.stun > 0 && !c.grounded) || c.y < -0.25 ? 'fall' : !c.grounded ? 'jump' : sp > 0.6 ? 'run' : 'idle';
      c.m.update(dt, sp, st);
    }
    const p = this.player;
    const showYou = !p.out && this.phase !== 'done';
    this.youRing.visible = showYou && p.y > -0.3;
    this.youRing.position.set(p.x, 0.06, p.z);
    this.youRing.rotation.z += dt * 1.5;
    this.youTag.style.display = showYou ? '' : 'none';
    if (showYou) { const sp = G.ui.project({ x: p.x, y: p.y + p.m.height + 0.35, z: p.z }, this.camera); this.youTag.style.left = `${sp.x}px`; this.youTag.style.top = `${sp.y}px`; }
    if (this.wheel.userData.spin) this.wheel.userData.spin.rotation.z += dt * 0.25;
    for (const f of this.crowd) {
      f.hype = Math.max(0, f.hype - dt);
      f.t -= dt;
      if (f.hype > 0 && f.ch.base !== 'cheer') f.ch.setBase('cheer');
      else if (f.hype <= 0 && f.ch.base === 'cheer') f.ch.setBase('move');
      if (f.t <= 0) { f.t = rand(2.5, 6); if (f.hype <= 0) f.ch.play(Math.random() < 0.5 ? 'wave' : 'hop'); }
      f.ch.update(dt, 0);
    }
    this._placeCamera();
  }

  cleanup() {
    for (const t of this.tiles) { t.mesh.geometry.dispose(); t.mesh.material.dispose(); }
    for (const c of this.cannons) { c.decal.geometry.dispose(); c.decal.material.dispose(); }
    this.lane.geometry.dispose(); this.lane.material.dispose();
    this.youRing.geometry.dispose(); this.youRing.material.dispose();
    if (this.strip) this.strip.remove();
  }
}

const _axis = new THREE.Vector3();
