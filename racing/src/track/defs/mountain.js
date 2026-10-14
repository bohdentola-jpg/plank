// mountain track definitions (see tracks.js for the format).
// Elevation is authored as a piecewise-linear grade profile in meters
// ([[s, y], …]) and expanded into a dense `elevation` table, so the Track's
// smootherstep anchors don't flatten the road at every knot.
import { buildCenterline } from '../path.js';

function profile(def, knots) {
  const L = buildCenterline(def).length;
  const out = [];
  const end = knots[knots.length - 1][0];
  for (let s = 0; s <= Math.max(L, end); s += 12) {
    let k = 0;
    while (k < knots.length - 2 && knots[k + 1][0] < s) k++;
    const [s0, y0] = knots[k], [s1, y1] = knots[k + 1];
    const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    out.push([Math.min(1, s / L), y0 + (y1 - y0) * t]);
  }
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
    width: 9, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.3, startS: 150,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt', fogD: 0.0042,
    points: [
      [-300, 420, 90], [220, 430, 90], [450, 300, 120], [480, -80, 16], [435, -95, 16], [395, 170, 16], [350, 185, 16],
      [300, -230, 110], [90, -420, 140], [-160, -430, 120], [-380, -300, 100], [-420, -60, 55], [-330, 60, 45],
      [-440, 200, 80],
    ],
  }, [[0, 745], [300, 742], [700, 770], [1100, 812], [1600, 860], [1900, 868], [2300, 840], [3000, 770], [3400, 745]]),
];
