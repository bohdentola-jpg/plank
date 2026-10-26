// Huddle stations (each wristband line has its own stadium-PA music):
//   hud_free     FREE PLAY — 2000s nu-metal: drop-D chugs, half-time choruses, DJ scratches
//   hud_book     PLAYBOOK — laid-back boom-bap: dusty swing, upright bass, piano chops, vibes
//   hud_hof      HALL OF FAME — the old ballpark organ (Leslie) with horns and an oom-pah tuba, 12/8
//   hud_options  OPTIONS — the TV's own menu: smooth late-night jazz (Rhodes, fretless, soprano sax)

import { Song } from './song.js';
import { Mono, Poly, Guitar, Rhodes, Pluck, Breath, Organ } from './inst.js';
import { pat, rolePat } from './util.js';
import { brassHit } from './football.js';

/** Guitar riff step: x mute / X open power chord; b B = flat two; 5 % = flat five; '-' hold. */
function riffStep(song, gtr, p, s, t, root) {
  const c = p[s % p.length];
  if (c === '.' || c === '-') return null;
  let len = 1;
  while (s + len < p.length && p[s + len] === '-') len++;
  const open = c === 'X' || c === 'B' || c === '%';
  const off = c === 'b' || c === 'B' ? 1 : c === '5' || c === '%' ? 6 : 0;
  gtr.play(song.sw(s, t), root + off, { mute: !open, vel: open ? 0.95 : 0.78, dur: open ? song.stepDur * (len + 0.6) : song.stepDur * 0.85 });
  return { open, off };
}

// ============================================================================
export class FreePlay extends Song {
  static kind = 'menu';
  static intensity = 0.75;
  static pa = 0.55;

  compose(r) {
    this.bpm = r.pick([96, 100, 104]);
    this.humanize = 0.003;
    this.keyPc = 2; // drop D
    this.scale = r.chance(0.5) ? 'phrygian' : 'minor';
    this.progs.main = this.P(r.pick(['i:2 bVI:2 bIII:2 bVII:2', 'i:2 bII:2 bVI:2 v:2', 'i:4 bVI:2 bVII:2']));
    this.progs.chorus = this.P(r.pick(['bVI:2 bIII:2 bVII:2 i:2', 'i:2 bVI:2 bIII:2 bVII:2']));
    this.form = [
      { type: 'intro', bars: 4 },
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8, prog: 'chorus' },
      { type: 'break', bars: 4 },
      { type: 'build', bars: 2 },
      { type: 'drop', bars: 8, prog: 'chorus' },
      { type: 'A', bars: 8, var: 1 },
      { type: 'B', bars: 8, prog: 'chorus', var: 1 },
    ];
    this.loopFrom = 1;
    this.introLP = 900;
    this.sectionLayers = {
      intro: 'gtr perc fx cym',
      A: 'kick snare hats cym gtr bass perc fx',
      B: 'kick snare hats cym gtr bass pad lead fx',
      break: 'pad perc fx bass arp',
      build: 'kick snare hats cym gtr fx',
      drop: 'kick snare hats cym gtr bass pad lead extra fx perc',
    };
    this.kit = { ...this.kit, kick: 'kick_metal', snare: 'snare_rock', hat: 'hat_c', ohat: 'hat_o', ride: 'ride', china: 'china' };
    this.chugs = [
      r.pick(['x.xx.x.xx..xx.x.', 'xx.x.xx.x.xx..X-', 'x..x..x.x..x..X-', 'x.x.xxb.x.x.xxB-']),
      r.pick(['x.xx.x.xb..bx.x.', 'X-..x.x.X-..xx5.', 'xx.xxx.xX-.xxb.b', 'x..x..x.X--.x5x.']),
    ];
    this.chorusRiff = r.pick(['X-------X---X---', 'X-----X-----X---', 'X---X---X-X-X---']);
    const kk = (c) => pat([...c].map((ch, s) => (/[xXbB5%]/.test(ch) && (s % 2 === 0 || ch === 'X') ? (s % 4 === 0 ? 'X' : 'x') : '.')).join(''));
    this.drums = {
      A: { kick: kk(this.chugs[0]), snare: pat('....X.......X...'), hat: pat('x.x.x.x.x.x.x.x.') },
      B: { kick: pat('X.....x.X.......'), snare: pat('........X.......'), ride: pat('x.x.x.x.x.x.x.x.') },
      drop: { kick: pat('X.x...x.X.x...x.'), snare: pat('........X.......'), china: pat('x...x...x...x...'), hat: pat('..x...x...x...x.') },
    };
    this.fills = ['toms', 'mix', 'toms', 'stop'];
    this.mel = this.hook({ prog: this.progs.chorus, bars: 8, lo: 62, hi: 76, call: 'x-----x-x-----x-', resp: 'x---x---x-x-----', end: 'x-------x-------', leap: 0.3 });
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.25, rev: 0.2 }, hats: { v: 0.12 }, perc: { v: 0.32, rev: 0.15 }, cym: { v: 0.2, rev: 0.12 },
      bass: { v: 0.55 }, pad: { v: 0.32, rev: 0.4 }, gtr: { v: 0.55 }, lead: { v: 0.62, rev: 0.3, dly: 0.2 },
      fx: { v: 0.55, rev: 0.3 }, extra: { v: 0.4, rev: 0.4 }, arp: { v: 0.4, rev: 0.4, dly: 0.25 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.gtr = new Guitar(this, 'gtr', { level: 0.5, drive: 30, tone: 4600, scoop: -4 });
    this.leadG = new Guitar(this, 'lead', { level: 0.32, drive: 18, tone: 4200, dbl: false });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.25, mul: 0.5 }], cut: 700, q: 2, env: 500, fdec: 0.1,
      drive: 6, post: 1500, sub: 0.6, subMul: 1, atk: 0.003, sus: 0.8, dec: 0.2, rel: 0.04, level: 0.32,
    });
    this.padI = new Poly(this, 'pad', 'strings', { level: 0.3, atk: 0.8, rel: 1.4, cut: 1600 });
    this.clean = new Poly(this, 'arp', 'pluck', { level: 0.3, rel: 0.4, cut: 2400 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.3, atk: 0.4, rel: 1 });
  }

  onStep(s, t) {
    const ty = this.sec.type, T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.padI, s, t, { n: 3, lo: 50, hi: 69, vel: 0.5 });
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 62, hi: 79, key: 'choir', vel: 0.5 });
    const root = this.rootIn(this.chordAt(s), 38);
    let hit = null;
    if (this.on('gtr')) {
      if (ty === 'B' || ty === 'drop') hit = riffStep(this, this.gtr, this.chorusRiff, s, t, root);
      else if (ty === 'build') { if ((s & 1) === 0) this.gtr.play(T, root, { mute: true, vel: 0.6 + 0.3 * (this.barInSec * 16 + s) / 32 }); }
      else hit = riffStep(this, this.gtr, this.chugs[ty === 'intro' ? 0 : (this.barInSec >> 1) & 1], s, t, root);
    }
    if (this.on('bass')) {
      if (hit) this.bass.note(T, root - 12 + hit.off, this.stepDur * (hit.open ? 2 : 0.9), hit.open ? 0.95 : 0.8);
      else if (!this.on('gtr') && (s & 7) === 0) this.bass.note(T, root - 12, this.beatDur * 1.8, 0.7);
    }
    if (this.on('lead')) this.melodyPlay({ note: (tt, m, d, v) => this.leadG.play(tt, m, { note: true, dur: d, vel: v }) }, this.mel, s, t, { vel: 0.85 });
    if (this.on('arp') && (s & 1) === 0) this.arpPlay(this.clean, s, t, { rate: 2, n: 3, lo: 62, hi: 79, pat: [0, 1, 2, 1], gate: 0.8, vel: 0.5 });
    // the DJ: scratches into the phrase ends
    if (this.on('perc') && (this.barInSec & 3) === 3 && (s === 12 || s === 14)) this.hit('scratch', T, 0.65, { layer: 'perc', pan: s === 12 ? -0.3 : 0.3 });
  }

  stab(t, ch, vel) { this.gtr.play(t, this.rootIn(ch, 38), { vel: 1, dur: 1.4, force: true }); }
}

// ============================================================================
export class Playbook extends Song {
  static kind = 'menu';
  static intensity = 0.6;
  static pa = 0.45;

  compose(r) {
    this.bpm = r.pick([86, 88, 90, 92]);
    this.swing = r.range(0.26, 0.34);
    this.humanize = 0.006;
    this.velJitter = 0.15;
    this.keyPc = r.pick([5, 7, 9, 0, 2]);
    this.scale = 'dorian';
    this.progs.main = this.P(r.pick(['i9:2 iv9:2', 'i7 bVIIadd9 bVIM7 v7', 'i9 iv9 bVIIadd9 bIIIM7', 'ii9 V13 IM9:2']));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead hats perc';
    this.kit = { ...this.kit, kick: 'kick_boom', snare: 'snare_lofi', hat: 'hat_dusty', ohat: 'hat_odusty', ghost: 'snare_ghost', rim: 'rim' };
    const kicks = ['X......x..X.....', 'X.....x...X..x..', 'X..x......x.....', 'X......x.x......'];
    const k1 = r.pick(kicks), k2 = r.pick(kicks);
    this.drums = {
      A: { kick: pat(k1 + k2), snare: pat('....X.......X...'), hat: pat('xgogxgogxgogxgog') },
      B: {
        kick: pat(k1 + k1.slice(0, 12) + '..x.'), snare: pat('....X.......X...' + '....X.......X..g'),
        ghost: pat('.......g......g.'), hat: pat('xgogxgogxgogxg..'), ohat: pat('..............o.'), shaker: pat('..o...o...o...o.'),
      },
    };
    this.bassPat = rolePat(r.pick(['R---..r-R---.ro-' + 'R---..r-R-..a-..', 'R-----r-....R-o-' + 'R-----r-..n-a-..']));
    this.chopPat = r.pick(['x..x....x..x....', 'x.....x...x.....', '..x..x.....x..x.']);
    this.mel = this.hook({ bars: 4, lo: 69, hi: 84, call: 'x.....x...x.x...', resp: 'x---x-----x-x---', end: 'x-----x-x-------', leap: 0.35 });
    this.mix = {
      kick: { v: 0.24 }, snare: { v: 0.26, rev: 0.12 }, hats: { v: 0.15 }, perc: { v: 0.3 }, cym: { v: 0.2 },
      bass: { v: 0.62 }, pad: { v: 0.4, rev: 0.3 }, chords: { v: 0.62, rev: 0.15 }, lead: { v: 0.5, rev: 0.3, dly: 0.25 }, fx: { v: 0.5 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.bass = new Pluck(this, 'bass', { level: 0.85 });
    this.piano = new Poly(this, 'chords', 'piano', { level: 0.4, rel: 0.12, cut: 2800, q: 1 });
    this.strings = new Poly(this, 'pad', 'strings', { level: 0.25, atk: 0.9, rel: 1.4, cut: 1600 });
    this.vibes = new Poly(this, 'lead', 'mallet', { level: 0.42, rel: 0.6 });
    this.bed(this.B.get('crackle'), 'fx', 0.32, [['highpass', 300, 0]]);
  }

  onStep(s, t) {
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.strings, s, t, { n: 3, lo: 55, hi: 74, vel: 0.45, vopts: { spread: 10 } });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 33, gate: 0.9 });
    if (this.on('chords') && this.chopPat[s] === 'x') {
      // a chopped piano sample: the chord, slightly late, cut short
      const v = this.voicing(this.chordSoon(s), 4, 55, 74, 'chop', { rootless: true });
      this.piano.chord(T + 0.008, v, this.stepDur * 1.6, 0.5);
    }
    if (this.on('lead')) this.melodyPlay(this.vibes, this.mel, s, t, { vel: 0.7, gate: 1 });
    if (this.on('perc') && (this.barInSec & 7) === 7 && (s === 12 || s === 14)) this.hit('scratch', T, 0.5, { layer: 'perc', pan: 0.25 });
  }
}

// ============================================================================
export class HallOfFame extends Song {
  static kind = 'menu';
  static intensity = 0.6;
  static pa = 0.6;

  compose(r) {
    this.bpm = r.pick([76, 80, 84]);
    this.swing8 = 0.33; // 12/8
    this.humanize = 0.005;
    this.velJitter = 0.1;
    this.keyPc = r.pick([5, 7, 0, 10]);
    this.scale = 'major';
    this.progs.main = this.P(r.pick(['I vi ii V7', 'I I7 IV iv I vi ii V7', 'I III7 IV iv I VI7 ii V7']));
    this.progs.bridge = this.P(r.pick(['IV iv I VI7 ii V7 I:2', 'vi III7 vi I7 IV iv ii V7']));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8, prog: 'bridge' },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
    ];
    this.sectionLayers = {
      A: 'chords lead bass kick snare hats fx cym',
      B: 'chords lead bass kick snare hats pad arp fx cym',
      break: 'chords pad fx',
    };
    this.kit = { ...this.kit, kick: 'kick_soft', snare: 'brush', ride: 'ride', hat: 'hat_p' };
    this.drums = { A: { kick: pat('x.......x.......'), snare: pat('....x.......x...'), ride: pat('x...x.x.x...x.x.') } };
    this.mel = this.hook({ bars: 8, lo: 67, hi: 81, scale: 'major', call: 'x---x-x-x-------', resp: 'x-x-x---x---x---', end: 'x---x---x-------', leap: 0.35 });
    this.mix = {
      chords: { v: 0.55, rev: 0.3 }, lead: { v: 0.62, rev: 0.3 }, bass: { v: 0.55, rev: 0.2 }, pad: { v: 0.42, rev: 0.4 },
      kick: { v: 0.2 }, snare: { v: 0.3, rev: 0.2 }, hats: { v: 0.16, rev: 0.2 }, arp: { v: 0.3, rev: 0.35 }, fx: { v: 0.4 }, cym: { v: 0.15 },
    };
  }

  setup() {
    this.organ = new Organ(this, 'chords', { level: 0.26, rate: 6.4, click: 0.18 });
    this.organLead = new Organ(this, 'lead', { level: 0.3, rate: 6.9, click: 0.25, cut: 6500 });
    this.horns = new Poly(this, 'pad', 'horn', { level: 0.32, atk: 0.12, rel: 0.5 });
    this.tuba = new Poly(this, 'bass', 'tuba', { level: 0.55, rel: 0.12 });
    this.glock = new Poly(this, 'arp', 'glock', { level: 0.25, rel: 0.4 });
  }

  onStep(s, t) {
    const T = this.sw(s, t);
    const ch = this.chordAt(s);
    // left hand: oom-pah — bass note on 1 and 3 (tuba), organ chord on the after-beats
    if (this.on('bass') && (s === 0 || s === 8)) {
      const r = this.rootIn(ch, 31);
      this.tuba.note(T, s ? r + 7 - (r + 7 > 43 ? 12 : 0) : r, this.stepDur * 3.2, 0.8);
    }
    if (this.on('chords') && (s === 4 || s === 12 || (this.sec.type === 'break' && s === 0))) {
      this.organ.chord(T, this.voicing(this.chordSoon(s), 4, 55, 72, 'org'), this.stepDur * (this.sec.type === 'break' ? 14 : 2.6), 0.62);
    }
    if (this.on('lead')) this.melodyPlay(this.organLead, this.mel, s, t, { vel: 0.8, gate: 0.95 });
    if (this.on('pad')) this.padPlay(this.horns, s, t, { n: 3, lo: 53, hi: 69, vel: 0.5 });
    if (this.on('arp') && s === 0 && (this.barInSec & 1) === 1) this.glock.note(T, this.voicing(ch, 3, 79, 91, 'gl')[2], 1, 0.35);
  }

  stab(t, ch, vel) { this.organ.chord(t, this.voicing(ch, 4, 55, 72, 'org'), 0.5, vel, { force: true }); }
}

// ============================================================================
export class Options extends Song {
  static kind = 'menu';
  static intensity = 0.55;
  static pa = 0.1;

  compose(r) {
    this.bpm = r.pick([88, 90, 92, 94]);
    this.swing = 0.12;
    this.humanize = 0.004;
    this.velJitter = 0.12;
    this.keyPc = r.pick([3, 5, 10, 8]);
    this.scale = 'major';
    this.progs.main = this.P(r.pick(['IM9 IVM9 iii7 vi9', 'IM9 vi9 ii9 V13', 'IVM9 iii7 ii9 IM9', 'IM9:2 ii9 V13']));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords bass hats perc';
    this.kit = { ...this.kit, kick: 'kick_soft', rim: 'rim', phat: 'hat_p', shaker: 'shaker', ride: 'ride' };
    this.drums = {
      A: { kick: pat('X.....x...X.....'), rim: pat('....x.......x...'), phat: pat('..x...x...x...x.'), shaker: pat('o.o.o.o.o.o.o.o.') },
      B: { kick: pat('X.....x...X..x..'), rim: pat('....x.......x...'), ride: pat('x.x.x.x.x.x.x.x.'), shaker: pat('o.o.o.o.o.o.o.o.') },
      break: { shaker: pat('o.o.o.o.o.o.o.o.'), phat: pat('..x...x...x...x.') },
    };
    this.kitGain.shaker = 0.6;
    this.bassPat = rolePat(r.pick(['R-----r-..R-o-a-', 'R---..f-R-----a-', 'R-----5-o---r-a-'].map((p) => p.replace('5', 'f'))));
    this.compPat = r.pick(['x-----x---------' + '..x-------x-----', 'x-------..x-----' + '......x-------x-']);
    this.mel = this.hook({ bars: 8, lo: 67, hi: 84, scale: 'major', call: 'x---x-x-----x-x-', resp: 'x-x---x---x-----', end: 'x---x---x-------', leap: 0.35 });
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.3, rev: 0.15 }, hats: { v: 0.16, rev: 0.1 }, perc: { v: 0.22 }, cym: { v: 0.18 },
      bass: { v: 0.3 }, chords: { v: 1.0, rev: 0.22 }, lead: { v: 0.62, rev: 0.32, dly: 0.18 }, pad: { v: 0.32, rev: 0.4 }, fx: { v: 0.4 },
    };
    this.dlyTime = this.beatDur * 0.75;
    this.dlyFb = 0.3;
  }

  setup() {
    this.bass = new Mono(this, 'bass', { // fretless: round, sliding
      oscs: [{ type: 'sine', gain: 0.8 }, { type: 'triangle', gain: 0.35 }], cut: 900, q: 0.7, env: 400, fdec: 0.2,
      atk: 0.012, sus: 0.85, dec: 0.5, rel: 0.08, glide: 0.09, level: 0.5,
    });
    this.rh = new Rhodes(this, 'chords', { level: 0.2, tone: 4600, trem: 0.3, tremRate: 3.4, bright: 0.8 });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.22, atk: 1, rel: 1.6, cut: 2400 });
    this.sax = new Breath(this, 'lead', { wave: 'sawtooth', wave2: 'square', level: 0.2, lp: 3000, vib: 18, vibRate: 5.2, breath: 0.2, glide: 0.06, atk: 0.05, rel: 0.14 });
  }

  onStep(s, t) {
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 33, gate: 0.95 });
    if (this.on('chords')) this.compPlay(this.rh, this.compPat, s, t, { n: 4, lo: 55, hi: 74, vel: 0.55, vopts: { rootless: true } });
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 60, hi: 77, vel: 0.4 });
    if (this.on('lead')) this.melodyPlay(this.sax, this.mel, s, t, { vel: 0.8, gate: 0.92, legato: true });
  }
}
