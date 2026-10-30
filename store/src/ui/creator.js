// "Who are you?" — pick a tag name and a look for your rat.
import { el, openOverlay, panelHead, xButton } from './dom.js';
import { drawRat, RAT_FUR, HOODIES, HATS } from '../art/critters.js';
import { piece, tag } from '../art/station.js';
import { text, measure, FONTS } from '../ink.js';
import { CONFIG } from '../config.js';
import * as audio from '../audio.js';

const HAT_COLORS = ['#3ec7b0', '#ffd23f', '#ff4f9a', '#7b5cff', '#ff8a3d', '#2a2238', '#f4efe6', '#7ed957'];
const NAMES = ['NEKO', 'RIZO', 'VYBE', 'ZEEK', 'KAPS', 'NOVA', 'CHEZ', 'BLIP', 'SOOT', 'DUST', 'LUXE', 'MUNK', 'PEZ', 'FOMO'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function randomLook() {
  return {
    name: pick(NAMES),
    fur: pick(Object.keys(RAT_FUR)),
    hoodie: pick(HOODIES),
    hat: pick(HATS),
    hatColor: pick(HAT_COLORS),
    shoe: '#f4efe6',
  };
}

export function openCreator(current, onDone, opts = {}) {
  const look = { ...(current || randomLook()) };
  openOverlay('creator', (panel, close) => {
    const head = panelHead(opts.first ? 'WHO ARE YOU?' : 'YOUR LOOK', opts.first ? 'Every rat on the 3 needs a tag. Pick yours.' : 'Change it up. The city won’t mind.');
    const body = el('div', { class: 'panel-body' });
    const foot = el('div', { class: 'panel-foot' });
    panel.append(head, body, foot);
    if (!opts.first) panel.append(xButton(close));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = el('canvas', { width: 420 * dpr, height: 420 * dpr, 'aria-hidden': 'true' });
    const preview = el('div', { class: 'creator-preview' }, cv);
    const g = cv.getContext('2d');
    let raf = 0;
    const loop = (ms) => {
      const t = ms / 1000;
      const W = cv.width, H = cv.height;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      const k = W / 420;
      g.setTransform(k, 0, 0, k, 0, 0);
      tag(g, 210, 92, { word: (look.name || 'NEW RAT').slice(0, 12), size: 54, color: '#6dff9a', seed: 7, rot: -0.06, alpha: 0.95 });
      g.save();
      g.translate(205, 380);
      g.scale(2.7, 2.7);
      drawRat(g, 0, 0, { t, look, blink: (t % 2.8) < 0.12 ? 1 : 0, boil: 11 + (Math.floor(t * 7) % 3) * 101, pose: Math.floor(t / 4) % 3 === 2 ? 'cheer' : 'idle' });
      g.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const nameIn = el('input', { class: 'name-input', id: 'creator-name', type: 'text', maxlength: '12', value: look.name || '', 'aria-label': 'Your tag name', autocomplete: 'off', spellcheck: 'false' });
    nameIn.addEventListener('input', () => { look.name = nameIn.value.toUpperCase().replace(/[^A-Z0-9 ._-]/g, ''); });

    const swatchRow = (list, key, labelFn) => {
      const row = el('div', { class: 'swatches', role: 'group' });
      const sync = () => [...row.children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === look[key] ? 'true' : 'false'));
      for (const v of list) {
        const color = key === 'fur' ? RAT_FUR[v] : v;
        const b = el('button', { type: 'button', class: 'swatch', 'data-v': v, style: { background: color }, 'aria-label': labelFn ? labelFn(v) : v });
        b.addEventListener('click', () => { look[key] = v; sync(); audio.pop(); });
        row.append(b);
      }
      sync();
      return row;
    };
    const hatRow = el('div', { class: 'chips', role: 'group', 'aria-label': 'Hat' });
    const syncHat = () => [...hatRow.children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === look.hat ? 'true' : 'false'));
    for (const h of HATS) {
      const b = el('button', { type: 'button', class: 'chip', 'data-v': h }, h.toUpperCase());
      b.addEventListener('click', () => { look.hat = h; syncHat(); audio.pop(); });
      hatRow.append(b);
    }
    syncHat();

    const controls = el('div', { style: { minWidth: '0' } },
      el('div', { class: 'label', style: { marginTop: 0 } }, 'TAG NAME'), nameIn,
      el('div', { class: 'label' }, 'FUR'), swatchRow(Object.keys(RAT_FUR), 'fur', (v) => `${v} fur`),
      el('div', { class: 'label' }, 'HOODIE'), swatchRow(HOODIES, 'hoodie', () => 'hoodie color'),
      el('div', { class: 'label' }, 'HAT'), hatRow,
      el('div', { class: 'label' }, 'HAT COLOR'), swatchRow(HAT_COLORS, 'hatColor', () => 'hat color'));
    body.append(el('div', { class: 'creator' }, preview, controls));

    const shuffle = el('button', { type: 'button', class: 'btn btn-ghost' }, 'SHUFFLE');
    shuffle.addEventListener('click', () => {
      const r = randomLook();
      Object.assign(look, { ...r, name: look.name || r.name });
      close();
      openCreator(look, onDone, opts);
    });
    const go = el('button', { type: 'button', class: 'btn btn-go' }, opts.first ? 'HOP ON THE 3 →' : 'SAVE LOOK');
    go.addEventListener('click', () => {
      look.name = (look.name || '').trim() || pick(NAMES);
      audio.fanfare();
      close();
      onDone({ ...look });
    });
    foot.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, shuffle, go));
    return { onClose: () => cancelAnimationFrame(raf) };
  }, { label: 'Create your rat', dismissable: !opts.first, noFocus: true });
}

// ---------------------------------------------------------------- logo

export function drawLogo(canvas, t = 0) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(10, Math.round(r.width * dpr));
  canvas.height = Math.max(10, Math.round(r.height * dpr));
  const g = canvas.getContext('2d');
  const W = 880, H = 400;
  g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  g.clearRect(0, 0, W, H);
  // bolt behind
  g.save();
  g.translate(440, 190);
  g.rotate(0.12);
  g.beginPath();
  g.moveTo(40, -170); g.lineTo(-120, 30); g.lineTo(-10, 30); g.lineTo(-60, 180); g.lineTo(130, -40); g.lineTo(20, -40); g.lineTo(80, -170);
  g.closePath();
  g.fillStyle = '#ffd23f';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#140f26';
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
  const name = CONFIG.storeName;
  const size = Math.min(150, 150 * (760 / Math.max(1, measure(g, name, 150, FONTS.drip))));
  piece(g, 440, 240, name, { size, fill: '#ff4f9a', fill2: '#ffd23f', seed: 21, cloudColor: '#7b5cff', rot: -0.05 });
  tag(g, 600, 330, { word: 'market', size: 66, color: '#6dff9a', seed: 4, rot: -0.12, alpha: 1 });
  text(g, '★', 120, 120, { size: 40, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
}
