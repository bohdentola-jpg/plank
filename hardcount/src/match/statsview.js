// The box score as a broadcast graphic: team comparison bars and the leaders.
// Used by the pause menu, halftime and the final.
import { vText, text, C } from '../core/ui.js';
import { drawLogo } from '../gfx/logos.js';
import { glossBar, shadeHex, lum } from './hud.js';

function playerLines(m) {
  const list = [...m.stats.players.values()];
  const best = (key, side) => list.filter((p) => p.side === side && (p[key] || 0) > 0).sort((a, b) => (b[key] || 0) - (a[key] || 0))[0];
  const out = { home: [], away: [] };
  for (const side of ['home', 'away']) {
    const qb = best('passYds', side);
    if (qb) out[side].push({ name: qb.name, pos: 'QB', line: `${qb.comp || 0}/${qb.att || 0}, ${qb.passYds || 0} YDS, ${qb.passTd || 0} TD${qb.intsThrown ? `, ${qb.intsThrown} INT` : ''}` });
    const rb = best('rushYds', side);
    if (rb) out[side].push({ name: rb.name, pos: rb.pos, line: `${rb.car || 0} CAR, ${rb.rushYds || 0} YDS${rb.td ? `, ${rb.td} TD` : ''}` });
    const wr = best('recYds', side);
    if (wr) out[side].push({ name: wr.name, pos: wr.pos, line: `${wr.rec || 0} REC, ${wr.recYds || 0} YDS${wr.td ? `, ${wr.td} TD` : ''}` });
    const d = best('tackles', side);
    if (d) out[side].push({ name: d.name, pos: d.pos, line: `${d.tackles || 0} TKL${d.sacks ? `, ${d.sacks} SACK` : ''}${d.ints ? `, ${d.ints} INT` : ''}` });
  }
  return out;
}

/** Player of the game: the biggest line on the winning side. */
export function playerOfGame(m) {
  const win = m.score.home >= m.score.away ? 'home' : 'away';
  let best = null, bs = -1;
  for (const p of m.stats.players.values()) {
    if (p.side !== win) continue;
    const s = (p.passYds || 0) * 0.05 + (p.passTd || 0) * 4 + (p.rushYds || 0) * 0.1 + (p.recYds || 0) * 0.1 + (p.td || 0) * 6
      + (p.tackles || 0) * 0.8 + (p.sacks || 0) * 3 + (p.ints || 0) * 5 - (p.intsThrown || 0) * 3 + (p.retYds || 0) * 0.05;
    if (s > bs) { bs = s; best = p; }
  }
  return best;
}

export function drawBoxScore(ctx, m, opts = {}) {
  const x = opts.x ?? 152, y = opts.y ?? 128, w = opts.w ?? 720;
  const title = opts.title || 'GAME STATS';
  ctx.save();
  glossBar(ctx, x, y, w, 44, '#38383e', '#0c0c0f');
  vText(ctx, title, x + w / 2, y + 31, 24, { align: 'center', color: '#ffd23a', weight: 0.2 });
  // team header
  const hy = y + 44;
  for (const [i, side] of [['away', 0], ['home', 1]].map(([s, k]) => [k, s])) {
    const team = m.teams[side];
    const col = team.colors.primary;
    const bx = i === 0 ? x : x + w / 2;
    glossBar(ctx, bx, hy, w / 2, 64, shadeHex(col, 0.15), shadeHex(col, -0.4));
    try { drawLogo(ctx, team, bx + 40, hy + 32, 50); } catch { /* */ }
    vText(ctx, `${team.city}`.toUpperCase(), bx + 76, hy + 28, 15, { color: lum(col) > 0.62 ? '#111' : '#dfe6f2', weight: 0.18 });
    vText(ctx, team.name.toUpperCase(), bx + 76, hy + 52, 21, { color: lum(col) > 0.62 ? '#111' : '#ffffff', weight: 0.2 });
    vText(ctx, String(m.score[side]), bx + w / 2 - 24, hy + 48, 38, { align: 'right', color: lum(col) > 0.62 ? '#111' : '#ffffff', weight: 0.2, outline: 2, outlineColor: 'rgba(0,0,0,0.4)' });
  }
  // the rows
  const A = m.stats.away, Hm = m.stats.home;
  const rows = [
    ['FIRST DOWNS', A.firstDowns, Hm.firstDowns],
    ['TOTAL YARDS', A.yards, Hm.yards],
    ['PASSING', `${A.comp}/${A.att} · ${A.passYds}`, `${Hm.comp}/${Hm.att} · ${Hm.passYds}`, A.passYds, Hm.passYds],
    ['RUSHING', A.rushYds, Hm.rushYds],
    ['3RD DOWN', `${A.thirdConv}/${A.third}`, `${Hm.thirdConv}/${Hm.third}`, A.thirdConv, Hm.thirdConv],
    ['TURNOVERS', A.ints + A.fumblesLost, Hm.ints + Hm.fumblesLost],
    ['SACKS', A.sacks, Hm.sacks],
    ['LATERALS', A.laterals, Hm.laterals],
    ['PENALTIES', `${A.penalties}-${A.penYds}`, `${Hm.penalties}-${Hm.penYds}`, A.penalties, Hm.penalties],
  ];
  let ry = hy + 64;
  rows.forEach((r, k) => {
    glossBar(ctx, x, ry, w, 28, k % 2 ? '#1b2231' : '#222a3b', k % 2 ? '#0b0e15' : '#0e121a', false);
    const va = r[3] ?? r[1], vh = r[4] ?? r[2];
    const tot = Math.max(1, Math.abs(+va || 0) + Math.abs(+vh || 0));
    // comparison bars from the middle out
    const bw = w * 0.16;
    ctx.fillStyle = m.teams.away.colors.primary;
    ctx.fillRect(x + w / 2 - 92 - bw * (Math.abs(+va || 0) / tot), ry + 11, bw * (Math.abs(+va || 0) / tot), 6);
    ctx.fillStyle = m.teams.home.colors.primary;
    ctx.fillRect(x + w / 2 + 92, ry + 11, bw * (Math.abs(+vh || 0) / tot), 6);
    text(ctx, String(r[1]), x + 22, ry + 20, { size: 15, weight: 800, color: '#ffffff' });
    text(ctx, r[0], x + w / 2, ry + 19, { size: 12, weight: 900, color: '#ffd23a', align: 'center', spacing: 1 });
    text(ctx, String(r[2]), x + w - 22, ry + 20, { size: 15, weight: 800, color: '#ffffff', align: 'right' });
    ry += 28;
  });
  // leaders
  if (opts.leaders !== false) {
    const L = playerLines(m);
    const ly = ry + 8;
    glossBar(ctx, x, ly, w, 24, '#38383e', '#0c0c0f', false);
    text(ctx, 'LEADERS', x + w / 2, ly + 17, { size: 12, weight: 900, color: '#ffd23a', align: 'center', spacing: 2 });
    const rowsN = Math.max(L.away.length, L.home.length);
    for (let i = 0; i < rowsN; i++) {
      const yy = ly + 24 + i * 34;
      glossBar(ctx, x, yy, w, 34, i % 2 ? '#1b2231' : '#222a3b', i % 2 ? '#0b0e15' : '#0e121a', false);
      for (const [side, bx, al] of [['away', x + 14, 'left'], ['home', x + w - 14, 'right']]) {
        const p = L[side][i];
        if (!p) continue;
        text(ctx, `${p.name.toUpperCase()}  ${p.pos}`, bx, yy + 15, { size: 12, weight: 900, color: '#ffffff', align: al, spacing: 1 });
        text(ctx, p.line, bx, yy + 29, { size: 12, weight: 700, color: '#c9d1df', align: al });
      }
    }
  }
  ctx.restore();
}
