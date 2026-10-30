// The subway map: the 3 line, its stops, and the secret branches once found.
import { el, openOverlay, panelHead, xButton } from './dom.js';
import { SCENES, LINE } from '../world/scenes.js';
import { SHOPS } from '../data/catalog.js';
import * as E from '../systems/econ.js';
import { shape, stroke, ellipse, rrect, text, FONTS, INK, rgba, mulberry32, ellipsePts, dot } from '../ink.js';
import * as audio from '../audio.js';

let api = { travel: () => {}, current: () => 'token' };
export function initMap(a) { api = { ...api, ...a }; }

function drawMap(c, current) {
  const r = c.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(r.width * dpr);
  c.height = Math.round(r.height * dpr);
  const g = c.getContext('2d');
  const W = 1600, H = 900;
  g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  // poster
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, W, H);
  const rnd = mulberry32(11);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rgba('#5a4a2a', 0.04 + rnd() * 0.05);
    g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 10, 1 + rnd() * 4);
  }
  // water + park blocks for that map feel
  shape(g, [[0, 640], [420, 600], [760, 700], [1100, 650], [1600, 720], [1600, 900], [0, 900]], { fill: '#bcd8e0', lw: 0, amp: 6, seed: 3 });
  shape(g, [[1120, 90], [1420, 120], [1400, 300], [1140, 280]], { fill: '#c8dcae', lw: 0, amp: 6, seed: 4 });
  g.strokeStyle = rgba('#5a4a2a', 0.12);
  g.lineWidth = 3;
  for (let x = 60; x < W; x += 140) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, H); g.stroke(); }
  for (let y = 70; y < H; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y - 30); g.stroke(); }
  text(g, 'THE 3 · ALL TIMES', 70, 90, { size: 34, font: FONTS.sign, fill: INK, lw: 0, align: 'left' });
  ellipse(g, 520, 78, 26, 26, { fill: '#d4473f', lw: 3, seed: 5 });
  text(g, '3', 520, 90, { size: 32, font: FONTS.sign, fill: '#fff', lw: 0 });

  const pos = { token: [300, 430], drip: [800, 380], bodega: [1300, 440], ghost: [520, 200], sewer: [1300, 720] };
  // secret branches
  const ghostKnown = E.S.secrets.ghost, sewerKnown = E.S.secrets.sewer;
  g.setLineDash([18, 16]);
  stroke(g, [pos.token, [380, 300], pos.ghost], { lw: 10, color: ghostKnown ? '#3ec7b0' : rgba('#140f26', 0.25), amp: 0 });
  stroke(g, [pos.bodega, [1320, 580], pos.sewer], { lw: 10, color: sewerKnown ? '#4f9a4a' : rgba('#140f26', 0.25), amp: 0 });
  g.setLineDash([]);
  // the line
  const pts = [pos.token, [550, 400], pos.drip, [1050, 360], pos.bodega];
  stroke(g, pts, { lw: 34, color: INK, amp: 1.5, seed: 9 });
  stroke(g, pts, { lw: 24, color: '#d4473f', amp: 1.5, seed: 9 });
  // stops
  const stop = (id, label, known = true) => {
    const [x, y] = pos[id];
    const here = id === current;
    if (here) {
      g.fillStyle = rgba('#ffd23f', 0.5);
      g.beginPath();
      g.arc(x, y, 58, 0, Math.PI * 2);
      g.fill();
    }
    ellipse(g, x, y, 30, 30, { fill: known ? '#fffaf0' : '#d8cfb8', lw: 6, seed: x });
    if (!known) text(g, '?', x, y + 13, { size: 36, font: FONTS.sign, fill: INK, lw: 0 });
    const ly = id === 'sewer' ? y + 76 : y - 54;
    text(g, known ? label : '???', x, ly, { size: 34, font: FONTS.sign, fill: INK, lw: 0 });
    if (here) {
      g.save();
      g.translate(x + 60, y + 50);
      g.rotate(-0.08);
      rrect(g, -6, -22, 186, 40, 6, { fill: '#ffd23f', lw: 4, seed: 4 });
      text(g, 'YOU ARE HERE', 87, 9, { size: 20, font: FONTS.sign, fill: INK, lw: 0 });
      g.restore();
    }
  };
  stop('token', 'TOKEN SQ');
  stop('drip', 'DRIP ST');
  stop('bodega', 'BODEGA BLVD');
  stop('ghost', 'OLD HALL', ghostKnown);
  stop('sewer', 'THE SEWERS', sewerKnown);
  // shop labels under each main stop
  for (const id of LINE) {
    const [x, y] = pos[id];
    const shops = Object.entries(SHOPS).filter(([, s]) => s.station === id && !s.secret);
    shops.forEach(([, s], i) => {
      const yy = y + 70 + i * 40;
      dot(g, x - 70, yy - 8, 10, s.color);
      g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.arc(x - 70, yy - 8, 10, 0, Math.PI * 2); g.stroke();
      text(g, s.name, x - 52, yy, { size: 22, font: FONTS.sign, fill: INK, lw: 0, align: 'left' });
    });
  }
}

export function openMap() {
  const current = api.current();
  E.S.seen.map = true;
  openOverlay('map', (panel, close) => {
    const head = panelHead('THE 3 TRAIN', 'Tap a stop to ride there. Secret stops show up once you find them.');
    const wrap = el('div', { class: 'map-wrap' });
    const canvas = el('canvas', { class: 'map-canvas', role: 'img', 'aria-label': 'Map of the 3 line: Token Sq, Drip St, Bodega Blvd, plus two unknown stops.' });
    wrap.append(canvas);
    const stops = el('div', { class: 'map-stops' });
    const all = [...LINE, 'sewer', 'ghost'];
    for (const id of all) {
      const sc = SCENES[id];
      const known = !sc.secret || E.S.secrets[id === 'ghost' ? 'ghost' : 'sewer'];
      const here = id === current;
      const ridable = LINE.includes(id) && !here;
      const card = el('button', { type: 'button', class: `stop-card${here ? ' here' : ''}${!ridable ? ' locked' : ''}`, disabled: !ridable && !here },
        el('h4', {}, el('span', { class: 'bullet' }, sc.secret ? '?' : '3'), known ? sc.name : '???'),
        el('p', {}, known ? sc.blurb : id === 'ghost' ? 'No scheduled service. Somebody wrote “midnight” on a wall at Bodega Blvd.' : 'Not on any map. Something about a maintenance door…'),
        here ? el('span', { class: 'badge', style: { alignSelf: 'flex-start' } }, 'YOU ARE HERE') : null,
        ridable ? el('span', { class: 'btn btn-sm btn-sun', style: { alignSelf: 'flex-start' } }, `RIDE TO ${sc.name}`) : null,
        id === 'sewer' && known && !here ? el('span', { class: 'note' }, 'Take the maintenance ladder at Bodega Blvd.') : null);
      if (ridable) card.addEventListener('click', () => { audio.click(); close(); api.travel(id); });
      stops.append(card);
    }
    const body = el('div', { class: 'panel-body' }, wrap, stops);
    panel.append(head, body, xButton(close));
    requestAnimationFrame(() => drawMap(canvas, current));
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => drawMap(canvas, current)) : null;
    if (ro) ro.observe(wrap);
    return { onClose: () => ro && ro.disconnect() };
  }, { label: 'Subway map' });
}
