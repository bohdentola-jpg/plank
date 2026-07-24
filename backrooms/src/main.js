// NOCLIP — app shell. Owns the renderer, the one animation frame, the screens,
// the save file, and the rules that aren't geometry: battery, nerve, damage,
// pickups, the exits, and what happens when a level finally lets you leave.

import * as THREE from 'three';
import { makeKit } from './kit.js';
import { CHAIN, chainIndex, loadLevelModule, levelSeed } from './levels/index.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Camcorder } from './camcorder.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';
import { Fx } from './fx.js';
import { ITEM_DEFS } from './items.js';
import { simple, logoCanvas } from './textures.js';
import { blankSave, listSaves, loadSave, writeSave, deleteSave, loadSettings, saveSettings } from './save.js';
import { clamp, clamp01, damp, fmtTime } from './util.js';

const qs = new URLSearchParams(location.search);

class Game {
  constructor() {
    this.settings = loadSettings();
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
      onFall: (drop) => {
        this.hurtPlayer(Math.min(70, (drop - 3) * 14), 'fall');
        this.audio.footstep('concrete', 1);
      },
    });

    // ---- lights that belong to you, not the level
    this.ambient = new THREE.AmbientLight(0x30302a, 0.2);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x404048, 0x101010, 0.15);
    this.scene.add(this.hemi);
    this.lamp = new THREE.SpotLight(0xfff2d8, 0, 26, 0.62, 0.55, 1.3);
    this.lamp.position.set(0, 0, 0);
    this.lampTarget = new THREE.Object3D();
    this.scene.add(this.lamp, this.lampTarget);
    this.lamp.target = this.lampTarget;
    this.lampOn = false;

    // ---- run state
    this.state = 'boot';
    this.save = blankSave(1);
    this.levelTime = 0;
    this.tapeTime = 0;
    this.hp = 100;
    this.sanity = 100;
    this.camBattery = 100;
    this.lampBattery = 100;
    this.inventory = {};
    this.selected = null;
    this.damageFlash = 0;
    this.night = false;
    this.zoom = 1;
    this.recording = true;
    this.noiseBoost = 0;
    this.wokenTags = new Set();
    this.pickables = [];
    this.noteObjs = [];
    this.exitObjs = [];
    this.thrown = [];
    this.exitMarker = null;
    this.deadCause = '';
    this.levelsSeen = new Set();
    this.paused = false;
    this.input = { fwd: 0, back: 0, left: 0, right: 0, sprint: 0, crouch: 0, jump: 0 };
    this.keys = new Set();

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
    const logo = document.getElementById('title-logo');
    if (logo) logo.src = logoCanvas('NOCLIP').toDataURL();
    const bootLogo = document.getElementById('boot-logo');
    if (bootLogo) bootLogo.src = logoCanvas('NOCLIP').toDataURL();

    document.getElementById('boot').addEventListener('click', () => this.leaveBoot());
    window.addEventListener('keydown', (e) => {
      if (this.state === 'boot' && (e.code === 'Space' || e.code === 'Enter')) this.leaveBoot();
    });

    document.getElementById('t-new').onclick = () => this.showSlots('new');
    document.getElementById('t-continue').onclick = () => this.showSlots('load');
    document.getElementById('t-archive').onclick = () => this.showScreen('archive');
    document.getElementById('t-how').onclick = () => this.showScreen('how');
    document.getElementById('t-options').onclick = () => { this.renderOptions(); this.showScreen('options'); };
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => this.showScreen('title');

    document.getElementById('p-resume').onclick = () => this.setPaused(false);
    document.getElementById('p-options').onclick = () => { this.renderOptions(true); this.showScreen('options'); };
    document.getElementById('p-quit').onclick = () => this.toTitle();
    this.refreshArchive();
  }

  showScreen(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === `scr-${name}`);
    document.getElementById('boot').hidden = name !== 'boot';
    this.screen = name;
    const playing = name === 'play';
    this.hud.setVisible(playing);
    document.getElementById('tape').style.display = playing ? '' : 'none';
    document.getElementById('scr-pause').classList.toggle('on', name === 'pause');
  }

  leaveBoot() {
    if (this.state !== 'boot') return;
    this.state = 'title';
    this.audio.ensure();
    this.audio.resume();
    this.audio.startMusic('drone');
    this.audio.startTone({ room: 'static', hum: 0.2, drip: 0, wind: 0, reverb: 0.2 });
    this.showScreen('title');
    document.getElementById('t-continue').disabled = !listSaves().some(Boolean);
    if (qs.has('quick')) this.startRun(1, qs.get('level') || 'level0');
  }

  showSlots(mode) {
    const host = document.getElementById('slot-list');
    const saves = listSaves();
    host.innerHTML = '';
    saves.forEach((s, i) => {
      const slot = i + 1;
      const b = document.createElement('button');
      b.className = 'menu-btn slot-btn';
      if (s && mode === 'load') {
        const c = CHAIN.find((x) => x.id === s.level);
        b.innerHTML = `<b>TAPE ${slot}</b> LEVEL ${c?.num ?? '?'} — ${c?.name ?? s.level}
          <small>${fmtTime(s.playtime)} · ${s.tapesFound.length} tapes · ${s.deaths} deaths</small>`;
        b.onclick = () => this.startRun(slot, null, s);
      } else if (mode === 'load') {
        b.innerHTML = `<b>TAPE ${slot}</b> <small>blank</small>`;
        b.disabled = true;
      } else {
        b.innerHTML = s
          ? `<b>TAPE ${slot}</b> <small>record over: LEVEL ${CHAIN.find((x) => x.id === s.level)?.num ?? '?'}</small>`
          : `<b>TAPE ${slot}</b> <small>blank — new run</small>`;
        b.onclick = () => { if (s) deleteSave(slot); this.startRun(slot, 'level0'); };
      }
      host.appendChild(b);
    });
    document.getElementById('slot-title').textContent = mode === 'new' ? 'PICK A TAPE TO RECORD ON' : 'CONTINUE A TAPE';
    this.showScreen('slots');
  }

  refreshArchive() {
    const host = document.getElementById('archive-list');
    if (!host) return;
    const found = new Set();
    for (const s of listSaves()) for (const t of s?.tapesFound || []) found.add(t);
    const seen = new Set();
    for (const s of listSaves()) for (const l of s?.levelsSeen || []) seen.add(l);
    host.innerHTML = CHAIN.map((c) => {
      const known = seen.has(c.id);
      return `<div class="arch-row ${known ? '' : 'unknown'}">
        <span class="arch-num">${known ? c.num : '??'}</span>
        <span class="arch-name">${known ? c.name : '— — — — —'}</span>
      </div>`;
    }).join('') + `<p class="arch-note">${found.size} tape${found.size === 1 ? '' : 's'} recovered.
      ${seen.size} of ${CHAIN.length} levels seen.</p>`;
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
    this.camera.fov = this.settings.fov / this.zoom;
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
        case 'KeyQ': this.useSelected(); break;
        case 'KeyG': this.throwSelected(); break;
        case 'Tab': e.preventDefault(); this.cycleItem(1); break;
        case 'Escape': this.setPaused(!this.paused); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': {
          const keys = Object.keys(this.inventory).filter((k) => this.inventory[k] > 0);
          const k = keys[+e.code.slice(-1) - 1];
          if (k) this.selectItem(k);
          break;
        }
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (map[e.code]) this.input[map[e.code]] = 0;
      this.keys.delete(e.code);
    });
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.state === 'play' && !this.paused && !this.hud.noteOpen) canvas.requestPointerLock?.();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.paused) return;
      this.player.turn(e.movementX, (this.settings.invertY ? -1 : 1) * e.movementY, this.settings.sens);
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.state === 'play' && document.pointerLockElement !== canvas && !this.hud.noteOpen && !this.dead) {
        this.setPaused(true);
      }
    });
    canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'play') return;
      this.zoom = clamp(this.zoom - Math.sign(e.deltaY) * 0.25, 1, 3);
      this.applySettings();
    }, { passive: true });
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
    this.input.fwd = ly < -0.2 ? 1 : this.input.fwd;
    this.input.back = ly > 0.2 ? 1 : this.input.back;
    this.input.left = lx < -0.2 ? 1 : this.input.left;
    this.input.right = lx > 0.2 ? 1 : this.input.right;
    const rx = dead(p.axes[2] || 0), ry = dead(p.axes[3] || 0);
    if (rx || ry) this.player.turn(rx * 12, (this.settings.invertY ? -1 : 1) * ry * 12, this.settings.sens);
    const btn = (i) => !!p.buttons[i]?.pressed;
    this.input.sprint = btn(10) || (p.buttons[7]?.value > 0.4) ? 1 : this.input.sprint;
    this.input.crouch = btn(11) ? 1 : this.input.crouch;
    this.input.jump = btn(0) ? 1 : this.input.jump;
    if (btn(2) && !this.padE) this.interact();
    this.padE = btn(2);
    if (btn(3) && !this.padF) this.toggleLamp();
    this.padF = btn(3);
  }

  // ------------------------------------------------------------------ run
  async startRun(slot, levelId, existing = null) {
    this.save = existing ? { ...blankSave(slot), ...existing, slot } : blankSave(slot);
    if (!this.save.created) this.save.created = 1;
    if (levelId) this.save.level = levelId;
    if (!existing) this.save.seedSalt = Math.floor(Math.random() * 1e6);
    this.hp = this.save.hp ?? 100;
    this.sanity = this.save.sanity ?? 100;
    this.camBattery = this.save.camBattery ?? 100;
    this.lampBattery = this.save.lampBattery ?? 100;
    this.inventory = { ...(this.save.inventory || {}) };
    if (!existing) this.inventory = { battery: 2, almondWater: 1, glowstick: 2 };
    this.tapeTime = this.save.tapeTime || 0;
    this.levelsSeen = new Set(this.save.levelsSeen || []);
    this.selected = Object.keys(this.inventory)[0] || null;
    this.applySettings();
    await this.enterLevel(this.save.level, true);
  }

  async enterLevel(id, fromSave = false) {
    this.state = 'loading';
    this.showScreen('load');
    const bar = document.getElementById('load-bar');
    const label = document.getElementById('load-label');
    const step = async (pct, text) => {
      bar.style.width = `${pct}%`;
      label.textContent = text;
      await new Promise((r) => setTimeout(r, 16));
    };
    await step(6, 'READING TAPE HEADER');

    let mod;
    try {
      mod = await loadLevelModule(id);
    } catch (e) {
      label.textContent = `TAPE DAMAGED — ${id} could not be read (${e.message})`;
      return;
    }
    await step(22, `LEVEL ${mod.meta.num} — ${mod.meta.name}`);
    const kit = makeKit(levelSeed(id, this.save.seedSalt));
    const data = mod.build(kit);
    await step(48, 'POURING CONCRETE');

    if (this.world) this.world.dispose();
    this.entities.clear();
    this.fx.reset();
    this.clearLevelObjects();
    this.world = new World(data, this.scene, { quality: this.settings.quality });
    this.player.world = this.world;
    await step(74, 'WIRING THE LIGHTS');

    // ---- scene mood
    this.scene.fog = new THREE.FogExp2(data.fog.color, data.fog.density);
    // Clear to the fog colour, not black: distance and the odd seam in the
    // geometry then read as haze instead of a hole punched in the world.
    this.scene.background = new THREE.Color(data.fog.color);
    this.ambient.color.setHex(data.ambient.color);
    this.ambient.intensity = data.ambient.intensity;
    this.hemi.visible = !!data.openSky;
    if (data.openSky) {
      this.hemi.color.setHex(data.ambient.sky ?? data.ambient.color);
      this.hemi.intensity = data.ambient.intensity * 1.4;
    }
    this.levelTint = data.tint || { r: 1, g: 1, b: 1 };
    this.rules = data.rules;

    // ---- population and furniture
    this.entities.load(data.entities);
    this.spawnPickups(data.items);
    this.spawnNotes(data.notes);
    this.spawnExits(data.exits);
    this.triggers = data.triggers.map((t) => ({ ...t, fired: false }));
    this.scares = data.scares.slice();
    this.links = data.links.slice();
    this.objectives = data.objectives.map((o) => ({ ...o }));
    this.hud.setObjectives(this.objectives);
    this.meta = mod.meta;
    this.levelId = id;
    this.levelTime = 0;
    this.wokenTags = new Set();
    await step(92, 'PRESSING RECORD');

    // ---- you
    this.player.spawn(data.spawn.x * data.cell, data.spawn.z * data.cell, data.spawn.yaw);
    this.levelsSeen.add(id);
    this.audio.startTone(data.ambience);
    this.audio.startMusic(data.ambience.music);
    this.audio.oneShot('tapeStart', 0.6);
    this.dead = false;
    this.hud.hideDeath();
    await step(100, 'GO');

    this.state = 'play';
    this.paused = false;
    this.showScreen('play');
    this.hud.levelCard(mod.meta);
    this.hud.setInventory(this.inventory, this.selected);
    if (!fromSave) this.hud.subtitle(mod.meta.brief.replace(/\s+/g, ' ').trim(), 7);
    this.autosave();
    this.renderer.domElement.requestPointerLock?.();
  }

  clearLevelObjects() {
    for (const list of [this.pickables, this.noteObjs, this.exitObjs, this.thrown]) {
      for (const o of list) {
        this.scene.remove(o.mesh);
        if (o.light) this.scene.remove(o.light);
        o.mesh?.traverse?.((m) => m.geometry?.dispose?.());
      }
      list.length = 0;
    }
    this.exitMarker = null;
  }

  // ------------------------------------------------------------------ objects
  spawnPickups(items) {
    const S = this.world.cell;
    for (const it of items) {
      const def = ITEM_DEFS[it.type];
      if (!def) continue;
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.22, 0.16),
        simple(new THREE.Color(def.color).getHex(), { rough: 0.5, emissive: new THREE.Color(def.color).multiplyScalar(0.25).getHex(), emissiveIntensity: 0.8 }),
      );
      body.position.y = 0.12;
      g.add(body);
      const halo = new THREE.PointLight(new THREE.Color(def.color).getHex(), 0.5, 3.5, 2);
      halo.position.y = 0.3;
      g.add(halo);
      g.position.set(it.x * S, this.world.floorAtWorld(it.x * S, it.z * S), it.z * S);
      this.scene.add(g);
      this.pickables.push({ mesh: g, rec: it, spin: Math.random() * 6 });
    }
  }

  spawnNotes(notes) {
    const S = this.world.cell;
    for (const n of notes) {
      if (this.save.notesRead?.includes(n.title)) { /* still show it — you can re-read */ }
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.42),
        simple(0xe8e2cc, { rough: 0.95, emissive: 0x2a2820, emissiveIntensity: 0.6, side: THREE.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * 3;
      m.position.set(n.x * S + (Math.random() - 0.5), this.world.floorAtWorld(n.x * S, n.z * S) + 0.03, n.z * S + (Math.random() - 0.5));
      this.scene.add(m);
      this.noteObjs.push({ mesh: m, rec: n });
    }
  }

  spawnExits(exits) {
    const S = this.world.cell;
    for (const e of exits) {
      const g = new THREE.Group();
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: e.hidden ? 0.06 : 0.16, side: THREE.DoubleSide, depthWrite: false }),
      );
      glow.position.y = 1.1;
      g.add(glow);
      const light = new THREE.PointLight(0xbfe4ff, e.hidden ? 0.2 : 0.9, 7, 2);
      light.position.y = 1.4;
      g.add(light);
      g.position.set(e.x * S, this.world.floorAtWorld(e.x * S, e.z * S), e.z * S);
      this.scene.add(g);
      this.exitObjs.push({ mesh: g, rec: e, glow });
      if (!e.hidden && !this.exitMarker) this.exitMarker = { x: e.x * S, z: e.z * S };
    }
  }

  // ------------------------------------------------------------------ verbs
  nearest(list, range = 2.4) {
    const p = this.player.pos;
    let best = null, bd = range;
    for (const o of list) {
      const d = Math.hypot(o.mesh.position.x - p.x, o.mesh.position.z - p.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  interact() {
    if (this.hud.noteOpen) { this.hud.hideNote(); return; }
    const item = this.nearest(this.pickables, 2.0);
    const note = this.nearest(this.noteObjs, 2.0);
    const exit = this.nearest(this.exitObjs, 2.6);
    if (exit && (!item || true)) {
      const need = exit.rec.needs;
      if (need && !(this.inventory[need] > 0)) {
        this.hud.toast(`LOCKED — you need ${ITEM_DEFS[need]?.name || need}`);
        this.audio.oneShot('doorSlam', 0.4);
        return;
      }
      if (need) this.take(need, -1);
      this.useExit(exit.rec);
      return;
    }
    if (item) { this.pickUp(item); return; }
    if (note) { this.readNote(note); return; }
  }

  pickUp(o) {
    const it = o.rec;
    this.take(it.type, it.amount || 1);
    this.audio.oneShot('pickup', 0.6);
    const def = ITEM_DEFS[it.type];
    this.hud.toast(`${def.name} ×${it.amount || 1}`);
    if (def.collectible) {
      const id = it.id || `${this.levelId}-tape`;
      if (!this.save.tapesFound.includes(id)) this.save.tapesFound.push(id);
      this.hud.subtitle(it.title || 'A tape. Somebody else got this far.');
    } else if (def.say) this.hud.subtitle(def.say, 3);
    this.scene.remove(o.mesh);
    this.pickables.splice(this.pickables.indexOf(o), 1);
  }

  readNote(o) {
    this.hud.showNote(o.rec);
    if (!this.save.notesRead.includes(o.rec.title)) this.save.notesRead.push(o.rec.title);
    this.sanity = Math.min(100, this.sanity + 4);
    document.exitPointerLock?.();
  }

  resumeFromNote() {
    if (this.state === 'play' && !this.paused) this.renderer.domElement.requestPointerLock?.();
  }

  take(type, n) {
    this.inventory[type] = Math.max(0, (this.inventory[type] || 0) + n);
    if (!this.inventory[type]) delete this.inventory[type];
    if (!this.selected || !this.inventory[this.selected]) this.selected = Object.keys(this.inventory)[0] || null;
    this.hud.setInventory(this.inventory, this.selected);
  }

  selectItem(k) {
    if (!this.inventory[k]) return;
    this.selected = k;
    this.hud.setInventory(this.inventory, this.selected);
  }

  cycleItem(dir) {
    const keys = Object.keys(this.inventory).filter((k) => this.inventory[k] > 0);
    if (!keys.length) return;
    const i = keys.indexOf(this.selected);
    this.selectItem(keys[(i + dir + keys.length) % keys.length]);
  }

  useSelected() {
    const k = this.selected;
    if (!k || !this.inventory[k]) return;
    const def = ITEM_DEFS[k];
    if (def.throwable) return this.throwSelected();
    if (!def.use) { this.hud.toast(`${def.name} — not now`); return; }
    def.use(this);
    this.take(k, -1);
    this.audio.oneShot('pickup', 0.4);
    this.hud.toast(`USED ${def.name}`);
  }

  throwSelected() {
    const k = this.selected;
    const def = ITEM_DEFS[k];
    if (!k || !def?.throwable || !this.inventory[k]) return;
    this.take(k, -1);
    const look = this.player.look();
    const eye = this.player.eye();
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6),
      simple(new THREE.Color(def.color).getHex(), { emissive: new THREE.Color(def.color).getHex(), emissiveIntensity: 2, rough: 0.4 }),
    );
    body.rotation.z = Math.PI / 2;
    g.add(body);
    g.position.set(eye.x, eye.y, eye.z);
    this.scene.add(g);
    const light = new THREE.PointLight(def.light.color, def.light.intensity, def.light.radius, 2);
    light.position.copy(g.position);
    this.scene.add(light);
    this.thrown.push({
      mesh: g, light, vel: { x: look.x * 9, y: look.y * 9 + 1.5, z: look.z * 9 },
      life: def.light.life, scary: !!def.scary, rest: false,
    });
    this.audio.oneShot('pickup', 0.3);
  }

  toggleLamp() {
    if (this.lampBattery <= 0) { this.hud.toast('TORCH DEAD'); return; }
    this.lampOn = !this.lampOn;
    this.audio.oneShot('facelingClick', 0.35);
  }

  toggleNight() {
    if (this.camBattery <= 0) return;
    this.night = !this.night;
    this.audio.oneShot('glassTick', 0.4);
    this.hud.toast(this.night ? 'NIGHTSHOT ON — 0 LUX' : 'NIGHTSHOT OFF');
  }

  toggleRecording() {
    this.recording = !this.recording;
    this.audio.oneShot(this.recording ? 'tapeStart' : 'tapeStop', 0.5);
    this.hud.toast(this.recording ? 'REC' : 'PAUSE — nothing is being recorded');
  }

  // ------------------------------------------------------------------ rules
  hurtPlayer(amount, from, opts = {}) {
    if (this.dead || this.state !== 'play') return;
    this.hp -= amount;
    this.sanity = Math.max(0, this.sanity - amount * 0.5);
    this.damageFlash = 1;
    this.fx.glitchAmt = Math.max(this.fx.glitchAmt, 0.7);
    this.fx.shakeAmt = Math.max(this.fx.shakeAmt, 0.8);
    if (!opts.silent) this.audio.oneShot('hurt', 0.8);
    if (opts.jump && from) {
      const sp = from;
      this.audio.oneShot(`${from}Grab`, 0.6);
    }
    if (this.hp <= 0) this.die(from);
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.audio.oneShot('die', 1);
    this.audio.stopMusic();
    this.fx.glitchAmt = 1;
    document.exitPointerLock?.();
    this.save.deaths = (this.save.deaths || 0) + 1;
    const names = {
      hound: 'Something that hunts by sound found you.',
      smiler: 'You were in the dark with it.',
      faceling: 'You looked too long.',
      skinstealer: 'It stopped pretending.',
      clump: 'It filled the corridor.',
      deathmoth: 'They took the warmth with them.',
      partygoer: 'The party found you.',
      bacteria: 'The growth got in.',
      wretch: 'It pulled you under.',
      crawler: 'It came down through the ceiling.',
      mannequin: 'It was closer every time you looked away.',
      nurse: 'She never stopped walking.',
      leviathan: 'You were in deep water.',
      duller: 'They walked you down.',
      howler: 'It called everything else.',
      fall: 'The floor was further away than it looked.',
      drown: 'The water was over your head for too long.',
      cold: 'The cold finished before anything else could.',
    };
    this.deadCause = names[cause] || 'The tape ends here.';
    this.hud.death(this.deadCause, {
      playtime: this.save.playtime, levels: this.levelsSeen.size,
      tapes: this.save.tapesFound.length, deaths: this.save.deaths,
    });
    writeSave({ ...this.save, deaths: this.save.deaths });
  }

  async respawn() {
    this.hud.hideDeath();
    this.hp = 65;
    this.sanity = Math.max(35, this.sanity);
    this.camBattery = Math.max(30, this.camBattery);
    this.lampBattery = Math.max(30, this.lampBattery);
    await this.enterLevel(this.levelId, true);
  }

  async useExit(rec) {
    if (rec.say) this.hud.subtitle(rec.say, 6);
    this.audio.oneShot('exitOpen', 0.8);
    if (rec.to === 'END') return this.finish();
    this.save.level = rec.to;
    this.save.hp = this.hp;
    this.save.sanity = this.sanity;
    this.save.camBattery = this.camBattery;
    this.save.lampBattery = this.lampBattery;
    this.save.inventory = { ...this.inventory };
    this.autosave();
    await new Promise((r) => setTimeout(r, 900));
    await this.enterLevel(rec.to);
  }

  finish() {
    this.state = 'end';
    this.audio.stopMusic();
    this.audio.startMusic('calm');
    document.exitPointerLock?.();
    document.getElementById('end-stats').innerHTML = `
      <div>RUN TIME <b>${fmtTime(this.save.playtime)}</b></div>
      <div>TAPE LENGTH <b>${fmtTime(this.tapeTime)}</b></div>
      <div>LEVELS SEEN <b>${this.levelsSeen.size} / ${CHAIN.length}</b></div>
      <div>TAPES RECOVERED <b>${this.save.tapesFound.length}</b></div>
      <div>DEATHS <b>${this.save.deaths}</b></div>`;
    this.showScreen('end');
    this.save.finished = true;
    this.autosave();
    document.getElementById('end-back').onclick = () => this.toTitle();
  }

  isObjectiveDone(id) { return !!this.objectives?.find((o) => o.id === id)?.done; }

  completeObjective(id) {
    const o = this.objectives?.find((x) => x.id === id);
    if (!o || o.done) return;
    o.done = true;
    this.hud.renderObjectives();
    this.hud.toast('OBJECTIVE COMPLETE');
    this.audio.oneShot('objectiveDone', 0.6);
    this.save.objectives = this.save.objectives || {};
    this.save.objectives[`${this.levelId}:${id}`] = true;
  }

  autosave() {
    this.save.level = this.levelId || this.save.level;
    this.save.hp = this.hp;
    this.save.sanity = this.sanity;
    this.save.camBattery = this.camBattery;
    this.save.lampBattery = this.lampBattery;
    this.save.inventory = { ...this.inventory };
    this.save.tapeTime = this.tapeTime;
    this.save.levelsSeen = [...this.levelsSeen];
    writeSave(this.save);
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
    this.autosave();
    this.paused = false;
    this.dead = false;
    this.state = 'title';
    this.hud.hideDeath();
    if (this.world) { this.world.dispose(); this.world = null; }
    this.entities.clear();
    this.fx.reset();
    this.clearLevelObjects();
    this.audio.stopTone();
    this.audio.startMusic('drone');
    this.audio.startTone({ room: 'static', hum: 0.2, drip: 0, wind: 0, reverb: 0.2 });
    this.refreshArchive();
    document.getElementById('t-continue').disabled = !listSaves().some(Boolean);
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

    if (this.state === 'play' && !this.paused && !this.dead && !this.hud.noteOpen) {
      this.pollPad();
      this.tick(dt);
    } else if (this.state === 'play') {
      // paused / reading: keep the tape rolling visually, freeze the world
      this.fx.update(dt * 0.2);
    }
    this.hud.update(dt);

    const light = this.world ? this.world.lightAt(this.player.pos.x, this.player.pos.z) + (this.lampOn ? 0.35 : 0) : 0.4;
    this.cam.render(dt, {
      glitch: clamp01(this.fx.glitchAmt * this.settings.tape + (1 - this.camBattery / 100) * 0.15),
      grain: clamp01(this.fx.grainAmt + (this.state === 'play' ? 0 : 0.1)),
      light: this.state === 'play' ? light : 0.5,
      night: this.night && this.camBattery > 0,
      damage: this.damageFlash,
      sanity: clamp01(this.sanity / 100),
      underwater: !!this.player.submerged,
      tint: this.levelTint || { r: 1, g: 1, b: 1 },
      tapeTime: this.tapeTime,
      battery: this.camBattery,
      recording: this.recording && this.camBattery > 0,
      zoom: this.zoom,
    });
  }

  tick(dt) {
    const p = this.player;
    const w = this.world;
    if (!w) return;
    this.levelTime += dt;
    this.save.playtime = (this.save.playtime || 0) + dt;
    if (this.recording && this.camBattery > 0) this.tapeTime += dt;
    this.noiseBoost = Math.max(0, this.noiseBoost - dt * 1.5);

    // ---- move
    p.update(dt, this.input, this.rules || {});
    w.update(dt, p.pos);
    this.entities.update(dt);
    this.fx.update(dt);

    // ---- camera: eye + bob + shake + the whip when something is behind you
    const eye = p.eye();
    const shake = this.fx.shakeAmt;
    this.camera.position.set(
      eye.x + (Math.random() - 0.5) * shake * 0.08,
      eye.y - this.fx.dropAmt + (this.settings.headBob ? 0 : -p.bob) + (Math.random() - 0.5) * shake * 0.08,
      eye.z + (Math.random() - 0.5) * shake * 0.08,
    );
    if (this.fx.whipAmt > 0.2) p.yaw += this.fx.whipAmt * dt * 9;
    this.camera.rotation.set(p.pitch, p.yaw, p.sway * (this.settings.headBob ? 1 : 0) + shake * 0.03, 'YXZ');

    // ---- your torch
    const look = p.look();
    this.lamp.position.copy(this.camera.position);
    this.lampTarget.position.set(eye.x + look.x * 8, eye.y + look.y * 8, eye.z + look.z * 8);
    const lampWant = this.lampOn && this.lampBattery > 0 ? 3.4 : 0;
    this.lamp.intensity = damp(this.lamp.intensity, lampWant, 12, dt);
    if (this.lampOn && this.lampBattery > 0) this.lampBattery = Math.max(0, this.lampBattery - dt * 0.55);
    if (this.lampBattery <= 0 && this.lampOn) { this.lampOn = false; this.hud.toast('TORCH DEAD'); }

    // ---- the tape's own battery
    if (this.recording) {
      const drain = 0.24 * (this.rules?.batteryDrain ?? 1) * (this.night ? 2.1 : 1);
      this.camBattery = Math.max(0, this.camBattery - dt * drain);
    }
    if (this.camBattery <= 0) this.night = false;

    // ---- nerve: darkness, being hunted, and water all eat it
    const threat = this.entities.threat();
    const closeness = threat.creature && threat.dist < 26 ? clamp01(1 - threat.dist / 26) * (threat.hunting ? 1 : 0.4) : 0;
    const dark = clamp01(1 - w.lightAt(p.pos.x, p.pos.z) * 2.2) * (this.lampOn ? 0.35 : 1);
    const drainS = (dark * 1.5 + closeness * 3.2 + this.fx.dread * 1.2) * (this.rules?.sanityDrain ?? 1);
    this.sanity = clamp(this.sanity - drainS * dt + (dark < 0.3 && closeness < 0.1 ? 1.6 * dt : 0), 0, 100);
    if (this.sanity < 12 && Math.random() < dt * 0.25) {
      this.audio.oneShot(Math.random() < 0.5 ? 'whisper' : 'stepBehind', 0.35);
    }

    // ---- drowning, cold
    if (p.breath <= 0) this.hurtPlayer(26 * dt, 'drown', { silent: true });
    if (this.rules?.cold) {
      const shelter = w.lightAt(p.pos.x, p.pos.z) > 0.5;
      if (!shelter) this.hurtPlayer(1.6 * dt, 'cold', { silent: true });
    }
    this.damageFlash = damp(this.damageFlash, 0, 2.2, dt);
    this.audio.setListener(p.pos.x, p.pos.z, p.yaw);
    this.audio.updateHeart(dt, closeness);
    this.audio.dread = clamp01(this.fx.dread * 0.6 + closeness);

    // ---- pickables spin, exits breathe, thrown lights fly
    for (const o of this.pickables) {
      o.spin += dt * 1.6;
      o.mesh.rotation.y = o.spin;
      o.mesh.children[0].position.y = 0.12 + Math.sin(o.spin * 2) * 0.03;
    }
    for (const e of this.exitObjs) {
      e.glow.material.opacity = (e.rec.hidden ? 0.05 : 0.14) + Math.sin(this.levelTime * 2) * 0.04;
      e.glow.lookAt(this.camera.position.x, e.glow.position.y, this.camera.position.z);
    }
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const t = this.thrown[i];
      t.life -= dt;
      if (!t.rest) {
        t.vel.y -= 16 * dt;
        const nx = t.mesh.position.x + t.vel.x * dt;
        const nz = t.mesh.position.z + t.vel.z * dt;
        if (!w.solidAtWorld(nx, nz, t.mesh.position.y)) {
          t.mesh.position.x = nx;
          t.mesh.position.z = nz;
        } else { t.vel.x *= -0.3; t.vel.z *= -0.3; }
        t.mesh.position.y += t.vel.y * dt;
        const floor = w.floorAtWorld(t.mesh.position.x, t.mesh.position.z);
        if (t.mesh.position.y <= floor + 0.05) {
          t.mesh.position.y = floor + 0.05;
          t.vel.x *= 0.4; t.vel.z *= 0.4;
          t.vel.y = 0;
          if (Math.hypot(t.vel.x, t.vel.z) < 0.4) t.rest = true;
        }
        t.light.position.copy(t.mesh.position);
      }
      if (t.scary) {
        // flares keep things off you
        for (const c of this.entities.list) {
          if (Math.hypot(c.pos.x - t.mesh.position.x, c.pos.z - t.mesh.position.z) < 7) {
            c.alert = Math.max(0, c.alert - dt * 0.9);
            if (c.state === 'hunt' && Math.random() < dt) c.state = 'patrol';
          }
        }
      }
      if (t.life <= 0) {
        this.scene.remove(t.mesh, t.light);
        t.mesh.traverse((m) => m.geometry?.dispose?.());
        this.thrown.splice(i, 1);
      }
    }

    // ---- proximity: prompts, notes, triggers, scares, links
    const near = this.nearest(this.pickables, 2.0);
    const nnote = this.nearest(this.noteObjs, 2.0);
    const nexit = this.nearest(this.exitObjs, 2.6);
    if (nexit) {
      const need = nexit.rec.needs;
      const label = nexit.rec.label || nexit.rec.kind.toUpperCase();
      this.hud.prompt(need && !this.inventory[need]
        ? `<b>${label}</b> — locked. Needs ${ITEM_DEFS[need]?.name || need}.`
        : `<b>[E]</b> take the ${nexit.rec.kind} — <b>${label}</b>`);
    } else if (near) {
      this.hud.prompt(`<b>[E]</b> take ${ITEM_DEFS[near.rec.type]?.name || near.rec.type}`);
    } else if (nnote) {
      this.hud.prompt('<b>[E]</b> read');
    } else this.hud.prompt(null);

    for (const t of this.triggers) {
      if (t.fired) continue;
      if (Math.hypot(t.x * w.cell - p.pos.x, t.z * w.cell - p.pos.z) > t.radius * w.cell) continue;
      t.fired = t.once;
      if (t.say) this.hud.subtitle(t.say, 5.5);
      if (t.objective) this.completeObjective(t.objective);
      if (t.addObjective) this.hud.addObjective(t.addObjective);
      if (t.wake) this.wokenTags.add(t.wake);
      if (t.sound) this.audio.oneShot(t.sound, 0.7);
      if (t.lightsOff) w.douse(p.pos.x, p.pos.z, t.lightsOff, 6);
    }

    for (const s of this.scares) {
      if (Math.hypot(s.x * w.cell - p.pos.x, s.z * w.cell - p.pos.z) > s.radius * w.cell) continue;
      if (s.needsDark && w.lightAt(p.pos.x, p.pos.z) > 0.3) continue;
      this.fx.trigger(s);
    }

    // pits: step in one and the level below catches you
    if (w.codeAtWorld(p.pos.x, p.pos.z) === 8 && p.pos.y < w.floorAtWorld(p.pos.x, p.pos.z) - 1) {
      this.hurtPlayer(35, 'fall');
      p.spawn(this.world.data.spawn.x * w.cell, this.world.data.spawn.z * w.cell, p.yaw);
    }

    // declared traversals (ladders, drains, lift shafts)
    for (const L of this.links) {
      const a = { x: L.x0 * w.cell, z: L.z0 * w.cell };
      const b = { x: L.x1 * w.cell, z: L.z1 * w.cell };
      const hit = (q) => Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < w.cell * 0.7;
      if (hit(a) && !this.linkCool) {
        this.linkCool = 1.2;
        p.pos.x = b.x; p.pos.z = b.z; p.pos.y = w.floorAtWorld(b.x, b.z) + 0.1;
        this.audio.oneShot('clawStep', 0.4);
      } else if (L.two && hit(b) && !this.linkCool) {
        this.linkCool = 1.2;
        p.pos.x = a.x; p.pos.z = a.z; p.pos.y = w.floorAtWorld(a.x, a.z) + 0.1;
        this.audio.oneShot('clawStep', 0.4);
      }
    }
    this.linkCool = Math.max(0, (this.linkCool || 0) - dt);

    // ---- autosave every half minute of survival
    this.saveT = (this.saveT ?? 30) - dt;
    if (this.saveT <= 0) { this.saveT = 30; this.autosave(); }

    this.hud.setVitals({ hp: this.hp, sanity: this.sanity, stamina: p.stamina, breath: p.breath });
  }
}

window.NOCLIP = new Game();
