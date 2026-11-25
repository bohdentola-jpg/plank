// Monster AI: wander -> investigate -> alert -> chase -> search -> check spots.
// A "director" steers its patrols to keep a rhythm of pressure and relief,
// and sends it past your hiding spot now and then.
import * as THREE from 'three';
import { MonsterModel } from './monsterModel.js';
import { clamp, damp, dampAngle, wrapAngle, smoothstep, rng } from './util.js';

const R = rng(31337);

export class Monster {
  constructor({ scene, T, cfg, nav, lvl, audio, game }) {
    this.cfg = cfg;
    this.nav = nav;
    this.lvl = lvl;
    this.audio = audio;
    this.game = game;
    this.model = new MonsterModel(T, cfg);
    scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.head = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.targetSpeed = 0;
    this.model.onStep = (i, run) => this.audio.monsterStep(this.pos, run, this.game.surfaceAt(this.pos.x, this.pos.z));
    this._look = new THREE.Vector3();
    this.reset();
  }

  reset() {
    const L = this.lvl;
    const start = this.nav.nearestWalkable(L.W * 0.5, 8.6);
    this.pos.set(start.x, 0, start.z);
    this.yaw = Math.PI;
    this.speed = 0;
    this.state = 'dormant';
    this.timer = this.cfg.name === 'mobile' ? 16 : 26;
    this.path = null;
    this.pathIdx = 0;
    this.awareness = 0;
    this.suspicion = 0;
    this.lastSeen = new THREE.Vector3();
    this.lastSeenT = -99;
    this.lostT = 0;
    this.checkQueue = [];
    this.spot = null;
    this.thorough = false;
    this.menace = 0;
    this.reliefUntil = 0;
    this.nextHoleVisit = this.cfg.name === 'mobile' ? 42 : 55;
    this.voiceT = 3;
    this.repathT = 0;
    this.stuckT = 0;
    this.lastPos = this.pos.clone();
    this.model.root.visible = false; // it isn't anywhere yet
    this.model.lookTarget = null;
    for (const k in this.model.target) this.model.target[k] = 0;
    this.closeCalls = 0;
    this._closeFlag = false;
    this.checksDone = 0;
    this.checkT = 0;
    this.place();
  }

  place() {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
  }

  // ------------------------------------------------------------ navigation
  goTo(x, z, speed) {
    const p = this.nav.path(this.pos.x, this.pos.z, x, z);
    this.path = p;
    this.pathIdx = 0;
    this.targetSpeed = speed;
    this.stuckT = 0;
    return !!p;
  }
  follow(dt) {
    if (!this.path) {
      this.speed = damp(this.speed, 0, 6, dt);
      return true;
    }
    const wp = this.path[this.pathIdx];
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathIdx === this.path.length - 1;
    if (d < (last ? 0.25 : 0.45)) {
      this.pathIdx++;
      if (this.pathIdx >= this.path.length) {
        this.path = null;
        return true;
      }
      return false;
    }
    const want = Math.atan2(dx, dz);
    const turnRate = this.targetSpeed > 3 ? 7 : 3.2;
    this.yaw = dampAngle(this.yaw, want, turnRate, dt);
    const facing = Math.cos(wrapAngle(want - this.yaw));
    const slow = last ? clamp(d / 1.2, 0.35, 1) : 1;
    this.speed = damp(this.speed, this.targetSpeed * clamp(facing, 0.15, 1) * slow, this.targetSpeed > 3 ? 5 : 3, dt);
    const step = Math.min(d, this.speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    return false;
  }
  faceToward(x, z, dt, rate = 4) {
    this.yaw = dampAngle(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), rate, dt);
  }

  // ------------------------------------------------------------- director
  choosePoi() {
    const g = this.game;
    const p = g.player.pos;
    const relief = this.menace > 0.55 || g.time < this.reliefUntil;
    const hidden = g.player.hidden;
    let total = 0;
    const cands = [];
    for (const q of this.lvl.pois) {
      const dm = Math.hypot(q.x - this.pos.x, q.z - this.pos.z);
      if (dm < 4) continue;
      const dp = Math.hypot(q.x - p.x, q.z - p.z);
      let w = q.weight;
      if (relief) w *= smoothstep(9, 22, dp) + 0.05;
      else if (hidden) w *= Math.exp(-Math.pow((dp - 9) / 7, 2)) + 0.08;
      else w *= Math.exp(-Math.pow((dp - 11) / 6, 2)) + 0.05;
      if (q.area === 'hole' && !hidden) w *= 0.3;
      cands.push([q, w]);
      total += w;
    }
    let r = R() * total;
    for (const [q, w] of cands) {
      r -= w;
      if (r <= 0) return q;
    }
    return cands.length ? cands[0][0] : this.lvl.pois[0];
  }

  setState(s, timer = 0) {
    this.state = s;
    this.timer = timer;
    const T = this.model.target;
    T.sniff = 0; T.peer = 0; T.reach = 0; T.scream = 0; T.crouch = 0;
  }

  // ------------------------------------------------------------- senses
  hear(x, z, radius, kind = 'step') {
    if (this.state === 'dormant' || this.state === 'grab' || this.state === 'leave' || this.state === 'gone') return;
    const d = Math.hypot(x - this.pos.x, z - this.pos.z);
    const r = radius * this.cfg.monster.hearing * (1 + this.game.hour * 0.06);
    if (d > r) return;
    if (this.state === 'chase' || this.state === 'alert') return;
    if (this.state === 'check' && this.thorough) return;
    const err = clamp(d / r, 0, 1) * 2.2;
    const tx = x + (R() - 0.5) * err, tz = z + (R() - 0.5) * err;
    if (kind === 'gasp' && d < r * 0.6 && this.game.player.hidden) {
      // a gasp from a hiding spot points it straight at you
      this.startCheck(this.game.player.hidden, true);
      return;
    }
    this.investigate(tx, tz);
    if (d < r * 0.35) this.awareness = Math.max(this.awareness, 0.45);
  }

  investigate(x, z) {
    this.setState('investigate');
    this.goTo(x, z, this.cfg.monster.prowl);
    this.invPos = { x, z };
    this.audio.monsterGrowl(this.pos, 0.6);
  }

  startCheck(spot, thorough) {
    this.spot = spot;
    this.thorough = thorough;
    this.setState('checkGo');
    this.goTo(spot.check.x, spot.check.z, thorough ? this.cfg.monster.prowl * 1.25 : this.cfg.monster.prowl);
  }

  visionCheck(dt) {
    const g = this.game, pl = g.player;
    if (pl.hidden || pl.entering) {
      this.awareness = Math.max(0, this.awareness - dt * 0.3);
      return false;
    }
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const cf = this.cfg.monster;
    // how visible is the player right now
    let vis = pl.crouch ? 0.55 : 1;
    if (pl.flashlight) {
      vis *= 1.35;
      if (pl.beamOn(this.head)) vis *= 1.5;
    }
    if (pl.sprinting) vis *= 1.25;
    vis += g.lightAt(pl.pos.x, pl.pos.z) * 0.6;
    const range = cf.sight * vis * (1 + g.hour * 0.05);
    let seen = false;
    if (d < range) {
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - (this.yaw + this.model.lookYaw * 0.8)));
      const inCone = ang < 1.05 || d < 2.2;
      if (inCone && this.nav.los(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z, pl.crouch)) {
        seen = true;
        this.awareness += dt * (2.4 * (1 - d / range) + 0.35) * (this.state === 'chase' ? 3 : 1);
        this.lastSeen.copy(pl.pos);
        this.lastSeenT = g.time;
      }
    }
    if (!seen) this.awareness = Math.max(0, this.awareness - dt * 0.22);
    this.awareness = Math.min(this.awareness, 1.2);
    return seen;
  }

  // ------------------------------------------------------------- update
  update(dt) {
    const g = this.game, pl = g.player, cf = this.cfg.monster, M = this.model;
    this.timer -= dt;
    const dP = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    this.distToPlayer = dP;
    // director menace: high when close / chasing, decays slowly
    const near = dP < 9 ? 1 - dP / 9 : 0;
    this.menace = clamp(this.menace + (near * 0.25 + (this.state === 'chase' ? 0.35 : 0)) * dt - dt * 0.035, 0, 1);

    this.head.set(this.pos.x, 2.05 - M.w.peer * 0.95, this.pos.z);
    let seen = false;
    const canSee = !['dormant', 'grab', 'leave', 'gone', 'alert'].includes(this.state);
    if (canSee) seen = this.visionCheck(dt);

    switch (this.state) {
      case 'dormant':
        this.speed = 0;
        if (this.timer <= 0) {
          // arrive somewhere far away and out of sight
          let best = null, bd = -1;
          for (const q of this.lvl.pois) {
            const d = Math.hypot(q.x - pl.pos.x, q.z - pl.pos.z);
            const seenBy = !pl.hidden && this.nav.los(q.x, q.z, pl.pos.x, pl.pos.z);
            const score = d - (seenBy ? 100 : 0) + R() * 6;
            if (score > bd) { bd = score; best = q; }
          }
          const p = this.nav.nearestWalkable(best.x, best.z);
          this.pos.set(p.x, 0, p.z);
          this.model.root.visible = true;
          this.setState('wander');
          this.audio.distantBang(p.x, p.z);
        }
        break;

      case 'wander': {
        if (!this.path) {
          const q = this.choosePoi();
          this.goTo(q.x, q.z, cf.walk * (1 + g.hour * 0.04));
          this.poiArea = q.area;
        }
        if (this.follow(dt)) this.setState('linger', R.range(2, 5));
        // scheduled visit to the player's spot
        if (pl.hidden && pl.hidden.kind === 'hole' && g.time > this.nextHoleVisit && g.time > this.reliefUntil) {
          this.nextHoleVisit = g.time + R.range(60, 105) / (1 + g.hour * 0.12);
          this.startCheck(pl.hidden, false);
        }
        this.awarenessReact(seen);
        break;
      }

      case 'linger':
        this.follow(dt);
        M.set('sniff', Math.sin(g.time * 0.8) > 0.2 ? 1 : 0);
        if (Math.random() < dt * 0.3) this.audio.monsterSniff(this.pos);
        if (this.timer <= 0) this.setState('wander');
        this.awarenessReact(seen);
        break;

      case 'investigate':
        if (this.follow(dt)) {
          this.setState('looking', R.range(3, 5.5));
          this.audio.monsterSniff(this.pos);
        }
        this.awarenessReact(seen);
        break;

      case 'looking':
        this.speed = damp(this.speed, 0, 5, dt);
        M.set('sniff', 1);
        this.yaw += Math.sin(g.time * 1.3) * dt * 0.9;
        if (Math.random() < dt * 0.6) this.audio.monsterSniff(this.pos);
        if (this.timer <= 0) {
          // maybe check a nearby hiding spot
          const spot = this.nearestSpot(this.pos.x, this.pos.z, 7);
          if (spot && R() < 0.55) this.startCheck(spot, false);
          else this.setState('wander');
        }
        this.awarenessReact(seen);
        break;

      case 'alert':
        this.speed = damp(this.speed, 0, 8, dt);
        this.faceToward(pl.pos.x, pl.pos.z, dt, 10);
        M.set('scream', this.timer > 0.25 ? 1 : 0);
        M.lookTarget = pl.eye;
        if (this.timer <= 0) {
          this.setState('chase');
          this.repathT = 0;
          this.lostT = 0;
        }
        break;

      case 'chase': {
        const runSpeed = cf.run + g.hour * cf.runPerHour;
        M.lookTarget = seen ? pl.eye : null;
        if (seen) this.lostT = 0;
        else this.lostT += dt;
        this.repathT -= dt;
        if (this.repathT <= 0) {
          const tgt = seen ? pl.pos : this.lastSeen;
          if (seen && this.nav.clear(this.pos.x, this.pos.z, tgt.x, tgt.z)) {
            this.path = [{ x: tgt.x, z: tgt.z }];
            this.pathIdx = 0;
            this.targetSpeed = runSpeed;
          } else this.goTo(tgt.x, tgt.z, runSpeed);
          this.repathT = seen ? 0.15 : 0.4;
        }
        this.follow(dt);
        if (Math.random() < dt * 0.5) this.audio.monsterGrowl(this.pos, 1);
        // caught
        if (dP < 1.05 && !pl.hidden && !pl.entering) {
          this.grab();
          break;
        }
        // watched the player duck into a hiding spot
        if ((pl.hidden || pl.entering) && g.time - this.lastSeenT < 0.9 && dP < 13) {
          this.startCheck(pl.hidden || pl.entering, true);
          break;
        }
        if (this.lostT > 3.6 || (!this.path && !seen)) {
          this.setState('search');
          this.goTo(this.lastSeen.x, this.lastSeen.z, cf.prowl);
          M.lookTarget = null;
        }
        break;
      }

      case 'search':
        if (this.follow(dt)) {
          this.setState('searchLook', R.range(2.5, 4));
          const spots = this.lvl.hides
            .map((h) => [h, Math.hypot(h.check.x - this.pos.x, h.check.z - this.pos.z)])
            .filter(([, d]) => d < 11)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 2)
            .map(([h]) => h);
          this.checkQueue = spots;
        }
        this.awarenessReact(seen, true);
        break;

      case 'searchLook':
        this.speed = damp(this.speed, 0, 5, dt);
        M.set('sniff', 1);
        this.yaw += Math.sin(g.time * 1.7) * dt * 1.2;
        if (Math.random() < dt * 0.7) this.audio.monsterSniff(this.pos);
        if (this.timer <= 0) {
          const next = this.checkQueue.shift();
          if (next) this.startCheck(next, false);
          else {
            this.reliefUntil = g.time + 25;
            this.setState('wander');
          }
        }
        this.awarenessReact(seen, true);
        break;

      case 'checkGo': {
        const arrived = this.follow(dt);
        if (arrived || (this.path === null && Math.hypot(this.spot.check.x - this.pos.x, this.spot.check.z - this.pos.z) < 0.8)) {
          const dur = this.thorough ? R.range(8, 10.5) : this.spot.kind === 'hole' ? R.range(6, 8.5) : R.range(4, 6);
          this.setState('check', dur);
          this.checkT = 0;
          this.checksDone = (this.checksDone || 0) + 1;
          this.suspicion = this.thorough ? 0.2 : 0;
          this.audio.monsterSniff(this.pos);
        }
        this.awarenessReact(seen);
        break;
      }

      case 'check': {
        const sp = this.spot;
        this.speed = damp(this.speed, 0, 6, dt);
        this.faceToward(sp.cam.x, sp.cam.z, dt, 5);
        const low = sp.kind !== 'locker';
        const t = this.timer;
        // peer in, back off, peer again; sniff the whole time
        M.set('peer', low ? (Math.sin(t * 0.9) > -0.3 ? 1 : 0.55) : 0);
        M.set('sniff', 1);
        M.lookTarget = this._look.copy(sp.cam);
        if (Math.random() < dt * 1.1) this.audio.monsterSniff(this.pos);
        // hearing the hidden player breathe
        this.checkT += dt;
        if (pl.hidden === sp) {
          const dd = Math.hypot(this.pos.x - sp.cam.x, this.pos.z - sp.cam.z);
          const rad = pl.breathNoise;
          // it takes a moment to settle and listen; the first visits are gentler
          const settle = this.checkT < 2.2 ? 0.45 : 1;
          const learn = this.checksDone <= 2 && !this.thorough ? 0.6 : 1;
          if (rad > dd * 0.6) this.suspicion += dt * (0.62 * (1 - (dd * 0.6) / rad) + 0.14) * (this.thorough ? 1.45 : 1) * settle * learn;
          else this.suspicion = Math.max(0, this.suspicion - dt * 0.2);
          if (this.thorough) this.suspicion += dt * 0.03;
          if (pl.peeking && dd < 3) this.suspicion += dt * 0.6;
          if (!this._closeFlag) { this._closeFlag = true; this.closeCalls++; }
          if (this.suspicion >= 1) {
            this.grab();
            break;
          }
        } else if (!pl.hidden && seen && dP < 6) {
          this.alert();
          break;
        }
        if (this.timer <= 0) {
          this._closeFlag = false;
          this.suspicion = 0;
          M.lookTarget = null;
          const next = this.checkQueue.shift();
          if (next) this.startCheck(next, false);
          else {
            this.reliefUntil = g.time + (this.spot.kind === 'hole' ? 40 : 25);
            this.setState('wander');
            this.audio.monsterGrowl(this.pos, 0.4);
          }
        }
        break;
      }

      case 'grab': {
        this.speed = 0;
        M.set('reach', 1);
        M.set('scream', 1);
        M.lookTarget = pl.eye;
        if (!pl.hidden) this.faceToward(pl.pos.x, pl.pos.z, dt, 14);
        break;
      }

      case 'leave':
        if (this.follow(dt)) {
          this.state = 'gone';
          this.model.root.visible = false;
        }
        break;
      case 'gone':
        break;
    }

    // stuck detection while trying to move
    if (this.path && this.targetSpeed > 0.5) {
      const moved = this.pos.distanceTo(this.lastPos);
      if (moved < 0.15 * dt * this.targetSpeed) this.stuckT += dt;
      else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > 1.2) {
        const last = this.path[this.path.length - 1];
        this.goTo(last.x, last.z, this.targetSpeed);
        if (!this.path) this.setState('wander');
        this.stuckT = 0;
      }
    }
    this.lastPos.copy(this.pos);

    // voice: breathing rasps / growls
    this.voiceT -= dt;
    if (this.voiceT <= 0 && this.state !== 'dormant' && this.state !== 'gone') {
      this.audio.monsterBreath(this.pos, this.state === 'chase' ? 1 : 0.5);
      this.voiceT = this.state === 'chase' ? R.range(0.8, 1.6) : R.range(2.2, 4.5);
    }

    if (this.state !== 'check' && this.state !== 'alert' && this.state !== 'chase' && this.state !== 'grab' && M.lookTarget && this.awareness < 0.3) M.lookTarget = null;
    M.update(dt, this.speed);
    this.place();
  }

  awarenessReact(seen, alerted = false) {
    const pl = this.game.player;
    if (this.awareness >= 1) {
      this.alert();
      return;
    }
    if (seen && this.awareness > 0.3) {
      this.model.lookTarget = pl.eye;
      if (this.awareness > (alerted ? 0.4 : 0.55) && this.state !== 'investigate') {
        this.investigate(pl.pos.x, pl.pos.z);
        this.model.lookTarget = pl.eye;
      }
    }
  }

  alert() {
    this.setState('alert', 0.75);
    this.awareness = 1;
    this.audio.monsterScream(this.pos);
    this.game.onSpotted();
  }

  grab() {
    if (this.state === 'grab') return;
    this.setState('grab', 99);
    this.audio.monsterScream(this.pos, true);
    this.game.onGrabbed(this);
  }

  leave() {
    let far = this.lvl.pois[0], bd = -1;
    for (const q of this.lvl.pois) {
      const d = Math.hypot(q.x - this.game.player.pos.x, q.z - this.game.player.pos.z);
      if (d > bd) { bd = d; far = q; }
    }
    this.setState('leave');
    this.goTo(far.x, far.z, this.cfg.monster.prowl);
  }

  nearestSpot(x, z, maxD) {
    let best = null, bd = maxD;
    for (const h of this.lvl.hides) {
      const d = Math.hypot(h.check.x - x, h.check.z - z);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  get hunting() {
    return this.state === 'chase' || this.state === 'alert';
  }
}
