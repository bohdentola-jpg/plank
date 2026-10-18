// Extra roads for OLD TOWN and CHINATOWN (service lanes, alleys, plazas, car parks, back
// ways). The main grids live in their own area files; roads here join them
// at their nodes (by id) or cross them (cross: true).
//
//   QUAI DU PETIT PORT: off the west quai where Rue 5 stops short of the
//     river, a cobbled lane down along the water to the boatmen's landing
//     under the Grand Bridge's first arch (a dead end: the café barge).
//   TOWPATH and MILL BRIDGE: the back way out of town along the east bank,
//     up the old towpath past the weir to the mill, over the mill's narrow
//     bridge to River Road on the far bank.
//   JADE ALLEY: Chinatown, south off the last alley into the courtyard of
//     the teahouse behind the shops.
export default {
  id: 'x_oldtown',
  nodes: {
    otx_port: [-1852.5, 311.0, 4.4],
    otx_mill: [-2071.2, -398.4],
    ctx_jade: [-220, 1418],
  },
  roads: [
    { id: 'otx_port', type: 'cobble', a: 'ot_3_5', b: 'otx_port', pts: [[-1819.0, 380.0, 8, 4.9]], name: 'QUAI DU PETIT PORT', district: 'oldtown' },
    { id: 'otx_towpath', type: 'dirt', a: 'ot_4_0', b: 'otx_mill', pts: [[-1965.6, -191.7, 70], [-2027.7, -317.3, 90]], name: 'TOWPATH', district: 'oldtown' },
    { id: 'otx_millbridge', type: 'service', a: 'otx_mill', b: 'ot_river_n', name: 'MILL BRIDGE', district: 'oldtown' },
    { id: 'ctx_jade', type: 'alley', a: 'c_6_21', b: 'ctx_jade', name: 'JADE ALLEY', district: 'chinatown' },
  ],
  landmarks: [],
};
