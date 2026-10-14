// Dynamic soundtrack engine: every theme is synthesized live (see music/*).
//
//   decks (one per playing theme, crossfaded) ─┐
//   stingers, nitro swell ─────────────────────┼→ input → tape-stop delay → tone LP + nitro shelf
//                                               → dip → glue compressor → makeup → peak limiter
//                                               → AM-radio tuning (warble delay, band-pass, level)
//                                               → soft clipper → audio.musicBus
//   deck reverb sends → revIn → (tuning level) → audio.reverbSend
//
// The game calls play/stop/update/setIntensity/setRaceState/stinger/setTuning.
// Scheduling runs ahead of the audio clock from update() and a 25 ms interval.

import { audio } from './audio.js';
import { clamp, mtof, hashStr } from './music/util.js';
import { bank, clipCurve, DRUM_NAMES, MS_KINDS } from './music/render.js';
import { THEMES } from './music/themes.js';

const LOOKAHEAD = 0.2;
const MAKEUP = 1.0;

class Music {
  constructor() {
    this.ctx = null;
    this.deck = null;
    this.decks = [];
    this._want = null;
    this._race = {};
    this._kindInt = {};
    this._tuning = 0;
    this._timer = null;
    this._toneF = 22000;
    this._toneHold = 0;
    this._nitroOn = false;
    this._lastCrash = -9;
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
    this._swell = null;
    this.ctx = ctx;
    this._offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    this._buildChain();
    if (!this._offline && !this._timer && typeof setInterval !== 'undefined') {
      this._timer = setInterval(() => this._tick(), 25);
    }
    this.setTuning(this._tuning, true);
    if (this._want) {
      const w = this._want;
      this._start(w.theme, w.seed, w.fade, w.intensity);
    }
    if (!this._offline) this._prewarm();
  }

  /** Render the shared drum kit and common synth multisamples in idle time. */
  _prewarm() {
    const B = bank(this.ctx);
    const q = (this._warmQ = []);
    for (const n of DRUM_NAMES()) q.push(() => B.get(n));
    const ranges = {
      pad: [50, 78], strings: [55, 84], saw: [57, 90], choir: [62, 84], piano: [55, 84], stab: [55, 79],
      pluck: [62, 88], brass: [50, 80], organ: [58, 77], bell: [69, 90], square: [66, 96], mallet: [67, 84], saw3: [55, 76],
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
    this.out = G(1, audio.musicBus);
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
    this.makeup = G(MAKEUP, this.lim);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 2.5;
    this.comp.attack.value = 0.01;
    this.comp.release.value = 0.2;
    this.comp.connect(this.makeup);
    this.dip = G(1, this.comp);
    this.shelf = F('highshelf', 5200, 0, this.dip, 0);
    this.tone = F('lowpass', 22000, 0, this.shelf);
    this.tapeDry = G(1, this.tone);
    this.tapeWet = G(0, this.tone);
    this.tape = ctx.createDelay(1);
    this.tape.delayTime.value = 0.004;
    this.tape.connect(this.tapeWet);
    this.input = G(1);
    this.input.connect(this.tapeDry);
    this.input.connect(this.tape);
    this.revIn = G(1);
    this.revLevel = G(1, audio.reverbSend);
    this.revIn.connect(this.revLevel);
    this.sting = G(0.9, this.input);
    this._toneF = 22000;
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
    if (this.deck && this.deck.id !== theme) {
      // new song: forget transient race flags left over from the previous one
      for (const k of ['finalLap', 'finished', 'nitro', 'airborne', 'crashed']) delete this._race[k];
      if (this._nitroOn) this._setNitro(false, true);
    }
    if (this.deck) this.deck.retire(fade);
    // radio-style rapid switching: keep at most two fading decks
    const dying = this.decks.filter((d) => d.dying && !d.dead);
    while (dying.length > 2) dying.shift().retire(0.03);
    const s = seed == null ? DEFAULT_SEED[theme] ?? hashStr(theme) : seedOf(seed);
    if (intensity == null && this._pendingInt != null) intensity = this._pendingInt;
    this._pendingInt = null;
    if (intensity != null) this._kindInt[cls.kind] = intensity;
    const d = new cls(this, theme, s, {
      intensity: intensity ?? this._kindInt[cls.kind] ?? cls.intensity,
      race: this._race,
    });
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
      d.targetIntensity = x;
    } else if (this._want) {
      this._want.intensity = x;
    } else {
      this._pendingInt = x; // applies to the next play() without an explicit intensity
    }
  }

  setRaceState(s) {
    if (!s) return;
    const r = this._race;
    const d = this.deck && !this.deck.dying ? this.deck : null;
    if ('countdown' in s && !!s.countdown !== !!r.countdown) {
      r.countdown = !!s.countdown;
      d?.countdown(r.countdown);
    }
    if ('position' in s && s.position !== r.position) {
      r.position = s.position;
      d?.setLeading(s.position == null || s.position <= 1);
    }
    for (const k of ['cars', 'lap', 'laps']) if (k in s) r[k] = s[k];
    if ('finalLap' in s && !!s.finalLap !== !!r.finalLap) {
      r.finalLap = !!s.finalLap;
      if (r.finalLap) d?.finalLap();
    }
    if ('nitro' in s && !!s.nitro !== !!r.nitro) {
      r.nitro = !!s.nitro;
      if (this.ctx) this._setNitro(r.nitro);
    }
    if ('airborne' in s && !!s.airborne !== !!r.airborne) {
      r.airborne = !!s.airborne;
      d?.airborne(r.airborne);
    }
    if ('crashed' in s && !!s.crashed !== !!r.crashed) {
      r.crashed = !!s.crashed;
      if (r.crashed && this.ctx) this._tapeStop();
    }
    if ('finished' in s && !!s.finished !== !!r.finished) {
      r.finished = !!s.finished;
      if (r.finished) d?.finish();
    }
    if ('speed' in s) {
      r.speed = s.speed;
      if (this.ctx) this._updateTone();
    }
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

  // ---- race-state effects --------------------------------------------------------------------
  _toneBase() {
    const now = this.ctx.currentTime;
    if (this._nitroOn || now < this._toneHold) return 22000;
    const d = this.deck;
    if (!d || d.kind !== 'race' || this._race.speed == null) return 22000;
    const s = clamp(+this._race.speed || 0, 0, 1);
    return Math.min(22000, 7500 + 14500 * Math.pow(s, 0.8));
  }

  _updateTone(force) {
    const f = this._toneBase();
    if (!force && Math.abs(f - this._toneF) / this._toneF < 0.04) return;
    this._toneF = f;
    const t = this.ctx.currentTime;
    this.tone.frequency.cancelScheduledValues(t);
    this.tone.frequency.setTargetAtTime(f, t, 0.18);
  }

  _setNitro(on, quiet) {
    const ctx = this.ctx, now = ctx.currentTime;
    const d = this.deck;
    this._nitroOn = on;
    const tf = this.tone.frequency, sh = this.shelf.gain;
    tf.cancelScheduledValues(now);
    sh.cancelScheduledValues(now);
    if (on) {
      tf.setTargetAtTime(22000, now, 0.03);
      sh.setTargetAtTime(3.5, now, 0.06);
      this._toneF = 22000;
      if (d) { d.leadBus.gain.cancelScheduledValues(now); d.leadBus.gain.setTargetAtTime(1.45, now, 0.08); }
      if (!this._swell) {
        const src = ctx.createBufferSource();
        src.buffer = audio.noise('white');
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.9;
        bp.frequency.setValueAtTime(700, now);
        bp.frequency.setTargetAtTime(6500, now, 0.55);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.setTargetAtTime(0.055, now, 0.15);
        g.gain.setTargetAtTime(0.028, now + 1.2, 0.9);
        src.connect(bp); bp.connect(g); g.connect(this.input);
        src.start(now, Math.random());
        this._swell = { src, bp, g };
      }
    } else {
      this._toneF = this._toneBase();
      tf.setTargetAtTime(this._toneF, now, 0.25);
      sh.setTargetAtTime(0, now, 0.15);
      if (d) { d.leadBus.gain.cancelScheduledValues(now); d.leadBus.gain.setTargetAtTime(1, now, 0.2); }
      if (this._swell) {
        const { src, bp, g } = this._swell;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, 0.07);
        src.stop(now + 0.5);
        src.onended = () => { try { bp.disconnect(); g.disconnect(); } catch { /* */ } };
        this._swell = null;
      }
      if (!quiet) { // slight dip as the boost ends
        const dg = this.dip.gain;
        dg.cancelScheduledValues(now);
        dg.setTargetAtTime(0.72, now, 0.02);
        dg.setTargetAtTime(1, now + 0.12, 0.22);
      }
    }
  }

  _tapeStop() {
    const now = this.ctx.currentTime;
    if (now - this._lastCrash < 0.6) return;
    this._lastCrash = now;
    const t = now + 0.005, T = 0.3;
    const curve = new Float32Array(32);
    for (let i = 0; i < 32; i++) curve[i] = 0.004 + 0.096 * Math.pow(i / 31, 2.5); // pitch → ~0.2x
    const dt = this.tape.delayTime;
    dt.cancelScheduledValues(t);
    try { dt.setValueCurveAtTime(curve, t, T); } catch { dt.setValueAtTime(0.004, t); }
    dt.setValueAtTime(0.004, t + T + 0.15);
    const w = this.tapeWet.gain, dr = this.tapeDry.gain;
    w.cancelScheduledValues(t); dr.cancelScheduledValues(t);
    w.setTargetAtTime(1, t, 0.004); dr.setTargetAtTime(0, t, 0.004);
    w.setTargetAtTime(0, t + T, 0.014); dr.setTargetAtTime(1, t + T, 0.014);
    const tf = this.tone.frequency;
    tf.cancelScheduledValues(t);
    tf.setTargetAtTime(450, t, 0.08);
    tf.setTargetAtTime(this._toneBase(), t + T, 0.12);
  }

  // ---- stingers --------------------------------------------------------------------------------
  stinger(name) {
    if (!this._ensure()) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const d = this.deck && !this.deck.dying ? this.deck : null;
    const q = d ? d.nextStepTime(now + 0.004) : now + 0.02;
    const pc = d ? (((d.keyPc + d.transpose) % 12) + 12) % 12 : 9;
    const root = 48 + pc - (pc > 7 ? 12 : 0); // tonic in octave 3 (E2..G3)
    const minor = d ? !['major', 'mixolydian'].includes(d.scale) : true;
    const third = minor ? 3 : 4;
    const step = d ? d.stepDur : 0.09;
    switch (name) {
      case 'go':
        if (d && d.kind === 'race') {
          d.go();
          this._toneHold = now + 4;
          this._updateTone(true);
          this._schedule();
        } else {
          this._hit('impact', q, 0.9);
          this._hit('crash', q, 0.7, -0.3);
          this._chord('brass', q, root + 12, [0, third, 7, 12], 0.4, 0.5);
        }
        break;
      case 'lap':
        this._hit('crash', q, 0.55, 0.25);
        this._chord('stab', q, root + 12, [0, 7, 12, 12 + third], 0.22, 0.4);
        this._note('bell', q, root + 24, 0.6, 0.25);
        this._note('bell', q + step * 2, root + 31, 0.6, 0.2);
        break;
      case 'finalLap':
        d?.finalLap();
        this._hit('up', q, 0.5);
        this._chord('choir', q, root + 12, [0, 7, 12, 12 + third, 19], 1.8, 0.22, { atk: 0.5, rel: 0.6 });
        this._hit('snare_rock', q, 0.5);
        this._hit('snare_rock', q + step, 0.7);
        break;
      case 'win': {
        // triumphant: major tonic (picardy third in minor keys), brass fanfare + crash
        const r = root + 12;
        this._hit('crash', q, 0.8, -0.3);
        this._hit('crash2', q + 0.01, 0.6, 0.3);
        this._hit('impact', q, 0.55);
        [0, 4, 7, 12].forEach((iv, i) => {
          this._note('brass', q + i * step * 2, r + iv, 0.18 + (i === 3 ? 1.6 : 0), 0.42);
          this._note('saw', q + i * step * 2, r + iv + 12, 0.18 + (i === 3 ? 1.6 : 0), 0.12, { rel: 0.5 });
        });
        const th = q + step * 6;
        this._chord('brass', th, r, [-12, 0, 4, 7, 12], 1.7, 0.32, { rel: 0.6 });
        this._chord('saw', th, r, [4, 7, 12, 16], 1.7, 0.1, { rel: 0.7, atk: 0.02 });
        this._note('bell', th + step * 2, r + 24, 1, 0.25);
        this._note('bell', th + step * 3, r + 28, 1, 0.2);
        this._note('bell', th + step * 4, r + 31, 1.2, 0.2);
        break;
      }
      case 'lose': {
        const r = root;
        this._hit('boom', q, 0.4);
        this._chord('pad', q, r + 12, [0, 3, 7, 10], 2.4, 0.17, { atk: 0.15, rel: 1.2, cut: 1400 });
        [7, 3, 0].forEach((iv, i) => this._note('mallet', q + i * step * 4, r + 24 + iv, 1.2, 0.3));
        this._note('piano', q + step * 12, r + 12, 2, 0.28);
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
      case 'boss': {
        const r = root - 12;
        this._hit('impact', q, 1);
        this._hit('china', q, 0.6, 0.2);
        this._hit('clank', q + step * 2, 0.5, -0.4);
        this._chord('brass', q, r + 12, [0, 1, 7, 12], 1.6, 0.4, { rel: 0.5 });
        this._siren(q + step * 4, root + 24, 1.6);
        break;
      }
      default:
        break;
    }
  }

  _hit(name, t, vel, pan = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = bank(ctx).get(name);
    const g = ctx.createGain();
    g.gain.value = vel;
    let last = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
    src.connect(g); last.connect(this.sting);
    src.start(Math.max(t, ctx.currentTime));
    src.onended = () => { try { last.disconnect(); g.disconnect(); } catch { /* */ } };
  }

  _note(kind, t, midi, dur, vel, o = {}) {
    const ctx = this.ctx;
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

  _siren(t, midi, dur) {
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'square'; o2.type = 'sawtooth';
    const f0 = mtof(midi), f1 = mtof(midi + 5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f0 * 2; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(0.12, t, 0.01);
    g.gain.setTargetAtTime(0, t + dur, 0.08);
    const half = 0.19;
    for (let i = 0, tt = t; tt < t + dur; i++, tt += half) {
      const f = i % 2 ? f1 : f0;
      o1.frequency.setTargetAtTime(f, tt, 0.012);
      o2.frequency.setTargetAtTime(f * 1.005, tt, 0.012);
    }
    o1.frequency.value = f0; o2.frequency.value = f0;
    o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(this.sting);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.5); o2.stop(t + dur + 0.5);
    o1.onended = () => { try { bp.disconnect(); g.disconnect(); } catch { /* */ } };
  }
}

const seedOf = (s) => (typeof s === 'number' && Number.isFinite(s) ? Math.floor(s) >>> 0 : hashStr(String(s)));

// default seeds: each radio station always plays "its" song
const DEFAULT_SEED = {
  nitro: 1, underground: 1, records: 1, talk: 1, showroom: 1,
  race_city: 1, race_circuit: 1, race_mountain: 1, race_desert: 1, race_docks: 1, race_highway: 1, race_boss: 1,
  results_win: 1, results_lose: 1,
};

export const music = new Music();
