// STORY UI — the flyer pinned next to the map: one race on one sheet. Races
// and cups are on cream paper, bosses on black; duels and bosses put the name
// (and the car) of who you're up against where the grid would go.
import { game } from '../../main.js';
import { vText, vWidth, text, paragraph } from '../../core/ui.js';
import { settings } from '../../core/settings.js';
import { CAR_BY_ID } from '../../car/cars.js';
import { TRACK_BY_ID } from '../../track/tracks.js';
import { CHAPTERS, RIVALS, CUP_POINTS } from '../../story/data.js';
import { story } from '../../story/state.js';
import { knockLaps } from '../../race/sim.js';
import { drawTrackMap, trackInfo, fmtDistance } from '../trackmap.js';
import { TYPE_NAMES } from '../showroom.js';
import { money, ord, paper, stamp, PAPER, INK, SUBINK, NIGHT, NIGHT_INK, NIGHT_SUB } from './common.js';

export const FLYER_W = 384, FLYER_H = 560;
const trackName = (id) => TRACK_BY_ID[id]?.name || id.toUpperCase();
const carName = (id) => { const sp = CAR_BY_ID[id]; return sp ? `${sp.make} ${sp.model}` : id.toUpperCase(); };

/** Who you race: the boss, the duel rival, or null for a grid. */
export function opponentOf(ev) {
  if (ev.boss) return CHAPTERS[ev.ch].boss;
  if (ev.kind === 'duel') return RIVALS[ev.vs];
  return null;
}

function lapsLabel(ev, def) {
  if (ev.type === 'sprint') return 'A TO B';
  if (ev.type === 'drag') return 'ONE RUN';
  if (ev.type === 'knockout') return String(knockLaps(ev.rivals, def?.laps));
  if (ev.type === 'timeattack') return def?.type === 'sprint' ? '1 RUN' : `BEST OF ${Math.max(2, def?.laps || 3)}`;
  return String(ev.laps || def?.laps || 3);
}

function lengthLabel(ev, def) {
  if (ev.type === 'drag') return '1/4 MILE';
  if (!def) return 'TBA';
  const info = trackInfo(def);
  return fmtDistance(info.closed ? info.length : info.finishS - info.startS, settings.get('units'));
}

function facts(ev) {
  if (ev.kind === 'cup') {
    const cup = story.s.cup?.id === ev.id ? story.s.cup : null;
    const done = story.s.events[ev.id]?.won;
    return [['FORMAT', '3 RACES'], ['POINTS', CUP_POINTS.slice(0, 4).join('-')], ['RIVALS', String(ev.rivals)],
      ['STATUS', cup ? `ROUND ${cup.round + 1} OF 3` : done ? 'CHAMPION' : 'NOT STARTED']];
  }
  const def = TRACK_BY_ID[ev.track];
  const opp = opponentOf(ev);
  return [
    ['TYPE', TYPE_NAMES[ev.type] || ev.type.toUpperCase()],
    ['LAPS', lapsLabel(ev, def)],
    ['LENGTH', lengthLabel(ev, def)],
    [opp ? 'VERSUS' : 'RIVALS', ev.type === 'timeattack' ? 'THE CLOCK' : ev.type === 'drift' ? 'POSTED SCORES' : opp ? opp.name : String(ev.rivals)],
  ];
}

/** The line under the ratings: who's on the grid, or who you're up against. */
function gridLines(ev) {
  const opp = opponentOf(ev);
  if (opp) return [`${opp.name} IN A ${carName(opp.car).toUpperCase()}`, `"${opp.quote}"`];
  if (ev.type === 'drift') return [`POSTED: ${story.driftRivals(ev).map((d) => d[0]).join(' · ')}`];
  if (ev.type === 'timeattack') return [`TARGET: A PRO'S PACE +${Math.round((ev.tt - 1) * 1000) / 10}%`];
  const names = story.rivals(ev).map((r) => r.name + (r.guest ? '*' : ''));
  const lines = [`ON THE GRID: ${names.join(' · ')}`];
  if (names.some((n) => n.endsWith('*'))) lines.push('* A BOSS YOU ALREADY BEAT, BACK FOR MORE');
  return lines;
}

function drawMapBox(ctx, ev, x, y, w, h) {
  const def = TRACK_BY_ID[ev.track];
  if (def) {
    drawTrackMap(ctx, def, x, y, w, h, { t: game.time, grid: false });
    text(ctx, def.name, x + 10, y + 22, { size: 12, color: '#fff', weight: 900, spacing: 1.5 });
  } else {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    text(ctx, trackName(ev.track), x + w / 2, y + h / 2 - 6, { size: 14, color: '#bbb', weight: 900, align: 'center', spacing: 1.5 });
    text(ctx, 'COMING SOON', x + w / 2, y + h / 2 + 16, { size: 12, color: '#777', weight: 900, align: 'center', spacing: 2 });
  }
}

/** A cup's three rounds, with your finish in the ones already run. */
function drawRounds(ctx, ev, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,16,24,0.94)';
  ctx.fillRect(x, y, w, h);
  const cup = story.s.cup?.id === ev.id ? story.s.cup : null;
  text(ctx, 'THREE RACES · ONE NIGHT', x + 12, y + 22, { size: 11, color: '#46e8ff', weight: 900, spacing: 2 });
  ev.rounds.forEach((r, k) => {
    const ry = y + 52 + k * 30;
    const cur = cup && k === cup.round;
    if (cur) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(x + 4, ry - 20, w - 8, 28); }
    text(ctx, String(k + 1), x + 14, ry, { size: 13, color: cur ? '#ffb21e' : '#8c95a8', weight: 900 });
    const nm = trackName(r.track);
    vText(ctx, nm, x + 34, ry, Math.min(14, 170 / Math.max(1, vWidth(nm, 1))), { color: '#fff' });
    const what = r.type === 'circuit' ? `${r.laps} LAPS` : TYPE_NAMES[r.type];
    let right = what;
    if (cup && k < cup.round) {
      const pl = (cup.log[k] || []).indexOf('YOU') + 1;
      right = pl ? ord(pl) : 'OUT';
    } else if (cur) right = `NEXT · ${what}`;
    text(ctx, right, x + w - 12, ry, { size: 12, color: cur ? '#ffb21e' : cup && k < cup.round ? '#4dff8b' : '#8c95a8', weight: 900, align: 'right' });
  });
  let foot = `${CUP_POINTS.slice(0, 6).join('-')} POINTS A ROUND`;
  if (cup) {
    const tab = story.cupStandings();
    const me = tab.findIndex((r) => r.player);
    foot = `YOU: ${tab[me]?.pts || 0} PTS, ${ord(me + 1)}  ·  LEADER: ${tab[0].player ? 'YOU' : `${tab[0].name} ${tab[0].pts}`}`;
  }
  text(ctx, foot, x + 12, y + h - 12, { size: 11, color: '#c9d1de', weight: 800, spacing: 1 });
}

/** The flyer for one event at (x, y). */
export function drawFlyer(ctx, ev, x, y) {
  const ch = CHAPTERS[ev.ch];
  const st = story.status(ev);
  const dark = !!ev.boss;
  const ink = dark ? NIGHT_INK : INK, sub = dark ? NIGHT_SUB : SUBINK;
  const w = FLYER_W, h = FLYER_H;
  paper(ctx, x, y, w, h, { rot: 0.018, color: dark ? NIGHT : PAPER, band: ch.color }, () => {
    const tag = ev.boss ? 'BOSS RACE' : ev.kind === 'duel' ? 'DUEL' : ev.kind === 'cup' ? 'INVITATION ONLY' : '';
    text(ctx, tag ? `${ch.crew}  ·  ${tag}` : ch.crew, 22, 34, { size: 11, color: dark ? ch.color : sub, weight: 900, spacing: 2, shadow: false });
    vText(ctx, ev.name, 22, 72, Math.min(30, (w - 44) / Math.max(1, vWidth(ev.name, 1))), { color: ink, skew: -0.1 });
    if (ev.kind === 'cup') drawRounds(ctx, ev, 22, 86, w - 44, 150);
    else drawMapBox(ctx, ev, 22, 86, w - 44, 150);
    facts(ev).forEach(([k, v], i) => {
      const fx = 22 + (i % 2) * 180, fy = 262 + Math.floor(i / 2) * 42;
      text(ctx, k, fx, fy, { size: 10, color: sub, weight: 900, spacing: 2, shadow: false });
      vText(ctx, v, fx, fy + 22, Math.min(16, 165 / Math.max(1, vWidth(v, 1))), { color: ink, skew: 0 });
    });
    // performance: yours against theirs
    const mine = story.pr();
    const theirs = ev.type === 'timeattack' || ev.type === 'drift' ? null : story.rivalPR(ev);
    text(ctx, 'YOUR PR', 22, 352, { size: 10, color: sub, weight: 900, spacing: 2, shadow: false });
    vText(ctx, String(mine), 22, 376, 22, { color: ink, skew: 0 });
    if (theirs) {
      const opp = opponentOf(ev);
      text(ctx, opp ? `${opp.name}'S PR` : 'RIVALS PR', 202, 352, { size: 10, color: sub, weight: 900, spacing: 2, shadow: false });
      const col = theirs > mine + 25 ? '#d42a2a' : theirs < mine - 25 ? '#2f9e57' : ink;
      vText(ctx, String(theirs), 202, 376, 22, { color: col, skew: 0 });
    }
    let ty = 402;
    gridLines(ev).forEach((ln, i) => {
      ty = paragraph(ctx, ln, 22, ty, w - 44, { size: 11, color: i ? sub : ink, weight: i ? 600 : 800, italic: i > 0 && !!opponentOf(ev), lineHeight: 15, shadow: false, spacing: i ? 0 : 0.5 });
    });
    paragraph(ctx, ev.flavor, 22, Math.max(ty + 8, 440), w - 44, { size: 13, color: ink, weight: 600, lineHeight: 17, shadow: false });
    // prize stamp (and the pink slip on a boss)
    const won = st === 'won';
    stamp(ctx, won ? 'WON' : money(ev.prize), w - 104, h - 44, { color: won ? '#2f9e57' : '#c21c1c', size: 24, w: 168 });
    if (ev.boss) stamp(ctx, 'PINK SLIP', 96, h - 40, { color: '#ff5ac8', size: 16, rot: 0.08, w: 140, double: true });
    if (st === 'locked') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      vText(ctx, 'LOCKED', w / 2, h / 2 - 10, 40, { align: 'center', color: '#fff', skew: 0 });
      const why = story.lockReason(ev);
      vText(ctx, why, w / 2, h / 2 + 24, Math.min(16, (w - 40) / Math.max(1, vWidth(why, 1))), { align: 'center', color: '#ffd34a', skew: 0 });
    } else if (!ev.boss) {
      const rec = story.s.events[ev.id];
      if (rec && !rec.won && rec.best) text(ctx, `BEST: ${ord(rec.best)}`, 22, h - 22, { size: 12, color: sub, weight: 900, spacing: 2, shadow: false });
    }
  });
}
