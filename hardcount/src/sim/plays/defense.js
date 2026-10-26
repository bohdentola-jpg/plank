// The defensive playbook. Seven defenders: DL1 DL2 (linemen), LB1 (Mike)
// LB2 (Will), CB1 (lines up on the offense's left), CB2 (right), S.
// Each call gives every defender a job:
//   { rush: 'A'|'B'|'C'|'edge'|'contain', side: −1|+1 (offense's left/right, or 'near' the man) }
//   { man: 'L1'|'R1'|'L2'|'R2'|'B1' (first back)|'slot'|'strong2'|'auto', tech: 'press'|'off'|'trail', help: 'in'|'out' }
//   { zone: landmark id (ZONES below) }
//   { spy: 'QB' }
// Receivers are numbered from the sideline in (L1 = outermost on the offense's
// left); 'auto' takes whoever is left over. Man defenders without a man (an
// empty side) fall back to their `else` job.
export const ZONES = {
  deepL: { x: -1 / 3, z: 15, deep: true }, deepM: { x: 0, z: 17, deep: true }, deepR: { x: 1 / 3, z: 15, deep: true },
  halfL: { x: -0.25, z: 15, deep: true }, halfR: { x: 0.25, z: 15, deep: true },
  hookL: { x: -0.11, z: 7 }, hookM: { x: 0, z: 8 }, hookR: { x: 0.11, z: 7 },
  curlL: { x: -0.23, z: 9 }, curlR: { x: 0.23, z: 9 },
  flatL: { x: -0.34, z: 4 }, flatR: { x: 0.34, z: 4 },
  poleM: { x: 0, z: 13, deep: true },       // Tampa-2 Mike runs the middle of the field
  robber: { x: 0, z: 10 },                  // lurks under the deep middle
  preventL: { x: -0.3, z: 24, deep: true }, preventM: { x: 0, z: 28, deep: true }, preventR: { x: 0.3, z: 24, deep: true },
  hookDeepL: { x: -0.15, z: 14 }, hookDeepR: { x: 0.15, z: 14 },
};
// x is a fraction of the field width (from the middle), z yards off the line.

export const DEFENSE = [
  { id: 'c3', name: 'COVER 3', form: 'base', tags: ['base', 'zone'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { zone: 'hookM' }, LB2: { zone: 'curlR' },
    CB1: { zone: 'deepL' }, CB2: { zone: 'deepR' }, S: { zone: 'deepM' } } },
  { id: 'c2', name: 'COVER 2', form: 'base', tags: ['base', 'zone'], jobs: {
    DL1: { rush: 'edge', side: -1 }, DL2: { rush: 'edge', side: 1 }, LB1: { zone: 'hookM' }, LB2: { zone: 'curlR' },
    CB1: { zone: 'flatL' }, CB2: { zone: 'halfR' }, S: { zone: 'halfL' } } },
  { id: 'tampa', name: 'TAMPA 2', form: 'base', tags: ['zone', 'pass'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { zone: 'poleM' }, LB2: { zone: 'flatR' },
    CB1: { zone: 'flatL' }, CB2: { zone: 'halfR' }, S: { zone: 'halfL' } } },
  { id: 'c4', name: 'QUARTERS', form: 'dime', tags: ['zone', 'pass', 'long'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { zone: 'hookL' }, LB2: { zone: 'hookR' },
    CB1: { zone: 'deepL' }, CB2: { zone: 'deepR' }, S: { zone: 'deepM' } } },
  { id: 'c1', name: 'COVER 1', form: 'base', tags: ['base', 'man'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { zone: 'robber' }, LB2: { man: 'auto', tech: 'off', else: { zone: 'hookR' } },
    CB1: { man: 'L1', tech: 'off', help: 'in' }, CB2: { man: 'R1', tech: 'off', help: 'in' }, S: { zone: 'deepM' } } },
  { id: 'c1press', name: 'COVER 1 PRESS', form: 'base', tags: ['man', 'short'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { man: 'B1', tech: 'off', else: { zone: 'hookM' } }, LB2: { man: 'auto', tech: 'off', else: { zone: 'hookR' } },
    CB1: { man: 'L1', tech: 'press', help: 'in' }, CB2: { man: 'R1', tech: 'press', help: 'in' }, S: { zone: 'deepM' } } },
  { id: 'spy', name: 'QB SPY', form: 'base', tags: ['man', 'mobile'], jobs: {
    DL1: { rush: 'contain', side: -1 }, DL2: { rush: 'contain', side: 1 }, LB1: { spy: 'QB' }, LB2: { man: 'auto', tech: 'off', else: { zone: 'hookR' } },
    CB1: { man: 'L1', tech: 'off' }, CB2: { man: 'R1', tech: 'off' }, S: { zone: 'deepM' } } },
  { id: 'c0', name: 'COVER 0 BLITZ', form: 'base', tags: ['blitz', 'man', 'short'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { rush: 'A', side: -1 }, LB2: { rush: 'A', side: 1 },
    CB1: { man: 'L1', tech: 'press' }, CB2: { man: 'R1', tech: 'press' }, S: { man: 'auto', tech: 'off', else: { zone: 'deepM' } } } },
  { id: 'firezone', name: 'FIRE ZONE', form: 'base', tags: ['blitz', 'zone'], jobs: {
    DL1: { rush: 'A', side: -1 }, DL2: { zone: 'flatR' }, LB1: { zone: 'hookM' }, LB2: { rush: 'C', side: 1 },
    CB1: { zone: 'deepL' }, CB2: { zone: 'deepR' }, S: { zone: 'deepM' } } },
  { id: 'cblitz', name: 'CORNER BLITZ', form: 'base', tags: ['blitz', 'man'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { man: 'B1', tech: 'off', else: { zone: 'hookM' } }, LB2: { man: 'auto', tech: 'off', else: { zone: 'hookR' } },
    CB1: { rush: 'edge', side: -1 }, CB2: { man: 'R1', tech: 'press' }, S: { man: 'L1', tech: 'off', else: { zone: 'deepM' } } } },
  { id: 'sblitz', name: 'SAFETY BLITZ', form: 'base', tags: ['blitz', 'man'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { man: 'B1', tech: 'off', else: { zone: 'hookM' } }, LB2: { man: 'auto', tech: 'off', else: { zone: 'hookR' } },
    CB1: { man: 'L1', tech: 'off' }, CB2: { man: 'R1', tech: 'off' }, S: { rush: 'A', side: 1 } } },
  { id: 'mike', name: 'MIKE BLITZ', form: 'base', tags: ['blitz', 'zone'], jobs: {
    DL1: { rush: 'C', side: -1 }, DL2: { rush: 'C', side: 1 }, LB1: { rush: 'A', side: 1 }, LB2: { zone: 'hookM' },
    CB1: { zone: 'deepL' }, CB2: { zone: 'deepR' }, S: { zone: 'deepM' } } },
  { id: 'bear', name: 'BEAR FRONT', form: 'bear', tags: ['run', 'short'], jobs: {
    DL1: { rush: 'A', side: -1 }, DL2: { rush: 'A', side: 1 }, LB2: { rush: 'edge', side: 1 }, LB1: { man: 'B1', tech: 'off', else: { zone: 'hookM' } },
    CB1: { man: 'L1', tech: 'press' }, CB2: { man: 'R1', tech: 'press' }, S: { man: 'auto', tech: 'off', else: { zone: 'robber' } } } },
  { id: 'goal', name: 'GOAL LINE', form: 'goal', tags: ['goal', 'run'], jobs: {
    DL1: { rush: 'A', side: -1 }, DL2: { rush: 'A', side: 1 }, LB1: { rush: 'C', side: -1 }, LB2: { rush: 'C', side: 1 },
    CB1: { man: 'L1', tech: 'press' }, CB2: { man: 'R1', tech: 'press' }, S: { man: 'auto', tech: 'off', else: { zone: 'hookM' } } } },
  { id: 'prevent', name: 'PREVENT', form: 'prevent', tags: ['prevent', 'long'], jobs: {
    DL1: { rush: 'contain', side: -1 }, DL2: { rush: 'contain', side: 1 }, LB1: { zone: 'hookDeepL' }, LB2: { zone: 'hookDeepR' },
    CB1: { zone: 'preventL' }, CB2: { zone: 'preventR' }, S: { zone: 'preventM' } } },
  { id: 'dime_c3', name: 'DIME 3 SHADE', form: 'dime', tags: ['pass', 'long', 'zone'], jobs: {
    DL1: { rush: 'B', side: -1 }, DL2: { rush: 'B', side: 1 }, LB1: { zone: 'hookM' }, LB2: { zone: 'curlR' },
    CB1: { zone: 'deepL' }, CB2: { zone: 'deepR' }, S: { zone: 'deepM' } } },
];

export const DEFENSE_BY_ID = Object.fromEntries(DEFENSE.map((p) => [p.id, p]));
