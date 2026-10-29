// Papel picado, the Huixcolotla way: a stack of tissue paper, a pattern on
// top, and a chisel tapped with a mallet — every tap cuts through the stack.
import { mkCanvas, PAL } from '../toon.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';

const W = 360, H = 450; // one sheet, in design units

// shapes: c = circle, e = ellipse, r = rect, tri = triangle, h = heart
function petals(cx, cy, n, dist, rx, ry, rot0 = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rot0 + (i / n) * Math.PI * 2;
    out.push({ t: 'e', x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, rx, ry, rot: a, taps: rx > 30 ? 2 : 1 });
  }
  return out;
}

export const PATTERNS = {
  calavera: {
    name: { en: 'Skull', es: 'Calavera' },
    shapes: [
      { t: 'e', x: 135, y: 200, rx: 38, ry: 42, rot: 0, taps: 2 },
      { t: 'e', x: 225, y: 200, rx: 38, ry: 42, rot: 0, taps: 2 },
      { t: 'tri', x: 180, y: 262, s: 26, taps: 1 },
      ...[-2, -1, 0, 1, 2].map((i) => ({ t: 'r', x: 180 + i * 22, y: 320, w: 10, h: 34, taps: 1 })),
      ...petals(180, 110, 6, 22, 15, 9),
      { t: 'c', x: 180, y: 110, r: 9, taps: 1 },
      ...petals(70, 290, 5, 0, 14, 6, 0.4).slice(0, 1),
      { t: 'c', x: 290, y: 300, r: 14, taps: 1 },
    ],
  },
  flor: {
    name: { en: 'Flower', es: 'Flor' },
    shapes: [
      ...petals(180, 220, 8, 62, 36, 17),
      { t: 'c', x: 180, y: 220, r: 22, taps: 1 },
      { t: 'c', x: 70, y: 90, r: 18, taps: 1 }, { t: 'c', x: 290, y: 90, r: 18, taps: 1 },
      { t: 'c', x: 70, y: 360, r: 18, taps: 1 }, { t: 'c', x: 290, y: 360, r: 18, taps: 1 },
    ],
  },
  corazon: {
    name: { en: 'Heart', es: 'Corazón' },
    shapes: [
      { t: 'h', x: 180, y: 215, s: 92, taps: 3 },
      ...petals(180, 215, 10, 128, 9, 9),
    ],
  },
  mariposa: {
    name: { en: 'Butterfly', es: 'Mariposa' },
    shapes: [
      { t: 'e', x: 125, y: 175, rx: 48, ry: 60, rot: 0.5, taps: 2 },
      { t: 'e', x: 235, y: 175, rx: 48, ry: 60, rot: -0.5, taps: 2 },
      { t: 'e', x: 135, y: 285, rx: 32, ry: 40, rot: -0.4, taps: 1 },
      { t: 'e', x: 225, y: 285, rx: 32, ry: 40, rot: 0.4, taps: 1 },
      { t: 'c', x: 180, y: 120, r: 9, taps: 1 },
      { t: 'c', x: 90, y: 380, r: 12, taps: 1 }, { t: 'c', x: 270, y: 380, r: 12, taps: 1 },
    ],
  },
};

export const STAMPS = {
  circulo: { name: { en: 'Circle', es: 'Círculo' }, make: (x, y) => ({ t: 'c', x, y, r: 20, taps: 1 }) },
  corazon: { name: { en: 'Heart', es: 'Corazón' }, make: (x, y) => ({ t: 'h', x, y, s: 30, taps: 1 }) },
  petalo: { name: { en: 'Petal', es: 'Pétalo' }, make: (x, y) => ({ t: 'e', x, y, rx: 22, ry: 10, rot: 0.6, taps: 1 }) },
  rombo: { name: { en: 'Diamond', es: 'Rombo' }, make: (x, y) => ({ t: 'tri', x, y, s: 24, taps: 1, diamond: true }) },
  gota: { name: { en: 'Drop', es: 'Gota' }, make: (x, y) => ({ t: 'e', x, y, rx: 12, ry: 24, rot: 0, taps: 1 }) },
};

export const PAPER_COLORS = [PAL.rosa, PAL.marigold, PAL.purple, PAL.turquoise, PAL.lime, PAL.gold, PAL.red, PAL.cobalt];

function shapePath(ctx, s, scale = 1) {
  ctx.beginPath();
  const x = s.x * scale, y = s.y * scale;
  if (s.t === 'c') ctx.arc(x, y, s.r * scale, 0, Math.PI * 2);
  else if (s.t === 'e') ctx.ellipse(x, y, s.rx * scale, s.ry * scale, s.rot || 0, 0, Math.PI * 2);
  else if (s.t === 'r') ctx.rect(x - s.w * scale / 2, y - s.h * scale / 2, s.w * scale, s.h * scale);
  else if (s.t === 'tri') {
    const k = s.s * scale;
    if (s.diamond) { ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.7, y); ctx.lineTo(x, y + k); ctx.lineTo(x - k * 0.7, y); }
    else { ctx.moveTo(x, y - k * 0.6); ctx.lineTo(x + k * 0.6, y + k * 0.5); ctx.lineTo(x - k * 0.6, y + k * 0.5); }
    ctx.closePath();
  } else if (s.t === 'h') {
    const k = s.s * scale;
    ctx.moveTo(x, y + k * 0.75);
    ctx.bezierCurveTo(x - k * 1.4, y - k * 0.1, x - k * 0.6, y - k * 1.05, x, y - k * 0.35);
    ctx.bezierCurveTo(x + k * 0.6, y - k * 1.05, x + k * 1.4, y - k * 0.1, x, y + k * 0.75);
  }
}

function inside(s, px, py) {
  const dx = px - s.x, dy = py - s.y;
  if (s.t === 'c') return Math.hypot(dx, dy) <= s.r + 6;
  if (s.t === 'e') {
    const c = Math.cos(-(s.rot || 0)), sn = Math.sin(-(s.rot || 0));
    const x = dx * c - dy * sn, y = dx * sn + dy * c;
    return (x * x) / ((s.rx + 6) ** 2) + (y * y) / ((s.ry + 6) ** 2) <= 1;
  }
  if (s.t === 'r') return Math.abs(dx) <= s.w / 2 + 6 && Math.abs(dy) <= s.h / 2 + 6;
  if (s.t === 'tri') return Math.abs(dx) <= s.s * 0.75 && Math.abs(dy) <= s.s;
  if (s.t === 'h') return Math.abs(dx) <= s.s * 1.1 && dy <= s.s * 0.8 && dy >= -s.s * 1.0;
  return false;
}

// the finished sheet (holes cut out), for hanging in the 3D world
export function papelDesignCanvas(design, color, w = 128) {
  const h = Math.round(w * H / W);
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  const k = w / W;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-out';
  border(ctx, w, h);
  for (const s of design.shapes) { shapePath(ctx, s, k); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  return cv;
}

function border(ctx, w, h) {
  ctx.fillStyle = '#000';
  const step = w / 14;
  for (let x = step / 2; x < w; x += step) {
    ctx.beginPath(); ctx.arc(x, step * 0.7, step * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - step * 0.3, h); ctx.lineTo(x, h - step * 0.6); ctx.lineTo(x + step * 0.3, h); ctx.fill();
  }
  for (let y = step * 1.6; y < h - step; y += step) {
    ctx.fillRect(step * 0.25, y, step * 0.25, step * 0.45);
    ctx.fillRect(w - step * 0.5, y, step * 0.25, step * 0.45);
  }
}

export function papelCanvases(saved, w = 128) {
  if (!saved?.shapes) return null;
  return (saved.colors || [PAL.rosa]).map((c) => papelDesignCanvas(saved, c, w));
}

// ---------------------------------------------------------------- the panel
export function openPapel(game) {
  return new Promise((resolve) => {
    const ui = game.ui;
    const body = document.createElement('div');
    body.className = 'mg';
    const m = ui.modal({ title: { en: 'Papel picado', es: 'Papel picado' }, ico: 'sparkle', body, cls: 'wide', closable: false });
    const st = { step: 0, pattern: 'calavera', colors: [PAL.rosa, PAL.marigold, PAL.purple], shapes: [], cut: [], stamp: 'circulo', mirror: true };
    const cv = document.createElement('canvas');
    cv.className = 'board';
    cv.width = W * 2; cv.height = H * 2;
    cv.style.width = `${Math.min(330, window.innerWidth - 80)}px`;
    let tool = null;

    const draw = (lift = 0) => {
      const ctx = cv.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // the lead plate under the stack
      ctx.fillStyle = '#8d939a';
      ctx.fillRect(0, 0, W, H);
      const cols = st.colors.length ? st.colors : [PAL.rosa];
      const n = Math.min(6, cols.length + 2);
      for (let i = n - 1; i >= 0; i--) {
        const off = i * (3 + lift * 26);
        const c = cols[i % cols.length];
        const sheet = mkCanvas(W, H);
        const sx = sheet.getContext('2d');
        sx.fillStyle = c;
        sx.fillRect(0, 0, W, H);
        sx.globalCompositeOperation = 'destination-out';
        if (st.step >= 3) border(sx, W, H);
        st.shapes.forEach((s, k) => { if (st.cut[k] >= s.taps) { shapePath(sx, s); sx.fill(); } });
        sx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(off * 0.6, off);
        ctx.rotate((i - 1) * 0.015 * lift);
        ctx.drawImage(sheet, 0, 0);
        ctx.restore();
      }
      if (st.step === 2 || st.step === 1) {
        // the pattern drawn on top: dashed outlines show where to cut
        ctx.lineWidth = 2.5;
        st.shapes.forEach((s, k) => {
          const done = st.cut[k] >= s.taps;
          if (done) return;
          shapePath(ctx, s);
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = '#2a1a14';
          ctx.stroke();
          ctx.setLineDash([]);
          if (st.cut[k] > 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); }
        });
      }
      if (tool && st.step === 2) {
        ctx.save();
        ctx.translate(tool.x, tool.y);
        ctx.rotate(-0.5);
        ctx.fillStyle = '#c9965e'; ctx.fillRect(-4, -46, 8, 34);
        ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-3, -14, 6, 14);
        ctx.restore();
      }
    };

    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    };
    cv.addEventListener('pointermove', (e) => { tool = pos(e); if (st.step === 2) draw(); });
    cv.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      if (st.step === 1 && st.pattern === 'propio') {
        // design your own: stamp shapes, mirrored like folded paper
        const s = STAMPS[st.stamp].make(p.x, p.y);
        st.shapes.push(s); st.cut.push(0);
        if (st.mirror && Math.abs(p.x - W / 2) > 18) {
          const m2 = STAMPS[st.stamp].make(W - p.x, p.y);
          if (m2.rot) m2.rot = -m2.rot;
          st.shapes.push(m2); st.cut.push(0);
        }
        game.sfx('bean');
        draw();
        return;
      }
      if (st.step !== 2) return;
      const k = st.shapes.findIndex((s, i) => st.cut[i] < s.taps && inside(s, p.x, p.y));
      if (k < 0) { game.sfx('oops'); return; }
      st.cut[k]++;
      game.sfx('tok');
      draw();
      if (st.cut.every((c, i) => c >= st.shapes[i].taps)) setTimeout(() => step(3), 350);
    });

    const step = (n) => {
      st.step = n;
      const lead = body.querySelector('.lead');
      const ctrl = body.querySelector('.ctrl');
      ctrl.innerHTML = '';
      if (n === 0) {
        lead.innerHTML = t({ en: '**1. Choose a pattern** (patrón). Tía Lucía will lay it on top of the stack.', es: '**1. Escoge un patrón.** Tía Lucía lo pondrá encima de la pila.' }).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        const grid = document.createElement('div');
        grid.className = 'choicegrid';
        for (const [id, p] of [...Object.entries(PATTERNS), ['propio', { name: { en: 'My own design', es: 'Mi propio diseño' } }]]) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `bigchoice${st.pattern === id ? ' on' : ''}`;
          b.innerHTML = `<b>${t(p.name)}</b>`;
          if (id !== 'propio') {
            const prev = papelDesignCanvas(p, PAL.rosa, 90);
            prev.style.cssText = 'width:60px;display:block;margin:4px auto 0';
            b.appendChild(prev);
          } else b.innerHTML += `<span>${t({ en: 'Stamp shapes — they mirror like folded paper', es: 'Pon figuras; se reflejan como papel doblado' })}</span>`;
          b.onclick = () => { st.pattern = id; game.sfx('tap'); step(0); };
          grid.appendChild(b);
        }
        ctrl.appendChild(grid);
        ctrl.appendChild(colorPicker());
        const go = btn({ en: 'Next', es: 'Siguiente' }, 'rosa', () => {
          if (!st.colors.length) return;
          st.shapes = st.pattern === 'propio' ? [] : PATTERNS[st.pattern].shapes.map((s) => ({ ...s }));
          st.cut = st.shapes.map(() => 0);
          step(st.pattern === 'propio' ? 1 : 2);
        });
        ctrl.appendChild(go);
      } else if (n === 1) {
        lead.innerHTML = t({ en: '<b>Design your own:</b> pick a shape and tap the paper to place it. Then cut!', es: '<b>Tu propio diseño:</b> escoge una figura y toca el papel para ponerla. ¡Luego a cortar!' });
        const tools = document.createElement('div');
        tools.className = 'swatches';
        for (const [id, s] of Object.entries(STAMPS)) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `tool${st.stamp === id ? ' on' : ''}`;
          b.textContent = t(s.name);
          b.onclick = () => { st.stamp = id; step(1); };
          tools.appendChild(b);
        }
        ctrl.appendChild(tools);
        const mir = document.createElement('label');
        mir.className = 'opt';
        mir.innerHTML = `<input type="checkbox" ${st.mirror ? 'checked' : ''}> ${t({ en: 'Mirror (symmetry)', es: 'Espejo (simetría)' })}`;
        mir.querySelector('input').onchange = (e) => { st.mirror = e.target.checked; };
        ctrl.appendChild(mir);
        ctrl.appendChild(btn({ en: 'Undo', es: 'Deshacer' }, 'cream', () => { st.shapes.pop(); st.cut.pop(); draw(); }));
        ctrl.appendChild(btn({ en: 'Ready to cut!', es: '¡A cortar!' }, 'rosa', () => { if (st.shapes.length) step(2); }));
      } else if (n === 2) {
        lead.innerHTML = t({ en: '<b>Tap each dashed shape</b> to strike the chisel (cincel) with the mallet. Big shapes need more taps!', es: '<b>Toca cada figura punteada</b> para golpear el cincel con el mazo. ¡Las grandes necesitan más golpes!' });
      } else if (n === 3) {
        lead.innerHTML = t({ en: 'Now lift the stack… every sheet has the same design!', es: 'Ahora levanta la pila… ¡todas las hojas tienen el mismo diseño!' });
        game.sfx('success');
        const t0 = performance.now();
        const anim = () => {
          const k = Math.min(1, (performance.now() - t0) / 1200);
          draw(k);
          if (k < 1) requestAnimationFrame(anim);
        };
        anim();
        ctrl.appendChild(btn({ en: 'Hang them on a string!', es: '¡A colgarlos en un cordón!' }, 'rosa', () => {
          m.close();
          resolve({ shapes: st.shapes, colors: st.colors, pattern: st.pattern });
        }));
      }
      draw(n === 3 ? 0 : 0);
    };

    const colorPicker = () => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div style="font-weight:800;margin:6px 0">${t({ en: '2. Pick the colors in your stack (up to 5):', es: '2. Escoge los colores de tu pila (hasta 5):' })}</div>`;
      const sw = document.createElement('div');
      sw.className = 'swatches';
      for (const c of PAPER_COLORS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `swatch${st.colors.includes(c) ? ' on' : ''}`;
        b.style.background = c;
        b.onclick = () => {
          if (st.colors.includes(c)) st.colors = st.colors.filter((x) => x !== c);
          else if (st.colors.length < 5) st.colors.push(c);
          b.classList.toggle('on', st.colors.includes(c));
          game.sfx('tap');
          draw();
        };
        sw.appendChild(b);
      }
      wrap.appendChild(sw);
      return wrap;
    };

    const btn = (label, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${cls} small`;
      b.style.margin = '8px 8px 0 0';
      b.textContent = t(label);
      b.onclick = () => { game.sfx('tap'); fn(); };
      return b;
    };

    body.innerHTML = `<div class="row"><div class="cvwrap"></div><div style="flex:1;min-width:240px"><p class="lead" style="font-weight:700;margin-top:0"></p><div class="ctrl"></div></div></div>`;
    body.querySelector('.cvwrap').appendChild(cv);
    step(0);
    void icon;
  });
}
