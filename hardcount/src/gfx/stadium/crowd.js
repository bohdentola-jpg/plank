// The crowd: one instanced quad per fan (2 triangles), cylindrically
// billboarded, drawn from a mask atlas (R = shirt, G = skin, B = accent,
// the rest of the coverage = hair/pants) so every fan gets their own team
// colours, skin and hair. Eight looks × four poses (seated, standing and
// clapping, arms up, hands on head). The vertex shader picks the pose from
// per-group state (home, away, students, band) driven by excitement and
// reactions, and bounces / jumps / sways them. Camera flashes on top.
import * as THREE from 'three';
import { makeRng } from '../../core/util.js';
import { cv } from './tex.js';

export const GROUP = { home: 0, away: 1, student: 2, band: 3 };
const COLS = 8, ROWS = 4;
const CELL_W = 1.1, CELL_H = 2.2;   // yards

// ------------------------------------------------------------------ atlas

const SHIRT = '#ff0000', SKIN = '#00ff00', ACC = '#0000ff', DARK = '#000000';

function ell(x, cx, cy, rx, ry, col) { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); }
function limb(x, ax, ay, bx, by, w, col) {
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
}
function poly(x, pts, col) {
  x.fillStyle = col; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath(); x.fill();
}

/** Pose skeleton in cell yards (origin bottom centre, y up). */
function skeleton(pose) {
  const seated = pose === 0;
  const hip = seated ? 0.5 : 0.95, sh = seated ? 1.12 : 1.55, head = sh + 0.2;
  let arms;
  if (pose === 0) arms = { el: [0.27, hip + 0.28], ha: [0.14, hip + 0.06] };
  else if (pose === 1) arms = { el: [0.3, sh - 0.3], ha: [0.05, sh - 0.12] };
  else if (pose === 2) arms = { el: [0.34, sh + 0.3], ha: [0.42, sh + 0.58] };
  else arms = { el: [0.38, sh + 0.2], ha: [0.09, head + 0.12] };
  return { seated, hip, sh, head, ...arms };
}

function drawFigure(x, v, pose) {
  const S = skeleton(pose);
  const sleeves = v === 3 || v === 5 || v === 7 ? 'long' : 'short';
  const torsoW = v === 3 ? 0.27 : v === 1 ? 0.2 : 0.235;
  // ---- legs
  if (S.seated) {
    for (const s of [-1, 1]) {
      poly(x, [[s * 0.03, 0.42], [s * 0.2, 0.42], [s * 0.2, 0.56], [s * 0.03, 0.56]], DARK);
      limb(x, s * 0.12, 0.45, s * 0.12, 0.02, 0.11, DARK);
    }
  } else {
    for (const s of [-1, 1]) limb(x, s * 0.1, S.hip, s * 0.12, 0.02, 0.13, DARK);
    poly(x, [[-0.2, S.hip - 0.05], [0.2, S.hip - 0.05], [0.17, S.hip + 0.08], [-0.17, S.hip + 0.08]], DARK);
  }
  // ---- long hair / hood behind the head
  if (v === 1) poly(x, [[-0.15, S.head + 0.08], [0.15, S.head + 0.08], [0.17, S.sh - 0.12], [-0.17, S.sh - 0.12]], DARK);
  if (v === 5) ell(x, 0, S.head - 0.01, 0.17, 0.19, SHIRT);
  // ---- torso
  poly(x, [[-torsoW, S.sh], [torsoW, S.sh], [torsoW - 0.04, S.hip + 0.02], [-(torsoW - 0.04), S.hip + 0.02]], SHIRT);
  ell(x, -torsoW + 0.02, S.sh - 0.02, 0.06, 0.05, SHIRT);
  ell(x, torsoW - 0.02, S.sh - 0.02, 0.06, 0.05, SHIRT);
  if (v === 4) {
    // jersey: number + shoulder stripes
    x.fillStyle = ACC;
    const ny = S.sh - 0.2, nh = 0.2;
    for (const [dx, d] of [[-0.075, 1], [0.075, 7]]) {
      x.fillRect(dx - 0.045, ny - nh, 0.025, nh);
      x.fillRect(dx - 0.045, ny - 0.025, 0.08, 0.025);
      if (d === 7) { x.fillRect(dx + 0.01, ny - nh, 0.025, nh); }
      x.fillRect(dx - 0.045, ny - nh, 0.08, 0.025);
    }
  }
  if (v === 3) poly(x, [[-0.13, S.sh + 0.01], [0.13, S.sh + 0.01], [0.1, S.sh - 0.08], [-0.1, S.sh - 0.08]], ACC); // scarf
  if (v === 7) { limb(x, -0.2, S.sh - 0.02, 0.18, S.hip + 0.05, 0.05, ACC); limb(x, 0.2, S.sh - 0.02, -0.18, S.hip + 0.05, 0.05, ACC); }
  if (v === 5) { limb(x, -0.03, S.sh - 0.02, -0.035, S.sh - 0.16, 0.012, ACC); limb(x, 0.03, S.sh - 0.02, 0.035, S.sh - 0.16, 0.012, ACC); }
  // ---- arms
  for (const s of [-1, 1]) {
    const shx = s * (torsoW - 0.01), shy = S.sh - 0.04;
    const ex = s * S.el[0], ey = S.el[1];
    const hx = s * S.ha[0], hy = S.ha[1];
    limb(x, shx, shy, ex, ey, 0.105, SHIRT);
    if (sleeves === 'short') {
      // short sleeve: shirt to mid upper arm, skin beyond
      const mx = shx + (ex - shx) * 0.45, my = shy + (ey - shy) * 0.45;
      limb(x, mx, my, ex, ey, 0.085, SKIN);
      limb(x, ex, ey, hx, hy, 0.08, SKIN);
      if (v === 4) limb(x, shx + (ex - shx) * 0.3, shy + (ey - shy) * 0.3, shx + (ex - shx) * 0.4, shy + (ey - shy) * 0.4, 0.11, ACC);
    } else {
      limb(x, ex, ey, hx, hy, 0.095, SHIRT);
    }
    ell(x, hx, hy, 0.045, 0.05, v === 3 ? ACC : SKIN); // hands (mittens in winter)
  }
  // ---- head
  limb(x, 0, S.sh - 0.02, 0, S.head - 0.08, 0.08, SKIN);
  ell(x, 0, S.head, 0.105, 0.128, SKIN);
  // hair / hats
  if (v === 0 || v === 4 || v === 6) poly(x, [[-0.11, S.head + 0.02], [-0.1, S.head + 0.1], [0, S.head + 0.14], [0.1, S.head + 0.1], [0.11, S.head + 0.02], [0, S.head + 0.07]], DARK);
  if (v === 1) { ell(x, 0, S.head + 0.06, 0.12, 0.09, DARK); }
  if (v === 2) { ell(x, 0, S.head + 0.06, 0.115, 0.085, ACC); poly(x, [[-0.13, S.head + 0.03], [0.13, S.head + 0.03], [0.14, S.head + 0.0], [-0.14, S.head + 0.0]], ACC); }
  if (v === 3) { ell(x, 0, S.head + 0.07, 0.118, 0.095, ACC); ell(x, 0, S.head + 0.18, 0.035, 0.035, SHIRT); x.fillStyle = SHIRT; x.fillRect(-0.12, S.head + 0.02, 0.24, 0.03); }
  if (v === 5) ell(x, 0, S.head + 0.07, 0.11, 0.07, DARK);
  if (v === 7) {
    // shako + plume
    poly(x, [[-0.1, S.head + 0.04], [0.1, S.head + 0.04], [0.09, S.head + 0.3], [-0.09, S.head + 0.3]], SHIRT);
    x.fillStyle = ACC; x.fillRect(-0.1, S.head + 0.04, 0.2, 0.035);
    poly(x, [[-0.03, S.head + 0.3], [0.03, S.head + 0.3], [0.02, S.head + 0.46], [-0.02, S.head + 0.46]], ACC);
  }
  // shading: darker toward the bottom and one side (blends toward the hair/pants colour)
  x.save();
  x.globalCompositeOperation = 'source-atop';
  const g = x.createLinearGradient(0, S.sh + 0.1, 0, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  x.fillStyle = g;
  x.fillRect(-0.6, 0, 1.2, 2.2);
  const g2 = x.createLinearGradient(-0.3, 0, 0.3, 0);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,0.18)');
  x.fillStyle = g2;
  x.fillRect(-0.6, 0, 1.2, 2.2);
  x.restore();
  // ---- props (after shading so they stay bright)
  if (v === 6 && pose !== 3 && pose !== 0) {
    const top = pose === 2;
    const cy = top ? S.ha[1] + 0.05 : S.sh - 0.05;
    poly(x, [[-0.34, cy - 0.17], [0.34, cy - 0.17], [0.34, cy + 0.17], [-0.34, cy + 0.17]], ACC);
    x.fillStyle = 'rgba(0,0,0,0.85)';
    for (let k = 0; k < 4; k++) x.fillRect(-0.27 + k * 0.14, cy - 0.06, 0.09, 0.13);
  }
  if (v === 7 && pose !== 0) {
    // horn up at the mouth
    const by = S.head - 0.04;
    limb(x, 0, by, 0.0, by - 0.02, 0.05, ACC);
    poly(x, [[-0.02, by - 0.05], [0.02, by - 0.05], [0.09, by - 0.2], [-0.09, by - 0.2]], ACC);
  }
}

let atlasCache = null;
export function crowdAtlas(size = 1024) {
  if (atlasCache && atlasCache.image.width === size) return atlasCache;
  const [c, x] = cv(size, size);
  x.clearRect(0, 0, size, size);
  const cw = size / COLS, ch = size / ROWS, k = cw / CELL_W;
  for (let r = 0; r < ROWS; r++) {
    for (let v = 0; v < COLS; v++) {
      x.save();
      x.beginPath();
      x.rect(v * cw, r * ch, cw, ch);
      x.clip();
      x.translate(v * cw + cw / 2, r * ch + ch);
      x.scale(k, -k);
      drawFigure(x, v, r);
      x.restore();
    }
  }
  const src = x.getImageData(0, 0, size, size).data;
  const out = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const rowIn = j * size * 4, rowOut = (size - 1 - j) * size * 4;
    for (let i = 0; i < size * 4; i += 4) {
      const a = src[rowIn + i + 3];
      const f = a / 255;
      out[rowOut + i] = src[rowIn + i] * f;
      out[rowOut + i + 1] = src[rowIn + i + 1] * f;
      out[rowOut + i + 2] = src[rowIn + i + 2] * f;
      out[rowOut + i + 3] = a;
    }
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  atlasCache = t;
  return t;
}

// ------------------------------------------------------------------ shader

const VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec3 aPos;
  attribute vec4 aInfo;     // seed, variant, group, light
  attribute vec3 aShirt;
  attribute vec3 aAccent;
  attribute vec3 aSkin;
  uniform float uTime;
  uniform vec4 uG[4];       // stand, jump, arms up, hands on head
  uniform vec4 uG2[4];      // beat, sway, 0, 0
  uniform vec2 uCell;
  uniform vec3 uKey, uAmb;
  varying vec2 vUv;
  varying vec3 vShirt, vAccent, vSkin, vHair, vLight;
  #include <fog_pars_vertex>
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float seed = aInfo.x;
    int grp = int(aInfo.z + 0.5);
    vec4 g = uG[0]; vec4 g2 = uG2[0];
    if (grp == 1) { g = uG[1]; g2 = uG2[1]; }
    else if (grp == 2) { g = uG[2]; g2 = uG2[2]; }
    else if (grp == 3) { g = uG[3]; g2 = uG2[3]; }
    float r1 = hash(seed * 91.7 + 1.3), r2 = hash(seed * 37.1 + 7.9), r3 = hash(seed * 13.3 + 3.1), r4 = hash(seed * 57.9 + 11.0);
    float slot = floor(uTime * 0.11 + r4 * 10.0);
    float fid = step(0.965, hash(slot * 1.31 + seed * 17.0));
    float standing = max(step(r1, g.x), fid);
    float arms = step(r2, g.z) * standing;
    float head = step(r3, g.w) * standing * (1.0 - arms);
    float pose = arms > 0.5 ? 2.0 : (head > 0.5 ? 3.0 : standing);
    // clap: standing fans flick between hands-together and arms-up when it's loud
    float clap = step(0.5, fract(uTime * 2.2 + r4)) * step(r4, g.z * 0.6) * standing;
    if (pose == 1.0 && clap > 0.5) pose = 2.0;
    float jump = g.y * standing * (0.55 + 0.45 * r2) * abs(sin(uTime * (4.6 + 2.2 * r3) + seed * 40.0)) * 0.32;
    float beat = g2.x * pow(abs(sin(uTime * 3.4 + r1 * 0.5)), 4.0) * 0.1;
    float sway = sin(uTime * (1.1 + r2) + seed * 20.0) * 0.035 * g2.y;
    vec3 toCam = cameraPosition - aPos;
    vec2 f = normalize(toCam.xz + vec2(1e-4, 0.0));
    vec3 right = vec3(f.y, 0.0, -f.x);
    float sc = 0.9 + 0.18 * r4;
    vec3 wp = aPos + right * (corner.x * uCell.x * sc + sway) + vec3(0.0, corner.y * uCell.y * sc + jump + beat, 0.0);
    vUv = vec2((aInfo.y + corner.x + 0.5) / 8.0, 1.0 - (pose + 1.0 - corner.y) / 4.0);
    vShirt = aShirt; vAccent = aAccent; vSkin = aSkin;
    float hr = hash(seed * 3.7 + 0.5);
    vHair = hr < 0.45 ? vec3(0.025, 0.02, 0.018) : hr < 0.75 ? vec3(0.09, 0.05, 0.025) : hr < 0.9 ? vec3(0.35, 0.24, 0.1) : vec3(0.3, 0.3, 0.3);
    vLight = uAmb + uKey * aInfo.w;
    vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */`
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying vec3 vShirt, vAccent, vSkin, vHair, vLight;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(uAtlas, vUv);
    float a = clamp((t.a - 0.42) / max(fwidth(t.a), 1e-4) + 0.5, 0.0, 1.0);
    if (a < 0.04) discard;
    float dark = max(t.a - t.r - t.g - t.b, 0.0);
    vec3 c = (vShirt * t.r + vSkin * t.g + vAccent * t.b + vHair * dark) / max(t.a, 1e-3);
    gl_FragColor = vec4(c * vLight, a);
    #include <fog_fragment>
  }`;

// ------------------------------------------------------------------ palettes

const SKINS = ['#f2c7a6', '#e0ab84', '#c68b62', '#9c6a46', '#6e4630', '#4a2e20', '#f6d4bc'];
const CIVVIES = ['#1d2a44', '#3a3e46', '#14161a', '#e8e8e4', '#7a1c1c', '#2a4a7a', '#3a5a3a', '#6a6a70', '#c8b89a', '#4a2a5a', '#8a3a1a', '#d8d0c0'];
const PONCHO = ['#e8eef0', '#f0e060', '#d0dce6', '#9ad0f0'];

function pick(rng, list) { return list[(rng() * list.length) | 0]; }

/**
 * Build the crowd from seats.
 * seats: [{ p: Vector3 (feet on the tread), group: 'home'|'away'|'student'|'band', light 0..1, want 0..1 (fill priority), sec }]
 * opts: { home, away, crowd 0..1, quality, cold, wet, atmos, venueId }
 */
export function buildCrowd(seats, opts) {
  const rng = makeRng('crowd' + (opts.venueId || ''));
  const att = opts.crowd ?? 0.85;
  const low = opts.quality === 'low';
  const home = opts.home, away = opts.away;
  const chosen = [];
  for (const s of seats) {
    const want = s.want ?? 0.5;
    let p = s.group === 'student' || s.group === 'band' ? Math.min(1, att * 1.5) : att * (0.45 + 0.95 * want);
    if (att >= 0.97) p = 0.985;
    if (rng() < p && (!low || rng() < 0.6)) chosen.push(s);
  }
  const n = chosen.length;
  const pos = new Float32Array(n * 3), info = new Float32Array(n * 4);
  const shirt = new Uint8Array(n * 3), accent = new Uint8Array(n * 3), skin = new Uint8Array(n * 3);
  const col = new THREE.Color();
  const put = (arr, i, hex) => { col.set(hex); arr[i * 3] = Math.round(col.r * 255); arr[i * 3 + 1] = Math.round(col.g * 255); arr[i * 3 + 2] = Math.round(col.b * 255); };
  const flashSpots = [];
  chosen.forEach((s, i) => {
    pos[i * 3] = s.p.x; pos[i * 3 + 1] = s.p.y; pos[i * 3 + 2] = s.p.z;
    const g = GROUP[s.group] ?? 0;
    const team = g === 1 ? away : home;
    const C = team.colors;
    let v, sh, ac;
    if (g === 3) {
      v = 7; sh = s.sec % 3 === 0 ? '#f2f2ee' : C.primary; ac = C.secondary === '#ffffff' ? '#e8c24a' : C.secondary;
    } else {
      const r = rng();
      if (g === 2) {
        v = pick(rng, [0, 0, 1, 1, 4, 4, 6, 2, 5]);
        sh = (s.sec ?? 0) % 2 ? C.primary : (C.accent || '#ffffff');
        if (rng() < 0.12) sh = C.secondary;
      } else {
        v = opts.cold ? pick(rng, [3, 3, 3, 5, 5, 2, 4, 1]) : pick(rng, [0, 0, 1, 1, 2, 4, 4, 5, 6]);
        if (r < 0.55) sh = C.primary;
        else if (r < 0.7) sh = C.secondary;
        else if (r < 0.77) sh = C.accent || '#ffffff';
        else sh = pick(rng, CIVVIES);
      }
      ac = sh === C.primary ? C.secondary : sh === C.secondary ? C.primary : pick(rng, [C.primary, C.secondary, '#ffffff', '#1a1a1a']);
      if (opts.wet && rng() < 0.3 && g !== 2) { sh = pick(rng, PONCHO); v = 5; }
    }
    info[i * 4] = rng();
    info[i * 4 + 1] = v;
    info[i * 4 + 2] = g;
    info[i * 4 + 3] = s.light ?? 1;
    put(shirt, i, sh);
    put(accent, i, ac);
    put(skin, i, pick(rng, SKINS));
    if (i % 7 === 0) flashSpots.push(new THREE.Vector3(s.p.x, s.p.y + 1.5, s.p.z));
  });
  const base = new THREE.InstancedBufferGeometry();
  base.setAttribute('corner', new THREE.Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  base.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  base.setIndex([0, 1, 2, 0, 2, 3]);
  base.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  base.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  base.setAttribute('aShirt', new THREE.InstancedBufferAttribute(shirt, 3, true));
  base.setAttribute('aAccent', new THREE.InstancedBufferAttribute(accent, 3, true));
  base.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3, true));
  base.instanceCount = n;
  const A = opts.atmos;
  // match the standard materials: direct ≈ I/π, ambient from the hemisphere
  const key = (A.key.i / Math.PI) * (A.night ? 0.95 : A.dusk ? 0.75 : A.dome ? 0.9 : 0.85);
  const amb = A.hemi[2] * (A.night ? 0.34 : 0.36) + (A.spill || 0) * 0.8;
  const tint = A.night ? [0.92, 0.96, 1.05] : A.dusk ? [1.05, 0.92, 0.85] : [1, 1, 1];
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uAtlas: { value: null }, uTime: { value: 0 },
    uG: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uG2: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uCell: { value: new THREE.Vector2(CELL_W, CELL_H) },
    uKey: { value: new THREE.Vector3(...tint.map((v) => v * key)) },
    uAmb: { value: new THREE.Vector3(...tint.map((v) => v * amb)) },
  }]);
  uniforms.uAtlas.value = crowdAtlas(low ? 512 : 1024);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, fog: true,
    alphaToCoverage: true, transparent: false,
  });
  const mesh = new THREE.Mesh(base, mat);
  mesh.frustumCulled = false;
  mesh.name = 'crowd';
  const state = new CrowdState(uniforms);
  return { mesh, count: n, flashSpots, state };
}

// ------------------------------------------------------------------ behaviour

const REACT_DUR = { cheer: 2.6, roar: 4.5, boo: 3.2, groan: 2.4, tension: 1.2 };

class CrowdState {
  constructor(u) {
    this.u = u;
    this.exc = 0.25;
    this.react = null;
    this.rt = 0;
    this.cur = [0, 1, 2, 3].map(() => [0.05, 0, 0, 0, 0, 0.3]);
  }
  update(dt, st) {
    const exc = Math.max(0, Math.min(1, st.excitement ?? 0.3));
    this.exc += (exc - this.exc) * Math.min(1, dt * 2.5);
    const r = st.reaction || null;
    if (r && REACT_DUR[r]) {
      if (!this.react || this.react.kind !== r) this.react = { kind: r, t: 0 };
      this.react.alive = true;
      this.react.hold = REACT_DUR[r];
    }
    let env = 0;
    if (this.react) {
      const R = this.react;
      R.t += dt;
      if (!R.alive) R.hold -= dt;
      R.alive = false;
      env = Math.min(1, R.t / 0.25) * Math.min(1, Math.max(0, R.hold) / 0.9);
      if (R.hold <= 0) this.react = null;
    }
    const kind = this.react?.kind;
    for (let g = 0; g < 4; g++) {
      const base = this.base(g, this.exc, st.homeHasBall);
      let tgt = base;
      if (kind && env > 0) {
        const rk = this.reactTargets(g, kind, base);
        tgt = base.map((v, i) => v + (rk[i] - v) * env);
      }
      const c = this.cur[g];
      const k = Math.min(1, dt * 3.5);
      for (let i = 0; i < 6; i++) c[i] += (tgt[i] - c[i]) * k;
      this.u.uG.value[g].set(c[0], c[1], c[2], c[3]);
      this.u.uG2.value[g].set(c[4], c[5], 0, 0);
    }
    this.u.uTime.value = st.time;
  }
  base(g, e, homeHasBall) {
    let stand = 0.03 + 0.5 * Math.pow(e, 1.5), jump = 0, arms = e > 0.75 ? (e - 0.75) * 0.5 : 0, head = 0, beat = 0, sway = 0.3 + 0.7 * e;
    if (g === 0 && homeHasBall === false && e > 0.4) stand = Math.max(stand, 0.35 + (e - 0.4));
    if (g === 1) stand *= 0.7;
    if (g === 2) { stand = Math.max(0.9, stand); jump = 0.12 + 0.45 * e; beat = 0.5; arms = Math.max(arms, 0.08 + 0.3 * e); }
    if (g === 3) { stand = 0.08 + 0.3 * e; beat = 1; arms = 0; }
    return [stand, jump, arms, head, beat, sway];
  }
  reactTargets(g, kind, b) {
    let k = kind;
    if (g === 1) k = kind === 'cheer' || kind === 'roar' ? 'groan' : kind === 'groan' || kind === 'boo' ? 'cheer' : kind;
    if (g === 3) {
      if (k === 'roar' || k === 'cheer') return [0.95, 0.15, 0, 0, 1, 1];
      return [b[0], 0, 0, 0, 0.6, 0.4];
    }
    switch (k) {
      case 'roar': return [1, 1, 0.75, 0, b[4], 1];
      case 'cheer': return [0.88, 0.4, 0.4, 0, b[4], 0.9];
      case 'groan': return [Math.max(b[0] * 0.5, 0.22), 0, 0, 0.5, 0, 0.2];
      case 'boo': return [Math.max(b[0], 0.6), 0.05, 0.12, 0, 0, 0.6];
      case 'tension': return [Math.max(b[0], 0.72), 0, 0.02, 0.06, 0, 0.1];
      default: return b;
    }
  }
}

// ------------------------------------------------------------------ flashes

const FLASH_VERT = /* glsl */`
  attribute vec3 aCenter;
  attribute vec2 aCorner;
  attribute float aBirth;
  uniform float uTime;
  varying vec2 vUv;
  varying float vI;
  void main() {
    vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
    float age = uTime - aBirth;
    vI = age >= 0.0 ? exp(-age * 28.0) : 0.0;
    mv.xy += aCorner * (1.4 + 2.0 * vI);
    vUv = aCorner + 0.5;
    gl_Position = projectionMatrix * mv;
  }`;
const FLASH_FRAG = /* glsl */`
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vI;
  void main() {
    float g = texture2D(map, vUv).r;
    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * g * vI * 26.0, 1.0);
  }`;

export function buildFlashes(spots, glowMap) {
  const N = 48;
  const center = new Float32Array(N * 12), corner = new Float32Array(N * 8), birth = new Float32Array(N * 4).fill(-99);
  const idx = [];
  const cs = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 4; k++) corner.set(cs[k], (i * 4 + k) * 2);
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 12), 3));
  const aC = new THREE.BufferAttribute(center, 3); aC.setUsage(THREE.DynamicDrawUsage);
  const aB = new THREE.BufferAttribute(birth, 1); aB.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aCenter', aC);
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setAttribute('aBirth', aB);
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: FLASH_VERT, fragmentShader: FLASH_FRAG,
    uniforms: { map: { value: glowMap }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.name = 'flashes';
  let head = 0, acc = 0;
  const rng = makeRng('flash');
  return {
    mesh,
    rate: 0,
    update(dt, t) {
      mat.uniforms.uTime.value = t;
      if (!spots.length || this.rate <= 0) return;
      acc += dt * this.rate;
      let dirty = false;
      while (acc >= 1) {
        acc -= 1;
        const p = spots[(rng() * spots.length) | 0];
        for (let k = 0; k < 4; k++) {
          center.set([p.x, p.y, p.z], ((head * 4) + k) * 3);
          birth[head * 4 + k] = t + rng() * 0.05;
        }
        head = (head + 1) % N;
        dirty = true;
      }
      if (dirty) { aC.needsUpdate = true; aB.needsUpdate = true; }
    },
  };
}
