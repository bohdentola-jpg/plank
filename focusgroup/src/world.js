// FOCUS GROUP — the box the game happens in.
//
// A World is a group of meshes, a flat list of axis-aligned colliders, a list
// of rooms so the game knows which room you are standing in, a list of things
// you can look at, and a list of places a camera has been put. Everything is
// metres. The ceiling is 2.45 m because it is a 1960s block and they were not
// being generous.

import * as THREE from 'three';
import { material, tileScale, simple } from './textures.js';
import { inRect } from './util.js';

export const CEIL = 2.45;

/** BoxGeometry UVs are 0..1 per face; make them metres × tiles-per-metre. */
export function scaleBoxUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * su * tile, uv.getY(k) * sv * tile);
    }
  }
  uv.needsUpdate = true;
}

export function scalePlaneUVs(geo, w, h, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * w * tile, uv.getY(i) * h * tile);
  }
  uv.needsUpdate = true;
}

export class World {
  constructor(name) {
    this.name = name;
    this.group = new THREE.Group();
    this.colliders = [];     // { x0, x1, z0, z1, y0, y1, tag }
    this.rooms = [];         // { id, x0, x1, z0, z1, floor }
    this.interacts = [];     // see addInteract
    this.lights = [];        // { light, base, kind }
    this.camSpots = new Map();
    this.ticks = [];         // per-frame closures the set owns
    this.bounds = { x0: -50, x1: 50, z0: -50, z1: 50 };
  }

  add(obj) { this.group.add(obj); return obj; }

  // ------------------------------------------------------------------ geometry

  /**
   * A textured box. `mat` is a RECIPES name or a THREE.Material.
   * Adds a collider unless `solid: false`.
   */
  box(w, h, d, mat, x, y, z, o = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = typeof mat === 'string' ? material(mat) : mat;
    if (typeof mat === 'string') scaleBoxUVs(geo, w, h, d, o.tile ?? tileScale(mat));
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (o.rotY) mesh.rotation.y = o.rotY;
    mesh.castShadow = o.cast ?? false;
    mesh.receiveShadow = o.receive ?? true;
    this.add(mesh);
    if (o.solid !== false && !o.rotY) {
      this.solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y - h / 2, y + h / 2, o.tag);
    }
    return mesh;
  }

  /** A horizontal slab: floors and ceilings. Never a collider. */
  slab(x0, x1, z0, z1, y, mat, o = {}) {
    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(o.up === false ? Math.PI / 2 : -Math.PI / 2);
    const m = typeof mat === 'string' ? material(mat) : mat;
    if (typeof mat === 'string') scalePlaneUVs(geo, w, d, o.tile ?? tileScale(mat));
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = o.receive ?? true;
    return this.add(mesh);
  }

  /**
   * A wall run from (x0,z0) to (x1,z1) — must be axis aligned — with holes cut
   * in it. A hole is { at, w, y0, y1 }: `at` is metres along the run from the
   * start, y0/y1 are heights. Doorways are y0:0; windows are not.
   */
  wall(x0, z0, x1, z1, mat, o = {}) {
    const h = o.h ?? CEIL;
    const t = o.t ?? 0.12;
    const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const holes = (o.holes || []).slice().sort((a, b) => a.at - b.at);
    const parts = [];

    // the full-height stretches between the holes
    let cursor = 0;
    for (const hole of holes) {
      if (hole.at > cursor) parts.push({ a: cursor, b: hole.at, y0: 0, y1: h });
      // above and below the opening
      if (hole.y1 < h) parts.push({ a: hole.at, b: hole.at + hole.w, y0: hole.y1, y1: h });
      if (hole.y0 > 0) parts.push({ a: hole.at, b: hole.at + hole.w, y0: 0, y1: hole.y0 });
      cursor = hole.at + hole.w;
    }
    if (cursor < len) parts.push({ a: cursor, b: len, y0: 0, y1: h });

    const sx = Math.min(x0, x1), sz = Math.min(z0, z1);
    const made = [];
    for (const p of parts) {
      const pl = p.b - p.a;
      const ph = p.y1 - p.y0;
      if (pl <= 0.001 || ph <= 0.001) continue;
      const cx = horiz ? sx + p.a + pl / 2 : x0;
      const cz = horiz ? z0 : sz + p.a + pl / 2;
      const w = horiz ? pl : t;
      const d = horiz ? t : pl;
      made.push(this.box(w, ph, d, mat, cx, p.y0 + ph / 2, cz,
        { solid: false, receive: true, tile: o.tile }));
      // one collider per part, but only for the bits you could walk into
      if (p.y0 < 1.9) {
        this.solid(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, p.y0, p.y1, 'wall');
      }
    }
    return made;
  }

  solid(x0, x1, z0, z1, y0 = 0, y1 = CEIL, tag = '') {
    const c = { x0, x1, z0, z1, y0, y1, tag };
    this.colliders.push(c);
    return c;
  }

  /**
   * A collider for a prop that has been turned. Colliders stay axis-aligned —
   * at a quarter turn that means swapping width for depth, and at anything in
   * between it means the bounding box, which for a sideboard is close enough.
   */
  solidRot(x, z, w, d, y0, y1, rotY = 0, tag = 'prop') {
    const c = Math.abs(Math.cos(rotY));
    const s = Math.abs(Math.sin(rotY));
    const ew = w * c + d * s;
    const ed = w * s + d * c;
    return this.solid(x - ew / 2, x + ew / 2, z - ed / 2, z + ed / 2, y0, y1, tag);
  }

  // ------------------------------------------------------------------ rooms

  room(id, x0, z0, x1, z1, floor = 'carpet') {
    const r = { id, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), floor };
    this.rooms.push(r);
    return r;
  }

  roomAt(x, z) {
    for (const r of this.rooms) if (inRect(x, z, r)) return r.id;
    return null;
  }

  floorMatAt(x, z) {
    for (const r of this.rooms) if (inRect(x, z, r)) return r.floor;
    return 'carpet';
  }

  // ------------------------------------------------------------------ things

  /**
   * Something you can look at, and maybe press E on.
   * @param {object} o
   *   id     unique
   *   pos    {x,y,z} where the prompt points
   *   r      how close you have to be (default 1.9)
   *   label  what the prompt says ("MAKE THE COFFEE")
   *   key    'E' by default; 'Q' for the noticing ones
   *   lens   the LENSES id, if this is a hidden camera
   *   once   remove after use
   *   on     () => void
   */
  addInteract(o) {
    const it = {
      r: 1.9,
      key: 'E',
      once: false,
      enabled: true,
      used: false,
      ...o,
      pos: new THREE.Vector3(o.pos.x, o.pos.y, o.pos.z),
    };
    this.interacts.push(it);
    return it;
  }

  interactById(id) { return this.interacts.find((i) => i.id === id); }

  removeInteract(id) {
    const i = this.interacts.findIndex((x) => x.id === id);
    if (i >= 0) this.interacts.splice(i, 1);
  }

  /**
   * The thing you are looking at: nearest inside its radius, weighted so that
   * pointing at something beats standing next to something.
   */
  focus(eye, dir, o = {}) {
    let best = null;
    let bestScore = -Infinity;
    for (const it of this.interacts) {
      if (!it.enabled || (it.once && it.used)) continue;
      if (o.key && it.key !== o.key) continue;
      const dx = it.pos.x - eye.x, dy = it.pos.y - eye.y, dz = it.pos.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > it.r) continue;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / Math.max(0.0001, d);
      if (dot < (it.cone ?? 0.55)) continue;      // roughly a 57° cone
      const score = dot * 2 - d / it.r;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  }

  // ------------------------------------------------------------------ lights

  light(l, kind = 'practical') {
    this.lights.push({ light: l, base: l.intensity, kind });
    this.add(l);
    return l;
  }

  /** Dim or lift a whole class of light at once. */
  setLightScale(kind, k) {
    for (const rec of this.lights) {
      if (rec.kind === kind) rec.light.intensity = rec.base * k;
    }
  }

  // ------------------------------------------------------------------ cameras

  /**
   * Where a hidden camera is and what it points at.
   * @param {string} id       matches a LENSES key
   * @param {object} pos      {x,y,z}
   * @param {object} look     {x,y,z} — usually the middle of the room
   * @param {object} o        { fov, room, num }
   */
  camSpot(id, pos, look, o = {}) {
    const rec = {
      id,
      pos: new THREE.Vector3(pos.x, pos.y, pos.z),
      look: new THREE.Vector3(look.x, look.y, look.z),
      fov: o.fov ?? 78,
      room: o.room ?? this.roomAt(pos.x, pos.z),
      num: o.num ?? 0,
      // does it track you, or is it bolted where it is? The bolted ones are
      // worse, because you walk out of frame and it does not care.
      track: o.track ?? false,
    };
    this.camSpots.set(id, rec);
    return rec;
  }

  // ------------------------------------------------------------------ collision

  /** Can a body of radius r stand with its feet at footY, centred on (x,z)? */
  blocked(x, z, footY, r = 0.28, headY = 1.75) {
    if (x < this.bounds.x0 || x > this.bounds.x1 || z < this.bounds.z0 || z > this.bounds.z1) return true;
    for (const c of this.colliders) {
      if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;
      // you can step over anything shin high, and duck under anything above
      // your head — everything else stops you
      if (c.y1 <= footY + 0.26) continue;
      if (c.y0 >= footY + headY) continue;
      return true;
    }
    return false;
  }

  /** Axis-by-axis slide, so walls guide you instead of stopping you dead. */
  move(pos, dx, dz, r = 0.28, headY = 1.75) {
    if (!this.blocked(pos.x + dx, pos.z, pos.y, r, headY)) pos.x += dx;
    else {
      for (const f of [0.5, 0.25]) {
        if (!this.blocked(pos.x + dx * f, pos.z, pos.y, r, headY)) { pos.x += dx * f; break; }
      }
    }
    if (!this.blocked(pos.x, pos.z + dz, pos.y, r, headY)) pos.z += dz;
    else {
      for (const f of [0.5, 0.25]) {
        if (!this.blocked(pos.x, pos.z + dz * f, pos.y, r, headY)) { pos.z += dz * f; break; }
      }
    }
  }

  /** Is there anything between two points? Used to keep VAL out of sight. */
  raySolid(from, to, step = 0.25) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = from.x + dx * t, z = from.z + dz * t;
      for (const c of this.colliders) {
        if (c.tag !== 'wall') continue;
        if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 > 1.4) return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ frame

  onTick(fn) { this.ticks.push(fn); }

  update(dt, game) {
    for (const fn of this.ticks) fn(dt, game);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        // shared recipe materials are cached and reused; the one-off ones
        // props mint for themselves are not, and those are the ones to free
        if (o.material && o.material.userData.tile === undefined) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      }
    });
    this.group.parent?.remove(this.group);
    this.colliders.length = 0;
    this.interacts.length = 0;
    this.ticks.length = 0;
    this.camSpots.clear();
  }
}

// ---------------------------------------------------------------- shared bits

/** A door leaf in a frame. Returns the leaf so it can swing. */
export function doorLeaf(world, x, z, o = {}) {
  const w = o.w ?? 0.78;
  const h = o.h ?? 2.02;
  const pivot = new THREE.Group();
  pivot.position.set(x, 0, z);
  pivot.rotation.y = o.rotY ?? 0;

  const geo = new THREE.BoxGeometry(w, h, 0.045);
  scaleBoxUVs(geo, w, h, 0.045, tileScale('gloss'));
  const leaf = new THREE.Mesh(geo, material(o.mat || 'gloss'));
  leaf.position.set(w / 2, h / 2, 0);
  leaf.castShadow = true;
  pivot.add(leaf);

  // two panels routed into it, like every internal door of the period
  const panel = simple(0x000000, { opacity: 0.14, rough: 1 });
  [[0.62, 0.32], [1.42, 0.32]].forEach(([py, ph]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, ph, 0.008), panel);
    p.position.set(w / 2, py, 0.026);
    pivot.add(p);
  });

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 12, 10),
    simple(0xb08a44, { rough: 0.32, metal: 0.7 })
  );
  knob.position.set(w - 0.09, 1.0, 0.045);
  pivot.add(knob);

  world.add(pivot);
  return { pivot, leaf, open: 0, w };
}

/** Skirting board along a run. Purely so the corners look inhabited. */
export function skirting(world, x0, z0, x1, z1) {
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  if (len < 0.05) return;
  world.box(horiz ? len : 0.026, 0.11, horiz ? 0.026 : len, 'gloss',
    (x0 + x1) / 2, 0.055, (z0 + z1) / 2, { solid: false });
}
