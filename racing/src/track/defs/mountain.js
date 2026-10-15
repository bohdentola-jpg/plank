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

// Hairpins are vertex pairs ~45 m apart with an oversized radius (40): both
// fillets clamp to the gap and meet in one continuous ~20 m arc.

export default [
  withProfile({
    id: 'kaido', name: 'KAIDO PASS', env: 'mountain', time: 'dusk', weather: 'dry', type: 'sprint',
    blurb: 'Cedar-lined pass falling off the ridge at sundown: flat out along the crest, four stacked hairpins, the rock shed, esses to the valley.',
    width: 10, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.55, startS: 110, finishPad: 130,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt',
    atmos: { sun: { color: '#ffb07a', i: 1.0, el: 0.07, az: 1.45 } }, // sets over the valley (+z)
    // scenery: rock shed span, summit lookout, extra lamps, power-line spans (meters along the road)
    shed: [1797, 1937], viewpoint: { s: 125, len: 76, depth: 18 },
    lamps: [104, 2745, 2845], poles: [[180, 330], [400, 560], [2528, 2920]],
    // landform: height profile across the fall line (z), noise relief, peaks
    land: {
      axis: [0, 1], snow: 1010, seed: 3,
      base: [[-900, 1150], [-500, 880], [-250, 720], [-120, 640], [-40, 596], [40, 596], [120, 592], [200, 576], [240, 567],
        [280, 546], [320, 528], [360, 520], [440, 523], [520, 526], [600, 518], [700, 517], [760, 519], [800, 508], [840, 495],
        [880, 491], [1000, 480], [1200, 470], [1400, 468], [1700, 500], [1950, 600], [2200, 780]],
      relief: [[-600, 70], [-100, 40], [300, 30], [700, 20], [1200, 12], [1600, 30], [2000, 60]],
      peaks: [[450, -550, 260, 380], [1480, -480, 200, 300], [-250, -350, 180, 320], [2000, -200, 160, 280]],
      town: [[700, 1080, 110, 50], [1250, 1040, 90, 34], [380, 1150, 140, 70], [1530, 1100, 70, 24], [960, 1200, 90, 30]],
    },
    points: [
      [340, -40, 0], [580, -50, 130], [720, -10, 110], [900, -36, 160],
      [1120, -12, 40], [1120, 33, 40],
      [910, 60, 40], [910, 105, 40],
      [1070, 128, 40], [1070, 173, 40],
      [910, 196, 40], [910, 241, 40],
      [1140, 270, 110], [1360, 292, 200], [1520, 350, 70],
      [1470, 450, 50], [1550, 540, 80], [1490, 630, 55],
      [1530, 740, 150], [1350, 840, 200], [1070, 874, 0],
    ],
  }, [ // elevation [s m, y m]: summit straight, ridge run, four hairpins (legs ~9%, eased turns), traverse, esses, valley run
    [0, 640], [150, 639], [751, 624], [846, 620.5], [1002, 606], [1087, 602.5], [1195, 592.5], [1277, 589],
    [1385, 579], [1468, 575.5], [1996, 545], [2506, 513], [2806, 497], [2932, 495],
  ]),
  withProfile({
    id: 'summit', name: 'SUMMIT LOOP', env: 'mountain', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A fogbound lap of the peak: two switchbacks up, the lookout and shrine at the top, a flat-out plunge back down.',
    width: 9.5, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.35, startS: 700,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt', fogD: 0.0042,
    viewpoint: { s: 712, len: 70, depth: 18 }, lamps: [120, 690], lampColor: '#d6e4ff',
    poles: [[90, 180], [780, 900]],
    // hazy moonlit night: no stars, blue-gray fog that the sky fades into
    atmos: {
      sky: ['#06080f', '#111725', '#2a3242'], glowHorizon: '#3c4456', fog: '#252c3a', stars: false,
      sun: { color: '#9fb4ff', i: 0.5, el: 0.62, az: 2.5 }, hemi: ['#3a4c80', '#0e0e14', 0.85], amb: 0.1,
    },
    // landform: the loop on the south face of the summit ridge (falls away north of the top straight),
    // knolls inside the loop so the road is cut in on the inside
    land: {
      axis: [0, 1], snow: 960, seed: 11,
      base: [[-100, 620], [150, 670], [300, 715], [400, 748], [440, 760], [470, 768], [500, 766], [540, 761], [580, 756],
        [620, 749], [660, 745], [700, 741], [760, 733], [850, 722], [1000, 705], [1300, 688], [1700, 700]],
      relief: [[0, 60], [300, 30], [450, 15], [750, 15], [1000, 35], [1600, 70]],
      peaks: [[85, 552, 26, 45], [140, 528, 20, 38], [-12, 625, 18, 40]],
    },
    points: [
      [-50, 705, 50],
      [140, 710, 40], [140, 660, 40],
      [40, 648, 40], [40, 598, 40],
      [190, 562, 45], [160, 472, 60], [-50, 535, 150],
    ],
  }, [ // elevation [s m, y m]: bottom straight, climb with eased hairpins, the top, the plunge back down
    [0, 748.5], [80, 745.5], [185, 745], [274, 748.5], [326, 753.3], [408, 756.8], [492, 764.5], [560, 770.5], [612, 771.5],
    [908, 748.5],
  ]),
];
