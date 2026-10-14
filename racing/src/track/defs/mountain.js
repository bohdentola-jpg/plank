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
    blurb: 'Five kilometers of cedar-lined pass road falling off the ridge at sundown. Guardrail on one side, rock on the other.',
    width: 9.5, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.25, startS: 110, finishPad: 110,
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
      [417, -605, 16], [417, -559, 16], [128, -511, 214], [-150, -484, 342], [-449, -494, 15], [-449, -449, 15],
      [-139, -419, 15], [-139, -374, 15], [-428, -345, 16], [-428, -300, 16], [-139, -268, 17], [-139, -223, 17],
      [-353, -193, 64], [-310, -54, 54], [-171, 11, 48], [-203, 139, 64], [-449, 187, 128], [-642, 321, 160],
      [-696, 514, 150], [-942, 599, 171], [-1177, 556, 0],
    ],
  }, [[0, 640], [268, 637], [1605, 584], [1733, 578], [2482, 540], [2568, 536], [3798, 434], [4654, 400], [9000, 388]]),
  withProfile({
    id: 'summit', name: 'SUMMIT LOOP', env: 'mountain', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A fogbound lap around the peak: switchbacks up the east face, a flat-out plunge down the west.',
    width: 9, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.3, startS: 200,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt', fogD: 0.0042,
    viewpoint: { s: 2090, len: 70, depth: 18 }, lamps: [190, 1890], lampColor: '#d6e4ff', poles: [[260, 760], [2600, 3300]],
    // hazy moonlit night: no stars, blue-gray fog that the sky fades into
    atmos: { sky: ['#06080f', '#111725', '#2a3242'], glowHorizon: '#3c4456', fog: '#252c3a', stars: false },
    land: {
      center: [0, 0], tilt: [0, -1, 0.11], snow: 960, seed: 11,
      base: [[0, 1060], [150, 990], [300, 900], [450, 805], [600, 720], [800, 640], [1100, 600], [1400, 680]],
      relief: [[0, 40], [400, 30], [800, 45], [1400, 70]],
      peaks: [[-150, -60, 60, 160]],
    },
    points: [
      [-300, 420, 90], [220, 430, 90], [450, 300, 120], [480, -80, 16], [435, -95, 16], [395, 170, 16], [350, 185, 16],
      [300, -230, 110], [90, -420, 140], [-160, -430, 120], [-380, -300, 100], [-420, -60, 55], [-330, 60, 45],
      [-440, 200, 80],
    ],
  }, [[0, 745], [300, 742], [700, 770], [1100, 812], [1600, 860], [1900, 868], [2300, 840], [3000, 770], [3400, 745]]),
];
