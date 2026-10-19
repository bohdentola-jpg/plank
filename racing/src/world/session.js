// PORT HALCYON — a free-roam session: the world scene streaming round your
// car, the world sim (your car on the world's ground), the race session's
// car model, camera, effects, engine and sound (WorldSession is a race
// session without the race), plus what's new: your garage (you start in it,
// pick and fit out a car with the door shut while the city gets built behind
// it, then the camera turns round behind the car, the door rolls up and you
// drive out: no loading screen), where you are (district names as you cross
// into them), and a splash when you find the water.
import * as THREE from 'three';
import { RaceSession, engineProfile } from '../race/session.js';
import { CAM_MODES } from '../race/camera.js';
import { buildCarModel } from '../car/model.js';
import { Vehicle } from '../car/physics.js';
import { Effects } from '../race/effects.js';
import { EngineSound } from '../audio/engine.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { settings } from '../core/settings.js';
import { input } from '../core/input.js';
import { TUNE } from '../core/tune.js';
import { getEnvMap } from '../core/envmap.js';
import { clamp, damp, easeInOutCubic } from '../core/util.js';
import { worldData } from './data.js';
import { WorldScene } from './scene.js';
import { WorldPhys } from './phys.js';
import { WorldSim } from './sim.js';
import { districtAt } from './ground.js';
import { Garage } from './garage.js';
import { Discoverer } from './discover.js';
import { WorldMap } from './map2d.js';
import { buildStarts, StartLights, startAt } from './starts.js';
import { rehearse } from './build/cell.js';
import { WorldTraffic } from './traffic.js';
import { TrafficRender } from '../race/trafficModels.js';
import { GARAGE } from './map/base.js';

export { worldData };

const AMBIENCE = {
  downtown: 'city', chinatown: 'city', works: 'city', oldtown: 'city', uptown: 'city', eastside: 'city',
  harbor: 'docks', shipyard: 'docks', pier9: 'docks', point: 'docks', bayshore: 'highway',
  desert: 'desert', redrock: 'desert', drylake: 'desert', ghosttown: 'desert',
  summit: 'mountain', ridgeline: 'mountain', kaido: 'mountain', wilds: 'mountain', crestwood: 'circuit', redwood: 'circuit',
  lake: 'mountain', ironworks: 'circuit', farmland: 'circuit',
};

const tick = () => new Promise((r) => setTimeout(r, 0));
const _v = new THREE.Vector3();

// the drive out: how long the camera takes to come round, when the door goes
const LEAVE = { spin: 2.4, door: 0.7, hand: 2.45 };

export class WorldSession extends RaceSession {
  /**
   * opts: { player: {spec, look, upgrades, name}, time: 'night'|…,
   *         garage: true to start in your garage, start: {x, z, heading} otherwise, budget }
   */
  constructor(opts) {
    const time = opts.time || 'night';
    super({ ...opts, type: 'roam', track: { id: 'world', name: 'PORT HALCYON', env: 'city', weather: 'dry', time, type: 'roam' } });
    this.state = 'loading';
    this.startIn = opts.garage ? 'garage' : 'road';
    this.districtNow = null;
    this.ready = false;          // the city beyond the garage door is built
    this.readyF = 0;             // how far along that is (0..1)
    this.readyLabel = '';
    this.gcam = { yaw: 0.7, yawT: 0.7, dist: 7.3, height: 1.5, offset: 1.15, idle: 0 };
    this.parkT = 0;
  }

  get inGarage() { return this.state === 'garage' || this.state === 'leaving'; }

  async load(renderer, progress = () => {}) {
    this.renderer = renderer;
    progress(0.02, 'TUNING IN');
    await tick();
    const D = worldData();
    this.net = D.net;
    this.terrain = D.terrain;
    this.districts = D.districts;
    this.phys = new WorldPhys(this.net, this.terrain, this.districts);
    this.world = new WorldScene({ net: this.net, terrain: this.terrain, districts: this.districts }, renderer, { time: this.def.time, budget: this.opts.budget });
    this.scene = this.world.scene;
    this.world.live = false;
    // your garage stands where it stands, wherever you start
    progress(0.2, 'OPENING UP');
    await tick();
    this.garage = new Garage({ net: this.net, terrain: this.terrain, districts: this.districts });
    this.scene.add(this.garage.build());
    this.phys.statics.push(...this.garage.colliders);
    this.phys.floors.push(this.garage);
    if (!this.districts.garageAdded) {
      this.districts.garageAdded = true;
      for (const L of this.garage.streetLamps()) this.districts.addLamp(L);
      const c = this.garage.w(0, -0.2);
      this.districts.addFar({ shape: 'box', x: c[0], z: c[1], y: this.garage.y - 1.5, w: 18.8, d: 24.8, h: 11, ry: GARAGE.heading, color: '#4a2a24', lit: 0.3 });
    }
    // a light over the bay for the car (always in the scene: a light coming
    // and going would make every material in the world recompile)
    const lamp = new THREE.SpotLight(0xfff2e2, 0, 15, 0.95, 0.55, 1.3);
    lamp.position.copy(this.garage.v(0.6, 1.6, 5.4));
    lamp.target.position.copy(this.garage.v(0, 0, 0.4));
    this.scene.add(lamp, lamp.target);
    this.bayLight = lamp;
    this.envGarage = getEnvMap(renderer, 'garage');
    // your car
    this.sim = new WorldSim(this.phys, {
      auto: settings.get('transmission') !== 'manual',
      assists: settings.get('assists') === 'on' ? 1 : 0.25,
    });
    const P = this.sim.add(WorldSim.makeRacer(this.opts.player, 0));
    this.player = P;
    const st = this.startIn === 'garage' ? GARAGE : (this.opts.start || GARAGE);
    this.start = st;
    this.sim.placeAt(P, st.x, st.z, st.heading ?? 0);
    this.buildModel();
    this.effects = new Effects(this.scene, { rain: false, night: !!this.world.at.lamps });
    this.setupAudio();
    if (this.startIn === 'garage') {
      this.enterGarageNow();
      this.state = 'garage';
      progress(1, 'READY');
      // the rest of the city goes up behind the door while you choose
      this.rest = this.loadRest(() => {}, this.opts.slice || 24).catch((e) => console.error('world: loading', e));
      return;
    }
    this.garage.setDoor(1);
    this.garage.doorTarget = 1;
    this.garage.blob.visible = false;
    await this.loadRest((f, l) => progress(0.25 + f * 0.75, l), 30);
    this.camera.first = true;
    this.syncModels(0);
    this.updateCamera(0);
    this.state = 'roam';
    progress(1, 'READY');
  }

  /** Everything beyond the garage: the plans, the far city, the materials, the streets round you. */
  async loadRest(progress = () => {}, sliceMs = 20) {
    const set = (f, l) => { this.readyF = f; this.readyLabel = l; progress(f, l); };
    set(0.02, 'DRAWING UP THE CITY');
    if (!this.districts.planned) {
      let t0 = performance.now();
      for (const _ of this.districts.planAll()) {
        if (performance.now() - t0 > sliceMs) { await tick(); t0 = performance.now(); }
        if (this.disposed) return;
      }
    }
    this.discoverer = new Discoverer(this.districts, this.net);
    set(0.25, 'SURVEYING');
    await this.world.buildFar((f, l) => set(0.25 + f * 0.3, l), sliceMs);
    if (this.disposed) return;
    await this.world.warm(this.camera.cam, (f) => set(0.55 + f * 0.15, 'MIXING THE PAINT'), sliceMs);
    if (this.disposed) return;
    const st = this.start;
    await this.world.ensureAsync(st.x, st.z, 300, (f) => set(0.7 + f * 0.22, 'PAVING THE STREETS'), sliceMs);
    if (this.disposed) return;
    // every district's code run once now (behind the door), not in the first of its cells met at speed
    {
      set(0.92, 'WARMING UP THE CITY');
      let t0 = performance.now();
      for (const _ of rehearse(this.world.ctx)) {
        if (performance.now() - t0 > sliceMs) { await tick(); t0 = performance.now(); if (this.disposed) return; }
      }
    }
    // the race tracks' start lines, each under its column of light
    {
      const gen = buildStarts();
      let r = gen.next(), t0 = performance.now();
      while (!r.done) {
        if (performance.now() - t0 > sliceMs) { await tick(); t0 = performance.now(); if (this.disposed) return; }
        r = gen.next();
      }
      this.starts = r.value;
      this.startLights = new StartLights(this.scene, this.starts);
    }
    // the town's traffic
    if (this.opts.traffic !== false) {
      this.sim.traffic = new WorldTraffic(this.net, this.phys, { count: 34 });
      this.trafficRender = new TrafficRender(this.scene, this.sim.traffic, { night: !!this.world.at.headlights, seed: 'world' });
    }
    this.world.live = true;
    this.ready = true;
    set(1, 'READY');
    // the map (M), drawn while you drive
    const SHARED = worldData();
    if (!SHARED.map) {
      const map = new WorldMap(this.net, this.districts);
      let t0 = performance.now();
      for (const _ of map.build()) {
        if (performance.now() - t0 > 6) { await tick(); t0 = performance.now(); }
        if (this.disposed) return;
      }
      SHARED.map = map;
    }
    this.map = SHARED.map;
  }

  /**
   * Fast travel (the one loading screen there is): to a place you've found
   * (on the road nearest it) or into your garage (no wait: it's always there).
   */
  async travelTo(target, progress = () => {}) {
    if (target.garage) { this.teleportToGarage(); return; }
    const a = target.arrival || this.discoverer.arrival(target);
    this.sim.frozen = true;
    this.state = 'travel';
    await this.world.ensureAsync(a.x, a.z, 300, (f) => progress(f), 60);
    const P = this.player;
    this.sim.placeAt(P, a.x, a.z, a.heading);
    this.sim.frozen = false;
    this.camera.first = true;
    this.state = 'roam';
    this.districtNow = null;
    this.leftGarage = true;
    this.syncModels(0);
    this.updateCamera(0);
  }

  buildModel() {
    const P = this.player;
    if (P.model) { this.scene.remove(P.model.group); P.model.dispose(); }
    this.headSpots = null;
    P.model = buildCarModel(P.spec, P.look || {}, { hiRes: true, interior: true });
    this.scene.add(P.model.group);
    P.prevThrottle = 0;
    // headlights always fitted (off by day): the light count never changes
    this.addHeadlights(P);
    this.syncModels(0);
  }

  /** A different car, or the same one fitted out differently (in the garage). */
  setCar(spec, look = {}, upgrades = {}) {
    const P = this.player;
    const v0 = P.vehicle;
    P.spec = spec;
    P.look = look;
    P.upgrades = upgrades;
    P.dims = { L: spec.body.L, W: spec.body.W };
    this.opts.player = { ...this.opts.player, spec, look, upgrades };
    P.vehicle = new Vehicle(spec, upgrades);
    P._env = null;
    this.sim.placeAt(P, v0.x, v0.z, v0.heading);
    this.buildModel();
    if (this.engineKey !== `${spec.id}:${JSON.stringify(upgrades)}`) {
      try { P.engine?.stop(); } catch { /* */ }
      this.setupAudio();
    }
  }

  /** Just the paint and parts you can see (no new engine). */
  setLook(look) {
    this.player.look = look;
    this.opts.player = { ...this.opts.player, look };
    this.buildModel();
  }

  setupAudio() {
    const P = this.player;
    this.engineKey = `${P.spec.id}:${JSON.stringify(P.upgrades || {})}`;
    try { EngineSound.prewarm?.(engineProfile(P.spec, P.upgrades || {}), { player: true }); } catch { /* */ }
    this.engines = [];
    try {
      P.engine = new EngineSound(engineProfile(P.spec, P.upgrades || {}), { player: true });
      this.engines.push(P.engine);
    } catch (e) { console.warn('engine audio', e); }
    this.raceTheme = this.raceTheme || null;
  }

  /** Night, dusk or day (from the garage). */
  setTime(time) {
    this.def.time = time;
    this.world.setTime(time);
    if (this.inGarage) this.scene.environment = this.envGarage;
    // the traffic's lights on or off
    if (this.trafficRender) {
      this.trafficRender.dispose();
      this.trafficRender = new TrafficRender(this.scene, this.sim.traffic, { night: !!this.world.at.headlights, seed: 'world' });
    }
  }

  dimHeadlights(dt) {
    super.dimHeadlights(dt);
    if (!this.world.at.headlights && this.headSpots) for (const sp of this.headSpots) sp.intensity = 0;
  }

  // ---------------------------------------------------------------- the garage

  /** Put the car in its bay facing the door, shut the door, light it like a showroom. */
  enterGarageNow() {
    const P = this.player;
    this.sim.placeAt(P, GARAGE.x, GARAGE.z, GARAGE.heading);
    const v = P.vehicle;
    v.vx = v.vz = 0;
    this.sim.frozen = true;
    this.garage.doorTarget = 0;
    this.garage.blob.visible = true;
    this.bayLight.intensity = 26;
    this.scene.environment = this.envGarage;
    this.gcam.yaw = this.gcam.yawT = 0.7;
    this.camera.first = true;
    this.districtNow = 'garage';
    this.syncModels(0);
    this.updateGarageCamera(0, true);
  }

  /** Drive back in and stop: the garage again (the door rolls down behind you). */
  enterGarage() {
    if (this.state !== 'roam') return;
    this.state = 'garage';
    this.fromCam = { pos: this.camera.cam.position.clone(), look: this.camera.look.clone(), t: 0 };
    this.enterGarageNow();
    this.message('YOUR GARAGE', 'FOUNDRY ST', { slot: 'top', dur: 2.2, color: '#46e8ff' });
    try { music.setIntensity?.(0.35); } catch { /* */ }
  }

  /** From anywhere (the pause menu): straight back into the bay, door shut. */
  teleportToGarage() {
    this.state = 'garage';
    this.fromCam = null;
    this.enterGarageNow();
    // the streets outside may have been let go while you were away: build
    // them again before the door opens
    if (!this.world.ready(GARAGE.x, GARAGE.z) || !this.world.ready(this.garage.w(0, 30)[0], this.garage.w(0, 30)[1])) {
      this.ready = false;
      this.readyF = 0;
      this.readyLabel = 'PAVING THE STREETS';
      this.world.ensureAsync(GARAGE.x, GARAGE.z, 300, (f) => { this.readyF = f; }, this.opts.slice || 24).then(() => { this.ready = true; this.readyF = 1; });
    }
  }

  /** Off you go: the camera comes round behind the car and the door goes up. */
  leave() {
    if (this.state !== 'garage') return false;
    if (!this.ready) { this.wantLeave = true; return false; }
    this.wantLeave = false;
    this.state = 'leaving';
    const cam = this.camera.cam;
    this.leaveFrom = { pos: cam.position.clone(), look: this.gcam.look ? this.gcam.look.clone() : this.garage.v(0, 0.2, 0.62) };
    this.leaveT = 0;
    return true;
  }

  /** Where the chase camera would be with the car where it is (what the spin ends on). */
  chasePose(out = {}) {
    const v = this.player.vehicle;
    const M = CAM_MODES[this.camera.mode].mounted ? CAM_MODES[1] : CAM_MODES[this.camera.mode];
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const dist = M.dist * TUNE.camDist, hgt = M.height * TUNE.camHeight, ahead = TUNE.camLookAhead;
    out.pos = (out.pos || new THREE.Vector3()).set(v.x - fx * dist, v.y + hgt, v.z - fz * dist);
    out.look = (out.look || new THREE.Vector3()).set(v.x + fx * ahead, v.y + M.look, v.z + fz * ahead);
    return out;
  }

  updateGarageCamera(dt, snap = false) {
    const g = this.gcam;
    // turn toward where the player wants it; drift slowly round when left alone
    g.idle += dt;
    if (g.idle > 5) g.yawT += dt * 0.08;
    g.yaw = snap ? g.yawT : damp(g.yaw, g.yawT, 4, dt);
    const pose = this.garage.showroomPose(g.yaw, { dist: g.dist, height: g.height, pos: g.pos, look: g.look });
    // aim a little to the car's left so it sits right of the menus
    const dx = pose.look.x - pose.pos.x, dz = pose.look.z - pose.pos.z, dl = Math.hypot(dx, dz) || 1;
    pose.look.x += (dz / dl) * g.offset;
    pose.look.z -= (dx / dl) * g.offset;
    g.pos = pose.pos; g.look = pose.look;
    const cam = this.camera.cam;
    if (this.fromCam && !snap) {
      // coming back in: from wherever the chase camera was
      const f = this.fromCam;
      f.t += dt;
      const k = easeInOutCubic(clamp(f.t / 1.3, 0, 1));
      cam.position.lerpVectors(f.pos, pose.pos, k);
      _v.lerpVectors(f.look, pose.look, k);
      cam.lookAt(_v);
      if (k >= 1) this.fromCam = null;
    } else {
      cam.position.copy(pose.pos);
      cam.lookAt(pose.look);
    }
    cam.fov = snap ? 46 : damp(cam.fov, 46, 5, dt);
    cam.updateProjectionMatrix();
    this.fx = { radialBlur: 0, blurCenter: [0.5, 0.5] };
  }

  updateLeaving(dt) {
    this.leaveT += dt;
    const t = this.leaveT;
    const cam = this.camera.cam;
    const v = this.player.vehicle;
    const end = this.chasePose(this._chase || (this._chase = {}));
    // round the car on an arc (not through it): angle, radius and height eased from start to end
    const c = _v.set(v.x, v.y, v.z);
    const s0 = this.leaveFrom.pos, s1 = end.pos;
    const a0 = Math.atan2(s0.x - c.x, s0.z - c.z), a1 = Math.atan2(s1.x - c.x, s1.z - c.z);
    let da = a1 - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const r0 = Math.hypot(s0.x - c.x, s0.z - c.z), r1 = Math.hypot(s1.x - c.x, s1.z - c.z);
    const k = easeInOutCubic(clamp(t / LEAVE.spin, 0, 1));
    const a = a0 + da * k, r = r0 + (r1 - r0) * k;
    // a little lift through the middle of the move
    const y = s0.y + (s1.y - s0.y) * k + Math.sin(k * Math.PI) * 0.45;
    cam.position.set(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r);
    const look = this._look || (this._look = new THREE.Vector3());
    look.lerpVectors(this.leaveFrom.look, end.look, k);
    cam.lookAt(look);
    cam.fov = 46 + (CAM_MODES[1].fov + TUNE.camFov - 46) * k;
    cam.updateProjectionMatrix();
    // the door goes up, the world comes in
    if (t >= LEAVE.door && this.garage.doorTarget !== 1) {
      this.garage.doorTarget = 1;
      try { sfx.ui?.('select'); } catch { /* */ }
    }
    if (t > LEAVE.hand) {
      this.state = 'roam';
      this.sim.frozen = false;
      this.camera.first = true;
      this.garage.blob.visible = false;
      this.leftGarage = false;
      this.districtNow = districtAt(v.x, v.z)?.id || null;
      this.message('PORT HALCYON', 'THE WHOLE CITY  ·  NO CLOCK  ·  M FOR THE MAP', { slot: 'top', dur: 3.2, color: '#46e8ff' });
      try { music.setIntensity?.(0.5); } catch { /* */ }
    }
  }

  /** In the garage (the car can't move): the throttle still revs the engine. */
  revEngine(dt) {
    const P = this.player, v = P.vehicle;
    const thr = this.state === 'garage' ? clamp(P.ctl.throttle, 0, 1) : this.leaveT > 0.3 && this.leaveT < 0.95 ? 0.55 : 0;
    const idle = v.P.idle || 900, red = v.P.redline || 7000;
    v.rpm = damp(v.rpm, idle + thr * (red * 0.92 - idle), thr > v.throttle ? 7 : 3.5, dt);
    v.throttle = thr;
  }

  // ---------------------------------------------------------------- per frame

  update(dt) {
    if (this.state === 'loading' || this.state === 'travel') return;
    this.time += dt;
    const sim = this.sim;
    sim.events.length = 0;
    this.garage.update(dt);
    const P = this.player, pv = P.vehicle;
    if (this.inGarage) {
      if (this.wantLeave && this.ready) this.leave();
      // (no driving in here: the trigger just revs it)
      P.ctl.throttle = input.device === 'pad' ? input.throttle : 0;
      P.ctl.steer = 0;
      P.ctl.nitro = false;
      this.revEngine(dt);
      this.syncModels(dt);
      if (this.state === 'leaving') this.updateLeaving(dt);
      else this.updateGarageCamera(dt);
      this.updateAudio(dt);
      this.bayLight.intensity = damp(this.bayLight.intensity, this.state === 'garage' ? 26 : 10, 2, dt);
    } else {
      this.readPlayer();
      sim.step(dt);
      this.handleEvents();
      this.syncModels(dt);
      this.dimHeadlights(dt);
      this.updateEffects(dt);
      this.updateCamera(dt);
      this.updateAudio(dt);
      this.whereAmI();
      this.watchGarage(dt);
      // pulled up on a race's start line? (the screen offers the race)
      this.atStart = this.opts.noRaces || pv.speed > 8 ? null : startAt(this.starts, pv.x, pv.z);
      const found = this.discoverer?.tick(pv.x, pv.z, dt);
      if (found) {
        this.message(found.name, found.hidden ? 'SECRET SPOT FOUND' : 'DISCOVERED', { slot: 'center', dur: 3, color: found.hidden ? '#ff5ac8' : '#46e8ff' });
        try { sfx.ui?.('buy'); } catch { /* */ }
      }
    }
    // the garage's light and reflections while the car is in there, the city's out here
    const inside = this.garage.inside(pv.x, pv.z, -1.5);
    const env = inside ? this.envGarage : this.world.envMap;
    if (this.scene.environment !== env) this.scene.environment = env;
    if (!this.inGarage) this.bayLight.intensity = damp(this.bayLight.intensity, inside ? 14 : 0, 2, dt);
    if (this.inGarage) this.sim.physics(dt);      // (the traffic outside)
    this.trafficRender?.update(this.camera.cam);
    this.startLights?.update(this.camera.cam, this.inGarage ? null : this.atStart);
    this.world.update(dt, this.camera.cam, [{ x: pv.x, z: pv.z, vx: pv.vx, vz: pv.vz }]);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.dur);
  }

  /** Parked inside your garage? Offer it (the screen asks; ✕ goes in). */
  watchGarage(dt) {
    // (a story cruise has its own garage: this one isn't yours)
    if (this.opts.noGarage) { this.canGarage = false; return; }
    const v = this.player.vehicle;
    // (only once you've been out: not the moment you're handed the wheel)
    if (!this.garage.inside(v.x, v.z, -2)) this.leftGarage = true;
    const inside = this.leftGarage && this.garage.inside(v.x, v.z, 1.2) && v.speed < 1.2;
    this.parkT = inside ? this.parkT + dt : 0;
    this.canGarage = this.parkT > 0.6;
  }

  /** Crossing into a district: its name, its sound, its music. */
  whereAmI() {
    const pv = this.player.vehicle;
    const d = districtAt(pv.x, pv.z);
    const id = d?.id || null;
    if (id === this.districtNow) { this.districtHold = 0; return; }
    // (only once it has stuck for a moment: no flicker along a border)
    this.districtHold = (this.districtHold || 0) + 1;
    if (this.districtHold < 20 && this.districtNow !== null) return;
    this.districtNow = id;
    this.districtHold = 0;
    if (!d) return;
    this.districtT = this.time;
    this.message(d.name, 'NOW ENTERING', { slot: 'top', dur: 2.6, color: '#46e8ff' });
    const amb = AMBIENCE[d.style] || 'city';
    try { sfx.ambience(amb); } catch { /* */ }
    const theme = `race_${amb === 'docks' ? 'docks' : amb}`;
    if (theme !== this.raceTheme) {
      this.raceTheme = theme;
      try { music.play(theme, { seed: 'world' + d.id, fade: 2.5, intensity: 0.45 }); music.setRaceState({ countdown: false }); } catch { /* */ }
    }
  }

  handleEvents() {
    super.handleEvents();
    for (const e of this.sim.events) {
      if (e.type === 'splash' && e.id === this.player.id) {
        this.effects.tireSmoke?.(e.x, e.y, e.z, 0, 0, 1, 'sand');
        if (!this._splashT || this.time - this._splashT > 0.8) { this._splashT = this.time; try { sfx.landing(0.4); } catch { /* */ } }
      }
      if (e.type === 'reset' && e.why === 'water' && e.player) this.message('WASHED OUT', 'BACK ON THE ROAD', { slot: 'top', dur: 1.6, color: '#46e8ff' });
    }
  }

  view() {
    if (this.state === 'loading' || !this.scene) return null;
    return { scene: this.scene, camera: this.camera.cam };
  }

  dispose() {
    this.disposed = true;
    this.startLights?.dispose();
    super.dispose();
  }
}
