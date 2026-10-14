// MIDNIGHT FREQUENCY — bootstrap, main loop, and the screen manager.
// Screens are objects with enter(params) / exit() / update(dt) / draw(ctx) and
// optionally a {scene, camera} they want rendered. Switching screens plays a
// "channel change": static burst → swap (builds may take a few frames) → clear.
import { Renderer } from './core/renderer.js';
import { input } from './core/input.js';
import { hit, osd } from './core/ui.js';
import { audio } from './audio/audio.js';
import { settings } from './core/settings.js';

export const game = {
  renderer: null,
  screen: null,
  screens: {},
  time: 0,
  frame: 0,
  fx: { staticAmt: 0, flash: 0, fade: 0, interference: 0, radialBlur: 0 },
  _transition: null,
  query: new URLSearchParams(location.search),
};

/** Register a screen factory: name → () => screenObject. */
export function registerScreen(name, factory) {
  game.screens[name] = factory;
}

/**
 * Change screens with a static "channel change".
 * opts.transition: 'static' (default) | 'fade' | 'none'
 */
export function go(name, params = {}, opts = {}) {
  const kind = opts.transition || 'static';
  if (game._transition && !opts.force) return;
  game._transition = { name, params, kind, t: 0, phase: 'out', swapped: false };
  if (kind === 'static') import('./audio/sfx.js').then((m) => m.sfx?.staticBurst?.(0.55)).catch(() => {});
}

async function swapScreen(name, params) {
  const old = game.screen;
  if (old?.exit) {
    try { old.exit(); } catch (e) { console.error(e); }
  }
  game.screen = null;
  const factory = game.screens[name];
  if (!factory) throw new Error(`no screen ${name}`);
  const scr = factory();
  scr.name = name;
  if (scr.enter) await scr.enter(params);
  game.screen = scr;
  input.clearEdges();
}

function stepTransition(dt) {
  const tr = game._transition;
  if (!tr) return;
  const OUT = tr.kind === 'none' ? 0 : 0.22;
  const IN = tr.kind === 'none' ? 0 : 0.45;
  tr.t += dt;
  if (tr.phase === 'out') {
    const k = OUT ? Math.min(1, tr.t / OUT) : 1;
    if (tr.kind === 'static') { game.fx.staticAmt = k; game.fx.interference = k * 0.8; }
    if (tr.kind === 'fade') game.fx.fade = k;
    if (k >= 1 && !tr.swapped) {
      tr.swapped = true;
      tr.phase = 'loading';
      swapScreen(tr.name, tr.params).then(() => {
        tr.phase = 'in';
        tr.t = 0;
      }).catch((e) => {
        console.error(e);
        tr.phase = 'in';
        tr.t = 0;
      });
    }
  } else if (tr.phase === 'loading') {
    // hold the static while the next screen builds
    if (tr.kind === 'static') { game.fx.staticAmt = 0.92 + Math.random() * 0.08; game.fx.interference = 0.6; }
  } else if (tr.phase === 'in') {
    const k = IN ? Math.min(1, tr.t / IN) : 1;
    const e = 1 - k;
    if (tr.kind === 'static') { game.fx.staticAmt = e * e; game.fx.interference = e * 0.7; }
    if (tr.kind === 'fade') game.fx.fade = e;
    if (k >= 1) {
      game._transition = null;
      game.fx.staticAmt = 0;
      game.fx.interference = 0;
      game.fx.fade = 0;
    }
  }
}

let last = performance.now();
let perfAcc = 0, perfFrames = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) dt = 0.001;
  game.time += dt;
  game.frame++;

  input.update(dt);
  if (input.padEvent) {
    const ds = /054c|dualsense|wireless controller/i.test(input.padId || '');
    game.padToast = { t: 0, text: input.padEvent === 'lost' ? 'CONTROLLER DISCONNECTED' : ds ? 'DUALSENSE CONNECTED' : 'CONTROLLER CONNECTED' };
  }
  if (input.pressed('any')) {
    audio.unlock();
    document.getElementById('room-hint')?.classList.add('gone');
  }

  stepTransition(dt);
  const scr = game.screen;
  const busy = game._transition && game._transition.phase !== 'in';
  if (scr && scr.update) {
    try { scr.update(dt, busy); } catch (e) { console.error(e); }
  }

  const r = game.renderer;
  const ctx = r.beginUI();
  hit.begin();
  if (scr && scr.draw) {
    try { scr.draw(ctx, dt); } catch (e) { console.error(e); }
  }
  hit.resolve();
  if (game.overlay) game.overlay(ctx, dt);
  if (game.padToast) {
    const pt = game.padToast;
    pt.t += dt;
    if (pt.t > 3.2) game.padToast = null;
    else if (Math.floor(pt.t * 4) % 2 === 0 || pt.t > 0.8) osd(ctx, pt.text, 980, 60, 20, pt.text.includes('DIS') ? '#ffb0a0' : '#d8ffd8', 'right');
  }

  const view = scr?.view ? scr.view() : null;
  r.render(view?.scene || null, view?.camera || null, dt, game.fx);

  // track frame cost for auto quality
  perfAcc += dt;
  perfFrames++;
  if (perfAcc > 2) {
    game.fps = perfFrames / perfAcc;
    perfAcc = 0;
    perfFrames = 0;
    if (scr?.onPerf) scr.onPerf(game.fps);
    autoQuality(scr);
  }
}

// Auto quality: while racing, drop the internal resolution a notch if the
// frame rate sags, and give it back once there's headroom again.
let lowStreak = 0, highStreak = 0;
function autoQuality(scr) {
  if (!settings.get('autoQuality') || game._transition || scr?.name !== 'race') { lowStreak = highStreak = 0; return; }
  const r = game.renderer;
  const steps = [480, 600, 720];
  const want = settings.get('lines');
  const i = steps.indexOf(r.internalLines);
  if (game.fps < 40) { lowStreak++; highStreak = 0; } else if (game.fps > 57) { highStreak++; lowStreak = 0; } else { lowStreak = highStreak = 0; }
  if (lowStreak >= 2 && i > 0) { r.setInternalLines(steps[i - 1]); lowStreak = 0; }
  if (highStreak >= 4 && i >= 0 && steps[i] < want) { r.setInternalLines(steps[i + 1]); highStreak = 0; }
}

async function boot() {
  const canvas = document.getElementById('screen');
  game.renderer = new Renderer(canvas);
  game.renderer.setInternalLines(settings.get('lines'));
  game.renderer.crt = settings.get('crt') ?? 1;
  input.settingsRumble = settings.get('rumble') !== false;
  input.bindMouse(canvas, (x, y) => game.renderer.clientToUI(x, y));
  audio.setVolumes({
    master: settings.get('volMaster'), music: settings.get('volMusic'), sfx: settings.get('volSfx'),
  });

  // screens register themselves on import
  await import('./screens/index.js');

  const start = game.query.get('screen') || 'boot';
  if (start !== 'boot') game.renderer.power = 1;
  await swapScreen(start, Object.fromEntries(game.query.entries()));
  requestAnimationFrame((t) => { last = t; loop(t); });

  // hide the mouse pointer while a pad is driving things
  let hideTimer = null;
  window.addEventListener('pointermove', () => {
    document.body.classList.remove('cursor-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => document.body.classList.add('cursor-hidden'), 2500);
  });
}

window.__game = game;
import('three').then((T) => { window.__THREE = T; });
boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:8px;bottom:8px;color:#f66;font:12px monospace;z-index:9">${String(e.stack || e)}</pre>`);
});
