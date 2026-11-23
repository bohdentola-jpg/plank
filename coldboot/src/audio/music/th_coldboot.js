// COLD BOOT — the leitmotif family (see cb_common.js for MOTIF):
//   cb_title      slow and cold, in D minor: a low D pedal, the "Bond line"
//                 (i, i+5, i6, i+5) on strings, the motif on piano and then a cello,
//                 celesta fragments in the break, a slow heartbeat under the B section.
//   cb_warehouse  the Bely Mys table, under dialogue: a D pedal drone, a distant
//                 accordion breathing slow chords, sparse celesta / piano fragments
//                 of the motif high above the voices, no drums.
//   cb_credits    sunset through the bars: the motif in D major on piano, then strings;
//                 the old minor version returns on a cello as a memory; a full major
//                 restatement and a plagal (IV – iv – I) ending.
// Other themes: th_cb_town.js (cb_town, cb_night), th_cb_action.js (cb_tension, cb_chase).

import { CBSong, tune, MOTIF, MOTIF_PROG, Accordion, Drone } from './cb_common.js';
import { Mono, Poly, Breath } from './inst.js';
import { pat } from './util.js';

// ============================================================================ cb_title
// An answering line for the B passes (same eight-bar changes as the motif).
const TITLE_COUNTER =
  "r:4 5:4 1':4 2':2 3':2 | #6:8 5:4 4:4 | 6:6 5:2 4:4 3:2 2:2 | 1:6 2:2 3:8 | " +
  "1':6 7:2 6:4 5:4 | 4:4 6:4 1':4 6:4 | 7:6 5:2 3:4 2:4 | 1:16";

export class CBTitle extends CBSong {
  static kind = 'cb_title';
  static intensity = 1;

  compose() {
    this.bpm = 76;
    this.keyPc = 2; // D minor
    this.scale = 'minor';
    this.humanize = 0.01;
    this.velJitter = 0.1;
    this.progs.main = MOTIF_PROG.minor;
    this.progs.bond = 'i:4';
    this.form = [
      { type: 'intro', bars: 4, prog: 'bond' },
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4, prog: 'bond' },
      { type: 'A', bars: 8, var: 1, plus: 'chords' },
      { type: 'B', bars: 8, var: 1, plus: 'kick' },
    ];
    this.loopFrom = 1;
    // strings, piano and a cello over a D pedal; the only drum is a slow heartbeat
    this.sectionLayers = {
      intro: 'pad bass fx',
      A: 'pad bass lead fx',
      B: 'pad bass lead chords fx',
      break: 'pad bass gtr fx',
    };
    this.kit = { ...this.kit, kick: 'kick_soft' };
    this.drums = { B: { kick: pat('x..x............') } };
    const D4 = 62;
    this.motif = tune(MOTIF.minor, D4, 'minor');
    this.counter = tune(TITLE_COUNTER, D4, 'minor');
    this.mix = {
      kick: { v: 0.3, rev: 0.2 },
      bass: { v: 0.5 }, pad: { v: 0.34, rev: 0.45 }, chords: { v: 0.3, rev: 0.5 },
      gtr: { v: 0.3, rev: 0.7, dly: 0.3 }, lead: { v: 0.5, rev: 0.42, dly: 0.12 }, fx: { v: 0.5 },
    };
    this.trim = 0.9;
  }

  setup() {
    this.dlyTime = this.beatDur * 1.5;
    this.dlyFb = 0.28;
    this.tapeFx({ hiss: 0.003, lp: 12000, drive: 1.1 });
    this.drone = new Drone(this, 'bass', { level: 0.26, cut: 260, lfoDepth: 70, lfoRate: 0.04, sub: 0.3, atk: 2.5 });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.24, atk: 1.2, rel: 1.8, cut: 2600 });
    this.strings = new Poly(this, 'chords', 'strings', { level: 0.2, atk: 0.8, rel: 1.6, cut: 3200 });
    this.piano = new Poly(this, 'lead', 'piano', { level: 0.34, rel: 0.9, cut: 4200 });
    this.cello = new Breath(this, 'lead', {
      wave: 'sawtooth', level: 0.15, lp: 1400, vib: 12, vibRate: 5.0, breath: 0.03, glide: 0.07, atk: 0.14, rel: 0.4,
    });
    this.cel = new Poly(this, 'gtr', 'celesta', { level: 0.32, rel: 0.8 });
  }

  /** The spy cliché, honestly, but on strings: D minor with a chromatic inner voice A – Bb – B – Bb. */
  bond(s, t) {
    if ((s & 7) !== 0) return;
    const k = (this.barInSec * 2 + (s >> 3)) % 4;
    if (k === 0) this.pad.chord(t, [50, 53, 62], this.barDur + 0.05, 0.36);
    this.pad.note(t, [57, 58, 59, 58][k], this.beatDur * 2 + 0.06, 0.32);
  }

  onBar(t) {
    if (this.barInSec === 0) {
      const ty = this.sec.type;
      this.drone.set(t, 38, ty === 'intro' || ty === 'break' ? 0.7 : 1);
    }
  }

  onStep(s, t) {
    const ty = this.sec.type, v = this.sec.var || 0;
    if (this.on('pad')) {
      if (this.sec.prog === 'bond') this.bond(s, t);
      else this.padPlay(this.pad, s, t, { n: 4, lo: 50, hi: 69, vel: 0.36 });
    }
    if (this.on('chords')) this.padPlay(this.strings, s, t, { n: 3, lo: 57, hi: 76, key: 'str', vel: 0.3 });
    if (this.on('gtr') && ty === 'break') this.tunePlay(this.cel, this.motif, s, t, { vel: 0.42, oct: 1, gate: 1.3 });
    if (this.on('lead')) {
      if (ty === 'A' && !v) this.tunePlay(this.piano, this.motif, s, t, { vel: 0.55, gate: 1.4 });
      else if (ty === 'A') this.tunePlay(this.cello, this.counter, s, t, { vel: 0.8, legato: true });
      else if (ty === 'B' && !v) this.tunePlay(this.cello, this.motif, s, t, { vel: 0.85, legato: true });
      else if (ty === 'B') {
        this.tunePlay(this.cello, this.motif, s, t, { vel: 0.85, legato: true });
        this.tunePlay(this.piano, this.counter, s, t, { vel: 0.34, oct: 1, gate: 1.2, orn: false });
      }
    }
  }
}

// ======================================================================== cb_warehouse
// Fragments of the motif, far apart (celesta over the first changes, piano over the second).
const WH_CEL = "1:4 3:4 5:8 | 4:4 5:4 r:8 | r:8 6,:4 1:4 | 3:12 r:4 | r:4 4:4 6:4 1':4 | r:16 | 5:4 3:4 2:8 | r:16";
const WH_PNO = "5:6 7:2 1':8 | r:16 | 7:4 6:4 5:8 | r:16 | 6:6 5:2 4:8 | r:16 | 3:4 2:4 1:8 | r:16";

export class CBWarehouse extends CBSong {
  static kind = 'cb_warehouse';
  static intensity = 1;

  compose() {
    this.bpm = 66;
    this.keyPc = 2;
    this.scale = 'minor';
    this.humanize = 0.012;
    this.velJitter = 0.12;
    this.progs.main = 'i:2 bVI:2 iv:2 v:2';
    this.progs.alt = 'bVI:2 bIII:2 iv:2 i:2';
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8, prog: 'alt' },
      { type: 'break', bars: 8 },
      { type: 'A', bars: 8, var: 1, plus: 'lead', minus: 'arp' },
      { type: 'B', bars: 8, prog: 'alt', var: 1, plus: 'arp', minus: 'lead' },
      { type: 'break', bars: 4, prog: 'alt' },
    ];
    this.sectionLayers = {
      A: 'bass pad chords arp',
      B: 'bass pad chords lead',
      break: 'bass pad gtr',
    };
    this.cel = tune(WH_CEL, 74, 'minor');
    this.pno = tune(WH_PNO, 74, 'minor');
    this.mix = {
      bass: { v: 0.42 }, pad: { v: 0.3 }, chords: { v: 0.36, rev: 0.6 },
      arp: { v: 0.3, rev: 0.55, dly: 0.28 }, lead: { v: 0.34, rev: 0.5, dly: 0.18 }, gtr: { v: 0.26, rev: 0.7, dly: 0.35 },
    };
    this.trim = 0.5;
  }

  setup() {
    this.dlyTime = this.beatDur * 1.5;
    this.dlyFb = 0.3;
    this.drone = new Drone(this, 'bass', { level: 0.24, cut: 280, lfoDepth: 80, lfoRate: 0.037, sub: 0.25, atk: 3 });
    this.fifth = new Drone(this, 'pad', { level: 0.2, cut: 380, lfoDepth: 110, lfoRate: 0.029, detune: 9, sub: 0, atk: 5 });
    this.acc = new Accordion(this, 'chords', { level: 0.3, atk: 1.1, rel: 2.2, cut: 1150, bellows: 0.12, bellowsRate: 0.13 });
    this.celesta = new Poly(this, 'arp', 'celesta', { level: 0.34, rel: 0.8, cut: 5200 });
    this.piano = new Poly(this, 'lead', 'piano', { level: 0.3, rel: 0.9, cut: 3600 });
    this.glass = new Poly(this, 'gtr', 'glass', { level: 0.26, rel: 1.5, cut: 5000 });
  }

  onBar(t) {
    // the pedal never moves; the fifth above it breathes in and out with the sections
    if (this.barInSec === 0) {
      this.drone.set(t, 38, this.sec.type === 'break' ? 0.75 : 1);
      this.fifth.set(t, 45, this.sec.type === 'B' ? 1 : this.sec.type === 'break' ? 0.4 : 0.7);
    }
  }

  onStep(s, t) {
    const v = this.sec.var || 0;
    if (this.on('chords')) this.padPlay(this.acc, s, t, { n: 3, lo: 53, hi: 69, vel: 0.5, overlap: 0.4 });
    if (this.on('arp')) this.tunePlay(this.celesta, v ? this.pno : this.cel, s, t, { vel: 0.5, gate: 1.4 });
    if (this.on('lead')) this.tunePlay(this.piano, v ? this.cel : this.pno, s, t, { vel: 0.42, oct: v ? -1 : 0, gate: 1.5 });
    if (this.on('gtr') && (s & 3) === 0) {
      // the break: an occasional glassy note from the chord, very high and very far
      const r = this.barRng(31 + s);
      if (r.chance(s === 0 ? 0.45 : 0.16)) {
        const ch = this.chordAt(s);
        const pcs = ch.iv.map((i) => (this.keyPc + ch.root + i) % 12);
        const m = 81 + ((pcs[r.int(0, pcs.length - 1)] - 81) % 12 + 12) % 12 + (r.chance(0.3) ? 12 : 0);
        this.glass.note(this.sw(s, t), m, this.beatDur * 2, 0.35 + 0.3 * r.next());
      }
    }
  }
}

// ========================================================================= cb_credits
const CR_CODA = '6:4 5:4 4:4 3:4 | b6:8 5:8 | 3:4 2:4 1:8 | r:16 | r:16 | r:16';

export class CBCredits extends CBSong {
  static kind = 'cb_credits';
  static intensity = 1;

  compose() {
    this.bpm = 70;
    this.keyPc = 2; // D major: the title's key, finally in the light
    this.scale = 'major';
    this.humanize = 0.009;
    this.velJitter = 0.1;
    this.progs.main = MOTIF_PROG.major;
    this.progs.intro = 'I:2 IVM7:2 vi7:1 Vsus4:.5 V:.5';
    this.progs.minor = MOTIF_PROG.minor;
    this.progs.coda = 'IV:1 iv:1 I:4';
    this.form = [
      { type: 'intro', bars: 6, prog: 'intro' },
      { type: 'A', bars: 8 },
      { type: 'A', bars: 8, var: 1, plus: 'bass' },
      { type: 'B', bars: 8, prog: 'minor' },
      { type: 'A', bars: 8, var: 2, plus: 'bass gtr arp cym perc' },
      { type: 'outro', bars: 6, prog: 'coda' },
    ];
    this.loopFrom = 1;
    this.sectionLayers = {
      intro: 'chords pad',
      A: 'chords pad lead',
      B: 'chords pad lead arp bass cym',
      outro: 'chords pad lead arp bass gtr cym perc',
    };
    const D4 = 62, D5 = 74;
    this.melA = tune(MOTIF.major, D5, 'major');
    this.melLow = tune(MOTIF.major, D4, 'major');
    this.memory = tune(MOTIF.minor, 50, 'minor'); // the title melody, an octave and more down: a cello
    this.coda = tune(CR_CODA, D5, 'major');
    this.kit = { ...this.kit, tomf: 'tom_f' };
    this.mix = {
      chords: { v: 0.62, rev: 0.32 }, pad: { v: 0.34, rev: 0.4 }, lead: { v: 0.6, rev: 0.4 },
      bass: { v: 0.42, rev: 0.15 }, gtr: { v: 0.26, rev: 0.5 }, arp: { v: 0.3, rev: 0.5, dly: 0.3 },
      cym: { v: 0.2, rev: 0.4 }, perc: { v: 0.26, rev: 0.35 },
    };
    this.trim = 1.45;
  }

  setup() {
    this.dlyTime = this.beatDur * 0.75;
    this.dlyFb = 0.3;
    this.lh = new Poly(this, 'chords', 'piano', { level: 0.36, rel: 0.5, cut: 5200 });
    this.rh = new Poly(this, 'lead', 'piano', { level: 0.44, rel: 0.6 });
    this.vln = new Poly(this, 'lead', 'strings', { level: 0.3, atk: 0.16, rel: 0.6, cut: 4600 });
    this.cello = new Breath(this, 'lead', {
      wave: 'sawtooth', level: 0.15, lp: 1500, vib: 13, vibRate: 5.2, breath: 0.03, glide: 0.07, atk: 0.12, rel: 0.35,
    });
    this.strings = new Poly(this, 'pad', 'strings', { level: 0.24, atk: 1.4, rel: 2, cut: 3400 });
    this.contra = new Poly(this, 'bass', 'strings', { level: 0.34, atk: 0.5, rel: 1.4, cut: 900 });
    this.choir = new Poly(this, 'gtr', 'choir', { level: 0.3, atk: 1.6, rel: 2.2 });
    this.cel = new Poly(this, 'arp', 'celesta', { level: 0.36, rel: 0.7 });
  }

  onSection(t, first) {
    const v = this.sec.var || 0;
    if (first) return;
    if (this.sec.type === 'A' && v === 2) {
      this.hit('crash', t, 0.45);
      this.hit('tomf', t, 0.5, { layer: 'perc' });
    }
    if (this.sec.type === 'outro') this.hit('tomf', t + this.barDur * 2, 0.4, { layer: 'perc' });
  }

  onBar(t) {
    // a soft reverse cymbal into the big restatement
    const nx = this.barInSec === this.sec.bars - 1 ? this._nextSec() : null;
    if (nx && nx.type === 'A' && nx.var === 2) {
      const rc = this.B.get('revcrash');
      this.hit('revcrash', t + this.barDur - rc.duration, 0.32, { layer: 'cym', force: true });
    }
  }

  /** Left hand: a slow broken chord (1 5 8 10 12 10 8 5), held like a sustain pedal. */
  leftHand(s, t) {
    if (s & 1) return;
    const ty = this.sec.type;
    const ch = this.chordAt(s);
    const R = this.rootIn(ch, 38);
    const third = ch.iv[1];
    if (ty === 'outro' && this.barInSec >= 2) {
      if (this.barInSec === 2 && s === 0) { // the last chord, rolled, and a high D
        [R, R + 7, R + 12, R + 12 + third, R + 19, R + 24].forEach((m, i) => this.lh.note(t + i * 0.055, m, this.barDur * 3.5, 0.42 - i * 0.03));
        this.cel.note(t + 0.4, R + 36, this.barDur * 2, 0.4);
      }
      return;
    }
    const seq = [R, R + 7, R + 12, R + 12 + third, R + 19, R + 12 + third, R + 12, R + 7];
    const i = s >> 1;
    const v = this.sec.var || 0;
    const vel = (i === 0 ? 0.5 : 0.38) * (ty === 'intro' ? 0.68 : ty === 'B' ? 0.78 : ty === 'A' ? [0.82, 1, 1.15][v] : 1);
    this.lh.note(this.sw(s, t), seq[i], this.stepDur * 2 * (i === 0 ? 4 : 2.6), vel);
  }

  onStep(s, t) {
    const ty = this.sec.type, v = this.sec.var || 0;
    if (this.on('chords')) this.leftHand(s, t);
    if (this.on('pad')) this.padPlay(this.strings, s, t, { n: 4, lo: 50, hi: 74, vel: ty === 'intro' ? 0.26 : ty === 'B' ? 0.34 : ty === 'A' ? [0.34, 0.42, 0.56][v] : 0.42 });
    if (this.on('bass') && (s & 3) === 0) {
      const b = s >> 2;
      if (this.changes[b]) this.contra.note(t, this.rootIn(this.barChords[b], 33), this.chordBeats(b) * this.beatDur + 0.1, 0.5);
    }
    if (this.on('gtr')) this.padPlay(this.choir, s, t, { n: 3, lo: 57, hi: 76, key: 'choir', vel: 0.4 });
    if (this.on('lead')) {
      if (ty === 'A' && v === 0) this.tunePlay(this.rh, this.melA, s, t, { vel: 0.5, gate: 1.2 });
      else if (ty === 'A' && v === 1) this.tunePlay(this.vln, this.melLow, s, t, { vel: 0.7, gate: 0.98 });
      else if (ty === 'A') {
        this.tunePlay(this.vln, this.melA, s, t, { vel: 0.9, gate: 0.98 });
        this.tunePlay(this.vln, this.melLow, s, t, { vel: 0.55, gate: 0.98, orn: false });
        this.tunePlay(this.rh, this.melA, s, t, { vel: 0.42, gate: 1.1 });
      } else if (ty === 'B') this.tunePlay(this.cello, this.memory, s, t, { vel: 0.85, legato: true });
      else if (ty === 'outro') this.tunePlay(this.rh, this.coda, s, t, { vel: 0.56, gate: 1.4 });
    }
    if (this.on('arp') && ty === 'B' && (s === 8 || s === 12)) {
      // the celesta answers each long cello note from far above
      const nt = this.memory.idx[((this.barInSec % 8) * 16) + 0];
      if (nt && nt.len >= 12) this.cel.note(this.sw(s, t), nt.m + 24 + (s === 12 ? 7 : 0), this.beatDur, 0.35);
    }
  }
}
