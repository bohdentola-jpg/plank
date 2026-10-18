// Extra roads for THE WORKS and EASTSIDE (service lanes, alleys, plazas, car parks, back
// ways). The main grids live in their own area files; roads here join them
// at their nodes (by id) or cross them (cross: true).
//
// THE WORKS: LOW LINE LANE runs under the old elevated freight line the
// whole width of the district (the grid's streets all have a node on its
// row, so it meets each of them at a crossing); RIVET ALLEY cuts the block
// behind your garage; CINDER ALLEY dead-ends at the boneyard's broken gate;
// SPUR RD is the dead-straight service road down the district's east edge
// (under the Low Line's last span: where the drags happen), and YARD RD runs
// along the rail yard to the waterfront streets.
//
// EASTSIDE: courts off the residential streets (each one crossing its
// street, a bulb at both ends), a dirt lane behind the high school's
// bleachers, and LOOKOUT RD, a dirt track up the bluff east of town to the
// old drive-in at the top.
const nodes = {
  // the works
  xw_d0: [1458, 940], xw_d1: [1458, 1620], xw_bone: [1290, 1090],
  // eastside: courts (each crosses its street mid-block; a bulb at both ends)
  xe_c1n: [925, -482], xe_c1s: [925, -232],
  xe_c2n: [1425, -482], xe_c2s: [1425, -232],
  xe_c3n: [1675, -492], xe_c3s: [1675, -232],
  xe_c4w: [1932, -225], xe_c4e: [2168, -225],
  xe_c5n: [1925, 150], xe_c5s: [1925, 400],
  xe_c6n: [1175, 150], xe_c6s: [1175, 412],
  xe_c7n: [2175, 440], xe_c7s: [2175, 690],
  xe_c8n: [1675, 730], xe_c8s: [1675, 990],
  xe_c9n: [2175, 1020], xe_c9s: [2175, 1262],
  // behind the bleachers; up the bluff
  xe_back: [1318, 530], xe_lk1: [2650, 330], xe_look: [2832, 298],
};

const W = 'works', E = 'eastside';
const roads = [
  // under the Low Line, west to east (z 1240)
  { id: 'xw_low_0', type: 'alley', a: 'c_10_19', b: 'c_11_19', name: 'LOW LINE LANE', district: W },
  { id: 'xw_low_1', type: 'alley', a: 'c_11_19', b: 'c_12_19', name: 'LOW LINE LANE', district: W },
  { id: 'xw_low_2', type: 'alley', a: 'c_12_19', b: 'c_13_19', name: 'LOW LINE LANE', district: W },
  { id: 'xw_low_3', type: 'alley', a: 'c_13_19', b: 'c_14_19', name: 'LOW LINE LANE', district: W },
  { id: 'xw_low_4', type: 'alley', a: 'c_14_19', b: 'c_15_19', name: 'LOW LINE LANE', district: W },
  { id: 'xw_low_5', type: 'alley', a: 'c_15_19', b: 'c_16_19', name: 'LOW LINE LANE', district: W },
  // behind Foundry St
  { id: 'xw_rivet', type: 'alley', a: 'c_13_13', b: 'c_14_13', name: 'RIVET ALLEY', district: W },
  // to the boneyard (a dead end at its gate)
  { id: 'xw_cinder', type: 'alley', a: 'c_15_17', b: 'xw_bone', name: 'CINDER ALLEY', district: W },
  // the drag strip down the east edge, and the rail yard road back
  { id: 'xw_spur_in', type: 'service', a: 'c_16_15', b: 'xw_d0', name: 'SPUR RD', district: W },
  { id: 'xw_spur', type: 'service', a: 'xw_d0', b: 'xw_d1', name: 'SPUR RD', district: W },
  { id: 'xw_yard_0', type: 'service', a: 'xw_d1', b: 'c_16_23', name: 'YARD RD', district: W },
  { id: 'xw_yard_1', type: 'service', a: 'c_15_23', b: 'c_16_23', name: 'YARD RD', district: W },
  { id: 'xw_yard_2', type: 'service', a: 'c_14_23', b: 'c_15_23', name: 'YARD RD', district: W },
  // EASTSIDE's courts
  { id: 'xe_ct1', type: 'street', a: 'xe_c1n', b: 'xe_c1s', cross: true, name: 'MAPLE CT', district: E },
  { id: 'xe_ct2', type: 'street', a: 'xe_c2n', b: 'xe_c2s', cross: true, name: 'SPRUCE CT', district: E },
  { id: 'xe_ct3', type: 'street', a: 'xe_c3n', b: 'xe_c3s', cross: true, name: 'BIRCH CT', district: E },
  { id: 'xe_ct4', type: 'street', a: 'xe_c4w', b: 'xe_c4e', cross: true, name: 'HAZEL CT', district: E },
  { id: 'xe_ct5', type: 'street', a: 'xe_c5n', b: 'xe_c5s', cross: true, name: 'CEDAR CT', district: E },
  { id: 'xe_ct6', type: 'street', a: 'xe_c6n', b: 'xe_c6s', cross: true, name: 'SCHOOL LN', district: E },
  { id: 'xe_ct7', type: 'street', a: 'xe_c7n', b: 'xe_c7s', cross: true, name: 'ELM CT', district: E },
  { id: 'xe_ct8', type: 'street', a: 'xe_c8n', b: 'xe_c8s', cross: true, name: 'OAK CT', district: E },
  { id: 'xe_ct9', type: 'street', a: 'xe_c9n', b: 'xe_c9s', cross: true, name: 'WALNUT CT', district: E },
  // the dirt lane round the back of the high school's bleachers (off the Works' north street)
  { id: 'xe_back', type: 'dirt', a: 'c_15_10', b: 'xe_back', pts: [[1200, 540, 18]], name: 'BACK LOT RD', district: E },
  // up the bluff east of town: a switchback to the old drive-in, and a gravel lane back down through the orchards
  { id: 'xe_look1', type: 'dirt', a: 'es_6_2', b: 'xe_lk1', pts: [[2450, 330, 60], [2560, 150, 70]], name: 'LOOKOUT RD', district: E },
  { id: 'xe_look2', type: 'dirt', a: 'xe_lk1', b: 'xe_look', pts: [[2760, 322, 60]], name: 'LOOKOUT RD', district: E },
  { id: 'xe_orchard', type: 'gravel', a: 'es_6_4', b: 'xe_lk1', pts: [[2420, 760, 100], [2560, 520, 120]], name: 'ORCHARD LN', district: E },
];

export default {
  id: 'x_works',
  nodes,
  roads,
  landmarks: [],
};
