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
    blurb: 'Northbound in the rain: over the river on stilts, through the interchange, flat out.',
    width: 16, lanes: 4, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 150, finishPad: 150, fogD: 0.0022,
    traffic: true, trafficLanes: [-6, -2, 2, 6],
    elevation: meters([[0, 0], [1000, 0], [1420, 14], [1800, 15], [2250, 16], [2650, 14.5], [2950, 14], [3350, 0], [4850, 0], [5080, 7.5], [5280, 7.5], [5520, 0], [6684, 0]], 6684),
    points: [
      [0, 0], [0, 950, 1300], [-420, 1900, 900], [-180, 2800, 650], [380, 3500, 1000], [420, 4500, 800], [-80, 5300, 1500], [-200, 6300],
    ],
    hw: {
      style: 'interstate',
      river: { axis: 'x', at: 1960, w: 170, bridges: [260, -1150] },
      soundWalls: [[-500, 1010], [4560, 4850], [5560, 7200]],
      wideVerge: [[3300, 4560]],
      interchange: { s: 3920 },
      flyover: { s: 4330 },
      overpasses: [{ s: 610, angle: 82 }, { s: 5840, angle: 74 }, { s: 6250, angle: 97 }],
      downtown: [[380, 2650, 560, 250]],
      zones: [[-500, 1150, 'suburb'], [1150, 3200, 'mid'], [3200, 4700, 'commercial'], [4700, 5650, 'industrial'], [5650, 7200, 'mid']],
      far: [[-330, 7800, 650, 42, 280], [1400, 3000, 500, 22, 200]],
      ads: 10,
      poleSigns: [
        { s: 3660, side: -1, off: 95, ad: 0 }, { s: 3820, side: 1, off: 120, ad: 1 }, { s: 4120, side: -1, off: 100, ad: 3 },
        { s: 4420, side: 1, off: 105, ad: 2 }, { s: 880, side: -1, off: 40, ad: 4 }, { s: 5250, side: 1, off: 50, ad: 5 },
      ],
      signs: [
        { s: 420, panels: [
          { w: 7.2, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Port Halcyon', 'Central City'], arrow: 'down2' },
          { w: 6.6, h: 3.9, lines: ['DOWNTOWN', 'Riverside Dr'], sub: '3 MILES' }] },
        { s: 1330, kind: 'cant', panels: [{ w: 7, h: 3.6, exit: '12', lines: ['Riverside Dr', 'Kessler Ave'], sub: '1/2 MILE' }] },
        { s: 2400, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Port Halcyon'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '13A', lines: ['DOWNTOWN', 'Civic Center'], arrow: 'upright' }] },
        { s: 3030, panels: [
          { w: 7.2, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Central City', 'Lakeview'], sub: '6 MILES' },
          { w: 7.2, h: 3.9, exit: '14', lines: ['Port Halcyon', 'Harbor Blvd'], sub: '1 MILE' }] },
        { s: 3480, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Central City'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '14', lines: ['Port Halcyon', 'Harbor Blvd'], arrow: 'upright', only: true }] },
        { s: 4640, panels: [{ w: 8.4, h: 3.9, lines: ['Central City   4', 'Lakeview   9', 'Grant Pass   17'] }] },
        { s: 5700, kind: 'cant', panels: [{ w: 7, h: 3.6, exit: '16', lines: ['Mill St', 'Union Station'], sub: '3/4 MILE' }] },
        { s: 6080, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Lakeview'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '17', lines: ['CITY CENTER', '5th Ave'], arrow: 'upright' }] },
        { s: 6470, panels: [{ w: 8, h: 3.6, lines: ['CENTRAL CITY', 'CITY LIMIT'], sub: 'POP. 2,140,000' }] },
      ],
    },
  },
  {
    id: 'skyline', name: 'SKYLINE EXPRESSWAY', env: 'highway', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'An elevated ring between the towers at sundown. High walls, tight sweepers, one tube.',
    width: 12, lanes: 3, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 200,
    traffic: true, trafficLanes: [-4, 0, 4],
    elevation: meters([[0, 18], [300, 18], [700, 22], [1000, 22], [1300, 17], [1800, 17], [2200, 21], [2700, 21], [3000, 16], [3700, 16], [4300, 20], [4700, 18], [5066, 18]], 5066),
    points: [
      [0, 0], [0, 560, 260], [534, 560, 250], [825, 851, 260], [1533, 851, 270], [1533, 299, 380], [1367, 12, 300], [1367, -560, 280], [0, -560, 260],
    ],
    hw: {
      style: 'expressway',
      lampColor: '#ffb768',
      river: { axis: 'z', at: 690, w: 70, bridges: [230, -260, 1150] },
      highWalls: [[300, 700], [2240, 2620], [3140, 3560]],
      tubes: [[1500, 1795]],
      crossings: [{ s: 3740, angle: 58, h: 15, len: 1100 }],
      exits: [{ s: 4020, len: 520, side: -1 }],
      frontage: [[0, 1480, 32, 170], [1820, 3100, 28, 150], [4420, 5106, 32, 170]],
      downtown: [[760, 150, 950, 260]],
      cityR: 650,
      margin: 1300,
      skyline: { n: 120, hMax: 230 },
      ads: 8,
      signs: [
        { s: 110, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Skyline Loop', 'Inner Circular'], arrow: 'down2' }] },
        { s: 780, panels: [
          { w: 5.6, h: 3.4, shield: 'C1', lines: ['Shiomi', 'Harbor'], arrow: 'down' },
          { w: 5.6, h: 3.4, exit: '3', lines: ['Kita Ward', 'Garden Av'], arrow: 'upright' }] },
        { s: 1430, kind: 'cant', panels: [{ w: 6, h: 3.2, lines: ['SKYLINE TUBE', 'LIGHTS ON'], sub: '300 m' }] },
        { s: 2140, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Bayshore', 'Airport'], arrow: 'down2' }] },
        { s: 2960, kind: 'cant', panels: [{ w: 6.2, h: 3.4, exit: '5', lines: ['Riverside', 'Market St'], sub: '500 m' }] },
        { s: 3600, panels: [
          { w: 5.6, h: 3.4, shield: 'C1', lines: ['Downtown', 'Central'], arrow: 'down' },
          { w: 5.6, h: 3.4, exit: '6', lines: ['Harbor', 'Ring Road'], arrow: 'upright', only: true }] },
        { s: 4900, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Inner Circular', 'Ginza Ward'], arrow: 'down2' }] },
      ],
    },
  },
];
