// Cheap sideline people: one low-poly figure (~270 triangles) instanced for
// players on the bench, coaches, photographers, cheerleaders and the chain
// gang. Per-instance colours (top, bottom, headwear, skin, accent) and a pose
// animated in the vertex shader (arms, cheer jumps, kneeling) — the same
// code runs in the shadow pass so shadows match.
//
// Instance pose (aPose): x = pose, y = seed, z = kneel/sit (0 stand, 1 kneel, 2 sit), w = shoulder build
//   0 idle · 1 hands on hips · 2 camera up · 3 cheer (pom-poms, jumps) · 4 holding a pole · 5 arms crossed · 6 clap
import * as THREE from 'three';

const PART = { skin: 0, top: 1, bottom: 2, shoes: 3, head: 4, accent: 5, camera: 6, pom: 7 };
const LIMB = { body: 0, armL: 1, armR: 2, legL: 3, legR: 4 };

function figureGeometry() {
  const P = [], N = [], A = [], I = [];
  const m = new THREE.Matrix4();
  const add = (geo, part, limb, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const g = geo.index ? geo : geo;
    m.makeScale(sx, sy, sz).setPosition(x, y, z);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const p = g.attributes.position, n = g.attributes.normal;
    const base = P.length / 3;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      N.push(v.x, v.y, v.z);
      A.push(part, limb);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) I.push(base + i);
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const head = new THREE.SphereGeometry(1, 7, 5);
  const cap = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const pom = new THREE.IcosahedronGeometry(1, 0);
  // legs + shoes
  for (const [s, limb] of [[-1, LIMB.legL], [1, LIMB.legR]]) {
    add(box, PART.bottom, limb, s * 0.085, 0.5, 0, 0.12, 0.86, 0.13);
    add(box, PART.shoes, limb, s * 0.085, 0.04, 0.04, 0.11, 0.08, 0.22);
  }
  // hips, torso, collar
  add(box, PART.bottom, LIMB.body, 0, 0.98, 0, 0.36, 0.2, 0.2);
  add(box, PART.top, LIMB.body, 0, 1.3, 0, 0.42, 0.56, 0.22);
  add(box, PART.accent, LIMB.body, 0, 1.6, 0.0, 0.2, 0.05, 0.16);
  // head + headwear
  add(head, PART.skin, LIMB.body, 0, 1.78, 0, 0.11, 0.13, 0.115);
  add(cap, PART.head, LIMB.body, 0, 1.8, -0.005, 0.12, 0.11, 0.125);
  // arms (upper, fore, hand) hang from the shoulder pivot at (±0.25, 1.56)
  for (const [s, limb] of [[-1, LIMB.armL], [1, LIMB.armR]]) {
    add(box, PART.top, limb, s * 0.26, 1.42, 0, 0.1, 0.3, 0.1);
    add(box, PART.top, limb, s * 0.26, 1.16, 0, 0.085, 0.26, 0.09);
    add(box, PART.skin, limb, s * 0.26, 0.99, 0, 0.07, 0.09, 0.06);
    add(pom, PART.pom, limb, s * 0.26, 0.95, 0, 0.11, 0.11, 0.11);
  }
  // camera (photographers): body + long lens, in front of the face
  add(box, PART.camera, LIMB.body, 0, 1.76, 0.2, 0.16, 0.12, 0.12);
  add(box, PART.camera, LIMB.body, 0, 1.76, 0.38, 0.08, 0.08, 0.28);
  box.dispose(); head.dispose(); cap.dispose(); pom.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 2));
  g.setIndex(I);
  return g;
}

const POSE_CODE = /* glsl */`
  attribute vec2 aPart;
  attribute vec4 aPose;
  uniform float uTime;
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  // returns the limb rotation and fills the pivot
  mat3 poseRot(out vec3 pivot) {
    float limb = aPart.y;
    float pose = aPose.x, seed = aPose.y;
    pivot = vec3(0.0);
    if (limb > 0.5 && limb < 2.5) {
      float side = limb < 1.5 ? -1.0 : 1.0;
      pivot = vec3(side * 0.25 * aPose.w, 1.57, 0.0);
      float a = 0.1, b = 0.0;
      if (pose > 0.5 && pose < 1.5) { a = 0.55; b = -0.25; }
      else if (pose > 1.5 && pose < 2.5) { a = 0.12; b = 1.45; }
      else if (pose > 2.5 && pose < 3.5) {
        float k = 0.5 + 0.5 * sin(uTime * 3.6 + seed * 6.0 + side * 0.9);
        a = mix(0.35, 2.8, k); b = 0.25;
      }
      else if (pose > 3.5 && pose < 4.5) { a = 0.12; b = side < 0.0 ? 0.75 : 0.12; }
      else if (pose > 4.5 && pose < 5.5) { a = 0.08; b = 1.25; }
      else if (pose > 5.5) { a = 0.18 + 0.2 * max(0.0, sin(uTime * 9.0 + seed * 5.0)); b = 0.95; }
      a += sin(uTime * 0.7 + seed * 9.0) * 0.04;
      return rotX(-b) * rotZ(side * a);
    }
    return mat3(1.0);
  }
  vec3 poseOffset(vec3 p) {
    float limb = aPart.y;
    float kneel = aPose.z;
    // shoulder pads / build; players (build > 1.1) wear a helmet over the cap shape
    if (limb < 0.5 && aPart.x > 0.5 && aPart.x < 1.5 && p.y > 1.2) p.x *= aPose.w;
    if (aPose.w > 1.1 && aPart.x > 3.5 && aPart.x < 4.5) p = (p - vec3(0.0, 1.8, 0.0)) * vec3(1.32, 1.6, 1.36) + vec3(0.0, 1.74, 0.0);
    if (limb > 2.5) {
      if (kneel > 1.5) { float t = clamp((0.95 - p.y) / 0.95, 0.0, 1.0); p.z += t * 0.42; p.y = 0.5 - t * 0.48; }
      else if (kneel > 0.5) p.y *= 0.42;
    } else {
      if (kneel > 1.5) p.y -= 0.45;
      else if (kneel > 0.5) p.y -= 0.52;
    }
    // cheer jumps
    if (aPose.x > 2.5 && aPose.x < 3.5) p.y += max(0.0, sin(uTime * 3.6 + aPose.y * 6.0)) * 0.22;
    return p;
  }
  bool hidden() {
    float part = aPart.x, pose = aPose.x;
    if (part > 5.5 && part < 6.5) return !(pose > 1.5 && pose < 2.5);
    if (part > 6.5) return !(pose > 2.5 && pose < 3.5);
    return false;
  }
`;

function injectPose(sh, uniforms, depth = false) {
  sh.uniforms.uTime = uniforms.uTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + POSE_CODE);
  if (depth) {
    // the depth shader only runs beginnormal_vertex with displacement maps
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 pivot;
      mat3 R = poseRot(pivot);
      vec3 transformed = poseOffset(R * (position - pivot) + pivot);
      if (hidden()) transformed = vec3(0.0, -10.0, 0.0);`);
    return;
  }
  sh.vertexShader = sh.vertexShader
    .replace('#include <beginnormal_vertex>', `
      vec3 pivot;
      mat3 R = poseRot(pivot);
      vec3 objectNormal = R * normal;
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3(1.0, 0.0, 0.0);
      #endif`)
    .replace('#include <begin_vertex>', `
      vec3 transformed = poseOffset(R * (position - pivot) + pivot);
      if (hidden()) transformed = vec3(0.0, -10.0, 0.0);`);
}

/**
 * Instanced figures. list: [{ x, z, ry, pose, kneel, build, top, bottom, head, skin, accent, scale }]
 * Returns { mesh, uniforms, setAt(i, x, z, ry), count }.
 */
export function buildFigures(list, ctx) {
  const geo = figureGeometry();
  const n = Math.max(1, list.length);
  const cols = { aTop: new Uint8Array(n * 3), aBottom: new Uint8Array(n * 3), aHead: new Uint8Array(n * 3), aSkin: new Uint8Array(n * 3), aAccent: new Uint8Array(n * 3) };
  const pose = new Float32Array(n * 4);
  const c = new THREE.Color();
  const put = (arr, i, hex) => { c.set(hex); arr[i * 3] = c.r * 255; arr[i * 3 + 1] = c.g * 255; arr[i * 3 + 2] = c.b * 255; };
  list.forEach((f, i) => {
    put(cols.aTop, i, f.top || '#333333');
    put(cols.aBottom, i, f.bottom || '#222222');
    put(cols.aHead, i, f.head || '#1a1410');
    put(cols.aSkin, i, f.skin || '#c68b62');
    put(cols.aAccent, i, f.accent || '#111111');
    pose.set([f.pose || 0, f.seed ?? Math.random(), f.kneel || 0, f.build || 1], i * 4);
  });
  for (const [k, arr] of Object.entries(cols)) geo.setAttribute(k, new THREE.InstancedBufferAttribute(arr, 3, true));
  geo.setAttribute('aPose', new THREE.InstancedBufferAttribute(pose, 4));
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    injectPose(sh, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aTop, aBottom, aHead, aSkin, aAccent;
        varying vec3 vPartCol;
        varying float vShiny;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        float pp = aPart.x;
        vPartCol = pp < 0.5 ? aSkin : pp < 1.5 ? aTop : pp < 2.5 ? aBottom : pp < 3.5 ? vec3(0.03) : pp < 4.5 ? aHead : pp < 5.5 ? aAccent : pp < 6.5 ? vec3(0.04) : aAccent;
        vShiny = (pp > 3.5 && pp < 4.5 && aPose.w > 1.1) ? 1.0 : 0.0;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPartCol;\nvarying float vShiny;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vPartCol;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.25, vShiny);');
  };
  mat.customProgramCacheKey = () => 'hc-people';
  if (ctx?.uSpill) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.uniforms.uSpill = ctx.uSpill;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSpill;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uSpill * 0.8;');
    };
  }
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => injectPose(sh, uniforms, true);
  depth.customProgramCacheKey = () => 'hc-people-depth';
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.customDepthMaterial = depth;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'people';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const setAt = (i, x, z, ry, sc = 1, y = 0) => {
    q.setFromAxisAngle(up, ry);
    m4.compose(p.set(x, y, z), q, s.set(sc, sc, sc));
    mesh.setMatrixAt(i, m4);
    mesh.instanceMatrix.needsUpdate = true;
  };
  list.forEach((f, i) => setAt(i, f.x, f.z, f.ry || 0, f.scale || 1, f.y || 0));
  mesh.count = list.length;
  return { mesh, uniforms, setAt, count: list.length };
}

export { PART, LIMB };
