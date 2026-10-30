// TAG IT — the Drip St legal wall. A chalk outline goes up; you have twelve
// seconds of spray paint to fill it. Coverage counts, overspray costs half.
// Mouse/touch: hold to spray. Keyboard: arrows/WASD aim, SPACE sprays, 1-5 cans.
import { openArcade } from './frame.js';
import { el } from '../ui/dom.js';
import { rrect, rect, text, FONTS, INK, rgba, shade, mulberry32, makeCanvas } from '../ink.js';
import { tag } from '../art/station.js';

const W = 800, H = 450;
const GW = 160, GH = 90, CELL = W / GW; // coverage grid, 5 logical units per cell
const PR = 2; // paint canvas pixels per logical unit
const ROUND = 12;
const CX = 400, CY = 214;
const SIGMA = 14; // spray scatter
const SOLID = 0.8; // wall alpha that counts as fully painted

const CANS = [
  { c: '#ff4f9a', name: 'hot pink' },
  { c: '#ffd23f', name: 'yellow' },
  { c: '#3ec7b0', name: 'teal' },
  { c: '#7b5cff', name: 'violet' },
  { c: '#ff8a3d', name: 'orange' },
];

// ---------------------------------------------------------------- shapes
// Each draws around (0,0) into roughly ±160 × ±150. paint(g, mode) fills or strokes.

const pathShape = (build, rule = 'nonzero') => (g, mode) => {
  const p = new Path2D();
  build(p);
  if (mode === 'fill') g.fill(p, rule);
  else g.stroke(p);
};

const polyPath = (pts) => (p) => {
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
};

const circle = (p, x, y, r) => {
  p.moveTo(x + r, y);
  p.arc(x, y, r, 0, Math.PI * 2);
  p.closePath();
};

const BOLT = [[34, -152], [-92, 14], [-14, 14], [-58, 152], [100, -32], [22, -32], [74, -152]];

const SHAPES = [
  { id: 'bolt', name: 'BOLT', paint: pathShape(polyPath(BOLT)) },
  {
    id: 'star', name: 'STAR', paint: pathShape((p) => {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 64 : 156;
        const x = Math.cos(a) * r, y = Math.sin(a) * r + 10;
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
    }),
  },
  { id: 'crown', name: 'CROWN', paint: pathShape(polyPath([[-160, 104], [-160, -70], [-84, -4], [0, -132], [84, -4], [160, -70], [160, 104]])) },
  {
    id: 'heart', name: 'HEART', paint: pathShape((p) => {
      p.moveTo(0, 138);
      p.bezierCurveTo(-210, 10, -160, -160, 0, -66);
      p.bezierCurveTo(160, -160, 210, 10, 0, 138);
      p.closePath();
    }),
  },
  {
    id: 'three', name: 'THE 3', paint: (g, mode) => {
      g.font = `350px ${FONTS.sign}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (mode === 'fill') g.fillText('3', 0, 18);
      else g.strokeText('3', 0, 18);
    },
  },
  {
    id: 'drop', name: 'DROP', paint: pathShape((p) => {
      p.moveTo(0, -156);
      p.bezierCurveTo(52, -70, 124, -8, 124, 56);
      p.bezierCurveTo(124, 120, 66, 150, 0, 150);
      p.bezierCurveTo(-66, 150, -124, 120, -124, 56);
      p.bezierCurveTo(-124, -8, -52, -70, 0, -156);
      p.closePath();
    }),
  },
  {
    id: 'cheese', name: 'CHEESE', paint: pathShape((p) => {
      polyPath([[-168, 108], [168, 108], [168, -20], [-168, -112]])(p);
      circle(p, -70, 40, 24);
      circle(p, 48, 62, 18);
      circle(p, 112, 14, 14);
    }, 'evenodd'),
  },
  {
    id: 'rat', name: 'RAT FACE', paint: pathShape((p) => {
      circle(p, 0, 34, 100);
      circle(p, -94, -78, 58);
      circle(p, 94, -78, 58);
    }),
  },
  {
    id: 'token', name: 'TOKEN', paint: pathShape((p) => {
      circle(p, 0, 0, 146);
      polyPath(BOLT.map(([x, y]) => [x * 0.48, y * 0.48]))(p);
    }, 'evenodd'),
  },
  { id: 'arrow', name: 'ARROW', paint: pathShape(polyPath([[-164, -46], [24, -46], [24, -120], [164, 0], [24, 120], [24, 46], [-164, 46]])) },
];

let pendingShape = null;
let lastShape = null;
let liveGame = null; // the instance the DOM swatch row talks to

function pickShape() {
  const pool = SHAPES.filter((s) => s.id !== lastShape);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------- static layers

function makeWall(seed) {
  const c = makeCanvas(W * PR, H * PR);
  const g = c.getContext('2d');
  g.scale(PR, PR);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#ddd5c8');
  grad.addColorStop(1, '#cfc6b8');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = mulberry32(seed);
  // peeled whitewash showing brick at the corners
  const bricks = (x0, y0, w, h) => {
    g.save();
    g.beginPath();
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([x0 + w / 2 + Math.cos(a) * w * (0.42 + r() * 0.12), y0 + h / 2 + Math.sin(a) * h * (0.4 + r() * 0.14)]);
    }
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillStyle = '#5b4893';
    g.fill();
    g.clip();
    g.strokeStyle = '#33275e';
    g.lineWidth = 1.6;
    for (let y = y0; y < y0 + h; y += 12) {
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke();
      for (let x = x0 + ((y / 12) % 2 ? 12 : 0); x < x0 + w; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); }
    }
    g.restore();
    g.save();
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath();
    g.strokeStyle = rgba('#140f26', 0.65);
    g.lineWidth = 2.4;
    g.stroke();
    g.restore();
  };
  bricks(-40, -30, 190, 110);
  bricks(690, 330, 170, 150);
  // grit + stains
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? rgba('#000000', 0.04 + r() * 0.05) : rgba('#ffffff', 0.12);
    g.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 2.5);
  }
  for (let i = 0; i < 7; i++) {
    const x = r() * W, len = 60 + r() * 160;
    const sg = g.createLinearGradient(0, 0, 0, len);
    sg.addColorStop(0, rgba('#6a5a40', 0.12));
    sg.addColorStop(1, rgba('#6a5a40', 0));
    g.fillStyle = sg;
    g.fillRect(x, 0, 6 + r() * 12, len);
  }
  // old, half-buffed tags
  for (let i = 0; i < 9; i++) tag(g, 60 + r() * 680, 60 + r() * 330, { seed: seed + i * 7, alpha: 0.2, size: 22 + r() * 22 });
  // cracks
  for (let k = 0; k < 3; k++) {
    let x = r() * W, y = r() * H;
    g.strokeStyle = rgba('#140f26', 0.35);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 6; i++) { x += (r() - 0.4) * 22; y += 6 + r() * 14; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

function makeOutline(shape) {
  const c = makeCanvas(W * PR, H * PR);
  const g = c.getContext('2d');
  g.setTransform(PR, 0, 0, PR, CX * PR, CY * PR);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.setLineDash([15, 11]);
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(32,24,58,0.85)';
  shape.paint(g, 'stroke');
  // keep only the outer half of the line, and erase inner construction lines
  g.globalCompositeOperation = 'destination-out';
  g.setLineDash([]);
  g.fillStyle = '#000';
  shape.paint(g, 'fill');
  return c;
}

function makeMask(shape) {
  const c = makeCanvas(GW, GH);
  const g = c.getContext('2d');
  g.setTransform(GW / W, 0, 0, GH / H, (CX * GW) / W, (CY * GH) / H);
  g.fillStyle = '#fff';
  shape.paint(g, 'fill');
  const d = g.getImageData(0, 0, GW, GH).data;
  const mask = new Uint8Array(GW * GH);
  let n = 0, x0 = GW, y0 = GH, x1 = 0, y1 = 0;
  for (let i = 0; i < GW * GH; i++) {
    if (d[i * 4 + 3] > 127) {
      mask[i] = 1;
      n++;
      const x = i % GW, y = (i / GW) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { mask, n, bbox: [x0 * CELL, y0 * CELL, (x1 + 1) * CELL, (y1 + 1) * CELL] };
}

const GRADES = [['S', 0.82, 60], ['A', 0.68, 45], ['B', 0.5, 30], ['C', 0.32, 15], ['D', -1, 5]];
const gradeOf = (s) => GRADES.find(([, min]) => s >= min);

// ---------------------------------------------------------------- the game

export function playTag(ctx) {
  const econ = ctx.econ;
  const paidLeft = () => econ.rewardsLeft('tag');
  return openArcade({
    id: 'tag',
    title: 'TAG IT',
    color: '#7ed957',
    blurb: 'The Drip St legal wall. Fill the outline before the paint runs out.',
    logical: [W, H],
    intro: {
      title: 'TAG IT',
      text: 'Hold down to spray. Fill the chalk outline in 12 seconds. Paint outside the lines costs you half.',
      note: `Keyboard: arrows or WASD aim · SPACE sprays · 1-5 swap cans. ${paidLeft() > 0 ? `Paid plays left today: ${paidLeft()}.` : 'No paid plays left today, so this one is for fun.'}`,
      button: 'SHAKE THE CAN',
    },
    create(api) {
      const A = api.audio;
      const shape = pendingShape || pickShape();
      pendingShape = shape;
      const seed = Math.floor(Math.random() * 1e6);
      const wall = makeWall(seed);
      const outline = makeOutline(shape);
      const { mask, n: insideTotal, bbox } = makeMask(shape);
      const paint = makeCanvas(W * PR, H * PR);
      const pg = paint.getContext('2d');
      pg.scale(PR, PR);
      // Low-res mirror of every paint op. Scoring reads its alpha, so the score
      // matches what's actually on the wall.
      const MR = 0.4;
      const mirror = makeCanvas(W * MR, H * MR);
      const mg = mirror.getContext('2d', { willReadFrequently: true });
      mg.scale(MR, MR);
      const both = [pg, mg];
      const rnd = mulberry32(seed + 1);

      let state = 'ready'; // ready | run | judge | done
      let timeLeft = ROUND, readyT = 0, judgeT = 0;
      let spraying = false, can = 0;
      let nozzle = { x: CX, y: CY }, prev = { x: CX, y: CY }, hover = false;
      let emitAcc = 0, stampAcc = 0;
      let stillT = 0, stillFrom = { x: CX, y: CY }, dripCool = 0;
      const drips = [];
      const held = new Set();
      let usedKeys = false;
      let score = { coverage: 0, over: 0, total: 0 }, scoreT = 0;
      let overFlash = 0, outT = 0;
      const colorUse = [0, 0, 0, 0, 0];
      let result = null;

      const insideAt = (x, y) => {
        const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
        return cx >= 0 && cy >= 0 && cx < GW && cy < GH && mask[cx + cy * GW] === 1;
      };
      const computeScore = () => {
        const MW = mirror.width, MH = mirror.height;
        const d = mg.getImageData(0, 0, MW, MH).data;
        const fx = MW / GW, fy = MH / GH;
        let inS = 0, outS = 0;
        for (let cy = 0; cy < GH; cy++) {
          for (let cx = 0; cx < GW; cx++) {
            let a = 0;
            for (let yy = 0; yy < fy; yy++) for (let xx = 0; xx < fx; xx++) a += d[((cy * fy + yy) * MW + cx * fx + xx) * 4 + 3];
            const v = Math.min(1, a / (fx * fy * 255) / SOLID);
            if (mask[cx + cy * GW]) inS += v; else outS += v;
          }
        }
        const coverage = inS / insideTotal, over = outS / insideTotal;
        score = { coverage, over, total: Math.max(0, Math.min(1, coverage - 0.5 * over)) };
        return score;
      };

      // ---- painting
      const sprayAt = (x, y, dt) => {
        const col = CANS[can].c;
        const dist = Math.hypot(x - prev.x, y - prev.y);
        emitAcc += 760 * dt;
        const n = Math.floor(emitAcc);
        emitAcc -= n;
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / n;
          const px = prev.x + (x - prev.x) * k, py = prev.y + (y - prev.y) * k;
          const u = Math.max(1e-6, rnd());
          const rr = Math.min(2.6, Math.sqrt(-2 * Math.log(u))) * SIGMA;
          const a = rnd() * Math.PI * 2;
          const dx = px + Math.cos(a) * rr, dy = py + Math.sin(a) * rr;
          const r = 0.8 + rnd() * rnd() * 2.8;
          const alpha = 0.4 + rnd() * 0.5;
          for (const c of both) {
            c.globalAlpha = alpha;
            c.fillStyle = col;
            c.beginPath();
            c.arc(dx, dy, r, 0, Math.PI * 2);
            c.fill();
          }
        }
        // soft core so the middle of the spray reads as solid
        stampAcc += dist + dt * 90;
        while (stampAcc > 5) {
          stampAcc -= 5;
          const k = 1 - stampAcc / Math.max(5, dist + dt * 90);
          const px = prev.x + (x - prev.x) * Math.max(0, Math.min(1, k)), py = prev.y + (y - prev.y) * Math.max(0, Math.min(1, k));
          for (const c of both) {
            const rg = c.createRadialGradient(px, py, 1, px, py, SIGMA * 1.1);
            rg.addColorStop(0, rgba(col, 0.3));
            rg.addColorStop(0.55, rgba(col, 0.16));
            rg.addColorStop(1, rgba(col, 0));
            c.globalAlpha = 1;
            c.fillStyle = rg;
            c.fillRect(px - SIGMA * 1.2, py - SIGMA * 1.2, SIGMA * 2.4, SIGMA * 2.4);
          }
        }
        for (const c of both) c.globalAlpha = 1;
        colorUse[can] += dt;
        // drips when you hold still
        if (Math.hypot(x - stillFrom.x, y - stillFrom.y) > 9) {
          stillFrom = { x, y };
          stillT = 0;
        } else stillT += dt;
        dripCool -= dt;
        if (stillT > 0.4 && dripCool <= 0) {
          dripCool = 0.32;
          drips.push({ x: x + (rnd() - 0.5) * SIGMA * 1.4, y: y + SIGMA * (0.4 + rnd() * 0.5), len: 0, max: 26 + rnd() * 48, v: 46 + rnd() * 26, w: 2.6 + rnd() * 2.2, col });
        }
      };

      const growDrips = (dt) => {
        for (const d of drips) {
          if (d.len >= d.max) continue;
          const step = Math.min(d.max - d.len, d.v * dt);
          d.v *= Math.pow(0.55, dt);
          if (step <= 0.01) { d.len = d.max; continue; }
          const y0 = d.y + d.len, y1 = y0 + step;
          d.len += step;
          const done = d.len >= d.max - 0.01;
          for (const c of both) {
            c.strokeStyle = d.col;
            c.lineCap = 'round';
            c.lineWidth = d.w;
            c.globalAlpha = 0.92;
            c.beginPath();
            c.moveTo(d.x, y0);
            c.lineTo(d.x, y1);
            c.stroke();
            if (done) {
              c.fillStyle = d.col;
              c.beginPath();
              c.arc(d.x, d.y + d.len + d.w * 0.3, d.w * 0.85, 0, Math.PI * 2);
              c.fill();
            }
            c.globalAlpha = 1;
          }
        }
      };

      const setSpray = (on) => {
        if (on === spraying) return;
        spraying = on;
        if (on) {
          prev = { x: nozzle.x, y: nozzle.y };
          stillFrom = { x: nozzle.x, y: nozzle.y };
          stillT = 0;
          if (state === 'ready') begin();
        }
        A.spray?.(on && state === 'run');
      };

      const begin = () => {
        state = 'run';
        timeLeft = ROUND;
        if (spraying) A.spray?.(true);
      };

      const pickCan = (i) => {
        if (i < 0 || i >= CANS.length || state === 'judge' || state === 'done') return;
        can = i;
        A.pop?.();
        syncSwatches();
      };

      // ---- results
      const judge = () => {
        state = 'judge';
        judgeT = 0;
        setSpray(false);
        A.spray?.(false);
        computeScore();
        const pct = Math.round(score.total * 100);
        const [grade, , pay] = gradeOf(score.total);
        econ.track('game:tag');
        econ.track('grade:tag', 1, grade);
        const tokens = econ.gameReward('tag', pay);
        let sticker = null;
        if (grade === 'S') {
          const sid = econ.randomUnowned(['street']);
          if (sid && econ.addSticker(sid)) sticker = sid;
        }
        const prevBest = econ.S.bests.tag || 0;
        const newBest = pct > prevBest;
        result = { grade, pct, tokens, newBest, prevBest, sticker };
        if (newBest) {
          econ.S.bests.tag = pct;
          econ.S.bests.tagGrade = grade;
          econ.commit();
          try {
            ctx.onTagImage?.(exportPiece());
          } catch { /* a tainted or tiny canvas shouldn't break the round */ }
        }
        if (grade === 'S' || grade === 'A') A.fanfare?.(); else if (grade === 'D') A.sad?.(); else A.beepGood?.();
      };

      const finish = () => {
        state = 'done';
        const r = result;
        const lines = [`Coverage ${Math.round(score.coverage * 100)}% · overspray ${Math.round(score.over * 100)}%`];
        if (r.newBest) lines.push(r.prevBest ? `New best (was ${r.prevBest}%). Your piece is up on the legal wall.` : 'First piece! It’s up on the legal wall now.');
        else lines.push(`Your best: ${econ.S.bests.tag}% (${econ.S.bests.tagGrade || '—'})`);
        if (r.sticker) lines.push('S grade bonus: a new sticker for your book.');
        const left = paidLeft();
        lines.push(r.tokens ? `Paid plays left today: ${left}` : 'Playing for fun · the 3 paid plays are used up today');
        api.finish({
          title: { S: 'PERFECT PIECE', A: 'FRESH', B: 'CLEAN', C: 'ROUGH DRAFT', D: 'TOY MOVE' }[r.grade],
          grade: r.grade, score: `${r.pct}%`, scoreLabel: 'SCORE', tokens: r.tokens, lines, againLabel: 'PAINT ANOTHER',
        });
      };

      const exportPiece = () => {
        const ex = makeCanvas(376, 168);
        const eg = ex.getContext('2d');
        const m = 14;
        const [bx0, by0, bx1, by1] = [Math.max(0, bbox[0] - m), Math.max(0, bbox[1] - m), Math.min(W, bbox[2] + m), Math.min(H, bbox[3] + m)];
        const bw = bx1 - bx0, bh = by1 - by0;
        const s = Math.min(176 / bw, 160 / bh);
        const dw = bw * s, dh = bh * s, dx = 8 + (176 - dw) / 2, dy = (168 - dh) / 2;
        eg.drawImage(paint, bx0 * PR, by0 * PR, bw * PR, bh * PR, dx, dy, dw, dh);
        eg.drawImage(outline, bx0 * PR, by0 * PR, bw * PR, bh * PR, dx, dy, dw, dh);
        const main = CANS[colorUse.indexOf(Math.max(...colorUse))].c;
        const name = String(ctx.name || 'YOU').slice(0, 12);
        const size = Math.min(54, 300 / Math.max(3, name.length * 0.62));
        text(eg, name, 282, 98, { size, font: FONTS.tag, fill: main, lw: size * 0.08, line: INK, rot: -0.07, skewX: -0.12 });
        text(eg, `${result ? result.grade : ''} · ${new Date().toLocaleDateString()}`, 282, 140, { size: 13, font: FONTS.marker, fill: '#2a2238', lw: 0, rot: -0.05 });
        return ex.toDataURL('image/png');
      };

      // ---- DOM can row (big, finger-friendly, below the canvas)
      let row = null;
      const ensureRow = () => {
        const stage = api.canvas.parentElement;
        if (!stage || !stage.parentElement) return;
        row = stage.parentElement.querySelector('.tag-cans');
        if (!row) {
          row = el('div', { class: 'swatches tag-cans', role: 'group', 'aria-label': 'Spray can color', style: { justifyContent: 'center', alignItems: 'center', gap: '14px', padding: '10px 16px', borderBottom: '3px solid var(--ink)', background: 'var(--panel-2)' } },
            el('span', { style: { font: '12px var(--f-sign)', color: 'var(--muted)', letterSpacing: '1px' } }, 'CANS'));
          CANS.forEach((cn, i) => {
            const b = el('button', { type: 'button', class: 'swatch', 'data-i': String(i), 'aria-label': `${cn.name} paint (key ${i + 1})`, style: { background: cn.c, width: '46px', height: '46px' } });
            b.addEventListener('click', () => { if (liveGame) liveGame.pickCan(i); });
            row.append(b);
          });
          stage.after(row);
        }
      };
      const syncSwatches = () => {
        if (!row) return;
        row.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.i) === can ? 'true' : 'false'));
      };
      ensureRow();

      const hud = () => {
        const left = paidLeft();
        api.setHud(
          `TAG: ${shape.name} · ${left > 0 ? `paid plays left: ${left}` : 'playing for fun'}`,
          `${Math.round(score.total * 100)}% · ${state === 'ready' ? `${ROUND}s` : `${Math.max(0, timeLeft).toFixed(1)}s`}`,
        );
      };

      hud();

      const game = {
        pickCan,
        start() {
          pendingShape = null;
          lastShape = shape.id;
          liveGame = game;
          syncSwatches();
          hud();
        },
        destroy() {
          A.spray?.(false);
          if (liveGame === game) liveGame = null;
        },
        pointer(type, px, py, e) {
          if (state === 'judge' || state === 'done') return;
          // the stage can be taller than the canvas on phones: clamp onto the wall
          const x = Math.max(0, Math.min(W, px)), y = Math.max(0, Math.min(H, py));
          if (type === 'down') {
            if (px < -24 || px > W + 24 || py < -24 || py > H + 24) return; // a tap in the letterbox, not on the wall
            usedKeys = false;
            nozzle = { x, y };
            hover = true;
            setSpray(true);
          } else if (type === 'move') {
            nozzle = { x, y };
            hover = e && e.pointerType === 'mouse';
          } else if (type === 'up') {
            setSpray(false);
            if (!e || e.pointerType !== 'mouse') hover = false;
          }
        },
        key(type, code) {
          if (state === 'judge' || state === 'done') return;
          if (type === 'down') {
            if (/^Digit[1-5]$/.test(code)) return pickCan(Number(code.slice(5)) - 1);
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(code)) {
              held.add(code);
              usedKeys = true;
              hover = true;
            }
            if (code === 'Space' || code === 'Enter') {
              usedKeys = true;
              hover = true;
              setSpray(true);
            }
          } else {
            held.delete(code);
            if (code === 'Space' || code === 'Enter') setSpray(false);
          }
        },
        update(dt) {
          if (state === 'ready') {
            readyT += dt;
            if (readyT > 3) begin();
          }
          // keyboard aim
          if (held.size) {
            const sp = 400 * dt;
            if (held.has('ArrowLeft') || held.has('KeyA')) nozzle.x -= sp;
            if (held.has('ArrowRight') || held.has('KeyD')) nozzle.x += sp;
            if (held.has('ArrowUp') || held.has('KeyW')) nozzle.y -= sp;
            if (held.has('ArrowDown') || held.has('KeyS')) nozzle.y += sp;
            nozzle.x = Math.max(10, Math.min(W - 10, nozzle.x));
            nozzle.y = Math.max(10, Math.min(H - 10, nozzle.y));
          }
          if (state === 'run') {
            timeLeft -= dt;
            if (spraying) sprayAt(nozzle.x, nozzle.y, dt);
            growDrips(dt);
            outT = spraying && !insideAt(nozzle.x, nozzle.y) ? outT + dt : 0;
            if (outT > 0.2) overFlash = 0.4;
            scoreT -= dt;
            if (scoreT <= 0) { scoreT = 0.2; computeScore(); }
            if (timeLeft <= 0) {
              timeLeft = 0;
              judge();
            }
          } else if (state === 'judge') {
            growDrips(dt);
            judgeT += dt;
            if (judgeT > 1.25) finish();
          }
          if (overFlash > 0) overFlash -= dt;
          prev = { x: nozzle.x, y: nozzle.y };
          hud();
        },
        draw(g, t) {
          g.drawImage(wall, 0, 0, W, H);
          g.drawImage(paint, 0, 0, W, H);
          g.drawImage(outline, 0, 0, W, H);
          const col = CANS[can].c;
          // spray mist
          if (spraying && state === 'run') {
            g.save();
            const rg = g.createRadialGradient(nozzle.x, nozzle.y, 2, nozzle.x, nozzle.y, SIGMA * 2.6);
            rg.addColorStop(0, rgba(col, 0.22));
            rg.addColorStop(1, rgba(col, 0));
            g.fillStyle = rg;
            g.fillRect(nozzle.x - SIGMA * 3, nozzle.y - SIGMA * 3, SIGMA * 6, SIGMA * 6);
            g.restore();
          }
          // aim ring + can
          if ((hover || usedKeys || spraying) && state !== 'done') {
            g.save();
            g.strokeStyle = rgba('#140f26', 0.55);
            g.lineWidth = 2;
            g.setLineDash([5, 5]);
            g.beginPath();
            g.arc(nozzle.x, nozzle.y, SIGMA * 1.8, 0, Math.PI * 2);
            g.stroke();
            g.setLineDash([]);
            g.beginPath();
            g.moveTo(nozzle.x - 6, nozzle.y); g.lineTo(nozzle.x + 6, nozzle.y);
            g.moveTo(nozzle.x, nozzle.y - 6); g.lineTo(nozzle.x, nozzle.y + 6);
            g.stroke();
            g.restore();
            const shake = spraying ? Math.sin(t * 50) * 1.5 : 0;
            g.save();
            g.translate(nozzle.x + 40 + shake, nozzle.y + 26);
            g.rotate(-0.5);
            rrect(g, -12, -4, 24, 48, 7, { fill: col, shade: shade(col, 0.3), sdx: 2, sdy: 2, lw: 3, seed: 3 });
            rrect(g, -12, 10, 24, 14, 1, { fill: '#fffaf0', lw: 2, seed: 4 });
            rrect(g, -9, -16, 18, 14, 6, { fill: '#c8c8e0', lw: 2.6, seed: 5 });
            rrect(g, -4, -24, 8, 9, 2, { fill: '#2a2238', lw: 2.2, seed: 6 });
            g.restore();
          }
          // top HUD: coverage meter, shape name, timer
          const pct = Math.round(score.total * 100);
          rrect(g, 18, 16, 210, 46, 10, { fill: rgba('#140f26', 0.86), lw: 3, seed: 8 });
          text(g, 'SCORE', 34, 35, { size: 12, font: FONTS.sign, fill: '#b3a9e0', lw: 0, align: 'left' });
          rect(g, 34, 42, 140, 12, { fill: '#2a2238', lw: 2, amp: 0, seed: 9 });
          if (pct > 0) rect(g, 34, 42, 140 * Math.min(1, score.total), 12, { fill: score.total >= 0.82 ? '#6dff9a' : score.total >= 0.5 ? '#ffd23f' : '#ff8a3d', lw: 0, amp: 0, seed: 10 });
          text(g, `${pct}%`, 212, 54, { size: 20, font: FONTS.sign, fill: '#fffaf0', lw: 0, align: 'right' });
          text(g, `TAG: ${shape.name}`, W / 2, 46, { size: 24, font: FONTS.sign, fill: '#fffaf0', lw: 6, line: INK, spacing: 1 });
          const tl = state === 'ready' ? ROUND : Math.max(0, timeLeft);
          const hot = state === 'run' && tl < 4;
          text(g, tl >= 10 ? tl.toFixed(0) : tl.toFixed(1), W - 30, 64, { size: hot ? 48 + Math.sin(t * 20) * 3 : 44, font: FONTS.sign, fill: hot ? '#ff4f9a' : '#fffaf0', lw: 7, line: INK, align: 'right' });
          if (state === 'ready') {
            const bob = Math.sin(t * 4) * 5;
            text(g, 'HOLD TO SPRAY', W / 2, H - 40 + bob, { size: 30, font: FONTS.sign, fill: '#6dff9a', lw: 7, line: INK });
          }
          if (overFlash > 0 && state === 'run') {
            text(g, 'OVERSPRAY!', nozzle.x, nozzle.y - SIGMA * 2.6, { size: 20, font: FONTS.sign, fill: '#ff4f9a', lw: 5, line: INK, rot: -0.08 });
          }
          // grade stamp before the results card
          if (state === 'judge' && result) {
            const k = Math.min(1, judgeT / 0.25);
            const s = 2.6 - 1.6 * (1 - Math.pow(1 - k, 3));
            g.save();
            g.globalAlpha = Math.min(1, judgeT * 5);
            g.translate(W / 2, H / 2 + 20);
            g.scale(s, s);
            text(g, result.grade, 0, 40, { size: 130, font: FONTS.drip, fill: { S: '#6dff9a', A: '#ffd23f', B: '#3ec7b0', C: '#ff8a3d', D: '#ff4f9a' }[result.grade], lw: 14, line: INK, rot: -0.12 });
            g.restore();
          }
        },
      };
      return game;
    },
  }, ctx);
}
