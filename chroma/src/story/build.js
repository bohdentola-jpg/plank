// Level-building helpers shared by the hubs and the three sectors: rooms with
// door gaps, floors, floating islands, signs and per-sector decor (pipes, tanks,
// chandeliers, portraits, carpets...).
import * as THREE from 'three';
import { signTexture } from '../world/textures.js';
import { canvasTexture, HFONT, BFONT, std, glowMat, gooMat, part, rod } from './kit.js';

export const WALL = { mat: 'container', color: 0xa8989f };
export const WOOD = { mat: 'wood', color: 0xd8b892 };
// sector palettes
export const S1 = { floor: { mat: 'concrete', color: 0xd9b48c }, floor2: { mat: 'concrete', color: 0xcfa985 }, wall: WALL, dark: { mat: 'concreteDark', color: 0xa89c98 }, grate: { mat: 'grate', color: 0xc0b8c4 }, wood: WOOD };
export const S2 = { floor: { mat: 'tiles', color: 0xd4eef2 }, floor2: { mat: 'tiles', color: 0xbfe0e8 }, wall: { mat: 'container', color: 0x8fb4c2 }, dark: { mat: 'concreteDark', color: 0x9ab4bc }, grate: { mat: 'grate', color: 0xb4c8cc }, wood: { mat: 'wood', color: 0xc8b090 }, tank: 0x5f8a96, pipe: 0x4f7f8c };
export const S3 = { floor: { mat: 'woodFloor', color: 0xc4ab94 }, floor2: { mat: 'tiles', color: 0xd8d4dc }, wall: { mat: 'wallpaper', color: 0x9a94a6 }, dark: { mat: 'brick', color: 0x9e9aa6 }, grate: { mat: 'grate', color: 0xa8a4b0 }, wood: { mat: 'wood', color: 0x9a7a62 }, stone: { mat: 'concreteDark', color: 0xb8b4c0 } };

export const sign = (c, text, p, w, h, yaw, o = {}) => c.sign(signTexture(text, { w: 1024, h: Math.round(1024 * h / w), size: o.size || 120, bg: o.bg || '#1b1530', fg: o.fg || '#f4f1ea', accent: o.accent || '#8b8794', font: HFONT }), p, w, h, yaw);

// floor slab with its top at y
export const floor = (c, x0, x1, z0, z1, y, m = S1.floor, o = {}) => c.box([x0, y - (o.thick ?? 1), z0], [x1, y, z1], { ...m, bottom: !!o.bottom });

// four walls around [x0,x1]x[z0,z1] from y up h, leaving gaps (ranges along each side)
// gaps: { s: [[a,b]], n: [...], w: [...], e: [...] } (s = min-z side, w = min-x side)
export function walls(c, x0, x1, z0, z1, y, h, gaps = {}, m = S1.wall, t = 1) {
  const seg = (lo, hi, list) => {
    const out = []; let a = lo;
    for (const [g0, g1] of [...(list || [])].sort((p, q) => p[0] - q[0])) { if (g0 > a) out.push([a, g0]); a = Math.max(a, g1); }
    if (a < hi) out.push([a, hi]);
    return out;
  };
  for (const [a, b] of seg(x0 - t, x1 + t, gaps.s)) c.wall([a, y, z0 - t], [b, y + h, z0], m);
  for (const [a, b] of seg(x0 - t, x1 + t, gaps.n)) c.wall([a, y, z1], [b, y + h, z1 + t], m);
  for (const [a, b] of seg(z0, z1, gaps.w)) c.wall([x0 - t, y, a], [x0, y + h, b], m);
  for (const [a, b] of seg(z0, z1, gaps.e)) c.wall([x1, y, a], [x1 + t, y + h, b], m);
}

// lintel over a door gap so the wall reads as continuous above it
export function lintel(c, a, b, y0, y1, side, m = S1.wall) { c.box(side.min ? [a[0], y0, a[1]] : [a[0], y0, a[1]], [b[0], y1, b[1]], m); }

// floating island with a column fading into the fog below
export function island(c, min, max, m = S1.floor, colColor = 0x5d5866) {
  c.box(min, max, { ...m, bottom: true });
  c.column((min[0] + max[0]) / 2, (min[2] + max[2]) / 2, (max[0] - min[0]) * 0.55, (max[2] - min[2]) * 0.55, min[1] + 0.01, -70, colColor);
}

export function crates(c, list, m = WOOD) { for (const [x, y, z, s = 1.6, h = s] of list) c.box([x - s / 2, y, z - s / 2], [x + s / 2, y + h, z + s / 2], m); }

// ---------------------------------------------------------------- sector 2 decor
export function tank(c, p, r = 2, h = 5, color = S2.tank, collide = true) {
  c.vat(p, r, h, color, null);
  // glass gauge with sloshing gray inside
  const g = new THREE.Group(); g.position.set(...p); c.decor.add(g);
  const glass = c.mat('tankGlass', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false }));
  part(g, new THREE.CylinderGeometry(0.22, 0.22, h * 0.7, 10), glass, { pos: [r * 0.72, h * 0.45, r * 0.72], shadow: false });
  part(g, new THREE.CylinderGeometry(0.17, 0.17, h * 0.4, 10), c.mat('tankGoo', () => gooMat(0x8b8794)), { pos: [r * 0.72, h * 0.3, r * 0.72], shadow: false });
  if (collide) c.box([p[0] - r * 0.9, p[1], p[2] - r * 0.9], [p[0] + r * 0.9, p[1] + h, p[2] + r * 0.9], { render: false, paintable: false });
}
export function waterStrip(c, x0, x1, z0, z1, y, color = 0x2aa8c0) {
  const m = c.mat('water' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.8, emissive: new THREE.Color(color).multiplyScalar(0.15) }));
  part(c.decor, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), m, { pos: [(x0 + x1) / 2, y, (z0 + z1) / 2], shadow: false, receive: true });
}
export function goo(c, x0, x1, z0, z1, y, color = 0x7d7a88) {
  const m = c.mat('goopool' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, emissive: 0x111014 }));
  part(c.decor, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), m, { pos: [(x0 + x1) / 2, y, (z0 + z1) / 2], shadow: false, receive: true });
}
export function valveWheel(c, p, yaw = 0, color = 0xc8643c) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = yaw; c.decor.add(g);
  const m = c.mat('valve' + color, () => std(color, 0.4, 0.6));
  part(g, new THREE.TorusGeometry(0.45, 0.07, 8, 20), m, { shadow: false });
  for (let i = 0; i < 3; i++) part(g, new THREE.BoxGeometry(0.85, 0.06, 0.06), m, { rot: [0, 0, (i * Math.PI) / 3], shadow: false });
  return g;
}

// ---------------------------------------------------------------- sector 3 decor
export function chandelier(c, p, color = 0xffd6a0, o = {}) {
  const g = new THREE.Group(); g.position.set(...p); c.decor.add(g);
  const brass = c.mat('brass', () => std(0x8a7a5a, 0.35, 0.8));
  part(g, new THREE.TorusGeometry(0.9, 0.05, 6, 24), brass, { rot: [Math.PI / 2, 0, 0], shadow: false });
  part(g, new THREE.TorusGeometry(0.5, 0.04, 6, 18), brass, { pos: [0, -0.3, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
  rod(g, [0, 0, 0], [0, o.hang ?? 3, 0], 0.03, brass, { shadow: false });
  const flame = c.mat('flame' + color, () => glowMat(color, 3));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6), c.mat('candle', () => std(0xf4f1ea, 0.6)), { pos: [Math.cos(a) * 0.9, 0.12, Math.sin(a) * 0.9], shadow: false });
    part(g, new THREE.SphereGeometry(0.05, 6, 4), flame, { pos: [Math.cos(a) * 0.9, 0.28, Math.sin(a) * 0.9], shadow: false });
  }
  if (o.light !== false) c.light([p[0], p[1] + 0.2, p[2]], color, { intensity: o.intensity ?? 20, dist: o.dist ?? 14 });
  return g;
}
let portraitTex = null;
function portraitTexture(c) {
  if (portraitTex && portraitTex.image) return portraitTex;
  portraitTex = canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#5a5662'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8b8794'; ctx.fillRect(18, 18, w - 36, h - 36);
    // the Baron, in gray, with his top hat and monocle
    ctx.fillStyle = '#b9b5c4'; ctx.beginPath(); ctx.ellipse(w / 2, 150, 52, 62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d1b22'; ctx.fillRect(w / 2 - 44, 52, 88, 58); ctx.fillRect(w / 2 - 66, 104, 132, 12);
    ctx.fillStyle = '#6d5f86'; ctx.fillRect(w / 2 - 44, 94, 88, 10);
    ctx.strokeStyle = '#c9a640'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(w / 2 + 20, 145, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3b3745'; ctx.beginPath(); ctx.moveTo(40, h - 18); ctx.lineTo(w / 2, 210); ctx.lineTo(w - 40, h - 18); ctx.fill();
    ctx.fillStyle = '#f4f1ea'; ctx.font = `800 18px ${BFONT}`; ctx.textAlign = 'center'; ctx.fillText('B. GRISAILLE', w / 2, h - 30);
  });
  return portraitTex;
}
export function portrait(c, p, yaw = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = yaw; c.decor.add(g);
  const frame = c.mat('frame', () => std(0x8a7a5a, 0.35, 0.7));
  part(g, new THREE.BoxGeometry(1.7 * s, 2.1 * s, 0.1), frame, { shadow: false });
  part(g, new THREE.PlaneGeometry(1.4 * s, 1.8 * s), c.mat('portrait', () => new THREE.MeshStandardMaterial({ map: portraitTexture(c), roughness: 0.8 })), { pos: [0, 0, 0.06], shadow: false });
  return g;
}
export function carpet(c, x0, x1, z0, z1, y, color = 0x6d2f3a) {
  const m = c.mat('carpet' + color, () => std(color, 0.95));
  part(c.decor, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), m, { pos: [(x0 + x1) / 2, y + 0.012, (z0 + z1) / 2], shadow: false, receive: true });
}
export function curtain(c, p, w, h, yaw = 0, color = 0x5a4a5e) {
  const m = c.mat('curtain' + color, () => std(color, 0.9, 0, { side: THREE.DoubleSide }));
  const geo = new THREE.PlaneGeometry(w, h, 16, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 6) * 0.08);
  geo.computeVertexNormals();
  part(c.decor, geo, m, { pos: p, rot: [0, yaw, 0], shadow: false });
}
export function bust(c, p, yaw = 0) {
  const g = new THREE.Group(); g.position.set(...p); g.rotation.y = yaw; c.decor.add(g);
  const stone = c.mat('bustStone', () => std(0xb9b5c4, 0.7));
  part(g, new THREE.CylinderGeometry(0.35, 0.4, 1.1, 12), stone, { pos: [0, 0.55, 0] });
  part(g, new THREE.SphereGeometry(0.3, 14, 10), stone, { pos: [0, 1.45, 0] });
  part(g, new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), c.mat('bustHat', () => std(0x2b2833, 0.5)), { pos: [0, 1.85, 0] });
  part(g, new THREE.CylinderGeometry(0.32, 0.32, 0.03, 12), c.mat('bustHat', () => std(0x2b2833, 0.5)), { pos: [0, 1.68, 0] });
  return g;
}
