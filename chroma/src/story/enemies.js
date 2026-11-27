// The Drab: colourless goo creatures. Duck-typed combat targets (team 2) that
// Combat projectiles, bombs and beams can hit, exactly like Fighters.
import * as THREE from 'three';
import { part, std, gooMat, glowMat, OUTLINE_S, OUTLINE_M, posOf, disposeTree } from './kit.js';

export const GRAY_HEX = 0x8b8794;
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const GRAV = 24;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);
const rand = (a, b) => a + Math.random() * (b - a);
const angleTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// Blob definitions handed to Combat.blaster (field names follow the blaster weapon defs)
export const BLOTTER_BLOB = { speed: 14, range: 26, dmgDirect: 42, dmgSplash: 22, blastR: 1.8, splat: 1.25 };
export const BIG_BLOB = { speed: 16, range: 30, dmgDirect: 46, dmgSplash: 24, blastR: 2.1, splat: 1.5 };
export const DRONE_DROP = { speed: 12, range: 22, dmgDirect: 42, dmgSplash: 26, blastR: 2.2, splat: 1.8 };

export class Drab {
  constructor(world, pos, o = {}) {
    this.world = world;
    this.team = 2;
    this.name = 'Drab';
    this.pos = pos.clone();
    this.home = pos.clone();
    this.vel = new THREE.Vector3();
    this.alive = true; this.invuln = 0; this.hp = this.maxHp = o.hp || 100;
    this.submerged = false; this.form = 'kid'; this.climbing = false;
    this.time = Math.random() * 10; this.lastAttacker = null; this.lastAttackT = -9;
    this.stats = { kills: 0, deaths: 0, turf: 0, assists: 0, specials: 0 };
    this.group = o.group || null;
    this.yaw = o.yaw ?? rand(0, Math.PI * 2);
    this.root = new THREE.Group();
    this.root.position.copy(pos);
    world.scene.add(this.root);
    this.flashMats = [];
    this.flash = 0;
    this.spawnK = o.spawnIn ? 0 : 1;
    this.aggro = false;
    this.losT = Math.random() * 0.3;
  }
  get color() { return this.world.colors[2]; }
  hitHeight() { return 1; }
  center(out = _v) { return out.copy(this.pos).setY(this.pos.y + this.hitHeight() * 0.55); }
  trackFlash(m) { this.flashMats.push({ m, base: m.emissive.clone() }); return m; }

  takeDamage(dmg, attacker, kind) {
    if (!this.alive || this.invuln > 0) return;
    this.hp -= dmg;
    this.flash = 1;
    if (attacker && attacker !== this) { this.lastAttacker = attacker; this.lastAttackT = this.time; this.aggro = true; }
    this.world.onEnemyHurt?.(this, dmg, attacker);
    if (this.hp <= 0) this.die(attacker, kind);
  }

  die(attacker, kind) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    const w = this.world;
    const c = this.center(new THREE.Vector3());
    if (kind !== 'fall') {
      const painter = attacker && attacker.team !== this.team ? attacker : w.player;
      w.fx.explosion(c, GRAY_HEX, 1.5);
      w.fx.splash(c, UP, painter ? painter.color : GRAY_HEX, 22, 6, 0.1, 1.2);
      const down = w.level.raycast(c, DOWN, 24);
      if (down && painter) w.combat.paint(painter, down.point, 2.1, { drips: 2 });
      w.audio?.sfx('enemy_pop', { ...posOf(c), volume: 0.9 });
    }
    this.root.visible = false;
    w.onEnemyDefeated?.(this, attacker, kind);
  }

  updateCommon(dt) {
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 7);
      const k = this.flash;
      for (const { m, base } of this.flashMats) m.emissive.copy(base).lerp(WHITE, k * 0.85);
    }
    if (this.spawnK < 1) {
      this.spawnK = Math.min(1, this.spawnK + dt * 2.2);
      const s = this.spawnK;
      this.root.scale.setScalar(Math.max(0.01, s * (1 + Math.sin(s * Math.PI) * 0.3)));
    }
  }

  // line of sight / distance check towards the player, throttled
  sense(player, range, eyeY, dt) {
    this.losT -= dt;
    if (this.losT > 0) return this.aggro;
    this.losT = 0.25;
    if (!player.alive) { this.aggro = false; return false; }
    const d = this.pos.distanceTo(player.pos);
    if (d > range) { this.aggro = false; return false; }
    _a.copy(this.pos).setY(this.pos.y + eyeY);
    _w.copy(player.pos).setY(player.pos.y + 0.6);
    this.aggro = this.world.level.visible(_a, _w);
    return this.aggro;
  }

  dispose() { disposeTree(this.root); }
}

// ---------------------------------------------------------------- Smudge
// A hopping goo blob with big eyes that bites at close range.
export class Smudge extends Drab {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 95, ...o });
    this.name = 'Smudge';
    const body = this.body = new THREE.Group();
    this.root.add(body);
    const bodyMat = this.trackFlash(gooMat(GRAY_HEX));
    this.blob = part(body, new THREE.SphereGeometry(0.55, 24, 18), bodyMat, { pos: [0, 0.5, 0], scale: [1.1, 0.86, 1.1], outline: OUTLINE_M });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      part(body, new THREE.SphereGeometry(0.15 + (i % 2) * 0.05, 10, 8), bodyMat, { pos: [Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5], scale: [1, 0.7, 1], shadow: false });
    }
    const white = std(0xffffff, 0.2), dark = std(0x1b1530, 0.4);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = part(body, new THREE.SphereGeometry(0.16, 16, 12), white, { pos: [0.21 * s, 0.7, 0.44], outline: OUTLINE_S });
      part(e, new THREE.SphereGeometry(0.08, 10, 8), dark, { pos: [0, -0.01, 0.11], shadow: false });
      this.eyes.push(e);
      const brow = part(body, new THREE.BoxGeometry(0.24, 0.06, 0.06), dark, { pos: [0.2 * s, 0.9, 0.48], rot: [0, 0, -0.45 * s], shadow: false });
      brow.userData.side = s;
    }
    this.mouth = new THREE.Group();
    this.mouth.position.set(0, 0.42, 0.52);
    body.add(this.mouth);
    part(this.mouth, new THREE.SphereGeometry(0.2, 14, 8), std(0x2a1d2e, 0.6), { scale: [1.2, 0.5, 0.4], shadow: false });
    for (const x of [-0.11, 0, 0.11]) part(this.mouth, new THREE.ConeGeometry(0.04, 0.09, 6), white, { pos: [x, 0.06, 0.04], rot: [Math.PI, 0, 0], shadow: false });
    this.mouth.scale.y = 0.3;
    this.state = 'idle';
    this.t = 0;
    this.hopT = rand(0.3, 1.2);
    this.cool = 0;
    this.onGround = true;
    this.squash = 0;
    this.biteHit = false;
    this.wanderDir = new THREE.Vector3();
  }
  hitHeight() { return 0.95; }

  canLand(dir, dist) {
    const L = this.world.level;
    for (const k of [0.5, 1]) {
      const h = L.heightAt(this.pos.x + dir.x * dist * k, this.pos.z + dir.z * dist * k).y;
      if (!Number.isFinite(h) || h > this.pos.y + 1.0 || h < this.pos.y - 1.4) return false;
    }
    return true;
  }

  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const p = ctx.player, L = this.world.level;
    const aggro = this.sense(p, this.group === 'boss' ? 60 : 15, 0.7, dt);
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz), dy = p.pos.y - this.pos.y;
    this.cool -= dt;
    if (this.onGround && this.spawnK >= 1) {
      if (this.state === 'windup') {
        this.t -= dt;
        if (this.t <= 0) {
          this.state = 'bite';
          this.biteHit = false;
          const d = Math.max(dist, 0.01);
          this.vel.set((dx / d) * 5.2, 3.6, (dz / d) * 5.2);
          this.onGround = false;
          this.world.audio?.sfx('enemy_bite', { ...posOf(this.pos), volume: 0.7 });
        }
      } else if (aggro && p.alive && dist < 1.8 && Math.abs(dy) < 1.2 && this.cool <= 0) {
        this.state = 'windup';
        this.t = 0.42;
      } else {
        this.hopT -= dt;
        if (this.hopT <= 0) {
          const dir = this.wanderDir;
          let go = false;
          if (aggro && p.alive) {
            dir.set(dx, 0, dz).normalize().applyAxisAngle(UP, rand(-0.35, 0.35));
            go = true;
          } else {
            const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z;
            if (Math.hypot(hx, hz) > 4) { dir.set(hx, 0, hz).normalize(); go = true; }
            else if (Math.random() < 0.55) { const a = rand(0, Math.PI * 2); dir.set(Math.cos(a), 0, Math.sin(a)); go = true; }
          }
          const hop = aggro ? 2.3 : 1.5;
          if (go && !this.canLand(dir, hop)) {
            go = false;
            for (const turn of [0.8, -0.8, 1.6, -1.6]) {
              _a.copy(dir).applyAxisAngle(UP, turn);
              if (this.canLand(_a, hop)) { dir.copy(_a); go = true; break; }
            }
          }
          if (go) {
            const sp = aggro ? 4.4 : 2.6;
            this.vel.set(dir.x * sp, aggro ? 6.4 : 5.2, dir.z * sp);
            this.onGround = false;
            this.state = 'hop';
            this.yawTarget = Math.atan2(dir.x, dir.z);
          }
          this.hopT = aggro ? rand(0.12, 0.3) : rand(0.8, 2.2);
        }
      }
    }
    // bite contact
    if (this.state === 'bite' && !this.biteHit && p.alive && dist < 1.45 && Math.abs(dy) < 1.3) {
      this.biteHit = true;
      this.world.combat.damage(p, 30, this, 'bite');
      const d = Math.max(dist, 0.01);
      p.vel.x += (dx / d) * 4.5; p.vel.z += (dz / d) * 4.5; p.vel.y = Math.max(p.vel.y, 3.2);
    }
    // face the player when aggro
    const wantYaw = aggro && p.alive ? Math.atan2(dx, dz) : (this.yawTarget ?? this.yaw);
    this.yaw += angleTo(this.yaw, wantYaw) * (1 - Math.exp(-10 * dt));
    // physics
    if (!this.onGround) {
      this.vel.y -= GRAV * dt;
      const prevY = this.pos.y;
      // horizontal move + wall push at the old height, then fall (same order as Fighter)
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      L.collide(this.pos, this.vel, 0.48, 0.9, 0.3);
      this.pos.y += this.vel.y * dt;
      const g = L.groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y), 0.25, 0.12);
      if (g.solid && this.vel.y <= 0 && this.pos.y <= g.y + 0.001) {
        this.pos.y = g.y;
        this.vel.set(0, 0, 0);
        this.onGround = true;
        this.squash = 1;
        if (this.state === 'bite') { this.state = 'idle'; this.cool = 1.0; }
        else this.state = 'idle';
        if (Math.random() < 0.7) this.world.combat.paint(this, _a.copy(this.pos).setY(this.pos.y + 0.05), 0.55, { wobble: 0.3 });
        if (ctx.near(this.pos)) this.world.audio?.sfx('land', { ...posOf(this.pos), volume: 0.25, pitch: 1.6 });
      }
    } else {
      const g = L.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.25, 0.5);
      if (!g.solid || g.y < this.pos.y - 0.3) this.onGround = false;
    }
    if (this.pos.y < L.killY) { this.die(null, 'fall'); return; }
    // keep smudges from stacking
    for (const o of ctx.enemies) {
      if (o === this || !o.alive || !(o instanceof Smudge)) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 0.95 && od > 0.001 && Math.abs(this.pos.y - o.pos.y) < 0.8) { this.pos.x += (ox / od) * (0.95 - od) * 0.5; this.pos.z += (oz / od) * (0.95 - od) * 0.5; }
    }
    // animation
    this.squash = Math.max(0, this.squash - dt * 5);
    const air = !this.onGround;
    let sy = 1, sxz = 1;
    if (air) { sy = 1.12 + Math.min(0.12, Math.abs(this.vel.y) * 0.015); sxz = 0.92; }
    else { sy = 1 - this.squash * 0.32 + Math.sin(this.time * 5) * 0.03; sxz = 1 + this.squash * 0.22; }
    if (this.state === 'windup') { const k = 1 - this.t / 0.42; sy *= 1 - k * 0.2; sxz *= 1 + k * 0.18; this.body.position.x = Math.sin(this.time * 70) * 0.04; }
    else this.body.position.x = 0;
    this.body.scale.set(sxz, sy, sxz);
    const open = this.state === 'windup' ? 0.6 + (1 - this.t / 0.42) * 0.6 : this.state === 'bite' ? 1.4 : 0.25 + (aggro ? 0.15 : 0);
    this.mouth.scale.y += (open - this.mouth.scale.y) * (1 - Math.exp(-18 * dt));
    for (const e of this.eyes) e.scale.y = (Math.sin(this.time * 0.9 + this.home.x) > 0.985) ? 0.15 : 1;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
}

// ---------------------------------------------------------------- Blotter
// A stationary turret that lobs straight gray blobs at the player.
export class Blotter extends Drab {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: o.big ? 380 : 170, ...o });
    this.big = !!o.big;
    this.name = this.big ? 'Big Blotter' : 'Blotter';
    const S = this.S = this.big ? 1.45 : 1;
    this.root.scale.setScalar(S);
    this.baseScale = S;
    const metal = this.trackFlash(std(0x4a4652, 0.45, 0.7));
    const gooM = this.trackFlash(gooMat(GRAY_HEX));
    part(this.root, new THREE.CylinderGeometry(0.85, 0.95, 0.36, 20), metal, { pos: [0, 0.18, 0], outline: OUTLINE_M });
    part(this.root, new THREE.CylinderGeometry(0.62, 0.72, 1.0, 20), gooM, { pos: [0, 0.86, 0], outline: OUTLINE_M });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      part(this.root, new THREE.CapsuleGeometry(0.1, 0.3 + (i % 2) * 0.25, 4, 8), gooM, { pos: [Math.cos(a) * 0.66, 0.95, Math.sin(a) * 0.66], shadow: false });
    }
    const head = this.head = new THREE.Group();
    head.position.y = 1.45;
    this.root.add(head);
    part(head, new THREE.SphereGeometry(0.62, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), metal, { outline: OUTLINE_M });
    part(head, new THREE.CylinderGeometry(0.64, 0.64, 0.14, 22), std(0x2b2833, 0.5, 0.7), { pos: [0, 0.02, 0], shadow: false });
    const barrel = this.barrel = new THREE.Group();
    barrel.position.set(0, 0.22, 0.25);
    head.add(barrel);
    part(barrel, new THREE.CylinderGeometry(0.19, 0.23, 0.95, 16).rotateX(Math.PI / 2), metal, { pos: [0, 0, 0.45], outline: OUTLINE_S });
    part(barrel, new THREE.TorusGeometry(0.2, 0.05, 8, 16), std(0x2b2833, 0.5, 0.7), { pos: [0, 0, 0.92], shadow: false });
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0, 1.15);
    barrel.add(this.muzzle);
    // one big suspicious eye
    const eye = part(head, new THREE.SphereGeometry(0.2, 16, 12), std(0xffffff, 0.2), { pos: [0, 0.38, 0.4], outline: OUTLINE_S });
    this.irisMat = glowMat(0xffb020, 1.0);
    this.iris = part(eye, new THREE.SphereGeometry(0.1, 12, 8), this.irisMat, { pos: [0, 0, 0.13], shadow: false });
    part(this.iris, new THREE.SphereGeometry(0.05, 8, 6), std(0x1b1530), { pos: [0, 0, 0.06], shadow: false });
    this.lid = part(head, new THREE.BoxGeometry(0.46, 0.08, 0.1), std(0x2b2833, 0.5, 0.5), { pos: [0, 0.55, 0.42], rot: [0.3, 0, 0], shadow: false });
    this.headYaw = this.yaw; this.pitch = 0;
    this.fireT = rand(0.8, 1.8);
    this.charge = 0; this.burst = 0; this.burstT = 0; this.recoil = 0;
    this.def = this.big ? BIG_BLOB : BLOTTER_BLOB;
    this.range = this.big ? 30 : 25;
    this.root.rotation.y = 0;
  }
  hitHeight() { return 1.95 * this.S; }

  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const p = ctx.player;
    const S = this.S;
    const seen = this.sense(p, this.range, 1.6 * S, dt);
    this.fireT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    if (seen && p.alive) {
      const chest = _w.copy(p.pos).setY(p.pos.y + (p.form === 'goo' ? 0.45 : 1.0));
      const eye = _a.copy(this.pos).setY(this.pos.y + 1.65 * S);
      const d = eye.distanceTo(chest);
      const lead = (d / this.def.speed) * 0.55;
      chest.x += p.vel.x * lead; chest.z += p.vel.z * lead;
      const wantYaw = Math.atan2(chest.x - eye.x, chest.z - eye.z);
      const wantPitch = Math.atan2(chest.y - eye.y, Math.hypot(chest.x - eye.x, chest.z - eye.z));
      const dy = angleTo(this.headYaw, wantYaw);
      const turn = (this.big ? 2.0 : 2.6) * dt;
      this.headYaw += Math.max(-turn, Math.min(turn, dy));
      this.pitch += (wantPitch - this.pitch) * (1 - Math.exp(-8 * dt));
      const aligned = Math.abs(dy) < 0.12;
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) this.shoot(ctx);
      } else if (aligned && this.fireT <= 0) {
        this.charge += dt;
        if (this.charge >= (this.big ? 0.7 : 0.55)) {
          this.charge = 0;
          this.burst = this.big ? 3 : 1;
          this.shoot(ctx);
        }
      } else this.charge = Math.max(0, this.charge - dt);
    } else {
      this.charge = Math.max(0, this.charge - dt * 2);
      this.headYaw += Math.sin(this.time * 0.6) * dt * 0.5;
      this.pitch *= 1 - dt;
    }
    const k = this.charge / 0.6;
    this.irisMat.color.setRGB(1, 0.55, 0.12).multiplyScalar(1 + k * 3 + (this.aggro ? 0.4 : 0));
    this.lid.position.y = 0.55 + (this.aggro ? 0.05 : -0.06);
    this.head.rotation.y = this.headYaw;
    this.barrel.rotation.x = -this.pitch;
    this.barrel.position.z = 0.25 - this.recoil * 0.18;
    this.barrel.scale.setScalar(1 + k * 0.12);
    this.root.position.copy(this.pos);
  }

  shoot(ctx) {
    const w = this.world;
    this.root.updateMatrixWorld(true);
    const o = this.muzzle.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(Math.sin(this.headYaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.headYaw) * Math.cos(this.pitch));
    dir.x += rand(-0.02, 0.02); dir.y += rand(-0.02, 0.02); dir.normalize();
    w.combat.blaster(this, o, dir, this.def);
    w.fx.splash(o, dir, GRAY_HEX, 6, 3, 0.07);
    w.audio?.sfx('shoot_heavy', { ...posOf(o), volume: 0.6, pitch: 0.7 });
    this.recoil = 1;
    this.burst--;
    this.burstT = 0.2;
    if (this.burst <= 0) { this.burst = 0; this.fireT = this.big ? 2.3 : 1.7; }
  }
}

// ---------------------------------------------------------------- Drab Drone
// Patrols the air and drops gray ink bombs on whoever is below.
export class Drone extends Drab {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 80, ...o });
    this.name = 'Drab Drone';
    this.radius = o.radius ?? 4;
    this.ang = rand(0, Math.PI * 2);
    this.alt = pos.y;
    this.leash = o.leash ?? 18;
    const body = this.body = new THREE.Group();
    body.position.y = 0.62;
    this.root.add(body);
    const gooM = this.trackFlash(gooMat(GRAY_HEX));
    const metal = this.trackFlash(std(0x4a4652, 0.45, 0.7));
    part(body, new THREE.SphereGeometry(0.42, 20, 14), gooM, { outline: OUTLINE_M });
    part(body, new THREE.TorusGeometry(0.44, 0.06, 8, 24), metal, { rot: [Math.PI / 2, 0, 0], shadow: false });
    this.rotors = [];
    const bladeM = std(0x2b2833, 0.5, 0.5);
    const blurM = new THREE.MeshBasicMaterial({ color: 0xc8c4d0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62;
      part(body, new THREE.BoxGeometry(0.5, 0.06, 0.08), metal, { pos: [x * 0.6, 0.12, z * 0.6], rot: [0, -a, 0], shadow: false });
      const hub = new THREE.Group();
      hub.position.set(x, 0.2, z);
      body.add(hub);
      part(hub, new THREE.BoxGeometry(0.46, 0.02, 0.06), bladeM, { shadow: false });
      part(hub, new THREE.BoxGeometry(0.06, 0.02, 0.46), bladeM, { shadow: false });
      part(body, new THREE.CircleGeometry(0.26, 18).rotateX(-Math.PI / 2), blurM, { pos: [x, 0.21, z], shadow: false });
      this.rotors.push(hub);
    }
    // ink tank underneath
    this.tank = part(body, new THREE.CylinderGeometry(0.16, 0.2, 0.32, 12), gooM, { pos: [0, -0.48, 0], outline: OUTLINE_S });
    part(body, new THREE.SphereGeometry(0.1, 10, 8), gooM, { pos: [0, -0.68, 0], scale: [1, 1.4, 1], shadow: false });
    const eye = part(body, new THREE.SphereGeometry(0.17, 14, 10), std(0xffffff, 0.2), { pos: [0, 0.05, 0.36], outline: OUTLINE_S });
    this.irisMat = glowMat(0xffb020, 1.0);
    const iris = part(eye, new THREE.SphereGeometry(0.085, 10, 8), this.irisMat, { pos: [0, 0, 0.11], shadow: false });
    part(iris, new THREE.SphereGeometry(0.045, 8, 6), std(0x1b1530), { pos: [0, 0, 0.05], shadow: false });
    this.dropT = rand(1, 2);
    this.warn = 0;
    this.ringT = 0;
    this.target = new THREE.Vector3();
  }
  hitHeight() { return 1.05; }

  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const p = ctx.player, L = this.world.level;
    for (const r of this.rotors) r.rotation.y += dt * 38;
    // awareness: horizontal range, generous vertical range
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.3;
      const hd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      this.aggro = p.alive && hd < 15 && Math.abs(p.pos.y - this.pos.y) < 14 && Math.hypot(p.pos.x - this.home.x, p.pos.z - this.home.z) < this.leash + 4;
    }
    const T = this.target;
    if (this.aggro) {
      T.set(p.pos.x + p.vel.x * 0.45, Math.max(p.pos.y + 4.4, this.alt - 3), p.pos.z + p.vel.z * 0.45);
    } else {
      this.ang += dt * 0.55;
      T.set(this.home.x + Math.cos(this.ang) * this.radius, this.alt + Math.sin(this.time * 0.8) * 0.4, this.home.z + Math.sin(this.ang) * this.radius);
    }
    // leash
    _a.set(T.x - this.home.x, 0, T.z - this.home.z);
    if (_a.length() > this.leash) { _a.setLength(this.leash); T.x = this.home.x + _a.x; T.z = this.home.z + _a.z; }
    // steer
    const sp = this.aggro ? 5.4 : 2.6;
    _w.subVectors(T, this.pos);
    const dl = _w.length();
    if (dl > 0.05) _w.multiplyScalar(Math.min(sp, dl * 2.2) / dl); else _w.set(0, 0, 0);
    if (this.warn > 0) _w.multiplyScalar(0.3);
    this.vel.lerp(_w, 1 - Math.exp(-3.5 * dt));
    this.pos.addScaledVector(this.vel, dt);
    const g = L.heightAt(this.pos.x, this.pos.z).y;
    if (Number.isFinite(g) && this.pos.y < g + 2.6) { this.pos.y = g + 2.6; this.vel.y = Math.max(0, this.vel.y); }
    // bombing run
    this.dropT -= dt;
    const hd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (this.warn > 0) {
      this.warn -= dt;
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = 0.16;
        const down = L.raycast(_a.copy(this.pos), DOWN, 40);
        if (down) this.world.fx.ring(down.point.clone().setY(down.point.y + 0.06), 0xffb020, 2.4, 0.3, 0.32, { alpha: 0.85 });
      }
      if (this.warn <= 0) this.drop();
    } else if (this.aggro && p.alive && hd < 2.4 && this.dropT <= 0) {
      this.warn = 0.6;
      this.ringT = 0;
      this.world.audio?.sfx('bomb_beep', { ...posOf(this.pos), volume: 0.6, pitch: 0.8 });
    }
    // animation
    const k = this.warn > 0 ? 1 : 0;
    this.irisMat.color.setRGB(1, 0.55, 0.12).multiplyScalar(1 + k * 3 + (this.aggro ? 0.4 : 0));
    this.tank.scale.setScalar(1 + k * (0.15 + Math.sin(this.time * 40) * 0.05));
    this.body.rotation.z = -this.vel.x * 0.05;
    this.body.rotation.x = this.vel.z * 0.05;
    this.body.position.y = 0.62 + Math.sin(this.time * 3) * 0.06;
    const face = this.aggro ? Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : Math.atan2(this.vel.x, this.vel.z);
    this.yaw += angleTo(this.yaw, face) * (1 - Math.exp(-5 * dt));
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  drop() {
    const w = this.world;
    const o = new THREE.Vector3(this.pos.x, this.pos.y + 0.0, this.pos.z);
    w.combat.blaster(this, o, new THREE.Vector3(0, -1, 0), DRONE_DROP);
    w.audio?.sfx('bomb_throw', { ...posOf(o), volume: 0.6 });
    this.dropT = rand(2.2, 2.9);
  }
}

export function makeEnemy(world, def) {
  const o = { group: def.group, yaw: def.yaw, big: def.big, radius: def.radius, leash: def.leash, spawnIn: def.spawnIn };
  if (def.kind === 'blotter') return new Blotter(world, def.pos, o);
  if (def.kind === 'drone') return new Drone(world, def.pos, o);
  return new Smudge(world, def.pos, o);
}
