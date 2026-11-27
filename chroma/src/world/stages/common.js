// Shared helpers for stage decor builders (visual only, never collides).
import * as THREE from 'three';
import { signTexture } from '../textures.js';

export const std = (c, ro = 0.6, me = 0.1, ex = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me, ...ex });
export const glow = (c, i = 3, ex = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.5, ...ex });
export const basic = (c, ex = {}) => new THREE.MeshBasicMaterial({ color: c, ...ex });

export function decorGroup(scene) {
  const g = new THREE.Group();
  g.name = 'decor';
  scene.add(g);
  return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
// Matrix for a placement { p:[x,y,z], ry, rx, rz, s: number | [x,y,z] }
export function placeMatrix(it, out = _m) {
  _e.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  const s = it.s ?? 1;
  if (Array.isArray(s)) _s.set(s[0], s[1], s[2]); else _s.set(s, s, s);
  _p.set(it.p[0], it.p[1], it.p[2]);
  return out.compose(_p, _q, _s);
}

// One InstancedMesh for many placements (optionally per-instance colours via it.c)
export function instanced(group, geo, mat, items, { shadow = false, receive = false, name } = {}) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, placeMatrix(it));
    if (it.c !== undefined) mesh.setColorAt(i, new THREE.Color(it.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  group.add(mesh);
  return mesh;
}

// Team-coloured spawn pads: glowing ring + soft disc on each base deck.
export function spawnPads(group, def, { radius = 3.2 } = {}) {
  const ringGeo = new THREE.TorusGeometry(radius, 0.12, 8, 48);
  const discGeo = new THREE.CircleGeometry(radius - 0.1, 48);
  for (const [team, z] of [[1, -def.spawnZ], [2, def.spawnZ]]) {
    const ring = new THREE.Mesh(ringGeo, basic(0xffffff));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, def.spawnY + 0.04, z);
    ring.userData.team = team;
    ring.name = 'spawnRing';
    group.add(ring);
    const disc = new THREE.Mesh(discGeo, basic(0xffffff, { transparent: true, opacity: 0.18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, def.spawnY + 0.03, z);
    disc.userData.team = team;
    disc.name = 'spawnDisc';
    group.add(disc);
  }
}

export function setTeamColors(group, a, b) {
  group.traverse((o) => {
    if ((o.name === 'spawnRing' || o.name === 'spawnDisc' || o.name === 'teamGlow') && o.material) {
      o.material.color.set(o.userData.team === 1 ? a : b).multiplyScalar(o.name === 'spawnDisc' ? 1 : 2.5);
      if (o.material.emissive) o.material.emissive.set(o.userData.team === 1 ? a : b);
    }
  });
}

// Big framed stage-name board on two legs. Returns the group (faces +Z locally).
export function nameBoard(text, { w = 18, h = 4.5, accent = '#ff2e88', bg = '#1b1e2b', fg = '#ffffff', frame = 0x2d3040, legH = 9, size = 110 } = {}) {
  const g = new THREE.Group();
  const tex = signTexture(text.toUpperCase(), { w: 1024, h: 256, size, accent, bg, fg });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, legH + h / 2, 0.22);
  g.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.4), std(frame, 0.6, 0.3));
  back.position.set(0, legH + h / 2, 0);
  g.add(back);
  const legGeo = new THREE.BoxGeometry(0.5, legH, 0.5);
  for (const x of [-w * 0.32, w * 0.32]) {
    const leg = new THREE.Mesh(legGeo, back.material);
    leg.position.set(x, legH / 2, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

// Every level entry of a stage (sym + mirrored + their mirrors) as
// { kind, min, max, opts } so decor can follow the layout.
const flip = { '+z': '-z', '-z': '+z', '+x': '-x', '-x': '+x' };
export function allEntries(def) {
  const out = [];
  for (const [kind, min, max, opts] of def.sym) out.push({ kind, min, max, opts });
  for (const [kind, min, max, opts] of def.mirrored) {
    out.push({ kind, min, max, opts });
    out.push({ kind, min: [-max[0], min[1], -max[2]], max: [-min[0], max[1], -min[2]], opts: { ...opts, rise: opts.rise ? flip[opts.rise] : undefined } });
  }
  return out;
}

// Points along the outline of the ground slabs (entries whose bottom is at or
// below floorBottom) that face open water / void: [{ x, z, nx, nz }].
export function edgePoints(def, { spacing = 3, floorBottom = -2.5, offset = 0 } = {}) {
  const slabs = allEntries(def).filter((e) => e.kind === 'box' && e.min[1] <= floorBottom);
  const inside = (x, z) => slabs.some((s) => x > s.min[0] - 1e-3 && x < s.max[0] + 1e-3 && z > s.min[2] - 1e-3 && z < s.max[2] + 1e-3);
  const pts = [];
  for (const s of slabs) {
    const [x0, , z0] = s.min, [x1, , z1] = s.max;
    const sides = [[x0, z0, x1, z0, 0, -1], [x1, z0, x1, z1, 1, 0], [x1, z1, x0, z1, 0, 1], [x0, z1, x0, z0, -1, 0]];
    for (const [ax, az, bx, bz, nx, nz] of sides) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / spacing));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (inside(x + nx * 0.4, z + nz * 0.4)) continue;
        pts.push({ x: x + nx * offset, z: z + nz * offset, nx, nz });
      }
    }
  }
  return pts;
}

// Canvas texture helper (sRGB, repeat)
export function canvasTex(w, h, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
