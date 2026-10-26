// The football: a slightly pointed prolate spheroid (11 in long, 22 in round
// the middle), pebbled brown leather with four seamed panels, white laces
// stitched over one seam (a raised strip and cross-stitches in the mesh, so
// they catch the light and break the silhouette), optional white stripes on
// the two lace-side panels for the college / high-school ball.
//
//   const ball = createBallModel({ stripes: false, lod: 'high' });
//   ball.group → THREE.Group in yards. Long axis = local +z (nose), laces on +y.
//   Spin a spiral with ball.group.rotateZ(...) (rotation about the long axis).
import * as THREE from 'three';
import { M_TO_YD } from '../sim/field.js';
import { makeRng } from '../core/util.js';

const LEN = 11 * 0.0254;           // 0.2794 m
const RAD = (22 * 0.0254) / (2 * Math.PI);   // 0.0889 m
const EXP = 0.72;                  // profile exponent (< 1 = pointier than an ellipse)

export function ballRadiusAt(z) {
  const k = 1 - (2 * z / LEN) ** 2;
  return k <= 0 ? 0 : RAD * Math.pow(k, EXP);
}

const texCache = new Map();
function ballTextures(stripes) {
  const key = stripes ? 's' : 'p';
  if (texCache.has(key)) return texCache.get(key);
  const W = 512, H = 256;
  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const bmp = document.createElement('canvas'); bmp.width = W; bmp.height = H;
  const c = col.getContext('2d'), b = bmp.getContext('2d');
  const rng = makeRng(stripes ? 21 : 12);
  // leather base with a slight tonal drift
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#5e3218'); g.addColorStop(0.25, '#6a381b'); g.addColorStop(0.5, '#5a2f16'); g.addColorStop(0.75, '#683a1d'); g.addColorStop(1, '#5e3218');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
  // pebbles
  for (let i = 0; i < 9000; i++) {
    const x = rng() * W, y = rng() * H, r = 0.8 + rng() * 1.3;
    const lit = rng();
    c.fillStyle = lit < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,200,150,0.07)';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    b.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.3})`;
    b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
  }
  // wear: darker toward the tips, scuffs
  const tip = c.createLinearGradient(0, 0, 0, H);
  tip.addColorStop(0, 'rgba(20,8,2,0.45)'); tip.addColorStop(0.18, 'rgba(20,8,2,0)'); tip.addColorStop(0.82, 'rgba(20,8,2,0)'); tip.addColorStop(1, 'rgba(20,8,2,0.45)');
  c.fillStyle = tip; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) {
    c.fillStyle = `rgba(150,110,80,${0.05 + rng() * 0.06})`;
    c.beginPath(); c.ellipse(rng() * W, rng() * H, 4 + rng() * 14, 1 + rng() * 3, rng() * 3, 0, Math.PI * 2); c.fill();
  }
  // college stripes on the two lace-side panels (u 0 … 0.5 holds the lace seam at 0.25)
  if (stripes) {
    for (const v of [0.2, 0.8]) {
      c.fillStyle = '#efece4';
      c.fillRect(0, v * H - 7, W * 0.5, 14);
      b.fillStyle = '#9a9a9a';
      b.fillRect(0, v * H - 7, W * 0.5, 14);
    }
  }
  // seams between the four panels: a dark groove
  for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    c.fillStyle = 'rgba(15,6,2,0.85)'; c.fillRect(u * W - 1.5, 0, 3, H);
    b.fillStyle = '#202020'; b.fillRect(u * W - 2.5, 0, 5, H);
    b.fillStyle = '#5a5a5a'; b.fillRect(u * W - 4.5, 0, 2, H); b.fillRect(u * W + 2.5, 0, 2, H);
  }
  // stitch dots along the seams
  for (const u of [0.0, 0.5, 0.75, 1.0]) {
    for (let y = 6; y < H; y += 7) {
      c.fillStyle = 'rgba(200,170,130,0.35)';
      c.fillRect(u * W - 4, y, 2, 2); c.fillRect(u * W + 2, y + 3, 2, 2);
    }
  }
  // lace region swatch (white) for the lace geometry: bottom-right corner
  c.fillStyle = '#f1efe8'; c.fillRect(W - 24, H - 24, 24, 24);
  b.fillStyle = '#c0c0c0'; b.fillRect(W - 24, H - 24, 24, 24);
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bmp);
  bump.colorSpace = THREE.NoColorSpace;
  const t = { map, bump };
  texCache.set(key, t);
  return t;
}

const geoCache = new Map();
function ballGeometry(lod) {
  if (geoCache.has(lod)) return geoCache.get(lod);
  const radial = lod === 'low' ? 12 : 26, along = lod === 'low' ? 8 : 18;
  const pts = [];
  for (let i = 0; i <= along; i++) {
    const t = i / along;
    // cluster samples toward the tips where the curvature is high
    const z = (-0.5 + 0.5 * (1 - Math.cos(t * Math.PI))) * LEN;
    pts.push(new THREE.Vector2(Math.max(ballRadiusAt(z), i === 0 || i === along ? 0 : 0.002), z));
  }
  // lathe around Y; then turn so the long axis is +z with the u = 0.25 seam (laces) on +y
  const lathe = new THREE.LatheGeometry(pts, radial);
  // lathe axis y → z (after Rx 90°: u 0 → −y, 0.25 → +x, 0.5 → +y); then turn the
  // u = 0.25 seam (the laces) from +x up to +y
  lathe.rotateX(Math.PI / 2);
  lathe.rotateZ(Math.PI / 2);
  const parts = [lathe];
  if (lod !== 'low') {
    // raised lace strip along the top seam + 8 cross stitches
    const uvW = [1 - 12 / 512, 12 / 256];
    const strip = new THREE.BoxGeometry(0.009, 0.004, 0.105);
    strip.translate(0, ballRadiusAt(0) + 0.0012, 0);
    parts.push(strip);
    for (let i = 0; i < 8; i++) {
      const z = -0.042 + i * 0.012;
      const lace = new THREE.BoxGeometry(0.024, 0.003, 0.004);
      lace.translate(0, ballRadiusAt(z) + 0.0015, z);
      parts.push(lace);
    }
    for (const p of parts.slice(1)) {
      const a = p.attributes.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, uvW[0], uvW[1]);
    }
  }
  const g = mergeGeos(parts);
  for (const p of parts) p.dispose();
  g.computeBoundingSphere();
  geoCache.set(lod, g);
  return g;
}

function mergeGeos(list) {
  let n = 0, idx = 0;
  for (const g of list) { n += g.attributes.position.count; idx += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const index = new Uint16Array(idx);
  let vo = 0, io = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nrm.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < c; i++) index[io++] = vo + i;
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

const matCache = new Map();

/** A football. opts: { stripes: bool, lod: 'high' | 'low' }. */
export function createBallModel(opts = {}) {
  const stripes = !!opts.stripes, lod = opts.lod === 'low' ? 'low' : 'high';
  const key = `${stripes}|${lod}`;
  let mat = matCache.get(key);
  if (!mat) {
    const t = ballTextures(stripes);
    mat = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: lod === 'high' ? t.bump : null, bumpScale: 0.6, roughness: 0.58, metalness: 0, envMapIntensity: 0.7 });
    matCache.set(key, mat);
  }
  const mesh = new THREE.Mesh(ballGeometry(lod), mat);
  mesh.castShadow = true;
  mesh.name = 'football';
  const group = new THREE.Group();
  group.name = 'ball';
  group.add(mesh);
  group.scale.setScalar(M_TO_YD);
  return {
    group, mesh,
    length: LEN * M_TO_YD, radius: RAD * M_TO_YD,
    dispose() { group.removeFromParent(); },
  };
}
