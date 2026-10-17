// Geometry accumulators for world cells: everything one cell draws with one
// material goes into one BufferGeometry (so a city block's sidewalks, curbs
// and lamp posts are a few draw calls, not thousands). Positions, uvs, an
// optional vertex colour, and the 'glow' attribute the lamp baker fills in.
import * as THREE from 'three';

export class Acc {
  constructor(colors = false) {
    this.p = [];
    this.uv = [];
    this.c = colors ? [] : null;
    this.idx = [];
    this.col = [1, 1, 1];
  }
  get count() { return this.p.length / 3; }
  v(x, y, z, u = 0, w = 0) {
    this.p.push(x, y, z);
    this.uv.push(u, w);
    if (this.c) this.c.push(this.col[0], this.col[1], this.col[2]);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  /** A quad from four [x,y,z] corners (counter-clockwise seen from its front). */
  quadP(A, B, Cc, D, uv = [0, 0, 1, 1]) {
    const a = this.v(A[0], A[1], A[2], uv[0], uv[1]);
    const b = this.v(B[0], B[1], B[2], uv[2], uv[1]);
    const c = this.v(Cc[0], Cc[1], Cc[2], uv[2], uv[3]);
    const d = this.v(D[0], D[1], D[2], uv[0], uv[3]);
    this.quad(a, b, c, d);
  }
  /** Box: base centre (x, y, z), size w (along x' = rotated x), h, d, turned ry. */
  box(x, y, z, w, h, d, ry = 0, uvScale = 1, top = true) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    const u = uvScale;
    this.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), [0, 0, w / u, h / u]);
    this.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), [0, 0, w / u, h / u]);
    this.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), [0, 0, d / u, h / u]);
    this.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), [0, 0, d / u, h / u]);
    if (top) this.quadP(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), [0, 0, w / u, d / u]);
  }
  /** Upright cylinder (no caps). */
  cyl(x, y, z, r, h, seg = 8, r2 = r) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      this.quadP(
        [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r],
        [x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2], [x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2],
        [i / seg, 0, (i + 1) / seg, 1],
      );
    }
  }
  /** Beam between two points, square section w×h. */
  beam(ax, ay, az, bx, by, bz, w, h = w) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = Math.hypot(dx, dy, dz) || 1;
    const t = [dx / L, dy / L, dz / L];
    let up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const s = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
    const sl = Math.hypot(...s) || 1;
    s[0] /= sl; s[1] /= sl; s[2] /= sl;
    up = [s[1] * t[2] - s[2] * t[1], s[2] * t[0] - s[0] * t[2], s[0] * t[1] - s[1] * t[0]];
    const hw = w / 2, hh = h / 2;
    const corner = (p, a, b) => [p[0] + s[0] * a + up[0] * b, p[1] + s[1] * a + up[1] * b, p[2] + s[2] * a + up[2] * b];
    const A = [ax, ay, az], B = [bx, by, bz];
    const C4 = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    for (let k = 0; k < 4; k++) {
      const [a0, b0] = C4[k], [a1, b1] = C4[(k + 1) % 4];
      this.quadP(corner(A, a0, b0), corner(A, a1, b1), corner(B, a1, b1), corner(B, a0, b0), [0, 0, 1, L / 2]);
    }
  }
  toGeometry(glow = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (glow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Per-cell set of accumulators keyed by material. */
export class Batch {
  constructor() {
    this.map = new Map();
  }
  get(mat, colors = false) {
    let e = this.map.get(mat);
    if (!e) { e = new Acc(colors); this.map.set(mat, e); }
    return e;
  }
  /** Build meshes into group; returns the meshes that take lamp glow. */
  flush(group, { shadow = false, receive = true } = {}) {
    const glowing = [];
    for (const [mat, acc] of this.map) {
      if (!acc.idx.length) continue;
      const takesGlow = !!mat.customProgramCacheKey && mat.customProgramCacheKey().startsWith('world-glow');
      const m = new THREE.Mesh(acc.toGeometry(takesGlow), mat);
      m.castShadow = shadow;
      m.receiveShadow = receive;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      group.add(m);
      if (takesGlow) glowing.push(m);
    }
    this.map.clear();
    return glowing;
  }
}
