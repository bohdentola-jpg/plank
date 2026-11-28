// The player's house at Prism Heights: the room shell (walls, window, front
// door, ceiling lamps), the city outside the window, the weapon displays by the
// door (every class shown its own way), colliders and furniture placement rules.
import * as THREE from 'three';
import { Level } from './level.js';
import { getTex, signTexture } from './textures.js';
import { buildWeaponModel } from '../actors/character.js';
import { WEAPONS, WEAPON_IDS } from '../actors/weapons.js';
import { FURNITURE, box, cyl, sph, rbox, lathe, torus, mergeParts, wallpaperCanvas, floorCanvas } from './furniture.js';
import { rng } from '../util.js';

// ---------------------------------------------------------------- layout
export const ROOM = { x0: -8, x1: 8, z0: -6, z1: 6, h: 3.8, t: 0.3 };
export const GRID = 0.5;
export const DOOR = { x: -3.6, w: 1.5, h: 2.5 }; // in the south wall
export const OPENINGS = {
  0: [{ u0: -1.0, u1: 4.0, y0: 0.85, y1: 2.85, kind: 'window' }],
  1: [{ u0: -2.6, u1: 0.2, y0: 0.95, y1: 2.75, kind: 'window' }],
  2: [{ u0: DOOR.x - DOOR.w / 2, u1: DOOR.x + DOOR.w / 2, y0: 0, y1: DOOR.h, kind: 'door' }],
  3: [],
};
// no furniture here: the entry strip by the door and the weapon wall
export const RESERVED_FLOOR = [[-8, 4.4, 1.0, 6], [-8, -0.6, -6.6, 6]];
export const RESERVED_WALL = {
  0: [[-1.6, 4.6, 0.5, 3.4]],
  1: [[-3.1, 0.7, 0.6, 3.3]],
  2: [[-8, 1.0, 0, 3.8]],
  3: [[-0.6, 6, 0, 3.8]],
};
export const SPAWN = {
  title: { pos: new THREE.Vector3(0.8, 0, 2.6), yaw: Math.PI },
  plaza: { pos: new THREE.Vector3(DOOR.x, 0, 4.3), yaw: Math.PI },
};
export const DOOR_FRONT = new THREE.Vector3(DOOR.x, 0, ROOM.z1 - 0.9);

// wall frames: normal points into the room, u runs along the wall
export function wallFrame(w) {
  const R = ROOM;
  switch (w) {
    case 0: return { n: new THREE.Vector3(0, 0, 1), a: new THREE.Vector3(1, 0, 0), u0: R.x0, u1: R.x1, at: (u, y, d) => new THREE.Vector3(u, y, R.z0 + d), yaw: 0, len: R.x1 - R.x0 };
    case 1: return { n: new THREE.Vector3(-1, 0, 0), a: new THREE.Vector3(0, 0, 1), u0: R.z0, u1: R.z1, at: (u, y, d) => new THREE.Vector3(R.x1 - d, y, u), yaw: -Math.PI / 2, len: R.z1 - R.z0 };
    case 2: return { n: new THREE.Vector3(0, 0, -1), a: new THREE.Vector3(1, 0, 0), u0: R.x0, u1: R.x1, at: (u, y, d) => new THREE.Vector3(u, y, R.z1 - d), yaw: Math.PI, len: R.x1 - R.x0 };
    default: return { n: new THREE.Vector3(1, 0, 0), a: new THREE.Vector3(0, 0, 1), u0: R.z0, u1: R.z1, at: (u, y, d) => new THREE.Vector3(R.x0 + d, y, u), yaw: Math.PI / 2, len: R.z1 - R.z0 };
  }
}
// u coordinate + wall plane distance of a world point
export function toWall(w, p) {
  const R = ROOM;
  return w === 0 ? { u: p.x, d: p.z - R.z0 } : w === 1 ? { u: p.z, d: R.x1 - p.x } : w === 2 ? { u: p.x, d: R.z1 - p.z } : { u: p.z, d: p.x - R.x0 };
}

// ---------------------------------------------------------------- placement maths
export const snap = (v, g = GRID) => Math.round(v / g) * g;
export function footprint(def, r) { return r % 2 ? [def.d, def.w] : [def.w, def.d]; }
export function rectAt(def, x, z, r) { const [w, d] = footprint(def, r); return [x - w / 2, z - d / 2, x + w / 2, z + d / 2]; }
export const overlap = (a, b, e = 0.01) => a[0] < b[2] - e && a[2] > b[0] + e && a[1] < b[3] - e && a[3] > b[1] + e;
const inside = (a, b, e = 0.01) => a[0] >= b[0] - e && a[2] <= b[2] + e && a[1] >= b[1] - e && a[3] <= b[3] + e;
export function rotLocal(x, z, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return [x * c + z * s, -x * s + z * c]; }
// snap a floor footprint so its corner sits on the grid
export function snapFloor(def, px, pz, r) {
  const [w, d] = footprint(def, r);
  const R = ROOM;
  let x = snap(px - w / 2) + w / 2, z = snap(pz - d / 2) + d / 2;
  x = Math.min(R.x1 - w / 2, Math.max(R.x0 + w / 2, x));
  z = Math.min(R.z1 - d / 2, Math.max(R.z0 + d / 2, z));
  return [x, z];
}

// layout: [{uid, id, x, z, r, on?, wall?, y?}] (surface children use local coords)
export function worldOf(layout, it) {
  if (it.on == null) return { x: it.x, z: it.z, r: it.r || 0, y: 0 };
  const p = layout.find((o) => o.uid === it.on);
  if (!p) return { x: it.x, z: it.z, r: it.r || 0, y: 0 };
  const [dx, dz] = rotLocal(it.x, it.z, (p.r || 0) * Math.PI / 2);
  return { x: p.x + dx, z: p.z + dz, r: ((p.r || 0) + (it.r || 0)) % 4, y: FURNITURE[p.id].top || 0 };
}

// can `def` go at (x, z, r) on the floor? (ignoring item `skip`)
export function canPlaceFloor(layout, def, x, z, r, skip = null) {
  const R = ROOM;
  const rc = rectAt(def, x, z, r);
  if (rc[0] < R.x0 - 0.01 || rc[2] > R.x1 + 0.01 || rc[1] < R.z0 - 0.01 || rc[3] > R.z1 + 0.01) return false;
  for (const rr of RESERVED_FLOOR) if (overlap(rc, rr)) return false;
  for (const o of layout) {
    if (o.uid === skip || o.wall != null || o.on != null) continue;
    const od = FURNITURE[o.id];
    if (def.kind === 'rug') { if (od.kind === 'rug' && overlap(rc, rectAt(od, o.x, o.z, o.r), 0.05)) return false; continue; }
    if (od.kind === 'rug') continue;
    if (overlap(rc, rectAt(od, o.x, o.z, o.r))) return false;
  }
  return true;
}

// can a small item sit on surface `parent` at local (lx, lz, lr)?
export function canPlaceOn(layout, def, parent, lx, lz, lr, skip = null) {
  const pd = FURNITURE[parent.id];
  if (!pd.top || def.kind !== 'small') return false;
  const area = [-pd.w / 2, -pd.d / 2, pd.w / 2, pd.d / 2];
  const rc = rectAt(def, lx, lz, lr);
  if (!inside(rc, area)) return false;
  for (const o of layout) {
    if (o.uid === skip || o.on !== parent.uid) continue;
    if (overlap(rc, rectAt(FURNITURE[o.id], o.x, o.z, o.r))) return false;
  }
  return true;
}

export function canPlaceWall(layout, def, wall, u, y, skip = null) {
  const f = wallFrame(wall);
  const rc = [u - def.w / 2, y - def.h / 2, u + def.w / 2, y + def.h / 2];
  if (rc[0] < f.u0 + 0.05 || rc[2] > f.u1 - 0.05 || rc[1] < 0.15 || rc[3] > ROOM.h - 0.12) return false;
  for (const r of RESERVED_WALL[wall] || []) if (overlap(rc, [r[0], r[2], r[1], r[3]])) return false;
  for (const o of layout) {
    if (o.uid === skip || o.wall !== wall) continue;
    const od = FURNITURE[o.id];
    if (overlap(rc, [o.x - od.w / 2, o.y - od.h / 2, o.x + od.w / 2, o.y + od.h / 2])) return false;
  }
  return true;
}

// colliders for the furniture (world boxes)
export function furnitureColliders(layout) {
  const out = [];
  for (const it of layout) {
    if (it.wall != null || it.on != null) continue;
    const def = FURNITURE[it.id];
    if (def.kind === 'rug' || def.kind === 'small' || def.block === false) continue;
    const yaw = (it.r || 0) * Math.PI / 2;
    const cols = def.cols || [[-def.w / 2, -def.d / 2, def.w / 2, def.d / 2, def.h]];
    for (const c of cols) {
      const pts = [rotLocal(c[0], c[1], yaw), rotLocal(c[2], c[3], yaw)];
      const x0 = Math.min(pts[0][0], pts[1][0]) + it.x, x1 = Math.max(pts[0][0], pts[1][0]) + it.x;
      const z0 = Math.min(pts[0][1], pts[1][1]) + it.z, z1 = Math.max(pts[0][1], pts[1][1]) + it.z;
      out.push({ min: [x0 + 0.03, c[5] || 0, z0 + 0.03], max: [x1 - 0.03, c[4], z1 - 0.03] });
    }
  }
  return out;
}

export function buildHouseLevel(boxes) {
  const R = ROOM, T = 0.6;
  const lvl = new Level(null);
  lvl.killY = -40;
  const B = (min, max) => lvl.box(min, max, { render: false, paintable: false });
  B([R.x0 - T, -1, R.z0 - T], [R.x1 + T, 0, R.z1 + T]);
  B([R.x0 - T, 0, R.z0 - T], [R.x0, R.h, R.z1 + T]);
  B([R.x1, 0, R.z0 - T], [R.x1 + T, R.h, R.z1 + T]);
  B([R.x0, 0, R.z0 - T], [R.x1, R.h, R.z0]);
  B([R.x0, 0, R.z1], [R.x1, R.h, R.z1 + T]);
  B([R.x0 - T, R.h, R.z0 - T], [R.x1 + T, R.h + 0.5, R.z1 + T]);
  for (const b of boxes) B(b.min, b.max);
  lvl.build();
  return lvl;
}

// ---------------------------------------------------------------- materials for the shell
function texFromCanvas(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const FLOOR_ROUGH = { oak: 0.5, walnut: 0.45, checker: 0.25, carpet: 0.95, parquet: 0.5, marble: 0.15, terrazzo: 0.35, neon: 0.3 };

// plane on a wall rect, UVs in metres (2 m texture tiles)
function wallPlane(w, u0, u1, y0, y1, mat, d = 0.002) {
  const f = wallFrame(w);
  const geo = new THREE.PlaneGeometry(u1 - u0, y1 - y0);
  const uv = geo.attributes.uv;
  const flip = w === 0 || w === 3 ? 1 : -1; // texture reads left-to-right from inside
  for (let i = 0; i < uv.count; i++) {
    const uu = uv.getX(i), vv = uv.getY(i);
    const U = u0 + uu * (u1 - u0), V = y0 + vv * (y1 - y0);
    uv.setXY(i, (flip > 0 ? U : -U) / 2, V / 2);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(f.at((u0 + u1) / 2, (y0 + y1) / 2, d));
  m.rotation.y = f.yaw;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- the room
export function buildShell(scene, kit, { wall = 'cream', floor = 'oak', ink = '#ff2e88', lowLights = false } = {}) {
  const R = ROOM;
  const root = new THREE.Group(); root.name = 'house-shell'; scene.add(root);
  const walls = [0, 1, 2, 3].map((i) => { const g = new THREE.Group(); g.name = 'wall' + i; root.add(g); return g; });
  const stubs = [];
  const ceiling = new THREE.Group(); ceiling.name = 'ceiling'; root.add(ceiling);
  const updaters = [];
  const add = (geo, mat, x, y, z, parent = root, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // ---- materials
  const wpMat = new THREE.MeshStandardMaterial({ roughness: 0.88, envMapIntensity: 0.3 });
  const flMat = new THREE.MeshStandardMaterial({ roughness: 0.5, envMapIntensity: 0.35 });
  const extMat = kit.std(0xf7d9e6, 0.9);
  // invisible shadow casters: the room stays shaded even with walls cut away in decorate mode
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const trim = kit.std(0xfffaf2, 0.45);
  const setWallpaper = (id, newInk) => {
    if (newInk) ink = newInk;
    const c = wallpaperCanvas(id, ink).canvas;
    wpMat.map?.dispose(); wpMat.map = texFromCanvas(c); wpMat.needsUpdate = true;
  };
  const setFloor = (id) => {
    const fc = floorCanvas(id);
    flMat.map?.dispose(); flMat.map = texFromCanvas(fc.canvas);
    flMat.emissiveMap?.dispose();
    if (fc.glow) { flMat.emissiveMap = texFromCanvas(fc.glow); flMat.emissive.set(0xffffff); flMat.emissiveIntensity = 1.4; }
    else { flMat.emissiveMap = null; flMat.emissive.set(0x000000); }
    flMat.roughness = FLOOR_ROUGH[id] ?? 0.5;
    flMat.needsUpdate = true;
  };
  setWallpaper(wall); setFloor(floor);

  // ---- floor
  const fgeo = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0);
  fgeo.rotateX(-Math.PI / 2);
  { const p = fgeo.attributes.position, uv = fgeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2, -p.getZ(i) / 2); }
  const fl = new THREE.Mesh(fgeo, flMat); fl.receiveShadow = true; fl.name = 'floor'; root.add(fl);
  // entry + weapon-wall tiles (slate checker)
  const slate = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { x.fillStyle = (r + i) % 2 ? '#3d4257' : '#d9d2c3'; x.fillRect(i * 64, r * 64, 64, 64); }
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
    return new THREE.MeshStandardMaterial({ map: texFromCanvas(c), roughness: 0.3, envMapIntensity: 0.4 });
  })();
  for (const [x0, z0, x1, z1] of RESERVED_FLOOR) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + (x0 + x1) / 2) / 1.2, -(p.getZ(i) + (z0 + z1) / 2) / 1.2);
    const m = new THREE.Mesh(g, slate); m.position.set((x0 + x1) / 2, 0.003 + (z0 === 0.2 ? 0.0005 : 0), (z0 + z1) / 2); m.receiveShadow = true; root.add(m);
  }
  add(box(9.0, 0.012, 0.04), kit.brass(), -3.5, 0.006, 4.4);
  add(box(0.04, 0.012, 5.0), kit.brass(), -6.6, 0.006, 1.9);
  // doormat
  const matTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 144; const x = c.getContext('2d');
    x.fillStyle = '#c98b4a'; x.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 3000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(80,40,10,0.18)' : 'rgba(255,220,160,0.15)'; x.fillRect(Math.random() * 256, Math.random() * 144, 2, 3); }
    x.strokeStyle = '#5a3418'; x.lineWidth = 6; x.strokeRect(10, 10, 236, 124);
    x.fillStyle = '#5a3418'; x.font = '54px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center'; x.fillText('HOME', 128, 92);
    const t = texFromCanvas(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  })();
  add(rbox(1.5, 0.025, 0.85, 0.01), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.95 }), DOOR.x, 0.013, R.z1 - 0.6, root, 0, Math.PI, 0);

  // ---- walls (wallpaper planes inside, thick shells outside for shadows)
  const segs = (w) => {
    const f = wallFrame(w), out = [];
    const ops = OPENINGS[w];
    if (!ops.length) return [[f.u0, f.u1, 0, R.h]];
    const o = ops[0];
    out.push([f.u0, o.u0, 0, R.h], [o.u1, f.u1, 0, R.h]);
    if (o.y0 > 0) out.push([o.u0, o.u1, 0, o.y0]);
    out.push([o.u0, o.u1, o.y1, R.h]);
    return out;
  };
  for (let w = 0; w < 4; w++) {
    const f = wallFrame(w);
    for (const [u0, u1, y0, y1] of segs(w)) {
      walls[w].add(wallPlane(w, u0, u1, y0, y1, wpMat));
      const ext = new THREE.Mesh(box(+(u1 - u0 + (u0 === f.u0 || u1 === f.u1 ? R.t : 0)).toFixed(3), +(y1 - y0).toFixed(3), R.t), extMat);
      const uc = (u0 + u1) / 2 + (u0 === f.u0 ? -R.t / 2 : 0) + (u1 === f.u1 ? R.t / 2 : 0);
      ext.position.copy(f.at(uc, (y0 + y1) / 2, -R.t / 2 - 0.003)); ext.rotation.y = f.yaw;
      ext.castShadow = false; ext.receiveShadow = true;
      walls[w].add(ext);
      const sh = new THREE.Mesh(ext.geometry, shadowOnly); sh.position.copy(ext.position); sh.rotation.copy(ext.rotation); sh.castShadow = true; root.add(sh);
    }
    // baseboard + crown molding (skip the door gap)
    const runs = w === 2 ? [[f.u0, OPENINGS[2][0].u0], [OPENINGS[2][0].u1, f.u1]] : [[f.u0, f.u1]];
    for (const [a, b] of runs) {
      const bb = new THREE.Mesh(box(+(b - a).toFixed(3), 0.14, 0.035), trim); bb.position.copy(f.at((a + b) / 2, 0.07, 0.0175)); bb.rotation.y = f.yaw; bb.receiveShadow = true; walls[w].add(bb);
    }
    // wainscoting: painted panels with a rail and stiles under the wallpaper
    for (const [a, b] of runs) {
      const L = b - a, parts = [];
      parts.push({ geo: box(+L.toFixed(3), 0.72, 0.02), pos: [(a + b) / 2, 0.44, 0.01], color: 0xfbf4ea });
      parts.push({ geo: box(+L.toFixed(3), 0.05, 0.05), pos: [(a + b) / 2, 0.8, 0.025], color: 0xfffaf2 });
      const n = Math.max(1, Math.round(L / 0.9));
      for (let i = 0; i <= n; i++) parts.push({ geo: box(0.05, 0.62, 0.03), pos: [a + (i * L) / n, 0.45, 0.022], color: 0xf3e8d8 });
      const wg = mergeParts(parts);
      const wm = new THREE.Mesh(wg, kit.vcol(0.5));
      // merged in wall-local coords (x along u, z out of the wall): place via the wall frame
      wm.position.copy(f.at(0, 0, 0)); wm.rotation.y = f.yaw;
      if (w === 2 || w === 3) wm.scale.x = -1;
      wm.receiveShadow = true;
      walls[w].add(wm);
    }
    const cr = new THREE.Mesh(box(f.len, 0.12, 0.07), trim); cr.position.copy(f.at((f.u0 + f.u1) / 2, R.h - 0.06, 0.035)); cr.rotation.y = f.yaw; walls[w].add(cr);
    // cutaway stub for decorate mode
    const st = new THREE.Mesh(box(f.len + R.t * 2, 0.28, R.t), kit.std(0xfff3e6, 0.7));
    st.position.copy(f.at((f.u0 + f.u1) / 2, 0.14, -R.t / 2)); st.rotation.y = f.yaw; st.visible = false; st.receiveShadow = true;
    root.add(st); stubs.push(st);
  }
  // window reveals (sill, head, jambs) + frames + glass + curtains
  const glass = kit.glass(0.08, 0xeaf6ff);
  const windowFrame = (w, o, curtainCol) => {
    const f = wallFrame(w), g = walls[w];
    const W = o.u1 - o.u0, H = o.y1 - o.y0, uc = (o.u0 + o.u1) / 2, yc = (o.y0 + o.y1) / 2;
    const at = (du, y, d) => f.at(uc + du, y, d);
    const put = (geo, mat, du, y, d) => { const m = new THREE.Mesh(geo, mat); m.position.copy(at(du, y, d)); m.rotation.y = f.yaw; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    put(box(W + 0.36, 0.08, 0.42), trim, 0, o.y0 - 0.04, -0.02); // sill
    put(box(W, 0.06, R.t), trim, 0, o.y1 + 0.03, -R.t / 2); // head
    for (const s of [-1, 1]) put(box(0.08, H, R.t), trim, s * (W / 2 + 0.04), yc, -R.t / 2);
    for (const s of [-1, 1]) put(box(0.14, H + 0.3, 0.05), trim, s * (W / 2 + 0.07), yc + 0.1, 0.025);
    put(box(W + 0.42, 0.14, 0.05), trim, 0, o.y1 + 0.1, 0.025);
    const nm = Math.max(1, Math.round(W / 2));
    for (let i = 1; i <= nm; i++) put(box(0.05, H, 0.06), trim, -W / 2 + (i * W) / (nm + 1), yc, -R.t / 2);
    put(box(W, 0.05, 0.06), trim, 0, o.y0 + H * 0.66, -R.t / 2);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glass); gl.position.copy(at(0, yc, -R.t / 2)); gl.rotation.y = f.yaw; gl.renderOrder = 2; g.add(gl);
    // curtains with soft folds
    const rodY = o.y1 + 0.32;
    put(cyl(0.02, 0.02, W + 1.2, 8), kit.brass(), 0, rodY, 0.12).rotation.set(0, f.yaw, Math.PI / 2);
    for (const s of [-1, 1]) {
      const cw = 0.75, ch = rodY - 0.5;
      const geo = new THREE.PlaneGeometry(cw, ch, 18, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / cw * Math.PI * 6) * 0.04);
      geo.computeVertexNormals();
      const c = new THREE.Mesh(geo, kit.m('curtain' + curtainCol, () => new THREE.MeshPhysicalMaterial({ color: curtainCol, roughness: 0.85, sheen: 0.6, sheenColor: 0xffffff, side: THREE.DoubleSide, envMapIntensity: 0.3 })));
      c.position.copy(at(s * (W / 2 + 0.3), rodY - ch / 2, 0.1)); c.rotation.y = f.yaw; c.castShadow = true; c.receiveShadow = true;
      g.add(c);
      const tie = put(torus(0.11, 0.025, 6, 16), kit.fab(0xffc94d), s * (W / 2 + 0.3), 1.35, 0.12); tie.scale.set(1.6, 0.6, 1);
    }
  };
  windowFrame(0, OPENINGS[0][0], 0xffd3a8);
  windowFrame(1, OPENINGS[1][0], 0xbfe8d9);
  // a little planter on the big sill
  {
    const f = wallFrame(0), o = OPENINGS[0][0];
    for (let i = 0; i < 3; i++) {
      const p = f.at(o.u0 + 0.8 + i * 2.2, o.y0, 0.1);
      add(lathe('sillpot', [[0, 0], [0.08, 0], [0.1, 0.14], [0, 0.14]], 14), kit.ceramic([0xff8fb8, 0x8fe3c8, 0xffc94d][i]), p.x, p.y, p.z, walls[0]);
      for (let k = 0; k < 4; k++) add(sph(0.06, 8, 6), kit.leaf([0x4fb04a, 0x6cc551][k % 2]), p.x + Math.sin(k * 1.6) * 0.05, p.y + 0.18 + (k % 2) * 0.05, p.z + Math.cos(k * 1.6) * 0.04, walls[0]);
    }
  }

  // ---- front door (swings open when you leave)
  const doorG = walls[2];
  const dO = OPENINGS[2][0];
  const doorMat = kit.plas(0x2a9d8f, 0.4);
  const pivot = new THREE.Group(); pivot.position.set(dO.u0 + 0.04, 0, R.z1 - 0.07); doorG.add(pivot);
  add(rbox(DOOR.w - 0.08, DOOR.h - 0.04, 0.08, 0.02), doorMat, (DOOR.w - 0.08) / 2, DOOR.h / 2, 0, pivot);
  for (const y of [0.55, 1.3]) add(rbox(0.5, 0.55, 0.03, 0.015), kit.plas(0x34b3a4, 0.4), (DOOR.w - 0.08) / 2 - 0.3, y, -0.05, pivot);
  for (const y of [0.55, 1.3]) add(rbox(0.5, 0.55, 0.03, 0.015), kit.plas(0x34b3a4, 0.4), (DOOR.w - 0.08) / 2 + 0.3, y, -0.05, pivot);
  add(torus(0.2, 0.035, 8, 28), kit.brass(), (DOOR.w - 0.08) / 2, 2.0, -0.05, pivot);
  const port = add(new THREE.CircleGeometry(0.19, 28), kit.glow(0xffd9a0, 1.2), (DOOR.w - 0.08) / 2, 2.0, -0.045, pivot, 0, Math.PI);
  port.castShadow = false;
  add(sph(0.05, 12, 10), kit.brass(), DOOR.w - 0.25, 1.05, -0.08, pivot);
  add(rbox(0.32, 0.06, 0.02, 0.01), kit.brass(), (DOOR.w - 0.08) / 2, 1.0, -0.05, pivot);
  // bright outside, seen when the door swings open
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.45, 1.1), toneMapped: true }));
  outside.position.set(DOOR.x, DOOR.h / 2, R.z1 + 0.25); outside.rotation.y = Math.PI; doorG.add(outside);
  // frame
  for (const s of [-1, 1]) add(box(0.14, DOOR.h + 0.1, 0.06), trim, DOOR.x + s * (DOOR.w / 2 + 0.07), (DOOR.h + 0.1) / 2, R.z1 - 0.03, doorG);
  add(box(DOOR.w + 0.42, 0.16, 0.06), trim, DOOR.x, DOOR.h + 0.08, R.z1 - 0.03, doorG);
  for (const s of [-1, 1]) add(box(0.06, DOOR.h, R.t), trim, DOOR.x + s * (DOOR.w / 2 + 0.03), DOOR.h / 2, R.z1 + R.t / 2, doorG);
  // "home sweet home" stitch above the door
  const stitch = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.42), new THREE.MeshStandardMaterial({ map: signTexture('HOME SWEET HOME', { w: 512, h: 160, size: 54, bg: '#fff4dc', fg: '#e05a7a', accent: '#7fc8a9', font: '"Lilita One", "Arial Black", sans-serif' }), roughness: 0.8 }));
  stitch.position.set(DOOR.x, DOOR.h + 0.62, R.z1 - 0.02); stitch.rotation.y = Math.PI; doorG.add(stitch);
  let doorOpen = 0, doorTarget = 0;
  updaters.push((t, dt) => { doorOpen += (doorTarget - doorOpen) * (1 - Math.exp(-dt * 7)); pivot.rotation.y = -doorOpen * 1.4; });

  // ---- ceiling: plaster, wooden beams, pendant lamps
  const cgeo = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0); cgeo.rotateX(Math.PI / 2);
  const ceil = new THREE.Mesh(cgeo, kit.std(0xfff6ea, 0.95)); ceil.position.y = R.h; ceil.receiveShadow = true; ceiling.add(ceil);
  const roof = new THREE.Mesh(box(R.x1 - R.x0 + 1.2, 0.3, R.z1 - R.z0 + 1.2), shadowOnly); roof.position.y = R.h + 0.16; roof.castShadow = true; root.add(roof);
  const lights = [], pendants = [];
  const LIGHTS = [[-3.6, 3.7, 0xfff0d8, 9], [-3.6, -3.2, 0xffd9a8, 8], [1.5, 0.0, 0xffd6a0, 10], [5.6, 1.2, 0xffe2bc, 8]];
  const shadeCols = [0xfff1d6, 0xff8fb8, 0xffc94d, 0x8fe3c8];
  for (const bx of [-3.6, 1.5, 5.6]) add(box(0.24, 0.24, R.z1 - R.z0), kit.wood(0xf0d2ae), bx, R.h - 0.12, 0, ceiling);
  LIGHTS.forEach(([x, z, c, i], k) => {
    if (lowLights && (k === 1 || k === 3)) return;
    const drop = k === 0 ? 0.12 : 0.4;
    add(cyl(0.008, 0.008, drop, 6), kit.dark(), x, R.h - 0.26 - drop / 2, z, ceiling);
    const shade = add(lathe('pend' + k, [[0.03, 0.26], [0.12, 0.22], [0.3, 0.03], [0.32, 0]], 28), kit.m('pendShade' + k, () => new THREE.MeshStandardMaterial({ color: shadeCols[k], roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.4 })), x, R.h - 0.26 - drop - 0.26, z, ceiling);
    shade.castShadow = false;
    const bulb = add(sph(0.08, 12, 10), kit.m('pendBulb', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd8a8, emissiveIntensity: 5 })), x, R.h - 0.26 - drop - 0.22, z, ceiling);
    bulb.castShadow = false;
    pendants.push({ parts: [shade, bulb], at: new THREE.Vector3(x, R.h - 0.26 - drop - 0.15, z) });
    const l = new THREE.PointLight(c, lowLights ? i * 1.3 : i, 14, 1.25);
    l.position.set(x, R.h - 0.26 - drop - 0.9, z);
    root.add(l); lights.push(l);
  });

  const city = buildCity(root, kit);
  updaters.push(city.update);
  return {
    root, walls, stubs, ceiling, lights, wpMat, flMat,
    setWallpaper, setFloor,
    openDoor(on = true) { doorTarget = on ? 1 : 0; },
    setCutaway(cutWalls) {
      ceiling.visible = !cutWalls;
      for (let w = 0; w < 4; w++) { const cut = !!(cutWalls && cutWalls[w]); walls[w].visible = !cut; stubs[w].visible = cut; }
    },
    update(t, dt, cam) {
      for (const u of updaters) u(t, dt);
      // don't let a lamp shade swallow the camera
      if (cam) for (const p of pendants) { const v = cam.distanceTo(p.at) > 0.85; for (const m of p.parts) m.visible = v; }
    },
  };
}

// ---------------------------------------------------------------- the city outside the windows
function buildCity(parent, kit) {
  const g = new THREE.Group(); g.name = 'city'; parent.add(g);
  const R = rng(21);
  const gy = -0.35;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 40), new THREE.MeshStandardMaterial({ color: 0xb9b0a6, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = gy; ground.receiveShadow = true; g.add(ground);
  const tiles = getTex('plazaTiles');
  const walkMat = new THREE.MeshStandardMaterial({ map: tiles.map.clone(), roughness: 0.8 });
  walkMat.map.repeat.set(10, 1.2); walkMat.map.needsUpdate = true;
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), walkMat); walk.rotation.x = -Math.PI / 2; walk.position.set(0, gy + 0.01, -12); walk.receiveShadow = true; g.add(walk);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 9), new THREE.MeshStandardMaterial({ color: 0x4a4d5c, roughness: 0.9 })); road.rotation.x = -Math.PI / 2; road.position.set(0, gy + 0.005, -20.5); g.add(road);
  for (let i = -12; i < 12; i++) { const s = new THREE.Mesh(box(2, 0.01, 0.25), kit.std(0xfff4c2, 0.6)); s.position.set(i * 4, gy + 0.02, -20.5); g.add(s); }
  // side street east
  const walk2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), walkMat); walk2.rotation.x = -Math.PI / 2; walk2.position.set(16, gy + 0.01, 0); g.add(walk2);
  // buildings with lit windows
  const facades = [1, 4, 7].map((seed) => getTex('facade', { seed }));
  const tints = [0xffd6ea, 0xc9f2ea, 0xd6e4ff, 0xfff1c4, 0xe8c8ff, 0xffc8a8];
  const building = (x, z, w, h, d, i) => {
    const f = facades[i % facades.length];
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv, nrm = geo.attributes.normal;
    for (let k = 0; k < uv.count; k++) {
      const side = Math.abs(nrm.getX(k)) > 0.5 ? d : w;
      if (Math.abs(nrm.getY(k)) > 0.5) uv.setXY(k, 0.05, 0.05);
      else uv.setXY(k, uv.getX(k) * side / 6, uv.getY(k) * h / 6);
    }
    const mat = kit.m('bld' + i % 6 + (i % 3), () => {
      const mp = f.map.clone(), em = f.emissiveMap.clone();
      mp.needsUpdate = em.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: mp, emissiveMap: em, emissive: 0xffc98a, emissiveIntensity: 0.35, color: tints[i % tints.length], roughness: 0.75 });
    });
    const m = new THREE.Mesh(geo, mat); m.position.set(x, gy + h / 2, z); m.castShadow = false; g.add(m);
    const roofM = new THREE.Mesh(box(w + 0.4, 0.4, d + 0.4), kit.std(0x8a8296, 0.8)); roofM.position.set(x, gy + h + 0.2, z); g.add(roofM);
    return m;
  };
  let x = -34;
  for (let i = 0; x < 40; i++) { const w = 7 + R() * 7; building(x + w / 2, -32 - R() * 4, w, 9 + R() * 14, 14, i); x += w + 0.6; }
  for (let i = 0; i < 6; i++) building(30 + R() * 6, -26 + i * 10, 10, 8 + R() * 12, 9, i + 3);
  // far skyline ring
  const far = new THREE.Group();
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const bMats = [0xbfc9d9, 0xe6c9c0, 0xc0b7d9, 0xd9cfc0].map((c) => kit.std(c, 0.85, 0.05));
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, dd = 120 + R() * 80;
    const b = new THREE.Mesh(bGeo, bMats[i % 4]);
    b.scale.set(14 + R() * 18, 25 + Math.pow(R(), 2) * 80, 14 + R() * 18);
    b.position.set(Math.cos(a) * dd, gy, Math.sin(a) * dd); b.rotation.y = R() * 3;
    far.add(b);
  }
  g.add(far);
  // the Clash Tower on the skyline, pink beacon on top
  const tower = new THREE.Group(); tower.position.set(-38, gy, -95); g.add(tower);
  for (const [w, h, y, c] of [[22, 10, 0, 0xf0e4ff], [16, 12, 10, 0xe2d4ff], [11, 12, 22, 0xd4c4ff], [3.2, 7, 34, 0x9a96b2]]) { const m = new THREE.Mesh(box(w, h, w * 0.8), kit.std(c, 0.7)); m.position.y = y + h / 2; tower.add(m); }
  const beacon = new THREE.Mesh(sph(1.4, 16, 12), kit.glow(0xff2e88, 4)); beacon.position.y = 42; tower.add(beacon);
  const band = new THREE.Mesh(box(16.4, 1.4, 13), kit.glow(0xff2e88, 2)); band.position.y = 21; tower.add(band);
  // trees + street lamps along the sidewalk
  const trunk = kit.std(0x7a5236, 0.9), leaves = [0x6cc551, 0x4fb04a, 0x86d45f, 0xff9ec7].map((c) => kit.std(c, 0.8));
  for (const tx of [-9, -1.5, 7, 14]) {
    const t = new THREE.Mesh(cyl(0.18, 0.26, 3.2, 8), trunk); t.position.set(tx, gy + 1.6, -10.5); g.add(t);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + R() * 0.6, 1), leaves[(tx === 7 ? 3 : i % 3)]); l.position.set(tx + (R() - 0.5) * 1.4, gy + 3.6 + R() * 1.2, -10.5 + (R() - 0.5) * 1.4); g.add(l); }
  }
  for (const lx of [-5, 3, 11]) {
    const post = new THREE.Mesh(cyl(0.08, 0.12, 4.2, 8), kit.dark()); post.position.set(lx, gy + 2.1, -15.6); g.add(post);
    const head = new THREE.Mesh(sph(0.26, 12, 8), kit.glow(0xffe2a8, 3)); head.position.set(lx, gy + 4.3, -15.6); g.add(head);
  }
  // PRISM NEWS blimp drifting over the city
  const blimp = new THREE.Group(); g.add(blimp);
  const hull = new THREE.Mesh(sph(4, 24, 16), kit.plas(0xfff4f8, 0.35)); hull.scale.set(2.4, 1, 1); blimp.add(hull);
  const stripe = new THREE.Mesh(sph(4.03, 24, 4, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.1), kit.std(0xff2e88, 0.5)); stripe.scale.set(2.4, 1, 1); blimp.add(stripe);
  for (const s of [-1, 1]) { const fin = new THREE.Mesh(box(2.4, 0.2, 3), kit.std(0xff2e88, 0.5)); fin.position.set(-8.6, 0, s * 1.6); fin.rotation.x = s * 0.4; blimp.add(fin); }
  const gond = new THREE.Mesh(rbox(3, 1, 1.2, 0.3), kit.std(0x2b2f45, 0.5)); gond.position.y = -4.3; blimp.add(gond);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: signTexture('PRISM NEWS', { w: 512, h: 128, size: 76, accent: '#ffd21a' }), toneMapped: false, side: THREE.DoubleSide }));
  sign.position.set(0, 0, 4.05); blimp.add(sign);
  return {
    group: g,
    update(t) {
      const a = t * 0.025;
      blimp.position.set(Math.sin(a) * 60, 34 + Math.sin(t * 0.3) * 1.2, -90 + Math.cos(a) * 14);
      blimp.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
      beacon.material.emissiveIntensity = 3 + Math.sin(t * 3) * 1.5;
    },
  };
}

// ---------------------------------------------------------------- the weapon displays
// Each class has its own display by the front door. Weapons are placed by their
// bounding box, so new weapons of a known class just slot in.
const SCALE = 1.25;
const UP = new THREE.Vector3(0, 1, 0);
const DISPLAYS = [
  { types: ['brella'], kind: 'umbrella', wall: 2, u: -4.95 },
  { types: ['brush'], kind: 'bucket', wall: 2, u: -5.75 },
  { types: ['slosher'], kind: 'mat', wall: 2, u: -6.6 },
  { types: ['roller'], kind: 'lean', wall: 2, u: -7.45 },
  { types: ['shooter', 'blaster'], kind: 'pegboard', wall: 3, u: 3.95 },
  { types: ['charger'], kind: 'hooks', wall: 3, u: 1.5 },
  { types: ['stringer'], kind: 'peg', wall: 3, u: 0.05 },
  { types: ['splatling'], kind: 'stand', wall: 2, u: -2.1 },
  { types: ['splatana'], kind: 'swords', wall: 2, u: -0.8 },
  { types: ['dualies'], kind: 'shelf', wall: 2, u: 0.4 },
];

function basis(obj, z, upHint) {
  const zz = z.clone().normalize();
  const x = new THREE.Vector3().crossVectors(upHint, zz).normalize();
  const y = new THREE.Vector3().crossVectors(zz, x);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, zz));
}
// move `obj` (child of a group at the origin) so a point of its box lands on `target`
function anchor(obj, target, how) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const c = b.getCenter(new THREE.Vector3());
  const ref = new THREE.Vector3(how.x === 'min' ? b.min.x : how.x === 'max' ? b.max.x : c.x, how.y === 'min' ? b.min.y : how.y === 'max' ? b.max.y : c.y, how.z === 'min' ? b.min.z : how.z === 'max' ? b.max.z : c.z);
  obj.position.add(target.clone().sub(ref));
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}
function plaque(text, sub, owned) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
  x.fillStyle = owned ? '#e8c06a' : '#4a4658'; x.beginPath(); x.roundRect(0, 0, 256, 72, 14); x.fill();
  x.strokeStyle = owned ? '#9a7024' : '#2b2838'; x.lineWidth = 5; x.beginPath(); x.roundRect(5, 5, 246, 62, 10); x.stroke();
  x.fillStyle = owned ? '#3a2a10' : '#b9b3cc'; x.textAlign = 'center';
  x.font = '30px "Lilita One", "Arial Black", sans-serif'; x.fillText(text, 128, 36);
  x.font = '800 15px Nunito, sans-serif'; x.fillText(sub, 128, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.163), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: owned ? 0.4 : 0, envMapIntensity: 0.6 }));
}
function pegboardTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 352; const x = c.getContext('2d');
  x.fillStyle = '#d8b07a'; x.fillRect(0, 0, 512, 352);
  for (let i = 0; i < 500; i++) { x.fillStyle = 'rgba(120,80,30,0.08)'; x.fillRect(Math.random() * 512, Math.random() * 352, 1, 12 + Math.random() * 30); }
  x.fillStyle = 'rgba(60,35,10,0.55)';
  for (let y = 12; y < 352; y += 22) for (let i = 12; i < 512; i += 22) { x.beginPath(); x.arc(i, y, 3.2, 0, 7); x.fill(); }
  x.fillStyle = '#1b1530'; x.font = '30px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center';
  x.fillText('SHOOTERS · BLASTERS', 256, 342);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildArmory(scene, kit, { owned = [], ink = '#ff2e88' } = {}) {
  const root = new THREE.Group(); root.name = 'armory'; scene.add(root);
  const color = new THREE.Color(ink);
  const wallGroups = { 2: new THREE.Group(), 3: new THREE.Group() };
  root.add(wallGroups[2], wallGroups[3]);
  const slots = [], colliders = [];
  const P = (geo, mat, pos, parent = root, rot = null) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); if (rot) m.rotation.copy(rot); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const byType = {};
  for (const id of WEAPON_IDS) (byType[WEAPONS[id].type] ||= []).push(id);
  const known = new Set(DISPLAYS.flatMap((d) => d.types));
  const extra = WEAPON_IDS.filter((id) => !known.has(WEAPONS[id].type));
  const wood = kit.wood(0xc98d58), dark = kit.dark(), metal = kit.metal(0xc9ced8, 0.3);

  const makeModel = (id) => {
    const m = buildWeaponModel(id, color, WEAPONS[id].type);
    m.scale.setScalar(SCALE);
    const can = m.getObjectByName('canopy'); if (can) can.scale.set(0.3, 0.3, 1);
    const ar = m.getObjectByName('arrow'); if (ar) ar.visible = false;
    const holder = new THREE.Group(); holder.add(m);
    return { m, holder };
  };
  const addSlot = (id, holder, model, box, front, wall, label) => {
    const own = owned.includes(id);
    root.add(holder);
    model.visible = own;
    const center = box.getCenter(new THREE.Vector3());
    const pl = plaque(own ? WEAPONS[id].name.toUpperCase() : '???', own ? WEAPONS[id].cls : `Blastworks · ◉ ${WEAPONS[id].price}`, own);
    const f = wallFrame(wall);
    pl.position.copy(label); pl.rotation.y = f.yaw;
    (wall === 3 || label.y > 1.6 ? wallGroups[wall] : root).add(pl);
    slots.push({ id, def: WEAPONS[id], model, holder, box: box.clone().expandByScalar(0.08), center, front, wall, owned: own, plaque: pl });
  };

  for (const D of DISPLAYS) {
    const f = wallFrame(D.wall), n = f.n, a = new THREE.Vector3().crossVectors(UP, n);
    const ids = D.types.flatMap((t) => byType[t] || []);
    const W = (u, y, d) => f.at(u, y, d);
    const front = W(D.u, 0, 1.0);
    if (D.kind === 'umbrella') {
      const c = W(D.u, 0, 0.26);
      // see-through wire stand so the furled canopy shows
      P(cyl(0.19, 0.2, 0.04, 24), kit.ceramic(0x3d6fb6), c.clone().setY(0.02));
      for (const y of [0.22, 0.46]) P(torus(0.17, 0.012, 6, 28), kit.brass(), c.clone().setY(y), root, new THREE.Euler(Math.PI / 2, 0, 0));
      for (let k = 0; k < 10; k++) { const ang = (k / 10) * Math.PI * 2; P(cyl(0.007, 0.007, 0.44, 5), kit.brass(), new THREE.Vector3(c.x + Math.cos(ang) * 0.17, 0.25, c.z + Math.sin(ang) * 0.17)); }
      colliders.push({ min: [c.x - 0.2, 0, c.z - 0.2], max: [c.x + 0.2, 0.45, c.z + 0.2] });
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, new THREE.Vector3(0, -1, 0).addScaledVector(a, 0.1 - i * 0.2).addScaledVector(n, 0.08), n);
        const can = m.getObjectByName('canopy'); if (can) can.scale.set(0.42, 0.42, 1);
        const bx = anchor(m, c.clone().setY(0.05).addScaledVector(a, i * 0.08), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, Math.max(1.25, bx.max.y + 0.2), 0.012));
      });
    } else if (D.kind === 'bucket') {
      const c = W(D.u, 0, 0.27);
      P(cyl(0.17, 0.15, 0.36, 24), metal, c.clone().setY(0.18));
      P(cyl(0.172, 0.172, 0.06, 24), kit.m('inkBand', () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1 })), c.clone().setY(0.33));
      for (let k = 0; k < 5; k++) { const ang = k * 1.3; P(cyl(0.018, 0.012, 0.08 + (k % 3) * 0.05, 8), kit.cache.get('inkBand'), new THREE.Vector3(c.x + Math.cos(ang) * 0.168, 0.28 - (k % 3) * 0.025, c.z + Math.sin(ang) * 0.168)); }
      P(torus(0.17, 0.008, 6, 20, Math.PI), metal, c.clone().setY(0.37), root, new THREE.Euler(0, f.yaw + 0.6, 0));
      colliders.push({ min: [c.x - 0.2, 0, c.z - 0.2], max: [c.x + 0.2, 0.4, c.z + 0.2] });
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, new THREE.Vector3(0, 1, 0).addScaledVector(a, 0.1 - i * 0.2).addScaledVector(n, -0.12), n);
        const bx = anchor(m, c.clone().setY(0.1).addScaledVector(a, i * 0.07), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, Math.max(1.3, bx.max.y + 0.15), 0.012));
      });
    } else if (D.kind === 'mat') {
      const c = W(D.u, 0, 0.42);
      P(cyl(0.34, 0.34, 0.02, 32), kit.std(0x2b2f45, 0.9), c.clone().setY(0.01));
      P(torus(0.3, 0.012, 6, 32), kit.cache.get('inkBand') || kit.std(ink, 0.3), c.clone().setY(0.021), root, new THREE.Euler(Math.PI / 2, 0, 0));
      colliders.push({ min: [c.x - 0.25, 0, c.z - 0.25], max: [c.x + 0.25, 0.4, c.z + 0.25] });
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, a.clone().applyAxisAngle(UP, 0.7), UP);
        const bx = anchor(m, c.clone().setY(0.021).addScaledVector(a, i * 0.45), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, 1.05, 0.012));
      });
    } else if (D.kind === 'lean') {
      const lean = 0.3;
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        const z = UP.clone().multiplyScalar(-Math.cos(lean)).addScaledVector(n, Math.sin(lean));
        const x = a.clone();
        const y = new THREE.Vector3().crossVectors(z, x);
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        // handle tip touches the wall, drum rests on the floor
        m.updateMatrixWorld(true);
        const b0 = new THREE.Box3().setFromObject(m);
        const tgt = W(D.u + i * 0.95, 0, 0.03);
        const back = toWall(D.wall, b0.min).d < toWall(D.wall, b0.max).d ? b0.min : b0.max;
        m.position.add(new THREE.Vector3(tgt.x - (b0.min.x + b0.max.x) / 2, -b0.min.y, 0));
        const bd = toWall(D.wall, back.clone().add(m.position)).d;
        m.position.addScaledVector(n, 0.03 - bd);
        m.updateMatrixWorld(true);
        const bx = new THREE.Box3().setFromObject(m);
        colliders.push({ min: [bx.min.x, 0, bx.min.z], max: [bx.max.x, 0.3, bx.max.z] });
        addSlot(id, holder, m, bx, W(D.u + i * 0.95, 0, 1.1), D.wall, W(D.u + i * 0.95, 1.55, 0.012));
      });
    } else if (D.kind === 'pegboard') {
      const BW = 2.3, BH = 1.5, yc = 1.65;
      const board = new THREE.Mesh(box(BW, BH, 0.04), new THREE.MeshStandardMaterial({ map: pegboardTex(), roughness: 0.75, envMapIntensity: 0.4 }));
      board.position.copy(W(D.u, yc, 0.03)); board.rotation.y = f.yaw; board.castShadow = true; board.receiveShadow = true; wallGroups[D.wall].add(board);
      for (const s of [-1, 1]) P(box(0.05, BH + 0.06, 0.06), wood, W(D.u + s * (BW / 2 + 0.02), yc, 0.04), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      for (const s of [-1, 1]) P(box(BW + 0.1, 0.05, 0.06), wood, W(D.u, yc + s * (BH / 2 + 0.02), 0.04), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      const spots = [[-0.55, 2.02], [0.55, 2.02], [-0.55, 1.36], [0.55, 1.36], [0, 1.7]];
      ids.forEach((id, i) => {
        const [du, y] = spots[i % spots.length];
        const { m, holder } = makeModel(id);
        basis(m, a.clone().negate(), UP);
        const bx = anchor(m, W(D.u + du, y, 0.2), { x: 'c', y: 'c', z: 'c' });
        for (const s of [-0.12, 0.12]) P(cyl(0.012, 0.012, 0.2, 6), metal, W(D.u + du + s, bx.min.y - 0.01, 0.1), wallGroups[D.wall], new THREE.Euler(Math.PI / 2, f.yaw, 0, 'YXZ'));
        addSlot(id, holder, m, bx, W(D.u + du * 0.6, 0, 1.15), D.wall, W(D.u + du, y - 0.35, 0.06));
        slots[slots.length - 1].plaque.scale.setScalar(0.82);
      });
    } else if (D.kind === 'hooks') {
      const y = 1.72;
      P(rbox(1.7, 0.34, 0.04, 0.015), wood, W(D.u, y + 0.08, 0.02), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      for (const s of [-0.42, 0.42]) {
        P(box(0.04, 0.04, 0.2), metal, W(D.u + s, y - 0.02, 0.12), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
        P(box(0.04, 0.09, 0.04), metal, W(D.u + s, y + 0.02, 0.21), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      }
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, a.clone().negate(), UP);
        const bx = anchor(m, W(D.u, y + i * 0.45, 0.17), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, y - 0.25, 0.04));
      });
    } else if (D.kind === 'peg') {
      const y = 2.2;
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, a.clone().negate(), UP);
        const bx = anchor(m, W(D.u + i * 0.7, y, 0.1), { x: 'c', y: 'max', z: 'c' });
        // the peg sits right at the top of the bow it holds
        const top = toWall(D.wall, bx.getCenter(new THREE.Vector3())).u;
        P(cyl(0.11, 0.11, 0.03, 20), wood, W(top, y + 0.06, 0.015), wallGroups[D.wall], new THREE.Euler(Math.PI / 2, f.yaw, 0, 'YXZ'));
        P(cyl(0.022, 0.018, 0.17, 10), wood, W(top, y + 0.02, 0.09), wallGroups[D.wall], new THREE.Euler(Math.PI / 2, f.yaw, 0, 'YXZ'));
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, bx.min.y - 0.2, 0.012));
      });
    } else if (D.kind === 'stand') {
      const c = W(D.u, 0, 0.5);
      for (const s of [-0.38, 0.38]) {
        for (const t of [-1, 1]) { const leg = P(cyl(0.02, 0.02, 0.86, 8), dark, c.clone().addScaledVector(a, s).setY(0.4)); leg.rotation.set(0, 0, 0); leg.quaternion.setFromAxisAngle(a, t * 0.32); }
        P(torus(0.08, 0.016, 6, 16, Math.PI), kit.std(0xff7a00, 0.4), c.clone().addScaledVector(a, s).setY(0.8), root, new THREE.Euler(0, f.yaw + Math.PI / 2, Math.PI));
      }
      P(cyl(0.015, 0.015, 0.76, 8), dark, c.clone().setY(0.25), root, new THREE.Euler(0, f.yaw, Math.PI / 2));
      colliders.push({ min: [Math.min(c.x - a.x * 0.5, c.x + a.x * 0.5) - 0.2, 0, Math.min(c.z - a.z * 0.5, c.z + a.z * 0.5) - 0.2], max: [Math.max(c.x - a.x * 0.5, c.x + a.x * 0.5) + 0.2, 0.8, Math.max(c.z - a.z * 0.5, c.z + a.z * 0.5) + 0.2] });
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, a.clone().applyAxisAngle(UP, -0.25).negate(), UP);
        const bx = anchor(m, c.clone().setY(0.78 + i * 0.4), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, 1.45, 0.012));
      });
    } else if (D.kind === 'swords') {
      const c = W(D.u, 0, 0.36);
      P(rbox(0.95, 0.07, 0.3, 0.02), kit.wood(0x6b4630), c.clone().setY(0.035), root, new THREE.Euler(0, f.yaw, 0));
      for (const s of [-0.3, 0.3]) {
        P(rbox(0.06, 0.62, 0.08, 0.02), kit.wood(0x6b4630), c.clone().addScaledVector(a, s).setY(0.38), root, new THREE.Euler(0, f.yaw, 0));
        P(rbox(0.07, 0.04, 0.16, 0.015), kit.std(0xc0392b, 0.5), c.clone().addScaledVector(a, s).setY(0.66), root, new THREE.Euler(0, f.yaw, 0));
      }
      colliders.push({ min: [Math.min(c.x - a.x * 0.5, c.x + a.x * 0.5) - 0.18, 0, Math.min(c.z - a.z * 0.5, c.z + a.z * 0.5) - 0.18], max: [Math.max(c.x - a.x * 0.5, c.x + a.x * 0.5) + 0.18, 0.7, Math.max(c.z - a.z * 0.5, c.z + a.z * 0.5) + 0.18] });
      ids.forEach((id, i) => {
        const { m, holder } = makeModel(id);
        basis(m, a.clone().negate(), UP);
        const bx = anchor(m, c.clone().setY(0.68 + i * 0.22), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, m, bx, front, D.wall, W(D.u, 1.35, 0.012));
      });
    } else if (D.kind === 'shelf') {
      const y = 1.2;
      P(rbox(0.9, 0.05, 0.28, 0.015), wood, W(D.u, y, 0.14), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      for (const s of [-0.32, 0.32]) P(box(0.03, 0.18, 0.2), metal, W(D.u + s, y - 0.11, 0.1), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      P(rbox(0.7, 0.55, 0.02, 0.02), kit.std(0x2b2f45, 0.6), W(D.u, y + 0.35, 0.01), wallGroups[D.wall], new THREE.Euler(0, f.yaw, 0));
      ids.forEach((id) => {
        // a pair, crossed
        const pair = new THREE.Group();
        const mk2 = [];
        for (const s of [1, -1]) {
          const w = buildWeaponModel(id, color, WEAPONS[id].type); w.scale.setScalar(SCALE * 1.15);
          basis(w, UP.clone().applyAxisAngle(n, s * 0.55), a);
          w.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(w), c2 = b.getCenter(new THREE.Vector3());
          w.position.sub(c2).addScaledVector(n, s > 0 ? 0.03 : -0.03);
          pair.add(w); mk2.push(w);
        }
        const holder = new THREE.Group(); holder.add(pair);
        const bx = anchor(pair, W(D.u, y + 0.03, 0.15), { x: 'c', y: 'min', z: 'c' });
        addSlot(id, holder, pair, bx, front, D.wall, W(D.u, y - 0.32, 0.012));
      });
    }
  }
  // anything we don't have a display for hangs on the pegboard's extra hooks
  extra.forEach((id, i) => {
    const f = wallFrame(3);
    const { m, holder } = makeModel(id);
    basis(m, f.a.clone(), UP);
    const bx = anchor(m, f.at(-0.3 - i * 0.8, 1.6, 0.2), { x: 'c', y: 'c', z: 'c' });
    addSlot(id, holder, m, bx, f.at(-0.3 - i * 0.8, 0, 1.0), 3, f.at(-0.3 - i * 0.8, 1.2, 0.012));
  });
  // wall-mounted parts follow the wall in decorate cutaway
  for (const s of slots) if (s.wall === 3 || s.box.min.y > 1.0) { s.holder.parent.remove(s.holder); wallGroups[s.wall].add(s.holder); }
  // "ARMORY" sign over the weapon wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: signTexture('MY GEAR', { w: 512, h: 112, size: 64, accent: ink }), toneMapped: false }));
  const f3 = wallFrame(3); sign.position.copy(f3.at(3.0, 3.05, 0.02)); sign.rotation.y = f3.yaw; wallGroups[3].add(sign);
  // LED strip under the crown on both armory walls
  const led = kit.glow(color.getHex(), 1.6);
  const s2 = new THREE.Mesh(box(9.0, 0.03, 0.03), led); s2.position.copy(wallFrame(2).at(-3.5, ROOM.h - 0.45, 0.09)); wallGroups[2].add(s2);
  const s3 = new THREE.Mesh(box(6.6, 0.03, 0.03), led); s3.position.copy(f3.at(2.7, ROOM.h - 0.45, 0.09)); s3.rotation.y = f3.yaw; wallGroups[3].add(s3);
  // highlight marker (bobbing arrow over the weapon you're looking at)
  const marker = new THREE.Group(); marker.visible = false; root.add(marker);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 16), kit.glow(color.getHex(), 2.2)); arrow.rotation.x = Math.PI; marker.add(arrow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 24), kit.glow(0xffffff, 2)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.14; marker.add(ring);
  return {
    root, slots, colliders, wallGroups,
    setHeld(id) { for (const s of slots) s.model.visible = s.owned && s.id !== id; },
    highlight(slot) { marker.visible = !!slot; if (slot) marker.userData.at = new THREE.Vector3(slot.center.x, slot.box.max.y + 0.22, slot.center.z); },
    update(t) {
      if (marker.visible && marker.userData.at) { marker.position.copy(marker.userData.at); marker.position.y += Math.sin(t * 5) * 0.05; marker.rotation.y = t * 2; }
    },
  };
}
