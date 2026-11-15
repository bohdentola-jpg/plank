// Boot, the main loop and the scene switcher.

import { W, H, FPS, VERSION } from './core/config.js';
import { InputManager } from './core/input.js';
import { AudioSys } from './core/audio.js';
import { Music } from './core/music.js';
import { clamp, ease, TAU } from './core/util.js';
import { OUT } from './core/gfx.js';
import { loadSettings, saveSettings } from './core/storage.js';
import { BootScene } from './scenes/boot.js';
import { BattleScene } from './scenes/battle.js';
import { SheetScene } from './scenes/sheet.js';

const canvas = document.getElementById('game');
const frame = document.getElementById('frame');
const ctx = canvas.getContext('2d');

const settings = loadSettings();
const input = new InputManager(settings);
input.importConfig(settings.input);
input.attach(window, canvas);
const audio = new AudioSys();
audio.volSfx = settings.volSfx; audio.volMusic = settings.volMusic; audio.muted = settings.muted;
audio.music = new Music(audio);

const app = {
  canvas, ctx, input, audio, settings, version: VERSION,
  scene: null, t: 0,
  trans: null,          // {t, dur, make, phase, kind}
  scale: 1,
  save() { settings.input = input.exportConfig(); saveSettings(settings); },
  // swap scenes behind an iris wipe (or instantly with kind 'cut')
  go(make, kind = 'iris') {
    if (this.trans && this.trans.phase === 0) return;
    if (kind === 'cut' || !this.scene) { this.setScene(make()); return; }
    this.trans = { t: 0, dur: 16, make, phase: 0, kind };
    this.audio.sfx('wipe', { vol: 0.5 });
  },
  setScene(s) {
    if (this.scene && this.scene.leave) this.scene.leave();
    this.scene = s;
    if (s.enter) s.enter();
  },
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (frame.requestFullscreen) frame.requestFullscreen().catch(() => {});
  },
  setQuality(q) { settings.quality = q; this.save(); resize(); },
};
window.__app = app;

// ---- sizing: fit a 4:3 box in the window; back it with real device pixels ----
function resize() {
  const fs = !!document.fullscreenElement;
  const availW = window.innerWidth - (fs ? 0 : 40), availH = window.innerHeight - (fs ? 0 : 40);
  const s = Math.max(0.4, Math.min(availW / W, availH / H));
  const cw = Math.floor(W * s), ch = Math.floor(H * s);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const q = settings.quality === 0 ? 0.5 : settings.quality === 1 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.max(400, Math.round(cw * q)), bh = Math.round(bw * (H / W));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  app.scale = bw / W;
  ctx.imageSmoothingEnabled = settings.quality !== 0;
}
window.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', resize);
resize();

input.onFirstGesture = () => audio.unlock();

// ---- loop: logic at a fixed 60/s, drawing whenever the browser asks ----
const STEP = 1000 / FPS;
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = now - last; last = now;
  if (dt > 250) dt = STEP;        // tab was in the background
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    acc -= STEP; steps++;
    input.poll();
    if (input.rawPressed.includes('F11') || (input.rawPressed.includes('KeyF') && input.down.has('AltLeft'))) app.toggleFullscreen();
    app.t++;
    const tr = app.trans;
    if (tr) {
      tr.t++;
      if (tr.phase === 0 && tr.t >= tr.dur) { app.setScene(tr.make()); tr.phase = 1; tr.t = 0; }
      else if (tr.phase === 1 && tr.t >= tr.dur) app.trans = null;
    }
    if (app.scene && !(tr && tr.phase === 0)) app.scene.update();
  }
  if (steps === 4) acc = 0;
  draw();
}

function draw() {
  ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
  if (app.scene) app.scene.draw(ctx);
  const tr = app.trans;
  if (tr) {      // iris: a circle of picture closing down to nothing, then opening
    const u = clamp(tr.t / tr.dur, 0, 1);
    const k = tr.phase === 0 ? 1 - ease.in(u) : ease.out(u);
    const r = k * 520;
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0, r), 0, TAU, true); ctx.fill('evenodd');
    if (r > 2) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
  }
}

// ---- start ----
const qs = new URLSearchParams(location.search);
if (qs.get('battle')) {
  // developer shortcut: ?battle=lunchlady,lunchlady&stage=loading&cpu=7&human=1
  const ids = qs.get('battle').split(',');
  const human = qs.get('human') !== '0';
  const cfg = {
    stage: qs.get('stage') || 'loading', skipIntro: qs.get('intro') === '0', seed: +qs.get('seed') || undefined,
    rules: { stocks: +qs.get('stocks') || 3, time: +qs.get('time') || 0, items: qs.get('items') !== '0', hazards: true },
    players: ids.map((id, i) => ({ fighter: id, costume: i, type: i === 0 && human ? 'human' : 'cpu', device: 'kbA', level: +qs.get('cpu') || 5 })),
    // testing aids: &super=1 everyone starts with a Gold Star (2 = re-granted every 8s, or a slot number 11..14 for one player),
    // &helper=<id> summons that helper for player 1, &pct=80 starting damage
    debug: { super: +qs.get('super') || 0, helper: qs.get('helper'), pct: +qs.get('pct') || 0 },
  };
  document.fonts.ready.then(() => { audio.load(); app.setScene(new BattleScene(app, cfg)); });
} else if (qs.get('sheet')) {
  document.fonts.ready.then(() => app.setScene(new SheetScene(app, qs.get('sheet'), { page: +qs.get('page') || 0, costume: +qs.get('costume') || 0, move: qs.get('move'), cols: +qs.get('cols') || 0, rows: +qs.get('rows') || 0, clean: qs.get('clean') === '1' })));
} else {
  app.setScene(new BootScene(app));
}
requestAnimationFrame(tick);
