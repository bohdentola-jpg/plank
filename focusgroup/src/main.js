// FOCUS GROUP — EB AFTER DARK
//
// Six mornings in a flat you have lived in for four years. There is nothing
// hunting you and nothing to fight and no way to lose, and that is the
// argument the game is making.
//
// This file is the projector: it boots, it builds a morning, it runs the
// checklist, it lets the Director take the shot when the Director wants it,
// and on Sunday it stops pretending.

import * as THREE from 'three';
import { World } from './world.js';
import { Lens } from './surveil.js';
import { Audio } from './audio.js';
import { Player } from './player.js';
import { Director } from './cameras.js';
import { Hud, Reader, renderJournal } from './hud.js';
import { SurveyCard, surveyEcho } from './survey.js';
import { AdReel, filmPass } from './ad.js';
import { buildFlat, SPAWN, GIFT_SLOTS, DEFAULT_GIFT_SPOTS, FLAT } from './apartment.js';
import { buildBasement, BASEMENT_SPAWN } from './basement.js';
import { buildStudio, STUDIO_SPAWN, MARKS } from './studio.js';
import * as P from './props.js';
import { logoCanvas, drawSnow } from './textures.js';
import { store, save, newWeek, markEnding } from './save.js';
import {
  DAYS, dayByNumber, LENSES, LAST_LENS, COLD_OPEN, ADS, FINAL_AD,
  NOTES, ENDINGS, THE_LINE, BRAND,
} from './story.js';
import { clamp, clamp01, damp, fmtStamp } from './util.js';

const qs = new URLSearchParams(location.search);

// How hard the deck judders once it has the shot. A time-lapse recorder does
// not owe you sixty frames a second and by Sunday it is not pretending to.
const HOLD_FPS = [0, 14, 12, 11, 9, 8, 6];

class Game {
  constructor() {
    this.state = 'boot';
    this.paused = false;
    this.dayIndex = 0;              // 0..5
    this.clockSecs = 6 * 3600 + 41 * 60;
    this.engagement = store.engagement || 0;
    this.noticed = new Set(store.noticed || []);
    this.scene3 = 'flat';
    this.playerRoom = null;
    this.holdT = 0;

    // ------------------------------------------------------------ three
    this.holder = document.getElementById('game-holder');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.045, 90);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.holder.appendChild(this.renderer.domElement);

    // ------------------------------------------------------------ systems
    this.overlay = document.getElementById('overlay');
    this.audio = new Audio();
    this.lens = new Lens(this.renderer, this.scene, this.camera, this.overlay);
    this.hud = new Hud(this.overlay, this);
    this.reader = new Reader(document.getElementById('app'));
    this.survey = new SurveyCard(document.getElementById('app'));
    this.director = new Director(this);
    this.player = new Player({ onFootstep: (m, f) => this.audio.footstep(m, f) });

    this.avatar = P.avatar({});
    this.avatar.group.visible = false;
    this.scene.add(this.avatar.group);

    this.adCanvas = document.getElementById('adscreen');
    this.adCtx = this.adCanvas.getContext('2d');
    this.reel = new AdReel({ audio: this.audio });
    this.tvReel = new AdReel({ audio: this.audio });
    this.tvPaintT = 0;

    // ------------------------------------------------------------ state
    this.input = { fwd: 0, back: 0, left: 0, right: 0, run: 0 };
    this.steps = [];
    this.firedBeats = new Set();
    this.pending = [];              // delayed beats
    this.world = null;
    this.warm = 0;                  // the studio light that has no source
    this.sick = 0;
    this.fade = 0;
    this.flash = 0;
    this.lastSpeed = 0;
    this.fumbleCd = 0;
    this.valT = 0;
    this.giftQueue = [];
    this.activeLenses = new Set();
    this.giftPlaced = {};
    this.surveyAnswers = store.survey || null;

    this.applySettings();
    this.bindInput();
    this.buildScreens();
    this.resize();
    addEventListener('resize', () => this.resize());

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ================================================================ chrome

  buildScreens() {
    const logo = logoCanvas('FOCUS GROUP').toDataURL();
    document.getElementById('boot-logo').src = logo;
    document.getElementById('title-logo').src = logo;

    document.getElementById('boot').addEventListener('click', () => this.leaveBoot());
    addEventListener('keydown', (e) => {
      if (this.state === 'boot' && (e.code === 'Space' || e.code === 'Enter' || e.key.length === 1)) {
        this.leaveBoot();
      }
    });

    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('t-new', () => { newWeek(); this.noticed.clear(); this.engagement = 0; this.startWeek(1); });
    on('t-continue', () => this.startWeek(store.day || 1));
    on('t-journal', () => { this.renderJournalScreen(); this.showScreen('journal'); });
    on('t-how', () => this.showScreen('how'));
    on('t-options', () => { this.renderOptions(); this.showScreen('options'); });
    document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => this.showScreen('title'); });

    on('p-resume', () => this.setPaused(false));
    on('p-journal', () => { this.renderJournalScreen('p-journal-list'); this.showScreen('pjournal'); });
    on('pj-back', () => this.showScreen('pause'));
    on('p-quit', () => this.toTitle());
    on('end-back', () => this.toTitle());

    const cont = document.getElementById('t-continue');
    if (cont) {
      const d = store.day || 1;
      cont.disabled = d <= 1;
      cont.innerHTML = d > 1
        ? `CONTINUE — ${dayByNumber(d).weekday}<small>morning ${d} of six</small>`
        : 'CONTINUE';
    }
    const rec = document.getElementById('title-record');
    if (rec) {
      const seen = store.endings.length;
      const twelve = [...this.noticed].filter((id) => id !== 'last').length;
      rec.textContent = seen
        ? `${twelve}/12 lenses found · ${seen}/3 endings on file`
        : 'no file on you yet';
    }
  }

  showScreen(name) {
    this.screen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === `scr-${name}`));
    const boot = document.getElementById('boot');
    if (boot) boot.hidden = name !== 'boot';
    this.hud.setVisible(name === 'play');
    this.adCanvas.hidden = name !== 'ad';
  }

  leaveBoot() {
    if (this.state !== 'boot') return;
    this.state = 'title';
    this.audio.ensure();
    this.audio.resume();
    this.showScreen('title');

    if (qs.has('quick') || qs.has('day')) {
      this.startWeek(parseInt(qs.get('day') || '1', 10) || 1, { skipAd: true });
    }
  }

  toTitle() {
    this.setPaused(false);
    this.state = 'title';
    this.teardown();
    this.audio.stopTone();
    this.lens.setStrip(null);
    this.buildScreens();
    this.showScreen('title');
    document.exitPointerLock?.();
  }

  renderJournalScreen(id = 'journal-list') {
    const host = document.getElementById(id);
    if (host) renderJournal(host, this.noticed, { ...LENSES, last: LAST_LENS });
  }

  renderOptions() {
    const host = document.getElementById('opt-list');
    if (!host) return;
    host.innerHTML = '';
    const s = store.settings;
    const row = (label, el) => {
      const d = document.createElement('div');
      d.className = 'opt-row';
      d.innerHTML = `<span>${label}</span>`;
      d.appendChild(el);
      const b = document.createElement('b');
      d.appendChild(b);
      host.appendChild(d);
      return b;
    };
    const slider = (label, key, min, max, step, fmt) => {
      const i = document.createElement('input');
      i.type = 'range';
      i.min = min; i.max = max; i.step = step;
      i.value = s[key];
      const b = row(label, i);
      b.textContent = fmt(s[key]);
      i.oninput = () => { s[key] = +i.value; b.textContent = fmt(s[key]); this.applySettings(); save(); };
    };
    slider('LOOK SENSITIVITY', 'sens', 0.3, 2.5, 0.05, (v) => v.toFixed(2));
    slider('SOUND', 'volSfx', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
    slider('MUSIC', 'volMusic', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);

    const toggle = (label, key, note = '') => {
      const btn = document.createElement('button');
      btn.className = 'menu-btn';
      const paint = () => { btn.textContent = `${s[key] ? '✓ ON' : '✗ OFF'}${note ? ` — ${note}` : ''}`; };
      paint();
      btn.onclick = () => { s[key] = !s[key]; paint(); this.applySettings(); save(); };
      row(label, btn);
    };
    toggle('INVERT LOOK', 'invertY');
    // some people cannot take the judder. Valco understands.
    toggle('CAMERA JUDDER', 'hold', 'the deck records at a few frames a second');
  }

  applySettings() {
    const s = store.settings;
    this.player.sens = s.sens;
    this.player.invertY = s.invertY;
    this.audio.volSfx = s.volSfx;
    this.audio.volMusic = s.volMusic;
    this.audio.setMuted(s.muted);
  }

  // ================================================================ input

  bindInput() {
    const canvas = this.renderer.domElement;
    const KEYS = {
      KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    };

    canvas.addEventListener('click', () => {
      if (this.state === 'play' && !this.paused && !this.blocked()) canvas.requestPointerLock?.();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.paused) return;
      this.player.turn(e.movementX, e.movementY);
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.state === 'play' && document.pointerLockElement !== canvas
          && !this.blocked() && !this.paused) this.setPaused(true);
    });

    addEventListener('keydown', (e) => {
      if (KEYS[e.code]) { this.input[KEYS[e.code]] = 1; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.run = 1;

      if (e.code === 'Escape') {
        if (this.state === 'play') this.setPaused(!this.paused);
        return;
      }
      if (this.state === 'ad') {
        // a commercial can be skipped. It notices.
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') this.reel.skip();
        return;
      }
      if (this.reader.open) { if (e.code === 'KeyE' || e.code === 'Escape') this.reader.close(); return; }
      if (this.state !== 'play' || this.paused) return;

      if (e.code === 'KeyE') this.doInteract('E');
      if (e.code === 'KeyQ') this.doInteract('Q');
      if (e.code === 'KeyM') { store.settings.muted = !store.settings.muted; this.applySettings(); save(); }
    });
    addEventListener('keyup', (e) => {
      if (KEYS[e.code]) this.input[KEYS[e.code]] = 0;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.run = 0;
    });
    addEventListener('blur', () => {
      Object.keys(this.input).forEach((k) => { this.input[k] = 0; });
    });
  }

  blocked() { return this.reader.open || this.survey.open || !!this.choiceOpen; }

  setPaused(v) {
    if (this.state !== 'play') return;
    this.paused = v;
    this.showScreen(v ? 'pause' : 'play');
    if (v) document.exitPointerLock?.();
    else this.renderer.domElement.requestPointerLock?.();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.director.cam.aspect = w / h;
    this.director.cam.updateProjectionMatrix();
    this.lens.resize(w, h);
    this.adCanvas.width = Math.min(1280, Math.floor(w * 0.9));
    this.adCanvas.height = Math.floor((this.adCanvas.width * 3) / 4);
  }

  // ================================================================ the week

  async startWeek(day = 1, o = {}) {
    this.showScreen('load');
    await this.frame();
    if (!o.skipAd && day <= 1) {
      // the cold open. Everything that happens afterwards is in here already.
      await this.playAd(COLD_OPEN, { tagline: BRAND.tagline[0], fullscreen: true });
    }
    await this.beginDay(day);
  }

  frame() { return new Promise((r) => setTimeout(r, 16)); }

  teardown() {
    this.world?.dispose();
    this.world = null;
    this.avatar.group.visible = false;
    this.director.shot = null;
  }

  /** @param {number} n 1..6 */
  async beginDay(n) {
    const day = dayByNumber(n);
    this.day = day;
    this.dayIndex = n - 1;
    this.scene3 = n === 6 ? 'studio' : 'flat';
    this.firedBeats.clear();
    this.pending.length = 0;
    this.activeLenses = new Set(day.lenses);
    this.giftPlaced = {};
    this.valT = 0;
    this.fade = 1;

    const [hh, mm] = String(day.clock).split(':');
    this.clockSecs = (parseInt(hh, 10) || 6) * 3600 + (parseInt(mm, 10) || 41) * 60;

    this.teardown();
    this.buildScene(day);

    this.steps = day.steps.map((s) => ({ ...s, done: false, n: 0 }));
    this.hud.setDay(day);
    this.hud.renderSteps(this.steps);
    this.hud.showDayCard(day);
    setTimeout(() => this.hud.hideDayCard(), 3600);

    this.director.beginDay(store.settings.hold ? day.cutBudget : { count: 0, min: 0, max: 0 }, this.world);
    this.state = 'play';
    this.paused = false;
    this.showScreen('play');
    this.renderer.domElement.requestPointerLock?.();

    store.day = Math.max(store.day || 1, n);
    save();

    this.fire('day:start');

    // Sunday's first line of script is 'SUBJECT wakes. Reacts.', and you have
    // already done both by the time you can move.
    if (day.n === 6) {
      setTimeout(() => {
        const wake = this.steps.find((s) => s.id === 'wake');
        if (wake && !wake.done && this.state === 'play') this.completeStep(wake);
      }, 4200);
    }
  }

  buildScene(day) {
    const dress = {
      ...day.dress,
      lenses: day.lenses,
      giftSpots: this.giftSpotsFromSave(),
    };
    const outside = day.n === 5 ? 'grey' : 'sodium';

    if (day.n === 6) {
      this.world = buildStudio(dress);
      this.player.spawn(STUDIO_SPAWN.x, STUDIO_SPAWN.z, STUDIO_SPAWN.yaw);
    } else {
      this.world = buildFlat(dress, day.light, outside);
      this.player.spawn(SPAWN.x, SPAWN.z, SPAWN.yaw);
    }
    this.scene.add(this.world.group);
    this.warm = day.light || 0;
    this.wireActions(day);
    this.audio.startTone(day.n === 6 ? 'studio' : 'flat');
  }

  giftSpotsFromSave() {
    if (!store.giftSpots) return DEFAULT_GIFT_SPOTS;
    const out = {};
    for (const [kind, slotId] of Object.entries(store.giftSpots)) {
      const slot = GIFT_SLOTS.find((s) => s.id === slotId);
      if (slot) out[kind] = { x: slot.x, y: slot.y, z: slot.z };
    }
    return Object.keys(out).length ? out : DEFAULT_GIFT_SPOTS;
  }

  // ================================================================ actions

  /** Hang the day's checklist on real things in the room. */
  wireActions(day) {
    const w = this.world;
    const p = w.props || {};
    const add = (id, pos, label, o = {}) => w.addInteract({
      id: `do:${id}`, key: 'E', pos, label, r: o.r ?? 2.0, cone: o.cone ?? 0.35,
      enabled: o.enabled !== false, step: id,
    });

    if (day.n === 6) {
      // Sunday's interacts are already in the set; they just need the step tag
      for (const [iid, step] of [['window', 'window'], ['monitors', 'monitors'],
        ['val', 'val'], ['mark', 'mark'], ['line', 'line']]) {
        const it = w.interactById(iid);
        if (it) it.step = step;
      }
      // The thirteenth camera is only there for somebody who found the other
      // twelve. It is not on the script and nobody mentions it.
      const last = w.interactById('lens:last');
      if (last && this.noticed.size >= Object.keys(LENSES).length) {
        last.enabled = true;
        setTimeout(() => {
          if (this.state === 'play') {
            this.hud.toast('YOU FOUND ALL TWELVE. THERE IS A THIRTEENTH.', 5, 'good');
          }
        }, 9000);
      }
      return;
    }

    if (this.has('alarm')) add('alarm', { x: -1.30, y: 0.62, z: -7.86 }, 'TURN THE RADIO OFF', { r: 1.5 });
    if (this.has('blinds')) add('blinds', { x: -0.86, y: 1.55, z: 1.24 }, 'OPEN THE BLINDS', { r: 2.2 });
    if (this.has('coffee')) add('coffee', { x: 2.86, y: 1.05, z: 1.00 }, 'PUT THE COFFEE ON', { r: 1.9 });
    if (this.has('tv')) add('tv', { x: -3.30, y: 0.95, z: -1.20 }, 'PUT THE NEWS ON', { r: 2.2 });
    if (this.has('post')) add('post', { x: 3.00, y: 0.10, z: -4.45 }, 'PICK UP THE POST', { r: 1.8 });
    if (this.has('survey')) add('survey', { x: 1.70, y: 0.78, z: -1.70 }, 'FILL IN THE CARD', { r: 1.8, enabled: false });
    if (this.has('box')) add('box', { x: 3.05, y: 0.30, z: -4.35 }, 'BRING THE PARCEL IN', { r: 2.0 });
    if (this.has('smile')) add('smile', { x: 0.90, y: 1.55, z: -8.36 }, 'SMILE AT THE MIRROR', { r: 1.7 });
    if (this.has('say')) add('say', { x: 2.60, y: 1.00, z: 0.90 }, 'SAY SOMETHING ABOUT THE COFFEE', { r: 2.0, enabled: false });
    if (this.has('relax')) add('relax', { x: -1.30, y: 0.75, z: -1.20 }, 'SIT DOWN', { r: 2.0 });
    if (this.has('door')) add('door', { x: 3.20, y: 1.05, z: -4.48 }, 'ANSWER THE DOOR', { r: 2.2, enabled: false });
    if (this.has('leave')) add('leave', { x: 3.20, y: 1.05, z: -4.48 }, 'LEAVE FOR WORK', { r: 2.2, enabled: false });
    if (this.has('lift')) add('lift', { x: 3.20, y: 1.05, z: -4.48 }, 'GO DOWN', { r: 2.2, enabled: false });

    if (this.has('marks') && p.marks) {
      const at = [[-2.10, -0.40], [1.90, -0.30], [-0.20, -4.50]];
      at.forEach(([mx, mz], i) => {
        // the prompt sits at head height above the tape: standing on a mark
        // means your eyes are a metre and a bit above it, and the radius is
        // measured from your eyes
        w.addInteract({
          id: `do:mark${i}`, key: 'E', pos: { x: mx, y: 1.45, z: mz },
          label: 'STAND ON IT', r: 1.3, cone: -1, enabled: false, step: `mark${i}`,
        });
      });
    }

    if (this.has('gifts')) {
      // every reasonable place a person puts a thing, offered once you have
      // something to put down
      GIFT_SLOTS.forEach((slot) => {
        w.addInteract({
          id: `slot:${slot.id}`, key: 'E', pos: { x: slot.x, y: slot.y + 0.06, z: slot.z },
          label: `PUT IT ON ${slot.label.toUpperCase()}`, r: 1.9, cone: 0.35,
          enabled: false, slot: slot.id,
        });
      });
    }
  }

  has(id) { return this.day.steps.some((s) => s.id === id); }

  enableStep(id, v = true) {
    if (id === 'marks') {
      for (let i = 0; i < 3; i++) {
        const m = this.world?.interactById(`do:mark${i}`);
        if (m) m.enabled = v;
      }
    } else {
      const it = this.world?.interactById(`do:${id}`);
      if (it) it.enabled = v;
    }
    // a step you have been given is a step you can see
    const step = this.steps.find((x) => x.id === id);
    if (step && v && step.hidden) {
      step.hidden = false;
      step.fresh = true;
      this.hud.renderSteps(this.steps);
      this.audio.oneShot('tape', 0.4);
    }
  }

  doInteract(key) {
    if (this.blocked()) return;
    const eye = this.player.eye();
    const dir = this.player.look();
    const hit = this.world.focus(eye, dir, { key });
    if (!hit) return;

    if (key === 'Q' && hit.lens) { this.notice(hit); return; }
    if (hit.slot) { this.placeGift(hit); return; }
    if (hit.step) { this.doStep(hit.step, hit); return; }

    // the set pieces that are not checklist items
    if (hit.id === 'bell') { this.ringBell(hit); return; }
    if (hit.id === 'panel') { this.audio.oneShot('click'); this.hud.say('Every flat in the block, and what it is currently doing.', 6); return; }
    if (hit.id === 'door') { this.enterServices(); return; }
  }

  // ================================================================ noticing

  notice(hit) {
    const id = hit.lens;
    if (this.noticed.has(id)) return;
    this.noticed.add(id);
    store.noticed = [...this.noticed];
    save();

    hit.enabled = false;
    this.audio.oneShot('noticed', 0.9);
    this.audio.oneShot('iris', 0.7, hit.pos);

    const rec = id === 'last' ? LAST_LENS : LENSES[id];
    this.hud.say(rec ? rec.found : 'A lens.', 6.5);
    this.bumpEngagement(6, false);

    if (id === 'last') { this.endGame('last'); return; }
    if (this.noticed.size === 1) this.fire('notice:first');
    if (this.noticed.size >= 12) this.hud.toast('ALL TWELVE. THE PANEL IS DELIGHTED.', 4, 'good');
  }

  /** An engaged subject is a valuable subject. */
  bumpEngagement(n, quiet = true) {
    this.engagement = clamp(this.engagement + n, 0, 100);
    store.engagement = this.engagement;
    if (!quiet) this.hud.praise();
    this.audio.oneShot('praise', 0.5);
  }

  // ================================================================ steps

  doStep(id, hit) {
    const step = this.steps.find((s) => s.id === id)
      || (id.startsWith('mark') ? this.steps.find((s) => s.id === 'marks') : null);
    if (!step) return;

    switch (id) {
      case 'alarm':
        this.world.props.radio?.paint('', false);
        this.audio.oneShot('radioOff', 1, hit.pos);
        break;
      case 'blinds': {
        const win = this.world.props.win;
        this.audio.oneShot('blinds', 1, hit.pos);
        let k = 0;
        const t = setInterval(() => { k = Math.min(1, k + 0.08); win.setOpen(k); if (k >= 1) clearInterval(t); }, 28);
        break;
      }
      case 'coffee':
        this.world.props.coffee?.setBrewing(true);
        this.audio.oneShot('kettle', 0.9, hit.pos);
        setTimeout(() => {
          this.world.props.coffee?.setFull(true);
          this.world.props.coffee?.setBrewing(false);
          this.enableStep('say');
        }, 9000);
        break;
      case 'tv':
        this.startTvAd();
        break;
      case 'post':
        this.audio.oneShot('click', 1, hit.pos);
        this.enableStep('survey');
        break;
      case 'box':
        this.audio.oneShot('door', 0.8, hit.pos);
        this.world.props.parcel?.parent?.remove(this.world.props.parcel);
        this.giftQueue = ['mug', 'lamp', 'figurine', 'alarm'];
        this.offerSlots(true);
        break;
      case 'smile':
        this.audio.oneShot('praise', 0.8);
        break;
      case 'relax':
        this.hud.say('You sit down. There is nothing on. There is nothing to do.', 6);
        break;
      case 'door':
        this.audio.oneShot('door', 1, hit.pos);
        break;
      case 'leave':
        break;
      case 'lift':
        // Saturday does not end at the front door. It ends underneath you.
        if (hit) hit.enabled = false;
        this.completeStep(step);
        this.goToBasement();
        return;
      case 'monitors':
      case 'window':
      case 'val':
      case 'mark':
      case 'line':
        this.sundayStep(id, hit);
        return;
      default:
        break;
    }

    if (id.startsWith('mark')) {
      hit.enabled = false;
      step.n = (step.n || 0) + 1;
      this.fire(`mark:${step.n}`);
      this.bumpEngagement(4);
      if (step.n >= (step.count || 3)) this.completeStep(step);
      else this.hud.renderSteps(this.steps);
      return;
    }

    if (hit) hit.enabled = false;
    this.completeStep(step);
  }

  completeStep(step) {
    if (step.done) return;
    step.done = true;
    this.hud.renderSteps(this.steps);
    this.audio.jingleSting(0.5);
    this.bumpEngagement(step.last ? 2 : 5);
    this.fire(`step:${step.id}`);
    setTimeout(() => this.fire(`after:${step.id}`), 400);

    // the last thing on the list opens the way out
    const required = this.steps.filter((s) => !s.last && !s.hidden);
    if (required.every((s) => s.done)) {
      const last = this.steps.find((s) => s.last);
      if (last && this.world?.interactById(`do:${last.id}`)) {
        this.enableStep(last.id);
        this.hud.toast('THE DOOR', 2.2);
      }
    }
    if (step.last) this.endDay();
  }

  // ---------------------------------------------------------------- gifts

  offerSlots(v) {
    for (const it of this.world.interacts) if (it.slot) it.enabled = v;
    if (v && this.giftQueue.length) {
      this.hud.toast(`CARRYING: ${this.giftQueue[0].toUpperCase()}`, 3);
    }
  }

  placeGift(hit) {
    const kind = this.giftQueue.shift();
    if (!kind) return;
    const slot = GIFT_SLOTS.find((s) => s.id === hit.slot);
    hit.enabled = false;
    this.audio.oneShot('cupdown', 0.8, hit.pos);

    const w = this.world;
    const pos = { x: slot.x, y: kind === 'alarm' ? 2.42 : slot.y, z: slot.z };
    let anchor = null;
    if (kind === 'mug') { const g = P.mug(w, pos.x, pos.y, pos.z, { lens: true }); anchor = g.userData.lens; }
    if (kind === 'lamp') { const g = P.giftLamp(w, pos.x, pos.y, pos.z, { lens: true }); g.setOn(true); anchor = g.group.userData.lens; }
    if (kind === 'figurine') { const g = P.figurine(w, pos.x, pos.y, pos.z, { lens: true }); anchor = g.userData.lens; }
    if (kind === 'alarm') { const g = P.smokeDetector(w, pos.x, pos.y, pos.z, { noBattery: true }); anchor = g.lens; }

    // it can see the room now, and the room can be cut to
    const num = { mug: 9, lamp: 10, figurine: 11, alarm: 12 }[kind];
    w.camSpot(kind, { x: pos.x, y: pos.y + (kind === 'alarm' ? -0.05 : 0.12), z: pos.z },
      { x: pos.x > 0 ? pos.x - 1.6 : pos.x + 1.6, y: 1.0, z: pos.z - 1.0 },
      { num, fov: 82, room: slot.room });

    if (anchor) {
      const v = new THREE.Vector3();
      anchor.getWorldPosition(v);
      w.addInteract({
        id: `lens:${kind}`, lens: kind, key: 'Q', pos: { x: v.x, y: v.y, z: v.z },
        r: 2.2, cone: 0.90, label: LENSES[kind]?.hint || 'something',
      });
    }

    this.activeLenses.add(kind);
    store.giftSpots = { ...(store.giftSpots || {}), [kind]: slot.id };
    save();

    const step = this.steps.find((s) => s.id === 'gifts');
    step.n = (step.n || 0) + 1;
    this.fire(`gift:${step.n}`);
    this.hud.renderSteps(this.steps);

    if (this.giftQueue.length) {
      this.hud.toast(`CARRYING: ${this.giftQueue[0].toUpperCase()}`, 3);
      this.offerSlots(true);
    } else {
      this.offerSlots(false);
      this.completeStep(step);
    }
  }

  // ---------------------------------------------------------------- Saturday

  ringBell(hit) {
    hit.enabled = false;
    this.audio.oneShot('bell', 1, hit.pos);
    this.fire('bell');
    setTimeout(() => {
      const d = this.world.interactById('door');
      if (d) d.enabled = true;
      this.audio.oneShot('door', 0.9);
      const leaf = this.world.props.services?.group;
      if (leaf) leaf.rotation.y = Math.PI - 0.7;
      this.hud.say('It opens. Nobody opened it.', 5);
    }, 2600);
  }

  async goToBasement() {
    this.state = 'load';
    this.fade = 1;
    this.showScreen('load');
    await this.frame();
    this.teardown();
    this.world = buildBasement({});
    this.scene.add(this.world.group);
    this.player.spawn(BASEMENT_SPAWN.x, BASEMENT_SPAWN.z, BASEMENT_SPAWN.yaw);
    this.scene3 = 'basement';
    this.audio.startTone('basement');
    this.audio.oneShot('lift', 1);
    this.director.beginDay({ count: 4, min: 5, max: 20 }, this.world);
    this.state = 'play';
    this.showScreen('play');
    this.renderer.domElement.requestPointerLock?.();
    setTimeout(() => this.world.props.closeLift(1), 2200);
    this.fire('enter:basement');
  }

  enterServices() {
    const step = this.steps.find((s) => s.id === 'services');
    if (step) this.completeStep(step);
  }

  // ---------------------------------------------------------------- Sunday

  sundayStep(id, hit) {
    const step = this.steps.find((s) => s.id === id);
    const p = this.world.props;
    switch (id) {
      case 'window':
        this.audio.oneShot('click', 0.6);
        break;
      case 'monitors':
        this.paintMonitors();
        // the grid comes up to a rehearsal level, which is the first time the
        // set is lit well enough to find anything on the floor
        p.rigUp?.(0.26);
        break;
      case 'val':
        this.audio.audience('applause', 0.8);
        p.sign?.setOn(true);
        setTimeout(() => p.sign?.setOn(false), 3400);
        setTimeout(() => { const m = this.world.interactById('mark'); if (m) m.enabled = true; }, 1600);
        break;
      case 'mark':
        p.rigUp(1);
        p.cams.wide.setLive(true);
        this.audio.oneShot('lightbank', 1);
        setTimeout(() => { const l = this.world.interactById('line'); if (l) l.enabled = true; }, 2400);
        break;
      case 'line':
        this.askTheLine();
        return;
      default:
        break;
    }
    if (hit) hit.enabled = false;
    if (step) this.completeStep(step);
  }

  /** Forty screens of your week. Eleven of them are somebody else. */
  paintMonitors() {
    const m = this.world.props.monitors;
    if (!m) return;
    const { ctx, cv } = m.live;
    const cw = cv.width / m.cols, ch = cv.height / m.rows;
    const reel = this.director.frames;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        const i = r * m.cols + c;
        const x = c * cw, y = r * ch;
        const f = reel.length ? reel[i % reel.length] : null;
        // eleven of them are not you, and there is no way to tell which
        const other = (i * 7 + 3) % 13 < 3;
        if (f && !other) {
          ctx.drawImage(f.cv, x + 3, y + 3, cw - 6, ch - 6);
        } else {
          ctx.fillStyle = other ? '#12161c' : '#0a0c10';
          ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
          if (other) {
            ctx.fillStyle = 'rgba(150,170,190,0.16)';
            ctx.fillRect(x + 10, y + ch * 0.45, cw - 20, ch * 0.3);
            ctx.fillStyle = 'rgba(180,200,220,0.10)';
            ctx.beginPath();
            ctx.arc(x + cw * 0.5, y + ch * 0.36, ch * 0.10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = 'rgba(220,230,240,0.62)';
        ctx.font = '11px "Courier New", monospace';
        ctx.fillText(`CAM ${String(i + 1).padStart(2, '0')}`, x + 8, y + 16);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        for (let sy = 0; sy < ch; sy += 3) ctx.fillRect(x, y + sy, cw, 1);
      }
    }
    m.live.touch();
  }

  askTheLine() {
    this.choiceOpen = true;
    this.player.frozen = true;
    document.exitPointerLock?.();
    const host = document.getElementById('choice');
    host.hidden = false;
    host.innerHTML = `
      <div class="ch-card">
        <div class="ch-slug">SC. 1 — INT. FLAT 11 — MORNING</div>
        <div class="ch-char">SUBJECT</div>
        <div class="ch-paren">(warmly, to camera)</div>
        <div class="ch-line">${THE_LINE}</div>
        <div class="ch-btns">
          <button id="ch-say" class="menu-btn gold">SAY IT</button>
          <button id="ch-no" class="menu-btn">SAY NOTHING</button>
        </div>
      </div>`;
    const done = (which) => {
      host.hidden = true;
      this.choiceOpen = false;
      this.player.frozen = false;
      this.endGame(which);
    };
    document.getElementById('ch-say').onclick = () => done('said');
    document.getElementById('ch-no').onclick = () => done('declined');
  }

  // ================================================================ beats

  /** Fire every beat listening for `key`. */
  fire(key) {
    const beats = this.day?.beats || [];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (b.on !== key) continue;
      const tag = `${key}#${i}`;
      if (b.once && this.firedBeats.has(tag)) continue;
      this.firedBeats.add(tag);
      if (b.delay) this.pending.push({ t: b.delay, beat: b });
      else this.runBeat(b);
    }
  }

  runBeat(b) {
    if (b.say) this.hud.say(b.say, 6.5);
    if (b.toast) this.hud.toast(b.toast, 2.6);
    if (b.sfx) {
      const map = {
        titter: () => this.audio.audience('titter'),
        laugh: () => this.audio.audience('laugh'),
        'applause-small': () => this.audio.audience('applause-small'),
        applause: () => this.audio.audience('applause'),
        knock: () => this.audio.oneShot('knock', 1),
        'sting-soft': () => this.audio.oneShot('stingSoft', 1),
        'lights-up': () => this.audio.oneShot('lightbank', 1),
      };
      (map[b.sfx] || (() => this.audio.oneShot(b.sfx)))();
    }
    if (b.cut) this.director.cut(b.cut.lens, b.cut.secs, b.cut);
    if (b.note) this.showNote(b.note);
    if (b.survey) this.showSurvey();
    if (b.ad !== undefined) this.startTvAd(b.ad);
    if (b.unlock) this.enableStep(b.unlock);
  }

  async showNote(id) {
    const note = NOTES[id];
    if (!note) return;
    document.exitPointerLock?.();
    this.audio.oneShot('tape', 0.5);
    await this.reader.show(note);
    if (this.state === 'play' && !this.paused) this.renderer.domElement.requestPointerLock?.();
  }

  async showSurvey() {
    document.exitPointerLock?.();
    const answers = await this.survey.show();
    this.surveyAnswers = answers;
    store.survey = answers;
    save();
    this.bumpEngagement(10, true);
    if (this.state === 'play' && !this.paused) this.renderer.domElement.requestPointerLock?.();
  }

  // ================================================================ the set

  startTvAd(which = null) {
    const tv = this.world?.props?.tv;
    if (!tv) return;
    tv.setOn(true);
    const script = ADS[which ?? this.day.n] || ADS[1];
    this.tvReel.play(script, {
      tagline: BRAND.tagline[this.dayIndex],
      frames: this.director.reel(4),
      survey: surveyEcho(this.surveyAnswers),
      onTv: true,
    }).then(() => {
      // afterwards the set carries on, because a television always does
      this.tvStatic = true;
    });
    this.tvStatic = false;
  }

  /** Full screen, with the world hidden behind it. */
  async playAd(script, o = {}) {
    this.state = 'ad';
    this.showScreen('ad');
    await this.reel.play(script, {
      tagline: o.tagline,
      frames: o.frames || this.director.reel(6),
      survey: surveyEcho(this.surveyAnswers),
      line: THE_LINE,
      onTv: false,
    });
    this.showScreen('load');
  }

  // ================================================================ endings

  async endDay() {
    const n = this.day.n;

    // Saturday's list does not end at the front door; it ends underneath you
    if (n === 5 && this.scene3 === 'flat') { await this.goToBasement(); return; }

    this.state = 'between';
    this.player.frozen = true;
    this.director.stopScheduling();
    this.director.release();
    document.exitPointerLock?.();

    const card = document.getElementById('scr-between');
    card.querySelector('.bt-day').textContent = `${this.day.weekday} ENDS`;
    card.querySelector('.bt-text').textContent = this.day.outro || '';
    this.showScreen('between');
    this.audio.stopTone();

    await new Promise((r) => setTimeout(r, 5200));
    this.player.frozen = false;
    if (n >= 6) { this.endGame('said'); return; }
    await this.beginDay(n + 1);
  }

  async endGame(which) {
    const end = ENDINGS[which] || ENDINGS.declined;
    markEnding(which);
    this.state = 'ending';
    this.player.frozen = true;
    this.director.stopScheduling();
    document.exitPointerLock?.();

    if (which === 'said') {
      this.world.props?.sign?.setOn(true);
      this.audio.audience('applause', 1);
      await new Promise((r) => setTimeout(r, 2600));
      // the finished commercial, starring whoever you turned out to be
      await this.playAd(FINAL_AD, { tagline: BRAND.tagline[5], frames: this.director.reel(6) });
    } else if (which === 'declined') {
      // the lights go out one bank at a time, unhurried, the way a shop closes
      for (let i = 0; i < 14; i++) {
        this.world.props?.killBank?.(i);
        this.audio.oneShot('lightbank', 0.35);
        await new Promise((r) => setTimeout(r, 620));
      }
      this.world.props?.rigUp?.(0);
      this.world.props?.setWorkLight?.(false);
      // and then it cuts away, and it does not cut back
      this.director.lock('studio-house', { note: 'PANEL 74-C — CONCLUDED' });
      this.endlessStamp = true;
      await new Promise((r) => setTimeout(r, 7000));
    } else {
      this.director.lock('last', { note: 'CAM 00 — AUDIENCE' });
      await new Promise((r) => setTimeout(r, 6000));
    }

    const scr = document.getElementById('scr-end');
    scr.querySelector('.end-h').textContent = end.head;
    scr.querySelector('.end-p').textContent = end.body.replace(/\s+/g, ' ').trim();
    scr.querySelector('.end-kick').textContent = end.kicker;
    // the thirteenth was never on the list of twelve
    const twelve = [...this.noticed].filter((id) => id !== 'last').length;
    scr.querySelector('.end-stats').innerHTML = `
      <div>LENSES FOUND<b>${twelve} / 12${this.noticed.has('last') ? ' + 1' : ''}</b></div>
      <div>ENGAGEMENT<b>${Math.round(this.engagement)}%</b></div>
      <div>FRAMES OF YOU<b>${this.director.frames.length}</b></div>
      <div>ENDINGS ON FILE<b>${store.endings.length} / 3</b></div>`;
    this.showScreen('end');
    this.lens.setStrip(null);
    this.player.frozen = false;
  }

  // ================================================================ frame

  lensExists(id) {
    if (this.scene3 !== 'flat') return true;
    return this.activeLenses.has(id);
  }

  tick(dt) {
    const w = this.world;
    if (!w) return;

    this.clockSecs += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].t -= dt;
      if (this.pending[i].t <= 0) { this.runBeat(this.pending[i].beat); this.pending.splice(i, 1); }
    }

    this.player.update(dt, this.input, w, { bodyRelative: this.director.active });
    this.playerRoom = w.roomAt(this.player.pos.x, this.player.pos.z);

    // ---- you barge into the door frame and somebody, somewhere, enjoys it
    this.fumbleCd -= dt;
    if (this.input.run && this.lastSpeed > 2.6 && this.player.speed < 0.7 && this.fumbleCd <= 0) {
      this.fumbleCd = 12;
      this.audio.oneShot('fumble', 0.8);
      this.fire('fumble');
    }
    this.lastSpeed = this.player.speed;

    // ---- the body. You only ever see it from across the room.
    const av = this.avatar;
    av.group.visible = this.director.active;
    av.group.position.set(this.player.pos.x, this.player.pos.y, this.player.pos.z);
    av.group.rotation.y = this.player.yaw;
    P.poseAvatar(av, this.player.speed / 2.2, performance.now() / 1000, this.player.pitch);

    this.director.update(dt);
    w.update(dt, this);

    // ---- the eye
    const eye = this.player.eye();
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, this.player.sway, 'YXZ');

    // ---- the prompt
    {
      const dir = this.player.look();
      const e = w.focus(eye, dir, { key: 'E' });
      const q = w.focus(eye, dir, { key: 'Q' });
      if (e) this.hud.setPrompt('E', e.label);
      else if (q) this.hud.setPrompt('Q', `LOOK CLOSER — ${q.label}`);
      else this.hud.setPrompt(null, null);
      this.hud.setReticle(!this.director.active);
    }

    this.tickSet(dt);
    this.tickVal(dt);

    // ---- the flat is very slowly being lit for television
    this.warm = damp(this.warm, this.day?.light ?? 0, 0.4, dt);
    if (w.setLightScale) w.setLightScale('studio', this.warm);
  }

  /** Everything in the room that is doing something on its own. */
  tickSet(dt) {
    const p = this.world.props || {};
    const t = this.clockSecs;

    if (p.clock) p.clock.setTime((t / 60) % 720);
    if (p.radio && !this.steps.find((s) => s.id === 'alarm')?.done) {
      const mins = Math.floor(t / 60) % 1440;
      p.radio.paint(`${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')}`, true);
    }
    if (p.opposite) p.opposite.setSync(this.day?.dress?.sync ? 1 : 0, t);

    // ---- the picture on the set
    if (p.tv && p.tv.on) {
      this.tvPaintT += dt;
      if (this.tvPaintT > 1 / 22) {
        this.tvPaintT = 0;
        const live = p.tv.live;
        if (this.tvReel.playing) {
          this.tvReel.update(1 / 22);
          this.tvReel.paint(live.ctx, live.cv.width, live.cv.height, { steady: false });
        } else {
          drawSnow(live.ctx, live.cv.width, live.cv.height);
        }
        live.touch();
        // the picture throws its light across the room and the room takes it
        p.tv.glow.intensity = 0.55 + Math.sin(t * 9) * 0.12;
      }
    }
  }

  /**
   * VAL does not move while you are looking at him, and he does not move
   * quickly when you are not, and he never arrives. He is simply included now.
   */
  tickVal(dt) {
    const val = this.world.props?.val;
    if (!val) return;
    this.valT += dt;

    if (this.scene3 === 'studio') {
      const step = this.steps.find((s) => s.id === 'monitors');
      if (step?.done && !val.group.visible) {
        val.group.visible = true;
        const it = this.world.interactById('val');
        if (it) { it.enabled = true; it.pos.set(val.group.position.x, 1.5, val.group.position.z); }
        this.fire('val:seen');
      }
      if (val.group.visible) val.head.rotation.y = 0;
      return;
    }

    // Saturday, in the flat: he is at the end of the hall
    if (!val.group.visible && this.valT > 26 && this.playerRoom === 'hall') {
      val.group.visible = true;
      val.group.position.set(-3.55, 0, -8.20);
      this.fire('val:seen');
      return;
    }
    if (!val.group.visible) return;

    // he only moves when he is not in shot, and then only a little
    const eye = this.player.eye();
    const dir = this.player.look();
    const dx = val.group.position.x - eye.x, dz = val.group.position.z - eye.z;
    const d = Math.hypot(dx, dz);
    const dot = (dx * dir.x + dz * dir.z) / Math.max(0.001, d);
    const seen = dot > 0.42 && !this.world.raySolid(eye, val.group.position);
    val.group.lookAt(eye.x, 0, eye.z);
    val.group.rotation.y += Math.PI;

    if (!seen && d > 2.2 && !this.director.active) {
      const k = Math.min(1, dt * 0.55);
      val.group.position.x += (this.player.pos.x - val.group.position.x) * k;
      val.group.position.z += (this.player.pos.z - val.group.position.z) * k;
      if (d < 5.5 && !this.firedBeats.has('val:closer#seen')) {
        this.firedBeats.add('val:closer#seen');
        this.fire('val:closer');
        this.audio.oneShot('stingSoft', 0.7);
      }
    }
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
    this.last = now;

    if (this.state === 'play' && !this.paused && !this.blocked()) this.tick(dt);
    else if (this.state === 'ending' || this.state === 'between') {
      this.world?.update(dt, this);
      this.director.update(dt);
      if (this.endlessStamp) this.clockSecs += dt * 4200;   // the timestamp keeps running
    }
    this.hud.update(dt);

    // ---- the full-screen commercial, which is not in the 3D scene at all
    if (this.state === 'ad') {
      this.reel.update(dt);
      const c = this.adCanvas;
      this.reel.paint(this.adCtx, c.width, c.height, {});
      return;
    }

    this.fade = damp(this.fade, 0, 2.2, dt);
    this.flash = damp(this.flash, 0, 4, dt);

    const cutting = this.director.active;
    this.lens.camera = cutting ? this.director.cam : this.camera;
    this.lens.setStrip(this.state === 'play' || this.state === 'ending' ? this.director.strip() : null);

    this.lens.render(dt, {
      mode: cutting ? 'cam' : 'eye',
      warm: this.warm,
      grain: this.galleryClean ? 0 : 0.05 + this.engagement / 900,
      tear: cutting ? 0.35 + this.dayIndex * 0.09 : 0,
      flash: this.flash,
      fade: this.fade,
      sick: this.sick,
      vign: this.galleryClean ? 0.15 : (cutting ? 0.95 : 0.82),
      holdFps: cutting && store.settings.hold ? HOLD_FPS[this.dayIndex + 1] : 0,
    });
  }
}

// ------------------------------------------------------------------- boot
const game = new Game();
window.FOCUSGROUP = game;

// A turntable of the week's art, for the screenshot harness.
if (qs.has('gallery')) {
  import('./gallery.js').then((m) => m.galleryMode(game)).catch(() => {});
}
// And every model on a grid under one flat light, for checking them.
if (qs.has('props')) {
  import('./propgallery.js').then((m) => m.propsMode(game)).catch((e) => console.error(e));
}
