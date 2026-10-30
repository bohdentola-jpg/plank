// The closet: everything you own, by slot, on a live preview of your figure.
// Plus the fit card, a shareable picture of your outfit.
import { el, openOverlay, xButton } from './dom.js';
import { drawFigure } from '../art/figure.js';
import { piece, tag } from '../art/graffiti.js';
import { ITEMS, itemById, RARITIES, SLOTS, SLOT_NAMES } from '../data/items.js';
import { CONFIG } from '../config.js';
import { text, FONTS, makeCanvas, mulberry32, rgba } from '../ink.js';
import * as E from '../systems/econ.js';
import * as audio from '../audio.js';
import { toast } from './hud.js';
import { figureView } from './figureview.js';
import { itemImage, rarityChip, fmt } from './shop.js';

let api = { editFigure: () => {} };
export function initCloset(a) { api = { ...api, ...a }; }

export function openCloset(slot = null) {
  openOverlay('closet', (panel, close) => {
    const view = figureView({ body: E.S.profile.body, outfit: E.outfitOf(), seed: 3 });
    const score = el('b', {}, fmt(E.dripScore()));
    const col = E.collection();
    const head = el('div', { class: 'panel-head' },
      el('div', { style: { minWidth: '0' } },
        el('h2', { class: 'panel-title' }, 'YOUR CLOSET'),
        el('p', { class: 'panel-sub' }, 'DRIP SCORE ', score, ` · ${col.owned}/${col.total} items collected`)));
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    const grid = el('div', { class: 'grid closet-grid' });
    const side = el('div', { class: 'closet-side' }, tabs, grid);
    const left = el('div', { class: 'closet-left' }, view.el,
      el('div', { class: 'row', style: { justifyContent: 'center' } },
        el('button', { type: 'button', class: 'btn btn-sm btn-sun', onclick: () => openFitCard() }, 'FIT CARD'),
        el('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => { close(); api.editFigure(); } }, 'EDIT FIGURE')));
    const body = el('div', { class: 'panel-body closet' }, left, side);
    panel.append(head, body, xButton(close));

    const firstWithNew = SLOTS.find((s) => E.S.fresh.some((id) => itemById[id] && itemById[id].slot === s));
    let cur = slot || firstWithNew || 'top';
    const renderTabs = () => {
      tabs.innerHTML = '';
      for (const s of SLOTS) {
        const fresh = E.S.fresh.some((id) => itemById[id] && itemById[id].slot === s);
        const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': s === cur ? 'true' : 'false' }, SLOT_NAMES[s], fresh ? el('span', { class: 'tab-dot', 'aria-label': 'new' }) : null);
        b.addEventListener('click', () => { cur = s; audio.click(); render(); });
        tabs.append(b);
      }
    };
    const render = () => {
      renderTabs();
      grid.innerHTML = '';
      const mine = ITEMS.filter((i) => i.slot === cur && E.owns(i.id))
        .sort((a, b) => RARITIES[b.rarity].rank - RARITIES[a.rarity].rank || a.name.localeCompare(b.name));
      const worn = E.S.equipped[cur];
      const none = el('button', { type: 'button', class: `card none${!worn ? ' worn' : ''}`, 'aria-label': `Nothing in ${SLOT_NAMES[cur]}` },
        el('div', { class: 'card-art' }, el('span', { class: 'none-x' }, '∅')),
        el('div', { class: 'card-info' }, el('div', { class: 'card-name' }, 'Nothing')));
      none.addEventListener('click', () => { E.equip(cur, null); audio.pop(); refresh(); });
      grid.append(none);
      for (const it of mine) {
        const prism = E.isPrismatic(it.id);
        const isWorn = worn === it.id;
        const fresh = E.S.fresh.includes(it.id);
        const c = el('button', { type: 'button', class: `card r-${it.rarity}${prism ? ' prism' : ''}${isWorn ? ' worn' : ''}`, 'aria-pressed': isWorn ? 'true' : 'false', 'aria-label': `${it.name}, ${RARITIES[it.rarity].name}${isWorn ? ', wearing' : ''}` },
          el('div', { class: 'card-art' }, el('img', { src: itemImage(it, 200, prism), alt: '', loading: 'lazy' })),
          el('div', { class: 'badges' }, isWorn ? el('span', { class: 'badge own' }, 'WEARING') : null, fresh ? el('span', { class: 'badge new' }, 'NEW') : null),
          el('div', { class: 'card-info' }, rarityChip(it.rarity, prism), el('div', { class: 'card-name' }, it.name)));
        c.addEventListener('click', () => {
          E.equip(cur, isWorn ? null : it.id);
          audio.pop();
          if (!isWorn) view.play(RARITIES[it.rarity].rank >= 4 ? 'cheer' : 'pose', 1.4);
          refresh();
        });
        grid.append(c);
      }
      if (!mine.length) grid.append(el('p', { class: 'empty' }, `No ${SLOT_NAMES[cur].toLowerCase()} items yet. Shops restock every day, and capsules can drop anything.`));
      // seen
      const seen = mine.filter((i) => E.S.fresh.includes(i.id)).map((i) => i.id);
      if (seen.length) setTimeout(() => { E.markSeen(seen); renderTabs(); }, 1200);
    };
    const refresh = () => {
      view.setOutfit(E.outfitOf());
      score.textContent = fmt(E.dripScore());
      render();
    };
    render();
    return { onClose: () => view.destroy() };
  }, { label: 'Your closet', panelClass: 'closet-panel' });
}

// ---------------------------------------------------------------- fit card

export function fitCardCanvas() {
  const W = 1080, H = 1350;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ffe08a');
  bg.addColorStop(0.5, '#ff9ac8');
  bg.addColorStop(1, '#7fd6ff');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const r = mulberry32(E.S.created % 9973);
  g.save();
  g.scale(2.2, 2.2);
  for (let i = 0; i < 10; i++) tag(g, r() * (W / 2.2), 40 + r() * (H / 2.2 - 80), { seed: 30 + i * 7, alpha: 0.22, size: 26 + r() * 26 });
  g.restore();
  // halftone dots
  g.fillStyle = rgba('#140f26', 0.07);
  for (let y = 0; y < H; y += 22) for (let x = (y / 22) % 2 ? 11 : 0; x < W; x += 22) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  piece(g, W / 2, 190, CONFIG.storeName, { size: 120, fill: '#ff4f9a', fill2: '#ffd23f', seed: 21, cloudColor: '#7b5cff', rot: -0.05 });
  // the figure
  g.fillStyle = rgba('#140f26', 0.2);
  g.beginPath();
  g.ellipse(W / 2, 1090, 230, 34, 0, 0, Math.PI * 2);
  g.fill();
  drawFigure(g, W / 2, 1090, { body: E.S.profile.body, outfit: E.outfitOf(), scale: 7.4, t: 0.4, pose: 'pose', view: 'front', boil: 11 });
  // name + stats
  const name = (E.S.profile.name || 'RIDER').toUpperCase();
  text(g, name, W / 2, 1200, { size: 92, font: FONTS.tag, fill: '#fffaf0', lw: 10, rot: -0.03 });
  const best = E.rarest();
  const stat = `DRIP SCORE ${fmt(E.dripScore())}   ·   ${E.S.streak.count > 0 ? `${E.S.streak.count}-DAY STREAK` : 'NEW RIDER'}`;
  text(g, stat, W / 2, 1272, { size: 34, font: FONTS.sign, fill: '#140f26', lw: 0 });
  if (best) text(g, `RAREST: ${best.name.toUpperCase()} (${RARITIES[best.rarity].name})`, W / 2, 1318, { size: 26, font: FONTS.sign, fill: RARITIES[best.rarity].rank >= 4 ? '#8a2a8a' : '#2a2238', lw: 0 });
  return c;
}

export function openFitCard() {
  openOverlay('fitcard', (panel, close) => {
    const c = fitCardCanvas();
    const url = c.toDataURL('image/png');
    const img = el('img', { src: url, alt: 'Your fit card', class: 'fit-img' });
    const name = `${(E.S.profile.name || 'rider').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-fit.png`;
    const share = el('button', { type: 'button', class: 'btn btn-hot' }, 'SHARE');
    share.addEventListener('click', async () => {
      try {
        const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: CONFIG.storeName, text: `My fit on the ${CONFIG.storeName}. Drip score ${fmt(E.dripScore())}.` });
          return;
        }
      } catch { /* refused or cancelled */ }
      toast('Sharing isn’t available here. Long-press or right-click the picture to save it.', '', 4200);
    });
    const save = el('a', { class: 'btn btn-ghost', href: url, download: name }, 'SAVE IMAGE');
    panel.append(
      el('div', { class: 'panel-head' }, el('div', {}, el('h2', { class: 'panel-title' }, 'FIT CARD'), el('p', { class: 'panel-sub' }, 'Show the line what you’re wearing.'))),
      el('div', { class: 'panel-body fit-body' }, img, el('div', { class: 'row', style: { justifyContent: 'center' } }, share, save)),
      xButton(close));
  }, { label: 'Fit card' });
}
