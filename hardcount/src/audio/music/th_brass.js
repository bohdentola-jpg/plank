// Brass & timpani family: hud_glory (Road to Glory — an NFL-Films-style
// cinematic march: horns and trumpets over driving string ostinati, military
// snare, timpani), pregame (arena anthem for the team intros: stomp-clap,
// power chords, trumpet fanfare, choir), postgame_win (triumphant brass march),
// postgame_loss (a horn alone over piano and strings) and draft (the TV draft
// broadcast: ticking clock, pulsing strings, brass hits, four-on-the-floor).

import { Song } from './song.js';
import { Poly, Mono, Guitar } from './inst.js';
import { pat } from './util.js';
import { brassHit, timpRoll } from './football.js';

/** Shared orchestra: strings (pad + ostinato), brass, timpani, glock. */
class Orchestral extends Song {
  setupOrchestra(o = {}) {
    this.pad = new Poly(this, 'pad', 'strings', { level: o.pad ?? 0.3, atk: 0.5, rel: 1.1, cut: o.padCut ?? 2400 });
    this.ost = new Poly(this, 'arp', 'strings', { level: o.ost ?? 0.32, atk: 0.006, rel: 0.07, cut: 4200 });
    this.hornL = new Poly(this, 'lead', 'horn', { level: o.horn ?? 0.5, rel: 0.18 });
    this.tptL = new Poly(this, 'lead', 'trumpet', { level: o.tpt ?? 0.48, rel: 0.12 });
    this.counter = new Poly(this, 'gtr', 'horn', { level: 0.38, rel: 0.18 });
    this.S = {
      tpt: new Poly(this, 'chords', 'trumpet', { level: 0.32, rel: 0.12 }),
      horn: new Poly(this, 'chords', 'horn', { level: 0.32, rel: 0.15 }),
      bone: new Poly(this, 'chords', 'bone', { level: 0.38, rel: 0.12 }),
      tuba: new Poly(this, 'bass', 'tuba', { level: 0.55, rel: 0.1 }),
    };
    this.timp = new Poly(this, 'kick', 'timp', { level: o.timp ?? 0.6, rel: 0.4 });
    this.glock = new Poly(this, 'extra', 'glock', { level: 0.28, rel: 0.3 });
  }

  /** Timpani on the beat: root on 1, fifth on 3 (and pickups when `busy`). */
  timpStep(s, t, busy = false) {
    const ch = this.chordAt(s);
    const r = this.rootIn(ch, 38);
    if (s === 0) this.timp.note(t, r, 0.6, this.hv(0.9));
    else if (s === 8) this.timp.note(t, r + 7 > 52 ? r - 5 : r + 7, 0.5, this.hv(0.7));
    else if (busy && (s === 14 || s === 15)) this.timp.note(t, r, 0.2, this.hv(0.5));
  }

  /** Build: timpani roll on the tonic across the build, crescendo. */
  buildRoll(s, t) {
    if (this.sec.type !== 'build' || s !== 0 || this.barInSec !== 0) return;
    timpRoll(this.timp, t, this.sec.bars * this.barDur - this.stepDur * 2, this.rootIn(this.chord, 38), 0.15, 0.75);
  }
}

// ============================================================================
export class Glory extends Orchestral {
  static kind = 'menu';
  static intensity = 0.7;
  static pa = 0.55;

  compose(r) {
    this.bpm = r.pick([100, 104, 108]);
    this.keyPc = r.pick([2, 0, 7]);
    this.scale = 'harmonic';
    this.progs.main = this.P(r.pick(['i:2 bVI:2 bVII:2 i:2', 'i iv bVII bIII bVI iv V:2', 'i:2 bVII:2 bVI:2 V:2']));
    this.progs.verse = this.P('i:2 iv:2 i:2 V:2');
    this.form = [
      { type: 'intro', bars: 4 },
      { type: 'A', bars: 8, prog: 'verse' },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4, prog: 'verse' },
      { type: 'build', bars: 4 },
      { type: 'drop', bars: 8 },
      { type: 'A', bars: 8, prog: 'verse', var: 1 },
      { type: 'drop', bars: 8, var: 1 },
    ];
    this.loopFrom = 1;
    this.sectionLayers = {
      intro: 'pad kick cym fx bass chords',
      A: 'pad kick snare arp lead bass cym fx',
      B: 'pad kick snare arp lead bass chords cym fx',
      break: 'pad lead fx',
      build: 'pad kick snare arp chords cym fx bass',
      drop: 'pad kick snare arp lead gtr bass chords cym fx extra perc',
    };
    this.kit = { ...this.kit, snare: 'snare_mil', roll: 'snare_mil', crash: 'cym_crash', crash2: 'crash' };
    this.drums = {
      A: { snare: pat('X..x..x.x.x.x...' + 'X..x..x.x.xxX...') },
      B: { snare: pat('X..x..x.X..x..x.' + 'X..x..x.X.xxX.xx') },
      drop: { snare: pat('X.xxX.x.X.xxX.x.' + 'X.xxX.x.XxxxX...'), crash: pat('X...............' + '................' + '................' + '................') },
    };
    this.fills = ['roll', 'snare'];
    this.mel = this.hook({ bars: 8, lo: 60, hi: 74, call: 'x--x-x--x-------', resp: 'x-x-x---x---x---', end: 'x--x-x--x-------', leap: 0.5 });
    this.mix = {
      pad: { v: 0.45, rev: 0.35 }, arp: { v: 0.42, rev: 0.25 }, lead: { v: 0.8, rev: 0.35 }, gtr: { v: 0.55, rev: 0.35 },
      chords: { v: 0.55, rev: 0.3 }, bass: { v: 0.6, rev: 0.15 }, kick: { v: 0.55, rev: 0.25 }, snare: { v: 0.26, rev: 0.25 },
      cym: { v: 0.22, rev: 0.3 }, fx: { v: 0.5, rev: 0.3 }, extra: { v: 0.4, rev: 0.4 }, perc: { v: 0.3 },
    };
  }

  setup() { this.setupOrchestra(); }

  onStep(s, t) {
    const ty = this.sec.type, T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 43, hi: 62, vel: 0.5 });
    if (this.on('arp')) this.arpPlay(this.ost, s, t, { rate: 2, n: 3, lo: 55, hi: 72, pat: ty === 'drop' ? [0, 1, 2, 1, 0, 2, 1, 2] : [0, 2, 1, 2], gate: 0.55, vel: 0.5 });
    if (this.on('kick')) {
      if (ty === 'intro') { if (s === 0 && this.barInSec === 0) timpRoll(this.timp, t, this.barDur * 2, this.rootIn(this.chord, 38), 0.1, 0.8); if (s === 0 && this.barInSec === 2) this.timp.note(t, this.rootIn(this.chord, 38), 1, 1); }
      else if (ty !== 'build') this.timpStep(s, T, ty === 'drop');
      this.buildRoll(s, t);
    }
    if (this.on('bass') && (s === 0 || (s === 8 && ty !== 'intro'))) this.S.tuba.note(T, this.rootIn(this.chordAt(s), 31), this.stepDur * 7.5, 0.8);
    if (ty === 'intro' && this.barInSec >= 2 && s === 0) brassHit(this, this.S, T, this.chord, this.barDur * 0.95, 0.6, { tpt: false });
    if (this.on('lead')) {
      const tpt = ty === 'B' || ty === 'drop';
      this.melodyPlay(tpt ? this.tptL : this.hornL, this.mel, s, t, { vel: 0.85, gate: 0.92, oct: tpt ? 1 : 0 });
    }
    if (this.on('gtr')) this.melodyPlay(this.counter, this.mel, s, t, { vel: 0.7, gate: 0.92 });
    if (this.on('chords') && ty !== 'intro') {
      if (ty === 'build') { if (s === 0 || s === 8) brassHit(this, this.S, T, this.chordAt(s), this.stepDur * 6, 0.5 + 0.1 * this.barInSec, { tpt: false }); }
      else this.compPlay({ chord: (tt, v, d, vel) => brassHit(this, this.S, tt, this.chordSoon(s), d, vel) }, 'X-----x-x-------', s, t, { vel: 0.7, gate: 0.9 });
    }
    if (this.on('extra') && (s & 3) === 0 && this.changes[s >> 2]) this.glock.note(T, this.rootIn(this.chordAt(s), 84) + 12, 0.8, 0.4);
  }

  stab(t, ch, vel) { brassHit(this, this.S, t, ch, 0.6, vel, { nopts: { force: true } }); }
}

// ============================================================================
export class Pregame extends Orchestral {
  static kind = 'menu';
  static intensity = 0.85;
  static pa = 0.7;

  compose(r) {
    this.bpm = r.pick([116, 120, 124]);
    this.keyPc = r.pick([2, 4, 9]);
    this.scale = 'mixolydian';
    this.progs.main = this.P(r.pick(['I:2 bVII:2 IV:2 I:2', 'I:2 V:2 bVII:2 IV:2', 'I bVII IV I I bVII IV V']));
    this.form = [
      { type: 'intro', bars: 4 },
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'build', bars: 4 },
      { type: 'drop', bars: 8 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.loopFrom = 1;
    this.sectionLayers = {
      intro: 'kick perc cym fx pad',
      A: 'kick snare hats perc cym gtr bass pad fx',
      B: 'kick snare hats perc cym gtr bass pad lead chords fx',
      break: 'pad extra kick fx cym',
      build: 'kick snare hats cym gtr bass pad fx chords',
      drop: 'kick snare hats perc cym gtr bass pad lead chords extra fx arp',
    };
    this.kit = { ...this.kit, kick: 'kick_rock', snare: 'snare_rock', hat: 'hat_c', ohat: 'hat_o', crash: 'crash', clap: 'clap_big', tomf: 'tom_f' };
    this.drums = {
      intro: { kick: pat('X...X...........'), clap: pat('........X.......') },
      A: { kick: pat('X.....x.X.x.....'), snare: pat('....X.......X...'), hat: pat('x.x.x.x.x.x.x.x.') },
      B: { kick: pat('X.....x.X.x...x.'), snare: pat('....X.......X...'), ohat: pat('x.x.x.x.x.x.x.x.'), tomf: pat('X...............') },
      break: { kick: pat('X...X...........'), clap: pat('........X.......') },
      drop: { kick: pat('X.x...x.X.x...x.'), snare: pat('....X.......X..x'), ohat: pat('x.x.x.x.x.x.x.x.'), clap: pat('....X.......X...') },
    };
    this.kitGain.clap = 0.8;
    this.mel = this.hook({ bars: 8, lo: 67, hi: 81, scale: 'major', call: 'x-x-x---x-----x-', resp: 'x-x-x-x-x-------', end: 'x---x---x-------', leap: 0.45 });
    this.riff = 'X--.X--.X-.X--..';
    this.mix = {
      kick: { v: 0.32 }, snare: { v: 0.3, rev: 0.25 }, hats: { v: 0.12 }, perc: { v: 0.25 }, cym: { v: 0.22, rev: 0.2 },
      gtr: { v: 0.42, rev: 0.12 }, bass: { v: 0.5 }, pad: { v: 0.4, rev: 0.4 }, lead: { v: 0.75, rev: 0.35 },
      chords: { v: 0.45, rev: 0.3 }, extra: { v: 0.45, rev: 0.45 }, arp: { v: 0.35, rev: 0.3 }, fx: { v: 0.55, rev: 0.3 },
    };
  }

  setup() {
    this.setupOrchestra({ pad: 0.22, tpt: 0.52 });
    this.gtr = new Guitar(this, 'gtr', { level: 0.48, drive: 22, tone: 5200 });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.45 }, { type: 'square', gain: 0.25, mul: 0.5 }], cut: 600, q: 1, env: 500, fdec: 0.2,
      drive: 3, post: 1600, sub: 0.6, subMul: 1, atk: 0.004, sus: 0.85, dec: 0.4, rel: 0.05, level: 0.36,
    });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.36, atk: 0.5, rel: 1.1 });
  }

  onStep(s, t) {
    const ty = this.sec.type, T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 50, hi: 67, vel: 0.45 });
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 60, hi: 76, key: 'choir', vel: 0.55 });
    if (this.on('gtr') && ty !== 'break') {
      const c = this.riff[s];
      if (c === 'X') {
        let len = 1;
        while (s + len < 16 && this.riff[s + len] === '-') len++;
        this.gtr.play(T, this.rootIn(this.chordAt(s), 40), { vel: 0.95, dur: this.stepDur * (len + 0.4) });
      } else if (c === '.' && ty === 'build' && (s & 1) === 0) this.gtr.play(T, this.rootIn(this.chordAt(s), 40), { mute: true, vel: 0.7 });
    }
    if (this.on('bass') && (s & 1) === 0 && this.riff[s] !== '.') this.bass.note(T, this.rootIn(this.chordAt(s), 28), this.stepDur * 1.8, 0.85);
    if (this.on('lead')) this.melodyPlay(this.tptL, this.mel, s, t, { vel: 0.85, gate: 0.9 });
    if (this.on('arp')) this.melodyPlay(this.glock, this.mel, s, t, { vel: 0.4, gate: 0.4, oct: 1 });
    if (this.on('chords') && (s === 0 || s === 6 || s === 8)) brassHit(this, this.S, T, this.chordSoon(s), this.stepDur * (s === 0 ? 5 : 2), s === 0 ? 0.7 : 0.55, { tpt: false });
    if (ty === 'break' && s === 0 && this.barInSec === 0) timpRoll(this.timp, t, this.barDur * 3.6, this.rootIn(this.chord, 38), 0.1, 0.7);
    if (this.on('kick') && ty === 'drop') this.timpStep(s, T);
  }

  stab(t, ch, vel) { brassHit(this, this.S, t, ch, 0.6, vel, { nopts: { force: true } }); this.gtr.play(t, this.rootIn(ch, 40), { vel: 1, dur: 1.2, force: true }); }
}

// ============================================================================
export class PostWin extends Orchestral {
  static kind = 'results';
  static intensity = 0.8;

  compose(r) {
    this.bpm = r.pick([108, 112, 116]);
    this.keyPc = r.pick([10, 3, 0]);
    this.scale = 'major';
    this.progs.main = this.P(r.pick(['I IV V I', 'I vi IV V', 'I V vi IV', 'I IV I V']));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers = {
      A: 'pad kick snare cym bass chords lead arp fx',
      B: 'pad kick snare cym bass chords lead arp extra gtr fx perc',
      break: 'pad lead fx cym',
    };
    this.kit = { ...this.kit, snare: 'snare_mil', roll: 'snare_mil', crash: 'cym_crash', kick2: 'bass_m3', choke: 'cym_choke' };
    this.drums = {
      A: { snare: pat('X.x.x.x.X.x.xrx.'), kick2: pat('X.......X.......') },
      B: { snare: pat('X.xxX.x.X.xxX.x.'), kick2: pat('X.......X.......'), choke: pat('....x.......x...') },
    };
    this.kitGain.kick2 = 0.8;
    this.mel = this.hook({ bars: 8, lo: 69, hi: 84, scale: 'major', call: 'x--x-x--x---x---', resp: 'x-x-x-x-x-------', end: 'x--x-x--x-------', leap: 0.4 });
    this.mix = {
      pad: { v: 0.35, rev: 0.35 }, kick: { v: 0.45, rev: 0.2 }, snare: { v: 0.26, rev: 0.25 }, cym: { v: 0.2, rev: 0.25 },
      bass: { v: 0.6 }, chords: { v: 0.5, rev: 0.3 }, lead: { v: 0.72, rev: 0.32 }, arp: { v: 0.32, rev: 0.25 },
      extra: { v: 0.35, rev: 0.35 }, gtr: { v: 0.45, rev: 0.3 }, fx: { v: 0.5 }, perc: { v: 0.3 },
    };
  }

  setup() { this.setupOrchestra({ ost: 0.26 }); }

  onStep(s, t) {
    const ty = this.sec.type, T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 50, hi: 67, vel: 0.4 });
    if (this.on('kick')) this.timpStep(s, T);
    if (this.on('bass') && (s === 0 || s === 8)) {
      const r = this.rootIn(this.chordAt(s), 31);
      this.S.tuba.note(T, s ? r + 7 - (r + 7 > 45 ? 12 : 0) : r, this.stepDur * 3.5, 0.85);
    }
    if (this.on('chords') && (s === 4 || s === 12)) for (const m of this.voicing(this.chordAt(s), 3, 57, 72, 'aft')) this.S.horn.note(T, m, this.stepDur * 1.5, 0.6);
    if (this.on('lead')) this.melodyPlay(ty === 'break' ? this.hornL : this.tptL, this.mel, s, t, { vel: 0.85, gate: 0.9, oct: ty === 'break' ? -1 : 0 });
    if (this.on('gtr')) this.melodyPlay(this.counter, this.mel, s, t, { vel: 0.6, gate: 0.9, oct: -1 });
    if (this.on('arp')) this.arpPlay(this.ost, s, t, { rate: 2, n: 3, lo: 60, hi: 76, pat: [0, 1, 2, 1], gate: 0.5, vel: 0.45 });
    if (this.on('extra')) this.melodyPlay(this.glock, this.mel, s, t, { vel: 0.4, gate: 0.4, oct: 1 });
  }
}

// ============================================================================
export class PostLoss extends Orchestral {
  static kind = 'results';
  static intensity = 0.6;

  compose(r) {
    this.bpm = r.pick([64, 66, 70]);
    this.keyPc = r.pick([2, 4, 9, 7]);
    this.scale = 'minor';
    this.progs.main = this.P(r.pick(['i:2 bVI:2 iv:2 V:2', 'i:2 v:2 bVI:2 iv:2', 'bVI:2 iv:2 i:2 V:2', 'i:2 bVII:2 bVI:2 V:2']));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers = { A: 'pad chords lead fx', B: 'pad chords lead bass kick arp fx', break: 'pad chords fx' };
    this.mel = this.hook({ bars: 8, lo: 57, hi: 71, call: 'x-------x---x---', resp: 'x-----x-x-------', end: 'x---x---x-------', leap: 0.25 });
    this.mix = { pad: { v: 0.42, rev: 0.45 }, chords: { v: 0.62, rev: 0.35 }, lead: { v: 0.75, rev: 0.45 }, bass: { v: 0.45, rev: 0.3 }, kick: { v: 0.35, rev: 0.4 }, arp: { v: 0.3, rev: 0.4 }, fx: { v: 0.4 } };
  }

  setup() {
    this.setupOrchestra({ pad: 0.32 });
    this.piano = new Poly(this, 'chords', 'piano', { level: 0.42, rel: 0.7, cut: 3600 });
  }

  onStep(s, t) {
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 4, lo: 48, hi: 67, vel: 0.45 });
    if (this.on('chords') && (s & 1) === 0) {
      // slow broken chords on the piano
      const v = this.voicing(this.chordAt(s), 4, 55, 74, 'pno');
      const k = (s >> 1) & 3;
      this.piano.note(T, v[[0, 2, 1, 3][k]], this.stepDur * 6, k === 0 ? 0.42 : 0.3);
      if (s === 0) this.piano.note(T, this.rootIn(this.chordAt(s), 36), this.stepDur * 14, 0.35);
    }
    if (this.on('lead')) this.melodyPlay(this.hornL, this.mel, s, t, { vel: 0.75, gate: 0.95 });
    if (this.on('bass') && s === 0 && this.changes[0]) this.S.bone.note(T, this.rootIn(this.chordAt(s), 40), this.barDur * 1.8, 0.3);
    if (this.on('kick') && s === 0 && (this.barInSec & 1) === 0) this.timp.note(T, this.rootIn(this.chordAt(s), 38), 1, 0.35);
    if (this.on('arp') && (s === 6 || s === 14)) this.glock.note(T, this.voicing(this.chordAt(s), 3, 72, 86, 'gl')[s === 6 ? 2 : 1], 0.8, 0.22);
  }
}

// ============================================================================
export class Draft extends Orchestral {
  static kind = 'menu';
  static intensity = 0.75;

  compose(r) {
    this.bpm = r.pick([118, 120, 122]);
    this.keyPc = r.pick([4, 9, 2]);
    this.scale = 'minor';
    this.progs.main = this.P(r.pick(['i:2 bVI:2 bIII:2 bVII:2', 'i:2 iv:2 bVI:2 bVII:2', 'i:4 bVI:2 bVII:2']));
    this.form = [
      { type: 'intro', bars: 4 },
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'build', bars: 4 },
      { type: 'drop', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
    ];
    this.loopFrom = 1;
    this.sectionLayers = {
      intro: 'hats perc arp pad fx',
      A: 'kick hats perc arp pad bass chords fx cym',
      B: 'kick snare hats perc arp pad bass chords lead fx cym',
      break: 'pad perc lead fx',
      build: 'kick snare hats arp pad chords fx cym',
      drop: 'kick snare hats perc arp pad bass chords lead gtr extra fx cym',
    };
    this.kit = { ...this.kit, kick: 'kick_house', clap: 'clap', snare: 'snare_tight', hat: 'hat_c2', ohat: 'hat_o', rim: 'rim' };
    this.drums = {
      intro: { hat: pat('x.x.x.x.x.x.x.x.') },
      A: { kick: pat('X...X...X...X...'), hat: pat('x.x.x.x.x.x.x.x.'), rim: pat('....x.......x...') },
      B: { kick: pat('X...X...X...X...'), snare: pat('....X.......X...'), hat: pat('xxx.xxx.xxx.xxx.'), ohat: pat('..x...x...x...x.') },
      break: { hat: pat('x.x.x.x.x.x.x.x.') },
      drop: { kick: pat('X...X...X...X...'), snare: pat('....X.......X...'), clap: pat('....X.......X...'), hat: pat('xxxxxxxxxxxxxxxx'), ohat: pat('..x...x...x...x.') },
    };
    this.mel = this.hook({ bars: 8, lo: 64, hi: 79, call: 'x--x--x-x-------', resp: 'x-x-x-x-x---x---', end: 'x--x--x-x-------', leap: 0.45 });
    this.pumpMusic = 0.15;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.24, rev: 0.15 }, hats: { v: 0.14 }, perc: { v: 0.3, rev: 0.2 }, cym: { v: 0.2, rev: 0.2 },
      arp: { v: 0.42, rev: 0.18 }, pad: { v: 0.32, rev: 0.3 }, bass: { v: 0.3 }, chords: { v: 0.5, rev: 0.25 },
      lead: { v: 0.72, rev: 0.3 }, gtr: { v: 0.45, rev: 0.3 }, extra: { v: 0.4, rev: 0.3 }, fx: { v: 0.6, rev: 0.25 },
    };
  }

  setup() {
    this.setupOrchestra({ ost: 0.36, pad: 0.24, timp: 0.35 });
    this.clock = new Poly(this, 'perc', 'bell', { level: 0.16, rel: 0.05 });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.2, mul: 0.5 }], cut: 500, q: 2, env: 700, fdec: 0.12,
      drive: 2, post: 1800, sub: 0.6, subMul: 1, atk: 0.003, sus: 0.7, dec: 0.2, rel: 0.04, level: 0.36,
    });
  }

  onStep(s, t) {
    const ty = this.sec.type, T = this.sw(s, t);
    // the pick clock: tick … tock
    if (this.on('perc') && (s & 3) === 0) this.clock.note(T, this.rootIn(this.chordAt(s), 84) + ((s & 4) ? 7 : 12), 0.06, (s & 4) ? 0.7 : 1);
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 52, hi: 69, vel: 0.4 });
    if (this.on('arp')) this.arpPlay(this.ost, s, t, { rate: 1, n: 3, lo: 57, hi: 74, pat: [0, 0, 2, 0, 1, 0, 2, 1], gate: 0.45, vel: 0.45 });
    if (this.on('bass') && (s & 1) === 0) this.bass.note(T, this.rootIn(this.chordAt(s), 28) + ((s & 2) ? 12 : 0), this.stepDur * 1.4, (s & 2) ? 0.7 : 0.9);
    if (this.on('chords') && (s === 0 || s === 6)) brassHit(this, this.S, T, this.chordSoon(s), this.stepDur * (s ? 2 : 4), s ? 0.55 : 0.7, { tpt: ty === 'drop' });
    if (this.on('lead')) this.melodyPlay(this.tptL, this.mel, s, t, { vel: 0.85, gate: 0.9 });
    if (this.on('gtr')) this.melodyPlay(this.counter, this.mel, s, t, { vel: 0.6, gate: 0.9, oct: -1 });
    if (this.on('extra')) this.timpStep(s, T, true);
    this.buildRoll(s, t);
  }

  stab(t, ch, vel) { brassHit(this, this.S, t, ch, 0.5, vel, { nopts: { force: true } }); }
}
