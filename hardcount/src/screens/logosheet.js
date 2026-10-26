// QA: the league on paper. Every team's logo at three sizes, wordmark,
// colours, a flat front view of each kit and a side view of the helmet, so
// the whole league can be reviewed in a few screenshots.
//   ?screen=logosheet&page=N      (L1 / R1 or ← → to flip pages, ◯ back)
//   &crt=0                        (CRT effects off, for crisp captures)
// Pages: 0 league · 1-4 pros · 5 colleges · 6-9 college detail ·
//        10-11 high-school rivals · 12 generated high schools · 13 emblem library
import { registerScreen, go, game } from '../main.js';
import { input } from '../core/input.js';
import { C, text, vText, vWidth, measure, hints, roundRect } from '../core/ui.js';
import { TEAMS, COLLEGES, HS_RIVALS, LEAGUE, COLLEGE_CONFERENCES, divisionTeams, makeHighSchool } from '../data/teams.js';
import { drawLogo, drawWordmark, drawBlockText, drawEmblem, EMBLEM_IDS, mixHex } from '../gfx/logos.js';

// ------------------------------------------------------------------ kit & helmet art

const shoeColor = (kit) => (kit.shoes === 'white' ? '#eceff2' : kit.shoes === 'team' ? kit.socks : '#16171a');
const lighten = (c, t) => mixHex(c, '#ffffff', t);
const darken = (c, t) => mixHex(c, '#000000', t);

function pathOf(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/**
 * A uniform laid out flat, catalogue style: jersey with its number, pants,
 * socks and shoes, gloves to the side. (cx, top) = top centre; W = jersey width.
 */
export function drawKitFront(ctx, kit, cx, top, W, opts = {}) {
  const X = (u) => cx + u * W, Y = (v) => top + v * W;
  const half = [[0.12, 0], [0.42, 0.05], [0.5, 0.31], [0.36, 0.345], [0.335, 0.34], [0.3, 0.93]];
  const jersey = [...half, [-0.3, 0.93], [-0.335, 0.34], [-0.36, 0.345], [-0.5, 0.31], [-0.42, 0.05], [-0.12, 0]].map(([u, v]) => [X(u), Y(v)]);
  const outline = darken(kit.jersey, 0.6);
  ctx.save();
  ctx.lineJoin = 'round';
  // --- pants (behind the jersey hem)
  const pr = [[0, 0.9], [0.3, 0.9], [0.33, 1.43], [0.06, 1.43], [0.03, 1.13], [0, 1.11]];
  const pants = [...pr, ...pr.slice(1, -1).reverse().map(([u, v]) => [-u, v])].map(([u, v]) => [X(u), Y(v)]);
  pathOf(ctx, pants);
  ctx.fillStyle = kit.pants;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // pant stripes down the outer seams
  const ps = kit.pantStripe, pc = kit.pantStripeColors || [];
  for (const s of [-1, 1]) {
    const seam = (v) => 0.3 + (0.33 - 0.3) * ((v - 0.9) / 0.53);
    const band = (off, wv, col) => {
      pathOf(ctx, [[X(s * (seam(0.9) - off)), Y(0.9)], [X(s * (seam(1.43) - off)), Y(1.43)], [X(s * (seam(1.43) - off - wv)), Y(1.43)], [X(s * (seam(0.9) - off - wv)), Y(0.9)]]);
      ctx.fillStyle = col;
      ctx.fill();
    };
    if (ps === 'single') band(0.04, 0.05, pc[0]);
    else if (ps === 'double') { band(0.035, 0.026, pc[0]); band(0.075, 0.026, pc[1] || pc[0]); }
    else if (ps === 'triple') { band(0.03, 0.02, pc[0]); band(0.058, 0.024, pc[1] || pc[0]); band(0.09, 0.02, pc[2] || pc[0]); }
    else if (ps === 'bolt') {
      const sx = (u) => X(s * u);
      pathOf(ctx, [[sx(0.3), Y(0.92)], [sx(0.22), Y(1.12)], [sx(0.27), Y(1.13)], [sx(0.2), Y(1.42)], [sx(0.31), Y(1.1)], [sx(0.26), Y(1.09)], [sx(0.32), Y(0.92)]]);
      ctx.fillStyle = pc[0];
      ctx.fill();
      if (pc[1]) { ctx.strokeStyle = pc[1]; ctx.lineWidth = Math.max(1, W * 0.012); ctx.stroke(); }
    }
  }
  ctx.restore();
  pathOf(ctx, pants);
  ctx.strokeStyle = darken(kit.pants, 0.55);
  ctx.lineWidth = Math.max(1, W * 0.018);
  ctx.stroke();
  // knee pads hint
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(1, W * 0.012);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X(s * 0.19), Y(1.28), W * 0.09, W * 0.06, 0, 0, Math.PI * 2); ctx.stroke(); }
  // --- socks and shoes
  for (const s of [-1, 1]) {
    const sx = X(s * 0.19) - W * 0.1;
    ctx.fillStyle = kit.socks;
    ctx.fillRect(sx, Y(1.43), W * 0.2, W * 0.3);
    (kit.sockStripes || []).forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(sx, Y(1.47 + i * 0.05), W * 0.2, W * 0.03); });
    ctx.strokeStyle = darken(kit.socks, 0.55);
    ctx.strokeRect(sx, Y(1.43), W * 0.2, W * 0.3);
    roundRect(ctx, sx - W * 0.02, Y(1.72), W * 0.26, W * 0.085, W * 0.03);
    ctx.fillStyle = shoeColor(kit);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }
  // --- gloves, laid by the socks
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(X(s * 0.47), Y(1.56));
    ctx.rotate(s * 0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.065, W * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = kit.gloves;
    ctx.fill();
    ctx.strokeStyle = darken(kit.gloves, 0.55);
    ctx.stroke();
    ctx.restore();
  }
  // --- jersey
  pathOf(ctx, jersey);
  ctx.fillStyle = kit.jersey;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const sc = kit.sleeveColors || [];
  const sleeveBands = (offs, widths) => {
    for (const s of [-1, 1]) {
      offs.forEach((o, i) => {
        // bands run parallel to the sleeve's end, a little way up the arm
        const a = [0.5, 0.31], b = [0.36, 0.345];
        const up = [-0.06, -0.24];
        const len = Math.hypot(...up);
        const ux = up[0] / len, uy = up[1] / len;
        const p = (pt, d) => [X(s * (pt[0] + ux * d)), Y(pt[1] + uy * d)];
        pathOf(ctx, [p(a, o), p(b, o), p(b, o + widths[i]), p(a, o + widths[i])]);
        ctx.fillStyle = sc[i] || sc[0];
        ctx.fill();
      });
    }
  };
  if (kit.sleeve === 'stripes2') sleeveBands([0.035, 0.085], [0.032, 0.032]);
  else if (kit.sleeve === 'stripes3') sleeveBands([0.03, 0.065, 0.1], [0.025, 0.025, 0.025]);
  else if (kit.sleeve === 'cuff') sleeveBands([0], [0.06]);
  else if (kit.sleeve === 'shoulder') {
    for (const s of [-1, 1]) {
      pathOf(ctx, [[X(s * 0.12), Y(0)], [X(s * 0.43), Y(0.05)], [X(s * 0.455), Y(0.13)], [X(s * 0.15), Y(0.075)]]);
      ctx.fillStyle = sc[0];
      ctx.fill();
      if (sc[1]) {
        pathOf(ctx, [[X(s * 0.15), Y(0.075)], [X(s * 0.455), Y(0.13)], [X(s * 0.46), Y(0.155)], [X(s * 0.155), Y(0.098)]]);
        ctx.fillStyle = sc[1];
        ctx.fill();
      }
    }
  } else if (kit.sleeve === 'yoke') {
    pathOf(ctx, [[X(-0.6), Y(-0.1)], [X(0.6), Y(-0.1)], [X(0.6), Y(0.16)], [X(0.3), Y(0.17)], [X(0.12), Y(0.24)], [X(0), Y(0.18)], [X(-0.12), Y(0.24)], [X(-0.3), Y(0.17)], [X(-0.6), Y(0.16)]]);
    ctx.fillStyle = sc[0];
    ctx.fill();
  } else if (kit.sleeve === 'bolt') {
    for (const s of [-1, 1]) {
      const p = (u, v) => [X(s * u), Y(v)];
      pathOf(ctx, [p(0.14, 0.0), p(0.36, 0.13), p(0.31, 0.15), p(0.5, 0.29), p(0.27, 0.19), p(0.32, 0.17), p(0.2, 0.0)]);
      ctx.fillStyle = sc[0];
      ctx.fill();
      if (sc[1]) { ctx.strokeStyle = sc[1]; ctx.lineWidth = Math.max(1, W * 0.012); ctx.stroke(); }
    }
  }
  if (kit.sideColor) {
    for (const s of [-1, 1]) {
      pathOf(ctx, [[X(s * 0.345), Y(0.34)], [X(s * 0.31), Y(0.95)], [X(s * 0.25), Y(0.95)], [X(s * 0.285), Y(0.34)]]);
      ctx.fillStyle = kit.sideColor;
      ctx.fill();
    }
  }
  // fabric shading
  const sh = ctx.createLinearGradient(X(-0.5), 0, X(0.5), 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.18)');
  sh.addColorStop(0.3, 'rgba(255,255,255,0.06)');
  sh.addColorStop(0.7, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sh;
  ctx.fillRect(X(-0.6), Y(-0.1), W * 1.2, W * 1.1);
  ctx.restore();
  // collar: a V neck in the collar colour
  pathOf(ctx, [[X(-0.13), Y(0)], [X(0), Y(0.15)], [X(0.13), Y(0)]]);
  ctx.fillStyle = '#17181b';
  ctx.fill();
  ctx.strokeStyle = kit.collar;
  ctx.lineWidth = Math.max(1.5, W * 0.035);
  ctx.stroke();
  pathOf(ctx, jersey);
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, W * 0.018);
  ctx.stroke();
  // the number
  const num = String(opts.number ?? 12);
  const nh = W * 0.36;
  drawBlockText(ctx, num, cx, Y(0.56), nh, {
    font: kit.numberFont, align: 'center', middle: true, fill: kit.numbers,
    outline: kit.numberOutline || undefined, ow: nh * 0.075, gap: kit.numberOutline || kit.jersey,
  });
  ctx.restore();
}

/** A helmet in profile, facing right. (cx, cy) = centre; w = width of the shell. */
export function drawHelmetSide(ctx, team, cx, cy, w) {
  const h = team.helmet;
  const X = (u) => cx + u * w, Y = (v) => cy + v * w;
  const shell = new Path2D();
  const P = (u, v) => [X(u), Y(v)];
  const m = (u, v) => shell.moveTo(...P(u, v));
  const c = (a, b, cc, d, e, f) => shell.bezierCurveTo(...P(a, b), ...P(cc, d), ...P(e, f));
  m(-0.4, 0.2);
  c(-0.48, 0.02, -0.46, -0.24, -0.3, -0.36);
  c(-0.14, -0.46, 0.14, -0.46, 0.3, -0.34);
  c(0.4, -0.26, 0.44, -0.14, 0.43, -0.04);
  shell.lineTo(...P(0.38, -0.02));
  c(0.36, 0.06, 0.34, 0.14, 0.3, 0.22);
  c(0.22, 0.26, 0.12, 0.26, 0.06, 0.2);
  c(0.0, 0.14, -0.06, 0.16, -0.12, 0.22);
  c(-0.22, 0.26, -0.32, 0.26, -0.4, 0.2);
  shell.closePath();
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // facemask behind the shell's front edge
  const fm = h.facemask;
  const bars = new Path2D();
  const bm = (u, v) => bars.moveTo(...P(u, v));
  const bl = (u, v) => bars.lineTo(...P(u, v));
  bm(0.38, -0.03); bl(0.55, -0.01); bl(0.5, 0.24); bl(0.27, 0.22);
  bm(0.35, 0.09); bl(0.53, 0.11);
  bm(0.5, -0.0); bl(0.47, 0.235);
  ctx.strokeStyle = darken(fm, 0.6);
  ctx.lineWidth = w * 0.05;
  ctx.stroke(bars);
  ctx.strokeStyle = fm;
  ctx.lineWidth = w * 0.03;
  ctx.stroke(bars);
  // shell
  ctx.fillStyle = h.shell;
  ctx.fill(shell);
  ctx.save();
  ctx.clip(shell);
  // stripes over the crown, following the profile
  const sc = h.stripeColors || [];
  const crown = new Path2D();
  crown.moveTo(...P(0.43, -0.2));
  crown.bezierCurveTo(...P(0.36, -0.36), ...P(0.12, -0.46), ...P(-0.06, -0.44));
  crown.bezierCurveTo(...P(-0.26, -0.42), ...P(-0.44, -0.3), ...P(-0.48, -0.02));
  const band = (wv, col, dy = 0) => {
    ctx.save();
    ctx.translate(0, dy * w);
    ctx.strokeStyle = col;
    ctx.lineWidth = wv * w;
    ctx.stroke(crown);
    ctx.restore();
  };
  if (h.stripe === 'single') band(0.05, sc[0]);
  else if (h.stripe === 'double') { band(0.028, sc[0], -0.012); band(0.028, sc[1] || sc[0], 0.042); }
  else if (h.stripe === 'triple') { band(0.02, sc[0], -0.022); band(0.03, sc[1] || sc[0], 0.012); band(0.02, sc[2] || sc[0], 0.046); }
  else if (h.stripe === 'skunk') { band(0.11, sc[1] || sc[0], 0.01); band(0.08, sc[0], 0.01); }
  else if (h.stripe === 'wings') {
    const wing = [P(0.46, -0.06), P(0.36, -0.33), P(0.16, -0.45), P(-0.06, -0.33), P(0.1, -0.29), P(-0.1, -0.2), P(0.1, -0.15), P(-0.04, -0.06), P(0.2, -0.04), P(0.4, 0.0)];
    pathOf(ctx, wing);
    ctx.fillStyle = sc[0];
    ctx.fill();
    if (sc[1]) { ctx.strokeStyle = sc[1]; ctx.lineWidth = w * 0.018; ctx.stroke(); }
  } else if (h.stripe === 'bolt') {
    pathOf(ctx, [P(0.4, -0.3), P(0.06, -0.14), P(0.12, -0.11), P(-0.42, 0.12), P(-0.02, -0.18), P(-0.08, -0.21), P(0.3, -0.4)]);
    ctx.fillStyle = sc[0];
    ctx.fill();
    if (sc[1]) { ctx.strokeStyle = sc[1]; ctx.lineWidth = w * 0.016; ctx.stroke(); }
  }
  // finish: shading and specular
  const g1 = ctx.createLinearGradient(0, Y(-0.46), 0, Y(0.26));
  if (h.finish === 'chrome') {
    g1.addColorStop(0, 'rgba(255,255,255,0.55)');
    g1.addColorStop(0.32, 'rgba(255,255,255,0.05)');
    g1.addColorStop(0.42, 'rgba(0,0,0,0.45)');
    g1.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g1.addColorStop(0.75, 'rgba(0,0,0,0.05)');
    g1.addColorStop(1, 'rgba(0,0,0,0.5)');
  } else if (h.finish === 'matte') {
    g1.addColorStop(0, 'rgba(255,255,255,0.08)');
    g1.addColorStop(1, 'rgba(0,0,0,0.28)');
  } else {
    g1.addColorStop(0, 'rgba(255,255,255,0.22)');
    g1.addColorStop(0.5, 'rgba(255,255,255,0)');
    g1.addColorStop(1, 'rgba(0,0,0,0.36)');
  }
  ctx.fillStyle = g1;
  ctx.fillRect(X(-0.6), Y(-0.6), w * 1.2, w);
  if (h.finish === 'pearl') {
    const g2 = ctx.createLinearGradient(X(-0.4), Y(-0.4), X(0.4), Y(0.2));
    g2.addColorStop(0, 'rgba(255,240,255,0.0)');
    g2.addColorStop(0.45, 'rgba(220,255,250,0.22)');
    g2.addColorStop(1, 'rgba(255,220,240,0.0)');
    ctx.fillStyle = g2;
    ctx.fillRect(X(-0.6), Y(-0.6), w * 1.2, w);
  }
  if (h.finish !== 'matte') {
    ctx.beginPath();
    ctx.ellipse(X(0.12), Y(-0.33), w * 0.16, w * 0.05, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = h.finish === 'chrome' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)';
    ctx.fill();
  }
  ctx.restore();
  // decal, ear hole, number on the back
  if (h.logo) drawLogo(ctx, team, X(-0.05), Y(-0.06), w * 0.4);
  ctx.beginPath();
  ctx.arc(X(0.12), Y(0.08), w * 0.032, 0, Math.PI * 2);
  ctx.fillStyle = darken(h.shell, 0.65);
  ctx.fill();
  if (h.number) {
    drawBlockText(ctx, '12', X(-0.37), Y(0.12), w * 0.09, { font: 'block', align: 'center', middle: true, fill: (h.stripeColors || [])[0] || '#ffffff', outline: darken(h.shell, 0.6), ow: w * 0.008 });
  }
  ctx.strokeStyle = darken(h.shell, 0.7);
  ctx.lineWidth = Math.max(1, w * 0.018);
  ctx.stroke(shell);
  // chin strap
  ctx.strokeStyle = 'rgba(240,240,240,0.85)';
  ctx.lineWidth = Math.max(1, w * 0.016);
  ctx.beginPath();
  ctx.moveTo(...P(0.2, 0.22));
  ctx.quadraticCurveTo(...P(0.28, 0.34), ...P(0.4, 0.3));
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ page parts

function swatches(ctx, team, x, y, s = 16, labels = true) {
  const cs = [team.colors.primary, team.colors.secondary, team.colors.accent, team.colors.dark];
  cs.forEach((col, i) => {
    const xx = x + i * (s + (labels ? 46 : 4));
    ctx.fillStyle = col;
    ctx.fillRect(xx, y, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(xx + 0.5, y + 0.5, s - 1, s - 1);
    if (labels) text(ctx, col.toUpperCase(), xx + s + 3, y + s - 4, { size: 10, color: C.dim, weight: 600, shadow: false, font: '"Consolas", "DejaVu Sans Mono", monospace' });
  });
}

function plate(ctx, x, y, w, h, color = '#c9ced5') {
  roundRect(ctx, x, y, w, h, 6);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, lighten(color, 0.12));
  g.addColorStop(1, darken(color, 0.12));
  ctx.fillStyle = g;
  ctx.fill();
}

function cardFrame(ctx, team, x, y, w, h, title, sub) {
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(10,13,22,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,180,220,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // header bar in the team's colours
  ctx.save();
  roundRect(ctx, x, y, w, 28, 8);
  ctx.clip();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, team.colors.primary);
  g.addColorStop(0.7, team.colors.primary);
  g.addColorStop(1, team.colors.dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 28);
  ctx.fillStyle = team.colors.secondary;
  ctx.fillRect(x, y + 25, w, 3);
  ctx.restore();
  const light = luminance(team.colors.primary) > 0.6;
  const subW = sub ? measure(ctx, sub, { size: 10.5, weight: 700 }) : 0;
  const avail = w - subW - 34;
  const ts = Math.min(13, 13 * avail / Math.max(1, vWidth(title, 13)));
  vText(ctx, title, x + 10, y + 14 + ts / 2, ts, { color: light ? '#10131a' : '#ffffff', weight: 0.15, skew: -0.15 });
  // the bar fades to the team's dark colour on the right
  if (sub) text(ctx, sub, x + w - 10, y + 19, { size: 10.5, color: luminance(team.colors.dark) > 0.55 ? '#141821' : '#e6ebf2', align: 'right', weight: 700, shadow: false });
}

/** The in-game score bug, to see the 24 px logo where it lives. */
function scoreBug(ctx, team, x, y, w, score) {
  roundRect(ctx, x, y, w, 26, 3);
  const g = ctx.createLinearGradient(0, y, 0, y + 26);
  g.addColorStop(0, lighten(team.colors.primary, 0.18));
  g.addColorStop(1, darken(team.colors.primary, 0.25));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = team.colors.secondary;
  ctx.fillRect(x, y + 23, w, 3);
  drawLogo(ctx, team, x + 15, y + 13, 24);
  const light = luminance(team.colors.primary) > 0.6;
  vText(ctx, team.abbr, x + 31, y + 18, 11, { color: light ? '#111' : '#fff', weight: 0.17, skew: -0.12 });
  roundRect(ctx, x + w - 30, y + 3, 26, 18, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  vText(ctx, String(score), x + w - 17, y + 17, 12, { align: 'center', color: '#ffe9a8', weight: 0.18, skew: 0 });
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const STYLE_TXT = (t) => `${t.style.offense.toUpperCase()} / ${t.style.defense.toUpperCase()} · TEMPO ${Math.round(t.style.tempo * 100)}`;

/** Full detail card: logo ×3, wordmark, colours, kits, helmet. */
function teamCard(ctx, team, x, y, w, h, opts = {}) {
  const level = team.level;
  const sub = level === 'pro' ? `${team.conference} ${team.division.toUpperCase()} · EST. ${team.founded}`
    : level === 'college' ? `${team.conference.toUpperCase()}` : `STR ${Math.round(team.strength * 100)}`;
  cardFrame(ctx, team, x, y, w, h, `${team.abbr}  ${team.city} ${team.name}`.toUpperCase(), sub);
  const compact = w < 400;
  if (!compact) scoreBug(ctx, team, x + 8, y + h - 34, 132, (team.id.charCodeAt(0) * 7) % 35);
  const top = y + 34;
  // left column: the logo big, then 40 px, 24 px and the mono stencil on grass
  const big = compact ? 88 : 116;
  const pw = big + 16;
  plate(ctx, x + 8, top, pw, pw);
  drawLogo(ctx, team, x + 8 + pw / 2, top + pw / 2, big);
  const sy = top + pw + 5;
  plate(ctx, x + 8, sy, pw, 44);
  drawLogo(ctx, team, x + 30, sy + 22, 40);
  drawLogo(ctx, team, x + 64, sy + 22, 24);
  ctx.fillStyle = '#2d6b31';
  roundRect(ctx, x + 80, sy + 4, pw - 76, 36, 4);
  ctx.fill();
  drawLogo(ctx, team, x + 80 + (pw - 76) / 2, sy + 22, 32, { mono: '#f4f4f0' });
  // right column: wordmark on the team colour, colours, facts
  const rx = x + pw + 16, rw = w - pw - 24;
  const wmH = compact ? 46 : 58;
  roundRect(ctx, rx, top, rw, wmH, 5);
  ctx.fillStyle = team.colors.primary;
  ctx.fill();
  drawWordmark(ctx, team, rx + rw / 2, top + wmH * (compact ? 0.56 : 0.62), compact ? 20 : 25, { maxWidth: rw - 14, city: !compact });
  let ty = top + wmH + 7;
  swatches(ctx, team, rx, ty, compact ? 12 : 13, !compact);
  ty += compact ? 30 : 33;
  const lg = team.logo;
  if (compact) {
    text(ctx, `${team.stadium || ''}`.toUpperCase(), rx, ty, { size: 9.5, color: C.text, weight: 700, shadow: false });
    text(ctx, `STR ${Math.round(team.strength * 100)} · ${team.style.offense.toUpperCase()} / ${team.style.defense.toUpperCase()}`, rx, ty + 14, { size: 9.5, color: C.accent, weight: 800, shadow: false });
    text(ctx, `${lg.emblem.toUpperCase()}${lg.letter ? ' + ' + lg.letter : ''} · ${(team.wordmark?.style || '').toUpperCase()}`, rx, ty + 28, { size: 9.5, color: C.dim, weight: 700, shadow: false });
  } else {
    text(ctx, `${(team.stadium || '').toUpperCase()}  ·  ${team.venue.toUpperCase()}`, rx, ty, { size: 10.5, color: C.text, weight: 700, shadow: false });
    text(ctx, `${STYLE_TXT(team)}  ·  STRENGTH ${Math.round(team.strength * 100)}`, rx, ty + 14, { size: 10, color: C.accent, weight: 800, shadow: false });
    text(ctx, `LOGO ${lg.emblem.toUpperCase()}${lg.letter ? ' + ' + lg.letter : ''} · WORDMARK ${(team.wordmark?.style || '').toUpperCase()}`, rx, ty + 28, { size: 9.5, color: C.dim, weight: 700, shadow: false });
  }
  // bottom row: the kits laid out flat, then the helmet
  const kits = ['home', 'away', 'alt'].filter((k) => team.uniform[k]);
  const kw = compact ? 44 : 50;
  const ky = y + h - kw * 1.84 - 12;
  const kx0 = compact ? x + 36 : rx + 30;
  kits.forEach((k, i) => {
    const kx = kx0 + i * (kw * 1.24);
    text(ctx, k.toUpperCase(), kx, ky - 4, { size: 9, color: C.dim, align: 'center', weight: 800, shadow: false });
    drawKitFront(ctx, team.uniform[k], kx, ky, kw, { number: opts.numbers?.[i] ?? [12, 84, 7][i] });
  });
  const hw = compact ? 100 : 112;
  drawHelmetSide(ctx, team, x + w - hw * 0.58 - 8, y + h - hw * 0.42 - 14, hw);
  text(ctx, `${team.helmet.finish.toUpperCase()} · ${team.helmet.stripe.toUpperCase()}`, x + w - 8, y + h - 6, { size: 9, color: C.dim, align: 'right', weight: 800, shadow: false });
}

/** Compact tile for overview pages. */
function logoTile(ctx, team, x, y, w, h, size) {
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = 'rgba(10,13,22,0.8)';
  ctx.fill();
  ctx.fillStyle = team.colors.primary;
  ctx.fillRect(x + 6, y + h - 5, w - 12, 3);
  drawLogo(ctx, team, x + w / 2, y + 8 + size / 2, size);
}

// ------------------------------------------------------------------ pages

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const GEN_HS = Array.from({ length: 12 }, (_, i) => makeHighSchool(2005 + i * 101));

function pageLeague(ctx) {
  const colW = 238;
  LEAGUE.conferences.forEach((conf, ci) => {
    const cx0 = 32 + ci * 2 * (colW + 12);
    vText(ctx, conf.name.toUpperCase(), cx0 + colW + 6, 118, 15, { align: 'center', color: C.accent, weight: 0.16 });
    conf.divisions.forEach((dv, di) => {
      const x = cx0 + di * (colW + 12);
      text(ctx, `${conf.id} ${dv.toUpperCase()}`, x + colW / 2, 140, { size: 12, color: C.dim, align: 'center', weight: 800, spacing: 2 });
      divisionTeams(conf.id, dv).forEach((t, i) => {
        const y = 150 + i * 138;
        roundRect(ctx, x, y, colW, 130, 8);
        ctx.fillStyle = 'rgba(10,13,22,0.82)';
        ctx.fill();
        ctx.save();
        roundRect(ctx, x, y, colW, 130, 8);
        ctx.clip();
        const g = ctx.createLinearGradient(x, 0, x + colW, 0);
        g.addColorStop(0, t.colors.primary);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, colW, 130);
        ctx.restore();
        plate(ctx, x + 8, y + 10, 104, 104, '#cfd3d9');
        drawLogo(ctx, t, x + 60, y + 62, 92);
        drawWordmark(ctx, t, x + 176, y + 50, 17, { maxWidth: 118, city: true });
        text(ctx, t.abbr, x + 176, y + 84, { size: 13, color: C.text, align: 'center', weight: 800, spacing: 3 });
        text(ctx, `STR ${Math.round(t.strength * 100)}`, x + 176, y + 102, { size: 10.5, color: C.accent, align: 'center', weight: 800 });
        drawLogo(ctx, t, x + colW - 18, y + 116, 22);
      });
    });
  });
}

function pageColleges(ctx) {
  COLLEGE_CONFERENCES.forEach((cf, ci) => {
    const x = 26 + ci * 246;
    vText(ctx, `${cf.toUpperCase()} CONF.`, x + 118, 118, 14, { align: 'center', color: C.accent, weight: 0.16 });
    COLLEGES.filter((t) => t.conference === cf).sort((a, b) => b.strength - a.strength).forEach((t, i) => {
      const y = 128 + i * 92;
      roundRect(ctx, x, y, 236, 86, 7);
      ctx.fillStyle = 'rgba(10,13,22,0.82)';
      ctx.fill();
      ctx.fillStyle = t.colors.primary;
      ctx.fillRect(x, y + 6, 5, 74);
      ctx.fillStyle = t.colors.secondary;
      ctx.fillRect(x + 5, y + 6, 3, 74);
      plate(ctx, x + 12, y + 5, 76, 76, '#cfd3d9');
      drawLogo(ctx, t, x + 50, y + 43, 70);
      text(ctx, t.city.toUpperCase(), x + 96, y + 24, { size: 12, color: C.text, weight: 800 });
      // the brightest of the school colours, so black-and-orange schools still read
      const nameCol = [t.colors.secondary, t.colors.primary, t.colors.accent].sort((a, b) => luminance(b) - luminance(a))[0];
      text(ctx, t.name.toUpperCase(), x + 96, y + 40, { size: 11.5, color: luminance(nameCol) > 0.85 ? '#dfe5ec' : lighten(nameCol, 0.12), weight: 800 });
      text(ctx, `${t.abbr} · ${t.location}`, x + 96, y + 56, { size: 10, color: C.dim, weight: 600, shadow: false });
      text(ctx, `STR ${Math.round(t.strength * 100)}`, x + 96, y + 72, { size: 10, color: t.strength >= 0.8 ? C.accent : C.dim, weight: 800, shadow: false });
      drawLogo(ctx, t, x + 218, y + 70, 24);
    });
  });
}

function pageGenerated(ctx) {
  text(ctx, 'makeHighSchool(seed) — twelve seeds, same school every time', 512, 114, { size: 13, color: C.dim, align: 'center', weight: 700 });
  GEN_HS.forEach((t, i) => {
    const x = 22 + (i % 4) * 248, y = 124 + Math.floor(i / 4) * 196;
    roundRect(ctx, x, y, 238, 188, 8);
    ctx.fillStyle = 'rgba(10,13,22,0.84)';
    ctx.fill();
    ctx.fillStyle = t.colors.primary;
    ctx.fillRect(x, y, 238, 22);
    ctx.fillStyle = t.colors.secondary;
    ctx.fillRect(x, y + 20, 238, 2);
    text(ctx, `${t.city} ${t.name}`.toUpperCase(), x + 8, y + 16, { size: 11, color: luminance(t.colors.primary) > 0.6 ? '#111' : '#fff', weight: 800 });
    plate(ctx, x + 8, y + 30, 92, 92, '#cfd3d9');
    drawLogo(ctx, t, x + 54, y + 76, 84);
    drawLogo(ctx, t, x + 24, y + 140, 24);
    drawLogo(ctx, t, x + 60, y + 140, 36, { mono: '#f4f4f0' });
    drawKitFront(ctx, t.uniform.home, x + 136, y + 36, 46, { number: (i * 7 + 3) % 90 });
    drawHelmetSide(ctx, t, x + 196, y + 82, 70);
    text(ctx, `${t.id} · ${t.abbr} · STR ${Math.round(t.strength * 100)}`, x + 8, y + 180, { size: 9.5, color: C.dim, weight: 700, shadow: false });
  });
}

function pageEmblems(ctx) {
  const ids = EMBLEM_IDS();
  const pal = { fg: '#d9a520', fg2: '#1d3557', acc: '#ffffff', line: '#0b1220', bg: '#1d3557', ring: '#d9a520' };
  const cols = 10, cw = 98, ch = 112;
  ids.forEach((id, i) => {
    const x = 20 + (i % cols) * (cw + 2), y = 100 + Math.floor(i / cols) * (ch + 4);
    roundRect(ctx, x, y, cw, ch, 6);
    ctx.fillStyle = 'rgba(10,13,22,0.84)';
    ctx.fill();
    plate(ctx, x + 4, y + 4, cw - 8, 72, '#cfd3d9');
    drawEmblem(ctx, id, pal, x + cw / 2, y + 40, 66);
    drawEmblem(ctx, id, pal, x + 16, y + 92, 24);
    ctx.fillStyle = '#2d6b31';
    ctx.fillRect(x + 32, y + 79, 30, 26);
    drawEmblem(ctx, id, pal, x + 47, y + 92, 24, { mono: '#f4f4f0' });
    const lbl = id.toUpperCase();
    text(ctx, lbl, x + 66, y + 96, { size: lbl.length > 8 ? 7.5 : 9, color: C.dim, weight: 800, shadow: false });
  });
  // the athletic lettering, every face
  const fonts = ['block', 'pro', 'college', 'italic', 'stencil'];
  fonts.forEach((f, i) => {
    const x = 24 + i * 198, y = 100 + 4 * (ch + 4) + 8;
    roundRect(ctx, x, y, 190, 72, 6);
    ctx.fillStyle = '#123a6b';
    ctx.fill();
    drawBlockText(ctx, '27', x + 50, y + 40, 46, { font: f, align: 'center', middle: true, fill: '#ffffff', outline: '#d9a520', ow: 3.5 });
    drawBlockText(ctx, 'AXEMEN', x + 136, y + 30, 18, { font: f, align: 'center', middle: true, fill: '#d9a520', outline: '#0b1220', ow: 2 });
    text(ctx, f.toUpperCase(), x + 136, y + 62, { size: 10, color: '#cfe0f5', align: 'center', weight: 800, shadow: false });
  });
}

function buildPages() {
  const pages = [{ title: 'THE SEVENS LEAGUE', sub: '16 TEAMS · 2 CONFERENCES · 4 DIVISIONS', draw: pageLeague }];
  chunk(TEAMS, 4).forEach((list, i) => pages.push({
    title: `PRO TEAMS ${i + 1}/4`, sub: 'LOGO 124 / 40 / 24 PX · MONO · WORDMARK · KITS · HELMET',
    draw: (ctx) => list.forEach((t, k) => teamCard(ctx, t, 18 + (k % 2) * 498, 104 + Math.floor(k / 2) * 318, 490, 310)),
  }));
  pages.push({ title: 'COLLEGE FOOTBALL', sub: '24 PROGRAMS · 4 CONFERENCES', draw: pageColleges });
  chunk(COLLEGES, 6).forEach((list, i) => pages.push({
    title: `COLLEGES ${i + 1}/4`, sub: 'LOGO · WORDMARK · COLOURS · HOME / AWAY · HELMET',
    draw: (ctx) => list.forEach((t, k) => teamCard(ctx, t, 14 + (k % 3) * 333, 104 + Math.floor(k / 3) * 318, 327, 310)),
  }));
  chunk(HS_RIVALS, 6).forEach((list, i) => pages.push({
    title: `HIGH SCHOOL DISTRICT ${i + 1}/2`, sub: 'THE CAREER\'S FIRST ACT · VENUE FRIDAY',
    draw: (ctx) => list.forEach((t, k) => teamCard(ctx, t, 14 + (k % 3) * 333, 104 + Math.floor(k / 3) * 318, 327, 310)),
  }));
  pages.push({ title: 'GENERATED HIGH SCHOOLS', sub: 'DETERMINISTIC FROM A SEED', draw: pageGenerated });
  pages.push({ title: 'EMBLEM LIBRARY', sub: `${EMBLEM_IDS().length} EMBLEMS · 66 / 24 PX · MONO · LETTERING`, draw: pageEmblems });
  return pages;
}

// ------------------------------------------------------------------ screen

registerScreen('logosheet', () => {
  const pages = buildPages();
  let page = 0;
  let prevCrt = null;
  return {
    enter(params = {}) {
      page = Math.max(0, Math.min(pages.length - 1, parseInt(params.page ?? 0, 10) || 0));
      if (params.crt !== undefined && game.renderer) {
        prevCrt = game.renderer.crt;
        game.renderer.crt = Math.max(0, Math.min(1, parseFloat(params.crt) || 0));
      }
    },
    exit() {
      if (prevCrt !== null && game.renderer) game.renderer.crt = prevCrt;
    },
    update() {
      const n = pages.length;
      if (input.pressed('tabR') || input.pressed('right')) page = (page + 1) % n;
      if (input.pressed('tabL') || input.pressed('left')) page = (page - 1 + n) % n;
      if (input.pressed('back')) go('huddle');
    },
    draw(ctx) {
      const bg = ctx.createLinearGradient(0, 0, 0, 768);
      bg.addColorStop(0, '#1a2233');
      bg.addColorStop(1, '#090b11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1024, 768);
      const p = pages[page];
      vText(ctx, p.title, 32, 62, 30, { color: C.text, weight: 0.16, outline: 3, outlineColor: 'rgba(0,0,0,0.7)', shadow: [3, 3, 'rgba(0,0,0,0.5)'] });
      text(ctx, p.sub, 34, 86, { size: 12, color: C.dim, weight: 700, spacing: 2 });
      text(ctx, `PAGE ${page + 1} / ${pages.length}`, 992, 62, { size: 14, color: C.accent, align: 'right', weight: 800, spacing: 2 });
      p.draw(ctx);
      hints(ctx, [['tabL', 'PREV'], ['tabR', 'NEXT'], ['back', 'BACK']], { y: 752 });
    },
  };
});
