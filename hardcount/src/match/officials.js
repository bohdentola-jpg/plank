// The crew: five officials who keep out of the way, follow the ball, run in to
// spot it, throw flags and give the signals. Plain data (the world draws
// them, the replay deck records them) driven from the match's events.
import { clamp } from '../core/util.js';

const ROLES = [
  { id: 'R', model: 'referee', name: 'REFEREE' },
  { id: 'U', model: 'umpire', name: 'UMPIRE' },
  { id: 'HL', model: 'judge', name: 'HEAD LINESMAN' },
  { id: 'LJ', model: 'judge', name: 'LINE JUDGE' },
  { id: 'BJ', model: 'judge', name: 'BACK JUDGE' },
];

export class Officials {
  constructor(m) {
    this.m = m;
    this.crew = ROLES.map((r) => ({ id: r.id, model: r.model, x: 0, z: 0, h: 0, vx: 0, vz: 0, base: 'ref', act: null, look: null, flag: false, goal: null }));
    this.flags = [];           // yellow flags on the turf: { x, z, y, vx, vy, vz, t, landed }
    this.unsub = m.on((ev) => this.onEvent(ev));
  }

  by(id) { return this.crew.find((c) => c.id === id); }

  dispose() { this.unsub?.(); }

  /** Line up for the next snap (or kickoff). */
  place() {
    const m = this.m, F = m.field;
    const dir = m.offDir, los = m.los, bx = m.ballX;
    const sideX = F.halfW + 1.2;
    const spots = m.playKind === 'kickoff'
      ? { R: [bx - 6, los - dir * 4], U: [bx + 6, los - dir * 4], HL: [-sideX, los + dir * 18], LJ: [sideX, los + dir * 18], BJ: [0, los + dir * (F.halfL * 0.9 + 2)] }
      : m.playKind === 'fg' || m.tryMode === 'pat'
        ? { R: [bx + 4, los - dir * 10], U: [bx - 3, los + dir * 6], HL: [-sideX, los], LJ: [sideX, los], BJ: [0, (F.end + 1.5) * dir] }
        : { R: [bx + 3.5 * dir, los - dir * 11], U: [bx - 1.5, los + dir * 6.5], HL: [-sideX, los], LJ: [sideX, los], BJ: [clamp(bx * 0.5, -6, 6), los + dir * 17] };
    for (const c of this.crew) {
      const s = spots[c.id];
      c.x = s[0]; c.z = clamp(s[1], -F.end - 2, F.end + 2);
      c.vx = c.vz = 0;
      c.h = Math.atan2(bx - c.x, los - c.z);
      c.act = null; c.goal = null; c.flag = false;
      c.look = { x: bx, y: 1, z: los };
    }
    // the second deep man under the posts on kicks
    if (m.playKind === 'fg' || m.tryMode === 'pat') { const u = this.by('U'); u.x = 3; u.z = (F.end + 1.5) * dir; }
    this.flags.length = 0;
  }

  signal(id, name, side = null) {
    const c = this.by(id);
    if (!c) return;
    c.act = { name, t: 0, side, power: 0.5 };
  }

  nearestTo(x, z, skip = null) {
    let best = null, bd = 1e9;
    for (const c of this.crew) {
      if (c.id === skip) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  onEvent(ev) {
    const m = this.m;
    switch (ev.type) {
      case 'flag': {
        // the official nearest the foul throws it toward the spot
        const e = ev.e || m.ball.carrier;
        const x = e ? e.x : m.ball.x, z = e ? e.z : m.ball.z;
        const c = this.nearestTo(x, z);
        if (c) {
          c.act = { name: 'sig_flag', t: 0, side: 'R', power: 0.5 };
          const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1, T = 0.7;
          const reach = Math.min(d, 12);
          this.flags.push({ x: c.x, z: c.z, y: 2.1, vx: dx / d * reach / T, vz: dz / d * reach / T, vy: 4.6, t: -0.32, landed: false });
        }
        break;
      }
      case 'whistle': {
        const r = ev.result;
        if (!r) break;
        const F = m.field;
        // somebody runs in to mark the spot
        const spotter = this.nearestTo(r.x, r.z, 'R');
        if (spotter && r.type !== 'incomplete' && r.type !== 'td') spotter.goal = { x: clamp(r.x, -F.halfW, F.halfW), z: r.z, run: true, t: 0 };
        if (r.type === 'td' || r.type === 'twoGood') {
          const c = this.nearestTo(r.x, r.z);
          this.signal(c.id, 'sig_td');
          const c2 = this.nearestTo(r.x, r.z, c.id);
          if (c2) setTimeout(() => this.signal(c2.id, 'sig_td'), 250);
        } else if (r.type === 'incomplete') {
          const c = this.nearestTo(m.ball.x, m.ball.z);
          this.signal(c.id, 'sig_incomplete');
        } else if (r.type === 'safety') {
          this.signal('R', 'sig_safety');
        } else if (r.type === 'fgGood' || r.type === 'patGood') {
          this.signal('BJ', 'sig_good'); this.signal('U', 'sig_good');
        } else if (r.type === 'fgMiss' || r.type === 'patMiss') {
          this.signal('BJ', 'sig_nogood'); this.signal('U', 'sig_nogood');
        }
        break;
      }
      case 'firstDown': {
        const c = this.by(m.ball.x > 0 ? 'LJ' : 'HL');
        if (c) setTimeout(() => this.signal(c.id, 'sig_first', m.offDir > 0 ? 'R' : 'L'), 650);
        break;
      }
      case 'timeout':
        this.signal('R', 'sig_timeout');
        break;
      default: break;
    }
  }

  /** Run the crew for one step of a live play (or the dead-ball aftermath). */
  update(dt) {
    const m = this.m, F = m.field, b = m.ball;
    const live = m.phase === 'live';
    const bx = b.carrier ? b.carrier.x : b.x, bz = b.carrier ? b.carrier.z : b.z;
    const dir = m.offDir;
    for (const c of this.crew) {
      if (c.act) {
        c.act.t += dt;
        const dur = ACT_DUR[c.act.name] || 1.5;
        if (c.act.t > dur) c.act = null;
      }
      let tx = c.x, tz = c.z, speed = 0;
      if (c.goal) {
        c.goal.t += dt;
        tx = c.goal.x; tz = c.goal.z; speed = 6.5;
        if (Math.hypot(tx - c.x, tz - c.z) < 0.6 || c.goal.t > 5) c.goal = null;
      } else if (live) {
        // keep the play in front, out of the traffic
        switch (c.id) {
          case 'HL': tx = -F.halfW - 1.2; tz = bz; speed = 7.5; break;
          case 'LJ': tx = F.halfW + 1.2; tz = bz; speed = 7.5; break;
          case 'R': tx = clamp(bx + 5 * Math.sign(c.x - bx || 1), -F.halfW + 2, F.halfW - 2); tz = Math.min(bz * dir, m.los * dir - 6) * dir; speed = 5.5; break;
          case 'U': tx = clamp(bx * 0.6, -F.halfW + 4, F.halfW - 4); tz = bz + dir * 7; speed = 5; break;
          case 'BJ': tx = clamp(bx * 0.4, -F.halfW + 4, F.halfW - 4); tz = clamp((Math.max(bz * dir + 12, m.los * dir + 14)) * dir, -F.end, F.end); speed = 7; break;
          default: break;
        }
        // never stand on top of a player
        for (const e of m.active) {
          const d = Math.hypot(e.x - tx, e.z - tz);
          if (d < 3) { const k = (3 - d) / 3; tx += (tx - e.x) / (d || 1) * 3 * k; tz += (tz - e.z) / (d || 1) * 3 * k; }
        }
      }
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (speed > 0 && d > 0.3) { const s = Math.min(speed, d * 2.5); vx = dx / d * s; vz = dz / d * s; }
      const k = 1 - Math.exp(-dt * 5);
      c.vx += (vx - c.vx) * k; c.vz += (vz - c.vz) * k;
      c.x += c.vx * dt; c.z += c.vz * dt;
      // face the ball (or where he's running)
      const sp = Math.hypot(c.vx, c.vz);
      const want = sp > 2.5 && !(Math.abs(c.vx) > Math.abs(c.vz) * 3 && (c.id === 'HL' || c.id === 'LJ')) ? Math.atan2(c.vx, c.vz) : Math.atan2(bx - c.x, bz - c.z);
      let dh = want - c.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      c.h += clamp(dh, -dt * 6, dt * 6);
      c.look = { x: bx, y: 1.2, z: bz };
    }
    // flags in flight
    for (const f of this.flags) {
      f.t += dt;
      if (f.t < 0 || f.landed) continue;
      f.vy -= 10.7 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      if (f.y <= 0.02) { f.y = 0.02; f.landed = true; }
    }
  }

  snapshot() {
    return this.crew.map((c) => ({ id: c.id, model: c.model, x: c.x, z: c.z, h: c.h, vx: c.vx, vz: c.vz, base: c.base, act: c.act, look: c.look }));
  }
}

const ACT_DUR = { sig_td: 2.2, sig_first: 1.6, sig_incomplete: 1.6, sig_flag: 0.8, sig_safety: 1.8, sig_timeout: 1.6, sig_good: 2.0, sig_nogood: 1.6 };
