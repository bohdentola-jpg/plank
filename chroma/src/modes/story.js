// Story mode: "The Underside". A hideout cavern under Prism Plaza with Captain
// Veil, three sectors of levels behind hatches (sector 1 in the hideout itself,
// sectors 2 and 3 behind big gates with hubs of their own), a boss at the end of
// each sector, Hue Shards to spend on story upgrades, and Lost Swatches to find.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { Particles } from '../fx/particles.js';
import { Combat } from '../actors/weapons.js';
import { Fighter } from '../actors/fighter.js';
import { Dripkin } from '../actors/character.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { Course } from '../story/course.js';
import { LEVELS } from '../story/levels.js';
import { INFO, ORDER, SECTORS, SWATCHES, SWATCH_IDS, GRAY_INK, sectorOf } from '../story/info.js';
import { readStory, ensureStory, upgradeEffects, UPGRADES, UPGRADE, buyUpgrade, upgradeCost, levelSwatchesFound, CLEAR_SHARDS, BOSS_SHARDS } from '../story/progress.js';
import { GRAY_HEX } from '../story/enemies.js';
import { spawnDrab } from '../story/enemies2.js';
import { GrisailleEngine } from '../story/boss.js';
import { Grimewyrm } from '../story/boss2.js';
import { BaronGrisaille } from '../story/boss3.js';
import { Mechanics } from '../story/mechanics.js';
import { makeNPC, SectorGate } from '../story/npcs.js';
import { Checkpoint, JumpPad, Swatch, HueCore, Hatch, Lift, CoreShelf, arcPoint, JUMP_G } from '../story/props.js';
import { StoryHUD } from '../story/hud.js';
import * as D from '../story/dialogue.js';
import { textSprite, std, part, posOf } from '../story/kit.js';

const VEIL_LOOK = { skin: '#d8f5c9', hair: 'mohawk', eyes: '#e0b000', top: '#3d405b', topStyle: 'jacket', bottom: '#5a4a3a', shoes: '#1b1530' };
const VEIL_INK = '#a46bff';
const BOSSES = { engine: GrisailleEngine, wyrm: Grimewyrm, baron: BaronGrisaille };
const SHARD_DROP = { Smudge: 1, Splotch: 2, Splotchling: 1, Splotchlet: 0, Blotter: 2, 'Big Blotter': 6, 'Drab Drone': 2, Warden: 4, Glint: 3, Rumbler: 4, Gooper: 3, Pilfer: 2 };
const UP = new THREE.Vector3(0, 1, 0);
const damp = (r, dt) => 1 - Math.exp(-r * dt);
const rand = (a, b) => a + Math.random() * (b - a);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fmtTime = (t) => { t = Math.max(0, Math.floor(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p0 = new THREE.Vector3(), _v = new THREE.Vector3();

export function storyProgress(profile) { return readStory(profile); }

export class Story {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.levelId = LEVELS[opts.level] ? opts.level : 'hub';
  }

  get progress() { return readStory(this.app.profile); }
  ensureStory() { return ensureStory(this.app.profile); }

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
    this.isHub = !!this.def.hub;
    this.sector = sectorOf(id);
    try { await Promise.race([document.fonts?.load?.('48px "Lilita One"'), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fonts optional */ }
    const hadStory = !!prof.story;
    if (!this.isHub || hadStory) this.story = this.ensureStory();
    const st = this.story || readStory(prof);
    this.effects = upgradeEffects(st);

    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.08, 700);
    this.env = new Environment(scene, app.renderer, this.def.sky);
    this.colors = { 0: new THREE.Color(0xffffff), 1: new THREE.Color(prof.ink || '#ff2e88'), 2: new THREE.Color(GRAY_INK) };
    const c = this.course = new Course(scene, this.def);
    // point lights are the expensive part on weak GPUs / software GL
    c.maxLights = app.qualityPreset === 'qa' ? 2 : app.qualityPreset === 'low' ? 3 : 6;
    if (this.def.dark) c.maxLights = Math.max(1, c.maxLights - 1); // keep one for the player's glow
    this.def.build(c, this);
    c.finish(app.renderer, this.colors);

    const fx = this.fx = new Particles(scene, 1300);
    const world = this.world = {
      scene, level: c.level, paint: c.paint, fx, colors: this.colors, audio: app.audio,
      fighters: [], listener: new THREE.Vector3(), combatOn: true, canRespawn: false, dmgMul: this.effects.power,
      onHit: (a, v, dmg) => this.onHit(a, v, dmg),
      onSplat: (v, a, kind) => this.onSplat(v, a, kind),
      onPlayerHurt: (dmg, a) => this.onPlayerHurt(dmg, a),
      onLowInk: () => this.onLowInk(),
      onSpecial: (f) => this.onSpecial(f),
      onExplosion: (p, r) => { if (this.player && p.distanceTo(this.player.pos) < r * 3) this.rig.shake((0.5 * r) / 3, 0.35); },
      onPop: () => {},
      onEnemyDefeated: (e, a, kind) => this.onEnemyDefeated(e, a, kind),
      onEnemyHurt: () => {},
      onInkStolen: () => { this.hud.toast('A <b>Pilfer</b> swiped your ink! Splash it to get it back!', 3); },
      spawnEnemy: (d) => this.spawnEnemy(d),
    };
    world.combat = this.combat = new Combat(world);

    // ---- player
    const player = this.player = new Fighter(world, { name: prof.name, team: 1, look: prof.look, weapon: prof.weapon, isPlayer: true, color: this.colors[1] });
    world.player = player;
    // story upgrades (gear multipliers are kept so upgrades bought mid-visit re-apply cleanly)
    this.gearMods = { inkRecover: player.mods.inkRecover, special: player.mods.special };
    const baseHurt = Object.getPrototypeOf(player).takeDamage;
    player.takeDamage = (dmg, a, k) => baseHurt.call(player, dmg * this.effects.armor, a, k);
    this.applyUpgrades();
    const { pos: sp, yaw } = this.spawnFor();
    player.spawnPoint.copy(sp);
    player.spawnYaw = yaw;
    player.place(sp.clone(), yaw);
    world.fighters.push(player);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(player, yaw);
    this.control = new PlayerControl(app.input, this.rig);
    if (this.def.dark && c.lights.length < c.maxLights + 1) {
      this.playerLight = new THREE.PointLight(this.colors[1], 7, 11, 1.6);
      this.playerLight.castShadow = false;
      scene.add(this.playerLight);
    }

    // ---- props
    const parent = c.decor;
    this.checkpoints = c.checkpoints.map((d) => new Checkpoint(parent, d.pos, d.yaw));
    this.cpIndex = -1;
    this.pads = c.pads.map((d) => new JumpPad(parent, d));
    this.swatches = [];
    if (this.info) {
      c.swatches.forEach((d, i) => {
        const sid = this.info.swatchIds[i];
        if (!sid) return;
        const s = new Swatch(parent, d.pos, SWATCHES[sid].colors, st.swatches.includes(sid));
        s.sid = sid;
        this.swatches.push(s);
      });
    }
    this.core = c.core && this.info ? new HueCore(parent, c.core.pos, this.info.color, { locked: !!(c.core.gate || c.core.need.length) }) : null;
    this.hatches = c.hatches.map((d) => new Hatch(parent, d, INFO[d.id], this.hatchStatus(d.id), { n: levelSwatchesFound(st, d.id), total: INFO[d.id].swatchIds.length }));
    this.lifts = c.exits.map((d) => { const l = new Lift(parent, d.pos, d.yaw); l.to = d.to; l.label = d.label; return l; });
    this.gates = c.gates.map((d) => {
      const sec = SECTORS.find((s) => s.hub === d.to) || SECTORS[0];
      const open = st.cleared.includes(d.needs);
      const g = new SectorGate(parent, d, sec, open, st.cleared.includes(sec.boss));
      return g;
    });
    this.shelf = c.shelfAt ? new CoreShelf(parent, c.shelfAt, Math.PI, this.def.shelf ? this.def.shelf.map((k) => ({ id: k, ...INFO[k] })) : ORDER.slice(0, 5).map((k) => INFO[k]), st.cleared) : null;
    if (c.veil) this.makeVeil(c.veil);
    if (c.door) this.makeDoor();
    this.npcs = [];
    for (const d of c.npcs) {
      if (d.when && !d.when(st)) continue;
      const n = makeNPC(parent, d, scene);
      if (n) this.npcs.push(n);
    }

    // ---- enemies
    this.enemies = [];
    this.toRemove = [];
    for (const d of c.enemies) this.spawnEnemy(d);
    this.gate = c.core?.gate || null;
    this.gateTotal = this.gate ? this.enemies.filter((e) => e.group === this.gate).length : 0;
    this.kills = 0;

    // ---- mechanics (shards need to know which ones were already collected)
    this.shardsGot = [...(st.got?.[id] || [])];
    this.runShards = 0;
    this.mech = new Mechanics(this);

    // ---- boss
    if (this.def.boss) {
      const B = BOSSES[this.def.boss] || GrisailleEngine;
      this.boss = new B(world, c, {
        shake: (a, t) => this.rig.shake(a, t),
        say: (lines) => this.hud.dialog(lines, { blocking: false }),
        warn: (html, t) => this.hud.warn(html, t),
        toast: (html, t) => this.hud.toast(html, t),
        spawn: (kind, pos, o = {}) => this.spawnEnemy({ kind, pos, group: 'boss', spawnIn: true, ...o }),
        spawnSmudge: (pos) => this.spawnEnemy({ kind: 'smudge', pos, group: 'boss', spawnIn: true }),
        minionCount: () => this.enemies.filter((e) => e.alive && e.group === 'boss').length,
        clearMinions: () => { for (const e of this.enemies) if (e.alive && e.group === 'boss') e.die(this.player, 'clear'); },
        onDefeated: (pos) => this.onBossDefeated(pos),
        music: (n) => this.app.audio?.music(n),
        flash: (col, k = 0.6) => { const u = this.app.post.uniforms; u.uFlash.value = k; u.uFlashColor.value.set(col); },
        cine: (shot) => { this.cine = shot; },
        mech: this.mech,
        story: this,
      });
    }

    // ---- HUD
    const hud = this.hud = new StoryHUD(app);
    hud.setInk('#' + this.colors[1].getHexString());
    if (this.isHub) {
      if (id === 'hub') hud.setLevel('◆', 'THE UNDERSIDE', VEIL_INK);
      else hud.setLevel(`S${this.sector.num}`, this.sector.name.toUpperCase(), this.sector.color);
      hud.swatches(st.swatches.length, SWATCH_IDS.length, null);
    } else {
      hud.setLevel(this.info.tag, this.info.name.toUpperCase(), this.info.color);
      this.updateSwatchHud();
    }
    hud.coins(prof.coins);
    hud.shards(st.shards);
    if (this.boss) hud.boss(false, this.boss.title, this.boss.marks);

    // ---- state
    this.state = 'play';
    this.time = 0; this.levelTime = 0;
    this.deadT = 0; this.flight = null;
    this.cine = null; this.cineK = 0; this.cineLast = null;
    this.paused = false; this.leaving = false;
    this.talkI = 0; this.lowInkT = -9; this.sparkT = 0;
    this.swatchCoins = 0; this.saveT = 0; this.dirty = false;
    app.audio?.music(null);
    app.audio?.music(this.def.music);
    if (this.isHub) this.initHubScenes(hadStory, st);
    else {
      hud.banner(`SECTOR ${this.info.sector} · LEVEL ${this.info.num}`, this.info.name, 3.2);
      this.radioT = 1.6;
    }
    app.renderer.compile(scene, this.camera);
  }

  // where the player appears
  spawnFor() {
    const c = this.course, from = this.opts.from;
    let sp = c.spawn.pos.clone(), yaw = c.spawn.yaw;
    if (!this.isHub || !from) return { pos: sp, yaw };
    const center = this.def.center ? new THREE.Vector3(...this.def.center) : new THREE.Vector3(0, 0, 5);
    const near = (p, dist) => {
      const dir = new THREE.Vector3(center.x - p.x, 0, center.z - p.z).normalize();
      sp = p.clone().addScaledVector(dir, dist);
      yaw = Math.atan2(dir.x, dir.z);
    };
    const h = c.hatches.find((x) => x.id === from);
    if (h) { near(h.pos, 3.1); return { pos: sp, yaw }; }
    const toHub = INFO[from] ? INFO[from].hub : from;
    const g = c.gates.find((x) => x.to === toHub);
    if (g) { near(g.pos, 3.4); return { pos: sp, yaw }; }
    const e = c.exits.find((x) => x.to === toHub || (from && x.to === 'hub' && toHub === 'hub'));
    if (e) { near(e.pos, 3.0); return { pos: sp, yaw }; }
    return { pos: sp, yaw };
  }

  initHubScenes(hadStory, st) {
    const app = this.app, hud = this.hud, id = this.levelId, o = this.opts;
    if (id === 'hub') this.ambient = app.audio?.loop('fountain', { x: 16.5, y: 4, z: 13.4, volume: 0.22 });
    if (id === 'hub' && !hadStory) { this.introT = 0.9; return; }
    const fresh = o.justCleared;
    if (id === 'hub' && fresh && o.from === 'l15') { this.endingT = 1.0; return; }
    if (id === 'hub' && fresh && o.from === 'l10') { this.sceneT = { t: 1.0, lines: D.TINT_RESCUED, flag: 'tintJoined', shot: 'tint' }; return; }
    if (id === 'hub' && fresh && o.from === 'l5') { this.sceneT = { t: 1.0, lines: D.SECTOR1_DONE, flag: 's1done', shot: 'veil' }; return; }
    if (id === 'hub' && fresh && o.from === 'l1' && !st.flags.dabble) { this.sceneT = { t: 1.0, lines: D.DABBLE_INTRO, flag: 'dabble', shot: 'dabble' }; return; }
    if (id !== 'hub' && !st.flags['seen_' + id]) {
      st.flags['seen_' + id] = true;
      this.app.save();
      hud.banner(`SECTOR ${this.sector.num}`, this.sector.name, 3.4);
      this.radioT = 1.8;
      this.radioLines = D.SECTOR_INTRO[id];
      return;
    }
    if (fresh) {
      const next = ORDER.find((k) => !st.cleared.includes(k));
      hud.toast(next && INFO[next].hub === id ? `Hue Core recovered! Hatch <b>${INFO[next].num}</b> is now open.` : 'Hue Core recovered!', 4);
    } else hud.toast('Click to look around · <b>E</b> to interact', 3);
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
    const e = spawnDrab(this.world, d);
    if (d.spawnIn) e.aggro = true;
    if (d.foe) e.foe = d.foe;
    if (this.mech && (!this.gate || d.group !== this.gate)) e.spawnedLate = true;
    this.enemies.push(e);
    this.world.fighters.push(e);
    return e;
  }

  // ================================================================ events
  onHit(attacker, victim) {
    if (attacker !== this.player || victim === this.player) return;
    if (victim.shield || victim.blocked) { this.hud.hit('block'); if (victim.blocked && victim.name === 'Warden') this.hud.tipOnce('warden', 'The <b>Warden</b> blocks shots from the front. <b>Flank it</b> or toss a <b>bomb</b> over the shield!'); return; }
    if (victim.isPump) return;
    this.hud.hit(victim.alive ? 'hit' : 'kill');
    if (!victim.boss_part) this.app.audio?.sfx('enemy_hit', { ...posOf(victim.pos), volume: 0.6 });
  }

  onSplat(victim, attacker, kind) {
    if (victim !== this.player) return;
    this.deadT = 0;
    this.deadFall = kind === 'fall';
    this.flight = null;
    this.mech?.onPlayerDeath();
    if (this.story) this.story.deaths++;
    this.hud.splatted(true, kind === 'fall' ? 'Whoops! Back to the last checkpoint…' : kind === 'goo' ? 'Swallowed by the gray! Back to the checkpoint…' : 'Back to the last checkpoint…');
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

  onSpecial(f) {
    if (f !== this.player || !this.effects.burst) return;
    this.burstT = 0.35; // a beat after the special starts
  }

  prismBurst() {
    const p = this.player, b = this.effects.burst;
    const c = p.pos.clone().setY(p.pos.y + 0.6);
    for (let i = 0; i < 5; i++) this.fx.ring(c.clone().setY(p.pos.y + 0.15 + i * 0.12), new THREE.Color().setHSL(i / 5, 0.9, 0.6), 0.4, b.r * (0.8 + i * 0.06), 0.6 + i * 0.06, { alpha: 0.9 });
    this.fx.explosion(c, this.colors[1], 1.6);
    this.app.audio?.sfx('special_go', { volume: 0.8, pitch: 1.3 });
    this.rig.shake(0.5, 0.4);
    for (const e of this.enemies) if (e.alive && e.pos.distanceTo(p.pos) < b.r) this.combat.damage(e, b.dmg, p, 'burst');
    for (const f of this.world.fighters) if (f.boss_part && f.alive && !f.shield && f.pos.distanceTo(p.pos) < b.r + 4) { this.combat.damage(f, b.dmg * 0.6, p, 'burst'); break; }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.combat.paint(p, _v.set(p.pos.x + Math.cos(a) * b.r * 0.45, p.pos.y + 0.1, p.pos.z + Math.sin(a) * b.r * 0.45), 1.4); }
  }

  onEnemyDefeated(e, attacker, kind) {
    if (attacker === this.player && kind !== 'clear') {
      this.kills++;
      this.app.audio?.sfx('ko_confirm', { volume: 0.45 });
    }
    if (kind !== 'clear' && kind !== 'fall') {
      let n = SHARD_DROP[e.name] ?? 1;
      if (e.name === 'Pilfer' && e.stolen > 0) {
        n = 6;
        this.player.ink = Math.min(1, this.player.ink + e.stolen + 0.25);
        this.hud.toast('Got your ink back! <b>+6 ◆</b>', 2.2);
      }
      if (n > 0) this.mech.dropShards(e.center(new THREE.Vector3()), n, 2.5);
    }
    if (e.escaped) this.hud.toast('The Pilfer got away with your ink…', 2.2);
    if (e.group === 'boss' || e.group === 'pump' || (e.group && e.group.startsWith('arena:')) || e.spawnedLate) this.toRemove.push(e);
    if (this.gate && this.core?.locked && e.group === this.gate) {
      const left = this.enemies.filter((x) => x.group === this.gate && x.alive).length;
      if (left === 0) this.checkSeal();
    }
  }

  onFlag() { if (this.core?.locked) this.checkSeal(); }

  sealDone() {
    if (!this.core) return false;
    if (this.gate && this.enemies.some((e) => e.group === this.gate && e.alive)) return false;
    for (const f of this.course.core.need) if (!this.mech.flag(f)) return false;
    return true;
  }

  checkSeal() {
    if (!this.core?.locked || !this.sealDone()) return;
    this.core.unlock(this.fx);
    this.app.audio?.sfx('door_heavy', { ...posOf(this.core.pos), volume: 0.9 });
    this.hud.toast('The seal is broken! Grab the <b>Hue Core</b>!', 3.5);
  }

  onBossDefeated(pos) {
    const at = pos ? pos.clone() : new THREE.Vector3(0, 0, -9.5);
    this.core = new HueCore(this.course.decor, at, this.info.color, { rainbow: true });
    this.fx.explosion(at.clone().setY(at.y + 2), this.colors[1], 3);
    this.hud.boss(false);
    this.hud.toast(`${this.boss.downText || 'The boss is down!'} Grab the <b>${this.info.core}</b>!`, 4);
    this.app.audio?.music('story_level');
  }

  addShards(n) {
    const st = this.story || this.ensureStory();
    st.shards += n;
    st.shardsTotal += n;
    this.runShards += n;
    this.hud.shards(st.shards, true);
    this.dirty = true;
  }

  onShardIndex(i) {
    const st = this.story || this.ensureStory();
    if (!this.shardsGot.includes(i)) this.shardsGot.push(i);
    st.got[this.levelId] = [...this.shardsGot];
    this.dirty = true;
  }

  saveNow() { this.dirty = false; this.saveT = 0; this.app.save(); }

  // ================================================================ actions
  talk(lines, onDone, cine) {
    this.cine = cine || null;
    this.dlgT = this.time;
    this.hud.hideBanner();
    this.hud.dialog(lines, { blocking: true, onDone: () => { this.cine = null; onDone?.(); } });
  }

  shotOf(pos, yaw, dist = 4.2, h = 1.85) {
    return { pos: new THREE.Vector3(pos.x + Math.sin(yaw) * dist + Math.cos(yaw) * 1.3, pos.y + h, pos.z + Math.cos(yaw) * dist - Math.sin(yaw) * 1.3), look: new THREE.Vector3(pos.x, pos.y + 1.3, pos.z) };
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

  npcShot(n) { return this.shotOf(n.pos, n.baseYaw, 4.4, 1.9); }

  interact(it) {
    const app = this.app, hud = this.hud;
    if (it.kind === 'veil') {
      this.talkedVeil = true;
      this.veilWave = 1.4;
      this.talk(D.veilTalk(this.progress, this.talkI++), null, this.veilShot(false));
    } else if (it.kind === 'npc') {
      const n = it.n;
      n.greet?.();
      if (n.kind === 'dabble' || n.kind === 'terminal') {
        const st = this.ensureStory();
        if (n.kind === 'dabble' && !st.flags.dabbleTalk) {
          st.flags.dabbleTalk = true;
          this.talk(D.DABBLE_FIRST, () => this.openShop(n), this.npcShot(n));
        } else this.openShop(n);
      } else if (n.kind === 'book') this.openBook();
      else if (n.kind === 'tint') this.talk(D.tintTalk(this.progress, this.talkI++), null, this.npcShot(n));
    } else if (it.kind === 'hatch') {
      if (it.h.status === 'locked') { hud.toast(D.LOCKED, 2.6); app.audio?.sfx('ui_error'); return; }
      app.audio?.sfx('door_heavy', { volume: 0.9 });
      this.leaveTo(it.h.id, {}, `Descending to ${INFO[it.h.id].name}…`);
    } else if (it.kind === 'gate') {
      const g = it.g;
      if (!g.open) { hud.toast(D.gateLocked(g.sector.num), 3); app.audio?.sfx('ui_error'); return; }
      app.audio?.sfx('door_heavy', { volume: 0.9 });
      this.leaveTo(g.to, { from: this.levelId }, `Heading into ${g.sector.name}…`);
    } else if (it.kind === 'lift') {
      app.audio?.sfx('door', { volume: 0.8 });
      if (it.l.to === 'plaza') { this.leaving = true; this.saveNow(); app.goPlaza(); }
      else this.leaveTo(it.l.to, { from: this.levelId }, 'Back up to the hideout…');
    }
  }

  // ---- shop + book overlays
  shopModel(n) {
    const st = this.ensureStory();
    return {
      title: n.kind === 'dabble' ? 'DABBLE\'S SWAP SHOP' : 'SUPPLY TERMINAL',
      shards: st.shards,
      who: n.kind === 'dabble' ? { badge: 'D', color: '#ff8ccf', line: D.dabbleLine(st) } : { badge: '◆', color: '#9ff4ff', line: 'DABBLE CO. REMOTE SUPPLY · Same great upgrades, now with fewer hugs.' },
      items: UPGRADES.map((u) => ({ id: u.id, name: u.name, icon: u.icon, color: u.color, level: st.up[u.id] || 0, max: u.cost.length, cost: upgradeCost(st, u.id), next: u.tiers[Math.min(u.tiers.length - 1, st.up[u.id] || 0)], blurb: u.blurb })),
    };
  }
  openShop(n) {
    const app = this.app;
    app.input.unlock();
    this.hud.openShop(this.shopModel(n), {
      onBuy: (uid) => {
        const st = this.ensureStory();
        if (buyUpgrade(st, uid)) {
          this.effects = upgradeEffects(st);
          this.applyUpgrades();
          this.saveNow();
          app.audio?.sfx('buy', { volume: 0.8 });
          this.hud.shards(st.shards, true);
          this.hud.toast(`<b>${UPGRADE[uid].name}</b> upgraded!`, 2);
          if (n.kind === 'dabble') n.greet?.();
        } else app.audio?.sfx('ui_error');
        this.hud.renderShop(this.shopModel(n));
      },
      onClose: () => { app.audio?.sfx('ui_back', { volume: 0.5 }); this.overlayT = this.time; },
    });
    app.audio?.sfx('ui_select', { volume: 0.6 });
  }
  applyUpgrades() {
    const p = this.player, e = this.effects;
    this.world.dmgMul = e.power;
    p.mods = { ...p.mods, inkRecover: this.gearMods.inkRecover * e.refill, special: this.gearMods.special * e.charge };
  }
  bookModel() {
    const st = this.progress;
    return {
      sectors: SECTORS.map((s, si) => {
        const open = si === 0 || st.cleared.includes(SECTORS[si - 1].boss);
        const lv = s.levels.map((id) => {
          const inf = INFO[id];
          return {
            tag: inf.tag, name: inf.name, color: inf.color, done: st.cleared.includes(id), open: this.hatchStatus(id) !== 'locked',
            swatches: inf.swatchIds.map((sid) => ({ got: st.swatches.includes(sid), name: SWATCHES[sid].name, colors: SWATCHES[sid].colors })),
            shards: (st.got[id] || []).length,
          };
        });
        return { num: s.num, name: s.name, color: s.color, open, levels: lv, found: s.levels.reduce((a, id) => a + levelSwatchesFound(st, id), 0), total: s.levels.reduce((a, id) => a + INFO[id].swatchIds.length, 0) };
      }),
      totals: { swatches: st.swatches.length, swatchTotal: SWATCH_IDS.length, cores: st.cleared.length, coreTotal: ORDER.length, shards: st.shardsTotal },
    };
  }
  openBook() {
    this.app.input.unlock();
    this.app.audio?.sfx('ui_select', { volume: 0.6 });
    this.hud.openBook(this.bookModel(), () => { this.app.audio?.sfx('ui_back', { volume: 0.5 }); this.overlayT = this.time; });
  }

  leaveTo(level, extra = {}, text) {
    if (this.leaving) return;
    this.leaving = true;
    const app = this.app;
    if (this.story) this.saveNow();
    app.input.unlock();
    app.setMode(() => new Story(app, { level, ...extra }), text || 'Descending into the Underside…');
  }

  nearestInteract() {
    const p = this.player.pos;
    if (this.veil && flat(p, this.veilPos) < 2.7) return { kind: 'veil', label: 'Talk to <b>Captain Veil</b>' };
    for (const n of this.npcs) if (flat(p, n.pos) < n.radius) return { kind: 'npc', n, label: n.label };
    for (const h of this.hatches) {
      if (flat(p, h.pos) < 2.3) {
        const inf = INFO[h.id];
        return { kind: 'hatch', h, label: h.status === 'locked' ? `Hatch ${inf.num}: <b>${inf.name}</b> (sealed)` : `Enter hatch ${inf.num}: <b>${inf.name}</b>` };
      }
    }
    for (const g of this.gates) if (flat(p, g.pos) < 2.8 && Math.abs(p.y - g.pos.y) < 2) return { kind: 'gate', g, label: g.open ? `Go to <b>Sector ${g.sector.num}: ${g.sector.name}</b>` : `<b>Sector ${g.sector.num}</b> gate (sealed)` };
    for (const l of this.lifts) if (flat(p, l.pos) < 2.4) return { kind: 'lift', l, label: l.label || (l.to === 'plaza' ? 'Ride the lift up to <b>Prism Plaza</b>' : 'Ride the lift back to the <b>hideout</b>') };
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
    if (this.dirty) this.saveNow();
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

  updateSwatchHud() {
    if (!this.info) return;
    const st = this.story || this.progress;
    const ids = this.info.swatchIds;
    const n = ids.filter((s) => st.swatches.includes(s)).length;
    const show = ids.find((s) => !st.swatches.includes(s)) || ids[0];
    this.hud.swatches(n, ids.length, SWATCHES[show].colors);
  }

  collectSwatch(s) {
    const prof = this.app.profile;
    s.take();
    this.fx.explosion(s.pos.clone(), s.colors[1], 1.4);
    for (const col of s.colors) this.fx.splash(s.pos.clone(), UP, col, 10, 5, 0.07);
    this.app.audio?.sfx('pickup', { volume: 1 });
    const story = this.ensureStory();
    const sw = SWATCHES[s.sid];
    if (!story.swatches.includes(s.sid)) {
      story.swatches.push(s.sid);
      prof.coins += 150;
      this.swatchCoins += 150;
      const n = levelSwatchesFound(story, this.levelId), t = this.info.swatchIds.length;
      this.hud.toast(`Lost Swatch found: <b>${sw.name}</b>! (${n}/${t}) <b>+150 ◉</b>`, 3.5);
    } else this.hud.toast(`Lost Swatch: <b>${sw.name}</b> (already in your book)`, 3);
    this.saveNow();
    this.updateSwatchHud();
    this.hud.coins(prof.coins);
  }

  completeLevel() {
    if (this.state === 'clear') return;
    const app = this.app, prof = app.profile, id = this.levelId, hud = this.hud;
    this.state = 'clear';
    this.clearT = 0;
    const story = this.ensureStory();
    const first = !story.cleared.includes(id);
    if (first) {
      story.cleared.push(id); prof.coins += 400;
      const bonus = this.info.boss ? BOSS_SHARDS : CLEAR_SHARDS;
      this.addShards(bonus);
    }
    if (!story.best[id] || this.levelTime < story.best[id]) story.best[id] = Math.round(this.levelTime);
    this.firstClear = first;
    this.saveNow();
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
    hud.timer(null);
    this.clearData = {
      num: this.info.tag, name: this.info.name, core: this.info.core, color: this.info.color, time: fmtTime(this.levelTime),
      swFound: levelSwatchesFound(story, id), swTotal: this.info.swatchIds.length, shards: this.runShards,
      kills: this.kills, coins: (first ? 400 : 0) + this.swatchCoins,
      cta: this.info.boss && first ? (id === 'l15' ? 'RETURN THE SPECTRUM CROWN ▶' : `RETURN THE ${this.info.core.toUpperCase()} ▶`) : 'BACK TO THE HIDEOUT ▶',
    };
  }

  continueFromClear() {
    if (this.clearContinued) return;
    this.clearContinued = true;
    this.app.audio?.sfx('ui_select');
    const to = this.info.boss ? 'hub' : this.info.hub;
    this.leaveTo(to, { from: this.levelId, justCleared: this.firstClear }, 'Back to the hideout…');
  }

  startBoss() {
    const b = this.boss, c = this.course, p = this.player;
    b.start();
    this.radioT = null;
    this.hud.queued = null;
    if (c.door) { c.door.collide = true; this.doorTarget = 5; }
    for (const id of this.def.bossDoors || []) this.mech.setDoor(id, false);
    this.app.audio?.sfx('door_heavy', { volume: 1 });
    const rp = this.def.bossSpawn || [0, 0, -16];
    p.spawnPoint.set(rp[0], rp[1], rp[2]);
    p.spawnYaw = this.def.bossSpawnYaw ?? 0;
    this.cpIndex = this.checkpoints.length; // the antechamber is behind the door now
    this.talk(b.intro || D.BOSS_INTRO, () => {
      b.begin();
      this.app.audio?.music('story_boss');
      this.hud.boss(true);
    }, b.introShot || { pos: new THREE.Vector3(3.5, 3.2, -17), look: new THREE.Vector3(0, 7.2, 0) });
  }

  setPaused(on) {
    const app = this.app;
    this.paused = on;
    if (on) {
      const pl = this.player;
      if (pl.loops && typeof pl.stopLoop === 'function') for (const k of Object.keys(pl.loops)) pl.stopLoop(k);
    }
    const inLevel = !this.isHub;
    app.menus.pause(on, {
      onResume: () => { this.setPaused(false); app.input.lock(); },
      onQuit: () => {
        app.menus.pause(false);
        if (inLevel) { this.paused = false; this.leaveTo(this.info.boss ? 'hub' : this.info.hub, { from: this.levelId }, 'Retreating to the hideout…'); }
        else { this.leaving = true; if (this.story) this.saveNow(); app.goPlaza(); }
      },
      quitLabel: inLevel ? 'RETREAT TO THE HIDEOUT' : 'LEAVE THE UNDERSIDE',
    });
  }

  onLockLost() {
    if (!this.paused && !this.leaving && !this.hud.clearOpen && !this.hud.overlayOpen) this.setPaused(true);
  }

  // ================================================================ frame
  objective() {
    const st = this.story || this.progress;
    if (this.isHub) {
      if (!this.app.profile.story) return 'Talk to <b>Captain Veil</b>';
      const next = ORDER.find((k) => !st.cleared.includes(k));
      const cores = `Hue Cores <b>${st.cleared.length}/${ORDER.length}</b> · `;
      if (!next) return 'Every Hue Core is home! Hunt down the last <b>Lost Swatches</b>.';
      const inf = INFO[next];
      if (inf.hub === this.levelId) return `${cores}Enter hatch <b>${inf.num}: ${inf.name}</b>`;
      if (this.gates.some((g) => g.to === inf.hub)) return `${cores}Take the <b>Sector ${inf.sector}</b> gate`;
      return `${cores}Ride the <b>lift</b> back to the hideout`;
    }
    if (this.state === 'clear') return 'Hue Core recovered!';
    if (this.boss) {
      if (this.boss.state === 'dormant') return this.boss.dormantText || 'Head into the arena';
      if (this.boss.state === 'dead') return `Grab the <b>${this.info.core}</b>!`;
      return this.boss.objective || `Defeat <b>${this.boss.title}</b>`;
    }
    const pm = this.mech.pumpRunning;
    if (pm) return `Defend the <b>Color Pump</b>! ${Math.ceil(pm.time - pm.t)}s left`;
    const ar = this.mech.arenaActive;
    if (ar) return `${ar.name ? `<b>${ar.name}</b>: ` : ''}splash every Drab! Wave <b>${ar.wave + 1}/${ar.waves.length}</b>`;
    if (this.core?.locked && flat(this.player.pos, this.core.pos) < 38) {
      if (this.gate && this.enemies.some((e) => e.group === this.gate && e.alive)) {
        const dead = this.enemies.filter((e) => e.group === this.gate && !e.alive).length;
        const tot = Math.max(this.gateTotal, this.enemies.filter((e) => e.group === this.gate).length);
        return `Splash the guards to break the seal: <b>${dead}/${tot}</b>`;
      }
      const need = this.course.core.need.filter((f) => !this.mech.flag(f));
      if (need.length) return this.def.sealText ? this.def.sealText(need, this.mech) : 'Break the seal on the <b>Hue Core</b>';
    }
    return this.def.objText || 'Reach the <b>Hue Core</b>';
  }

  update(dt) {
    if (this.leaving || this.paused) return;
    const app = this.app, inp = app.input, hud = this.hud, p = this.player, w = this.world;
    if (hud.overlayOpen) { this.updateOverlay(dt); return; }
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
    this.updateScenes(dt);

    // ---- player control
    const blocked = dialogWasOpen || hud.dialogBlocking || this.state === 'clear' || this.endingLock;
    const canControl = !blocked && (inp.locked || inp.usingPad);
    this.control.update(dt, p, w, canControl);
    const I = p.intent;
    if (inp.pressed('KeyE')) I.special = false; // E is interact/advance here (Q still fires specials)
    if (!canControl || !p.alive) { I.mx = I.mz = 0; I.fire = I.jump = I.sub = I.special = I.goo = false; }
    if (this.flight) { I.mx = I.mz = 0; I.jump = false; I.goo = false; }
    this.mech.pre(dt);
    this.updateFlight(dt);
    p.update(dt);
    if (this.state === 'clear') this.rig.yaw += dt * 0.35;
    if (this.burstT != null && (this.burstT -= dt) <= 0) { this.burstT = null; if (p.alive) this.prismBurst(); }

    // ---- death / respawn
    if (!p.alive) {
      this.deadT += dt;
      if (this.deadT > (this.deadFall ? 1.3 : 2.4)) {
        p.respawn();
        this.rig.snap(p, p.spawnYaw);
        hud.splatted(false);
        this.mech.onRespawn(p.pos);
      }
    }

    // ---- enemies + boss
    const ctx = this.ctx || (this.ctx = { player: p, enemies: this.enemies, near: (pos) => pos.distanceToSquared(this.camera.position) < 900 });
    if (this.state !== 'clear') {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const far = e.pos.distanceToSquared(p.pos) > 52 * 52;
        if (far && e.group !== 'boss' && e.group !== 'pump' && !(e.group && e.group.startsWith('arena:'))) continue;
        e.update(dt, e.foe ? this.targetCtx(e.foe) : ctx);
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
    this.mech.post(dt);

    // ---- world
    this.combat.update(dt);
    this.fx.update(dt);
    this.env.update(dt);
    this.env.follow(p.alive ? p.pos : this.rig.pivot);
    for (const cp of this.checkpoints) cp.update(dt);
    for (const pad of this.pads) pad.update(dt, p.pos);
    for (const s of this.swatches) s.update(dt, this.fx);
    this.core?.update(dt, this.fx);
    for (const h of this.hatches) h.update(dt, this.fx, p.pos);
    for (const g of this.gates) g.update(dt, this.fx);
    for (const l of this.lifts) l.update(dt);
    for (const n of this.npcs) n.update(dt, p.pos);
    this.shelf?.update(dt);
    if (this.doorMesh) this.doorMesh.position.y += (this.doorTarget - this.doorMesh.position.y) * damp(3, dt);
    this.updateVeil(dt);
    this.ambientFx(dt);
    if (this.playerLight) { this.playerLight.position.set(p.pos.x, p.pos.y + 1.8, p.pos.z); this.playerLight.intensity = p.alive ? 7 : 0; }
    for (const u of this.course.updaters) u(dt, this);

    // ---- hub interaction
    if (this.isHub && this.state === 'play') {
      const it = !hud.dialogBlocking && p.alive && !this.endingLock ? this.nearestInteract() : null;
      hud.prompt(it ? it.label : null, inp.usingPad ? 'X' : 'E');
      if (it && !dialogWasOpen && !hud.dialogBlocking && inp.action('interact') && this.time - (this.overlayT || -9) > 0.25) this.interact(it);
    }

    // ---- camera (cinematic blend) + audio listener
    this.updateCine(dt);
    w.listener.copy(this.camera.position);
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.rig.yaw + Math.PI);

    // ---- grading: the Underside is washed out until its colour comes back
    const st = this.story || this.progress;
    const frac = st.cleared.length / ORDER.length;
    let baseDesat = this.isHub ? 0.34 * (1 - frac) : this.state === 'clear' ? 0 : this.def.desat ?? 0.14;
    if (this.boss?.desat) baseDesat = Math.max(baseDesat, this.boss.desat);
    if (this.colorWave != null) baseDesat *= Math.max(0, 1 - this.colorWave);
    const hurtK = p.alive ? Math.max(0, 1 - p.hp / 100) : 0.6;
    const u = app.post.uniforms;
    u.uVignette.value += ((0.62 + hurtK * 0.7) - u.uVignette.value) * damp(6, dt);
    u.uDesat.value += ((p.alive ? baseDesat + hurtK * 0.25 : 0.5) - u.uDesat.value) * damp(5, dt);
    if (u.uFlash.value > 0) u.uFlash.value = Math.max(0, u.uFlash.value - dt * 1.5);

    // ---- save every few seconds when something changed
    this.saveT += dt;
    if (this.dirty && this.saveT > 4) this.saveNow();

    // ---- HUD
    hud.vitals(p);
    hud.objective(this.objective());
    if (this.boss && this.boss.state !== 'dormant' && this.boss.state !== 'intro' && this.boss.state !== 'dead') hud.bossBar(this.boss.frac, this.boss.label);
    const pm = this.mech.pumpRunning;
    if (pm) hud.bossBar(Math.max(0, pm.hp / pm.hp0), `PUMPING… ${Math.ceil(pm.time - pm.t)}s LEFT · KEEP THE DRAB OFF IT!`);
    const playing = this.state === 'play' && !hud.dialogBlocking;
    hud.reticle(playing && p.alive && (inp.locked || inp.usingPad), p.form === 'goo', this.control.aimTarget && !this.control.aimTarget.isPump ? this.control.aimTarget : null);
    hud.showPlay(!this.cine);
    if (!inp.locked && inp.mousePressed[0] && !hud.clearOpen && !hud.overlayOpen) inp.lock();
    hud.cover(playing && !inp.locked && !inp.usingPad && p.alive && !this.endingLock);
    hud.update(dt);
  }

  targetCtx(t) {
    this.tctx = this.tctx || new Map();
    let c = this.tctx.get(t);
    if (!c) { c = { player: t, enemies: this.enemies, near: this.ctx.near }; this.tctx.set(t, c); }
    return c;
  }

  // shop / book / credits are open: menu keys only
  updateOverlay(dt) {
    const inp = this.app.input, hud = this.hud;
    hud.update(dt);
    this.updateCine(dt);
    if (hud.shopOpen) {
      if (inp.action('up')) hud.shopNav(-1);
      if (inp.action('down')) hud.shopNav(1);
      if (inp.pressed('KeyE') || inp.pressed('Enter') || inp.padPressed(0)) hud.shopBuy();
      if (inp.pressed('Escape') || inp.pressed('KeyQ') || inp.padPressed(1)) hud.closeShop();
    } else if (hud.bookOpen) {
      if (inp.pressed('Escape') || inp.pressed('KeyQ') || inp.pressed('KeyE') || inp.pressed('Enter') || inp.padPressed(1) || inp.padPressed(0)) hud.closeBook();
    } else if (hud.creditsOpen) {
      if ((inp.pressed('Enter') || inp.pressed('KeyE') || inp.padPressed(0)) && this.time - (this.creditsAt || 0) > 2) hud.closeCredits();
      this.time += dt;
      this.endingFx(dt);
      this.fx.update(dt);
    }
    hud.prompt(null);
    hud.cover(false);
  }

  updateScenes(dt) {
    const hud = this.hud, app = this.app;
    if (this.introT != null && (this.introT -= dt) <= 0) {
      this.introT = null;
      this.talk(D.INTRO, () => {
        const st = this.story = this.ensureStory();
        st.flags.intro = true;
        this.saveNow();
        hud.toast('Hatch <b>1</b> is open! Walk up to it and press <b>E</b>.', 4.5);
      }, this.veilShot(true));
    }
    if (this.sceneT && (this.sceneT.t -= dt) <= 0) {
      const sc = this.sceneT; this.sceneT = null;
      const npc = this.npcs.find((n) => n.kind === sc.shot);
      const shot = npc ? this.npcShot(npc) : this.veilShot(true);
      this.talkedVeil = true;
      this.talk(sc.lines, () => {
        const st = this.ensureStory();
        st.flags[sc.flag] = true;
        this.saveNow();
        if (sc.flag === 's1done') hud.toast('The <b>Sector 2</b> gate is open!', 4);
        if (sc.flag === 'tintJoined') hud.toast('The <b>Sector 3</b> gate is open! Agent Tint is on the radio now.', 4.5);
        if (sc.flag === 'dabble') hud.toast('Spend <b>◆ Hue Shards</b> at Dabble\'s shop for story upgrades!', 4.5);
      }, shot);
    }
    if (this.endingT != null && (this.endingT -= dt) <= 0) { this.endingT = null; this.startEnding(); }
    if (this.radioT != null && (this.radioT -= dt) <= 0) {
      this.radioT = null;
      hud.dialog(this.radioLines || D.LEVEL_RADIO[this.levelId], { blocking: false });
    }
    if (this.colorWave != null && this.colorWave < 1) this.colorWave = Math.min(1, this.colorWave + dt * 0.4);
    if (this.endingFxOn) this.endingFx(dt);
    void app;
  }

  // ---- the ending: colour floods back into the hideout
  startEnding() {
    const hud = this.hud, app = this.app;
    this.endingLock = true;
    this.colorWave = 0;
    this.endingFxOn = true;
    const u = app.post.uniforms;
    u.uFlash.value = 0.9; u.uFlashColor.value.set(0xffffff);
    app.audio?.sfx('core_get', { volume: 1 });
    app.audio?.music('story_clear');
    // the gray puddles in the hideout get painted over
    for (const g of this.course.goo) this.course.paint.splat(g.pos, g.r * 1.4, 1, { wobble: 0.3 });
    this.course.hubColor?.(1);
    hud.banner('THE UNDERSIDE', 'is colorful again!', 4, true);
    const center = new THREE.Vector3(0, 0, 4);
    this.cine = { pos: new THREE.Vector3(0, 7, -9), look: center.clone().setY(2) };
    setTimeout(() => {
      if (this.disposed) return;
      this.endingLock = false;
      this.talk(D.ENDING, () => {
        const st = this.ensureStory();
        st.flags.ending = true;
        this.saveNow();
        this.creditsAt = this.time;
        app.input.unlock();
        hud.showCredits({ cores: `${st.cleared.length}/${ORDER.length}`, swatches: `${st.swatches.length}/${SWATCH_IDS.length}`, shards: st.shardsTotal }, () => { app.audio?.music('story_hub'); hud.toast('Thanks for playing! Find every <b>Lost Swatch</b> to complete the book.', 5); });
      }, this.veilShot(true));
    }, 4200);
  }

  endingFx(dt) {
    // rainbow fireworks over the hideout
    this.fwT = (this.fwT || 0) - dt;
    if (this.fwT > 0) return;
    this.fwT = rand(0.25, 0.6);
    const p = new THREE.Vector3(rand(-16, 16), rand(5, 9), rand(-12, 14));
    const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    this.fx.explosion(p, col, rand(0.8, 1.6));
    this.fx.splash(p, UP, col, 18, 6, 0.08, 1.4);
    this.app.audio?.sfx('pop_bomb', { x: p.x, y: p.y, z: p.z, volume: 0.35 });
  }

  triggers(dt) {
    const p = this.player, c = this.course, hud = this.hud;
    for (let i = this.cpIndex + 1; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (flat(p.pos, cp.pos) < 2.2 && Math.abs(p.pos.y - cp.pos.y) < 2.5) { this.activateCheckpoint(i); break; }
    }
    if (!this.flight && !this.mech.riding) {
      for (const pad of this.pads) {
        pad.cool = Math.max(0, pad.cool - dt);
        const dy = p.pos.y - pad.pos.y;
        if (pad.cool <= 0 && flat(p.pos, pad.pos) < 1.15 && dy > -0.3 && dy < 0.8) { this.launch(pad); break; }
      }
    }
    _v.copy(p.pos).setY(p.pos.y + 0.8);
    for (const s of this.swatches) if (!s.taken && _v.distanceTo(s.pos) < 1.5) this.collectSwatch(s);
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
    // radio chatter zones
    for (const s of c.says) {
      if (s.done || p.pos.x < s.min[0] || p.pos.x > s.max[0] || p.pos.z < s.min[1] || p.pos.z > s.max[1]) continue;
      if (s.minY != null && p.pos.y < s.minY) continue;
      if (s.maxY != null && p.pos.y > s.maxY) continue;
      s.done = true;
      hud.dialog(s.lines, { blocking: false });
    }
    // zones
    for (const z of c.zones) {
      if (z.id === 'arena' && this.boss?.state === 'dormant' && p.pos.x > z.min.x && p.pos.x < z.max.x && p.pos.z > z.min.z && p.pos.z < z.max.z && p.pos.y > z.min.y && p.pos.y < z.max.y) this.startBoss();
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
    if (this.veilWave > 0) { this.veilWave -= dt; m.emote = 'wave'; } else m.emote = this.endingFxOn ? 'cheer' : 'think';
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
        if (s && s.collide) {
          _v.set(rand(s.min.x, s.max.x), s.max.y + 0.03, rand(s.min.z, s.max.z));
          const face = s.sideFace?.top;
          if (face && c.paint.ownerAt(face, _v) === 0) fx.spawn(_v, _p0.set(0, rand(0.3, 0.8), 0), 0xd8f8ff, 0.03, 0.9, { grav: -0.02, drag: 1.5 });
        }
      }
    }
    // goo drips in the hideout
    if (this.levelId === 'hub' && Math.random() < dt * 4 * (1 - (this.story?.cleared.length || 0) / ORDER.length)) fx.spawn(_v.set(16.5 + rand(-0.2, 0.2), 7.6, 13.4), _p0.set(0, -1, 0), GRAY_HEX, rand(0.06, 0.1), 1.0, { floorY: 5.2, drag: 0 });
    if (this.def.ambient) this.def.ambient(dt, this);
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
    if (this.story && this.dirty) this.app.save();
    this.hud.dispose();
    this.ambient?.stop();
    // free GPU buffers of everything still attached (character models drop their
    // root without disposing geometry); shared geometries simply re-upload later
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
    for (const e of this.enemies) e.dispose();
    this.boss?.dispose();
    this.player.dispose();
    this.veil?.dispose();
    for (const x of [...this.checkpoints, ...this.pads, ...this.hatches, ...this.lifts, ...this.gates, ...this.npcs, ...this.swatches, this.core, this.shelf]) x?.dispose();
    this.mech?.dispose();
    this.playerLight?.dispose?.();
    this.combat.dispose();
    this.fx.dispose();
    this.course.dispose();
    this.env.dispose();
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
    this.scene.clear();
  }
}
