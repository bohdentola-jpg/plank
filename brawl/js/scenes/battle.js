// The fight itself, plus the pause menu.

import { W, H } from '../core/config.js';
import { HumanCtl, NullCtl } from '../core/input.js';
import { Match } from '../game/match.js';
import { drawMatch } from '../game/draw.js';
import { CPU } from '../game/ai.js';
import { fighterById } from '../fighters/index.js';
import { stageById } from '../stages/index.js';
import { OUT, txt, panel, button } from '../core/gfx.js';

export class BattleScene {
  // cfg: { stage, rules, players:[{fighter, costume, type:'human'|'cpu', device, level}], skipIntro, seed, onDone }
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg;
    const inp = app.input;
    const players = cfg.players.map((p, i) => {
      const dev = inp.devices.find((d) => d.id === p.device) || inp.kbA;
      return {
        def: fighterById(p.fighter), costume: p.costume || 0, cpuLevel: p.type === 'cpu' ? p.level || 5 : 0,
        ctl: p.type === 'human' ? new HumanCtl(dev) : p.type === 'none' ? new NullCtl() : new CPU(p.level || 5),
        tag: p.type === 'human' ? 'P' + (i + 1) : 'CPU',
      };
    });
    this.humans = cfg.players.filter((p) => p.type === 'human').map((p) => inp.devices.find((d) => d.id === p.device) || inp.kbA);
    this.m = new Match({
      stageDef: stageById(cfg.stage), players, rules: cfg.rules, audio: app.audio,
      shakeScale: app.settings.shake ? 1 : 0, skipIntro: cfg.skipIntro, seed: cfg.seed,
    });
    this.m.fx.quality = app.settings.quality === 0 ? 0 : 1;
    this.paused = false; this.sel = 0; this.debug = false; this.pauseBy = null;
    this.dbg = cfg.debug || {};
    if (this.dbg.pct) for (const f of this.m.fighters) f.pct = this.dbg.pct;
    this.opts = ['RESUME', 'RESTART', 'QUIT TO MENU'];
  }
  enter() { this.app.audio.playMusic(this.m.stage.def.music || 'lab'); }

  update() {
    const app = this.app, inp = app.input, m = this.m;
    if (inp.rawPressed.includes('F2')) this.debug = !this.debug;
    let startBy = null;
    for (const d of inp.devices) if (d.connected && d.snap.p.start) startBy = d;
    if (inp.escPressed || inp.rawPressed.includes('KeyP')) startBy = startBy || inp.kbA;

    if (this.paused) {
      const mn = inp.menu();
      if (mn.up) { this.sel = (this.sel + this.opts.length - 1) % this.opts.length; app.audio.sfx('ui_move'); }
      if (mn.down) { this.sel = (this.sel + 1) % this.opts.length; app.audio.sfx('ui_move'); }
      if (startBy || mn.back) { this.paused = false; app.audio.sfx('ui_back'); return; }
      if (mn.ok) {
        app.audio.sfx('ui_ok');
        if (this.sel === 0) this.paused = false;
        else if (this.sel === 1) app.go(() => new BattleScene(app, this.cfg));
        else this.quit();
      }
      return;
    }
    if (startBy && m.state === 'fight') { this.paused = true; this.sel = 0; this.pauseBy = startBy; app.audio.sfx('pause'); return; }
    m.update();
    this.debugAids();
    if (m.done) this.finish();
  }

  debugAids() {
    const d = this.dbg, m = this.m;
    if (!d.super && !d.helper) return;
    if (m.state !== 'fight') return;
    const grant = (f) => { if (!f.out && f.state !== 'dead' && !f.superActive) f.superReady = true; };
    if (d.super && (m.stateT === 2 || (d.super === 2 && m.frame % 480 === 0))) m.fighters.forEach(grant);
    if (d.super >= 11 && m.stateT === 2) { m.fighters.forEach((f) => { f.superReady = false; }); grant(m.fighters[d.super - 11]); }
    if (d.helper && m.stateT === 30) {
      import('../game/items.js').then(({ HELPERS }) => {
        const h = HELPERS.find((x) => x.id === d.helper) || HELPERS[0];
        const f = m.fighters[0];
        if (h) h.spawn(m, f, f.x + 40, f.y);
      });
    }
  }

  finish() {
    if (this._finished) return; this._finished = true;
    if (this.cfg.onDone) return this.cfg.onDone(this.m, this);
    import('./results.js').then((mod) => this.app.go(() => new mod.ResultsScene(this.app, this.cfg, this.m)))
      .catch(() => this.app.go(() => new BattleScene(this.app, this.cfg)));
  }
  quit() {
    this.app.audio.stopMusic();
    import('./title.js').then((mod) => this.app.go(() => new mod.TitleScene(this.app, true)))
      .catch(() => this.app.go(() => new BattleScene(this.app, this.cfg)));
  }

  draw(ctx) {
    drawMatch(ctx, this.m, { debug: this.debug });
    if (this.paused) {
      ctx.fillStyle = 'rgba(16,12,20,0.6)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, 'PAUSED', W / 2, 150, { font: 'carter', size: 66, fill: ['#ffffff', '#cfe3ff'], lw: 9, shadow: 5, stroke2: '#ffffff', lw2: 6 });
      this.opts.forEach((o, i) => button(ctx, W / 2 - 130, 230 + i * 66, 260, 50, o, i === this.sel ? 1 : 0, { color: i === 2 ? '#e8402a' : '#2f9bea', pulse: this.app.t }));
      txt(ctx, 'F2 shows hitboxes', W / 2, H - 22, { font: 'pixel', size: 10, fill: '#ffffff', lw: 0, stroke: null });
    }
  }
}
