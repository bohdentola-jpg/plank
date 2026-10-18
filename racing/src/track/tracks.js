// Track definitions. points: [x, z, cornerRadius, elevation?, halfWidth?]
// (a filleted polyline — straights joined by constant-radius corners).
// env: city | docks | highway | circuit | mountain | desert
// time: night | dusk | sunset | day | overcast ; weather: dry | wet | rain

import CIRCUIT from './defs/circuit.js';
import MOUNTAIN from './defs/mountain.js';
import DESERT from './defs/desert.js';
import DOCKS from './defs/docks.js';
import HIGHWAY from './defs/highway.js';
import { COURSES, courseFor } from '../world/course.js';

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

// what each route is like now that it runs through the city
const BLURBS = {
  downtown: 'Four-lane avenues round the financial district: Main Street east under the towers, down 5th, a jog through Union and Central, west along Harbor Avenue and back up 1st. Wet tonight.',
  downtown_r: 'The financial district the other way round on a dry night: down 1st, along Harbor Avenue, the Central-Union jog, up 5th and west along Main Street under the towers.',
  uptown: 'Point to point up the hill: Central Avenue, under the I-9 viaduct, Park Boulevard past the museum, Madison Boulevard by the park, across the top and out onto Kaido Road. Raining hard.',
  oldtown: 'Cobbles and brick along the river: over the Grand Bridge, a staircase of square corners on the east bank, back over the water on the old stone bridge and up the west quai. Two lanes, no run-off.',
  oldtown_r: 'Old Town the wrong way round in the pouring rain: up the quai, over the stone bridge, down the staircase of corners and home across the Grand Bridge.',
  chinatown: 'Under the neon: the long street east through the market blocks, square corners, Grant Avenue under the lanterns and back along the edge of the alleys.',
  harbor: 'Round the container terminal: in by the gate, the long berth road beside the ships, the stacks and the cranes overhead. Wet quays tonight.',
  pier9: 'Beach Boulevard along the sand, down to the boardwalk past the Ferris wheel and the arcades, and back up onto the sea road.',
  shipyard: 'Point to point along the dry docks: the shipyard road past the hulls on their slips, round the docks and out along Harbor Boulevard past the terminal gate.',
  interstate: 'Six and a half kilometres of the I-9: over the gorge below the dam, up onto the viaduct past the towers, down across the Eastside plains and out to the desert. Traffic, and wet.',
  skyline: 'The Skyline Expressway: a loop of elevated deck between the downtown blocks, tight concrete corners and the towers close enough to touch. Traffic.',
  bayshore: 'From the beach up onto the cliffs, along Bayshore Route and over the Bayshore Bridge to Halcyon Point. Fast, and a long way down.',
  redwood: 'Grand prix racing in the redwoods: the pit straight in the clearing, a brutal hairpin, the esses down through trunks as wide as the track, the long back straight and the climb to the sweeper.',
  crestwood: 'Golden hills at sundown: the main straight over a blind crest, the hairpin, the climb through the vineyards to the corkscrew, then round the long carousel.',
  ironwood: 'The old ironworks by the lake, made into a raceway: fast sweepers past the blast furnaces, the long back straight, then the hairpin and a tight infield under the conveyor bridges. Damp and grey.',
  kaido: 'Kaido Pass downhill at sundown: from the top of the pass through the cedars, hairpin after hairpin, then the hairpins stacked down the escarpment to the edge of town. The road every drifter in town wants to own.',
  summit: 'One lap of the Summit Loop at night: snow poles, the observatory dome above you, the switchbacks down the west face and nothing but the drop past the barrier.',
  ridgeline: 'Hill climb from the desert floor to the ridge: the hairpins up its face, then the twisting road along the crest past the wind turbines and the 92.7 tower.',
  route99: 'Route 99 north from the cliffs across the desert: past the turn for Ghost Town and the Rocket Diner, the motel signs and the canyon turn, flat out to the foot of the ridge.',
  redrock: 'Down the canyon floor between red walls and back along the rim: the arch overhead, the drop beside you, the sun going down.',
  ghosttown: 'A dirt loop round a dead mining town: false fronts, the saloon, the headframe on the hill. Loose under the tyres, sundown.',
  drylake: 'The salt flat\'s drag strip: a kilometre of nothing but white, the timing lights and the bleachers.',
};

// Every track is a place in PORT HALCYON now: its line is its route over
// the city's own roads (world/course.js), worked out the first time anyone
// asks (a route map, a race), and the race runs in the world itself. What
// stays from the definitions above is who they are: name, race type, time
// of day and weather, traffic. A circuit's laps come from its course (its
// laps are longer than the old ones: two make a race of two to three minutes).
for (const def of TRACKS) {
  const C = COURSES[def.id];
  if (!C) continue;
  const get = () => courseFor(def.id);
  const loop = !!(C.loop || COURSES[C.reverseOf]?.loop);
  def.world = true;
  if (BLURBS[def.id]) def.blurb = BLURBS[def.id];
  delete def.elevation;
  delete def.bankBoost;
  def.bank = 0;
  def.radius = 30;
  def.startS = C.start ?? (loop ? 100 : 30);
  if (loop) def.laps = C.laps ?? COURSES[C.reverseOf]?.laps ?? 2;
  def.finishPad = 60;
  def.trafficCount = def.traffic ? 18 : undefined;
  Object.defineProperty(def, 'points', { get: () => get().points, configurable: true, enumerable: true });
  Object.defineProperty(def, 'course', { get, configurable: true });
  // (the traffic's lanes: the width the race line keeps to)
  Object.defineProperty(def, 'width', { get: () => { const P = get().points; return 2 * P[Math.floor(P.length / 2)][4]; }, configurable: true, enumerable: true });
  Object.defineProperty(def, 'lanes', { get: () => (def.width > 12 ? 3 : 2), configurable: true, enumerable: true });
}
