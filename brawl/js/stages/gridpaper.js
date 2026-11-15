// GRID PAPER - a slab of eight pencil-ruled tiles hanging over a blueprint.
// Two of the six middle tiles are always missing, and every ten seconds the
// eraser rubs another one out while the pencil draws an old one back in.

import { W, H } from '../core/config.js';
import { clamp } from '../core/util.js';
import { mkSolid, mkPlat } from '../game/physics.js';
import { OUT, LW, vgrad, rrect, circle, txt, polygon } from '../core/gfx.js';

const N = 8, TW = 72, TH = 72, X0 = -(N * TW) / 2;
const CYCLE = 600, WARN = 60, PERIM = 2 * (TW + TH);
const PAPER = '#eef3fa', RULE = '#a9c6ec', PINK = '#f58fb0';
const SHAVE = ['#e8402a', '#f2b81c', '#35a84a', '#2f7fe0'];

// ---- collision -------------------------------------------------------------
// The tiles come and go one at a time, but what fighters stand on is one solid
// per unbroken RUN of tiles (every possible run is built up front and only the
// current ones are switched on): two solids side by side would trip a runner
// into a landing at every seam.
function setTiles(st, m) {
  const want = new Set();
  for (let i = 0; i < N; i++) {
    if (!st.have[i]) continue;
    let j = i;
    while (j + 1 < N && st.have[j + 1]) j++;
    want.add(st.span[i][j]); i = j;
  }
  const heir = (x) => { for (const s of want) if (x >= s.x && x <= s.x + s.w) return s; return null; };
  if (m) {
    // whoever stands or hangs on a run that changed shape carries on with the run that replaced it
    for (const f of m.fighters) {
      if (f.ground && f.ground.grid && !want.has(f.ground)) f.ground = heir(f.x) || f.ground;
      const L = f.ledge;
      if (L && L.s.grid && !want.has(L.s)) {
        const s = heir(L.dir < 0 ? X0 + 1 : -X0 - 1);
        if (s) { L.s = s; L.key = s.id + (L.dir < 0 ? 'l' : 'r'); }
      }
    }
    for (const e of m.entities) if (e.ground && e.ground.grid && !want.has(e.ground)) e.ground = heir(e.x) || e.ground;
  }
  for (const s of st.solids) s.on = want.has(s);
}

// is anyone's body inside the square where tile i is about to be redrawn?
function blockers(m, i) {
  const x = X0 + i * TW, out = [];
  for (const f of m.fighters) {
    if (f.out || f.state === 'dead' || f.state === 'respawn') continue;
    const hw = (f.w * f.scale) / 2;
    if (f.x + hw > x && f.x - hw < x + TW && f.y > 2 && f.y - f.h * f.scale < TH) out.push(f);
  }
  return out;
}

// ---- art ---------------------------------------------------------------------
function drawTile(ctx, x) {
  rrect(ctx, x, 0, TW, TH, 3, PAPER, OUT, LW);
  ctx.strokeStyle = RULE; ctx.lineWidth = 1.3; ctx.beginPath();
  for (let k = 1; k < 4; k++) { ctx.moveTo(x + k * 18, 14); ctx.lineTo(x + k * 18, TH - 2); }
  for (let k = 1; k < 4; k++) { ctx.moveTo(x + 2, 12 + k * 15); ctx.lineTo(x + TW - 2, 12 + k * 15); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,70,140,0.16)'; ctx.fillRect(x + 1.2, TH - 15, TW - 2.4, 13.8);
  rrect(ctx, x, 0, TW, 12, 3, '#ffffff', OUT, LW);                  // the lip you stand on
  ctx.fillStyle = 'rgba(40,70,140,0.2)'; ctx.fillRect(x + 1.2, 13.1, TW - 2.4, 3.4);
}

function drawPencil(ctx, x, y, rot) {      // tip at (x, y)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  polygon(ctx, [0, 0, 10, -4.5, 10, 4.5], '#f0cf9a', OUT, 1.8);
  polygon(ctx, [0, 0, 3.6, -1.6, 3.6, 1.6], OUT, null, 0);
  rrect(ctx, 10, -4.5, 25, 9, 1, '#ffd23a', OUT, 1.8);
  rrect(ctx, 35, -4.5, 5, 9, 1, '#c9d2de', OUT, 1.8);
  rrect(ctx, 40, -4.5, 8, 9, 3, PINK, OUT, 1.8);
  ctx.restore();
}

function drawEraser(ctx, x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  rrect(ctx, -17, -9, 34, 17, 4, PINK, OUT, LW);
  rrect(ctx, -9, -9, 19, 17, 1, '#5d8fe0', OUT, 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-7, -7, 15, 3);
  ctx.restore();
}

function drawRuler(ctx, x, y, w) {
  rrect(ctx, x - 5, y, w + 10, 15, 3, '#f1c453', OUT, LW);
  ctx.fillStyle = '#fbe6a2'; ctx.fillRect(x - 3.4, y + 1.4, w + 6.8, 3.4);
  ctx.strokeStyle = '#6b4a1a'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0, tx = x + 6; tx < x + w - 2; tx += 8, i++) { ctx.moveTo(tx, y + 13.4); ctx.lineTo(tx, y + (i % 4 ? 10 : 7)); }
  ctx.stroke();
  circle(ctx, x + w - 1, y + 7.5, 2.4, '#143478', OUT, 1.4);
}

// a point d pixels round the edge of a tile, clockwise from its top-left corner
function perim(x, d) {
  if (d < TW) return [x + d, 0];
  if (d < TW + TH) return [x + TW, d - TW];
  if (d < 2 * TW + TH) return [x + TW - (d - TW - TH), TH];
  return [x, TH - (d - 2 * TW - TH)];
}

// a tile being drawn back: outline first, hatching behind it, then it sets
function drawSketch(ctx, x, u, t, waiting) {
  const d = clamp(u / 0.72, 0, 1) * PERIM;
  ctx.save();
  if (waiting && (t >> 2) & 1) ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash([d, PERIM + 20]); ctx.strokeRect(x, 0, TW, TH); ctx.setLineDash([]);
  const n = Math.floor(clamp((u - 0.3) / 0.6, 0, 1) * 9);
  if (n > 0) {
    ctx.beginPath(); ctx.rect(x, 0, TW, TH); ctx.clip();
    if (u > 0.82) { ctx.fillStyle = `rgba(238,243,250,${clamp((u - 0.82) * 4.5, 0, 0.8)})`; ctx.fillRect(x, 0, TW, TH); }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let i = 0; i < n; i++) { ctx.moveTo(x - 62 + i * 16, TH); ctx.lineTo(x + 10 + i * 16, 0); }
    ctx.stroke();
  }
  ctx.restore();
  if (d < PERIM) { const p = perim(x, d); drawPencil(ctx, p[0], p[1], -0.95 + Math.sin(t * 0.7) * 0.1); }
}

// a tile being rubbed out: it shudders, flashes eraser-pink and thins away
function drawRub(ctx, x, r) {
  const u = r / WARN, ph = r * 0.5;
  ctx.save(); ctx.translate(((r >> 1) & 1 ? 1 : -1) * (0.5 + u), 0);
  drawTile(ctx, x);
  ctx.fillStyle = `rgba(245,143,176,${(r >> 2) & 1 ? 0.78 : 0.3})`; ctx.fillRect(x + 1, 1, TW - 2, TH - 2);
  ctx.fillStyle = `rgba(255,255,255,${u * 0.55})`;
  for (let k = 0; k < 4; k++) ctx.fillRect(x + 5 + k * 17, 18 + ((k * 23) % 30), 14 * u + 2, 5);
  ctx.restore();
  drawEraser(ctx, x + TW / 2 + Math.sin(ph) * 21, -8 - Math.abs(Math.cos(ph)) * 2, Math.sin(ph) * 0.22);
}

function drawShaving(ctx, x, y, s, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0.3, 4.7);
  ctx.strokeStyle = '#0a1c45'; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = '#e9c88f'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 11.8, 0.3, 4.7); ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
}

// the blueprint void: grid, construction lines, drifting pencil shavings
function drawVoid(ctx, t, cx, cy) {
  vgrad(ctx, 0, 0, W, H, ['#1f4a9c', '#15377e', '#0c2459']);
  const ox = -cx * 0.12, oy = -cy * 0.12;
  const grid = (step, a, lw) => {
    ctx.strokeStyle = `rgba(175,210,255,${a})`; ctx.lineWidth = lw; ctx.beginPath();
    for (let x = ((ox % step) + step) % step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = ((oy % step) + step) % step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  };
  grid(32, 0.08, 1); grid(128, 0.15, 1.6);
  // construction lines somebody never rubbed out
  const px = ox * 1.6, py = oy * 1.6;
  ctx.save(); ctx.translate(px, py);
  ctx.strokeStyle = 'rgba(190,222,255,0.17)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.setLineDash([12, 9]);
  ctx.beginPath(); ctx.arc(150, 180, 118, 0, Math.PI * 2); ctx.moveTo(-40, 520); ctx.lineTo(520, -40); ctx.stroke();
  ctx.beginPath(); ctx.arc(690, 470, 190, Math.PI, Math.PI * 1.62); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(138, 180); ctx.lineTo(162, 180); ctx.moveTo(150, 168); ctx.lineTo(150, 192);            // compass centre
  ctx.moveTo(540, 96); ctx.lineTo(760, 96); ctx.moveTo(540, 86); ctx.lineTo(540, 106); ctx.moveTo(760, 86); ctx.lineTo(760, 106);   // a dimension
  ctx.moveTo(690, 470); ctx.lineTo(690, 280); ctx.moveTo(690, 470); ctx.lineTo(545, 345);            // an angle
  ctx.stroke();
  ctx.beginPath(); ctx.arc(690, 470, 46, Math.PI * 1.23, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.72;
  for (let i = 0; i < 9; i++) {
    const sx = ((i * 173 + t * (0.22 + (i % 3) * 0.11)) % (W + 120)) - 60 + ox * (2 + (i % 3));
    const sy = ((i * 97 + t * (0.1 + (i % 4) * 0.05)) % (H + 80)) - 40 + oy * 2 + Math.sin(t * 0.011 + i) * 10;
    drawShaving(ctx, sx, sy, 0.75 + (i % 3) * 0.3, t * 0.008 * (i % 2 ? 1 : -1) + i * 1.7, SHAVE[i % 4]);
  }
  ctx.restore();
}

export default {
  id: 'gridpaper', name: 'GRID PAPER', home: 'eraser',
  blurb: 'Eight squares, two of them missing. Which two is the eraser\'s business.',
  music: 'hardest',
  build(m) {
    const hazards = m.rules.hazards !== false;
    const span = [], solids = [];
    for (let i = 0; i < N; i++) {
      span.push([]);
      for (let j = i; j < N; j++) {
        // only the outer corners of the end tiles can be hung from
        const s = mkSolid(X0 + i * TW, 0, (j - i + 1) * TW, TH, { id: 'g' + i + '_' + j, ledge: (i === 0 ? 'l' : '') + (j === N - 1 ? 'r' : ''), on: false, grid: true });
        span[i][j] = s; solids.push(s);
      }
    }
    const st = {
      solids, span,
      plats: [mkPlat(-66, -120, 132, { id: 'ruler' })],
      blast: { l: -790, r: 790, t: -620, b: 340 },
      cam: { l: -650, r: 650, t: -500, b: 270 },
      spawns: [[-180, 0], [180, 0], [-36, 0], [36, 0]],
      respawn: [0, -235],
      focusX: 0, focusY: -60, t: 0,
      have: [true, true, false, true, true, false, true, true],
      gone: [2, 5],                   // the holes, oldest first
      rub: null, pen: null, last: -1, // tile being rubbed out {i,t}; tile being redrawn {i,t,wait}; the one redrawn last
      timer: CYCLE - WARN,
      update(m) {
        this.t++;
        if (!hazards) return;
        let changed = false;
        const R = this.rub, P = this.pen;
        if (R) {
          R.t++;
          const cx = X0 + R.i * TW + TW / 2;
          if (R.t % 4 === 0) m.fx.debris(cx + Math.sin(R.t * 0.5) * 21, -4, 1, PINK);
          if (R.t === 28) m.sfx('squeak', { vol: 0.6, rate: 1.15 });
          if (R.t >= WARN) {
            this.have[R.i] = false; this.gone.push(R.i); this.rub = null; changed = true;
            m.fx.puff(cx, 30, 6, '#f8cbd9'); m.fx.debris(cx, 24, 8, PINK); m.sfx('pop', { vol: 0.5 });
          }
        }
        if (P) {
          P.t++;
          if (P.t >= WARN) {
            // never close a tile over somebody: wait for the square to empty (and after a
            // long wait, lift whoever is still in there onto the top)
            const in_ = blockers(m, P.i);
            if (in_.length && ++P.wait > 150) { for (const f of in_) { f.y = 0; f.vy = Math.min(f.vy, 0); f.ky = Math.min(f.ky, 0); } in_.length = 0; }
            if (!in_.length) {
              this.have[P.i] = true; this.gone.splice(this.gone.indexOf(P.i), 1); this.last = P.i; this.pen = null; changed = true;
              const cx = X0 + P.i * TW + TW / 2;
              m.fx.ring(cx, 6, 34, '#ffffff'); m.sfx('click', { vol: 0.7 });
            }
          }
        }
        if (changed) setTiles(this, m);
        if (--this.timer <= 0 && !this.pen && !this.rub) {
          this.timer = CYCLE;
          const back = this.gone[0], stay = this.gone[1];
          // candidates: never an end tile, never the one just redrawn, and never one that would
          // leave three in a row open (so a hole is at most two tiles wide even while the redraw waits)
          const ok = [];
          for (let i = 1; i < N - 1; i++) {
            if (!this.have[i] || i === this.last) continue;
            let run = 0, bad = false;
            for (let k = 1; k < N - 1; k++) { run = k === i || k === back || k === stay ? run + 1 : 0; if (run > 2) bad = true; }
            if (!bad) ok.push(i);
          }
          if (ok.length) {
            const apart = ok.filter((i) => Math.abs(i - stay) > 1);
            const i = m.rng.pick(apart.length && m.rng.chance(0.7) ? apart : ok);
            this.rub = { i, t: 0 }; this.pen = { i: back, t: 0, wait: 0 };
            m.sfx('squeak', { vol: 0.7 }); m.sfx('pencil', { vol: 0.7 });
          }
        }
      },
      drawBg(ctx, m) { drawVoid(ctx, this.t, m.cam.x, m.cam.y); },
      drawBack(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(195,224,255,0.34)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.setLineDash([7, 7]);        // where the missing squares belong
        for (let i = 1; i < N - 1; i++) if (!this.have[i] && !(this.pen && this.pen.i === i)) ctx.strokeRect(X0 + i * TW + 4, 4, TW - 8, TH - 8);
        ctx.setLineDash([]);
        const y = TH + 36;              // the slab's dimension line
        ctx.beginPath();
        ctx.moveTo(X0, y); ctx.lineTo(-X0, y);
        for (const s of [-1, 1]) { const ex = s * X0; ctx.moveTo(ex, y - 9); ctx.lineTo(ex, y + 9); ctx.moveTo(ex - s * 9, y - 5); ctx.lineTo(ex, y); ctx.lineTo(ex - s * 9, y + 5); }
        ctx.stroke();
        ctx.globalAlpha = 0.42;
        txt(ctx, '8 x 72', 0, y - 11, { font: 'pixel', size: 11, fill: '#cfe5ff', stroke: null, lw: 0 });
        ctx.restore();
      },
      drawMid(ctx) {
        const R = this.rub, P = this.pen;
        for (let i = 0; i < N; i++) if (this.have[i] && !(R && R.i === i)) drawTile(ctx, X0 + i * TW);
        if (P) drawSketch(ctx, X0 + P.i * TW, P.t / WARN, this.t, P.t >= WARN);
        if (R) drawRub(ctx, X0 + R.i * TW, R.t);
        drawRuler(ctx, -66, -120, 132);
      },
    };
    setTiles(st, null);
    return st;
  },
  thumb(ctx, w, h, t = 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.save(); ctx.scale(w / W, h / H); drawVoid(ctx, t, 0, 0); ctx.restore();
    ctx.translate(w / 2, h * 0.6); ctx.scale(w / 680, w / 680);
    for (let i = 0; i < N; i++) if (i !== 2 && i !== 5) drawTile(ctx, X0 + i * TW);
    drawRuler(ctx, -66, -120, 132);
    ctx.restore();
  },
};
