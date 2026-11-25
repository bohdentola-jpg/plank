// A Turf Rush match: 4v4, three minutes, most floor painted wins.
import * as THREE from 'three';
import { Environment } from '../world/env.js';
import { buildStage, stageInfo } from '../world/stage.js';
import { Particles } from '../fx/particles.js';
import { Combat, WEAPONS, WEAPON_IDS, posOf } from '../actors/weapons.js';
import { Fighter } from '../actors/fighter.js';
import { Bot, NavGrid, botNames } from '../actors/bot.js';
import { CameraRig, PlayerControl } from '../actors/player.js';
import { randomLook } from '../actors/character.js';
import { BattleHUD } from '../ui/hud.js';
import { COLOR_PAIRS, pick, hexToCss, damp, clamp, lerp, rand } from '../util.js';
import { TEAM_A, TEAM_B } from '../world/paint.js';

const MATCH_TIME = 180;

export class Battle {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = { stage: 'terminal', weapon: 'spritzer', skill: 'normal', time: MATCH_TIME, ...opts };
  }

  async init() {
    const app = this.app, o = this.opts;
    const scene = this.scene = new THREE.Scene();
    const camera = this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.08, 1500);
    const sInfo = stageInfo(o.stage);
    this.env = new Environment(scene, app.renderer, sInfo.sky);
    const st = this.stage = buildStage(o.stage, scene, app.renderer, this.env);
    const pair = o.colors || pick(COLOR_PAIRS);
    const flip = Math.random() < 0.5;
    const ca = new THREE.Color(flip ? pair.b : pair.a), cb = new THREE.Color(flip ? pair.a : pair.b);
    this.colors = { 0: new THREE.Color(0xffffff), 1: ca, 2: cb };
    st.paint.setColors(ca, cb);
    st.decor.setTeamColors(ca, cb);
    // pre-paint spawn pads
    for (const t of [1, 2]) {
      const c = st.spawns[t].reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(4);
      st.paint.splat(c.clone().setY(c.y + 0.02), 3.6, t, { wobble: 0.12 });
    }

    const fx = this.fx = new Particles(scene);
    const world = this.world = {
      scene, level: st.level, paint: st.paint, fx, colors: this.colors, audio: app.audio,
      fighters: [], listener: new THREE.Vector3(), combatOn: false, canRespawn: true,
      onHit: (a, v, dmg) => this.onHit(a, v, dmg),
      onSplat: (v, a, kind) => this.onSplat(v, a, kind),
      onPlayerHurt: (dmg, a) => { this.hud.hurt(a ? a.color : this.colors[3 - this.player.team]); this.rig.shake(0.4, 0.25); app.audio?.sfx('hurt', { volume: 0.6 }); },
      onLowInk: () => this.hud.lowInkWarn(),
      onSpecial: (f) => { if (f !== this.player) this.hud.feedMsg(`<b style="color:${hexToCss(f.color)}">${f.name}</b> used a special!`); },
      onExplosion: (p, r) => { if (this.player && p.distanceTo(this.player.pos) < r * 3) this.rig.shake(0.5 * r / 3, 0.35); },
    };
    world.combat = this.combat = new Combat(world);

    // fighters
    const prof = app.profile;
    const names = botNames(7, [prof.name]);
    const weapons = WEAPON_IDS;
    const roster = [];
    roster.push({ name: prof.name, team: 1, look: prof.look, weapon: o.weapon, isPlayer: true });
    for (let i = 0; i < 3; i++) roster.push({ name: names[i], team: 1, look: randomLook(), weapon: pick(weapons) });
    for (let i = 0; i < 4; i++) roster.push({ name: names[3 + i], team: 2, look: randomLook(), weapon: pick(weapons) });
    const nav = this.nav = new NavGrid(st.level, st.bounds, 1);
    this.bots = [];
    const counters = { 1: 0, 2: 0 };
    for (const r of roster) {
      const f = new Fighter(world, { ...r, color: this.colors[r.team] });
      const idx = counters[r.team]++;
      f.spawnPoint.copy(st.spawns[r.team][idx]);
      f.spawnYaw = r.team === 1 ? 0 : Math.PI;
      f.place(f.spawnPoint, f.spawnYaw);
      world.fighters.push(f);
      if (r.isPlayer) this.player = f;
      else this.bots.push(new Bot(f, world, nav, o.skill));
    }
    this.autoplay = new URLSearchParams(location.search).has('autoplay');
    if (this.autoplay) this.bots.push(new Bot(this.player, world, nav, o.skill));
    this.rig = new CameraRig(camera);
    this.rig.snap(this.player, this.player.spawnYaw);
    this.control = new PlayerControl(app.input, this.rig);

    // map camera
    const b = st.bounds;
    const hw = (b.maxX - b.minX) / 2 + 3, hh = (b.maxZ - b.minZ) / 2 + 3;
    this.mapCam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 1, 200);
    this.mapCam.position.set(0, 80, 0);
    this.mapCam.up.set(0, 0, this.player.team === 1 ? 1 : -1);
    this.mapCam.lookAt(0, 0, 0);
    this.mapAspect = hw / hh;

    // HUD
    this.hudRoot = document.getElementById('hud');
    this.hud = new BattleHUD(this.hudRoot);
    this.hud.setup(world.fighters, this.player, this.colors);
    this.hud.show(true);
    this.hud.showPlayUI(false);
    this.timeLeft = o.time;
    this.state = 'intro';
    this.stateT = 0;
    this.oneMin = false;
    this.time = 0;
    this.paused = false;
    // warm up shaders
    app.renderer.compile(scene, camera);
    app.audio?.music('lobby');
    this.hud.showBanner(`<span class="mode">TURF RUSH</span>`, st.name, 'intro', 3.6);
    this.introFrom = Math.random() < 0.5 ? 1 : -1;
    if (new URLSearchParams(location.search).has('skipintro')) this.stateT = 99;
  }

  // ---------------------------------------------------------------- events
  onHit(attacker, victim, dmg) {
    if (attacker === this.player && victim !== this.player) {
      this.hud.hitMarker(!victim.alive);
      this.app.audio?.sfx('hit', { volume: 0.5 });
    }
  }

  onSplat(victim, attacker, kind) {
    const c = (f) => hexToCss(f.color);
    if (attacker && attacker !== victim) {
      this.hud.feedMsg(`<b style="color:${c(attacker)}">${attacker.name}</b> <span class="fx">splashed</span> <b style="color:${c(victim)}">${victim.name}</b>`);
      if (attacker === this.player) { this.app.audio?.sfx('ko_confirm', { volume: 0.8 }); this.hud.showBanner(`SPLASHED <span style="color:${c(victim)}">${victim.name}</span>!`, '', 'ko', 1.4); }
    } else {
      this.hud.feedMsg(`<b style="color:${c(victim)}">${victim.name}</b> fell in the water`);
    }
    if (victim === this.player) {
      this.hud.splattedBy(attacker && attacker !== victim ? attacker.name : null, attacker?.color);
      this.killer = attacker && attacker !== victim ? attacker : null;
      this.deathT = 0;
    }
  }

  // ---------------------------------------------------------------- loop
  setPaused(p) {
    this.paused = p;
    this.app.menus.pause(p, {
      onResume: () => { this.setPaused(false); this.app.input.lock(); },
      onQuit: () => { this.app.menus.pause(false); this.app.goPlaza(); },
      quitLabel: 'FORFEIT & RETURN TO PLAZA',
    });
  }

  update(dt) {
    const app = this.app, inp = app.input;
    if (this.state === 'results') { this.renderOnly = true; this.env.update(dt); this.fx.update(dt); return; }
    if (inp.action('pause') && (this.state === 'play' || this.state === 'countdown')) { this.setPaused(!this.paused); if (this.paused) inp.unlock(); }
    if (this.paused) return;
    this.time += dt;
    this.stateT += dt;
    const w = this.world;
    // ---- states
    if (this.state === 'intro') {
      const t = clamp(this.stateT / 4, 0, 1);
      const e = t * t * (3 - 2 * t);
      const a = -Math.PI / 2 - this.introFrom * (1.1 - e * 0.9);
      const R = lerp(62, 38, e), H = lerp(34, 14, e);
      const fz = this.player.team === 1 ? -1 : 1;
      this.camera.position.set(Math.cos(a) * R, H, Math.sin(a) * R * fz * -1 + fz * 10 * e);
      this.camera.lookAt(0, 0, fz * 12 * e);
      if (this.stateT > 4 || (this.stateT > 0.8 && (inp.action('confirm') || inp.mousePressed[0]))) {
        this.state = 'countdown'; this.stateT = 0;
        this.hud.showPlayUI(true);
        this.hud.showBanner('READY?', '', 'ready', 1.4);
        app.audio?.sfx('countdown');
        app.audio?.music('battle');
        this.hud.showHint(app.input.usingPad
          ? '<b>L-stick</b> move · <b>R-stick</b> aim · <b>RT</b> fire · <b>LT</b> swim · <b>A</b> jump · <b>RB</b> bomb · <b>Y</b> special · <b>Back</b> map'
          : '<b>WASD</b> move · <b>Mouse</b> aim · <b>LMB</b> fire · <b>SHIFT</b> swim in ink · <b>SPACE</b> jump · <b>RMB</b> bomb · <b>Q</b> special · <b>TAB</b> map', 9);
      }
    } else if (this.state === 'countdown') {
      if (this.stateT > 1.5 && !this.goShown) { this.goShown = true; this.hud.showBanner('GO!', '', 'go', 1.0); app.audio?.sfx('go'); }
      if (this.stateT > 1.9) { this.state = 'play'; this.stateT = 0; w.combatOn = true; }
    } else if (this.state === 'play') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 60 && !this.oneMin) {
        this.oneMin = true;
        this.hud.showBanner('1 MINUTE LEFT!', '', 'warn', 2);
        app.audio?.sfx('one_minute');
        app.audio?.music('battle_final');
      }
      if (this.timeLeft <= 10 && Math.ceil(this.timeLeft) !== this.lastTick && this.timeLeft > 0) {
        this.lastTick = Math.ceil(this.timeLeft);
        app.audio?.sfx('countdown', { volume: 0.6 });
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.state = 'end'; this.stateT = 0;
        w.combatOn = false;
        w.canRespawn = false;
        this.hud.showBanner('TIME!', '', 'time', 2.4);
        app.audio?.sfx('whistle');
        app.audio?.music(null);
      }
    } else if (this.state === 'end') {
      if (this.stateT > 2.6) this.startJudge();
    } else if (this.state === 'judge') {
      this.updateJudge(dt);
      this.env.update(dt);
      this.fx.update(dt);
      return;
    }
    this.hud.setTime(this.timeLeft);

    // ---- player control
    const p = this.player;
    const canControl = (this.state === 'play') && inp.locked !== false;
    if (this.state === 'intro') { /* camera handled above */ }
    else {
      if (!p.alive && this.killer && this.deathT < 2.5) {
        this.deathT += dt;
        const k = this.killer;
        const dx = k.pos.x - this.rig.pivot.x, dz = k.pos.z - this.rig.pivot.z;
        const ty = Math.atan2(dx, dz);
        this.rig.yaw += (((ty - this.rig.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * damp(5, dt);
        this.rig.pitch += (-0.2 - this.rig.pitch) * damp(4, dt);
        this.control.update(dt, p, w, false);
      } else {
        if (!p.alive && this.lastAlive) { /* noop */ }
        if (this.autoplay) {
          this.rig.yaw += (((p.yaw - this.rig.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * damp(4, dt);
          this.rig.update(dt, p, w.level, null);
        } else this.control.update(dt, p, w, canControl || this.state === 'countdown');
        if (!canControl && !this.autoplay) { p.intent.mx = p.intent.mz = 0; p.intent.fire = p.intent.jump = p.intent.sub = p.intent.special = p.intent.goo = false; }
      }
      if (p.alive && !this.lastAlive && this.state === 'play') this.rig.snap(p, p.spawnYaw);
      this.lastAlive = p.alive;
    }
    // ---- bots + fighters
    for (const b of this.bots) b.update(dt);
    for (const f of w.fighters) f.update(dt);
    this.combat.update(dt);
    this.fx.update(dt);
    this.env.update(dt);
    this.env.follow(p.alive ? p.pos : this.rig.pivot);
    this.stage.decor.update(this.time);
    w.listener.copy(this.camera.position);
    app.audio?.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.rig.yaw + Math.PI);
    // ---- HUD
    if (this.state !== 'intro') this.hud.update(dt, this.camera, { aimTarget: this.control.aimTarget });
    this.mapOpen = inp.action('map') && this.state !== 'intro';
    // click to lock pointer
    if (!inp.locked && inp.mousePressed[0] && this.state !== 'intro') inp.lock();
    this.hud.cover(!inp.locked && !inp.usingPad && this.state !== 'intro' && !this.paused && !this.autoplay && p.alive);
  }

  // ---------------------------------------------------------------- judge
  startJudge() {
    this.state = 'judge'; this.stateT = 0;
    this.hud.showPlayUI(false);
    this.hud.cover(false);
    if (this.scene.fog) this.scene.fog.density *= 0.35;
    this.hud.hideBanner();
    const cov = this.stage.paint.coverage();
    const a = cov.a * 100, b = cov.b * 100;
    this.result = { a, b, winner: a >= b ? 1 : 2 };
    for (const f of this.world.fighters) f.model.root.visible = f.alive;
    this.app.menus.judge(this.result, this.colors, this.player.team, () => this.showResults());
    this.app.audio?.sfx('judge_drum');
  }

  updateJudge(dt) {
    // slow top-down push-in over the arena
    const t = clamp(this.stateT / 6, 0, 1);
    const fz = this.player.team === 1 ? 1 : -1;
    this.camera.position.set(0, lerp(92, 78, t), -fz * lerp(14, 6, t));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.stage.paint.flush(this.app.renderer);
  }

  showResults() {
    this.state = 'results';
    const r = this.result;
    const won = r.winner === this.player.team;
    const p = this.player;
    const turfPts = Math.round(p.stats.turf);
    const coins = Math.round((won ? 650 : 320) + turfPts * 0.6 + p.stats.kills * 40);
    const xp = Math.round((won ? 500 : 250) + turfPts * 0.5);
    const rows = this.world.fighters.map((f) => ({
      name: f.name, team: f.team, weapon: f.weapon.name, turf: Math.round(f.stats.turf), kills: f.stats.kills, deaths: f.stats.deaths,
      assists: f.stats.assists, me: f === p, look: f.look,
    }));
    this.app.audio?.music(null);
    this.app.audio?.sfx(won ? 'win_fanfare' : 'lose_sting');
    // let the fanfare / sting land before the results loop starts
    setTimeout(() => { if (this.app.mode === this && this.state === 'results') this.app.audio?.music(won ? 'results_win' : 'results_lose'); }, won ? 3000 : 1800);
    for (const f of this.world.fighters) {
      f.model.emote = f.team === r.winner ? (Math.random() < 0.5 ? 'cheer' : 'dance') : 'sad';
    }
    this.app.input.unlock();
    const summary = { won, coins, xp, turf: turfPts, kills: p.stats.kills, deaths: p.stats.deaths, stage: this.stage.name, weapon: p.weapon.id, pct: won ? Math.max(r.a, r.b) : Math.min(r.a, r.b) };
    const prog = this.app.grantRewards(summary);
    this.app.menus.results({ ...summary, rows, colors: this.colors, myTeam: p.team, result: r, prog }, {
      onPlaza: () => this.app.goPlaza(),
      onAgain: () => this.app.startBattle({ ...this.opts }),
    });
    // winners pose on their spawn deck for the background
    this.resultCam = true;
    const wt = r.winner;
    const sp = this.stage.spawns[wt];
    const c = sp.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(sp.length);
    const fz = wt === 1 ? 1 : -1;
    const team = this.world.fighters.filter((f) => f.team === wt);
    team.forEach((f, i) => {
      f.alive = true; f.form = 'kid';
      f.place(sp[i].clone(), wt === 1 ? 0 : Math.PI);
      f.model.root.visible = true;
    });
    for (const f of this.world.fighters) if (f.team !== wt) f.model.root.visible = false;
    this.camera.position.set(c.x + 2.5, c.y + 1.7, c.z + fz * 6.5);
    this.camera.lookAt(c.x + 1.2, c.y + 1.0, c.z);
    this.resultFighters = team;
  }

  render(dt) {
    const app = this.app;
    if (this.state === 'results' && this.resultFighters) {
      for (const f of this.resultFighters) { f.model.update(dt, { speed: 0, grounded: true, vy: 0, pitch: 0, weapon: f.weapon.id }); }
    }
    this.stage.paint.flush(app.renderer);
    app.post.render(this.scene, this.camera, dt);
    if (this.mapOpen && this.state === 'play') {
      const H = Math.min(innerHeight * 0.86, innerWidth * 0.8 / this.mapAspect);
      const W = H * this.mapAspect;
      const x = (innerWidth - W) / 2, y = (innerHeight - H) / 2;
      app.post.renderViewport(this.scene, this.mapCam, x, innerHeight - y - H, W, H);
      this.hud.mapOverlay(true, this.mapCam, { x, y, w: W, h: H });
    } else this.hud.mapOverlay(false);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    for (const f of this.world.fighters) f.dispose();
    this.combat.dispose();
    this.fx.dispose();
    this.stage.level.dispose();
    this.stage.paint.dispose();
    this.env.dispose();
    this.hud.show(false);
    this.hudRoot.innerHTML = '';
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
  }
}
