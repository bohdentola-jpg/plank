// Live instruments. Long-lived voices (mono synths, leads) reuse their nodes
// and are played purely with AudioParam automation; polyphonic voices are
// per-note buffer sources (pre-rendered multisamples / KS strings) or small
// FM pairs. Every note honours the song's transpose (final-lap key lift) and
// its layer gate.

import { audio } from '../audio.js';
import { mtof } from './util.js';
import { driveCurve } from './render.js';

const MONO = {
  oscs: [{ type: 'sawtooth' }], ftype: 'lowpass', cut: 800, q: 2, poles: 2, env: 1200, fatk: 0.003, fdec: 0.12,
  keytrack: 0, atk: 0.004, dec: 0.25, sus: 0.8, rel: 0.04, glide: 0.035, level: 0.5, accent: 1.35,
  drive: 0, asym: 0, post: 0, sub: 0, subMul: 0.5, pan: 0,
};

/** Monophonic synth: one pitch control drives every oscillator (slides are free). */
export class Mono {
  constructor(song, layer, opts = {}) {
    const o = (this.o = { ...MONO, ...opts });
    const ctx = song.ctx;
    this.s = song;
    this.layer = layer;
    this.pitch = song.src(ctx.createConstantSource());
    this.pitch.offset.value = 110;
    this.amp = song.gain(0);
    this.f1 = song.filter(o.ftype, o.cut, o.q);
    let last = this.f1;
    if (o.poles === 4) {
      this.f2 = song.filter(o.ftype, o.cut * 1.1, 0);
      this.f1.connect(this.f2);
      last = this.f2;
    }
    if (o.keytrack) {
      const kt = song.gain(o.keytrack);
      this.pitch.connect(kt);
      kt.connect(this.f1.frequency);
      if (this.f2) kt.connect(this.f2.frequency);
    }
    for (const oc of o.oscs) {
      const osc = song.src(ctx.createOscillator());
      osc.type = oc.type || 'sawtooth';
      osc.frequency.value = 0;
      osc.detune.value = oc.detune || 0;
      const mul = song.gain(oc.mul || 1);
      this.pitch.connect(mul);
      mul.connect(osc.frequency);
      const g = song.gain(oc.gain ?? 0.5);
      osc.connect(g);
      if (oc.pan) g.connect(song.panner(oc.pan, this.f1));
      else g.connect(this.f1);
    }
    if (o.drive) {
      const sh = song.shaper(driveCurve(o.drive, o.asym), '2x');
      last.connect(sh);
      last = sh;
      if (o.post) { const pl = song.filter('lowpass', o.post, 0); last.connect(pl); last = pl; }
    }
    if (o.hp) { const h = song.filter('highpass', o.hp, 0); last.connect(h); last = h; }
    if (o.formant) { // parallel band-passes (talking / growl)
      this.forms = o.formant.map(([f, q, g]) => {
        const bp = song.filter('bandpass', f, q);
        const gg = song.gain(g);
        last.connect(bp); bp.connect(gg); gg.connect(this.amp);
        return bp;
      });
      if (o.formDry) last.connect(song.gain(o.formDry, this.amp));
    } else last.connect(this.amp);
    if (o.sub) {
      const sub = song.src(ctx.createOscillator());
      sub.type = 'sine';
      sub.frequency.value = 0;
      const m = song.gain(o.subMul);
      this.pitch.connect(m);
      m.connect(sub.frequency);
      sub.connect(song.gain(o.sub, this.amp));
    }
    this.amp.connect(song.dest(layer, o.pan));
    if (o.lfo) this.lfo = song.lfo(o.lfo.rate, o.lfo.depth, this.f1.frequency, o.lfo.type);
    this.last = -1;
    song.monos.push(this);
  }

  /** o: { slide, accent, cut (filter base override), force } */
  note(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    const O = this.o;
    const f = mtof(midi + this.s.transpose);
    const p = this.pitch.offset;
    p.cancelScheduledValues(t);
    if (o.slide && this.last > 0) {
      p.setValueAtTime(this.last, t);
      p.exponentialRampToValueAtTime(f, t + O.glide);
    } else p.setValueAtTime(f, t);
    this.last = f;
    const acc = o.accent ? O.accent : 1;
    if (O.env) {
      const base = o.cut ?? O.cut;
      for (const flt of this.f2 ? [this.f1, this.f2] : [this.f1]) {
        const fq = flt.frequency;
        const k = flt === this.f2 ? 1.1 : 1;
        fq.cancelScheduledValues(t);
        if (!o.slide || O.envSlide) {
          fq.setTargetAtTime((base + O.env * vel * acc) * k, t, O.fatk);
          fq.setTargetAtTime(base * k, t + O.fatk * 3, O.fdec * (o.accent ? 0.7 : 1));
        } else fq.setTargetAtTime(base * k, t, O.fdec);
      }
    }
    if (this.forms && o.vowel) {
      o.vowel.forEach((fr, i) => {
        const fq = this.forms[i]?.frequency;
        if (!fq) return;
        fq.cancelScheduledValues(t);
        fq.setTargetAtTime(fr[0], t, 0.01);
        if (fr[1]) fq.setTargetAtTime(fr[1], t + 0.05, dur * 0.35);
      });
    }
    const a = this.amp.gain;
    a.cancelScheduledValues(t);
    const lvl = vel * acc * O.level;
    a.setTargetAtTime(lvl, t, o.slide ? 0.012 : O.atk);
    if (O.sus < 1) a.setTargetAtTime(lvl * O.sus, t + O.atk * 3 + 0.004, O.dec);
    a.setTargetAtTime(0, t + dur, O.rel);
  }

  cut(t) {
    for (const prm of [this.amp.gain, this.pitch.offset, this.f1.frequency]) prm.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.008);
  }
}

/** Two-operator FM electric piano (plus a fast-decaying tine modulator), velocity-sensitive index. */
export class Rhodes {
  constructor(song, layer, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.o = { level: 0.22, tone: 5200, trem: 0.35, tremRate: 4.2, bright: 1, drive: 0, ...opts };
    this.bus = song.gain(1);
    const lp = song.filter('lowpass', this.o.tone, 0);
    const pan = song.panner(0);
    this.bus.connect(lp);
    let last = lp;
    if (this.o.drive) { const sh = song.shaper(driveCurve(this.o.drive), '2x'); last.connect(sh); last = sh; }
    last.connect(pan);
    pan.connect(song.dest(layer));
    if (this.o.trem) song.lfo(this.o.tremRate, this.o.trem, pan.pan);
  }

  note(t, midi, dur, vel = 0.7, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    if (this.s.recent.length > 230) return;
    const ctx = this.s.ctx;
    const m = midi + this.s.transpose;
    const f = mtof(m);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), tine = ctx.createOscillator();
    car.frequency.value = f;
    mod.frequency.value = f * 1.0007;
    tine.frequency.value = f * 14;
    const mg = ctx.createGain(), tg = ctx.createGain(), amp = ctx.createGain();
    const v = Math.min(1, vel);
    const b = this.o.bright;
    mg.gain.setValueAtTime(f * (0.5 + 2.4 * v * v) * b, t);
    mg.gain.setTargetAtTime(f * 0.22 * b, t + 0.004, 0.18 + 0.35 * (1 - v));
    tg.gain.setValueAtTime(f * 14 * 0.09 * v * b, t);
    tg.gain.setTargetAtTime(0, t, 0.012);
    mod.connect(mg); mg.connect(car.frequency);
    tine.connect(tg); tg.connect(car.frequency);
    const keyComp = Math.pow(2, -(m - 60) / 30);
    const lvl = this.o.level * (0.3 + 0.7 * v) * keyComp;
    const decay = 1.5 * Math.pow(2, -(m - 60) / 20);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(lvl, t + 0.003);
    amp.gain.setTargetAtTime(0, t + 0.004, decay);
    amp.gain.setTargetAtTime(0, t + dur, 0.07);
    car.connect(amp);
    amp.connect(this.bus);
    const end = t + dur + 0.45;
    for (const os of [car, mod, tine]) { os.start(t); os.stop(end); }
    this.s.track(car, amp, t, end);
  }

  chord(t, notes, dur, vel = 0.7, spread = 0.012) {
    notes.forEach((m, i) => this.note(t + i * spread * this.s.hr.next(), m, dur, vel * (0.9 + 0.2 * this.s.hr.next())));
  }
}

/** Multisample player (looped pads / one-shot piano, brass, plucks...). */
export class Poly {
  constructor(song, layer, kind, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.kind = kind;
    this.o = { level: 0.5, atk: 0.004, rel: 0.15, cut: 0, q: 0, hp: 0, pan: 0, oct: 0, ...opts };
    this.bus = song.gain(1);
    let last = this.bus;
    if (this.o.drive) { const sh = song.shaper(driveCurve(this.o.drive), '2x'); last.connect(sh); last = sh; }
    if (this.o.cut) {
      this.filt = song.filter('lowpass', this.o.cut, this.o.q);
      last.connect(this.filt);
      last = this.filt;
      if (this.o.lfo) song.lfo(this.o.lfo.rate, this.o.lfo.depth, this.filt.frequency);
    }
    if (this.o.hp) { const h = song.filter('highpass', this.o.hp, 0); last.connect(h); last = h; }
    if (this.o.out) { const g = song.gain(this.o.out); last.connect(g); last = g; }
    last.connect(this.o.dest || song.dest(layer, this.o.pan));
  }

  note(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return null;
    if (this.s.recent.length > 240) return null;
    const ctx = this.s.ctx;
    const m = midi + this.s.transpose + this.o.oct * 12;
    const { buf, rate, loop } = this.s.B.ms(this.kind, m);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    if (o.bend) { // slide up into the note from `bend` semitones below
      src.playbackRate.setValueAtTime(rate * Math.pow(2, -o.bend / 12), t);
      src.playbackRate.exponentialRampToValueAtTime(rate, t + (o.bendT || 0.06));
    }
    if (loop) src.loop = true;
    const g = ctx.createGain();
    const lvl = vel * this.o.level * (o.gain ?? 1);
    const atk = o.atk ?? this.o.atk, rel = o.rel ?? this.o.rel;
    g.gain.setValueAtTime(0, t);
    if (atk <= 0.006) g.gain.linearRampToValueAtTime(lvl, t + Math.max(0.002, atk));
    else g.gain.setTargetAtTime(lvl, t, atk / 3);
    g.gain.setTargetAtTime(0, t + dur, Math.max(0.004, rel / 3.5));
    src.connect(g);
    g.connect(o.dest || this.bus);
    const off = loop ? this.s.hr.next() * buf.duration * 0.9 : 0;
    src.start(t, off);
    let stop = t + dur + rel * 1.6 + 0.02;
    if (!loop) stop = Math.min(stop, t + (buf.duration - off) / rate);
    src.stop(stop);
    this.s.track(src, g, t, stop);
    return g;
  }

  chord(t, notes, dur, vel = 0.8, o = {}) {
    for (const m of notes) this.note(t, m, dur, vel, o);
  }
}

/** Distorted electric guitar: KS power chords → oversampled drive → cab EQ, double-tracked L/R. */
export class Guitar {
  constructor(song, layer, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.o = { level: 0.5, drive: 24, spread: 0.8, dbl: true, tone: 4800, mid: 4, scoop: -3, ...opts };
    this.sides = [];
    for (const sd of this.o.dbl ? [-1, 1] : [0]) {
      const inp = song.gain(1);
      const sh = song.shaper(driveCurve(this.o.drive, 0.06), '4x');
      const hp = song.filter('highpass', 90, 0);
      const scoop = song.filter('peaking', 430, 1.1, null, this.o.scoop);
      const mid = song.filter('peaking', 1500, 0.9, null, this.o.mid);
      const lp = song.filter('lowpass', this.o.tone * (sd > 0 ? 1.08 : 1), 0);
      const lp2 = song.filter('lowpass', this.o.tone * 1.3, -2);
      const out = song.gain(this.o.level);
      inp.connect(sh); sh.connect(hp); hp.connect(scoop); scoop.connect(mid); mid.connect(lp); lp.connect(lp2); lp2.connect(out);
      out.connect(song.dest(layer, sd * this.o.spread));
      this.sides.push(inp);
    }
  }

  /** o: { mute, note (single string), dur, vel } */
  play(t, root, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    if (this.s.recent.length > 230) return;
    const ctx = this.s.ctx;
    const m = root + this.s.transpose;
    const variant = o.note ? (o.mute ? 'mute' : 'gtr') : (o.mute ? 'powm' : 'pow');
    const vel = o.vel ?? 0.9;
    const dur = o.dur ?? (o.mute ? 0.2 : 1.2);
    this.sides.forEach((inp, i) => {
      const buf = this.s.B.ks(variant, m); // one take; drive, detune and timing make the double
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (i) src.playbackRate.value = 1.0018; // a few cents apart: natural double-track
      const g = ctx.createGain();
      const tt = t + (i ? 0.011 + this.s.hr.next() * 0.006 : this.s.hr.next() * 0.003);
      g.gain.setValueAtTime(vel, tt);
      g.gain.setTargetAtTime(0, tt + dur, o.mute ? 0.02 : 0.06);
      src.connect(g);
      g.connect(inp);
      src.start(tt);
      const end = Math.min(tt + buf.duration, tt + dur + 0.4);
      src.stop(end);
      this.s.track(src, g, tt, end);
    });
  }
}

/** Clean twangy baritone guitar: KS (bridge pickup) → tremolo → spring-ish reverb. */
export class Twang {
  constructor(song, layer, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.o = { level: 0.45, trem: 0.25, tremRate: 5.5, spring: 0.32, ...opts };
    const out = song.gain(1, song.dest(layer, this.o.pan || 0));
    this.bus = song.gain(this.o.level);
    const trem = song.gain(1 - this.o.trem / 2);
    song.lfo(this.o.tremRate, this.o.trem / 2, trem.gain);
    const tone = song.filter('peaking', 2400, 1, null, 3);
    this.bus.connect(tone); tone.connect(trem); trem.connect(out);
    // spring: two short resonant feedback delays with a wobbling read head
    const wet = song.gain(this.o.spring, out);
    for (const [dt, bpF, fbv] of [[0.033, 1900, 0.62], [0.047, 2700, 0.55]]) {
      const d = song.delayNode(dt, 0.2);
      const bp = song.filter('bandpass', bpF, 0.8);
      const fb = song.gain(fbv);
      trem.connect(d); d.connect(bp); bp.connect(fb); fb.connect(d); bp.connect(wet);
      song.lfo(0.9 + dt * 10, 0.0007, d.delayTime);
    }
  }

  play(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    const ctx = this.s.ctx;
    const buf = this.s.B.ks('twang', midi + this.s.transpose);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (o.slide) {
      src.playbackRate.setValueAtTime(Math.pow(2, -o.slide / 12), t);
      src.playbackRate.setTargetAtTime(1, t + 0.01, 0.03);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + dur, 0.08);
    src.connect(g); g.connect(this.bus);
    src.start(t);
    const end = Math.min(t + buf.duration, t + dur + 0.5);
    src.stop(end);
    this.s.track(src, g, t, end);
  }
}

/** KS plucked bass (upright pizzicato). */
export class Pluck {
  constructor(song, layer, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.o = { level: 0.6, variant: 'upright', ...opts };
    this.bus = song.gain(this.o.level, song.dest(layer));
  }

  note(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    const ctx = this.s.ctx;
    const buf = this.s.B.ks(this.o.variant, midi + this.s.transpose);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + dur, 0.06);
    src.connect(g); g.connect(this.bus);
    src.start(t);
    const end = Math.min(t + buf.duration, t + dur + 0.35);
    src.stop(end);
    this.s.track(src, g, t, end);
  }
}

/** Breathy mono lead (flute / muted horn / whistle): delayed vibrato + breath noise, legato glides. */
export class Breath {
  constructor(song, layer, opts = {}) {
    const ctx = song.ctx;
    this.s = song;
    this.layer = layer;
    this.o = { wave: 'triangle', level: 0.3, lp: 3000, vib: 20, vibRate: 5.3, breath: 0.22, glide: 0.05, atk: 0.05, rel: 0.12, ...opts };
    const out = song.dest(layer, this.o.pan || 0);
    this.pitch = song.src(ctx.createConstantSource());
    this.pitch.offset.value = 440;
    const osc = song.src(ctx.createOscillator());
    osc.type = this.o.wave;
    osc.frequency.value = 0;
    this.pitch.connect(osc.frequency);
    const lp = song.filter('lowpass', this.o.lp, 0);
    this.amp = song.gain(0, out);
    osc.connect(lp); lp.connect(this.amp);
    if (this.o.wave2) { // a quiet second partial for a reedier tone
      const o2 = song.src(ctx.createOscillator());
      o2.type = this.o.wave2;
      o2.frequency.value = 0;
      const m2 = song.gain(2);
      this.pitch.connect(m2); m2.connect(o2.frequency);
      o2.connect(song.gain(0.12, lp));
      this.o2 = o2;
    }
    this.vib = song.lfo(this.o.vibRate, 0, osc.detune);
    if (this.o2) this.vib.depth.connect(this.o2.detune);
    // breath: noise band-passed around the 2nd harmonic
    const nz = song.src(ctx.createBufferSource());
    nz.buffer = audio.noise('white');
    nz.loop = true;
    const bp = song.filter('bandpass', 1000, 2.2);
    bp.frequency.value = 0;
    const bm = song.gain(2);
    this.pitch.connect(bm); bm.connect(bp.frequency);
    this.bAmp = song.gain(0, out);
    nz.connect(bp); bp.connect(this.bAmp);
    this.last = -1;
    song.monos.push(this);
  }

  note(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    const O = this.o;
    const f = mtof(midi + this.s.transpose);
    const p = this.pitch.offset;
    p.cancelScheduledValues(t);
    const legato = o.slide && this.last > 0;
    if (legato) { p.setValueAtTime(this.last, t); p.exponentialRampToValueAtTime(f, t + O.glide); } else p.setValueAtTime(f, t);
    this.last = f;
    const vd = this.vib.depth.gain;
    vd.cancelScheduledValues(t);
    if (!legato) vd.setValueAtTime(0, t);
    vd.setTargetAtTime(O.vib * (o.vib ?? 1), t + Math.min(0.22, dur * 0.4), 0.12);
    const lvl = vel * O.level;
    const a = this.amp.gain;
    a.cancelScheduledValues(t);
    a.setTargetAtTime(lvl, t, legato ? 0.02 : O.atk / 3);
    a.setTargetAtTime(0, t + dur, O.rel / 3);
    const b = this.bAmp.gain;
    b.cancelScheduledValues(t);
    if (!legato) {
      b.setTargetAtTime(lvl * O.breath * 2.2, t, 0.008);
      b.setTargetAtTime(lvl * O.breath * 0.5, t + 0.04, 0.07);
    } else b.setTargetAtTime(lvl * O.breath * 0.5, t, 0.03);
    b.setTargetAtTime(0, t + dur, O.rel / 3);
  }

  cut(t) {
    for (const prm of [this.amp.gain, this.bAmp.gain, this.pitch.offset]) prm.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.008);
    this.bAmp.gain.setTargetAtTime(0, t, 0.008);
  }
}

/**
 * Stadium / ballpark organ: tonewheel loops (render.js 'tonewheel') through a
 * Leslie — horn and drum rotors as two modulated delays at slightly different
 * speeds, panned apart, with amplitude tremolo — plus a key click per note.
 * o: { level, rate (rotor Hz, ~6.7 fast / ~0.8 slow), cut, click, rel }
 */
export class Organ {
  constructor(song, layer, opts = {}) {
    this.s = song;
    this.layer = layer;
    this.o = { level: 0.3, rate: 6.7, cut: 5500, click: 0.25, rel: 0.06, ...opts };
    const out = song.dest(layer);
    const inp = song.gain(1);
    const lp = song.filter('lowpass', this.o.cut, 0.5);
    inp.connect(lp);
    lp.connect(song.gain(0.45, out)); // straight through the bass rotor's baffle
    [[-0.75, 1], [0.75, 1.09]].forEach(([pan, k]) => {
      const d = song.delayNode(0.004, 0.05);
      const trem = song.gain(0.72);
      lp.connect(d);
      d.connect(trem);
      trem.connect(song.panner(pan, out));
      song.lfo(this.o.rate * k, 0.0011, d.delayTime);
      song.lfo(this.o.rate * k, 0.26, trem.gain);
    });
    this.poly = new Poly(song, layer, 'tonewheel', { level: this.o.level, atk: 0.004, rel: this.o.rel, dest: inp });
  }

  note(t, midi, dur, vel = 0.8, o = {}) {
    if (!o.force && !this.s.isOn(this.layer)) return;
    this.poly.note(t, midi, dur, vel, o);
    if (this.o.click) this.s.hit('keyclick', t, vel * this.o.click, { layer: this.layer, force: true, pan: (midi - 64) / 40 });
  }

  chord(t, notes, dur, vel = 0.8, o = {}) {
    for (const m of notes) this.note(t, m, dur, vel / Math.sqrt(notes.length / 2), o);
  }
}

export const VOWELS = {
  a: [800, 1150, 2800], o: [480, 850, 2600], e: [420, 1900, 2600], i: [300, 2250, 3000], u: [340, 720, 2400],
};
