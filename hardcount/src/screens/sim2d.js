// QA: the sim from above (All-22), no 3D. Players as discs with their roles,
// routes, blocks, the ball and its flight. ?screen=sim2d&off=sp_zone&def=c3&seed=5&speed=1&loop=1
import { registerScreen, game } from '../main.js';
import { Match } from '../sim/match.js';
import { getTeam } from '../data/teams.js';
import { text, vText } from '../core/ui.js';
import { input } from '../core/input.js';

registerScreen('sim2d', () => {
  let m = null, params = {}, t = 0, log = [], acc = 0, done = 0;
  let S = 14;   // px per yard
  const start = () => {
    const seed = parseInt(params.seed || '5', 10) + done;
    m = new Match({ home: getTeam(params.home || 'pht'), away: getTeam(params.away || 'det'), users: { home: null, away: null }, seed });
    m.possession = 'home'; m.dirHome = 1;
    m.newSeries('home', parseFloat(params.los || '-5'), parseFloat(params.x || '0'));
    if (params.off) m.callPlays(params.off, params.def || 'c3', { noRunoff: true, flip: params.flip === '1' });
    else { m.autoCalls = true; }
    log = [];
    m.on((e) => { if (!['block', 'hit'].includes(e.type)) log.push(`${m.playT.toFixed(2)} ${e.type}${e.result ? ' ' + e.result.type + ' ' + e.result.yards : ''}${e.name ? ' ' + e.name : ''}`); if (log.length > 14) log.shift(); });
    t = 0;
  };
  return {
    enter(p) { params = p; if (p.zoom) S = parseFloat(p.zoom); game.renderer.power = 1; start(); },
    update(dt) {
      if (!m) return;
      const speed = parseFloat(params.speed || '1');
      acc += dt * speed;
      while (acc > 1 / 60) {
        acc -= 1 / 60;
        if (m.phase === 'presnap' && m.presnapT > 0.6 && m.snapAt === Infinity) m.snap();
        m.step(1 / 60);
        if (m.phase === 'post' && m.postT > 1.5 && params.loop !== '0') { done++; start(); return; }
      }
      t += dt;
      if (input.pressed('confirm')) { done++; start(); }
    },
    draw(ctx) {
      ctx.fillStyle = '#16301a';
      ctx.fillRect(0, 0, 1024, 768);
      if (!m) return;
      const F = m.field;
      // camera: follow the ball along z (vertical on screen, offense going up)
      const cz = (params.cz !== undefined ? parseFloat(params.cz) : m.ball.z + 6);
      const X = (x) => 512 - x * S;
      const Y = (z) => 400 - (z - cz) * S;
      // field
      ctx.fillStyle = '#2f6b33';
      ctx.fillRect(X(F.halfW), Y(F.end), F.W * S, (F.end * 2) * S);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      for (let z = -F.halfL; z <= F.halfL; z += 5) { ctx.beginPath(); ctx.moveTo(X(F.halfW), Y(z)); ctx.lineTo(X(-F.halfW), Y(z)); ctx.stroke(); }
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(X(F.halfW), Y(F.end), F.W * S, F.end * 2 * S);
      // LOS + first down
      ctx.strokeStyle = '#4aa8ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(F.halfW), Y(m.los)); ctx.lineTo(X(-F.halfW), Y(m.los)); ctx.stroke();
      ctx.strokeStyle = '#ffe23a';
      ctx.beginPath(); ctx.moveTo(X(F.halfW), Y(m.firstDownZ)); ctx.lineTo(X(-F.halfW), Y(m.firstDownZ)); ctx.stroke();
      // routes
      for (const e of m.offense) {
        const r = e.mem.route;
        if (!r) continue;
        ctx.strokeStyle = 'rgba(255,255,140,0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.z));
        for (let i = e.mem.routeIdx || 0; i < r.length; i++) ctx.lineTo(X(r[i].x), Y(r[i].z));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // blocks
      for (const g of m.engagements) {
        if (g.done) continue;
        ctx.strokeStyle = g.bal < 0 ? '#ff5050' : '#50ff80'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(X(g.a.x), Y(g.a.z)); ctx.lineTo(X(g.b.x), Y(g.b.z)); ctx.stroke();
      }
      // players
      for (const e of m.active) {
        const off = e.side === m.offSide;
        ctx.fillStyle = off ? '#2a62ff' : '#ff3a2a';
        if (!e.standing) ctx.fillStyle = off ? '#13306f' : '#6f1a13';
        ctx.beginPath(); ctx.arc(X(e.x), Y(e.z), e.radius * S, 0, Math.PI * 2); ctx.fill();
        // facing
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.z)); ctx.lineTo(X(e.x + Math.sin(e.heading) * 0.7), Y(e.z + Math.cos(e.heading) * 0.7)); ctx.stroke();
        text(ctx, e.role || '', X(e.x), Y(e.z) - 8, { size: 10, align: 'center', color: '#fff', weight: 800 });
        if (e.action) text(ctx, e.action.name, X(e.x), Y(e.z) + 16, { size: 9, align: 'center', color: '#ffd', weight: 600 });
      }
      // ball
      const b = m.ball;
      ctx.fillStyle = '#c87a2a';
      ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.z) - b.y * 3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
      if (b.state === 'air' && b.targetPt) {
        ctx.strokeStyle = 'rgba(255,160,60,0.7)';
        ctx.beginPath(); ctx.arc(X(b.targetPt.x), Y(b.targetPt.z), 5, 0, Math.PI * 2); ctx.stroke();
      }
      // HUD
      vText(ctx, `${m.play?.name || m.playKind || ''} vs ${m.dplay?.name || ''}`, 20, 40, 20, { color: '#fff' });
      text(ctx, `t=${m.playT.toFixed(2)}  ${m.phase}  ball ${b.state}/${b.kind || ''}  ${m.result ? m.result.type + ' ' + m.result.yards : ''}`, 20, 64, { size: 14, color: '#fff' });
      log.forEach((l, i) => text(ctx, l, 20, 100 + i * 16, { size: 12, color: '#dfe', weight: 600 }));
    },
  };
});
