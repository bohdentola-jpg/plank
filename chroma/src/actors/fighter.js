// A combatant (player or bot). Owns physics, ink/health, weapon handling and
// its Chromeleon model. Driven by an "intent" written by PlayerControl or a Bot.
import * as THREE from 'three';
import { Dripkin } from './character.js';
import { WEAPONS, SUBS, posOf } from './weapons.js';
import { gearMods, migrateLook } from './gear.js';
import { NONE } from '../world/paint.js';
import { clamp, damp, dampAngle, angleDiff, rand } from '../util.js';

const GRAV = 24;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _muz = new THREE.Vector3(), _aim = new THREE.Vector3(), _raw = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const CHARGE_TYPES = new Set(['charger', 'stringer', 'splatling']);

export class Fighter {
  constructor(world, { name, team, look, weapon = 'spritzer', isPlayer = false, color }) {
    this.world = world;
    this.name = name;
    this.team = team;
    this.look = migrateLook(look);
    this.mods = gearMods(this.look);
    this.isPlayer = isPlayer;
    this.weapon = WEAPONS[weapon] || WEAPONS.spritzer;
    this.model = new Dripkin(this.look, color || world.colors[team], this.weapon.id);
    this.model.weaponType = this.weapon.type;
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
    this.holdT = 0; this.shieldOpen = false; this.shieldHP = 0; this.shieldCd = 0;
    this.dodge = 0; this.dodgeDir = new THREE.Vector3(); this.dodges = 0; this.turretT = 0; this.alt = false;
    this.spray = { n: 0, t: 0 };
    this.jetT = 0; this.jetY = 0; this.camoT = 0;
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
    this.canFight = true;
    this.laser = null;
    this.shieldHP = this.weapon.shieldHP || 0;
    this.puppet = null; // 'host' (remote human seen by the host) | 'client' (anyone else seen by a client)
    this.netT = null; // latest network state target
    this.netId = -1;
  }

  // ---------------------------------------------------------------- networking
  // compact state: [x,y,z, vx,vy,vz, yaw, aimYaw, aimPitch, flags, charge, hp, special]
  netPack() {
    const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
    let f = 0;
    if (this.alive) f |= 1;
    if (this.form === 'goo') f |= 2;
    if (this.submerged) f |= 4;
    if (this.climbing) f |= 8;
    if (this.charging) f |= 16;
    if (this.rolling) f |= 32;
    if (this.shieldOpen) f |= 64;
    if (this.jetT > 0) f |= 128;
    if (this.camoT > 0) f |= 256;
    if (this.onGround) f |= 512;
    if (this.time - this.lastFire < 0.18) f |= 1024;
    if (this.specialReady) f |= 2048;
    if (this.spray.n > 0) f |= 4096;
    if (this.dodge > 0) f |= 8192;
    if (this.turretT > 0) f |= 16384;
    return [r2(this.pos.x), r2(this.pos.y), r2(this.pos.z), r2(this.vel.x), r2(this.vel.y), r2(this.vel.z),
      r3(this.yaw), r3(this.aimYaw), r3(this.aimPitch), f, r2(this.charge), Math.round(this.hp), Math.round(this.special)];
  }

  netApply(a) {
    this.netT = a;
    this.netAt = performance.now();
    if (!this.puppetInit) { this.puppetInit = true; this.pos.set(a[0], a[1], a[2]); this.yaw = a[6]; }
  }

  puppetUpdate(dt) {
    const a = this.netT;
    this.time += dt;
    if (!a) { this.syncModel(dt); return; }
    const f = a[9];
    const age = Math.min(0.15, (performance.now() - this.netAt) / 1000);
    const tx = a[0] + a[3] * age, ty = a[1] + a[4] * age, tz = a[2] + a[5] * age;
    const d2 = (tx - this.pos.x) ** 2 + (ty - this.pos.y) ** 2 + (tz - this.pos.z) ** 2;
    if (d2 > 16) this.pos.set(tx, ty, tz);
    else { const k = damp(14, dt); this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k; }
    this.vel.set(a[3], a[4], a[5]);
    this.yaw = dampAngle(this.yaw, a[6], 18, dt);
    this.aimYaw = this.intent.aimYaw = a[7];
    this.aimPitch = this.intent.aimPitch = a[8];
    this.form = f & 2 ? 'goo' : 'kid';
    this.submerged = !!(f & 4);
    this.climbing = !!(f & 8);
    this.charging = !!(f & 16);
    this.rolling = !!(f & 32);
    this.shieldOpen = !!(f & 64);
    this.jetT = f & 128 ? 1 : 0;
    this.camoT = f & 256 ? 1 : 0;
    this.onGround = !!(f & 512);
    this.spray.n = f & 4096 ? 1 : 0;
    this.dodge = f & 8192 ? 0.2 : 0;
    this.turretT = f & 16384 ? 0.2 : 0;
    this.charge = a[10];
    const firing = !!(f & 1024);
    if (firing) this.lastFire = this.time;
    if (this.puppet === 'client') {
      this.hp = a[11];
      this.special = a[12];
      this.specialReady = !!(f & 2048);
      const alive = !!(f & 1);
      if (alive && !this.alive) { this.alive = true; this.model.root.visible = true; }
      if (!alive && this.alive) { this.alive = false; this.model.root.visible = false; }
    }
    if (this.puppet === 'host') this.hostPuppetRules(dt);
    this.updateLaser();
    this.syncModel(dt, firing, Math.hypot(this.vel.x, this.vel.z));
  }

  // host-side rules for remote players: health regen, enemy-ink chip, respawn timer
  hostPuppetRules(dt) {
    const w = this.world;
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && w.canRespawn !== false) this.respawn();
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    let enemy = false;
    if (this.onGround && !this.jetT) {
      const g = w.level.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.05, 0.2, 0.3);
      const face = g.solid?.sideFace?.top;
      if (face) { const o = w.paint.ownerAt(face, this.pos); enemy = o !== NONE && o !== this.team; }
    }
    if (enemy && this.invuln <= 0) {
      const floor = 100 - 55 * this.mods.inkResist;
      if (this.hp > floor) { this.hp = Math.max(floor, this.hp - 16 * this.mods.inkResist * dt); this.lastDamage = this.time; }
    } else if (this.time - this.lastDamage > 1.1 && this.hp < 100) this.hp = Math.min(100, this.hp + (this.submerged ? 55 : 20) * dt);
  }

  get color() { return this.world.colors[this.team]; }

  setWeapon(id) {
    this.weapon = WEAPONS[id] || WEAPONS.spritzer;
    this.model.setWeapon(this.weapon.id, this.weapon.type);
    this.model.weaponType = this.weapon.type;
    this.charge = 0; this.charging = false; this.spray.n = 0; this.shieldOpen = false;
    this.shieldHP = this.weapon.shieldHP || 0;
  }

  setLook(look) {
    this.look = migrateLook(look);
    this.mods = gearMods(this.look);
    this.model.setLook(this.look);
    this.model.weaponType = this.weapon.type;
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
    if (this.puppet) { this.puppetUpdate(dt); return; }
    const w = this.world;
    this.time += dt;
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && w.canRespawn !== false) this.respawn();
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    if (this.shieldCd <= 0 && this.shieldHP <= 0) this.shieldHP = this.weapon.shieldHP || 0;
    const I = this.intent;
    this.aimYaw = I.aimYaw; this.aimPitch = I.aimPitch;
    const M = this.mods;

    // ---- what am I standing in?
    this.surface = NONE;
    if (this.onGround && this.groundSolid) {
      const face = this.groundSolid.sideFace?.top;
      if (face) this.surface = w.paint.ownerAt(face, this.pos);
    }
    const own = this.surface === this.team;
    const enemy = this.surface !== NONE && this.surface !== this.team;
    const d = this.weapon;

    // ---- specials with their own movement modes
    if (this.camoT > 0) { this.camoT -= dt; this.ink = Math.min(1, this.ink + 0.2 * dt); if (this.camoT <= 0) w.audio?.sfx('camo_off', posOf(this.pos)); }
    const jet = this.jetT > 0;

    // ---- form
    const wantGoo = I.goo && !this.nova && !jet && this.dodge <= 0;
    if (wantGoo && this.form === 'kid') {
      this.form = 'goo';
      this.charge = 0; this.charging = false; this.rolling = false; this.shieldOpen = false; this.spray.n = 0;
      if (this.isPlayer || this.near()) w.audio?.sfx('goo_in', { ...posOf(this.pos), volume: 0.6 });
      w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.4), _w.set(0, 1, 0), this.color, 6, 2.5, 0.07);
    } else if (!wantGoo && this.form === 'goo') {
      this.form = 'kid';
      if (this.isPlayer || this.near()) w.audio?.sfx('goo_out', { ...posOf(this.pos), volume: 0.6 });
      if (this.submerged) w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.2), _w.set(0, 1, 0), this.color, 8, 3, 0.07);
    }
    const goo = this.form === 'goo';

    // ---- dualie dodge roll (JUMP while firing + a direction)
    if (d.type === 'dualies' && I.jump && this.onGround && !goo && !jet && this.dodge <= 0 && this.dodges < 2 &&
        (I.fire || this.time - this.lastFire < 0.3) && Math.hypot(I.mx, I.mz) > 0.3) {
      if (this.useInk(d.rollInk)) {
        this.dodge = 0.32; this.dodges++;
        this.dodgeDir.set(I.mx, 0, I.mz).normalize();
        this.turretT = 0.9;
        I.jump = false;
        w.audio?.sfx('dodge_roll', { ...posOf(this.pos), volume: 0.6 });
        w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.1), _w.set(0, 1, 0), this.color, 8, 3, 0.07);
        this.paintUnder(0.7);
      }
    }

    // ---- weapons
    let firing = false;
    if (jet) firing = this.jetUpdate(dt);
    else if (!goo && this.canFight && this.dodge <= 0) firing = this.weaponUpdate(dt);
    else this.cancelWeapon();
    this.prevFire = I.fire;
    if (I.sub && this.canFight && !this.nova && !jet) this.throwSub();
    if (I.special && this.specialReady && this.canFight && !this.nova && !jet) this.useSpecial();
    this.updateLaser();

    // ---- movement speed
    let maxSp;
    const rec = this.time - this.lastFire < 0.35;
    const slowEnemy = (base, slow) => base - (base - slow) * M.inkResist;
    if (jet) maxSp = 6.5;
    else if (goo) maxSp = own ? 10.6 * M.swim : enemy ? 1.5 : (this.onGround ? 2.7 : 5);
    else {
      maxSp = (enemy ? slowEnemy(5.7, 2.4) : 5.7) * M.run;
      if (this.charging) maxSp *= d.chargeMoveMul || 0.5;
      else if (this.rolling) maxSp = enemy ? slowEnemy(d.rollSpeed, 2.6) : d.rollSpeed * M.run;
      else if (this.shieldOpen) maxSp *= 0.55;
      else if (this.spray.n > 0) maxSp *= d.moveMul;
      else if (rec) maxSp *= d.moveMul;
      if (this.turretT > 0 && this.dodge <= 0) maxSp = (I.fire || this.time - this.lastFire < 0.2) ? 0 : maxSp;
    }
    if (this.camoT > 0) maxSp *= 1.15;
    if (this.nova) maxSp = 3;
    let mx = I.mx, mz = I.mz;
    if (this.dodge > 0) {
      this.dodge -= dt;
      this.vel.x = this.dodgeDir.x * 17; this.vel.z = this.dodgeDir.z * 17;
      if (this.dodge <= 0) { this.vel.x *= 0.2; this.vel.z *= 0.2; }
    } else {
      if (this.turretT > 0) { this.turretT -= dt; if (this.turretT <= 0) this.dodges = 0; if (I.fire) this.turretT = Math.max(this.turretT, 0.25); }
      const tx = mx * maxSp, tz = mz * maxSp;
      const accel = this.onGround ? (goo && own ? 70 : 46) : jet ? 30 : 16;
      const dvx = tx - this.vel.x, dvz = tz - this.vel.z;
      const dl = Math.hypot(dvx, dvz);
      const maxDv = accel * dt;
      if (dl > maxDv) { this.vel.x += (dvx / dl) * maxDv; this.vel.z += (dvz / dl) * maxDv; } else { this.vel.x = tx; this.vel.z = tz; }
      if (!this.onGround && !jet && Math.hypot(this.vel.x, this.vel.z) > Math.max(maxSp, 6)) { this.vel.x *= 1 - 0.8 * dt; this.vel.z *= 1 - 0.8 * dt; }
    }

    // ---- climbing (dive form + own ink on the wall)
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
          this.vel.y = 6.8 * M.swim * Math.min(1, press + 0.2);
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
    if (I.jump && (this.onGround || this.climbing) && !jet) {
      if (this.climbing && wall) {
        this.vel.y = 7.4; this.vel.x += wall.nx * 4.5; this.vel.z += wall.nz * 4.5;
        this.climbing = false;
      } else {
        this.vel.y = goo && own ? 9.2 : enemy ? 5.4 + 2.5 * (1 - M.inkResist) : 7.9;
      }
      this.onGround = false;
      if (this.isPlayer || this.near()) w.audio?.sfx('jump', { ...posOf(this.pos), volume: 0.5 });
      if (goo) w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.1), _w.set(0, 1, 0), this.color, 7, 3.5, 0.07);
    }

    // ---- gravity + integrate
    if (jet) this.vel.y = clamp((this.jetY - this.pos.y) * 4, -6, 8);
    else if (!this.climbing) this.vel.y = Math.max(this.vel.y - GRAV * dt, -32);
    const wasGround = this.onGround;
    const r = goo ? 0.3 : 0.36;
    const h = goo ? 0.55 : 1.45;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.wall = w.level.collide(this.pos, this.vel, r, h, wasGround ? 0.5 : 0.3);
    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
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
      w.net?.action?.({ m: 'fell' }, this);
      this.splatted(recent, 'fall');
      return;
    }

    this.submerged = goo && ((this.onGround && this.surface === this.team) || this.climbing);

    // ---- ink + health
    const sinceFire = this.time - this.lastFire;
    if (this.submerged) this.ink += 0.36 * M.inkRecover * dt;
    else if (!this.charging && !this.rolling && !this.shieldOpen && this.spray.n === 0 && sinceFire > 0.6) this.ink += (goo ? 0.06 : 0.075) * M.inkRecover * dt;
    if (this.ink > 1) {
      if (this.isPlayer && this.ink - 0.36 * dt < 1 && this.submerged) w.audio?.sfx('ink_full', { volume: 0.4 });
      this.ink = 1;
    }
    if (this.onGround && enemy && this.invuln <= 0 && !jet) {
      const floor = 100 - 55 * M.inkResist;
      if (this.hp > floor) { this.hp = Math.max(floor, this.hp - 16 * M.inkResist * dt); this.lastDamage = this.time; }
      if (this.isPlayer && Math.random() < dt * 3) w.audio?.sfx('enemy_ink', { volume: 0.35 });
    } else if (this.time - this.lastDamage > 1.1 && this.hp < 100) {
      this.hp = Math.min(100, this.hp + (this.submerged ? 55 : 20) * dt);
    }

    // ---- facing
    const aimLock = !goo && (firing || this.charging || this.rolling || this.shieldOpen || this.spray.n > 0 || jet || this.turretT > 0 || this.time - this.lastFire < 0.5 || (this.isPlayer && I.aimHold));
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (aimLock) this.yaw = this.rolling ? dampAngle(this.yaw, this.aimYaw, d.type === 'brush' ? 9 : 6, dt) : dampAngle(this.yaw, this.aimYaw, 30, dt);
    else if (hs > 0.5) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), goo ? 16 : 12, dt);
    else if (this.isPlayer && !goo) this.yaw = dampAngle(this.yaw, this.aimYaw, 3, dt);

    // ---- effects
    this.fxT -= dt;
    if (this.fxT <= 0) {
      if (jet) {
        this.fxT = 0.04;
        w.fx.spawn(_v.set(this.pos.x, this.pos.y + 0.6, this.pos.z), _w.set(rand(-0.5, 0.5), -6, rand(-0.5, 0.5)), this.color, 0.09, 0.5, { stretch: 2 });
      } else if (this.submerged && hs > 2) {
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
    if (this.isPlayer) this.updateLoops(hs);
    this.syncModel(dt, firing, hs);
  }

  near() { return this.world.listener ? this.pos.distanceToSquared(this.world.listener) < 900 : false; }

  onLand(speed) {
    const w = this.world;
    if (this.isPlayer || this.near()) w.audio?.sfx(speed > 12 ? 'land_heavy' : 'land', { ...posOf(this.pos), volume: 0.5 });
    if (this.form === 'goo' || speed > 9) w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.05), _w.set(0, 1, 0), this.color, 6, 2.5, 0.06);
  }

  paintUnder(r) {
    const down = this.world.level.raycast(_v.set(this.pos.x, this.pos.y + 0.4, this.pos.z), _w.set(0, -1, 0), 1.5);
    if (down) this.world.combat.paint(this, down.point, r);
  }

  updateLoops(hs) {
    const a = this.world.audio;
    if (!a) return;
    if (this.submerged && hs > 1) { if (!this.loops.swim) this.loops.swim = a.loop('swim'); this.loops.swim.setVolume(clamp(hs / 10, 0.2, 0.8)); }
    else this.stopLoop('swim');
    if (this.jetT > 0) { if (!this.loops.jet) this.loops.jet = a.loop('jetpack'); } else this.stopLoop('jet');
  }

  stopLoop(n) { if (this.loops[n]) { this.loops[n].stop(); this.loops[n] = null; } }

  syncModel(dt, firing = false, hs = 0) {
    const m = this.model;
    if (this.world.listener) m.lodFor(this.world.listener);
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    m.root.visible = this.alive;
    const back = hs > 0.5 && Math.cos(angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z))) < -0.3;
    m.setInk(this.ink);
    if (this.form === 'goo' && this.climbing && this.wall) m.root.rotation.y = Math.atan2(-this.wall.nx, -this.wall.nz);
    // chameleon camo: nearly invisible (a little more visible to its own player)
    const camoA = this.camoT > 0 ? (this.isPlayer || this.team === this.world.viewTeam ? 0.28 : 0.04 + Math.max(0, Math.sin(this.time * 9)) * 0.03) : 1;
    m.setCamo(camoA);
    m.update(dt, {
      speed: hs, back, grounded: this.onGround || this.climbing, vy: this.vel.y, pitch: this.aimPitch,
      aiming: (this.time - this.lastFire < 0.5) || this.charging || this.shieldOpen || this.spray.n > 0 || this.turretT > 0 || (this.isPlayer && this.intent.aimHold),
      firing, weapon: this.weapon.id, wtype: this.weapon.type,
      goo: this.form === 'goo', submerged: this.submerged, climbing: this.climbing, rolling: this.rolling,
      charge: this.charge, shield: this.shieldOpen, dodge: this.dodge > 0 ? 1 - this.dodge / 0.32 : 0, jet: this.jetT > 0,
      chroma: this.world.chroma ?? 0.22,
    });
    if (this.submerged && !this.climbing) {
      const show = hs > 6 ? 1 : 0.35;
      m.goo.position.y = -0.1 * (1 - show);
    } else m.goo.position.y = 0;
  }

  // ---------------------------------------------------------------- weapons
  aimDir(out) {
    const I = this.intent;
    this.model.muzzleWorld(_raw);
    if (I.aimPoint) {
      out.subVectors(I.aimPoint, _raw);
      const dd = out.length();
      if (dd > 1.2) return out.divideScalar(dd);
    }
    const cp = Math.cos(this.aimPitch);
    return out.set(Math.sin(this.aimYaw) * cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw) * cp);
  }

  muzzle(out, left = false) {
    this.model.muzzleWorld(out, left);
    _v.set(this.pos.x, this.pos.y + 1.05, this.pos.z);
    _w.subVectors(out, _v);
    const dd = _w.length();
    if (dd > 0.01) {
      const hit = this.world.level.raycast(_v, _w.clone().divideScalar(dd), dd);
      if (hit) out.copy(_v).addScaledVector(_w, Math.max(0, hit.t - 0.1) / dd);
    }
    return out;
  }

  useInk(cost, sub = false) {
    cost *= sub ? this.mods.subInk : this.mods.inkUse;
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

  cancelWeapon() {
    this.charging = false; this.charge = 0; this.rolling = false; this.shieldOpen = false; this.spray.n = 0; this.holdT = 0;
    this.stopLoop('charge'); this.stopLoop('roll');
  }

  sfxShot(name, o, vol = 0.45) { this.world.audio?.sfx(name, { ...posOf(o), volume: this.isPlayer ? vol + 0.1 : vol }); }

  weaponUpdate(dt) {
    const w = this.world, d = this.weapon, I = this.intent;
    this.fireCd -= dt; this.flickCd -= dt; this.rollDelay -= dt;
    let firing = false;
    const air = !this.onGround;
    const pressed = I.fire && !this.prevFire;
    this.holdT = I.fire ? this.holdT + dt : 0;
    switch (d.type) {
      case 'shooter': case 'blaster': case 'slosher': case 'dualies': {
        if (I.fire && this.fireCd <= 0) {
          if (this.useInk(d.ink)) {
            this.fireCd += d.rate;
            if (this.fireCd < -0.05) this.fireCd = d.rate;
            const dir = this.aimDir(_aim);
            if (d.type === 'dualies') {
              this.alt = !this.alt;
              const o = this.muzzle(_muz, this.alt);
              w.combat.shooter(this, o, dir, d, air, this.turretT > 0 && this.dodge <= 0 ? 0.35 : 1);
              if (this.alt) this.model.recoilL = 1; else this.model.recoil = 1;
              this.sfxShot('dualie_shot', o, 0.4);
            } else {
              const o = this.muzzle(_muz);
              if (d.type === 'shooter') { w.combat.shooter(this, o, dir, d, air); this.sfxShot('shoot', o); }
              else if (d.type === 'blaster') { w.combat.blaster(this, o, dir, d); this.sfxShot('shoot_heavy', o, 0.5); }
              else { w.combat.slosh(this, o, dir, d); this.model.flick = 1; this.sfxShot('slosh', o, 0.55); }
              this.model.recoil = 1;
            }
            this.lastFire = this.time;
            firing = true;
          } else this.fireCd = 0.2;
        }
        if (!I.fire && this.fireCd < 0) this.fireCd = 0;
        break;
      }
      case 'splatling': {
        if (this.spray.n > 0) {
          if (pressed) this.spray.n = 0; // interrupt to re-charge
          this.spray.t -= dt;
          while (this.spray.n > 0 && this.spray.t <= 0) {
            if (!this.useInk(d.ink)) { this.spray.n = 0; break; }
            const dir = this.aimDir(_aim), o = this.muzzle(_muz);
            w.combat.shooter(this, o, dir, d, air);
            if (this.spray.n % 2 === 0) this.sfxShot('splatling_fire', o, 0.4);
            this.spray.n--; this.spray.t += d.rate;
            this.model.recoil = 0.6;
          }
          this.lastFire = this.time;
          firing = true;
        }
        if (I.fire && this.spray.n === 0) {
          if (!this.charging) { this.charging = true; this.charge = 0; if (this.isPlayer) this.loops.charge = w.audio?.loop('splatling_spin'); }
          const maxC = clamp(this.ink / (d.maxShots * d.ink * this.mods.inkUse), 0.15, 1);
          this.charge = Math.min(maxC, this.charge + dt / d.chargeTime);
          this.loops.charge?.setPitch(1 + this.charge);
          this.lastFire = this.time - 0.2;
        } else if (this.charging) {
          this.charging = false;
          this.stopLoop('charge');
          if (this.charge > 0.1 && w.combatOn !== false) this.spray = { n: Math.max(3, Math.round(d.maxShots * this.charge)), t: 0 };
          this.charge = 0;
        }
        break;
      }
      case 'charger': case 'stringer': {
        if (I.fire) {
          if (!this.charging) { this.charging = true; this.charge = 0; if (this.isPlayer) this.loops.charge = w.audio?.loop(d.type === 'stringer' ? 'bow_draw' : 'charge'); }
          const canFull = this.ink >= d.ink * this.mods.inkUse;
          this.charge = Math.min(canFull ? 1 : 0.39, this.charge + dt / d.chargeTime);
          this.loops.charge?.setPitch(1 + this.charge);
          this.lastFire = this.time - 0.2;
        } else if (this.charging) {
          this.charging = false;
          this.stopLoop('charge');
          if (this.charge > 0.08 && w.combatOn !== false) {
            const cost = d.ink * Math.max(0.3, this.charge);
            if (this.useInk(cost)) {
              const dir = this.aimDir(_aim), o = this.muzzle(_muz);
              if (d.type === 'charger') w.combat.beam(this, o, dir, d, this.charge);
              else { w.combat.arrows(this, o, dir, d, this.charge); this.sfxShot('bow_release', o, 0.55); }
              this.model.recoil = 1.5;
              this.lastFire = this.time;
              firing = true;
            }
          }
          this.charge = 0;
        }
        break;
      }
      case 'roller': case 'brush': {
        const brush = d.type === 'brush';
        if (pressed && this.flickCd <= 0 && this.useInk(d.flickInk)) {
          const dir = this.aimDir(_aim);
          const vertical = !brush && air;
          w.combat.flick(this, this.muzzle(_muz).setY(this.pos.y + 1.1), dir, d, vertical);
          w.audio?.sfx(brush ? 'brush_swish' : 'roller_flick', { ...posOf(this.pos), volume: 0.6 });
          this.model.flick = 1; this.model.flickKind = vertical ? 'v' : 'h';
          this.flickCd = d.flickRate;
          this.rollDelay = brush ? 0.12 : 0.38;
          this.lastFire = this.time;
          firing = true;
        }
        const hs = Math.hypot(this.vel.x, this.vel.z);
        if (I.fire && this.onGround && this.rollDelay <= 0 && this.ink > 0.005) {
          this.rolling = true;
          this.lastFire = this.time;
          if (hs > 0.6) {
            this.ink = Math.max(0, this.ink - d.rollInk * this.mods.inkUse * dt);
            const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
            const reach = brush ? 0.75 : 1.05;
            _v.set(this.pos.x + fx * reach, this.pos.y + 0.4, this.pos.z + fz * reach);
            const down = w.level.raycast(_v, _w.set(0, -1, 0), 1.2);
            if (down) w.combat.paint(this, down.point, d.rollWidth, { wobble: 0.08 });
            for (const f of w.fighters) {
              if (!f.alive || f.team === this.team || f.invuln > 0) continue;
              const dx = f.pos.x - this.pos.x, dz = f.pos.z - this.pos.z;
              const fwd = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
              if (fwd > 0.2 && fwd < (brush ? 1.2 : 1.6) && lat < d.rollWidth + 0.05 && Math.abs(f.pos.y - this.pos.y) < 1.2) {
                const last = this.rollHits.get(f) || -9;
                if (this.time - last > d.rollHitCd) { this.rollHits.set(f, this.time); w.combat.damage(f, hs > 2.5 ? d.rollDmg : 30, this, 'roll'); }
              }
            }
          }
          if (this.isPlayer) {
            if (!this.loops.roll) this.loops.roll = w.audio?.loop('roll');
            this.loops.roll?.setVolume(clamp(hs / 6, 0, brush ? 0.4 : 0.7));
            this.loops.roll?.setPitch(brush ? 1.6 : 1);
          }
        } else {
          if (this.rolling && this.ink <= 0.005) this.noInk();
          this.rolling = false;
          this.stopLoop('roll');
        }
        break;
      }
      case 'brella': {
        if (pressed && this.fireCd <= 0 && !this.shieldOpen) {
          if (this.useInk(d.ink)) {
            const dir = this.aimDir(_aim), o = this.muzzle(_muz);
            w.combat.brella(this, o, dir, d);
            this.sfxShot('brella_shot', o, 0.55);
            this.fireCd = d.rate; this.model.recoil = 1.2;
            this.lastFire = this.time;
            firing = true;
          }
        }
        const wantShield = I.fire && this.holdT > 0.35 && this.shieldCd <= 0 && this.shieldHP > 0 && this.ink > 0.02;
        if (wantShield && !this.shieldOpen) w.audio?.sfx('brella_open', { ...posOf(this.pos), volume: 0.5 });
        this.shieldOpen = wantShield;
        if (this.shieldOpen) { this.ink = Math.max(0, this.ink - d.shieldInk * dt); this.lastFire = this.time; }
        break;
      }
      case 'splatana': {
        if (pressed && this.fireCd <= 0) {
          if (this.useInk(d.ink)) {
            const dir = this.aimDir(_aim);
            w.combat.slash(this, this.muzzle(_muz), dir, d, false);
            w.audio?.sfx('blade_slash', { ...posOf(this.pos), volume: 0.55 });
            this.model.flick = 1; this.model.flickKind = 'h';
            this.fireCd = d.rate;
            this.lastFire = this.time;
            firing = true;
          }
        }
        if (I.fire && this.holdT > 0.2) {
          this.charging = true;
          this.charge = Math.min(this.ink >= d.chopInk ? 1 : 0.5, (this.holdT - 0.2) / d.chargeTime);
          this.lastFire = this.time - 0.2;
        } else if (this.charging) {
          this.charging = false;
          if (this.charge >= 0.999 && w.combatOn !== false && this.useInk(d.chopInk)) {
            const dir = this.aimDir(_aim);
            w.combat.slash(this, this.muzzle(_muz), dir, d, true);
            w.audio?.sfx('blade_charge_slash', { ...posOf(this.pos), volume: 0.7 });
            this.model.flick = 1; this.model.flickKind = 'v';
            this.fireCd = d.rate;
            this.lastFire = this.time;
            firing = true;
          }
          this.charge = 0;
        }
        break;
      }
    }
    return firing;
  }

  shieldHit(dmg) {
    this.shieldHP -= dmg;
    if (this.shieldHP <= 0) {
      this.shieldOpen = false;
      this.shieldCd = this.weapon.shieldCd || 6;
      this.world.audio?.sfx('shield_break', posOf(this.pos));
      this.world.fx.splash(this.pos.clone().setY(this.pos.y + 1), new THREE.Vector3(0, 1, 0), this.color, 14, 4, 0.08);
    }
  }

  // charger laser sight: visible to everyone, gives away the sniper
  updateLaser() {
    const on = this.charging && this.weapon.type === 'charger' && this.alive;
    if (!on) { if (this.laser) this.laser.visible = false; return; }
    if (!this.laser) {
      const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5);
      this.laser = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.55, depthWrite: false }));
      this.laser.frustumCulled = false;
      this.world.scene.add(this.laser);
    }
    const o = this.muzzle(_muz), dir = this.aimDir(_aim);
    const d = this.weapon;
    const range = d.minRange + (d.maxRange - d.minRange) * this.charge;
    const hit = this.world.level.raycast(o, dir, range);
    const len = hit ? hit.t : range;
    this.laser.visible = true;
    this.laser.position.copy(o);
    this.laser.quaternion.setFromUnitVectors(_zAxis, dir);
    const th = 0.012 + this.charge * 0.012;
    this.laser.scale.set(th, th, len);
    this.laser.material.color.copy(this.color).multiplyScalar(this.charge >= 0.999 ? 3 : 1.6);
  }

  // Jet Pack special: hover and fire explosive shots
  jetUpdate(dt) {
    const w = this.world, I = this.intent;
    this.jetT -= dt;
    this.fireCd -= dt;
    let firing = false;
    if (I.fire && this.fireCd <= 0) {
      const dir = this.aimDir(_aim), o = this.muzzle(_muz);
      w.combat.blaster(this, o, dir, this.weapon, { speed: 24, direct: 125, splash: 55, blastR: 2.6, splat: 1.7, range: 40, grav: 1 });
      this.sfxShot('shoot_heavy', o, 0.6);
      this.fireCd = 0.5; this.model.recoil = 1;
      this.lastFire = this.time;
      firing = true;
    }
    if (this.jetT <= 0) { this.jetT = 0; this.stopLoop('jet'); }
    return firing;
  }

  throwSub() {
    const w = this.world;
    if (this.form !== 'kid' || this.dodge > 0) return;
    const kind = this.weapon.sub || 'bomb';
    if (!this.useInk(SUBS[kind].ink, true)) return;
    const dir = this.aimDir(_aim).clone();
    dir.y = Math.max(dir.y, -0.1) + (kind === 'skid' ? 0 : 0.1);
    const o = _v.set(this.pos.x, this.pos.y + (kind === 'skid' ? 0.4 : 1.3), this.pos.z).addScaledVector(dir.clone().setY(0).normalize(), 0.4);
    w.combat.throwSub(this, kind, o.clone(), dir);
    this.lastFire = this.time;
  }

  useSpecial() {
    const w = this.world;
    w.net?.action?.({ m: 'special' }, this);
    this.specialReady = false;
    this.special = 0;
    this.ink = 1;
    this.stats.specials++;
    if (this.form === 'goo') this.form = 'kid';
    this.cancelWeapon();
    const sp = this.weapon.special;
    const aimTarget = () => {
      let target = this.intent.aimPoint?.clone();
      if (!target || target.distanceTo(this.pos) > 26) {
        const dd = this.aimDir(_aim).clone().setY(0).normalize();
        target = this.pos.clone().addScaledVector(dd, 13);
      }
      const hgt = w.level.heightAt(target.x, target.z).y;
      target.y = Number.isFinite(hgt) ? hgt : this.pos.y;
      return target;
    };
    if (sp === 'barrage') w.combat.barrage(this, aimTarget());
    else if (sp === 'rain') w.combat.rainCloud(this, aimTarget(), this.aimDir(_aim).clone());
    else if (sp === 'shield') w.combat.bubble(this);
    else if (sp === 'camo') { this.camoT = 8; w.audio?.sfx('camo_on', posOf(this.pos)); w.fx.splash(this.pos.clone().setY(this.pos.y + 0.8), new THREE.Vector3(0, 1, 0), this.color, 16, 3, 0.07); }
    else if (sp === 'jetpack') {
      const gy = w.level.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3, 0.3, 0.6).y;
      this.jetY = (Number.isFinite(gy) ? gy : this.pos.y) + 5.2;
      this.jetT = 7; this.fireCd = 0;
      this.onGround = false;
      w.audio?.sfx('jetpack_start', posOf(this.pos));
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
    if (!this.specialReady && !this.nova && this.jetT <= 0 && this.camoT <= 0) {
      this.special += m2 * this.mods.special;
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
    if (this.jetT > 0) dmg *= 0.7;
    this.hp -= dmg;
    this.lastDamage = this.time;
    if (attacker && attacker !== this) { this.lastAttacker = attacker; this.lastAttackT = this.time; this.damagers.set(attacker, this.time); }
    if (this.camoT > 0 && dmg > 10) this.camoT = Math.min(this.camoT, 0.6); // getting hit breaks camo
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
    this.respawnT = 6 - this.mods.respawn;
    this.nova = null; this.jetT = 0; this.camoT = 0; this.dodge = 0; this.turretT = 0;
    this.cancelWeapon();
    this.updateLaser();
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
    if (attacker && attacker !== this && attacker.stats) {
      attacker.stats.kills++;
      for (const [f, t] of this.damagers) if (f !== attacker && f.team !== this.team && this.time - t < 5 && f.stats) f.stats.assists++;
    }
    this.damagers.clear();
    w.onSplat?.(this, attacker, kind);
  }

  respawn() {
    this.alive = true;
    this.hp = 100; this.ink = 1;
    this.form = 'kid';
    this.invuln = 2.2;
    this.shieldHP = this.weapon.shieldHP || 0; this.shieldCd = 0;
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
    if (this.laser) { this.world.scene.remove(this.laser); this.laser.geometry.dispose(); this.laser.material.dispose(); }
    this.model.dispose();
  }
}
