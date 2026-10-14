// A race in progress: world, racers (player + AI), physics, rules, camera.
// The race screen (screens/race.js) owns HUD/menus around it.
import * as THREE from 'three';
import { buildWorld } from '../track/build.js';
import { buildCarModel } from '../car/model.js';
import { Vehicle, PHYS_DT, collideCars } from '../car/physics.js';
import { ChaseCamera } from './camera.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp, damp } from '../core/util.js';

const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class RaceSession {
  /**
   * opts: { track (def), type, laps, player: {spec, look, upgrades, name},
   *         opponents: [{spec, look, upgrades, name, skill}], traffic }
   */
  constructor(opts) {
    this.opts = opts;
    this.def = opts.track;
    this.type = opts.type || this.def.type || 'circuit';
    this.laps = this.type === 'sprint' || this.type === 'drag' ? 1 : (opts.laps || this.def.laps || 3);
    this.racers = [];
    this.time = 0;
    this.raceTime = 0;
    this.state = 'loading'; // loading → intro → countdown → racing → finished
    this.countdown = 0;
    this.camera = new ChaseCamera();
    this.camera.setMode(settings.get('camera') ?? 1);
    this.events = [];       // HUD/audio events queue: {type, ...}
    this.physAcc = 0;
  }

  emit(type, data = {}) { this.events.push({ type, t: this.time, ...data }); }

  async load(progress = () => {}) {
    const world = await buildWorld(this.def, this.renderer, (f, l) => progress(f * 0.85, l));
    this.world = world;
    this.track = world.track;
    this.scene = world.scene;
    this.track.computeRacingLine(1.12);
    progress(0.88, 'ROLLING CARS OUT');
    const all = [{ ...this.opts.player, isPlayer: true }, ...(this.opts.opponents || [])];
    all.forEach((r, k) => {
      const model = buildCarModel(r.spec, r.look || {}, { hiRes: !!r.isPlayer, interior: true });
      const veh = new Vehicle(r.spec, r.upgrades || {});
      this.scene.add(model.group);
      this.racers.push({
        id: k, name: r.name || r.spec.model, isPlayer: !!r.isPlayer, spec: r.spec, look: r.look,
        vehicle: veh, model, ai: null, skill: r.skill ?? 0.8,
        hint: -1, s: 0, lap: 0, lapStartTime: 0, lastLap: null, bestLap: null, laps: [],
        finished: false, finishTime: null, pos: k + 1, total: 0, half: false,
        ctl: { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false },
        dims: { L: r.spec.body.L, W: r.spec.body.W },
      });
    });
    this.player = this.racers[0];
    this.placeGrid();
    // player headlights
    if (this.world.at.headlights) this.addHeadlights(this.player);
    this.state = 'intro';
    this.introT = 0;
    const p = this.player.vehicle;
    this.camera.startOrbit(new THREE.Vector3(p.x, p.y, p.z), 8.5, 0, 2.0, 0.4, p.heading + 2.4);
    progress(1, 'READY');
  }

  addHeadlights(r) {
    const g = r.model.group;
    for (const sd of [-1, 1]) {
      const sp = new THREE.SpotLight(0xfff1dc, 60, 70, 0.42, 0.55, 1.6);
      sp.position.set(sd * 0.6, 0.7, r.dims.L / 2 - 0.1);
      sp.target.position.set(sd * 0.9, -0.6, r.dims.L / 2 + 18);
      g.add(sp);
      g.add(sp.target);
    }
  }

  placeGrid() {
    const T = this.track;
    const n = this.racers.length;
    // player starts mid-pack-ish at the back in races with opponents
    const order = this.racers.slice(1).concat([this.player]);
    order.forEach((r, k) => {
      const row = Math.floor(k / 2);
      const col = k % 2;
      const s = T.startS - 7 - row * 8 - col * 2.5;
      const w = T.W[T.posAt(s).i];
      const lat = (col ? -1 : 1) * w * 0.38;
      const p = T.posAt(s, lat);
      r.vehicle.reset(p.x, p.z, p.heading, p.y);
      r.hint = p.i;
      r.s = s;
      r.lap = 0;
      r.total = s - T.startS;
      r.gridS = s;
    });
    void n;
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    this.time += dt;
    this.events.length = 0;
    const st = this.state;
    if (st === 'intro') {
      this.introT += dt;
      if (this.introT > 3.2 || input.pressed('confirm')) this.beginCountdown();
    } else if (st === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.emit('count', { n: after });
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.raceTime = 0;
        for (const r of this.racers) r.lapStartTime = 0;
        this.emit('go');
      }
    } else if (st === 'racing' || st === 'finished') {
      this.raceTime += dt;
    }

    this.readPlayer(dt);
    this.stepPhysics(dt);
    this.updateProgress();
    this.syncModels(dt);
    this.updateCamera(dt);
    this.world.update(dt, this.camera.cam);
  }

  beginCountdown() {
    this.state = 'countdown';
    this.countdown = 3.0;
    this.camera.orbit = null;
    this.camera.first = true;
    this.emit('count', { n: 3 });
  }

  readPlayer() {
    const c = this.player.ctl;
    const frozen = this.state === 'intro' || this.state === 'countdown';
    c.throttle = input.throttle;
    c.brake = input.brake;
    c.steer = input.steer;
    c.handbrake = input.handbrake || frozen;
    c.nitro = input.nitro && !frozen;
    c.shiftUp = input.pressed('shiftUp');
    c.shiftDown = input.pressed('shiftDown');
    if (input.pressed('camera')) {
      this.camera.setMode(this.camera.mode + 1);
      settings.set('camera', this.camera.mode);
    }
    if (input.pressed('reset') && this.state === 'racing') this.resetRacer(this.player);
    this.lookBack = input.lookBack;
  }

  resetRacer(r) {
    const T = this.track;
    const p = T.posAt(r.s, 0);
    r.vehicle.reset(p.x, p.z, p.heading, p.y + 0.3);
    r.hint = p.i;
    r.vehicle.nitro = r.vehicle.nitro; // keep tank
    this.emit('reset', { id: r.id });
  }

  stepPhysics(dt) {
    const T = this.track;
    const frozen = this.state === 'intro' || this.state === 'countdown';
    this.physAcc += Math.min(dt, 0.1);
    let steps = 0;
    const auto = settings.get('transmission') !== 'manual';
    const assists = settings.get('assists') === 'on' ? 1 : 0.25;
    while (this.physAcc >= PHYS_DT && steps < 12) {
      this.physAcc -= PHYS_DT;
      steps++;
      for (const r of this.racers) {
        const v = r.vehicle;
        const env = {
          ground: (x, z) => {
            const g = T.ground(x, z, r.hint, r._g || (r._g = {}));
            r.hint = g.i;
            return g;
          },
          auto: r.isPlayer ? auto : true,
          assists: r.isPlayer ? assists : 1,
          draft: r.draft || 0,
        };
        const ctl = r.ctl;
        if (frozen) {
          // engines rev on the line, cars held
          v.step(PHYS_DT, { ...ctl, handbrake: true, brake: 0, nitro: false }, env);
          if (v.gear < 1) v.gear = 1;
          v.vx = 0; v.vz = 0; v.yawRate = 0;
        } else {
          v.step(PHYS_DT, ctl, env);
        }
        ctl.shiftUp = false;
        ctl.shiftDown = false;
        this.collideWalls(r);
      }
      // car vs car
      const R = this.racers;
      for (let a = 0; a < R.length; a++) {
        for (let b = a + 1; b < R.length; b++) {
          const hit = collideCars(R[a].vehicle, R[b].vehicle, R[a].dims, R[b].dims);
          if (hit && hit.impact > 1.2) this.emit('carhit', { a: R[a].id, b: R[b].id, impact: hit.impact });
        }
      }
    }
  }

  collideWalls(r) {
    const T = this.track;
    const v = r.vehicle;
    const [fx, fz] = v.fwd;
    const [lx, lz] = v.left;
    const hl = r.dims.L / 2, hw = r.dims.W / 2;
    let worst = 0, wn = null, wc = null;
    for (const [a, b] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw]]) {
      const x = v.x + fx * a + lx * b, z = v.z + fz * a + lz * b;
      const p = T.project(x, z, r.hint, r._wp || (r._wp = {}));
      const i = p.i;
      const wl = T.WL[i], wr = T.WR[i];
      if (p.lat > wl && p.lat - wl > worst) { worst = p.lat - wl; wn = [-T.LX[i], -T.LZ[i]]; wc = [a, b]; }
      if (p.lat < -wr && -wr - p.lat > worst) { worst = -wr - p.lat; wn = [T.LX[i], T.LZ[i]]; wc = [a, b]; }
    }
    if (wn) {
      const impact = v.hitWall(wn[0], wn[1], worst, wc);
      r.scraping = true;
      if (impact > 2) this.emit('wallhit', { id: r.id, impact });
    } else {
      r.scraping = false;
    }
  }

  updateProgress() {
    const T = this.track;
    for (const r of this.racers) {
      const v = r.vehicle;
      const p = T.project(v.x, v.z, r.hint, r._pp || (r._pp = {}));
      const prevS = r.s;
      r.s = p.s;
      r.lat = p.lat;
      if (this.state !== 'racing') continue;
      if (T.closed) {
        const ds = T.deltaS(prevS, r.s);
        r.total += ds;
        if (r.total > T.length * 0.5 && !r.half) r.half = true;
      } else {
        r.total = r.s - T.startS;
      }
    }
  }

  syncModels(dt) {
    const T = this.track;
    for (const r of this.racers) {
      const v = r.vehicle;
      const m = r.model;
      const n = v.groundN || [0, 1, 0];
      const [fx, fz] = v.fwd;
      const [lx, lz] = v.left;
      const nf = n[0] * fx + n[2] * fz;
      const nl = n[0] * lx + n[2] * lz;
      _e.set(v.airborne ? clamp(-v.vy * 0.02, -0.25, 0.25) : nf / Math.max(0.3, n[1]), v.heading, v.airborne ? 0 : -nl / Math.max(0.3, n[1]));
      m.group.rotation.copy(_e);
      m.group.position.set(v.x, v.y, v.z);
      const vis = v.visual();
      m.animate(dt, vis.speed, vis.steer, vis.pitch, vis.roll, vis.heave, vis.wheel);
      const night = this.world.at.headlights;
      m.setLights(night ? 1 : 0, night ? 1 : 0.15, v.brakeLight);
      void T;
    }
  }

  updateCamera(dt) {
    const v = this.player.vehicle;
    const car = { x: v.x, y: v.y, z: v.z, heading: v.heading, vF: v.vF, nitroOn: v.nitroOn };
    const surfR = { curb: 0.6, grass: 0.4, dirt: 0.5, sand: 0.5, gravel: 0.9, sidewalk: 0.3 }[v.surface] || 0;
    this.camera.update(dt, car, { lookBack: this.lookBack, rumble: surfR * clamp(v.speed / 20, 0, 1) });
    if (this.world.sun) this.world.sunFollow = new THREE.Vector3(v.x, v.y, v.z);
  }

  view() { return { scene: this.scene, camera: this.camera.cam }; }

  dispose() {
    for (const r of this.racers) r.model.dispose();
    this.world?.dispose();
  }
}
