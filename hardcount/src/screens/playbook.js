// PLAYBOOK — the coaches' room: every play in the book on the chalkboard,
// drawn the way coaches draw them. Pick one and run it — the X's and O's move
// on the board, against whichever defense you set them up against.
import { registerScreen, go } from '../main.js';
import { input } from '../core/input.js';
import { uiSound } from '../core/menu.js';
import { C, vText, text, hints, panel, paragraph, padGlyph, usingPad, keyCap } from '../core/ui.js';
import { clamp, makeRng } from '../core/util.js';
import { OFFENSE } from '../sim/plays/offense.js';
import { DEFENSE } from '../sim/plays/defense.js';
import { FORMATIONS } from '../sim/plays/formations.js';
import { ROUTES } from '../sim/plays/routes.js';
import { Match } from '../sim/match.js';
import { getTeam } from '../data/teams.js';
import { drawPlayArt, drawDefArt } from '../match/playart.js';
import { PLAY_NO, DEF_NO } from '../match/wristband.js';
import { music } from '../audio/music.js';

const FORM_ORDER = ['gun_spread', 'gun_trips', 'gun_bunch', 'gun_empty', 'gun_twins', 'pistol', 'i_form', 'ace_twins', 'flexbone', 'wishbone', 'wildcat', 'goal_line'];
const KIND_NAME = { pass: 'PASS', run: 'RUN', option: 'OPTION', screen: 'SCREEN', trick: 'TRICK PLAY', qbrun: 'QB RUN', kneel: 'CLOCK', spike: 'CLOCK' };
const DROP_NAME = { quick: 'QUICK GAME', gun3: '3-STEP (GUN)', gun5: '5-STEP (GUN)', drop3: '3-STEP DROP', drop5: '5-STEP DROP', drop7: '7-STEP DROP', pa: 'PLAY-ACTION', boot: 'BOOTLEG', sprint: 'SPRINT-OUT', flea: 'FLEA FLICKER', toss: 'TOSS' };

function describe(p) {
  const f = FORMATIONS[p.form]?.name || '';
  const bits = [];
  if (p.run) {
    const side = (p.run.side || 1) > 0 ? 'RIGHT' : 'LEFT';
    bits.push(`${(p.run.scheme || 'zone').toUpperCase()} to the ${p.run.hole === 'edge' ? 'edge' : `${p.run.hole} gap`}, ${side.toLowerCase()} — the ${p.run.carrier} carries${p.run.give === 'toss' ? ' on a toss' : p.run.give === 'direct' ? ' off a direct snap' : ''}.`);
  }
  if (p.option) bits.push(p.option.read === 'dive' ? 'The QB reads the man over the dive back: give, keep, or pitch.' : p.option.read === 'edge' ? 'The QB attacks the edge and pitches off the end man.' : 'The QB reads the backside end: if he crashes, keep it.');
  if (p.routes) {
    const rs = Object.entries(p.routes).filter(([, r]) => ROUTES[r]).map(([role, r]) => `${role} ${ROUTES[r].name.toLowerCase()}`);
    if (rs.length) bits.push(`Routes: ${rs.join(', ')}.`);
  }
  if (p.reads?.length) bits.push(`Progression: ${p.reads.join(' → ')}.`);
  if (p.script) bits.push('Scripted: ' + p.script.map((s) => `${s.from || ''}${s.to ? ` → ${s.to}` : ''} ${s.do}`).join(', ') + '.');
  if (p.paFake) bits.push(`Fake the handoff to the ${p.paFake} first.`);
  return `${f}. ${bits.join(' ')}`;
}

function chalkboard(ctx, x, y, w, h, rng) {
  ctx.save();
  // the frame
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 12, y - 12, w + 24, h + 24);
  ctx.fillStyle = '#4a321c';
  ctx.fillRect(x - 12, y + h + 2, w + 24, 10);
  // slate with old chalk smudges
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#24352d'); g.addColorStop(1, '#1b2923');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 26; i++) {
    const sx = x + rng() * w, sy = y + rng() * h, r = 20 + rng() * 80;
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
    sg.addColorStop(0, 'rgba(230,240,230,0.05)'); sg.addColorStop(1, 'rgba(230,240,230,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** Chalk grain over fresh lines: tiny gaps so the strokes look drawn. */
function chalkGrain(ctx, x, y, w, h, rng) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 900; i++) ctx.fillRect(x + rng() * w, y + rng() * h, 1.6, 1.6);
  ctx.restore();
}

registerScreen('playbook', () => {
  let tab = 0, sel = 0, t = 0, flip = false, defI = 0;
  let run = null;        // { m, acc, trail: Map, t }
  const tabs = [];
  for (const f of FORM_ORDER) {
    const plays = OFFENSE.filter((p) => p.form === f && p.kind !== 'kneel' && p.kind !== 'spike');
    if (plays.length) tabs.push({ name: FORMATIONS[f].name, plays });
  }
  tabs.push({ name: 'DEFENSE', plays: DEFENSE, def: true });
  const rngStatic = makeRng(9);

  function startRun() {
    const tb = tabs[tab];
    const p = tb.plays[sel];
    const m = new Match({ home: getTeam('pht'), away: getTeam('det'), users: { home: null, away: null }, seed: 100 + Math.floor(Math.random() * 1e6) });
    m.possession = 'home'; m.dirHome = 1;
    m.newSeries('home', -8, 0);
    if (tb.def) m.callPlays(['sp_slants', 'sp_zone', 'sp_verts', 'tr_flood', 'i_iso'][Math.floor(Math.random() * 5)] || 'sp_slants', p.id, { noRunoff: true });
    else m.callPlays(p.id, DEFENSE[defI].id, { noRunoff: true, flip });
    run = { m, acc: 0, trail: new Map(), t: 0 };
    uiSound('select');
  }

  return {
    enter() { try { music.play('hud_book', { fade: 1 }); } catch { /* */ } },
    update(dt, busy) {
      t += dt;
      if (busy) return;
      if (run) {
        const m = run.m;
        run.t += dt;
        run.acc += dt;
        while (run.acc > 1 / 60) {
          run.acc -= 1 / 60;
          if (m.phase === 'presnap' && m.presnapT > 0.8) { if (m.snapAt === Infinity) m.snap(); }
          m.step(1 / 60);
          if (m.phase === 'live') for (const e of m.active) {
            const tr = run.trail.get(e) || [];
            if (!tr.length || Math.hypot(tr[tr.length - 1].x - e.x, tr[tr.length - 1].z - e.z) > 0.6) tr.push({ x: e.x, z: e.z });
            run.trail.set(e, tr);
          }
        }
        if (input.pressed('confirm') || input.pressed('back') || (m.phase === 'post' && m.postT > 2.2)) { run = null; uiSound('back'); }
        return;
      }
      const tb = tabs[tab];
      if (input.pressed('tabR')) { tab = (tab + 1) % tabs.length; sel = 0; uiSound('tab'); }
      if (input.pressed('tabL')) { tab = (tab - 1 + tabs.length) % tabs.length; sel = 0; uiSound('tab'); }
      if (input.pressed('up')) { sel = (sel - 1 + tb.plays.length) % tb.plays.length; uiSound('move'); }
      if (input.pressed('down')) { sel = (sel + 1) % tb.plays.length; uiSound('move'); }
      if (input.pressed('alt') && !tb.def) { flip = !flip; uiSound('tab'); }
      if (input.pressed('extra')) { defI = (defI + 1) % DEFENSE.length; uiSound('tab'); }
      if (input.pressed('confirm')) startRun();
      if (input.pressed('back')) go('huddle');
    },
    draw(ctx) {
      // the coaches' room wall
      ctx.fillStyle = '#2a2d33'; ctx.fillRect(0, 0, 1024, 768);
      const lamp = ctx.createRadialGradient(660, 80, 30, 660, 300, 700);
      lamp.addColorStop(0, 'rgba(255,236,190,0.25)'); lamp.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = lamp; ctx.fillRect(0, 0, 1024, 768);
      const tb = tabs[tab];
      const p = tb.plays[sel];
      // the list
      vText(ctx, 'PLAYBOOK', 52, 74, 34, { color: '#ffffff', weight: 0.17, outline: 3, outlineColor: 'rgba(0,0,0,0.7)' });
      panel(ctx, 40, 96, 330, 600, { accentLen: 160 });
      if (usingPad()) { padGlyph(ctx, 'L1', 66, 124, 9); padGlyph(ctx, 'R1', 344, 124, 9); } else { keyCap(ctx, 'Q', 66, 124, 16); keyCap(ctx, 'E', 344, 124, 16); }
      text(ctx, tb.name, 205, 129, { size: 15, weight: 900, color: C.accent, align: 'center', spacing: 2 });
      const first = clamp(sel - 8, 0, Math.max(0, tb.plays.length - 16));
      tb.plays.slice(first, first + 16).forEach((q, k) => {
        const i = first + k;
        const y = 166 + k * 32;
        if (i === sel) { ctx.fillStyle = 'rgba(255,178,30,0.22)'; ctx.fillRect(50, y - 22, 310, 30); }
        const no = tb.def ? DEF_NO.get(q.id) : PLAY_NO.get(q.id);
        text(ctx, String(no ?? ''), 74, y, { size: 13, weight: 900, color: C.dim, align: 'center' });
        text(ctx, q.name, 98, y, { size: 15, weight: 800, color: i === sel ? '#ffffff' : '#c9d1de' });
        text(ctx, tb.def ? (q.tags || []).slice(0, 1).join('').toUpperCase() : KIND_NAME[q.kind] || '', 350, y, { size: 10, weight: 900, color: C.dim, align: 'right', spacing: 1 });
      });
      // the board
      const bx = 420, by = 70, bw = 560, bh = 420;
      chalkboard(ctx, bx, by, bw, bh, makeRng(3));
      if (run) {
        drawRun(ctx, run, bx, by, bw, bh);
      } else {
        ctx.save();
        if (tb.def) drawDefArt(ctx, p, bx + 20, by + 20, bw - 40, bh - 40, { ink: '#f0f2e8', lineW: 2.6, paper: '#22322b' });
        else drawPlayArt(ctx, p, bx + 20, by + 30, bw - 40, bh - 60, { flip, ink: '#f0f2e8', lineW: 2.8, paper: '#22322b', labels: true, losColor: 'rgba(240,242,232,0.3)' });
        chalkGrain(ctx, bx, by, bw, bh, makeRng(Math.floor(t * 2) + 5));
        ctx.restore();
        vText(ctx, p.name, bx + 18, by + 34, 26, { color: '#f0f2e8', weight: 0.16, skew: -0.05 });
      }
      // the notes under the board
      panel(ctx, 420, 510, 560, 186, { accentLen: 180 });
      if (tb.def) {
        text(ctx, `${(p.tags || []).join(' · ').toUpperCase()}`, 446, 540, { size: 12, weight: 900, color: C.accent, spacing: 2 });
        const jobs = Object.entries(p.jobs || {}).map(([r, j]) => `${r}: ${j.rush ? `rush ${j.rush}` : j.man ? `man ${j.man}${j.tech ? ` (${j.tech})` : ''}` : j.zone ? `zone ${j.zone}` : j.spy ? 'spy the QB' : ''}`).join(' · ');
        paragraph(ctx, jobs, 446, 566, 510, { size: 14, color: '#dfe6f2' });
      } else {
        text(ctx, `${KIND_NAME[p.kind] || ''}${p.drop ? ` · ${DROP_NAME[p.drop] || p.drop.toUpperCase()}` : ''}${flip ? ' · FLIPPED' : ''}`, 446, 540, { size: 12, weight: 900, color: C.accent, spacing: 2 });
        paragraph(ctx, describe(p), 446, 566, 510, { size: 14, color: '#dfe6f2' });
        text(ctx, `RUN AGAINST: ${DEFENSE[defI].name}`, 446, 684, { size: 12, weight: 900, color: '#8fd0ff', spacing: 1 });
      }
      hints(ctx, run ? [['confirm', 'STOP']] : [['ud', 'PLAYS'], ['tabL', 'FORMATION'], ['confirm', 'RUN IT'], ...(tb.def ? [] : [['alt', 'FLIP'], ['extra', 'DEFENSE']]), ['back', 'BACK']]);
    },
  };

  function drawRun(ctx, R, bx, by, bw, bh) {
    const m = R.m;
    const F = m.field;
    const S = Math.min(bw / (F.W + 4), 14);
    // the line of scrimmage near the bottom of the board; scroll up with the ball
    // (and down with a sack) so the whole play stays on the slate
    const half = bh / S / 2;
    const want = clamp(Math.max(m.los + half - 7, m.ball.z - half + 6), m.ball.z - half + 4, m.ball.z + half - 4);
    R.cz = R.cz === undefined ? want : R.cz + (want - R.cz) * 0.08;
    const cz = clamp(R.cz, -F.end + half, F.end - half);
    const X = (x) => bx + bw / 2 - x * S;
    const Y = (z) => by + bh / 2 - (z - cz) * S;
    ctx.save();
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    // yard lines in faint chalk
    ctx.strokeStyle = 'rgba(240,242,232,0.12)'; ctx.lineWidth = 1;
    for (let z = -F.halfL; z <= F.halfL; z += 5) { ctx.beginPath(); ctx.moveTo(X(F.halfW), Y(z)); ctx.lineTo(X(-F.halfW), Y(z)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(240,242,232,0.4)';
    ctx.beginPath(); ctx.moveTo(X(F.halfW), Y(m.los)); ctx.lineTo(X(-F.halfW), Y(m.los)); ctx.stroke();
    // trails
    for (const [e, tr] of R.trail) {
      if (tr.length < 2) continue;
      ctx.strokeStyle = e.side === m.offSide ? 'rgba(255,240,170,0.55)' : 'rgba(255,170,170,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); tr.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.z)) : ctx.moveTo(X(p.x), Y(p.z)))); ctx.stroke();
    }
    // the men
    for (const e of m.active) {
      const x = X(e.x), y = Y(e.z), r = 6;
      ctx.lineWidth = 2.4;
      if (e.side === m.offSide) {
        ctx.strokeStyle = '#f0f2e8';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        if (m.ball.carrier === e) { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.strokeStyle = '#ff9a9a';
        ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
      }
    }
    // the ball in the air
    const b = m.ball;
    if (b.state === 'air') { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.z) - b.y * 2, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    vText(ctx, `${m.play?.name || ''} vs ${m.dplay?.name || ''}`, bx + 18, by + 34, 20, { color: '#f0f2e8', weight: 0.16, skew: -0.05 });
    if (m.result) text(ctx, `${m.result.type === 'incomplete' ? 'INCOMPLETE' : m.result.type === 'td' ? 'TOUCHDOWN' : `${m.result.yards >= 0 ? 'GAIN' : 'LOSS'} OF ${Math.abs(m.result.yards)}`}`, bx + bw - 18, by + 30, { size: 16, weight: 900, color: '#ffd23a', align: 'right' });
  }
});
