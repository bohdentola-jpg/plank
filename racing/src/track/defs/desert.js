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
    blurb: 'Sun-bleached two-lane: past the truck stop, a hard right at the junction, whoops that throw you skyward, fast sweepers over a blind crest, then a twisting slot canyon.',
    width: 12, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.85, asphalt: '#55524e',
    startS: 100, finishPad: 160, shoulder: 1.6, shoulderSurface: 'dirt', offSurface: 'sand', fogD: 0.00062,
    atmos: DAY_HAZE,
    points: [
      [0, 0], [0, 610.8, 600], [314, 1154.7, 65], [90.4, 1273.6, 180], [66.4, 2643.2, 450], [-428.8, 3213, 300], [-62.4, 4036, 450],
      [-325.5, 4575.5, 170], [-224.5, 4750.5, 120], [-357, 4902.9, 70], [-219, 5036.2, 140], [-219, 5519.1, 700], [-40, 6010.9],
    ],
    profile: [
      [0, 0], [300, 0, 3000], [800, 5, 3000], [1150, 5.5, 3000], [1440, 5.2, 1500],
      // the whoops: sharp crests (R 22 m), long drops, gentle sags
      [1590, 4.6, 600], [1670, 9.4, 22], [1760, 1.8, 500], [1850, 7.4, 22], [1940, -0.2, 500],
      [2030, 5.4, 22], [2120, -2.2, 500], [2220, 4.0, 22], [2320, -4.4, 600],
      // sweepers, a blind crest, then down through the slot canyon and up to a last blind crest
      [2600, -3.5, 2000], [2900, -2, 2000], [3300, 0, 2500], [3700, 6, 2500], [3960, 11, 700], [4200, 6, 2000],
      [4500, 2, 2000], [4800, -3, 2000], [5050, -7, 2000], [5300, -12, 2000], [5500, -9, 2000],
      [5750, -2, 2500], [6000, 3, 1800], [6250, 0.5, 2500], [6507, 0],
    ],
    canyons: [{ s0: 4790, s1: 5640, h: 58, gap: 6.5 }],
    washes: [{ s: 1760, w: 16, depth: 1.4, angle: 0.3 }, { s: 1940, w: 22, depth: 1.6, angle: -0.2 }, { s: 2120, w: 14, depth: 1.2, angle: 0.1 }, { s: 2320, w: 26, depth: 1.8, angle: -0.35 }],
    stop: { s: 980, side: -1 },
    poles: { side: 1, from: 20, to: 6490, skip: [[4700, 5660]] },
    fence: 32,
    ads: [[300, 1, 0], [1620, -1, 1], [2900, 1, 2], [4300, -1, 3], [5900, 1, 1]],
    miles: [250, 37],
    signs: [
      [150, -1, 'shield'], [230, -1, 'limit65'], [820, -1, 'services'], [1500, -1, 'dips'],
      [1560, 1, 'dip'], [1735, -1, 'dip'], [1920, 1, 'dip'], [2100, -1, 'dip'],
      [4700, -1, 'winding'], [4800, 1, 'rocks'], [5720, -1, 'shield'],
    ],
  }),
  anchored({
    id: 'redrock', name: 'RED ROCK CANYON', env: 'desert', look: 'redrock', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Sunset loop between burning red buttes: a blind right into the slot canyon, out across the dry wash to a hairpin, then a dive back through the wash.',
    width: 12, lanes: 2, center: 'double-yellow', edge: 'white', worn: 0.6, asphalt: '#4e4642',
    startS: 620, shoulder: 1.4, shoulderSurface: 'dirt', offSurface: 'dirt', fogD: 0.00095,
    atmos: SUNSET_CANYON,
    // s = 0 sits on the straight out of the canyon, before the hairpin (an in-line point);
    // the wash crosses it at ~1710 and again (the dive) at 280
    points: [
      [0, 0], [0, 148.6, 48], [-374.5, 12.2, 80], [-205.9, -451.1, 200], [-44.4, -564.1, 95], [61.4, -509.1, 95], [61.4, -378.7, 90], [0, -305.5, 90],
    ],
    canyons: [{ s0: 1090, s1: 1600, h: 52, gap: 5.5 }],
    washes: [{ s: 280, w: 34, depth: 3.4, angle: 0.5 }],
    fence: 30,
    ads: [[720, 1, 1]],
    signs: [
      [200, -1, 'flood'], [230, 1, 'dip'], [580, -1, 'park'], [1000, -1, 'winding'], [1060, 1, 'rocks'],
    ],
  }, [
    [0, 10.5], [100, 7.8], [200, 4], [280, 1], [350, 4], [440, 3], [600, 1], [900, 2], [1050, 5], [1150, 10],
    [1300, 14], [1450, 15], [1600, 13], [1712, 10.2],
  ]),
  profiled({
    id: 'ghosttown', name: 'GHOST TOWN', env: 'desert', look: 'mojave', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A loop out of a dead mining town at sunset: main street past the old diner, a dip through the dry wash, an S in the canyon, a crest that lifts you, back across the wash.',
    width: 12, lanes: 2, center: 'yellow-dashed', edge: 'white', worn: 0.9, asphalt: '#57514b',
    startS: 30, shoulder: 1.5, shoulderSurface: 'dirt', offSurface: 'sand', fogD: 0.0009,
    atmos: SUNSET_CANYON,
    points: [
      [0, 0], [0, 220, 70], [-280, 220, 200], [-390, 30, 110], [-545, -20, 90], [-440, -325, 150], [0, -325, 100],
    ],
    profile: [
      [0, 0], [160, 0, 1500], [290, 0, 400], [342, -2.2, 250], [395, 0, 400], [470, 1, 1500], [600, 5, 1500], [760, 9, 1500],
      [880, 9.5, 600], [950, 12, 120], [1030, 8.5, 800], [1200, 6, 1500], [1280, 6.5, 250], [1340, 3, 600], [1380, 0.6, 300],
      [1420, 2, 600], [1500, 1, 1500], [1620, 0, 1500], [1810, 0],
    ],
    canyons: [{ s0: 590, s1: 960, h: 46, gap: 6 }],
    washes: [{ s: 1380, w: 26, depth: 2.4, angle: 0.04 }],
    stop: { s: 1700, side: -1 },
    poles: { side: -1, from: 0, to: 1800, skip: [[540, 1010]] },
    fence: 30,
    ads: [[1480, -1, 3]],
    signs: [
      [1610, -1, 'services'], [470, -1, 'winding'], [540, 1, 'rocks'], [1290, -1, 'flood'], [1320, 1, 'dip'], [280, 1, 'dip'],
    ],
  }),
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
