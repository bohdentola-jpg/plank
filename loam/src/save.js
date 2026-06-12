// World saves: an index of worlds plus one record per world, all in
// localStorage. A world is just its seed, the player, and the edit diffs —
// the generator rebuilds everything else.
import { hashStr } from './util.js';

const INDEX = 'loam_worlds_v1';
const WORLD = (id) => 'loam_world_' + id;

export function parseSeed(s) {
  s = (s || '').trim();
  if (!s) return (Math.random() * 0x7fffffff) | 0;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10) >>> 0;
  return hashStr(s);
}

export function listWorlds() {
  try { return JSON.parse(localStorage.getItem(INDEX)) || []; } catch { return []; }
}

function writeIndex(list) {
  try { localStorage.setItem(INDEX, JSON.stringify(list)); } catch { /* full/private */ }
}

export function createWorld(name, seedStr, mode) {
  const meta = {
    id: Date.now().toString(36) + ((Math.random() * 1e6) | 0).toString(36),
    name: name || 'New World',
    seed: parseSeed(seedStr),
    mode,
    played: Date.now(),
  };
  writeIndex([meta, ...listWorlds()]);
  return meta;
}

export function loadWorld(id) {
  try { return JSON.parse(localStorage.getItem(WORLD(id))); } catch { return null; }
}

export function saveWorld(id, data) {
  try {
    localStorage.setItem(WORLD(id), JSON.stringify(data));
    const list = listWorlds();
    const m = list.find((w) => w.id === id);
    if (m) { m.played = Date.now(); writeIndex(list); }
  } catch { /* full/private */ }
}

export function deleteWorld(id) {
  try { localStorage.removeItem(WORLD(id)); } catch { }
  writeIndex(listWorlds().filter((w) => w.id !== id));
}
