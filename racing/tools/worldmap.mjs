// Render the PORT HALCYON world map to a PNG (node only, no browser): the
// land (shaded relief + height tint), water, district outlines, roads by
// type, junctions, course routes, landmarks. For checking the layout.
//   node racing/tools/worldmap.mjs [out.png] [mPerPixel=8] [x0,z0,x1,z1]
//   flags: --nat (natural ground, no roads) --courses --labels-off
//          --plan (the districts' plans: footprints filled by pack, colliders,
//          lamps, landmarks; plus each cell's scatter when the area is small)
//          --district=<id> (frame that district; mPerPixel defaults to 2)
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../src/', import.meta.url).pathname;
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const pos = args.filter((a) => !a.startsWith('--'));
const out = pos[0] || 'worldmap.png';
const mpp = Number(pos[1] || (args.some((a) => a.startsWith('--district=')) ? 2 : 8));
const base = await import(`${ROOT}world/map/base.js`);
const { natural, waterAt } = await import(`${ROOT}world/terrain.js`);
let world = null;
if (!flags.has('--nat')) {
  try { world = await import(`${ROOT}world/net.js`).then((m) => m.buildNet ? m : null); } catch (e) { console.warn('no road net yet:', e.message); }
}
const distOpt = args.find((a) => a.startsWith('--district='))?.split('=')[1];
const distBox = (() => {
  if (!distOpt) return null;
  const d = base.DISTRICTS.find((q) => q.id === distOpt);
  if (!d) throw new Error('no district ' + distOpt);
  const xs = d.poly.map((p) => p[0]), zs = d.poly.map((p) => p[1]);
  return { x0: Math.min(...xs) - 60, z0: Math.min(...zs) - 60, x1: Math.max(...xs) + 60, z1: Math.max(...zs) + 60 };
})();
const B = pos[2] ? (() => { const [x0, z0, x1, z1] = pos[2].split(',').map(Number); return { x0, z0, x1, z1 }; })() : distBox || base.BOUNDS;
const W = Math.round((B.x1 - B.x0) / mpp), H = Math.round((B.z1 - B.z0) / mpp);
const img = new Uint8ClampedArray(W * H * 4);
const t0 = Date.now();

// ---- relief
const hs = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) hs[j * W + i] = natural(B.x0 + (i + 0.5) * mpp, B.z0 + (j + 0.5) * mpp);
let net = null, terrain = null;
if (world) {
  const t1 = Date.now();
  net = world.buildNet();
  console.log(`road net: ${net.roads.length} roads, ${net.nodes.size} nodes, ${(net.totalLength / 1000).toFixed(1)} km in ${Date.now() - t1} ms`);
  if (!flags.has('--fast')) {
    const { Terrain } = await import(`${ROOT}world/terrain.js`);
    terrain = new Terrain(net);
    // graded ground where the grids are cheap (sample through the res-16 grids)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = B.x0 + (i + 0.5) * mpp, z = B.z0 + (j + 0.5) * mpp;
        const g = terrain.grid(Math.floor(x / 256), Math.floor(z / 256), 16);
        const fi = Math.min(g.n - 1, Math.round((x - g.x0) / g.res)), fj = Math.min(g.n - 1, Math.round((z - g.z0) / g.res));
        hs[j * W + i] = g.H[g.at(fi, fj)];
      }
    }
  }
}
const tint = (h) => {
  const stops = [[-15, [40, 70, 110]], [0, [60, 100, 140]], [1, [200, 190, 150]], [8, [120, 150, 90]], [40, [100, 130, 70]], [120, [140, 130, 90]], [260, [130, 110, 90]], [450, [150, 145, 140]], [650, [235, 238, 242]]];
  for (let k = 0; k < stops.length - 1; k++) {
    const [h0, c0] = stops[k], [h1, c1] = stops[k + 1];
    if (h <= h1 || k === stops.length - 2) {
      const t = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
      return c0.map((c, q) => c + (c1[q] - c) * t);
    }
  }
  return [255, 0, 255];
};
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const h = hs[k];
    const hx = hs[j * W + Math.min(W - 1, i + 1)] - hs[j * W + Math.max(0, i - 1)];
    const hz = hs[Math.min(H - 1, j + 1) * W + i] - hs[Math.max(0, j - 1) * W + i];
    const shade = Math.max(0.45, Math.min(1.3, 1 + (-hx * 0.7 - hz * 0.5) / (2 * mpp)));
    let c = tint(h).map((v) => v * shade);
    const w = waterAt(B.x0 + (i + 0.5) * mpp, B.z0 + (j + 0.5) * mpp);
    if (w && h < w.y) {
      const depth = w.y - h;
      c = w.kind === 'sea' ? [30, 70 - Math.min(30, depth), 120 - Math.min(40, depth * 2)] : [40, 95, 150];
    }
    img[k * 4] = c[0]; img[k * 4 + 1] = c[1]; img[k * 4 + 2] = c[2]; img[k * 4 + 3] = 255;
  }
}

// ---- drawing helpers
const px = (x) => (x - B.x0) / mpp, pz = (z) => (z - B.z0) / mpp;
function dot(i, j, c, a = 1) {
  i = Math.round(i); j = Math.round(j);
  if (i < 0 || j < 0 || i >= W || j >= H) return;
  const k = (j * W + i) * 4;
  img[k] = img[k] * (1 - a) + c[0] * a; img[k + 1] = img[k + 1] * (1 - a) + c[1] * a; img[k + 2] = img[k + 2] * (1 - a) + c[2] * a;
}
function line(x0, z0, x1, z1, c, wpx = 1, a = 1) {
  const i0 = px(x0), j0 = pz(z0), i1 = px(x1), j1 = pz(z1);
  const n = Math.max(1, Math.ceil(Math.hypot(i1 - i0, j1 - j0) * 2));
  const r = Math.max(0, (wpx - 1) / 2);
  for (let s = 0; s <= n; s++) {
    const i = i0 + (i1 - i0) * s / n, j = j0 + (j1 - j0) * s / n;
    if (r < 0.5) dot(i, j, c, a);
    else for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) if (di * di + dj * dj <= r * r + 0.3) dot(i + di, j + dj, c, a);
  }
}
function poly(P, c, a = 0.8) { for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; line(p[0], p[1], q[0], q[1], c, 1, a); } }

// ---- districts
for (const d of base.DISTRICTS) poly(d.poly, [255, 255, 255], 0.35);

// ---- roads
const ROADC = {
  freeway: [255, 200, 60], expressway: [255, 160, 40], ramp: [240, 170, 60], highway: [250, 240, 200], coastal: [250, 230, 180],
  mountain: [255, 255, 255], avenue: [235, 235, 240], boulevard: [255, 255, 255], street: [200, 200, 205], cobble: [220, 190, 160],
  alley: [150, 150, 150], service: [170, 170, 170], circuit: [255, 60, 60], strip: [255, 90, 90], dirt: [170, 120, 80], gravel: [190, 170, 140],
  quay: [210, 210, 120], boardwalk: [200, 150, 90],
};
if (net) {
  for (const r of net.roads) {
    const c = ROADC[r.rt.id] || [255, 0, 255];
    const wpx = Math.max(1, Math.round((r.rt.hw * 2) / mpp));
    for (let i = 0; i < r.N - 1; i += 1) {
      const f = r.flags[i];
      const cc = f & 1 ? [120, 220, 255] : f & 2 ? [90, 90, 90] : f & 4 ? [255, 120, 220] : c;
      line(r.X[i], r.Z[i], r.X[i + 1], r.Z[i + 1], cc, wpx);
    }
  }
  for (const n of net.nodes.values()) if (n.ends.length >= 3) dot(px(n.x), pz(n.z), [255, 40, 40]);
  if (flags.has('--courses')) {
    // every race course: its line (a colour each), its start, the side roads closed off
    const { COURSES, buildCourse } = await import(`${ROOT}world/course.js`);
    const { Track } = await import(`${ROOT}track/track.js`);
    const only = args.find((a) => a.startsWith('--course='))?.split('=')[1];
    let k = 0;
    for (const id of Object.keys(COURSES)) {
      if (only && id !== only) continue;
      const c = buildCourse(id, net);
      const T = new Track({ id, type: c.loop ? 'circuit' : 'sprint', points: c.points, width: 14, bank: 0, radius: 30, startS: COURSES[id].start });
      const col = [[255, 60, 200], [80, 255, 120], [255, 160, 40], [90, 170, 255], [255, 255, 80], [200, 120, 255]][k++ % 6];
      for (let i = 0; i < T.N - 1; i++) line(T.X[i], T.Z[i], T.X[i + 1], T.Z[i + 1], col, Math.max(2, Math.round(T.W[i] * 2 / mpp)), 0.7);
      const s = T.posAt(T.startS);
      for (let a = 0; a < 6.3; a += 0.2) dot(px(s.x) + Math.cos(a) * 6, pz(s.z) + Math.sin(a) * 6, [255, 255, 255]);
      for (const J of c.junctions) {
        for (const e of J.side) {
          const rt = e.road.rt, w = rt.hw + rt.shoulder + rt.walk;
          const bx = J.node.x + e.dx * (e.trim + 1), bz = J.node.z + e.dz * (e.trim + 1);
          line(bx - e.dz * w, bz + e.dx * w, bx + e.dz * w, bz - e.dx * w, [255, 40, 40], 2, 1);
        }
      }
    }
  }
}
// ---- the districts' plans
if (net && (flags.has('--plan') || distOpt)) {
  const { Districts } = await import(`${ROOT}world/districts/index.js`);
  const { CELL } = await import(`${ROOT}world/terrain.js`);
  const D = new Districts(net, terrain || new (await import(`${ROOT}world/terrain.js`)).Terrain(net));
  const t1 = Date.now();
  D.planNow();
  console.log(`plan: ${D.stats.items} items, ${D.stats.colliders} colliders, ${D.stats.lamps} lamps, ${D.stats.far} far shapes in ${Date.now() - t1} ms`);
  const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const a = (h % 360) / 60, f = a - Math.floor(a); const q = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][Math.floor(a) % 6]; return q.map((v) => 90 + v * 165); };
  const rect = (x, z, w, d, ry, c, fill = 0.35) => {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const P = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    const C4 = [P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2)];
    // fill by scanning the box in pixel steps
    if (fill > 0) {
      const st = Math.max(0.5, mpp * 0.7);
      for (let a = -w / 2; a <= w / 2; a += st) for (let b = -d / 2; b <= d / 2; b += st) { const p = P(a, b); dot(px(p[0]), pz(p[1]), c, fill); }
    }
    poly(C4, c, 0.95);
    // a tick on the front (+z) side
    const f = P(0, d / 2), f2 = P(0, d / 2 + Math.min(4, d * 0.2));
    line(f[0], f[1], f2[0], f2[1], c, 1, 1);
  };
  let shown = 0;
  for (const [k, items] of D.items) {
    for (const it of items) {
      if (it.x < B.x0 - 100 || it.x > B.x1 + 100 || it.z < B.z0 - 100 || it.z > B.z1 + 100) continue;
      const c = hue(it.pack + ':' + it.type);
      if (it.w && it.d) rect(it.x, it.z, it.w, it.d, it.ry || 0, c);
      else if (it.r) { for (let a = 0; a < 6.3; a += 0.2) dot(px(it.x + Math.cos(a) * it.r), pz(it.z + Math.sin(a) * it.r), c); }
      else for (let a = -1; a <= 1; a++) { dot(px(it.x) + a, pz(it.z), c); dot(px(it.x), pz(it.z) + a, c); }
      shown++;
    }
    void k;
  }
  for (const a of D.lampGrid.values()) for (const L of a) dot(px(L.hx), pz(L.hz), [255, 230, 120]);
  for (const m of D.landmarks) for (let a = -4; a <= 4; a++) { dot(px(m.x) + a, pz(m.z) + a, [255, 60, 255]); dot(px(m.x) + a, pz(m.z) - a, [255, 60, 255]); }
  // the scatter, where the area is small enough to be worth it
  const ncell = ((B.x1 - B.x0) / CELL) * ((B.z1 - B.z0) / CELL);
  if (ncell <= 160) {
    let sc = 0;
    for (let cx = Math.floor(B.x0 / CELL); cx <= Math.floor(B.x1 / CELL); cx++) {
      for (let cz = Math.floor(B.z0 / CELL); cz <= Math.floor(B.z1 / CELL); cz++) {
        const S = D.scatterCell(cx, cz);
        for (const it of S.items) { const c = hue(it.pack + ':' + it.type); if (it.w && it.d) rect(it.x, it.z, it.w, it.d, it.ry || 0, c, 0.2); else dot(px(it.x), pz(it.z), c, 0.9); sc++; }
      }
    }
    console.log(`scatter: ${sc} items in view`);
  }
  console.log(`plan items in view: ${shown}`);
}
const g = base.GARAGE;
for (let a = 0; a < 6.3; a += 0.3) dot(px(g.x) + Math.cos(a) * 4, pz(g.z) + Math.sin(a) * 4, [0, 255, 120]);

// ---- PNG
const crcT = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let j = 0; j < H; j++) { raw[j * (W * 4 + 1)] = 0; Buffer.from(img.buffer, j * W * 4, W * 4).copy(raw, j * (W * 4 + 1) + 1); }
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${out} (${W}x${H}, ${mpp} m/px) in ${Date.now() - t0} ms`);
