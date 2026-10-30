// Make your figure: tag name, head shape, face and vinyl colorway.
// Also draws the DRIP LINE logo for the title screen.
import { el, openOverlay, panelHead, xButton } from './dom.js';
import { SKINS, HEADS, FACES } from '../art/figure.js';
import { piece, tag } from '../art/graffiti.js';
import { STARTERS, itemById } from '../data/items.js';
import { CONFIG } from '../config.js';
import { measure, FONTS, shape, pathPts, rgba } from '../ink.js';
import * as E from '../systems/econ.js';
import * as audio from '../audio.js';
import { figureView } from './figureview.js';

const NAMES = ['NEKO', 'RIZO', 'VYBE', 'ZEEK', 'KAPS', 'NOVA', 'CHEZ', 'BLIP', 'SOOT', 'DUST', 'LUXE', 'MUNK', 'PEZ', 'FOMO', 'JUNO', 'KIRO'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HEAD_LABEL = { round: 'ROUND', square: 'SQUARE', bean: 'BEAN', drop: 'DROP' };
const FACE_LABEL = { dots: 'DOTS', happy: 'HAPPY', cool: 'COOL', wide: 'WIDE', x: 'X-EYES', cyclops: 'CYCLOPS' };

export function randomBody() {
  return { skin: pick(SKINS).id, head: pick(HEADS), face: pick(FACES) };
}

function starterOutfit() {
  const eq = {};
  for (const id of STARTERS) eq[itemById[id].slot] = id;
  return E.outfitOf(eq);
}

export function openCreator(onDone, opts = {}) {
  const cur = E.S.profile;
  const look = opts._look ? { name: opts._look.name, body: { ...opts._look.body } } : { name: cur ? cur.name : '', body: cur ? { ...cur.body } : randomBody() };
  openOverlay('creator', (panel, close) => {
    const view = figureView({ body: look.body, outfit: cur ? E.outfitOf() : starterOutfit(), seed: 9, fill: 0.74 });
    const head = panelHead(opts.first ? 'MAKE YOUR FIGURE' : 'EDIT YOUR FIGURE', opts.first ? 'Every rider on the Drip Line is a one-of-one. Pick your shape.' : 'Change your shape anytime. Your clothes stay on.');
    const body = el('div', { class: 'panel-body' });
    const foot = el('div', { class: 'panel-foot' });
    panel.append(head, body, foot);
    if (!opts.first) panel.append(xButton(close));

    const nameIn = el('input', { class: 'name-input', id: 'creator-name', type: 'text', maxlength: '12', value: look.name, placeholder: 'YOUR TAG', 'aria-label': 'Your tag name', autocomplete: 'off', spellcheck: 'false' });
    nameIn.addEventListener('input', () => { look.name = nameIn.value.toUpperCase().replace(/[^A-Z0-9 ._-]/g, ''); });

    const chipRow = (list, key, labels) => {
      const row = el('div', { class: 'chips', role: 'group' });
      const sync = () => [...row.children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === look.body[key] ? 'true' : 'false'));
      for (const v of list) {
        const b = el('button', { type: 'button', class: 'chip', 'data-v': v }, labels[v] || v.toUpperCase());
        b.addEventListener('click', () => { look.body[key] = v; sync(); view.setBody({ ...look.body }); view.play('pose', 0.9); audio.pop(); });
        row.append(b);
      }
      sync();
      return row;
    };
    const swatches = el('div', { class: 'swatches', role: 'group', 'aria-label': 'Colorway' });
    const syncSw = () => [...swatches.children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === look.body.skin ? 'true' : 'false'));
    for (const s of SKINS) {
      const b = el('button', { type: 'button', class: 'swatch', 'data-v': s.id, 'aria-label': `${s.name} colorway`, style: { background: s.c } });
      b.addEventListener('click', () => { look.body.skin = s.id; syncSw(); view.setBody({ ...look.body }); audio.pop(); });
      swatches.append(b);
    }
    syncSw();

    body.append(el('div', { class: 'creator' }, el('div', { class: 'creator-preview' }, view.el),
      el('div', { style: { minWidth: '0' } },
        el('div', { class: 'label', style: { marginTop: 0 } }, 'TAG NAME'), nameIn,
        el('div', { class: 'label' }, 'HEAD'), chipRow(HEADS, 'head', HEAD_LABEL),
        el('div', { class: 'label' }, 'FACE'), chipRow(FACES, 'face', FACE_LABEL),
        el('div', { class: 'label' }, 'COLORWAY'), swatches,
        opts.first ? el('p', { class: 'note' }, 'You start with a blank tee, raw denim and fresh whites. Everything else, you earn.') : null)));

    const shuffle = el('button', { type: 'button', class: 'btn btn-ghost' }, 'SHUFFLE');
    shuffle.addEventListener('click', () => {
      look.body = randomBody();
      if (!look.name) look.name = pick(NAMES);
      close();
      openCreator(onDone, { ...opts, _look: look });
    });
    const go = el('button', { type: 'button', class: 'btn btn-go' }, opts.first ? 'BOARD THE TRAIN →' : 'SAVE');
    go.addEventListener('click', () => {
      look.name = (look.name || '').trim() || pick(NAMES);
      audio.fanfare();
      close();
      onDone({ name: look.name, body: { ...look.body } });
    });
    foot.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } }, shuffle, go));
    return { onClose: () => view.destroy() };
  }, { label: 'Make your figure', dismissable: !opts.first, noFocus: true });
}

// ---------------------------------------------------------------- logo

export function drawLogo(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(10, Math.round(r.width * dpr));
  canvas.height = Math.max(10, Math.round(r.height * dpr));
  const g = canvas.getContext('2d');
  const W = 880, H = 400;
  g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  g.clearRect(0, 0, W, H);
  // a big paint drop behind the letters
  shape(g, pathPts([
    ['M', 440, 10],
    ['C', 500, 110, 590, 170, 590, 250],
    ['C', 590, 335, 520, 385, 440, 385],
    ['C', 360, 385, 290, 335, 290, 250],
    ['C', 290, 170, 380, 110, 440, 10],
  ], 10), { fill: '#3ec7b0', shade: '#2a9484', sdx: 8, sdy: 8, lw: 10, amp: 2, seed: 7 });
  g.fillStyle = rgba('#ffffff', 0.45);
  g.beginPath();
  g.ellipse(395, 215, 22, 48, 0.35, 0, Math.PI * 2);
  g.fill();
  const name = CONFIG.storeName;
  const size = Math.min(150, 150 * (780 / Math.max(1, measure(g, name, 150, FONTS.drip))));
  piece(g, 440, 265, name, { size, fill: '#ff4f9a', fill2: '#ffd23f', seed: 21, cloudColor: '#7b5cff', rot: -0.05 });
  tag(g, 610, 360, { word: 'ride daily', size: 52, color: '#6dff9a', seed: 4, rot: -0.1, alpha: 1 });
}
