// Race simulation — pure logic, no rendering (runs headless for tests):
// grid, countdown + launch control, AI, fixed-step physics, walls, car-car
// contact, drafting, laps, positions, knockout eliminations, wrong-way,
// nitrous rewards, auto-resets, finish + results.
import { Vehicle, PHYS_DT, collideCars } from '../car/physics.js';
import { AIDriver } from './ai.js';
import { TrafficSim } from './traffic.js';
import { clamp } from '../core/util.js';

/** Laps for a lap knockout with this many rivals: two or three, whatever the
 *  field (a big field loses more than one car a lap), so it stays short. */
export const knockLaps = (rivals) => Math.min(3, Math.max(2, rivals | 0));

export class RaceSim {
  /**
   * track: Track (with racing line computed). opts: { type, laps, racers:
   * [{spec, upgrades, name, isPlayer, skill, look}], auto (player gearbox),
   * assists (player 0..1), rubber (0..1), playerGrid ('back'|'front'|'mid') }
   */
  constructor(track, opts) {
    this.T = track;
    this.opts = opts;
    this.type = opts.type || 'circuit';
    this.laps = (this.type === 'sprint' || this.type === 'drag') ? 1 : (opts.laps || 3);
    // drift: score attack against posted rival scores
    if (this.type === 'drift') {
      const per = track.length * this.laps;
      this.driftRivals = (opts.driftRivals || [['RIN', 2.5], ['HAYATE', 4.0], ['MIKA', 5.5]])
        .map(([name, k]) => ({ name, score: Math.round(per * k / 50) * 50 }))
        .sort((a, b) => b.score - a.score);
    }
    this.state = 'grid';
    this.time = 0;
    this.raceTime = 0;
    this.countdown = 0;
    this.events = [];
    this.physAcc = 0;
    this.finishOrder = [];
    this.knockLap = {}; // lap → racers that completed it
    this.racers = opts.racers.map((rd, k) => {
      const veh = new Vehicle(rd.spec, rd.upgrades || {});
      return {
        id: k, name: rd.name || rd.spec.model, isPlayer: !!rd.isPlayer, spec: rd.spec, look: rd.look || {},
        vehicle: veh, skill: rd.skill ?? 0.8, hint: -1, s: 0, lat: 0, lap: 0, total: 0,
        lapStart: 0, lapTimes: [], bestLap: null, lastLap: null, finished: false, finishTime: null,
        out: false, pos: k + 1, draft: 0, wrongT: 0, wrongWay: false, offT: 0, scraping: false,
        airborneT: 0, driftT: 0, driftScore: 0,
        ctl: { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false },
        dims: { L: rd.spec.body.L, W: rd.spec.body.W },
      };
    });
    this.player = this.racers.find((r) => r.isPlayer) || null;
    for (const r of this.racers) {
      if (!r.isPlayer) r.ai = new AIDriver(r, track, { skill: r.skill, rubber: opts.rubber ?? 1, seed: opts.seed || '' });
    }
    this.placeGrid();
    if (opts.traffic) {
      this.traffic = new TrafficSim(track, track.def, { seed: opts.seed || '' });
      this.traffic.place(track.startS);
    }
  }

  emit(type, data = {}) { this.events.push({ type, t: this.time, ...data }); }

  placeGrid() {
    const T = this.T;
    // rivals line up by pace (fastest on pole) so the field spreads out
    // instead of jamming behind the slowest car; the player starts per opts
    const others = this.racers.filter((r) => !r.isPlayer).sort((a, b) => (b.skill * (b.ai?.gripScale || 1)) - (a.skill * (a.ai?.gripScale || 1)));
    let order;
    const pg = this.opts.playerGrid || 'back';
    if (!this.player) order = others;
    else if (pg === 'front') order = [this.player, ...others];
    else if (pg === 'mid') order = [...others.slice(0, Math.floor(others.length / 2)), this.player, ...others.slice(Math.floor(others.length / 2))];
    else order = [...others, this.player];
    const drag = this.type === 'drag';
    order.forEach((r, k) => {
      let s, lat;
      if (drag) {
        const lanes = this.T.def.dragLanes || [-4.5, 4.5, -9, 9];
        s = T.startS - 2.5;
        lat = lanes[k % lanes.length];
      } else {
        const row = Math.floor(k / 2), col = k % 2;
        s = T.startS - 8 - row * 8.5 - col * 3;
        const w = T.W[T.posAt(s).i];
        lat = (col ? -1 : 1) * Math.min(w * 0.42, 3.4);
      }
      const p = T.posAt(s, lat);
      r.vehicle.reset(p.x, p.z, p.heading, p.y);
      r.hint = p.i;
      r.s = s;
      r.lat = lat;
      r.gridLat = lat;
      r.total = T.closed ? T.deltaS(T.startS, s) : s - T.startS;
      r.grid = k;
    });
  }

  startCountdown(sec = 3) {
    this.state = 'countdown';
    this.countdown = sec;
    this.emit('count', { n: Math.ceil(sec) });
  }

  // ---------------------------------------------------------------- step

  step(dt) {
    this.time += dt;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.emit('count', { n: after });
      if (this.countdown <= 0) this.go();
    } else if (this.state === 'racing' || this.state === 'finished') {
      this.raceTime += dt;
    }
    for (const r of this.racers) if (r.ai) r.ai.update(dt, this);
    this.physics(dt);
    this.progress(dt);
    // a few seconds of glory after your flag, then the board (anyone still
    // out there gets a time from their pace)
    if (this.state === 'finished' && this.raceTime - (this.playerFinishTime ?? this.raceTime) > (this.opts.afterFinish ?? 7)) this.end();
  }

  go() {
    this.state = 'racing';
    this.raceTime = 0;
    for (const r of this.racers) r.lapStart = 0;
    this.emit('go');
    // launch control: rewarding the right revs at GO
    for (const r of this.racers) {
      const v = r.vehicle;
      const f = v.rpm / v.P.redline;
      let bonus = 0, grade = null;
      if (r.isPlayer) {
        if (f > 0.62 && f < 0.84) { bonus = 4; grade = 'PERFECT START'; }
        else if (f > 0.48 && f < 0.93) { bonus = 2; grade = 'GOOD START'; }
        else if (f >= 0.93) { grade = 'WHEELSPIN!'; v.wheelSpin = 8; }
      } else {
        bonus = 1 + r.skill * 2.5;
      }
      if (bonus) {
        const [fx, fz] = v.fwd;
        v.vx += fx * bonus; v.vz += fz * bonus;
      }
      if (grade && r.isPlayer) this.emit('launch', { grade, perfect: bonus >= 4 });
    }
  }

  physics(dt) {
    const T = this.T;
    const frozen = this.state === 'grid' || this.state === 'countdown';
    this.physAcc += Math.min(dt, 0.15);
    let steps = 0;
    while (this.physAcc >= PHYS_DT && steps < 19) {
      this.physAcc -= PHYS_DT;
      steps++;
      for (const r of this.racers) {
        if (r.out && r.parked) continue;
        const v = r.vehicle;
        const env = {
          ground: (x, z) => {
            const g = T.ground(x, z, r.hint, r._g || (r._g = {}));
            r.hint = g.i;
            return g;
          },
          // drag racing is always stick: you shift on the light
          auto: r.isPlayer && !r.ai ? (this.type !== 'drag' && this.opts.auto !== false) : true,
          assists: r.isPlayer ? (this.opts.assists ?? 1) : 1,
          // a human at the wheel gets the drift handling, the steering
          // limiter (made for thumbs and keys) and a planted rear; the AI
          // drives the raw chassis
          human: !!(r.isPlayer && !r.ai),
          draft: r.draft,
        };
        const ctl = r.ctl;
        if (frozen) {
          v.step(PHYS_DT, { ...ctl, handbrake: true, brake: 0, nitro: false }, env);
          v.vx = 0; v.vz = 0; v.yawRate = 0;
          if (v.gear < 1) v.gear = 1;
        } else {
          v.step(PHYS_DT, ctl, env);
        }
        ctl.shiftUp = false;
        ctl.shiftDown = false;
        if (v.lastShift) {
          if (r.isPlayer) {
            // grade manual upshifts: right at the top of the band pays off
            let grade = null;
            if (v.lastShift > 0 && !env.auto && this.state === 'racing') {
              const f = (v.shiftRpm || 0) / v.P.redline;
              grade = f >= 0.87 && f <= 0.99 ? 'PERFECT' : f >= 0.76 ? 'GOOD' : f < 0.66 ? 'EARLY' : null;
              if (grade === 'PERFECT') {
                const [fx, fz] = v.fwd;
                v.vx += fx * 0.5; v.vz += fz * 0.5;
                v.nitro = Math.min(1, v.nitro + 0.06);
              }
            }
            this.emit('shift', { dir: v.lastShift, grade });
          }
          v.lastShift = 0;
        }
        if (v.landing > 0.15) this.emit('landing', { id: r.id, strength: v.landing });
        // the weight shifting as a drift kicks in (or swings across)
        if (v.hopped) { v.hopped = false; this.emit('drifthop', { id: r.id }); }
        this.walls(r);
      }
      const R = this.racers;
      for (let a = 0; a < R.length; a++) {
        if (R[a].out && R[a].parked) continue;
        for (let b = a + 1; b < R.length; b++) {
          if (R[b].out && R[b].parked) continue;
          if (R[a].ghost || R[b].ghost) continue;
          const hit = collideCars(R[a].vehicle, R[b].vehicle, R[a].dims, R[b].dims);
          if (hit && hit.impact > 1.0) {
            R[a].lastHitT = R[b].lastHitT = this.time;
            this.emit('carhit', { a: R[a].id, b: R[b].id, impact: hit.impact, x: (R[a].vehicle.x + R[b].vehicle.x) / 2, z: (R[a].vehicle.z + R[b].vehicle.z) / 2, y: R[a].vehicle.y });
          }
        }
      }
      if (this.traffic) {
        this.traffic.step(PHYS_DT, this);
        this.traffic.collide(this, collideCars);
      }
    }
  }

  walls(r) {
    const T = this.T;
    const v = r.vehicle;
    const [fx, fz] = v.fwd;
    const [lx, lz] = v.left;
    const hl = r.dims.L / 2 - 0.05, hw = r.dims.W / 2 - 0.02;
    let worst = 0, wn = null, wc = null, wp = null;
    for (const [a, b] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw]]) {
      const x = v.x + fx * a + lx * b, z = v.z + fz * a + lz * b;
      const p = T.project(x, z, r.hint, r._wp || (r._wp = {}));
      const i = p.i;
      if (p.lat > T.WL[i] && p.lat - T.WL[i] > worst) { worst = p.lat - T.WL[i]; wn = [-T.LX[i], -T.LZ[i]]; wc = [a, b]; wp = [x, z]; }
      if (p.lat < -T.WR[i] && -T.WR[i] - p.lat > worst) { worst = -T.WR[i] - p.lat; wn = [T.LX[i], T.LZ[i]]; wc = [a, b]; wp = [x, z]; }
    }
    if (wn) {
      const impact = v.hitWall(wn[0], wn[1], worst, wc);
      r.scraping = true;
      r.scrapePoint = wp;
      if (impact > 2) this.emit('wallhit', { id: r.id, impact, x: wp[0], z: wp[1], y: v.y });
    } else {
      r.scraping = false;
    }
  }

  progress(dt) {
    const T = this.T;
    const racing = this.state === 'racing' || this.state === 'finished';
    for (const r of this.racers) {
      const v = r.vehicle;
      const p = T.project(v.x, v.z, r.hint, r._pp || (r._pp = {}));
      const prevS = r.s;
      r.s = p.s;
      r.lat = p.lat;
      r.hint = p.i;
      if (!racing || r.out) continue;
      if (T.closed) r.total += T.deltaS(prevS, r.s);
      else r.total = r.s - T.startS;

      // drafting: tucked in behind a car ahead at speed
      let draft = 0;
      if (v.speed > 18) {
        for (const o of this.racers) {
          if (o === r || o.out) continue;
          const ds = T.deltaS(r.s, o.s);
          if (ds > 3 && ds < 32 && Math.abs((o.lat ?? 0) - r.lat) < 1.8) draft = Math.max(draft, 1 - (ds - 3) / 29);
        }
      }
      r.draft = draft;

      // wrong way
      const tx = T.TX[p.i], tz = T.TZ[p.i];
      const along = v.vx * tx + v.vz * tz;
      const hdg = Math.sin(v.heading) * tx + Math.cos(v.heading) * tz;
      if ((along < -3 || (hdg < -0.3 && v.speed > 2)) && !r.finished) r.wrongT += dt; else r.wrongT = Math.max(0, r.wrongT - dt * 2);
      const ww = r.wrongT > 1.2;
      if (ww !== r.wrongWay) { r.wrongWay = ww; if (r.isPlayer) this.emit('wrongway', { on: ww }); }

      // far off course → auto reset
      const w = T.W[p.i];
      if (Math.abs(p.lat) > Math.min(T.WL[p.i], T.WR[p.i]) + 6 || Math.abs(p.lat) > w + 40) r.offT += dt; else r.offT = 0;
      if (r.offT > 2.5) { this.resetRacer(r); r.offT = 0; }

      // nitrous rewards for the player: drifting, drafting, airtime; slow trickle
      if (r.isPlayer && !r.finished) {
        let gain = 0.006;
        const slide = Math.abs(v.driftAngle);
        if (slide > 0.18 && v.speed > 14 && !v.airborne) { gain += 0.05 + slide * 0.06; r.driftT += dt; } else r.driftT = 0;
        if (draft > 0.3) gain += 0.045 * draft;
        if (v.airborne) { gain += 0.09; r.airborneT += dt; } else if (r.airborneT > 0) { if (r.airborneT > 0.6) this.emit('airtime', { t: r.airborneT }); r.airborneT = 0; }
        if (!v.nitroOn) v.nitro = Math.min(1, v.nitro + gain * dt);
        if (r.driftT > 1.2 && !r._driftAnnounced) { r._driftAnnounced = true; this.emit('driftbonus'); }
        if (r.driftT === 0) r._driftAnnounced = false;
      }

      if (this.type === 'drift' && r.isPlayer && !r.finished) this.driftScore(r, v, p, dt);

      // laps / finish
      if (!r.finished) {
        const lapNow = Math.floor(r.total / T.length);
        const target = this.type === 'sprint' || this.type === 'drag' ? T.finishS - T.startS : T.length * this.laps;
        if (T.closed && lapNow > r.lap && r.total > 0) {
          for (let L = r.lap + 1; L <= lapNow; L++) this.completeLap(r, L);
        }
        if (r.total >= target) this.finish(r);
      }
    }
    this.rank();
  }

  /** Drift scoring: angle × speed while sliding, a multiplier that grows with
   *  the length of the slide, banked when you straighten up, lost on contact. */
  driftScore(r, v, p, dt) {
    const T = this.T;
    const D = r.dr || (r.dr = { cur: 0, mult: 1, t: 0, calm: 0, total: 0, best: 0, last: 0 });
    const ang = Math.min(70, Math.abs(v.driftAngle) * 57.3);
    const onRoad = Math.abs(p.lat) < T.W[p.i] + 0.6;
    const crashed = r.scraping || (r.lastHitT && this.time - r.lastHitT < 0.05);
    if (D.cur > 0 && (crashed || !onRoad)) {
      this.emit('driftlost', { pts: Math.round(D.cur * D.mult), why: crashed ? 'CRASHED' : 'OFF ROAD' });
      D.cur = 0; D.t = 0; D.mult = 1; D.calm = 0;
      return;
    }
    // (drifts run at up to ~25°: the scale starts low enough that a neat,
    // shallow one still scores)
    if (ang > 8 && v.speed > 9 && onRoad && !v.airborne) {
      D.cur += (ang - 5) * v.speed * dt;
      D.t += dt;
      D.calm = 0;
      const m = 1 + Math.min(4, Math.floor(D.t / 1.6));
      if (m > D.mult) this.emit('driftmult', { mult: m });
      D.mult = m;
    } else if (D.cur > 0) {
      D.calm += dt;
      if (D.calm > 0.7) {
        const pts = Math.round(D.cur * D.mult / 5) * 5;
        D.total += pts;
        D.best = Math.max(D.best, pts);
        D.last = pts;
        this.emit('driftbank', { pts, mult: D.mult });
        D.cur = 0; D.t = 0; D.mult = 1; D.calm = 0;
      }
    }
  }

  completeLap(r, L) {
    const t = this.raceTime - r.lapStart;
    r.lapStart = this.raceTime;
    r.lap = L;
    r.lastLap = t;
    r.lapTimes.push(t);
    const best = r.bestLap === null || t < r.bestLap;
    if (best) r.bestLap = t;
    if (r.isPlayer) {
      this.emit('lap', { lap: L, time: t, best, final: L === this.laps - 1 });
      if (L === this.laps - 1) this.emit('finallap');
    }
    // knockout: the last racers to complete each lap are eliminated — one a
    // lap, or more in a big field, so it's down to two for the final lap
    // (races stay three laps at most)
    if (this.type === 'knockout' && L < this.laps) {
      const done = (this.knockLap[L] = this.knockLap[L] || []);
      if (!done.length) {
        const alive = this.racers.filter((o) => !o.out).length;
        done.alive = alive;
        done.cut = Math.min(alive - 2, Math.ceil((alive - 2) / (this.laps - L)));
      }
      done.push(r);
      if (done.length > done.alive - done.cut) {
        r.out = true;
        r.finished = true;
        r.finishTime = null;
        this.emit('knockout', { id: r.id, name: r.name, player: r.isPlayer });
        if (r.isPlayer) this.playerOut();
      }
    }
  }

  finish(r) {
    r.finished = true;
    r.finishTime = this.raceTime;
    if (this.type === 'drift' && r.isPlayer && r.dr) {
      const D = r.dr;
      if (D.cur > 0) { D.total += Math.round(D.cur * D.mult / 5) * 5; D.cur = 0; }
      r.driftTotal = D.total;
    }
    if (r.lapTimes.length < this.laps && this.T.closed) {
      const t = this.raceTime - r.lapStart;
      r.lapTimes.push(t);
      if (r.bestLap === null || t < r.bestLap) r.bestLap = t;
    } else if (!this.T.closed) {
      r.lapTimes = [this.raceTime];
      r.bestLap = this.raceTime;
    }
    this.finishOrder.push(r);
    r.place = this.finishOrder.length;
    if (this.type === 'drift' && r.isPlayer) r.place = 1 + this.driftRivals.filter((x) => x.score > (r.driftTotal || 0)).length;
    this.emit('finish', { id: r.id, place: r.place, player: r.isPlayer, time: r.finishTime, score: r.driftTotal });
    if (this.type === 'knockout' && !r.isPlayer) {
      // in knockout the winner is the last survivor; others still finish normally
    }
    if (r.isPlayer) {
      this.state = 'finished';
      this.playerFinishTime = this.raceTime;
    }
    if (this.racers.every((o) => o.finished || o.out)) this.end();
  }

  playerOut() {
    this.state = 'finished';
    this.playerFinishTime = this.raceTime;
    this.emit('finish', { id: this.player.id, place: null, player: true, out: true });
  }

  /** Give unfinished racers an estimated time from their pace, then mark done. */
  end() {
    if (this.state === 'done') return;
    const T = this.T;
    const target = this.type === 'sprint' || this.type === 'drag' ? T.finishS - T.startS : T.length * this.laps;
    const pending = this.racers.filter((r) => !r.finished && !r.out);
    pending.sort((a, b) => b.total - a.total);
    for (const r of pending) {
      const pace = Math.max(5, r.total / Math.max(1, this.raceTime));
      r.finishTime = this.raceTime + Math.max(0, target - r.total) / pace;
      r.finished = true;
      r.estimated = true;
      this.finishOrder.push(r);
      r.place = this.finishOrder.length;
    }
    this.state = 'done';
    this.emit('done');
  }

  rank() {
    const live = this.racers.slice().sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1;
      if (a.finished && b.finished) return (a.place ?? 99) - (b.place ?? 99);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.total - a.total;
    });
    live.forEach((r, k) => { r.pos = k + 1; });
    this.order = live;
  }

  resetRacer(r) {
    const T = this.T;
    const s = T.closed ? r.s : Math.max(T.startS, r.s - 4);
    const lat = T.line ? T.line.off[T.posAt(s).i] * 0.5 : 0;
    const p = T.posAt(s, lat);
    const n = r.vehicle.nitro;
    r.vehicle.reset(p.x, p.z, p.heading, p.y + 0.2);
    r.vehicle.nitro = n;
    r.hint = p.i;
    r.wrongT = 0;
    this.emit('reset', { id: r.id, player: r.isPlayer });
  }
}

export { clamp };
