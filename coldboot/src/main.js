// COLD BOOT — bootstrap, main loop and the screen manager (Midnight Frequency's
// pattern). Screens are objects with enter(params) / exit() / update(dt) /
// draw(ctx) and optionally view() → {scene, camera}. Switching screens plays a
// "channel change": static burst → swap (builds may take a few frames) → clear.
import { Renderer, UI_W, UI_H } from './core/renderer.js';
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
  fx: { staticAmt: 0, flash: 0, fade: 0, interference: 0 },
  _transition: null,
  query: new URLSearchParams(location.search),
  overlays: [],
};

export function registerScreen(name, factory) {
  game.screens[name] = factory;
}

/**
 * Change screens. opts.transition: 'static' (default) | 'fade' | 'black' | 'none'
 * 'black' fades to black and holds it through the build, for cutscene joins.
 */
export function go(name, params = {}, opts = {}) {
  const kind = opts.transition || 'static';
  if (game._transition && !opts.force) return;
  game._transition = { name, params, kind, t: 0, phase: 'out', swapped: false, out: opts.out, in: opts.in };
  if (kind === 'static') import('./audio/sfx.js').then((m) => m.sfx?.staticBurst?.(0.5)).catch(() => {});
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
  const fadeish = tr.kind === 'fade' || tr.kind === 'black';
  const OUT = tr.kind === 'none' ? 0 : (tr.out ?? (fadeish ? 0.6 : 0.22));
  const IN = tr.kind === 'none' ? 0 : (tr.in ?? (fadeish ? 0.8 : 0.45));
  tr.t += dt;
  if (tr.phase === 'out') {
    const k = OUT ? Math.min(1, tr.t / OUT) : 1;
    if (tr.kind === 'static') { game.fx.staticAmt = k; game.fx.interference = k * 0.8; }
    if (fadeish) game.fx.fade = k;
    if (k >= 1 && !tr.swapped) {
      tr.swapped = true;
      tr.phase = 'loading';
      swapScreen(tr.name, tr.params).then(() => {
        tr.phase = 'in';
        tr.t = 0;
      }).catch((e) => {
        console.error(e);
        showError(e);
        tr.phase = 'in';
        tr.t = 0;
      });
    }
  } else if (tr.phase === 'loading') {
    if (tr.kind === 'static') { game.fx.staticAmt = 0.92 + Math.random() * 0.08; game.fx.interference = 0.6; }
    if (fadeish) game.fx.fade = 1;
  } else if (tr.phase === 'in') {
    const k = IN ? Math.min(1, tr.t / IN) : 1;
    const e = 1 - k;
    if (tr.kind === 'static') { game.fx.staticAmt = e * e; game.fx.interference = e * 0.7; }
    if (fadeish) game.fx.fade = e;
    if (k >= 1) {
      game._transition = null;
      game.fx.staticAmt = 0;
      game.fx.interference = 0;
      game.fx.fade = 0;
    }
  }
}

function showError(e) {
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:8px;bottom:8px;max-width:90vw;white-space:pre-wrap;color:#f66;font:12px monospace;z-index:9;background:rgba(0,0,0,.7);padding:6px">${String(e && (e.stack || e))}</pre>`);
}

const FF = game.query.has('ff');
let last = performance.now();
let perfAcc = 0, perfFrames = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  // ?ff=1 (QA on a software GPU): let game time keep up with the wall clock
  if (dt > (FF ? 0.5 : 0.1)) dt = FF ? 0.5 : 0.1;
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
  const busy = !!(game._transition && game._transition.phase !== 'in');
  if (scr && scr.update) {
    try { scr.update(dt, busy); } catch (e) { console.error(e); }
  }

  const r = game.renderer;
  const ctx = r.beginUI();
  hit.begin();
  if (scr && scr.draw) {
    try { scr.draw(ctx, dt); } catch (e) { console.error(e); }
  }
  for (const o of game.overlays) {
    try { o(ctx, dt); } catch (e) { console.error(e); }
  }
  hit.resolve();
  if (game.padToast) {
    const pt = game.padToast;
    pt.t += dt;
    if (pt.t > 3.2) game.padToast = null;
    else if (Math.floor(pt.t * 4) % 2 === 0 || pt.t > 0.8) osd(ctx, pt.text, UI_W - 40, 52, 20, pt.text.includes('DIS') ? '#ffb0a0' : '#d8ffd8', 'right');
  }
  if (audio.ctx && audio.ctx.state !== 'running' && game.screen?.name !== 'boot' && game.time > 4) {
    if (Math.floor(game.time * 1.5) % 3 !== 0) osd(ctx, 'NO SOUND? CLICK THE TV OR PRESS ANY KEY', UI_W / 2, 30, 16, '#ffe8a0', 'center');
  }

  const view = scr?.view ? scr.view() : null;
  r.render(view?.scene || null, view?.camera || null, dt, game.fx);
  input.endFrame();

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

// Auto quality: step the picture down if the frame rate sags, give it back
// once there's headroom. Rungs, cheapest last.
const QUALITY = [
  { lines: 900 }, { lines: 720 }, { lines: 600 }, { lines: 540 },
  { lines: 540, msaa: false }, { lines: 432, msaa: false, display: 0.75 },
];
let lowStreak = 0, highStreak = 0;
function autoQuality(scr) {
  const r = game.renderer;
  if (!settings.get('autoQuality') || game._transition || !scr?.heavy) {
    lowStreak = highStreak = 0;
    return;
  }
  const top = Math.max(0, QUALITY.findIndex((q) => q.lines === settings.get('lines')));
  let i = r.qualityRung ?? QUALITY.findIndex((q) => q.lines === r.internalLines);
  if (i < 0) i = top;
  if (game.fps < 38) { lowStreak++; highStreak = 0; } else if (game.fps > 56) { highStreak++; lowStreak = 0; } else { lowStreak = highStreak = 0; }
  let next = i;
  if (lowStreak >= 2 && i < QUALITY.length - 1) { next = i + 1; lowStreak = 0; }
  if (highStreak >= 4 && i > top) { next = i - 1; highStreak = 0; }
  if (next !== i) {
    const q = QUALITY[next];
    r.qualityRung = next;
    r.setQuality({ lines: q.lines, msaa: q.msaa !== false, display: q.display || 1 });
  }
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

  await import('./screens/index.js');

  const start = game.query.get('screen') || 'boot';
  if (start !== 'boot') game.renderer.power = 1;
  await swapScreen(start, Object.fromEntries(game.query.entries()));
  requestAnimationFrame((t) => { last = t; loop(t); });

  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true });

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
  showError(e);
});

export { UI_W, UI_H };
