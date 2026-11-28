// Clash Tower interior: walk the floors, ride the glass elevator up and down
// the atrium, and use each floor's terminal to pick your match. The lobby's
// south doors lead back out to Prism Plaza.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { buildTower, TOWER_FLOORS, floorY, FLOOR_H, CAR, WELL, SHAFT_TOP } from '../world/tower.js';
import { currentRotation } from '../world/rotation.js';
import { Particles } from '../fx/particles.js';
import { Combat, posOf } from '../actors/weapons.js';
import { Fighter } from '../actors/fighter.js';
import { randomLook } from '../actors/gear.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { NPC } from './plaza.js';
import { damp, clamp, pick, COLOR_PAIRS, disposeScene } from '../util.js';

const STAFF = [
  { floor: 0, name: 'Mira', pos: [0, 0, -12.9], yaw: 0, lines: ['Welcome to the Clash Tower! Take the glass elevator to pick a match.', 'Floor <b>2</b> is Open Battle: online matches with players from everywhere.', 'Floor <b>3</b> has the private rooms. Make a room and give your friends the code!', 'Want to warm up? The CPU Battle terminal is right here in the lobby.', 'Up top is the <b>Sky Deck</b>. Best view in the city, and an arcade!'] },
  { floor: 1, name: 'Zap', pos: [-3.2, 0, 10.4], yaw: Math.PI * 0.85, lines: ['The queue never sleeps. Somebody\'s always looking for a match!', 'While you wait you can play <b>Tongue Snack</b>. My best is 212.', 'If nobody shows up, CPUs fill the empty seats. No waiting forever!'] },
  { floor: 2, name: 'Pim', pos: [3.2, 0, 10.4], yaw: -Math.PI * 0.85, lines: ['Create a room, then read your friends the 4-letter code.', 'The host picks the stage, time, mode and teams. Very fancy.', 'After a match, hit <b>Back to room</b> and go again with the same crew.'] },
  { floor: 3, name: 'Torque', pos: [-3.2, 0, 10.4], yaw: Math.PI * 0.85, lines: ['Zone Clash! Ink the zones and hold them to run your counter down.', 'Losing the zone hurts. Take it back fast!'] },
  { floor: 4, name: 'Swish', pos: [3.2, 0, 10.4], yaw: -Math.PI * 0.85, lines: ['Hue Hoops: grab the Glowball, paint the enemy hoop pad to break its shield, then shoot!', 'A shot is 2, a dunk is 3. Jump at the rim while you carry the ball!'] },
  { floor: 5, name: 'Gazer', pos: [-11, 0, -10.6], yaw: Math.PI * 0.75, lines: ['You can see the whole city from up here. Is that the plaza fountain?', 'The arcade has Tongue Snack. Same game as the queue, but bragging rights are real.'] },
];

export class Tower {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
  }

  async init() {
    const app = this.app;
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 1500);
    this.env = new Environment(scene, app.renderer, 'golden');
    this.env.hemi.intensity = 0.95; // interiors: lift the shadows (no point lights, for speed)
    const tw = this.tw = buildTower(scene, app.renderer, this.env);
    const prof = app.profile;
    const inkHex = prof.ink || '#ff2e88';
    const other = COLOR_PAIRS.find((c) => c.a === inkHex)?.b || COLOR_PAIRS.find((c) => c.b === inkHex)?.a || '#3cf03c';
    this.colors = { 0: new THREE.Color(0xffffff), 1: new THREE.Color(inkHex), 2: new THREE.Color(other) };
    tw.paint.setColors(this.colors[1], this.colors[2]);
    this.fx = new Particles(scene, 400);
    const world = this.world = {
      scene, level: tw.level, paint: tw.paint, fx: this.fx, colors: this.colors, audio: app.audio,
      fighters: [], listener: new THREE.Vector3(), combatOn: true, canRespawn: true, viewTeam: 1, chroma: 0.15,
      onHit: () => {}, onLowInk: () => {},
    };
    world.combat = this.combat = new Combat(world);
    const player = this.player = new Fighter(world, { name: prof.name, team: 1, look: prof.look, weapon: prof.weapon, isPlayer: true, color: this.colors[1] });
    // where do we start?
    const fi = clamp(this.opts.floor ?? 0, 0, TOWER_FLOORS.length - 1);
    let sp, yaw;
    if (this.opts.from === 'plaza' || (fi === 0 && !this.opts.from)) { sp = new THREE.Vector3(0, 0, 11.6); yaw = Math.PI; }
    else { sp = new THREE.Vector3(0, floorY(fi), fi === 0 ? 4 : 7.4); yaw = 0; }
    player.place(sp, yaw);
    player.spawnPoint.copy(sp); player.spawnYaw = yaw;
    world.fighters.push(player);
    this.rig = new CameraRig(this.camera);
    this.rig.dist = 4.6;
    this.rig.snap(player, yaw);
    this.control = new PlayerControl(app.input, this.rig);
    // the elevator waits on the floor you arrived at
    this.elev = { floor: fi, y: floorY(fi), from: fi, to: fi, state: 'idle', t: 0, door: 1, dur: 1 };
    this.placeCar();
    // staff + a few visitors
    this.npcs = [];
    for (const s of STAFF) {
      const n = new NPC(world, { name: s.name, pos: new THREE.Vector3(s.pos[0], floorY(s.floor) + s.pos[1], s.pos[2]), yaw: s.yaw, mode: 'idle', emote: null, lines: s.lines, color: new THREE.Color(TOWER_FLOORS[s.floor].accent) });
      n.floor = s.floor;
      this.npcs.push(n);
    }
    const visitors = [[0, -9, 8, 'chat'], [0, -9.9, 8.8, 'chat'], [1, 9, -7, 'chat'], [1, 9.8, -6.2, 'chat'], [2, 10, 9, 'idle'], [3, 10, -9, 'chat'], [3, 10.8, -8.3, 'chat'], [4, 6, 9, 'idle'], [5, 9, 10, 'chat'], [5, 9.8, 10.8, 'chat']];
    for (const [f, x, z, mode] of visitors) {
      const pos = new THREE.Vector3(x, floorY(f), z);
      const n = new NPC(world, { name: pick(['Kip', 'Rue', 'Bix', 'Lark', 'Moss', 'Juno', 'Teal', 'Fig']), pos, mode, look: randomLook(), color: new THREE.Color(pick(COLOR_PAIRS).a), yaw: Math.random() * 6.28, emote: pick(['wave', 'think', 'pose', null]) });
      n.floor = f;
      this.npcs.push(n);
    }
    const rot = currentRotation();
    tw.decor.setBoard(rot.names, 'Rotation changes every 20 minutes');
    // UI
    this.prompt = document.getElementById('prompt');
    this.bubble = document.getElementById('bubble');
    this.toastEl = document.getElementById('toast');
    let hud = document.getElementById('tower-hud');
    if (!hud) { hud = document.createElement('div'); hud.id = 'tower-hud'; document.body.appendChild(hud); }
    this.hud = hud;
    this.time = 0;
    this.uiOpen = false;
    this.curFloor = -1;
    this.updateFloorHud(true);
    app.renderer.compile(scene, this.camera);
    app.audio?.music('lobby');
    this.crowdLoop = app.audio?.loop('crowd');
    this.crowdLoop?.setVolume(0.18);
  }

  // ---------------------------------------------------------------- helpers
  floorOf(y) { return clamp(Math.round(y / FLOOR_H), 0, TOWER_FLOORS.length - 1); }

  updateFloorHud(force = false) {
    const f = this.elev.state === 'moving' ? this.floorOf(this.elev.y) : this.floorOf(this.player.pos.y + 0.5);
    if (f === this.curFloor && !force) return;
    this.curFloor = f;
    const fl = TOWER_FLOORS[f];
    this.hud.style.setProperty('--c', fl.accent);
    this.hud.innerHTML = `<div class="fl-num">${fl.label}</div><div class="fl-name">${fl.name}<span class="fl-sub">${fl.sub}</span></div>`;
    this.hud.classList.add('on');
  }

  toast(html) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => this.toastEl.classList.remove('on'), 2600);
  }

  placeCar() {
    const e = this.elev, d = this.tw.decor;
    d.car.position.y = e.y;
    const open = e.door * (CAR * 0.95);
    d.doorL.position.x = -CAR / 2 - open;
    d.doorR.position.x = CAR / 2 + open;
    for (const c of d.car.children) if (c.name === 'cable') { const len = Math.max(0.1, SHAFT_TOP - e.y - 3.4); c.scale.y = len; c.position.y = 3.4 + len / 2; }
  }

  inCar() {
    const p = this.player.pos, e = this.elev;
    return Math.abs(p.x) < CAR && p.z > -CAR && p.z < CAR + 0.05 && Math.abs(p.y - e.y) < 1.2;
  }

  // ---------------------------------------------------------------- elevator
  callTo(i, ride) {
    const e = this.elev;
    if (e.state !== 'idle' && e.state !== 'opening') return;
    if (i === e.floor) { if (e.door < 1) e.state = 'opening'; return; }
    e.from = e.floor; e.to = i; e.ride = ride;
    e.state = 'closing'; e.t = 0;
    if (ride && this.inCar()) { this.riding = true; this.rideCam = this.camera.position.clone(); this.prompt.classList.remove('on'); }
    e.dur = 1.6 + Math.abs(i - e.floor) * 0.9;
    this.app.audio?.sfx('door', { volume: 0.4, pitch: 1.3 });
    this.tw.decor.setIndicator(e.floor, Math.sign(i - e.floor));
  }

  updateElevator(dt) {
    const e = this.elev, p = this.player;
    if (e.state === 'closing') {
      e.door = Math.max(0, e.door - dt * 2.2);
      if (e.door <= 0) { e.state = 'moving'; e.t = 0; this.app.audio?.sfx('launch', { volume: 0.25, pitch: 0.6 }); }
    } else if (e.state === 'moving') {
      e.t += dt / e.dur;
      const k = e.t >= 1 ? 1 : e.t * e.t * (3 - 2 * e.t);
      e.y = floorY(e.from) + (floorY(e.to) - floorY(e.from)) * k;
      const passing = this.floorOf(e.y);
      if (passing !== e.shown) { e.shown = passing; this.tw.decor.setIndicator(passing, Math.sign(e.to - e.from)); if (this.riding) this.app.audio?.sfx('ui_move', { volume: 0.35 }); }
      if (e.t >= 1) {
        e.floor = e.to; e.state = 'opening';
        this.tw.decor.setIndicator(e.floor, 0);
        this.app.audio?.sfx('checkpoint', { volume: 0.5, pitch: 1.4 });
        if (this.riding) { const fl = TOWER_FLOORS[e.floor]; this.toast(`<b style="color:${fl.accent}">${fl.label} · ${fl.name}</b> — ${fl.sub}`); }
      }
    } else if (e.state === 'opening') {
      e.door = Math.min(1, e.door + dt * 2.2);
      if (e.door >= 1) {
        e.state = 'idle';
        if (this.riding) { this.riding = false; this.rig.snap(this.player, 0); }
      }
    }
    if (this.riding) {
      p.pos.y = e.y; p.vel.set(0, 0, 0); p.onGround = true;
      p.pos.x = clamp(p.pos.x, -CAR + 0.45, CAR - 0.45); p.pos.z = clamp(p.pos.z, -CAR + 0.45, CAR - 0.45);
    }
    this.placeCar();
  }

  // keep players out of an empty shaft, and inside a moving car
  guardShaft() {
    const p = this.player.pos, e = this.elev, r = 0.4;
    const atCar = e.state === 'idle' && Math.abs(p.y - e.y) < 1.2;
    const insideXZ = Math.abs(p.x) < CAR + r && p.z < CAR + r && p.z > -CAR - r;
    if (this.riding) return;
    if (insideXZ && !atCar && p.z > CAR - 0.3) p.z = CAR + r;
  }

  // ---------------------------------------------------------------- interactions
  nearest() {
    const p = this.player.pos, e = this.elev;
    const f = this.floorOf(p.y + 0.5);
    if (this.inCar() && (e.state === 'idle' || e.state === 'opening')) return { kind: 'panel', label: 'Use the <b>elevator</b> — pick a floor (or press <b>1–6</b>)' };
    if (Math.abs(p.x) < 2.4 && p.z > CAR && p.z < CAR + 3 && Math.abs(p.y - floorY(f)) < 1.2 && (e.floor !== f || e.state !== 'idle')) return { kind: 'call', floor: f, label: 'Call the <b>elevator</b>' };
    const k = this.tw.kiosks[f];
    if (Math.hypot(p.x - k.spot.x, p.z - k.spot.z) < 1.9 && Math.abs(p.y - k.y) < 1.5) {
      const fl = TOWER_FLOORS[f];
      return { kind: 'kiosk', floor: f, label: fl.kind === 'arcade' ? 'Play <b>Tongue Snack</b> at the arcade' : `<b>${fl.term}</b> — ${fl.sub}` };
    }
    if (f === 0 && Math.abs(p.x) < 2.6 && p.z > 12.6) return { kind: 'exit', label: 'Exit to <b>Prism Plaza</b>' };
    let best = null, bd = 2.3;
    for (const n of this.npcs) { if (n.floor !== f) continue; const d = n.pos.distanceTo(p); if (d < bd) { bd = d; best = n; } }
    if (best) return { kind: 'npc', npc: best, label: `Talk to <b>${best.name}</b>` };
    return null;
  }

  interact(it) {
    const app = this.app;
    if (it.kind === 'npc') {
      const line = it.npc.talk();
      this.bubbleNpc = it.npc;
      this.bubble.innerHTML = `<div class="bn">${it.npc.name}</div><div class="bt">${line}</div>`;
      this.bubble.classList.add('on');
      clearTimeout(this.bubbleTO);
      this.bubbleTO = setTimeout(() => { this.bubble.classList.remove('on'); this.bubbleNpc = null; }, 5200);
      const pitch = 0.85 + (it.npc.name.charCodeAt(0) % 7) * 0.08;
      for (let i = 0; i < 6; i++) setTimeout(() => app.audio?.sfx('talk', { pitch: pitch + Math.random() * 0.15, volume: 0.5 }), i * 80);
    } else if (it.kind === 'call') {
      this.callTo(it.floor, false);
      app.audio?.sfx('ui_select');
      this.toast('Elevator on its way…');
    } else if (it.kind === 'panel') this.openPanel();
    else if (it.kind === 'exit') {
      app.audio?.sfx('door');
      app.towerFloor = null;
      app.goPlaza();
    } else if (it.kind === 'kiosk') this.useKiosk(it.floor);
  }

  hold() {
    const app = this.app;
    this.uiOpen = true;
    app.input.unlock();
    this.prompt.classList.remove('on');
    return () => { this.uiOpen = false; if (app.mode === this) app.input.lock(); };
  }

  openPanel() {
    const app = this.app;
    const close = this.hold();
    app.audio?.sfx('ui_select');
    app.menus.elevator({
      floors: TOWER_FLOORS, here: this.elev.floor,
      onPick: (i) => { close(); if (i !== this.elev.floor) this.callTo(i, true); },
      onClose: close,
    });
  }

  useKiosk(i) {
    const app = this.app, fl = TOWER_FLOORS[i];
    app.audio?.sfx('ui_select');
    const release = this.hold();
    const onClose = () => { release(); app.audio?.music('lobby'); };
    app.towerFloor = i;
    if (fl.kind === 'cpu') app.menus.lobby({ mode: fl.mode, onStart: (o) => app.startBattle({ mode: fl.mode, ...o }), onClose });
    else if (fl.kind === 'online') app.startQuickMatch(onClose);
    else if (fl.kind === 'private') app.openPrivate(onClose);
    else if (fl.kind === 'arcade') app.menus.arcade({ onClose });
  }

  // let an outside flow (an online room) own the screen; returns the release function
  holdUI() {
    const r = this.hold();
    this.app.audio?.music('lobby');
    return r;
  }

  openPause() {
    const app = this.app, inp = app.input;
    if (this.uiOpen) return;
    inp.unlock();
    this.uiOpen = true;
    app.menus.pause(true, {
      onResume: () => { this.uiOpen = false; inp.lock(); },
      onQuit: () => { this.uiOpen = false; app.towerFloor = null; app.goPlaza(); },
      quitLabel: 'LEAVE THE TOWER',
    });
  }

  onLockLost() { this.openPause(); }

  // ---------------------------------------------------------------- loop
  update(dt) {
    const app = this.app, inp = app.input;
    this.time += dt;
    const p = this.player, w = this.world, e = this.elev;
    this.updateElevator(dt);
    if (this.uiOpen) {
      p.intent.mx = p.intent.mz = 0; p.intent.fire = p.intent.goo = p.intent.jump = p.intent.sub = p.intent.special = false;
      this.control.update(dt, p, w, false);
    } else {
      this.control.update(dt, p, w, !this.riding);
      if (this.riding) { p.intent.mx = p.intent.mz = 0; p.intent.jump = p.intent.goo = false; }
      if (inp.pressed('KeyE')) p.intent.special = false;
      if (inp.pressed('KeyT')) { p.model.doTongue(); app.audio?.sfx('tongue', { ...posOf(p.pos), volume: 0.6 }); }
      if (!inp.locked && inp.mousePressed[0]) inp.lock();
      // number keys: ride straight to a floor while standing in the car
      if (this.inCar() && (e.state === 'idle' || e.state === 'opening')) {
        for (let i = 0; i < TOWER_FLOORS.length; i++) if (inp.pressed('Digit' + (i + 1))) { if (i !== e.floor) this.callTo(i, true); }
      }
      // walking up to the doors calls the car to your floor
      const f = this.floorOf(p.pos.y + 0.5);
      if (!this.riding && e.state === 'idle' && e.floor !== f && Math.abs(p.pos.x) < 2.2 && p.pos.z > CAR && p.pos.z < CAR + 2.6 && Math.abs(p.pos.y - floorY(f)) < 0.6) this.callTo(f, false);
      const it = this.riding ? null : this.nearest();
      if (it) {
        this.prompt.innerHTML = `<span class="key">${inp.usingPad ? 'X' : 'E'}</span> ${it.label}`;
        this.prompt.classList.add('on');
        if (inp.action('interact')) { p.intent.fire = false; p.intent.special = false; this.interact(it); }
      } else this.prompt.classList.remove('on');
      if (inp.action('pause')) this.openPause();
    }
    if (this.riding) p.syncModel(dt, false, 0);
    else p.update(dt);
    this.guardShaft();
    // fell into the well somehow: back to the lobby
    if (p.pos.y < -5) { p.place(new THREE.Vector3(0, 0, 9), Math.PI); this.rig.snap(p, Math.PI); }
    for (const n of this.npcs) {
      const near = Math.abs(n.pos.y - p.pos.y) < FLOOR_H * 1.6;
      n.model.root.visible = near;
      if (near) n.update(dt, p);
    }
    this.combat.update(dt);
    this.fx.update(dt);
    this.env.update(dt);
    this.env.follow(p.pos);
    // keep the shadow camera on the player's floor
    this.env.sun.target.position.y = p.pos.y;
    this.env.sun.position.y += p.pos.y;
    this.env.sun.target.updateMatrixWorld();
    this.env.sky.position.y = p.pos.y;
    this.tw.decor.update(this.time, dt);
    // ride camera: swing out into the atrium so you watch the floors go by
    if (this.riding && this.rideCam) {
      const a = this.time * 0.25;
      const tgt = new THREE.Vector3(Math.sin(a) * 4.2 + 1.2, e.y + 2.4, WELL - 0.8 + Math.cos(a) * 0.5);
      this.rideCam.lerp(tgt, damp(2.5, dt));
      this.camera.position.copy(this.rideCam);
      this.camera.lookAt(0, e.y + 1.5, 0);
    }
    if (this.camOverride) { this.camera.position.copy(this.camOverride.pos); this.camera.lookAt(this.camOverride.look); }
    w.listener.copy(this.camera.position);
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.rig.yaw + Math.PI);
    if (this.bubbleNpc) {
      const v = this.bubbleNpc.pos.clone().setY(this.bubbleNpc.pos.y + 2.1).project(this.camera);
      this.bubble.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
    }
    this.updateFloorHud();
    const ret = document.getElementById('plaza-reticle');
    ret.classList.toggle('on', !this.uiOpen && inp.locked && !this.riding);
    document.getElementById('plaza-cover').classList.toggle('on', !this.uiOpen && !inp.locked && !inp.usingPad);
  }

  render(dt) {
    const app = this.app;
    this.tw.paint.flush(app.renderer);
    app.post.render(this.scene, this.camera, dt);
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  dispose() {
    this.crowdLoop?.stop();
    this.player.dispose();
    for (const n of this.npcs) n.model.dispose();
    this.combat.dispose();
    this.fx.dispose();
    this.tw.decor.dispose();
    this.tw.level.dispose();
    this.tw.paint.dispose();
    this.env.dispose();
    this.prompt.classList.remove('on');
    this.bubble.classList.remove('on');
    this.hud.classList.remove('on');
    document.getElementById('plaza-reticle').classList.remove('on');
    document.getElementById('plaza-cover').classList.remove('on');
    this.tw.paint.uniforms.uNoise.value?.dispose();
    disposeScene(this.scene);
  }
}
