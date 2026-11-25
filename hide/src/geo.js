// Static geometry batching. Everything that never moves is merged into a few
// large meshes per material, split into spatial chunks so frustum culling and
// shadow passes can skip what is out of view.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Matrix3();

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL_CACHE = new Map();
export function cylGeo(seg = 12, open = false) {
  const k = seg + (open ? 'o' : '');
  if (!CYL_CACHE.has(k)) CYL_CACHE.set(k, new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 1, open));
  return CYL_CACHE.get(k);
}

// Atlas tile -> uv rect
export function tileRect(i, cols = 8, rows = 8, inset = 0.004) {
  const cx = i % cols, cy = Math.floor(i / cols);
  const u0 = cx / cols + inset, u1 = (cx + 1) / cols - inset;
  const v1 = 1 - cy / rows - inset, v0 = 1 - (cy + 1) / rows + inset;
  return [u0, v0, u1, v1];
}

class Batch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.count = 0;
    this.hasColor = false;
  }
  // geo: indexed BufferGeometry. opts.uvRect remaps 0..1 uvs into a rect.
  // opts.faceRects: per BoxGeometry face rects [px,nx,py,ny,pz,nz].
  // opts.uvScale: [su, sv] multiplies uvs (world tiling), or a function(face)->[su,sv].
  add(geo, matrix, opts = {}) {
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
    const base = this.count;
    _n.getNormalMatrix(matrix);
    const color = opts.color;
    if (color && !this.hasColor) {
      this.hasColor = true;
      for (let i = 0; i < this.count; i++) this.col.push(1, 1, 1);
    }
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      let u = U ? U.getX(i) : 0, w = U ? U.getY(i) : 0;
      const face = Math.floor(i / 4);
      if (opts.uvScale) {
        const sc = typeof opts.uvScale === 'function' ? opts.uvScale(face) : opts.uvScale;
        u *= sc[0];
        w *= sc[1];
        if (opts.uvOffset) { u += opts.uvOffset[0]; w += opts.uvOffset[1]; }
      }
      const rect = opts.faceRects ? opts.faceRects[face] : opts.uvRect;
      if (rect) {
        u = rect[0] + (rect[2] - rect[0]) * u;
        w = rect[1] + (rect[3] - rect[1]) * w;
      }
      this.uv.push(u, w);
      if (this.hasColor) {
        const c = color || WHITE;
        this.col.push(c.r, c.g, c.b);
      }
    }
    if (geo.index) {
      const I = geo.index.array;
      for (let i = 0; i < I.length; i++) this.idx.push(base + I[i]);
    } else {
      for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    }
    this.count += P.count;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.hasColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
const WHITE = new THREE.Color(1, 1, 1);

export class World {
  constructor(chunk = 9) {
    this.chunk = chunk;
    this.batches = new Map();
    this.materials = {};
  }
  mat(name, material) {
    this.materials[name] = material;
    return material;
  }
  _batch(mat, x, z, opts) {
    const cx = opts.noChunk ? 'all' : Math.floor(x / this.chunk) + ',' + Math.floor(z / this.chunk);
    const key = mat + '|' + cx + (opts.noShadow ? '|ns' : '');
    let b = this.batches.get(key);
    if (!b) {
      b = new Batch();
      b.mat = mat;
      b.noShadow = !!opts.noShadow;
      this.batches.set(key, b);
    }
    return b;
  }
  matrix(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  }
  // Axis box centred at x,y,z with size w,h,d (rotated ry about Y).
  box(mat, x, y, z, w, h, d, opts = {}) {
    const m = this.matrix(x, y, z, w, h, d, opts.ry || 0, opts.rx || 0, opts.rz || 0);
    const o = { ...opts };
    if (opts.tile) {
      // world-scale tiling: metres per texture repeat
      const t = opts.tile;
      o.uvScale = (f) => (f < 2 ? [d / t, h / t] : f < 4 ? [w / t, d / t] : [w / t, h / t]);
    }
    this._batch(mat, x, z, opts).add(UNIT_BOX, m, o);
  }
  // Box from min/max corners (axis aligned).
  slab(mat, x0, y0, z0, x1, y1, z1, opts = {}) {
    this.box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), opts);
  }
  cyl(mat, x, y, z, r, h, opts = {}) {
    const m = this.matrix(x, y, z, r * 2, h, r * 2, opts.ry || 0, opts.rx || 0, opts.rz || 0);
    this._batch(mat, x, z, opts).add(cylGeo(opts.seg || 12, opts.open), m, opts);
  }
  geo(mat, geometry, x, y, z, sx = 1, sy = 1, sz = 1, opts = {}) {
    const m = this.matrix(x, y, z, sx, sy, sz, opts.ry || 0, opts.rx || 0, opts.rz || 0);
    this._batch(mat, x, z, opts).add(geometry, m, opts);
  }
  // Horizontal plane (floor / ceiling) with world-tiled uvs.
  plane(mat, x0, z0, x1, z1, y, { tile = 1, down = false, ...opts } = {}) {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(1, 1);
    const m = this.matrix((x0 + x1) / 2, y, (z0 + z1) / 2, w, d, 1, 0, down ? Math.PI / 2 : -Math.PI / 2);
    this._batch(mat, (x0 + x1) / 2, (z0 + z1) / 2, { noChunk: true, ...opts }).add(g, m, { uvScale: [w / tile, d / tile], uvOffset: [x0 / tile, -z1 / tile], ...opts });
  }
  // Vertical wall quad facing +normal; along X (facing ±z) or along Z (facing ±x).
  wallQuad(mat, a0, a1, y0, y1, c, axis, facing, opts = {}) {
    const len = a1 - a0, h = y1 - y0;
    const g = new THREE.PlaneGeometry(1, 1);
    const tile = opts.tile || 1;
    let m;
    if (axis === 'x') m = this.matrix((a0 + a1) / 2, (y0 + y1) / 2, c, len, h, 1, facing > 0 ? 0 : Math.PI);
    else m = this.matrix(c, (y0 + y1) / 2, (a0 + a1) / 2, len, h, 1, facing > 0 ? Math.PI / 2 : -Math.PI / 2);
    const cx = axis === 'x' ? (a0 + a1) / 2 : c, cz = axis === 'x' ? c : (a0 + a1) / 2;
    this._batch(mat, cx, cz, opts).add(g, m, opts.uv01 ? opts : { uvScale: [len / tile, h / tile], uvOffset: [a0 / tile, y0 / tile], ...opts });
  }
  build(scene, shadows) {
    const meshes = [];
    for (const b of this.batches.values()) {
      if (!b.count) continue;
      const mat = this.materials[b.mat];
      if (!mat) throw new Error('missing material ' + b.mat);
      if (b.hasColor && !mat.vertexColors) {
        // a material used with vertex colours on some batches: clone once
        const key = b.mat + '#vc';
        if (!this.materials[key]) {
          this.materials[key] = mat.clone();
          this.materials[key].vertexColors = true;
        }
      }
      const m = new THREE.Mesh(b.build(), b.hasColor ? this.materials[b.mat + '#vc'] || mat : mat);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.receiveShadow = shadows;
      m.castShadow = shadows && !b.noShadow && !mat.transparent;
      m.name = b.mat;
      scene.add(m);
      meshes.push(m);
    }
    this.batches.clear();
    return meshes;
  }
}
