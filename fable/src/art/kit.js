// Shared art kit: toon materials, cached chunky geometry, canvas textures and
// light rigs. Everything in the game is built from these — there are no model
// or image files.
import * as THREE from 'three';

// ------------------------------------------------------------------ materials
function makeGradient() {
  // 8 bands across N·L ∈ [-1,1]; dark half, a mid band, then full light.
  const bands = [0.5, 0.5, 0.5, 0.56, 0.78, 1, 1, 1];
  const data = new Uint8Array(bands.length * 4);
  bands.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255); data[i * 4 + 3] = 255; });
  const tex = new THREE.DataTexture(data, bands.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
export const GRADIENT = makeGradient();

const matCache = new Map();
const colorKey = (c) => (typeof c === 'number' ? c.toString(16) : String(c));

/** Cached toon material. Pass opts only for variants (transparent, side…). */
export function toon(color, opts) {
  const key = `t:${colorKey(color)}:${opts ? JSON.stringify(opts) : ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...(opts || {}) });
    matCache.set(key, m);
  }
  return m;
}
/** Unlit flat colour (signs, glows, UI-ish bits). */
export function flat(color, opts) {
  const key = `b:${colorKey(color)}:${opts ? JSON.stringify(opts) : ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, ...(opts || {}) });
    matCache.set(key, m);
  }
  return m;
}
/** Toon material with an emissive kick — windows, lamps, neon. */
export function lit(color, emissive = color, intensity = 1) {
  const key = `l:${colorKey(color)}:${colorKey(emissive)}:${intensity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, emissive, emissiveIntensity: intensity });
    matCache.set(key, m);
  }
  return m;
}
/** Uncached textured toon material. */
export function texMat(map, opts = {}) {
  return new THREE.MeshToonMaterial({ map, gradientMap: GRADIENT, ...opts });
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color(0xffffff), amt); else c.lerp(new THREE.Color(0x000000), -amt);
  return c.getHex();
}
export const hexStr = (c) => `#${new THREE.Color(c).getHexString()}`;

// ------------------------------------------------------------------ geometry
const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const box = (w, h, d) => cached(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const sphere = (r, ws = 14, hs = 10) => cached(`sph:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const cyl = (rt, rb, h, seg = 12, open = false) => cached(`cyl:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const cone = (r, h, seg = 12) => cached(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const capsule = (r, len, seg = 10) => cached(`cap:${r}:${len}:${seg}`, () => new THREE.CapsuleGeometry(r, len, 4, seg));
export const torus = (r, tube, rs = 8, ts = 16, arc = Math.PI * 2) => cached(`tor:${r}:${tube}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
export const plane = (w, h) => cached(`pl:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));
export const circle = (r, seg = 20) => cached(`ci:${r}:${seg}`, () => new THREE.CircleGeometry(r, seg));
export const ring = (ri, ro, seg = 28) => cached(`ri:${ri}:${ro}:${seg}`, () => new THREE.RingGeometry(ri, ro, seg));

/** A box with rounded vertical edges and bevelled top/bottom — the "chunky toy" primitive. Centred like BoxGeometry. */
export function rbox(w, h, d, r = 0.12) {
  r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001, h / 2 - 0.001);
  return cached(`rb:${w}:${h}:${d}:${r}`, () => {
    const hw = w / 2 - r, hd = d / 2 - r;
    const cr = Math.min(r * 1.2, hw, hd);
    const s = new THREE.Shape();
    s.moveTo(-hw + cr, -hd);
    s.lineTo(hw - cr, -hd);
    s.quadraticCurveTo(hw, -hd, hw, -hd + cr);
    s.lineTo(hw, hd - cr);
    s.quadraticCurveTo(hw, hd, hw - cr, hd);
    s.lineTo(-hw + cr, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd - cr);
    s.lineTo(-hw, -hd + cr);
    s.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
    const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(h / 2 - r), 0);
    return g;
  });
}

/** Mesh shorthand: M(geometry, material, x, y, z, {rx, ry, rz, s, sx, sy, sz, shadow}) */
export function M(geo, mat, x = 0, y = 0, z = 0, o) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (o) {
    if (o.rx) m.rotation.x = o.rx;
    if (o.ry) m.rotation.y = o.ry;
    if (o.rz) m.rotation.z = o.rz;
    if (o.s) m.scale.setScalar(o.s);
    if (o.sx || o.sy || o.sz) m.scale.set(o.sx ?? m.scale.x, o.sy ?? m.scale.y, o.sz ?? m.scale.z);
    if (o.shadow === false) m.castShadow = false;
    if (o.receive === false) m.receiveShadow = false;
    if (o.name) m.name = o.name;
    if (o.order !== undefined) m.renderOrder = o.order;
  }
  return m;
}

export function group(x = 0, y = 0, z = 0, ...kids) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const k of kids) if (k) g.add(k);
  return g;
}

/** Free everything unique under a node (cached geometry/materials are left alone). */
export function disposeTree(root) {
  const cachedGeos = new Set(geoCache.values());
  const cachedMats = new Set(matCache.values());
  root.traverse((o) => {
    if (o.geometry && !cachedGeos.has(o.geometry)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (cachedMats.has(m) || m.userData.shared) continue;
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    }
  });
}

// ------------------------------------------------------------------ textures
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso || 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  if (opts.nearest) { t.magFilter = THREE.NearestFilter; }
  return t;
}

export const FONT = '"Baloo 2","Fredoka","Nunito","Arial Rounded MT Bold","Trebuchet MS","Segoe UI",system-ui,sans-serif';

/** A texture with centred text — signs, jersey numbers, banners. */
export function textTex(text, { w = 256, h = 96, color = '#2b1a33', bg = null, size = 0, weight = 900, stroke = null, strokeW = 6, font = FONT, pad = 12, radius = 0, border = null } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      if (radius) { roundRect(ctx, 2, 2, w - 4, h - 4, radius); ctx.fill(); } else ctx.fillRect(0, 0, w, h);
      if (border) { ctx.strokeStyle = border; ctx.lineWidth = 6; roundRect(ctx, 5, 5, w - 10, h - 10, Math.max(0, radius - 3)); ctx.stroke(); }
    }
    const lines = String(text).split('\n');
    let fs = size || Math.floor((h - pad * 2) / lines.length);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    do {
      ctx.font = `${weight} ${fs}px ${font}`;
      fs -= 2;
    } while (fs > 8 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > w - pad * 2);
    const lh = (fs + 2) * 1.08;
    lines.forEach((l, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * lh;
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW; ctx.lineJoin = 'round'; ctx.strokeText(l, w / 2, y); }
      ctx.fillStyle = color;
      ctx.fillText(l, w / 2, y);
    });
  });
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** A flat sign board mesh with text on it. */
export function signPlane(text, w, h, opts = {}) {
  const tex = textTex(text, { w: Math.round(w * 128), h: Math.round(h * 128), ...opts });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !opts.bg, toneMapped: false }));
  m.userData.unique = true;
  return m;
}

// ------------------------------------------------------------------ lighting
export const SKIES = {
  day: { sky: 0xf6d9a8, fog: 0xf3d3a0, hemiSky: 0xfff3da, hemiGround: 0xb98a5e, hemi: 1.55, sun: 0xfff0d0, sunI: 2.3, sunDir: [-0.55, 1, 0.45], amb: 0.0 },
  dusk: { sky: 0xe98a5b, fog: 0xd97b5a, hemiSky: 0xffc59a, hemiGround: 0x6a4a6e, hemi: 1.25, sun: 0xffa66b, sunI: 1.9, sunDir: [-0.9, 0.55, 0.3], amb: 0.0 },
  night: { sky: 0x1b1836, fog: 0x1b1836, hemiSky: 0x6f78c8, hemiGround: 0x2a2244, hemi: 1.05, sun: 0x9fb4ff, sunI: 0.75, sunDir: [0.4, 1, 0.5], amb: 0.0 },
  indoor: { sky: 0x2b1a33, fog: 0x2b1a33, hemiSky: 0xfff0d8, hemiGround: 0xa07a66, hemi: 1.7, sun: 0xfff2dc, sunI: 1.5, sunDir: [-0.3, 1, 0.6], amb: 0.0 },
  snow: { sky: 0xcfe6f5, fog: 0xd8ecf8, hemiSky: 0xf4faff, hemiGround: 0x9fb8d8, hemi: 1.25, sun: 0xfff2e0, sunI: 1.55, sunDir: [-0.5, 1, 0.4], amb: 0.0 },
  neon: { sky: 0x140f2e, fog: 0x1a1140, hemiSky: 0x8c7bff, hemiGround: 0x3b1d5e, hemi: 1.2, sun: 0xff8ad8, sunI: 0.9, sunDir: [0.3, 1, 0.4], amb: 0.0 },
  bowl: { sky: 0x0e0b24, fog: 0x15103a, hemiSky: 0x8f9bff, hemiGround: 0x2a1f55, hemi: 1.25, sun: 0xcfd8ff, sunI: 1.3, sunDir: [-0.2, 1, 0.35], amb: 0.0 },
};

/**
 * Standard light rig. Returns { sun, hemi, follow(x,z) } — call follow() with
 * the camera target so the shadow map stays crisp around the action.
 */
export function lightRig(scene, preset = 'day', { shadowSize = 26, fog = [60, 150] } = {}) {
  const p = typeof preset === 'string' ? SKIES[preset] : preset;
  scene.background = new THREE.Color(p.sky);
  scene.fog = fog ? new THREE.Fog(p.fog, fog[0], fog[1]) : null;
  const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(p.sun, p.sunI);
  const dir = new THREE.Vector3(...p.sunDir).normalize().multiplyScalar(40);
  sun.position.copy(dir);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -shadowSize; c.right = shadowSize; c.top = shadowSize; c.bottom = -shadowSize;
  c.near = 1; c.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  return {
    sun, hemi, preset: p,
    follow(x, z) {
      sun.position.set(x + dir.x, dir.y, z + dir.z);
      sun.target.position.set(x, 0, z);
      sun.target.updateMatrixWorld();
    },
    set(name) {
      const q = SKIES[name];
      scene.background.set(q.sky);
      if (scene.fog) scene.fog.color.set(q.fog);
      hemi.color.set(q.hemiSky); hemi.groundColor.set(q.hemiGround); hemi.intensity = q.hemi;
      sun.color.set(q.sun); sun.intensity = q.sunI;
      dir.set(...q.sunDir).normalize().multiplyScalar(40);
    },
  };
}

/** Soft additive glow billboard (lamps, lantern light, neon bloom). */
let glowTex = null;
export function glowSprite(color, size = 2, opacity = 0.6) {
  if (!glowTex) {
    glowTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    glowTex.userData.shared = true;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size);
  return s;
}

// ------------------------------------------------------------------ baking
// Collapse a static prop tree into one vertex-coloured mesh (plus whatever
// can't be baked: textured, emissive, transparent or double-sided bits).
let _vcMat = null, _vcMatDouble = null;
export function vertexToon(double = false) {
  if (double) {
    if (!_vcMatDouble) { _vcMatDouble = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT, side: THREE.DoubleSide }); _vcMatDouble.userData.shared = true; }
    return _vcMatDouble;
  }
  if (!_vcMat) { _vcMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT }); _vcMat.userData.shared = true; }
  return _vcMat;
}
const nonIndexed = new WeakMap();
const _nm = new THREE.Matrix3();
const _bv = new THREE.Vector3();
const _rel = new THREE.Matrix4();
const _inv = new THREE.Matrix4();

function bakeable(m) {
  return m && m.isMeshToonMaterial && !m.map && !m.transparent && !m.vertexColors && m.emissiveIntensity * (m.emissive.r + m.emissive.g + m.emissive.b) < 0.001;
}

/**
 * Bake every eligible mesh under `root` into merged meshes (added to root).
 * Subtrees flagged userData.keep are left untouched. Returns the baked meshes.
 */
export function bake(root, { skip } = {}) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = { f: { pos: [], nor: [], col: [] }, d: { pos: [], nor: [], col: [] } };
  const dead = [];
  const visit = (o) => {
    if (o.userData.keep || (skip && skip(o))) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && bakeable(o.material) && o.visible) {
      let g = o.geometry;
      if (g.index) {
        let ng = nonIndexed.get(g);
        if (!ng) { ng = g.toNonIndexed(); nonIndexed.set(g, ng); }
        g = ng;
      }
      const P = g.attributes.position, N = g.attributes.normal;
      if (P && N) {
        _rel.multiplyMatrices(_inv, o.matrixWorld);
        _nm.getNormalMatrix(_rel);
        const b = o.material.side === THREE.DoubleSide ? buckets.d : buckets.f;
        const c = o.material.color;
        for (let i = 0; i < P.count; i++) {
          _bv.fromBufferAttribute(P, i).applyMatrix4(_rel);
          b.pos.push(_bv.x, _bv.y, _bv.z);
          _bv.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
          b.nor.push(_bv.x, _bv.y, _bv.z);
          b.col.push(c.r, c.g, c.b);
        }
        dead.push(o);
      }
    }
    for (const k of o.children.slice()) visit(k);
  };
  visit(root);
  for (const o of dead) o.removeFromParent();
  const out = [];
  for (const key of ['f', 'd']) {
    const b = buckets[key];
    if (!b.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    const mesh = new THREE.Mesh(geo, vertexToon(key === 'd'));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baked = true;
    root.add(mesh);
    out.push(mesh);
  }
  return out;
}
