// PORT HALCYON — the shape of the land: the world's bounds, the coast and
// the bay, Halcyon Point (the island), Halcyon Lake and the river down to
// the harbor, the terrain zones that give each part of the map its own
// landform, and the districts (who builds what, and what the map calls it).
//
// Frame: x east, z SOUTH (north is −z), y up, meters. Sea level y = 0.

export const BOUNDS = { x0: -6200, z0: -5600, x1: 6200, z1: 4400 };

/** Everything inside is land; outside it is the bay / the sea. */
export const LAND = [
  [-6200, -5600], [6200, -5600], [6200, 4400], [3500, 4400],
  // east shore of the bay: cliffs (Bayshore)
  [3360, 3800], [3150, 3200], [2960, 2660], [2810, 2170], [2630, 1830],
  // Pier 9 beach
  [2350, 1720], [2000, 1770], [1650, 1880], [1300, 1960], [950, 1990], [600, 1965],
  // the warehouse waterfront, Chinatown's sea wall, the river mouth
  [250, 1905], [-150, 1885], [-550, 1960], [-900, 2080], [-1050, 2190], [-1180, 2280],
  // the container terminal's quay, the shipyard
  [-1500, 2360], [-2000, 2420], [-2700, 2440], [-3200, 2520], [-3700, 2620],
  [-4300, 2700], [-4900, 2720], [-5500, 2660], [-6200, 2620],
];

/** Halcyon Point: the island in the bay (lighthouse at its south tip). */
export const ISLAND = [
  [1150, 3150], [1500, 2985], [1950, 3020], [2250, 3200], [2220, 3440],
  [1880, 3590], [1580, 3790], [1320, 3720], [1100, 3460],
];

/** Stretches of coast that are cliffs (no beach): land stays high to the water. */
export const CLIFFS = [
  { poly: [[2450, 1600], [3700, 1600], [3700, 4400], [2700, 4400], [2700, 2000]], top: 46 },
  { poly: [[1900, 2950], [2400, 2950], [2400, 3700], [1900, 3700]], top: 30 },
];

/** Halcyon Lake (surface y = LAKE_Y), dammed at its south-east outlet. */
export const LAKE_Y = 52;
export const LAKE = [
  [-4450, -1350], [-4300, -1900], [-3950, -2350], [-3450, -2500], [-2950, -2450], [-2550, -2150],
  [-2350, -1700], [-2300, -1300], [-2450, -1080], [-2800, -1010], [-3300, -1080], [-3900, -1150],
];
export const DAM = { a: [-2530, -1010], b: [-2330, -1090], crest: 58, foot: 27 };

/** The Halcyon River: from the foot of the dam through Old Town to the sea. */
export const RIVER = {
  width: 46,
  // down a gorge from the dam's foot, then dead straight between Old Town's
  // embankments (the town grew along it), then out through the harbor
  path: [
    [-2420, -985], [-2330, -760], [-2190, -560],
    [-1979, -133], [-1819, 316], [-1596, 738], [-1420, 1180],
    [-1330, 1500], [-1240, 1820], [-1150, 2120], [-1090, 2460],
  ],
  // water level at each point: rapids below the dam, then slow through Old
  // Town between its embankments, and out to the sea
  ys: [25, 18.5, 11.5, 5.2, 3.6, 3.0, 2.4, 1.8, 1.2, 0.7, 0.3],
};

/** Coast that is a quay wall (docks, sea walls) rather than a beach. */
export const QUAYS = [
  [[-5700, 2250], [-2750, 2250], [-2750, 2950], [-5700, 2950]],   // the shipyard
  [[-2750, 2150], [-1230, 2150], [-1230, 2700], [-2750, 2700]],   // the container terminal
  [[-1000, 1750], [650, 1750], [650, 2250], [-1000, 2250]],       // Chinatown's sea wall, The Works
];

/**
 * Terrain zones (applied in order, each blending toward its own shape over
 * `edge` metres outside its polygon). kinds:
 *   flat      y (+ a little noise `amp` at `scale`)
 *   slope     y0 at the polygon's `from` side rising to y1 along dir
 *   hills     y + rolling noise amp/scale
 *   mountains y + ridged noise amp/scale (peaks)
 *   mesas     y + terraced noise (buttes with flat tops)
 */
export const ZONES = [
  // the low coastal plain everything else sits on
  { id: 'plain', kind: 'hills', poly: [[-6200, -1800], [6200, -1800], [6200, 4400], [-6200, 4400]], y: 14, amp: 12, scale: 900, edge: 600 },
  // the city: flat ground for streets
  // west: farmland, the ironworks, the lake's hills, the redwoods
  { id: 'farm', kind: 'hills', poly: [[-6200, -1300], [-2350, -1300], [-2350, 1650], [-6200, 1650]], y: 22, amp: 16, scale: 700, edge: 300 },
  { id: 'ironworks', kind: 'flat', poly: [[-4300, -1000], [-3100, -1000], [-3100, -380], [-4300, -380]], y: 56, amp: 0.8, scale: 260, edge: 240 },
  { id: 'lakehills', kind: 'hills', poly: [[-4900, -2900], [-1900, -2900], [-1900, -900], [-4900, -900]], y: 70, amp: 34, scale: 520, edge: 380 },
  { id: 'redwoods', kind: 'hills', poly: [[-6200, -5600], [-4300, -5600], [-4300, -1500], [-6200, -1500]], y: 110, amp: 70, scale: 700, edge: 500 },
  { id: 'crestwood', kind: 'hills', poly: [[-2700, -3100], [-950, -3100], [-950, -1750], [-2700, -1750]], y: 92, amp: 30, scale: 420, edge: 380 },
  // north: the mountains
  { id: 'range', kind: 'mountains', poly: [[-4300, -5600], [4800, -5600], [4800, -2500], [-4300, -2500]], y: 260, amp: 380, scale: 1500, edge: 900 },
  { id: 'summit', kind: 'peak', x: 1250, z: -4700, r: 1300, h: 760 },
  { id: 'ridge', kind: 'ridge', path: [[1500, -3700], [2500, -3500], [3400, -3250], [4300, -2900]], width: 520, h: 330 },
  { id: 'kaido', kind: 'hills', poly: [[-1200, -4200], [500, -4200], [500, -1750], [-1200, -1750]], y: 160, amp: 90, scale: 520, edge: 500 },
  // the raceways in the hills sit on their own rolling ground (the range must
  // not lift a grand prix circuit by hundreds of metres)
  { id: 'crestwoodring', kind: 'hills', poly: [[-2450, -3200], [-1000, -3200], [-1000, -2000], [-2450, -2000]], y: 150, amp: 34, scale: 300, edge: 280 },
  // the lake's north shore: a long slope up from the water to the range
  // (the North Shore Road climbs along it instead of hitting the massif)
  { id: 'northshore', kind: 'slope', poly: [[-4750, -2950], [-2050, -2950], [-2050, -2150], [-4750, -2150]], y0: 72, y1: 200, dir: [0, -1], edge: 260 },
  { id: 'redwoodring', kind: 'hills', poly: [[-5700, -4000], [-4350, -4000], [-4350, -2850], [-5700, -2850]], y: 125, amp: 22, scale: 340, edge: 320 },
  // east: the plains out of town, then the desert
  { id: 'plains', kind: 'hills', poly: [[950, -1750], [2900, -1750], [2900, 1650], [950, 1650]], y: 22, amp: 18, scale: 800, edge: 400 },
  { id: 'desert', kind: 'mesas', poly: [[2900, -2600], [6200, -2600], [6200, 4400], [3300, 4400], [3300, 1300], [2900, 1300]], y: 86, amp: 120, terrace: 26, scale: 650, edge: 600 },
  { id: 'drylake', kind: 'flat', poly: [[4700, -560], [6200, -560], [6200, 1300], [4700, 1300]], y: 64, amp: 0.15, scale: 400, edge: 320 },
  { id: 'ghostflat', kind: 'flat', poly: [[3300, 850], [4300, 850], [4300, 1800], [3300, 1800]], y: 92, amp: 2, scale: 200, edge: 260 },
  // the east shore stands high over the bay
  { id: 'bluffs', kind: 'hills', poly: [[2450, 1550], [3600, 1550], [3600, 4400], [2700, 4400]], y: 44, amp: 10, scale: 300, edge: 220 },
  { id: 'point', kind: 'hills', poly: ISLAND, y: 18, amp: 9, scale: 220, edge: 80 },
  // last: the town's own flat ground (nothing round it may lift it)
  { id: 'city', kind: 'flat', poly: [[-2350, -560], [1500, -560], [1500, 1700], [-2350, 1700]], y: 6, amp: 0.6, scale: 300, edge: 260 },
  { id: 'uptown', kind: 'slope', poly: [[-950, -1750], [950, -1750], [950, -560], [-950, -560]], y0: 7, y1: 34, dir: [0, -1], edge: 260 },
  { id: 'waterfront', kind: 'flat', poly: [[-5600, 1650], [2450, 1650], [2450, 2700], [-5600, 2700]], y: 3, amp: 0.2, scale: 200, edge: 120 },
];

/** Carved features applied after the zones. */
export const CARVES = [
  // Red Rock Canyon: a gorge through the mesas
  { id: 'redrock', kind: 'canyon', path: [[3900, -1300], [4250, -1650], [4650, -1850], [5050, -1750], [5300, -1400]], width: 120, depth: 70, floorNoise: 4 },
];

/**
 * Districts: what is built where. style → the district module that dresses
 * it (src/world/districts/<style>.js). The first district containing a point
 * owns it; `name` is what the map and the HUD call it.
 */
export const DISTRICTS = [
  { id: 'downtown', name: 'DOWNTOWN', style: 'downtown', poly: [[-700, -560], [720, -560], [720, 560], [-700, 560]] },
  { id: 'chinatown', name: 'CHINATOWN', style: 'chinatown', poly: [[-700, 560], [340, 560], [340, 1450], [-700, 1450]] },
  { id: 'works', name: 'THE WORKS', style: 'works', poly: [[340, 560], [1500, 560], [1500, 1720], [340, 1720]] },
  { id: 'oldtown', name: 'OLD TOWN', style: 'oldtown', poly: [[-2350, -560], [-700, -560], [-700, 1450], [-2350, 1450]] },
  { id: 'uptown', name: 'UPTOWN', style: 'uptown', poly: [[-950, -1750], [950, -1750], [950, -560], [-950, -560]] },
  { id: 'harbor', name: 'HARBOR DOCKS', style: 'harbor', poly: [[-2800, 1450], [-650, 1450], [-650, 2600], [-2800, 2600]] },
  { id: 'shipyard', name: 'THE SHIPYARD', style: 'shipyard', poly: [[-5700, 1650], [-2800, 1650], [-2800, 2900], [-5700, 2900]] },
  { id: 'pier9', name: 'PIER 9', style: 'pier9', poly: [[340, 1720], [2450, 1720], [2450, 2700], [340, 2700]] },
  { id: 'point', name: 'HALCYON POINT', style: 'point', poly: ISLAND },
  { id: 'bayshore', name: 'BAYSHORE', style: 'bayshore', poly: [[2450, 1300], [3400, 1300], [3600, 4400], [2450, 4400]] },
  { id: 'eastside', name: 'EASTSIDE', style: 'eastside', poly: [[720, -1750], [2900, -1750], [2900, 1300], [1500, 1300], [1500, 560], [720, 560]] },
  { id: 'redrock', name: 'RED ROCK CANYON', style: 'redrock', poly: [[3700, -2650], [5600, -2650], [5600, -1000], [3700, -1000]] },
  { id: 'drylake', name: 'DRY LAKE', style: 'drylake', poly: [[4700, -560], [6200, -560], [6200, 1300], [4700, 1300]] },
  { id: 'ghosttown', name: 'GHOST TOWN', style: 'ghosttown', poly: [[3200, 800], [4400, 800], [4400, 1900], [3200, 1900]] },
  { id: 'desert', name: 'ROUTE 99', style: 'desert', poly: [[2900, -2700], [6200, -2700], [6200, 4400], [3500, 4400], [3400, 1300], [2900, 1300]] },
  { id: 'summit', name: 'THE SUMMIT', style: 'summit', poly: [[200, -5600], [2600, -5600], [2600, -3950], [200, -3950]] },
  { id: 'ridgeline', name: 'RIDGELINE', style: 'ridgeline', poly: [[1300, -3950], [4800, -3950], [4800, -2700], [1300, -2700]] },
  { id: 'kaido', name: 'KAIDO PASS', style: 'kaido', poly: [[-1400, -4300], [1300, -4300], [1300, -1750], [-1400, -1750]] },
  { id: 'crestwood', name: 'CRESTWOOD HILLS', style: 'crestwood', poly: [[-2700, -3100], [-1400, -3100], [-1400, -1750], [-2700, -1750]] },
  { id: 'lake', name: 'HALCYON LAKE', style: 'lake', poly: [[-4700, -2900], [-2700, -2900], [-2200, -1750], [-2200, -560], [-4700, -900]] },
  { id: 'ironworks', name: 'IRONWOOD PARK', style: 'ironworks', poly: [[-4400, -1050], [-3050, -1050], [-3050, -330], [-4400, -330]] },
  { id: 'redwood', name: 'REDWOOD FOREST', style: 'redwood', poly: [[-6200, -5600], [-4300, -5600], [-4300, -1300], [-6200, -1300]] },
  { id: 'farmland', name: 'WEST FARMS', style: 'farmland', poly: [[-6200, -1300], [-2350, -1300], [-2350, 1650], [-6200, 1650]] },
  { id: 'wilds', name: 'THE NORTH WOODS', style: 'wilds', poly: [[-4300, -5600], [200, -5600], [200, -4300], [-1400, -4300], [-1400, -3100], [-4300, -3100]] },
  { id: 'highlands', name: 'HIGH DESERT', style: 'desert', poly: [[2600, -5600], [6200, -5600], [6200, -2700], [4800, -2700], [4800, -3950], [2600, -3950]] },
];

/** Where your garage is: The Works, door facing the street (heading out). */
export const GARAGE = { x: 700, z: 736, heading: Math.PI, district: 'works', name: 'YOUR GARAGE', street: 'FOUNDRY ST' };
