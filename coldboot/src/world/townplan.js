// Port Zarya, Alaska — pop. 1,140, on the Bering Strait. Metres; +X east,
// −Z north, Y up. Origin: the middle of Church Square. The sea is south (+Z)
// and west; Kettle Hill and the Dome are north-east; the airstrip is east.
//
// Every entry: { id, type, x, z, rot (radians, 0 = front door faces +Z/south),
//   style?: {...generator options}, name? (sign), owner? (cast id) }
// Building generators live in world/buildings/ (one per type).

export const TOWN = {
  name: 'Port Zarya',
  seaLevel: 0,
  // ground height (metres) is the terrain's job (world/terrain.js); the town
  // itself sits on a gently rising shelf 2–9 m above the sea.
  streets: [
    { id: 'front', name: 'Front St', pts: [[-260, 62], [-120, 64], [0, 62], [120, 60], [230, 70]], width: 9 },
    { id: 'main', name: 'Main St', pts: [[0, 62], [0, 20], [0, -20], [0, -150]], width: 10 },
    { id: 'second', name: '2nd Ave', pts: [[-200, 25], [-60, 22], [0, 20], [90, 22], [180, 28]], width: 8 },
    { id: 'third', name: '3rd Ave', pts: [[-190, -60], [-60, -62], [0, -60], [110, -58]], width: 8 },
    { id: 'church', name: 'Church Sq', pts: [[-40, -10], [40, -10]], width: 8 },
    { id: 'airport', name: 'Airport Rd', pts: [[120, 60], [200, 20], [300, -10], [330, -30]], width: 8 },
    { id: 'dome', name: 'Kettle Hill Rd', pts: [[110, -58], [220, -200], [380, -420], [480, -640], [500, -700]], width: 7 },
    { id: 'cannery', name: 'Cannery Rd', pts: [[120, 60], [170, 90]], width: 8 },
    { id: 'shore', name: 'Shore Rd', pts: [[-120, 64], [-150, 80], [-230, 120], [-380, 210], [-500, 290]], width: 6 },
    { id: 'lake', name: 'Lake Trail', pts: [[-60, -62], [-150, -200], [-260, -380], [-300, -470]], width: 5, dirt: true },
  ],
  buildings: [
    // --- the square
    { id: 'church', type: 'church', x: 0, z: -34, rot: 0, name: 'Holy Transfiguration' },
    { id: 'koshkin', type: 'generalStore', x: 34, z: -2, rot: -Math.PI / 2, name: "KOSHKIN'S GENERAL MDSE.", owner: 'koshkin' },
    { id: 'northstar', type: 'cornerStore', x: -34, z: 2, rot: Math.PI / 2, name: 'NORTHSTAR 24' },
    { id: 'hall', type: 'communityHall', x: -40, z: -36, rot: 0, name: 'Parish Hall' },
    // --- Main St & 3rd Ave
    { id: 'cityhall', type: 'cityHall', x: 26, z: -68, rot: -Math.PI / 2, name: 'CITY OF PORT ZARYA' },
    { id: 'police', type: 'police', x: 30, z: -96, rot: -Math.PI / 2, name: 'POLICE' },
    { id: 'post', type: 'postOffice', x: -24, z: -70, rot: Math.PI / 2, name: 'U.S. POST OFFICE  99790' },
    { id: 'clinic', type: 'clinic', x: 62, z: -24, rot: 0, name: 'Port Zarya Clinic' },
    { id: 'school', type: 'school', x: -36, z: -128, rot: Math.PI / 2, name: 'Port Zarya School' },
    { id: 'radio', type: 'radioStation', x: -96, z: -40, rot: 0, name: 'KZRY 88.9' },
    // --- Front St (the shore)
    { id: 'diner', type: 'diner', x: 30, z: 52, rot: Math.PI, name: 'MIDNIGHT SUN DINER', owner: 'dolly' },
    { id: 'bar', type: 'bar', x: -62, z: 54, rot: Math.PI, name: 'THE RUSTY ANCHOR', owner: 'lou' },
    { id: 'hardware', type: 'hardware', x: 92, z: 44, rot: Math.PI, name: 'BRUBAKER HARDWARE & FUEL', owner: 'hank' },
    { id: 'fueltanks', type: 'fuelTanks', x: 128, z: 36, rot: 0 },
    { id: 'cannery', type: 'cannery', x: 175, z: 108, rot: Math.PI, name: 'ZARYA SEAFOODS' },
    { id: 'harbor', type: 'harbor', x: -10, z: 84, rot: 0, name: 'Small Boat Harbor' },   // its shore end (local z −20) meets the beach
    { id: 'cabin', type: 'cabin', x: -150, z: 92, rot: Math.PI * 0.85, owner: 'player' },
    // --- out of town
    { id: 'terminal', type: 'terminal', x: 335, z: -14, rot: Math.PI, name: 'PORT ZARYA  PZY' },
    { id: 'hangar', type: 'hangar', x: 380, z: -6, rot: Math.PI, name: 'TOLLIVER AIR', owner: 'wade' },
    { id: 'dome', type: 'dome', x: 500, z: -710, rot: Math.PI * 0.25, name: 'NORTHSTAR DYNAMICS' },
    { id: 'lighthouse', type: 'lighthouse', x: -505, z: 300, rot: 0 },
    { id: 'cemetery', type: 'cemetery', x: 44, z: -150, rot: 0 },
  ],
  // residential lots along the side streets (generated houses)
  houseLots: [
    // [x, z, rot, owner?]
    [-110, 30, Math.PI], [-80, 28, Math.PI], [-150, 32, Math.PI], [-180, 36, Math.PI],
    [-110, 8, 0], [-80, 6, 0], [-150, 10, 0], [60, 8, 0], [92, 8, 0], [124, 12, 0], [150, 16, 0],
    [60, 32, Math.PI], [92, 32, Math.PI], [124, 34, Math.PI], [156, 40, Math.PI],
    [-70, -50, Math.PI], [-110, -48, Math.PI], [-140, -50, Math.PI], [-170, -52, Math.PI],
    [-70, -74, 0], [-110, -76, 0], [-140, -76, 0], [60, -48, Math.PI], [90, -46, Math.PI],
    [60, -78, 0], [92, -76, 0], [-60, -100, Math.PI / 2], [-90, -104, 0], [70, -112, -Math.PI / 2],
    [-200, 60, Math.PI * 0.9], [-230, 80, Math.PI * 0.8], [-100, 80, Math.PI], [70, 80, Math.PI], [110, 78, Math.PI],
    [18, -120, -Math.PI / 2], [-18, -100, Math.PI / 2], [140, -30, 0], [170, -20, Math.PI], [-190, -20, 0], [-220, 0, Math.PI / 2],
  ],
  // Bely Mys, Chukotka (prologue + finale) — its own little map
  belyMys: {
    warehouse: { x: 0, z: 0, rot: 0 },
  },
};

// Building types the generators must provide (world/buildings/<type>.js):
export const BUILDING_TYPES = [
  'church', 'generalStore', 'cornerStore', 'communityHall', 'cityHall', 'police', 'postOffice', 'clinic', 'school',
  'radioStation', 'diner', 'bar', 'hardware', 'fuelTanks', 'cannery', 'harbor', 'cabin', 'house', 'terminal', 'hangar',
  'dome', 'lighthouse', 'cemetery',
];
