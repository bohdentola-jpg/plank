// The spine of the game: renderer, main loop, the mode stack, timers/tweens,
// iris fades and hit-stop. Everything else hangs off the shared `G` object.
//
// A *mode* is a self-contained screen (overworld, a drive battle, a minigame…).
// Modes stack: the top one updates and renders, the ones below are frozen.
//
//   class MyMode extends Mode {
//     enter(params) { build this.scene / this.camera / this.hud }
//     update(dt)    { read G.input, move things }
//     exit()        { dispose }
//   }
//   const result = await G.run(new MyMode(), params);   // fades in, resolves when
//   ...inside the mode:  G.leave(result);               // the mode leaves (fades out)
import * as THREE from 'three';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { clamp, ease, el } from './util.js';
import { disposeTree } from '../art/kit.js';

/** Timers and tweens driven by game time (so pause, hit-stop and the QA harness all work). */
export class Sched {
  constructor() { this.items = []; }
  wait(t) { return new Promise((res) => this.items.push({ t, res })); }
  /** tween(dur, k => …, easeFn): k runs 0→1. */
  tween(dur, fn, easeFn = ease.inOut2) {
    fn(easeFn(0));
    if (dur <= 0) { fn(easeFn(1)); return Promise.resolve(); }
    return new Promise((res) => this.items.push({ t: dur, dur, fn, easeFn, res }));
  }
  /** Call fn(dt) every frame until it returns true. */
  until(fn) { return new Promise((res) => this.items.push({ t: Infinity, poll: fn, res })); }
  update(dt) {
    if (!this.items.length) return;
    const items = this.items;
    const done = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.poll) { if (it.poll(dt)) it.done = true; } else {
        it.t -= dt;
        if (it.fn) it.fn(it.easeFn(clamp(1 - it.t / it.dur, 0, 1)));
        if (it.t <= 0) it.done = true;
      }
      if (it.done) done.push(it);
    }
    if (done.length) {
      this.items = this.items.filter((i) => !i.done);
      for (const d of done) d.res();
    }
  }
  clear() { this.items.length = 0; }
}

export class Mode {
  constructor() {
    this.name = 'mode';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 600);
    this.sched = new Sched();
    this.hud = el('div.hud-layer');
    this.active = false;
    this.time = 0;
  }
  enter() {}
  exit() {}
  pause() {}
  resume() {}
  update() {}
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  wait(t) { return this.sched.wait(G.debug.fast ? Math.min(t, 0.02) : t); }
  tween(dur, fn, easeFn) { return this.sched.tween(G.debug.fast ? Math.min(dur, 0.02) : dur, fn, easeFn); }
  until(fn) { return this.sched.until(fn); }
}

export const G = {
  renderer: null, canvas: null, W: 1280, H: 720,
  input: null, audio: null, ui: null,
  S: null,                 // the save state (see core/save.js)
  modes: [],
  sched: new Sched(),      // global timers (fades etc.) — never paused
  time: 0, frame: 0,
  paused: false,
  hitstopT: 0,
  debug: { test: false, noRender: false, fast: false, fastDialog: false, auto: false, log: [] },
  quality: { shadows: true, pr: 1 },
  top() { return this.modes[this.modes.length - 1] || null; },
};

G.init = function init(container) {
  const params = new URLSearchParams(location.search);
  G.debug.test = params.has('test');
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  G.canvas = canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !G.debug.test, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !G.debug.test || params.has('shadows');
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.quality.shadows = renderer.shadowMap.enabled;
  G.quality.pr = G.debug.test ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(G.quality.pr);
  G.renderer = renderer;
  G.input = new Input();
  G.audio = new AudioSys();
  G.input.onFirstGesture = () => G.audio.ensure();

  const resize = () => {
    G.W = Math.max(320, window.innerWidth);
    G.H = Math.max(240, window.innerHeight);
    renderer.setSize(G.W, G.H, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    for (const m of G.modes) m.resize(G.W, G.H);
    document.documentElement.style.setProperty('--ui-scale', String(clamp(Math.min(G.W / 1280, G.H / 720), 0.55, 1.5)));
  };
  window.addEventListener('resize', resize);
  resize();
  G._resize = resize;
};

// ------------------------------------------------------------------ mode stack
G.push = function push(mode, params) {
  return new Promise((res) => {
    const top = G.top();
    if (top) { top.pause(); top.hud.style.display = 'none'; }
    mode._resolve = res;
    G.modes.push(mode);
    mode.active = true;
    G.ui.hudRoot.appendChild(mode.hud);
    mode.resize(G.W, G.H);
    mode.enter(params || {});
  });
};

G.pop = function pop(result) {
  const m = G.modes.pop();
  if (!m) return;
  m.active = false;
  try { m.exit(); } catch (e) { console.error(e); }
  try { disposeTree(m.scene); } catch (e) { console.error(e); }   // free whatever GPU memory the mode still holds
  m.sched.clear();
  m.hud.remove();
  const top = G.top();
  if (top) { top.hud.style.display = ''; top.resume(result); }
  if (m._resolve) m._resolve(result);
};

/** Fade out, push the mode, fade in; resolves with the mode's result once it has left. */
G.run = async function run(mode, params, opts = {}) {
  await G.fadeOut(opts.fade);
  const p = G.push(mode, params);
  await G.fadeIn(opts.fade);
  return p;
};

/** Called by a mode to leave: fade out, pop, fade in. */
G.leave = async function leave(result, opts = {}) {
  const m = G.top();
  if (!m || m._leaving) return;
  m._leaving = true;
  await G.fadeOut(opts.fade);
  G.pop(result);
  await G.fadeIn(opts.fade);
};

/** Replace the whole stack with one mode (title → world, etc.). */
G.reset = async function reset(mode, params) {
  await G.fadeOut();
  while (G.modes.length) G.pop();
  const p = G.push(mode, params);
  await G.fadeIn();
  return p;
};

// ------------------------------------------------------------------ iris fade
let fadeEl = null;
let fadeR = 1;
function setIris(k) {           // k: 1 = fully open, 0 = closed
  fadeR = k;
  if (!fadeEl) fadeEl = document.getElementById('fade');
  if (!fadeEl) return;
  if (k >= 0.999) { fadeEl.style.display = 'none'; return; }
  fadeEl.style.display = 'block';
  const R = Math.hypot(G.W, G.H) * 0.62 * k;
  fadeEl.style.setProperty('--r', `${R.toFixed(1)}px`);
}
G.fadeOut = function fadeOut(dur = 0.38) {
  if (G.debug.fast) dur = 0;
  const from = fadeR;
  return G.sched.tween(dur, (k) => setIris(from * (1 - k)), ease.in2);
};
G.fadeIn = function fadeIn(dur = 0.42) {
  if (G.debug.fast) dur = 0;
  const from = fadeR;
  return G.sched.tween(dur, (k) => setIris(from + (1 - from) * k), ease.out2);
};
G.irisAt = function irisAt(xPct, yPct) {
  if (!fadeEl) fadeEl = document.getElementById('fade');
  if (fadeEl) { fadeEl.style.setProperty('--cx', `${xPct}%`); fadeEl.style.setProperty('--cy', `${yPct}%`); }
};

/** Freeze gameplay for a beat (impact frames). */
G.hitstop = function hitstop(sec) { if (!G.debug.fast) G.hitstopT = Math.max(G.hitstopT, sec); };

// ------------------------------------------------------------------ main loop
G.tick = function tick(dt) {
  G.input.poll(dt);
  G.sched.update(dt);
  if (G.ui) G.ui.update(dt);
  if (G.input.hit('mute')) { const m = G.audio.toggleMute(); if (G.ui) G.ui.toast(m ? '🔇 Sound off' : '🔊 Sound on'); }
  const top = G.top();
  if (top && !G.paused) {
    if (G.hitstopT > 0) G.hitstopT -= dt;
    else {
      top.time += dt;
      top.sched.update(dt);
      top.update(dt);
    }
  }
  G.time += dt;
  G.frame++;
  G.input.endFrame();
};

G.draw = function draw() {
  const top = G.top();
  if (top && !G.debug.noRender) G.renderer.render(top.scene, top.camera);
};

let last = 0;
let slowFrames = 0, fastFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (G.debug.manual) return;
  const raw = (now - last) / 1000;
  last = now;
  const dt = clamp(raw, 0, 0.05);
  try {
    G.tick(dt);
    G.draw();
  } catch (e) {
    G.reportError(e);
  }
  // crude auto-quality: if we can't hold ~30fps, shed pixels, then shadows
  if (raw > 0.036) slowFrames++; else fastFrames++;
  if (slowFrames + fastFrames >= 120) {
    if (slowFrames > 80) {
      if (G.quality.pr > 1) { G.quality.pr = 1; G.renderer.setPixelRatio(1); G._resize(); } else if (G.quality.shadows) { G.quality.shadows = false; G.renderer.shadowMap.enabled = false; for (const m of G.modes) m.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    }
    slowFrames = fastFrames = 0;
  }
}
G.start = function start() { last = performance.now(); requestAnimationFrame(loop); };

let errShown = 0;
G.reportError = function reportError(e) {
  console.error(e);
  G.debug.log.push(String(e && e.stack ? e.stack : e));
  if (errShown++ > 2) return;
  const box = document.getElementById('errbox');
  if (box) { box.style.display = 'block'; box.textContent = `Something tripped over its own cleats:\n${e && e.message ? e.message : e}`; setTimeout(() => { box.style.display = 'none'; }, 6000); }
};
window.addEventListener('error', (ev) => { G.debug.log.push(`${ev.message} @ ${ev.filename}:${ev.lineno}`); });
window.addEventListener('unhandledrejection', (ev) => { G.reportError(ev.reason); });
