// Seeded randomness, step-pattern parsing and music theory shared by the song
// generators. Everything here is pure JS (no audio nodes).

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mix32(a, b) {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ (b >>> 0);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 0x2f6b1d; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor((b - a + 1) * this.next()); }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }
}

// ---------------------------------------------------------------------------
// Step patterns: one char per 16th. '.' rest, g ghost, o soft, x hit, X accent.
const VEL = { g: 0.28, o: 0.55, x: 0.82, X: 1 };
export function pat(s) {
  const out = [];
  for (const c of s) {
    if (c === ' ' || c === '|') continue;
    out.push(VEL[c] || 0);
  }
  return out;
}

/** Note-role patterns for bass/riffs: '.' rest, '-' hold, letters = roles. */
export function rolePat(s) {
  const out = [];
  for (const c of s) if (c !== ' ' && c !== '|') out.push(c);
  return out;
}

// ---------------------------------------------------------------------------
// Scales & chords

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentaMinor: [0, 3, 5, 7, 10],
  pentaMajor: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
};

const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7],
  7: [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], mM7: [0, 3, 7, 11],
  9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  69: [0, 4, 7, 9, 14], 11: [0, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17],
  13: [0, 4, 10, 14, 21], m13: [0, 3, 10, 14, 21],
  '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15], '7sus4': [0, 5, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], o: [0, 3, 6], o7: [0, 3, 6, 9], 'ø': [0, 3, 6, 10],
  '+': [0, 4, 8], 'M7#11': [0, 4, 7, 11, 18],
};

const RN = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };

/**
 * Roman-numeral chord relative to the key tonic. Case gives the triad quality
 * ('i' minor, 'I' major); 'b'/'#' prefixes borrow (so a minor key reads
 * 'i bVI bIII bVII'). Suffixes: 7 9 11 13 6 add9 (quality follows case),
 * or explicit M7 M9 sus2 sus4 7sus4 5 o o7 ø + 7b9 7#9 69 M7#11.
 */
export function parseChord(sym) {
  const m = /^([b#]?)(vii|iii|vi|iv|ii|v|i|VII|III|VI|IV|II|V|I)(.*)$/.exec(sym);
  if (!m) throw new Error(`bad chord ${sym}`);
  const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  const num = m[2];
  const minor = num === num.toLowerCase();
  const suf = m[3];
  let q;
  if (suf === '') q = minor ? 'm' : '';
  else if (/^(7|9|11|13|6|add9)$/.test(suf)) q = (minor ? 'm' : '') + suf;
  else q = suf;
  const iv = QUAL[q];
  if (!iv) throw new Error(`bad chord quality ${sym}`);
  const root = (((RN[num.toLowerCase()] + acc) % 12) + 12) % 12;
  return { sym, root, q, iv, minor: iv[1] === 3 };
}

/**
 * Progression from 'i9:2 bVIM7:2 ...' (chord:bars, bars default 1, may be .5).
 * Returns { chords, beats: chord index per beat, len: beats }.
 */
export function prog(str) {
  const items = str.trim().split(/\s+/).map((tok) => {
    const [c, bars = '1'] = tok.split(':');
    return { ch: parseChord(c), beats: Math.max(1, Math.round(parseFloat(bars) * 4)) };
  });
  const beats = [];
  items.forEach((it, i) => { for (let b = 0; b < it.beats; b++) beats.push(i); });
  return { chords: items.map((it) => it.ch), beats, len: beats.length, str };
}

/** Pitch classes (0..11, absolute) for a chord in a key. */
export function chordPcs(ch, keyPc) {
  return ch.iv.map((i) => (keyPc + ch.root + i) % 12);
}

/** MIDI notes in [lo, hi] whose pitch class is in pcs (sorted). */
export function notesIn(pcs, lo, hi) {
  const out = [];
  for (let m = Math.ceil(lo); m <= hi; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

/** Nearest MIDI note to `target` with pitch class in pcs. */
export function nearestPc(pcs, target) {
  let best = target, bd = 99;
  for (let d = 0; d <= 6; d++) {
    for (const m of [target - d, target + d]) {
      if (pcs.includes(((m % 12) + 12) % 12) && d < bd) { best = m; bd = d; }
    }
    if (bd < 99) break;
  }
  return best;
}

/**
 * Voice-led chord voicing: n notes of chord `ch` (key tonic pc keyPc) within
 * [lo, hi], moving as little as possible from `prev`. opts.rootless drops the
 * root for extended chords (jazz), opts.spread prefers open voicings (pads).
 */
export function voice(ch, keyPc, n, lo, hi, prev, opts = {}) {
  const rootPc = (keyPc + ch.root) % 12;
  let tones = [];
  for (const i of ch.iv) { const pc = i % 12; if (!tones.includes(pc)) tones.push(pc); }
  if (tones.length > n && tones.length >= 4 && tones.includes(7) && ch.q !== '5') tones = tones.filter((t) => t !== 7);
  if (tones.length > n && opts.rootless) tones = tones.filter((t) => t !== 0);
  while (tones.length > n) tones.pop();
  const base = tones.slice();
  let k = 0;
  while (tones.length < n) tones.push(base[k++ % base.length]);
  const options = tones.map((t) => {
    const pc = (rootPc + t) % 12;
    const arr = [];
    for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc) arr.push(m);
    return arr;
  });
  const center = opts.center ?? (lo + hi) / 2;
  const sortedPrev = prev && prev.length ? prev.slice().sort((a, b) => a - b) : null;
  let best = null, bestCost = Infinity;
  const cur = new Array(n);
  const rec = (i) => {
    if (i === n) {
      const v = cur.slice().sort((a, b) => a - b);
      for (let j = 1; j < n; j++) if (v[j] === v[j - 1]) return;
      let cost = 0;
      const span = v[n - 1] - v[0];
      if (opts.spread) cost += Math.abs(span - opts.spread) * 0.35;
      else if (span > 14) cost += (span - 14) * 0.8;
      for (let j = 1; j < n; j++) {
        const iv = v[j] - v[j - 1];
        if (v[j - 1] < 53 && iv < 5) cost += 3;
        if (iv === 1 && v[j] > 72) cost += 0.5;
      }
      if (sortedPrev) {
        for (let j = 0; j < n; j++) cost += Math.abs(v[j] - sortedPrev[Math.min(j, sortedPrev.length - 1)]);
      }
      const mean = v.reduce((a, b) => a + b, 0) / n;
      cost += Math.abs(mean - center) * (sortedPrev ? 0.25 : 0.8);
      if (opts.rootBottom && ((v[0] - rootPc) % 12 + 12) % 12 !== 0) cost += 6;
      if (cost < bestCost) { bestCost = cost; best = v; }
      return;
    }
    for (const m of options[i]) { cur[i] = m; rec(i + 1); }
  };
  rec(0);
  if (!best) {
    best = tones.map((t) => {
      let m = lo + ((rootPc + t - lo) % 12 + 12) % 12;
      return m;
    }).sort((a, b) => a - b);
  }
  return best;
}

// ---------------------------------------------------------------------------
// Rhythms for melodies: '.' rest, 'x' onset, '-' sustain.

export function rhythm(str) {
  const s = str.replace(/[\s|]/g, '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== 'x' && s[i] !== 'X') continue;
    let len = 1;
    while (i + len < s.length && s[i + len] === '-') len++;
    out.push({ s: i, len, acc: s[i] === 'X' });
  }
  return { notes: out, steps: s.length };
}

// Contours in scale steps relative to a per-bar anchor note (a chord tone).
const CONTOURS = [
  [0, 0, 2, 1, 0, -1, 0, 2],
  [0, 2, 4, 2, 1, 0, -1, 0],
  [4, 3, 2, 0, 2, 1, 0, -1],
  [0, -1, 0, 2, 4, 2, 0, 1],
  [0, 2, 0, 3, 0, 4, 2, 1],
  [0, 0, 0, 2, 1, 1, 0, -3],
  [2, 0, 2, 4, 3, 2, 0, 0],
  [0, 4, 2, 0, 1, 2, 3, 4],
  [0, 1, 2, 4, 2, 1, 0, 1],
  [4, 2, 0, 2, 4, 5, 4, 2],
];

/**
 * Generate a hook over `bars` bars against a progression: one contour motif is
 * re-sung on every call unit, anchored on a chord tone of that unit's chord
 * (so it sequences with the harmony), odd units answer with a variant tail and
 * the last unit cadences on the chord root/third. Strong beats snap to chord tones.
 *
 * o: { r, bars, chordAt(bar, step) -> chord, keyPc, scale, lo, hi,
 *      rhythms: { call, resp, end } (rhythm() objects, all 16 or all 32 steps) }
 * Returns [{ bar, s, len, m, v }] (s relative to the bar).
 */
export function makeMelody(o) {
  const { r, bars, chordAt, keyPc, lo, hi } = o;
  const scale = SCALES[o.scale || 'minor'].map((x) => (x + keyPc) % 12);
  const ladder = notesIn(scale, lo - 14, hi + 14);
  const idxOf = (m) => {
    let best = 0, bd = 99;
    for (let i = 0; i < ladder.length; i++) { const d = Math.abs(ladder[i] - m); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const stepFrom = (m, k) => ladder[clamp(idxOf(m) + Math.round(k), 0, ladder.length - 1)];
  const pcOf = (m) => ((m % 12) + 12) % 12;
  const center = Math.round((lo + hi) / 2);
  const cA = r.pick(CONTOURS);
  const cB = r.pick(CONTOURS);
  const resp = cA.slice(0, 4).concat(cB.slice(4));
  const end = cA.slice(0, 3).concat([2, 1, 0, -1, 0]);
  const rh = o.rhythms;
  const unitBars = rh.call.steps > 16 ? 2 : 1;
  const units = Math.max(1, Math.ceil(bars / unitBars));
  const notes = [];
  let anchor = nearestPc(chordPcs(chordAt(0, 0), keyPc), center - 2 + r.int(-2, 2));
  let prev = anchor;
  for (let u = 0; u < units; u++) {
    const b = u * unitBars;
    const last = u === units - 1 && units > 1;
    const isResp = u % 2 === 1;
    const rr = last ? rh.end : isResp ? rh.resp : rh.call;
    const contour = last ? end : isResp ? resp : cA;
    if (u > 0) {
      const pcs = chordPcs(chordAt(b, 0), keyPc);
      anchor = nearestPc(pcs, anchor + (isResp ? r.pick([-2, -1, 0]) : r.pick([0, 1, 2])));
    }
    const up = Math.max(...contour) * 1.75, dn = Math.min(...contour) * 1.75;
    if (anchor + up > hi + 4) anchor -= 12;
    if (anchor + dn < lo - 4) anchor += 12;
    rr.notes.forEach((n, i) => {
      const bar = b + Math.floor(n.s / 16);
      if (bar >= bars) return;
      const s = n.s % 16;
      const ch = chordAt(bar, s);
      const pcs = chordPcs(ch, keyPc);
      const strong = s % 4 === 0 || n.len >= 3 || n.acc;
      let m = stepFrom(anchor, contour[i % contour.length]);
      if (strong && !pcs.includes(pcOf(m))) m = nearestPc(pcs, m);
      if (last && i === rr.notes.length - 1) {
        m = nearestPc([(keyPc + ch.root) % 12, (keyPc + ch.root + ch.iv[1]) % 12], prev);
      }
      while (m > hi + 3) m -= 12;
      while (m < lo - 3) m += 12;
      notes.push({ bar, s, len: n.len, m, v: n.acc ? 1 : strong ? 0.88 : 0.74 });
      prev = m;
    });
  }
  return notes;
}

/**
 * Tense ostinato pinned to the tonic (plays instead of the hook while the
 * player is behind): b2 / b6 / tritone colour over driving 16ths. 2 bars.
 */
export function makeChase(r, keyPc, lo) {
  const root = lo + (((keyPc - lo) % 12) + 12) % 12;
  const rh = r.pick(['x.xx.x.xx.x.xx.x', 'x..x..x.x..x..x.', 'xx.x.xx.xx.x.x.x', 'x.x.xx.x.x.xx.x.', 'x..x.x..x.x.x..x']);
  const cellA = r.pick([[0, 0, 12, 0, 1, 0, 7, 8], [0, 3, 0, 1, 0, 7, 0, 8], [0, 12, 10, 12, 0, 7, 8, 7], [0, 0, 1, 3, 0, 0, 8, 7]]);
  const cellB = r.pick([[0, 0, 12, 0, 1, 0, 3, 1], [0, 3, 5, 6, 7, 6, 5, 3], [0, 12, 0, 11, 0, 10, 8, 7], [0, 1, 0, 1, 3, 1, 0, -1]]);
  const notes = [];
  for (let b = 0; b < 2; b++) {
    const cell = b ? cellB : cellA;
    let k = 0;
    for (let s = 0; s < 16; s++) {
      if (rh[s] !== 'x') continue;
      let len = 1;
      while (s + len < 16 && rh[s + len] === '.' && len < 2) len++;
      notes.push({ bar: b, s, len, m: root + cell[k++ % cell.length], v: s % 4 === 0 ? 0.95 : 0.75 });
    }
  }
  return { idx: indexNotes(notes, 2), bars: 2, notes };
}

/** Index melody notes by absolute step (bar*16+s) for fast lookup. */
export function indexNotes(notes, bars) {
  const map = new Array(bars * 16).fill(null);
  for (const n of notes) {
    const k = n.bar * 16 + n.s;
    if (k >= 0 && k < map.length) map[k] = n;
  }
  return map;
}
