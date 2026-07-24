// Single-player content: the GAUNTLET ladder and the TRAINING presets.
import { charById } from './roster.js';
import { stageById } from './stages.js';

/** Six rounds, escalating, finishing on the void deck against a boss pair. */
export const GAUNTLET = [
  { round: 1, label: 'ROUND 1', stage: 'homefield', foes: [{ id: 'chip' }], stocks: 2, blurb: 'A warm-up on the 50.' },
  { round: 2, label: 'ROUND 2', stage: 'arcade', foes: [{ id: 'spirit' }], stocks: 2, blurb: 'The pep squad is not impressed.' },
  { round: 3, label: 'ROUND 3', stage: 'pond', foes: [{ id: 'ribbit' }, { id: 'chip' }], stocks: 1, blurb: 'Two on one. No grip.' },
  { round: 4, label: 'ROUND 4', stage: 'magma', foes: [{ id: 'crunch' }], stocks: 2, blurb: 'Something down here is hungry.' },
  { round: 5, label: 'ROUND 5', stage: 'blimp', foes: [{ id: 'volt' }, { id: 'pixel' }], stocks: 1, blurb: 'The demo units have organised.' },
  { round: 6, label: 'FINAL', stage: 'void', foes: [{ id: 'clank' }, { id: 'tusk' }], stocks: 2, music: 'boss', blurb: 'The last two things in the bin.' },
];

/** CPU level for a gauntlet round at a given difficulty. */
export function gauntletLevel(difficulty, round) {
  const base = { easy: 2, normal: 4, hard: 6 }[difficulty] ?? 4;
  return Math.max(1, Math.min(9, base + Math.floor((round - 1) * 0.8)));
}

/** Build the entrants for one gauntlet round. */
export function gauntletRound(difficulty, roundIndex, playerDef, playerAlt) {
  const r = GAUNTLET[roundIndex];
  const level = gauntletLevel(difficulty, r.round);
  const entrants = [{ def: playerDef, alt: playerAlt, cpu: 0, name: playerDef.name }];
  for (const f of r.foes) {
    const def = charById(f.id);
    entrants.push({ def, alt: 1, cpu: level, name: def.name });
  }
  return {
    entrants,
    stage: stageById(r.stage),
    rules: { mode: 'stock', stocks: r.stocks, timeLimit: 0, items: roundIndex >= 3, itemRate: 1, damageRatio: 1 },
    music: r.music,
    meta: r,
  };
}

export const TRAINING_DUMMIES = [
  { label: 'STAND STILL', cpu: 0, behaviour: 'stand' },
  { label: 'WALK AROUND', cpu: 1, behaviour: 'walk' },
  { label: 'FIGHT BACK · LV3', cpu: 3, behaviour: 'fight' },
  { label: 'FIGHT BACK · LV7', cpu: 7, behaviour: 'fight' },
];
