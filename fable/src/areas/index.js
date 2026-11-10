// Area registry. Each area module exports { id, name, w, d, spawn, paint(g,S), build(w,S), music, ... }.
import hollow from './hollow.js';
import { clubhouse, diner, arcade } from './interiors.js';
import borough from './borough.js';
import stadium from './stadium.js';
import fair from './fair.js';
import frost from './frost.js';
import neon from './neon.js';

export const AREAS = { hollow, clubhouse, diner, arcade, borough, stadium, fair, frost, neon };

/** Later chapters register their areas here. */
export function registerAreas(map) { Object.assign(AREAS, map); }
