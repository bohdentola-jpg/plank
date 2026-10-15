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
    blurb: 'A tight grand prix loop in the redwoods: brutal hairpin, esses down into the valley, a long sweeper home.',
    width: 14, lanes: 1, center: 'none', edge: 'white', startS: 180, wall: 10, shoulder: 1.6, worn: 0.25, asphalt: '#36373b',
    scenery: 'redwood', fogD: 0.0006,
    // pit straight E -> hairpin -> downhill left -> esses (R/L) through the valley -> crest right
    // -> back straight -> double-apex sweeper -> final right
    points: [
      [0, 0, 68], [340, 0, 22], [340, 46, 22], [270, 65, 50], [264, 140, 68],
      [205, 182, 68], [195, 261, 42], [55, 262, 100], [-12, 195, 100],
    ],
    elevation: profile(1037, [
      [130, 0], [253, 0], [363, 1], [422, 0.6], [477, -2.6], [546, -5.5], [614, -2], [675, 2.4], [715, 2.7],
      [756, 1.2], [816, 0.2], [906, -0.4],
    ]),
  },
  {
    id: 'crestwood', name: 'CRESTWOOD HILLS', env: 'circuit', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Golden hills at sundown: a blind crest, a hairpin, the corkscrew plunge and a banked carousel.',
    width: 12, lanes: 1, center: 'none', edge: 'white', startS: 150, wall: 8, shoulder: 1.4, worn: 0.5, asphalt: '#424247',
    scenery: 'crestwood', fogD: 0.001,
    // extra banking through the carousel: [sFrom, sTo, radians] (applied by env/circuit.js)
    bankBoost: [[625, 770, 0.07]],
    // main straight N up to the blind crest kink -> hairpin -> right -> climb -> corkscrew (L/R plunge)
    // -> banked carousel -> bottom straight -> final left
    points: [
      [0, 0, 48], [0, -265, 150], [-37, -334, 22], [-78, -320, 22], [-81, -240, 40],
      [-171, -240, 26], [-173, -188, 28], [-253, -184, 45], [-263, -105, 45],
    ],
    elevation: profile(933, [
      [46, -5], [130, -4.5], [200, -2.6], [256, 1], [296, 3.2], [336, 2.2], [372, 0.4], [399, -0.4], [440, 1.4],
      [480, 4.4], [515, 7.2], [538, 8.4], [552, 8.2], [588, 3.8], [635, 1], [690, -0.2], [750, -1.2], [860, -4],
      [920, -4.9],
    ]),
  },
];
