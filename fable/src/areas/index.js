// Area registry. Each area module exports { id, name, w, d, spawn, paint(g,S), build(w,S), music, ... }.
import hollow from './hollow.js';
import { clubhouse, diner, arcade } from './interiors.js';
import borough from './borough.js';

export const AREAS = { hollow, clubhouse, diner, arcade, borough };

/** Later chapters register their areas here. */
export function registerAreas(map) { Object.assign(AREAS, map); }
