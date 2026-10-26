// Shared building blocks for the football themes: brass sections, drum and
// timpani rolls, and explicit (hand-written) melodies on the 16th grid.

import { Poly } from './inst.js';

/** A brass section on the given layers. Any part can be omitted ({ tuba: null }). */
export function brassSection(song, o = {}) {
  const S = {};
  const mk = (key, layer, kind, level, rel) => {
    if (o[key] === null) return;
    S[key] = new Poly(song, o[key]?.layer || layer, kind, { level: o[key]?.level ?? level, rel, atk: 0.004 });
  };
  mk('tpt', 'lead', 'trumpet', 0.5, 0.1);
  mk('horn', 'chords', 'horn', 0.45, 0.14);
  mk('bone', 'chords', 'bone', 0.45, 0.12);
  mk('tuba', 'bass', 'tuba', 0.6, 0.1);
  return S;
}

/** Voice chord `ch` across a section: trumpets on top, horns, trombones, tuba on the root. */
export function brassHit(song, S, t, ch, dur, vel, o = {}) {
  if (!ch) return;
  const n = o.nopts || {};
  if (S.tpt && o.tpt !== false) for (const m of song.voicing(ch, 3, o.tLo ?? 65, o.tHi ?? 81, 'b:tpt')) S.tpt.note(t, m, dur, vel * 0.75, n);
  if (S.horn && o.horn !== false) for (const m of song.voicing(ch, 3, 55, 71, 'b:hrn')) S.horn.note(t, m, dur, vel * 0.7, n);
  if (S.bone && o.bone !== false) for (const m of song.voicing(ch, 3, 45, 62, 'b:bone')) S.bone.note(t, m, dur, vel * 0.75, n);
  if (S.tuba && o.tuba !== false) S.tuba.note(t, song.rootIn(ch, 31), dur, vel * 0.9, n);
}

/** Drum roll through song.hit: alternating strokes every `gap` s, v0 → v1. */
export function roll(song, role, t, dur, v0, v1, gap = 0.034, o = {}) {
  let k = 0;
  for (let tt = t; tt < t + dur - 1e-4; tt += gap, k++) {
    const u = (tt - t) / dur;
    song.hit(role, tt, (v0 + (v1 - v0) * u) * (k % 2 ? 0.86 : 1), o);
  }
}

/** Timpani roll on a Poly('timp'). */
export function timpRoll(inst, t, dur, midi, v0, v1, gap = 0.055) {
  let k = 0;
  for (let tt = t; tt < t + dur - 1e-4; tt += gap, k++) {
    const u = (tt - t) / dur;
    inst.note(tt, midi, gap * 3, (v0 + (v1 - v0) * u) * (k % 2 ? 0.85 : 1));
  }
}

/**
 * Hand-written melody → indexed form usable with song.melodyPlay().
 * notes: [[bar, step, len, midi, vel = 1], …]
 */
export function written(notes, bars) {
  const idx = new Array(bars * 16).fill(null);
  for (const [bar, s, len, m, v = 1] of notes) idx[bar * 16 + s] = { bar, s, len, m, v };
  return { idx, bars, notes };
}

/** Step-pattern string → array (spaces and bars ignored). */
export const steps = (str) => [...str.replace(/[\s|]/g, '')];
