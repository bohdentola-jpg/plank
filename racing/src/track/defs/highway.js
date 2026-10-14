// highway track definitions (see tracks.js for the format).
export default [
  {
    id: 'interstate', name: 'INTERSTATE 9', env: 'highway', time: 'night', weather: 'wet', type: 'sprint',
    blurb: 'test',
    width: 16, lanes: 4, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 150, finishPad: 150,
    traffic: true, trafficLanes: [6, 2, -2, -6],
    points: [
      [0, 0], [0, 950, 1300], [-420, 1900, 900], [-180, 2800, 650], [380, 3500, 1000], [420, 4500, 800], [-80, 5300, 1500], [-200, 6300],
    ],
  },
  {
    id: 'skyline', name: 'SKYLINE EXPRESSWAY', env: 'highway', time: 'dusk', weather: 'dry', type: 'circuit', laps: 3,
    blurb: 'test',
    width: 12, lanes: 3, center: 'dashed-white', edge: 'white', bank: 0.5, startS: 200,
    traffic: true, trafficLanes: [4, 0, -4],
    points: [
      [0, 450], [0, 900, 300], [450, 1250, 280], [1100, 1250, 320], [1450, 800, 300], [1300, 250, 380], [1500, -250, 300], [1000, -550, 350], [350, -350, 300], [0, 0, 300],
    ],
  },
];
