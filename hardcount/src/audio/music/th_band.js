// The marching band. A drumline (marching snares with diddles, flams and buzz
// rolls, tenor sweeps, split bass-drum runs, crash and choked hand cymbals)
// plays street-beat cadences between plays; after a touchdown the full band
// plays an (original) fight song in B♭ — trumpets on the tune doubled by
// glockenspiel, horns on the after-beats, trombones holding the chords,
// sousaphones oom-pahing; CHARGE! is the old bugle call. The same classes run
// as music themes (hud_practice, halftime) and through band.js in the stands.

import { Song } from './song.js';
import { Poly } from './inst.js';
import { brassSection, brassHit, written, steps } from './football.js';

// drum grooves: S snares (x X g r=diddle R f=flam z=buzz), T tenors (a–d, caps =
// accent), B bass drums (1 high … 5 low), C cymbals (C crash, k choke, s sizzle)
const G = (bars, S, T, B, C) => ({ bars, S: steps(S), T: steps(T), B: steps(B), C: steps(C) });
const GROOVES = {
  A: G(2, 'X..x..x.X.xrx.x. X..x..x.XrxrX...', '....a.b.....c.d. ....a.b.c.d.cbaA', '1..2..3.....4.5. 1..2..3.12345...', 'C.......k...k... C.......k.k.C...'),
  B: G(2, 'X.xrx.xrX.xrx.xr X.xrx.xrXrXrX...', 'a...b...c...d... abcdabcdabcdD...', '1...1...3...3... 1.2.3.4.5...5...', 'C...k...C...k... C...k...C.C.C...'),
  C: G(2, 'g.g.g.g.g.g.g.g. g.g.g.g.zzzzX...', '................ ........a.b.c.d.', '1.3.5.3.1.3.5.3. 12345432123.5...', '................ ........s...C...'),
  D: G(2, 'XrXrX........... XrXrX.......X.X.', '........aAbBcCdD ........dcbaABCD', '1............... 1.......1.3.5...', 'C............... C...........C...'),
  R: G(1, 'zzzzzzzzzzzzX...', '................', '1...........1...', '............C...'),
  M: G(2, 'X.x.x.x.X.x.xrx. X.x.x.x.X.xrX.x.', '..a...a...a...a. ..a...a...b...b.', '1.......3....... 1.......3.......', '....k.......k... ....k.......k...'),
  Mend: G(1, 'X.x.X.x.zzzzX...', '................', '1.......1...1...', '....k.......C...'),
  FI: G(2, 'zzzzzzzzzzzzzzzz X...........X.X.', '................ ................', '................ 1.......1...1.1.', '................ C...............'),
  CH: G(3, 'X.X.X.X....XX... ................ ................', '................ ................ ................', '......1.....1... ................ ................', '............C... ................ ................'),
};
const TENOR_PAN = [-0.5, -0.17, 0.17, 0.5];

// the fight song (B♭: 70 = B♭4) — [bar, step, len, midi, vel]
const FIGHT_A = written([
  [0, 0, 6, 70], [0, 6, 2, 70], [0, 8, 4, 74], [0, 12, 4, 77],
  [1, 0, 8, 79], [1, 8, 4, 77], [1, 12, 4, 74],
  [2, 0, 6, 75], [2, 6, 2, 75], [2, 8, 4, 79], [2, 12, 4, 82],
  [3, 0, 8, 81], [3, 8, 8, 77],
  [4, 0, 6, 72], [4, 6, 2, 72], [4, 8, 4, 75], [4, 12, 4, 79],
  [5, 0, 8, 77], [5, 8, 4, 75], [5, 12, 4, 72],
  [6, 0, 4, 74], [6, 4, 4, 77], [6, 8, 4, 69], [6, 12, 4, 72],
  [7, 0, 10, 70], [7, 12, 2, 65, 0.85], [7, 14, 2, 65, 0.85],
], 8);
const FIGHT_B = written([
  [0, 0, 6, 70], [0, 6, 2, 70], [0, 8, 4, 74], [0, 12, 4, 77],
  [1, 0, 8, 79], [1, 8, 4, 77], [1, 12, 4, 74],
  [2, 0, 6, 75], [2, 6, 2, 75], [2, 8, 4, 79], [2, 12, 4, 82],
  [3, 0, 8, 81], [3, 8, 8, 77],
  [4, 0, 4, 75], [4, 4, 4, 79], [4, 8, 4, 82], [4, 12, 4, 79],
  [5, 0, 8, 77], [5, 8, 8, 74],
  [6, 0, 4, 72], [6, 4, 4, 75], [6, 8, 4, 69], [6, 12, 4, 72],
  [7, 0, 6, 70], [7, 8, 3, 82, 1.1],
], 8);
// CHARGE!: sol do mi sol — mi sol, with the horns a third/sixth under
const CHARGE = written([[0, 0, 1, 65], [0, 2, 1, 70], [0, 4, 1, 74], [0, 6, 4, 77], [0, 11, 1, 74], [0, 12, 20, 77, 1.1]], 3);
const CHARGE_LO = written([[0, 0, 1, 62], [0, 2, 1, 65], [0, 4, 1, 70], [0, 6, 4, 74], [0, 11, 1, 70], [0, 12, 20, 74]], 3);

const FORMS = {
  cadence: [
    { type: 'cad', bars: 4, groove: 'A' }, { type: 'cad', bars: 4, groove: 'B' }, { type: 'cad', bars: 2, groove: 'D' },
    { type: 'cad', bars: 4, groove: 'A' }, { type: 'cad', bars: 2, groove: 'C' }, { type: 'cad', bars: 1, groove: 'R' },
  ],
  fight: [
    { type: 'fintro', bars: 2, prog: 'intro' },
    { type: 'fight', bars: 8, prog: 'fightA', part: 0 },
    { type: 'fight', bars: 8, prog: 'fightB', part: 1 },
    { type: 'end', bars: 4 },
  ],
  charge: [{ type: 'croll', bars: 1 }, { type: 'charge', bars: 3, prog: 'charge' }, { type: 'end', bars: 4 }],
  halftime: [
    { type: 'cad', bars: 4, groove: 'A' }, { type: 'cad', bars: 4, groove: 'B' },
    { type: 'fintro', bars: 2, prog: 'intro' }, { type: 'fight', bars: 8, prog: 'fightA', part: 0 }, { type: 'fight', bars: 8, prog: 'fightB', part: 1 },
    { type: 'cad', bars: 2, groove: 'D' }, { type: 'cad', bars: 4, groove: 'A' }, { type: 'cad', bars: 2, groove: 'C' }, { type: 'cad', bars: 1, groove: 'R' },
    { type: 'croll', bars: 1 }, { type: 'charge', bars: 3, prog: 'charge' },
    { type: 'cad', bars: 4, groove: 'B' },
  ],
};

export class MarchingBand extends Song {
  static kind = 'band';
  static intensity = 1;
  static mode = 'cadence';

  compose(r) {
    const mode = this.constructor.mode;
    this.bpm = mode === 'fight' || mode === 'halftime' ? 138 : mode === 'charge' ? 120 : r.pick([124, 126, 128, 132]);
    this.keyPc = 10;
    this.scale = 'major';
    this.velJitter = 0.1;
    this.humanize = 0.003;
    this.progs.main = this.P('I');
    this.progs.intro = this.P('V7:2');
    this.progs.fightA = this.P('I I IV V7 ii V7 I:.5 V7:.5 I');
    this.progs.fightB = this.P('I I IV V7 IV I V7 I');
    this.progs.charge = this.P('I:3');
    this.form = FORMS[mode].map((s) => ({ ...s }));
    this.loopFrom = 0;
    this.kit = {
      ...this.kit, snare: 'snare_march', crash: 'cym_crash', choke: 'cym_choke',
      q1: 'quad_1', q2: 'quad_2', q3: 'quad_3', q4: 'quad_4',
      b1: 'bass_m1', b2: 'bass_m2', b3: 'bass_m3', b4: 'bass_m4', b5: 'bass_m5',
    };
    this.sectionLayers = {
      cad: 'snare perc kick cym', croll: 'snare kick cym', end: 'fx',
      fintro: 'snare perc kick cym lead chords bass arp', fight: 'snare perc kick cym lead chords bass arp',
      charge: 'snare kick cym lead chords bass',
    };
    this.mix = {
      snare: { v: 0.3, rev: 0.12 }, perc: { v: 0.28, rev: 0.12 }, kick: { v: 0.42, rev: 0.06 }, cym: { v: 0.2, rev: 0.15 },
      lead: { v: 0.62, rev: 0.22 }, chords: { v: 0.5, rev: 0.22 }, bass: { v: 0.55, rev: 0.1 }, arp: { v: 0.3, rev: 0.3 }, fx: { v: 0.5 },
    };
  }

  setup() {
    this.S = brassSection(this, { tpt: { level: 0.55 }, horn: { level: 0.42 }, bone: { level: 0.45 }, tuba: { level: 0.65 } });
    this.glock = new Poly(this, 'arp', 'glock', { level: 0.35, rel: 0.3 });
  }

  _planFill() {} // the drumline's fills are written into its grooves

  onBar(t) {
    if (this.sec.type === 'end' && !this._ended) {
      this._ended = true;
      this.finished = true;
      if (this.m.deck === this) this.m.stop(0.6);
    }
  }

  _groove() {
    const sec = this.sec;
    if (sec.groove) return GROOVES[sec.groove];
    switch (sec.type) {
      case 'fight': return GROOVES[this.barInSec === sec.bars - 1 ? 'Mend' : 'M'];
      case 'fintro': return GROOVES.FI;
      case 'croll': return GROOVES.R;
      case 'charge': return GROOVES.CH;
      default: return null;
    }
  }

  onStep(s, t) {
    const g = this._groove();
    if (!g) return;
    const i = (this.barInSec % g.bars) * 16 + s;
    const T = this.sw(s, t), st = this.stepDur;
    // snares
    const c = g.S[i];
    const roll = this.sec.type === 'croll' || g === GROOVES.R || g === GROOVES.FI;
    switch (c) {
      case 'x': this.hit('snare', T, this.hv(0.62)); break;
      case 'X': this.hit('snare', T, this.hv(1)); break;
      case 'g': this.hit('snare', T, this.hv(0.28)); break;
      case 'r': this.hit('snare', T, this.hv(0.55)); this.hit('snare', T + st / 2, this.hv(0.45)); break;
      case 'R': this.hit('snare', T, this.hv(0.9)); this.hit('snare', T + st / 2, this.hv(0.7)); break;
      case 'f': this.hit('snare', T - 0.018, 0.35); this.hit('snare', T, this.hv(1)); break;
      case 'z': {
        const u = roll ? (this.barInSec * 16 + s) / (16 * (g.bars || 1)) : 0.5;
        for (let k = 0; k < 4; k++) this.hit('snare', T + (k * st) / 4, (0.22 + 0.6 * u) * (k % 2 ? 0.8 : 1));
        break;
      }
      default: break;
    }
    // tenors
    const tc = g.T[i];
    if (tc && tc !== '.') {
      const k = 'abcd'.indexOf(tc.toLowerCase());
      this.hit('q' + (k + 1), T, this.hv(tc === tc.toUpperCase() ? 1 : 0.7), { layer: 'perc', pan: TENOR_PAN[k] });
    }
    // bass drums
    const bc = g.B[i];
    if (bc && bc !== '.') this.hit('b' + bc, T, this.hv(0.9), { layer: 'kick', pan: (+bc - 3) * 0.22 });
    // cymbals
    const cc = g.C[i];
    if (cc === 'C') this.hit('crash', T, this.hv(0.9), { layer: 'cym', pan: 0.2 });
    else if (cc === 'k') this.hit('choke', T, this.hv(0.75), { layer: 'cym', pan: -0.2 });
    else if (cc === 's') this.hit('crash', T, 0.3, { layer: 'cym', pan: 0.3 });
    // brass
    const ty = this.sec.type;
    if (ty === 'fintro') this._intro(s, T);
    else if (ty === 'fight') this._fight(s, t, T);
    else if (ty === 'charge') this._charge(s, t, T);
  }

  _intro(s, T) {
    if (this.barInSec !== 1) return;
    if (s === 0) brassHit(this, this.S, T, this.chordAt(0), this.stepDur * 11, 0.9);
    if (s === 12 || s === 14) { this.S.tpt.note(T, 65, this.stepDur * 1.7, 0.85); this.glock.note(T, 89, 0.25, 0.4); }
  }

  _fight(s, t, T) {
    const mel = this.sec.part ? FIGHT_B : FIGHT_A;
    this.melodyPlay(this.S.tpt, mel, s, t, { vel: 0.92, gate: 0.88 });
    this.melodyPlay(this.glock, mel, s, t, { vel: 0.5, gate: 0.35, oct: 2 });
    const ch = this.chordAt(s), st = this.stepDur;
    if (s === 0 || s === 8) {
      const root = this.rootIn(ch, 34);
      this.S.tuba.note(T, s ? root + 7 - (root + 7 > 45 ? 12 : 0) : root, st * 3.4, this.hv(0.9));
      for (const m of this.voicing(ch, 3, 50, 65, 'bone')) this.S.bone.note(T, m, st * 7.5, 0.42);
    }
    if (s === 4 || s === 12) for (const m of this.voicing(ch, 3, 57, 70, 'horn')) this.S.horn.note(T, m, st * 1.5, this.hv(0.62));
  }

  _charge(s, t, T) {
    this.melodyPlay(this.S.tpt, CHARGE, s, t, { vel: 1, gate: 0.9 });
    this.melodyPlay(this.S.horn, CHARGE_LO, s, t, { vel: 0.8, gate: 0.9 });
    if (this.barInSec === 0 && s === 12) {
      const ch = this.chordAt(0);
      for (const m of this.voicing(ch, 3, 46, 62, 'bone')) this.S.bone.note(T, m, this.stepDur * 20, 0.6);
      this.S.tuba.note(T, this.rootIn(ch, 34), this.stepDur * 20, 0.8);
      this.glock.note(T, 89, 1.2, 0.5);
    }
  }
}

export class BandCadence extends MarchingBand { static mode = 'cadence'; }
export class BandFight extends MarchingBand { static mode = 'fight'; }
export class BandCharge extends MarchingBand { static mode = 'charge'; }
export class Halftime extends MarchingBand { static mode = 'halftime'; static pa = 0.3; }
export class Practice extends MarchingBand { static mode = 'cadence'; static pa = 0.35; }
