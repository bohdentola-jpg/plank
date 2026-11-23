#!/usr/bin/env node
// Builds COLD BOOT's people from Microsoft Rocketbox (MIT): avatars and motion
// capture → assets/people/*.glb.
//
//   node coldboot/tools/build_people.mjs [--only id,id] [--clips-only] [--avatars-only] [--no-fetch]
//        [--rocketbox DIR] [--deps DIR] [--work DIR]
//
// Needs: the Rocketbox repo (a blobless sparse clone is enough: only the files
// listed in src/people/catalog.js are fetched, via `git sparse-checkout`),
// Node with three@0.160.0 + @gltf-transform/{core,extensions} (in --deps
// DIR/node_modules, default: the repo root; `npm i --no-save three@0.160.0
// @gltf-transform/core@4 @gltf-transform/extensions@4`), and python3 with
// Pillow + numpy for the textures (tools/build_people_tex.py).
//
// Per avatar (<Name>_facial.fbx, the hipoly mesh with 175 blendshapes):
//  - three's FBXLoader parses it; the mesh is split by material into body /
//    head / hair (+ props like glasses, hats), welded, converted to metres and
//    Y-up bind space; the head keeps the blendshapes listed in MORPHS as
//    sparse morph targets;
//  - textures: colour (≤1024, WebP), normal (WebP, green flipped), specular →
//    roughness (JPEG), hair/lash opacity (WebP + alpha); optional baked looks
//    (grey/white hair, older skin, recoloured clothes);
//  - written as <id>.glb with the skin (Biped "Bip01" skeleton) and metadata
//    in the scene extras (sex, height, hip height, parts, morph names).
// Clips (per sex → anim_m.glb, anim_f.glb): body-bone rotations (int16) +
// the root's translation; facial/helper bones dropped; locomotion made
// in-place (speed kept as metadata), loops made seamless.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { AVATARS, CLIPS, MORPHS, PLAYER_AVATARS } from '../src/people/catalog.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = join(HERE, '..');
const REPO = join(GAME, '..');
const OUT = join(GAME, 'assets/people');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const flag = (n) => args.includes('--' + n);
const RB = opt('rocketbox', process.env.ROCKETBOX || '/home/user/microsoft/microsoft-rocketbox');
const DEPS = opt('deps', process.env.PEOPLE_DEPS || REPO);
const WORK = opt('work', join(tmpdir(), 'coldboot-people'));
const ONLY = opt('only', null)?.split(',');
const PY = process.env.PYTHON || 'python3';

const TIER = {
  hero: { head: 1024, headN: 1024, body: 1024, bodyN: 1024, hair: 1024, rough: 512, prop: 512, q: 86 },
  named: { head: 1024, headN: 512, body: 1024, bodyN: 512, hair: 512, rough: 256, prop: 256, q: 84 },
  folk: { head: 512, headN: 512, body: 512, bodyN: 512, hair: 512, rough: 256, prop: 256, q: 82 },
};
const BODY_BONES = new Set(['Bip01', 'Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head',
  ...['L', 'R'].flatMap((s) => [`Bip01_${s}_Clavicle`, `Bip01_${s}_UpperArm`, `Bip01_${s}_Forearm`, `Bip01_${s}_Hand`,
    `Bip01_${s}_Thigh`, `Bip01_${s}_Calf`, `Bip01_${s}_Foot`, `Bip01_${s}_Toe0`,
    ...[0, 1, 2, 3, 4].flatMap((f) => [`Bip01_${s}_Finger${f}`, `Bip01_${s}_Finger${f}1`, `Bip01_${s}_Finger${f}2`])])]);

// ------------------------------------------------------------------ deps
const nm = (p) => pathToFileURL(join(DEPS, 'node_modules', p)).href;
let THREE, FBXLoader, GT, GTX;
try {
  THREE = await import(nm('three/build/three.module.js'));
  ({ FBXLoader } = await import(nm('three/examples/jsm/loaders/FBXLoader.js')));
  GT = await import(nm('@gltf-transform/core/dist/index.js'));
  GTX = await import(nm('@gltf-transform/extensions/dist/index.js'));
} catch (e) {
  console.error(`Missing build dependencies in ${DEPS}/node_modules (${e.message}).\n` +
    `Install them with:  npm i --no-save --prefix ${DEPS} three@0.160.0 @gltf-transform/core@4 @gltf-transform/extensions@4`);
  process.exit(1);
}
if (THREE.REVISION !== '160') console.warn('warning: three r' + THREE.REVISION + ' (the game uses r160)');
// FBXLoader wants to load the TGA maps; we only need names (textures are converted separately)
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const _warn = console.warn;
console.warn = (...a) => { if (!String(a[0]).includes('TGA loader not found')) _warn(...a); };

// ------------------------------------------------------------------ Rocketbox files
const clipFile = (s) => {
  const [kind, name] = s.split('/');
  return `Assets/Animations/all_animations_max_motextr_${kind}/${name}.max.fbx`;
};
const avatarIds = Object.keys(AVATARS).filter((id) => !ONLY || ONLY.includes(id));
const fbxFile = (a) => `Assets/Avatars/${a.src}/Export/${basename(a.src)}_facial.fbx`;
const thumbFile = (a) => `Assets/Avatars/${a.src}/${basename(a.src)}.png`;

function git(...a) {
  return execFileSync('git', ['-C', RB, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
}
function sparseSet(paths) {
  // non-cone sparse checkout: only these files are materialised (missing blobs come in one batch)
  const pats = ['/*.md', ...paths.map((p) => '/' + p)];
  execFileSync('git', ['-C', RB, 'sparse-checkout', 'set', '--no-cone', '--stdin'], { input: pats.join('\n') + '\n', stdio: ['pipe', 'inherit', 'inherit'] });
}
let TREE = null;
function treeFiles() {
  if (!TREE) TREE = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean);
  return TREE;
}

// ------------------------------------------------------------------ FBX
const fbxCache = new Map();
function parseFBX(path, cache = false) {
  if (fbxCache.has(path)) return fbxCache.get(path);
  const buf = readFileSync(path);
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  root.updateMatrixWorld(true);
  if (cache) fbxCache.set(path, root);   // clips are reused (the skeleton comes from the first); avatars are big
  return root;
}

const PART_WORDS = ['head', 'body', 'opacity', 'glasses', 'hat', 'cap', 'helmet', 'pistol', 'equipment', 'stetoskop', 'knife', 'hair'];
function partOf(matName) {
  const toks = matName.toLowerCase().split('_');
  if (toks.includes('glasses')) return 'glasses';
  if (toks.includes('opacity')) return 'hair';
  for (const w of PART_WORDS) if (toks.includes(w)) return w;
  return toks.slice(1).join('_') || 'body';
}
const TYPOS = { equpiment: 'equipment' };   // material names in a few Rocketbox files
function texFor(files, matName, kind) {
  const toks = matName.toLowerCase().split('_');
  const prefix = toks[0];
  const part = partOf(matName);
  const word = part === 'hair' ? 'opacity' : TYPOS[part] || part;
  let c = files.filter((f) => {
    const l = f.toLowerCase();
    return l.startsWith(prefix + '_') && l.includes('_' + word) && l.includes(kind) && l.endsWith('.tga');
  });
  if (kind === 'color' && part !== 'hair' && part !== 'glasses') c = c.filter((f) => !f.toLowerCase().includes('opacity'));
  if (part !== 'hair' && part !== 'glasses') c = c.filter((f) => !/_opacity_/.test(f.toLowerCase()) || kind !== 'color');
  // prefer names sharing the material's extra tokens (f110_A_head → f110_head_color_a), then the plainest
  const extra = toks.slice(1).filter((t) => t !== word);
  c.sort((a, b) => {
    const sa = extra.filter((t) => a.toLowerCase().includes('_' + t)).length, sb = extra.filter((t) => b.toLowerCase().includes('_' + t)).length;
    return sb - sa || a.length - b.length;
  });
  return c[0] || null;
}

// ------------------------------------------------------------------ geometry
const S = 0.01; // cm → m

/** Split the FBX mesh by material into welded, indexed parts in metres / Y-up bind space. */
function extractParts(mesh) {
  const geo = mesh.geometry;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const bind = mesh.bindMatrix.clone();
  const nmat = new THREE.Matrix3().getNormalMatrix(bind);
  const lin = new THREE.Matrix3().setFromMatrix4(bind);
  const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const dict = mesh.morphTargetDictionary || {};
  const morphSrc = MORPHS.map((m) => {
    const key = Object.keys(dict).find((k) => k.endsWith('.' + m) || k === m);
    return key !== undefined ? geo.morphAttributes.position[dict[key]] : null;
  });
  const missing = MORPHS.filter((m, i) => !morphSrc[i]);
  const byMat = new Map();
  const groups = geo.groups.length ? geo.groups : [{ start: 0, count: P.count, materialIndex: 0 }];
  for (const g of groups) {
    if (!byMat.has(g.materialIndex)) byMat.set(g.materialIndex, []);
    byMat.get(g.materialIndex).push(g);
  }
  const parts = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [mi, gs] of byMat) {
    const mat = mats[mi];
    const key2idx = new Map();
    const pos = [], nrm = [], uv = [], ji = [], jw = [], idx = [], src = [];
    for (const g of gs) {
      for (let c = g.start; c < g.start + g.count; c++) {
        v.fromBufferAttribute(P, c).applyMatrix4(bind).multiplyScalar(S);
        n.fromBufferAttribute(N, c).applyMatrix3(nmat).normalize();
        const u = UV.getX(c), w = 1 - UV.getY(c);
        // skin: keep 4 strongest, renormalise
        const inf = [];
        for (let k = 0; k < 4; k++) { const wt = SW.array[c * 4 + k]; if (wt > 1e-4) inf.push([SI.array[c * 4 + k], wt]); }
        inf.sort((a, b) => b[1] - a[1]);
        const tot = inf.reduce((s, x) => s + x[1], 0) || 1;
        const key = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}|${n.x.toFixed(3)},${n.y.toFixed(3)},${n.z.toFixed(3)}|${u.toFixed(5)},${w.toFixed(5)}`;
        let i = key2idx.get(key);
        if (i === undefined) {
          i = pos.length / 3;
          key2idx.set(key, i);
          pos.push(v.x, v.y, v.z); nrm.push(n.x, n.y, n.z); uv.push(u, w);
          for (let k = 0; k < 4; k++) { ji.push(inf[k] ? inf[k][0] : 0); jw.push(inf[k] ? inf[k][1] / tot : 0); }
          src.push(c);
        }
        idx.push(i);
      }
    }
    // FBX polygons are wound like three's (CCW): keep as is
    const nv = pos.length / 3;
    const targets = [];
    for (let t = 0; t < MORPHS.length; t++) {
      const a = morphSrc[t];
      const d = new Float32Array(nv * 3);
      let any = false;
      if (a) {
        for (let i = 0; i < nv; i++) {
          v.fromBufferAttribute(a, src[i]).applyMatrix3(lin).multiplyScalar(S);
          if (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) > 2e-6) { d[i * 3] = v.x; d[i * 3 + 1] = v.y; d[i * 3 + 2] = v.z; any = true; }
        }
      }
      targets.push({ d, any });
    }
    parts.push({ mat, matName: mat.name, part: partOf(mat.name), pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv),
      ji: new Uint8Array(ji), jw: quantWeights(jw), idx: nv < 65536 ? new Uint16Array(idx) : new Uint32Array(idx), targets });
  }
  return { parts, missing };
}

/** Float weights → normalised uint8 summing to exactly 255. */
function quantWeights(w) {
  const out = new Uint8Array(w.length);
  for (let i = 0; i < w.length; i += 4) {
    let s = 0, big = i;
    for (let k = 0; k < 4; k++) { out[i + k] = Math.round(w[i + k] * 255); s += out[i + k]; if (w[i + k] > w[big]) big = i + k; }
    out[big] += 255 - s;
  }
  return out;
}

// ------------------------------------------------------------------ textures
function convertTextures(id, a, parts, texDir) {
  const tier = TIER[a.tier || 'named'];
  const files = readdirSync(texDir);
  const out = join(WORK, id);
  mkdirSync(out, { recursive: true });
  const maps = [];
  const want = {};
  let hairRef = null, faceRef = null;
  for (const p of parts) {
    const isHead = p.part === 'head', isBody = p.part === 'body';
    const isAlpha = p.part === 'hair' || p.part === 'glasses';
    const col = texFor(files, p.matName, 'color');
    const nrm = texFor(files, p.matName, 'normal');
    const spec = texFor(files, p.matName, 'specular');
    const size = isHead ? tier.head : isBody ? tier.body : p.part === 'hair' ? tier.hair : tier.prop;
    const nsize = isHead ? tier.headN : isBody ? tier.bodyN : Math.min(tier.prop, 512);
    const tag = p.part;
    want[tag] = {};
    if (col) {
      const o = join(out, `${tag}_color.webp`);
      maps.push({ kind: isAlpha ? 'rgba' : 'color', part: tag, src: join(texDir, col), out: o, size, quality: tier.q });
      want[tag].color = o;
      if (p.part === 'hair') hairRef = join(texDir, col);
      if (isHead) faceRef = join(texDir, col);
    } else console.warn(`  ${id}: no colour map for ${p.matName}`);
    if (nrm) { const o = join(out, `${tag}_normal.webp`); maps.push({ kind: 'normal', src: join(texDir, nrm), out: o, size: nsize, quality: tier.q }); want[tag].normal = o; }
    if (spec) { const o = join(out, `${tag}_rough.jpg`); maps.push({ kind: 'rough', src: join(texDir, spec), out: o, size: isHead || isBody ? tier.rough : 128 }); want[tag].rough = o; }
  }
  const job = join(out, 'job.json');
  writeFileSync(job, JSON.stringify({ maps, hairRef, faceRef, look: a.look || null, debug: flag('debug') ? out : null }));
  execFileSync(PY, ['-I', join(HERE, 'build_people_tex.py'), job], { stdio: 'inherit' });
  return want;
}

// ------------------------------------------------------------------ glTF helpers
function newDoc() {
  const doc = new GT.Document();
  doc.createExtension(GTX.EXTTextureWebP).setRequired(true);
  const buffer = doc.createBuffer();
  return { doc, buffer };
}
const io = () => new GT.NodeIO().registerExtensions([GTX.EXTTextureWebP]);
function acc(D, type, array, o = {}) {
  const a = D.doc.createAccessor().setType(type).setArray(array).setBuffer(D.buffer);
  if (o.normalized) a.setNormalized(true);
  if (o.sparse) a.setSparse(true);
  return a;
}
function tex(D, path) {
  if (!path || !existsSync(path)) return null;
  const mime = path.endsWith('.webp') ? 'image/webp' : path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return D.doc.createTexture(basename(path)).setImage(new Uint8Array(readFileSync(path))).setMimeType(mime).setURI(basename(path));
}

// ------------------------------------------------------------------ avatars
async function buildAvatar(id) {
  const a = AVATARS[id];
  const t0 = Date.now();
  const root = parseFBX(join(RB, fbxFile(a)));
  const meshes = [];
  root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const mesh = meshes.find((m) => /hipoly/i.test(m.name)) || meshes[0];
  if (!mesh) throw new Error(id + ': no skinned mesh');
  const { parts: allParts, missing } = extractParts(mesh);
  if (missing.length) console.warn(`  ${id}: blendshapes missing: ${missing.join(' ')}`);
  const drop = new Set(a.drop || []);
  const parts = allParts.filter((p) => !drop.has(p.part));
  const texDir = join(RB, 'Assets/Avatars', a.src, 'Textures');
  const maps = convertTextures(id, a, parts, texDir);

  const D = newDoc();
  const { doc } = D;
  const scene = doc.createScene(id);
  // skeleton: Bip01 and every bone below it that the skin uses (or leads to one)
  const joints = mesh.skeleton.bones;
  let bip = joints[0]; while (bip.parent && bip.parent.isBone) bip = bip.parent;
  const needed = new Set();
  for (const j of joints) { let b = j; while (b && b.isBone) { needed.add(b); b = b.parent; } }
  const nodeOf = new Map();
  const addBone = (b, parent) => {
    if (!needed.has(b)) return;
    const node = doc.createNode(b.name)
      .setTranslation([b.position.x * S, b.position.y * S, b.position.z * S])
      .setRotation(b.quaternion.toArray())
      .setScale(b.scale.toArray());
    nodeOf.set(b, node);
    if (parent) parent.addChild(node); else scene.addChild(node);
    for (const c of b.children) if (c.isBone) addBone(c, node);
  };
  addBone(bip, null);
  const ibm = new Float32Array(joints.length * 16);
  joints.forEach((j, i) => {
    const m = mesh.skeleton.boneInverses[i].clone();
    m.elements[12] *= S; m.elements[13] *= S; m.elements[14] *= S;
    ibm.set(m.elements, i * 16);
  });
  const skin = doc.createSkin('skin').setSkeleton(nodeOf.get(bip)).setInverseBindMatrices(acc(D, 'MAT4', ibm));
  for (const j of joints) skin.addJoint(nodeOf.get(j));

  const partNames = [];
  let height = 0, minY = Infinity;
  for (const p of parts) {
    for (let i = 1; i < p.pos.length; i += 3) { height = Math.max(height, p.pos[i]); minY = Math.min(minY, p.pos[i]); }
    const m = maps[p.part] || {};
    const isAlpha = p.part === 'hair' || p.part === 'glasses';
    const mat = doc.createMaterial(p.part)
      .setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1)
      .setDoubleSided(isAlpha)
      .setAlphaMode(isAlpha ? 'MASK' : 'OPAQUE');
    if (isAlpha) mat.setAlphaCutoff(0.5);
    const tc = tex(D, m.color); if (tc) mat.setBaseColorTexture(tc);
    const tn = tex(D, m.normal); if (tn) mat.setNormalTexture(tn);
    const tr = tex(D, m.rough); if (tr) mat.setMetallicRoughnessTexture(tr);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', acc(D, 'VEC3', p.pos))
      .setAttribute('NORMAL', acc(D, 'VEC3', p.nrm))
      .setAttribute('TEXCOORD_0', acc(D, 'VEC2', p.uv))
      .setAttribute('JOINTS_0', acc(D, 'VEC4', p.ji))
      .setAttribute('WEIGHTS_0', acc(D, 'VEC4', p.jw, { normalized: true }))
      .setIndices(acc(D, 'SCALAR', p.idx))
      .setMaterial(mat);
    const gmesh = doc.createMesh(p.part).addPrimitive(prim);
    const morphNames = [];
    if (p.targets.some((t) => t.any)) {
      p.targets.forEach((t, i) => {
        if (!t.any) return;
        prim.addTarget(doc.createPrimitiveTarget(MORPHS[i]).setAttribute('POSITION', acc(D, 'VEC3', t.d, { sparse: true })));
        morphNames.push(MORPHS[i]);
      });
      gmesh.setExtras({ targetNames: morphNames });
      gmesh.setWeights(morphNames.map(() => 0));
    }
    const node = doc.createNode(p.part).setMesh(gmesh).setSkin(skin);
    scene.addChild(node);
    partNames.push(p.part);
  }
  const hip = bip.position.y * S;
  scene.setExtras({ people: { id, src: a.src, sex: a.sex, height: +(height - minY).toFixed(3), hip: +hip.toFixed(4), parts: partNames, keep: a.keep || [] } });
  const file = join(OUT, id + '.glb');
  await io().write(file, doc);
  console.log(`  ${id.padEnd(22)} ${(statSync(file).size / 1e6).toFixed(2)} MB  h=${(height - minY).toFixed(2)} parts=${partNames.join(',')}  (${Date.now() - t0} ms)`);
}

// ------------------------------------------------------------------ clips
/** Sample a track at times ts (linear / slerp), returns Float32Array. */
function sampleTrack(track, ts) {
  const interp = track.createInterpolant();
  const vs = track.getValueSize();
  const out = new Float32Array(ts.length * vs);
  for (let i = 0; i < ts.length; i++) out.set(interp.evaluate(ts[i]), i * vs);
  return out;
}

const POSE_BONES = ['Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head', 'Bip01_L_Clavicle', 'Bip01_R_Clavicle',
  'Bip01_L_UpperArm', 'Bip01_R_UpperArm', 'Bip01_L_Forearm', 'Bip01_R_Forearm', 'Bip01_L_Thigh', 'Bip01_R_Thigh', 'Bip01_L_Calf', 'Bip01_R_Calf'];

/** A loop end in [lo, hi] (seconds after start) whose pose is closest to the start pose. */
function bestLoopEnd(byName, start, lo, hi) {
  const sample = (t) => POSE_BONES.map((b) => { const tr = byName.get(b + '.quaternion'); return tr ? tr.createInterpolant().evaluate(t).slice() : null; });
  const root = byName.get('Bip01.position')?.createInterpolant();
  const p0 = sample(start), r0 = root ? root.evaluate(start).slice() : null;
  let best = hi, bestD = Infinity;
  for (let t = lo; t <= hi; t += 1 / 30) {
    const p = sample(start + t);
    let d = 0;
    p.forEach((q, i) => { if (q && p0[i]) { const dot = Math.abs(q[0] * p0[i][0] + q[1] * p0[i][1] + q[2] * p0[i][2] + q[3] * p0[i][3]); d += 2 * Math.acos(Math.min(1, dot)); } });
    if (root) { const r = root.evaluate(start + t); d += Math.hypot(r[0] - r0[0], r[1] - r0[1], r[2] - r0[2]) * 0.05; }
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** Drop keyframes that linear/slerp interpolation reproduces within tol (rad for rotations, m for positions). */
function reduceKeys(ts, v, size, tol) {
  const n = ts.length;
  if (n <= 2) return { t: ts, v };
  const keep = [0];
  const err = (a, b, k) => {
    const f = (ts[k] - ts[a]) / (ts[b] - ts[a]);
    if (size === 4) {
      const qa = new THREE.Quaternion().fromArray(v, a * 4), qb = new THREE.Quaternion().fromArray(v, b * 4);
      const qi = qa.slerp(qb, f), qk = new THREE.Quaternion().fromArray(v, k * 4);
      return 2 * Math.acos(Math.min(1, Math.abs(qi.dot(qk))));
    }
    let e = 0;
    for (let c = 0; c < size; c++) e = Math.max(e, Math.abs(v[a * size + c] + (v[b * size + c] - v[a * size + c]) * f - v[k * size + c]));
    return e;
  };
  let a = 0;
  for (let j = 2; j < n; j++) {
    let ok = true;
    for (let k = a + 1; k < j && ok; k++) if (err(a, j, k) > tol) ok = false;
    if (!ok) { keep.push(j - 1); a = j - 1; }
  }
  keep.push(n - 1);
  const t = new Float32Array(keep.length), out = new Float32Array(keep.length * size);
  keep.forEach((i, o) => { t[o] = ts[i]; for (let c = 0; c < size; c++) out[o * size + c] = v[i * size + c]; });
  return { t, v: out };
}

function processClip(name, src, opts) {
  const root = parseFBX(join(RB, clipFile(src)), true);
  const clip = root.animations[0];
  if (!clip) throw new Error('no animation in ' + src);
  const byName = new Map(clip.tracks.map((t) => [t.name, t]));
  const rootTrack = byName.get('Bip01.position');
  // window: long loops end where the pose comes back closest to the start; long one-shots are cut
  const fps = opts.fps || (opts.loco ? 30 : opts.loop ? 20 : 24);
  const start = Math.min(opts.from || 0, clip.duration - 0.5);
  const avail = clip.duration - start;
  const max = opts.max || (opts.loco ? avail : opts.loop ? 14 : 10);
  let dur = Math.min(avail, max);
  if (opts.loop && !opts.loco && avail > max) dur = bestLoopEnd(byName, start, max * 0.6, max);
  const n = Math.max(2, Math.round(dur * fps) + 1);
  const ts = new Float32Array(n);
  for (let i = 0; i < n; i++) ts[i] = (i / (n - 1)) * dur;
  const at = ts.map((t) => t + start);
  const tracks = [];
  for (const bone of BODY_BONES) {
    const qt = byName.get(bone + '.quaternion');
    if (!qt) continue;
    const q = sampleTrack(qt, at);
    for (let i = 1; i < n; i++) {
      const d = q[i * 4] * q[i * 4 - 4] + q[i * 4 + 1] * q[i * 4 - 3] + q[i * 4 + 2] * q[i * 4 - 2] + q[i * 4 + 3] * q[i * 4 - 1];
      if (d < 0) for (let k = 0; k < 4; k++) q[i * 4 + k] *= -1;
    }
    if (opts.loop) seamQuat(q, n);
    const tol = /Finger/.test(bone) ? 0.03 : /Toe/.test(bone) ? 0.02 : bone === 'Bip01' || bone === 'Bip01_Pelvis' ? 0.004 : 0.008;
    tracks.push({ bone, path: 'rotation', ...reduceKeys(ts, q, 4, tol) });
  }
  let speed = 0;
  if (rootTrack) {
    const p = sampleTrack(rootTrack, at);
    for (let i = 0; i < p.length; i++) p[i] *= S;
    if (opts.loco || src.startsWith('xy') || src.startsWith('xyz')) {
      // root motion out: remove the straight-line drift over the clip (forward travel), centre the rest
      const dx = p[(n - 1) * 3] - p[0], dz = p[(n - 1) * 3 + 2] - p[2];
      if (opts.loco) speed = Math.hypot(dx, dz) / dur;
      let mx = 0, mz = 0;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        p[i * 3] -= dx * k; p[i * 3 + 2] -= dz * k;
        mx += p[i * 3]; mz += p[i * 3 + 2];
      }
      mx /= n; mz /= n;
      for (let i = 0; i < n; i++) { p[i * 3] -= mx; p[i * 3 + 2] -= mz; }
    }
    if (opts.loop) seamVec(p, n);
    tracks.push({ bone: 'Bip01', path: 'translation', ...reduceKeys(ts, p, 3, 0.0015) });
  }
  // gait clips: when does the left heel strike? (all gaits get aligned on it at runtime)
  let phase = 0;
  if (opts.loco) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const lf = root.getObjectByName('Bip01_L_Foot');
    const ys = [];
    for (let i = 0; i < n; i++) { mixer.setTime(at[i]); root.updateMatrixWorld(true); ys.push(lf.getWorldPosition(new THREE.Vector3()).y); }
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    const lo = Math.min(...ys), hi = Math.max(...ys), th = lo + (hi - lo) * 0.25;
    for (let i = 0; i < n; i++) {
      const prev = ys[(i - 1 + n - 1) % (n - 1)];
      if (prev > th && ys[i] <= th) { phase = ts[i] / dur; break; }
    }
  }
  return { name, ts, tracks, dur, speed, phase, loop: !!opts.loop, src };
}

/** Make a loop seamless: spread the end→start rotation mismatch over the clip. */
function seamQuat(q, n) {
  const q0 = new THREE.Quaternion().fromArray(q, 0), qn = new THREE.Quaternion().fromArray(q, (n - 1) * 4);
  const delta = q0.clone().multiply(qn.clone().invert());
  if (delta.w < 0) { delta.x *= -1; delta.y *= -1; delta.z *= -1; delta.w *= -1; }
  const I = new THREE.Quaternion(), c = new THREE.Quaternion(), x = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    c.slerpQuaternions(I, delta, i / (n - 1));
    x.fromArray(q, i * 4).premultiply(c).normalize();
    x.toArray(q, i * 4);
  }
}
function seamVec(p, n) {
  const d = [p[0] - p[(n - 1) * 3], p[1] - p[(n - 1) * 3 + 1], p[2] - p[(n - 1) * 3 + 2]];
  for (let i = 0; i < n; i++) { const k = i / (n - 1); p[i * 3] += d[0] * k; p[i * 3 + 1] += d[1] * k; p[i * 3 + 2] += d[2] * k; }
}

async function buildClips(sex) {
  const t0 = Date.now();
  const D = newDoc();
  const { doc } = D;
  const scene = doc.createScene('anim_' + sex);
  const list = Object.entries(CLIPS).map(([name, c]) => [name, c[sex === 'm' ? 0 : 1], c[2] || {}]);
  // skeleton (names + rest pose) from the first clip
  const ref = parseFBX(join(RB, clipFile(list[0][1])), true);
  let bip = null;
  ref.traverse((o) => { if (o.isBone && o.name === 'Bip01') bip = o; });
  const nodes = new Map();
  const addBone = (b, parent) => {
    if (!BODY_BONES.has(b.name)) return;
    const node = doc.createNode(b.name).setTranslation([b.position.x * S, b.position.y * S, b.position.z * S]).setRotation(b.quaternion.toArray());
    nodes.set(b.name, node);
    if (parent) parent.addChild(node); else scene.addChild(node);
    for (const c of b.children) if (c.isBone) addBone(c, node);
  };
  addBone(bip, null);
  const meta = {};
  let bytes = 0;
  for (const [name, src, o] of list) {
    const c = processClip(name, src, o);
    const anim = doc.createAnimation(name);
    const inputs = new Map();
    const inputFor = (t) => {
      const key = t.length + ':' + Array.from(t.subarray(0, Math.min(t.length, 64))).join(',') + ':' + t[t.length - 1];
      let a = inputs.get(key);
      if (!a || a.getArray().length !== t.length || a.getArray().some((x, i) => x !== t[i])) { a = acc(D, 'SCALAR', t); inputs.set(key, a); bytes += a.getByteLength(); }
      return a;
    };
    for (const tr of c.tracks) {
      const node = nodes.get(tr.bone);
      if (!node) continue;
      const input = inputFor(tr.t);
      let out;
      if (tr.path === 'rotation') {
        const q = new Int16Array(tr.v.length);
        for (let i = 0; i < q.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, tr.v[i])) * 32767);
        out = acc(D, 'VEC4', q, { normalized: true });
      } else out = acc(D, 'VEC3', tr.v);
      bytes += out.getByteLength();
      const smp = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR');
      anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(tr.path).setSampler(smp));
    }
    meta[name] = { dur: +c.dur.toFixed(3), loop: c.loop ? 1 : 0, speed: +c.speed.toFixed(3), phase: +c.phase.toFixed(3), src: c.src };
  }
  scene.setExtras({ people: { sex, hip: +(bip.position.y * S).toFixed(4), clips: meta } });
  const file = join(OUT, `anim_${sex}.glb`);
  await io().write(file, doc);
  console.log(`  anim_${sex}.glb ${(statSync(file).size / 1e6).toFixed(2)} MB, ${list.length} clips (${Date.now() - t0} ms)`);
  return meta;
}

// ------------------------------------------------------------------ main
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const doAvatars = !flag('clips-only'), doClips = !flag('avatars-only') && !ONLY;
if (!flag('no-fetch')) {
  // two passes: the FBX files and clips first, then only the texture maps their materials use
  const files = new Set(treeFiles());
  const want = [];
  for (const id of Object.keys(AVATARS)) want.push(fbxFile(AVATARS[id]));
  for (const c of Object.values(CLIPS)) for (const s of [c[0], c[1]]) { if (!files.has(clipFile(s))) throw new Error('no such clip: ' + s); want.push(clipFile(s)); }
  console.log(`fetching ${want.length} Rocketbox FBX files (sparse checkout)…`);
  sparseSet(want);
  for (const id of Object.keys(AVATARS)) {
    const a = AVATARS[id];
    const texDir = `Assets/Avatars/${a.src}/Textures/`;
    const names = [...files].filter((f) => f.startsWith(texDir)).map((f) => f.slice(texDir.length));
    const root = parseFBX(join(RB, fbxFile(a)));
    const drop = new Set(a.drop || []);
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      for (const m of [].concat(o.material)) {
        if (drop.has(partOf(m.name))) continue;
        for (const k of ['color', 'normal', 'specular']) { const f = texFor(names, m.name, k); if (f) want.push(texDir + f); }
      }
    });
  }
  for (const id of PLAYER_AVATARS) want.push(thumbFile(AVATARS[id]));
  console.log(`fetching textures (${want.length} paths in all)…`);
  sparseSet([...new Set(want)]);
}
if (doAvatars) {
  console.log('avatars:');
  for (const id of avatarIds) await buildAvatar(id);
}
if (doAvatars) {
  // creator portraits, cut from Rocketbox's preview renders
  const maps = PLAYER_AVATARS.filter((id) => existsSync(join(RB, thumbFile(AVATARS[id])))).map((id) => ({
    kind: 'thumb', src: join(RB, thumbFile(AVATARS[id])), out: join(OUT, 'thumbs', id + '.jpg'), cut: [150, 177], px: [156, 184], quality: 84 }));
  mkdirSync(join(OUT, 'thumbs'), { recursive: true });
  const job = join(WORK, 'thumbs.json');
  writeFileSync(job, JSON.stringify({ maps }));
  execFileSync(PY, ['-I', join(HERE, 'build_people_tex.py'), job], { stdio: 'inherit' });
  console.log(`  ${maps.length} creator portraits`);
}
if (doClips) {
  console.log('clips:');
  await buildClips('m');
  await buildClips('f');
}
// licence + attribution
const lic = readFileSync(join(RB, 'LICENSE.md'), 'utf8');
writeFileSync(join(OUT, 'LICENSE-Rocketbox.md'), `# Microsoft Rocketbox avatars and animations

The people in COLD BOOT (\`assets/people/*.glb\`) are converted from the
**Microsoft Rocketbox Avatar Library** — https://github.com/microsoft/Microsoft-Rocketbox —
avatars, textures, facial blendshapes and motion-capture animations, released by
Microsoft under the MIT License (reproduced below). Converted with
\`tools/build_people.mjs\` (meshes welded and split, textures resized and re-encoded,
some hair/skin/clothing colours altered, root motion removed from locomotion clips).

Gonzalez-Franco M., Ofek E., Pan Y., Antley A., Steed A., Spanlang B., Maselli A.,
Banakou D., Pelechano N., Orts-Escolano S., Orvalho V., Trutoiu L., Wojcik M.,
Sanchez-Vives M.V., Bailenson J., Slater M., Lanier J. (2020) *The Rocketbox Library
and the Utility of Freely Available Rigged Avatars.* Frontiers in Virtual Reality
1:561558. doi:10.3389/frvir.2020.561558

Facial blendshapes: Matias Volonte, Fang Ma (ARKit set), via the Rocketbox repository.

---

${lic}`);
let total = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); if (st.isDirectory()) walk(p); else total += st.size; } };
walk(OUT);
console.log(`assets/people: ${(total / 1e6).toFixed(1)} MB`);
