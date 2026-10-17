// Track definitions. points: [x, z, cornerRadius, elevation?, halfWidth?]
// (a filleted polyline — straights joined by constant-radius corners).
// env: city | docks | highway | circuit | mountain | desert
// time: night | dusk | sunset | day | overcast ; weather: dry | wet | rain

import CIRCUIT from './defs/circuit.js';
import MOUNTAIN from './defs/mountain.js';
import DESERT from './defs/desert.js';
import DOCKS from './defs/docks.js';
import HIGHWAY from './defs/highway.js';

const CITY = [
  {
    id: 'downtown', name: 'DOWNTOWN LOOP', env: 'city', time: 'night', weather: 'wet', type: 'circuit', laps: 3,
    blurb: 'Four-lane boulevards through the financial district: a long main drag, a block jog, a fast sweeper, the hairpin round the bank and esses home. Wet tonight.',
    width: 16, lanes: 4, center: 'double-yellow', bank: 0, startS: 95,
    // main drag south, left, the block jog (left-right), the long left sweeper onto the back straight,
    // hairpin round the bank, right, the esses and the left onto the main drag
    points: [
      [0, -120, 36], [0, 200, 32], [150, 200, 26], [150, 125, 26], [300, 125, 70],
      [300, -150, 26], [250, -150, 26], [250, -45, 28], [160, -45, 55], [85, -120, 55],
    ],
  },
  {
    id: 'uptown', name: 'UPTOWN RUN', env: 'city', time: 'night', weather: 'rain', type: 'sprint',
    blurb: 'Point to point from the financial district up the hill to the old observatory: long avenues, square corners, a fast sweeper and a switchback climb at the top. Raining hard.',
    width: 15, lanes: 4, center: 'double-yellow', bank: 0, startS: 60, finishPad: 150,
    // avenue south, right, left, a kink across the park, the long left sweeper onto the boulevard, a right-left jog,
    // square corners up the hill, the switchback (two hairpins) to the top and the run to the observatory
    points: [
      [0, 0, 0, 0], [0, 520, 34, 1], [-300, 520, 28, 2], [-300, 820, 30, 4], [-160, 960, 45, 5],
      [-160, 1220, 120, 7], [480, 1220, 26, 9], [480, 1310, 26, 10], [810, 1310, 40, 11], [810, 1640, 36, 12],
      [1050, 1640, 40, 13], [1050, 1760, 40, 14], [1095, 1760, 40, 14.5], [1095, 1680, 40, 15], [1140, 1680, 40, 15.5],
      [1140, 1830, 30, 16], [1520, 1830, 0, 17],
    ],
  },
  {
    id: 'oldtown', name: 'OLD TOWN', env: 'city', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Two narrow lanes between brick walls and fire escapes: an S across the old square, a staircase of square corners and a tight hairpin. Pass on the main street or not at all.',
    width: 11, lanes: 2, center: 'dashed-white', bank: 0, startS: 70,
    // main street south, left at the bottom, the S across the old square, a staircase of square corners,
    // the hairpin, then right, right, a left-right flick and the last left onto the main street
    points: [
      [0, -130, 22], [0, 160, 20], [50, 160, 28], [90, 120, 28], [145, 120, 18], [145, 50, 18],
      [200, 50, 20], [200, -95, 40], [155, -95, 40], [155, -10, 18], [95, -10, 18], [95, -70, 18],
      [60, -70, 18], [60, -130, 20],
    ],
  },
  {
    id: 'chinatown', name: 'CHINATOWN', env: 'city', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Two lanes through the neon old quarter: a long main street under the signs, a hairpin at its end, an S through the market and square corners down the back alleys.',
    width: 12, lanes: 2, center: 'dashed-white', bank: 0, startS: 80,
    // the neon main street east, hairpin right at its end, left, right, the S through the market,
    // square corners through the back alleys (right, right, left, left, right) and a right onto the main street
    points: [
      [-70, 0, 18], [230, 0, 40], [230, 50, 40], [150, 50, 18], [150, 140, 18], [90, 140, 28],
      [50, 180, 28], [-40, 180, 18], [-40, 100, 18], [35, 100, 18], [35, 48, 18], [-70, 48, 18],
    ],
  },
];

// reversed city circuits: same streets, the other way round, different night
const byId = Object.fromEntries(CITY.map((d) => [d.id, d]));
const rev = (d, extra) => ({ ...d, ...extra, id: `${d.id}_r`, reverseOf: d.id, points: d.points.slice().reverse() });
CITY.push(
  rev(byId.downtown, {
    name: 'DOWNTOWN REVERSE', weather: 'dry', startS: 995,
    blurb: 'The financial district loop backwards on a dry night: off the boulevard into the esses and the bank hairpin, then the sweeper and the block jog.',
  }),
  rev(byId.oldtown, {
    name: 'OLD TOWN REVERSE', time: 'night', weather: 'rain', startS: 765,
    blurb: 'Old Town the wrong way round in the pouring rain: the flick and the hairpin come first, the S across the square last. Brick walls, no run-off, no mercy.',
  }),
);

export const TRACKS = [...CITY, ...DOCKS, ...HIGHWAY, ...CIRCUIT, ...MOUNTAIN, ...DESERT];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
