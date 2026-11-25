// Weapon definitions + the combat system (projectiles, beams, bombs,
// explosions, specials). Damage is in HP (fighters have 100).
import * as THREE from 'three';
import { buildBombModel } from './character.js';
import { rand, clamp, segCapsuleDistSq } from '../util.js';

export const WEAPONS = {
  spritzer: {
    id: 'spritzer', name: 'Spritzer', type: 'shooter', price: 0, level: 1,
    desc: 'A fast-firing all-rounder. Sprays a steady stream of ink at mid range — great for painting and pressure.',
    stats: { range: 0.45, damage: 0.45, rate: 0.85, paint: 0.65, mobility: 0.75 },
    rate: 0.1, ink: 0.0095, dmg: 34, speed: 32, range: 11, spread: 3.5, airSpread: 9, splat: 0.72, trail: 0.4, trailEvery: 1.9,
    moveMul: 0.72, sub: 'bomb', special: 'barrage', specialCost: 160,
  },
  roller: {
    id: 'roller', name: 'Sweeper Roller', type: 'roller', price: 1200, level: 1,
    desc: 'Roll a wide carpet of ink and flatten anyone in your path. Tap fire to fling a wide wave of paint.',
    stats: { range: 0.3, damage: 0.95, rate: 0.35, paint: 0.95, mobility: 0.6 },
    rollInk: 0.07, rollWidth: 0.95, rollDmg: 150, flickRate: 0.65, flickInk: 0.075, flickDmg: 55, flickDrops: 9,
    moveMul: 0.78, sub: 'bomb', special: 'nova', specialCost: 190,
  },
  longshot: {
    id: 'longshot', name: 'Longshot', type: 'charger', price: 1800, level: 2,
    desc: 'A precision charger. Hold to charge, release for a long-range beam. A full charge splats in one hit.',
    stats: { range: 1.0, damage: 1.0, rate: 0.25, paint: 0.35, mobility: 0.45 },
    chargeTime: 0.95, ink: 0.16, minRange: 12, maxRange: 34, dmgMin: 40, dmgFull: 160, splat: 0.85,
    moveMul: 0.9, chargeMoveMul: 0.38, sub: 'bomb', special: 'barrage', specialCost: 200,
  },
  popper: {
    id: 'popper', name: 'Pop Blaster', type: 'blaster', price: 1500, level: 2,
    desc: 'Lobs explosive ink balls that burst on impact or at max range. A direct hit splats instantly.',
    stats: { range: 0.4, damage: 0.9, rate: 0.3, paint: 0.55, mobility: 0.6 },
    rate: 0.72, ink: 0.075, dmgDirect: 125, dmgSplash: 55, blastR: 2.3, speed: 24, range: 9.5, splat: 1.3, spread: 1.5,
    moveMul: 0.6, sub: 'bomb', special: 'nova', specialCost: 180,
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);

export const SUBS = { bomb: { name: 'Splash Bomb', ink: 0.65 } };
export const SPECIALS = {
  barrage: { name: 'Paint Barrage', desc: 'Lob a volley of giant ink balls at the area you aim at.' },
  nova: { name: 'Ink Nova', desc: 'Leap into the air and slam down in a huge burst of ink.' },
};

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zAxis = new THREE.Vector3(0, 0, 1);

export class Combat {
  constructor(world) {
    this.world = world;
    this.max = 500;
    this.proj = [];
    for (let i = 0; i < this.max; i++) {
      this.proj.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), team: 0, owner: null, kind: 'drop', dmg: 0, splat: 0.7, travelled: 0, range: 10, trailAcc: 0, trailEvery: 2, trail: 0.4, size: 0.1, grav: 0, def: null, target: null });
    }
    this.cursor = 0;
    const geo = new THREE.SphereGeometry(1, 12, 10);
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    world.scene.add(this.mesh);
    this.bombs = [];
    this.beams = [];
    const bgeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    bgeo.rotateX(Math.PI / 2);
    bgeo.translate(0, 0, 0.5);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.9 }));
      m.visible = false;
      m.frustumCulled = false;
      world.scene.add(m);
      this.beams.push({ mesh: m, t: 0 });
    }
    this.pending = []; // delayed barrage shots
    this.colorTmp = new THREE.Color();
  }

  color(team) { return this.world.colors[team]; }

  alloc() {
    for (let k = 0; k < this.max; k++) {
      const p = this.proj[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      if (!p.alive) return p;
    }
    return this.proj[this.cursor];
  }

  fire(owner, kind, origin, vel, opts) {
    const p = this.alloc();
    p.alive = true; p.kind = kind; p.owner = owner; p.team = owner.team;
    p.pos.copy(origin); p.vel.copy(vel);
    p.travelled = 0; p.trailAcc = 0;
    Object.assign(p, { dmg: 0, splat: 0.7, range: 99, trailEvery: 0, trail: 0, size: 0.1, grav: 0, def: null, direct: 0, blastR: 0 }, opts);
    return p;
  }

  // ---------------------------------------------------------------- weapons
  shooter(owner, origin, dir, def, airborne) {
    const spread = THREE.MathUtils.degToRad(airborne ? def.airSpread : def.spread);
    _v.copy(dir);
    _v.x += rand(-1, 1) * Math.tan(spread); _v.y += rand(-0.5, 0.5) * Math.tan(spread) * 0.6; _v.z += rand(-1, 1) * Math.tan(spread);
    _v.normalize().multiplyScalar(def.speed * rand(0.96, 1.04));
    this.fire(owner, 'drop', origin, _v, { dmg: def.dmg, splat: def.splat, range: def.range * rand(0.92, 1.05), trailEvery: def.trailEvery, trail: def.trail, size: 0.13, def });
    this.world.fx.spawn(origin, _v.clone().multiplyScalar(0.15), this.color(owner.team), 0.07, 0.12, { grav: 0 });
  }

  blaster(owner, origin, dir, def) {
    _v.copy(dir).normalize().multiplyScalar(def.speed);
    this.fire(owner, 'blob', origin, _v, { dmg: def.dmgDirect, splat: def.splat, range: def.range, size: 0.26, def, blastR: def.blastR, trailEvery: 2.2, trail: 0.35 });
  }

  flick(owner, origin, dir, def) {
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.asin(clamp(dir.y, -1, 1));
    for (let i = 0; i < def.flickDrops; i++) {
      const off = (i / (def.flickDrops - 1) - 0.5) * 0.9 + rand(-0.04, 0.04);
      const p2 = pitch + 0.18 + rand(-0.05, 0.12);
      _v.set(Math.sin(yaw + off) * Math.cos(p2), Math.sin(p2), Math.cos(yaw + off) * Math.cos(p2)).multiplyScalar(rand(11, 16));
      this.fire(owner, 'flick', origin, _v, { dmg: def.flickDmg, splat: 0.85, range: 0, grav: 1, size: 0.17, def });
    }
  }

  beam(owner, origin, dir, def, charge) {
    const w = this.world;
    const range = def.minRange + (def.maxRange - def.minRange) * charge;
    const full = charge >= 0.999;
    const dmg = full ? def.dmgFull : def.dmgMin + (def.dmgFull - def.dmgMin) * 0.55 * charge;
    const hit = w.level.raycast(origin, dir, range);
    let end = hit ? hit.t : range;
    // fighters along the beam
    let victim = null, vt = end;
    for (const f of w.fighters) {
      if (!f.alive || f.team === owner.team || f.invuln > 0) continue;
      _b.copy(origin).addScaledVector(dir, end);
      const d2 = segCapsuleDistSq(origin, _b, f.pos.x, f.pos.y + 0.3, f.pos.y + f.hitHeight(), f.pos.z);
      if (d2 < 0.45 * 0.45) {
        const t = _v.subVectors(f.pos, origin).dot(dir);
        if (t < vt) { vt = t; victim = f; }
      }
    }
    if (victim) { end = vt; this.damage(victim, dmg, owner, 'beam'); }
    // paint along the line below the beam
    const col = this.color(owner.team);
    for (let d = 1.2; d < end; d += 1.0) {
      _a.copy(origin).addScaledVector(dir, d);
      const down = w.level.raycast(_a, _dn, 2.5 + d * 0.05);
      if (down) this.paint(owner, down.point, 0.42 + charge * 0.2);
    }
    _a.copy(origin).addScaledVector(dir, end);
    if (hit && !victim) {
      this.paint(owner, hit.point, def.splat * (0.6 + charge * 0.5), { drips: 2 });
      w.fx.splash(hit.point, hit.normal, col, 8, 4, 0.07);
    }
    // visual
    const b = this.beams.find((x) => x.t <= 0) || this.beams[0];
    b.t = 0.28; b.max = 0.28;
    b.mesh.visible = true;
    b.mesh.position.copy(origin);
    b.mesh.quaternion.setFromUnitVectors(_zAxis, dir);
    b.mesh.scale.set(0.06 + charge * 0.05, 0.06 + charge * 0.05, end);
    b.mesh.material.color.copy(col).multiplyScalar(2.2);
    w.audio?.sfx(full ? 'charge_shot' : 'shoot_heavy', { ...posOf(origin), volume: 0.9 });
  }

  bomb(owner, origin, dir) {
    const m = buildBombModel(this.color(owner.team));
    m.position.copy(origin);
    this.world.scene.add(m);
    const vel = dir.clone().normalize().multiplyScalar(11.5);
    vel.y += 4.5;
    this.bombs.push({ owner, team: owner.team, mesh: m, pos: origin.clone(), vel, fuse: -1, beeps: 0, life: 0, landed: false });
    this.world.audio?.sfx('bomb_throw', posOf(origin));
  }

  barrage(owner, target) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      this.pending.push({ t: i * 0.11, owner, target: target.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5))) });
    }
    this.world.audio?.sfx('special_go', posOf(owner.pos));
  }

  launchBig(owner, target) {
    const from = owner.pos.clone().setY(owner.pos.y + 2.2);
    const T = 1.1;
    const g = 20;
    const vel = new THREE.Vector3((target.x - from.x) / T, (target.y - from.y + 0.5 * g * T * T) / T, (target.z - from.z) / T);
    this.fire(owner, 'big', from, vel, { dmg: 75, splat: 2.4, grav: 1, size: 0.42, blastR: 2.0 });
  }

  explode(pos, owner, radius, dmgMax, dmgMin, paintR, opts = {}) {
    const w = this.world;
    const col = this.color(owner.team);
    this.paint(owner, pos, paintR, { drips: 3 });
    // a few extra splats around for a messier ring
    for (let i = 0; i < (opts.extra ?? 4); i++) {
      const a = Math.random() * Math.PI * 2;
      _a.set(pos.x + Math.cos(a) * paintR * 0.8, pos.y, pos.z + Math.sin(a) * paintR * 0.8);
      this.paint(owner, _a, paintR * 0.4);
    }
    for (const f of w.fighters) {
      if (!f.alive || f.team === owner.team || f.invuln > 0) continue;
      _v.copy(f.pos).setY(f.pos.y + 0.6);
      const d = _v.distanceTo(pos);
      if (d < radius) {
        if (!w.level.visible(pos.clone().setY(pos.y + 0.3), _v)) continue;
        const dmg = dmgMax - (dmgMax - dmgMin) * (d / radius);
        this.damage(f, dmg, owner, 'blast');
      }
    }
    w.fx.explosion(pos, col, radius);
    w.audio?.sfx('explode', { ...posOf(pos), volume: Math.min(1, 0.5 + radius * 0.12) });
    w.onExplosion?.(pos, radius);
  }

  paint(owner, p, r, opts) {
    const gained = this.world.paint.splat(p, r, owner.team, opts);
    if (gained > 0) owner.addTurf?.(gained);
    return gained;
  }

  damage(victim, dmg, attacker, kind) {
    if (!victim.alive) return;
    victim.takeDamage(dmg, attacker, kind);
    this.world.onHit?.(attacker, victim, dmg);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const w = this.world;
    // barrage queue
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      q.t -= dt;
      if (q.t <= 0) {
        if (q.owner.alive || true) this.launchBig(q.owner, q.target);
        this.pending.splice(i, 1);
      }
    }
    let n = 0;
    for (const p of this.proj) {
      if (!p.alive) continue;
      this.stepProjectile(p, dt);
      if (!p.alive) continue;
      const sp = p.vel.length();
      _q.setFromUnitVectors(_zAxis, _v.copy(p.vel).divideScalar(sp || 1));
      const st = p.kind === 'drop' ? 1 + Math.min(sp * 0.05, 1.6) : 1.15;
      _s.set(p.size, p.size, p.size * st);
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, this.color(p.team));
      n++;
    }
    this.mesh.count = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
    this.updateBombs(dt);
    for (const b of this.beams) {
      if (b.t > 0) {
        b.t -= dt;
        const k = Math.max(0, b.t / b.max);
        b.mesh.material.opacity = k;
        b.mesh.scale.x = b.mesh.scale.y = Math.max(0.01, b.mesh.scale.x * (0.85 + 0.15 * k));
        if (b.t <= 0) b.mesh.visible = false;
      }
    }
  }

  stepProjectile(p, dt) {
    const w = this.world;
    const g = p.grav ? 20 : (p.travelled > p.range ? 34 : 0);
    p.vel.y -= g * dt;
    if (p.travelled > p.range && p.kind === 'drop') { p.vel.x *= 1 - 2.2 * dt; p.vel.z *= 1 - 2.2 * dt; p.dmg = Math.min(p.dmg, p.def ? p.def.dmg * 0.6 : p.dmg); }
    const step = p.vel.length() * dt;
    if (step < 1e-5) return;
    _v.copy(p.vel).divideScalar(step / dt).normalize();
    // fighters
    _a.copy(p.pos); _b.copy(p.pos).addScaledVector(_v, step);
    for (const f of w.fighters) {
      if (!f.alive || f.team === p.team || f.invuln > 0) continue;
      const dx = f.pos.x - p.pos.x, dz = f.pos.z - p.pos.z;
      if (dx * dx + dz * dz > (step + 2) * (step + 2)) continue;
      const rr = 0.4 + p.size * 0.5;
      const d2 = segCapsuleDistSq(_a, _b, f.pos.x, f.pos.y + 0.3, f.pos.y + f.hitHeight(), f.pos.z);
      if (d2 < rr * rr) {
        this.damage(f, p.dmg, p.owner, p.kind);
        const col = this.color(p.team);
        w.fx.splash(_b, _v.clone().negate(), col, 6, 3, 0.06);
        if (p.kind === 'blob' || p.kind === 'big') this.explode(_b.clone(), p.owner, p.blastR, p.kind === 'big' ? p.dmg : p.def.dmgSplash, 20, p.splat, { extra: 2 });
        p.alive = false;
        return;
      }
    }
    // level
    const hit = w.level.raycast(p.pos, _v, step);
    if (hit) {
      const col = this.color(p.team);
      if (p.kind === 'blob' || p.kind === 'big') {
        this.explode(hit.point.clone().addScaledVector(hit.normal, 0.1), p.owner, p.blastR, p.kind === 'big' ? p.dmg : p.def.dmgSplash, 20, p.splat, { extra: 3 });
      } else {
        this.paint(p.owner, hit.point, p.splat, { drips: Math.abs(hit.normal.y) < 0.5 ? 2 : 0 });
        w.fx.splash(hit.point, hit.normal, col, 5, 2.6, 0.055);
        if (Math.random() < 0.3) w.audio?.sfx('splat', { ...posOf(hit.point), volume: 0.35 });
      }
      p.alive = false;
      return;
    }
    p.pos.addScaledVector(_v, step);
    p.travelled += step;
    // drip trail onto the floor below
    if (p.trailEvery > 0) {
      p.trailAcc += step;
      if (p.trailAcc >= p.trailEvery) {
        p.trailAcc = 0;
        const down = w.level.raycast(p.pos, _dn, 4);
        if (down) this.paint(p.owner, down.point, p.trail * rand(0.8, 1.15));
      }
    }
    if (p.kind === 'blob' && p.travelled > p.range) {
      this.explode(p.pos.clone(), p.owner, p.blastR, p.def.dmgSplash, 20, p.splat * 0.6, { extra: 0 });
      p.alive = false;
    }
    if (p.pos.y < w.level.killY - 2) p.alive = false;
  }

  updateBombs(dt) {
    const w = this.world;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.life += dt;
      b.vel.y -= 22 * dt;
      const step = b.vel.length() * dt;
      if (step > 1e-5) {
        _v.copy(b.vel).normalize();
        const hit = w.level.raycast(b.pos, _v, step + 0.15);
        if (hit) {
          b.pos.copy(hit.point).addScaledVector(hit.normal, 0.16);
          const vn = b.vel.dot(hit.normal);
          b.vel.addScaledVector(hit.normal, -vn * 1.35);
          b.vel.multiplyScalar(hit.normal.y > 0.6 ? 0.55 : 0.7);
          if (hit.normal.y > 0.6 && !b.landed) { b.landed = true; b.fuse = 0.95; this.paint(b.owner, hit.point, 0.5); }
          if (hit.normal.y > 0.6 && Math.abs(vn) < 2.5) { b.vel.y = 0; b.vel.x *= 0.8; b.vel.z *= 0.8; }
        } else b.pos.addScaledVector(b.vel, dt);
      }
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x += dt * b.vel.z * 2; b.mesh.rotation.z -= dt * b.vel.x * 2;
      if (b.fuse >= 0) {
        b.fuse -= dt;
        const blink = Math.sin(b.fuse * 40) > 0;
        b.mesh.userData.inkMat.emissiveIntensity = blink ? 5 : 1;
        b.mesh.scale.setScalar(1 + (0.95 - b.fuse) * 0.4);
        const beat = Math.floor((0.95 - b.fuse) / 0.3);
        if (beat > b.beeps && b.beeps < 3) { b.beeps = beat; w.audio?.sfx('bomb_beep', posOf(b.pos)); }
      }
      if ((b.fuse < 0 && b.landed) || b.life > 5 || b.pos.y < w.level.killY - 1) {
        if (b.pos.y > w.level.killY) this.explode(b.pos.clone(), b.owner, 3.2, 180, 30, 3.0, { extra: 6 });
        w.scene.remove(b.mesh);
        b.mesh.traverse((o) => { if (o.material) o.material.dispose?.(); });
        this.bombs.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.proj) p.alive = false;
    for (const b of this.bombs) this.world.scene.remove(b.mesh);
    this.bombs = [];
    this.pending = [];
  }

  dispose() {
    this.clear();
    this.world.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    for (const b of this.beams) this.world.scene.remove(b.mesh);
  }
}

export function posOf(v) { return { x: v.x, y: v.y, z: v.z }; }
