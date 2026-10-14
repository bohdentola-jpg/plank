// Geometry helpers for the procedural cars: interpolation, lofting rings into
// meshes, fans, merges.
import * as THREE from 'three';

/** Monotone cubic (Fritsch–Carlson) through [[x,y],…] sorted by x. Returns f(x). */
export function monotone(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  if (n === 1) return () => ys[0];
  const d = [];
  const m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]) * 0;
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Smooth bump: 1 at 0 → 0 at |x| ≥ 1. */
export function bump(x) {
  x = Math.abs(x);
  return x >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x);
}

export function smooth01(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Loft: rings[i] is an array of THREE.Vector3 (same count per ring),
 * us[i] the texture u for ring i, vs[j] the texture v for column j.
 * Quads join ring i to i+1. flip reverses winding.
 */
export function loft(rings, us, vs, flip = false) {
  const nr = rings.length, nc = rings[0].length;
  const pos = new Float32Array(nr * nc * 3);
  const uv = new Float32Array(nr * nc * 2);
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const k = i * nc + j;
      const p = rings[i][j];
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uv[k * 2] = us[i];
      uv[k * 2 + 1] = vs[j];
    }
  }
  const idx = [];
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1;
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Triangle fan over a closed outline (Vector3[]), center pushed by `push` along `dir`. */
export function fan(outline, uvFn, dir, push = 0, flip = false) {
  const n = outline.length;
  const c = new THREE.Vector3();
  for (const p of outline) c.add(p);
  c.multiplyScalar(1 / n);
  c.addScaledVector(dir, push);
  const pos = [], uv = [], idx = [];
  pos.push(c.x, c.y, c.z);
  const cuv = uvFn(c);
  uv.push(cuv[0], cuv[1]);
  for (const p of outline) {
    pos.push(p.x, p.y, p.z);
    const t = uvFn(p);
    uv.push(t[0], t[1]);
  }
  for (let i = 0; i < n; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % n);
    if (flip) idx.push(0, b, a);
    else idx.push(0, a, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Merge geometries (indexed or not) that share position/normal/uv layout. */
export function mergeGeos(list) {
  const geos = list.filter(Boolean).map((g) => (g.index ? g : indexify(g)));
  let vcount = 0, icount = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    vcount += g.attributes.position.count;
    icount += g.index.count;
  }
  const pos = new Float32Array(vcount * 3);
  const nor = new Float32Array(vcount * 3);
  const uv = new Float32Array(vcount * 2);
  const idx = new Uint32Array(icount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i);
      if (t) { uv[(vo + i) * 2] = t.getX(i); uv[(vo + i) * 2 + 1] = t.getY(i); }
    }
    const ix = g.index;
    for (let i = 0; i < ix.count; i++) idx[io + i] = ix.getX(i) + vo;
    vo += p.count;
    io += ix.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const g of list) g?.dispose?.();
  return out;
}

function indexify(g) {
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

/** Apply a Matrix4 built from position/rotation/scale to a geometry (returns it). */
export function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  return g;
}

/** Extrude a 2D polyline profile (in the XY plane) along +X from x0 to x1. */
export function extrudeX(profile, x0, x1, closed = true) {
  const rings = [
    profile.map(([y, z]) => new THREE.Vector3(x0, y, z)),
    profile.map(([y, z]) => new THREE.Vector3(x1, y, z)),
  ];
  const pts = closed ? [...profile, profile[0]] : profile;
  const r2 = rings.map((r) => (closed ? [...r, r[0].clone()] : r));
  const vs = pts.map((_, i) => i / (pts.length - 1));
  void pts;
  return loft(r2, [0, 1], vs);
}
