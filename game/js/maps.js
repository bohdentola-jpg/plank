// maps.js — the main map, the samples, and local storage.

import { emptyMap, validateMap, mapToCode, codeToMap, MAX_OBJECTS, safeSet } from './world.js';
import { emptyVoxels, setVox } from './voxel.js';
import { PALETTE_KEYS, uid } from './util.js';


// The main map: the void plaza in the middle of a whole world. Everything here
// sits inside the flat blank circle; walk out in any direction and you're in
// the meadow, the dunes, the snow or the ash on the way to the volcano.
export function mainMap() {
  const m = emptyMap('main');
  m.seed = 20260806;              // everyone walks the same world
  m.terrain = true;
  m.spawn = { x: 0, y: 0, z: 0 };
  // Ids must be identical for everyone: the host sends `map: null` for the main
  // world and each client builds it locally, so a random id here would make the
  // host and its guests disagree about which box is which.
  const O = [];
  const put = (model, x, z, extra = {}) =>
    O.push({ id: extra.id || 'm' + O.length.toString(36), model, x, y: 0, z, ...extra });

  // cardboard, scattered like someone left in a hurry
  const boxSpots = [
    [-9, -4], [-7.4, -4], [-8.2, -2.6], [-12, 3], [6, -8], [7.4, -8], [6.7, -6.6],
    [14, 9], [-16, 10], [-15, 12], [22, -14], [-24, -18], [3, 16], [4.6, 16],
    [30, 4], [-32, 2], [11, 24], [-8, 28], [26, 22], [-22, 26],
  ];
  boxSpots.forEach(([x, z], i) => put(i % 7 === 0 ? 'bigbox' : 'box', x, z));

  // two blaster stands, on opposite sides
  put('blasterstand', -18, 0, { id: 'stand1' });
  put('blasterstand', 18, -22, { id: 'stand2' });

  // the ping pong table
  put('pongtable', 20, 6, { id: 'pong' });

  // somewhere to climb
  put('platform', -28, -10, { scale: 130 });
  put('block', -28, -14);
  put('block', -26, -14);
  put('pillar', 34, -6);
  put('platform', 34, -6, { y: 5, scale: 90 });
  put('ramp', 12, -30, { yaw: 180 });

  // the welcome sign
  put('sign', 0, -6, {
    id: 'welcome',
    script: [
      'when touched',
      '  say "welcome to game" for 3 seconds',
      'end',
      'when clicked',
      '  say "E grabs boxes and blasters. click throws or shoots. T talks." for 6 seconds',
      'end',
    ].join('\n'),
  });

  // signposts at the rim, so the world reads as a place with directions
  const ways = [
    [0, -62, 'the meadow and the deep forest are north'],
    [62, 0, 'dunes to the east'],
    [0, 62, 'the volcano is south — mind the lava'],
    [-62, 0, 'snowfields west'],
  ];
  ways.forEach(([x, z, text], i) => put('sign', x, z, {
    id: 'way' + i,
    yaw: Math.round(Math.atan2(x, z) * 180 / Math.PI),
    script: `when player near 9\n  say "${text}" for 4 seconds\nend`,
  }));

  // a lamp ring, because a void with a couple of lamps is funnier than a bare one
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    put('lamp', Math.cos(a) * 44, Math.sin(a) * 44);
  }

  m.objects = O;
  return validateMap(m);
}

// A sample map that shows the language off — everyone gets a copy to poke at.
export function sampleMap() {
  const m = emptyMap('sample: the button game');
  m.terrain = false;                // a pure white void, nothing but what you place
  m.spawn = { x: 0, y: 0, z: 0 };

  // a painted model: a little pedestal tile
  let tile = emptyVoxels(8, 3, 8);
  const gray = PALETTE_KEYS.indexOf('gray');
  const blue = PALETTE_KEYS.indexOf('blue');
  for (let z = 0; z < 8; z++) {
    for (let x = 0; x < 8; x++) {
      tile = setVox(tile, x, 0, z, gray);
      tile = setVox(tile, x, 1, z, (x + z) % 2 ? blue : gray);
    }
  }
  m.models.tile = {
    vox: tile, solid: true, physical: false,
    script: [
      '# every tile you spawn runs this',
      'when touched',
      '  sound pip',
      '  color yellow',
      '  change shared touched by 1',
      '  wait 0.4',
      '  vanish',
      'end',
    ].join('\n'),
  };

  m.objects = [
    {
      id: 'ctrl', model: 'sign', x: 0, y: 0, z: -8, script: [
        'to lay with n',
        '  set placed to 0',
        '  repeat with i from 1 to n',
        '    set a to i * (360 / n)',
        '    spawn tile at 14 * (sin a), 14 * (cos a)',
        '    change placed by 1',
        '  end',
        '  return placed',
        'end',
        '',
        'when start',
        '  set shared touched to 0',
        '  button "lay tiles" at 50, 88',
        '  write "tiles touched: 0" at 50, 8 size 4 as hud',
        'end',
        '',
        'when button "lay tiles"',
        '  sound ding',
        '  say "laid " + lay(10) + " tiles"',
        'end',
        '',
        'when tick',
        '  write "tiles touched: " + shared touched at 50, 8 size 4 as hud',
        'end',
      ].join('\n'),
    },
    {
      id: 'spinner', model: 'block', x: 8, y: 2, z: 8, color: 'purple', script: [
        'when start',
        '  spin 60',
        '  set home to my y',
        'end',
        'when tick',
        '  set my y to home + 1.5 * (sin (time * 90))',
        'end',
        'when clicked',
        '  sound pop',
        '  say "boing"',
        '  push up 300',
        'end',
      ].join('\n'),
    },
    { id: 'b1', model: 'box', x: -6, y: 0, z: 4 },
    { id: 'b2', model: 'box', x: -4.4, y: 0, z: 4 },
    { id: 'p1', model: 'platform', x: 0, y: 0, z: 14 },
  ];
  return validateMap(m);
}

// ---------------------------------------------------------------- storage
const KEY = 'game.maps.v3';

export function loadMaps() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const out = {};
    for (const id of Object.keys(obj)) {
      // ids come from localStorage, which another tab (or a stale build) wrote
      if (!/^[a-zA-Z0-9_-]{1,24}$/.test(id) || id === '__proto__') continue;
      const v = validateMap(obj[id]);
      if (v) safeSet(out, id, v);
    }
    return out;
  } catch (e) {
    return {};
  }
}

// returns true when it actually made it to disk
export function saveMap(id, map) {
  const maps = loadMaps();
  maps[id] = map;
  try {
    localStorage.setItem(KEY, JSON.stringify(maps));
    return true;
  } catch (e) {
    return false;    // out of quota — the caller has to tell the user
  }
}

export function deleteMap(id) {
  const maps = loadMaps();
  delete maps[id];
  try { localStorage.setItem(KEY, JSON.stringify(maps)); } catch (e) { /* ignore */ }
}

export { mapToCode, codeToMap, MAX_OBJECTS };
