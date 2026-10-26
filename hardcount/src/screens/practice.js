// PRACTICE — the coach's clipboard. Pick your team and a drill; the drills
// run under the lights at Eastside Park with no score and no clock (except the
// two-minute drill, which is nothing but clock). The drills themselves live in
// match/practice.js and run inside the match screen.
import { registerScreen, go } from '../main.js';
import { input } from '../core/input.js';
import { store } from '../core/settings.js';
import { uiSound } from '../core/menu.js';
import { vText, text, hints, paragraph } from '../core/ui.js';
import { clamp, makeRng } from '../core/util.js';
import { TEAMS } from '../data/teams.js';
import { drawLogo } from '../gfx/logos.js';
import { music } from '../audio/music.js';
import { DRILLS, bestLine, loadBests } from '../match/practice.js';

function grass(ctx) {
  ctx.fillStyle = '#2d5f2a';
  ctx.fillRect(0, 0, 1024, 768);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'; ctx.fillRect(0, i * 64, 1024, 64); }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(1024, 110); ctx.stroke();
  const rng = makeRng(4);
  for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,50,18' : '90,140,70'},0.25)`; ctx.fillRect(rng() * 1024, rng() * 768, 1, 3); }
  const v = ctx.createRadialGradient(512, 384, 200, 512, 384, 700);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, 1024, 768);
}

registerScreen('practice', () => {
  let sel = 0, t = 0, teamI = 0, bests = {};
  return {
    enter() {
      const last = store.load('practice') || {};
      teamI = Math.max(0, TEAMS.findIndex((tm) => tm.id === (last.team || store.load('lastSetup')?.home || 'pht')));
      sel = clamp(last.drill ?? 0, 0, DRILLS.length - 1);
      bests = loadBests();
      try { music.play('hud_practice', { fade: 1 }); } catch { /* */ }
    },
    update(dt, busy) {
      t += dt;
      if (busy) return;
      if (input.pressed('up')) { sel = (sel - 1 + DRILLS.length) % DRILLS.length; uiSound('move'); }
      if (input.pressed('down')) { sel = (sel + 1) % DRILLS.length; uiSound('move'); }
      if (input.pressed('left') || input.pressed('tabL')) { teamI = (teamI - 1 + TEAMS.length) % TEAMS.length; uiSound('tab'); }
      if (input.pressed('right') || input.pressed('tabR')) { teamI = (teamI + 1) % TEAMS.length; uiSound('tab'); }
      if (input.pressed('confirm')) {
        const team = TEAMS[teamI];
        const opp = TEAMS[(teamI + 7) % TEAMS.length];
        store.save('practice', { team: team.id, drill: sel });
        uiSound('select');
        go('match', { mode: 'practice', drill: DRILLS[sel].id, home: team.id, away: opp.id, user: 'home', venue: 'park', time: 'night', weather: 'clear', returnTo: 'practice' });
      }
      if (input.pressed('back')) go('huddle');
    },
    draw(ctx) {
      grass(ctx);
      // the clipboard
      ctx.save();
      ctx.translate(512, 400);
      ctx.rotate(-0.025);
      ctx.fillStyle = '#7a5a34'; ctx.fillRect(-330, -330, 660, 680);
      ctx.fillStyle = '#f4f1e6'; ctx.fillRect(-300, -290, 600, 620);
      // the clip
      ctx.fillStyle = '#b8bec8'; ctx.fillRect(-90, -350, 180, 60);
      ctx.fillStyle = '#80868f'; ctx.fillRect(-60, -340, 120, 22);
      // ruled lines
      ctx.strokeStyle = 'rgba(60,110,200,0.25)'; ctx.lineWidth = 1;
      for (let y = -230; y < 320; y += 28) { ctx.beginPath(); ctx.moveTo(-290, y); ctx.lineTo(290, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(200,40,40,0.35)'; ctx.beginPath(); ctx.moveTo(-240, -290); ctx.lineTo(-240, 330); ctx.stroke();
      ctx.restore();
      const team = TEAMS[teamI];
      vText(ctx, 'PRACTICE', 512, 160, 36, { align: 'center', color: '#1a1a1a', weight: 0.16, skew: -0.1 });
      // team line
      try { drawLogo(ctx, team, 330, 212, 46); } catch { /* */ }
      text(ctx, `${team.city} ${team.name}`.toUpperCase(), 366, 220, { size: 18, weight: 900, color: '#1a1a1a', shadow: false, spacing: 1 });
      text(ctx, '◀ ▶ TEAM', 700, 220, { size: 12, weight: 900, color: '#666', shadow: false, spacing: 2 });
      DRILLS.forEach((d, i) => {
        const y = 290 + i * 62;
        if (i === sel) { ctx.fillStyle = 'rgba(255,228,60,0.55)'; ctx.fillRect(262, y - 30, 500, 46); }
        text(ctx, `${i + 1}.`, 286, y, { size: 20, weight: 900, color: '#1a1a1a', shadow: false });
        vText(ctx, d.name, 318, y + 2, 22, { color: '#141414', weight: 0.17, skew: -0.12 });
        if (i === sel) { ctx.strokeStyle = '#c4101f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(296, y - 7, 17, 15, -0.1, 0, Math.PI * 2); ctx.stroke(); }
      });
      paragraph(ctx, DRILLS[sel].desc, 290, 616, 460, { size: 15, color: '#2a2a2a', weight: 700, shadow: false });
      // the coach's pencil: the best session on file
      text(ctx, bestLine(DRILLS[sel].id, bests), 290, 694, { size: 12, weight: 900, color: '#2c4fa0', shadow: false, spacing: 1 });
      hints(ctx, [['ud', 'DRILL'], ['lr', 'TEAM'], ['confirm', 'START'], ['back', 'BACK']]);
    },
  };
});
