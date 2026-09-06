// Playbook browser: your plays, your team's ratings and gear, and the rocket's parts.
import { registerScreen } from '../main.js';
import { PLANETS } from '../data/planets.js';
import { BASE_PLAYS, getPlanetPlays, CATEGORIES } from '../data/plays.js';
import { buildUserTeam, RATING_LABEL, GEAR, overall } from '../data/roster.js';
import { userPlaybook } from '../game/match.js';
import { drawPlayArt } from './playcall.js';
import { GridNav } from './menu.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { el, fmtCoins } from '../util.js';

export class PlaybookScreen {
  constructor(app, params) { this.app = app; this.tab = 0; }
  enter() {
    const app = this.app; app.use2D(false); app.space.mode = 'menu'; this.plays = userPlaybook(app.save); this.nav = new GridNav(this.plays.length, 5); this.team = buildUserTeam(app.save);
    this.wrap = el('div', { class: 'overlay' }); app.ui.appendChild(this.wrap); this.refresh();
    app.ui.appendChild(el('div', { class: 'hint', html: `${input.glyphHTML('l1')}${input.glyphHTML('r1', 'Tab')} ${input.glyphHTML('left')}${input.glyphHTML('right', 'Browse')} ${input.glyphHTML('circle', 'Back')}` }));
  }
  refresh() {
    this.wrap.innerHTML = ''; const app = this.app; const panel = el('div', { class: 'panel', style: { width: 'min(1100px, 94vw)' } });
    panel.appendChild(el('div', { class: 'pc-tabs' }, ...['PLAYBOOK', 'THE COMETS', 'THE ROCKET'].map((t, i) => el('div', { class: 'pc-tab' + (i === this.tab ? ' on' : ''), style: { '--tc': ['#7fb3ff', '#ff7a1a', '#7fe3a6'][i] }, text: t, onclick: () => { this.tab = i; this.refresh(); } }))));
    if (this.tab === 0) {
      const cat = (c) => CATEGORIES.find(x => x.id === c); const p = this.plays[this.nav.index];
      const row = el('div', { class: 'pc-cards', style: { flexWrap: 'wrap', gap: '10px', maxHeight: '48vh', overflow: 'hidden', justifyContent: 'center', paddingTop: '18px' } });
      const start = Math.max(0, Math.min(Math.floor(this.nav.index / 5) * 5 - 5, this.plays.length - 15)); const base = Math.max(0, start);
      this.plays.slice(base, base + 15).forEach((pl, k) => { const i = base + k; const cv = document.createElement('canvas'); drawPlayArt(cv, pl, { w: 160, h: 100 }); row.appendChild(el('div', { class: 'pcard' + (i === this.nav.index ? ' sel' : ''), style: { width: '170px', padding: '6px' }, onmouseenter: () => { if (this.nav.index !== i) { this.nav.index = i; this.refresh(); } } }, cv, el('div', { class: 'nm', text: pl.name, style: { fontSize: '13px' } }), el('div', { class: 'ds', text: `${cat(pl.cat) ? cat(pl.cat).name : pl.cat}${pl.planet ? ' · ' + pl.planet : ''}`, style: { minHeight: '14px' } }))); });
      panel.appendChild(row);
      if (p) panel.appendChild(el('p', { style: { marginTop: '10px', textAlign: 'center' }, html: `<b style="color:#ffd23f">${p.name}</b> · ${p.formation} · ${p.desc || ''}` }));
      panel.appendChild(el('p', { style: { textAlign: 'center', fontSize: '13px', color: '#7fb3ff' }, text: `${this.plays.length} plays (${BASE_PLAYS.length} base + ${app.save.playsOwned.length} planet specials). Buy more at each planet's playbook shop.` }));
    } else if (this.tab === 1) {
      const grid = el('div', { class: 'roster', style: { gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 26px' } });
      for (const pl of this.team.players) { const top = Object.entries(pl.r).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${RATING_LABEL[k]} ${v}`).join(' · '); grid.appendChild(el('div', { class: 'p', style: { flexDirection: 'column', alignItems: 'flex-start' } }, el('div', { html: `<b>#${pl.num} ${pl.name}</b> <span class="tag">${pl.role}</span> <span style="color:#7fe3a6">OVR ${overall(pl)}</span>` }), el('div', { style: { fontSize: '12px', color: '#7fb3ff' }, text: top }), el('div', { style: { fontSize: '12px', opacity: .8 }, text: pl.bio }))); }
      panel.appendChild(grid);
      const gear = Object.entries(app.save.gear || {}).map(([id, t]) => `${GEAR[id].name} ${['', 'I', 'II', 'III'][t]}`).join(', ') || 'none yet';
      panel.appendChild(el('p', { style: { marginTop: '12px', fontSize: '14px' }, html: `Team level <b style="color:#ffd23f">${app.save.teamLevel + 1}</b> · Gear: ${gear} · Pantry: ${(app.save.pantry || []).length} items · Record ${app.save.stats.wins}-${app.save.stats.losses}` }));
    } else {
      const parts = app.save.story.rocketParts || []; const list = el('ul', { style: { columns: 2, fontSize: '14px', paddingLeft: '18px' } });
      PLANETS.filter(p => p.part).forEach(p => list.appendChild(el('li', { style: { opacity: parts.includes(p.part.name) ? 1 : .4 }, text: `${parts.includes(p.part.name) ? '✓' : '○'} ${p.part.name} (${p.name})` })));
      panel.appendChild(el('p', { html: `<b style="color:#ffd23f">${parts.length}</b> of ${PLANETS.filter(p => p.part).length} parts installed · rocket range ${Math.round(app.space.range)} · ${app.save.story.beaten.length} teams beaten` })); panel.appendChild(list);
    }
    this.wrap.appendChild(panel);
  }
  update(dt) {
    this.app.space.update(dt, null, { labels: false }); const nav = input.nav();
    if (input.pressed('l1') || input.pressed('r1')) { this.tab = (this.tab + (input.pressed('l1') ? 2 : 1)) % 3; audio.sfx('blip'); this.refresh(); }
    if (this.tab === 0 && this.nav.handle(nav)) this.refresh();
    if (input.pressed('circle')) { audio.sfx('back'); this.app.go('hub'); }
  }
  render() { this.app.space.render(this.app.renderer); }
  exit() { }
}
registerScreen('playbook', PlaybookScreen);
