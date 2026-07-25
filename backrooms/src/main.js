// NOCLIP — app shell.
//
// A run is a descent: floor, lift, floor, lift, until something catches you. Each
// floor has one thing living on it that kills you on contact, somewhere to hide
// from it, chalk marks somebody left pointing at the service lift, and one trick
// that belongs to that floor alone. In the lift there is a stall, and the stall
// takes footage — which you earn by getting off the floor and, mostly, by keeping
// the thing in frame while you do it.
//
// This file owns the renderer, the one animation frame, the screens, the save
// file, the run, the shop, and the rules that are not geometry.

import * as THREE from 'three';
import { makeKit } from './kit.js';
import { CHAIN, loadLevelModule, levelSeed, makeRun } from './levels/index.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Camcorder } from './camcorder.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';
import { Fx } from './fx.js';
import { CATALOG, applyOwned, priceOf, soldOut, offersFor, footageFor } from './powerups.js';
import { logoCanvas } from './textures.js';
import { loadSettings, saveSettings } from './save.js';
import { clamp, clamp01, damp, fmtTime, rng } from './util.js';

const RECORD_KEY = 'noclip_records_v2';
const qs = new URLSearchParams(location.search);

function loadRecords() {
  try {
    return { bestFloor: 0, bestFootage: 0, runs: 0, escapes: 0, seen: [], ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') };
  } catch { return { bestFloor: 0, bestFootage: 0, runs: 0, escapes: 0, seen: [] }; }
}
function saveRecords(r) {
  try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch { /* private mode */ }
}

class Game {
  constructor() {
    this.settings = loadSettings();
    this.records = loadRecords();
    this.holder = document.getElementById('game-holder');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 16 / 9, 0.06, 400);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.holder.appendChild(this.renderer.domElement);

    this.audio = new Audio();
    this.hud = new Hud(document.getElementById('overlay'), this);
    this.cam = new Camcorder(this.renderer, this.scene, this.camera, document.getElementById('overlay'));
    this.fx = new Fx(this);
    this.entities = new Entities(this);
    this.player = new Player(null, {
      onFootstep: (mat, force) => {
        this.audio.footstep(mat, force);
        this.noiseBoost = Math.max(this.noiseBoost, force * 0.5);
      },
      onSplash: (v) => this.audio.oneShot('splash', clamp01(v)),
      onLand: () => this.audio.footstep('concrete', 1),
      onFall: (drop) => { if (drop > 6) this.caught(null, 'the floor was further away than it looked'); },
    });

    // ---- your own light, and the only tool you get
    this.ambient = new THREE.AmbientLight(0x30302a, 0.2);
    this.hemi = new THREE.HemisphereLight(0x404048, 0x101010, 0.15);
    // A torch, not a room light: a defined hot centre with a soft edge, so a dark
    // floor reads as a beam sweeping over surfaces rather than a general glow.
    this.lamp = new THREE.SpotLight(0xfff2d8, 0, 30, 0.62, 0.55, 1.05);
    this.lampTarget = new THREE.Object3D();
    // The camcorder's own lamp: a couple of metres of spill around the lens, so the
    // floor at your feet and the wall at your shoulder exist. Without it the beam
    // lights a distant smudge and everything within reach stays black.
    this.glow = new THREE.PointLight(0xffe8c8, 0, 9, 1.25);
    this.scene.add(this.ambient, this.hemi, this.lamp, this.lampTarget, this.glow);
    this.lamp.target = this.lampTarget;
    this.lampOn = true;

    // ---- run state
    this.state = 'boot';
    this.mods = applyOwned({});
    this.owned = {};
    this.footage = 0;
    this.floors = [];
    this.floorIndex = 0;
    this.levelTime = 0;
    this.tapeTime = 0;
    this.camBattery = 100;
    this.night = false;
    this.recording = true;
    this.noiseBoost = 0;
    this.filmSeconds = 0;
    this.wasChased = false;
    this.hidesUsed = 0;
    this.dead = false;
    this.paused = false;
    this.gimmickT = 0;
    this.blackoutT = 0;
    this.steamT = 0;
    this.input = { fwd: 0, back: 0, left: 0, right: 0, sprint: 0, crouch: 0, jump: 0 };
    this.keys = new Set();
    this.runRand = rng(1);

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.buildScreens();

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ screens
  buildScreens() {
    for (const id of ['title-logo', 'boot-logo']) {
      const el = document.getElementById(id);
      if (el) el.src = logoCanvas('NOCLIP').toDataURL();
    }
    document.getElementById('boot').addEventListener('click', () => this.leaveBoot());
    window.addEventListener('keydown', (e) => {
      if (this.state === 'boot' && (e.code === 'Space' || e.code === 'Enter')) this.leaveBoot();
    });

    document.getElementById('t-new').onclick = () => this.startRun();
    document.getElementById('t-archive').onclick = () => { this.renderArchive(); this.showScreen('archive'); };
    document.getElementById('t-how').onclick = () => this.showScreen('how');
    document.getElementById('t-options').onclick = () => { this.renderOptions(); this.showScreen('options'); };
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => this.showScreen('title');
    document.getElementById('p-resume').onclick = () => this.setPaused(false);
    document.getElementById('p-options').onclick = () => { this.renderOptions(true); this.showScreen('options'); };
    document.getElementById('p-quit').onclick = () => this.toTitle();
    document.getElementById('lift-go').onclick = () => this.descend();
    document.getElementById('end-back').onclick = () => this.toTitle();
  }

  showScreen(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === `scr-${name}`);
    document.getElementById('boot').hidden = name !== 'boot';
    this.screen = name;
    const playing = name === 'play';
    this.hud.setVisible(playing);
    document.getElementById('tape').style.display = playing || name === 'lift' ? '' : 'none';
  }

  leaveBoot() {
    if (this.state !== 'boot') return;
    this.state = 'title';
    this.audio.ensure();
    this.audio.resume();
    this.audio.startMusic('drone');
    this.audio.startTone({ room: 'static', hum: 0.2, drip: 0, wind: 0, reverb: 0.2 });
    this.showScreen('title');
    this.renderTitleRecord();
    if (qs.has('quick')) this.startRun(qs.get('level') || null);
  }

  renderTitleRecord() {
    const el = document.getElementById('title-record');
    if (!el) return;
    const r = this.records;
    el.textContent = r.runs
      ? `${r.runs} descent${r.runs === 1 ? '' : 's'} · deepest floor ${r.bestFloor} · best haul ${r.bestFootage} ft · ${r.escapes} got out`
      : 'no tapes recorded yet';
  }

  renderArchive() {
    const host = document.getElementById('archive-list');
    const seen = new Set(this.records.seen || []);
    host.innerHTML = CHAIN.filter((c) => c.tier > 0).map((c) => {
      const known = seen.has(c.id);
      return `<div class="arch-row ${known ? '' : 'unknown'}">
        <span class="arch-num">${known ? c.num : '??'}</span>
        <span class="arch-name">${known ? c.name : '— — — — —'}</span>
        <span class="arch-tier">${known ? ['', 'shallow', 'middling', 'deep', 'the bottom'][c.tier] : ''}</span>
      </div>`;
    }).join('') + `<p class="arch-note">${seen.size} of ${CHAIN.filter((c) => c.tier > 0).length} floors seen.
      A descent draws ten of them, shallow to deep, and never the same ten twice.</p>`;
  }

  renderOptions(fromPause = false) {
    const host = document.getElementById('opt-list');
    const s = this.settings;
    const rows = [
      ['sens', 'LOOK SENSITIVITY', 0.3, 2.5, 0.05],
      ['fov', 'FIELD OF VIEW', 60, 100, 1],
      ['sfx', 'SOUND', 0, 1, 0.05],
      ['music', 'MUSIC', 0, 1, 0.05],
      ['tape', 'TAPE DAMAGE', 0, 1.5, 0.05],
      ['quality', 'RENDER SCALE', 0.55, 1, 0.05],
    ];
    host.innerHTML = rows.map(([k, label, min, max, step]) => `
      <label class="opt-row"><span>${label}</span>
        <input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"/>
        <b data-v="${k}">${(+s[k]).toFixed(2)}</b></label>`).join('')
      + `<label class="opt-row"><span>SUBTITLES</span>
          <input type="checkbox" data-k="subtitles" ${s.subtitles ? 'checked' : ''}/></label>
         <label class="opt-row"><span>HEAD BOB</span>
          <input type="checkbox" data-k="headBob" ${s.headBob ? 'checked' : ''}/></label>
         <label class="opt-row"><span>INVERT LOOK</span>
          <input type="checkbox" data-k="invertY" ${s.invertY ? 'checked' : ''}/></label>`;
    host.oninput = (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      this.settings[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
      const out = host.querySelector(`[data-v="${k}"]`);
      if (out) out.textContent = (+this.settings[k]).toFixed(2);
      this.applySettings();
      saveSettings(this.settings);
    };
    document.getElementById('opt-back').onclick = () => this.showScreen(fromPause ? 'pause' : 'title');
  }

  applySettings() {
    this.camera.fov = (this.mods?.fov ?? this.settings.fov);
    this.camera.updateProjectionMatrix();
    this.audio.volSfx = this.settings.sfx;
    this.audio.setMusicVolume(this.settings.music);
    this.cam.scale = this.settings.quality;
    this.resize();
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    const map = {
      KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', KeyC: 'crouch', Space: 'jump',
    };
    window.addEventListener('keydown', (e) => {
      if (map[e.code]) { this.input[map[e.code]] = 1; e.preventDefault(); }
      if (this.keys.has(e.code)) return;
      this.keys.add(e.code);
      if (this.state !== 'play') return;
      switch (e.code) {
        case 'KeyE': this.interact(); break;
        case 'KeyF': this.toggleLamp(); break;
        case 'KeyN': this.toggleNight(); break;
        case 'KeyR': this.toggleRecording(); break;
        case 'Escape': this.setPaused(!this.paused); break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (map[e.code]) this.input[map[e.code]] = 0;
      this.keys.delete(e.code);
    });
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.state === 'play' && !this.paused) canvas.requestPointerLock?.();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.paused) return;
      const scale = this.player.hidden ? 0.45 : 1;       // in cover you can only peer
      this.player.turn(e.movementX * scale, (this.settings.invertY ? -1 : 1) * e.movementY * scale, this.settings.sens);
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.state === 'play' && document.pointerLockElement !== canvas && !this.dead) this.setPaused(true);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'play' || this.paused) return;
      if (e.button === 2) this.toggleLamp();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pollPad() {
    const pads = navigator.getGamepads?.() || [];
    const p = [...pads].find(Boolean);
    if (!p) return;
    const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = dead(p.axes[0] || 0), ly = dead(p.axes[1] || 0);
    if (ly < -0.2) this.input.fwd = 1;
    if (ly > 0.2) this.input.back = 1;
    if (lx < -0.2) this.input.left = 1;
    if (lx > 0.2) this.input.right = 1;
    const rx = dead(p.axes[2] || 0), ry = dead(p.axes[3] || 0);
    if (rx || ry) this.player.turn(rx * 12, (this.settings.invertY ? -1 : 1) * ry * 12, this.settings.sens);
    const btn = (i) => !!p.buttons[i]?.pressed;
    if (btn(10) || (p.buttons[7]?.value > 0.4)) this.input.sprint = 1;
    if (btn(11)) this.input.crouch = 1;
    if (btn(0)) this.input.jump = 1;
    if (btn(2) && !this.padE) this.interact();
    this.padE = btn(2);
    if (btn(3) && !this.padF) this.toggleLamp();
    this.padF = btn(3);
  }

  // ------------------------------------------------------------------ the run
  async startRun(forceLevel = null) {
    this.runSeed = Math.floor(Math.random() * 1e9);
    this.runRand = rng(this.runSeed);
    this.owned = {};
    this.mods = applyOwned(this.owned);
    this.footage = 0;
    this.tapeTime = 0;
    this.floors = forceLevel ? [forceLevel, 'level_end'] : makeRun(this.runRand);
    this.floorIndex = 0;
    this.records.runs = (this.records.runs || 0) + 1;
    saveRecords(this.records);
    this.applySettings();
    await this.enterFloor(0);
  }

  async enterFloor(index) {
    this.floorIndex = index;
    const id = this.floors[index];
    this.state = 'loading';
    this.showScreen('load');
    const bar = document.getElementById('load-bar');
    const label = document.getElementById('load-label');
    const step = async (pct, text) => {
      bar.style.width = `${pct}%`;
      label.textContent = text;
      await new Promise((r) => setTimeout(r, 16));
    };
    await step(8, 'THREADING THE TAPE');

    let mod;
    try { mod = await loadLevelModule(id); } catch (e) {
      label.textContent = `TAPE DAMAGED — ${id} (${e.message})`;
      return;
    }
    await step(24, `FLOOR ${index + 1} — LEVEL ${mod.meta.num}`);
    const data = mod.build(makeKit(levelSeed(id, this.runSeed + index)));
    await step(52, 'POURING CONCRETE');

    if (this.world) this.world.dispose();
    this.entities.clear();
    this.fx.reset();
    this.clearFloorObjects();
    this.world = new World(data, this.scene, {
      quality: this.settings.quality,
      arrows: this.mods.arrows,
    });
    this.player.world = this.world;
    this.player.mods = this.mods;
    await step(78, 'CHALKING THE WAY OUT');

    this.scene.fog = new THREE.FogExp2(data.fog.color, data.fog.density);
    this.scene.background = new THREE.Color(data.fog.color);
    this.baseFog = data.fog.density;
    this.ambient.color.setHex(data.ambient.color);
    this.ambient.intensity = data.ambient.intensity;
    this.hemi.visible = !!data.openSky;
    if (data.openSky) {
      this.hemi.color.setHex(data.ambient.sky ?? data.ambient.color);
      this.hemi.intensity = data.ambient.intensity * 1.4;
    }
    this.levelTint = data.tint || { r: 1, g: 1, b: 1 };
    this.rules = data.rules;
    this.gimmick = data.gimmick;
    this.gimmickOpts = data.gimmickOpts || {};

    this.entities.load(data);
    this.spawnExits(data.exits);
    this.triggers = data.triggers.map((t) => ({ ...t, fired: false }));
    this.scares = data.scares.slice();
    this.links = data.links.slice();
    this.meta = mod.meta;
    this.levelId = id;
    this.levelTime = 0;
    this.filmSeconds = 0;
    this.wasChased = false;
    this.hidesUsed = 0;
    this.camBattery = 100;
    this.night = false;
    this.dead = false;
    this.player.leaveHide();
    this.hud.hideDeath();
    this.hud.setObjectives([
      { id: 'lift', text: 'Find the service lift. Follow the chalk.', done: false },
      { id: 'gim', text: GIMMICK_HINT[data.gimmick] || '', done: false, optional: true },
      { id: 'film', text: 'Film it from a distance — footage buys upgrades in the lift.', done: false, optional: true },
    ]);
    if (!this.records.seen.includes(id)) {
      this.records.seen.push(id);
      saveRecords(this.records);
    }

    this.player.spawn(data.spawn.x * data.cell, data.spawn.z * data.cell, data.spawn.yaw);
    this.faceOpenGround();
    this.audio.startTone(data.ambience);
    this.audio.startMusic(data.gimmick === 'silence' ? 'none' : data.ambience.music);
    this.audio.oneShot('tapeStart', 0.6);
    await step(100, 'GO');

    this.state = 'play';
    this.paused = false;
    this.showScreen('play');
    this.hud.levelCard(mod.meta, index + 1, this.floors.length);
    if (this.mods.compass) this.hud.toast('FLOOR PLAN — the lift marker is on the tape edge');
    this.renderer.domElement.requestPointerLock?.();
  }

  // Spawning nose-first into a cupboard is a bad first frame. Step to the most
  // open cell nearby, then look down whichever direction has the most room in it
  // — ideally the one the chalk goes.
  faceOpenGround() {
    const w = this.world;
    const p = this.player;
    // ---- find somewhere with a view
    const runFrom = (x, z) => {
      let total = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let d = 1; d <= 14; d++) {
          if (w.solidAtWorld(x + dx * d * w.cell, z + dz * d * w.cell, p.pos.y)) break;
          total++;
        }
      }
      return total;
    };
    let bx = p.pos.x, bz = p.pos.z, bestOpen = runFrom(p.pos.x, p.pos.z);
    if (bestOpen < 10) {
      const [c0x, c0z] = w.toCell(p.pos.x, p.pos.z);
      for (let r = 1; r <= 8 && bestOpen < 16; r++) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const cx = c0x + Math.round(Math.cos(a) * r), cz = c0z + Math.round(Math.sin(a) * r);
          if (!w.isOpenCell(cx, cz)) continue;
          const x = cx * w.cell, z = cz * w.cell;
          const open = runFrom(x, z);
          if (open > bestOpen) { bestOpen = open; bx = x; bz = z; }
        }
      }
      if (bx !== p.pos.x || bz !== p.pos.z) p.spawn(bx, bz, p.yaw);
    }
    let best = -1, bestYaw = p.yaw;
    for (let i = 0; i < 16; i++) {
      const yaw = (i / 16) * Math.PI * 2;
      let d = 0;
      for (; d < 26; d += 1.5) {
        const x = p.pos.x - Math.sin(yaw) * d;
        const z = p.pos.z - Math.cos(yaw) * d;
        if (w.solidAtWorld(x, z, p.pos.y)) break;
      }
      // prefer the direction that also heads toward the lift
      const b = w.liftBearing(p.pos.x, p.pos.z);
      const bonus = b ? Math.max(0, Math.cos(yaw - b.angle)) * 6 : 0;
      if (d + bonus > best) { best = d + bonus; bestYaw = yaw; }
    }
    p.yaw = bestYaw;
  }

  clearFloorObjects() {
    for (const o of this.exitObjs || []) {
      this.scene.remove(o.mesh);
      o.mesh.traverse?.((m) => m.geometry?.dispose?.());
    }
    this.exitObjs = [];
  }

  spawnExits(exits) {
    const S = this.world.cell;
    this.exitObjs = [];
    for (const e of exits) {
      if (e.kind !== 'elevator') continue;      // one way off a floor now
      const g = new THREE.Group();
      const doors = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.4),
        new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
      );
      doors.position.y = 1.2;
      g.add(doors);
      const light = new THREE.PointLight(0xffe0a0, 1.6, 14, 2);
      light.position.y = 1.8;
      g.add(light);
      g.position.set(e.x * S, this.world.floorAtWorld(e.x * S, e.z * S), e.z * S);
      this.scene.add(g);
      this.exitObjs.push({ mesh: g, rec: e, glow: doors });
    }
  }

  // ------------------------------------------------------------------ verbs
  interact() {
    if (this.player.hidden) { this.player.leaveHide(); this.audio.oneShot('clawStep', 0.3); return; }
    const p = this.player.pos;
    const lift = (this.exitObjs || []).find((o) => Math.hypot(o.mesh.position.x - p.x, o.mesh.position.z - p.z) < 3.0);
    if (lift) { this.reachLift(lift.rec); return; }
    const hide = this.world?.nearestHide(p.x, p.z, 2.3);
    if (hide) {
      this.player.enterHide(hide);
      this.hidesUsed++;
      this.audio.oneShot('clawStep', 0.35);
      this.hud.subtitle(HIDE_LINE[hide.kind] || 'You get out of sight and stay very still.', 3);
    }
  }

  toggleLamp() {
    this.lampOn = !this.lampOn;
    this.audio.oneShot('facelingClick', 0.3);
  }

  toggleNight() {
    if (this.camBattery <= 0) return;
    this.night = !this.night;
    this.audio.oneShot('glassTick', 0.4);
  }

  toggleRecording() {
    this.recording = !this.recording;
    this.audio.oneShot(this.recording ? 'tapeStart' : 'tapeStop', 0.5);
    if (!this.recording) this.hud.toast('PAUSED — no tape, no footage');
  }

  // ------------------------------------------------------------------ the lift
  reachLift() {
    if (this.state !== 'play') return;
    this.state = 'lift';
    document.exitPointerLock?.();
    this.audio.oneShot('exitOpen', 0.9);
    this.audio.stopMusic();
    this.audio.startTone({ room: 'drone', hum: 0.3, drip: 0, wind: 0, music: 'calm', reverb: 0.3 });
    this.audio.startMusic('calm');

    const pay = footageFor({
      floorIndex: this.floorIndex,
      filmSeconds: this.filmSeconds,
      neverChased: !this.wasChased,
      seconds: this.levelTime,
      hides: this.hidesUsed,
    });
    this.footage += pay.total;
    this.records.bestFloor = Math.max(this.records.bestFloor || 0, this.floorIndex + 1);
    this.records.bestFootage = Math.max(this.records.bestFootage || 0, this.footage);
    saveRecords(this.records);
    this.renderLift(pay);
    this.showScreen('lift');
  }

  renderLift(pay) {
    const last = this.floorIndex + 1 >= this.floors.length;
    document.getElementById('lift-floor').textContent = last
      ? 'THE LIFT GOES UP FROM HERE'
      : `DESCENDING — FLOOR ${this.floorIndex + 2} OF ${this.floors.length}`;
    // buying redraws the stall, and the docket for the floor you just survived stays
    // up while you do it — only the running total moves
    if (pay) this.lastPay = pay; else pay = this.lastPay;
    document.getElementById('lift-pay').innerHTML = pay ? `
      <div><span>off the floor alive</span><b>+${pay.base}</b></div>
      <div><span>footage of it (${Math.floor(this.filmSeconds)}s)</span><b>+${pay.film}</b></div>
      <div><span>never chased</span><b>+${pay.clean}</b></div>
      <div><span>brisk about it</span><b>+${pay.brisk}</b></div>
      <div><span>used the cover</span><b>+${pay.cover}</b></div>
      <div class="tot"><span>FOOTAGE</span><b>${this.footage}</b></div>` : '';

    const offers = offersFor(this.floorIndex, this.owned, this.runRand);
    const host = document.getElementById('lift-stall');
    host.innerHTML = '';
    for (const key of offers) {
      const def = CATALOG[key];
      const price = priceOf(key, this.owned);
      const have = this.owned[key] || 0;
      const canBuy = this.footage >= price && !soldOut(key, this.owned);
      const b = document.createElement('button');
      b.className = `stall-item${canBuy ? '' : ' broke'}`;
      b.innerHTML = `<span class="si-name">${def.name}${have ? ` <i>×${have}</i>` : ''}</span>
        <span class="si-blurb">${def.blurb}</span>
        <span class="si-stall">${def.stall}</span>
        <span class="si-price">${soldOut(key, this.owned) ? 'SOLD OUT' : `${price} ft`}</span>`;
      b.onclick = () => {
        if (!canBuy) return;
        this.footage -= price;
        this.owned[key] = have + 1;
        this.mods = applyOwned(this.owned);
        this.player.mods = this.mods;
        this.applySettings();
        this.audio.oneShot('objectiveDone', 0.6);
        this.renderLift(null);
      };
      host.appendChild(b);
    }
    document.getElementById('lift-owned').innerHTML = Object.entries(this.owned).length
      ? Object.entries(this.owned).map(([k, n]) => `<span>${CATALOG[k].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('')
      : '<span class="none">nothing yet</span>';
    document.getElementById('lift-go').textContent = last ? 'RIDE IT UP  ▲' : 'GO DOWN  ▼';
  }

  async descend() {
    if (this.floorIndex + 1 >= this.floors.length) return this.finish();
    await this.enterFloor(this.floorIndex + 1);
  }

  finish() {
    this.state = 'end';
    this.records.escapes = (this.records.escapes || 0) + 1;
    saveRecords(this.records);
    document.getElementById('end-stats').innerHTML = `
      <div>FLOORS <b>${this.floors.length}</b></div>
      <div>TAPE <b>${fmtTime(this.tapeTime)}</b></div>
      <div>FOOTAGE LEFT <b>${this.footage}</b></div>
      <div>KIT <b>${Object.keys(this.owned).length || 'none'}</b></div>`;
    this.showScreen('end');
    this.audio.startMusic('calm');
  }

  // ------------------------------------------------------------------ caught
  onChaseStart(m) {
    this.wasChased = true;
    this.audio.stinger(0.8);
    this.hud.chaseOn(m.sp.name);
    this.fx.glitchAmt = Math.max(this.fx.glitchAmt, 0.5);
  }

  onChaseEnd() { this.hud.chaseOff(); }

  onCaught(monster, reason) {
    if (this.dead || this.state !== 'play') return;
    // GAFFER TAPE: the tape jumps and you are somewhere else on the floor
    if ((this.mods.lives || 0) > (this.livesUsed || 0)) {
      this.livesUsed = (this.livesUsed || 0) + 1;
      this.fx.glitchAmt = 1;
      this.audio.oneShot('tapeChew', 1);
      const spot = this.entities.monster
        ? this.farFromMonster()
        : { x: this.player.pos.x, z: this.player.pos.z };
      this.player.leaveHide();
      this.player.spawn(spot.x, spot.z, this.player.yaw + Math.PI);
      if (monster) { monster.grabbed = false; monster.state = 'search'; monster.alert = 0.4; }
      this.hud.toast('GAFFER TAPE — the tape jumps a few seconds');
      return;
    }
    this.dead = true;
    document.exitPointerLock?.();
    this.fx.jumpscare(monster);
    this.audio.oneShot('die', 1);
    this.audio.stopMusic();
    const name = monster?.sp?.name || 'IT';
    this.hud.death(reason ? `${name} — ${reason}.` : `${name} reached you.`, {
      floor: this.floorIndex + 1, floors: this.floors.length,
      footage: this.footage, tape: this.tapeTime, kit: Object.keys(this.owned).length,
    });
  }

  farFromMonster() {
    const w = this.world;
    const m = this.entities.monster;
    for (let i = 0; i < 200; i++) {
      const cx = 1 + Math.floor(Math.random() * (w.w - 2));
      const cz = 1 + Math.floor(Math.random() * (w.h - 2));
      if (!w.isOpenCell(cx, cz)) continue;
      const x = cx * w.cell, z = cz * w.cell;
      if (!m || Math.hypot(m.pos.x - x, m.pos.z - z) > 40) return { x, z };
    }
    return { x: this.player.pos.x, z: this.player.pos.z };
  }

  retry() {
    this.hud.hideDeath();
    this.toTitle();
  }

  setPaused(p) {
    if (this.state !== 'play') return;
    this.paused = p;
    if (p) {
      document.exitPointerLock?.();
      this.showScreen('pause');
      this.audio.suspend();
    } else {
      this.showScreen('play');
      this.audio.resume();
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  toTitle() {
    this.paused = false;
    this.dead = false;
    this.state = 'title';
    this.hud.hideDeath();
    this.hud.chaseOff();
    if (this.world) { this.world.dispose(); this.world = null; }
    this.entities.clear();
    this.fx.reset();
    this.clearFloorObjects();
    this.audio.stopTone();
    this.audio.startMusic('drone');
    this.audio.startTone({ room: 'static', hum: 0.2, drip: 0, wind: 0, reverb: 0.2 });
    this.renderTitleRecord();
    this.showScreen('title');
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cam?.resize(w, h);
  }

  // ------------------------------------------------------------------ frame
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
    this.last = now;
    this.lastDt = dt;

    if (this.state === 'play' && !this.paused && !this.dead) this.tick(dt);
    else if (this.state === 'play') this.fx.update(dt * 0.2);
    this.hud.update(dt);

    const light = this.world ? this.world.lightAt(this.player.pos.x, this.player.pos.z) + (this.lampOn ? 0.35 : 0) : 0.4;
    this.cam.render(dt, {
      glitch: clamp01(this.fx.glitchAmt * this.settings.tape),
      grain: clamp01(this.fx.grainAmt),
      light: this.state === 'play' ? light : 0.5,
      night: this.night && this.camBattery > 0,
      damage: this.fx.hitFlash || 0,
      sanity: 1 - clamp01((this.entities.monster?.state === 'hunt' ? 0.45 : 0) + (this.player.hidden ? 0.15 : 0)),
      underwater: !!this.player.submerged,
      tint: this.levelTint || { r: 1, g: 1, b: 1 },
      tapeTime: this.tapeTime,
      battery: this.camBattery,
      recording: this.recording && this.camBattery > 0,
      floorTag: this.meta ? `FLOOR ${this.floorIndex + 1}/${this.floors.length} · LEVEL ${this.meta.num}` : '',
    });
  }

  tick(dt) {
    const p = this.player;
    const w = this.world;
    if (!w) return;
    this.levelTime += dt;
    if (this.recording && this.camBattery > 0) this.tapeTime += dt;
    this.noiseBoost = Math.max(0, this.noiseBoost - dt * 1.5);

    // ---- move (or sit very still in cover)
    if (p.hidden) {
      const m = this.entities.monster;
      p.hideThreat = m ? clamp01(1 - m.dist / 14) * (m.state === 'hunt' || m.state === 'search' ? 1 : 0.3) : 0;
      p.updateHide(dt, this.mods);
      if (p.hideBreath <= 0) { p.leaveHide(); this.hud.toast('you had to breathe'); }
    } else {
      p.update(dt, this.input, this.rules || {});
    }
    w.update(dt, p.pos);
    this.entities.update(dt);
    this.fx.update(dt);
    this.runGimmick(dt);

    // ---- camera
    const eye = p.eye();
    const shake = this.fx.shakeAmt;
    const hideDrop = p.hidden ? 0.42 : 0;
    this.camera.position.set(
      eye.x + (Math.random() - 0.5) * shake * 0.08,
      eye.y - hideDrop + (this.settings.headBob ? 0 : -p.bob) + (Math.random() - 0.5) * shake * 0.08,
      eye.z + (Math.random() - 0.5) * shake * 0.08,
    );
    if (this.fx.whipAmt > 0.2) p.yaw += this.fx.whipAmt * dt * 9;
    this.camera.rotation.set(p.pitch, p.yaw, p.sway * (this.settings.headBob ? 1 : 0) + shake * 0.03, 'YXZ');

    // ---- torch
    const look = p.look();
    this.lamp.position.copy(this.camera.position);
    this.lampTarget.position.set(eye.x + look.x * 8, eye.y + look.y * 8, eye.z + look.z * 8);
    const want = this.lampOn && !p.hidden ? 2.6 * (this.mods.lampPower || 1) : 0;
    this.lamp.intensity = damp(this.lamp.intensity, want, 12, dt);
    this.lamp.distance = 30 * (this.mods.lampRange || 1);
    // NIGHTSHOT is an emitter, not a filter: it throws its own flat, rangy light and
    // charges you the battery for it. Without that it just tints black pixels black.
    this.glow.position.copy(this.camera.position);
    const night = this.night && this.camBattery > 0;
    const spill = night ? 7.5 : this.lampOn && !p.hidden ? 2.2 * (this.mods.lampPower || 1) : 0.12;
    this.glow.distance = night ? 22 : 9;
    this.glow.intensity = damp(this.glow.intensity, p.hidden ? 0.12 : spill, 12, dt);

    // ---- the tape's battery: nightshot is what actually costs you
    if (this.recording) {
      const drain = 0.11 * (this.rules?.batteryDrain ?? 1) * (this.mods.batteryDrain || 1) * (this.night ? 3 : 1);
      this.camBattery = Math.max(0, this.camBattery - dt * drain);
    }
    if (this.camBattery <= 0 && this.night) { this.night = false; this.hud.toast('BATTERY — nightshot off'); }

    // ---- filming it pays for the lift
    const m = this.entities.monster;
    const filming = !!m && this.recording && this.camBattery > 0 && m.filmable();
    if (filming) this.filmSeconds += dt;
    this.hud.setFilming(filming, this.filmSeconds);

    // ---- the lift, and the chalk
    for (const o of this.exitObjs) {
      o.glow.lookAt(this.camera.position.x, o.glow.position.y, this.camera.position.z);
      o.glow.material.opacity = 0.2 + Math.sin(this.levelTime * 2.2) * 0.05;
      const d = Math.hypot(o.mesh.position.x - p.pos.x, o.mesh.position.z - p.pos.z);
      if (d < 22) this.audio.hum(clamp01(1 - d / 22));
    }

    // ---- prompts
    const nearLift = (this.exitObjs || []).some((o) => Math.hypot(o.mesh.position.x - p.pos.x, o.mesh.position.z - p.pos.z) < 3.0);
    const hide = w.nearestHide(p.pos.x, p.pos.z, 2.3);
    if (p.hidden) this.hud.prompt('<b>[E]</b> come out');
    else if (nearLift) this.hud.prompt('<b>[E]</b> take the lift');
    else if (hide) this.hud.prompt(`<b>[E]</b> hide — ${HIDE_NAME[hide.kind] || hide.kind}`);
    else this.hud.prompt(null);

    // ---- triggers and the floor's own scares (kept sparse; the monster is the scare)
    for (const t of this.triggers) {
      if (t.fired) continue;
      if (Math.hypot(t.x * w.cell - p.pos.x, t.z * w.cell - p.pos.z) > t.radius * w.cell) continue;
      t.fired = t.once;
      if (t.say) this.hud.subtitle(t.say, 5);
      if (t.lightsOff) w.douse(p.pos.x, p.pos.z, t.lightsOff, 6);
    }
    for (const s of this.scares) {
      if (Math.hypot(s.x * w.cell - p.pos.x, s.z * w.cell - p.pos.z) > s.radius * w.cell) continue;
      if (s.needsDark && w.lightAt(p.pos.x, p.pos.z) > 0.3) continue;
      this.fx.trigger(s);
    }

    // ---- drowning still kills you
    if (p.breath <= 0) this.onCaught(null, 'the water was over your head for too long');

    // ---- audio + hud
    this.audio.setListener(p.pos.x, p.pos.z, p.yaw);
    const threat = this.entities.threat();
    const closeness = threat.creature && threat.dist < 30
      ? clamp01(1 - threat.dist / 30) * (threat.hunting ? 1 : 0.45) : 0;
    this.audio.updateHeart(dt, closeness);
    this.audio.dread = closeness;
    this.hud.setVitals({
      stamina: p.stamina,
      breath: p.hidden ? p.hideBreath : p.breath,
      hidden: p.hidden,
      footage: this.footage,
      bearing: this.mods.tracker ? this.entities.bearing() : null,
      trackerLevel: this.mods.tracker,
      compass: this.mods.compass ? w.liftBearing(p.pos.x, p.pos.z) : null,
      playerYaw: p.yaw,
    });
  }

  // ------------------------------------------------------------------ gimmicks
  // The one thing that belongs to this floor and no other.
  runGimmick(dt) {
    const w = this.world;
    const p = this.player;
    const m = this.entities.monster;
    this.gimmickT += dt;
    switch (this.gimmick) {
      case 'flicker':
        // the grid stutters, and every so often a whole wing drops out
        if (this.gimmickT > 9) {
          this.gimmickT = 0;
          w.douse(p.pos.x + (Math.random() - 0.5) * 60, p.pos.z + (Math.random() - 0.5) * 60, 16, 3.5);
          this.audio.oneShot('breakerThunk', 0.35);
        }
        break;
      case 'blackout':
        // total dark on a rhythm you can learn — and it hunts better in it
        this.blackoutT -= dt;
        if (this.blackoutT <= 0) {
          this.blackoutT = 26 + Math.random() * 10;
          w.douse(p.pos.x, p.pos.z, 999, 7);
          this.audio.oneShot('breakerThunk', 0.9);
          this.hud.subtitle('Every light on the floor goes out at once.', 4);
          if (m) m.alert = Math.min(1, m.alert + 0.3);
        }
        break;
      case 'darkwater':
        // the water is opaque, and being in it is being blind
        if (w.waterDepthAt(p.pos.x, p.pos.z) > 0.2) {
          this.fx.grainAmt = Math.max(this.fx.grainAmt, 0.35);
          if (p.submerged) p.breath = Math.max(0, p.breath - dt * 8);
        }
        break;
      case 'steam':
        this.steamT -= dt;
        if (this.steamT <= 0) {
          this.steamT = 14 + Math.random() * 10;
          this.fx.grainAmt = 1;
          this.fx.glitchAmt = Math.max(this.fx.glitchAmt, 0.35);
          this.audio.oneShot('bacteriaHiss', 0.7);
          this.hud.subtitle('A vent lets go beside you and the frame fills with steam.', 3);
        }
        break;
      case 'sparks':
        if (m && m.dist < 22 && this.gimmickT > 4) {
          this.gimmickT = 0;
          const dead = w.killNearestLight(p.pos.x, p.pos.z);
          if (dead) { this.audio.oneShot('glassPop', 0.6); this.fx.spark(p.pos.x, p.pos.z); }
        }
        break;
      case 'ceiling':
        if (m && m.dist < 26 && this.gimmickT > 6) {
          this.gimmickT = 0;
          this.audio.oneShot('crawlerScrape', 0.5, { x: p.pos.x, z: p.pos.z });
        }
        break;
      case 'noisefloor':
        if (!w.rules.noisefloor) w.rules.noisefloor = true;
        break;
      case 'crowd':
        if (this.gimmickT > 12) {
          this.gimmickT = 0;
          this.audio.oneShot('crowdLaugh', 0.4);
        }
        break;
      case 'fogbank': {
        // thick, except near the lift, which is the only navigation you get
        const b = w.liftBearing(p.pos.x, p.pos.z);
        const near = b ? clamp01(1 - b.dist / 90) : 0;
        if (this.scene.fog) this.scene.fog.density = this.baseFog * (1.5 - near * 0.8);
        break;
      }
      case 'mirrors':
        if (m && m.dist < 30 && this.gimmickT > 10) {
          this.gimmickT = 0;
          const g = w.nearestGlass(p.pos.x, p.pos.z, 12);
          if (g) {
            this.fx.apparition(m.rec.type, g.x, g.z, { life: 0.8, faceCamera: true });
            this.audio.oneShot('glassKnock', 0.5, g);
          }
        }
        break;
      case 'cold':
        if (w.lightAt(p.pos.x, p.pos.z) < 0.35) {
          this.cold = (this.cold || 0) + dt;
          if (this.cold > 55) this.onCaught(null, 'the cold got there first');
          if (this.cold > 30) this.fx.grainAmt = Math.max(this.fx.grainAmt, 0.3);
        } else this.cold = Math.max(0, (this.cold || 0) - dt * 3);
        break;
      default:
        break;
    }
  }
}

const GIMMICK_HINT = {
  flicker: 'The grid stutters here. Wings drop out without warning.',
  blackout: 'The whole floor goes dark on a rhythm. Learn it.',
  darkwater: 'The water is opaque. Whatever is in it does not need to see.',
  steam: 'The vents let go at intervals and blind the camera.',
  sparks: 'It arcs the lights out as it gets close.',
  ceiling: 'It travels above the tiles. Listen up, not along.',
  noisefloor: 'Everything here is metal. Every step carries.',
  silence: 'No room tone at all. It hears you before you hear it.',
  crowd: 'There are bodies standing about, and it stands among them.',
  fogbank: 'Fog thick enough to hide the walls. It thins near the lift.',
  mirrors: 'It shows up in the glass a beat before it shows up in the room.',
  cold: 'You freeze away from the light. Keep finding warmth.',
};

const HIDE_NAME = {
  locker: 'get in the locker', cubicle: 'under the desk', gurney: 'under the trolley',
  shelf: 'between the stacks', crate: 'behind the pallets', stall: 'in the stall',
  car: 'in the back seat', water: 'go under', drift: 'into the drift',
  wheat: 'flat in the crop', vent: 'into the floor duct', tent: 'inside the tent',
  curtain: 'behind the curtain', crawl: 'under the pipes',
};

const HIDE_LINE = {
  locker: 'You pull the door to and breathe through the vents.',
  cubicle: 'Knees up, head down, back against the pedestal.',
  gurney: 'Under the trolley, sheet hanging past your face.',
  shelf: 'Sideways between two stacks, cheek against the boards.',
  crate: 'Down behind the pallets with your hands over your mouth.',
  stall: 'Feet up on the pan, latch across, absolutely still.',
  car: 'Into the back seat and down into the footwell.',
  water: 'You go under and hold it and the surface closes over you.',
  drift: 'You dig into the drift and pull the snow over your legs.',
  wheat: 'Flat in the crop with the stalks closing above you.',
  vent: 'Into the floor duct, lid pulled over your head.',
  tent: 'Inside somebody else\'s tent. It still smells of them.',
  curtain: 'Behind the drape, breathing as shallow as you can manage.',
  crawl: 'On your side under the pipe run, face to the wall.',
};

window.NOCLIP = new Game();
