// main.js — boot, menus, and the glue between lobby / session / editor.

import { drawTitle, titleWidth, uid, playSound } from './util.js';
import { joinOrHostPublic, hostPrivate, joinPrivate, soloLobby } from './net.js';
import { GameSession } from './game.js';
import { Editor } from './editor.js';
import { Renderer } from './render.js';
import { mainMap, sampleMap, loadMaps, saveMap, deleteMap, codeToMap, mapToCode } from './maps.js';
import { emptyMap } from './world.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('world'), $('overlay'));
const dom = {
  chatBar: $('chatbar'),
  chatInput: $('chatinput'),
  bsUI: $('bs-ui'),
  errPanel: $('err-panel'),
};

let session = null;
let editor = null;

// -------------------------------------------------------------- screens
const SCREENS = ['menu', 'private', 'mapslist', 'connect'];
function show(name) {
  for (const s of SCREENS) $(s).style.display = s === name ? 'flex' : 'none';
  document.body.classList.toggle('in-menu', SCREENS.includes(name));
}
function showNone() { show('__none__'); }

// -------------------------------------------------------------- title
function paintTitle() {
  for (const cv of document.querySelectorAll('.title-canvas')) {
    const scale = 7;
    const w = titleWidth('game', scale);
    cv.width = w + scale * 2;
    cv.height = scale * 11;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    drawTitle(c, 'game', scale, scale * 6, scale, '#8b8b8b');
  }
}

// -------------------------------------------------------------- name
const nameInput = $('name');
nameInput.value = localStorage.getItem('game.name') || '';
nameInput.addEventListener('input', () => {
  localStorage.setItem('game.name', nameInput.value.trim().slice(0, 16));
});
function myName() {
  return (nameInput.value || '').trim().slice(0, 16) || ('guest ' + Math.floor(Math.random() * 900 + 100));
}

// -------------------------------------------------------------- sessions
function connectStatus(text) { $('connect-status').textContent = text; }

function startSession(lobby, map, snap, opts = {}) {
  showNone();
  session = new GameSession({
    renderer, dom, lobby, map, snap,
    myName: myName(),
    testMode: !!opts.testMode,
    onExit: () => {
      session = null;
      dom.errPanel.style.display = 'none';
      if (opts.onExit) opts.onExit();
      else show('menu');
    },
  });
}

async function joinPublicFlow() {
  show('connect');
  connectStatus('looking for players…');
  try {
    const lobby = await joinOrHostPublic(myName(), connectStatus);
    const map = lobby.welcome && lobby.welcome.map ? lobby.welcome.map : null;
    const snap = lobby.welcome ? lobby.welcome.snap : null;
    startSession(lobby, map, snap);
  } catch (e) {
    console.error(e);
    startSession(soloLobby(myName(), 'something went wrong — playing solo'), null, null);
  }
}

async function hostPrivateFlow(map, opts = {}) {
  show('connect');
  connectStatus('opening a private lobby…');
  try {
    const lobby = await hostPrivate(myName(), connectStatus);
    startSession(lobby, map, null, opts);
    if (lobby.code) session.toast('lobby code: ' + lobby.code + ' — friends join with it');
  } catch (e) {
    console.error(e);
    startSession(soloLobby(myName(), 'something went wrong — playing solo'), map, null, opts);
  }
}

async function joinPrivateFlow(code) {
  show('connect');
  try {
    const lobby = await joinPrivate(code, myName(), connectStatus);
    const map = lobby.welcome && lobby.welcome.map ? lobby.welcome.map : null;
    const snap = lobby.welcome ? lobby.welcome.snap : null;
    startSession(lobby, map, snap);
  } catch (err) {
    connectStatus((err && err.text) || 'could not join');
    setTimeout(() => show('private'), 1600);
  }
}

// -------------------------------------------------------------- editor
function openEditor(map, mapId) {
  showNone();
  $('editor-root').style.display = 'block';
  editor = new Editor({
    renderer,
    root: $('editor-root'),
    map, mapId,
    onExit: () => { editor = null; show('menu'); },
    onTest: (m, id) => {
      editor = null;
      $('editor-root').style.display = 'none';
      $('editor-root').innerHTML = '';
      startSession(null, m, null, {
        testMode: true,
        onExit: () => openEditor(m, id),
      });
    },
    onHost: (m, id) => {
      editor = null;
      $('editor-root').style.display = 'none';
      $('editor-root').innerHTML = '';
      hostPrivateFlow(m, { onExit: () => openEditor(m, id) });
    },
  });
}

// -------------------------------------------------------------- maps list
function refreshMapsList() {
  const list = $('maps-items');
  list.innerHTML = '';
  const maps = loadMaps();
  if (!Object.keys(maps).length) {
    // seed with the sample so the list never feels empty
    const id = uid();
    saveMap(id, sampleMap());
    return refreshMapsList();
  }
  for (const [id, m] of Object.entries(maps)) {
    const row = document.createElement('div');
    row.className = 'map-row';
    const name = document.createElement('span');
    name.className = 'map-name';
    name.textContent = m.name;
    const edit = mkBtn('edit', () => openEditor(m, id));
    const play = mkBtn('play', () => startSession(soloLobby(myName()), m, null, { onExit: () => { show('mapslist'); refreshMapsList(); } }));
    const host = mkBtn('host', () => hostPrivateFlow(m));
    const share = mkBtn('share', async () => {
      const code = mapToCode(m);
      try { await navigator.clipboard.writeText(code); share.textContent = 'copied!'; }
      catch (e) { prompt('copy this map code:', code); }
      setTimeout(() => { share.textContent = 'share'; }, 1200);
    });
    const del = mkBtn('delete', () => {
      if (confirm('delete "' + m.name + '"?')) { deleteMap(id); refreshMapsList(); }
    });
    del.classList.add('danger');
    row.append(name, edit, play, host, share, del);
    list.appendChild(row);
  }
}

function mkBtn(label, fn) {
  const b = document.createElement('button');
  b.className = 'menu-mini';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

// -------------------------------------------------------------- wiring
$('btn-join').addEventListener('click', () => { playSound('pip'); joinPublicFlow(); });
$('btn-private').addEventListener('click', () => { playSound('pip'); show('private'); });
$('btn-create').addEventListener('click', () => { playSound('pip'); refreshMapsList(); show('mapslist'); });

$('btn-priv-back').addEventListener('click', () => show('menu'));
$('btn-priv-make').addEventListener('click', () => {
  const sel = $('priv-map');
  const maps = loadMaps();
  const map = sel.value === '__main__' ? null : maps[sel.value];
  hostPrivateFlow(map || null);
});
$('btn-priv-join').addEventListener('click', () => {
  const code = $('priv-code').value.trim().toUpperCase();
  if (code.length >= 3) joinPrivateFlow(code);
});
$('priv-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('btn-priv-join').click();
  e.stopPropagation();
});

$('btn-maps-back').addEventListener('click', () => show('menu'));
$('btn-maps-new').addEventListener('click', () => {
  const m = emptyMap('my map');
  openEditor(m, uid());
});
$('btn-maps-import').addEventListener('click', () => {
  const code = $('maps-import-code').value;
  const m = codeToMap(code);
  if (!m) { $('maps-import-code').value = ''; $('maps-import-code').placeholder = "that code didn't work…"; return; }
  const id = uid();
  saveMap(id, m);
  $('maps-import-code').value = '';
  refreshMapsList();
});
$('btn-connect-cancel').addEventListener('click', () => location.reload());

// populate private map choices whenever the private screen opens
$('btn-private').addEventListener('click', () => {
  const sel = $('priv-map');
  sel.innerHTML = '';
  const optMain = document.createElement('option');
  optMain.value = '__main__';
  optMain.textContent = 'main map';
  sel.appendChild(optMain);
  for (const [id, m] of Object.entries(loadMaps())) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = m.name;
    sel.appendChild(o);
  }
});

paintTitle();
show('menu');

// QA hook (harmless in production): lets automated tests peek at state
window.__game = { get session() { return session; }, get editor() { return editor; } };

// warn about leaving mid-game
window.addEventListener('beforeunload', (e) => {
  if (session && session.lobby && !session.lobby.offline && session.players.size > 1) {
    e.preventDefault();
  }
});
