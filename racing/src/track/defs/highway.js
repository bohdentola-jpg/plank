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
    blurb: 'Northbound in the rain: a braking left onto the river bridge, flat out through the interchange, a hard left-right over the rail yard, then an S on stilts past Union Station.',
    width: 16, lanes: 4, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 150, finishPad: 150, fogD: 0.0022,
    traffic: true, trafficLanes: [-6, -2, 2, 6],
    elevation: meters([[0, 0], [750, 0], [1150, 14], [1450, 15], [1800, 16], [2050, 15], [2450, 0], [3830, 0], [4010, 7.5], [4170, 7.5], [4360, 0], [4950, 0], [5220, 12], [5550, 13], [5950, 12.5], [6250, 11], [6560, 0], [7602, 0]], 7602),
    points: [
      [0, 0], [0, 887.6, 700], [-299.7, 1406.7, 250], [285.9, 1992.3, 450], [285.9, 3638.4, 190], [727.5, 3893.3, 260], [727.5, 5017.2, 480], [187.9, 5470, 280], [187.9, 6950.6],
    ],
    hw: {
      style: 'interstate',
      river: { axis: 'x', at: 1680, w: 170, bridges: [620, -700] },
      soundWalls: [[-500, 700], [6600, 8200]],
      wideVerge: [[2450, 3750]],
      interchange: { s: 3100 },
      flyover: { s: 3480 },
      overpasses: [{ s: 470, angle: 82 }, { s: 4620, angle: 74 }, { s: 6760, angle: 97 }, { s: 7200, angle: 80 }],
      downtown: [[-300, 2450, 450, 250]],
      zones: [[-500, 950, 'suburb'], [950, 2400, 'mid'], [2400, 3800, 'commercial'], [3800, 5400, 'industrial'], [5400, 8200, 'mid']],
      far: [[190, 8600, 650, 42, 280], [1800, 2800, 500, 22, 200]],
      ads: 10,
      poleSigns: [
        { s: 2750, side: -1, off: 95, ad: 0 }, { s: 2920, side: 1, off: 120, ad: 1 }, { s: 3260, side: -1, off: 100, ad: 3 },
        { s: 3600, side: 1, off: 105, ad: 2 }, { s: 560, side: -1, off: 40, ad: 4 }, { s: 4560, side: 1, off: 50, ad: 5 },
      ],
      signs: [
        { s: 360, panels: [
          { w: 7.2, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Port Halcyon', 'Central City'], arrow: 'down2' },
          { w: 6.6, h: 3.9, lines: ['DOWNTOWN', 'Riverside Dr'], sub: '2 MILES' }] },
        { s: 1180, kind: 'cant', panels: [{ w: 7, h: 3.6, exit: '12', lines: ['Riverside Dr', 'Kessler Ave'], sub: '1/2 MILE' }] },
        { s: 1980, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Port Halcyon'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '13A', lines: ['DOWNTOWN', 'Civic Center'], arrow: 'upright' }] },
        { s: 2450, panels: [
          { w: 7.2, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Central City', 'Lakeview'], sub: '6 MILES' },
          { w: 7.2, h: 3.9, exit: '14', lines: ['Port Halcyon', 'Harbor Blvd'], sub: '1/2 MILE' }] },
        { s: 2630, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Central City'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '14', lines: ['Port Halcyon', 'Harbor Blvd'], arrow: 'upright', only: true }] },
        { s: 4800, panels: [{ w: 8.4, h: 3.9, lines: ['Central City   4', 'Lakeview   9', 'Grant Pass   17'] }] },
        { s: 4980, kind: 'cant', panels: [{ w: 7, h: 3.6, exit: '16', lines: ['Mill St', 'Union Station'], sub: '3/4 MILE' }] },
        { s: 6620, panels: [
          { w: 7, h: 3.9, shield: '9', dir: 'NORTH', lines: ['Lakeview'], arrow: 'down2' },
          { w: 7, h: 3.9, exit: '17', lines: ['CITY CENTER', '5th Ave'], arrow: 'upright' }] },
        { s: 7000, panels: [{ w: 8, h: 3.6, lines: ['CENTRAL CITY', 'CITY LIMIT'], sub: 'POP. 2,140,000' }] },
      ],
    },
  },
  {
    id: 'skyline', name: 'SKYLINE EXPRESSWAY', env: 'highway', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A ring on stilts between the towers at dusk: a hard left over the canal, an S inside the tube, walled lefts under the junction, then a long run back across the canal.',
    width: 12, lanes: 3, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 1420,
    traffic: true, trafficLanes: [-4, 0, 4],
    elevation: meters([[0, 14], [250, 14.5], [520, 17.5], [800, 21], [1000, 21], [1350, 12.5], [1750, 12], [2206, 14]], 2206),
    points: [
      [0, 250, 120], [271.6, 250, 230], [477, 368.5, 200], [757.2, 206.7, 170], [757.2, -191.4, 160], [0, -191.4, 140],
    ],
    hw: {
      style: 'expressway',
      lampColor: '#ffb768',
      river: { axis: 'z', at: 175, w: 70, bridges: [-560, 40, 640] },
      highWalls: [[740, 1090], [1830, 2010]],
      tubes: [[270, 680]],
      crossings: [{ s: 880, angle: 44, h: 15, len: 1100 }],
      exits: [{ s: 960, len: 420, side: -1 }],
      frontage: [[1990, 2250, 32, 170], [740, 1100, 28, 160]],
      downtown: [[378, 90, 950, 260]],
      cityR: 650,
      margin: 1300,
      skyline: { n: 120, hMax: 230 },
      ads: 4,
      signs: [
        { s: 1450, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Skyline Loop', 'Inner Circular'], arrow: 'down2' }] },
        { s: 200, kind: 'cant', panels: [{ w: 6, h: 3.2, lines: ['SKYLINE TUBE', 'LIGHTS ON'], sub: '100 m' }] },
        { s: 700, kind: 'cant', panels: [{ w: 6.2, h: 3.4, exit: '6', lines: ['Harbor', 'Ring Road'], sub: '300 m' }] },
        { s: 945, panels: [
          { w: 5.6, h: 3.4, shield: 'C1', lines: ['Downtown', 'Central'], arrow: 'down' },
          { w: 5.6, h: 3.4, exit: '6', lines: ['Harbor', 'Ring Road'], arrow: 'upright', only: true }] },
        { s: 1720, panels: [{ w: 7.4, h: 3.6, shield: 'C1', lines: ['Bayshore', 'Airport'], arrow: 'down2' }] },
      ],
    },
  },
  {
    id: 'bayshore', name: 'BAYSHORE ROUTE', env: 'highway', time: 'night', weather: 'dry', type: 'sprint',
    blurb: 'Along the bay at night: up over the long bridge, through the harbor tunnel, quick sweepers between the towers, then a top-speed run home.',
    width: 16, lanes: 4, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 150, finishPad: 160, fogD: 0.0018,
    traffic: true, trafficLanes: [-6, -2, 2, 6],
    elevation: meters([[0, 8], [600, 8], [1300, 12], [1700, 16], [2150, 21], [2600, 29], [3000, 33], [3350, 27], [3700, 16], [3950, 11], [4350, 10], [4700, 15], [5100, 19], [5500, 17], [6100, 15], [6800, 15], [7400, 9], [7952, 8]], 7952),
    points: [
      [0, 0], [0, 977.4, 800], [-398.7, 1832.4, 380], [813.7, 3044.8, 600], [813.7, 3653.7, 350], [1064.6, 4012, 220], [903.5, 4357.4, 200], [1130.3, 4750.2, 240], [993.1, 5261.9, 300], [1199.9, 6033.5, 900], [1199.9, 7302],
    ],
    hw: {
      style: 'expressway',
      lampColor: '#ffa65a',
      river: { axis: 'z', at: 380, w: 710, bridges: [] },
      highWalls: [[4430, 4700], [5000, 5480]],
      tubes: [[3860, 4350]],
      crossings: [{ s: 5150, angle: 60, h: 15, len: 1100 }],
      exits: [{ s: 6000, len: 480, side: -1 }],
      frontage: [[0, 800, 26, 90], [4400, 5900, 30, 190]],
      downtown: [[1400, 4700, 650, 260]],
      far: [[1200, 8900, 600, 40, 260], [-900, 4300, 500, 25, 200]],
      cityR: 650,
      margin: 1300,
      skyline: { n: 140, hMax: 230 },
      ads: 6,
      signs: [
        { s: 330, panels: [
          { w: 7.2, h: 3.6, shield: 'B', lines: ['Bayshore Route', 'Bay Bridge'], arrow: 'down2' },
          { w: 6.6, h: 3.6, lines: ['Tower District', 'Daikoku'], sub: '5 km' }] },
        { s: 1500, kind: 'cant', panels: [{ w: 6.4, h: 3.4, lines: ['BAY BRIDGE', 'CROSSWINDS'], sub: '1 km' }] },
        { s: 3580, kind: 'cant', panels: [{ w: 6.4, h: 3.2, lines: ['HARBOR TUNNEL', 'LIGHTS ON'], sub: '300 m' }] },
        { s: 4420, panels: [
          { w: 7, h: 3.6, shield: 'B', lines: ['Airport', 'Daikoku'], arrow: 'down2' },
          { w: 7, h: 3.6, shield: 'C1', lines: ['Inner Circular', 'Ginza'], sub: '1 km' }] },
        { s: 5520, panels: [{ w: 7.4, h: 3.6, shield: 'B', lines: ['Port Halcyon', 'Airport'], arrow: 'down2' }] },
        { s: 5850, kind: 'cant', panels: [{ w: 6.4, h: 3.4, exit: '9', lines: ['Daikoku', 'Ferry Terminal'], sub: '200 m' }] },
        { s: 6900, panels: [{ w: 8.4, h: 3.6, lines: ['Airport   6', 'Port Halcyon   14'] }] },
      ],
    },
  },
];
