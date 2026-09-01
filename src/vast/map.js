// The traveler's map: fog-of-war over the real terrain colors, drag to pan,
// wheel to zoom, click an awakened shrine to fast-travel. Rendered on demand
// (open/pan/zoom), not per frame — the terrain doesn't move.

import { TYPE_GLYPH } from './hud.js';

export const EXPLORE_CELL = 96; // meters per fog cell

export const exploreKey = (x, z) =>
  Math.floor(x / EXPLORE_CELL) + ',' + Math.floor(z / EXPLORE_CELL);

// Mark everything within ~2 cells of (x,z) as seen.
export function revealAround(explored, x, z) {
  const cx = Math.floor(x / EXPLORE_CELL), cz = Math.floor(z / EXPLORE_CELL);
  let changed = false;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz > 5) continue;
      const k = (cx + dx) + ',' + (cz + dz);
      if (!explored.has(k)) { explored.add(k); changed = true; }
    }
  }
  return changed;
}

export class WorldMap {
  constructor(world, poiField, state) {
    this.world = world;
    this.field = poiField;
    this.state = state;
    this.overlay = document.getElementById('vast-map');
    this.canvas = this.overlay.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.title = this.overlay.querySelector('.map-region');
    this.hint = this.overlay.querySelector('.map-hint');
    this.open = false;
    this.scale = 3.2;   // meters per pixel
    this.cx = 0; this.cz = 0;
    this.onTravel = null;
    this._markers = [];

    let dragging = false, lx = 0, ly = 0, moved = 0;
    this.canvas.addEventListener('mousedown', (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; });
    addEventListener('mousemove', (e) => {
      if (!dragging || !this.open) return;
      this.cx -= (e.clientX - lx) * this.scale;
      this.cz -= (e.clientY - ly) * this.scale;
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
      this._dirty = true;
    });
    addEventListener('mouseup', (e) => {
      if (dragging && this.open && moved < 5) this._click(e);
      dragging = false;
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.open) return;
      this.scale = Math.min(14, Math.max(1.2, this.scale * (e.deltaY > 0 ? 1.25 : 0.8)));
      this._dirty = true;
      e.preventDefault();
    }, { passive: false });
  }

  show(px, pz) {
    this.open = true;
    this.px = px; this.pz = pz;
    this.cx = px; this.cz = pz;
    this.overlay.classList.add('show');
    this._resize();
    this._cache = null; // re-sample: exploration has grown since last open
    this._dirty = true;
  }

  hide() {
    this.open = false;
    this.overlay.classList.remove('show');
  }

  _resize() {
    const r = this.overlay.getBoundingClientRect();
    this.canvas.width = Math.min(r.width - 40, 1100);
    this.canvas.height = r.height - 110;
  }

  update() {
    // full rerender samples the world — throttle so drags stay smooth
    if (this.open && this._dirty && performance.now() - (this._lastRender || 0) > 90) {
      this._dirty = false;
      this._lastRender = performance.now();
      this._render();
    }
  }

  _click(e) {
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    for (const m of this._markers) {
      if (m.travel && Math.hypot(m.x - mx, m.y - my) < 14) {
        if (this.onTravel) this.onTravel(m.poi);
        return;
      }
    }
  }

  // The terrain layer is expensive (a world sample per 5px block), so it's
  // rendered into an oversized offscreen cache and BLITTED during pans;
  // only zooming or panning past the cache's margin re-samples.
  _terrainCache() {
    const W = this.canvas.width, H = this.canvas.height, s = this.scale;
    const cw = Math.ceil(W * 1.5), ch = Math.ceil(H * 1.5);
    const cache = this._cache;
    const maxOffX = ((cw - W) / 2 - 10) * s, maxOffZ = ((ch - H) / 2 - 10) * s;
    if (cache && cache.scale === s &&
        Math.abs(this.cx - cache.cx) < maxOffX && Math.abs(this.cz - cache.cz) < maxOffZ) {
      return cache;
    }
    const canvas = cache && cache.w === cw && cache.h === ch ? cache.canvas : document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const g = canvas.getContext('2d');
    g.fillStyle = '#151a20';
    g.fillRect(0, 0, cw, ch);
    const B = 5;
    for (let py = 0; py < ch; py += B) {
      for (let px2 = 0; px2 < cw; px2 += B) {
        const wx = this.cx + (px2 - cw / 2) * s;
        const wz = this.cz + (py - ch / 2) * s;
        if (!this.state.explored.has(exploreKey(wx, wz))) continue;
        const h = this.world.heightAt(wx, wz);
        const col = this.world.colorAt(wx, wz, h, 0.25);
        g.fillStyle = `rgb(${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0})`;
        g.fillRect(px2, py, B, B);
      }
    }
    this._cache = { canvas, cx: this.cx, cz: this.cz, scale: s, w: cw, h: ch };
    return this._cache;
  }

  _render() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const s = this.scale;
    c.fillStyle = '#151a20';
    c.fillRect(0, 0, W, H);

    const cache = this._terrainCache();
    c.drawImage(
      cache.canvas,
      W / 2 - cache.w / 2 + (cache.cx - this.cx) / s,
      H / 2 - cache.h / 2 + (cache.cz - this.cz) / s
    );
    const half = { x: (W / 2) * s, z: (H / 2) * s };

    // grid whisper
    c.strokeStyle = 'rgba(240,230,200,0.05)';
    c.lineWidth = 1;
    const gStep = 560 / s;
    for (let x = ((-this.cx / s + W / 2) % gStep + gStep) % gStep; x < W; x += gStep) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    for (let y = ((-this.cz / s + H / 2) % gStep + gStep) % gStep; y < H; y += gStep) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }

    // POI markers within view
    this._markers = [];
    const pois = this.field.poisNear(this.cx, this.cz, Math.max(half.x, half.z) * 1.45);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const p of pois) {
      const known = this.state.discovered.has(p.id);
      const rumor = this.state.rumors.has(p.id);
      if (!known && !rumor) continue;
      const x = W / 2 + (p.x - this.cx) / s;
      const y = H / 2 + (p.z - this.cz) / s;
      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
      const lit = p.type === 'shrine' && this.state.litShrines.has(p.id);
      if (lit) {
        c.fillStyle = 'rgba(255,215,102,0.25)';
        c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.fill();
      }
      c.font = known ? '15px serif' : 'bold 13px serif';
      c.fillStyle = !known ? 'rgba(240,230,200,0.7)' : lit ? '#ffd766' : '#efe9da';
      c.fillText(known ? (TYPE_GLYPH[p.type] || '•') : '?', x, y);
      if (known && this.scale < 5) {
        c.font = '11px Georgia, serif';
        c.fillStyle = 'rgba(240,234,220,0.75)';
        c.fillText(p.name, x, y + 14);
      }
      this._markers.push({ x, y, poi: p, travel: lit });
    }

    // player
    const pxs = W / 2 + (this.px - this.cx) / s;
    const pys = H / 2 + (this.pz - this.cz) / s;
    c.fillStyle = '#7ec8ff';
    c.beginPath(); c.arc(pxs, pys, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.6;
    c.stroke();

    this.title.textContent = this.field.regionAt(this.cx, this.cz).name;
    const anyLit = this.state.litShrines.size > 0;
    this.hint.textContent = anyLit
      ? 'drag to pan · scroll to zoom · click an awakened ✦ to travel · M to close'
      : 'drag to pan · scroll to zoom · awaken shrines to unlock travel · M to close';
  }
}
