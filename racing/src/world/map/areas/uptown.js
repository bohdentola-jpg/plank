// UPTOWN: up the hill north of downtown, under the I-9 viaduct and into
// wide streets — two tree-lined boulevards, Park Boulevard across the middle,
// Halcyon Park (two blocks of lawns and a pond), the Museum, and the Grand
// Concourse cutting across the grid on the diagonal. The avenues come up
// from downtown under the freeway; the Kaido road leaves the top of the hill
// for the mountains.
import { grid } from '../helpers.js';

const COLS = [-920, -640, -360, -80, 200, 480, 760];
const ROWS = [-1680, -1540, -1400, -1260, -1120, -980, -840, -700];

const g = grid('u', {
  x: 0, z: 0, cols: COLS, rows: ROWS,
  // Halcyon Park: no street through its middle
  hole: (i, j) => i === 1 && j === 2,
  colType: (i) => (i === 2 || i === 5 ? 'boulevard' : 'street'),
  rowType: (j) => (j === 4 ? 'boulevard' : j === 7 ? 'avenue' : 'street'),
  rowNames: { 4: 'PARK BLVD', 7: 'TERRACE AVE' },
  colNames: { 2: 'MADISON BLVD', 5: 'LINCOLN BLVD' },
  district: 'uptown',
});

const nodes = { ...g.nodes };
const roads = [...g.roads];

// down to downtown, under the freeway: uptown's columns are downtown's
const DOWN = { 0: 1, 1: 3, 2: 5, 3: 7, 4: 9, 5: 11 };
for (const [i, c] of Object.entries(DOWN)) {
  const t = i === '2' || i === '5' ? 'boulevard' : i === '3' ? 'avenue' : 'street';
  roads.push({ id: `u_down_${i}`, type: t, a: `u_${i}_7`, b: `c_${c}_0`, district: 'uptown' });
}
// the Grand Concourse: corner of the park to the bottom of the hill
roads.push({ id: 'u_concourse', type: 'avenue', a: 'u_0_3', b: 'u_5_7', cross: true, name: 'GRAND CONCOURSE', district: 'uptown' });

export default {
  id: 'uptown', nodes, roads,
  landmarks: [
    { id: 'park', name: 'HALCYON PARK', x: -640, z: -1400, kind: 'park', district: 'uptown' },
    { id: 'museum', name: 'CITY MUSEUM', x: 60, z: -1190, kind: 'museum', district: 'uptown' },
  ],
};
