// TALK 104.5 — late-night lounge jazz: brushed drums in a triplet swing, a
// walking upright bass, rootless Rhodes comping over ii–V–I changes and a soft
// breathy lead with delayed vibrato.

import { Song } from './song.js';
import { Rhodes, Pluck, Breath, Poly } from './inst.js';
import { pat } from './util.js';

export class Talk extends Song {
  static kind = 'menu';
  static intensity = 0.4;

  compose(r) {
    this.bpm = r.pick([80, 84, 86, 88]);
    this.swing8 = r.range(0.28, 0.33);
    this.humanize = 0.008;
    this.velJitter = 0.16;
    this.keyPc = r.pick([5, 10, 3, 1, 8]);
    this.scale = 'major';
    this.progs.main = this.P(r.pick([
      'ii9 V13 IM9 vi9 ii9 V13 IM9:2',
      'IM9 vi9 ii9 V7b9 iii7 VI7b9 ii9 V13',
      'iii7 VI7b9 ii9 V13 IM9:2 ii9 V7#9',
      'IM9:2 #ivø VII7b9 iii7 VI7b9 ii9 V13',
    ]));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords bass hats snare';
    this.kit = { ...this.kit, kick: 'kick_soft', brush: 'brush', sweep: 'sweep', ride: 'ride', phat: 'hat_p' };
    this.drums = {
      A: {
        sweep: pat('x...x...x...x...'),
        brush: pat('....x.......x...'),
        ghost: pat(r.pick(['......g.......g.', '..g.......g.....', '......g...g...g.'])),
        ride: pat('X...x.o.X...x.o.'),
        phat: pat('....o.......o...'),
        kick: pat('g.......g.......'),
      },
    };
    this.kit.ghost = 'brush';
    this.compPat = r.pick([
      'x-----x---------' + '..x-------x-----',
      'x-------..x-----' + '......x-------x-',
      '..x-------x-----' + 'x-----x---------',
    ]);
    this.head = this.hook({ bars: 8, lo: 65, hi: 81, call: 'x---x-x-----x-x-', resp: 'x-x---x---x-----', end: 'x---x---x-------', leap: 0.35 });
    this.solo = this.hook({ bars: 8, lo: 67, hi: 84, call: 'x-x-x-x-x---x-x-', resp: 'x-x-x---x-x-x---', end: 'x-x-x---x-------', leap: 0.45 });
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.4, rev: 0.12 }, hats: { v: 0.26, rev: 0.1 }, cym: { v: 0.2 },
      bass: { v: 0.8 }, chords: { v: 1.1, rev: 0.2 }, lead: { v: 0.9, rev: 0.3, dly: 0.12 }, pad: { v: 0.3, rev: 0.4 }, fx: { v: 0.4 },
    };
    this.dlyTime = this.beatDur * 0.667;
    this.dlyFb = 0.25;
    this._wb = 43;
  }

  setup() {
    this.bass = new Pluck(this, 'bass', { level: 0.8 });
    this.rh = new Rhodes(this, 'chords', { level: 0.2, tone: 4200, trem: 0.25, tremRate: 3.2, bright: 0.75 });
    this.lead = new Breath(this, 'lead', { wave: 'triangle', wave2: 'square', level: 0.3, lp: 2600, vib: 22, vibRate: 5, breath: 0.2, glide: 0.06, atk: 0.06, rel: 0.15 });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.2, atk: 1, rel: 1.5, cut: 1800 });
  }

  // walking bass: roots on changes, chromatic approach into the next chord, chord tones between
  walk(s, t) {
    if ((s & 3) !== 0) return;
    const b = s >> 2;
    const ch = this.barChords[b];
    const p = this.prog;
    const next = b < 3 ? this.barChords[b + 1] : p.chords[p.beats[(this.barInSec * 4 + 4) % p.len]];
    const nearRoot = (c) => {
      const r0 = this.rootIn(c, 33);
      let best = r0;
      for (const m of [r0, r0 + 12]) if (m <= 52 && Math.abs(m - this._wb) < Math.abs(best - this._wb)) best = m;
      return best;
    };
    let m;
    const r = this.barRng(b + 11);
    if (this.changes[b]) m = nearRoot(ch);
    else if (next !== ch || b === 3) {
      const tgt = nearRoot(next);
      m = r.chance(0.7) ? tgt + (this._wb > tgt ? 1 : -1) : tgt + 7 - (tgt + 7 > 52 ? 12 : 0);
    } else {
      const root = nearRoot(ch);
      const cands = ch.iv.map((iv) => root + (iv % 12)).concat(ch.iv.map((iv) => root + (iv % 12) - 12)).filter((x) => x >= 33 && x <= 52 && x !== this._wb);
      const tgt = nearRoot(next);
      cands.sort((x, y) => Math.abs(x - (this._wb + tgt) / 2) - Math.abs(y - (this._wb + tgt) / 2));
      m = cands[r.chance(0.7) ? 0 : Math.min(1, cands.length - 1)] ?? root;
    }
    this._wb = m;
    this.bass.note(this.sw(s, t), m, this.beatDur * 0.92, b === 0 || b === 2 ? 0.9 : 0.75);
  }

  onStep(s, t) {
    if (this.on('bass')) this.walk(s, t);
    if (this.on('chords')) this.compPlay(this.rh, this.compPat, s, t, { n: 4, lo: 52, hi: 72, vel: 0.55, vopts: { rootless: true } });
    if (this.on('pad') && this.sec.type === 'break') this.padPlay(this.pad, s, t, { n: 3, lo: 60, hi: 76, vel: 0.4 });
    if (this.on('lead')) {
      const mel = this.sec.type === 'B' ? this.solo : this.head;
      this.melodyPlay(this.lead, mel, s, t, { vel: 0.8, gate: 0.92, legato: true });
    }
  }
}
