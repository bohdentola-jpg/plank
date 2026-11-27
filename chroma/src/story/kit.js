// Story-mode building kit: outline materials, primitive parts, text sprites.
// Kept independent from actors/character.js on purpose (that file is in flux).
import * as THREE from 'three';

function outlineMat(width, color = 0x1b1530) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => 'story-outline' + width.toFixed(4);
  return m;
}
// shared (never disposed per mode; programs stay cached)
export const OUTLINE_S = outlineMat(0.016);
export const OUTLINE_M = outlineMat(0.03);
export const OUTLINE_L = outlineMat(0.06);
const SHARED = new Set([OUTLINE_S, OUTLINE_M, OUTLINE_L]);
export const isShared = (m) => SHARED.has(m);

export const std = (c, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, ...extra });
export const gooMat = (c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, ...extra });
// unlit colour above 1.0 feeds the bloom pass
export const glowMat = (c, k = 2.2, extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), ...extra });

// Add a mesh (optionally outlined) to a parent.
export function part(parent, geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale != null) { if (Array.isArray(o.scale)) m.scale.set(...o.scale); else m.scale.setScalar(o.scale); }
  m.castShadow = o.shadow !== false;
  m.receiveShadow = !!o.receive;
  if (o.outline) {
    const ol = new THREE.Mesh(geo, o.outline === true ? OUTLINE_M : o.outline);
    ol.castShadow = false;
    ol.raycast = () => {};
    m.add(ol);
  }
  parent.add(m);
  return m;
}

// Cylinder between two points (pipes, girders, chains).
export function rod(parent, a, b, r, mat, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const geo = new THREE.CylinderGeometry(r, r, len, o.seg || 12, 1, !!o.open);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = o.shadow !== false;
  parent.add(m);
  return m;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const HFONT = '"Lilita One", "Arial Black", Impact, sans-serif';
export const BFONT = 'Nunito, "Segoe UI", system-ui, sans-serif';

// Billboard name tag. Returns a Sprite (dispose its material.map + material).
export function textSprite(text, o = {}) {
  const h = o.h || 96, size = o.size || 58;
  const pad = 26;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `${size}px ${HFONT}`;
  const w = Math.min(1024, Math.ceil(meas.measureText(text).width + pad * 2));
  const tex = canvasTexture(w, h, (ctx) => {
    if (o.bg !== null) {
      ctx.fillStyle = o.bg || 'rgba(27,21,48,0.86)';
      ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, (h - 8) / 2); ctx.fill();
    }
    ctx.font = `${size}px ${HFONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.stroke) { ctx.lineWidth = size * 0.16; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(text, w / 2, h / 2 + 3); }
    ctx.fillStyle = o.color || '#ffffff';
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest !== false, fog: false });
  const s = new THREE.Sprite(mat);
  const sc = o.scale || 0.6;
  s.scale.set((w / h) * sc, sc, 1);
  s.renderOrder = 5;
  return s;
}

export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
export const posOf = (v) => ({ x: v.x, y: v.y, z: v.z });

// Dispose every geometry/material/texture under a root (skips shared outline mats).
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) {
      if (isShared(m)) continue;
      if (m.map && m.map.isCanvasTexture) m.map.dispose();
      m.dispose?.();
    }
  });
  root.parent?.remove(root);
}
