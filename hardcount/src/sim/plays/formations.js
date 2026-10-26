// Formations in "play space": px = yards to the QB's RIGHT of the ball,
// pz = yards past the line of scrimmage (negative = backfield). The match
// flips px for mirrored plays and converts to world space with the ball's spot
// and the offense's direction (world x = ballX − px·dir, world z = los + pz·dir).
//
// Every formation lists its seven roles. Roles map to the depth chart through
// PERSONNEL: X → WR1, Z → WR2, SL/WB → WR3, RB → RB1, HB → RB2, FB/TE → TE1,
// P/K → the kicker, H → the backup QB (holder).

export const PERSONNEL = {
  QB: ['QB', 0], C: ['C', 0], LG: ['G', 0], RG: ['G', 1],
  X: ['WR', 0], Z: ['WR', 1], SL: ['WR', 2], WB: ['WR', 2], RB: ['RB', 0],
  HB: ['RB', 1], FB: ['TE', 0], TE: ['TE', 0], P: ['K', 0], K: ['K', 0], H: ['QB', 1],
};

const LINE = { C: [0, -0.55], LG: [-1.35, -0.62], RG: [1.35, -0.62] };
const UNDER = [0, -0.85];
const GUN = [0, -5];

// qb: how the ball gets to the passer — 'under' | 'gun' | 'pistol' | 'direct' (wildcat) | 'punt' | 'hold'
export const FORMATIONS = {
  gun_spread: { name: 'GUN SPREAD', qb: 'gun', roles: { ...LINE, QB: GUN, X: [-13, -0.35], Z: [13, -0.35], RB: [1.3, -5] } },
  gun_trips: { name: 'GUN TRIPS', qb: 'gun', roles: { ...LINE, QB: GUN, SL: [5.5, -1], X: [9.5, -1.1], Z: [13.5, -0.35] } },
  gun_bunch: { name: 'GUN BUNCH', qb: 'gun', roles: { ...LINE, QB: GUN, Z: [8.5, -0.35], SL: [9.7, -1.35], X: [7.3, -1.45] } },
  gun_empty: { name: 'GUN EMPTY', qb: 'gun', roles: { ...LINE, QB: GUN, X: [-13, -0.35], SL: [7, -1], Z: [13, -0.35] } },
  gun_twins: { name: 'GUN TWINS', qb: 'gun', roles: { ...LINE, QB: GUN, X: [-13, -0.35], SL: [-8, -1], RB: [-1.3, -5] } },
  pistol: { name: 'PISTOL ACE', qb: 'pistol', roles: { ...LINE, QB: [0, -4], TE: [2.3, -0.65], X: [-13, -0.35], RB: [0, -7] } },
  i_form: { name: 'I-FORM', qb: 'under', roles: { ...LINE, QB: UNDER, FB: [0, -3.6], RB: [0, -6.4], X: [-13, -0.35] } },
  ace_twins: { name: 'SINGLEBACK TWINS', qb: 'under', roles: { ...LINE, QB: UNDER, X: [-13, -0.35], SL: [-7.5, -1], RB: [0, -6] } },
  flexbone: { name: 'FLEXBONE', qb: 'under', roles: { ...LINE, QB: UNDER, RB: [0, -4.6], HB: [-3.3, -1.1], WB: [3.3, -1.1] } },
  wishbone: { name: 'WISHBONE', qb: 'under', roles: { ...LINE, QB: UNDER, FB: [0, -3.4], RB: [2.3, -5.2], HB: [-2.3, -5.2] } },
  wildcat: { name: 'WILDCAT', qb: 'direct', roles: { ...LINE, QB: [-13, -0.35], RB: [0, -5], HB: [1.7, -5.4], X: [13, -0.35] } },
  goal_line: { name: 'GOAL LINE', qb: 'under', roles: { ...LINE, QB: UNDER, FB: [0, -3.2], RB: [0, -5.8], TE: [2.3, -0.65] } },
  // special teams
  punt: { name: 'PUNT', qb: 'punt', special: 'punt', roles: { ...LINE, P: [0, -10], X: [-12, -0.35], Z: [12, -0.35], FB: [0, -4.5] } },
  field_goal: { name: 'FIELD GOAL', qb: 'hold', special: 'fg', roles: { ...LINE, H: [0, -6.8], K: [-1.8, -9.1], TE: [2.4, -0.7], FB: [-2.4, -0.7] } },
};

// Defensive alignment templates (offense's play space: pz > 0 is the defense's
// side). Man defenders re-align on their man and zone defenders by formation
// strength once the offense has lined up; these are where they start.
export const DEF_FORMATIONS = {
  base: { name: '2-2-3', DL1: [-1.9, 0.85], DL2: [1.9, 0.85], LB1: [-2.6, 4.6], LB2: [2.6, 4.6], CB1: [-12, 6], CB2: [12, 6], S: [0, 12] },
  bear: { name: '3-1-3', DL1: [-1.9, 0.85], DL2: [1.9, 0.85], LB2: [3.6, 0.95], LB1: [0, 4.2], CB1: [-12, 5], CB2: [12, 5], S: [0, 10] },
  dime: { name: '2-1-4', DL1: [-1.9, 0.85], DL2: [1.9, 0.85], LB1: [0, 5.2], LB2: [6, 5], CB1: [-12, 7], CB2: [12, 7], S: [0, 14] },
  goal: { name: 'GOAL LINE', DL1: [-1.2, 0.8], DL2: [1.2, 0.8], LB2: [3.3, 0.9], LB1: [-3.3, 0.9], CB1: [-10, 2.5], CB2: [10, 2.5], S: [0, 5] },
  prevent: { name: 'PREVENT', DL1: [-1.9, 0.85], DL2: [1.9, 0.85], LB1: [-4, 9], LB2: [4, 9], CB1: [-12, 12], CB2: [12, 12], S: [0, 22] },
};

export const DEF_PERSONNEL = {
  DL1: ['DL', 0], DL2: ['DL', 1], LB1: ['LB', 0], LB2: ['LB', 1], CB1: ['CB', 0], CB2: ['CB', 1], S: ['S', 0],
};
