// Level geometry: convex solids (boxes + ramps) used for rendering, paint
// faces, character collision, projectile raycasts and AO baking.
import * as THREE from 'three';
import { clamp } from '../util.js';

const CELL = 4;
const tmpV = new THREE.Vector3();

export class Level {
  constructor(paint) {
    this.paint = paint;
    this.solids = [];
    this.killY = -2.6;
    this.stamp = 0;
    this.meshes = [];
  }

  box(min, max, opts = {}) {
    const s = {
      id: this.solids.length, type: 'box',
      min: new THREE.Vector3(...min), max: new THREE.Vector3(...max),
      mat: opts.mat || 'concrete', color: new THREE.Color(opts.color ?? 0xffffff),
      paintable: opts.paintable !== false, collide: opts.collide !== false, render: opts.render !== false,
      bottom: !!opts.bottom, skip: opts.skip || [], stamp: 0, tag: opts.tag || null,
    };
    this.solids.push(s);
    return s;
  }

  // rise: '+z' | '-z' | '+x' | '-x' (direction the ramp goes UP towards)
  ramp(min, max, rise, opts = {}) {
    const s = this.box(min, max, opts);
    s.type = 'ramp';
    s.rise = rise;
    return s;
  }

  rampT(s, x, z) {
    const { min, max } = s;
    switch (s.rise) {
      case '+z': return (z - min.z) / (max.z - min.z);
      case '-z': return (max.z - z) / (max.z - min.z);
      case '+x': return (x - min.x) / (max.x - min.x);
      default: return (max.x - x) / (max.x - min.x);
    }
  }

  topAt(s, x, z) {
    if (s.type === 'box') return s.max.y;
    const t = clamp(this.rampT(s, clamp(x, s.min.x, s.max.x), clamp(z, s.min.z, s.max.z)), 0, 1);
    return s.min.y + (s.max.y - s.min.y) * t;
  }

  // ------------------------------------------------------------------ build
  build() {
    const b = this.bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const s of this.solids) {
      b.minX = Math.min(b.minX, s.min.x); b.maxX = Math.max(b.maxX, s.max.x);
      b.minZ = Math.min(b.minZ, s.min.z); b.maxZ = Math.max(b.maxZ, s.max.z);
    }
    this.ox = b.minX - CELL; this.oz = b.minZ - CELL;
    this.gw = Math.ceil((b.maxX - this.ox) / CELL) + 2;
    this.gh = Math.ceil((b.maxZ - this.oz) / CELL) + 2;
    this.grid = Array.from({ length: this.gw * this.gh }, () => []);
    for (const s of this.solids) {
      this.makePlanesAndFaces(s);
      const [x0, z0] = this.cellOf(s.min.x, s.min.z), [x1, z1] = this.cellOf(s.max.x, s.max.z);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.grid[z * this.gw + x].push(s);
    }
  }

  cellOf(x, z) {
    return [clamp(Math.floor((x - this.ox) / CELL), 0, this.gw - 1), clamp(Math.floor((z - this.oz) / CELL), 0, this.gh - 1)];
  }

  nearby(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const st = ++this.stamp;
    const [x0, z0] = this.cellOf(minX, minZ), [x1, z1] = this.cellOf(maxX, maxZ);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const c = this.grid[z * this.gw + x];
      for (let i = 0; i < c.length; i++) {
        const s = c[i];
        if (s.stamp !== st) { s.stamp = st; out.push(s); }
      }
    }
    return out;
  }

  makePlanesAndFaces(s) {
    const { min, max } = s;
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    s.planes = []; s.faces = [];
    let center = P((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    s.center = center;
    const addPlane = (n, pt, face) => {
      n = n.clone().normalize();
      s.planes.push({ n, d: n.dot(pt), face });
    };
    // face from 3 points: p0 origin, p1 along u, p3 along v ; poly in (s,t)
    const addFace = (p0, p1, p3, polyKind, name) => {
      if (!s.render || s.skip.includes(name)) return null;
      let u = p1.clone().sub(p0), v = p3.clone().sub(p0);
      let w = u.length(), h = v.length();
      u.normalize(); v.normalize();
      const n = u.clone().cross(v);
      const fc = p0.clone().addScaledVector(u, w / 2).addScaledVector(v, h / 2);
      let swapped = false;
      if (n.dot(fc.clone().sub(center)) < 0) { [u, v] = [v, u]; [w, h] = [h, w]; swapped = true; }
      let poly;
      if (polyKind === 'rect') poly = [[0, 0], [w, 0], [w, h], [0, h]];
      else {
        // triangle p0, p1, p3' where third vertex is at (s=?,t=?) — given as polyKind array in unswapped coords
        poly = polyKind.map(([a, b]) => (swapped ? [b * w, a * h] : [a * w, b * h]));
        // keep CCW winding w.r.t. normal
        const area = poly.reduce((acc, p, i) => { const q = poly[(i + 1) % poly.length]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0);
        if (area < 0) poly.reverse();
      }
      const f = this.paint.addFace(p0, u, v, w, h, { solid: s, paintable: s.paintable });
      f.poly = poly; f.name = name;
      s.faces.push(f);
      return f;
    };
    if (s.type === 'box') {
      const top = addFace(P(min.x, max.y, max.z), P(max.x, max.y, max.z), P(min.x, max.y, min.z), 'rect', 'top');
      const px = addFace(P(max.x, min.y, max.z), P(max.x, min.y, min.z), P(max.x, max.y, max.z), 'rect', 'px');
      const nx = addFace(P(min.x, min.y, min.z), P(min.x, min.y, max.z), P(min.x, max.y, min.z), 'rect', 'nx');
      const pz = addFace(P(min.x, min.y, max.z), P(max.x, min.y, max.z), P(min.x, max.y, max.z), 'rect', 'pz');
      const nz = addFace(P(max.x, min.y, min.z), P(min.x, min.y, min.z), P(max.x, max.y, min.z), 'rect', 'nz');
      const bot = s.bottom ? addFace(P(min.x, min.y, min.z), P(max.x, min.y, min.z), P(min.x, min.y, max.z), 'rect', 'bottom') : null;
      addPlane(P(0, 1, 0), max, top);
      addPlane(P(1, 0, 0), max, px);
      addPlane(P(-1, 0, 0), min, nx);
      addPlane(P(0, 0, 1), max, pz);
      addPlane(P(0, 0, -1), min, nz);
      addPlane(P(0, -1, 0), min, bot);
      s.sideFace = { px, nx, pz, nz, top };
    } else {
      const lx = (a, b) => (s.rise === '+z' || s.rise === '-z')
        ? [min.x + (max.x - min.x) * a, s.rise === '+z' ? min.z + (max.z - min.z) * b : max.z - (max.z - min.z) * b]
        : [s.rise === '+x' ? min.x + (max.x - min.x) * b : max.x - (max.x - min.x) * b, min.z + (max.z - min.z) * a];
      const Q = (a, b, y) => { const [x, z] = lx(a, b); return P(x, y, z); };
      center = Q(0.5, 0.68, min.y + (max.y - min.y) * 0.3); // wedge centroid (AABB centre lies on the slope)
      const L0 = Q(0, 0, min.y), L1 = Q(1, 0, min.y), B0 = Q(0, 1, min.y), B1 = Q(1, 1, min.y);
      const T0 = Q(0, 1, max.y), T1 = Q(1, 1, max.y);
      const slope = addFace(L0, L1, T0, 'rect', 'top');
      const back = addFace(B0, B1, T0, 'rect', 'back');
      // side triangles: rect L0->B0 (u) by L0->(L0+up) (v); triangle (0,0),(1,0),(1,1)
      const side0 = addFace(L0, B0, P(L0.x, max.y, L0.z), [[0, 0], [1, 0], [1, 1]], 'side0');
      const side1 = addFace(L1, B1, P(L1.x, max.y, L1.z), [[0, 0], [1, 0], [1, 1]], 'side1');
      let sn = L1.clone().sub(L0).cross(T0.clone().sub(L0)).normalize();
      if (sn.y < 0) sn.negate();
      addPlane(sn, L0, slope);
      addPlane(B0.clone().sub(L0).setY(0), B0, back);
      addPlane(L0.clone().sub(L1).setY(0), L0, side0);
      addPlane(L1.clone().sub(L0).setY(0), L1, side1);
      addPlane(P(0, -1, 0), min, null);
      s.sideFace = { back, side0, side1, top: slope };
      s.slopeN = sn;
    }
  }

  // Build render meshes (after paint.finalize()). mats: name -> {material, uvScale}
  buildMeshes(mats, scene) {
    const groups = new Map();
    const uvTmp = [0, 0];
    for (const s of this.solids) {
      for (const f of s.faces) {
        const key = mats[s.mat] ? s.mat : 'concrete';
        if (!groups.has(key)) groups.set(key, { pos: [], nor: [], uv: [], puv: [], fi: [], col: [] });
        const g = groups.get(key);
        const scale = 1 / (mats[key]?.uvScale || 2);
        const n = f.n;
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        const verts = f.poly.map(([ss, tt]) => {
          const p = f.origin.clone().addScaledVector(f.u, ss).addScaledVector(f.v, tt);
          let U, V;
          if (ay >= ax && ay >= az) { U = p.x; V = p.z; }
          else if (ax >= az) { U = p.z * Math.sign(n.x || 1) * -1; V = p.y; }
          else { U = p.x * Math.sign(n.z || 1); V = p.y; }
          if (f.name === 'top' && s.type === 'ramp') { U = ss; V = tt; }
          this.paint.uvOf(f, ss, tt, uvTmp);
          return { p, U: U * scale, V: V * scale, pu: uvTmp[0], pv: uvTmp[1], ss, tt };
        });
        for (let i = 1; i < verts.length - 1; i++) {
          for (const vv of [verts[0], verts[i], verts[i + 1]]) {
            g.pos.push(vv.p.x, vv.p.y, vv.p.z);
            g.nor.push(n.x, n.y, n.z);
            g.uv.push(vv.U, vv.V);
            g.puv.push(vv.pu, vv.pv);
            g.fi.push(vv.ss, vv.tt, f.w, f.h);
            g.col.push(s.color.r, s.color.g, s.color.b);
          }
        }
      }
    }
    for (const [key, g] of groups) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('paintUv', new THREE.Float32BufferAttribute(g.puv, 2));
      geo.setAttribute('faceInfo', new THREE.Float32BufferAttribute(g.fi, 4));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[key].material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'level-' + key;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  // ------------------------------------------------------------------ queries
  sdf(p) {
    const R = 1.6;
    const list = this.nearby(p.x - R, p.z - R, p.x + R, p.z + R, this._sdfList || (this._sdfList = []));
    let best = R;
    for (const s of list) {
      let d;
      if (s.type === 'box') {
        const cx = (s.min.x + s.max.x) / 2, cy = (s.min.y + s.max.y) / 2, cz = (s.min.z + s.max.z) / 2;
        const qx = Math.abs(p.x - cx) - (s.max.x - s.min.x) / 2;
        const qy = Math.abs(p.y - cy) - (s.max.y - s.min.y) / 2;
        const qz = Math.abs(p.z - cz) - (s.max.z - s.min.z) / 2;
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
        d = Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0);
      } else {
        d = -Infinity;
        for (const pl of s.planes) d = Math.max(d, pl.n.dot(p) - pl.d);
      }
      if (d < best) best = d;
    }
    return best;
  }

  // Highest walkable surface under a circle at (x,z) not above footY+step
  groundAt(x, z, footY, r = 0.25, step = 0.45) {
    const list = this.nearby(x - r, z - r, x + r, z + r, this._gList || (this._gList = []));
    let best = -Infinity, bs = null;
    for (const s of list) {
      if (!s.collide) continue;
      const qx = clamp(x, s.min.x, s.max.x), qz = clamp(z, s.min.z, s.max.z);
      const dx = x - qx, dz = z - qz;
      if (dx * dx + dz * dz > r * r) continue;
      const top = s.type === 'box' ? s.max.y : this.topAt(s, qx, qz);
      if (top <= footY + step && top > best) { best = top; bs = s; }
    }
    return { y: best, solid: bs };
  }

  // Topmost surface at (x,z) ignoring height (for nav + spawn placement)
  heightAt(x, z) {
    const list = this.nearby(x, z, x, z, this._hList || (this._hList = []));
    let best = -Infinity, bs = null;
    for (const s of list) {
      if (!s.collide) continue;
      if (x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z) continue;
      const top = this.topAt(s, x, z);
      if (top > best) { best = top; bs = s; }
    }
    return { y: best, solid: bs };
  }

  // Push a vertical cylinder out of solids. Returns the most significant wall contact.
  collide(pos, vel, r, height, step = 0.45) {
    let wall = null;
    const list = this.nearby(pos.x - r - 0.1, pos.z - r - 0.1, pos.x + r + 0.1, pos.z + r + 0.1, this._cList || (this._cList = []));
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const s of list) {
        if (!s.collide) continue;
        if (s.min.y >= pos.y + height) continue;
        const qx = clamp(pos.x, s.min.x, s.max.x), qz = clamp(pos.z, s.min.z, s.max.z);
        const top = s.type === 'box' ? s.max.y : this.topAt(s, qx, qz);
        if (top <= pos.y + step) continue;
        let dx = pos.x - qx, dz = pos.z - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let nx, nz, push;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d; push = r - d;
        } else {
          const pen = [pos.x - s.min.x, s.max.x - pos.x, pos.z - s.min.z, s.max.z - pos.z];
          let k = 0;
          for (let i = 1; i < 4; i++) if (pen[i] < pen[k]) k = i;
          nx = k === 0 ? -1 : k === 1 ? 1 : 0;
          nz = k === 2 ? -1 : k === 3 ? 1 : 0;
          push = pen[k] + r;
        }
        pos.x += nx * push; pos.z += nz * push;
        if (vel) {
          const vn = vel.x * nx + vel.z * nz;
          if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
        }
        any = true;
        const face = this.wallFace(s, nx, nz);
        if (!wall || push > wall.push) wall = { solid: s, nx, nz, push, face, top };
      }
      if (!any) break;
    }
    return wall;
  }

  wallFace(s, nx, nz) {
    const sf = s.sideFace;
    if (!sf) return null;
    if (s.type === 'box') {
      if (Math.abs(nx) >= Math.abs(nz)) return nx > 0 ? sf.px : sf.nx;
      return nz > 0 ? sf.pz : sf.nz;
    }
    let best = null, bd = -2;
    for (const pl of s.planes) {
      if (!pl.face || Math.abs(pl.n.y) > 0.5) continue;
      const d = pl.n.x * nx + pl.n.z * nz;
      if (d > bd) { bd = d; best = pl.face; }
    }
    return best;
  }

  // Segment / ray cast against solids. Returns {t, point, normal, solid, face} or null.
  raycast(o, dir, maxDist, opts = {}) {
    const st = ++this.stamp;
    let best = maxDist, hit = null;
    let cx = Math.floor((o.x - this.ox) / CELL), cz = Math.floor((o.z - this.oz) / CELL);
    const stepX = dir.x > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const adx = Math.abs(dir.x), adz = Math.abs(dir.z);
    const tDX = adx > 1e-9 ? CELL / adx : Infinity, tDZ = adz > 1e-9 ? CELL / adz : Infinity;
    let tMX = adx > 1e-9 ? ((stepX > 0 ? (cx + 1) * CELL + this.ox - o.x : o.x - (cx * CELL + this.ox)) / adx) : Infinity;
    let tMZ = adz > 1e-9 ? ((stepZ > 0 ? (cz + 1) * CELL + this.oz - o.z : o.z - (cz * CELL + this.oz)) / adz) : Infinity;
    let t = 0;
    for (let guard = 0; guard < 256 && t <= best; guard++) {
      if (cx >= 0 && cz >= 0 && cx < this.gw && cz < this.gh) {
        const cell = this.grid[cz * this.gw + cx];
        for (let i = 0; i < cell.length; i++) {
          const s = cell[i];
          if (s.stamp === st) continue;
          s.stamp = st;
          if (!s.collide && !opts.all) continue;
          const r = this.clip(s, o, dir, best);
          if (r && r.t < best) { best = r.t; hit = r; }
        }
      } else if ((cx < -1 && stepX < 0) || (cz < -1 && stepZ < 0) || (cx > this.gw && stepX > 0) || (cz > this.gh && stepZ > 0)) break;
      if (tMX < tMZ) { t = tMX; tMX += tDX; cx += stepX; } else { t = tMZ; tMZ += tDZ; cz += stepZ; }
    }
    if (hit) {
      hit.point = o.clone().addScaledVector(dir, hit.t);
    }
    return hit;
  }

  clip(s, o, dir, maxT) {
    let tE = 0, tX = maxT, enter = null;
    for (const pl of s.planes) {
      const denom = pl.n.x * dir.x + pl.n.y * dir.y + pl.n.z * dir.z;
      const dist = pl.n.x * o.x + pl.n.y * o.y + pl.n.z * o.z - pl.d;
      if (Math.abs(denom) < 1e-9) { if (dist > 0) return null; continue; }
      const t = -dist / denom;
      if (denom < 0) { if (t > tE) { tE = t; enter = pl; } }
      else if (t < tX) tX = t;
      if (tE > tX) return null;
    }
    if (!enter) return null; // started inside
    return { t: tE, normal: enter.n, solid: s, face: enter.face };
  }

  // Line of sight between two points
  visible(a, b) {
    tmpV.subVectors(b, a);
    const d = tmpV.length();
    if (d < 1e-4) return true;
    tmpV.divideScalar(d);
    return !this.raycast(a, tmpV.clone(), d - 0.05);
  }

  // Face beneath a foot position (for ink-under-feet queries)
  floorFace(solid) { return solid?.sideFace?.top || null; }

  dispose() {
    for (const m of this.meshes) { m.geometry.dispose(); m.parent?.remove(m); }
    this.meshes = [];
  }
}
