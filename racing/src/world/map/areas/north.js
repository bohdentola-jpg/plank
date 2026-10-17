// The north: the KAIDO PASS road (hairpins up from the top of Uptown through
// the cedars to the pass), on up to THE SUMMIT (its loop round the peak, the
// gravel road to the observatory at the very top), RIDGELINE ROAD east along
// the crest past the wind farm and the 92.7 radio tower down to the desert,
// and the Pass Road west through the north woods to the lake.
const nodes = {
  kd_0: [-60, -1860],
  kd_top: [-360, -3520],
  sm_1: [260, -3930],
  sm_j: [860, -4330],
  sm_e: [1660, -4420],
  sm_s: [1450, -5130],
  sm_w: [760, -4760],
  ob_top: [1260, -4690],
  rg_1: [2250, -3820], rg_2: [2850, -3570], rg_3: [3450, -3300], rg_e: [4300, -2820],
  tw_top: [2620, -3060],
  pw_1: [-1200, -3360], pw_2: [-2100, -3030],
};

const roads = [
  { id: 'kd_base', type: 'street', a: 'u_3_0', b: 'kd_0', name: 'KAIDO RD' },
  {
    id: 'kd_pass', type: 'mountain', a: 'kd_0', b: 'kd_top', name: 'KAIDO PASS', radius: 28,
    pts: [
      [-180, -2080, 90], [60, -2290, 30], [-230, -2480, 30], [90, -2690, 30], [-150, -2860, 45],
      [120, -3030, 30], [-280, -3200, 30], [-120, -3380, 60],
    ],
  },
  { id: 'kd_summit', type: 'mountain', a: 'kd_top', b: 'sm_1', name: 'SUMMIT RD', pts: [[-200, -3780, 80], [80, -3700, 40]] },
  { id: 'sm_climb', type: 'mountain', a: 'sm_1', b: 'sm_j', name: 'SUMMIT RD', pts: [[600, -4020, 40], [420, -4200, 30]] },
  // the Summit Loop round the peak
  { id: 'sm_l1', type: 'mountain', a: 'sm_j', b: 'sm_e', name: 'SUMMIT LOOP', pts: [[1250, -4180, 160]] },
  { id: 'sm_l2', type: 'mountain', a: 'sm_e', b: 'sm_s', name: 'SUMMIT LOOP', pts: [[1780, -4820, 160]] },
  { id: 'sm_l3', type: 'mountain', a: 'sm_s', b: 'sm_w', name: 'SUMMIT LOOP', pts: [[1000, -5110, 140]] },
  { id: 'sm_l4', type: 'mountain', a: 'sm_w', b: 'sm_j', name: 'SUMMIT LOOP', pts: [[700, -4520, 100]] },
  // up to the observatory
  { id: 'ob_road', type: 'gravel', a: 'sm_w', b: 'ob_top', name: 'OBSERVATORY RD', pts: [[980, -4840, 25], [880, -4700, 25], [1100, -4640, 25]] },
  // Ridgeline Road
  { id: 'rg_r1', type: 'mountain', a: 'sm_e', b: 'rg_1', name: 'RIDGELINE RD', pts: [[1950, -4150, 120]] },
  { id: 'rg_r2', type: 'mountain', a: 'rg_1', b: 'rg_2', name: 'RIDGELINE RD', pts: [[2550, -3650, 140]] },
  { id: 'rg_r3', type: 'mountain', a: 'rg_2', b: 'rg_3', name: 'RIDGELINE RD', pts: [[3150, -3480, 140]] },
  { id: 'rg_r4', type: 'mountain', a: 'rg_3', b: 'rg_e', name: 'RIDGELINE RD', pts: [[3900, -3200, 140]] },
  { id: 'tw_road', type: 'gravel', a: 'rg_2', b: 'tw_top', name: 'TOWER RD', pts: [[2900, -3300, 40], [2700, -3230, 30]] },
  // west through the woods to the lake
  { id: 'pw_r1', type: 'mountain', a: 'kd_top', b: 'pw_1', name: 'PASS RD WEST', pts: [[-800, -3550, 120]] },
  { id: 'pw_r2', type: 'mountain', a: 'pw_1', b: 'pw_2', name: 'PASS RD WEST', pts: [[-1650, -3300, 160]] },
  { id: 'pw_r3', type: 'mountain', a: 'pw_2', b: 'lk_n3', name: 'PASS RD WEST', pts: [[-2500, -2850, 160]] },
];

export default {
  id: 'north', nodes, roads,
  landmarks: [
    { id: 'shrine', name: 'KAIDO SHRINE', x: -330, z: -3560, kind: 'shrine', district: 'kaido' },
    { id: 'observatory', name: 'SUMMIT OBSERVATORY', x: 1260, z: -4700, kind: 'observatory', district: 'summit' },
    { id: 'lodge', name: 'SUMMIT LODGE', x: 900, z: -4280, kind: 'lodge', district: 'summit' },
    { id: 'windfarm', name: 'RIDGELINE WIND FARM', x: 3150, z: -3400, kind: 'windfarm', district: 'ridgeline' },
    { id: 'tower', name: 'THE 92.7 TOWER', x: 2620, z: -3060, kind: 'tower', district: 'ridgeline', hidden: true },
  ],
};
