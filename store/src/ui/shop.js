// Shop panels: today's rotating stock for a car (or a secret room), item
// detail with a live try-on, and buying with tokens.
import { el, openOverlay, xButton } from './dom.js';
import { productImage } from '../art/products.js';
import { drawNpcPortrait } from '../art/figure.js';
import { SHOPS, RARITIES, SLOT_NAMES } from '../data/items.js';
import * as E from '../systems/econ.js';
import * as D from '../systems/daily.js';
import * as audio from '../audio.js';
import { toast } from './hud.js';
import { figureView } from './figureview.js';
import { SPEAKERS } from './bubbles.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const fmt = (n) => n.toLocaleString('en-US');

export function priceTag(price, was) {
  return el('div', { class: 'price' }, el('span', { class: 'tok-ico' }), fmt(price), was ? el('s', {}, fmt(was)) : null);
}

export function rarityChip(rarity, prismatic) {
  const r = RARITIES[rarity];
  return el('span', { class: `rchip r-${rarity}${prismatic ? ' prism' : ''}` }, prismatic ? `PRISMATIC ${r.name}` : r.name);
}

export function itemImage(item, px = 220, prismatic = false) {
  return productImage(prismatic ? { ...item, art: { ...item.art, prismatic: true } } : item, px);
}

export function itemCard(row, onOpen, o = {}) {
  const { item } = row;
  const owned = E.owns(item.id);
  const prism = owned && E.isPrismatic(item.id);
  const card = el('button', {
    type: 'button', class: `card r-${item.rarity}${row.featured ? ' featured' : ''}${owned ? ' owned' : ''}${prism ? ' prism' : ''}`,
    'aria-label': `${item.name}, ${RARITIES[item.rarity].name}${row.price != null ? `, ${fmt(row.price)} tokens` : ''}${owned ? ', owned' : ''}`,
    onclick: () => onOpen(row),
  },
  el('div', { class: 'card-art' }, el('img', { src: itemImage(item, 220, prism), alt: '', loading: 'lazy' })),
  el('div', { class: 'badges' },
    row.drop ? el('span', { class: 'badge deal' }, `DROP −${row.pct}%`) : row.featured ? el('span', { class: 'badge feat' }, 'FEATURED') : null,
    owned ? el('span', { class: 'badge own' }, 'OWNED') : null),
  el('div', { class: 'card-info' },
    rarityChip(item.rarity, prism),
    el('div', { class: 'card-name' }, item.name),
    o.noPrice || row.price == null ? el('div', { class: 'card-slot' }, SLOT_NAMES[item.slot]) : priceTag(row.price, row.was)));
  return card;
}

// ---------------------------------------------------------------- detail

function detailView(row, body, opts) {
  const { item } = row;
  body.innerHTML = '';
  body.scrollTop = 0;
  const shop = SHOPS[opts.shopId] || null;
  const view = figureView({ body: E.S.profile.body, outfit: E.outfitOf(E.S.equipped, { slot: item.slot, id: item.id, prismatic: E.isPrismatic(item.id) }), seed: item.seed });
  opts.track(view);
  E.track('tryon', item.id);
  view.play('pose', 1.4);

  const actions = el('div', { class: 'row' });
  const msg = el('p', { class: 'note', hidden: true });
  const render = () => {
    actions.innerHTML = '';
    const owned = E.owns(item.id);
    const worn = E.S.equipped[item.slot] === item.id;
    if (owned) {
      actions.append(el('button', {
        type: 'button', class: `btn ${worn ? 'btn-ghost' : 'btn-go'}`,
        onclick: () => {
          E.equip(item.slot, worn ? null : item.id);
          audio.pop();
          view.setOutfit(E.outfitOf(E.S.equipped, worn ? { slot: item.slot, id: null } : null));
          if (!worn) view.play('pose', 1.4);
          render();
        },
      }, worn ? 'TAKE IT OFF' : 'WEAR IT'));
    } else if (row.price != null) {
      let armed = false;
      const can = E.S.tokens >= row.price;
      const b = el('button', { type: 'button', class: 'btn btn-hot', disabled: !can }, el('span', { class: 'tok-ico' }), `BUY · ${fmt(row.price)}`);
      b.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          b.classList.add('armed');
          b.lastChild.textContent = `TAP AGAIN TO SPEND ${fmt(row.price)}`;
          audio.click();
          setTimeout(() => {
            if (armed && document.contains(b)) {
              armed = false;
              b.classList.remove('armed');
              b.lastChild.textContent = `BUY · ${fmt(row.price)}`;
            }
          }, 3500);
          return;
        }
        const res = E.buy(item.id, row.price);
        if (res.err) {
          audio.beepBad();
          toast(res.err, 'hot');
          return;
        }
        audio.register();
        setTimeout(() => audio.fanfare(), 200);
        view.confetti();
        view.play('cheer', 1.8);
        if (res.prismatic) toast('LUCKY! It came out PRISMATIC ✦', 'prism', 4200);
        opts.onBought?.(item, res);
        render();
      });
      actions.append(b);
      if (!can) {
        msg.hidden = false;
        msg.textContent = `You need ${fmt(row.price - E.S.tokens)} more tokens. Punch in daily, do Signal’s jobs and play the arcade to earn them.`;
      }
    }
    actions.append(el('button', { type: 'button', class: 'btn btn-ghost', onclick: opts.onBack }, 'BACK'));
  };
  render();

  const info = el('div', { class: 'detail-info' },
    el('div', { class: 'row', style: { gap: '8px' } }, rarityChip(item.rarity, E.isPrismatic(item.id)), el('span', { class: 'slot-chip' }, SLOT_NAMES[item.slot])),
    el('h3', {}, item.name),
    row.price != null ? priceTag(row.price, row.was) : null,
    el('p', { class: 'desc' }, `“${item.desc}”`, shop ? el('span', { class: 'desc-by' }, `— ${shop.keeperName}`) : null),
    el('div', { class: 'detail-icon' }, el('img', { src: itemImage(item, 180, E.isPrismatic(item.id)), alt: '' })),
    actions, msg);
  body.append(el('div', { class: 'detail' }, el('div', { class: 'detail-preview' }, view.el, el('span', { class: 'try-tag' }, 'TRYING IT ON')), info));
}

// ---------------------------------------------------------------- shop panel

export function openShop(shopId, opts = {}) {
  const shop = SHOPS[shopId];
  const rows = shop.secret ? E.secretStock(shopId) : E.stock(shopId);
  if (!shop.secret) E.track('visit', shopId);
  openOverlay('shop', (panel, close) => {
    const views = [];
    const track = (v) => {
      while (views.length) views.pop().destroy();
      views.push(v);
    };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const face = el('canvas', { class: 'panel-portrait', width: Math.round(96 * dpr), height: Math.round(96 * dpr), 'aria-hidden': 'true' });
    face.style.background = shop.color;
    const speech = el('div', { class: 'speech' }, opts.line || shop.browse);
    const timer = el('span', { class: 'restock' });
    const head = el('div', { class: 'panel-head' }, face,
      el('div', { style: { minWidth: '0' } },
        el('h2', { class: 'panel-title', style: { color: shop.color } }, shop.name),
        speech));
    const body = el('div', { class: 'panel-body' });
    panel.append(head, body, xButton(close));
    let talkUntil = performance.now() + 1500;
    const say = (line) => {
      speech.textContent = line;
      talkUntil = performance.now() + Math.min(3000, 600 + line.length * 40);
      const sp = SPEAKERS[shop.keeper];
      if (sp && sp.wave) for (let i = 0; i < 4; i++) setTimeout(() => audio.blip(sp.pitch, sp.wave), i * 90);
    };
    const showGrid = () => {
      track({ destroy() {} });
      body.innerHTML = '';
      body.append(el('div', { class: 'shop-bar' },
        el('span', { class: 'note' }, shop.secret ? 'Never in rotation. Never discounted.' : 'Today’s stock. It changes at midnight.'),
        shop.secret ? null : timer));
      const grid = el('div', { class: 'grid' });
      rows.forEach((row) => grid.append(itemCard(row, (r) => {
        audio.click();
        say(r.item.desc.split('. ')[0].replace(/\.$/, '') + '.');
        detailView(r, body, {
          shopId, track,
          onBack: () => { showGrid(); },
          onBought: (item) => {
            say(pick(['Ooh, that’s going to look so good on you.', 'Sold! Wear it proud.', 'Excellent taste. Truly.', 'That one’s yours now.']));
            opts.onBought?.(item);
          },
        });
      })));
      body.append(grid);
    };
    showGrid();
    if (opts.item) {
      const row = rows.find((r) => r.item.id === opts.item);
      if (row) detailView(row, body, { shopId, track, onBack: showGrid, onBought: (it) => opts.onBought?.(it) });
    }
    let raf = 0;
    const tick = (ms) => {
      const t = ms / 1000;
      drawNpcPortrait(face, shop.keeper, { t, talk: ms < talkUntil, blink: (t % 3.1) < 0.12 ? 1 : 0, boil: 11 + (Math.floor(t * 7) % 3) * 101 });
      timer.textContent = `RESTOCK IN ${D.fmtCountdown(D.msToMidnight())}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return {
      onClose: () => {
        cancelAnimationFrame(raf);
        while (views.length) views.pop().destroy();
        opts.onClose?.();
      },
    };
  }, { label: `${shop.name} shop`, panelClass: 'shop-panel' });
}
