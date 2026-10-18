// PORT HALCYON's world data, made once a page and shared by everything that
// needs it (free roam, races on the world's roads, the menus' route maps):
// the road network, the land, the districts' plans, and the map picture.
import { buildNet } from './net.js';
import { Terrain } from './terrain.js';
import { Districts } from './districts/index.js';

let SHARED = null;

export function worldData() {
  if (!SHARED) {
    const net = buildNet();
    const terrain = new Terrain(net);
    SHARED = { net, terrain, districts: new Districts(net, terrain), map: null };
  }
  return SHARED;
}

/** Just the road network (the menus' route maps need nothing more). */
export function worldNet() { return worldData().net; }
