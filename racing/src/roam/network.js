// FREE ROAM — the map of Port Halcyon as a road network. Every road in the
// game is a region; they hang together in one big ring, joined by tunnels:
// a circuit has a side road off one of its straights running to a portal
// with two bores (back along the ring / on along the ring), a point-to-point
// road has a single-bore portal at each end. Driving into a bore loads the
// region on the other side and you come out of its tunnel at the same speed.
import { TRACK_BY_ID } from '../track/tracks.js';

/** The ring, in order (reverse layouts are the same streets: not regions). */
const RING = [
  'downtown', 'oldtown', 'chinatown', 'harbor', 'shipyard', 'pier9', 'bayshore', 'interstate',
  'route99', 'redrock', 'ghosttown', 'drylake', 'ridgeline', 'summit', 'kaido', 'crestwood',
  'ironwood', 'redwood', 'skyline', 'uptown',
];

/**
 * Hand placement where the automatic site search would pick badly:
 * junction: { s (along the lap), side (+1 left, −1 right of the race direction) }.
 * ends: which end of a point-to-point road faces the next region on the ring.
 */
const PLACE = {
  uptown: { flip: true },
  // (the search would take the pit straight, through the grandstand)
  redwood: { junction: { s: 1045, side: 1 } },
};

/** Map positions (0..1 across the world map) — the city in the middle, the
 *  docks and the bay to the south, the desert east, the mountains north,
 *  the raceways north-west. */
export const MAP_POS = {
  downtown: [0.47, 0.5], oldtown: [0.39, 0.57], chinatown: [0.31, 0.63], harbor: [0.2, 0.74],
  shipyard: [0.3, 0.84], pier9: [0.42, 0.86], bayshore: [0.58, 0.82], interstate: [0.71, 0.66],
  route99: [0.83, 0.54], redrock: [0.92, 0.42], ghosttown: [0.88, 0.27], drylake: [0.76, 0.2],
  ridgeline: [0.64, 0.14], summit: [0.53, 0.09], kaido: [0.42, 0.14], crestwood: [0.29, 0.18],
  ironwood: [0.16, 0.27], redwood: [0.13, 0.42], skyline: [0.27, 0.42], uptown: [0.38, 0.38],
};

export const DISTRICT_NAMES = { city: 'THE CITY', docks: 'THE DOCKS', highway: 'THE HIGHWAYS', circuit: 'THE RACEWAYS', mountain: 'THE MOUNTAINS', desert: 'THE DESERT' };

/** The ring as it exists in this build (tracks still missing are skipped). */
export function ring() {
  return RING.filter((id) => TRACK_BY_ID[id]);
}

/**
 * Region links for a track: { prev, next } — the regions either side on the
 * ring. Exits are named 'prev' and 'next' everywhere: a circuit's junction
 * has one bore of each, a point-to-point road has 'prev' at one end and
 * 'next' at the other.
 */
export function links(id) {
  const R = ring();
  const k = R.indexOf(id);
  if (k < 0) return null;
  return { prev: R[(k - 1 + R.length) % R.length], next: R[(k + 1) % R.length] };
}

/** Which exit on `to` you arrive through when leaving `from` by `exit`. */
export function arrival(from, exit) {
  const L = links(from);
  const to = L[exit];
  return { track: to, exit: exit === 'next' ? 'prev' : 'next' };
}

export function placement(id) { return PLACE[id] || {}; }

/** A region's name for tight spots (the radar): 'OLD TOWN', 'ROUTE 99', 'HARBOR'. */
const GENERIC = new Set(['LOOP', 'RUN', 'DOCKS', 'EXPRESSWAY', 'ROUTE', 'RACEWAY', 'HILLS', 'PARK', 'PASS', 'CLIMB', 'CANYON', 'DRAG']);
export function shortName(name) {
  const w = name.split(' ');
  if (w.length > 1 && GENERIC.has(w[w.length - 1])) w.pop();
  return w.join(' ');
}

export function isRegion(id) { return ring().includes(id); }
