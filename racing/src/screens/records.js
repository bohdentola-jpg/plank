// RECORDS — HALL OF FAME 97.9. A wall of engraved brass plaques, one per road:
// best lap (or best run on sprints/drags), the car that set it, wins/races.
import { registerScreen, go } from '../main.js';
import { TRACKS } from '../track/tracks.js';
import { REGIONS } from './showroom.js';
import { C, text, vText, hints, roundRect } from '../core/ui.js';
import { input } from '../core/input.js';
import { store } from '../core/settings.js';
import { music } from '../audio/music.js';
import { fmtTime, makeRng } from '../core/util.js';
import { uiSound } from '../core/menu.js';
import { CHAPTERS } from '../story/data.js';

registerScreen('records', () => {
  let t = 0;
  let page = 0;
  let recs = {};
  const PER = 12;
  const order = () => {
    const regionIdx = Object.fromEntries(REGIONS.map((r, k) => [r[0], k]));
    return TRACKS.slice().sort((a, b) => (regionIdx[a.env] ?? 9) - (regionIdx[b.env] ?? 9));
  };
  return {
    enter() {
      recs = store.load('records') || {};
      try { if (music.theme !== 'records') music.play('records', { fade: 1 }); music.setTuning(0); } catch { /* */ }
    },
    update(dt, busy) {
      t += dt;
      try { music.update?.(); } catch { /* */ }
      if (busy) return;
      const pages = Math.ceil(TRACKS.length / PER);
      if (input.pressed('right') || input.pressed('tabR')) { page = (page + 1) % pages; uiSound('tab'); }
      if (input.pressed('left') || input.pressed('tabL')) { page = (page + pages - 1) % pages; uiSound('tab'); }
      if (input.pressed('back') || input.pressed('confirm')) go('radio', { station: 'records' });
    },
    draw(ctx) {
      // brushed dark steel wall
      const g = ctx.createLinearGradient(0, 0, 0, 768);
      g.addColorStop(0, '#1b1d22');
      g.addColorStop(1, '#0b0c0f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 768);
      const rng = makeRng('steel');
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = rng() < 0.5 ? '#fff' : '#000';
        ctx.fillRect(0, rng() * 768, 1024, 1);
      }
      ctx.globalAlpha = 1;

      text(ctx, 'HALL OF FAME 97.9', 56, 52, { size: 13, color: C.cyan, weight: 800, spacing: 3 });
      vText(ctx, 'RECORDS', 54, 98, 42, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.7)', shadow: [3, 3, 'rgba(0,0,0,0.5)'] });
      // totals
      const all = Object.values(recs);
      const races = all.reduce((s, r) => s + (r.races || 0), 0);
      const wins = all.reduce((s, r) => s + (r.wins || 0), 0);
      const story = store.load('story');
      const stats = [['RACES', String(races)], ['WINS', String(wins)], ['WIN RATE', races ? `${Math.round((wins / races) * 100)}%` : '--'], ['STORY', story ? `CH ${Math.min(CHAPTERS.length, (story.chapter ?? 0) + 1)}/${CHAPTERS.length}` : '--']];
      stats.forEach(([k, v], i) => {
        const x = 420 + i * 140;
        text(ctx, k, x, 66, { size: 11, color: C.dim, weight: 800, spacing: 2 });
        vText(ctx, v, x, 94, 22, { color: C.accent });
      });

      // plaques
      const list = order().slice(page * PER, page * PER + PER);
      list.forEach((d, k) => {
        const col = k % 2, row = Math.floor(k / 2);
        const x = 48 + col * 470, y = 130 + row * 92;
        const r = recs[d.id];
        // brass plate
        roundRect(ctx, x, y, 450, 80, 6);
        const pg = ctx.createLinearGradient(x, y, x + 450, y + 80);
        pg.addColorStop(0, r ? '#6b5426' : '#2a2b30');
        pg.addColorStop(0.45, r ? '#a88a4a' : '#3a3c42');
        pg.addColorStop(1, r ? '#5a4520' : '#232428');
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // screws
        for (const [sx, sy] of [[x + 10, y + 10], [x + 440, y + 10], [x + 10, y + 70], [x + 440, y + 70]]) {
          ctx.fillStyle = 'rgba(20,16,8,0.7)';
          ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
        }
        const ink = r ? '#1c1408' : '#62656e';
        const hi = r ? 'rgba(255,240,200,0.35)' : 'rgba(255,255,255,0.08)';
        const eng = (s, ex, ey, size, opts = {}) => {
          vText(ctx, s, ex + 1, ey + 1, size, { ...opts, color: hi, skew: 0 });
          vText(ctx, s, ex, ey, size, { ...opts, color: ink, skew: 0 });
        };
        eng(d.name, x + 24, y + 30, 16);
        const sub = `${(REGIONS.find((q) => q[0] === d.env) || [0, d.env])[1]} · ${d.type === 'drag' ? 'DRAG' : d.type === 'sprint' ? 'SPRINT' : 'CIRCUIT'}`;
        text(ctx, sub, x + 24, y + 50, { size: 11, color: r ? 'rgba(28,20,8,0.75)' : '#55585f', weight: 800, spacing: 2, shadow: false });
        if (r) {
          const best = d.type === 'sprint' || d.type === 'drag' ? r.bestTime ?? r.bestLap : r.bestLap;
          eng(best ? fmtTime(best) : '--:--.--', x + 426, y + 34, 20, { align: 'right' });
          text(ctx, (d.type === 'sprint' || d.type === 'drag' ? r.bestTimeCar ?? r.bestLapCar : r.bestLapCar) || '', x + 426, y + 52, { size: 11, color: 'rgba(28,20,8,0.8)', weight: 800, align: 'right', shadow: false });
          text(ctx, `${r.wins || 0} WIN${r.wins === 1 ? '' : 'S'} / ${r.races || 0} RACE${r.races === 1 ? '' : 'S'}`, x + 24, y + 68, { size: 10, color: 'rgba(28,20,8,0.7)', weight: 800, spacing: 1.5, shadow: false });
        } else {
          eng('UNRACED', x + 426, y + 34, 15, { align: 'right' });
        }
      });
      const pages = Math.ceil(TRACKS.length / PER);
      if (pages > 1) text(ctx, `PAGE ${page + 1} / ${pages}`, 512, 712, { size: 13, color: C.dim, weight: 800, align: 'center', spacing: 2 });
      hints(ctx, pages > 1 ? [['lr', 'PAGE'], ['back', 'BACK']] : [['back', 'BACK']], { y: 740 });
      void t;
    },
  };
});
