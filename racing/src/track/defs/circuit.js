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
    blurb: 'Grand-prix speedway in the redwoods: a kilometer of pit straight into a brutal hairpin, then the esses.',
    width: 14, lanes: 1, center: 'none', edge: 'white', startS: 420, wall: 10, shoulder: 1.6, worn: 0.25, asphalt: '#36373b',
    scenery: 'redwood',
    points: [
      [-340, 0, 75], [945, 0, 18], [719, 130, 110], [832, 326, 140], [709, 502, 140],
      [817, 687, 130], [693, 835, 160], [-98, 835, 22], [-118, 854, 22], [-536, 854, 140],
      [-536, 595, 170], [-340, 482, 75],
    ],
    elevation: profile(4276, [
      [0, 0], [1262, 0], [1330, 0.2], [1420, 1.2], [1566, 4], [1752, 8], [1948, 11], [2140, 12.5], [2308, 12],
      [2600, 8], [2900, 3], [3012, 1.5], [3060, 1], [3200, 0], [3450, -2.5], [3650, -3], [3850, -1.5], [4000, 0.4],
      [4150, 1.1], [4240, 0.3],
    ]),
  },
  {
    id: 'crestwood', name: 'CRESTWOOD HILLS', env: 'circuit', time: 'sunset', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'Golden hills at sundown: over the blind crest, down the corkscrew, up the banked carousel.',
    width: 12, lanes: 1, center: 'none', edge: 'white', startS: 270, wall: 8, shoulder: 1.4, worn: 0.5, asphalt: '#424247',
    scenery: 'crestwood', fogD: 0.001,
    // extra banking through the carousel: [sFrom, sTo, radians] (applied by env/circuit.js)
    bankBoost: [[3150, 3360 + 175, 0.07]],
    points: [
      [0, 470, 105], [0, -35, 320], [-159, -311, 70], [-435, -311, 140], [-613, -461, 60],
      [-842, -377, 30], [-836, -306, 34], [-1130, -136, 150], [-939, 194, 110], [-244, 194, 55],
      [-244, 470, 105],
    ],
    elevation: profile(3360, [
      [0, -8], [84, -5.5], [168, -3], [300, 1], [400, 5.5], [480, 9.1], [520, 10.1], [545, 10.2], [570, 9.7],
      [610, 7.7], [700, 3.5], [790, 1.0], [880, 0], [960, 1.5], [1100, 6.5], [1200, 10], [1300, 13.6], [1400, 17.4],
      [1500, 21.4], [1570, 24.2], [1610, 25], [1640, 24], [1680, 20.8], [1720, 17.1], [1770, 12.6], [1820, 8.3],
      [1880, 3.7], [1950, -0.8], [2030, -5], [2120, -9.2], [2268, -14.5], [2386, -17.2], [2550, -19.3], [2750, -20],
      [2960, -19.5], [3048, -18.7], [3162, -16], [3245, -13.2], [3328, -10],
    ]),
  },
];
