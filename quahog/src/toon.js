// The look: flat banded shading, thick black ink on every silhouette, and the
// bright daytime palette of a Sunday-night cartoon. Nothing here is loaded from
// disk — the whole art style is a handful of shaders and a canvas or two.
import * as THREE from 'three';

// ------------------------------------------------------------------ canvas
export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

export function tex(canvas, { repeat = null, srgb = true, filter = THREE.LinearFilter } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.magFilter = filter;
  t.anisotropy = 4;
  return t;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function mix(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}

// ------------------------------------------------------------------ shading
let gradient = null;
function gradientMap() {
  if (gradient) return gradient;
  // three flat bands: shadow, midtone, light — the whole cel-shaded look
  const data = new Uint8Array([96, 178, 255]);
  gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map();
/** The workhorse material: banded toon shading in a flat colour. */
export function toon(color, opts = {}) {
  const key = `${color}|${opts.map ? 'm' + (opts.mapKey || '') : ''}|${opts.transparent ? 't' : ''}|${opts.opacity ?? 1}|${opts.side ?? 0}`;
  if (!opts.map && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    map: opts.map || null,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  if (!opts.map) toonCache.set(key, m);
  return m;
}

const flatCache = new Map();
/** Unlit flat colour — signs, lit windows, headlamps, cartoon ink. */
export function flat(color, opts = {}) {
  const key = `${color}|${opts.transparent ? 't' : ''}|${opts.opacity ?? 1}|${opts.side ?? 0}|${opts.map ? 'm' + (opts.mapKey || '') : ''}`;
  if (!opts.map && flatCache.has(key)) return flatCache.get(key);
  const m = new THREE.MeshBasicMaterial({
    color,
    map: opts.map || null,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
  });
  if (!opts.map) flatCache.set(key, m);
  return m;
}

export const INK = '#141418';

// ------------------------------------------------------------------ shapes
/** A rounded slab — the base shape of nearly every cartoon prop. */
export function roundedBox(w, h, d, r = 0.12, bevelSeg = 2) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  const rr = Math.min(r, hw * 0.9, hh * 0.9);
  s.moveTo(-hw + rr, -hh);
  s.lineTo(hw - rr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rr);
  s.lineTo(hw, hh - rr);
  s.quadraticCurveTo(hw, hh, hw - rr, hh);
  s.lineTo(-hw + rr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rr);
  s.lineTo(-hw, -hh + rr);
  s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
  const bev = Math.min(0.06, d * 0.2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev,
    bevelSegments: bevelSeg, curveSegments: 4,
  });
  g.translate(0, 0, -(d - bev * 2) / 2);
  return g;
}

/** An egg: the head shape half this cast is built from. */
export function egg(r, squashY = 1, squashZ = 1, seg = 16) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.72));
  g.scale(1, squashY, squashZ);
  return g;
}

// ------------------------------------------------------------------ the ink
// Every silhouette and crease in the frame gets a black line. It is a
// screen-space pass: draw view normals + depth once, then find the edges.
const EDGE_VERT = `
  #include <common>
  varying vec3 vN;
  varying float vDepth;
  void main() {
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    vN = normalize(transformedNormal);
    #include <begin_vertex>
    #include <project_vertex>
    vDepth = -mvPosition.z;
  }`;

const EDGE_FRAG = `
  varying vec3 vN;
  varying float vDepth;
  void main() { gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, vDepth); }`;

const COMPOSITE_FRAG = `
  uniform sampler2D tNormalDepth;
  uniform vec2 texel;
  uniform float thickness;
  uniform vec3 inkColor;
  varying vec2 vUv;
  vec4 nd(vec2 uv) { return texture2D(tNormalDepth, uv); }
  void main() {
    vec2 o = texel * thickness;
    vec4 c = nd(vUv);
    vec4 l = nd(vUv + vec2(-o.x, 0.0));
    vec4 r = nd(vUv + vec2( o.x, 0.0));
    vec4 u = nd(vUv + vec2(0.0,  o.y));
    vec4 d = nd(vUv + vec2(0.0, -o.y));
    // Silhouettes come from depth jumps — but a road seen at a grazing angle
    // also changes depth fast without being an edge, so the difference is
    // weighted by how side-on the surface is (view-space normal z).
    vec3 cn = c.rgb * 2.0 - 1.0;
    float dref = max(c.a, 0.6);
    float slope = max(0.10, abs(cn.z));
    float dd = max(max(abs(c.a - l.a), abs(c.a - r.a)), max(abs(c.a - u.a), abs(c.a - d.a)));
    float depthEdge = smoothstep(0.030, 0.100, (dd / dref) * slope);
    // normal discontinuity → the creases inside a silhouette
    float nd1 = 1.0 - dot(cn, l.rgb * 2.0 - 1.0);
    float nd2 = 1.0 - dot(cn, r.rgb * 2.0 - 1.0);
    float nd3 = 1.0 - dot(cn, u.rgb * 2.0 - 1.0);
    float nd4 = 1.0 - dot(cn, d.rgb * 2.0 - 1.0);
    float normEdge = smoothstep(0.22, 0.75, max(max(nd1, nd2), max(nd3, nd4)));
    // ink fades out in the far distance so the horizon stays clean
    float fade = 1.0 - smoothstep(150.0, 260.0, c.a);
    float e = clamp(max(depthEdge, normEdge * 0.9), 0.0, 1.0) * fade;
    if (e < 0.02) discard;
    gl_FragColor = vec4(inkColor, e);
  }`;

export class InkPass {
  constructor(renderer, { scale = 0.85, thickness = 1.6 } = {}) {
    this.renderer = renderer;
    this.scale = scale;
    this.enabled = true;
    this.target = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: true, stencilBuffer: false,
    });
    this.prepassMat = new THREE.ShaderMaterial({
      vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG, side: THREE.FrontSide,
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tNormalDepth: { value: this.target.texture },
        texel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        thickness: { value: thickness },
        inkColor: { value: new THREE.Color(INK) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: COMPOSITE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(w, h) {
    const rw = Math.max(2, Math.round(w * this.scale));
    const rh = Math.max(2, Math.round(h * this.scale));
    this.target.setSize(rw, rh);
    this.compositeMat.uniforms.texel.value.set(1 / rw, 1 / rh);
  }

  /** Pass 1 (normals+depth) then pass 2 (the scene), then ink on top. */
  render(scene, camera, skipList = []) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    const hidden = [];
    for (const o of skipList) {
      if (o && o.visible) { o.visible = false; hidden.push(o); }
    }
    const oldBg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.prepassMat;
    // the ink fades out past ~260 units anyway, so pull the far plane in for
    // the prepass and let frustum culling drop everything beyond it
    const oldFar = camera.far;
    if (oldFar > 300) { camera.far = 300; camera.updateProjectionMatrix(); }
    r.setRenderTarget(this.target);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = oldBg;
    if (camera.far !== oldFar) { camera.far = oldFar; camera.updateProjectionMatrix(); }
    for (const o of hidden) o.visible = true;

    r.setRenderTarget(null);
    r.render(scene, camera);
    const auto = r.autoClear;
    r.autoClear = false;
    r.render(this.quadScene, this.quadCam);
    r.autoClear = auto;
  }

  dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
  }
}

// ------------------------------------------------------------------ the sky
const SKY_VERT = 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SKY_FRAG = `
  uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform float horizon;
  varying vec3 vPos;
  void main() {
    float h = normalize(vPos).y;
    vec3 c = h > horizon
      ? mix(mid, top, smoothstep(horizon, 1.0, h))
      : mix(bottom, mid, smoothstep(-0.25, horizon, h));
    gl_FragColor = vec4(c, 1.0);
  }`;

/** Time-of-day keys. Quahog runs on a 24 hour clock and looks different at each. */
export const SKY_KEYS = [
  { h: 0,  top: '#0a1030', mid: '#141d44', bot: '#26305c', sun: '#9fb4e8', amb: 0.34, dir: 0.30, fog: '#1b2246' },
  { h: 5,  top: '#1c2c58', mid: '#5a4a76', bot: '#e08a5a', sun: '#ffb070', amb: 0.42, dir: 0.55, fog: '#7b6a86' },
  { h: 7,  top: '#4a9bdc', mid: '#9fd0ee', bot: '#ffd9a8', sun: '#fff0c8', amb: 0.62, dir: 1.05, fog: '#cfe4f2' },
  { h: 12, top: '#3d92e0', mid: '#8fcdf2', bot: '#dff0fb', sun: '#ffffff', amb: 0.70, dir: 1.25, fog: '#dcecf8' },
  { h: 17, top: '#3f88d8', mid: '#9ccbee', bot: '#ffe2b0', sun: '#fff2d0', amb: 0.64, dir: 1.05, fog: '#e2dfd0' },
  { h: 19, top: '#22407e', mid: '#8a5c8e', bot: '#f08a4a', sun: '#ff9a4a', amb: 0.46, dir: 0.62, fog: '#a2708a' },
  { h: 21, top: '#0d1436', mid: '#1b2450', bot: '#3a3a6a', sun: '#a8bcf0', amb: 0.36, dir: 0.34, fog: '#232a52' },
  { h: 24, top: '#0a1030', mid: '#141d44', bot: '#26305c', sun: '#9fb4e8', amb: 0.34, dir: 0.30, fog: '#1b2246' },
];

export function skyAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i].h && h <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  return {
    top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), bot: mix(a.bot, b.bot, t),
    sun: mix(a.sun, b.sun, t), fog: mix(a.fog, b.fog, t),
    amb: a.amb + (b.amb - a.amb) * t,
    dir: a.dir + (b.dir - a.dir) * t,
    night: h < 5.6 || h > 19.6,
  };
}

/** The dome, the sun/moon, and a raft of hand-drawn clouds. */
export function buildSky(radius = 620) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#3d92e0') },
      mid: { value: new THREE.Color('#8fcdf2') },
      bottom: { value: new THREE.Color('#dff0fb') },
      horizon: { value: 0.06 },
    },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat);
  dome.renderOrder = -10;
  group.add(dome);

  const sun = new THREE.Mesh(new THREE.CircleGeometry(26, 24), flat('#fff6d0'));
  sun.position.set(0, 220, -radius * 0.82);
  group.add(sun);

  // clouds: clusters of toon spheres that drift and take the ink pass happily
  const clouds = new THREE.Group();
  const cloudMat = toon('#ffffff');
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const n = 3 + (i % 3);
    for (let j = 0; j < n; j++) {
      const r = 11 + Math.random() * 9;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set((j - (n - 1) / 2) * r * 1.15, Math.abs(j - (n - 1) / 2) * -2 + Math.random() * 3, Math.random() * 6 - 3);
      puff.scale.y = 0.66;
      c.add(puff);
    }
    const ang = (i / 16) * Math.PI * 2 + Math.random();
    const rad = 180 + Math.random() * 320;
    c.position.set(Math.cos(ang) * rad, 130 + Math.random() * 70, Math.sin(ang) * rad);
    c.userData.drift = 0.6 + Math.random() * 0.8;
    clouds.add(c);
  }
  group.add(clouds);

  return {
    group, dome, sun, clouds, mat,
    /** hour 0-24 → colours, sun arc, cloud drift */
    update(hour, dt, center) {
      const s = skyAt(hour);
      mat.uniforms.top.value.set(s.top);
      mat.uniforms.mid.value.set(s.mid);
      mat.uniforms.bottom.value.set(s.bot);
      const ang = ((hour - 6) / 24) * Math.PI * 2;
      sun.position.set(Math.cos(ang) * radius * 0.8, Math.sin(ang) * radius * 0.7, -radius * 0.28);
      sun.material = flat(s.night ? '#e8eeff' : '#fff6d0');
      sun.lookAt(center || new THREE.Vector3());
      for (const c of clouds.children) {
        c.position.x += c.userData.drift * dt;
        if (center && c.position.x > center.x + 500) c.position.x -= 1000;
        c.visible = !s.night || Math.random() < 1; // clouds stay, just darker
      }
      if (center) group.position.set(center.x, 0, center.z);
      return s;
    },
  };
}

// ------------------------------------------------------------------- signage
const signCache = new Map();
/** Hand-lettered shop sign. Every storefront in town gets one. */
export function signTex(text, { bg = '#c0392b', fg = '#fdfaf2', sub = '', w = 512, h = 160, italic = false } = {}) {
  const key = `${text}|${bg}|${fg}|${sub}|${w}x${h}`;
  if (signCache.has(key)) return signCache.get(key);
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.round(h * 0.055);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.min(h * (sub ? 0.44 : 0.56), (w * 1.7) / Math.max(6, text.length));
  ctx.font = `${italic ? 'italic ' : ''}900 ${size}px Impact, 'Arial Black', sans-serif`;
  ctx.fillStyle = fg;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.1;
  const y = sub ? h * 0.40 : h * 0.52;
  ctx.strokeText(text, w / 2, y);
  ctx.fillText(text, w / 2, y);
  if (sub) {
    ctx.font = `700 ${h * 0.20}px 'Arial Narrow', sans-serif`;
    ctx.lineWidth = h * 0.05;
    ctx.strokeText(sub, w / 2, h * 0.75);
    ctx.fillText(sub, w / 2, h * 0.75);
  }
  const t = tex(cv);
  signCache.set(key, t);
  return t;
}

/** A flat sign board hung on a wall. */
export function signBoard(text, w, h, opts = {}) {
  const t = signTex(text, { ...opts, w: 512, h: Math.round(512 * (h / w)) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flat('#ffffff', { map: t, mapKey: text }));
  return m;
}

// ------------------------------------------------------------------ merging
/**
 * Collapse a whole building (or a whole block) into one mesh per material.
 * A town of 900 little meshes turns into a couple of hundred draw calls, which
 * matters twice over here because the ink pass renders the scene again.
 */
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noMerge) return;
    const mat = o.material;
    if (Array.isArray(mat) || mat.transparent) { keep.push(o); return; }
    let b = buckets.get(mat);
    if (!b) { b = []; buckets.set(mat, b); }
    b.push(o);
  });
  const out = new THREE.Group();
  out.position.copy(root.position);
  out.rotation.copy(root.rotation);
  out.scale.copy(root.scale);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const [mat, meshes] of buckets) {
    let total = 0;
    const geos = [];
    for (const m of meshes) {
      let g = m.geometry;
      if (g.index) g = g.toNonIndexed();
      else g = g.clone();
      const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(mtx);
      geos.push(g);
      total += g.attributes.position.count;
    }
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    let po = 0, uo = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, po);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, po);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, uo);
      po += g.attributes.position.count * 3;
      uo += g.attributes.position.count * 2;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.computeBoundingSphere();
    out.add(new THREE.Mesh(merged, mat));
  }
  for (const m of keep) {
    m.updateMatrixWorld(true);
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    m.removeFromParent();
    mtx.decompose(m.position, m.quaternion, m.scale);
    out.add(m);
  }
  out.userData = root.userData;
  return out;
}

// ------------------------------------------------------------- contact shade
let shadowTex = null;
/** Soft blob under everything that stands on the ground. Flat on the floor, so
 *  the ink pass leaves it alone. */
export function blobShadow(r = 0.5, alpha = 0.34) {
  if (!shadowTex) {
    const cv = mkCanvas(64, 64);
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: alpha, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 2;
  return m;
}

// ------------------------------------------------------------------ helpers
/** Merge a bag of meshes into one object so the town is not a million draws. */
export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function cyl(rt, rb, h, mat, seg = 12) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

export function sphere(r, mat, seg = 12) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat);
}
