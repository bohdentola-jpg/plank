// The east: the EASTSIDE suburbs (a grid of quiet streets of houses, a strip
// along Eastside Avenue) between downtown and the plains; ROUTE 99 running
// north–south through the desert from the canyon country to the cliffs over
// the bay, crossing the I-9's end; RED ROCK CANYON (a road along the canyon
// floor and back along its rim); GHOST TOWN's main street loop; and DRY
// LAKE's salt flat and its drag strip.
import { grid } from '../helpers.js';

const ES = grid('es', {
  x: 0, z: 0,
  cols: [800, 1050, 1300, 1550, 1800, 2050, 2300],
  rows: [-390, -60, 270, 560, 850, 1140],
  // The Works has the south-west corner
  hole: (i, j) => j >= 3 && i < 3,
  colType: (i) => (i === 3 ? 'avenue' : 'street'),
  rowType: (j) => (j === 1 ? 'avenue' : 'street'),
  rowNames: { 1: 'EASTSIDE AVE' },
  colNames: { 3: 'ORCHARD AVE' },
  district: 'eastside',
});

const nodes = {
  ...ES.nodes,
  // Route 99
  r99_n1: [3960, -800], r99_rr: [4050, -1250], r99_n2: [4300, -2150],
  r99_s1: [3700, 400], gt_j: [3620, 900], r99_s2: [3500, 1700],
  // Red Rock Canyon: along the floor, back along the rim
  rr_w: [3960, -1360], rr_e: [5260, -1450], rr_r1: [5150, -1990], rr_r2: [4650, -2100], rr_r3: [4150, -1920],
  // Ghost Town
  gt_a: [3700, 1050], gt_b: [4110, 1060], gt_c: [4150, 1460], gt_d: [3730, 1560],
  // Dry Lake
  dl_w: [4780, 240], dl_a: [4900, 300], dl_b: [6000, 300], dl_n: [5450, -300], dl_s: [5450, 900],
  // backroads: the Array Rd down into the High Desert's basin (and the silo
  // up a side valley), the Dutchman mine under the mesa, the arch overlook,
  // the mine hill over Ghost Town, the Borax Rd from Ghost Town to the lake
  ar_1: [5520, -2780], ar_j: [5870, -3780], ar_end: [5945, -4740], si_end: [5470, -4655],
  mn_end: [3818, -2186], ov_end: [4652, -2004], hf_top: [4540, 1572],
};

const roads = [
  ...ES.roads,
  // downtown's streets out east, The Works' too
  { id: 'es_c1', type: 'street', a: 'c_12_1', b: 'es_0_0' },
  { id: 'es_c4', type: 'avenue', a: 'c_12_4', b: 'es_0_1', name: 'EASTSIDE AVE' },
  { id: 'es_c7', type: 'street', a: 'c_12_7', b: 'es_0_2' },
  { id: 'es_w1', type: 'street', a: 'c_16_10', b: 'es_3_3' },
  { id: 'es_w2', type: 'street', a: 'c_16_14', b: 'es_3_4' },
  { id: 'es_i9', type: 'street', a: 'i9_e1', b: 'es_6_0' },
  { id: 'es_pier', type: 'street', a: 'es_4_5', b: 'wf_beach', pts: [[1800, 1450, 100]] },
  // Route 99, north from the I-9's end to the canyon and the ridge, south to the cliffs
  { id: 'r99_1', type: 'highway', a: 'i9_e2', b: 'r99_n1', name: 'ROUTE 99' },
  { id: 'r99_2', type: 'highway', a: 'r99_n1', b: 'r99_rr', name: 'ROUTE 99' },
  { id: 'r99_3', type: 'highway', a: 'r99_rr', b: 'r99_n2', name: 'ROUTE 99', pts: [[3950, -1700, 400]] },
  { id: 'r99_4', type: 'highway', a: 'r99_n2', b: 'rg_e', name: 'ROUTE 99', pts: [[4380, -2500, 200]] },
  { id: 'r99_5', type: 'highway', a: 'i9_e2', b: 'r99_s1', name: 'ROUTE 99', pts: [[3820, 50, 300]] },
  { id: 'r99_6', type: 'highway', a: 'r99_s1', b: 'gt_j', name: 'ROUTE 99' },
  { id: 'r99_7', type: 'highway', a: 'gt_j', b: 'r99_s2', name: 'ROUTE 99', pts: [[3540, 1300, 400]] },
  { id: 'r99_8', type: 'highway', a: 'r99_s2', b: 'bs_east', name: 'ROUTE 99', pts: [[3480, 2100, 400]] },
  // Red Rock Canyon
  { id: 'rr_in', type: 'highway', a: 'r99_rr', b: 'rr_w' },
  { id: 'rr_floor', type: 'highway', a: 'rr_w', b: 'rr_e', name: 'CANYON RD', pts: [[4250, -1650, 120], [4650, -1850, 140], [5050, -1750, 140]] },
  { id: 'rr_rim1', type: 'highway', a: 'rr_e', b: 'rr_r1', name: 'RIM RD', pts: [[5350, -1700, 120]] },
  { id: 'rr_rim2', type: 'highway', a: 'rr_r1', b: 'rr_r2', name: 'RIM RD' },
  { id: 'rr_rim3', type: 'highway', a: 'rr_r2', b: 'rr_r3', name: 'RIM RD' },
  { id: 'rr_rim4', type: 'highway', a: 'rr_r3', b: 'rr_w', name: 'RIM RD', pts: [[3850, -1650, 120]] },
  // Ghost Town
  { id: 'gt_in', type: 'dirt', a: 'gt_j', b: 'gt_a' },
  { id: 'gt_main', type: 'dirt', a: 'gt_a', b: 'gt_b', name: 'MAIN ST' },
  { id: 'gt_l2', type: 'dirt', a: 'gt_b', b: 'gt_c', pts: [[4250, 1250, 80]] },
  { id: 'gt_l3', type: 'dirt', a: 'gt_c', b: 'gt_d', pts: [[3950, 1620, 80]] },
  { id: 'gt_l4', type: 'dirt', a: 'gt_d', b: 'gt_a', pts: [[3560, 1300, 80]] },
  // Dry Lake
  { id: 'dl_in', type: 'highway', a: 'r99_s1', b: 'dl_w', name: 'LAKEBED RD', pts: [[4300, 300, 300]] },
  { id: 'dl_lane', type: 'service', a: 'dl_w', b: 'dl_a' },
  { id: 'dl_strip', type: 'strip', a: 'dl_a', b: 'dl_b', name: 'DRY LAKE STRIP' },
  { id: 'dl_n1', type: 'gravel', a: 'dl_w', b: 'dl_n', pts: [[5000, -200, 200]] },
  { id: 'dl_n2', type: 'gravel', a: 'dl_n', b: 'dl_b', pts: [[5950, -200, 200]] },
  { id: 'dl_s1', type: 'gravel', a: 'dl_w', b: 'dl_s', pts: [[5000, 800, 200]] },
  { id: 'dl_s2', type: 'gravel', a: 'dl_s', b: 'dl_b', pts: [[5950, 800, 200]] },
  // ---- backroads
  // the High Desert: off the Rim Rd, north and down into the empty basin to the
  // radio array; a dirt spur climbs a side valley to the old missile silo
  { id: 'ar_r1', type: 'gravel', a: 'rr_r1', b: 'ar_1', name: 'ARRAY RD', district: 'highlands', pts: [[5300, -2400, 220]] },
  { id: 'ar_r2', type: 'gravel', a: 'ar_1', b: 'ar_j', name: 'ARRAY RD', district: 'highlands', pts: [[5720, -3220, 260]] },
  { id: 'ar_r3', type: 'gravel', a: 'ar_j', b: 'ar_end', name: 'ARRAY RD', district: 'highlands', pts: [[5930, -4250, 260]] },
  { id: 'si_road', type: 'dirt', a: 'ar_j', b: 'si_end', name: 'SILO RD', district: 'highlands', pts: [[5700, -4080, 140], [5545, -4420, 140]] },
  // Red Rock: the Dutchman mine road west from Route 99 to the mesa's foot
  { id: 'mn_road', type: 'dirt', a: 'r99_n2', b: 'mn_end', name: 'DUTCHMAN RD', district: 'redrock', pts: [[4040, -2128, 160]] },
  // the overlook over the arch, off the Rim Rd
  { id: 'ov_road', type: 'dirt', a: 'rr_r2', b: 'ov_end', name: 'ARCH OVERLOOK', district: 'redrock' },
  // Ghost Town: up the mine hill to the headframe; the Borax Rd east to the lake
  { id: 'hf_road', type: 'dirt', a: 'gt_c', b: 'hf_top', name: 'MINE HILL RD', district: 'ghosttown', pts: [[4330, 1480, 120]] },
  { id: 'bx_road', type: 'dirt', a: 'gt_b', b: 'dl_s', name: 'BORAX RD', district: 'ghosttown', pts: [[4700, 1080, 300], [5200, 1150, 220]] },
];

export default {
  id: 'east', nodes, roads,
  landmarks: [
    { id: 'diner', name: 'ROCKET DINER', x: 3880, z: -560, kind: 'diner', district: 'desert' },
    { id: 'arch', name: 'THE RED ARCH', x: 4650, z: -1850, kind: 'arch', district: 'redrock' },
    { id: 'saloon', name: 'LAST CHANCE SALOON', x: 3900, z: 1100, kind: 'saloon', district: 'ghosttown' },
    { id: 'strip', name: 'DRY LAKE STRIP', x: 5450, z: 300, kind: 'strip', district: 'drylake' },
  ],
};
