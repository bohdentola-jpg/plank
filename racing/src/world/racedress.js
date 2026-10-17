// Race day on PORT HALCYON's streets: every road that joins the course is
// closed off with a line of barriers (red and white, a banner fence along
// the top), there's a gantry over the start (and the finish of a sprint),
// a chequered line across the road, and the grid's boxes painted behind it.
// Only for the race: none of it is in free roam.
import * as THREE from 'three';
import { Acc } from './build/geo.js';
import { box, cylinder } from './districts/builder.js';
import { glowMat, nightEmissive } from './kit.js';
import { toTex } from '../track/textures.js';
import { makeRng } from '../core/util.js';

function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function barrierTex() {
  const c = cnv(256, 64), x = c.getContext('2d');
  for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#e8e6e0' : '#c8161c'; x.fillRect(k * 32, 0, 32, 64); }
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(0, 56, 256, 8);
  return toTex(c);
}

const SPONSORS = [['NITRO-X', '#0a2a5a', '#ffcc00'], ['KUROSHIO TIRES', '#141414', '#ff3a3a'], ['MIDNIGHT 88.1', '#2a0a3a', '#ff44aa'], ['RAZOR FUEL', '#3a0a0a', '#ff8a00'], ['STATIC MOBILE', '#003a3a', '#00e0c0']];
function bannerTex() {
  const c = cnv(1024, 64), x = c.getContext('2d');
  SPONSORS.forEach(([t, bg, fg], k) => {
    const x0 = (k * 1024) / SPONSORS.length, w = 1024 / SPONSORS.length;
    x.fillStyle = bg; x.fillRect(x0, 0, w, 64);
    x.fillStyle = fg; x.font = '900 30px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(t, x0 + w / 2, 33);
  });
  return toTex(c);
}

function gantryTex(label) {
  const c = cnv(1024, 128), e = cnv(1024, 128);
  const x = c.getContext('2d'), ex = e.getContext('2d');
  x.fillStyle = '#101216'; x.fillRect(0, 0, 1024, 128);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, 1024, 128);
  // chequer ends, the word in the middle
  for (const side of [0, 1]) for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = (i + j) % 2 ? '#f2f2f2' : '#101010';
    x.fillRect(side * 896 + i * 16, j * 32, 16, 32);
  }
  for (const [ctx, col] of [[x, '#ffffff'], [ex, '#ffd27a']]) {
    ctx.fillStyle = col; ctx.font = '900 84px "Arial Black", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 512, 68);
  }
  return { map: toTex(c, { repeat: false }), emi: toTex(e, { repeat: false }) };
}

function chequerTex() {
  const c = cnv(128, 32), x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#f0f0f0' : '#141414'; x.fillRect(i * 8, j * 8, 8, 8); }
  return toTex(c);
}

/**
 * The dressing for a course on its Track (T): returns a Group to add to the
 * scene (and dispose with it).
 */
export function buildDressing(course, T, opts = {}) {
  const g = new THREE.Group();
  g.name = 'race dressing';
  const M = {
    barrier: glowMat({ map: barrierTex(), roughness: 0.6 }, 2.4),
    fence: glowMat({ color: 0x2a2d33, roughness: 0.7, metalness: 0.4 }, 1.8),
    banner: glowMat({ map: bannerTex(), roughness: 0.7, side: THREE.DoubleSide }, 2.0),
    steel: glowMat({ color: 0x8a9096, roughness: 0.45, metalness: 0.6 }, 1.6),
    paint: glowMat({ color: 0xe8e8e0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }, 2.6),
    chequer: glowMat({ map: chequerTex(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }, 2.6),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe6b0').multiplyScalar(3) }),
  };
  const acc = new Map();
  const A = (m) => { let a = acc.get(m); if (!a) { a = new Acc(false); acc.set(m, a); } return a; };
  const rng = makeRng('dress' + (opts.id || ''));
  // ---- the side roads: barriers across their mouths
  for (const J of course.junctions) {
    for (const e of J.side) {
      const r = e.road, rt = r.rt;
      const half = rt.hw + rt.shoulder + rt.walk;
      const d = Math.min(r.length * 0.45, (e.trim || 6) + 1.5);
      // a point d along the side road from the junction, and the road's frame there
      const s = e.end === 0 ? d : r.length - d;
      const p = r.posAt(s);
      const i = p.i;
      const lx = r.LX[i], lz = r.LZ[i];
      const ry = Math.atan2(r.TX[i], r.TZ[i]);
      // water-filled barriers, 2 m each, end to end
      const n = Math.max(2, Math.ceil((half * 2) / 2.05));
      for (let k = 0; k < n; k++) {
        const lat = -half + (k + 0.5) * ((half * 2) / n);
        const x = p.x + lx * lat, z = p.z + lz * lat;
        const y = r.roadY(i, 0, Math.max(-rt.hw, Math.min(rt.hw, lat))) + (Math.abs(lat) > rt.hw + rt.shoulder ? rt.curb : 0);
        box(A(M.barrier), x, y, z, 1.95, 0.95, 0.55, ry, { u: 2, v: 1 });
      }
      // the fence and its banner on top
      const y0 = p.y + 0.95;
      const x0 = p.x - lx * half, z0 = p.z - lz * half, x1 = p.x + lx * half, z1 = p.z + lz * half;
      for (let k = 0; k <= Math.ceil(half / 3); k++) {
        const t = k / Math.ceil(half / 3);
        A(M.fence).beam(x0 + (x1 - x0) * t, y0, z0 + (z1 - z0) * t, x0 + (x1 - x0) * t, y0 + 1.3, z0 + (z1 - z0) * t, 0.06, 0.06);
      }
      const bn = A(M.banner);
      const u = rng() * 0.6;
      bn.quadP([x0, y0 + 0.2, z0], [x1, y0 + 0.2, z1], [x1, y0 + 1.25, z1], [x0, y0 + 1.25, z0], [u, 0, u + half * 2 / 18, 1]);
    }
  }
  // ---- the start (and a sprint's finish): gantry, chequered line, grid boxes
  const lines = [[T.startS, 'START']];
  if (!T.closed) lines.push([T.finishS, 'FINISH']);
  else lines[0][1] = 'START · FINISH';
  for (const [s0, label] of lines) {
    const p = T.posAt(s0);
    const i = p.i, W = T.W[i];
    const lx = T.LX[i], lz = T.LZ[i], ry = Math.atan2(T.TX[i], T.TZ[i]);
    const span = Math.min(T.WL[i], W + 3), spanR = Math.min(T.WR[i], W + 3);
    // posts and the beam
    for (const [lat, sd] of [[span, 1], [-spanR, -1]]) {
      const x = p.x + lx * lat, z = p.z + lz * lat;
      cylinder(A(M.steel), x, p.y - 0.5, z, 0.32, 8.4, 10, { top: true });
      void sd;
    }
    const bx0 = p.x + lx * span, bz0 = p.z + lz * span, bx1 = p.x - lx * spanR, bz1 = p.z - lz * spanR;
    A(M.steel).beam(bx0, p.y + 7.6, bz0, bx1, p.y + 7.6, bz1, 0.5, 0.7);
    // the sign facing the cars coming, lit at night
    const tex = gantryTex(label);
    const sm = nightEmissive(new THREE.MeshStandardMaterial({ map: tex.map, emissive: 0xffffff, emissiveMap: tex.emi, roughness: 0.6 }), 1.6);
    const len = span + spanR;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(len, 16), Math.min(len, 16) / 8), sm);
    sign.position.set((bx0 + bx1) / 2 - T.TX[i] * 0.4, p.y + 6.4, (bz0 + bz1) / 2 - T.TZ[i] * 0.4);
    sign.rotation.y = ry + Math.PI;
    g.add(sign);
    // lights along the beam
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6;
      box(A(M.lamp), bx0 + (bx1 - bx0) * t - T.TX[i] * 0.45, p.y + 7.15, bz0 + (bz1 - bz0) * t - T.TZ[i] * 0.45, 0.45, 0.25, 0.2, ry);
    }
    // the chequered line across the road
    const ch = A(M.chequer);
    const a0 = T.posAt(s0 - 0.8), a1 = T.posAt(s0 + 0.8);
    const P = (q, lat) => [q.x + T.LX[q.i] * lat, q.y + 0.03, q.z + T.LZ[q.i] * lat];
    ch.quadP(P(a0, W), P(a0, -W), P(a1, -W), P(a1, W), [0, 0, (W * 2) / 3, 0.25]);
  }
  // grid boxes behind the start: two columns, a box every 8 m
  {
    const pm = A(M.paint);
    for (let k = 0; k < 8; k++) {
      const s = T.startS - 6 - k * 8;
      if (s < 2 && !T.closed) break;
      const q = T.posAt(s);
      const W = T.W[q.i];
      for (const lat of [W * 0.42, -W * 0.42]) {
        const c = [q.x + T.LX[q.i] * lat, q.y + 0.03, q.z + T.LZ[q.i] * lat];
        const hx = 1.25, hz = 0.12;
        const qa = [c[0] - T.LX[q.i] * hx - T.TX[q.i] * hz, c[1], c[2] - T.LZ[q.i] * hx - T.TZ[q.i] * hz];
        const qb = [c[0] + T.LX[q.i] * hx - T.TX[q.i] * hz, c[1], c[2] + T.LZ[q.i] * hx - T.TZ[q.i] * hz];
        const qc = [c[0] + T.LX[q.i] * hx + T.TX[q.i] * hz, c[1], c[2] + T.LZ[q.i] * hx + T.TZ[q.i] * hz];
        const qd = [c[0] - T.LX[q.i] * hx + T.TX[q.i] * hz, c[1], c[2] - T.LZ[q.i] * hx + T.TZ[q.i] * hz];
        pm.quadP(qa, qd, qc, qb);
      }
    }
  }
  for (const [mat, a] of acc) {
    if (!a.idx.length) continue;
    const m = new THREE.Mesh(a.toGeometry(!!mat.customProgramCacheKey), mat);
    m.castShadow = mat === M.barrier || mat === M.steel;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}
