// The AI. One state machine, twelve behaviour flags, eighteen very different
// monsters.
//
// Pathing is a breadth-first flow field flooded out from the player's cell a few
// times a second — cheap on a 20,000-cell grid and it means every hunting thing
// in the level knows the way to you without any of them running A*. Senses are
// honest: sight needs line of sight, a field of view and enough light; hearing
// reads the player's noise value and the inverse-square of the distance. A hound
// has no sight at all, a mannequin has nothing but sight, and both work.

import * as THREE from 'three';
import { SPECIES, buildCreature } from './bestiary.js';
import { clamp, clamp01, damp, wrapAngle } from './util.js';
import { WET } from './kit.js';

const FLOW_EVERY = 0.28;     // seconds between flow-field rebuilds
const ACTIVE_RANGE = 70;     // metres — beyond this a creature is frozen

let nextId = 1;

class Creature {
  constructor(rec, game) {
    const sp = SPECIES[rec.type];
    this.id = nextId++;
    this.type = rec.type;
    this.sp = sp;
    this.game = game;
    this.rec = rec;
    const w = game.world;
    this.home = { x: rec.x * w.cell, z: rec.z * w.cell };
    this.pos = { x: this.home.x, y: w.floorAtWorld(this.home.x, this.home.z), z: this.home.z };
    this.vel = { x: 0, z: 0 };
    this.yaw = Math.random() * 6.28;
    this.state = rec.state === 'dormant' ? 'dormant' : rec.state || 'patrol';
    this.leash = (rec.leash || 0) * w.cell;
    this.speed = rec.speed ?? sp.speed;
    this.hp = rec.hp ?? sp.hp;
    this.alert = 0;               // 0..1 — how sure it is about you
    this.cool = 0;                // attack cooldown
    this.lostFor = 0;
    this.wander = { x: this.home.x, z: this.home.z, t: 0 };
    this.cycle = Math.random() * 6.28;
    this.mesh = null;
    this.visible = false;
    this.screamT = 0;
    this.age = 0;
    this.frozen = false;
    this.dead = false;
    this.observed = false;
    this.stareT = 0;
    this.mimicT = 0;
  }

  ensureMesh() {
    if (this.mesh) return;
    this.mesh = buildCreature(this.type);
    this.game.scene.add(this.mesh);
  }

  dropMesh() {
    if (!this.mesh) return;
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => o.geometry?.dispose?.());
    this.mesh = null;
  }

  // ---------------------------------------------------------------- senses
  senseHearing(dist) {
    const p = this.game.player;
    const hear = this.sp.senses.hearing;
    if (!hear) return 0;
    const noise = Math.max(p.noise, this.game.noiseBoost || 0);
    if (noise <= 0.02) return 0;
    const range = hear * this.game.world.cell * (0.4 + noise);
    if (dist > range) return 0;
    return clamp01((1 - dist / range) * (0.35 + noise));
  }

  senseSight(dist) {
    const sp = this.sp;
    if (!sp.senses.sight) return 0;
    const w = this.game.world;
    const p = this.game.player;
    const range = sp.senses.sight * w.cell;
    if (dist > range) return 0;
    if (!w.sightClear(this.pos.x, this.pos.z, p.pos.x, p.pos.z)) return 0;
    // does it face the player?
    const toP = Math.atan2(-(p.pos.x - this.pos.x), -(p.pos.z - this.pos.z));
    const off = Math.abs(wrapAngle(toP - this.yaw));
    if (off > sp.senses.fov / 2) return 0;
    // light matters: a torch beam or a lit room gives you away
    const lit = clamp01(w.lightAt(p.pos.x, p.pos.z) * 1.6 + (this.game.lampOn ? 0.5 : 0) + 0.12);
    return clamp01((1 - dist / range) * (0.4 + lit));
  }

  // Is the player looking at this creature right now? (mannequins, watchers)
  isObserved() {
    const g = this.game;
    const p = g.player;
    const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 60) return false;
    if (!g.world.sightClear(p.pos.x, p.pos.z, this.pos.x, this.pos.z)) return false;
    const toE = Math.atan2(-dx, -dz);
    return Math.abs(wrapAngle(toE - p.yaw)) < 0.62;
  }

  // ---------------------------------------------------------------- movement
  stepToward(tx, tz, dt, speed) {
    const w = this.game.world;
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantX = (dx / d) * speed, wantZ = (dz / d) * speed;
    this.vel.x = damp(this.vel.x, wantX, 6, dt);
    this.vel.z = damp(this.vel.z, wantZ, 6, dt);
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const canGo = (x, z) => {
      if (w.solidAtWorld(x, z, this.pos.y)) return false;
      if (this.sp.flags.needsWater && !w.waterDepthAt(x, z)) return false;
      if (this.sp.flags.needsDeep && !w.isDeepAt(x, z)) return false;
      const fy = w.floorAtWorld(x, z);
      return this.sp.flags.flies || this.sp.flags.swims || Math.abs(fy - this.pos.y) < 0.9;
    };
    if (canGo(nx, this.pos.z)) this.pos.x = nx; else this.vel.x *= -0.2;
    if (canGo(this.pos.x, nz)) this.pos.z = nz; else this.vel.z *= -0.2;
    const targetY = this.sp.flags.flies
      ? w.floorAtWorld(this.pos.x, this.pos.z) + 1.6 + Math.sin(this.cycle * 2) * 0.25
      : this.sp.flags.swims
        ? (w.waterY ?? 0) - (this.sp.flags.needsDeep ? 1.4 : 0.5)
        : w.floorAtWorld(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, targetY, 8, dt);
    if (Math.hypot(this.vel.x, this.vel.z) > 0.05) {
      this.yaw = damp(this.yaw, Math.atan2(-this.vel.x, -this.vel.z), 6, dt) || this.yaw;
    }
  }

  // Walk downhill on the flow field — every hunting creature's route to you.
  huntStep(dt, speed) {
    const g = this.game;
    const w = g.world;
    const flow = g.entities.flow;
    const [cx, cz] = w.toCell(this.pos.x, this.pos.z);
    let best = null, bestD = Infinity;
    const here = flow[w.idx(cx, cz)] ?? -1;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (!w.inside(nx, nz)) continue;
      const v = flow[w.idx(nx, nz)];
      if (v < 0) continue;
      if (this.sp.flags.needsDeep && !w.isDeepAt(nx * w.cell, nz * w.cell)) continue;
      if (this.sp.flags.needsWater && !w.waterDepthAt(nx * w.cell, nz * w.cell)) continue;
      if (v < bestD) { bestD = v; best = [nx, nz]; }
    }
    if (best && (here < 0 || bestD < here + 1)) {
      const [wx, wz] = w.toWorld(best[0], best[1]);
      this.stepToward(wx, wz, dt, speed);
    } else {
      // no route (or it flies / swims straight at you): go direct
      this.stepToward(g.player.pos.x, g.player.pos.z, dt, speed);
    }
  }

  // ---------------------------------------------------------------- brain
  update(dt) {
    const g = this.game;
    const w = g.world;
    const p = g.player;
    this.age += dt;
    this.cycle += dt * (2 + this.speed * 0.4);
    this.cool = Math.max(0, this.cool - dt);
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const flags = this.sp.flags;

    // frozen when far away: no thinking, no mesh
    if (dist > ACTIVE_RANGE) {
      this.frozen = true;
      this.dropMesh();
      return;
    }
    this.frozen = false;
    this.ensureMesh();

    // waking up
    if (this.state === 'dormant') {
      const wake = this.rec.wake;
      let up = false;
      if (wake?.after !== undefined) up = g.levelTime > wake.after;
      else if (wake?.objective) up = g.isObjectiveDone(wake.objective);
      if (g.wokenTags?.has(this.rec.tag)) up = true;
      if (dist < 6) up = true;
      if (!up) { this.animate(dt, 0); return; }
      this.state = 'patrol';
    }

    // ---- perception
    const heard = this.senseHearing(dist);
    const seen = this.senseSight(dist);
    let notice = Math.max(heard, seen);
    this.observed = this.isObserved();

    // ---- the special cases that make each species itself
    if (flags.freezeWhenLit) {
      // a smiler is only a threat in the dark, and light nails it in place
      const litHere = w.lightAt(this.pos.x, this.pos.z) + (g.lampOn && this.observed ? 0.9 : 0);
      if (litHere > 0.35) {
        this.animate(dt, 0);
        this.alert = damp(this.alert, 0, 1, dt);
        this.faceCamera(dt);
        return;
      }
      notice = Math.max(notice, dist < this.sp.senses.sight * w.cell ? 0.8 : 0);
    }
    if (flags.movesWhenUnobserved) {
      // the mannequin: absolutely still while watched, appalling when not
      if (this.observed) {
        this.animate(dt, 0);
        this.faceCamera(dt);
        return;
      }
      this.state = 'hunt';
      this.alert = 1;
    }
    if (flags.vanishesWhenClose && dist < 12) {
      // the watcher is always at the far end of somewhere else
      const spot = g.entities.farSpotFrom(p.pos.x, p.pos.z, 26 + Math.random() * 20);
      if (spot) { this.pos.x = spot.x; this.pos.z = spot.z; this.pos.y = w.floorAtWorld(spot.x, spot.z); }
      g.audio?.oneShot('watcherGone', 0.3);
      this.animate(dt, 0);
      return;
    }
    if (flags.punishesStaring) {
      // facelings do not care unless you keep looking
      if (this.observed && dist < 24) this.stareT += dt;
      else this.stareT = Math.max(0, this.stareT - dt * 0.6);
      if (this.stareT > 2.6) notice = 1;
    }
    if (flags.seeksLight) {
      // moths go to the brightest thing nearby, and your torch is it
      const lampBonus = g.lampOn ? 0.7 : 0;
      notice = Math.max(notice, clamp01(lampBonus + (1 - dist / (this.sp.senses.sight * w.cell)) * 0.4));
    }
    if (flags.static) {
      // bacteria: a hazard with a hitbox
      if (dist < this.sp.radius + 1.1 && this.cool <= 0) {
        this.cool = 1;
        g.hurtPlayer(this.sp.damage * 0.35, this.type, { silent: true });
      }
      this.animate(dt, 0);
      return;
    }
    if (flags.friendly) {
      // the shepherd hums, points at the exit, and keeps its distance
      this.faceCamera(dt);
      const ex = g.exitMarker;
      if (ex && this.mesh) this.mesh.rotation.y = Math.atan2(-(ex.x - this.pos.x), -(ex.z - this.pos.z));
      this.animate(dt, 0.2);
      return;
    }

    // ---- alertness
    const gain = notice > 0.05 ? 2.4 * notice : 0;
    this.alert = clamp01(this.alert + gain * dt - (notice > 0.05 ? 0 : dt / Math.max(1, this.sp.aggro.lose)));
    if (this.alert > 0.72) {
      this.state = 'hunt';
      this.lostFor = 0;
      if (flags.pack || flags.screams) g.entities.alertNearby(this, flags.screams ? 42 : 18);
      if (flags.screams && this.screamT <= 0) {
        this.screamT = 6;
        g.audio?.oneShot('howlerScream', 0.8, this.pos);
      }
    } else if (this.state === 'hunt') {
      this.lostFor += dt;
      if (this.lostFor > this.sp.aggro.lose && !flags.relentless) this.state = 'patrol';
    }
    this.screamT = Math.max(0, this.screamT - dt);

    // ---- act
    if (this.state === 'hunt') {
      const sp = flags.sprints ? this.speed : this.speed * 0.9;
      if (flags.keepsDistance && dist > flags.keepsDistance) this.huntStep(dt, this.speed * 0.7);
      else if (flags.keepsDistance && dist > flags.keepsDistance * 0.6) {
        // the skin-stealer walks alongside you and waits for a bad moment
        this.mimicT += dt;
        this.faceCamera(dt);
        if (this.mimicT > 6 + Math.random() * 5) { this.mimicT = 0; flags.keepsDistance = 0; }
        this.animate(dt, 0.4);
        return;
      } else this.huntStep(dt, sp);

      const reach = this.sp.radius + 1.0 + (flags.huge ? 2.2 : 0);
      const canReach = flags.needsDeep ? p.swimming : flags.needsWater ? w.waterDepthAt(p.pos.x, p.pos.z) > 0.3 : true;
      if (dist < reach && this.cool <= 0 && canReach && !flags.harmless) {
        this.cool = flags.slow ? 1.6 : 1.1;
        g.hurtPlayer(this.sp.damage, this.type, { jump: true, from: this.pos });
      }
    } else if (this.state === 'guard') {
      this.faceCamera(dt, 0.6);
      this.animate(dt, 0);
      return;
    } else {
      // patrol: drift around home, or along a route if the level gave one
      this.wander.t -= dt;
      if (this.wander.t <= 0) {
        this.wander.t = 3 + Math.random() * 5;
        const route = this.rec.route;
        if (route && route.length) {
          const k = Math.floor(Math.random() * route.length);
          this.wander.x = route[k][0] * w.cell;
          this.wander.z = route[k][1] * w.cell;
        } else {
          const r = this.leash || 8 * w.cell;
          const a = Math.random() * 6.283;
          this.wander.x = this.home.x + Math.cos(a) * r * Math.random();
          this.wander.z = this.home.z + Math.sin(a) * r * Math.random();
        }
      }
      this.stepToward(this.wander.x, this.wander.z, dt, this.sp.walk);
    }

    this.animate(dt, Math.hypot(this.vel.x, this.vel.z));
  }

  faceCamera(dt, rate = 3) {
    const p = this.game.player;
    const want = Math.atan2(-(p.pos.x - this.pos.x), -(p.pos.z - this.pos.z));
    this.yaw = damp(this.yaw, want, rate, dt);
  }

  // ---------------------------------------------------------------- animation
  animate(dt, speed) {
    if (!this.mesh) return;
    const m = this.mesh;
    m.position.set(this.pos.x, this.pos.y, this.pos.z);
    m.rotation.y = this.yaw;
    const parts = m.userData.parts;
    if (!parts) return;
    const gait = Math.sin(this.cycle * (1.2 + speed * 0.5));
    const amp = clamp01(speed / 4) * 0.9 + 0.05;

    if (parts.quad && parts.legs) {
      parts.legs.forEach((l, i) => {
        const ph = i % 2 ? gait : -gait;
        l.rotation.x = ph * amp * 0.9;
      });
      if (parts.jaw) parts.jaw.rotation.x = 0.2 + Math.abs(gait) * amp * 0.4;
      if (parts.head) parts.head.position.y = (parts.head.userData.y0 ??= parts.head.position.y) + gait * 0.04 * amp;
      m.position.y += Math.abs(gait) * 0.03 * amp;
    } else if (parts.wings) {
      const f = Math.sin(this.cycle * 14);
      parts.wings[0].rotation.z = 0.5 + f * 0.7;
      parts.wings[1].rotation.z = -0.5 - f * 0.7;
    } else if (parts.swims) {
      m.rotation.z = Math.sin(this.cycle * 1.4) * 0.12;
      if (parts.tail) parts.tail.rotation.z = Math.sin(this.cycle * 2.2) * 0.4;
    } else if (parts.limbs) {
      parts.limbs.forEach((l, i) => {
        l.rotation.x += Math.sin(this.cycle * 1.3 + i) * dt * 0.6;
      });
      if (parts.body) parts.body.scale.y = 0.95 + Math.sin(this.cycle) * 0.05;
    } else {
      // biped
      if (parts.legL) {
        parts.legL.rotation.x = gait * amp;
        parts.legR.rotation.x = -gait * amp;
        parts.armL.rotation.x = -gait * amp * 0.7;
        parts.armR.rotation.x = gait * amp * 0.7;
      }
      if (parts.torso) parts.torso.rotation.y = gait * amp * 0.12;
      m.position.y += Math.abs(gait) * 0.035 * amp;
    }
    if (parts.pulse) {
      for (const d of parts.pulse) d.scale.y = (d.userData.s0 ??= d.scale.y) * (1 + Math.sin(this.cycle + d.position.x) * 0.12);
    }
  }
}

export class Entities {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.flow = new Int32Array(0);
    this.flowT = 0;
    this.queue = null;
  }

  load(records) {
    this.clear();
    for (const rec of records) this.list.push(new Creature(rec, this.game));
    const w = this.game.world;
    this.flow = new Int32Array(w.w * w.h).fill(-1);
    this.queue = new Int32Array(w.w * w.h);
    this.rebuildFlow();
  }

  clear() {
    for (const c of this.list) c.dropMesh();
    this.list = [];
  }

  // Flow field: BFS out from the player, honouring step heights.
  rebuildFlow() {
    const w = this.game.world;
    const p = this.game.player;
    const flow = this.flow;
    if (!flow.length) return;
    flow.fill(-1);
    const [sx, sz] = w.toCell(p.pos.x, p.pos.z);
    if (!w.isOpenCell(sx, sz)) return;
    const q = this.queue;
    let head = 0, tail = 0;
    const start = w.idx(sx, sz);
    flow[start] = 0;
    q[tail++] = start;
    while (head < tail) {
      const i = q[head++];
      const cx = i % w.w, cz = (i / w.w) | 0;
      const d = flow[i];
      if (d > 220) continue;                 // no point pathing across the whole level
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (!w.inside(nx, nz)) continue;
        const j = w.idx(nx, nz);
        if (flow[j] !== -1) continue;
        if (!w.walkStep(cx, cz, nx, nz)) continue;
        flow[j] = d + 1;
        q[tail++] = j;
      }
    }
  }

  alertNearby(from, radius) {
    const r = radius * this.game.world.cell;
    for (const c of this.list) {
      if (c === from || c.dead || c.sp.flags.harmless) continue;
      if (Math.hypot(c.pos.x - from.pos.x, c.pos.z - from.pos.z) > r) continue;
      c.alert = Math.max(c.alert, 0.85);
      if (c.state === 'dormant') c.state = 'patrol';
    }
  }

  anyHunting() {
    return this.list.some((c) => c.state === 'hunt' && !c.sp.flags.harmless && !c.frozen);
  }

  // Nearest hunting thing, for the heartbeat and the music
  threat() {
    const p = this.game.player;
    let best = null, bd = Infinity;
    for (const c of this.list) {
      if (c.frozen || c.sp.flags.harmless) continue;
      const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return { creature: best, dist: bd, hunting: best?.state === 'hunt' };
  }

  // A cell a long way from here, for the watcher's re-placement
  farSpotFrom(x, z, want) {
    const w = this.game.world;
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * 6.283;
      const d = want * (0.7 + Math.random() * 0.6);
      const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d;
      const [cx, cz] = w.toCell(tx, tz);
      if (w.isOpenCell(cx, cz)) return { x: cx * w.cell, z: cz * w.cell };
    }
    return null;
  }

  // Levels with rules.chase spawn hunters behind the player, forever.
  spawnChaser(type) {
    const w = this.game.world;
    const p = this.game.player;
    const behind = { x: p.pos.x + Math.sin(p.yaw) * 26, z: p.pos.z + Math.cos(p.yaw) * 26 };
    const [cx, cz] = w.toCell(behind.x, behind.z);
    const spot = w.isOpenCell(cx, cz) ? [cx, cz] : (() => {
      const s = this.farSpotFrom(p.pos.x, p.pos.z, 24);
      return s ? w.toCell(s.x, s.z) : null;
    })();
    if (!spot) return null;
    const c = new Creature({ type, x: spot[0], z: spot[1], state: 'hunt' }, this.game);
    c.alert = 1;
    this.list.push(c);
    return c;
  }

  update(dt) {
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = FLOW_EVERY;
      this.rebuildFlow();
    }
    for (const c of this.list) {
      if (c.dead) continue;
      c.update(dt);
    }
    // keep the population honest on chase levels
    const chase = this.game.world.rules?.chase;
    if (chase && this.game.levelTime > (chase.after ?? 0)) {
      this.chaseT = (this.chaseT ?? 0) - dt;
      if (this.chaseT <= 0) {
        this.chaseT = chase.spawnRate ?? 22;
        const hunting = this.list.filter((c) => c.state === 'hunt' && !c.frozen).length;
        if (hunting < (chase.max ?? 5)) this.spawnChaser(chase.entity || 'hound');
      }
    }
  }
}
