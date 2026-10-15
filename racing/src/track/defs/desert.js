// desert track definitions (see tracks.js for the format).
//
// Desert extras (read by env/desert.js; positions are meters along the path):
//   look      palette/relief preset: 'mojave' | 'redrock' | 'salt'
//   profile   vertical alignment as PVIs [s, y, curveRadius] joined by straight
//             grades + parabolic vertical curves. Track smooths `elevation`
//             heavily, which would erase sharp crests, so the env re-applies
//             this exactly; `elevation` gets the same anchors for everything else.
//   canyons   [{ s0, s1, h, gap }] rock walls lining both sides (gap: m past the road edge)
//   washes    [{ s, w, depth, angle }] dry sandy channels crossing the road
//   stop      { s, side } roadside diner + gas station (side: 1 left, -1 right)
//   poles     { side, from, to, skip: [[s0, s1]] } telephone line
//   fence     right-of-way fence lateral distance (also the invisible wall)
//   ads       [[s, side, adIndex]] billboards;  miles: [s of first marker, first number]
//   signs     [[s, side, kind]] roadside signs (dip, curveL/R, rocks, limit65, shield, services, flood, park)
import { buildCenterline } from '../path.js';

function profiled(def) {
  const L = buildCenterline(def).length;
  // fallback elevation skips the sharp crests (smoothed anchors would over-steepen them)
  def.elevation = def.profile.filter((p) => !(p[2] < 100)).map(([s, y]) => [s / L, y]);
  return def;
}

function anchored(def, prof) {
  const L = buildCenterline(def).length;
  def.elevation = prof.map(([s, y]) => [s / L, y]);
  return def;
}

const DAY_HAZE = {
  sky: ['#3b74c2', '#8db3dc', '#e4d8c4'], glowHorizon: '#fff2d8', fog: '#d6c7ae',
  sun: { color: '#fff0d4', i: 3.3, el: 0.92, az: 0.9 }, hemi: ['#cfe0ff', '#b48a5a', 0.95], amb: 0.15,
  post: { exposure: 0.98, bloomStrength: 0.5, bloomThreshold: 1.3, saturation: 0.98, contrast: 1.07, lift: [0.012, 0.006, 0.0], gain: [1.05, 1.0, 0.93] },
};

const SUNSET_CANYON = {
  sky: ['#1d2258', '#7a4c8e', '#ff9e5a'], glowHorizon: '#ffb466', fog: '#c98a6c',
  sun: { color: '#ffae66', i: 2.5, el: 0.13, az: 2.05 }, hemi: ['#8c86cc', '#6e3a26', 0.72], amb: 0.12,
  post: { exposure: 1.02, bloomStrength: 0.8, bloomThreshold: 1.1, saturation: 1.14, contrast: 1.06, lift: [0.012, 0.0, 0.014], gain: [1.07, 0.99, 0.93] },
};

const SUNSET_LAKE = {
  sky: ['#141c58', '#55508f', '#ffa860'], glowHorizon: '#ffc07a', fog: '#d49a78',
  sun: { color: '#ffb874', i: 2.4, el: 0.1, az: 1.95 }, hemi: ['#8a90d0', '#a07a68', 0.8], amb: 0.12,
  post: { exposure: 1.0, bloomStrength: 0.85, bloomThreshold: 1.05, saturation: 1.12, contrast: 1.05, lift: [0.014, 0.0, 0.018], gain: [1.06, 0.99, 0.95] },
};

export default [
  profiled({
    id: 'route99', name: 'ROUTE 99', env: 'desert', look: 'mojave', time: 'day', weather: 'dry', type: 'sprint',
    blurb: 'Sun-bleached two-lane: past the truck stop, a hard right at the junction, whoops that throw you skyward, then a twisting slot canyon.',
    width: 12, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.85, asphalt: '#55524e',
    startS: 100, finishPad: 140, shoulder: 1.6, shoulderSurface: 'dirt', offSurface: 'sand', fogD: 0.00062,
    atmos: DAY_HAZE,
    points: [
      [0, 0], [0, 480, 600], [280, 965, 65], [63, 1090, 180], [63, 2270, 450], [-194, 2576, 170],
      [-122, 2774, 120], [-275, 2902, 70], [-166, 3058, 140], [-256, 3570, 700], [-194, 3925],
    ],
    profile: [
      [0, 0], [260, 0, 3000], [700, 5, 3000], [1000, 5.5, 3000], [1290, 5.2, 1500],
      // the whoops: sharp crests (R 22 m), long drops, gentle sags
      [1390, 4.6, 600], [1470, 9.4, 22], [1560, 1.8, 500], [1650, 7.4, 22], [1740, -0.2, 500],
      [1830, 5.4, 22], [1920, -2.2, 500], [2020, 4.0, 22], [2120, -4.4, 600],
      // down through the slot canyon, then up out of it to a last blind crest
      [2430, -3.5, 2000], [2680, -5, 2000], [2930, -9, 2000], [3160, -14, 2000], [3390, -8, 2000],
      [3570, -1.5, 2500], [3810, 3, 1800], [4050, 0.5, 2500], [4210, 0],
    ],
    canyons: [{ s0: 2610, s1: 3470, h: 58, gap: 6.5 }],
    washes: [{ s: 1560, w: 16, depth: 1.4, angle: 0.3 }, { s: 1740, w: 22, depth: 1.6, angle: -0.2 }, { s: 1920, w: 14, depth: 1.2, angle: 0.1 }, { s: 2120, w: 26, depth: 1.8, angle: -0.35 }],
    stop: { s: 790, side: -1 },
    poles: { side: 1, from: 20, to: 4200, skip: [[2530, 3560]] },
    fence: 32,
    ads: [[270, 1, 0], [1420, -1, 1], [2380, 1, 2], [3650, -1, 3]],
    miles: [250, 37],
    signs: [
      [150, -1, 'shield'], [230, -1, 'limit65'], [920, -1, 'services'], [1300, -1, 'dips'],
      [1360, 1, 'dip'], [1535, -1, 'dip'], [1720, 1, 'dip'], [1900, -1, 'dip'],
      [2500, -1, 'winding'], [2625, 1, 'rocks'], [3590, -1, 'shield'],
    ],
  }),
  anchored({
    id: 'redrock', name: 'RED ROCK CANYON', env: 'desert', look: 'redrock', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Sunset loop between burning red buttes: a blind right into a slot canyon, a hairpin at its mouth, a dive through the dry wash.',
    width: 12, lanes: 2, center: 'double-yellow', edge: 'white', worn: 0.6, asphalt: '#4e4642',
    startS: 606, shoulder: 1.4, shoulderSurface: 'dirt', offSurface: 'dirt', fogD: 0.00095,
    atmos: SUNSET_CANYON,
    // s = 0 sits mid-straight before the hairpin (an in-line point): buttes and mesas are
    // placed by s, and this origin keeps every one of them clear of the loop
    points: [
      [97.5, 296.135], [61, 333, 48], [13, 327, 48], [-120, 97, 80], [-109, 38, 80], [-64, 0, 80],
      [269, 0, 95], [326, 57, 95], [326, 138, 95], [247, 217, 90], [161, 232, 90],
    ],
    canyons: [{ s0: 786, s1: 1226, h: 52, gap: 5.5 }],
    washes: [{ s: 237, w: 34, depth: 3.4, angle: 0.4 }],
    fence: 30,
    ads: [[686, 1, 1]],
    signs: [
      [152, -1, 'flood'], [182, 1, 'dip'], [576, -1, 'park'], [696, -1, 'winding'], [751, 1, 'rocks'],
    ],
  }, [
    [87, 9], [177, 4.5], [237, 1.5], [307, 4], [397, 2.5], [536, 0], [716, 0], [1006, 10], [1176, 13], [1236, 12.5],
  ]),
  {
    id: 'drylake', name: 'DRY LAKE DRAG', env: 'desert', look: 'salt', time: 'sunset', weather: 'dry', type: 'drag',
    blurb: 'A quarter mile chalked onto the salt. Trucks line the strip, the tree drops amber, the mountains turn purple.',
    width: 20, lanes: 2, center: 'lanes-solid', edge: 'white', worn: 0.3, asphalt: '#3e3d3e',
    startS: 120, dragLength: 402, finishPad: 1200 - 120 - 402, shoulder: 2, shoulderSurface: 'dirt', offSurface: 'dirt', fogD: 0.00036,
    atmos: SUNSET_LAKE,
    points: [[0, 0], [0, 1200]],
    fence: 34,
  },
];
