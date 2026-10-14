// Instant replay. The race is taped at 30 Hz: every racer's pose, wheels,
// lights and engine note, and every civilian car. It plays back like a late
// night TV broadcast, with trackside cameras that pan and zoom as the pack goes
// by, a helicopter, a camera car out front, a wheel-arch cam and the regular
// chase view, cut together by a small director. A VCR transport (play, pause,
// rewind, fast-forward) and a timecode sit on top.
import * as THREE from 'three';
import { ChaseCamera } from './camera.js';
import { clamp, damp, makeRng } from '../core/util.js';

export const REPLAY_HZ = 30;
// per racer per frame: pos xyz, rot xyz, speed, steer, pitch, roll, heave,
// wheel spin speed (NaN = from speed), brake light, nitro, rpm, throttle,
// visible, gear
const RS = 18;
const TS = 4; // per civilian per frame: x, y, z, heading
const MAX_FRAMES = REPLAY_HZ * 60 * 20; // 20 minutes of tape

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class ReplayRecorder {
  constructor(nRacers, nTraffic) {
    this.n = nRacers;
    this.nt = nTraffic;
    this.count = 0;
    this.cap = REPLAY_HZ * 120;
    this.R = new Float32Array(this.cap * this.n * RS);
    this.T = new Float32Array(this.cap * Math.max(1, this.nt) * TS);
    this.times = new Float64Array(this.cap); // tape time of each frame
    this.clock = 0;
  }

  get duration() { return this.count ? this.times[this.count - 1] : 0; }

  /** Frame index and blend for tape time t (frames are timestamped, so a
   *  slow machine that taped fewer frames still plays back in real time). */
  locate(t) {
    const n = this.count, tm = this.times;
    if (n < 2 || t <= 0) return [0, Math.min(1, n - 1), 0];
    if (t >= tm[n - 1]) return [n - 1, n - 1, 0];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tm[mid] <= t) lo = mid; else hi = mid; }
    return [lo, hi, (t - tm[lo]) / Math.max(1e-6, tm[hi] - tm[lo])];
  }

  _grow() {
    const cap = this.cap * 2;
    const R = new Float32Array(cap * this.n * RS); R.set(this.R); this.R = R;
    const T = new Float32Array(cap * Math.max(1, this.nt) * TS); T.set(this.T); this.T = T;
    const tm = new Float64Array(cap); tm.set(this.times); this.times = tm;
    this.cap = cap;
  }

  /** Once per rendered frame while the race runs (after the models are posed). */
  update(dt, racers, traffic) {
    this.clock += dt;
    if (this.count > 0 && this.clock - this.times[this.count - 1] < 1 / REPLAY_HZ - 1e-4) return;
    if (this.count >= MAX_FRAMES) return;
    if (this.count >= this.cap) this._grow();
    const f = this.count++;
    this.times[f] = this.clock;
    const R = this.R;
    let o = f * this.n * RS;
    for (const r of racers) {
      const g = r.model.group, v = r.vehicle, vis = r._vis || {};
      R[o] = g.position.x; R[o + 1] = g.position.y; R[o + 2] = g.position.z;
      R[o + 3] = g.rotation.x; R[o + 4] = g.rotation.y; R[o + 5] = g.rotation.z;
      R[o + 6] = vis.speed ?? v.speed; R[o + 7] = vis.steer ?? 0; R[o + 8] = vis.pitch ?? 0;
      R[o + 9] = vis.roll ?? 0; R[o + 10] = vis.heave ?? 0; R[o + 11] = vis.wheel ?? NaN;
      R[o + 12] = v.brakeLight || 0; R[o + 13] = v.nitroOn ? 1 : 0; R[o + 14] = v.rpm || 0;
      R[o + 15] = v.throttle || 0; R[o + 16] = g.visible ? 1 : 0; R[o + 17] = v.gear || 0;
      o += RS;
    }
    if (traffic && this.nt) {
      let q = f * this.nt * TS;
      const T = this.T;
      for (const c of traffic.cars) { T[q] = c.x; T[q + 1] = c.y; T[q + 2] = c.z; T[q + 3] = c.heading; q += TS; }
    }
  }
}

const SHOT_NAMES = { chase: 'CHASE', trackside: 'TV CAM', heli: 'AIR 1', front: 'CAMERA CAR', wheel: 'WHEEL CAM' };
const MODES = ['auto', 'chase', 'heli', 'trackside'];
const MODE_NAMES = { auto: 'DIRECTOR', chase: 'CHASE', heli: 'AIR 1', trackside: 'TV CAMS' };

/** Plays a recording back through a race session's own scene and models. */
export class ReplayPlayer {
  constructor(session, rec) {
    this.s = session;
    this.rec = rec;
    this.t = 0;
    this.rate = 1;
    this.paused = false;
    this.ended = false;
    this.cam = new THREE.PerspectiveCamera(50, 4 / 3, 0.3, 3200);
    this.chase = new ChaseCamera(4 / 3);
    this.chase.setMode(1);
    this.rng = makeRng('replay' + (session.def.id || ''));
    this.modeIdx = 0;
    this.shot = null;
    this.cutT = 1;
    this.glitch = 0;
    const racers = session.sim.racers;
    this.focus = Math.max(0, racers.indexOf(session.player));
    this.hint = racers.map(() => -1);
    this._pp = {};
    this._v = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this.cars = racers.map(() => ({ x: 0, y: 0, z: 0, heading: 0, speed: 0, visible: true, s: 0, i: 0, nitro: 0 }));
    this.night = !!session.world.at.headlights;
    // all engines go spatial for the broadcast: we hear what the camera hears
    this.enter();
  }

  get mode() { return MODES[this.modeIdx]; }
  get modeName() { return MODE_NAMES[this.mode]; }
  get shotName() { return this.shot ? SHOT_NAMES[this.shot.type] + (this.shot.type === 'trackside' ? ` ${this.shot.n}` : '') : ''; }
  get focusRacer() { return this.s.sim.racers[this.focus]; }
  get duration() { return this.rec.duration; }

  enter() {
    // roll from just before the lights go green, on a wide establishing shot
    this.start = Math.max(0, (this.rec.goT ?? 0) - 1.5);
    this.t = this.start;
    this.apply(0, true);
    this.newShot(false, this.rng() < 0.6 ? 'trackside' : 'heli');
  }

  exit() {
    // put the player's engine back up front and quiet the field
    for (const r of this.s.sim.racers) {
      try { r.engine?.setSpatial(r.isPlayer ? { gain: 1, pan: 0, doppler: 1 } : { gain: 0 }); } catch { /* */ }
    }
  }

  // ------------------------------------------------------------- transport

  playPause() {
    if (this.paused || this.rate !== 1) { this.paused = false; this.rate = 1; } else this.paused = true;
  }

  fast(dir) {
    // each press steps up the speed in that direction: ×2, ×4, ×8
    if (this.paused) this.paused = false;
    if (Math.sign(this.rate) === dir && Math.abs(this.rate) >= 2) this.rate = dir * Math.min(8, Math.abs(this.rate) * 2);
    else this.rate = dir * 2;
  }

  cycleFocus(dir) {
    const racers = this.s.sim.racers;
    for (let k = 1; k <= racers.length; k++) {
      const i = (this.focus + dir * k + racers.length * 4) % racers.length;
      if (this.cars[i].visible) { this.focus = i; break; }
    }
    this.newShot(true);
  }

  cycleMode() {
    this.modeIdx = (this.modeIdx + 1) % MODES.length;
    this.newShot(true);
  }

  /** Transport status for the OSD. */
  status() {
    if (this.paused) return { icon: 'pause', label: 'PAUSE' };
    if (this.rate > 1) return { icon: 'ff', label: `FF x${this.rate}` };
    if (this.rate < 0) return { icon: 'rew', label: `REW x${-this.rate}` };
    return { icon: 'play', label: 'PLAY' };
  }

  // ------------------------------------------------------------- playback

  update(dt) {
    const dur = this.duration;
    if (!this.paused) this.t += dt * this.rate;
    if (this.t >= dur) {
      // end of tape: rewind to the start and keep rolling
      this.t = this.start; this.rate = 1; this.glitch = 0.5;
      this.newShot(true, 'trackside');
    }
    if (this.t < 0) { this.t = 0; this.rate = 1; }
    this.apply(this.paused ? 0 : dt * this.rate);
    this.updateCamera(dt);
    this.updateAudio(dt);
    this.glitch = Math.max(0, this.glitch - dt * 3);
  }

  /** Pose every car (and civilian) at the current tape time. */
  apply(dtv, first = false) {
    const rec = this.rec, s = this.s, T = s.track;
    const [i0, i1, a] = rec.locate(this.t);
    const R = rec.R, n = rec.n;
    s.sim.racers.forEach((r, k) => {
      const o0 = (i0 * n + k) * RS, o1 = (i1 * n + k) * RS;
      const m = r.model, g = m.group;
      const x = lerp(R[o0], R[o1], a), y = lerp(R[o0 + 1], R[o1 + 1], a), z = lerp(R[o0 + 2], R[o1 + 2], a);
      g.position.set(x, y, z);
      g.rotation.set(lerp(R[o0 + 3], R[o1 + 3], a), lerpAngle(R[o0 + 4], R[o1 + 4], a), lerp(R[o0 + 5], R[o1 + 5], a));
      const speed = lerp(R[o0 + 6], R[o1 + 6], a);
      const wheel = Number.isNaN(R[o0 + 11]) ? null : lerp(R[o0 + 11], R[o1 + 11], a);
      // wheels turn the way the tape runs
      const dir = Math.sign(dtv) || 0;
      m.animate(Math.abs(dtv), speed * dir, lerp(R[o0 + 7], R[o1 + 7], a), lerp(R[o0 + 8], R[o1 + 8], a),
        lerp(R[o0 + 9], R[o1 + 9], a), lerp(R[o0 + 10], R[o1 + 10], a), wheel === null ? null : wheel * dir);
      m.setLights(this.night ? 1 : 0, this.night ? 1 : 0.18, R[o0 + 12]);
      const visible = R[o0 + 16] > 0.5;
      g.visible = visible;
      const c = this.cars[k];
      c.x = x; c.y = y; c.z = z; c.heading = g.rotation.y; c.speed = speed; c.visible = visible;
      c.nitro = R[o0 + 13]; c.rpm = lerp(R[o0 + 14], R[o1 + 14], a); c.throttle = R[o0 + 15]; c.gear = R[o0 + 17];
      const p = T.project(x, z, this.hint[k], this._pp);
      this.hint[k] = p.i;
      c.s = p.s; c.i = p.i; c.lat = p.lat;
    });
    // civilians
    if (s.sim.traffic && rec.nt) {
      const TR = rec.T, nt = rec.nt;
      s.sim.traffic.cars.forEach((c, k) => {
        const q0 = (i0 * nt + k) * TS, q1 = (i1 * nt + k) * TS;
        c.x = lerp(TR[q0], TR[q1], a); c.y = lerp(TR[q0 + 1], TR[q1 + 1], a); c.z = lerp(TR[q0 + 2], TR[q1 + 2], a);
        c.heading = lerpAngle(TR[q0 + 3], TR[q1 + 3], a);
      });
    }
    // nitrous flames on the cars near the lens
    if (!first && dtv !== 0) {
      const fx = s.effects, cam = this.cam.position;
      s.sim.racers.forEach((r, k) => {
        const c = this.cars[k];
        if (!c.nitro || !c.visible || Math.hypot(c.x - cam.x, c.z - cam.z) > 120) return;
        const fX = Math.sin(c.heading), fZ = Math.cos(c.heading), lX = Math.cos(c.heading), lZ = -Math.sin(c.heading);
        for (const [ex, ey] of r.model.exhausts || [[0.4, 0.32]]) {
          const px = c.x - fX * (r.dims.L / 2 + 0.1) + lX * ex, pz = c.z - fZ * (r.dims.L / 2 + 0.1) + lZ * ex;
          fx.flame(px, c.y + ey, pz, -fX * 6 + fX * c.speed * 0.9, 0, -fZ * 6 + fZ * c.speed * 0.9, true);
        }
      });
    }
  }

  // ------------------------------------------------------------- director

  newShot(cut = false, force = null) {
    const mode = this.mode;
    let type;
    if (mode !== 'auto') type = mode;
    else if (force) type = force;
    else {
      const prev = this.shot?.type;
      const pool = [['trackside', 0.42], ['chase', 0.18], ['front', 0.14], ['heli', 0.14], ['wheel', 0.12]]
        .filter(([t]) => t !== prev || t === 'trackside');
      let x = this.rng() * pool.reduce((sum, [, w]) => sum + w, 0);
      type = pool[pool.length - 1][0];
      for (const [t, w] of pool) { if ((x -= w) <= 0) { type = t; break; } }
    }
    const shot = { type, t: 0, dur: 4 + this.rng() * 3, n: 1 + Math.floor(this.rng() * 24) };
    if (type === 'trackside' && !this.placeTrackside(shot)) shot.type = 'chase';
    if (shot.type === 'heli') { shot.a = this.rng() * Math.PI * 2; shot.r = 26 + this.rng() * 14; shot.h = 18 + this.rng() * 16; }
    if (shot.type === 'front') { shot.side = this.rng() < 0.5 ? -1 : 1; shot.dur = 3 + this.rng() * 2; }
    if (shot.type === 'wheel') { shot.side = this.rng() < 0.5 ? -1 : 1; shot.dur = 2.5 + this.rng() * 1.5; }
    if (shot.type === 'chase') this.chase.first = true;
    this.shot = shot;
    if (cut || this.cutT > 0.1) this.glitch = Math.max(this.glitch, 0.35);
    this.cutT = 0;
    this.first = true;
  }

  /** A TV camera on the roadside ahead of the car, outside the racing lane. */
  placeTrackside(shot) {
    const T = this.s.track, c = this.cars[this.focus];
    const ahead = clamp(c.speed * 2.4, 40, 120) * (this.rate < 0 ? -1 : 1);
    let sCam = c.s + ahead;
    if (T.closed) sCam = ((sCam % T.length) + T.length) % T.length;
    else sCam = clamp(sCam, 5, T.length - 5);
    const i = T.posAt(sCam).i;
    // outside of the bend when there is one (that's where the TV crews stand)
    const i2 = T.idx(i + 6);
    const bend = Math.sign(-T.LZ[i2] * T.LX[i] + T.LX[i2] * T.LZ[i]);
    const side = bend ? -bend : (this.rng() < 0.5 ? -1 : 1);
    const W = T.W[i];
    const wall = side > 0 ? T.WL[i] : T.WR[i];
    const lat = side * Math.max(W * 0.7, Math.min(W + 2 + this.rng() * 3, (Number.isFinite(wall) ? wall : W + 6) - 0.7));
    const p = T.posAt(sCam, lat);
    let y = p.y + 1.6 + this.rng() * 3.5;
    const ground = T.terrain?.heightAt?.(p.x, p.z);
    if (Number.isFinite(ground)) y = Math.max(y, ground + 1.3);
    shot.pos = new THREE.Vector3(p.x, y, p.z);
    shot.s = sCam;
    shot.fov = 30;
    return true;
  }

  updateCamera(dt) {
    const cam = this.cam, c = this.cars[this.focus];
    if (!c.visible) { this.cycleFocus(1); return; }
    const shot = this.shot;
    shot.t += Math.abs(dt);
    this.cutT += dt;
    const fX = Math.sin(c.heading), fZ = Math.cos(c.heading), lX = Math.cos(c.heading), lZ = -Math.sin(c.heading);
    const T = this.s.track;
    let done = false;
    if (shot.type === 'trackside') {
      cam.position.copy(shot.pos);
      cam.lookAt(c.x, c.y + 0.7, c.z);
      const d = Math.hypot(c.x - shot.pos.x, c.y - shot.pos.y, c.z - shot.pos.z);
      // the operator zooms to keep the car the same size on screen
      const want = clamp((2 * Math.atan(7 / Math.max(1, d)) * 180) / Math.PI, 7, 62);
      shot.fov = this.first ? want : damp(shot.fov, want, 6, dt);
      cam.fov = shot.fov;
      const past = (T.closed ? T.deltaS(shot.s, c.s) : c.s - shot.s) * (this.rate < 0 ? -1 : 1);
      done = past > 35 || shot.t > 11 || d > 260;
    } else if (shot.type === 'chase') {
      this.chase.update(Math.abs(dt), { x: c.x, y: c.y, z: c.z, heading: c.heading, vF: c.speed, nitroOn: !!c.nitro });
      cam.position.copy(this.chase.cam.position);
      cam.quaternion.copy(this.chase.cam.quaternion);
      cam.fov = this.chase.cam.fov;
      done = shot.t > shot.dur;
    } else if (shot.type === 'heli') {
      shot.a += dt * 0.12;
      const want = this._v.set(c.x + Math.sin(shot.a) * shot.r, c.y + shot.h, c.z + Math.cos(shot.a) * shot.r);
      if (this.first) cam.position.copy(want); else cam.position.lerp(want, 1 - Math.exp(-dt * 2.5));
      cam.lookAt(c.x, c.y, c.z);
      cam.fov = 38;
      done = shot.t > shot.dur;
    } else if (shot.type === 'front') {
      // a camera car a few lengths ahead, looking back at the action
      const lead = 11 + Math.min(8, c.speed * 0.1);
      const want = this._v.set(c.x + fX * lead + lX * shot.side * 1.6, c.y + 1.25, c.z + fZ * lead + lZ * shot.side * 1.6);
      if (this.first) cam.position.copy(want); else cam.position.lerp(want, 1 - Math.exp(-dt * 6));
      cam.lookAt(c.x, c.y + 0.55, c.z);
      cam.fov = 40;
      done = shot.t > shot.dur;
    } else if (shot.type === 'wheel') {
      // bolted low on the flank, looking down the road past the front wheel
      const sd = shot.side;
      cam.position.set(c.x + lX * sd * 1.22 - fX * 0.9, c.y + 0.42, c.z + lZ * sd * 1.22 - fZ * 0.9);
      cam.lookAt(c.x + fX * 25 + lX * sd * 0.6, c.y + 0.35, c.z + fZ * 25 + lZ * sd * 0.6);
      cam.fov = 62;
      done = shot.t > shot.dur;
    }
    cam.updateProjectionMatrix();
    this.first = false;
    if (done) this.newShot();
  }

  updateAudio(dt) {
    const s = this.s, cam = this.cam;
    const cr = this._v.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const muted = this.paused || this.rate !== 1;
    s.sim.racers.forEach((r, k) => {
      const e = r.engine, c = this.cars[k];
      if (!e) return;
      const dx = c.x - cam.position.x, dz = c.z - cam.position.z;
      const d = Math.hypot(dx, dz) + 0.001;
      const near = k === this.focus && (this.shot?.type === 'wheel' || this.shot?.type === 'chase') ? 1 : 0;
      const gain = muted || !c.visible ? 0 : Math.max(near * 0.9, Math.pow(clamp(1 - d / 160, 0, 1), 1.5));
      try {
        e.update(dt, { rpm: c.rpm, throttle: c.throttle, load: c.throttle > 0.08 ? c.throttle : -0.5, gear: c.gear, shifting: false, limiter: false, boost: 0 });
        e.setSpatial({ gain, pan: clamp((dx * cr.x + dz * cr.z) / d, -1, 1) * 0.8, doppler: 1 });
      } catch { /* audio not ready */ }
    });
  }
}
