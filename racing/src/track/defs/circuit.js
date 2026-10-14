// circuit track definitions (see tracks.js for the format).
export default [
  {
    id: 'smoketest', name: 'SMOKE TEST', env: 'circuit', time: 'day', weather: 'dry', type: 'circuit', laps: 3,
    width: 14, center: 'none', edge: 'white', startS: 100, wall: 8,
    points: [[0, 0, 40, 0], [0, 600, 60, 12], [400, 700, 50, 20], [600, 300, 80, 6], [300, -100, 60, -4]],
  },
];
