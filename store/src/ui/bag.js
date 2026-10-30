// The bag, checkout and the fare-card receipt.
import { el, openOverlay, panelHead, xButton } from './dom.js';
import { productImage } from '../art/products.js';
import { SHOPS } from '../data/catalog.js';
import { CONFIG, money } from '../config.js';
import * as E from '../systems/econ.js';
import * as audio from '../audio.js';
import { flyTokens, toast } from './hud.js';

let api = { openCatalog: () => {} };
export function initBag(a) { api = { ...api, ...a }; }

export function openBag() {
  openOverlay('bag', (panel, close) => {
    let couponId = null;
    const head = panelHead('YOUR BAG', 'Everything you picked up on the platform.');
    const body = el('div', { class: 'panel-body' });
    const foot = el('div', { class: 'panel-foot' });
    panel.append(head, body, foot, xButton(close));

    const renderBag = () => {
      body.innerHTML = '';
      foot.innerHTML = '';
      const t = E.totals(couponId);
      if (!t.lines.length) {
        body.append(el('div', { class: 'empty' },
          el('p', {}, 'Your bag is empty. The shops are calling.'),
          el('button', { type: 'button', class: 'btn btn-sun', onclick: () => { close(); api.openCatalog(); } }, 'SHOP ALL')));
        foot.hidden = true;
        return;
      }
      foot.hidden = false;
      const lines = el('div', { class: 'bag-lines' });
      for (const l of t.lines) {
        const qtyEl = el('span', {}, String(l.qty));
        lines.append(el('div', { class: 'bag-line' },
          el('img', { src: productImage(l.p, 144), alt: '' }),
          el('div', { style: { minWidth: '0' } },
            el('div', { class: 'nm' }, l.p.name),
            el('div', { class: 'meta' }, `${SHOPS[l.p.shop].name} · ${l.size}${l.pct ? ` · -${l.pct}%` : ''}`),
            el('div', { class: 'row', style: { marginTop: '6px', gap: '8px' } },
              el('div', { class: 'stepper' },
                el('button', { type: 'button', 'aria-label': `Remove one ${l.p.name}`, onclick: () => { E.setQty(l.i, l.qty - 1); renderBag(); } }, '−'),
                qtyEl,
                el('button', { type: 'button', 'aria-label': `Add one ${l.p.name}`, onclick: () => { E.setQty(l.i, l.qty + 1); renderBag(); } }, '+')),
              el('button', { type: 'button', class: 'link-btn', onclick: () => { E.setQty(l.i, 0); renderBag(); } }, 'REMOVE'))),
          el('div', { class: 'lp' }, money(l.line))));
      }
      body.append(lines);
      // coupons
      body.append(el('div', { class: 'label' }, 'COUPON'));
      const cps = E.S.coupons;
      if (cps.length) {
        const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Coupon' });
        const none = el('button', { type: 'button', class: 'chip', 'aria-pressed': couponId ? 'false' : 'true', onclick: () => { couponId = null; renderBag(); } }, 'NONE');
        chips.append(none);
        for (const c of cps) chips.append(el('button', { type: 'button', class: 'chip', 'aria-pressed': couponId === c.id ? 'true' : 'false', onclick: () => { couponId = c.id; audio.click(); renderBag(); } }, c.label));
        body.append(chips);
      } else {
        body.append(el('p', { class: 'note' }, 'No coupons yet. Trade tokens for coupons at the ', el('b', {}, 'Token Booth'), ' in Token Sq, or win them from The Grabber.'));
      }
      if (t.golden) body.append(el('p', { class: 'note' }, el('b', {}, 'GOLDEN FARE CARD:'), ' 10% off everything, forever.'));
      // summary
      const sum = el('div', { class: 'sum' });
      const row = (k, v, cls = '') => { sum.append(el('span', { class: cls }, k), el('span', { class: cls }, v)); };
      row('SUBTOTAL', money(t.subtotal));
      if (t.saved) row('DEALS SAVED YOU', money(t.saved), 'neg');
      if (t.discount) row(t.coupon ? `COUPON (${t.coupon.label})${t.golden ? ' + GOLDEN' : ''}` : 'GOLDEN FARE CARD', `−${money(t.discount)}`, 'neg');
      row('SHIPPING', t.ship ? money(t.ship) : 'FREE');
      row('TOTAL', money(t.total), 'tot');
      body.append(sum);
      if (t.ship) body.append(el('p', { class: 'note' }, `Free shipping on orders over ${money(CONFIG.shipping.freeOver)}.`));
      foot.append(el('div', { class: 'row', style: { justifyContent: 'space-between' } },
        el('span', { class: 'note' }, `+${Math.round(t.total * CONFIG.tokensPerDollar)} tokens back`),
        el('button', { type: 'button', class: 'btn btn-go', onclick: () => renderCheckout() }, `CHECKOUT · ${money(t.total)}`)));
    };

    const renderCheckout = () => {
      body.innerHTML = '';
      foot.innerHTML = '';
      foot.hidden = false;
      const t = E.totals(couponId);
      const demo = CONFIG.checkout.mode !== 'link' || !CONFIG.checkout.url;
      body.append(el('button', { type: 'button', class: 'link-btn back-link', onclick: renderBag }, '← BACK TO BAG'));
      if (demo) {
        body.append(el('div', { class: 'demo-banner' }, el('p', {},
          'This is a demo of the store. Placing an order saves it on this device so you can see the whole flow. Nobody is charged and nothing ships.')));
      }
      const list = el('div', { class: 'sum' });
      for (const l of t.lines) list.append(el('span', {}, `${l.qty}× ${l.p.name} (${l.size})`), el('span', {}, money(l.line)));
      if (t.discount) list.append(el('span', { class: 'neg' }, 'DISCOUNTS'), el('span', { class: 'neg' }, `−${money(t.discount)}`));
      list.append(el('span', {}, 'SHIPPING'), el('span', {}, t.ship ? money(t.ship) : 'FREE'));
      list.append(el('span', { class: 'tot' }, 'TOTAL'), el('span', { class: 'tot' }, money(t.total)));
      body.append(list);
      const place = el('button', { type: 'button', class: 'btn btn-go btn-block' }, demo ? `PLACE DEMO ORDER · ${money(t.total)}` : `CONTINUE TO PAYMENT · ${money(t.total)}`);
      place.addEventListener('click', () => {
        if (!demo) {
          const payload = { items: t.lines.map((l) => ({ id: l.p.id, size: l.size, qty: l.qty })), coupon: t.coupon ? t.coupon.label : null, total: t.total };
          const a = el('a', { href: `${CONFIG.checkout.url}${CONFIG.checkout.url.includes('?') ? '&' : '?'}order=${encodeURIComponent(JSON.stringify(payload))}`, target: '_blank', rel: 'noopener' });
          document.body.append(a);
          a.click();
          a.remove();
          return;
        }
        const res = E.placeOrder(couponId);
        if (!res) return;
        audio.register();
        setTimeout(() => audio.fanfare(), 250);
        renderReceipt(res);
      });
      foot.append(place);
    };

    const renderReceipt = ({ order, tokens }) => {
      body.innerHTML = '';
      foot.innerHTML = '';
      foot.hidden = false;
      const card = el('div', { class: 'farecard' },
        el('h4', {}, `${CONFIG.storeName} FARE CARD`),
        el('div', { class: 'fc-id' }, `ORDER ${order.id}`),
        ...order.items.map((i) => el('div', { class: 'fc-row' }, el('span', {}, `${i.qty}× ${i.name} · ${i.size}`), el('span', {}, money(i.price * i.qty)))),
        el('div', { class: 'fc-row fc-tot' }, el('span', {}, 'TOTAL'), el('span', {}, money(order.total))));
      body.append(card,
        el('p', { class: 'note', style: { textAlign: 'center' } }, 'Order saved. It’s headed down the tracks (in demo land).'),
        el('p', { class: 'reward-line', style: { textAlign: 'center' } }, `+${tokens} TOKENS BACK`));
      foot.append(el('button', { type: 'button', class: 'btn btn-sun btn-block', onclick: close }, 'KEEP EXPLORING'));
      requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        flyTokens(r.left + r.width / 2, r.top + r.height / 2, 10);
      });
      toast(`ORDER ${order.id} PLACED`, 'cash');
    };

    renderBag();
  }, { label: 'Your bag' });
}
