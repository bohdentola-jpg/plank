// NEST & NOOK: the furniture catalog for the player's house. Every item is
// built from three.js primitives + a few canvas textures; no asset files.
// Also: wallpaper / floor styles, the starter layout and save migration.
import * as THREE from 'three';
import { rng, fbm } from '../util.js';

// ---------------------------------------------------------------- geometry helpers
const GEO = new Map();
const SHARED = new WeakSet();
const cg = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); SHARED.add(g); } return g; };
export const isSharedGeo = (g) => SHARED.has(g);
export const box = (w, h, d) => cg(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, s = 20, open = false) => cg(`c${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
export const sph = (r, ws = 20, hs = 14) => cg(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const rbox = (w, h, d, r = 0.04, s = 2) => cg(`r${w},${h},${d},${r},${s}`, () => roundedBox(w, h, d, r, s));
export const lathe = (key, pts, seg = 24) => cg(`l${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
export const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => cg(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));

// Box with rounded edges and corners (vertices concentrated near the edges).
export function roundedBox(w, h, d, r = 0.04, s = 2) {
  r = Math.max(0.001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const n = s * 2 + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const map = (v, half) => {
    const i = Math.round((v + 0.5) * n);
    return i <= s ? -half + r * (i / s) : half - r + r * ((i - s - 1) / s);
  };
  const H = [w / 2, h / 2, d / 2];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), dlt = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set(map(pos.getX(i), H[0]), map(pos.getY(i), H[1]), map(pos.getZ(i), H[2]));
    q.set(Math.max(-H[0] + r, Math.min(H[0] - r, p.x)), Math.max(-H[1] + r, Math.min(H[1] - r, p.y)), Math.max(-H[2] + r, Math.min(H[2] - r, p.z)));
    dlt.subVectors(p, q);
    const l = dlt.length();
    if (l > 1e-6) { dlt.divideScalar(l); p.copy(q).addScaledVector(dlt, r); nor.setXYZ(i, dlt.x, dlt.y, dlt.z); }
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeBoundingSphere();
  return g;
}

// Merge many small parts into one vertex-colored geometry (books, bulbs...).
export function mergeParts(parts) {
  const P = [], N = [], C = [];
  const m = new THREE.Matrix4(), e = new THREE.Euler(), qq = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), t = new THREE.Vector3();
  const col = new THREE.Color();
  for (const pt of parts) {
    const g = (pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone());
    t.set(...(pt.pos || [0, 0, 0])); e.set(...(pt.rot || [0, 0, 0])); qq.setFromEuler(e);
    if (pt.scale) s.set(...pt.scale); else s.set(1, 1, 1);
    g.applyMatrix4(m.compose(t, qq, s));
    col.set(pt.color ?? 0xffffff);
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      P.push(pa.getX(i), pa.getY(i), pa.getZ(i)); N.push(na.getX(i), na.getY(i), na.getZ(i)); C.push(col.r, col.g, col.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.computeBoundingSphere();
  return out;
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const FONT = '"Lilita One", "Arial Black", sans-serif';
const SPLAT_PATH = 'M50 4c8 0 9 13 17 14s15-9 21-2-5 15 0 22 16 6 12 16-16 3-20 9 1 19-8 21-11-10-19-8-10 15-19 11 1-15-6-20-19 2-20-8 11-11 10-19-13-8-11-17 14-5 20-11-2-22 6-25 8 8 15 6 3-7 9-7z';

// ---------------------------------------------------------------- material kit (one per house visit)
export class FurnKit {
  constructor(ink = '#ff2e88') {
    this.ink = new THREE.Color(ink);
    this.inkHex = '#' + this.ink.getHexString();
    this.cache = new Map();
    this.env = 0.45; // interiors: tone the outdoor sky reflections down
  }
  m(key, make) { let v = this.cache.get(key); if (!v) { v = make(); this.cache.set(key, v); } return v; }
  dispose() {
    for (const v of this.cache.values()) {
      if (v?.isTexture) v.dispose();
      else if (v?.isMaterial) { for (const k of ['map', 'emissiveMap', 'normalMap']) v[k]?.dispose?.(); v.dispose(); }
    }
    this.cache.clear();
  }
  tex(key, make) { return this.m('tex:' + key, make); }
  std(color, rough = 0.6, metal = 0, extra = {}) {
    return this.m(`std${color}${rough}${metal}${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: this.env, ...extra }));
  }
  wood(tint = 0xd9a066) {
    return this.m('wood' + tint, () => new THREE.MeshStandardMaterial({ color: tint, map: this.tex('wood', woodTexture), roughness: 0.62, envMapIntensity: this.env }));
  }
  fab(color) {
    return this.m('fab' + color, () => {
      const c = new THREE.Color(color);
      return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.86, sheen: 0.8, sheenRoughness: 0.55, sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.45), envMapIntensity: this.env * 0.6 });
    });
  }
  plas(color, rough = 0.32) {
    return this.m(`plas${color}${rough}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: this.env }));
  }
  metal(color = 0xd4d9e2, rough = 0.28) { return this.std(color, rough, 0.85); }
  brass() { return this.std(0xe0b04a, 0.3, 0.9); }
  dark() { return this.std(0x262838, 0.5, 0.2); }
  glow(color, i = 2.5) {
    return this.m(`glow${color}${i}`, () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: i, roughness: 0.4, envMapIntensity: 0 }));
  }
  glass(opacity = 0.18, color = 0xdff6ff) {
    return this.m(`glass${opacity}${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, transparent: true, opacity, clearcoat: 1, depthWrite: false, envMapIntensity: 1 }));
  }
  ceramic(color) { return this.plas(color, 0.22); }
  leaf(color = 0x3f9b4b) { return this.m('leaf' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: this.env })); }
  vcol(rough = 0.7) { return this.m('vcol' + rough, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, envMapIntensity: this.env })); }
  picture(key, w, h, draw, extra = {}) {
    return this.m('pic' + key, () => {
      const c = canvas(w, h); draw(c.getContext('2d'), w, h, this);
      return new THREE.MeshStandardMaterial({ map: canvasTex(c), roughness: 0.75, envMapIntensity: this.env, ...extra });
    });
  }
  // additive warm light pool (fake lamp light on the floor / table)
  pool(color = 0xffc98a) {
    return this.m('pool' + color, () => {
      const c = canvas(128, 128), x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      const col = new THREE.Color(color);
      const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
      g.addColorStop(0, `rgba(${rgb},0.55)`); g.addColorStop(0.45, `rgba(${rgb},0.2)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      return new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    });
  }
}

function woodTexture() {
  const c = canvas(256, 256), x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let i = 0; i < 256; i++) {
    const n = fbm(i / 256 * 3, y / 256 * 24, 3, 5, 0);
    const g = Math.sin(i / 256 * 50 + n * 10) * 0.5 + 0.5;
    const k = 0.84 + g * 0.1 + (fbm(i / 64, y / 64, 2, 9, 0) - 0.5) * 0.12;
    const o = (y * 256 + i) * 4;
    img.data[o] = 255 * k; img.data[o + 1] = 236 * k; img.data[o + 2] = 214 * k; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return canvasTex(c, { repeat: true });
}

// ---------------------------------------------------------------- build helpers
function mk() {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  return { g, add };
}
const legs4 = (add, mat, w, d, h, inset = 0.06, r = 0.025, taper = 0.6) => {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(r * taper, r, h, 10), mat, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset));
};
const PAL = { peach: 0xffb38a, coral: 0xff7a6b, mint: 0x8fe3c8, teal: 0x2ec4b6, lilac: 0xb9a3ff, mustard: 0xffc94d, navy: 0x34397a, rose: 0xff8fb8, sage: 0x9cc59a, cream: 0xfff1d6, sky: 0x8fc8ff, plum: 0x7a3b69 };
const WOOD = { honey: 0xffd09a, walnut: 0x9c6a46, oak: 0xffe2b8, dark: 0x6b4630 };

// quilted blanket / pillow canvas
function quilt(ctx, w, h, k, base, line) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = line; ctx.lineWidth = 3;
  for (let i = -h; i < w; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + h, 0); ctx.lineTo(i, h); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 53) % w, (i * 97) % h, 4, 0, 6.3); ctx.fill(); }
}

function rugCanvas(kind, k) {
  return (ctx, w, h) => {
    const R = rng(11);
    if (kind === 'round') {
      const cols = ['#f4c27a', '#e86a5a', '#fff1d6', '#4fb7a6', '#f4c27a', '#fff1d6'];
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - i * (w / 26), 0, 7); ctx.fillStyle = cols[i % cols.length]; ctx.fill(); }
    } else if (kind === 'stripe') {
      const cols = ['#3d405b', '#f2cc8f', '#e07a5f', '#f4f1de', '#81b29a'];
      for (let i = 0; i < 15; i++) { ctx.fillStyle = cols[i % 5]; ctx.fillRect(i * w / 15, 0, w / 15 + 1, h); }
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
    } else if (kind === 'checker') {
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { ctx.fillStyle = (x + y) % 2 ? '#fff1d6' : '#ff8fb8'; ctx.fillRect(x * w / 6, y * h / 6, w / 6 + 1, h / 6 + 1); }
    }
    // knit noise
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = 0.9 + R() * 0.16; img.data[i] *= n; img.data[i + 1] *= n; img.data[i + 2] *= n; }
    ctx.putImageData(img, 0, 0);
  };
}

function posterArt(title, sub, bg, fg, art) {
  return (ctx, w, h, k) => {
    const R = rng(title.length * 7 + 3);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(R() * w, R() * h, 10 + R() * 40, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (art === 'splat') {
      ctx.save(); ctx.translate(w / 2 - 90, 40); ctx.scale(1.8, 1.8); ctx.fillStyle = k.inkHex; ctx.fill(new Path2D(SPLAT_PATH)); ctx.restore();
      ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.arc(w / 2 - 22, 120, 16, 0, 7); ctx.arc(w / 2 + 22, 120, 16, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2 - 18, 116, 6, 0, 7); ctx.arc(w / 2 + 26, 116, 6, 0, 7); ctx.fill();
    } else if (art === 'music') {
      for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ffd21a', '#ff2e88', '#3cf03c', '#29b6ff', '#fff'][i]; ctx.fillRect(40 + i * 36, 200 - (40 + R() * 120), 26, 40 + R() * 120); }
      ctx.fillStyle = '#fff'; ctx.font = `90px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('♪', w / 2, 80 + 40);
    } else if (art === 'wave') {
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = ['#29b6ff', '#fff', '#3cf03c'][i % 3]; ctx.lineWidth = 10; ctx.beginPath(); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, 110 + i * 20 + Math.sin(x / 22 + i) * 12); ctx.stroke(); }
      ctx.fillStyle = '#ffd21a'; ctx.beginPath(); ctx.arc(w * 0.72, 70, 34, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = fg; ctx.strokeStyle = '#1b1530'; ctx.lineWidth = 8;
    ctx.font = `46px ${FONT}`; ctx.strokeText(title, w / 2, h - 80, w - 24); ctx.fillText(title, w / 2, h - 80, w - 24);
    ctx.font = `24px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText(sub, w / 2, h - 40, w - 30); ctx.fillText(sub, w / 2, h - 40, w - 30);
  };
}

function frame(add, k, w, h, d, mat) {
  const t = 0.06;
  add(box(w, t, d), mat, 0, h / 2 - t / 2, 0); add(box(w, t, d), mat, 0, -h / 2 + t / 2, 0);
  add(box(t, h - 2 * t, d), mat, w / 2 - t / 2, 0, 0); add(box(t, h - 2 * t, d), mat, -w / 2 + t / 2, 0, 0);
}

// leaf shape (monstera / fig), flat in XY, pointing +Y
function leafGeo(kind) {
  return cg('leaf' + kind, () => {
    const s = new THREE.Shape();
    if (kind === 'monstera') {
      s.moveTo(0, 0); s.bezierCurveTo(0.28, 0.02, 0.34, 0.3, 0.2, 0.46); s.bezierCurveTo(0.12, 0.54, 0.03, 0.56, 0, 0.5);
      s.bezierCurveTo(-0.03, 0.56, -0.12, 0.54, -0.2, 0.46); s.bezierCurveTo(-0.34, 0.3, -0.28, 0.02, 0, 0);
      for (const sx of [-1, 1]) for (const y of [0.16, 0.3]) { const hl = new THREE.Path(); hl.absellipse(sx * 0.15, y, 0.05, 0.022, 0, Math.PI * 2, false, sx * 0.5); s.holes.push(hl); }
    } else {
      s.moveTo(0, 0); s.bezierCurveTo(0.16, 0.05, 0.17, 0.3, 0, 0.42); s.bezierCurveTo(-0.17, 0.3, -0.16, 0.05, 0, 0);
    }
    const g = new THREE.ShapeGeometry(s, 10);
    return g;
  });
}

// animated canvas screens
function screenTex(w, h) {
  const c = canvas(w, h);
  return { c, x: c.getContext('2d'), tex: canvasTex(c) };
}

// ---------------------------------------------------------------- the catalog
// kind: 'floor' (blocks), 'small' (no collider, fits on tables), 'rug' (under everything), 'wall'
// w/d: footprint in metres (x/z, front faces +z); wall items: w/h on the wall. top: surface height.
// cols: local collider rects [x0,z0,x1,z1,height]; seats: [x, z, seatHeight].
export const CATS = { sleep: 'Beds', sit: 'Seating', tables: 'Tables', storage: 'Storage', lights: 'Lights', plants: 'Plants', rugs: 'Rugs', wall: 'Wall', fun: 'Fun & Tech', kitchen: 'Kitchen' };

export const FURNITURE = {
  // ======================================================== beds
  bed_single: {
    name: 'Snooze Single', cat: 'sleep', price: 600, kind: 'floor', w: 1.5, d: 2.5, h: 1.15, use: 'sleep',
    cols: [[-0.75, -1.25, 0.75, 1.25, 0.55], [-0.75, -1.25, 0.75, -1.0, 1.15]],
    desc: 'A comfy single bed with a quilted blanket. Jumping on it is allowed.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.honey);
      add(rbox(1.5, 0.22, 2.4, 0.04), wd, 0, 0.23, 0.05);
      legs4(add, wd, 1.44, 2.3, 0.14, 0.08, 0.04, 1);
      add(rbox(1.38, 0.22, 2.3, 0.08), k.fab(PAL.cream), 0, 0.44, 0.06);
      add(rbox(1.46, 0.07, 1.55, 0.03), k.picture('quiltRose', 256, 256, (c, w, h) => quilt(c, w, h, k, '#ff8fb8', 'rgba(255,255,255,0.55)')), 0, 0.57, 0.42);
      add(rbox(1.42, 0.06, 0.25, 0.03), k.fab(0xffd0e2), 0, 0.565, -0.35, 0.18);
      add(rbox(0.85, 0.15, 0.42, 0.07), k.fab(0xffffff), 0, 0.62, -0.88, -0.25);
      const hb = add(rbox(1.5, 0.95, 0.12, 0.05), wd, 0, 0.62, -1.19);
      void hb;
      add(rbox(1.25, 0.6, 0.06, 0.04), k.fab(PAL.peach), 0, 0.72, -1.12);
      return { group: g };
    },
  },
  bed_double: {
    name: 'Dreamboat Double', cat: 'sleep', price: 1800, kind: 'floor', w: 2.5, d: 2.5, h: 1.4, use: 'sleep',
    cols: [[-1.25, -1.25, 1.25, 1.25, 0.6], [-1.25, -1.25, 1.25, -1.0, 1.4]],
    desc: 'Room for you, two pillows and a very big dream.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.walnut);
      add(rbox(2.45, 0.26, 2.4, 0.05), wd, 0, 0.24, 0.05);
      legs4(add, wd, 2.4, 2.3, 0.12, 0.1, 0.05, 1);
      add(rbox(2.3, 0.24, 2.28, 0.09), k.fab(0xfffaf0), 0, 0.48, 0.06);
      add(rbox(2.4, 0.08, 1.5, 0.035), k.picture('quiltMustard', 256, 256, (c, w, h) => quilt(c, w, h, k, '#ffc94d', 'rgba(255,255,255,0.5)')), 0, 0.62, 0.45);
      for (const sx of [-0.55, 0.55]) add(rbox(0.85, 0.17, 0.45, 0.08), k.fab(sx < 0 ? 0xffffff : PAL.sky), sx, 0.68, -0.82, -0.3);
      add(rbox(2.5, 1.3, 0.16, 0.07), k.fab(PAL.navy), 0, 0.78, -1.17);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) add(sph(0.025, 8, 6), k.brass(), -0.84 + i * 0.56, 0.75 + j * 0.36, -1.08);
      return { group: g };
    },
  },
  bunk_bed: {
    name: 'Bunk Buddy', cat: 'sleep', price: 2200, kind: 'floor', w: 1.5, d: 2.5, h: 2.1, use: 'sleep',
    cols: [[-0.75, -1.25, 0.75, 1.25, 0.5], [-0.75, -1.25, 0.75, -0.95, 2.1], [-0.75, -1.25, 0.75, 1.25, 2.0, 1.45]],
    desc: 'Two beds stacked like pancakes. Top bunk is for the brave.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.oak);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rbox(0.1, 2.1, 0.1, 0.03), wd, sx * 0.7, 1.05, sz * 1.2);
      for (const y of [0.3, 1.45]) {
        add(rbox(1.5, 0.12, 2.5, 0.03), wd, 0, y, 0);
        add(rbox(1.36, 0.18, 2.36, 0.07), k.fab(PAL.cream), 0, y + 0.15, 0);
        add(rbox(1.4, 0.06, 1.4, 0.03), k.fab(y < 1 ? PAL.teal : PAL.coral), 0, y + 0.26, 0.45);
        add(rbox(0.8, 0.13, 0.38, 0.06), k.fab(0xffffff), 0, y + 0.3, -0.9);
      }
      add(rbox(1.5, 0.1, 0.06, 0.02), wd, 0, 1.75, 1.22); add(rbox(0.06, 0.1, 2.4, 0.02), wd, 0.72, 1.75, 0);
      // ladder at the foot
      for (const sx of [0.3, 0.62]) add(rbox(0.05, 1.5, 0.05, 0.02), wd, sx, 0.95, 1.3);
      for (let i = 0; i < 4; i++) add(cyl(0.02, 0.02, 0.32, 8), wd, 0.46, 0.45 + i * 0.32, 1.3, 0, 0, Math.PI / 2);
      return { group: g };
    },
  },

  // ======================================================== seating
  sofa: {
    name: 'Puff Sofa', cat: 'sit', price: 1400, kind: 'floor', w: 2.5, d: 1.0, h: 0.92, use: 'sit', seats: [[-0.55, 0.06, 0.5], [0.55, 0.06, 0.5]],
    cols: [[-1.25, -0.5, 1.25, 0.5, 0.5], [-1.25, -0.5, 1.25, -0.22, 0.92], [-1.25, -0.5, -1.0, 0.5, 0.68], [1.0, -0.5, 1.25, 0.5, 0.68]],
    desc: 'Squishy two-seater. Perfect for watching PRISM NEWS.',
    build(k) {
      const { g, add } = mk();
      const f = k.fab(PAL.teal), f2 = k.fab(0x5fd9cc);
      add(rbox(2.3, 0.26, 0.92, 0.06), f, 0, 0.25, 0);
      for (const sx of [-0.55, 0.55]) {
        add(rbox(1.08, 0.17, 0.74, 0.07), f2, sx, 0.45, 0.08);
        add(rbox(1.08, 0.5, 0.24, 0.1), f2, sx, 0.66, -0.3, -0.14);
      }
      for (const sx of [-1, 1]) add(rbox(0.22, 0.55, 0.96, 0.09), f, sx * 1.12, 0.4, 0);
      add(rbox(0.36, 0.34, 0.12, 0.05), k.fab(PAL.mustard), -0.85, 0.66, -0.12, -0.2, 0.3, 0.15);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.03, 0.02, 0.12, 8), k.wood(WOOD.walnut), sx * 1.08, 0.06, sz * 0.38);
      return { group: g };
    },
  },
  armchair: {
    name: 'Cozy Armchair', cat: 'sit', price: 800, kind: 'floor', w: 1.0, d: 1.0, h: 0.95, use: 'sit', seats: [[0, 0.06, 0.5]],
    cols: [[-0.5, -0.5, 0.5, 0.5, 0.5], [-0.5, -0.5, 0.5, -0.2, 0.95]],
    desc: 'A big soft chair that hugs you back.',
    build(k) {
      const { g, add } = mk();
      const f = k.fab(PAL.mustard), f2 = k.fab(0xffd97a);
      add(rbox(0.9, 0.26, 0.88, 0.06), f, 0, 0.27, 0);
      add(rbox(0.6, 0.17, 0.7, 0.07), f2, 0, 0.46, 0.08);
      add(rbox(0.9, 0.62, 0.22, 0.1), f, 0, 0.66, -0.34, -0.12);
      for (const sx of [-1, 1]) add(rbox(0.18, 0.5, 0.86, 0.08), f, sx * 0.38, 0.45, 0.02);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.03, 0.018, 0.14, 8), k.wood(WOOD.walnut), sx * 0.36, 0.07, sz * 0.34, sz * 0.15, 0, -sx * 0.15);
      return { group: g };
    },
  },
  beanbag: {
    name: 'Blob Beanbag', cat: 'sit', price: 300, kind: 'floor', w: 1.0, d: 1.0, h: 0.5, use: 'sit', seats: [[0, 0.05, 0.38]],
    cols: [[-0.42, -0.42, 0.42, 0.42, 0.36]],
    desc: 'Squish! Like sitting on a friendly cloud of ink.',
    build(k) {
      const { g, add } = mk();
      const geo = lathe('bean', [[0, 0], [0.4, 0.02], [0.48, 0.12], [0.47, 0.26], [0.38, 0.36], [0.22, 0.38], [0.12, 0.33], [0, 0.34]], 28);
      add(geo, k.fab(PAL.coral), 0, 0, 0);
      const back = add(lathe('beanBack', [[0, 0], [0.3, 0.02], [0.36, 0.18], [0.3, 0.36], [0.16, 0.44], [0, 0.45]], 24), k.fab(PAL.coral), 0, 0.12, -0.24);
      back.scale.set(1, 1, 0.65);
      return { group: g };
    },
  },
  chair: {
    name: 'Bistro Chair', cat: 'sit', price: 250, kind: 'floor', w: 0.5, d: 0.5, h: 0.95, use: 'sit', seats: [[0, 0.02, 0.48]],
    cols: [[-0.24, -0.24, 0.24, 0.24, 0.48]],
    desc: 'A sturdy wooden chair for desks and dinners.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.honey);
      add(rbox(0.46, 0.05, 0.44, 0.02), wd, 0, 0.46, 0);
      add(rbox(0.36, 0.04, 0.34, 0.02), k.fab(PAL.rose), 0, 0.5, 0.01);
      legs4(add, wd, 0.44, 0.42, 0.44, 0.04, 0.02, 0.8);
      for (const sx of [-1, 1]) add(rbox(0.04, 0.5, 0.04, 0.015), wd, sx * 0.19, 0.72, -0.19);
      for (let i = 0; i < 3; i++) add(rbox(0.38, 0.06, 0.03, 0.012), wd, 0, 0.62 + i * 0.12, -0.19);
      return { group: g };
    },
  },
  stool: {
    name: 'Bar Stool', cat: 'sit', price: 200, kind: 'floor', w: 0.5, d: 0.5, h: 0.72, use: 'sit', seats: [[0, 0, 0.72]],
    cols: [[-0.2, -0.2, 0.2, 0.2, 0.72]],
    desc: 'Tall and spinny. Pairs great with the kitchen counter.',
    build(k) {
      const { g, add } = mk();
      add(cyl(0.2, 0.19, 0.07, 24), k.plas(PAL.coral), 0, 0.7, 0);
      add(cyl(0.025, 0.025, 0.66, 10), k.metal(), 0, 0.36, 0);
      add(cyl(0.18, 0.2, 0.03, 24), k.metal(), 0, 0.015, 0);
      add(torus(0.13, 0.012, 6, 24), k.metal(), 0, 0.28, 0, Math.PI / 2);
      return { group: g };
    },
  },
  gaming_chair: {
    name: 'Racer Chair', cat: 'sit', price: 900, kind: 'floor', w: 1.0, d: 1.0, h: 1.35, use: 'sit', seats: [[0, 0.04, 0.52]],
    cols: [[-0.3, -0.3, 0.3, 0.3, 0.52], [-0.3, -0.36, 0.3, -0.2, 1.35]],
    desc: 'Go-fast stripes in your ink color. +10 style.',
    build(k) {
      const { g, add } = mk();
      const blk = k.std(0x23242e, 0.55, 0.1), ink = k.plas(k.ink.getHex(), 0.4);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(box(0.05, 0.04, 0.34), blk, Math.sin(a) * 0.17, 0.06, Math.cos(a) * 0.17, 0, a, 0);
        add(sph(0.035, 8, 6), blk, Math.sin(a) * 0.33, 0.035, Math.cos(a) * 0.33);
      }
      add(cyl(0.035, 0.035, 0.36, 10), k.metal(0x9aa0aa), 0, 0.24, 0);
      add(rbox(0.56, 0.12, 0.54, 0.05), blk, 0, 0.46, 0.02);
      add(rbox(0.3, 0.02, 0.46, 0.01), ink, 0, 0.52, 0.03);
      const back = new THREE.Group(); back.position.set(0, 0.52, -0.24); back.rotation.x = -0.12; g.add(back);
      add(rbox(0.54, 0.82, 0.12, 0.06), blk, 0, 0.42, 0, 0, 0, 0, back);
      for (const sx of [-1, 1]) add(rbox(0.07, 0.7, 0.13, 0.03), ink, sx * 0.18, 0.4, 0.02, 0, 0, 0, back);
      add(rbox(0.3, 0.1, 0.08, 0.04), k.fab(0x2b2d3a), 0, 0.72, 0.08, 0, 0, 0, back);
      for (const sx of [-1, 1]) { add(box(0.05, 0.2, 0.05), blk, sx * 0.29, 0.6, -0.02); add(rbox(0.08, 0.04, 0.3, 0.02), blk, sx * 0.29, 0.71, 0.02); }
      return { group: g };
    },
  },

  // ======================================================== tables
  coffee_table: {
    name: 'Low Table', cat: 'tables', price: 450, kind: 'floor', w: 1.5, d: 1.0, h: 0.45, top: 0.45,
    desc: 'A low wooden table with a shelf for comics.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.honey);
      add(rbox(1.42, 0.06, 0.9, 0.025), wd, 0, 0.42, 0);
      legs4(add, wd, 1.36, 0.84, 0.4, 0.05, 0.03, 0.7);
      add(box(1.22, 0.03, 0.7), wd, 0, 0.12, 0);
      const cols = [0xff6b6b, 0x4ecdc4, 0xffe66d];
      cols.forEach((c, i) => add(box(0.3, 0.012, 0.22), k.std(c, 0.7), -0.35 + i * 0.05, 0.141 + i * 0.012, 0.05 + i * 0.02, 0, 0.2 * i, 0));
      return { group: g };
    },
  },
  dining_table: {
    name: 'Dining Table', cat: 'tables', price: 900, kind: 'floor', w: 2.0, d: 1.0, h: 0.78, top: 0.78,
    desc: 'Seats four. Eats... also four.',
    build(k) {
      const { g, add } = mk();
      add(rbox(1.96, 0.06, 0.96, 0.025), k.wood(WOOD.oak), 0, 0.75, 0);
      add(box(1.7, 0.08, 0.7), k.std(0xf6f1e8, 0.5), 0, 0.68, 0);
      legs4(add, k.std(0xf6f1e8, 0.5), 1.82, 0.82, 0.72, 0.05, 0.035, 0.7);
      return { group: g };
    },
  },
  round_table: {
    name: 'Café Table', cat: 'tables', price: 400, kind: 'floor', w: 1.0, d: 1.0, h: 0.75, top: 0.75,
    desc: 'A little round table for snacks and board games.',
    build(k) {
      const { g, add } = mk();
      add(cyl(0.48, 0.48, 0.04, 32), k.std(0xfaf6ee, 0.35), 0, 0.73, 0);
      add(cyl(0.03, 0.04, 0.7, 12), k.metal(0x2b2f45, 0.4), 0, 0.37, 0);
      add(cyl(0.22, 0.25, 0.03, 24), k.metal(0x2b2f45, 0.4), 0, 0.015, 0);
      return { group: g };
    },
  },
  side_table: {
    name: 'Nightstand', cat: 'tables', price: 300, kind: 'floor', w: 0.5, d: 0.5, h: 0.6, top: 0.6,
    desc: 'One drawer for snacks, one top for a lamp.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.honey);
      add(rbox(0.46, 0.38, 0.42, 0.03), wd, 0, 0.4, 0);
      add(rbox(0.4, 0.15, 0.02, 0.01), k.std(PAL.mint, 0.5), 0, 0.46, 0.21);
      add(sph(0.022, 8, 6), k.brass(), 0, 0.46, 0.23);
      legs4(add, wd, 0.42, 0.38, 0.22, 0.03, 0.018, 0.7);
      return { group: g };
    },
  },
  desk: {
    name: 'Study Desk', cat: 'tables', price: 700, kind: 'floor', w: 1.5, d: 1.0, h: 0.78, top: 0.78, fixed: true, use: 'catalog',
    cols: [[-0.75, -0.45, 0.75, 0.3, 0.78]],
    desc: 'Your desk, with the laptop that runs the NEST & NOOK catalog. It stays with you.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.oak), wht = k.std(0xf4efe6, 0.45);
      add(rbox(1.48, 0.05, 0.72, 0.02), wd, 0, 0.755, -0.1);
      add(rbox(0.42, 0.7, 0.66, 0.02), wht, -0.5, 0.36, -0.1);
      for (let i = 0; i < 3; i++) { add(box(0.36, 0.18, 0.02), k.std(PAL.sky, 0.5), -0.5, 0.17 + i * 0.22, 0.235); add(box(0.1, 0.02, 0.02), k.brass(), -0.5, 0.21 + i * 0.22, 0.25); }
      add(rbox(0.05, 0.73, 0.6, 0.02), wht, 0.69, 0.36, -0.1);
      // laptop
      const lap = new THREE.Group(); lap.position.set(0.12, 0.78, -0.08); g.add(lap);
      add(rbox(0.5, 0.025, 0.34, 0.01), k.metal(0xc9ced8, 0.35), 0, 0.012, 0.02, 0, 0, 0, lap);
      const lid = new THREE.Group(); lid.position.set(0, 0.025, -0.15); lid.rotation.x = -0.28; lap.add(lid);
      add(rbox(0.5, 0.33, 0.02, 0.01), k.metal(0xc9ced8, 0.35), 0, 0.165, 0, 0, 0, 0, lid);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.29), k.m('laptopScreen', () => {
        const c = canvas(256, 160), x = c.getContext('2d');
        const gr = x.createLinearGradient(0, 0, 256, 160); gr.addColorStop(0, '#ffefd8'); gr.addColorStop(1, '#ffd6e8');
        x.fillStyle = gr; x.fillRect(0, 0, 256, 160);
        x.fillStyle = '#1b1530'; x.font = `30px ${FONT}`; x.textAlign = 'center'; x.fillText('NEST & NOOK', 128, 42);
        const cols = ['#ff8fb8', '#8fe3c8', '#ffc94d', '#b9a3ff', '#8fc8ff', '#ff7a6b'];
        for (let i = 0; i < 6; i++) { x.fillStyle = '#fff'; x.fillRect(22 + (i % 3) * 74, 58 + Math.floor(i / 3) * 48, 64, 40); x.fillStyle = cols[i]; x.beginPath(); x.arc(54 + (i % 3) * 74, 78 + Math.floor(i / 3) * 48, 13, 0, 7); x.fill(); }
        return new THREE.MeshStandardMaterial({ map: canvasTex(c), emissive: 0xffffff, emissiveMap: canvasTex(c), emissiveIntensity: 0.9, roughness: 0.3 });
      }));
      scr.position.set(0, 0.165, 0.011); lid.add(scr);
      // mug + pencil cup + plant
      add(cyl(0.04, 0.035, 0.09, 14), k.ceramic(PAL.coral), -0.45, 0.83, -0.25);
      add(cyl(0.035, 0.035, 0.1, 12), k.ceramic(0xfaf6ee), -0.58, 0.83, -0.32);
      for (let i = 0; i < 3; i++) add(cyl(0.006, 0.006, 0.16, 6), k.std([0xffd21a, 0x3cf03c, 0x1e6bff][i], 0.5), -0.58 + (i - 1) * 0.012, 0.9, -0.32, 0, 0, (i - 1) * 0.15);
      add(cyl(0.18, 0.18, 0.02, 20), k.pool(0xbfe0ff), 0.12, 0.781, 0.02);
      return { group: g, update: null };
    },
  },

  // ======================================================== storage
  bookshelf: {
    name: 'Tall Bookshelf', cat: 'storage', price: 900, kind: 'floor', w: 1.5, d: 0.5, h: 2.2, top: 2.2,
    desc: 'Packed with comics, cookbooks and ink-fighting manuals.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.walnut);
      add(box(1.46, 2.2, 0.03), wd, 0, 1.1, -0.21);
      for (const sx of [-1, 1]) add(box(0.04, 2.2, 0.44), wd, sx * 0.71, 1.1, 0);
      for (let i = 0; i < 5; i++) add(box(1.4, 0.035, 0.42), wd, 0, 0.04 + i * 0.53, 0);
      add(box(1.46, 0.04, 0.46), wd, 0, 2.18, 0);
      const R = rng(42), parts = [];
      const cols = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x6b5bff, 0xff9ec7, 0x2b2f45, 0xf4f1ea, 0x3cf03c, 0xff7a00];
      for (let s = 0; s < 4; s++) {
        let x = -0.66;
        while (x < 0.62) {
          const bw = 0.035 + R() * 0.04, bh = 0.26 + R() * 0.16;
          if (R() < 0.12 && x < 0.4) { x += 0.12; continue; }
          parts.push({ geo: box(bw, bh, 0.3), pos: [x + bw / 2, 0.06 + s * 0.53 + bh / 2, 0.02], color: cols[Math.floor(R() * cols.length)] });
          x += bw + 0.004;
        }
      }
      add(mergeParts(parts), k.vcol(0.65), 0, 0, 0);
      add(cyl(0.07, 0.06, 0.12, 12), k.ceramic(PAL.mint), 0.45, 2.26, 0);
      for (let i = 0; i < 4; i++) add(sph(0.07, 8, 6), k.leaf(0x4fb04a), 0.45 + Math.sin(i * 1.7) * 0.06, 2.36 + (i % 2) * 0.04, Math.cos(i * 1.7) * 0.05);
      return { group: g };
    },
  },
  dresser: {
    name: 'Mint Dresser', cat: 'storage', price: 700, kind: 'floor', w: 1.5, d: 0.5, h: 1.0, top: 1.0,
    desc: 'Three drawers of socks. Top is perfect for lamps and trophies.',
    build(k) {
      const { g, add } = mk();
      const body = k.std(PAL.mint, 0.45), wd = k.wood(WOOD.oak);
      add(rbox(1.44, 0.86, 0.44, 0.03), body, 0, 0.53, 0);
      add(rbox(1.48, 0.04, 0.48, 0.015), wd, 0, 0.98, 0);
      for (let i = 0; i < 3; i++) { add(rbox(1.32, 0.24, 0.02, 0.01), k.std(0xb8f0de, 0.45), 0, 0.27 + i * 0.27, 0.22); add(rbox(0.24, 0.03, 0.03, 0.012), k.brass(), 0, 0.27 + i * 0.27, 0.24); }
      legs4(add, wd, 1.4, 0.4, 0.1, 0.06, 0.03, 0.7);
      return { group: g };
    },
  },
  tv_stand: {
    name: 'Media Console', cat: 'storage', price: 500, kind: 'floor', w: 2.0, d: 0.5, h: 0.5, top: 0.5,
    desc: 'A low console. Put a TV on it. Or a cactus. You do you.',
    build(k) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.walnut);
      add(rbox(1.94, 0.36, 0.44, 0.025), wd, 0, 0.3, 0);
      for (const sx of [-1, 1]) add(rbox(0.56, 0.28, 0.02, 0.01), k.std(0xf4efe6, 0.5), sx * 0.62, 0.3, 0.22);
      add(box(0.66, 0.26, 0.4), k.std(0x1d1b24, 0.6), 0, 0.3, 0.03);
      add(rbox(0.3, 0.06, 0.2, 0.02), k.plas(0xf4f1ea), 0, 0.22, 0.06);
      add(box(0.02, 0.01, 0.02), k.glow(0x3cf03c, 3), 0.1, 0.25, 0.165);
      legs4(add, wd, 1.9, 0.4, 0.12, 0.08, 0.025, 0.6);
      return { group: g };
    },
  },

  // ======================================================== fun & tech
  tv: {
    name: 'Flat TV', cat: 'fun', price: 1200, kind: 'small', w: 1.5, d: 0.5, h: 0.95, use: 'tv',
    desc: 'Big, bright and always showing cartoons. Press E to switch it on or off.',
    build(k) {
      const { g, add } = mk();
      const blk = k.std(0x15161c, 0.35, 0.3);
      add(rbox(1.4, 0.82, 0.05, 0.02), blk, 0, 0.53, 0);
      add(box(0.06, 0.12, 0.05), blk, 0, 0.07, -0.02);
      add(rbox(0.44, 0.03, 0.22, 0.012), blk, 0, 0.015, -0.02);
      const S = screenTex(256, 144);
      const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: S.tex, emissiveIntensity: 1.1, roughness: 0.25 });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.74), mat);
      scr.position.set(0, 0.53, 0.026); g.add(scr);
      let last = -1;
      const draw = (t, on) => {
        const x = S.x;
        if (!on) { x.fillStyle = '#050508'; x.fillRect(0, 0, 256, 144); S.tex.needsUpdate = true; return; }
        const cols = ['#ff2e88', '#ffd21a', '#3cf03c', '#29b6ff', '#a335ff'];
        for (let i = 0; i < 8; i++) { x.fillStyle = cols[(i + Math.floor(t * 2)) % 5]; x.beginPath(); x.moveTo(128, 72); x.arc(128, 72, 200, i * Math.PI / 4 + t * 0.6, (i + 1) * Math.PI / 4 + t * 0.6); x.fill(); }
        const by = 92 - Math.abs(Math.sin(t * 3.2)) * 40;
        x.fillStyle = k.inkHex; x.beginPath(); x.ellipse(128, by, 26, 22 + Math.abs(Math.cos(t * 3.2)) * 4, 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(118, by - 6, 7, 0, 7); x.arc(138, by - 6, 7, 0, 7); x.fill();
        x.fillStyle = '#1b1530'; x.beginPath(); x.arc(119 + Math.sin(t * 2) * 2, by - 6, 3.5, 0, 7); x.arc(139 + Math.sin(t * 2) * 2, by - 6, 3.5, 0, 7); x.fill();
        x.fillStyle = 'rgba(27,21,48,0.75)'; x.fillRect(0, 122, 256, 22);
        x.fillStyle = '#ffd21a'; x.font = `16px ${FONT}`; x.textAlign = 'left'; x.fillText('CHROMA TV · CARTOON HOUR · STAY FRESH · ', 256 - ((t * 40) % 560), 139);
        S.tex.needsUpdate = true;
      };
      return {
        group: g, state: { on: true },
        update(t, dt, st) { const f = Math.floor(t * 12); if (f !== last || st.dirty) { last = f; st.dirty = false; draw(t, st.on); mat.emissiveIntensity = st.on ? 1.1 : 0; } },
      };
    },
  },
  arcade: {
    name: 'Arcade Cabinet', cat: 'fun', price: 2500, kind: 'floor', w: 1.0, d: 1.0, h: 1.9, use: 'arcade',
    cols: [[-0.38, -0.42, 0.38, 0.3, 1.9]],
    desc: 'INK INVADERS! Insert coin. Beat the high score.',
    build(k) {
      const { g, add } = mk();
      const sh = new THREE.Shape();
      sh.moveTo(-0.4, 0); sh.lineTo(0.3, 0); sh.lineTo(0.3, 0.95); sh.lineTo(0.42, 1.05); sh.lineTo(0.22, 1.55); sh.lineTo(0.3, 1.9); sh.lineTo(-0.4, 1.9); sh.lineTo(-0.4, 0);
      const side = cg('arcadeSide', () => { const e = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }); e.rotateY(-Math.PI / 2); return e; });
      const body = k.plas(0x5b3cc4, 0.35), ink = k.plas(k.ink.getHex(), 0.35);
      for (const sx of [-1, 1]) add(side, sx < 0 ? body : body, sx * 0.36 + (sx > 0 ? 0.05 : 0), 0, 0);
      add(box(0.67, 1.9, 0.04), body, 0, 0.95, -0.38);
      add(box(0.67, 0.95, 0.04), k.std(0x1d1b24, 0.5), 0, 0.475, 0.28);
      add(box(0.67, 0.06, 0.24), ink, 0, 0.98, 0.31, 0.45);
      const S = screenTex(128, 160);
      const mat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: S.tex, emissiveIntensity: 1.2 });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.46), mat);
      scr.position.set(0, 1.3, 0.24); scr.rotation.x = -0.38; g.add(scr);
      const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), k.m('marquee', () => {
        const c = canvas(256, 90), x = c.getContext('2d');
        const gr = x.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#ff2e88'); gr.addColorStop(1, '#ffd21a');
        x.fillStyle = gr; x.fillRect(0, 0, 256, 90); x.fillStyle = '#fff'; x.strokeStyle = '#1b1530'; x.lineWidth = 6; x.font = `38px ${FONT}`; x.textAlign = 'center';
        x.strokeText('INK INVADERS', 128, 58); x.fillText('INK INVADERS', 128, 58);
        return new THREE.MeshStandardMaterial({ map: canvasTex(c), emissive: 0xffffff, emissiveMap: canvasTex(c), emissiveIntensity: 1.4 });
      }));
      marquee.position.set(0, 1.74, 0.27); marquee.rotation.x = 0.22; g.add(marquee);
      add(cyl(0.012, 0.012, 0.1, 8), k.dark(), -0.12, 1.06, 0.33); add(sph(0.035, 10, 8), k.plas(0xff3b3b), -0.12, 1.12, 0.33);
      for (let i = 0; i < 3; i++) add(cyl(0.025, 0.025, 0.02, 12), k.plas([0xffd21a, 0x3cf03c, 0x29b6ff][i]), 0.04 + i * 0.08, 1.03, 0.34 - i * 0.01, 0.45);
      let last = -1;
      return {
        group: g, state: { on: true },
        update(t) {
          const f = Math.floor(t * 10); if (f === last) return; last = f;
          const x = S.x;
          x.fillStyle = '#07061a'; x.fillRect(0, 0, 128, 160);
          for (let i = 0; i < 30; i++) { x.fillStyle = '#ffffff55'; x.fillRect((i * 37) % 128, (i * 53 + f * 2) % 160, 1, 1); }
          const ox = Math.sin(t * 0.9) * 18;
          for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
            x.fillStyle = ['#ff2e88', '#ffd21a', '#3cf03c'][r];
            const ax = 20 + c * 20 + ox, ay = 20 + r * 16 + (f % 2) * 2;
            x.fillRect(ax, ay, 10, 6); x.fillRect(ax - 2 + (f % 2) * 2, ay + 6, 3, 3); x.fillRect(ax + 9 - (f % 2) * 2, ay + 6, 3, 3);
          }
          const px = 64 + Math.sin(t * 1.7) * 40;
          x.fillStyle = k.inkHex; x.fillRect(px - 7, 138, 14, 6); x.fillRect(px - 2, 133, 4, 5);
          x.fillStyle = '#fff'; x.fillRect(px - 1, 128 - ((t * 120) % 100), 2, 6);
          x.font = '10px monospace'; x.fillStyle = '#fff'; x.fillText('HI 12450', 6, 11);
          S.tex.needsUpdate = true;
        },
      };
    },
  },
  dj_deck: {
    name: 'DJ Deck', cat: 'fun', price: 2000, kind: 'floor', w: 1.5, d: 1.0, h: 1.05, use: 'dj',
    cols: [[-0.7, -0.4, 0.7, 0.3, 1.0]],
    desc: 'Two turntables and a glowing mixer. Press E to start a house party!',
    build(k) {
      const { g, add } = mk();
      add(rbox(1.4, 0.9, 0.66, 0.03), k.std(0x1d1b24, 0.5, 0.2), 0, 0.45, -0.05);
      const front = add(box(1.3, 0.6, 0.01), k.m('djFront' + k.inkHex, () => {
        const c = canvas(256, 128), x = c.getContext('2d');
        x.fillStyle = '#100e1a'; x.fillRect(0, 0, 256, 128);
        for (let i = 0; i < 16; i++) { const hgt = 20 + Math.abs(Math.sin(i * 1.7)) * 70; x.fillStyle = i % 3 ? k.inkHex : '#ffd21a'; x.fillRect(10 + i * 15, 118 - hgt, 10, hgt); }
        x.fillStyle = '#ffffff'; x.font = `30px ${FONT}`; x.textAlign = 'center'; x.fillText('DJ', 128, 34);
        const t = canvasTex(c);
        return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6, roughness: 0.4 });
      }), 0, 0.45, 0.285);
      add(rbox(1.42, 0.06, 0.7, 0.02), k.std(0x2b2d3a, 0.4, 0.4), 0, 0.93, -0.05);
      const plats = [];
      for (const sx of [-0.43, 0.43]) {
        add(cyl(0.2, 0.2, 0.02, 32), k.metal(0x9aa0aa), sx, 0.97, -0.05);
        const rec = add(cyl(0.18, 0.18, 0.012, 32), k.picture('vinyl', 128, 128, (c) => { c.fillStyle = '#111'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#2a2a2a'; for (let r = 20; r < 64; r += 4) { c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke(); } c.fillStyle = '#ff2e88'; c.beginPath(); c.arc(64, 64, 16, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(60, 52, 8, 8); }), sx, 0.985, -0.05);
        plats.push(rec);
        add(box(0.02, 0.02, 0.22), k.metal(), sx + 0.17, 1.0, -0.12, 0, 0.4, 0);
      }
      const leds = [];
      for (let i = 0; i < 4; i++) leds.push(add(box(0.03, 0.012, 0.12), k.glow([0x3cf03c, 0xffd21a, 0xff2e88, 0x29b6ff][i], 2), -0.075 + i * 0.05, 0.968, -0.05));
      return {
        group: g, state: { on: false },
        update(t, dt, st, ctx) {
          const party = ctx?.party;
          for (const p of plats) p.rotation.y -= dt * (party ? 4.5 : 0.6);
          leds.forEach((l, i) => { l.scale.z = party ? 0.3 + Math.abs(Math.sin(t * 8 + i * 1.3)) : 0.5; });
          front.material.emissiveIntensity = party ? 0.6 + Math.abs(Math.sin(t * Math.PI * 2.1)) * 1.6 : 0.5;
        },
      };
    },
  },
  speaker: {
    name: 'Boom Speaker', cat: 'fun', price: 600, kind: 'floor', w: 0.5, d: 0.5, h: 1.0,
    desc: 'Thumps along to the party. Boom. Boom. Boom.',
    build(k) {
      const { g, add } = mk();
      add(rbox(0.46, 1.0, 0.42, 0.04), k.std(0x23263a, 0.55, 0.1), 0, 0.5, 0);
      const cones = [];
      for (const [y, r] of [[0.68, 0.15], [0.3, 0.12]]) {
        add(torus(r, 0.02, 8, 24), k.metal(0x777c88), 0, y, 0.21);
        cones.push(add(cyl(r * 0.95, r * 0.95, 0.02, 24), k.std(0x111111, 0.6), 0, y, 0.205, Math.PI / 2));
      }
      add(sph(0.03, 10, 8), k.glow(k.ink.getHex(), 3), 0, 0.92, 0.21);
      return { group: g, update(t, dt, st, ctx) { const b = Math.abs(Math.sin(t * Math.PI * (ctx?.party ? 2.1 : 0.8))); for (const c of cones) c.scale.y = 1 + b * (ctx?.party ? 3 : 0.6); } };
    },
  },
  trophy_stand: {
    name: 'Trophy Stand', cat: 'fun', price: 1500, kind: 'floor', w: 1.0, d: 0.5, h: 1.6,
    desc: 'Shows off a gold cup for every few Turf Rush wins.',
    build(k, opts = {}) {
      const { g, add } = mk();
      const wd = k.wood(WOOD.dark);
      for (const sx of [-1, 1]) add(box(0.05, 1.6, 0.4), wd, sx * 0.46, 0.8, 0);
      add(box(0.96, 1.6, 0.03), k.std(0x7a1f3d, 0.8), 0, 0.8, -0.19);
      for (let i = 0; i < 4; i++) add(box(0.9, 0.04, 0.38), wd, 0, 0.02 + i * 0.52, 0);
      const n = Math.max(1, Math.min(6, opts.trophies ?? 1));
      const cup = lathe('trophy', [[0, 0], [0.07, 0], [0.07, 0.02], [0.02, 0.04], [0.015, 0.12], [0.03, 0.14], [0.08, 0.2], [0.09, 0.3], [0.085, 0.31]], 20);
      for (let i = 0; i < n; i++) {
        const sh = Math.floor(i / 2), sx = (i % 2 ? 0.2 : -0.2);
        add(cup, k.std(i === 0 ? 0xffd34d : i % 3 === 1 ? 0xd8dde6 : 0xffc23a, 0.25, 0.95), sx, 0.04 + sh * 0.52, 0);
        add(box(0.12, 0.05, 0.1), wd, sx, 0.065 + sh * 0.52, 0);
      }
      return { group: g };
    },
  },
  aquarium: {
    name: 'Aquarium', cat: 'fun', price: 1600, kind: 'floor', w: 1.5, d: 0.5, h: 1.4,
    desc: 'Five tiny fish who think you are very cool.',
    build(k) {
      const { g, add } = mk();
      add(rbox(1.44, 0.7, 0.44, 0.03), k.wood(WOOD.walnut), 0, 0.35, 0);
      add(box(1.4, 0.6, 0.4), k.m('aquaWater', () => new THREE.MeshStandardMaterial({ color: 0x3fb8e8, emissive: 0x1a7fc0, emissiveIntensity: 0.9, transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false })), 0, 1.02, 0);
      add(box(1.42, 0.64, 0.42), k.glass(0.12), 0, 1.03, 0);
      add(box(1.4, 0.06, 0.4), k.std(0xf2dfb0, 0.9), 0, 0.73, 0);
      add(box(1.46, 0.04, 0.46), k.std(0x23263a, 0.4), 0, 1.36, 0);
      for (let i = 0; i < 5; i++) add(cyl(0.008, 0.012, 0.3 + (i % 3) * 0.08, 6), k.leaf(0x3cba55), -0.55 + i * 0.27, 0.9, -0.1 + (i % 2) * 0.12, 0, 0, Math.sin(i) * 0.2);
      add(sph(0.08, 10, 8), k.std(0x8a8f99, 0.8), 0.35, 0.77, 0.05);
      const fish = [];
      const fcol = [0xff7a00, 0xffd21a, 0xff2e88, 0x29b6ff, 0xffffff];
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Group();
        const b = new THREE.Mesh(sph(0.035, 10, 8), k.std(fcol[i], 0.35)); b.scale.set(0.6, 0.9, 1.4); f.add(b);
        const tail = new THREE.Mesh(cg('fishTail', () => new THREE.ConeGeometry(0.03, 0.05, 6).rotateX(-Math.PI / 2)), k.std(fcol[i], 0.35)); tail.position.z = -0.06; f.add(tail);
        g.add(f); fish.push({ f, ph: i * 1.3, sp: 0.4 + (i % 3) * 0.15, y: 0.85 + (i % 4) * 0.1 });
      }
      return {
        group: g,
        update(t) {
          for (const o of fish) {
            const a = t * o.sp + o.ph;
            o.f.position.set(Math.sin(a) * 0.55, o.y + Math.sin(a * 2.3) * 0.04, Math.sin(a * 1.7) * 0.1);
            o.f.rotation.y = Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        },
      };
    },
  },
  lava_lamp: {
    name: 'Lava Lamp', cat: 'lights', price: 350, kind: 'small', w: 0.5, d: 0.5, h: 0.6, use: 'lamp',
    desc: 'Blobs of glowing goo, rising and falling forever.',
    build(k) {
      const { g, add } = mk();
      add(lathe('lavaBase', [[0, 0], [0.11, 0], [0.07, 0.16], [0.05, 0.17], [0, 0.17]], 20), k.metal(0xb0b6c2, 0.25), 0, 0, 0);
      const goo = k.m('lavaGoo' + k.inkHex, () => new THREE.MeshStandardMaterial({ color: k.ink, emissive: k.ink, emissiveIntensity: 1.8, roughness: 0.3 }));
      add(lathe('lavaGlass', [[0.05, 0.17], [0.075, 0.3], [0.05, 0.47], [0.03, 0.5]], 20), k.m('lavaLiquid', () => new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xff9a3a, emissiveIntensity: 0.7, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false })), 0, 0, 0);
      add(lathe('lavaCap', [[0.03, 0.5], [0.035, 0.56], [0, 0.57]], 16), k.metal(0xb0b6c2, 0.25), 0, 0, 0);
      const blobs = [];
      for (let i = 0; i < 4; i++) { const b = add(sph(0.022 + (i % 2) * 0.01, 12, 10), goo, 0, 0.25, 0); b.castShadow = false; blobs.push(b); }
      add(cyl(0.22, 0.22, 0.004, 24), k.pool(0xff9ec7), 0, 0.003, 0);
      return {
        group: g, state: { on: true },
        update(t, dt, st) {
          blobs.forEach((b, i) => { b.visible = true; b.position.set(Math.sin(t * 0.5 + i) * 0.015, 0.21 + (Math.sin(t * 0.35 + i * 1.9) * 0.5 + 0.5) * 0.24, Math.cos(t * 0.4 + i) * 0.015); b.scale.y = 1 + Math.sin(t * 1.3 + i) * 0.25; });
          goo.emissiveIntensity = st.on ? 1.8 : 0.1;
        },
      };
    },
  },

  // ======================================================== lights
  lamp_floor: {
    name: 'Arc Floor Lamp', cat: 'lights', price: 400, kind: 'floor', w: 0.5, d: 0.5, h: 1.9, use: 'lamp',
    cols: [[-0.18, -0.18, 0.18, 0.18, 1.6]],
    desc: 'A tall lamp that leans over your favourite chair. Press E to toggle.',
    build(k) {
      const { g, add } = mk();
      add(cyl(0.17, 0.19, 0.04, 24), k.metal(0x2b2f45, 0.35), 0, 0.02, -0.05);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -0.05), new THREE.Vector3(0, 1.2, -0.1), new THREE.Vector3(0, 1.75, 0.15), new THREE.Vector3(0, 1.72, 0.45)]);
      add(cg('arcTube', () => new THREE.TubeGeometry(curve, 30, 0.016, 8)), k.brass(), 0, 0, 0);
      add(lathe('arcShade', [[0.02, 0.14], [0.08, 0.13], [0.16, 0.02], [0.17, 0]], 24), k.m('lampShadeOut', () => new THREE.MeshStandardMaterial({ color: 0xfff1d6, side: THREE.DoubleSide, roughness: 0.6, emissive: 0xffc98a, emissiveIntensity: 0.25 })), 0, 1.58, 0.45);
      const bulb = add(sph(0.05, 12, 10), k.m('bulbWarm', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd39a, emissiveIntensity: 4 })), 0, 1.62, 0.45);
      bulb.castShadow = false;
      const pool = add(cyl(0.9, 0.9, 0.004, 32), k.pool(0xffc98a), 0, 0.02, 0.45); pool.castShadow = false; pool.receiveShadow = false;
      return { group: g, state: { on: true }, update(t, dt, st) { bulb.material.emissiveIntensity = st.on ? 4 : 0.05; pool.visible = st.on; } };
    },
  },
  lamp_table: {
    name: 'Desk Lamp', cat: 'lights', price: 200, kind: 'small', w: 0.5, d: 0.5, h: 0.55, use: 'lamp',
    desc: 'A little drum-shade lamp for nightstands and desks.',
    build(k) {
      const { g, add } = mk();
      add(lathe('tlampBase', [[0, 0], [0.09, 0], [0.1, 0.03], [0.07, 0.12], [0.03, 0.24], [0.02, 0.28], [0, 0.28]], 20), k.ceramic(PAL.coral), 0, 0, 0);
      const shade = add(cyl(0.12, 0.15, 0.2, 24, true), k.m('drumShade', () => new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc98a, emissiveIntensity: 1.1, side: THREE.DoubleSide, roughness: 0.7 })), 0, 0.38, 0);
      const pool = add(cyl(0.4, 0.4, 0.004, 24), k.pool(0xffc98a), 0, 0.004, 0); pool.castShadow = false;
      return { group: g, state: { on: true }, update(t, dt, st) { shade.material.emissiveIntensity = st.on ? 1.1 : 0.05; pool.visible = st.on; } };
    },
  },
  string_lights: {
    name: 'Fairy Lights', cat: 'lights', price: 300, kind: 'wall', w: 2.0, h: 0.5, dd: 0.06,
    desc: 'A string of colorful bulbs for that cozy glow.',
    build(k) {
      const { g, add } = mk();
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(-0.98 + t * 1.96, 0.18 - Math.sin(t * Math.PI * 2) ** 2 * 0.3, 0.02)); }
      add(cg('fairyWire', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.005, 4)), k.dark(), 0, 0, 0);
      const cols = [0xffe2a8, 0xff9ec7, 0x9ee8ff, 0xc6ff9e, 0xffd21a];
      for (let i = 1; i < 24; i += 2) { const b = add(sph(0.028, 8, 6), k.glow(cols[(i >> 1) % cols.length], 4), pts[i].x, pts[i].y - 0.03, 0.03); b.castShadow = false; }
      return { group: g };
    },
  },
  neon_sign: {
    name: 'Neon Splat Sign', cat: 'lights', price: 900, kind: 'wall', w: 1.5, h: 1.0, dd: 0.06,
    desc: 'Glows in your ink color. Very fresh.',
    build(k) {
      const { g, add } = mk();
      add(rbox(1.46, 0.96, 0.03, 0.02), k.glass(0.25, 0xffffff), 0, 0, 0.0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.94), k.m('neon' + k.inkHex, () => {
        const c = canvas(384, 256), x = c.getContext('2d');
        x.shadowColor = k.inkHex; x.shadowBlur = 18;
        x.strokeStyle = k.inkHex; x.lineWidth = 7; x.lineJoin = 'round';
        x.save(); x.translate(120, 26); x.scale(1.45, 1.45); x.stroke(new Path2D(SPLAT_PATH)); x.restore();
        x.shadowColor = '#fff'; x.fillStyle = '#ffffff'; x.font = `66px ${FONT}`; x.textAlign = 'center'; x.lineWidth = 3;
        x.fillText('FRESH', 192, 160);
        const t = canvasTex(c);
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false });
      }));
      m.position.z = 0.025; g.add(m);
      return { group: g };
    },
  },

  // ======================================================== plants
  plant_pot: {
    name: 'Monstera', cat: 'plants', price: 250, kind: 'floor', w: 0.5, d: 0.5, h: 1.3,
    cols: [[-0.2, -0.2, 0.2, 0.2, 0.5]],
    desc: 'Big leafy friend with holes in its leaves. It is fine. That is normal.',
    build(k) {
      const { g, add } = mk();
      add(lathe('pot', [[0, 0], [0.15, 0], [0.2, 0.36], [0.22, 0.4], [0, 0.4]], 22), k.ceramic(0xd97b4f), 0, 0, 0);
      add(cyl(0.19, 0.19, 0.02, 20), k.std(0x4a3426, 1), 0, 0.38, 0);
      const R = rng(5);
      for (let i = 0; i < 8; i++) {
        const a = i * 2.4, tilt = 0.5 + R() * 0.5, len = 0.4 + R() * 0.35;
        const stem = new THREE.Group(); stem.position.set(0, 0.38, 0); stem.rotation.set(0, a, 0); g.add(stem);
        const s = add(cyl(0.008, 0.01, len, 6), k.leaf(0x3b8a3e), 0, len / 2, 0, 0, 0, 0, stem); s.rotation.x = tilt * 0.6; s.position.z = Math.sin(tilt * 0.6) * len / 2; s.position.y = Math.cos(tilt * 0.6) * len / 2;
        const lf = add(leafGeo('monstera'), k.leaf(i % 2 ? 0x3f9b4b : 0x4cae55), 0, Math.cos(tilt * 0.6) * len, Math.sin(tilt * 0.6) * len, tilt + 0.4, 0, 0, stem);
        lf.scale.setScalar(0.9 + R() * 0.5);
      }
      return { group: g };
    },
  },
  cactus: {
    name: 'Cactus Pal', cat: 'plants', price: 150, kind: 'small', w: 0.5, d: 0.5, h: 0.6,
    desc: 'A small cactus with a big smile. Do not hug.',
    build(k) {
      const { g, add } = mk();
      add(lathe('cpot', [[0, 0], [0.1, 0], [0.12, 0.16], [0.13, 0.18], [0, 0.18]], 18), k.ceramic(0xfaf6ee), 0, 0, 0);
      const cm = k.std(0x5cb85c, 0.6);
      add(cg('cactusBody', () => new THREE.CapsuleGeometry(0.075, 0.22, 6, 14)), cm, 0, 0.36, 0);
      const arm = (sx) => { add(cg('cactusArm', () => new THREE.CapsuleGeometry(0.035, 0.08, 4, 10)), cm, sx * 0.1, 0.38, 0, 0, 0, sx * -0.9); add(cg('cactusArm2', () => new THREE.CapsuleGeometry(0.032, 0.08, 4, 10)), cm, sx * 0.14, 0.45, 0); };
      arm(1); arm(-1);
      add(sph(0.03, 10, 8), k.std(0xff8fb8, 0.5), 0, 0.53, 0);
      for (const sx of [-1, 1]) add(sph(0.01, 8, 6), k.std(0x1b1530, 0.4), sx * 0.025, 0.4, 0.072);
      add(torus(0.016, 0.004, 4, 10, Math.PI), k.std(0x1b1530, 0.4), 0, 0.375, 0.073, 0, 0, Math.PI);
      return { group: g };
    },
  },
  tree_plant: {
    name: 'Fiddle Fig Tree', cat: 'plants', price: 500, kind: 'floor', w: 1.0, d: 1.0, h: 2.2,
    cols: [[-0.25, -0.25, 0.25, 0.25, 0.6]],
    desc: 'A tall indoor tree. Makes any corner feel like a jungle.',
    build(k) {
      const { g, add } = mk();
      add(lathe('bigpot', [[0, 0], [0.22, 0], [0.27, 0.5], [0.29, 0.55], [0, 0.55]], 22), k.ceramic(0xfaf6ee), 0, 0, 0);
      add(cyl(0.025, 0.04, 1.2, 8), k.std(0x7a5236, 0.9), 0, 1.1, 0);
      const R = rng(9);
      for (let i = 0; i < 40; i++) {
        const a = i * 2.39996, y = 1.1 + R() * 1.0, r = 0.1 + R() * 0.36 * (1.25 - (y - 1.1));
        const lf = add(leafGeo('fig'), k.leaf(i % 3 ? 0x3f8f45 : 0x58b05a), Math.cos(a) * r, y, Math.sin(a) * r, 0, -a + Math.PI / 2, 0);
        lf.rotation.order = 'YXZ'; lf.rotation.set(-0.9 - R() * 0.5, -a + Math.PI / 2, 0);
        lf.scale.setScalar(0.9 + R() * 0.55);
      }
      return { group: g };
    },
  },
  flower_vase: {
    name: 'Tulip Vase', cat: 'plants', price: 120, kind: 'small', w: 0.5, d: 0.5, h: 0.55,
    desc: 'Fresh tulips in every color. Never wilt. Never.',
    build(k) {
      const { g, add } = mk();
      add(lathe('vase', [[0, 0], [0.06, 0], [0.09, 0.08], [0.05, 0.2], [0.06, 0.24], [0, 0.24]], 20), k.glass(0.4, 0xbfe8ff), 0, 0, 0);
      const cols = [0xff4d6d, 0xffd21a, 0xff9ec7, 0xa335ff, 0xff7a00];
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26, tx = Math.sin(a) * 0.06, tz = Math.cos(a) * 0.06;
        add(cyl(0.004, 0.004, 0.3, 5), k.leaf(0x3b8a3e), tx * 0.5, 0.3, tz * 0.5, tz * 2, 0, -tx * 2);
        add(lathe('tulip', [[0, 0], [0.025, 0.01], [0.032, 0.04], [0.026, 0.07], [0.02, 0.065]], 10), k.std(cols[i], 0.5), tx, 0.43, tz);
      }
      return { group: g };
    },
  },

  // ======================================================== rugs
  rug_round: {
    name: 'Sunny Round Rug', cat: 'rugs', price: 300, kind: 'rug', w: 2.0, d: 2.0, h: 0.02,
    desc: 'Warm rings of color. Feels great under bare feet.',
    build(k) { const { g, add } = mk(); add(cyl(0.98, 0.98, 0.015, 48), k.picture('rugRound', 256, 256, rugCanvas('round', k), { roughness: 0.95 }), 0, 0.0075, 0); return { group: g }; },
  },
  rug_stripe: {
    name: 'Stripe Rug', cat: 'rugs', price: 450, kind: 'rug', w: 3.0, d: 2.0, h: 0.02,
    desc: 'A woven rug with retro stripes and fringe.',
    build(k) {
      const { g, add } = mk();
      add(rbox(2.8, 0.015, 1.9, 0.006), k.picture('rugStripe', 256, 160, rugCanvas('stripe', k), { roughness: 0.95 }), 0, 0.0075, 0);
      const parts = [];
      for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) parts.push({ geo: box(0.08, 0.006, 0.02), pos: [sx * 1.44, 0.004, -0.9 + i * 0.072], color: 0xf4f1de });
      add(mergeParts(parts), k.vcol(0.95), 0, 0, 0);
      return { group: g };
    },
  },
  rug_checker: {
    name: 'Checker Rug', cat: 'rugs', price: 400, kind: 'rug', w: 2.0, d: 2.0, h: 0.02,
    desc: 'Pink and cream checks. Bold choice. Love it.',
    build(k) { const { g, add } = mk(); add(rbox(1.9, 0.015, 1.9, 0.006), k.picture('rugChecker', 192, 192, rugCanvas('checker', k), { roughness: 0.95 }), 0, 0.0075, 0); return { group: g }; },
  },
  rug_splat: {
    name: 'Splat Rug', cat: 'rugs', price: 600, kind: 'rug', w: 2.5, d: 2.5, h: 0.02,
    desc: 'A giant splat of your own ink color, now in fluffy form.',
    build(k) {
      const { g, add } = mk();
      const geo = cg('splatRug', () => {
        const shape = new THREE.Shape();
        // trace the SVG splat roughly: radial wobble
        const R = rng(3);
        const n = 26, pts = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = (i % 2 ? 0.95 : 1.15) + R() * 0.12; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
        shape.moveTo(...pts[0]);
        for (let i = 0; i < n; i++) { const p = pts[(i + 1) % n], c = pts[i]; shape.quadraticCurveTo(c[0] * 1.05, c[1] * 1.05, (c[0] + p[0]) / 2, (c[1] + p[1]) / 2); }
        const e = new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false, curveSegments: 6 });
        e.rotateX(-Math.PI / 2); e.scale(1.05, 1, 1.05);
        return e;
      });
      add(geo, k.fab(k.ink.getHex()), 0, 0, 0);
      return { group: g };
    },
  },

  // ======================================================== wall decor
  poster_ink: {
    name: 'Turf Rush Poster', cat: 'wall', price: 100, kind: 'wall', w: 1.0, h: 1.5, dd: 0.03,
    desc: 'Official TURF RUSH poster. Signed by nobody.',
    build(k) {
      const { g, add } = mk();
      add(box(0.96, 1.44, 0.01), k.picture('posterInk' + k.inkHex, 256, 384, posterArt('TURF RUSH', 'PAINT IT ALL', '#ffd21a', '#ff2e88', 'splat')), 0, 0, 0.005);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) add(box(0.08, 0.03, 0.004), k.std(0xfff4c2, 0.8), sx * 0.44, sy * 0.68, 0.012, 0, 0, sx * sy * 0.6);
      return { group: g };
    },
  },
  poster_gloop: {
    name: 'Gloop Fest Poster', cat: 'wall', price: 100, kind: 'wall', w: 1.0, h: 1.5, dd: 0.03,
    desc: 'The loudest concert of the year. You were there. Probably.',
    build(k) {
      const { g, add } = mk();
      add(box(0.96, 1.44, 0.01), k.picture('posterGloop', 256, 384, posterArt('GLOOP FEST', 'LIVE · TONIGHT', '#a335ff', '#ffd21a', 'music')), 0, 0, 0.005);
      frame(add, k, 1.0, 1.48, 0.02, k.std(0x1d1b24, 0.5));
      return { group: g };
    },
  },
  poster_surf: {
    name: 'Ink Surf Poster', cat: 'wall', price: 150, kind: 'wall', w: 1.0, h: 1.5, dd: 0.03,
    desc: 'Catch the wave! A breezy beach poster.',
    build(k) {
      const { g, add } = mk();
      add(box(0.96, 1.44, 0.01), k.picture('posterSurf', 256, 384, posterArt('INK SURF', 'SUMMER SPLASH', '#ff7a6b', '#ffffff', 'wave')), 0, 0, 0.005);
      frame(add, k, 1.0, 1.48, 0.02, k.wood(WOOD.honey));
      return { group: g };
    },
  },
  painting: {
    name: 'Sunset Painting', cat: 'wall', price: 700, kind: 'wall', w: 1.5, h: 1.0, dd: 0.05,
    desc: 'A framed sunset over Prism Bay. Very artsy.',
    build(k) {
      const { g, add } = mk();
      add(box(1.36, 0.86, 0.01), k.picture('sunset', 384, 256, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff9ec7'); gr.addColorStop(0.5, '#ffc46b'); gr.addColorStop(0.62, '#ff7a6b'); gr.addColorStop(1, '#3d4a8a');
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(w * 0.6, h * 0.55, 46, 0, 7); x.fill();
        x.fillStyle = '#3d4a8a'; x.fillRect(0, h * 0.62, w, h);
        x.fillStyle = 'rgba(255,220,160,0.55)'; for (let i = 0; i < 9; i++) x.fillRect(w * 0.6 - 40 + Math.sin(i) * 8, h * 0.64 + i * 9, 80 - i * 7, 3);
        x.fillStyle = '#2b2f5a'; x.beginPath(); x.moveTo(0, h * 0.62); x.quadraticCurveTo(w * 0.2, h * 0.38, w * 0.42, h * 0.62); x.fill();
        x.beginPath(); x.moveTo(w * 0.7, h * 0.62); x.quadraticCurveTo(w * 0.9, h * 0.45, w, h * 0.55); x.lineTo(w, h * 0.62); x.fill();
      }), 0, 0, 0.012);
      frame(add, k, 1.5, 1.0, 0.05, k.std(0xe0b04a, 0.35, 0.8));
      return { group: g };
    },
  },
  wall_clock: {
    name: 'Wall Clock', cat: 'wall', price: 250, kind: 'wall', w: 0.75, h: 0.75, dd: 0.06,
    desc: 'Tells the real time. Tick tock.',
    build(k) {
      const { g, add } = mk();
      add(cyl(0.34, 0.34, 0.05, 40), k.plas(PAL.coral), 0, 0, 0.025, Math.PI / 2);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), k.picture('clockFace', 256, 256, (x) => {
        x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 256, 256);
        x.fillStyle = '#1b1530'; x.font = `34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; x.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); }
      }));
      face.position.z = 0.052; g.add(face);
      const hand = (len, wdt, z, col) => { const p = new THREE.Group(); p.position.z = z; g.add(p); const m = new THREE.Mesh(box(wdt, len, 0.005), k.std(col, 0.4)); m.position.y = len / 2 - 0.02; p.add(m); return p; };
      const hh = hand(0.16, 0.022, 0.056, 0x1b1530), mh = hand(0.24, 0.014, 0.06, 0x1b1530), sh = hand(0.25, 0.006, 0.064, 0xff2e88);
      add(sph(0.016, 8, 6), k.std(0x1b1530), 0, 0, 0.066);
      return {
        group: g,
        update() {
          const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
          sh.rotation.z = -s / 60 * Math.PI * 2; mh.rotation.z = -m / 60 * Math.PI * 2; hh.rotation.z = -h / 12 * Math.PI * 2;
        },
      };
    },
  },
  shelf_wall: {
    name: 'Floating Shelf', cat: 'wall', price: 300, kind: 'wall', w: 1.5, h: 0.5, dd: 0.25,
    desc: 'A wall shelf with books, a tiny plant and a mini Bopbot.',
    build(k) {
      const { g, add } = mk();
      add(rbox(1.44, 0.05, 0.24, 0.015), k.wood(WOOD.oak), 0, -0.2, 0.12);
      const parts = [];
      const cols = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x6b5bff, 0xff9ec7];
      for (let i = 0; i < 6; i++) parts.push({ geo: box(0.05, 0.22 + (i % 3) * 0.03, 0.17), pos: [-0.6 + i * 0.055, -0.07 + (i % 3) * 0.015, 0.12], color: cols[i % 5] });
      parts.push({ geo: box(0.05, 0.2, 0.17), pos: [-0.25, -0.1, 0.12], rot: [0, 0, -0.35], color: 0x2b2f45 });
      add(mergeParts(parts), k.vcol(0.65), 0, 0, 0);
      add(cyl(0.05, 0.04, 0.09, 12), k.ceramic(PAL.lilac), 0.15, -0.13, 0.12);
      for (let i = 0; i < 5; i++) add(sph(0.045, 8, 6), k.leaf(0x4fb04a), 0.15 + Math.sin(i * 1.3) * 0.04, -0.05 + (i % 2) * 0.03, 0.12 + Math.cos(i * 1.3) * 0.03);
      const bop = add(sph(0.08, 16, 12), k.plas(0xffffff, 0.3), 0.5, -0.08, 0.12); bop.scale.set(1, 1.15, 1);
      add(torus(0.035, 0.009, 6, 16), k.std(0xff3b3b, 0.5, 0, { emissive: 0x551111 }), 0.5, -0.09, 0.2);
      return { group: g };
    },
  },
  mirror: {
    name: 'Wall Mirror', cat: 'wall', price: 500, kind: 'wall', w: 1.0, h: 1.5, dd: 0.05, use: 'mirror',
    desc: 'Check yourself out. Press E to change your look.',
    build(k) {
      const { g, add } = mk();
      const ring = add(torus(0.5, 0.04, 10, 48), k.brass(), 0, 0, 0.03); ring.scale.set(0.9, 1.4, 1);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.47, 48), k.m('mirrorGlass', () => new THREE.MeshStandardMaterial({ color: 0xdfeeff, roughness: 0.02, metalness: 1, envMapIntensity: 1.6 })));
      glass.scale.set(0.9, 1.4, 1); glass.position.z = 0.025; g.add(glass);
      return { group: g };
    },
  },
  dartboard: {
    name: 'Dartboard', cat: 'wall', price: 200, kind: 'wall', w: 0.75, h: 0.75, dd: 0.08,
    desc: 'Three darts stuck in it already. Two of them in the bullseye.',
    build(k) {
      const { g, add } = mk();
      add(cyl(0.3, 0.3, 0.05, 40), k.std(0x1d1b24, 0.7), 0, 0, 0.025, Math.PI / 2);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.28, 40), k.picture('dart', 256, 256, (x) => {
        for (let i = 0; i < 20; i++) { x.fillStyle = i % 2 ? '#f4e2b8' : '#1d1b24'; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 128, (i / 20) * Math.PI * 2, ((i + 1) / 20) * Math.PI * 2); x.fill(); }
        for (const [r, a, b] of [[120, '#e63946', '#2a9d8f'], [76, '#e63946', '#2a9d8f']]) for (let i = 0; i < 20; i++) { x.strokeStyle = i % 2 ? a : b; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, r, (i / 20) * Math.PI * 2, ((i + 1) / 20) * Math.PI * 2); x.stroke(); }
        x.fillStyle = '#2a9d8f'; x.beginPath(); x.arc(128, 128, 18, 0, 7); x.fill(); x.fillStyle = '#e63946'; x.beginPath(); x.arc(128, 128, 8, 0, 7); x.fill();
      }));
      face.position.z = 0.052; g.add(face);
      for (const [x, y] of [[0.01, 0.005], [-0.012, -0.01], [0.12, 0.08]]) {
        add(cyl(0.004, 0.004, 0.12, 6), k.metal(), x, y, 0.11, Math.PI / 2);
        add(box(0.04, 0.002, 0.04), k.std(0xff2e88, 0.5), x, y, 0.16);
      }
      return { group: g };
    },
  },

  // ======================================================== kitchen
  fridge: {
    name: 'Retro Fridge', cat: 'kitchen', price: 1100, kind: 'floor', w: 1.0, d: 1.0, h: 1.95, use: 'fridge',
    cols: [[-0.4, -0.4, 0.4, 0.38, 1.95]],
    desc: 'Mint-green, humming and full of Fizzwater soda.',
    build(k) {
      const { g, add } = mk();
      const body = k.plas(PAL.mint, 0.25);
      add(rbox(0.8, 1.9, 0.72, 0.1, 3), body, 0, 0.97, -0.03);
      add(box(0.78, 0.015, 0.02), k.std(0x6fc8ad, 0.4), 0, 1.25, 0.335);
      for (const y of [0.85, 1.55]) add(rbox(0.04, y > 1 ? 0.3 : 0.5, 0.05, 0.02), k.metal(), 0.3, y, 0.36);
      add(box(0.3, 0.38, 0.004), k.picture('kidDrawing', 128, 160, (x) => {
        x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 128, 160);
        x.fillStyle = '#ff2e88'; x.beginPath(); x.ellipse(64, 70, 28, 32, 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(54, 60, 8, 0, 7); x.arc(74, 60, 8, 0, 7); x.fill();
        x.fillStyle = '#1b1530'; x.beginPath(); x.arc(56, 60, 4, 0, 7); x.arc(76, 60, 4, 0, 7); x.fill();
        x.strokeStyle = '#3cf03c'; x.lineWidth = 5; x.beginPath(); x.moveTo(20, 140); x.lineTo(108, 140); x.stroke();
        x.fillStyle = '#ffd21a'; x.beginPath(); x.arc(108, 22, 14, 0, 7); x.fill();
      }), -0.12, 1.55, 0.336);
      for (const [x, y, c] of [[-0.25, 1.75, 0xff2e88], [0.02, 1.76, 0x29b6ff], [-0.2, 0.9, 0xffd21a], [0.05, 1.0, 0x3cf03c]]) add(cyl(0.025, 0.025, 0.02, 12), k.plas(c), x, y, 0.345, Math.PI / 2);
      return { group: g };
    },
  },
  counter: {
    name: 'Kitchen Counter', cat: 'kitchen', price: 900, kind: 'floor', w: 2.0, d: 1.0, h: 0.95, top: 0.95,
    cols: [[-1.0, -0.4, 1.0, 0.33, 0.95]],
    desc: 'Sink, stove and a whole lot of counter space.',
    build(k) {
      const { g, add } = mk();
      add(rbox(1.96, 0.88, 0.68, 0.02), k.std(0xf4efe6, 0.5), 0, 0.44, -0.04);
      for (let i = 0; i < 4; i++) { add(rbox(0.44, 0.7, 0.02, 0.01), k.std(PAL.sky, 0.45), -0.72 + i * 0.48, 0.42, 0.305); add(rbox(0.02, 0.14, 0.03, 0.01), k.metal(), -0.56 + i * 0.48, 0.6, 0.32); }
      add(rbox(2.0, 0.05, 0.72, 0.012), k.std(0xe8e2d6, 0.25, 0.05), 0, 0.905, -0.04);
      add(box(0.5, 0.012, 0.36), k.metal(0xa8afba, 0.25), -0.45, 0.932, -0.02);
      add(cyl(0.015, 0.015, 0.26, 8), k.metal(), -0.45, 1.06, -0.26);
      add(cyl(0.012, 0.012, 0.16, 8), k.metal(), -0.45, 1.18, -0.19, Math.PI / 2);
      add(box(0.62, 0.012, 0.5), k.std(0x1d1b24, 0.3, 0.3), 0.5, 0.935, -0.04);
      for (const [x, z] of [[0.36, -0.14], [0.64, -0.14], [0.36, 0.08], [0.64, 0.08]]) add(torus(0.07, 0.01, 6, 20), k.std(0x555a66, 0.4, 0.6), x, 0.945, z, Math.PI / 2);
      add(lathe('kettle', [[0, 0], [0.09, 0], [0.1, 0.06], [0.085, 0.15], [0.03, 0.18], [0, 0.19]], 18), k.plas(PAL.coral), 0.36, 0.94, -0.14);
      return { group: g };
    },
  },
  fireplace: {
    name: 'Cozy Fireplace', cat: 'kitchen', price: 2400, kind: 'floor', w: 2.0, d: 1.0, h: 1.4, top: 1.4,
    cols: [[-1.0, -0.5, 1.0, 0.1, 1.4]],
    desc: 'Crackling, flickering, extremely cozy. Best against a wall.',
    build(k) {
      const { g, add } = mk();
      const brick = k.picture('brickFire', 256, 128, (x) => {
        x.fillStyle = '#b8a89a'; x.fillRect(0, 0, 256, 128);
        const R = rng(8);
        for (let r = 0; r < 8; r++) for (let c = -1; c < 6; c++) { const o = r % 2 ? 24 : 0; x.fillStyle = `hsl(${12 + R() * 14},${38 + R() * 15}%,${46 + R() * 12}%)`; x.fillRect(c * 48 + o + 2, r * 16 + 2, 44, 12); }
      });
      add(box(1.9, 1.3, 0.55), brick, 0, 0.65, -0.22);
      add(box(1.0, 0.75, 0.4), k.std(0x15100e, 0.9), 0, 0.42, -0.08);
      add(rbox(2.04, 0.08, 0.66, 0.02), k.wood(WOOD.dark), 0, 1.34, -0.2);
      add(box(1.4, 0.06, 0.3), k.std(0x6b5f58, 0.8), 0, 0.03, 0.14);
      for (const [x, r] of [[-0.15, 0.3], [0.12, -0.25]]) add(cyl(0.05, 0.05, 0.6, 10), k.std(0x6b4630, 0.9), x, 0.11, -0.08, 0, r, Math.PI / 2);
      const flames = [];
      const fmats = [k.glow(0xff7a00, 3), k.glow(0xffc23a, 3.5), k.glow(0xff4d1a, 3)];
      for (let i = 0; i < 6; i++) { const f = add(cg('flame', () => new THREE.ConeGeometry(0.07, 0.3, 8)), fmats[i % 3], -0.25 + i * 0.1, 0.32, -0.08 + (i % 2) * 0.04); f.castShadow = false; flames.push(f); }
      const pool = add(cyl(1.0, 1.0, 0.004, 32), k.pool(0xff9a4a), 0, 0.02, 0.45); pool.castShadow = false;
      add(box(0.12, 0.2, 0.08), k.picture('photoFrame', 64, 80, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 80); x.fillStyle = '#8fc8ff'; x.fillRect(6, 6, 52, 52); x.fillStyle = k.inkHex; x.beginPath(); x.arc(32, 40, 14, 0, 7); x.fill(); }), -0.6, 1.48, -0.22);
      return {
        group: g,
        update(t) { flames.forEach((f, i) => { const s = 0.75 + Math.abs(Math.sin(t * (7 + i) + i * 2)) * 0.5; f.scale.set(1, s, 1); f.position.y = 0.2 + s * 0.15; }); pool.material.opacity = 0.85 + Math.sin(t * 13) * 0.15; },
      };
    },
  },
  bopbot_plush: {
    name: 'Bopbot Plushie', cat: 'fun', price: 180, kind: 'small', w: 0.5, d: 0.5, h: 0.5,
    desc: 'A squishy Bopbot. It cannot be popped. You have tried.',
    build(k) {
      const { g, add } = mk();
      const b = add(sph(0.16, 20, 14), k.fab(0xffffff), 0, 0.2, 0); b.scale.set(1, 1.15, 1);
      add(torus(0.07, 0.018, 8, 20), k.fab(0xff3b3b), 0, 0.18, 0.15);
      for (const sx of [-1, 1]) add(sph(0.022, 8, 6), k.std(0x1b1530, 0.4), sx * 0.055, 0.27, 0.152);
      for (const sx of [-1, 1]) add(sph(0.05, 10, 8), k.fab(0xffffff), sx * 0.15, 0.12, 0.03);
      return { group: g };
    },
  },
  globe: {
    name: 'Desk Globe', cat: 'fun', price: 160, kind: 'small', w: 0.5, d: 0.5, h: 0.45,
    desc: 'A spinning globe of the whole colorful world.',
    build(k) {
      const { g, add } = mk();
      add(cyl(0.08, 0.1, 0.03, 18), k.wood(WOOD.dark), 0, 0.015, 0);
      add(cyl(0.012, 0.012, 0.12, 8), k.brass(), 0, 0.08, 0);
      const ball = add(sph(0.14, 24, 16), k.picture('globeMap', 256, 128, (x) => {
        x.fillStyle = '#4fa8e0'; x.fillRect(0, 0, 256, 128);
        const R = rng(17); x.fillStyle = '#8fd46a';
        for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(R() * 256, 20 + R() * 88, 12 + R() * 26, 8 + R() * 16, R() * 3, 0, 7); x.fill(); }
      }, { roughness: 0.4 }), 0, 0.29, 0, 0, 0, 0.4);
      add(torus(0.155, 0.006, 6, 32, Math.PI * 1.2), k.brass(), 0, 0.29, 0, 0, Math.PI / 2, 0.4 - Math.PI * 0.6);
      return { group: g, update(t) { ball.rotation.y = t * 0.3; } };
    },
  },
};
export const FURNITURE_IDS = Object.keys(FURNITURE);
for (const [id, d] of Object.entries(FURNITURE)) d.id = id;

// ---------------------------------------------------------------- wallpaper + floor styles
export const WALLPAPERS = {
  cream: { name: 'Cream Plaster', price: 0 },
  stripes: { name: 'Candy Stripes', price: 300 },
  dots: { name: 'Polka Pop', price: 300 },
  stars: { name: 'Starry Night', price: 500 },
  leaves: { name: 'Jungle Leaves', price: 500 },
  splats: { name: 'Ink Splats', price: 600 },
  panel: { name: 'Wood Panel', price: 450 },
  waves: { name: 'Retro Waves', price: 400 },
  brick: { name: 'Loft Brick', price: 450 },
};
export const FLOORS = {
  oak: { name: 'Honey Oak', price: 0 },
  walnut: { name: 'Walnut Planks', price: 400 },
  checker: { name: 'Checker Tiles', price: 350 },
  carpet: { name: 'Cozy Carpet', price: 300 },
  parquet: { name: 'Parquet Weave', price: 600 },
  marble: { name: 'Marble', price: 700 },
  terrazzo: { name: 'Terrazzo', price: 500 },
  neon: { name: 'Neon Grid', price: 800 },
};

const STYLE_TEX = new Map();
function noiseShade(x, w, h, amt = 0.06, seed = 1) {
  const img = x.getImageData(0, 0, w, h), R = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) { const k = 1 + (R() - 0.5) * amt; img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k; }
  x.putImageData(img, 0, 0);
}

// returns { canvas, map, emissiveMap? }; each texture covers 2 x 2 metres
export function wallpaperCanvas(id, ink = '#ff2e88') {
  const key = 'w' + id + (id === 'splats' ? ink : '');
  if (STYLE_TEX.has(key)) return STYLE_TEX.get(key);
  const S = 512, c = canvas(S, S), x = c.getContext('2d'), R = rng(id.length * 31 + 7);
  if (id === 'stripes') {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff4f6' : '#ffc4d6'; x.fillRect(i * 64, 0, 64, S); }
    x.fillStyle = 'rgba(214,160,60,0.6)'; for (let i = 0; i < 8; i++) x.fillRect(i * 64 - 1, 0, 2, S);
  } else if (id === 'dots') {
    x.fillStyle = '#bff0dc'; x.fillRect(0, 0, S, S);
    for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) { x.fillStyle = (i + y) % 3 ? '#ffffff' : '#ff9e8a'; x.beginPath(); x.arc(i * 64 + (y % 2) * 32 + 16, y * 64 + 32, 11, 0, 7); x.fill(); }
  } else if (id === 'stars') {
    x.fillStyle = '#2b2f6b'; x.fillRect(0, 0, S, S);
    const star = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); };
    for (let i = 0; i < 26; i++) { x.fillStyle = i % 5 ? '#ffe28a' : '#ffffff'; star(R() * S, R() * S, 6 + R() * 10); }
    x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(380, 120, 34, 0, 7); x.fill(); x.fillStyle = '#2b2f6b'; x.beginPath(); x.arc(396, 110, 30, 0, 7); x.fill();
    for (let i = 0; i < 80; i++) { x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(R() * S, R() * S, 2, 2); }
  } else if (id === 'leaves') {
    x.fillStyle = '#d9ecd0'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 34; i++) {
      const cx = R() * S, cy = R() * S, a = R() * 6.3, s = 24 + R() * 30;
      x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = ['#7fb877', '#5e9e5b', '#a8d49b'][i % 3];
      x.beginPath(); x.moveTo(0, -s); x.quadraticCurveTo(s * 0.6, 0, 0, s); x.quadraticCurveTo(-s * 0.6, 0, 0, -s); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -s); x.lineTo(0, s); x.stroke(); x.restore();
    }
  } else if (id === 'splats') {
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, S, S);
    const p = new Path2D(SPLAT_PATH);
    for (let i = 0; i < 14; i++) { x.save(); x.translate(R() * S, R() * S); x.rotate(R() * 6.3); const s = 0.4 + R() * 0.7; x.scale(s, s); x.translate(-50, -50); x.globalAlpha = 0.85; x.fillStyle = i % 3 ? ink : '#ffd21a'; x.fill(p); x.restore(); }
    x.globalAlpha = 1;
  } else if (id === 'panel') {
    for (let i = 0; i < 6; i++) { x.fillStyle = `hsl(28, ${42 + R() * 10}%, ${58 + R() * 8}%)`; x.fillRect(i * S / 6, 0, S / 6, S); }
    for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(90,50,20,0.12)'; const px = R() * S; x.fillRect(px, R() * S, 1, 20 + R() * 60); }
    x.fillStyle = 'rgba(60,30,10,0.45)'; for (let i = 0; i < 6; i++) x.fillRect(i * S / 6, 0, 3, S);
  } else if (id === 'waves') {
    const cols = ['#ffb347', '#ff7a45', '#c9553a', '#ffd88a'];
    x.fillStyle = '#fff1d6'; x.fillRect(0, 0, S, S);
    for (let b = 0; b < 8; b++) { x.strokeStyle = cols[b % 4]; x.lineWidth = 22; x.beginPath(); for (let i = 0; i <= S; i += 8) x.lineTo(i, b * 64 + 32 + Math.sin((i / S) * Math.PI * 4) * 16); x.stroke(); }
  } else if (id === 'brick') {
    x.fillStyle = '#d8d2cc'; x.fillRect(0, 0, S, S);
    for (let r = 0; r < 16; r++) for (let i = -1; i < 5; i++) { const o = r % 2 ? 64 : 0; x.fillStyle = `hsl(20, 10%, ${88 + R() * 8}%)`; x.fillRect(i * 128 + o + 4, r * 32 + 4, 120, 26); }
  } else {
    x.fillStyle = '#f6ead6'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(180,150,110,0.07)'; x.fillRect(R() * S, R() * S, 2 + R() * 4, 2 + R() * 4); }
  }
  noiseShade(x, S, S, 0.05, 3);
  const out = { canvas: c };
  STYLE_TEX.set(key, out);
  return out;
}

export function floorCanvas(id) {
  const key = 'f' + id;
  if (STYLE_TEX.has(key)) return STYLE_TEX.get(key);
  const S = 512, c = canvas(S, S), x = c.getContext('2d'), R = rng(id.length * 17 + 3);
  let glow = null;
  const planks = (h, s, l, rows = 8) => {
    for (let r = 0; r < rows; r++) {
      let px = -R() * 200;
      while (px < S) {
        const len = 150 + R() * 200;
        x.fillStyle = `hsl(${h + R() * 6}, ${s + R() * 8}%, ${l + R() * 8}%)`; x.fillRect(px, r * S / rows, len, S / rows);
        for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(70,40,15,0.1)'; x.fillRect(px, r * S / rows + R() * S / rows, len, 1); }
        x.fillStyle = 'rgba(50,28,10,0.5)'; x.fillRect(px, r * S / rows, 2, S / rows);
        px += len;
      }
      x.fillStyle = 'rgba(50,28,10,0.55)'; x.fillRect(0, r * S / rows, S, 2);
    }
  };
  if (id === 'walnut') planks(22, 40, 30);
  else if (id === 'checker') { for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { x.fillStyle = (r + i) % 2 ? '#2b2f45' : '#f4efe6'; x.fillRect(i * 128, r * 128, 128, 128); } x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, S); x.moveTo(0, i * 128); x.lineTo(S, i * 128); x.stroke(); } }
  else if (id === 'carpet') { x.fillStyle = '#b6a2e0'; x.fillRect(0, 0, S, S); for (let i = 0; i < 16000; i++) { x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(60,30,100,0.1)'; x.fillRect(R() * S, R() * S, 2, 2); } }
  else if (id === 'parquet') {
    const C = 128, P = C / 4;
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
      x.fillStyle = `hsl(${28 + R() * 7}, ${40 + R() * 10}%, ${48 + R() * 14}%)`;
      if ((r + i) % 2) x.fillRect(i * C + k * P + 1, r * C + 1, P - 2, C - 2); else x.fillRect(i * C + 1, r * C + k * P + 1, C - 2, P - 2);
    }
    for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(70,40,15,0.1)'; x.fillRect(R() * S, R() * S, 1 + R() * 10, 1); }
  } else if (id === 'marble') {
    const img = x.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const n = fbm(i / S * 4, y / S * 4, 5, 13, 4);
      const v = Math.abs(Math.sin((i / S + y / S) * 9 + n * 12));
      const k = 0.86 + Math.pow(v, 0.15) * 0.14;
      const o = (y * S + i) * 4; img.data[o] = 250 * k; img.data[o + 1] = 246 * k; img.data[o + 2] = 242 * k; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(120,110,100,0.35)'; x.lineWidth = 2; for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, S); x.moveTo(0, i * 256); x.lineTo(S, i * 256); x.stroke(); }
  } else if (id === 'terrazzo') {
    x.fillStyle = '#f1ebe2'; x.fillRect(0, 0, S, S);
    const cols = ['#ff8fb8', '#8fe3c8', '#ffc94d', '#b9a3ff', '#8a8f99', '#ff7a6b'];
    for (let i = 0; i < 420; i++) { x.fillStyle = cols[i % cols.length]; x.beginPath(); const r = 3 + R() * 9; x.ellipse(R() * S, R() * S, r, r * (0.5 + R() * 0.5), R() * 3, 0, 7); x.fill(); }
  } else if (id === 'neon') {
    x.fillStyle = '#1c1830'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) { x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(R() * S, R() * S, 2, 2); }
    const g = canvas(S, S), gx = g.getContext('2d');
    gx.fillStyle = '#000'; gx.fillRect(0, 0, S, S);
    for (const cx of [x, gx]) { cx.strokeStyle = '#ff3ea5'; cx.lineWidth = 4; cx.shadowColor = '#ff3ea5'; cx.shadowBlur = 10; for (let i = 0; i <= 4; i++) { cx.beginPath(); cx.moveTo(i * 128, 0); cx.lineTo(i * 128, S); cx.moveTo(0, i * 128); cx.lineTo(S, i * 128); cx.stroke(); } }
    glow = g;
  } else planks(33, 46, 67);
  if (id !== 'neon' && id !== 'marble') noiseShade(x, S, S, 0.05, 5);
  const out = { canvas: c, glow };
  STYLE_TEX.set(key, out);
  return out;
}

export function styleThumb(kind, id, ink) {
  const src = kind === 'wall' ? wallpaperCanvas(id, ink).canvas : floorCanvas(id).canvas;
  const c = canvas(96, 96);
  c.getContext('2d').drawImage(src, 0, 0, 512, 512, 0, 0, 96, 96);
  return c.toDataURL();
}

// ---------------------------------------------------------------- saves
// starter layout: the house never looks empty
const STARTER = [
  { id: 'desk', x: 7.5, z: 2.5, r: 3 },
  { id: 'chair', x: 6.75, z: 2.75, r: 1 },
  { id: 'bed_single', x: -6.75, z: -4.75, r: 0 },
  { id: 'side_table', x: -7.75, z: -5.75, r: 0 },
  { id: 'lamp_table', on: 'side_table', x: 0, z: 0, r: 0 },
  { id: 'tv_stand', x: -3.0, z: -5.75, r: 0 },
  { id: 'tv', on: 'tv_stand', x: 0, z: 0, r: 0 },
  { id: 'rug_round', x: -3.0, z: -3.0, r: 0 },
  { id: 'beanbag', x: -3.0, z: -2.5, r: 2 },
  { id: 'lamp_floor', x: -4.25, z: -2.75, r: 1 },
  { id: 'plant_pot', x: -1.75, z: -5.75, r: 0 },
  { id: 'poster_ink', wall: 3, x: -3.0, y: 1.9 },
  { id: 'string_lights', wall: 0, x: -6.0, y: 2.9 },
  { id: 'bookshelf', x: 5.25, z: -5.75, r: 0 },
  { id: 'tree_plant', x: 7.5, z: -5.5, r: 0 },
  { id: 'round_table', x: 5.5, z: -1.0, r: 0 },
  { id: 'flower_vase', on: 'round_table', x: 0, z: 0, r: 0 },
  { id: 'chair', x: 5.5, z: -0.25, r: 2 },
];

export function defaultHouse() {
  const items = [];
  const byId = {};
  let uid = 1;
  for (const s of STARTER) {
    const it = { uid: uid++, id: s.id, x: s.x, z: s.z ?? 0, r: s.r ?? 0 };
    if (s.wall != null) { it.wall = s.wall; it.y = s.y; delete it.z; delete it.r; }
    if (s.on) it.on = byId[s.on];
    byId[s.id] = it.uid;
    items.push(it);
  }
  const owned = {};
  for (const it of items) owned[it.id] = (owned[it.id] || 0) + 1;
  return { v: 1, wall: 'cream', floor: 'oak', walls: ['cream'], floors: ['oak'], owned, items, nextUid: uid };
}

export function migrateHouse(h) {
  const d = defaultHouse();
  if (!h || typeof h !== 'object' || !Array.isArray(h.items)) return d;
  const out = {
    v: 1,
    wall: WALLPAPERS[h.wall] ? h.wall : 'cream',
    floor: FLOORS[h.floor] ? h.floor : 'oak',
    walls: [...new Set(['cream', ...(Array.isArray(h.walls) ? h.walls : [])].filter((k) => WALLPAPERS[k]))],
    floors: [...new Set(['oak', ...(Array.isArray(h.floors) ? h.floors : [])].filter((k) => FLOORS[k]))],
    owned: {}, items: [], nextUid: 1,
  };
  if (!out.walls.includes(out.wall)) out.walls.push(out.wall);
  if (!out.floors.includes(out.floor)) out.floors.push(out.floor);
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const seen = new Set();
  for (const it of h.items) {
    const def = it && FURNITURE[it.id];
    if (!def || !num(it.uid) || seen.has(it.uid) || !num(it.x)) continue;
    const o = { uid: it.uid, id: it.id, x: it.x };
    if (def.kind === 'wall') { if (!num(it.wall) || it.wall < 0 || it.wall > 3 || !num(it.y)) continue; o.wall = it.wall | 0; o.y = it.y; }
    else { if (!num(it.z)) continue; o.z = it.z; o.r = ((it.r | 0) % 4 + 4) % 4; if (num(it.on)) o.on = it.on; }
    if (it.off === true) o.off = true; // lamps / TV switched off
    seen.add(it.uid);
    out.items.push(o);
  }
  // stacked items need an existing surface underneath
  const byUid = new Map(out.items.map((i) => [i.uid, i]));
  out.items = out.items.filter((i) => i.on == null || (byUid.get(i.on) && FURNITURE[byUid.get(i.on).id].top && byUid.get(i.on).on == null));
  if (!out.items.some((i) => i.id === 'desk')) out.items.push({ ...d.items.find((i) => i.id === 'desk'), uid: 0 });
  const src = h.owned && typeof h.owned === 'object' ? h.owned : {};
  for (const id of FURNITURE_IDS) {
    const placed = out.items.filter((i) => i.id === id).length;
    const n = Math.max(placed, Math.min(99, Math.floor(+src[id] || 0)));
    if (n > 0) out.owned[id] = n;
  }
  let max = 0;
  for (const i of out.items) max = Math.max(max, i.uid);
  for (const i of out.items) if (i.uid === 0) i.uid = ++max;
  out.nextUid = Math.max(max + 1, num(h.nextUid) ? h.nextUid : 0);
  return out;
}
