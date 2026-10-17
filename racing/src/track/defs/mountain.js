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
    blurb: 'Cedar-lined pass falling off the ridge at sundown: flat out along the crest, five stacked hairpins, the rock shed, then esses down the spur to the valley.',
    width: 10, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.55, startS: 110, finishPad: 130,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt',
    atmos: { sun: { color: '#ffb07a', i: 1.0, el: 0.07, az: 1.45 } }, // sets over the valley (+z)
    // scenery: rock shed span, summit lookout, extra lamps, power-line spans (meters along the road)
    shed: [2465, 2605], viewpoint: { s: 125, len: 76, depth: 18 },
    lamps: [104, 4040, 4140], poles: [[180, 330], [400, 560], [3480, 4180]],
    // landform: height profile across the fall line (z), noise relief, peaks (two knolls above the shed)
    land: {
      axis: [0, 1], snow: 1010, seed: 47,
      base: [[-900, 1150], [-500, 880], [-250, 720], [-120, 645], [-40, 619], [40, 597], [120, 581], [200, 564], [280, 553],
        [360, 547], [440, 538], [520, 516], [640, 514], [760, 517], [880, 518], [960, 497], [1100, 480], [1300, 470],
        [1500, 470], [1750, 505], [2000, 600], [2250, 780]],
      relief: [[-600, 70], [-200, 40], [-40, 24], [150, 28], [450, 24], [800, 15], [1100, 12], [1600, 30], [2000, 60]],
      peaks: [[250, -800, 260, 380], [1100, -720, 220, 320], [-450, -650, 200, 320], [1750, -500, 160, 280],
        [745, 318, 28, 60], [655, 340, 30, 62]],
      town: [[700, 1100, 110, 50], [1250, 1080, 90, 34], [380, 1170, 140, 70], [1530, 1120, 70, 24], [960, 1220, 90, 30]],
    },
    // lookout straight -> ridge run (R/L/R/L) -> five stacked hairpins -> traverse through the shed
    // -> sweeper round the spur -> linked esses down it -> valley sweepers -> finish straight
    points: [
      [-120, -40, 0], [140, -55, 110], [320, -10, 80], [470, -65, 70], [640, -25, 110], [920, -40, 160],
      [1120, -12, 40], [1120, 33, 40],
      [910, 60, 40], [910, 105, 40],
      [1090, 128, 40], [1090, 173, 40],
      [910, 196, 40], [910, 241, 40],
      [1090, 264, 40], [1090, 309, 40],
      [820, 370, 200], [560, 430, 160], [400, 520, 90],
      [470, 610, 60], [390, 700, 55], [470, 790, 60], [400, 880, 70],
      [560, 950, 80], [720, 900, 70], [880, 970, 90], [1060, 940, 120], [1330, 960, 0],
    ],
  }, [ // elevation [s m, y m]: lookout, ridge run, five hairpins (legs 9%, eased turns), traverse, spur esses, valley run
    [0, 640], [150, 639.5], [1110, 621], [1224, 611], [1310, 608], [1466, 594], [1550, 591], [1676, 579.6], [1760, 576.6],
    [1887, 565.2], [1970, 562.2], [2097, 550.8], [2180, 547.8], [2700, 526], [3420, 505], [3950, 496], [4209, 493],
  ]),
  withProfile({
    id: 'summit', name: 'SUMMIT LOOP', env: 'mountain', time: 'night', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'A fogbound lap of the peak: three switchbacks up, the lookout and shrine at the top, then a sweeping plunge back down.',
    width: 9.5, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.35, startS: 800,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt', fogD: 0.0042,
    viewpoint: { s: 812, len: 70, depth: 18 }, lamps: [120, 790], lampColor: '#d6e4ff',
    poles: [[40, 200], [930, 1100]],
    // hazy moonlit night: no stars, blue-gray fog that the sky fades into
    atmos: {
      sky: ['#06080f', '#111725', '#2a3242'], glowHorizon: '#3c4456', fog: '#252c3a', stars: false,
      sun: { color: '#9fb4ff', i: 0.5, el: 0.62, az: 2.5 }, hemi: ['#3a4c80', '#0e0e14', 0.85], amb: 0.1,
    },
    // landform: the loop on the south face of the summit ridge (falls away north of the top straight)
    land: {
      axis: [0, 1], snow: 960, seed: 141,
      base: [[-100, 620], [150, 670], [300, 712], [400, 735], [450, 750], [500, 762], [525, 766], [550, 768], [600, 764],
        [650, 758], [700, 752], [730, 750], [800, 740], [1000, 705], [1300, 688], [1700, 700]],
      relief: [[0, 60], [300, 30], [450, 15], [750, 15], [1000, 35], [1600, 70]],
    },
    // bottom straight E -> three switchbacks up the face (L, R, L) -> top straight W past the lookout
    // -> plunge: left, right flick, tightening left -> bottom straight
    points: [
      [-200, 722, 60],
      [60, 725, 40], [60, 680, 40],
      [-120, 660, 40], [-120, 615, 40],
      [60, 595, 40], [60, 550, 40],
      [-200, 527, 70], [-250, 625, 90], [-330, 660, 70], [-300, 730, 60],
    ],
  }, [ // elevation [s m, y m]: level bottom straight, climb with eased hairpins, the top, the plunge back down
    [0, 746.5], [220, 746.5], [310, 750.5], [436, 761.8], [520, 764.8], [646, 776.1], [730, 779.1], [800, 779],
    [916, 775.5], [1244, 748.5], [1302, 746.5],
  ]),
  withProfile({
    id: 'ridgeline', name: 'RIDGELINE CLIMB', env: 'mountain', time: 'day', weather: 'dry', type: 'sprint',
    blurb: 'Hill climb from the valley floor to the ridge on a clear day: fast sweepers low down, four hairpins up the face, then a narrow, twisting ridge road.',
    width: 9.5, lanes: 2, center: 'yellow-dashed', edge: 'white', bank: 0.5, startS: 110, finishPad: 120,
    shoulder: 1.5, wall: 1.2, shoulderSurface: 'road', offSurface: 'dirt',
    // scenery: ridge-top lookout past the finish, lamps at both ends, power lines along the valley road
    viewpoint: { s: 4040, len: 70, depth: 18 }, lamps: [96, 3960], poles: [[150, 700], [900, 1300]],
    // landform: valley floor along x, the face rising north (-z) to the ridge, rising gently east; snowy peaks beyond
    land: {
      axis: [0, -1], tilt: [1, 0, 0.012], snow: 950, seed: 321,
      base: [[-900, 700], [-500, 520], [-250, 440], [-100, 425], [-40, 422], [0, 428], [40, 439], [80, 452], [120, 464],
        [160, 480], [200, 494], [240, 506], [280, 520], [320, 531], [360, 535], [400, 533], [440, 532], [520, 512],
        [700, 488], [1000, 560], [1300, 720]],
      relief: [[-900, 60], [-300, 25], [-60, 12], [100, 25], [300, 22], [420, 14], [600, 35], [1200, 70]],
      peaks: [[400, -1300, 280, 400], [1500, -1250, 300, 420], [2400, -1100, 220, 350], [-600, -1000, 200, 350]],
    },
    // valley sweepers E -> hairpin into the face -> four switchbacks -> exit north onto the ridge
    // -> narrow ridge road (R/L esses) -> finish straight past the lookout
    points: [
      [-700, 40, 0], [-420, 30, 130], [-220, 100, 110], [0, 20, 120], [220, 90, 130], [440, 10, 110], [640, 60, 100],
      [900, 20, 40], [900, -25, 40],
      [600, -50, 40], [600, -95, 40],
      [880, -120, 40], [880, -165, 40],
      [600, -190, 40], [600, -235, 40],
      [860, -270, 80], [920, -400, 60, undefined, 4],
      [1090, -360, 45, undefined, 4], [1230, -440, 40, undefined, 4], [1390, -380, 45, undefined, 4],
      [1540, -460, 40, undefined, 4], [1700, -400, 55, undefined, 4], [1960, -430, 0, undefined, 4],
    ],
  }, [ // elevation [s m, y m]: valley floor, eased hairpins with 9% legs, exit, rolling ridge road
    [0, 420], [250, 421], [1560, 436], [1600, 437], [1705, 441], [1940, 462.4], [2032, 466], [2253, 486], [2342, 489.5],
    [2561, 509.2], [2650, 512.8], [2840, 528.8], [3050, 541.4], [3250, 548], [3400, 546], [3560, 556], [3700, 553],
    [3860, 562], [4108, 566],
  ]),
];
