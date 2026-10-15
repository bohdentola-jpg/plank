// docks track definitions (see tracks.js for the format).
// docks: scenery hints for env/docks.js —
//   land: [x0, z0, x1, z1] quay/yard rectangles (everything else is harbor water)
//   sides: per leg (vertex k → k+1) [left, right] roadside kit:
//     stack | water | shed | rail | fence | tank | open
//   cranes: s positions of ship-to-shore cranes straddling the road (boom reaches right)
//   farCranes: [x, z, ry] free-standing cranes; ships: [x, z, ry, length, beam, hullColor]
//   tanks: [x, z, r, h] oil tanks (corner: k puts one inside corner k)
//   rail: polylines [[x, z, r?], …]; crossings are found where they cross the road
//   skyline: [x, z, radius, count] city across the bay; gates: [s, sign] overhead signs
//   tires: tire walls on the outside of the big corners; pipes: s of pipe bridges over the road
//   mastSpacing: meters between flood-light masts along the road
export default [
  {
    id: 'harbor', name: 'HARBOR DOCKS', env: 'docks', time: 'night', weather: 'wet', type: 'circuit', laps: 3,
    blurb: 'Container canyons under sodium light: a long wet quay beneath the gantry cranes, a hairpin round the oil tanks and fast esses back to the water.',
    width: 16, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.65, asphalt: '#323337', bank: 0, startS: 120, fogD: 0.0021,
    // quay straight east under the cranes, hard left into the yard, hairpin round the tank,
    // right, left-right esses through the stacks, left, fast left back onto the quay
    points: [
      [0, 0, 45], [310, 0, 26], [310, -200, 24], [260, -200, 24], [260, -130, 30], [170, -130, 40], [130, -95, 40], [0, -95, 30],
    ],
    docks: {
      land: [[-900, -1400, 1700, 20]],
      sides: [
        ['open', 'water'], ['stack', 'rail'], ['tank', 'tank'], ['stack', 'stack'],
        ['stack', 'shed'], ['stack', 'stack'], ['stack', 'stack'], ['stack', 'shed'],
      ],
      cranes: [140, 195, 250],
      farCranes: [[440, 0, 0], [530, 0, 0], [-120, 0, 0], [-230, 0, 0]],
      ships: [[165, 38, 0, 250, 32, '#1d2a36'], [470, 33, Math.PI, 150, 23, '#5a1f1a'], [-170, 37, 0, 210, 30, '#20262a']],
      tanks: [{ corner: 2, r: 12.5, h: 15 }, [262, -262, 18, 16], [395, -215, 15, 13], [330, -330, 16, 14]],
      rail: [
        [[327, -40], [327, -240, 60], [440, -380]],
        [[70, -420], [70, -35]],
      ],
      skyline: [155, 1750, 420, 60],
      gates: [[385, 12]],
      mastSpacing: 56,
      pipes: [480],
    },
  },
  {
    id: 'pier9', name: 'PIER 9', env: 'docks', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Out along the pier and back: a hairpin over the water at the end, then square warehouse corners and a switchback home. Bring the angle.',
    width: 18, lanes: 2, center: 'none', edge: 'yellow', worn: 0.8, asphalt: '#38393c', bank: 0, startS: 90, fogD: 0.0019,
    // quay straight east, right onto the pier (ships moored both sides), hairpin at the pier end, back up,
    // left, right-left switchback between the sheds, two quick lefts and the last left onto the quay.
    // [76, -5] is a straight-through vertex: it only switches the roadside kit where the pier meets the yard.
    points: [
      [-170, -30, 28], [20, -30, 28], [20, 85, 26], [76, 85, 26], [76, -5], [76, -110, 26], [-10, -110, 24], [-10, -160, 24],
      [-100, -160, 30], [-170, -90, 30],
    ],
    docks: {
      land: [[-900, -1100, 900, 0], [-2, 0, 98, 105]],
      sides: [
        ['shed', 'water'], ['shed', 'water'], ['open', 'water'], ['stack', 'water'], ['stack', 'open'], ['shed', 'shed'],
        ['shed', 'fence'], ['shed', 'rail'], ['stack', 'open'], ['shed', 'stack'],
      ],
      cranes: [256, 416],
      farCranes: [[200, -18, 0], [320, -18, 0], [-250, -18, 0], [-370, -18, 0]],
      ships: [[113.5, 63, Math.PI / 2, 120, 28, '#26313a'], [-15.5, 60, -Math.PI / 2, 110, 24, '#20262a'], [-130, 12, Math.PI, 120, 20, '#4a2420']],
      tanks: [[200, -165, 18, 16], [250, -225, 14, 13]],
      rail: [[[-560, -177], [40, -177, 60], [160, -270]]],
      skyline: [-50, 1500, 420, 55],
      gates: [[150, 8]],
      mastSpacing: 46,
      pipes: [690],
      tires: true,
    },
  },
];
