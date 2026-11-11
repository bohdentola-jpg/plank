// Dialogue portraits: each speaker's 3D head is rendered once into a small
// off-screen target and cached as a data URL.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Character } from './characters.js';

const cache = new Map();
const SIZE = 176;
let rt = null, scene = null, cam = null, canvas = null, lut = null;

function setup() {
  rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: true });
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0xb08a7a, 1.9));
  const d = new THREE.DirectionalLight(0xfff2dc, 2.0);
  d.position.set(-2, 3, 4);
  scene.add(d);
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
  }
}

/** Returns a PNG data URL of the character's head (transparent background). */
export function portrait(key, spec, expr = 'open') {
  const k = `${key}:${expr}`;
  if (cache.has(k)) return cache.get(k);
  if (!G.renderer) return '';
  if (!rt) setup();
  let url = '';
  try {
    const ch = new Character(spec);
    ch.setExpr(expr);
    ch.update(0.016, 0);
    ch.blob.visible = false;
    ch.root.rotation.y = 0.32;
    scene.add(ch.root);
    ch.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ch.head);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y) * 1.04;
    const dist = (span / 2) / Math.tan((cam.fov * Math.PI) / 360) + size.z * 0.5;
    cam.position.set(c.x + dist * 0.12, c.y + span * 0.05, c.z + dist);
    cam.lookAt(c.x, c.y - span * 0.02, c.z);
    const r = G.renderer;
    const prevRT = r.getRenderTarget();
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, cam);
    const px = new Uint8Array(SIZE * SIZE * 4);
    r.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
    r.setRenderTarget(prevRT);
    r.setClearColor(prevColor, prevAlpha);
    ch.dispose();
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const src = (SIZE - 1 - y) * SIZE * 4, dst = y * SIZE * 4;
      for (let x = 0; x < SIZE * 4; x += 4) {
        img.data[dst + x] = lut[px[src + x]];
        img.data[dst + x + 1] = lut[px[src + x + 1]];
        img.data[dst + x + 2] = lut[px[src + x + 2]];
        img.data[dst + x + 3] = px[src + x + 3];
      }
    }
    ctx.putImageData(img, 0, 0);
    url = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('portrait failed', key, e);
  }
  cache.set(k, url);
  return url;
}

export function clearPortraits(prefix) {
  for (const k of [...cache.keys()]) if (!prefix || k.startsWith(prefix)) cache.delete(k);
}
