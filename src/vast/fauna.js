// Wildlife: deer and rabbits that graze and bolt, bird flocks riding the
// sky, butterflies by day, fireflies by night. Nothing here is saved — the
// world just always has animals somewhere near you.

import * as THREE from 'three';
import { clamp } from './noise.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

function part(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildDeer() {
  const g = new THREE.Group();
  const body = part(new THREE.BoxGeometry(1.15, 0.55, 0.42), 0x8a6a4a, 0, 0.85, 0);
  g.add(body);
  const neck = part(new THREE.BoxGeometry(0.22, 0.5, 0.2), 0x8a6a4a, 0.52, 1.2, 0);
  neck.rotation.z = -0.5;
  g.add(neck);
  const head = part(new THREE.BoxGeometry(0.34, 0.22, 0.2), 0x937452, 0.72, 1.42, 0);
  g.add(head);
  head.add(part(new THREE.BoxGeometry(0.05, 0.3, 0.05), 0x5d4630, 0.02, 0.24, 0.07));
  head.add(part(new THREE.BoxGeometry(0.05, 0.3, 0.05), 0x5d4630, 0.02, 0.24, -0.07));
  const tail = part(new THREE.BoxGeometry(0.12, 0.16, 0.12), 0xd8cfc0, -0.6, 0.95, 0);
  g.add(tail);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const leg = part(new THREE.BoxGeometry(0.11, 0.75, 0.11), 0x7a5c40, i < 2 ? 0.42 : -0.42, 0.38, i % 2 ? 0.15 : -0.15);
    legs.push(leg);
    g.add(leg);
  }
  return { g, legs, head };
}

function buildRabbit() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.34, 0.22, 0.2), 0x9a8a72, 0, 0.16, 0));
  const head = part(new THREE.BoxGeometry(0.16, 0.15, 0.15), 0xa6987e, 0.2, 0.28, 0);
  g.add(head);
  head.add(part(new THREE.BoxGeometry(0.04, 0.18, 0.05), 0x9a8a72, 0.0, 0.14, 0.04));
  head.add(part(new THREE.BoxGeometry(0.04, 0.18, 0.05), 0x9a8a72, 0.0, 0.14, -0.04));
  g.add(part(new THREE.BoxGeometry(0.09, 0.09, 0.09), 0xe8e0d2, -0.2, 0.18, 0));
  return { g, legs: [], head };
}

function buildBird() {
  const g = new THREE.Group();
  const mat = lam(0x3a3f4a);
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wingGeo = new THREE.BoxGeometry(0.7, 0.02, 0.22);
  const wl = new THREE.Mesh(wingGeo, mat); wl.position.x = -0.35; g.add(wl);
  const wr = new THREE.Mesh(wingGeo, mat); wr.position.x = 0.35; g.add(wr);
  return { g, wl, wr };
}

const DEER_BIOMES = new Set(['plains', 'meadow', 'forest', 'deepforest', 'steppe', 'savanna', 'tundra']);
const RABBIT_BIOMES = new Set(['plains', 'meadow', 'steppe', 'beach']);

export class Fauna {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.deer = [];
    this.rabbits = [];
    this.flocks = [];
    this.time = 0;
    this.spawnTimer = 0;

    for (let f = 0; f < 3; f++) {
      const birds = [];
      const group = new THREE.Group();
      const n = 5 + (Math.random() * 4 | 0);
      for (let i = 0; i < n; i++) {
        const b = buildBird();
        group.add(b.g);
        birds.push({ ...b, phase: Math.random() * Math.PI * 2, r: 6 + Math.random() * 10 });
      }
      scene.add(group);
      this.flocks.push({ group, birds, cx: 0, cz: 0, h: 40 + Math.random() * 30, a: Math.random() * Math.PI * 2, drift: Math.random() * Math.PI * 2 });
    }

    // fireflies
    const N = 70;
    this.ffData = [];
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.ffData.push({ ox: (Math.random() - 0.5) * 56, oz: (Math.random() - 0.5) * 56, ph: Math.random() * 10 });
    this.ffGeo = new THREE.BufferGeometry();
    this.ffGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.ffMat = new THREE.PointsMaterial({ color: 0xd8ff7a, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.fireflies = new THREE.Points(this.ffGeo, this.ffMat);
    this.fireflies.frustumCulled = false;
    scene.add(this.fireflies);

    // butterflies
    this.bfData = [];
    this.bfGroup = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.12),
        new THREE.MeshBasicMaterial({ color: [0xffdd66, 0xff9a66, 0xd8a2ff, 0xffffff][i % 4], side: THREE.DoubleSide })
      );
      this.bfGroup.add(m);
      this.bfData.push({ ox: (Math.random() - 0.5) * 44, oz: (Math.random() - 0.5) * 44, ph: Math.random() * 10, mesh: m });
    }
    scene.add(this.bfGroup);
  }

  _spawnAnimal(list, build, biomes, px, pz, speedBase) {
    const a = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 120;
    const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    const h = this.world.heightAt(x, z);
    if (h < 1 || this.world.slopeAt(x, z) > 0.5) return;
    if (!biomes.has(this.world.biomeAt(x, z, h))) return;
    const m = build();
    m.g.position.set(x, h, z);
    this.scene.add(m.g);
    list.push({
      ...m, x, z, heading: Math.random() * Math.PI * 2,
      state: 'graze', speed: 0, stateT: 2 + Math.random() * 4, speedBase,
      hop: 0,
    });
  }

  _animalUpdate(an, dt, px, pz, fleeDist, isRabbit) {
    const dPlayer = Math.hypot(an.x - px, an.z - pz);
    an.stateT -= dt;
    if (dPlayer < fleeDist) {
      an.state = 'flee';
      an.stateT = 2.5;
      an.heading = Math.atan2(an.x - px, an.z - pz) + (Math.random() - 0.5) * 0.4;
    } else if (an.stateT <= 0) {
      an.state = an.state === 'graze' && Math.random() < 0.6 ? 'wander' : 'graze';
      an.stateT = 2 + Math.random() * 5;
      an.heading += (Math.random() - 0.5) * 2;
    }
    const targetSpeed = an.state === 'flee' ? an.speedBase * 4.5 : an.state === 'wander' ? an.speedBase : 0;
    an.speed += (targetSpeed - an.speed) * Math.min(1, dt * 4);
    if (an.speed > 0.05) {
      const nx = an.x + Math.sin(an.heading) * an.speed * dt;
      const nz = an.z + Math.cos(an.heading) * an.speed * dt;
      const nh = this.world.heightAt(nx, nz);
      if (nh > 0.6 && this.world.slopeAt(nx, nz) < 0.8) {
        an.x = nx; an.z = nz;
      } else {
        an.heading += 1.8 * dt + 0.4; // bounce off water/cliffs
      }
      an.g.rotation.y = an.heading - Math.PI / 2;
    }
    let y = this.world.heightAt(an.x, an.z);
    if (isRabbit && an.speed > 0.1) {
      an.hop += dt * (4 + an.speed);
      y += Math.abs(Math.sin(an.hop * 3)) * 0.22;
    }
    an.g.position.set(an.x, y, an.z);
    // leg swing
    const swing = Math.sin(this.time * (6 + an.speed * 1.6)) * clamp(an.speed, 0, 1.2) * 0.6;
    for (let i = 0; i < an.legs.length; i++) an.legs[i].rotation.x = i % 2 ? swing : -swing;
    if (an.head && an.state === 'graze' && an.legs.length) {
      an.head.position.y = 1.42 - (Math.sin(this.time * 0.7 + an.hop) > 0.3 ? 0.5 : 0);
    }
    return dPlayer;
  }

  update(dt, px, pz, isNight, camY) {
    this.time += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.8;
      if (this.deer.length < 7) this._spawnAnimal(this.deer, buildDeer, DEER_BIOMES, px, pz, 1.4);
      if (this.rabbits.length < 5) this._spawnAnimal(this.rabbits, buildRabbit, RABBIT_BIOMES, px, pz, 1.1);
    }

    const cull = (list) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const d = this._animalUpdate(list[i], dt, px, pz, list === this.deer ? 20 : 11, list === this.rabbits);
        if (d > 300) {
          this.scene.remove(list[i].g);
          list[i].g.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) o.material.dispose();
          });
          list.splice(i, 1);
        }
      }
    };
    cull(this.deer);
    cull(this.rabbits);

    // bird flocks
    for (const f of this.flocks) {
      f.drift += dt * 0.05;
      f.cx += Math.cos(f.drift) * dt * 3;
      f.cz += Math.sin(f.drift) * dt * 3;
      if (Math.hypot(f.cx - px, f.cz - pz) > 320) {
        f.cx = px + (Math.random() - 0.5) * 300;
        f.cz = pz + (Math.random() - 0.5) * 300;
      }
      f.a += dt * 0.25;
      const baseY = Math.max(this.world.heightAt(f.cx, f.cz), 0) + f.h;
      for (const b of f.birds) {
        const a = f.a + b.phase;
        b.g.position.set(f.cx + Math.cos(a) * b.r, baseY + Math.sin(a * 2 + b.phase) * 3, f.cz + Math.sin(a) * b.r);
        b.g.rotation.y = -a;
        const flap = Math.sin(this.time * 7 + b.phase) * 0.7;
        b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
      }
    }

    // fireflies at night, hugging the ground near the player
    const ffTarget = isNight ? 0.85 : 0;
    this.ffMat.opacity += (ffTarget - this.ffMat.opacity) * Math.min(1, dt * 1.5);
    if (this.ffMat.opacity > 0.02) {
      const pos = this.ffGeo.attributes.position;
      this._ffTick = (this._ffTick || 0) + 1;
      for (let i = 0; i < this.ffData.length; i++) {
        const d = this.ffData[i];
        const x = px + d.ox + Math.sin(this.time * 0.4 + d.ph) * 4;
        const z = pz + d.oz + Math.cos(this.time * 0.33 + d.ph * 1.3) * 4;
        // terrain sampling staggered — each firefly re-grounds every 3rd frame
        if (d.gy === undefined || i % 3 === this._ffTick % 3) d.gy = this.world.heightAt(x, z);
        pos.setXYZ(i, x, Math.max(d.gy, 0) + 0.7 + Math.sin(this.time * 0.9 + d.ph * 2) * 0.8, z);
      }
      pos.needsUpdate = true;
      this.fireflies.visible = true;
    } else this.fireflies.visible = false;

    // butterflies by day
    const showBf = !isNight;
    this.bfGroup.visible = showBf;
    if (showBf) {
      for (const b of this.bfData) {
        const x = px + b.ox + Math.sin(this.time * 0.5 + b.ph) * 3;
        const z = pz + b.oz + Math.cos(this.time * 0.42 + b.ph) * 3;
        const gy = this.world.heightAt(x, z);
        if (gy < 0.3) { b.mesh.visible = false; continue; } // not over open water
        b.mesh.visible = true;
        b.mesh.position.set(x, gy + 0.8 + Math.sin(this.time * 1.3 + b.ph) * 0.4, z);
        b.mesh.rotation.y = this.time * 0.8 + b.ph;
        b.mesh.rotation.z = Math.sin(this.time * 14 + b.ph) * 0.9;
      }
    }
  }
}
