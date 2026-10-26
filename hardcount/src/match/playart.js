// Play diagrams, the way they're printed on a QB's wristband: the formation as
// circles, routes as inked lines with arrowheads, blocks as T's, run paths
// dashed, the progression numbered. The defensive card shows the shell:
// zones as coloured bubbles, man coverage as lines to the receivers, rushers
// as arrows. Everything is drawn from the play data, so new plays draw
// themselves.
import { FORMATIONS, DEF_FORMATIONS } from '../sim/plays/formations.js';
import { ROUTES } from '../sim/plays/routes.js';
import { SCRIPT_ROUTES } from '../sim/plays/offense.js';
import { ZONES } from '../sim/plays/defense.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const HOLE_X = { A: 0.8, B: 2.2, C: 3.6, edge: 7 };
const READ_COL = ['#d0102a', '#1d4fd8', '#178a3a', '#7a2bbf'];

function arrowHead(ctx, x0, y0, x1, y1, s) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.45) * s, y1 - Math.sin(a - 0.45) * s);
  ctx.lineTo(x1 - Math.cos(a + 0.45) * s, y1 - Math.sin(a + 0.45) * s);
  ctx.closePath();
  ctx.fill();
}

function tEnd(ctx, x0, y0, x1, y1, s) {
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x1 - Math.cos(a) * s, y1 - Math.sin(a) * s);
  ctx.lineTo(x1 + Math.cos(a) * s, y1 + Math.sin(a) * s);
  ctx.stroke();
}

/** Play-space mapper for a diagram box. */
function mapper(x, y, w, h, spanX = 34, spanZ = 30, losFrac = 0.66) {
  const sx = w / spanX, sz = h / spanZ;
  const s = Math.min(sx, sz * 1.15);
  return {
    s,
    X: (px) => x + w / 2 + px * s,
    Y: (pz) => y + h * losFrac - pz * s * 0.86,
  };
}

/** "in" (toward the ball) for a man at px, in play space. */
function inSign(play, role, px, routeId) {
  const back = Math.abs(px) < 2.6;
  const side = play.run?.side ?? play.option?.side ?? play.bootSide ?? 1;
  if (SCRIPT_ROUTES[routeId]) return -side;
  if (back && (play.run || play.option)) return -side;
  return px > 0.01 ? -1 : px < -0.01 ? 1 : -1;
}

export function routePoints(play, role, px, pz, routeId, flip = false) {
  const R = ROUTES[routeId] || SCRIPT_ROUTES[routeId];
  if (!R) return [];
  const sgn = inSign(play, role, px, routeId);
  const pts = [[px, pz]];
  for (const [inYd, depth] of R.pts) pts.push([px + inYd * sgn, depth]);
  return flip ? pts.map(([a, b]) => [-a, b]) : pts;
}

/**
 * Draw an offensive play. opts: { flip, ink, paper (fill the box), lineW, numbers (read numbers), compact }
 */
/** Fit the diagram's content (formation + clipped routes) into the box. */
function fitMapper(play, form, fl, x, y, w, h, clipZ) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  const add = (px, pz) => { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, Math.min(pz, clipZ)); };
  for (const [, [px, pz]] of Object.entries(form.roles)) add(px * fl, pz);
  for (const [role, rid] of Object.entries(play.routes || {})) {
    const p = form.roles[role];
    if (!p) continue;
    for (const [a, b] of routePoints(play, role, p[0], p[1], rid, fl < 0)) add(a, b);
  }
  if (play.run) { const side = (play.run.side || 1) * fl; add((HOLE_X[play.run.hole] ?? 2) * side * 1.2, 6); }
  add(0, 4);
  const spanX = Math.max(14, x1 - x0 + 5), spanZ = Math.max(10, z1 - z0 + 3.5);
  const s = Math.min(w / spanX, (h / spanZ) / 0.86);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return { s, X: (px) => x + w / 2 + (px - cx) * s, Y: (pz) => y + h / 2 - (pz - cz) * s * 0.86 };
}

export function drawPlayArt(ctx, play, x, y, w, h, opts = {}) {
  const form = FORMATIONS[play.form];
  if (!form) return;
  const fl = opts.flip ? -1 : 1;
  const M = opts.fit === false ? mapper(x, y, w, h, opts.spanX || 34, opts.spanZ || 30, opts.losFrac || 0.68) : fitMapper(play, form, fl, x, y, w, h, opts.clipZ ?? 16);
  const ink = opts.ink || '#151515';
  const lw = opts.lineW || clamp(M.s * 0.28, 1.2, 2.6);
  const r = clamp(M.s * 0.55, 2.4, 6);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // the line of scrimmage
  ctx.strokeStyle = opts.losColor || 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x + 4, M.Y(0)); ctx.lineTo(x + w - 4, M.Y(0)); ctx.stroke();
  ctx.setLineDash([]);

  const pos = {};
  for (const [role, [px, pz]] of Object.entries(form.roles)) pos[role] = [px * fl, pz];
  const reads = play.reads || [];
  const readIdx = (role) => reads.indexOf(role);

  // routes
  for (const [role, rid] of Object.entries(play.routes || {})) {
    const p = pos[role];
    if (!p || rid === 'stalk') continue;
    const R = ROUTES[rid] || SCRIPT_ROUTES[rid];
    if (!R) continue;
    const pts = routePoints(play, role, p[0] * fl, p[1], rid, opts.flip);
    const ri = readIdx(role);
    const col = opts.mono ? ink : ri === 0 ? READ_COL[0] : ink;
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = lw;
    if (R.block) {
      // an arc block: run to the spot and put a T on it
      ctx.beginPath();
      pts.forEach(([a, b], i) => (i ? ctx.lineTo(M.X(a), M.Y(b)) : ctx.moveTo(M.X(a), M.Y(b))));
      ctx.stroke();
      const n = pts.length;
      if (n > 1) tEnd(ctx, M.X(pts[n - 2][0]), M.Y(pts[n - 2][1]), M.X(pts[n - 1][0]), M.Y(pts[n - 1][1]), r * 1.1);
      continue;
    }
    // long routes are cut off at the top of the card
    const clipZ = opts.clipZ ?? 16;
    const drawPts = [];
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = pts[i];
      if (b > clipZ && i > 0) {
        const [pa, pb] = pts[i - 1];
        const k = (clipZ - pb) / Math.max(0.01, b - pb);
        drawPts.push([pa + (a - pa) * k, clipZ]);
        break;
      }
      drawPts.push([a, b]);
    }
    if (rid === 'pitchpath' || R.behind) ctx.setLineDash([lw * 2.2, lw * 1.8]);
    ctx.beginPath();
    drawPts.forEach(([a, b], i) => (i ? ctx.lineTo(M.X(a), M.Y(b)) : ctx.moveTo(M.X(a), M.Y(b))));
    ctx.stroke();
    ctx.setLineDash([]);
    const n = drawPts.length;
    if (n > 1) {
      if (R.settle) tEnd(ctx, M.X(drawPts[n - 2][0]), M.Y(drawPts[n - 2][1]), M.X(drawPts[n - 1][0]), M.Y(drawPts[n - 1][1]), r * 0.9);
      else arrowHead(ctx, M.X(drawPts[n - 2][0]), M.Y(drawPts[n - 2][1]), M.X(drawPts[n - 1][0]), M.Y(drawPts[n - 1][1]), r * 1.5);
    }
    // the read number at the end of the route
    if (opts.numbers !== false && ri >= 0 && n > 1) {
      const [ea, eb] = drawPts[n - 1];
      ctx.fillStyle = opts.mono ? ink : READ_COL[Math.min(ri, READ_COL.length - 1)];
      ctx.font = `900 ${Math.round(r * 2.1)}px "Bahnschrift", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(ri + 1), M.X(ea) + (ea >= 0 ? r * 1.6 : -r * 1.6), M.Y(eb) + r * 0.6);
    }
  }

  // blocks
  for (const [role, bk] of Object.entries(play.block || {})) {
    const p = pos[role];
    if (!p) continue;
    ctx.strokeStyle = ink; ctx.lineWidth = lw;
    const x0 = M.X(p[0]), y0 = M.Y(p[1]);
    if (bk === 'stalk' || bk === 'block') { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, M.Y(p[1] + 2.5)); ctx.stroke(); tEnd(ctx, x0, y0, x0, M.Y(p[1] + 2.5), r); }
    if (bk === 'pass') { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, M.Y(p[1] - 1.4)); ctx.stroke(); tEnd(ctx, x0, y0, x0, M.Y(p[1] - 1.4), r); }
    if (bk === 'lead' && play.run) {
      const side = (play.run.side || 1) * fl;
      const hx = (HOLE_X[play.run.hole] ?? 2) * side;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(M.X(hx * 0.9), M.Y(1.2)); ctx.stroke();
      tEnd(ctx, x0, y0, M.X(hx * 0.9), M.Y(1.2), r);
    }
  }
  // the line blocks (a short T each, pulled guard swings)
  for (const role of ['LG', 'C', 'RG']) {
    const p = pos[role];
    if (!p) continue;
    ctx.strokeStyle = ink; ctx.lineWidth = lw;
    const x0 = M.X(p[0]), y0 = M.Y(p[1]);
    const run = play.run && play.kind !== 'pass';
    const pull = run && (play.run.scheme === 'power' || play.run.scheme === 'counter' || play.run.scheme === 'sweep') && role === ((play.run.side || 1) * fl > 0 ? 'LG' : 'RG');
    if (pull) {
      const side = (play.run.side || 1) * fl;
      const hx = (HOLE_X[play.run.hole] ?? 2) * side;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, M.Y(-1.3)); ctx.lineTo(M.X(hx), M.Y(-1.3)); ctx.lineTo(M.X(hx), M.Y(1)); ctx.stroke();
      tEnd(ctx, M.X(hx), M.Y(-1.3), M.X(hx), M.Y(1), r);
    } else {
      const ey = run ? M.Y(p[1] + 1.6) : M.Y(p[1] - 1.1);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, ey); ctx.stroke();
      tEnd(ctx, x0, y0, x0, ey, r * 0.9);
    }
  }

  // run / option paths (dashed), QB drops
  ctx.setLineDash([lw * 2.2, lw * 1.8]);
  if (play.run) {
    const run = play.run;
    const side = (run.side || 1) * fl;
    const hx = (HOLE_X[run.hole] ?? 2) * side;
    const c = pos[run.carrier] || pos.RB;
    if (c) {
      ctx.strokeStyle = opts.mono ? ink : READ_COL[0]; ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = lw * 1.15;
      const mid = run.give === 'toss' || run.hole === 'edge' ? [hx, -2.2] : [c[0] + (hx - c[0]) * 0.5, Math.min(c[1] + 1.8, -0.6)];
      ctx.beginPath(); ctx.moveTo(M.X(c[0]), M.Y(c[1])); ctx.quadraticCurveTo(M.X(mid[0]), M.Y(mid[1]), M.X(hx), M.Y(1.2)); ctx.lineTo(M.X(hx + (run.hole === 'edge' ? side * 1.5 : 0)), M.Y(6)); ctx.stroke();
      ctx.setLineDash([]);
      arrowHead(ctx, M.X(hx), M.Y(1.2), M.X(hx + (run.hole === 'edge' ? side * 1.5 : 0)), M.Y(6), r * 1.5);
      ctx.setLineDash([lw * 2.2, lw * 1.8]);
    }
  }
  if (play.option) {
    const q = pos.QB;
    const side = (play.option.keepSide ?? play.option.side ?? 1) * fl;
    if (q) {
      ctx.strokeStyle = opts.mono ? ink : READ_COL[1]; ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(M.X(q[0]), M.Y(q[1])); ctx.lineTo(M.X(side * 6), M.Y(q[1] * 0.5)); ctx.lineTo(M.X(side * 7), M.Y(4)); ctx.stroke();
    }
  } else if (play.kind === 'pass' || play.kind === 'screen' || (play.kind === 'trick' && !play.run)) {
    const q = pos.QB;
    if (q && form.qb !== 'direct') {
      const dd = { quick: 0.6, gun3: 1.2, gun5: 2.4, drop3: 3, drop5: 5, drop7: 7, pa: 5, boot: 4, sprint: 3.5, flea: 3, toss: 1.2 }[play.drop] ?? 2;
      const back = form.qb === 'under' ? dd : dd * 0.4;
      ctx.strokeStyle = ink; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(M.X(q[0]), M.Y(q[1]));
      if (play.drop === 'boot' || play.drop === 'sprint') { const sd = (play.bootSide ?? play.run?.side ?? 1) * fl; ctx.lineTo(M.X(sd * 6), M.Y(q[1] - 1.5)); }
      else ctx.lineTo(M.X(q[0]), M.Y(q[1] - back));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // scripted transfers (handoffs, pitches, the throwback) as thin dotted lines
  if (play.script) {
    ctx.strokeStyle = opts.mono ? ink : '#7a2bbf'; ctx.lineWidth = Math.max(1, lw * 0.7);
    ctx.setLineDash([1.5, 3]);
    for (const st of play.script) {
      const a = pos[st.from], b = pos[st.to];
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(M.X(a[0]), M.Y(a[1])); ctx.lineTo(M.X(b[0]), M.Y(b[1])); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // the men
  for (const [role, [px, pz]] of Object.entries(pos)) {
    const cx = M.X(px), cy = M.Y(pz);
    ctx.beginPath();
    if (role === 'C') { ctx.rect(cx - r, cy - r, r * 2, r * 2); } else ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = opts.paper || '#f4f1e8';
    ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, lw * 0.85);
    ctx.stroke();
    if (opts.labels && !['C', 'LG', 'RG'].includes(role)) {
      ctx.fillStyle = ink;
      ctx.font = `800 ${Math.round(r * 1.25)}px "Bahnschrift", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(role === 'QB' ? 'Q' : role === 'SL' ? 'S' : role.slice(0, 1), cx, cy + r * 0.45);
    }
  }
  ctx.restore();
}

const ZONE_COL = { deep: 'rgba(40,110,255,0.32)', hook: 'rgba(255,200,30,0.38)', curl: 'rgba(255,150,30,0.36)', flat: 'rgba(30,200,230,0.36)', robber: 'rgba(170,60,230,0.32)' };

function zoneColor(id) {
  if (ZONES[id]?.deep) return ZONE_COL.deep;
  if (id.startsWith('hook')) return ZONE_COL.hook;
  if (id.startsWith('curl')) return ZONE_COL.curl;
  if (id.startsWith('flat')) return ZONE_COL.flat;
  return ZONE_COL.robber;
}

/** Draw a defensive call against a generic spread look. */
export function drawDefArt(ctx, dplay, x, y, w, h, opts = {}) {
  const form = DEF_FORMATIONS[dplay.form] || DEF_FORMATIONS.base;
  const M = mapper(x, y, w, h, 40, 34, 0.8);
  const ink = opts.ink || '#151515';
  const lw = opts.lineW || Math.max(1.2, M.s * 0.3);
  const r = Math.max(2.4, M.s * 0.62);
  const FW = 40;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x + 4, M.Y(0)); ctx.lineTo(x + w - 4, M.Y(0)); ctx.stroke();
  ctx.setLineDash([]);
  // a generic offense (spread: X, slot, Z, back) for the man lines
  const offense = { L1: [-13, -0.4], L2: [-7, -1], R1: [13, -0.4], B1: [1.3, -5], QB: [0, -5], C: [0, -0.5], LG: [-1.35, -0.6], RG: [1.35, -0.6] };
  const pos = {};
  for (const [role, p] of Object.entries(form)) if (Array.isArray(p)) pos[role] = p;
  // zones first (under everything)
  for (const [role, job] of Object.entries(dplay.jobs || {})) {
    const z = job.zone || job.else?.zone;
    if (!z || job.man) continue;
    const Z = ZONES[z];
    if (!Z) continue;
    const zx = Z.x * FW, zz = Math.min(Z.z, 22);
    ctx.fillStyle = zoneColor(z);
    ctx.beginPath();
    ctx.ellipse(M.X(zx), M.Y(zz), (Z.deep ? 7 : 4.6) * M.s, (Z.deep ? 4.2 : 2.6) * M.s * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    // a line from the man to his zone
    const p = pos[role];
    if (p) {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(1, lw * 0.7);
      ctx.beginPath(); ctx.moveTo(M.X(p[0]), M.Y(p[1])); ctx.lineTo(M.X(zx), M.Y(zz)); ctx.stroke();
    }
  }
  // the offense, faint
  for (const [role, [px, pz]] of Object.entries(offense)) {
    ctx.beginPath();
    ctx.arc(M.X(px), M.Y(pz), r * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.stroke();
    void role;
  }
  // jobs: rush arrows, man lines, spies
  for (const [role, job] of Object.entries(dplay.jobs || {})) {
    const p = pos[role];
    if (!p) continue;
    const x0 = M.X(p[0]), y0 = M.Y(p[1]);
    ctx.lineWidth = lw;
    if (job.rush) {
      const side = job.side === 'near' ? Math.sign(p[0]) || 1 : (job.side || 1);
      const gx = { A: 0.7, B: 2.1, C: 3.4, edge: 5.5, contain: 6.5 }[job.rush] ?? 2;
      const tx = M.X(side * gx * (job.rush === 'contain' ? 1 : 0.8)), ty = M.Y(-2.6);
      ctx.strokeStyle = '#c4101f'; ctx.fillStyle = '#c4101f';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx, ty); ctx.stroke();
      arrowHead(ctx, x0, y0, tx, ty, r * 1.5);
    } else if (job.man) {
      const tgtRole = job.man === 'L1' ? 'L1' : job.man === 'R1' ? 'R1' : job.man === 'B1' ? 'B1' : job.man === 'L2' || job.man === 'slot' ? 'L2' : null;
      const t = tgtRole ? offense[tgtRole] : [p[0] * 0.5, -0.5];
      ctx.strokeStyle = ink; ctx.setLineDash([lw * 1.8, lw * 1.6]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(M.X(t[0]), M.Y(t[1] + 1.2)); ctx.stroke();
      ctx.setLineDash([]);
      if (job.tech === 'press') { ctx.font = `800 ${Math.round(r * 1.3)}px Arial`; ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText('P', x0 + r * 2, y0 - r); }
    } else if (job.spy) {
      ctx.strokeStyle = '#7a2bbf'; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(M.X(0), M.Y(-3.5)); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // the defenders as X's
  for (const [role, [px, pz]] of Object.entries(pos)) {
    const cx = M.X(px), cy = M.Y(pz), s = r * 0.95;
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.4, lw * 1.05);
    ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
    void role;
  }
  ctx.restore();
}

/** Special-teams cards: a simple picture for each kind. */
export function drawSpecialArt(ctx, play, x, y, w, h, opts = {}) {
  const ink = opts.ink || '#151515';
  const M = mapper(x, y, w, h, 40, 36, 0.62);
  const r = Math.max(2.4, M.s * 0.62);
  ctx.save();
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(1.2, M.s * 0.3);
  const id = play.id || '';
  const dot = (px, pz, sq) => { ctx.beginPath(); if (sq) ctx.rect(M.X(px) - r, M.Y(pz) - r, r * 2, r * 2); else ctx.arc(M.X(px), M.Y(pz), r, 0, Math.PI * 2); ctx.fillStyle = opts.paper || '#f4f1e8'; ctx.fill(); ctx.stroke(); ctx.fillStyle = ink; };
  const line = (a, b, head = true, dash = false) => {
    if (dash) ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(M.X(a[0]), M.Y(a[1])); ctx.lineTo(M.X(b[0]), M.Y(b[1])); ctx.stroke();
    ctx.setLineDash([]);
    if (head) arrowHead(ctx, M.X(a[0]), M.Y(a[1]), M.X(b[0]), M.Y(b[1]), r * 1.5);
  };
  if (play.kind === 'kickoff') {
    for (let i = -3; i <= 3; i++) if (i) dot(i * 4.5, -1);
    dot(0, -5);
    const tz = id === 'ko_onside' ? 10 : id === 'ko_squib' ? 22 : id === 'ko_pooch' ? 26 : 34;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(M.X(0), M.Y(-1)); ctx.quadraticCurveTo(M.X(0), M.Y(tz * 0.5 + (id === 'ko_squib' ? 0 : 12)), M.X(id === 'ko_onside' ? 9 : 0), M.Y(tz)); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = -3; i <= 3; i++) if (i) line([i * 4.5, -1], [i * 3.8, 8]);
  } else if (play.kind === 'return') {
    for (const [px, pz] of [[-8, 12], [0, 12], [8, 12], [-4, 20], [4, 20]]) dot(px, pz);
    dot(0, 30);
    const lane = play.lane || 0;
    line([0, 30], [lane * 9, 12], true, true);
    if (play.reverse) line([lane * 9, 18], [-lane * 12, 8], true, true);
  } else if (play.kind === 'punt' || play.kind === 'puntReturn' || play.id?.startsWith('pt_')) {
    for (const px of [-1.35, 0, 1.35]) dot(px, -0.6, px === 0);
    dot(-12, -0.4); dot(12, -0.4); dot(0, -4.5); dot(0, -10);
    if (play.kind === 'punt') { ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(M.X(0), M.Y(-10)); ctx.quadraticCurveTo(M.X(0), M.Y(20), M.X(play.aim === 'corner' ? 14 : 0), M.Y(26)); ctx.stroke(); ctx.setLineDash([]); line([-12, -0.4], [-10, 18]); line([12, -0.4], [10, 18]); }
    else if (play.fake === 'pass') { line([-12, -0.4], [-7, 7]); line([12, -0.4], [12, 20]); line([0, -4.5], [-6, 1]); }
    else if (play.fake === 'run') { line([0, -4.5], [2.5, 4], true, true); }
  } else {
    // field goal / PAT
    for (const px of [-1.35, 0, 1.35]) dot(px, -0.6, px === 0);
    dot(-2.4, -0.7); dot(2.4, -0.7); dot(0, -6.8); dot(-1.8, -9.1);
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(M.X(0), M.Y(-6.8)); ctx.quadraticCurveTo(M.X(0), M.Y(12), M.X(0), M.Y(24)); ctx.stroke();
    ctx.setLineDash([]);
    // the uprights
    ctx.beginPath(); ctx.moveTo(M.X(-3), M.Y(24)); ctx.lineTo(M.X(3), M.Y(24)); ctx.moveTo(M.X(-3), M.Y(24)); ctx.lineTo(M.X(-3), M.Y(29)); ctx.moveTo(M.X(3), M.Y(24)); ctx.lineTo(M.X(3), M.Y(29)); ctx.moveTo(M.X(0), M.Y(24)); ctx.lineTo(M.X(0), M.Y(21)); ctx.stroke();
    if (play.fake === 'pass') { line([2.4, -0.7], [8, 3]); line([0, -6.8], [-3, -5]); }
    if (play.fake === 'run') line([0, -6.8], [7, 2], true, true);
    if (play.kind === 'fgDefense') { for (const px of [-4, -2, 2, 4]) line([px, 1.5], [px * 0.4, -3]); }
  }
  ctx.restore();
}
