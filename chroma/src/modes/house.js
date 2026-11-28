// Home mode: your own house at Prism Heights. You wake up here unarmed, grab a
// weapon from the displays by the front door, buy furniture from the NEST & NOOK
// catalog on your laptop, arrange it in decorate mode, and head out to the plaza.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { Particles } from '../fx/particles.js';
import { Fighter } from '../actors/fighter.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { WEAPONS, posOf } from '../actors/weapons.js';
import { FURNITURE, FurnKit, WALLPAPERS, FLOORS } from '../world/furniture.js';
import {
  ROOM, SPAWN, DOOR, DOOR_FRONT, wallFrame, toWall, snap, footprint, rotLocal, snapFloor,
  canPlaceFloor, canPlaceOn, canPlaceWall, furnitureColliders, buildHouseLevel, buildShell, buildArmory, RESERVED_FLOOR,
} from '../world/house.js';
import { HouseUI } from '../ui/house.js';
import { clamp, damp, COLOR_PAIRS, disposeScene } from '../util.js';

const UNARMED = { ...WEAPONS.spritzer, id: null, name: 'Hands free', type: 'none', shieldHP: 0 };
const HALF_PI = Math.PI / 2;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ray = new THREE.Ray();
const otherInk = (ink) => COLOR_PAIRS.find((c) => c.a === ink)?.b || COLOR_PAIRS.find((c) => c.b === ink)?.a || '#3cf03c';

function disposeTree(o) {
  o.traverse((m) => {
    m.geometry?.dispose?.();
    const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mt of ms) if (!mt.userData?.shared && mt.name !== 'outline') mt.dispose?.();
  });
  o.parent?.remove(o);
}

export class House {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
  }

  get H() { return this.app.profile.house; }

  async init() {
    const app = this.app, prof = app.profile;
    try { await Promise.race([document.fonts?.load?.('48px "Lilita One"'), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fonts optional */ }
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.06, 1400);
    this.env = new Environment(scene, app.renderer, 'golden');
    this.env.hemi.intensity = 0.2;
    this.env.sun.intensity = 4.6;
    this.env.setShadowExtent(15.5);
    this.env.follow(new THREE.Vector3(0, 0, 0));
    scene.fog.density = 0.0022;
    const ink = prof.ink || '#ff2e88';
    this.colors = { 0: new THREE.Color(0xffffff), 1: new THREE.Color(ink), 2: new THREE.Color(otherInk(ink)) };
    this.kit = new FurnKit(ink);
    const low = app.qualityPreset === 'qa' || app.qualityPreset === 'low';
    this.shell = buildShell(scene, this.kit, { wall: this.H.wall, floor: this.H.floor, ink, lowLights: low });
    this.armory = buildArmory(scene, this.kit, { owned: prof.owned, ink });
    this.furnRoot = new THREE.Group(); this.furnRoot.name = 'furniture'; scene.add(this.furnRoot);
    this.inst = new Map();
    this.trash = [];
    const items = [...this.H.items].sort((a, b) => (a.on != null) - (b.on != null));
    for (const it of items) this.spawnItem(it);
    this.refreshBoxes();
    this.fx = new Particles(scene, 300);
    const world = this.world = {
      scene, level: null, paint: null, fx: this.fx, colors: this.colors, audio: app.audio, combat: null,
      fighters: [], listener: new THREE.Vector3(), combatOn: false, canRespawn: true, viewTeam: 1, chroma: 0.15,
    };
    this.rebuildLevel();
    const player = this.player = new Fighter(world, { name: prof.name, team: 1, look: prof.look, weapon: prof.weapon, isPlayer: true, color: this.colors[1] });
    player.canFight = false;
    world.fighters.push(player);
    this.held = null;
    this.setHeld(null, true);
    const sp = this.opts.from === 'plaza' ? SPAWN.plaza : SPAWN.title;
    player.place(sp.pos.clone(), sp.yaw);
    player.spawnPoint.copy(sp.pos); player.spawnYaw = sp.yaw;
    this.ensurePlayerFree();
    this.rig = new CameraRig(this.camera);
    this.rig.dist = 4.1;
    this.rig.snap(player, sp.yaw);
    this.control = new PlayerControl(app.input, this.rig);
    // DOM
    this.prompt = document.getElementById('prompt');
    this.toastEl = document.getElementById('toast');
    this.hud = document.getElementById('plaza-hud');
    this.fadeEl = document.getElementById('fade');
    this.coverSmall = document.querySelector('#plaza-cover small');
    this.coverText = this.coverSmall?.innerHTML;
    if (this.coverSmall) this.coverSmall.innerHTML = 'WASD move · SPACE jump · E interact · F decorate · ESC menu';
    this.ui = new HouseUI(this);
    this.deco = new Decorator(this);
    this.hud.classList.add('on');
    this.updateHud();
    this.time = 0;
    this.uiOpen = null;
    this.sitting = null;
    this.party = false;
    this.hitT = 0;
    this.tipT = 0;
    app.renderer.compile(scene, this.camera);
    app.audio?.music('shop');
  }

  // ---------------------------------------------------------------- furniture instances
  buildInst(id) {
    const def = FURNITURE[id];
    const wins = this.app.profile.stats?.wins || 0;
    const built = def.build(this.kit, { trophies: 1 + Math.floor(wins / 3) });
    const g = built.group;
    g.name = 'furn-' + id;
    return { it: null, def, group: g, update: built.update || null, state: { on: true, dirty: true, ...(built.state || {}) }, box: new THREE.Box3() };
  }

  spawnItem(it) {
    const inst = this.buildInst(it.id);
    inst.it = it;
    inst.state.on = !it.off;
    inst.group.userData.uid = it.uid;
    this.inst.set(it.uid, inst);
    this.placeGroup(inst);
    return inst;
  }

  placeGroup(inst) {
    const it = inst.it, g = inst.group;
    if (it.wall != null) {
      const f = wallFrame(it.wall);
      g.position.copy(f.at(it.x, it.y, 0.004)); g.rotation.set(0, f.yaw, 0);
      this.shell.walls[it.wall].add(g);
    } else if (it.on != null && this.inst.get(it.on)) {
      const p = this.inst.get(it.on);
      g.position.set(it.x, p.def.top, it.z); g.rotation.set(0, (it.r || 0) * HALF_PI, 0);
      p.group.add(g);
    } else {
      g.position.set(it.x, 0, it.z); g.rotation.set(0, (it.r || 0) * HALF_PI, 0);
      this.furnRoot.add(g);
    }
  }

  // removed furniture: out of the scene now, freed when we leave the house
  discard(group) { group.parent?.remove(group); this.trash.push(group); }

  refreshBoxes() {
    this.scene.updateMatrixWorld(true);
    for (const inst of this.inst.values()) inst.box.setFromObject(inst.group);
  }

  rebuildLevel() {
    const boxes = [...this.armory.colliders, ...furnitureColliders(this.H.items)];
    this.level?.dispose();
    this.level = buildHouseLevel(boxes);
    if (this.world) this.world.level = this.level;
    this.colliderRects = boxes;
  }

  // nudge the player out of any furniture they ended up inside
  ensurePlayerFree() {
    const p = this.player, R = ROOM;
    const blocked = (x, z) => {
      if (x < R.x0 + 0.45 || x > R.x1 - 0.45 || z < R.z0 + 0.45 || z > R.z1 - 0.45) return true;
      for (const b of this.colliderRects) if (b.max[1] > 0.45 && x > b.min[0] - 0.4 && x < b.max[0] + 0.4 && z > b.min[2] - 0.4 && z < b.max[2] + 0.4) return true;
      return false;
    };
    if (!blocked(p.pos.x, p.pos.z)) return;
    for (let r = 0.5; r < 12; r += 0.5) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = p.pos.x + Math.cos(a) * r, z = p.pos.z + Math.sin(a) * r;
        if (!blocked(x, z)) { p.place(new THREE.Vector3(x, 0, z), p.yaw); return; }
      }
    }
  }

  // ---------------------------------------------------------------- weapon in hand
  setHeld(id, silent = false) {
    const p = this.player, prof = this.app.profile;
    this.held = id;
    if (id) p.setWeapon(id);
    else { p.weapon = UNARMED; p.model.setWeapon(null); p.model.weaponType = 'none'; p.cancelWeapon(); }
    this.armory.setHeld(id);
    if (id && !silent) { prof.weapon = id; this.app.save(); }
    this.updateHud();
  }

  grab(slot) {
    const app = this.app, p = this.player;
    const c = slot.center;
    if (this.held === slot.id) {
      this.setHeld(null);
      this.toast(`Put the <b>${slot.def.name}</b> back`);
      app.audio?.sfx('goo_in', { volume: 0.5 });
    } else {
      const prev = this.held;
      this.setHeld(slot.id);
      const w = slot.def;
      this.toast(prev ? `Swapped to the <b>${w.name}</b>` : `Grabbed the <b>${w.name}</b>! Head out the front door.`);
      app.audio?.sfx('pickup', { volume: 0.7 });
      p.model.emote = 'pose'; this.poseT = 0.9;
    }
    this.fx.splash(_v.copy(c), _w.set(0, 1, 0), this.colors[1], 14, 3, 0.06);
  }

  // ---------------------------------------------------------------- HUD bits
  updateHud() {
    if (!this.hud) return;
    const p = this.app.profile, a = this.app;
    const w = this.held ? WEAPONS[this.held] : null;
    this.hud.innerHTML = `
      <div class="ph-card"><div class="ph-name">${p.name}</div><div class="ph-lvl">LV <b>${p.level}</b><div class="ph-xp"><i style="width:${Math.round(p.xp / a.xpFor(p.level) * 100)}%"></i></div></div></div>
      <div class="ph-coins"><span class="coin">◉</span> ${p.coins.toLocaleString()}</div>
      <div class="ph-weapon">${w ? w.name : '✋ Hands free'}</div>`;
  }

  toast(html) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => this.toastEl.classList.remove('on'), 2800);
  }

  welcome(created = false) {
    const n = this.app.profile.name;
    if (created) this.toast(`Welcome home, <b>${n}</b>! Your weapons are by the <b>front door</b>.`);
    else if (this.opts.from === 'plaza') this.toast('Home sweet home! Press <b>F</b> to decorate.');
    else this.toast(`Good morning, <b>${n}</b>! Grab a weapon by the door to head out.`);
    // no pointer-lock request here: a second request right after a menu's own lock()
    // cancels the first, which reads as "lock lost" and pops the pause menu
  }

  // ---------------------------------------------------------------- interactions
  nearest() {
    const p = this.player.pos;
    this.rig.forward(_w);
    _ray.set(this.camera.position, _w);
    let best = null, bs = Infinity;
    const flat = (a) => Math.hypot(p.x - a.x, p.z - a.z);
    for (const s of this.armory.slots) {
      if (!s.owned) continue;
      const dc = flat(s.center), df = flat(s.front);
      let score = Infinity;
      if (_ray.intersectBox(s.box, _v) && dc < 2.6) score = dc * 0.1;
      else if (df < 1.15) score = 1 + df;
      if (score < bs) {
        bs = score;
        const name = s.def.name;
        best = { kind: 'weapon', slot: s, label: this.held === s.id ? `Put back the <b>${name}</b>` : this.held ? `Swap for the <b>${name}</b>` : `Grab the <b>${name}</b>` };
      }
    }
    {
      const d = flat(DOOR_FRONT);
      const doorBox = new THREE.Box3(new THREE.Vector3(DOOR.x - DOOR.w / 2, 0, ROOM.z1 - 0.15), new THREE.Vector3(DOOR.x + DOOR.w / 2, DOOR.h, ROOM.z1));
      let score = Infinity;
      if (_ray.intersectBox(doorBox, _v) && d < 2.8) score = 0.15 + d * 0.1;
      else if (d < 1.3) score = 1 + d;
      if (score < bs) { bs = score; best = { kind: 'door', label: this.held ? 'Head out to <b>Prism Plaza</b>' : 'Leave the house' }; }
    }
    for (const inst of this.inst.values()) {
      const use = inst.def.use;
      if (!use || !inst.it) continue;
      const b = inst.box;
      const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
      const d = Math.hypot(dx, dz);
      let score = Infinity;
      if (_ray.intersectBox(b, _v) && d < 2.2 && _v.distanceTo(this.camera.position) > 0.5) score = 0.3 + d * 0.1;
      else if (d < 0.75) score = 1.2 + d;
      if (use === 'catalog') score -= 0.15; // the laptop wins over the chair in front of it
      if (score < bs) { bs = score; best = { kind: 'use', inst, label: this.useLabel(inst) }; }
    }
    return best;
  }

  useLabel(inst) {
    const n = inst.def.name, on = inst.state.on;
    switch (inst.def.use) {
      case 'sit': return `Sit on the <b>${n}</b>`;
      case 'sleep': return `Take a nap in the <b>${n}</b>`;
      case 'tv': return `Turn the TV <b>${on ? 'off' : 'on'}</b>`;
      case 'lamp': return `Switch the <b>${n}</b> ${on ? 'off' : 'on'}`;
      case 'mirror': return 'Check the <b>mirror</b> — change your look';
      case 'catalog': return 'Open the <b>NEST &amp; NOOK</b> catalog';
      case 'arcade': return 'Play <b>INK INVADERS</b>';
      case 'dj': return this.party ? 'Stop the <b>party</b>' : 'Start a <b>house party</b>!';
      case 'fridge': return 'Grab a <b>Fizzwater</b> soda';
      default: return `Use the <b>${n}</b>`;
    }
  }

  interact(it) {
    const app = this.app, p = this.player;
    if (it.kind === 'weapon') { this.grab(it.slot); return; }
    if (it.kind === 'door') {
      if (!this.held) {
        app.audio?.sfx('ui_error');
        this.toast('Grab your weapon first! They\'re on the wall by the door.');
        this.shell.openDoor(true); setTimeout(() => this.shell.openDoor(false), 160);
        this.nagT = 2.5;
        return;
      }
      this.leave();
      return;
    }
    const inst = it.inst, st = inst.state, def = inst.def;
    switch (def.use) {
      case 'sit': this.sitOn(inst); break;
      case 'sleep': this.nap(inst); break;
      case 'tv': case 'lamp':
        st.on = !st.on; st.dirty = true;
        if (st.on) delete inst.it.off; else inst.it.off = true;
        app.save();
        app.audio?.sfx('ui_select', { volume: 0.6 });
        break;
      case 'mirror': {
        const f = wallFrame(inst.it.wall);
        p.yaw = Math.atan2(f.n.x, f.n.z);
        this.openUI('salon');
        break;
      }
      case 'catalog': this.openCatalog(); break;
      case 'arcade': {
        const score = (Math.floor(Math.random() * 90) + 10) * 150;
        app.audio?.sfx('coin');
        this.toast(score > 12450 ? `<b>INK INVADERS</b> — NEW HIGH SCORE: <b>${score.toLocaleString()}</b>!` : `<b>INK INVADERS</b> — score ${score.toLocaleString()}. So close!`);
        p.model.emote = score > 12450 ? 'cheer' : 'think'; this.poseT = 1.6;
        break;
      }
      case 'dj': this.setParty(!this.party); break;
      case 'fridge':
        app.audio?.sfx('ink_full', { volume: 0.6 });
        this.toast('Glug glug… <b>Fizzwater</b>! Ahh, refreshing.');
        p.model.emote = 'cheer'; this.poseT = 1.0;
        break;
      default: break;
    }
  }

  setParty(on) {
    this.party = on;
    for (const inst of this.inst.values()) if (inst.def.use === 'dj') inst.state.on = on;
    this.app.audio?.music(on ? 'lobby' : 'shop');
    this.toast(on ? '🎶 <b>HOUSE PARTY!</b> Stand still to dance.' : 'Party\'s over. Back to chill.');
  }

  sitOn(inst) {
    const p = this.player, def = inst.def;
    inst.group.updateMatrixWorld(true);
    let best = null, bd = Infinity;
    for (const [sx, sz, sy] of def.seats || [[0, 0, def.h]]) {
      const wp = inst.group.localToWorld(new THREE.Vector3(sx, sy, sz));
      const d = wp.distanceTo(p.pos);
      if (d < bd) { bd = d; best = wp; }
    }
    const q = new THREE.Quaternion(); inst.group.getWorldQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const yaw = Math.atan2(fwd.x, fwd.z);
    this.sitting = { inst, stand: best.clone().addScaledVector(fwd, 0.85).setY(0), yaw };
    p.place(new THREE.Vector3(best.x, best.y - 0.36, best.z), yaw);
    p.onGround = true;
    p.model.emote = 'sit';
    this.app.audio?.sfx('land', { volume: 0.35 });
  }

  standUp() {
    const p = this.player, s = this.sitting;
    if (!s) return;
    this.sitting = null;
    p.model.emote = null;
    p.place(s.stand, s.yaw);
    this.ensurePlayerFree();
  }

  nap(inst) {
    const app = this.app;
    this.uiOpen = 'nap';
    this.fadeEl.classList.add('on');
    app.audio?.sfx('goo_in', { volume: 0.4 });
    this.toast('Zzz… 💤');
    setTimeout(() => {
      this.sitOn(inst);
      setTimeout(() => {
        this.fadeEl.classList.remove('on');
        this.uiOpen = null;
        this.toast('Rise and shine! You feel <b>super fresh</b>.');
        app.audio?.sfx('special_ready', { volume: 0.5 });
      }, 700);
    }, 900);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.uiOpen = 'leaving';
    this.prompt.classList.remove('on');
    this.shell.openDoor(true);
    this.app.audio?.sfx('door');
    setTimeout(() => this.fadeEl.classList.add('on'), 380);
    setTimeout(() => this.app.goPlaza(), 720);
  }

  // ---------------------------------------------------------------- menus
  openUI(kind, opts = {}) {
    const app = this.app, p = this.player, prof = app.profile;
    this.standUp();
    this.uiOpen = kind;
    app.input.unlock();
    this.prompt.classList.remove('on');
    this.hud.classList.remove('on');
    this.ui.hint('');
    const close = () => { this.uiOpen = null; this.showcase = false; p.model.emote = null; this.hud.classList.add('on'); this.updateHud(); app.input.lock(); };
    if (kind === 'salon' || kind === 'locker') {
      this.showcase = true;
      p.model.emote = null;
      const ink0 = prof.ink;
      app.menus.salon({
        create: !!opts.create,
        onChange: (look, ink) => {
          p.setLook({ ...prof.look, ...look });
          if (ink) { this.colors[1].set(ink); p.model.setTeamColor(this.colors[1]); }
        },
        onEmote: (e) => { if (e === 'tongue') { p.model.doTongue(); p.model.emote = null; } else p.model.emote = e; },
        onClose: () => {
          close();
          if (prof.ink !== ink0) this.refreshInk(prof.ink);
          this.updateHud();
          if (opts.create) this.welcome(true);
        },
      });
    }
  }

  openCatalog(startTab) {
    const app = this.app, prof = app.profile, H = this.H;
    const wasDeco = this.deco.active;
    if (!wasDeco) {
      this.standUp();
      this.uiOpen = 'catalog';
      app.input.unlock();
      this.prompt.classList.remove('on');
      this.ui.hint('');
    } else this.deco.tray?.show(false);
    app.audio?.sfx('ui_select');
    const done = () => {
      if (this.deco.active) { this.deco.tray?.show(true); this.deco.tray?.render(); return; }
      this.uiOpen = null; this.updateHud(); app.input.lock();
    };
    this.ui.catalog({
      startTab,
      onBuy: (id) => {
        const d = FURNITURE[id];
        if (prof.coins < d.price) return false;
        prof.coins -= d.price;
        H.owned[id] = (H.owned[id] || 0) + 1;
        app.save(); this.updateHud();
        this.toast(`<b>${d.name}</b> is in your storage. Press <b>F</b> to place it!`);
        return true;
      },
      onBuyStyle: (kind, id) => {
        const d = (kind === 'wall' ? WALLPAPERS : FLOORS)[id];
        if (prof.coins < d.price) return false;
        prof.coins -= d.price;
        (kind === 'wall' ? H.walls : H.floors).push(id);
        this.applyStyle(kind, id);
        this.updateHud();
        return true;
      },
      onApplyStyle: (kind, id) => this.applyStyle(kind, id),
      onPlace: (id) => { if (this.deco.active) { this.deco.tray?.show(true); this.deco.pickNew(id); } else { this.uiOpen = null; this.deco.enter(id); } },
      onDecorate: () => { if (this.deco.active) done(); else { this.uiOpen = null; this.deco.enter(); } },
      onClose: done,
    });
  }

  applyStyle(kind, id) {
    const H = this.H;
    if (kind === 'wall') { H.wall = id; this.shell.setWallpaper(id); } else { H.floor = id; this.shell.setFloor(id); }
    this.app.save();
  }

  // a new ink color: rebuild everything that is painted in it
  refreshInk(ink) {
    this.colors[1].set(ink); this.colors[2].set(otherInk(ink));
    this.player.model.setTeamColor(this.colors[1]);
    const oldKit = this.kit;
    this.kit = new FurnKit(ink);
    this.ui.setKit(this.kit);
    disposeTree(this.armory.root);
    this.armory = buildArmory(this.scene, this.kit, { owned: this.app.profile.owned, ink });
    this.armory.setHeld(this.held);
    for (const inst of this.inst.values()) this.trash.push(inst.group);
    for (const g of this.trash) disposeTree(g);
    this.trash = [];
    this.inst.clear();
    const items = [...this.H.items].sort((a, b) => (a.on != null) - (b.on != null));
    for (const it of items) this.spawnItem(it);
    this.shell.setWallpaper(this.H.wall, ink);
    oldKit.dispose();
    this.refreshBoxes();
    this.rebuildLevel();
  }

  openPause() {
    const app = this.app, inp = app.input;
    if (this.uiOpen || this.deco.active || this.leaving) return;
    this.standUp();
    inp.unlock();
    this.uiOpen = 'pause';
    app.menus.pause(true, {
      onResume: () => { this.uiOpen = null; inp.lock(); },
      onQuit: () => { this.uiOpen = null; app.goTitle(); },
      quitLabel: 'BACK TO TITLE',
    });
  }

  onLockLost() { this.openPause(); }

  // ---------------------------------------------------------------- loop
  update(dt) {
    const app = this.app, inp = app.input, p = this.player, w = this.world;
    this.time += dt;
    const I = p.intent;
    let active = false;
    if (this.deco.active) {
      I.mx = I.mz = 0; I.jump = false;
      this.deco.update(dt);
    } else if (this.uiOpen) {
      I.mx = I.mz = 0; I.jump = false;
      if (this.showcase) {
        const yaw = p.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx, side = -1.05, dist = 3.0;
        _v.set(p.pos.x + fx * dist - rx * side, p.pos.y + 1.25, p.pos.z + fz * dist - rz * side);
        this.camera.position.lerp(_v, damp(5, dt));
        this.camera.lookAt(p.pos.x - rx * side, p.pos.y + 0.95, p.pos.z - rz * side);
      } else if (this.uiOpen !== 'nap') this.control.update(dt, p, w, false);
    } else if (this.sitting) {
      this.control.update(dt, p, w, true);
      const mv = inp.move();
      if (Math.hypot(mv.x, mv.y) > 0.4 || inp.action('jump') || inp.action('interact')) this.standUp();
      if (!inp.locked && inp.mousePressed[0]) inp.lock();
      if (inp.action('pause')) this.openPause();
      this.prompt.innerHTML = `<span class="key">${inp.usingPad ? 'L' : 'W'}</span> Stand up`;
      this.prompt.classList.add('on');
      active = true;
    } else {
      active = true;
      this.control.update(dt, p, w, true);
      I.fire = I.goo = I.sub = I.special = false;
      if (inp.action('fire') && inp.locked && this.held && this.time > (this.tipT || 0)) { this.tipT = this.time + 5; this.toast('No painting indoors! Save it for the plaza.'); }
      if (inp.pressed('KeyT')) { p.model.doTongue(); app.audio?.sfx('tongue', { ...posOf(p.pos), volume: 0.6 }); }
      if (!inp.locked && inp.mousePressed[0]) inp.lock();
      const it = this.nearest();
      this.near = it;
      this.armory.highlight(it?.kind === 'weapon' ? it.slot : (!this.held && (this.nagT > 0 || p.pos.z > 2.5)) ? this.armory.slots.find((s) => s.owned && s.id === app.profile.weapon) || this.armory.slots.find((s) => s.owned) : null);
      if (it) {
        this.prompt.innerHTML = `<span class="key">${inp.usingPad ? 'X' : 'E'}</span> ${it.label}`;
        this.prompt.classList.add('on');
        if (inp.action('interact')) this.interact(it);
      } else this.prompt.classList.remove('on');
      if (inp.pressed('KeyF') || inp.padPressed(3)) this.deco.enter();
      else if (inp.action('pause')) this.openPause();
    }
    this.nagT = Math.max(0, (this.nagT || 0) - dt);
    if (!active || this.deco.active) this.armory.highlight(null);
    // emotes: pose after grabbing, dance at a party
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (!this.sitting && !this.uiOpen) {
      if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0 || hs > 0.5) { this.poseT = 0; p.model.emote = null; } }
      else if (this.party && hs < 0.3) p.model.emote = 'dance';
      else if (p.model.emote === 'dance') p.model.emote = null;
    }
    if (this.sitting) { p.onGround = true; p.syncModel(dt, false, 0); } else p.update(dt);
    // the hint bar
    const hint = active && !this.sitting ? `<b>E</b> interact · <b>F</b> decorate · <b>ESC</b> menu${this.held ? '' : ' · <span class="hh-tip">Your weapons are by the front door</span>'}` : '';
    this.ui.hint(this.deco.active ? '' : hint);
    this.ui.update();
    // world
    const ctx = { party: this.party };
    for (const inst of this.inst.values()) if (inst.update) inst.update(this.time, dt, inst.state, ctx);
    this.shell.update(this.time, dt, this.camera.position);
    this.armory.update(this.time);
    this.fx.update(dt);
    this.env.update(dt);
    w.listener.copy(this.camera.position);
    const camYaw = Math.atan2(-this.camera.matrixWorld.elements[8], -this.camera.matrixWorld.elements[10]);
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, camYaw + Math.PI);
    const ret = document.getElementById('plaza-reticle');
    ret.classList.toggle('on', active && inp.locked);
    ret.classList.remove('hit');
    document.getElementById('plaza-cover').classList.toggle('on', active && !inp.locked && !inp.usingPad && !this.leaving);
  }

  render(dt) { this.app.post.render(this.scene, this.camera, dt); }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  dispose() {
    this.deco.dispose();
    this.ui.dispose();
    if (this.party) this.party = false;
    this.player.dispose();
    this.fx.dispose();
    this.level?.dispose();
    this.env.dispose();
    for (const g of this.trash) disposeTree(g);
    this.prompt.classList.remove('on');
    this.hud.classList.remove('on');
    this.fadeEl.classList.remove('on');
    if (this.coverSmall && this.coverText != null) this.coverSmall.innerHTML = this.coverText;
    document.getElementById('plaza-reticle').classList.remove('on');
    document.getElementById('plaza-cover').classList.remove('on');
    disposeScene(this.scene);
    this.kit.dispose();
  }
}

// ======================================================================
// Decorate mode: an overhead diorama camera with cut-away walls, a floor grid,
// a storage tray, and a pick-up / move / rotate / put-away editor with a
// green-or-red placement ghost.
class Decorator {
  constructor(house) {
    this.h = house;
    this.app = house.app;
    this.active = false;
    this.mouse = new THREE.Vector2(0, -0.2);
    this.overCanvas = false;
    this.ray = new THREE.Raycaster();
    this.cam = { yaw: Math.PI / 4, yawT: Math.PI / 4, pitch: 0.92, dist: 18, distT: 18, target: new THREE.Vector3(0, 0, 0.4) };
    this.cut = [false, false, false, false];
    this.hold = null;
    this.hover = null;
    const sc = house.scene;
    this.ghostOK = new THREE.MeshStandardMaterial({ color: 0x6dffa8, emissive: 0x1d9a55, emissiveIntensity: 0.8, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.5 });
    this.ghostBad = new THREE.MeshStandardMaterial({ color: 0xff6d7a, emissive: 0xa31d2b, emissiveIntensity: 0.8, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.5 });
    this.foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3cf07c, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    this.foot.visible = false; this.foot.renderOrder = 3; sc.add(this.foot);
    this.grid = this.makeGrid(); this.grid.visible = false; sc.add(this.grid);
    this.hoverBox = new THREE.Box3Helper(new THREE.Box3(), 0xffd21a); this.hoverBox.visible = false; sc.add(this.hoverBox);
    this.cursorEl = null;
    this.vc = { x: innerWidth / 2, y: innerHeight / 2 };
    this.onMove = (e) => {
      const r = this.app.canvas.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.overCanvas = e.target === this.app.canvas;
      this.padCursor = false;
    };
    this.onDown = (e) => {
      if (!this.active || this.h.ui.catalogOpen()) return;
      this.onMove(e);
      if (e.button === 0) this.click();
      else if (e.button === 2) this.rotate();
    };
  }

  makeGrid() {
    const R = ROOM, PX = 48;
    const W = (R.x1 - R.x0) * PX, D = (R.z1 - R.z0) * PX;
    const c = document.createElement('canvas'); c.width = W; c.height = D;
    const x = c.getContext('2d');
    for (const [x0, z0, x1, z1] of RESERVED_FLOOR) {
      const px = (x0 - R.x0) * PX, pz = (z0 - R.z0) * PX, pw = (x1 - x0) * PX, pd = (z1 - z0) * PX;
      x.fillStyle = 'rgba(255,70,90,0.22)'; x.fillRect(px, pz, pw, pd);
      x.save(); x.beginPath(); x.rect(px, pz, pw, pd); x.clip();
      x.strokeStyle = 'rgba(255,70,90,0.45)'; x.lineWidth = 4;
      for (let k = -pd; k < pw; k += 22) { x.beginPath(); x.moveTo(px + k, pz + pd); x.lineTo(px + k + pd, pz); x.stroke(); }
      x.restore();
    }
    for (let i = 0; i <= (R.x1 - R.x0) * 2; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.55)'; x.fillRect(i * PX / 2 - (i % 2 ? 1 : 1.5), 0, i % 2 ? 2 : 3, D); }
    for (let i = 0; i <= (R.z1 - R.z0) * 2; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.55)'; x.fillRect(0, i * PX / 2 - (i % 2 ? 1 : 1.5), W, i % 2 ? 2 : 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set((R.x0 + R.x1) / 2, 0.03, (R.z0 + R.z1) / 2); m.renderOrder = 1;
    return m;
  }

  // ------------------------------------------------------------ enter / exit
  enter(pickId = null) {
    if (this.active) return;
    const h = this.h, app = this.app;
    h.standUp();
    this.active = true;
    app.input.unlock();
    h.prompt.classList.remove('on');
    // start from the view direction the player was already looking
    const off = h.rig.yaw + Math.PI;
    const k = Math.round((off - Math.PI / 4) / HALF_PI);
    this.cam.yaw = this.cam.yawT = Math.PI / 4 + k * HALF_PI;
    this.cam.target.set(clamp(h.player.pos.x * 0.4, -5, 5), 0, clamp(h.player.pos.z * 0.4, -3, 3));
    this.grid.visible = true;
    this.tray = h.ui.decoTray({
      onPick: (id) => this.pickNew(id),
      onStyle: (kind, id) => h.applyStyle(kind, id),
      onCatalog: () => { this.cancel(); h.openCatalog(); },
      onDone: () => this.exit(),
    });
    addEventListener('pointermove', this.onMove);
    app.canvas.addEventListener('pointerdown', this.onDown);
    this.cursorEl = document.createElement('div'); this.cursorEl.id = 'house-cursor'; document.body.appendChild(this.cursorEl);
    app.audio?.sfx('ui_select');
    h.toast('Decorate mode — click furniture to move it, or pick from storage.');
    if (pickId) this.pickNew(pickId);
  }

  exit() {
    if (!this.active) return;
    const h = this.h, app = this.app;
    this.cancel();
    this.active = false;
    removeEventListener('pointermove', this.onMove);
    app.canvas.removeEventListener('pointerdown', this.onDown);
    app.canvas.style.cursor = '';
    this.cursorEl?.remove(); this.cursorEl = null;
    this.grid.visible = false; this.foot.visible = false; this.hoverBox.visible = false;
    this.setCut([false, false, false, false]);
    this.tray?.close(); this.tray = null;
    h.ui._catClose?.();
    h.rebuildLevel();
    h.ensurePlayerFree();
    h.refreshBoxes();
    h.rig.snap(h.player, h.rig.yaw);
    h.uiOpen = null;
    h.updateHud();
    app.save();
    app.audio?.sfx('ui_back');
    app.input.lock();
  }

  setCut(cut) {
    const changed = cut.some((c, i) => c !== this.cut[i]);
    if (!changed) return;
    this.cut = cut;
    const any = cut.some(Boolean);
    this.h.shell.setCutaway(any ? cut : null);
    for (const w of [2, 3]) this.h.armory.wallGroups[w].visible = !cut[w];
  }

  // ------------------------------------------------------------ holding
  ghost(group, mat) {
    group.traverse((m) => {
      if (!m.isMesh) return;
      if (mat) { if (!m.userData.mat0) m.userData.mat0 = m.material; m.material = mat; m.castShadow = false; }
      else if (m.userData.mat0) { m.material = m.userData.mat0; delete m.userData.mat0; m.castShadow = true; }
    });
  }

  pick(inst) {
    const h = this.h;
    this.cancel();
    const it = inst.it;
    let r = it.r || 0;
    if (it.on != null) { const par = h.inst.get(it.on); r = ((par?.it.r || 0) + r) % 4; }
    this.hold = { inst, it, def: inst.def, uid: it.uid, r, place: null };
    h.furnRoot.attach(inst.group);
    this.ghost(inst.group, this.ghostOK);
    this.app.audio?.sfx('ui_move');
  }

  pickNew(id) {
    const h = this.h;
    this.cancel();
    const H = h.H;
    if ((H.owned[id] || 0) - H.items.filter((i) => i.id === id).length <= 0) return;
    const inst = h.buildInst(id);
    h.furnRoot.add(inst.group);
    this.hold = { inst, it: null, def: inst.def, uid: -1, r: 0, place: null };
    this.ghost(inst.group, this.ghostOK);
    this.app.audio?.sfx('ui_move');
  }

  cancel() {
    const hold = this.hold;
    if (!hold) return;
    this.hold = null;
    this.foot.visible = false;
    if (!hold.it) { this.h.discard(hold.inst.group); return; }
    this.ghost(hold.inst.group, null);
    this.h.placeGroup(hold.inst);
    this.h.refreshBoxes();
  }

  rotate() {
    const h = this.h, H = h.H;
    if (this.hold) {
      if (this.hold.def.kind === 'wall') return;
      this.hold.r = (this.hold.r + 1) % 4;
      this.app.audio?.sfx('ui_move');
      return;
    }
    const inst = this.hover;
    if (!inst || inst.it.wall != null) return;
    const it = inst.it;
    const nr = ((it.r || 0) + 1) % 4;
    let ok;
    if (it.on != null) ok = canPlaceOn(H.items, inst.def, h.inst.get(it.on).it, it.x, it.z, nr, it.uid);
    else ok = canPlaceFloor(H.items, inst.def, it.x, it.z, nr, it.uid);
    if (!ok) { this.app.audio?.sfx('ui_error'); h.toast('Not enough room to turn it there.'); return; }
    it.r = nr;
    h.placeGroup(inst);
    h.refreshBoxes();
    this.app.save();
    this.app.audio?.sfx('ui_select');
  }

  putAway(inst) {
    const h = this.h, H = h.H;
    if (!inst) return;
    if (inst.def.fixed) { this.app.audio?.sfx('ui_error'); h.toast(`The <b>${inst.def.name}</b> stays — it's where your laptop lives!`); return; }
    if (this.hold && this.hold.inst === inst) { this.hold = null; this.foot.visible = false; if (!inst.it) { h.discard(inst.group); return; } }
    const kids = [...h.inst.values()].filter((o) => o.it.on === inst.it.uid);
    for (const o of [inst, ...kids]) {
      const i = H.items.indexOf(o.it);
      if (i >= 0) H.items.splice(i, 1);
      h.inst.delete(o.it.uid);
    }
    h.discard(inst.group);
    if (this.hover === inst || kids.includes(this.hover)) this.hover = null;
    h.refreshBoxes();
    this.app.save();
    this.tray?.render();
    this.app.audio?.sfx('goo_in', { volume: 0.5 });
    h.toast(`Put the <b>${inst.def.name}</b> in storage${kids.length ? ` (+${kids.length} on top)` : ''}`);
  }

  click() {
    if (this.hold) { this.commit(); return; }
    if (this.hover) this.pick(this.hover);
  }

  commit() {
    const h = this.h, H = h.H, hold = this.hold, pl = hold.place;
    if (!pl || !pl.valid) { this.app.audio?.sfx('ui_error'); return; }
    let it = hold.it;
    if (!it) {
      it = { uid: H.nextUid++, id: hold.def.id };
      H.items.push(it);
      hold.inst.it = it;
      hold.inst.group.userData.uid = it.uid;
      h.inst.set(it.uid, hold.inst);
    }
    for (const k of ['on', 'wall', 'y', 'z', 'r']) delete it[k];
    it.x = pl.x;
    if (pl.wall != null) { it.wall = pl.wall; it.y = pl.y; }
    else { it.z = pl.z; it.r = pl.r; if (pl.on != null) it.on = pl.on; }
    this.ghost(hold.inst.group, null);
    h.placeGroup(hold.inst);
    const g = hold.inst.group;
    g.scale.setScalar(1.12); this.pop = { g, t: 0 };
    this.hold = null;
    this.foot.visible = false;
    h.refreshBoxes();
    this.tray?.render();
    this.app.save();
    this.app.audio?.sfx('land', { volume: 0.5 });
    this.app.audio?.sfx('ui_select', { volume: 0.5 });
  }

  // where would the held item go under the cursor?
  solve() {
    const h = this.h, H = h.H, hold = this.hold, def = hold.def;
    const ray = this.ray.ray;
    if (def.kind === 'wall') {
      let best = null;
      for (let w = 0; w < 4; w++) {
        if (this.cut[w]) continue;
        const f = wallFrame(w);
        if (ray.direction.dot(f.n) >= 0) continue;
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(f.n, f.at(0, 0, 0));
        const pt = ray.intersectPlane(plane, new THREE.Vector3());
        if (!pt) continue;
        const { u } = toWall(w, pt);
        if (u < f.u0 - 0.6 || u > f.u1 + 0.6 || pt.y < -0.5 || pt.y > ROOM.h + 0.8) continue;
        const t = pt.distanceTo(ray.origin);
        if (!best || t < best.t) best = { w, u, y: pt.y, t };
      }
      if (!best) return null;
      const f = wallFrame(best.w);
      const u = clamp(snap(best.u, 0.25), f.u0 + def.w / 2 + 0.05, f.u1 - def.w / 2 - 0.05);
      const y = clamp(snap(best.y, 0.25), def.h / 2 + 0.15, ROOM.h - def.h / 2 - 0.12);
      return { wall: best.w, x: u, y, valid: canPlaceWall(H.items, def, best.w, u, y, hold.uid) };
    }
    if (def.kind === 'small') {
      let best = null;
      for (const inst of h.inst.values()) {
        const it = inst.it, pd = inst.def;
        if (!pd.top || it.on != null || it.wall != null || it.uid === hold.uid) continue;
        const pt = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -pd.top), new THREE.Vector3());
        if (!pt) continue;
        const yaw = (it.r || 0) * HALF_PI;
        const [lx, lz] = rotLocal(pt.x - it.x, pt.z - it.z, -yaw);
        if (Math.abs(lx) > pd.w / 2 + 0.05 || Math.abs(lz) > pd.d / 2 + 0.05) continue;
        const t = pt.distanceTo(ray.origin);
        if (!best || t < best.t) best = { inst, lx, lz, t };
      }
      if (best) {
        const pi = best.inst, pd = pi.def;
        const lr = ((hold.r - (pi.it.r || 0)) % 4 + 4) % 4;
        const [fw, fd] = footprint(def, lr);
        const x = clamp(snap(best.lx, 0.25), -pd.w / 2 + fw / 2, pd.w / 2 - fw / 2);
        const z = clamp(snap(best.lz, 0.25), -pd.d / 2 + fd / 2, pd.d / 2 - fd / 2);
        return { on: pi.it.uid, x, z, r: lr, valid: canPlaceOn(H.items, def, pi.it, x, z, lr, hold.uid) };
      }
    }
    const pt = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!pt) return null;
    const [x, z] = snapFloor(def, pt.x, pt.z, hold.r);
    return { x, z, r: hold.r, valid: canPlaceFloor(H.items, def, x, z, hold.r, hold.uid) };
  }

  showHold() {
    const hold = this.hold, pl = hold.place, g = hold.inst.group, def = hold.def, foot = this.foot;
    if (!pl) { g.visible = false; foot.visible = false; return; }
    g.visible = true;
    this.ghost(g, pl.valid ? this.ghostOK : this.ghostBad);
    foot.material.color.set(pl.valid ? 0x3cf07c : 0xff4d5e);
    foot.visible = true;
    if (pl.wall != null) {
      const f = wallFrame(pl.wall);
      g.position.copy(f.at(pl.x, pl.y, 0.004)); g.rotation.set(0, f.yaw, 0);
      foot.position.copy(f.at(pl.x, pl.y, 0.015)); foot.rotation.set(0, f.yaw, 0); foot.scale.set(def.w, def.h, 1);
    } else {
      let x = pl.x, z = pl.z, y = 0, yaw = pl.r * HALF_PI;
      if (pl.on != null) {
        const par = this.h.inst.get(pl.on);
        const py = (par.it.r || 0) * HALF_PI;
        const [dx, dz] = rotLocal(pl.x, pl.z, py);
        x = par.it.x + dx; z = par.it.z + dz; y = par.def.top; yaw = py + pl.r * HALF_PI;
      }
      g.position.set(x, y + 0.02, z); g.rotation.set(0, yaw, 0);
      const [fw, fd] = footprint(def, Math.round(yaw / HALF_PI) % 4 + 4);
      foot.position.set(x, y + 0.035, z); foot.rotation.set(-Math.PI / 2, 0, 0); foot.scale.set(fw, fd, 1);
    }
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    const h = this.h, app = this.app, inp = app.input, cam = this.cam;
    if (h.ui.catalogOpen()) { this.placeCamera(dt); return; }
    // camera controls
    if (inp.pressed('KeyQ') || inp.padPressed(4)) cam.yawT -= HALF_PI;
    if (inp.pressed('KeyE') || inp.padPressed(5)) cam.yawT += HALF_PI;
    if (inp.wheel) cam.distT = clamp(cam.distT + inp.wheel * 1.6, 8, 28);
    const zs = inp.axis(3); if (zs) cam.distT = clamp(cam.distT + zs * dt * 14, 8, 28);
    const kx = (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0) - (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0);
    const ky = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0);
    if (kx || ky) {
      const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
      const sp = dt * 9 * (cam.dist / 20);
      cam.target.x = clamp(cam.target.x + (cy * kx - sy * ky) * sp, -9, 9);
      cam.target.z = clamp(cam.target.z + (-sy * kx - cy * ky) * sp, -6, 6);
    }
    this.placeCamera(dt);
    // gamepad: the left stick drives an on-screen cursor
    const px = inp.axis(0), py = inp.axis(1);
    if (inp.usingPad && (px || py)) {
      this.padCursor = true;
      this.vc.x = clamp(this.vc.x + px * dt * 700, 0, innerWidth); this.vc.y = clamp(this.vc.y + py * dt * 700, 0, innerHeight);
    }
    let padEl = null;
    if (this.padCursor) {
      this.mouse.set((this.vc.x / innerWidth) * 2 - 1, -(this.vc.y / innerHeight) * 2 + 1);
      padEl = document.elementFromPoint(this.vc.x, this.vc.y);
      this.overCanvas = padEl === app.canvas;
    }
    if (this.cursorEl) { this.cursorEl.style.display = this.padCursor ? 'block' : 'none'; this.cursorEl.style.transform = `translate(${this.vc.x}px, ${this.vc.y}px)`; }
    this.ray.setFromCamera(this.mouse, h.camera);
    // keys
    if (inp.pressed('KeyR') || inp.padPressed(3)) this.rotate();
    if (inp.pressed('KeyX') || inp.pressed('Delete') || inp.pressed('Backspace') || inp.padPressed(2)) this.putAway(this.hold ? this.hold.inst : this.hover);
    if (inp.padPressed(0)) {
      // the pad cursor can press the storage tray's buttons too
      const btn = padEl?.closest?.('#house-deco button');
      if (btn) btn.click(); else this.click();
    }
    if (inp.pressed('Escape') || inp.padPressed(1)) { if (this.hold) this.cancel(); else { this.exit(); return; } }
    if (inp.pressed('KeyF') || inp.padPressed(9)) { this.exit(); return; }
    // hover / hold
    let help;
    if (this.hold) {
      if (this.overCanvas) this.hold.place = this.solve();
      this.showHold();
      this.hover = null; this.hoverBox.visible = false;
      const pl = this.hold.place;
      help = `Placing <b>${this.hold.def.name}</b> — click to place · <b>R</b> rotate · <b>X</b> store · <b>ESC</b> cancel${pl && !pl.valid ? ' · <span class="bad">No room there</span>' : ''}`;
      app.canvas.style.cursor = 'grabbing';
    } else {
      this.hover = null;
      if (this.overCanvas) {
        const groups = [];
        for (const inst of h.inst.values()) if (inst.group.parent && inst.group.visible) groups.push(inst.group);
        const hits = this.ray.intersectObjects(groups, true);
        for (const hit of hits) {
          let o = hit.object;
          while (o && o.userData.uid == null) o = o.parent;
          if (!o) continue;
          let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false;
          if (!vis) continue;
          this.hover = h.inst.get(o.userData.uid) || null;
          if (this.hover) break;
        }
      }
      if (this.hover) {
        this.hoverBox.box.setFromObject(this.hover.group);
        this.hoverBox.visible = true;
        help = `<b>${this.hover.def.name}</b> — click to move · <b>R</b> rotate · <b>X</b> put in storage`;
        app.canvas.style.cursor = 'grab';
      } else {
        this.hoverBox.visible = false;
        help = 'Click furniture to move it · pick from storage below · <b>Q</b>/<b>E</b> turn view · <b>wheel</b> zoom · <b>WASD</b> pan';
        app.canvas.style.cursor = '';
      }
    }
    if (this.pop) { this.pop.t += dt; const k = Math.min(1, this.pop.t / 0.18); this.pop.g.scale.setScalar(1 + (1 - k) * 0.12); if (k >= 1) this.pop = null; }
    this.tray?.help(help);
  }

  placeCamera(dt) {
    const cam = this.cam, c = this.h.camera;
    cam.yaw += (cam.yawT - cam.yaw) * damp(9, dt);
    cam.dist += (cam.distT - cam.dist) * damp(9, dt);
    const cp = Math.cos(cam.pitch);
    const dx = Math.sin(cam.yaw), dz = Math.cos(cam.yaw);
    // aim a little in front of the target so the room sits above the storage tray
    const tx = cam.target.x + dx * 2.2, tz = cam.target.z + dz * 2.2;
    _v.set(tx + dx * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, tz + dz * cp * cam.dist);
    c.position.lerp(_v, damp(10, dt));
    c.lookAt(tx, 0.6, tz);
    const outward = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    this.setCut(outward.map(([ox, oz]) => ox * dx + oz * dz > 0.2));
  }

  dispose() {
    if (this.active) {
      removeEventListener('pointermove', this.onMove);
      this.app.canvas.removeEventListener('pointerdown', this.onDown);
      this.app.canvas.style.cursor = '';
      this.cursorEl?.remove();
      this.tray?.close();
    }
    if (this.hold && !this.hold.it) this.h.discard(this.hold.inst.group);
    this.active = false;
  }
}

