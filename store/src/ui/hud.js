// HUD: wallet (portrait + tokens + streak + reset timer), news ticker, nav,
// the in-world interaction prompt, toasts and flying-token juice.
import { $, el, ICONS } from './dom.js';
import { drawPortrait } from '../art/critters.js';
import { stickerImage } from '../art/stickers.js';
import * as D from '../systems/daily.js';

let tokensShown = 0, tokensTarget = 0;
let tickerX = 0, tickerW = 0, tickerLines = [];
let face, faceLook = null;

export function initHud(handlers) {
  face = $('#wallet-face');
  $('#nav-map .nav-ico').innerHTML = ICONS.map;
  $('#nav-shop .nav-ico').innerHTML = ICONS.shop;
  $('#nav-bag .nav-ico').innerHTML = ICONS.bag;
  $('#nav-me .nav-ico').innerHTML = ICONS.me;
  // a mouse/touch click drops focus first, so SPACE (hop) can't re-press the button;
  // keyboard activation (detail 0) keeps focus for keyboard users
  const bind = (sel, fn) => $(sel).addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.detail > 0) e.currentTarget.blur();
    fn();
  });
  bind('#nav-map', handlers.map);
  bind('#nav-shop', handlers.shop);
  bind('#nav-bag', handlers.bag);
  bind('#nav-me', handlers.me);
  bind('#nav-sound', handlers.sound);
  bind('#wallet', handlers.me);
  bind('#prompt', handlers.prompt);
  $('#wallet').style.cursor = 'pointer';
}

export function showHud(on) { $('#hud').hidden = !on; }

export function setSoundIcon(on) {
  const b = $('#nav-sound');
  b.querySelector('.nav-ico').innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
}

export function setFace(look) {
  faceLook = look;
  drawPortrait(face, 'rat', { look, t: 0.3 });
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
  setTimeout(() => w.classList.remove('bump'), 160);
}

export function setStreak(count, freezes) {
  $('#wallet-streak').textContent = count > 0 ? `🔥${count} DAY${count === 1 ? '' : 'S'}${freezes ? ` · ❄${freezes}` : ''}` : 'NO STREAK';
}

export function setBag(n) {
  const b = $('#bag-badge');
  b.hidden = n <= 0;
  b.textContent = String(n);
}

export function setMeDot(on) { $('#me-dot').hidden = !on; }

export function setTicker(lines) {
  tickerLines = lines;
  const t = $('#ticker .ticker-text');
  t.textContent = lines.join('   ·   BREAKING NEWS — ') + '   ·   ';
  // duplicate for a seamless loop
  t.textContent = t.textContent + t.textContent;
  tickerW = t.scrollWidth / 2;
  tickerX = 0;
}

let lastReset = '';
export function updateHud(dt) {
  // count-up tokens
  if (tokensShown !== tokensTarget) {
    const d = tokensTarget - tokensShown;
    const stepAmt = Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 8)));
    tokensShown = Math.abs(stepAmt) >= Math.abs(d) ? tokensTarget : tokensShown + stepAmt;
    $('#wallet-tokens b').textContent = tokensShown.toLocaleString('en-US');
  }
  // reset countdown
  const txt = `⟳ ${D.fmtCountdown(D.msToMidnight())}`;
  if (txt !== lastReset) {
    lastReset = txt;
    $('#wallet-reset').textContent = txt;
  }
  // ticker
  if (tickerW > 0) {
    tickerX -= dt * 70;
    if (-tickerX > tickerW) tickerX += tickerW;
    $('#ticker .ticker-text').style.transform = `translate(${tickerX.toFixed(1)}px, -50%)`;
  }
}

// ---------------------------------------------------------------- prompt

export function showPrompt(x, y, label, opts = {}) {
  const p = $('#prompt');
  const key = opts.touch ? 'TAP' : 'E';
  const html = `<span class="key">${key}</span><span></span>${opts.badge ? `<span class="badge">${opts.badge}</span>` : ''}`;
  if (p.dataset.html !== html + label) {
    p.innerHTML = html;
    p.children[1].textContent = label;
    p.dataset.html = html + label;
    p.setAttribute('aria-label', `${label} (${key})`);
  }
  p.hidden = false;
  p.style.left = `${Math.round(x)}px`;
  p.style.top = `${Math.round(y)}px`;
}

export function hidePrompt() { $('#prompt').hidden = true; }

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
  toast(`<span class="tok-ico"></span><span class="t-big">${n > 0 ? '+' : ''}${n}</span> TOKENS${why ? ` <small style="color:var(--muted)">${why}</small>` : ''}`, 'cash', 2000);
}

export function stickerToast(st) {
  toast(`<img alt="" src="${stickerImage(st, 68)}"/> NEW STICKER: ${st.name.toUpperCase()}`, 'hot', 3200);
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
    const delay = i * 45;
    c.animate([
      { transform: 'translate(0,0) scale(0.6)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${tx - fromX}px, ${ty - fromY}px) scale(0.7)`, opacity: 0.9 },
    ], { duration: 750, delay, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => c.remove();
  }
}

// ---------------------------------------------------------------- banners + hint

let nameTimer = null, bannerUntil = 0;
export function stationBanner(name) {
  const s = $('#station-name');
  s.textContent = name;
  s.classList.add('show');
  bannerUntil = performance.now() + 2200;
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => s.classList.remove('show'), 2200);
}
export const bannerUp = () => performance.now() < bannerUntil;

export function showHint(html, ms = 9000) {
  const h = $('#hint');
  h.innerHTML = html;
  h.hidden = false;
  h.style.opacity = '1';
  setTimeout(() => { h.style.opacity = '0'; }, ms);
  setTimeout(() => { h.hidden = true; }, ms + 1100);
}
