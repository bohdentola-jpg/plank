// Hub mode: walk (or swim!) around Prism Plaza, talk to the locals, catch the
// news, walk into the shops, try weapons in the practice yard, enter the
// Clash Tower — and maybe find what's under the back alley.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { buildPlaza, PLAZA_SPOTS, ROOMS } from '../world/plaza.js';
import { NewsStudio, HOSTS } from '../world/news.js';
import { currentRotation } from '../world/rotation.js';
import { Particles } from '../fx/particles.js';
import { Combat, posOf, WEAPONS } from '../actors/weapons.js';
import { Fighter } from '../actors/fighter.js';
import { Dripkin, buildWeaponModel } from '../actors/character.js';
import { randomLook } from '../actors/gear.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { BOT_NAMES } from '../actors/bot.js';
import { damp, dampAngle, rand, pick, clamp, COLOR_PAIRS, disposeScene } from '../util.js';

const NPC_LINES = [
  'Hold <b>SHIFT</b> to dive into your ink. You swim super fast and refill your tank!',
  'Paint a wall, then swim into it to <b>climb</b>. Works on anything you can paint!',
  'Enemy ink is sticky. It slows you down and chips away at your health.',
  'Turf Rush is simple: whoever paints the most <b>floor</b> in 3 minutes wins!',
  'Your special meter fills as you paint. When it glows, hit <b>Q</b>!',
  'Every piece of gear has an ability. I stack Swim Speed. Zoom zoom.',
  'A charger\'s laser sight gives them away. Follow the line!',
  'Dualies can dodge-roll — tap JUMP while firing with a direction.',
  'Brellas pop open a shield if you hold fire. Great against snipers.',
  'Hold to spin up a Whirlpool, then let it RIP.',
  'Did you see PRISM NEWS today? Nova\'s frill was immaculate.',
  'Blastworks lets you <b>try</b> any weapon before buying. Practice Yard\'s down south!',
  'They say gray goo has been bubbling up from the drains... gross.',
  'My tail curls up when I\'m nervous. Matches make me SO nervous.',
  'Chameleons change color, sure. But changing the WHOLE MAP? That\'s style.',
  'Press <b>T</b> to flick your tongue. Very polite. Very cool.',
  'The Clash Tower runs Turf Rush on two rotating stages. Check the big screen!',
  'Hold <b>TAB</b> in battle to see the turf map.',
  'Someone left a manhole loose in the alley by the DJ booth. Don\'t go down there. Probably.',
  'I painted the fountain once. They were NOT happy.',
];

export class NPC {
  constructor(world, opts) {
    this.world = world;
    this.name = opts.name;
    const look = opts.look || randomLook();
    this.model = new Dripkin(look, opts.color, opts.weapon || null);
    if (opts.weapon) this.model.weaponType = WEAPONS[opts.weapon]?.type;
    world.scene.add(this.model.root);
    this.pos = opts.pos.clone();
    this.yaw = opts.yaw ?? rand(0, Math.PI * 2);
    this.baseYaw = this.yaw;
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
    this.swim = !!opts.swim;
    this.swimC = opts.pos.clone(); this.swimR = opts.swimR || 2; this.swimA = rand(0, 6);
    this.chatT = rand(0, 3);
    this.area = opts.area || [-26, 26, -24, 30];
    this.interactive = opts.interactive !== false;
  }

  pickTarget() {
    const lvl = this.world.level;
    const [x0, x1, z0, z1] = this.area;
    for (let i = 0; i < 20; i++) {
      const x = rand(x0, x1), z = rand(z0, z1);
      if (Math.hypot(x, z - 4) < 6.5) continue;
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
      this.model.emote = this.talkT > 3.4 ? 'wave' : 'talk';
    } else if (this.swim) {
      this.swimA += dt * 1.1;
      const nx = this.swimC.x + Math.cos(this.swimA) * this.swimR, nz = this.swimC.z + Math.sin(this.swimA) * this.swimR;
      this.yaw = Math.atan2(nx - this.pos.x, nz - this.pos.z);
      this.pos.set(nx, this.swimC.y, nz);
      speed = 6;
    } else if (this.mode === 'wander') {
      if (this.state === 'idle') {
        this.timer -= dt;
        if (this.timer <= 0) { this.pickTarget(); this.state = this.target ? 'walk' : 'idle'; this.timer = rand(2, 5); this.model.emote = null; }
      } else {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6 || this.stuck > 2) {
          this.state = 'idle'; this.timer = rand(2, 6); this.stuck = 0;
          this.model.emote = pick([null, null, 'wave', 'think', 'dance', 'tongue', 'pose']);
        } else {
          speed = 1.7;
          this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 5, dt);
          this.vel.set(Math.sin(this.yaw) * speed, 0, Math.cos(this.yaw) * speed);
          const before = this.pos.clone();
          this.pos.addScaledVector(this.vel, dt);
          lvl.collide(this.pos, this.vel, 0.36, 1.45, 0.5);
          const px = this.pos.x - player.pos.x, pz = this.pos.z - player.pos.z, pd = Math.hypot(px, pz);
          if (pd < 0.8 && pd > 0.01) { this.pos.x += (px / pd) * (0.8 - pd); this.pos.z += (pz / pd) * (0.8 - pd); }
          if (before.distanceTo(this.pos) < speed * dt * 0.3) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
          const g = lvl.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.2, 0.6);
          if (g.solid) this.pos.y = g.y;
        }
      }
    } else if (this.mode === 'chat') {
      this.chatT -= dt;
      if (this.chatT <= 0) { this.chatT = rand(1.5, 4); this.model.emote = pick(['talk', 'talk', 'think', null, 'wave', 'pose']); }
      this.yaw = dampAngle(this.yaw, this.baseYaw, 4, dt);
    } else {
      this.model.emote = this.emote;
      this.yaw = dampAngle(this.yaw, this.baseYaw, 4, dt);
    }
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    m.lodFor(this.world.listener);
    if (m.lod.level === 2 && !speed) { this.skip = (this.skip || 0) + 1; if (this.skip % 4) return; dt *= 4; }
    m.update(dt, { speed, grounded: true, vy: 0, pitch: 0, aiming: false, firing: false, weapon: m.weaponId, wtype: m.weaponType, goo: this.swim, submerged: this.swim, chroma: 0.12 });
  }

  talk() {
    this.talkT = 4.2;
    const line = this.lines[this.lineI % this.lines.length];
    this.lineI++;
    return line;
  }
}

// Practice target: a bouncy balloon creature that pops
class Bopbot {
  constructor(world, pos) {
    this.world = world;
    this.team = 2; this.name = 'Bopbot';
    this.pos = pos.clone(); this.vel = new THREE.Vector3();
    this.alive = true; this.invuln = 0; this.hp = 100; this.submerged = false; this.form = 'kid';
    this.time = 0; this.lastAttacker = null; this.lastAttackT = -9; this.stats = { kills: 0 };
    this.respawnT = 0;
    const g = this.root = new THREE.Group();
    const mat = this.mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 });
    const body = this.body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), mat);
    body.position.y = 1.05; body.scale.set(1, 1.15, 1); body.castShadow = true; g.add(body);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1b1530 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeM); e.position.set(0.18 * s, 1.2, 0.5); g.add(e); }
    const target = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x551111 }));
    target.position.set(0, 0.95, 0.56); g.add(target);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x2b2f45, roughness: 0.4, metalness: 0.5 }));
    stand.position.y = 0.25; g.add(stand);
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
      this.alive = false; this.respawnT = 3; this.root.visible = false;
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
    if (app.plazaPaint && app.plazaPaint.length === pz.paint.data.length) { pz.paint.data.set(app.plazaPaint); pz.paint.fullDirty = true; }
    this.fx = new Particles(scene, 900);
    const world = this.world = {
      scene, level: pz.level, paint: pz.paint, fx: this.fx, colors: this.colors, audio: app.audio,
      fighters: [], listener: new THREE.Vector3(), combatOn: true, canRespawn: true, viewTeam: 1, chroma: 0.15,
      onHit: (a) => { if (a === this.player) { this.hitT = 0.2; app.audio?.sfx('hit', { volume: 0.45 }); } },
      onPop: (b, a) => { if (a === this.player) { app.audio?.sfx('ko_confirm', { volume: 0.7 }); this.pops = (this.pops || 0) + 1; this.toast(`Bopbot popped! <b>${this.pops}</b>`); } },
      onLowInk: () => this.toast('Out of ink! Hold <b>SHIFT</b> in your ink to refill.'),
    };
    world.combat = this.combat = new Combat(world);
    const weapon = app.tryWeapon || prof.weapon;
    const player = this.player = new Fighter(world, { name: prof.name, team: 1, look: prof.look, weapon, isPlayer: true, color: this.colors[1] });
    let sp, yaw = Math.PI;
    if (this.opts.from === 'battle' || this.opts.from === 'tower') sp = PLAZA_SPOTS.tower.clone().add(new THREE.Vector3(0, 0, 3.4));
    else if (this.opts.from === 'story') { sp = PLAZA_SPOTS.manhole.clone().add(new THREE.Vector3(2.4, 0, 0)); yaw = Math.PI / 2; }
    else if (this.opts.from === 'house') { sp = PLAZA_SPOTS.home.clone().add(new THREE.Vector3(-2.6, 0, 0)); yaw = Math.PI; }
    else sp = PLAZA_SPOTS.spawn.clone();
    player.place(sp, yaw);
    player.spawnPoint.copy(sp); player.spawnYaw = yaw;
    world.fighters.push(player);
    this.rig = new CameraRig(this.camera);
    this.rig.dist = 4.8;
    this.rig.snap(player, yaw);
    this.control = new PlayerControl(app.input, this.rig);
    this.location = 'plaza';
    // practice dummies
    this.bots = [];
    for (const p of [[-8, 0.6, 41], [0, 0.6, 42], [8, 0.6, 41], [-2.5, 2.2, 40], [-20, 0, 40], [20, 0, 40]]) {
      const b = new Bopbot(world, new THREE.Vector3(...p));
      b.root.rotation.y = Math.PI;
      this.bots.push(b); world.fighters.push(b);
    }
    this.rotation = currentRotation();
    this.spawnCrowd();
    // news studio + big screen
    this.studio = new NewsStudio();
    pz.decor.screen.material.map = this.studio.texture;
    pz.decor.screen.material.color.set(0xffffff);
    pz.decor.screen.material.needsUpdate = true;
    const rot = this.rotation;
    pz.decor.setTicker(`PRISM NEWS · NOW PLAYING: ${rot.names.join(' & ').toUpperCase()} · NEW GEAR AT SCALE & THREAD · BLASTWORKS RESTOCKED · `);
    this.newsT = 0;
    // UI
    this.prompt = document.getElementById('prompt');
    this.bubble = document.getElementById('bubble');
    this.toastEl = document.getElementById('toast');
    this.plazaHud = document.getElementById('plaza-hud');
    this.newsEl = document.getElementById('news');
    this.fadeEl = document.getElementById('fade');
    this.plazaHud.classList.add('on');
    this.updatePlazaHud();
    this.time = 0;
    this.showcase = null;
    this.uiOpen = false;
    this.hitT = 0;
    this.applyVisibility();
    app.renderer.compile(scene, this.camera);
    app.audio?.music('plaza');
    this.fountainLoop = app.audio?.loop('fountain', { x: 0, y: 1, z: 4 });
    this.crowdLoop = app.audio?.loop('crowd');
    this.crowdLoop?.setVolume(0.45);
    if (this.opts.title) this.titleMode = true;
  }

  spawnCrowd() {
    const world = this.world, pz = this.pz;
    const npcColor = () => new THREE.Color(pick(COLOR_PAIRS)[Math.random() < 0.5 ? 'a' : 'b']);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let ni = 0;
    const nm = () => names[ni++ % names.length];
    this.npcs = [];
    const add = (o) => { const n = new NPC(world, { name: nm(), color: npcColor(), ...o }); this.npcs.push(n); return n; };
    // wanderers
    for (let i = 0; i < 7; i++) {
      let pos;
      for (;;) { pos = new THREE.Vector3(rand(-24, 24), 0, rand(-22, 28)); if (Math.hypot(pos.x, pos.z - 4) > 7 && pz.level.heightAt(pos.x, pos.z).y < 0.05) break; }
      add({ pos });
    }
    // chatting groups
    for (const [cx, cz] of [[-14, -8], [14, -10], [6, 22], [-8, 24]]) {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
        const pos = new THREE.Vector3(cx + Math.cos(a) * 0.95, 0, cz + Math.sin(a) * 0.95);
        add({ pos, mode: 'chat', yaw: Math.atan2(cx - pos.x, cz - pos.z) });
      }
    }
    // sitters on the tower steps, dancers at the DJ booth
    for (let i = 0; i < 4; i++) add({ pos: new THREE.Vector3(-6 + i * 4 + rand(-0.4, 0.4), 0.37, -27.1), mode: 'fixed', emote: 'sit', yaw: 0 });
    for (let i = 0; i < 4; i++) add({ pos: new THREE.Vector3(-25 + (i % 2) * 1.6, 0.6, 4 + i * 1.3), mode: 'fixed', emote: 'dance', yaw: Math.PI / 2 + rand(-0.5, 0.5) });
    add({ pos: new THREE.Vector3(-26.2, 0.6, 6), mode: 'fixed', emote: 'dance', yaw: Math.PI / 2, name: 'DJ Wobble', lines: ['This track? Fresh out of my brain. You like it?', 'Requests are closed. The vibe decides.'] });
    // ink swimmers in a painted patch by the fountain
    const patch = new THREE.Vector3(9, 0, 10);
    this.pz.paint.splat(patch.clone().setY(0.02), 3.2, 2, { wobble: 0.3 });
    for (let i = 0; i < 2; i++) { const s = add({ pos: patch.clone().setY(0), swim: true, swimR: 1.6 + i * 0.7, interactive: false }); s.swimA = i * 3; }
    // shop staff + guides
    const W = ROOMS.weapons, G = ROOMS.gear;
    const staff = [
      { name: 'Vex', pos: W.clerk, yaw: 0, weapon: 'spritzer', look: { skin: '#d97b54', pattern: 'bands', patternColor: '#3d2b1f', crest: 'horns', eyes: '#18b06a', bottom: '#3d405b', hat: 'goggles', clothes: 'vest', shoes: 'boots_black' }, lines: ['Welcome to <b>Blastworks</b>! Every weapon comes with a sub and a special.', 'Want to feel one out first? Hit <b>TRY IT</b> and go wreck some Bopbots.'] },
      { name: 'Lumi', pos: G.clerk, yaw: 0, look: { skin: '#c98be0', pattern: 'spots', patternColor: '#f4f1ea', crest: 'fan', eyes: '#3a7bff', bottom: '#1d3557', hat: 'beret', clothes: 'raincoat', shoes: 'slip_sun' }, lines: ['Scale &amp; Thread, darling! Every piece has an ability — dress to win.', 'Headgear, clothing, shoes. Mix the abilities that suit your weapon!'] },
      { name: 'Kiko', pos: G.stylist.clone().setY(G.stylist.y + 0.3), yaw: 0.4, emote: 'think', look: { skin: '#e0b54a', pattern: 'stripes', patternColor: '#7a2f2f', crest: 'round', eyes: '#e63946', bottom: '#6d597a', hat: 'none', clothes: 'tee_pink', shoes: 'kicks_white' }, lines: ['Sit down, sit down! New crest? New scales? I can do it all.'] },
      { name: 'Gate', pos: new THREE.Vector3(-4.6, 0.7, -28.6), yaw: 0.3, weapon: 'roller', lines: ['The Clash Tower runs Turf Rush all day. Walk up to the door when you\'re ready!', `Current stages: <b>${this.rotation.names.join('</b> and <b>')}</b>.`] },
      { name: 'Coach Pip', pos: new THREE.Vector3(-11, 0.6, 38.5), yaw: 0.6, weapon: 'longshot', lines: ['This is the <b>Practice Yard</b>. Splash those Bopbots to test your weapon!', 'Paint a wall, then hold <b>SHIFT</b> and swim up it.', 'Right-click throws your sub weapon. Subs cost a big chunk of ink!'] },
    ];
    this.staff = {};
    for (const s of staff) {
      const n = add({ ...s, color: npcColor(), mode: 'fixed', emote: s.emote ?? null });
      n.room = s.name === 'Vex' ? 'weapons' : s.name === 'Lumi' || s.name === 'Kiko' ? 'gear' : 'plaza';
      this.staff[s.name] = n;
    }
  }

  updatePlazaHud() {
    const p = this.app.profile;
    const w = WEAPONS[this.player.weapon.id];
    this.plazaHud.innerHTML = `
      <div class="ph-card">
        <div class="ph-name">${p.name}</div>
        <div class="ph-lvl">LV <b>${p.level}</b><div class="ph-xp"><i style="width:${Math.round(p.xp / this.app.xpFor(p.level) * 100)}%"></i></div></div>
      </div>
      <div class="ph-coins"><span class="coin">◉</span> ${p.coins.toLocaleString()}</div>
      <div class="ph-weapon">${w.name}${this.app.tryWeapon ? ' <em>(trying)</em>' : ''}</div>`;
  }

  toast(html) {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => this.toastEl.classList.remove('on'), 2600);
  }

  // ---------------------------------------------------------------- interactions
  nearest() {
    const p = this.player.pos;
    const S = PLAZA_SPOTS, W = ROOMS.weapons, G = ROOMS.gear;
    const near = (v, r) => Math.hypot(p.x - v.x, p.z - v.z) < r && Math.abs(p.y - v.y) < 2.5;
    if (this.location === 'plaza') {
      if (near(S.tower, 3.4)) return { kind: 'tower', label: 'Enter the <b>Clash Tower</b> — Battle!' };
      if (near(S.weaponDoor, 2.8)) return { kind: 'enter', room: 'weapons', label: 'Enter <b>Blastworks</b>' };
      if (near(S.gearDoor, 2.8)) return { kind: 'enter', room: 'gear', label: 'Enter <b>Scale &amp; Thread</b>' };
      if (near(S.manhole, 1.9)) return { kind: 'manhole', label: 'Lift the loose <b>manhole cover</b>…' };
      if (near(S.home, 2.4)) return { kind: 'home', label: 'Enter your <b>home</b>' };
    } else if (this.location === 'weapons') {
      if (near(W.exit, 2)) return { kind: 'exit', label: 'Back outside' };
      if (near(new THREE.Vector3(W.cx, W.counter.y, W.counter.z + 1), 2.6)) return { kind: 'shop', label: 'Talk to <b>Vex</b> — browse weapons' };
    } else if (this.location === 'gear') {
      if (near(G.exit, 2)) return { kind: 'exit', label: 'Back outside' };
      if (near(new THREE.Vector3(G.counter.x, G.counter.y, G.counter.z + 1), 2.6)) return { kind: 'gearshop', label: 'Talk to <b>Lumi</b> — browse gear' };
      if (near(G.salon, 2.2)) return { kind: 'salon', label: 'Sit in <b>Kiko</b>\'s chair — change your look' };
    }
    let best = null, bd = 2.4;
    for (const n of this.npcs) {
      if (!n.interactive) continue;
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
      const pitch = 0.85 + (it.npc.name.charCodeAt(0) % 7) * 0.08;
      for (let i = 0; i < 6; i++) setTimeout(() => app.audio?.sfx('talk', { pitch: pitch + Math.random() * 0.15, volume: 0.5 }), i * 80);
      return;
    }
    if (it.kind === 'enter') { this.goRoom(it.room); return; }
    if (it.kind === 'exit') { this.goRoom(null); return; }
    if (it.kind === 'home') { // Prism Heights: back to your house
      app.input.unlock();
      app.audio?.sfx('door');
      this.fadeEl.classList.add('on');
      setTimeout(() => app.goHouse(), 260);
      return;
    }
    if (it.kind === 'manhole') {
      app.input.unlock();
      this.uiOpen = true;
      app.audio?.sfx('door_heavy');
      app.menus.confirm({
        title: 'THE UNDERSIDE',
        text: 'Cold gray air is drifting up from below. Something down there is draining the color out of the city…<br><br>Climb down?',
        yes: 'CLIMB DOWN', no: 'NOPE',
        onYes: () => { this.uiOpen = false; app.goStory ? app.goStory('hub') : this.toast('The ladder is rusted shut… for now.'); },
        onNo: () => { this.uiOpen = false; app.input.lock(); },
      });
      return;
    }
    if (it.kind === 'tower') { app.audio?.sfx('door'); app.goTower({ floor: 0, from: 'plaza' }); return; }
    app.audio?.sfx('ui_select');
    this.openUI(it.kind);
  }

  // fade-to-black teleport between the plaza and the shop interiors
  goRoom(room) {
    if (this.fading) return;
    this.fading = true;
    const app = this.app;
    app.audio?.sfx('door');
    this.fadeEl.classList.add('on');
    setTimeout(() => {
      const p = this.player;
      if (room) {
        const r = ROOMS[room];
        p.place(r.entry.clone(), Math.PI);
        this.rig.snap(p, Math.PI);
        this.location = room;
        app.audio?.music('shop');
        this.crowdLoop?.setVolume(0.08);
        this.shopLoop = this.shopLoop || app.audio?.loop('shop_ambience');
        this.toast(room === 'weapons' ? 'Welcome to <b>Blastworks</b>' : 'Welcome to <b>Scale &amp; Thread</b>');
      } else {
        const r = ROOMS[this.location];
        const out = r.door.clone().add(new THREE.Vector3(-1.6, 0, 0));
        p.place(out, r.doorYaw);
        this.rig.snap(p, r.doorYaw);
        this.location = 'plaza';
        app.audio?.music('plaza');
        this.crowdLoop?.setVolume(0.45);
        this.shopLoop?.stop(); this.shopLoop = null;
      }
      this.env.follow(p.pos);
      this.applyVisibility();
      setTimeout(() => { this.fadeEl.classList.remove('on'); this.fading = false; }, 120);
    }, 280);
  }

  openUI(kind, opts = {}) {
    const app = this.app;
    this.uiOpen = true;
    app.input.unlock();
    this.prompt.classList.remove('on');
    this.plazaHud.classList.remove('on');
    const p = this.player;
    const close = () => { this.uiOpen = false; this.showcase = null; this.shopCam = null; p.model.emote = null; this.plazaHud.classList.add('on'); this.updatePlazaHud(); app.input.lock(); };
    if (kind === 'tower') {
      app.audio?.sfx('door');
      app.audio?.music('lobby');
      app.openTower(() => { app.audio?.music('plaza'); close(); });
    } else if (kind === 'shop') {
      const W = ROOMS.weapons;
      const P = W.pedestal.clone().setY(W.pedestal.y + 1.55);
      this.shopCam = { pos: P.clone().add(new THREE.Vector3(3.6, 0.8, 4.4)), look: P.clone().add(new THREE.Vector3(2.3, -0.35, 0)) };
      this.camera.position.copy(this.shopCam.pos);
      app.menus.weaponShop({
        onPreview: (id) => this.showOnPedestal(id),
        onEquip: (id) => { app.tryWeapon = null; p.setWeapon(id); this.updatePlazaHud(); },
        onTry: (id) => { app.tryWeapon = id; p.setWeapon(id); this.updatePlazaHud(); },
        onClose: close,
      });
    } else if (kind === 'gearshop') {
      const G = ROOMS.gear;
      p.place(G.tryOn.clone(), 0);
      this.showcase = 'left';
      app.menus.gearShop({
        onPreview: (look) => p.setLook(look),
        onEquip: (look) => p.setLook(look),
        onClose: close,
      });
    } else if (kind === 'salon' || kind === 'locker') {
      if (this.location === 'gear') p.place(ROOMS.gear.salon.clone().setY(ROOMS.gear.salon.y + 0.3), 0);
      this.showcase = 'right';
      p.model.emote = null;
      app.menus.salon({
        create: !!opts.create,
        onChange: (look, ink) => {
          p.setLook({ ...app.profile.look, ...look });
          if (ink) {
            this.colors[1].set(ink);
            p.model.setTeamColor(this.colors[1]);
            const other = COLOR_PAIRS.find((c) => c.a === ink)?.b || COLOR_PAIRS.find((c) => c.b === ink)?.a || '#3cf03c';
            this.colors[2].set(other);
            this.pz.paint.setColors(this.colors[1], this.colors[2]);
          }
        },
        onEmote: (e) => { if (e === 'tongue') { p.model.doTongue(); p.model.emote = null; } else p.model.emote = e; },
        onClose: () => { close(); if (opts.create) this.startNews(); },
      });
    }
  }

  // only draw what can be seen: the plaza outside, or the room you're in
  applyVisibility() {
    const outside = this.location === 'plaza';
    this.pz.decor.group.visible = outside;
    this.pz.interiors.group.visible = !outside;
    for (const n of this.npcs) n.model.root.visible = (n.room || 'plaza') === this.location || (!outside && n.room === this.location);
    for (const b of this.bots) b.root.visible = outside && b.alive;
    this.env.sky.visible = outside;
  }

  // let an outside flow (e.g. an online room) own the screen; returns the release function
  holdUI() {
    this.uiOpen = true;
    this.app.input.unlock();
    this.prompt.classList.remove('on');
    this.plazaHud.classList.remove('on');
    this.app.audio?.music('lobby');
    return () => { this.uiOpen = false; this.plazaHud.classList.add('on'); this.updatePlazaHud(); this.app.audio?.music('plaza'); this.app.input.lock(); };
  }

  showOnPedestal(id) {
    const disp = this.pz.interiors.display;
    disp.clear();
    const m = buildWeaponModel(id, this.colors[1], WEAPONS[id].type);
    m.scale.setScalar(2.3);
    m.rotation.x = -0.15;
    // centre long weapons over the pedestal
    const box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.sub(c);
    disp.add(m);
  }

  // ---------------------------------------------------------------- news broadcast
  startNews() {
    if (this.app.newsSeen || new URLSearchParams(location.search).has('nonews')) return;
    this.app.newsSeen = true;
    const rot = this.rotation;
    const quips = {
      terminal: 'Tangerine Terminal? Watch the water. Every. Single. Edge.',
      skyline: 'Skyline Courts — those light-wells are NOT shortcuts.',
      fizzwater: 'Fizzwater Works! Climb those silos and rain down on everybody.',
      mesa: 'Mesa Bazaar. Hold the central terrace and you hold the match.',
      frostbite: 'Frostbite Park — skate the bowl, mind the icy water.',
    };
    this.newsScript = [
      [1, 'Heyyy, Prism Plaza! You\'re tuned in to <b>PRISM NEWS</b>!'],
      [2, 'I\'m Dex, she\'s Nova, and the turf is looking extra colorful today.'],
      [1, `Turf Rush is live on <b>${rot.names[0]}</b> and <b>${rot.names[1] || rot.names[0]}</b>!`],
      [2, quips[rot.ids[0]] || `${rot.names[0]}? Bring something with range. Trust me.`],
      [1, 'Blastworks just restocked — word is the <b>Arc Bow</b> is flying off the walls!'],
      [2, 'And Scale &amp; Thread has fresh gear. Every piece has an ability.'],
      [1, 'Oh! And folks keep reporting creepy <b>gray goo</b> near the back alleys…'],
      [2, 'Probably nothing. Probably.'],
      [1, 'Stay fresh, everybody!'], [2, 'Stay fresh!'],
    ];
    this.newsI = -1;
    this.newsLineT = 0;
    this.newsOn = true;
    this.app.input.unlock();
    this.app.audio?.music('news');
    this.app.audio?.sfx('news_sting');
    this.newsEl.classList.add('on');
    this.plazaHud.classList.remove('on');
    this.newsSkip = (e) => { if (e.type === 'keydown' && e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'Escape') return; this.advanceNews(e.code === 'Escape'); };
    addEventListener('keydown', this.newsSkip);
    this.newsEl.onclick = () => this.advanceNews(false);
    this.advanceNews(false);
  }

  advanceNews(skipAll) {
    if (!this.newsOn) return;
    this.newsI++;
    if (skipAll || this.newsI >= this.newsScript.length) { this.endNews(); return; }
    const [who, text] = this.newsScript[this.newsI];
    const h = HOSTS[who - 1];
    this.newsEl.querySelector('.nw-name').textContent = h.name;
    this.newsEl.querySelector('.nw-name').style.background = h.color;
    this.newsEl.querySelector('.nw-text').innerHTML = text;
    this.newsSpeaker = who;
    this.newsLineT = 0;
    const pitch = who === 1 ? 1.25 : 0.95;
    for (let i = 0; i < 7; i++) setTimeout(() => { if (this.newsOn) this.app.audio?.sfx('talk', { pitch: pitch + Math.random() * 0.15, volume: 0.55 }); }, i * 85);
  }

  endNews() {
    this.newsOn = false;
    this.newsSpeaker = 0;
    this.newsEl.classList.remove('on');
    this.plazaHud.classList.add('on');
    removeEventListener('keydown', this.newsSkip);
    this.app.audio?.music('plaza');
    this.toast('Click to look around · <b>E</b> to interact');
  }

  openPause() {
    const app = this.app, inp = app.input;
    if (this.uiOpen || this.titleMode || this.newsOn) return;
    inp.unlock();
    this.uiOpen = true;
    app.menus.pause(true, {
      onResume: () => { this.uiOpen = false; inp.lock(); },
      onQuit: () => { this.uiOpen = false; app.goTitle(); },
      quitLabel: 'BACK TO TITLE',
    });
  }

  onLockLost() { this.openPause(); }

  // ---------------------------------------------------------------- loop
  update(dt) {
    const app = this.app, inp = app.input;
    this.time += dt;
    const p = this.player;
    const w = this.world;
    if (this.newsOn) {
      this.newsLineT += dt;
      if (this.newsLineT > 3.6) this.advanceNews(false);
      p.intent.mx = p.intent.mz = 0; p.intent.fire = p.intent.special = p.intent.sub = false;
    } else if (this.titleMode) {
      const a = this.time * 0.06 + 0.6;
      this.camera.position.set(Math.cos(a) * 30, 9 + Math.sin(this.time * 0.2) * 1.5, Math.sin(a) * 30 + 4);
      this.camera.lookAt(0, 5, -8);
      p.intent.mx = p.intent.mz = 0;
      p.model.emote = 'wave';
    } else if (this.uiOpen) {
      p.intent.mx = p.intent.mz = 0; p.intent.fire = p.intent.goo = p.intent.jump = p.intent.sub = p.intent.special = false;
      if (this.shopCam) {
        this.camera.position.lerp(this.shopCam.pos, damp(5, dt));
        this.camera.lookAt(this.shopCam.look);
      } else if (this.showcase) {
        const yaw = p.yaw;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const rx = -fz, rz = fx;
        const side = this.showcase === 'right' ? -1.05 : 1.6;
        const dist = this.showcase === 'right' ? 3.0 : 3.5;
        const tgt = new THREE.Vector3(p.pos.x + fx * dist - rx * side, p.pos.y + 1.25, p.pos.z + fz * dist - rz * side);
        this.camera.position.lerp(tgt, damp(5, dt));
        this.camera.lookAt(p.pos.x - rx * side, p.pos.y + 0.95, p.pos.z - rz * side);
      } else this.control.update(dt, p, w, false);
    } else {
      this.control.update(dt, p, w, true);
      if (inp.pressed('KeyE')) p.intent.special = false;
      if (inp.pressed('KeyT')) { p.model.doTongue(); app.audio?.sfx('tongue', { ...posOf(p.pos), volume: 0.6 }); }
      if (!inp.locked && inp.mousePressed[0]) inp.lock();
      const it = this.nearest();
      this.near = it;
      if (it) {
        this.prompt.innerHTML = `<span class="key">${inp.usingPad ? 'X' : 'E'}</span> ${it.label}`;
        this.prompt.classList.add('on');
        if (inp.action('interact')) { p.intent.fire = false; p.intent.special = false; this.interact(it); }
      } else this.prompt.classList.remove('on');
      if (inp.action('pause')) this.openPause();
    }
    if (!this.titleMode) p.update(dt);
    else p.syncModel(dt, false, 0);
    for (const b of this.bots) b.update(dt);
    for (const n of this.npcs) n.update(dt, p);
    this.combat.update(dt);
    this.fx.update(dt);
    this.env.update(dt);
    this.env.follow(this.titleMode ? new THREE.Vector3(0, 0, 0) : p.pos);
    this.pz.decor.update(this.time, dt, this.fx);
    this.pz.interiors.update(this.time);
    this.studio.update(dt, this.newsOn ? this.newsSpeaker : (Math.sin(this.time * 0.9) > 0 ? 1 : 2));
    w.listener.copy(this.camera.position);
    const camYaw = this.titleMode || this.uiOpen || this.newsOn ? Math.atan2(-this.camera.matrixWorld.elements[8], -this.camera.matrixWorld.elements[10]) : this.rig.yaw;
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, camYaw + Math.PI);
    if (this.bubbleNpc) {
      const v = this.bubbleNpc.pos.clone().setY(this.bubbleNpc.pos.y + 2.1).project(this.camera);
      this.bubble.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
    }
    const ret = document.getElementById('plaza-reticle');
    const active = !this.titleMode && !this.uiOpen && !this.newsOn;
    ret.classList.toggle('on', active && inp.locked);
    ret.classList.toggle('hit', (this.hitT -= dt) > 0);
    document.getElementById('plaza-cover').classList.toggle('on', active && !inp.locked && !inp.usingPad);
  }

  render(dt) {
    const app = this.app;
    this.pz.paint.flush(app.renderer);
    this.newsT += dt;
    if (this.newsOn) {
      this.studio.camera.aspect = innerWidth / innerHeight;
      this.studio.camera.updateProjectionMatrix();
      app.post.render(this.studio.scene, this.studio.camera, dt);
      return;
    }
    // big-screen feed (cheap: ~20 fps, only while outdoors)
    if (this.location === 'plaza' && this.newsT > 0.05) {
      this.newsT = 0;
      this.studio.camera.aspect = 16 / 9;
      this.studio.camera.updateProjectionMatrix();
      this.studio.render(app.renderer);
    }
    app.post.render(this.scene, this.camera, dt);
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  setTitleMode(on) {
    this.titleMode = on;
    if (!on) { this.player.model.emote = null; this.rig.snap(this.player, this.player.yaw); this.plazaHud.classList.add('on'); this.updatePlazaHud(); }
    else this.plazaHud.classList.remove('on');
  }

  dispose() {
    this.app.plazaPaint = this.pz.paint.data.slice();
    this.app.tryWeapon = null;
    if (this.newsOn) { this.newsOn = false; removeEventListener('keydown', this.newsSkip); this.newsEl.classList.remove('on'); }
    this.fountainLoop?.stop(); this.crowdLoop?.stop(); this.shopLoop?.stop();
    this.player.dispose();
    for (const n of this.npcs) n.model.dispose();
    this.combat.dispose();
    this.fx.dispose();
    this.studio.dispose();
    this.pz.level.dispose();
    this.pz.paint.dispose();
    this.env.dispose();
    this.prompt.classList.remove('on');
    this.bubble.classList.remove('on');
    this.plazaHud.classList.remove('on');
    this.fadeEl.classList.remove('on');
    document.getElementById('plaza-reticle').classList.remove('on');
    document.getElementById('plaza-cover').classList.remove('on');
    this.pz.paint.uniforms.uNoise.value?.dispose();
    disposeScene(this.scene);
  }
}
