// Snack Shack Rush — work the stadium snack stand through the halftime rush.
// Fans line up at the counter with orders; you run the kitchen with a
// three-item tray: popcorn re-pops on a timer, hot dogs cook (and burn) on the
// grill, sodas are a stop-the-needle pour, pretzels are instant. Hard mode
// adds cocoa (hold-and-release pour), four-item orders and thinner patience.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { Character } from '../art/characters.js';
import { toon, lit, M, rbox, box, cyl, sphere, capsule, torus, plane, lightRig, canvasTex, texMat, signPlane, glowSprite, bake, SKIES } from '../art/kit.js';
import { PROPS } from '../art/props.js';
import { teamSpec } from '../data/cast.js';
import { clamp, lerp, damp, makeRng, el } from '../core/util.js';

const DURATION = 90;
const SPEED = 6.9;
const TRAY_MAX = 3;
const COOK = 3.2;
const SLOT_X = [-4.5, -1.5, 1.5, 4.5];
const SLOT_Z = -4.85;
const LANE_Z = -6.5;
const B = { x0: -5.15, x1: 5.15, z0: -2.4, z1: 3.3 };

const ITEMS = {
  popcorn: { icon: '🍿', name: 'popcorn', w: 3 },
  pretzel: { icon: '🥨', name: 'pretzel', w: 3 },
  hotdog: { icon: '🌭', name: 'hot dog', w: 2.4 },
  soda: { icon: '🥤', name: 'soda', w: 2.4 },
  cocoa: { icon: '☕', name: 'cocoa', w: 2 },
};
const ORDER_SORT = ['hotdog', 'soda', 'cocoa', 'popcorn', 'pretzel'];

const CFG = {
  normal: { items: ['popcorn', 'pretzel', 'hotdog', 'soda'], maxOrder: 3, spawn: [5.0, 3.0], patience: 1, sodaDur: 1.3, sodaZone: [0.58, 0.88], popT: 2.8, readyT: 7 },
  hard: { items: ['popcorn', 'pretzel', 'hotdog', 'soda', 'cocoa'], maxOrder: 4, spawn: [3.8, 2.3], patience: 0.82, sodaDur: 1.05, sodaZone: [0.64, 0.88], popT: 3.2, readyT: 5 },
};

const FANS = ['pig', 'duck', 'cat', 'dog', 'frog', 'owl', 'goat', 'hedgehog', 'beaver', 'deer', 'mouse', 'squirrel', 'raccoon', 'turtle', 'badger', 'skunk', 'bear', 'rabbit'];
const SHIRTS = [0xd4502f, 0x2a6f77, 0xf08a24, 0x6aa84f, 0x58b8c9, 0x8a5aa8, 0xe58a9c, 0xffd45a, 0x3b2148];
const HATS = [null, null, 'cap', 'beanie', 'visor', 'straw', 'bow', 'cap'];

function injectCss() {
  if (document.getElementById('mg-snack-css')) return;
  const s = document.createElement('style');
  s.id = 'mg-snack-css';
  s.textContent = `
.ss-bubble { position:absolute; transform:translate(-50%,-100%); background:#fff4dc; border:0.16em solid #2b1a33; border-radius:0.8em;
  padding:0.12em 0.42em 0.3em; box-shadow:0 0.18em 0 rgba(43,26,51,.45); font-size:1.32em; white-space:nowrap; text-align:center; line-height:1.25; }
.ss-bubble:after { content:''; position:absolute; left:50%; bottom:-0.62em; margin-left:-0.3em; border:0.3em solid transparent; border-top-color:#2b1a33; }
.ss-bubble .it { display:inline-block; margin:0 0.04em; transition:opacity .2s, transform .2s; }
.ss-bubble .it.done { opacity:0.22; transform:scale(0.7); }
.ss-pat { height:0.3em; border-radius:0.2em; background:rgba(43,26,51,.25); overflow:hidden; margin-top:0.08em; }
.ss-pat > i { display:block; height:100%; width:100%; background:#6aa84f; }
.ss-bubble.mid .ss-pat > i { background:#f2b632; }
.ss-bubble.warn { border-color:#d4502f; animation:ss-shake .22s linear infinite; }
.ss-bubble.warn .ss-pat > i { background:#d4502f; }
@keyframes ss-shake { 0%,100% { margin-left:-2px; } 50% { margin-left:2px; } }
.ss-prompt { position:absolute; transform:translate(-50%,-100%); font-weight:900; color:#fff4dc; white-space:nowrap; font-size:1.02em;
  text-shadow:0 0.1em 0 #2b1a33, 0 0 0.45em rgba(27,16,36,.95), 0 0 0.2em rgba(27,16,36,.95); }
.ss-prompt .key { background:#ffd45a; color:#2b1a33; }
.ss-bar { position:absolute; transform:translate(-50%,-50%); width:2.7em; height:0.5em; border:0.13em solid #2b1a33; border-radius:0.4em; background:rgba(27,16,36,.65); overflow:hidden; }
.ss-bar > i { display:block; height:100%; background:#ffd45a; }
.ss-bar.ready > i { background:#6aa84f; }
.ss-bar.late > i { background:#d4502f; }
.ss-meter { position:absolute; transform:translate(-50%,-50%); width:10em; height:1.25em; border:0.18em solid #2b1a33; border-radius:0.7em; background:rgba(27,16,36,.78); overflow:hidden; box-shadow:0 0.2em 0 rgba(43,26,51,.4); }
.ss-meter > i { position:absolute; top:0; bottom:0; left:0; background:#8fd0ff; }
.ss-meter.cocoa > i { background:#b5683a; }
.ss-meter > em { position:absolute; top:0; bottom:0; background:rgba(106,168,79,.95); border-left:0.1em solid #fff4dc; border-right:0.1em solid #fff4dc; }
.ss-meter > b { position:absolute; top:-0.1em; bottom:-0.1em; width:0.28em; margin-left:-0.14em; background:#fff4dc; border-radius:0.2em; box-shadow:0 0 0 0.08em #2b1a33; }
.ss-traybar { position:absolute; left:50%; bottom:2.9em; transform:translateX(-50%); display:flex; gap:0.3em; align-items:center; background:rgba(43,26,51,.88);
  border:0.16em solid #ffd45a; border-radius:0.9em; padding:0.15em 0.6em; font-weight:900; color:#fff4dc; font-size:1.05em; }
.ss-traybar .slot { width:1.7em; height:1.7em; border-radius:0.45em; background:rgba(255,244,220,.14); display:flex; align-items:center; justify-content:center; font-size:1.2em; }
.ss-traybar .slot.on { background:#fff4dc; }
.ss-traybar .combo { color:#ffd45a; margin-left:0.35em; min-width:0; white-space:nowrap; }
.ss-traybar .combo.hot { animation:ss-pop .3s cubic-bezier(.2,1.6,.4,1); }
@keyframes ss-pop { from { transform:scale(1.7); } }
.ss-tag { position:absolute; transform:translate(-50%,-50%); font-size:1.5em; width:1.7em; height:1.7em; line-height:1.7em; text-align:center; border-radius:50%;
  background:#fff4dc; border:0.12em solid #2b1a33; box-shadow:0 0.14em 0 rgba(43,26,51,.45); }
.ss-tag.off { filter:grayscale(1); opacity:0.6; }
`;
  document.head.appendChild(s);
}

// ------------------------------------------------------------------ little models
function itemModel(id) {
  const g = new THREE.Group();
  if (id === 'popcorn') {
    g.add(M(cyl(0.13, 0.09, 0.26, 8), toon(0xd4502f), 0, 0.13, 0));
    g.add(M(cyl(0.134, 0.115, 0.08, 8), toon(0xfffaf0), 0, 0.15, 0, { shadow: false }));
    g.add(M(sphere(0.15, 8, 6), toon(0xfff1a8), 0, 0.3, 0, { sy: 0.7, shadow: false }));
  } else if (id === 'hotdog') {
    g.add(M(capsule(0.075, 0.22), toon(0xe8c08a), 0, 0.08, 0, { rz: Math.PI / 2 }));
    g.add(M(capsule(0.05, 0.28), toon(0xb5452f), 0, 0.14, 0, { rz: Math.PI / 2, shadow: false }));
    g.add(M(box(0.26, 0.012, 0.03), toon(0xf2c23c), 0, 0.195, 0, { shadow: false }));
  } else if (id === 'soda') {
    g.add(M(cyl(0.105, 0.08, 0.3, 10), toon(0xfffaf0), 0, 0.15, 0));
    g.add(M(cyl(0.107, 0.095, 0.1, 10), toon(0xd4502f), 0, 0.14, 0, { shadow: false }));
    g.add(M(cyl(0.11, 0.11, 0.03, 10), toon(0xdfeef0), 0, 0.31, 0, { shadow: false }));
    g.add(M(cyl(0.012, 0.012, 0.2, 5), toon(0xd4502f), 0.03, 0.4, 0, { rz: -0.2, shadow: false }));
  } else if (id === 'pretzel') {
    g.add(M(torus(0.11, 0.035, 6, 12), toon(0xb5683a), -0.06, 0.05, 0, { rx: Math.PI / 2 }));
    g.add(M(torus(0.11, 0.035, 6, 12), toon(0xb5683a), 0.06, 0.05, 0, { rx: Math.PI / 2 }));
    g.add(M(sphere(0.02, 5, 4), toon(0xfffaf0), 0.02, 0.09, 0.06, { shadow: false }));
    g.add(M(sphere(0.02, 5, 4), toon(0xfffaf0), -0.08, 0.09, -0.04, { shadow: false }));
  } else if (id === 'cocoa') {
    g.add(M(cyl(0.1, 0.09, 0.2, 10), toon(0xf6edd6), 0, 0.1, 0));
    g.add(M(torus(0.06, 0.02, 5, 10), toon(0xf6edd6), 0.12, 0.1, 0, { shadow: false }));
    g.add(M(cyl(0.085, 0.085, 0.02, 10), toon(0x6a3f26), 0, 0.2, 0, { shadow: false }));
    g.add(M(sphere(0.035, 6, 5), toon(0xffffff), 0.02, 0.22, 0.01, { shadow: false }));
  }
  return g;
}

function popcornCart() {
  const g = new THREE.Group();
  g.add(M(rbox(1.5, 1.0, 1.1, 0.1), toon(0xd4502f), 0, 0.65, 0));
  for (let i = 0; i < 5; i++) g.add(M(box(0.15, 0.9, 0.03), toon(0xfff4dc), -0.6 + i * 0.3, 0.66, 0.56, { shadow: false }));
  g.add(M(box(1.34, 0.95, 0.98), toon(0xcfeaf2, { transparent: true, opacity: 0.38 }), 0, 1.64, 0, { shadow: false }));
  for (const [x, z] of [[-0.68, -0.5], [0.68, -0.5], [-0.68, 0.5], [0.68, 0.5]]) g.add(M(cyl(0.045, 0.045, 1.0, 5), toon(0xffd45a), x, 1.64, z));
  g.add(M(rbox(1.7, 0.2, 1.3, 0.08), toon(0xd4502f), 0, 2.22, 0));
  g.add(M(sphere(0.13, 8, 6), toon(0xffd45a), 0, 2.4, 0));
  const pile = M(sphere(0.56, 12, 8), toon(0xfff1a8), 0, 1.18, 0, { shadow: false });
  g.add(pile);
  g.add(M(cyl(0.16, 0.2, 0.34, 8), toon(0x8f9aa6), 0, 1.86, 0, { shadow: false }));
  for (const s of [-1, 1]) g.add(M(cyl(0.3, 0.3, 0.12, 12), toon(0x2b1a33), s * 0.5, 0.3, 0.62, { rx: Math.PI / 2 }));
  g.add(M(box(1.5, 0.06, 0.34), toon(0xfff4dc), 0, 1.15, 0.72));
  const bags = [];
  for (const x of [-0.32, 0.32]) { const b = itemModel('popcorn'); b.position.set(x, 1.18, 0.72); b.scale.setScalar(1.25); g.add(b); bags.push(b); }
  g.userData.pile = pile; g.userData.bags = bags;
  return g;
}

function grillModel() {
  const g = new THREE.Group();
  g.add(M(rbox(1.9, 0.86, 1.1, 0.08), toon(0x4a4a58), 0, 0.5, 0));
  g.add(M(box(1.72, 0.07, 0.92), toon(0x23232c), 0, 0.97, 0, { shadow: false }));
  for (let i = 0; i < 7; i++) g.add(M(box(1.68, 0.03, 0.035), toon(0x7a8490), 0, 1.02, -0.36 + i * 0.12, { shadow: false }));
  g.add(M(box(1.9, 0.5, 0.07), toon(0x6a7480), 0, 1.22, -0.55));
  g.add(M(box(1.6, 0.05, 0.02), lit(0xff7a3c, 0xff5a1c, 1.3), 0, 0.88, 0.56, { shadow: false }));
  for (const s of [-1, 1]) g.add(M(cyl(0.08, 0.08, 0.1, 8), toon(0xd4502f), s * 0.5, 0.6, 0.57, { rx: Math.PI / 2, shadow: false }));
  const dogs = [];
  for (const x of [-0.42, 0.42]) {
    const d = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ color: 0xf2a9a0, gradientMap: toon(0xffffff).gradientMap });
    const sausage = new THREE.Mesh(capsule(0.075, 0.5), mat);
    sausage.rotation.x = Math.PI / 2; sausage.position.y = 0.075; sausage.castShadow = true;
    d.add(sausage);
    d.position.set(x, 1.03, 0.02);
    d.userData.mat = mat;
    d.visible = false;
    g.add(d);
    dogs.push(d);
  }
  g.userData.dogs = dogs;
  return g;
}

function fountainModel() {
  const g = new THREE.Group();
  g.add(M(rbox(1.5, 0.9, 1.0, 0.08), toon(0x2a6f77), 0, 0.5, 0));
  g.add(M(rbox(1.3, 0.9, 0.5, 0.08), toon(0xdfeef0), 0, 1.42, -0.22));
  [0xd4502f, 0xf08a24, 0x6aa84f].forEach((c, i) => {
    g.add(M(box(0.26, 0.3, 0.06), toon(c), -0.42 + i * 0.42, 1.55, 0.05, { shadow: false }));
    g.add(M(cyl(0.04, 0.04, 0.22, 6), toon(0x8f9aa6), -0.42 + i * 0.42, 1.12, 0.12));
  });
  g.add(M(box(1.3, 0.05, 0.42), toon(0x8f9aa6), 0, 0.975, 0.26, { shadow: false }));
  for (let i = 0; i < 4; i++) g.add(M(cyl(0.1, 0.085, 0.1, 8), toon(i % 2 ? 0xd4502f : 0xfffaf0), 0.56, 1.02 + i * 0.07, 0.34));
  const cup = itemModel('soda'); cup.position.set(0, 0.99, 0.3); cup.visible = false; g.add(cup);
  g.userData.cup = cup;
  return g;
}

function warmerModel() {
  const g = new THREE.Group();
  g.add(M(rbox(1.5, 0.9, 1.0, 0.08), toon(0xb07a45), 0, 0.5, 0));
  g.add(M(box(1.3, 0.8, 0.85), toon(0xfff1c0, { transparent: true, opacity: 0.36 }), 0, 1.36, 0, { shadow: false }));
  for (const [x, z] of [[-0.66, -0.43], [0.66, -0.43], [-0.66, 0.43], [0.66, 0.43]]) g.add(M(cyl(0.04, 0.04, 0.82, 5), toon(0x6a4a2e), x, 1.36, z));
  g.add(M(rbox(1.5, 0.16, 1.02, 0.05), toon(0xd4502f), 0, 1.85, 0));
  g.add(M(cyl(0.02, 0.02, 1.2, 5), toon(0x6a7480), 0, 1.64, 0, { rz: Math.PI / 2, shadow: false }));
  for (let i = 0; i < 4; i++) g.add(M(torus(0.13, 0.045, 6, 12), toon(0xb5683a), -0.42 + i * 0.28, 1.47, 0, { shadow: false }));
  g.add(M(box(1.2, 0.04, 0.7), lit(0xffb347, 0xff9a2e, 1.0), 0, 1.75, 0, { shadow: false }));
  return g;
}

function cocoaModel() {
  const g = new THREE.Group();
  g.add(M(rbox(1.3, 0.72, 0.9, 0.08), toon(0x8a5aa8), 0, 0.4, 0));
  g.add(M(cyl(0.34, 0.38, 0.7, 12), toon(0xc9d2da), 0, 1.1, 0));
  g.add(M(sphere(0.34, 12, 8), toon(0xc9d2da), 0, 1.45, 0, { sy: 0.5 }));
  g.add(M(sphere(0.07, 6, 5), toon(0x2b1a33), 0, 1.64, 0));
  g.add(M(cyl(0.045, 0.045, 0.22, 6), toon(0x2b1a33), 0, 0.92, 0.42, { rx: Math.PI / 2 }));
  const mug = itemModel('cocoa'); mug.position.set(0, 0.76, 0.5); mug.visible = false; g.add(mug);
  g.userData.cup = mug;
  return g;
}

const _v = new THREE.Vector3();

export default class SnackShackRush extends Minigame {
  static meta = {
    id: 'snack', title: 'Snack Shack Rush', icon: '🌭',
    blurb: 'It\'s <b>halftime</b> and the whole stadium is hungry. Read each fan\'s order, load your tray (three items max) and serve them before they storm off. Hot dogs take time on the grill — and burn if you forget them. Stop the soda needle in the green.',
    controls: [['move', 'run the kitchen'], ['a', 'grab · cook · pour · serve'], ['b', 'toss the last tray item']],
    scoreLabel: 'points', goals: [180, 450, 760], hasHard: true, music: 'minigame',
  };
  // hard mode is scored on its own scale (thinner patience, bigger orders)
  get meta() { return this.hard ? HARD_META : SnackShackRush.meta; }

  // ================================================================ setup
  setup(opts) {
    injectCss();
    this.cfg = this.hard ? CFG.hard : CFG.normal;
    this.rng = makeRng(opts.seed ? opts.seed * 7919 : (Math.random() * 1e9) | 0);
    this.t = 0;
    this.timeLeft = DURATION;
    this.score = 0; this.combo = 0; this.served = 0; this.lost = 0; this.bestCombo = 0;
    this.tray = [];
    this.customers = [];
    this.pour = null;
    this.stun = 0;
    this.spawnT = 0.4;
    this.ctx = null;
    this.prog = 0;
    this._buildScene();
    this._buildHud();
    this._placeCamera();
  }

  _buildScene() {
    const sc = this.scene;
    this.rig = lightRig(sc, { ...SKIES.day, sky: 0xf4c58f, fog: 0xf0bd88, hemiSky: 0xfff4e2, hemiGround: 0xa98a6e, hemi: 1.6, sun: 0xffe8c4, sunI: 2.1, sunDir: [-0.45, 1, 0.55] }, { shadowSize: 18, fog: [60, 140] });
    this.rig.follow(0, -2.5);
    const stat = new THREE.Group();
    sc.add(stat);
    // grass + paved apron for the queue
    stat.add(M(plane(120, 90), toon(0x79a856), 0, -0.02, -8, { rx: -Math.PI / 2, shadow: false }));
    stat.add(M(box(22, 0.06, 5.4), toon(0xcfc2ad), 0, 0.0, -5.9, { shadow: false }));
    // kitchen floor (checkered)
    const tex = canvasTex(256, 128, (c) => {
      for (let x = 0; x < 16; x++) for (let z = 0; z < 8; z++) { c.fillStyle = (x + z) % 2 ? '#f4e6c8' : '#e2a27c'; c.fillRect(x * 16, z * 16, 16, 16); }
      c.strokeStyle = 'rgba(90,60,50,0.25)'; c.lineWidth = 1;
      for (let x = 0; x <= 16; x++) { c.beginPath(); c.moveTo(x * 16, 0); c.lineTo(x * 16, 128); c.stroke(); }
      for (let z = 0; z <= 8; z++) { c.beginPath(); c.moveTo(0, z * 16); c.lineTo(256, z * 16); c.stroke(); }
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14.2, 7.6), texMat(tex));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.035, 0.6); floor.receiveShadow = true;
    sc.add(floor);
    stat.add(M(box(14.8, 0.2, 8.2), toon(0x8a5a40), 0, -0.08, 0.6, { shadow: false }));
    // side walls behind the stations
    for (const s of [-1, 1]) {
      stat.add(M(rbox(0.4, 1.5, 7.6, 0.08), toon(0x2a6f77), s * 7.25, 0.75, 0.6));
      stat.add(M(box(0.5, 0.12, 7.7), toon(0xfff4dc), s * 7.25, 1.52, 0.6, { shadow: false }));
    }
    // the service counter
    const counter = PROPS.counter({ w: 14.2, color: 0xd4502f, top: 0xf7ead2 });
    counter.position.set(0, 0, -3.35);
    stat.add(counter);
    for (let i = 0; i < 12; i++) stat.add(M(box(0.6, 1.0, 0.03), toon(i % 2 ? 0xfff4dc : 0xd4502f), -6.6 + i * 1.2, 0.52, -2.885, { shadow: false }));
    // napkins / ketchup on the counter
    for (const x of [-3, 0, 3]) { stat.add(M(rbox(0.3, 0.18, 0.3, 0.04), toon(0xfffaf0), x - 0.2, 1.25, -3.5)); stat.add(M(cyl(0.06, 0.07, 0.26, 6), toon(0xd4502f), x + 0.15, 1.3, -3.5)); stat.add(M(cyl(0.06, 0.07, 0.26, 6), toon(0xf2c23c), x + 0.32, 1.3, -3.5)); }
    // queue posts
    for (const x of [-6, -3, 0, 3, 6]) { stat.add(M(cyl(0.07, 0.1, 0.95, 8), toon(0x3b2148), x, 0.5, -4.25)); stat.add(M(sphere(0.11, 8, 6), toon(0xffd45a), x, 1.02, -4.25)); }
    // big sign behind the queue
    for (const s of [-1, 1]) stat.add(M(cyl(0.12, 0.15, 4.6, 8), toon(0xfff4dc), s * 5.6, 2.3, -7.7));
    stat.add(M(rbox(12, 1.9, 0.25, 0.1), toon(0x3b2148), 0, 4.2, -7.7));
    const sign = signPlane('SNACK SHACK', 11.4, 1.5, { bg: '#d4502f', color: '#fff4dc', radius: 34, border: '#ffd45a' });
    sign.position.set(0, 4.2, -7.56);
    sc.add(sign);
    this.bulbs = [];
    for (let i = 0; i < 13; i++) {
      const b = M(sphere(0.11, 6, 5), lit(i % 2 ? 0xffe9a8 : 0xffb347, i % 2 ? 0xffd45a : 0xff9a2e, 1.6), -5.7 + i * 0.95, 5.3, -7.7, { shadow: false });
      sc.add(b);
      this.bulbs.push(b);
    }
    const gl = glowSprite(0xffc65a, 12, 0.28); gl.position.set(0, 4.6, -7.2); sc.add(gl);
    // stadium behind: bleachers with a crowd, light towers, scoreboard
    const bl = PROPS.bleachers({ len: 22, rows: 5 });
    bl.position.set(0, 0, -11.4);
    stat.add(bl);
    const cr = makeRng(5);
    const crowdCols = [0xd4502f, 0xf08a24, 0xffd45a, 0x2a6f77, 0x58b8c9, 0x8a5aa8, 0xfff4dc, 0x6aa84f];
    for (let row = 0; row < 5; row++) for (let i = 0; i < 20; i++) {
      if (cr() < 0.25) continue;
      const x = -10.2 + i * 1.07 + cr.range(-0.15, 0.15), y = 0.6 + row * 0.5, z = -11.4 - row * 0.72;
      stat.add(M(sphere(0.26, 7, 5), toon(crowdCols[Math.floor(cr() * crowdCols.length)]), x, y + 0.22, z, { sy: 1.1, shadow: false }));
      stat.add(M(sphere(0.2, 7, 5), toon([0xc99a5b, 0xf2e6d8, 0x8b5a3a, 0xa9a4a0, 0xe07a2f][Math.floor(cr() * 5)]), x, y + 0.62, z, { shadow: false }));
    }
    for (const s of [-1, 1]) { const lt = PROPS.lightTower({ on: true, h: 9.5 }); lt.position.set(s * 14.2, 0, -10.5); sc.add(lt); }
    for (const [x, z, s] of [[11, -3, 1.1], [13.5, 2.5, 1.2], [-11.5, 1.5, 1.2], [-13, -2.2, 1]]) { const t = PROPS.tree({ s, rng: cr }); t.position.set(x, 0, z); stat.add(t); }
    const tb = PROPS.picnicTable({ cloth: 0xffd45a }); tb.position.set(11.4, 0, 2.2); stat.add(tb);
    bake(stat);

    // warm work lights over the kitchen
    const pl = new THREE.PointLight(0xffd9a0, 26, 15, 2); pl.position.set(0, 4.4, 0.6); sc.add(pl);

    // ---- stations
    const st = this.st = {};
    const place = (model, x, z, ry) => { model.position.set(x, 0, z); model.rotation.y = ry; sc.add(model); return model; };
    st.popcorn = { id: 'popcorn', ux: -4.9, uz: -0.75, mx: -6.2, mz: -0.75, stock: 2, t: 0, obj: place(popcornCart(), -6.2, -0.75, Math.PI / 2), h: 2.9 };
    st.grill = { id: 'grill', ux: -4.9, uz: 2.2, mx: -6.25, mz: 2.2, slots: [{ state: 'empty', t: 0 }, { state: 'empty', t: 0 }], obj: place(grillModel(), -6.25, 2.2, Math.PI / 2), h: 1.9 };
    st.soda = { id: 'soda', ux: 4.9, uz: -0.75, mx: 6.2, mz: -0.75, obj: place(fountainModel(), 6.2, -0.75, -Math.PI / 2), h: 2.5 };
    st.pretzel = { id: 'pretzel', ux: 4.9, uz: 2.2, mx: 6.2, mz: 2.2, cd: 0, obj: place(warmerModel(), 6.2, 2.2, -Math.PI / 2), h: 2.5 };
    if (this.hard) st.cocoa = { id: 'cocoa', ux: 3.9, uz: 3.2, mx: 3.9, mz: 4.35, obj: place(cocoaModel(), 3.9, 4.35, Math.PI), h: 2.2 };
    this.stations = Object.values(st);
    const bin = PROPS.trashcan({ color: 0x6a7480 }); bin.position.set(-1.6, 0, 4.3); sc.add(bin);
    const crate = PROPS.crate({ s: 0.9 }); crate.position.set(-3.2, 0, 4.35); sc.add(crate);

    // ---- you
    const ch = new Character(teamSpec('captain'));
    ch.setPos(0, 0.8);
    ch.face(Math.PI);
    sc.add(ch.root);
    this.P = { ch, x: 0, z: 0.8, vx: 0, vz: 0, yaw: Math.PI, sp: 0 };
    // the tray
    const tg = new THREE.Group();
    tg.add(M(rbox(0.95, 0.05, 0.5, 0.02), toon(0x8a5aa8), 0, 0, 0));
    tg.add(M(box(0.99, 0.03, 0.54), toon(0x5a3f8a), 0, -0.02, 0, { shadow: false }));
    tg.position.set(0, 0.86, 0.5);
    tg.visible = false;
    ch.body.add(tg);
    this.trayG = tg; this.trayItems = [];
  }

  _buildHud() {
    this.elPrompt = el('div.ss-prompt', { style: { display: 'none' } });
    this.elMeter = el('div.ss-meter', { style: { display: 'none' } }, el('em'), el('i'), el('b'));
    this.elCombo = el('span.combo');
    this.elTray = el('div.ss-traybar', el('span', 'TRAY'), el('div.slot'), el('div.slot'), el('div.slot'), this.elCombo);
    this.bars = { g0: el('div.ss-bar', { style: { display: 'none' } }, el('i')), g1: el('div.ss-bar', { style: { display: 'none' } }, el('i')), pop: el('div.ss-bar', { style: { display: 'none' } }, el('i')) };
    this.tags = this.stations.map((s) => ({ s, el: el('div.ss-tag', ITEMS[s.id === 'grill' ? 'hotdog' : s.id].icon) }));
    this.hud.append(...this.tags.map((t) => t.el), this.bars.g0, this.bars.g1, this.bars.pop, this.elPrompt, this.elMeter, this.elTray);
    this.hudScore('0 pts');
    this.hudTime(DURATION);
  }

  _placeCamera() {
    const cam = this.camera;
    cam.fov = 22;
    const d = 40 * Math.max(1, 1.62 / (cam.aspect || 1.78));
    const pitch = 0.93;
    cam.position.set(0, Math.sin(pitch) * d + 0.6, -2.6 + Math.cos(pitch) * d);
    cam.lookAt(0, 0.6, -2.6);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  }
  resize(w, h) { super.resize(w, h); if (this.P) this._placeCamera(); }

  _px(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return [(_v.x * 0.5 + 0.5) * G.W, (-_v.y * 0.5 + 0.5) * G.H];
  }

  // ================================================================ flow
  begin() {
    this.timeLeft = DURATION;
    this.spawnT = 0.3;
  }

  tick(dt) {
    if (this.opts.auto) this._bot(dt);
    this.timeLeft -= dt;
    this.prog = clamp(1 - this.timeLeft / DURATION, 0, 1);
    // arrivals
    this.spawnT -= dt;
    const active = this.customers.filter((c) => c.state === 'in' || c.state === 'wait');
    if ((this.spawnT <= 0 || active.length === 0) && this.timeLeft > 5) {
      const free = [0, 1, 2, 3].filter((i) => !active.some((c) => c.slot === i));
      if (free.length) {
        this._spawn(free[Math.floor(this.rng() * free.length)]);
        this.spawnT = lerp(this.cfg.spawn[0], this.cfg.spawn[1], this.prog) * this.rng.range(0.85, 1.2);
      } else this.spawnT = 0.5;
    }
    this._stations(dt);
    this._player(dt);
    this._customers(dt);
    this.hudScore(`${this.score} pts`);
    this.hudTime(this.timeLeft);
    if (this.combo !== this._comboShown) {
      this._comboShown = this.combo;
      this.elCombo.textContent = this.combo >= 2 ? `🔥 ×${this.combo}` : '';
      this.elCombo.classList.remove('hot');
      if (this.combo >= 2) { void this.elCombo.offsetWidth; this.elCombo.classList.add('hot'); }
    }
    if (this.timeLeft <= 0) this._timeUp();
  }

  _timeUp() {
    G.audio.sfx('whistle');
    G.ui.banner('SECOND HALF!', 'Everybody back to their seats', { dur: 1.2, cls: 'small' });
    for (const c of this.customers) if (c.state === 'in' || c.state === 'wait') { this._dropBubble(c); c.state = 'out'; c.leg = 0; }
    this.pour = null;
    this.elMeter.style.display = 'none';
    this.elPrompt.style.display = 'none';
    G.input.hold('a', false);
    G.input.setAxis(0, 0);
    this.P.vx = this.P.vz = 0;
    this.finish({
      score: this.score,
      title: this.score >= this.meta.goals[0] ? 'Halftime handled!' : 'Halftime\'s over!',
      detail: `${this.served} order${this.served === 1 ? '' : 's'} served · ${this.lost} fan${this.lost === 1 ? '' : 's'} stormed off · best combo ×${this.bestCombo}`,
      extra: { served: this.served, lost: this.lost },
    });
  }

  // ================================================================ customers
  _spawn(slot) {
    const r = this.rng, p = this.prog, cfg = this.cfg;
    const w = this.hard ? [0.28 - 0.2 * p, 0.34, 0.26 + 0.1 * p, 0.12 + 0.1 * p] : [0.5 - 0.3 * p, 0.36, 0.14 + 0.3 * p];
    let roll = r(), size = 1;
    for (let i = 0; i < w.length; i++) { if (roll < w[i]) { size = i + 1; break; } roll -= w[i]; size = i + 1; }
    size = Math.min(size, cfg.maxOrder);
    const total = cfg.items.reduce((a, id) => a + ITEMS[id].w, 0);
    const order = [];
    while (order.length < size) {
      let k = r() * total, id = cfg.items[0];
      for (const it of cfg.items) { k -= ITEMS[it].w; if (k <= 0) { id = it; break; } }
      if (id === 'hotdog' && order.filter((o) => o.id === 'hotdog').length >= 2) continue;
      order.push({ id, done: false });
    }
    order.sort((a, b) => ORDER_SORT.indexOf(a.id) - ORDER_SORT.indexOf(b.id));
    const species = FANS[Math.floor(r() * FANS.length)];
    const hat = HATS[Math.floor(r() * HATS.length)];
    const spec = { kind: 'animal', species, shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], build: ['small', 'normal', 'normal', 'big'][Math.floor(r() * 4)] };
    if (hat) { spec.hat = hat; spec.hatC = SHIRTS[Math.floor(r() * SHIRTS.length)]; }
    if (r() < 0.3) { spec.acc = ['scarf']; spec.scarfC = r() < 0.5 ? 0xf08a24 : 0x3b2148; } else if (r() < 0.15) spec.acc = ['glasses'];
    const ch = new Character(spec);
    const side = r() < 0.5 ? -1 : 1;
    const c = { slot, ch, x: side * 13, z: LANE_Z + r.range(-0.3, 0.3), state: 'in', leg: 0, order, sp: 0, yaw: -side * Math.PI / 2, side, t: 0, bubble: null, bar: null, moodLevel: 0 };
    c.max = (15 + 5.5 * size) * cfg.patience * lerp(1, 0.78, p);
    c.patience = c.max;
    ch.setPos(c.x, c.z);
    ch.face(c.yaw);
    this.scene.add(ch.root);
    this.customers.push(c);
    return c;
  }

  _makeBubble(c) {
    const bar = el('i');
    const items = c.order.map((o) => el('span.it', o.done ? { class: 'it done' } : null, ITEMS[o.id].icon));
    c.bubble = el('div.ss-bubble', el('div', items), el('div.ss-pat', bar));
    c.bar = bar; c.itemEls = items;
    this.hud.appendChild(c.bubble);
  }
  _dropBubble(c) { if (c.bubble) { c.bubble.remove(); c.bubble = null; } }

  _walk(c, tx, tz, speed, dt) {
    const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { c.x = tx; c.z = tz; c.sp = 0; return true; }
    const step = Math.min(d, speed * dt);
    c.x += (dx / d) * step; c.z += (dz / d) * step;
    c.yaw = Math.atan2(dx, dz);
    c.sp = speed;
    return false;
  }

  _customers(dt) {
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.state === 'in') {
        if (c.leg === 0) { if (this._walk(c, SLOT_X[c.slot], c.z, 5, dt)) c.leg = 1; }
        else if (this._walk(c, SLOT_X[c.slot], SLOT_Z, 5, dt)) { c.state = 'wait'; c.yaw = 0; c.sp = 0; this._makeBubble(c); G.audio.sfx('move'); }
      } else if (c.state === 'wait') {
        c.patience -= dt;
        c.sp = 0; c.yaw = 0;
        const f = c.patience / c.max;
        const lvl = f < 0.28 ? 2 : f < 0.55 ? 1 : 0;
        if (lvl !== c.moodLevel) {
          c.moodLevel = lvl;
          c.bubble.classList.toggle('warn', lvl === 2); c.bubble.classList.toggle('mid', lvl === 1);
          c.ch.setExpr(lvl === 2 ? 'angry' : 'open');
          if (lvl === 2) { c.ch.setBase('panic'); G.audio.sfx('tock'); } else c.ch.setBase('move');
        }
        if (c.patience <= 0) this._stormOff(c);
      } else if (c.state === 'done') {
        c.t -= dt; c.sp = 0;
        if (c.t <= 0) { c.state = 'out'; c.leg = 0; c.ch.setBase('move'); }
      } else if (c.state === 'out') {
        if (c.leg === 0) { if (this._walk(c, c.x, LANE_Z, 5.5, dt)) c.leg = 1; }
        else if (this._walk(c, c.side * 13.5, LANE_Z, 5.5, dt)) { c.ch.dispose(); this.customers.splice(i, 1); }
      }
    }
  }

  _serve(c) {
    let n = 0;
    for (const it of c.order) {
      if (it.done) continue;
      const k = this.tray.indexOf(it.id);
      if (k >= 0) { this.tray.splice(k, 1); it.done = true; n++; }
    }
    const pos = { x: SLOT_X[c.slot], y: 2.6, z: SLOT_Z + 0.6 };
    if (!n) { this._deny(this.tray.length ? 'Not their order!' : 'Tray\'s empty!'); return; }
    this._trayChanged();
    c.order.forEach((o, i) => c.itemEls[i].classList.toggle('done', o.done));
    let gain = 10 * n;
    if (c.order.every((o) => o.done)) {
      const f = clamp(c.patience / c.max, 0, 1);
      this.combo++; this.served++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      gain += 5 * c.order.length + Math.round(15 * f) + 4 * Math.min(this.combo - 1, 6);
      c.state = 'done'; c.t = 0.75;
      this._dropBubble(c);
      c.ch.setBase('move'); c.ch.setExpr('happy', 2); c.ch.play('hop');
      G.audio.sfx('coin');
      this.fx.sparkle({ x: pos.x, y: 1.6, z: SLOT_Z }, 0xfff2a8, 7);
      G.ui.pop(`+${gain}`, pos, this.combo >= 3 ? 'big' : '', 1);
    } else {
      G.audio.sfx('good');
      G.ui.pop(`+${gain}`, pos, 'small', 0.9);
    }
    this.score += gain;
    this.P.ch.play('toss');
  }

  _stormOff(c) {
    this.score = Math.max(0, this.score - 15);
    this.combo = 0; this.lost++;
    c.state = 'done'; c.t = 0.6;
    this._dropBubble(c);
    c.ch.setBase('move'); c.ch.setExpr('angry', 3); c.ch.play('shake');
    G.audio.sfx('deny');
    G.ui.pop('Hmph! −15', { x: SLOT_X[c.slot], y: 2.6, z: SLOT_Z + 0.6 }, 'bad', 1.1);
    this.fx.burst('puff', { x: c.x, y: 2.1, z: c.z }, 4, { speed: 1.2, up: 1.4, life: 0.5, s0: 0.3, color: 0x6a5a6e, g: 0 });
  }

  // ================================================================ stations
  _stations(dt) {
    const st = this.st, cfg = this.cfg;
    if (st.popcorn.stock < 2) {
      st.popcorn.t += dt;
      if (st.popcorn.t >= cfg.popT) {
        st.popcorn.t = 0; st.popcorn.stock++;
        G.audio.sfx('pop');
        this.fx.burst('puff', { x: st.popcorn.mx + 0.6, y: 1.5, z: st.popcorn.mz }, 6, { speed: 1.6, up: 2.2, life: 0.45, s0: 0.2, color: 0xfff1a8 });
      }
    } else st.popcorn.t = 0;
    if (st.pretzel.cd > 0) st.pretzel.cd -= dt;
    st.grill.slots.forEach((g, i) => {
      if (g.state === 'cooking') {
        g.t += dt;
        if (g.t >= COOK) { g.state = 'ready'; g.t = 0; G.audio.sfx('ding'); this.fx.sparkle({ x: st.grill.mx + 0.2, y: 1.4, z: st.grill.mz + (i ? -0.42 : 0.42) }, 0xfff2a8, 5); }
      } else if (g.state === 'ready') {
        g.t += dt;
        if (g.t >= cfg.readyT) { g.state = 'burnt'; g.t = 0; G.audio.sfx('buzz'); }
      }
    });
  }

  _verb(s) {
    if (s.id === 'popcorn') return s.stock > 0 ? 'Grab popcorn' : 'Still popping…';
    if (s.id === 'pretzel') return 'Grab a pretzel';
    if (s.id === 'soda') return 'Pour a soda';
    if (s.id === 'cocoa') return 'Hold to pour cocoa';
    const g = s.slots;
    if (g.some((x) => x.state === 'ready')) return 'Take the hot dog';
    if (g.some((x) => x.state === 'burnt')) return 'Scrape off the burnt one';
    if (g.some((x) => x.state === 'empty')) return 'Grill a hot dog';
    return 'Cooking…';
  }

  _give(id) {
    this.tray.push(id);
    this._trayChanged();
    G.audio.sfx('catch');
    this.P.ch.play('toss');
  }

  _deny(text) {
    G.audio.sfx('deny');
    if (this._denyT > 0) return;
    this._denyT = 0.5;
    G.ui.pop(text, { x: this.P.x, y: 2.5, z: this.P.z }, 'white small', 0.8);
  }

  _use() {
    const c = this.ctx;
    if (!c) return;
    if (c.type === 'customer') { this._serve(c.ref); return; }
    const s = c.ref, full = this.tray.length >= TRAY_MAX;
    if (s.id === 'popcorn') {
      if (full) return this._deny('Tray\'s full!');
      if (s.stock <= 0) return this._deny('Still popping…');
      s.stock--; this._give('popcorn');
    } else if (s.id === 'pretzel') {
      if (full) return this._deny('Tray\'s full!');
      if (s.cd > 0) return;
      s.cd = 0.45; this._give('pretzel');
    } else if (s.id === 'grill') {
      const ready = s.slots.find((x) => x.state === 'ready'), burnt = s.slots.find((x) => x.state === 'burnt'), empty = s.slots.find((x) => x.state === 'empty');
      if (ready && !full) { ready.state = 'empty'; ready.t = 0; this._give('hotdog'); }
      else if (burnt) {
        burnt.state = 'empty'; burnt.t = 0;
        this.score = Math.max(0, this.score - 3);
        G.audio.sfx('back');
        G.ui.pop('Burnt! −3', { x: s.mx + 0.4, y: 2.2, z: s.mz }, 'bad small', 0.9);
        this.fx.burst('puff', { x: s.mx + 0.3, y: 1.3, z: s.mz }, 5, { speed: 1.4, up: 1.6, life: 0.5, s0: 0.35, color: 0x3a3340, g: 0 });
      } else if (empty) { empty.state = 'cooking'; empty.t = 0; G.audio.sfx('sizzle'); this.P.ch.play('toss'); }
      else if (ready && full) this._deny('Tray\'s full!');
      else this._deny('Grill\'s full!');
    } else if (s.id === 'soda') {
      if (full) return this._deny('Tray\'s full!');
      this.pour = { kind: 'soda', t: 0, dur: this.cfg.sodaDur, g0: this.cfg.sodaZone[0], g1: this.cfg.sodaZone[1], st: s };
      this._showMeter();
      G.audio.sfx('fizz');
    } else if (s.id === 'cocoa') {
      if (full) return this._deny('Tray\'s full!');
      this.pour = { kind: 'cocoa', t: 0, dur: 1.3, g0: 0.66, g1: 0.9, st: s };
      this._showMeter();
      G.audio.sfx('fizz');
    }
  }

  _showMeter() {
    const pr = this.pour, m = this.elMeter;
    m.style.display = '';
    m.classList.toggle('cocoa', pr.kind === 'cocoa');
    const em = m.children[0];
    em.style.left = `${pr.g0 * 100}%`; em.style.width = `${(pr.g1 - pr.g0) * 100}%`;
    pr.st.obj.userData.cup.visible = true;
  }

  _pourTick(dt) {
    const pr = this.pour, inp = G.input;
    pr.t += dt / pr.dur;
    const grade = () => (pr.t >= pr.g0 && pr.t <= pr.g1 ? 'good' : pr.t < pr.g0 ? 'short' : 'over');
    if (pr.kind === 'soda') { if (pr.t > 0.08 && inp.hit('a')) return this._pourEnd(grade()); }
    else if (pr.t > 0.05 && !inp.down('a')) return this._pourEnd(grade());
    if (pr.t >= 1) this._pourEnd('over');
  }

  _pourEnd(res) {
    const pr = this.pour;
    this.pour = null;
    this.elMeter.style.display = 'none';
    pr.st.obj.userData.cup.visible = false;
    const pos = { x: pr.st.mx * 0.86, y: 2.4, z: pr.st.mz - (pr.kind === 'cocoa' ? 1.2 : 0) };
    if (res === 'good') {
      this._give(pr.kind);
      G.audio.sfx('good');
      G.ui.pop('Perfect pour!', pos, 'green small', 0.8);
    } else if (res === 'short') {
      this.stun = 0.25;
      G.audio.sfx('miss');
      G.ui.pop('Half a cup…', pos, 'white small', 0.8);
    } else {
      this.stun = 0.5;
      G.audio.sfx('splash');
      G.ui.pop('Spilled!', pos, 'bad small', 0.9);
      this.fx.burst('drop', { x: pr.st.ux * 1.06, y: 1.1, z: pr.st.uz + (pr.kind === 'cocoa' ? 0.5 : 0) }, 9, { speed: 2.6, up: 2.6, life: 0.5, s0: 0.22, color: pr.kind === 'cocoa' ? 0x8a5a34 : 0x9be8ff });
      this.P.ch.play('flinch');
    }
  }

  _toss() {
    if (!this.tray.length) return;
    this.tray.pop();
    this._trayChanged();
    G.audio.sfx('back');
    this.fx.burst('puff', { x: this.P.x, y: 1.2, z: this.P.z }, 4, { speed: 1.4, up: 1.4, life: 0.35, s0: 0.3, color: 0xfff4dc, g: 0 });
  }

  _trayChanged() {
    for (const m of this.trayItems) m.removeFromParent();
    this.trayItems = [];
    const n = this.tray.length;
    this.tray.forEach((id, i) => {
      const m = itemModel(id);
      m.position.set((i - (n - 1) / 2) * 0.3, 0.03, 0);
      m.scale.setScalar(1.15);
      this.trayG.add(m);
      this.trayItems.push(m);
    });
    this.trayG.visible = n > 0;
    for (let i = 0; i < TRAY_MAX; i++) {
      const s = this.elTray.children[i + 1];
      s.textContent = this.tray[i] ? ITEMS[this.tray[i]].icon : '';
      s.classList.toggle('on', !!this.tray[i]);
    }
  }

  // ================================================================ player
  _player(dt) {
    const P = this.P, inp = G.input;
    if (this.stun > 0) this.stun -= dt;
    if (this._denyT > 0) this._denyT -= dt;
    const free = !this.pour && this.stun <= 0;
    const ax = free ? inp.axis() : { x: 0, y: 0 };
    P.vx = damp(P.vx, ax.x * SPEED, 16, dt);
    P.vz = damp(P.vz, ax.y * SPEED, 16, dt);
    P.x = clamp(P.x + P.vx * dt, B.x0, B.x1);
    P.z = clamp(P.z + P.vz * dt, B.z0, B.z1);
    P.sp = Math.hypot(P.vx, P.vz);
    if (P.sp > 0.7) P.yaw = Math.atan2(P.vx, P.vz);
    this.stepD = (this.stepD || 0) + P.sp * dt;
    if (this.stepD > 1.7) { this.stepD = 0; G.audio.sfx('step'); }
    // what would the action button do right now?
    let best = null, bd = 1e9;
    for (const s of this.stations) {
      const d = Math.hypot(P.x - s.ux, P.z - s.uz);
      if (d < 1.3 && d < bd) { bd = d; best = { type: 'station', ref: s }; }
    }
    for (const c of this.customers) {
      if (c.state !== 'wait') continue;
      const d = Math.hypot(P.x - SLOT_X[c.slot], (P.z - B.z0) * 0.8);
      if (d < 1.5 && d < bd) { bd = d; best = { type: 'customer', ref: c }; }
    }
    this.ctx = best;
    if (this.pour) {
      P.yaw = Math.atan2(this.pour.st.mx - P.x, this.pour.st.mz - P.z);
      this._pourTick(dt);
    } else if (this.stun <= 0) {
      if (inp.hit('a')) {
        if (best) {
          const tx = best.type === 'station' ? best.ref.mx : SLOT_X[best.ref.slot], tz = best.type === 'station' ? best.ref.mz : SLOT_Z;
          P.yaw = Math.atan2(tx - P.x, tz - P.z);
        }
        this._use();
      }
      if (inp.hit('b')) this._toss();
    }
  }

  // ================================================================ autopilot (QA + tuning):  ?mg=snack&auto=1&skill=0.7
  _botGoal() {
    const st = this.st, tray = this.tray;
    const waiting = this.customers.filter((c) => c.state === 'wait').sort((a, b) => a.patience - b.patience);
    const need = (c) => c.order.filter((o) => !o.done).map((o) => o.id);
    const cover = (c) => { const t = tray.slice(); let n = 0; for (const id of need(c)) { const k = t.indexOf(id); if (k >= 0) { t.splice(k, 1); n++; } } return n; };
    const full = tray.length >= TRAY_MAX;
    const useSt = (s, press = 'a') => ({ x: s.ux, z: s.uz, type: 'station', ref: s, press });
    const serve = (c) => ({ x: SLOT_X[c.slot], z: B.z0 + 0.25, type: 'customer', ref: c, press: 'a' });
    if (!waiting.length) return { x: 0, z: 0.4, type: 'idle' };
    let best = null, bs = -1;
    for (const c of waiting) {
      const n = cover(c);
      if (!n) continue;
      const complete = n === need(c).length;
      const sc = (complete ? 100 : 0) + n * 10 + (40 - c.patience);
      if (sc > bs) { bs = sc; best = { c, complete }; }
    }
    // dogs that someone is waiting for but nobody has started yet
    const dogsWanted = waiting.reduce((a, c) => a + need(c).filter((id) => id === 'hotdog').length, 0);
    const dogsComing = tray.filter((t) => t === 'hotdog').length + st.grill.slots.filter((g) => g.state === 'cooking' || g.state === 'ready').length;
    const burnt = st.grill.slots.some((g) => g.state === 'burnt');
    if (burnt && dogsWanted > dogsComing) return useSt(st.grill);
    if (dogsWanted > dogsComing && st.grill.slots.some((g) => g.state === 'empty')) return useSt(st.grill);
    if (best && (best.complete || full)) return serve(best.c);
    if (full && !best) return { type: 'toss' };
    // fetch what the most urgent fan still needs
    const c0 = waiting[0];
    const t = tray.slice();
    const missing = [];
    for (const id of need(c0)) { const k = t.indexOf(id); if (k >= 0) t.splice(k, 1); else missing.push(id); }
    for (const id of ['hotdog', 'soda', 'cocoa', 'popcorn', 'pretzel']) {
      if (!missing.includes(id)) continue;
      if (id === 'hotdog') { if (st.grill.slots.some((g) => g.state === 'ready')) return useSt(st.grill); continue; }
      if (id === 'popcorn') { if (st.popcorn.stock > 0) return useSt(st.popcorn); continue; }
      if (id === 'soda') return useSt(st.soda);
      if (id === 'pretzel') return useSt(st.pretzel);
      if (id === 'cocoa' && st.cocoa) return useSt(st.cocoa, 'hold');
    }
    if (best) return serve(best.c);
    // nothing to do but wait for the grill / popper
    if (missing.includes('hotdog')) return { x: st.grill.ux, z: st.grill.uz, type: 'wait' };
    if (missing.includes('popcorn')) return { x: st.popcorn.ux, z: st.popcorn.uz, type: 'wait' };
    return { x: 0, z: 0.4, type: 'idle' };
  }

  _bot(dt) {
    const b = this.bot || (this.bot = { skill: this.opts.skill ?? 0.7, wait: 0, aim: null, key: null });
    const inp = G.input, P = this.P;
    inp.setAxis(0, 0);
    if (this.pour) {
      const pr = this.pour;
      if (b.aim === null) {
        b.aim = pr.g0 + (pr.g1 - pr.g0) * (0.25 + 0.5 * Math.random());
        if (Math.random() < (1 - b.skill) * 0.45) b.aim += Math.random() < 0.5 ? -0.22 : 0.2;
      }
      if (pr.kind === 'soda') { if (pr.t >= b.aim) { inp.press('a'); b.aim = null; } }
      else if (pr.t >= b.aim) { inp.hold('a', false); b.aim = null; } else inp.hold('a', true);
      return;
    }
    b.aim = null;
    inp.hold('a', false);
    if (this.stun > 0) return;
    if (b.wait > 0) { b.wait -= dt; return; }
    const g = this._botGoal();
    if (g.type === 'toss') { inp.press('b'); b.wait = 0.2; return; }
    // a person needs a beat to read the orders and decide; the lower the skill, the longer the beat
    const key = `${g.type}:${g.ref ? (g.ref.id || g.ref.slot) : ''}`;
    if (key !== b.key) { b.key = key; b.wait = (1 - b.skill) * 1.5 * (0.4 + 0.6 * Math.random()); if (b.wait > 0.02) return; }
    const dx = g.x - P.x, dz = g.z - P.z, d = Math.hypot(dx, dz);
    const pace = 0.72 + 0.28 * b.skill;
    if (d > 0.3) { inp.setAxis((dx / d) * pace, (dz / d) * pace); return; }
    if (!g.press) return;
    if (this.ctx && this.ctx.ref === g.ref) {
      inp.press('a');
      if (g.press === 'hold') inp.hold('a', true);
      b.wait = 0.06 + (1 - b.skill) * 0.5 * (0.5 + Math.random());
      b.key = null;
    }
  }

  // ================================================================ every frame
  ambient(dt) {
    this.t += dt;
    const P = this.P, st = this.st;
    P.ch.setPos(P.x, P.z);
    P.ch.face(P.yaw, dt, 18);
    P.ch.update(dt, this.playing ? P.sp : 0);
    if (this.tray.length) { P.ch.armL.rotation.set(-1.25, 0, -0.22); P.ch.armR.rotation.set(-1.25, 0, 0.22); }
    for (const c of this.customers) {
      c.ch.setPos(c.x, c.z);
      c.ch.face(c.yaw, dt, 12);
      c.ch.update(dt, this.playing || c.state === 'out' ? c.sp : 0);
    }
    if (this.state === 'over') {
      // stragglers wander off while the results card is up
      for (let i = this.customers.length - 1; i >= 0; i--) {
        const c = this.customers[i];
        if (c.leg === 0) { if (this._walk(c, c.x, LANE_Z, 5.5, dt)) c.leg = 1; }
        else if (this._walk(c, c.side * 13.5, LANE_Z, 5.5, dt)) { c.ch.dispose(); this.customers.splice(i, 1); }
      }
    }
    // station dressing
    const pc = st.popcorn.obj.userData;
    pc.bags.forEach((b, i) => { b.visible = i < st.popcorn.stock; });
    pc.pile.scale.set(1, 0.32 + 0.14 * st.popcorn.stock + (st.popcorn.stock < 2 ? Math.sin(this.t * 30) * 0.02 : 0), 0.8);
    if (st.popcorn.stock < 2 && this.playing && Math.random() < dt * 9) this.fx.emit('puff', st.popcorn.mx + (Math.random() - 0.5) * 0.5, 1.4, st.popcorn.mz + (Math.random() - 0.5) * 0.6, { vy: 1.6, g: -6, life: 0.3, s0: 0.12, color: 0xfff1a8 });
    st.grill.slots.forEach((g, i) => {
      const d = st.grill.obj.userData.dogs[i];
      d.visible = g.state !== 'empty';
      const col = d.userData.mat.color;
      if (g.state === 'cooking') col.setHex(0xf2a9a0).lerp(_cooked, clamp(g.t / COOK, 0, 1));
      else if (g.state === 'ready') col.copy(_cooked).lerp(_dark, clamp((g.t / this.cfg.readyT - 0.6) / 0.4, 0, 1) * 0.5);
      else if (g.state === 'burnt') col.copy(_burnt);
      const wx = st.grill.mx + 0.02, wz = st.grill.mz + (i ? -0.42 : 0.42);
      if (this.playing && g.state === 'cooking' && Math.random() < dt * 5) this.fx.emit('spark', wx, 1.15, wz, { vx: (Math.random() - 0.5) * 1.5, vy: 1.6, vz: (Math.random() - 0.5) * 1.5, g: -6, life: 0.3, s0: 0.14, color: 0xffd45a });
      if (this.playing && g.state === 'burnt' && Math.random() < dt * 8) this.fx.emit('puff', wx, 1.2, wz, { vx: (Math.random() - 0.5) * 0.4, vy: 1.5, g: 0, drag: 0.6, life: 0.9, s0: 0.2, s1: 0.5, color: 0x4a4450 });
      // progress pip over each slot
      const bar = this.bars[`g${i}`];
      if (g.state === 'empty' || !this.playing) bar.style.display = 'none';
      else {
        bar.style.display = '';
        const [x, y] = this._px(wx, 1.9, wz);
        bar.style.left = `${x}px`; bar.style.top = `${y}px`;
        const f = g.state === 'cooking' ? g.t / COOK : g.state === 'ready' ? 1 - g.t / this.cfg.readyT : 1;
        bar.firstChild.style.width = `${clamp(f, 0, 1) * 100}%`;
        bar.className = `ss-bar${g.state === 'ready' ? (f < 0.35 ? ' late' : ' ready') : g.state === 'burnt' ? ' late' : ''}`;
      }
    });
    {
      const bar = this.bars.pop;
      if (st.popcorn.stock > 0 || !this.playing) bar.style.display = 'none';
      else {
        bar.style.display = '';
        const [x, y] = this._px(st.popcorn.mx + 0.3, 3.0, st.popcorn.mz);
        bar.style.left = `${x}px`; bar.style.top = `${y}px`;
        bar.firstChild.style.width = `${clamp(st.popcorn.t / this.cfg.popT, 0, 1) * 100}%`;
      }
    }
    this.bulbs.forEach((b, i) => { b.scale.setScalar(1 + Math.sin(this.t * 3 + i * 1.3) * 0.18); });
    // fan order bubbles
    for (const c of this.customers) {
      if (!c.bubble) continue;
      const [x, y] = this._px(c.x, c.ch.height + 0.4, c.z);
      c.bubble.style.left = `${x}px`; c.bubble.style.top = `${y}px`;
      c.bar.style.width = `${clamp(c.patience / c.max, 0, 1) * 100}%`;
    }
    // pour meter
    if (this.pour) {
      const pr = this.pour, m = this.elMeter;
      const [x, y] = this._px(pr.st.ux, 3.3, pr.st.uz);
      m.style.left = `${x}px`; m.style.top = `${y}px`;
      const k = clamp(pr.t, 0, 1);
      m.children[1].style.width = `${k * 100}%`;
      m.children[2].style.left = `${k * 100}%`;
      const cup = pr.st.obj.userData.cup;
      cup.scale.setScalar(1 + k * 0.25);
    }
    // context prompt
    const c = this.playing && !this.pour && this.stun <= 0 ? this.ctx : null;
    if (c) {
      const label = c.type === 'station' ? this._verb(c.ref) : 'Serve';
      const key = `${label}|${G.input.device}`;
      if (key !== this._pkey) { this._pkey = key; this.elPrompt.innerHTML = `${G.ui.key('a')} ${label}`; }
      const [sx, sy] = this._px(P.x, 2.75, P.z);
      this.elPrompt.style.display = '';
      this.elPrompt.style.left = `${sx}px`; this.elPrompt.style.top = `${sy}px`;
    } else this.elPrompt.style.display = 'none';
    this.elTray.style.display = this.state === 'over' ? 'none' : '';
    for (const t of this.tags) {
      const [x, y] = this._px(t.s.mx * 1.03, t.s.h + 0.15, t.s.mz + (t.s.id === 'cocoa' ? 0.2 : 0));
      t.el.style.left = `${x}px`; t.el.style.top = `${y}px`;
      t.el.classList.toggle('off', t.s.id === 'popcorn' && t.s.stock === 0);
    }
  }

  cleanup() {
    for (const c of this.customers) { c.ch.dispose(); this._dropBubble(c); }
    this.P.ch.dispose();
    G.input.hold('a', false);
    G.input.setAxis(0, 0);
  }
}

const HARD_META = { ...SnackShackRush.meta, goals: [150, 360, 620] };
const _cooked = new THREE.Color(0xb5452f);
const _dark = new THREE.Color(0x3a2a26);
const _burnt = new THREE.Color(0x2b2226);

