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
      [0, -150, 20], [0, 650, 28], [300, 650, 22], [300, 450, 20], [520, 450, 20], [520, 820, 30],
      [900, 820, 40], [900, 250, 35], [650, 0, 70], [650, -350, 28], [200, -350, 30], [200, -150, 22],
    ],
  },
];

export const TRACKS = [...CITY, ...DOCKS, ...HIGHWAY, ...CIRCUIT, ...MOUNTAIN, ...DESERT];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
