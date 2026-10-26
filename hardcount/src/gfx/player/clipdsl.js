// Clip authoring DSL → compiled keyframe tracks, and the sampler.
//
// A key is [t, spec] or [t, spec, 'h'] ('h' = hold: zero tangent, eases in and
// out of that key). spec keys (side-relative limbs, see pose.js):
//   root [x,y,z,pitch,yaw,roll]  spine/chest/neck/head [flex,twist,side]
//   clav / clavL / clavR [elev, prot]
//   arms / armL / armR [elev, plane, twist, elbow, wflex, wdev, pron, fingers]
//   legs / legL / legR [flex, abd, twist, knee, ankle, toe]          (FK legs; feet:false)
//   hands / handL / handR [x, y, z, space] | false                 (wrist IK; space 0 chest, 1 model, 2 knee, 3 head)
//   poles / poleL / poleR [x, y, z]
//   feet / footL / footR [x, y, z, pitch, yaw] | false             (model-space foot IK)
//   knees / kneeL / kneeR [x, y, z]
// Groups a clip never mentions are left to the layer underneath.
import { C, NCH, G, GI, GROUPS, UPPER, neutral, mirror } from './pose.js';

const ARM_DEF = [0, 0, 0, 10, 0, 0, 0, 0.4];
const LEG_DEF = [0, 0, 0, 0, 0, 0];

function expand(spec) {
  const o = {};
  const set = (g, vals) => { o[g] = vals; };
  for (const [k, v] of Object.entries(spec)) {
    switch (k) {
      case 'root': set('root', pad(v, [0, 0, 0, 0, 0, 0])); break;
      case 'spine': case 'chest': case 'neck': case 'head': set(k, pad(v, [0, 0, 0])); break;
      case 'clav': set('clavL', pad(v, [0, 0])); set('clavR', pad(v, [0, 0])); break;
      case 'clavL': case 'clavR': set(k, pad(v, [0, 0])); break;
      case 'arms': set('armL', pad(v, ARM_DEF)); set('armR', pad(v, ARM_DEF)); break;
      case 'armL': case 'armR': set(k, pad(v, ARM_DEF)); break;
      case 'legs': set('legL', pad(v, LEG_DEF)); set('legR', pad(v, LEG_DEF)); break;
      case 'legL': case 'legR': set(k, pad(v, LEG_DEF)); break;
      case 'hands': set('handL', ik5(v)); set('handR', ik5(v)); break;
      case 'handL': case 'handR': set(k, ik5(v)); break;
      case 'poles': set('poleL', pad(v, [0.45, -0.45, -0.77])); set('poleR', pad(v, [0.45, -0.45, -0.77])); break;
      case 'poleL': case 'poleR': set(k, pad(v, [0.45, -0.45, -0.77])); break;
      case 'feet': set('footL', ik6(v)); set('footR', ik6(v)); break;
      case 'footL': case 'footR': set(k, ik6(v)); break;
      case 'knees': set('kneeL', pad(v, [0.12, 0, 1])); set('kneeR', pad(v, [0.12, 0, 1])); break;
      case 'kneeL': case 'kneeR': set(k, pad(v, [0.12, 0, 1])); break;
      default: break;
    }
  }
  return o;
}
function pad(v, def) { const a = def.slice(); for (let i = 0; i < Math.min(v.length, def.length); i++) if (v[i] !== undefined && v[i] !== null) a[i] = v[i]; return a; }
function ik5(v) { if (v === false || v === null) return [0, NaN, NaN, NaN, NaN]; return [1, v[0], v[1], v[2], v[3] ?? 0]; }
function ik6(v) { if (v === false || v === null) return [0, NaN, NaN, NaN, NaN, NaN]; return [1, v[0], v[1], v[2], v[3] ?? 0, v[4] ?? 6]; }

/** Compile [[t, spec, flag?], …] → { T, V (nKeys × NCH), hold[], mask (Uint8 per group) }. */
export function compileKeys(keys) {
  const n = keys.length;
  const ex = keys.map((k) => expand(k[1]));
  const mask = new Uint8Array(GROUPS.length);
  for (const e of ex) for (const g of Object.keys(e)) mask[GI[g]] = 1;
  const V = new Float32Array(n * NCH);
  const base = neutral();
  for (let gi = 0; gi < GROUPS.length; gi++) {
    if (!mask[gi]) continue;
    const g = GROUPS[gi];
    const [s, len] = G[g];
    // collect per key, fill forward / backward (IK coordinates too when the key turns IK off)
    let firstVals = null;
    for (let k = 0; k < n; k++) if (ex[k][g]) { firstVals = ex[k][g].slice(); break; }
    for (let i = 0; i < len; i++) if (Number.isNaN(firstVals[i])) {
      // an IK group that starts "off": borrow the first real coordinates
      for (let k = 0; k < n; k++) if (ex[k][g] && !Number.isNaN(ex[k][g][i])) { firstVals[i] = ex[k][g][i]; break; }
      if (Number.isNaN(firstVals[i])) firstVals[i] = base[s + i];
    }
    let prev = firstVals;
    for (let k = 0; k < n; k++) {
      const cur = ex[k][g] ? ex[k][g].map((v, i) => (Number.isNaN(v) ? prev[i] : v)) : prev.slice();
      for (let i = 0; i < len; i++) V[k * NCH + s + i] = cur[i];
      prev = cur;
    }
  }
  // groups not in the mask: neutral values (never read)
  for (let k = 0; k < n; k++) for (let i = 0; i < NCH; i++) if (!mask[groupOf(i)]) V[k * NCH + i] = base[i];
  return { T: Float32Array.from(keys.map((k) => k[0])), V, hold: keys.map((k) => k[2] === 'h'), mask, n };
}
const CHG = (() => { const a = new Int8Array(NCH); for (const [g, [s, l]] of Object.entries(G)) for (let i = 0; i < l; i++) a[s + i] = GI[g]; return a; })();
const groupOf = (i) => CHG[i];

/**
 * Sample tracks at time t into out (only masked groups). lag[g] delays a group
 * (overlapping action: the head trails the body, etc.).
 */
export function sampleTracks(tr, t, out, lag) {
  const { T, V, n, hold, mask } = tr;
  for (let gi = 0; gi < GROUPS.length; gi++) {
    if (!mask[gi]) continue;
    const [s, len] = G[GROUPS[gi]];
    let tg = t - (lag ? lag[gi] : 0);
    if (tg <= T[0]) { for (let i = 0; i < len; i++) out[s + i] = V[s + i]; continue; }
    if (tg >= T[n - 1]) { const b = (n - 1) * NCH; for (let i = 0; i < len; i++) out[s + i] = V[b + s + i]; continue; }
    let k = 0;
    while (k < n - 2 && tg >= T[k + 1]) k++;
    const k0 = Math.max(0, k - 1), k3 = Math.min(n - 1, k + 2);
    const t1 = T[k], t2 = T[k + 1], span = t2 - t1 || 1e-6;
    const u = (tg - t1) / span, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const dA = T[k + 1] - T[k0], dB = T[k3] - T[k];
    for (let i = 0; i < len; i++) {
      const c = s + i;
      const p1 = V[k * NCH + c], p2 = V[(k + 1) * NCH + c];
      const p0 = V[k0 * NCH + c], p3 = V[k3 * NCH + c];
      const m1 = hold[k] || dA <= 0 ? 0 : ((p2 - p0) / dA) * span;
      const m2 = hold[k + 1] || dB <= 0 ? 0 : ((p3 - p1) / dB) * span;
      out[c] = h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2;
    }
  }
  return out;
}

/** A static pose from a spec (bases). */
export function poseOf(spec) {
  const out = neutral();
  const tr = compileKeys([[0, spec]]);
  sampleTracks(tr, 0, out, null);
  return { pose: out, mask: tr.mask };
}

export { mirror, UPPER };
