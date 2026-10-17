// The city core on one street grid: DOWNTOWN (towers, avenues every three
// blocks, Main Street a boulevard, Halcyon Plaza two blocks wide), the grid's
// west end in Old Town's brick streets up to Bastion Boulevard, CHINATOWN
// south of Harbor Avenue (short blocks, alleys through every other one, Grant
// Avenue down the middle), and THE WORKS east of it (big warehouse blocks;
// your garage is on Foundry Street). Columns run north–south (x), rows
// east–west (z, south positive).
import { grid } from '../helpers.js';

export const COLS = [-1060, -920, -780, -640, -500, -360, -220, -80, 60, 200, 340, 480, 620, 800, 1000, 1200, 1400];
export const ROWS = [-500, -390, -280, -170, -60, 50, 160, 270, 380, 490, 565, 640, 715, 790, 865, 940, 1015, 1090, 1165, 1240, 1315, 1390, 1500, 1620];

const DOWN = (j) => j <= 9;                 // rows of downtown (and the grid's Old Town end)
const CHINA = (i, j) => j >= 10 && i >= 3 && i <= 10 && j <= 21;
const WORKS = (i, j) => j >= 10 && i >= 10;

function hole(i, j) {
  if (DOWN(j)) return i > 12;               // east of downtown: open ground (Eastside)
  if (WORKS(i, j)) return false;
  if (CHINA(i, j)) return false;
  return true;
}

// avenues and boulevards by line
const colType = (i, j) => {
  if (DOWN(j) && j < 9) {
    if (i === 0) return 'boulevard';                  // Bastion Boulevard
    if (i === 4 || i === 10) return 'avenue';         // 1st and 5th Avenue
    if (i === 7) return 'avenue';                     // Central Avenue
    return i <= 2 ? 'cobble' : 'street';              // the grid's Old Town end
  }
  if (j === 9) return i === 7 ? 'avenue' : i <= 2 ? 'cobble' : 'street';
  if (WORKS(i, j) && i > 10) return 'street';
  if (CHINA(i, j)) {
    if (i === 7) return 'avenue';                     // Grant Avenue
    if (i === 5 || i === 9) return 'alley';
    return 'street';
  }
  return 'street';
};
const rowType = (j, i) => {
  if (DOWN(j)) {
    if (j === 4) return i >= 0 ? 'boulevard' : null;  // Main Street
    if (j === 0 || j === 9) return 'avenue';          // North Avenue, Harbor Avenue
    if (j === 7 && i >= 2 && i < 12) return 'avenue';  // Union Street
    return i <= 1 ? 'cobble' : 'street';
  }
  if (WORKS(i, j) && i >= 10) {
    if (j === 22) return 'avenue';                    // Industrial Way
    if (j % 2) return null;                           // big warehouse blocks: every other row
    return 'street';
  }
  if (CHINA(i, j)) {
    if (j % 2 === 1) return 'alley';                  // alleys through the short blocks
    return 'street';
  }
  return 'street';
};

function skip(kind, i, j) {
  // Halcyon Plaza: two blocks with no street through them
  if (kind === 'v' && i === 7 && (j === 2 || j === 3)) return true;
  if (kind === 'h' && j === 3 && (i === 6 || i === 7)) return true;
  // Chinatown's Lantern Square
  if (kind === 'v' && i === 6 && (j === 14 || j === 15)) return true;
  if (kind === 'h' && j === 15 && (i === 5 || i === 6)) return true;
  // the grid stops where Chinatown meets The Works except on its streets
  if (kind === 'h' && i === 10 && j >= 10 && j % 2 === 1) return true;
  return false;
}

const g = grid('c', {
  x: 0, z: 0, cols: COLS, rows: ROWS, hole, colType, rowType, skip,
  rowNames: { 0: 'NORTH AVE', 4: 'MAIN ST', 7: 'UNION ST', 9: 'HARBOR AVE', 12: 'FOUNDRY ST', 22: 'INDUSTRIAL WAY' },
  colNames: { 0: 'BASTION BLVD', 4: '1ST AVE', 7: 'CENTRAL AVE', 10: '5TH AVE' },
});

// Chinatown and The Works run down to the waterfront road (see coast.js):
// three streets leave the grid's south edge for it
const nodes = { ...g.nodes };
const roads = [...g.roads];
roads.push(
  { id: 'c_wf_grant', type: 'avenue', a: 'c_7_21', b: 'wf_grant', name: 'GRANT AVE' },
  { id: 'c_wf_a', type: 'street', a: 'c_3_21', b: 'wf_west' },
  { id: 'c_wf_works', type: 'street', a: 'c_12_23', b: 'wf_works' },
  { id: 'c_wf_works2', type: 'street', a: 'c_15_23', b: 'wf_pier' },
);

export default {
  id: 'city', nodes, roads,
  landmarks: [
    { id: 'plaza', name: 'HALCYON PLAZA', x: -80, z: -170, kind: 'plaza', district: 'downtown' },
    { id: 'lantern', name: 'LANTERN SQUARE', x: -220, z: 940, kind: 'square', district: 'chinatown' },
    { id: 'gate', name: 'DRAGON GATE', x: -80, z: 528, kind: 'gate', district: 'chinatown' },
  ],
};
