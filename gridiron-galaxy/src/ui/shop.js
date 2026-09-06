// Shop interiors (Splatoon-style): painted room, animated keeper, item strip, detail panel, coin economy.
import { registerScreen } from '../main.js';
import { PLANETS, PLANET_BY_ID } from '../data/planets.js';
import { GEAR, GEAR_TIER_BONUS, GEAR_TIER_PRICE, FOOD, RATING_LABEL } from '../data/roster.js';
import { BASE_PLAYS, getPlanetPlays } from '../data/plays.js';
import { drawSky, drawSkyline, drawCreature, label, rr, drawIcon } from './art2d.js';
import { drawPlayArt } from './playcall.js';
import { Dialog } from './dialog.js';
import { GridNav } from './menu.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { el, fmtCoins, makeRng, hashStr, shade, mix, rgba } from '../util.js';

const INK = '#141a2e';
export function drawShopInterior(ctx, w, h, kind, planet, t = 0) {
  const th = planet.theme; const P = th.palette; const rnd = makeRng(hashStr(planet.id + kind));
  const wall = mix(P[0], '#ffffff', 0.45), wallDark = shade(wall, -0.18), floor = mix(P[3] || '#3a3a4a', '#8a7a6a', 0.45); const horizon = h * 0.66;
  // wall
  ctx.fillStyle = wall; ctx.fillRect(0, 0, w, horizon);
  // wallpaper by theme
  const gt = th.groundType;
  ctx.save(); ctx.globalAlpha = 0.18;
  if (['candy', 'carpet', 'dancefloor'].includes(gt)) { for (let x = -h; x < w; x += 46) { ctx.fillStyle = P[1]; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x + 20 + horizon * 0.35, horizon); ctx.lineTo(x + horizon * 0.35, horizon); ctx.fill(); } }
  else if (['ice', 'crystal', 'bubbles', 'clouds'].includes(gt)) { for (let i = 0; i < 40; i++) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(rnd() * w, rnd() * horizon, rnd.range(6, 22), 0, 7); ctx.fill(); } }
  else if (['street', 'factory', 'ring', 'ship', 'junk', 'clock'].includes(gt)) { ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let x = 0; x < w; x += 110) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, horizon); ctx.stroke(); } for (let y = 0; y < horizon; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
  else if (['lava', 'void', 'graveyard'].includes(gt)) { ctx.strokeStyle = P[1]; ctx.lineWidth = 3; for (let i = 0; i < 10; i++) { let x = rnd() * w, y = rnd() * horizon; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd.range(-60, 60); y += rnd.range(-40, 40); ctx.lineTo(x, y); } ctx.stroke(); } }
  else { for (let i = 0; i < 26; i++) { ctx.fillStyle = P[1]; ctx.beginPath(); ctx.arc(rnd() * w, rnd() * horizon * 0.8, rnd.range(10, 26), 0, 7); ctx.fill(); } }
  ctx.restore();
  // wainscot + trim
  ctx.fillStyle = wallDark; ctx.fillRect(0, horizon - 70, w, 70); ctx.fillStyle = shade(wall, 0.2); ctx.fillRect(0, horizon - 74, w, 8);
  // floor with perspective planks
  const fg = ctx.createLinearGradient(0, horizon, 0, h); fg.addColorStop(0, shade(floor, 0.1)); fg.addColorStop(1, shade(floor, -0.25)); ctx.fillStyle = fg; ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = rgba(INK, 0.25); ctx.lineWidth = 2; for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 90, horizon); ctx.lineTo(w / 2 + i * 260, h); ctx.stroke(); } for (let k = 1; k < 5; k++) { const y = horizon + (h - horizon) * (k * k) / 25; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // window with the planet outside
  const wx = w * 0.06, wy = h * 0.1, ww = w * 0.22, wh = h * 0.32;
  ctx.save(); rr(ctx, wx, wy, ww, wh, 18); ctx.clip(); ctx.translate(wx, wy); drawSky(ctx, th, ww, wh * 1.6, t, 0.6); drawSkyline(ctx, th.skyline, ww, wh * 0.72, P, 5, t); ctx.fillStyle = shade(th.ground, -0.1); ctx.fillRect(0, wh * 0.72, ww, wh); ctx.restore();
  ctx.strokeStyle = '#f4f4f8'; ctx.lineWidth = 10; rr(ctx, wx, wy, ww, wh, 18); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.strokeStyle = '#f4f4f8'; ctx.lineWidth = 6; ctx.stroke();
  // ceiling lamps
  for (let i = 0; i < 3; i++) { const lx = w * (0.3 + i * 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 50); ctx.stroke(); ctx.fillStyle = P[2]; ctx.beginPath(); ctx.moveTo(lx - 30, 80); ctx.lineTo(lx + 30, 80); ctx.lineTo(lx + 12, 50); ctx.lineTo(lx - 12, 50); ctx.closePath(); ctx.fill(); ctx.stroke(); const lg = ctx.createRadialGradient(lx, 84, 4, lx, 84, 120); lg.addColorStop(0, 'rgba(255,240,200,0.45)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = lg; ctx.fillRect(lx - 120, 80, 240, 200); }
  ctx.lineWidth = 3.5; ctx.strokeStyle = INK;
  if (kind === 'eat') {
    // menu board
    ctx.fillStyle = '#1a1a24'; rr(ctx, w * 0.34, h * 0.08, w * 0.3, h * 0.28, 12); ctx.fill(); ctx.strokeStyle = '#8b6b4a'; ctx.lineWidth = 8; ctx.stroke();
    label(ctx, planet.shops.eat.name.toUpperCase(), w * 0.49, h * 0.13, 22, '#ffd23f', 'transparent');
    const items = Object.values(FOOD).slice(0, 4); items.forEach((f, i) => { ctx.font = '18px "Comic Sans MS", "Trebuchet MS", sans-serif'; ctx.fillStyle = '#f4f4f8'; ctx.textAlign = 'left'; ctx.fillText(`${f.name}`, w * 0.36, h * 0.19 + i * 28); ctx.textAlign = 'right'; ctx.fillStyle = '#7fe3a6'; ctx.fillText(`${f.price}¢`, w * 0.62, h * 0.19 + i * 28); });
    // counter
    ctx.fillStyle = shade(P[3] || '#5a3a2a', 0.35); rr(ctx, w * 0.02, horizon - 20, w * 0.62, 120, 14); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke(); ctx.fillStyle = shade(P[3] || '#5a3a2a', 0.55); ctx.fillRect(w * 0.02, horizon - 26, w * 0.62, 18); ctx.strokeRect(w * 0.02, horizon - 26, w * 0.62, 18);
    // pot with steam, plates, jars
    ctx.fillStyle = '#5a5a66'; rr(ctx, w * 0.44, horizon - 76, 90, 52, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3a3a44'; ctx.fillRect(w * 0.44 - 8, horizon - 80, 106, 10);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6; ctx.beginPath(); const sx = w * 0.44 + 20 + i * 25; ctx.moveTo(sx, horizon - 84); ctx.quadraticCurveTo(sx + 14 * Math.sin(t * 2 + i), horizon - 120, sx, horizon - 150 - (t * 20 + i * 15) % 30); ctx.stroke(); }
    for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff6b6b', '#ffd23f', '#57e86b', '#c66bff', '#4dc9ff'][i]; rr(ctx, w * 0.06 + i * 44, horizon - 68, 32, 44, 8); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#f4f4f8'; ctx.fillRect(w * 0.06 + i * 44 + 4, horizon - 74, 24, 8); }
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#5a3a2a'; ctx.fillRect(w * (0.08 + i * 0.18), horizon + 60, 12, 80); ctx.fillStyle = P[1]; ctx.beginPath(); ctx.ellipse(w * (0.08 + i * 0.18) + 6, horizon + 58, 30, 12, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  } else if (kind === 'gear') {
    // rack with jerseys
    ctx.fillStyle = '#8a919c'; ctx.fillRect(w * 0.3, h * 0.14, w * 0.34, 8); ctx.fillRect(w * 0.3, h * 0.14, 8, h * 0.3); ctx.fillRect(w * 0.64, h * 0.14, 8, h * 0.3);
    const cols = [P[0], P[1], P[2], '#f4f4f8', P[0]]; for (let i = 0; i < 5; i++) { const jx = w * 0.33 + i * w * 0.065, jy = h * 0.16; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(jx + 60, jy); ctx.lineTo(jx + 72, jy + 22); ctx.lineTo(jx + 58, jy + 30); ctx.lineTo(jx + 56, jy + 90); ctx.lineTo(jx + 4, jy + 90); ctx.lineTo(jx + 2, jy + 30); ctx.lineTo(jx - 12, jy + 22); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); label(ctx, String(10 + i * 17), jx + 30, jy + 58, 26, '#fff', INK); }
    // helmet shelf
    ctx.fillStyle = shade(P[3] || '#5a3a2a', 0.4); ctx.fillRect(w * 0.05, h * 0.5, w * 0.24, 12); ctx.strokeRect(w * 0.05, h * 0.5, w * 0.24, 12);
    for (let i = 0; i < 3; i++) { const hx = w * 0.09 + i * w * 0.08, hy = h * 0.47; ctx.fillStyle = [P[0], P[1], P[2]][i]; ctx.beginPath(); ctx.arc(hx, hy, 26, Math.PI, 0); ctx.lineTo(hx + 26, hy + 12); ctx.lineTo(hx - 26, hy + 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(hx - 24, hy + 4); ctx.lineTo(hx + 24, hy + 4); ctx.moveTo(hx - 22, hy + 12); ctx.lineTo(hx + 22, hy + 12); ctx.stroke(); }
    // shoe boxes + mannequin
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#e0e0e8' : P[2]; ctx.fillRect(w * 0.7 + (i % 2) * 6, horizon + 20 + i * 26 - 100, 90, 26); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(w * 0.7 + (i % 2) * 6, horizon + 20 + i * 26 - 100, 90, 26); }
    ctx.fillStyle = '#d9d9e3'; rr(ctx, w * 0.2, horizon - 130, 70, 110, 20); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke(); ctx.fillStyle = P[0]; rr(ctx, w * 0.2 + 6, horizon - 122, 58, 70, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5a5a66'; ctx.fillRect(w * 0.2 + 30, horizon - 20, 10, 60);
    // counter
    ctx.fillStyle = shade(P[3] || '#5a3a2a', 0.35); rr(ctx, w * 0.3, horizon + 10, w * 0.32, 90, 12); ctx.fill(); ctx.stroke();
  } else {
    // whiteboard with a play drawn on it
    ctx.fillStyle = '#f7f7fa'; rr(ctx, w * 0.28, h * 0.08, w * 0.42, h * 0.4, 10); ctx.fill(); ctx.strokeStyle = '#8a919c'; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(w * 0.3, h * 0.1); const bw = w * 0.38, bh = h * 0.36; ctx.strokeStyle = '#4a6fd6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, bh * 0.7); ctx.lineTo(bw, bh * 0.7); ctx.stroke();
    const xs = [0.15, 0.32, 0.5, 0.68, 0.85]; xs.forEach((fx, i) => { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bw * fx, bh * 0.78, 9, 0, 7); ctx.stroke(); ctx.strokeStyle = ['#e63946', '#4a6fd6', '#2a9d8f', '#e63946', '#4a6fd6'][i]; ctx.beginPath(); ctx.moveTo(bw * fx, bh * 0.7); ctx.lineTo(bw * fx + (i - 2) * 10, bh * (0.35 - i * 0.05)); ctx.lineTo(bw * fx + (i - 2) * 40, bh * 0.15); ctx.stroke(); });
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = INK; ctx.lineWidth = 3; const dx = bw * (0.2 + i * 0.15), dy = bh * 0.55; ctx.beginPath(); ctx.moveTo(dx - 8, dy - 8); ctx.lineTo(dx + 8, dy + 8); ctx.moveTo(dx + 8, dy - 8); ctx.lineTo(dx - 8, dy + 8); ctx.stroke(); }
    ctx.restore();
    label(ctx, planet.shops.plays.name.toUpperCase(), w * 0.49, h * 0.52, 20, '#fff', INK);
    // projector
    ctx.fillStyle = '#3a3a44'; rr(ctx, w * 0.14, horizon - 90, 70, 40, 8); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#5a5a66'; ctx.fillRect(w * 0.14 + 30, horizon - 50, 10, 60); ctx.fillStyle = 'rgba(255,255,220,0.12)'; ctx.beginPath(); ctx.moveTo(w * 0.14 + 70, horizon - 70); ctx.lineTo(w * 0.28, h * 0.12); ctx.lineTo(w * 0.28, h * 0.46); ctx.fill();
    // film reels & trophies
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#5a5a66'; ctx.beginPath(); ctx.arc(w * 0.76 + i * 50, h * 0.22, 22, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a1a24'; ctx.beginPath(); ctx.arc(w * 0.76 + i * 50, h * 0.22, 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = shade(P[3] || '#5a3a2a', 0.4); ctx.fillRect(w * 0.72, h * 0.3, w * 0.22, 10); ctx.strokeRect(w * 0.72, h * 0.3, w * 0.22, 10);
    for (let i = 0; i < 3; i++) { const tx = w * 0.76 + i * 50; ctx.fillStyle = '#ffd23f'; rr(ctx, tx - 10, h * 0.32, 20, 34, 6); ctx.fill(); ctx.stroke(); ctx.fillRect(tx - 16, h * 0.32 + 36, 32, 8); ctx.strokeRect(tx - 16, h * 0.32 + 36, 32, 8); }
    ctx.fillStyle = shade(P[3] || '#5a3a2a', 0.35); rr(ctx, w * 0.3, horizon + 10, w * 0.32, 90, 12); ctx.fill(); ctx.stroke();
  }
  // rug / mat by the door
  ctx.fillStyle = rgba(P[1], 0.6); ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.92, w * 0.2, 26, 0, 0, 7); ctx.fill();
}

const BUY_LINES = ['Sold! Wear it with pride.', 'Great choice. That one\'s my favorite.', 'Pleasure doing business with an Earthling.', 'That\'ll help out there. Trust me.'];
const POOR_LINES = ['You\'re a little short on coins, friend.', 'Come back with more coins! Win some games!', 'My rent is due too, kid. Coins first.'];
const BYE_LINES = ['Come back soon!', 'Good luck out there!', 'Tell your friends. Tell your enemies too.'];

export class ShopScreen {
  constructor(app, params) { this.app = app; this.P = params || {}; }
  enter() {
    const app = this.app; this.planet = PLANET_BY_ID[this.P.planet] || PLANETS[1]; this.kind = this.P.kind || 'eat'; this.shop = this.planet.shops[this.kind];
    app.use2D(true); this.ctx = app.ctx2d; this.t = 0; this.tab = 0; this.busy = false; this.blinkT = 2;
    this.dialog = new Dialog(app, 'shop'); this.paint(); this.buildItems(); this.nav = new GridNav(this.items.length, this.items.length);
    audio.music('shop', this.planet.index + 11);
    this.dialog.set({ who: this.shop.keeper, text: this.shop.lines[0] });
    this.buildDOM();
  }
  paint() { const w = this.app.vw, h = this.app.vh; this.bg = document.createElement('canvas'); const dpr = Math.min(window.devicePixelRatio || 1, 2); this.bg.width = w * dpr; this.bg.height = h * dpr; const c = this.bg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); drawShopInterior(c, w, h, this.kind, this.planet, 0); }
  buildItems() {
    const save = this.app.save; const rnd = makeRng(hashStr(this.planet.id + this.kind)); this.items = [];
    if (this.kind === 'eat') { const keys = rnd.shuffle(Object.keys(FOOD)).slice(0, 6); for (const k of keys) { const f = FOOD[k]; this.items.push({ id: k, name: f.name, price: f.price, icon: f.icon, desc: `Eaten before your next game: +${f.amt} ${RATING_LABEL[f.stat]} for the whole team, one game only.`, sub: `+${f.amt} ${RATING_LABEL[f.stat]}`, count: (save.pantry || []).filter(x => x === k).length }); } }
    else if (this.kind === 'gear') { const keys = rnd.shuffle(Object.keys(GEAR)).slice(0, 5); for (const k of keys) { const g = GEAR[k]; const cur = save.gear[k] || 0; const next = Math.min(3, cur + 1); const maxed = cur >= 3; this.items.push({ id: k, name: `${g.name} ${['', 'I', 'II', 'III'][next]}`, price: maxed ? 0 : GEAR_TIER_PRICE[next], icon: g.icon, maxed, tier: cur, desc: `${g.desc} Tier ${['-', 'I', 'II', 'III'][next]}: +${GEAR_TIER_BONUS[next]} ${RATING_LABEL[g.stat]} for every kid, permanently.${cur ? ` (You own tier ${['', 'I', 'II', 'III'][cur]}.)` : ''}`, sub: maxed ? 'MAXED OUT' : `+${GEAR_TIER_BONUS[next]} ${RATING_LABEL[g.stat]}` }); } }
    else { if (this.tab === 0) { for (const p of getPlanetPlays(this.planet)) this.items.push({ id: p.id, name: p.name, price: p.price, play: p, owned: save.playsOwned.includes(p.id), desc: p.desc, sub: `${p.formation} · ${p.type}${p.trick ? ' · trick' : ''}` }); } else { const owned = new Set(save.playsOwned); const extra = []; for (const pl of PLANETS) for (const p of getPlanetPlays(pl)) if (owned.has(p.id)) extra.push(p); for (const p of [...BASE_PLAYS, ...extra]) this.items.push({ id: p.id, name: p.name, price: 0, play: p, owned: true, desc: p.desc, sub: `${p.cat.toUpperCase()} · ${p.formation}` }); } }
  }
  buildDOM() {
    const app = this.app; app.ui.innerHTML = '';
    app.ui.appendChild(el('div', { class: 'topright' }, el('span', { class: 'tag', text: `${this.planet.name} · ${this.shop.name}` }), el('span', { class: 'coins', text: fmtCoins(app.save.coins) })));
    if (this.kind === 'plays') { this.tabs = el('div', { class: 'shop-tabs' }, el('div', { class: 'stab' + (this.tab === 0 ? ' on' : ''), text: 'Planet Specials', onclick: () => this.setTab(0) }), el('div', { class: 'stab' + (this.tab === 1 ? ' on' : ''), text: `My Playbook (${BASE_PLAYS.length + app.save.playsOwned.length})`, onclick: () => this.setTab(1) })); app.ui.appendChild(this.tabs); }
    this.strip = el('div', { class: 'shop-items' }); app.ui.appendChild(this.strip);
    this.detail = el('div', { class: 'shop-detail' }); app.ui.appendChild(this.detail);
    const g = (a, l) => input.glyphHTML(a, l);
    app.ui.appendChild(el('div', { class: 'hint', html: `${g('left')}${g('right', 'Browse')} ${this.kind === 'plays' ? g('l1') + g('r1', 'Tab') : ''} ${g('cross', 'Buy')} ${g('circle', 'Leave')}` }));
    this.renderItems();
  }
  setTab(i) { if (this.tab === i) return; this.tab = i; audio.sfx('blip'); this.buildItems(); this.nav = new GridNav(this.items.length, this.items.length); this.buildDOM(); }
  renderItems() {
    this.strip.innerHTML = ''; const start = Math.max(0, Math.min(this.nav.index - 3, this.items.length - 7)); const shown = this.items.slice(start, start + 7);
    shown.forEach((it, k) => {
      const i = start + k; const cv = document.createElement('canvas'); cv.width = 140; cv.height = 90;
      if (it.play) drawPlayArt(cv, it.play, { w: 140, h: 90 }); else { const c = cv.getContext('2d'); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 0, 140, 90); drawIcon(c, it.icon, 70, 45, 62, ['#ffd23f', '#7fe3a6', '#7fb3ff', '#ff9ad5', '#ff6b7a'][i % 5]); }
      const priceTxt = it.maxed ? 'MAX' : it.owned ? 'OWNED' : it.count ? `${it.price}¢ · x${it.count}` : `${it.price}¢`;
      const card = el('div', { class: 'item' + (i === this.nav.index ? ' sel' : ''), onmouseenter: () => { if (this.nav.index !== i) { this.nav.index = i; audio.sfx('blip'); this.renderItems(); } }, onclick: () => this.buy() }, cv, el('div', { class: 'nm', text: it.name }), el('div', { class: 'pr' + (it.owned || it.maxed ? ' owned' : it.price > this.app.save.coins ? ' poor' : ''), text: priceTxt }));
      this.strip.appendChild(card);
    });
    const it = this.items[this.nav.index]; if (!it) { this.detail.innerHTML = ''; return; }
    this.detail.innerHTML = ''; const panel = el('div', { class: 'panel' }, el('h3', { text: it.name }), el('div', { class: 'tag', text: it.sub || '' }), el('p', { text: it.desc }));
    if (it.play) { const cv = document.createElement('canvas'); drawPlayArt(cv, it.play, { w: 300, h: 190 }); panel.appendChild(cv); }
    panel.appendChild(el('p', { html: it.maxed ? '<b style="color:#7fe3a6">Fully upgraded.</b>' : it.owned ? '<b style="color:#7fe3a6">In your playbook.</b>' : `<b style="color:#ffd23f">${it.price} coins</b> · you have ${fmtCoins(this.app.save.coins)}` }));
    this.detail.appendChild(panel);
  }
  async buy() {
    if (this.busy) return; const it = this.items[this.nav.index]; if (!it) return; const save = this.app.save;
    if (it.owned && it.play) { this.dialog.set({ who: this.shop.keeper, text: 'You already have that one, champ.' }); audio.sfx('error'); return; }
    if (it.maxed) { this.dialog.set({ who: this.shop.keeper, text: 'Can\'t upgrade that any further. It\'s perfect. Like me.' }); audio.sfx('error'); return; }
    if (save.coins < it.price) { this.dialog.set({ who: this.shop.keeper, text: POOR_LINES[Math.floor(Math.random() * POOR_LINES.length)] }); audio.sfx('error'); return; }
    if (this.kind === 'eat' && (save.pantry || []).length >= 5) { this.dialog.set({ who: this.shop.keeper, text: 'Your pantry is full! Eat something first (play a game).' }); audio.sfx('error'); return; }
    this.busy = true;
    const ans = await this.dialog.say({ who: this.shop.keeper, text: `${it.name} for ${it.price} coins. Deal?`, choices: ['Deal!', 'No thanks'] });
    this.busy = false;
    if (ans !== 0) { this.dialog.set({ who: this.shop.keeper, text: 'No pressure. Browse all you like.' }); return; }
    save.coins -= it.price; audio.sfx('buy');
    if (this.kind === 'eat') { save.pantry = save.pantry || []; save.pantry.push(it.id); }
    else if (this.kind === 'gear') { save.gear[it.id] = (save.gear[it.id] || 0) + 1; }
    else { save.playsOwned.push(it.id); }
    this.app.persist(); this.buildItems(); this.buildDOM(); this.dialog.set({ who: this.shop.keeper, text: BUY_LINES[Math.floor(Math.random() * BUY_LINES.length)] });
    if (this.P.onBuy) this.P.onBuy(it);
  }
  update(dt) {
    this.t += dt; this.dialog.update(dt); this.blinkT -= dt; if (this.blinkT < -0.15) this.blinkT = 2 + Math.random() * 3;
    if (this.busy || this.dialog.active) return;
    const nav = input.nav(); if (nav === 'left' || nav === 'right') { if (this.nav.handle(nav)) this.renderItems(); }
    if (this.kind === 'plays' && (input.pressed('l1') || input.pressed('r1') || nav === 'up' || nav === 'down')) this.setTab(1 - this.tab);
    if (input.pressed('cross')) this.buy();
    if (input.pressed('circle')) this.leave();
    if (input.mouse.wheel) { if (this.nav.handle(input.mouse.wheel > 0 ? 'right' : 'left')) this.renderItems(); }
  }
  async leave() { if (this.leaving) return; this.leaving = true; audio.sfx('back'); this.dialog.set({ who: this.shop.keeper, text: BYE_LINES[Math.floor(Math.random() * BYE_LINES.length)] }); await this.app.fadeOut(400); this.app.go('district', { planet: this.planet.id, focus: this.kind }); }
  render() {
    const ctx = this.ctx, w = this.app.vw, h = this.app.vh; ctx.clearRect(0, 0, w, h); ctx.drawImage(this.bg, 0, 0, w, h);
    const talk = this.dialog.isTyping ? 0.5 + 0.5 * Math.sin(this.t * 22) : 0; const bob = Math.sin(this.t * 2) * 5;
    const acc = this.kind === 'eat' ? 'apron' : this.kind === 'gear' ? 'gear' : 'coach';
    drawCreature(ctx, this.shop.species, { x: w * 0.66, y: h * 0.72, s: Math.min(w, h * 1.4) / 720, skinIndex: 1, colors: this.planet.team.colors, accessory: acc, talk, blink: this.blinkT < 0, bob, look: { x: -0.4, y: 0.1 }, t: this.t });
  }
  resize() { this.paint(); }
  exit() { this.dialog.hide(); }
}
registerScreen('shop', ShopScreen);
