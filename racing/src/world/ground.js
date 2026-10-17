// PORT HALCYON — who owns each bit of ground (a district lookup grid built
// once over the whole map) and what colour the bare ground is there: city
// lots, lawns, the beach, sand and red rock in the desert, the salt flat,
// fields in patchwork on the farms, forest floor, bare rock on the steeps,
// snow up high. The terrain mesh takes its vertex colours from here.
import { BOUNDS, DISTRICTS } from './map/base.js';
import { inPoly, bbox } from './geom.js';
import { makeNoise2D } from '../core/util.js';

const G = 32;                     // lookup grid (m)
const NX = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / G), NZ = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / G);
let GRID = null;
const DB = DISTRICTS.map((d) => ({ ...d, box: bbox(d.poly) }));
export const DISTRICT_INDEX = Object.fromEntries(DISTRICTS.map((d, i) => [d.id, i]));

function buildGrid() {
  GRID = new Uint8Array(NX * NZ).fill(255);
  for (let j = 0; j < NZ; j++) {
    const z = BOUNDS.z0 + (j + 0.5) * G;
    for (let i = 0; i < NX; i++) {
      const x = BOUNDS.x0 + (i + 0.5) * G;
      for (let k = 0; k < DB.length; k++) {
        const d = DB[k];
        if (x < d.box.x0 || x > d.box.x1 || z < d.box.z0 || z > d.box.z1) continue;
        if (inPoly(d.poly, x, z)) { GRID[j * NX + i] = k; break; }
      }
    }
  }
}

/** District at (x, z) (the district object), or null in the sea / off the map. */
export function districtAt(x, z) {
  if (!GRID) buildGrid();
  const i = Math.floor((x - BOUNDS.x0) / G), j = Math.floor((z - BOUNDS.z0) / G);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return null;
  const k = GRID[j * NX + i];
  return k === 255 ? null : DISTRICTS[k];
}

const NN = makeNoise2D(9001);
const C = (hex) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const P = {
  lot: C('#4a4844'), lotLight: C('#5d5a54'), lawn: C('#41632c'), lawnDry: C('#5c6a35'),
  sand: C('#c7ad80'), wetSand: C('#8f7a5a'), dune: C('#d8bd8a'), redrock: C('#a5573a'), redsand: C('#b8784e'),
  salt: C('#e8e4da'), saltCrack: C('#c9c2b2'), field1: C('#8f8a3c'), field2: C('#5f7a2e'), field3: C('#6e5638'),
  field4: C('#a39445'), forest: C('#2c4220'), forestFloor: C('#3a3424'), redwoodFloor: C('#4a3424'),
  grass: C('#4a6b2c'), alpine: C('#6b7446'), rock: C('#6f6a64'), darkRock: C('#55524d'), snow: C('#eef1f4'),
  concrete: C('#6c6b67'), gravel: C('#7d776c'), vineyard: C('#5d6a30'), soil: C('#6a5034'),
};

/** Ground colour for a terrain vertex. h height, ny normal's y, road 0..1 how graded to a road it is. */
export function groundColor(x, z, h, ny, road, out) {
  const d = districtAt(x, z);
  const st = d ? d.style : 'sea';
  const n1 = NN.fbm(x / 60, z / 60, 3), n2 = NN(x / 9, z / 9);
  const steep = ny < 0.78 ? Math.min(1, (0.78 - ny) / 0.2) : 0;
  let c;
  switch (st) {
    case 'downtown': case 'chinatown': case 'works': case 'harbor': case 'shipyard':
      c = mix(P.lot, P.lotLight, 0.5 + n1 * 0.5);
      break;
    case 'oldtown': case 'uptown': case 'eastside':
      c = mix(P.lawn, P.lot, road > 0.2 ? 0.7 : 0.15 + n1 * 0.2);
      break;
    case 'pier9': case 'point': case 'bayshore':
      c = h < 3.2 ? mix(P.wetSand, P.sand, Math.min(1, Math.max(0, (h - 0.6) / 2))) : mix(P.grass, P.lawnDry, 0.4 + n1 * 0.5);
      break;
    case 'desert': case 'ghosttown':
      c = mix(P.sand, P.dune, 0.5 + n1 * 0.5);
      if (steep > 0) c = mix(c, P.redrock, steep);
      break;
    case 'redrock':
      c = mix(P.redsand, P.redrock, 0.4 + n1 * 0.4 + steep * 0.4);
      break;
    case 'drylake': {
      const crack = Math.abs(NN(x / 14, z / 14)) < 0.04 ? 1 : 0;
      c = mix(P.salt, P.saltCrack, crack * 0.8 + n2 * 0.1);
      if (h > 66) c = mix(c, P.sand, Math.min(1, (h - 66) / 8));
      break;
    }
    case 'farmland': {
      // fields: patches of crop, stubble, ploughed soil
      const fx = Math.floor((x + NN(x / 300, z / 300) * 60) / 160), fz = Math.floor((z + NN(z / 300, x / 300) * 60) / 120);
      const pick = ((fx * 7919 + fz * 104729) >>> 0) % 4;
      c = [P.field1, P.field2, P.field3, P.field4][pick];
      // rows in the crop
      if (pick !== 2) c = mix(c, P.soil, 0.08 + 0.08 * Math.sin((x * 0.6 + z * 0.2)));
      break;
    }
    case 'crestwood':
      c = mix(P.vineyard, P.lawnDry, 0.5 + n1 * 0.5);
      break;
    case 'redwood':
      c = mix(P.redwoodFloor, P.forest, 0.4 + n1 * 0.5);
      break;
    case 'kaido': case 'wilds': case 'lake': case 'ironworks':
      c = mix(P.forest, P.forestFloor, 0.35 + n1 * 0.5);
      if (st === 'ironworks') c = mix(c, P.concrete, 0.45);
      break;
    case 'summit': case 'ridgeline':
      c = mix(P.alpine, P.grass, 0.3 + n1 * 0.4);
      break;
    default:
      c = mix(P.grass, P.lawnDry, 0.5 + n1 * 0.5);
  }
  // steep ground shows rock, high ground goes alpine and then snow
  if (steep > 0 && st !== 'redrock' && st !== 'desert') c = mix(c, h > 200 ? P.darkRock : P.rock, steep);
  if (h > 380 && st !== 'drylake') c = mix(c, P.rock, Math.min(1, (h - 380) / 200) * 0.6);
  if (h > 560 + n1 * 60) c = mix(c, P.snow, Math.min(1, (h - 560 - n1 * 60) / 50) * (1 - steep * 0.6));
  // graded road verges: a little gravel
  if (road > 0.3 && st !== 'downtown' && st !== 'chinatown' && st !== 'works') c = mix(c, P.gravel, (road - 0.3) * 0.5);
  const j = 0.93 + n2 * 0.07;
  out[0] = c[0] * j; out[1] = c[1] * j; out[2] = c[2] * j;
  return out;
}
