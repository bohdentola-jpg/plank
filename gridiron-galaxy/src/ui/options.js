import { el } from '../util.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { clearSave, defaultSave } from '../save.js';

const QL = [1, 2, 3, 5]; const DIFF = ['rookie', 'normal', 'allstar']; const DIFF_LABEL = { rookie: 'Rookie', normal: 'Normal', allstar: 'All-Star' };

export class OptionsScreen {
  constructor(app, params) { this.app = app; this.params = params || {}; this.index = 0; this.confirmReset = false; }
  rows() {
    const s = this.app.save.settings;
    return [
      { label: 'Quarter Length', val: `${s.quarterLen} min`, adj: (d) => { s.quarterLen = QL[(QL.indexOf(s.quarterLen) + d + QL.length) % QL.length]; } },
      { label: 'Difficulty', val: DIFF_LABEL[s.difficulty], adj: (d) => { s.difficulty = DIFF[(DIFF.indexOf(s.difficulty) + d + 3) % 3]; } },
      { label: 'Music Volume', val: `${Math.round(s.music * 100)}%`, adj: (d) => { s.music = Math.max(0, Math.min(1, +(s.music + d * 0.1).toFixed(1))); audio.applySettings(s); } },
      { label: 'Sound Effects', val: `${Math.round(s.sfx * 100)}%`, adj: (d) => { s.sfx = Math.max(0, Math.min(1, +(s.sfx + d * 0.1).toFixed(1))); audio.applySettings(s); } },
      { label: 'Cartoon Outlines', val: s.outlines ? 'On' : 'Off', adj: () => { s.outlines = !s.outlines; } },
      { label: 'Shadows', val: s.shadows ? 'On' : 'Off', adj: () => { s.shadows = !s.shadows; this.app.applyQuality(); } },
      { label: 'Render Quality', val: s.quality === 'high' ? 'High' : 'Performance', adj: () => { s.quality = s.quality === 'high' ? 'low' : 'high'; this.app.applyQuality(); } },
      { label: 'Invert Look (Y)', val: s.invertY ? 'On' : 'Off', adj: () => { s.invertY = !s.invertY; } },
      { label: this.confirmReset ? 'Really erase everything?' : 'Erase Save Data', val: this.confirmReset ? 'YES, ERASE' : '…', action: true, act: () => { if (!this.confirmReset) { this.confirmReset = true; } else { clearSave(); Object.assign(this.app.save, defaultSave()); this.app.persist(); this.confirmReset = false; this.app.toast('Save data erased. Fresh start!'); } } },
      { label: 'Back', val: '', action: true, act: () => this.back() },
    ];
  }
  enter() {
    this.app.use2D(false); this.app.space.mode = 'menu';
    this.wrap = el('div', { class: 'overlay' }); this.app.ui.appendChild(this.wrap); this.refresh();
    this.app.ui.appendChild(el('div', { class: 'hint', html: `${input.glyphHTML('up')}${input.glyphHTML('down', 'Select')} ${input.glyphHTML('left')}${input.glyphHTML('right', 'Adjust')} ${input.glyphHTML('circle', 'Back')}` }));
  }
  refresh() {
    const rows = this.rows();
    this.wrap.innerHTML = '';
    const panel = el('div', { class: 'panel' }, el('h2', { text: 'OPTIONS' }));
    rows.forEach((r, i) => {
      const d = el('div', { class: 'opt-row' + (i === this.index ? ' sel' : '') + (r.action ? ' action' : ''), onmouseenter: () => { if (this.index !== i) { this.index = i; this.refresh(); } }, onclick: () => { if (r.action) r.act(); else r.adj(1); this.app.persist(); this.refresh(); } }, el('span', { text: r.label }), el('span', { class: 'val', text: r.val }));
      panel.appendChild(d);
    });
    this.wrap.appendChild(panel);
  }
  update(dt) {
    this.app.space.update(dt, null, { labels: false });
    const rows = this.rows(); const nav = input.nav();
    if (nav === 'up') { this.index = (this.index + rows.length - 1) % rows.length; audio.sfx('blip'); this.confirmReset = false; this.refresh(); }
    if (nav === 'down') { this.index = (this.index + 1) % rows.length; audio.sfx('blip'); this.confirmReset = false; this.refresh(); }
    const r = rows[this.index];
    if ((nav === 'left' || nav === 'right') && !r.action) { r.adj(nav === 'left' ? -1 : 1); audio.sfx('blip'); this.app.persist(); this.refresh(); }
    if (input.pressed('cross')) { audio.sfx('confirm'); if (r.action) r.act(); else r.adj(1); this.app.persist(); this.refresh(); }
    if (input.pressed('circle')) { audio.sfx('back'); this.back(); }
  }
  back() { this.app.persist(); this.app.go(this.params.back || 'hub'); }
  render() { this.app.space.render(this.app.renderer); }
  exit() { }
}
