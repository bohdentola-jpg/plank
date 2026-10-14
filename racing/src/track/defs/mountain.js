// mountain track definitions (see tracks.js for the format).
// Elevation is authored as a piecewise-linear grade profile in meters
// ([[s, y], …]) and expanded into a dense `elevation` table, so the Track's
// smootherstep anchors don't flatten the road at every knot.
import { buildCenterline } from '../path.js';

function profile(def, knots) {
  const L = buildCenterline(def).length;
  const at = (s) => {
    let k = 0;
    while (k < knots.length - 2 && knots[k + 1][0] < s) k++;
    const [s0, y0] = knots[k], [s1, y1] = knots[k + 1];
    const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    return y0 + (y1 - y0) * t;
  };
  const out = [];
  for (let s = 0; s < L; s += 12) out.push([s / L, at(s)]);
  out.push([1, at(L)]);
  return out;
}

function withProfile(def, knots) {
  def.elevation = profile(def, knots);
  return def;
}

export default [
  withProfile({
    id: 'kaido', name: 'KAIDO PASS', env: 'mountain', time: 'dusk', weather: 'dry', type: 'sprint',
    blurb: 'Five kilometers of cedar-lined pass falling off the ridge at sundown.',
    width: 10, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.55, startS: 110, finishPad: 110,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt',
    atmos: { sun: { color: '#ffb07a', i: 1.0, el: 0.07, az: 1.45 } },
    // scenery: rock shed span, summit lookout, extra lamps, power-line spans (meters along the road)
    shed: [1890, 2030], viewpoint: { s: 125, len: 76, depth: 18 },
    lamps: [104, 4985, 5085], poles: [[180, 1320], [3560, 5180]],
    // landform: height profile across the fall line (z), noise relief, peaks
    land: {
      axis: [0, 1], snow: 1010, seed: 3,
      base: [[-1500, 1150], [-1100, 900], [-800, 700], [-640, 618], [-520, 562], [-380, 503], [-220, 448], [-60, 420],
        [150, 402], [450, 388], [800, 386], [1050, 420], [1300, 560], [1600, 760]],
      relief: [[-1200, 70], [-700, 45], [-300, 40], [100, 22], [600, 12], [1000, 30], [1400, 60]],
      peaks: [[-650, -1150, 260, 380], [380, -1080, 200, 300], [-1350, -950, 180, 320], [900, -800, 160, 280]],
      town: [[-500, 780, 110, 50], [120, 720, 90, 34], [-1500, 830, 140, 70], [520, 880, 70, 24], [-1000, 980, 90, 30]],
    },
    points: [
      [-1070, -626, 0], [-770, -642, 193], [-535, -599, 214], [-321, -633, 278], [-64, -615, 235], [139, -578, 139],
      [417, -605, 40], [417, -559, 40], [128, -511, 214], [-150, -484, 342], [-449, -494, 40], [-449, -449, 40],
      [-139, -419, 40], [-139, -374, 40], [-428, -345, 40], [-428, -300, 40], [-139, -268, 40], [-139, -223, 40],
      [-353, -193, 64], [-310, -54, 54], [-171, 11, 48], [-203, 139, 64], [-449, 187, 128], [-642, 321, 160],
      [-696, 514, 150], [-942, 599, 171], [-1177, 556, 0],
    ],
  }, [[0, 640], [268, 637], [1605, 584], [1733, 578], [2482, 540], [2568, 536], [3480, 448], [3560, 444], [4100, 418], [4654, 397], [5152, 386]]),
  withProfile({
    id: 'summit', name: 'SUMMIT LOOP', env: 'mountain', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A fogbound lap of the peak: switchbacks up, a flat-out plunge down.',
    width: 9.5, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.35, startS: 208,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt', fogD: 0.0042,
    viewpoint: { s: 2174, len: 70, depth: 18 }, lamps: [198, 1966], lampColor: '#d6e4ff', poles: [[270, 790], [2700, 3430]],
    // hazy moonlit night: no stars, blue-gray fog that the sky fades into
    atmos: { sky: ['#06080f', '#111725', '#2a3242'], glowHorizon: '#3c4456', fog: '#252c3a', stars: false, sun: { color: '#9fb4ff', i: 0.24, el: 0.62, az: 2.5 } },
    land: {
      center: [0, 0], tilt: [0, -1, 0.11], snow: 960, seed: 11,
      base: [[0, 1060], [156, 990], [312, 900], [468, 805], [624, 720], [832, 640], [1144, 600], [1456, 680]],
      relief: [[0, 40], [400, 30], [800, 45], [1400, 70]],
      peaks: [[-156, -62, 60, 166]],
    },
    points: [
      [-312, 437, 90], [229, 447, 90], [468, 312, 120], [499, -83, 40], [452, -99, 40], [411, 177, 40], [364, 192, 40],
      [312, -239, 110], [94, -437, 140], [-166, -447, 120], [-395, -312, 100], [-437, -62, 55], [-343, 62, 45],
      [-458, 208, 80],
    ],
  }, [[0, 745], [312, 743], [728, 772], [1186, 814], [1321, 819], [1508, 838], [1633, 843], [1789, 859], [1955, 867], [2132, 862], [2392, 842], [3120, 772], [3536, 745]]),
];
