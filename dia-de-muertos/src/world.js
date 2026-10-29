// World kit: sky, hills, pueblo houses, the parroquia, the kiosco, trees,
// lamps, market stalls, papel picado strings and marigolds. Static pieces are
// merged by material (mergeStatic) so a whole street costs a few draw calls.
import * as THREE from 'three';
import { toon, flat, mkCanvas, tex, shade, rng, PAL, sphere, cyl, box, mesh, lathe, glowSprite } from './toon.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ textures
const texCache = new Map();
function cached(key, make) {
  if (!texCache.has(key)) {
    const t = make();
    t.userData.shared = true;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

function noiseFill(ctx, w, h, base, amt = 14, n = 1800, seed = 3) {
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shade(base, (r() - 0.5) * amt * 2);
    ctx.globalAlpha = 0.35;
    const s = 2 + r() * 6;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

// plaster wall with the painted guardapolvo band along the bottom
export function plasterTex(color, band = null, bandFrac = 0.18) {
  return cached(`pl|${color}|${band}|${bandFrac}`, () => {
    const cv = mkCanvas(256, 256);
    const ctx = cv.getContext('2d');
    noiseFill(ctx, 256, 256, color, 10, 900, color.length);
    if (band) {
      const y = 256 * (1 - bandFrac);
      noiseFill(ctx, 256, 256 - y, band, 10, 200, 9);
      ctx.drawImage(cv, 0, 0, 256, 256 - y, 0, y, 256, 256 - y);
      ctx.fillStyle = band;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, y, 256, 256 - y);
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(band, -30);
      ctx.fillRect(0, y - 3, 256, 5);
    }
    return tex(cv);
  });
}

export function cobbleTex(base = '#b9a38a') {
  return cached(`cob|${base}`, () => {
    const cv = mkCanvas(256, 256);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = shade(base, -45);
    ctx.fillRect(0, 0, 256, 256);
    const r = rng(11);
    for (let y = 0; y < 256; y += 22) {
      for (let x = (y / 22) % 2 ? -11 : 0; x < 256; x += 24) {
        ctx.fillStyle = shade(base, (r() - 0.5) * 36);
        ctx.beginPath();
        ctx.ellipse(x + 12, y + 11, 10 + r() * 2, 8.5 + r() * 2, r(), 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(x + 10, y + 8, 5, 3, 0, 0, TAU);
        ctx.fill();
      }
    }
    return tex(cv, { repeat: [8, 8] });
  });
}

export function tileTex(a = '#c8643b', b = '#b85532', n = 4) {
  return cached(`tile|${a}|${b}|${n}`, () => {
    const cv = mkCanvas(256, 256);
    const ctx = cv.getContext('2d');
    const s = 256 / n;
    const r = rng(5);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = shade((x + y) % 2 ? a : b, (r() - 0.5) * 16);
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    ctx.strokeStyle = 'rgba(80,40,20,0.45)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(256, i * s); ctx.stroke();
    }
    return tex(cv, { repeat: [6, 6] });
  });
}

// talavera-style tile: cobalt flower on cream
export function talaveraTex() {
  return cached('talavera', () => {
    const cv = mkCanvas(128, 128);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f6efdc';
    ctx.fillRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    ctx.fillStyle = '#1f4fb4';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.beginPath();
      ctx.ellipse(0, -30, 9, 22, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f0b429';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f4fb4';
    for (const [x, y] of [[-64, -64], [64, -64], [-64, 64], [64, 64]]) {
      ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = '#2a3f8f';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 126, 126);
    return tex(cv, { repeat: [1, 1] });
  });
}

export function woodTex(base = PAL.wood) {
  return cached(`wood|${base}`, () => {
    const cv = mkCanvas(128, 128);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    const r = rng(17);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = shade(base, (r() - 0.6) * 40);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1 + r() * 2;
      const y = r() * 128;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(40, y + (r() - 0.5) * 8, 90, y + (r() - 0.5) * 8, 128, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return tex(cv);
  });
}

// ------------------------------------------------------------------ sky
export function skyDome({ top = '#5fb6ee', horizon = '#ffe2b0', bottom = '#ffd39a', radius = 180, stars = false } = {}) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.75, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, 0.2, -h));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -10;
  dome.raycast = () => {};
  const g = new THREE.Group();
  g.add(dome);
  if (stars) {
    const r = rng(42);
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, y = 0.08 + r() * 0.92;
      const rr = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * rr * radius * 0.95, y * radius * 0.95, Math.sin(a) * rr * radius * 0.95], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff8e1', size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    pts.raycast = () => {};
    g.add(pts);
    g.userData.stars = pts;
  }
  return g;
}

export function clouds(n = 7, { radius = 120, y = 40, color = '#ffffff', seed = 2 } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  const m = toon(color, { rim: 0 });
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group();
    const k = 3 + Math.floor(r() * 4);
    for (let j = 0; j < k; j++) {
      const s = sphere(4 + r() * 4, m, 12);
      s.castShadow = false;
      s.position.set(j * 5 - k * 2.5, r() * 2, r() * 3);
      s.scale.y = 0.7;
      c.add(s);
    }
    const a = (i / n) * Math.PI * 1.2 - Math.PI * 0.6 + (r() - 0.5) * 0.3;
    c.position.set(Math.sin(a) * radius, y + r() * 15, -Math.cos(a) * radius);
    c.lookAt(0, c.position.y, 0);
    g.add(c);
  }
  return g;
}

export function hills({ color = '#7fae6a', far = '#9cc3d6', seed = 4, radius = 110 } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  for (let layer = 0; layer < 2; layer++) {
    const m = toon(layer ? far : color, { rim: 0 });
    const n = layer ? 9 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 1.6 - Math.PI * 0.8 + (r() - 0.5) * 0.2;
      const rad = radius * (layer ? 1.15 : 0.9);
      const h = (layer ? 26 : 12) + r() * (layer ? 22 : 10);
      const s = mesh(new THREE.SphereGeometry(1, 16, 10, 0, TAU, 0, Math.PI / 2), m, { cast: false });
      s.scale.set(18 + r() * 16, h, 16 + r() * 8);
      s.position.set(Math.sin(a) * rad, -1, -Math.cos(a) * rad);
      g.add(s);
    }
  }
  return g;
}

// ------------------------------------------------------------------ marigolds
let marigoldGeo = null;
export function marigoldGeometry() {
  if (marigoldGeo) return marigoldGeo;
  // a ruffled pom-pom: icosphere pushed out in petal-like lumps
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 9.1) * Math.sin(v.y * 8.3) * Math.sin(v.z * 7.7);
    v.multiplyScalar(1 + n * 0.16 + Math.abs(Math.sin(v.y * 22)) * 0.05);
    v.y *= 0.82;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.userData.sharedGeo = true;
  marigoldGeo = g;
  return g;
}

// instanced bed / bunch of cempasúchil. spots: [[x,y,z,scale], ...]
export function marigolds(spots, { colors = ['#ff9a0d', '#ffb21a', '#ff7f11', '#ffc93c'], seed = 1 } = {}) {
  const geo = marigoldGeometry();
  const m = toon('#ffffff', { rim: 2 });
  const im = new THREE.InstancedMesh(geo, m, spots.length);
  const r = rng(seed);
  const mat4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  spots.forEach(([x, y, z, s = 0.06], i) => {
    q.setFromEuler(new THREE.Euler(r() * 0.5, r() * TAU, r() * 0.5));
    mat4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    im.setMatrixAt(i, mat4);
    im.setColorAt(i, col.set(colors[Math.floor(r() * colors.length)]));
  });
  im.castShadow = true;
  im.receiveShadow = false;
  im.userData.sharedGeo = true;
  return im;
}

// a bunch: flowers clustered in a dome
export function marigoldBunch(n = 14, radius = 0.12, seed = 3, size = 0.045) {
  const r = rng(seed);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * radius;
    spots.push([Math.cos(a) * d, Math.sqrt(Math.max(0, radius * radius - d * d)) * 0.7, Math.sin(a) * d, size * (0.8 + r() * 0.4)]);
  }
  return marigolds(spots, { seed });
}

// petals scattered on the ground along a path
export function petalPath(points, { width = 0.35, density = 60, seed = 9, y = 0.012 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], y, p[1])));
  const len = curve.getLength();
  const n = Math.floor(len * density);
  const geo = new THREE.CircleGeometry(1, 6);
  geo.rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, toon('#ffffff', { rim: 0 }), n);
  const r = rng(seed);
  const mat4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const cs = ['#ff9a0d', '#ffb21a', '#ff7f11', '#ffc93c', '#f26b1d'];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tan.z, 0, tan.x);
    p.addScaledVector(side, (r() - 0.5) * width);
    const s = 0.018 + r() * 0.016;
    mat4.compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU), new THREE.Vector3(s, 1, s * (0.6 + r() * 0.5)));
    im.setMatrixAt(i, mat4);
    im.setColorAt(i, col.set(cs[Math.floor(r() * cs.length)]));
  }
  im.receiveShadow = true;
  im.castShadow = false;
  im.userData.curve = curve;
  im.userData.total = n;
  return im;
}

// ------------------------------------------------------------------ papel picado
// default designs; the papel picado mini-game can supply its own cut masks
export function papelCanvas(color, design = 'calavera', w = 128, h = 160) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-out';
  // border of little cut-outs
  ctx.fillStyle = '#000';
  for (let x = 8; x < w; x += 12) {
    ctx.beginPath(); ctx.arc(x, 8, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, h - 4); ctx.lineTo(x, h - 12); ctx.lineTo(x + 4, h - 4); ctx.fill();
  }
  for (let y = 18; y < h - 14; y += 12) {
    ctx.fillRect(4, y, 4, 6);
    ctx.fillRect(w - 8, y, 4, 6);
  }
  const cx = w / 2, cy = h / 2 + 2;
  if (design === 'calavera') {
    // skull silhouette made of negative space, with solid eyes/nose/teeth left in
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, 34, 32, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx - 20, cy + 10, 40, 22);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(cx - 13, cy - 8, 10, 11, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 13, cy - 8, 10, 11, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx - 5, cy + 11); ctx.lineTo(cx + 5, cy + 11); ctx.fill();
    for (let i = -2; i <= 2; i++) ctx.fillRect(cx + i * 8 - 1, cy + 16, 3, 16);
    // flower on the forehead
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx - 13, cy - 8, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 13, cy - 8, 4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 6, cy - 30 + Math.sin(a) * 6, 4, 2.5, a, 0, TAU); ctx.fill();
    }
  } else if (design === 'flor') {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 13, 7, a, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.arc(22 + (k % 2) * (w - 44), 34 + Math.floor(k / 2) * (h - 70), 7, 0, TAU); ctx.fill();
    }
  } else if (design === 'corazon') {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 30);
    ctx.bezierCurveTo(cx - 50, cy - 5, cx - 22, cy - 42, cx, cy - 16);
    ctx.bezierCurveTo(cx + 22, cy - 42, cx + 50, cy - 5, cx, cy + 30);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy - 2, 8, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 10; k++) ctx.fillRect(16 + k * 10, 26, 5, 5);
  } else if (design === 'mariposa') {
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(cx + sx * 20, cy - 12, 18, 22, sx * 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + sx * 15, cy + 18, 12, 14, -sx * 0.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.fillRect(cx - 2, cy - 30, 4, 58);
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * 20, cy - 12, 6, 0, TAU); ctx.fill(); }
  } else if (design === 'diamantes') {
    for (let y = 30; y < h - 26; y += 22) {
      for (let x = 22; x < w - 14; x += 22) {
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  return cv;
}

// a string of papel picado sheets hung between two points, swaying in the breeze
export function papelString(a, b, { colors = [PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple, PAL.lime, PAL.red], designs = ['calavera', 'flor', 'mariposa', 'corazon', 'diamantes'], sheetW = 0.32, sag = 0.25, seed = 1, customs = null } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const n = Math.max(2, Math.floor(len / (sheetW * 1.12)));
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 4), toon('#efe6d6', { rim: 0 }));
  cord.raycast = () => {};
  g.add(cord);
  const r = rng(seed);
  const sheetH = sheetW * 1.25;
  const geo = new THREE.PlaneGeometry(sheetW, sheetH, 4, 6);
  geo.translate(0, -sheetH / 2, 0);
  const mats = new Map();
  g.userData.sheets = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    const custom = customs && customs.length ? customs[i % customs.length] : null;
    const color = colors[(i + seed) % colors.length];
    const design = designs[Math.floor(r() * designs.length)];
    const key = custom ? `c${i % customs.length}` : `${color}|${design}`;
    if (!mats.has(key)) {
      const cv = custom || papelCanvas(color, design);
      mats.set(key, new THREE.MeshLambertMaterial({ map: tex(cv), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    }
    const sheet = new THREE.Mesh(geo, mats.get(key));
    sheet.position.copy(p);
    sheet.lookAt(p.x + (B.z - A.z), p.y, p.z - (B.x - A.x));
    sheet.userData.phase = r() * TAU;
    sheet.userData.baseRot = sheet.rotation.clone();
    sheet.raycast = () => {};
    g.add(sheet);
    g.userData.sheets.push(sheet);
  }
  g.userData.update = (t) => {
    for (const s of g.userData.sheets) {
      s.rotation.x = s.userData.baseRot.x + Math.sin(t * 1.8 + s.userData.phase) * 0.22;
      s.rotation.z = s.userData.baseRot.z + Math.sin(t * 1.3 + s.userData.phase * 2) * 0.05;
    }
  };
  return g;
}

// ------------------------------------------------------------------ string lights
export function stringLights(a, b, { n = 14, sag = 0.3, color = '#ffd27a' } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.008, 4), toon('#3a2a20', { rim: 0 })));
  const bulbM = flat(color);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(t * Math.PI) * sag + 0.04;
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bulbM);
    b2.position.copy(p);
    g.add(b2);
    const gl = glowSprite(color, 0.35, 0.5);
    gl.position.copy(p);
    g.add(gl);
  }
  return g;
}

// ------------------------------------------------------------------ architecture
// A pueblo house facade (front at +z). opts: w,h,d,color,band,trim,door,
// windows (count), roof ('flat'|'tile'), bugambilia (bool), seed
export function house(opts = {}) {
  const { w = 4, h = 3.2, d = 3, color = PAL.pinkWall, band = null, trim = '#fff3dc', roof = 'flat', bugambilia = false, seed = 1, door = true, windows = 2, balcony = false, sign = null, upper = false } = opts;
  const r = rng(seed);
  const g = new THREE.Group();
  const wallM = toon('#ffffff', { map: plasterTex(color, band || shade(color, -55)), rim: 0 });
  const body = box(w, h, d, wallM);
  body.position.y = h / 2;
  body.receiveShadow = true;
  g.add(body);
  // parapet + cornice
  const corn = box(w + 0.12, 0.14, d + 0.12, toon(trim, { rim: 0 }));
  corn.position.y = h + 0.07;
  g.add(corn);
  if (roof === 'tile') {
    const roofM = toon('#ffffff', { map: tileTex('#b8502e', '#a2452a', 8), rim: 0 });
    const eave = box(w + 0.5, 0.12, 0.9, roofM);
    eave.position.set(0, h - 0.05, d / 2 + 0.3);
    eave.rotation.x = 0.32;
    g.add(eave);
    for (let i = 0; i < Math.floor(w / 0.6); i++) {
      const beam = box(0.08, 0.08, 0.5, toon(PAL.woodDark, { rim: 0 }));
      beam.position.set(-w / 2 + 0.3 + i * 0.6, h - 0.28, d / 2 + 0.2);
      g.add(beam);
    }
  } else {
    // little rain spouts (gárgolas)
    for (const sx of [-0.3, 0.3]) {
      const sp = cyl(0.045, 0.045, 0.45, toon('#c46a3a', { rim: 0 }), 8);
      sp.rotation.x = Math.PI / 2;
      sp.position.set(sx * w, h - 0.1, d / 2 + 0.2);
      g.add(sp);
    }
  }
  const trimM = toon(trim, { rim: 0 });
  const glassM = toon('#2e4a72', { rim: 0 });
  const ironM = toon('#2a2522', { rim: 0 });
  const woodM = toon('#ffffff', { map: woodTex('#6e4127'), rim: 0 });
  const front = d / 2;
  const slots = [];
  const nW = windows;
  const doorX = door ? (nW >= 2 ? 0 : -w * 0.22) : null;
  if (door) {
    const dw = Math.min(1.2, w * 0.3), dh = Math.min(2.2, h * 0.7);
    const frame = box(dw + 0.24, dh + 0.14, 0.06, trimM);
    frame.position.set(doorX, dh / 2 + 0.04, front + 0.02);
    g.add(frame);
    const leaf = box(dw, dh, 0.08, woodM);
    leaf.position.set(doorX, dh / 2, front + 0.03);
    g.add(leaf);
    for (const sx of [-1, 1]) {
      const panel = box(dw * 0.36, dh * 0.34, 0.03, toon('#5b3520', { rim: 0 }));
      panel.position.set(doorX + sx * dw * 0.22, dh * 0.62, front + 0.08);
      g.add(panel);
      const panel2 = panel.clone();
      panel2.position.y = dh * 0.22;
      g.add(panel2);
    }
    const knob = sphere(0.04, toon(PAL.gold), 8);
    knob.position.set(doorX + dw * 0.08, dh * 0.48, front + 0.1);
    g.add(knob);
    g.userData.door = new THREE.Vector3(doorX, 0, front);
  }
  for (let i = 0; i < nW; i++) {
    const span = w - 0.8;
    let x = nW === 1 ? (door ? w * 0.22 : 0) : -span / 2 + (span / (nW - 1)) * i;
    if (door && Math.abs(x - doorX) < 0.9) x += x >= doorX ? 0.95 : -0.95;
    if (Math.abs(x) > w / 2 - 0.45) continue;
    slots.push(x);
  }
  const winY = upper ? h * 0.7 : Math.min(1.55, h * 0.48);
  for (const x of slots) {
    const ww = 0.72, wh = 0.95;
    const frame = box(ww + 0.22, wh + 0.22, 0.05, trimM);
    frame.position.set(x, winY, front + 0.02);
    g.add(frame);
    const glass = box(ww, wh, 0.04, glassM);
    glass.position.set(x, winY, front + 0.03);
    g.add(glass);
    for (let k = 0; k < 5; k++) {
      const bar = cyl(0.012, 0.012, wh, ironM, 5);
      bar.position.set(x - ww / 2 + (ww / 4) * k, winY, front + 0.09);
      g.add(bar);
    }
    const sill = box(ww + 0.32, 0.07, 0.22, trimM);
    sill.position.set(x, winY - wh / 2 - 0.12, front + 0.1);
    g.add(sill);
    // flower pot with geraniums
    if (r() > 0.25) {
      const pot = cyl(0.11, 0.08, 0.16, toon(PAL.terracotta, { rim: 0 }), 10);
      pot.position.set(x + (r() - 0.5) * 0.3, winY - wh / 2 - 0.0, front + 0.14);
      g.add(pot);
      const fl = sphere(0.13, toon(r() > 0.5 ? '#e0283c' : PAL.rosa), 10);
      fl.scale.y = 0.65;
      fl.position.set(pot.position.x, pot.position.y + 0.13, pot.position.z);
      g.add(fl);
      const leaf = sphere(0.11, toon(PAL.leaf), 8);
      leaf.scale.y = 0.5;
      leaf.position.set(pot.position.x, pot.position.y + 0.08, pot.position.z + 0.03);
      g.add(leaf);
    }
  }
  if (balcony) {
    const bal = box(1.6, 0.08, 0.6, trimM);
    bal.position.set(0, h * 0.62, front + 0.3);
    g.add(bal);
    for (let k = 0; k < 9; k++) {
      const bar = cyl(0.012, 0.012, 0.6, ironM, 5);
      bar.position.set(-0.75 + k * 0.1875, h * 0.62 + 0.32, front + 0.58);
      g.add(bar);
    }
    const rail = box(1.6, 0.04, 0.04, ironM);
    rail.position.set(0, h * 0.62 + 0.62, front + 0.58);
    g.add(rail);
  }
  if (sign) {
    const sg = signBoard(sign.text, sign.bg || PAL.cream, sign.fg || PAL.ink, sign.w || 1.8, sign.h || 0.42);
    sg.position.set(sign.x ?? 0, sign.y ?? h * 0.86, front + 0.04);
    g.add(sg);
  }
  if (bugambilia) g.add(bougainvillea(w, h, front, r));
  return g;
}

export function bougainvillea(w, h, front, r = rng(3)) {
  const g = new THREE.Group();
  const side = r() > 0.5 ? 1 : -1;
  const spots = [];
  for (let i = 0; i < 26; i++) {
    const t = r();
    spots.push([side * (w / 2 - 0.2 - r() * 0.9 * t), h * (0.45 + t * 0.6), front + 0.12 + r() * 0.1, 0.14 + r() * 0.14]);
  }
  const leafM = toon('#3c8d3f', { rim: 0 });
  const flM = toon('#d7198a');
  for (const [x, y, z, s] of spots) {
    const m = sphere(s, r() > 0.35 ? flM : leafM, 8);
    m.position.set(x, y, z);
    m.scale.z = 0.5;
    m.castShadow = false;
    g.add(m);
  }
  return g;
}

export function signBoard(text, bg, fg, w = 1.8, h = 0.42, font = 'Lilita One') {
  const cv = mkCanvas(512, Math.round(512 * (h / w)));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = cv.height * 0.6;
  ctx.font = `${size}px '${font}', 'Arial Black', sans-serif`;
  while (ctx.measureText(text).width > cv.width - 50 && size > 10) {
    size -= 2;
    ctx.font = `${size}px '${font}', 'Arial Black', sans-serif`;
  }
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const m = box(w, h, 0.04, toon('#ffffff', { map: tex(cv), rim: 0 }));
  return m;
}

// The parroquia: twin bell towers, a dome and a cantera-pink facade.
export function church({ color = '#f2b6a0', trim = '#fff1dc' } = {}) {
  const g = new THREE.Group();
  const wallM = toon('#ffffff', { map: plasterTex(color, shade(color, -40), 0.1), rim: 0 });
  const trimM = toon(trim, { rim: 0 });
  const body = box(7, 7, 6, wallM);
  body.position.y = 3.5;
  g.add(body);
  // gable top
  const gable = mesh(new THREE.CylinderGeometry(0.01, 3.7, 1.9, 3, 1), wallM);
  gable.rotation.set(0, 0, 0);
  gable.scale.set(1, 1, 0.3);
  gable.position.set(0, 7.9, 2.8);
  gable.rotation.y = Math.PI / 6;
  g.add(gable);
  for (const sx of [-1, 1]) {
    const tw = new THREE.Group();
    tw.position.set(sx * 4.2, 0, 2);
    const base = box(2.2, 9, 2.2, wallM);
    base.position.y = 4.5;
    tw.add(base);
    const belfry = box(1.9, 2.2, 1.9, wallM);
    belfry.position.y = 10.1;
    tw.add(belfry);
    for (const [ox, oz, ry] of [[0, 0.96, 0], [0.96, 0, Math.PI / 2], [-0.96, 0, Math.PI / 2], [0, -0.96, 0]]) {
      const arch = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16, 1, false, 0, Math.PI), toon('#2a2230', { rim: 0 }), { cast: false });
      arch.rotation.set(Math.PI / 2, ry, 0);
      arch.position.set(ox, 10.3, oz);
      tw.add(arch);
      const hole = box(0.9, 1.0, 0.05, toon('#2a2230', { rim: 0 }));
      hole.rotation.y = ry;
      hole.position.set(ox, 9.8, oz);
      tw.add(hole);
    }
    const bell = lathe([[0.0, 0.4], [0.18, 0.38], [0.24, 0.2], [0.34, 0.0], [0.0, 0.0]], toon(PAL.gold));
    bell.position.set(0, 9.6, 0.6);
    tw.add(bell);
    const cap = mesh(new THREE.SphereGeometry(1.0, 16, 10, 0, TAU, 0, Math.PI / 2), toon('#e9c46a'));
    cap.position.y = 11.2;
    tw.add(cap);
    const lantern = cyl(0.25, 0.3, 0.5, trimM, 8);
    lantern.position.y = 12.4;
    tw.add(lantern);
    const cross = new THREE.Group();
    const v = box(0.08, 0.6, 0.08, toon('#3a3030', { rim: 0 }));
    const hb = box(0.36, 0.08, 0.08, toon('#3a3030', { rim: 0 }));
    hb.position.y = 0.12;
    cross.add(v, hb);
    cross.position.y = 12.95;
    tw.add(cross);
    for (const y of [3.2, 7.6]) {
      const band = box(2.3, 0.18, 2.3, trimM);
      band.position.y = y;
      tw.add(band);
    }
    g.add(tw);
  }
  // dome behind
  const drum = cyl(1.8, 1.8, 1.2, wallM, 20);
  drum.position.set(0, 7.6, -1);
  g.add(drum);
  const dome = mesh(new THREE.SphereGeometry(1.9, 24, 12, 0, TAU, 0, Math.PI / 2), toon('#ffffff', { map: talaveraTex(), rim: 0 }));
  dome.material.map.repeat.set(6, 2);
  dome.position.set(0, 8.2, -1);
  g.add(dome);
  // portal: arched door
  const portal = box(2.4, 3.6, 0.2, trimM);
  portal.position.set(0, 1.8, 3.05);
  g.add(portal);
  const archTop = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.22, 20, 1, false, -Math.PI / 2, Math.PI), trimM);
  archTop.rotation.x = Math.PI / 2;
  archTop.position.set(0, 3.6, 3.05);
  g.add(archTop);
  const doorM = toon('#ffffff', { map: woodTex('#5a3420'), rim: 0 });
  const doorL = box(1.9, 3.0, 0.1, doorM);
  doorL.position.set(0, 1.5, 3.17);
  g.add(doorL);
  const doorArch = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 20, 1, false, -Math.PI / 2, Math.PI), doorM);
  doorArch.rotation.x = Math.PI / 2;
  doorArch.position.set(0, 3.0, 3.17);
  g.add(doorArch);
  // rose window
  const rose = mesh(new THREE.CircleGeometry(0.7, 16), toon('#ffffff', { map: roseTex(), rim: 0 }), { cast: false });
  rose.position.set(0, 5.4, 3.02);
  g.add(rose);
  const roseRing = mesh(new THREE.TorusGeometry(0.75, 0.1, 6, 20), trimM);
  roseRing.position.set(0, 5.4, 3.03);
  g.add(roseRing);
  for (const sx of [-1, 1]) {
    const col = cyl(0.14, 0.16, 3.6, trimM, 10);
    col.position.set(sx * 1.45, 1.8, 3.1);
    g.add(col);
  }
  return g;
}

function roseTex() {
  return cached('rose', () => {
    const cv = mkCanvas(128, 128);
    const ctx = cv.getContext('2d');
    ctx.translate(64, 64);
    const cols = ['#d8293b', '#2357d1', '#ffc21a', '#16b3ac'];
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 64, (i / 12) * TAU, ((i + 1) / 12) * TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3dc';
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos((i / 12) * TAU) * 64, Math.sin((i / 12) * TAU) * 64);
      ctx.stroke();
    }
    return tex(cv);
  });
}

// The kiosco: an octagonal bandstand, the heart of every plaza.
export function kiosco({ roof = '#2e8b57', trim = '#fff3dc', iron = '#2b2b33' } = {}) {
  const g = new THREE.Group();
  const baseM = toon('#ffffff', { map: plasterTex('#f3e3c5', '#c96f4a', 0.4), rim: 0 });
  const base = cyl(2.6, 2.7, 0.8, baseM, 8);
  base.position.y = 0.4;
  g.add(base);
  const floor = cyl(2.65, 2.65, 0.1, toon('#ffffff', { map: tileTex('#e9d3a8', '#d7b98b', 6), rim: 0 }), 8);
  floor.position.y = 0.85;
  g.add(floor);
  const ironM = toon(iron, { rim: 0 });
  const trimM = toon(trim, { rim: 0 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const col = cyl(0.07, 0.07, 2.6, trimM, 8);
    col.position.set(Math.cos(a) * 2.4, 2.2, Math.sin(a) * 2.4);
    g.add(col);
    // railing panel
    const b = (i / 8) * TAU + TAU / 16, c = ((i + 1) / 8) * TAU + TAU / 16;
    if (i === 2) continue; // stairs gap (front)
    const p1 = new THREE.Vector3(Math.cos(b) * 2.4, 1.3, Math.sin(b) * 2.4);
    const p2 = new THREE.Vector3(Math.cos(c) * 2.4, 1.3, Math.sin(c) * 2.4);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const rail = box(p1.distanceTo(p2), 0.06, 0.06, ironM);
    rail.position.copy(mid);
    rail.lookAt(new THREE.Vector3(0, 1.3, 0));
    rail.rotateY(Math.PI / 2);
    g.add(rail);
    for (let k = 1; k < 6; k++) {
      const pb = p1.clone().lerp(p2, k / 6);
      const bar = cyl(0.015, 0.015, 0.45, ironM, 4);
      bar.position.set(pb.x, 1.08, pb.z);
      g.add(bar);
    }
  }
  const roofM = toon(roof);
  const eaves = cyl(2.9, 2.9, 0.18, trimM, 8);
  eaves.position.y = 3.55;
  g.add(eaves);
  const cone = cyl(0.3, 2.85, 1.5, roofM, 8);
  cone.position.y = 4.35;
  g.add(cone);
  const cup = sphere(0.45, roofM, 12);
  cup.position.y = 5.2;
  g.add(cup);
  const fin = cyl(0.03, 0.03, 0.7, toon(PAL.gold), 6);
  fin.position.y = 5.8;
  g.add(fin);
  const ball = sphere(0.09, toon(PAL.gold), 8);
  ball.position.y = 6.15;
  g.add(ball);
  // stairs at the front (+z)
  for (let k = 0; k < 4; k++) {
    const st = box(1.4, 0.2, 0.32, baseM);
    st.position.set(0, 0.1 + k * 0.2, 2.95 - k * 0.3);
    g.add(st);
  }
  return g;
}

export function tree({ kind = 'laurel', h = 3, seed = 1 } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  const trunkM = toon('#7a5236', { rim: 0 });
  if (kind === 'palm') {
    const trunk = cyl(0.12, 0.18, h, trunkM, 8);
    trunk.position.y = h / 2;
    trunk.rotation.z = 0.06;
    g.add(trunk);
    for (let i = 0; i < 8; i++) {
      const leaf = sphere(0.7, toon('#3f9447', { rim: 0 }), 8);
      leaf.scale.set(1, 0.08, 0.25);
      leaf.position.set(Math.cos((i / 8) * TAU) * 0.7, h + 0.05, Math.sin((i / 8) * TAU) * 0.7);
      leaf.rotation.y = -(i / 8) * TAU;
      leaf.rotation.z = -0.4;
      g.add(leaf);
    }
    return g;
  }
  if (kind === 'cypress') {
    const trunk = cyl(0.1, 0.14, 0.6, trunkM, 6);
    trunk.position.y = 0.3;
    g.add(trunk);
    const c = sphere(0.8, toon('#2f6b3a', { rim: 0 }), 12);
    c.scale.set(0.7, 2.4, 0.7);
    c.position.y = h * 0.62;
    g.add(c);
    return g;
  }
  const trunk = cyl(0.14, 0.22, h * 0.45, trunkM, 8);
  trunk.position.y = h * 0.22;
  g.add(trunk);
  const leaf = kind === 'jacaranda' ? toon('#9b6fd6') : toon('#3e8a45');
  const leaf2 = kind === 'jacaranda' ? toon('#b98ae6') : toon('#4fa053');
  for (let i = 0; i < 7; i++) {
    const s = sphere(0.6 + r() * 0.5, i % 2 ? leaf : leaf2, 12);
    s.position.set((r() - 0.5) * 1.4, h * 0.6 + r() * h * 0.35, (r() - 0.5) * 1.2);
    g.add(s);
  }
  return g;
}

export function lamp({ h = 2.6, color = '#2b2b33', lit = false } = {}) {
  const g = new THREE.Group();
  const m = toon(color, { rim: 0 });
  const post = cyl(0.05, 0.08, h, m, 8);
  post.position.y = h / 2;
  g.add(post);
  const base = cyl(0.14, 0.18, 0.3, m, 8);
  base.position.y = 0.15;
  g.add(base);
  const head = cyl(0.16, 0.08, 0.36, flat(lit ? '#ffe2a0' : '#d9e6ee'), 6);
  head.position.y = h + 0.12;
  g.add(head);
  const cap = mesh(new THREE.ConeGeometry(0.22, 0.2, 6), m);
  cap.position.y = h + 0.4;
  g.add(cap);
  if (lit) {
    const gl = glowSprite('#ffcf70', 1.4, 0.7);
    gl.position.y = h + 0.12;
    g.add(gl);
  }
  return g;
}

export function bench({ w = 1.6, color = '#2e7d4f' } = {}) {
  const g = new THREE.Group();
  const m = toon(color, { rim: 0 });
  const seat = box(w, 0.08, 0.45, m);
  seat.position.y = 0.45;
  g.add(seat);
  const back = box(w, 0.4, 0.06, m);
  back.position.set(0, 0.75, -0.2);
  back.rotation.x = -0.12;
  g.add(back);
  for (const sx of [-1, 1]) {
    const leg = box(0.08, 0.45, 0.4, toon('#2b2b33', { rim: 0 }));
    leg.position.set(sx * (w / 2 - 0.12), 0.22, 0);
    g.add(leg);
  }
  return g;
}

// market stall with a stretched lona (tarp) overhead
export function stall({ w = 2.4, d = 1.3, tarp = PAL.rosa, table = '#b98b5e', h = 2.3, stripes = null } = {}) {
  const g = new THREE.Group();
  const poleM = toon('#8d8a85', { rim: 0 });
  for (const [x, z] of [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]]) {
    const p = cyl(0.03, 0.03, h + (z < 0 ? 0.25 : 0), poleM, 6);
    p.position.set(x, (h + (z < 0 ? 0.25 : 0)) / 2, z);
    g.add(p);
  }
  // sagging tarp
  const geo = new THREE.PlaneGeometry(w + 0.5, d + 0.6, 8, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, -Math.cos((x / (w + 0.5)) * Math.PI) * 0.08 - Math.cos((y / (d + 0.6)) * Math.PI) * 0.05);
  }
  geo.computeVertexNormals();
  let tarpM;
  if (stripes) {
    const cv = mkCanvas(64, 64);
    const ctx = cv.getContext('2d');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? stripes : tarp;
      ctx.fillRect(i * 8, 0, 8, 64);
    }
    tarpM = toon('#ffffff', { map: tex(cv), side: THREE.DoubleSide, rim: 0 });
  } else {
    tarpM = toon(tarp, { side: THREE.DoubleSide, rim: 0 });
  }
  const t = mesh(geo, tarpM);
  t.rotation.x = -Math.PI / 2 - 0.1;
  t.position.y = h + 0.12;
  g.add(t);
  const top = box(w, 0.08, d * 0.75, toon('#ffffff', { map: woodTex(table), rim: 0 }));
  top.position.set(0, 0.85, d * 0.1);
  g.add(top);
  const skirt = box(w, 0.75, 0.04, toon(shade(tarp, -10), { rim: 0 }));
  skirt.position.set(0, 0.45, d * 0.1 + d * 0.375);
  g.add(skirt);
  g.userData.tableY = 0.89;
  g.userData.tableZ = d * 0.1;
  return g;
}

export function crate(w = 0.5, h = 0.3, d = 0.4, color = '#c79a62') {
  const g = new THREE.Group();
  const m = toon('#ffffff', { map: woodTex(color), rim: 0 });
  const b = box(w, h, d, m);
  b.position.y = h / 2;
  g.add(b);
  return g;
}

export function bucket(r = 0.2, h = 0.35, color = '#4a8fc9') {
  const m = toon(color);
  const b = cyl(r, r * 0.8, h, m, 14, false);
  b.position.y = h / 2;
  const g = new THREE.Group();
  g.add(b);
  return g;
}

export function basket(r = 0.25, h = 0.18) {
  const g = new THREE.Group();
  const cv = mkCanvas(64, 32);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c9a063';
  ctx.fillRect(0, 0, 64, 32);
  ctx.strokeStyle = '#9b7442';
  ctx.lineWidth = 2;
  for (let x = 0; x < 64; x += 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 3, 32); ctx.stroke(); }
  for (let y = 0; y < 32; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke(); }
  const m = toon('#ffffff', { map: tex(cv, { repeat: [3, 1] }), rim: 0 });
  const b = mesh(new THREE.CylinderGeometry(r, r * 0.75, h, 18, 1, true), m);
  b.material.side = THREE.DoubleSide;
  b.position.y = h / 2;
  g.add(b);
  const bottom = cyl(r * 0.75, r * 0.75, 0.02, m, 18);
  bottom.position.y = 0.01;
  g.add(bottom);
  return g;
}

// ------------------------------------------------------------------ merge
// Merge static meshes under root by material: fewer draw calls. Skips anything
// flagged dynamic / hotspot / instanced / transparent sprites.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    let p = o;
    while (p && p !== root) {
      if (p.userData.dynamic || p.userData.hotspot) return;
      p = p.parent;
    }
    if (o.userData.isOutlineHull || Array.isArray(o.material) || o.material.transparent || !o.visible) return;
    const g = o.geometry;
    if (!g.attributes.normal || !g.attributes.uv || g.morphAttributes?.position) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
    groups.get(key).list.push(o);
    victims.push(o);
  });
  let merged = 0;
  for (const { mat, cast, recv, list } of groups.values()) {
    if (list.length < 2) continue;
    let vCount = 0, iCount = 0;
    for (const o of list) {
      vCount += o.geometry.attributes.position.count;
      iCount += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    }
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
    const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
    let vo = 0, io = 0;
    const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
    for (const o of list) {
      const g = o.geometry;
      m4.multiplyMatrices(inv, o.matrixWorld);
      n3.getNormalMatrix(m4);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m4);
        pos.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(N, i).applyMatrix3(n3).normalize();
        nor.set([v.x, v.y, v.z], (vo + i) * 3);
        uv.set([U.getX(i), U.getY(i)], (vo + i) * 2);
      }
      if (g.index) {
        for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
        io += g.index.count;
      } else {
        for (let i = 0; i < P.count; i++) idx[io + i] = vo + i;
        io += P.count;
      }
      vo += P.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const mm = new THREE.Mesh(geo, mat);
    mm.castShadow = cast;
    mm.receiveShadow = recv;
    mm.userData.merged = true;
    root.add(mm);
    for (const o of list) {
      // keep outline hulls of merged meshes? (architecture has none) — drop the mesh
      o.parent?.remove(o);
      if (!o.geometry.userData.sharedGeo) o.geometry.dispose();
    }
    merged += list.length;
  }
  return merged;
}
