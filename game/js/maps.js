// maps.js — the main map, sample maps, and local map storage.

import { emptyMap, validateMap, mapToCode, codeToMap } from './world.js';
import { uid } from './util.js';

// The main map: an empty white space with boxes, blasters and a ping pong
// table. Everything here is stock Snaptic: void, ground, cardboard.
export function mainMap() {
  const m = emptyMap('main');
  m.groundY = 0;
  m.spawn = { x: 0, y: -20 };
  m.objects = [
    // scattered cardboard boxes to mess with
    { id: 'bx1', model: 'box', x: -120, y: -7 },
    { id: 'bx2', model: 'box', x: -95, y: -7 },
    { id: 'bx3', model: 'box', x: -107, y: -21 },
    { id: 'bx4', model: 'box', x: 60, y: -7 },
    { id: 'bx5', model: 'box', x: 240, y: -7 },
    { id: 'bx6', model: 'box', x: 500, y: -7 },
    { id: 'bx7', model: 'box', x: 530, y: -7 },
    { id: 'bx8', model: 'bigbox', x: -260, y: -10 },
    { id: 'bx9', model: 'box', x: -420, y: -7 },
    // blaster stands
    { id: 'gs1', model: 'blasterstand', x: -180, y: -9 },
    { id: 'gs2', model: 'blasterstand', x: 380, y: -9 },
    // the ping pong table
    { id: 'pong', model: 'pongtable', x: 150, y: -13 },
    // a platform to hop on
    { id: 'pl1', model: 'platform', x: -330, y: -60 },
    { id: 'pl2', model: 'platform', x: 640, y: -50 },
    // the welcome sign — a plain object with a boxscript on it
    {
      id: 'sign1', model: 'sign', x: -40, y: -10,
      script: 'when touched\n  say "welcome to game"\nend\nwhen clicked\n  say "E grabs things. click throws. T talks."\nend',
    },
  ];
  return m;
}

// A tiny sample map that shows off boxscript — appears in everyone's map list.
export function sampleMap() {
  const m = emptyMap('sample: bounce room');
  m.groundY = 0;
  m.spawn = { x: 0, y: -20 };
  m.models = {
    pad: {
      w: 18, h: 6,
      d: ('999999999999999999' + '944444444444444449' + '999999999999999999').padEnd(18 * 6, '.'),
      solid: true, physical: false,
      script: 'when touched\n  sound boop\n  push up 0\n  teleport player to player x, player y + 4\nend',
    },
  };
  m.objects = [
    { id: 's1', model: 'sign', x: -30, y: -10, script: 'when touched\n  say "this map was made in the editor"\nend' },
    { id: 'b1', model: 'box', x: 60, y: -7 },
    { id: 'b2', model: 'box', x: 84, y: -7 },
    {
      id: 'orb', model: 'block', x: 160, y: -40, solid: false, color: 'yellow',
      script: 'when start\n  set home to my y\nend\nwhen tick\n  set y to home + 6 * (time - floor time) # bob\nend\nwhen clicked\n  sound ding\n  say "score +1"\n  change shared score by 1\n  write "score: " + shared score at 50, 8 size 4 as hud\nend',
    },
    { id: 'p1', model: 'pad', x: -140, y: -4 },
  ];
  return validateMap(m);
}

// ---------------------------------------------------------------- storage
const KEY = 'game.maps.v1';

export function loadMaps() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const out = {};
    for (const [id, m] of Object.entries(obj)) {
      const v = validateMap(m);
      if (v) out[id] = v;
    }
    return out;
  } catch (e) {
    return {};
  }
}

export function saveMap(id, map) {
  const maps = loadMaps();
  maps[id || uid()] = map;
  try { localStorage.setItem(KEY, JSON.stringify(maps)); } catch (e) { /* quota */ }
  return id;
}

export function deleteMap(id) {
  const maps = loadMaps();
  delete maps[id];
  try { localStorage.setItem(KEY, JSON.stringify(maps)); } catch (e) { /* quota */ }
}

export { mapToCode, codeToMap };
