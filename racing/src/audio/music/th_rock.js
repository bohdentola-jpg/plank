// Rock family: race_circuit (big beat / electro-rock: breakbeat, distorted acid
// line, power-chord stabs), race_desert (desert rock road trip: twangy
// baritone, train beat, fuzz bass, spaghetti-western whistle) and race_docks
// (industrial nu-metal: drop-D palm-mute chugs, pounding drums, menacing stabs).

import { Song } from './song.js';
import { Mono, Poly, Guitar, Twang, Breath } from './inst.js';
import { pat, rolePat, makeChase, rhythm, indexNotes, makeMelody } from './util.js';

const ROCK_FORM = (r) => {
  const f = [
    { type: 'intro', bars: 8 },
    { type: 'A', bars: r.pick([8, 16, 16]) },
    { type: 'B', bars: 16 },
    { type: 'break', bars: r.pick([4, 8, 8]) },
    { type: 'build', bars: 4 },
    { type: 'drop', bars: 16 },
    { type: 'A', bars: 16, var: 1 },
    { type: 'B', bars: r.pick([8, 16]), var: 1 },
    { type: 'break', bars: 8, var: 1 },
    { type: 'build', bars: 4 },
    { type: 'drop', bars: 16, var: 1 },
  ];
  if (r.chance(0.5)) f.splice(7, 0, { type: 'drop', bars: 8, var: 1 });
  return f;
};

const LEAD_SQ = {
  oscs: [{ type: 'square', gain: 0.35 }, { type: 'square', detune: 14, gain: 0.3 }, { type: 'sawtooth', mul: 0.5, gain: 0.15 }],
  cut: 2400, q: 2, env: 2400, fatk: 0.003, fdec: 0.25, keytrack: 0.4, atk: 0.006, sus: 0.8, dec: 0.4, rel: 0.08,
  glide: 0.07, level: 0.24, drive: 1.6,
};

/** Play a guitar riff step: x mute / X open power chord; b B = flat two; 5 % = flat five; '-' hold. */
function riffStep(song, gtr, p, s, t, root, o = {}) {
  const c = p[s % p.length];
  if (c === '.' || c === '-') return null;
  let len = 1;
  while (s + len < p.length && p[s + len] === '-') len++;
  const open = c === 'X' || c === 'B' || c === '%';
  const off = c === 'b' || c === 'B' ? 1 : c === '5' || c === '%' ? 6 : 0;
  gtr.play(song.sw(s, t), root + off, {
    mute: !open, vel: open ? 0.95 : 0.78, dur: open ? song.stepDur * (len + 0.6) : song.stepDur * 0.85, note: o.note,
  });
  return { open, off };
}

// ============================================================================
export class Circuit extends Song {
  static kind = 'race';
  static intensity = 0.85;

  compose(r) {
    this.bpm = r.pick([128, 130, 132, 134, 136]);
    this.keyPc = r.pick([4, 9, 2, 7, 6]);
    const mixo = r.chance(0.3);
    this.scale = mixo ? 'mixolydian' : 'minor';
    this.progs.main = this.P(mixo ? 'I:2 bVII:2 IV:2 I:2' : r.pick(['i:2 bVII:2 bVI:2 bVII:2', 'i:2 bIII iv i:2 bVII:2', 'i:4 bVI:2 bVII:2', 'i:2 iv:2 bVI:2 bVII:2']));
    this.progs.countdown = this.P(mixo ? 'bVII' : 'bVII');
    this.form = ROCK_FORM(r);
    this.loopFrom = 1;
    this.introLP = 1000;
    this.kit = { ...this.kit, kick: 'kick_rock', snare: 'snare_rock', hat: 'hat_c', ohat: 'hat_o', crash: 'crash' };
    this.drums = {
      A: {
        kick: pat('X......x.x......' + 'X......x.x....x.'),
        snare: pat('....X.......X...'),
        ghost: pat('......g.....g..g'),
        hat: pat('x.ox.ox.x.ox.ox.'),
        tamb: pat('..x...x...x...x.'),
      },
      B: {
        kick: pat('X.x...x...x.....' + 'X......x.x......'),
        snare: pat('....X.......X...'),
        ghost: pat('.g....g.......g.'),
        hat: pat('xoxoxoxoxoxoxoxo'),
        tamb: pat('x.x.x.x.x.x.x.x.'),
      },
      drop: {
        kick: pat('X......xX.x.....'),
        snare: pat('....X.......X...'),
        ohat: pat('..x...x...x...x.'),
        hat: pat('x...x...x...x...'),
        tamb: pat('xoxoxoxoxoxoxoxo'),
      },
    };
    this.kit.hat = 'hat_c';
    // acid line: per step { deg, acc, slide } or null
    const degs = mixo ? [0, 0, 0, 12, 0, 4, 7, 10, 12, 5, -2] : [0, 0, 0, 12, 0, 3, 7, 10, 12, 5, -2];
    const mk = () => Array.from({ length: 16 }, (_, s) => (r.chance(s % 4 === 0 ? 0.92 : 0.58) ? { deg: s === 0 ? 0 : r.pick(degs), acc: r.chance(0.3), slide: s > 0 && r.chance(0.22) } : null));
    this.acid = [mk(), mk()];
    this.gtrPat = [r.pick(['X--.....X--.....', 'X--...X-..X--...', 'X-.X-.X-........']), r.pick(['X--.....x.x.X---', 'X-.x.xX-..X-x.x.'])];
    this.mel = this.hook({ bars: 8, lo: 64, hi: 81, call: 'x.x..x.x..x.x...', resp: 'x.x..x.x-.......', end: 'x..x..x.x-------', leap: 0.35 });
    this.chase = makeChase(r, this.keyPc, 52);
    this.pumpBass = 0.25;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.25, rev: 0.2 }, hats: { v: 0.14 }, perc: { v: 0.12 }, cym: { v: 0.2, rev: 0.1 },
      bass: { v: 0.6 }, pad: { v: 0.4, rev: 0.3 }, arp: { v: 0.5, dly: 0.12 }, gtr: { v: 0.5, rev: 0.08 },
      lead: { v: 0.9, rev: 0.2, dly: 0.2 }, fx: { v: 0.6, rev: 0.2 }, extra: { v: 0.5, rev: 0.4 }, chords: { v: 0.4 },
    };
    this.dlyTime = this.stepDur * 3;
  }

  setup() {
    this.acidI = new Mono(this, 'arp', {
      oscs: [{ type: 'sawtooth', gain: 0.6 }], cut: 320, q: 16, env: 2600, fatk: 0.002, fdec: 0.14, keytrack: 0.8,
      accent: 1.5, drive: 6, asym: 0.1, post: 3800, hp: 80, atk: 0.003, sus: 0.7, dec: 0.25, rel: 0.03, glide: 0.06, level: 0.35,
    });
    this.gtr = new Guitar(this, 'gtr', { level: 0.5, drive: 20, tone: 5200 });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.4 }, { type: 'square', gain: 0.3, mul: 0.5 }], cut: 500, q: 1, env: 600, fdec: 0.2,
      drive: 3, post: 1800, sub: 0.6, subMul: 0.5, atk: 0.004, sus: 0.85, dec: 0.4, rel: 0.05, level: 0.42,
    });
    this.leadI = new Mono(this, 'lead', LEAD_SQ);
    this.padI = new Poly(this, 'pad', 'saw3', { level: 0.25, atk: 0.4, rel: 1, cut: 1800 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.3, atk: 0.4, rel: 1 });
    this.fxStab = new Poly(this, 'fx', 'brass', { level: 0.45 });
  }

  cdStep(s, t, e) {
    if ((s & 1) === 0) this.acidI.note(t, this.rootIn(this.chord, 40), this.stepDur, 0.8, { force: true, cut: 200 + e * 260, accent: (s & 3) === 0 });
  }

  onStep(s, t) {
    const ty = this.sec.type;
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.padI, s, t, { n: 3, lo: 55, hi: 74, vel: 0.5 });
    if (this.on('arp')) {
      const line = this.acid[((this.barInSec >> 1) + (this.sec.var || 0)) & 1];
      const n = line[s];
      if (n) {
        const root = this.rootIn(this.chordAt(s), 38);
        const open = ty === 'drop' ? 700 : ty === 'B' ? 520 : ty === 'build' ? 300 + 700 * (this.barInSec / this.sec.bars) : 360;
        const nxt = line[(s + 1) % 16];
        this.acidI.note(T, root + n.deg, this.stepDur * (nxt && nxt.slide ? 1.05 : 0.6), n.acc ? 1 : 0.75, { accent: n.acc, slide: n.slide, cut: open });
      }
    }
    if (this.on('gtr') && ty !== 'break' && ty !== 'intro') {
      riffStep(this, this.gtr, this.gtrPat[(this.barInSec + (this.sec.var || 0)) & 1], s, t, this.rootIn(this.chordAt(s), 40));
    }
    if (this.on('bass') && (s & 3) === 0) {
      const root = this.rootIn(this.chordAt(s), 28);
      this.bass.note(T, root, this.beatDur * 0.9, (s & 7) === 0 ? 0.9 : 0.75);
    }
    if (this.on('lead')) {
      if (this.leading) this.melodyPlay(this.leadI, this.mel, s, t, { vel: 0.85 });
      else if (ty !== 'break') this.melodyPlay(this.leadI, this.chase, s, t, { vel: 0.6, gate: 0.5 });
    }
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 64, hi: 81, key: 'choir', vel: 0.5 });
    if (this.on('fx') && ty === 'drop' && s === 14 && (this.barInSec & 3) === 3) this.hit('zap', T, 0.6, { pan: 0.4 });
  }

  stab(t, ch, vel) {
    this.stabChord(this.fxStab, t, ch, vel, 52, 72, 0.5);
    this.gtr.play(t, this.rootIn(ch, 40), { vel: 1, dur: 1.2, force: true });
  }
}

// ============================================================================
export class Desert extends Song {
  static kind = 'race';
  static intensity = 0.85;

  compose(r) {
    this.bpm = r.pick([114, 116, 118, 120, 122]);
    this.swing = 0.06;
    this.humanize = 0.004;
    this.keyPc = r.pick([4, 9, 2]);
    this.scale = r.chance(0.6) ? 'harmonic' : 'minor';
    this.progs.main = this.P(r.pick(['i bVII bVI V', 'i:2 iv V', 'i:2 bII:2', 'i bVII i V', 'i:2 bVI V']));
    this.progs.countdown = this.P('V');
    this.form = ROCK_FORM(r);
    this.loopFrom = 1;
    this.introLP = 1400;
    this.kit = { ...this.kit, kick: 'kick_rock', snare: 'snare_rock', hat: 'hat_c', ohat: 'hat_o', ride: 'ride' };
    this.drums = {
      A: { // train beat
        kick: pat('X.......X.x.....'),
        snare: pat('g.g.X.g.g.g.X.g.'),
        hat: pat('x...x...x...x...'),
        tamb: pat('..x...x...x...x.'),
      },
      B: {
        kick: pat('X...X.x.X...X...'),
        snare: pat('....X.......X...'),
        ride: pat('x.x.x.x.x.x.x.x.'),
        tamb: pat('..x...x...x...x.'),
      },
      drop: {
        kick: pat('X...X.x.X...X.x.'),
        snare: pat('....X.......X..g'),
        ride: pat('X.x.X.x.X.x.X.x.'),
        tamb: pat('xoxoxoxoxoxoxoxo'),
      },
    };
    // twang riff: low-register melody sequenced over the changes (2-bar unit)
    const rr = rhythm(r.pick(['x.x.x-x-x.x.x---' + 'x.x.x-x-x-x.x---', 'x--.x.x-x--.x.x-' + 'x--.x.x-x-x-x---', 'x.xx-.x.x.xx-.x.' + 'x.xx-.x.x-x-x---']));
    const p = this.progs.main;
    const chordAt = (bar, s) => p.chords[p.beats[(bar * 4 + (s >> 2)) % p.len]];
    const bars = Math.max(2, p.len / 4);
    this.riff = { idx: indexNotes(makeMelody({ r, bars, chordAt, keyPc: this.keyPc, scale: this.scale, lo: 40, hi: 57, rhythms: { call: rr, resp: rr, end: rr }, leap: 0.4 }), bars), bars };
    this.mel = this.hook({ bars: 8, lo: 72, hi: 88, call: 'x-------x---x---', resp: 'x---x---x-------', end: 'x-----x-x-------', leap: 0.45 });
    this.chase = makeChase(r, this.keyPc, 52);
    this.mix = {
      kick: { v: 0.22 }, snare: { v: 0.24, rev: 0.2 }, hats: { v: 0.14 }, perc: { v: 0.12 }, cym: { v: 0.2, rev: 0.12 },
      bass: { v: 0.6 }, pad: { v: 0.35, rev: 0.4 }, gtr: { v: 0.7, rev: 0.25 }, lead: { v: 0.8, rev: 0.4, dly: 0.25 },
      fx: { v: 0.6, rev: 0.3 }, extra: { v: 0.45, rev: 0.4 }, chords: { v: 0.4 }, arp: { v: 0.5, rev: 0.25 },
    };
    this.dlyTime = this.beatDur * 0.75;
    this.sectionLayers.break = 'pad fx cym gtr lead arp';
  }

  setup() {
    this.twang = new Twang(this, 'gtr', { level: 0.55, pan: -0.15 });
    this.twang2 = new Twang(this, 'arp', { level: 0.4, pan: 0.3, trem: 0.5, tremRate: 7 });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.45 }, { type: 'square', gain: 0.3 }], cut: 900, q: 1, env: 300, fdec: 0.2,
      drive: 8, asym: 0.25, post: 1300, sub: 0.55, subMul: 1, atk: 0.005, sus: 0.85, dec: 0.4, rel: 0.06, level: 0.32,
    });
    this.whistle = new Breath(this, 'lead', { wave: 'sine', level: 0.32, lp: 6000, vib: 28, vibRate: 5.8, breath: 0.1, glide: 0.09, atk: 0.04, rel: 0.12 });
    this.organ = new Poly(this, 'pad', 'strings', { level: 0.25, atk: 0.8, rel: 1.5, cut: 2000 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.3, atk: 0.4, rel: 1 });
    this.fxStab = new Poly(this, 'fx', 'brass', { level: 0.42 });
  }

  cdStep(s, t, e) {
    if ((s & 1) === 0) this.twang2.play(t, this.rootIn(this.chord, 52), this.stepDur * 1.5, 0.4 + e / 10, { force: true });
  }

  onStep(s, t) {
    const ty = this.sec.type;
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.organ, s, t, { n: 3, lo: 55, hi: 72, vel: 0.45 });
    if (this.on('gtr')) {
      if (ty === 'break') {
        // slow, reverb-drenched melody on the baritone
        this.melodyPlay({ note: (tt, m, d, v) => this.twang.play(tt, m - 12, d, v) }, this.mel, s, t, { vel: 0.6 });
      } else if (ty !== 'intro' || this.barInSec >= 4) {
        const k = (this.barInSec % this.riff.bars) * 16 + s;
        const nt = this.riff.idx[k];
        if (nt) this.twang.play(T, nt.m, nt.len * this.stepDur * 0.95, 0.8 * nt.v, { slide: nt.len >= 3 && (k & 7) === 0 ? 1 : 0 });
      }
    }
    if (this.on('bass') && (s & 1) === 0 && ty !== 'intro') {
      const root = this.rootIn(this.chordAt(s), 28);
      const oct = s === 6 || s === 14;
      this.bass.note(T, oct ? root + 12 : root, this.stepDur * 1.6, (s & 3) === 0 ? 0.9 : 0.7);
    }
    if (this.on('lead')) {
      if (this.leading) this.melodyPlay(this.whistle, this.mel, s, t, { vel: 0.85, legato: true });
      else if (ty !== 'break' && this.on('arp')) {
        // behind: nervous tremolo-picked tension line
        const k = (this.barInSec & 1) * 16 + s;
        const nt = this.chase.idx[k - (k % 2)];
        if (nt) this.twang2.play(T, nt.m + 12, this.stepDur * 0.9, 0.55);
      }
    }
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 64, hi: 81, key: 'choir', vel: 0.5 });
  }

  stab(t, ch, vel) {
    this.stabChord(this.fxStab, t, ch, vel, 52, 72, 0.6);
    this.twang.play(t, this.rootIn(ch, 40), 1.5, 1, { force: true });
  }
}

// ============================================================================
export class Docks extends Song {
  static kind = 'race';
  static intensity = 0.85;

  compose(r) {
    this.bpm = r.pick([96, 98, 100, 102, 104]);
    this.humanize = 0.003;
    this.keyPc = r.pick([2, 2, 1, 0]);
    this.scale = r.chance(0.5) ? 'phrygian' : 'minor';
    this.progs.main = this.P(r.pick(['i:2 bII:2 bVI:2 v:2', 'i:4 bVI:2 bII:2', 'i:2 bIII bII i:2 bVI:2', 'i:2 bVI:1 bVII:1']));
    this.progs.countdown = this.P('bII');
    this.form = ROCK_FORM(r);
    this.loopFrom = 1;
    this.introLP = 800;
    this.kit = { ...this.kit, kick: 'kick_metal', snare: 'snare_rock', hat: 'hat_c', ohat: 'hat_o', china: 'china' };
    this.chugs = [
      r.pick(['x.xx.x.xx..xx.x.', 'xx.x.xx.x.xx..X-', 'x..x..x.x..x..X-', 'x.x.xxb.x.x.xxB-']),
      r.pick(['x.xx.x.xb..bx.x.', 'X-..x.x.X-..xx5.', 'xx.xxx.xX-.xxb.b', 'x..x..x.X--.x5x.']),
    ];
    // kick doubles the chugs on the 8th grid
    const kk = (c) => pat([...c].map((ch, s) => (/[xXbB5%]/.test(ch) && (s % 2 === 0 || ch === 'X') ? (s % 4 === 0 ? 'X' : 'x') : '.')).join(''));
    this.drums = {
      A: { kick: pat('X.......x.x.....'), snare: pat('........X.......'), hat: pat('x.x.x.x.x.x.x.x.'), china: pat('............x...') },
      B: { kick: kk(this.chugs[0]), snare: pat('....X.......X...'), hat: pat('x.x.x.x.x.x.x.x.') },
      drop: { kick: kk(this.chugs[1]), snare: pat('....X.......X...'), china: pat('x...x...x...x...'), hat: pat('..x...x...x...x.') },
    };
    this.stabPat = r.pick(['X.......X..X....', 'X..X..........X.', '........X.X.X...']);
    this.mel = this.hook({ bars: 8, lo: 62, hi: 79, call: 'x-----x-x-----x-', resp: 'x---x---x-x-----', end: 'x-------x-------', leap: 0.3, scale: 'harmonic' });
    this.chase = makeChase(r, this.keyPc, 50);
    this.fills = ['toms', 'mix', 'toms', 'stop'];
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.25, rev: 0.22 }, hats: { v: 0.12 }, perc: { v: 0.16, rev: 0.2 }, cym: { v: 0.2, rev: 0.12 },
      bass: { v: 0.55 }, pad: { v: 0.35, rev: 0.4 }, gtr: { v: 0.55 }, chords: { v: 0.45, rev: 0.2 },
      lead: { v: 0.8, rev: 0.35, dly: 0.25 }, fx: { v: 0.6, rev: 0.3 }, extra: { v: 0.45, rev: 0.4 }, arp: { v: 0.4 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.gtr = new Guitar(this, 'gtr', { level: 0.5, drive: 30, tone: 4600, scoop: -4 });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.25, mul: 0.5 }], cut: 700, q: 2, env: 500, fdec: 0.1,
      drive: 6, post: 1500, sub: 0.6, subMul: 1, atk: 0.003, sus: 0.8, dec: 0.2, rel: 0.04, level: 0.32,
    });
    this.stabI = new Poly(this, 'chords', 'stab', { level: 0.4, drive: 3, cut: 2600, q: 3 });
    this.padI = new Poly(this, 'pad', 'strings', { level: 0.3, atk: 0.8, rel: 1.4, cut: 1600 });
    this.leadI = new Breath(this, 'lead', { wave: 'square', level: 0.16, lp: 2200, vib: 30, vibRate: 4.2, breath: 0.05, glide: 0.12, atk: 0.06, rel: 0.2 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.3, atk: 0.4, rel: 1 });
    this.fxStab = new Poly(this, 'fx', 'stab', { level: 0.45, drive: 2 });
  }

  cdStep(s, t, e) {
    if ((s & 1) === 0) this.gtr.play(t, this.rootIn(this.progs.main.chords[0], 35), { mute: true, vel: 0.5 + e / 10, force: true });
  }

  onStep(s, t) {
    const ty = this.sec.type;
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.padI, s, t, { n: 3, lo: 50, hi: 69, vel: 0.5 });
    const root = this.rootIn(this.chordAt(s), 35);
    let hit = null;
    if (this.on('gtr') && ty !== 'break' && ty !== 'intro') {
      const p = this.chugs[ty === 'drop' ? 1 : (this.barInSec >> 1) & 1];
      hit = riffStep(this, this.gtr, p, s, t, root);
    }
    if (this.on('bass') && ty !== 'intro') {
      if (hit) this.bass.note(T, root - 12 + hit.off, this.stepDur * (hit.open ? 2 : 0.9), hit.open ? 0.95 : 0.8);
      else if (!this.on('gtr') && (s & 7) === 0) this.bass.note(T, root - 12, this.beatDur * 1.8, 0.7);
    }
    if (this.on('chords') && ty !== 'break' && this.stabPat[s] !== '.') {
      const v = this.voicing(this.chordAt(s), 3, 50, 67, 'stab');
      this.stabI.chord(T, v.concat([v[0] + 1]), this.stepDur * 2, this.stabPat[s] === 'X' ? 0.8 : 0.6);
    }
    if (this.on('perc') && (s === 7 || s === 15) && this.barRng(5).chance(0.5)) this.hit('clank', T, 0.6, { pan: s === 7 ? -0.5 : 0.5 });
    if (this.on('lead')) {
      if (this.leading) this.melodyPlay(this.leadI, this.mel, s, t, { vel: 0.85, legato: true });
      else if (ty !== 'break') this.melodyPlay(this.leadI, this.chase, s, t, { vel: 0.6, gate: 0.5 });
    }
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 62, hi: 79, key: 'choir', vel: 0.5 });
  }

  stab(t, ch, vel) {
    this.stabChord(this.fxStab, t, ch, vel, 50, 69, 0.6);
    this.gtr.play(t, this.rootIn(ch, 35), { vel: 1, dur: 1.4, force: true });
  }
}
