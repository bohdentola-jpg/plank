// Extra roads for DOWNTOWN and UPTOWN (service lanes, alleys, plazas, car parks, back
// ways). The main grids live in their own area files; roads here join them
// at their nodes (by id) or cross them (cross: true).
//
// SKYPARK: off 12th Street's east side a service lane bends north and climbs
// a concrete ramp to the roof deck of a parking garage on downtown's east
// edge: a helipad up there, the whole skyline in front of you.
// VAULT ALLEY: a back alley across 1st Avenue between Union Street and the
// next block; its west end is a courtyard with a speakeasy's door.
// PARK DRIVE: the carriage drive winding through Halcyon Park from its north
// gate to its south gate; halfway, BOATHOUSE LANE (gravel) turns off west to
// the boathouse on the pond.
// BELGRAVE MEWS: a cobbled mews behind the terraces off an uptown street,
// running into the blocks either side of it.
export default {
  id: 'x_central',
  nodes: {
    // (the deck's height is absolute: the ground here is about 6 m up, the
    // roof deck 13 m over it; the ramp's own lift is its `elevated` span)
    xc_s1: [650, -300, 19],
    xc_s2: [650, -360, 19],
    xc_v0: [-578, 326],
    xc_v1: [-438, 326],
    xc_m0: [130, -1470],
    xc_m1: [262, -1470],
    xc_pk: [-662, -1366],
    xc_boat: [-729, -1388],
  },
  roads: [
    { id: 'xc_skyramp', type: 'service', a: 'c_12_3', b: 'xc_s1', pts: [[650, -170, 14]], elevated: [[12, 99999, 13, 150]], endBlend: 70, name: 'SKYPARK RAMP', district: 'downtown' },
    { id: 'xc_skydeck', type: 'quay', a: 'xc_s1', b: 'xc_s2', profile: 'flat', name: 'SKYPARK', district: 'downtown' },
    { id: 'xc_vault', type: 'alley', a: 'xc_v0', b: 'xc_v1', cross: true, name: 'VAULT ALLEY', district: 'downtown' },
    { id: 'xc_parkdrive', type: 'service', a: 'u_1_1', b: 'xc_pk', name: 'PARK DRIVE', district: 'uptown', pts: [[-640, -1508, 26], [-548, -1462, 60], [-600, -1392, 60]] },
    { id: 'xc_parkdrive_s', type: 'service', a: 'xc_pk', b: 'u_1_3', name: 'PARK DRIVE', district: 'uptown', pts: [[-724, -1340, 60], [-640, -1292, 26]] },
    { id: 'xc_boatlane', type: 'gravel', a: 'xc_pk', b: 'xc_boat', name: 'BOATHOUSE LANE', district: 'uptown' },
    { id: 'xc_mews', type: 'cobble', a: 'xc_m0', b: 'xc_m1', cross: true, name: 'BELGRAVE MEWS', district: 'uptown' },
  ],
  landmarks: [],
};
