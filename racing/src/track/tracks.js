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
    blurb: 'Four-lane boulevards and right-angle corners through the financial district. Wet tonight.',
    width: 16, lanes: 4, center: 'double-yellow', bank: 0, startS: 120,
    points: [
      [0, -150, 27], [0, 650, 36], [300, 650, 30], [300, 450, 27], [520, 450, 27], [520, 820, 36],
      [900, 820, 45], [900, 250, 42], [650, 0, 70], [650, -350, 36], [200, -350, 36], [200, -150, 30],
    ],
  },
  {
    id: 'uptown', name: 'UPTOWN RUN', env: 'city', time: 'night', weather: 'rain', type: 'sprint',
    blurb: 'Point to point from the financial district up the hill to the old observatory. Raining hard.',
    width: 15, lanes: 4, center: 'double-yellow', bank: 0, startS: 40, finishPad: 70,
    points: [
      [0, 0, 0, 0], [0, 600, 40, 3], [-350, 600, 30, 6], [-350, 1100, 35, 13], [150, 1100, 60, 9],
      [150, 1500, 40, 4], [700, 1500, 50, 2], [700, 1950, 0, 6],
    ],
  },
  {
    id: 'oldtown', name: 'OLD TOWN', env: 'city', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Two narrow lanes between brick walls and fire escapes. Twelve corners, no room to pass.',
    width: 11, lanes: 2, center: 'dashed-white', bank: 0, startS: 60,
    points: [
      [0, -100, 20], [0, 300, 24], [-150, 300, 20], [-150, 520, 26], [120, 520, 32], [260, 380, 36],
      [260, 120, 26], [400, 120, 20], [400, -200, 32], [150, -200, 24], [150, -100, 20],
    ],
  },
];

// reversed city circuits: same streets, the other way round, different night
const byId = Object.fromEntries(CITY.map((d) => [d.id, d]));
const rev = (d, extra) => ({ ...d, ...extra, id: `${d.id}_r`, reverseOf: d.id, points: d.points.slice().reverse() });
CITY.push(
  rev(byId.downtown, {
    name: 'DOWNTOWN REVERSE', weather: 'dry', startS: 3500,
    blurb: 'The financial district loop run backwards on a dry night. The long boulevard comes at the end.',
  }),
  rev(byId.oldtown, {
    name: 'OLD TOWN REVERSE', time: 'night', weather: 'rain', startS: 2010,
    blurb: 'Old Town the wrong way round, in the pouring rain. Brick walls, no run-off, no mercy.',
  }),
);

export const TRACKS = [...CITY, ...DOCKS, ...HIGHWAY, ...CIRCUIT, ...MOUNTAIN, ...DESERT];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
