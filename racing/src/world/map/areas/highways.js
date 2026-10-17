// The fast roads: INTERSTATE 9 (in from the farms in the west, over the
// river gorge below the dam, on a viaduct along the foot of Uptown hill past
// downtown's towers, then out across the Eastside plains into the desert to
// Route 99) and the SKYLINE EXPRESSWAY, an elevated loop over downtown's
// avenues, tied to the I-9 viaduct by two spurs.
//
// Elevated nodes carry their deck height (the third number).
const DECK_I9 = 21;      // I-9 viaduct deck (ground ≈ 7.5 under it)
const DECK_SX = 20;      // Skyline Expressway deck (ground ≈ 6)

const nodes = {
  i9_w: [-5300, 1380],          // west end: the farm junction by the shipyard
  i9_farm: [-3900, 300],        // farms interchange (at grade)
  i9_wr: [-2760, -560],         // River Road junction, west of the gorge
  i9_cw: [-1420, -615],         // the viaduct starts (at grade, Bastion end)
  i9_j1: [-150, -615, DECK_I9],  // Skyline spur (west)
  i9_j2: [130, -615, DECK_I9],   // Skyline spur (east)
  i9_ce: [1150, -600],          // the viaduct comes down (Eastside)
  i9_e1: [2200, -480],          // Eastside exit
  i9_e2: [3800, -300],          // the end: Route 99
  // (the loop runs down the middle of the blocks, never over a street:
  // its piers stand between the buildings)
  sx_n1: [-150, -225, DECK_SX],
  sx_n2: [130, -225, DECK_SX],
};

const roads = [
  { id: 'i9_west', type: 'freeway', a: 'i9_w', b: 'i9_farm', name: 'I-9', pts: [[-4700, 1100, 600], [-4300, 700, 600]] },
  { id: 'i9_farmsec', type: 'freeway', a: 'i9_farm', b: 'i9_wr', name: 'I-9', pts: [[-3500, -150, 500], [-3150, -430, 500]] },
  // over the gorge below the dam (an arch bridge: it finds itself)
  { id: 'i9_gorge', type: 'freeway', a: 'i9_wr', b: 'i9_cw', name: 'I-9', pts: [[-2200, -640, 700]], clear: 14 },
  // the viaduct: up off the ground, along the foot of the hill, back down
  { id: 'i9_v1', type: 'freeway', a: 'i9_cw', b: 'i9_j1', name: 'I-9', elevated: [[0, 99999, DECK_I9 - 7.5, 260]] },
  { id: 'i9_v2', type: 'freeway', a: 'i9_j1', b: 'i9_j2', name: 'I-9', elevated: [[-999, 99999, DECK_I9 - 7.5, 1]] },
  { id: 'i9_v3', type: 'freeway', a: 'i9_j2', b: 'i9_ce', name: 'I-9', elevated: [[-999, 760, DECK_I9 - 7.5, 260]] },
  { id: 'i9_east1', type: 'freeway', a: 'i9_ce', b: 'i9_e1', name: 'I-9', pts: [[1700, -560, 800]] },
  { id: 'i9_east2', type: 'freeway', a: 'i9_e1', b: 'i9_e2', name: 'I-9', pts: [[3000, -380, 900]] },
  // Skyline Expressway: north side between the spurs, then round the loop
  { id: 'sx_north', type: 'expressway', a: 'sx_n1', b: 'sx_n2', name: 'SKYLINE EXPY', elevated: [[-999, 99999, DECK_SX - 6, 1]] },
  {
    id: 'sx_loop', type: 'expressway', a: 'sx_n2', b: 'sx_n1', name: 'SKYLINE EXPY',
    pts: [[270, -225, 70], [270, 325, 70], [-290, 325, 70], [-290, -225, 70]],
    elevated: [[-999, 99999, DECK_SX - 6, 1]],
  },
  { id: 'sx_spur1', type: 'expressway', a: 'sx_n1', b: 'i9_j1', name: 'SKYLINE EXPY', elevated: [[-999, 99999, DECK_SX - 6, 1]] },
  { id: 'sx_spur2', type: 'expressway', a: 'sx_n2', b: 'i9_j2', name: 'SKYLINE EXPY', elevated: [[-999, 99999, DECK_SX - 6, 1]] },
  // at-grade ends of the viaduct: into the city and out to the Eastside
  { id: 'i9_bastion', type: 'avenue', a: 'i9_cw', b: 'c_0_0', name: 'BASTION BLVD', pts: [[-1140, -560, 60]] },
  { id: 'i9_eastside', type: 'avenue', a: 'i9_ce', b: 'es_1_0' },
];

export default {
  id: 'highways', nodes, roads,
  landmarks: [
    { id: 'gorge', name: 'GORGE BRIDGE', x: -2200, z: -620, kind: 'bridge', district: 'lake' },
  ],
};
