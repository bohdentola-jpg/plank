// Canvas, camera, main loop and input. World units: the platform core band is
// 540 tall with the floor (feet line) at FLOOR_Y. Landscape screens show the
// core band; tall phone screens show extra ceiling above and track pit below.

export const CORE_H = 540;
export const MIN_VIEW_W = 560;
export const FLOOR_Y = 440;

export const view = {
  w: 1, h: 1, dpr: 1,
  s: 1,          // css px per world unit
  px: 1,         // device px per world unit
  vw: 1, vh: 1,  // visible world size
  camX: 0, camY: 0, // world coords of the screen's top-left
  worldW: 2000,
  shake: 0,
  quality: 1,
};

let canvas, ctx;
const listeners = { resize: [] };

export function initCanvas(el) {
  canvas = el;
  ctx = canvas.getContext('2d', { alpha: false });
  window.addEventListener('resize', () => resize());
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();
  return ctx;
}

export function onResize(fn) { listeners.resize.push(fn); }

export function resize() {
  const w = Math.max(1, canvas.clientWidth || window.innerWidth);
  const h = Math.max(1, canvas.clientHeight || window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, view.quality >= 1 ? 2 : 1.5);
  view.w = w; view.h = h; view.dpr = dpr;
  view.s = Math.min(h / CORE_H, w / MIN_VIEW_W);
  // keep device pixels per unit sane on huge screens
  view.px = Math.min(view.s * dpr, 3);
  view.vw = w / view.s;
  view.vh = h / view.s;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  for (const fn of listeners.resize) fn(view);
}

// Vertical framing: put the extra height 40% above / 60% below the core band.
export function frameY() {
  const extra = Math.max(0, view.vh - CORE_H);
  return -extra * 0.4;
}

export function follow(targetX, dt, lookAhead = 0) {
  const want = targetX + lookAhead - view.vw / 2;
  const max = Math.max(0, view.worldW - view.vw);
  const clamped = view.worldW <= view.vw ? (view.worldW - view.vw) / 2 : Math.min(max, Math.max(0, want));
  const k = 1 - Math.exp(-dt * 6);
  view.camX += (clamped - view.camX) * k;
  view.camY = frameY();
}

export function snapCamera(targetX) {
  const max = Math.max(0, view.worldW - view.vw);
  view.camX = view.worldW <= view.vw ? (view.worldW - view.vw) / 2 : Math.min(max, Math.max(0, targetX - view.vw / 2));
  view.camY = frameY();
}

// Call once per frame: rolls this frame's screen-shake offset.
export function beginFrame(dt) {
  view.shakeX = view.shake ? (Math.random() - 0.5) * view.shake : 0;
  view.shakeY = view.shake ? (Math.random() - 0.5) * view.shake : 0;
  view.shake = Math.max(0, view.shake - dt * 30);
}

// Set ctx to draw world coordinates (with optional parallax factor).
export function worldTransform(g, parallax = 1) {
  const k = view.s * view.dpr;
  g.setTransform(k, 0, 0, k, (-view.camX * parallax + (view.shakeX || 0)) * k, (-view.camY + (view.shakeY || 0)) * k);
}

export function screenTransform(g) {
  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

export const toScreen = (x, y) => [(x - view.camX) * view.s, (y - view.camY) * view.s];
export const toWorld = (sx, sy) => [sx / view.s + view.camX, sy / view.s + view.camY];

// ---------------------------------------------------------------- loop

let last = 0, running = false, frameFn = null;
let slowFrames = 0;

export function startLoop(fn) {
  frameFn = fn;
  if (running) return;
  running = true;
  last = performance.now();
  const tick = (now) => {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    // adaptive quality: drop resolution if we can't hold ~45fps
    if (dt > 0.024) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 0.5);
    if (slowFrames > 90 && view.quality >= 1) {
      view.quality = 0.75;
      slowFrames = 0;
      resize();
    }
    frameFn(dt, now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function stopLoop() { running = false; }

// ---------------------------------------------------------------- input

export const keys = new Set();
const pressedOnce = new Set();
export const input = { touch: false, pointer: null, taps: [], lastPointerType: 'mouse', gamepad: false };

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump',
  KeyE: 'act', Enter: 'act',
  ShiftLeft: 'run', ShiftRight: 'run',
  Escape: 'back',
  KeyM: 'map', KeyB: 'bag', KeyP: 'stash', KeyI: 'stash',
};

export function initInput(el) {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = KEYMAP[e.code];
    if (k) {
      if (!keys.has(k)) pressedOnce.add(k);
      keys.add(k);
      if (['left', 'right', 'up', 'down', 'jump'].includes(k) && e.target === document.body) e.preventDefault();
    }
    if (/^Digit[1-9]$/.test(e.code)) pressedOnce.add('n' + e.code.slice(5));
    input.touch = false;
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  });
  window.addEventListener('blur', () => keys.clear());
  el.addEventListener('pointerdown', (e) => {
    input.lastPointerType = e.pointerType;
    input.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const r = el.getBoundingClientRect();
    input.taps.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
  });
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    input.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  el.addEventListener('pointerleave', () => { input.pointer = null; });
}

// true once per key press
export function pressed(k) {
  if (pressedOnce.has(k)) {
    pressedOnce.delete(k);
    return true;
  }
  return false;
}

export function clearPressed() { pressedOnce.clear(); }

// Gamepad: left stick / d-pad walk, A act, B back, X jump.
let padPrev = {};
export function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && [...pads].find((p) => p && p.connected);
  if (!gp) return;
  input.gamepad = true;
  const ax = gp.axes[0] || 0;
  const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const state = {
    left: ax < -0.35 || btn(14),
    right: ax > 0.35 || btn(15),
    act: btn(0),
    back: btn(1),
    jump: btn(2) || btn(3),
    run: btn(7) || btn(5),
    map: btn(9),
  };
  for (const [k, v] of Object.entries(state)) {
    if (v && !padPrev[k]) { pressedOnce.add(k); keys.add(k); }
    if (!v && padPrev[k]) keys.delete(k);
  }
  padPrev = state;
}

export function getCtx() { return ctx; }
export function getCanvas() { return canvas; }
