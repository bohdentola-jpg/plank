// "Chromeleon" character: an anthropomorphic chameleon kid built from
// primitives — turret eyes that swivel on their own, a curly tail, a glossy
// team-colored crest, skin that shifts toward its ink color, and a sleek
// lizard dive form for swimming through ink. Renders gear (hat / clothes /
// shoes) and every weapon model.
import * as THREE from 'three';
import { clamp, damp, rand } from '../util.js';
import { HAT, CLOTH, SHOE, migrateLook, randomLook, SKIN_TONES, EYE_COLORS, CRESTS, PATTERNS, PATTERN_COLORS, BOTTOMS } from './gear.js';

export { randomLook, SKIN_TONES, EYE_COLORS, CRESTS, PATTERNS, PATTERN_COLORS, BOTTOMS };

const G = {}; // shared geometries
function geo(key, make) { return G[key] || (G[key] = make()); }

export const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.BackSide });
OUTLINE_MAT.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.011;');
};
OUTLINE_MAT.customProgramCacheKey = () => 'outline';

function std(color, rough = 0.6, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}
function gooMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
  });
}
function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false });
}

let LOD_SINK = null; // collects outline / detail meshes of the character being built
function addMesh(parent, g, mat, opts = {}) {
  const m = new THREE.Mesh(g, mat);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = false;
  parent.add(m);
  if (opts.outline !== false) {
    const o = new THREE.Mesh(g, OUTLINE_MAT);
    o.castShadow = false;
    m.add(o);
    LOD_SINK?.outlines.push(o);
  }
  if (opts.detail || (opts.outline === false && opts.shadow === false)) LOD_SINK?.details.push(m);
  return m;
}

// Tube with a radius that tapers along the curve
function taperTube(curve, segs, radial, r0, r1) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  const frames = curve.computeFrenetFrames(segs, false);
  const p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  void frames;
  g.computeVertexNormals();
  return g;
}

function tailCurve(scale = 1) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    if (t < 0.35) {
      const k = t / 0.35;
      pts.push(new THREE.Vector3(0, -0.06 * k - 0.02 * k * k, -0.04 - 0.26 * k));
    } else {
      const k = (t - 0.35) / 0.65;
      const ang = k * Math.PI * 2.3;
      const rad = 0.11 * (1 - k * 0.72);
      // curl downward then up and in (spiral in the y/z plane)
      pts.push(new THREE.Vector3(0, -0.19 + Math.cos(ang) * rad, -0.31 - Math.sin(ang) * rad));
    }
  }
  return new THREE.CatmullRomCurve3(pts.map((v) => v.multiplyScalar(scale)));
}

// Skin pattern texture (cached per combination)
const PAT_CACHE = new Map();
function patternTexture(skin, pattern, pc) {
  const key = skin + pattern + pc;
  if (PAT_CACHE.has(key)) return PAT_CACHE.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = skin; x.fillRect(0, 0, 256, 128);
  // soft lighter belly band (bottom of sphere UVs)
  const gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0.0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.0)'); gr.addColorStop(1, 'rgba(255,255,255,0.28)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
  x.fillStyle = pc;
  x.globalAlpha = 0.55;
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (pattern === 'stripes') {
    for (let i = 0; i < 9; i++) {
      const cx = i * 28.4 + 6;
      x.beginPath();
      x.moveTo(cx, 0);
      for (let y = 0; y <= 128; y += 8) x.lineTo(cx + Math.sin(y * 0.09 + i) * 4, y);
      for (let y = 128; y >= 0; y -= 8) x.lineTo(cx + 9 + Math.sin(y * 0.09 + i + 1) * 4, y);
      x.fill();
    }
  } else if (pattern === 'spots') {
    for (let i = 0; i < 46; i++) { x.beginPath(); x.ellipse(r() * 256, r() * 128, 3 + r() * 7, 3 + r() * 6, r() * 3, 0, Math.PI * 2); x.fill(); }
  } else if (pattern === 'bands') {
    for (let i = 0; i < 5; i++) { x.fillRect(0, 10 + i * 24, 256, 8 + (i % 2) * 3); }
  }
  x.globalAlpha = 1;
  // fine scale speckle
  const img = x.getImageData(0, 0, 256, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const k = 0.94 + r() * 0.1;
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  PAT_CACHE.set(key, t);
  return t;
}

function torsoGeometry(style) {
  const profiles = {
    tee: [[0.0, 0.0], [0.15, 0.0], [0.16, 0.08], [0.165, 0.2], [0.175, 0.28], [0.15, 0.34], [0.08, 0.37], [0.0, 0.37]],
    tank: [[0.0, 0.0], [0.15, 0.0], [0.16, 0.08], [0.165, 0.2], [0.17, 0.28], [0.13, 0.35], [0.07, 0.37], [0.0, 0.37]],
    hoodie: [[0.0, -0.02], [0.165, -0.02], [0.17, 0.08], [0.175, 0.2], [0.185, 0.28], [0.16, 0.345], [0.09, 0.375], [0.0, 0.375]],
    jacket: [[0.0, -0.03], [0.17, -0.03], [0.172, 0.08], [0.178, 0.2], [0.188, 0.28], [0.162, 0.345], [0.09, 0.378], [0.0, 0.378]],
    varsity: [[0.0, -0.03], [0.17, -0.03], [0.175, 0.08], [0.18, 0.2], [0.19, 0.28], [0.165, 0.345], [0.09, 0.378], [0.0, 0.378]],
    raincoat: [[0.0, -0.22], [0.2, -0.22], [0.185, -0.05], [0.178, 0.1], [0.182, 0.22], [0.188, 0.29], [0.162, 0.35], [0.09, 0.38], [0.0, 0.38]],
    vest: [[0.0, -0.01], [0.168, -0.01], [0.172, 0.1], [0.178, 0.22], [0.172, 0.3], [0.13, 0.355], [0.07, 0.375], [0.0, 0.375]],
  };
  const prof = profiles[style] || profiles.tee;
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 24);
  g.scale(1, 1, 0.78);
  g.computeVertexNormals();
  return g;
}

function crestFinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.13, 0.08);
  s.quadraticCurveTo(0.08, 0.3, -0.12, 0.4);
  s.quadraticCurveTo(-0.2, 0.42, -0.2, 0.34);
  s.quadraticCurveTo(-0.22, 0.16, -0.21, 0.02);
  s.quadraticCurveTo(-0.05, 0.12, 0.13, 0.08);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 18 });
  g.translate(0, 0, -0.03);
  g.rotateY(-Math.PI / 2); // profile in the y/z plane (shape +x -> forward +z), thickness along x
  g.computeVertexNormals();
  return g;
}

function fanGeometry() {
  const s = new THREE.Shape();
  const n = 7;
  s.moveTo(-0.28, 0);
  for (let i = 0; i <= n; i++) {
    const a0 = Math.PI - (i / n) * Math.PI;
    const a1 = Math.PI - ((i + 0.5) / n) * Math.PI;
    if (i === 0) s.lineTo(Math.cos(a0) * 0.28, Math.sin(a0) * 0.28);
    if (i < n) s.quadraticCurveTo(Math.cos(a1) * 0.34, Math.sin(a1) * 0.34, Math.cos(a0 - Math.PI / n) * 0.28, Math.sin(a0 - Math.PI / n) * 0.28);
  }
  s.lineTo(0.28, 0);
  s.lineTo(-0.28, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -0.015);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ weapons
const W_MATS = {};
function wm(key, make) { if (!W_MATS[key]) { W_MATS[key] = make(); W_MATS[key].userData.shared = true; } return W_MATS[key]; }
const body = (c) => wm('b' + c, () => std(c, 0.42, 0.15));
const DARK = () => wm('dark', () => std(0x2b2e3b, 0.45, 0.45));
const ACCENT = () => wm('acc', () => std(0xffc93c, 0.4, 0.2));
const GLASS = () => wm('glass', glassMaterial);

function inkTank(g, ink, pos, len = 0.16, r = 0.045, rot = [Math.PI / 2, 0, 0]) {
  addMesh(g, geo(`tg${len}${r}`, () => new THREE.CapsuleGeometry(r, len, 6, 14)), GLASS(), { pos, rot, outline: false, shadow: false });
  addMesh(g, geo(`ti${len}${r}`, () => new THREE.CapsuleGeometry(r * 0.78, len * 0.85, 6, 12)), ink, { pos, rot, outline: false });
}

export function buildWeaponModel(id, teamColor, type) {
  const g = new THREE.Group();
  const ink = gooMaterial(teamColor);
  g.userData.inkMats = [ink];
  const muzzle = new THREE.Object3D();
  const t = type || id;
  const grip = () => addMesh(g, geo('grip', () => new THREE.BoxGeometry(0.05, 0.13, 0.055)), DARK(), { pos: [0, -0.05, -0.02], rot: [0.3, 0, 0] });
  if (id === 'spritzer' || id === 'spritzer_jr' || t === 'shooter') {
    const jr = id === 'spritzer_jr';
    const c = jr ? 0x8ce06a : 0xf4f1ea;
    addMesh(g, geo('sBody', () => new THREE.CapsuleGeometry(0.05, 0.22, 6, 14).rotateX(Math.PI / 2)), body(c), { pos: [0, 0.03, 0.1] });
    addMesh(g, geo('sBand', () => new THREE.CylinderGeometry(0.056, 0.056, 0.05, 16).rotateX(Math.PI / 2)), ACCENT(), { pos: [0, 0.03, 0.2], outline: false });
    addMesh(g, geo('sNoz', () => new THREE.CylinderGeometry(0.022, 0.03, 0.12, 12).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0.035, 0.33] });
    inkTank(g, ink, [0, 0.11, 0.07], jr ? 0.16 : 0.12, jr ? 0.05 : 0.042);
    grip();
    muzzle.position.set(0, 0.035, 0.4);
  } else if (id === 'twin') {
    addMesh(g, geo('dBody', () => new THREE.BoxGeometry(0.06, 0.08, 0.18)), body(0xff7a3c), { pos: [0, 0.03, 0.06] });
    addMesh(g, geo('dNoz', () => new THREE.CylinderGeometry(0.018, 0.024, 0.08, 10).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0.04, 0.18] });
    inkTank(g, ink, [0.045, 0.04, 0.04], 0.08, 0.026);
    grip();
    muzzle.position.set(0, 0.04, 0.23);
  } else if (id === 'roller' || id === 'brush') {
    const brush = id === 'brush';
    const L = brush ? 0.62 : 0.92;
    addMesh(g, geo('rh' + L, () => new THREE.CylinderGeometry(0.019, 0.019, L, 10).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0, L / 2] });
    addMesh(g, geo('rgrip', () => new THREE.CylinderGeometry(0.027, 0.027, 0.16, 10).rotateX(Math.PI / 2)), ACCENT(), { pos: [0, 0, 0.02] });
    if (brush) {
      addMesh(g, geo('bFerrule', () => new THREE.CylinderGeometry(0.06, 0.05, 0.1, 14).rotateX(Math.PI / 2)), body(0xd9dee8), { pos: [0, 0, L + 0.04] });
      const head = addMesh(g, geo('bHead', () => { const gg = new THREE.SphereGeometry(0.11, 16, 12); gg.scale(1.25, 0.55, 1.6); return gg; }), ink, { pos: [0, 0, L + 0.2] });
      head.name = 'drum';
      muzzle.position.set(0, 0, L + 0.32);
    } else {
      addMesh(g, geo('rframe', () => new THREE.BoxGeometry(0.74, 0.035, 0.05)), DARK(), { pos: [0, 0, L - 0.04] });
      addMesh(g, geo('rarm', () => new THREE.BoxGeometry(0.035, 0.035, 0.16)), DARK(), { pos: [0.36, 0, L + 0.03] });
      addMesh(g, geo('rarm', () => new THREE.BoxGeometry(0.035, 0.035, 0.16)), DARK(), { pos: [-0.36, 0, L + 0.03] });
      const drum = addMesh(g, geo('rdrum', () => new THREE.CylinderGeometry(0.13, 0.13, 0.7, 24).rotateZ(Math.PI / 2)), ink, { pos: [0, -0.02, L + 0.1] });
      drum.name = 'drum';
      for (const sx of [0.37, -0.37]) addMesh(g, geo('rcap', () => new THREE.CylinderGeometry(0.135, 0.135, 0.045, 24).rotateZ(Math.PI / 2)), body(0xf4f1ea), { pos: [sx, -0.02, L + 0.1] });
      inkTank(g, ink, [0, 0.06, L - 0.18], 0.1, 0.035);
      muzzle.position.set(0, 0, L + 0.12);
    }
  } else if (id === 'bucketeer') {
    addMesh(g, geo('bkt', () => new THREE.CylinderGeometry(0.14, 0.11, 0.22, 20, 1, true)), body(0x5bc0ff), { pos: [0, -0.18, 0.08] });
    addMesh(g, geo('bktBot', () => new THREE.CircleGeometry(0.11, 20).rotateX(Math.PI / 2)), body(0x5bc0ff), { pos: [0, -0.29, 0.08], outline: false });
    addMesh(g, geo('bktInk', () => new THREE.CircleGeometry(0.13, 20).rotateX(-Math.PI / 2)), ink, { pos: [0, -0.1, 0.08], outline: false });
    addMesh(g, geo('bktRim', () => new THREE.TorusGeometry(0.14, 0.012, 6, 24).rotateX(Math.PI / 2)), ACCENT(), { pos: [0, -0.07, 0.08], outline: false });
    addMesh(g, geo('bktHandle', () => new THREE.TorusGeometry(0.14, 0.01, 6, 20, Math.PI)), DARK(), { pos: [0, -0.07, 0.08], rot: [0, Math.PI / 2, 0], outline: false });
    muzzle.position.set(0, -0.05, 0.2);
  } else if (id === 'popper') {
    addMesh(g, geo('pBarrel', () => new THREE.CylinderGeometry(0.062, 0.062, 0.26, 18).rotateX(Math.PI / 2)), body(0x2a3242), { pos: [0, 0.04, 0.1] });
    addMesh(g, geo('pBell', () => new THREE.SphereGeometry(0.1, 18, 14)), body(0xffc93c), { pos: [0, 0.04, 0.27], scale: [1, 1, 0.8] });
    addMesh(g, geo('pMouth', () => new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0.04, 0.35], outline: false });
    inkTank(g, ink, [0, 0.14, 0.02], 0.1, 0.055, [0, 0, Math.PI / 2]);
    grip();
    muzzle.position.set(0, 0.04, 0.38);
  } else if (id === 'whirlpool') {
    const barrels = new THREE.Group();
    barrels.name = 'spinner';
    barrels.position.set(0, 0, 0.42);
    g.add(barrels);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addMesh(barrels, geo('wBar', () => new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8).rotateX(Math.PI / 2)), DARK(), { pos: [Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0], outline: false });
    }
    addMesh(barrels, geo('wRing', () => new THREE.TorusGeometry(0.06, 0.014, 6, 16)), ACCENT(), { pos: [0, 0, 0.14], outline: false });
    addMesh(g, geo('wDrum', () => new THREE.CylinderGeometry(0.1, 0.1, 0.24, 20).rotateX(Math.PI / 2)), body(0xff5d8f), { pos: [0, 0, 0.12] });
    inkTank(g, ink, [0, 0.12, 0.1], 0.16, 0.05);
    addMesh(g, geo('wHandle', () => new THREE.BoxGeometry(0.04, 0.04, 0.22)), DARK(), { pos: [0, 0.1, -0.02] });
    muzzle.position.set(0, 0, 0.62);
  } else if (id === 'bumbershoot') {
    addMesh(g, geo('uShaft', () => new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0, 0.28] });
    addMesh(g, geo('uHook', () => new THREE.TorusGeometry(0.05, 0.015, 6, 12, Math.PI)), ACCENT(), { pos: [0, -0.05, -0.07], rot: [0, Math.PI / 2, 0] });
    const canopy = new THREE.Group();
    canopy.name = 'canopy';
    canopy.position.set(0, 0, 0.56);
    g.add(canopy);
    const cg = geo('uCanopy', () => { const c = new THREE.ConeGeometry(0.55, 0.26, 8, 1, true); c.rotateX(Math.PI / 2); return c; });
    addMesh(canopy, cg, ink, { pos: [0, 0, 0], outline: true });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      addMesh(canopy, geo('uRib2', () => new THREE.BoxGeometry(0.61, 0.014, 0.014).rotateY(0.44)), wm('rib', () => std(0xffffff, 0.4)), { pos: [Math.cos(a) * 0.275, Math.sin(a) * 0.275, 0.005], rot: [0, 0, a], outline: false, shadow: false });
    }
    addMesh(canopy, geo('uTip', () => new THREE.SphereGeometry(0.03, 8, 6)), ACCENT(), { pos: [0, 0, 0.14], outline: false });
    muzzle.position.set(0, 0, 0.72);
  } else if (id === 'longshot') {
    addMesh(g, geo('lbody', () => new THREE.BoxGeometry(0.07, 0.1, 0.38)), body(0xf4f1ea), { pos: [0, 0.02, 0.06] });
    addMesh(g, geo('lbarrel', () => new THREE.CylinderGeometry(0.02, 0.026, 0.64, 12).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0.04, 0.55] });
    addMesh(g, geo('lscope', () => new THREE.CylinderGeometry(0.032, 0.032, 0.22, 14).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0.13, 0.12] });
    addMesh(g, geo('llens', () => new THREE.CircleGeometry(0.027, 14)), wm('lens', () => new THREE.MeshBasicMaterial({ color: 0x9fe7ff })), { pos: [0, 0.13, 0.232], outline: false });
    inkTank(g, ink, [0, -0.045, 0.12], 0.18, 0.038);
    addMesh(g, geo('lstock', () => new THREE.BoxGeometry(0.05, 0.12, 0.15)), ACCENT(), { pos: [0, -0.01, -0.17] });
    muzzle.position.set(0, 0.04, 0.88);
  } else if (id === 'arcbow') {
    addMesh(g, geo('bowLimb', () => {
      const R = 0.42, pts = [];
      for (let i = 0; i <= 20; i++) { const a = -0.9 + (i / 20) * 1.8; pts.push(new THREE.Vector3(0, R * Math.sin(a), R * Math.cos(a) - R + 0.05)); }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 6, false);
    }), body(0x3fd3b0), {});
    addMesh(g, geo('bowGrip', () => new THREE.CylinderGeometry(0.025, 0.025, 0.14, 10)), DARK(), { pos: [0, 0, 0] });
    const str = addMesh(g, geo('bowString', () => new THREE.CylinderGeometry(0.004, 0.004, 0.66, 4)), wm('str', () => new THREE.MeshBasicMaterial({ color: 0xffffff })), { pos: [0, 0, -0.11], outline: false, shadow: false });
    str.name = 'string';
    const arrow = addMesh(g, geo('arrow', () => new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0, 0.18], outline: false });
    arrow.name = 'arrow';
    addMesh(arrow, geo('arrowTip', () => new THREE.ConeGeometry(0.025, 0.08, 8).rotateX(Math.PI / 2)), ink, { pos: [0, 0, 0.32], outline: false });
    muzzle.position.set(0, 0, 0.45);
  } else if (id === 'inkblade') {
    addMesh(g, geo('kHilt', () => new THREE.CylinderGeometry(0.02, 0.022, 0.18, 10).rotateX(Math.PI / 2)), DARK(), { pos: [0, 0, 0.0] });
    addMesh(g, geo('kGuard', () => new THREE.BoxGeometry(0.16, 0.03, 0.04)), ACCENT(), { pos: [0, 0, 0.1] });
    addMesh(g, geo('kBlade', () => new THREE.BoxGeometry(0.025, 0.07, 0.62)), body(0xe8eef6), { pos: [0, 0, 0.43] });
    addMesh(g, geo('kEdge', () => new THREE.BoxGeometry(0.03, 0.025, 0.6)), ink, { pos: [0, 0.04, 0.43], outline: false });
    muzzle.position.set(0, 0, 0.74);
  }
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

export function buildBombModel(teamColor, kind = 'bomb') {
  const g = new THREE.Group();
  const ink = gooMaterial(teamColor);
  if (kind === 'sticky') {
    addMesh(g, geo('stk', () => new THREE.SphereGeometry(0.17, 18, 14)), ink, { scale: [1, 0.8, 1] });
    addMesh(g, geo('stkBand', () => new THREE.TorusGeometry(0.15, 0.025, 8, 20).rotateX(Math.PI / 2)), DARK(), {});
    addMesh(g, geo('stkLight', () => new THREE.SphereGeometry(0.04, 10, 8)), wm('stkL', () => std(0xff3b3b, 0.3, 0, { emissive: 0xff2020, emissiveIntensity: 2 })), { pos: [0, 0.14, 0], outline: false });
  } else if (kind === 'popbomb') {
    addMesh(g, geo('popb', () => new THREE.SphereGeometry(0.11, 14, 12)), ink, { scale: [1, 1.15, 1] });
    addMesh(g, geo('popbCap', () => new THREE.ConeGeometry(0.05, 0.08, 10)), body(0xf4f1ea), { pos: [0, 0.14, 0] });
  } else if (kind === 'skid') {
    addMesh(g, geo('skid', () => new THREE.CylinderGeometry(0.18, 0.2, 0.12, 18)), ink, {});
    addMesh(g, geo('skidTop', () => new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14)), body(0xf4f1ea), { pos: [0, 0.08, 0] });
  } else if (kind === 'sprinkler') {
    addMesh(g, geo('spBase', () => new THREE.CylinderGeometry(0.12, 0.14, 0.1, 14)), DARK(), {});
    const head = new THREE.Group(); head.name = 'head'; head.position.y = 0.1; g.add(head);
    addMesh(head, geo('spHead', () => new THREE.SphereGeometry(0.08, 12, 10)), ink, {});
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addMesh(head, geo('spArm', () => new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6).rotateZ(Math.PI / 2)), ACCENT(), { pos: [Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08], rot: [0, -a, 0], outline: false });
    }
  } else {
    addMesh(g, geo('bomb', () => new THREE.SphereGeometry(0.15, 20, 16)), ink, {});
    addMesh(g, geo('bombcap', () => new THREE.CylinderGeometry(0.06, 0.08, 0.07, 14)), std(0xe9e6df, 0.4, 0.3), { pos: [0, 0.15, 0] });
    addMesh(g, geo('bombnub', () => new THREE.SphereGeometry(0.035, 10, 8)), ACCENT(), { pos: [0, 0.2, 0], outline: false });
  }
  g.userData.inkMat = ink;
  return g;
}

// ------------------------------------------------------------------ gear builders
function buildHat(head, hatId, mats) {
  const h = HAT[hatId];
  const grp = new THREE.Group();
  grp.name = 'hat';
  head.add(grp);
  if (!h || h.style === 'none') return grp;
  const m1 = std(h.c1, 0.65), m2 = std(h.c2, 0.6);
  mats.gear.push(m1, m2);
  const top = 0.17;
  switch (h.style) {
    case 'cap': case 'capback': {
      const back = h.style === 'capback' ? Math.PI : 0;
      grp.rotation.y = back;
      addMesh(grp, geo('capDome', () => new THREE.SphereGeometry(0.205, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), m1, { pos: [0, top - 0.06, 0.0], scale: [1.02, 0.75, 1.08] });
      addMesh(grp, geo('capBill', () => { const c = new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20, 1, false, -Math.PI / 2, Math.PI); c.scale(1, 1, 1.0); return c; }), m2, { pos: [0, top - 0.06, 0.12], rot: [0.12, 0, 0] });
      addMesh(grp, geo('capButton', () => new THREE.SphereGeometry(0.022, 8, 6)), m2, { pos: [0, top + 0.095, 0], outline: false });
      break;
    }
    case 'beanie':
      addMesh(grp, geo('beanie', () => new THREE.SphereGeometry(0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), m1, { pos: [0, top - 0.07, -0.01], scale: [1.02, 0.95, 1.08] });
      addMesh(grp, geo('beanieCuff', () => new THREE.TorusGeometry(0.2, 0.035, 8, 24).rotateX(Math.PI / 2)), m2, { pos: [0, top - 0.06, -0.01], scale: [1.02, 1, 1.08], outline: false });
      addMesh(grp, geo('pom', () => new THREE.IcosahedronGeometry(0.06, 1)), m2, { pos: [0, top + 0.15, -0.01] });
      break;
    case 'bucket':
      addMesh(grp, geo('bucketTop', () => new THREE.CylinderGeometry(0.17, 0.2, 0.14, 20)), m1, { pos: [0, top + 0.02, 0] });
      addMesh(grp, geo('bucketBrim', () => new THREE.CylinderGeometry(0.3, 0.3, 0.015, 24)), m1, { pos: [0, top - 0.06, 0], rot: [0.08, 0, 0] });
      addMesh(grp, geo('bucketBand', () => new THREE.CylinderGeometry(0.202, 0.202, 0.035, 20, 1, true)), m2, { pos: [0, top - 0.035, 0], outline: false });
      break;
    case 'headphones':
      addMesh(grp, geo('hpBand', () => new THREE.TorusGeometry(0.215, 0.022, 8, 24, Math.PI)), m1, { pos: [0, top - 0.17, -0.06], rot: [0, 0, 0] });
      for (const s of [-1, 1]) addMesh(grp, geo('hpCup', () => new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16).rotateZ(Math.PI / 2)), m2, { pos: [0.215 * s, top - 0.17, -0.06] });
      break;
    case 'visor':
      addMesh(grp, geo('visorBand', () => new THREE.TorusGeometry(0.205, 0.025, 8, 24).rotateX(Math.PI / 2)), m1, { pos: [0, top - 0.1, 0], scale: [1.02, 1, 1.08] });
      addMesh(grp, geo('visorBill', () => new THREE.CylinderGeometry(0.17, 0.17, 0.018, 20, 1, false, -Math.PI / 2, Math.PI)), m2, { pos: [0, top - 0.1, 0.12], rot: [0.18, 0, 0] });
      break;
    case 'goggles':
      addMesh(grp, geo('gogStrap', () => new THREE.TorusGeometry(0.208, 0.02, 8, 24).rotateX(Math.PI / 2)), m1, { pos: [0, top - 0.04, 0], rot: [-0.35, 0, 0], scale: [1.02, 1, 1.08] });
      for (const s of [-1, 1]) {
        addMesh(grp, geo('gogFrame', () => new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16).rotateX(Math.PI / 2)), m1, { pos: [0.065 * s, top + 0.03, 0.16], rot: [-0.6, 0, 0] });
        addMesh(grp, geo('gogLens', () => new THREE.CircleGeometry(0.045, 16)), wm('gogL' + h.c2, () => new THREE.MeshPhysicalMaterial({ color: h.c2, roughness: 0.05, clearcoat: 1, emissive: new THREE.Color(h.c2).multiplyScalar(0.2) })), { pos: [0.065 * s, top + 0.045, 0.18], rot: [-0.6, 0, 0], outline: false });
      }
      break;
    case 'beret':
      addMesh(grp, geo('beret', () => { const c = new THREE.SphereGeometry(0.22, 20, 10); c.scale(1.1, 0.35, 1.1); return c; }), m1, { pos: [0.03, top + 0.0, -0.02], rot: [0, 0, -0.25] });
      addMesh(grp, geo('beretNub', () => new THREE.CylinderGeometry(0.01, 0.015, 0.04, 6)), m2, { pos: [0.02, top + 0.08, -0.02], outline: false });
      break;
    case 'bandana':
      addMesh(grp, geo('bandana', () => new THREE.TorusGeometry(0.205, 0.035, 8, 24).rotateX(Math.PI / 2)), m1, { pos: [0, top - 0.09, 0], scale: [1.02, 1, 1.1] });
      for (const s of [-1, 1]) addMesh(grp, geo('bandTail', () => new THREE.BoxGeometry(0.04, 0.12, 0.015)), m1, { pos: [0.03 * s, top - 0.15, -0.23], rot: [0.3, 0, 0.3 * s] });
      break;
    case 'party':
      addMesh(grp, geo('party', () => new THREE.ConeGeometry(0.1, 0.28, 16)), m1, { pos: [0.02, top + 0.12, 0.02], rot: [0, 0, -0.15] });
      addMesh(grp, geo('partyPom', () => new THREE.IcosahedronGeometry(0.035, 1)), m2, { pos: [0.04, top + 0.27, 0.02] });
      break;
  }
  return grp;
}

// ------------------------------------------------------------------ Chromeleon
export class Chromeleon {
  constructor(look, teamColor = '#ff2e88', weaponId = 'spritzer') {
    this.look = migrateLook(look);
    this.teamColor = new THREE.Color(teamColor);
    this.root = new THREE.Group();
    this.kid = new THREE.Group();
    this.root.add(this.kid);
    this.phase = 0;
    this.time = Math.random() * 10;
    this.blink = 2 + Math.random() * 3;
    this.gooT = 0;
    this.recoil = 0; this.recoilL = 0;
    this.flick = 0; this.flickKind = 'h';
    this.hurt = 0;
    this.emote = null;
    this.lean = 0;
    this.chroma = 0; // how far the skin has shifted toward the team color
    this.camoA = 1;
    this.eyeT = [0, 0]; this.eyeTarget = [[0, 0], [0, 0]];
    this.tongueT = 0;
    this.build();
    this.setWeapon(weaponId);
  }

  build() {
    this.lod = { outlines: [], details: [], level: 0 };
    LOD_SINK = this.lod;
    const L = this.look;
    const cloth = CLOTH[L.clothes] || CLOTH.tee_basic;
    const shoe = SHOE[L.shoes] || SHOE.kicks_white;
    const skinTex = patternTexture(L.skin, L.pattern, L.patternColor);
    this.mats = {
      skin: std(0xffffff, 0.55, 0, { map: skinTex }),
      skinHead: std(0xffffff, 0.5, 0, { map: patternTexture(L.skin, L.pattern === 'spots' ? 'spots' : 'plain', L.patternColor) }),
      top: std(cloth.c1, 0.75),
      accent: std(cloth.c2, 0.7),
      bottom: std(L.bottom, 0.8),
      shoes: std(shoe.c1, 0.5),
      sole: std(shoe.c2, 0.65),
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }),
      iris: new THREE.MeshStandardMaterial({ color: L.eyes, roughness: 0.2 }),
      pupil: new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.2 }),
      shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      dark: std(0x2b2140, 0.6),
      mouth: std(0x5a1f3a, 0.6),
      tongue: std(0xff6f9c, 0.35),
      goo: gooMaterial(this.teamColor),
      metal: std(0xd8dde6, 0.35, 0.6),
      gear: [],
    };
    this.skinBase = new THREE.Color(0xffffff);
    const M = this.mats;
    const hips = this.hips = new THREE.Group();
    hips.position.y = 0.6;
    this.kid.add(hips);
    addMesh(hips, geo('pelvis', () => new THREE.SphereGeometry(0.16, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(Math.PI)), M.bottom, { pos: [0, 0.05, 0], scale: [1, 0.9, 0.8] });
    // tail
    const tail = this.tail = new THREE.Group();
    tail.position.set(0, 0.02, -0.08);
    hips.add(tail);
    addMesh(tail, geo('tail', () => taperTube(tailCurve(1), 48, 10, 0.065, 0.016)), M.skin, {});
    // legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.085 * side, -0.02, 0);
      hips.add(leg);
      addMesh(leg, geo('thigh', () => new THREE.CapsuleGeometry(0.072, 0.16, 6, 12).translate(0, -0.12, 0)), M.bottom, {});
      const knee = new THREE.Group();
      knee.position.y = -0.26;
      leg.add(knee);
      addMesh(knee, geo('shin', () => new THREE.CapsuleGeometry(0.058, 0.17, 6, 12).translate(0, -0.12, 0)), M.skin, {});
      const foot = new THREE.Group();
      foot.position.y = -0.27;
      knee.add(foot);
      this.buildShoe(foot, shoe.style);
      this.legs.push({ leg, knee, foot });
    }
    // torso
    const spine = this.spine = new THREE.Group();
    spine.position.y = 0.06;
    hips.add(spine);
    const style = cloth.style;
    addMesh(spine, geo('torso-' + style, () => torsoGeometry(style)), M.top, {});
    if (style === 'hoodie' || style === 'raincoat') {
      addMesh(spine, geo('hood', () => new THREE.TorusGeometry(0.1, 0.045, 10, 20)), style === 'raincoat' ? M.top : M.accent, { pos: [0, 0.35, -0.07], rot: [Math.PI / 2 + 0.5, 0, 0], detail: true });
      if (style === 'hoodie') addMesh(spine, geo('pocket', () => new THREE.BoxGeometry(0.2, 0.08, 0.02)), M.top, { pos: [0, 0.1, 0.13], outline: false, shadow: false });
    }
    if (style === 'jacket' || style === 'varsity' || style === 'raincoat') {
      addMesh(spine, geo('collar', () => new THREE.TorusGeometry(0.085, 0.03, 8, 18)), M.accent, { pos: [0, 0.355, 0], rot: [Math.PI / 2, 0, 0], detail: true });
      addMesh(spine, geo('zip', () => new THREE.BoxGeometry(0.014, 0.3, 0.01)), style === 'varsity' ? M.accent : M.metal, { pos: [0, 0.17, 0.145], outline: false, shadow: false });
    }
    if (style === 'vest') {
      for (const s of [-1, 1]) addMesh(spine, geo('vestPocket', () => new THREE.BoxGeometry(0.07, 0.07, 0.025)), M.accent, { pos: [0.07 * s, 0.17, 0.135], outline: false, shadow: false, detail: true });
    }
    if (cloth.emblem && cloth.emblem !== 'none') {
      const em = { circle: () => new THREE.CircleGeometry(0.045, 18), star: () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? 0.022 : 0.05; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(s); }, stripe: () => new THREE.PlaneGeometry(0.3, 0.035), splat: () => new THREE.CircleGeometry(0.05, 9) }[cloth.emblem];
      if (em) addMesh(spine, geo('emb-' + cloth.emblem, em), M.accent, { pos: [cloth.emblem === 'stripe' ? 0 : 0.06, cloth.emblem === 'stripe' ? 0.22 : 0.25, 0.15], outline: false, shadow: false });
    }
    // paint can backpack
    const pack = this.pack = new THREE.Group();
    pack.position.set(0, 0.2, -0.17);
    spine.add(pack);
    addMesh(pack, geo('can', () => new THREE.CylinderGeometry(0.085, 0.085, 0.26, 18, 1, true)), M.metal, {});
    addMesh(pack, geo('canTop', () => new THREE.CylinderGeometry(0.088, 0.088, 0.03, 18)), M.dark, { pos: [0, 0.14, 0], detail: true });
    addMesh(pack, geo('canTop', () => new THREE.CylinderGeometry(0.088, 0.088, 0.03, 18)), M.dark, { pos: [0, -0.14, 0], detail: true });
    addMesh(pack, geo('nozzle', () => new THREE.CylinderGeometry(0.018, 0.025, 0.06, 10)), M.dark, { pos: [0, 0.18, 0], outline: false, shadow: false });
    this.inkLevel = addMesh(pack, geo('canInk', () => new THREE.CylinderGeometry(0.075, 0.075, 1, 18).translate(0, 0.5, 0)), M.goo, { pos: [0, -0.125, 0.012], outline: false });
    this.inkLevel.scale.y = 0.25;
    // jetpack (shown during the Jet Pack special)
    const jet = this.jet = new THREE.Group();
    jet.position.set(0, 0.2, -0.2);
    jet.visible = false;
    spine.add(jet);
    for (const s of [-1, 1]) {
      addMesh(jet, geo('jetCan', () => new THREE.CylinderGeometry(0.06, 0.07, 0.3, 14)), M.metal, { pos: [0.09 * s, 0, -0.03] });
      const fl = addMesh(jet, geo('jetFlame', () => new THREE.ConeGeometry(0.06, 0.3, 12).rotateX(Math.PI)), M.goo, { pos: [0.09 * s, -0.3, -0.03], outline: false, shadow: false });
      fl.name = 'flame';
    }
    // neck + head
    const neck = this.neck = new THREE.Group();
    neck.position.y = 0.37;
    spine.add(neck);
    addMesh(neck, geo('neck', () => new THREE.CylinderGeometry(0.055, 0.06, 0.08, 10)), M.skin, { pos: [0, 0.02, 0], outline: false });
    const head = this.head = new THREE.Group();
    head.position.y = 0.19;
    neck.add(head);
    addMesh(head, geo('cHead', () => new THREE.SphereGeometry(0.2, 32, 24)), M.skinHead, { scale: [0.98, 0.9, 1.1] });
    addMesh(head, geo('cSnout', () => new THREE.SphereGeometry(0.13, 24, 16)), M.skinHead, { pos: [0, -0.04, 0.16], scale: [0.64, 0.6, 1.2], rot: [-0.12, 0, 0] });
    addMesh(head, geo('cJaw', () => new THREE.SphereGeometry(0.12, 20, 12)), M.skinHead, { pos: [0, -0.1, 0.09], scale: [0.95, 0.55, 1.1], outline: false, detail: true });
    // smile
    // long chameleon smile running from the snout tip back along the jaw
    this.mouth = addMesh(head, geo('cMouth', () => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, a = -1 + t * 2; // -1..1 across the face
        const side = Math.abs(a);
        pts.push(new THREE.Vector3(a * 0.13, -0.085 + side * side * 0.035, 0.29 - side * 0.21));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0075, 5, false);
    }), M.mouth, { outline: false, shadow: false });
    // tongue (curled inside; shoots out for the tongue emote)
    this.tongue = addMesh(head, geo('tongue', () => new THREE.CapsuleGeometry(0.018, 1, 4, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5)), M.tongue, { pos: [0, -0.07, 0.2], outline: false, shadow: false });
    this.tongueTip = addMesh(this.tongue, geo('tongueTip', () => new THREE.SphereGeometry(0.04, 10, 8)), M.tongue, { pos: [0, 0, 1.0], outline: false, shadow: false });
    this.tongue.scale.set(1, 1, 0.001);
    this.tongue.visible = false;
    // turret eyes
    this.eyes = [];
    for (const side of [-1, 1]) {
      const mount = new THREE.Group();
      mount.position.set(0.135 * side, 0.06, 0.075);
      mount.rotation.y = 0.42 * side;
      head.add(mount);
      const turret = new THREE.Group();
      mount.add(turret);
      addMesh(turret, geo('turret', () => new THREE.SphereGeometry(0.098, 20, 16)), M.skinHead, {});
      addMesh(turret, geo('lidRing', () => new THREE.TorusGeometry(0.066, 0.016, 8, 22)), M.skinHead, { pos: [0, 0, 0.074], outline: false, detail: true });
      const ball = new THREE.Group();
      ball.position.z = 0.042;
      turret.add(ball);
      addMesh(ball, geo('sclera2', () => new THREE.SphereGeometry(0.068, 18, 14)), M.white, { outline: false });
      addMesh(ball, geo('iris2', () => new THREE.SphereGeometry(0.046, 16, 12)), M.iris, { pos: [0, 0, 0.045], scale: [1, 1, 0.45], outline: false, shadow: false });
      addMesh(ball, geo('pupil2', () => new THREE.SphereGeometry(0.026, 12, 10)), M.pupil, { pos: [0, 0, 0.062], scale: [1, 1, 0.4], outline: false, shadow: false });
      addMesh(ball, geo('shine2', () => new THREE.SphereGeometry(0.011, 8, 6)), M.shine, { pos: [0.016, 0.02, 0.07], outline: false, shadow: false });
      this.eyes.push({ mount, turret, ball, side });
    }
    this.buildCrest();
    this.hat = buildHat(head, L.hat, M);
    // arms
    this.arms = [];
    const sleeveless = style === 'vest' || style === 'tank';
    const sleeveMat = sleeveless ? M.skin : style === 'varsity' ? M.accent : M.top;
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.18 * side, 0.31, 0);
      spine.add(sh);
      addMesh(sh, geo('upperArm', () => new THREE.CapsuleGeometry(0.052, 0.12, 6, 10).translate(0, -0.09, 0)), sleeveMat, {});
      if (!sleeveless) addMesh(sh, geo('shoulderPad', () => new THREE.SphereGeometry(0.065, 12, 10)), M.top, { outline: false, shadow: false, detail: true });
      const elbow = new THREE.Group();
      elbow.position.y = -0.19;
      sh.add(elbow);
      addMesh(elbow, geo('forearm', () => new THREE.CapsuleGeometry(0.046, 0.11, 6, 10).translate(0, -0.085, 0)), M.skin, {});
      const hand = new THREE.Group();
      hand.position.y = -0.19;
      elbow.add(hand);
      addMesh(hand, geo('hand', () => new THREE.SphereGeometry(0.052, 12, 10)), M.skin, { scale: [0.9, 1, 1] });
      addMesh(hand, geo('thumb', () => new THREE.SphereGeometry(0.03, 10, 8)), M.skin, { pos: [-0.04 * side, 0.0, 0.035], outline: false, detail: true });
      this.arms.push({ sh, elbow, hand, side });
    }
    this.buildDive();
    LOD_SINK = null;
    this.allMats = null;
  }

  buildShoe(foot, style) {
    const M = this.mats;
    if (style === 'boot') {
      addMesh(foot, geo('bootShaft', () => new THREE.CylinderGeometry(0.068, 0.072, 0.14, 14)), M.shoes, { pos: [0, 0.02, 0] });
      addMesh(foot, geo('bootToe', () => new THREE.SphereGeometry(0.08, 16, 12)), M.shoes, { pos: [0, -0.03, 0.05], scale: [0.95, 0.7, 1.3] });
      addMesh(foot, geo('bootSole', () => new THREE.BoxGeometry(0.15, 0.05, 0.25)), M.sole, { pos: [0, -0.07, 0.035], outline: false, detail: true });
    } else if (style === 'hightop') {
      addMesh(foot, geo('htAnkle', () => new THREE.CylinderGeometry(0.066, 0.07, 0.1, 14)), M.shoes, { pos: [0, 0.0, -0.005] });
      addMesh(foot, geo('shoe', () => new THREE.SphereGeometry(0.08, 16, 12)), M.shoes, { pos: [0, -0.02, 0.035], scale: [0.95, 0.72, 1.45] });
      addMesh(foot, geo('sole', () => new THREE.BoxGeometry(0.15, 0.035, 0.24)), M.sole, { pos: [0, -0.065, 0.035], outline: false, detail: true });
      addMesh(foot, geo('htStripe', () => new THREE.TorusGeometry(0.068, 0.01, 6, 16).rotateX(Math.PI / 2)), M.sole, { pos: [0, 0.03, -0.005], outline: false, shadow: false, detail: true });
    } else if (style === 'slipon') {
      addMesh(foot, geo('slip', () => new THREE.SphereGeometry(0.078, 16, 12)), M.shoes, { pos: [0, -0.03, 0.035], scale: [0.95, 0.6, 1.45] });
      addMesh(foot, geo('slipSole', () => new THREE.BoxGeometry(0.15, 0.03, 0.24)), M.sole, { pos: [0, -0.068, 0.035], outline: false, detail: true });
    } else {
      addMesh(foot, geo('shoe', () => new THREE.SphereGeometry(0.08, 16, 12)), M.shoes, { pos: [0, -0.02, 0.035], scale: [0.95, 0.72, 1.45] });
      addMesh(foot, geo('sole', () => new THREE.BoxGeometry(0.15, 0.035, 0.24)), M.sole, { pos: [0, -0.065, 0.035], outline: false, detail: true });
    }
  }

  buildCrest() {
    if (this.crest) this.head.remove(this.crest);
    const prev = LOD_SINK;
    LOD_SINK = prev || this.lod;
    const c = this.crest = new THREE.Group();
    this.head.add(c);
    const M = this.mats;
    const kind = this.look.crest;
    const hatOn = HAT[this.look.hat] && HAT[this.look.hat].style !== 'none';
    // glossy cap over the top/back of the head
    addMesh(c, geo('crestCap', () => new THREE.SphereGeometry(0.212, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.42)), M.goo, { pos: [0, 0.0, -0.035], rot: [-0.5, 0, 0], scale: [1.02, 1.0, 1.06] });
    if (kind === 'crest') {
      addMesh(c, geo('crestFin', crestFinGeometry), M.goo, { pos: [0, -0.04, 0.0], scale: hatOn ? [1, 0.8, 0.9] : [1, 1, 1] });
    } else if (kind === 'fan') {
      for (const s of [-1, 1]) addMesh(c, geo('fan', fanGeometry), M.goo, { pos: [0.15 * s, -0.0, -0.06], rot: [0, s * 1.05, 0], scale: [0.8, 0.8, 1] });
    } else if (kind === 'horns') {
      addMesh(c, geo('hornN', () => new THREE.ConeGeometry(0.03, 0.15, 12)), M.goo, { pos: [0, 0.03, 0.25], rot: [1.25, 0, 0] });
      for (const s of [-1, 1]) addMesh(c, geo('hornB', () => new THREE.ConeGeometry(0.026, 0.13, 12)), M.goo, { pos: [0.075 * s, 0.13, 0.13], rot: [1.0, 0, -0.25 * s] });
      addMesh(c, geo('hornRidge', () => new THREE.ConeGeometry(0.06, 0.14, 4)), M.goo, { pos: [0, 0.19, -0.12], rot: [-0.9, Math.PI / 4, 0], scale: [0.6, 1, 1], detail: true });
    } else {
      addMesh(c, geo('dome', () => new THREE.SphereGeometry(0.225, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.55)), M.goo, { pos: [0, 0.01, -0.04], rot: [-0.35, 0, 0], scale: [1.02, 1.05, 1.25] });
      for (let i = -2; i <= 2; i++) {
        addMesh(c, geo('domeDrip', () => new THREE.CapsuleGeometry(0.022, 0.06, 4, 8)), M.goo, { pos: [i * 0.07, -0.1, -0.21 + Math.abs(i) * 0.03], outline: false, detail: true });
      }
    }
    LOD_SINK = prev;
  }

  buildDive() {
    const M = this.mats;
    this.goo = new THREE.Group();
    this.root.add(this.goo);
    const d = this.dive = new THREE.Group();
    this.goo.add(d);
    this.blob = addMesh(d, geo('diveBody', () => new THREE.SphereGeometry(0.3, 26, 18)), M.goo, { scale: [0.85, 0.5, 1.35] });
    addMesh(d, geo('diveHead', () => new THREE.SphereGeometry(0.2, 20, 16)), M.goo, { pos: [0, 0.04, 0.38], scale: [1, 0.78, 1.15] });
    addMesh(d, geo('diveFin', crestFinGeometry), M.goo, { pos: [0, -0.02, 0.32], scale: [0.7, 0.55, 0.7], outline: false });
    for (const s of [-1, 1]) {
      const e = addMesh(d, geo('diveEye', () => new THREE.SphereGeometry(0.075, 14, 12)), M.goo, { pos: [0.13 * s, 0.11, 0.42], outline: false });
      addMesh(e, geo('diveSclera', () => new THREE.SphereGeometry(0.05, 12, 10)), M.white, { pos: [0.02 * s, 0.02, 0.04], outline: false });
      addMesh(e, geo('divePupil', () => new THREE.SphereGeometry(0.022, 10, 8)), M.pupil, { pos: [0.03 * s, 0.03, 0.085], outline: false });
    }
    const t = this.diveTail = new THREE.Group();
    t.position.set(0, 0.0, -0.32);
    d.add(t);
    addMesh(t, geo('diveTail', () => taperTube(tailCurve(1.15), 40, 8, 0.09, 0.018)), M.goo, { pos: [0, 0.12, 0.08], outline: false });
    this.goo.visible = false;
  }

  setLook(look) {
    this.look = migrateLook(look);
    const pos = this.root.position.clone(), rot = this.root.rotation.y, w = this.weaponId;
    this.root.clear();
    this.kid = new THREE.Group();
    this.root.add(this.kid);
    this.build();
    this.weaponId = null;
    this.setWeapon(w);
    this.root.position.copy(pos);
    this.root.rotation.y = rot;
    this.allMats = null;
    this.casters = null;
  }

  setTeamColor(c) {
    this.teamColor.set(c);
    this.mats.goo.color.set(c);
    this.mats.goo.emissive.copy(this.mats.goo.color).multiplyScalar(0.12);
    for (const w of [this.weapon, this.weapon2]) if (w) for (const m of w.userData.inkMats) { m.color.set(c); m.emissive.copy(m.color).multiplyScalar(0.12); }
  }

  setWeapon(id, type) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    this.weaponType = type || this.weaponType;
    for (const w of [this.weapon, this.weapon2]) w?.parent?.remove(w);
    this.weapon = this.weapon2 = null;
    this.allMats = null;
    this.casters = null;
    if (!id) return;
    this.weapon = buildWeaponModel(id, this.teamColor, type);
    this.weapon.rotation.x = Math.PI / 2;
    this.weapon.position.set(0, -0.02, 0);
    (id === 'arcbow' ? this.arms[0] : this.arms[1]).hand.add(this.weapon);
    if (id === 'twin') {
      this.weapon2 = buildWeaponModel(id, this.teamColor, type);
      this.weapon2.rotation.x = Math.PI / 2;
      this.weapon2.position.set(0, -0.02, 0);
      this.arms[0].hand.add(this.weapon2);
    }
  }

  muzzleWorld(out, left = false) {
    const w = left && this.weapon2 ? this.weapon2 : this.weapon;
    if (!w) return this.root.getWorldPosition(out).setY(this.root.position.y + 1);
    w.userData.muzzle.updateWorldMatrix(true, false);
    return w.userData.muzzle.getWorldPosition(out);
  }

  setInk(f) { this.inkLevel.scale.y = clamp(f, 0.02, 1) * 0.25; }
  flash() { this.hurt = 1; }
  doTongue() { this.tongueT = 0.6; }

  // 0 = full detail, 1 = drop face details, 2 = also drop outlines
  setLOD(level) {
    if (level === this.lod.level) return;
    if (!this.casters) { this.casters = []; this.root.traverse((o) => { if (o.isMesh && o.castShadow) this.casters.push(o); }); }
    if ((level === 2) !== (this.lod.level === 2)) for (const c of this.casters) c.castShadow = level < 2;
    this.lod.level = level;
    for (const o of this.lod.outlines) o.visible = level < 1 && this.camoA > 0.9;
    for (const d of this.lod.details) d.visible = level < 1;
  }
  lodFor(camPos) {
    const d2 = this.root.position.distanceToSquared(camPos);
    this.setLOD(d2 > 30 * 30 ? 2 : d2 > 18 * 18 ? 1 : 0);
  }

  // Chroma Camo: fade the whole model (a = 1 visible .. ~0 invisible)
  setCamo(a) {
    if (Math.abs(a - this.camoA) < 0.01) return;
    const was = this.camoA < 0.999, now = a < 0.999;
    this.camoA = a;
    if (!this.allMats) {
      const set = new Set();
      this.root.traverse((o) => { if (o.material && o.material !== OUTLINE_MAT) set.add(o.material); });
      this.allMats = [...set];
    }
    for (const m of this.allMats) {
      if (was !== now) { m.transparent = now || m === W_MATS.glass; m.needsUpdate = true; }
      m.opacity = m === W_MATS.glass ? 0.32 * a : a;
      m.depthWrite = !now;
    }
    for (const o of this.lod.outlines) o.visible = !now && this.lod.level < 1;
  }

  // st: {speed, back, grounded, vy, pitch, aiming, firing, weapon, wtype, goo, submerged, climbing, rolling, charge, shield, dodge, jet, chroma}
  update(dt, st) {
    this.time += dt;
    const sf = clamp(st.speed / 6, 0, 1.6);
    const wtype = st.wtype || this.weaponType || 'shooter';
    // ---- skin shifts toward the ink color (chameleon!)
    const ck = st.chroma ?? 0.18;
    this.chroma += (ck - this.chroma) * damp(3, dt);
    this.mats.skin.color.copy(this.skinBase).lerp(this.teamColor, this.chroma);
    this.mats.skinHead.color.copy(this.mats.skin.color);
    // ---- dive form transition
    const gooTarget = st.goo ? 1 : 0;
    this.gooT += (gooTarget - this.gooT) * damp(st.goo ? 22 : 16, dt);
    if (Math.abs(this.gooT - gooTarget) < 0.01) this.gooT = gooTarget;
    const kS = clamp(1 - this.gooT * 1.6, 0, 1);
    this.kid.visible = kS > 0.01;
    this.kid.scale.setScalar(Math.max(kS, 0.001));
    this.goo.visible = this.gooT > 0.05;
    if (this.goo.visible) {
      const gS = clamp(this.gooT * 1.4 - 0.2, 0, 1);
      const wig = Math.sin(this.time * (8 + st.speed * 1.2)) * clamp(st.speed / 8, 0.1, 1);
      this.dive.scale.setScalar(gS);
      this.diveTail.rotation.y = wig * 0.5;
      this.dive.rotation.y = -wig * 0.12;
      if (st.climbing) {
        this.dive.rotation.set(-Math.PI / 2 + 0.1, 0, 0);
        this.dive.position.set(0, 0.45, -0.1);
      } else if (st.submerged) {
        this.dive.rotation.set(0, this.dive.rotation.y, 0);
        this.dive.position.set(0, -0.07 + Math.sin(this.time * 9) * 0.01, 0);
      } else {
        this.dive.rotation.set(st.grounded ? 0 : clamp(-st.vy * 0.05, -0.5, 0.5), this.dive.rotation.y, 0);
        this.dive.position.set(0, 0.13 * gS, 0);
      }
    }
    if (!this.kid.visible) return;

    // ---- eyes: independent turret swivel, converge forward when aiming
    this.blink -= dt;
    const closed = this.blink < 0.12;
    if (this.blink < 0) this.blink = 2 + Math.random() * 4;
    for (let i = 0; i < 2; i++) {
      const e = this.eyes[i];
      this.eyeT[i] -= dt;
      if (this.eyeT[i] <= 0) {
        this.eyeT[i] = 0.4 + Math.random() * 1.8;
        this.eyeTarget[i] = [rand(-0.6, 0.6), rand(-0.35, 0.35)];
      }
      let [ty, tp] = this.eyeTarget[i];
      if (st.aiming || st.firing || this.emote) { ty = -e.side * 0.5; tp = -(st.pitch || 0) * 0.5; } // look straight ahead
      e.turret.rotation.y += (ty - e.turret.rotation.y) * damp(14, dt);
      e.turret.rotation.x += (tp - e.turret.rotation.x) * damp(14, dt);
      e.ball.scale.y = closed ? 0.15 : 1;
    }

    // ---- tongue
    if (this.tongueT > 0) {
      this.tongueT -= dt;
      const k = Math.sin(clamp(1 - this.tongueT / 0.6, 0, 1) * Math.PI);
      this.tongue.visible = true;
      this.tongue.scale.set(1, 1, 0.001 + k * 0.7);
      this.tongueTip.scale.set(1, 1, 1 / Math.max(0.001 + k * 0.7, 0.05));
    } else this.tongue.visible = false;

    // ---- hurt flash
    if (this.hurt > 0) {
      this.hurt = Math.max(0, this.hurt - dt * 5);
      const k = this.hurt;
      this.mats.skin.emissive.setRGB(k, k, k);
      this.mats.skinHead.emissive.setRGB(k, k, k);
      this.mats.top.emissive.setRGB(k * 0.8, k * 0.8, k * 0.8);
    }

    // ---- jetpack visuals
    this.jet.visible = !!st.jet;
    if (st.jet) this.jet.children.forEach((c) => { if (c.name === 'flame') c.scale.y = 0.7 + Math.random() * 0.6; });

    // ---- locomotion
    const run = st.grounded && st.speed > 0.4;
    if (run) this.phase += dt * (5 + st.speed * 1.55) * (st.back ? -1 : 1);
    const ph = this.phase;
    const A = run ? clamp(0.25 + sf * 0.55, 0, 0.95) : 0;
    const legs = this.legs;
    const swing = Math.sin(ph);
    const tgt = (o, x, k = 18) => { o.rotation.x += (x - o.rotation.x) * damp(k, dt); };
    if (st.dodge > 0) {
      // dodge roll: tuck and spin
      this.kid.rotation.x = (1 - st.dodge) * Math.PI * 2;
      tgt(legs[0].leg, -1.3, 30); tgt(legs[1].leg, -1.3, 30); tgt(legs[0].knee, 1.8, 30); tgt(legs[1].knee, 1.8, 30);
    } else {
      this.kid.rotation.x = 0;
      if (!st.grounded || st.jet) {
        const up = st.vy > 0;
        tgt(legs[0].leg, st.jet ? 0.25 : up ? -0.7 : -0.3, 12); tgt(legs[0].knee, st.jet ? 0.4 : up ? 1.2 : 0.5, 12);
        tgt(legs[1].leg, st.jet ? 0.1 : up ? 0.2 : 0.1, 12); tgt(legs[1].knee, st.jet ? 0.3 : up ? 0.5 : 0.3, 12);
      } else {
        tgt(legs[0].leg, -swing * A, 30); tgt(legs[1].leg, swing * A, 30);
        tgt(legs[0].knee, run ? 0.15 + Math.max(0, Math.cos(ph)) * A * 1.4 : 0.05, 30);
        tgt(legs[1].knee, run ? 0.15 + Math.max(0, -Math.cos(ph)) * A * 1.4 : 0.05, 30);
      }
    }
    for (const l of legs) l.foot.rotation.x = -l.leg.rotation.x * 0.4 - l.knee.rotation.x * 0.5;
    const bob = run ? Math.abs(Math.cos(ph)) * 0.045 * sf : Math.sin(this.time * 2.2) * 0.006;
    this.hips.position.y = 0.6 + bob - (run ? 0.02 : 0);
    const leanTarget = run ? (st.back ? -0.1 : 0.12 * sf) : 0;
    this.lean += (leanTarget - this.lean) * damp(10, dt);
    this.spine.rotation.x = this.lean;
    this.spine.rotation.y = run ? Math.sin(ph) * 0.12 * sf : 0;
    this.spine.rotation.z = 0;
    this.hips.rotation.y = run ? -Math.sin(ph) * 0.1 * sf : 0;
    // tail sways with the stride and curls a little when idle
    this.tail.rotation.y = Math.sin(this.time * 1.7 + ph * 0.5) * 0.22 + (run ? Math.sin(ph) * 0.25 : 0);
    this.tail.rotation.x = Math.sin(this.time * 1.1) * 0.08 + (st.grounded ? 0 : -0.3);

    // ---- arms by weapon class
    const [aL, aR] = this.arms;
    const pitch = st.pitch || 0;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.recoilL = Math.max(0, this.recoilL - dt * 10);
    let emote = this.emote;
    if (emote && (run || st.aiming)) emote = null;
    this.neck.rotation.x += ((emote === 'sad' ? 0.4 : -clamp(pitch, -0.6, 0.6) * 0.35) - this.neck.rotation.x) * damp(12, dt);
    this.neck.rotation.z = 0;
    const W = this.weapon, W2 = this.weapon2;
    const point = (w, sh, el, extra = 0) => { if (w) w.rotation.x = -pitch - (sh.rotation.x + el.rotation.x) + extra; };
    if (this.flick > 0) this.flick = Math.max(0, this.flick - dt * (wtype === 'splatana' ? 4.5 : 3.2));
    const f = this.flick > 0 ? Math.sin((1 - this.flick) * Math.PI) : 0;
    const aiming = st.aiming || st.firing;
    if (emote) {
      this.applyEmote(emote, dt);
    } else if (wtype === 'roller' || wtype === 'brush') {
      const brush = wtype === 'brush';
      const down = st.rolling ? (brush ? -0.6 : -0.8) : -0.55;
      const sx = this.flickKind === 'v' ? down - f * 2.6 : down - f * (brush ? 1.2 : 2.0);
      for (const a of [aL, aR]) {
        tgt(a.sh, sx, 25);
        a.sh.rotation.z = a === aL ? 0.42 : -0.05;
        tgt(a.elbow, -0.05, 25);
      }
      aL.sh.rotation.y = -0.2; aR.sh.rotation.y = brush && f > 0 ? -f * 0.8 : 0;
      if (W) {
        W.rotation.x = Math.PI / 2;
        W.position.set(-0.05, -0.05, 0);
        const drum = W.getObjectByName('drum');
        if (drum && st.rolling && !brush) drum.rotation.x -= dt * st.speed * 8;
      }
    } else if (wtype === 'splatling') {
      tgt(aR.sh, -0.75, 30); aR.sh.rotation.z = 0.15; aR.sh.rotation.y = 0.3;
      tgt(aR.elbow, -0.9, 30);
      tgt(aL.sh, -0.95, 30); aL.sh.rotation.z = -0.35; aL.sh.rotation.y = -0.6;
      tgt(aL.elbow, -1.0, 30);
      point(W, aR.sh, aR.elbow);
      if (W) {
        W.position.set(-0.04, 0.02, -0.05);
        const spinner = W.getObjectByName('spinner');
        if (spinner) spinner.rotation.z += dt * (st.firing ? 40 : (st.charge || 0) * 30);
      }
    } else if (wtype === 'dualies') {
      const ax = -Math.PI / 2 - pitch * 0.9;
      tgt(aR.sh, ax + this.recoil * 0.12, 40); aR.sh.rotation.z = 0.05; aR.sh.rotation.y = 0.12;
      tgt(aL.sh, ax + this.recoilL * 0.12, 40); aL.sh.rotation.z = -0.05; aL.sh.rotation.y = -0.12;
      tgt(aR.elbow, -0.05, 40); tgt(aL.elbow, -0.05, 40);
      if (!aiming) { tgt(aR.sh, -0.45, 20); tgt(aL.sh, -0.45, 20); tgt(aR.elbow, -0.9, 20); tgt(aL.elbow, -0.9, 20); }
      point(W, aR.sh, aR.elbow, aiming ? 0 : 0.3);
      point(W2, aL.sh, aL.elbow, aiming ? 0 : 0.3);
    } else if (wtype === 'slosher') {
      // bucket hangs at the side; a fire swings it up and over
      tgt(aR.sh, 0.35 - f * 2.9, f > 0 ? 40 : 14); aR.sh.rotation.z = 0.15; aR.sh.rotation.y = 0;
      tgt(aR.elbow, -0.15, 20);
      tgt(aL.sh, run ? swing * A * 0.9 : 0, 20); aL.sh.rotation.z = -0.15; aL.sh.rotation.y = 0;
      tgt(aL.elbow, -0.3, 20);
      if (W) { W.rotation.x = 0.0; W.position.set(0, -0.06, 0.02); }
    } else if (wtype === 'brella') {
      const open = st.shield ? 1 : 0;
      const ax = -Math.PI / 2 - pitch * 0.9 + (open ? 0.2 : 0);
      tgt(aR.sh, aiming || open ? ax : -0.5, 30); aR.sh.rotation.z = 0.05; aR.sh.rotation.y = 0.1;
      tgt(aR.elbow, aiming || open ? -0.1 : -0.85, 30);
      tgt(aL.sh, aiming || open ? ax + 0.15 : 0, 30); aL.sh.rotation.z = -0.45; aL.sh.rotation.y = -0.5;
      tgt(aL.elbow, aiming || open ? -0.6 : -0.15, 30);
      point(W, aR.sh, aR.elbow, aiming || open ? 0 : 0.3);
      const can = W?.getObjectByName('canopy');
      if (can) { const s = 0.35 + open * 0.65 + (aiming && !open ? 0.15 : 0); can.scale.x += (s - can.scale.x) * damp(14, dt); can.scale.y = can.scale.x; }
    } else if (wtype === 'stringer') {
      // bow held up in the left hand, right hand draws back
      const ax = -Math.PI / 2 - pitch * 0.9;
      tgt(aL.sh, aiming ? ax : -0.4, 30); aL.sh.rotation.z = -0.05; aL.sh.rotation.y = -0.1;
      tgt(aL.elbow, aiming ? -0.05 : -0.6, 30);
      const c = st.charge || 0;
      tgt(aR.sh, aiming ? ax + 0.15 : -0.2, 30); aR.sh.rotation.z = 0.25 + c * 0.25; aR.sh.rotation.y = 0.35 + c * 0.5;
      tgt(aR.elbow, aiming ? -1.0 - c * 1.3 : -0.4, 30);
      point(W, aL.sh, aL.elbow, aiming ? 0 : 0.4);
      if (W) {
        const str = W.getObjectByName('string'), ar = W.getObjectByName('arrow');
        if (str) str.position.z = -0.11 - c * 0.18;
        if (ar) { ar.visible = c > 0.02; ar.position.z = 0.18 - c * 0.18; }
      }
    } else if (wtype === 'splatana') {
      // horizontal sweep (h) or overhead chop (v)
      const v = this.flickKind === 'v';
      const ready = aiming ? -1.25 : -0.6;
      tgt(aR.sh, v ? ready - 1.4 + f * 2.6 : ready, f > 0 ? 45 : 20);
      aR.sh.rotation.z = 0.1;
      aR.sh.rotation.y = v ? 0 : 0.9 - f * 2.2;
      tgt(aR.elbow, -0.25, 25);
      tgt(aL.sh, run ? swing * A * 0.8 : -0.1, 20); aL.sh.rotation.z = -0.2; aL.sh.rotation.y = 0;
      tgt(aL.elbow, -0.4, 20);
      if (W) { W.rotation.x = Math.PI / 2 + (aiming ? 0.2 : 0.7); W.position.set(0, -0.02, 0); }
    } else if (aiming) {
      const ax = -Math.PI / 2 - pitch * 0.9 + this.recoil * 0.12;
      tgt(aR.sh, ax, 40); aR.sh.rotation.z = 0.05; aR.sh.rotation.y = 0.12;
      tgt(aR.elbow, -0.08, 40);
      tgt(aL.sh, ax + 0.1, 40); aL.sh.rotation.z = -0.55; aL.sh.rotation.y = -0.55;
      tgt(aL.elbow, -0.75, 40);
      if (W) { W.rotation.x = Math.PI / 2; W.position.set(0, -0.02, -this.recoil * 0.03); }
    } else {
      const sw = run ? swing * A * 0.9 : Math.sin(this.time * 2.2) * 0.03;
      tgt(aL.sh, sw - 0.05, 20); aL.sh.rotation.z = -0.12; aL.sh.rotation.y = 0;
      tgt(aL.elbow, run ? -0.5 - Math.max(0, sw) * 0.6 : -0.15, 20);
      tgt(aR.sh, run ? -0.55 - sw * 0.25 : -0.5, 20); aR.sh.rotation.z = 0.1; aR.sh.rotation.y = 0.1;
      tgt(aR.elbow, -0.85, 20);
      if (W) { W.rotation.x = Math.PI / 2 + 0.25; W.position.set(0, -0.02, 0); }
    }
    if (!st.grounded && !emote && !st.jet && wtype !== 'dualies' && wtype !== 'stringer' && wtype !== 'splatling') {
      tgt(aL.sh, -2.2, 10);
      aL.sh.rotation.z = -0.5;
    }
  }

  applyEmote(name, dt) {
    const [aL, aR] = this.arms;
    const t = this.time;
    const tgt = (o, x, k = 14) => { o.rotation.x += (x - o.rotation.x) * damp(k, dt); };
    if (name === 'wave') {
      tgt(aR.sh, -2.7); aR.sh.rotation.z = 0.4 + Math.sin(t * 9) * 0.35; tgt(aR.elbow, -0.3);
      tgt(aL.sh, 0); aL.sh.rotation.z = -0.12; tgt(aL.elbow, -0.1);
    } else if (name === 'cheer') {
      const b = Math.abs(Math.sin(t * 7));
      this.hips.position.y = 0.6 + b * 0.12;
      for (const a of [aL, aR]) { tgt(a.sh, -2.9); a.sh.rotation.z = a.side * (0.5 + b * 0.2); tgt(a.elbow, -0.2); }
    } else if (name === 'dance') {
      const b = Math.sin(t * 8);
      this.hips.position.y = 0.6 + Math.abs(b) * 0.06;
      this.spine.rotation.z = b * 0.15;
      this.hips.rotation.y = b * 0.3;
      this.tail.rotation.y = b * 0.6;
      tgt(aL.sh, b > 0 ? -2.6 : -0.6, 18); aL.sh.rotation.z = -0.4;
      tgt(aR.sh, b > 0 ? -0.6 : -2.6, 18); aR.sh.rotation.z = 0.4;
      tgt(aL.elbow, -0.6); tgt(aR.elbow, -0.6);
    } else if (name === 'sad') {
      this.spine.rotation.x = 0.25;
      for (const a of [aL, aR]) { tgt(a.sh, 0.15); a.sh.rotation.z = a.side * -0.05; tgt(a.elbow, -0.05); }
    } else if (name === 'think') {
      tgt(aR.sh, -1.4); aR.sh.rotation.z = -0.5; tgt(aR.elbow, -2.0);
      tgt(aL.sh, -0.4); aL.sh.rotation.z = 0.6; tgt(aL.elbow, -1.6);
      this.neck.rotation.z = Math.sin(t * 1.5) * 0.12;
    } else if (name === 'sit') {
      this.hips.position.y = 0.42;
      for (const l of this.legs) { tgt(l.leg, -1.5); tgt(l.knee, 1.5); }
      tgt(aL.sh, -0.3); tgt(aR.sh, -0.3);
    } else if (name === 'tongue') {
      if (this.tongueT <= 0 && Math.sin(t * 2) > 0.95) this.doTongue();
      tgt(aL.sh, -0.2); tgt(aR.sh, -0.2);
    } else if (name === 'talk') {
      tgt(aR.sh, -0.9 + Math.sin(t * 4) * 0.3); aR.sh.rotation.z = 0.3; tgt(aR.elbow, -1.2);
      tgt(aL.sh, -0.2); aL.sh.rotation.z = -0.15; tgt(aL.elbow, -0.3);
      this.mouth.scale.y = 1 + Math.abs(Math.sin(t * 14)) * 1.5;
    } else if (name === 'pose') {
      tgt(aR.sh, -2.5); aR.sh.rotation.z = 0.9; tgt(aR.elbow, -0.4);
      tgt(aL.sh, 0.2); aL.sh.rotation.z = -0.6; tgt(aL.elbow, -1.6);
      this.spine.rotation.z = -0.12;
    }
    if (name !== 'talk') this.mouth.scale.y = 1;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.material && o.material !== OUTLINE_MAT) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (!Object.values(W_MATS).includes(m)) m.dispose?.();
      }
    });
    this.root.parent?.remove(this.root);
  }
}

// Backwards-compatible name used across the codebase
export { Chromeleon as Dripkin };
export const HAIR_STYLES = CRESTS;
export const OUTFIT_COLORS = ['#2b2f45', '#f4f1ea', '#ff5d5d', '#ffb02e', '#2ec4b6', '#5b6cff', '#9b5de5', '#3d405b', '#66bb6a', '#ef476f'];
