// Splatoon-style dialog box: name tag, typewriter text, portrait, optional choices. Blocking (say) or ambient (set).
import { el } from '../util.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { drawCreature } from './art2d.js';
import { KIDS } from '../data/roster.js';

export function portraitCanvas(spec, size = 160) {
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size; const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = spec.bg || 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 6, 0, 7); ctx.clip();
  drawCreature(ctx, spec.species || 'kid', { x: size / 2, y: size * 0.62, s: size / 190, headOnly: true, skin: spec.skin, skinIndex: spec.skinIndex || 0, hair: spec.hair, hairColor: spec.hairColor, colors: spec.colors, accessory: spec.accessory, talk: spec.talk || 0, look: spec.look });
  ctx.restore();
  return cv;
}
export function kidSpec(id) { const k = KIDS.find(x => x.id === id) || KIDS[0]; const { SPECIES } = { SPECIES: null }; return { species: 'kid', skinIndex: k.skin, hair: k.hair, hairColor: k.hairColor, colors: ['#ff7a1a', '#1c2b5a'], name: k.nick }; }

export class Dialog {
  constructor(app, variant = '', selfDriven = false) {
    this.app = app; this.root = app.dialogEl;
    if (selfDriven) { app.dialogs.add(this); } this.active = false; this.typing = false; this.text = ''; this.shown = 0; this.speed = 48; this.resolve = null; this.choiceIdx = 0;
    this.box = el('div', { class: 'dlg ' + variant }, el('div', { class: 'box' }, el('div', { class: 'name' }), el('div', { class: 'txt' }), el('div', { class: 'more', html: '▼' }), el('div', { class: 'choices' })));
    this.box.style.display = 'none'; this.root.appendChild(this.box);
    this.nameEl = this.box.querySelector('.name'); this.txtEl = this.box.querySelector('.txt'); this.moreEl = this.box.querySelector('.more'); this.choicesEl = this.box.querySelector('.choices'); this.portraitEl = null;
    this.box.addEventListener('click', () => this._advance());
  }
  // line: { who, text, portrait: spec | null, alt: bool, choices: [str] }
  say(line) {
    return new Promise((resolve) => { this.resolve = resolve; this._show(line, true); });
  }
  async sequence(lines) { const out = []; for (const l of lines) out.push(await this.say(l)); return out; }
  set(line) { this._show(line, false); }
  _show(line, blocking) {
    this.line = line; this.active = blocking; this.blocking = blocking; this.box.style.display = 'block'; this.text = line.text || ''; this.shown = 0; this.typing = true; this.choiceIdx = 0; this.done = false;
    this.nameEl.textContent = line.who || ''; this.nameEl.style.display = line.who ? 'block' : 'none'; this.nameEl.className = 'name' + (line.alt ? ' alt' : '');
    this.txtEl.textContent = ''; this.moreEl.style.display = 'none'; this.choicesEl.innerHTML = '';
    if (this.portraitEl) { this.portraitEl.remove(); this.portraitEl = null; }
    if (line.portrait) { const cv = portraitCanvas(line.portrait); cv.className = 'portrait'; this.box.querySelector('.box').appendChild(cv); this.portraitEl = cv; }
    this.tick = 0; input.block(120);
  }
  hide() { this.box.style.display = 'none'; this.active = false; this.typing = false; if (this.portraitEl) { this.portraitEl.remove(); this.portraitEl = null; } }
  destroy() { this.hide(); this.dead = true; this.app.dialogs.delete(this); this.box.remove(); }
  get isTyping() { return this.typing && this.box.style.display !== 'none'; }
  update(dt) {
    if (this.box.style.display === 'none') return;
    if (this.typing) {
      this.shown = Math.min(this.text.length, this.shown + dt * this.speed); const n = Math.floor(this.shown);
      const cur = this.txtEl.textContent.length; if (n !== cur) { this.txtEl.textContent = this.text.slice(0, n); this.tick += n - cur; if (this.tick >= 3) { this.tick = 0; audio.sfx('type'); } }
      if (this.shown >= this.text.length) { this.typing = false; this._finishLine(); }
    }
    if (!this.blocking) return;
    if (this.line.choices && !this.typing) {
      const nav = input.nav(); const n = this.line.choices.length;
      if (nav === 'left' || nav === 'up') { this.choiceIdx = (this.choiceIdx + n - 1) % n; audio.sfx('blip'); this._renderChoices(); }
      if (nav === 'right' || nav === 'down') { this.choiceIdx = (this.choiceIdx + 1) % n; audio.sfx('blip'); this._renderChoices(); }
    }
    if (input.pressed('cross') || input.mouse.clicked) this._advance();
  }
  _finishLine() { if (this.line.choices) this._renderChoices(); else if (this.blocking) this.moreEl.style.display = 'block'; }
  _renderChoices() {
    this.choicesEl.innerHTML = '';
    this.line.choices.forEach((c, i) => this.choicesEl.appendChild(el('div', { class: 'choice' + (i === this.choiceIdx ? ' sel' : ''), text: c, onclick: (e) => { e.stopPropagation(); this.choiceIdx = i; this._advance(); } })));
  }
  _advance() {
    if (!this.blocking || this.box.style.display === 'none') return;
    if (this.typing) { this.shown = this.text.length; this.txtEl.textContent = this.text; this.typing = false; this._finishLine(); input.block(120); input.mouse.clicked = false; return; }
    if (!this.resolve) return; // nothing left to dismiss: let the screen underneath handle the press
    audio.sfx('confirm'); const r = this.resolve; this.resolve = null; this.active = false; this.blocking = false;
    input.block(160); input.mouse.clicked = false;
    const choice = this.line.choices ? this.choiceIdx : true;
    if (!this.line.keep) this.hide();
    r(choice);
  }
}
