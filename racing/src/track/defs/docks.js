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
    blurb: 'Container canyons under sodium light: the long wet quay beneath the gantry cranes, a hairpin round the oil tanks and esses through the stacks back to the water.',
    width: 16, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.65, asphalt: '#323337', bank: 0, startS: 120, fogD: 0.0021,
    // quay straight east under the cranes, hard left into the yard past the gate, hairpin round the tank,
    // right, the esses over the rise in the stacks (right, left, left, right), fast left, left back onto the quay
    points: [
      [0, 0, 50], [440, 0, 26], [440, -300, 24], [380, -300, 24], [380, -215, 30],
      [290, -215, 40], [250, -255, 40], [190, -255, 40], [150, -215, 40], [0, -215, 60],
    ],
    docks: {
      land: [[-900, -1400, 1700, 20]],
      sides: [
        ['open', 'water'], ['stack', 'rail'], ['tank', 'tank'], ['stack', 'stack'], ['stack', 'shed'],
        ['stack', 'stack'], ['stack', 'stack'], ['stack', 'stack'], ['stack', 'shed'], ['stack', 'shed'],
      ],
      cranes: [120, 172, 224],
      farCranes: [[560, 0, 0], [650, 0, 0], [-130, 0, 0], [-240, 0, 0]],
      ships: [[165, 38, 0, 250, 32, '#1d2a36'], [620, 33, Math.PI, 150, 23, '#5a1f1a'], [-170, 37, 0, 210, 30, '#20262a']],
      tanks: [{ corner: 2, r: 12.5, h: 15 }, [410, -352, 18, 16], [348, -340, 14, 12], [482, -372, 15, 13]],
      rail: [
        [[457, -40], [457, -320, 60], [580, -460]],
        [[100, -580], [100, -35]],
      ],
      skyline: [230, 1750, 420, 60],
      gates: [[560, 12]],
      mastSpacing: 56,
      pipes: [650],
    },
  },
  {
    id: 'pier9', name: 'PIER 9', env: 'docks', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Out along the pier and back: a hairpin over the water at the far end, a long drag past the ships, a jog between the warehouses and two fast lefts home. Bring the angle.',
    width: 18, lanes: 2, center: 'none', edge: 'yellow', worn: 0.8, asphalt: '#38393c', bank: 0, startS: 90, fogD: 0.0019,
    // quay straight east, right onto the pier (ships moored both sides), hairpin at the pier end, back up,
    // left, right-left switchback between the sheds, two quick lefts and the last left onto the quay.
    // [76, -5] is a straight-through vertex: it only switches the roadside kit where the pier meets the yard.
    points: [
      [-220, -30, 28], [20, -30, 28], [20, 160, 26], [76, 160, 26], [76, -5], [76, -185, 26],
      [-10, -185, 24], [-10, -245, 24], [-130, -245, 30], [-220, -155, 30],
    ],
    docks: {
      land: [[-900, -1100, 900, 0], [-2, 0, 98, 190]],
      sides: [
        ['shed', 'water'], ['shed', 'water'], ['open', 'water'], ['stack', 'water'], ['stack', 'open'],
        ['shed', 'shed'], ['shed', 'fence'], ['shed', 'rail'], ['stack', 'open'], ['shed', 'stack'],
      ],
      cranes: [345, 545, 600],
      farCranes: [[230, -18, 0], [350, -18, 0], [-300, -18, 0], [-420, -18, 0]],
      ships: [[113.5, 95, Math.PI / 2, 160, 28, '#26313a'], [-15.5, 92, -Math.PI / 2, 140, 24, '#20262a'], [-150, 12, Math.PI, 120, 20, '#4a2420']],
      tanks: [[250, -210, 18, 16], [300, -270, 14, 13]],
      rail: [[[-600, -262], [40, -262, 60], [160, -355]]],
      skyline: [-70, 1500, 420, 55],
      gates: [[185, 8]],
      mastSpacing: 46,
      pipes: [1225],
      tires: true,
    },
  },
  {
    id: 'shipyard', name: 'SHIPYARD RUN', env: 'docks', time: 'dusk', weather: 'dry', type: 'sprint',
    blurb: 'From the container terminal to the old shipyard gates at dusk: the crane quay, a hairpin, past the dry docks, out along the slipways and back, then twisting through the old yards.',
    width: 16, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.75, asphalt: '#36373a', bank: 0, startS: 110, finishPad: 150, fogD: 0.0017,
    // out of the tunnel onto the terminal quay under five cranes, left into the stacks, hairpin, left along the
    // dry dock heads (straight-through vertices switch the kit where each basin opens), right out along the
    // slipway pier, round its end and back, right past the fitting-out basins, the long left sweeper, a left-right
    // jink, the right-left-right staircase through the old yards, then the gates, the line and on into the tunnel
    points: [
      [0, -8, 0], [700, -8, 28], [700, -250, 40], [750, -250, 40], [750, -120, 30],
      [820, -120], [880, -120], [950, -120], [1010, -120], [1080, -120], [1140, -120],
      [1340, -120, 50], [1340, 20], [1340, 260, 30], [1440, 260, 30], [1440, 20], [1440, -120, 40],
      [1920, -120, 110], [1920, -330, 45], [1860, -390, 45], [1860, -470, 28], [2060, -470, 28], [2060, -600, 30], [2460, -600, 0],
    ],
    docks: {
      land: [
        [-900, -1400, 2900, -100], [-900, -100, 830, 20], [870, -100, 960, 20], [1000, -100, 1090, 20], [1130, -100, 1318, 20],
        [1314, -100, 1466, 285], [1466, -100, 1540, 20], [1575, -100, 1640, 20], [1675, -100, 1740, 20], [1775, -100, 2900, 20],
      ],
      sides: [
        ['stack', 'water'], ['stack', 'stack'], ['shed', 'stack'], ['shed', 'stack'],
        ['shed', 'stack'], ['shed', 'water'], ['shed', 'shed'], ['shed', 'water'], ['shed', 'shed'], ['shed', 'water'], ['shed', 'open'],
        ['shed', 'open'], ['stack', 'water'], ['open', 'water'], ['shed', 'water'], ['shed', 'open'],
        ['shed', 'open'], ['shed', 'fence'], ['shed', 'shed'], ['shed', 'stack'], ['rail', 'shed'], ['shed', 'shed'], ['shed', 'shed'], ['shed', 'shed'],
      ],
      cranes: [150, 210, 270, 330, 390],
      farCranes: [[-140, 0, 0], [-250, 0, 0], [1340, 100, -Math.PI / 2], [1340, 175, -Math.PI / 2], [1440, 140, Math.PI / 2],
        [1503, -50, Math.PI / 2], [1607.5, -50, Math.PI / 2], [1707.5, -50, Math.PI / 2]],
      ships: [
        [270, 38, 0, 300, 34, '#1d2a36'], [560, 36, Math.PI, 200, 28, '#20262a'], [-200, 37, 0, 220, 30, '#5a1f1a'],
        [850, -40, Math.PI / 2, 110, 24, '#26313a'], [980, -35, Math.PI / 2, 120, 26, '#1d2a36'], [1110, -40, Math.PI / 2, 110, 24, '#20262a'],
        [1298.5, 150, -Math.PI / 2, 180, 28, '#5a1f1a'], [1481.5, 140, Math.PI / 2, 160, 28, '#26313a'],
        [1657.5, -42, Math.PI / 2, 100, 20, '#1d2a36'], [1757.5, -45, Math.PI / 2, 90, 18, '#20262a'],
      ],
      tanks: [[1700, -270, 20, 16], [1765, -335, 15, 13]],
      rail: [
        [[150, -100], [825, -100]],
        [[1980, -230], [1980, -720]],
      ],
      skyline: [1230, 1900, 650, 90],
      gates: [[1727, 9], [3787, 14]],
      mastSpacing: 58,
      pipes: [1372, 3642],
      fill: 100,
    },
  },
];
