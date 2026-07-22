// The container yard: geometry, colliders (with penetration materials),
// navigation grid for bots, spawn zones, and the raycast used by every
// bullet. Containers are hollow shells of thin metal panels, so rifles can
// wallbang through them; crates are soft wood; concrete stops everything.
import * as THREE from './three.js';
import { G } from './state.js';
import { rayAABB, mulberry32 } from './util.js';

export const MATERIALS = {
  metal:    { penCost: 48, dmgMult: 0.72, name: 'metal' },
  wood:     { penCost: 26, dmgMult: 0.80, name: 'wood' },
  concrete: { penCost: 9999, dmgMult: 0, name: 'concrete' },
  ground:   { penCost: 9999, dmgMult: 0, name: 'ground' },
};

const CONT = { L: 6, W: 2.4, H: 2.6, T: 0.06 }; // container dims + wall thickness
const COLORS = [0xa63a2e, 0x2e6ba6, 0x3f7a3a, 0xc47f2e, 0x77584a, 0x4a6670, 0x8a8578];

export class World {
  constructor() {
    this.colliders = [];   // {min,max,material,climbable}
    this.group = new THREE.Group();
    this.spawns = { CT: [], T: [] };
    this.spawnCenter = { CT: new THREE.Vector3(0, 0, -40), T: new THREE.Vector3(0, 0, 40) };
    this.bounds = { minX: -36, maxX: 36, minZ: -46, maxZ: 46 };
    this.nav = null;
    this._texCache = new Map();
  }

  build() {
    this._lights();
    this._sky();
    this._ground();
    this._perimeter();
    this._layout();
    this._buildNav();
    for (const team of ['CT', 'T']) {
      const c = this.spawnCenter[team];
      for (let i = 0; i < 5; i++) {
        this.spawns[team].push(new THREE.Vector3(c.x - 8 + i * 4, 0, c.z + (i % 2 ? 2 : -2)));
      }
    }
    G.scene.add(this.group);
    return this;
  }

  // ---------------------------------------------------------------- visuals
  _lights() {
    const hemi = new THREE.HemisphereLight(0xcfd8e8, 0x5a5648, 0.85);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
    sun.position.set(35, 55, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 60;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0004;
    this.group.add(sun);
    this.sun = sun;
  }

  _sky() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5e7ea8'); g.addColorStop(0.55, '#9db4c8'); g.addColorStop(0.8, '#d8d2bd'); g.addColorStop(1, '#e2d8bd');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 16, 12),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
    this.group.add(sky);
    G.scene.fog = new THREE.Fog(0xc3c3b4, 70, 320);
  }

  _canvasTex(key, w, h, draw) {
    if (this._texCache.has(key)) return this._texCache.get(key);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache.set(key, tex);
    return tex;
  }

  _ground() {
    const tex = this._canvasTex('asphalt', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#5d5c58'; ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(7);
      for (let i = 0; i < 9000; i++) {
        const g = 70 + rng() * 40;
        ctx.fillStyle = `rgba(${g},${g},${g * 0.97},0.25)`;
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
      }
      ctx.strokeStyle = 'rgba(30,30,30,0.5)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        let x = rng() * w, y = rng() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 6; j++) { x += (rng() - 0.5) * 90; y += (rng() - 0.5) * 90; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(200,180,60,0.55)';
      ctx.fillRect(0, h / 2 - 3, w, 6);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9, 12);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 170),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.colliders.push({ min: { x: -80, y: -1, z: -90 }, max: { x: 80, y: 0, z: 90 }, material: MATERIALS.ground });
  }

  _concreteMat() {
    if (this._concMat) return this._concMat;
    const tex = this._canvasTex('concrete', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8d8a80'; ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(13);
      for (let i = 0; i < 2500; i++) {
        const g = 120 + rng() * 50;
        ctx.fillStyle = `rgba(${g},${g},${g * 0.95},0.3)`;
        ctx.fillRect(rng() * w, rng() * h, 2, 2);
      }
      ctx.strokeStyle = 'rgba(60,60,55,0.4)';
      ctx.strokeRect(0, 0, w, h);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this._concMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    return this._concMat;
  }

  _perimeter() {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const h = 7, t = 0.6;
    const mat = this._concreteMat();
    const walls = [
      [minX - t / 2, (minZ + maxZ) / 2, t, maxZ - minZ + 2 * t],
      [maxX + t / 2, (minZ + maxZ) / 2, t, maxZ - minZ + 2 * t],
      [(minX + maxX) / 2, minZ - t / 2, maxX - minX, t],
      [(minX + maxX) / 2, maxZ + t / 2, maxX - minX, t],
    ];
    for (const [x, z, sx, sz] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      this.colliders.push({
        min: { x: x - sx / 2, y: 0, z: z - sz / 2 },
        max: { x: x + sx / 2, y: h, z: z + sz / 2 },
        material: MATERIALS.concrete,
      });
    }
  }

  _containerMats(color) {
    const key = 'cont' + color;
    if (this._texCache.has(key)) return this._texCache.get(key);
    const hex = '#' + color.toString(16).padStart(6, '0');
    const side = this._canvasTex(key + 's', 512, 256, (ctx, w, h) => {
      ctx.fillStyle = hex; ctx.fillRect(0, 0, w, h);
      // corrugation ribs
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, 0, 4, h);
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x + 10, 0, 3, h);
      }
      const rng = mulberry32(color);
      for (let i = 0; i < 26; i++) { // rust and grime
        ctx.fillStyle = `rgba(${90 + rng() * 60},${45 + rng() * 25},20,${0.12 + rng() * 0.2})`;
        const rw = 8 + rng() * 60;
        ctx.beginPath();
        ctx.ellipse(rng() * w, rng() * h, rw, rw * (0.3 + rng() * 0.5), rng(), 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('CSU ' + String(2000 + (color % 7919)).slice(0, 4) + '-' + String(color % 97).padStart(2, '0'), 22, 40);
    });
    const door = this._canvasTex(key + 'd', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = hex; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(w / 2 - 2, 0, 4, h);
      for (const dx of [w * 0.2, w * 0.35, w * 0.65, w * 0.8]) { // lock rods
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(dx - 3, 8, 6, h - 16);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(dx - 1, 8, 2, h - 16);
        ctx.fillStyle = '#333'; ctx.fillRect(dx - 6, h * 0.45, 12, 18);
      }
      for (let y = 0; y < h; y += 20) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, y, w, 5); }
    });
    const mats = {
      side: new THREE.MeshStandardMaterial({ map: side, roughness: 0.72, metalness: 0.35 }),
      door: new THREE.MeshStandardMaterial({ map: door, roughness: 0.72, metalness: 0.35 }),
    };
    this._texCache.set(key, mats);
    return mats;
  }

  // Hollow container. axis: 'z' (long side along z) or 'x'. doors: 0 none open,
  // 1 far end open, 2 both ends open (walk-through). level: 0 ground, 1 stacked.
  addContainer(x, z, axis, color, { doors = 0, level = 0 } = {}) {
    const { L, W, H, T } = CONT;
    const y0 = level * H;
    const mats = this._containerMats(color);
    const lenX = axis === 'x' ? L : W;
    const lenZ = axis === 'x' ? W : L;
    const grp = new THREE.Group();
    grp.position.set(x, y0, z);
    const mkPanel = (sx, sy, sz, px, py, pz, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(px, py, pz);
      m.castShadow = m.receiveShadow = true;
      grp.add(m);
      this.colliders.push({
        min: { x: x + px - sx / 2, y: y0 + py - sy / 2, z: z + pz - sz / 2 },
        max: { x: x + px + sx / 2, y: y0 + py + sy / 2, z: z + pz + sz / 2 },
        material: MATERIALS.metal, climbable: true,
      });
    };
    // roof + floor slab
    mkPanel(lenX, T, lenZ, 0, H - T / 2, 0, mats.side);
    if (level > 0) mkPanel(lenX, T, lenZ, 0, T / 2, 0, mats.side);
    if (axis === 'z') {
      mkPanel(T, H, lenZ, -lenX / 2 + T / 2, H / 2, 0, mats.side);
      mkPanel(T, H, lenZ, lenX / 2 - T / 2, H / 2, 0, mats.side);
      if (doors < 2) mkPanel(lenX - 2 * T, H, T, 0, H / 2, -lenZ / 2 + T / 2, mats.door);
      if (doors < 1) mkPanel(lenX - 2 * T, H, T, 0, H / 2, lenZ / 2 - T / 2, mats.door);
    } else {
      mkPanel(lenX, H, T, 0, H / 2, -lenZ / 2 + T / 2, mats.side);
      mkPanel(lenX, H, T, 0, H / 2, lenZ / 2 - T / 2, mats.side);
      if (doors < 2) mkPanel(T, H, lenZ - 2 * T, -lenX / 2 + T / 2, H / 2, 0, mats.door);
      if (doors < 1) mkPanel(T, H, lenZ - 2 * T, lenX / 2 - T / 2, H / 2, 0, mats.door);
    }
    this.group.add(grp);
  }

  _crateMat() {
    if (this._crMat) return this._crMat;
    const tex = this._canvasTex('crate', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#9a7b4f'; ctx.fillRect(0, 0, w, h);
      const rng = mulberry32(31);
      for (let y = 0; y < h; y += 32) {
        ctx.fillStyle = `rgba(70,50,25,${0.25 + rng() * 0.15})`;
        ctx.fillRect(0, y, w, 3);
      }
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(60,40,20,${0.1 + rng() * 0.2})`;
        ctx.beginPath();
        const y = rng() * h;
        ctx.moveTo(0, y); ctx.bezierCurveTo(w / 3, y + 8 * rng(), w * 2 / 3, y - 8 * rng(), w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40,28,12,0.8)'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h);
      ctx.lineWidth = 5; ctx.stroke();
    });
    this._crMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    return this._crMat;
  }

  addCrate(x, z, size = 1.2, yBase = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this._crateMat());
    m.position.set(x, yBase + size / 2, z);
    m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    this.colliders.push({
      min: { x: x - size / 2, y: yBase, z: z - size / 2 },
      max: { x: x + size / 2, y: yBase + size, z: z + size / 2 },
      material: MATERIALS.wood, climbable: true,
    });
  }

  addBarrel(x, z) {
    const mat = new THREE.MeshStandardMaterial({ color: [0x35505e, 0x5e3535, 0x4a5a35][Math.floor((x * 7 + z * 13 + 1000) % 3)], roughness: 0.6, metalness: 0.5 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 14), mat);
    m.position.set(x, 0.55, z);
    m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    this.colliders.push({
      min: { x: x - 0.4, y: 0, z: z - 0.4 }, max: { x: x + 0.4, y: 1.1, z: z + 0.4 },
      material: MATERIALS.metal, climbable: true,
    });
  }

  _layout() {
    const C = COLORS;
    // --- mid corridor walls (containers along z on both sides, gap at mid) ---
    for (const sx of [-6.5, 6.5]) {
      for (const cz of [-21, -15, -9, 9, 15, 21]) {
        this.addContainer(sx, cz, 'z', C[(Math.abs(sx * cz) | 0) % C.length]);
        if (cz === -15 || cz === 15 || cz === -9) {
          this.addContainer(sx, cz, 'z', C[(Math.abs(sx * cz) | 0 + 3) % C.length], { level: 1 });
        }
      }
    }
    // mid crossing cover: walk-through container in the middle, plus two
    // staggered containers so no straight sightline runs spawn-to-spawn
    this.addContainer(0, 0, 'x', C[1], { doors: 2 });
    this.addContainer(-3.5, -5, 'x', C[4]);
    this.addContainer(3.5, 5, 'x', C[6]);
    this.addContainer(3.5, 5, 'x', C[2], { level: 1 });
    // --- A side (west) ---
    this.addContainer(-16, -6, 'z', C[2], { doors: 2 });          // A connector (walk-through)
    this.addContainer(-25, -20, 'x', C[0]);                        // A site back wall
    this.addContainer(-25, -20, 'x', C[3], { level: 1 });
    this.addContainer(-31, -14, 'z', C[4]);
    this.addContainer(-19, -26, 'z', C[5]);
    this.addContainer(-28, 4, 'x', C[6]);                          // A lane cover
    this.addContainer(-22, 14, 'z', C[2], { doors: 1 });
    this.addContainer(-30, 24, 'x', C[0]);
    this.addContainer(-16, 30, 'x', C[3]);
    // A site crates (stack up to container roof)
    this.addCrate(-22, -16, 1.2); this.addCrate(-22, -14.6, 1.2); this.addCrate(-23.4, -15.4, 1.2, 0); this.addCrate(-22.6, -15.2, 1.2, 1.25);
    this.addCrate(-28, -22, 1.0); this.addCrate(-13, -18, 1.2); this.addCrate(-13, -18, 1.2, 1.25);
    // --- B side (east) ---
    this.addContainer(16, 2, 'z', C[5], { doors: 2 });             // B connector
    this.addContainer(25, -20, 'x', C[1]);                         // B site
    this.addContainer(25, -20, 'x', C[6], { level: 1 });
    this.addContainer(31, -12, 'z', C[3]);
    this.addContainer(19, -28, 'z', C[0], { doors: 1 });
    this.addContainer(28, 8, 'x', C[2]);
    this.addContainer(22, 18, 'z', C[4]);
    this.addContainer(30, 28, 'x', C[1]);
    this.addCrate(21, -14, 1.2); this.addCrate(22.4, -14, 1.2); this.addCrate(21.7, -14, 1.2, 1.25);
    this.addCrate(28, -26, 1.0); this.addCrate(13, 10, 1.2);
    this.addBarrel(24, -6); this.addBarrel(24.9, -6.3); this.addBarrel(24.4, -5.2);
    // --- spawn cover ---
    this.addContainer(-8, -34, 'x', C[4]);
    this.addContainer(8, -34, 'x', C[2]);
    this.addContainer(-8, 34, 'x', C[6]);
    this.addContainer(8, 34, 'x', C[0]);
    this.addCrate(0, -30, 1.0); this.addCrate(1.2, -30, 1.0); this.addCrate(0, 30, 1.0); this.addCrate(-1.2, 30, 1.0);
    this.addBarrel(-3, -29); this.addBarrel(3, 29);
    // long sight-line breakers on outer lanes
    this.addCrate(-33, -2, 1.2); this.addCrate(-33, -0.8, 1.2); this.addCrate(-33, -1.4, 1.2, 1.25);
    this.addCrate(33, 14, 1.2); this.addCrate(33, 15.2, 1.2);
  }

  // ------------------------------------------------------------- collision
  // Move an entity AABB (radius r, height h) by vel*dt with axis separation
  // and step-up. Mutates pos; returns { grounded, hitWall }.
  moveEntity(pos, vel, dt, r, h, canStep = true) {
    let grounded = false, hitWall = false;
    const tryAxis = (axis, delta) => {
      if (delta === 0) return;
      pos[axis] += delta;
      const box = { minX: pos.x - r, maxX: pos.x + r, minY: pos.y, maxY: pos.y + h, minZ: pos.z - r, maxZ: pos.z + r };
      for (const c of this.colliders) {
        if (c.material === MATERIALS.ground) continue;
        if (box.maxX <= c.min.x || box.minX >= c.max.x || box.maxY <= c.min.y ||
            box.minY >= c.max.y || box.maxZ <= c.min.z || box.minZ >= c.max.z) continue;
        if (axis === 'y') {
          if (delta < 0) { pos.y = c.max.y; grounded = true; } else { pos.y = c.min.y - h; }
          vel.y = 0;
          return;
        }
        // horizontal hit: try stepping onto it
        const stepTop = c.max.y - pos.y;
        if (canStep && c.climbable !== false && stepTop > 0 && stepTop <= 0.55 && vel.y <= 0.01) {
          const liftBox = { ...box, minY: c.max.y + 0.01, maxY: c.max.y + 0.01 + h };
          let clear = true;
          for (const c2 of this.colliders) {
            if (c2.material === MATERIALS.ground) continue;
            if (liftBox.maxX <= c2.min.x || liftBox.minX >= c2.max.x || liftBox.maxY <= c2.min.y ||
                liftBox.minY >= c2.max.y || liftBox.maxZ <= c2.min.z || liftBox.minZ >= c2.max.z) continue;
            clear = false; break;
          }
          if (clear) { pos.y = c.max.y + 0.01; grounded = true; return; }
        }
        if (axis === 'x') { pos.x = delta > 0 ? c.min.x - r : c.max.x + r; vel.x = 0; }
        else { pos.z = delta > 0 ? c.min.z - r : c.max.z + r; vel.z = 0; }
        hitWall = true;
      }
    };
    tryAxis('x', vel.x * dt);
    tryAxis('z', vel.z * dt);
    tryAxis('y', vel.y * dt);
    if (pos.y <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; grounded = true; }
    const b = this.bounds;
    pos.x = Math.min(b.maxX - r, Math.max(b.minX + r, pos.x));
    pos.z = Math.min(b.maxZ - r, Math.max(b.minZ + r, pos.z));
    return { grounded, hitWall };
  }

  // Is entity standing on something at its current position?
  checkGrounded(pos, r, h) {
    if (pos.y <= 0.02) return true;
    const box = { minX: pos.x - r, maxX: pos.x + r, minZ: pos.z - r, maxZ: pos.z + r };
    for (const c of this.colliders) {
      if (c.material === MATERIALS.ground) continue;
      if (box.maxX <= c.min.x || box.minX >= c.max.x || box.maxZ <= c.min.z || box.minZ >= c.max.z) continue;
      if (Math.abs(pos.y - c.max.y) < 0.06) return true;
    }
    return false;
  }

  // All surface crossings of a ray, sorted by distance. dir normalized.
  raycast(origin, dir, maxDist) {
    const hits = [];
    for (const c of this.colliders) {
      const r = rayAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, c.min, c.max);
      if (!r || r.tMin > maxDist || r.tMin < 0) continue;
      hits.push({
        t: r.tMin, tExit: Math.min(r.tMax, maxDist), collider: c, material: c.material,
        nx: r.nx, ny: r.ny, nz: r.nz,
      });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  // Simple boolean line-of-sight check (concrete/metal/wood all block).
  lineBlocked(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-6) return false;
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    for (const c of this.colliders) {
      if (c.material === MATERIALS.ground) continue;
      const r = rayAABB(a.x, a.y, a.z, dir.x, dir.y, dir.z, c.min, c.max);
      if (r && r.tMin > 0.01 && r.tMin < dist - 0.01) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ navigation
  _buildNav() {
    const sp = 1.5, r = 0.42;
    const b = this.bounds;
    const nx = Math.floor((b.maxX - b.minX) / sp);
    const nz = Math.floor((b.maxZ - b.minZ) / sp);
    const walk = new Uint8Array(nx * nz);
    const solid = this.colliders.filter((c) => c.material !== MATERIALS.ground && c.min.y < 1.7 && c.max.y > 0.15);
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = b.minX + (ix + 0.5) * sp, z = b.minZ + (iz + 0.5) * sp;
        let ok = 1;
        for (const c of solid) {
          if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) { ok = 0; break; }
        }
        walk[iz * nx + ix] = ok;
      }
    }
    this.nav = { sp, nx, nz, walk, ox: b.minX, oz: b.minZ };
  }

  navIndex(x, z) {
    const n = this.nav;
    const ix = Math.floor((x - n.ox) / n.sp), iz = Math.floor((z - n.oz) / n.sp);
    if (ix < 0 || iz < 0 || ix >= n.nx || iz >= n.nz) return -1;
    return iz * n.nx + ix;
  }

  navPos(idx) {
    const n = this.nav;
    return { x: n.ox + ((idx % n.nx) + 0.5) * n.sp, z: n.oz + (Math.floor(idx / n.nx) + 0.5) * n.sp };
  }

  nearestWalkable(x, z) {
    const n = this.nav;
    let idx = this.navIndex(x, z);
    if (idx >= 0 && n.walk[idx]) return idx;
    for (let ring = 1; ring < 8; ring++) {
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const i = this.navIndex(x + dx * n.sp, z + dz * n.sp);
          if (i >= 0 && n.walk[i]) return i;
        }
      }
    }
    return -1;
  }

  // A* over the walk grid. Returns array of {x,z} or null.
  findPath(from, to) {
    const n = this.nav;
    const start = this.nearestWalkable(from.x, from.z);
    const goal = this.nearestWalkable(to.x, to.z);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [{ x: to.x, z: to.z }];
    const open = [start];
    const came = new Map();
    const gs = new Map([[start, 0]]);
    const fs = new Map([[start, 0]]);
    const gx = goal % n.nx, gz = Math.floor(goal / n.nx);
    const H = (i) => { const x = i % n.nx, z = Math.floor(i / n.nx); return Math.hypot(x - gx, z - gz); };
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let guard = 0;
    while (open.length && guard++ < 9000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if ((fs.get(open[i]) ?? 1e9) < (fs.get(open[bi]) ?? 1e9)) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) {
        const path = [];
        let c = cur;
        while (c !== undefined && c !== start) { path.push(this.navPos(c)); c = came.get(c); }
        path.reverse();
        path.push({ x: to.x, z: to.z });
        return path;
      }
      const cx = cur % n.nx, cz = Math.floor(cur / n.nx);
      for (const [dx, dz, cost] of dirs) {
        const x2 = cx + dx, z2 = cz + dz;
        if (x2 < 0 || z2 < 0 || x2 >= n.nx || z2 >= n.nz) continue;
        const ni = z2 * n.nx + x2;
        if (!n.walk[ni]) continue;
        if (dx && dz && (!n.walk[cz * n.nx + x2] || !n.walk[z2 * n.nx + cx])) continue;
        const g2 = gs.get(cur) + cost;
        if (g2 < (gs.get(ni) ?? 1e9)) {
          came.set(ni, cur);
          gs.set(ni, g2);
          fs.set(ni, g2 + H(ni));
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    return null;
  }

  randomNavPoint() {
    const n = this.nav;
    for (let tries = 0; tries < 60; tries++) {
      const i = Math.floor(Math.random() * n.walk.length);
      if (n.walk[i]) return this.navPos(i);
    }
    return { x: 0, z: 0 };
  }
}
