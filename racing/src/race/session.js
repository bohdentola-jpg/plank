// A race in progress: the world, the simulation (sim.js), car models,
// camera, effects, engine audio, sfx, music and HUD events. Screens own the
// HUD drawing and menus around it (screens/race.js + race/hud.js).
import * as THREE from 'three';
import { buildWorld } from '../track/build.js';
import { buildCarModel } from '../car/model.js';
import { RaceSim } from './sim.js';
import { proRun, ghostAt, ghostTimeAtDist } from './ghost.js';
import { TrafficRender } from './trafficModels.js';
import { ReplayRecorder, ReplayPlayer } from './replay.js';
import { ChaseCamera } from './camera.js';
import { Effects } from './effects.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { clamp, damp } from '../core/util.js';
import { audio } from '../audio/audio.js';
import { EngineSound } from '../audio/engine.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';

const HEAD_I = 70;   // player headlight intensity (cd)

const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();

const SURF_AUDIO = { road: 'asphalt', curb: 'asphalt', sidewalk: 'asphalt', grass: 'grass', dirt: 'dirt', sand: 'sand', gravel: 'dirt' };

export function engineProfile(spec, up = {}) {
  return {
    layout: spec.sound.layout,
    idle: spec.perf.idle,
    redline: spec.perf.redline + (up.redline || 0),
    turbo: Math.min(1, (spec.sound.turbo || 0) + (up.turboSound || 0)),
    supercharger: !!up.supercharger,
    exhaust: Math.min(1, (spec.sound.exhaust || 0.3) + (up.exhaustSound || 0)),
    pitch: spec.sound.pitch || 1,
  };
}

export class RaceSession {
  /**
   * opts: { track (def), type, laps, player: {spec, look, upgrades, name},
   *         opponents: [{spec, look, upgrades, name, skill}], playerGrid, rubber, musicTheme }
   */
  constructor(opts) {
    this.opts = opts;
    this.def = opts.track;
    this.type = opts.type || this.def.type || 'circuit';
    this.state = 'loading';
    this.time = 0;
    this.camera = new ChaseCamera();
    this.camera.setMode(settings.get('camera') ?? 1);
    this.messages = [];     // HUD center messages {text, sub, t, dur, color, big}
    this.hudEvents = [];
    this.introT = 0;
    this.shakeFx = 0;
    this.paused = false;
  }

  async load(renderer, progress = () => {}) {
    const world = await buildWorld(this.def, renderer, (f, l) => progress(f * 0.8, l));
    this.world = world;
    this.track = world.track;
    this.scene = world.scene;
    this.track.computeRacingLine(1.12);
    await this.setupRace(progress);
  }

  /** The race itself on a built world: the grid, the cars, the sounds (simExtra: more for the sim). */
  async setupRace(progress, simExtra = {}) {
    progress(0.84, 'ROLLING CARS OUT');
    const racers = [{ ...this.opts.player, isPlayer: true, name: this.opts.player.name || 'YOU' }, ...(this.opts.opponents || [])];
    this.sim = new RaceSim(this.track, {
      ...simExtra,
      type: this.type, laps: this.opts.laps || this.def.laps || 3, racers,
      auto: settings.get('transmission') !== 'manual',
      // drift events run loose: stability control would smother every slide
      assists: settings.get('assists') === 'on' && this.type !== 'drift' ? 1 : 0.25,
      rubber: this.opts.rubber ?? 1, playerGrid: this.opts.playerGrid || 'back', seed: this.def.id,
      traffic: this.opts.traffic ?? !!this.def.traffic,
      driftRivals: this.opts.driftRivals,
    });
    this.player = this.sim.player;
    if (this.type === 'timeattack') {
      progress(0.86, 'TIMING THE PRO');
      await new Promise((r) => setTimeout(r, 0));
      const g = proRun(this.track, this.opts.player.spec, this.opts.player.upgrades || {}, { skill: 0.93 });
      if (g) {
        this.ghostRun = g;
        this.target = g.target * (this.opts.ttFactor ?? 1);
        const gm = buildCarModel(this.opts.player.spec, this.opts.player.look || {}, { hiRes: false, interior: false, shadow: false });
        const holo = new THREE.MeshBasicMaterial({ color: 0x46e8ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
        gm.group.traverse((o) => { if (o.isMesh) { o.material = holo; o.castShadow = false; } });
        this.ghostModel = gm;
        this.scene.add(gm.group);
      }
    }
    for (const r of this.sim.racers) {
      r.model = buildCarModel(r.spec, r.look || {}, { hiRes: r.isPlayer, interior: true });
      this.scene.add(r.model.group);
      r.prevThrottle = 0;
    }
    if (this.sim.traffic) {
      progress(0.88, 'CLEARING THE ROADS');
      this.trafficRender = new TrafficRender(this.scene, this.sim.traffic, { night: !!this.world.at.headlights, seed: this.def.id });
    }
    if (this.world.at.headlights) {
      this.addHeadlights(this.player);
      for (const r of this.sim.racers) if (!r.isPlayer) this.addLightPool(r);
    }
    this.effects = new Effects(this.scene, { rain: this.def.weather === 'rain', night: !!this.world.at.lamps });
    this.recorder = new ReplayRecorder(this.sim.racers.length, this.sim.traffic ? this.sim.traffic.cars.length : 0);
    this.replay = null;
    progress(0.92, 'WARMING ENGINES');
    this.setupAudio();
    // intro: orbit the player's car
    const p = this.player.vehicle;
    this.camera.startOrbit(new THREE.Vector3(p.x, p.y, p.z), 8.2, 0, 1.9, 0.38, p.heading + 2.5);
    this.syncModels(0);
    this.state = 'intro';
    progress(1, 'READY');
  }

  setupAudio() {
    try {
      EngineSound.prewarm?.(engineProfile(this.player.spec, this.player.upgrades || {}), { player: true });
    } catch { /* audio not ready */ }
    this.engines = [];
    for (const r of this.sim.racers) {
      try {
        r.engine = new EngineSound(engineProfile(r.spec, r.isPlayer ? (this.opts.player.upgrades || {}) : {}), { player: r.isPlayer });
        this.engines.push(r.engine);
      } catch (e) { console.warn('engine audio', e); }
    }
    try {
      sfx.ambience(this.def.env === 'circuit' ? 'circuit' : this.def.env);
      if (this.def.weather === 'rain') sfx.rain(0.8);
    } catch { /* */ }
    const theme = this.opts.musicTheme || `race_${this.def.env === 'city' ? 'city' : this.def.env}`;
    this.raceTheme = theme;
    try { music.play(theme, { seed: this.def.id, fade: 2, intensity: 0.5 }); music.setRaceState({ countdown: true }); } catch { /* */ }
  }

  addHeadlights(r) {
    const g = r.model.group;
    this.headSpots = [];
    this.hlK = null;
    for (const sd of [-1, 1]) {
      const sp = new THREE.SpotLight(0xfff1dc, HEAD_I, 75, 0.5, 0.85, 1.4);
      sp.position.set(sd * 0.6, 0.7, r.dims.L / 2 - 0.1);
      sp.target.position.set(sd * 1.1, -0.8, r.dims.L / 2 + 20);
      g.add(sp);
      g.add(sp.target);
      this.headSpots.push(sp);
    }
  }

  /** Dip the beams when a car sits right in front of ours. Spot falloff is
   *  steep, so at a few metres the car ahead would otherwise blow out to
   *  white in the bloom (most visible on the grid at night). */
  dimHeadlights(dt) {
    if (!this.headSpots) return;
    const P = this.player;
    const v = P.vehicle;
    const [fx, fz] = v.fwd;
    const [lx, lz] = v.left;
    let near = Infinity;
    const check = (x, z, halfL) => {
      const dx = x - v.x, dz = z - v.z;
      const f = dx * fx + dz * fz - halfL;
      if (f <= 0 || f > 14) return;
      if (Math.abs(dx * lx + dz * lz) < 1.2 + f * 0.15) near = Math.min(near, f);
    };
    for (const r of this.sim.racers) if (r !== P && !(r.out && r.parked)) check(r.vehicle.x, r.vehicle.z, r.dims.L / 2);
    if (this.sim.traffic) for (const c of this.sim.traffic.cars) check(c.x, c.z, c.dims.L / 2);
    const gap = Math.max(0.5, near - P.dims.L / 2);
    // full beams from 11 m out, dipped hard when nose to tail
    const k = clamp(Math.pow(gap / 11, 1.8), 0.08, 1);
    this.hlK = this.hlK === null ? k : damp(this.hlK, k, 5, dt);
    for (const sp of this.headSpots) sp.intensity = HEAD_I * this.hlK;
  }

  /** Cheap fake headlight pool on the road ahead of AI cars at night. */
  addLightPool(r) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 110, 4, 32, 70, 70);
    gr.addColorStop(0, 'rgba(255,240,215,0.9)');
    gr.addColorStop(1, 'rgba(255,240,215,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 128);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 14), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x8a7a66 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.06, r.dims.L / 2 + 6.5);
    m.renderOrder = 2;
    r.model.group.add(m);
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    if (this.state === 'loading') return;
    this.time += dt;
    const sim = this.sim;
    sim.events.length = 0;
    if (this.replay) { this.updateReplay(dt); return; }

    if (this.state === 'intro') {
      this.introT += dt;
      if (this.introT > 3.4 || input.pressed('confirm')) this.startCountdown();
    }

    this.readPlayer();
    sim.step(dt);
    if (sim.state === 'racing' && this.state === 'countdown') { this.state = 'racing'; this.recorder.goT = this.recorder.clock; }
    if (sim.state === 'finished' && this.state === 'racing') this.state = 'finished';
    if (sim.state === 'done' && this.state !== 'done') { this.state = 'done'; this.doneT = 0; }
    if (this.state === 'done') this.doneT += dt;

    this.handleEvents();
    this.syncModels(dt);
    this.dimHeadlights(dt);
    this.updateGhost(dt);
    // tape the race from the countdown until a few seconds after the flag
    if (this.state === 'countdown' || this.state === 'racing' || this.state === 'finished' || (this.state === 'done' && this.doneT < 4)) {
      this.recorder.update(dt, sim.racers, sim.traffic);
    }
    this.trafficRender?.update(this.camera.cam);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateAudio(dt);
    this.world.update(dt, this.camera.cam);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.dur);
  }

  startCountdown() {
    this.state = 'countdown';
    this.camera.orbit = null;
    this.camera.first = true;
    this.sim.startCountdown(3);
  }

  readPlayer() {
    const r = this.player;
    const c = r.ctl;
    const auto = this.state === 'finished' || this.state === 'done' || (r.ai && r.ai.autopilot !== false && new URLSearchParams(location.search).get('autopilot'));
    if (auto) {
      // after the flag the AI brain takes over your car for the cool-down lap
      if (!r.ai) {
        import('./ai.js').then(({ AIDriver }) => { r.ai = r.ai || new AIDriver(r, this.track, { skill: 0.7, rubber: 0 }); });
      }
      return;
    }
    c.throttle = input.throttle;
    c.brake = input.brake;
    c.steer = input.steer;
    c.steerDigital = input.steerDigital;
    c.handbrake = input.handbrake;
    c.nitro = input.nitro;
    if (input.pressed('shiftUp')) c.shiftUp = true;
    if (input.pressed('shiftDown')) c.shiftDown = true;
    if (input.pressed('camera')) {
      this.camera.setMode(this.camera.mode + 1);
      settings.set('camera', this.camera.mode);
    }
    if (input.pressed('reset') && this.sim.state === 'racing') this.sim.resetRacer(r);
    this.lookBack = input.lookBack;
  }

  message(text, sub = '', opts = {}) {
    this.messages = this.messages.filter((m) => m.slot !== (opts.slot || 'center'));
    this.messages.push({ text, sub, t: 0, dur: opts.dur ?? 2.2, color: opts.color, slot: opts.slot || 'center', big: opts.big });
  }

  handleEvents() {
    const P = this.player;
    const pv = P.vehicle;
    for (const e of this.sim.events) {
      switch (e.type) {
        case 'count':
          try { sfx.countdown(e.n); } catch { /* */ }
          this.hudEvents.push({ type: 'count', n: e.n, t: this.time });
          break;
        case 'go':
          try { sfx.countdown(0); music.stinger('go'); music.setRaceState({ countdown: false }); } catch { /* */ }
          if (this.type === 'drag') this.message('SHIFT ON THE LIGHTS', 'R1 / E  UP   ·   L1 / Q  DOWN', { slot: 'top', dur: 2.6, color: '#ffb21e' });
          this.hudEvents.push({ type: 'go', t: this.time });
          break;
        case 'launch':
          this.message(e.grade, e.perfect ? '+ BOOST' : '', { color: e.perfect ? '#4dff8b' : undefined, dur: 1.8, slot: 'top' });
          break;
        case 'lap': {
          try { sfx.checkpoint(); music.stinger('lap'); } catch { /* */ }
          // beat the hall-of-fame lap for this road?
          const rec = this.recordLap ?? ((store.load('records') || {})[this.def.id]?.bestLap ?? Infinity);
          const record = e.time < rec;
          if (record) this.recordLap = e.time;
          if (e.final) this.message('FINAL LAP', record ? `TRACK RECORD ${fmt(e.time)}` : '', { color: '#ffb21e', dur: 2.6, big: true });
          else if (record && rec !== Infinity) this.message('TRACK RECORD', fmt(e.time), { color: '#4dff8b', dur: 2.4 });
          else this.message(`LAP ${e.lap + 1}`, `${e.best ? 'BEST ' : ''}${fmt(e.time)}`, { dur: 2.2 });
          break;
        }
        case 'finallap':
          try { music.stinger('finalLap'); music.setRaceState({ finalLap: true }); } catch { /* */ }
          break;
        case 'finish':
          if (e.player) {
            const won = e.place === 1;
            try { music.stinger(won ? 'win' : 'lose'); music.setRaceState({ finished: true }); } catch { /* */ }
            this.message(e.out ? 'KNOCKED OUT' : won ? 'YOU WIN' : `${ordinal(e.place)} PLACE`, e.out ? '' : this.type === 'drift' ? `${(e.score || 0).toLocaleString()} PTS` : fmt(e.time), { color: won ? '#4dff8b' : e.out ? '#ff3d52' : '#ffb21e', dur: 5, big: true });
          }
          break;
        case 'knockout':
          if (!e.player) this.message(`${e.name} KNOCKED OUT`, '', { color: '#ff3d52', dur: 2.4, slot: 'top' });
          break;
        case 'wrongway':
          this.wrongWay = e.on;
          break;
        case 'wallhit':
        case 'carhit': {
          const involved = e.id === P.id || e.a === P.id || e.b === P.id;
          const d = Math.hypot((e.x ?? pv.x) - pv.x, (e.z ?? pv.z) - pv.z);
          const strength = clamp(e.impact / 14, 0.1, 1) * (involved ? 1 : clamp(1 - d / 60, 0, 0.6));
          if (strength > 0.05) {
            try { sfx.impact(strength, e.type === 'carhit' ? 'car' : 'wall'); } catch { /* */ }
          }
          if (involved) {
            this.camera.addShake(strength * 1.2);
            input.rumble(strength, strength * 0.6, 180);
            this.crashT = 0.3;
            if (e.x !== undefined) this.effects.sparks(e.x, e.y ?? pv.y, e.z, 0, 0, Math.round(6 + strength * 14), 6 + strength * 8);
          }
          break;
        }
        case 'landing':
          if (e.id === P.id) {
            try { sfx.landing(e.strength); } catch { /* */ }
            this.camera.addShake(e.strength * 0.8);
            input.rumble(e.strength * 0.8, e.strength, 160);
          }
          break;
        case 'drifthop':
          if (e.id === P.id) { try { sfx.landing(0.12); } catch { /* */ } input.rumble(0.15, 0.3, 70); }
          break;
        case 'airtime':
          if (e.t > 0.8) this.message('AIR TIME', `${e.t.toFixed(1)}s  + NITROUS`, { slot: 'top', dur: 1.6, color: '#46e8ff' });
          break;
        case 'driftbank':
          this.message(`+${e.pts.toLocaleString()}`, e.mult > 1 ? `X${e.mult} DRIFT` : 'DRIFT', { slot: 'top', dur: 1.6, color: e.mult >= 4 ? '#ff3d6e' : e.mult >= 3 ? '#ffb21e' : '#46e8ff' });
          try { sfx.checkpoint(); } catch { /* */ }
          break;
        case 'driftmult':
          try { sfx.ui('tab'); } catch { /* */ }
          break;
        case 'driftlost':
          this.message(e.why, `-${e.pts.toLocaleString()}`, { slot: 'top', dur: 1.4, color: '#ff3d52' });
          try { sfx.ui('error'); } catch { /* */ }
          break;
        case 'nearmiss':
          this.message(e.oncoming ? 'ONCOMING!' : 'NEAR MISS', '+ NITROUS', { slot: 'top', dur: 1.3, color: e.oncoming ? '#ffb21e' : '#46e8ff' });
          try { sfx.whoosh(0.9); } catch { /* */ }
          input.rumble(0.15, 0.4, 90);
          break;
        case 'driftbonus':
          // (say once that drifting pays nitrous)
          if (this.type !== 'drift' && !this.driftTold) { this.driftTold = true; this.message('DRIFT', '+ NITROUS', { slot: 'top', dur: 1.4, color: '#46e8ff' }); }
          break;
        case 'shift':
          try { sfx.shift(); } catch { /* */ }
          if (e.grade === 'PERFECT') this.message('PERFECT SHIFT', '+ BOOST', { slot: 'top', dur: 1.1, color: '#4dff8b' });
          else if (e.grade === 'GOOD') this.message('GOOD SHIFT', '', { slot: 'top', dur: 0.9, color: '#46e8ff' });
          else if (e.grade === 'EARLY') this.message('EARLY SHIFT', '', { slot: 'top', dur: 0.9, color: '#ffb21e' });
          if (e.dir > 0 && pv.rpm > pv.P.redline * 0.8 && Math.random() < 0.55) this.backfire(P, 0.7);
          break;
        case 'reset':
          if (e.player) this.message('RESET', '', { slot: 'top', dur: 1 });
          break;
        default:
      }
    }
  }

  backfire(r, strength) {
    try { r.engine?.backfire(strength); } catch { /* */ }
    r.flameT = 0.12;
  }

  syncModels(dt) {
    const night = this.world.at.headlights;
    for (const r of this.sim.racers) {
      const v = r.vehicle;
      const m = r.model;
      const n = v.groundN || [0, 1, 0];
      const [fx, fz] = v.fwd;
      const [lx, lz] = v.left;
      const nf = n[0] * fx + n[2] * fz;
      const nl = n[0] * lx + n[2] * lz;
      if (v.airborne) {
        r.airPitch = damp(r.airPitch || 0, clamp(-v.vy * 0.03, -0.3, 0.35), 3, dt);
        _e.set(r.airPitch, v.heading, 0);
      } else {
        r.airPitch = nf / Math.max(0.3, n[1]);
        _e.set(r.airPitch, v.heading, -nl / Math.max(0.3, n[1]));
      }
      m.group.rotation.copy(_e);
      m.group.position.set(v.x, v.y, v.z);
      const vis = v.visual();
      m.animate(dt, vis.speed, vis.steer, vis.pitch, vis.roll, vis.heave, vis.wheel);
      r._vis = vis;
      m.setLights(night ? 1 : 0, night ? 1 : 0.18, v.brakeLight);
      m.group.visible = !(r.out && r.parked);
    }
  }

  /** Place the pro's ghost for the current lap and work out the split delta. */
  updateGhost(dt) {
    const g = this.ghostRun;
    if (!g || !this.ghostModel) return;
    const sim = this.sim, P = this.player, T = this.track;
    const trace = P.lap === 0 ? g.lap1 : g.fly;
    const racing = sim.state === 'racing' && !P.finished;
    const lapT = racing ? sim.raceTime - (T.closed ? P.lapStart : 0) : 0;
    const pose = ghostAt(trace, lapT, this._gp || (this._gp = {}));
    const m = this.ghostModel;
    m.group.visible = !!pose && !P.finished;
    if (pose) {
      m.group.position.set(pose.x, pose.y, pose.z);
      m.group.rotation.set(0, pose.heading, 0);
      m.animate(dt, racing ? 20 : 0, 0);
      // fade out when it's right on top of us
      const d = Math.hypot(pose.x - P.vehicle.x, pose.z - P.vehicle.z);
      m.group.traverse((o) => { if (o.isMesh) o.material.opacity = 0.05 + 0.13 * clamp(d / 8, 0, 1); });
    }
    if (racing) {
      const dist = T.closed ? P.total - P.lap * T.length : P.total;
      const gt = ghostTimeAtDist(trace, dist);
      this.ghostDelta = gt === null ? null : lapT - gt;
    } else this.ghostDelta = null;
  }

  updateEffects(dt) {
    const fx = this.effects;
    for (const r of this.sim.racers) {
      const v = r.vehicle;
      const [fX, fZ] = v.fwd;
      const [lX, lZ] = v.left;
      const L = r.dims.L, Wd = r.dims.W;
      const surf = v.surface;
      const loose = surf === 'dirt' || surf === 'sand' || surf === 'grass' || surf === 'gravel';
      const slip = Math.max(v.slipR - 0.1, v.slipF - 0.16, 0) * 2.4 + v.wheelSpin * 0.06;
      const amount = clamp(slip, 0, 1.5) * clamp(v.speed / 6, 0, 1);
      const near = Math.hypot(v.x - this.camera.cam.position.x, v.z - this.camera.cam.position.z) < 160;
      // rear wheel contact points
      for (const side of [1, -1]) {
        const wx = v.x - fX * (L * 0.32) + lX * side * Wd * 0.42;
        const wz = v.z - fZ * (L * 0.32) + lZ * side * Wd * 0.42;
        const key = r.id * 4 + (side > 0 ? 0 : 1);
        if (!v.airborne && (amount > 0.25 || (loose && v.speed > 8))) {
          if (!loose && amount > 0.25) fx.skids.add(key, wx, v.y, wz, lX, lZ, clamp(amount, 0, 1));
          else fx.skids.break(key);
          // puffs per second (not per frame, so a fast PC isn't foggier)
          const acc = r.smokeAcc || (r.smokeAcc = [0, 0]);
          const si = side > 0 ? 0 : 1;
          // (an arcade drift is mostly squeal and skid marks: a light haze)
          acc[si] += dt * (loose ? 8 + Math.min(10, v.speed / 3) : clamp(amount, 0, 1.2) * (v.driftState === 1 ? 5 : 13));
          while (acc[si] >= 1) {
            acc[si] -= 1;
            if (near) fx.tireSmoke(wx, v.y, wz, v.vx, v.vz, clamp(amount, 0, 1), surf);
          }
        } else fx.skids.break(key);
      }
      // sparks while scraping a wall
      if (r.scraping && v.speed > 6 && r.scrapePoint && near && Math.random() < 0.7) {
        fx.sparks(r.scrapePoint[0], v.y, r.scrapePoint[1], -v.vx * 0.05, -v.vz * 0.05, 2, v.speed * 0.25);
      }
      // exhaust flames: nitrous (blue) + backfire pops (orange)
      if ((v.nitroOn || r.flameT > 0) && near) {
        const exs = r.model.exhausts || [[0.4, 0.32]];
        for (const [ex, ey] of exs) {
          const px = v.x - fX * (L / 2 + 0.1) + lX * ex;
          const pz = v.z - fZ * (L / 2 + 0.1) + lZ * ex;
          fx.flame(px, v.y + ey, pz, -fX * 6 + v.vx * 0.9, 0, -fZ * 6 + v.vz * 0.9, v.nitroOn);
        }
      }
      if (r.flameT > 0) r.flameT -= dt;
      // AI lift-off pops
      if (!r.isPlayer && r.prevThrottle > 0.8 && r.ctl.throttle < 0.1 && v.rpm > v.P.redline * 0.7 && Math.random() < 0.3) this.backfire(r, 0.5);
      if (r.isPlayer && r.prevThrottle > 0.75 && r.ctl.throttle < 0.08 && v.rpm > v.P.redline * 0.62) {
        if (Math.random() < 0.6) this.backfire(r, 0.55 + Math.random() * 0.4);
        if (v.boost > 0.45) { try { r.engine?.blowOff(); } catch { /* */ } }
      }
      r.prevThrottle = r.ctl.throttle;
    }
    const pv = this.player.vehicle;
    fx.update(dt, this.camera.cam, { x: pv.vx, z: pv.vz });
  }

  updateCamera(dt) {
    const v = this.player.vehicle;
    const car = { x: v.x, y: v.y, z: v.z, heading: v.heading, vF: v.vF, vx: v.vx, vz: v.vz, nitroOn: v.nitroOn };
    const surfR = { curb: 0.6, grass: 0.4, dirt: 0.5, sand: 0.5, gravel: 0.9, sidewalk: 0.3 }[v.surface] || 0;
    this.camera.update(dt, car, { lookBack: this.lookBack, rumble: surfR * clamp(v.speed / 20, 0, 1) });
    if (this.world.sun) this.world.sunFollow = _v.set(v.x, v.y, v.z);
    // radial speed blur + nitro kick for the renderer
    const k = clamp((v.speed - 22) / 42, 0, 1);
    this.fx = { radialBlur: k * 0.45 + (v.nitroOn ? 0.35 : 0), blurCenter: [0.5, 0.56] };
    if (surfR > 0 && v.speed > 4) input.rumble(surfR * 0.25, surfR * 0.5, 60);
    else if (v.driftState === 1) input.rumble(0.06 + 0.22 * Math.min(1, Math.abs(v.driftAngle)), 0.12, 60);
  }

  updateAudio(dt) {
    const sim = this.sim;
    const P = this.player;
    const pv = P.vehicle;
    const cam = this.camera.cam;
    // listener-ish frame from the camera
    const cr = _v.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const crx = cr.x, crz = cr.z;
    for (const r of sim.racers) {
      const e = r.engine;
      if (!e) continue;
      const v = r.vehicle;
      const thr = v.throttle;
      const load = thr > 0.08 ? thr : (v.gear > 0 && v.speed > 3 ? -0.7 : 0);
      try {
        e.update(dt, { rpm: v.rpm, throttle: thr, load, gear: v.gear, shifting: v.shiftT > 0, limiter: v.limiter, boost: v.boost });
        if (!r.isPlayer) {
          const dx = v.x - cam.position.x, dz = v.z - cam.position.z;
          const d = Math.hypot(dx, dz) + 0.001;
          const gain = Math.pow(clamp(1 - d / 140, 0, 1), 1.6) * (r.out && r.parked ? 0 : 0.95);
          const pan = clamp((dx * crx + dz * crz) / d, -1, 1) * 0.85;
          // doppler from the closing speed along the line of sight (exaggerated a touch)
          const rel = ((v.vx - pv.vx) * dx + (v.vz - pv.vz) * dz) / d;
          const dop = clamp(1 - rel / 343 * 2.2, 0.85, 1.15);
          e.setSpatial({ gain, pan, doppler: dop });
        }
      } catch { /* audio not ready */ }
    }
    try {
      const slip = Math.max(pv.slipR - 0.1, pv.slipF - 0.15, 0) * 2.2 + pv.wheelSpin * 0.05;
      const surf = SURF_AUDIO[pv.surface] || 'asphalt';
      sfx.skid(pv.airborne ? 0 : clamp(slip, 0, 1) * clamp(pv.speed / 6, 0, 1), surf);
      sfx.wind(pv.speed);
      sfx.roll(pv.airborne ? 0 : pv.speed, surf);
      sfx.rumble(pv.surface === 'curb' ? clamp(pv.speed / 25, 0, 1) : 0);
      sfx.scrape(P.scraping ? clamp(pv.speed / 25, 0.2, 1) : 0);
      sfx.nitro(pv.nitroOn);
      if (this.def.env === 'circuit') sfx.crowd(sim.state === 'racing' ? 0.4 : 0.6);
      const nearest = sim.racers.reduce((m, r) => (r === P ? m : Math.min(m, Math.hypot(r.vehicle.x - pv.x, r.vehicle.z - pv.z))), 999);
      if (nearest < 3.5 && pv.speed > 30 && !this._whooshT) { sfx.whoosh(0.6); this._whooshT = 0.8; }
    } catch { /* */ }
    if (this._whooshT) this._whooshT = Math.max(0, this._whooshT - dt);
    if (this.crashT) this.crashT = Math.max(0, this.crashT - dt);
    try {
      music.setRaceState({
        countdown: this.state === 'countdown' || this.state === 'intro',
        // hold the hook through the countdown and the first seconds after GO
        position: this.state === 'racing' && sim.raceTime > 6 ? P.pos : 1, cars: sim.racers.length, lap: P.lap + 1, laps: sim.laps,
        nitro: pv.nitroOn, speed: clamp(pv.speed / 70, 0, 1), airborne: pv.airborne && pv.airTime > 0.25,
        crashed: this.crashT > 0.25, finished: P.finished,
      });
      music.setIntensity(this.state === 'racing' ? 0.85 + (P.pos === 1 ? 0.15 : 0) : 0.55);
      music.update?.();
    } catch { /* */ }
  }

  pause(on) {
    this.paused = on;
    try { audio.duck(on ? 1 : 0); } catch { /* */ }
  }

  view() { return { scene: this.scene, camera: this.replay ? this.replay.cam : this.camera.cam }; }

  // ---------------------------------------------------------------- replay

  /** Enough tape for a replay? (the race got under way) */
  get canReplay() { return this.recorder.duration > 3; }

  startReplay() {
    if (!this.canReplay) return false;
    this.replay = new ReplayPlayer(this, this.recorder);
    if (this.ghostModel) this.ghostModel.group.visible = false; // the pro's ghost isn't on the tape
    try { sfx.skid(0); sfx.scrape(0); sfx.nitro(false); sfx.wind(0); sfx.roll(0, 'asphalt'); } catch { /* */ }
    try { music.play(this.raceTheme || 'race_city', { seed: this.def.id + 'replay', fade: 1.5, intensity: 0.6 }); } catch { /* */ }
    return true;
  }

  stopReplay(resultsTheme) {
    if (!this.replay) return;
    this.replay.exit();
    this.replay = null;
    this.camera.first = true;
    if (resultsTheme) { try { music.play(resultsTheme, { fade: 1.5 }); } catch { /* */ } }
  }

  updateReplay(dt) {
    const rp = this.replay;
    rp.update(dt);
    this.trafficRender?.update(rp.cam);
    const c = rp.cars[rp.focus];
    this.effects.update(dt, rp.cam, { x: Math.sin(c.heading) * c.speed, z: Math.cos(c.heading) * c.speed });
    this.world.update(dt, rp.cam);
    if (this.world.sun) this.world.sunFollow = _v.set(c.x, c.y, c.z);
    this.fx = { radialBlur: 0, blurCenter: [0.5, 0.5], interference: rp.paused ? 0.06 : rp.rate !== 1 ? 0.35 : 0, staticAmt: rp.glitch * 0.5 };
    try {
      music.setRaceState({ countdown: false, position: 1, cars: this.sim.racers.length, lap: 1, laps: 1, nitro: !!c.nitro && rp.rate === 1, speed: clamp(c.speed / 70, 0, 1), airborne: false, crashed: false, finished: false });
      music.update?.();
    } catch { /* */ }
  }

  dispose() {
    for (const r of this.sim?.racers || []) {
      try { r.engine?.stop(); } catch { /* */ }
      r.model?.dispose();
    }
    this.ghostModel?.dispose();
    this.trafficRender?.dispose();
    try { sfx.stopAll(); sfx.ambience(null); } catch { /* */ }
    this.world?.dispose();
  }
}

function fmt(t) {
  if (t === null || t === undefined || !isFinite(t)) return '-:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
function ordinal(n) {
  const s = ['TH', 'ST', 'ND', 'RD'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
