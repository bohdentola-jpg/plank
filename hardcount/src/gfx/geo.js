// Small geometry builder: quads, boxes, cylinders and merged sub-geometries
// into one BufferGeometry (optionally with vertex colors). Ported from
// MIDNIGHT FREQUENCY's environment kit.
import * as THREE from 'three';

export class GeoBuilder {
  constructor() {
    this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = [];
    this.color = [1, 1, 1];
  }
  get count() { return this.p.length / 3; }
  setColor(r, g, b) { this.color = [r, g, b]; return this; }
  /** Quad from 4 corners (counter-clockwise seen from the front), uv rect [u0,v0,u1,v1]. */
  quad(a, b, c, d, uvr = [0, 0, 1, 1]) {
    const base = this.count;
    const nx = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    for (const v of [a, b, c, d]) { this.p.push(v.x, v.y, v.z); this.n.push(nx.x, nx.y, nx.z); this.c.push(...this.color); }
    this.uv.push(uvr[0], uvr[1], uvr[2], uvr[1], uvr[2], uvr[3], uvr[0], uvr[3]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  /**
   * Axis box rotated by ry around its base center (x, y, z). uvMode 'meters'
   * maps 1 texture repeat per (uw, uh) meters on the walls.
   */
  box(x, y, z, w, h, d, ry = 0, opts = {}) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const P = (lx, ly, lz) => new THREE.Vector3(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
    const hw = w / 2, hd = d / 2;
    const uw = opts.uw || w, uh = opts.uh || h;
    const v0 = opts.v0 || 0;
    const walls = [
      [P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), w],      // +z
      [P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), w],  // -z
      [P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), d],      // +x
      [P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), d],  // -x
    ];
    for (const [a, b, cc, dd, len] of walls) {
      if (opts.walls === false) break;
      const u1 = opts.uFit ? 1 : len / uw;
      this.quad(a, b, cc, dd, [0, v0, u1, v0 + h / uh]);
    }
    if (opts.top !== false) {
      const t = opts.topUv || [0, 0, w / 8, d / 8];
      this.quad(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), t);
    }
    if (opts.bottom) this.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd));
    return this;
  }
  /** Cylinder (no caps) along y. */
  cylinder(x, y, z, r, h, seg = 8, r2 = r) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const A = new THREE.Vector3(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r);
      const B = new THREE.Vector3(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r);
      const Cc = new THREE.Vector3(x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2);
      const D = new THREE.Vector3(x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2);
      this.quad(B, A, D, Cc, [i / seg, 0, (i + 1) / seg, 1]);
    }
    return this;
  }
  /** Merge an existing BufferGeometry with a transform matrix. */
  geometry(g, m) {
    const base = this.count;
    const gp = g.attributes.position, gn = g.attributes.normal, gu = g.attributes.uv;
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < gp.count; i++) {
      v.set(gp.getX(i), gp.getY(i), gp.getZ(i)).applyMatrix4(m);
      this.p.push(v.x, v.y, v.z);
      if (gn) { nn.set(gn.getX(i), gn.getY(i), gn.getZ(i)).applyMatrix3(nm).normalize(); this.n.push(nn.x, nn.y, nn.z); } else this.n.push(0, 1, 0);
      this.uv.push(gu ? gu.getX(i) : 0, gu ? gu.getY(i) : 0);
      this.c.push(...this.color);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < gp.count; i++) this.idx.push(base + i);
    return this;
  }
  build(withColor = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    return g;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** InstancedMesh from a list of {x,y,z, rx,ry,rz, s|sx,sy,sz, color}. */
export function instanced(geometry, material, list, opts = {}) {
  const im = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  list.forEach((o, i) => {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    _v.set(o.x, o.y, o.z);
    _m.compose(_v, _q, _s);
    im.setMatrixAt(i, _m);
    if (o.color && im.setColorAt) im.setColorAt(i, new THREE.Color(o.color));
  });
  im.count = list.length;
  im.castShadow = !!opts.shadow;
  im.receiveShadow = !!opts.receive;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}
