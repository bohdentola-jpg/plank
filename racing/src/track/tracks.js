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
    blurb: 'Four-lane boulevards through the financial district: a long main drag, a block jog and a hairpin round the bank. Wet tonight.',
    width: 16, lanes: 4, center: 'double-yellow', bank: 0, startS: 95,
    points: [
      [0, -80, 32], [0, 130, 30], [100, 130, 28], [100, 220, 22], [152, 220, 22], [152, 55, 55],
      [198, 9, 55], [198, -80, 30],
    ],
  },
  {
    id: 'uptown', name: 'UPTOWN RUN', env: 'city', time: 'night', weather: 'rain', type: 'sprint',
    blurb: 'Point to point from the financial district up the hill to the old observatory: square corners, a fast sweeper, rain.',
    width: 15, lanes: 4, center: 'double-yellow', bank: 0, startS: 40, finishPad: 70,
    points: [
      [0, 0, 0, 0], [0, 380, 34, 2], [-220, 380, 28, 4], [-220, 600, 30, 7], [-80, 740, 60, 9],
      [-80, 980, 40, 12], [180, 980, 30, 14], [180, 1160, 45, 15], [420, 1160, 35, 13], [420, 1440, 38, 15], [650, 1440, 0, 17],
    ],
  },
  {
    id: 'oldtown', name: 'OLD TOWN', env: 'city', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Two narrow lanes between brick walls and fire escapes: square corners, an S through the market, no room to pass.',
    width: 11, lanes: 2, center: 'dashed-white', bank: 0, startS: 80,
    points: [
      [0, -45, 22], [0, 95, 20], [-70, 95, 20], [-70, 155, 22], [45, 155, 28], [92, 108, 28],
      [92, 28, 20], [145, 28, 18], [145, -45, 24],
    ],
  },
];

// reversed city circuits: same streets, the other way round, different night
const byId = Object.fromEntries(CITY.map((d) => [d.id, d]));
const rev = (d, extra) => ({ ...d, ...extra, id: `${d.id}_r`, reverseOf: d.id, points: d.points.slice().reverse() });
CITY.push(
  rev(byId.downtown, {
    name: 'DOWNTOWN REVERSE', weather: 'dry', startS: 640,
    blurb: 'The financial district loop run backwards on a dry night. The long boulevard comes at the end.',
  }),
  rev(byId.oldtown, {
    name: 'OLD TOWN REVERSE', time: 'night', weather: 'rain', startS: 560,
    blurb: 'Old Town the wrong way round, in the pouring rain. Brick walls, no run-off, no mercy.',
  }),
);

export const TRACKS = [...CITY, ...DOCKS, ...HIGHWAY, ...CIRCUIT, ...MOUNTAIN, ...DESERT];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
