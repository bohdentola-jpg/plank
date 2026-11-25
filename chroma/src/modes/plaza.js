// Hub mode: walk (or swim!) around Prism Plaza, talk to Dripkins, try weapons
// on practice dummies, visit the shop / style lab, and enter the Clash Tower.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { buildPlaza, PLAZA_SPOTS } from '../world/plaza.js';
import { Particles } from '../fx/particles.js';
import { Combat, posOf } from '../actors/weapons.js';
import { Fighter } from '../actors/fighter.js';
import { Dripkin, randomLook } from '../actors/character.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { BOT_NAMES } from '../actors/bot.js';
import { damp, dampAngle, rand, pick, clamp, hexToCss, lerp, COLOR_PAIRS } from '../util.js';

const NPC_LINES = [
  'Hold <b>SHIFT</b> to melt into your ink. You swim super fast and refill your tank!',
  'Paint a wall, then swim into it to <b>climb</b>. Works on anything you can paint!',
  'Enemy ink is sticky. It slows you down and chips away at your health.',
  'Turf Rush is simple: whoever paints the most <b>floor</b> in 3 minutes wins!',
  'Your special meter fills as you paint. When it glows, hit <b>Q</b>!',
  'Rollers flatten anyone in front of them. Don\'t get flattened!',
  'A fully charged Longshot beam splashes anyone in one hit. Respect the lines!',
  'Bombs cost a lot of ink. Toss them, then swim to refill.',
  'I painted the fountain once. They were NOT happy.',
  'Have you tried the café? The jelly latte is to drip for.',
  'The practice yard is down south. Go splash some Bopbots!',
  'Blastworks just got the Pop Blaster in stock. Direct hits splash instantly!',
  'I swear my hair changes color every match. Weird, right?',
  'Hold <b>TAB</b> in battle to see the turf map.',
  'The Style Lab can change your whole look. I went with drip-bob. Iconic.',
  'Fun fact: you can paint the whole plaza. Nobody cleans it up, either.',
];

class NPC {
  constructor(world, opts) {
    this.world = world;
    this.name = opts.name;
    const look = opts.look || randomLook();
    this.model = new Dripkin(look, opts.color, opts.weapon || null);
    world.scene.add(this.model.root);
    this.pos = opts.pos.clone();
    this.yaw = opts.yaw ?? rand(0, Math.PI * 2);
    this.vel = new THREE.Vector3();
    this.mode = opts.mode || 'wander';
    this.state = 'idle';
    this.timer = rand(0.5, 4);
    this.target = null;
    this.emote = opts.emote || null;
    this.lines = opts.lines || NPC_LINES;
    this.lineI = Math.floor(rand(0, this.lines.length));
    this.talkT = 0;
    this.stuck = 0;
    this.home = this.pos.clone();
  }

  pickTarget() {
    const lvl = this.world.level;
    for (let i = 0; i < 20; i++) {
      const x = rand(-36, 36), z = rand(-28, 34);
      if (Math.hypot(x, z) < 6.5) continue;
      const h = lvl.heightAt(x, z);
      if (h.y < 0.05 && h.y > -0.5) { this.target = new THREE.Vector3(x, 0, z); return; }
    }
    this.target = null;
  }

  update(dt, player) {
    const lvl = this.world.level;
    let speed = 0;
    if (this.talkT > 0) {
      this.talkT -= dt;
      const ty = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      this.yaw = dampAngle(this.yaw, ty, 8, dt);
      this.model.emote = this.talkT > 3.4 ? 'wave' : null;
    } else if (this.mode === 'wander') {
      if (this.state === 'idle') {
        this.timer -= dt;
        if (this.timer <= 0) { this.pickTarget(); this.state = this.target ? 'walk' : 'idle'; this.timer = rand(2, 5); this.model.emote = null; }
      } else {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6 || this.stuck > 2) {
          this.state = 'idle'; this.timer = rand(2, 6); this.stuck = 0;
          this.model.emote = pick([null, null, 'wave', 'think', 'dance']);
        } else {
          speed = 1.7;
          this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 5, dt);
          this.vel.set(Math.sin(this.yaw) * speed, 0, Math.cos(this.yaw) * speed);
          const before = this.pos.clone();
          this.pos.addScaledVector(this.vel, dt);
          lvl.collide(this.pos, this.vel, 0.36, 1.45, 0.5);
          // keep clear of the player
          const px = this.pos.x - player.pos.x, pz = this.pos.z - player.pos.z, pd = Math.hypot(px, pz);
          if (pd < 0.8 && pd > 0.01) { this.pos.x += (px / pd) * (0.8 - pd); this.pos.z += (pz / pd) * (0.8 - pd); }
          if (before.distanceTo(this.pos) < speed * dt * 0.3) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
          const g = lvl.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.2, 0.6);
          if (g.solid) this.pos.y = g.y;
        }
      }
    } else {
      this.model.emote = this.emote;
    }
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
    this.model.update(dt, { speed, grounded: true, vy: 0, pitch: 0, aiming: false, firing: false, weapon: this.model.weaponId });
  }

  talk() {
    this.talkT = 4;
    const line = this.lines[this.lineI % this.lines.length];
    this.lineI++;
    return line;
  }
}

// Practice target: a bouncy balloon creature that pops
class Bopbot {
  constructor(world, pos) {
    this.world = world;
    this.team = 2;
    this.name = 'Bopbot';
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.alive = true; this.invuln = 0; this.hp = 100; this.submerged = false; this.form = 'kid';
    this.time = 0; this.lastAttacker = null; this.lastAttackT = -9; this.stats = { kills: 0 };
    this.respawnT = 0;
    const g = this.root = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 });
    this.mat = mat;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), mat);
    body.position.y = 1.05; body.scale.set(1, 1.15, 1); body.castShadow = true; g.add(body);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1b1530 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeM); e.position.set(0.18 * s, 1.2, 0.5); g.add(e); }
    const target = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x551111 }));
    target.position.set(0, 0.95, 0.56); g.add(target);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x2b2f45, roughness: 0.4, metalness: 0.5 }));
    stand.position.y = 0.25; g.add(stand);
    this.body = body;
    g.position.copy(pos);
    world.scene.add(g);
    this.wob = 0;
  }
  get color() { return this.world.colors[2]; }
  hitHeight() { return 1.6; }
  takeDamage(dmg, attacker) {
    if (!this.alive) return;
    this.hp -= dmg; this.wob = 1;
    this.mat.emissive.setRGB(0.6, 0.6, 0.6);
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnT = 3;
      this.root.visible = false;
      const p = this.pos.clone().setY(this.pos.y + 1);
      this.world.fx.explosion(p, attacker ? attacker.color : 0xffffff, 1.8);
      this.world.audio?.sfx('splatted', { ...posOf(p), volume: 0.8 });
      this.world.onPop?.(this, attacker);
    }
  }
  update(dt) {
    this.time += dt;
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { this.alive = true; this.hp = 100; this.root.visible = true; this.wob = 1; }
      return;
    }
    if (this.hp < 100) this.hp = Math.min(100, this.hp + 25 * dt);
    this.wob = Math.max(0, this.wob - dt * 2.5);
    const w = Math.sin(this.time * 18) * this.wob;
    this.body.rotation.z = w * 0.3;
    this.body.scale.set(1 + w * 0.08, 1.15 - w * 0.1, 1 + w * 0.08);
    this.body.position.y = 1.05 + Math.sin(this.time * 2) * 0.04;
    this.mat.emissive.multiplyScalar(Math.max(0, 1 - dt * 8));
    const hpK = this.hp / 100;
    this.mat.color.setRGB(1, 0.75 + hpK * 0.25, 0.75 + hpK * 0.25);
  }
}

export class Plaza {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
  }

  async init() {
    const app = this.app;
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 1500);
    this.env = new Environment(scene, app.renderer, 'golden');
    const pz = this.pz = buildPlaza(scene, app.renderer, this.env);
    const prof = app.profile;
    const inkHex = prof.ink || '#ff2e88';
    const other = COLOR_PAIRS.find((c) => c.a === inkHex)?.b || COLOR_PAIRS.find((c) => c.b === inkHex)?.a || '#3cf03c';
    this.colors = { 0: new THREE.Color(0xffffff), 1: new THREE.Color(inkHex), 2: new THREE.Color(other) };
    pz.paint.setColors(this.colors[1], this.colors[2]);
    // restore plaza paint from the session
    if (app.plazaPaint && app.plazaPaint.length === pz.paint.data.length) {
      pz.paint.data.set(app.plazaPaint);
      pz.paint.fullDirty = true;
    }
    this.fx = new Particles(scene, 900);
    const world = this.world = {
      scene, level: pz.level, paint: pz.paint, fx: this.fx, colors: this.colors, audio: app.audio,
      fighters: [], listener: new THREE.Vector3(), combatOn: true, canRespawn: true,
      onHit: (a, v) => { if (a === this.player) { this.hitT = 0.2; app.audio?.sfx('hit', { volume: 0.45 }); } },
      onPop: (b, a) => { if (a === this.player) { app.audio?.sfx('ko_confirm', { volume: 0.7 }); this.pops = (this.pops || 0) + 1; this.toast(`Bopbot popped! <b>${this.pops}</b>`); } },
      onLowInk: () => this.toast('Out of ink! Hold <b>SHIFT</b> in your ink to refill.'),
    };
    world.combat = this.combat = new Combat(world);
    const player = this.player = new Fighter(world, { name: prof.name, team: 1, look: prof.look, weapon: prof.weapon, isPlayer: true, color: this.colors[1] });
    const sp = this.opts.from === 'battle' ? PLAZA_SPOTS.tower.clone().add(new THREE.Vector3(0, 0.3, 2.5)) : PLAZA_SPOTS.spawn.clone();
    player.place(sp, Math.PI);
    player.spawnPoint.copy(sp); player.spawnYaw = Math.PI;
    world.fighters.push(player);
    this.rig = new CameraRig(this.camera);
    this.rig.dist = 4.8;
    this.rig.snap(player, Math.PI);
    this.control = new PlayerControl(app.input, this.rig);
    // practice dummies
    this.bots = [];
    for (const p of [[-8, 0.6, 43], [0, 0.6, 44], [8, 0.6, 43], [-2.5, 2.2, 41.5], [-20, 0, 40], [20, 0, 40]]) {
      const b = new Bopbot(world, new THREE.Vector3(...p));
      b.root.rotation.y = Math.PI;
      this.bots.push(b);
      world.fighters.push(b);
    }
    // NPCs
    this.npcs = [];
    const npcColor = () => new THREE.Color(pick(COLOR_PAIRS)[Math.random() < 0.5 ? 'a' : 'b']);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 12; i++) {
      let pos;
      for (;;) { pos = new THREE.Vector3(rand(-30, 30), 0, rand(-26, 30)); if (Math.hypot(pos.x, pos.z) > 7 && pz.level.heightAt(pos.x, pos.z).y < 0.05) break; }
      this.npcs.push(new NPC(world, { name: names[i], pos, color: npcColor() }));
    }
    const fixed = [
      { name: 'Vex', pos: new THREE.Vector3(29.15, 0, -4), yaw: -Math.PI / 2, mode: 'fixed', emote: null, weapon: 'spritzer', lines: ['Welcome to <b>Blastworks</b>! Best gear in the plaza. Press <b>E</b> at the counter to browse.', 'Every weapon comes with Splash Bombs and a special. Pick your style!'] },
      { name: 'Prism', pos: new THREE.Vector3(-29.15, 0, -4), yaw: Math.PI / 2, mode: 'fixed', emote: 'think', lines: ['Darling, that look is SO last match. Step up to the <b>Style Lab</b> counter!', 'Hair, eyes, outfits, ink color — I do it all.'] },
      { name: 'Gate', pos: new THREE.Vector3(-4.2, 0.3, -32.4), yaw: 0.3, mode: 'fixed', emote: null, weapon: 'roller', lines: ['The Clash Tower runs Turf Rush matches all day. Step up to the door when you\'re ready!', 'Pick your weapon and difficulty inside. Good luck out there!'] },
      { name: 'Juno', pos: new THREE.Vector3(-9, 0, -6), yaw: Math.PI, mode: 'fixed', emote: 'sit' },
      { name: 'Taffy', pos: new THREE.Vector3(9, 0, 6), yaw: 0, mode: 'fixed', emote: 'sit' },
      { name: 'Ziggy', pos: new THREE.Vector3(5.8, 0, 2.5), yaw: -2, mode: 'fixed', emote: 'dance' },
      { name: 'Bix', pos: new THREE.Vector3(-6, 0, -1), yaw: 1.4, mode: 'fixed', emote: 'dance' },
      { name: 'Coach Pip', pos: new THREE.Vector3(-11, 0.6, 39.5), yaw: 0.6, mode: 'fixed', weapon: 'longshot', lines: ['This is the <b>Practice Yard</b>. Splash those Bopbots to test your weapon!', 'Try painting a wall, then hold <b>SHIFT</b> and swim up it.', 'Right-click throws a Splash Bomb. It costs most of your ink!'] },
    ];
    for (const f of fixed) {
      const n = new NPC(world, { ...f, color: npcColor() });
      if (f.emote === 'sit') { n.pos.y = 0.1; }
      this.npcs.push(n);
    }
    // UI
    this.ui = app.menus;
    this.prompt = document.getElementById('prompt');
    this.bubble = document.getElementById('bubble');
    this.toastEl = document.getElementById('toast');
    this.plazaHud = document.getElementById('plaza-hud');
    this.plazaHud.classList.add('on');
    this.updatePlazaHud();
    this.time = 0;
    this.showcase = null;
    this.uiOpen = false;
    this.hitT = 0;
    app.renderer.compile(scene, this.camera);
    app.audio?.music('plaza');
    this.fountainLoop = app.audio?.loop('fountain', { x: 0, y: 1, z: 0 });
    this.crowdLoop = app.audio?.loop('crowd');
    this.crowdLoop?.setVolume(0.35);
    if (this.opts.title) this.titleMode = true;
  }

  updatePlazaHud() {
    const p = this.app.profile;
    this.plazaHud.innerHTML = `
      <div class="ph-card">
        <div class="ph-name">${p.name}</div>
        <div class="ph-lvl">LV <b>${p.level}</b><div class="ph-xp"><i style="width:${Math.round(p.xp / this.app.xpFor(p.level) * 100)}%"></i></div></div>
      </div>
      <div class="ph-coins"><span class="coin">◉</span> ${p.coins.toLocaleString()}</div>
      <div class="ph-weapon">${this.player.weapon.name}</div>`;
  }

  toast(html) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => this.toastEl.classList.remove('on'), 2600);
  }

  nearest() {
    const p = this.player.pos;
    const S = PLAZA_SPOTS;
    if (p.distanceTo(S.tower) < 3.6 && p.z > -34) return { kind: 'tower', label: 'Enter the <b>Clash Tower</b> — Battle!' };
    if (p.distanceTo(S.shop) < 3.4) return { kind: 'shop', label: 'Browse weapons at <b>Blastworks</b>' };
    if (p.distanceTo(S.locker) < 3.4) return { kind: 'locker', label: 'Change your look at the <b>Style Lab</b>' };
    let best = null, bd = 2.4;
    for (const n of this.npcs) {
      const d = n.pos.distanceTo(p);
      if (d < bd) { bd = d; best = n; }
    }
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
      const syll = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < syll; i++) setTimeout(() => app.audio?.sfx('talk', { pitch: 0.9 + Math.random() * 0.5, volume: 0.5 }), i * 75);
      return;
    }
    app.audio?.sfx('ui_select');
    this.openUI(it.kind);
  }

  openUI(kind, opts = {}) {
    const app = this.app;
    this.uiOpen = true;
    app.input.unlock();
    this.prompt.classList.remove('on');
    const close = () => { this.uiOpen = false; this.showcase = null; this.player.model.emote = null; this.updatePlazaHud(); app.input.lock(); };
    if (kind === 'tower') {
      app.audio?.sfx('door');
      app.menus.lobby({
        onStart: (o) => { app.startBattle(o); },
        onClose: close,
      });
    } else if (kind === 'shop') {
      this.showcase = 'front';
      app.menus.shop({
        onEquip: (id) => { this.player.setWeapon(id); this.updatePlazaHud(); },
        onClose: close,
      });
    } else if (kind === 'locker') {
      this.showcase = 'front';
      this.player.model.emote = null;
      app.menus.locker({
        create: !!opts.create,
        onChange: (look, ink) => {
          this.player.model.setLook(look);
          this.player.look = look;
          if (ink) {
            this.colors[1].set(ink);
            this.player.model.setTeamColor(this.colors[1]);
            const other = COLOR_PAIRS.find((c) => c.a === ink)?.b || COLOR_PAIRS.find((c) => c.b === ink)?.a || '#3cf03c';
            this.colors[2].set(other);
            this.pz.paint.setColors(this.colors[1], this.colors[2]);
          }
        },
        onEmote: (e) => { this.player.model.emote = e; },
        onClose: close,
      });
    }
  }

  update(dt) {
    const app = this.app, inp = app.input;
    this.time += dt;
    const p = this.player;
    const w = this.world;
    if (this.titleMode) {
      // slow orbit for the title screen
      const a = this.time * 0.06 + 0.6;
      this.camera.position.set(Math.cos(a) * 30, 9 + Math.sin(this.time * 0.2) * 1.5, Math.sin(a) * 30 + 4);
      this.camera.lookAt(0, 4, -6);
      p.intent.mx = p.intent.mz = 0;
      p.model.emote = 'wave';
    } else if (this.uiOpen) {
      p.intent.mx = p.intent.mz = 0; p.intent.fire = p.intent.goo = p.intent.jump = p.intent.sub = false;
      if (this.showcase) {
        // camera in front of the player, model turned towards it
        const yaw = p.yaw;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const rx = -fz, rz = fx;
        const tgt = new THREE.Vector3(p.pos.x + fx * 3.0 - rx * 0.9, p.pos.y + 1.25, p.pos.z + fz * 3.0 - rz * 0.9);
        this.camera.position.lerp(tgt, damp(5, dt));
        const look = new THREE.Vector3(p.pos.x - rx * 0.9, p.pos.y + 0.95, p.pos.z - rz * 0.9);
        this.camera.lookAt(look);
        p.syncModel(dt, false, 0);
      } else this.control.update(dt, p, w, false);
    } else {
      this.control.update(dt, p, w, true);
      if (!inp.locked && inp.mousePressed[0]) inp.lock();
      // interaction prompt
      const it = this.nearest();
      this.near = it;
      if (it) {
        this.prompt.innerHTML = `<span class="key">${inp.usingPad ? 'X' : 'E'}</span> ${it.label}`;
        this.prompt.classList.add('on');
        if (inp.action('interact')) { p.intent.fire = false; this.interact(it); }
      } else this.prompt.classList.remove('on');
      if (inp.action('pause')) {
        inp.unlock();
        this.uiOpen = true;
        app.menus.pause(true, {
          onResume: () => { app.menus.pause(false); this.uiOpen = false; inp.lock(); },
          onQuit: () => { app.menus.pause(false); this.uiOpen = false; app.goTitle(); },
          quitLabel: 'BACK TO TITLE',
        });
      }
    }
    if (!this.titleMode) p.update(dt);
    else { p.syncModel(dt, false, 0); }
    for (const b of this.bots) b.update(dt);
    for (const n of this.npcs) n.update(dt, p);
    this.combat.update(dt);
    this.fx.update(dt);
    this.env.update(dt);
    this.env.follow(this.titleMode ? new THREE.Vector3(0, 0, 0) : p.pos);
    this.pz.decor.update(this.time, dt, this.fx);
    w.listener.copy(this.camera.position);
    const camYaw = this.titleMode || this.uiOpen ? Math.atan2(-this.camera.matrixWorld.elements[8], -this.camera.matrixWorld.elements[10]) : this.rig.yaw;
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, camYaw + Math.PI);
    // speech bubble follows the npc
    if (this.bubbleNpc) {
      const v = this.bubbleNpc.pos.clone().setY(this.bubbleNpc.pos.y + 2.1).project(this.camera);
      this.bubble.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
    }
    // minimal reticle in plaza (only when locked)
    const ret = document.getElementById('plaza-reticle');
    ret.classList.toggle('on', !this.titleMode && !this.uiOpen && inp.locked);
    ret.classList.toggle('hit', (this.hitT -= dt) > 0);
    ret.style.setProperty('--ink', `${Math.round(p.ink * 100)}%`);
    document.getElementById('plaza-cover').classList.toggle('on', !this.titleMode && !this.uiOpen && !inp.locked && !inp.usingPad);
  }

  render(dt) {
    this.pz.paint.flush(this.app.renderer);
    this.app.post.render(this.scene, this.camera, dt);
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  setTitleMode(on) {
    this.titleMode = on;
    if (!on) { this.player.model.emote = null; this.rig.snap(this.player, this.player.yaw); this.plazaHud.classList.add('on'); this.updatePlazaHud(); }
    else this.plazaHud.classList.remove('on');
  }

  dispose() {
    this.app.plazaPaint = this.pz.paint.data.slice();
    this.fountainLoop?.stop();
    this.crowdLoop?.stop();
    this.player.dispose();
    for (const n of this.npcs) n.model.dispose();
    this.combat.dispose();
    this.fx.dispose();
    this.pz.level.dispose();
    this.pz.paint.dispose();
    this.env.dispose();
    this.prompt.classList.remove('on');
    this.bubble.classList.remove('on');
    this.plazaHud.classList.remove('on');
    document.getElementById('plaza-reticle').classList.remove('on');
    document.getElementById('plaza-cover').classList.remove('on');
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
  }
}
