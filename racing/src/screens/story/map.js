// STORY UI — the city map on the board: Port Halcyon's eight districts, the
// roads between them, and a pin for every race of the crew you're looking at,
// placed in the district where that race actually runs.
import { text, hit } from '../../core/ui.js';
import { makeRng } from '../../core/util.js';
import { CHAPTERS, TRACK_DISTRICT } from '../../story/data.js';
import { story } from '../../story/state.js';
import { hexA } from './common.js';

/** District centres as fractions of the map. Each is one crew's home turf. */
export const DISTRICTS = {
  pass: { x: 0.19, y: 0.23 },
  raceway: { x: 0.52, y: 0.19 },
  freq: { x: 0.85, y: 0.17 },
  chinatown: { x: 0.32, y: 0.52 },
  downtown: { x: 0.58, y: 0.47 },
  desert: { x: 0.85, y: 0.57 },
  docks: { x: 0.18, y: 0.82 },
  bayshore: { x: 0.57, y: 0.83 },
};
const R_DIST = 44;

export const eventDistrict = (ev) => TRACK_DISTRICT[ev.kind === 'cup' ? ev.rounds[0].track : ev.track] || CHAPTERS[ev.ch].district;

/** Where each of a chapter's pins sits on a w×h map: the boss in the middle
 *  of its district, everything else on a ring round the district centre. */
export function pinLayout(ch, w, h) {
  const evs = story.events(ch);
  const groups = {};
  evs.forEach((ev, k) => { (groups[eventDistrict(ev)] ||= []).push({ ev, k }); });
  const out = [];
  for (const [d, list] of Object.entries(groups)) {
    const c = DISTRICTS[d];
    const cx = c.x * w, cy = c.y * h;
    const ring = list.filter((p) => !p.ev.boss);
    const r = ring.length > 6 ? 33 : 29;
    ring.forEach((p, i) => {
      const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      out.push({ ...p, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    });
    for (const p of list) if (p.ev.boss) out.push({ ...p, x: cx, y: cy });
  }
  return out.sort((a, b) => a.k - b.k);
}

function pinShape(ctx, kind, px, py, r) {
  ctx.beginPath();
  if (kind === 'duel') {
    ctx.moveTo(px, py - r * 1.2); ctx.lineTo(px + r * 1.2, py); ctx.lineTo(px, py + r * 1.2); ctx.lineTo(px - r * 1.2, py); ctx.closePath();
  } else if (kind === 'cup') {
    ctx.rect(px - r, py - r, r * 2, r * 2);
  } else {
    ctx.arc(px, py, r, 0, Math.PI * 2);
  }
}

/**
 * The map on the board. o: { ch (crew shown), sel (selected event index), t }.
 * Registers hit regions 'dist:<chapter>' and 'pin:<event index>'.
 */
export function drawCityMap(ctx, x, y, w, h, o) {
  const s = story.s;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.012);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#e6dfc8';
  ctx.fillRect(0, 0, w, h);
  ctx.shadowBlur = 0;
  const rng = makeRng('citymap');
  const P = (d) => [DISTRICTS[d].x * w, DISTRICTS[d].y * h];
  // the bay
  ctx.fillStyle = '#9cbbd0';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.64);
  ctx.bezierCurveTo(w * 0.2, h * 0.6, w * 0.34, h * 0.86, w * 0.4, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // the long bridge over the bay
  ctx.strokeStyle = 'rgba(90,80,60,0.6)';
  ctx.lineWidth = 1.5;
  for (const off of [-3, 3]) {
    ctx.beginPath(); ctx.moveTo(w * 0.47, h * 0.9 + off); ctx.lineTo(w * 0.08, h * 0.985 + off); ctx.stroke();
  }
  // container stacks on the quay
  ctx.fillStyle = 'rgba(120,96,70,0.4)';
  for (let k = 0; k < 14; k++) ctx.fillRect(w * 0.06 + rng() * w * 0.2, h * 0.7 + rng() * h * 0.06, 10 + rng() * 8, 4);
  // mountains
  ctx.strokeStyle = 'rgba(90,80,60,0.55)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 16; k++) {
    const px = 18 + rng() * w * 0.36, py = 24 + rng() * h * 0.3, sz = 9 + rng() * 14;
    ctx.beginPath(); ctx.moveTo(px - sz, py + sz * 0.6); ctx.lineTo(px, py - sz * 0.6); ctx.lineTo(px + sz, py + sz * 0.6); ctx.stroke();
  }
  // parkland round the raceway: trees and the oval
  ctx.fillStyle = 'rgba(70,110,60,0.35)';
  for (let k = 0; k < 40; k++) {
    ctx.beginPath(); ctx.arc(w * 0.38 + rng() * w * 0.28, h * 0.05 + rng() * h * 0.26, 2 + rng() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(90,80,60,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(w * 0.52, h * 0.19, 30, 15, -0.2, 0, Math.PI * 2); ctx.stroke();
  // desert stipple
  ctx.fillStyle = 'rgba(190,140,80,0.35)';
  for (let k = 0; k < 420; k++) ctx.fillRect(w * 0.7 + rng() * w * 0.3, h * 0.34 + rng() * h * 0.58, 2, 2);
  // street grids: downtown square, chinatown crooked
  ctx.strokeStyle = 'rgba(120,110,90,0.35)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 8; k++) {
    ctx.beginPath(); ctx.moveTo(w * 0.47 + k * 13, h * 0.37); ctx.lineTo(w * 0.47 + k * 13, h * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.45, h * 0.38 + k * 11); ctx.lineTo(w * 0.68, h * 0.38 + k * 11); ctx.stroke();
  }
  for (let k = 0; k < 6; k++) {
    ctx.beginPath(); ctx.moveTo(w * 0.24 + k * 11, h * 0.45 + k * 2); ctx.lineTo(w * 0.27 + k * 11, h * 0.61); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.23, h * 0.46 + k * 11); ctx.lineTo(w * 0.41, h * 0.45 + k * 12); ctx.stroke();
  }
  // highways between the districts
  ctx.strokeStyle = 'rgba(200,60,40,0.6)';
  ctx.lineWidth = 4;
  const road = (a, b, bend = 0) => {
    const [ax, ay] = P(a), [bx, by] = P(b);
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + bend, (ay + by) / 2 - bend, bx, by);
    ctx.stroke();
  };
  road('downtown', 'chinatown', 10); road('chinatown', 'docks', 20); road('chinatown', 'pass', -20);
  road('downtown', 'raceway', 20); road('raceway', 'pass', 16); road('downtown', 'desert', 18);
  road('downtown', 'bayshore', -14); road('bayshore', 'desert', 24);
  // the pirate signal: a mast and its rings over the city
  const [fx, fy] = P('freq');
  const freqOpen = s.chapter >= CHAPTERS.length - 1;
  ctx.strokeStyle = freqOpen ? 'rgba(164,92,240,0.75)' : 'rgba(60,60,60,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(fx - 10, fy + 18); ctx.lineTo(fx, fy - 18); ctx.lineTo(fx + 10, fy + 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx - 6, fy + 4); ctx.lineTo(fx + 6, fy + 4); ctx.moveTo(fx - 3, fy - 7); ctx.lineTo(fx + 3, fy - 7); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let k = 1; k <= 3; k++) {
    const pulse = freqOpen ? ((o.t * 0.6 + k / 3) % 1) : k / 3;
    ctx.globalAlpha = freqOpen ? 1 - pulse : 0.5;
    ctx.beginPath(); ctx.arc(fx, fy - 18, 8 + pulse * 22, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the districts
  const sel = CHAPTERS[o.ch];
  const pins = pinLayout(o.ch, w, h);
  const busy = new Set(pins.map((p) => eventDistrict(p.ev)));
  CHAPTERS.forEach((chap, i) => {
    const [cx, cy] = P(chap.district);
    const open = i <= s.chapter;
    const mine = i === o.ch;
    hit.add(`dist:${i}`, x + cx - R_DIST, y + cy - R_DIST, R_DIST * 2, R_DIST * 2);
    if (chap.district !== 'freq') {
      ctx.beginPath();
      ctx.arc(cx, cy, R_DIST, 0, Math.PI * 2);
      ctx.fillStyle = open ? hexA(chap.color, mine ? 0.22 : 0.12) : 'rgba(40,40,40,0.22)';
      ctx.fill();
      ctx.setLineDash(mine ? [] : [6, 5]);
      ctx.strokeStyle = open ? chap.color : 'rgba(60,60,60,0.6)';
      ctx.lineWidth = mine ? 3 : 2;
      ctx.stroke();
      ctx.setLineDash([]);
      // this crew races here too: a ring in the crew's colour
      if (!mine && busy.has(chap.district)) {
        ctx.beginPath(); ctx.arc(cx, cy, R_DIST + 5, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(sel.color, 0.8); ctx.lineWidth = 2; ctx.stroke();
      }
    } else if (mine) {
      ctx.beginPath(); ctx.arc(fx, fy, 30, 0, Math.PI * 2);
      ctx.strokeStyle = chap.color; ctx.lineWidth = 3; ctx.stroke();
    }
    const tower = chap.district === 'freq';
    // you know the place once you race there, even before you know its crew
    const named = open || busy.has(chap.district);
    text(ctx, named ? chap.name : '???', cx, tower ? cy + 36 : cy - R_DIST - 7, { size: 12, color: open ? '#1d1b16' : named ? '#3a362c' : '#5a5a5a', weight: 900, align: 'center', shadow: false, spacing: 1.5 });
    if (s.bosses[i]) text(ctx, 'BEATEN', cx, tower ? cy + 50 : cy + R_DIST + 15, { size: 10, color: '#1d6a32', weight: 900, align: 'center', shadow: false, spacing: 2 });
  });
  // a cup's three rounds, joined up
  const selEv = story.events(o.ch)[o.sel];
  if (selEv?.kind === 'cup') {
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(20,20,20,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    selEv.rounds.forEach((r, k) => { const [px, py] = P(TRACK_DISTRICT[r.track]); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // the crew's pins
  for (const p of pins) {
    const { ev, k, x: px, y: py } = p;
    const st = story.status(ev);
    const on = k === o.sel;
    const kind = ev.boss ? 'boss' : ev.kind;
    hit.add(`pin:${k}`, x + px - 13, y + py - 13, 26, 26);
    const r = (ev.boss ? 11 : kind === 'cup' ? 7 : 8) + (on ? 3 + Math.sin(o.t * 6) * 1.5 : 0);
    ctx.save();
    ctx.translate(1.5, 2);
    pinShape(ctx, kind, px, py, r);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();
    pinShape(ctx, kind, px, py, r);
    ctx.fillStyle = st === 'locked' ? '#777' : st === 'won' ? '#2f9e57' : ev.boss ? '#111' : st === 'cup' ? '#fff' : sel.color;
    ctx.fill();
    ctx.strokeStyle = on ? '#fff' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.stroke();
    if (st === 'cup') {
      ctx.beginPath(); ctx.arc(px, py, r + 5 + (o.t * 8) % 6, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(sel.color, 0.9); ctx.lineWidth = 2; ctx.stroke();
    }
    if (ev.boss) text(ctx, st === 'locked' ? '?' : '★', px, py + 5, { size: 14, color: '#ffd34a', weight: 900, align: 'center', shadow: false, font: 'Arial' });
    else if (st === 'won') text(ctx, '✓', px, py + 4, { size: 11, color: '#fff', weight: 900, align: 'center', shadow: false, font: 'Arial' });
    else if (st === 'cup') text(ctx, String((s.cup?.round ?? 0) + 1), px, py + 4, { size: 11, color: '#111', weight: 900, align: 'center', shadow: false, font: 'Arial' });
  }
  // tape, title, legend
  ctx.fillStyle = 'rgba(240,230,190,0.6)';
  ctx.fillRect(w / 2 - 50, -10, 100, 24);
  text(ctx, 'PORT HALCYON', 18, 30, { size: 18, color: '#1d1b16', weight: 900, shadow: false, spacing: 3 });
  const lg = [['race', 'RACE'], ['duel', 'DUEL'], ['cup', 'CUP'], ['boss', 'BOSS']];
  let lx = w - 238;
  for (const [kind, label] of lg) {
    pinShape(ctx, kind === 'boss' ? 'race' : kind, lx, h - 18, kind === 'boss' ? 7 : kind === 'cup' ? 5 : 6);
    ctx.fillStyle = kind === 'boss' ? '#111' : '#5a5446';
    ctx.fill();
    text(ctx, label, lx + 11, h - 14, { size: 10, color: '#3a362c', weight: 900, shadow: false, spacing: 1.5 });
    lx += 60;
  }
  ctx.restore();
}
