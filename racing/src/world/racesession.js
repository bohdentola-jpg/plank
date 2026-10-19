// A race on PORT HALCYON's own roads (Quick Race, the story's events): the
// track is the course's route through the world (world/course.js), the
// scene is the world itself streaming round the cars (the districts, the
// skyline, the far city), the side streets are closed off with barriers and
// the start has its gantry. Everything else is the race as it always was:
// the grid, the AI, the HUD, the replay.
import { RaceSession } from '../race/session.js';
import { Track } from '../track/track.js';
import { worldData } from './data.js';
import { WorldScene } from './scene.js';
import { WorldPhys } from './phys.js';
import { courseWalls, courseFor } from './course.js';
import { buildDressing } from './racedress.js';
import { rehearse } from './build/cell.js';
import { districtAt } from './ground.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export class WorldRaceSession extends RaceSession {
  async load(renderer, progress = () => {}) {
    progress(0.02, 'TUNING IN');
    await tick();
    const D = worldData();
    this.net = D.net;
    this.terrain = D.terrain;
    this.districts = D.districts;
    if (!this.districts.planned) {
      let t0 = performance.now();
      for (const _ of this.districts.planAll()) {
        if (performance.now() - t0 > 40) { progress(0.04, 'DRAWING UP THE CITY'); await tick(); t0 = performance.now(); }
      }
    }
    // the course through the world
    const def = this.def;
    progress(0.12, 'CLOSING THE STREETS');
    await tick();
    this.course = courseFor(def.id);
    this.track = new Track(def);
    courseWalls(this.track, this.course);
    this.track.computeRacingLine(1.12);
    // the world round it
    const wet = def.weather && def.weather !== 'dry';
    this.world = new WorldScene({ net: this.net, terrain: this.terrain, districts: this.districts, wet }, renderer, { time: def.time || 'night' });
    this.world.live = false;
    this.scene = this.world.scene;
    // (a fogbound track keeps its fog: the Summit at night)
    if (def.fogD > 0.003) this.scene.fog.density = Math.max(this.scene.fog.density, def.fogD * 0.75);
    await this.world.buildFar((f, l) => progress(0.14 + f * 0.3, l), 30);
    await this.world.warm(this.camera.cam, (f) => progress(0.44 + f * 0.1, 'MIXING THE PAINT'), 30);
    this.phys = new WorldPhys(this.net, this.terrain, this.districts);
    this.dress = buildDressing(this.course, this.track, { id: def.id });
    this.scene.add(this.dress);
    // the streets round the grid, before the lights go out
    const p = this.track.posAt(this.track.startS);
    await this.world.ensureAsync(p.x, p.z, 360, (f) => progress(0.55 + f * 0.26, 'PAVING THE STREETS'), 40);
    // the code of every district the course runs through (or near), run once before the lights go out
    {
      progress(0.82, 'WALKING THE COURSE');
      const only = new Set();
      const T = this.track;
      for (let s = 0; s < T.length; s += 60) {
        const q = T.posAt(s);
        for (const [dx, dz] of [[0, 0], [300, 0], [-300, 0], [0, 300], [0, -300]]) {
          const d = districtAt(q.x + dx, q.z + dz);
          if (d) only.add(d.id);
        }
      }
      let t0 = performance.now();
      for (const _ of rehearse(this.world.ctx, only)) {
        if (performance.now() - t0 > 40) { await tick(); t0 = performance.now(); }
      }
    }
    // the streamer follows whoever the camera follows
    const ws = this.world, base = ws.update.bind(ws);
    ws.update = (dt, cam, focus) => base(dt, cam, focus || this.focus());
    ws.live = true;
    await this.setupRace(progress, {
      ground: (x, z, r) => this.phys.ground(x, z, r.vehicle.y, r._wg || (r._wg = {})),
      collide: (r) => this.phys.collide(r),
    });
  }

  /** Where the world should be built round: your car (or the replay's). */
  focus() {
    const rp = this.replay;
    if (rp && rp.cars && rp.cars[rp.focus]) {
      const c = rp.cars[rp.focus];
      return [{ x: c.x, z: c.z, vx: Math.sin(c.heading) * (c.speed || 0), vz: Math.cos(c.heading) * (c.speed || 0) }];
    }
    const v = this.player?.vehicle;
    return v ? [{ x: v.x, z: v.z, vx: v.vx, vz: v.vz }] : [];
  }
}
