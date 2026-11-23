// COLD BOOT — Port Zarya by day and by night.
//   cb_town   folk-Americana with a Russian accent, made for long play: a finger-picked
//             steel-string guitar (Travis picking) under every section, upright bass,
//             brushes; the tune passes between a tremolo balalaika, an accordion and a
//             lonely whistle; a Russian-romance passage in the relative minor (harmonic
//             minor, b9 over the dominant), a little "chastushka" dance with oom-pah
//             accordion, a celesta break. Each pass through the form changes key
//             (G, A, G, F) and swaps who sings the opening tune, so it wears well.
//   cb_night  under the aurora: slow Lydian pad chords, a faint choir, low strings,
//             glass bells falling where they like (seeded per bar, never the same bar
//             twice), a very soft eighth-note pulse in the middle sections, and a
//             high shimmer of filtered air.

import { CBSong, tune, Plucker, Accordion } from './cb_common.js';
import { Mono, Poly, Breath, Pluck } from './inst.js';
import { pat } from './util.js';
import { audio } from '../audio.js';

// ============================================================================ cb_town
const TOWN_A =
  '5:4 3:2 2:2 1:4 2:2 3:2 | 3:6^ 2:2 3:4 5:4 | 4:2 5:2 6:4 5:2 4:2 3:4 | 2:4 1:12 | ' +
  "3:4 3:2 5:2 6:6^ 5:2 | 1':4 6:2 5:2 6:8 | 5:2 6:2 5:2 3:2 2:8 | 1:12 r:4";
// relative minor (E), harmonic minor over the dominant, home to G in the last bar
const TOWN_B =
  "5:6 4:2 3:4 4:2 5:2 | 1':8 7:4 6:4 | 6:4 1':4 6:2 5:2 4:4 | #7:4^ 2':4 #7:2 6:2 5:4 | " +
  "5:6 4:2 3:4 2:2 3:2 | 3:4 5:4 1':8 | 7:4 6:2 5:2 4:8 | 3:16";
// the dance
const TOWN_C =
  "1':2 1':2 5:2 3:2 1':2 1':2 5:4 | 7:2 7:2 5:2 2:2 7:2 7:2 5:4 | 1':2 2':2 3':2 2':2 1':2 7:2 6:2 5:2 | 2':4 7:4 5:8 | " +
  "1':2 1':2 6:2 4:2 1':2 1':2 6:4 | 5:2 6:2 5:2 3:2 1:4 3:4 | 5:2 4:2 3:2 2:2 5:4 7,:4 | 1:8 r:8";
// celesta break
const TOWN_BRK =
  "r:4 6:4 1':4 3':4 | 2':8 1':8 | r:4 5:4 1':4 2':4 | 3':16 | r:4 6:4 1':4 3':4 | 2':8 1':8 | r:4 5:4 7:4 2':4 | 2':16";

export class CBTown extends CBSong {
  static kind = 'cb_town';
  static intensity = 1;

  compose() {
    this.bpm = 84;
    this.keyPc = 7; // G major
    this.scale = 'major';
    this.swing8 = 0.07;
    this.humanize = 0.008;
    this.velJitter = 0.12;
    this.progs.main = 'I iii IV I vi IV V I';
    this.progs.minor = 'vi:2 ii III vi IV V7 I';
    this.progs.dance = 'I V I V IV I V I';
    this.progs.brk = 'IV:2 I:2 IV:2 V:2';
    this.progs.rest = 'IV I ii7 V';
    this.form = [
      { type: 'intro', bars: 4 },
      { type: 'A', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'B', bars: 8, prog: 'minor' },
      { type: 'C', bars: 8, prog: 'dance' },
      { type: 'break', bars: 8, prog: 'brk' },
      { type: 'A', bars: 8, var: 2 },
      { type: 'outro', bars: 4, prog: 'rest' },
    ];
    this.loopFrom = 0;
    this.sectionLayers = {
      intro: 'gtr',
      A: 'gtr bass lead arp kick snare hats',
      B: 'gtr bass lead pad chords snare hats',
      C: 'gtr bass lead chords kick snare hats perc',
      break: 'gtr pad arp',
      outro: 'gtr chords',
    };
    this.kit = { ...this.kit, kick: 'kick_soft', brush: 'brush', ghost: 'brush', sweep: 'sweep', tamb: 'tamb', shaker: 'shaker' };
    this.kitGain = { ...this.kitGain, brush: 0.75, ghost: 0.5, sweep: 0.55, tamb: 0.45, shaker: 0.5 };
    this.drums = {
      A: { kick: pat('o.......o.......'), sweep: pat('x...x...x...x...'), brush: pat('....x.......x...'), ghost: pat('......g.......g.') },
      B: { sweep: pat('x.......x.......'), brush: pat('........x.......') },
      C: {
        kick: pat('x.......x.......'), sweep: pat('x...x...x...x...'), brush: pat('....x.......x...'),
        ghost: pat('..g...g...g...g.'), tamb: pat('....o.......o...'), shaker: pat('g.g.g.g.g.g.g.g.'),
      },
    };
    const G4 = 67, E4 = 64;
    this.tA = tune(TOWN_A, G4, 'major');
    this.tA3 = tune(TOWN_A, G4, 'major', -2); // a third below: balalaika harmony
    this.tB = tune(TOWN_B, E4, 'minor');
    this.tC = tune(TOWN_C, G4, 'major');
    this.tBrk = tune(TOWN_BRK, G4, 'major');
    this.who = 'bala';
    this.mix = {
      gtr: { v: 0.5, rev: 0.16 }, bass: { v: 0.36 }, lead: { v: 0.42, rev: 0.26 }, arp: { v: 0.3, rev: 0.3, dly: 0.12 },
      chords: { v: 0.3, rev: 0.3 }, pad: { v: 0.2, rev: 0.4 }, kick: { v: 0.2 }, snare: { v: 0.26, rev: 0.1 },
      hats: { v: 0.14, rev: 0.08 }, perc: { v: 0.11 },
    };
    this.trim = 0.62;
  }

  setup() {
    this.dlyTime = this.beatDur * 0.75;
    this.dlyFb = 0.25;
    const trem = 1 / (this.stepDur / 2); // 32nd-note tremolo
    this.gtr = new Plucker(this, 'gtr', { variant: 'folk', level: 0.55, lp: 6000, pan: -0.12 });
    this.ub = new Pluck(this, 'bass', { level: 0.7 });
    this.bala = new Plucker(this, 'lead', { variant: 'bala', level: 0.4, trem, tremMin: 0.42, lp: 7000, pan: 0.12 });
    this.balaH = new Plucker(this, 'arp', { variant: 'bala', level: 0.26, trem, tremMin: 0.42, lp: 5200, pan: 0.35 });
    this.accLead = new Accordion(this, 'lead', { level: 0.3, atk: 0.035, rel: 0.12, cut: 3400, bellows: 0.05 });
    this.acc = new Accordion(this, 'chords', { level: 0.22, atk: 0.25, rel: 0.5, cut: 2300, bellows: 0.08, pan: -0.2 });
    this.accSt = new Accordion(this, 'chords', { level: 0.24, atk: 0.012, rel: 0.08, cut: 2600, bellows: 0, pan: -0.2 });
    this.whistle = new Breath(this, 'lead', { wave: 'sine', level: 0.17, lp: 5200, vib: 11, vibRate: 5.6, breath: 0.14, glide: 0.045, atk: 0.04, rel: 0.12 });
    this.cel = new Poly(this, 'arp', 'celesta', { level: 0.38, rel: 0.6 });
    this.str = new Poly(this, 'pad', 'strings', { level: 0.22, atk: 1.2, rel: 1.6, cut: 3000 });
  }

  onCycle(c) {
    this.transpose = [0, 2, 0, -2][c % 4];
    this.who = c % 2 ? 'acc' : 'bala';
  }

  /** Travis picking: thumb alternates root and fifth on the beats, fingers fill the off-beats. */
  travis(s, t) {
    if (s & 1) return;
    const i = s >> 1;
    const ch = this.chordAt(s);
    const R = this.rootIn(ch, 40);
    const five = R + 7 > 52 ? R - 5 : R + 7;
    const v = this.voicing(ch, 3, 55, 71, 'gtr');
    const T = this.sw(s, t), e = this.stepDur * 2;
    const soft = this.sec.type === 'C' ? 0.8 : 1;
    switch (i) {
      case 0: this.gtr.note(T, R, e * 3.5, 0.62 * soft); this.gtr.note(T + 0.006, v[2], e * 3, 0.42 * soft); break;
      case 1: this.gtr.note(T, v[1], e * 2.5, 0.36 * soft); break;
      case 2: this.gtr.note(T, five, e * 3, 0.52 * soft); break;
      case 3: this.gtr.note(T, v[2], e * 2.5, 0.38 * soft); break;
      case 4: this.gtr.note(T, R, e * 3, 0.55 * soft); break;
      case 5: this.gtr.note(T, v[1], e * 2.5, 0.34 * soft); break;
      case 6: this.gtr.note(T, five, e * 3, 0.5 * soft); break;
      default: {
        const r = this.barRng(9);
        this.gtr.note(T, r.chance(0.5) ? v[0] : v[2], e * 2, 0.33 * soft);
      }
    }
  }

  onStep(s, t) {
    const ty = this.sec.type, v = this.sec.var || 0;
    if (this.on('gtr')) this.travis(s, t);
    if (this.on('bass')) {
      const p = ty === 'C' ? 'r.......f.......' : ty === 'B' ? 'r.......r...f...' : 'r.......f.......';
      this.rolePlay(this.ub, p, s, t, { lo: 31, gate: ty === 'C' ? 0.45 : 0.9, vel: 0.85, slides: false });
    }
    if (this.on('pad')) this.padPlay(this.str, s, t, { n: 4, lo: 55, hi: 74, vel: 0.4 });
    if (this.on('chords')) {
      if (ty === 'C') this.compPlay(this.accSt, '....x.......x...', s, t, { n: 3, lo: 55, hi: 71, gate: 0.35, vel: 0.5, key: 'oom' });
      else this.padPlay(this.acc, s, t, { n: 3, lo: 55, hi: 71, vel: 0.45, key: 'acc' });
    }
    if (this.on('lead')) {
      if (ty === 'A') {
        const who = v === 2 ? 'whistle' : (v === 0) === (this.who === 'bala') ? 'bala' : 'acc';
        if (who === 'bala') this.tunePlay(this.bala, this.tA, s, t, { vel: 0.85 });
        else if (who === 'acc') this.tunePlay(this.accLead, this.tA, s, t, { vel: 0.8, gate: 0.9 });
        else this.tunePlay(this.whistle, this.tA, s, t, { vel: 0.8, oct: 1, legato: true });
      } else if (ty === 'B') {
        if (this.who === 'bala') this.tunePlay(this.accLead, this.tB, s, t, { vel: 0.82, gate: 0.94 });
        else this.tunePlay(this.bala, this.tB, s, t, { vel: 0.85 });
      } else if (ty === 'C') this.tunePlay(this.bala, this.tC, s, t, { vel: 0.82, gate: 0.8 });
    }
    if (this.on('arp')) {
      if (ty === 'break') this.tunePlay(this.cel, this.tBrk, s, t, { vel: 0.55, gate: 1.3 });
      else if (ty === 'A' && v === 1) this.tunePlay(this.balaH, this.tA3, s, t, { vel: 0.6 });
    }
  }
}

// ============================================================================ cb_night
export class CBNight extends CBSong {
  static kind = 'cb_night';
  static intensity = 1;

  compose() {
    this.bpm = 60;
    this.keyPc = 4; // E, Lydian colour (the II chord)
    this.scale = 'major';
    this.humanize = 0.015;
    this.velJitter = 0.15;
    this.progs.main = 'IM7:2 II:2 IVM7:2 vi9:2';
    this.progs.alt = 'IM7:2 II:2 iii7:2 IVM7:2';
    this.progs.deep = 'vi9:2 IVM7:2 IM7:2 V6:2';
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8, prog: 'alt' },
      { type: 'C', bars: 8, prog: 'deep' },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4, prog: 'alt' },
    ];
    this.sectionLayers = {
      A: 'pad arp fx',
      B: 'pad arp chords bass fx',
      C: 'pad arp gtr chords bass fx',
      break: 'pad fx gtr',
    };
    this.hint = tune('1:4 3:4 5:8 | 4:4 5:12', 76, 'major');
    this.mix = {
      pad: { v: 0.4, rev: 0.5 }, chords: { v: 0.16, rev: 0.6 }, gtr: { v: 0.22, rev: 0.4 },
      arp: { v: 0.32, rev: 0.6, dly: 0.42 }, bass: { v: 0.2, rev: 0.2 }, fx: { v: 0.5 },
    };
    this.trim = 0.62;
  }

  setup() {
    this.dlyTime = this.beatDur * 0.75;
    this.dlyFb = 0.42;
    this.pad = new Poly(this, 'pad', 'pad', { level: 0.3, atk: 2.6, rel: 3.6, cut: 2100, lfo: { rate: 0.031, depth: 900 } });
    this.choir = new Poly(this, 'chords', 'choir', { level: 0.22, atk: 3, rel: 3.5 });
    this.low = new Poly(this, 'gtr', 'strings', { level: 0.26, atk: 2.2, rel: 3, cut: 1200 });
    this.glass = new Poly(this, 'arp', 'glass', { level: 0.32, rel: 1.6, cut: 7000 });
    this.pulse = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.4 }, { type: 'triangle', gain: 0.5 }], cut: 240, q: 1.5, env: 260,
      fatk: 0.01, fdec: 0.2, atk: 0.02, dec: 0.4, sus: 0.3, rel: 0.25, level: 0.3,
    });
    // aurora shimmer: high air through a slowly wandering band
    const ctx = this.ctx;
    const nz = this.src(ctx.createBufferSource());
    nz.buffer = audio.noise('pink');
    nz.loop = true;
    const bp = this.filter('bandpass', 4200, 2.2);
    this.lfo(0.023, 1600, bp.frequency);
    const am = this.gain(0.05);
    this.lfo(0.071, 0.035, am.gain);
    nz.connect(bp); bp.connect(am); am.connect(this.dest('fx', 0.2));
  }

  onStep(s, t) {
    const ty = this.sec.type, v = this.sec.var || 0;
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 4, lo: 52, hi: 76, vel: 0.5, overlap: 0.6 });
    if (this.on('chords')) this.padPlay(this.choir, s, t, { n: 3, lo: 64, hi: 81, key: 'choir', vel: 0.38, overlap: 0.8 });
    if (this.on('gtr') && (s & 3) === 0) {
      const b = s >> 2;
      if (this.changes[b] || (b === 0 && this.layers.gtr.justOn)) {
        this.layers.gtr.justOn = false;
        const ch = this.barChords[b];
        const R = this.rootIn(ch, 40);
        const d = this.chordBeats(b) * this.beatDur + 0.6;
        this.low.note(t, R, d, 0.45);
        this.low.note(t, R + 7, d, 0.35);
      }
    }
    if (this.on('bass') && (s & 1) === 0) {
      const ch = this.chordAt(s);
      const r = this.barRng(77);
      const p = r.chance(0.5) ? 'r.r.r.r.r.r.r.o.' : 'r.r.r.o.r.r.r.r.';
      if (p[s] !== '.') this.pulse.note(this.sw(s, t), this.rootIn(ch, 40) + (p[s] === 'o' ? 12 : 0), this.stepDur * 1.4, (s & 7) === 0 ? 0.6 : 0.42);
    }
    if (this.on('arp')) {
      if (ty === 'A' && v === 1 && this.barInSec < 2) { this.tunePlay(this.glass, this.hint, s, t, { vel: 0.5, gate: 2 }); return; }
      if ((s & 1) === 0) this.bells(s, t);
    }
  }

  /** Glass bells: seeded per bar, so the sky is never the same twice but always the same sky. */
  bells(s, t) {
    const r = this.barRng(101 + s);
    const beat = (s & 3) === 0;
    if (!r.chance(beat ? 0.3 : 0.07)) return;
    const ch = this.chordAt(s);
    const tones = ch.iv.concat([14]).map((i) => (this.keyPc + ch.root + i) % 12);
    const pc = tones[r.int(0, tones.length - 1)];
    let m = 79 + ((pc - 79) % 12 + 12) % 12;
    if (r.chance(0.35)) m += 12;
    const vel = 0.22 + 0.3 * r.next();
    const T = this.sw(s, t);
    this.glass.note(T, m, this.beatDur * 3, vel);
    if (beat && r.chance(0.18)) { // a little falling figure
      const a = this.voicing(ch, 3, m - 10, m - 1, 'bellfig');
      a.slice().reverse().forEach((x, i) => this.glass.note(T + (i + 1) * this.beatDur / 3, x, this.beatDur * 2, vel * (0.8 - i * 0.15)));
    }
  }
}
