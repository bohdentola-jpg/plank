// Bot brains: grid navigation + a small utility-style decision maker.
import * as THREE from 'three';
import { clamp, rand, chance, pick } from '../util.js';

const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3();

export const BOT_NAMES = ['Blip', 'Mochi', 'Tidal', 'Zest', 'Pip', 'Drizzle', 'Kiki', 'Juno', 'Bix', 'Sprout', 'Glim', 'Rio', 'Taffy', 'Moss', 'Pico', 'Fizz', 'Lumen', 'Yuzu', 'Wren', 'Coco', 'Dot', 'Jinx', 'Nori', 'Suki', 'Bubbles', 'Marlo', 'Tango', 'Vee', 'Puddle', 'Ziggy'];

export const SKILL = {
  easy: { react: 0.65, aimErr: 0.16, fireChance: 0.65, think: 0.4, lead: 0.3, bomb: 0.08 },
  normal: { react: 0.38, aimErr: 0.085, fireChance: 0.85, think: 0.28, lead: 0.7, bomb: 0.16 },
  hard: { react: 0.2, aimErr: 0.045, fireChance: 1, think: 0.18, lead: 1, bomb: 0.25 },
};

// ------------------------------------------------------------------ nav grid
export class NavGrid {
  constructor(level, bounds, cell = 1) {
    this.level = level;
    this.cell = cell;
    this.x0 = bounds.minX; this.z0 = bounds.minZ;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    const N = this.w * this.h;
    this.hgt = new Float32Array(N);
    this.solid = new Array(N);
    this.edge = new Uint8Array(N);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.x0 + (i + 0.5) * cell, z = this.z0 + (j + 0.5) * cell;
      const r = level.heightAt(x, z);
      const k = j * this.w + i;
      this.hgt[k] = r.solid && r.y > level.killY ? r.y : -Infinity;
      this.solid[k] = r.solid;
      // corner variation => cell straddles a ledge
      let mn = Infinity, mx = -Infinity;
      for (const [ox, oz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
        const y = level.heightAt(x + ox * cell, z + oz * cell).y;
        mn = Math.min(mn, y); mx = Math.max(mx, y);
      }
      if (mx - mn > 0.6 || !Number.isFinite(mn)) this.edge[k] = 1;
    }
    // cells next to the void are risky
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const k = j * this.w + i;
      if (!Number.isFinite(this.hgt[k])) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h || !Number.isFinite(this.hgt[jj * this.w + ii])) { this.edge[k] = 2; break; }
      }
    }
    this.open = new Float32Array(N);
    this.g = new Float32Array(N);
    this.parent = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closedStamp = new Uint32Array(N);
    this.run = 0;
  }

  idx(x, z, clampToGrid = true) {
    let i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (!clampToGrid && (i < 0 || j < 0 || i >= this.w || j >= this.h)) return -1;
    i = clamp(i, 0, this.w - 1); j = clamp(j, 0, this.h - 1);
    return j * this.w + i;
  }
  center(k, out) {
    const i = k % this.w, j = Math.floor(k / this.w);
    return out.set(this.x0 + (i + 0.5) * this.cell, this.hgt[k], this.z0 + (j + 0.5) * this.cell);
  }
  walkable(k) { return k >= 0 && Number.isFinite(this.hgt[k]); }

  step(a, b) {
    const ha = this.hgt[a], hb = this.hgt[b];
    if (!Number.isFinite(hb)) return -1;
    const dh = hb - ha;
    if (dh > 1.05) return -1;
    return dh > 0.5 ? 2.2 : 0;
  }

  // A* over 8-connected cells. Returns array of Vector3 (with .jump flag) or null.
  path(from, to, maxIter = 6000) {
    let s = this.idx(from.x, from.z), t = this.idx(to.x, to.z);
    if (!this.walkable(t)) return null;
    if (!this.walkable(s)) s = this.nearestWalkable(s);
    if (s < 0) return null;
    const run = ++this.run;
    const W = this.w;
    const heap = [];
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const tx = t % W, tz = Math.floor(t / W);
    const hfn = (k) => { const dx = Math.abs(k % W - tx), dz = Math.abs(Math.floor(k / W) - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    this.stamp[s] = run; this.g[s] = 0; this.parent[s] = -1;
    push(s, hfn(s));
    let iter = 0, found = false;
    while (heap.length && iter++ < maxIter) {
      const [, k] = pop();
      if (this.closedStamp[k] === run) continue;
      this.closedStamp[k] = run;
      if (k === t) { found = true; break; }
      const ki = k % W, kj = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ki + di, nj = kj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const n = nj * W + ni;
        if (this.closedStamp[n] === run) continue;
        const extra = this.step(k, n);
        if (extra < 0) continue;
        if (di && dj) {
          if (this.step(k, kj * W + ni) < 0 || this.step(k, nj * W + ki) < 0) continue;
          if (Math.abs(this.hgt[kj * W + ni] - this.hgt[k]) > 0.3 || Math.abs(this.hgt[nj * W + ki] - this.hgt[k]) > 0.3) continue;
        }
        const base = di && dj ? 1.414 : 1;
        const cost = base + extra + (this.edge[n] === 2 ? 2.5 : this.edge[n] ? 0.6 : 0);
        const g = this.g[k] + cost;
        if (this.stamp[n] !== run || g < this.g[n]) {
          this.stamp[n] = run; this.g[n] = g; this.parent[n] = k;
          push(n, g + hfn(n));
        }
      }
    }
    if (!found) return null;
    const out = [];
    for (let k = t; k !== -1; k = this.parent[k]) {
      const p = this.center(k, new THREE.Vector3());
      p.k = k;
      out.push(p);
    }
    out.reverse();
    for (let i = 1; i < out.length; i++) out[i].jump = out[i].y - out[i - 1].y > 0.45;
    return this.simplify(out);
  }

  // drop intermediate points on straight, flat runs
  simplify(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      const flat = Math.abs(b.y - a.y) < 0.05 && Math.abs(c.y - b.y) < 0.05;
      const dx1 = b.x - a.x, dz1 = b.z - a.z, dx2 = c.x - b.x, dz2 = c.z - b.z;
      const straight = Math.abs(dx1 * dz2 - dz1 * dx2) < 1e-6;
      if (!(flat && straight) || b.jump) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  nearestWalkable(k) {
    const W = this.w;
    const ki = k % W, kj = Math.floor(k / W);
    for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const ni = ki + di, nj = kj + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
      const n = nj * W + ni;
      if (this.walkable(n) && !this.edge[n]) return n;
    }
    return -1;
  }

  randomCell(filter, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const k = Math.floor(Math.random() * this.w * this.h);
      if (this.walkable(k) && this.edge[k] !== 2 && (!filter || filter(k))) return k;
    }
    return -1;
  }
}

// ------------------------------------------------------------------ bot brain
export class Bot {
  constructor(fighter, world, nav, skill = 'normal') {
    this.f = fighter;
    this.world = world;
    this.nav = nav;
    this.sk = SKILL[skill] || SKILL.normal;
    this.path = null; this.pi = 0;
    this.goal = null;
    this.mode = 'paint';
    this.thinkT = rand(0, 0.3);
    this.target = null; this.seenT = 0; this.reactT = 0;
    this.strafe = chance(0.5) ? 1 : -1; this.strafeT = 0;
    this.stuckT = 0; this.lastPos = new THREE.Vector3(); this.progressT = 0;
    this.sweep = rand(0, 6);
    this.aim = new THREE.Vector3();
    this.aimErr = new THREE.Vector3();
    this.errT = 0;
    this.goalT = 0;
    this.specialT = rand(2, 6);
    this.chargeHold = 0;
    this.prefer = { shooter: 7, blaster: 6.5, roller: 1.5, charger: 19 }[fighter.weapon.type];
    this.homeZ = fighter.spawnPoint.z || (fighter.team === 1 ? -36 : 36);
    this.enemyBaseZ = -this.homeZ;
  }

  enemyVisible(e) {
    const f = this.f;
    _v.set(f.pos.x, f.pos.y + 1.2, f.pos.z);
    _e.set(e.pos.x, e.pos.y + e.hitHeight() * 0.6, e.pos.z);
    return this.world.level.visible(_v, _e);
  }

  findTarget() {
    const f = this.f;
    let best = null, bd = Infinity;
    const range = (this.prefer + 9) * (this.f.weapon.type === 'charger' ? 1.2 : 1);
    for (const e of this.world.fighters) {
      if (!e.alive || e.team === f.team) continue;
      const d = e.pos.distanceTo(f.pos);
      if (d > range) continue;
      // submerged & still enemies are hard to spot
      if (e.submerged && Math.hypot(e.vel.x, e.vel.z) < 4 && d > 4) continue;
      if (d < bd && this.enemyVisible(e)) { bd = d; best = e; }
    }
    return best;
  }

  ownerAround(p) {
    const r = this.world.level.heightAt(p.x, p.z);
    if (!r.solid?.sideFace?.top) return -1;
    _t.set(p.x, r.y, p.z);
    return this.world.paint.ownerAt(r.solid.sideFace.top, _t);
  }

  pickPaintGoal() {
    const f = this.f, nav = this.nav;
    let best = -1, bs = -Infinity;
    for (let i = 0; i < 24; i++) {
      const k = nav.randomCell();
      if (k < 0) continue;
      nav.center(k, _t);
      const d = _t.distanceTo(f.pos);
      if (d < 5 || d > 34) continue;
      const own = this.ownerAround(_t);
      let s = own === f.team ? -6 : own === 0 ? 4 : 6;
      // advance toward enemy side but not into their base
      const prog = (_t.z - this.homeZ) / (this.enemyBaseZ - this.homeZ);
      s += clamp(prog, 0, 0.8) * 5 - (prog > 0.85 ? 8 : 0);
      s -= d * 0.08;
      s += rand(0, 3);
      if (s > bs) { bs = s; best = k; }
    }
    if (best < 0) return false;
    return this.goTo(nav.center(best, new THREE.Vector3()));
  }

  pickRefillGoal() {
    const f = this.f, nav = this.nav;
    let best = null, bd = Infinity;
    for (let i = 0; i < 30; i++) {
      const k = nav.randomCell();
      if (k < 0) continue;
      nav.center(k, _t);
      const d = _t.distanceTo(f.pos);
      if (d > 16) continue;
      if (this.ownerAround(_t) === f.team && d < bd) { bd = d; best = _t.clone(); }
    }
    if (!best) {
      // fall back toward base
      best = new THREE.Vector3(f.pos.x * 0.5, f.pos.y, this.homeZ * 0.8);
    }
    return this.goTo(best);
  }

  goTo(p) {
    const path = this.nav.path(this.f.pos, p);
    if (!path || path.length < 2) return false;
    this.path = path; this.pi = 1; this.goal = p.clone(); this.goalT = 0;
    return true;
  }

  update(dt) {
    const f = this.f, w = this.world, I = f.intent;
    I.jump = false; I.sub = false; I.special = false; I.firePressed = false;
    if (!f.alive) { this.path = null; this.target = null; I.fire = false; return; }
    if (!w.combatOn) { I.mx = I.mz = 0; I.fire = false; I.goo = false; return; }
    this.thinkT -= dt;
    this.goalT += dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.sk.think * rand(0.8, 1.2);
      const t = this.findTarget();
      if (t !== this.target) { this.reactT = t ? this.sk.react * rand(0.7, 1.3) : 0; this.target = t; }
      if (t) this.seenT = 0;
      const prev = this.mode;
      if (f.ink < Math.max(0.14, f.weapon.type === 'charger' ? f.weapon.ink : 0) && !(this.target && f.weapon.type === 'roller' && f.ink > 0.05)) this.mode = 'refill';
      else if (this.mode === 'refill' && f.ink < 0.85 && !(this.target && this.target.pos.distanceTo(f.pos) < 5)) this.mode = 'refill';
      else if (this.target) this.mode = f.hp < 35 && f.ink < 0.3 ? 'retreat' : 'fight';
      else this.mode = 'paint';
      if (this.mode !== prev) { this.path = null; }
      if (this.mode === 'paint' && (!this.path || this.pi >= this.path.length || this.goalT > 9)) this.pickPaintGoal();
      if (this.mode === 'refill' && (!this.path || this.pi >= this.path.length) && this.ownerAround(f.pos) !== f.team) this.pickRefillGoal();
      if (this.mode === 'retreat' && !this.path) this.goTo(new THREE.Vector3(f.pos.x * 0.6, 0, this.homeZ * 0.85));
      if (this.mode === 'fight') this.planFight();
      // special
      if (f.specialReady) {
        this.specialT -= this.sk.think;
        if (this.specialT <= 0 && (this.target || chance(0.15))) { I.special = true; this.specialT = rand(1, 4); }
      }
    }
    this.reactT -= dt;
    // ---- movement along path
    let mx = 0, mz = 0;
    if (this.path && this.pi < this.path.length) {
      const wp = this.path[this.pi];
      const dx = wp.x - f.pos.x, dz = wp.z - f.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < (this.pi === this.path.length - 1 ? 0.8 : 0.55)) this.pi++;
      else {
        mx = dx / d; mz = dz / d;
        if (wp.jump && d < 1.6 && f.onGround && wp.y - f.pos.y > 0.4) I.jump = true;
      }
    }
    // ---- stuck handling
    this.progressT += dt;
    if (this.progressT > 1.0) {
      const moved = this.lastPos.distanceTo(f.pos);
      if ((mx || mz) && moved < 0.5) {
        this.stuckT++;
        I.jump = true;
        if (this.stuckT > 2) { this.path = null; this.stuckT = 0; this.goalT = 99; }
      } else this.stuckT = 0;
      this.lastPos.copy(f.pos);
      this.progressT = 0;
    }
    // ---- behaviour per mode
    let fire = false, goo = false;
    const type = f.weapon.type;
    if (this.mode === 'fight' && this.target && this.target.alive) {
      const e = this.target;
      const dist = e.pos.distanceTo(f.pos);
      // strafe around the preferred distance
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rand(0.6, 1.6); if (chance(0.5)) this.strafe *= -1; if (chance(0.15) && f.onGround) I.jump = true; }
      const ex = (e.pos.x - f.pos.x) / (dist || 1), ez = (e.pos.z - f.pos.z) / (dist || 1);
      let adv = dist > this.prefer + 1.5 ? 1 : dist < this.prefer - 2 ? -0.8 : 0;
      if (type === 'roller') adv = 1;
      if (!this.path || this.pi >= this.path.length) { mx = ex * adv - ez * this.strafe * 0.8; mz = ez * adv + ex * this.strafe * 0.8; }
      // aim with lead + error
      const lead = type === 'charger' ? 0 : dist / 30 * this.sk.lead;
      this.errT -= dt;
      if (this.errT <= 0) {
        this.errT = rand(0.2, 0.5);
        const m = this.sk.aimErr * dist;
        this.aimErr.set(rand(-m, m), rand(-m, m) * 0.6, rand(-m, m));
      }
      this.aim.set(e.pos.x + e.vel.x * lead, e.pos.y + e.hitHeight() * 0.55 + e.vel.y * lead * 0.5, e.pos.z + e.vel.z * lead).add(this.aimErr);
      const canShoot = this.reactT <= 0 && dist < this.prefer + 7;
      if (type === 'charger') {
        const cap = f.ink >= f.weapon.ink ? 0.98 : 0.39; // low ink caps the charge — release at the cap
        if (canShoot) { fire = f.charge < cap || this.chargeHold < 0.15; this.chargeHold = f.charge >= cap ? this.chargeHold + dt : 0; }
        if (f.charging) { mx *= 0.3; mz *= 0.3; }
      } else if (type === 'roller') {
        fire = canShoot && (dist < 3.2 || Math.random() < 0.05);
        if (dist > 3.2 && dist < 6.5 && canShoot && f.flickCd <= 0 && chance(0.08)) { fire = true; }
      } else fire = canShoot && Math.random() < this.sk.fireChance + 0.1;
      // bombs
      if (dist > 5 && dist < 13 && f.ink > 0.8 && chance(this.sk.bomb * dt * 2)) I.sub = true;
    } else {
      // painting / travelling: aim at the floor ahead and sweep
      this.sweep += dt * (type === 'charger' ? 1.2 : 3.2);
      const yaw = Math.atan2(mx || Math.sin(f.yaw), mz || Math.cos(f.yaw)) + Math.sin(this.sweep) * 0.6;
      const reach = type === 'charger' ? 16 : type === 'blaster' ? 8 : 5;
      this.aim.set(f.pos.x + Math.sin(yaw) * reach, f.pos.y, f.pos.z + Math.cos(yaw) * reach);
      const aheadOwn = this.ownerAround(this.aim) === f.team;
      const hereOwn = f.surface === f.team;
      if (this.mode === 'refill') {
        goo = hereOwn || (f.ink < 0.02);
        if (hereOwn && f.ink < 0.85) { mx *= 0.2; mz *= 0.2; if (!this.path || this.pi >= this.path.length) { mx = 0; mz = 0; } }
      } else if (this.mode === 'retreat') {
        goo = true;
      } else {
        if (type === 'roller') fire = f.ink > 0.05 && !(hereOwn && aheadOwn && chance(0.6));
        else if (type === 'charger') fire = !aheadOwn && f.ink > 0.3 && (f.charge < 0.6 || chance(0.5));
        else fire = !aheadOwn && f.ink > 0.1;
        if (hereOwn && aheadOwn && !fire) goo = true;
        if (f.ink < 0.35 && hereOwn) goo = true;
      }
    }
    if (fire) goo = false;
    // never walk off the map: check the cell we're heading into
    if (mx || mz) {
      const k = this.nav.idx(f.pos.x + mx * 0.9, f.pos.z + mz * 0.9, false);
      if (!this.nav.walkable(k) || this.nav.edge[k] === 2 && !this.path) { if (!this.nav.walkable(k)) { mx = -mx * 0.3; mz = -mz * 0.3; this.path = null; } }
    }
    const l = Math.hypot(mx, mz);
    if (l > 1) { mx /= l; mz /= l; }
    I.mx = mx; I.mz = mz;
    I.goo = goo;
    I.fire = fire;
    // aim angles
    _v.set(f.pos.x, f.pos.y + 1.2, f.pos.z);
    _e.subVectors(this.aim, _v);
    const hd = Math.hypot(_e.x, _e.z);
    I.aimYaw = Math.atan2(_e.x, _e.z);
    I.aimPitch = Math.atan2(_e.y, hd);
    I.aimPoint = this.mode === 'fight' ? (I.aimPoint || new THREE.Vector3()).copy(this.aim) : null;
  }

  planFight() {
    const f = this.f;
    if (!this.target) return;
    const dist = this.target.pos.distanceTo(f.pos);
    if (dist > this.prefer + 6 || (f.weapon.type === 'roller' && dist > 2)) {
      if (!this.path || this.goalT > 1.2) this.goTo(this.target.pos);
    } else this.path = null;
  }
}

export function botNames(n, exclude = []) {
  const pool = BOT_NAMES.filter((x) => !exclude.includes(x));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
export { pick };
