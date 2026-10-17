// The waterfront, west to east: the SHIPYARD's road along the dry docks, the
// container terminal at HARBOR DOCKS (its quay loop behind the gate), the
// Harbor Lift Bridge over the river mouth, Chinatown's sea wall and The
// Works, PIER 9 (the boardwalk along the beach and the pier out into the
// bay), then up onto the BAYSHORE cliffs, south along them, across the
// Bayshore Bridge to HALCYON POINT and its lighthouse.
const nodes = {
  // shipyard
  sy_w: [-5300, 2080], sy_m: [-4200, 2120], sy_e: [-3000, 2120],
  sy_q1: [-4950, 2470], sy_q2: [-3350, 2380],
  // harbor terminal
  wf_hw: [-2700, 1980], wf_gate: [-2000, 1930], wf_he: [-1420, 1900],
  hb_gn: [-2000, 2060], hb_nw: [-2620, 2060], hb_ne: [-1480, 2060], hb_sw: [-2620, 2370], hb_se: [-1480, 2330],
  // over the river mouth, along the sea wall
  wf_west: [-640, 1800], wf_grant: [-80, 1790], wf_works: [620, 1780], wf_pier: [1200, 1800],
  wf_beach: [1800, 1690], wf_cliff: [2460, 1560],
  // Pier 9
  p9_a: [700, 1905], p9_b: [1200, 1950], p9_c: [1720, 1810], p9_tip: [1200, 2440],
  // Bayshore
  bs_1: [2810, 1960], bs_2: [3010, 2400], bs_be: [3080, 2770], bs_east: [3450, 2420],
  // Halcyon Point
  pt_e: [2230, 3240], pt_n: [1560, 3060], pt_lh: [1500, 3700], pt_w: [1180, 3420],
};

const roads = [
  { id: 'sy_road1', type: 'quay', a: 'sy_w', b: 'sy_m', name: 'SHIPYARD RD' },
  { id: 'sy_road2', type: 'quay', a: 'sy_m', b: 'sy_e', name: 'SHIPYARD RD' },
  { id: 'sy_dock1', type: 'quay', a: 'sy_w', b: 'sy_q1', pts: [[-5150, 2350, 60]] },
  { id: 'sy_dock2', type: 'quay', a: 'sy_q1', b: 'sy_q2', name: 'DRY DOCK RD', pts: [[-4200, 2500, 120]] },
  { id: 'sy_dock3', type: 'quay', a: 'sy_q2', b: 'sy_e', pts: [[-3100, 2300, 60]] },
  { id: 'wf_sh', type: 'avenue', a: 'sy_e', b: 'wf_hw', name: 'HARBOR BLVD' },
  { id: 'wf_h1', type: 'avenue', a: 'wf_hw', b: 'wf_gate', name: 'HARBOR BLVD' },
  { id: 'wf_h2', type: 'avenue', a: 'wf_gate', b: 'wf_he', name: 'HARBOR BLVD' },
  // the terminal: through the gate, round the quay loop
  { id: 'hb_gate', type: 'quay', a: 'wf_gate', b: 'hb_gn', name: 'TERMINAL GATE' },
  { id: 'hb_n1', type: 'quay', a: 'hb_nw', b: 'hb_gn' },
  { id: 'hb_n2', type: 'quay', a: 'hb_gn', b: 'hb_ne' },
  { id: 'hb_e', type: 'quay', a: 'hb_ne', b: 'hb_se' },
  { id: 'hb_s', type: 'quay', a: 'hb_se', b: 'hb_sw', name: 'BERTH ROAD' },
  { id: 'hb_w', type: 'quay', a: 'hb_sw', b: 'hb_nw' },
  { id: 'hb_link', type: 'street', a: 'wf_hw', b: 'hb_nw' },
  // the lift bridge over the river mouth
  { id: 'wf_lift', type: 'avenue', a: 'wf_he', b: 'wf_west', name: 'HARBOR LIFT BRIDGE', pts: [[-1000, 1850, 300]], clear: 7 },
  { id: 'wf_seawall1', type: 'avenue', a: 'wf_west', b: 'wf_grant', name: 'SEAWALL DR' },
  { id: 'wf_seawall2', type: 'avenue', a: 'wf_grant', b: 'wf_works', name: 'SEAWALL DR' },
  { id: 'wf_beach1', type: 'avenue', a: 'wf_works', b: 'wf_pier', name: 'BEACH BLVD' },
  { id: 'wf_beach2', type: 'avenue', a: 'wf_pier', b: 'wf_beach', name: 'BEACH BLVD' },
  { id: 'wf_beach3', type: 'coastal', a: 'wf_beach', b: 'wf_cliff', name: 'BAYSHORE RTE' },
  // Pier 9: the boardwalk on the sand, the pier into the bay
  { id: 'p9_link1', type: 'street', a: 'wf_works', b: 'p9_a' },
  { id: 'p9_link2', type: 'street', a: 'wf_pier', b: 'p9_b' },
  { id: 'p9_link3', type: 'street', a: 'wf_beach', b: 'p9_c' },
  { id: 'p9_walk1', type: 'boardwalk', a: 'p9_a', b: 'p9_b', name: 'THE BOARDWALK', pts: [[950, 1945, 200]] },
  { id: 'p9_walk2', type: 'boardwalk', a: 'p9_b', b: 'p9_c', name: 'THE BOARDWALK', pts: [[1460, 1900, 200]] },
  { id: 'p9_pier', type: 'boardwalk', a: 'p9_b', b: 'p9_tip', name: 'PIER 9', clear: 5 },
  // Bayshore: up onto the cliffs, south along them
  { id: 'bs_r1', type: 'coastal', a: 'wf_cliff', b: 'bs_1', name: 'BAYSHORE RTE', pts: [[2700, 1700, 120]] },
  { id: 'bs_r2', type: 'coastal', a: 'bs_1', b: 'bs_2', name: 'BAYSHORE RTE', pts: [[2860, 2200, 200]] },
  { id: 'bs_r3', type: 'coastal', a: 'bs_2', b: 'bs_be', name: 'BAYSHORE RTE' },
  { id: 'bs_east', type: 'highway', a: 'bs_2', b: 'bs_east', name: 'CLIFF RD' },
  // the Bayshore Bridge (suspension: the district builds its towers and cables)
  { id: 'bs_bridge', type: 'highway', a: 'bs_be', b: 'pt_e', name: 'BAYSHORE BRIDGE', clear: 34, smooth: 600 },
  // Halcyon Point
  { id: 'pt_r1', type: 'coastal', a: 'pt_e', b: 'pt_n', pts: [[1950, 3080, 120]], name: 'POINT RD' },
  { id: 'pt_r2', type: 'coastal', a: 'pt_n', b: 'pt_w', pts: [[1250, 3200, 120]], name: 'POINT RD' },
  { id: 'pt_r3', type: 'coastal', a: 'pt_w', b: 'pt_lh', pts: [[1300, 3620, 80]], name: 'LIGHTHOUSE RD' },
  { id: 'pt_r4', type: 'coastal', a: 'pt_lh', b: 'pt_e', pts: [[1900, 3540, 120], [2160, 3380, 80]], name: 'POINT RD' },
];

export default {
  id: 'coast', nodes, roads,
  landmarks: [
    { id: 'liftbridge', name: 'HARBOR LIFT BRIDGE', x: -1190, z: 1880, kind: 'bridge', district: 'harbor' },
    { id: 'ferris', name: 'PIER 9 WHEEL', x: 1300, z: 2150, kind: 'ferris', district: 'pier9' },
    { id: 'bayshorebridge', name: 'BAYSHORE BRIDGE', x: 2650, z: 3010, kind: 'bridge', district: 'bayshore' },
    { id: 'lighthouse', name: 'HALCYON LIGHT', x: 1500, z: 3760, kind: 'lighthouse', district: 'point' },
  ],
};
