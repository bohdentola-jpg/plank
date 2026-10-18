// The west: River Road up the gorge to HALCYON LAKE's dam, the road over
// the dam's crest and the loop round the lake's shores; IRONWOOD PARK (a
// race circuit through the old ironworks on the lake's south shore); the
// WEST FARMS (Mill Road out of Old Town, gravel lanes between the fields, the
// old airfield's runway, the drive-in); the REDWOOD HIGHWAY up into the giant
// trees and REDWOOD RACEWAY; and CRESTWOOD HILLS' circuit among the
// vineyards east of the lake.
const nodes = {
  // up the gorge, over the dam
  rr_1: [-2330, -560], rr_2: [-2440, -780, 31.9],
  dam_w: [-2565, -1000, 58], dam_e: [-2305, -1102, 58],
  // round the lake
  lk_s1: [-3000, -1010], lk_s2: [-3700, -1060], lk_w: [-4560, -1360],
  cg_end: [-4290, -1255], iy_end: [-3200, -790],
  lk_n1: [-4250, -2120], lk_n2: [-3500, -2620], lk_n3: [-2850, -2560], lk_ne: [-2240, -1800, 111.2],
  // Ironwood Park
  iw_n: [-3807, -950], iw_s: [-3672, -575], iw_d: [-4108, -534], iw_c: [-4100, -834],
  // the farms
  ml_1: [-2900, 130], ml_2: [-4700, 230], fm_1: [-5400, 100], fm_2: [-5600, -700], fm_3: [-4900, 1000],
  fm_4: [-3700, 900], fm_5: [-3400, 1380], fm_6: [-4300, 1500],
  af_a: [-5650, 640], af_b: [-4760, 520], cc_end: [-5960, -790],
  // the redwoods
  rh_1: [-4900, -2050, 133.2], rh_2: [-5150, -2700], rw_g: [-4850, -2990], dt_end: [-5530, -2662],
  rw_a: [-4847, -3080], rw_b: [-5284, -3161], rw_c: [-4751, -3585], rw_d: [-4686, -3125],
  // Crestwood
  cw_1: [-1900, -2050], cw_g: [-1760, -2230],
  cw_b: [-1460, -2397], cw_c: [-1704, -2646], cw_d: [-1940, -2540],
  cr_e: [-1250, -1720, 79.7],
  wy_end: [-1680, -2935], vl_end: [-2585, -2990, 167],
};

const roads = [
  { id: 'rr_road1', type: 'coastal', a: 'ot_river_n', b: 'rr_1', name: 'RIVER ROAD' },
  { id: 'rr_road2', type: 'coastal', a: 'rr_1', b: 'rr_2', name: 'RIVER ROAD', pts: [[-2380, -660, 80]], grade: 0.11 },
  { id: 'rr_road3', type: 'coastal', a: 'rr_2', b: 'dam_w', name: 'RIVER ROAD', pts: [[-2530, -880, 60]], grade: 0.11 },
  { id: 'rr_i9', type: 'street', a: 'rr_1', b: 'i9_wr', pts: [[-2560, -560, 60]] },
  { id: 'dam_road', type: 'street', a: 'dam_w', b: 'dam_e', name: 'DAM ROAD', profile: 'flat', noBridge: true },
  // the lake loop
  { id: 'lk_south1', type: 'highway', a: 'dam_w', b: 'lk_s1', name: 'SOUTH SHORE RD' },
  { id: 'lk_south2', type: 'highway', a: 'lk_s1', b: 'lk_s2', name: 'SOUTH SHORE RD' },
  { id: 'lk_south3', type: 'highway', a: 'lk_s2', b: 'lk_w', name: 'SOUTH SHORE RD', pts: [[-4250, -1140, 300]], grade: 0.1 },
  { id: 'lk_north1', type: 'highway', a: 'lk_w', b: 'lk_n1', name: 'NORTH SHORE RD', pts: [[-4500, -1800, 300]] },
  { id: 'lk_north2', type: 'highway', a: 'lk_n1', b: 'lk_n2', name: 'NORTH SHORE RD', pts: [[-3950, -2480, 300]], grade: 0.1, endBlend: 160 },
  { id: 'lk_north3', type: 'highway', a: 'lk_n2', b: 'lk_n3', name: 'NORTH SHORE RD' },
  { id: 'lk_north4', type: 'highway', a: 'lk_n3', b: 'lk_ne', name: 'NORTH SHORE RD', pts: [[-2450, -2250, 300]], grade: 0.11, endBlend: 250 },
  { id: 'lk_east', type: 'highway', a: 'lk_ne', b: 'dam_e', name: 'EAST SHORE RD', pts: [[-2180, -1450, 300]], grade: 0.11 },
  // the lake's backroads: the camp road along the south-west shore, on past
  // the campground to the fishing jetty at Heron Point
  { id: 'cg_road', type: 'gravel', a: 'lk_s2', b: 'cg_end', name: 'PINECONE CAMP RD', district: 'lake', pts: [[-3740, -1100, 30], [-3900, -1122, 80], [-4060, -1162, 80], [-4180, -1205, 60]] },
  // Ironwood Park: the circuit, its gate off the shore road and the back gate
  { id: 'iw_gate', type: 'street', a: 'lk_s2', b: 'iw_n' },
  // the back way into the old works: Foundry Lane, off the shore road at the
  // marina, down past the circuit's east side to the ladle yard
  { id: 'iy_lane', type: 'service', a: 'lk_s1', b: 'iy_end', name: 'FOUNDRY LN', district: 'ironworks', pts: [[-3050, -940, 60], [-3110, -860, 60]] },
  // (the grand prix layout: the main straight east, a fast right, a left, the
  // long double-apex right, the back straight west, the hairpin, a tight
  // infield of lefts and rights and the last corner onto the straight)
  { id: 'iw_l1', type: 'circuit', a: 'iw_n', b: 'iw_s', pts: [[-3590, -950, 105], [-3539, -809, 135], [-3416, -752, 105], [-3384, -575, 83]] },
  { id: 'iw_l2', type: 'circuit', a: 'iw_s', b: 'iw_d', pts: [[-3954, -575, 390]] },
  { id: 'iw_l3', type: 'circuit', a: 'iw_d', b: 'iw_c', pts: [[-4244, -497, 33], [-4262, -563, 33], [-4152, -612, 45], [-4152, -702, 53], [-4100, -756, 53]] },
  { id: 'iw_l4', type: 'circuit', a: 'iw_c', b: 'iw_n', pts: [[-4100, -950, 60]] },
  { id: 'iw_back', type: 'service', a: 'iw_s', b: 'ml_2', pts: [[-4000, 0, 120]] },
  // Mill Road: out of Old Town's west bank, under the I-9 at the farms
  { id: 'ml_road1', type: 'highway', a: 'ot_0_4', b: 'ml_1', name: 'MILL RD' },
  { id: 'ml_road2', type: 'highway', a: 'ml_1', b: 'i9_farm', name: 'MILL RD', pts: [[-3400, 200, 300]] },
  { id: 'ml_road3', type: 'highway', a: 'i9_farm', b: 'ml_2', name: 'MILL RD' },
  { id: 'ml_road4', type: 'highway', a: 'ml_2', b: 'fm_1', name: 'MILL RD', pts: [[-5050, 120, 200]] },
  // farm lanes
  { id: 'fm_l1', type: 'gravel', a: 'fm_1', b: 'fm_2', pts: [[-5700, -300, 200]] },
  { id: 'fm_l2', type: 'gravel', a: 'fm_2', b: 'lk_w', pts: [[-5100, -1000, 300]] },
  { id: 'fm_l3', type: 'dirt', a: 'fm_1', b: 'af_a' },
  { id: 'fm_l4', type: 'gravel', a: 'af_a', b: 'fm_3', pts: [[-5500, 950, 150]] },
  { id: 'fm_l5', type: 'gravel', a: 'fm_3', b: 'i9_w', pts: [[-5200, 1250, 150]] },
  { id: 'fm_l6', type: 'gravel', a: 'i9_farm', b: 'fm_4', pts: [[-3800, 600, 150]] },
  { id: 'fm_l7', type: 'gravel', a: 'fm_4', b: 'fm_5', name: 'DRIVE-IN RD' },
  { id: 'fm_l8', type: 'dirt', a: 'fm_4', b: 'fm_6', pts: [[-4050, 1250, 150]] },
  { id: 'fm_l9', type: 'gravel', a: 'fm_5', b: 'sy_e', pts: [[-3200, 1800, 200]] },
  { id: 'fm_l10', type: 'dirt', a: 'fm_6', b: 'fm_3', pts: [[-4650, 1300, 150]] },
  { id: 'fm_l11', type: 'dirt', a: 'fm_6', b: 'sy_m', pts: [[-4250, 1850, 150]] },
  { id: 'i9_sy', type: 'street', a: 'i9_w', b: 'sy_w' },
  // the old airfield's runway
  { id: 'af_runway', type: 'strip', a: 'af_a', b: 'af_b', name: 'OLD RUNWAY', smooth: 400 },
  { id: 'af_taxi', type: 'service', a: 'af_b', b: 'ml_2', pts: [[-4700, 380, 80]] },
  // a farm track out west to the far wheat field (and what's been drawn in it)
  { id: 'fm_cc', type: 'dirt', a: 'fm_2', b: 'cc_end', name: 'HOLLOWAY TRACK', district: 'farmland', pts: [[-5790, -735, 60]] },
  // up into the redwoods
  { id: 'rh_1', type: 'highway', a: 'lk_w', b: 'rh_1', name: 'REDWOOD HWY', pts: [[-4750, -1700, 300]] },
  { id: 'rh_2', type: 'highway', a: 'rh_1', b: 'rh_2', name: 'REDWOOD HWY', pts: [[-5050, -2380, 300]] },
  { id: 'rh_3', type: 'highway', a: 'rh_2', b: 'rw_g', name: 'REDWOOD HWY' },
  { id: 'rw_gate', type: 'street', a: 'rw_g', b: 'rw_a' },
  { id: 'rw_tree', type: 'dirt', a: 'rh_2', b: 'dt_end', name: 'GRANDFATHER LN', district: 'redwood', pts: [[-5425, -2702, 70]] },
  // (the pit straight west, the hairpin, the esses down through the trees,
  // the long back straight, the climb through a left-right flick and the
  // double-apex sweeper onto the pit straight)
  { id: 'rw_l1', type: 'circuit', a: 'rw_a', b: 'rw_b', pts: [[-5350, -3080, 33], [-5350, -3149, 33]] },
  { id: 'rw_l2', type: 'circuit', a: 'rw_b', b: 'rw_c', pts: [[-5188, -3177, 75], [-5177, -3290, 90], [-5087, -3342, 83], [-5087, -3447, 90], [-5006, -3515, 105], [-4982, -3647, 68]] },
  { id: 'rw_l3', type: 'circuit', a: 'rw_c', b: 'rw_d', pts: [[-4544, -3530, 48], [-4583, -3386, 68], [-4564, -3312, 68], [-4615, -3174, 135]] },
  { id: 'rw_l4', type: 'circuit', a: 'rw_d', b: 'rw_a', pts: [[-4750, -3080, 105]] },
  // Crestwood: from the lake's north-east corner, and from Uptown
  { id: 'cw_road', type: 'highway', a: 'lk_ne', b: 'cw_1', name: 'CRESTWOOD RD', grade: 0.12 },
  { id: 'cw_gate', type: 'street', a: 'cw_1', b: 'cw_g', grade: 0.12 },
  // the winery's cypress drive and the lane up to the villa, both off the pass road
  { id: 'cw_winery', type: 'gravel', a: 'pw_2', b: 'wy_end', name: 'WINERY RD', district: 'crestwood', pts: [[-1960, -3000, 120], [-1800, -2965, 120]] },
  { id: 'cw_villa', type: 'gravel', a: 'pw_2', b: 'vl_end', name: 'VIA SERENA', district: 'crestwood', pts: [[-2185, -3062, 60], [-2460, -3045, 80]] },
  // (the main straight north over the blind crest, the hairpin, the back
  // straight, the sweepers, the climb to the corkscrew, the carousel, the
  // kink and the bottom straight)
  { id: 'cw_l0', type: 'circuit', a: 'cw_g', b: 'cw_b', pts: [[-1460, -2150, 72]] },
  { id: 'cw_l1', type: 'circuit', a: 'cw_b', b: 'cw_c', pts: [[-1460, -2600, 225], [-1544, -2780, 33], [-1605, -2757, 33], [-1578, -2657, 68]] },
  { id: 'cw_l2', type: 'circuit', a: 'cw_c', b: 'cw_d', pts: [[-1803, -2637, 105], [-1859, -2540, 75]] },
  { id: 'cw_l3', type: 'circuit', a: 'cw_d', b: 'cw_g', pts: [[-2009, -2540, 39], [-2022, -2465, 42], [-2117, -2441, 75], [-2147, -2355, 75], [-2090, -2286, 75], [-2000, -2294, 180]] },
  { id: 'cr_road1', type: 'highway', a: 'cw_1', b: 'cr_e', name: 'CRESTWOOD RD', pts: [[-1550, -1880, 300]], grade: 0.12 },
  { id: 'cr_road2', type: 'street', a: 'cr_e', b: 'u_0_0', name: 'CRESTWOOD RD', grade: 0.15 },
];

export default {
  id: 'west', nodes, roads,
  landmarks: [
    { id: 'dam', name: 'HALCYON DAM', x: -2430, z: -1050, kind: 'dam', district: 'lake' },
    { id: 'ironworks', name: 'IRONWOOD WORKS', x: -3650, z: -720, kind: 'industry', district: 'ironworks' },
    { id: 'airfield', name: 'OLD AIRFIELD', x: -5200, z: 600, kind: 'airfield', district: 'farmland' },
    { id: 'drivein', name: 'STARLITE DRIVE-IN', x: -3300, z: 1450, kind: 'drivein', district: 'farmland', hidden: true },
    { id: 'winery', name: 'CRESTWOOD WINERY', x: -1620, z: -2930, kind: 'winery', district: 'crestwood' },
  ],
};
