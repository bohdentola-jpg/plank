// CHROMA CLASH — app shell: renderer, loop, saves, mode switching.
import * as THREE from 'three';
import { Post } from './engine/post.js';
import { Input } from './engine/input.js';
import { Menus } from './ui/menus.js';
import { Plaza } from './modes/plaza.js';
import { Battle } from './modes/battle.js';
import { randomLook, migrateLook, STARTER_GEAR } from './actors/gear.js';
// --- story mode (The Underside) ---
import { Story } from './modes/story.js';
import { Tower } from './modes/tower.js';
import { WEAPONS } from './actors/weapons.js';
import { STAGE_IDS } from './world/stage.js';
import { quickMatch, createPrivateRoom, joinPrivateRoom, MAX_PLAYERS } from './net/room.js';

let audio = null;
try { audio = (await import('./audio.js')).audio; } catch (e) { console.warn('audio unavailable', e); }
const noop = () => {};
if (!audio) audio = { init: noop, sfx: noop, loop: () => ({ setVolume: noop, setPitch: noop, setPos: noop, stop: noop }), music: noop, setListener: noop, setVolume: noop, toggleMute: () => false, setMuted: noop };

const SAVE_KEY = 'chroma-clash-profile-v1';
const params = new URLSearchParams(location.search);

function defaultProfile() {
  return {
    v: 2, name: 'Rookie', created: false, look: { ...randomLook(), hat: 'cap_red', clothes: 'tee_basic', shoes: 'kicks_white' }, gear: [...STARTER_GEAR], ink: '#ff2e88', weapon: 'spritzer', owned: ['spritzer'],
    coins: 800, level: 1, xp: 0, lastSkill: 'normal', stats: { matches: 0, wins: 0, turf: 0, kills: 0 },
    settings: { sens: 1, invertY: false, music: 0.6, sfx: 0.85, quality: 'auto' },
  };
}
function loadProfile() {
  const d = defaultProfile();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw);
    const out = { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) }, stats: { ...d.stats, ...(p.stats || {}) } };
    out.look = migrateLook(p.look ? { ...p.look } : d.look);
    out.gear = [...new Set([...(p.gear || []), ...STARTER_GEAR, out.look.hat, out.look.clothes, out.look.shoes])];
    out.owned = (out.owned || ['spritzer']).filter((w) => WEAPONS[w]);
    if (!out.owned.length) out.owned = ['spritzer'];
    if (!WEAPONS[out.weapon]) out.weapon = 'spritzer';
    return out;
  } catch { return d; }
}

const QUALITY = {
  high: { pr: 1.5, scale: 1, shadow: 2048 },
  qa: { pr: 1, scale: 0.5, shadow: 512 },
  medium: { pr: 1.25, scale: 0.85, shadow: 2048 },
  low: { pr: 1, scale: 0.7, shadow: 1024 },
};

class App {
  constructor() {
    const host = document.getElementById('game');
    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = true;
    host.appendChild(renderer.domElement);
    this.canvas = renderer.domElement;
    this.post = new Post(renderer);
    this.input = new Input(this.canvas);
    this.audio = audio;
    this.profile = loadProfile();
    if (params.get('name')) { this.profile.name = params.get('name'); this.profile.created = true; }
    this.profile.name = String(this.profile.name || 'Rookie').replace(/[<>&"'`]/g, '').slice(0, 12) || 'Rookie';
    this.menus = new Menus(this);
    this.mode = null;
    this.quality = 'high';
    this.frameTimes = [];
    this.qT = 0;
    if (params.has('qa')) { this.profile.settings.quality = 'qa'; }
    this.applySettings();
    this.resize();
    // Esc while the mouse is captured only releases the lock (no keydown reaches us): treat as pause
    this.input.onLockChange = (locked, self) => { if (!locked && !self) this.mode?.onLockLost?.(); };
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !(e.target && e.target.tagName === 'INPUT')) {
        const m = audio.toggleMute?.();
        this.toast(m ? 'Sound muted (M)' : 'Sound on (M)');
      }
    });
    const unlockAudio = () => { audio.init?.(); };
    addEventListener('pointerdown', unlockAudio);
    addEventListener('keydown', unlockAudio);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  toast(html) {
    const t = document.getElementById('toast');
    t.innerHTML = html; t.classList.add('on');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), 1800);
  }

  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.profile)); } catch { /* storage unavailable */ } }

  xpFor(level) { return 700 + level * 350; }

  applySettings() {
    const s = this.profile.settings;
    this.input.sensitivity = s.sens;
    this.input.invertY = s.invertY;
    audio.setVolume?.({ music: s.music, sfx: s.sfx });
    const q = s.quality === 'auto' ? this.quality : s.quality;
    this.setQuality(q);
  }

  setQuality(q) {
    const Q = QUALITY[q] || QUALITY.high;
    this.qualityPreset = q;
    this.pixelRatio = Math.min(devicePixelRatio || 1, Q.pr);
    this.post.scale = Q.scale;
    this.shadowSize = Q.shadow;
    if (this.post.w) this.post.setSize(innerWidth, innerHeight, this.pixelRatio);
    const env = this.mode?.env;
    if (env) env.setShadowExtent(env.shadowExtent, Q.shadow);
  }

  resize() {
    this.post.setSize(innerWidth, innerHeight, this.pixelRatio);
    this.mode?.resize(innerWidth, innerHeight);
  }

  // automatic quality: step down if we can't hold ~50fps, up if there's headroom
  autoQuality(dt) {
    if (this.profile.settings.quality !== 'auto' || !this.mode || this.loadingNow) return;
    this.frameTimes.push(dt);
    this.qT += dt;
    if (this.qT < 3) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = []; this.qT = 0;
    const order = ['high', 'medium', 'low'];
    const i = order.indexOf(this.quality);
    if (avg > 1 / 45 && i < 2) { this.quality = order[i + 1]; this.setQuality(this.quality); }
    else if (avg < 1 / 75 && i > 0) { this.quality = order[i - 1]; this.setQuality(this.quality); }
  }

  async setMode(make, text) {
    if (this.loadingNow) return null;
    this.loadingNow = true;
    this.menus.loading(true, text);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (this.mode) { try { this.mode.dispose(); } catch (e) { console.error(e); } this.mode = null; }
    this.post.resetGrade();
    const m = make();
    await m.init();
    this.mode = m;
    m.resize(innerWidth, innerHeight);
    if (m.env) m.env.setShadowExtent(m.env.shadowExtent, this.shadowSize);
    this.menus.loading(false);
    this.loadingNow = false;
    this.last = performance.now();
    return m;
  }

  async goTitle() {
    const plaza = await this.setMode(() => new Plaza(this, { title: true }), 'Loading Prism Plaza…');
    if (!plaza) return;
    plaza.setTitleMode(true);
    this.menus.title({
      firstTime: !this.profile.created,
      onPlaza: () => this.enterPlazaFromTitle(),
      onQuick: () => this.startBattle({ weapon: this.profile.weapon, skill: this.profile.lastSkill, stage: STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] }),
      onOnline: () => { if (this.profile.created) { this.towerFloor = 1; this.goTower({ floor: 1 }); } else this.enterPlazaFromTitle(true); },
      onSettings: () => this.menus.settings(),
    });
  }

  enterPlazaFromTitle(online = false) {
    const pl = this.mode;
    if (!(pl instanceof Plaza)) { this.goPlaza(); return; }
    pl.setTitleMode(false);
    audio.music('plaza');
    if (online && this.profile.created) { this.newsSeen = true; pl.openUI('tower'); return; }
    if (!this.profile.created) {
      pl.openUI('locker', { create: true });
    } else if (!this.newsSeen) {
      pl.startNews();
    } else {
      this.input.lock();
      pl.toast(`Welcome back, <b>${this.profile.name}</b>!`);
    }
  }

  async goPlaza() {
    this.input.unlock();
    const from = this.mode instanceof Battle ? 'battle' : this.mode instanceof Story ? 'story' : this.mode instanceof Tower ? 'tower' : 'title';
    const pl = await this.setMode(() => new Plaza(this, { from }), from === 'story' ? 'Climbing back up to the plaza…' : 'Heading back to Prism Plaza…');
    if (!pl) return;
    pl.setTitleMode(false);
    if (!this.newsSeen && this.profile.created && !params.has('nonews')) pl.startNews();
    else pl.toast('Click to look around · <b>E</b> to interact');
  }

  // the Clash Tower interior (floors = match types)
  async goTower(opts = {}) {
    this.input.unlock();
    return this.setMode(() => new Tower(this, opts), 'Taking you up the Clash Tower…');
  }

  // after a match: back to the tower floor you queued from (or the plaza)
  afterBattle() {
    if (this.towerFloor != null) return this.goTower({ floor: this.towerFloor, from: 'battle' });
    return this.goPlaza();
  }

  // --- story mode (The Underside) ---
  async goStory(level = 'hub') {
    this.input.unlock();
    return this.setMode(() => new Story(this, { level }), 'Descending into the Underside…');
  }

  async startBattle(opts) {
    this.input.unlock();
    const o = { ...opts };
    if (params.get('time')) o.time = +params.get('time');
    await this.setMode(() => new Battle(this, o), 'Warping to the stage…');
  }

  // ---------------------------------------------------------------- online play
  me() { const p = this.profile; return { name: p.name, look: p.look, weapon: p.weapon, ink: p.ink }; }

  openTower(onClose) {
    this.menus.towerMenu({
      onCPU: () => this.menus.lobby({ onStart: (o) => this.startBattle(o), onClose }),
      onOnline: () => this.startQuickMatch(onClose),
      onPrivate: () => this.openPrivate(onClose),
      onClose,
    });
  }

  openPrivate(onClose) {
    this.menus.privateMenu({
      onCreate: async () => { const r = await createPrivateRoom(this.me()); this.enterRoom(r, onClose); },
      onJoin: async (code) => { const r = await joinPrivateRoom(code, this.me()); this.enterRoom(r, onClose); },
      onClose,
    });
  }

  async startQuickMatch(onClose) {
    const token = { cancelled: false };
    const ui = this.menus.searching({ onCancel: () => { token.cancelled = true; onClose?.(); } });
    try {
      const room = await quickMatch(this.me(), (t) => ui.status(t), token);
      if (!room) return;
      ui.close();
      this.enterRoom(room, onClose);
    } catch (e) { ui.error(e.message || 'Could not connect to online play.'); }
  }

  enterRoom(room, onClose) {
    this.leaveRoom();
    this.room = room;
    this.roomOnClose = onClose;
    room.on('start', (match) => this.startNetMatch(match));
    room.on('closed', (why) => this.onRoomClosed(why));
    room.on('join', (name) => { if (!(this.mode instanceof Battle)) this.toast(`<b>${name}</b> joined the room`); this.audio.sfx?.('ui_select'); });
    room.on('leave', (id, name) => { if (!(this.mode instanceof Battle) && name) this.toast(`<b>${name}</b> left`); });
    this.showRoom();
    if (room.isHost && room.kind === 'quick') {
      clearInterval(this.quickLoop);
      this.quickLoop = setInterval(() => {
        const r = this.room;
        if (!r || r !== room || r.closed) { clearInterval(this.quickLoop); return; }
        if (r.phase !== 'lobby') return;
        const humans = r.members.length;
        if (humans >= MAX_PLAYERS) { r.countdown = null; r.startMatch(); return; }
        if (humans >= 2) {
          r.countdown = r.countdown == null ? 30 : r.countdown - 1;
          if (r.countdown <= 0) { r.countdown = null; r.startMatch(); return; }
          r.syncLobby();
        } else if (r.countdown != null) { r.countdown = null; r.syncLobby(); }
      }, 1000);
    }
  }

  showRoom() {
    if (!this.room) return;
    this.menus.netRoom(this.room, {
      onLeave: () => { this.leaveRoom(); this.roomOnClose?.(); },
      onStart: () => { if (this.room?.isHost) { this.room.countdown = null; this.room.startMatch(); } },
    });
  }

  startNetMatch(match) {
    this.menus.closeNetRoom();
    this.menus.pause(false);
    this.input.unlock();
    this.setMode(() => new Battle(this, { net: { room: this.room, match } }), 'Joining the online match…');
  }

  async backToRoom() {
    const room = this.room;
    if (!room || room.closed) { this.room = null; this.afterBattle(); return; }
    if (room.isHost) room.endMatch();
    await this.afterBattle();
    const pl = this.mode;
    if ((pl instanceof Plaza || pl instanceof Tower) && this.room === room) {
      this.roomOnClose = pl.holdUI();
      this.showRoom();
    }
  }

  leaveRoom() {
    clearInterval(this.quickLoop);
    if (this.room) { this.room.close(); this.room = null; }
    this.menus.closeNetRoom();
  }

  onRoomClosed(why) {
    clearInterval(this.quickLoop);
    if (this.mode instanceof Battle) return; // the battle shows its own message
    this.menus.closeNetRoom();
    this.room = null;
    this.toast(why || 'The room closed.');
    this.roomOnClose?.();
  }

  grantRewards(s) {
    const p = this.profile;
    p.coins += s.coins; p.xp += s.xp;
    p.stats.matches++; if (s.won) p.stats.wins++;
    p.stats.turf += s.turf; p.stats.kills += s.kills;
    let levelUp = false;
    while (p.xp >= this.xpFor(p.level)) { p.xp -= this.xpFor(p.level); p.level++; levelUp = true; }
    this.save();
    return { level: p.level, pct: Math.round((p.xp / this.xpFor(p.level)) * 100), levelUp };
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) return;
    dt = Math.min(dt, params.has('fast') ? 1 / 10 : 1 / 20);
    this.input.poll();
    if (this.mode && !this.loadingNow) {
      try {
        const t0 = performance.now();
        this.mode.update(dt);
        const t1 = performance.now();
        this.mode.render(dt);
        const t2 = performance.now();
        this.perf = this.perf || { u: 0, r: 0, n: 0 };
        this.perf.u = this.perf.u * 0.95 + (t1 - t0) * 0.05;
        this.perf.r = this.perf.r * 0.95 + (t2 - t1) * 0.05;
        this.perf.n++;
      } catch (e) {
        console.error(e);
        if (!this._errShown) { this._errShown = true; this.toast('Something went wrong — check the console.'); }
      }
    }
    this.input.endFrame();
    this.autoQuality(dt);
  }
}

const app = new App();
window.__chroma = app;
if (params.has('quick')) {
  app.profile.created = true;
  app.startBattle({ weapon: params.get('weapon') || app.profile.weapon, skill: params.get('skill') || 'normal', stage: params.get('stage') || STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] });
} else if (params.has('plaza')) {
  app.profile.created = true;
  app.goPlaza();
} else if (params.has('tower')) {
  app.profile.created = true;
  app.goTower({ floor: +(params.get('tower') || 0) });
} else if (params.has('story')) { // --- story mode (The Underside) ---
  app.profile.created = true;
  app.goStory(params.get('story') || 'hub');
} else {
  app.goTitle();
}
