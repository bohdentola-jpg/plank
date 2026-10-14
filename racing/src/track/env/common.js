// Shared scenery building blocks for all environments: a geometry
// accumulator (so thousands of props become a handful of draw calls),
// lamp posts, overhead signs, billboards, distant silhouettes, placement.
import * as THREE from 'three';
import { glowTexture, billboardTexture, toTex } from '../textures.js';
import { makeRng, clamp } from '../../core/util.js';

/** Accumulates quads/boxes into one BufferGeometry (positions, normals, uvs, colors). */
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

/** Walk the track placing things every `spacing` meters on a side. */
export function along(track, spacing, fn, opts = {}) {
  const from = opts.from ?? 0;
  const to = opts.to ?? track.length;
  for (let s = from; s < to; s += spacing) {
    const p = track.posAt(s, 0);
    fn(s, p);
  }
}

/** Is a circle clear of every road (by `pad` meters past the edge)? */
export function clearOfRoad(track, x, z, radius, pad = 2) {
  const i = track.nearestIndex(x, z, 2);
  if (i < 0) return true;
  const d = track.distToRoad(x, z);
  return d > track.W[i] + pad + radius;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();

/** Instanced mesh helper: list of {x,y,z,ry,sx,sy,sz}. */
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

/**
 * Street lamps along the track. style: 'city' (cobra head), 'highway' (tall
 * double), 'circuit' (none), 'old' (globe). Registers each light with the world.
 */
export function streetLamps(world, track, opts = {}) {
  const spacing = opts.spacing ?? 30;
  const color = opts.color ?? '#ffae55';
  const height = opts.height ?? 8.5;
  const offset = opts.offset ?? 1.2; // past the road edge
  const poles = [], heads = [];
  const rng = makeRng('lamps' + track.def.id);
  let side = 1;
  for (let s = opts.start ?? 10; s < track.length - 5; s += spacing * (0.9 + rng() * 0.2)) {
    const p = track.posAt(s, 0);
    const i = p.i;
    if (opts.skip && opts.skip(s, i)) continue;
    const sides = opts.both ? [1, -1] : [side];
    side = -side;
    for (const sd of sides) {
      const lat = sd * (track.W[i] + offset);
      const lx = track.X[i] + track.LX[i] * lat, lz = track.Z[i] + track.LZ[i] * lat;
      if (opts.clear && !clearOfRoad(track, lx, lz, 0.3, offset - 0.3)) continue;
      const gy = opts.groundY ? opts.groundY(lx, lz, i, lat) : track.roadY(i, 0, Math.sign(lat) * track.W[i]) + 0.15;
      const ry = Math.atan2(-track.LX[i] * sd, -track.LZ[i] * sd);
      poles.push({ x: lx, y: gy, z: lz, ry, sy: height / 8 });
      const armLen = 2.4;
      const hx = lx - track.LX[i] * sd * armLen, hz = lz - track.LZ[i] * sd * armLen;
      heads.push({ x: hx, y: gy + height - 0.15, z: hz, ry });
      world.addLamp(hx, gy + height - 0.4, hz, color, opts.radius ?? 17, opts.intensity ?? 1.0);
    }
  }
  // pole: vertical post + arm, built in local space (arm toward -z = toward the road)
  const gb = new GeoBuilder();
  gb.cylinder(0, 0, 0, 0.13, 8, 6, 0.09);
  gb.box(0, 7.85, -1.15, 0.12, 0.12, 2.5, 0, { top: true });
  const poleGeo = gb.build();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6, metalness: 0.6 });
  world.add(instanced(poleGeo, poleMat, poles, { shadow: false }));
  const headGeo = new THREE.BoxGeometry(0.55, 0.18, 0.9);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: world.at.lamps ? 3.2 : 0.2 });
  world.add(instanced(headGeo, headMat, heads));
  // soft halos around the heads
  if (world.at.lamps) {
    const halo = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: true });
    const grp = new THREE.Group();
    for (const h of heads) {
      const sp = new THREE.Sprite(halo);
      sp.position.set(h.x, h.y - 0.25, h.z);
      sp.scale.setScalar(3.2);
      grp.add(sp);
    }
    world.add(grp);
  }
  return { poles, heads };
}

/** Green overhead highway sign gantry spanning the road at s. */
export function signGantry(world, track, s, lines, opts = {}) {
  const p = track.posAt(s, 0);
  const i = p.i;
  const w = track.W[i] + 1.5;
  const h = opts.height ?? 7;
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.5, metalness: 0.7 });
  for (const sd of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), steel);
    post.position.set(sd * w, h / 2, 0);
    g.add(post);
  }
  const truss = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.6, 0.6, 0.6), steel);
  truss.position.set(0, h, 0);
  g.add(truss);
  const signs = lines.length;
  const sw = Math.min(7, (w * 2 - 1) / signs - 0.4);
  lines.forEach((ln, k) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#0d6b3a';
    x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#e9efe9';
    x.lineWidth = 8;
    x.strokeRect(10, 10, 492, 236);
    x.fillStyle = '#f2f5f2';
    x.textAlign = 'center';
    x.font = 'bold 64px "Arial Narrow", Arial, sans-serif';
    x.fillText(ln[0], 256, 110);
    x.font = 'bold 40px Arial, sans-serif';
    x.fillText(ln[1] || '', 256, 175);
    if (ln[2]) { x.font = 'bold 54px Arial'; x.fillText(ln[2], 256, 232); }
    const tex = toTex(c, { repeat: false });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: world.at.lamps ? 0.35 : 0.0 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.5), mat);
    sign.position.set(-w + 0.8 + (k + 0.5) * ((w * 2 - 1.6) / signs), h + 0.1, 0.32);
    sign.rotation.y = 0;
    g.add(sign);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.5), steel);
    back.position.copy(sign.position);
    back.position.z -= 0.02;
    back.rotation.y = Math.PI;
    g.add(back);
  });
  g.position.set(p.x, p.y, p.z);
  // face oncoming traffic: sign front (+z local) toward −tangent
  g.rotation.y = p.heading + Math.PI;
  world.add(g);
  if (world.at.lamps) world.addLamp(p.x, p.y + h + 1, p.z, '#cfe6ff', 10, 0.5);
  return g;
}

/** Rooftop/roadside billboard on two legs. */
export function billboard(world, x, y, z, ry, w, h, lines, colors, opts = {}) {
  const tex = billboardTexture(lines, colors[0], colors[1], colors[2], lines.join(''));
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: world.at.lamps ? 0.55 : 0 });
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.y = (opts.legH ?? 4) + h / 2;
  g.add(face);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.25), new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.7 }));
  frame.position.set(0, face.position.y, -0.15);
  g.add(frame);
  for (const sd of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, opts.legH ?? 4, 0.3), frame.material);
    leg.position.set(sd * w * 0.3, (opts.legH ?? 4) / 2, -0.2);
    g.add(leg);
  }
  g.position.set(x, y, z);
  g.rotation.y = ry;
  world.add(g);
  if (world.at.lamps) world.addStreak(x, y + (opts.legH ?? 4) + h / 2, z, colors[2], 1.2);
  return g;
}

/** A ring of tall dark blocks with lit windows far out — the skyline. */
export function skyline(world, cx, cz, radius, count, opts = {}) {
  const rng = makeRng('skyline' + (world.def.id || ''));
  const gb = new GeoBuilder();
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + rng() * 0.05;
    const r = radius * (0.9 + rng() * 0.35);
    const w = 20 + rng() * 45, d = 20 + rng() * 40;
    const h = (opts.minH ?? 40) + Math.pow(rng(), 2) * (opts.maxH ?? 220);
    gb.box(cx + Math.cos(a) * r, opts.y ?? -2, cz + Math.sin(a) * r, w, h, d, rng() * Math.PI, { uw: 18, uh: 36, top: false });
  }
  const tex = opts.tex;
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0x15171c, roughness: 0.9,
    map: tex?.map || null, emissive: 0xffffff, emissiveMap: tex?.emi || null,
    emissiveIntensity: world.at.lamps ? 1.4 : 0.0, fog: true,
  });
  const m = new THREE.Mesh(gb.build(), mat);
  world.add(m);
  return m;
}

export { clamp, makeRng };
