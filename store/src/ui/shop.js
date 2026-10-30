// Shop panels (one per shopkeeper), product detail, and the SHOP ALL catalog.
import { el, openOverlay, closeOverlay, panelHead, xButton } from './dom.js';
import { productImage } from '../art/products.js';
import { drawPortrait } from '../art/critters.js';
import { SHOPS, PRODUCTS, productsByShop, SIZES } from '../data/catalog.js';
import { money } from '../config.js';
import * as E from '../systems/econ.js';
import * as audio from '../audio.js';
import { toast } from './hud.js';
import { SPEAKERS } from './dialogue.js';

let api = { openBag: () => {} };
export function initShop(a) { api = { ...api, ...a }; }

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// extra words so search finds "sneakers" when the product is called "Lows"
const KIND_WORDS = {
  hoodie: 'hoodie sweatshirt sweater top apparel clothes', tee: 'tee t-shirt shirt top apparel clothes',
  jacket: 'jacket track top apparel clothes', windbreaker: 'jacket windbreaker coat apparel clothes',
  pants: 'pants cargos trousers bottoms apparel clothes', cap: 'hat cap snapback', beanie: 'hat beanie',
  bucket: 'hat bucket', chain: 'chain jewelry necklace gold', bag: 'bag crossbody purse', bandana: 'bandana scarf',
  shades: 'sunglasses glasses shades', low: 'sneakers shoes kicks trainers', high: 'sneakers shoes kicks high-tops trainers',
  slides: 'slides sandals shoes', socks: 'socks', cans: 'spray paint art', markers: 'markers paint art',
  stickerpack: 'stickers', sketchbook: 'sketchbook notebook art', print: 'print poster art', patches: 'patches',
  deck: 'skateboard deck', cassette: 'tape cassette music album', vinyl: 'vinyl record lp music album',
  headphones: 'headphones audio music', boombox: 'speaker boombox music', slipmat: 'slipmat dj turntable',
  freshener: 'air freshener', chips: 'chips snack food', soda: 'soda drink', brownbag: 'mystery bag surprise',
  candle: 'candle', mug: 'mug cup coffee', wallet: 'wallet card', keychain: 'keychain', tarot: 'tarot stickers cards',
  necklace: 'necklace jewelry', coasters: 'coasters home', bobble: 'bobblehead figure', watch: 'watch',
  pin: 'pin enamel', lantern: 'lantern light lamp',
};

function priceEl(p) {
  const pr = E.priceOf(p);
  return el('div', { class: 'price' }, money(pr.price), pr.was ? el('s', {}, money(pr.was)) : null);
}

function badgesEl(p) {
  const pr = E.priceOf(p);
  const left = E.stockLeft(p);
  const b = el('div', { class: 'badges' });
  if (left === 0) b.append(el('span', { class: 'badge out' }, 'SOLD OUT'));
  if (pr.pct) b.append(el('span', { class: 'badge deal' }, `-${pr.pct}%`));
  if (E.deals().dotd.product.id === p.id) b.append(el('span', { class: 'badge' }, 'WANTED'));
  if (p.tags.includes('limited')) b.append(el('span', { class: 'badge limited' }, 'LIMITED'));
  else if (p.tags.includes('new')) b.append(el('span', { class: 'badge new' }, 'NEW'));
  else if (p.tags.includes('hot')) b.append(el('span', { class: 'badge' }, 'HOT'));
  return b;
}

export function productCard(p, onOpen, opts = {}) {
  const locked = opts.locked;
  const card = el('button', {
    type: 'button', class: `card${locked ? ' locked' : ''}`, 'aria-label': locked ? 'Locked item from a secret store' : `${p.name}, ${money(E.priceOf(p).price)}`,
    onclick: locked ? () => toast('Found only in a secret store. Keep exploring.', 'sun') : () => onOpen(p),
  },
  el('div', { class: 'card-art' }, el('img', { src: productImage(p, 220), alt: '', loading: 'lazy' })),
  locked ? null : badgesEl(p),
  el('div', { class: 'card-info' },
    opts.showShop ? el('div', { class: 'card-shop' }, SHOPS[p.shop].name) : null,
    el('div', { class: 'card-name' }, locked ? '???' : p.name),
    locked ? el('div', { class: 'card-shop' }, 'SECRET STORE') : priceEl(p)));
  return card;
}

// ---------------------------------------------------------------- detail

function detailView(p, body, opts) {
  body.innerHTML = '';
  body.scrollTop = 0;
  const shop = SHOPS[p.shop];
  const sizes = SIZES[p.sizes] || SIZES.one;
  let size = sizes.length === 1 ? sizes[0] : null;
  let qty = 1;
  const left = E.stockLeft(p);
  const soldOut = left === 0;

  const sizeChips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Size' });
  sizes.forEach((s) => {
    const c = el('button', { type: 'button', class: 'chip', 'aria-pressed': size === s ? 'true' : 'false', disabled: soldOut }, s);
    c.addEventListener('click', () => {
      size = s;
      [...sizeChips.children].forEach((n) => n.setAttribute('aria-pressed', n === c ? 'true' : 'false'));
      sizeErr.hidden = true;
      audio.click();
    });
    sizeChips.append(c);
  });
  const sizeErr = el('div', { class: 'stock-note', hidden: true, style: { color: 'var(--hot)' } }, 'Pick a size first.');
  const qtyEl = el('span', {}, '1');
  const stepper = el('div', { class: 'stepper' },
    el('button', { type: 'button', 'aria-label': 'Less', onclick: () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; } }, '−'),
    qtyEl,
    el('button', { type: 'button', 'aria-label': 'More', onclick: () => { qty = Math.min(left ?? 9, 9, qty + 1); qtyEl.textContent = qty; } }, '+'));

  const addBtn = el('button', { type: 'button', class: 'btn btn-go', disabled: soldOut }, soldOut ? 'SOLD OUT' : 'ADD TO BAG');
  const viewBag = el('button', { type: 'button', class: 'btn btn-ghost', hidden: true, onclick: () => api.openBag() }, 'VIEW BAG');
  addBtn.addEventListener('click', () => {
    if (!size) {
      sizeErr.hidden = false;
      audio.beepBad();
      return;
    }
    E.addToBag(p.id, size, qty);
    audio.register();
    addBtn.textContent = 'ADDED ✓';
    viewBag.hidden = false;
    setTimeout(() => { addBtn.textContent = 'ADD ANOTHER'; }, 1200);
    toast(`<span>👜</span> ${p.name.toUpperCase()} → BAG`, 'cash', 1800);
    if (opts.onAdded) opts.onAdded(p);
  });

  const isDotd = E.deals().dotd.product.id === p.id;
  const art = el('div', { class: 'detail-art' }, el('img', { src: productImage(p, 520), alt: p.name }), badgesEl(p));
  body.append(
    el('button', { type: 'button', class: 'link-btn back-link', onclick: opts.onBack }, '← BACK'),
    el('div', { class: 'detail' },
      art,
      el('div', { style: { minWidth: '0' } },
        el('div', { class: 'card-shop' }, `${shop.name}${isDotd ? ' · DEAL OF THE DAY' : ''}`),
        el('h3', {}, p.name),
        priceEl(p),
        el('p', { class: 'desc' }, `“${p.desc}”`, el('span', { class: 'desc-by' }, `— ${shop.keeperName}`)),
        sizes.length > 1 ? el('div', { class: 'label' }, 'SIZE') : null,
        sizes.length > 1 ? sizeChips : null,
        sizeErr,
        el('div', { class: 'label' }, 'QTY'),
        el('div', { class: 'row' }, stepper, addBtn, viewBag),
        left != null ? el('div', { class: 'stock-note' }, soldOut ? 'All gone. Check back later.' : `Limited run · ${left} left`) : null)),
  );
}

// ---------------------------------------------------------------- shop panel

export function openShop(shopId, opts = {}) {
  const shop = SHOPS[shopId];
  const items = productsByShop(shopId);
  E.track('visit', shopId);
  openOverlay('shop', (panel, close) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const face = el('canvas', { class: 'panel-portrait', width: 82 * dpr * 1.6, height: 82 * dpr * 1.6, 'aria-hidden': 'true' });
    face.style.background = shop.color;
    const speech = el('div', { class: 'speech' }, opts.line || shop.browse);
    const head = el('div', { class: 'panel-head' }, face,
      el('div', { style: { minWidth: '0' } },
        el('h2', { class: 'panel-title', style: { color: shop.color } }, shop.name),
        speech));
    const body = el('div', { class: 'panel-body' });
    panel.append(head, body, xButton(close));
    let talkUntil = performance.now() + 1800;
    const say = (line) => {
      speech.textContent = line;
      talkUntil = performance.now() + Math.min(3000, 600 + line.length * 40);
      const sp = SPEAKERS[shop.keeper];
      if (sp) for (let i = 0; i < 4; i++) setTimeout(() => audio.blip(sp.pitch, sp.wave), i * 90);
    };
    const showGrid = () => {
      body.innerHTML = '';
      const grid = el('div', { class: 'grid' });
      items.forEach((p) => grid.append(productCard(p, (pp) => {
        audio.click();
        say(pp.desc.split('. ')[0].replace(/\.$/, '') + '.');
        detailView(pp, body, {
          onBack: () => { showGrid(); },
          onAdded: () => say(pick(['Excellent choice.', 'Ooh. Good eye.', 'Bagged it. Want anything else?', "You won't regret it."])),
        });
      })));
      body.append(grid);
    };
    showGrid();
    if (opts.product) {
      const p = items.find((x) => x.id === opts.product);
      if (p) detailView(p, body, { onBack: showGrid });
    }
    // animate the portrait while the panel is open
    let raf = 0;
    const tick = (ms) => {
      const t = ms / 1000;
      drawPortrait(face, shop.keeper === 'cheese' ? 'cheese' : shop.keeper, { t, talk: ms < talkUntil, blink: (t % 3.1) < 0.12 ? 1 : 0, boil: 11 + (Math.floor(t * 7) % 3) * 101 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { onClose: () => { cancelAnimationFrame(raf); if (opts.onClose) opts.onClose(); } };
  }, { label: `${shop.name} shop`, panelClass: 'shop-panel' });
}

export function openProduct(pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (!p) return;
  if (!E.shopUnlocked(p.shop)) return;
  openShop(p.shop, { product: pid, line: SHOPS[p.shop].deal(p.name) });
}

// ---------------------------------------------------------------- catalog

export function openCatalog(initial = 'all') {
  openOverlay('catalog', (panel, close) => {
    let filter = initial, q = '', sort = 'featured';
    const head = panelHead('SHOP ALL', 'Every shop on the 3, in one place. Secret stores unlock as you find them.');
    const body = el('div', { class: 'panel-body' });
    panel.append(head, body, xButton(close));
    const shops = Object.keys(SHOPS);
    const render = () => {
      body.innerHTML = '';
      const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' });
      const mk = (id, label, color) => {
        const c = el('button', { type: 'button', class: 'chip', 'aria-pressed': filter === id ? 'true' : 'false', style: color && filter !== id ? { borderColor: color } : null }, label);
        c.addEventListener('click', () => { filter = id; render(); });
        return c;
      };
      chips.append(mk('all', 'ALL'), mk('deals', '% DEALS', '#ff4f9a'));
      for (const s of shops) {
        if (SHOPS[s].secret && !E.shopUnlocked(s)) continue;
        chips.append(mk(s, SHOPS[s].name, SHOPS[s].color));
      }
      const search = el('input', { class: 'search', type: 'search', id: 'cat-search', placeholder: 'Search hoodies, kicks, tapes…', value: q, 'aria-label': 'Search products' });
      search.addEventListener('input', () => {
        q = search.value;
        renderGrid();
      });
      const sel = el('select', { class: 'select', id: 'cat-sort', 'aria-label': 'Sort' },
        ...[['featured', 'FEATURED'], ['low', 'PRICE: LOW → HIGH'], ['high', 'PRICE: HIGH → LOW'], ['name', 'NAME']].map(([v, l]) => el('option', { value: v, selected: sort === v }, l)));
      sel.addEventListener('change', () => { sort = sel.value; renderGrid(); });
      body.append(el('div', { class: 'filters' }, search, sel), chips);
      const gridWrap = el('div');
      body.append(gridWrap);
      const renderGrid = () => {
        gridWrap.innerHTML = '';
        const needle = q.trim().toLowerCase();
        let list = PRODUCTS.filter((p) => {
          if (filter === 'deals' && !E.priceOf(p).pct) return false;
          if (filter !== 'all' && filter !== 'deals' && p.shop !== filter) return false;
          if (needle && !(`${p.name} ${p.desc} ${SHOPS[p.shop].name} ${p.art.type} ${KIND_WORDS[p.art.type] || ''}`.toLowerCase().includes(needle))) return false;
          return true;
        });
        if (sort === 'low') list = list.slice().sort((a, b) => E.priceOf(a).price - E.priceOf(b).price);
        if (sort === 'high') list = list.slice().sort((a, b) => E.priceOf(b).price - E.priceOf(a).price);
        if (sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
        const grid = el('div', { class: 'grid' });
        let shown = 0;
        const teasers = {};
        for (const p of list) {
          const locked = !E.shopUnlocked(p.shop);
          if (locked && (filter !== 'all' || needle)) continue;
          if (locked) {
            teasers[p.shop] = (teasers[p.shop] || 0) + 1;
            if (teasers[p.shop] > 2) continue;
          }
          grid.append(productCard(p, (pp) => {
            audio.click();
            detailView(pp, body, { onBack: render });
          }, { showShop: true, locked }));
          shown++;
        }
        gridWrap.append(shown ? grid : el('div', { class: 'empty' }, 'Nothing down here matches that. Try another word.'));
      };
      renderGrid();
    };
    render();
  }, { label: 'Shop all products' });
}
