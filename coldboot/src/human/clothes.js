// Clothing grown from MakeHuman's helper surfaces. The bodysuit helper
// ("tights") and the skirt helper share the body's skin weights, so a garment
// is: pick the helper faces inside the garment's region (body segment from
// the skin weights + position along the limb from the fitted joints), snap
// the hem vertices onto a clean cut line, push the surface out by the
// garment's thickness (+ quilted baffles for down parkas), give it fabric
// coordinates in metres and a procedural fabric. The body under opaque
// clothes is culled so it can never poke through.
import * as THREE from 'three';
import { fabric } from './fabric.js';
import { partGeometry } from './character.js';

// body segments from the dominant skin bone
const SEG = { torso: 0, arm: 1, hand: 2, leg: 3, foot: 4, head: 5 };
function segOf(name) {
  if (/^(wrist|metacarpal|finger)/.test(name)) return SEG.hand;
  if (/^(shoulder01|upperarm|lowerarm)/.test(name)) return SEG.arm;
  if (/^(upperleg|lowerleg)/.test(name)) return SEG.leg;
  if (/^(foot|toe)/.test(name)) return SEG.foot;
  if (/^(root|spine|pelvis|clavicle|breast)/.test(name)) return SEG.torso;
  return SEG.head;
}

const _p = new THREE.Vector3();

function jointP(ch, bone) {
  const m = ch.bones[bone].userData.global;
  return new THREE.Vector3().setFromMatrixPosition(m);
}

/** Per-person body frame: joints + per-vertex segment and limb parameters. */
export function bodyFrame(ch) {
  if (ch._frame) return ch._frame;
  const hm = ch.hm, pos = ch.pos, N = hm.N;
  const J = {};
  for (const s of ['L', 'R']) {
    J['sh' + s] = jointP(ch, 'upperarm01.' + s);
    J['el' + s] = jointP(ch, 'lowerarm01.' + s);
    J['wr' + s] = jointP(ch, 'wrist.' + s);
    J['hip' + s] = jointP(ch, 'upperleg01.' + s);
    J['kn' + s] = jointP(ch, 'lowerleg01.' + s);
    J['an' + s] = jointP(ch, 'foot.' + s);
  }
  J.neck = jointP(ch, 'neck01');
  J.root = jointP(ch, 'root');
  const hipY = (J.hipL.y + J.hipR.y) / 2;
  const boneSeg = hm.bones.map((b) => segOf(b.name));
  const seg = new Uint8Array(N);
  const tArm = new Float32Array(N), tLeg = new Float32Array(N), side = new Int8Array(N);
  const acc = new Float32Array(6);
  const proj = (p, a, b, c) => {
    // closest parameter on polyline a→b→c, 0..1 (0.5 at b), extrapolating past c
    const ab = _p.copy(b).sub(a), lab = ab.lengthSq();
    let t1 = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / lab));
    const d1 = Math.hypot(a.x + ab.x * t1 - p.x, a.y + ab.y * t1 - p.y, a.z + ab.z * t1 - p.z);
    const bc = _p.copy(c).sub(b), lbc = bc.lengthSq();
    let t2 = ((p.x - b.x) * bc.x + (p.y - b.y) * bc.y + (p.z - b.z) * bc.z) / lbc;
    t2 = Math.max(0, t2);
    const t2c = Math.min(1, t2);
    const d2 = Math.hypot(b.x + bc.x * t2c - p.x, b.y + bc.y * t2c - p.y, b.z + bc.z * t2c - p.z);
    return d1 < d2 ? t1 * 0.5 : 0.5 + t2 * 0.5;
  };
  const p = new THREE.Vector3();
  for (let v = 0; v < N; v++) {
    acc.fill(0);
    for (let k = 0; k < 4; k++) acc[boneSeg[hm.skinI[v * 4 + k]]] += hm.skinW[v * 4 + k];
    let best = 0;
    for (let k = 1; k < 6; k++) if (acc[k] > acc[best]) best = k;
    seg[v] = best;
    p.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    const s = p.x >= 0 ? 'L' : 'R';
    side[v] = p.x >= 0 ? 1 : -1;
    if (best === SEG.arm || best === SEG.hand) tArm[v] = proj(p, J['sh' + s], J['el' + s], J['wr' + s]);
    if (best === SEG.leg || best === SEG.foot) tLeg[v] = proj(p, J['hip' + s], J['kn' + s], J['an' + s]);
  }
  ch._frame = { J, hipY, seg, tArm, tLeg, side };
  return ch._frame;
}

// hem heights (metres, from the frame)
function hemY(F, hem) {
  const { J, hipY } = F;
  const knee = (J.knL.y + J.knR.y) / 2;
  switch (hem) {
    case 'crop': return hipY + 0.2;
    case 'waist': return hipY + 0.07;
    case 'hip': return hipY - 0.05;
    case 'thigh': return hipY - 0.2;
    case 'knee': return knee + 0.03;
    case 'calf': return knee - 0.18;
    default: return typeof hem === 'number' ? hem : hipY - 0.05;
  }
}

/**
 * Region test for a garment at base vertex v: returns
 *   1 inside, 0 outside, plus where to snap an outside vertex.
 */
function regionFn(ch, g) {
  const F = bodyFrame(ch);
  const pos = ch.pos;
  const { seg, tArm, tLeg } = F;
  const neckY = F.J.neck.y + (g.neckUp ?? 0.0);
  const hem = hemY(F, g.hem);
  const waist = F.hipY + (g.waist ?? 0.1);
  const sleeve = g.sleeves ?? 1.0;
  const leg = g.legs ?? 1.0;
  const kind = g.slot;
  return (v) => {
    const y = pos[v * 3 + 1];
    const s = seg[v];
    if (kind === 'top' || kind === 'coat') {
      if (s === SEG.torso) return y <= neckY && y >= hem;
      if (s === SEG.arm) return tArm[v] <= sleeve;
      if (s === SEG.leg) return y >= hem && g.hem !== 'waist' && g.hem !== 'crop';
      if (s === SEG.head) return y <= neckY && y > F.J.neck.y - 0.1;
      return false;
    }
    if (kind === 'bottom') {
      if (s === SEG.torso) return y <= waist;
      if (s === SEG.leg) return tLeg[v] <= leg;
      if (s === SEG.foot) return leg > 1.02;
      return false;
    }
    if (kind === 'boots') {
      if (s === SEG.foot) return true;
      if (s === SEG.leg) return tLeg[v] >= 1 - (g.shaft ?? 0.3);
      return false;
    }
    if (kind === 'gloves') return s === SEG.hand && tArm[v] >= 0.97;
    if (kind === 'skirt') return y >= hem;
    return false;
  };
}

/** Snap an outside vertex onto the hem line of the face it borders. */
function snapper(ch, g) {
  const F = bodyFrame(ch);
  const { seg, J } = F;
  const hem = hemY(F, g.hem);
  const neckY = F.J.neck.y + (g.neckUp ?? 0.0);
  const waist = F.hipY + (g.waist ?? 0.1);
  return (v, out) => {
    const s = seg[v];
    if (g.slot === 'top' || g.slot === 'coat') {
      if (s === SEG.arm || s === SEG.hand) {
        // slide along the forearm to the cuff
        const side = out.x >= 0 ? 'L' : 'R';
        const t = Math.max(0.06, g.sleeves ?? 1.0);
        const a = t <= 0.5 ? J['sh' + side] : J['el' + side];
        const b = t <= 0.5 ? J['el' + side] : J['wr' + side];
        const k = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
        const cuff = new THREE.Vector3().lerpVectors(a, b, k);
        const axis = new THREE.Vector3().subVectors(b, a).normalize();
        out.addScaledVector(axis, -out.clone().sub(cuff).dot(axis));
      } else if (out.y < hem + 0.05) out.y = Math.max(out.y, hem);
      else out.y = Math.min(out.y, neckY);
    } else if (g.slot === 'bottom') {
      if (s === SEG.torso) out.y = Math.min(out.y, waist);
      else if (s === SEG.leg || s === SEG.foot) {
        const side = out.x >= 0 ? 'L' : 'R';
        const t = g.legs ?? 1.0;
        const a = t <= 0.5 ? J['hip' + side] : J['kn' + side];
        const b = t <= 0.5 ? J['kn' + side] : J['an' + side];
        const k = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
        const cuffP = new THREE.Vector3().lerpVectors(a, b, k);
        const axis = new THREE.Vector3().subVectors(b, a).normalize();
        out.addScaledVector(axis, -out.clone().sub(cuffP).dot(axis));
      }
    } else if (g.slot === 'skirt') {
      out.y = Math.max(out.y, hem);
    } else if (g.slot === 'boots') {
      const side = out.x >= 0 ? 'L' : 'R';
      const t = 1 - (g.shaft ?? 0.3);
      const top = new THREE.Vector3().lerpVectors(J['kn' + side], J['an' + side], (t - 0.5) * 2);
      const axis = new THREE.Vector3().subVectors(J['an' + side], J['kn' + side]).normalize();
      out.addScaledVector(axis, -out.clone().sub(top).dot(axis));
    }
  };
}

function garmentMaterial(g) {
  const fab = fabric({ pattern: g.pattern || 'plain', color: g.color, color2: g.color2, color3: g.color3, stripe: g.stripe });
  const mat = new THREE.MeshPhysicalMaterial({
    map: fab.map, normalMap: fab.normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: g.rough ?? fab.rough, metalness: 0,
    sheen: fab.sheen * 0.12, sheenRoughness: 0.9, sheenColor: new THREE.Color(g.color || '#888').lerp(new THREE.Color('#fff'), 0.25),
    side: THREE.DoubleSide,
  });
  mat.userData.repeat = fab.repeat;
  const rep = { value: fab.repeat };
  // triplanar on the rest-pose position: seamless across body parts
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRep = rep;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRestP;\nattribute vec3 aRestN;\nvarying vec3 vRestP;\nvarying vec3 vRestN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestP = aRestP; vRestN = aRestN;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRep;\nvarying vec3 vRestP;\nvarying vec3 vRestN;')
      .replace('#include <map_fragment>', `
        vec3 tw = pow(abs(normalize(vRestN)), vec3(4.0));
        tw /= (tw.x + tw.y + tw.z + 1e-5);
        vec4 tx = texture2D(map, vRestP.zy * uRep);
        vec4 ty = texture2D(map, vRestP.xz * uRep);
        vec4 tz = texture2D(map, vRestP.xy * uRep);
        diffuseColor *= tx * tw.x + ty * tw.y + tz * tw.z;`)
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 tw2 = pow(abs(normalize(vRestN)), vec3(4.0));
          vec2 nuv = tw2.x > tw2.y && tw2.x > tw2.z ? vRestP.zy : (tw2.y > tw2.z ? vRestP.xz : vRestP.xy);
          vec3 mapN = texture2D(normalMap, nuv * uRep).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale * 0.6;
          normal = normalize(normal + (mapN.x * normalize(cross(normal, vec3(0.0, 1.0, 0.0001))) + mapN.y * vec3(0.0, 1.0, 0.0)) * 0.5);
        }`);
  };
  mat.customProgramCacheKey = () => 'cb-cloth-v1';
  return mat;
}

/**
 * Build one garment as a SkinnedMesh bound to the person's skeleton.
 * g: { slot: 'top'|'bottom'|'coat'|'boots'|'gloves', pattern, color, color2,
 *      thick (m), puff (m, quilted baffles), hem, sleeves, legs, shaft, waist }
 */
export function buildGarment(ch, g) {
  const hm = ch.hm, pos = ch.pos, nrm = ch.nrm;
  const src = g.slot === 'gloves' ? 'body' : g.slot === 'skirt' ? 'skirt' : 'tights';
  const part = hm.parts[src];
  const inside = regionFn(ch, g);
  const snap = snapper(ch, g);
  const F = bodyFrame(ch);
  const idx = part.index, map = part.map;
  const keep = [];
  const insideR = new Uint8Array(map.length);
  for (let i = 0; i < map.length; i++) insideR[i] = inside(map[i]) ? 1 : 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const n = insideR[a] + insideR[b] + insideR[c];
    if (n === 3 || (n >= 1 && g.slot !== 'gloves')) keep.push(a, b, c);
  }
  const geo = partGeometry(hm, src, pos, nrm, { index: new Uint32Array(keep) });
  const P = geo.attributes.position;
  const uv = new Float32Array(map.length * 2);
  const thick = g.thick ?? 0.005;
  const puff = g.puff ?? 0;
  const used = new Uint8Array(map.length);
  for (let k = 0; k < keep.length; k++) used[keep[k]] = 1;
  // welded base vertices of this garment
  const W = new Map();      // base → {p: Vector3, n: Vector3, inside, fixed}
  for (let i = 0; i < map.length; i++) {
    if (!used[i]) continue;
    const b = map[i];
    let w = W.get(b);
    if (!w) {
      w = { p: new THREE.Vector3(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]), n: new THREE.Vector3(nrm[b * 3], nrm[b * 3 + 1], nrm[b * 3 + 2]), inside: insideR[i], nb: new Set() };
      w.p0 = w.p.clone();
      W.set(b, w);
    }
    if (insideR[i]) w.inside = 1;
  }
  for (const w of W.values()) if (!w.inside) { /* snapped below */ }
  for (const [b, w] of W) if (!w.inside) { snap(b, w.p); w.p0.copy(w.p); }
  // adjacency (welded) for smoothing; hem vertices stay put
  for (let k = 0; k < keep.length; k += 3) {
    const a = map[keep[k]], bb = map[keep[k + 1]], c = map[keep[k + 2]];
    W.get(a).nb.add(bb); W.get(a).nb.add(c);
    W.get(bb).nb.add(a); W.get(bb).nb.add(c);
    W.get(c).nb.add(a); W.get(c).nb.add(bb);
  }
  // push out by thickness (+ quilted baffles)
  for (const [b, w] of W) {
    const s = F.seg[b];
    let off = thick;
    if (puff) {
      const along = s === SEG.arm ? F.tArm[b] * 0.7 : w.p.y;
      const per = g.quilt === 'vertical' ? Math.atan2(w.p.x, w.p.z) * 0.15 : along;
      const baffle = 0.5 + 0.5 * Math.cos(per * Math.PI * 2 / (g.baffle ?? 0.11));
      off += puff * (0.55 + 0.45 * baffle);
      if (s === SEG.arm) off *= 0.55 + 0.45 * Math.min(1, (1 - F.tArm[b]) * 4);
    }
    if (g.slot === 'boots' && w.p.y < 0.035) off *= 1.3;
    w.p.addScaledVector(w.n, off);
  }
  // drape: tops hang from the chest, trousers fall straight from the thigh
  const fit = g.fit ?? (g.slot === 'coat' ? 0.85 : g.slot === 'skirt' ? 0 : 0.55);
  if ((g.slot === 'top' || g.slot === 'coat') && fit > 0) {
    const chestY = (F.J.shL.y + F.J.shR.y) / 2 - 0.12;
    const bins = new Float32Array(36);
    let cz = 0, cn = 0;
    for (const [b, w] of W) if (F.seg[b] === SEG.torso && Math.abs(w.p.y - chestY) < 0.04) { cz += w.p.z; cn++; }
    cz = cn ? cz / cn : 0;
    for (const [b, w] of W) {
      if (F.seg[b] !== SEG.torso || Math.abs(w.p.y - chestY) > 0.05) continue;
      const a = Math.atan2(w.p.x, w.p.z - cz);
      const k = Math.floor((a + Math.PI) / (Math.PI * 2) * 36) % 36;
      bins[k] = Math.max(bins[k], Math.hypot(w.p.x, w.p.z - cz));
    }
    for (let k = 0; k < 36; k++) if (!bins[k]) bins[k] = Math.max(bins[(k + 35) % 36], bins[(k + 1) % 36]);
    for (const [b, w] of W) {
      if (F.seg[b] !== SEG.torso || w.p.y > chestY) continue;
      const a = Math.atan2(w.p.x, w.p.z - cz);
      const fk = (a + Math.PI) / (Math.PI * 2) * 36;
      const k0 = Math.floor(fk) % 36, k1 = (k0 + 1) % 36, t = fk - Math.floor(fk);
      const rChest = bins[k0] * (1 - t) + bins[k1] * t;
      const r = Math.hypot(w.p.x, w.p.z - cz);
      const below = Math.min(1, (chestY - w.p.y) / 0.25);
      const target = Math.max(r, rChest * (0.9 + 0.05 * fit));
      const nr = r + (target - r) * fit * below;
      if (r > 1e-4) { w.p.x *= nr / r; w.p.z = cz + (w.p.z - cz) * nr / r; }
    }
  }
  if ((g.slot === 'bottom' || g.slot === 'coat') && (g.legFit ?? 0.6) > 0) {
    const lf = g.legFit ?? 0.6;
    for (const side of ['L', 'R']) {
      const hip = F.J['hip' + side], knee = F.J['kn' + side], ank = F.J['an' + side];
      const axis = new THREE.Vector3().subVectors(ank, hip);
      const len = axis.length(); axis.normalize();
      let rThigh = 0;
      for (const [b, w] of W) {
        if (F.seg[b] !== SEG.leg || (w.p.x >= 0) !== (side === 'L')) continue;
        const t = F.tLeg[b];
        if (t > 0.18 && t < 0.3) {
          const rel = w.p.clone().sub(hip); const d = rel.dot(axis);
          rThigh = Math.max(rThigh, rel.addScaledVector(axis, -d).length());
        }
      }
      for (const [b, w] of W) {
        if (F.seg[b] !== SEG.leg || (w.p.x >= 0) !== (side === 'L')) continue;
        const t = F.tLeg[b];
        if (t < 0.25) continue;
        const rel = w.p.clone().sub(hip); const d = rel.dot(axis);
        const radial = rel.addScaledVector(axis, -d);
        const r = radial.length();
        const target = Math.max(r, rThigh * (0.92 - 0.22 * Math.min(1, (t - 0.25) / 0.75)));
        const nr = r + (target - r) * lf * Math.min(1, (t - 0.25) * 5);
        if (r > 1e-4) w.p.copy(hip).addScaledVector(axis, d).addScaledVector(radial, nr / r);
      }
      void knee; void len;
    }
  }
  // smooth away the anatomy underneath (hems fixed)
  const iters = g.smooth ?? (g.slot === 'boots' ? 1 : 3);
  for (let it = 0; it < iters; it++) {
    const np = new Map();
    for (const [b, w] of W) {
      if (!w.inside || w.nb.size < 3) continue;
      const avg = new THREE.Vector3();
      for (const o of w.nb) avg.add(W.get(o).p);
      avg.multiplyScalar(1 / w.nb.size);
      np.set(b, w.p.clone().lerp(avg, 0.5));
    }
    for (const [b, p] of np) {
      const w = W.get(b);
      // never shrink inside the body: keep at least the original offset outward
      const n0 = w.n;
      const d0 = p.clone().sub(w.p).dot(n0);
      w.p.copy(p);
      if (d0 < 0) w.p.addScaledVector(n0, -d0 * 0.6);
    }
  }
  // never let the cloth sink back into the body (smoothing shrinks convex ridges)
  const minOff = Math.max(0.003, thick * 0.85);
  for (const w of W.values()) {
    const d = w.p.clone().sub(w.p0).dot(w.n);
    if (d < minOff) w.p.addScaledVector(w.n, minOff - d);
  }
  for (let i = 0; i < map.length; i++) {
    if (!used[i]) continue;
    const b = map[i];
    const w = W.get(b);
    const v3 = w.p;
    const s = F.seg[b];
    let u, wv;
    if (s === SEG.arm || s === SEG.hand) {
      const side = v3.x >= 0 ? 'L' : 'R';
      const ax = new THREE.Vector3().subVectors(F.J['wr' + side], F.J['sh' + side]).normalize();
      const rel = v3.clone().sub(F.J['sh' + side]);
      wv = rel.dot(ax);
      const perp = rel.addScaledVector(ax, -wv);
      u = Math.atan2(perp.z, perp.y) * 0.05;
    } else if (s === SEG.leg || s === SEG.foot) {
      const side = v3.x >= 0 ? 'L' : 'R';
      const c = F.J['hip' + side];
      u = Math.atan2(v3.x - c.x, v3.z - c.z) * 0.08;
      wv = -v3.y;
    } else {
      u = Math.atan2(v3.x, v3.z) * 0.15;
      wv = -v3.y;
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = wv;
    P.setXYZ(i, v3.x, v3.y, v3.z);
    if (g.slot === 'boots' && P.getY(i) < 0.012) P.setY(i, 0.0);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  geo.setAttribute('aRestP', new THREE.BufferAttribute(P.array.slice(), 3));
  geo.setAttribute('aRestN', new THREE.BufferAttribute(geo.attributes.normal.array.slice(), 3));
  const mat = garmentMaterial(g);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'garment-' + g.slot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, material: mat, region: inside };
}

/** Which body render triangles stay visible under the outfit. */
export function visibleBodyIndex(ch, regions, partName = 'body') {
  const hm = ch.hm;
  const part = hm.parts[partName];
  const map = part.map, idx = part.index;
  const covered = new Uint8Array(map.length);
  for (let i = 0; i < map.length; i++) {
    const b = map[i];
    for (const r of regions) if (r(b)) { covered[i] = 1; break; }
  }
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (covered[idx[t]] && covered[idx[t + 1]] && covered[idx[t + 2]]) continue;
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return new Uint32Array(keep);
}

// a slightly shrunk version of a garment region, for culling the body safely
export function cullRegion(ch, g) {
  const shrunk = { ...g };
  if (g.sleeves !== undefined) shrunk.sleeves = g.sleeves - 0.03;
  else shrunk.sleeves = 0.97;
  if (g.legs !== undefined) shrunk.legs = g.legs - 0.03;
  else shrunk.legs = 0.97;
  shrunk.neckUp = (g.neckUp ?? 0) - 0.03;
  if (g.slot === 'boots') shrunk.shaft = (g.shaft ?? 0.3) - 0.04;
  const F = bodyFrame(ch);
  const inner = regionFn(ch, shrunk);
  const hem = hemY(F, g.hem) + 0.03;
  const waist = F.hipY + (g.waist ?? 0.1) - 0.03;
  if (g.slot === 'skirt') {
    const hemS = hemY(F, g.hem) + 0.04;
    return (v) => F.seg[v] === SEG.leg && ch.pos[v * 3 + 1] > hemS && F.tLeg[v] < 0.6;
  }
  return (v) => {
    if (!inner(v)) return false;
    const y = ch.pos[v * 3 + 1];
    if ((g.slot === 'top' || g.slot === 'coat') && F.seg[v] === SEG.torso && y < hem) return false;
    if (g.slot === 'bottom' && F.seg[v] === SEG.torso && y > waist) return false;
    return true;
  };
}
