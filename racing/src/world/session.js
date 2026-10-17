// PORT HALCYON — a free-roam session: the world scene streaming round your
// car, the world sim (your car on the world's ground), the race session's
// car model, camera, effects, engine and sound (WorldSession is a race
// session without the race), plus what's new: where you are (the district
// names as you cross into them), and a splash when you find the water.
import * as THREE from 'three';
import { RaceSession, engineProfile } from '../race/session.js';
import { buildCarModel } from '../car/model.js';
import { Effects } from '../race/effects.js';
import { EngineSound } from '../audio/engine.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { settings } from '../core/settings.js';
import { buildNet } from './net.js';
import { Terrain } from './terrain.js';
import { WorldScene } from './scene.js';
import { WorldPhys } from './phys.js';
import { WorldSim } from './sim.js';
import { districtAt } from './ground.js';
import { GARAGE } from './map/base.js';

// the road network and the land are the same every time: built once a page
let SHARED = null;
export function worldData() {
  if (!SHARED) {
    const net = buildNet();
    SHARED = { net, terrain: new Terrain(net) };
  }
  return SHARED;
}

const AMBIENCE = {
  downtown: 'city', chinatown: 'city', works: 'city', oldtown: 'city', uptown: 'city', eastside: 'city',
  harbor: 'docks', shipyard: 'docks', pier9: 'docks', point: 'docks', bayshore: 'highway',
  desert: 'desert', redrock: 'desert', drylake: 'desert', ghosttown: 'desert',
  summit: 'mountain', ridgeline: 'mountain', kaido: 'mountain', wilds: 'mountain', crestwood: 'circuit', redwood: 'circuit',
  lake: 'mountain', ironworks: 'circuit', farmland: 'circuit',
};

export class WorldSession extends RaceSession {
  /**
   * opts: { player: {spec, look, upgrades, name}, time: 'night'|…, start: {x, z, heading} }
   */
  constructor(opts) {
    const time = opts.time || 'night';
    super({ ...opts, type: 'roam', track: { id: 'world', name: 'PORT HALCYON', env: 'city', weather: 'dry', time, type: 'roam' } });
    this.state = 'loading';
    this.districtNow = null;
  }

  async load(renderer, progress = () => {}) {
    progress(0.02, 'TUNING IN');
    await new Promise((r) => setTimeout(r, 0));
    const D = worldData();
    this.net = D.net;
    this.terrain = D.terrain;
    this.phys = new WorldPhys(this.net, this.terrain, null);
    this.world = new WorldScene({ net: this.net, terrain: this.terrain }, renderer, { time: this.def.time, budget: this.opts.budget });
    this.scene = this.world.scene;
    await this.world.buildFar((f, l) => progress(0.05 + f * 0.4, l));
    // your car
    this.sim = new WorldSim(this.phys, {
      auto: settings.get('transmission') !== 'manual',
      assists: settings.get('assists') === 'on' ? 1 : 0.25,
    });
    const P = this.sim.add(WorldSim.makeRacer(this.opts.player, 0));
    this.player = P;
    const st = this.opts.start || GARAGE;
    this.sim.placeAt(P, st.x, st.z, st.heading ?? 0);
    // the ground round it, before anything is shown
    progress(0.5, 'PAVING THE STREETS');
    await new Promise((r) => setTimeout(r, 0));
    this.world.ensure(st.x, st.z, 260, (f) => progress(0.5 + f * 0.4, 'PAVING THE STREETS'));
    // ground under the car now that it exists
    this.sim.placeAt(P, st.x, st.z, st.heading ?? 0);
    P.model = buildCarModel(P.spec, P.look || {}, { hiRes: true, interior: true });
    this.scene.add(P.model.group);
    P.prevThrottle = 0;
    if (this.world.at.headlights) this.addHeadlights(P);
    this.effects = new Effects(this.scene, { rain: false, night: !!this.world.at.lamps });
    this.setupAudio();
    this.camera.first = true;
    this.syncModels(0);
    this.updateCamera(0);
    this.state = 'roam';
    progress(1, 'READY');
  }

  setupAudio() {
    const P = this.player;
    try { EngineSound.prewarm?.(engineProfile(P.spec, P.upgrades || {}), { player: true }); } catch { /* */ }
    this.engines = [];
    try {
      P.engine = new EngineSound(engineProfile(P.spec, P.upgrades || {}), { player: true });
      this.engines.push(P.engine);
    } catch (e) { console.warn('engine audio', e); }
    this.raceTheme = null;
  }

  update(dt) {
    if (this.state === 'loading') return;
    this.time += dt;
    const sim = this.sim;
    sim.events.length = 0;
    this.readPlayer();
    sim.step(dt);
    this.handleEvents();
    this.syncModels(dt);
    this.dimHeadlights(dt);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateAudio(dt);
    const pv = this.player.vehicle;
    this.world.update(dt, this.camera.cam, [{ x: pv.x, z: pv.z, vx: pv.vx, vz: pv.vz }]);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.dur);
    this.whereAmI();
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
}

void THREE;
