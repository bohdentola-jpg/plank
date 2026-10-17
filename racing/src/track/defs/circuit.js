// circuit track definitions (see tracks.js for the format).
// Elevation comes from [s (m), y] knots through a monotone cubic, sampled
// densely into def.elevation so grades stay smooth (no stair-steps).

function profile(len, knots, step = 12) {
  const n = knots.length;
  const K = (i) => {
    const w = Math.floor(i / n);
    const [s, y] = knots[((i % n) + n) % n];
    return [s + w * len, y];
  };
  const secant = (i) => { const a = K(i), b = K(i + 1); return (b[1] - a[1]) / (b[0] - a[0]); };
  const slope = (i) => {
    const d0 = secant(i - 1), d1 = secant(i);
    return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1);
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const [s0, y0] = K(i), [s1, y1] = K(i + 1);
    const h = s1 - s0, m0 = slope(i), m1 = slope(i + 1);
    for (let s = s0; s < s1 - 1e-6; s += step) {
      const t = (s - s0) / h, t2 = t * t, t3 = t2 * t;
      const y = (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
      out.push([(s % len) / len, Math.round(y * 100) / 100]);
    }
  }
  return out;
}

export default [
  {
    id: 'redwood', name: 'REDWOOD RACEWAY', env: 'circuit', time: 'day', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Grand prix racing in the redwoods: a long pit straight, a brutal hairpin, the esses down into the valley and a climb back to the sweepers.',
    width: 14, lanes: 1, center: 'none', edge: 'white', startS: 160, wall: 10, shoulder: 1.6, worn: 0.25, asphalt: '#36373b',
    scenery: 'redwood', fogD: 0.0006,
    // pit straight E -> brutal hairpin -> downhill left -> esses (R/L/R/L) through the redwoods -> valley right
    // -> level back straight W on the valley floor -> heavy right -> climb through a left-right flick
    // -> double-apex sweeper onto the pit straight
    points: [
      [0, 0, 70], [400, 0, 22], [400, 46, 22], [292, 65, 50], [285, 140, 60], [225, 175, 55], [225, 245, 60],
      [171, 290, 70], [155, 378, 45], [-137, 300, 32], [-111, 204, 45], [-124, 155, 45], [-90, 63, 90],
    ],
    elevation: profile(1508.5, [
      [20, 0], [300, 0.5], [430, 2], [500, 1.2], [580, -1.5], [690, -5], [790, -7.2], [870, -8], [1165, -8],
      [1250, -4.2], [1320, -0.6], [1365, 0.4], [1440, 0],
    ]),
  },
  {
    id: 'crestwood', name: 'CRESTWOOD HILLS', env: 'circuit', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Golden hills at sundown: a blind crest, the hairpin, a long climb to the corkscrew plunge and the banked carousel.',
    width: 12, lanes: 1, center: 'none', edge: 'white', startS: 140, wall: 8, shoulder: 1.4, worn: 0.5, asphalt: '#424247',
    scenery: 'crestwood', fogD: 0.001,
    // extra banking through the carousel: [sFrom, sTo, radians] (applied by env/circuit.js)
    bankBoost: [[915, 1095, 0.07]],
    // main straight N up to the blind crest kink -> hairpin -> tight right -> back straight -> left-right sweepers
    // -> climb -> corkscrew (L/R plunge) -> banked carousel -> kink -> bottom straight -> final left
    points: [
      [0, 0, 48], [0, -300, 150], [-56, -420, 22], [-97, -405, 22], [-79, -338, 45], [-229, -325, 70], [-266, -260, 50],
      [-366, -260, 26], [-375, -210, 28], [-438, -194, 50], [-458, -137, 50], [-420, -91, 50], [-360, -96, 120],
    ],
    elevation: profile(1431.2, [
      [40, -6], [140, -5], [230, -1.5], [315, 3.5], [380, 1.8], [470, 0.5], [550, 1], [640, 2.5], [750, 6], [835, 12],
      [868, 11], [950, 3], [1010, 0.2], [1080, -1.5], [1200, -6],
    ]),
  },
  {
    id: 'ironwood', name: 'IRONWOOD PARK', env: 'circuit', time: 'overcast', weather: 'wet', type: 'circuit', laps: 3,
    blurb: 'Parkland grand prix on a wet, grey afternoon: fast sweepers, a long back straight, a flat-out kink over the crest, then a hairpin into the stadium.',
    width: 13, lanes: 1, center: 'none', edge: 'white', startS: 140, wall: 9, shoulder: 1.5, worn: 0.35, asphalt: '#3a3b3f',
    scenery: 'redwood', fogD: 0.0011,
    // main straight E -> fast right -> left -> long double-apex right -> level back straight W -> flat-out kink
    // over a crest -> downhill into the hairpin -> stadium: left, right-left, final right in front of the stands
    points: [
      [0, 0, 40], [340, 0, 70], [374, 94, 90], [456, 132, 70], [477, 250, 55], [97, 250, 260], [-96, 302, 22],
      [-108, 258, 22], [-35, 225, 30], [-35, 165, 35], [0, 129, 35],
    ],
    elevation: profile(1500.7, [
      [30, 0], [200, 0], [355, -2], [450, -3.5], [540, -2], [650, 0], [960, 0], [1010, 2.4], [1060, 2.6], [1150, 0.4],
      [1200, 0], [1300, 0.2], [1420, 0],
    ]),
  },
];
