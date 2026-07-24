// Shared geometry/material helpers for the melee stages and view. Keeps stage
// files short and enforces the N64 rules in one place: flat shading, nearest
// filtering, low segment counts.
import * as THREE from 'three';
import { mkCanvas, shade } from './paint.js';

export { shade };

const matCache = new Map();

/** A flat-shaded material. Cached by config, so stages can spam it. */
export function mat(color, { shin = 0, flat = true, side = null, opacity = 1, basic = false } = {}) {
  const key = `${color}|${shin}|${flat}|${side}|${opacity}|${basic}`;
  if (!matCache.has(key)) {
    const opts = { color, transparent: opacity < 1, opacity };
    if (side) opts.side = side;
    const m = basic
      ? new THREE.MeshBasicMaterial(opts)
      : new THREE.MeshPhongMaterial({ ...opts, flatShading: flat, shininess: shin, specular: shin ? '#8f8f8f' : '#0d0d0d' });
    matCache.set(key, m);
  }
  return matCache.get(key);
}

export const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
export const cyl = (rt, rb, h, m, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1), m);
export const sph = (r, m, seg = 8, rings = 6) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, rings), m);
export const cone = (r, h, m, seg = 6) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
export const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);

export function put(mesh, x, y, z = 0, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx * Math.PI / 180, ry * Math.PI / 180, rz * Math.PI / 180);
  return mesh;
}

/** A tiny nearest-filtered canvas texture — the only kind this game uses. */
export function pixTex(size, draw, { repeat = null } = {}) {
  const cv = mkCanvas(size, size);
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** A 64x64 tiling texture material (bricks, turf, panels, ice). */
export function tileMat(size, draw, repeat, { basic = false, shin = 0 } = {}) {
  const t = pixTex(size, draw, { repeat });
  return basic
    ? new THREE.MeshBasicMaterial({ map: t })
    : new THREE.MeshPhongMaterial({ map: t, flatShading: true, shininess: shin, specular: '#0d0d0d' });
}

/** Wrap an existing canvas (an emblem, a poster) in a nearest-filtered material. */
export function canvasMat(canvas, { basic = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return basic
    ? new THREE.MeshBasicMaterial({ map: t })
    : new THREE.MeshPhongMaterial({ map: t, flatShading: true });
}

/** A banded sky dome — cheap, and the bands read as 64-era gradients. */
export function skyDome(colors, radius = 90) {
  const g = new THREE.Group();
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const y0 = -0.35 + (i / n) * 1.35;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, (1.35 / n) * radius * 0.5, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: colors[i], side: THREE.BackSide, fog: false }),
    );
    band.position.y = y0 * radius * 0.5;
    g.add(band);
  }
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 16),
    new THREE.MeshBasicMaterial({ color: colors[0], side: THREE.BackSide, fog: false }),
  );
  top.rotation.x = Math.PI / 2;
  top.position.y = radius * 0.5 * 1.0;
  g.add(top);
  return g;
}

/** Random-but-stable jitter so props don't all line up. */
export function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
