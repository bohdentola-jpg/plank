// Base class for every place in the game: lights, sky, characters, hotspots,
// named camera views, and the hidden monarch butterflies.
import * as THREE from 'three';
import { RIM, disposeTree, glowSprite } from '../toon.js';
import { makeCharacter } from '../characters.js';
import { monarch } from '../props.js';
import { skyDome, clouds, hills, mergeStatic } from '../world.js';
import { t } from '../i18n.js';

export const LIGHTS = {
  day: { sky: ['#4fa9ec', '#d8f0ff', '#cfe6c0'], hemi: ['#e4f4ff', '#c9a27a', 1.45], sun: ['#fff4dc', 2.7], sunPos: [12, 18, 10], rim: ['#fff1d6', 0.32], fog: ['#cfe7f5', 60, 190], exposure: 1 },
  golden: { sky: ['#5a8fd6', '#ffd7a0', '#e9b98a'], hemi: ['#ffe0bd', '#8a6a6a', 1.25], sun: ['#ffc98a', 2.5], sunPos: [-16, 8, 10], rim: ['#ffd9a6', 0.38], fog: ['#f4cfa4', 55, 180] },
  evening: { sky: ['#2b2d7a', '#f08a5d', '#6a4a6a'], hemi: ['#ffb894', '#3e3550', 1.0], sun: ['#ff9f6b', 1.6], sunPos: [-18, 5, 6], rim: ['#ffb37a', 0.42], fog: ['#7a5a7a', 40, 160] },
  night: { sky: ['#0b1036', '#2a2f6e', '#141a3a'], hemi: ['#6a78c9', '#1a1626', 0.75], sun: ['#a9b8ff', 0.75], sunPos: [10, 20, -6], rim: ['#ffc98a', 0.3], fog: ['#1a1f4a', 30, 120], stars: true },
  interior: { sky: ['#4fa9ec', '#d8f0ff', '#cfe6c0'], hemi: ['#fff4e2', '#a07a5a', 1.35], sun: ['#fff1d6', 2.2], sunPos: [6, 9, 8], rim: ['#fff1d6', 0.3], fog: null },
};

export class Scene {
  constructor(game) {
    this.game = game;
    this.engine = game.engine;
    this.scene = null;
    this.chars = {};
    this.updaters = [];
    this.views = {};
    this.monarchs = [];
    this.time = 0;
  }

  // subclasses override build(), then call super helpers
  async build() {
    this.scene = new THREE.Scene();
  }

  setLights(kind, { sky = true, shadowBox = 14, scenery = true } = {}) {
    const L = LIGHTS[kind];
    this.lightKind = kind;
    const s = this.scene;
    if (sky) {
      const dome = skyDome({ top: L.sky[0], horizon: L.sky[1], bottom: L.sky[2], stars: !!L.stars });
      s.add(dome);
      this.sky = dome;
      if (scenery && kind !== 'night') s.add(clouds(7, { color: kind === 'evening' ? '#ffc7b0' : '#ffffff' }));
    }
    if (L.fog) s.fog = new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]);
    const hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]);
    s.add(hemi);
    const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]);
    sun.position.set(...L.sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -shadowBox; c.right = shadowBox; c.top = shadowBox; c.bottom = -shadowBox;
    c.near = 1; c.far = 80;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    s.add(sun);
    s.add(sun.target);
    this.hemi = hemi;
    this.sun = sun;
    RIM.color.value.set(L.rim[0]);
    RIM.strength.value = L.rim[1];
    return { hemi, sun };
  }

  addHills(opts) {
    const h = hills(opts);
    this.scene.add(h);
    return h;
  }

  // ---------------------------------------------------------------- characters
  addChar(id, x, z, rot = 0, { y = 0, look = null } = {}) {
    const c = makeCharacter(id);
    c.root.position.set(x, y, z);
    c.root.rotation.y = rot;
    this.scene.add(c.root);
    this.chars[id] = c;
    if (look) c.look(look);
    return c;
  }

  // make a character clickable to talk
  talkable(id, label, fn, opts = {}) {
    const c = this.chars[id];
    return this.hot(c.root, label, fn, { sparkle: opts.sparkle ?? true, ...opts });
  }

  // ---------------------------------------------------------------- hotspots
  // a clickable thing. While one handler runs, other hotspots wait — except
  // ones marked nested (the pieces of a mini-game that's already running).
  hot(obj, label, onClick, opts = {}) {
    obj.userData.dynamic = true;
    return this.engine.addHotspot(obj, {
      label: () => t(typeof label === 'function' ? label() : label),
      onClick: async (hit) => {
        if (this.engine.locked) return;
        if (opts.nested) {
          // mini-game pieces run one at a time too (no overlapping dialogues)
          if (this.nestedBusy) return;
          this.game.sfx('tap');
          this.nestedBusy = true;
          try { await onClick(hit); } finally { this.nestedBusy = false; }
          return;
        }
        if (this.busy) return;
        this.game.sfx('tap');
        this.busy = true;
        try { await onClick(hit); } finally { this.busy = false; }
      },
      ...opts,
    });
  }

  say(lines) { return this.game.ui.say(lines); }

  // ---------------------------------------------------------------- views
  // named camera positions; view(name) flies there, back() returns
  defineView(name, pos, target, fov = 40) { this.views[name] = { pos, target, fov }; }

  async view(name, { back = true, dur = 1.1 } = {}) {
    const v = this.views[name];
    if (!v) return;
    this.currentView = name;
    await this.engine.setRig(v.pos, v.target, v.fov, dur, name === 'main' ? 0.3 : 0.12);
    if (back && name !== 'main') this.game.ui.back({ en: 'Back', es: 'Atrás' }, () => this.backToMain());
    else this.game.ui.back(null);
  }

  async backToMain() {
    this.game.ui.back(null);
    this.onBack?.();
    await this.view('main', { back: false });
  }

  cameraRig() { const v = this.views.main; return v ? { pos: v.pos, target: v.target, fov: v.fov } : null; }

  // ---------------------------------------------------------------- monarchs
  // hidden butterflies: find them all across the town
  hideMonarch(key, x, y, z) {
    const id = `${this.constructor.name}-${key}`;
    if (this.game.state.monarchs[id]) return;
    const b = monarch({ scale: 2.4 });
    b.position.set(x, y, z);
    b.rotation.y = Math.random() * 6;
    this.scene.add(b);
    const base = b.position.clone();
    this.updaters.push((dt, time) => {
      b.userData.update(time);
      b.position.y = base.y + Math.sin(time * 1.3 + x) * 0.05;
      b.rotation.y += dt * 0.3;
    });
    this.hot(b, { en: 'A monarch butterfly!', es: '¡Una mariposa monarca!' }, async () => {
      this.game.state.monarchs[id] = true;
      this.game.save();
      this.game.sfx('sparkle');
      b.visible = false;
      this.engine.removeHotspot(b);
      const n = Object.keys(this.game.state.monarchs).length;
      this.game.ui.toast(t({ en: `You found a monarch! (${n} of 12)`, es: `¡Encontraste una monarca! (${n} de 12)` }), { ico: 'butterfly' });
      this.game.addPetals(1);
      if (!this.game.knows('monarca')) await this.game.learn('monarca');
      if (n >= 12 && !this.game.has('allMonarchs')) {
        this.game.flag('allMonarchs');
        this.game.ui.toast(t({ en: 'You found ALL the monarchs! +5', es: '¡Encontraste TODAS las monarcas! +5' }), { ico: 'star', ms: 4000 });
        this.game.addPetals(5);
      }
    }, { sparkle: false });
    this.monarchs.push(b);
  }

  // ---------------------------------------------------------------- loop
  update(dt, time) {
    this.time = time;
    for (const c of Object.values(this.chars)) c.update(dt);
    for (const fn of this.updaters) fn(dt, time);
  }

  // animate everything in a subtree that has userData.update (flames, papel picado…)
  animateTree(root) {
    const list = [];
    root.traverse((o) => { if (o.userData.update) list.push(o); });
    this.updaters.push((dt, time) => { for (const o of list) o.userData.update(time, dt); });
  }

  merge(root) { return mergeStatic(root); }

  glow(color, size, opacity) { return glowSprite(color, size, opacity); }

  exit() {
    this.game.ui.back(null);
    this.game.sound.setAmbient(null);
  }

  dispose() {
    if (this.scene) disposeTree(this.scene);
  }
}
