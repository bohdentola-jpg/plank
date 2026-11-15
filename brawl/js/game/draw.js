// Puts a whole match on screen, back to front.

import { W, H } from '../core/config.js';
import { drawFighter, drawShadows, drawRespawn, drawTags } from './render.js';
import { drawHud, drawOverlay } from './hud.js';

export function drawMatch(ctx, m, opt = {}) {
  const st = m.stage;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  st.drawBg(ctx, m);
  ctx.save();
  m.cam.apply(ctx);
  if (st.drawBack) st.drawBack(ctx, m);
  for (const e of m.entities) if (e.layer === 'far') e.draw(ctx, m);
  if (st.drawMid) st.drawMid(ctx, m);
  drawShadows(ctx, m);
  for (const e of m.entities) if (e.layer === 'back') e.draw(ctx, m);
  for (const f of m.fighters) drawRespawn(ctx, f, m);
  // whoever is being held is drawn first so the holder's hands sit on top
  for (const f of m.fighters) if (f.state === 'grabbed') drawFighter(ctx, f, m);
  for (const f of m.fighters) if (f.state !== 'grabbed' && f.state !== 'move') drawFighter(ctx, f, m);
  for (const f of m.fighters) if (f.state === 'move') drawFighter(ctx, f, m);
  for (const e of m.entities) if (e.layer === 'front') e.draw(ctx, m);
  m.fx.draw(ctx);
  if (st.drawFront) st.drawFront(ctx, m);
  if (opt.debug) drawDebug(ctx, m);
  ctx.restore();
  if (st.drawScreen) st.drawScreen(ctx, m);
  if (!opt.noHud) { drawTags(ctx, m); drawHud(ctx, m); }
  drawOverlay(ctx, m);
  ctx.restore();
}

// hitboxes (red), hurtboxes (green), collision (blue): press F2 in a match
function drawDebug(ctx, m) {
  ctx.lineWidth = 1.5;
  for (const s of m.stage.solids) { if (!s.on) continue; ctx.strokeStyle = '#3aa0ff'; ctx.strokeRect(s.x, s.y, s.w, s.h); }
  for (const s of m.stage.plats) { if (!s.on) continue; ctx.strokeStyle = '#7fd0ff'; ctx.strokeRect(s.x, s.y, s.w, 4); }
  for (const f of m.fighters) {
    if (f.out || f.state === 'dead') continue;
    ctx.strokeStyle = '#35ff6a';
    for (const b of f.hurtboxes()) ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (f.state === 'move' && f.move && f.move.hits) {
      for (const hb of f.move.hits) {
        if (f.mf < hb.f[0] || f.mf > hb.f[1]) continue;
        ctx.strokeStyle = hb.grab ? '#c050ff' : '#ff3030'; ctx.fillStyle = 'rgba(255,40,40,0.3)';
        for (const s of m.shapesFor(f, hb)) {
          ctx.beginPath();
          if (s.r !== undefined) ctx.arc(s.x, s.y, s.r, 0, 6.3); else ctx.rect(s.x, s.y, s.w, s.h);
          ctx.fill(); ctx.stroke();
        }
      }
    }
    ctx.fillStyle = '#ffffff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(f.state + (f.moveId ? ':' + f.moveId + ' ' + f.mf : '') + ' ' + f.sf, f.x, f.y + 14);
  }
  ctx.strokeStyle = '#ff9a1f';
  for (const e of m.entities) {
    const sh = e.hit && e.hitShapes && e.hitShapes();
    if (sh) for (const s of sh) { ctx.beginPath(); if (s.r !== undefined) ctx.arc(s.x, s.y, s.r, 0, 6.3); else ctx.rect(s.x, s.y, s.w, s.h); ctx.stroke(); }
    if (e.hurt) { ctx.strokeStyle = '#35ff6a'; for (const b of e.hurt()) ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#ff9a1f'; }
  }
  const b = m.stage.blast; ctx.strokeStyle = '#ff00ff'; ctx.strokeRect(b.l, b.t, b.r - b.l, b.b - b.t);
}
