// highway track definitions (see tracks.js for the format).
// hw: environment layout for env/highway.js (s in meters along the route):
//   style 'interstate' (divided freeway) | 'expressway' (elevated single deck)
//   river {axis, at, w, bridges}, soundWalls/wideVerge/highWalls/tubes [[s0, s1]],
//   interchange {s}, flyover {s}, overpasses [{s, angle}], crossings, exits,
//   signs [{s, kind: 'span'|'cant', panels}], downtown [[x, z, r, hMax]],
//   zones [[s0, s1, 'suburb'|'mid'|'commercial'|'industrial']], far [[x, z, r, n, hMax]]
const meters = (pts, len) => pts.map(([s, y]) => [s / len, y]);

export default [
  {
    id: 'interstate', name: 'INTERSTATE 9', env: 'highway', time: 'night', weather: 'wet', type: 'sprint',
    blurb: 'Northbound in the rain: a braking left onto the river bridge, flat out through the interchange, then a hard left-right.',
    width: 16, lanes: 4, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 150, finishPad: 150, fogD: 0.0022,
    traffic: true, trafficLanes: [-6, -2, 2, 6],
    elevation: meters([[0, 0], [650, 0], [1000, 14], [1300, 15], [1700, 16], [1880, 15], [2270, 0], [3560, 0], [3740, 7.5], [3900, 7.5], [4090, 0], [4916, 0]], 4916),
    points: [
      [0, 0], [0, 810.8, 600], [-276.3, 1289.3, 250], [274, 1839.6, 450], [274, 3385.7, 190], [715.5, 3640.6, 260], [715.5, 4490.7],
    ],
    hw: {
      style: 'interstate',
      river: { axis: 'x', at: 1566, w: 170, bridges: [520, -700] },
      soundWalls: [[-500, 650], [4230, 5400]],
      wideVerge: [[2260, 3520]],
      interchange: { s: 2880 },
      flyover: { s: 3290 },
      overpasses: [{ s: 470, angle: 82 }, { s: 4420, angle: 74 }, { s: 4800, angle: 97 }],
      downtown: [[-300, 2150, 450, 250]],
      zones: [[-500, 900, 'suburb'], [900, 2250, 'mid'], [2250, 3500, 'commercial'], [3500, 4220, 'industrial'], [4220, 5400, 'mid']],
      far: [[715, 6000, 650, 42, 280], [1700, 2500, 500, 22, 200]],
      ads: 7,
      poleSigns: [
        { s: 2600, side: -1, off: 95, ad: 0 }, { s: 2760, side: 1, off: 120, ad: 1 }, { s: 3060, side: -1, off: 100, ad: 3 },
        { s: 3360, side: 1, off: 105, ad: 2 }, { s: 560, side: -1, off: 40, ad: 4 }, { s: 4120, side: 1, off: 50, ad: 5 },
      ],
      signs: [
        { s: 360, panels: [
          { w: 7.2, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Port Halcyon', 'Central City'], arrow: 'down2' },
          { w: 6.6, h: 3.9, lines: ['DOWNTOWN', 'Riverside Dr'], sub: '2 MILES' }] },
        { s: 1060, kind: 'cant', panels: [{ w: 7, h: 3.6, exit: '12', lines: ['Riverside Dr', 'Kessler Ave'], sub: '1/2 MILE' }] },
        { s: 1830, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Port Halcyon'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '13A', lines: ['DOWNTOWN', 'Civic Center'], arrow: 'upright' }] },
        { s: 2060, panels: [
          { w: 7.2, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Central City', 'Lakeview'], sub: '6 MILES' },
          { w: 7.2, h: 3.9, exit: '14', lines: ['Port Halcyon', 'Harbor Blvd'], sub: '1/2 MILE' }] },
        { s: 2260, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Central City'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '14', lines: ['Port Halcyon', 'Harbor Blvd'], arrow: 'upright', only: true }] },
        { s: 3770, panels: [{ w: 8.4, h: 3.9, lines: ['Central City   4', 'Lakeview   9', 'Grant Pass   17'] }] },
        { s: 4540, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Lakeview'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '17', lines: ['CITY CENTER', '5th Ave'], arrow: 'upright' }] },
        { s: 4680, panels: [{ w: 8, h: 3.6, lines: ['CENTRAL CITY', 'CITY LIMIT'], sub: 'POP. 2,140,000' }] },
      ],
    },
  },
  {
    id: 'skyline', name: 'SKYLINE EXPRESSWAY', env: 'highway', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A ring on stilts between the towers at dusk: a hard left over the canal, sweepers in the tube, walled lefts under the junction.',
    width: 12, lanes: 3, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 1495,
    traffic: true, trafficLanes: [-4, 0, 4],
    elevation: meters([[0, 19.5], [240, 15.5], [420, 16.5], [640, 21], [880, 23], [1030, 23], [1270, 19], [1500, 21]], 1626),
    points: [
      [0, 0, 150], [228.2, 61.1, 220], [438.3, -36.8, 240], [513.8, -318.7, 170], [243.2, -508.1, 180], [0, -394.7, 160],
    ],
    hw: {
      style: 'expressway',
      lampColor: '#ffb768',
      river: { axis: 'z', at: 160, w: 70, bridges: [-200, 300, -760] },
      highWalls: [[690, 910], [1270, 1450]],
      tubes: [[330, 660]],
      crossings: [{ s: 985, angle: 58, h: 15, len: 1100 }],
      exits: [{ s: 1000, len: 520, side: -1 }],
      frontage: [[0, 330, 32, 170], [660, 1626, 28, 160]],
      downtown: [[255, -230, 950, 260]],
      cityR: 650,
      margin: 1300,
      skyline: { n: 120, hMax: 230 },
      ads: 3,
      signs: [
        { s: 1560, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Skyline Loop', 'Inner Circular'], arrow: 'down2' }] },
        { s: 215, kind: 'cant', panels: [{ w: 6, h: 3.2, lines: ['SKYLINE TUBE', 'LIGHTS ON'], sub: '100 m' }] },
        { s: 675, kind: 'cant', panels: [{ w: 6.2, h: 3.4, exit: '6', lines: ['Harbor', 'Ring Road'], sub: '300 m' }] },
        { s: 935, panels: [
          { w: 5.6, h: 3.4, shield: 'C1', lines: ['Downtown', 'Central'], arrow: 'down' },
          { w: 5.6, h: 3.4, exit: '6', lines: ['Harbor', 'Ring Road'], arrow: 'upright', only: true }] },
        { s: 1240, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Bayshore', 'Airport'], arrow: 'down2' }] },
      ],
    },
  },
];
