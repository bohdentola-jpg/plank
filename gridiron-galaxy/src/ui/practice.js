// Practice mode: pick any unlocked stadium and run plays with no clock.
import { registerScreen } from '../main.js';
import { PLANETS } from '../data/planets.js';
import { GridNav } from './menu.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { el } from '../util.js';

export class PracticeScreen {
  constructor(app, params) { this.app = app; this.P = params || {}; }
  enter() {
    const app = this.app; app.use2D(false); app.space.mode = 'menu';
    this.list = PLANETS.map(p => ({ p, unlocked: app.save.unlockedStadiums.includes(p.id) || app.save.story.beaten.includes(p.id) || p.isHome || (app.save.story.introDone && app.save.story.planet === p.index) }));
    this.nav = new GridNav(this.list.length, 4); this.wrap = el('div', { class: 'overlay' }); app.ui.appendChild(this.wrap); this.refresh();
    app.ui.appendChild(el('div', { class: 'hint', html: `${input.glyphHTML('left')}${input.glyphHTML('right')}${input.glyphHTML('up')}${input.glyphHTML('down', 'Choose')} ${input.glyphHTML('cross', 'Practice here')} ${input.glyphHTML('circle', 'Back')}` }));
  }
  refresh() {
    this.wrap.innerHTML = ''; const panel = el('div', { class: 'panel' }, el('h2', { text: 'PRACTICE · PICK A STADIUM' }));
    const grid = el('div', { class: 'grid-pick' }); const start = Math.floor(this.nav.index / 4) * 4; const rows = 2;
    const visible = this.list.slice(Math.max(0, Math.min(start - 4, this.list.length - 8)), Math.max(0, Math.min(start - 4, this.list.length - 8)) + 8); const base = Math.max(0, Math.min(start - 4, this.list.length - 8));
    visible.forEach((it, k) => { const i = base + k; const p = it.p; const sw = el('div', { class: 'sw', style: { background: `linear-gradient(135deg, ${p.stadium.surface.base}, ${p.theme.palette[1]})` } }); grid.appendChild(el('div', { class: 'gcard' + (i === this.nav.index ? ' sel' : '') + (it.unlocked ? '' : ' locked'), onmouseenter: () => { if (this.nav.index !== i) { this.nav.index = i; this.refresh(); } }, onclick: () => this.pick() }, sw, el('b', { text: p.stadium.name }), el('small', { text: `${p.name} · ${p.stadium.size} · ${p.stadium.surface.type}${it.unlocked ? '' : ' · LOCKED'}` }))); });
    panel.appendChild(grid); panel.appendChild(el('p', { style: { marginTop: '10px', fontSize: '14px', color: '#7fb3ff' }, text: `${this.list.filter(l => l.unlocked).length}/${this.list.length} stadiums unlocked. Beat a planet's team in Story to unlock its stadium.` }));
    this.wrap.appendChild(panel);
  }
  pick() { const it = this.list[this.nav.index]; if (!it.unlocked) { audio.sfx('error'); this.app.toast('Locked. Beat this planet in Story mode first.'); return; } audio.sfx('confirm'); const id = it.p.id; this.app.fadeOut(400).then(() => this.app.go('game', { planet: id, mode: 'practice', onEnd: () => this.app.go('practice'), onQuit: () => this.app.go('practice'), quitLabel: 'Back to stadium list' })); }
  update(dt) { this.app.space.update(dt, null, { labels: false }); if (this.nav.handle(input.nav())) this.refresh(); if (input.pressed('cross')) this.pick(); if (input.pressed('circle')) { audio.sfx('back'); this.app.go('hub'); } }
  render() { this.app.space.render(this.app.renderer); }
  exit() { }
}
registerScreen('practice', PracticeScreen);
