// Play-call overlay with drawn play art, and the shared drawPlayArt() used by shops and the playbook.
import { el } from '../util.js';
import { input, GLYPH, FACE_ORDER } from '../input.js';
import { audio } from '../audio.js';
import { CATEGORIES, DEF_PLAYS, ZONES, resolvePlay, FORMATIONS } from '../data/plays.js';
import { GridNav } from './menu.js';

export function drawPlayArt(cv, play, opts = {}) {
  const w = cv.width = opts.w || 200, h = cv.height = opts.h || 130; const ctx = cv.getContext('2d');
  ctx.fillStyle = opts.bg || '#1e6b36'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; for (let i = 1; i < 6; i++) { const y = h * 0.72 - i * 17; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const sx = w / 34, sz = 3.4, losY = h * 0.72, cx = w / 2;
  const X = (px) => cx + px * sx, Y = (pz) => losY - pz * sz;
  ctx.strokeStyle = '#7fb3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, losY); ctx.lineTo(w, losY); ctx.stroke();
  if (opts.defense) {
    const dp = play; const f = FORMATIONS.spread;
    for (const role of ['QB', 'C', 'RB', 'X', 'Z']) { const p = f[role]; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 4, 0, 7); ctx.fill(); }
    const spots = { R: [1.6, 1.2], LB: [0, 5], CB1: [-13, 4.5], CB2: [13, 4.5], S: [0, 12] };
    for (const [role, asg] of Object.entries(dp.cover)) {
      const a = asg.split(':'); const s = spots[role]; if (!s) continue;
      if (a[0] === 'zone') { const z = ZONES[a[1]] || ZONES.hook; ctx.fillStyle = 'rgba(255,214,63,0.18)'; ctx.strokeStyle = 'rgba(255,214,63,0.6)'; ctx.beginPath(); ctx.ellipse(X(z[0]), Y(z[1]), 24, 15, 0, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = '#ff6b7a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(s[0]) - 5, Y(s[1]) - 5); ctx.lineTo(X(s[0]) + 5, Y(s[1]) + 5); ctx.moveTo(X(s[0]) + 5, Y(s[1]) - 5); ctx.lineTo(X(s[0]) - 5, Y(s[1]) + 5); ctx.stroke();
      if (a[0] === 'rush') { arrow(ctx, X(s[0]), Y(s[1]) + 6, X(s[0]), Y(-3), '#ff6b7a'); }
      if (a[0] === 'man') { const t = f[a[1]]; if (t) { ctx.setLineDash([3, 3]); arrow(ctx, X(s[0]), Y(s[1]), X(t[0]), Y(t[1]) - 6, '#ffffff'); ctx.setLineDash([]); } }
    }
    return;
  }
  const res = resolvePlay(play); const elig = ['C', 'RB', 'X', 'Z'].filter(r => !res[r].snap).sort((a, b) => res[a].start[0] - res[b].start[0]);
  const colorOf = (role) => { const i = elig.indexOf(role); return i >= 0 ? GLYPH[FACE_ORDER[i]].color : '#ffffff'; };
  for (const role of ['QB', 'C', 'RB', 'X', 'Z']) {
    const r = res[role]; const [px, pz] = r.start; const x = X(px), y = Y(pz); const col = colorOf(role);
    if (r.isCarrier && r.path) { ctx.setLineDash([4, 3]); const pts = [[px, pz], ...r.path]; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(X(a), Math.max(6, Y(b))) : ctx.moveTo(X(a), Y(b))); ctx.stroke(); ctx.setLineDash([]); const l = pts[pts.length - 1], p = pts[pts.length - 2]; arrowHead(ctx, X(p[0]), Math.max(6, Y(p[1])), X(l[0]), Math.max(6, Y(l[1])), '#ffd23f'); }
    if (r.block && !r.snap) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.moveTo(x - 6, y - 12); ctx.lineTo(x + 6, y - 12); ctx.stroke(); }
    if (r.pts.length) { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); for (const [a, b] of r.pts) ctx.lineTo(X(a), Math.max(6, Y(b))); ctx.stroke(); const l = r.pts[r.pts.length - 1], p = r.pts.length > 1 ? r.pts[r.pts.length - 2] : [px, pz]; if (r.settle) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(l[0]), Math.max(6, Y(l[1])), 3.5, 0, 7); ctx.fill(); } else arrowHead(ctx, X(p[0]), Math.max(6, Y(p[1])), X(l[0]), Math.max(6, Y(l[1])), col); }
    // player marker
    ctx.fillStyle = role === 'QB' ? '#ffd23f' : role === 'C' ? '#ffffff' : col; ctx.strokeStyle = '#111122'; ctx.lineWidth = 2;
    if (role === 'C') { ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10); } else { ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fill(); ctx.stroke(); }
    if (r.snap) { ctx.fillStyle = '#111122'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Q', x, y + 3); }
  }
  if (play.trick) { ctx.fillStyle = '#ff9ad5'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('TRICK', w - 6, 12); }
  if (play.type === 'punt' || play.type === 'fg') { ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(play.type === 'punt' ? 'PUNT' : 'FIELD GOAL', w / 2, 22); }
}
function arrow(ctx, x1, y1, x2, y2, col) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); arrowHead(ctx, x1, y1, x2, y2, col); }
function arrowHead(ctx, x1, y1, x2, y2, col) { const a = Math.atan2(y2 - y1, x2 - x1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x2 + Math.cos(a) * 6, y2 + Math.sin(a) * 6); ctx.lineTo(x2 + Math.cos(a + 2.5) * 6, y2 + Math.sin(a + 2.5) * 6); ctx.lineTo(x2 + Math.cos(a - 2.5) * 6, y2 + Math.sin(a - 2.5) * 6); ctx.fill(); }

export class PlayCallUI {
  constructor(app, sim) { this.app = app; this.sim = sim; this.isOpen = false; this.tabIdx = 0; this.cardIdx = 0; this.lastTab = {}; }
  open(kind, plays, onPick, opts = {}) {
    this.kind = kind; this.plays = plays; this.onPick = onPick; this.isOpen = true; this.opts = opts;
    if (kind === 'offense') { const ok = (p) => !opts.filterPlays || opts.filterPlays(p); this.cats = CATEGORIES.filter(c => plays.some(p => p.cat === c.id && ok(p)) && !(opts.filterCats && !opts.filterCats.includes(c.id))); if (!this.cats.length) this.cats = CATEGORIES.filter(c => plays.some(p => p.cat === c.id)); this.tabIdx = Math.min(this.tabIdx, this.cats.length - 1); if (opts.filterPlays) this.tabIdx = Math.max(0, this.cats.findIndex(c => plays.some(p => p.cat === c.id && ok(p)))); }
    else this.cats = [{ id: 'def', name: 'Defense', color: '#ff6b7a' }];
    this.root = el('div', { class: 'playcall' }); this.app.ui.appendChild(this.root);
    this.sit = el('div', { class: 'pc-situation' }); this.app.ui.appendChild(this.sit);
    this.cardIdx = 0; this.render();
  }
  visible() { const s = this.sim; if (this.kind === 'defense') return DEF_PLAYS; const cat = this.cats[this.tabIdx]; let arr = this.plays.filter(p => p.cat === cat.id); if (this.opts.filterPlays) arr = arr.filter(this.opts.filterPlays); return arr; }
  render() {
    const s = this.sim; const cards = this.visible(); this.cardIdx = Math.min(this.cardIdx, Math.max(0, cards.length - 1));
    this.root.innerHTML = '';
    const title = el('div', { class: 'pc-title', text: this.kind === 'offense' ? 'CALL YOUR PLAY' : 'CALL YOUR DEFENSE' }); this.root.appendChild(title);
    if (this.kind === 'offense') {
      const tabs = el('div', { class: 'pc-tabs' });
      this.cats.forEach((c, i) => tabs.appendChild(el('div', { class: 'pc-tab' + (i === this.tabIdx ? ' on' : ''), style: { '--tc': c.color }, text: c.name, onclick: () => { this.tabIdx = i; this.cardIdx = 0; audio.sfx('blip'); this.render(); } })));
      this.root.appendChild(tabs);
    }
    const row = el('div', { class: 'pc-cards' });
    cards.forEach((p, i) => {
      const cv = document.createElement('canvas'); drawPlayArt(cv, p, { defense: this.kind === 'defense' });
      const card = el('div', { class: 'pcard' + (i === this.cardIdx ? ' sel' : ''), onmouseenter: () => { if (this.cardIdx !== i) { this.cardIdx = i; audio.sfx('blip'); this.render(); } }, onclick: () => this.pick(i) }, cv, el('div', { class: 'nm', text: p.name }), el('div', { class: 'ds', text: p.desc || '' }));
      row.appendChild(card);
    });
    this.root.appendChild(row);
    const g = (a, l) => input.glyphHTML(a, l);
    this.root.appendChild(el('div', { class: 'hint', style: { position: 'static', marginTop: '12px' }, html: `${g('left')}${g('right', 'Play')} ${this.kind === 'offense' ? g('l1') + g('r1', 'Category') : ''} ${g('cross', 'Call it')} ${this.kind === 'offense' ? g('square', 'Ask coach') : ''}` }));
    const ytg = s.yardsToGoal(); const tm = s.teamOf(s.possession);
    this.sit.innerHTML = `<b>${s.downText()}</b> · ball on ${s.spotText()}<br>${tm.name} ${s.userOnOffense() ? 'have the ball' : 'on offense'}<br>${s.mode === 'game' ? `${s.quarter === 'OT' ? 'Overtime' : 'Q' + s.quarter} · ${Math.floor(s.clock / 60)}:${String(Math.ceil(s.clock % 60)).padStart(2, '0')} left` : ''}${s.wind && (s.wind.x || s.wind.z) ? '<br>Windy!' : ''}`;
  }
  suggest() {
    const s = this.sim; const cat = s.down === 4 ? (s.yardsToGoal() > 30 ? 'special' : s.toGo > 2 ? 'mid' : 'run') : s.toGo <= 3 ? 'run' : s.toGo > 12 ? 'deep' : s.down === 1 ? 'mid' : 'short';
    const ti = this.cats.findIndex(c => c.id === cat); if (ti >= 0) { this.tabIdx = ti; const cards = this.visible(); this.cardIdx = Math.floor(Math.random() * cards.length); if (cat === 'special' && s.down === 4) { const pi = cards.findIndex(p => p.type === 'punt'); if (pi >= 0) this.cardIdx = pi; } this.render(); }
  }
  update() {
    if (!this.isOpen) return; const nav = input.nav(); const cards = this.visible();
    if (nav === 'left' || nav === 'right') { this.cardIdx = (this.cardIdx + (nav === 'left' ? -1 : 1) + cards.length) % cards.length; audio.sfx('blip'); this.render(); }
    if (this.kind === 'offense' && (input.pressed('l1') || input.pressed('r1') || nav === 'up' || nav === 'down')) { const d = input.pressed('l1') || nav === 'up' ? -1 : 1; this.tabIdx = (this.tabIdx + d + this.cats.length) % this.cats.length; this.cardIdx = 0; audio.sfx('blip'); this.render(); }
    if (this.kind === 'offense' && input.pressed('square')) { audio.sfx('confirm'); this.suggest(); }
    for (let i = 0; i < 5; i++) if (input.keyEdge.has('Digit' + (i + 1)) && cards[i]) { this.pick(i); return; }
    if (input.pressed('cross')) this.pick(this.cardIdx);
  }
  pick(i) { const cards = this.visible(); const p = cards[i]; if (!p) return; audio.sfx('confirm'); this.close(); this.onPick(p); }
  close() { this.isOpen = false; if (this.root) this.root.remove(); if (this.sit) this.sit.remove(); this.root = null; }
}
