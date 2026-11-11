// The prop library: chunky toy-box scenery. Every builder returns a Group whose
// origin sits on the ground and whose "front" faces +z (toward the camera).
//   userData.solid = { w, d } | { r }   footprint for collision (local, unrotated)
//   userData.tall  = true               big enough to hide the player → fades when you walk behind
import * as THREE from 'three';
import { toon, flat, lit, sphere, cyl, cone, box, rbox, torus, circle, capsule, plane, M, group, signPlane, textTex, canvasTex, glowSprite, shade, FONT } from './kit.js';
import { TAU, rand, makeRng } from '../core/util.js';

const geoCache = new Map();
const cg = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); } return g; };

/** Gabled roof prism: ridge along x. */
export function roofPrism(L, W, H) {
  return cg(`roof:${L}:${W}:${H}`, () => {
    const hl = L / 2, hw = W / 2;
    const a = [-hl, 0, hw], b = [hl, 0, hw], c = [hl, 0, -hw], d = [-hl, 0, -hw], e = [-hl, H, 0], f = [hl, H, 0];
    const tris = [a, b, f, a, f, e, c, d, e, c, e, f, d, a, e, b, c, f, a, d, c, a, c, b];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(tris.length * 2).fill(0), 2));
    g.computeVertexNormals();
    return g;
  });
}
const blob = (r) => cg(`blob:${r}`, () => new THREE.IcosahedronGeometry(r, 1));
const solid = (g, w, d) => { g.userData.solid = { w, d }; return g; };
const round = (g, r) => { g.userData.solid = { r }; return g; };

const GLASS_DAY = 0x9fd4e8, GLASS_LIT = 0xffd98a;
function windowPane(w, h, night, on = true) {
  const g = new THREE.Group();
  g.add(M(rbox(w + 0.22, h + 0.22, 0.14, 0.05), toon(0xfffaf0), 0, 0, 0, { shadow: false }));
  const glass = night && on ? lit(GLASS_LIT, 0xffc65a, 1.25) : toon(night ? 0x3a4a6a : GLASS_DAY);
  g.add(M(box(w, h, 0.05), glass, 0, 0, 0.065, { shadow: false }));
  g.add(M(box(0.06, h, 0.06), toon(0xfffaf0), 0, 0, 0.08, { shadow: false }));
  g.add(M(box(w, 0.06, 0.06), toon(0xfffaf0), 0, 0, 0.08, { shadow: false }));
  return g;
}
function door(color = 0x7a4a2a, w = 1.3, h = 2.15) {
  const g = new THREE.Group();
  g.add(M(rbox(w + 0.28, h + 0.14, 0.16, 0.05), toon(0xfffaf0), 0, h / 2 + 0.07, 0, { shadow: false }));
  g.add(M(rbox(w, h, 0.14, 0.06), toon(color), 0, h / 2, 0.06, { shadow: false }));
  g.add(M(sphere(0.08, 8, 6), toon(0xffd45a), w * 0.3, h * 0.48, 0.16, { shadow: false }));
  return g;
}

// ------------------------------------------------------------------ buildings
export function house(o = {}) {
  const { w = 7, d = 5.4, h = 3.3, wall = 0xf2e2c4, roof = 0xc8452d, doorC = 0x7a4a2a, night = false, on = true, chimney = true, roofH = 2.3, doorX = 0, porch = true, hip = false, awning = null } = o;
  const g = new THREE.Group();
  g.add(M(rbox(w + 0.3, 0.5, d + 0.3, 0.12), toon(shade(wall, -0.3)), 0, 0.25, 0));
  g.add(M(rbox(w, h, d, 0.22), toon(wall), 0, h / 2 + 0.2, 0));
  if (hip) g.add(M(cone((Math.max(w, d) + 1.2) * 0.72, roofH, 4), toon(roof), 0, h + 0.2 + roofH / 2, 0, { ry: Math.PI / 4, sx: w >= d ? 1 : (w + 1) / (d + 1), sz: w >= d ? (d + 1) / (w + 1) : 1 }));
  else {
    g.add(M(roofPrism(w + 1, d + 1.1, roofH), toon(roof), 0, h + 0.1, 0));
    g.add(M(box(w + 1.04, 0.16, 0.2), toon(shade(roof, -0.2)), 0, h + roofH + 0.06, 0, { shadow: false }));
  }
  const dr = door(doorC); dr.position.set(doorX, 0.2, d / 2); g.add(dr);
  if (porch) g.add(M(rbox(2.2, 0.26, 1.0, 0.08), toon(0xd9c9a8), doorX, 0.13, d / 2 + 0.5));
  const wy = h * 0.58 + 0.2;
  for (const s of [-1, 1]) {
    const x = doorX + s * (w * 0.31);
    if (Math.abs(x) < w / 2 - 0.9) { const p = windowPane(1.15, 1.15, night, on); p.position.set(x, wy, d / 2 + 0.02); g.add(p); }
  }
  for (const s of [-1, 1]) { const p = windowPane(1.1, 1.1, night, on); p.position.set(s * (w / 2 + 0.02), wy, 0); p.rotation.y = s * Math.PI / 2; g.add(p); }
  if (chimney) g.add(M(rbox(0.8, 1.7, 0.8, 0.08), toon(0xb5654a), -w * 0.26, h + roofH * 0.62, -d * 0.12));
  if (awning) {
    for (let i = 0; i < 6; i++) g.add(M(box((w * 0.8) / 6, 0.12, 1.2), toon(i % 2 ? awning : 0xfffaf0), -w * 0.4 + (i + 0.5) * (w * 0.8) / 6, h * 0.86, d / 2 + 0.55, { rx: 0.42 }));
  }
  g.userData.tall = true;
  g.userData.doorX = doorX;
  return solid(g, w + 0.3, d + 0.3);
}

export function clubhouse(o = {}) {
  const { night = false, fixed = 0, team = 0xf08a24 } = o;
  const g = house({ w: 8.2, d: 6, h: 3.5, wall: fixed ? 0xf6e7c6 : 0xd8c8a6, roof: fixed ? 0x3b2148 : 0x5a4a5e, doorC: team, night, roofH: 2.5, chimney: false });
  const sign = signPlane('CLUBHOUSE', 4.4, 0.95, { bg: '#fff4dc', color: '#3b2148', radius: 26, border: '#3b2148' });
  sign.position.set(0, 4.72, 2.2); sign.rotation.x = -0.96; sign.rotation.z = fixed ? 0 : -0.06;
  g.add(sign);
  // pennant pole
  g.add(M(cyl(0.06, 0.06, 3, 6), toon(0xfffaf0), 3.4, 5.4, 0));
  const pen = new THREE.Mesh(cg('pennant', () => { const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(1.5, 0); s.lineTo(0, -0.5); return new THREE.ShapeGeometry(s); }), toon(team, { side: THREE.DoubleSide }));
  pen.position.set(3.46, 6.3, 0); g.add(pen);
  // porch lantern
  g.add(M(cyl(0.04, 0.04, 0.5, 5), toon(0x2b1a33), 1.25, 2.75, 3.25, { rz: Math.PI / 2 }));
  g.add(M(rbox(0.3, 0.42, 0.3, 0.06), night ? lit(0xffe9a8, 0xffc65a, 1.6) : toon(0xfff1c0), 1.45, 2.5, 3.25, { shadow: false }));
  if (night) { const s = glowSprite(0xffc65a, 3.2, 0.55); s.position.set(1.45, 2.5, 3.4); g.add(s); }
  if (!fixed) {
    g.add(M(box(1.5, 0.16, 0.08), toon(0x8a6a4a), -2.55, 2.4, 3.12, { rz: 0.3, shadow: false }));
    g.add(M(box(1.5, 0.16, 0.08), toon(0x8a6a4a), -2.55, 2.0, 3.12, { rz: -0.25, shadow: false }));
  }
  return g;
}

export function diner(o = {}) {
  const { night = false, fixed = 0 } = o;
  const g = new THREE.Group();
  const w = 9, d = 5, h = 3;
  g.add(M(rbox(w + 0.3, 0.5, d + 0.3, 0.12), toon(0x8f9aa6), 0, 0.25, 0));
  g.add(M(rbox(w, h, d, 0.6), toon(fixed ? 0xdfeef0 : 0xb9c4c6), 0, h / 2 + 0.2, 0));
  g.add(M(rbox(w + 0.1, 0.5, d + 0.1, 0.2), toon(fixed ? 0xd4502f : 0x8a5a54), 0, 1.1, 0));
  g.add(M(rbox(w + 0.5, 0.45, d + 0.5, 0.2), toon(fixed ? 0xd4502f : 0x8a5a54), 0, h + 0.35, 0));
  g.add(M(rbox(w - 1, 0.5, d - 1, 0.2), toon(0xf2f2ea), 0, h + 0.8, 0));
  const dr = door(0x2a6f77); dr.position.set(-2.6, 0.2, d / 2); g.add(dr);
  for (let i = 0; i < 3; i++) {
    const p = windowPane(1.5, 1.2, night, !!fixed); p.position.set(-0.3 + i * 1.85, 2.05, d / 2 + 0.02); g.add(p);
    if (!fixed) g.add(M(box(1.9, 0.2, 0.08), toon(0x8a6a4a), -0.3 + i * 1.85, 2.05, d / 2 + 0.16, { rz: i % 2 ? 0.3 : -0.3, shadow: false }));
  }
  // rooftop sign
  g.add(M(cyl(0.07, 0.07, 1.2, 6), toon(0x4a4a58), -1.8, h + 1.6, 0.6));
  g.add(M(cyl(0.07, 0.07, 1.2, 6), toon(0x4a4a58), 1.8, h + 1.6, 0.6));
  const sign = signPlane(fixed ? "WAFFLE'S DINER" : 'DIN  R', 5.4, 1.3, { bg: fixed ? '#d4502f' : '#7a6a6a', color: fixed ? '#fff4dc' : '#c9bfb0', radius: 30, border: '#2b1a33' });
  sign.position.set(0, h + 2.45, 0.7); sign.rotation.z = fixed ? 0 : 0.05; g.add(sign);
  if (fixed && night) { const s = glowSprite(0xff7a5a, 7, 0.4); s.position.set(0, h + 2.4, 1); g.add(s); }
  g.userData.tall = true;
  g.userData.doorX = -2.6;
  return solid(g, w + 0.3, d + 0.3);
}

export function arcade(o = {}) {
  const { night = false, fixed = 0 } = o;
  const g = new THREE.Group();
  const w = 8, d = 5.2, h = 4;
  g.add(M(rbox(w, h, d, 0.2), toon(fixed ? 0x5a3f8a : 0x5e5870), 0, h / 2, 0));
  g.add(M(rbox(w + 0.4, 0.5, d + 0.4, 0.15), toon(fixed ? 0xf08a24 : 0x7a6a6a), 0, h + 0.2, 0));
  const dr = door(0x2b1a33, 1.8, 2.3); dr.position.set(0, 0, d / 2); g.add(dr);
  const sign = signPlane(fixed ? 'ARCADE' : 'ARC DE', 5.2, 1.3, { bg: '#1b1630', color: fixed ? '#ffd45a' : '#7c748c', radius: 22, border: fixed ? '#f08a24' : '#4a4458' });
  sign.position.set(0, h - 0.75, d / 2 + 0.03); g.add(sign);
  for (const s of [-1, 1]) {
    const p = windowPane(1.3, 1.5, night, !!fixed); p.position.set(s * 2.6, 1.5, d / 2 + 0.02); g.add(p);
    if (!fixed) g.add(M(box(1.8, 0.2, 0.08), toon(0x8a6a4a), s * 2.6, 1.5, d / 2 + 0.16, { rz: s * 0.3, shadow: false }));
    if (fixed) g.add(M(sphere(0.22, 8, 6), lit(s > 0 ? 0xff5ad0 : 0x58e6ff, s > 0 ? 0xff5ad0 : 0x58e6ff, 1.4), s * 3.6, h + 0.75, d / 2 - 0.3, { shadow: false }));
  }
  if (fixed && night) { const s = glowSprite(0xb07aff, 8, 0.4); s.position.set(0, h - 0.6, d / 2 + 0.8); g.add(s); }
  g.userData.tall = true;
  g.userData.doorX = 0;
  return solid(g, w, d);
}

export function shop(o = {}) {
  const { night = false, name = 'GENERAL STORE', wall = 0xe8d2a6, roof = 0x2a6f77, awning = 0x2a6f77 } = o;
  const g = house({ w: 6.6, d: 5, h: 3.2, wall, roof, night, chimney: false, awning, roofH: 1.8, doorC: 0x6a4a2e });
  const sign = signPlane(name, 4.6, 0.8, { bg: '#fff4dc', color: '#2b1a33', radius: 20, border: '#2b1a33' });
  sign.position.set(0, 4.25, 1.75); sign.rotation.x = -1.05; g.add(sign);
  return g;
}

export function shed(o = {}) {
  const { wall = 0xb5654a, roof = 0x5a4a5e, w = 3.2, d = 2.8 } = o;
  const g = new THREE.Group();
  g.add(M(rbox(w, 2.4, d, 0.12), toon(wall), 0, 1.2, 0));
  g.add(M(roofPrism(w + 0.6, d + 0.6, 1.1), toon(roof), 0, 2.4, 0));
  const dr = door(shade(wall, -0.25), 1.2, 1.9); dr.position.set(0, 0, d / 2); g.add(dr);
  g.userData.tall = true;
  return solid(g, w, d);
}

export function busStop(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(3.6, 0.18, 1.5, 0.06), toon(0x2a6f77), 0, 2.6, 0));
  for (const s of [-1, 1]) g.add(M(cyl(0.08, 0.08, 2.6, 6), toon(0xfffaf0), s * 1.6, 1.3, -0.55));
  g.add(M(box(3.3, 1.5, 0.08), toon(0x9fd4e8, { transparent: true, opacity: 0.55 }), 0, 1.5, -0.6, { shadow: false }));
  g.add(M(rbox(2.6, 0.16, 0.6, 0.05), toon(0xb07a45), 0, 0.6, -0.2));
  for (const s of [-1, 1]) g.add(M(box(0.12, 0.6, 0.5), toon(0x4a4a58), s * 1.1, 0.3, -0.2));
  const sign = signPlane(o.text || 'BUS', 1.1, 0.6, { bg: '#ffd45a', color: '#2b1a33', radius: 14, border: '#2b1a33' });
  sign.position.set(0, 3.1, 0); g.add(sign);
  g.add(M(cyl(0.05, 0.05, 0.5, 5), toon(0x4a4a58), 0, 2.85, 0));
  return solid(g, 3.6, 1.2);
}

export function bus(o = {}) {
  const c = o.color ?? 0xffc23c;
  const g = new THREE.Group();
  g.add(M(rbox(6.4, 2.3, 2.6, 0.4), toon(c), 0, 1.75, 0));
  g.add(M(rbox(6.5, 0.5, 2.7, 0.15), toon(0x2b1a33), 0, 0.85, 0));
  g.add(M(box(5.6, 0.85, 2.64), toon(o.night ? 0xffd98a : 0x9fd4e8), -0.1, 2.15, 0, { shadow: false }));
  g.add(M(box(6.42, 0.14, 2.66), toon(c), 0, 2.15, 0, { shadow: false }));
  for (let i = 0; i < 5; i++) g.add(M(box(0.14, 0.9, 2.66), toon(c), -2.6 + i * 1.25, 2.15, 0, { shadow: false }));
  for (const [x, z] of [[-2, 1.2], [2, 1.2], [-2, -1.2], [2, -1.2]]) g.add(M(cyl(0.52, 0.52, 0.36, 12), toon(0x2b1a33), x, 0.52, z, { rx: Math.PI / 2 }));
  g.add(M(sphere(0.16, 8, 6), lit(0xfff1c0, 0xffe08a, 1), 3.22, 1.2, 0.8, { shadow: false }));
  g.add(M(sphere(0.16, 8, 6), lit(0xfff1c0, 0xffe08a, 1), 3.22, 1.2, -0.8, { shadow: false }));
  const sign = signPlane(o.text || 'HOLLOW LINE', 2.6, 0.42, { color: '#2b1a33' });
  sign.position.set(0, 1.45, 1.32); g.add(sign);
  return solid(g, 6.4, 2.6);
}

// ------------------------------------------------------------------ nature
const LEAF = [0xe8842c, 0xd4502f, 0xf2b632, 0xc9652a, 0xe0a03a, 0xb5452f];
export function tree(o = {}) {
  const r = o.rng || Math.random;
  const kind = o.kind || 'maple';
  const g = new THREE.Group();
  const s = o.s ?? (0.85 + r() * 0.4);
  if (kind === 'pine') {
    const c = o.color ?? 0x3f7a52;
    g.add(M(cyl(0.22, 0.3, 1.2, 7), toon(0x7a5230), 0, 0.6, 0));
    for (let i = 0; i < 3; i++) g.add(M(cone(1.5 - i * 0.38, 1.7, 8), toon(i % 2 ? shade(c, 0.08) : c), 0, 1.7 + i * 1.05, 0));
    if (o.snow) for (let i = 0; i < 3; i++) g.add(M(cone((1.5 - i * 0.38) * 0.62, 0.7, 8), toon(0xffffff), 0, 2.25 + i * 1.05, 0));
  } else if (kind === 'bare') {
    g.add(M(cyl(0.2, 0.34, 2.6, 7), toon(0x6a4a3a), 0, 1.3, 0));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + r(); g.add(M(cyl(0.05, 0.12, 1.5, 5), toon(0x6a4a3a), Math.cos(a) * 0.5, 2.9, Math.sin(a) * 0.5, { rz: -Math.cos(a) * 0.8, rx: Math.sin(a) * 0.8 })); }
  } else {
    const c = o.color ?? LEAF[Math.floor(r() * LEAF.length)];
    g.add(M(cyl(0.26, 0.42, 2.0, 8), toon(0x7a5230), 0, 1.0, 0));
    g.add(M(blob(1.55), toon(c), 0, 3.0, 0));
    g.add(M(blob(1.1), toon(shade(c, 0.1)), 0.95, 2.6, 0.3));
    g.add(M(blob(1.0), toon(shade(c, -0.08)), -0.9, 2.5, -0.2));
    g.add(M(blob(0.95), toon(shade(c, 0.16)), 0.1, 3.9, -0.1));
  }
  g.scale.setScalar(s);
  g.rotation.y = r() * TAU;
  g.userData.tall = true;
  g.userData.light = true;
  return round(g, 0.42 * s);
}
export function bush(o = {}) {
  const c = o.color ?? 0x5f9a4a;
  const g = new THREE.Group();
  g.add(M(blob(0.62), toon(c), 0, 0.5, 0));
  g.add(M(blob(0.45), toon(shade(c, 0.1)), 0.5, 0.38, 0.1));
  g.add(M(blob(0.42), toon(shade(c, -0.06)), -0.45, 0.36, -0.1));
  if (o.berries) for (let i = 0; i < 5; i++) g.add(M(sphere(0.07, 6, 5), toon(0xd4502f), rand(-0.5, 0.5), rand(0.4, 0.9), rand(0.2, 0.5), { shadow: false }));
  return round(g, 0.6);
}
export function hedge(o = {}) {
  const len = o.len ?? 4, c = o.color ?? 0x4f8a45;
  const g = new THREE.Group();
  g.add(M(rbox(len, 1.25, 0.95, 0.3), toon(c), 0, 0.62, 0));
  return solid(g, len, 0.95);
}
export function rock(o = {}) {
  const s = o.s ?? 1, c = o.color ?? 0x9a9aa6;
  const g = new THREE.Group();
  g.add(M(cg('rock', () => new THREE.DodecahedronGeometry(0.6, 0)), toon(c), 0, 0.38 * s, 0, { s, sy: 0.75 * s }));
  return round(g, 0.55 * s);
}
export function stump() {
  const g = new THREE.Group();
  g.add(M(cyl(0.42, 0.5, 0.6, 9), toon(0x8a6040), 0, 0.3, 0));
  g.add(M(cyl(0.38, 0.38, 0.02, 9), toon(0xd9b98a), 0, 0.61, 0, { shadow: false }));
  return round(g, 0.48);
}
export function pumpkin(o = {}) {
  const s = o.s ?? 1;
  const g = new THREE.Group();
  g.add(M(sphere(0.36, 10, 8), toon(o.color ?? 0xf08a24), 0, 0.3 * s, 0, { s, sy: 0.82 * s }));
  g.add(M(cyl(0.04, 0.06, 0.16, 5), toon(0x5a7a3c), 0, 0.62 * s, 0, { s }));
  return round(g, 0.34 * s);
}
export function leafPile(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0xe8842c;
  g.add(M(sphere(0.8, 10, 6), toon(c), 0, 0.05, 0, { sy: 0.45 }));
  g.add(M(sphere(0.5, 8, 6), toon(shade(c, 0.15)), 0.4, 0.1, 0.2, { sy: 0.5 }));
  return g;
}
export function flowers(o = {}) {
  const g = new THREE.Group();
  const cols = o.colors || [0xf7b9c2, 0xffd45a, 0xffffff, 0xd4502f];
  const n = o.n ?? 6;
  for (let i = 0; i < n; i++) {
    const x = rand(-0.7, 0.7), z = rand(-0.3, 0.3);
    g.add(M(cyl(0.02, 0.02, 0.3, 4), toon(0x4f8a45), x, 0.15, z, { shadow: false }));
    g.add(M(sphere(0.1, 6, 5), toon(cols[i % cols.length]), x, 0.34, z, { shadow: false }));
  }
  return g;
}

// ------------------------------------------------------------------ yards & streets
/** Fence between two points (world units, relative to the group origin at p0). */
export function fence(x1, z1, x2, z2, o = {}) {
  const style = o.style || 'picket';
  const g = new THREE.Group();
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(-dz, dx);
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  g.rotation.y = ang;
  const c = o.color ?? (style === 'picket' ? 0xfffaf0 : style === 'chain' ? 0x8f9aa6 : style === 'rail' ? 0xb07a45 : 0xb98a5e);
  const h = o.h ?? (style === 'picket' ? 1.05 : style === 'rail' ? 0.95 : 1.6);
  const n = Math.max(1, Math.round(len / (style === 'wood' ? 0.55 : 0.75)));
  if (style === 'wood') {
    g.add(M(box(len, h, 0.12), toon(c), 0, h / 2, 0));
    for (let i = 0; i <= n; i++) g.add(M(box(0.03, h, 0.14), toon(shade(c, -0.18)), -len / 2 + (i / n) * len, h / 2, 0, { shadow: false }));
    g.add(M(box(len + 0.1, 0.1, 0.2), toon(shade(c, -0.12)), 0, h, 0, { shadow: false }));
  } else if (style === 'chain') {
    g.add(M(box(len, h, 0.04), toon(c, { transparent: true, opacity: 0.45 }), 0, h / 2, 0, { shadow: false }));
    const posts = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= posts; i++) g.add(M(cyl(0.06, 0.06, h + 0.1, 6), toon(0x6a7480), -len / 2 + (i / posts) * len, h / 2, 0));
    g.add(M(box(len, 0.07, 0.07), toon(0x6a7480), 0, h, 0, { shadow: false }));
  } else if (style === 'rail') {
    const posts = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= posts; i++) g.add(M(cyl(0.1, 0.12, h + 0.15, 6), toon(c), -len / 2 + (i / posts) * len, h / 2, 0));
    for (const y of [0.4, 0.8]) g.add(M(box(len, 0.12, 0.08), toon(shade(c, 0.1)), 0, y, 0));
  } else {
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + (i / n) * len;
      g.add(M(box(0.3, h, 0.09), toon(c), x, h / 2, 0));
      g.add(M(cone(0.21, 0.26, 4), toon(c), x, h + 0.12, 0, { ry: Math.PI / 4, sz: 0.4, shadow: false }));
    }
    for (const y of [0.3, 0.75]) g.add(M(box(len, 0.11, 0.06), toon(shade(c, -0.1)), 0, y, -0.06, { shadow: false }));
  }
  g.userData.len = len;
  return g;
}
export function mailbox(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.07, 0.07, 1.0, 6), toon(0xb07a45), 0, 0.5, 0));
  g.add(M(rbox(0.36, 0.34, 0.6, 0.12), toon(o.color ?? 0x2a6f77), 0, 1.12, 0));
  g.add(M(box(0.04, 0.3, 0.2), toon(0xd4502f), 0.2, 1.25, 0.1, { shadow: false }));
  return round(g, 0.25);
}
export function lamp(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.1, 0.16, 0.4, 8), toon(0x2b1a33), 0, 0.2, 0));
  g.add(M(cyl(0.065, 0.065, 3.3, 6), toon(0x2b1a33), 0, 1.85, 0));
  g.add(M(rbox(0.5, 0.56, 0.5, 0.1), o.night ? lit(0xffe9a8, 0xffc65a, 1.7) : toon(0xfff1c0), 0, 3.7, 0, { shadow: false }));
  g.add(M(cone(0.42, 0.26, 4), toon(0x2b1a33), 0, 4.1, 0, { ry: Math.PI / 4 }));
  if (o.night) { const s = glowSprite(0xffc65a, 5, 0.5); s.position.set(0, 3.7, 0); g.add(s); }
  return round(g, 0.2);
}
export function bench(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0xb07a45;
  g.add(M(rbox(2.2, 0.14, 0.62, 0.05), toon(c), 0, 0.55, 0));
  g.add(M(rbox(2.2, 0.6, 0.12, 0.05), toon(c), 0, 0.98, -0.28));
  for (const s of [-1, 1]) g.add(M(box(0.12, 0.55, 0.56), toon(0x2b1a33), s * 0.9, 0.28, 0));
  return solid(g, 2.2, 0.7);
}
export function signPost(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.07, 0.07, 1.5, 6), toon(0x8a6040), 0, 0.75, 0));
  const w = o.w ?? 1.9, h = o.h ?? 0.8;
  g.add(M(rbox(w + 0.14, h + 0.14, 0.12, 0.05), toon(0xb07a45), 0, 1.5, 0));
  const s = signPlane(o.text || '?', w, h, { color: o.color || '#2b1a33', bg: o.bg || '#fff4dc', radius: 14 });
  s.position.set(0, 1.5, 0.07); g.add(s);
  return round(g, 0.25);
}
export function arrowSign(o = {}) {
  const g = signPost(o);
  return g;
}
export function hydrant() {
  const g = new THREE.Group();
  g.add(M(cyl(0.17, 0.2, 0.6, 8), toon(0xd4502f), 0, 0.3, 0));
  g.add(M(sphere(0.18, 8, 6), toon(0xd4502f), 0, 0.62, 0));
  g.add(M(cyl(0.07, 0.07, 0.5, 6), toon(0xd4502f), 0, 0.4, 0, { rz: Math.PI / 2 }));
  return round(g, 0.25);
}
export function trashcan(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.34, 0.28, 0.85, 10), toon(o.color ?? 0x8f9aa6), 0, 0.43, 0));
  g.add(M(cyl(0.37, 0.37, 0.08, 10), toon(0x6a7480), 0, 0.88, 0));
  return round(g, 0.36);
}
export function dumpster(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(1.9, 1.3, 1.9, 0.12), toon(o.color ?? 0x3f7a52), 0, 0.72, 0));
  g.add(M(rbox(1.96, 0.16, 1.96, 0.05), toon(0x2b4a3a), 0, 1.42, 0));
  for (const s of [-1, 1]) g.add(M(cyl(0.12, 0.12, 0.14, 8), toon(0x2b1a33), s * 0.7, 0.12, 0.8, { rz: Math.PI / 2 }));
  return solid(g, 1.9, 1.9);
}
export function crate(o = {}) {
  const g = new THREE.Group();
  const s = o.s ?? 1.6;
  g.add(M(rbox(s, s, s, 0.08), toon(o.color ?? 0xc99a5b), 0, s / 2, 0));
  for (const y of [0.18, s - 0.18]) g.add(M(box(s + 0.04, 0.14, s + 0.04), toon(0x9a7040), 0, y, 0, { shadow: false }));
  return solid(g, s, s);
}
export function hayBale(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(1.8, 1.25, 1.8, 0.16), toon(0xe8c95a), 0, 0.63, 0));
  for (const x of [-0.5, 0.5]) g.add(M(box(0.08, 1.28, 1.84), toon(0xb98a3a), x, 0.63, 0, { shadow: false }));
  return solid(g, 1.8, 1.8);
}
export function iceBlock(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(1.8, 1.4, 1.8, 0.2), toon(0xbfe6f5, { transparent: true, opacity: 0.85 }), 0, 0.7, 0));
  g.add(M(box(0.5, 0.06, 0.06), flat(0xffffff), -0.3, 1.1, 0.92, { rz: 0.5, shadow: false }));
  return solid(g, 1.8, 1.8);
}
export function sprinkler() {
  const g = new THREE.Group();
  g.add(M(cyl(0.16, 0.2, 0.14, 8), toon(0x4a4a58), 0, 0.07, 0));
  g.add(M(cyl(0.05, 0.05, 0.3, 6), toon(0xd9a441), 0, 0.25, 0));
  g.add(M(sphere(0.09, 6, 5), toon(0xd9a441), 0, 0.42, 0));
  return g;
}
export function lawnChair(o = {}) {
  const c = o.color ?? 0x58b8c9;
  const g = new THREE.Group();
  g.add(M(rbox(0.9, 0.1, 0.9, 0.04), toon(c), 0, 0.42, 0));
  g.add(M(rbox(0.9, 0.9, 0.1, 0.04), toon(c), 0, 0.85, -0.42, { rx: -0.25 }));
  for (const [x, z] of [[-0.38, 0.38], [0.38, 0.38], [-0.38, -0.38], [0.38, -0.38]]) g.add(M(cyl(0.035, 0.035, 0.42, 5), toon(0xd9dde2), x, 0.21, z));
  return solid(g, 0.9, 0.9);
}
export function foldingChair(o = {}) {
  const c = o.color ?? 0x8f9aa6;
  const g = new THREE.Group();
  g.add(M(box(0.62, 0.06, 0.6), toon(c), 0, 0.5, 0));
  g.add(M(box(0.62, 0.42, 0.05), toon(c), 0, 1.0, -0.3));
  for (const s of [-1, 1]) { g.add(M(cyl(0.025, 0.025, 1.2, 4), toon(0x4a4a58), s * 0.29, 0.6, -0.05, { rx: 0.25 })); g.add(M(cyl(0.025, 0.025, 0.7, 4), toon(0x4a4a58), s * 0.29, 0.3, 0.05, { rx: -0.5 })); }
  return solid(g, 0.62, 0.6);
}
export function grill() {
  const g = new THREE.Group();
  g.add(M(sphere(0.48, 12, 8), toon(0x2b1a33), 0, 1.0, 0, { sy: 0.7 }));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; g.add(M(cyl(0.03, 0.03, 0.9, 4), toon(0x6a7480), Math.cos(a) * 0.3, 0.42, Math.sin(a) * 0.3)); }
  g.add(M(sphere(0.06, 6, 5), toon(0xd4502f), 0, 1.36, 0));
  return round(g, 0.48);
}
export function picnicTable(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0xb07a45;
  g.add(M(rbox(2.4, 0.12, 1.1, 0.04), toon(c), 0, 0.92, 0));
  for (const s of [-1, 1]) { g.add(M(rbox(2.4, 0.1, 0.4, 0.04), toon(c), 0, 0.55, s * 0.9)); g.add(M(box(0.12, 0.9, 1.9), toon(shade(c, -0.2)), s * 0.9, 0.45, 0)); }
  if (o.cloth) g.add(M(box(1.6, 0.03, 1.12), toon(o.cloth), 0, 1.0, 0, { shadow: false }));
  return solid(g, 2.4, 2.1);
}
export function kiddiePool() {
  const g = new THREE.Group();
  g.add(M(cyl(1.3, 1.3, 0.34, 18, true), toon(0x58b8c9, { side: THREE.DoubleSide }), 0, 0.17, 0));
  g.add(M(circle(1.26, 18), toon(0x8fe0ee), 0, 0.24, 0, { rx: -Math.PI / 2, shadow: false }));
  g.add(M(torus(1.3, 0.07, 5, 20), toon(0xfff4dc), 0, 0.34, 0, { rx: Math.PI / 2 }));
  return round(g, 1.3);
}
export function trampoline() {
  const g = new THREE.Group();
  g.add(M(torus(1.25, 0.1, 6, 18), toon(0x2a6f77), 0, 0.7, 0, { rx: Math.PI / 2 }));
  g.add(M(circle(1.2, 18), toon(0x2b1a33), 0, 0.7, 0, { rx: -Math.PI / 2, shadow: false }));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; g.add(M(cyl(0.05, 0.05, 0.7, 5), toon(0x6a7480), Math.cos(a) * 1.2, 0.35, Math.sin(a) * 1.2)); }
  return round(g, 1.25);
}
export function doghouse(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(1.5, 1.1, 1.6, 0.08), toon(o.color ?? 0xd4502f), 0, 0.55, 0));
  g.add(M(roofPrism(1.9, 1.9, 0.75), toon(0x5a4a5e), 0, 1.1, 0));
  g.add(M(circle(0.36, 12), flat(0x2b1a33), 0, 0.44, 0.81));
  return solid(g, 1.5, 1.6);
}
export function gnomeStatue(o = {}) {
  const g = new THREE.Group();
  g.add(M(sphere(0.22, 8, 6), toon(0x3f6fb5), 0, 0.24, 0, { sy: 1.1 }));
  g.add(M(sphere(0.17, 8, 6), toon(0xf2c9a0), 0, 0.56, 0));
  g.add(M(cone(0.16, 0.26, 6), toon(0xfdfbf5), 0, 0.42, 0.1, { rx: Math.PI }));
  g.add(M(cone(0.2, 0.46, 8), toon(o.color ?? 0xc8452d), 0, 0.9, 0));
  return round(g, 0.22);
}
export function birdbath() {
  const g = new THREE.Group();
  g.add(M(cyl(0.12, 0.2, 0.8, 8), toon(0xc9c4ba), 0, 0.4, 0));
  g.add(M(cyl(0.55, 0.3, 0.16, 12), toon(0xc9c4ba), 0, 0.86, 0));
  g.add(M(circle(0.48, 12), toon(0x8fe0ee), 0, 0.95, 0, { rx: -Math.PI / 2, shadow: false }));
  return round(g, 0.4);
}
export function car(o = {}) {
  const c = o.color ?? 0x58b8c9;
  const g = new THREE.Group();
  g.add(M(rbox(3.6, 0.9, 1.9, 0.3), toon(c), 0, 0.75, 0));
  g.add(M(rbox(2.0, 0.8, 1.7, 0.3), toon(shade(c, 0.12)), -0.2, 1.45, 0));
  g.add(M(box(1.8, 0.5, 1.72), toon(0x9fd4e8), -0.2, 1.5, 0, { shadow: false }));
  for (const [x, z] of [[-1.15, 0.9], [1.15, 0.9], [-1.15, -0.9], [1.15, -0.9]]) g.add(M(cyl(0.38, 0.38, 0.3, 10), toon(0x2b1a33), x, 0.38, z, { rx: Math.PI / 2 }));
  return solid(g, 3.6, 1.9);
}
export function coneMarker(o = {}) {
  const g = new THREE.Group();
  g.add(M(cone(0.2, 0.55, 8), toon(o.color ?? 0xf08a24), 0, 0.3, 0));
  g.add(M(box(0.46, 0.05, 0.46), toon(o.color ?? 0xf08a24), 0, 0.03, 0));
  return g;
}
export function ladder(o = {}) {
  const h = o.h ?? 3.6;
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(M(box(0.08, h, 0.08), toon(0xb07a45), s * 0.32, h / 2, 0));
  for (let y = 0.35; y < h; y += 0.42) g.add(M(box(0.64, 0.07, 0.07), toon(0x9a6a3a), 0, y, 0, { shadow: false }));
  g.rotation.x = -0.22;
  return g;
}
export function clothesline(o = {}) {
  const len = o.len ?? 5;
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(M(cyl(0.06, 0.06, 2.1, 6), toon(0xb07a45), s * len / 2, 1.05, 0));
  g.add(M(box(len, 0.03, 0.03), toon(0xfffaf0), 0, 2.0, 0, { shadow: false }));
  const cols = [0xd4502f, 0x58b8c9, 0xffd45a, 0xfffaf0, 0x6aa84f];
  for (let i = 0; i < 5; i++) g.add(M(box(0.55, 0.7, 0.04), toon(cols[i]), -len / 2 + 0.7 + i * (len - 1.4) / 4, 1.62, 0, { rz: rand(-0.06, 0.06) }));
  return g;
}

// ------------------------------------------------------------------ football stuff
export function goalpost(o = {}) {
  const c = o.color ?? 0xffd45a;
  const g = new THREE.Group();
  const w = o.w ?? 5;
  g.add(M(cyl(0.14, 0.18, 2.6, 8), toon(c), 0, 1.3, 0));
  g.add(M(cyl(0.11, 0.11, w, 8), toon(c), 0, 2.6, 0, { rz: Math.PI / 2 }));
  for (const s of [-1, 1]) g.add(M(cyl(0.09, 0.09, 4.2, 8), toon(c), s * w / 2, 4.7, 0));
  if (o.pad !== false) g.add(M(cyl(0.3, 0.3, 1.5, 10), toon(o.padC ?? 0xd4502f), 0, 0.8, 0));
  if (o.crooked) g.rotation.z = o.crooked;
  return round(g, 0.3);
}
export function bleachers(o = {}) {
  const len = o.len ?? 8, rows = o.rows ?? 4;
  const g = new THREE.Group();
  for (let i = 0; i < rows; i++) {
    g.add(M(box(len, 0.16, 0.7), toon(o.color ?? 0xc9d2da), 0, 0.5 + i * 0.5, -i * 0.72));
    g.add(M(box(len, 0.5 + i * 0.5, 0.1), toon(0x8f9aa6), 0, (0.5 + i * 0.5) / 2, -i * 0.72 - 0.3));
  }
  g.userData.tall = rows > 3;
  const s = solid(g, len, rows * 0.72);
  g.userData.solidOff = { x: 0, z: -(rows - 1) * 0.36 };
  return s;
}
export function lightTower(o = {}) {
  const g = new THREE.Group();
  const h = o.h ?? 9;
  g.add(M(cyl(0.16, 0.3, h, 8), toon(0x6a7480), 0, h / 2, 0));
  g.add(M(rbox(2.6, 1.3, 0.4, 0.08), toon(0x4a4a58), 0, h + 0.4, 0, { rx: 0.3 }));
  const on = !!o.on;
  for (let i = 0; i < 6; i++) g.add(M(sphere(0.3, 8, 6), on ? lit(0xfff6d8, 0xfff0b8, 2) : toon(0x9aa3ad), -0.85 + (i % 3) * 0.85, h + 0.12 + Math.floor(i / 3) * 0.6, 0.26, { shadow: false }));
  if (on) { const s = glowSprite(0xfff0b8, 9, 0.55); s.position.set(0, h + 0.4, 0.6); g.add(s); }
  g.userData.tall = true;
  return round(g, 0.35);
}
/** Scoreboard with a live canvas — returns the group; userData.draw(lines, opts) repaints it. */
export function scoreboard(o = {}) {
  const g = new THREE.Group();
  const w = o.w ?? 9, h = o.h ?? 4;
  for (const s of [-1, 1]) g.add(M(cyl(0.2, 0.26, 4, 8), toon(0x4a4a58), s * (w / 2 - 1), 2, 0));
  g.add(M(rbox(w, h, 0.6, 0.15), toon(0x2b2438), 0, 4 + h / 2, 0));
  const cvs = document.createElement('canvas');
  cvs.width = 512; cvs.height = Math.round(512 * (h - 0.5) / (w - 0.5));
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, h - 0.5), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, 4 + h / 2, 0.31);
  g.add(face);
  const draw = (lines = [], opt = {}) => {
    const c = cvs.getContext('2d');
    c.fillStyle = opt.on === false ? '#151220' : '#0e0b18';
    c.fillRect(0, 0, cvs.width, cvs.height);
    if (opt.on !== false) {
      const n = lines.length;
      lines.forEach((ln, i) => {
        const text = typeof ln === 'string' ? ln : ln.t;
        const col = (typeof ln === 'object' && ln.c) || opt.color || '#ffb53c';
        let fs = Math.min(cvs.height / (n + 0.6), (typeof ln === 'object' && ln.s) || 999);
        c.font = `900 ${fs}px ui-monospace, "Courier New", monospace`;
        while (c.measureText(text).width > cvs.width - 30 && fs > 10) { fs -= 2; c.font = `900 ${fs}px ui-monospace, "Courier New", monospace`; }
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = col; c.shadowBlur = 14;
        c.fillStyle = col;
        c.fillText(text, cvs.width / 2, (cvs.height / n) * (i + 0.5));
        c.shadowBlur = 0;
      });
      // LED dot mask
      c.fillStyle = 'rgba(14,11,24,0.38)';
      for (let y = 0; y < cvs.height; y += 4) c.fillRect(0, y, cvs.width, 1.4);
      for (let x = 0; x < cvs.width; x += 4) c.fillRect(x, 0, 1.4, cvs.height);
    }
    tex.needsUpdate = true;
  };
  draw(o.lines || [], { on: o.on, color: o.color });
  g.userData.draw = draw;
  g.userData.face = face;
  g.userData.tall = true;
  g.userData.keep = true;
  return solid(g, w, 0.8);
}
export function tackleDummy() {
  const g = new THREE.Group();
  g.add(M(cyl(0.4, 0.5, 0.3, 10), toon(0x4a4a58), 0, 0.15, 0));
  g.add(M(capsule(0.36, 1.1), toon(0xd4502f), 0, 1.1, 0));
  g.add(M(torus(0.365, 0.04, 4, 14), toon(0xfffaf0), 0, 1.3, 0, { rx: Math.PI / 2, shadow: false }));
  return round(g, 0.45);
}
export function waterCooler() {
  const g = new THREE.Group();
  g.add(M(rbox(1.2, 0.8, 0.8, 0.06), toon(0xb07a45), 0, 0.4, 0));
  g.add(M(cyl(0.34, 0.34, 0.7, 10), toon(0xf08a24), 0, 1.15, 0));
  g.add(M(cyl(0.36, 0.36, 0.1, 10), toon(0xfffaf0), 0, 1.53, 0));
  return solid(g, 1.2, 0.8);
}
export function yardSign(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.04, 0.04, 0.8, 5), toon(0xfffaf0), 0, 0.4, 0));
  const s = signPlane(o.text || '10', 0.8, 0.6, { bg: o.bg || '#f08a24', color: '#fff4dc', radius: 12 });
  s.position.set(0, 0.95, 0.01); g.add(s);
  const b = s.clone(); b.rotation.y = Math.PI; b.position.z = -0.01; g.add(b);
  return g;
}
export function target(o = {}) {
  // a bell on a post — the football-throw switch
  const g = new THREE.Group();
  const h = o.h ?? 2.4;
  if (!o.noPost) g.add(M(cyl(0.07, 0.09, h, 6), toon(0x8a6040), 0, h / 2, 0));
  const head = group(0, h, 0);
  head.add(M(cyl(0.5, 0.5, 0.1, 16), toon(0xfffaf0), 0, 0, 0, { rx: Math.PI / 2 }));
  head.add(M(cyl(0.34, 0.34, 0.11, 16), toon(0xd4502f), 0, 0, 0.01, { rx: Math.PI / 2, shadow: false }));
  head.add(M(cyl(0.15, 0.15, 0.12, 12), toon(0xffd45a), 0, 0, 0.02, { rx: Math.PI / 2, shadow: false }));
  g.add(head);
  g.userData.head = head;
  g.userData.keep = true;
  return round(g, 0.2);
}

// ------------------------------------------------------------------ carnival / fair
export function tent(o = {}) {
  const c = o.color ?? 0xd4502f, c2 = o.color2 ?? 0xfffaf0;
  const g = new THREE.Group();
  const r = o.r ?? 2.4;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU;
    const seg = new THREE.Mesh(cg(`tentseg:${r}`, () => new THREE.CylinderGeometry(r * 0.96, r, 1.9, 3, 1, true, 0, TAU / 8)), toon(i % 2 ? c : c2, { side: THREE.DoubleSide }));
    seg.rotation.y = a0; seg.position.y = 0.95; seg.castShadow = true;
    if (!(o.open && i === 1)) g.add(seg);
    const top = new THREE.Mesh(cg(`tenttop:${r}`, () => new THREE.ConeGeometry(r * 1.12, 1.7, 3, 1, true, 0, TAU / 8)), toon(i % 2 ? c2 : c, { side: THREE.DoubleSide }));
    top.rotation.y = a0; top.position.y = 2.75; top.castShadow = true;
    g.add(top);
  }
  g.add(M(sphere(0.16, 8, 6), toon(0xffd45a), 0, 3.7, 0));
  g.userData.tall = true;
  return round(g, r);
}
export function booth(o = {}) {
  const c = o.color ?? 0x2a6f77;
  const g = new THREE.Group();
  g.add(M(rbox(3, 1.1, 1.4, 0.1), toon(0xfff4dc), 0, 0.55, 0));
  for (let i = 0; i < 6; i++) g.add(M(box(0.5, 1.12, 0.04), toon(i % 2 ? c : 0xfffaf0), -1.25 + i * 0.5, 0.55, 0.71, { shadow: false }));
  for (const s of [-1, 1]) g.add(M(cyl(0.06, 0.06, 2.9, 6), toon(0xfffaf0), s * 1.4, 1.45, 0.6));
  for (let i = 0; i < 6; i++) g.add(M(box(0.5, 0.1, 1.6), toon(i % 2 ? 0xfffaf0 : c), -1.25 + i * 0.5, 2.95, 0.1, { rx: 0.2 }));
  if (o.text) { const s = signPlane(o.text, 2.7, 0.62, { bg: '#2b1a33', color: '#ffd45a', radius: 14 }); s.position.set(0, 3.2, 0.62); s.rotation.x = -0.9; g.add(s); }
  g.userData.tall = true;
  return solid(g, 3, 1.4);
}
export function bunting(x1, z1, x2, z2, o = {}) {
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1);
  g.position.set((x1 + x2) / 2, o.y ?? 3.2, (z1 + z2) / 2);
  g.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
  const cols = o.colors || [0xd4502f, 0xffd45a, 0x2a6f77, 0xfffaf0, 0xf08a24];
  const n = Math.max(3, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const sag = -Math.sin(t * Math.PI) * (o.sag ?? 0.5);
    const f = new THREE.Mesh(cg('flag', () => { const s = new THREE.Shape(); s.moveTo(-0.24, 0); s.lineTo(0.24, 0); s.lineTo(0, -0.5); return new THREE.ShapeGeometry(s); }), toon(cols[i % cols.length], { side: THREE.DoubleSide }));
    f.position.set(-len / 2 + t * len, sag, 0);
    g.add(f);
  }
  return g;
}
export function balloons(o = {}) {
  const g = new THREE.Group();
  const cols = [0xd4502f, 0xffd45a, 0x58b8c9, 0x6aa84f];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.35;
    g.add(M(cyl(0.01, 0.01, 1.6 + i * 0.2, 3), toon(0xfffaf0), x * 0.5, 0.8 + i * 0.1, 0, { rz: -x * 0.3, shadow: false }));
    g.add(M(sphere(0.3, 10, 8), toon(cols[(i + (o.seed || 0)) % 4]), x, 1.8 + i * 0.25, 0, { sy: 1.2 }));
  }
  return g;
}
export function ferrisWheel(o = {}) {
  const g = new THREE.Group();
  const R = 5;
  for (const s of [-1, 1]) { g.add(M(cyl(0.16, 0.22, 7, 6), toon(0xfffaf0), s * 1.4, 3.3, 0, { rz: s * 0.2 })); }
  const wheel = group(0, 6.4, 0);
  wheel.add(M(torus(R, 0.14, 6, 28), toon(0xd4502f)));
  wheel.add(M(torus(R * 0.55, 0.08, 5, 20), toon(0xffd45a)));
  const cols = [0xd4502f, 0xffd45a, 0x58b8c9, 0x6aa84f, 0xf08a24, 0x8a5aa8];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    wheel.add(M(box(R * 2, 0.07, 0.07), toon(0xfffaf0), 0, 0, 0, { rz: a / 2 + (i % 2 ? Math.PI / 8 : 0), shadow: false }));
    const car = M(rbox(0.9, 0.7, 0.7, 0.15), toon(cols[i % 6]), Math.cos(a) * R, Math.sin(a) * R - 0.4, 0);
    wheel.add(car);
  }
  g.add(wheel);
  g.userData.spin = wheel;
  g.userData.tall = true;
  g.userData.keep = true;
  return solid(g, 3.4, 1.2);
}
export function cornBlock(o = {}) {
  const w = o.w ?? 2, d = o.d ?? 2;
  const g = new THREE.Group();
  const r = makeRng(Math.round(w * 31 + d * 17 + (o.seed || 0)));
  const gap = o.gap ?? 0.9;
  const nx = Math.max(1, Math.round(w / gap)), nz = Math.max(1, Math.round(d / gap));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -w / 2 + (i + 0.5) * (w / nx) + r.range(-0.15, 0.15), z = -d / 2 + (j + 0.5) * (d / nz) + r.range(-0.15, 0.15);
    const h = 2.0 + Math.floor(r() * 4) * 0.2;
    g.add(M(cyl(0.05, 0.08, h, 5), toon(0x7fae4a), x, h / 2, z));
    g.add(M(cone(0.42, 1.3, 5), toon(0x9fc45a), x, h * 0.6, z, { shadow: false }));
    g.add(M(sphere(0.1, 5, 4), toon(0xf2c23c), x + 0.16, h * 0.62, z, { rz: -0.5, sy: 2.2, shadow: false }));
  }
  g.userData.tall = true;
  g.userData.light = true;
  return solid(g, w, d);
}
export function scarecrowPost() {
  const g = new THREE.Group();
  g.add(M(cyl(0.07, 0.07, 2.4, 5), toon(0x8a6040), 0, 1.2, 0));
  g.add(M(box(1.8, 0.1, 0.1), toon(0x8a6040), 0, 1.7, 0));
  g.add(M(rbox(0.9, 0.9, 0.4, 0.1), toon(0x4a6fa5), 0, 1.4, 0));
  g.add(M(sphere(0.34, 10, 8), toon(0xd8b98a), 0, 2.25, 0));
  g.add(M(cone(0.5, 0.5, 8), toon(0x6b4a2e), 0, 2.7, 0));
  return round(g, 0.3);
}
export function stage(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(8, 0.8, 4, 0.1), toon(0xb07a45), 0, 0.4, 0));
  g.add(M(box(8, 4.4, 0.2), toon(0x8a5aa8), 0, 3, -1.9));
  for (const s of [-1, 1]) g.add(M(cyl(0.12, 0.12, 5, 6), toon(0xfffaf0), s * 3.9, 2.9, 1.8));
  g.add(M(rbox(8.4, 0.5, 4.4, 0.1), toon(0xd4502f), 0, 5.5, 0));
  g.userData.tall = true;
  return solid(g, 8, 4);
}

// ------------------------------------------------------------------ frost
export function snowPile(o = {}) {
  const s = o.s ?? 1;
  const g = new THREE.Group();
  g.add(M(sphere(0.9, 10, 6), toon(0xffffff), 0, 0, 0, { s, sy: 0.5 * s }));
  return round(g, 0.8 * s);
}
export function cabin(o = {}) {
  const g = house({ w: 6, d: 4.6, h: 2.9, wall: 0x9a6a40, roof: 0xffffff, doorC: 0xd4502f, night: o.night, roofH: 2.1, porch: false });
  for (let i = 0; i < 5; i++) g.add(M(cyl(0.16, 0.16, 6.1, 6), toon(0x86592f), 0, 0.5 + i * 0.6, 2.32, { rz: Math.PI / 2, shadow: false }));
  return g;
}
export function igloo() {
  const g = new THREE.Group();
  g.add(M(cg('igloo', () => new THREE.SphereGeometry(2, 14, 8, 0, TAU, 0, Math.PI / 2)), toon(0xeaf6fc), 0, 0, 0));
  g.add(M(rbox(1.3, 1.2, 1.2, 0.3), toon(0xd8ecf8), 0, 0.6, 1.9));
  g.add(M(circle(0.45, 12), flat(0x2b3a5a), 0, 0.5, 2.52));
  g.userData.tall = true;
  return round(g, 2);
}
export function icicleRock(o = {}) {
  const s = o.s ?? 1;
  const g = new THREE.Group();
  g.add(M(cg('rock', () => new THREE.DodecahedronGeometry(0.6, 0)), toon(0x9fb8d8), 0, 0.5 * s, 0, { s: 1.3 * s }));
  g.add(M(sphere(0.6, 8, 5), toon(0xffffff), 0, 0.95 * s, 0, { s, sy: 0.35 * s }));
  return round(g, 0.75 * s);
}
export function skiLift() {
  const g = new THREE.Group();
  g.add(M(cyl(0.2, 0.3, 7, 6), toon(0x6a7480), 0, 3.5, 0));
  g.add(M(box(3, 0.2, 0.2), toon(0x6a7480), 0, 7, 0));
  g.add(M(rbox(1.2, 0.3, 0.6, 0.05), toon(0xd4502f), 1.2, 5.2, 0));
  g.add(M(cyl(0.03, 0.03, 1.7, 4), toon(0x4a4a58), 1.2, 6.1, 0));
  g.userData.tall = true;
  return round(g, 0.35);
}

// ------------------------------------------------------------------ neon boardwalk
export function neonSign(o = {}) {
  const c = o.color ?? 0xff5ad0;
  const g = new THREE.Group();
  const w = o.w ?? 3.4, h = o.h ?? 1.2;
  const hex = `#${new THREE.Color(c).getHexString()}`;
  g.add(M(rbox(w + 0.3, h + 0.3, 0.2, 0.08), toon(0x1b1630), 0, o.y ?? 3.2, 0));
  const s = signPlane(o.text || 'OPEN', w, h, { color: hex, stroke: '#ffffff', strokeW: 2 });
  s.position.set(0, o.y ?? 3.2, 0.11); g.add(s);
  const gl = glowSprite(c, Math.max(w, 3) * 1.5, 0.35); gl.position.set(0, o.y ?? 3.2, 0.5); g.add(gl);
  if (!o.wall) for (const sx of [-1, 1]) g.add(M(cyl(0.07, 0.07, (o.y ?? 3.2), 6), toon(0x2b2438), sx * (w / 2 - 0.2), (o.y ?? 3.2) / 2, 0));
  return solid(g, w, 0.3);
}
export function arcadeCabinet(o = {}) {
  const c = o.color ?? 0x5a3f8a, n = o.neon ?? 0x58e6ff;
  const g = new THREE.Group();
  g.add(M(rbox(1.0, 2.0, 0.9, 0.08), toon(c), 0, 1.0, 0));
  g.add(M(box(0.8, 0.6, 0.05), lit(n, n, 1.2), 0, 1.45, 0.46, { rx: -0.15, shadow: false }));
  g.add(M(box(0.9, 0.3, 0.1), lit(0xffd45a, 0xffd45a, 0.9), 0, 1.93, 0.42, { shadow: false }));
  g.add(M(box(0.9, 0.1, 0.4), toon(0x2b2438), 0, 1.0, 0.5, { rx: 0.2 }));
  g.add(M(sphere(0.06, 6, 5), toon(0xd4502f), -0.2, 1.12, 0.55, { shadow: false }));
  return solid(g, 1.0, 0.9);
}
export function palm(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.16, 0.26, 4, 7), toon(0xb08a5a), 0, 2, 0, { rz: 0.08 }));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.add(M(cone(0.42, 2.3, 4), toon(o.color ?? 0x3fae7a), Math.cos(a) * 0.9 - 0.3, 3.9, Math.sin(a) * 0.9, { rz: -Math.cos(a) * 1.25 - 0.08, rx: Math.sin(a) * 1.25, sz: 0.35 })); }
  g.userData.tall = true;
  g.userData.light = true;
  return round(g, 0.3);
}
export function railing(x1, z1, x2, z2, o = {}) {
  return fence(x1, z1, x2, z2, { style: 'rail', color: o.color ?? 0xd9dde2, h: 1.0 });
}
export function pierPost() {
  const g = new THREE.Group();
  g.add(M(cyl(0.22, 0.26, 1.6, 8), toon(0x7a5a40), 0, 0.8, 0));
  g.add(M(torus(0.24, 0.05, 5, 10), toon(0xd9c9a8), 0, 1.3, 0, { rx: Math.PI / 2, shadow: false }));
  return round(g, 0.26);
}
export function arenaFront(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(18, 6, 5, 0.4), toon(0x3a2f5e), 0, 3, 0));
  g.add(M(cg('dome', () => new THREE.SphereGeometry(8.6, 20, 8, 0, TAU, 0, Math.PI / 2)), toon(0x4a3f7a), 0, 5.4, -1.5, { sy: 0.45, sz: 0.6 }));
  const dr = door(0x1b1630, 2.6, 2.8); dr.position.set(0, 0, 2.5); g.add(dr);
  const s = signPlane(o.text || 'BUZZER DOME', 9, 1.5, { color: o.lit ? '#58e6ff' : '#6a6490', stroke: o.lit ? '#ffffff' : null, strokeW: 2, bg: '#1b1630', radius: 20 });
  s.position.set(0, 4.3, 2.52); g.add(s);
  if (o.lit) { const gl = glowSprite(0x58e6ff, 14, 0.35); gl.position.set(0, 4.3, 3.2); g.add(gl); }
  g.userData.tall = true;
  g.userData.doorX = 0;
  return solid(g, 18, 5);
}

// ------------------------------------------------------------------ interiors
export function wallSeg(o = {}) {
  const w = o.w ?? 10, h = o.h ?? 3.4;
  const g = new THREE.Group();
  g.add(M(box(w, h, 0.3), toon(o.color ?? 0xf2e2c4), 0, h / 2, 0));
  g.add(M(box(w, 0.4, 0.34), toon(shade(o.color ?? 0xf2e2c4, -0.25)), 0, 0.2, 0, { shadow: false }));
  return solid(g, w, 0.3);
}
export function counter(o = {}) {
  const w = o.w ?? 4;
  const g = new THREE.Group();
  g.add(M(rbox(w, 1.05, 0.9, 0.08), toon(o.color ?? 0xd4502f), 0, 0.52, 0));
  g.add(M(rbox(w + 0.16, 0.12, 1.06, 0.05), toon(o.top ?? 0xf2f2ea), 0, 1.1, 0));
  return solid(g, w, 0.9);
}
export function stool(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.05, 0.16, 0.7, 6), toon(0xc9d2da), 0, 0.35, 0));
  g.add(M(cyl(0.3, 0.3, 0.14, 12), toon(o.color ?? 0xd4502f), 0, 0.76, 0));
  return round(g, 0.3);
}
export function table(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.08, 0.3, 0.8, 8), toon(0xc9d2da), 0, 0.4, 0));
  g.add(M(cyl(0.8, 0.8, 0.1, 16), toon(o.color ?? 0xf2f2ea), 0, 0.84, 0));
  return round(g, 0.75);
}
export function boothSeat(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0xd4502f;
  g.add(M(rbox(1.8, 0.5, 0.7, 0.1), toon(c), 0, 0.3, 0));
  g.add(M(rbox(1.8, 1.2, 0.22, 0.1), toon(c), 0, 0.75, -0.3));
  return solid(g, 1.8, 0.7);
}
export function locker(o = {}) {
  const g = new THREE.Group();
  const n = o.n ?? 3;
  for (let i = 0; i < n; i++) {
    g.add(M(rbox(0.8, 2.2, 0.7, 0.05), toon(o.color ?? 0x2a6f77), (i - (n - 1) / 2) * 0.82, 1.1, 0));
    g.add(M(box(0.3, 0.08, 0.02), toon(0x2b1a33), (i - (n - 1) / 2) * 0.82, 1.75, 0.36, { shadow: false }));
  }
  return solid(g, n * 0.82, 0.7);
}
export function bed(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(1.6, 0.5, 2.6, 0.12), toon(0xb07a45), 0, 0.3, 0));
  g.add(M(rbox(1.5, 0.3, 2.4, 0.12), toon(o.color ?? 0xf08a24), 0, 0.62, 0.05));
  g.add(M(rbox(1.1, 0.24, 0.6, 0.1), toon(0xfffaf0), 0, 0.8, -0.85));
  g.add(M(rbox(1.7, 1.1, 0.16, 0.06), toon(0x9a6a3a), 0, 0.7, -1.3));
  return solid(g, 1.6, 2.6);
}
export function rug(o = {}) {
  const g = new THREE.Group();
  const m = M(cyl(o.r ?? 1.6, o.r ?? 1.6, 0.04, 20), toon(o.color ?? 0xd4502f), 0, 0.03, 0, { shadow: false });
  g.add(m);
  g.add(M(cyl((o.r ?? 1.6) * 0.7, (o.r ?? 1.6) * 0.7, 0.045, 20), toon(o.color2 ?? 0xffd45a), 0, 0.035, 0, { shadow: false }));
  return g;
}
export function trophy(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0xffd45a;
  g.add(M(rbox(0.5, 0.2, 0.5, 0.04), toon(0x2b1a33), 0, 0.1, 0));
  g.add(M(cyl(0.06, 0.1, 0.3, 6), toon(c), 0, 0.35, 0));
  g.add(M(cyl(0.26, 0.12, 0.4, 10), toon(c), 0, 0.7, 0));
  for (const s of [-1, 1]) g.add(M(torus(0.12, 0.03, 4, 8, Math.PI), toon(c), s * 0.26, 0.72, 0, { rz: -s * Math.PI / 2 }));
  return round(g, 0.3);
}
export function shelf(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(o.w ?? 2.4, 2.2, 0.5, 0.06), toon(0x9a6a3a), 0, 1.1, 0));
  for (let i = 0; i < 3; i++) g.add(M(box((o.w ?? 2.4) - 0.2, 0.06, 0.46), toon(0xd9b98a), 0, 0.5 + i * 0.6, 0.03, { shadow: false }));
  const cols = [0xd4502f, 0x2a6f77, 0xffd45a, 0x6aa84f, 0xf08a24];
  for (let i = 0; i < 7; i++) g.add(M(box(0.18, 0.4, 0.3), toon(cols[i % 5]), -0.9 + i * 0.26, 0.75 + (i % 2) * 0.6, 0.06, { shadow: false }));
  return solid(g, o.w ?? 2.4, 0.5);
}
export function chalkboard(o = {}) {
  const g = new THREE.Group();
  g.add(M(rbox(3.4, 2.0, 0.14, 0.05), toon(0x9a6a3a), 0, 1.9, 0));
  const tex = canvasTex(256, 144, (c) => {
    c.fillStyle = '#2f5a4a'; c.fillRect(0, 0, 256, 144);
    c.strokeStyle = '#f4f0e6'; c.lineWidth = 3; c.lineCap = 'round';
    c.font = `900 22px ${FONT}`; c.fillStyle = '#f4f0e6';
    for (const [x, y] of [[60, 100], [100, 104], [128, 100], [156, 104], [196, 100]]) { c.beginPath(); c.arc(x, y, 8, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(60, 90); c.quadraticCurveTo(60, 40, 110, 30); c.stroke();
    c.beginPath(); c.moveTo(196, 90); c.lineTo(196, 50); c.lineTo(160, 36); c.stroke();
    c.beginPath(); c.moveTo(128, 90); c.lineTo(128, 60); c.stroke();
    for (const [x, y] of [[90, 60], [150, 64], [128, 30]]) { c.beginPath(); c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7); c.moveTo(x + 7, y - 7); c.lineTo(x - 7, y + 7); c.stroke(); }
    if (o.text) c.fillText(o.text, 12, 24);
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: tex }));
  p.position.set(0, 1.9, 0.08); g.add(p);
  for (const s of [-1, 1]) g.add(M(cyl(0.05, 0.05, 1.0, 5), toon(0x6a4a3a), s * 1.4, 0.5, 0));
  return solid(g, 3.4, 0.4);
}
export function jukebox() {
  const g = new THREE.Group();
  g.add(M(rbox(1.1, 1.7, 0.7, 0.3), toon(0x8a5aa8), 0, 0.85, 0));
  g.add(M(box(0.8, 0.5, 0.05), lit(0xffd45a, 0xffb53c, 1.1), 0, 1.25, 0.36, { shadow: false }));
  g.add(M(torus(0.5, 0.06, 5, 14, Math.PI), lit(0xff7a5a, 0xff7a5a, 1.2), 0, 1.2, 0.3, { shadow: false }));
  return solid(g, 1.1, 0.7);
}
export function beanbag(o = {}) {
  const g = new THREE.Group();
  g.add(M(sphere(0.7, 12, 8), toon(o.color ?? 0x2a6f77), 0, 0.4, 0, { sy: 0.62 }));
  return round(g, 0.65);
}
export function plant(o = {}) {
  const g = new THREE.Group();
  g.add(M(cyl(0.3, 0.22, 0.45, 8), toon(0xb5654a), 0, 0.23, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.add(M(sphere(0.2, 6, 5), toon(0x5f9a4a), Math.cos(a) * 0.2, 0.75 + (i % 2) * 0.2, Math.sin(a) * 0.2, { sy: 1.8 })); }
  return round(g, 0.3);
}
export function poster(o = {}) {
  const s = signPlane(o.text || 'GO\nLANTERNS', o.w ?? 1.4, o.h ?? 1.8, { bg: o.bg || '#f08a24', color: o.color || '#fff4dc', radius: 10, border: '#2b1a33' });
  const g = new THREE.Group();
  s.position.y = o.y ?? 2.2;
  g.add(s);
  return g;
}

export const PROPS = {
  house, clubhouse, diner, arcade, shop, shed, busStop, bus, tree, bush, hedge, rock, stump, pumpkin, leafPile, flowers,
  mailbox, lamp, bench, signPost, arrowSign, hydrant, trashcan, dumpster, crate, hayBale, iceBlock, sprinkler, lawnChair, foldingChair, grill,
  picnicTable, kiddiePool, trampoline, doghouse, gnomeStatue, birdbath, car, coneMarker, ladder, clothesline,
  goalpost, bleachers, lightTower, scoreboard, tackleDummy, waterCooler, yardSign, target,
  tent, booth, balloons, ferrisWheel, cornBlock, scarecrowPost, stage,
  snowPile, cabin, igloo, icicleRock, skiLift, neonSign, arcadeCabinet, palm, pierPost, arenaFront,
  wallSeg, counter, stool, table, boothSeat, locker, bed, rug, trophy, shelf, chalkboard, jukebox, beanbag, plant, poster,
};
