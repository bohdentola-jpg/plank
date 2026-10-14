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
  sky: ['#2a2560', '#b5577a', '#ffaa62'], glowHorizon: '#ffc076', fog: '#c78a70',
  sun: { color: '#ffae66', i: 2.5, el: 0.13, az: 2.05 }, hemi: ['#8c86cc', '#6e3a26', 0.72], amb: 0.12,
  post: { exposure: 1.02, bloomStrength: 0.8, bloomThreshold: 1.1, saturation: 1.14, contrast: 1.06, lift: [0.012, 0.0, 0.014], gain: [1.07, 0.99, 0.93] },
};

const SUNSET_LAKE = {
  sky: ['#262a66', '#a35f92', '#ffb27a'], glowHorizon: '#ffcf96', fog: '#d2a28c',
  sun: { color: '#ffb874', i: 2.4, el: 0.1, az: 1.95 }, hemi: ['#9a92d6', '#a07070', 0.8], amb: 0.12,
  post: { exposure: 1.0, bloomStrength: 0.85, bloomThreshold: 1.05, saturation: 1.12, contrast: 1.05, lift: [0.014, 0.0, 0.018], gain: [1.06, 0.99, 0.95] },
};

export default [
  profiled({
    id: 'route99', name: 'ROUTE 99', env: 'desert', look: 'mojave', time: 'day', weather: 'dry', type: 'sprint',
    blurb: 'Seven kilometers of sun-bleached two-lane: a truck stop, a run of whoops that throw you skyward, and a slot canyon.',
    width: 12, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.85, asphalt: '#55524e',
    startS: 100, finishPad: 140, shoulder: 1.6, shoulderSurface: 'dirt', offSurface: 'sand', fogD: 0.00062,
    atmos: DAY_HAZE,
    points: [
      [0, 0], [0, 1150, 600], [400, 1843, 600], [400, 3700, 450], [1152, 3973, 160],
      [1272, 4302, 150], [1639, 4400, 170], [1787, 4717, 300], [1535, 6145],
    ],
    profile: [
      [0, 0], [450, 0, 3000], [1150, 5, 3000], [1850, 6, 3000], [2160, 5.5, 1500],
      // the whoops: sharp crests (R 22 m), long drops, gentle sags
      [2230, 4.6, 600], [2310, 9.4, 22], [2400, 1.8, 500], [2490, 7.4, 22], [2580, -0.2, 500],
      [2670, 5.4, 22], [2760, -2.2, 500], [2860, 4.0, 22], [2960, -4.4, 600],
      [3200, -3.5, 2000], [3480, -3, 2000], [4030, -5, 3000], [4400, -7, 3000],
      [4800, -12, 3000], [5100, -15, 3000], [5350, -14, 3000], [5650, -7, 3000],
      [6000, 0, 3000], [6300, 4, 1200], [6600, 1, 2000], [7004, 0],
    ],
    canyons: [{ s0: 4290, s1: 5590, h: 58, gap: 6.5 }],
    stop: { s: 1545, side: -1 },
    poles: { side: 1, from: 20, to: 6990, skip: [[4210, 5680]] },
    fence: 32,
    ads: [[640, 1, 0], [2040, -1, 1], [3330, 1, 2], [6150, -1, 3]],
    miles: [300, 37],
    signs: [
      [150, -1, 'shield'], [230, -1, 'limit65'], [1880, -1, 'services'], [2130, -1, 'dips'],
      [2190, 1, 'dip'], [2370, -1, 'dip'], [2560, 1, 'dip'], [2735, -1, 'dip'],
      [4180, -1, 'winding'], [4300, 1, 'rocks'], [6050, -1, 'shield'],
    ],
  }),
  anchored({
    id: 'redrock', name: 'RED ROCK CANYON', env: 'desert', look: 'redrock', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Sunset loop between burning red buttes, threading a slot canyon and diving through a dry wash.',
    width: 12, lanes: 2, center: 'double-yellow', edge: 'white', worn: 0.6, asphalt: '#4e4642',
    startS: 120, shoulder: 1.4, shoulderSurface: 'dirt', offSurface: 'dirt', fogD: 0.00095,
    atmos: SUNSET_CANYON,
    points: [
      [0, 0], [700, 0, 160], [1000, 380, 200], [880, 760, 90], [620, 720, 60], [430, 900, 65],
      [180, 820, 70], [-50, 960, 110], [-380, 820, 90], [-420, 420, 120], [-300, 0, 130],
    ],
    canyons: [{ s0: 1440, s1: 2660, h: 52, gap: 5.5 }],
    washes: [{ s: 3135, w: 34, depth: 2.6, angle: 0.25 }],
    fence: 30,
    ads: [[350, -1, 1]],
    signs: [
      [60, -1, 'park'], [1380, -1, 'winding'], [1420, 1, 'rocks'], [3000, -1, 'flood'], [3040, 1, 'dip'],
    ],
  }, [
    [0, 0], [600, 0], [1100, 10], [1470, 16], [1800, 15], [2100, 13], [2400, 14], [2620, 12],
    [2900, 5], [3040, 4], [3135, 1.2], [3230, 3.6], [3500, 3], [3820, 0],
  ]),
  {
    id: 'drylake', name: 'DRY LAKE DRAG', env: 'desert', look: 'salt', time: 'sunset', weather: 'dry', type: 'drag',
    blurb: 'A quarter mile chalked onto the salt. Trucks line the strip, the tree drops amber, the mountains turn purple.',
    width: 20, lanes: 2, center: 'lanes-solid', edge: 'white', worn: 0.3, asphalt: '#3e3d3e',
    startS: 120, dragLength: 402, finishPad: 1200 - 120 - 402, shoulder: 2, shoulderSurface: 'dirt', offSurface: 'dirt', fogD: 0.00042,
    atmos: SUNSET_LAKE,
    points: [[0, 0], [0, 1200]],
    fence: 34,
  },
];
