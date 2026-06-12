// App shell and game loop: boot → title (with a live world panorama) →
// survival or creative. Owns input, mining/placing/combat, day cycle, sleep,
// autosave, pause/death/inventory flow, and the debug overlay (F3).
import * as THREE from 'three';
import { B, I, BLOCKS, ITEMS, isBlock, nameOf, breakInfo, dropFor } from './blocks.js';
import { World, SOLID, FLUID, CH, WORLD_H } from './world.js';
import { Player, raycast } from './player.js';
import { Inventory, doCraft } from './inventory.js';
import { ChunkView, Sky, dayState } from './render.js';
import { Drops, Particles, buildDropMesh } from './entities.js';
import { Mobs } from './mobs.js';
import { audio } from './audio.js';
import { UI } from './ui.js';
import { crackCanvases, logoCanvas } from './textures.js';
import { listWorlds, createWorld, loadWorld, saveWorld, deleteWorld } from './save.js';

const BUILD = 1;
const DAY_LEN = 600; // seconds per full day
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const SETTINGS_KEY = 'loam_settings_v1';
function loadSettings() {
  try { return { dist: 5, music: 0.8, sfx: 0.9, sens: 1, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { dist: 5, music: 0.8, sfx: 0.9, sens: 1 }; }
}

class App {
  constructor() {
    this.settings = loadSettings();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    $('game-holder').appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 400);
    this._resize();
    addEventListener('resize', () => this._resize());

    this.ui = new UI();
    this.view = 'boot';
    this.paused = false;
    this.locked = false;
    this.input = { fwd: 0, back: 0, left: 0, right: 0, jump: 0, sneak: 0, sprint: 0 };
    this.mouseL = false; this.mouseR = false;
    this.fps = 60;
    this.elapsed = 0;

    // title panorama: a real world, orbited slowly
    this.titleScene = new THREE.Scene();
    this.titleWorld = new World(4127);
    this.titleView = new ChunkView(this.titleScene);
    this.titleSky = new Sky(this.titleScene, this.camera);
    this.titleCenter = this.titleWorld.gen.findSpawn();

    const logos = logoCanvas('LOAM', 13).toDataURL();
    $('boot-logo').src = logos;
    $('title-logo').src = logos;
    $('build-tag').textContent = 'LOAM · BUILD ' + BUILD;

    this._bindBoot();
    this._bindTitle();
    this._bindInput();
    this._bindOverlays();

    window.__loam = { app: this, version: BUILD, errors: [] };
    window.addEventListener('error', (e) => window.__loam.errors.push(String(e.message)));

    if (params.has('quick')) {
      this._begin();
      const mode = params.get('mode') === 'creative' ? 'creative' : 'survival';
      const seed = parseInt(params.get('seed') || '1337', 10) || 1337;
      this.startGame({ id: null, name: 'QA World', seed, mode }, null);
    }

    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try { this.step(dt); } catch (e) { window.__loam.errors.push(String(e.stack || e)); throw e; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ boot/title
  _begin() {
    if (this.view !== 'boot') return;
    audio.ensure();
    audio.setMusicVol(this.settings.music);
    audio.setSfxVol(this.settings.sfx);
    audio.onTrack = (name) => this.ui.toast('♪ ' + name, true);
    $('boot').classList.add('gone');
    this.showScreen('title');
  }

  _bindBoot() {
    const go = () => this._begin();
    $('boot').addEventListener('click', go);
    addEventListener('keydown', go, { once: true });
  }

  showScreen(name) {
    this.view = name;
    for (const s of ['title', 'game']) $('scr-' + s).classList.toggle('active', s === name);
    if (name === 'title') { audio.setMood('menu'); audio.setUnderwater(false); this._renderWorldList(); }
  }

  _bindTitle() {
    $('title-new').onclick = () => { audio.click?.(); $('modal-new').classList.add('show'); $('nw-name').value = ''; $('nw-seed').value = ''; };
    $('nw-cancel').onclick = () => $('modal-new').classList.remove('show');
    let mode = 'survival';
    for (const m of ['survival', 'creative']) {
      $('nw-' + m).onclick = () => {
        mode = m;
        $('nw-survival').classList.toggle('sel', m === 'survival');
        $('nw-creative').classList.toggle('sel', m === 'creative');
      };
    }
    $('nw-create').onclick = () => {
      const meta = createWorld($('nw-name').value.trim() || 'New World', $('nw-seed').value, mode);
      $('modal-new').classList.remove('show');
      audio.chime();
      this.startGame(meta, null);
    };
    $('title-how').onclick = () => $('modal-how').classList.add('show');
    $('how-close').onclick = () => $('modal-how').classList.remove('show');
  }

  _renderWorldList() {
    const list = $('world-list');
    list.innerHTML = '';
    for (const meta of listWorlds().slice(0, 6)) {
      const el = document.createElement('div');
      el.className = 'world-row';
      el.innerHTML = `<button class="menu-btn w-load"><b>${meta.name}</b>
        <span>${meta.mode.toUpperCase()} · seed ${meta.seed}</span></button>
        <button class="w-del" title="delete">✕</button>`;
      el.querySelector('.w-load').onclick = () => this.startGame(meta, loadWorld(meta.id));
      el.querySelector('.w-del').onclick = () => {
        if (el.classList.contains('arm')) { deleteWorld(meta.id); this._renderWorldList(); audio.back(); }
        else { el.classList.add('arm'); el.querySelector('.w-del').textContent = 'SURE?'; }
      };
      list.appendChild(el);
    }
  }

  // ------------------------------------------------------------ game setup
  startGame(meta, data) {
    this.meta = meta;
    this.scene = new THREE.Scene();
    this.world = new World(meta.seed, data?.diffs || {});
    this.chunkView?.dispose();
    this.chunkView = new ChunkView(this.scene);
    this.sky = new Sky(this.scene, this.camera);
    this.drops = new Drops(this.world, this.scene);
    this.particles = new Particles(this.scene);
    this.mobs = new Mobs(this.world, this.scene, meta.mode);
    this.mobs.onSound = (n) => audio.mob(n);
    this.mobs.onDrop = (id, n, x, y, z) => this.drops.spawn(id, n, x, y, z);
    this.mobs.onPuff = (x, y, z, rgb) => this.particles.burst(x, y, z, rgb, 16);

    this.player = new Player(this.world, meta.mode);
    this.inv = new Inventory();
    if (data) {
      const p = data.player;
      this.player.pos = { x: p.pos[0], y: p.pos[1], z: p.pos[2] };
      this.player.yaw = p.yaw; this.player.pitch = p.pitch;
      this.player.hp = p.hp; this.player.hunger = p.hunger;
      this.player.flying = !!p.flying && meta.mode === 'creative';
      this.player.spawn = p.spawn ? { x: p.spawn[0], y: p.spawn[1], z: p.spawn[2] } : null;
      this.inv = Inventory.restore(data.inv);
      this.time = data.time ?? 0.02;
      this._freshWorld = false;
    } else {
      const s = this.world.gen.findSpawn();
      this.player.pos = { ...s };
      this.player.spawn = { ...s };
      this.time = parseFloat(params.get('t') || '0.03');
      this._freshWorld = true;
    }
    if (params.has('tp')) {
      const [x, y, z] = params.get('tp').split(',').map(Number);
      this.player.pos = { x, y, z };
    }
    if (params.has('yaw')) this.player.yaw = parseFloat(params.get('yaw'));
    if (params.has('pitch')) this.player.pitch = parseFloat(params.get('pitch'));
    if (!data && meta.mode === 'creative') { // a builder's starter palette
      [B.grass, B.planks, B.cobble, B.stoneBrick, B.glass, B.log, B.wool, B.torch, B.lantern]
        .forEach((id, i) => { this.inv.slots[i] = { id, n: 64 }; });
    }

    this.inv.onChange = () => { this.ui.renderHotbar(this.inv); if (this.ui.isOpen()) this.ui.refresh(); };
    this.player.onStat = () => this.ui.renderStats(this.player);
    this.player.onHurt = (n, cause) => { this.ui.damageFlash(); audio.hurt(); };
    this.player.onDie = (cause) => {
      document.exitPointerLock?.();
      this.ui.showDeath({
        fall: 'You fell from a high place', drown: 'You drowned', lava: 'You tried to swim in lava',
        starve: 'You starved', cactus: 'Pricked to death', hit: 'Slain by a zombie', void: 'You fell out of the world',
      }[cause] || 'You died');
    };
    this.ui.onCraft = (r) => {
      if (doCraft(r, this.inv)) { audio.chime(); this.ui.toast('Crafted ' + nameOf(r.out)); }
    };
    this.ui.onSlotsChanged = () => this.ui.renderHotbar(this.inv);
    this.ui.onDropCursor = (id, n) => {
      const p = this.player;
      this.drops.spawn(id, n, p.pos.x, p.pos.y + 1, p.pos.z);
    };

    // mining state
    this.mineTarget = null; this.mineProgress = 0; this.digSndT = 0;
    this.attackCd = 0; this.placeCd = 0; this.breakCd = 0;
    this._stepMark = 0; this._wasInWater = false;
    this._saveT = 0; this._lastSpace = 0;
    this.debugOn = false;

    // block highlight + crack decal
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.7 }),
    );
    this.scene.add(this.highlight);
    this.crackTex = crackCanvases().map((c) => {
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    });
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.crack.visible = false;
    this.scene.add(this.crack);

    if (this.heldGroup) this.camera.remove(this.heldGroup);
    this.heldGroup = new THREE.Group();
    this.camera.add(this.heldGroup);
    this.scene.add(this.camera);
    this.heldMesh = null; this._heldFor = -1; this.swingT = 0;

    this.loading = true;
    $('loading').classList.add('show');
    this.showScreen('game');
    this.ui.hideDeath();
    $('pause').classList.remove('show');
    this.ui.renderHotbar(this.inv);
    this.ui.renderStats(this.player);
  }

  saveGame() {
    if (!this.meta?.id || !this.player) return;
    saveWorld(this.meta.id, {
      seed: this.meta.seed, mode: this.meta.mode, name: this.meta.name,
      time: this.time,
      player: {
        pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
        yaw: this.player.yaw, pitch: this.player.pitch,
        hp: this.player.hp, hunger: this.player.hunger, flying: this.player.flying,
        spawn: this.player.spawn ? [this.player.spawn.x, this.player.spawn.y, this.player.spawn.z] : null,
      },
      inv: this.inv.serialize(),
      diffs: this.world.diffs,
    });
  }

  quitToTitle() {
    this.saveGame();
    document.exitPointerLock?.();
    this.mobs.clear(); this.drops.clear();
    this.paused = false;
    $('pause').classList.remove('show');
    this.ui.hideDeath();
    if (this.ui.isOpen()) this.ui.close();
    this.camera.remove(this.heldGroup);
    this.showScreen('title');
  }

  // ------------------------------------------------------------ input
  _bindInput() {
    const keymap = { KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'jump', ShiftLeft: 'sneak', ShiftRight: 'sneak', ControlLeft: 'sprint', ControlRight: 'sprint' };
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.view !== 'game' || this.loading) return;
      const k = keymap[e.code];
      if (k) { this.input[k] = 1; if (k === 'jump') this._spaceTap(); e.preventDefault(); }
      if (e.code === 'Escape') return; // pointer-lock handler owns pause
      if (e.code === 'KeyE') {
        if (this.player.dead) return;
        if (this.ui.isOpen()) this.ui.close();
        else if (!this.paused) { document.exitPointerLock?.(); this.ui.open(this.inv, this.meta.mode); }
      }
      if (e.code === 'KeyQ' && this.locked) this._dropHeld();
      if (e.code === 'KeyM') { audio.setMuted(!audio.muted); this.ui.toast(audio.muted ? 'Muted' : 'Sound on'); }
      if (e.code === 'KeyF' && this.meta.mode === 'creative') this._toggleFly();
      if (e.code === 'F3') { e.preventDefault(); this.debugOn = !this.debugOn; }
      if (/^Digit[1-9]$/.test(e.code)) {
        this.inv.sel = parseInt(e.code.slice(5), 10) - 1;
        this.ui.renderHotbar(this.inv);
        this._refreshHeld();
      }
    });
    addEventListener('keyup', (e) => {
      const k = keymap[e.code];
      if (k) this.input[k] = 0;
    });
    addEventListener('wheel', (e) => {
      if (this.view !== 'game' || !this.locked) return;
      this.inv.sel = (this.inv.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      this.ui.renderHotbar(this.inv);
      this._refreshHeld();
    });

    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.view !== 'game' || this.loading || this.paused || this.player?.dead || this.ui.isOpen()) return;
      if (!this.locked) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      $('lock-hint').classList.toggle('show', this.view === 'game' && !this.locked && !this.paused && !this.ui.isOpen() && !this.player?.dead && !this.loading);
      if (!this.locked && this.view === 'game' && !this.ui.isOpen() && !this.player?.dead && !this.loading && !this._sleeping) {
        this.paused = true;
        $('pause').classList.add('show');
        this.saveGame();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.paused || this.player?.dead) return;
      const s = 0.0023 * this.settings.sens;
      this.player.yaw -= e.movementX * s;
      this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - e.movementY * s));
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouseL = true; this._attackClick(); }
      if (e.button === 1) { e.preventDefault(); this._pickBlock(); }
      if (e.button === 2) { this.mouseR = true; this.placeCd = 0; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseL = false; this.mineProgress = 0; this.mineTarget = null; }
      if (e.button === 2) this.mouseR = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('beforeunload', () => this.saveGame());
  }

  _spaceTap() {
    const now = performance.now();
    if (now - this._lastSpace < 280 && this.meta.mode === 'creative') this._toggleFly();
    this._lastSpace = now;
  }

  _toggleFly() {
    this.player.flying = !this.player.flying;
    if (this.player.flying) this.player.vel.y = 0;
    this.ui.toast(this.player.flying ? 'Flying' : 'Walking');
  }

  _bindOverlays() {
    $('pause-resume').onclick = () => this._resume();
    $('pause-quit').onclick = () => this.quitToTitle();
    $('death-respawn').onclick = () => {
      this.player.respawn();
      this.ui.hideDeath();
      this.ui.renderStats(this.player);
    };
    $('death-title').onclick = () => this.quitToTitle();
    this.ui.onClose = () => { if (!this.paused && !this.player?.dead) this.renderer.domElement.requestPointerLock?.(); };

    const slider = (id, key, fmt, apply) => {
      const el = $(id);
      el.value = this.settings[key];
      $(id + '-v').textContent = fmt(this.settings[key]);
      el.oninput = () => {
        this.settings[key] = parseFloat(el.value);
        $(id + '-v').textContent = fmt(this.settings[key]);
        apply?.(this.settings[key]);
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { }
      };
    };
    slider('set-dist', 'dist', (v) => v + ' chunks');
    slider('set-music', 'music', (v) => Math.round(v * 100) + '%', (v) => audio.setMusicVol(v));
    slider('set-sfx', 'sfx', (v) => Math.round(v * 100) + '%', (v) => audio.setSfxVol(v));
    slider('set-sens', 'sens', (v) => v.toFixed(2) + '×');
  }

  _resume() {
    this.paused = false;
    $('pause').classList.remove('show');
    this.renderer.domElement.requestPointerLock?.();
  }

  // ------------------------------------------------------------ actions
  _eyeRay() {
    const eye = this.player.eyePos();
    const dir = this.player.look();
    return { eye, dir };
  }

  _attackClick() {
    if (this.player.dead || this.ui.isOpen() || this.paused) return;
    const { eye, dir } = this._eyeRay();
    const mh = this.mobs.raycast(eye, dir, 3.4);
    const bh = raycast(this.world, eye, dir, 5);
    if (mh && (!bh || mh.dist < bh.dist)) {
      this.attackCd = 0.35;
      const tool = ITEMS[this.inv.held()?.id]?.tool;
      const dmg = tool ? tool.dmg : 1;
      this.mobs.hit(mh.mob, dmg, this.player.pos);
      this.player.noteAttack();
      if (tool && this.meta.mode === 'survival' && this.inv.wearHeld()) audio.toolBreak();
      audio.swish();
      this.swingT = 0.25;
    }
  }

  _pickBlock() {
    const { eye, dir } = this._eyeRay();
    const bh = raycast(this.world, eye, dir, 6);
    if (!bh) return;
    if (this.meta.mode === 'creative') {
      this.inv.slots[this.inv.sel] = { id: bh.id, n: 64 };
      this.inv.onChange?.();
    } else {
      const i = this.inv.slots.findIndex((s, idx) => idx < 9 && s && s.id === bh.id);
      if (i >= 0) { this.inv.sel = i; this.ui.renderHotbar(this.inv); }
    }
    this._refreshHeld();
  }

  _dropHeld() {
    const s = this.inv.held();
    if (!s) return;
    const { eye, dir } = this._eyeRay();
    this.drops.spawn(s.id, 1, eye.x + dir.x * 0.6, eye.y - 0.25, eye.z + dir.z * 0.6, false);
    const d = this.drops.list[this.drops.list.length - 1];
    d.vx = dir.x * 6; d.vy = dir.y * 6 + 2; d.vz = dir.z * 6;
    d.age = -0.8; // brief no-pickup window so it actually leaves your hand
    this.inv.consumeHeld(1);
  }

  _doBreak(bh, withDrops) {
    const def = BLOCKS[bh.id];
    this.world.setBlock(bh.x, bh.y, bh.z, B.air);
    this.particles.blockBurst(bh.id, bh.x, bh.y, bh.z);
    audio.breakBlock(def.snd);
    // anything cross-shaped sitting on top pops off with it
    const above = this.world.block(bh.x, bh.y + 1, bh.z);
    if (BLOCKS[above]?.cross) {
      this.world.setBlock(bh.x, bh.y + 1, bh.z, B.air);
      if (withDrops) {
        const ad = dropFor(above);
        if (ad !== null) this.drops.spawn(ad, 1, bh.x + 0.5, bh.y + 1.3, bh.z + 0.5);
      }
    }
    if (withDrops) {
      const d = dropFor(bh.id);
      if (d !== null) this.drops.spawn(d, 1, bh.x + 0.5, bh.y + 0.4, bh.z + 0.5);
      const held = this.inv.held();
      if (held?.uses !== undefined && def.hard > 0.1 && this.inv.wearHeld()) audio.toolBreak();
    }
  }

  _tryPlace(bh) {
    const held = this.inv.held();

    // stations open on use
    if ((bh.id === B.craftingTable || bh.id === B.furnace) && !this.input.sneak) {
      document.exitPointerLock?.();
      this.ui.open(this.inv, this.meta.mode, bh.id === B.furnace ? 'furnace' : 'table');
      audio.click();
      return;
    }
    if (!held) return;

    if (ITEMS[held.id]?.food) {
      if (this.player.mode === 'creative' ? false : this.player.eat(ITEMS[held.id].food)) {
        this.inv.consumeHeld(1);
        audio.eat();
        this.swingT = 0.3;
      }
      return;
    }
    if (held.id === I.bedroll) { this._sleep(); return; }
    if (!isBlock(held.id)) return;

    const cx = bh.x + bh.face[0], cy = bh.y + bh.face[1], cz = bh.z + bh.face[2];
    if (cy < 1 || cy >= WORLD_H) return;
    const cur = this.world.block(cx, cy, cz);
    if (!BLOCKS[cur]?.replaceable) return;
    const def = BLOCKS[held.id];
    if (def.cross && !SOLID[this.world.block(cx, cy - 1, cz)]) return; // plants need footing
    if (def.solid) {
      const pb = this.player.box();
      if (pb.x1 > cx && pb.x0 < cx + 1 && pb.y1 > cy && pb.y0 < cy + 1 && pb.z1 > cz && pb.z0 < cz + 1) return;
      for (const m of this.mobs.list) {
        if (Math.abs(m.x - cx - 0.5) < 0.8 && Math.abs(m.z - cz - 0.5) < 0.8 && m.y < cy + 1 && m.y + m.spec.h > cy) return;
      }
    }
    this.world.setBlock(cx, cy, cz, held.id);
    if (this.meta.mode === 'survival') this.inv.consumeHeld(1);
    else this.inv.onChange?.();
    audio.place(def.snd);
    this.swingT = 0.25;
  }

  _sleep() {
    if (!this.player.onGround) { this.ui.toast("You can't sleep mid-air"); return; }
    this.player.spawn = { ...this.player.pos };
    const st = dayState(this.time);
    if (st.elev > -0.05) { this.ui.toast('Spawn point set — sleep when the sun is down'); audio.click(); return; }
    this._sleeping = true;
    audio.sleep();
    $('sleep-fade').classList.add('show');
    setTimeout(() => {
      this.time = 0.005;
      for (let i = this.mobs.list.length - 1; i >= 0; i--) {
        if (this.mobs.list[i].spec.hostile) this.mobs._remove(i);
      }
      audio.wake();
      this.ui.toast('You wake refreshed — spawn point set');
      $('sleep-fade').classList.remove('show');
      this._sleeping = false;
    }, 1400);
  }

  _interact(dt) {
    const p = this.player;
    if (!this.locked || p.dead || this.paused || this.ui.isOpen()) {
      this.highlight.visible = false; this.crack.visible = false;
      this.mineProgress = 0; this.mineTarget = null;
      return;
    }
    const { eye, dir } = this._eyeRay();
    const reach = this.meta.mode === 'creative' ? 5.5 : 4.5;
    const bh = raycast(this.world, eye, dir, reach);
    const mh = this.mouseL ? this.mobs.raycast(eye, dir, 3.4) : null;
    const mobFirst = mh && (!bh || mh.dist < bh.dist);

    this.highlight.visible = !!bh;
    if (bh) this.highlight.position.set(bh.x + 0.5, bh.y + 0.5, bh.z + 0.5);
    this.crack.visible = false;

    this.attackCd -= dt; this.breakCd -= dt; this.placeCd -= dt;

    if (this.mouseL && mobFirst && this.attackCd <= 0) {
      this._attackClick();
    } else if (this.mouseL && bh && !mobFirst) {
      const key = bh.x + ',' + bh.y + ',' + bh.z;
      if (this.meta.mode === 'creative') {
        if (this.breakCd <= 0) { this.breakCd = 0.2; this._doBreak(bh, false); this.swingT = 0.2; }
      } else {
        const info = breakInfo(bh.id, this.inv.held()?.id);
        if (info) {
          if (this.mineTarget !== key) { this.mineTarget = key; this.mineProgress = 0; }
          this.mineProgress += dt / info.time;
          p.noteMining(dt);
          this.swingT = Math.max(this.swingT, 0.12);
          this.digSndT -= dt;
          if (this.digSndT <= 0) { this.digSndT = 0.24; audio.dig(BLOCKS[bh.id].snd); }
          if (this.mineProgress >= 1) {
            this._doBreak(bh, info.drops);
            this.mineProgress = 0; this.mineTarget = null;
          } else {
            this.crack.visible = true;
            this.crack.position.copy(this.highlight.position);
            this.crack.material.map = this.crackTex[Math.min(9, (this.mineProgress * 10) | 0)];
          }
        }
      }
    } else { this.mineProgress = 0; this.mineTarget = null; }

    if (this.mouseR && this.placeCd <= 0) {
      this.placeCd = 0.24;
      if (bh) this._tryPlace(bh);
      else {
        const held = this.inv.held();
        if (held && ITEMS[held.id]?.food && this.meta.mode === 'survival' && this.player.eat(ITEMS[held.id].food)) {
          this.inv.consumeHeld(1); audio.eat(); this.swingT = 0.3;
        } else if (held?.id === I.bedroll) this._sleep();
      }
    }
  }

  // ------------------------------------------------------------ held item
  _refreshHeld() {
    const s = this.inv.held();
    const id = s ? s.id : 0;
    if (id === this._heldFor) return;
    this._heldFor = id;
    if (this.heldMesh) {
      this.heldGroup.remove(this.heldMesh);
      this.heldMesh.material?.dispose?.();
      this.heldMesh = null;
    }
    if (!id) return;
    this.heldMesh = buildDropMesh(id);
    if (isBlock(id) && !BLOCKS[id].cross) {
      this.heldMesh.scale.setScalar(1.05);
      this.heldMesh.position.set(0.5, -0.48, -0.82);
      this.heldMesh.rotation.set(0.12, Math.PI / 5, 0);
    } else {
      this.heldMesh.scale.setScalar(1.45);
      this.heldMesh.position.set(0.5, -0.44, -0.86);
      this.heldMesh.rotation.set(0.15, Math.PI - 0.5, 0.1);
    }
    this.heldGroup.add(this.heldMesh);
  }

  _updateHeld(dt) {
    this._refreshHeld();
    this.swingT = Math.max(0, this.swingT - dt);
    if (!this.heldMesh) return;
    const p = this.player;
    const bob = Math.sin(p.walkCycle * 2.2) * (p.onGround ? 0.018 : 0);
    const swing = Math.sin((1 - this.swingT / 0.3) * Math.PI) * (this.swingT > 0 ? 1 : 0);
    this.heldGroup.position.set(0, bob - swing * 0.16, swing * -0.1);
    this.heldGroup.rotation.x = -swing * 0.7;
    const l = this.world.lightAt(Math.floor(p.pos.x), Math.floor(p.pos.y + 1), Math.floor(p.pos.z));
    const day = this._lastDay ?? 1;
    const f = Math.max(0.22, Math.max(((l >> 4) & 15) * day, l & 15) / 15);
    const k = 0.3 + 0.7 * f;
    const mats = Array.isArray(this.heldMesh.material) ? this.heldMesh.material : [this.heldMesh.material];
    for (const m of mats) m.color?.setScalar(k * k);
  }

  // ------------------------------------------------------------ frame
  step(dt) {
    this.elapsed += dt;
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
    audio.update();

    // quality ladder: trade pixels for frame rate, never flap back and forth
    this._perfT = (this._perfT || 0) + dt;
    if (this._perfT > 6 && this.view === 'game' && !this.loading) {
      this._perfT = 0;
      const pr = this.renderer.getPixelRatio();
      if (this.fps < 40 && pr > 1) this.renderer.setPixelRatio(1);
      else if (this.fps < 26 && pr > 0.75) this.renderer.setPixelRatio(0.75);
    }

    if (this.view === 'title') {
      const c = this.titleCenter;
      const r = this.titleWorld.update(c.x, c.z, 4, 7);
      this.titleView.consume(this.titleWorld, r, 2);
      const st = dayState(0.16);
      this.titleView.setLight({ skyTint: st.skyTint, fogColor: new THREE.Color(...st.sky), fogNear: 50, fogFar: 95 });
      const a = this.elapsed * 0.05;
      this.camera.position.set(c.x + Math.sin(a) * 26, c.y + 13, c.z + Math.cos(a) * 26);
      this.camera.lookAt(c.x, c.y + 2, c.z);
      this.titleSky.update(0.16, this.camera, this.elapsed);
      this.titleScene.background = new THREE.Color(...st.sky);
      audio.ambient(dt, { day: 1, cave: false });
      this.renderer.render(this.titleScene, this.camera);
      return;
    }
    if (this.view !== 'game') return;

    const p = this.player;
    const dist = this.settings.dist;

    // stream the world; generous budget while the loading curtain is up
    const res = this.world.update(p.pos.x, p.pos.z, dist, this.loading ? 24 : 6);
    this.chunkView.consume(this.world, res, this.loading ? 8 : 2);

    if (this.loading) {
      const pcx = Math.floor(p.pos.x / CH), pcz = Math.floor(p.pos.z / CH);
      const ready = this.world.chunkAt(pcx, pcz)?.hasMesh;
      const remaining = this.world.pendingWork();
      $('loading-bar').style.width = Math.max(6, 100 - remaining * 2.2) + '%';
      if (ready && remaining < 18) {
        this.loading = false;
        $('loading').classList.remove('show');
        p.pos.y = Math.max(p.pos.y, this.world.surfaceY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 1.2);
        if (this._freshWorld && this.meta.mode === 'survival') this.mobs.seedAround(p.pos.x, p.pos.z);
        $('lock-hint').classList.add('show');
        audio.setMood(dayState(this.time).day > 0.4 ? 'day' : 'night');
        if (this._freshWorld) this.ui.toast(this.meta.mode === 'creative' ? 'Creative — double-tap SPACE to fly' : 'Punch a tree to begin');
      }
    }

    const overlayHold = this.paused || this.loading || this.ui.isOpen() || p.dead || this._sleeping;
    if (!overlayHold) {
      this.time = (this.time + dt / DAY_LEN) % 1;
      const wasWater = p.inWater;
      p.update(dt, this.locked ? this.input : { fwd: 0, back: 0, left: 0, right: 0, jump: 0, sneak: 0, sprint: 0 });
      if (!wasWater && p.inWater && p.vel.y < -3) audio.splash();
      // footsteps in rhythm with the walk cycle
      if (Math.floor(p.walkCycle / 1.9) !== this._stepMark) {
        this._stepMark = Math.floor(p.walkCycle / 1.9);
        const below = this.world.block(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.4), Math.floor(p.pos.z));
        if (below !== B.air) audio.step(BLOCKS[below].snd);
      }
      this.mobs.update(dt, p, this._lastDay ?? 1);
      const picked = this.drops.update(dt, p, this.inv, this._lastDay ?? 1);
      if (picked.length) audio.pop();
      this.particles.update(dt);
      this._interact(dt);
    }

    // sky, light, fog
    const st = this.sky.update(this.time, this.camera, this.elapsed);
    this._lastDay = st.day;
    const far = dist * CH;
    let fogColor = new THREE.Color(...st.sky);
    let fogNear = far * 0.55, fogFar = far * 0.98;
    if (p.headInWater) { fogColor = new THREE.Color(0.08, 0.22, 0.45).multiplyScalar(Math.max(0.25, st.day)); fogNear = 3; fogFar = 22; }
    this.chunkView.setLight({ skyTint: st.skyTint, fogColor, fogNear, fogFar });
    this.scene.background = fogColor;
    this.camera.far = far * 1.4;
    this.camera.updateProjectionMatrix();
    $('vignette').classList.toggle('water', p.headInWater);

    // camera follows the player's eyes
    this.camera.position.set(p.pos.x, p.pos.y + p.eye + (p.sprinting ? Math.sin(p.walkCycle * 2.2) * 0.04 : Math.sin(p.walkCycle * 2.2) * 0.025), p.pos.z);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;
    this._updateHeld(dt);

    // music mood: underground beats night beats day
    if (!this.loading) {
      const eyeL = this.world.lightAt(Math.floor(p.pos.x), Math.floor(p.pos.y + 1.5), Math.floor(p.pos.z));
      const cave = ((eyeL >> 4) & 15) < 2 && p.pos.y < 52;
      audio.setMood(cave ? 'cave' : st.day > 0.35 ? 'day' : 'night');
      audio.ambient(dt, { day: st.day, cave });
      audio.setUnderwater(p.headInWater);
    }

    this._saveT += dt;
    if (this._saveT > 12) { this._saveT = 0; this.saveGame(); }

    if (this.debugOn) {
      const biome = this.world.gen.biomeAt(Math.floor(p.pos.x), Math.floor(p.pos.z));
      const eyeL = this.world.lightAt(Math.floor(p.pos.x), Math.floor(p.pos.y + 1.5), Math.floor(p.pos.z));
      const hrs = (this.time * 24 + 6) % 24;
      this.ui.setDebug(
        `LOAM b${BUILD} · ${this.fps.toFixed(0)} fps\n` +
        `xyz ${p.pos.x.toFixed(1)} ${p.pos.y.toFixed(1)} ${p.pos.z.toFixed(1)} · ${biome}\n` +
        `time ${String(Math.floor(hrs)).padStart(2, '0')}:${String(Math.floor(hrs % 1 * 60)).padStart(2, '0')} · light sky ${(eyeL >> 4) & 15} block ${eyeL & 15}\n` +
        `chunks ${this.world.chunks.size} (queue ${this.world.pendingWork()}) · mobs ${this.mobs.list.length} · drops ${this.drops.list.length}`,
      );
    } else this.ui.setDebug('');

    this.renderer.render(this.scene, this.camera);
  }
}

new App();
