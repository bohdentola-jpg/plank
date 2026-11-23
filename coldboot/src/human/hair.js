// Hair grown from the scalp as fur shells: N offset copies of the scalp
// surface, each drawing the cross-sections of strands that reach that high.
// Strands live in 3D cells on the rest face coordinates (so they stay put on
// the skin), lean along a comb direction, taper, darken at the root, and fade
// into dithered coverage (alpha to coverage) once a strand is under a pixel.
// The result is attached rigidly to the head bone.
import * as THREE from 'three';

const HAIR_VERT_PARS = /* glsl */`
attribute float aT;
attribute vec3 aRest;
attribute float aLen;
varying float vT;
varying vec3 vRest;
varying float vLen;
`;
const HAIR_FRAG_PARS = /* glsl */`
varying float vT;
varying vec3 vRest;
varying float vLen;
uniform float uDensity;
uniform float uCell;
uniform vec3 uTip;
uniform float uCurl;
float hh(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
`;

function hairMaterial(color, opts = {}) {
  const base = new THREE.Color(color);
  const mat = new THREE.MeshPhysicalMaterial({
    color: base, roughness: opts.roughness ?? 0.5, metalness: 0,
    sheen: 0.8, sheenRoughness: 0.45, sheenColor: base.clone().lerp(new THREE.Color(1, 0.95, 0.85), 0.35),
    specularIntensity: 0.45, alphaToCoverage: true, side: THREE.DoubleSide,
  });
  const uniforms = {
    uDensity: { value: opts.density ?? 1 },
    uCell: { value: opts.cell ?? 32 },
    uTip: { value: base.clone().lerp(new THREE.Color(1, 0.92, 0.8), opts.tipLighten ?? 0.18) },
    uCurl: { value: opts.curl ?? 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + HAIR_VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvT = aT; vRest = aRest; vLen = aLen;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HAIR_FRAG_PARS)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 p = vRest * uCell;
        p += vec3(sin(vRest.y * 40.0), cos(vRest.x * 37.0), sin(vRest.z * 31.0)) * uCurl * vT;
        vec3 c = floor(p);
        vec3 fr = fract(p) - 0.5;
        float r1 = hh(c), r2 = hh(c + 17.0), r3 = hh(c + 31.0);
        fr -= (vec3(r1, r2, r3) - 0.5) * 0.5;
        float slen = 0.55 + 0.45 * r2;                 // this strand's length (fraction)
        float alive = step(vT, slen);
        float rad = 0.42 * (1.0 - vT / max(slen, 0.01)) + 0.08;
        float strand = alive * (1.0 - smoothstep(rad * 0.75, rad, length(fr)));
        // statistical coverage once strands are smaller than a pixel
        float px = length(fwidth(p));
        float cover = clamp((1.0 - vT * 0.95) * 0.85, 0.0, 1.0);
        float a = mix(strand, cover, smoothstep(0.35, 0.9, px));
        if (vT < 0.02) a = 1.0;                         // the innermost shell is solid
        a *= uDensity;
        if (a < 0.02) discard;
        diffuseColor.a = a;
        vec3 col = mix(diffuseColor.rgb * 0.55, uTip, smoothstep(0.1, 1.0, vT) * 0.6);
        col *= 0.82 + 0.36 * r1;
        diffuseColor.rgb = col;
      }`)
      .replace('#include <alphatest_fragment>', '');
  };
  mat.customProgramCacheKey = () => 'cb-hair-v1';
  mat.userData.uniforms = uniforms;
  return mat;
}

/** Scalp region (welded) from the head part: base vertex ids + triangles. */
function scalpPatch(hm, pos, nrm, test) {
  const tris = hm.weldedTris.head;
  const keep = [];
  const used = new Map();
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i], b = tris[i + 1], c = tris[i + 2];
    if (test(a) && test(b) && test(c)) {
      for (const v of [a, b, c]) if (!used.has(v)) used.set(v, used.size);
      keep.push(used.get(a), used.get(b), used.get(c));
    }
  }
  const ids = [...used.keys()];
  return { ids, tris: keep };
}

const STYLES = {
  // len in metres; f = face coords (half-eye-distances from between the eyes)
  buzz: { shells: 4, len: () => 0.004, comb: 0.1, scalp: 0.35, cell: 40 },
  short: { shells: 12, len: (f) => 0.012 + 0.012 * sm(f.y, 1.0, 3.5) - 0.004 * sm(-f.z, 1.5, 4.0), comb: 0.6, scalp: 0.25, cell: 30, flowBack: 0.6 },
  swept: { shells: 16, len: (f) => 0.016 + 0.024 * sm(f.y, 1.5, 3.8) * sm(f.z, -3.5, 0.5), comb: 1.0, scalp: 0.2, cell: 30, flowBack: 1.0 },
  messy: { shells: 16, len: (f, r) => 0.022 + 0.02 * r() + 0.01 * sm(f.y, 1.5, 3.5), comb: 0.7, scalp: 0.2, cell: 26, curl: 0.25, flowBack: 0.3 },
  bun: { shells: 12, len: () => 0.008, comb: 1.0, scalp: 0.2, cell: 36, flowBack: 1.2, bun: true },
  bob: { shells: 22, len: (f) => 0.03 + 0.03 * sm(f.y, 0.5, 3.0), comb: 1.4, scalp: 0.2, cell: 30, flowBack: 0.2, drop: 1.0 },
  long: { shells: 22, len: (f) => 0.03 + 0.035 * sm(f.y, 0.5, 3.0), comb: 1.4, scalp: 0.2, cell: 30, flowBack: 0.3, drop: 1.6, curtain: true },
  bald: null,
  headscarf: null,
};
function sm(x, a, b) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/**
 * Where hair grows, 0..1, from face coordinates (units: half the distance
 * between the eyes ≈ 3.1 cm; origin between the eyes; +y up, +z forward).
 * recede: 0 full hairline … 1 receded temples / thinning crown.
 */
export function hairline(f, recede = 0) {
  const ax = Math.abs(f.x);
  // forehead: the line rises toward the temples (M shape when receding)
  const front = 2.25 + 0.55 * recede + (0.18 + 0.9 * recede) * sm(ax, 0.6, 1.6) - 0.35 * sm(ax, 1.7, 2.3);
  const inFront = f.z > -0.9;
  let c;
  if (inFront) c = sm(f.y, front - 0.12, front + 0.18);
  else {
    // sides and back: down to the sideburns, around the ears, to the nape
    const earZone = ax > 2.1 && f.y < 0.75 && f.y > -1.6 && f.z > -2.9;
    if (earZone) c = sm(f.y, 0.45, 0.8) * (1 - sm(f.z, -2.9, -2.5)) + sm(-f.z, 2.55, 2.85);
    else if (f.z > -2.6 && ax > 1.9) c = sm(f.y, -0.55, -0.25); // sideburns ahead of the ear
    else c = sm(f.y, -2.9, -2.5);                                 // back of the head to the nape
    c *= sm(-f.z, -0.95, -0.6) + sm(ax, 1.9, 2.05);
  }
  // only on the head itself (not the face/neck front)
  if (f.y < -3.2) c = 0;
  // thinning crown
  if (recede > 0.6) c *= 1 - sm(recede, 0.6, 1.0) * sm(f.y, 2.6, 3.4) * sm(f.z, -2.5, -0.5);
  return Math.min(1, Math.max(0, c));
}

/**
 * Build the hair for a character. Returns { group, materials } with the
 * group parented to the head bone (rest-pose fitted).
 */
export function buildHair(ch, styleName, color, rng) {
  const hm = ch.hm, pos = ch.pos, nrm = ch.nrm;
  const style = STYLES[styleName];
  const out = { group: new THREE.Group(), materials: [] };
  const headBone = ch.bones.head;
  const inv = headBone.userData.global.clone().invert();
  out.group.matrixAutoUpdate = false;
  out.group.matrix.copy(inv);
  headBone.add(out.group);
  ch.skinMat.userData.uniforms.uScalp.value = styleName === 'bald' ? 0 : styleName === 'headscarf' ? 0 : (style?.scalp ?? 0.25);

  if (styleName === 'headscarf') {
    const m = buildHeadscarf(ch, rng);
    out.group.add(m.mesh);
    out.materials.push(m.material);
    return out;
  }
  if (!style) return out;

  const face = (v) => ({ x: hm.face[v * 3] / 1000, y: hm.face[v * 3 + 1] / 1000, z: hm.face[v * 3 + 2] / 1000 });
  const recede = ch.dna.hair?.recede ?? 0;
  const cover = new Map();
  const scalpOf = (v) => {
    let c = cover.get(v);
    if (c === undefined) { c = hairline(face(v), recede); cover.set(v, c); }
    return c;
  };
  const patch = scalpPatch(hm, pos, nrm, (v) => scalpOf(v) > 0.02);
  const nv = patch.ids.length;
  const N = style.shells;
  const P = new Float32Array(nv * (N + 1) * 3);
  const Nn = new Float32Array(nv * (N + 1) * 3);
  const T = new Float32Array(nv * (N + 1));
  const R = new Float32Array(nv * (N + 1) * 3);
  const L = new Float32Array(nv * (N + 1));
  const idx = [];
  const tmp = new THREE.Vector3();
  for (let k = 0; k < nv; k++) {
    const v = patch.ids[k];
    const f = face(v);
    const s = scalpOf(v);
    const len = style.len(f, rng) * s;
    const n = new THREE.Vector3(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
    // comb flow: back over the crown, down at the sides and back
    const flow = new THREE.Vector3(0, 0, -(style.flowBack ?? 0.6)).add(new THREE.Vector3(0, -1, 0).multiplyScalar(sm(Math.abs(f.x), 1.2, 2.4) * 0.8 + sm(-f.z, 1.0, 3.5) * 0.9));
    flow.addScaledVector(n, -flow.dot(n)).normalize();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const o = (i * nv + k);
      tmp.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
        .addScaledVector(n, len * t + 0.0015)
        .addScaledVector(flow, len * style.comb * t * t);
      if (style.drop) tmp.y -= len * style.drop * t * t * sm(-f.y, -2.5, 1.0) * 0.5;
      P[o * 3] = tmp.x; P[o * 3 + 1] = tmp.y; P[o * 3 + 2] = tmp.z;
      Nn[o * 3] = n.x; Nn[o * 3 + 1] = n.y; Nn[o * 3 + 2] = n.z;
      T[o] = t;
      R[o * 3] = f.x; R[o * 3 + 1] = f.y; R[o * 3 + 2] = f.z;
      L[o] = len;
    }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j < patch.tris.length; j++) idx.push(patch.tris[j] + i * nv);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(T, 1));
  g.setAttribute('aRest', new THREE.BufferAttribute(R, 3));
  g.setAttribute('aLen', new THREE.BufferAttribute(L, 1));
  g.setIndex(idx);
  const mat = hairMaterial(color, { cell: style.cell, curl: style.curl || 0 });
  out.materials.push(mat);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  out.group.add(mesh);
  if (style.bun) {
    const bun = buildBun(ch, color);
    out.group.add(bun.mesh);
    out.materials.push(bun.material);
  }
  return out;
}

function buildBun(ch, color) {
  const hm = ch.hm, pos = ch.pos;
  // back of the crown: the scalp vertex furthest back above the ears
  let best = -1, bestZ = Infinity;
  for (let v = 0; v < hm.N; v++) {
    if (hm.scalp[v] < 200) continue;
    const fy = hm.face[v * 3 + 1] / 1000, fz = hm.face[v * 3 + 2] / 1000;
    if (fy < 1.2 || fy > 3.0) continue;
    if (fz < bestZ) { bestZ = fz; best = v; }
  }
  const c = new THREE.Vector3(pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]);
  const g = new THREE.SphereGeometry(0.038, 32, 20);
  g.scale(1.15, 0.9, 0.85);
  const p = g.attributes.position;
  const R = new Float32Array(p.count * 3), T = new Float32Array(p.count), L = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    // twisted coil
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(y, x);
    R[i * 3] = a * 2.0; R[i * 3 + 1] = z * 40; R[i * 3 + 2] = Math.hypot(x, y) * 30;
    T[i] = 0; L[i] = 0.02;
  }
  g.setAttribute('aRest', new THREE.BufferAttribute(R, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(T, 1));
  g.setAttribute('aLen', new THREE.BufferAttribute(L, 1));
  g.translate(c.x, c.y + 0.005, c.z - 0.028);
  const material = hairMaterial(color, { cell: 30 });
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  return { mesh, material };
}

// --- the platok: a printed wool shawl over the head, knotted under the chin
let scarfTex = null;
function scarfTexture() {
  if (scarfTex) return scarfTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#7a1418';
  g.fillRect(0, 0, 512, 512);
  // Pavlovo Posad style: big roses and leaves on deep red, a black border band
  const rose = (x, y, r, col) => {
    for (let i = 5; i >= 1; i--) {
      g.fillStyle = i % 2 ? col : '#f0d9c0';
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + i;
        g.ellipse(x + Math.cos(a) * r * 0.25 * i / 5, y + Math.sin(a) * r * 0.25 * i / 5, r * i / 5 * 0.55, r * i / 5 * 0.35, a, 0, Math.PI * 2);
      }
      g.fill();
    }
  };
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % 512, y = (i * 173 + 40) % 512;
    g.fillStyle = '#2f5a2a';
    g.beginPath(); g.ellipse(x + 18, y + 6, 16, 6, 0.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x - 14, y + 12, 14, 5, -0.5, 0, Math.PI * 2); g.fill();
    rose(x, y, 22 + (i % 3) * 6, ['#e8c040', '#d83a3a', '#f08060', '#9a2a6a'][i % 4]);
  }
  g.fillStyle = '#141010';
  g.fillRect(0, 0, 512, 18); g.fillRect(0, 494, 512, 18);
  g.strokeStyle = '#e8c040'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 22); g.lineTo(512, 22); g.moveTo(0, 490); g.lineTo(512, 490); g.stroke();
  scarfTex = new THREE.CanvasTexture(cv);
  scarfTex.colorSpace = THREE.SRGBColorSpace;
  scarfTex.wrapS = scarfTex.wrapT = THREE.RepeatWrapping;
  scarfTex.anisotropy = 4;
  return scarfTex;
}

function buildHeadscarf(ch, rng) {
  void rng;
  const hm = ch.hm, pos = ch.pos, nrm = ch.nrm;
  const F = (v, k) => hm.face[v * 3 + k] / 1000;
  // cover the scalp, forehead to the brows, ears, the sides of the face and under the jaw
  const covered = (v) => {
    const x = Math.abs(F(v, 0)), y = F(v, 1), z = F(v, 2);
    if (y > 1.35) return true;                       // crown + forehead above the brows
    if (z < -0.6 && y > -4.2) return true;           // back and sides behind the face
    if (x > 1.75 && y > -3.6) return true;           // ears, temples, cheeks' edge
    if (y < -3.3 && y > -4.6 && z > -2.5) return x > 0.0; // under the chin
    return false;
  };
  const patch = scalpPatch(hm, pos, nrm, covered);
  const nv = patch.ids.length;
  const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), UV = new Float32Array(nv * 2);
  for (let k = 0; k < nv; k++) {
    const v = patch.ids[k];
    const x = F(v, 0), y = F(v, 1), z = F(v, 2);
    const off = 0.009 + 0.004 * Math.max(0, -z) / 4;
    for (let a = 0; a < 3; a++) {
      P[k * 3 + a] = pos[v * 3 + a] + nrm[v * 3 + a] * off;
      Nn[k * 3 + a] = nrm[v * 3 + a];
    }
    UV[k * 2] = Math.atan2(x, z) * 0.6;
    UV[k * 2 + 1] = y * 0.18;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setIndex(patch.tris);
  g.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({ map: scarfTexture(), roughness: 0.85, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.5, 0.2, 0.2), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, material };
}
