// HALL OF FAME — the trophy room: a dark wood wall of brass plaques. The
// record book (single-game bests), the trophy case, and the careers that
// went all the way.
import { registerScreen, go } from '../main.js';
import { input } from '../core/input.js';
import { uiSound } from '../core/menu.js';
import { vText, text, hints, C } from '../core/ui.js';
import { clamp, easeOutCubic } from '../core/util.js';
import { loadRecords, RECORD_NAMES } from '../data/records.js';
import { music } from '../audio/music.js';

function woodWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, '#2a160b'); g.addColorStop(0.5, '#3b2111'); g.addColorStop(1, '#24130a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 768);
  // planks
  for (let i = 0; i < 9; i++) {
    const x = i * 120 + ((i * 37) % 23);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, 0, 2, 768);
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = `rgba(${90 + k * 3},${50 + k},${20},0.07)`;
      ctx.beginPath();
      const y0 = (k * 61 + i * 17) % 768;
      ctx.moveTo(x + 6, y0);
      ctx.bezierCurveTo(x + 40, y0 + 30, x + 80, y0 - 20, x + 116, y0 + 12);
      ctx.stroke();
    }
  }
  // a pool of light from the top
  const r = ctx.createRadialGradient(512, -80, 40, 512, 120, 760);
  r.addColorStop(0, 'rgba(255,220,160,0.28)'); r.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 1024, 768);
}

function plaque(ctx, x, y, w, h, title, lines, glint = 0) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#f1d58a'); g.addColorStop(0.35, '#b88a35'); g.addColorStop(0.6, '#e2bd63'); g.addColorStop(1, '#8a6322');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,45,10,0.8)'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
  // screws
  for (const [sx, sy] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) {
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fillStyle = '#6b4b18'; ctx.fill();
  }
  // engraved type (a dark fill and a light lower edge)
  const eng = (s, tx, ty, size, opts = {}) => {
    text(ctx, s, tx, ty + 1, { size, weight: 900, color: 'rgba(255,240,200,0.55)', shadow: false, spacing: 1, ...opts });
    text(ctx, s, tx, ty, { size, weight: 900, color: '#3a2508', shadow: false, spacing: 1, ...opts });
  };
  eng(title, x + w / 2, y + 30, 13, { align: 'center' });
  const lh = h < 110 ? 16 : 20;
  lines.forEach((l, i) => eng(l, x + w / 2, y + (h < 110 ? 48 : 54) + i * lh, i === 0 ? 17 : 12, { align: 'center' }));
  if (glint > 0) {
    const gx = x + ((glint * 600) % (w + 200)) - 100;
    const gl = ctx.createLinearGradient(gx - 40, 0, gx + 40, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,240,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h);
  }
}

registerScreen('records', () => {
  let tab = 0, t = 0, R = null;
  const TABS = ['RECORD BOOK', 'TROPHY CASE', 'HALL OF FAME'];
  return {
    enter() { R = loadRecords(); try { music.play('hud_hof', { fade: 1 }); } catch { /* */ } },
    update(dt, busy) {
      t += dt;
      if (busy) return;
      if (input.pressed('tabR') || input.pressed('right')) { tab = (tab + 1) % TABS.length; uiSound('tab'); }
      if (input.pressed('tabL') || input.pressed('left')) { tab = (tab + TABS.length - 1) % TABS.length; uiSound('tab'); }
      if (input.pressed('back')) go('huddle');
    },
    draw(ctx) {
      woodWall(ctx);
      vText(ctx, 'HALL OF FAME', 512, 86, 44, { align: 'center', color: '#f1d58a', weight: 0.17, outline: 3, outlineColor: 'rgba(0,0,0,0.7)', shadow: [3, 4, 'rgba(0,0,0,0.6)'] });
      TABS.forEach((n, i) => text(ctx, n, 512 + (i - 1) * 220, 124, { size: 15, weight: 900, color: i === tab ? '#ffffff' : 'rgba(241,213,138,0.55)', align: 'center', spacing: 3 }));
      ctx.fillStyle = '#f1d58a';
      ctx.fillRect(512 + (tab - 1) * 220 - 50, 132, 100, 2);
      const k = easeOutCubic(clamp(t / 0.5, 0, 1));
      if (tab === 0) {
        text(ctx, `${R.games} GAME${R.games === 1 ? '' : 'S'} · ${R.wins}-${R.losses}${R.ties ? `-${R.ties}` : ''}`, 512, 160, { size: 14, weight: 800, color: 'rgba(241,213,138,0.85)', align: 'center', spacing: 2 });
        const keys = Object.keys(RECORD_NAMES);
        keys.forEach((key, i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const x = 92 + col * 286, y = 176 + row * 104 + (1 - k) * 40;
          const b = R.bests[key];
          const val = b ? (key === 'margin' ? `+${b.value}` : String(b.value)) : '—';
          plaque(ctx, x, y, 260, 96, RECORD_NAMES[key], b ? [val, (b.who || '').toUpperCase(), `${b.team} vs ${b.vs} · ${b.date}`] : ['—', 'UNCLAIMED'], i === Math.floor(t * 0.6) % keys.length ? t : 0);
        });
      } else if (tab === 1) {
        if (!R.trophies.length) {
          plaque(ctx, 312, 300, 400, 120, 'THE TROPHY CASE', ['IS WAITING', 'WIN A TITLE IN ROAD TO GLORY']);
        } else {
          R.trophies.slice(0, 9).forEach((tr, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            plaque(ctx, 92 + col * 286, 170 + row * 160, 260, 140, tr.name.toUpperCase(), [String(tr.team || '').toUpperCase(), `SEASON ${tr.season ?? ''}`, tr.date || '']);
          });
        }
      } else {
        if (!R.hall.length) {
          plaque(ctx, 312, 300, 400, 120, 'THE HALL', ['NO ONE YET', 'FINISH A CAREER TO BE ENSHRINED']);
        } else {
          R.hall.slice(0, 6).forEach((c, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            plaque(ctx, 112 + col * 420, 170 + row * 170, 380, 150, `${c.pos || ''} · ${c.years || ''}`, [String(c.name || '').toUpperCase(), String(c.teams || '').toUpperCase(), c.line || '', c.rings ? `${c.rings} GLORY BOWL RING${c.rings > 1 ? 'S' : ''}` : '']);
          });
        }
      }
      hints(ctx, [['tabL', 'PAGE'], ['back', 'BACK']]);
      void C;
    },
  };
});
