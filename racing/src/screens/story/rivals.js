// STORY UI — THE LIST: every crew in Port Halcyon, who's in it, what they
// drive and whether you've beaten them. The first tab is the blacklist
// itself: the eight bosses, ZERO at #1. The car on the garage floor is the
// selected rival's own, in their own paint.
import { C, vText, vWidth, text, paragraph, panel, hit } from '../../core/ui.js';
import { CAR_BY_ID } from '../../car/cars.js';
import { CHAPTERS, RIVALS } from '../../story/data.js';
import { story } from '../../story/state.js';
import { CLASS_COLORS } from '../showroom.js';

export const LIST_TABS = CHAPTERS.length + 1;
/** Blacklist number: Dez is #8, ZERO is #1. */
export const listNo = (ch) => CHAPTERS.length - ch;

/** The rows on a tab (0 = the blacklist, k = crew k-1): boss first. */
export function rivalRows(tab) {
  const s = story.s;
  const row = (id, ch, boss) => ({ id, R: RIVALS[id], ch, boss, known: ch <= s.chapter, rec: story.rivalRec(id) });
  if (tab === 0) return CHAPTERS.map((c, ch) => row(c.boss.id, ch, true)).reverse();
  const ch = tab - 1;
  return [row(CHAPTERS[ch].boss.id, ch, true), ...CHAPTERS[ch].members.map((id) => row(id, ch, false))];
}

function status(r) {
  const s = story.s;
  if (!r.known) return ['UNKNOWN', C.faint];
  if (r.boss) return s.bosses[r.ch] ? ['BEATEN', C.green] : ['AT LARGE', C.red];
  if (r.rec.beat) return ['BEATEN', C.green];
  if (r.rec.met) return ['UNBEATEN', C.red];
  return ['NOT MET', C.dim];
}

/** o: { tab, sel }. Hit regions 'rtab:<k>' and 'rrow:<k>'. */
export function drawRivals(ctx, o) {
  const s = story.s;
  // tabs: the blacklist, then one per crew
  for (let k = 0; k < LIST_TABS; k++) {
    const x = k ? 146 + (k - 1) * 39 : 34;
    const w = k ? 35 : 106;
    const ch = k - 1;
    const open = !k || ch <= s.chapter;
    const col = k ? CHAPTERS[ch].color : C.accent;
    hit.add(`rtab:${k}`, x, 96, w, 34);
    ctx.fillStyle = k === o.tab ? col : 'rgba(10,14,22,0.8)';
    ctx.fillRect(x, 96, w, 34);
    if (k && k !== o.tab) { ctx.fillStyle = open ? col : C.faint; ctx.fillRect(x, 126, w, 4); }
    vText(ctx, k ? String(k) : 'THE LIST', x + w / 2, 120, 15, { align: 'center', color: k === o.tab ? '#14100a' : open ? C.dim : C.faint });
  }
  const rows = rivalRows(o.tab);
  const crew = o.tab ? CHAPTERS[o.tab - 1] : null;
  panel(ctx, 30, 140, 432, 572, { accent: crew ? crew.color : C.accent, alpha: 0.92, skew: 0 });
  // header
  if (!crew) {
    const down = CHAPTERS.filter((_, i) => s.bosses[i]).length;
    text(ctx, 'THE BLACKLIST', 54, 168, { size: 11, color: C.accent, weight: 900, spacing: 2 });
    vText(ctx, 'WHO RUNS PORT HALCYON', 52, 196, 20, { color: '#fff' });
    text(ctx, `${down} OF ${CHAPTERS.length} DOWN`, 438, 168, { size: 11, color: C.dim, weight: 900, spacing: 1.5, align: 'right' });
  } else {
    const open = o.tab - 1 <= s.chapter;
    const beaten = rows.filter((r) => status(r)[0] === 'BEATEN').length;
    text(ctx, `CHAPTER ${o.tab}  ·  ${open ? crew.name : '???'}`, 54, 168, { size: 11, color: crew.color, weight: 900, spacing: 2 });
    vText(ctx, open ? crew.crew : '? ? ?', 52, 196, Math.min(20, 380 / Math.max(1, vWidth(crew.crew, 1))), { color: '#fff' });
    if (open) text(ctx, `BEATEN ${beaten} OF ${rows.length}`, 438, 168, { size: 11, color: C.dim, weight: 900, spacing: 1.5, align: 'right' });
  }
  // rows
  const rowH = o.tab ? 46 : 40;
  rows.forEach((r, k) => {
    const y = 236 + k * rowH;
    const on = k === o.sel;
    hit.add(`rrow:${k}`, 40, y - 26, 412, rowH - 2);
    if (on) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(40, y - 26, 412, rowH - 4); }
    const chap = CHAPTERS[r.ch];
    if (r.boss) vText(ctx, `#${listNo(r.ch)}`, 52, y, 14, { color: r.known ? chap.color : C.faint });
    else {
      ctx.fillStyle = r.known ? chap.color : C.faint;
      ctx.fillRect(56, y - 10, 8, 8);
    }
    const name = r.known ? r.R.name : '???';
    vText(ctx, name, 92, y, Math.min(r.boss ? 18 : 16, 200 / Math.max(1, vWidth(name, 1))), { color: on ? '#fff' : r.known ? '#d8dee8' : C.faint });
    if (r.known) {
      const sp = CAR_BY_ID[r.R.car];
      text(ctx, o.tab ? `${sp.model}` : `${chap.crew}  ·  ${sp.model}`, 93, y + 14, { size: 10, color: C.dim, weight: 700, spacing: 0.5 });
    }
    const [label, col] = status(r);
    text(ctx, label, 438, y - 1, { size: 11, color: col, weight: 900, align: 'right', spacing: 1.5 });
    if (r.known && !r.boss && r.rec.met) text(ctx, `${r.rec.beat}-${r.rec.lost}`, 438, y + 14, { size: 10, color: C.dim, weight: 800, align: 'right' });
  });
  // the file on whoever's selected
  const r = rows[o.sel];
  if (!r) return;
  const y0 = 236 + rows.length * rowH;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(48, y0 - 16, 396, 1);
  if (!r.known) {
    const prev = CHAPTERS[r.ch - 1];
    paragraph(ctx, `Nobody in Port Halcyon talks about this crew yet. Take down ${prev?.boss.name || 'the crew before'} and the word gets round.`, 54, y0 + 8, 380, { size: 13, color: C.dim, weight: 600, lineHeight: 18 });
    return;
  }
  const chap = CHAPTERS[r.ch];
  text(ctx, r.boss ? `BOSS  ·  ${r.R.style}  ·  BLACKLIST #${listNo(r.ch)}` : `${chap.crew}  ·  ${r.R.style}`, 54, y0 + 6, { size: 11, color: chap.color, weight: 900, spacing: 1.5 });
  const yy = paragraph(ctx, r.R.bio, 54, y0 + 28, 384, { size: 13, color: '#c8d0dc', weight: 600, lineHeight: 17 });
  paragraph(ctx, `"${r.R.quote}"`, 54, Math.min(yy + 6, 700), 384, { size: 13, color: '#fff', weight: 700, italic: true, lineHeight: 17 });
}

/** The chip in the corner: the selected rival's car. */
export function drawRivalCar(ctx, r, x, y) {
  if (!r?.known) return;
  const sp = CAR_BY_ID[r.R.car];
  panel(ctx, x, y, 356, 76, { accent: CLASS_COLORS[sp.cls], accentLen: 120, alpha: 0.9 });
  text(ctx, `${r.R.name}'S RIDE  ·  CLASS ${sp.cls}`, x + 24, y + 26, { size: 11, color: C.dim, weight: 800, spacing: 1.5 });
  const nm = `${sp.make} ${sp.model}`;
  vText(ctx, nm, x + 24, y + 58, Math.min(22, (r.boss ? 240 : 300) / Math.max(1, vWidth(nm, 1))), { color: '#fff' });
  if (r.boss) {
    text(ctx, 'PR', x + 290, y + 26, { size: 11, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, String(CHAPTERS[r.ch].boss.pr), x + 334, y + 58, 24, { align: 'right', color: C.accent });
  }
}
