// A combatant (player or bot). Owns physics, ink/health, weapon handling and
// its Dripkin model. Driven by an "intent" written by PlayerControl or a Bot.
import * as THREE from 'three';
import { Dripkin } from './character.js';
import { WEAPONS, SUBS, posOf } from './weapons.js';
import { NONE } from '../world/paint.js';
import { clamp, damp, dampAngle, angleDiff, rand } from '../util.js';

const GRAV = 24;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _muz = new THREE.Vector3(), _aim = new THREE.Vector3();

export class Fighter {
  constructor(world, { name, team, look, weapon = 'spritzer', isPlayer = false, color }) {
    this.world = world;
    this.name = name;
    this.team = team;
    this.look = look;
    this.isPlayer = isPlayer;
    this.weapon = WEAPONS[weapon];
    this.model = new Dripkin(look, color || world.colors[team], weapon);
    world.scene.add(this.model.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.aimYaw = 0; this.aimPitch = 0;
    this.intent = { mx: 0, mz: 0, aimYaw: 0, aimPitch: 0, aimPoint: null, fire: false, firePressed: false, sub: false, special: false, jump: false, goo: false };
    this.form = 'kid';
    this.submerged = false; this.climbing = false; this.onGround = false;
    this.groundSolid = null; this.surface = NONE; this.wall = null;
    this.hp = 100; this.ink = 1; this.special = 0; this.specialReady = false;
    this.alive = true; this.respawnT = 0; this.invuln = 0;
    this.fireCd = 0; this.charge = 0; this.charging = false; this.flickCd = 0; this.rollDelay = 0; this.rolling = false;
    this.lastFire = -9; this.lastDamage = -9; this.time = 0; this.lastAttacker = null; this.lastAttackT = -9;
    this.damagers = new Map();
    this.rollHits = new Map();
    this.stats = { turf: 0, kills: 0, deaths: 0, assists: 0, specials: 0 };
    this.nova = null;
    this.fxT = 0;
    this.spawnPoint = new THREE.Vector3();
    this.spawnYaw = 0;
    this.prevFire = false;
    this.lowInkT = 0;
    this.loops = {};
    this.canFight = true; // false in plaza for npc-safe mode
  }

  get color() { return this.world.colors[this.team]; }

  setWeapon(id) {
    this.weapon = WEAPONS[id];
    this.model.setWeapon(id);
  }

  hitHeight() { return this.form === 'goo' ? (this.submerged ? 0.3 : 0.55) : 1.25; }

  place(p, yaw) {
    this.pos.copy(p); this.vel.set(0, 0, 0);
    this.yaw = this.aimYaw = this.intent.aimYaw = yaw;
    this.onGround = false;
    this.syncModel(0);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const w = this.world;
    this.time += dt;
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && w.canRespawn !== false) this.respawn();
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    const I = this.intent;
    this.aimYaw = I.aimYaw; this.aimPitch = I.aimPitch;

    // ---- what am I standing in?
    this.surface = NONE;
    if (this.onGround && this.groundSolid) {
      const face = this.groundSolid.sideFace?.top;
      if (face) this.surface = w.paint.ownerAt(face, this.pos);
    }
    const own = this.surface === this.team;
    const enemy = this.surface !== NONE && this.surface !== this.team;

    // ---- form
    const wantGoo = I.goo && !this.nova;
    if (wantGoo && this.form === 'kid') {
      this.form = 'goo';
      this.charge = 0; this.charging = false; this.rolling = false;
      if (this.isPlayer || this.near()) w.audio?.sfx('goo_in', { ...posOf(this.pos), volume: 0.6 });
      w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.4), _w.set(0, 1, 0), this.color, 6, 2.5, 0.07);
    } else if (!wantGoo && this.form === 'goo') {
      this.form = 'goo_exit';
    }
    if (this.form === 'goo_exit') {
      this.form = 'kid';
      if (this.isPlayer || this.near()) w.audio?.sfx('goo_out', { ...posOf(this.pos), volume: 0.6 });
      if (this.submerged) w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.2), _w.set(0, 1, 0), this.color, 8, 3, 0.07);
    }
    const goo = this.form === 'goo';

    // ---- weapons
    let firing = false;
    if (!goo && this.canFight) firing = this.weaponUpdate(dt);
    else { this.charging = false; this.charge = 0; this.rolling = false; this.stopLoop('charge'); this.stopLoop('roll'); }
    this.prevFire = I.fire;
    if (I.sub && this.canFight && !this.nova) this.throwSub();
    if (I.special && this.specialReady && this.canFight && !this.nova) this.useSpecial();

    // ---- movement speed
    let maxSp;
    const rec = this.time - this.lastFire < 0.35;
    if (goo) maxSp = own ? 10.6 : enemy ? 1.5 : (this.onGround ? 2.7 : 5);
    else {
      maxSp = enemy ? 2.4 : 5.7;
      if (this.charging) maxSp *= this.weapon.chargeMoveMul;
      else if (this.rolling) maxSp = enemy ? 2.6 : 5.4 * this.weapon.moveMul;
      else if (rec) maxSp *= this.weapon.moveMul;
    }
    if (this.nova) maxSp = 3;
    const mx = I.mx, mz = I.mz;
    const tx = mx * maxSp, tz = mz * maxSp;
    const accel = this.onGround ? (goo && own ? 70 : 46) : 16;
    const dvx = tx - this.vel.x, dvz = tz - this.vel.z;
    const dl = Math.hypot(dvx, dvz);
    const maxDv = accel * dt;
    if (dl > maxDv) { this.vel.x += (dvx / dl) * maxDv; this.vel.z += (dvz / dl) * maxDv; } else { this.vel.x = tx; this.vel.z = tz; }
    if (!this.onGround && Math.hypot(this.vel.x, this.vel.z) > Math.max(maxSp, 6)) { this.vel.x *= 1 - 0.8 * dt; this.vel.z *= 1 - 0.8 * dt; }

    // ---- climbing
    const wall = this.wall;
    this.climbing = false;
    if (goo && wall && wall.face && !this.nova) {
      const press = -(mx * wall.nx + mz * wall.nz);
      if (press > 0.25) {
        let ownWall = false;
        for (const hy of [0.2, 0.55, 0.95]) {
          _v.set(this.pos.x - wall.nx * 0.37, this.pos.y + hy, this.pos.z - wall.nz * 0.37);
          if (w.paint.ownerAt(wall.face, _v) === this.team) { ownWall = true; break; }
        }
        if (ownWall) {
          this.climbing = true;
          this.vel.y = 6.8 * Math.min(1, press + 0.2);
          // slide sideways along the wall, stick into it
          const side = mx * -wall.nz + mz * wall.nx;
          this.vel.x = -wall.nz * side * 4 - wall.nx * 1.5;
          this.vel.z = wall.nx * side * 4 - wall.nz * 1.5;
          if (this.pos.y + 0.35 >= wall.top - 0.05) {
            this.vel.y = 5.2;
            this.vel.x = -wall.nx * 4; this.vel.z = -wall.nz * 4;
            this.climbing = false;
          }
        }
      }
    }

    // ---- jump
    if (I.jump && (this.onGround || this.climbing)) {
      if (this.climbing && wall) {
        this.vel.y = 7.4; this.vel.x += wall.nx * 4.5; this.vel.z += wall.nz * 4.5;
        this.climbing = false;
      } else {
        this.vel.y = goo && own ? 9.2 : enemy ? 5.4 : 7.9;
      }
      this.onGround = false;
      if (this.isPlayer || this.near()) w.audio?.sfx('jump', { ...posOf(this.pos), volume: 0.5 });
      if (goo) w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.1), _w.set(0, 1, 0), this.color, 7, 3.5, 0.07);
    }

    // ---- gravity + integrate
    if (!this.climbing) this.vel.y = Math.max(this.vel.y - GRAV * dt, -32);
    const wasGround = this.onGround;
    const r = goo ? 0.3 : 0.36;
    const h = goo ? 0.55 : 1.45;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.wall = w.level.collide(this.pos, this.vel, r, h, wasGround ? 0.5 : 0.3);
    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
    // test from the higher of old/new foot height so fast falls can't tunnel through floors
    const g = w.level.groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y), 0.2, wasGround ? 0.55 : 0.12);
    if (g.solid && this.vel.y <= 0.01 && this.pos.y <= g.y + (wasGround ? 0.4 : 0.001)) {
      if (!wasGround && this.vel.y < -3) this.onLand(-this.vel.y);
      this.pos.y = g.y; this.vel.y = 0;
      this.onGround = true; this.groundSolid = g.solid;
    } else {
      this.onGround = false;
      if (g.solid && this.pos.y < g.y) { this.pos.y = g.y; this.vel.y = Math.max(0, this.vel.y); }
    }
    // nova slam
    if (this.nova) {
      this.nova.t += dt;
      if (this.nova.t > 0.25 && (this.onGround || this.nova.t > 2.5)) {
        w.combat.explode(this.pos.clone().setY(this.pos.y + 0.3), this, 5.4, 220, 45, 5.0, { extra: 8 });
        this.nova = null;
      } else if (this.nova.t > 0.55 && this.vel.y > -20) this.vel.y -= 50 * dt;
    }
    if (this.pos.y < w.level.killY) {
      const recent = this.time - this.lastAttackT < 6 ? this.lastAttacker : null;
      this.splatted(recent, 'fall');
      return;
    }

    // ---- refresh surface after move
    this.submerged = goo && ((this.onGround && this.surface === this.team) || this.climbing);

    // ---- ink + health
    const sinceFire = this.time - this.lastFire;
    if (this.submerged) this.ink += 0.36 * dt;
    else if (!this.charging && !this.rolling && sinceFire > 0.6) this.ink += (goo ? 0.06 : 0.075) * dt;
    if (this.ink > 1) {
      if (this.isPlayer && this.ink - 0.36 * dt < 1 && this.submerged) w.audio?.sfx('ink_full', { volume: 0.4 });
      this.ink = 1;
    }
    if (this.onGround && enemy && this.invuln <= 0) {
      if (this.hp > 45) { this.hp = Math.max(45, this.hp - 16 * dt); this.lastDamage = this.time; }
      if (this.isPlayer && Math.random() < dt * 3) w.audio?.sfx('enemy_ink', { volume: 0.35 });
    } else if (this.time - this.lastDamage > 1.1 && this.hp < 100) {
      this.hp = Math.min(100, this.hp + (this.submerged ? 55 : 20) * dt);
    }

    // ---- facing
    const aimLock = !goo && (firing || this.charging || this.rolling || this.time - this.lastFire < 0.5 || (this.isPlayer && I.aimHold));
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (aimLock) this.yaw = this.rolling ? dampAngle(this.yaw, this.aimYaw, 6, dt) : dampAngle(this.yaw, this.aimYaw, 30, dt);
    else if (hs > 0.5) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), goo ? 16 : 12, dt);
    else if (this.isPlayer && !goo) this.yaw = dampAngle(this.yaw, this.aimYaw, 3, dt);

    // ---- effects
    this.fxT -= dt;
    if (this.fxT <= 0) {
      if (this.submerged && hs > 2) {
        this.fxT = 0.08;
        w.fx.ring(_v.copy(this.pos).setY(this.pos.y + 0.03), this.color, 0.15, 0.7, 0.45, { alpha: 0.55 });
        w.fx.spawn(_v.set(this.pos.x, this.pos.y + 0.1, this.pos.z), _w.set(rand(-1, 1), rand(1.5, 3), rand(-1, 1)), this.color, 0.05, 0.4);
      } else if (this.climbing) {
        this.fxT = 0.1;
        w.fx.spawn(_v.set(this.pos.x, this.pos.y + 0.3, this.pos.z), _w.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)), this.color, 0.05, 0.4);
        if (this.isPlayer) w.audio?.sfx('climb_step', { volume: 0.3 });
      } else if (!goo && this.onGround && hs > 3 && this.surface !== NONE) {
        this.fxT = 0.22;
        w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.05), _w.set(0, 1, 0), w.colors[this.surface], 3, 1.8, 0.045);
      } else this.fxT = 0.05;
    }
    if (this.isPlayer) this.updateLoops(hs, goo);
    this.syncModel(dt, firing, hs);
  }

  near() { return this.world.listener ? this.pos.distanceToSquared(this.world.listener) < 900 : false; }

  onLand(speed) {
    const w = this.world;
    if (this.isPlayer || this.near()) w.audio?.sfx(speed > 12 ? 'land_heavy' : 'land', { ...posOf(this.pos), volume: 0.5 });
    if (this.form === 'goo' || speed > 9) w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.05), _w.set(0, 1, 0), this.color, 6, 2.5, 0.06);
  }

  updateLoops(hs, goo) {
    const a = this.world.audio;
    if (!a) return;
    const swim = this.submerged && hs > 1;
    if (swim) { if (!this.loops.swim) this.loops.swim = a.loop('swim'); this.loops.swim.setVolume(clamp(hs / 10, 0.2, 0.8)); }
    else this.stopLoop('swim');
  }

  stopLoop(n) { if (this.loops[n]) { this.loops[n].stop(); this.loops[n] = null; } }

  syncModel(dt, firing = false, hs = 0) {
    const m = this.model;
    if (this.world.listener) m.lodFor(this.world.listener);
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    m.root.visible = this.alive;
    // relative movement direction for back-pedal animation
    const back = hs > 0.5 && Math.cos(angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z))) < -0.3;
    m.setInk(this.ink);
    if (this.form === 'goo' && this.climbing && this.wall) m.root.rotation.y = Math.atan2(-this.wall.nx, -this.wall.nz);
    m.update(dt, {
      speed: hs, back, grounded: this.onGround || this.climbing, vy: this.vel.y, pitch: this.aimPitch,
      aiming: (this.time - this.lastFire < 0.5) || this.charging || (this.isPlayer && this.intent.aimHold), firing, weapon: this.weapon.id,
      goo: this.form === 'goo', submerged: this.submerged, climbing: this.climbing, rolling: this.rolling,
    });
    // in own ink the blob hides most of itself — enemies can barely see it
    if (this.submerged && !this.climbing) {
      const show = hs > 6 ? 1 : 0.35;
      m.goo.position.y = -0.1 * (1 - show);
    } else m.goo.position.y = 0;
  }

  // ---------------------------------------------------------------- weapons
  aimDir(out) {
    const I = this.intent;
    this.model.muzzleWorld(_muz);
    if (I.aimPoint) {
      out.subVectors(I.aimPoint, _muz);
      const d = out.length();
      if (d > 1.2) return out.divideScalar(d);
    }
    const cp = Math.cos(this.aimPitch);
    return out.set(Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp);
  }

  muzzle(out) {
    this.model.muzzleWorld(out);
    // avoid spawning shots inside walls: clamp muzzle to body column
    _v.set(this.pos.x, this.pos.y + 1.05, this.pos.z);
    _w.subVectors(out, _v);
    const d = _w.length();
    if (d > 0.01) {
      const hit = this.world.level.raycast(_v, _w.clone().divideScalar(d), d);
      if (hit) out.copy(_v).addScaledVector(_w, Math.max(0, hit.t - 0.1) / d);
    }
    return out;
  }

  useInk(cost) {
    if (this.ink >= cost) { this.ink -= cost; return true; }
    this.noInk();
    return false;
  }

  noInk() {
    if (this.time - this.lowInkT > 0.5) {
      this.lowInkT = this.time;
      if (this.isPlayer) { this.world.audio?.sfx('ink_empty', { volume: 0.6 }); this.world.onLowInk?.(); }
    }
  }

  weaponUpdate(dt) {
    const w = this.world, d = this.weapon, I = this.intent;
    this.fireCd -= dt; this.flickCd -= dt; this.rollDelay -= dt;
    let firing = false;
    const air = !this.onGround;
    if (d.type === 'shooter' || d.type === 'blaster') {
      if (I.fire && this.fireCd <= 0) {
        if (this.useInk(d.ink)) {
          this.fireCd += d.rate;
          if (this.fireCd < -0.05) this.fireCd = d.rate;
          const o = this.muzzle(_muz), dir = this.aimDir(_aim);
          if (d.type === 'shooter') w.combat.shooter(this, o, dir, d, air);
          else w.combat.blaster(this, o, dir, d);
          w.audio?.sfx(d.type === 'shooter' ? 'shoot' : 'shoot_heavy', { ...posOf(o), volume: this.isPlayer ? 0.55 : 0.4 });
          this.model.recoil = 1;
          this.lastFire = this.time;
          firing = true;
        } else this.fireCd = 0.2;
      }
      if (!I.fire && this.fireCd < 0) this.fireCd = 0;
    } else if (d.type === 'charger') {
      if (I.fire) {
        if (!this.charging) { this.charging = true; this.charge = 0; if (this.isPlayer) this.loops.charge = w.audio?.loop('charge'); }
        const canFull = this.ink >= d.ink;
        this.charge = Math.min(canFull ? 1 : 0.4, this.charge + dt / d.chargeTime);
        this.loops.charge?.setPitch(1 + this.charge);
        this.lastFire = this.time - 0.2;
      } else if (this.charging) {
        this.charging = false;
        this.stopLoop('charge');
        if (this.charge > 0.08) {
          const cost = d.ink * Math.max(0.3, this.charge);
          if (this.useInk(cost)) {
            w.combat.beam(this, this.muzzle(_muz), this.aimDir(_aim), d, this.charge);
            this.model.recoil = 1.5;
            this.lastFire = this.time;
            firing = true;
          }
        }
        this.charge = 0;
      }
    } else if (d.type === 'roller') {
      const pressed = I.fire && !this.prevFire;
      if (pressed && this.flickCd <= 0) {
        if (this.useInk(d.flickInk)) {
          const dir = this.aimDir(_aim);
          w.combat.flick(this, this.muzzle(_muz).setY(this.pos.y + 1.1), dir, d);
          w.audio?.sfx('roller_flick', { ...posOf(this.pos), volume: 0.6 });
          this.model.flick = 1;
          this.flickCd = d.flickRate;
          this.rollDelay = 0.38;
          this.lastFire = this.time;
          firing = true;
        }
      }
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (I.fire && this.onGround && this.rollDelay <= 0 && this.ink > 0.005) {
        this.rolling = true;
        this.lastFire = this.time;
        if (hs > 0.6) {
          this.ink = Math.max(0, this.ink - d.rollInk * dt);
          const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
          _v.set(this.pos.x + fx * 1.05, this.pos.y + 0.4, this.pos.z + fz * 1.05);
          const down = w.level.raycast(_v, _w.set(0, -1, 0), 1.2);
          if (down) w.combat.paint(this, down.point, d.rollWidth, { wobble: 0.08 });
          // flatten enemies in front
          for (const f of w.fighters) {
            if (!f.alive || f.team === this.team || f.invuln > 0) continue;
            const dx = f.pos.x - this.pos.x, dz = f.pos.z - this.pos.z;
            const fwd = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
            if (fwd > 0.2 && fwd < 1.6 && lat < 1.0 && Math.abs(f.pos.y - this.pos.y) < 1.2) {
              const last = this.rollHits.get(f) || -9;
              if (this.time - last > 0.4) { this.rollHits.set(f, this.time); w.combat.damage(f, hs > 2.5 ? d.rollDmg : 35, this, 'roll'); }
            }
          }
        }
        if (this.isPlayer) {
          if (!this.loops.roll) this.loops.roll = w.audio?.loop('roll');
          this.loops.roll?.setVolume(clamp(hs / 6, 0, 0.7));
        }
      } else {
        if (this.rolling && this.ink <= 0.005) this.noInk();
        this.rolling = false;
        this.stopLoop('roll');
      }
    }
    return firing;
  }

  throwSub() {
    const w = this.world;
    if (this.form !== 'kid') return;
    if (!this.useInk(SUBS.bomb.ink)) return;
    const dir = this.aimDir(_aim).clone();
    dir.y = Math.max(dir.y, -0.1) + 0.1;
    const o = _v.set(this.pos.x, this.pos.y + 1.3, this.pos.z).addScaledVector(dir, 0.4);
    w.combat.bomb(this, o.clone(), dir);
    this.lastFire = this.time;
  }

  useSpecial() {
    const w = this.world;
    this.specialReady = false;
    this.special = 0;
    this.ink = 1;
    this.stats.specials++;
    if (this.form === 'goo') this.form = 'kid';
    if (this.weapon.special === 'barrage') {
      let target = this.intent.aimPoint?.clone();
      if (!target || target.distanceTo(this.pos) > 26) {
        const d = this.aimDir(_aim);
        target = this.pos.clone().addScaledVector(d.setY(0).normalize(), 14);
      }
      const hgt = w.level.heightAt(target.x, target.z).y;
      target.y = Number.isFinite(hgt) ? hgt : this.pos.y;
      w.combat.barrage(this, target);
    } else {
      this.nova = { t: 0 };
      this.vel.y = 12; this.onGround = false;
      w.audio?.sfx('special_go', posOf(this.pos));
    }
    w.onSpecial?.(this);
  }

  addTurf(m2) {
    if (!this.alive) return;
    this.stats.turf += m2;
    if (!this.specialReady && !this.nova) {
      this.special += m2;
      if (this.special >= this.weapon.specialCost) {
        this.special = this.weapon.specialCost;
        this.specialReady = true;
        if (this.isPlayer) this.world.audio?.sfx('special_ready', { volume: 0.8 });
      }
    }
  }

  // ---------------------------------------------------------------- damage
  takeDamage(dmg, attacker, kind) {
    if (!this.alive || this.invuln > 0) return;
    if (this.nova) dmg *= 0.5;
    this.hp -= dmg;
    this.lastDamage = this.time;
    if (attacker && attacker !== this) { this.lastAttacker = attacker; this.lastAttackT = this.time; this.damagers.set(attacker, this.time); }
    this.model.flash();
    if (this.isPlayer) this.world.onPlayerHurt?.(dmg, attacker);
    if (this.hp <= 0) this.splatted(attacker, kind);
  }

  splatted(attacker, kind) {
    const w = this.world;
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.stats.deaths++;
    this.respawnT = 6;
    this.nova = null;
    this.charging = false; this.rolling = false; this.charge = 0;
    for (const k of Object.keys(this.loops)) this.stopLoop(k);
    this.model.root.visible = false;
    const col = attacker ? attacker.color : this.color;
    const p = this.pos.clone().setY(this.pos.y + 0.6);
    if (kind !== 'fall') {
      if (attacker) w.paint.splat(this.pos.clone().setY(this.pos.y + 0.1), 1.7, attacker.team, { drips: 2 });
      w.fx.explosion(p, col, 2.2);
      w.audio?.sfx('splatted', { ...posOf(p), volume: 0.9 });
    } else {
      w.fx.splash(p.setY(w.level.killY + 0.2), new THREE.Vector3(0, 1, 0), this.color, 20, 5, 0.1);
    }
    this.special = this.specialReady ? this.weapon.specialCost * 0.5 : this.special * 0.5;
    this.specialReady = false;
    if (attacker && attacker !== this) {
      attacker.stats.kills++;
      for (const [f, t] of this.damagers) if (f !== attacker && f.team !== this.team && this.time - t < 5) f.stats.assists++;
    }
    this.damagers.clear();
    w.onSplat?.(this, attacker, kind);
  }

  respawn() {
    this.alive = true;
    this.hp = 100; this.ink = 1;
    this.form = 'kid';
    this.invuln = 2.2;
    this.place(this.spawnPoint.clone().setY(this.spawnPoint.y + 0.05), this.spawnYaw);
    this.model.root.visible = true;
    const w = this.world;
    w.fx.ring(this.pos.clone().setY(this.pos.y + 0.05), this.color, 0.3, 2.2, 0.6, { alpha: 0.9 });
    w.fx.splash(this.pos.clone().setY(this.pos.y + 0.5), new THREE.Vector3(0, 1, 0), this.color, 14, 4, 0.08);
    if (this.isPlayer || this.near()) w.audio?.sfx('respawn', { ...posOf(this.pos), volume: 0.7 });
    w.onRespawn?.(this);
  }

  dispose() {
    for (const k of Object.keys(this.loops)) this.stopLoop(k);
    this.model.dispose();
  }
}
