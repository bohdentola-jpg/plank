// FREE ROAM session: one region of the map at a time — its world, your car,
// traffic, effects, sound — and the tunnel hand-over: drive deep enough into
// a bore and the picture fades out, the region on the other side is built,
// and you come out of its tunnel at the speed you went in. Rendering, the
// camera, effects and audio are the race session's (this extends it).
import { RaceSession, engineProfile } from '../race/session.js';
import { buildWorld } from '../track/build.js';
import { buildCarModel } from '../car/model.js';
import { TrafficRender } from '../race/trafficModels.js';
import { Effects } from '../race/effects.js';
import { EngineSound } from '../audio/engine.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { settings } from '../core/settings.js';
import { TRACK_BY_ID } from '../track/tracks.js';
import { RoamSim } from './sim.js';
import { planRegion } from './plan.js';
import { decorateRegion } from './scenery.js';
import { arrival } from './network.js';

const FADE_OUT = 0.45, FADE_IN = 0.7;

/** buildWorld hooks for a free-roam region (opts.noRaces: no race-start light). */
export const roamHooks = (opts = {}) => ({
  plan: (T) => planRegion(T),
  decorate: (w, T, plan) => decorateRegion(w, T, plan, opts),
});

export class RoamSession extends RaceSession {
  /**
   * opts: { track (def), player: {spec, look, upgrades, name}, traffic (bool),
   *         start: { exit } | { s, backwards } }
   */
  constructor(opts) {
    super({ ...opts, type: 'roam' });
    this.type = 'roam';
    this.fade = 1;
    this.phase = 'loading';
    this.loading = { f: 0, label: 'PLEASE STAND BY', def: opts.track };
    this.visits = 0;
    this.noRaces = !!opts.noRaces;
  }

  get trafficOn() { return this.opts.traffic !== false; }

  async load(renderer, progress = () => {}) {
    this.renderer = renderer;
    const p = this.opts.player;
    const P = RoamSim.makePlayer(p);
    P.model = buildCarModel(p.spec, p.look || {}, { hiRes: true, interior: true });
    P.prevThrottle = 0;
    this.playerR = P;
    await this.enterRegion(this.def, this.opts.start || null, progress);
    try {
      EngineSound.prewarm?.(engineProfile(p.spec, p.upgrades || {}), { player: true });
      P.engine = new EngineSound(engineProfile(p.spec, p.upgrades || {}), { player: true });
      this.engines = [P.engine];
    } catch (e) { console.warn('engine audio', e); this.engines = []; }
    this.state = 'roam';
    this.phase = 'in';
    this.fade = 1;
    progress(1, 'READY');
  }

  /** Build a region and move into it (the old one is gone by now). */
  async enterRegion(def, start, progress = () => {}) {
    this.loading = { f: 0, label: 'PLEASE STAND BY', def };
    const world = await buildWorld(def, this.renderer, (f, l) => { this.loading = { f, label: l, def }; progress(f * 0.95, l); }, roamHooks({ noRaces: this.noRaces }));
    this.def = def;
    this.world = world;
    this.track = world.track;
    this.scene = world.scene;
    const P = this.playerR;
    const traffic = this.trafficOn && (!!def.traffic || def.env === 'city' || def.env === 'docks');
    this.sim = new RoamSim({ track: this.track, plan: world.roam }, {
      player: P, traffic, seed: def.id,
      auto: settings.get('transmission') !== 'manual',
      assists: settings.get('assists') === 'on' ? 1 : 0.25,
    });
    this.player = this.sim.player;
    if (start?.exit) this.sim.arrive(start.exit, start.speed || 0);
    else if (start?.s !== undefined) this.sim.placeOnRoad(start.s, start.lat || 0, !!start.backwards);
    else this.sim.placeOnRoad(this.track.closed ? this.track.startS + 25 : this.track.startS + 10);
    this.scene.add(P.model.group);
    const night = !!world.at.headlights;
    if (!this.headSpots) this.addHeadlights(P);
    for (const sp of this.headSpots) sp.visible = night;
    this.trafficRender = this.sim.traffic ? new TrafficRender(this.scene, this.sim.traffic, { night, seed: def.id }) : null;
    this.effects = new Effects(this.scene, { rain: def.weather === 'rain', night: !!world.at.lamps });
    this.camera.orbit = null;
    this.camera.first = true;
    this.syncModels(0);
    this.updateCamera(0);
    try {
      sfx.ambience(def.env === 'circuit' ? 'circuit' : def.env);
      sfx.rain(def.weather === 'rain' ? 0.8 : 0);
    } catch { /* */ }
    const theme = `race_${def.env}`;
    if (theme !== this.raceTheme) {
      this.raceTheme = theme;
      try { music.play(theme, { seed: def.id + 'roam', fade: 2.5, intensity: 0.45 }); } catch { /* */ }
    }
    try { music.setRaceState({ countdown: false }); } catch { /* */ }
    this.visits++;
    this.arrivedT = 0;
    this.region = def;
  }

  leaveRegion() {
    if (!this.world) return;
    const P = this.playerR;
    this.scene.remove(P.model.group);
    this.trafficRender?.dispose();
    this.trafficRender = null;
    this.world.dispose();
    this.world = null;
    this.scene = null;
    this.sim = null;
  }

  /** Off to another region: through a portal (exit) or by fast travel (start). */
  async travel(def, start) {
    this.phase = 'loading';
    const P = this.playerR;
    try { sfx.skid(0); sfx.scrape(0); sfx.nitro(false); sfx.wind(0); sfx.roll(0, 'asphalt'); sfx.crowd(0); } catch { /* */ }
    this.leaveRegion();
    try {
      await this.enterRegion(def, start);
    } catch (e) {
      console.error('roam: region failed to build', e);
      await this.enterRegion(TRACK_BY_ID.downtown, null);
    }
    void P;
    this.phase = 'in';
  }

  update(dt) {
    if (this.state === 'loading') return;
    this.time += dt;
    if (this.phase === 'loading') return;
    const sim = this.sim;
    sim.events.length = 0;
    this.readPlayer();
    sim.step(dt);
    for (const e of sim.events) if (e.type === 'portal' && this.phase === 'drive') this.onPortal(e);
    this.handleEvents();
    this.syncModels(dt);
    this.dimHeadlights(dt);
    this.trafficRender?.update(this.camera.cam);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateAudio(dt);
    this.world.update(dt, this.camera.cam);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.dur);
    this.arrivedT += dt;
    // pulled up in the race start's light
    const mk = this.world?.roam?.marker;
    const pv = this.player.vehicle;
    this.atMarker = !!(mk && this.phase === 'drive' && pv.speed < 9 && Math.hypot(pv.x - mk.x, pv.z - mk.z) < mk.r + 1.5);
    if (this.phase === 'out') {
      this.fade = Math.min(1, this.fade + dt / FADE_OUT);
      if (this.fade >= 1) this.travel(this.pending.def, this.pending.start);
    } else if (this.phase === 'in') {
      this.fade = Math.max(0, this.fade - dt / FADE_IN);
      if (this.fade <= 0) this.phase = 'drive';
    }
  }

  onPortal(e) {
    const a = arrival(this.def.id, e.exit);
    const def = TRACK_BY_ID[a.track];
    if (!def) return;
    const v = this.player.vehicle;
    this.pending = { def, start: { exit: a.exit, speed: Math.max(0, Math.hypot(v.vx, v.vz)) } };
    this.phase = 'out';
  }

  /** Fast travel (the map): straight to a region's start line. */
  fastTravel(id) {
    const def = TRACK_BY_ID[id];
    if (!def || this.phase !== 'drive') return false;
    this.pending = { def, start: null };
    this.phase = 'out';
    return true;
  }

  readPlayer() {
    // the race session's controls, minus the race (no autopilot, no finish)
    const r = this.player;
    const c = r.ctl;
    if (r.ai) return;
    if (this.hold) {
      // (a menu is up over the road: the car waits on the handbrake)
      Object.assign(c, { throttle: 0, brake: 0, steer: 0, steerDigital: 0, handbrake: true, nitro: false });
      return;
    }
    super.readPlayer();
  }

  view() {
    if (this.phase === 'loading' || !this.scene) return null;
    return { scene: this.scene, camera: this.camera.cam };
  }

  dispose() {
    try { this.playerR?.engine?.stop(); } catch { /* */ }
    this.leaveRegion();
    this.playerR?.model?.dispose();
    try { sfx.stopAll(); sfx.ambience(null); } catch { /* */ }
  }
}
