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
//   tires: tire walls on the outside of the big corners
export default [
  {
    id: 'harbor', name: 'HARBOR DOCKS', env: 'docks', time: 'night', weather: 'wet', type: 'circuit', laps: 3,
    blurb: 'Container canyons, gantry cranes and a long wet quay under sodium light.',
    width: 16, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.65, asphalt: '#323337', bank: 0, startS: 120, fogD: 0.0021,
    points: [
      [0, 0, 40], [950, 0, 42], [950, -600, 26], [740, -390, 60], [470, -390, 30], [470, -210, 28], [0, -210, 36],
    ],
    docks: {
      land: [[-900, -1400, 1700, 20]],
      sides: [
        ['open', 'water'], ['stack', 'rail'], ['tank', 'tank'], ['stack', 'stack'],
        ['stack', 'stack'], ['stack', 'stack'], ['stack', 'shed'],
      ],
      cranes: [215, 330, 445, 860],
      farCranes: [[1150, 0, 0], [1290, 0, 0], [-260, 0, 0], [-400, 0, 0]],
      ships: [[400, 38, 0, 250, 32, '#1d2a36'], [835, 33, Math.PI, 150, 23, '#5a1f1a'], [1350, 37, 0, 210, 30, '#20262a']],
      tanks: [{ corner: 2, r: 12.5, h: 15 }, [1035, -700, 22, 18], [1075, -630, 15, 13], [870, -720, 18, 16]],
      rail: [
        [[967, -30], [967, -900]],
        [[1400, -175], [520, -175]],
      ],
      skyline: [500, 1750, 420, 60],
      gates: [[1010, 12]],
    },
  },
  {
    id: 'pier9', name: 'PIER 9', env: 'docks', time: 'night', weather: 'dry', type: 'circuit', laps: 4,
    blurb: 'Square warehouse corners and a hairpin at the pier end. Bring the angle.',
    width: 18, lanes: 2, center: 'none', edge: 'yellow', worn: 0.8, asphalt: '#38393c', bank: 0, startS: 112, fogD: 0.0019,
    points: [
      [-240, -30, 28], [20, -30, 22], [20, 200, 26], [76, 200, 26], [76, -110, 24], [240, -110, 26], [150, -200, 30],
      [40, -200, 20], [40, -300, 24], [-300, -300, 22], [-240, -196, 40],
    ],
    docks: {
      land: [[-900, -1100, 900, 0], [-2, 0, 98, 248]],
      sides: [
        ['shed', 'water'], ['shed', 'water'], ['open', 'water'], ['shed', 'water'], ['stack', 'stack'], ['stack', 'tank'],
        ['shed', 'stack'], ['shed', 'fence'], ['shed', 'rail'], ['open', 'stack'], ['shed', 'stack'],
      ],
      cranes: [600, 690],
      farCranes: [[330, -18, 0], [450, -18, 0], [-420, -18, 0]],
      ships: [[113.5, 120, Math.PI / 2, 190, 28, '#26313a'], [-150, 12, Math.PI, 120, 20, '#4a2420']],
      tanks: [[300, -230, 18, 16], [345, -290, 14, 13]],
      rail: [[[-560, -317], [110, -317, 80], [240, -420]]],
      skyline: [-100, 1500, 420, 55],
      gates: [[230, 8]],
      tires: true,
    },
  },
];
