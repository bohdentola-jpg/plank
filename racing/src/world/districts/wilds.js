// PORT HALCYON — THE NORTH WOODS: deep Douglas fir and ponderosa forest on
// the mountains north-west of the lake, logged since the thirties. Gravel
// logging roads wind through it past clear-cuts of stumps and slash; at the
// end of the Timber Road the sawmill works by floodlight beside its wigwam
// burner glowing like a lantern, log decks stacked high and the trucks
// waiting. Log cabins with warm windows sit along the roads. On its hill the
// fire lookout keeps watch; down a dirt road, Loon Lake's campsite (tents, a
// campfire, a canoe on the shore); and at the end of a trail through the
// cedars, the falls, dropping off a rock wall into their pool.
import * as THREE from 'three';
import { litMat, plainMat, box, prism, gable, hip, cylinder, cone, sphere, drape } from './builder.js';
import { shoulderMat, U } from '../kit.js';
import { Acc } from '../build/geo.js';
import { lin, mixc, mulc, frame, roadField, lampTest, levelness, useGround, cellPoints, ownAcc, ownMesh, warmUp } from './peaks/util.js';
import * as F from './peaks/flora.js';
import { bends, cuts, drapeCut } from './peaks/roadside.js';
import { cellUV, board, railing, bench } from './peaks/parts.js';
import { findBesideRoad, findFlat, exactGround } from './peaks/sites.js';
import { usSignTex, logWallTex, cribTex, ironTex, fallTex, rockFaceTex } from './peaks/tex.js';
import { ROAD, ITEM } from './occ.js';

const PAL = {
  fir: lin('#1a2e1e'), firTip: lin('#2e4a2c'), bark: lin('#4a3424'),
  pine: lin('#2a3c22'), pineHi: lin('#4a5e30'), pineBark: lin('#7a4a2a'),
  snag: lin('#8a8478'), log: lin('#5a4030'), cut: lin('#c8a878'), fern: lin('#2e5a24'), fernTip: lin('#5a8a34'),
  rock: lin('#6a6860'), rockDark: lin('#3a3832'), moss: lin('#3e5228'),
  timber: lin('#6a4a2c'), timberDark: lin('#3e2a1a'), roof: lin('#2e3a2e'), stone: lin('#7a766e'), steel: lin('#3a3e44'),
  rust: lin('#7a4422'), yellow: lin('#e8b818'), red: lin('#b8261e'), white: lin('#e2e2dc'), tent1: lin('#e0702a'), tent2: lin('#3a7a4a'),
  tent3: lin('#2a5aa0'), canoe: lin('#c0281e'), plank: lin('#8a6a46'), gravel: lin('#7a7466'), green: lin('#2e5a32'), black: lin('#18181a'),
};

function mats(B) {
  return {
    veg: B.mat('veg', () => litMat({ vertexColors: true, roughness: 0.92, flatShading: true }, { glow: 2.0 })),
    vegDark: B.mat('vegDark', () => plainMat({ vertexColors: true, roughness: 0.92, flatShading: true })),
    rock: B.mat('rock', () => litMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    rockDark: B.mat('rockDark', () => plainMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    props: B.mat('props', () => litMat({ vertexColors: true, roughness: 0.75, metalness: 0.08 })),
    crib: B.mat('crib', () => litMat({ map: cribTex(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    cabin: B.mat('cabin', () => { const t = logWallTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.85 }, { night: 1.4 }); }),
    iron: B.mat('iron', () => litMat({ map: ironTex(), roughness: 0.6, metalness: 0.35 })),
    signs: B.mat('signs', () => { const t = usSignTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.55 }, { night: 0.5 }); }),
    face: B.mat('face', () => litMat({ map: rockFaceTex(false), roughness: 0.95 })),
    glowWarm: B.mat('glowWarm', () => litMat({ color: 0xf2dcb0, emissive: 0xffa040, roughness: 0.5 }, { night: 2.6 })),
    glowCold: B.mat('glowCold', () => litMat({ color: 0xdfe8f0, emissive: 0xd8e6ff, roughness: 0.4 }, { night: 2.4 })),
    fire: B.mat('fire', () => plainMat({ color: 0x3a1a08, emissive: 0xff6a18, roughness: 0.8 }, { night: 1.0 })),
    flame: B.mat('flame', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(2.4), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })),
    water: B.mat('water', () => plainMat({ color: 0x0e2a36, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.3, transparent: true, opacity: 0.92 })),
    fall: B.mat('fall', () => plainMat({ map: fallTex(), color: 0xcfe4ee, emissive: 0x6a8a9a, roughness: 0.3, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false }, { night: 0.6 })),
    foam: B.mat('foam', () => litMat({ color: 0xeef4f6, roughness: 0.6, transparent: true, opacity: 0.85 })),
    yard: shoulderMat('gravel'),
  };
}

// ------------------------------------------------------------------ plan

function plan(P) {
  sawmill(P);
  lookoutTower(P);
  loonLake(P);
  falls(P);
  cabins(P);
}

function sawmill(P) {
  const n = P.net.nodes.get('wd_mill');
  if (!n) return;
  // the yard beside the end of the Timber Road, facing it
  // the flattest free ground for the yard near the end of the Timber Road, facing it
  const site = findFlat(P, n.x, n.z, 70, 46, 110, { roadPad: true, step: 10, pull: 0.06, noClaim: true });
  if (!site) return;
  const g = { lo: site.lo, hi: site.hi };
  const y = (g.lo + g.hi) / 2;
  P.claim(site.x, site.z, 70, 46, site.ry);
  P.add({ type: 'mill', x: site.x, z: site.z, ry: site.ry, y, w: 70, d: 46, map: 'yard' });
  const L = frame(site.x, y, site.z, site.ry);
  const at = (lx, lz) => L.xz(lx, lz);
  const col = (lx, lz, hx, hz, h) => { const [px, pz] = at(lx, lz); P.collider({ kind: 'box', x: px, z: pz, hx, hz, ry: site.ry, y0: y - 4, y1: y + h }); };
  col(-12, -12, 20, 8, 12);          // the mill shed
  const [wx, wz] = at(22, -10);
  P.collider({ kind: 'circle', x: wx, z: wz, r: 7.5, y0: y - 4, y1: y + 18 });
  col(-18, 12, 10, 4, 4);            // the log deck
  col(14, 14, 7, 1.6, 4);            // a truck
  col(26, 10, 2.6, 6, 4);            // the bunkhouse trailers
  P.lamp({ x: wx, z: wz, y, hx: wx, hz: wz, hy: y + 16, color: '#ff7a2a', radius: 26, intensity: 1.0, halo: 4.5 });
  for (const [ox, oz] of [[-30, 4], [4, 4], [30, -2]]) {
    const [px, pz] = at(ox, oz);
    P.collider({ kind: 'circle', x: px, z: pz, r: 0.3, y0: y - 3, y1: y + 12 });
    P.lamp({ x: px, z: pz, y, hx: px, hz: pz, hy: y + 11, color: '#f4f0e0', radius: 26, intensity: 0.9, halo: 2.6 });
  }
  P.far({ x: site.x + 0, z: site.z, y: y - 2, w: 40, d: 16, h: 13, ry: site.ry, color: '#6a6e70', lit: 0.2 });
  P.far({ shape: 'cone', x: wx, z: wz, y: y - 1, r: 7, h: 18, color: '#5a4434' });
  P.landmark({ id: 'sawmill', name: 'NORTH WOODS SAWMILL', x: site.x, z: site.z, r: 50, kind: 'sawmill' });
}

function lookoutTower(P) {
  const n = P.net.nodes.get('wd_fire');
  if (!n) return;
  const e = n.ends[0];
  // on top of the hill above the trail's end: the highest free ground near it
  const gx = exactGround(P);
  let best = null;
  for (let dz = -27; dz <= 27; dz += 3) {
    for (let dx = -27; dx <= 27; dx += 3) {
      if (dx * dx + dz * dz > 27 * 27) continue;
      const px = n.x + dx, pz = n.z + dz;
      if (!P.isFree(px, pz, 10, 10, 0, { pad: 1, roadPad: true })) continue;
      const h = gx(px, pz);
      if (!best || h > best.h) best = { x: px, z: pz, h };
    }
  }
  const x = best ? best.x : n.x - e.dx * 14, z = best ? best.z : n.z - e.dz * 14;
  const ry = Math.atan2(n.x - x, n.z - z);
  // the legs stand where they land on the rock: the cab 16 m over the highest foot
  const L = frame(x, 0, z, ry);
  let fhi = -Infinity, flo = Infinity;
  for (const [ox, oz] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]]) {
    const [px, pz] = L.xz(ox, oz);
    const h = gx(px, pz);
    fhi = Math.max(fhi, h); flo = Math.min(flo, h);
  }
  const y = fhi;
  P.claim(x, z, 14, 14, ry);
  P.add({ type: 'firetower', x, z, y, lo: flo, ry, map: 'building' });
  for (const [ox, oz] of [[-3.5, -3.5], [3.5, -3.5], [3.5, 3.5], [-3.5, 3.5]]) {
    const [px, pz] = L.xz(ox, oz);
    P.collider({ kind: 'circle', x: px, z: pz, r: 0.4, y0: flo - 3, y1: y + 18 });
  }
  P.lamp({ x, z, y, hx: x, hz: z, hy: y + 17.6, color: '#ffb868', radius: 10, intensity: 0.8, halo: 2.4 });
  P.lamp({ x: n.x, z: n.z, y: n.y, hx: n.x, hz: n.z, hy: n.y + 3, color: '#ffc890', radius: 8, intensity: 0.5, halo: 0.8 });
  P.far({ x, z, y: flo - 1, w: 6, d: 6, h: y + 17 - flo, ry, color: '#4a3424', lit: 0 });
  P.far({ x, z, y: y + 16, w: 5, d: 5, h: 3.5, ry, color: '#5a4430', lit: 0.8 });
  P.landmark({ id: 'firelookout', name: 'FIRE LOOKOUT', x, z, r: 20, kind: 'lookout' });
}

function loonLake(P) {
  const n = P.net.nodes.get('wd_lake');
  if (!n) return;
  // the basin beside the road's end: the lowest ground near it, flooded up to a level the road stays above
  const g = 6, R = 190;
  const cx0 = n.x + 90, cz0 = n.z + 20;      // (the basin lies east of the camp)
  const nI = Math.round((2 * R) / g) + 1;
  const x0 = cx0 - R, z0 = cz0 - R;
  const H = new Float32Array(nI * nI);
  // (the exact ground: the plan's coarse grid smooths a basin out of shape,
  // and the water would lie under the real banks)
  const gx = exactGround(P);
  let mi = -1;
  for (let j = 0; j < nI; j++) for (let i = 0; i < nI; i++) {
    const k = j * nI + i;
    H[k] = gx(x0 + i * g, z0 + j * g);
    // (the lowest ground near the basin's middle, not wherever the box dips)
    if (Math.hypot(i * g - R, j * g - R) < 110 && (mi < 0 || H[k] < H[mi])) mi = k;
  }
  const minH = H[mi];
  // as high as the basin holds water (and the road's end stays dry)
  let level = n.y - 1.6;
  let cells = null;
  for (let tries = 0; tries < 40 && !cells && level > minH + 1.5; tries++, level -= 0.5) {
    const seen = new Uint8Array(nI * nI);
    const st = [mi]; seen[mi] = 1;
    const out = [];
    let open = false;
    while (st.length) {
      const k = st.pop();
      const i = k % nI, j = (k / nI) | 0;
      if (i === 0 || j === 0 || i === nI - 1 || j === nI - 1 || out.length > 1400) { open = true; break; }
      out.push(k);
      for (const q of [k + 1, k - 1, k + nI, k - nI]) {
        if (seen[q] || H[q] >= level) continue;
        const qx = x0 + (q % nI) * g, qz = z0 + ((q / nI) | 0) * g;
        if (P.occ.get(qx, qz) & (ROAD | ITEM)) continue;
        seen[q] = 1; st.push(q);
      }
    }
    if (!open && out.length > 30) cells = out;
  }
  if (!cells) return;
  let sx = 0, sz = 0, bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
  const list = [];
  for (const k of cells) {
    const i = k % nI, j = (k / nI) | 0, x = x0 + i * g, z = z0 + j * g;
    sx += x; sz += z; bx0 = Math.min(bx0, x); bz0 = Math.min(bz0, z); bx1 = Math.max(bx1, x); bz1 = Math.max(bz1, z);
    list.push(i, j);
  }
  const lx = sx / cells.length, lz = sz / cells.length;
  // keep the forest out of the water
  for (const k of cells) P.claim(x0 + (k % nI) * g, z0 + ((k / nI) | 0) * g, g + 2, g + 2, 0);
  P.add({ type: 'lake', x: lx, z: lz, y: level + 0.5, x0, z0, g, cells: list, w: bx1 - bx0 + g, d: bz1 - bz0 + g, ry: 0, map: 'water' });
  // the campsite: at the road's end, between it and the water
  let best = null;
  for (const k of cells) {
    const x = x0 + (k % nI) * g, z = z0 + ((k / nI) | 0) * g;
    const d = Math.hypot(x - n.x, z - n.z);
    if (!best || d < best.d) best = { x, z, d };
  }
  const surface = level + 0.5;
  const toWater = Math.atan2(best.x - n.x, best.z - n.z);
  const ry = toWater;
  const back = Math.max(3, Math.min(8, best.d - 8));
  const cxp = n.x + Math.sin(ry) * back, czp = n.z + Math.cos(ry) * back;
  const L = frame(cxp, n.y, czp, ry);
  // the tents on dry ground either side of the fire (never in the water, never on the road)
  const dry = (lx, lz) => { const [px, pz] = L.xz(lx, lz); return gx(px, pz) > surface + 0.7 && !(P.occ.get(px, pz) & ROAD); };
  const tents = [];
  for (const [lx, lz, a] of [[-7, -1, 0.3], [7, -2, -0.4], [-8, 5, 1.2], [8, 4, -1.0], [-11, -6, 0.6], [11, -6, -0.2]]) {
    if (tents.length < 3 && dry(lx, lz) && dry(lx + 1.6, lz + 1.6) && dry(lx - 1.6, lz - 1.6)) tents.push([lx, lz, a]);
  }
  const table = dry(4, -4) ? [4, -4] : [-4, -5];
  const truck = [[-10, -9], [10, -9], [-13, -2], [13, -2]].find(([lx, lz]) => dry(lx, lz) && dry(lx, lz + 3) && dry(lx, lz - 3)) || null;
  P.add({ type: 'camp', x: cxp, z: czp, y: n.y, ry, sx: best.x, sz: best.z, level: surface, tents, table, truck });
  P.claim(cxp, czp, 30, 26, ry);
  if (truck) { const [px, pz] = L.xz(...truck); P.collider({ kind: 'box', x: px, z: pz, hx: 1.1, hz: 2.8, ry, y0: n.y - 3, y1: n.y + 3 }); }
  const [fx, fz] = L.xz(0, 0);
  P.lamp({ x: fx, z: fz, y: n.y, hx: fx, hz: fz, hy: n.y + 1.6, color: '#ff8a3a', radius: 13, intensity: 1.2, halo: 2.2 });
  for (const [ox, oz] of tents) {
    const [px, pz] = L.xz(ox, oz);
    P.collider({ kind: 'box', x: px, z: pz, hx: 1.6, hz: 1.6, ry, y0: n.y - 3, y1: n.y + 2 });
  }
  P.landmark({ id: 'loonlake', name: 'LOON LAKE CAMP', x: cxp, z: czp, r: 40, kind: 'camp', hidden: true });
}

function falls(P) {
  const n = P.net.nodes.get('wd_falls');
  if (!n) return;
  // which way the hillside climbs from the trail's end
  let best = null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const h = P.groundY(n.x + Math.cos(a) * 50, n.z + Math.sin(a) * 50);
    if (!best || h > best.h) best = { a, h };
  }
  const ux = Math.cos(best.a), uz = Math.sin(best.a);
  // the pool a few metres past the end of the trail; the rock wall at its back
  const px = n.x + ux * 16, pz = n.z + uz * 16;
  const py = Math.min(P.groundY(px, pz), n.y + 0.5);
  const ry = Math.atan2(-ux, -uz);         // the wall's face looks back down at the pool
  const fx = n.x + ux * 26, fz = n.z + uz * 26;
  const top = Math.max(P.groundY(fx + ux * 12, fz + uz * 12), py + 22) + 3;
  P.claim(fx + ux * 12, fz + uz * 12, 36, 26, ry);
  P.add({ type: 'falls', x: fx, z: fz, ry, y: py, top, px, pz });
  P.claim(px, pz, 26, 26, ry);
  P.collider({ kind: 'box', x: fx + ux * 12, z: fz + uz * 12, hx: 17, hz: 12, ry, y0: py - 4, y1: top });
  P.lamp({ x: px, z: pz, y: py, hx: px, hz: pz, hy: py + 6, color: '#9ccaff', radius: 20, intensity: 1.1, halo: 0 });
  P.far({ x: fx + ux * 12, z: fz + uz * 12, y: py - 3, w: 34, d: 24, h: top - py + 3, ry, color: '#5a5650' });
  P.landmark({ id: 'falls', name: 'HIDDEN FALLS', x: px, z: pz, r: 20, kind: 'falls', hidden: true });
}

function cabins(P) {
  const picks = [['pw_r3', 0.35], ['pw_r3', 0.7], ['wd_timber', 0.3], ['pw_r2', 0.78], ['wd_timber', 0.62]];
  let k = 0;
  for (const [id, f] of picks) {
    const r = P.net.byId.get(id);
    if (!r) continue;
    const c = findBesideRoad(P, r, 11, 9, { s0: r.length * f - 120, s1: r.length * f + 120, step: 8, setback: 6, maxSpan: 4, maxDy: 3 });
    if (!c) continue;
    const y = c.hi + 0.3;
    P.add({ type: 'cabin', x: c.x, z: c.z, ry: c.ry, y, lo: c.lo, w: 11, d: 9, v: k++, map: 'building' });
    P.collider({ kind: 'box', x: c.x, z: c.z, hx: 5.5, hz: 4.5, ry: c.ry, y0: c.lo - 2, y1: y + 7 });
    const L = frame(c.x, y, c.z, c.ry);
    const [lx, lz] = L.xz(2.4, 4.6);
    P.lamp({ x: lx, z: lz, y, hx: lx, hz: lz, hy: y + 2.6, color: '#ffb868', radius: 9, intensity: 0.9, halo: 1.2 });
    P.far({ x: c.x, z: c.z, y: c.lo - 1, w: 8, d: 6, h: y - c.lo + 6, ry: c.ry, color: '#4a3220', lit: 0.5 });
  }
}

// ------------------------------------------------------------------ scatter

const LIT = new Set(['fir', 'pine', 'snag', 'rock', 'stump', 'log', 'fern']);

function scatter(S) {
  useGround(S);
  const field = roadField(S.net, S.cx, S.cz);
  const lit = lampTest(S);
  const add0 = S.add.bind(S);
  S.add = (it) => { if (LIT.has(it.type)) it.lit = lit(it.x, it.z); return add0(it); };
  for (const it of bends(S, { rMax: 50 })) S.add(it);
  for (const it of cuts(S, 'crib', { minRise: 3.5 })) S.add(it);
  // the forest: Douglas fir, ponderosa on the drier, sunnier ground; clear-cuts of stumps by the logging roads
  for (const [x, z] of cellPoints(S, 7.5, { r: 1.8, density: (px, pz) => 0.72 + 0.28 * S.noise(px / 90, pz / 90) })) {
    const d = field.at(x, z);
    if (d < 3.5) continue;
    const y = S.groundY(x, z);
    const t = S.rng(), k = S.rng();
    if (d < 36 && levelness(S.groundY, x, z) < 0.8) continue;
    const cut = S.noise(x / 160 + 17, z / 160 - 4);
    if (cut > 0.3 && d < 130) {
      // a clear-cut: stumps, slash and the odd young fir
      if (k < 0.45) S.add({ type: 'stump', x, z, y, t });
      else if (k < 0.6) S.add({ type: 'fir', x, z, y, h: 3 + t * 4, t, lod: 0 });
      else if (k < 0.7) S.add({ type: 'log', x, z, y, t });
      continue;
    }
    const lod = d > 75 ? 1 : 0;
    const sunny = S.noise(x / 230 - 9, z / 230 + 2);
    if (k < 0.04) S.add({ type: 'snag', x, z, y, h: 14 + t * 18, t });
    else if (sunny > 0.15 && k < 0.6) S.add({ type: 'pine', x, z, y, h: 20 + t * 12, t, lod });
    else S.add({ type: 'fir', x, z, y, h: 24 + t * 16, t, lod });
    if (d < 45) S.collider({ kind: 'circle', x, z, r: 0.6, y0: y - 1, y1: y + 10 });
  }
  // the forest floor by the roads: ferns, fallen logs, mossy rocks
  for (const [x, z] of cellPoints(S, 5, { r: 1, pre: (px, pz) => { const q = field.at(px, pz); return q <= 40 && q >= 2; }, density: () => 0.6 })) {
    const y = S.groundY(x, z);
    const k = S.rng(), t = S.rng();
    if (k < 0.55) S.add({ type: 'fern', x, z, y, s: 0.8 + t * 0.7, t });
    else if (k < 0.62) S.add({ type: 'log', x, z, y, t });
  }
  for (const [x, z] of cellPoints(S, 40, { r: 3 })) {
    if (S.rng() > 0.4) continue;
    const y = S.groundY(x, z), s = S.range(0.9, 2.8);
    S.add({ type: 'rock', x, z, y, s, t: S.rng() });
    if (s > 1.4 && field.at(x, z) < 50) S.collider({ kind: 'circle', x, z, r: s * 0.5, y0: y - 1, y1: y + s });
  }
}

// ------------------------------------------------------------------ build

const HEAVY = new Set(['mill', 'firetower', 'lake', 'camp', 'falls', 'cabin', 'crib']);

function* build(B, items) {
  const m = mats(B);
  useGround(B);
  const vegL = B.acc(m.veg), vegD = ownAcc(m.vegDark), rockL = B.acc(m.rock), rockD = B.acc(m.rockDark);
  const V = (it) => (it.lit ? vegL : vegD), R = (it) => (it.lit ? rockL : rockD);
  const nearL = B.near(m.veg), nearD = B.near(m.vegDark), N = (it) => (it.lit ? nearL : nearD);
  let n = 0;
  for (const it of items) {
    switch (it.type) {
      case 'fir': F.dougFir(V(it), it.x, it.y, it.z, it.h, it.t, PAL, it.lod); break;
      case 'pine': F.ponderosa(V(it), it.x, it.y, it.z, it.h, it.t, PAL, it.lod); break;
      case 'snag': F.snag(V(it), it.x, it.y, it.z, it.h, it.t, PAL.snag); break;
      case 'stump': F.stump(N(it), it.x, it.y, it.z, 0.35 + it.t * 0.35, 0.5 + it.t * 0.5, PAL.bark, PAL.cut, it.t); break;
      case 'log': F.log(N(it), it.x, it.y - 0.15, it.z, 5 + it.t * 7, 0.3 + it.t * 0.25, it.t * 6.28, PAL.log, PAL.cut); break;
      case 'fern': F.fern(N(it), it.x, it.y, it.z, it.s, it.t, PAL.fern, PAL.fernTip); break;
      case 'rock': F.rock(R(it), it.x, it.y, it.z, it.s, 0.7, it.t, mixc(PAL.rock, PAL.moss, 0.35), PAL.rockDark, PAL.moss, 0.6); break;
      case 'chev': {
        const y = Math.max(B.groundY(it.x, it.z), it.y - 3);
        const props = B.near(m.props);
        props.col = PAL.steel;
        box(props, it.x, y - 0.4, it.z, 0.08, Math.max(1.7, it.y + 1.2 - y + 0.4), 0.08, it.ry);
        board(B.near(m.signs), it.x, Math.max(it.y, y) + 1.45, it.z, 0.6, 0.75, it.ry, cellUV(it.cell));
        break;
      }
      case 'crib': drapeCut(B, B.acc(m.crib), it, { tile: 3, maxW: 26 }); break;
      case 'mill': mill3d(B, m, it); break;
      case 'firetower': fireTower3d(B, m, it); break;
      case 'lake': lake3d(B, m, it); break;
      case 'camp': camp3d(B, m, it); break;
      case 'falls': falls3d(B, m, it); break;
      case 'cabin': cabin3d(B, m, it); break;
      default: break;
    }
    if (++n % 24 === 0 || HEAVY.has(it.type)) yield;
  }
  yield* ownMesh(B, vegD);
}

// ------------------------------------------------------------------ the sawmill

function logPile(acc, L, lx, lz, y, len, rows, ry, rot = 0) {
  for (let r = 0; r < rows; r++) {
    const n = rows - r + 2;
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 0.9;
      const q = L.xz(lx + Math.cos(rot) * off, lz - Math.sin(rot) * off);
      F.log(acc, q[0], y + r * 0.78, q[1], len, 0.42 + ((k * 7 + r) % 3) * 0.04, ry + Math.PI / 2 + rot, PAL.log, PAL.cut);
    }
  }
}

function truck(acc, L, lx, lz, y, ry, loaded) {
  const P = frame(...L.xz(lx, lz).slice(0, 1), y, L.xz(lx, lz)[1], ry);
  const bx = (ox, oy, oz, w, h, d, col) => { acc.col = col; const q = P(ox, oy, oz); box(acc, q[0], q[1], q[2], w, h, d, ry); };
  bx(0, 0.9, 5.2, 2.5, 2.4, 2.6, PAL.red);
  bx(0, 2.4, 5.6, 2.3, 0.9, 1.7, PAL.black);
  bx(0, 0.6, 0, 1.2, 0.5, 13, PAL.black);
  for (const oz of [4.6, 1.5, 0.2, -3.6, -4.9]) for (const ox of [-1.1, 1.1]) bx(ox, 0, oz, 0.5, 1.05, 1.05, PAL.black);
  for (const oz of [2, -1, -4.4]) for (const ox of [-1.15, 1.15]) bx(ox, 1.0, oz, 0.2, 2.4, 0.2, PAL.steel);
  if (loaded) for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
    const q = P((k - (3 - r) / 2) * 0.62, 1.4 + r * 0.55, -1.2);
    F.log(acc, q[0], q[1], q[2], 9, 0.3, ry + Math.PI / 2, PAL.log, PAL.cut);
  }
}

function mill3d(B, m, it) {
  const { x, z, ry, y, w, d } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props), near = B.near(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  drape(B.acc(m.yard), B, [L.xz(-w / 2, -d / 2), L.xz(w / 2, -d / 2), L.xz(w / 2, d / 2), L.xz(-w / 2, d / 2)], { lift: 0.06, uv: 5 });
  // the mill shed: corrugated iron on three sides, open toward the yard, the saw line inside,
  // its concrete floor level with the highest ground under it (a plinth down the slope)
  let slo = Infinity, shi = -Infinity;
  for (let lx = -32; lx <= 8; lx += 5) for (let lz = -20; lz <= -4; lz += 4) { const h = gy(lx, lz); slo = Math.min(slo, h); shi = Math.max(shi, h); }
  const sy = shi + 0.2;
  const [sx, sz] = L.xz(-12, -12);
  const iron = B.acc(m.iron);
  props.col = PAL.stone;
  box(props, sx, slo - 1, sz, 40.6, sy - slo + 1, 16.6, ry);
  box(iron, sx, sy, sz, 40, 9, 16, ry, { u: 3, v: 3, faces: 'blr', top: false });
  const front = L.xz(-12, -4.2);
  box(iron, front[0], sy + 6, front[1], 40, 3, 0.2, ry, { u: 3, v: 3, top: false });
  props.col = PAL.rust;
  gable(props, sx, sy + 9, sz, 40, 16, 3.2, ry, { over: 0.8 });
  props.col = PAL.steel;
  for (const lx of [-31, -21, -11, -1, 7]) { const q = L.xz(lx, -4.3); box(props, q[0], sy - 0.5, q[1], 0.4, 9.5, 0.4, ry); }
  // the saw line: a long carriage track, the head rig, conveyors, a lit work lamp
  props.col = PAL.yellow;
  const c0 = L.xz(-28, -12), c1 = L.xz(4, -12);
  props.beam(c0[0], sy + 1, c0[1], c1[0], sy + 1, c1[1], 1.4, 0.6);
  const hr = L.xz(-12, -14);
  props.col = PAL.steel;
  box(props, hr[0], sy - 0.5, hr[1], 3, 4.5, 3, ry);
  cylinder(props, hr[0], sy + 2.6, hr[1], 1.6, 0.25, 16, { top: true, bottom: true });
  const gl = B.acc(m.glowWarm);
  for (const lx of [-24, -12, 0]) { const q = L.xz(lx, -12); box(gl, q[0], sy + 8.6, q[1], 1.2, 0.2, 0.6, ry); }
  // the wigwam burner: a riveted cone, its mesh crown glowing at night
  const [bx, bz] = L.xz(22, -10);
  const by = gy(22, -10);
  let blo = by;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; blo = Math.min(blo, gy(22 + Math.cos(a) * 7.2, -10 + Math.sin(a) * 7.2)); }
  props.col = PAL.rust;
  cylinder(props, bx, blo - 0.8, bz, 7.2, by + 3 - (blo - 0.8), 18);
  cylinder(props, bx, by + 3, bz, 7.2, 12, 18, { r2: 2.2 });
  const fire = B.acc(m.fire);
  cylinder(fire, bx, by + 15, bz, 2.2, 2.4, 14, { r2: 2.0 });
  sphere(fire, bx, by + 17.3, bz, 2.0, 10, { dome: true, sy: 0.6 });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; box(fire, bx + Math.cos(a) * 6.6, by + 1.2, bz + Math.sin(a) * 6.6, 1.2, 0.8, 0.2, -a + Math.PI / 2); }
  B.anim(fireFlicker(m.fire, 1.0));
  // the log deck: piles of long logs, a loader parked by them
  const dy = gy(-18, 12);
  logPile(B.acc(m.veg), L, -24, 12, dy, 12, 4, ry);
  logPile(B.acc(m.veg), L, -12, 12, dy, 12, 3, ry);
  const lq = L.xz(-3, 9);
  props.col = PAL.yellow;
  box(props, lq[0], gy(-3, 9) + 0.6, lq[1], 3, 2.2, 4.4, ry + 0.4);
  props.col = PAL.black;
  box(props, lq[0], gy(-3, 9) - 0.2, lq[1], 3.6, 0.9, 5, ry + 0.4);
  props.col = PAL.yellow;
  const boom0 = [lq[0], gy(-3, 9) + 2.6, lq[1]], bt = L.xz(-10, 13);
  props.beam(...boom0, bt[0], gy(-3, 9) + 7.5, bt[1], 0.5, 0.5);
  // trucks: one loaded, one waiting
  truck(B.acc(m.props), L, 14, 14, gy(14, 14), ry + Math.PI / 2, true);
  truck(B.acc(m.props), L, 4, 19, gy(4, 19), ry + Math.PI / 2, false);
  // bunkhouse trailers with lit windows, a fuel tank on legs
  for (const lz of [6, 14]) {
    const q = L.xz(27, lz), qy = Math.max(gy(27, lz - 5), gy(27, lz + 5), gy(27, lz));
    const qlo = Math.min(gy(24.6, lz - 5.5), gy(29.4, lz - 5.5), gy(24.6, lz + 5.5), gy(29.4, lz + 5.5));
    props.col = PAL.stone;
    box(props, q[0], qlo - 0.3, q[1], 4.2, qy + 0.3 - (qlo - 0.3), 10.4, ry);
    props.col = PAL.white;
    box(props, q[0], qy + 0.3, q[1], 4.8, 3.0, 11, ry);
    for (const oz of [-3, 0, 3]) { const wq = L.xz(24.55, lz + oz); box(gl, wq[0], qy + 1.9, wq[1], 0.06, 0.8, 1.4, ry); }
  }
  const tq = L.xz(32, -6), ty = gy(32, -6);
  props.col = PAL.steel;
  for (const o of [-1.4, 1.4]) { const q = L.xz(32 + o, -6); box(props, q[0], ty - 0.3, q[1], 0.2, 1.6, 0.2, ry); }
  props.col = PAL.red;
  props.beam(...[L.xz(30, -6)[0], ty + 2.4, L.xz(30, -6)[1]], L.xz(34.5, -6)[0], ty + 2.4, L.xz(34.5, -6)[1], 2.0, 2.0);
  // floodlights on poles, the company's board by the gate
  for (const [ox, oz] of [[-30, 4], [4, 4], [30, -2]]) {
    const q = L.xz(ox, oz), qy = gy(ox, oz);
    props.col = PAL.timberDark;
    cylinder(props, q[0], qy - 0.5, q[1], 0.16, 11.6, 6);
    box(B.acc(m.glowCold), q[0], qy + 10.8, q[1], 1.2, 0.5, 0.6, ry);
  }
  const sq = L.xz(-34, 22), sgy = gy(-34, 22);
  near.col = PAL.timberDark;
  for (const o of [-1.2, 1.2]) { const q = L.xz(-34 + o, 22); box(near, q[0], sgy - 0.4, q[1], 0.2, 3.2, 0.2, ry); }
  board(B.acc(m.signs), sq[0], sgy + 2.0, sq[1], 2.4, 2.4, ry, cellUV(6), cellUV(7, 4, 2, 0.02));
}

/** A glow that breathes like a fire (night only). */
function fireFlicker(mat, base) {
  return (t) => {
    const k = 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) + 0.1 * Math.sin(t * 17.0);
    mat.emissiveIntensity = base * U.night.value * k;
  };
}

// ------------------------------------------------------------------ the fire lookout

function fireTower3d(B, m, it) {
  const { x, z, y, ry } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props);
  const H = 16;
  // four splayed timber legs, each from its own footing on the rock (y: the
  // highest foot), cross-braced storey by storey above it
  const top = y + H;
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const feet = C.map(([sx, sz]) => { const q = L.xz(sx * 3.6, sz * 3.6); return [q[0], B.groundY(q[0], q[1]) - 0.5, q[1]]; });
  const footOf = (sx, sz) => feet[C.findIndex((c) => c[0] === sx && c[1] === sz)];
  const legAt = (sx, sz, h) => {
    const f = footOf(sx, sz), q = L.xz(sx * 2.2, sz * 2.2);
    const t = (h - f[1]) / (top - f[1]);
    return [f[0] + (q[0] - f[0]) * t, h, f[2] + (q[1] - f[2]) * t];
  };
  const leg = (sx, sz, t) => legAt(sx, sz, y - 0.5 + t * (H + 0.5));
  props.col = PAL.timber;
  for (const [sx, sz] of C) props.beam(...footOf(sx, sz), ...legAt(sx, sz, top), 0.4, 0.4);
  // concrete footings under the legs
  props.col = PAL.stone;
  for (const f of feet) box(props, f[0], f[1] - 0.6, f[2], 1.2, 1.4, 1.2, ry);
  for (let lv = 0; lv < 4; lv++) {
    const t0 = lv / 4, t1 = (lv + 1) / 4;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4];
      props.beam(...leg(ax, az, t1), ...leg(bx, bz, t1), 0.22, 0.22);
      props.beam(...leg(ax, az, t0), ...leg(bx, bz, t1), 0.12, 0.12);
      props.beam(...leg(bx, bz, t0), ...leg(ax, az, t1), 0.12, 0.12);
    }
  }
  // the stairs: flights zig-zagging up one side
  props.col = PAL.timberDark;
  for (let f = 0; f < 4; f++) {
    const t0 = f / 4, t1 = (f + 1) / 4;
    const s = f % 2 ? -1 : 1;
    const a = L.xz(s * 1.6, 3.8 - t0 * 1.2), b = L.xz(-s * 1.6, 3.8 - t1 * 1.2);
    props.beam(a[0], y + t0 * H, a[1], b[0], y + t1 * H, b[1], 0.9, 0.12);
  }
  // the cab: windows all round (lit), a catwalk with its rail, a hipped roof
  const cy = y + H;
  props.col = PAL.timberDark;
  box(props, x, cy - 0.3, z, 7.2, 0.3, 7.2, ry);
  props.col = PAL.timber;
  box(props, x, cy, z, 4.8, 1.0, 4.8, ry, { top: false });
  box(B.acc(m.glowWarm), x, cy + 1.0, z, 4.7, 1.5, 4.7, ry, { top: false });
  props.col = PAL.timber;
  box(props, x, cy + 2.5, z, 4.8, 0.3, 4.8, ry);
  props.col = PAL.roof;
  hip(props, x, cy + 2.8, z, 5.2, 5.2, 1.7, ry, { over: 0.8 });
  const rc = [L.xz(-3.5, -3.5), L.xz(3.5, -3.5), L.xz(3.5, 3.5), L.xz(-3.5, 3.5)];
  for (let k = 0; k < 4; k++) {
    const a = rc[k], b = rc[(k + 1) % 4];
    railing(props, [a[0], cy, a[1]], [b[0], cy, b[1]], 1.0, PAL.timberDark, 1.8, 0.08);
  }
  // an antenna and a light on top
  props.col = PAL.steel;
  cylinder(props, x, cy + 4.4, z, 0.05, 4, 4);
}

// ------------------------------------------------------------------ Loon Lake and its camp

function lake3d(B, m, it) {
  const acc = B.acc(m.water);
  const { x0, z0, g, cells, y } = it;
  // one quad per flooded cell, grown a cell all round so the shore is the ground's own edge
  const seen = new Set();
  const put = (i, j) => {
    const k = i * 4096 + j;
    if (seen.has(k)) return;
    seen.add(k);
    const x = x0 + i * g - g / 2, z = z0 + j * g - g / 2;
    if (B.groundY(x + g / 2, z + g / 2) > y + 1.2) return;
    // (not over a road; the lake's own cells are claimed, so ITEM can't be the test)
    if (B.D.occ.get(x + g / 2, z + g / 2) & ROAD) return;
    acc.quadP([x, y, z + g], [x + g, y, z + g], [x + g, y, z], [x, y, z], [x / 20, z / 20, (x + g) / 20, (z + g) / 20]);
  };
  for (let k = 0; k < cells.length; k += 2) {
    const i = cells[k], j = cells[k + 1];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(i + a, j + b);
  }
}

function camp3d(B, m, it) {
  const { x, z, y, ry } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props), near = B.near(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  // tents: A-frames in orange, green, blue
  const cols = [PAL.tent1, PAL.tent2, PAL.tent3];
  for (let k = 0; k < it.tents.length; k++) {
    const [lx, lz, a] = it.tents[k], col = cols[k % 3];
    const q = L.xz(lx, lz), ty = gy(lx, lz);
    const P = frame(q[0], ty, q[1], ry + a);
    near.col = col;
    const A = P(-1.4, 0, 1.6), Bq = P(1.4, 0, 1.6), C = P(1.4, 0, -1.6), D = P(-1.4, 0, -1.6), R0 = P(0, 1.7, 1.6), R1 = P(0, 1.7, -1.6);
    near.quadP(A, D, R1, R0); near.quadP(C, Bq, R0, R1);
    near.col = mulc(col, 0.5);
    const t0 = [near.v(...A), near.v(...Bq), near.v(...R0)];
    near.tri(t0[0], t0[1], t0[2]);
    const t1 = [near.v(...C), near.v(...D), near.v(...R1)];
    near.tri(t1[0], t1[1], t1[2]);
  }
  // the fire: a ring of stones, logs, the flames (their own flickering mesh)
  const [fx, fz] = L.xz(0, 0);
  const fy = gy(0, 0);
  const rocks = B.near(m.rock);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; F.rock(rocks, fx + Math.cos(a) * 0.9, fy, fz + Math.sin(a) * 0.9, 0.42, 0.6, k / 8, PAL.rock, PAL.rockDark); }
  box(B.acc(m.fire), fx, fy - 0.1, fz, 0.9, 0.2, 0.9, ry);
  const fl = new Acc(false);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    const c = Math.cos(a) * 0.45, s = Math.sin(a) * 0.45;
    fl.quadP([-c, 0, -s], [c, 0, s], [c * 0.2, 1.3, s * 0.2], [-c * 0.2, 1.3, -s * 0.2]);
  }
  const flame = new THREE.Mesh(fl.toGeometry(false), m.flame);
  flame.position.set(fx, fy + 0.05, fz);
  B.group.add(flame);
  B.anim((t) => { const k = 0.8 + 0.25 * Math.sin(t * 9) * Math.sin(t * 4.3 + 2); flame.scale.set(1, k * (0.6 + 0.4 * U.night.value), 1); flame.rotation.y = t * 0.7; });
  // a picnic table, a camp chair, a lantern
  const [tlx, tlz] = it.table;
  const tq = L.xz(tlx, tlz), ty = gy(tlx, tlz);
  near.col = PAL.plank;
  box(near, tq[0], ty + 0.75, tq[1], 1.8, 0.08, 0.8, ry);
  for (const o of [-0.65, 0.65]) { const q = L.xz(tlx, tlz + o); box(near, q[0], ty + 0.42, q[1], 1.8, 0.06, 0.28, ry); }
  for (const o of [-0.7, 0.7]) { const q = L.xz(tlx + o, tlz); box(near, q[0], ty, q[1], 0.08, 0.75, 1.4, ry); }
  const lq = L.xz(tlx + 0.4, tlz);
  box(B.acc(m.glowWarm), lq[0], ty + 0.83, lq[1], 0.2, 0.3, 0.2, ry);
  // the canoe drawn up on the shore, a little dock out into the water
  const sx = it.sx, sz = it.sz;
  const toS = Math.atan2(sx - x, sz - z);
  const cq = [x + (sx - x) * 0.6, z + (sz - z) * 0.6];
  const cyy = B.groundY(cq[0], cq[1]);
  const Pc = frame(cq[0], Math.max(cyy, it.level - 0.2), cq[1], toS + 1.2);
  near.col = PAL.canoe;
  const hull = [[-2.6, 0], [-1.8, 0.42], [0, 0.48], [1.8, 0.42], [2.6, 0], [1.8, -0.42], [0, -0.48], [-1.8, -0.42]];
  prism(near, hull.map(([a, b]) => [a, b]), Pc.x, Pc.z, Pc.y, Pc.y + 0.42, Pc.ry + Math.PI / 2, { top: false });
  near.col = PAL.plank;
  const Pd = frame(sx, it.level, sz, toS);
  for (let k = 0; k < 4; k++) { const q = Pd(0, 0, -2 + k * 2.4); box(near, q[0], it.level + 0.25, q[2], 1.8, 0.14, 2.3, toS); }
  for (const ox of [-0.8, 0.8]) for (let k = 0; k < 3; k++) { const q = Pd(ox, 0, -1 + k * 3); box(near, q[0], it.level - 2, q[2], 0.18, 2.4, 0.18, toS); }
  // the camper pickup by the road's end
  if (it.truck) truckCamper(props, L, it.truck[0], it.truck[1], gy(it.truck[0], it.truck[1]), ry);
}

function truckCamper(acc, L, lx, lz, y, ry) {
  const q = L.xz(lx, lz);
  const P = frame(q[0], y, q[1], ry);
  const bx = (ox, oy, oz, w, h, d, col) => { acc.col = col; const p = P(ox, oy, oz); box(acc, p[0], p[1], p[2], w, h, d, ry); };
  bx(0, 0.5, 0, 2.0, 1.0, 5.4, lin('#3a5a7a'));
  bx(0, 1.5, 1.4, 1.9, 0.9, 1.8, lin('#3a5a7a'));
  bx(0, 1.5, -1.3, 2.1, 1.6, 2.9, PAL.white);
  for (const oz of [1.7, -1.6]) for (const ox of [-0.95, 0.95]) bx(ox, 0, oz, 0.3, 0.75, 0.75, PAL.black);
}

// ------------------------------------------------------------------ the falls

function falls3d(B, m, it) {
  const { x, z, ry, y, top } = it;
  const L = frame(x, y, z, ry);
  const face = B.acc(m.face), rocks = B.acc(m.rock);
  // the rock wall: a buttress standing out of the hillside, its face looking down at the pool
  const W = 34, Dp = 24;
  const poly = [[-W / 2, 0], [W / 2, 0], [W / 2 + 3, -Dp], [-W / 2 - 3, -Dp]];
  prism(face, poly.map(([a, b]) => [a, b]), x, z, y - 4, top, ry, { u: 6, v: 6, top: true, topU: 6 });
  // ledges and boulders breaking up the top and the sides
  for (const [lx, lz, s] of [[-14, -2, 6], [14, -3, 6.5], [-8, -18, 8], [9, -16, 7], [0, -22, 8], [-18, 4, 3.5], [18, 3, 4]]) {
    const q = L.xz(lx, lz);
    F.rock(rocks, q[0], lz < -5 ? top - 1 : B.groundY(q[0], q[1]), q[1], s, 0.8, (lx + 30) / 60, mixc(PAL.rock, PAL.moss, 0.4), PAL.rockDark, PAL.moss, 0.7);
  }
  // the water: a curtain off the lip, a stream along the ledge to it, the pool, foam and spray
  const fall = B.acc(m.fall);
  const hw = 2.4;
  const lip = (lx, dz) => L(lx, top - y, dz);
  for (const off of [0.5, 1.1]) {
    const a = L(-hw, -0.2, off), b = L(hw, -0.2, off), c = L(hw, top - y + 0.2, off - 0.4), d = L(-hw, top - y + 0.2, off - 0.4);
    fall.quadP(a, b, c, d, [0, 0, 1, (top - y) / 8]);
  }
  const s0 = lip(-1.6, -Dp + 2), s1 = lip(1.6, -Dp + 2), s2 = lip(hw, 0.2), s3 = lip(-hw, 0.2);
  fall.quadP([s3[0], s3[1] + 0.15, s3[2]], [s2[0], s2[1] + 0.15, s2[2]], [s1[0], s1[1] + 0.15, s1[2]], [s0[0], s0[1] + 0.15, s0[2]], [0, 0, 1, Dp / 8]);
  B.anim(scrollFall(m.fall));
  const water = B.acc(m.water);
  const pool = [];
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; pool.push(L.xz(Math.cos(a) * 10, 9 + Math.sin(a) * 8)); }
  const py = y + 0.35;
  const pc = L.xz(0, 9);
  const ci = water.v(pc[0], py, pc[1], 0, 0);
  const ring = pool.map((p) => water.v(p[0], py, p[1], p[0] / 20, p[1] / 20));
  for (let k = 0; k < ring.length; k++) water.tri(ci, ring[(k + 1) % ring.length], ring[k]);
  const foam = B.acc(m.foam);
  for (const [lx, lz, s] of [[0, 1.5, 2.6], [-2, 2.6, 1.6], [2.2, 2.4, 1.8], [0, 3.8, 1.3]]) {
    const q = L.xz(lx, lz);
    sphere(foam, q[0], py - 0.2, q[1], s, 8, { dome: true, sy: 0.5 });
  }
  // boulders round the pool's rim
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.3;
    const q = L.xz(Math.cos(a) * 11, 9 + Math.sin(a) * 9);
    if (Math.sin(a) < -0.6) continue;
    F.rock(rocks, q[0], B.groundY(q[0], q[1]), q[1], 1.6 + (k % 3) * 0.7, 0.7, k / 12, mixc(PAL.rock, PAL.moss, 0.5), PAL.rockDark, PAL.moss, 0.6);
  }
}

function scrollFall(mat) {
  return (t) => { if (mat.map) mat.map.offset.y = -t * 0.9; };
}

// ------------------------------------------------------------------ cabins

function cabin3d(B, m, it) {
  const { x, z, ry, y, lo, w, d } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props), near = B.near(m.props);
  // a stone footing, log walls, a steep green roof, a stone chimney, the porch
  props.col = PAL.stone;
  box(props, x, lo - 1, z, w - 2.4, y - lo + 1.1, d - 2.4, ry);
  box(B.acc(m.cabin), x, y, z, w - 2.4, 3.2, d - 2.4, ry, { u: 6, v: 3, top: false });
  props.col = PAL.timber;
  gable(props, x, y + 3.2, z, w - 2.4, d - 2.4, 2.6, ry, { over: 0, endAcc: props });
  props.col = it.v % 2 ? PAL.roof : lin('#5a2a22');
  gable(props, x, y + 3.2, z, w - 2.4, d - 2.4, 2.6, ry, { over: 0.9 });
  props.col = PAL.stone;
  const ch = L.xz(-(w - 2.4) / 2 + 0.4, -1);
  box(props, ch[0], lo - 0.5, ch[1], 1.2, y - lo + 7.6, 1.2, ry);
  // the porch along the front: a deck, posts, its own little roof, a lamp by the door
  props.col = PAL.timberDark;
  const pd = L.xz(0, (d - 2.4) / 2 + 1.2);
  box(props, pd[0], y - 0.4, pd[1], w - 2.4, 0.4, 2.4, ry);
  for (const lx of [-(w - 2.4) / 2 + 0.2, 0, (w - 2.4) / 2 - 0.2]) { const q = L.xz(lx, (d - 2.4) / 2 + 2.2); box(props, q[0], y - 0.5, q[1], 0.2, 3.3, 0.2, ry); }
  const P = frame(x, y, z, ry);
  props.col = it.v % 2 ? PAL.roof : lin('#5a2a22');
  const r0 = P(-(w - 2.4) / 2 - 0.3, 3.0, (d - 2.4) / 2), r1 = P((w - 2.4) / 2 + 0.3, 3.0, (d - 2.4) / 2), r2 = P((w - 2.4) / 2 + 0.3, 2.5, (d - 2.4) / 2 + 2.6), r3 = P(-(w - 2.4) / 2 - 0.3, 2.5, (d - 2.4) / 2 + 2.6);
  props.quadP(r3, r2, r1, r0);
  props.quadP(r0, r1, r2, r3);
  const lq = L.xz(2.4, (d - 2.4) / 2 + 0.15);
  box(B.acc(m.glowWarm), lq[0], y + 2.1, lq[1], 0.22, 0.32, 0.2, ry);
  // a woodpile, a chopping block, a bench on the porch
  const wq = L.xz((w - 2.4) / 2 + 1.2, -1);
  logPile(near, L, (w - 2.4) / 2 + 1.0, -1.4, B.groundY(wq[0], wq[1]), 2.2, 3, ry, Math.PI / 2);
  const bq = L.xz(-2.2, (d - 2.4) / 2 + 1.0);
  bench(near, bq[0], y, bq[1], ry, 1.8, PAL.timber, PAL.timberDark);
}

export default {
  id: 'wilds',
  plan,
  scatter,
  *warm(B) { mats(B); yield* warmUp(B, this, 'wilds'); },
  build,
};

void cone; void mulc;
