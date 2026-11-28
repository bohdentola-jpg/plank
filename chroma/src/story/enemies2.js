// More Drab for sectors 2 and 3. Each has a readable tell and a counter:
//   Warden   shield in front: flank it, or bomb over it (splash ignores the shield)
//   Glint    laser sniper: the sight tracks you, flashes red, then fires. Dive or duck behind cover on red
//   Rumbler  roller charger: revs up (dust + arrow), charges in a line, stuns itself on walls
//   Gooper   hides in a gray puddle and lobs bombs: paint over its puddle to flush it out
//   Splotch  big blob that splits in two, twice
//   Pilfer   ink thief: swipes half your tank and runs. Splash it to get the ink back
import * as THREE from 'three';
import { part, std, gooMat, glowMat, OUTLINE_S, OUTLINE_M, posOf } from './kit.js';
import { Drab, Smudge, GRAY_HEX, makeEnemy as makeBasic } from './enemies.js';

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), Z = new THREE.Vector3(0, 0, 1);
const GRAV = 24;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const angleTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const LOB = { speed: 12, range: 40, dmgDirect: 40, dmgSplash: 28, blastR: 2.1, splat: 1.5 };
const SNIPE = { minRange: 44, maxRange: 44, dmgFull: 75, dmgMin: 75, splat: 1.3 };

// ballistic lob from o to t taking time T (gravity 20, Combat's grav projectiles)
function lob(world, owner, o, t, T, def = LOB) {
  const v = new THREE.Vector3((t.x - o.x) / T, (t.y - o.y + 0.5 * 20 * T * T) / T, (t.z - o.z) / T);
  const sp = v.length();
  world.combat.blaster(owner, o, v.clone().divideScalar(sp), def, { speed: sp, grav: 1, range: 99 });
}

// Ground walker: gravity, wall pushes, ledge avoidance.
class Walker extends Drab {
  constructor(world, pos, o) {
    super(world, pos, o);
    this.onGround = true;
    this.radius = o.radius ?? 0.55;
    this.height = 1.6;
    this.leash = o.leash ?? 22;
  }
  // try to move along (dx,dz) at speed; returns the wall contact (if any)
  walk(dt, dx, dz, speed) {
    const L = this.world.level;
    const l = Math.hypot(dx, dz);
    let wall = null;
    if (l > 1e-4 && this.onGround) {
      dx /= l; dz /= l;
      // ledge check
      const ah = L.heightAt(this.pos.x + dx * 0.9, this.pos.z + dz * 0.9).y;
      if (!Number.isFinite(ah) || ah < this.pos.y - 1.1 || ah > this.pos.y + 0.6) return { ledge: true };
      this.vel.x = dx * speed; this.vel.z = dz * speed;
    } else if (this.onGround) { this.vel.x *= 0.5; this.vel.z *= 0.5; }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    wall = L.collide(this.pos, this.vel, this.radius, this.height, 0.45);
    // gravity
    if (!this.onGround) this.vel.y -= GRAV * dt;
    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
    const g = L.groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y), 0.3, this.onGround ? 0.5 : 0.12);
    if (g.solid && this.vel.y <= 0.01 && this.pos.y <= g.y + (this.onGround ? 0.45 : 0.001)) { this.pos.y = g.y; this.vel.y = 0; this.onGround = true; this.groundSolid = g.solid; }
    else this.onGround = false;
    if (this.pos.y < L.killY) this.die(null, 'fall');
    return wall;
  }
  floorFace() { return this.groundSolid?.sideFace?.top || null; }
}

// ================================================================ Warden
export class Warden extends Walker {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 230, ...o });
    this.name = 'Warden';
    this.radius = 0.7;
    const body = this.body = new THREE.Group();
    this.root.add(body);
    const goo = this.trackFlash(gooMat(GRAY_HEX));
    const metal = this.trackFlash(std(0x55525d, 0.4, 0.75));
    part(body, new THREE.CapsuleGeometry(0.55, 0.9, 6, 16), goo, { pos: [0, 1.0, 0], outline: OUTLINE_M });
    // helmet with a visor slit
    part(body, new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal, { pos: [0, 1.55, 0], outline: OUTLINE_S });
    part(body, new THREE.BoxGeometry(0.62, 0.08, 0.1), glowMat(0xffb020, 1.6), { pos: [0, 1.66, 0.42], shadow: false });
    // glowing weak spot on the back (flank tell)
    this.weakMat = glowMat(0xff7a3d, 1.6);
    part(body, new THREE.SphereGeometry(0.24, 14, 10), this.weakMat, { pos: [0, 1.05, -0.5], shadow: false });
    // the shield
    const sh = this.shieldG = new THREE.Group();
    sh.position.set(0, 1.0, 0.72);
    body.add(sh);
    part(sh, new THREE.CylinderGeometry(1.6, 1.6, 1.9, 16, 1, true, -0.55, 1.1).translate(0, 0, -1.6), metal, { outline: OUTLINE_S });
    this.rimMat = glowMat(0xffd04a, 1.4);
    part(sh, new THREE.TorusGeometry(1.6, 0.05, 6, 16, 1.1).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - 0.55).translate(0, 0.95, -1.6), this.rimMat, { shadow: false });
    part(sh, new THREE.TorusGeometry(1.6, 0.05, 6, 16, 1.1).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - 0.55).translate(0, -0.95, -1.6), this.rimMat, { shadow: false });
    part(sh, new THREE.SphereGeometry(0.2, 12, 8), metal, { pos: [0, 0, 0.05], shadow: false });
    // club arm
    this.arm = new THREE.Group();
    this.arm.position.set(0.55, 1.3, 0);
    body.add(this.arm);
    part(this.arm, new THREE.CapsuleGeometry(0.12, 0.6, 4, 8), goo, { pos: [0, -0.35, 0], outline: OUTLINE_S });
    this.state = 'walk'; this.t = 0; this.cool = rand(1, 2);
    this.yaw = o.yaw ?? 0;
  }
  hitHeight() { return 1.9; }
  modDamage(dmg, attacker, kind) {
    this.blocked = false;
    if (!attacker || kind === 'blast' || kind === 'big' || kind === 'clear' || kind === 'test' || kind === 'burst') return dmg;
    const a = Math.atan2(attacker.pos.x - this.pos.x, attacker.pos.z - this.pos.z);
    const d = Math.abs(angleTo(this.yaw, a));
    if (d < 1.15 && this.state !== 'stagger') {
      this.blocked = true;
      if (this.time - (this.clankT || 0) > 0.12) {
        this.clankT = this.time;
        this.world.audio?.sfx('hit', { ...posOf(this.pos), volume: 0.35, pitch: 0.5 });
        this.world.fx.splash(_v.set(this.pos.x + Math.sin(this.yaw) * 0.9, this.pos.y + 1.1, this.pos.z + Math.cos(this.yaw) * 0.9), _w.set(Math.sin(a), 0.3, Math.cos(a)), 0xffd04a, 4, 3, 0.04);
      }
      return 0;
    }
    return d > 2.3 ? dmg * 1.35 : dmg; // straight in the back hurts
  }
  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const p = ctx.player;
    const aggro = this.sense(p, 22, 1.6, dt);
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    this.t -= dt; this.cool -= dt;
    let mx = 0, mz = 0, sp = 0, turn = 1.5;
    if (this.state === 'walk') {
      if (aggro && p.alive) {
        if (dist > 3.0) { mx = dx; mz = dz; sp = 1.9; }
        if (this.cool <= 0 && dist < 3.4 && Math.abs(p.pos.y - this.pos.y) < 1.5) { this.state = 'bashWind'; this.t = 0.7; this.world.audio?.sfx('bomb_beep', { ...posOf(this.pos), volume: 0.5, pitch: 0.5 }); }
        else if (this.cool <= 0 && dist > 5 && dist < 16) { this.state = 'tossWind'; this.t = 0.6; }
      } else {
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z;
        if (Math.hypot(hx, hz) > 1) { mx = hx; mz = hz; sp = 1.4; }
      }
    } else if (this.state === 'bashWind') {
      turn = 2.5;
      if (this.t <= 0) { this.state = 'bash'; this.t = 0.32; this.hitDone = false; this.world.audio?.sfx('dodge_roll', { ...posOf(this.pos), volume: 0.7, pitch: 0.6 }); }
    } else if (this.state === 'bash') {
      turn = 0;
      mx = Math.sin(this.yaw); mz = Math.cos(this.yaw); sp = 10;
      if (!this.hitDone && p.alive && dist < 1.9 && Math.abs(p.pos.y - this.pos.y) < 1.6) {
        this.hitDone = true;
        this.world.combat.damage(p, 45, this, 'bash');
        p.vel.x += Math.sin(this.yaw) * 9; p.vel.z += Math.cos(this.yaw) * 9; p.vel.y = Math.max(p.vel.y, 4.5);
      }
      if (this.t <= 0) { this.state = 'walk'; this.cool = rand(1.6, 2.4); }
    } else if (this.state === 'tossWind') {
      turn = 2;
      if (this.t <= 0) {
        const o = _v.set(this.pos.x + Math.sin(this.yaw) * 0.3, this.pos.y + 2.3, this.pos.z + Math.cos(this.yaw) * 0.3).clone();
        const T = Math.min(1.5, Math.max(0.7, dist / 10));
        const tgt = p.pos.clone(); tgt.x += p.vel.x * T * 0.5; tgt.z += p.vel.z * T * 0.5;
        const h = this.world.level.heightAt(tgt.x, tgt.z).y; if (Number.isFinite(h) && Math.abs(h - p.pos.y) < 3) tgt.y = h;
        lob(this.world, this, o, tgt, T);
        this.world.fx.ring(tgt.clone().setY(tgt.y + 0.06), 0xffb020, 2.2, 0.4, T, { alpha: 0.85 });
        this.world.audio?.sfx('bomb_throw', { ...posOf(o), volume: 0.6, pitch: 0.7 });
        this.state = 'walk'; this.cool = rand(2.2, 3.2);
      }
    }
    if (turn > 0 && aggro && p.alive) { const d = angleTo(this.yaw, want); this.yaw += Math.max(-turn * dt, Math.min(turn * dt, d)); }
    this.walk(dt, mx, mz, sp);
    // anim
    const wind = this.state === 'bashWind' ? 1 - this.t / 0.7 : 0;
    this.rimMat.color.setRGB(1, 0.82, 0.3).multiplyScalar(1.4 + wind * 3);
    this.shieldG.position.z = 0.72 - wind * 0.3 + (this.state === 'bash' ? 0.35 : 0);
    this.arm.rotation.x = this.state === 'tossWind' ? -2.6 * (1 - this.t / 0.6) : Math.sin(this.time * 4) * 0.2;
    this.weakMat.color.setRGB(1, 0.48, 0.24).multiplyScalar(1.4 + Math.sin(this.time * 5) * 0.5);
    const sp2 = Math.hypot(this.vel.x, this.vel.z);
    this.body.position.y = Math.abs(Math.sin(this.time * 6)) * Math.min(0.08, sp2 * 0.03);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
}

// ================================================================ Glint
export class Glint extends Drab {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 95, ...o });
    this.name = 'Glint';
    const goo = this.trackFlash(gooMat(GRAY_HEX));
    const metal = this.trackFlash(std(0x4a4652, 0.45, 0.7));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      part(this.root, new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), metal, { pos: [Math.cos(a) * 0.35, 0.6, Math.sin(a) * 0.35], rot: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], outline: OUTLINE_S });
    }
    const head = this.head = new THREE.Group();
    head.position.y = 1.35;
    this.root.add(head);
    part(head, new THREE.SphereGeometry(0.42, 18, 12), goo, { outline: OUTLINE_M, scale: [1, 0.85, 1.1] });
    part(head, new THREE.CylinderGeometry(0.1, 0.13, 1.3, 10).rotateX(Math.PI / 2), metal, { pos: [0, 0.05, 0.75], outline: OUTLINE_S });
    part(head, new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12).rotateX(Math.PI / 2), metal, { pos: [0, 0.32, 0.25], outline: OUTLINE_S });
    this.lensMat = glowMat(0xff3d3d, 1.2);
    part(head, new THREE.CircleGeometry(0.13, 16), this.lensMat, { pos: [0, 0.32, 0.46], shadow: false });
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.05, 1.42);
    head.add(this.muzzle);
    // laser sight
    const lg = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    lg.rotateX(Math.PI / 2); lg.translate(0, 0, 0.5);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.6, depthWrite: false });
    this.laser = new THREE.Mesh(lg, this.laserMat);
    this.laser.frustumCulled = false;
    this.laser.visible = false;
    this.laser.raycast = () => {};
    world.scene.add(this.laser);
    this.state = 'idle'; this.t = 0; this.cool = rand(0.6, 1.4);
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.yaw = o.yaw ?? 0; this.pitch = 0;
  }
  hitHeight() { return 1.75; }
  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) { this.laser.visible = false; return; }
    const p = ctx.player;
    const seen = this.sense(p, 36, 1.4, dt);
    this.cool -= dt;
    this.root.updateMatrixWorld(true);
    const o = this.muzzle.getWorldPosition(_a);
    const chest = _w.set(p.pos.x, p.pos.y + (p.form === 'goo' ? 0.35 : 1.0), p.pos.z);
    if (this.state === 'idle') {
      this.yaw += Math.sin(this.time * 0.5) * dt * 0.4;
      if (seen && p.alive && this.cool <= 0) { this.state = 'aim'; this.t = 1.6; this.world.audio?.sfx('charge_shot', { ...posOf(this.pos), volume: 0.3, pitch: 0.5 }); }
    } else if (this.state === 'aim') {
      this.t -= dt;
      const want = Math.atan2(chest.x - this.pos.x, chest.z - this.pos.z);
      this.yaw += angleTo(this.yaw, want) * (1 - Math.exp(-6 * dt));
      this.pitch += (Math.atan2(chest.y - o.y, Math.hypot(chest.x - o.x, chest.z - o.z)) - this.pitch) * (1 - Math.exp(-6 * dt));
      this.aimDir.subVectors(chest, o).normalize();
      if (!seen) { this.lost = (this.lost || 0) + dt; if (this.lost > 0.6) { this.state = 'idle'; this.cool = 0.8; this.lost = 0; } } else this.lost = 0;
      if (this.t <= 0) { this.state = 'lock'; this.t = 0.45; this.world.audio?.sfx('bomb_beep', { ...posOf(this.pos), volume: 0.7, pitch: 1.6 }); }
    } else if (this.state === 'lock') {
      this.t -= dt;
      if (this.t <= 0) {
        this.world.combat.beam(this, o.clone(), this.aimDir.clone(), SNIPE, 1);
        this.world.fx.splash(o, this.aimDir, GRAY_HEX, 8, 4, 0.06);
        this.state = 'idle'; this.cool = rand(1.6, 2.2);
      }
    }
    // laser sight
    const on = this.state === 'aim' || this.state === 'lock';
    this.laser.visible = on;
    if (on) {
      const hit = this.world.level.raycast(o, this.aimDir, 44);
      const len = hit ? hit.t : 44;
      this.laser.position.copy(o);
      this.laser.quaternion.setFromUnitVectors(Z, this.aimDir);
      const lock = this.state === 'lock';
      const th = lock ? 0.035 + Math.sin(this.time * 60) * 0.01 : 0.012 + (1 - this.t / 1.6) * 0.012;
      this.laser.scale.set(th, th, len);
      this.laserMat.color.setRGB(1, lock ? 0.15 : 0.55, lock ? 0.15 : 0.45).multiplyScalar(lock ? 3 : 1.6);
    }
    this.lensMat.color.setRGB(1, 0.24, 0.24).multiplyScalar(on ? 2.5 + Math.sin(this.time * 20) : 1.2);
    this.head.rotation.y = this.yaw;
    this.head.rotation.x = -this.pitch;
    this.root.position.copy(this.pos);
  }
  die(attacker, kind) { this.laser.visible = false; super.die(attacker, kind); }
  dispose() {
    this.world.scene.remove(this.laser);
    this.laser.geometry.dispose(); this.laserMat.dispose();
    super.dispose();
  }
}

// ================================================================ Rumbler
export class Rumbler extends Walker {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 210, ...o });
    this.name = 'Rumbler';
    this.radius = 0.85; this.height = 1.6;
    const body = this.body = new THREE.Group();
    this.root.add(body);
    const goo = this.trackFlash(gooMat(GRAY_HEX));
    const metal = this.trackFlash(std(0x4a4652, 0.45, 0.7));
    // the drum
    this.drum = part(body, new THREE.CylinderGeometry(0.75, 0.75, 1.9, 22).rotateZ(Math.PI / 2), metal, { pos: [0, 0.75, 0.55], outline: OUTLINE_M });
    for (const x of [-0.98, 0.98]) part(this.drum, new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16).rotateZ(Math.PI / 2), std(0x2b2833, 0.5, 0.7), { pos: [x, 0, 0], shadow: false });
    this.ribs = [];
    for (let i = 0; i < 6; i++) { const r = part(this.drum, new THREE.BoxGeometry(1.92, 0.08, 0.12), std(0x2b2833, 0.5, 0.7), { shadow: false }); r.position.set(0, Math.cos(i * 1.047) * 0.76, Math.sin(i * 1.047) * 0.76); r.rotation.x = -i * 1.047; this.ribs.push(r); }
    // goo body riding behind it with angry eyes
    part(body, new THREE.SphereGeometry(0.72, 18, 12), goo, { pos: [0, 0.95, -0.55], scale: [1.1, 1, 1], outline: OUTLINE_M });
    part(body, new THREE.BoxGeometry(1.5, 0.12, 0.12), metal, { pos: [0, 0.78, 0.0], shadow: false });
    this.eyeMat = glowMat(0xffb020, 1.2);
    for (const s of [-1, 1]) part(body, new THREE.SphereGeometry(0.13, 10, 8), this.eyeMat, { pos: [0.28 * s, 1.3, -0.05], shadow: false });
    this.state = 'idle'; this.t = 0; this.cool = rand(0.8, 1.6);
    this.dir = new THREE.Vector3(0, 0, 1);
    this.yaw = o.yaw ?? 0;
  }
  hitHeight() { return 1.6; }
  modDamage(dmg, attacker, kind) {
    this.blocked = false;
    if (this.state === 'stun') return dmg * 1.5;
    if (attacker && kind !== 'blast' && kind !== 'big' && kind !== 'test' && kind !== 'clear' && kind !== 'burst') {
      const a = Math.atan2(attacker.pos.x - this.pos.x, attacker.pos.z - this.pos.z);
      if (Math.abs(angleTo(this.yaw, a)) < 0.9) { this.blocked = dmg > 0; return dmg * 0.35; }
    }
    return dmg;
  }
  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const p = ctx.player, w = this.world;
    const aggro = this.sense(p, 20, 1.2, dt);
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    this.t -= dt; this.cool -= dt;
    let mx = 0, mz = 0, sp = 0;
    if (this.state === 'idle') {
      if (aggro && p.alive) {
        this.yaw += angleTo(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-4 * dt));
        if (dist > 7) { mx = dx; mz = dz; sp = 1.8; }
        if (this.cool <= 0 && dist < 18 && Math.abs(p.pos.y - this.pos.y) < 2) { this.state = 'rev'; this.t = 1.05; w.audio?.sfx('roller_flick', { ...posOf(this.pos), volume: 0.7, pitch: 0.5 }); }
      }
    } else if (this.state === 'rev') {
      this.yaw += angleTo(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-5 * dt));
      this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (Math.random() < dt * 30) w.fx.spawn(_v.set(this.pos.x - this.dir.x * 0.6 + rand(-0.6, 0.6), this.pos.y + 0.1, this.pos.z - this.dir.z * 0.6), _w.set(-this.dir.x * 3 + rand(-1, 1), rand(1, 2.5), -this.dir.z * 3), 0x9a97a3, rand(0.06, 0.12), 0.5);
      // dotted path telegraph
      if (Math.random() < dt * 14) { const k = rand(1, 9); w.fx.ring(_v.set(this.pos.x + this.dir.x * k, this.pos.y + 0.06, this.pos.z + this.dir.z * k), 0xffb020, 0.5, 0.2, 0.35, { alpha: 0.8 }); }
      if (this.t <= 0) { this.state = 'charge'; this.t = 2.4; this.hitDone = false; w.audio?.sfx('launch', { ...posOf(this.pos), volume: 0.8, pitch: 0.5 }); }
    } else if (this.state === 'charge') {
      mx = this.dir.x; mz = this.dir.z; sp = 11.5;
      this.trailT = (this.trailT || 0) - dt;
      if (this.trailT <= 0) { this.trailT = 0.05; w.combat.paint(this, _v.set(this.pos.x, this.pos.y + 0.05, this.pos.z), 1.1, { wobble: 0.15 }); }
      if (!this.hitDone && p.alive && dist < 1.6 && Math.abs(p.pos.y - this.pos.y) < 1.4) {
        this.hitDone = true;
        w.combat.damage(p, 60, this, 'roll');
        const side = Math.sign(this.dir.x * dz - this.dir.z * dx) || 1;
        p.vel.x += this.dir.x * 6 - this.dir.z * side * 5; p.vel.z += this.dir.z * 6 + this.dir.x * side * 5; p.vel.y = Math.max(p.vel.y, 5);
      }
      if (this.t <= 0) { this.state = 'idle'; this.cool = rand(1.2, 2); }
    } else if (this.state === 'stun') {
      if (Math.random() < dt * 6) w.fx.spawn(_v.set(this.pos.x + rand(-0.4, 0.4), this.pos.y + 1.9, this.pos.z + rand(-0.4, 0.4)), _w.set(0, 0.8, 0), 0xffd04a, 0.06, 0.5, { grav: 0 });
      if (this.t <= 0) { this.state = 'idle'; this.cool = rand(0.6, 1.2); }
    }
    const res = this.walk(dt, mx, mz, sp);
    if (this.state === 'charge') {
      if (res?.ledge) { this.state = 'idle'; this.cool = 1.2; this.vel.x = this.vel.z = 0; }
      else if (res && res.push > 0.02 && Math.abs(res.nx * this.dir.x + res.nz * this.dir.z) > 0.5) {
        this.state = 'stun'; this.t = 2.4;
        w.audio?.sfx('explode', { ...posOf(this.pos), volume: 0.6, pitch: 1.4 });
        w.fx.splash(_v.set(this.pos.x + this.dir.x, this.pos.y + 0.8, this.pos.z + this.dir.z), UP, 0xffd04a, 14, 5, 0.07);
        w.onEnemyStun?.(this);
      }
    }
    // anim
    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.drum.rotation.x += dt * (this.state === 'rev' ? 18 : spd * 1.4);
    this.eyeMat.color.setRGB(1, 0.6, 0.15).multiplyScalar(this.state === 'rev' ? 3.5 : this.state === 'stun' ? 0.5 : 1.3);
    this.body.rotation.z = this.state === 'stun' ? Math.sin(this.time * 9) * 0.12 : 0;
    this.body.position.x = this.state === 'rev' ? Math.sin(this.time * 70) * 0.04 : 0;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
}

// ================================================================ Gooper
export class Gooper extends Drab {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 115, ...o });
    this.name = 'Gooper';
    const body = this.body = new THREE.Group();
    this.root.add(body);
    const goo = this.trackFlash(gooMat(GRAY_HEX));
    part(body, new THREE.SphereGeometry(0.6, 20, 14), goo, { pos: [0, 0.55, 0], scale: [1, 1.15, 1], outline: OUTLINE_M });
    part(body, new THREE.ConeGeometry(0.3, 0.5, 10), goo, { pos: [0, 1.35, 0], outline: OUTLINE_S });
    const white = std(0xffffff, 0.2), dark = std(0x1b1530, 0.4);
    for (const s of [-1, 1]) {
      const e = part(body, new THREE.SphereGeometry(0.17, 12, 10), white, { pos: [0.22 * s, 0.85, 0.45], outline: OUTLINE_S });
      part(e, new THREE.SphereGeometry(0.08, 8, 6), dark, { pos: [0, 0, 0.12], shadow: false });
    }
    // a bomb held overhead while surfacing
    this.bomb = part(body, new THREE.SphereGeometry(0.28, 14, 10), std(0x3b3842, 0.3, 0.5), { pos: [0, 1.5, 0], outline: OUTLINE_S });
    this.fuseMat = glowMat(0xff7a3d, 2);
    part(this.bomb, new THREE.SphereGeometry(0.08, 8, 6), this.fuseMat, { pos: [0, 0.3, 0], shadow: false });
    this.state = 'hidden'; this.t = rand(0.8, 2); this.k = 0;
    this.checkT = 0;
    this.yaw = o.yaw ?? 0;
    this.puddled = false;
  }
  hitHeight() { return this.k > 0.4 ? 1.4 : 0.35; }
  modDamage(dmg) {
    this.blocked = false;
    if (this.state === 'hidden' && this.k < 0.3) { this.blocked = true; return 0; }
    return this.state === 'exposed' ? dmg * 1.3 : dmg;
  }
  onPuddle() {
    const face = this.world.level.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.2, 0.2, 0.5).solid?.sideFace?.top;
    if (!face) return true;
    let gray = 0;
    for (const [dx, dz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) if (this.world.paint.ownerAt(face, _v.set(this.pos.x + dx, this.pos.y, this.pos.z + dz)) === 2) gray++;
    return gray >= 3;
  }
  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const w = this.world, p = ctx.player;
    if (!this.puddled) { this.puddled = true; w.paint.splat(_v.copy(this.pos).setY(this.pos.y + 0.05), 1.9, 2, { wobble: 0.3 }); }
    const seen = this.sense(p, 22, 1.0, dt);
    this.t -= dt;
    // flushed out when its puddle gets painted over
    this.checkT -= dt;
    if (this.checkT <= 0 && this.state !== 'exposed') {
      this.checkT = 0.3;
      if (!this.onPuddle()) {
        this.state = 'exposed'; this.t = 3.2;
        w.audio?.sfx('goo_out', { ...posOf(this.pos), volume: 0.8, pitch: 1.5 });
        w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.6), UP, GRAY_HEX, 12, 4, 0.08);
      }
    }
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    if (this.state === 'hidden') {
      this.k = Math.max(0, this.k - dt * 4);
      if (this.t <= 0 && seen && p.alive) { this.state = 'rise'; this.t = 0.45; w.audio?.sfx('goo_out', { ...posOf(this.pos), volume: 0.6 }); }
    } else if (this.state === 'rise') {
      this.k = Math.min(1, this.k + dt * 3);
      if (this.t <= 0) {
        this.state = 'up'; this.t = 1.3;
        // throw
        const dist = Math.hypot(dx, dz);
        const T = Math.min(1.6, Math.max(0.9, dist / 9));
        const tgt = p.pos.clone(); tgt.x += p.vel.x * T * 0.6; tgt.z += p.vel.z * T * 0.6;
        const h = w.level.heightAt(tgt.x, tgt.z).y; if (Number.isFinite(h) && Math.abs(h - p.pos.y) < 3) tgt.y = h;
        lob(w, this, _v.set(this.pos.x, this.pos.y + 1.7, this.pos.z).clone(), tgt, T);
        w.fx.ring(tgt.clone().setY(tgt.y + 0.06), 0xffb020, 2.3, 0.4, T, { alpha: 0.85 });
        w.audio?.sfx('bomb_throw', { ...posOf(this.pos), volume: 0.6 });
        this.bomb.visible = false;
      }
    } else if (this.state === 'up') {
      if (this.t <= 0) { this.state = 'hidden'; this.t = rand(2.2, 3); this.bomb.visible = true; w.audio?.sfx('goo_in', { ...posOf(this.pos), volume: 0.5 }); }
    } else if (this.state === 'exposed') {
      this.k = Math.min(1, this.k + dt * 4);
      if (Math.random() < dt * 5) w.fx.spawn(_v.set(this.pos.x, this.pos.y + 1.6, this.pos.z), _w.set(rand(-1, 1), 1, rand(-1, 1)), 0xffd04a, 0.05, 0.5, { grav: 0 });
      if (this.t <= 0) {
        // regrows its puddle and dives back in
        w.paint.splat(_v.copy(this.pos).setY(this.pos.y + 0.05), 1.9, 2, { wobble: 0.3 });
        this.state = 'hidden'; this.t = 1.5; this.bomb.visible = true;
      }
    }
    if (seen && p.alive) this.yaw += angleTo(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-6 * dt));
    // anim: sink into the puddle
    const k = this.k;
    this.body.position.y = -1.15 + k * 1.15 + (this.state === 'exposed' ? Math.abs(Math.sin(this.time * 9)) * 0.15 : 0);
    this.body.scale.set(1 + (1 - k) * 0.3, 0.6 + k * 0.4, 1 + (1 - k) * 0.3);
    this.body.rotation.z = this.state === 'exposed' ? Math.sin(this.time * 12) * 0.2 : 0;
    this.fuseMat.color.setRGB(1, 0.5, 0.25).multiplyScalar(2 + Math.sin(this.time * 25) * 1.2);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
}

// ================================================================ Splotch (splitting Smudge)
const SPLOTCH = { L: { s: 1.55, hp: 170, next: 'M' }, M: { s: 1.0, hp: 80, next: 'S' }, S: { s: 0.62, hp: 34, next: null } };
export class Splotch extends Smudge {
  constructor(world, pos, o = {}) {
    const size = SPLOTCH[o.size] ? o.size : 'L';
    super(world, pos, { ...o, hp: SPLOTCH[size].hp });
    this.size = size;
    this.name = size === 'L' ? 'Splotch' : size === 'M' ? 'Splotchling' : 'Splotchlet';
    this.body.scale.setScalar(SPLOTCH[size].s);
    this.spawnOpts = o;
    // purple seam: the line it splits along
    const seam = part(this.body, new THREE.TorusGeometry(0.58, 0.035, 6, 30), glowMat(0xc29bff, 1.6), { pos: [0, 0.5, 0], rot: [0, 0, Math.PI / 2], shadow: false });
    seam.scale.set(1, 0.86, 1.1);
    for (const m of this.flashMats) m.m.color?.set(0x9a90a8);
  }
  hitHeight() { return 0.95 * SPLOTCH[this.size].s; }
  update(dt, ctx) {
    super.update(dt, ctx);
    if (this.size === 'S' && this.alive && this.state === 'hop') { this.vel.x *= 1 + dt * 1.5; this.vel.z *= 1 + dt * 1.5; }
  }
  die(attacker, kind) {
    const was = this.alive;
    super.die(attacker, kind);
    const next = SPLOTCH[this.size].next;
    if (!was || !next || kind === 'clear' || kind === 'fall' || !this.world.spawnEnemy) return;
    for (const s of [-1, 1]) {
      const a = this.yaw + Math.PI / 2;
      const pos = this.pos.clone().add(new THREE.Vector3(Math.sin(a) * s * 0.6, 0.1, Math.cos(a) * s * 0.6));
      const e = this.world.spawnEnemy({ kind: 'splotch', size: next, pos, group: this.group, spawnIn: true, foe: this.foe });
      if (e) { e.vel.set(Math.sin(a) * s * 4, 6, Math.cos(a) * s * 4); e.onGround = false; e.aggro = true; }
    }
  }
}

// ================================================================ Pilfer
export class Pilfer extends Walker {
  constructor(world, pos, o = {}) {
    super(world, pos, { hp: 70, ...o });
    this.name = 'Pilfer';
    this.radius = 0.4; this.height = 1.1;
    const body = this.body = new THREE.Group();
    this.root.add(body);
    const goo = this.trackFlash(gooMat(GRAY_HEX));
    part(body, new THREE.SphereGeometry(0.4, 16, 12), goo, { pos: [0, 0.5, 0], scale: [1, 1.2, 1], outline: OUTLINE_M });
    for (const s of [-1, 1]) part(body, new THREE.ConeGeometry(0.1, 0.32, 8), goo, { pos: [0.2 * s, 1.0, 0], rot: [0, 0, -0.4 * s], outline: OUTLINE_S });
    // bandit mask + grin
    part(body, new THREE.BoxGeometry(0.62, 0.14, 0.1), std(0x1b1530, 0.5), { pos: [0, 0.72, 0.33], shadow: false });
    for (const s of [-1, 1]) part(body, new THREE.SphereGeometry(0.06, 8, 6), glowMat(0xffe08a, 2), { pos: [0.14 * s, 0.73, 0.39], shadow: false });
    part(body, new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), std(0x1b1530, 0.5), { pos: [0, 0.48, 0.36], rot: [0, 0, Math.PI], shadow: false });
    // the loot sack (glows in your ink once it has some)
    this.sackMat = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.9, emissive: 0x000000 });
    this.sack = part(body, new THREE.SphereGeometry(0.34, 14, 10), this.sackMat, { pos: [0, 0.65, -0.42], scale: [1, 1.1, 1], outline: OUTLINE_S });
    this.state = 'sneak'; this.t = 0; this.stolen = 0;
    this.yaw = o.yaw ?? 0;
  }
  hitHeight() { return 1.1; }
  update(dt, ctx) {
    this.updateCommon(dt);
    if (!this.alive) return;
    const p = ctx.player, w = this.world;
    const aggro = this.sense(p, 20, 0.8, dt) || this.state === 'flee';
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    let mx = 0, mz = 0, sp = 0;
    this.t += dt;
    if (this.state === 'sneak') {
      if (aggro && p.alive && p.ink > 0.05 && !p.isPump) {
        const zig = Math.sin(this.time * 5) * 0.6;
        mx = dx + -dz / Math.max(dist, 0.1) * zig * dist * 0.3; mz = dz + dx / Math.max(dist, 0.1) * zig * dist * 0.3; sp = 6.2;
        if (dist < 1.2 && Math.abs(p.pos.y - this.pos.y) < 1.3) {
          this.stolen = Math.min(p.ink, 0.6);
          p.ink -= this.stolen;
          this.state = 'flee'; this.t = 0;
          w.audio?.sfx('tongue', { ...posOf(this.pos), volume: 0.8, pitch: 1.4 });
          w.fx.splash(_v.copy(p.pos).setY(p.pos.y + 1), UP, p.color, 14, 4, 0.07);
          w.onInkStolen?.(this);
        }
      }
    } else if (this.state === 'flee') {
      mx = -dx; mz = -dz; sp = 7.2;
      // dodge sideways when cornered
      if (Math.random() < dt * 1.5) this.dodge = rand(-1, 1);
      if (this.dodge) { mx += -dz / Math.max(dist, 0.1) * this.dodge * 4; mz += dx / Math.max(dist, 0.1) * this.dodge * 4; }
      if (this.t > 9 || dist > 30) { this.escape(); return; }
    }
    const res = this.walk(dt, mx, mz, sp);
    if (res?.ledge && this.state === 'flee') { this.vel.x = -this.vel.x; this.vel.z = -this.vel.z; this.dodge = -(this.dodge || 1); }
    const v = Math.hypot(this.vel.x, this.vel.z);
    if (v > 0.5) this.yaw += angleTo(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-12 * dt));
    // anim
    this.body.position.y = Math.abs(Math.sin(this.time * 14)) * Math.min(0.15, v * 0.03);
    const full = this.stolen > 0;
    this.sack.scale.setScalar(full ? 1.35 + Math.sin(this.time * 8) * 0.05 : 1);
    if (full) this.sackMat.emissive.copy(p.color).multiplyScalar(0.8);
    if (full && Math.random() < dt * 10) w.fx.spawn(_v.set(this.pos.x, this.pos.y + 0.7, this.pos.z), _w.set(rand(-1, 1), 1.5, rand(-1, 1)), p.color, 0.05, 0.5);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
  escape() {
    const w = this.world;
    w.fx.splash(_v.copy(this.pos).setY(this.pos.y + 0.5), UP, GRAY_HEX, 16, 4, 0.08);
    w.audio?.sfx('goo_in', { ...posOf(this.pos), volume: 0.6 });
    this.escaped = true;
    this.die(null, 'clear');
  }
}

export const NEW_KINDS = { warden: Warden, glint: Glint, rumbler: Rumbler, gooper: Gooper, splotch: Splotch, pilfer: Pilfer };

// Factory for every Drab kind (basic ones live in enemies.js).
export function spawnDrab(world, def) {
  const K = NEW_KINDS[def.kind];
  return K ? new K(world, def.pos, { ...def }) : makeBasic(world, def);
}
