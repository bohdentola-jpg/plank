// Special teams: kickoffs and returns, punts and punt returns, field goals,
// extra points and their fakes. Positions are play space (px to the kicking
// team's right, pz downfield from the kicking spot / line of scrimmage).

// kickoff: K plus six in lanes; pz relative to the kickoff line
export const KICKOFF_ALIGN = {
  K: [0, -6], L1: [-0.85, -1], L2: [-0.55, -1], L3: [-0.2, -1], R3: [0.2, -1], R2: [0.55, -1], R1: [0.85, -1],
};
// px values above are fractions of the half width; the return team in yards
// back from the kicking line (pz) — the deep man sits on his own 3-yard line
export const RETURN_ALIGN = {
  KR: [0, null], U: [0, -12], F1: [-0.6, 11], F2: [0, 11], F3: [0.6, 11], M1: [-0.35, 24], M2: [0.35, 24],
};

export const KICKOFF_PLAYS = [
  { id: 'ko_deep', name: 'KICK DEEP', kind: 'kickoff', kick: 'deep', tags: ['normal'] },
  { id: 'ko_squib', name: 'SQUIB', kind: 'kickoff', kick: 'squib', tags: ['safe'] },
  { id: 'ko_pooch', name: 'POOCH', kind: 'kickoff', kick: 'pooch', tags: ['safe'] },
  { id: 'ko_onside', name: 'ONSIDE', kind: 'kickoff', kick: 'onside', tags: ['onside'] },
];

export const RETURN_PLAYS = [
  { id: 'kr_middle', name: 'MIDDLE RETURN', kind: 'return', lane: 0, tags: ['normal'] },
  { id: 'kr_left', name: 'RETURN LEFT', kind: 'return', lane: -1, tags: ['normal'] },
  { id: 'kr_right', name: 'RETURN RIGHT', kind: 'return', lane: 1, tags: ['normal'] },
  { id: 'kr_reverse', name: 'REVERSE RETURN', kind: 'return', lane: 1, reverse: true, tags: ['trick'] },
  { id: 'kr_throwback', name: 'THROWBACK', kind: 'return', lane: 1, throwback: true, tags: ['trick', 'lateral'] },
  { id: 'kr_hands', name: 'HANDS TEAM', kind: 'return', lane: 0, hands: true, tags: ['onside'] },
];

export const PUNT_PLAYS = [
  { id: 'pt_normal', name: 'PUNT', kind: 'punt', form: 'punt', tags: ['normal'] },
  { id: 'pt_coffin', name: 'COFFIN CORNER', kind: 'punt', form: 'punt', aim: 'corner', tags: ['short'] },
  { id: 'pt_fakepass', name: 'FAKE PUNT PASS', kind: 'fake', form: 'punt', fake: 'pass', routes: { X: 'slant', Z: 'go', FB: 'flat' }, reads: ['X', 'FB', 'Z'], tags: ['fake'] },
  { id: 'pt_fakerun', name: 'FAKE PUNT RUN', kind: 'fake', form: 'punt', fake: 'run', run: { carrier: 'FB', give: 'direct', hole: 'B', side: 1, scheme: 'power' }, tags: ['fake'] },
];

export const PUNT_RETURN_PLAYS = [
  { id: 'pr_return', name: 'PUNT RETURN', kind: 'puntReturn', rush: 2, tags: ['normal'] },
  { id: 'pr_block', name: 'PUNT BLOCK', kind: 'puntReturn', rush: 5, tags: ['block'] },
  { id: 'pr_safe', name: 'SAFE (WATCH FAKE)', kind: 'puntReturn', rush: 0, safe: true, tags: ['safe'] },
];

export const FG_PLAYS = [
  { id: 'fg_kick', name: 'FIELD GOAL', kind: 'fg', form: 'field_goal', tags: ['normal'] },
  { id: 'fg_fakepass', name: 'FAKE FG PASS', kind: 'fake', form: 'field_goal', fake: 'pass', passer: 'H', routes: { TE: 'flat', FB: 'leak' }, reads: ['TE', 'FB'], tags: ['fake'] },
  { id: 'fg_fakerun', name: 'FAKE FG RUN', kind: 'fake', form: 'field_goal', fake: 'run', run: { carrier: 'H', give: 'keep', hole: 'edge', side: 1, scheme: 'sweep' }, tags: ['fake'] },
];

export const FG_DEFENSE_PLAYS = [
  { id: 'fgd_block', name: 'FG BLOCK', kind: 'fgDefense', rush: 5, tags: ['block'] },
  { id: 'fgd_safe', name: 'FG SAFE', kind: 'fgDefense', rush: 3, safe: true, tags: ['safe'] },
];

export const SPECIAL_BY_ID = Object.fromEntries([
  ...KICKOFF_PLAYS, ...RETURN_PLAYS, ...PUNT_PLAYS, ...PUNT_RETURN_PLAYS, ...FG_PLAYS, ...FG_DEFENSE_PLAYS,
].map((p) => [p.id, p]));
