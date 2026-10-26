// Dynamic soundtrack engine: every theme is synthesized live (see music/*).
//
//   decks (one per playing theme, crossfaded) ─┐  (each deck: dry ↔ stadium-PA EQ, + PA echo send)
//   stingers ──────────────────────────────────┼→ input → tone LP (live-play duck) + shelf
//   PA echo (far speaker clusters) ────────────┘    → 28 Hz HP → dip → glue compressor → peak limiter
//                                                    → TV-tuning (warble delay, band-pass, level)
//                                                    → soft clipper → bus (audio.musicBus)
//   deck reverb sends → revIn → (tuning level) → audio.reverbSend
//
// API (all safe before audio is unlocked; requests are remembered):
//   music.play(theme, { seed, fade = 1.5, intensity })  crossfade to a theme (no-op if already
//       playing with the same seed). seed: number or string.
//   music.stop(fade = 1)
//   music.update()                  call every frame; a 25 ms interval also schedules
//   music.setIntensity(x)           0..1 layer density, applied on the next bar line
//   music.setGameState(s)           { quarter, clock (s left), scoreDiff (player − opponent),
//                                     redZone, twoMinute, playLive } — any subset, any time.
//                                     Nudges in-game beds' intensity (late + close, red zone,
//                                     two-minute drill), swaps the hook for a tense ostinato
//                                     while behind, lifts the key at the two-minute warning,
//                                     and ducks + darkens all music while a play is live.
//   music.setPA(x | null)           force the stadium-PA coloration (0 clean … 1 through the PA);
//                                     null = each theme's own (huddle stations are in the stadium)
//   music.stinger(name)             td | turnover | bigplay | kickoff | win | lose | twominute |
//                                     select | unlock
//   music.setTuning(x)              TV channel tuning: 0 clear … 1 between channels (silent)
//   music.theme                     current theme id (or the pending one) | null
//   music.beatInfo()                { bpm, bar, beat, phase } for visual sync
// Themes: hud_glory hud_free hud_practice hud_book hud_hof hud_options | playcall pregame halftime
//   postgame_win postgame_loss | career_hub draft  (and band_cadence band_fight band_charge,
//   which band.js plays through its own engine instance)

import { audio } from './audio.js';
import { clamp, hashStr } from './music/util.js';
import { bank, clipCurve, DRUM_NAMES, MS_KINDS } from './music/render.js';
import { THEMES } from './music/themes.js';

const LOOKAHEAD = 0.2;

export class Music {
  /** opts: { bus: () => AudioNode (default audio.musicBus), prewarm = true } */
  constructor(opts = {}) {
    this.ctx = null;
    this.deck = null;
    this.decks = [];
    this._busFn = opts.bus || (() => audio.musicBus);
    this._prewarmOn = opts.prewarm !== false;
    this._want = null;
    this._game = {};
    this._kindInt = {};
    this._tuning = 0;
    this._timer = null;
    this._live = false;
    this._twoMin = false;
    this._paOverride = null;
    audio.onReady(() => this._init());
  }

  // ---- lifecycle -------------------------------------------------------------------------
  _ensure() {
    if (audio.ctx && audio.ctx !== this.ctx) this._init();
    return !!this.ctx;
  }

  _init() {
    const ctx = audio.ctx;
    if (!ctx || ctx === this.ctx) return;
    for (const d of this.decks) d.destroy();
    this.decks = [];
    this.deck = null;
    this.ctx = ctx;
    this._offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    this._buildChain();
    if (!this._offline && !this._timer && typeof setInterval !== 'undefined') {
      this._timer = setInterval(() => this._tick(), 25);
    }
    this.setTuning(this._tuning, true);
    if (this._live) this._applyLive(true);
    if (this._want) {
      const w = this._want;
      this._start(w.theme, w.seed, w.fade, w.intensity);
    }
    if (!this._offline && this._prewarmOn) this._prewarm();
  }

  /** Render the shared drum kit and common synth multisamples in idle time. */
  _prewarm() {
    const B = bank(this.ctx);
    const q = (this._warmQ = []);
    for (const n of DRUM_NAMES()) q.push(() => B.get(n));
    const ranges = {
      pad: [50, 78], strings: [55, 84], saw: [57, 90], choir: [62, 84], piano: [55, 84], stab: [55, 79],
      pluck: [62, 88], brass: [50, 80], organ: [58, 77], bell: [69, 90], square: [66, 96], mallet: [67, 84], saw3: [55, 76],
      trumpet: [58, 84], horn: [48, 76], bone: [40, 68], tuba: [28, 52], timp: [38, 56], tonewheel: [45, 84], glock: [76, 96],
    };
    for (const k of MS_KINDS()) {
      const [lo, hi] = ranges[k] || [60, 72];
      const seen = new Set();
      for (let m = lo; m <= hi; m++) {
        const key = B.msKey(k, m);
        if (!seen.has(key)) { seen.add(key); q.push(() => B.ms(k, m)); }
      }
    }
    const ctx = this.ctx;
    const step = (dl) => {
      if (this.ctx !== ctx || !q.length) return;
      const t0 = performance.now();
      const budget = dl && dl.timeRemaining ? Math.min(8, dl.timeRemaining()) : 6;
      while (q.length && performance.now() - t0 < budget) q.shift()();
      if (q.length) idle(step);
    };
    const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 40));
    idle(step);
  }

  _buildChain() {
    const ctx = this.ctx;
    const G = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
    const F = (type, f, q, dest, db = 0) => {
      const n = ctx.createBiquadFilter();
      n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = db;
      if (dest) n.connect(dest);
      return n;
    };
    this.out = G(1, this._busFn());
    this.clip = ctx.createWaveShaper();
    this.clip.curve = clipCurve(2);
    this.clip.oversample = 'none';
    this.clip.connect(this.out);
    this.clipPre = G(0.5, this.clip);
    this.level = G(1, this.clipPre);
    this.tPeak = F('peaking', 1400, 1.1, this.level, 0);
    this.tLP = F('lowpass', 22000, 0, this.tPeak);
    this.tHP = F('highpass', 10, 0, this.tLP);
    this.wDry = G(1, this.tHP);
    this.wWet = G(0, this.tHP);
    this.wDelay = ctx.createDelay(0.1);
    this.wDelay.delayTime.value = 0.012;
    this.wDelay.connect(this.wWet);
    this._wl = [];
    for (const rate of [4.6, 0.73]) {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const g = G(0);
      o.connect(g); g.connect(this.wDelay.delayTime);
      o.start();
      this._wl.push(g);
    }
    // peak limiter (the compressor's built-in pre-delay acts as look-ahead)
    this.limOut = G(0.82);
    this.limOut.connect(this.wDry);
    this.limOut.connect(this.wDelay);
    this.lim = ctx.createDynamicsCompressor();
    this.lim.threshold.value = -4;
    this.lim.knee.value = 2;
    this.lim.ratio.value = 16;
    this.lim.attack.value = 0.002;
    this.lim.release.value = 0.09;
    this.lim.connect(this.limOut);
    this.makeup = G(1, this.lim);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 2.5;
    this.comp.attack.value = 0.01;
    this.comp.release.value = 0.2;
    this.comp.connect(this.makeup);
    this.dip = G(1, this.comp);
    this.subHP = F('highpass', 28, 0, this.dip); // keep subsonics out of the compressor/limiter
    this.shelf = F('highshelf', 5200, 0, this.subHP, 0);
    this.tone = F('lowpass', 22000, 0, this.shelf);
    this.input = G(1, this.tone);
    this.revIn = G(1);
    this.revLevel = G(1, audio.reverbSend);
    this.revIn.connect(this.revLevel);
    this.sting = G(0.55, this.input);
    // the stadium PA: the far speaker clusters answer late and dark, then the bowl washes it out
    this.paIn = G(1);
    for (const [dt, cut, g] of [[0.19, 3200, 0.3], [0.37, 2400, 0.2], [0.58, 1700, 0.12], [0.83, 1300, 0.06]]) {
      const d = ctx.createDelay(1);
      d.delayTime.value = dt;
      this.paIn.connect(d);
      d.connect(F('lowpass', cut, 0.5, G(g, this.input)));
    }
    this.paIn.connect(G(0.7, this.revIn));
  }

  _lookahead() {
    if (typeof document !== 'undefined' && document.hidden) return 1.1;
    return LOOKAHEAD;
  }

  _tick() {
    if (this.ctx && this.ctx.state === 'running') this._schedule();
  }

  /** Schedule all decks up to `until` (default now + lookahead). Test hook. */
  _schedule(until) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const end = until ?? now + this._lookahead();
    for (let i = this.decks.length - 1; i >= 0; i--) {
      const d = this.decks[i];
      if (d.dying && now >= d.killAt) {
        d.destroy();
        this.decks.splice(i, 1);
        continue;
      }
      d.schedule(end);
    }
  }

  // ---- public API --------------------------------------------------------------------------
  play(theme, { seed, fade = 1.5, intensity } = {}) {
    if (!THEMES[theme]) { console.warn(`music: unknown theme ${theme}`); return; }
    const cls = THEMES[theme];
    if (intensity != null) this._kindInt[cls.kind] = clamp(intensity, 0, 1);
    const cur = this.deck;
    const same = cur && !cur.dying && cur.id === theme && (seed == null || seedOf(seed) === cur.seed);
    this._want = { theme, seed, fade, intensity };
    if (!this._ensure()) return; // starts when audio.onReady fires
    if (same) {
      if (intensity != null) this.setIntensity(intensity);
      return;
    }
    this._start(theme, seed, fade, intensity);
  }

  _start(theme, seed, fade = 1.5, intensity) {
    const cls = THEMES[theme];
    const now = this.ctx.currentTime;
    if (this.deck) this.deck.retire(fade);
    // rapid switching (huddle wristband): keep at most two fading decks
    const dying = this.decks.filter((d) => d.dying && !d.dead);
    while (dying.length > 2) dying.shift().retire(0.03);
    const s = seed == null ? DEFAULT_SEED[theme] ?? hashStr(theme) : seedOf(seed);
    if (intensity == null && this._pendingInt != null) intensity = this._pendingInt;
    this._pendingInt = null;
    if (intensity != null) this._kindInt[cls.kind] = intensity;
    const d = new cls(this, theme, s, {
      intensity: intensity ?? this._kindInt[cls.kind] ?? cls.intensity,
      game: this._game,
    });
    if (d.kind === 'game') {
      d.intensity = d.targetIntensity = this._gameIntensity(d);
      if (this._twoMin) d.lift();
    }
    const t0 = now + 0.03;
    d.fadeIn(t0, fade);
    d.start(t0);
    this.decks.push(d);
    this.deck = d;
    this._schedule();
  }

  stop(fade = 1) {
    this._want = null;
    if (!this.ctx || !this.deck) return;
    this.deck.retire(fade);
    this.deck = null;
  }

  update() {
    if (!this._ensure()) return;
    if (this.ctx.state === 'running' || this._offline) this._schedule();
  }

  setIntensity(x) {
    x = clamp(+x || 0, 0, 1);
    const d = this.deck;
    if (d && !d.dying) {
      this._kindInt[d.kind] = x;
      d.targetIntensity = d.kind === 'game' ? this._gameIntensity(d) : x;
    } else if (this._want) {
      this._want.intensity = x;
    } else {
      this._pendingInt = x; // applies to the next play() without an explicit intensity
    }
  }

  setGameState(s) {
    if (!s) return;
    const g = this._game;
    for (const k of ['quarter', 'clock', 'scoreDiff', 'redZone', 'twoMinute', 'playLive']) if (k in s) g[k] = s[k];
    const d = this.deck && !this.deck.dying ? this.deck : null;
    if ('scoreDiff' in s) d?.setLeading(!(g.scoreDiff < 0));
    if ('twoMinute' in s && !!s.twoMinute !== this._twoMin) {
      this._twoMin = !!s.twoMinute;
      if (this._twoMin && d && d.kind === 'game') d.lift();
    }
    if ('playLive' in s && !!s.playLive !== this._live) {
      this._live = !!s.playLive;
      if (this.ctx) this._applyLive();
    }
    if (d && d.kind === 'game') d.targetIntensity = this._gameIntensity(d);
  }

  /** In-game intensity: the bed's base, nudged by how much the moment matters. */
  _gameIntensity(d) {
    const g = this._game;
    let x = this._kindInt.game ?? d.constructor.intensity;
    const q = g.quarter ?? 1, clock = g.clock ?? 900, diff = g.scoreDiff ?? 0;
    const close = Math.abs(diff) <= 8;
    if (q >= 4) x += 0.08;
    if (q >= 5) x += 0.08; // overtime
    if (q >= 4 && close) x += 0.12;
    if ((q === 2 || q >= 4) && clock <= 120) x += 0.08;
    if (g.redZone) x += 0.12;
    if (g.twoMinute) x += 0.15;
    if (Math.abs(diff) >= 21) x -= 0.12; // a blowout settles down
    return clamp(x, 0, 1);
  }

  // live play: the music steps back under the action (ducked after the
  // compressor so it can't make the level back up, and darkened before it)
  _applyLive(force) {
    const t = this.ctx.currentTime;
    const og = this.out.gain, tf = this.tone.frequency;
    og.cancelScheduledValues(t);
    tf.cancelScheduledValues(t);
    if (this._live) {
      og.setTargetAtTime(0.3, t, force ? 0.005 : 0.25);
      tf.setTargetAtTime(1600, t, force ? 0.005 : 0.3);
    } else {
      og.setTargetAtTime(1, t, 0.5);
      tf.setTargetAtTime(22000, t, 0.4);
    }
  }

  setPA(x) {
    this._paOverride = x == null ? null : clamp(+x || 0, 0, 1);
    for (const d of this.decks) if (!d.dying) d.setPA(this._paOverride ?? d.constructor.pa);
  }

  get theme() {
    if (this.deck) return this.deck.id;
    return this._want ? this._want.theme : null;
  }

  beatInfo() {
    const d = this.deck;
    if (!d || !this.ctx) return { bpm: 0, bar: 0, beat: 0, phase: 0 };
    return d.beatInfo(this.ctx.currentTime);
  }

  setTuning(x, force) {
    x = clamp(+x || 0, 0, 1);
    if (!force && Math.abs(x - this._tuning) < 0.0005) return;
    this._tuning = x;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, tc = force ? 0.005 : 0.03;
    const k = Math.pow(x, 0.6);
    this.tHP.frequency.setTargetAtTime(10 * Math.pow(65, k), t, tc);
    this.tLP.frequency.setTargetAtTime(22000 * Math.pow(1700 / 22000, k), t, tc);
    this.tPeak.gain.setTargetAtTime(9 * k, t, tc);
    const wet = Math.min(1, x * 3);
    this.wWet.gain.setTargetAtTime(wet, t, tc);
    this.wDry.gain.setTargetAtTime(1 - wet, t, tc);
    this._wl[0].gain.setTargetAtTime(0.0013 * k, t, tc);
    this._wl[1].gain.setTargetAtTime(0.0032 * k, t, tc);
    const lvl = Math.pow(1 - x, 1.7);
    this.level.gain.setTargetAtTime(lvl, t, tc);
    this.revLevel.gain.setTargetAtTime(lvl, t, tc);
  }

  // ---- stingers --------------------------------------------------------------------------------
  stinger(name) {
    if (!this._ensure()) return;
    this._stK = STING_GAIN[name] ?? 1;
    try { this._stinger(name); } finally { this._stK = 1; }
  }

  _stinger(name) {
    const ctx = this.ctx, now = ctx.currentTime;
    const d = this.deck && !this.deck.dying ? this.deck : null;
    const q = d ? d.nextStepTime(now + 0.004) : now + 0.02;
    const pc = d ? (((d.keyPc + d.transpose) % 12) + 12) % 12 : 10; // B♭ when silent: the band's key
    const root = 48 + pc - (pc > 7 ? 12 : 0); // tonic in octave 3 (E2..G3)
    const minor = d ? !['major', 'mixolydian'].includes(d.scale) : false;
    const third = minor ? 3 : 4;
    const e = 0.11; // a brisk 8th for fanfares, independent of the deck's tempo
    switch (name) {
      case 'td': { // TOUCHDOWN: snare pickup, rising trumpet call, full-band major hit, timpani, glock
        const r = root + 12, t1 = q + e * 4;
        this._roll('snare_mil', q, e * 4, 0.18, 0.5, 0.034);
        [0, 4, 7].forEach((iv, i) => this._note('trumpet', q + e * (1 + i), r + 12 + iv, e * 0.9, 0.42));
        this._hit('crash', t1, 0.5, -0.3);
        this._hit('cym_crash', t1 + 0.01, 0.42, 0.3);
        this._hit('impact', t1, 0.3);
        this._note('timp', t1, r - 12, 1.5, 0.5);
        this._chord('trumpet', t1, r + 12, [0, 4, 7, 12], 1.9, 0.5, { rel: 0.5 });
        this._chord('bone', t1, r, [0, 4, 7], 1.9, 0.42, { rel: 0.5 });
        this._note('tuba', t1, r - 12, 1.9, 0.4, { rel: 0.5 });
        this._roll('timp', t1 + 0.6, 1.3, 0.15, 0.4, 0.05, r - 12);
        [24, 28, 31, 36].forEach((iv, i) => this._note('glock', t1 + e * (2 + i), r + iv, 0.8, 0.3));
        break;
      }
      case 'turnover': { // the floor drops out: impact, three falling low-brass stabs in minor, timpani
        const r = root;
        this._hit('impact', q, 0.8);
        this._hit('china', q, 0.45, 0.2);
        [[0, 3], [1, 2], [2, 0]].forEach(([k, iv]) => {
          const t = q + k * 0.24;
          const v = k === 2 ? 0.62 : 0.48, dur = k === 2 ? 1.4 : 0.18;
          this._chord('bone', t, r + iv, [0, 3, 7], dur, v);
          this._note('tuba', t, r - 12 + iv, dur, v);
          this._note('timp', t, r + iv - 12, dur, v);
        });
        this._chord('horn', q + 0.48, r + 12, [0, 3, 6], 1.6, 0.3, { rel: 0.8 });
        this._hit('down', q + 0.5, 0.35);
        break;
      }
      case 'bigplay': { // a jolt: snare flam, crash, brass stab with a ninth, a sparkle
        const r = root + 12;
        this._hit('snare_march', q, 0.35);
        this._hit('snare_march', q + 0.025, 0.55);
        this._hit('crash', q + 0.025, 0.45, 0.25);
        this._chord('trumpet', q + 0.025, r + 12, [0, 4, 7, 14], 0.55, 0.75);
        this._chord('bone', q + 0.025, r, [0, 7, 12], 0.55, 0.6);
        this._note('timp', q + 0.025, r - 12, 0.8, 0.5);
        this._note('glock', q + 0.2, r + 31, 0.6, 0.25);
        break;
      }
      case 'kickoff': { // the build to the boot: snare + timpani rolls swelling, then the hit
        const r = root, t1 = q + 1.6;
        this._roll('snare_mil', q, 1.6, 0.05, 0.26, 0.036);
        this._roll('timp', q, 1.6, 0.15, 0.6, 0.055, r - 12 + 7);
        this._chord('horn', q + 0.4, r + 12, [0, 7, 12], 1.2, 0.35, { atk: 0.8, rel: 0.1 });
        this._hit('crash', t1, 0.45);
        this._hit('impact', t1, 0.35);
        this._chord('trumpet', t1, r + 24, [0, 7, 12], 0.8, 0.6);
        this._chord('bone', t1, r + 12, [0, 7], 0.8, 0.55);
        this._note('tuba', t1, r, 0.8, 0.45);
        this._note('timp', t1, r - 12, 1, 0.55);
        break;
      }
      case 'win': { // triumphant fanfare (major, picardy in minor keys)
        const r = root + 12;
        this._hit('crash', q, 0.8, -0.3);
        this._hit('cym_crash', q + 0.01, 0.6, 0.3);
        this._hit('impact', q, 0.5);
        [0, 4, 7, 12].forEach((iv, i) => this._note('trumpet', q + i * e * 1.5, r + iv + 12, i === 3 ? 1.8 : e * 1.3, 0.45));
        const th = q + e * 6;
        this._chord('trumpet', th, r + 12, [0, 4, 7], 1.8, 0.45, { rel: 0.6 });
        this._chord('bone', th, r, [0, 4, 7, 12], 1.8, 0.42, { rel: 0.6 });
        this._note('tuba', th, r - 12, 1.8, 0.5, { rel: 0.6 });
        this._roll('timp', th, 1.4, 0.2, 0.55, 0.05, r - 12);
        [24, 28, 31].forEach((iv, i) => this._note('glock', th + e * (2 + i), r + iv, 1, 0.25));
        break;
      }
      case 'lose': { // a horn sighs down over low strings
        const r = root;
        this._hit('boom', q, 0.35);
        this._chord('strings', q, r + 12, [0, 3, 7], 3, 0.16, { atk: 0.3, rel: 1.2, cut: 1600 });
        [7, 5, 3, 2, 0].forEach((iv, i) => this._note('horn', q + i * 0.42, r + 12 + iv, i === 4 ? 1.8 : 0.45, 0.4, { rel: 0.4 }));
        this._note('timp', q, r - 12, 1.2, 0.35);
        break;
      }
      case 'twominute': { // the two-minute warning: a ticking clock under a low-brass swell
        const r = root;
        for (let k = 0; k < 8; k++) this._hit('rim', q + k * 0.25, 0.3 + k * 0.05, k % 2 ? 0.3 : -0.3);
        this._chord('bone', q, r, [0, 7, 13], 2.1, 0.35, { atk: 1.2, rel: 0.3 });
        this._note('tuba', q, r - 12, 2.1, 0.4, { atk: 1.2, rel: 0.3 });
        this._roll('timp', q + 0.6, 1.4, 0.1, 0.6, 0.05, r - 12);
        this._hit('crash', q + 2, 0.7);
        this._chord('trumpet', q + 2, r + 12, [0, 7, 12], 0.5, 0.45);
        this._note('timp', q + 2, r - 12, 1, 0.7);
        break;
      }
      case 'select':
        this._note('pluck', now + 0.005, root + 19, 0.12, 0.3);
        this._note('pluck', now + 0.06, root + 24, 0.2, 0.32);
        break;
      case 'unlock': {
        const iv = minor ? [0, 3, 7, 10, 14, 15, 19, 24] : [0, 4, 7, 11, 14, 16, 19, 24];
        iv.forEach((x, i) => this._note('bell', now + 0.01 + i * 0.055, root + 24 + x, 0.9, 0.22 - i * 0.012));
        this._chord('choir', now + 0.01, root + 24, [0, 7, 12], 1.2, 0.1, { atk: 0.2, rel: 0.6 });
        this._hit('ride_bell', now + 0.01, 0.35, 0.3);
        break;
      }
      default:
        break;
    }
  }

  /** Roll on a drum (sample name) or the timpani (midi given): accelerating strokes, crescendo. */
  _roll(name, t, dur, v0, v1, gap, midi) {
    let k = 0;
    for (let tt = t; tt < t + dur; tt += gap, k++) {
      const u = (tt - t) / dur, v = (v0 + (v1 - v0) * u) * (k % 2 ? 0.88 : 1);
      if (midi != null) this._note('timp', tt, midi, gap * 2.5, v * 0.7, { rel: 0.3 });
      else this._hit(name, tt, v, k % 2 ? 0.12 : -0.12);
    }
  }

  _hit(name, t, vel, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = bank(ctx).get(name);
    const g = ctx.createGain();
    g.gain.value = vel * (this._stK ?? 1);
    let last = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
    src.connect(g); last.connect(this.sting);
    src.start(Math.max(t, ctx.currentTime));
    src.onended = () => { try { last.disconnect(); g.disconnect(); } catch { /* */ } };
  }

  _note(kind, t, midi, dur, vel, o = {}) {
    const ctx = this.ctx;
    vel *= this._stK ?? 1;
    const { buf, rate, loop } = bank(ctx).ms(kind, midi);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = loop;
    const g = ctx.createGain();
    t = Math.max(t, ctx.currentTime);
    const atk = o.atk ?? 0.004, rel = o.rel ?? 0.2;
    g.gain.setValueAtTime(0, t);
    if (atk <= 0.006) g.gain.linearRampToValueAtTime(vel, t + 0.003);
    else g.gain.setTargetAtTime(vel, t, atk / 3);
    g.gain.setTargetAtTime(0, t + dur, rel / 3.5);
    let last = g;
    if (o.cut) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.cut;
      g.connect(f);
      last = f;
    }
    src.connect(g); last.connect(this.sting);
    src.start(t, loop ? Math.random() * buf.duration * 0.9 : 0);
    const stop = loop ? t + dur + rel * 2 : Math.min(t + dur + rel * 2, t + buf.duration / rate);
    src.stop(stop);
    src.onended = () => { try { last.disconnect(); g.disconnect(); } catch { /* */ } };
  }

  _chord(kind, t, root, ivs, dur, vel, o) {
    const v = vel / Math.sqrt(ivs.length);
    for (const iv of ivs) this._note(kind, t, root + iv, dur, v, o);
  }
}

// stinger trims (measured: dense full-band hits come out hotter through the glue compressor)
const STING_GAIN = { td: 0.6, kickoff: 0.55, win: 0.85 };

const seedOf = (s) => (typeof s === 'number' && Number.isFinite(s) ? Math.floor(s) >>> 0 : hashStr(String(s)));

// default seeds: each station / screen always plays "its" song
const DEFAULT_SEED = {};
for (const k of Object.keys(THEMES)) DEFAULT_SEED[k] = 1;

export const music = new Music();
