// Weapon definitions + the combat system (projectiles, beams, melee, bombs,
// sprinklers, rain clouds, shields, specials). Damage is in HP (100 per fighter).
import * as THREE from 'three';
import { buildBombModel, OUTLINE_MAT } from './character.js';
import { rand, clamp, segCapsuleDistSq } from '../util.js';

export const WEAPONS = {
  spritzer: {
    id: 'spritzer', name: 'Spritzer', type: 'shooter', cls: 'Shooter', price: 0, level: 1,
    desc: 'A fast-firing all-rounder that sprays a steady stream of ink at mid range. Great for painting and pressure.',
    stats: { range: 0.45, damage: 0.45, rate: 0.85, paint: 0.65, mobility: 0.75 },
    rate: 0.1, ink: 0.0095, dmg: 34, speed: 32, range: 11, spread: 3.5, airSpread: 9, splat: 0.72, trail: 0.4, trailEvery: 1.9,
    moveMul: 0.72, sub: 'bomb', special: 'barrage', specialCost: 160,
  },
  spritzer_jr: {
    id: 'spritzer_jr', name: 'Spritzer Jr.', type: 'shooter', cls: 'Shooter', price: 500, level: 1,
    desc: 'A beginner-friendly blaster with a huge ink tank and a wide, forgiving spray. Paints like crazy.',
    stats: { range: 0.35, damage: 0.35, rate: 0.9, paint: 0.8, mobility: 0.85 },
    rate: 0.085, ink: 0.0062, dmg: 28, speed: 30, range: 9.5, spread: 7, airSpread: 12, splat: 0.8, trail: 0.45, trailEvery: 1.6,
    moveMul: 0.8, sub: 'sprinkler', special: 'shield', specialCost: 150,
  },
  twin: {
    id: 'twin', name: 'Twin Squirts', type: 'dualies', cls: 'Dualies', price: 1100, level: 2,
    desc: 'One blaster in each hand. Press JUMP while firing to dodge-roll, then plant your feet for laser-tight shots.',
    stats: { range: 0.4, damage: 0.45, rate: 0.9, paint: 0.55, mobility: 0.95 },
    rate: 0.09, ink: 0.0085, dmg: 30, speed: 31, range: 9.5, spread: 4.5, airSpread: 9, splat: 0.66, trail: 0.36, trailEvery: 2,
    moveMul: 0.82, rollInk: 0.08, sub: 'popbomb', special: 'jetpack', specialCost: 180,
  },
  roller: {
    id: 'roller', name: 'Sweeper Roller', type: 'roller', cls: 'Roller', price: 1200, level: 1,
    desc: 'Hold fire to roll a wide carpet of ink and flatten anyone in your path. Tap to fling a wave — jump first for a long vertical fling.',
    stats: { range: 0.3, damage: 0.95, rate: 0.35, paint: 0.95, mobility: 0.6 },
    rollInk: 0.07, rollWidth: 0.95, rollDmg: 150, rollHitCd: 0.4, rollSpeed: 4.3, flickRate: 0.65, flickInk: 0.075, flickDmg: 55, flickDrops: 9,
    flickSpread: 0.9, flickSpeed: [11, 16], moveMul: 0.78, sub: 'skid', special: 'nova', specialCost: 190,
  },
  brush: {
    id: 'brush', name: 'Swish Brush', type: 'brush', cls: 'Brush', price: 900, level: 2,
    desc: 'Hold fire to sprint while painting a trail behind you. Mash fire to flick rapid little splashes. Super mobile.',
    stats: { range: 0.2, damage: 0.35, rate: 1.0, paint: 0.7, mobility: 1.0 },
    rollInk: 0.05, rollWidth: 0.55, rollDmg: 40, rollHitCd: 0.25, rollSpeed: 7.1, flickRate: 0.17, flickInk: 0.022, flickDmg: 24, flickDrops: 4,
    flickSpread: 0.5, flickSpeed: [9, 12], moveMul: 0.9, sub: 'popbomb', special: 'camo', specialCost: 170,
  },
  bucketeer: {
    id: 'bucketeer', name: 'Bucketeer', type: 'slosher', cls: 'Slosher', price: 1400, level: 2,
    desc: 'Swing a bucket of ink in a big arc. The slosh sails over walls and splashes whoever is hiding behind them.',
    stats: { range: 0.5, damage: 0.7, rate: 0.4, paint: 0.7, mobility: 0.7 },
    rate: 0.58, ink: 0.072, dmg: 70, dmgSmall: 32, speed: 13.5, splat: 1.1, moveMul: 0.7, sub: 'bomb', special: 'rain', specialCost: 180,
  },
  popper: {
    id: 'popper', name: 'Pop Blaster', type: 'blaster', cls: 'Blaster', price: 1500, level: 3,
    desc: 'Lobs explosive ink balls that burst on impact or at max range. A direct hit splashes in one shot.',
    stats: { range: 0.4, damage: 0.9, rate: 0.3, paint: 0.55, mobility: 0.6 },
    rate: 0.72, ink: 0.075, dmgDirect: 125, dmgSplash: 55, blastR: 2.3, speed: 24, range: 9.5, splat: 1.3, spread: 1.5,
    moveMul: 0.6, sub: 'sticky', special: 'nova', specialCost: 180,
  },
  whirlpool: {
    id: 'whirlpool', name: 'Whirlpool', type: 'splatling', cls: 'Splatling', price: 2000, level: 3,
    desc: 'Hold fire to spin up the barrels, release to unleash a long, accurate torrent. A full charge shreds at range.',
    stats: { range: 0.75, damage: 0.6, rate: 1.0, paint: 0.6, mobility: 0.45 },
    chargeTime: 0.9, maxShots: 26, rate: 0.055, ink: 0.0072, dmg: 28, speed: 36, range: 15, spread: 3, airSpread: 7, splat: 0.7, trail: 0.4, trailEvery: 2.2,
    chargeMoveMul: 0.5, moveMul: 0.62, sub: 'sprinkler', special: 'barrage', specialCost: 200,
  },
  bumbershoot: {
    id: 'bumbershoot', name: 'Bumbershoot', type: 'brella', cls: 'Brella', price: 1800, level: 4,
    desc: 'A shotgun umbrella. Tap to blast a cone of ink; hold to pop open a canopy that blocks incoming shots.',
    stats: { range: 0.35, damage: 0.8, rate: 0.35, paint: 0.6, mobility: 0.6 },
    rate: 0.7, ink: 0.065, pellets: 9, dmg: 18, pelletSpread: 11, speed: 27, range: 8.5, splat: 0.55, shieldHP: 220, shieldInk: 0.09, shieldCd: 6,
    moveMul: 0.65, sub: 'sticky', special: 'shield', specialCost: 180,
  },
  longshot: {
    id: 'longshot', name: 'Longshot', type: 'charger', cls: 'Charger', price: 1800, level: 4,
    desc: 'A precision charger. Hold to charge — your laser sight gives you away — release for a long beam. Full charge splashes in one hit.',
    stats: { range: 1.0, damage: 1.0, rate: 0.25, paint: 0.35, mobility: 0.45 },
    chargeTime: 0.95, ink: 0.16, minRange: 12, maxRange: 34, dmgMin: 40, dmgFull: 160, splat: 0.85,
    moveMul: 0.9, chargeMoveMul: 0.38, sub: 'popbomb', special: 'rain', specialCost: 200,
  },
  arcbow: {
    id: 'arcbow', name: 'Arc Bow', type: 'stringer', cls: 'Stringer', price: 2200, level: 5,
    desc: 'Draw and release three arrows in a fan. Fully drawn arrows stick where they land and burst a moment later.',
    stats: { range: 0.85, damage: 0.75, rate: 0.35, paint: 0.5, mobility: 0.6 },
    chargeTime: 0.75, ink: 0.11, arrows: 3, minRange: 9, maxRange: 26, dmgMin: 30, dmgFull: 52, speed: 44, splat: 0.7, trail: 0.38, trailEvery: 1.2,
    burstDmg: 35, burstR: 1.7, chargeMoveMul: 0.6, moveMul: 0.85, sub: 'skid', special: 'camo', specialCost: 190,
  },
  inkblade: {
    id: 'inkblade', name: 'Ink Blade', type: 'splatana', cls: 'Splatana', price: 2400, level: 5,
    desc: 'Slash to send short waves of ink. Hold and release for a powerful overhead chop that sends a long ink wave.',
    stats: { range: 0.3, damage: 0.8, rate: 0.75, paint: 0.6, mobility: 0.85 },
    rate: 0.34, ink: 0.03, slashDmg: 60, slashRange: 2.4, waveDmg: 26, chargeTime: 0.55, chopDmg: 90, chopInk: 0.07, waveSpeed: 26, waveRange: 11,
    moveMul: 0.88, sub: 'bomb', special: 'jetpack', specialCost: 180,
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);

export const SUBS = {
  bomb: { name: 'Splash Bomb', ink: 0.65, desc: 'A classic bomb. Bounces, beeps, bursts.' },
  sticky: { name: 'Sticky Bomb', ink: 0.7, desc: 'Sticks to any surface and lets out a huge blast.' },
  popbomb: { name: 'Pop Bomb', ink: 0.4, desc: 'Bursts the instant it touches anything. Cheap and quick.' },
  skid: { name: 'Skid Bomb', ink: 0.6, desc: 'Slides along the ground painting a line, then explodes.' },
  sprinkler: { name: 'Spritz Sprinkler', ink: 0.6, desc: 'Sticks to a surface and sprays ink around for a while.' },
};
export const SPECIALS = {
  barrage: { name: 'Paint Barrage', desc: 'Lob a volley of giant ink balls at the area you aim at.' },
  nova: { name: 'Ink Nova', desc: 'Leap into the air and slam down in a huge burst of ink.' },
  rain: { name: 'Rain Cloud', desc: 'Toss a storm cloud that drifts along raining ink.' },
  jetpack: { name: 'Jet Pack', desc: 'Hover above the battle firing explosive ink shots.' },
  camo: { name: 'Chroma Camo', desc: 'Blend in like a true chameleon — invisible, faster, refilling.' },
  shield: { name: 'Bubble Shield', desc: 'Pop a bubble that blocks enemy fire for you and your team.' },
};

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dn = new THREE.Vector3(0, -1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zAxis = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class Combat {
  constructor(world) {
    this.world = world;
    this.max = 600;
    this.proj = [];
    for (let i = 0; i < this.max; i++) {
      this.proj.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), team: 0, owner: null, kind: 'drop', dmg: 0, splat: 0.7, travelled: 0, range: 10, trailAcc: 0, trailEvery: 2, trail: 0.4, size: 0.1, grav: 0, def: null, falloff: 0 });
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
    this.sprinklers = [];
    this.clouds = [];
    this.domes = [];
    this.bursts = []; // delayed arrow bursts
    this.beams = [];
    const bgeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    bgeo.rotateX(Math.PI / 2);
    bgeo.translate(0, 0, 0.5);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.9 }));
      m.visible = false;
      m.frustumCulled = false;
      world.scene.add(m);
      this.beams.push({ mesh: m, t: 0 });
    }
    this.pending = [];
  }

  color(team) { return this.world.colors[team]; }

  // ---- networking helpers
  get net() { return this.world.net || null; }
  isClientLocal(owner) { const n = this.world.net; return n && n.role === 'client' && owner === n.local; }
  isClient() { return this.world.net?.role === 'client'; }
  emit(e) { const n = this.world.net; if (n && n.role === 'host' && !this.silent) n.emit(e, n.fromPeer); }
  emitAll(e) { const n = this.world.net; if (n && n.role === 'host') n.emit(e, null); }

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
    Object.assign(p, { dmg: 0, splat: 0.7, range: 99, trailEvery: 0, trail: 0, size: 0.1, grav: 0, def: null, blastR: 0, falloff: 0.6, burst: false, life: 0, cosmetic: false, fell: false }, opts);
    p.splashDmg = opts?.splashDmg;
    const n = this.world.net;
    if (n?.role === 'client') {
      p.cosmetic = true;
      if (owner === n.local && !this.silent) {
        const o = {}; for (const k of ['dmg', 'splat', 'range', 'trailEvery', 'trail', 'size', 'grav', 'blastR', 'splashDmg', 'falloff', 'burst']) if (p[k] !== undefined) o[k] = p[k];
        n.action({ m: 'fire', k: kind, p: v3a(origin), v: v3a(vel), o }, owner);
      }
    } else if (n?.role === 'host' && !this.silent) {
      n.emit({ e: 'proj', k: kind, p: v3a(origin), v: v3a(vel), s: p.size, g: p.grav, r: Math.round(p.range * 10) / 10, t: p.team, b: p.burst ? 1 : 0 }, n.fromPeer);
    }
    return p;
  }

  // a projectile that only exists to be seen (clients render host projectiles this way)
  fireCosmetic(team, kind, origin, vel, size, grav, range) {
    const p = this.alloc();
    p.alive = true; p.kind = kind; p.owner = null; p.team = team;
    p.pos.copy(origin); p.vel.copy(vel);
    Object.assign(p, { travelled: 0, trailAcc: 0, dmg: 0, splat: 0.7, range, trailEvery: 0, trail: 0, size, grav, def: null, blastR: 0, falloff: 0.6, burst: false, life: 0, cosmetic: true, fell: false });
    return p;
  }

  // ---------------------------------------------------------------- mains
  shooter(owner, origin, dir, def, airborne, spreadMul = 1) {
    const spread = THREE.MathUtils.degToRad(airborne ? def.airSpread : def.spread) * spreadMul;
    _v.copy(dir);
    _v.x += rand(-1, 1) * Math.tan(spread); _v.y += rand(-0.5, 0.5) * Math.tan(spread) * 0.6; _v.z += rand(-1, 1) * Math.tan(spread);
    _v.normalize().multiplyScalar(def.speed * rand(0.96, 1.04));
    this.fire(owner, 'drop', origin, _v, { dmg: def.dmg, splat: def.splat, range: def.range * rand(0.92, 1.05), trailEvery: def.trailEvery, trail: def.trail, size: 0.13, def });
    this.world.fx.spawn(origin, _v.clone().multiplyScalar(0.15), this.color(owner.team), 0.07, 0.12, { grav: 0 });
  }

  blaster(owner, origin, dir, def, opts = {}) {
    _v.copy(dir).normalize().multiplyScalar(opts.speed || def.speed);
    this.fire(owner, 'blob', origin, _v, { dmg: opts.direct ?? def.dmgDirect, splat: opts.splat ?? def.splat, range: opts.range ?? def.range, size: 0.26, def, blastR: opts.blastR ?? def.blastR, splashDmg: opts.splash ?? def.dmgSplash, trailEvery: 2.2, trail: 0.35, grav: opts.grav || 0 });
  }

  slosh(owner, origin, dir, def) {
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.asin(clamp(dir.y, -1, 1)) + 0.22;
    const mk = (sp, dy, size, dmg, splat) => {
      _v.set(Math.sin(yaw) * Math.cos(pitch + dy), Math.sin(pitch + dy), Math.cos(yaw) * Math.cos(pitch + dy)).multiplyScalar(sp);
      this.fire(owner, 'slosh', origin, _v, { dmg, splat, grav: 1, size, trailEvery: 1.3, trail: 0.45, def });
    };
    mk(def.speed, 0, 0.3, def.dmg, def.splat);
    for (let i = 1; i <= 4; i++) mk(def.speed * (1 - i * 0.1), -i * 0.03, 0.17, def.dmgSmall, 0.7);
    this.world.fx.splash(origin, _up, this.color(owner.team), 6, 3, 0.07);
  }

  brella(owner, origin, dir, def) {
    const sp = THREE.MathUtils.degToRad(def.pelletSpread);
    for (let i = 0; i < def.pellets; i++) {
      _v.copy(dir);
      _v.x += rand(-1, 1) * Math.tan(sp); _v.y += rand(-0.6, 0.6) * Math.tan(sp); _v.z += rand(-1, 1) * Math.tan(sp);
      _v.normalize().multiplyScalar(def.speed * rand(0.9, 1.08));
      this.fire(owner, 'drop', origin, _v, { dmg: def.dmg, splat: def.splat, range: def.range * rand(0.8, 1.05), size: 0.1, def, falloff: 0.35 });
    }
    this.world.fx.splash(origin, dir, this.color(owner.team), 6, 4, 0.07, 0.4);
  }

  flick(owner, origin, dir, def, vertical = false) {
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.asin(clamp(dir.y, -1, 1));
    const n = def.flickDrops;
    const spread = vertical ? 0.22 : def.flickSpread;
    const [s0, s1] = def.flickSpeed || [11, 16];
    for (let i = 0; i < n; i++) {
      const off = (i / Math.max(1, n - 1) - 0.5) * spread + rand(-0.04, 0.04);
      const p2 = pitch + (vertical ? 0.28 + (i / n) * 0.12 : 0.18 + rand(-0.05, 0.12));
      _v.set(Math.sin(yaw + off) * Math.cos(p2), Math.sin(p2), Math.cos(yaw + off) * Math.cos(p2)).multiplyScalar(vertical ? rand(s1, s1 * 1.3) : rand(s0, s1));
      this.fire(owner, 'flick', origin, _v, { dmg: def.flickDmg, splat: def.type === 'brush' ? 0.6 : 0.85, range: 0, grav: 1, size: def.type === 'brush' ? 0.12 : 0.17, def });
    }
  }

  arrows(owner, origin, dir, def, charge) {
    const full = charge >= 0.999;
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.asin(clamp(dir.y, -1, 1));
    const spread = full ? 0.06 : 0.11 + (1 - charge) * 0.1;
    const speed = def.speed * (0.55 + 0.45 * charge);
    const range = def.minRange + (def.maxRange - def.minRange) * charge;
    const dmg = def.dmgMin + (def.dmgFull - def.dmgMin) * charge;
    for (let i = 0; i < def.arrows; i++) {
      const off = (i - (def.arrows - 1) / 2) * spread;
      _v.set(Math.sin(yaw + off) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw + off) * Math.cos(pitch)).multiplyScalar(speed);
      this.fire(owner, 'arrow', origin, _v, { dmg, splat: def.splat, range, trailEvery: def.trailEvery, trail: def.trail, size: 0.09, def, burst: full });
    }
  }

  slash(owner, origin, dir, def, chop) {
    const w = this.world;
    // melee arc in front of the owner
    const fx = dir.x, fz = dir.z, fl = Math.hypot(fx, fz) || 1;
    const dmg = chop ? def.chopDmg : def.slashDmg;
    for (const f of w.fighters) {
      if (!f.alive || f.team === owner.team || f.invuln > 0) continue;
      const dx = f.pos.x - owner.pos.x, dz = f.pos.z - owner.pos.z, d = Math.hypot(dx, dz);
      if (d > def.slashRange + 0.4 || Math.abs(f.pos.y - owner.pos.y) > 1.6) continue;
      const cos = (dx * fx + dz * fz) / (fl * (d || 1));
      if (cos < (chop ? 0.75 : 0.35)) continue;
      this.damage(f, dmg, owner, 'slash');
      w.fx.splash(f.pos.clone().setY(f.pos.y + 0.9), dir, this.color(owner.team), 8, 3, 0.07);
    }
    if (chop) {
      _v.copy(dir).setY(Math.max(-0.2, dir.y)).normalize().multiplyScalar(def.waveSpeed);
      this.fire(owner, 'wave', origin, _v, { dmg: 70, splat: 0.9, range: def.waveRange, size: 0.34, trailEvery: 0.7, trail: 0.6, def });
    } else {
      const yaw = Math.atan2(dir.x, dir.z);
      for (let i = 0; i < 5; i++) {
        const off = (i / 4 - 0.5) * 0.8;
        _v.set(Math.sin(yaw + off), Math.max(0.05, dir.y + 0.12), Math.cos(yaw + off)).normalize().multiplyScalar(rand(10, 13));
        this.fire(owner, 'flick', origin, _v, { dmg: def.waveDmg, splat: 0.65, grav: 1, size: 0.13, def });
      }
    }
    // sweep of ink on the ground in front
    _a.copy(owner.pos).addScaledVector(_v.set(fx / fl, 0, fz / fl), 1.3).setY(owner.pos.y + 0.5);
    const down = w.level.raycast(_a, _dn, 1.5);
    if (down) this.paint(owner, down.point, chop ? 1.1 : 0.8);
  }

  beam(owner, origin, dir, def, charge) {
    const w = this.world;
    const range = def.minRange + (def.maxRange - def.minRange) * charge;
    const full = charge >= 0.999;
    const dmg = full ? def.dmgFull : def.dmgMin + (def.dmgFull - def.dmgMin) * 0.55 * charge;
    const hit = w.level.raycast(origin, dir, range);
    let end = hit ? hit.t : range;
    _b.copy(origin).addScaledVector(dir, end);
    const blk = this.blocked(origin, _b, owner.team, dmg);
    let blockedAt = false;
    if (blk) { end = blk.t * end; blockedAt = true; }
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
    const col = this.color(owner.team);
    for (let d = 1.2; d < end; d += 1.0) {
      _a.copy(origin).addScaledVector(dir, d);
      const down = w.level.raycast(_a, _dn, 2.5 + d * 0.05);
      if (down) this.paint(owner, down.point, 0.42 + charge * 0.2);
    }
    if (hit && !victim && !blockedAt) {
      this.paint(owner, hit.point, def.splat * (0.6 + charge * 0.5), { drips: 2 });
      w.fx.splash(hit.point, hit.normal, col, 8, 4, 0.07);
    }
    const b = this.beams.find((x) => x.t <= 0) || this.beams[0];
    b.t = 0.28; b.max = 0.28;
    b.mesh.visible = true;
    b.mesh.position.copy(origin);
    b.mesh.quaternion.setFromUnitVectors(_zAxis, dir);
    b.mesh.scale.set(0.06 + charge * 0.05, 0.06 + charge * 0.05, end);
    b.mesh.material.color.copy(col).multiplyScalar(2.2);
    w.audio?.sfx(full ? 'charge_shot' : 'shoot_heavy', { ...posOf(origin), volume: 0.9 });
    const fx = { e: 'beam', p: v3a(origin), d: v3a(dir), l: Math.round(end * 100) / 100, c: Math.round(charge * 100) / 100, t: owner.team };
    if (this.isClientLocal(owner)) this.net.action({ m: 'beamfx', ...fx }, owner);
    else this.emit(fx);
  }

  beamVisual(team, origin, dir, len, charge) {
    const b = this.beams.find((x) => x.t <= 0) || this.beams[0];
    b.t = 0.28; b.max = 0.28;
    b.mesh.visible = true;
    b.mesh.position.copy(origin);
    b.mesh.quaternion.setFromUnitVectors(_zAxis, dir);
    b.mesh.scale.set(0.06 + charge * 0.05, 0.06 + charge * 0.05, len);
    b.mesh.material.color.copy(this.color(team)).multiplyScalar(2.2);
    this.world.audio?.sfx(charge >= 0.999 ? 'charge_shot' : 'shoot_heavy', { ...posOf(origin), volume: 0.8 });
  }

  // ---------------------------------------------------------------- subs
  throwSub(owner, kind, origin, dir, cosmetic = false) {
    const w = this.world;
    if (this.isClientLocal(owner)) { this.net.action({ m: 'sub', k: kind, p: v3a(origin), d: v3a(dir) }, owner); cosmetic = true; }
    else if (this.isClient()) cosmetic = true;
    const m = buildBombModel(this.color(owner.team), kind);
    m.position.copy(origin);
    w.scene.add(m);
    const vel = dir.clone().normalize();
    if (kind === 'skid') { vel.y = 0; vel.normalize().multiplyScalar(9); vel.y = 2; }
    else if (kind === 'popbomb') { vel.multiplyScalar(14); vel.y += 3.5; }
    else { vel.multiplyScalar(11.5); vel.y += 4.5; }
    const b = { kind, owner, team: owner.team, mesh: m, pos: origin.clone(), vel, fuse: -1, beeps: 0, life: 0, landed: false, stuck: false, trailAcc: 0, cosmetic };
    if (!cosmetic) this.emit({ e: 'bomb', k: kind, p: v3a(origin), d: v3a(dir), t: owner.team });
    if (kind === 'sprinkler') {
      for (const s of this.sprinklers) if (s.owner === owner) s.life = 999; // one per owner
    }
    this.bombs.push(b);
    w.audio?.sfx(kind === 'skid' ? 'skid_bomb_launch' : 'bomb_throw', posOf(origin));
  }

  // ---------------------------------------------------------------- specials
  barrage(owner, target) {
    if (this.isClientLocal(owner)) { this.net.action({ m: 'barrage', p: v3a(target) }, owner); this.world.audio?.sfx('special_go', posOf(owner.pos)); return; }
    for (let i = 0; i < 9; i++) {
      this.pending.push({ t: i * 0.11, owner, target: target.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5))) });
    }
    this.world.audio?.sfx('special_go', posOf(owner.pos));
  }

  launchBig(owner, target) {
    const from = owner.pos.clone().setY(owner.pos.y + 2.2);
    const T = 1.1, g = 20;
    const vel = new THREE.Vector3((target.x - from.x) / T, (target.y - from.y + 0.5 * g * T * T) / T, (target.z - from.z) / T);
    this.fire(owner, 'big', from, vel, { dmg: 75, splat: 2.4, grav: 1, size: 0.42, blastR: 2.0, splashDmg: 75 });
  }

  rainCloud(owner, target, dir, cosmetic = false) {
    const w = this.world;
    if (this.isClientLocal(owner)) { this.net.action({ m: 'rain', p: v3a(target), d: v3a(dir) }, owner); return; }
    if (!cosmetic) this.emitAll({ e: 'cloud', p: v3a(target), d: v3a(dir), t: owner.team });
    const grp = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: this.color(owner.team), roughness: 0.6, clearcoat: 0.5, transparent: true, opacity: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3550, roughness: 0.9, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.9, 1.5), 1), i % 3 ? mat : dark);
      s.geometry.userData.own = true;
      s.position.set(rand(-2, 2), rand(-0.3, 0.4), rand(-1.4, 1.4));
      grp.add(s);
    }
    const ground = w.level.heightAt(target.x, target.z).y;
    const y = (Number.isFinite(ground) ? ground : owner.pos.y) + 7;
    grp.position.set(target.x, y, target.z);
    w.scene.add(grp);
    const d = dir.clone().setY(0).normalize().multiplyScalar(1.2);
    this.clouds.push({ owner, team: owner.team, grp, mats: [mat, dark], vel: d, t: 7, dropT: 0, hitT: 0, cosmetic: cosmetic || this.isClient() });
    w.audio?.sfx('rain_start', posOf(target));
  }

  bubble(owner, cosmetic = false, at = null) {
    const w = this.world;
    if (this.isClientLocal(owner)) { this.net.action({ m: 'bubble' }, owner); return; }
    const mat = new THREE.MeshPhysicalMaterial({ color: this.color(owner.team), roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, emissive: this.color(owner.team), emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
    mesh.geometry.userData.own = true;
    const pos = at ? at.clone() : owner.pos.clone().setY(owner.pos.y + 0.4);
    if (!cosmetic) this.emitAll({ e: 'dome', p: v3a(pos), t: owner.team });
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.1);
    w.scene.add(mesh);
    this.domes.push({ owner, team: owner.team, pos, r: 3.6, mesh, t: 6.5, hp: 1200, cosmetic: cosmetic || this.isClient() });
    w.audio?.sfx('shield_up', posOf(pos));
  }

  explode(pos, owner, radius, dmgMax, dmgMin, paintR, opts = {}) {
    const w = this.world;
    if (this.isClient()) {
      if (owner === this.net.local) this.net.action({ m: 'explode', p: v3a(pos), r: radius, a: dmgMax, b: dmgMin, pr: paintR, x: opts.extra ?? 4, s: opts.sound || null }, owner);
      return; // the host's 'boom' event draws it
    }
    this.emitAll({ e: 'boom', p: v3a(pos), r: radius, t: owner.team, s: opts.sound || null });
    const col = this.color(owner.team);
    this.paint(owner, pos, paintR, { drips: 3 });
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
        if (this.domeBetween(pos, _v, owner.team)) continue;
        const dmg = dmgMax - (dmgMax - dmgMin) * (d / radius);
        this.damage(f, dmg, owner, 'blast');
      }
    }
    w.fx.explosion(pos, col, radius);
    w.audio?.sfx(opts.sound || 'explode', { ...posOf(pos), volume: Math.min(1, 0.5 + radius * 0.12) });
    w.onExplosion?.(pos, radius);
  }

  paint(owner, p, r, opts) {
    if (this.isClient()) {
      if (owner === this.net.local) this.net.action({ m: 'paint', p: v3a(p), r: Math.round(r * 100) / 100, o: opts ? { drips: opts.drips || 0, wobble: opts.wobble } : null }, owner);
      return 0;
    }
    const gained = this.world.paint.splat(p, r, owner.team, opts);
    if (gained > 0) owner.addTurf?.(gained);
    return gained;
  }

  damage(victim, dmg, attacker, kind) {
    if (this.isClient()) {
      if (attacker === this.net.local && victim.netId >= 0) this.net.action({ m: 'dmg', v: victim.netId, d: Math.round(dmg), k: kind }, attacker);
      return;
    }
    if (!victim.alive) return;
    victim.takeDamage(dmg, attacker, kind);
    this.world.onHit?.(attacker, victim, dmg);
  }

  // ---------------------------------------------------------------- shields
  // Is the segment a->b stopped by an enemy shield? Returns {t (0..1), point} or null; damages the shield.
  blocked(a, b, team, dmg = 20) {
    let best = null;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    for (const d of this.domes) {
      if (d.team === team) continue;
      // only block shots coming from outside
      if (a.distanceTo(d.pos) < d.r) continue;
      const fx = a.x - d.pos.x, fy = a.y - d.pos.y, fz = a.z - d.pos.z;
      const A = dx * dx + dy * dy + dz * dz, B = 2 * (fx * dx + fy * dy + fz * dz), C = fx * fx + fy * fy + fz * fz - d.r * d.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t <= 1 && (!best || t < best.t)) best = { t, shield: d };
    }
    for (const f of this.world.fighters) {
      if (!f.shieldOpen || f.team === team || !f.alive) continue;
      // canopy disc in front of the brella holder
      const fw = _c.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
      const cx = f.pos.x + fw.x * 0.75, cy = f.pos.y + 0.95, cz = f.pos.z + fw.z * 0.75;
      const den = dx * fw.x + dz * fw.z;
      if (den >= 0) continue; // shot must travel toward the canopy front
      const t = ((cx - a.x) * fw.x + (cz - a.z) * fw.z) / den;
      if (t < 0 || t > 1) continue;
      const px = a.x + dx * t - cx, py = a.y + dy * t - cy, pz = a.z + dz * t - cz;
      if (px * px + py * py + pz * pz < 0.85 * 0.85 && (!best || t < best.t)) best = { t, brella: f };
    }
    if (best) {
      if (best.shield) { best.shield.hp -= dmg; }
      if (best.brella) best.brella.shieldHit(dmg);
      best.point = new THREE.Vector3(a.x + dx * best.t, a.y + dy * best.t, a.z + dz * best.t);
      this.world.fx.splash(best.point, _v.set(-dx, -dy, -dz).normalize(), 0xffffff, 4, 2, 0.05);
    }
    return best;
  }

  domeBetween(a, b, team) {
    for (const d of this.domes) {
      if (d.team === team) continue;
      const ina = a.distanceTo(d.pos) < d.r, inb = b.distanceTo(d.pos) < d.r;
      if (ina !== inb) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      q.t -= dt;
      if (q.t <= 0) { this.launchBig(q.owner, q.target); this.pending.splice(i, 1); }
    }
    let n = 0;
    for (const p of this.proj) {
      if (!p.alive) continue;
      this.stepProjectile(p, dt);
      if (!p.alive) continue;
      const sp = p.vel.length();
      _q.setFromUnitVectors(_zAxis, _v.copy(p.vel).divideScalar(sp || 1));
      const st = p.kind === 'drop' || p.kind === 'arrow' ? 1 + Math.min(sp * 0.05, p.kind === 'arrow' ? 4 : 1.6) : p.kind === 'wave' ? 0.5 : 1.15;
      if (p.kind === 'wave') _s.set(p.size * 2.6, p.size * 0.6, p.size);
      else _s.set(p.size, p.size, p.size * st);
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, this.color(p.team));
      n++;
    }
    this.mesh.count = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
    this.updateBombs(dt);
    this.updateSprinklers(dt);
    this.updateClouds(dt);
    this.updateDomes(dt);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t -= dt;
      if (b.t <= 0) { this.explode(b.pos, b.owner, b.r, b.dmg, 10, b.r * 0.8, { extra: 1, sound: 'pop_bomb' }); this.disposeMesh(b.mesh); this.bursts.splice(i, 1); }
      else b.mesh.scale.setScalar(1 + Math.sin(b.t * 40) * 0.15);
    }
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
    p.life += dt;
    const g = p.grav ? 20 : (p.travelled > p.range ? 34 : 0);
    p.vel.y -= g * dt;
    if (p.travelled > p.range && (p.kind === 'drop' || p.kind === 'arrow')) {
      p.vel.x *= 1 - 2.2 * dt; p.vel.z *= 1 - 2.2 * dt;
      if (!p.fell) { p.fell = true; p.dmg *= p.falloff; }
    }
    const step = p.vel.length() * dt;
    if (step < 1e-5) return;
    _v.copy(p.vel).divideScalar(step / dt).normalize();
    _a.copy(p.pos); _b.copy(p.pos).addScaledVector(_v, step);
    if (p.cosmetic) { this.stepCosmetic(p, step); return; }
    // shields
    if (this.domes.length || w.fighters.some((f) => f.shieldOpen)) {
      const blk = this.blocked(_a, _b, p.team, p.dmg);
      if (blk) { p.alive = false; return; }
    }
    // fighters
    for (const f of w.fighters) {
      if (!f.alive || f.team === p.team || f.invuln > 0) continue;
      const dx = f.pos.x - p.pos.x, dz = f.pos.z - p.pos.z;
      if (dx * dx + dz * dz > (step + 2.5) * (step + 2.5)) continue;
      const rr = 0.4 + p.size * 0.5;
      const d2 = segCapsuleDistSq(_a, _b, f.pos.x, f.pos.y + 0.3, f.pos.y + f.hitHeight(), f.pos.z);
      if (d2 < rr * rr) {
        this.damage(f, p.dmg, p.owner, p.kind);
        w.fx.splash(_b, _v.clone().negate(), this.color(p.team), 6, 3, 0.06);
        if (p.kind === 'blob' || p.kind === 'big') this.explode(_b.clone(), p.owner, p.blastR, p.splashDmg ?? p.dmg, 20, p.splat, { extra: 2 });
        if (p.kind !== 'wave') { p.alive = false; return; }
      }
    }
    // level
    const hit = w.level.raycast(p.pos, _v, step);
    if (hit) {
      const col = this.color(p.team);
      if (p.kind === 'blob' || p.kind === 'big') {
        this.explode(hit.point.clone().addScaledVector(hit.normal, 0.1), p.owner, p.blastR, p.splashDmg ?? p.dmg, 20, p.splat, { extra: 3 });
      } else {
        this.paint(p.owner, hit.point, p.splat, { drips: Math.abs(hit.normal.y) < 0.5 ? 2 : 0 });
        w.fx.splash(hit.point, hit.normal, col, p.kind === 'slosh' ? 10 : 5, p.kind === 'slosh' ? 3.5 : 2.6, 0.055);
        if (p.kind === 'arrow' && p.burst) {
          const m = new THREE.Mesh(this.mesh.geometry, new THREE.MeshBasicMaterial({ color: col }));
          m.scale.setScalar(0.14);
          m.position.copy(hit.point);
          w.scene.add(m);
          this.bursts.push({ pos: hit.point.clone().addScaledVector(hit.normal, 0.15), owner: p.owner, r: p.def.burstR, dmg: p.def.burstDmg, t: 0.55, mesh: m });
        }
        if (p.kind === 'slosh' && p.size > 0.25) this.paint(p.owner, hit.point, p.splat * 0.6);
        if (Math.random() < 0.3) w.audio?.sfx('splat', { ...posOf(hit.point), volume: 0.35 });
      }
      p.alive = false;
      return;
    }
    p.pos.addScaledVector(_v, step);
    p.travelled += step;
    if (p.trailEvery > 0) {
      p.trailAcc += step;
      if (p.trailAcc >= p.trailEvery) {
        p.trailAcc = 0;
        const down = w.level.raycast(p.pos, _dn, p.kind === 'wave' ? 1.6 : 4);
        if (down) this.paint(p.owner, down.point, p.trail * rand(0.8, 1.15));
      }
    }
    if (p.kind === 'blob' && p.travelled > p.range && !p.grav) {
      this.explode(p.pos.clone(), p.owner, p.blastR, p.splashDmg, 20, p.splat * 0.6, { extra: 0 });
      p.alive = false;
    }
    if (p.kind === 'wave' && p.travelled > p.range) p.alive = false;
    if (p.pos.y < w.level.killY - 2 || p.life > 6) p.alive = false;
  }

  stepCosmetic(p, step) {
    const w = this.world;
    const hit = w.level.raycast(p.pos, _v, step);
    if (hit) {
      w.fx.splash(hit.point, hit.normal, this.color(p.team), p.kind === 'slosh' ? 8 : 4, 2.4, 0.05);
      p.alive = false;
      return;
    }
    p.pos.addScaledVector(_v, step);
    p.travelled += step;
    if ((p.kind === 'blob' && p.travelled > p.range && !p.grav) || (p.kind === 'wave' && p.travelled > p.range) || p.pos.y < w.level.killY - 2 || p.life > 6) p.alive = false;
  }

  updateBombs(dt) {
    const w = this.world;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.life += dt;
      let done = false;
      if (!b.stuck) {
        b.vel.y -= (b.kind === 'skid' && b.landed ? 30 : 22) * dt;
        const step = b.vel.length() * dt;
        if (step > 1e-5) {
          _v.copy(b.vel).normalize();
          const hit = w.level.raycast(b.pos, _v, step + 0.15);
          if (hit) {
            b.pos.copy(hit.point).addScaledVector(hit.normal, b.kind === 'skid' ? 0.08 : 0.16);
            if (b.kind === 'popbomb') { done = true; }
            else if (b.kind === 'sticky' || b.kind === 'sprinkler') {
              b.stuck = true; b.normal = hit.normal.clone(); b.vel.set(0, 0, 0);
              b.fuse = b.kind === 'sticky' ? 1.25 : -1;
              w.audio?.sfx(b.kind === 'sticky' ? 'sticky_attach' : 'sprinkler_place', posOf(b.pos));
              if (b.kind === 'sprinkler') {
                this.sprinklers.push({ owner: b.owner, team: b.team, pos: b.pos.clone(), normal: b.normal, mesh: b.mesh, life: 0, t: 0, cosmetic: b.cosmetic });
                b.mesh.quaternion.setFromUnitVectors(_up, b.normal);
                this.bombs.splice(i, 1);
                continue;
              }
            } else if (b.kind === 'skid') {
              if (hit.normal.y > 0.6) { b.landed = true; b.vel.y = 0; if (b.fuse < 0) b.fuse = 1.7; }
              else { const vn = b.vel.dot(hit.normal); b.vel.addScaledVector(hit.normal, -vn * 2); }
            } else {
              const vn = b.vel.dot(hit.normal);
              b.vel.addScaledVector(hit.normal, -vn * 1.35);
              b.vel.multiplyScalar(hit.normal.y > 0.6 ? 0.55 : 0.7);
              if (hit.normal.y > 0.6 && !b.landed) { b.landed = true; b.fuse = 0.95; this.paint(b.owner, hit.point, 0.5); }
              if (hit.normal.y > 0.6 && Math.abs(vn) < 2.5) { b.vel.y = 0; b.vel.x *= 0.8; b.vel.z *= 0.8; }
            }
          } else b.pos.addScaledVector(b.vel, dt);
        }
        if (b.kind === 'skid' && b.landed) {
          // keep sliding along the floor painting a line
          const g = w.level.groundAt(b.pos.x, b.pos.z, b.pos.y + 0.3, 0.1, 0.6);
          if (Number.isFinite(g.y)) b.pos.y = g.y + 0.08;
          b.trailAcc += dt;
          if (b.trailAcc > 0.06) { b.trailAcc = 0; this.paint(b.owner, b.pos.clone().setY(b.pos.y - 0.05), 0.42, { wobble: 0.1 }); }
          b.mesh.rotation.y += dt * 12;
        }
      }
      b.mesh.position.copy(b.pos);
      if (!b.stuck && b.kind !== 'skid') { b.mesh.rotation.x += dt * b.vel.z * 2; b.mesh.rotation.z -= dt * b.vel.x * 2; }
      if (b.fuse >= 0) {
        b.fuse -= dt;
        const blink = Math.sin(b.fuse * 40) > 0;
        b.mesh.userData.inkMat.emissiveIntensity = blink ? 5 : 1;
        const tot = b.kind === 'sticky' ? 1.25 : b.kind === 'skid' ? 1.7 : 0.95;
        b.mesh.scale.setScalar(1 + clamp((tot - b.fuse) / tot, 0, 1) * 0.35);
        const beat = Math.floor((tot - b.fuse) / 0.3);
        if (beat > b.beeps && b.beeps < 4 && (b.kind !== 'skid' || b.fuse < 0.6)) { b.beeps = beat; w.audio?.sfx('bomb_beep', { ...posOf(b.pos), pitch: 1 + b.beeps * 0.12 }); }
      }
      if (done || (b.fuse < 0 && (b.landed || b.stuck)) || b.life > 6 || b.pos.y < w.level.killY - 1) {
        if (b.pos.y > w.level.killY && !b.cosmetic) {
          if (b.kind === 'popbomb') this.explode(b.pos.clone(), b.owner, 2.1, 60, 25, 1.6, { extra: 2, sound: 'pop_bomb' });
          else if (b.kind === 'sticky') this.explode(b.pos.clone(), b.owner, 3.8, 180, 35, 3.4, { extra: 7 });
          else if (b.kind === 'skid') this.explode(b.pos.clone(), b.owner, 2.9, 180, 30, 2.6, { extra: 5 });
          else this.explode(b.pos.clone(), b.owner, 3.2, 180, 30, 3.0, { extra: 6 });
        }
        this.disposeMesh(b.mesh);
        this.bombs.splice(i, 1);
      }
    }
  }

  updateSprinklers(dt) {
    const w = this.world;
    this.silent = true; // drops are simulated on every machine, never sent
    for (let i = this.sprinklers.length - 1; i >= 0; i--) {
      const s = this.sprinklers[i];
      s.life += dt; s.t -= dt;
      const head = s.mesh.getObjectByName('head');
      if (head) head.rotation.y += dt * (s.life < 8 ? 14 : 7);
      if (s.t <= 0) {
        s.t = s.life < 8 ? 0.32 : 0.6;
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * Math.PI * 2;
          _v.set(Math.cos(a), 0, Math.sin(a)).addScaledVector(s.normal, 1.3).normalize().multiplyScalar(rand(6, 9));
          const o = s.pos.clone().addScaledVector(s.normal, 0.25);
          if (s.cosmetic) this.fireCosmetic(s.team, 'flick', o, _v, 0.11, 1, 0);
          else this.fire(s.owner, 'flick', o, _v, { dmg: 18, splat: 0.6, grav: 1, size: 0.11 });
        }
      }
      if (s.life > 20 || (!s.cosmetic && !s.owner.alive && s.life > 2)) { this.disposeMesh(s.mesh); this.sprinklers.splice(i, 1); }
    }
    this.silent = false;
  }

  updateClouds(dt) {
    const w = this.world;
    this.silent = true;
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t -= dt;
      c.grp.position.addScaledVector(c.vel, dt);
      c.grp.rotation.y += dt * 0.3;
      c.dropT -= dt;
      if (c.dropT <= 0) {
        c.dropT = 0.05;
        for (let k = 0; k < 2; k++) {
          _a.set(c.grp.position.x + rand(-2.4, 2.4), c.grp.position.y - 0.8, c.grp.position.z + rand(-1.8, 1.8));
          if (c.cosmetic) this.fireCosmetic(c.team, 'flick', _a, _v.set(0, -14, 0), 0.08, 1, 0);
          else this.fire(c.owner, 'flick', _a, _v.set(0, -14, 0), { dmg: 9, splat: 0.55, grav: 1, size: 0.08 });
        }
      }
      const k = clamp(c.t / 0.6, 0, 1) * clamp((7 - c.t) / 0.4, 0, 1);
      for (const m of c.mats) m.opacity = 0.85 * k;
      if (c.t <= 0) { this.disposeMesh(c.grp); this.clouds.splice(i, 1); }
    }
    this.silent = false;
  }

  updateDomes(dt) {
    for (let i = this.domes.length - 1; i >= 0; i--) {
      const d = this.domes[i];
      d.t -= dt;
      const grow = Math.min(1, (6.5 - d.t) / 0.35);
      d.mesh.scale.setScalar(d.r * grow * (1 + Math.sin(d.t * 6) * 0.01));
      d.mesh.material.opacity = 0.22 * Math.min(1, d.t / 0.5);
      // allies inside regain ink (each machine refills its own player)
      for (const f of this.world.fighters) if (f.team === d.team && f.alive && !f.puppet && f.pos.distanceTo(d.pos) < d.r) f.ink = Math.min(1, f.ink + 0.3 * dt);
      if (d.t <= 0 || d.hp <= 0) {
        this.world.fx.splash(d.pos, _up, this.color(d.team), 24, 6, 0.1, 1.5);
        this.world.audio?.sfx('shield_break', posOf(d.pos));
        this.disposeMesh(d.mesh);
        this.domes.splice(i, 1);
      }
    }
  }

  disposeMesh(m) {
    this.world.scene.remove(m);
    m.traverse((o) => {
      if (o.material && o.material !== OUTLINE_MAT && !o.material.userData?.shared) o.material.dispose?.();
      if (o.geometry?.userData?.own) o.geometry.dispose();
    });
  }

  clear() {
    for (const p of this.proj) p.alive = false;
    for (const b of this.bombs) this.world.scene.remove(b.mesh);
    for (const s of this.sprinklers) this.world.scene.remove(s.mesh);
    for (const c of this.clouds) this.world.scene.remove(c.grp);
    for (const d of this.domes) this.world.scene.remove(d.mesh);
    for (const b of this.bursts) this.world.scene.remove(b.mesh);
    this.bombs = []; this.sprinklers = []; this.clouds = []; this.domes = []; this.bursts = []; this.pending = [];
  }

  dispose() {
    this.clear();
    this.world.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    for (const b of this.beams) this.world.scene.remove(b.mesh);
  }
}

export function posOf(v) { return { x: v.x, y: v.y, z: v.z }; }
export function v3a(v) { return [Math.round(v.x * 1000) / 1000, Math.round(v.y * 1000) / 1000, Math.round(v.z * 1000) / 1000]; }
