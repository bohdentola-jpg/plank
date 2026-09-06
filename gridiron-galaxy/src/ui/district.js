// A planet's main district: painted 2.5D street of shops with hover previews, the stadium, the practice field, and the rocket.
import { registerScreen } from '../main.js';
import { PLANETS, PLANET_BY_ID } from '../data/planets.js';
import { drawSky, drawSkyline, drawGround, drawParticles, drawBuilding, drawCreature, label, rr, drawIcon } from './art2d.js';
import { drawShopInterior } from './shop.js';
import { Dialog } from './dialog.js';
import { Menu } from './menu.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { el, fmtCoins, makeRng, hashStr, shade, mix, rgba, clamp } from '../util.js';

const INK = '#141a2e';
export function drawRocket2D(ctx, x, y, h, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; const w = h * 0.3;
  // fins
  ctx.fillStyle = '#1c2b5a'; ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.05); ctx.lineTo(-w, 0); ctx.lineTo(-w / 2, -h * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w / 2, -h * 0.05); ctx.lineTo(w, 0); ctx.lineTo(w / 2, -h * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
  // body
  ctx.fillStyle = '#f4f4f8'; rr(ctx, -w / 2, -h * 0.85, w, h * 0.8, w * 0.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-w / 2 + 2, -h * 0.5, w - 4, h * 0.08);
  ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.82); ctx.quadraticCurveTo(0, -h * 1.15, w / 2, -h * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke();
  // window
  ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(0, -h * 0.66, w * 0.22, 0, 7); ctx.fill(); ctx.strokeStyle = '#1c2b5a'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  label(ctx, 'GOOBER', 0, -h * 0.32, w * 0.24, '#1c2b5a', 'transparent');
  // nozzle + idle flame flicker
  ctx.fillStyle = '#3a3f5a'; ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.05); ctx.lineTo(w * 0.3, -h * 0.05); ctx.lineTo(w * 0.4, h * 0.03); ctx.lineTo(-w * 0.4, h * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,180,70,0.5)'; ctx.beginPath(); ctx.moveTo(-w * 0.25, h * 0.03); ctx.lineTo(w * 0.25, h * 0.03); ctx.lineTo(0, h * 0.03 + 18 + Math.sin(t * 20) * 6); ctx.fill();
  ctx.restore();
}
function drawStadium2D(ctx, planet, x, y, w, h, o = {}) {
  const P = planet.theme.palette; const team = planet.team; const rnd = makeRng(hashStr(planet.id + 'stad'));
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  const dome = planet.stadium.dome;
  // bowl (back wall)
  ctx.fillStyle = mix(P[3] || '#3a4058', '#6a7098', 0.5); ctx.beginPath(); ctx.ellipse(x, y - h * 0.35, w / 2, h * 0.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // crowd dots
  for (let i = 0; i < 160; i++) { const a = Math.PI + rnd() * Math.PI; const r = 0.55 + rnd() * 0.42; ctx.fillStyle = rnd.pick([team.colors[0], team.colors[1], '#f4f4f8', '#ffd23f']); ctx.beginPath(); ctx.arc(x + Math.cos(a) * w / 2 * r, y - h * 0.35 + Math.sin(a) * h * 0.5 * r, 3, 0, 7); ctx.fill(); }
  // field
  const s = planet.stadium.surface; ctx.fillStyle = s.base; ctx.beginPath(); ctx.moveTo(x - w * 0.34, y - h * 0.32); ctx.lineTo(x + w * 0.34, y - h * 0.32); ctx.lineTo(x + w * 0.44, y); ctx.lineTo(x - w * 0.44, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = s.line; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { const f = i / 6; const yy = y - h * 0.32 * (1 - f); const hw = w * (0.34 + 0.1 * f); ctx.beginPath(); ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw, yy); ctx.stroke(); }
  ctx.fillStyle = team.colors[0]; ctx.beginPath(); ctx.moveTo(x - w * 0.34, y - h * 0.32); ctx.lineTo(x + w * 0.34, y - h * 0.32); ctx.lineTo(x + w * 0.36, y - h * 0.27); ctx.lineTo(x - w * 0.36, y - h * 0.27); ctx.fill();
  // lights / dome
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  if (dome) { ctx.fillStyle = rgba(P[1], 0.28); ctx.beginPath(); ctx.ellipse(x, y - h * 0.35, w / 2 + 10, h * 0.62, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = P[1]; ctx.stroke(); ctx.strokeStyle = INK; }
  else for (const sx of [-1, 1]) for (const k of [0.36, 0.5]) { const lx = x + sx * w * k, ly = y - h * (0.35 + k * 0.6); ctx.fillStyle = '#8a919c'; ctx.fillRect(lx - 3, ly, 6, h * 0.3 + k * 40); ctx.fillStyle = '#fff8d8'; rr(ctx, lx - 16, ly - 12, 32, 14, 4); ctx.fill(); ctx.stroke(); }
  // scoreboard banner
  ctx.fillStyle = '#1a1a24'; rr(ctx, x - w * 0.22, y - h * 0.98, w * 0.44, h * 0.16, 8); ctx.fill(); ctx.stroke(); label(ctx, planet.stadium.name.toUpperCase(), x, y - h * 0.9, Math.min(15, w * 0.045), '#ffd23f', 'transparent');
  if (o.glow) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; ctx.strokeStyle = 'rgba(255,214,63,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y - h * 0.35, w / 2 + 16, h * 0.7, 0, Math.PI, 0); ctx.lineTo(x + w / 2 + 16, y + 8); ctx.lineTo(x - w / 2 - 16, y + 8); ctx.closePath(); ctx.stroke(); }
  ctx.restore();
}
function drawPractice2D(ctx, planet, x, y, w, h, o = {}) {
  const s = planet.stadium.surface; ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.fillStyle = s.base; ctx.beginPath(); ctx.moveTo(x - w * 0.36, y - h); ctx.lineTo(x + w * 0.36, y - h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x - w / 2, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = s.line; ctx.lineWidth = 2; for (let i = 1; i < 5; i++) { const f = i / 5; const yy = y - h * (1 - f); const hw = w * (0.36 + 0.14 * f); ctx.beginPath(); ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw, yy); ctx.stroke(); }
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 14, y - h); ctx.lineTo(x - 14, y - h - 34); ctx.lineTo(x + 14, y - h - 34); ctx.lineTo(x + 14, y - h); ctx.moveTo(x, y - h - 34); ctx.lineTo(x, y - h - 50); ctx.stroke();
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x - w * 0.3 + i * w * 0.2, y - 10); ctx.lineTo(x - w * 0.3 + i * w * 0.2 + 7, y - 10); ctx.lineTo(x - w * 0.3 + i * w * 0.2 + 3.5, y - 26); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.fillStyle = '#ffd23f'; rr(ctx, x - 70, y - h - 90, 140, 32, 8); ctx.fill(); ctx.stroke(); label(ctx, 'PRACTICE FIELD', x, y - h - 74, 14, '#fff', INK);
  if (o.glow) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; ctx.strokeStyle = 'rgba(255,214,63,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - w * 0.4, y - h - 10); ctx.lineTo(x + w * 0.4, y - h - 10); ctx.lineTo(x + w / 2 + 8, y + 8); ctx.lineTo(x - w / 2 - 8, y + 8); ctx.closePath(); ctx.stroke(); }
  ctx.restore();
}

export class DistrictScreen {
  constructor(app, params) { this.app = app; this.P = params || {}; }
  enter() {
    const app = this.app; this.planet = PLANET_BY_ID[this.P.planet] || PLANETS[1]; app.use2D(true); this.ctx = app.ctx2d; this.t = 0;
    this.dialog = new Dialog(app); this.layout(); this.paint();
    this.sel = Math.max(0, this.spots.findIndex(s => s.id === (this.P.focus || 'stadium'))); this.hover = -1; this.menu = null;
    audio.music('district', this.planet.index + 1);
    this.buildDOM();
    if (app.story) app.story.onDistrictEnter(this);
  }
  layout() {
    const w = this.app.vw, h = this.app.vh; this.w = w; this.h = h; const hy = h * 0.58; this.hy = hy;
    const sh = this.planet.shops;
    this.spots = [
      { id: 'eat', x: w * 0.14, y: h * 0.87, w: Math.min(220, w * 0.17), h: h * 0.19, name: sh.eat.name, keeper: sh.eat.keeper, desc: 'Food buffs for your next game. Fuel up before the big one.' },
      { id: 'gear', x: w * 0.36, y: h * 0.9, w: Math.min(230, w * 0.18), h: h * 0.2, name: sh.gear.name, keeper: sh.gear.keeper, desc: 'Permanent gear upgrades for the whole squad.' },
      { id: 'stadium', x: w * 0.5, y: hy - h * 0.02, w: Math.min(480, w * 0.37), h: h * 0.2, name: this.planet.stadium.name, keeper: `${this.planet.team.name}`, desc: `Take on the ${this.planet.team.name}. ${this.planet.stadium.size} stadium, ${this.planet.stadium.surface.type} surface${this.planet.stadium.quirks.length ? ' · ' + this.planet.stadium.quirks.join(', ') : ''}.` },
      { id: 'plays', x: w * 0.64, y: h * 0.9, w: Math.min(230, w * 0.18), h: h * 0.2, name: sh.plays.name, keeper: sh.plays.keeper, desc: 'Five planet-exclusive plays, plus your whole playbook.' },
      { id: 'practice', x: w * 0.85, y: h * 0.82, w: Math.min(260, w * 0.2), h: h * 0.1, name: sh.practice.name, keeper: 'Side quest', desc: `${this.planet.challenge.title}: ${this.planet.challenge.desc} Reward: ${this.planet.challenge.reward} coins. Or just practice here.` },
      { id: 'rocket', x: w * 0.95, y: h * 0.99, w: 90, h: h * 0.3, name: 'The Rocket', keeper: 'GOOBER Mk. I', desc: 'Blast off and fly to another planet.' },
    ];
    for (const s of this.spots) s.rect = { x: s.x - s.w / 2 - 10, y: s.y - s.h - (s.id === 'stadium' ? s.h * 0.9 : 60), w: s.w + 20, h: s.h + (s.id === 'stadium' ? s.h * 0.9 : 60) + 10 };
  }
  paint() {
    const w = this.w, h = this.h, hy = this.hy, th = this.planet.theme; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.bg = document.createElement('canvas'); this.bg.width = w * dpr; this.bg.height = h * dpr; const c = this.bg.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSkyline(c, th.skyline, w, hy + 2, th.palette, this.planet.index);
    drawGround(c, th.groundType, w, hy, h - hy, th.ground, this.planet.index);
    // plaza path
    c.fillStyle = rgba(shade(th.ground, 0.25), 0.7); c.beginPath(); c.moveTo(w * 0.44, hy - h * 0.02); c.lineTo(w * 0.56, hy - h * 0.02); c.lineTo(w * 0.78, h); c.lineTo(w * 0.22, h); c.fill();
    c.strokeStyle = rgba('#ffffff', 0.25); c.lineWidth = 3; c.setLineDash([14, 12]); c.beginPath(); c.moveTo(w * 0.5, hy - h * 0.02); c.lineTo(w * 0.5, h); c.stroke(); c.setLineDash([]);
    const style = th.buildingStyle;
    for (const s of this.spots) {
      if (s.id === 'stadium') drawStadium2D(c, this.planet, s.x, s.y, s.w, s.h);
      else if (s.id === 'practice') drawPractice2D(c, this.planet, s.x, s.y, s.w, s.h);
      else if (s.id === 'rocket') { c.fillStyle = '#8a919c'; c.beginPath(); c.ellipse(s.x, s.y - 6, 70, 18, 0, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); }
      else drawBuilding(c, style, s.x, s.y, s.w, s.h, th.palette, { seed: s.id.length + this.planet.index, sign: s.name, signColor: { eat: '#e63946', gear: '#4a6fd6', plays: '#2a9d8f' }[s.id], t: 0 });
    }
    // shop-type badges on the signs
    for (const s of this.spots) if (['eat', 'gear', 'plays'].includes(s.id)) drawIcon(c, { eat: 'bowl', gear: 'glove', plays: 'play' }[s.id], s.x - s.w * 0.42, s.y - s.h - 29 - (s.id === 'eat' ? 0 : 0), 26, '#ffd23f');
    // lampposts
    for (const lx of [w * 0.27, w * 0.73]) { c.fillStyle = '#5a5f6a'; c.fillRect(lx - 4, hy + 30, 8, h * 0.28); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(lx - 4, hy + 30, 8, h * 0.28); c.fillStyle = th.palette[2]; c.beginPath(); c.arc(lx, hy + 26, 14, 0, 7); c.fill(); c.stroke(); const lg = c.createRadialGradient(lx, hy + 26, 6, lx, hy + 26, 80); lg.addColorStop(0, rgba(th.palette[2], 0.35)); lg.addColorStop(1, rgba(th.palette[2], 0)); c.fillStyle = lg; c.fillRect(lx - 80, hy - 54, 160, 160); }
  }
  buildDOM() {
    const app = this.app; app.ui.innerHTML = ''; const p = this.planet;
    app.ui.appendChild(el('div', { class: 'dist-top' }, el('div', { class: 'panel' }, el('h1', { text: `${p.name} · ${p.district}` }), el('p', { text: p.tagline }))));
    app.ui.appendChild(el('div', { class: 'topright' }, el('span', { class: 'tag', text: p.stadium.quirks.length ? `QUIRKS: ${p.stadium.quirks.join(', ').toUpperCase()}` : `TEAM LVL ${app.save.teamLevel + 1}` }), el('span', { class: 'coins', text: fmtCoins(app.save.coins) })));
    this.preview = el('div', { class: 'preview' }); app.ui.appendChild(this.preview);
    this.objEl = el('div', { class: 'objective' }); app.ui.appendChild(this.objEl); this.refreshObjectives();
    const g = (a, l) => input.glyphHTML(a, l);
    app.ui.appendChild(el('div', { class: 'hint', html: `${g('left')}${g('right', 'Look around')} ${g('cross', 'Enter')} ${g('circle', 'Back to rocket')}` }));
    this.renderPreview();
  }
  refreshObjectives() {
    const app = this.app; const list = app.story ? app.story.objectives(this.planet) : [];
    if (!list.length) { this.objEl.innerHTML = ''; return; }
    this.objEl.innerHTML = ''; this.objEl.appendChild(el('div', { class: 'panel' }, el('h4', { text: 'OBJECTIVES' }), el('ul', {}, ...list.map(o => el('li', { class: o.done ? 'done' : '', text: (o.done ? '✓ ' : '○ ') + o.text })))));
  }
  renderPreview() {
    const s = this.spots[this.sel]; if (!s) return; this.preview.innerHTML = '';
    const cv = document.createElement('canvas'); cv.width = 280; cv.height = 150; const c = cv.getContext('2d');
    if (['eat', 'gear', 'plays'].includes(s.id)) { drawShopInterior(c, 280, 150, s.id, this.planet, 0); drawCreature(c, this.planet.shops[s.id].species, { x: 210, y: 138, s: 0.42, skinIndex: 1, colors: this.planet.team.colors, accessory: { eat: 'apron', gear: 'gear', plays: 'coach' }[s.id] }); }
    else if (s.id === 'stadium') { drawSky(c, this.planet.theme, 280, 150, 0, 0.7); drawStadium2D(c, this.planet, 140, 140, 250, 110); }
    else if (s.id === 'practice') { drawSky(c, this.planet.theme, 280, 150, 0, 0.6); c.fillStyle = this.planet.theme.ground; c.fillRect(0, 90, 280, 60); drawPractice2D(c, this.planet, 140, 140, 220, 60); }
    else { c.fillStyle = '#05060f'; c.fillRect(0, 0, 280, 150); for (let i = 0; i < 60; i++) { c.fillStyle = '#fff'; c.fillRect(Math.random() * 280, Math.random() * 150, 2, 2); } drawRocket2D(c, 140, 150, 130, 0); }
    const panel = el('div', { class: 'panel' }, cv, el('h3', { text: s.name }), el('p', { text: s.desc }), el('div', { class: 'who', text: s.id === 'stadium' ? `Opponent: ${s.keeper} · rating ${this.planet.rating}${this.app.save.story.beaten.includes(this.planet.id) ? ' · DEFEATED' : ''}` : s.id === 'practice' ? (this.app.save.story.challengesDone && this.app.save.story.challengesDone.includes(this.planet.id) ? 'Side quest complete ✓' : 'Side quest available') : `Run by ${s.keeper}` }));
    this.preview.appendChild(panel);
    const px = clamp(s.x, 170, this.w - 170); const py = s.rect.y - 8; const pinned = py < 360 || s.id === 'rocket'; this.preview.classList.toggle('pinned', pinned); this.preview.style.left = `${px}px`; this.preview.style.top = `${py}px`;
  }
  select(i) { if (i === this.sel) return; this.sel = i; audio.sfx('blip'); this.renderPreview(); }
  update(dt) {
    this.t += dt; this.dialog.update(dt);
    if (this.dialog.active) return;
    if (this.menu) { this.menu.update(input); return; }
    const nav = input.nav(); if (nav === 'left') this.select((this.sel + this.spots.length - 1) % this.spots.length); if (nav === 'right') this.select((this.sel + 1) % this.spots.length);
    if (nav === 'up') this.select(this.spots.findIndex(s => s.id === 'stadium')); if (nav === 'down') this.select(this.spots.findIndex(s => s.id === 'rocket'));
    if (input.mouse.moved) { const m = input.mouse; const i = this.spots.findIndex(s => m.x >= s.rect.x && m.x <= s.rect.x + s.rect.w && m.y >= s.rect.y && m.y <= s.rect.y + s.rect.h); if (i >= 0) this.select(i); }
    if (input.mouse.clicked) { const m = input.mouse; const i = this.spots.findIndex(s => m.x >= s.rect.x && m.x <= s.rect.x + s.rect.w && m.y >= s.rect.y && m.y <= s.rect.y + s.rect.h); if (i >= 0) { this.sel = i; this.activate(); } }
    if (input.pressed('cross')) this.activate();
    if (input.pressed('circle')) { this.select(this.spots.findIndex(s => s.id === 'rocket')); this.activate(); }
  }
  activate() {
    const s = this.spots[this.sel]; const app = this.app; const id = this.planet.id; audio.sfx('confirm');
    const back = { onEnd: () => app.go('district', { planet: id, focus: 'stadium' }), onQuit: () => app.go('district', { planet: id }), quitLabel: `Back to ${this.planet.district}` };
    if (app.story && app.story.intercept(this, s.id)) return;
    if (['eat', 'gear', 'plays'].includes(s.id)) { app.fadeOut(350).then(() => app.go('shop', { planet: id, kind: s.id })); return; }
    if (s.id === 'stadium') { app.fadeOut(500).then(() => app.go('game', { planet: id, mode: 'exhibition', ...back })); return; }
    if (s.id === 'practice') { this.practiceMenu(); return; }
    if (s.id === 'rocket') { this.leave(); }
  }
  practiceMenu() {
    const app = this.app, id = this.planet.id; const done = (app.save.story.challengesDone || []).includes(id); const ch = this.planet.challenge;
    const wrap = el('div', { class: 'overlay' }); const panel = el('div', { class: 'panel' }, el('h2', { text: this.planet.shops.practice.name })); wrap.appendChild(panel); app.ui.appendChild(wrap);
    const items = [
      { label: `Side Quest: ${ch.title}`, hint: `${ch.desc} · ${done ? 'Completed ✓ (replay for half reward)' : `Reward: ${ch.reward} coins`}`, action: () => { wrap.remove(); this.menu = null; app.fadeOut(400).then(() => app.go('challenge', { planet: id })); } },
      { label: 'Free Practice', hint: 'Run any play, no clock, toggle the defense', action: () => { wrap.remove(); this.menu = null; app.fadeOut(400).then(() => app.go('game', { planet: id, mode: 'practice', onEnd: () => app.go('district', { planet: id, focus: 'practice' }), onQuit: () => app.go('district', { planet: id, focus: 'practice' }), quitLabel: 'Back to town' })); } },
      { label: 'Back', action: () => { wrap.remove(); this.menu = null; } },
    ];
    this.menu = new Menu(app, items, { parent: panel, onBack: () => { wrap.remove(); this.menu = null; } });
  }
  async leave() { if (this.leaving) return; this.leaving = true; audio.sfx('rocket'); await this.app.fadeOut(600); if (this.app.story && this.app.story.leave(this.planet)) return; this.app.go('hub', { mode: 'roam', fromPlanet: this.planet.id }); }
  render() {
    const ctx = this.ctx, w = this.w, h = this.h, th = this.planet.theme; ctx.clearRect(0, 0, w, h);
    drawSky(ctx, th, w, h, this.t, this.hy / h);
    ctx.drawImage(this.bg, 0, 0, w, h);
    // keepers at their doors, rocket, markers, highlight
    for (const s of this.spots) {
      const selected = this.spots[this.sel] === s;
      if (['eat', 'gear', 'plays'].includes(s.id)) { const sh = this.planet.shops[s.id]; drawCreature(ctx, sh.species, { x: s.x + s.w * 0.36, y: s.y + 4, s: 0.36, skinIndex: 1, colors: this.planet.team.colors, accessory: { eat: 'apron', gear: 'gear', plays: 'coach' }[s.id], bob: Math.abs(Math.sin(this.t * 3 + s.x)) * 4, wave: selected && Math.sin(this.t * 4) > 0, blink: Math.sin(this.t * 1.7 + s.x) > 0.97, look: { x: 0, y: 0 } }); }
      if (s.id === 'rocket') drawRocket2D(ctx, s.x, s.y - 8, s.h, this.t);
      if (selected) { ctx.save(); ctx.strokeStyle = `rgba(255,214,63,${0.6 + 0.35 * Math.sin(this.t * 5)})`; ctx.lineWidth = 5; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 22; rr(ctx, s.rect.x, s.rect.y, s.rect.w, s.rect.h, 18); ctx.stroke(); ctx.restore(); }
      const marker = this.app.story && this.app.story.marker(this.planet, s.id); if (marker) { const my = s.rect.y - 26 + Math.sin(this.t * 4) * 8; ctx.fillStyle = marker === 'main' ? '#ffd23f' : '#7fe3a6'; ctx.beginPath(); ctx.moveTo(s.x, my + 22); ctx.lineTo(s.x - 16, my); ctx.lineTo(s.x + 16, my); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); label(ctx, '!', s.x, my - 16, 26, marker === 'main' ? '#ffd23f' : '#7fe3a6', INK); }
    }
    drawParticles(ctx, th.particles, w, h, this.t, this.planet.index, th.particles === 'fog' ? 12 : 70);
  }
  resize() { this.layout(); this.paint(); this.renderPreview(); }
  exit() { this.dialog.hide(); if (this.menu) this.menu.destroy(); }
}
registerScreen('district', DistrictScreen);
