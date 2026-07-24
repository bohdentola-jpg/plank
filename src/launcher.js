// The EB GAMES kiosk: the shelf you pick a game off. Box art is generated in
// canvas (no image files anywhere in this repo), navigation works on a pad, the
// keyboard, or a mouse, and picking a title just navigates to its page.
import { PadInput, BTN, padAnnounced, markPadAnnounced } from './gamepad.js';
import { emblemCanvas } from './melee/portraits.js';
import { charById } from './melee/roster.js';

// ---------------------------------------------------------------- the shelf
// Adding a third game later is one object literal.
const GAMES = [
  {
    id: 'varsity',
    title: 'VARSITY 27',
    publisher: 'EB SPORTS',
    genre: '3D FOOTBALL · CAREER',
    players: '1 PLAYER',
    year: '2004',
    href: 'varsity.html',
    accent: '#f2b705',
    accent2: '#14306e',
    tag: "SUNDAY HAS MADDEN. SATURDAY HAS NCAA. FRIDAY IS YOURS.",
    blurb: 'Build a high school from the bricks up, design the uniform on a live 3D player, '
      + 'then coach — or play — every Friday night under the lights.',
    features: [
      'HOMETOWN HERO — create a QB and live the season week by week',
      'PROGRAM MODE — a 3D coach\'s office, drills, boosters, playoffs',
      'A play designer, a face editor and a school builder',
      'Controller or keyboard · auto-saves to the browser',
    ],
    art: varsityArt,
  },
  {
    id: 'melee',
    title: 'MASCOT MELEE 64',
    publisher: 'EB INTERACTIVE',
    genre: 'PLATFORM FIGHTER · VERSUS',
    players: '1-4 PLAYERS',
    year: '1999',
    href: 'melee.html',
    accent: '#ffd23a',
    accent2: '#2a55b8',
    tag: 'TWELVE MASCOTS. ONE RING. NO MERCY.',
    blurb: 'A chunky 64-bit brawler for the whole shop floor. Knock the other mascots off the '
      + 'stage — the higher their damage, the further they fly.',
    features: [
      'Twelve fighters, six stages, every model built in code',
      'SMASH · GAUNTLET ladder · TRAINING, with items and finishers',
      'Two players on two pads, or split the keyboard',
      'CPU levels 1-9 · stock or time rules · CRT filter',
    ],
    art: meleeArt,
  },
];

// ---------------------------------------------------------------- box art
function panel(ctx, w, h, base) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // speckle so the flat fills read as printed card
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.05 + Math.random() * 0.06;
    ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function spine(ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w * 0.055, h);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(w * 0.055, 0, w * 0.014, h);
}

function badge(ctx, w, h, text, bg, fg, y) {
  const bw = w * 0.62, bh = h * 0.058;
  ctx.fillStyle = bg;
  ctx.fillRect(w * 0.5 - bw / 2, y, bw, bh);
  ctx.font = `700 ${bh * 0.66}px 'Arial Narrow', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(text, w * 0.5, y + bh * 0.56);
}

function stackedWord(ctx, text, cx, cy, size, fill, shadow, italic = true) {
  ctx.save();
  ctx.translate(cx, cy);
  if (italic) ctx.transform(1, 0, -0.13, 1, 0, 0);
  ctx.font = `700 ${size}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (let d = Math.round(size * 0.09); d > 0; d--) {
    ctx.fillStyle = shadow;
    ctx.fillText(text, d * 0.5, d);
  }
  ctx.strokeStyle = '#0d1020';
  ctx.lineWidth = size * 0.13;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function varsityArt(ctx, w, h) {
  panel(ctx, w, h, '#14306e');
  // gold diagonal
  ctx.save();
  ctx.translate(w * 0.5, h * 0.52);
  ctx.rotate(-0.42);
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(-w, -h * 0.09, w * 2, h * 0.18);
  ctx.fillStyle = '#0f2454';
  ctx.fillRect(-w, h * 0.09, w * 2, h * 0.022);
  ctx.restore();
  // the field at the bottom, seen in perspective
  ctx.fillStyle = '#2c6a2e';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74); ctx.lineTo(w, h * 0.74); ctx.lineTo(w, h); ctx.lineTo(0, h);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(245,245,240,0.85)';
  ctx.lineWidth = Math.max(1, w * 0.006);
  for (let i = 1; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(w * (i / 7) - w * 0.1, h);
    ctx.lineTo(w * (i / 7) + w * 0.04, h * 0.74);
    ctx.stroke();
  }
  // a helmet silhouette
  ctx.fillStyle = '#0f2454';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.55, w * 0.19, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(w * 0.31, h * 0.55, w * 0.38, h * 0.045);
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(w * 0.485, h * 0.36, w * 0.03, h * 0.19);
  ctx.fillStyle = '#c7ccd4';
  ctx.fillRect(w * 0.56, h * 0.575, w * 0.15, h * 0.02);
  ctx.fillRect(w * 0.56, h * 0.61, w * 0.13, h * 0.018);
  badge(ctx, w, h, 'EB SPORTS', '#f2b705', '#14306e', h * 0.055);
  stackedWord(ctx, 'VARSITY', w * 0.5, h * 0.2, w * 0.19, '#f6f6f0', '#0a1024');
  stackedWord(ctx, '27', w * 0.5, h * 0.87, w * 0.24, '#f2b705', '#7a5a00');
  spine(ctx, w, h, '#0f2454');
}

function meleeArt(ctx, w, h) {
  panel(ctx, w, h, '#1b2044');
  // starburst behind the cast
  ctx.save();
  ctx.translate(w * 0.5, h * 0.54);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    ctx.fillStyle = i % 2 ? 'rgba(255,210,58,0.18)' : 'rgba(102,226,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w * 0.7, -h * 0.05); ctx.lineTo(w * 0.7, h * 0.05);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // four of the roster, straight off the character-select grid
  const cast = ['blitz', 'tusk', 'volt', 'crunch'];
  const size = w * 0.27;
  cast.forEach((id, i) => {
    const em = emblemCanvas(charById(id), 128);
    const x = w * 0.11 + (i % 2) * w * 0.4;
    const y = h * 0.36 + Math.floor(i / 2) * h * 0.24;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate((i % 2 ? 1 : -1) * 0.06);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(em, -size / 2, -size / 2, size, size);
    ctx.strokeStyle = '#0d1020';
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  });
  badge(ctx, w, h, 'EB INTERACTIVE', '#e8433f', '#f6f6f0', h * 0.05);
  stackedWord(ctx, 'MASCOT', w * 0.5, h * 0.19, w * 0.2, '#ffd23a', '#7a4a00');
  stackedWord(ctx, 'MELEE', w * 0.42, h * 0.85, w * 0.22, '#f6f6f0', '#122a6a');
  // the 64 sticker
  ctx.save();
  ctx.translate(w * 0.8, h * 0.86);
  ctx.rotate(0.16);
  ctx.fillStyle = '#e8433f';
  ctx.fillRect(-w * 0.1, -h * 0.05, w * 0.2, h * 0.1);
  ctx.font = `700 ${h * 0.085}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f6f6f0';
  ctx.fillText('64', 0, h * 0.004);
  ctx.restore();
  spine(ctx, w, h, '#12162f');
}

// ---------------------------------------------------------------- the kiosk
const HINTS = {
  kb: '↑ ↓ SELECT · ENTER PLAY · ESC BACK',
  pad: 'D-PAD / STICK SELECT · ✕ PLAY · ◯ BACK',
};

function boxCanvas(game, w = 300) {
  const cv = document.createElement('canvas');
  const h = Math.round(w * 1.42);
  cv.width = w;
  cv.height = h;
  game.art(cv.getContext('2d'), w, h);
  return cv;
}

class Kiosk {
  constructor() {
    this.rack = document.getElementById('rack');
    this.detail = document.getElementById('detail');
    this.hint = document.getElementById('hint');
    this.wipe = document.getElementById('wipe');
    this.sel = 0;
    this.pad = new PadInput();
    this.lastNav = 0;
    this.navHeld = null;
    this.launching = false;
    this.buildRack();
    this.show(0);
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.repaintArt());
    requestAnimationFrame(() => this.tick());
  }

  buildRack() {
    this.cards = GAMES.map((g, i) => {
      const card = document.createElement('button');
      card.className = 'rack-card';
      card.style.setProperty('--accent', g.accent);
      card.style.setProperty('--accent2', g.accent2);
      const art = boxCanvas(g, 220);
      art.className = 'rack-art';
      card.appendChild(art);
      const meta = document.createElement('div');
      meta.className = 'rack-meta';
      meta.innerHTML = `<b>${g.title}</b><span>${g.publisher} · ${g.year}</span><i>${g.players}</i>`;
      card.appendChild(meta);
      card.onmouseenter = () => this.show(i);
      card.onclick = () => { this.show(i); this.launch(); };
      this.rack.appendChild(card);
      return card;
    });
  }

  repaintArt() {
    // the detail pane art is sized to the pane, so redraw it on resize
    this.show(this.sel, true);
  }

  show(i, force = false) {
    if (i === this.sel && !force && this.detail.dataset.id === GAMES[i].id) return;
    this.sel = i;
    const g = GAMES[i];
    this.cards.forEach((c, k) => c.classList.toggle('sel', k === i));
    document.documentElement.style.setProperty('--kiosk-accent', g.accent);
    document.documentElement.style.setProperty('--kiosk-accent2', g.accent2);
    this.detail.dataset.id = g.id;
    this.detail.innerHTML = '';
    const artWrap = document.createElement('div');
    artWrap.className = 'detail-art';
    const big = boxCanvas(g, 420);
    big.className = 'detail-box';
    artWrap.appendChild(big);
    const info = document.createElement('div');
    info.className = 'detail-info';
    info.innerHTML = `
      <div class="d-pub">${g.publisher}</div>
      <h2 class="d-title">${g.title}</h2>
      <div class="d-tag">${g.tag}</div>
      <div class="d-chips">
        <span>${g.genre}</span><span>${g.players}</span><span>${g.year}</span>
      </div>
      <p class="d-blurb">${g.blurb}</p>
      <ul class="d-features">${g.features.map((f) => `<li>${f}</li>`).join('')}</ul>
    `;
    const play = document.createElement('button');
    play.className = 'd-play';
    play.innerHTML = `<span>▶ PLAY</span><small>${g.title}</small>`;
    play.onclick = () => this.launch();
    info.appendChild(play);
    this.detail.append(artWrap, info);
  }

  move(d) {
    const next = (this.sel + d + GAMES.length) % GAMES.length;
    this.show(next);
  }

  launch() {
    if (this.launching) return;
    this.launching = true;
    const g = GAMES[this.sel];
    this.wipe.querySelector('.wipe-title').textContent = g.title;
    this.wipe.classList.add('on');
    setTimeout(() => { location.href = g.href; }, 620);
  }

  onKey(e) {
    this.setHint('kb');
    if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD', 'Tab'].includes(e.code)) { this.move(1); e.preventDefault(); }
    else if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(e.code)) { this.move(-1); e.preventDefault(); }
    else if (['Enter', 'Space', 'NumpadEnter'].includes(e.code)) { this.launch(); e.preventDefault(); }
    else if (e.code === 'Escape') { this.wipe.classList.remove('on'); this.launching = false; }
  }

  setHint(kind) {
    if (this._hint === kind) return;
    this._hint = kind;
    this.hint.textContent = HINTS[kind];
  }

  tick() {
    requestAnimationFrame(() => this.tick());
    this.pad.poll();
    const p = this.pad;
    if (!p.connected) return;
    if (p.justConnected && !padAnnounced()) markPadAnnounced();
    this.setHint('pad');
    const now = performance.now();
    let dir = 0;
    if (p.down(BTN.DOWN) || p.down(BTN.RIGHT) || p.ly > 0.55 || p.lx > 0.55) dir = 1;
    else if (p.down(BTN.UP) || p.down(BTN.LEFT) || p.ly < -0.55 || p.lx < -0.55) dir = -1;
    if (dir) {
      const edge = p.edges.some((b) => [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT].includes(b));
      if (edge || this.navHeld !== dir || now - this.lastNav > 300) {
        this.navHeld = dir;
        this.lastNav = now;
        this.move(dir);
      }
    } else {
      this.navHeld = null;
    }
    for (const b of p.edges) {
      if (b === BTN.CROSS || b === BTN.OPTIONS) this.launch();
      if (b === BTN.CIRCLE) { this.wipe.classList.remove('on'); this.launching = false; }
    }
  }
}

new Kiosk();
