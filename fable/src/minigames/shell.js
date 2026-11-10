// Shared frame for every minigame: intro card → 3-2-1-GO → play → results
// (medal, best score, rewards) → retry or leave. A minigame only implements
// the game itself.
//
//   export default class MyGame extends Minigame {
//     static meta = {
//       id: 'mygame', title: 'My Game', icon: '🏈',
//       blurb: 'One or two sentences on what you do.',
//       controls: [['move', 'run around'], ['a', 'jump']],   // [action, what it does]
//       scoreLabel: 'Points',          // shown next to the score
//       goals: [100, 250, 400],        // bronze / silver / gold thresholds
//       lower: false,                  // true when a LOWER score is better (strokes, seconds)
//       hasHard: true,                 // offer an optional harder version
//       music: 'minigame',
//     };
//     setup(opts)   { /* build this.scene + this.camera. this.hard is set. Use this.fx for particles. */ }
//     begin()       { /* GO! — start clocks */ }
//     tick(dt)      { /* gameplay; only runs while playing. Call this.finish({ score, won }) to end. */ }
//     ambient(dt)   { /* optional: runs every frame (intro, play, results) for idle animation */ }
//     cleanup()     { /* optional: dispose */ }
//   }
//
// Helpers available on `this`: hudScore(text), hudTime(seconds), hudInfo(html),
// hudHint(html), fx (particles/shake), wait(t), tween(dur, fn), playing (bool),
// hard (bool), opts (whatever the caller passed), elapsed (seconds since GO).
import { G, Mode } from '../core/game.js';
import { Fx } from '../core/fx.js';
import { el, fmtTime } from '../core/util.js';

const MEDALS = ['', '🥉 Bronze', '🥈 Silver', '🥇 Gold'];

export class Minigame extends Mode {
  constructor() {
    super();
    this.name = 'minigame';
    this.state = 'intro';
    this.score = 0;
    this.elapsed = 0;
  }
  get meta() { return this.constructor.meta; }
  get playing() { return this.state === 'play'; }

  enter(params) {
    this.opts = params || {};
    this.hard = !!this.opts.hard;
    this.fx = new Fx(this.scene);
    this._hud();
    this.setup(this.opts);
    G.audio.music(this.meta.music || 'minigame');
    this._intro();
  }
  exit() {
    if (this.cleanup) this.cleanup();
    this.fx.dispose();
    G.ui.clearBanner();
  }

  // ---- hud
  _hud() {
    this.hScore = el('div.chip.mg-score');
    this.hTime = el('div.chip.mg-time');
    this.hInfo = el('div.mg-info');
    this.hHint = el('div.mg-hint');
    this.hud.append(el('div.mg-top', this.hScore, this.hTime), this.hInfo, this.hHint);
    this.hScore.style.display = 'none'; this.hTime.style.display = 'none';
  }
  hudScore(text) { this.hScore.style.display = ''; const s = String(text); if (this.hScore.textContent !== s) this.hScore.textContent = s; }
  hudTime(sec) { this.hTime.style.display = ''; const s = `⏱ ${fmtTime(sec)}`; if (this.hTime.textContent !== s) { this.hTime.textContent = s; this.hTime.classList.toggle('low', sec <= 10); } }
  hudInfo(html) { if (this._info !== html) { this._info = html; this.hInfo.innerHTML = html || ''; } }
  hudHint(html) { if (this._hint !== html) { this._hint = html; this.hHint.innerHTML = html || ''; } }
  controlsHint() { return (this.meta.controls || []).map(([a, t]) => `${G.ui.key(a)} ${t}`).join(' · '); }

  // ---- flow
  async _intro() {
    const m = this.meta;
    const best = (G.S.best[m.id] || {})[this.hard ? 'hard' : 'normal'];
    this.state = 'intro';
    if (G.debug.fastDialog || this.opts.skipIntro) { this._countdown(); return; }
    const pick = await G.ui.panel({
      title: `${m.icon || ''} ${m.title}${this.hard ? ' — HARD' : ''}`, closable: false, cls: 'mg-card',
      build: (body, api) => {
        body.append(
          el('p.mg-blurb', { html: m.blurb }),
          el('div.mg-controls', (m.controls || []).map(([a, t]) => el('div', { html: `${G.ui.key(a)} ${t}` }))),
          m.goals ? el('div.mg-goals', { html: `🥉 ${m.goals[0]} · 🥈 ${m.goals[1]} · 🥇 ${m.goals[2]} ${m.scoreLabel || ''}${m.lower ? ' (lower is better)' : ''}${best !== undefined ? ` — your best: <b>${best}</b>` : ''}` }) : null,
          el('div.row.center', { style: { marginTop: '0.9em' } },
            el('button.btn.focusable.first', { text: 'Play!', onclick: () => api.close('play') }),
            this.opts.noLeave ? null : el('button.btn.alt.focusable', { text: 'Not now', onclick: () => api.close('leave') })));
      },
    });
    if (pick === 'leave') { this.state = 'over'; G.leave({ quit: true, won: false, score: 0, medal: 0 }); return; }
    this._countdown();
  }

  async _countdown() {
    this.state = 'count';
    this.hudHint(this.controlsHint());
    if (!G.debug.fast) {
      for (const n of ['3', '2', '1']) { G.audio.sfx('tick'); await G.ui.banner(n, '', { dur: 0.55, cls: 'small' }); }
      G.audio.sfx('whistle');
      G.ui.banner('GO!', '', { dur: 0.6 });
    }
    this.state = 'play';
    this.elapsed = 0;
    if (this.begin) this.begin();
  }

  /** End the game. result: { score, won?, detail? } */
  async finish(result = {}) {
    if (this.state !== 'play') return;
    this.state = 'over';
    const m = this.meta;
    const score = result.score ?? this.score;
    let medal = 0;
    if (m.goals) for (let i = 0; i < 3; i++) if (m.lower ? score <= m.goals[i] : score >= m.goals[i]) medal = i + 1;
    if (result.fail) medal = 0;
    const won = result.won ?? medal > 0;
    const key = this.hard ? 'hard' : 'normal';
    const rec = G.S.best[m.id] || (G.S.best[m.id] = {});
    const prev = rec[key];
    const isBest = !result.fail && (prev === undefined || (m.lower ? score < prev : score > prev));
    if (isBest) rec[key] = score;
    rec.medal = Math.max(rec.medal || 0, this.hard ? medal + 3 : medal);
    G.audio.sfx(won ? 'win' : 'lose');
    const out = { score, medal, won, hard: this.hard, detail: result.detail, id: m.id, extra: result.extra };
    G.debug.lastResult = out;
    const rewards = G.hooks.minigameRewards ? G.hooks.minigameRewards(out) : [];
    if (G.debug.fastDialog) { G.leave(out); return; }
    await this.wait(0.7);
    const pick = await G.ui.panel({
      title: result.title || (won ? 'Nice!' : 'Time!'), closable: false, cls: 'mg-card',
      build: (body, api) => {
        body.append(
          el('div.mg-result', el('div.big', String(score)), el('div', m.scoreLabel || 'points')),
          m.goals || result.fail ? el('div.mg-medal', medal ? MEDALS[medal] : (result.fail ? (result.failText || 'No medal this time') : 'No medal this time')) : null,
          isBest && prev !== undefined ? el('div.tag', 'NEW BEST') : null,
          result.detail ? el('p.muted', { html: result.detail }) : null,
          rewards.length ? el('div.mg-rewards', rewards.map((r) => el('div.toastlike', { html: r }))) : null,
          el('div.row.center', { style: { marginTop: '0.9em' } },
            el('button.btn.focusable.first', { text: 'Done', onclick: () => api.close('done') }),
            this.opts.noRetry ? null : el('button.btn.alt.focusable', { text: 'Play again', onclick: () => api.close('again') })));
      },
    });
    if (pick === 'again') { out.again = true; }
    G.leave(out);
  }

  update(dt) {
    if (this.state === 'play') { this.elapsed += dt; this.tick(dt); }
    if (this.ambient) this.ambient(dt);
    this.fx.update(dt, this.camera);
  }
  setup() {}
  tick() {}
}
