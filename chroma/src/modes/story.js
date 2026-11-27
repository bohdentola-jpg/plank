// Story mode: "The Underside". A hub cavern under Prism Plaza with Captain Veil
// and five hatches, each leading to a self-contained course that ends at a
// stolen Hue Core. Level 5 is the boss fight against Baron Grisaille's Engine.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { Particles } from '../fx/particles.js';
import { Combat } from '../actors/weapons.js';
import { Fighter } from '../actors/fighter.js';
import { Dripkin } from '../actors/character.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { Course } from '../story/course.js';
import { LEVELS, ORDER, INFO, GRAY_INK } from '../story/levels.js';
import { makeEnemy, GRAY_HEX } from '../story/enemies.js';
import { GrisailleEngine, HEART_HP } from '../story/boss.js';
import { Checkpoint, JumpPad, Swatch, HueCore, Hatch, Lift, CoreShelf, arcPoint, JUMP_G } from '../story/props.js';
import { StoryHUD } from '../story/hud.js';
import * as D from '../story/dialogue.js';
import { textSprite, std, part, posOf } from '../story/kit.js';

const VEIL_LOOK = { skin: '#d8f5c9', hair: 'mohawk', eyes: '#e0b000', top: '#3d405b', topStyle: 'jacket', bottom: '#5a4a3a', shoes: '#1b1530' };
const VEIL_INK = '#a46bff';
const UP = new THREE.Vector3(0, 1, 0);
const damp = (r, dt) => 1 - Math.exp(-r * dt);
const rand = (a, b) => a + Math.random() * (b - a);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fmtTime = (t) => { t = Math.max(0, Math.floor(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p0 = new THREE.Vector3(), _v = new THREE.Vector3();

export function storyProgress(profile) {
  const s = profile?.story;
  return {
    cleared: Array.isArray(s?.cleared) ? s.cleared.filter((id) => INFO[id]) : [],
    swatches: Array.isArray(s?.swatches) ? s.swatches.filter((id) => INFO[id]) : [],
  };
}

export class Story {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.levelId = LEVELS[opts.level] ? opts.level : 'hub';
  }

  get progress() { return storyProgress(this.app.profile); }

  ensureStory() {
    const prof = this.app.profile;
    const pr = storyProgress(prof);
    if (!prof.story || typeof prof.story !== 'object') prof.story = {};
    prof.story.cleared = pr.cleared;
    prof.story.swatches = pr.swatches;
    return prof.story;
  }

  hatchStatus(id) {
    const { cleared } = this.progress;
    if (cleared.includes(id)) return 'cleared';
    const i = ORDER.indexOf(id);
    return i === 0 || cleared.includes(ORDER[i - 1]) ? 'open' : 'locked';
  }

  // ================================================================ init
  async init() {
    const app = this.app, prof = app.profile;
    const id = this.levelId;
    this.def = LEVELS[id];
    this.info = INFO[id] || null;
    this.isHub = id === 'hub';
    try { await Promise.race([document.fonts?.load?.('48px "Lilita One"'), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fonts optional */ }
    if (!this.isHub) this.ensureStory();

    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.08, 700);
    this.env = new Environment(scene, app.renderer, this.def.sky);
    this.colors = { 0: new THREE.Color(0xffffff), 1: new THREE.Color(prof.ink || '#ff2e88'), 2: new THREE.Color(GRAY_INK) };
    const c = this.course = new Course(scene, this.def);
    // point lights are the expensive part on weak GPUs / software GL
    c.maxLights = app.qualityPreset === 'qa' ? 2 : app.qualityPreset === 'low' ? 3 : 6;
    this.def.build(c, this);
    c.finish(app.renderer, this.colors);

    const fx = this.fx = new Particles(scene, 1300);
    const world = this.world = {
      scene, level: c.level, paint: c.paint, fx, colors: this.colors, audio: app.audio,
      fighters: [], listener: new THREE.Vector3(), combatOn: true, canRespawn: false,
      onHit: (a, v, dmg) => this.onHit(a, v, dmg),
      onSplat: (v, a, kind) => this.onSplat(v, a, kind),
      onPlayerHurt: (dmg, a) => this.onPlayerHurt(dmg, a),
      onLowInk: () => this.onLowInk(),
      onSpecial: () => {},
      onExplosion: (p, r) => { if (this.player && p.distanceTo(this.player.pos) < r * 3) this.rig.shake((0.5 * r) / 3, 0.35); },
      onPop: () => {},
      onEnemyDefeated: (e, a, kind) => this.onEnemyDefeated(e, a, kind),
      onEnemyHurt: () => {},
    };
    world.combat = this.combat = new Combat(world);

    // ---- player
    const player = this.player = new Fighter(world, { name: prof.name, team: 1, look: prof.look, weapon: prof.weapon, isPlayer: true, color: this.colors[1] });
    world.player = player;
    let sp = c.spawn.pos.clone(), yaw = c.spawn.yaw;
    if (this.isHub && this.opts.from) {
      const h = c.hatches.find((x) => x.id === this.opts.from);
      if (h) {
        const dir = new THREE.Vector3(-h.pos.x, 0, 5 - h.pos.z).normalize();
        sp = h.pos.clone().addScaledVector(dir, 3.1);
        yaw = Math.atan2(dir.x, dir.z);
      }
    }
    player.spawnPoint.copy(sp);
    player.spawnYaw = yaw;
    player.place(sp.clone(), yaw);
    world.fighters.push(player);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(player, yaw);
    this.control = new PlayerControl(app.input, this.rig);

    // ---- props
    const prog = this.progress;
    const parent = c.decor;
    this.checkpoints = c.checkpoints.map((d) => new Checkpoint(parent, d.pos, d.yaw));
    this.cpIndex = -1;
    this.pads = c.pads.map((d) => new JumpPad(parent, d));
    this.swatchFound = !!this.info && prog.swatches.includes(id);
    this.swatch = c.swatch && this.info ? new Swatch(parent, c.swatch.pos, this.info.swatchColors, this.swatchFound) : null;
    this.core = c.core && this.info ? new HueCore(parent, c.core.pos, this.info.color, { locked: !!c.core.gate }) : null;
    this.hatches = c.hatches.map((d) => new Hatch(parent, d, INFO[d.id], this.hatchStatus(d.id), prog.swatches.includes(d.id)));
    this.lifts = c.exits.map((d) => new Lift(parent, d.pos, d.yaw));
    this.shelf = c.shelfAt ? new CoreShelf(parent, c.shelfAt, Math.PI, ORDER.map((k) => INFO[k]), prog.cleared) : null;
    if (c.veil) this.makeVeil(c.veil);
    if (c.door) this.makeDoor();

    // ---- enemies
    this.enemies = [];
    this.toRemove = [];
    for (const d of c.enemies) this.spawnEnemy(d);
    this.gate = c.core?.gate || null;
    this.gateTotal = this.gate ? this.enemies.filter((e) => e.group === this.gate).length : 0;
    this.kills = 0;
    if (this.def.boss) {
      this.boss = new GrisailleEngine(world, c, {
        shake: (a, t) => this.rig.shake(a, t),
        say: (lines) => this.hud.dialog(lines, { blocking: false }),
        warn: (html, t) => this.hud.warn(html, t),
        spawnSmudge: (pos) => this.spawnEnemy({ kind: 'smudge', pos, group: 'boss', spawnIn: true }),
        minionCount: () => this.enemies.filter((e) => e.alive && e.group === 'boss').length,
        clearMinions: () => { for (const e of this.enemies) if (e.alive && e.group === 'boss') e.die(this.player, 'clear'); },
        onDefeated: () => this.onBossDefeated(),
      });
    }

    // ---- HUD
    const hud = this.hud = new StoryHUD(app);
    hud.setInk('#' + this.colors[1].getHexString());
    if (this.isHub) { hud.setLevel('◆', 'THE UNDERSIDE', VEIL_INK); hud.swatchCount(prog.swatches.length, ORDER.length); }
    else { hud.setLevel(this.info.num, this.info.name.toUpperCase(), this.info.color); hud.swatch(this.swatchFound ? 'found' : 'missing', this.info); }
    hud.coins(prof.coins);
    if (this.boss) hud.boss(false, 'BARON GRISAILLE\'S GRAY ENGINE', [HEART_HP / this.boss.max, (HEART_HP * 0.45) / this.boss.max]);

    // ---- state
    this.state = 'play';
    this.time = 0; this.levelTime = 0;
    this.deadT = 0; this.flight = null;
    this.cine = null; this.cineK = 0; this.cineLast = null;
    this.paused = false; this.leaving = false;
    this.talkI = 0; this.lowInkT = -9; this.sparkT = 0;
    this.swatchCoins = 0;
    app.audio?.music(null);
    app.audio?.music(this.def.music);
    if (this.isHub) {
      this.ambient = app.audio?.loop('fountain', { x: 16.5, y: 4, z: 13.4, volume: 0.22 });
      if (!prof.story) this.introT = 0.9;
      else if (this.opts.justCleared && this.opts.from === 'l5' && prog.cleared.length >= ORDER.length) this.endingT = 1.0;
      else if (this.opts.justCleared) {
        const next = ORDER.find((k) => !prog.cleared.includes(k));
        hud.toast(next ? `Hue Core recovered! Hatch <b>${INFO[next].num}</b> is now open.` : 'Hue Core recovered!', 4);
      } else hud.toast('Click to look around · <b>E</b> to interact', 3);
    } else {
      hud.banner(`LEVEL ${this.info.num}`, this.info.name, 3.2);
      this.radioT = 1.6;
    }
    app.renderer.compile(scene, this.camera);
  }

  makeVeil(d) {
    const look = { ...this.app.profile.look, ...VEIL_LOOK };
    const m = this.veil = new Dripkin(look, VEIL_INK, null);
    m.root.position.copy(d.pos);
    m.root.rotation.y = d.yaw;
    m.root.scale.setScalar(1.08);
    m.emote = 'think';
    this.scene.add(m.root);
    this.veilPos = d.pos.clone();
    this.veilYaw = d.yaw;
    this.veilBaseYaw = d.yaw;
    const tag = textSprite('CAPTAIN VEIL', { color: '#e0ccff', scale: 0.26 });
    tag.position.copy(d.pos).setY(d.pos.y + 2.2);
    this.course.decor.add(tag);
    this.veilBang = textSprite('!', { color: '#1b1530', bg: '#ffd21a', scale: 0.34, size: 70 });
    this.veilBang.position.copy(d.pos).setY(d.pos.y + 2.6);
    this.course.decor.add(this.veilBang);
    // a stool and a lantern for the old captain
    const g = new THREE.Group();
    g.position.copy(d.pos);
    this.course.decor.add(g);
    part(g, new THREE.CylinderGeometry(0.12, 0.14, 1.0, 10), std(0x6b4a32, 0.8), { pos: [1.1, 0.5, 0.2] });
    part(g, new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), std(0x6b4a32, 0.8), { pos: [1.1, 1.02, 0.2] });
    part(g, new THREE.CylinderGeometry(0.12, 0.14, 0.32, 12), std(0x2b2833, 0.4, 0.7), { pos: [1.1, 1.22, 0.2] });
    part(g, new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(3) }), { pos: [1.1, 1.25, 0.2], shadow: false });
    if (this.course.lights.length < this.course.maxLights) {
      const L = new THREE.PointLight(0xffb060, 8, 7, 1.6);
      L.position.set(1.1, 1.5, 0.2);
      g.add(L);
      this.course.lights.push(L);
    }
  }

  makeDoor() {
    const g = this.doorMesh = new THREE.Group();
    g.position.set(0, -5.2, -22.5);
    this.course.decor.add(g);
    part(g, new THREE.BoxGeometry(10, 10, 0.7), std(0x4a4652, 0.5, 0.7), {});
    for (let i = 0; i < 5; i++) part(g, new THREE.BoxGeometry(10.02, 0.5, 0.72), std(i % 2 ? 0x1b1530 : 0xffc83d, 0.6, 0.2), { pos: [0, -4.6 + i * 0.5 + 6.5, 0], shadow: false });
    this.doorTarget = -5.2;
  }

  spawnEnemy(d) {
    const e = makeEnemy(this.world, d);
    if (d.spawnIn) e.aggro = true;
    this.enemies.push(e);
    this.world.fighters.push(e);
    return e;
  }

  // ================================================================ events
  onHit(attacker, victim) {
    if (attacker !== this.player || victim === this.player) return;
    if (victim.shield) { this.hud.hit('block'); return; }
    this.hud.hit(victim.alive ? 'hit' : 'kill');
    if (!victim.boss_part) this.app.audio?.sfx('enemy_hit', { ...posOf(victim.pos), volume: 0.6 });
  }

  onSplat(victim, attacker, kind) {
    if (victim !== this.player) return;
    this.deadT = 0;
    this.deadFall = kind === 'fall';
    this.flight = null;
    this.hud.splatted(true, kind === 'fall' ? 'Whoops! Back to the last checkpoint…' : 'Back to the last checkpoint…');
  }

  onPlayerHurt() {
    this.hud.hurt();
    this.rig.shake(0.4, 0.25);
    this.app.audio?.sfx('hurt', { volume: 0.6 });
  }

  onLowInk() {
    if (this.time - this.lowInkT < 6) return;
    this.lowInkT = this.time;
    this.hud.toast('Out of ink! Hold <b>SHIFT</b> in your ink to refill.', 2.6);
  }

  onEnemyDefeated(e, attacker, kind) {
    if (attacker === this.player && kind !== 'clear') {
      this.kills++;
      this.app.audio?.sfx('ko_confirm', { volume: 0.45 });
    }
    if (e.group === 'boss') this.toRemove.push(e);
    if (this.gate && this.core?.locked && e.group === this.gate) {
      const left = this.enemies.filter((x) => x.group === this.gate && x.alive).length;
      if (left === 0) {
        this.core.unlock(this.fx);
        this.app.audio?.sfx('door_heavy', { ...posOf(this.core.pos), volume: 0.9 });
        this.hud.toast('The seal is broken! Grab the <b>Hue Core</b>!', 3.5);
      }
    }
  }

  onBossDefeated() {
    const pos = new THREE.Vector3(0, 0, -9.5);
    this.core = new HueCore(this.course.decor, pos, this.info.color, { rainbow: true });
    this.fx.explosion(pos.clone().setY(2), this.colors[1], 3);
    this.hud.boss(false);
    this.hud.toast('The Engine is down! Grab the <b>Prism Heart</b>!', 4);
    this.app.audio?.music('story_level');
  }

  // ================================================================ actions
  talk(lines, onDone, cine) {
    this.cine = cine || null;
    this.dlgT = this.time;
    this.hud.hideBanner();
    this.hud.dialog(lines, { blocking: true, onDone: () => { this.cine = null; onDone?.(); } });
  }

  veilShot(front) {
    const v = this.veilPos;
    if (front) return { pos: new THREE.Vector3(v.x + 1.4, v.y + 1.85, v.z - 4.0), look: new THREE.Vector3(v.x, v.y + 1.3, v.z) };
    const p = this.player.pos;
    const dir = _v.set(p.x - v.x, 0, p.z - v.z).normalize().clone();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const mid = v.clone().lerp(p, 0.5);
    return { pos: mid.clone().addScaledVector(side, 3.0).addScaledVector(dir, 1.6).setY(v.y + 1.9), look: v.clone().lerp(mid, 0.35).setY(v.y + 1.25) };
  }

  interact(it) {
    const app = this.app, hud = this.hud;
    if (it.kind === 'veil') {
      this.talkedVeil = true;
      this.veilWave = 1.4;
      const prog = this.progress;
      this.talk(D.veilTalk(prog.cleared.length, this.talkI++), null, this.veilShot(false));
    } else if (it.kind === 'hatch') {
      if (it.h.status === 'locked') { hud.toast(D.LOCKED, 2.6); app.audio?.sfx('ui_error'); return; }
      app.audio?.sfx('door_heavy', { volume: 0.9 });
      this.leaveTo(it.h.id, {}, `Descending to ${INFO[it.h.id].name}…`);
    } else if (it.kind === 'lift') {
      app.audio?.sfx('door', { volume: 0.8 });
      this.leaving = true;
      app.goPlaza();
    }
  }

  leaveTo(level, extra = {}, text) {
    if (this.leaving) return;
    this.leaving = true;
    const app = this.app;
    app.input.unlock();
    app.setMode(() => new Story(app, { level, ...extra }), text || 'Descending into the Underside…');
  }

  nearestInteract() {
    const p = this.player.pos;
    if (this.veil && flat(p, this.veilPos) < 2.7) return { kind: 'veil', label: 'Talk to <b>Captain Veil</b>' };
    for (const h of this.hatches) {
      if (flat(p, h.pos) < 2.3) {
        const inf = INFO[h.id];
        return { kind: 'hatch', h, label: h.status === 'locked' ? `Hatch ${inf.num}: <b>${inf.name}</b> (sealed)` : `Enter hatch ${inf.num}: <b>${inf.name}</b>` };
      }
    }
    for (const l of this.lifts) if (flat(p, l.pos) < 2.4) return { kind: 'lift', label: 'Ride the lift up to <b>Prism Plaza</b>' };
    return null;
  }

  activateCheckpoint(i) {
    const cp = this.checkpoints[i], p = this.player;
    this.cpIndex = i;
    cp.activate(this.colors[1]);
    p.spawnPoint.copy(cp.pos);
    p.spawnYaw = cp.yaw;
    p.ink = Math.max(p.ink, 1);
    this.fx.ring(cp.pos.clone().setY(cp.pos.y + 0.12), this.colors[1], 0.3, 2.6, 0.6, { alpha: 0.9 });
    this.fx.splash(cp.pos.clone().setY(cp.pos.y + 2.2), UP, this.colors[1], 16, 4, 0.08);
    this.app.audio?.sfx('checkpoint', { volume: 0.8 });
    this.hud.toast('<b>Checkpoint!</b> Ink refilled.', 2);
  }

  launch(pad) {
    const p = this.player;
    pad.cool = 0.9;
    this.flight = { arc: pad.arc, t: 0 };
    p.pos.copy(pad.arc.from);
    p.vel.set(pad.arc.vx, pad.arc.vy, pad.arc.vz);
    this.fx.ring(pad.pos.clone().setY(pad.pos.y + 0.2), 0xffd04a, 0.4, 2.4, 0.45, { alpha: 0.9 });
    this.fx.splash(pad.pos.clone().setY(pad.pos.y + 0.3), UP, 0xffd04a, 14, 6, 0.08);
    this.app.audio?.sfx('launch', { volume: 0.9 });
  }

  updateFlight(dt) {
    const f = this.flight, p = this.player;
    if (!f) return;
    if (!p.alive) { this.flight = null; return; }
    // pin the player to the arc; Fighter integrates one step from here
    arcPoint(f.arc, f.t, p.pos);
    p.vel.set(f.arc.vx, f.arc.vy - JUMP_G * f.t, f.arc.vz);
    f.t += dt;
    if (f.t >= f.arc.T || (f.t > 0.3 && p.onGround)) {
      this.flight = null;
      p.vel.x *= 0.3; p.vel.z *= 0.3;
    }
  }

  collectSwatch() {
    const s = this.swatch, prof = this.app.profile, id = this.levelId;
    s.take();
    this.fx.explosion(s.pos.clone(), this.info.swatchColors[1], 1.4);
    for (const col of this.info.swatchColors) this.fx.splash(s.pos.clone(), UP, col, 10, 5, 0.07);
    this.app.audio?.sfx('pickup', { volume: 1 });
    const story = this.ensureStory();
    if (!story.swatches.includes(id)) {
      story.swatches.push(id);
      prof.coins += 150;
      this.swatchCoins = 150;
      this.hud.toast(`Lost Swatch found: <b>${this.info.swatch}</b>! <b>+150 ◉</b>`, 3.5);
    } else this.hud.toast(`Lost Swatch: <b>${this.info.swatch}</b> (already in your collection)`, 3);
    this.swatchFound = true;
    this.app.save();
    this.hud.swatch('found', this.info);
    this.hud.coins(prof.coins);
  }

  completeLevel() {
    if (this.state === 'clear') return;
    const app = this.app, prof = app.profile, id = this.levelId, hud = this.hud;
    this.state = 'clear';
    this.clearT = 0;
    const story = this.ensureStory();
    const first = !story.cleared.includes(id);
    if (first) { story.cleared.push(id); prof.coins += 400; }
    this.firstClear = first;
    app.save();
    hud.coins(prof.coins);
    const core = this.core;
    core.take();
    const cp = core.pos.clone().setY(core.pos.y + 2.3);
    this.fx.explosion(cp, core.color, 3.2);
    this.fx.ring(core.pos.clone().setY(core.pos.y + 0.6), core.color, 0.5, 9, 1.1, { alpha: 0.9 });
    for (let i = 0; i < 5; i++) this.fx.splash(cp, UP, new THREE.Color().setHSL(i / 5, 0.85, 0.6), 14, 8, 0.1, 1.3);
    // the Drab flee from the light
    for (const e of this.enemies) if (e.alive) e.die(this.player, 'clear');
    this.world.combatOn = false;
    this.player.invuln = 999; // stray blobs still in flight can't splat the celebration
    app.audio?.sfx('core_get', { volume: 1 });
    app.audio?.music('story_clear');
    hud.banner('HUE CORE RECOVERED!', this.info.core, 4, true);
    hud.tip(null);
    hud.prompt(null);
    this.clearData = {
      num: this.info.num, name: this.info.name, core: this.info.core, color: this.info.color, time: fmtTime(this.levelTime),
      swatch: this.swatchFound, swatchName: this.info.swatch, kills: this.kills, coins: (first ? 400 : 0) + this.swatchCoins,
      cta: id === 'l5' && first ? 'RETURN THE PRISM HEART ▶' : 'BACK TO THE HIDEOUT ▶',
    };
  }

  continueFromClear() {
    if (this.clearContinued) return;
    this.clearContinued = true;
    this.app.audio?.sfx('ui_select');
    this.leaveTo('hub', { from: this.levelId, justCleared: this.firstClear }, 'Back to the hideout…');
  }

  startBoss() {
    const b = this.boss, c = this.course, p = this.player;
    b.start();
    this.radioT = null;
    this.hud.queued = null;
    c.door.collide = true;
    this.doorTarget = 5;
    this.app.audio?.sfx('door_heavy', { volume: 1 });
    p.spawnPoint.set(0, 0, -16);
    p.spawnYaw = 0;
    this.cpIndex = this.checkpoints.length; // the antechamber is behind the door now
    this.talk(D.BOSS_INTRO, () => {
      b.begin();
      this.app.audio?.music('story_boss');
      this.hud.boss(true);
    }, { pos: new THREE.Vector3(3.5, 3.2, -17), look: new THREE.Vector3(0, 7.2, 0) });
  }

  setPaused(on) {
    const app = this.app;
    this.paused = on;
    if (on) {
      const pl = this.player;
      if (pl.loops && typeof pl.stopLoop === 'function') for (const k of Object.keys(pl.loops)) pl.stopLoop(k);
    }
    app.menus.pause(on, {
      onResume: () => { this.setPaused(false); app.input.lock(); },
      onQuit: () => { app.menus.pause(false); this.leaving = true; app.goPlaza(); },
      quitLabel: 'LEAVE THE UNDERSIDE',
    });
  }

  onLockLost() {
    if (!this.paused && !this.leaving && !this.hud.clearOpen) this.setPaused(true);
  }

  // ================================================================ frame
  objective() {
    const prog = this.progress;
    if (this.isHub) {
      if (!this.app.profile.story) return 'Talk to <b>Captain Veil</b>';
      const next = ORDER.find((k) => !prog.cleared.includes(k));
      const cores = `Hue Cores <b>${prog.cleared.length}/${ORDER.length}</b> · `;
      return next ? `${cores}Enter hatch <b>${INFO[next].num}: ${INFO[next].name}</b>` : 'All five Hue Cores recovered! Ride the <b>lift</b> back to the plaza.';
    }
    if (this.state === 'clear') return 'Hue Core recovered!';
    if (this.boss) {
      if (this.boss.state === 'dormant') return 'Head through the door into the <b>Engine Room</b>';
      if (this.boss.state === 'dead') return 'Grab the <b>Prism Heart</b>!';
      return 'Defeat <b>Baron Grisaille\'s Gray Engine</b>';
    }
    if (this.core?.locked) {
      const dead = this.enemies.filter((e) => e.group === this.gate && !e.alive).length;
      return `Splash the guards to break the seal: <b>${dead}/${this.gateTotal}</b>`;
    }
    return 'Reach the <b>Hue Core</b>';
  }

  update(dt) {
    if (this.leaving || this.paused) return;
    const app = this.app, inp = app.input, hud = this.hud, p = this.player, w = this.world;
    if (inp.action('pause') && !hud.clearOpen) { this.setPaused(true); inp.unlock(); return; }
    this.time += dt;
    if (this.state === 'play') this.levelTime += dt;

    // ---- dialogue + overlays
    const dialogWasOpen = hud.dialogBlocking;
    const anyKey = inp.pressed('KeyE') || inp.pressed('Space') || inp.pressed('Enter') || inp.padPressed(0);
    if (hud.dialogBlocking && (anyKey || inp.mousePressed[0]) && this.time - (this.dlgT || 0) > 0.3) hud.advance();
    if (this.state === 'clear') {
      this.clearT += dt;
      if (this.clearT > 2.4 && !hud.clearOpen) { hud.showClear(this.clearData, () => this.continueFromClear()); inp.unlock(); }
      if (hud.clearOpen && anyKey && this.clearT > 3) this.continueFromClear();
    }
    if (this.introT != null && (this.introT -= dt) <= 0) {
      this.introT = null;
      this.talk(D.INTRO, () => {
        this.ensureStory();
        app.save();
        hud.toast('Hatch <b>1</b> is open! Walk up to it and press <b>E</b>.', 4.5);
      }, this.veilShot(true));
    }
    if (this.endingT != null && (this.endingT -= dt) <= 0) { this.endingT = null; this.talkedVeil = true; this.talk(D.ENDING, null, this.veilShot(true)); }
    if (this.radioT != null && (this.radioT -= dt) <= 0) { this.radioT = null; hud.dialog(D.LEVEL_RADIO[this.levelId], { blocking: false }); }

    // ---- player control
    const blocked = dialogWasOpen || hud.dialogBlocking || this.state === 'clear';
    const canControl = !blocked && (inp.locked || inp.usingPad);
    this.control.update(dt, p, w, canControl);
    const I = p.intent;
    if (inp.pressed('KeyE')) I.special = false; // E is interact/advance here (Q still fires specials)
    if (!canControl || !p.alive) { I.mx = I.mz = 0; I.fire = I.jump = I.sub = I.special = I.goo = false; }
    if (this.flight) { I.mx = I.mz = 0; I.jump = false; I.goo = false; }
    this.updateFlight(dt);
    p.update(dt);
    if (this.state === 'clear') this.rig.yaw += dt * 0.35;

    // ---- death / respawn
    if (!p.alive) {
      this.deadT += dt;
      if (this.deadT > (this.deadFall ? 1.3 : 2.4)) {
        p.respawn();
        this.rig.snap(p, p.spawnYaw);
        hud.splatted(false);
      }
    }

    // ---- enemies + boss
    const ctx = this.ctx || (this.ctx = { player: p, enemies: this.enemies, near: (pos) => pos.distanceToSquared(this.camera.position) < 900 });
    if (this.state !== 'clear') {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.pos.distanceToSquared(p.pos) > 48 * 48 && e.group !== 'boss') continue;
        e.update(dt, ctx);
      }
    }
    this.boss?.update(dt, ctx);
    if (this.toRemove.length) {
      for (const e of this.toRemove) {
        const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1);
        const j = w.fighters.indexOf(e); if (j >= 0) w.fighters.splice(j, 1);
        e.dispose();
      }
      this.toRemove.length = 0;
    }

    // ---- triggers
    if (p.alive && this.state === 'play') this.triggers(dt);

    // ---- world
    this.combat.update(dt);
    this.fx.update(dt);
    this.env.update(dt);
    this.env.follow(p.alive ? p.pos : this.rig.pivot);
    for (const cp of this.checkpoints) cp.update(dt);
    for (const pad of this.pads) pad.update(dt, p.pos);
    this.swatch?.update(dt, this.fx);
    this.core?.update(dt, this.fx);
    for (const h of this.hatches) h.update(dt, this.fx, p.pos);
    for (const l of this.lifts) l.update(dt);
    this.shelf?.update(dt);
    if (this.doorMesh) this.doorMesh.position.y += (this.doorTarget - this.doorMesh.position.y) * damp(3, dt);
    this.updateVeil(dt);
    this.ambientFx(dt);

    // ---- hub interaction
    if (this.isHub && this.state === 'play') {
      const it = !hud.dialogBlocking && p.alive ? this.nearestInteract() : null;
      hud.prompt(it ? it.label : null, inp.usingPad ? 'X' : 'E');
      if (it && !dialogWasOpen && !hud.dialogBlocking && inp.action('interact')) this.interact(it);
    }

    // ---- camera (cinematic blend) + audio listener
    this.updateCine(dt);
    w.listener.copy(this.camera.position);
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.rig.yaw + Math.PI);

    // ---- grading: the Underside is a little washed out until its colour comes back
    const prog = this.progress;
    const baseDesat = this.isHub ? 0.32 * (1 - prog.cleared.length / ORDER.length) : this.state === 'clear' ? 0 : 0.14;
    const hurtK = p.alive ? Math.max(0, 1 - p.hp / 100) : 0.6;
    const u = app.post.uniforms;
    u.uVignette.value += ((0.62 + hurtK * 0.7) - u.uVignette.value) * damp(6, dt);
    u.uDesat.value += ((p.alive ? baseDesat + hurtK * 0.25 : 0.5) - u.uDesat.value) * damp(5, dt);

    // ---- HUD
    hud.vitals(p);
    hud.objective(this.objective());
    if (this.boss && this.boss.state !== 'dormant' && this.boss.state !== 'intro' && this.boss.state !== 'dead') hud.bossBar(this.boss.frac, this.boss.label);
    const playing = this.state === 'play' && !hud.dialogBlocking;
    hud.reticle(playing && p.alive && (inp.locked || inp.usingPad), p.form === 'goo', this.control.aimTarget);
    hud.showPlay(!this.cine);
    if (!inp.locked && inp.mousePressed[0] && !hud.clearOpen) inp.lock();
    hud.cover(playing && !inp.locked && !inp.usingPad && p.alive);
    hud.update(dt);
  }

  triggers(dt) {
    const p = this.player, c = this.course, hud = this.hud;
    for (let i = this.cpIndex + 1; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (flat(p.pos, cp.pos) < 2.2 && Math.abs(p.pos.y - cp.pos.y) < 2.5) { this.activateCheckpoint(i); break; }
    }
    if (!this.flight) {
      for (const pad of this.pads) {
        pad.cool = Math.max(0, pad.cool - dt);
        const dy = p.pos.y - pad.pos.y;
        if (pad.cool <= 0 && flat(p.pos, pad.pos) < 1.15 && dy > -0.3 && dy < 0.8) { this.launch(pad); break; }
      }
    }
    if (this.swatch && !this.swatch.taken && _v.copy(p.pos).setY(p.pos.y + 0.8).distanceTo(this.swatch.pos) < 1.5) this.collectSwatch();
    const core = this.core;
    if (core && !core.taken && !core.locked && flat(p.pos, core.pos) < 2.2 && p.pos.y > core.pos.y - 0.6 && p.pos.y < core.pos.y + 3.5) this.completeLevel();
    // tips
    let tip = null;
    for (const t of c.tips) {
      if (p.pos.x < t.min[0] || p.pos.x > t.max[0] || p.pos.z < t.min[1] || p.pos.z > t.max[1]) continue;
      if (t.minY != null && p.pos.y < t.minY) continue;
      if (t.maxY != null && p.pos.y > t.maxY) continue;
      tip = t.html; break;
    }
    if (tip && !hud.dialogBlocking) hud.tip(tip);
    // zones
    for (const z of c.zones) {
      if (z.id === 'arena' && this.boss?.state === 'dormant' && p.pos.x > z.min.x && p.pos.x < z.max.x && p.pos.z > z.min.z && p.pos.z < z.max.z) this.startBoss();
    }
  }

  updateVeil(dt) {
    const m = this.veil;
    if (!m) return;
    const p = this.player;
    const near = flat(p.pos, this.veilPos) < 7;
    const want = near ? Math.atan2(p.pos.x - this.veilPos.x, p.pos.z - this.veilPos.z) : this.veilBaseYaw;
    let d = (want - this.veilYaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    this.veilYaw += d * damp(4, dt);
    m.root.rotation.y = this.veilYaw;
    if (this.veilWave > 0) { this.veilWave -= dt; m.emote = 'wave'; } else m.emote = 'think';
    m.update(dt, { speed: 0, grounded: true, vy: 0, pitch: 0, weapon: null });
    if (this.veilBang) {
      this.veilBang.visible = !this.talkedVeil && !this.hud.dialogBlocking;
      this.veilBang.position.y = this.veilPos.y + 2.6 + Math.sin(this.time * 4) * 0.08;
    }
  }

  ambientFx(dt) {
    const c = this.course, p = this.player, fx = this.fx;
    // ghost-floor shimmer: faint sparkles on unpainted invisible surfaces near the player
    if (c.ghosts.length) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.075;
        if (!this.nearGhosts || (this.nearGhostT = (this.nearGhostT || 0) - 1) <= 0) {
          this.nearGhostT = 8;
          this.nearGhosts = c.ghosts.filter((s) => Math.max(s.min.x - p.pos.x, p.pos.x - s.max.x, 0) ** 2 + Math.max(s.min.z - p.pos.z, p.pos.z - s.max.z, 0) ** 2 < 13 * 13);
        }
        const s = this.nearGhosts[Math.floor(Math.random() * this.nearGhosts.length)];
        if (s) {
          _v.set(rand(s.min.x, s.max.x), s.max.y + 0.03, rand(s.min.z, s.max.z));
          const face = s.sideFace?.top;
          if (face && c.paint.ownerAt(face, _v) === 0) fx.spawn(_v, _p0.set(0, rand(0.3, 0.8), 0), 0xd8f8ff, 0.03, 0.9, { grav: -0.02, drag: 1.5 });
        }
      }
    }
    // dust motes / goo drips in the hub
    if (this.isHub && Math.random() < dt * 4) fx.spawn(_v.set(16.5 + rand(-0.2, 0.2), 7.6, 13.4), _p0.set(0, -1, 0), GRAY_HEX, rand(0.06, 0.1), 1.0, { floorY: 5.2, drag: 0 });
  }

  updateCine(dt) {
    if (this.cine) { this.cineLast = this.cine; this.cineK = Math.min(1, this.cineK + dt * 1.8); }
    else this.cineK = Math.max(0, this.cineK - dt * 2.2);
    if (this.cineK <= 0 || !this.cineLast) return;
    const cam = this.camera, k = this.cineK * this.cineK * (3 - 2 * this.cineK);
    _q0.copy(cam.quaternion);
    _p0.copy(cam.position);
    _m.lookAt(this.cineLast.pos, this.cineLast.look, UP);
    _q1.setFromRotationMatrix(_m);
    cam.position.lerpVectors(_p0, this.cineLast.pos, k);
    cam.quaternion.slerpQuaternions(_q0, _q1, k);
  }

  render(dt) {
    this.course.paint.flush(this.app.renderer);
    this.app.post.render(this.scene, this.camera, dt);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    this.hud.dispose();
    this.ambient?.stop();
    // free GPU buffers of everything still attached (character models drop their
    // root without disposing geometry); shared geometries simply re-upload later
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
    for (const e of this.enemies) e.dispose();
    this.boss?.dispose();
    this.player.dispose();
    this.veil?.dispose();
    for (const x of [...this.checkpoints, ...this.pads, ...this.hatches, ...this.lifts, this.swatch, this.core, this.shelf]) x?.dispose();
    this.combat.dispose();
    this.fx.dispose();
    this.course.dispose();
    this.env.dispose();
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
    this.scene.clear();
  }
}
