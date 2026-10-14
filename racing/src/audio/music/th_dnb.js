// Drum & bass family: NITRO 88.1 (liquid / jump-up station), race_city
// (neurofunk for wet neon streets) and race_boss (DnB drums × metal guitars ×
// alarm synth).

import { audio } from '../audio.js';
import { Song } from './song.js';
import { Mono, Rhodes, Poly, Guitar, VOWELS } from './inst.js';
import { pat, rolePat, makeChase } from './util.js';

// 4-bar Amen-style and Think-style breaks (one char per 16th)
const AMEN = {
  kick: pat('X.x.......xx....' + 'X.x.......xx....' + 'X.x.......x.....' + '..xX......x.....'),
  snare: pat('....X..o.o..X..o' + '....X..o.o..X..o' + '....X..o.o....x.' + '.o..X..o.o....x.'),
  hat: pat('x.o.x.o.x.o.x.o.'.repeat(4)),
};
const THINK = {
  kick: pat('X.....x...X.....' + 'X.....x...x..x..' + 'X.....x...X.....' + 'X.x.......x..x..'),
  snare: pat('....X..g.g..X..g' + '....X..g.g..X.g.' + '....X..g.g..X..g' + '....X.g..g..X.oo'),
  hat: pat('x.xox.xox.xox.xo'.repeat(4)),
};
// beat-slice maps for 2-bar blocks (indices into the 16 beats of a 4-bar break)
const CHOPS = [
  [0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14, 15],
  [0, 1, 2, 3, 0, 1, 10, 11], [0, 1, 2, 3, 4, 5, 14, 15], [0, 1, 6, 3, 4, 5, 6, 7],
  [8, 9, 2, 3, 4, 13, 14, 7], [0, 1, 2, 3, 12, 13, 14, 15], [4, 1, 2, 3, 4, 5, 6, 15],
  [0, 1, 2, 7, 4, 5, 6, 7], [8, 9, 10, 3, 12, 13, 6, 15],
];

function chop(brk, map) {
  const out = {};
  for (const role in brk) {
    const src = brk[role], beats = src.length / 4, p = new Array(32).fill(0);
    for (let b = 0; b < 8; b++) {
      const sb = map[b] % beats;
      for (let k = 0; k < 4; k++) p[b * 4 + k] = src[sb * 4 + k];
    }
    out[role] = p;
  }
  return out;
}

export const REESE = {
  oscs: [
    { type: 'sawtooth', detune: -17, gain: 0.42, pan: -0.45 },
    { type: 'sawtooth', detune: 15, gain: 0.42, pan: 0.45 },
    { type: 'sawtooth', detune: -4, gain: 0.25, mul: 0.5 },
  ],
  cut: 420, q: 3, poles: 4, env: 1100, fatk: 0.004, fdec: 0.28, keytrack: 1.5,
  drive: 2.2, post: 3200, hp: 70, sub: 0.75, subMul: 1, atk: 0.006, sus: 0.85, dec: 0.5, rel: 0.07, level: 0.42, glide: 0.07,
};

const LEAD_SAW = {
  oscs: [{ type: 'sawtooth', detune: -8, gain: 0.35 }, { type: 'sawtooth', detune: 8, gain: 0.35 }, { type: 'square', mul: 0.5, gain: 0.18 }],
  cut: 1800, q: 3, env: 3800, fatk: 0.003, fdec: 0.2, keytrack: 0.6, atk: 0.005, sus: 0.7, dec: 0.35, rel: 0.09,
  glide: 0.05, level: 0.26, drive: 1.4,
};

const RACE_FORM = () => [
  { type: 'intro', bars: 8 },
  { type: 'A', bars: 16 },
  { type: 'B', bars: 16 },
  { type: 'break', bars: 8 },
  { type: 'build', bars: 8 },
  { type: 'drop', bars: 16 },
  { type: 'A', bars: 16, var: 1 },
  { type: 'B', bars: 16, var: 1 },
  { type: 'break', bars: 8, var: 1 },
  { type: 'build', bars: 4 },
  { type: 'drop', bars: 16, var: 1 },
];

// ============================================================================
export class Nitro extends Song {
  static kind = 'menu';
  static intensity = 0.4;

  compose(r) {
    this.bpm = r.pick([172, 174, 174, 176]);
    this.keyPc = r.pick([5, 7, 9, 2, 4, 0]);
    this.scale = 'dorian';
    this.progs.main = this.P(r.pick([
      'i9:2 bVIM7:2 bIIIM7:2 bVII:2',
      'iv9:2 bVII9:2 bIIIM7:2 bVIM7:2',
      'i9:2 iv9:2 bVIIadd9:2 bIIIM7:2',
      'bVIM7:2 bVII:2 i9:2 v7:2',
    ]));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.kit = { ...this.kit, kick: 'kick_dnb', snare: 'snare_dnb', hat: 'hat_c', ride: 'ride' };
    this.mix = {
      kick: { v: 0.9 }, snare: { v: 0.62, rev: 0.12 }, hats: { v: 0.32 }, perc: { v: 0.26 }, cym: { v: 0.3, rev: 0.1 },
      bass: { v: 0.72 }, pad: { v: 0.36, rev: 0.3 }, chords: { v: 0.48, rev: 0.22, dly: 0.12 },
      lead: { v: 0.36, rev: 0.25, dly: 0.3 }, arp: { v: 0.26, dly: 0.3 }, fx: { v: 0.5, rev: 0.3 },
    };
    this.brk = r.chance(0.6) ? AMEN : THINK;
    this.bassPat = rolePat(r.pick([
      'R-------------r-R-------....a---',
      'R-------r-....r-R-------..o-r---',
      'R-----r-----r---R-------r-o-R---',
      'R---------------r-------O---R---',
    ]));
    this.compPat = r.pick([
      'x-------..x-----..x-----x-------',
      'x-----x-------x-..x-------x-----',
      '..x---..x-------..x---..x---x---',
    ]);
    this.liquid = r.chance(0.6);
    this.mel = this.hook({ bars: 8, lo: 69, hi: 86, call: 'x-----x---x-x---', resp: 'x---x-------x---', end: 'x-------x-------' });
    this.pumpBass = 0.3;
    this.pumpOnKick = true;
    this.dlyTime = this.beatDur * 0.75;
    this.sectionLayers.break = 'pad fx cym chords lead arp';
  }

  setup() {
    this.bass = new Mono(this, 'bass', { ...REESE, lfo: { rate: this.bpm / 120, depth: 260 } });
    this.rh = new Rhodes(this, 'chords', { level: 0.2, trem: 0.3, bright: 0.9 });
    this.padI = new Poly(this, 'pad', 'pad', { level: 0.32, atk: 0.5, rel: 1.2, cut: 2600 });
    this.leadI = new Poly(this, 'lead', this.liquid ? 'bell' : 'pluck', { level: 0.42, rel: 0.25 });
    this.stabI = new Poly(this, 'fx', 'stab', { level: 0.4 });
    this._chopped = chop(this.brk, CHOPS[0]);
  }

  drumSet() {
    if (this.sec.type === 'break') return null;
    return this._chopped;
  }

  onBar() {
    if ((this.barInSec & 1) === 0) {
      const r = this.barRng(3);
      const base = CHOPS[(this.barInSec >> 1) & 1];
      const map = this.barInSec % 8 === 6 || r.chance(0.3) ? r.pick(CHOPS) : base;
      this._chopped = chop(this.brk, map);
      if (this.sec.type === 'B') this._chopped.ride = pat('x.x.x.x.x.x.x.x.'.repeat(2));
    }
  }

  onStep(s, t) {
    if (this.on('perc') && (s & 1)) this.hit('shaker', this.sw(s, t), s % 4 === 3 ? 0.55 : 0.3);
    if (this.on('pad')) this.padPlay(this.padI, s, t, { n: 4, lo: 50, hi: 74, vel: 0.55 });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 29 });
    if (this.on('chords')) this.compPlay(this.rh, this.compPat, s, t, { n: 4, lo: 57, hi: 77, vel: 0.62 });
    if (this.on('lead')) this.melodyPlay(this.leadI, this.mel, s, t, { vel: 0.75 });
  }

  stab(t, ch, vel) { this.stabChord(this.stabI, t, ch, vel, 57, 79, 0.4); }
}

// ============================================================================
const TWOSTEP = {
  A: {
    kick: pat('X.........X.....' + 'X.........X..x..'),
    snare: pat('....X.......X...'),
    ghost: pat('.......g.g....g.' + '..g....g.g.....g'),
    hat: pat('x.o.x.o.x.o.x.o.' + 'x.o.x.o.x.o.x.oo'),
  },
  B: {
    kick: pat('X.........X.....' + 'X.....x...X.....'),
    snare: pat('....X.......X...'),
    ghost: pat('.g.....g.g....g.' + '.......g.g..g..g'),
    hat: pat('xoxoxoxoxoxoxoxo'),
    ohat: pat('..............x.'),
  },
  drop: {
    kick: pat('X.x.......X.....' + 'X.........X.x...'),
    snare: pat('....X.......X...'),
    ghost: pat('.......g.g....g.'),
    ride: pat('x.x.x.x.x.x.x.x.'),
    hat: pat('..x...x...x...x.'),
  },
};

const NEURO = {
  oscs: [{ type: 'sawtooth', detune: -13, gain: 0.45 }, { type: 'sawtooth', detune: 11, gain: 0.45 }, { type: 'square', mul: 2, gain: 0.2 }],
  cut: 520, q: 7, env: 2600, fatk: 0.002, fdec: 0.1, keytrack: 2, drive: 5, asym: 0.1, post: 4200, hp: 60,
  formant: [[600, 4, 0.9], [1400, 5, 0.6]], formDry: 0.45,
  sub: 0.8, subMul: 1, level: 0.36, atk: 0.003, sus: 0.75, dec: 0.25, rel: 0.04, glide: 0.05,
};

export class City extends Song {
  static kind = 'race';
  static intensity = 0.85;

  compose(r) {
    this.bpm = r.pick([170, 172, 174]);
    this.keyPc = r.pick([4, 5, 6, 7, 2]);
    this.scale = r.chance(0.4) ? 'phrygian' : 'minor';
    this.progs.main = this.P(r.pick([
      'i:2 bVI:2 bIII:2 bVII:2',
      'i:2 iv:2 bVI:2 V:2',
      'i:4 bVI:2 bVII:2',
      'i:2 bVI:2 iv:2 v:2',
    ]));
    this.progs.countdown = this.P('V');
    this.form = RACE_FORM();
    this.loopFrom = 1;
    this.drums = TWOSTEP;
    this.introLP = 900;
    this.breakLP = 6000;
    this.mix = {
      kick: { v: 0.18 }, snare: { v: 0.26, rev: 0.14 }, hats: { v: 0.16 }, perc: { v: 0.2 }, cym: { v: 0.22, rev: 0.1 },
      bass: { v: 0.58 }, pad: { v: 0.6, rev: 0.35 }, chords: { v: 0.5, rev: 0.3, dly: 0.2 },
      lead: { v: 1.1, rev: 0.2, dly: 0.26 }, arp: { v: 0.3, dly: 0.35 }, fx: { v: 1, rev: 0.25 }, extra: { v: 0.5, rev: 0.4 },
    };
    const riffs = [
      'R-.r..R-.r.R....R-.r..R-.r..B-r-',
      'R--.R-.rR--.r.o-R--.R-.rR-..A---',
      'R.R..R.r..R.r.R.R.R..R.r..R.b.r.',
      'R-------r.r.R---..r.R-..r.O-r---',
    ];
    const i = r.int(0, riffs.length - 1);
    this.riffs = [rolePat(riffs[i]), rolePat(riffs[(i + 1 + r.int(0, 2)) % riffs.length])];
    this.stabPat = r.pick([
      '......x.......x.' + '......x...x.....',
      '..x.......x.....' + '..x.......x..x..',
      'x..x............' + '.......x..x.....',
    ]);
    this.mel = this.hook({ bars: 8, lo: 67, hi: 84, call: 'x..x..x...x.x...', resp: 'x..x..x.x.......', end: 'x.x.x...x-------' });
    this.chase = makeChase(r, this.keyPc, 50);
    this.pumpBass = 0.4;
    this.pumpOnKick = true;
    this.dlyTime = this.stepDur * 3;
    this.vowels = [[VOWELS.o[0], VOWELS.u[0]], [VOWELS.o[1], VOWELS.u[1]]];
  }

  setup() {
    this.bass = new Mono(this, 'bass', { ...NEURO, lfo: { rate: this.bpm / 30, depth: 380 } });
    this.padI = new Poly(this, 'pad', 'pad', { level: 0.3, atk: 0.7, rel: 1.6, cut: 1500 });
    this.stabI = new Poly(this, 'chords', 'stab', { level: 0.4, cut: 3200 });
    this.leadI = new Mono(this, 'lead', LEAD_SAW);
    this.arpI = new Poly(this, 'arp', 'pluck', { level: 0.32 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.3, atk: 0.4, rel: 1 });
    this.fxStab = new Poly(this, 'fx', 'stab', { level: 0.42 });
    // rain on wet streets
    this.bed(audio.noise('pink'), 'fx', 0.12, [['bandpass', 5200, 0.6], ['highpass', 1400, 0]]);
  }

  onCountdown(t) {
    const v = this.voicing(this.chord, 4, 52, 72, 'pad');
    for (const m of v) this.padI.note(t, m, 20, 0.45, { force: true });
  }

  cdStep(s, t, e) {
    if ((s & 1) === 0) this.bass.note(t, this.rootIn(this.chord, 31), this.stepDur * 1.5, Math.min(1, 0.45 + e / 8), { force: true, cut: 300 + e * 200 });
  }

  onStep(s, t) {
    const sec = this.sec, ty = sec.type;
    if (this.on('pad')) this.padPlay(this.padI, s, t, { n: 4, lo: 50, hi: 72, vel: 0.5 });
    if (this.on('bass')) {
      const riff = this.riffs[(sec.var || 0) + (this.cycle || 0) & 1];
      this.rolePlay(this.bass, riff, s, t, {
        lo: 28,
        nopts: (i) => ({ vowel: this.vowels.map((v) => (((i >> 2) & 1) ? [v[1], v[0]] : v)) }),
      });
    }
    if (this.on('chords') && ty !== 'break') this.compPlay(this.stabI, this.stabPat, s, t, { n: 4, lo: 55, hi: 74, vel: 0.6, gate: 0.5 });
    if (this.on('arp') && (ty === 'intro' || ty === 'break' || ty === 'build')) {
      this.arpPlay(this.arpI, s, t, { rate: 2, pat: [0, 2, 1, 3, 2, 4, 3, 1], lo: 62, hi: 84, vel: 0.5, gate: 0.5 });
    }
    if (this.on('lead')) {
      if (ty === 'break') { if (this.leading) this.melodyPlay(this.arpI, this.mel, s, t, { vel: 0.55, gate: 1 }); }
      else if (this.leading) this.melodyPlay(this.leadI, this.mel, s, t, { vel: 0.85 });
      else this.melodyPlay(this.leadI, this.chase, s, t, { vel: 0.6, gate: 0.6 });
    }
    if (this.on('extra')) {
      this.padPlay(this.choir, s, t, { n: 3, lo: 64, hi: 82, key: 'choir', vel: 0.5 });
      if (s & 1) this.hit('hat2', this.sw(s, t), 0.35, { layer: 'perc' });
    }
    if (this.on('perc') && s === 6 && (this.barInSec & 1)) this.hit('rim', this.sw(s, t), 0.5);
  }

  stab(t, ch, vel) { this.stabChord(this.fxStab, t, ch, vel, 55, 76, 0.5); }
}

// ============================================================================
const BOSS_DRUMS = {
  A: {
    kick: pat('X.x.......X.x...' + 'X.x.......X..xx.'),
    snare: pat('....X.......X...'),
    ghost: pat('.......g.g......' + '..g....g.g....g.'),
    hat: pat('x.x.x.x.x.x.x.x.'),
  },
  B: {
    kick: pat('X.x...x.X.x.....' + 'X.x.......X.x.x.'),
    snare: pat('....X.......X...'),
    ghost: pat('.......g.g....g.'),
    hat: pat('xoxoxoxoxoxoxoxo'),
  },
  drop: {
    kick: pat('X.x...x.X.x...x.'),
    snare: pat('....X.......X...'),
    china: pat('....x.......x...'),
    ride: pat('x.x.x.x.x.x.x.x.'),
    ghost: pat('.......g.g......'),
  },
};

export class Boss extends Song {
  static kind = 'race';
  static intensity = 0.9;

  compose(r) {
    this.bpm = r.pick([172, 174, 176]);
    this.keyPc = r.pick([1, 2, 4, 6]);
    this.scale = r.chance(0.5) ? 'harmonic' : 'phrygian';
    this.progs.main = this.P(r.pick(['i:2 bII:2 bVI:2 V:2', 'i:2 bVI:2 bII:2 V:2', 'i:2 iv:2 bII:2 V:2', 'i:4 bII:2 V:2']));
    this.progs.countdown = this.P('V');
    this.form = RACE_FORM();
    this.form[0] = { type: 'intro', bars: 4 };
    this.loopFrom = 1;
    this.drums = BOSS_DRUMS;
    this.kit = { ...this.kit, kick: 'kick_metal', snare: 'snare_dnb', crash: 'crash', china: 'china' };
    this.introLP = 1200;
    this.mix = {
      kick: { v: 0.9 }, snare: { v: 0.7, rev: 0.12 }, hats: { v: 0.28 }, perc: { v: 0.25 }, cym: { v: 0.32, rev: 0.1 },
      bass: { v: 0.62 }, pad: { v: 0.26, rev: 0.3 }, gtr: { v: 0.5 }, arp: { v: 0.26, rev: 0.15 },
      lead: { v: 0.34, rev: 0.18, dly: 0.2 }, fx: { v: 0.5, rev: 0.25 }, extra: { v: 0.26, rev: 0.4 }, chords: { v: 0.3 },
    };
    this.chugs = [
      r.pick(['x.xx.x.xX.x.xx..', 'xxx.xx.xX..xx.x.', 'X.x.x.xx..x.X...']),
      r.pick(['x.x.xxx.x.x.X...', 'X..xx.x.X..xx.xx', 'xx.xX.x.xx.xX.x.']),
    ];
    this.bassPat = rolePat(r.pick(['R-----r-R-r-----R-----r-R---B-r-', 'R-r---r-R-----r-R-r---r-R-..A---']));
    this.mel = this.hook({ bars: 8, lo: 66, hi: 82, call: 'x.x.x.xx.x.x.xx.', resp: 'x.x.x.x.x---x...', end: 'x.xx.xx.x-------', leap: 0.4 });
    this.chase = makeChase(r, this.keyPc, 62);
    this.pumpBass = 0.35;
    this.pumpOnKick = true;
    this.dlyTime = this.stepDur * 3;
    this.sectionLayers.break = 'pad fx cym arp lead chords';
  }

  setup() {
    this.gtr = new Guitar(this, 'gtr', { level: 0.5, drive: 26 });
    this.bass = new Mono(this, 'bass', { ...REESE, level: 0.4, lfo: { rate: this.bpm / 60, depth: 200 } });
    this.padI = new Poly(this, 'pad', 'strings', { level: 0.3, atk: 0.4, rel: 1, cut: 2400 });
    this.alarm = new Mono(this, 'arp', {
      oscs: [{ type: 'square', gain: 0.4 }, { type: 'sawtooth', detune: 9, gain: 0.3 }], cut: 2600, q: 6, env: 0,
      drive: 3, post: 5000, atk: 0.004, sus: 1, rel: 0.03, level: 0.16, glide: 0.03,
    });
    this.leadI = new Mono(this, 'lead', { ...LEAD_SAW, drive: 3, level: 0.24 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.32, atk: 0.4, rel: 1 });
    this.fxStab = new Poly(this, 'fx', 'brass', { level: 0.45 });
  }

  onCountdown(t) {
    const v = this.voicing(this.chord, 3, 50, 70, 'pad');
    for (const m of v) this.padI.note(t, m, 20, 0.5, { force: true });
  }

  cdStep(s, t, e) {
    if ((s & 1) === 0) this.gtr.play(t, this.rootIn(this.chord, 38), { mute: true, vel: 0.5 + e / 10, force: true });
  }

  onStep(s, t) {
    const ty = this.sec.type;
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.padI, s, t, { n: 3, lo: 50, hi: 70, vel: 0.5 });
    if (this.on('gtr') && ty !== 'break') {
      const p = this.chugs[(this.barInSec + (this.sec.var || 0)) & 1];
      const c = p[s];
      if (c === 'x' || c === 'X') {
        let len = 1;
        while (s + len < 16 && p[s + len] === '-') len++;
        const root = this.rootIn(this.chordAt(s), 38);
        this.gtr.play(T, root, { mute: c === 'x', vel: c === 'x' ? 0.75 : 0.95, dur: c === 'x' ? this.stepDur * 0.9 : this.stepDur * (len + 1) });
      }
    }
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 26 });
    if (this.on('arp') && (ty === 'drop' || ty === 'B' || ty === 'break')) {
      // two-tone alarm on 8ths
      if ((s & 1) === 0) {
        const hi = (s >> 1) & 1;
        const root = this.rootIn(this.chordAt(s), 72);
        this.alarm.note(T, root + (hi ? 1 : 0), this.stepDur * 1.8, 0.8, { slide: true });
      }
    }
    if (this.on('lead')) {
      if (this.leading) this.melodyPlay(this.leadI, this.mel, s, t, { vel: 0.85 });
      else if (ty !== 'break') this.melodyPlay(this.leadI, this.chase, s, t, { vel: 0.7, gate: 0.55 });
    }
    if (this.on('extra')) {
      this.padPlay(this.choir, s, t, { n: 3, lo: 62, hi: 80, key: 'choir', vel: 0.5 });
      if (s & 1) this.hit('hat2', T, 0.35, { layer: 'perc' });
    }
  }

  stab(t, ch, vel) { this.stabChord(this.fxStab, t, ch, vel, 50, 72, 0.6); }
}
