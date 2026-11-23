// COLD BOOT soundtrack — shared pieces: a Song base with quieter manners (no
// automatic crashes or fills unless a theme asks), a melody notation, the
// leitmotif every theme quotes, and the folk instruments (finger-picked guitar,
// tremolo balalaika, accordion/bayan, drones, a tape-warmth insert).
//
// Melody notation (tune()): whitespace-separated tokens, one per note,
//   [b|#]<degree 1-7>[' or , per octave]:<length in 16ths>[flags]   or   r:<len> (rest)
//   flags: ! accent   ? soft   ^ mordent (main, upper neighbour, main)   ~ legato/slide
//   '|' marks a bar line and is checked (every bar must add up to 16 steps).
// Degrees are read in the given mode, so one line can be sung in minor or major.

import { audio } from '../audio.js';
import { Song } from './song.js';
import { Poly } from './inst.js';
import { SCALES, indexNotes, mtof, clamp } from './util.js';

// ---------------------------------------------------------------------------------------
// The leitmotif — "Тихо" (Rybka's theme). Title sings it in D minor with the folk
// raised sixth (B natural) answered by the plain one (B flat); the chase drives it
// with a harmonic-minor leading tone; the credits finally sing it in D major.
export const MOTIF = {
  minor: '1:6 3:2 5:4 4:2 5:2 | #6:4 5:4 4:2 3:2 2:4 | 3:6 2:2 1:4 7,:4 | 1:16 | ' +
    "5:6 7:2 1':4 7:2 5:2 | 6:4 5:4 4:4 3:2 4:2 | 5:6 4:2 3:2^ 2:2 3:2 2:2 | 1:16",
  chase: '1:6 3:2 5:4 4:2 5:2 | #6:4 5:4 4:2 3:2 2:4 | 3:6 2:2 1:4 #7,:4 | 1:12 r:4 | ' +
    "5:6 7:2 1':4 7:2 5:2 | 6:4 5:4 4:4 3:2 4:2 | 5:6 4:2 3:2 2:2 3:2 #7,:2 | 1:12 r:4",
  major: '1:6 3:2 5:4 4:2 5:2 | 6:4 5:4 4:2 3:2 2:4 | 3:6 2:2 1:4 b7,:4 | 1:16 | ' +
    "5:6 b7:2 1':4 b7:2 5:2 | 6:4 5:4 4:4 3:2 4:2 | 5:6 4:2 3:2^ 2:2 3:2 2:2 | 1:16",
};
export const MOTIF_PROG = {
  minor: 'i IV bVI:.75 bVII:.25 i bVIM7 iv v7 i',
  chase: 'i IV bVI:.75 V:.25 i bVIM7 iv V7 i',
  major: 'I IV vi:.75 bVII:.25 I bVIM7 IV V7 I',
};

/**
 * Parse a melody. base = MIDI note of degree 1 (sets the key and octave), mode = a
 * SCALES name, shift = diatonic shift in degrees (a third below: -2).
 * Returns { idx, bars, notes } like util.makeMelody (notes carry m, len, v, orn, up).
 */
export function tune(str, base, mode = 'minor', shift = 0) {
  const sc = SCALES[mode];
  const notes = [];
  let pos = 0;
  const pitch = (d) => { // 0-based degree (may be negative / > 6) → semitones
    const o = Math.floor(d / 7), k = ((d % 7) + 7) % 7;
    return sc[k] + 12 * o;
  };
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') {
      if (pos % 16) throw new Error(`tune: bar ${pos >> 4} is ${pos % 16} steps long in "${str.slice(0, 40)}…"`);
      continue;
    }
    const m = /^([b#]?)([1-7r])([',]*)(?::(\d+))?([!?^~]*)$/.exec(tok);
    if (!m) throw new Error(`tune: bad token ${tok}`);
    const len = m[4] ? +m[4] : 4;
    if (m[2] !== 'r') {
      let oct = 0;
      for (const c of m[3]) oct += c === "'" ? 1 : -1;
      const d = +m[2] - 1 + shift;
      const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
      const midi = base + pitch(d) + acc + 12 * oct;
      const fl = m[5];
      notes.push({
        bar: pos >> 4, s: pos & 15, len, m: midi,
        v: fl.includes('!') ? 1 : fl.includes('?') ? 0.62 : 0.82,
        orn: fl.includes('^'), slide: fl.includes('~'),
        up: pitch(d + 1) - pitch(d) || 2,
      });
    }
    pos += len;
  }
  const bars = Math.max(1, Math.ceil(pos / 16));
  return { idx: indexNotes(notes, bars), bars, notes };
}

// ---------------------------------------------------------------------------------------
// Base song

export class CBSong extends Song {
  static kind = 'cb';
  static intensity = 1;

  constructor(m, id, seed, opts) {
    super(m, id, seed, opts);
    this.iS = this.intensity; // smoothed intensity for continuous parameters
  }

  /** Theme options (set in compose): crash level on section starts, fills, per-beat intensity. */
  get cbo() { return this._cbo || (this._cbo = {}); }
  set cbo(v) { this._cbo = v; }

  _sectionStart(t, first) {
    const ty = this.sec.type, o = this.cbo;
    const hp = this.hpF.frequency, lp = this.lpF.frequency;
    hp.cancelScheduledValues(t);
    lp.cancelScheduledValues(t);
    if (ty === 'build') {
      const dur = this.sec.bars * this.barDur;
      this.riser(t, dur, { level: o.riser ?? 0.07 });
      hp.setValueAtTime(10, t);
      hp.exponentialRampToValueAtTime(this.buildHP, t + dur);
      lp.setTargetAtTime(22000, t, 0.3);
    } else {
      hp.setTargetAtTime(10, t, 0.006);
      if (ty === 'intro' && this.introLP) {
        const dur = this.sec.bars * this.barDur;
        lp.setValueAtTime(this.introLP, t);
        lp.exponentialRampToValueAtTime(20000, t + dur);
      } else if (ty === 'break' && this.breakLP) lp.setTargetAtTime(this.breakLP, t, 0.4);
      else lp.setTargetAtTime(22000, t, 0.05);
      if (!first && o.crash && this.sec.crash !== false && (ty === 'A' || ty === 'B' || ty === 'drop' || this.sec.crash)) {
        this.hit('crash', t, o.crash * (ty === 'drop' ? 1.15 : 1));
        if (ty === 'drop') this.hit('impact', t, 0.45);
      }
    }
    this.onSection(t, first);
  }

  onSection() {}

  _planFill(t) { if (this.cbo.fills) super._planFill(t); }

  _advance() {
    const c0 = this.cycle || 0;
    super._advance();
    if ((this.cycle || 0) !== c0) {
      this.onCycle(this.cycle);
      this.sec = this.form[this.secIdx];
    }
  }

  onCycle() {}

  _step(s, t) {
    if (this.mode === 'normal' && this.cbo.beatIntensity && s && (s & 3) === 0 && Math.abs(this.targetIntensity - this.intensity) > 0.004) {
      const prev = this.intensity;
      this.intensity = this.targetIntensity;
      this._applyLayers(t);
      this.onIntensity(prev, this.intensity, t);
    }
    this.iS += (this.intensity - this.iS) * (this.cbo.iSmooth ?? 0.12);
    super._step(s, t);
  }

  _bar(t) {
    const prev = this.intensity;
    super._bar(t);
    if (Math.abs(prev - this.intensity) > 0.004) this.onIntensity(prev, this.intensity, t);
  }

  onIntensity() {}

  /** Play a tune() melody at step s (ornaments: mordent → three quick notes). */
  tunePlay(inst, tn, s, t, o = {}) {
    if (!tn) return null;
    const k = (((this.barInSec + (o.barOffset || 0)) % tn.bars) + tn.bars) % tn.bars * 16 + s;
    const nt = tn.idx[k];
    if (!nt) return null;
    const T = this.sw(s, t);
    const len = nt.len * this.stepDur;
    const vel = (o.vel ?? 0.8) * nt.v;
    const m = nt.m + (o.oct ?? 0) * 12;
    const gate = o.gate ?? 0.92;
    const legato = (nt.slide || o.legato) && inst._lastEnd != null && Math.abs(T - inst._lastEnd) < this.stepDur * 0.7;
    inst._lastEnd = T + len;
    if (nt.orn && o.orn !== false && len > this.stepDur * 1.5) {
      const g = Math.min(0.07, this.stepDur * 0.33);
      inst.note(T, m, g, vel * 0.85, { atk: 0.004, noTrem: true, slide: legato });
      inst.note(T + g, m + nt.up, g, vel * 0.75, { atk: 0.004, noTrem: true, slide: true });
      inst.note(T + 2 * g, m, Math.max(g, len * gate - 2 * g), vel, { slide: true });
    } else {
      inst.note(T, m, len * gate, vel, { slide: legato });
    }
    return nt;
  }

  /** Pedal ostinato: pattern chars r b t 4 f s o (root, b2, b3, 4th, 5th, b7, octave), '-' holds. */
  ostinato(inst, pat, s, t, root, o = {}) {
    const n = pat.length, i = (this.barInSec * 16 + s) % n, c = pat[i];
    if (c === '.' || c === '-') return;
    let len = 1;
    while (len < n && pat[(i + len) % n] === '-') len++;
    const OFF = { r: 0, b: 1, t: 3, 4: 5, f: 7, s: 10, o: 12, l: -12, n: 8 };
    const lc = c.toLowerCase();
    const acc = c !== lc;
    inst.note(o.noSwing ? t : this.sw(s, t), root + (OFF[lc] ?? 0), len * this.stepDur * (o.gate ?? 0.85),
      (o.vel ?? 0.8) * (acc ? 1 : 0.84), { accent: acc, ...(o.nopts || null) });
  }

  /** Tape warmth: wow + flutter (modulated delay), soft saturation, head bump, top roll-off, hiss. */
  tapeFx(o = {}) {
    const d = this.delayNode(0.012, 0.05);
    this.lfo(o.wow ?? 0.43, o.wowDepth ?? 0.00045, d.delayTime);
    this.lfo(o.flutter ?? 6.7, o.flutterDepth ?? 0.00002, d.delayTime, 'triangle');
    const k = o.drive ?? 1.35;
    const curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = (i / 2047) * 2 - 1; curve[i] = Math.tanh(k * x) / k; }
    const sh = this.shaper(curve, '2x');
    const bump = this.filter('peaking', 95, 0.9, null, o.bump ?? 1.5);
    const lp = this.filter('lowpass', o.lp ?? 10500, 0.55);
    this.post.disconnect();
    this.post.connect(d); d.connect(sh); sh.connect(bump); bump.connect(lp); lp.connect(this.hpF);
    if (o.hiss) this.bed(audio.noise('pink'), 'fx', o.hiss, [['highpass', 2800, 0.5], ['lowpass', 10000, 0.5]]);
  }
}

// ---------------------------------------------------------------------------------------
// Instruments

/**
 * Karplus–Strong plucked strings with a tone filter: 'folk' guitar or 'bala'(laika).
 * With o.trem (plucks per second) notes longer than o.tremMin seconds are tremolo-picked
 * (alternating down/up strokes, each re-exciting the string) the way balalaikas and
 * domras sustain a melody.
 */
export class Plucker {
  constructor(song, layer, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.o = { variant: 'folk', level: 0.5, lp: 0, hp: 0, pan: 0, trem: 0, tremMin: 0.3, rel: 0.05, ...opts };
    this.bus = song.gain(this.o.level);
    let last = this.bus;
    if (this.o.lp) { const f = song.filter('lowpass', this.o.lp, 0.6); last.connect(f); last = f; }
    if (this.o.hp) { const f = song.filter('highpass', this.o.hp, 0.6); last.connect(f); last = f; }
    last.connect(song.dest(layer, this.o.pan));
  }

  _pluck(t, m, dur, vel) {
    const ctx = this.s.ctx;
    const buf = this.s.B.ks(this.o.variant, m);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + dur, this.o.rel);
    src.connect(g);
    g.connect(this.bus);
    src.start(t);
    const end = Math.min(t + buf.duration, t + dur + this.o.rel * 6 + 0.02);
    src.stop(end);
    this.s.track(src, g, t, end);
  }

  note(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    if (this.s.recent.length > 230) return;
    const m = Math.round(midi + this.s.transpose);
    const rate = o.trem ?? this.o.trem;
    if (rate && dur >= this.o.tremMin && !o.noTrem) {
      const step = 1 / rate;
      const n = Math.max(2, Math.round(dur / step));
      const hr = this.s.hr;
      for (let i = 0; i < n; i++) {
        const tt = t + i * step + (i ? (hr.next() - 0.5) * step * 0.16 : 0);
        const v = vel * (i & 1 ? 0.7 : 0.86) * (i === 0 ? 1.15 : 1) * (0.9 + 0.2 * hr.next());
        const last = i === n - 1;
        this._pluck(tt, m, last ? Math.max(step, dur - i * step) : step * 1.1, v);
      }
    } else this._pluck(t, m, dur, vel);
  }

  chord(t, notes, dur, vel = 0.7, spread = 0.018) {
    notes.forEach((m, i) => this.note(t + i * spread, m, dur, vel * (i ? 0.85 : 1), { noTrem: true }));
  }
}

/** Accordion / bayan: 'reed' multisample loops with a slow bellows swell on the level. */
export class Accordion extends Poly {
  constructor(song, layer, opts = {}) {
    super(song, layer, 'reed', { level: 0.3, atk: 0.06, rel: 0.2, cut: 3200, ...opts });
    const depth = opts.bellows ?? 0.07;
    if (depth) song.lfo(opts.bellowsRate ?? 0.19, depth, this.bus.gain);
  }
}

/** Sustained drone: two detuned saws and a sub triangle through a slowly breathing lowpass. */
export class Drone {
  constructor(song, layer, opts = {}) {
    const ctx = song.ctx;
    this.s = song;
    this.layer = layer;
    this.o = { level: 0.3, cut: 420, q: 0.8, lfoRate: 0.045, lfoDepth: 110, detune: 6, sub: 0.6, atk: 1.2, pan: 0, ...opts };
    this.pitch = song.src(ctx.createConstantSource());
    this.pitch.offset.value = 55;
    this.f = song.filter('lowpass', this.o.cut, this.o.q);
    this.amp = song.gain(0);
    const parts = [['sawtooth', -this.o.detune, 0.5, 1], ['sawtooth', this.o.detune, 0.5, 1], ['triangle', 0, this.o.sub, 0.5]];
    for (const [type, det, g, mul] of parts) {
      const osc = song.src(ctx.createOscillator());
      osc.type = type;
      osc.frequency.value = 0;
      osc.detune.value = det;
      const k = song.gain(mul);
      this.pitch.connect(k);
      k.connect(osc.frequency);
      osc.connect(song.gain(g, this.f));
    }
    this.f.connect(this.amp);
    this.amp.connect(song.dest(layer, this.o.pan));
    if (this.o.lfoDepth) song.lfo(this.o.lfoRate, this.o.lfoDepth, this.f.frequency);
    this.cur = null;
  }

  /** Glide to midi and swell to level (relative to o.level). */
  set(t, midi, level = 1, glide = 0.4) {
    const f = mtof(midi + this.s.transpose);
    const p = this.pitch.offset;
    if (this.cur == null) p.setValueAtTime(f, t);
    else if (Math.abs(f - this.cur) > 0.01) p.setTargetAtTime(f, t, Math.max(0.005, glide / 3));
    this.cur = f;
    this.amp.gain.setTargetAtTime(this.o.level * level, t, this.o.atk / 3);
  }

  cutoff(t, f, tc = 0.3) { this.f.frequency.setTargetAtTime(clamp(f, 40, 18000), t, tc); }
}
