// ONE MONSTER PER FLOOR, and it kills you the moment it reaches you.
//
// The whole floor is a conversation with a single thing. It prowls a long way off,
// it stalks when it half-hears you, it hunts flat-out when it is sure, and when it
// loses you it searches the place it last knew about. Hiding works — properly,
// not as a formality — but if it watched you get into cover it will come and check
// that cover, and how thoroughly depends on what it is.
//
// Pathing is a breadth-first flow field flooded from the player a few times a
// second. Senses are honest: sight needs line of sight, a cone and enough light;
// hearing reads the player's noise and the inverse square of the distance. A hound
// has no eyes at all. A mannequin has nothing but eyes. Both work off this file.

import { SPECIES, buildCreature } from './bestiary.js';
import { clamp, clamp01, damp, wrapAngle } from './util.js';

const FLOW_EVERY = 0.25;

export class Monster {
  constructor(rec, game) {
    const sp = SPECIES[rec.type];
    this.rec = rec;
    this.sp = sp;
    this.game = game;
    const w = game.world;
    this.home = { x: rec.x * w.cell, z: rec.z * w.cell };
    this.pos = { x: this.home.x, y: w.floorAtWorld(this.home.x, this.home.z), z: this.home.z };
    this.vel = { x: 0, z: 0 };
    this.yaw = Math.random() * 6.283;
    this.state = 'prowl';
    this.alert = 0;
    this.lastKnown = null;      // where it last had you
    this.searchT = 0;
    this.wander = { x: this.home.x, z: this.home.z, t: 0 };
    this.cycle = Math.random() * 6.283;
    this.mesh = null;
    this.tellT = 0;
    this.grabbed = false;
    this.checkHide = null;      // a hiding place it is on its way to open
    this.sawHide = false;
    this.stareT = 0;
    this.speed = (rec.speed ?? sp.speed) * (game.difficulty ?? 1);
    this.walk = sp.walk || sp.speed * 0.35;
    this.spawnGrace = 6;        // it does not know anything for the first few seconds
  }

  // ---------------------------------------------------------------- presence
  ensureMesh() {
    if (this.mesh) return;
    this.mesh = buildCreature(this.rec.type);
    this.game.scene.add(this.mesh);
  }

  dropMesh() {
    if (!this.mesh) return;
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => o.geometry?.dispose?.());
    this.mesh = null;
  }

  get dist() {
    const p = this.game.player.pos;
    return Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
  }

  // Is it in frame, far enough away to be filmable, and lit enough to record?
  filmable() {
    const g = this.game;
    const p = g.player;
    const d = this.dist;
    if (d < 5 || d > 34) return false;
    if (!g.world.sightClear(p.pos.x, p.pos.z, this.pos.x, this.pos.z)) return false;
    const toM = Math.atan2(-(this.pos.x - p.pos.x), -(this.pos.z - p.pos.z));
    return Math.abs(wrapAngle(toM - p.yaw)) < 0.5;
  }

  // ---------------------------------------------------------------- senses
  hears() {
    const g = this.game;
    const p = g.player;
    const sp = this.sp;
    if (!sp.senses.hearing) return 0;
    const noise = Math.max(p.noise * (g.mods?.noise ?? 1), g.noiseBoost || 0)
      * (g.world.rules?.noisefloor ? 1.5 : 1);
    if (noise <= 0.02) return 0;
    const range = sp.senses.hearing * g.world.cell * (0.45 + noise) * (this.rec.hearing ?? 1);
    const d = this.dist;
    if (d > range) return 0;
    return clamp01((1 - d / range) * (0.4 + noise));
  }

  sees() {
    const g = this.game;
    const p = g.player;
    const sp = this.sp;
    if (!sp.senses.sight || p.hidden) return 0;
    const range = sp.senses.sight * g.world.cell * (this.rec.sight ?? 1);
    const d = this.dist;
    if (d > range) return 0;
    if (!g.world.sightClear(this.pos.x, this.pos.z, p.pos.x, p.pos.z)) return 0;
    const toP = Math.atan2(-(p.pos.x - this.pos.x), -(p.pos.z - this.pos.z));
    if (Math.abs(wrapAngle(toP - this.yaw)) > sp.senses.fov / 2) return 0;
    const lit = clamp01(g.world.lightAt(p.pos.x, p.pos.z) * 1.8 + (g.lampOn ? 0.55 : 0) + 0.1);
    return clamp01((1 - d / range) * (0.45 + lit));
  }

  observedByPlayer() {
    const g = this.game;
    const p = g.player;
    if (p.hidden) return false;
    const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z;
    if (Math.hypot(dx, dz) > 55) return false;
    if (!g.world.sightClear(p.pos.x, p.pos.z, this.pos.x, this.pos.z)) return false;
    const toE = Math.atan2(-dx, -dz);
    return Math.abs(wrapAngle(toE - p.yaw)) < 0.6;
  }

  // ---------------------------------------------------------------- movement
  moveToward(tx, tz, dt, speed) {
    const w = this.game.world;
    const flags = this.sp.flags;
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.x = damp(this.vel.x, (dx / d) * speed, 7, dt);
    this.vel.z = damp(this.vel.z, (dz / d) * speed, 7, dt);
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const canGo = (x, z) => {
      if (w.solidAtWorld(x, z, this.pos.y)) return false;
      if (flags.needsWater && !w.waterDepthAt(x, z)) return false;
      if (flags.needsDeep && !w.isDeepAt(x, z)) return false;
      return flags.flies || flags.swims || flags.ceiling
        || Math.abs(w.floorAtWorld(x, z) - this.pos.y) < 1.0;
    };
    if (canGo(nx, this.pos.z)) this.pos.x = nx; else this.vel.x *= -0.15;
    if (canGo(this.pos.x, nz)) this.pos.z = nz; else this.vel.z *= -0.15;
    const ground = w.floorAtWorld(this.pos.x, this.pos.z);
    const targetY = flags.flies ? ground + 1.7 + Math.sin(this.cycle * 2) * 0.2
      : flags.ceiling && this.state !== 'hunt' ? w.ceilAtWorld(this.pos.x, this.pos.z) - 1.1
        : flags.swims ? (w.waterY ?? 0) - (flags.needsDeep ? 1.3 : 0.4)
          : ground;
    this.pos.y = damp(this.pos.y, targetY, 7, dt);
    if (Math.hypot(this.vel.x, this.vel.z) > 0.05) {
      this.yaw = damp(this.yaw, Math.atan2(-this.vel.x, -this.vel.z), 7, dt) || this.yaw;
    }
  }

  // Downhill on the flow field: the route to the player, without pathfinding.
  chase(dt, speed) {
    const g = this.game;
    const w = g.world;
    const flow = g.entities.flow;
    const [cx, cz] = w.toCell(this.pos.x, this.pos.z);
    const here = flow[w.idx(cx, cz)] ?? -1;
    let best = null, bestD = Infinity;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (!w.inside(nx, nz)) continue;
      const v = flow[w.idx(nx, nz)];
      if (v < 0 || v >= bestD) continue;
      if (this.sp.flags.needsDeep && !w.isDeepAt(nx * w.cell, nz * w.cell)) continue;
      if (this.sp.flags.needsWater && !w.waterDepthAt(nx * w.cell, nz * w.cell)) continue;
      bestD = v;
      best = [nx, nz];
    }
    if (best && (here < 0 || bestD < here + 1)) {
      const [wx, wz] = w.toWorld(best[0], best[1]);
      this.moveToward(wx, wz, dt, speed);
    } else {
      this.moveToward(g.player.pos.x, g.player.pos.z, dt, speed);
    }
  }

  // ---------------------------------------------------------------- the brain
  update(dt) {
    const g = this.game;
    const w = g.world;
    const p = g.player;
    const flags = this.sp.flags;
    this.cycle += dt * (2 + this.speed * 0.4);
    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    this.ensureMesh();

    const d = this.dist;
    const heard = this.spawnGrace > 0 ? 0 : this.hears();
    const seen = this.spawnGrace > 0 ? 0 : this.sees();
    let notice = Math.max(heard, seen);

    // ---- the species rules that make one floor different from the next
    if (flags.freezeWhenLit) {
      // put light on it and it cannot move. Take the light off and it is closer.
      const lit = w.lightAt(this.pos.x, this.pos.z) + (g.lampOn && this.observedByPlayer() ? 1.2 : 0);
      if (lit > 0.4) {
        this.frozen = true;
        this.faceCamera(dt, 2);
        this.animate(dt, 0);
        this.tell(dt, d, 0.4);
        return;
      }
      this.frozen = false;
      if (!p.hidden && d < 40) notice = Math.max(notice, 0.9);
    }
    if (flags.movesWhenUnobserved) {
      // it only moves while you are not looking at it, and it moves fast
      if (this.observedByPlayer()) {
        this.frozen = true;
        this.animate(dt, 0);
        this.tell(dt, d, 0.25);
        return;
      }
      this.frozen = false;
      if (!p.hidden) { notice = 1; this.lastKnown = { x: p.pos.x, z: p.pos.z }; }
    }
    if (flags.punishesStaring) {
      // ignores you until you look at it too long
      if (this.observedByPlayer() && d < 30) this.stareT += dt;
      else this.stareT = Math.max(0, this.stareT - dt * 0.5);
      if (this.stareT > 2.2) notice = 1;
      else notice = Math.min(notice, 0.5);
    }
    if (flags.seeksLight && g.lampOn && d < 30) notice = Math.max(notice, 0.8);
    if (flags.relentless && this.state === 'hunt') notice = Math.max(notice, 0.7);

    // ---- alert bookkeeping
    if (notice > 0.05) {
      this.alert = clamp01(this.alert + notice * 2.6 * dt);
      if (this.alert > 0.55 && !p.hidden) this.lastKnown = { x: p.pos.x, z: p.pos.z };
    } else {
      this.alert = clamp01(this.alert - dt / (2 + this.sp.aggro.lose * 0.2));
    }

    // ---- state machine
    const wasHunting = this.state === 'hunt';
    if (this.alert > 0.8) {
      this.state = 'hunt';
      this.searchT = (6 + this.sp.aggro.patience * 0.4) * (this.rec.patience ?? 1);
      if (!wasHunting) {
        g.onChaseStart?.(this);
        this.sawHide = false;
      }
    } else if (this.alert > 0.35) {
      if (this.state !== 'hunt') this.state = 'stalk';
    } else if (this.state === 'hunt' || this.state === 'stalk') {
      this.state = 'search';
      this.searchT = (7 + this.sp.aggro.patience * 0.3) * (this.rec.patience ?? 1);
    }

    // ---- if it saw you get into cover, it comes and opens the cover
    if (p.hidden && p.hideJustEntered && this.state === 'hunt' && d < 26) {
      this.sawHide = true;
      this.checkHide = { x: p.pos.x, z: p.pos.z };
    }

    switch (this.state) {
      case 'hunt': {
        const target = p.hidden ? (this.checkHide || this.lastKnown) : null;
        if (target) this.moveToward(target.x, target.z, dt, this.speed * 0.85);
        else this.chase(dt, this.speed);
        break;
      }
      case 'stalk':
        if (this.lastKnown) this.moveToward(this.lastKnown.x, this.lastKnown.z, dt, this.walk * 1.6);
        else this.prowl(dt);
        break;
      case 'search': {
        this.searchT -= dt;
        const spot = this.checkHide || this.lastKnown;
        if (spot) {
          const sd = Math.hypot(spot.x - this.pos.x, spot.z - this.pos.z);
          if (sd < 2.2) {
            // it is standing on the place it last knew about. If that is your
            // hiding place, this is the moment it decides whether to open it.
            if (this.checkHide && p.hidden) {
              const chance = (this.rec.checksHides ?? 0.45) * (this.sawHide ? 1.6 : 0.35)
                * (1 - (g.mods?.hideSafety ?? 0));
              if (Math.random() < chance * dt * 1.4) { this.kill('found you in cover'); return; }
            }
            // otherwise sweep outward from it
            this.lastKnown = {
              x: spot.x + (Math.random() - 0.5) * 14,
              z: spot.z + (Math.random() - 0.5) * 14,
            };
            this.checkHide = null;
          } else {
            this.moveToward(spot.x, spot.z, dt, this.walk * 2.1);
          }
        } else this.prowl(dt);
        if (this.searchT <= 0) {
          this.state = 'prowl';
          this.lastKnown = null;
          this.checkHide = null;
          this.sawHide = false;
          g.onChaseEnd?.(this);
        }
        break;
      }
      default:
        this.prowl(dt);
    }

    // ---- contact
    const reach = this.sp.radius + 0.95 + (flags.huge ? 2 : 0);
    const canTouch = flags.needsDeep ? p.swimming
      : flags.needsWater ? w.waterDepthAt(p.pos.x, p.pos.z) > 0.25 : true;
    if (!p.hidden && d < reach && canTouch && !this.frozen && this.spawnGrace <= 0) {
      this.kill();
      return;
    }

    this.animate(dt, Math.hypot(this.vel.x, this.vel.z));
    this.tell(dt, d, this.state === 'hunt' ? 1 : this.state === 'stalk' ? 0.7 : 0.45);
  }

  prowl(dt) {
    const w = this.game.world;
    this.wander.t -= dt;
    if (this.wander.t <= 0) {
      this.wander.t = 4 + Math.random() * 6;
      const r = (this.rec.wanders ?? 26) * w.cell;
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * 6.283;
        const x = this.pos.x + Math.cos(a) * r * (0.3 + Math.random() * 0.7);
        const z = this.pos.z + Math.sin(a) * r * (0.3 + Math.random() * 0.7);
        const [cx, cz] = w.toCell(x, z);
        if (w.isOpenCell(cx, cz)) { this.wander.x = x; this.wander.z = z; break; }
      }
    }
    this.moveToward(this.wander.x, this.wander.z, dt, this.walk);
  }

  faceCamera(dt, rate = 3) {
    const p = this.game.player;
    const want = Math.atan2(-(p.pos.x - this.pos.x), -(p.pos.z - this.pos.z));
    this.yaw = damp(this.yaw, want, rate, dt);
  }

  // The noise it makes, scaled by how close and how interested it is. This is the
  // only warning the game gives you, and it is the best thing in it.
  tell(dt, dist, urgency) {
    const g = this.game;
    if (dist > 44) return;
    this.tellT -= dt;
    if (this.tellT > 0) return;
    const near = clamp01(1 - dist / 44);
    this.tellT = clamp(2.6 - near * 1.6 - urgency * 0.8, 0.45, 3);
    const name = this.state === 'hunt' ? this.sp.sound.alert : this.sp.sound.idle;
    g.audio?.oneShot(this.rec.tell || name, 0.35 + near * 0.85 * urgency, this.pos);
  }

  kill(reason) {
    if (this.grabbed) return;
    this.grabbed = true;
    this.game.onCaught?.(this, reason);
  }

  // ---------------------------------------------------------------- animation
  animate(dt, speed) {
    if (!this.mesh) return;
    const m = this.mesh;
    m.position.set(this.pos.x, this.pos.y, this.pos.z);
    m.rotation.y = this.yaw;
    const parts = m.userData.parts;
    if (!parts) return;
    const gait = Math.sin(this.cycle * (1.3 + speed * 0.45));
    const amp = clamp01(speed / 4) * 0.95 + 0.05;
    if (parts.quad && parts.legs) {
      parts.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? gait : -gait) * amp * 0.95; });
      if (parts.jaw) parts.jaw.rotation.x = 0.18 + Math.abs(gait) * amp * 0.5;
      m.position.y += Math.abs(gait) * 0.035 * amp;
    } else if (parts.wings) {
      const f = Math.sin(this.cycle * 15);
      parts.wings[0].rotation.z = 0.5 + f * 0.75;
      parts.wings[1].rotation.z = -0.5 - f * 0.75;
    } else if (parts.swims) {
      m.rotation.z = Math.sin(this.cycle * 1.5) * 0.13;
      if (parts.tail) parts.tail.rotation.z = Math.sin(this.cycle * 2.4) * 0.45;
    } else if (parts.limbs) {
      parts.limbs.forEach((l, i) => { l.rotation.x += Math.sin(this.cycle * 1.4 + i) * dt * 0.7; });
      if (parts.body) parts.body.scale.y = 0.95 + Math.sin(this.cycle) * 0.06;
    } else if (parts.legL) {
      parts.legL.rotation.x = gait * amp;
      parts.legR.rotation.x = -gait * amp;
      parts.armL.rotation.x = -gait * amp * 0.75;
      parts.armR.rotation.x = gait * amp * 0.75;
      if (parts.torso) parts.torso.rotation.y = gait * amp * 0.14;
      m.position.y += Math.abs(gait) * 0.04 * amp;
    }
    if (parts.pulse) {
      for (const dsk of parts.pulse) {
        dsk.scale.y = (dsk.userData.s0 ??= dsk.scale.y) * (1 + Math.sin(this.cycle + dsk.position.x) * 0.12);
      }
    }
  }
}

// ------------------------------------------------------------------ manager
export class Entities {
  constructor(game) {
    this.game = game;
    this.monster = null;
    this.flow = new Int32Array(0);
    this.queue = null;
    this.flowT = 0;
  }

  load(data) {
    this.clear();
    const w = this.game.world;
    this.flow = new Int32Array(w.w * w.h).fill(-1);
    this.queue = new Int32Array(w.w * w.h);
    const rec = data.monster || (data.entities || []).find((e) => e.isMonster);
    if (rec) this.monster = new Monster(rec, this.game);
    this.rebuildFlow();
  }

  clear() {
    this.monster?.dropMesh();
    this.monster = null;
  }

  get list() { return this.monster ? [this.monster] : []; }

  anyHunting() { return this.monster?.state === 'hunt'; }

  threat() {
    if (!this.monster) return { creature: null, dist: Infinity, hunting: false };
    return { creature: this.monster, dist: this.monster.dist, hunting: this.monster.state === 'hunt' };
  }

  // Direction and distance for the TRACKING powerup's pip.
  bearing() {
    const m = this.monster;
    if (!m) return null;
    const p = this.game.player;
    const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z;
    return {
      dist: Math.hypot(dx, dz),
      rel: wrapAngle(Math.atan2(-dx, -dz) - p.yaw),
      state: m.state,
    };
  }

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
      const dv = flow[i];
      if (dv > 240) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (!w.inside(nx, nz)) continue;
        const j = w.idx(nx, nz);
        if (flow[j] !== -1 || !w.walkStep(cx, cz, nx, nz)) continue;
        flow[j] = dv + 1;
        q[tail++] = j;
      }
    }
  }

  update(dt) {
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = FLOW_EVERY;
      this.rebuildFlow();
    }
    this.monster?.update(dt);
  }
}
