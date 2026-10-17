// STORY UI — the full-screen cards: a chapter opening (a new crew's poster),
// a chapter closing (the boss's poster, stamped), the pink slip you win off
// a boss, and the results card after every story race.
import { C, vText, vWidth, text, paragraph, panel } from '../../core/ui.js';
import { CAR_BY_ID } from '../../car/cars.js';
import { CHAPTERS, RIVALS, EVENT_BY_ID, TIER_NAMES, TIER_UNLOCK, DEALER_CLASS_UNLOCK } from '../../story/data.js';
import { RANKS } from '../../story/rep.js';
import { story } from '../../story/state.js';
import { money, ord, paper, stamp, drawRank, INK, SUBINK, NIGHT, NIGHT_INK, NIGHT_SUB } from './common.js';

const carName = (id) => { const sp = CAR_BY_ID[id]; return `${sp.make} ${sp.model}`; };
const fit = (s, w, max) => Math.min(max, w / Math.max(1, vWidth(s, 1)));

/** What beating chapter ch's boss opens up, as short lines. */
export function unlocksAfter(ch) {
  const out = [];
  const next = CHAPTERS[ch + 1];
  if (next) out.push(next.name === next.crew ? next.name : `${next.name}: ${next.crew}`);
  TIER_UNLOCK.forEach((c, t) => { if (t && c === ch + 1) out.push(`${TIER_NAMES[t]} PARTS ON THE SHELF`); });
  Object.entries(DEALER_CLASS_UNLOCK).forEach(([cls, c]) => { if (c === ch + 1) out.push(`${cls}-CLASS ON THE DEALER LOT`); });
  const b = CHAPTERS[ch].boss;
  out.push(`PINK SLIP: ${b.name}'S ${CAR_BY_ID[b.car].model}`);
  return out;
}

/** card: { kind: 'intro' | 'outro', ch }. k: fade 0..1. */
export function drawChapterCard(ctx, card, k = 1) {
  const chap = CHAPTERS[card.ch];
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  ctx.fillRect(0, 0, 1024, 768);
  const last = card.ch === CHAPTERS.length - 1;
  if (card.kind === 'intro') {
    paper(ctx, 182, 62, 660, 610, { rot: -0.012, band: chap.color, bandH: 12 }, (w, h) => {
      text(ctx, `CHAPTER ${card.ch + 1} OF ${CHAPTERS.length}`, 36, 52, { size: 12, color: SUBINK, weight: 900, spacing: 3, shadow: false });
      vText(ctx, chap.name, 34, 112, fit(chap.name, w - 250, 52), { color: INK, skew: -0.1 });
      const band = chap.crew === chap.name ? 'PIRATE RADIO 92.7 FM' : chap.crew;
      ctx.fillStyle = chap.color;
      ctx.fillRect(36, 128, Math.min(w - 72, vWidth(band, 22) + 24), 30);
      vText(ctx, band, 46, 152, 22, { color: '#fff', outline: 2, outlineColor: 'rgba(0,0,0,0.55)', skew: -0.1 });
      paragraph(ctx, chap.intro, 36, 196, w - 72, { size: 16, color: INK, weight: 600, lineHeight: 22, shadow: false });
      ctx.fillStyle = 'rgba(22,20,15,0.25)';
      ctx.fillRect(36, 300, w - 72, 2);
      // the boss
      const b = chap.boss;
      text(ctx, 'THE BOSS', 36, 332, { size: 11, color: SUBINK, weight: 900, spacing: 2.5, shadow: false });
      vText(ctx, b.name, 36, 372, 34, { color: INK, skew: -0.1 });
      text(ctx, carName(b.car).toUpperCase(), 38, 396, { size: 12, color: SUBINK, weight: 900, spacing: 1, shadow: false });
      paragraph(ctx, `"${b.quote}"`, 38, 424, 280, { size: 15, color: INK, weight: 700, italic: true, lineHeight: 20, shadow: false });
      // the crew
      text(ctx, 'THE CREW', 360, 332, { size: 11, color: SUBINK, weight: 900, spacing: 2.5, shadow: false });
      chap.members.forEach((id, i) => {
        const R = RIVALS[id];
        const x = 360 + (i % 2) * 130, y = 364 + Math.floor(i / 2) * 44;
        vText(ctx, R.name, x, y, fit(R.name, 120, 16), { color: INK, skew: -0.1 });
        text(ctx, CAR_BY_ID[R.car].model, x + 1, y + 15, { size: 10, color: SUBINK, weight: 800, shadow: false });
      });
      ctx.fillStyle = 'rgba(22,20,15,0.25)';
      ctx.fillRect(36, 500, w - 72, 2);
      const need = last
        ? `${story.events(card.ch).length - 1} RACES ALL OVER THE CITY. TAKE DOWN EVERY OTHER CREW, WIN ${chap.bossWins}, REACH ${chap.bossRep.toLocaleString()} REP: THEN ZERO CALLS.`
        : `${story.events(card.ch).length - 1} RACES ON THE BOARD. WIN ${chap.bossWins} AND REACH ${chap.bossRep.toLocaleString()} REP, AND ${b.name} WILL CALL YOU OUT.`;
      paragraph(ctx, need, 36, 532, w - 72, { size: 13, color: INK, weight: 800, lineHeight: 18, shadow: false, spacing: 0.5 });
      stamp(ctx, 'NOW OPEN', w - 120, 76, { color: chap.color, size: 22, rot: 0.12, w: 168, double: true });
    });
  } else {
    paper(ctx, 182, 62, 660, 610, { rot: 0.012, color: NIGHT, band: chap.color, bandH: 12, pin: '#ffd34a' }, (w, h) => {
      text(ctx, last ? 'THE LAST CHAPTER' : `CHAPTER ${card.ch + 1} COMPLETE`, 36, 52, { size: 12, color: chap.color, weight: 900, spacing: 3, shadow: false });
      const title = last ? 'PORT HALCYON IS YOURS' : chap.crew;
      vText(ctx, title, 34, 110, fit(title, w - 72, 46), { color: NIGHT_INK, skew: -0.1 });
      text(ctx, `${chap.boss.name} IS DONE  ·  ${chap.name}`, 36, 140, { size: 13, color: NIGHT_SUB, weight: 900, spacing: 2, shadow: false });
      paragraph(ctx, chap.outro, 36, 184, w - 72, { size: 16, color: NIGHT_INK, weight: 600, lineHeight: 22, shadow: false });
      ctx.fillStyle = 'rgba(241,236,220,0.2)';
      ctx.fillRect(36, 300, w - 72, 2);
      if (last) {
        const st = story.s.stats;
        text(ctx, 'THE CAREER', 36, 332, { size: 11, color: NIGHT_SUB, weight: 900, spacing: 2.5, shadow: false });
        const rows = [['RACES', String(st.races)], ['WINS', String(st.wins)], ['EARNED', money(st.earned)], ['STREET RANK', RANKS[story.s.rank]?.name || '']];
        rows.forEach(([k2, v], i) => {
          const x = 36 + (i % 2) * 290, y = 362 + Math.floor(i / 2) * 58;
          text(ctx, k2, x, y, { size: 10, color: NIGHT_SUB, weight: 900, spacing: 2, shadow: false });
          vText(ctx, v, x, y + 28, fit(v, 260, 24), { color: NIGHT_INK, skew: 0 });
        });
        paragraph(ctx, 'The crews still want their rematches. The board stays up, the radio stays on.', 36, 512, 330, { size: 14, color: NIGHT_SUB, weight: 700, lineHeight: 19, shadow: false });
        stamp(ctx, 'THE END', w - 150, h - 84, { color: '#ffd34a', size: 30, rot: -0.14, w: 210, double: true });
      } else {
        text(ctx, 'NOW OPEN', 36, 332, { size: 11, color: NIGHT_SUB, weight: 900, spacing: 2.5, shadow: false });
        unlocksAfter(card.ch).forEach((ln, i) => {
          text(ctx, '►', 38, 366 + i * 32, { size: 12, color: chap.color, weight: 900, shadow: false });
          vText(ctx, ln, 60, 368 + i * 32, fit(ln, w - 110, 16), { color: NIGHT_INK, skew: 0 });
        });
        stamp(ctx, 'BEATEN', w - 130, 470, { color: '#4dff8b', size: 30, rot: -0.14, w: 190, double: true });
      }
    });
  }
  ctx.restore();
}

/** The pink slip: a title certificate, the boss's name struck through. */
export function drawSlipPaper(ctx, slip, x, y) {
  const b = RIVALS[slip.rival];
  const sp = CAR_BY_ID[slip.car];
  paper(ctx, x, y, 420, 300, { rot: 0.02, color: '#f7cfdc', pin: '#c21c1c' }, (w, h) => {
    ctx.strokeStyle = 'rgba(120,30,60,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    text(ctx, 'STATE OF HALCYON  ·  MOTOR VEHICLES', w / 2, 40, { size: 10, color: '#7a2a44', weight: 900, spacing: 2, align: 'center', shadow: false });
    vText(ctx, 'CERTIFICATE OF TITLE', w / 2, 72, 20, { align: 'center', color: '#5a1430', skew: 0 });
    const rows = [['MAKE', sp.make], ['MODEL', sp.model], ['YEAR', String(sp.year)], ['CLASS', sp.cls], ['PR', String(story.slipPR(slip))]];
    rows.forEach(([k, v], i) => {
      const yy = 104 + i * 26;
      text(ctx, k, 34, yy, { size: 10, color: '#7a2a44', weight: 900, spacing: 2, shadow: false });
      text(ctx, v, 120, yy, { size: 14, color: '#2a0a16', weight: 800, shadow: false, font: 'Georgia, "Times New Roman", serif' });
    });
    text(ctx, 'REGISTERED OWNER', 34, 250, { size: 10, color: '#7a2a44', weight: 900, spacing: 2, shadow: false });
    vText(ctx, b.name, 34, 278, 18, { color: '#2a0a16', skew: 0 });
    const bw = vWidth(b.name, 18);
    ctx.strokeStyle = '#c21c1c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, 270); ctx.lineTo(38 + bw, 266); ctx.stroke();
    vText(ctx, 'YOU', 54 + bw, 280, 22, { color: '#c21c1c', skew: -0.25 });
    stamp(ctx, 'TRANSFERRED', w - 112, h - 92, { color: '#c21c1c', size: 18, rot: -0.2, w: 176 });
  });
}

/** The results card. res: a story summary (state.js applyResult). */
export function drawResult(ctx, res) {
  const ev = EVENT_BY_ID[res.ev];
  if (!ev) return;
  const chap = CHAPTERS[ev.ch];
  const opp = ev.boss ? chap.boss : ev.kind === 'duel' ? RIVALS[ev.vs] : null;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, 1024, 768);
  const cupRound = ev.kind === 'cup' && !res.practice && !res.done;
  const good = cupRound ? res.roundPlace === 1 : res.won;
  const rankUp = res.rankUp !== null && res.rankUp !== undefined;
  panel(ctx, 132, 100, 760, 524, { accent: good ? C.green : C.red, accentLen: 320, alpha: 0.95 });
  text(ctx, `${chap.crew}  ·  ${ev.name}${ev.kind === 'cup' && res.round !== undefined ? `  ·  ROUND ${res.round + 1} OF ${res.rounds}` : ''}`, 172, 142, { size: 13, color: chap.color, weight: 900, spacing: 2 });
  let title;
  if (res.practice) title = 'PRACTICE RUN';
  else if (res.finished) title = 'PORT HALCYON IS YOURS';
  else if (cupRound) title = res.roundPlace ? `${ord(res.roundPlace)} PLACE` : 'KNOCKED OUT';
  else if (ev.kind === 'cup') title = res.won ? 'CUP WINNER' : `${ord(res.place)} IN THE CUP`;
  else if (res.won) title = ev.boss ? `${opp.name} IS DONE` : opp ? `${opp.name} IS BEATEN` : 'YOU WON';
  else if (ev.type === 'timeattack') title = 'TOO SLOW';
  else title = res.place ? `${ord(res.place)} PLACE` : 'OUT';
  vText(ctx, title, 170, 196, fit(title, 690, 44), { color: good ? C.green : '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.6)' });
  // money
  const pay = res.pay ? `+${money(res.pay)}` : '$0';
  text(ctx, 'PAYOUT', 172, 244, { size: 12, color: C.dim, weight: 800, spacing: 2 });
  vText(ctx, pay, 172, 282, fit(pay, 300, 32), { color: res.pay ? C.green : C.dim });
  text(ctx, `CASH  ${money(story.s.cash)}`, 174, 308, { size: 13, color: '#c8d0dc', weight: 800, spacing: 1 });
  // what happened
  const lines = [];
  const R = (id) => RIVALS[id];
  const names = (l) => (l.length > 3 ? `${l.slice(0, 3).join(', ')} +${l.length - 3}` : l.join(', '));
  if (res.fresh?.length) lines.push([`FIRST WIN OVER ${names(res.fresh)}`, C.cyan]);
  const old = (res.beaten || []).filter((n) => !res.fresh?.includes(n));
  if (old.length) lines.push([`BEAT ${names(old)} AGAIN`, '#c8d0dc']);
  for (const ch of res.bossCalls || []) lines.push([`${CHAPTERS[ch].boss.name} WANTS A WORD`, C.accent]);
  for (const id of res.unlocked || []) {
    const e = EVENT_BY_ID[id];
    if (!e) continue;
    lines.push([e.kind === 'duel' ? `${R(e.vs).name} WANTS A DUEL` : e.kind === 'cup' ? `INVITED TO THE ${e.name}` : `NEW RACE: ${e.name}`, C.accent]);
  }
  if (res.slip) lines.push([`PINK SLIP: ${R(res.slip.rival).name}'S ${CAR_BY_ID[res.slip.car].model}`, '#ff8ad0']);
  if (res.chapterUp !== null && res.chapterUp !== undefined) lines.push([`CHAPTER ${res.chapterUp + 1} OPEN: ${CHAPTERS[res.chapterUp].name}`, C.cyan]);
  if (res.finished) lines.push(['YOU RUN THE FREQUENCY NOW', C.cyan]);
  if (res.newMessages) lines.push([`${res.newMessages} NEW MESSAGE${res.newMessages > 1 ? 'S' : ''}`, '#8affc0']);
  if (res.practice) lines.push(['THIS ROUND IS ALREADY ON THE SCORESHEET', C.dim]);
  if (!lines.length && !res.won && !res.pay) lines.push(['TUNE THE CAR, TRY AGAIN', C.dim]);
  lines.slice(0, 8).forEach(([s, col], i) => vText(ctx, s, 172, 352 + i * 30, fit(s, 320, 16), { color: col }));
  // right column: the cup table, or the REP sheet
  const rx = 528, rw = 330;
  if (ev.kind === 'cup' && res.standings?.length) {
    text(ctx, res.done ? 'FINAL STANDINGS' : 'STANDINGS', rx, 244, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    res.standings.slice(0, 6).forEach((r, i) => {
      const y = 278 + i * 28;
      if (r.player) { ctx.fillStyle = 'rgba(70,232,255,0.14)'; ctx.fillRect(rx - 8, y - 20, rw + 16, 27); }
      vText(ctx, String(i + 1), rx, y, 16, { color: r.player ? C.cyan : C.dim });
      vText(ctx, r.name, rx + 34, y, fit(r.name, 200, 16), { color: r.player ? C.cyan : '#e6ebf3' });
      text(ctx, `${r.pts} PTS`, rx + rw, y, { size: 14, color: r.player ? C.cyan : '#c8d0dc', weight: 900, align: 'right' });
    });
    if (res.rep) text(ctx, `+${res.rep.toLocaleString()} REP`, rx, 458, { size: 14, color: C.cyan, weight: 900, spacing: 1 });
  } else {
    const rep = res.rep ? `+${res.rep.toLocaleString()} REP` : '+0 REP';
    text(ctx, 'STREET REP', rx, 244, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, rep, rx, 282, fit(rep, 320, 32), { color: res.rep ? C.cyan : C.dim });
    (res.repLines || []).slice(0, 7).forEach(([label, n], i) => {
      const y = 318 + i * 24;
      text(ctx, label, rx, y, { size: 13, color: '#c8d0dc', weight: 800, spacing: 1 });
      text(ctx, `+${n}`, rx + rw, y, { size: 13, color: C.cyan, weight: 900, align: 'right' });
    });
  }
  drawRank(ctx, story.s.rep, rx, 522, rw, { label: rankUp ? 'NEW STREET RANK' : 'STREET RANK', color: rankUp ? C.cyan : '#fff' });
}
