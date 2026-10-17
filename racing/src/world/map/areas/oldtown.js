// OLD TOWN: the oldest streets in Port Halcyon, laid out along the river
// (which runs dead straight here between stone embankments). Quais on both
// banks, cobbled streets square to the river, stone bridges across it on
// every third street, and every street on the east side runs out to
// Bastion Boulevard, where the downtown grid begins. Bastion Boulevard
// carries on south past the end of the grid to Chinatown and the harbor.
import { ROWS } from './city.js';

const R0 = [-2190, -560];                  // the river where it enters town
const D = [0.4049, 0.9145];                // along the river (v), downstream
const E = [0.9145, -0.4049];               // across it, to the east bank (u)
const P = (u, v) => [R0[0] + E[0] * u + D[0] * v, R0[1] + E[1] * u + D[1] * v];
const BASTION_X = -1060;
// the street at v meets Bastion Boulevard at z = -1060.31 + 1.09377 v
const vAt = (z) => (z + 1060.31) / 1.09377;
const zAt = (v) => -1060.31 + 1.09377 * v;

const COLS_U = [-420, -300, -180, -62, 62, 180, 300, 420, 540, 660, 780, 900, 1020];
const QUAI_W = 3, QUAI_E = 4;
// streets: the downtown rows' continuations, then six more down Bastion South
const ROW_V = [...ROWS.slice(0, 10).map(vAt), 1518, 1618, 1718, 1818, 1918, 2018];
const BRIDGES = new Set([1, 4, 7, 10, 13]);   // rows that cross the river
const MAIN = 4;                                // Main Street's row: the Grand Bridge

const nodes = {};
const roads = [];
const id = (i, j) => `ot_${i}_${j}`;
const bastion = (j) => (j < 10 ? `c_0_${j}` : `ot_bs${j - 10}`);
const has = new Set();

for (let j = 0; j < ROW_V.length; j++) {
  const v = ROW_V[j];
  for (let i = 0; i < COLS_U.length; i++) {
    const [x, z] = P(COLS_U[i], v);
    if (x > BASTION_X - 28) continue;
    if (x < -2420) continue;
    nodes[id(i, j)] = [x, z];
    has.add(id(i, j));
  }
  if (j >= 10) nodes[bastion(j)] = [BASTION_X, zAt(v)];
}
// rows: west to east, over the river where there's a bridge, out to Bastion
for (let j = 0; j < ROW_V.length; j++) {
  const row = COLS_U.map((_, i) => id(i, j)).filter((k) => has.has(k));
  const t = j === MAIN ? 'street' : 'cobble';
  for (let k = 0; k < row.length - 1; k++) {
    const i = Number(row[k].split('_')[1]);
    if (i === QUAI_W && !BRIDGES.has(j)) continue;   // no bridge here
    roads.push({ id: `ot_h_${i}_${j}`, type: t, a: row[k], b: row[k + 1], name: j === MAIN ? 'MAIN ST' : undefined, district: 'oldtown' });
  }
  roads.push({ id: `ot_hb_${j}`, type: t, a: row[row.length - 1], b: bastion(j), name: j === MAIN ? 'MAIN ST' : undefined, district: 'oldtown' });
}
// columns: up and down the town (the quais along the water)
for (let i = 0; i < COLS_U.length; i++) {
  for (let j = 0; j < ROW_V.length - 1; j++) {
    if (!has.has(id(i, j)) || !has.has(id(i, j + 1))) continue;
    const quai = i === QUAI_W || i === QUAI_E;
    roads.push({ id: `ot_v_${i}_${j}`, type: 'cobble', a: id(i, j), b: id(i, j + 1), name: quai ? (i === QUAI_W ? 'QUAI OUEST' : 'QUAI EST') : undefined, district: 'oldtown' });
  }
}
// Bastion Boulevard south of the grid, and its links east into Chinatown
for (let j = 9; j < ROW_V.length - 1; j++) roads.push({ id: `ot_bsv_${j}`, type: 'avenue', a: bastion(j), b: bastion(j + 1), name: 'BASTION BLVD' });
nodes.ot_bsend = [BASTION_X, 1300];
roads.push(
  { id: 'ot_bsv_end', type: 'avenue', a: bastion(ROW_V.length - 1), b: 'ot_bsend', name: 'BASTION BLVD' },
  { id: 'ot_ct1', type: 'cobble', a: 'ot_bs1', b: 'c_3_12' },
  { id: 'ot_ct2', type: 'cobble', a: 'ot_bs4', b: 'c_3_16' },
  { id: 'ot_ct3', type: 'street', a: 'ot_bsend', b: 'c_3_20' },
);

// the quais run on upriver to the gorge below the dam (River Road, west
// bank) and out of town on the west side (Mill Road to the farms)
const qwTop = id(QUAI_W, 0);
nodes.ot_river_n = P(-62, 200);
roads.push({ id: 'ot_riverroad', type: 'coastal', a: qwTop, b: 'ot_river_n', name: 'RIVER ROAD' });

export const OLDTOWN = { R0, D, E, P, vAt, zAt, ROW_V, COLS_U };

export default {
  id: 'oldtown', nodes, roads,
  landmarks: [
    { id: 'cathedral', name: 'ST. CECILIA\'S', x: P(330, 860)[0], z: P(330, 860)[1], kind: 'cathedral', district: 'oldtown' },
    { id: 'grandbridge', name: 'THE GRAND BRIDGE', x: P(0, ROW_V[MAIN])[0], z: P(0, ROW_V[MAIN])[1], kind: 'bridge', district: 'oldtown' },
    { id: 'clocktower', name: 'THE CLOCK TOWER', x: P(-240, 1250)[0], z: P(-240, 1250)[1], kind: 'tower', district: 'oldtown' },
  ],
};
