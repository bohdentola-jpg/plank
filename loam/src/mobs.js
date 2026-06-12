// Company: sheep and pigs graze the daylight, zombies own the dark. Box-built
// bodies, leg-swing walk cycles, wander/chase/flee brains, world-lit tints.
// Zombies burn off at sunrise; dinner drops where the animals fall.
import * as THREE from 'three';
import { I, B } from './blocks.js';
import { SOLID, FLUID, WORLD_H } from './world.js';

const GRAV = 28;

function facecan(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FACES = {
  zombie: () => facecan((g) => {
    g.fillStyle = '#4a7d3a'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#2c2c30'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
    g.fillStyle = '#1a1a1e'; g.fillRect(3, 5, 2, 2);
  }),
  sheep: () => facecan((g) => {
    g.fillStyle = '#d8c8b4'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#1a1a1e'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
    g.fillStyle = '#b89884'; g.fillRect(2, 6, 4, 2);
  }),
  pig: () => facecan((g) => {
    g.fillStyle = '#f0a0a8'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#1a1a1e'; g.fillRect(1, 2, 2, 1); g.fillRect(5, 2, 2, 1);
    g.fillStyle = '#e07880'; g.fillRect(2, 4, 4, 3);
    g.fillStyle = '#5e3038'; g.fillRect(3, 5, 1, 1); g.fillRect(5, 5, 1, 1);
  }),
};

function part(group, w, h, d, color, shade, x, y, z, faceTex = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  let mat;
  if (faceTex) {
    const side = new THREE.MeshBasicMaterial({ color });
    mat = [side, side.clone(), side.clone(), side.clone(), side.clone(), new THREE.MeshBasicMaterial({ color: '#ffffff', map: faceTex })];
  } else mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  const mats = Array.isArray(mat) ? mat : [mat];
  for (const m of mats) m.userData = { base: m.color.clone(), shade };
  return mesh;
}

const SPECIES = {
  zombie: {
    hp: 20, w: 0.3, h: 1.9, speed: 2.4, hostile: true,
    drops: () => [],
    build(g) {
      const skin = '#5b9447', shirt = '#3a6e8f', pants = '#35506b';
      part(g, 0.5, 0.5, 0.5, skin, 1, 0, 1.7, 0, FACES.zombie()).name = 'head';
      part(g, 0.5, 0.7, 0.26, shirt, 0.9, 0, 1.1, 0);
      const al = part(g, 0.22, 0.7, 0.22, skin, 0.8, -0.37, 1.38, 0); al.name = 'armL';
      const ar = part(g, 0.22, 0.7, 0.22, skin, 0.8, 0.37, 1.38, 0); ar.name = 'armR';
      al.geometry.translate(0, -0.28, 0); ar.geometry.translate(0, -0.28, 0);
      const ll = part(g, 0.22, 0.78, 0.22, pants, 0.7, -0.12, 0.78, 0); ll.name = 'legL';
      const lr = part(g, 0.22, 0.78, 0.22, pants, 0.7, 0.12, 0.78, 0); lr.name = 'legR';
      ll.geometry.translate(0, -0.39, 0); lr.geometry.translate(0, -0.39, 0);
    },
  },
  sheep: {
    hp: 8, w: 0.42, h: 1.2, speed: 1.0, hostile: false,
    drops: (r) => [[B.wool, 1 + (r() < 0.5 ? 1 : 0)], [I.mutton, 1]],
    build(g) {
      part(g, 0.85, 0.75, 1.25, '#ece9e2', 1, 0, 0.95, 0);
      part(g, 0.45, 0.45, 0.45, '#ece9e2', 0.95, 0, 1.35, -0.72, FACES.sheep());
      for (const [sx, sz, nm] of [[-0.26, -0.4, 'legL'], [0.26, -0.4, 'legR'], [-0.26, 0.4, 'legL2'], [0.26, 0.4, 'legR2']]) {
        const l = part(g, 0.22, 0.6, 0.22, '#d8c8b4', 0.75, sx, 0.55, sz);
        l.name = nm; l.geometry.translate(0, -0.25, 0);
      }
    },
  },
  pig: {
    hp: 10, w: 0.42, h: 0.95, speed: 1.1, hostile: false,
    drops: (r) => [[I.porkchop, 1 + (r() < 0.5 ? 1 : 0)]],
    build(g) {
      part(g, 0.8, 0.65, 1.2, '#f0a0a8', 1, 0, 0.7, 0);
      part(g, 0.5, 0.5, 0.5, '#f0a0a8', 0.95, 0, 0.85, -0.75, FACES.pig());
      for (const [sx, sz, nm] of [[-0.24, -0.38, 'legL'], [0.24, -0.38, 'legR'], [-0.24, 0.38, 'legL2'], [0.24, 0.38, 'legR2']]) {
        const l = part(g, 0.2, 0.4, 0.2, '#dd8890', 0.75, sx, 0.38, sz);
        l.name = nm; l.geometry.translate(0, -0.18, 0);
      }
    },
  },
};

export class Mobs {
  constructor(world, scene, mode) {
    this.world = world; this.scene = scene; this.mode = mode;
    this.list = [];
    this._spawnT = 0;
    this.onSound = null; // (name, x, y, z)
    this.onDrop = null;  // (id, n, x, y, z)
    this.onPuff = null;  // (x, y, z, rgb)
  }

  count(hostile) { return this.list.filter((m) => m.spec.hostile === hostile).length; }

  spawn(type, x, y, z) {
    const spec = SPECIES[type];
    const root = new THREE.Group();
    spec.build(root);
    root.position.set(x, y, z);
    this.scene.add(root);
    const mob = {
      type, spec, root,
      x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28,
      hp: spec.hp, onGround: false,
      state: 'wander', stateT: Math.random() * 3, moving: false,
      phase: 0, flashT: 0, burnT: 0, attackT: 0, soundT: 4 + Math.random() * 10,
      parts: {},
    };
    root.traverse((o) => { if (o.name) mob.parts[o.name] = o; });
    if (mob.parts.armL) { mob.parts.armL.rotation.x = -1.35; mob.parts.armR.rotation.x = -1.35; }
    this.list.push(mob);
    return mob;
  }

  // ------------------------------------------------------------ brains
  update(dt, player, dayFactor) {
    this._spawnT -= dt;
    if (this._spawnT <= 0) { this._spawnT = 1.6; this._trySpawns(player, dayFactor); }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      const distP = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
      if (distP > 60) { this._remove(i); continue; }

      m.stateT -= dt;
      if (m.state === 'flee' && m.stateT <= 0) m.state = 'wander';
      if (m.state === 'wander' && m.stateT <= 0) {
        m.stateT = 1.5 + Math.random() * 3.5;
        m.moving = Math.random() < 0.55;
        m.yaw = Math.random() * Math.PI * 2;
      }

      let speed = 0;
      if (m.spec.hostile && this.mode === 'survival' && !player.dead && distP < 22) {
        m.state = 'chase';
        m.yaw = Math.atan2(player.pos.x - m.x, player.pos.z - m.z);
        speed = m.spec.speed;
        m.attackT -= dt;
        const dy = Math.abs(player.pos.y - m.y);
        if (distP < 1.45 && dy < 2 && m.attackT <= 0) {
          m.attackT = 1.1;
          const kx = (player.pos.x - m.x) / Math.max(distP, 0.1) * 7;
          const kz = (player.pos.z - m.z) / Math.max(distP, 0.1) * 7;
          player.damage(3, 'hit', { x: kx, z: kz });
          this.onSound?.('zombieBite', m.x, m.y, m.z);
        }
      } else if (m.state === 'chase') { m.state = 'wander'; m.stateT = 0; }
      if (m.state === 'flee') speed = m.spec.speed * 2.6;
      else if (m.state === 'wander' && m.moving) speed = m.spec.speed * 0.8;

      // sunrise sets zombies alight
      if (m.spec.hostile && dayFactor > 0.55) {
        const sky = (this.world.lightAt(Math.floor(m.x), Math.floor(m.y + m.spec.h), Math.floor(m.z)) >> 4) & 15;
        if (sky >= 13) {
          m.burnT += dt;
          if (m.burnT > 0.8) { m.burnT = 0; m.hp -= 4; m.flashT = 0.4; if (m.hp <= 0) { this._die(i, false); continue; } }
        }
      }

      this._physics(m, dt, speed);
      this._animate(m, dt, speed);

      m.soundT -= dt;
      if (m.soundT <= 0 && distP < 24) {
        m.soundT = 7 + Math.random() * 12;
        this.onSound?.(m.type, m.x, m.y, m.z);
      }

      // tint by world light (and red when hurt, ember when burning)
      m.flashT = Math.max(0, m.flashT - dt);
      const l = this.world.lightAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z));
      const f = Math.max(0.18, Math.max(((l >> 4) & 15) * dayFactor, l & 15) / 15);
      m.root.traverse((o) => {
        if (!o.isMesh) return;
        for (const mt of Array.isArray(o.material) ? o.material : [o.material]) {
          const u = mt.userData;
          if (!u?.base) continue;
          mt.color.copy(u.base).multiplyScalar(u.shade * f * f); // f² ≈ undo sRGB encode

          if (m.flashT > 0) { mt.color.r = Math.min(1, mt.color.r + 0.5); mt.color.g *= 0.45; mt.color.b *= 0.45; }
          if (m.burnT > 0.3) { mt.color.r = Math.min(1, mt.color.r + 0.4); mt.color.g = Math.min(1, mt.color.g + 0.15); }
        }
      });
    }
  }

  _physics(m, dt, speed) {
    const w = this.world;
    const inFluid = FLUID[w.block(Math.floor(m.x), Math.floor(m.y + 0.3), Math.floor(m.z))];
    m.vx += (Math.sin(m.yaw) * speed - m.vx) * Math.min(1, 8 * dt);
    m.vz += (Math.cos(m.yaw) * speed - m.vz) * Math.min(1, 8 * dt);
    if (inFluid) { m.vy += 20 * dt; m.vy *= 1 - 2.5 * dt; }
    else m.vy -= GRAV * dt;
    m.vy = Math.max(m.vy, -40);

    const half = m.spec.w, h = m.spec.h;
    const tryMove = (axis, d) => {
      const np = { x: m.x, y: m.y, z: m.z };
      np[axis] += d;
      const x0 = Math.floor(np.x - half), x1 = Math.floor(np.x + half);
      const y0 = Math.floor(np.y), y1 = Math.floor(np.y + h);
      const z0 = Math.floor(np.z - half), z1 = Math.floor(np.z + half);
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          for (let x = x0; x <= x1; x++) {
            if (SOLID[w.block(x, y, z)]) return false;
          }
        }
      }
      m[axis] = np[axis];
      return true;
    };

    const blockedX = !tryMove('x', m.vx * dt);
    const blockedZ = !tryMove('z', m.vz * dt);
    if ((blockedX || blockedZ) && (m.onGround || inFluid) && speed > 0) m.vy = inFluid ? 4 : 8.2; // hop the step
    m.onGround = false;
    if (!tryMove('y', m.vy * dt)) {
      if (m.vy < 0) { m.onGround = true; m.y = Math.floor(m.y) + 0.001; }
      m.vy = 0;
    }
    if (m.y < -10) m.hp = 0;
  }

  _animate(m, dt, speed) {
    m.root.position.set(m.x, m.y, m.z);
    m.root.rotation.y = m.yaw;
    const moving = Math.hypot(m.vx, m.vz) > 0.3;
    m.phase += dt * (moving ? Math.hypot(m.vx, m.vz) * 3.2 : 0);
    const a = Math.sin(m.phase) * (moving ? 0.65 : 0);
    const p = m.parts;
    if (p.legL) p.legL.rotation.x = a;
    if (p.legR) p.legR.rotation.x = -a;
    if (p.legL2) p.legL2.rotation.x = -a;
    if (p.legR2) p.legR2.rotation.x = a;
    if (p.armL && m.type === 'zombie') {
      p.armL.rotation.x = -1.35 + Math.sin(m.phase) * 0.12;
      p.armR.rotation.x = -1.35 - Math.sin(m.phase) * 0.12;
    }
    if (p.head && m.type !== 'zombie') p.head.rotation.x = moving ? 0 : Math.sin(m.phase * 0.2) * 0.08;
  }

  // ------------------------------------------------------------ spawning
  _trySpawns(player, dayFactor) {
    const night = dayFactor < 0.35;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 22;
      const x = Math.floor(player.pos.x + Math.sin(ang) * r);
      const z = Math.floor(player.pos.z + Math.cos(ang) * r);
      if (!this.world.chunkAt(Math.floor(x / 16), Math.floor(z / 16))) continue;
      const y = this.world.surfaceY(x, z);
      if (y >= WORLD_H - 4) continue;
      const ground = this.world.block(x, y, z);
      const above = this.world.block(x, y + 1, z);
      if (above !== B.air || FLUID[ground]) continue;
      const l = this.world.lightAt(x, y + 1, z);
      const bright = Math.max(((l >> 4) & 15) * dayFactor, l & 15);

      if (night && this.mode === 'survival' && bright < 5 && this.count(true) < 10) {
        this.spawn('zombie', x + 0.5, y + 1, z + 0.5);
      } else if (!night && bright > 8 && ground === B.grass && this.count(false) < 10 && Math.random() < 0.5) {
        this.spawn(Math.random() < 0.5 ? 'sheep' : 'pig', x + 0.5, y + 1, z + 0.5);
      }
    }
  }

  seedAround(x, z, n = 7) { // a welcoming committee near spawn
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, r = 6 + Math.random() * 18;
      const bx = Math.floor(x + Math.sin(ang) * r), bz = Math.floor(z + Math.cos(ang) * r);
      if (!this.world.chunkAt(Math.floor(bx / 16), Math.floor(bz / 16))) continue;
      const y = this.world.surfaceY(bx, bz);
      if (this.world.block(bx, y, bz) === B.grass) {
        this.spawn(Math.random() < 0.55 ? 'sheep' : 'pig', bx + 0.5, y + 1, bz + 0.5);
      }
    }
  }

  // ------------------------------------------------------------ combat
  hit(mob, dmg, from) {
    mob.hp -= dmg;
    mob.flashT = 0.35;
    const d = Math.max(Math.hypot(mob.x - from.x, mob.z - from.z), 0.2);
    mob.vx += (mob.x - from.x) / d * 6.5;
    mob.vz += (mob.z - from.z) / d * 6.5;
    mob.vy = Math.max(mob.vy, 5);
    if (!mob.spec.hostile) { mob.state = 'flee'; mob.stateT = 4; mob.yaw = Math.atan2(mob.x - from.x, mob.z - from.z); }
    this.onSound?.(mob.type + 'Hurt', mob.x, mob.y, mob.z);
    if (mob.hp <= 0) this._die(this.list.indexOf(mob), true);
  }

  _die(i, withDrops) {
    const m = this.list[i];
    if (withDrops) {
      for (const [id, n] of m.spec.drops(Math.random)) this.onDrop?.(id, n, m.x, m.y + 0.6, m.z);
    }
    this.onPuff?.(m.x, m.y + 0.8, m.z, m.spec.hostile ? [0.4, 0.5, 0.35] : [0.8, 0.78, 0.72]);
    this._remove(i);
  }

  _remove(i) {
    const m = this.list[i];
    this.scene.remove(m.root);
    m.root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const mt of Array.isArray(o.material) ? o.material : [o.material]) mt.dispose();
    });
    this.list.splice(i, 1);
  }

  clear() { while (this.list.length) this._remove(this.list.length - 1); }

  // first mob the eye-ray touches (slab test per AABB)
  raycast(origin, dir, maxDist = 3.4) {
    let best = null, bestT = maxDist;
    for (const m of this.list) {
      const half = m.spec.w + 0.1;
      const lo = [m.x - half, m.y, m.z - half], hi = [m.x + half, m.y + m.spec.h, m.z + half];
      const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = bestT, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) ok = false; continue; }
        let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && t0 < bestT) { best = m; bestT = t0; }
    }
    return best ? { mob: best, dist: bestT } : null;
  }
}
