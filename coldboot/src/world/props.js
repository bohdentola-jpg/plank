// Reusable props for Port Zarya, real-world scale in metres, base at y = 0,
// facing +Z. Each prop is a function that adds geometry to a GeoBuilder in its
// current frame, so buildings merge yard props into their own draw calls:
//
//   addProp(builder, 'fuelDrum', { rust: 0.5 }, rng)       // merge into a building
//   makeProp('sodiumLight', { seed: 3 }) → THREE.Group      // standalone, shared geometry
//   powerLine(poleA, poleB, { sag }) → THREE.Group          // wires between two pole tops
//
// Groups from makeProp share cached geometries and materials (cheap to place
// many times); group.userData.lights / .cameras list light sources and security
// cameras in the prop's local frame.
import * as THREE from 'three';
import { GeoBuilder, groupFromGeometries, catenary, rgb, weather } from './geom.js';
import { getSignMaterial } from './materials.js';
import { makeRng, hashString } from '../core/util.js';

const PI = Math.PI, HP = Math.PI / 2;

export const PROP_TYPES = [
  'fuelDrum', 'oilTank', 'propane', 'snowmobile', 'dogSled', 'crabPot', 'net', 'pallet', 'crate', 'tote', 'woodpile',
  'satDish', 'powerPole', 'sodiumLight', 'smartLight', 'mailboxes', 'streetSign', 'stopSign', 'bench', 'picnicTable',
  'dumpster', 'boatTrailer', 'skiff', 'atv', 'stovepipe', 'fishRack', 'fenceWood', 'fenceChain', 'boardwalk',
  'orthodoxCross', 'graveHouse', 'snowbank', 'trashCan', 'phoneBooth', 'tires', 'fuelPump', 'bollard', 'fishingBoat',
];

const P = {};

/** Add a prop into builder b at its current frame. Returns {lights, cameras} (building-space). */
export function addProp(b, type, o = {}, rng = null) {
  const fn = P[type];
  if (!fn) throw new Error('unknown prop ' + type);
  const r = rng || makeRng(hashString(type + (o.seed ?? 0)));
  const out = { lights: [], cameras: [] };
  fn(b, o, r, out);
  return out;
}

const cache = new Map();
/** Standalone prop group (geometry cached per type + options). */
export function makeProp(type, o = {}) {
  const key = type + JSON.stringify(o);
  let c = cache.get(key);
  if (!c) {
    const b = new GeoBuilder();
    const out = addProp(b, type, o, makeRng(hashString(key)));
    c = { geos: b.geometries(), mats: b.materials, out, stats: b.stats() };
    cache.set(key, c);
  }
  const g = groupFromGeometries(c.geos, { materials: c.mats, snow: o.snow !== false });
  g.name = type;
  g.userData = { type, lights: c.out.lights.map((l) => ({ ...l })), cameras: c.out.cameras.map((x) => ({ ...x })), stats: c.stats };
  return g;
}

/**
 * Wires between two pole tops (world or parent space). a, b: {x, y, z, rot}
 * (pole base positions + yaw; the cross-arm insulators are derived), o.sag.
 */
export function powerLine(a, b2, o = {}) {
  const b = new GeoBuilder();
  const h = o.height ?? 10.6;
  const arm = (p, k) => {
    const off = [-1.0, 0, 1.0][k];
    const y = h + (k === 1 ? 0.35 : 0.12);
    return [p.x + Math.cos(p.rot || 0) * off, (p.y || 0) + y, p.z - Math.sin(p.rot || 0) * off];
  };
  for (let k = 0; k < 3; k++) {
    const pa = arm(a, k), pb = arm(b2, k);
    const len = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]);
    b.tube('rubber', catenary(pa, pb, o.sag ?? Math.max(0.3, len * 0.025), 10), 0.012, { segs: 3, color: '#151515' });
  }
  const g = groupFromGeometries(b.geometries(), { snow: false, castShadow: false });
  g.name = 'powerLine';
  return g;
}

// ------------------------------------------------------------------ helpers

function light(b, out, x, y, z, color, intensity, distance) {
  const p = b.P(x, y, z);
  out.lights.push({ x: p[0], y: p[1], z: p[2], color, intensity, distance });
}

/** Stadium (obround) cross-section shape, width w, height h. */
function stadium(w, h) {
  const s = new THREE.Shape();
  const r = w / 2, hh = h / 2 - r;
  s.moveTo(-r, -hh);
  s.lineTo(-r, hh);
  s.absarc(0, hh, r, PI, 0, true);
  s.lineTo(r, -hh);
  s.absarc(0, -hh, r, 0, -PI, true);
  return s;
}

/**
 * Boat hull along +Z (bow at +L/2), keel at y = 0. o: {L, B, D, sheer, deadrise,
 * color, bottom, open (show inside), stripe}
 */
export function hull(b, o) {
  const L = o.L, B = o.B, D = o.D;
  const n = 12;
  const sheer = o.sheer ?? D * 0.35;
  const dr = o.deadrise ?? 0.25;
  const wl = o.waterline ?? D * 0.42;
  const st = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 stern → 1 bow
    const bow = t > 0.55 ? (t - 0.55) / 0.45 : 0;
    const hb = (B / 2) * (t < 0.55 ? 0.9 + 0.1 * Math.min(1, t / 0.3) : Math.sqrt(Math.max(0, 1 - bow * bow)) ** 0.9);
    const yk = bow > 0 ? bow * bow * D * 0.75 : 0;
    const yg = D + sheer * t * t;
    const yc = yk + hb * 0.8 * dr;
    st.push({ z: -L / 2 + t * L, hb, yk, yc: Math.min(yc, yg - 0.05), yg });
  }
  const hc = o.color || '#e8e4dc', bc = o.bottom || '#7a2a22';
  for (let i = 0; i < n; i++) {
    const a = st[i], c = st[i + 1];
    for (const s of [1, -1]) {
      // bottom panel keel→chine
      b.poly('paint_gloss', [[0, a.yk, a.z], [0, c.yk, c.z], [s * c.hb * 0.8, c.yc, c.z], [s * a.hb * 0.8, a.yc, a.z]], { color: bc, want: [s * 0.3, -1, 0] });
      // side: chine→waterline (bottom paint), waterline→gunwale (hull colour)
      const aw = Math.max(a.yc, Math.min(wl, a.yg)), cw = Math.max(c.yc, Math.min(wl, c.yg));
      const ax = (y) => s * (a.hb * 0.8 + (a.hb * 0.2) * Math.min(1, (y - a.yc) / Math.max(0.01, a.yg - a.yc)));
      const cx = (y) => s * (c.hb * 0.8 + (c.hb * 0.2) * Math.min(1, (y - c.yc) / Math.max(0.01, c.yg - c.yc)));
      if (aw > a.yc + 0.01 || cw > c.yc + 0.01) b.poly('paint_gloss', [[s * a.hb * 0.8, a.yc, a.z], [s * c.hb * 0.8, c.yc, c.z], [cx(cw), cw, c.z], [ax(aw), aw, a.z]], { color: bc, want: [s, 0, 0] });
      b.poly('paint_gloss', [[ax(aw), aw, a.z], [cx(cw), cw, c.z], [cx(cw + 0.07), Math.min(cw + 0.07, c.yg), c.z], [ax(aw + 0.07), Math.min(aw + 0.07, a.yg), a.z]], { color: o.stripe || '#1a2a3a', want: [s, 0, 0] });
      b.poly('paint_gloss', [[ax(aw + 0.07), Math.min(aw + 0.07, a.yg), a.z], [cx(cw + 0.07), Math.min(cw + 0.07, c.yg), c.z], [s * c.hb, c.yg, c.z], [s * a.hb, a.yg, a.z]], { color: hc, want: [s, 0, 0] });
      if (o.open) {
        b.poly('paint', [[s * a.hb * 0.97, a.yg, a.z], [s * c.hb * 0.97, c.yg, c.z], [s * c.hb * 0.75, c.yc + 0.05, c.z], [s * a.hb * 0.75, a.yc + 0.05, a.z]], { color: o.inside || '#9aa0a2', want: [-s, 0.3, 0] });
      }
      // rub rail
      b.beam('paint', [s * (a.hb + 0.02), a.yg - 0.03, a.z], [s * (c.hb + 0.02), c.yg - 0.03, c.z], 0.05, 0.07, { color: o.rail || '#2a2a2a' });
    }
    if (o.open) b.poly('paint', [[-a.hb * 0.75, a.yc + 0.05, a.z], [a.hb * 0.75, a.yc + 0.05, a.z], [c.hb * 0.75, c.yc + 0.05, c.z], [-c.hb * 0.75, c.yc + 0.05, c.z]], { color: o.inside || '#9aa0a2', want: [0, 1, 0] });
  }
  // transom
  const t0 = st[0];
  b.poly('paint_gloss', [[-t0.hb, t0.yg, t0.z], [t0.hb, t0.yg, t0.z], [t0.hb * 0.8, t0.yc, t0.z], [0, t0.yk, t0.z], [-t0.hb * 0.8, t0.yc, t0.z]], { color: hc, want: [0, 0, -1] });
  if (!o.open) {
    // deck: fan of station quads at gunwale height
    for (let i = 0; i < n; i++) {
      const a = st[i], c = st[i + 1];
      b.poly(o.deckKey || 'wood_weathered', [[-a.hb, a.yg, a.z], [a.hb, a.yg, a.z], [c.hb, c.yg, c.z], [-c.hb, c.yg, c.z]], { color: o.deck || '#9a9080', want: [0, 1, 0] });
    }
  }
  return st;
}

// ------------------------------------------------------------------ props

P.fuelDrum = (b, o, r) => {
  const rusty = (o.rust || 0) > 0.4 && r() < 0.6;
  const col = o.color || ['#1f4a8a', '#8a1f1a', '#2a2a2a', '#3a6a3a', '#c8a020'][(r() * 5) | 0];
  b.push();
  if (o.tipped) b.translate(0, 0.29, 0).rotateZ(HP).translate(0, -0.44, 0);
  const k = rusty ? 'metal_rust' : 'sheet_metal';
  const c = rusty ? '#ffffff' : weather(col, (o.rust || 0) * 0.6);
  b.cyl(k, 0, 0, 0, 0.29, 0.88, { segs: 14, color: c, caps: 'b' });
  b.cyl(k, 0, 0.87, 0, 0.275, 0.01, { segs: 14, color: rgb(c, 0.85) });
  for (const y of [0.29, 0.58]) b.cyl(k, 0, y - 0.015, 0, 0.3, 0.03, { segs: 14, color: rgb(c, 0.9), caps: '' });
  b.cyl(k, 0, 0.84, 0, 0.3, 0.04, { segs: 14, color: rgb(c, 0.9), caps: 'b' });
  b.cyl(k, 0, 0, 0, 0.3, 0.035, { segs: 14, color: rgb(c, 0.9), caps: '' });
  b.cyl('metal', 0.16, 0.88, 0.05, 0.03, 0.015, { segs: 6, color: '#888' });
  b.pop();
};

P.oilTank = (b, o, r) => {
  const L = 1.52, w = 0.69, h = 1.12;
  const rusty = (o.rust || 0) > 0.5;
  const col = weather(o.color || '#8a2a22', (o.rust || 0) * 0.5);
  // stand
  for (const x of [-0.55, 0.55]) for (const z of [-0.25, 0.25]) b.box('metal', x, 0, z, 0.04, 0.42, 0.04, { color: '#2a2a2a' });
  for (const x of [-0.55, 0.55]) b.box('metal', x, 0.38, 0, 0.05, 0.04, 0.6, { color: '#2a2a2a' });
  b.box('concrete', 0, -0.02, 0, 1.6, 0.06, 0.8, { color: '#7a7a74' });
  // obround tank lying along x
  b.push().translate(-L / 2, 0.42 + h / 2, 0).rotateY(HP);
  b.shape(rusty ? 'metal_paint_rust' : 'sheet_metal', stadium(w, h), { depth: L, color: rusty ? weather(o.color || '#8a2a22', 0.2) : col, curveSegments: 6 });
  b.pop();
  // fill + vent + gauge
  b.cyl('galv', -0.45, 0.42 + h, 0, 0.03, 0.3, { segs: 6, color: '#9a9ea0' });
  b.cyl('galv', -0.45, 0.42 + h + 0.3, 0, 0.05, 0.05, { segs: 6, color: '#9a9ea0' });
  b.cyl('galv', 0.4, 0.42 + h, 0.1, 0.02, 0.45, { segs: 6, color: '#9a9ea0' });
  b.cyl('galv', 0.4, 0.42 + h + 0.45, 0.1, 0.06, 0.05, { segs: 6, color: '#9a9ea0', rTop: 0.02 });
  b.cyl('plastic', 0.1, 0.42 + h, -0.05, 0.05, 0.08, { segs: 8, color: '#d8d8d0' });
  // supply line valve at the bottom
  b.cyl('metal', 0.5, 0.36, 0, 0.025, 0.08, { segs: 6, color: '#b87333' });
};

P.propane = (b, o, r) => {
  const n = o.count ?? 2;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.42;
    const col = weather('#e8e8e2', (o.rust || 0) * 0.4);
    b.cyl('sheet_metal', x, 0.05, 0, 0.185, 1.02, { segs: 12, color: col });
    b.sphere('sheet_metal', x, 1.07, 0, 0.185, { phiBottom: HP, rings: 4, segs: 12, color: col });
    b.cyl('sheet_metal', x, 1.15, 0, 0.12, 0.17, { segs: 10, color: rgb(col, 0.9), caps: '' });
    b.cyl('metal', x, 1.2, 0, 0.03, 0.08, { segs: 6, color: '#b8a050' });
    b.cyl('sheet_metal', x, 0, 0, 0.17, 0.06, { segs: 10, color: '#8a8a84' });
  }
  b.beam('metal', [-(n / 2) * 0.42, 0.9, -0.2], [(n / 2) * 0.42, 0.9, -0.2], 0.02, 0.02, { color: '#5a5a5a' });
};

P.snowmobile = (b, o, r) => {
  const col = o.color || ['#b8201a', '#e8c020', '#1a1a1a', '#1a4a9a', '#2a7a3a', '#e8e8e8'][(r() * 6) | 0];
  const c = weather(col, (o.rust || 0) * 0.4);
  // skis
  for (const x of [-0.53, 0.53]) {
    b.box('plastic', x, 0.0, 0.75, 0.15, 0.03, 1.1, { color: '#151515' });
    b.beam('plastic', [x, 0.03, 1.3], [x, 0.22, 1.5], 0.15, 0.03, { color: '#151515' });
    b.beam('metal', [x, 0.05, 0.85], [x * 0.6, 0.45, 0.6], 0.04, 0.05, { color: '#2a2a2a' });
  }
  // track tunnel + track
  b.box('rubber', 0, 0.02, -0.55, 0.5, 0.32, 1.75, { color: '#121212' });
  b.box('sheet_metal', 0, 0.32, -0.55, 0.56, 0.06, 1.85, { color: '#3a3a3a' });
  // running boards
  for (const x of [-0.36, 0.36]) b.box('sheet_metal', x, 0.3, -0.35, 0.2, 0.03, 1.2, { color: '#2a2a2a' });
  // hood / body: a tapered shell
  b.push().translate(0, 0.32, 0.25);
  const hood = [[-0.42, 0, -0.35], [0.42, 0, -0.35], [0.38, 0, 0.75], [-0.38, 0, 0.75]];
  b.poly('paint_gloss', [[-0.42, 0.55, -0.35], [0.42, 0.55, -0.35], [0.3, 0.35, 0.8], [-0.3, 0.35, 0.8]], { color: c, want: [0, 1, 0.3] });
  b.poly('paint_gloss', [[-0.3, 0.35, 0.8], [0.3, 0.35, 0.8], [0.32, 0.0, 0.95], [-0.32, 0.0, 0.95]], { color: c, want: [0, 0.3, 1] });
  for (const s of [-1, 1]) {
    b.poly('paint_gloss', [[s * 0.42, 0, -0.35], [s * 0.42, 0.55, -0.35], [s * 0.3, 0.35, 0.8], [s * 0.32, 0.0, 0.95], [s * 0.42, 0, 0.6]].map((p) => p), { color: rgb(c, 0.85), want: [s, 0, 0] });
  }
  b.poly('paint_gloss', [[-0.42, 0, -0.35], [-0.42, 0.55, -0.35], [0.42, 0.55, -0.35], [0.42, 0, -0.35]], { color: rgb(c, 0.7), want: [0, 0, -1] });
  void hood;
  // headlight
  b.poly('neon', [[-0.12, 0.3, 0.82], [0.12, 0.3, 0.82], [0.12, 0.38, 0.79], [-0.12, 0.38, 0.79]], { color: [0.15, 0.15, 0.15], want: [0, 0.3, 1] });
  b.pop();
  // windshield
  b.poly('glass_dark', [[-0.32, 0.87, -0.05], [0.32, 0.87, -0.05], [0.25, 1.2, -0.22], [-0.25, 1.2, -0.22]], { color: [0, 0, 0], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0.5, 1] });
  b.poly('glass_dark', [[0.32, 0.87, -0.05], [-0.32, 0.87, -0.05], [-0.25, 1.2, -0.22], [0.25, 1.2, -0.22]], { color: [0, 0, 0], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, -0.5, -1] });
  // seat
  b.box('leather', 0, 0.38, -0.75, 0.4, 0.22, 1.05, { color: '#151515' });
  b.box('sheet_metal', 0, 0.38, -1.38, 0.5, 0.18, 0.3, { color: rgb(c, 0.8) });
  // handlebar
  b.beam('metal', [0, 0.85, -0.12], [0, 1.0, -0.25], 0.04, 0.04, { color: '#222' });
  b.beam('metal', [-0.38, 1.0, -0.28], [0.38, 1.0, -0.28], 0.03, 0.03, { color: '#222' });
  // snow flap
  b.box('rubber', 0, 0.08, -1.55, 0.5, 0.3, 0.01, { color: '#1a1a1a' });
};

P.atv = (b, o, r) => {
  const col = o.color || ['#2a5a2a', '#8a1a1a', '#3a3a3a', '#5a4a2a'][(r() * 4) | 0];
  for (const [x, z] of [[-0.52, 0.62], [0.52, 0.62], [-0.52, -0.62], [0.52, -0.62]]) {
    b.push().translate(x, 0.3, z).rotateZ(HP);
    b.cyl('rubber', 0, -0.13, 0, 0.3, 0.26, { segs: 12, color: '#161616' });
    b.cyl('metal', 0, x > 0 ? 0.131 : -0.141, 0, 0.14, 0.01, { segs: 8, color: '#8a8a84' });
    b.pop();
  }
  b.box('metal', 0, 0.28, 0, 0.5, 0.25, 1.3, { color: '#222' });
  b.box('paint_gloss', 0, 0.55, 0.62, 1.1, 0.12, 0.65, { color: col });
  b.box('paint_gloss', 0, 0.55, -0.62, 1.1, 0.12, 0.65, { color: col });
  b.box('paint_gloss', 0, 0.5, 0.05, 0.5, 0.35, 0.6, { color: rgb(col, 0.8) });
  b.box('leather', 0, 0.78, -0.25, 0.38, 0.12, 0.7, { color: '#141414' });
  b.box('metal', 0, 0.68, 0.7, 0.9, 0.04, 0.5, { color: '#2a2a2a' });
  b.box('metal', 0, 0.68, -0.75, 0.9, 0.04, 0.45, { color: '#2a2a2a' });
  b.beam('metal', [0, 0.75, 0.25], [0, 1.0, 0.15], 0.04, 0.04, { color: '#222' });
  b.beam('metal', [-0.4, 1.02, 0.12], [0.4, 1.02, 0.12], 0.03, 0.03, { color: '#222' });
};

P.dogSled = (b, o, r) => {
  const c = '#9a7a54';
  for (const x of [-0.28, 0.28]) {
    b.box('wood_raw', x, 0, -0.3, 0.05, 0.04, 2.0, { color: c });
    b.beam('wood_raw', [x, 0.02, 0.7], [x, 0.3, 1.05], 0.05, 0.04, { color: c });
    for (const z of [-1.1, -0.5, 0.1, 0.6]) b.box('wood_raw', x, 0.04, z, 0.04, 0.32, 0.04, { color: c });
    b.beam('wood_raw', [x, 0.36, -1.2], [x, 0.36, 0.9], 0.04, 0.03, { color: c });
    b.beam('wood_raw', [x, 0.04, -1.2], [x, 1.0, -1.35], 0.04, 0.04, { color: c });
  }
  for (let i = 0; i < 9; i++) b.box('wood_raw', 0, 0.36, -1.1 + i * 0.22, 0.6, 0.02, 0.1, { color: '#b89a74' });
  b.beam('wood_raw', [-0.3, 1.0, -1.35], [0.3, 1.0, -1.35], 0.04, 0.04, { color: c });
  b.beam('wood_raw', [-0.28, 0.3, 1.05], [0.28, 0.3, 1.05], 0.04, 0.04, { color: c });
  b.box('fabric', 0, 0.38, -0.3, 0.5, 0.15, 1.2, { color: '#3a4a6a' });
};

P.crabPot = (b, o, r) => {
  // Bering Sea king crab pot: 2.1 × 2.1 × 0.86 m steel frame with webbing
  const S = o.size ?? 2.1, H = 0.86;
  const fc = o.color || '#5a5a58';
  const web = o.web || ['#c86a1a', '#1a5a8a', '#3a7a3a'][(r() * 3) | 0];
  const h = S / 2;
  for (const y of [0.02, H - 0.02]) {
    b.beam('metal', [-h, y, -h], [h, y, -h], 0.05, 0.05, { color: fc });
    b.beam('metal', [-h, y, h], [h, y, h], 0.05, 0.05, { color: fc });
    b.beam('metal', [-h, y, -h], [-h, y, h], 0.05, 0.05, { color: fc });
    b.beam('metal', [h, y, -h], [h, y, h], 0.05, 0.05, { color: fc });
  }
  for (const x of [-h, h]) for (const z of [-h, h]) b.box('metal', x, 0, z, 0.05, H, 0.05, { color: fc });
  // webbing: sparse cords on each face (reads as mesh at distance)
  const cords = 7;
  for (let i = 1; i < cords; i++) {
    const t = -h + (S * i) / cords;
    for (const z of [-h, h]) b.beam('fabric', [t, 0.03, z], [t, H - 0.03, z], 0.012, 0.012, { color: web });
    for (const x of [-h, h]) b.beam('fabric', [x, 0.03, t], [x, H - 0.03, t], 0.012, 0.012, { color: web });
    b.beam('fabric', [t, H - 0.02, -h], [t, H - 0.02, h], 0.012, 0.012, { color: web });
    b.beam('fabric', [-h, H - 0.02, t], [h, H - 0.02, t], 0.012, 0.012, { color: web });
  }
  for (const y of [H * 0.33, H * 0.66]) {
    for (const z of [-h, h]) b.beam('fabric', [-h, y, z], [h, y, z], 0.012, 0.012, { color: web });
    for (const x of [-h, h]) b.beam('fabric', [x, y, -h], [x, y, h], 0.012, 0.012, { color: web });
  }
  // tunnel eyes + buoy
  b.box('plastic', 0, H * 0.3, h, 0.6, 0.3, 0.03, { color: '#1a1a1a' });
  if (r() < 0.5) b.sphere('plastic', h - 0.3, H + 0.22, h - 0.3, 0.22, { color: '#d84a1a', rings: 5, segs: 10 });
};

P.net = (b, o, r) => {
  const col = o.color || ['#3a6a4a', '#2a4a6a', '#6a5a3a'][(r() * 3) | 0];
  const prof = [[1.3, 0], [1.25, 0.12], [1.0, 0.32], [0.6, 0.48], [0.2, 0.55], [0, 0.56]];
  b.push().scale(1, 1, 0.7);
  b.lathe('fabric', 0, 0, 0, prof, { segs: 14, color: col });
  b.pop();
  for (let i = 0; i < 10; i++) {
    const a = r() * PI * 2, d = 0.3 + r() * 0.9;
    b.cyl('plastic', Math.cos(a) * d, 0.5 * (1 - d / 1.3) + 0.03, Math.sin(a) * d * 0.7, 0.06, 0.12, { segs: 6, color: '#e8c020' });
  }
};

P.pallet = (b, o, r) => {
  const c = o.color || weather('#b89a74', 0.3 + r() * 0.5);
  for (let i = 0; i < 7; i++) b.box('wood_raw', -0.55 + i * (1.1 / 6), 0.12, 0, 0.1, 0.022, 1.2, { color: rgb(c, 0.9 + r() * 0.2), ry: HP * 0 });
  for (const x of [-0.5, 0, 0.5]) b.box('wood_raw', x, 0.022, 0, 0.1, 0.1, 1.2, { color: rgb(c, 0.8) });
  for (const z of [-0.55, 0, 0.55]) b.box('wood_raw', 0, 0, z, 1.0, 0.022, 0.1, { color: c });
};

P.crate = (b, o, r) => {
  const w = o.w ?? 1.0, h = o.h ?? 0.7, d = o.d ?? 0.7;
  const c = o.color || weather('#b89a74', r() * 0.6);
  b.box('wood_raw', 0, 0, 0, w, h, d, { color: c });
  for (const s of [-1, 1]) {
    b.box('wood_raw', 0, 0.04, s * (d / 2 + 0.01), w + 0.02, 0.08, 0.02, { color: rgb(c, 0.85) });
    b.box('wood_raw', 0, h - 0.12, s * (d / 2 + 0.01), w + 0.02, 0.08, 0.02, { color: rgb(c, 0.85) });
    b.beam('wood_raw', [-w / 2 + 0.05, 0.1, s * (d / 2 + 0.012)], [w / 2 - 0.05, h - 0.12, s * (d / 2 + 0.012)], 0.08, 0.02, { color: rgb(c, 0.85) });
  }
};

P.tote = (b, o, r) => {
  const col = o.color || ['#2a5a9a', '#d8d8d0', '#c8401a'][(r() * 3) | 0];
  b.box('plastic', 0, 0.1, 0, 1.2, 0.85, 1.0, { color: col });
  b.box('plastic', 0, 0.95, 0, 1.24, 0.06, 1.04, { color: rgb(col, 0.85) });
  for (const x of [-0.45, 0.45]) b.box('plastic', x, 0, 0, 0.15, 0.1, 1.0, { color: rgb(col, 0.7) });
};

P.woodpile = (b, o, r) => {
  const L = o.len ?? 2.4, H = o.h ?? 1.2;
  const rows = Math.round(H / 0.15), cols = Math.round(L / 0.16);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (j === rows - 1 && r() < 0.3) continue;
      const x = -L / 2 + (i + 0.5 + (j % 2) * 0.5) * (L / cols);
      if (x > L / 2 - 0.05) continue;
      const rr = 0.065 + r() * 0.025;
      b.push().translate(x, 0.08 + j * 0.145 + rr, 0).rotateX(HP).rotateY(r() * 3);
      b.cyl('wood_raw', 0, -0.25, 0, rr, 0.5 + r() * 0.08, { segs: 5, color: r() < 0.5 ? '#c8a478' : '#a8845c', smooth: false, capUvScale: [0.2, 0.2] });
      b.pop();
    }
  }
  // end posts + stringers + a tin cover
  for (const x of [-L / 2 - 0.05, L / 2 + 0.05]) b.box('wood_raw', x, 0, 0, 0.08, H + 0.15, 0.08, { color: '#6a5a48' });
  b.box('wood_raw', 0, 0, -0.15, L + 0.2, 0.08, 0.08, { color: '#6a5a48' });
  b.box('wood_raw', 0, 0, 0.15, L + 0.2, 0.08, 0.08, { color: '#6a5a48' });
  if (o.cover !== false) b.box(r() < 0.5 ? 'metal_corr_rust' : 'metal_corr', 0, H + 0.15, 0, L + 0.4, 0.03, 0.8, { color: '#ffffff', rx: 0.08 });
};

P.satDish = (b, o, r) => {
  const s = o.size ?? 0.8;
  const big = s > 1.6;
  if (o.mount === 'wall') {
    b.box('metal', 0, 0, 0.03, 0.12, 0.3, 0.06, { color: '#8a8a84' });
    b.beam('metal', [0, 0.1, 0.05], [0, 0.18, 0.35], 0.04, 0.04, { color: '#8a8a84' });
  } else {
    b.box('concrete', 0, 0, 0, big ? 1.0 : 0.4, 0.15, big ? 1.0 : 0.4, { color: '#8a8a84' });
    b.cyl('metal', 0, 0, 0, big ? 0.1 : 0.04, big ? 1.8 : 1.3, { segs: 8, color: '#8a8a84' });
  }
  const y = o.mount === 'wall' ? 0.2 : big ? 1.9 : 1.3;
  const z = o.mount === 'wall' ? 0.38 : 0.05;
  b.push().translate(0, y, z).rotateX(-1.1 + (big ? 0.4 : 0.15));
  // dish (concave toward +y after rotation)
  const prof = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; prof.push([t * s / 2, t * t * s * 0.12]); }
  b.lathe(big ? 'galv' : 'sheet_metal', 0, 0, 0, prof, { segs: 16, color: big ? '#b8bcbe' : '#d8d8d4' });
  b.lathe(big ? 'galv' : 'sheet_metal', 0, -0.006, 0, prof.slice().reverse(), { segs: 16, color: big ? '#9a9ea0' : '#c8c8c4' });
  // LNB arm
  b.beam('metal', [0, 0, -s * 0.45], [0, s * 0.42, 0], 0.025, 0.025, { color: '#5a5a5a' });
  b.box('plastic', 0, s * 0.42, 0, 0.06, 0.1, 0.06, { color: '#2a2a2a' });
  if (big) for (const a of [0, 2.1, 4.2]) b.beam('metal', [Math.cos(a) * s * 0.45, s * 0.05, Math.sin(a) * s * 0.45], [0, s * 0.45, 0], 0.02, 0.02, { color: '#7a7a7a' });
  b.pop();
};

P.powerPole = (b, o, r, out) => {
  const h = o.height ?? 10.6;
  const wood = weather('#4a3a2a', 0.3 + r() * 0.3);
  b.cyl('wood_raw', 0, -0.3, 0, 0.16, h + 0.3, { rTop: 0.11, segs: 10, color: wood });
  b.cyl('wood_raw', 0, h, 0, 0.11, 0.04, { segs: 10, color: '#3a3a3a' });
  // cross-arm with 3 insulators
  b.box('wood_raw', 0, h - 0.35, 0.14, 2.4, 0.09, 0.11, { color: wood });
  for (const x of [-1.0, 1.0]) {
    b.beam('metal', [0, h - 0.95, 0.12], [x * 0.7, h - 0.36, 0.12], 0.025, 0.006, { color: '#5a5a5a' });
    b.cyl('glass_dark', x, h - 0.26, 0.14, 0.05, 0.14, { segs: 8, rTop: 0.03, color: '#2a6a4a' });
  }
  b.cyl('glass_dark', 0, h + 0.04, 0, 0.05, 0.16, { segs: 8, rTop: 0.03, color: '#2a6a4a' });
  // pole steps + tag
  for (let i = 0; i < 8; i++) b.cylBetween('metal', [0, 2.6 + i * 0.45, 0], [((i % 2) * 2 - 1) * 0.3, 2.6 + i * 0.45, 0], 0.012, { segs: 4, color: '#5a5a5a' });
  b.box('sheet_metal', 0, 1.6, 0.165, 0.08, 0.12, 0.01, { color: '#d8c020' });
  if (o.transformer) {
    b.cyl('sheet_metal', 0, h - 2.4, -0.42, 0.26, 0.85, { segs: 12, color: '#8a9090' });
    b.cyl('sheet_metal', 0, h - 1.55, -0.42, 0.27, 0.06, { segs: 12, color: '#7a8080' });
    b.box('metal', 0, h - 2.1, -0.18, 0.1, 0.3, 0.1, { color: '#5a5a5a' });
  }
  if (o.light) {
    // old sodium cobra head on a bracket arm
    sodiumHead(b, 0, h - 1.4, 0.15, o.lightOn !== false, out, o.armLen ?? 1.8);
  }
};

function sodiumHead(b, x, y, z, on, out, arm = 1.8) {
  b.beam('metal', [x, y, z], [x, y + 0.35, z + arm], 0.06, 0.05, { color: '#7a7e80' });
  b.beam('metal', [x, y - 0.4, z], [x, y + 0.2, z + arm * 0.45], 0.03, 0.03, { color: '#7a7e80' });
  b.push().translate(x, y + 0.32, z + arm + 0.3).rotateX(0.08);
  b.push().scale(1, 0.45, 1);
  b.sphere('sheet_metal', 0, 0, 0, 0.35, { sx: 0.55, rings: 6, segs: 10, phiBottom: HP, color: '#8a8e90' });
  b.pop();
  b.cyl('sheet_metal', 0, -0.02, -0.05, 0.19, 0.04, { segs: 10, color: '#7a7e80' });
  b.push().scale(0.62, 1, 1);
  b.cyl(on ? 'neon' : 'glass_dark', 0, -0.08, 0.02, 0.27, 0.07, { segs: 12, rTop: 0.29, color: on ? [7.0, 3.4, 0.9] : '#555', caps: 'b' });
  b.pop();
  b.pop();
  if (on && out) light(b, out, x, y + 0.1, z + arm + 0.3, 0xff9a40, 3.2, 20);
}

P.sodiumLight = (b, o, r, out) => {
  // standalone old wooden pole with a cobra-head sodium lamp (warm orange)
  const h = o.height ?? 8.5;
  b.cyl('wood_raw', 0, -0.3, 0, 0.14, h + 0.3, { rTop: 0.1, segs: 9, color: weather('#4a3a2a', 0.4) });
  sodiumHead(b, 0, h - 0.8, 0.12, o.on !== false, out, o.arm ?? 1.8);
  b.box('sheet_metal', 0, 2.2, 0.15, 0.18, 0.28, 0.1, { color: '#7a7e80' });
};

P.smartLight = (b, o, r, out) => {
  // NORTHSTAR smart pole: slim white steel, flat LED head, camera dome, status LED
  const h = o.height ?? 8.0;
  b.box('concrete', 0, -0.1, 0, 0.6, 0.25, 0.6, { color: '#a8a8a4' });
  b.cyl('sheet_metal', 0, 0.15, 0, 0.13, 0.35, { segs: 12, rTop: 0.12, color: '#e8eaec' });
  b.cyl('sheet_metal', 0, 0.15, 0, 0.1, h - 0.15, { rTop: 0.065, segs: 12, color: '#eef0f2' });
  b.cyl('neon', 0, 2.4, 0, 0.105, 0.04, { segs: 12, color: [0.4, 1.6, 3.0], caps: '' }); // blue ring
  // equipment box with a little star logo
  b.box('sheet_metal', 0, 2.6, 0.08, 0.26, 0.5, 0.14, { color: '#dfe2e4' });
  b.box('neon', 0, 2.98, 0.155, 0.05, 0.05, 0.005, { color: [0.6, 2.4, 3.6] });
  // curved arm → slim LED head
  const arm = o.arm ?? 1.6;
  b.beam('sheet_metal', [0, h - 0.05, 0], [0, h + 0.18, arm * 0.5], 0.07, 0.06, { color: '#eef0f2' });
  b.beam('sheet_metal', [0, h + 0.18, arm * 0.5], [0, h + 0.22, arm], 0.07, 0.06, { color: '#eef0f2' });
  b.box('sheet_metal', 0, h + 0.14, arm + 0.25, 0.32, 0.07, 0.7, { color: '#dfe2e4' });
  b.box(o.on !== false ? 'neon' : 'glass_dark', 0, h + 0.125, arm + 0.25, 0.26, 0.01, 0.6, { color: o.on !== false ? [7.5, 8.2, 9.0] : '#666' });
  // camera dome under the arm (smoked hemisphere) + a red rec LED
  b.cyl('sheet_metal', 0, h - 0.45, arm * 0.45, 0.11, 0.08, { segs: 12, color: '#dfe2e4' });
  b.sphere('glass_dark', 0, h - 0.45, arm * 0.45, 0.1, { phiTop: HP, rings: 4, segs: 12, color: '#000' });
  b.sphere('neon', 0.07, h - 0.4, arm * 0.45 + 0.07, 0.012, { rings: 2, segs: 4, color: [6, 0.2, 0.1] });
  // little antenna
  b.cylBetween('plastic', [0, h, 0], [0, h + 0.5, 0], 0.012, { segs: 4, color: '#222' });
  if (out) {
    if (o.on !== false) light(b, out, 0, h, arm + 0.25, 0xdcefff, 3.6, 22);
    const p = b.P(0, h - 0.5, arm * 0.45);
    out.cameras.push({ x: p[0], y: p[1], z: p[2], yaw: b.yaw(), pitch: -0.55, fov: 80, range: 22 });
  }
};

P.mailboxes = (b, o, r) => {
  const col = o.color || '#c8ccc8';
  b.box('concrete', 0, -0.05, 0, 1.0, 0.1, 0.6, { color: '#9a9a94' });
  b.box('sheet_metal', 0, 0.05, 0, 0.5, 0.5, 0.35, { color: rgb(col, 0.8) });
  b.box('sheet_metal', 0, 0.55, 0, 0.82, 1.05, 0.45, { color: col });
  b.box('sheet_metal', 0, 1.6, 0, 0.9, 0.06, 0.52, { color: rgb(col, 0.85) });
  // door grid
  for (let i = 1; i < 4; i++) b.box('metal', -0.41 + i * 0.205, 0.6, 0.226, 0.008, 0.95, 0.004, { color: '#6a6a6a' });
  for (let j = 1; j < 5; j++) b.box('metal', 0, 0.6 + j * 0.19, 0.226, 0.8, 0.008, 0.004, { color: '#6a6a6a' });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) b.box('metal', -0.32 + i * 0.205, 0.68 + j * 0.19, 0.228, 0.02, 0.02, 0.006, { color: '#b8a050' });
};

function signPlate(b, key, text, w, h, colors, x, y, z, back = true) {
  const mk = 'sign:' + key;
  b.materials.set(mk, getSignMaterial(key, { kind: 'paint', w, h, ppm: 160, bg: colors.bg, border: colors.border, lines: [{ text, size: 0.62, color: colors.fg, font: 'Arial, Helvetica, sans-serif', weight: 'bold' }] }));
  b.poly(mk, [[x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0, 1] });
  if (back) b.poly(mk, [[x + w / 2, y - h / 2, z - 0.01], [x - w / 2, y - h / 2, z - 0.01], [x - w / 2, y + h / 2, z - 0.01], [x + w / 2, y + h / 2, z - 0.01]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0, -1] });
}

P.streetSign = (b, o, r) => {
  const names = o.names || ['Front St', 'Main St'];
  b.cyl('galv', 0, 0, 0, 0.03, 2.9, { segs: 6, color: '#9aa0a2' });
  names.forEach((n, i) => {
    b.push().translate(0, 2.65 - i * 0.24, 0).rotateY(i * HP);
    signPlate(b, 'street_' + n, n.toUpperCase(), 0.9, 0.18, { bg: '#1d5a32', fg: '#ffffff', border: '#ffffff' }, 0.3, 0, 0.0);
    b.pop();
  });
};

P.stopSign = (b, o, r) => {
  b.cyl('galv', 0, 0, 0, 0.03, 2.2, { segs: 6, color: '#9aa0a2' });
  const key = 'stopsign';
  b.materials.set('sign:' + key, getSignMaterial(key, {
    kind: 'paint', w: 0.76, h: 0.76, ppm: 200, transparent: true,
    draw: (g, W, H) => {
      g.clearRect(0, 0, W, H);
      const oct = (rad, fill) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) * PI / 4; g.lineTo(W / 2 + Math.cos(a) * rad, H / 2 + Math.sin(a) * rad); } g.closePath(); g.fillStyle = fill; g.fill(); };
      oct(W * 0.5, '#ffffff');
      oct(W * 0.46, '#b5121b');
      g.fillStyle = '#fff';
      g.font = `bold ${H * 0.3}px Arial, Helvetica, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('STOP', W / 2, H / 2 + H * 0.01);
    },
  }));
  b.poly('sign:' + key, [[-0.38, 1.85, 0.04], [0.38, 1.85, 0.04], [0.38, 2.61, 0.04], [-0.38, 2.61, 0.04]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
  b.box('sheet_metal', 0, 1.9, 0.02, 0.6, 0.66, 0.01, { color: '#8a8a8a' });
};

P.bench = (b, o, r) => {
  const c = o.color || '#6a4a2a';
  for (const x of [-0.75, 0.75]) {
    b.box('metal', x, 0, 0.0, 0.06, 0.45, 0.5, { color: '#1a1a1a' });
    b.beam('metal', [x, 0.45, -0.22], [x, 0.85, -0.3], 0.06, 0.05, { color: '#1a1a1a' });
    b.box('metal', x, 0.6, 0.0, 0.06, 0.04, 0.45, { color: '#1a1a1a' });
  }
  for (let i = 0; i < 4; i++) b.box('wood_raw', 0, 0.44, -0.2 + i * 0.13, 1.8, 0.035, 0.1, { color: c });
  for (let i = 0; i < 2; i++) b.beam('wood_raw', [-0.9, 0.62 + i * 0.13, -0.26 - i * 0.02], [0.9, 0.62 + i * 0.13, -0.26 - i * 0.02], 0.035, 0.1, { color: c, roll: 0.3 });
};

P.picnicTable = (b, o, r) => {
  const c = o.color || weather('#8a6a4a', 0.4);
  for (let i = 0; i < 5; i++) b.box('wood_raw', 0, 0.72, -0.34 + i * 0.17, 1.83, 0.04, 0.14, { color: c });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) b.box('wood_raw', 0, 0.43, s * (0.66 + i * 0.13), 1.83, 0.04, 0.12, { color: c });
    for (const x of [-0.65, 0.65]) {
      b.beam('wood_raw', [x, 0, s * 0.75], [x, 0.74, s * 0.05], 0.05, 0.12, { color: rgb(c, 0.85) });
    }
  }
  for (const x of [-0.65, 0.65]) b.box('wood_raw', x, 0.36, 0, 0.05, 0.08, 1.7, { color: rgb(c, 0.85) });
};

P.dumpster = (b, o, r) => {
  const col = o.color || ['#2a5a3a', '#2a4a7a', '#5a5a58'][(r() * 3) | 0];
  const c = weather(col, (o.rust || 0) * 0.6);
  const k = (o.rust || 0) > 0.5 ? 'metal_paint_rust' : 'sheet_metal';
  b.box('metal', 0, 0, 0, 1.75, 0.12, 0.95, { color: '#2a2a2a' });
  b.prism(k, [[-0.95, 0.55], [0.95, 0.55], [0.95, -0.55], [-0.95, -0.55]], 0.12, 0.9, { color: c, caps: 'b' });
  // sloped back top
  b.poly(k, [[-0.95, 1.02, 0.55], [0.95, 1.02, 0.55], [0.95, 1.25, -0.55], [-0.95, 1.25, -0.55]], { color: c, want: [0, 1, 0.2] });
  for (const s of [-1, 1]) b.poly(k, [[s * 0.95, 1.02, 0.55], [s * 0.95, 1.02, -0.55], [s * 0.95, 1.25, -0.55]], { color: c, want: [s, 0, 0] });
  b.poly(k, [[-0.95, 1.02, -0.55], [0.95, 1.02, -0.55], [0.95, 1.25, -0.55], [-0.95, 1.25, -0.55]], { color: c, want: [0, 0, -1] });
  // bear-proof steel lids + latch bar
  for (const x of [-0.48, 0.48]) b.poly('sheet_metal', [[x - 0.46, 1.04, 0.58], [x + 0.46, 1.04, 0.58], [x + 0.46, 1.27, -0.57], [x - 0.46, 1.27, -0.57]], { color: '#2a2a2a', want: [0, 1, 0.2] });
  b.box('metal', 0, 0.98, 0.58, 1.9, 0.04, 0.04, { color: '#c8a020' });
  for (const x of [-0.6, 0.6]) b.box('metal', x, 0.25, 0.56, 0.3, 0.12, 0.05, { color: '#2a2a2a' });
  b.box('sheet_metal', 0, 0.5, 0.556, 0.6, 0.22, 0.003, { color: '#e8e8e0' });
};

P.skiff = (b, o, r) => {
  const L = o.L ?? 5.5;
  hull(b, { L, B: 1.9, D: 0.75, open: true, color: o.color || '#b8bcbe', bottom: '#8a8e90', stripe: o.stripe || '#2a3a5a', inside: '#9aa0a2', rail: '#5a5a5a', sheer: 0.18, waterline: 0.3 });
  for (const z of [-0.8, 0.5]) b.box('metal', 0, 0.42, z, 1.6, 0.04, 0.3, { color: '#9aa0a2' });
  // outboard
  b.box('paint_gloss', 0, 0.55, -L / 2 - 0.25, 0.4, 0.55, 0.45, { color: '#1a1a1a' });
  b.box('metal', 0, 0.05, -L / 2 - 0.2, 0.12, 0.5, 0.15, { color: '#2a2a2a' });
};

P.boatTrailer = (b, o, r) => {
  b.push().translate(0, 0.55, 0);
  P.skiff(b, { color: o.color || ['#b8bcbe', '#2a4a6a', '#e8e4dc'][(r() * 3) | 0] }, r);
  b.pop();
  for (const x of [-0.75, 0.75]) b.box('metal', x, 0.35, 0, 0.1, 0.1, 4.6, { color: '#3a3a3a' });
  b.beam('metal', [-0.75, 0.4, 2.3], [0, 0.4, 3.6], 0.1, 0.1, { color: '#3a3a3a' });
  b.beam('metal', [0.75, 0.4, 2.3], [0, 0.4, 3.6], 0.1, 0.1, { color: '#3a3a3a' });
  b.box('metal', 0, 0.1, 3.5, 0.08, 0.3, 0.08, { color: '#3a3a3a' });
  for (const x of [-0.95, 0.95]) {
    b.push().translate(x, 0.32, -0.3).rotateZ(HP);
    b.cyl('rubber', 0, -0.1, 0, 0.32, 0.2, { segs: 12, color: '#181818' });
    b.pop();
    b.box('sheet_metal', x, 0.6, -0.3, 0.25, 0.04, 0.8, { color: '#3a3a3a' });
  }
};

P.stovepipe = (b, o, r) => {
  const h = o.h ?? 2.5;
  b.cyl('galv', 0, 0, 0, 0.09, h, { segs: 10, caps: '', color: '#b8bcbe' });
  b.cyl('galv', 0, h + 0.1, 0, 0.22, 0.14, { segs: 10, rTop: 0.01, color: '#9a9ea0', caps: 'b' });
};

P.fishRack = (b, o, r) => {
  const L = o.len ?? 3.0;
  const c = '#7a6a56';
  for (const x of [-L / 2, L / 2]) {
    b.beam('wood_raw', [x, 0, -0.6], [x, 2.1, 0], 0.08, 0.08, { color: c });
    b.beam('wood_raw', [x, 0, 0.6], [x, 2.1, 0], 0.08, 0.08, { color: c });
  }
  for (const y of [1.25, 1.75, 2.05]) b.beam('wood_raw', [-L / 2 - 0.2, y, 0], [L / 2 + 0.2, y, 0], 0.06, 0.06, { color: c });
  // split salmon hanging over the poles (red flesh, silver skin)
  for (const y of [1.25, 1.75]) {
    for (let i = 0; i < Math.floor(L * 4); i++) {
      if (r() < 0.2) continue;
      const x = -L / 2 + 0.15 + i * 0.25 + (r() - 0.5) * 0.05;
      const len = 0.45 + r() * 0.15, w = 0.13;
      for (const s of [-1, 1]) {
        b.push().translate(x, y, s * 0.035).rotateX(s * 0.12);
        b.quad2('fabric', [-w / 2, -len, 0], [w / 2, -len, 0], [w / 2, 0, 0], [-w / 2, 0, 0], { color: r() < 0.5 ? '#c8402a' : '#b0301e' });
        b.pop();
      }
    }
  }
  b.box('metal_corr', 0, 2.15, 0, L + 0.6, 0.02, 1.5, { color: '#ffffff' });
};

P.fenceWood = (b, o, r) => {
  const L = o.len ?? 2.4, h = o.h ?? 1.2;
  const c = o.color || weather('#8a7a64', 0.3 + (o.wear || 0) * 0.5);
  b.box('wood_raw', 0, -0.2, 0, 0.1, h + 0.3, 0.1, { color: rgb(c, 0.85) });
  for (const y of [0.25, h - 0.2]) b.box('wood_raw', L / 2, y, -0.06, L, 0.08, 0.04, { color: rgb(c, 0.85) });
  const n = Math.floor(L / 0.16);
  for (let i = 0; i < n; i++) {
    if ((o.wear || 0) > 0.4 && r() < (o.wear - 0.3) * 0.5) continue;
    const x = 0.08 + i * 0.16;
    b.box('wood_weathered', x, 0.05 + r() * 0.03, -0.02, 0.12, h - 0.05 + (r() - 0.5) * 0.06, 0.02, { color: rgb(c, 0.9 + r() * 0.2) });
  }
  if (o.end) b.box('wood_raw', L, -0.2, 0, 0.1, h + 0.3, 0.1, { color: rgb(c, 0.85) });
};

P.fenceChain = (b, o, r) => {
  const L = o.len ?? 3.0, h = o.h ?? 2.1;
  b.cyl('galv', 0, -0.3, 0, 0.04, h + 0.3, { segs: 8, color: '#a8aeb0' });
  if (o.end) b.cyl('galv', L, -0.3, 0, 0.04, h + 0.3, { segs: 8, color: '#a8aeb0' });
  b.cylBetween('galv', [0, h - 0.05, 0], [L, h - 0.05, 0], 0.02, { segs: 6, caps: '', color: '#a8aeb0' });
  b.cylBetween('galv', [0, 0.1, 0], [L, 0.1, 0], 0.012, { segs: 4, caps: '', color: '#a8aeb0' });
  b.quad2('chainlink', [0, 0.05, 0], [L, 0.05, 0], [L, h - 0.05, 0], [0, h - 0.05, 0], { uv: [[0, 0], [L * 12, 0], [L * 12, (h - 0.1) * 12], [0, (h - 0.1) * 12]] });
  if (o.barbed) {
    b.beam('galv', [0, h, 0], [0, h + 0.4, -0.3], 0.03, 0.03, { color: '#8a8e90' });
    for (let k = 0; k < 3; k++) b.cylBetween('metal', [0, h + 0.12 + k * 0.13, -0.09 - k * 0.1], [L, h + 0.12 + k * 0.13, -0.09 - k * 0.1], 0.006, { segs: 3, caps: '', color: '#6a6a6a' });
  }
};

P.boardwalk = (b, o, r) => {
  const L = o.len ?? 3.0, w = o.w ?? 1.5, y = o.y ?? 0.45;
  const n = Math.floor(L / 0.16);
  for (let i = 0; i < n; i++) {
    if ((o.wear || 0) > 0.5 && r() < (o.wear - 0.45) * 0.3) continue;
    b.box('wood_weathered', 0, y - 0.04 + (r() - 0.5) * 0.01, -L / 2 + (i + 0.5) * (L / n), w, 0.04, L / n - 0.015, { color: rgb('#9a9080', 0.9 + r() * 0.2), uvRot: true });
  }
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) b.box('wood_raw', x, y - 0.24, 0, 0.08, 0.2, L, { color: '#5a4a3a' });
  for (const z of [-L / 2 + 0.2, L / 2 - 0.2]) for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) b.box('wood_raw', x, -0.3, z, 0.12, y + 0.06, 0.12, { color: '#5a4a3a' });
  if (o.rail) for (const x of [-w / 2, w / 2]) {
    for (const z of [-L / 2 + 0.1, L / 2 - 0.1]) b.box('wood_raw', x, y, z, 0.08, 1.0, 0.08, { color: '#7a6a56' });
    b.box('wood_raw', x, y + 0.95, 0, 0.06, 0.06, L, { color: '#7a6a56' });
  }
};

/** Russian Orthodox three-bar cross (footrest slants down to the viewer's right). */
export function orthodoxCross(b, key, h, color, o = {}) {
  const t = o.t ?? h * 0.06;
  const d = o.d ?? t;
  b.box(key, 0, 0, 0, t, h, d, { color });
  b.box(key, 0, h * 0.62, 0, h * 0.55, t, d, { color });
  b.box(key, 0, h * 0.8, 0, h * 0.28, t * 0.85, d, { color });
  b.box(key, 0, h * 0.27, 0, h * 0.36, t * 0.85, d, { color, rz: -0.38 });
}

P.orthodoxCross = (b, o, r) => {
  const h = o.h ?? 1.8;
  const key = o.key || 'wood_raw';
  const col = o.color || weather('#e8e4dc', 0.2);
  if (o.base !== false) b.box('wood_raw', 0, -0.3, 0, 0.18, 0.4, 0.18, { color: '#5a4a3a' });
  orthodoxCross(b, key, h, col, { t: 0.07 });
  if (o.roof) {
    // little gable roof ("golubets") over the top of the cross
    b.push().translate(0, h * 0.86, 0);
    for (const s of [-1, 1]) b.box('wood_raw', s * 0.13, 0, 0, 0.32, 0.02, 0.25, { color: '#5a4a3a', rz: -s * 0.6 });
    b.pop();
  }
};

/** Grave fence + spirit house (Alaska Native Orthodox tradition), with a cross. */
P.graveHouse = (b, o, r) => {
  const L = o.len ?? 2.2, W = o.w ?? 1.1;
  const col = o.color || ['#e8e4dc', '#9ac0d8', '#c8d8c0', '#e8d8a8', '#b8c8e8'][(r() * 5) | 0];
  const c = weather(col, o.wear ?? 0.3);
  const roofed = o.house ?? r() < 0.55;
  if (roofed) {
    // small house-shaped enclosure: picket walls + gable roof
    const h = 0.75;
    const n = Math.floor(L / 0.17);
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) { const x = -L / 2 + i * (L / n); b.quad2('paint', [x - 0.025, 0, s * W / 2], [x + 0.025, 0, s * W / 2], [x + 0.025, h, s * W / 2], [x - 0.025, h, s * W / 2], { color: c }); }
    const m = Math.floor(W / 0.17);
    for (let i = 0; i <= m; i++) for (const s of [-1, 1]) { const z = -W / 2 + i * (W / m); b.quad2('paint', [s * L / 2, 0, z + 0.025], [s * L / 2, 0, z - 0.025], [s * L / 2, h, z - 0.025], [s * L / 2, h, z + 0.025], { color: c }); }
    for (const s of [-1, 1]) b.box('paint', 0, h, s * W / 2, L + 0.06, 0.05, 0.06, { color: c });
    for (const s of [-1, 1]) b.box('paint', s * L / 2, h, 0, 0.06, 0.05, W + 0.06, { color: c });
    b.push().translate(0, h + 0.03, 0);
    const p = 0.7;
    for (const s of [-1, 1]) b.poly('paint', [[-L / 2 - 0.08, 0, s * (W / 2 + 0.08)], [L / 2 + 0.08, 0, s * (W / 2 + 0.08)], [L / 2 + 0.08, (W / 2 + 0.08) * p, 0], [-L / 2 - 0.08, (W / 2 + 0.08) * p, 0]], { color: rgb(c, 0.85), want: [0, 1, s] });
    for (const s of [-1, 1]) b.poly('paint', [[s * (L / 2 + 0.08), 0, -W / 2 - 0.08], [s * (L / 2 + 0.08), 0, W / 2 + 0.08], [s * (L / 2 + 0.08), (W / 2 + 0.08) * p, 0]], { color: rgb(c, 0.95), want: [s, 0, 0] });
    b.pop();
  } else {
    const n = Math.floor((L + W) * 2 / 0.14);
    const pts = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    for (let e = 0; e < 4; e++) {
      const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const k = Math.floor(len / 0.14);
      const ex = (bx - ax) / len, ez = (bz - az) / len;
      for (let i = 0; i < k; i++) { const px = ax + (bx - ax) * i / k, pz = az + (bz - az) * i / k; b.quad2('paint', [px - ex * 0.02, 0, pz - ez * 0.02], [px + ex * 0.02, 0, pz + ez * 0.02], [px + ex * 0.02, 0.55, pz + ez * 0.02], [px - ex * 0.02, 0.55, pz - ez * 0.02], { color: c }); }
      b.beam('paint', [ax, 0.5, az], [bx, 0.5, bz], 0.04, 0.04, { color: c });
    }
    void n;
  }
  // the cross at the head (west end; faces east)
  b.push().translate(-L / 2 - 0.15, 0, 0).rotateY(HP);
  orthodoxCross(b, 'paint', 1.6, weather('#f0ece2', o.wear ?? 0.3), { t: 0.06 });
  b.pop();
  // plastic flowers (bright, very Alaskan cemetery)
  if (r() < 0.7) for (let i = 0; i < 3; i++) b.sphere('plastic', -L / 2 + 0.25 + r() * 0.3, 0.12 + r() * 0.1, (r() - 0.5) * W * 0.6, 0.05, { rings: 2, segs: 4, color: ['#e8203a', '#f0c020', '#e860a0', '#4080e0', '#ffffff'][(r() * 5) | 0] });
};

P.snowbank = (b, o, r) => {
  const L = o.len ?? 4, W = o.w ?? 1.8, H = o.h ?? 1.0;
  const segs = 12;
  const n = 8;
  // lumpy elongated mound: grid over [-1,1]² with height profile
  const pos = [], nrm = [], uv = [], idx = [];
  const seed = r() * 100;
  const hgt = (u, v) => {
    const e = Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
    const lump = 0.82 + 0.18 * Math.sin(u * 5.3 + seed) * Math.cos(v * 4.1 + seed * 0.7);
    return H * Math.pow(e, 0.6) * lump;
  };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= segs; i++) {
    const u = -1 + (2 * i) / segs, v = -1 + (2 * j) / n;
    pos.push(u * L / 2, hgt(u, v) - 0.05, v * W / 2);
    uv.push(u * L / 2, v * W / 2);
  }
  for (let j = 0; j <= n; j++) for (let i = 0; i <= segs; i++) {
    const u = -1 + (2 * i) / segs, v = -1 + (2 * j) / n, e = 0.01;
    const dx = (hgt(u + e, v) - hgt(u - e, v)) / (2 * e * L / 2), dz = (hgt(u, v + e) - hgt(u, v - e)) / (2 * e * W / 2);
    const l = Math.hypot(dx, 1, dz);
    nrm.push(-dx / l, 1 / l, -dz / l);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i;
    idx.push(a, a + segs + 1, a + 1, a + 1, a + segs + 1, a + segs + 2);
  }
  b.mesh(o.dirty ? 'snow_dirty' : 'snow', pos, nrm, uv, idx, { color: o.dirty ? '#d8d8d4' : '#ffffff' });
};

P.trashCan = (b, o, r) => {
  const col = o.color || '#9aa0a2';
  b.cyl('galv', 0, 0, 0, 0.25, 0.72, { rTop: 0.27, segs: 12, color: col, caps: 'b' });
  for (const y of [0.2, 0.5]) b.cyl('galv', 0, y, 0, 0.262 + y * 0.03, 0.025, { segs: 12, color: rgb(col, 0.9), caps: '' });
  b.cyl('galv', 0, 0.72, 0, 0.29, 0.05, { rTop: 0.26, segs: 12, color: rgb(col, 0.95) });
  b.cyl('galv', 0, 0.77, 0, 0.1, 0.04, { segs: 8, color: rgb(col, 0.8) });
  b.box('galv', 0, 0.81, 0, 0.14, 0.02, 0.03, { color: rgb(col, 0.8) });
};

P.phoneBooth = (b, o, r) => {
  const w = 0.92, h = 2.15;
  const fc = o.color || '#9aa4aa';
  b.box('concrete', 0, -0.05, 0, 1.2, 0.08, 1.2, { color: '#8a8a84' });
  for (const [x, z] of [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]]) b.box('metal', x, 0.03, z, 0.06, h, 0.06, { color: fc });
  b.box('sheet_metal', 0, h, 0, w + 0.1, 0.06, w + 0.1, { color: fc });
  // lit header "TELEPHONE" on all four sides
  const key = 'phonebooth';
  b.materials.set('sign:' + key, getSignMaterial(key, { kind: 'lightbox', w: 0.9, h: 0.2, ppm: 200, bg: '#e8eef2', lines: [{ text: 'TELEPHONE', size: 0.62, color: '#1a3a7a', font: 'Arial, Helvetica, sans-serif' }], dayEmissive: 0.3, nightEmissive: 1.6 }));
  b.box('sheet_metal', 0, h - 0.26, 0, w, 0.26, w, { color: fc });
  for (let s = 0; s < 4; s++) {
    b.push().rotateY(s * HP);
    b.poly('sign:' + key, [[-0.42, h - 0.23, w / 2 + 0.004], [0.42, h - 0.23, w / 2 + 0.004], [0.42, h - 0.03, w / 2 + 0.004], [-0.42, h - 0.03, w / 2 + 0.004]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    if (s !== 0) {
      b.poly('glass_dark', [[-w / 2, 0.35, w / 2 - 0.01], [w / 2, 0.35, w / 2 - 0.01], [w / 2, h - 0.27, w / 2 - 0.01], [-w / 2, h - 0.27, w / 2 - 0.01]], { color: [0, 0, 0], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
      b.box('sheet_metal', 0, 0.03, w / 2 - 0.02, w, 0.32, 0.03, { color: fc });
    } else {
      // folding door: two glass panels
      for (const x of [-w / 4, w / 4]) b.poly('glass_dark', [[x - w / 4 + 0.02, 0.1, w / 2 + 0.01], [x + w / 4 - 0.02, 0.1, w / 2 + 0.01], [x + w / 4 - 0.02, h - 0.3, w / 2 + 0.01], [x - w / 4 + 0.02, h - 0.3, w / 2 + 0.01]], { color: [0, 0, 0], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
      b.box('metal', 0, 0.05, w / 2 + 0.01, 0.03, h - 0.35, 0.03, { color: fc });
    }
    b.pop();
  }
  // the phone + a ceiling light
  b.box('sheet_metal', 0, 1.15, -w / 2 + 0.12, 0.22, 0.42, 0.16, { color: '#3a3a3a' });
  b.box('plastic', -0.07, 1.25, -w / 2 + 0.22, 0.05, 0.22, 0.05, { color: '#111' });
  b.box('neon', 0, h - 0.3, 0, 0.3, 0.02, 0.3, { color: o.on === false ? [0.1, 0.1, 0.1] : [3.0, 3.2, 3.0] });
};

P.tires = (b, o, r) => {
  const n = o.count ?? 4;
  for (let i = 0; i < n; i++) {
    b.push().translate((r() - 0.5) * 0.3, 0.12 + i * 0.22, (r() - 0.5) * 0.3);
    b.lathe('rubber', 0, -0.11, 0, [[0.2, 0], [0.33, 0.02], [0.36, 0.11], [0.33, 0.2], [0.2, 0.22]], { segs: 14, color: '#161616' });
    b.pop();
  }
};

P.fuelPump = (b, o, r) => {
  b.box('concrete', 0, 0, 0, 1.4, 0.2, 0.8, { color: '#9a9a94' });
  b.box('sheet_metal', 0, 0.2, 0, 0.8, 1.55, 0.5, { color: o.color || '#d8d8d0' });
  b.box('sheet_metal', 0, 1.75, 0, 0.86, 0.12, 0.56, { color: '#b8201a' });
  for (const s of [-1, 1]) {
    b.box('glass_dark', 0, 1.15, s * 0.252, 0.5, 0.3, 0.004, { color: '#000' });
    b.box('metal', 0.32, 0.8, s * 0.27, 0.1, 0.25, 0.05, { color: '#2a2a2a' });
    b.tube('rubber', [[0.32, 0.8, s * 0.3], [0.45, 0.4, s * 0.4], [0.4, 0.15, s * 0.35]], 0.015, { color: '#151515' });
  }
};

P.bollard = (b, o, r) => {
  b.cyl('metal', 0, 0, 0, 0.12, 0.35, { segs: 10, color: '#2a2a2a' });
  b.cyl('metal', 0, 0.35, 0, 0.16, 0.05, { segs: 10, color: '#2a2a2a' });
  b.box('metal', 0, 0.18, 0, 0.45, 0.05, 0.06, { color: '#2a2a2a' });
};

/**
 * Bering Sea style fishing boat (gillnetter/seiner, ~11–13 m) for the harbour.
 * o: {L, color, name, cabin color}
 */
P.fishingBoat = (b, o, r) => {
  const L = o.L ?? 11 + r() * 2.5, B = L * 0.34, D = 1.6;
  const col = o.color || ['#e8e4dc', '#2a4a6a', '#7a1a1a', '#2a5a3a', '#e8d8a0', '#3a3a3a'][(r() * 6) | 0];
  const st = hull(b, { L, B, D, color: col, bottom: '#6a1a14', stripe: '#1a1a1a', sheer: 0.6, deadrise: 0.35, waterline: 0.95, deck: '#7a7a72', deckKey: 'diamond_plate' });
  // bulwark rail
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], c = st[i + 1];
    for (const s of [1, -1]) b.poly('paint_gloss', [[s * a.hb, a.yg, a.z], [s * c.hb, c.yg, c.z], [s * c.hb, c.yg + 0.45, c.z], [s * a.hb, a.yg + 0.45, a.z]], { color: col, want: [s, 0, 0] });
    for (const s of [1, -1]) b.poly('paint_gloss', [[s * a.hb, a.yg + 0.45, a.z], [s * c.hb, c.yg + 0.45, c.z], [s * c.hb, c.yg, c.z], [s * a.hb, a.yg, a.z]], { color: '#d8d8d0', want: [-s, 0, 0] });
    for (const s of [1, -1]) b.beam('paint', [s * a.hb, a.yg + 0.47, a.z], [s * c.hb, c.yg + 0.47, c.z], 0.08, 0.04, { color: '#2a2a2a' });
  }
  // cabin / wheelhouse forward of midship
  const cz = L * 0.08, cw = B * 0.62, cl = L * 0.32, ch = 1.9;
  const yd = D + 0.1;
  const cabCol = o.cabin || '#eeeae0';
  b.box('paint_gloss', 0, yd, cz, cw, ch, cl, { color: cabCol });
  b.box('paint_gloss', 0, yd + ch, cz + 0.2, cw + 0.3, 0.12, cl + 0.6, { color: rgb(cabCol, 0.9) });
  // wheelhouse windows (front raked) + side windows
  const wy = yd + ch - 0.75;
  b.poly('glass_warm', [[-cw / 2 + 0.15, wy, cz + cl / 2 + 0.01], [cw / 2 - 0.15, wy, cz + cl / 2 + 0.01], [cw / 2 - 0.15, wy + 0.55, cz + cl / 2 + 0.01], [-cw / 2 + 0.15, wy + 0.55, cz + cl / 2 + 0.01]], { color: o.lit ? [0.6, 0.9, 0.6] : [0.02, 0.02, 0.02], uv: [[0.75, 0.5], [1, 0.5], [1, 1], [0.75, 1]] });
  for (let i = 0; i < 3; i++) b.box('paint_gloss', -cw / 2 + 0.15 + ((cw - 0.3) * (i + 1)) / 4, wy, cz + cl / 2 + 0.012, 0.05, 0.55, 0.02, { color: rgb(cabCol, 0.8) });
  for (const s of [1, -1]) {
    for (let k = 0; k < 2; k++) {
      const z0 = cz + cl / 2 - 0.6 - k * 1.1;
      b.poly('glass_warm', [[s * (cw / 2 + 0.005), wy, z0], [s * (cw / 2 + 0.005), wy, z0 - 0.8], [s * (cw / 2 + 0.005), wy + 0.5, z0 - 0.8], [s * (cw / 2 + 0.005), wy + 0.5, z0]].map((p) => p), { color: o.lit && k === 0 ? [0.9, 0.7, 0.5] : [0.02, 0.02, 0.02], uv: [[0, 0.5], [0.25, 0.5], [0.25, 1], [0, 1]], want: [s, 0, 0] });
    }
  }
  // mast + boom + radar + antennas + lights
  const mz = cz - cl / 2 - 0.4;
  b.cyl('metal', 0, yd, mz, 0.09, 6.5, { rTop: 0.06, segs: 8, color: '#d8d8d0' });
  b.beam('metal', [0, yd + 1.2, mz], [0, yd + 3.2, mz - L * 0.38], 0.08, 0.08, { color: '#d8d8d0' });
  b.box('sheet_metal', 0, yd + ch + 0.12, cz, 0.9, 0.12, 0.25, { color: '#e8e8e8' });
  b.cyl('plastic', 0, yd + ch + 0.24, cz, 0.04, 0.3, { segs: 6, color: '#222' });
  b.box('plastic', 0, yd + ch + 0.55, cz, 1.1, 0.08, 0.14, { color: '#e8e8e8' });
  b.cylBetween('plastic', [0.4, yd + ch + 0.12, cz - 0.4], [0.5, yd + ch + 3.0, cz - 0.4], 0.015, { segs: 4, color: '#e8e8e8' });
  b.cylBetween('plastic', [-0.4, yd + ch + 0.12, cz - 0.4], [-0.45, yd + ch + 2.2, cz - 0.4], 0.015, { segs: 4, color: '#e8e8e8' });
  b.sphere('neon', 0, yd + 6.55, mz, 0.06, { color: [3, 3, 3], rings: 3, segs: 6 });
  // stern: net reel (gillnetter) or crab pot launcher
  if (r() < 0.6) {
    b.push().translate(0, yd + 0.7, -L / 2 + 1.2).rotateZ(HP);
    b.cyl('metal', 0, -B * 0.32, 0, 0.6, B * 0.64, { segs: 14, color: '#9a9a94' });
    b.cyl('fabric', 0, -B * 0.28, 0, 0.66, B * 0.56, { segs: 14, color: ['#2a5a3a', '#3a3a7a', '#6a4a2a'][(r() * 3) | 0] });
    b.pop();
    for (const s of [1, -1]) b.box('metal', s * B * 0.34, yd, -L / 2 + 1.2, 0.08, 0.8, 0.5, { color: '#5a5a5a' });
  } else {
    b.push().translate(0, yd, -L / 2 + 1.6);
    P.crabPot(b, { size: 1.8 }, r);
    b.pop();
  }
  // tyre fenders
  for (let i = 0; i < 4; i++) {
    const s = st[3 + i * 2];
    b.push().translate(s.hb + 0.12, s.yg - 0.5, s.z).rotateZ(HP);
    b.lathe('rubber', 0, -0.1, 0, [[0.12, 0], [0.22, 0.02], [0.24, 0.1], [0.22, 0.18], [0.12, 0.2]], { segs: 10, color: '#121212' });
    b.pop();
  }
  // name on the bow (both sides)
  if (o.name) {
    const key = 'boat_' + o.name;
    const bs = st[st.length - 4];
    b.materials.set('sign:' + key, getSignMaterial(key, { kind: 'paint', w: 2.0, h: 0.3, ppm: 140, transparent: true, lines: [{ text: o.name, size: 0.7, color: col === '#e8e4dc' || col === '#e8d8a0' ? '#1a1a1a' : '#f0f0f0', font: 'Georgia, serif' }] }));
    for (const s of [1, -1]) {
      const x = s * (bs.hb + 0.015);
      const y = bs.yg - 0.25;
      const pts = s > 0 ? [[x, y - 0.15, bs.z - 1.0], [x, y - 0.15, bs.z + 1.0], [x, y + 0.15, bs.z + 1.0], [x, y + 0.15, bs.z - 1.0]] : [[x, y - 0.15, bs.z + 1.0], [x, y - 0.15, bs.z - 1.0], [x, y + 0.15, bs.z - 1.0], [x, y + 0.15, bs.z + 1.0]];
      b.poly('sign:' + key, pts, { uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [s, 0, 0] });
    }
  }
};
