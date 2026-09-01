// main.js — the menu, and the wiring between lobby, session and editor.

import { uid, playSound, unlockAudio, PALETTE_HEX } from './util.js';
import { joinOrHostPublic, hostPrivate, joinPrivate, soloLobby } from './net.js';
import { GameSession } from './game.js';
import { Editor } from './editor.js';
import { emptyMap } from './world.js';
import { mainMap, sampleMap, loadMaps, saveMap, deleteMap, codeToMap, mapToCode } from './maps.js';

const $ = (id) => document.getElementById(id);

const dom = {
  canvas: $('view'),
  bubbles: $('bubbles'),
  bsUI: $('bs-ui'),
  writes: $('writes'),
  hud: $('hud'),
  foot: $('foot'),
  pongHud: $('ponghud'),
  veil: $('veil'),
  crosshair: $('crosshair'),
  prompt: $('prompt'),
  screenOverlay: $('screen-overlay'),
  screenHolder: $('screen-holder'),
  chatBar: $('chatbar'),
  chatInput: $('chatinput'),
  errPanel: $('err-panel'),
  pause: $('pause'),
  pauseInfo: $('pause-info'),
  pauseResume: $('pause-resume'),
  pauseLeave: $('pause-leave'),
};

let session = null;
let editor = null;

// -------------------------------------------------------------- screens
const SCREENS = ['menu', 'private', 'mapslist', 'connect'];
function show(name) {
  for (const s of SCREENS) $(s).style.display = s === name ? 'flex' : 'none';
  const inMenu = SCREENS.includes(name);
  document.body.classList.toggle('in-menu', inMenu);
}
function showWorld() { show('__none__'); }

// -------------------------------------------------------------- the title
// "game", drawn as pixels so the name looks like the game does.
const TITLE = {
  g: ['011110', '110011', '110011', '110011', '011111', '000011', '110011', '011110'],
  a: ['000000', '011110', '000011', '011111', '110011', '110011', '011111', '000000'],
  m: ['000000', '111110', '110101', '110101', '110101', '110101', '110101', '000000'],
  e: ['000000', '011110', '110011', '111111', '110000', '110011', '011110', '000000'],
};
function paintTitle() {
  for (const cv of document.querySelectorAll('.title-canvas')) {
    const s = +(cv.dataset.scale || 8);
    const rows = 8, cols = 6, gap = 1;
    cv.width = (cols + gap) * 4 * s;
    cv.height = rows * s;
    cv.style.width = cv.width + 'px';
    cv.style.height = cv.height + 'px';
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#8b8b8b';
    let ox = 0;
    for (const ch of 'game') {
      const g = TITLE[ch];
      for (let r = 0; r < g.length; r++) {
        for (let q = 0; q < g[r].length; q++) {
          if (g[r][q] === '1') c.fillRect((ox + q) * s, r * s, s, s);
        }
      }
      ox += cols + gap;
    }
  }
}

// -------------------------------------------------------------- name
const nameInput = $('name');
nameInput.value = localStorage.getItem('game.name') || '';
nameInput.addEventListener('input', () => {
  localStorage.setItem('game.name', nameInput.value.trim().slice(0, 16));
});
function myName() {
  const n = (nameInput.value || '').trim().slice(0, 16);
  return n || 'guest ' + Math.floor(Math.random() * 900 + 100);
}

// -------------------------------------------------------------- sessions
function connectStatus(text) { $('connect-status').textContent = text; }

function startSession(lobby, map, opts = {}) {
  showWorld();
  unlockAudio();
  session = new GameSession({
    dom, lobby, map,
    myName: myName(),
    testMode: !!opts.testMode,
    onExit: () => {
      session = null;
      if (opts.onExit) opts.onExit();
      else show('menu');
    },
  });
  // click once to grab the mouse
  session.toast(lobby && lobby.code ? 'lobby code ' + lobby.code : 'click to look around');
}

async function joinPublicFlow() {
  show('connect');
  connectStatus('looking for players…');
  let lobby;
  try {
    lobby = await joinOrHostPublic(myName(), connectStatus);
  } catch (e) {
    console.error(e);
    lobby = soloLobby(myName(), 'something went wrong — playing solo');
  }
  const w = lobby.welcome;
  startSession(lobby, w && w.map ? w.map : null);
}

async function hostPrivateFlow(map, opts = {}) {
  show('connect');
  connectStatus('opening a private lobby…');
  let lobby;
  try {
    lobby = await hostPrivate(myName(), connectStatus);
  } catch (e) {
    console.error(e);
    lobby = soloLobby(myName(), 'something went wrong — playing solo');
  }
  startSession(lobby, map, opts);
}

async function joinPrivateFlow(code) {
  show('connect');
  try {
    const lobby = await joinPrivate(code, myName(), connectStatus);
    const w = lobby.welcome;
    startSession(lobby, w && w.map ? w.map : null);
  } catch (err) {
    connectStatus((err && err.text) || 'could not join');
    setTimeout(() => show('private'), 1800);
  }
}

// -------------------------------------------------------------- editor
function openEditor(map, mapId) {
  showWorld();
  $('editor-root').style.display = 'block';
  editor = new Editor({
    dom,
    root: $('editor-root'),
    map, mapId,
    onExit: () => { editor = null; show('menu'); },
    onTest: (m, id) => {
      editor = null;
      startSession(soloLobby(myName()), m, {
        testMode: true,
        onExit: () => openEditor(m, id),
      });
    },
    onHost: (m, id) => {
      editor = null;
      hostPrivateFlow(m, { onExit: () => openEditor(m, id) });
    },
  });
}

// -------------------------------------------------------------- my maps
function refreshMapsList() {
  const list = $('maps-items');
  list.innerHTML = '';
  let maps = loadMaps();
  if (!Object.keys(maps).length) {
    saveMap(uid(), sampleMap());
    maps = loadMaps();
  }
  for (const [id, m] of Object.entries(maps)) {
    const row = document.createElement('div');
    row.className = 'map-row';
    const name = document.createElement('span');
    name.className = 'map-name';
    name.textContent = m.name;
    const meta = document.createElement('span');
    meta.className = 'map-meta';
    meta.textContent = m.objects.length + ' objects · ' + Object.keys(m.models).length + ' models' +
      (m.terrain === false ? ' · void' : ' · world');
    row.append(name, meta,
      mkBtn('build', () => openEditor(m, id)),
      mkBtn('play', () => startSession(soloLobby(myName()), m, {
        onExit: () => { show('mapslist'); refreshMapsList(); },
      })),
      mkBtn('host', () => hostPrivateFlow(m)),
      mkBtn('share', async (b) => {
        const code = mapToCode(m);
        try { await navigator.clipboard.writeText(code); b.textContent = 'copied'; }
        catch (e) { prompt('map code:', code); }
        setTimeout(() => { b.textContent = 'share'; }, 1400);
      }),
    );
    const del = mkBtn('delete', () => {
      if (confirm('delete "' + m.name + '"?')) { deleteMap(id); refreshMapsList(); }
    });
    del.classList.add('danger');
    row.append(del);
    list.append(row);
  }
}

function mkBtn(label, fn) {
  const b = document.createElement('button');
  b.className = 'menu-mini';
  b.textContent = label;
  b.addEventListener('click', () => fn(b));
  return b;
}

// -------------------------------------------------------------- wiring
$('btn-join').onclick = () => { playSound('pip'); joinPublicFlow(); };
$('btn-private').onclick = () => {
  playSound('pip');
  const sel = $('priv-map');
  sel.innerHTML = '';
  const optMain = document.createElement('option');
  optMain.value = '__main__';
  optMain.textContent = 'the main world';
  sel.append(optMain);
  for (const [id, m] of Object.entries(loadMaps())) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = m.name;
    sel.append(o);
  }
  show('private');
};
$('btn-create').onclick = () => { playSound('pip'); refreshMapsList(); show('mapslist'); };

$('btn-priv-back').onclick = () => show('menu');
$('btn-priv-make').onclick = () => {
  const sel = $('priv-map');
  const maps = loadMaps();
  hostPrivateFlow(sel.value === '__main__' ? null : (maps[sel.value] || null));
};
$('btn-priv-join').onclick = () => {
  const code = $('priv-code').value.trim().toUpperCase();
  if (code.length >= 3) joinPrivateFlow(code);
};
$('priv-code').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') $('btn-priv-join').click();
});

$('btn-maps-back').onclick = () => show('menu');
$('btn-maps-new').onclick = () => {
  const m = emptyMap('my map');
  openEditor(m, uid());
};
$('btn-maps-void').onclick = () => {
  const m = emptyMap('my void');
  m.terrain = false;
  openEditor(m, uid());
};
$('btn-maps-import').onclick = () => {
  const input = $('maps-import-code');
  const m = codeToMap(input.value);
  if (!m) {
    input.value = '';
    input.placeholder = "that code didn't work — paste the whole thing";
    return;
  }
  saveMap(uid(), m);
  input.value = '';
  input.placeholder = 'paste a map code (GM3.…)';
  refreshMapsList();
};
$('btn-connect-cancel').onclick = () => location.reload();

paintTitle();
show('menu');

// QA hook — harmless in production, lets the tests look at live state
window.__game = {
  get session() { return session; },
  get editor() { return editor; },
  mainMap, sampleMap,
};
