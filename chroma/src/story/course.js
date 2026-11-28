// Course: the level-building API used by story levels. Wraps Level + PaintSystem,
// collects gameplay markers (spawn, checkpoints, pads, enemies, core, mechanics...)
// and owns decor so the mode can dispose everything in one go.
//
// Dynamic solids ("dyns") are ordinary Level boxes with a material key of their
// own, so Level.buildMeshes gives each one a separate mesh. At runtime they can be
// moved (moveDyn), resized vertically (setDynHeight) or switched off; their paint
// faces, planes and grid cells follow, so collision, raycasts and painting work.
import * as THREE from 'three';
import { Level } from '../world/level.js';
import { PaintSystem, makePaintable, makeNoiseTexture } from '../world/paint.js';
import { levelMaterials } from '../world/materials.js';
import { getTex } from '../world/textures.js';
import { std, glowMat, part, rod, v3, disposeTree } from './kit.js';

// Invisible-until-painted surface: the regular paint shader, but fragments
// without ink are discarded. Collision is untouched, so the floor is "there".
export function ghostMaterial(paint, glow = false) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6 });
  makePaintable(mat, paint, { bevel: 0.3 });
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    inner.call(mat, sh, r);
    // `ink` is the 0..1 coverage computed by the paint patch in color_fragment
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (ink < 0.42) discard;');
    if (glow) sh.fragmentShader = sh.fragmentShader.replace('totalEmissiveRadiance += inkCol * ink * 0.06;', 'totalEmissiveRadiance += inkCol * ink * 0.75;');
  };
  mat.customProgramCacheKey = () => 'story-ghost-paintable' + (glow ? '-glow' : '');
  return mat;
}

// Make painted ink glow (darkness levels): boosts the paint patch's emissive term.
function glowInk(mat, k) {
  const inner = mat.onBeforeCompile;
  const key = mat.customProgramCacheKey?.() || '';
  mat.onBeforeCompile = (sh, r) => {
    inner.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('totalEmissiveRadiance += inkCol * ink * 0.06;', `totalEmissiveRadiance += inkCol * ink * ${k.toFixed(2)};`);
  };
  mat.customProgramCacheKey = () => key + '-glow' + k.toFixed(2);
  return mat;
}

const TEX_FOR = { concrete: ['concrete', { seams: 2 }, 4], concreteDark: ['concrete', { seams: 1, base: [150, 156, 168], seed: 9 }, 3], grate: ['grate', {}, 2], container: ['corrugated', {}, 2.6], wood: ['wood', {}, 1.2], hazard: ['hazard', {}, 1], tiles: ['plazaTiles', {}, 6], plain: ['plain', {}, 2], woodFloor: ['wood', {}, 2.4] };

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
    this.checkpoints = []; this.pads = []; this.tips = []; this.enemies = []; this.swatches = []; this.core = null;
    this.hatches = []; this.exits = []; this.gates = []; this.npcs = []; this.veil = null; this.goo = []; this.inkSplats = []; this.ghosts = []; this.shutters = [];
    this.lights = []; this.updaters = []; this.zones = []; this.shards = []; this.arrows = []; this.says = [];
    this.dyns = [];
    // mechanic markers (instantiated by story/mechanics.js)
    this.mech = { movers: [], crumbles: [], sponges: [], doors: [], switches: [], rails: [], fans: [], conveyors: [], floods: [], gates: [], arenas: [], pumps: [], lanterns: [], timers: [] };
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
  // a box with its own mesh that can move / resize / vanish at runtime
  dyn(min, max, o = {}) {
    const key = 'dyn' + this.dyns.length;
    const s = this.level.box(min, max, { ...o, mat: key });
    const d = {
      key, solid: s, base: o.mat || 'concrete', mesh: null, own: !!o.ownMat, glowK: o.glow || 0,
      min0: s.min.clone(), max0: s.max.clone(), offset: new THREE.Vector3(), h0: max[1] - min[1], h: max[1] - min[1],
      sweep: o.sweep || null, ghost: o.mat === 'ghost',
    };
    if (d.ghost) this.ghosts.push(s);
    this.dyns.push(d);
    return d;
  }

  // ------------------------------------------------------------ markers
  spawnAt(p, yaw = 0) { this.spawn.pos.copy(v3(p)); this.spawn.yaw = yaw; }
  checkpoint(p, yaw = 0) { this.checkpoints.push({ pos: v3(p), yaw }); }
  pad(from, to, apex = 4) { this.pads.push({ pos: v3(from), to: v3(to), apex }); }
  tip(min, max, html, o = {}) { this.tips.push({ min: [min[0], min[1]], max: [max[0], max[1]], html, ...o }); }
  zone(min, max, id) { this.zones.push({ min: v3(min), max: v3(max), id }); }
  // radio chatter the first time the player enters a box (xz min/max + optional y range)
  say(min, max, lines, o = {}) { this.says.push({ min: [min[0], min[1]], max: [max[0], max[1]], lines, done: false, ...o }); }
  // Lost Swatches in order (the i-th call is the level's i-th swatch)
  swatchAt(p) { this.swatches.push({ pos: v3(p) }); }
  coreAt(p, o = {}) { this.core = { pos: v3(p), gate: o.gate || null, need: o.need || [] }; }
  enemy(kind, p, o = {}) { this.enemies.push({ kind, pos: v3(p), ...o }); }
  hatch(id, p, yaw = 0) { this.hatches.push({ id, pos: v3(p), yaw }); }
  exit(p, yaw = 0, to = 'plaza', label = null) { this.exits.push({ pos: v3(p), yaw, to, label }); }
  // big sector door in a hub (to: hub id, needs: level id that must be cleared)
  sectorGate(p, yaw, to, needs, o = {}) { this.gates.push({ pos: v3(p), yaw, to, needs, ...o }); }
  npc(kind, p, yaw = 0, o = {}) { this.npcs.push({ kind, pos: v3(p), yaw, ...o }); }
  veilAt(p, yaw = 0) { this.veil = { pos: v3(p), yaw }; }
  gooAt(p, r) { this.goo.push({ pos: v3(p), r }); }
  inkLane(a, b, r = 1.4, step = 1.1) {
    const A = v3(a), B = v3(b);
    const n = Math.max(1, Math.round(A.distanceTo(B) / step));
    for (let i = 0; i <= n; i++) this.inkSplats.push({ pos: A.clone().lerp(B, i / n), r });
  }
  grayLane(a, b, r = 1.4, step = 1.1) {
    const A = v3(a), B = v3(b);
    const n = Math.max(1, Math.round(A.distanceTo(B) / step));
    for (let i = 0; i <= n; i++) this.goo.push({ pos: A.clone().lerp(B, i / n), r });
  }
  // Hue Shards: small (1) or big (5) pickups; indices are stable per level
  shard(p, big = false) { this.shards.push({ pos: v3(p), big }); }
  shardLine(a, b, n, o = {}) {
    const A = v3(a), B = v3(b);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const p = A.clone().lerp(B, t);
      if (o.arc) p.y += Math.sin(t * Math.PI) * o.arc;
      this.shards.push({ pos: p, big: false });
    }
  }
  shardRing(c, r, n, y = 0) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.shards.push({ pos: new THREE.Vector3(c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r), big: false }); } }
  // painted floor arrow pointing along yaw (pure signposting)
  arrow(p, yaw, o = {}) { this.arrows.push({ pos: v3(p), yaw, color: o.color ?? 0xffd21a, s: o.s || 1, wall: o.wall || null }); }

  // ------------------------------------------------------------ mechanics
  // moving platform. path: offsets from the built position, visited in order
  mover(min, max, o = {}) {
    const pts = (o.path || [[0, 0, 0]]).map(v3);
    const sw = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) };
    const lo = sw.min.clone(), hi = sw.max.clone();
    if (o.orbit) {
      const r = o.orbit.r;
      lo.x -= r * 2; lo.z -= r * 2; hi.x += r * 2; hi.z += r * 2;
    }
    for (const p of pts) { lo.min(sw.min.clone().add(p)); hi.max(sw.max.clone().add(p)); }
    const d = this.dyn(min, max, { mat: o.mat || 'grate', color: o.color ?? 0xb8c4cc, sweep: { min: lo, max: hi } });
    const m = { dyn: d, path: pts, speed: o.speed || 2.5, wait: o.wait ?? 0.8, loop: !!o.loop, orbit: o.orbit || null, trigger: o.trigger || null, id: o.id || null, phase: o.phase || 0, on: o.trigger ? false : true };
    this.mech.movers.push(m);
    return m;
  }
  crumble(min, max, o = {}) {
    const d = this.dyn(min, max, { mat: o.mat || 'wood', color: o.color ?? 0xc9a27a });
    this.mech.crumbles.push({ dyn: d, delay: o.delay ?? 0.65, back: o.back ?? 4.5 });
    return d;
  }
  // grows from h0 to its full height once painted
  sponge(min, max, o = {}) {
    const d = this.dyn(min, max, { mat: 'sponge', color: o.color ?? 0xffd36b, ownMat: true });
    this.mech.sponges.push({ dyn: d, h0: o.h0 ?? 0.35, need: o.need ?? 0.3, shrink: o.shrink || 0 });
    return d;
  }
  // sliding door; dir: 'up' | 'down' | [dx,dy,dz]
  door(id, min, max, o = {}) {
    const h = max[1] - min[1];
    const dirV = Array.isArray(o.dir) ? v3(o.dir) : new THREE.Vector3(0, o.dir === 'down' ? -(h + 0.05) : h - 0.25, 0);
    const lo = new THREE.Vector3(...min).min(new THREE.Vector3(...min).add(dirV)), hi = new THREE.Vector3(...max).max(new THREE.Vector3(...max).add(dirV));
    const d = this.dyn(min, max, { mat: o.mat || 'container', color: o.color ?? 0x8a8794, sweep: { min: lo, max: hi } });
    const door = { id, dyn: d, dir: dirV, open: !!o.open, k: o.open ? 1 : 0, speed: o.speed || 1.6, stripes: o.stripes !== false, need: o.need || null };
    this.mech.doors.push(door);
    return door;
  }
  // paint-switch panel; face: which side faces the player ('px','nx','pz','nz','top')
  paintSwitch(id, min, max, face, o = {}) {
    const d = this.dyn(min, max, { mat: 'switch', color: 0xd8d4e0, ownMat: true });
    this.mech.switches.push({ id, dyn: d, face, targets: o.targets || [], timed: o.timed || 0, need: o.need ?? 0.5, label: o.label || null, drain: !!o.drain, lantern: !!o.lantern, disabled: !!o.disabled });
    return d;
  }
  // flood drain: a paint switch that lowers the gray flood
  drain(id, min, max, face, o = {}) { return this.paintSwitch(id, min, max, face, { ...o, drain: true }); }
  rail(points, o = {}) { this.mech.rails.push({ pts: points.map(v3), speed: o.speed || 11, id: o.id || null }); }
  fan(p, o = {}) { this.mech.fans.push({ pos: v3(p), r: o.r || 1.6, h: o.h || 8, lift: o.lift || 9, on: o.on !== false, id: o.id || null }); }
  conveyor(min, max, dir, speed = 3, o = {}) {
    const s = this.box(min, max, { mat: o.mat || 'grate', color: o.color ?? 0x5f6b72 });
    this.mech.conveyors.push({ solid: s, dir: v3(dir).normalize(), speed, min: v3(min), max: v3(max) });
    return s;
  }
  // rising gray goo: a horizontal surface that climbs from y0 to ymax unless drained
  flood(o) { this.mech.floods.push({ y0: o.y0, ymax: o.ymax, rate: o.rate || 0.25, min: o.min, max: o.max, drains: o.drains || [], drop: o.drop ?? 2.5, start: o.start || null, color: o.color ?? 0x8b8794 }); }
  // chroma membrane: solid until you dive in (goo form), then you swim through
  membrane(min, max, o = {}) {
    const s = this.box(min, max, { render: false, paintable: false });
    this.mech.gates.push({ solid: s, min: v3(min), max: v3(max), axis: (max[0] - min[0]) < (max[2] - min[2]) ? 'x' : 'z' });
    return s;
  }
  // combat room: doors shut, waves spawn, doors reopen when the last Drab pops
  arena(id, min, max, o = {}) { this.mech.arenas.push({ id, min: v3(min), max: v3(max), doors: o.doors || [], waves: (o.waves || []).map((w) => w.map((e) => ({ ...e, pos: v3(e.pos) }))), shards: o.shards ?? 8, name: o.name || null }); }
  pump(p, o = {}) { this.mech.pumps.push({ pos: v3(p), hp: o.hp || 600, time: o.time || 60, waves: (o.waves || []).map((w) => ({ t: w.t, list: w.list.map((e) => ({ ...e, pos: v3(e.pos) })) })), zone: o.zone ? { min: v3(o.zone[0]), max: v3(o.zone[1]) } : null }); }
  // a lantern: paint its plate to light it (darkness levels)
  lantern(p, o = {}) { this.mech.lanterns.push({ pos: v3(p), r: o.r || 9, color: o.color ?? 0xffc46b, lit: !!o.lit }); }

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
    if (o.light !== false) this.light(p, color, o);
    return g;
  }
  light(p, color, o = {}) {
    if (this.lights.length >= (this.maxLights ?? 6)) return null;
    const L = new THREE.PointLight(color, o.intensity ?? 22, o.dist ?? 16, 1.6);
    L.position.set(p[0], p[1] - 0.25, p[2]);
    L.castShadow = false;
    this.decor.add(L);
    this.lights.push(L);
    return L;
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

  // paintable material with its own program-independent instance (per-dyn tinting)
  ownMaterial(kind) {
    const P = this.paint;
    let m;
    if (kind === 'sponge') {
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, emissive: 0x000000 });
      makePaintable(m, P, { bevel: 0.45, ao: 0.6 });
      return { material: m, uvScale: 1 };
    }
    if (kind === 'switch') {
      const t = getTex('hazard', {});
      m = new THREE.MeshStandardMaterial({ map: t.map, vertexColors: true, roughness: 0.5, metalness: 0.25, emissive: 0x000000 });
      makePaintable(m, P, { bevel: 0.35 });
      return { material: m, uvScale: 0.8 };
    }
    const [tex, opts, uv] = TEX_FOR[kind] || TEX_FOR.concrete;
    const t = getTex(tex, opts);
    m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap || null, vertexColors: true, roughness: 0.6, metalness: 0.2, emissive: 0x000000 });
    makePaintable(m, P, { bevel: 0.3 });
    return { material: m, uvScale: uv };
  }

  // ------------------------------------------------------------ build
  finish(renderer, colors) {
    const L = this.level, P = this.paint;
    L.build();
    P.finalize();
    P.bakeAO((p) => L.sdf(p));
    P.setColors(colors[1], colors[2]);
    const mats = this.mats = levelMaterials(P);
    const glow = this.def.glowInk || 0;
    mats.ghost = { material: ghostMaterial(P, glow > 0), uvScale: 2 };
    const t = getTex('corrugated', {});
    this.shutters.forEach((sh, i) => {
      const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap || null, vertexColors: true, roughness: 0.45, metalness: 0.45 });
      makePaintable(m, P, { bevel: 0.3 });
      mats['shutter' + i] = { material: m, uvScale: 2 };
    });
    for (const d of this.dyns) {
      if (d.own || d.base === 'sponge' || d.base === 'switch') mats[d.key] = this.ownMaterial(d.base);
      else mats[d.key] = { ...(mats[d.base] || mats.concrete), shared: true };
    }
    if (glow) for (const k of Object.keys(mats)) if (k !== 'ghost' && !mats[k].shared) glowInk(mats[k].material, glow);
    L.buildMeshes(mats, this.scene);
    const byName = new Map(L.meshes.map((m) => [m.name, m]));
    for (const m of L.meshes) {
      if (m.name === 'level-ghost') { m.castShadow = false; m.receiveShadow = true; }
      const si = m.name.startsWith('level-shutter') ? +m.name.slice(13) : -1;
      if (si >= 0 && this.shutters[si]) this.shutters[si].mesh = m;
    }
    for (const sh of this.shutters) sh.face = sh.solid.sideFace?.[sh.faceName] || null;
    // dyn meshes + extra grid cells along their path of motion
    for (const d of this.dyns) {
      d.mesh = byName.get('level-' + d.key) || null;
      if (d.mesh && d.ghost) d.mesh.castShadow = false;
      if (d.sweep) this.registerSweep(d.solid, d.sweep.min, d.sweep.max);
    }
    for (const g of this.goo) P.splat(g.pos, g.r, 2, { wobble: 0.35 });
    for (const s of this.inkSplats) P.splat(s.pos, s.r, 1, { wobble: 0.25 });
    return this;
  }

  registerSweep(s, min, max) {
    const L = this.level;
    const [x0, z0] = L.cellOf(min.x, min.z), [x1, z1] = L.cellOf(max.x, max.z);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const cell = L.grid[z * L.gw + x];
      if (!cell.includes(s)) cell.push(s);
    }
  }

  // Move a dyn so its build position is displaced by `off` (absolute offset).
  moveDyn(d, off) {
    const dx = off.x - d.offset.x, dy = off.y - d.offset.y, dz = off.z - d.offset.z;
    if (!dx && !dy && !dz) return;
    const s = d.solid;
    s.min.x += dx; s.min.y += dy; s.min.z += dz;
    s.max.x += dx; s.max.y += dy; s.max.z += dz;
    s.center.x += dx; s.center.y += dy; s.center.z += dz;
    for (const pl of s.planes) pl.d += pl.n.x * dx + pl.n.y * dy + pl.n.z * dz;
    for (const f of s.faces) {
      f.origin.x += dx; f.origin.y += dy; f.origin.z += dz;
      f.center.x += dx; f.center.y += dy; f.center.z += dz;
    }
    d.offset.copy(off);
    this.syncDynMesh(d);
  }

  // Resize a dyn vertically (bottom stays put).
  setDynHeight(d, h) {
    const s = d.solid;
    const dy = h - d.h;
    if (Math.abs(dy) < 1e-5) return;
    d.h = h;
    s.max.y = s.min.y + h;
    s.center.y = (s.min.y + s.max.y) / 2;
    for (const pl of s.planes) if (pl.n.y > 0.5) pl.d = s.max.y;
    const top = s.sideFace?.top;
    if (top) { top.origin.y += dy; top.center.y += dy; }
    this.syncDynMesh(d);
  }

  syncDynMesh(d) {
    if (!d.mesh) return;
    const k = d.h / d.h0;
    d.mesh.scale.y = k;
    d.mesh.position.set(d.offset.x, d.offset.y + d.min0.y * (1 - k), d.offset.z);
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
    if (this.mats) for (const k of Object.keys(this.mats)) if (!this.mats[k].shared) this.mats[k].material.dispose();
    for (const L of this.lights) L.dispose?.();
    disposeTree(this.decor);
    for (const m of this.matCache.values()) m.dispose();
    this.chainGeo?.dispose();
  }
}
