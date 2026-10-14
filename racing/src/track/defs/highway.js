// highway track definitions (see tracks.js for the format).
export default [
  {
    id: 'interstate', name: 'INTERSTATE 9', env: 'highway', time: 'night', weather: 'wet', type: 'sprint',
    blurb: 'test',
    width: 16, lanes: 4, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 150, finishPad: 150,
    traffic: true, trafficLanes: [6, 2, -2, -6],
    elevation: [[0, 0], [1000, 0], [1420, 14], [1800, 15], [2250, 16], [2650, 14.5], [2950, 14], [3350, 0], [4850, 0], [5080, 7.5], [5280, 7.5], [5520, 0], [6684, 0]].map(([s, y]) => [s / 6684, y]),
    points: [
      [0, 0], [0, 950, 1300], [-420, 1900, 900], [-180, 2800, 650], [380, 3500, 1000], [420, 4500, 800], [-80, 5300, 1500], [-200, 6300],
    ],
  },
  {
    id: 'skyline', name: 'SKYLINE EXPRESSWAY', env: 'highway', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'test',
    width: 12, lanes: 3, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 200,
    elevation: [[0, 18], [300, 18], [700, 22], [1000, 22], [1300, 17], [1800, 17], [2200, 21], [2700, 21], [3000, 16], [3700, 16], [4300, 20], [4700, 18], [5066, 18]].map(([s, y]) => [s / 5066, y]),
    traffic: true, trafficLanes: [4, 0, -4],
    points: [
      [0, 0], [0, 560, 260], [534, 560, 250], [825, 851, 260], [1533, 851, 270], [1533, 299, 380], [1367, 12, 300], [1367, -560, 280], [0, -560, 260],
    ],
  },
];
