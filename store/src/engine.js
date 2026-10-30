// Canvas, main loop and input. The canvas fills the window; `view` holds its
// CSS size and device pixel ratio.

export const view = {
  w: 1, h: 1, dpr: 1,
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
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  for (const fn of listeners.resize) fn(view);
}

// Call once per frame: rolls this frame's screen-shake offset.
export function beginFrame(dt) {
  view.shakeX = view.shake ? (Math.random() - 0.5) * view.shake : 0;
  view.shakeY = view.shake ? (Math.random() - 0.5) * view.shake : 0;
  view.shake = Math.max(0, view.shake - dt * 30);
}

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

export function initInput() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = KEYMAP[e.code];
    if (k) {
      if (!keys.has(k)) pressedOnce.add(k);
      keys.add(k);
      if (['left', 'right', 'up', 'down', 'jump'].includes(k) && e.target === document.body) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  });
  window.addEventListener('blur', () => keys.clear());
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
