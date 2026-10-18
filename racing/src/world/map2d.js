// The map of PORT HALCYON (M / touchpad in free roam): the land as a
// picture (made once a page, a slice at a time: relief-shaded ground in the
// world's own colours, the bay, the lake and the river), the roads drawn
// over it as lines (sharp at any zoom, highways glowing amber), the
// districts' names, the buildings once you zoom in, the places you've found
// (and the ones you've only heard of), your garage, and you.
import { BOUNDS, DISTRICTS, GARAGE } from './map/base.js';
import { natural, waterAt } from './terrain.js';
import { groundColor } from './ground.js';
import { centroid } from './geom.js';
import { C, text, vText } from '../core/ui.js';

const MPP = 24;                 // the base picture's metres per pixel
const CLASS = {
  freeway: 0, expressway: 0, ramp: 0,
  highway: 1, coastal: 1, mountain: 1, strip: 1,
  avenue: 2, boulevard: 2, street: 2, cobble: 2, quay: 2, boardwalk: 2, circuit: 2,
  alley: 3, service: 3, dirt: 4, gravel: 4,
};
const ROAD_STYLE = [
  { w: 9, c: '#ffc04a', glow: true },
  { w: 6, c: '#f2e6c8' },
  { w: 4.2, c: '#c9ced8' },
  { w: 2.6, c: '#8d939e' },
  { w: 2.6, c: '#b08a62', dash: [6, 5] },
];

export class WorldMap {
  constructor(net, districts) {
    this.net = net;
    this.districts = districts;
    this.W = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / MPP);
    this.H = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / MPP);
    this.ready = false;
    this.labels = DISTRICTS.map((d) => { const c = centroid(d.poly); return { name: d.name, x: c[0], z: c[1] }; });
  }

  /** The base picture, a slice at a time (a generator). */
  *build() {
    const W = this.W, H = this.H;
    const hs = new Float32Array(W * H);
    const wy = new Float32Array(W * H).fill(-1e9);
    const kind = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) {
      const z = BOUNDS.z0 + (j + 0.5) * MPP;
      for (let i = 0; i < W; i++) {
        const x = BOUNDS.x0 + (i + 0.5) * MPP;
        const k = j * W + i;
        hs[k] = natural(x, z);
        const w = waterAt(x, z);
        if (w && w.y > hs[k] - 0.2) { wy[k] = w.y; kind[k] = w.kind === 'sea' ? 1 : 2; }
      }
      if (j % 12 === 11) yield;
    }
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const c = [0, 0, 0];
    for (let j = 0; j < H; j++) {
      const z = BOUNDS.z0 + (j + 0.5) * MPP;
      for (let i = 0; i < W; i++) {
        const x = BOUNDS.x0 + (i + 0.5) * MPP;
        const k = j * W + i;
        let r, g, b;
        if (kind[k]) {
          const depth = Math.max(0, wy[k] - hs[k]);
          if (kind[k] === 1) { const t = Math.min(1, depth / 14); r = 18 - t * 8; g = 52 - t * 18; b = 84 - t * 20; }
          else { r = 34; g = 92; b = 132; }
        } else {
          const hx = hs[j * W + Math.min(W - 1, i + 1)] - hs[j * W + Math.max(0, i - 1)];
          const hz = hs[Math.min(H - 1, j + 1) * W + i] - hs[Math.max(0, j - 1) * W + i];
          const ny = (2 * MPP) / Math.hypot(hx, 2 * MPP, hz);
          groundColor(x, z, hs[k], ny, 0, c);
          // light from the north-west, and a touch more colour than the ground has
          const shade = Math.max(0.55, Math.min(1.35, 1 + (-hx * 0.55 - hz * 0.45) / (2 * MPP) * 1.6));
          const avg = (c[0] + c[1] + c[2]) / 3;
          r = (avg + (c[0] - avg) * 1.25) * shade * 255;
          g = (avg + (c[1] - avg) * 1.25) * shade * 255;
          b = (avg + (c[2] - avg) * 1.25) * shade * 255;
          // the shoreline: a pale rim where land meets water
          if (kind[k - 1] || kind[k + 1] || kind[k - W] || kind[k + W]) { r = r * 0.6 + 200 * 0.4; g = g * 0.6 + 190 * 0.4; b = b * 0.6 + 150 * 0.4; }
        }
        img.data[k * 4] = r; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = 255;
      }
      if (j % 16 === 15) yield;
    }
    ctx.putImageData(img, 0, 0);
    this.base = canvas;
    yield;
    // the roads as lines, one path per kind of road
    this.paths = ROAD_STYLE.map(() => new Path2D());
    let n = 0;
    for (const r of this.net.roads) {
      const p = this.paths[CLASS[r.rt.id] ?? 2];
      const step = Math.max(1, Math.round(6 / r.step));
      p.moveTo(r.X[0], r.Z[0]);
      for (let i = step; i < r.N; i += step) p.lineTo(r.X[i], r.Z[i]);
      p.lineTo(r.X[r.N - 1], r.Z[r.N - 1]);
      if (r.closed) p.lineTo(r.X[0], r.Z[0]);
      if (++n % 200 === 0) yield;
    }
    // the buildings, for zooming in
    this.foot = [];
    for (const items of this.districts.items.values()) {
      for (const it of items) {
        if (!it.w || !it.d || it.w * it.d < 30) continue;
        this.foot.push(it);
      }
    }
    this.ready = true;
  }

  /**
   * Draw the map. view: { cx, cz (world point at the middle), mpp (metres per
   * screen pixel) }. o: { car: {x, z, heading}, places: [{…, found}], starts: [{x, z, name}], sel, t }
   */
  draw(ctx, view, o) {
    const SW = 1024, SH = 768;
    const s = 1 / view.mpp;
    const ox = SW / 2 - view.cx * s, oz = SH / 2 - view.cz * s;
    const X = (x) => ox + x * s, Z = (z) => oz + z * s;
    ctx.save();
    ctx.fillStyle = '#0d2236';
    ctx.fillRect(0, 0, SW, SH);
    if (this.base) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.base, X(BOUNDS.x0), Z(BOUNDS.z0), (BOUNDS.x1 - BOUNDS.x0) * s, (BOUNDS.z1 - BOUNDS.z0) * s);
    }
    // buildings when close
    if (this.foot && view.mpp < 3.2) {
      const x0 = view.cx - SW / 2 * view.mpp - 40, x1 = view.cx + SW / 2 * view.mpp + 40;
      const z0 = view.cz - SH / 2 * view.mpp - 40, z1 = view.cz + SH / 2 * view.mpp + 40;
      ctx.globalAlpha = Math.min(1, (3.2 - view.mpp) / 1.2) * 0.85;
      for (const it of this.foot) {
        if (it.x < x0 || it.x > x1 || it.z < z0 || it.z > z1) continue;
        ctx.fillStyle = it.map === 'park' ? '#3f6b34' : it.map === 'field' ? '#8a8a46' : it.map === 'plaza' ? '#8e8a80' : it.map === 'water' ? '#2a5c84' : '#3a3d46';
        const c = Math.cos(it.ry || 0), sn = Math.sin(it.ry || 0);
        const hw = it.w / 2, hd = it.d / 2;
        ctx.beginPath();
        for (const [a, b] of [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]]) {
          const px = it.x + a * c + b * sn, pz = it.z - a * sn + b * c;
          ctx.lineTo(X(px), Z(pz));
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // roads
    if (this.paths) {
      ctx.save();
      ctx.setTransform(s, 0, 0, s, ox, oz);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const zoomK = Math.max(0.45, Math.min(1.6, 4 / view.mpp));
      for (let pass = 0; pass < 2; pass++) {
        for (let k = ROAD_STYLE.length - 1; k >= 0; k--) {
          const st = ROAD_STYLE[k];
          if (k >= 3 && view.mpp > 9) continue;
          ctx.setLineDash(pass && st.dash ? st.dash.map((v) => v * view.mpp) : []);
          ctx.strokeStyle = pass ? st.c : 'rgba(0,0,0,0.65)';
          ctx.lineWidth = ((pass ? st.w : st.w + 2.4) * zoomK) * view.mpp;
          ctx.stroke(this.paths[k]);
        }
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
    // district names
    const lsz = Math.max(10, Math.min(22, 120 / view.mpp));
    for (const L of this.labels) {
      const x = X(L.x), y = Z(L.z);
      if (x < -100 || x > SW + 100 || y < -40 || y > SH + 40) continue;
      text(ctx, L.name, x, y, { size: lsz, color: 'rgba(255,255,255,0.78)', weight: 900, spacing: lsz * 0.18, align: 'center', outline: 3 });
    }
    // places
    for (const p of o.places || []) {
      if (p.hidden && !p.found) continue;
      const x = X(p.x), y = Z(p.z);
      if (x < -20 || x > SW + 20 || y < -20 || y > SH + 20) continue;
      const sel = o.sel === p;
      const r = sel ? 9 : 6.5;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
      ctx.fillStyle = p.found ? (p.hidden ? '#ff5ac8' : C.cyan) : 'rgba(140,150,165,0.8)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.8)';
      ctx.stroke();
      if (p.found && (sel || view.mpp < 7)) text(ctx, p.name, x + 12, y + 4, { size: sel ? 13 : 10, color: sel ? '#fff' : 'rgba(230,240,255,0.85)', weight: 800, spacing: 1, outline: 3 });
      else if (!p.found && sel) text(ctx, '???', x + 12, y + 4, { size: 13, color: '#fff', weight: 800, outline: 3 });
    }
    // the race starts (chequered squares, the track's name close up)
    for (const p of o.starts || []) {
      const x = X(p.x), y = Z(p.z);
      if (x < -20 || x > SW + 20 || y < -20 || y > SH + 20) continue;
      const sel = o.sel === p;
      const k = sel ? 6 : 4.5;
      ctx.fillStyle = sel ? '#fff' : 'rgba(0,0,0,0.85)';
      ctx.fillRect(x - k - 2, y - k - 2, k * 2 + 4, k * 2 + 4);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#ffb03a' : '#fff';
        ctx.fillRect(x - k + i * k, y - k + j * k, k, k);
      }
      if (sel || view.mpp < 4.5) text(ctx, p.name, x + 11, y + 4, { size: sel ? 13 : 10, color: sel ? '#fff' : '#ffd08a', weight: 900, spacing: 1, outline: 3 });
    }
    // your garage
    {
      const x = X(GARAGE.x), y = Z(GARAGE.z);
      const sel = o.sel?.garage;
      ctx.fillStyle = sel ? '#fff' : C.accent;
      ctx.beginPath();
      ctx.moveTo(x, y - 11); ctx.lineTo(x + 9, y - 3); ctx.lineTo(x + 9, y + 8); ctx.lineTo(x - 9, y + 8); ctx.lineTo(x - 9, y - 3); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      if (sel || view.mpp < 6) text(ctx, 'YOUR GARAGE', x + 13, y + 4, { size: sel ? 13 : 10, color: '#fff', weight: 900, spacing: 1, outline: 3 });
    }
    // you
    if (o.car) {
      const x = X(o.car.x), y = Z(o.car.z);
      const pulse = 1 + Math.sin((o.t || 0) * 5) * 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI - o.car.heading);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(8.5, 9); ctx.lineTo(0, 4.5); ctx.lineTo(-8.5, 9); ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.shadowColor = C.cyan; ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Screen position of a world point for the given view. */
  toScreen(view, x, z) {
    return [1024 / 2 + (x - view.cx) / view.mpp, 768 / 2 + (z - view.cz) / view.mpp];
  }
}

void vText;
