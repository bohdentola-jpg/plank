// MASCOT MELEE 64 — app shell. Owns the save file, the one requestAnimationFrame
// loop, and the flow between menus and matches. The sim runs on a fixed 60 Hz
// accumulator no matter what the display does, because every hitbox in the game
// is authored in 60 Hz frames.
import { InputHub, VirtualControls } from './input.js';
import { Menus } from './menu.js';
import { Match } from './match.js';
import { View, Preview } from './view.js';
import { Hud } from './hud.js';
import { ROSTER, charById, randomChar } from './roster.js';
import { STAGES, stageById, randomStage } from './stages.js';
import { GAUNTLET, gauntletRound, TRAINING_DUMMIES } from './modes.js';
import { sfx, music } from './sound.js';

const STEP = 1 / 60;
const SAVE_KEY = 'mascotmelee64_v1';

function defaultState() {
  return {
    options: { res: 'n64', crt: true, music: 0.7, sound: 0.8, announcer: true, tapJump: false },
    unlocks: {},
    records: { matches: 0, kos: 0, falls: 0, wins: {}, gauntlet: null },
    lastSetup: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const d = JSON.parse(raw);
    const s = defaultState();
    return {
      options: { ...s.options, ...(d.options || {}) },
      unlocks: d.unlocks || {},
      records: { ...s.records, ...(d.records || {}) },
      lastSetup: d.lastSetup || null,
    };
  } catch { return defaultState(); }
}

function defaultSetup() {
  return {
    slots: [
      { type: 'human', level: 5 },
      { type: 'cpu', level: 4 },
      { type: 'off', level: 4 },
      { type: 'off', level: 4 },
    ],
    rules: { mode: 'stock', stocks: 3, timeLimit: 0, items: false, itemRate: 1, damageRatio: 1 },
  };
}

const qs = new URLSearchParams(location.search);

class App {
  constructor() {
    this.state = loadState();
    this.hub = new InputHub(window);
    this.menuRoot = document.getElementById('melee-menus');
    this.gameRoot = document.getElementById('melee-game');
    this.hudRoot = document.getElementById('melee-hud');
    this.menus = new Menus(this.menuRoot, this.state);
    this.match = null;
    this.view = null;
    this.hud = null;
    this.preview = null;
    this.previewHolder = null;
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.matchDone = null;
    this.training = false;
    this.applyOptions();
    this.hub.autoAssign(2);
    requestAnimationFrame((t) => this.loop(t));
    this.flow().catch((e) => {
      console.error(e);
      document.body.classList.add('crashed');
    });
  }

  // ----------------------------------------------------------------- storage
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* private mode */ }
  }

  applyOptions() {
    const o = this.state.options;
    sfx.setVolume(o.sound);
    sfx.voiceOff = !o.announcer;
    music.setMuted(o.music <= 0);
    music.setVolume(o.music);
    this.hub.tapJump = o.tapJump;
    this.view?.setRes?.(o.res);
    this.view?.setCrt?.(o.crt);
  }

  // -------------------------------------------------------------- main loop
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.hub.poll();

    // Pause and the training reset read button *edges*, so they have to be
    // checked before the sim steps — stepping consumes the edges.
    if (this.match && !this.paused) {
      this.pollPause();
      this.pollTrainingReset();
    }

    if (this.match && !this.paused) {
      this.acc = Math.min(this.acc + dt, STEP * 5);
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.match.step();
        for (const p of this.hub.players) p.consumeEdges?.();
        this.acc -= STEP;
        steps++;
      }
      this.view?.update(dt);
      this.hud?.update(dt);
      if (this.hud) this.hud.handleEvents(this.match.drainEvents(), sfx);
      if (this.match.over && this.matchDone) {
        this.overTimer = (this.overTimer || 0) + dt;
        if (this.overTimer > 2.6) {
          const done = this.matchDone;
          this.matchDone = null;
          this.overTimer = 0;
          done('over');
        }
      }
    } else if (this.match && this.paused) {
      this.view?.update(dt * 0.15);
      this.menus.tick(this.hub);
      return;
    }

    if (!this.match) {
      this.preview?.update(dt);
      this.menus.tick(this.hub);
    }
  }

  pollPause() {
    if (this.paused || !this.match || this.match.over) return;
    const anyStart = this.hub.players.some((p, i) => this.hub.assign[i] !== 'cpu' && p.pressed?.start);
    if (!anyStart) return;
    this.openPause();
  }

  /** In training, taunt wipes the slate: damage to zero, everyone back on stage. */
  pollTrainingReset() {
    if (!this.training || !this.match) return;
    const wants = this.hub.players.some((p, i) => this.hub.assign[i] !== 'cpu' && p.pressed?.taunt);
    if (!wants) return;
    for (const f of this.match.fighters) {
      f.percent = 0;
      const sp = this.match.world.spawnPoint(f.index);
      f.spawn(sp.x, sp.y, sp.x > 0 ? -1 : 1);
    }
    this.match.projectiles.length = 0;
    this.hud?.banner('RESET', 'damage cleared', 900);
    sfx.ui('ready');
  }

  async openPause() {
    this.paused = true;
    music.duck(true);
    const action = await this.menus.interstitialPause();
    music.duck(false);
    this.paused = false;
    this.menus.clear();
    if (action === 'quit') {
      const done = this.matchDone;
      this.matchDone = null;
      done?.('quit');
    }
  }

  // ------------------------------------------------------------------- match
  teardownMatch() {
    this.view?.dispose();
    this.hud?.dispose();
    this.view = null;
    this.hud = null;
    this.match = null;
    this.gameRoot.innerHTML = '';
    this.hudRoot.innerHTML = '';
    this.acc = 0;
  }

  /**
   * Run one match to completion. `picks` maps slot index → {def, alt}.
   * Resolves 'over' when the game ends naturally, or 'quit' from the pause menu.
   */
  async runMatch({ picks, setup, stage, musicId, training = false }) {
    this.menus.clear();
    this.disposePreview();
    this.training = training;
    const entrants = [];
    setup.slots.forEach((s, i) => {
      if (s.type === 'off' || !picks[i]) return;
      const isHuman = s.type === 'human';
      const controls = isHuman ? this.hub.useHuman(i) : this.hub.setVirtual(i, true);
      entrants.push({
        def: picks[i].def, alt: picks[i].alt || 0, controls,
        cpu: isHuman ? 0 : s.level, name: picks[i].def.name,
      });
    });
    if (entrants.length < 2) {
      entrants.push({ def: randomChar(this.state.unlocks), alt: 1, controls: new VirtualControls(), cpu: 4 });
    }
    const match = new Match({ stage, entrants, rules: setup.rules, sfx, seed: (Date.now() % 100000) | 0 });
    this.match = match;
    this.view = new View(this.gameRoot, match, { res: this.state.options.res, crt: this.state.options.crt });
    this.hud = new Hud(this.hudRoot, match);
    music.play(musicId || stage.music);
    sfx.voice(training ? 'Training' : `${entrants[0].def.name} versus ${entrants[1].def.name}`);
    const how = await new Promise((res) => { this.matchDone = res; });
    const result = match.result;
    if (how === 'over' && result) this.recordMatch(match);
    music.stop();
    return { how, result, match };
  }

  recordMatch(match) {
    const r = this.state.records;
    r.matches++;
    for (const f of match.fighters) { r.kos += f.kos; r.falls += f.falls; }
    const win = match.result?.order?.[0];
    if (win) r.wins[win.def.id] = (r.wins[win.def.id] || 0) + 1;
    if (r.matches >= 12) this.grantUnlock('matches12');
    this.save();
  }

  grantUnlock(key) {
    if (this.state.unlocks[key]) return false;
    this.state.unlocks[key] = true;
    this.save();
    this.pendingUnlock = ROSTER.find((c) => c.unlock?.key === key) || null;
    return true;
  }

  async showUnlock() {
    const c = this.pendingUnlock;
    if (!c) return;
    this.pendingUnlock = null;
    sfx.voice('New challenger');
    sfx.ui('ready');
    await this.menus.interstitial('NEW CHALLENGER', `${c.name} — ${c.title} — joins the roster.`, 'NICE');
  }

  // ----------------------------------------------------------------- preview
  previewCb() {
    return (holder, def) => {
      if (!holder) { this.disposePreview(); return; }
      if (this.previewHolder !== holder) {
        this.disposePreview();
        this.preview = new Preview(holder, { crt: this.state.options.crt });
        this.previewHolder = holder;
      }
      this.preview.show(def || randomChar(this.state.unlocks), 0);
      this.preview.resize();
    };
  }

  disposePreview() {
    this.preview?.dispose();
    this.preview = null;
    this.previewHolder = null;
  }

  // -------------------------------------------------------------------- flow
  async flow() {
    // QA shortcuts: ?quick jumps straight into a fight, ?demo is CPU vs CPU
    if (qs.has('quick') || qs.has('demo')) {
      const stage = qs.get('stage') ? stageById(qs.get('stage')) : STAGES[0];
      const setup = defaultSetup();
      if (qs.has('demo')) { setup.slots[0] = { type: 'cpu', level: 7 }; setup.slots[1] = { type: 'cpu', level: 7 }; }
      // ?humans=2 puts a second player on the second device (a pad, or the arrows)
      if (+(qs.get('humans') || 1) > 1) setup.slots[1] = { type: 'human', level: 5 };
      const picks = {
        0: { def: charById(qs.get('p1') || 'blitz'), alt: 0 },
        1: { def: charById(qs.get('p2') || 'tusk'), alt: 1 },
      };
      if (qs.get('p3')) { setup.slots[2] = { type: 'cpu', level: 5 }; picks[2] = { def: charById(qs.get('p3')), alt: 2 }; }
      sfx.ensure();
      await this.runMatch({ picks, setup, stage });
      this.teardownMatch();
    }

    await this.menus.boot();
    sfx.ensure();
    sfx.resume();

    for (;;) {
      music.play('menu');
      const pick = await this.menus.title(this.previewCb());
      if (pick === 'library') { location.href = '../index.html'; return; }
      if (pick === 'howto') { await this.menus.howto(); continue; }
      if (pick === 'options') { await this.menus.options(this.view); this.applyOptions(); this.save(); continue; }
      if (pick === 'gauntlet') { await this.gauntletFlow(); continue; }
      if (pick === 'training') { await this.trainingFlow(); continue; }
      await this.smashFlow();
    }
  }

  async smashFlow() {
    const setup = this.state.lastSetup ? { ...defaultSetup(), ...this.state.lastSetup } : defaultSetup();
    for (;;) {
      const conf = await this.menus.vsSetup(setup, this.hub);
      if (!conf) return;                                  // back to the title
      this.state.lastSetup = { slots: setup.slots, rules: setup.rules };
      this.save();
      // character select ↔ stage select ↔ rematch, each backing out one level
      for (;;) {
        music.play('select');
        const picks = await this.menus.charSelect(setup, this.hub, this.previewCb());
        if (!picks) break;                                // back to the setup screen
        const stageId = await this.menus.stageSelect();
        if (!stageId) continue;                           // back to character select
        let again = false;
        for (;;) {
          const stage = stageId === 'random' ? randomStage() : stageById(stageId);
          const { how, result, match } = await this.runMatch({ picks, setup, stage });
          this.teardownMatch();
          if (how === 'quit' || !result) return;
          await this.showUnlock();
          music.play('results');
          const next = await this.menus.results(match);
          music.stop();
          if (next === 'rematch') continue;
          if (next === 'chars') { again = true; break; }  // straight back to the grid
          return;                                         // quit to title
        }
        if (again) continue;
      }
    }
  }

  async gauntletFlow() {
    const progress = { round: 0, difficulty: 'normal' };
    const action = await this.menus.gauntletBoard(progress);
    if (action !== 'go') return;
    // one human, one fighter, six rounds
    const setup = defaultSetup();
    setup.slots = [{ type: 'human', level: 5 }, { type: 'off' }, { type: 'off' }, { type: 'off' }];
    music.play('select');
    const picks = await this.menus.charSelect(setup, this.hub, this.previewCb());
    if (!picks || !picks[0]) return;
    const me = picks[0];
    for (let i = 0; i < GAUNTLET.length; i++) {
      const round = gauntletRound(progress.difficulty, i, me.def, me.alt);
      const roundSetup = {
        slots: [{ type: 'human', level: 5 }, ...round.entrants.slice(1).map((e) => ({ type: 'cpu', level: e.cpu }))],
        rules: { ...round.rules },
      };
      while (roundSetup.slots.length < 4) roundSetup.slots.push({ type: 'off' });
      const roundPicks = { 0: me };
      round.entrants.slice(1).forEach((e, k) => { roundPicks[k + 1] = { def: e.def, alt: e.alt }; });
      await this.menus.interstitial(round.meta.label, `${round.stage.name.toUpperCase()} — ${round.meta.blurb}`, 'FIGHT');
      const { how, result } = await this.runMatch({
        picks: roundPicks, setup: roundSetup, stage: round.stage, musicId: round.music,
      });
      const won = result && result.order[0]?.index === 0;
      this.teardownMatch();
      if (how === 'quit') return;
      if (!won) {
        music.play('results');
        await this.menus.interstitial('GAME OVER', `${me.def.name} fell in ${round.meta.label}. The bin keeps its crown.`, 'BACK TO TITLE');
        music.stop();
        return;
      }
      progress.round = i + 1;
      if (i < GAUNTLET.length - 1) {
        await this.menus.interstitial('ROUND CLEAR', `${GAUNTLET[i + 1].label} is next: ${GAUNTLET[i + 1].blurb}`, 'CONTINUE');
      }
    }
    // cleared it
    this.state.records.gauntlet = { difficulty: progress.difficulty, char: me.def.id, at: Date.now() };
    const fresh = this.grantUnlock('gauntlet');
    this.save();
    music.play('results');
    await this.menus.interstitial('GAUNTLET CLEARED', `${me.def.name} beat all six rounds on ${progress.difficulty.toUpperCase()}.`, 'CHAMPION');
    music.stop();
    if (fresh) await this.showUnlock();
  }

  async trainingFlow() {
    const setup = defaultSetup();
    setup.slots = [{ type: 'human', level: 5 }, { type: 'cpu', level: 0 }, { type: 'off' }, { type: 'off' }];
    setup.rules = { mode: 'stock', stocks: 99, timeLimit: 0, items: false, itemRate: 1, damageRatio: 1 };
    music.play('select');
    const picks = await this.menus.charSelect(setup, this.hub, this.previewCb());
    if (!picks) return;
    const dummy = TRAINING_DUMMIES[2];
    setup.slots[1].level = dummy.cpu || 1;
    const stageId = await this.menus.stageSelect();
    if (!stageId) return;
    const stage = stageId === 'random' ? randomStage() : stageById(stageId);
    const { how } = await this.runMatch({ picks, setup, stage, training: true });
    this.teardownMatch();
    this.training = false;
    if (how === 'quit') return;
  }
}

// the pause card lives here so it can share the Menus navigation
Menus.prototype.interstitialPause = function interstitialPause() {
  return this._screen('mpause', (wrap, done) => {
    const el = (tag, cls, parent, html) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (html != null) n.innerHTML = html;
      parent.appendChild(n);
      return n;
    };
    el('div', 'inter-title', wrap, 'PAUSED');
    const btns = el('div', 'pause-btns', wrap);
    for (const [id, label] of [['resume', 'BACK TO THE FIGHT'], ['quit', 'QUIT THE MATCH']]) {
      const b = el('button', 'mbtn', btns);
      b.dataset.cell = '1';
      b.dataset.action = id;
      if (id === 'resume') b.dataset.default = '1';
      el('span', 'mbtn-label', b, label);
      b.onclick = () => done(id);
    }
    el('div', 'pause-keys', wrap,
      'PAD — stick move · ✕ attack · ◯ special · □/△ jump · L2/R2 shield · R1 grab · right stick smash · OPTIONS pause<br>'
      + 'P1 KEYS — WASD move · SPACE jump · J attack · K special · L shield · H grab · T taunt · ESC pause<br>'
      + 'P2 KEYS — arrows move · NUM0 jump · NUM1 attack · NUM2 special · NUM3 shield · NUM4 grab');
    return { onConfirm: (cell) => done(cell.dataset.action), onBack: () => done('resume') };
  });
};

window.melee = new App();
