// The art kit: cel-shaded materials with a soft cartoon rim light, ink outlines,
// glow sprites and canvas-texture helpers. Every model in the game is built
// from these — no art files.
import * as THREE from 'three';

// Día de Muertos palette: papel picado brights + marigold + adobe + night.
export const PAL = {
  rosa: '#e4007c',      // rosa mexicano
  magenta: '#c2187a',
  marigold: '#ff9a0d',  // cempasúchil
  gold: '#ffc21a',
  orange: '#f26b1d',
  turquoise: '#16b3ac',
  teal: '#0f7f86',
  purple: '#7b3fbf',
  violet: '#a35ee0',
  lime: '#8cc63f',
  green: '#3e9b4f',
  leaf: '#2f7d3a',
  cobalt: '#2357d1',
  sky: '#86cff2',
  red: '#d8293b',
  cream: '#fff3dc',
  paper: '#fbf6ea',
  wood: '#8a5a33',
  woodDark: '#5d3a21',
  terracotta: '#c8643b',
  adobe: '#f0b48c',
  pinkWall: '#f7a8c4',
  yellowWall: '#ffd86b',
  blueWall: '#6fc3e8',
  greenWall: '#9ed98b',
  night: '#141a46',
  ink: '#2a1a14',
};

// ------------------------------------------------------------------ canvases
export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

export function tex(canvas, { repeat = null, srgb = true, aniso = 4, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.anisotropy = aniso;
  return t;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function mixHex(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}

// Seeded random so procedural layouts stay put between visits.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------------ toon shading
const gradients = {};
function gradientMap(kind) {
  if (gradients[kind]) return gradients[kind];
  const tones = kind === 'hard' ? [120, 200, 255] : [105, 150, 205, 240, 255];
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  gradients[kind] = t;
  return t;
}

// one shared rim uniform: warm cartoon edge light, dialed down at night
export const RIM = { color: { value: new THREE.Color('#fff1d6') }, strength: { value: 0.32 } };

function addRim(material, power) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = RIM.color;
    shader.uniforms.rimStrength = RIM.strength;
    shader.uniforms.rimPower = { value: power };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nvoid main() {')
      .replace('#include <opaque_fragment>', `
        float rimF = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
        outgoingLight += rimColor * pow(rimF, rimPower) * rimStrength * diffuseColor.rgb;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `rim${power}`;
}

const matCache = new Map();
// toon(color) → shared cel material. opts: map, emissive, emissiveIntensity,
// transparent, opacity, side, hard (3-tone), rim (power, 0 = none), flat
export function toon(color, opts = {}) {
  const key = opts.map || opts.noCache ? null : JSON.stringify([color, opts]);
  if (key && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(opts.hard ? 'hard' : 'soft'),
    map: opts.map || null,
    emissive: opts.emissive || '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    alphaTest: opts.alphaTest ?? 0,
  });
  if (opts.rim !== 0) addRim(m, opts.rim ?? 2.6);
  if (key) matCache.set(key, m);
  return m;
}

// unlit, for flames, glows, painted signs that should read at night
export function flat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color, map: opts.map || null, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide, alphaTest: opts.alphaTest ?? 0,
    depthWrite: opts.depthWrite ?? true, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: opts.fog ?? true,
  });
}

// ------------------------------------------------------------------ ink outlines
const outlineMats = new Map();
function outlineMat(width, color) {
  const key = `${width}|${color}`;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineW = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float outlineW;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * outlineW;');
  };
  m.customProgramCacheKey = () => `outline${width}`;
  m.userData.isOutline = true;
  outlineMats.set(key, m);
  return m;
}

// Adds an inverted-hull outline to every smooth mesh in obj (skips flagged ones).
export function outline(obj, width = 0.012, color = PAL.ink) {
  const meshes = [];
  obj.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && !o.userData.noOutline && !o.material?.userData?.isOutline && !o.userData.isOutlineHull && !o.material?.transparent) meshes.push(o);
  });
  for (const m of meshes) {
    const s = m.getWorldScale(new THREE.Vector3());
    const avg = (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3 || 1;
    const hull = new THREE.Mesh(m.geometry, outlineMat(+(width / avg).toFixed(4), color));
    hull.userData.isOutlineHull = true;
    hull.raycast = () => {};
    hull.castShadow = false;
    m.add(hull);
  }
  return obj;
}

// ------------------------------------------------------------------ merging
// Combine meshes that share a parent and a material into one mesh (they move
// together anyway). Keeps the hierarchy, so animated joints still work. Run it
// before outline(). Meshes with children, instanced meshes, and anything with
// userData.keep are left alone.
export function mergeByParent(root) {
  let saved = 0;
  const parents = [];
  root.traverse((o) => { if (o.children.length > 1) parents.push(o); });
  const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const parent of parents) {
    const groups = new Map();
    for (const c of parent.children) {
      if (!c.isMesh || c.isInstancedMesh || c.children.length || c.userData.keep || !c.visible) continue;
      if (Array.isArray(c.material) || c.userData.isOutlineHull) continue;
      const g = c.geometry;
      if (!g.attributes.normal || !g.attributes.uv || g.morphAttributes?.position) continue;
      const key = `${c.material.uuid}|${c.castShadow}|${c.receiveShadow}|${!!c.userData.noOutline}|${Object.prototype.hasOwnProperty.call(c, 'raycast')}|${c.renderOrder}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      let vc = 0, ic = 0;
      for (const c of list) {
        vc += c.geometry.attributes.position.count;
        ic += c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count;
      }
      const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
      const idx = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
      let vo = 0, io = 0;
      for (const c of list) {
        c.updateMatrix();
        m4.copy(c.matrix);
        n3.getNormalMatrix(m4);
        const g = c.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m4);
          pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(N, i).applyMatrix3(n3).normalize();
          nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
          uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i);
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo; io += g.index.count; }
        else { for (let i = 0; i < P.count; i++) idx[io + i] = vo + i; io += P.count; }
        vo += P.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      const first = list[0];
      const merged = new THREE.Mesh(geo, first.material);
      merged.castShadow = first.castShadow;
      merged.receiveShadow = first.receiveShadow;
      merged.renderOrder = first.renderOrder;
      merged.userData.noOutline = !!first.userData.noOutline;
      if (Object.prototype.hasOwnProperty.call(first, 'raycast')) merged.raycast = first.raycast;
      for (const c of list) {
        parent.remove(c);
        if (!c.geometry.userData.sharedGeo) c.geometry.dispose();
      }
      parent.add(merged);
      saved += list.length - 1;
    }
  }
  return saved;
}

// ------------------------------------------------------------------ glow
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = tex(cv);
  return glowTex;
}

export function glowSprite(color = '#ffb347', size = 1, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(size, size, size);
  s.raycast = () => {};
  return s;
}

// ------------------------------------------------------------------ geometry helpers
export function mesh(geo, mat, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function sphere(r, mat, seg = 24) {
  return mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), mat);
}

export function capsule(r, len, mat, seg = 16) {
  return mesh(new THREE.CapsuleGeometry(r, len, 6, seg), mat);
}

export function cyl(rt, rb, h, mat, seg = 20, open = false) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
}

export function box(w, h, d, mat) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// rounded box (chunky cartoon furniture)
export function rbox(w, h, d, r, mat, seg = 3) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(r * 0.6, d / 2 - 0.001);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6,
    bevelSegments: seg, curveSegments: seg * 2,
  });
  geo.translate(0, 0, -(d - bev * 2) / 2);
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

// a tube along points (eyebrows, smiles, handles, stems)
export function tube(points, r, mat, seg = 16, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed);
  return mesh(new THREE.TubeGeometry(curve, seg, r, 8, closed), mat, { cast: false });
}

// lathe from [r, y] pairs (pots, cups, vases, bells)
export function lathe(profile, mat, seg = 24) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return mesh(new THREE.LatheGeometry(pts, seg), mat);
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

// Disposes geometries, materials (not the shared cache) and textures under obj.
export function disposeTree(obj) {
  const cached = new Set([...matCache.values(), ...outlineMats.values()]);
  obj.traverse((o) => {
    if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (cached.has(m) || m.userData?.shared) continue;
      if (m.map && !m.map.userData?.shared) m.map.dispose();
      m.dispose();
    }
  });
}
