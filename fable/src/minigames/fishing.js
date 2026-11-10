// FISHING — off the dock at the Huddle Hollow pond.
// Hold to wind up a cast and release; wait for the bobber to go under and hook
// it; then reel while the fish rests and ease off when it runs. Far water
// hides rarer fish, and a few things only bite after dark.
//
// Launched as G.hooks.minigame('fishing', { night }). Not medal-based: the
// "score" is the coin value of what you landed this session. Catches are
// written to the save (G.S.fish counts, G.S.seen.fishBest sizes); selling
// them is the shop's job.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { toon, flat, lit, M, rbox, box, cyl, cone, sphere, circle, torus, lightRig, glowSprite, bake, disposeTree } from '../art/kit.js';
import { PROPS } from '../art/props.js';
import { Character } from '../art/characters.js';
import { teamSpec, CAST, displayName } from '../data/cast.js';
import { FISH } from '../data/items.js';
import { clamp, lerp, damp, el, TAU, makeRng, ease } from '../core/util.js';

const MAX_CASTS = 8;
const POND = { x: 4.5, z: -0.5, rx: 12.5, rz: 7.6 };
const DOCK_Y = 0.5;
const CAP = { x: -4.0, z: 2.4 };                    // where the Captain stands
const NEAR = { x: 0.6, z: 1.9 }, FAR = { x: 11.6, z: -0.9 };   // shortest and longest cast
const LAND = { x: -1.3, z: 2.5 };                   // where a hooked fish is hauled to

const FISH_LOOK = {
  bluegill: [0x4f8fd0, 0xf2a03c], perch: [0xf08a24, 0x5f9a4a], catfish: [0x6a6f7a, 0xd9d2c2],
  koi: [0xfdf6ea, 0xf08a24], whistle_fish: [0x8fc7a8, 0xe6efe8], ghost_carp: [0xcfeee4, 0xffffff],
};

function injectCss() {
  if (document.getElementById('mg-fishing-css')) return;
  const s = document.createElement('style');
  s.id = 'mg-fishing-css';
  s.textContent = `
.fish-ui { position: absolute; left: 50%; bottom: 2.8em; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 0.5em; width: 26em; }
.fish-msg { white-space: nowrap; }
.fish-msg { font-weight: 900; font-size: 1.25em; color: var(--cream); text-align: center; text-shadow: 0 0.1em 0 var(--ink), 0 0 0.5em rgba(27,16,36,0.95); min-height: 1.4em; }
.fish-msg.alert { color: var(--gold); font-size: 1.7em; animation: fishpulse .18s ease-in-out infinite alternate; }
.fish-msg.warn { color: #ff8f7a; }
@keyframes fishpulse { to { transform: scale(1.12); } }
.fish-cast { width: 100%; height: 1.4em; }
.fish-cast > i { background: linear-gradient(90deg, #74c8d6, #58b8c9 55%, #2a6f77); transition: none; }
.fish-cast > span { position: absolute; right: 0.5em; top: 0; bottom: 0; display: flex; align-items: center; font-size: 0.72em; font-weight: 900; color: var(--cream); letter-spacing: .08em; opacity: 0.85; }
.fish-reel { width: 100%; display: flex; flex-direction: column; gap: 0.4em; }
.fish-tension { position: relative; height: 1.5em; border: 0.2em solid var(--ink); border-radius: 0.8em; overflow: hidden; background: linear-gradient(90deg, #6aa84f 0%, #6aa84f 62%, #ffd45a 62%, #ffd45a 84%, #d4502f 84%, #d4502f 100%); }
.fish-tension.surge { box-shadow: 0 0 0 0.22em #ff8f7a; animation: fishpulse .12s ease-in-out infinite alternate; }
.fish-tension > b { position: absolute; top: -0.2em; bottom: -0.2em; width: 0.5em; margin-left: -0.25em; background: var(--cream); border: 0.14em solid var(--ink); border-radius: 0.3em; }
.fish-tension > span { position: absolute; left: 0.6em; top: 0; bottom: 0; display: flex; align-items: center; font-size: 0.7em; font-weight: 900; letter-spacing: .1em; color: rgba(43,26,51,0.8); }
.fish-prog { position: relative; height: 1.1em; border: 0.18em solid var(--ink); border-radius: 0.7em; background: rgba(27,16,36,0.6); }
.fish-prog > i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--sky); border-radius: 0.5em; }
.fish-prog > em { position: absolute; top: 50%; transform: translate(-50%, -54%); font-style: normal; font-size: 1.5em; }
.fish-prog > span { position: absolute; right: -1.5em; top: 50%; transform: translateY(-50%); font-size: 1.2em; }
.fish-card { position: absolute; left: 50%; top: 17%; transform: translateX(-50%) rotate(-2deg); text-align: center; background: var(--cream); border: 0.3em solid var(--ink); border-radius: 1.3em; padding: 0.4em 1.6em 0.7em; box-shadow: 0 0.45em 0 rgba(27,16,36,0.6); animation: fishcard .35s cubic-bezier(.2,1.5,.4,1); min-width: 14em; }
.fish-card .fi { font-size: 3em; line-height: 1.1; }
.fish-card .fn { font-weight: 900; font-size: 1.5em; line-height: 1.05; }
.fish-card .fs { font-weight: 800; }
.fish-card .tag { margin-top: 0.35em; background: var(--maple); }
.fish-card .more { font-size: 0.8em; font-weight: 800; opacity: 0.7; margin-top: 0.3em; }
@keyframes fishcard { from { transform: translateX(-50%) rotate(-10deg) scale(.4); opacity: 0; } }
`;
  document.head.appendChild(s);
}

/** A chunky toy fish (or boot, or mouthguard), nose toward +x, about `len` long. */
function buildCatch(id, len, night) {
  const g = new THREE.Group();
  if (id === 'boot') {
    const c = toon(0x6a4a2e);
    g.add(M(rbox(0.95, 0.34, 0.42, 0.1), c, 0.1, 0, 0));
    g.add(M(rbox(0.44, 0.74, 0.42, 0.1), c, -0.2, 0.36, 0));
    g.add(M(box(0.99, 0.08, 0.46), toon(0x2b1a33), 0.1, -0.2, 0));
    for (let i = 0; i < 3; i++) g.add(M(sphere(0.045, 6, 5), toon(0xfff4dc), 0.05 + i * 0.16, 0.2, 0.22, { shadow: false }));
    g.add(M(cyl(0.05, 0.05, 0.12, 6), toon(0x6aa84f), -0.2, 0.78, 0.05));     // a sprig of pondweed
  } else if (id === 'mouthguard') {
    g.add(M(torus(0.3, 0.09, 6, 12, Math.PI), toon(0x58b8c9), 0, 0, 0, { rx: Math.PI / 2 }));
    g.add(M(torus(0.3, 0.05, 5, 12, Math.PI), toon(0xfff4dc), 0, 0.06, 0, { rx: Math.PI / 2, shadow: false }));
  } else {
    const [a, b] = FISH_LOOK[id] || [0x7fa8c8, 0xe8e8ee];
    const ghost = id === 'ghost_carp';
    const body = ghost ? new THREE.MeshToonMaterial({ color: a, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: 0.72, emissive: a, emissiveIntensity: 0.35 }) : (id === 'koi' && night ? lit(a, 0xffb05a, 0.5) : toon(a));
    const trim = id === 'koi' && night ? lit(b, 0xff8a2a, 1.1) : toon(b);
    g.add(M(sphere(0.34, 14, 10), body, 0, 0, 0, { sx: 1.5, sy: 0.82, sz: 0.5 }));
    g.add(M(sphere(0.27, 12, 8), trim, 0.03, -0.1, 0, { sx: 1.35, sy: 0.6, sz: 0.46, shadow: false }));
    g.add(M(cone(0.26, 0.42, 4), trim, -0.62, 0, 0, { rz: -Math.PI / 2, sz: 0.3 }));
    g.add(M(cone(0.16, 0.3, 4), trim, -0.05, 0.3, 0, { sz: 0.25, rz: 0.35 }));
    for (const s of [-1, 1]) {
      g.add(M(sphere(0.07, 8, 6), toon(0xffffff), 0.3, 0.07, s * 0.14, { shadow: false }));
      g.add(M(sphere(0.04, 6, 5), toon(0x231a26), 0.33, 0.07, s * 0.17, { shadow: false }));
    }
    if (id === 'catfish') for (const s of [-1, 1]) g.add(M(cyl(0.012, 0.012, 0.36, 4), toon(0x3a3340), 0.52, -0.06, s * 0.12, { rz: Math.PI / 2 - 0.3, rx: s * 0.5, shadow: false }));
    if (id === 'koi') for (const [x, z] of [[0.15, 0.14], [-0.2, -0.13], [-0.05, 0.15]]) g.add(M(sphere(0.12, 8, 6), trim, x, 0.12, z, { sz: 0.4, shadow: false }));
    if (id === 'whistle_fish') g.add(M(cyl(0.05, 0.05, 0.1, 8), toon(0xc9d2da), 0.52, 0, 0, { rz: Math.PI / 2, shadow: false }));
    if (ghost || (id === 'koi' && night)) { const gl = glowSprite(ghost ? 0xbfeee0 : 0xffb05a, 2.4, 0.45); g.add(gl); }
  }
  g.scale.setScalar(len / 1.2);
  return g;
}

export default class Fishing extends Minigame {
  static meta = {
    id: 'fishing', title: 'Fishing', icon: '🎣',
    blurb: 'Cast off the dock and see what bites. The far, deep water hides rarer fish — and a few things only come up after dark.',
    controls: [['a', 'hold to wind up a cast, release to throw · press to hook · hold to reel'], ['b', 'pack up']],
    scoreLabel: 'coins\' worth of fish', goals: null, hasHard: false, music: 'town',
  };
  get meta() { const m = Fishing.meta; return this.opts && this.opts.night ? { ...m, music: 'night' } : m; }

  setup(opts) {
    injectCss();
    const S = G.S;
    this.night = opts.night !== undefined ? !!opts.night : S.tod === 'night';
    const total = Object.values(S.fish || {}).reduce((a, b) => a + b, 0);
    this.rng = makeRng(opts.seed ?? Math.floor((S.playTime || 0) * 997 + total * 7919 + 4217));
    this.fxr = makeRng(99);                 // cosmetic wandering only
    this.caught = [];
    this.value = 0;
    this.casts = 0;
    this.camera.fov = 22; this.camera.near = 1; this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    this.rig = lightRig(this.scene, this.night ? 'night' : (opts.tod === 'day' || opts.tod === 'dusk' ? opts.tod : S.tod === 'dusk' ? 'dusk' : 'day'), { shadowSize: 28, fog: [70, 190] });
    this.cam = { x: 2.6, z: 0.2, d: 44 };
    this._buildPond();
    this._buildAnglers();
    this._buildTackle();
    this._buildUi();
    this.ph = 'idle'; this.pt = 0; this.needRelease = true;
    this.bob = { x: 0, y: 0, z: 0, on: false, dip: 0 };
    this.msg = '';
    this._placeCamera(0, true);
    this._ui();
  }

  cleanup() {
    for (const g of [this.world, this.tackle]) if (g) { this.scene.remove(g); disposeTree(g); }
    this.captain.dispose();
    for (const p of this.pals) p.ch.dispose();
  }

  // ---------------------------------------------------------------- scenery
  _buildPond() {
    const g = new THREE.Group();
    const night = this.night;
    const lawn = M(new THREE.PlaneGeometry(200, 160), toon(0x86b860), 0, -0.02, 0, { rx: -Math.PI / 2, shadow: false });
    lawn.userData.keep = true;
    g.add(lawn);
    const disc = (rx, rz, col, x, y, z, keep) => { const m = M(circle(1, 40), toon(col), x, y, z, { rx: -Math.PI / 2, shadow: false }); m.scale.set(rx, rz, 1); if (keep) m.userData.keep = true; g.add(m); return m; };
    disc(POND.rx + 0.9, POND.rz + 0.9, 0xcdbd8c, POND.x, 0.0, POND.z);
    disc(POND.rx + 0.3, POND.rz + 0.3, 0xb8a77c, POND.x, 0.006, POND.z);
    disc(POND.rx, POND.rz, 0x5fb7c7, POND.x, 0.014, POND.z);
    disc(6.6, 4.7, 0x4a9fbd, 9.4, 0.02, -1.0);                       // the deep end
    disc(4.2, 2.8, 0x3f8fb0, 10, 0.026, -1.1);
    this.glints = [];
    for (const [x, z, rx, rz] of [[-1.5, -3.6, 1.5, 0.17], [3.4, 3.6, 1.2, 0.14], [6.5, -5.2, 1.4, 0.15], [13, 1.6, 1.0, 0.13], [1.2, -0.8, 0.8, 0.11], [-3.4, 0.2, 0.9, 0.12], [9, 3.2, 1.1, 0.13]]) {
      const m = M(circle(1, 16), flat(0xffffff, { transparent: true, opacity: night ? 0.14 : 0.36, depthWrite: false }), x, 0.034, z, { rx: -Math.PI / 2, shadow: false });
      m.scale.set(rx, rz, 1); m.rotation.z = -0.25; m.userData.keep = true; m.renderOrder = 2;
      g.add(m);
      this.glints.push({ m, x, z, ph: x * 1.7 });
    }
    if (night) {                                                     // the moon on the water
      const moon = M(circle(1, 20), flat(0xdfe6ff, { transparent: true, opacity: 0.3, depthWrite: false }), 11.5, 0.036, -4.6, { rx: -Math.PI / 2, shadow: false });
      moon.scale.set(1.5, 1.1, 1); moon.userData.keep = true; moon.renderOrder = 2;
      g.add(moon);
      this.glints.push({ m: moon, x: 11.5, z: -4.6, ph: 0.4 });
    }
    // lily pads
    for (const [x, z, r] of [[-2.4, -4.4, 0.6], [1.4, -5.8, 0.5], [6.2, -6.4, 0.55], [13.6, 3.6, 0.6], [9.2, 5.2, 0.5], [3.4, 5.4, 0.55], [15.2, -2.6, 0.45], [-4.6, -2.2, 0.5]]) {
      g.add(M(cg('lily', () => new THREE.CircleGeometry(1, 14, 0.35, TAU - 0.7)), toon(0x5f9a4a), x, 0.045, z, { rx: -Math.PI / 2, s: r, shadow: false }));
      if ((x * 3 + z) % 2 > 0.8) g.add(M(sphere(0.14, 8, 6), toon(0xf7b9c2), x + 0.1, 0.13, z - 0.05, { sy: 0.7 }));
    }
    // reeds round the shore
    const reedR = makeRng(31);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * TAU + reedR.range(-0.08, 0.08);
      const x = POND.x + Math.cos(a) * (POND.rx + reedR.range(-0.3, 0.5)), z = POND.z + Math.sin(a) * (POND.rz + reedR.range(-0.3, 0.5));
      if (x < -5.5 && z > 0.8 && z < 4.2) continue;                  // keep the dock clear
      if (z > 5.2 && Math.abs(x - 4) < 9) continue;                  // and the view from the camera
      const h = reedR.range(1.0, 1.7);
      g.add(M(cyl(0.035, 0.05, h, 5), toon(0x5f9a4a), x, h / 2, z, { rz: reedR.range(-0.12, 0.12) }));
      g.add(M(cyl(0.085, 0.085, 0.36, 6), toon(0x7a5230), x, h + 0.12, z));
    }
    // the dock
    const wood = toon(0xb07a45), dark = toon(0x8a5a34);
    g.add(M(box(10.2, 0.22, 2.3), wood, -8.2, DOCK_Y - 0.11, CAP.z));
    for (let i = 0; i < 11; i++) g.add(M(box(0.06, 0.02, 2.3), dark, -13 + i * 0.93, DOCK_Y + 0.005, CAP.z, { shadow: false }));
    for (const x of [-12.6, -9.4, -6.2, -3.3]) for (const s of [-1, 1]) g.add(M(cyl(0.16, 0.18, 1.5, 8), dark, x, 0.25, CAP.z + s * 1.2));
    // tackle on the planks
    g.add(M(rbox(0.7, 0.4, 0.44, 0.06), toon(0xd4502f), -5.3, DOCK_Y + 0.2, 1.75));
    g.add(M(box(0.3, 0.06, 0.1), toon(0xc9d2da), -5.3, DOCK_Y + 0.43, 1.75, { shadow: false }));
    g.add(M(cyl(0.26, 0.2, 0.44, 10), toon(0x8f9aa6), -6.3, DOCK_Y + 0.22, 1.7));
    // lantern on the end post
    g.add(M(cyl(0.05, 0.05, 1.3, 6), dark, -3.3, 1.6, CAP.z - 1.2));
    const lantern = M(rbox(0.34, 0.46, 0.34, 0.06), night ? lit(0xffe9a8, 0xffc65a, 1.7) : toon(0xfff1c0), -3.3, 2.35, CAP.z - 1.2, { shadow: false });
    lantern.userData.keep = true;
    g.add(lantern);
    g.add(M(cone(0.3, 0.2, 4), dark, -3.3, 2.7, CAP.z - 1.2, { ry: Math.PI / 4 }));
    if (night) {
      const gl = glowSprite(0xffc65a, 3.6, 0.42); gl.position.set(-3.3, 2.35, CAP.z - 1.2); gl.userData.keep = true; g.add(gl);
      const pl = new THREE.PointLight(0xffc65a, 11, 11, 2); pl.position.set(-3.3, 2.7, CAP.z - 0.9); pl.userData.keep = true; g.add(pl);
    }
    // a rowboat nosing the shore
    const boat = new THREE.Group();
    boat.add(M(rbox(3.0, 0.6, 1.35, 0.3), toon(0x2a6f77), 0, 0.2, 0));
    boat.add(M(rbox(2.5, 0.3, 0.95, 0.2), toon(0x1d4f55), 0, 0.42, 0, { shadow: false }));
    boat.add(M(box(0.3, 0.08, 1.2), wood, -0.3, 0.52, 0));
    boat.add(M(box(0.3, 0.08, 1.2), wood, 0.7, 0.52, 0));
    boat.position.set(-4.8, 0, -3.3); boat.rotation.y = 0.5;
    boat.userData.keep = true;
    g.add(boat);
    this.boat = boat;
    // the bank
    const put = (name, x, z, o = {}) => { const p = PROPS[name](o); p.position.x += x; p.position.z += z; if (o.ry) p.rotation.y += o.ry; g.add(p); return p; };
    const tr = makeRng(12);
    for (const [x, z, s] of [[-12, -9.5, 1.2], [-4, -11.5, 1.3], [5, -12.5, 1.1], [13, -11, 1.3], [20.5, -6, 1.2], [21.5, 5, 1.1], [-15.5, -3.5, 1.1], [-17, 8, 1.2], [27, -12, 1.3], [-22, -11, 1.2]]) put('tree', x, z, { s, rng: tr });
    for (const [x, z] of [[-9.6, -6.6], [18.6, 1.2], [-11.6, 6.2], [16.8, -8.4]]) put('bush', x, z, { color: 0x6aa84f, berries: x > 0 });
    put('rock', -8.8, -1.6, { s: 0.9 }); put('rock', 17.4, -3.4, { s: 0.7 }); put('rock', 6.5, 7.9, { s: 0.6 }); put('rock', -9.4, -2.6, { s: 0.5 });
    put('signPost', -13.6, 5.4, { text: 'POND\nNO DIVING', w: 2.1, h: 1.1 });
    put('bench', -15.4, -0.4, { ry: Math.PI / 2 });
    put('leafPile', 19, 7.6, { color: 0xe8842c }); put('pumpkin', -14.6, 3.4, { s: 0.8 }); put('stump', 14, 8.6);
    put('flowers', -11.2, -4.4, { n: 7 }); put('flowers', 15.6, 6.6, { n: 6 });
    bake(g);
    this.scene.add(g);
    this.world = g;

    // fish shadows cruising under the surface
    this.shadows = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(circle(1, 12), new THREE.MeshBasicMaterial({ color: 0x1d2a4a, transparent: true, opacity: 0.26, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 3;
      const big = i === 0 ? 1.5 : 0.8 + this.fxr() * 0.5;
      m.scale.set(0.62 * big, 0.22 * big, 1);
      m.position.y = 0.04;
      g.add(m);
      const a = this.fxr() * TAU, r = 0.2 + this.fxr() * 0.6;
      this.shadows.push({ m, x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, h: this.fxr() * TAU, sp: 0.5 + this.fxr() * 0.6, turn: 0, tt: 0, big });
    }
    // fireflies after dark
    this.flies = [];
    if (night) for (let i = 0; i < 16; i++) {
      const s = glowSprite(0xd8ff8a, 0.55, 0.9);
      g.add(s);
      this.flies.push({ s, x: -12 + this.fxr() * 30, y: 0.8 + this.fxr() * 2.4, z: -8 + this.fxr() * 15, a: this.fxr() * TAU, b: this.fxr() * TAU, sp: 0.4 + this.fxr() * 0.6 });
    }
  }

  _buildAnglers() {
    const ch = new Character(teamSpec('captain'));
    ch.setPos(CAP.x, CAP.z, DOCK_Y);
    ch.face(Math.PI / 2);
    ch.setBase('fish');
    this.scene.add(ch.root);
    this.captain = ch;
    // the rod rides in the right hand
    const rod = new THREE.Group();
    rod.add(M(cyl(0.022, 0.05, 2.9, 6), toon(0xd9b98a), 0, 1.3, 0));
    rod.add(M(cyl(0.06, 0.06, 0.34, 8), toon(0x2b1a33), 0, 0.02, 0));
    rod.add(M(cyl(0.1, 0.1, 0.08, 10), toon(0xd4502f), 0.07, 0.34, 0, { rz: Math.PI / 2 }));
    const tip = new THREE.Object3D();
    tip.position.y = 2.75;
    rod.add(tip);
    rod.position.set(0, -0.33, 0);
    rod.rotation.x = 2.03;
    ch.armR.add(rod);
    this.rod = rod; this.rodTip = tip;
    // a couple of teammates dangle their feet off the dock
    this.pals = [];
    const ids = (G.S.roster || []).filter((id) => id !== 'captain' && CAST[id] && CAST[id].spec.kind !== 'ghost').slice(0, 2);
    ids.forEach((id, i) => {
      const p = new Character(teamSpec(id));
      p.setPos(-6.3 - i * 1.7, CAP.z + 0.72, DOCK_Y + 0.04);
      p.face(0.25 - i * 0.2);
      p.setBase('sit');
      this.scene.add(p.root);
      this.pals.push({ ch: p, id, t: 2 + i * 1.7 });
    });
  }

  _buildTackle() {
    const g = new THREE.Group();
    this.tackle = g;
    this.scene.add(g);
    // bobber
    const bob = new THREE.Group();
    bob.add(M(sphere(0.2, 10, 8), toon(0xd4502f), 0, 0.06, 0));
    bob.add(M(cg('bobBottom', () => new THREE.SphereGeometry(0.2, 10, 6, 0, TAU, Math.PI / 2, Math.PI / 2)), toon(0xfffaf0), 0, 0.06, 0, { shadow: false }));
    bob.add(M(cyl(0.025, 0.025, 0.3, 5), toon(0xfffaf0), 0, 0.34, 0));
    bob.scale.setScalar(1.5);
    g.add(bob);
    this.bobMesh = bob;
    // the line: a handful of thin segments we re-aim every frame
    this.segs = [];
    const lm = flat(0xfff4dc);
    for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(box(0.06, 0.06, 1), lm); s.castShadow = false; g.add(s); this.segs.push(s); }
    this._p0 = new THREE.Vector3(); this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }

  // ---------------------------------------------------------------- dom
  _buildUi() {
    this.eMsg = el('div.fish-msg');
    this.eCastFill = el('i');
    this.eCast = el('div.meter.fish-cast', this.eCastFill, el('span', 'DEEP WATER ▸'));
    this.eNeedle = el('b');
    this.eTension = el('div.fish-tension', el('span', 'LINE TENSION'), this.eNeedle);
    this.eProgFill = el('i');
    this.eProgFish = el('em', '🐟');
    this.eProg = el('div.fish-prog', this.eProgFill, this.eProgFish, el('span', '🪣'));
    this.eReel = el('div.fish-reel', this.eTension, this.eProg);
    this.eUi = el('div.fish-ui', this.eMsg, this.eCast, this.eReel);
    this.hud.appendChild(this.eUi);
  }
  _say(html, cls = '') {
    const key = `${cls}|${html}`;
    if (key === this._msgKey) return;
    this._msgKey = key;
    this.eMsg.className = `fish-msg${cls ? ' ' + cls : ''}`;
    this.eMsg.innerHTML = html;
  }
  _ui() {
    this.hudScore(`🎣 Cast ${Math.min(this.casts + (this.ph === 'idle' || this.ph === 'charge' ? 1 : 0), MAX_CASTS)}/${MAX_CASTS} · 🪙 ${this.value}`);
    const k = (a) => G.ui.key(a);
    const ph = this.ph;
    this.eCast.style.display = ph === 'idle' || ph === 'charge' ? '' : 'none';
    this.eReel.style.display = ph === 'reel' ? '' : 'none';
    if (ph === 'idle') this._say(`Hold ${k('a')} to wind up a cast · ${k('b')} to pack up`);
    else if (ph === 'charge') this._say('Let go to cast!');
    else if (ph === 'cast') this._say('');
    else if (ph === 'wait') this._say('Wait for it…');
    else if (ph === 'bite') this._say(`${k('a')} HOOK IT!`, 'alert');
    else if (ph === 'reel') {
      const r = this.reel;
      this._say(r.mode === 'surge' ? 'It\'s running — ease off!' : `Hold ${k('a')} to reel`, r.mode === 'surge' ? 'warn' : '');
      this.eNeedle.style.left = `${clamp(r.T, 0, 1) * 100}%`;
      this.eTension.classList.toggle('surge', r.mode === 'surge');
      this.eProgFill.style.width = `${r.P * 100}%`;
      this.eProgFish.style.left = `${r.P * 100}%`;
    } else if (ph === 'miss' || ph === 'catch') this._say(this.msg || '');
    this.eCastFill.style.width = `${(ph === 'charge' ? this.power : 0) * 100}%`;
  }

  // ---------------------------------------------------------------- flow
  begin() { this.needRelease = true; this._ui(); }

  tick(dt) {
    const inp = G.input;
    this.pt -= dt;
    const ph = this.ph;
    if (ph === 'idle') {
      if (!inp.down('a')) this.needRelease = false;
      if (inp.hit('b')) { this._end(); return; }
      if (!this.needRelease && (inp.hit('a') || inp.down('a'))) { this.ph = 'charge'; this.power = 0; this.pdir = 1; G.audio.sfx('tick'); }
    } else if (ph === 'charge') {
      this.power += this.pdir * dt * 0.9;
      if (this.power >= 1) { this.power = 1; this.pdir = -1; }
      if (this.power <= 0.08 && this.pdir < 0) { this.power = 0.08; this.pdir = 1; }
      if (!inp.down('a')) this._cast(this.power);
    } else if (ph === 'cast') {
      // the bobber flies out in an arc
      const k = clamp(1 - this.pt / this.castDur, 0, 1);
      if (k > 0.3) {
        const u = (k - 0.3) / 0.7;
        this.bob.on = true;
        this.bob.x = lerp(this.castFrom.x, this.castTo.x, u);
        this.bob.z = lerp(this.castFrom.z, this.castTo.z, u);
        this.bob.y = lerp(this.castFrom.y, 0.05, u) + Math.sin(u * Math.PI) * (2.2 + this.castPower * 2.4);
      }
      if (this.pt <= 0) this._landed();
    } else if (ph === 'wait') {
      this.wt -= dt; this.waited += dt;
      for (const n of this.nibbles) if (!n.done && this.waited >= n.at) { n.done = true; this.bob.dip = 0.12; G.audio.sfx('tick'); this.fx.emit('ring', this.bob.x, 0.08, this.bob.z, { life: 0.5, s0: 0.3, s1: 1.4, color: 0xffffff }); }
      if (this.waited > 0.4 && inp.hit('a')) { this._miss('Too soon — you spooked it.', 'flinch'); return; }
      if (this.wt <= 0) {
        this.ph = 'bite'; this.pt = this.biteWindow;
        this.bob.dip = 0.5;
        G.audio.sfx('bite');
        G.ui.pop('!', { x: this.bob.x, y: 1.6, z: this.bob.z }, 'big', 0.7);
        this.fx.burst('drop', { x: this.bob.x, y: 0.2, z: this.bob.z }, 8, { speed: 2, up: 3, life: 0.45, s0: 0.22, color: 0x9be8ff });
      }
    } else if (ph === 'bite') {
      if (inp.hit('a')) this._hook();
      else if (this.pt <= 0) this._miss('It got away…', 'shake');
    } else if (ph === 'reel') {
      this._reel(dt, inp.down('a'));
    } else if (ph === 'catch') {
      if ((this.pt < this.catchDur - 0.8 && inp.hit('a')) || this.pt <= 0) this._afterCast();
    } else if (ph === 'miss') {
      if (this.pt <= 0) this._afterCast();
    }
    this._ui();
  }

  _cast(power) {
    this.casts++;
    this.castPower = power;
    this.ph = 'cast';
    this.castDur = G.debug.fast ? 0.5 : 0.95;
    this.pt = this.castDur;
    const jx = this.rng.range(-0.5, 0.5), jz = this.rng.range(-0.6, 0.6);
    this.castTo = { x: lerp(NEAR.x, FAR.x, power) + jx, z: lerp(NEAR.z, FAR.z, power) + jz };
    this.castFrom = { x: CAP.x + 1.6, y: 3.4, z: CAP.z };
    this.captain.play('cast');
    G.audio.sfx('throw');
    this.bob.on = false;
    this._hideCard();
  }

  _landed() {
    this.bob.x = this.castTo.x; this.bob.z = this.castTo.z; this.bob.y = 0.05; this.bob.on = true; this.bob.dip = 0.3;
    G.audio.sfx('splash');
    this.fx.burst('drop', { x: this.bob.x, y: 0.2, z: this.bob.z }, 10, { speed: 2.4, up: 3.4, life: 0.5, s0: 0.24, color: 0x9be8ff });
    this.fx.emit('ring', this.bob.x, 0.08, this.bob.z, { life: 0.7, s0: 0.4, s1: 2.6, color: 0xffffff });
    for (const s of this.shadows) if (Math.hypot(s.x - this.bob.x, s.z - this.bob.z) < 3.2) { s.h = Math.atan2(s.z - this.bob.z, s.x - this.bob.x); s.dash = 0.7; }
    // what is down there, and how long it takes to make up its mind
    this.fish = this._pick(this.castPower);
    this.ph = 'wait';
    this.wt = this.rng.range(1.7, 4.3) * (G.debug.fast ? 0.5 : 1);
    this.waited = 0;
    this.nibbles = [0.35, 0.7].filter(() => this.rng() < 0.6).map((f) => ({ at: this.wt * f, done: false }));
    this.biteWindow = clamp(0.95 - 0.13 * FISH[this.fish.id].diff, 0.5, 0.9);
    // one shadow takes an interest
    let best = null, bd = 1e9;
    for (const s of this.shadows) { const d = Math.hypot(s.x - this.bob.x, s.z - this.bob.z); if (d < bd && d > 1.5) { bd = d; best = s; } }
    this.biter = best;
  }

  _pick(power) {
    const pool = Object.entries(FISH).filter(([, f]) => !f.night || this.night);
    const far = power > 0.7, near = power < 0.35;
    let tot = 0;
    const ws = pool.map(([, f]) => {
      const rare = f.diff >= 1.8, junk = f.diff < 0.9;
      let w = f.w;
      if (far) w *= rare ? 2.3 : junk ? 0.6 : 0.8; else if (near) w *= rare ? 0.35 : junk ? 1.5 : 1.1;
      if (f.night) w *= 1.7;
      tot += w;
      return w;
    });
    let r = this.rng() * tot, pick = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { pick = pool[i]; break; } }
    const [id, f] = pick;
    const size = Math.round(f.size[0] + (f.size[1] - f.size[0]) * Math.pow(this.rng(), far ? 1.25 : 1.8));
    return { id, size };
  }

  _hook() {
    const f = FISH[this.fish.id];
    this.ph = 'reel';
    this.reel = { P: 0.1, T: 0.3, mode: 'calm', mt: this.rng.range(0.9, 1.6), slack: 0, warned: false, k: f.diff, fight: f.diff >= 0.9, tick: 0, from: { x: this.bob.x, z: this.bob.z }, wig: 0 };
    this.captain.play('yank', 0.35);
    G.audio.sfx('catch');
    G.ui.pop('HOOKED!', { x: this.bob.x, y: 1.8, z: this.bob.z }, '', 0.8);
    this.fx.shake(0.1, 0.15);
  }

  _reel(dt, reeling) {
    const r = this.reel, k = r.k;
    if (r.fight) {
      r.mt -= dt;
      if (r.mode === 'calm' && r.mt <= 0.35 && !r.warned) { r.warned = true; G.audio.sfx('tick'); this.bob.dip = 0.25; }
      if (r.mt <= 0) {
        if (r.mode === 'calm') {
          r.mode = 'surge'; r.mt = 0.55 + 0.3 * k + this.rng() * 0.3;
          G.audio.sfx('splash');
          this.fx.burst('drop', { x: this.bob.x, y: 0.2, z: this.bob.z }, 12, { speed: 3, up: 4, life: 0.5, s0: 0.25, color: 0x9be8ff });
        } else { r.mode = 'calm'; r.mt = (1.1 + this.rng() * 1.1) / (0.75 + 0.15 * k); r.warned = false; }
      }
    }
    if (r.mode === 'calm') {
      if (reeling) {
        r.P += (dt * 0.34) / (0.75 + 0.3 * k);
        r.T += (0.34 - r.T) * Math.min(1, dt * 2.2);
        r.slack = Math.max(0, r.slack - dt * 3);
        r.tick -= dt;
        if (r.tick <= 0) { r.tick = 0.16; G.audio.sfx('reel'); }
      } else { r.T -= dt * 0.6; r.slack += dt; r.P -= dt * 0.02 * k; }
    } else {
      if (reeling) { r.T += dt * (0.7 + 0.28 * k); r.P += dt * 0.05; } else { r.T -= dt * 0.35; r.P -= dt * 0.045 * k; }
    }
    r.T = clamp(r.T, 0, 1.05); r.P = clamp(r.P, 0, 1);
    r.wig += dt * (r.mode === 'surge' ? 16 : 5);
    // haul the bobber in as the fish tires
    const wob = r.mode === 'surge' ? Math.sin(r.wig) * 0.7 : Math.sin(r.wig) * 0.12;
    this.bob.x = lerp(r.from.x, LAND.x, r.P) + (r.mode === 'surge' ? Math.cos(r.wig * 0.7) * 0.3 : 0);
    this.bob.z = lerp(r.from.z, LAND.z, r.P) + wob;
    if (r.mode === 'surge' && this.fxr() < dt * 9) this.fx.emit('drop', this.bob.x, 0.2, this.bob.z, { vx: (this.fxr() - 0.5) * 3, vy: 3.2, vz: (this.fxr() - 0.5) * 3, g: -12, life: 0.4, s0: 0.22, color: 0x9be8ff });
    if (r.T >= 1) { G.audio.sfx('zap'); this.fx.shake(0.14, 0.2); this._miss('SNAP! The line broke.', 'stumble'); return; }
    if (r.slack > 2.2) { this._miss(r.fight ? 'The line went slack and it swam off.' : 'It slipped off the hook and sank.', 'shake'); return; }
    if (r.P >= 1) this._catch();
  }

  _catch() {
    const { id, size } = this.fish;
    const f = FISH[id];
    const S = G.S;
    S.fish[id] = (S.fish[id] || 0) + 1;
    const best = S.seen.fishBest || (S.seen.fishBest = {});
    const first = best[id] === undefined;
    const record = !first && size > best[id];
    if (first || record) best[id] = size;
    this.caught.push({ id, size });
    this.value += f.value;
    this.ph = 'catch';
    this.catchDur = G.debug.fast ? 0.6 : 3.6;
    this.pt = this.catchDur;
    this.msg = '';
    // the prize arcs out of the water into the Captain's arms
    const mesh = buildCatch(id, clamp(1.05 + size / 48, 1.1, 2.9), this.night);
    this.tackle.add(mesh);
    this.prize = { mesh, t: 0, from: { x: this.bob.x, z: this.bob.z } };
    this.bob.on = false;
    this.captain.play('yank', 0.5);
    for (const p of this.pals) p.ch.play('hop', 0.5);
    G.audio.sfx('splash'); G.audio.sfx(f.value >= 16 ? 'levelup' : 'item');
    this.fx.burst('drop', { x: this.bob.x, y: 0.3, z: this.bob.z }, 16, { speed: 3.4, up: 5.5, life: 0.6, s0: 0.28, color: 0x9be8ff });
    this.fx.shake(0.12, 0.2);
    this._showCard(f, size, first ? 'FIRST CATCH!' : record ? 'NEW RECORD!' : null);
  }

  _miss(text, anim) {
    this.ph = 'miss';
    this.pt = G.debug.fast ? 0.3 : 1.5;
    this.msg = text;
    this.bob.on = false;
    if (anim) this.captain.play(anim);
    G.audio.sfx('miss');
    if (this.biter) { this.biter.dash = 1; this.biter = null; }
  }

  _afterCast() {
    if (this.prize) { this.prize.mesh.removeFromParent(); disposeTree(this.prize.mesh); this.prize = null; }
    this._hideCard();
    this.biter = null;
    if (this.casts >= MAX_CASTS) { this._end(); return; }
    this.ph = 'idle';
    this.needRelease = true;
  }

  _end() {
    if (this.ph === 'done') return;
    this.ph = 'done';
    this._hideCard();
    this._say('');
    this.eCast.style.display = 'none'; this.eReel.style.display = 'none';
    this.bob.on = false;
    const n = this.caught.length;
    const list = this.caught.map((c) => `${FISH[c.id].icon} ${FISH[c.id].name} <span class="muted">${c.size} cm</span>`).join(' · ');
    const detail = n ? `${list}<br>${n} in the bucket. ${displayName('captain')} can sell them at the shop.` : 'Nothing in the bucket — but it was a nice sit.';
    this.finish({ score: this.value, won: true, title: n ? 'Packed up' : 'Skunked', detail, extra: { caught: this.caught.slice(), casts: this.casts } });
  }

  _showCard(f, size, tag) {
    this._hideCard();
    this.eCard = el('div.fish-card', el('div.fi', f.icon), el('div.fn', f.name), el('div.fs', `${size} cm · worth ${f.value} 🪙`), tag ? el('div.tag', tag) : null,
      el('div.more', { html: `${G.ui.key('a')} ${this.casts >= MAX_CASTS ? 'pack up' : 'cast again'}` }));
    this.hud.appendChild(this.eCard);
  }
  _hideCard() { if (this.eCard) { this.eCard.remove(); this.eCard = null; } }

  // ---------------------------------------------------------------- per-frame visuals
  ambient(dt) {
    const t = this.time;
    const ph = this.ph;
    if (this.state !== 'play') scrubNulls();
    // water glints drift
    for (const g of this.glints) { g.m.position.x = g.x + Math.sin(t * 0.5 + g.ph) * 0.5; g.m.position.z = g.z + Math.cos(t * 0.37 + g.ph) * 0.18; }
    this.boat.position.y = Math.sin(t * 1.3) * 0.04; this.boat.rotation.z = Math.sin(t * 0.9) * 0.03;
    if (!this.night && this.fxr() < dt * 1.6) {
      const a = this.fxr() * TAU, r = Math.sqrt(this.fxr()) * 0.85;
      this.fx.emit('spark', POND.x + Math.cos(a) * POND.rx * r, 0.12, POND.z + Math.sin(a) * POND.rz * r, { life: 0.7, s0: 0.05, s1: 0.4, color: 0xffffff, vrot: 2 });
    }
    for (const f of this.flies) {
      f.a += dt * f.sp; f.b += dt * f.sp * 0.7;
      f.s.position.set(f.x + Math.cos(f.a) * 1.4, f.y + Math.sin(f.b * 1.7) * 0.5, f.z + Math.sin(f.a * 0.8) * 1.1);
      f.s.material.opacity = 0.35 + 0.55 * Math.max(0, Math.sin(f.b * 2.3));
    }

    // fish shadows wander; one noses up to the bobber while you wait
    for (const s of this.shadows) {
      let sp = s.sp;
      if (s.dash > 0) { s.dash -= dt; sp = 4; }
      else if (s === this.biter && (ph === 'wait' || ph === 'bite')) {
        const dx = this.bob.x - s.x, dz = this.bob.z - s.z, d = Math.hypot(dx, dz);
        const want = Math.atan2(dz, dx) + (d < 1.1 && ph === 'wait' ? 1.3 : 0);
        s.h += clamp(((want - s.h + Math.PI * 3) % TAU) - Math.PI, -2.5 * dt, 2.5 * dt);
        sp = ph === 'bite' ? 3 : d > 1.2 ? 1.5 : 0.8;
      } else {
        s.tt -= dt;
        if (s.tt <= 0) { s.tt = 1 + this.fxr() * 2.5; s.turn = (this.fxr() - 0.5) * 1.6; }
        s.h += s.turn * dt;
        const ux = (s.x - POND.x) / (POND.rx * 0.86), uz = (s.z - POND.z) / (POND.rz * 0.86);
        if (ux * ux + uz * uz > 1) { const home = Math.atan2(POND.z - s.z, POND.x - s.x); s.h += clamp(((home - s.h + Math.PI * 3) % TAU) - Math.PI, -3 * dt, 3 * dt); }
      }
      s.x += Math.cos(s.h) * sp * dt; s.z += Math.sin(s.h) * sp * dt;
      s.m.position.x = s.x; s.m.position.z = s.z;
      s.m.rotation.z = -s.h;
      s.m.visible = !(s === this.biter && ph === 'reel');
    }

    // anglers
    const cap = this.captain;
    const r = this.reel;
    const strain = ph === 'reel' ? (r.mode === 'surge' ? 1 : 0.35) : ph === 'bite' ? 0.5 : ph === 'charge' ? -2.2 * this.power : 0;
    this.rod.rotation.x = damp(this.rod.rotation.x, 2.03 + strain * 0.32 + (ph === 'reel' && r.mode === 'surge' ? Math.sin(t * 40) * 0.03 : 0), 12, dt);
    if (ph === 'reel' && !cap.busy) cap.root.rotation.z = Math.sin(t * 30) * 0.012 * (r.mode === 'surge' ? 2 : 0); else cap.root.rotation.z = 0;
    cap.setPos(CAP.x, CAP.z, DOCK_Y);
    cap.update(dt, 0);
    for (const p of this.pals) {
      p.t -= dt;
      if (p.t <= 0) { p.t = 4 + (p.id.length % 3) * 1.4; if (!p.ch.busy) p.ch.play(ph === 'reel' ? 'hop' : 'nod'); }
      p.ch.update(dt, 0);
    }

    // bobber
    const bob = this.bob;
    bob.dip = Math.max(0, bob.dip - dt * (ph === 'bite' ? 0 : 1.2));
    this.bobMesh.visible = bob.on;
    if (bob.on) {
      const float = ph === 'cast' ? 0 : Math.sin(t * 3.2) * 0.035 - bob.dip + (ph === 'bite' ? Math.sin(t * 34) * 0.06 : 0);
      this.bobMesh.position.set(bob.x, bob.y + float, bob.z);
      this.bobMesh.rotation.z = ph === 'reel' ? Math.sin(t * 9) * 0.4 : Math.sin(t * 2.1) * 0.08;
    }

    // the prize
    if (this.prize) {
      const p = this.prize;
      p.t += dt;
      const k = clamp(p.t / 0.75, 0, 1), e = ease.out2(k);
      const hx = CAP.x + 1.25, hy = DOCK_Y + 2.3, hz = CAP.z + 0.1;
      p.mesh.position.set(lerp(p.from.x, hx, e), lerp(0.1, hy, e) + Math.sin(k * Math.PI) * 2.6, lerp(p.from.z, hz, e));
      p.mesh.rotation.set(0, k < 1 ? t * 9 : Math.PI / 2 + Math.sin(t * 2.4) * 0.5, k < 1 ? t * 7 : Math.sin(t * 13) * 0.3);
      if (k >= 1 && !p.landed) { p.landed = true; this.fx.sparkle({ x: hx, y: hy, z: hz }, 0xfff2a8, 10); if (!cap.busy) cap.play('celebrate', 1.1); }
    }

    // the line, from rod tip to bobber (or to the prize)
    cap.root.updateMatrixWorld(true);
    this.rodTip.getWorldPosition(this._p0);
    const showLine = bob.on || !!this.prize;
    const end = this.prize ? this.prize.mesh.position : this.bobMesh.position;
    const sag = this.prize ? 0.1 : ph === 'cast' ? 0.2 : ph === 'reel' ? (r.mode === 'surge' ? 0.02 : 0.3) : ph === 'bite' ? 0.1 : 0.9;
    this.sag = damp(this.sag ?? sag, sag, 8, dt);
    const n = this.segs.length;
    for (let i = 0; i < n; i++) {
      const s = this.segs[i];
      s.visible = showLine;
      if (!showLine) continue;
      const u0 = i / n, u1 = (i + 1) / n;
      this._a.lerpVectors(this._p0, end, u0); this._a.y -= Math.sin(u0 * Math.PI) * this.sag * (1 + u0);
      this._b.lerpVectors(this._p0, end, u1); this._b.y -= Math.sin(u1 * Math.PI) * this.sag * (1 + u1);
      if (u1 >= 1) this._b.y = Math.max(this._b.y, 0.05);
      s.position.copy(this._a).add(this._b).multiplyScalar(0.5);
      s.scale.z = Math.max(0.01, this._a.distanceTo(this._b));
      s.lookAt(this._b);
    }
    this._placeCamera(dt, false);
  }

  _placeCamera(dt, snap) {
    const ph = this.ph;
    let tx = 2.6, tz = 0.2, d = 44;
    if (ph === 'wait' || ph === 'bite' || ph === 'reel') { tx = lerp(2.6, this.bob.x, 0.3); tz = lerp(0.2, this.bob.z, 0.3); d = ph === 'wait' ? 42.5 : 39.5; }
    else if (ph === 'catch') { tx = 0.4; tz = 0.9; d = 36; }
    if (this.camera.aspect < 1.5) d *= 1.5 / this.camera.aspect;
    if (snap) { this.cam.x = tx; this.cam.z = tz; this.cam.d = d; }
    else { this.cam.x = damp(this.cam.x, tx, 2.4, dt); this.cam.z = damp(this.cam.z, tz, 2.4, dt); this.cam.d = damp(this.cam.d, d, 2.4, dt); }
    const pitch = 0.93;
    this.camera.position.set(this.cam.x, Math.sin(pitch) * this.cam.d, this.cam.z + Math.cos(pitch) * this.cam.d);
    this.camera.lookAt(this.cam.x, 0.6, this.cam.z);
    this.fx.applyShake(this.camera);
    this.rig.follow(this.cam.x, this.cam.z);
  }
}

/** The shell builds its cards with native append(), which prints null/false children as text. Sweep them away. */
function scrubNulls() {
  for (const b of document.querySelectorAll('.mg-card .panel-body')) {
    for (const n of [...b.childNodes]) if (n.nodeType === 3 && /^(null|false|undefined)+$/.test(n.nodeValue)) n.remove();
  }
}

// tiny local geometry cache (kit's is private)
const _geo = new Map();
function cg(key, make) { let g = _geo.get(key); if (!g) { g = make(); _geo.set(key, g); } return g; }
