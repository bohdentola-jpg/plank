// HUD: wallet (your figure + tokens + streak + reset timer), news ticker, nav,
// car banner, toasts and flying-token juice.
import { $, el, ICONS } from './dom.js';
import { drawFigurePortrait } from '../art/figure.js';
import { productImage } from '../art/products.js';
import { RARITIES } from '../data/items.js';
import * as D from '../systems/daily.js';

let tokensShown = 0, tokensTarget = 0;
let tickerX = 0, tickerW = 0;

export function initHud(h) {
  $('#nav-train .nav-ico').innerHTML = ICONS.train;
  $('#nav-closet .nav-ico').innerHTML = ICONS.closet;
  $('#nav-me .nav-ico').innerHTML = ICONS.me;
  // a mouse/touch click drops focus first, so keys can't re-press the button;
  // keyboard activation (detail 0) keeps focus for keyboard users
  const bind = (sel, fn) => $(sel).addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.detail > 0) e.currentTarget.blur();
    fn();
  });
  bind('#nav-train', h.train);
  bind('#nav-closet', h.closet);
  bind('#nav-me', h.me);
  bind('#nav-sound', h.sound);
  bind('#wallet', h.me);
  bind('#go-back', h.back);
  bind('#go-next', h.next);
}

export function showHud(on) { $('#hud').hidden = !on; }

export function setSoundIcon(on) {
  const b = $('#nav-sound');
  b.querySelector('.nav-ico').innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
}

export function setFace(body, outfit) {
  drawFigurePortrait($('#wallet-face'), body, outfit, { t: 0.3 });
}

export function setTokens(n, instant = false) {
  tokensTarget = n;
  if (instant) {
    tokensShown = n;
    $('#wallet-tokens b').textContent = n.toLocaleString('en-US');
  }
}

export function bumpTokens() {
  const w = $('#wallet-tokens');
  w.classList.remove('bump');
  void w.offsetWidth;
  w.classList.add('bump');
}

export function setStreak(count, freezes) {
  $('#wallet-streak').textContent = count > 0 ? `🔥 ${count} DAY${count === 1 ? '' : 'S'}${freezes ? ` · ❄${freezes}` : ''}` : 'NO STREAK YET';
}

export function setDots({ closet = false, me = false } = {}) {
  $('#closet-dot').hidden = !closet;
  $('#me-dot').hidden = !me;
}

export function setNav(back, next) {
  const b = $('#go-back'), n = $('#go-next');
  b.hidden = !back;
  n.hidden = !next;
  if (back) b.querySelector('.lbl').textContent = back;
  if (next) n.querySelector('.lbl').textContent = next;
}

export function setTicker(lines) {
  const t = $('#ticker .ticker-text');
  const one = lines.join('   ✦   ') + '   ✦   ';
  t.textContent = one + one;
  tickerW = t.scrollWidth / 2;
  tickerX = 0;
}

let lastReset = '';
export function updateHud(dt) {
  if (tokensShown !== tokensTarget) {
    const d = tokensTarget - tokensShown;
    const step = Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 8)));
    tokensShown = Math.abs(step) >= Math.abs(d) ? tokensTarget : tokensShown + step;
    $('#wallet-tokens b').textContent = tokensShown.toLocaleString('en-US');
  }
  const txt = `NEW DROPS IN ${D.fmtCountdown(D.msToMidnight())}`;
  if (txt !== lastReset) {
    lastReset = txt;
    $('#wallet-reset').textContent = txt;
  }
  if (tickerW > 0) {
    tickerX -= dt * 70;
    if (-tickerX > tickerW) tickerX += tickerW;
    $('#ticker .ticker-text').style.transform = `translate(${tickerX.toFixed(1)}px, -50%)`;
  }
}

// ---------------------------------------------------------------- toasts

export function toast(html, cls = '', ms = 2600) {
  const box = $('#toasts');
  const t = el('div', { class: `toast ${cls}`, html });
  box.append(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, ms);
  return t;
}

export function tokenToast(n, why) {
  toast(`<span class="tok-ico"></span><span class="t-big">${n > 0 ? '+' : ''}${n.toLocaleString('en-US')}</span> TOKENS${why ? ` <small>${why}</small>` : ''}`, 'cash', 2000);
}

export function itemToast(item, o = {}) {
  const r = RARITIES[item.rarity];
  const img = productImage({ ...item, art: o.prismatic ? { ...item.art, prismatic: true } : item.art }, 72);
  const what = o.upgraded ? 'PRISMATIC UPGRADE' : o.prismatic ? `PRISMATIC ${r.name}` : r.name;
  toast(`<img alt="" src="${img}"/><span><span class="rar" style="color:${r.color}">${what}</span><br/>${item.name.toUpperCase()}</span>`, `item r-${item.rarity}${o.prismatic ? ' prism' : ''}`, 3200);
}

// coins fly from a screen point into the wallet
export function flyTokens(fromX, fromY, n = 6) {
  const target = $('#wallet-tokens .tok-ico').getBoundingClientRect();
  const box = $('#flyers');
  const tx = target.left + target.width / 2, ty = target.top + target.height / 2;
  for (let i = 0; i < Math.min(n, 12); i++) {
    const c = el('div', { class: 'flyer' });
    c.style.left = `${fromX}px`;
    c.style.top = `${fromY}px`;
    box.append(c);
    const dx = (Math.random() - 0.5) * 80, dy = -40 - Math.random() * 60;
    c.animate([
      { transform: 'translate(0,0) scale(0.6)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${tx - fromX}px, ${ty - fromY}px) scale(0.7)`, opacity: 0.9 },
    ], { duration: 750, delay: i * 45, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => c.remove();
  }
}

// ---------------------------------------------------------------- car banner

let bannerTimer = null;
export function carBanner(num, name) {
  const s = $('#car-name');
  s.innerHTML = '';
  if (num) s.append(el('span', { class: 'car-num' }, `CAR ${num}`));
  s.append(el('span', { class: 'car-title' }, name));
  s.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => s.classList.remove('show'), 1900);
}
