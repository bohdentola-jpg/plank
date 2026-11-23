// Port Zarya, assembled: terrain, sea, streets, every building on its lot,
// streetlights (old sodium + Northstar's new camera lights), power lines,
// yard clutter — plus the data gameplay needs: colliders, doors, named points,
// light sources (a pool of real lights follows the camera), security cameras.
import * as THREE from 'three';
import { TOWN } from './townplan.js';
import { bakeTerrain, buildTerrainMesh, buildFarHills, groundY } from './terrain.js';
import { buildSea } from './sea.js';
import { buildRoads, streetPoints } from './roads.js';
import { buildBuilding, BUILDING_KINDS } from './buildings/index.js';
import { makeProp, powerLine } from './props.js';
import { makeRng } from '../core/util.js';

const FALLBACK = {
  church: [14, 22, 9], generalStore: [12, 18, 7], cornerStore: [16, 14, 5], communityHall: [14, 20, 6], cityHall: [18, 14, 8],
  police: [12, 12, 5], postOffice: [10, 10, 5], clinic: [14, 10, 5], school: [30, 20, 7], radioStation: [8, 8, 4],
  diner: [14, 10, 5], bar: [12, 10, 5], hardware: [20, 16, 7], fuelTanks: [20, 14, 6], cannery: [40, 30, 12],
  harbor: [1, 1, 0.1], cabin: [7, 6, 4], house: [9, 8, 6], terminal: [12, 8, 4], hangar: [24, 20, 9], dome: [40, 40, 30],
  lighthouse: [5, 5, 16], cemetery: [26, 20, 0.5],
};

function placeholder(type) {
  const [w, d, h] = FALLBACK[type] || [10, 10, 5];
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.8 }));
  m.position.y = h / 2;
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return { group: g, footprint: { w, d }, doors: [{ id: 'front', x: 0, z: d / 2, rot: 0, w: 1, leadsTo: 'exterior' }], colliders: [{ x: 0, z: 0, w, d, rot: 0, h }], points: {}, interior: null, lights: [], cameras: [] };
}

const _v = new THREE.Vector3();

function toWorld(b, lx, ly, lz) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return new THREE.Vector3(b.x + lx * c + lz * s, b.y + ly, b.z - lx * s + lz * c);
}

/**
 * Build the whole town. opts: { interiors: true, states: {id: 0..1}, onProgress(k) }
 */
export async function buildTown(opts = {}) {
  const root = new THREE.Group();
  root.name = 'world';
  const out = {
    root, colliders: [], doors: [], points: {}, lightSources: [], cameras: [], buildings: {}, interiors: [],
    floors: [], smokePoints: [], beams: [],
  };
  const tick = async (k) => { opts.onProgress?.(k); await new Promise((r) => setTimeout(r, 0)); };

  bakeTerrain();
  root.add(buildTerrainMesh());
  root.add(buildFarHills());
  const sea = buildSea();
  root.add(sea.mesh);
  out.sea = sea;
  root.add(buildRoads());
  await tick(0.2);

  // ---------------------------------------------------------------- buildings
  const place = (id, type, x, z, rot, bopts) => {
    let b;
    try {
      b = BUILDING_KINDS.includes(type) ? buildBuilding(type, bopts) : placeholder(type);
    } catch (e) {
      console.warn('building failed', type, e);
      b = placeholder(type);
    }
    const y = type === 'harbor' ? 0 : groundY(x, z);   // the harbor's y = 0 is the sea surface
    b.group.position.set(x, y, z);
    b.group.rotation.y = rot;
    b.group.name = id;
    root.add(b.group);
    const rec = { id, type, x, y, z, rot, b, opts: bopts };
    out.buildings[id] = rec;
    for (const c of b.colliders || []) {
      const p = toWorld(rec, c.x, 0, c.z);
      out.colliders.push({ x: p.x, z: p.z, w: c.w, d: c.d, rot: (c.rot || 0) + rot, h: c.h ?? 4, y: y, owner: id });
    }
    for (const dr of b.doors || []) {
      const p = toWorld(rec, dr.x, 0, dr.z);
      out.doors.push({ ...dr, x: p.x, y, z: p.z, rot: (dr.rot || 0) + rot, building: id });
    }
    for (const [name, pt] of Object.entries(b.points || {})) {
      const p = toWorld(rec, pt.x, pt.y || 0, pt.z);
      out.points[`${id}.${name}`] = { x: p.x, y: p.y, z: p.z, rot: (pt.rot || 0) + rot };
      if (/^smoke\d*$/.test(name)) out.smokePoints.push({ x: p.x, y: p.y, z: p.z, owner: id });
    }
    // walkable floors (porches, docks, raised floors, stairs) in world space
    for (const f of b.floors || []) {
      const p = toWorld(rec, f.x, 0, f.z);
      out.floors.push({ x: p.x, z: p.z, w: f.w, d: f.d, rot: (f.rot || 0) + rot, y: y + f.y, owner: id });
    }
    for (const f of b.ramps || []) {
      const p = toWorld(rec, f.x, 0, f.z);
      out.floors.push({ x: p.x, z: p.z, w: f.w, d: f.d, rot: (f.rot || 0) + rot, y0: y + f.y0, y1: y + f.y1, owner: id });
    }
    if (b.group.userData.beam) out.beams.push(b.group.userData.beam);
    for (const l of b.lights || []) {
      const p = toWorld(rec, l.x, l.y, l.z);
      out.lightSources.push({ pos: p, color: new THREE.Color().setRGB(...(Array.isArray(l.color) ? l.color : [1, 0.8, 0.6])), intensity: l.intensity ?? 2, distance: l.distance ?? 8, owner: id, interior: !!l.interior });
    }
    for (const c of b.cameras || []) {
      const p = toWorld(rec, c.x, c.y, c.z);
      out.cameras.push({ ...c, x: p.x, y: p.y, z: p.z, yaw: (c.yaw || 0) + rot, owner: id });
    }
    if (b.interior) {
      b.interior.visible = false;
      b.group.add(b.interior);
      out.interiors.push({ id, group: b.interior, x, z, r: Math.max(b.footprint?.w || 10, b.footprint?.d || 10) * 0.8 + 18 });
    }
    return rec;
  };

  // rebuild one building in a new state (repairs): same seed, same colliders
  out.rebuild = (id, state) => {
    const rec = out.buildings[id];
    if (!rec) return;
    let nb;
    try { nb = BUILDING_KINDS.includes(rec.type) ? buildBuilding(rec.type, { ...rec.opts, state }) : null; } catch (e) { console.warn(e); }
    if (!nb) return;
    nb.group.position.copy(rec.b.group.position);
    nb.group.rotation.y = rec.rot;
    nb.group.name = id;
    const wasInterior = rec.b.interior;
    root.remove(rec.b.group);
    rec.b.group.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); });
    if (nb.interior) {
      nb.interior.visible = false;
      nb.group.add(nb.interior);
      const it = out.interiors.find((q) => q.id === id);
      if (it) it.group = nb.interior;
    } else if (wasInterior) out.interiors = out.interiors.filter((q) => q.id !== id);
    root.add(nb.group);
    const ob = rec.b.group.userData.beam;
    if (ob) out.beams = out.beams.filter((x) => x !== ob);
    if (nb.group.userData.beam) out.beams.push(nb.group.userData.beam);
    rec.b = nb;
    rec.opts = { ...rec.opts, state };
  };

  let n = 0;
  for (const e of TOWN.buildings) {
    const state = opts.states?.['state:' + e.id] ?? (e.type === 'cornerStore' || e.type === 'dome' ? 1 : 0.15);
    const extra = e.type === 'harbor' ? { shoreY: Math.max(0.8, groundY(e.x, e.z - 21)) } : {};
    place(e.id, e.type, e.x, e.z, e.rot, { seed: n * 31 + 7, state, name: e.name, interior: opts.interiors !== false, owner: e.owner, ...extra });
    if (++n % 4 === 0) await tick(0.2 + 0.5 * n / TOWN.buildings.length);
  }
  const rng = makeRng('houses');
  TOWN.houseLots.forEach(([x, z, rot, owner], i) => {
    const st0 = 0.1 + rng() * 0.6;
    place(`house${i}`, 'house', x, z, rot, { seed: 1000 + i * 17, state: opts.states?.[`state:house${i}`] ?? st0, owner });
  });
  await tick(0.8);

  // ---------------------------------------------------------------- streets
  const nearSquare = (x, z) => Math.hypot(x, z + 10) < 80 || (Math.abs(x) < 12 && z < 0 && z > -110);
  const lampEvery = streetPoints(34);
  const poles = [];
  lampEvery.forEach((p, i) => {
    if (p.street.dirt) return;
    if (p.street.id === 'dome' && i % 2) return;
    const side = i % 2 ? 1 : -1;
    const off = p.street.width / 2 + 1.8;
    const x = p.x + Math.cos(p.dir) * off * side, z = p.z - Math.sin(p.dir) * off * side;
    const smart = nearSquare(x, z);
    const lamp = makeProp(smart ? 'smartLight' : 'sodiumLight', { seed: i % 5 });
    lamp.position.set(x, groundY(x, z), z);
    lamp.rotation.y = p.dir + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    root.add(lamp);
    lamp.updateMatrixWorld(true);
    for (const l of lamp.userData.lights || []) {
      const wp = new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(lamp.matrixWorld);
      out.lightSources.push({ pos: wp, color: new THREE.Color().setRGB(...(Array.isArray(l.color) ? l.color : smart ? [0.85, 0.95, 1.1] : [1.0, 0.62, 0.28])), intensity: l.intensity ?? (smart ? 6 : 5), distance: l.distance ?? 22, street: true });
    }
    for (const c of lamp.userData.cameras || []) {
      const wp = new THREE.Vector3(c.x, c.y, c.z).applyMatrix4(lamp.matrixWorld);
      out.cameras.push({ ...c, x: wp.x, y: wp.y, z: wp.z, yaw: (c.yaw || 0) + lamp.rotation.y, owner: 'smartlight' });
    }
    out.colliders.push({ x, z, w: 0.3, d: 0.3, rot: 0, h: 6, y: groundY(x, z), owner: 'lamp' });
    if (!smart && (p.street.id === 'front' || p.street.id === 'airport' || p.street.id === 'main')) poles.push({ x: x + Math.cos(p.dir) * 1.2 * side, z: z - Math.sin(p.dir) * 1.2 * side, rot: p.dir });
  });
  // power lines along the main streets
  for (let i = 0; i < poles.length; i++) {
    const p = poles[i];
    const pole = makeProp('powerPole', { seed: i % 3 });
    p.y = groundY(p.x, p.z);
    pole.position.set(p.x, p.y, p.z);
    pole.rotation.y = p.rot;
    root.add(pole);
    const q = poles[i + 1];
    if (q && Math.hypot(q.x - p.x, q.z - p.z) < 90) {
      q.y = groundY(q.x, q.z);
      try { root.add(powerLine({ x: p.x, y: p.y, z: p.z, rot: p.rot }, { x: q.x, y: q.y, z: q.z, rot: q.rot }, { sag: 0.9 })); } catch { /* */ }
    }
  }
  await tick(0.9);

  // yard clutter scattered near houses and along the shore
  const yard = ['fuelDrum', 'oilTank', 'snowmobile', 'woodpile', 'crabPot', 'pallet', 'propane', 'tires', 'atv', 'boatTrailer', 'satDish'];
  TOWN.houseLots.forEach(([x, z, rot], i) => {
    const r = makeRng('yard' + i);
    const k = 1 + Math.floor(r() * 3);
    for (let j = 0; j < k; j++) {
      const type = yard[Math.floor(r() * yard.length)];
      let pr;
      try { pr = makeProp(type, { seed: i * 3 + j }); } catch { continue; }
      const a = rot + (r() - 0.5) * 2.4 + Math.PI;
      const d = 6 + r() * 4;
      const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      pr.position.set(px, groundY(px, pz), pz);
      pr.rotation.y = r() * Math.PI * 2;
      root.add(pr);
    }
  });
  await tick(1);
  // per-frame: the lighthouse turns
  out.update = (dt) => {
    for (const b of out.beams) b.rotation.y += dt * 0.9;
  };
  return out;
}

/**
 * A pool of real point lights that follow the nearest light sources.
 */
export class LightPool {
  constructor(scene, sources, n = 10) {
    this.sources = sources;
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this._t = 0;
  }

  update(dt, pos, night = 1) {
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.25;
    const ranked = this.sources
      .map((s) => ({ s, d: s.pos.distanceToSquared(pos) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length);
    this.lights.forEach((l, i) => {
      const r = ranked[i];
      if (!r || r.d > 160 * 160) { l.intensity = 0; return; }
      l.position.copy(r.s.pos);
      l.color.copy(r.s.color);
      l.distance = r.s.distance;
      l.intensity = r.s.intensity * (r.s.street ? night : 1);
    });
  }
}
