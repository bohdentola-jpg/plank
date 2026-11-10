// MIDNIGHT MAINTENANCE — fix the stadium lights without getting caught by Wick,
// the lantern-headed mechanical mascot who still thinks he is the groundskeeper.
//
// It is dark: you carry a small lantern, he carries a big one. Sneak (walking is
// silent, running is not) to each fuse panel, hold the action button to open
// it, then land three splices on the green. Every repaired tower floods its
// corner of the field. Wick patrols with a visible cone of lantern light; if it
// catches you he winds up and chases. Duck into a locker, under a tarp or below
// the bleachers and he loses you. Three strikes and he walks you out.
//
// QA hooks (query string → opts): seed=N fixes the random stream.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { toon, flat, M, rbox, box, cyl, cone, sphere, lightRig, canvasTex, bake, glowSprite, GRADIENT, FONT } from '../art/kit.js';
import { PROPS } from '../art/props.js';
import { Character } from '../art/characters.js';
import { NPCS } from '../data/npcs.js';
import { teamSpec } from '../data/cast.js';
import { clamp, damp, lerp, dist, rand, TAU, wrapAngle, el, makeRng, circleBoxPush, circleCirclePush, segBox, fmtTime } from '../core/util.js';

const W = 60, D = 42;
const WALK = 4.8, RUN = 7.9;
const SPAWN = [30, 38.6];
// tx,tz = the tower; px,pz = its fuse panel
const TOWERS = [
  { id: 'NW', tx: 4.2, tz: 6.2, px: 5.7, pz: 8.5 },
  { id: 'NE', tx: 55.8, tz: 6.2, px: 54.3, pz: 8.5 },
  { id: 'SW', tx: 4.2, tz: 37.2, px: 6.3, pz: 36.6 },
  { id: 'SE', tx: 55.8, tz: 37.2, px: 53.7, pz: 36.6 },
  { id: 'BOARD', tx: 30, tz: 2.6, px: 30, pz: 9.1, board: true },
  { id: 'W', tx: 2.8, tz: 21, px: 4.4, pz: 22.3, hard: true },
  { id: 'E', tx: 57.2, tz: 21, px: 55.6, pz: 22.3, hard: true },
];
// mx,mz = where the thing is; x,z = where you stand to use it
const HIDES = [
  { kind: 'locker', mx: 16, mz: 35.8, x: 16, z: 36.95 },
  { kind: 'locker', mx: 44, mz: 35.8, x: 44, z: 36.95 },
  { kind: 'tarp', mx: 5.4, mz: 15, x: 5.4, z: 16.7 },
  { kind: 'tarp', mx: 54.6, mz: 27, x: 54.6, z: 28.7 },
  { kind: 'hatch', mx: 14, mz: 8.3, x: 14, z: 9.4 },
  { kind: 'hatch', mx: 46, mz: 8.3, x: 46, z: 9.4 },
];
const CAUGHT = ['NO CLEATS ON THE GRASS!', 'FIELD\'S CLOSED, KID.', 'DO YOU HAVE A HALL PASS?', 'THAT\'S A FIVE-YARD PENALTY.', 'WIPE YOUR FEET NEXT TIME.', 'I JUST RAKED THAT.'];
// walk/inv/chase = Wick's speeds (the chase winds up: chase → chase + ramp over a few seconds; you run at 7.9)
const CFG = {
  normal: { walk: 2.8, inv: 4.3, chase: 6.2, ramp: 2.3, range: 9, half: 0.52, windup: 0.85, zone: 0.24, periods: [1.5, 1.28, 1.08], par: 190, runNoise: 16 },
  hard: { walk: 3.4, inv: 5.0, chase: 6.8, ramp: 2.2, range: 10.5, half: 0.6, windup: 0.5, zone: 0.17, periods: [1.2, 1.02, 0.88], par: 260, runNoise: 20 },
};

function injectCss() {
  if (document.getElementById('mg-lights-css')) return;
  const s = document.createElement('style');
  s.id = 'mg-lights-css';
  s.textContent = `
  .ml-vig { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 48%, rgba(6,5,20,0) 38%, rgba(6,5,20,0.62) 100%); transition: opacity 1.2s; }
  .ml-status { position: absolute; left: 0.9em; top: 0.9em; display: flex; gap: 0.5em; align-items: center; font-weight: 900; }
  .ml-status .chip { font-size: 1.1em; }
  .ml-strike { color: #ff8f7a; letter-spacing: 0.12em; }
  .ml-splice { position: absolute; left: 50%; bottom: 4.6em; transform: translateX(-50%); width: 22em; text-align: center; }
  .ml-splice .ml-title { font-weight: 900; color: var(--cream); text-shadow: 0 0.1em 0 var(--ink); margin-bottom: 0.3em; letter-spacing: .06em; }
  .ml-bar { position: relative; height: 1.7em; background: rgba(20,14,40,0.85); border: 0.22em solid var(--cream); border-radius: 0.9em; overflow: hidden; box-shadow: 0 0.3em 0 rgba(0,0,0,0.4); }
  .ml-bar em { position: absolute; top: 0; bottom: 0; background: #6fdc6a; box-shadow: 0 0 0.6em #6fdc6a; }
  .ml-bar b { position: absolute; top: -0.2em; bottom: -0.2em; width: 0.42em; margin-left: -0.21em; background: var(--gold); border: 0.12em solid var(--ink); border-radius: 0.3em; }
  .ml-bar.bad { animation: mlshake .25s; border-color: #ff8f7a; }
  @keyframes mlshake { 25% { transform: translateX(-0.3em); } 75% { transform: translateX(0.3em); } }
  .ml-pips { margin-top: 0.3em; font-size: 1.2em; letter-spacing: 0.3em; color: var(--gold); text-shadow: 0 0.1em 0 var(--ink); }
  .ml-hold { position: absolute; transform: translate(-50%, -50%); width: 3.2em; height: 3.2em; border-radius: 50%; border: 0.3em solid rgba(255,244,220,0.35); }
  .ml-hold i { position: absolute; inset: -0.3em; border-radius: 50%; }
  .ml-mark { position: absolute; transform: translate(-50%, -50%); font-size: 1.5em; filter: drop-shadow(0 0 0.3em rgba(0,0,0,0.8)); pointer-events: none; }
  .ml-mark.wick { font-size: 1.7em; }
  .ml-peek { position: absolute; transform: translate(-50%, -100%); font-size: 1.4em; animation: bob2 .6s ease-in-out infinite alternate; }`;
  document.head.appendChild(s);
}

export default class MidnightMaintenance extends Minigame {
  static meta = {
    id: 'lights', title: 'Midnight Maintenance', icon: '🔦',
    blurb: 'The stadium lights have been out for years. <b>Fix every fuse panel</b> — hold the button to open one, then land three splices on the green. <b>Wick</b> the mechanical mascot still patrols the grass: stay out of his lantern beam, walk (running is loud), and hide if he comes looking. Three strikes and he walks you out.',
    controls: [['move', 'sneak'], ['b', 'run (noisy!)'], ['a', 'repair · hide']],
    scoreLabel: 'points', goals: [200, 400, 560], hasHard: true, music: 'night',
  };

  // ================================================================ scene
  setup(opts) {
    injectCss();
    this.rng = makeRng(opts.seed ? Math.round(opts.seed) : (Math.random() * 1e9) | 0);
    this.cfg = this.hard ? CFG.hard : CFG.normal;
    this.camera.fov = 22;
    this.rig = lightRig(this.scene, 'night', { shadowSize: 20, fog: [30, 84] });
    this.scene.background.set(0x0a0920);
    this.scene.fog.color.set(0x0a0920);
    this.rig.hemi.color.set(0x6a74cc); this.rig.hemi.groundColor.set(0x1c1838);
    this.baseHemi = 0.5;
    this.rig.hemi.intensity = this.baseHemi;
    this.rig.sun.color.set(0x9fb4ff); this.rig.sun.intensity = 0.34;
    this.boxes = []; this.rounds = [];
    this._buildStadium();
    this._buildTowers();
    this._buildHides();
    this._buildActors();
    this._buildCarts();
    this._buildHud();
    this.strikes = 0;
    this.fixed = 0;
    this.repair = null;
    this.ending = null;
    this.stats = { alerts: 0, chases: 0, noises: 0, misses: 0, hides: 0 };
    this.cam = { x: SPAWN[0], z: SPAWN[1] - 3, zoom: 1 };
    this._placeCamera(0);
    this._drawBoard();
  }

  _solid(x, z, w, d, los = false) { const b = { x, z, w, d, los }; this.boxes.push(b); return b; }

  _buildStadium() {
    const s = this.scene;
    // ground: field, track, apron
    const PPU = 16;
    const tex = canvasTex(W * PPU, D * PPU, (c) => {
      const R = (x, z, w, d, col) => { c.fillStyle = col; c.fillRect(x * PPU, z * PPU, w * PPU, d * PPU); };
      R(0, 0, W, D, '#9c96a6');
      const r = makeRng(3);
      for (let i = 0; i < 500; i++) { c.fillStyle = ['#8f899a', '#a8a2b2', '#8a8494'][i % 3]; c.fillRect(r() * W * PPU, r() * D * PPU, 3 + r() * 5, 2 + r() * 3); }
      R(5.5, 8.6, 49, 25.4, '#b08a6a');                    // track
      for (let i = 0; i < 10; i++) R(12 + i * 3.6, 10, 3.6, 22, i % 2 ? '#6fae54' : '#7dbb60');
      R(8, 10, 4, 22, '#f08a24'); R(48, 10, 4, 22, '#3b2148');
      c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 0.16 * PPU;
      c.strokeRect(8 * PPU, 10 * PPU, 44 * PPU, 22 * PPU);
      for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo((12 + i * 3.6) * PPU, 10 * PPU); c.lineTo((12 + i * 3.6) * PPU, 32 * PPU); c.stroke(); }
      for (let i = 1; i < 10; i++) for (const z of [13.5, 28.5]) { c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect((12 + i * 3.6 - 0.25) * PPU, z * PPU, 0.5 * PPU, 0.12 * PPU); }
      c.fillStyle = 'rgba(255,244,220,0.9)'; c.font = `900 ${2.4 * PPU}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save(); c.translate(10 * PPU, 21 * PPU); c.rotate(-Math.PI / 2); c.fillText('LANTERNS', 0, 0); c.restore();
      c.save(); c.translate(50 * PPU, 21 * PPU); c.rotate(Math.PI / 2); c.fillText('HOLLOW', 0, 0); c.restore();
      c.beginPath(); c.arc(30 * PPU, 21 * PPU, 2.4 * PPU, 0, TAU); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
      c.fillStyle = 'rgba(255,212,90,0.85)'; c.beginPath(); c.arc(30 * PPU, 21 * PPU, 1.1 * PPU, 0, TAU); c.fill();
      // leaves that nobody has raked since… well, Wick rakes. Some.
      for (let i = 0; i < 300; i++) { c.fillStyle = ['#e8842c', '#d4502f', '#f2b632'][i % 3]; c.beginPath(); c.ellipse(r() * W * PPU, r() * D * PPU, 2.6, 1.6, r() * 3, 0, TAU); c.fill(); }
      R(27, 39.4, 6, 2.6, '#7d7788');
    });
    tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshToonMaterial({ map: tex, gradientMap: GRADIENT }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, D / 2); ground.receiveShadow = true;
    s.add(ground);
    this.groundTex = tex;

    const st = new THREE.Group();
    const put = (obj, x, z, ry = 0) => { obj.position.x += x; obj.position.z += z; if (ry) obj.rotation.y += ry; st.add(obj); return obj; };
    // walls
    const wallC = 0x5a5470;
    put(PROPS.wallSeg({ w: W, h: 5, color: wallC }), W / 2, 0.6);
    put(PROPS.wallSeg({ w: D, h: 3.2, color: wallC }), 0.3, D / 2, Math.PI / 2);
    put(PROPS.wallSeg({ w: D, h: 3.2, color: wallC }), W - 0.3, D / 2, Math.PI / 2);
    put(PROPS.wallSeg({ w: 27, h: 1.1, color: wallC }), 13.5, D - 0.3);
    put(PROPS.wallSeg({ w: 27, h: 1.1, color: wallC }), 46.5, D - 0.3);
    this._solid(W / 2, 0.6, W, 1.2, true); this._solid(0.3, D / 2, 0.8, D, true); this._solid(W - 0.3, D / 2, 0.8, D, true);
    this._solid(13.5, D - 0.6, 27, 1.6); this._solid(46.5, D - 0.6, 27, 1.6);
    this._solid(30, D + 0.4, 6, 0.8);
    // bleachers
    for (const x of [18, 42]) { put(PROPS.bleachers({ len: 18, rows: 5 }), x, 8.0); this._solid(x, 6.5, 18, 3.9, true); }
    // sideline furniture
    for (const x of [20, 24.5, 35.5, 40]) { put(PROPS.bench({}), x, 33.6); this._solid(x, 33.6, 2.2, 0.7); }
    for (const x of [28.4, 31.6]) { put(PROPS.waterCooler(), x, 33.7); this._solid(x, 33.7, 1.2, 0.8); }
    for (const [x, z] of [[8.7, 21], [51.3, 21]]) { put(PROPS.goalpost({ w: 4.4, pad: true }), x, z, Math.PI / 2); this.rounds.push({ x, z, r: 0.34 }); }
    for (const [x, z] of [[22, 37.4], [23.6, 37.6], [36.4, 36.8]]) { put(PROPS.tackleDummy(), x, z); this.rounds.push({ x, z, r: 0.45 }); }
    put(PROPS.shed({ wall: 0x4a6f8a, roof: 0x3b3550 }), 39.6, 39.6); this._solid(39.6, 39.6, 3.2, 2.8, true);
    put(PROPS.crate({ s: 1.2 }), 11, 39.9); this._solid(11, 39.9, 1.2, 1.2);
    put(PROPS.crate({ s: 1.0 }), 12.4, 40.1); this._solid(12.4, 40.1, 1.0, 1.0);
    for (const [x, z] of [[26.4, 40.6], [33.6, 40.6]]) st.add(M(rbox(0.7, 2.2, 0.7, 0.1), toon(0x6a6480), x, 1.1, z));
    // under-bleacher crawl hatches
    for (const h of HIDES.filter((k) => k.kind === 'hatch')) {
      st.add(M(box(2.2, 1.15, 0.12), toon(0x15122a), h.mx, 0.58, h.mz + 0.09));
      st.add(M(box(2.5, 0.14, 0.2), toon(0xd9a441), h.mx, 1.22, h.mz + 0.12));
      for (const sx of [-1, 1]) st.add(M(box(0.14, 1.2, 0.2), toon(0xd9a441), h.mx + sx * 1.18, 0.6, h.mz + 0.12));
    }
    bake(st);
    s.add(st);

    // scoreboard (the fifth "tower")
    this.board = PROPS.scoreboard({ w: 11, h: 4.2 });
    this.board.position.set(30, 0, 2.6);
    s.add(this.board);
    this._solid(30, 2.6, 11, 1.0, true);
  }

  _buildTowers() {
    const s = this.scene;
    this.towers = TOWERS.filter((t) => !t.hard || this.hard).map((def) => {
      const t = { ...def, fixed: false, glow: 0 };
      const yaw = Math.atan2(30 - def.tx, 21 - def.tz);
      if (!def.board) {
        t.off = PROPS.lightTower({ h: 10 }); t.on = PROPS.lightTower({ h: 10, on: true });
        for (const m of [t.off, t.on]) { m.position.set(def.tx, 0, def.tz); m.rotation.y = yaw; s.add(m); }
        t.on.visible = false;
        this.rounds.push({ x: def.tx, z: def.tz, r: 0.5 });
      } else {
        // lamp bars along the top of the scoreboard
        t.on = new THREE.Group();
        for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) t.on.add(new THREE.Mesh(sphere(0.32, 8, 6), flat(0xfff6d8)).translateX(sx * (2.4 + i * 0.9)).translateY(8.55).translateZ(0.3));
        const gl = glowSprite(0xfff0b8, 12, 0.5); gl.position.set(0, 8.4, 1); t.on.add(gl);
        t.on.position.set(def.tx, 0, def.tz);
        t.on.visible = false;
        s.add(t.on);
      }
      // the light itself (created dark so the shader never has to recompile mid-game)
      const lx = def.board ? 30 : def.tx + Math.sin(yaw) * 4, lz = def.board ? 12 : def.tz + Math.cos(yaw) * 4;
      t.light = new THREE.PointLight(0xfff0cf, 0, 44, 1.2);
      t.light.position.set(lx, 9.5, lz);
      s.add(t.light);
      t.lx = lx; t.lz = lz;
      // a soft beam so "on" reads from across the field
      const beam = new THREE.Mesh(new THREE.ConeGeometry(7.5, 10, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.position.set(def.board ? 30 : def.tx + Math.sin(yaw) * 5.5, 5, def.board ? 11.5 : def.tz + Math.cos(yaw) * 5.5);
      beam.renderOrder = 6;
      s.add(beam);
      t.beam = beam;
      // fuse panel
      const p = new THREE.Group();
      p.add(M(cyl(0.07, 0.09, 1.0, 6), toon(0x4a4a58), 0, 0.5, 0));
      p.add(M(rbox(0.95, 1.2, 0.36, 0.06), toon(0x6a7480), 0, 1.45, 0));
      p.add(M(box(0.6, 0.12, 0.05), toon(0xffd45a), 0, 1.85, 0.19));
      p.add(M(box(0.1, 0.5, 0.1), toon(0x2b1a33), 0.25, 1.3, 0.22, { rz: 0.5 }));
      bake(p);
      t.ledRed = new THREE.Mesh(sphere(0.13, 8, 6), flat(0xff4a3c)); t.ledRed.position.set(-0.22, 1.42, 0.2);
      t.ledGreen = new THREE.Mesh(sphere(0.13, 8, 6), flat(0x6fdc6a)); t.ledGreen.position.set(-0.22, 1.42, 0.2); t.ledGreen.visible = false;
      t.halo = glowSprite(0xff4a3c, 2.6, 0.55); t.halo.position.set(-0.22, 1.42, 0.35);
      p.add(t.ledRed, t.ledGreen, t.halo);
      p.position.set(def.px, 0, def.pz);
      s.add(p);
      t.panel = p;
      t.sparkT = rand(0.5, 2);
      this.rounds.push({ x: def.px, z: def.pz, r: 0.42 });
      t.mark = el('div.ml-mark', '⚡');
      return t;
    });
  }

  _buildHides() {
    const s = this.scene;
    this.hides = HIDES.map((def) => {
      const h = { ...def, shake: 0 };
      if (def.kind === 'locker') {
        h.obj = PROPS.locker({ n: 4, color: 0x2a6f77 });
        h.obj.position.set(def.mx, 0, def.mz);
        s.add(h.obj);
        this._solid(def.mx, def.mz, 3.4, 0.8, true);
      } else if (def.kind === 'tarp') {
        h.obj = new THREE.Group();
        h.obj.add(M(rbox(3.6, 0.62, 2.2, 0.28), toon(0x3f6fb5), 0, 0.31, 0));
        h.obj.add(M(rbox(1.6, 0.3, 1.2, 0.14), toon(0x4f7fc5), -0.6, 0.66, 0.1));
        h.obj.add(M(cyl(0.3, 0.3, 3.4, 10), toon(0x35609f), 0, 0.3, -1.25, { rz: Math.PI / 2 }));
        bake(h.obj);
        h.obj.position.set(def.mx, 0, def.mz);
        s.add(h.obj);
        this._solid(def.mx, def.mz - 0.2, 3.6, 2.4);
      }
      h.sign = glowSprite(0x9be8ff, 1.1, 0.22);
      h.sign.position.set(def.x, 0.3, def.z);
      s.add(h.sign);
      return h;
    });
  }

  _buildActors() {
    const s = this.scene;
    // you
    const ch = new Character(teamSpec('captain'));
    ch.setPos(SPAWN[0], SPAWN[1]);
    ch.face(Math.PI);
    s.add(ch.root);
    const lantern = new THREE.Group();
    lantern.add(new THREE.Mesh(cyl(0.07, 0.09, 0.2, 6), flat(0xffe9a8)));
    lantern.add(M(cone(0.1, 0.08, 6), toon(0x2b1a33), 0, 0.14, 0));
    lantern.add(M(cyl(0.1, 0.1, 0.03, 6), toon(0x2b1a33), 0, -0.11, 0));
    lantern.position.set(0, -0.22, 0.05);
    if (ch.armR && ch.armR.userData.end) ch.armR.userData.end.add(lantern);
    const pl = new THREE.PointLight(0xffd9a0, 15, 11, 1.6);
    s.add(pl);
    const pglow = glowSprite(0xffd9a0, 2.2, 0.4);
    s.add(pglow);
    this.p = { ch, x: SPAWN[0], z: SPAWN[1], vx: 0, vz: 0, yaw: Math.PI, sp: 0, hidden: null, caughtT: 0, holdT: 0, noiseT: 0, light: pl, glow: pglow, grace: 0 };

    // Wick
    const wch = new Character(NPCS.wick.spec);
    this._routes();
    const wx = 30, wz = 15;
    wch.setPos(wx, wz);
    s.add(wch.root);
    const wl = new THREE.PointLight(0xffa64a, 22, 13, 1.6);
    s.add(wl);
    const coneGeo = new THREE.CircleGeometry(1, 22, -this.cfg.half, this.cfg.half * 2);
    const decal = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xffc65a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    decal.rotation.x = -Math.PI / 2;
    decal.scale.setScalar(this.cfg.range);
    decal.renderOrder = 5;
    s.add(decal);
    this.w = { ch: wch, x: wx, z: wz, yaw: Math.PI / 2, state: 'look', t: 1.2, lookYaw: Math.PI / 2, after: 'return', wp: 0, chaseT: 0, light: wl, decal, lost: 0, blind: 0, sp: 0, stuck: 0, detour: null, lastSeen: { x: wx, z: wz }, knows: null, tick: 0, tickN: 0, headUp: 0 };
    this.w.mark = el('div.ml-mark.wick', '🏮');
  }

  _buildCarts() {
    this.carts = [];
    if (!this.hard) return;
    for (const [x, z] of [[22, 22.5], [38, 15.5], [31, 27.2]]) {
      const g = new THREE.Group();
      g.add(M(rbox(1.5, 0.7, 1.1, 0.08), toon(0x8f9aa6), 0, 0.7, 0));
      for (const [wx, wz] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]]) g.add(M(cyl(0.16, 0.16, 0.1, 8), toon(0x2b1a33), wx, 0.18, wz, { rx: Math.PI / 2 }));
      for (let i = 0; i < 5; i++) g.add(M(sphere(0.2, 8, 6), toon(0x8a4a26), -0.45 + (i % 3) * 0.45, 1.12 + Math.floor(i / 3) * 0.2, (i % 2) * 0.3 - 0.15, { sz: 1.4 }));
      bake(g);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.carts.push({ g, x, z, vx: 0, vz: 0, r: 0.85, cd: 0 });
    }
  }

  _buildHud() {
    this.vig = el('div.ml-vig');
    this.hStrike = el('span.chip.ml-strike');
    this.hClock = el('span.chip');
    this.hStatus = el('div.ml-status', this.hStrike, this.hClock);
    this.hZone = el('em'); this.hNeedle = el('b');
    this.hBar = el('div.ml-bar', this.hZone, this.hNeedle);
    this.hTitle = el('div.ml-title'); this.hPips = el('div.ml-pips');
    this.hSplice = el('div.ml-splice.hidden', this.hTitle, this.hBar, this.hPips);
    this.hHoldFill = el('i');
    this.hHold = el('div.ml-hold.hidden', this.hHoldFill);
    this.hPeek = el('div.ml-peek.hidden', '👀');
    this.hud.append(this.vig, this.hStatus, this.hSplice, this.hHold, this.hPeek, this.w.mark);
    for (const t of this.towers) this.hud.appendChild(t.mark);
  }

  _drawBoard() {
    const all = this.fixed >= this.towers.length;
    const lit = this.towers.find((t) => t.board && t.fixed);
    this.board.userData.draw(all ? [{ t: 'LIGHTS ON', c: '#9be8ff' }, 'WELCOME BACK'] : [`LIGHTS ${this.fixed}/${this.towers.length}`, { t: this.strikes ? `STRIKES ${'X'.repeat(this.strikes)}` : 'FIELD CLOSED', c: this.strikes ? '#ff8f7a' : '#ffb53c' }], { color: lit ? '#ffd45a' : '#b9772c' });
  }

  // ================================================================ helpers
  _move(e, dx, dz, r) {
    e.x += dx; e.z += dz;
    for (let it = 0; it < 2; it++) {
      for (const b of this.boxes) {
        if (Math.abs(e.x - b.x) > b.w / 2 + r || Math.abs(e.z - b.z) > b.d / 2 + r) continue;
        const p = circleBoxPush(e.x, e.z, r, b);
        if (p) { e.x += p.x; e.z += p.z; }
      }
      for (const c of this.rounds) { const p = circleCirclePush(e.x, e.z, r, c.x, c.z, c.r); if (p) { e.x += p.x; e.z += p.z; } }
    }
    e.x = clamp(e.x, 1.2, W - 1.2); e.z = clamp(e.z, 1.8, D - 0.6);
  }
  _los(ax, az, bx, bz) {
    for (const b of this.boxes) if (b.los && segBox(ax, az, bx, bz, b)) return false;
    return true;
  }
  /** Is the player standing where a repaired tower is flooding the grass? */
  _inLight(x, z) {
    for (const t of this.towers) if (t.fixed && dist(x, z, t.lx, t.lz) < 12) return true;
    return false;
  }
  /** Can Wick see the player right now? loose = the forgiving version used once he is already alerted. */
  _sees(loose = false) {
    const w = this.w, p = this.p;
    if (p.hidden || p.grace > 0 || w.blind > 0) return false;
    const d = dist(w.x, w.z, p.x, p.z);
    if (d < 1.5) return true;
    let range = this.cfg.range + (this._inLight(p.x, p.z) ? 2 : 0), half = this.cfg.half;
    if (loose) { range *= 1.2; half *= 1.35; }
    if (d > range) return false;
    const a = Math.abs(wrapAngle(Math.atan2(p.x - w.x, p.z - w.z) - w.yaw));
    if (a > half) return false;
    return this._los(w.x, w.z, p.x, p.z);
  }

  /** Something made a sound. Wick comes to look if he is close enough and not already after you. */
  _noise(x, z, radius, kind) {
    const w = this.w;
    this.stats.noises++;
    this.fx.emit('ring', x, 0.5, z, { life: 0.5, s0: 0.6, s1: Math.min(6, radius * 0.5), color: kind === 'step' ? 0x9aa3c8 : 0xffd45a });
    if (this.ending) return;
    if (!['patrol', 'look', 'investigate', 'return', 'admire'].includes(w.state)) return;
    if (dist(w.x, w.z, x, z) > radius) return;
    if (w.state === 'investigate' && kind === 'step' && dist(w.tx, w.tz, x, z) < 4) { w.tx = x; w.tz = z; return; }
    w.state = 'investigate'; w.tx = x; w.tz = z; w.t = 14; w.admire = kind === 'fixed';
    if (kind !== 'step' || !w.huh) { G.ui.pop('?', { x: w.x, y: 3.6, z: w.z }, 'white', 0.9); w.huh = 1.5; }
  }

  // ================================================================ player
  _context() {
    const p = this.p;
    let panel = null, pd = 1.75;
    for (const t of this.towers) { if (t.fixed) continue; const d = dist(p.x, p.z, t.px, t.pz + 0.5); if (d < pd) { pd = d; panel = t; } }
    let hide = null, hd = 1.5;
    for (const h of this.hides) { const d = dist(p.x, p.z, h.x, h.z); if (d < hd) { hd = d; hide = h; } }
    return { panel, hide };
  }

  _player(dt) {
    const inp = G.input, p = this.p, w = this.w;
    p.grace = Math.max(0, p.grace - dt);
    if (p.caughtT > 0) {
      p.caughtT -= dt;
      p.sp = 0;
      if (p.caughtT <= 0) this._respawn();
      return;
    }
    if (p.hidden) {
      p.hidT += dt;
      const a = inp.axis();
      if (p.hidT > 0.35 && (inp.take('a') || Math.hypot(a.x, a.y) > 0.75)) this._unhide();
      return;
    }
    if (this.repair) { this._repairTick(dt); return; }
    const a = inp.axis();
    const mag = Math.hypot(a.x, a.y);
    const run = inp.running() && mag > 0.1;
    const max = run ? RUN : WALK;
    p.vx = damp(p.vx, a.x * max, 14, dt); p.vz = damp(p.vz, a.y * max, 14, dt);
    const px = p.x, pz = p.z;
    this._move(p, p.vx * dt, p.vz * dt, 0.42);
    p.sp = Math.hypot(p.x - px, p.z - pz) / Math.max(dt, 1e-4);
    if (Math.hypot(p.vx, p.vz) > 0.5) p.yaw = wrapAngle(p.yaw + wrapAngle(Math.atan2(p.vx, p.vz) - p.yaw) * (1 - Math.exp(-16 * dt)));
    // running is loud
    if (run && p.sp > 5.6) {
      p.noiseT -= dt;
      if (p.noiseT <= 0) { p.noiseT = 0.42; this._noise(p.x, p.z, this.cfg.runNoise, 'step'); G.audio.sfx('step', 1.3); this.fx.dust(p.x, p.z, 0x6a6480, 1); }
    } else p.noiseT = Math.min(p.noiseT, 0.15);
    // use things
    const ctx = this._context();
    this.ctx = ctx;
    if (ctx.panel) {
      if (inp.down('a')) {
        p.holdT += dt;
        if (p.holdT >= 0.45) this._startRepair(ctx.panel);
      } else p.holdT = 0;
    } else {
      p.holdT = 0;
      if (ctx.hide && inp.take('a')) this._hide(ctx.hide);
    }
  }

  _hide(h) {
    const p = this.p, w = this.w;
    p.hidden = h; p.hidT = 0; p.vx = p.vz = 0; p.sp = 0;
    p.x = h.x; p.z = h.z;
    h.shake = 0.4;
    this.stats.hides++;
    G.audio.sfx(h.kind === 'tarp' ? 'page' : 'door');
    this.fx.dust(p.x, p.z, 0x6a6480, 2);
    if (w.state === 'chase' || w.state === 'alert') {
      const d = dist(w.x, w.z, p.x, p.z);
      if (d < 4.5 && this._los(w.x, w.z, p.x, p.z)) { w.knows = h; if (w.state !== 'chase') w.chaseT = 0; w.state = 'chase'; }       // he watched you climb in
      else { w.state = 'investigate'; w.tx = w.lastSeen.x; w.tz = w.lastSeen.z; w.t = 10; w.admire = false; w.knows = null; G.ui.pop('?', { x: w.x, y: 3.6, z: w.z }, 'white', 0.9); }
    }
  }
  _unhide() {
    const p = this.p;
    if (!p.hidden) return;
    p.hidden.shake = 0.3;
    p.hidden = null;
    G.audio.sfx('door');
  }

  _startRepair(t) {
    const p = this.p;
    p.holdT = 0; p.vx = p.vz = 0; p.sp = 0;
    p.yaw = Math.atan2(t.px - p.x, t.pz - p.z);
    this.repair = { t, beat: t.beats || 0, phase: this.rng() * 2, x: 0, zone: 0.5, width: this.cfg.zone, period: this.cfg.periods[0], armed: false, lock: 0, time: 0 };
    this._newBeat();
    G.audio.sfx('door');
    p.ch.setBase('hold');
  }
  _newBeat() {
    const r = this.repair;
    r.period = this.cfg.periods[Math.min(2, r.beat)];
    r.width = this.cfg.zone * (1 - r.beat * 0.08);
    r.zone = this.rng.range(0.16, 0.84);
    this.hZone.style.left = `${(r.zone - r.width / 2) * 100}%`;
    this.hZone.style.width = `${r.width * 100}%`;
    this.hTitle.textContent = `SPLICE ${Math.min(3, r.beat + 1)} / 3`;
    this.hPips.textContent = '●'.repeat(r.beat) + '○'.repeat(3 - r.beat);
  }
  _endRepair() {
    if (this.repair) this.repair.t.beats = this.repair.beat;
    this.repair = null;
    this.p.ch.setBase('move');
  }
  _repairTick(dt) {
    const inp = G.input, r = this.repair, p = this.p;
    r.time += dt;
    if (!inp.down('a')) r.armed = true;
    const a = inp.axis();
    if (Math.hypot(a.x, a.y) > 0.6 || inp.take('b')) { this._endRepair(); return; }
    r.lock = Math.max(0, r.lock - dt);
    r.phase += (dt / r.period) * 2;
    const u = r.phase % 2;
    r.x = u < 1 ? u : 2 - u;
    if (r.armed && r.lock <= 0 && inp.take('a')) {
      const t = r.t;
      if (Math.abs(r.x - r.zone) <= r.width / 2 + 0.012) {
        r.beat++;
        G.audio.sfx('zap');
        G.audio.tone('triangle', 660 + r.beat * 220, 880 + r.beat * 220, 0.12, 0.09);
        this.fx.sparkle({ x: t.px, y: 1.6, z: t.pz + 0.3 }, 0xfff2a8, 10);
        G.ui.pop(['ZAP!', 'ZZT!', 'CLICK!'][r.beat - 1] || 'ZAP!', { x: t.px, y: 2.6, z: t.pz }, 'small', 0.7);
        p.ch.play('nod', 0.3);
        if (r.beat >= 3) { this._endRepair(); this._fix(t); return; }
        this._newBeat();
      } else {
        this.stats.misses++;
        G.audio.sfx('buzz');
        r.lock = 0.6;
        this.hBar.classList.remove('bad'); void this.hBar.offsetWidth; this.hBar.classList.add('bad');
        this.fx.burst('spark', { x: t.px, y: 1.6, z: t.pz + 0.3 }, 5, { speed: 3, up: 2, life: 0.4, s0: 0.3, color: 0xff8f7a });
        this._noise(t.px, t.pz, 15, 'buzz');
        this._newBeat();
      }
    }
  }

  _fix(t) {
    t.fixed = true;
    this.fixed++;
    t.ledRed.visible = false; t.ledGreen.visible = true;
    t.halo.material.color.set(0x6fdc6a);
    if (t.off) t.off.visible = false;
    t.on.visible = true;
    G.audio.sfx('lightOn'); G.audio.sfx('power');
    this.fx.sparkle({ x: t.px, y: 2, z: t.pz }, 0xfff2a8, 16);
    this.fx.shake(0.2, 0.3);
    G.ui.pop(`LIGHT ${this.fixed}/${this.towers.length}!`, { x: t.px, y: 3.2, z: t.pz }, 'big', 1.3);
    this._drawBoard();
    if (this.fixed >= this.towers.length) { this._allFixed(); return; }
    this._routes();
    this.w.wp = 0;
    this._noise(t.px, t.pz, 26, 'fixed');
  }

  _allFixed() {
    const w = this.w;
    this.ending = 'win';
    this.endT = 3.2;
    w.state = 'final';
    w.knows = null;
    G.audio.sfx('crowd', 0.6);
    G.ui.banner('LIGHTS ON!', 'The old stadium hums back to life.', { dur: 2.6, cls: 'small' });
    this.fx.confetti({ x: this.p.x, y: 3, z: this.p.z }, 30);
    this.p.ch.play('celebrate');
  }

  _catch() {
    const p = this.p, w = this.w;
    if (this.repair) this._endRepair();
    if (p.hidden) this._unhide();
    this.strikes++;
    w.state = 'catch'; w.t = 1.9; w.knows = null; w.lost = 0;
    p.caughtT = 1.7; p.vx = p.vz = 0; p.sp = 0;
    p.yaw = Math.atan2(w.x - p.x, w.z - p.z);
    p.ch.play('flinch'); p.ch.setExpr('wide', 1.6);
    w.ch.play('shake', 0.9);
    G.audio.sfx('alarm');
    G.audio.tone('sawtooth', 196, 190, 0.34, 0.1); G.audio.tone('sawtooth', 247, 240, 0.34, 0.08, 0.02);
    G.audio.tone('sawtooth', 196, 190, 0.3, 0.1, 0.45);
    this.fx.shake(0.3, 0.3);
    G.ui.pop(this.rng.pick(CAUGHT), { x: w.x, y: 4.2, z: w.z }, 'big bad', 1.7);
    G.ui.pop(`STRIKE ${this.strikes}`, { x: p.x, y: 2.8, z: p.z }, 'bad', 1.4);
    this._drawBoard();
    if (this.strikes >= 3) { this.ending = 'out'; this.endT = 2.1; }
  }

  _respawn() {
    const p = this.p, w = this.w;
    if (this.ending) return;
    this.fx.burst('puff', { x: p.x, y: 1, z: p.z }, 8, { speed: 2.2, up: 1.6, life: 0.45, s0: 0.6, g: 0, color: 0xc9c2e0 });
    p.x = SPAWN[0]; p.z = SPAWN[1]; p.yaw = Math.PI; p.grace = 2.2;
    this.fx.burst('puff', { x: p.x, y: 1, z: p.z }, 8, { speed: 2.2, up: 1.6, life: 0.45, s0: 0.6, g: 0, color: 0xc9c2e0 });
    p.ch.setBase('move');
    w.blind = 2.5;
    this.cam.x = p.x; this.cam.z = p.z - 3;
  }

  // ================================================================ Wick
  /** Walk toward a point; returns true on arrival. */
  _goto(tx, tz, speed, dt, arrive = 0.4) {
    const w = this.w;
    let gx = tx, gz = tz;
    if (w.detour) { w.detour.t -= dt; gx = w.detour.x; gz = w.detour.z; if (w.detour.t <= 0 || dist(w.x, w.z, gx, gz) < 0.6) w.detour = null; }
    const dx = gx - w.x, dz = gz - w.z, d = Math.hypot(dx, dz);
    if (!w.detour && d < arrive) { w.sp = 0; return true; }
    const step = Math.min(d, speed * dt);
    const px = w.x, pz = w.z;
    this._move(w, (dx / (d || 1)) * step, (dz / (d || 1)) * step, 0.6);
    const moved = Math.hypot(w.x - px, w.z - pz);
    w.sp = moved / Math.max(dt, 1e-4);
    const want = Math.atan2(dx, dz);
    w.yaw += wrapAngle(want - w.yaw) * (1 - Math.exp(-(speed > 5 ? 9 : 4.5) * dt));
    // wedged against something? step around it
    if (moved < step * 0.35) { w.stuck += dt; if (w.stuck > 0.45 && !w.detour) { const side = Math.random() < 0.5 ? 1 : -1; w.detour = { x: w.x + (-dz / (d || 1)) * side * 3.5 + (dx / (d || 1)) * 1.5, z: w.z + (dx / (d || 1)) * side * 3.5 + (dz / (d || 1)) * 1.5, t: 1.3 }; w.stuck = 0; } } else w.stuck = Math.max(0, w.stuck - dt);
    return false;
  }

  /**
   * Wick's rounds: a stop a few paces in front of every panel that is still
   * broken (in order around the field), so the fewer lights are left, the more
   * often he is standing next to the one you need.
   */
  _routes() {
    const pts = [];
    for (const t of this.towers) {
      if (t.fixed) continue;
      const dx = 30 - t.px, dz = 21 - t.pz, d = Math.hypot(dx, dz) || 1;
      pts.push({ x: t.px + (dx / d) * 5.6, z: t.pz + (dz / d) * 5.6, lx: t.px, lz: t.pz, a: Math.atan2(t.pz - 21, t.px - 30) });
    }
    pts.sort((a, b) => a.a - b.a);
    if (pts.length <= 2) pts.push({ x: 30, z: 21, lx: 30, lz: 40, a: 9 });     // a breather at midfield
    if (pts.length === 2 && pts[0].x !== 30) pts.splice(1, 0, { x: 30, z: 21, lx: 30, lz: 0, a: 9 });
    this.pts = pts;
    return pts;
  }
  _nearestWp() {
    const w = this.w;
    let bi = 0, bd = 1e9;
    this.pts.forEach((q, i) => { const d = dist(w.x, w.z, q.x, q.z); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }

  _wick(dt) {
    const w = this.w, p = this.p, cfg = this.cfg;
    const d = dist(w.x, w.z, p.x, p.z);
    w.blind = Math.max(0, w.blind - dt);
    w.huh = Math.max(0, (w.huh || 0) - dt);
    w.headUp = damp(w.headUp, w.state === 'admire' || w.state === 'final' ? 1 : 0, 5, dt);
    const sees = this._sees(false);
    if (sees) { w.lastSeen.x = p.x; w.lastSeen.z = p.z; }
    switch (w.state) {
      case 'patrol': {
        if (!this.pts.length) { w.sp = 0; break; }
        const q = this.pts[w.wp % this.pts.length];
        if (this._goto(q.x, q.z, cfg.walk, dt)) {
          // have a good look at the panel he came to check
          w.state = 'look'; w.t = this.rng.range(1.7, 2.5); w.after = 'patrol';
          w.lookYaw = Math.atan2(q.lx - w.x, q.lz - w.z);
          w.wp = (w.wp + 1) % this.pts.length;
        }
        break;
      }
      case 'look': {
        w.t -= dt; w.sp = 0;
        const goal = w.lookYaw + Math.sin(w.t * 2.5) * 0.95;
        w.yaw += wrapAngle(goal - w.yaw) * (1 - Math.exp(-3.5 * dt));
        if (w.t <= 0) { w.state = w.after || 'patrol'; w.after = null; }
        break;
      }
      case 'investigate': {
        w.t -= dt;
        if (this._goto(w.tx, w.tz, cfg.inv, dt, 1.5) || w.t <= 0) {
          if (w.admire) { w.state = 'admire'; w.t = 2.4; G.ui.pop('…', { x: w.x, y: 3.8, z: w.z }, 'white', 1.2); }
          else { w.state = 'look'; w.t = 2.4; w.lookYaw = w.yaw; w.after = 'return'; }
          w.admire = false;
        }
        break;
      }
      case 'admire': {
        w.t -= dt; w.sp = 0;
        if (w.t <= 0) w.state = 'return';
        break;
      }
      case 'return': {
        // pick his rounds back up where he left off (a distraction doesn't reset them)
        if (w.wp >= this.pts.length) w.wp = this._nearestWp();
        w.state = 'patrol';
        break;
      }
      case 'alert': {
        w.t -= dt; w.sp = 0;
        w.yaw += wrapAngle(Math.atan2(p.x - w.x, p.z - w.z) - w.yaw) * (1 - Math.exp(-8 * dt));
        if (this._sees(true)) { w.lost = 0; w.lastSeen.x = p.x; w.lastSeen.z = p.z; } else w.lost += dt;
        if (w.lost > 0.3) { w.state = 'investigate'; w.tx = w.lastSeen.x; w.tz = w.lastSeen.z; w.t = 10; w.admire = false; G.ui.pop('?', { x: w.x, y: 3.6, z: w.z }, 'white', 0.9); }
        else if (w.t <= 0) { w.state = 'chase'; w.lost = 0; w.chaseT = 0; this.stats.chases++; G.audio.sfx('spook'); G.ui.pop('HEY!', { x: w.x, y: 3.8, z: w.z }, 'big bad', 0.9); }
        break;
      }
      case 'chase': {
        let tx = w.lastSeen.x, tz = w.lastSeen.z;
        if (w.knows) { tx = w.knows.x; tz = w.knows.z; }
        const visible = !p.hidden && d < 15 && this._los(w.x, w.z, p.x, p.z) && p.grace <= 0;
        if (visible) { tx = p.x; tz = p.z; w.lastSeen.x = p.x; w.lastSeen.z = p.z; w.lost = 0; } else if (!w.knows) w.lost += dt;
        w.chaseT += dt;
        const arrived = this._goto(tx, tz, cfg.chase + Math.min(cfg.ramp, w.chaseT * 0.55), dt, 1.0);
        if (p.caughtT <= 0 && ((!p.hidden && d < 1.3) || (w.knows && p.hidden === w.knows && d < 1.9))) { this._catch(); break; }
        if (w.knows && p.hidden !== w.knows) w.knows = null;
        if (w.lost > 2.5 || (arrived && !visible && !w.knows)) { w.state = 'look'; w.t = 2.6; w.lookYaw = w.yaw; w.after = 'return'; w.lost = 0; G.ui.pop('?', { x: w.x, y: 3.6, z: w.z }, 'white', 0.9); }
        break;
      }
      case 'catch': {
        w.t -= dt; w.sp = 0;
        if (w.t <= 0) { w.state = 'look'; w.t = 1.4; w.lookYaw = w.yaw; w.after = 'return'; }
        break;
      }
      default: w.sp = 0;   // 'final': stands there, looking up
    }
    w.yaw = wrapAngle(w.yaw);
    // spotting you
    if (!this.ending && sees && ['patrol', 'look', 'investigate', 'return', 'admire'].includes(w.state)) {
      w.state = 'alert'; w.t = cfg.windup; w.lost = 0;
      this.stats.alerts++;
      G.audio.sfx('power');
      G.ui.pop('!', { x: w.x, y: 3.8, z: w.z }, 'big bad', 0.8);
      w.ch.play('flinch', 0.4);
    }
    // music-box tick when he is near
    if (d < 15 && !this.ending && w.state !== 'catch') {
      w.tick -= dt;
      if (w.tick <= 0) {
        const k = clamp(d / 15, 0, 1);
        w.tick = w.state === 'chase' ? 0.16 : lerp(0.3, 0.95, k);
        w.tickN++;
        G.audio.tone('triangle', w.tickN % 2 ? 1318 : 1568, w.tickN % 2 ? 1318 : 1568, 0.05, 0.018 + (1 - k) * 0.05);
      }
    }
  }

  _carts(dt) {
    const p = this.p;
    for (const c of this.carts) {
      c.cd = Math.max(0, c.cd - dt);
      const d = dist(p.x, p.z, c.x, c.z);
      if (!p.hidden && d < c.r + 0.42 && d > 0.01) {
        const nx = (c.x - p.x) / d, nz = (c.z - p.z) / d;
        const sp = Math.hypot(p.vx, p.vz);
        c.vx += nx * (sp * 0.9 + 1.2); c.vz += nz * (sp * 0.9 + 1.2);
        p.x = c.x - nx * (c.r + 0.43); p.z = c.z - nz * (c.r + 0.43);
        if (c.cd <= 0) { c.cd = 0.8; G.audio.sfx('thud'); G.audio.sfx('tick'); this._noise(c.x, c.z, 16, 'cart'); G.ui.pop('CLATTER!', { x: c.x, y: 2, z: c.z }, 'small bad', 0.8); }
      }
      const sp = Math.hypot(c.vx, c.vz);
      if (sp > 0.05) {
        const px = c.x, pz = c.z;
        this._move(c, c.vx * dt, c.vz * dt, c.r);
        if (Math.abs(c.x - px - c.vx * dt) > 1e-3) c.vx *= -0.4;
        if (Math.abs(c.z - pz - c.vz * dt) > 1e-3) c.vz *= -0.4;
        const k = Math.max(0, 1 - 2.6 * dt);
        c.vx *= k; c.vz *= k;
        c.g.position.set(c.x, 0, c.z);
        c.g.rotation.y = Math.atan2(c.vx, c.vz);
      }
    }
  }

  // ================================================================ flow
  _score() {
    const total = this.towers.length;
    let s = Math.round((500 * this.fixed) / total) - this.strikes * 40;
    if (this.fixed >= total) s += clamp(Math.round((this.cfg.par - this.elapsed) * 1.5), 0, 150);
    return Math.max(0, s);
  }

  tick(dt) {
    if (this.ending) {
      this.endT -= dt;
      this._wick(dt);
      if (this.p.caughtT > 0) this.p.caughtT -= dt;
      if (this.endT <= 0) {
        const total = this.towers.length;
        if (this.ending === 'win') this.finish({ score: this._score(), won: true, title: 'Lights on!', detail: `The old stadium hums back to life. Wick stands very still under the lights for a while.<br>All <b>${total}</b> lights in <b>${fmtTime(this.elapsed)}</b>${this.strikes ? ` · ${this.strikes} strike${this.strikes > 1 ? 's' : ''}` : ' · never caught'}`, extra: { fixed: this.fixed, total, strikes: this.strikes, time: this.elapsed } });
        else this.finish({ score: this._score(), won: false, title: 'Escorted out', detail: `Wick walks you to the gate, humming the fight song. Lights fixed: <b>${this.fixed}/${total}</b>.`, extra: { fixed: this.fixed, total, strikes: this.strikes, time: this.elapsed } });
      }
      return;
    }
    this._player(dt);
    this._wick(dt);
    this._carts(dt);
  }

  _placeCamera(dt) {
    const p = this.p;
    const tx = clamp(p.x, 12, W - 12), tz = clamp(p.z - 1.2, 9, D - 7);
    const zoomGoal = this.ending === 'win' ? 1.3 : 1;
    if (dt === 0) { this.cam.x = tx; this.cam.z = tz; } else { this.cam.x = damp(this.cam.x, tx, 5, dt); this.cam.z = damp(this.cam.z, tz, 5, dt); this.cam.zoom = damp(this.cam.zoom, zoomGoal, 2, dt); }
    const asp = this.camera.aspect || 1.78;
    const d = 40 * this.cam.zoom * (asp < 1.5 ? 1.5 / asp : 1), pitch = 0.93;
    this.camera.position.set(this.cam.x, Math.sin(pitch) * d, this.cam.z + Math.cos(pitch) * d);
    this.camera.lookAt(this.cam.x, 0.6, this.cam.z);
    this.fx.applyShake(this.camera);
    this.rig.follow(this.cam.x, this.cam.z);
  }

  _edgeMark(node, x, y, z, show) {
    if (!show) { node.style.display = 'none'; return; }
    const s = G.ui.project({ x, y, z }, this.camera);
    const m = 46;
    const on = s.x > m && s.x < G.W - m && s.y > m + 30 && s.y < G.H - m;
    if (on) { node.style.display = 'none'; return; }
    node.style.display = '';
    node.style.left = `${clamp(s.x, m, G.W - m)}px`;
    node.style.top = `${clamp(s.y, m + 34, G.H - m - 20)}px`;
  }

  ambient(dt) {
    const p = this.p, w = this.w, t = this.time;
    // you
    p.ch.root.visible = !p.hidden;
    p.ch.setPos(p.x, p.z);
    p.ch.face(p.yaw, dt, 18);
    p.ch.update(dt, p.sp);
    const lit = p.hidden ? 0.6 : 15;
    p.light.intensity = damp(p.light.intensity, lit * (1 + Math.sin(t * 13) * 0.04), 8, dt);
    p.light.position.set(p.x + Math.sin(p.yaw) * 0.3, 1.7, p.z + Math.cos(p.yaw) * 0.3);
    p.glow.position.set(p.x + Math.sin(p.yaw + 0.9) * 0.45, 0.95, p.z + Math.cos(p.yaw + 0.9) * 0.45);
    p.glow.visible = !p.hidden;
    // Wick
    w.ch.setPos(w.x, w.z);
    w.ch.face(w.yaw, dt, 12);
    w.ch.update(dt, w.sp);
    if (w.headUp > 0.01) w.ch.head.rotation.x = -0.6 * w.headUp;
    w.light.position.set(w.x + Math.sin(w.yaw) * 1.6, 3.1, w.z + Math.cos(w.yaw) * 1.6);
    w.light.intensity = 17 * (1 + Math.sin(t * 11) * 0.06);
    const alert = w.state === 'alert', chase = w.state === 'chase' || w.state === 'catch';
    w.decal.visible = w.state !== 'final';
    w.decal.position.set(w.x, 0.07, w.z);
    w.decal.rotation.z = w.yaw - Math.PI / 2;
    w.decal.material.color.set(chase ? 0xff5a3c : alert ? 0xff9d2e : 0xffc65a);
    w.decal.material.opacity = chase ? 0.3 : alert ? 0.2 + Math.abs(Math.sin(t * 18)) * 0.2 : 0.15;
    if (w.ch.windKey && (alert || chase)) w.ch.windKey.rotation.z += dt * 14;
    // towers
    let amb = this.baseHemi;
    for (const tw of this.towers) {
      if (tw.fixed) {
        tw.glow = Math.min(1, tw.glow + dt * 1.4);
        amb += 0.1 * tw.glow;
      } else {
        tw.sparkT -= dt;
        if (tw.sparkT <= 0) { tw.sparkT = rand(1.2, 2.8); this.fx.burst('spark', { x: tw.px - 0.2, y: 1.5, z: tw.pz + 0.3 }, 2, { speed: 1.6, up: 1.6, life: 0.4, s0: 0.22, color: 0xffd45a }); }
        tw.halo.material.opacity = 0.4 + Math.sin(t * 5 + tw.px) * 0.18;
      }
      tw.light.intensity = 56 * tw.glow * (tw.glow < 1 ? 0.6 + Math.random() * 0.6 : 1);   // flickers on
      tw.beam.material.opacity = 0.06 * tw.glow;
    }
    this.rig.hemi.intensity = damp(this.rig.hemi.intensity, amb, 3, dt);
    this.vig.style.opacity = String(clamp(1 - (this.fixed / this.towers.length) * 0.75, 0.2, 1));
    // hiding places wobble when used
    for (const h of this.hides) {
      h.shake = Math.max(0, h.shake - dt);
      if (h.obj) {
        h.obj.rotation.z = Math.sin(t * 40) * 0.03 * (h.shake / 0.4);
        if (h.kind === 'tarp') h.obj.scale.y = damp(h.obj.scale.y, p.hidden === h ? 1.7 : 1, 10, dt);
      }
      h.sign.material.opacity = 0.14 + Math.sin(t * 3 + h.x) * 0.06;
    }
    this._placeCamera(dt);
    this._hudTick();
  }

  _hudTick() {
    const p = this.p, w = this.w, r = this.repair;
    this.hudScore(`💡 ${this.fixed}/${this.towers.length}`);
    const sk = '✖'.repeat(this.strikes) + '○'.repeat(Math.max(0, 3 - this.strikes));
    if (this.hStrike.textContent !== sk) this.hStrike.textContent = sk;
    const ck = `⏱ ${fmtTime(Math.floor(this.elapsed))}`;
    if (this.hClock.textContent !== ck) this.hClock.textContent = ck;
    // splice meter
    this.hSplice.classList.toggle('hidden', !r);
    if (r) this.hNeedle.style.left = `${r.x * 100}%`;
    // hold-to-open ring
    const holding = this.playing && !r && p.holdT > 0 && this.ctx && this.ctx.panel;
    this.hHold.classList.toggle('hidden', !holding);
    if (holding) {
      const t = this.ctx.panel;
      const s = G.ui.project({ x: t.px, y: 2.7, z: t.pz }, this.camera);
      this.hHold.style.left = `${s.x}px`; this.hHold.style.top = `${s.y}px`;
      this.hHoldFill.style.background = `conic-gradient(var(--gold) ${Math.round((p.holdT / 0.45) * 360)}deg, transparent 0)`;
    }
    // peeking eyes
    this.hPeek.classList.toggle('hidden', !p.hidden);
    if (p.hidden) { const s = G.ui.project({ x: p.hidden.mx, y: p.hidden.kind === 'tarp' ? 1.6 : 2.6, z: p.hidden.mz }, this.camera); this.hPeek.style.left = `${s.x}px`; this.hPeek.style.top = `${s.y}px`; }
    // edge markers
    for (const t of this.towers) this._edgeMark(t.mark, t.px, 1.5, t.pz, this.playing && !t.fixed);
    this._edgeMark(w.mark, w.x, 2.4, w.z, this.playing && w.state !== 'final' && dist(p.x, p.z, w.x, w.z) < 26);
    // context hint
    if (!this.playing) return;
    if (this.ending) { this.hudHint(''); return; }
    const k = (a) => G.ui.key(a);
    let hint = `${k('move')} sneak · hold ${k('b')} to run (loud) · ${k('a')} repair / hide`;
    if (p.caughtT > 0) hint = 'Busted.';
    else if (p.hidden) hint = `${k('a')} or move to come out — wait for the lantern to pass`;
    else if (r) hint = `${k('a')} when the needle is on the <b style="color:#6fdc6a">green</b> · move to step away`;
    else if (this.ctx && this.ctx.panel) hint = `Hold ${k('a')} to open the fuse panel`;
    else if (this.ctx && this.ctx.hide) hint = `${k('a')} hide ${this.ctx.hide.kind === 'tarp' ? 'under the tarp' : this.ctx.hide.kind === 'hatch' ? 'under the bleachers' : 'in the locker'}`;
    this.hudHint(hint);
  }

  cleanup() {
    for (const t of this.towers) { t.beam.geometry.dispose(); t.beam.material.dispose(); }
    this.w.decal.geometry.dispose(); this.w.decal.material.dispose();
    if (this.groundTex) this.groundTex.dispose();
  }
}
