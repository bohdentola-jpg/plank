// EB GAMES 95 — a small operating system for a shelf of three games.
// Boot POST → teal desktop → double-click a cartridge. The Hi-Fi keeps
// playing while you game in another tab, which is the whole point of tabs.

const STORE_KEY = 'ebdesk_v1';
const store = (() => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
})();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
}

// ------------------------------------------------------------------ sfx
let actx = null;
function blip(f0, f1, t = 0.08, gain = 0.08, type = 'square') {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), actx.currentTime + t);
    g.gain.setValueAtTime(gain, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + t);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + t + 0.02);
  } catch { /* no audio yet */ }
}
const clickSfx = () => blip(880, 660, 0.04, 0.05);
const openSfx = () => { blip(523, 523, 0.09, 0.06, 'triangle'); blip(784, 784, 0.12, 0.05, 'triangle'); };
const closeSfx = () => blip(500, 250, 0.1, 0.05, 'triangle');
let chimed = false;
function chime() {
  if (chimed) return;
  chimed = true;
  [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36]].forEach(([f, at]) =>
    setTimeout(() => blip(f, f, 0.5, 0.06, 'sine'), at * 1000));
}

// ------------------------------------------------------------------ pixel icons
function pixelIcon(rows, palette, scale = 4) {
  const h = rows.length, w = rows[0].length;
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  const ctx = cv.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = palette[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return cv.toDataURL();
}

const ICONS = {
  varsity: pixelIcon([
    '................',
    '................',
    '................',
    '.....dddddd.....',
    '...ddbbbbbbdd...',
    '..dbbbwbbwbbbd..',
    '.dbbbbwbbwbbbbd.',
    '.dbwwwwwwwwwwbd.',
    '.dbbbbwbbwbbbbd.',
    '..dbbbwbbwbbbd..',
    '...ddbbbbbbdd...',
    '.....dddddd.....',
    '................',
    '....g.g.g.g.....',
    '.g.g.g.g.g.g.g..',
    'gggggggggggggggg',
  ], { d: '#4a2410', b: '#8a4a1c', w: '#f4f2ec', g: '#1d6b2d' }),
  rimcity: pixelIcon([
    '................',
    '....kkkkkkkk....',
    '...kooookoook...',
    '..koooookooook..',
    '.kooooookoooook.',
    '.kooooookoooook.',
    'koooooookooooook',
    'kkkkkkkkkkkkkkkk',
    'koooooookooooook',
    '.kooooookoooook.',
    '.kooooookoooook.',
    '..koooookooook..',
    '...kooookoook...',
    '....kkkkkkkk....',
    '................',
    '................',
  ], { k: '#26180e', o: '#e8732a' }),
  loam: pixelIcon([
    '................',
    '.gggggggggggggg.',
    '.gGgGggGgGggGgg.',
    '.GgGgGgGgGgGgGg.',
    '.nnnnnnnnnnnnnn.',
    '.nnNnnnnnNnnnnn.',
    '.nnnnnNnnnnnNnn.',
    '.nNnnnnnnNnnnnn.',
    '.nnnnNnnnnnnnNn.',
    '.nnNnnnnnNnnnnn.',
    '.nnnnnnNnnnnnnn.',
    '.nNnnnnnnnnNnnn.',
    '.nnnnnNnnnnnnnn.',
    '.nnnnnnnnnNnnnn.',
    '.nnnnnnnnnnnnnn.',
    '................',
  ], { g: '#3f9e3a', G: '#2c7a28', n: '#7a5230', N: '#5c3c20' }),
  hifi: pixelIcon([
    '................',
    '....k......k....',
    '...k........k...',
    '.kkkkkkkkkkkkkk.',
    '.kssssssssssssk.',
    '.ksrrrrrrrrrrsk.',
    '.kssssssssssssk.',
    '.kpppssksspppsk.',
    '.kpwpsksskspwpk.',
    '.kpppsksskspppk.',
    '.kpppssksspppsk.',
    '.kssssssssssssk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
  ], { k: '#20222a', s: '#9aa0a6', p: '#3a3d44', w: '#7db9e8', r: '#c0273a' }),
  about: pixelIcon([
    '................',
    '...wwwwwwwww....',
    '...wwwwwwwwww...',
    '...wwwwwwwwwww..',
    '...wwwuuuuwwww..',
    '...wwuuwwuuwww..',
    '...wwuuwwuuwww..',
    '...wwwwwuuwwww..',
    '...wwwwuuwwwww..',
    '...wwwwuuwwwww..',
    '...wwwwwwwwwww..',
    '...wwwwuuwwwww..',
    '...wwwwuuwwwww..',
    '...wwwwwwwwwww..',
    '...wwwwwwwwwww..',
    '................',
  ], { w: '#f4f2ec', u: '#000080' }),
};

// ------------------------------------------------------------------ app copy
const GAMES = {
  varsity: {
    title: 'VARSITY 27',
    tag: 'Sunday has Madden. Saturday has NCAA. Friday is yours.',
    path: 'varsity/',
    desc: `High school football under the lights, all of it generated in code. Build
      your school and its actual building, design the uniforms on a live 3D player,
      then coach eight Fridays to a State title — or create yourself in HOMETOWN HERO
      and take a sophomore QB from two-a-days to Signing Day. Full 11-on-11 with a
      play designer, drills, and a coach's office where every week begins.`,
    shots: ['docs/friday-night.png', 'docs/touchdown.png'],
    meta: ['11-on-11 football', '1 player', 'PS5/Xbox pad + keyboard', 'auto-saves'],
  },
  rimcity: {
    title: 'RIM CITY',
    tag: '2-on-2. No refs. No mercy.',
    path: 'rimcity/',
    desc: `Arcade basketball the way the arcade meant it: turbo, shoves, spin moves,
      alley-oops, goaltending that counts, and ON FIRE after three straight buckets.
      Ten original city crews. Take yours on THE RUN — nine crews, weakest to
      meanest, one crown — or settle it on the couch in VERSUS. The announcer lives
      in your browser and he is not calm.`,
    shots: ['docs/rimcity-jam.png', 'docs/rimcity-court.png'],
    meta: ['2-on-2 arcade hoops', '1–2 players', 'PS5/Xbox pad + keyboard', 'run + settings auto-save'],
  },
  loam: {
    title: 'LOAM',
    tag: 'Every world has a seed.',
    path: 'loam/',
    desc: `A voxel world grown from any word you type: five biomes, oceans, cave
      networks, ore by depth. SURVIVAL gives you hearts, hunger, zombies at night and
      the wood-to-diamond tool ladder; CREATIVE gives you every block and flight.
      Real flood-filled voxel light, and a generative composer that scores your whole
      session live — no audio files, the music writes itself.`,
    shots: ['docs/loam-peaks.png', 'docs/loam-night.png'],
    meta: ['voxel survival + building', '1 player', 'mouse + keyboard', 'worlds auto-save'],
  },
};

// ------------------------------------------------------------------ windows
const winsHost = () => document.getElementById('windows');
const wins = new Map();   // id → { el, taskBtn, minimized }
let zTop = 10;

function focusWin(id) {
  for (const [wid, w] of wins) {
    w.el.classList.toggle('focus', wid === id);
    w.taskBtn?.classList.toggle('on', wid === id && !w.minimized);
  }
  const w = wins.get(id);
  if (w) w.el.style.zIndex = ++zTop;
}

function makeWindow(id, title, icon, bodyEl, { x = 120, y = 40, onClose = null } = {}) {
  const el = document.createElement('div');
  el.className = 'win';
  const pos = store.winPos?.[id];
  el.style.left = `${pos?.x ?? x}px`;
  el.style.top = `${pos?.y ?? y}px`;
  el.style.zIndex = ++zTop;

  const bar = document.createElement('div');
  bar.className = 'win-title';
  bar.innerHTML = `<img src="${icon}" alt=""/><span class="wt-text">${title}</span>`;
  const btnMin = document.createElement('button');
  btnMin.textContent = '_';
  btnMin.title = 'Minimize';
  const btnMax = document.createElement('button');
  btnMax.textContent = '□';
  btnMax.title = 'Maximize';
  const btnX = document.createElement('button');
  btnX.textContent = '✕';
  btnX.title = 'Close';
  bar.append(btnMin, btnMax, btnX);

  const body = document.createElement('div');
  body.className = 'win-body';
  body.appendChild(bodyEl);

  el.append(bar, body);
  winsHost().appendChild(el);
  el.style.display = 'none';

  const w = { el, taskBtn: null, minimized: false, title, icon, onClose };
  wins.set(id, w);

  // dragging
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (el.classList.contains('max')) return;
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const move = (ev) => {
      el.style.left = `${Math.max(-60, Math.min(window.innerWidth - 80, ev.clientX - ox))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - oy))}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      store.winPos = store.winPos || {};
      store.winPos[id] = { x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) };
      save();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  el.addEventListener('pointerdown', () => focusWin(id));
  btnX.onclick = (e) => { e.stopPropagation(); closeWin(id); };
  btnMin.onclick = (e) => { e.stopPropagation(); minimizeWin(id); };
  btnMax.onclick = (e) => { e.stopPropagation(); el.classList.toggle('max'); focusWin(id); };
  return w;
}

function openWin(id) {
  const w = wins.get(id);
  if (!w) return;
  w.minimized = false;
  w.el.style.display = 'flex';
  if (!w.taskBtn) {
    const tb = document.createElement('button');
    tb.className = 'task-btn btn95';
    tb.innerHTML = `<img src="${w.icon}" alt=""/><span>${w.title}</span>`;
    tb.onclick = () => {
      const ww = wins.get(id);
      if (ww.minimized || ww.el.style.display === 'none') { openWin(id); }
      else if (ww.el.classList.contains('focus')) { minimizeWin(id); }
      else focusWin(id);
    };
    document.getElementById('task-buttons').appendChild(tb);
    w.taskBtn = tb;
  }
  focusWin(id);
  openSfx();
  // keep it on screen
  const r = w.el.getBoundingClientRect();
  if (r.right > window.innerWidth || r.bottom > window.innerHeight - 30) {
    w.el.style.left = `${Math.max(8, (window.innerWidth - r.width) / 2)}px`;
    w.el.style.top = `${Math.max(8, (window.innerHeight - 30 - r.height) / 2)}px`;
  }
}

function minimizeWin(id) {
  const w = wins.get(id);
  if (!w) return;
  w.minimized = true;
  w.el.style.display = 'none';
  w.taskBtn?.classList.remove('on');
}

function closeWin(id) {
  const w = wins.get(id);
  if (!w) return;
  // windows hide instead of dying so the Hi-Fi never stops mid-song
  w.el.style.display = 'none';
  w.minimized = false;
  w.taskBtn?.remove();
  w.taskBtn = null;
  closeSfx();
  w.onClose?.();
}

// ------------------------------------------------------------------ app windows
function gameWindow(id) {
  const g = GAMES[id];
  const body = document.createElement('div');
  body.className = 'gw';
  body.innerHTML = `
    <div class="gw-top">
      <img class="gw-icon" src="${ICONS[id]}" alt=""/>
      <div>
        <div class="gw-title">${g.title}</div>
        <div class="gw-tag">${g.tag}</div>
        <div class="gw-desc">${g.desc}</div>
      </div>
    </div>
    <div class="gw-shots">${g.shots.map((s) => `<span class="shot"><img src="${s}" alt="${g.title} screenshot"/></span>`).join('')}</div>
    <div class="gw-meta">${g.meta.map((m) => `<span>▪ <b>${m}</b></span>`).join('')}</div>
    <div class="gw-actions">
      <button class="play95"><span class="tri">▶</span>PLAY ${g.title}</button>
      <span class="gw-note">Opens in a new tab — this desktop (and the Hi-Fi) stays on.</span>
    </div>`;
  body.querySelector('.play95').onclick = () => {
    blip(660, 990, 0.12, 0.07, 'triangle');
    window.open(g.path, '_blank');
  };
  return body;
}

function aboutWindow() {
  const body = document.createElement('div');
  body.className = 'about';
  body.innerHTML = `
    <h1>EB GAMES 95</h1>
    <p>Three 3D games, one repo, zero asset files — every model, texture, animation,
    and note of music is generated in code and runs straight in the browser.</p>
    <ul>
      <li><b>VARSITY 27</b> — high school football, careers and all</li>
      <li><b>RIM CITY</b> — 2-on-2 arcade basketball, ON FIRE included</li>
      <li><b>LOAM</b> — voxel survival with a generative score</li>
    </ul>
    <p>Plug in a PS5 or Xbox controller for the sports titles. Games open in their
    own tabs; start some music in the EB Hi-Fi first and it keeps playing while
    you play.</p>
    <p><i>EB GAMES 95 is not an operating system. Please do not defragment it.</i></p>`;
  return body;
}

// ------------------------------------------------------------------ Hi-Fi
function spotifyEmbedUrl(url) {
  const m = String(url).match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1].toLowerCase()}/${m[2]}`;
}

function hifiWindow() {
  const body = document.createElement('div');
  body.className = 'hifi';
  body.innerHTML = `
    <div class="hifi-now bevel-in"><span id="hifi-marquee">EB Hi-Fi — no disc</span></div>
    <div class="tabs">
      <button class="tab" data-tab="files">MY MUSIC</button>
      <button class="tab" data-tab="spotify">SPOTIFY</button>
    </div>
    <div class="tabpane bevel-out" data-pane="files">
      <button class="btn95" id="hifi-add">📂 Add songs…</button>
      <input type="file" id="hifi-input" accept="audio/*" multiple hidden />
      <select class="hifi-list field95" id="hifi-list" size="6"></select>
      <div class="hifi-row">
        <button class="btn95" id="hf-prev">⏮</button>
        <button class="btn95" id="hf-play">▶</button>
        <button class="btn95" id="hf-stop">⏹</button>
        <button class="btn95" id="hf-next">⏭</button>
        <input type="range" id="hf-seek" min="0" max="1000" value="0" />
        <span id="hf-time">0:00</span>
      </div>
      <div class="hifi-row">
        <span>VOL</span><input type="range" id="hf-vol" min="0" max="100" />
      </div>
      <small>Your files never leave this computer. The music keeps playing while you
      game in another tab — even if you close this window.</small>
    </div>
    <div class="tabpane bevel-out" data-pane="spotify" hidden>
      <div class="hifi-row" style="margin-top:0">
        <input type="text" class="field95" id="sp-url" style="flex:1" placeholder="Paste a Spotify song / album / playlist link…" />
        <button class="btn95" id="sp-load">Load</button>
      </div>
      <div id="sp-holder"></div>
      <small>Log in to Spotify in this browser for full tracks (otherwise you get
      previews). The player keeps going while you game in another tab.</small>
    </div>`;

  // ---- tabs
  const setTab = (t) => {
    body.querySelectorAll('.tab').forEach((el) => el.classList.toggle('on', el.dataset.tab === t));
    body.querySelectorAll('.tabpane').forEach((el) => { el.hidden = el.dataset.pane !== t; });
    store.hifiTab = t;
    save();
  };
  body.querySelectorAll('.tab').forEach((el) => { el.onclick = () => { clickSfx(); setTab(el.dataset.tab); }; });
  setTab(store.hifiTab || 'files');

  // ---- local files deck
  const audio = new Audio();
  document.getElementById('hifi-persist').appendChild(audio);
  audio.volume = (store.vol ?? 70) / 100;
  const tracks = [];
  let cur = -1;
  const list = body.querySelector('#hifi-list');
  const marquee = body.querySelector('#hifi-marquee');
  const playBtn = body.querySelector('#hf-play');
  const tray = document.getElementById('tray-music');
  let marqueeText = 'EB Hi-Fi — no disc';
  let marqueeOff = 0;

  const setNow = (text) => { marqueeText = text; marqueeOff = 0; };
  setInterval(() => {
    if (marqueeText.length > 44) {
      marqueeOff = (marqueeOff + 1) % (marqueeText.length + 8);
      const s = marqueeText + '   ♪   ' + marqueeText;
      marquee.textContent = s.slice(marqueeOff, marqueeOff + 44);
    } else marquee.textContent = marqueeText;
  }, 220);

  const renderList = () => {
    list.innerHTML = '';
    tracks.forEach((t, i) => {
      const o = document.createElement('option');
      o.textContent = `${String(i + 1).padStart(2, '0')}. ${t.name}`;
      o.value = i;
      if (i === cur) o.selected = true;
      list.appendChild(o);
    });
  };
  const playIdx = (i) => {
    if (i < 0 || i >= tracks.length) return;
    cur = i;
    audio.src = tracks[i].url;
    audio.play().catch(() => {});
    setNow(`▶ ${tracks[i].name}`);
    playBtn.textContent = '⏸';
    tray.hidden = false;
    renderList();
  };
  body.querySelector('#hifi-add').onclick = () => body.querySelector('#hifi-input').click();
  body.querySelector('#hifi-input').onchange = (e) => {
    for (const f of e.target.files) {
      tracks.push({ name: f.name.replace(/\.[a-z0-9]+$/i, ''), url: URL.createObjectURL(f) });
    }
    renderList();
    if (cur === -1 && tracks.length) playIdx(0);
  };
  list.ondblclick = () => playIdx(parseInt(list.value, 10));
  playBtn.onclick = () => {
    if (!tracks.length) return;
    if (cur === -1) return playIdx(parseInt(list.value || '0', 10));
    if (audio.paused) { audio.play().catch(() => {}); playBtn.textContent = '⏸'; tray.hidden = false; }
    else { audio.pause(); playBtn.textContent = '▶'; tray.hidden = true; }
  };
  body.querySelector('#hf-stop').onclick = () => {
    audio.pause();
    audio.currentTime = 0;
    playBtn.textContent = '▶';
    tray.hidden = true;
    setNow('EB Hi-Fi — stopped');
  };
  body.querySelector('#hf-prev').onclick = () => playIdx((cur - 1 + tracks.length) % tracks.length);
  body.querySelector('#hf-next').onclick = () => playIdx((cur + 1) % tracks.length);
  audio.onended = () => { if (tracks.length) playIdx((cur + 1) % tracks.length); };
  const seek = body.querySelector('#hf-seek');
  const timeEl = body.querySelector('#hf-time');
  audio.ontimeupdate = () => {
    if (audio.duration) seek.value = String((audio.currentTime / audio.duration) * 1000);
    const m = Math.floor(audio.currentTime / 60), s = Math.floor(audio.currentTime % 60);
    timeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  };
  seek.oninput = () => { if (audio.duration) audio.currentTime = (+seek.value / 1000) * audio.duration; };
  const vol = body.querySelector('#hf-vol');
  vol.value = String(store.vol ?? 70);
  vol.oninput = () => {
    audio.volume = +vol.value / 100;
    store.vol = +vol.value;
    save();
  };

  // ---- spotify deck
  const spUrl = body.querySelector('#sp-url');
  const spHolder = body.querySelector('#sp-holder');
  const loadSpot = (url) => {
    const emb = spotifyEmbedUrl(url);
    if (!emb) {
      spHolder.innerHTML = `<small style="color:#800000">That doesn't look like a Spotify link. Try one like
        https://open.spotify.com/playlist/…</small>`;
      return;
    }
    spHolder.innerHTML = '';
    const f = document.createElement('iframe');
    f.className = 'spot-frame';
    f.src = emb;
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    f.loading = 'lazy';
    spHolder.appendChild(f);
    store.spotifyUrl = url;
    save();
  };
  spUrl.value = store.spotifyUrl || '';
  body.querySelector('#sp-load').onclick = () => { clickSfx(); loadSpot(spUrl.value.trim()); };
  spUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadSpot(spUrl.value.trim()); });
  if (store.spotifyUrl) loadSpot(store.spotifyUrl);

  return body;
}

// ------------------------------------------------------------------ desktop icons
const DESK_APPS = [
  { id: 'varsity', label: 'VARSITY 27' },
  { id: 'rimcity', label: 'RIM CITY' },
  { id: 'loam', label: 'LOAM' },
  { id: 'hifi', label: 'EB Hi-Fi' },
  { id: 'about', label: 'About' },
];

let selected = null;
function buildIcons() {
  const host = document.getElementById('icons');
  DESK_APPS.forEach(({ id, label }, i) => {
    const d = document.createElement('div');
    d.className = 'dicon';
    d.tabIndex = 0;
    d.innerHTML = `<img src="${ICONS[id]}" alt=""/><span>${label}</span>`;
    let selAt = 0;
    d.onclick = () => {
      clickSfx();
      const again = selected === d && Date.now() - selAt > 350;
      document.querySelectorAll('.dicon').forEach((x) => x.classList.remove('sel'));
      d.classList.add('sel');
      if (selected === d && again) { openWin(id); }
      selected = d;
      selAt = Date.now();
    };
    d.ondblclick = () => openWin(id);
    d.onkeydown = (e) => { if (e.key === 'Enter') openWin(id); };
    host.appendChild(d);
  });
  document.getElementById('desktop').addEventListener('click', (e) => {
    if (e.target.id === 'desktop' || e.target.id === 'icons') {
      document.querySelectorAll('.dicon').forEach((x) => x.classList.remove('sel'));
      selected = null;
    }
  });
}

// ------------------------------------------------------------------ start menu + taskbar
function buildStartMenu() {
  const menu = document.getElementById('start-menu');
  const items = menu.querySelector('.sm-items');
  const mk = (icon, label, fn) => {
    const b = document.createElement('button');
    b.className = 'sm-item';
    b.innerHTML = `${icon ? `<img src="${icon}" alt=""/>` : '<span style="width:22px"></span>'}<span>${label}</span>`;
    b.onclick = () => { clickSfx(); toggleStart(false); fn(); };
    items.appendChild(b);
    return b;
  };
  mk(ICONS.varsity, 'VARSITY 27', () => openWin('varsity'));
  mk(ICONS.rimcity, 'RIM CITY', () => openWin('rimcity'));
  mk(ICONS.loam, 'LOAM', () => openWin('loam'));
  items.insertAdjacentHTML('beforeend', '<div class="sm-sep"></div>');
  mk(ICONS.hifi, 'EB Hi-Fi (music)', () => openWin('hifi'));
  mk(ICONS.about, 'About EB GAMES 95', () => openWin('about'));
  items.insertAdjacentHTML('beforeend', '<div class="sm-sep"></div>');
  const crtBtn = mk(null, '', () => {
    store.crt = !store.crt;
    applyCrt();
    save();
  });
  const setCrtLabel = () => { crtBtn.querySelector('span:last-child').textContent = `${store.crt ? '✓ ' : ''}CRT monitor mode`; };
  crtBtn.addEventListener('click', setCrtLabel);
  setCrtLabel();
  mk(null, 'Shut Down…', () => {
    const body = document.createElement('div');
    body.className = 'about';
    body.innerHTML = `<p style="display:flex;gap:10px;align-items:center">
      <span style="font-size:28px">🔌</span>
      It is now safe to close this tab.<br/>Or don't — the games aren't going anywhere.</p>`;
    if (!wins.has('shutdown')) makeWindow('shutdown', 'Shut Down', ICONS.about, body, { x: window.innerWidth / 2 - 170, y: window.innerHeight / 2 - 120 });
    openWin('shutdown');
  });

  const toggleStart = (force) => {
    const show = force ?? menu.hidden;
    menu.hidden = !show;
    document.getElementById('start-btn').classList.toggle('on', show);
  };
  document.getElementById('start-btn').onclick = (e) => { e.stopPropagation(); clickSfx(); chime(); toggleStart(); };
  window.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target.id !== 'start-btn') toggleStart(false);
  });
}

function applyCrt() {
  document.getElementById('crt').hidden = !store.crt;
}

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const d = new Date();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
  };
  tick();
  setInterval(tick, 10000);
}

// ------------------------------------------------------------------ boot
function boot() {
  const el = document.getElementById('boot95');
  const pre = document.getElementById('boot-text');
  const quick = (() => { try { return sessionStorage.getItem('ebboot') === '1'; } catch { return false; } })();
  const LINES = [
    'EB MEGABIOS v2.7   (C) 1995 EB SYSTEMS INC.',
    'CPU : BLAST PROCESSOR AT 66 MHZ ......... OK',
    'MEMORY TEST : 640K BASE ... 8192K EXT ... OK',
    '',
    'DETECTING SHELF .......... 3 CARTRIDGES FOUND',
    '  VARSITY 27 ............................ OK',
    '  RIM CITY .............................. OK',
    '  LOAM .................................. OK',
    'SOUND : EB-FM SYNTHESIS .................. OK',
    'GAMEPAD : PLUG IN A PAD ANY TIME ...... READY',
    '',
    'BOOTING EB GAMES 95 ...',
  ];
  const done = () => {
    el.classList.add('hide');
    try { sessionStorage.setItem('ebboot', '1'); } catch { /* fine */ }
  };
  if (quick) {
    pre.textContent = 'EB GAMES 95';
    setTimeout(done, 250);
  } else {
    let i = 0;
    const typeLine = () => {
      if (i >= LINES.length) { setTimeout(done, 500); return; }
      pre.textContent += LINES[i++] + '\n';
      setTimeout(typeLine, i < 4 ? 140 : 120);
    };
    typeLine();
  }
  el.addEventListener('click', done);
  window.addEventListener('keydown', function esc() { done(); window.removeEventListener('keydown', esc); });
}

// ------------------------------------------------------------------ go
if (store.crt === undefined) store.crt = true;   // it's 1995, of course it's a CRT
buildIcons();
buildStartMenu();
startClock();
applyCrt();

makeWindow('varsity', 'VARSITY 27', ICONS.varsity, gameWindow('varsity'), { x: 140, y: 30 });
makeWindow('rimcity', 'RIM CITY', ICONS.rimcity, gameWindow('rimcity'), { x: 200, y: 70 });
makeWindow('loam', 'LOAM', ICONS.loam, gameWindow('loam'), { x: 260, y: 110 });
makeWindow('hifi', 'EB Hi-Fi', ICONS.hifi, hifiWindow(), { x: 460, y: 90 });
makeWindow('about', 'About EB GAMES 95', ICONS.about, aboutWindow(), { x: 380, y: 150 });

boot();

// a welcome mat: first-ever visit opens the About window
if (!store.visited) {
  store.visited = true;
  save();
  setTimeout(() => openWin('about'), 2600);
}
