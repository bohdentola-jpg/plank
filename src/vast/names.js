// Procedural place names. Deterministic from a hash so every traveler with
// the same seed meets the same "Duskmere Fen". Pure logic — node-testable.

import { hashU32, mulberry32 } from './noise.js';

const ONSET = ['Br', 'D', 'Dr', 'F', 'G', 'Gl', 'H', 'K', 'L', 'M', 'N', 'R', 'S', 'Sk', 'T', 'Th', 'V', 'W', 'Y', 'C', 'Cr', 'Ash', 'El', 'Or'];
const MID = ['a', 'e', 'i', 'o', 'u', 'ae', 'au', 'ei', 'ar', 'or', 'en', 'un', 'il', 'ol'];
const CODA = ['th', 'mer', 'wick', 'fell', 'holm', 'gard', 'ren', 'dor', 'vane', 'row', 'den', 'moor', 'wold', 'by', 'stead', 'fen', 'crag', 'march', 'haven', 'ford'];

const ADJ = ['Ashen', 'Silent', 'Amber', 'Hollow', 'Whispering', 'Sunken', 'Gilded', 'Pale', 'Wandering', 'Broken', 'Verdant', 'Windswept', 'Forgotten', 'Shimmering', 'Old', 'Far', 'Sleeping', 'Thundering', 'Misty', 'Crimson', 'Quiet', 'Endless'];

const REGION_NOUN = {
  ocean: ['Sea', 'Deep', 'Expanse', 'Gulf'],
  beach: ['Coast', 'Shores', 'Strand', 'Sands'],
  plains: ['Plains', 'Reach', 'Downs', 'Fields'],
  meadow: ['Meadows', 'Vale', 'Downs', 'Blooms'],
  steppe: ['Steppe', 'Flats', 'Expanse', 'Barrens'],
  forest: ['Wood', 'Weald', 'Glades', 'Timberlands'],
  deepforest: ['Deepwood', 'Wilds', 'Thicket', 'Tanglewood'],
  savanna: ['Savanna', 'Veldt', 'Sunlands', 'Acacia Reach'],
  desert: ['Wastes', 'Dunes', 'Expanse', 'Scorch'],
  swamp: ['Fen', 'Mire', 'Marshes', 'Sloughs'],
  tundra: ['Tundra', 'Frostlands', 'Wastes', 'Reach'],
  snow: ['Peaks', 'Crown', 'Heights', 'Spires'],
  rock: ['Crags', 'Tors', 'Scarps', 'Teeth'],
};

function pick(rng, arr) { return arr[(rng() * arr.length) | 0]; }

export function properName(hash) {
  const rng = mulberry32(hashU32(hash));
  let n = pick(rng, ONSET) + pick(rng, MID) + pick(rng, CODA);
  if (rng() < 0.22) n += pick(rng, ['', 'a', 'e'].slice(1));
  return n;
}

export function regionName(hash, biome) {
  const rng = mulberry32(hashU32(hash ^ 0x51ab));
  const noun = pick(rng, REGION_NOUN[biome] || REGION_NOUN.plains);
  return rng() < 0.55
    ? `The ${pick(rng, ADJ)} ${noun}`
    : `${properName(hash ^ 0x77)} ${noun}`;
}

export function poiName(hash, type) {
  const rng = mulberry32(hashU32(hash ^ 0xbeef));
  const who = properName(hash ^ 0x1234);
  switch (type) {
    case 'shrine': return rng() < 0.5 ? `Shrine of ${who}` : `${who} Shrine`;
    case 'ruin': return rng() < 0.5 ? `Ruins of ${who}` : `${who} Ruin`;
    case 'camp': return `${who}'s Camp`;
    case 'tower': return rng() < 0.5 ? `${who} Watch` : `${who} Beacon`;
    case 'stones': return `The ${pick(rng, ADJ)} Stones`;
    case 'village': return who;
    case 'obelisk': return `The ${pick(rng, ADJ)} Needle`;
    default: return who;
  }
}
