// GRIDIRON GALAXY: THE LONG BOMB — app shell, screen manager, frame loop.
import * as THREE from '../vendor/three.module.js';
import { input } from './input.js';
import { loadSave, writeSave } from './save.js';
import { audio } from './audio.js';
import { SpaceScene } from './gfx/space.js';
import { PLANETS, PLANET_BY_ID } from './data/planets.js';
import { el, qs, wait } from './util.js';
import { TitleScreen } from './ui/title.js';
import { HubScreen } from './ui/hub.js';
import { OptionsScreen } from './ui/options.js';

const SCREENS = { title: TitleScreen, hub: HubScreen, options: OptionsScreen };
export function registerScreen(name, cls) { SCREENS[name] = cls; }

class App {
  constructor() {
    this.canvas = qs('#gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.save = loadSave(); audio.applySettings(this.save.settings);
    this.ui = qs('#ui'); this.hud = qs('#hud'); this.dialogEl = qs('#dialog'); this.toastEl = qs('#toast'); this.fadeEl = qs('#fade');
    this.c2d = qs('#c2d'); this.ctx2d = this.c2d.getContext('2d');
    this.space = new SpaceScene(this);
    this.screen = null; this.screenName = ''; this.is2D = false; this.dialogs = new Set();
    this.applyQuality(); this.resize();
    window.addEventListener('resize', () => this.resize());
    input.on((type, data) => { if (type === 'padconnected') this.toast(`Controller connected: ${String(data).split('(')[0].trim() || 'gamepad'}`); if (type === 'paddisconnected') this.toast('Controller disconnected'); });
    this.last = performance.now(); this.frames = 0; this.fpsT = 0; this.fps = 60;
    requestAnimationFrame(this.loop);
  }
  applyQuality() {
    const s = this.save.settings;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.quality === 'high' ? 2 : 1));
    this.renderer.shadowMap.enabled = !!s.shadows; this.renderer.shadowMap.needsUpdate = true;
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.space.resize(w, h);
    const dpr = Math.min(window.devicePixelRatio || 1, 2); this.c2d.width = Math.round(w * dpr); this.c2d.height = Math.round(h * dpr); this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = w; this.vh = h;
    if (this.screen && this.screen.resize) this.screen.resize(w, h);
  }
  use2D(on) { this.is2D = on; this.c2d.style.display = on ? 'block' : 'none'; this.canvas.style.display = on ? 'none' : 'block'; if (on) this.space.hideLabels(); }
  async go(name, params = {}) {
    const Cls = SCREENS[name];
    if (!Cls) { this.toast(`"${name}" is still being built on Maple Street.`); if (!this.screen) this.go('hub'); return; }
    if (this.screen && this.screen.exit) { try { this.screen.exit(); } catch (e) { console.error(e); } }
    this.ui.innerHTML = ''; this.hud.innerHTML = ''; this.dialogEl.innerHTML = ''; this.space.hideLabels();
    input.block(220);
    this.screenName = name; this.screen = new Cls(this, params);
    if (this.screen.enter) await this.screen.enter(params);
    this.fadeIn();
  }
  persist() { writeSave(this.save); }
  toast(msg, ms = 2600) {
    const t = el('div', { class: 't', html: msg }); this.toastEl.innerHTML = ''; this.toastEl.appendChild(t);
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { if (t.parentNode) t.remove(); }, ms);
  }
  async fadeOut(ms = 500) { this.fadeEl.style.transitionDuration = ms + 'ms'; this.fadeEl.classList.remove('clear'); await wait(ms + 30); }
  fadeIn(ms = 500) { this.fadeEl.style.transitionDuration = ms + 'ms'; this.fadeEl.classList.add('clear'); }
  storyTarget() {
    const st = this.save.story; if (st.complete) return null;
    if (!st.introDone) return PLANETS[0];
    return PLANETS[Math.min(Math.max(1, st.planet), PLANETS.length - 1)];
  }
  startStory() { if (this.story) this.story.start(); else this.toast('Story mode is still on the launch pad!'); }
  loop = (t) => {
    requestAnimationFrame(this.loop);
    let dt = (t - this.last) / 1000; this.last = t; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    this.frames++; this.fpsT += dt; if (this.fpsT > 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    input.poll(dt);
    try {
      if (this.screen) { if (this.screen.update) this.screen.update(dt); for (const d of this.dialogs) d.update(dt); if (this.screen.render) this.screen.render(); }
    } catch (e) { console.error(e); this._errCount = (this._errCount || 0) + 1; if (this._errCount > 60) { this._errCount = 0; this.toast('Something glitched. Returning to the hub.'); this.go('hub'); } }
    input.endFrame();
    if (!this._booted) { this._booted = true; const b = qs('#boot'); if (b) { b.classList.add('gone'); setTimeout(() => b.remove(), 700); } }
  };
}

// optional modules register their screens when loaded
const app = new App(); window.app = app;
const qp = new URLSearchParams(location.search);
const extra = [import('./ui/district.js'), import('./ui/shop.js'), import('./game/match.js'), import('./story.js'), import('./challenges.js'), import('./ui/practice.js'), import('./ui/playbook.js'), import('./gfx/gallery.js')];
Promise.allSettled(extra).then((res) => {
  res.forEach((r, i) => { if (r.status === 'rejected') console.warn('module unavailable', r.reason && r.reason.message); });
  if (res[3].status === 'fulfilled') res[3].value.installStory(app);
  const scene = qp.get('scene') || 'title';
  const params = {}; for (const [k, v] of qp.entries()) params[k] = v;
  app.go(scene, params);
});
