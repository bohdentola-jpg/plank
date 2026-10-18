// Places to find in PORT HALCYON: every landmark the map's areas name and
// every one the districts' plans add (some of them hidden: off the main
// roads, up a dirt track, under a bridge). Drive close and it's found: a
// message, a sound, and it goes on the map, where it's also somewhere you
// can fast travel to. Found places are kept in the browser.
import { MAP } from './map/index.js';
import { roadPointNear } from './travel.js';

const KEY = 'mf_roam_found';

let FOUND = null;
function found() {
  if (!FOUND) {
    try { FOUND = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { FOUND = new Set(); }
  }
  return FOUND;
}

/** Every place there is (the map's and the districts'), by id. */
export function allPlaces(districts) {
  const out = new Map();
  for (const m of MAP.landmarks || []) out.set(m.id, { r: 110, ...m });
  for (const m of districts?.landmarks || []) if (m.id && !out.has(m.id)) out.set(m.id, { r: 90, ...m });
  return [...out.values()];
}

export const discover = {
  has(id) { return found().has(id); },
  count() { return found().size; },
  add(id) {
    found().add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...found()])); } catch { /* private mode */ }
  },
  reset() { FOUND = new Set(); try { localStorage.removeItem(KEY); } catch { /* */ } },
};

/**
 * Watches the car for places coming into reach. tick(x, z, dt) → the place
 * just found (or null).
 */
export class Discoverer {
  constructor(districts, net) {
    this.places = allPlaces(districts);
    this.net = net;
    this.t = 0;
  }
  tick(x, z, dt) {
    this.t += dt;
    if (this.t < 0.4) return null;
    this.t = 0;
    for (const p of this.places) {
      if (discover.has(p.id)) continue;
      const r = p.r || 100;
      if (Math.abs(p.x - x) > r || Math.abs(p.z - z) > r) continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 > r * r) continue;
      discover.add(p.id);
      return p;
    }
    return null;
  }
  /** Where fast travel to a place puts the car: on the nearest road, facing along it. */
  arrival(p) { return roadPointNear(this.net, p.x, p.z); }
}
