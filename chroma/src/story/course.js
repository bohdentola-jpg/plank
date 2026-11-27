// Course: the level-building API used by story levels. Wraps Level + PaintSystem,
// collects gameplay markers (spawn, checkpoints, pads, enemies, core...) and
// owns decor so the mode can dispose everything in one go.
import * as THREE from 'three';
import { Level } from '../world/level.js';
import { PaintSystem, makePaintable, makeNoiseTexture } from '../world/paint.js';
import { levelMaterials } from '../world/materials.js';
import { getTex } from '../world/textures.js';
import { std, glowMat, part, rod, v3, disposeTree } from './kit.js';

// Invisible-until-painted surface: the regular paint shader, but fragments
// without ink are discarded. Collision is untouched, so the floor is "there".
export function ghostMaterial(paint) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6 });
  makePaintable(mat, paint, { bevel: 0.3 });
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    inner.call(mat, sh, r);
    // `ink` is the 0..1 coverage computed by the paint patch in color_fragment
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (ink < 0.42) discard;');
  };
  mat.customProgramCacheKey = () => 'story-ghost-paintable';
  return mat;
}

export class Course {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.paint = new PaintSystem({ size: 2048, tpm: def.tpm || 8 });
    this.noise = makeNoiseTexture(256);
    this.paint.uniforms.uNoise.value = this.noise;
    this.level = new Level(this.paint);
    this.level.killY = def.killY ?? -6;
    this.decor = new THREE.Group();
    this.decor.name = 'story-decor';
    scene.add(this.decor);
    this.spawn = { pos: new THREE.Vector3(), yaw: 0 };
    this.checkpoints = []; this.pads = []; this.tips = []; this.enemies = []; this.swatch = null; this.core = null;
    this.hatches = []; this.exits = []; this.veil = null; this.goo = []; this.inkSplats = []; this.ghosts = []; this.shutters = [];
    this.lights = []; this.updaters = []; this.zones = [];
    this.matCache = new Map();
  }

  // ------------------------------------------------------------ geometry
  box(min, max, o = {}) { return this.level.box(min, max, o); }
  ramp(min, max, rise, o = {}) { return this.level.ramp(min, max, rise, o); }
  ghost(min, max, o = {}) { const s = this.level.box(min, max, { ...o, mat: 'ghost' }); this.ghosts.push(s); return s; }
  // visible wall + invisible cap so nobody climbs out of the course
  wall(min, max, o = {}) {
    const s = this.box(min, max, o);
    this.box([min[0], max[1], min[2]], [max[0], 80, max[2]], { render: false, paintable: false });
    return s;
  }
  shutter(min, max, faceName) {
    const i = this.shutters.length;
    const s = this.box(min, max, { mat: 'shutter' + i, color: 0x9a96a2 });
    this.shutters.push({ solid: s, faceName, mesh: null, open: false });
    return s;
  }

  // ------------------------------------------------------------ markers
  spawnAt(p, yaw = 0) { this.spawn.pos.copy(v3(p)); this.spawn.yaw = yaw; }
  checkpoint(p, yaw = 0) { this.checkpoints.push({ pos: v3(p), yaw }); }
  pad(from, to, apex = 4) { this.pads.push({ pos: v3(from), to: v3(to), apex }); }
  tip(min, max, html, o = {}) { this.tips.push({ min: [min[0], min[1]], max: [max[0], max[1]], html, ...o }); }
  zone(min, max, id) { this.zones.push({ min: v3(min), max: v3(max), id }); }
  swatchAt(p) { this.swatch = { pos: v3(p) }; }
  coreAt(p, o = {}) { this.core = { pos: v3(p), gate: o.gate || null }; }
  enemy(kind, p, o = {}) { this.enemies.push({ kind, pos: v3(p), ...o }); }
  hatch(id, p, yaw = 0) { this.hatches.push({ id, pos: v3(p), yaw }); }
  exit(p, yaw = 0) { this.exits.push({ pos: v3(p), yaw }); }
  veilAt(p, yaw = 0) { this.veil = { pos: v3(p), yaw }; }
  gooAt(p, r) { this.goo.push({ pos: v3(p), r }); }
  inkLane(a, b, r = 1.4, step = 1.1) {
    const A = v3(a), B = v3(b);
    const n = Math.max(1, Math.round(A.distanceTo(B) / step));
    for (let i = 0; i <= n; i++) this.inkSplats.push({ pos: A.clone().lerp(B, i / n), r });
  }

  // ------------------------------------------------------------ decor helpers
  mat(key, make) {
    if (!this.matCache.has(key)) this.matCache.set(key, make());
    return this.matCache.get(key);
  }

  lamp(p, color = 0xffc070, o = {}) {
    const g = new THREE.Group();
    g.position.set(...p);
    const shade = this.mat('lampShade', () => std(0x2b2833, 0.5, 0.6));
    part(g, new THREE.ConeGeometry(0.45, 0.42, 16, 1, true), shade, { pos: [0, 0.2, 0], shadow: false });
    part(g, new THREE.SphereGeometry(0.17, 12, 10), glowMat(color, 3.2), { pos: [0, 0.02, 0], shadow: false });
    if (o.hang !== false) rod(g, [0, 0.4, 0], [0, o.hang || 4, 0], 0.025, this.mat('cable', () => std(0x15131a, 0.8)), { shadow: false });
    this.decor.add(g);
    if (o.light !== false && this.lights.length < (this.maxLights ?? 6)) {
      const L = new THREE.PointLight(color, o.intensity ?? 22, o.dist ?? 16, 1.6);
      L.position.set(p[0], p[1] - 0.25, p[2]);
      L.castShadow = false;
      this.decor.add(L);
      this.lights.push(L);
    }
    return g;
  }

  // pipe along a list of points (with flanges)
  pipe(points, r = 0.28, color = 0x77727f) {
    const m = this.mat('pipe' + color, () => std(color, 0.45, 0.6));
    const fl = this.mat('flange', () => std(0x3b3842, 0.5, 0.7));
    for (let i = 0; i < points.length - 1; i++) {
      rod(this.decor, points[i], points[i + 1], r, m, { seg: 14 });
    }
    for (const p of points) part(this.decor, new THREE.SphereGeometry(r * 1.25, 12, 10), fl, { pos: p, shadow: false });
  }

  // big paint vat (pure decor; add a box for collision separately)
  vat(p, r = 2, h = 4, color = 0x8f6b55, label = null) {
    const g = new THREE.Group();
    g.position.set(...p);
    const body = this.mat('vat' + color, () => std(color, 0.55, 0.5));
    const rim = this.mat('vatRim', () => std(0x3b3842, 0.45, 0.7));
    part(g, new THREE.CylinderGeometry(r, r, h, 28), body, { pos: [0, h / 2, 0] });
    for (const y of [0.3, h * 0.5, h - 0.15]) part(g, new THREE.TorusGeometry(r + 0.04, 0.09, 8, 32), rim, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    // dried gray drips over the lip
    const drip = this.mat('dripGray', () => std(0x7b7885, 0.25, 0));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const len = 0.6 + (i % 3) * 0.5;
      part(g, new THREE.CapsuleGeometry(0.12, len, 4, 8), drip, { pos: [Math.cos(a) * (r + 0.05), h - len / 2 - 0.1, Math.sin(a) * (r + 0.05)], shadow: false });
    }
    if (label) {
      const s = label; s.position.set(0, h * 0.55, r + 0.02);
      g.add(s);
    }
    this.decor.add(g);
    return g;
  }

  girder(a, b, color = 0x4a4652) {
    const m = this.mat('girder' + color, () => std(color, 0.6, 0.55));
    const A = v3(a), B = v3(b);
    const len = A.distanceTo(B);
    const mesh = part(this.decor, new THREE.BoxGeometry(0.35, 0.6, len), m, { shadow: false });
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.lookAt(B);
    return mesh;
  }

  chain(top, len, color = 0x2e2b35) {
    const m = this.mat('chain' + color, () => std(color, 0.5, 0.8));
    const geo = this.chainGeo || (this.chainGeo = new THREE.TorusGeometry(0.09, 0.025, 6, 12));
    const n = Math.floor(len / 0.15);
    for (let i = 0; i < n; i++) {
      const l = part(this.decor, geo, m, { pos: [top[0], top[1] - i * 0.15, top[2]], rot: [Math.PI / 2 * (i % 2), 0, Math.PI / 2], shadow: false });
      l.scale.set(1, 1.3, 1);
    }
  }

  // tall decor column going down into the fog (under floating islands)
  column(x, z, w, d, top, bottom = -60, color = 0x5d5866) {
    const m = this.mat('column' + color, () => std(color, 0.85, 0.1));
    part(this.decor, new THREE.BoxGeometry(w, top - bottom, d), m, { pos: [x, (top + bottom) / 2, z], shadow: false, receive: true });
  }

  sign(texture, p, w, h, yaw = 0) {
    const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.35 });
    const mesh = part(this.decor, new THREE.PlaneGeometry(w, h), m, { pos: p, rot: [0, yaw, 0], shadow: false });
    return mesh;
  }

  // ------------------------------------------------------------ build
  finish(renderer, colors) {
    const L = this.level, P = this.paint;
    L.build();
    P.finalize();
    P.bakeAO((p) => L.sdf(p));
    P.setColors(colors[1], colors[2]);
    const mats = this.mats = levelMaterials(P);
    mats.ghost = { material: ghostMaterial(P), uvScale: 2 };
    const t = getTex('corrugated', {});
    this.shutters.forEach((sh, i) => {
      const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap || null, vertexColors: true, roughness: 0.45, metalness: 0.45 });
      makePaintable(m, P, { bevel: 0.3 });
      mats['shutter' + i] = { material: m, uvScale: 2 };
    });
    L.buildMeshes(mats, this.scene);
    for (const m of L.meshes) {
      if (m.name === 'level-ghost') { m.castShadow = false; m.receiveShadow = true; }
      const si = m.name.startsWith('level-shutter') ? +m.name.slice(13) : -1;
      if (si >= 0 && this.shutters[si]) this.shutters[si].mesh = m;
    }
    for (const sh of this.shutters) sh.face = sh.solid.sideFace?.[sh.faceName] || null;
    for (const g of this.goo) P.splat(g.pos, g.r, 2, { wobble: 0.35 });
    for (const s of this.inkSplats) P.splat(s.pos, s.r, 1, { wobble: 0.25 });
    return this;
  }

  // fraction of a face covered by a team's ink (sampled)
  faceCoverage(face, team, n = 8) {
    if (!face) return 0;
    let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (this.paint.ownerAtFace(face, ((i + 0.5) / n) * face.w, ((j + 0.5) / n) * face.h) === team) k++;
    }
    return k / (n * n);
  }

  dispose() {
    this.level.dispose();
    this.paint.dispose();
    this.noise.dispose();
    if (this.mats) for (const k of Object.keys(this.mats)) this.mats[k].material.dispose();
    for (const L of this.lights) L.dispose?.();
    disposeTree(this.decor);
    for (const m of this.matCache.values()) m.dispose();
    this.chainGeo?.dispose();
  }
}
