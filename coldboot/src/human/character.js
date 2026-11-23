// A person, built from a "DNA" description on the MakeHuman base mesh:
// macro shape (sex, age, build, ethnicity) + face/body modifiers → morphed
// vertices → MakeHuman's own skeleton fitted to them (joint groups, plane
// rolls) → skinned parts (head with expression morphs, body, eyes, lashes,
// teeth, tongue) + hair and clothing generated around the body.
import * as THREE from 'three';
import { loadHM } from './hm.js';
import { createSkinMaterial, createEyeMaterial, createLashMaterial, createMouthMaterials } from './skin.js';
import { makeRng } from '../core/util.js';
import { buildHair, hairline, buildBeard, setExprDenseProvider } from './hair.js';
import { buildGarment, visibleBodyIndex, cullRegion } from './clothes.js';

// expression units uploaded as GPU morph targets (order = influence index)
export const EXPR = [
  'eye-left-closure', 'eye-right-closure', 'eye-left-slit', 'eye-right-slit', 'eye-left-opened-up', 'eye-right-opened-up',
  'eyebrows-left-up', 'eyebrows-right-up', 'eyebrows-left-down', 'eyebrows-right-down',
  'eyebrows-left-inner-up', 'eyebrows-right-inner-up',
  'mouth-open', 'mouth-corner-puller', 'mouth-depression', 'mouth-pursing', 'mouth-retraction',
  'mouth-protusion', 'mouth-compression', 'mouth-elevation', 'nose-left-elevation', 'nose-right-elevation',
];
export const EXPR_INDEX = Object.fromEntries(EXPR.map((n, i) => [n, i]));

const PAIRS = [['decr', 'incr'], ['in', 'out'], ['down', 'up'], ['backward', 'forward'], ['concave', 'convex'],
  ['compress', 'uncompress'], ['pointed', 'triangle'], ['square', 'round']];

export const DEFAULT_DNA = {
  seed: 1,
  sex: 1,            // 0 female … 1 male
  age: 30,           // years
  muscle: 0.5,       // 0..1
  weight: 0.5,       // 0..1
  height: 1.0,       // scale
  ethnic: { african: 0, asian: 0, caucasian: 1 },
  face: {},          // 'nose/nose-hump': -1..1
  skin: { tone: 0.25, warmth: 0.5, rosy: 0.5, freckles: 0 },
  eyes: { color: '#5a3a22' },
  brows: { color: '#2b1d14', density: 0.8, thickness: 0.5 },
  lips: { color: null },
  hair: { style: 'short', color: '#2b1d14' },
  beard: { style: 'none', color: null, stubble: 0 },
  outfit: null,
};

let shared = null; // per-bundle shared data (modifier table, dense expression deltas, morph attrs)

function getShared(hm) {
  if (shared && shared.hm === hm) return shared;
  // modifier table from target names
  const mods = {};
  for (const name of hm.targets.keys()) {
    if (name.startsWith('macro/') || name.startsWith('expr/')) continue;
    let matched = false;
    for (const [lo, hi] of PAIRS) {
      for (const [suf, key] of [[lo, 'min'], [hi, 'max']]) {
        if (name.endsWith('-' + suf)) {
          const base = name.slice(0, -suf.length - 1);
          (mods[base] ||= {})[key] = name;
          matched = true;
        }
      }
      if (matched) break;
    }
    if (!matched) (mods[name] ||= {}).max = name;
  }
  // dense expression deltas over base vertices
  const exprDense = EXPR.map((e) => {
    const t = hm.targets.get('expr/' + e);
    const d = new Float32Array(hm.N * 3);
    if (t) for (let k = 0; k < t.k; k++) {
      const i = t.idx[k] * 3;
      d[i] = t.d[k * 3] * t.scale; d[i + 1] = t.d[k * 3 + 1] * t.scale; d[i + 2] = t.d[k * 3 + 2] * t.scale;
    }
    return d;
  });
  // morph attributes per part (identical for every person: shared)
  const morphAttrs = {};
  for (const part of ['head', 'lashes', 'teeth', 'tongue']) {
    const map = hm.parts[part].map;
    morphAttrs[part] = exprDense.map((d) => {
      const a = new Float32Array(map.length * 3);
      for (let i = 0; i < map.length; i++) {
        const b = map[i] * 3;
        a[i * 3] = d[b]; a[i * 3 + 1] = d[b + 1]; a[i * 3 + 2] = d[b + 2];
      }
      return new THREE.BufferAttribute(a, 3);
    });
  }
  const eyeMorph = exprDense; // eyes don't morph
  void eyeMorph;
  shared = { hm, mods, exprDense, morphAttrs };
  return shared;
}

/** MakeHuman's macro weights → [targetName, weight][] */
function macroWeights(dna) {
  const g = THREE.MathUtils.clamp(dna.sex, 0, 1);
  const G = { female: 1 - g, male: g };
  // adults only: slider 0.5 = 25 y, 1.0 = 90 y
  const slider = THREE.MathUtils.clamp(0.5 + (dna.age - 25) / 130, 0.5, 1);
  const old = Math.max(0, slider * 2 - 1);
  const A = { young: 1 - old, old };
  const tri = (v) => (v < 0.5 ? { min: 1 - v * 2, average: v * 2, max: 0 } : { min: 0, average: 1 - (v * 2 - 1), max: v * 2 - 1 });
  const M = tri(THREE.MathUtils.clamp(dna.muscle, 0, 1));
  const Wt = tri(THREE.MathUtils.clamp(dna.weight, 0, 1));
  const out = [];
  for (const gk of ['female', 'male']) for (const ak of ['young', 'old']) for (const mk of ['min', 'average', 'max']) for (const wk of ['min', 'average', 'max']) {
    const w = G[gk] * A[ak] * M[mk] * Wt[wk];
    if (w > 1e-4) out.push([`macro/universal-${gk}-${ak}-${mk}muscle-${wk}weight`, w]);
  }
  const e = dna.ethnic || { caucasian: 1 };
  const tot = (e.african || 0) + (e.asian || 0) + (e.caucasian || 0) || 1;
  for (const r of ['african', 'asian', 'caucasian']) {
    const rv = (e[r] || 0) / tot;
    if (rv < 1e-4) continue;
    for (const gk of ['female', 'male']) for (const ak of ['young', 'old']) {
      const w = rv * G[gk] * A[ak];
      if (w > 1e-4) out.push([`macro/${r}-${gk}-${ak}`, w]);
    }
  }
  return out;
}

function applyTarget(pos, t, w) {
  const s = t.scale * w;
  const idx = t.idx, d = t.d;
  for (let k = 0; k < t.k; k++) {
    const i = idx[k] * 3;
    pos[i] += d[k * 3] * s;
    pos[i + 1] += d[k * 3 + 1] * s;
    pos[i + 2] += d[k * 3 + 2] * s;
  }
}

/** Morphed base-vertex positions for a DNA. */
export function morphPositions(hm, dna) {
  const sh = getShared(hm);
  const pos = Float32Array.from(hm.basePos);
  for (const [name, w] of macroWeights(dna)) {
    const t = hm.targets.get(name);
    if (t) applyTarget(pos, t, w);
  }
  for (const [mod, v] of Object.entries(dna.face || {})) {
    if (!v) continue;
    const m = sh.mods[mod];
    if (!m) continue;
    const name = v < 0 ? m.min : m.max;
    const t = name && hm.targets.get(name);
    if (t) applyTarget(pos, t, Math.abs(v));
  }
  // stand on y = 0 (lowest body vertex)
  let minY = Infinity;
  const body = hm.parts.body.map;
  for (let i = 0; i < body.length; i++) minY = Math.min(minY, pos[body[i] * 3 + 1]);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;
  return pos;
}

function jointPos(hm, pos, name, out) {
  const idx = hm.joints[name];
  out.set(0, 0, 0);
  if (!idx) return out;
  for (const i of idx) { out.x += pos[i * 3]; out.y += pos[i * 3 + 1]; out.z += pos[i * 3 + 2]; }
  return out.multiplyScalar(1 / idx.length);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function planeNormal(hm, pos, planeName, out) {
  const js = hm.planes[planeName];
  if (!js) return out.set(0, 1, 0);
  jointPos(hm, pos, js[0], _a); jointPos(hm, pos, js[1], _b); jointPos(hm, pos, js[2], _c);
  const pvec = _b.clone().sub(_a).normalize();
  const yvec = _c.clone().sub(_b).normalize();
  out.crossVectors(yvec, pvec);
  if (out.lengthSq() < 1e-10) return out.set(0, 1, 0);
  return out.normalize();
}

/** MakeHuman getMatrix: Y along the bone, X ≈ plane normal, Z = X × Y. */
function boneMatrix(head, tail, normal) {
  const y = tail.clone().sub(head).normalize();
  const z = new THREE.Vector3().crossVectors(normal, y).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(head);
  return m;
}

export function buildSkeleton(hm, pos) {
  const bones = [];
  const byName = {};
  const globals = [];
  const head = new THREE.Vector3(), tail = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (const b of hm.bones) {
    jointPos(hm, pos, b.head, head);
    jointPos(hm, pos, b.tail, tail);
    if (Array.isArray(b.plane)) {
      const acc = new THREE.Vector3();
      let n = 0;
      for (const pl of b.plane) { planeNormal(hm, pos, pl, nrm); if (nrm.lengthSq() > 0.5) { acc.add(nrm); n++; } }
      nrm.copy(n ? acc.normalize() : new THREE.Vector3(0, 1, 0));
    } else if (typeof b.plane === 'string') {
      planeNormal(hm, pos, b.plane, nrm);
    } else {
      nrm.set(0, 1, 0);
    }
    if (tail.distanceToSquared(head) < 1e-12) tail.copy(head).add(new THREE.Vector3(0, 0.01, 0));
    const g = boneMatrix(head, tail, nrm);
    const bone = new THREE.Bone();
    bone.name = b.name;
    bones.push(bone);
    byName[b.name] = bone;
    globals.push(g);
  }
  const index = hm.boneIndex;
  const inverses = [];
  hm.bones.forEach((b, i) => {
    const bone = bones[i];
    const local = b.parent ? new THREE.Matrix4().copy(globals[index[b.parent]]).invert().multiply(globals[i]) : globals[i].clone();
    local.decompose(bone.position, bone.quaternion, bone.scale);
    bone.userData.restQ = bone.quaternion.clone();
    bone.userData.restP = bone.position.clone();
    bone.userData.global = globals[i];
    if (b.parent) byName[b.parent].add(bone);
    inverses.push(globals[i].clone().invert());
  });
  const root = bones[index.root];
  const skeleton = new THREE.Skeleton(bones, inverses);
  return { skeleton, bones, byName, root, globals };
}

/** Area-weighted vertex normals over base-vertex triangles. */
export function baseNormals(hm, pos, triLists) {
  const n = new Float32Array(hm.N * 3);
  for (const tris of triLists) {
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz; }
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

/** A skinned geometry for a part, gathering base-vertex data through its map. */
export function partGeometry(hm, partName, pos, nrm, opts = {}) {
  const p = hm.parts[partName];
  const map = p.map, n = map.length;
  const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const b = map[i];
    P[i * 3] = pos[b * 3]; P[i * 3 + 1] = pos[b * 3 + 1]; P[i * 3 + 2] = pos[b * 3 + 2];
    Nn[i * 3] = nrm[b * 3]; Nn[i * 3 + 1] = nrm[b * 3 + 1]; Nn[i * 3 + 2] = nrm[b * 3 + 2];
    for (let k = 0; k < 4; k++) { SI[i * 4 + k] = hm.skinI[b * 4 + k]; SW[i * 4 + k] = hm.skinW[b * 4 + k] / 255; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(p.uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  if (opts.skinAttrs) {
    const F = new Float32Array(n * 3), M = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const b = map[i];
      F[i * 3] = hm.face[b * 3] / 1000; F[i * 3 + 1] = hm.face[b * 3 + 1] / 1000; F[i * 3 + 2] = hm.face[b * 3 + 2] / 1000;
      M[i * 4] = hm.ao[b] / 255; M[i * 4 + 1] = hm.lip[b] / 255; M[i * 4 + 2] = hm.scalp[b] / 255; M[i * 4 + 3] = 0;
    }
    g.setAttribute('aFace', new THREE.BufferAttribute(F, 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(M, 4));
  }
  const idx = opts.index || p.index;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (opts.morph) {
    g.morphAttributes.position = getShared(hm).morphAttrs[partName];
    g.morphTargetsRelative = true;
  }
  g.computeBoundingSphere();
  g.boundingSphere.radius *= 1.6; // poses reach further than the rest shape
  return g;
}

/** The high-poly eyes, fitted to the morphed mesh (MakeHuman mhclo rules). */
function eyeGeometry(hm, pos) {
  const e = hm.eye;
  const n = e.refs.length / 3;
  const sc = {};
  for (const ax of ['x', 'y', 'z']) {
    const [v1, v2, den] = e.scale[ax];
    const k = ax === 'x' ? 0 : ax === 'y' ? 1 : 2;
    sc[ax] = Math.abs(pos[v1 * 3 + k] - pos[v2 * 3 + k]) / den;
  }
  const fitted = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      let v = 0;
      for (let j = 0; j < 3; j++) v += e.w[i * 3 + j] * pos[e.refs[i * 3 + j] * 3 + k];
      v += e.off[i * 3 + k] * (k === 0 ? sc.x : k === 1 ? sc.y : sc.z);
      fitted[i * 3 + k] = v;
    }
  }
  const rn = e.map.length;
  const P = new Float32Array(rn * 3);
  for (let i = 0; i < rn; i++) {
    const b = e.map[i];
    P[i * 3] = fitted[b * 3]; P[i * 3 + 1] = fitted[b * 3 + 1]; P[i * 3 + 2] = fitted[b * 3 + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(e.uv, 2));
  g.setIndex(new THREE.BufferAttribute(e.index, 1));
  const [nb, nc] = hm.meta.eyeGroups;
  g.addGroup(0, nb, 0);
  g.addGroup(nb, nc, 1);
  g.computeVertexNormals();
  const SI = new Uint16Array(rn * 4), SW = new Float32Array(rn * 4);
  const L = hm.boneIndex['eye.L'], R = hm.boneIndex['eye.R'];
  for (let i = 0; i < rn; i++) {
    SI[i * 4] = e.side[e.map[i]] ? L : R;
    SW[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.computeBoundingSphere();
  return g;
}

export class Character {
  constructor() {
    this.group = new THREE.Group();
    this.meshes = {};
    this.materials = [];
    this.expr = new Float32Array(EXPR.length);
    this.dna = null;
  }

  dispose() {
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.materials) m.dispose();
    this.skeleton?.dispose();
    this.group.removeFromParent();
  }

  /** Set expression unit by name (0..1). */
  setExpr(name, v) {
    const i = EXPR_INDEX[name];
    if (i !== undefined) this.expr[i] = v;
  }

  applyExpr() {
    // the teeth/tongue helpers poke through closed lips: only show them when talking
    const open = this.expr[EXPR_INDEX['mouth-open']] || 0;
    if (this.meshes.teeth) this.meshes.teeth.visible = open > 0.12;
    if (this.meshes.tongue) this.meshes.tongue.visible = open > 0.12;
    for (const key of ['head', 'lashes', 'teeth', 'tongue', 'beard']) {
      const m = this.meshes[key];
      if (!m || !m.morphTargetInfluences) continue;
      for (let i = 0; i < this.expr.length; i++) m.morphTargetInfluences[i] = this.expr[i];
    }
  }
}

/** Build a person. Returns a Character (async: the bundle loads once). */
export async function buildCharacter(dnaIn = {}, opts = {}) {
  const hm = await loadHM();
  const dna = { ...DEFAULT_DNA, ...dnaIn };
  const ch = new Character();
  ch.dna = dna;
  ch.hm = hm;
  const pos = morphPositions(hm, dna);
  ch.pos = pos;
  const nrm = baseNormals(hm, pos, [hm.weldedTris.head, hm.weldedTris.body]);
  const helperN = baseNormals(hm, pos, [hm.weldedTris.lashes, hm.weldedTris.teeth, hm.weldedTris.tongue, hm.weldedTris.tights, hm.weldedTris.skirt, hm.weldedTris.hair]);
  // helper parts take their own normals, body/head keep the welded skin normals
  const merged = Float32Array.from(nrm);
  for (const part of ['lashes', 'teeth', 'tongue', 'tights', 'skirt', 'hair']) {
    for (const b of hm.parts[part].map) { merged[b * 3] = helperN[b * 3]; merged[b * 3 + 1] = helperN[b * 3 + 1]; merged[b * 3 + 2] = helperN[b * 3 + 2]; }
  }
  ch.nrm = merged;

  const rig = buildSkeleton(hm, pos);
  ch.skeleton = rig.skeleton;
  ch.bones = rig.byName;
  ch.rig = rig;
  const holder = new THREE.Group();
  holder.name = 'person';
  holder.add(rig.root);
  ch.group.add(holder);
  ch.holder = holder;
  holder.scale.setScalar(dna.height || 1);

  const rng = makeRng(dna.seed || 1);
  const skinMat = createSkinMaterial(dna, rng);
  ch.skinMat = skinMat;
  ch.materials.push(skinMat);

  const addPart = (key, geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = key;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = opts.frustumCulled ?? true;
    holder.add(m);
    m.bind(rig.skeleton, new THREE.Matrix4());
    ch.meshes[key] = m;
    return m;
  };

  // clothes first: they decide which parts of the body are ever visible
  const garments = (dna.outfit || []).filter(Boolean);
  const culls = [];
  ch.garments = [];
  for (const g of garments) {
    const gm = buildGarment(ch, g);
    ch.materials.push(gm.material);
    gm.mesh.frustumCulled = opts.frustumCulled ?? true;
    holder.add(gm.mesh);
    gm.mesh.bind(rig.skeleton, new THREE.Matrix4());
    ch.meshes['garment-' + g.slot] = gm.mesh;
    ch.garments.push(gm.mesh);
    if (g.opaque !== false) culls.push(cullRegion(ch, g));
  }
  addPart('head', partGeometry(hm, 'head', pos, merged, { skinAttrs: true, morph: true, index: culls.length ? visibleBodyIndex(ch, culls, 'head') : undefined }), skinMat);
  addPart('body', partGeometry(hm, 'body', pos, merged, { skinAttrs: true, index: culls.length ? visibleBodyIndex(ch, culls) : undefined }), skinMat);
  const eyeMats = createEyeMaterial(dna, hm.eyeTexURL);
  ch.materials.push(...eyeMats);
  addPart('eyes', eyeGeometry(hm, pos), eyeMats).castShadow = false;
  const lashMat = createLashMaterial(dna);
  ch.materials.push(lashMat);
  addPart('lashes', partGeometry(hm, 'lashes', pos, merged, { morph: true }), lashMat).castShadow = false;
  const { teeth, tongue } = createMouthMaterials();
  ch.materials.push(teeth, tongue);
  addPart('teeth', partGeometry(hm, 'teeth', pos, merged, { morph: true }), teeth).castShadow = false;
  addPart('tongue', partGeometry(hm, 'tongue', pos, merged, { morph: true }), tongue).castShadow = false;

  // scalp shading follows this person's hairline (stored in aMask.z)
  {
    const recede = dna.hair?.recede ?? 0;
    for (const key of ['head']) {
      const geo = ch.meshes[key].geometry;
      const map = hm.parts[key].map;
      const M = geo.attributes.aMask;
      for (let i = 0; i < map.length; i++) {
        const b = map[i];
        M.array[i * 4 + 2] = hairline({ x: hm.face[b * 3] / 1000, y: hm.face[b * 3 + 1] / 1000, z: hm.face[b * 3 + 2] / 1000 }, recede);
      }
      M.needsUpdate = true;
    }
  }
  const hair = buildHair(ch, dna.hair?.style || 'short', dna.hair?.color || '#2b1d14', rng);
  ch.hair = hair;
  ch.materials.push(...hair.materials);
  setExprDenseProvider(() => getShared(hm).exprDense);
  const beard = buildBeard(ch, dna.beard?.style, dna.beard?.color || dna.hair?.color || '#2b1d14');
  if (beard) {
    ch.materials.push(beard.material);
    beard.mesh.frustumCulled = opts.frustumCulled ?? true;
    holder.add(beard.mesh);
    beard.mesh.bind(rig.skeleton, new THREE.Matrix4());
    ch.meshes.beard = beard.mesh;
  }

  // the dark inside of the mouth (the base mesh has no cavity behind the lips).
  // It hangs from the head, not the jaw: on the jaw it swung out through the chin.
  {
    const jaw = rig.byName.head;
    const lipC = new THREE.Vector3();
    let n = 0;
    for (let v = 0; v < hm.N; v++) if (hm.lip[v] > 160) { lipC.x += pos[v * 3]; lipC.y += pos[v * 3 + 1]; lipC.z += pos[v * 3 + 2]; n++; }
    lipC.multiplyScalar(1 / Math.max(1, n));
    const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0a0405 }));
    cav.scale.set(0.021, 0.017, 0.026);
    cav.position.copy(lipC).add(new THREE.Vector3(0, -0.008, -0.03));
    const holderGroup = new THREE.Group();
    holderGroup.matrixAutoUpdate = false;
    holderGroup.matrix.copy(jaw.userData.global.clone().invert());
    holderGroup.add(cav);
    jaw.add(holderGroup);
    ch.materials.push(cav.material);
  }

  ch.headBone = rig.byName.head;
  ch.height = (dna.height || 1) * (() => {
    let y = 0;
    for (const b of hm.parts.head.map) y = Math.max(y, pos[b * 3 + 1]);
    return y;
  })();
  ch.applyExpr();
  return ch;
}
