// PORT HALCYON — the districts: what stands in the world besides the roads.
// Each district has a pack (its own art: buildings, landmarks, props,
// trees) chosen by its style. Packs plan once at load (Planner: lots along
// the roads, landmarks, lamps, solid things, the far skyline), scatter per
// cell on demand (Scatter: trees, rocks), and build a cell's share of meshes
// when the streamer asks (Builder). Everything solid comes from the plans,
// never the meshes, so it's there for physics wherever a car is.
//
// A pack: { id, plan(P)?, scatter(S)?, build(B, items)* } — see planner.js
// and builder.js for what P, S and B offer. Packs live in this folder (one
// file per pack); PACKS below says which district style uses which.
import { DISTRICTS, GARAGE } from '../map/base.js';
import { bbox } from '../geom.js';
import { CELL } from '../terrain.js';
import { makeNoise2D, hashString } from '../../core/util.js';
import { Occ, RESERVED } from './occ.js';
import { Planner, Scatter } from './planner.js';
import { Builder } from './builder.js';
import { makeGeneric } from './generic.js';
import downtown from './downtown.js';
import uptown from './uptown.js';
import oldtown from './oldtown.js';
import chinatown from './chinatown.js';
import works from './works.js';
import eastside from './eastside.js';
import harbor from './harbor.js';
import shipyard from './shipyard.js';
import pier9 from './pier9.js';
import point from './point.js';
import bayshore from './bayshore.js';
import desert from './desert.js';
import redrock from './redrock.js';
import ghosttown from './ghosttown.js';
import drylake from './drylake.js';
import kaido from './kaido.js';
import summit from './summit.js';
import ridgeline from './ridgeline.js';
import wilds from './wilds.js';
import lake from './lake.js';
import ironworks from './ironworks.js';
import redwood from './redwood.js';
import crestwood from './crestwood.js';
import farmland from './farmland.js';

/** district style → its pack (one file each in this folder). */
export const PACKS = {
  downtown, uptown, oldtown, chinatown, works, eastside, harbor, shipyard, pier9, point, bayshore, desert, redrock, ghosttown, drylake, kaido, summit, ridgeline, wilds, lake, ironworks, redwood, crestwood, farmland,
};
const FALLBACK = makeGeneric('none');

const IDX = 32;
const key32 = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const cellKey = (cx, cz) => `${cx},${cz}`;

export class Districts {
  constructor(net, terrain) {
    this.net = net;
    this.terrain = terrain;
    this.list = DISTRICTS.map((d) => ({ ...d, box: bbox(d.poly) }));
    this.byId = new Map(this.list.map((d) => [d.id, d]));
    this.occ = new Occ();
    this.items = new Map();       // cellKey → [item]
    this.colliders = new Map();   // key32 → [collider]
    this.lampGrid = new Map();    // key32 → [lamp]
    this.cellLamps = new Map();   // cellKey → [lamp] (standing in the cell)
    this.farList = [];
    this.landmarks = [];
    this.scatters = new Map();    // `${cellKey}` → { items, colliders } (all districts in the cell)
    this.noises = new Map();
    this.planned = false;
    this.stats = { planMs: {}, items: 0, colliders: 0, lamps: 0, far: 0 };
  }

  packFor(d) { return PACKS[d.style] || FALLBACK; }

  noiseFor(id) {
    let n = this.noises.get(id);
    if (!n) { n = makeNoise2D(hashString('dn:' + id) % 100000); this.noises.set(id, n); }
    return n;
  }

  // ---------------------------------------------------------------- planning

  /** Plan everything (a generator: yields between steps so it can run in slices). */
  *planAll() {
    let t = performance.now();
    this.occ.addRoads(this.net, 3);
    // your garage's lot is yours (the building stands behind where the car starts)
    const gx = GARAGE.x - Math.sin(GARAGE.heading) * 8, gz = GARAGE.z - Math.cos(GARAGE.heading) * 8;
    this.occ.markRect(gx, gz, 26, 36, GARAGE.heading, RESERVED);
    this.stats.planMs.roads = performance.now() - t;
    yield;
    for (const d of this.list) {
      const pack = this.packFor(d);
      if (!pack.plan) continue;
      t = performance.now();
      const P = new Planner(this, d, pack);
      // (one district's mistake mustn't take the world down with it)
      try {
        const r = pack.plan(P);
        if (r && r[Symbol.iterator]) yield* r;
      } catch (e) { console.error(`district ${d.id}: plan failed`, e); }
      this.stats.planMs[d.id] = performance.now() - t;
      yield;
    }
    this.planned = true;
  }

  /** Plan everything now (headless tools, tests). */
  planNow() {
    for (const _ of this.planAll()) void _;
    return this;
  }

  addItem(item) {
    const k = cellKey(Math.floor(item.x / CELL), Math.floor(item.z / CELL));
    let a = this.items.get(k);
    if (!a) { a = []; this.items.set(k, a); }
    a.push(item);
    this.stats.items++;
  }

  addCollider(c) {
    const r = c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz);
    c.reach = r;
    for (let cx = Math.floor((c.x - r) / IDX); cx <= Math.floor((c.x + r) / IDX); cx++) {
      for (let cz = Math.floor((c.z - r) / IDX); cz <= Math.floor((c.z + r) / IDX); cz++) {
        const k = key32(cx, cz);
        let a = this.colliders.get(k);
        if (!a) { a = []; this.colliders.set(k, a); }
        a.push(c);
      }
    }
    this.stats.colliders++;
  }

  addLamp(L) {
    const k = key32(Math.floor(L.hx / IDX), Math.floor(L.hz / IDX));
    let a = this.lampGrid.get(k);
    if (!a) { a = []; this.lampGrid.set(k, a); }
    a.push(L);
    const ck = cellKey(Math.floor(L.x / CELL), Math.floor(L.z / CELL));
    let b = this.cellLamps.get(ck);
    if (!b) { b = []; this.cellLamps.set(ck, b); }
    b.push(L);
    this.stats.lamps++;
  }

  addFar(f) { this.farList.push(f); this.stats.far++; }

  // ---------------------------------------------------------------- scatter

  /** The scatter (trees, rocks…) of one cell, every district in it (cached). */
  scatterCell(cx, cz) {
    const k = cellKey(cx, cz);
    let s = this.scatters.get(k);
    if (s) { s.used = ++this._tick || (this._tick = 1); return s; }
    s = { items: [], colliders: [], used: ++this._tick || (this._tick = 1) };
    const x0 = cx * CELL, z0 = cz * CELL;
    for (const d of this.list) {
      const b = d.box;
      if (b.x1 < x0 || b.x0 > x0 + CELL || b.z1 < z0 || b.z0 > z0 + CELL) continue;
      const pack = this.packFor(d);
      if (!pack.scatter) continue;
      const S = new Scatter(this, d, pack, cx, cz);
      try { pack.scatter(S); } catch (e) { console.error(`district ${d.id}: scatter ${cx},${cz} failed`, e); continue; }
      s.items.push(...S.items);
      s.colliders.push(...S.colliders);
    }
    for (const c of s.colliders) if (c.reach === undefined) c.reach = c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz);
    this.scatters.set(k, s);
    if (this.scatters.size > 160) {
      const arr = [...this.scatters.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < 40; i++) this.scatters.delete(arr[i][0]);
    }
    return s;
  }

  // ---------------------------------------------------------------- queries

  /** Solid things near (x, z): plan colliders and the scatter's. */
  collidersNear(x, z, r, out = []) {
    out.length = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let cx = Math.floor((x - r) / IDX); cx <= Math.floor((x + r) / IDX); cx++) {
      for (let cz = Math.floor((z - r) / IDX); cz <= Math.floor((z + r) / IDX); cz++) {
        const a = this.colliders.get(key32(cx, cz));
        if (!a) continue;
        for (const c of a) {
          if (seen.has(c)) continue;
          seen.add(c);
          if (Math.abs(c.x - x) > r + c.reach || Math.abs(c.z - z) > r + c.reach) continue;
          out.push(c);
        }
      }
    }
    // the scatter of the cells under the query
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const s = this.scatterCell(cx, cz);
        for (const c of s.colliders) {
          if (Math.abs(c.x - x) > r + c.reach || Math.abs(c.z - z) > r + c.reach) continue;
          out.push(c);
        }
      }
    }
    return out;
  }

  /** District lamps within a box (for baking a cell's light). */
  lampsInBox(x0, z0, x1, z1) {
    const out = [];
    for (let cx = Math.floor(x0 / IDX); cx <= Math.floor(x1 / IDX); cx++) {
      for (let cz = Math.floor(z0 / IDX); cz <= Math.floor(z1 / IDX); cz++) {
        const a = this.lampGrid.get(key32(cx, cz));
        if (!a) continue;
        for (const L of a) if (L.hx >= x0 && L.hx <= x1 && L.hz >= z0 && L.hz <= z1) out.push(L);
      }
    }
    return out;
  }

  /** Every district lamp (the far layer's points of light). */
  farLamps() {
    const out = [];
    for (const a of this.cellLamps.values()) out.push(...a);
    return out;
  }

  // ---------------------------------------------------------------- building

  /**
   * Build the districts' share of a cell (generator). out: { batch,
   * nearBatch, group, colliders, lamps, anims }.
   */
  *buildCell(cx, cz, out) {
    const k = cellKey(cx, cz);
    const planItems = this.items.get(k) || [];
    const sc = this.scatterCell(cx, cz);
    // by pack
    const byPack = new Map();
    for (const it of [...planItems, ...sc.items]) {
      let a = byPack.get(it.pack);
      if (!a) { a = []; byPack.set(it.pack, a); }
      a.push(it);
    }
    for (const [pid, items] of byPack) {
      const pack = this.packById(pid);
      if (!pack?.build) continue;
      const B = new Builder(this, cx, cz, pack, out);
      try {
        const it = pack.build(B, items);
        if (it && it[Symbol.iterator]) {
          // step it by hand so an error part way loses only this pack's share
          for (let r = it.next(); !r.done; r = it.next()) yield;
        }
      } catch (e) { console.error(`pack ${pid}: building ${cx},${cz} failed`, e); }
      yield;
    }
    out.lamps.push(...(this.cellLamps.get(k) || []));
  }

  /** Make every pack's materials now (packs with a warm(B) say what they use). */
  *warm() {
    const out = { batch: null, nearBatch: null, group: null, colliders: [], lamps: [], anims: [] };
    for (const pack of new Set([...Object.values(PACKS), FALLBACK])) {
      if (!pack.warm) continue;
      const r = pack.warm(new Builder(this, 0, 0, pack, out));
      if (r && r[Symbol.iterator]) yield* r;
      yield;
    }
  }

  packById(id) {
    if (!this._packIds) {
      this._packIds = new Map([[FALLBACK.id, FALLBACK]]);
      for (const p of Object.values(PACKS)) this._packIds.set(p.id, p);
    }
    return this._packIds.get(id);
  }
}
