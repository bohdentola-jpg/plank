// The broadcast package drawn over the picture: the score bug, the big result
// banners, lower-third player cards, the penalty card, the button icons over
// receivers, the kick meter, closed captions and prompts. Mid-2000s network
// look: glossy bars with chrome rims, italic stroke type, team-colour slabs.
import { C, vText, vWidth, text, measure, padGlyph, usingPad, keyCap, roundRect } from '../core/ui.js';
import { drawLogo } from '../gfx/logos.js';
import { clamp, easeOutCubic, easeOutBack, ordinal } from '../core/util.js';

const BTN_KEYS = { cross: 'K', circle: 'L', square: 'J', triangle: 'I', r1: 'E', l1: 'Q' };

function shadeHex(hex, f) {
  const n = parseInt(String(hex || '#888888').replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function lum(hex) {
  const n = parseInt(String(hex || '#888888').replace('#', ''), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

/** A glossy bar: dark glass with a chrome rim and a highlight on the top half. */
function glossBar(ctx, x, y, w, h, top = '#1d2536', bot = '#070a12', rim = true) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(0.5, shadeHex(top, -0.25));
  g.addColorStop(0.52, bot);
  g.addColorStop(1, shadeHex(bot, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // sheen
  const s = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  s.addColorStop(0, 'rgba(255,255,255,0.28)');
  s.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = s;
  ctx.fillRect(x, y, w, h * 0.5);
  if (rim) {
    const r = ctx.createLinearGradient(0, y, 0, y + h);
    r.addColorStop(0, '#eef3fb');
    r.addColorStop(0.5, '#7d889c');
    r.addColorStop(1, '#c3cbd8');
    ctx.strokeStyle = r;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  }
  ctx.restore();
}

function footballIcon(ctx, x, y, s = 7) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 1.5, s, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, '#a5602c'); g.addColorStop(1, '#5a2e12');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(s * 0.6, 0); ctx.stroke();
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.22, -s * 0.28); ctx.lineTo(i * s * 0.22, s * 0.28); ctx.stroke(); }
  ctx.restore();
}

export function fmtClock(sec) {
  sec = Math.max(0, sec);
  if (sec < 10 && sec > 0) return `:${sec.toFixed(1).padStart(4, '0')}`;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function downText(m) {
  if (m.tryMode === 'pat') return 'EXTRA POINT';
  if (m.tryMode === 'two') return '2-POINT TRY';
  // (the series after a kickoff is called while playKind still says 'kickoff')
  if (m.phase === 'kickoff' || (m.playKind === 'kickoff' && m.phase !== 'playcall')) return 'KICKOFF';
  const goal = m.firstDownZ !== undefined && Math.abs(m.firstDownZ) >= m.field.halfL - 0.01 && Math.sign(m.firstDownZ) === Math.sign(m.offDir);
  const togo = goal ? 'GOAL' : m.toGo < 1 ? 'INCHES' : String(Math.round(m.toGo));
  return `${ordinal(m.down).toUpperCase()} & ${togo}`;
}

export function quarterText(m) {
  if (m.phase === 'final') return 'FINAL';
  if (m.phase === 'halftime') return 'HALF';
  if (m.quarter >= 5) return m.ot ? `OT${m.ot.round > 1 ? m.ot.round : ''}` : 'OT';
  return `${ordinal(m.quarter).toUpperCase()}`;
}

export class Hud {
  constructor() {
    this.t = 0;
    this.banners = [];
    this.card = null;
    this.flagCard = null;
    this.captions = [];
    this.toasts = [];
    this.bugIn = 0;
    this.scoreFlash = { home: 0, away: 0 };
    this.lastScore = null;
  }

  banner(str, opts = {}) {
    this.banners = this.banners.filter((b) => b.kind !== opts.kind || !opts.kind);
    this.banners.push({ str, t: 0, dur: opts.dur ?? 2.4, color: opts.color || C.accent, sub: opts.sub || null, kind: opts.kind || 'info', team: opts.team || null, big: !!opts.big });
  }

  showCard(c) { this.card = { ...c, t: 0, dur: c.dur ?? 4.5 }; }
  showFlag(f) { this.flagCard = { ...f, t: 0, dur: f.dur ?? 5 }; }
  hideFlag() { this.flagCard = null; }

  caption(line, who = '') {
    this.captions.push({ text: String(line).toUpperCase(), who, t: 0, dur: Math.min(6, 2.2 + line.length * 0.045) });
    if (this.captions.length > 2) this.captions.shift();
  }

  toast(str, dur = 1.6) { this.toasts.push({ str, t: 0, dur }); }

  update(dt, m) {
    this.t += dt;
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    if (this.card) { this.card.t += dt; if (this.card.t > this.card.dur) this.card = null; }
    if (this.flagCard) { this.flagCard.t += dt; if (this.flagCard.t > this.flagCard.dur) this.flagCard = null; }
    for (const c of this.captions) c.t += dt;
    this.captions = this.captions.filter((c) => c.t < c.dur);
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.dur);
    if (m) {
      if (this.lastScore) for (const s of ['home', 'away']) if (m.score[s] !== this.lastScore[s]) this.scoreFlash[s] = 1.6;
      this.lastScore = { ...m.score };
      for (const s of ['home', 'away']) this.scoreFlash[s] = Math.max(0, this.scoreFlash[s] - dt);
    }
  }

  // ---------------------------------------------------------------- score bug
  drawBug(ctx, m, s = {}) {
    const k = this.bugIn = clamp(this.bugIn + (s.hide ? -1 : 1) * 0.06, 0, 1);
    if (k <= 0) return;
    const y = 690 + (1 - easeOutCubic(k)) * 90;
    const H = 40;
    const slabW = 126, scoreW = 52, midW = 104, ddW = 128, pcW = 44;
    const W = (slabW + scoreW) * 2 + midW + ddW + pcW;
    let x = Math.round(512 - W / 2);
    ctx.save();
    // drop shadow under the whole bar
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 4, y + 5, W, H);
    // the two teams: away on the left, home on the right (the way the old bugs read)
    for (const side of ['away', 'home']) {
      const team = m.teams[side];
      const col = team.colors.primary;
      glossBar(ctx, x, y, slabW, H, shadeHex(col, 0.18), shadeHex(col, -0.35));
      // the logo, cropped into the slab
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 1, y + 1, slabW - 2, H - 2); ctx.clip();
      try { drawLogo(ctx, team, x + 22, y + H / 2, 34); } catch { /* */ }
      ctx.restore();
      const light = lum(col) > 0.62;
      vText(ctx, team.abbr, x + 46, y + 28, 19, { color: light ? '#10131a' : '#ffffff', outline: light ? 0 : 2.5, outlineColor: 'rgba(0,0,0,0.6)', weight: 0.2 });
      // possession
      if (m.possession === side && m.phase !== 'final' && m.phase !== 'halftime' && m.phase !== 'kickoff') footballIcon(ctx, x + slabW - 14, y + 11, 5);
      // timeouts
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < (m.timeouts[side] ?? 0) ? '#ffd23a' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + 48 + i * 15, y + H - 7, 11, 3);
      }
      x += slabW;
      // score (flashes white when it changes)
      const fl = this.scoreFlash[side];
      glossBar(ctx, x, y, scoreW, H, fl > 0 && Math.floor(fl * 6) % 2 === 0 ? '#f4f4f4' : '#262c38', fl > 0 && Math.floor(fl * 6) % 2 === 0 ? '#d8d8d8' : '#05070b');
      vText(ctx, String(m.score[side]), x + scoreW / 2, y + 30, 25, { align: 'center', color: fl > 0 && Math.floor(fl * 6) % 2 === 0 ? '#111' : '#fff', weight: 0.2, skew: -0.08 });
      x += scoreW;
    }
    // quarter + clock
    glossBar(ctx, x, y, midW, H, '#38383e', '#0c0c0f');
    text(ctx, quarterText(m), x + 10, y + 26, { size: 15, weight: 800, color: '#ffd23a', italic: true, spacing: 1 });
    const live = m.clockRunning && m.phase === 'live';
    vText(ctx, m.phase === 'final' || m.phase === 'halftime' ? '' : fmtClock(m.clock), x + midW - 10, y + 29, 21, { align: 'right', color: live ? '#ffffff' : '#dde3ee', weight: 0.18, skew: -0.06 });
    x += midW;
    // down & distance (yellow FLAG when there's laundry on the field)
    const flag = s.flag;
    glossBar(ctx, x, y, ddW, H, flag ? '#ffe04a' : '#38383e', flag ? '#c9a200' : '#0c0c0f');
    if (flag) vText(ctx, 'FLAG', x + ddW / 2, y + 29, 22, { align: 'center', color: '#1a1400', weight: 0.22 });
    else if (m.phase !== 'halftime' && m.phase !== 'final') {
      const dd = downText(m);
      const size = dd.length > 9 ? 14 : 17;
      vText(ctx, dd, x + ddW / 2, y + 27, size, { align: 'center', color: m.down === 4 && !m.tryMode ? '#ffb84a' : '#ffffff', weight: 0.18 });
    }
    x += ddW;
    // play clock
    const pc = s.playClock;
    const pcRed = pc !== null && pc !== undefined && pc <= 5;
    glossBar(ctx, x, y, pcW, H, pcRed ? '#7a1018' : '#38383e', pcRed ? '#2a0306' : '#0c0c0f');
    if (pc !== null && pc !== undefined) vText(ctx, String(Math.ceil(pc)), x + pcW / 2, y + 28, 19, { align: 'center', color: pcRed ? '#ffd0d0' : '#cfd7e6', weight: 0.18, skew: -0.05 });
    ctx.restore();

    // the network bug, top right
    this.drawNetworkBug(ctx);
  }

  drawNetworkBug(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    vText(ctx, 'HCN', 962, 66, 20, { align: 'right', color: '#ffffff', weight: 0.2, outline: 2, outlineColor: 'rgba(0,0,0,0.5)' });
    text(ctx, 'HD', 968, 52, { size: 9, weight: 900, color: '#ffd23a', spacing: 1 });
    ctx.restore();
  }

  // ---------------------------------------------------------------- banners
  drawBanners(ctx) {
    for (const b of this.banners) {
      const kIn = easeOutBack(clamp(b.t / 0.35, 0, 1));
      const kOut = clamp((b.dur - b.t) / 0.3, 0, 1);
      const alpha = Math.min(1, kOut);
      const size = b.big ? 74 : 46;
      const w = vWidth(b.str, size) + 120;
      const cx = 512 + (1 - kIn) * -700;
      const cy = b.big ? 330 : 598;
      ctx.save();
      ctx.globalAlpha = alpha;
      // the slab behind the words: slanted, glossy, in the banner colour
      ctx.translate(cx, cy);
      ctx.transform(1, 0, -0.25, 1, 0, 0);
      const hh = size * 1.25;
      const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
      g.addColorStop(0, shadeHex(b.color, 0.25));
      g.addColorStop(0.5, b.color);
      g.addColorStop(0.52, shadeHex(b.color, -0.35));
      g.addColorStop(1, shadeHex(b.color, -0.15));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-w / 2 + 6, -hh / 2 + 7, w, hh);
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -hh / 2, w, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-w / 2, -hh / 2, w, 2);
      ctx.fillRect(-w / 2, hh / 2 - 2, w, 2);
      // a glint that sweeps across
      const gx = ((b.t * 900) % (w + 400)) - w / 2 - 200;
      const gl = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(-w / 2, -hh / 2, w, hh);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      const light = lum(b.color) > 0.6;
      if (b.team) { try { drawLogo(ctx, b.team, cx - w / 2 + 34, cy, size * 1.1); } catch { /* */ } }
      vText(ctx, b.str, cx + (b.team ? 18 : 0), cy + size * 0.42, size, {
        align: 'center', color: light ? '#141414' : '#ffffff', weight: 0.2,
        outline: light ? 0 : 3, outlineColor: 'rgba(0,0,0,0.55)',
      });
      if (b.sub) text(ctx, b.sub, cx, cy + size * 0.42 + 30, { size: 17, weight: 800, align: 'center', color: '#ffffff', spacing: 2, italic: true });
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- lower third
  drawCard(ctx) {
    const c = this.card;
    if (!c) return;
    const kIn = easeOutCubic(clamp(c.t / 0.4, 0, 1));
    const kOut = clamp((c.dur - c.t) / 0.35, 0, 1);
    const x = 70 - (1 - kIn) * 420, y = 588;
    ctx.save();
    ctx.globalAlpha = kOut;
    const col = c.team?.colors?.primary || '#334';
    glossBar(ctx, x, y, 64, 58, shadeHex(col, 0.15), shadeHex(col, -0.4));
    vText(ctx, String(c.number ?? ''), x + 32, y + 41, 30, { align: 'center', color: lum(col) > 0.62 ? '#111' : '#fff', weight: 0.2, outline: 2, outlineColor: 'rgba(0,0,0,0.5)' });
    const w = Math.max(300, measure(ctx, c.line || '', { size: 15, weight: 700 }) + 40, vWidth(c.name || '', 21) + 70);
    glossBar(ctx, x + 64, y, w, 34, '#f2f4f8', '#c7ccd6');
    vText(ctx, c.name || '', x + 78, y + 25, 19, { color: '#0d1018', weight: 0.2 });
    if (c.pos) text(ctx, c.pos, x + 64 + w - 12, y + 23, { size: 13, weight: 900, color: '#5a6272', align: 'right', spacing: 1, shadow: false });
    glossBar(ctx, x + 64, y + 34, w, 24, '#1f2737', '#080b12', false);
    text(ctx, c.line || '', x + 78, y + 51, { size: 14, weight: 700, color: '#ffd23a', spacing: 1 });
    ctx.restore();
  }

  // ---------------------------------------------------------------- penalty card
  drawFlagCard(ctx) {
    const f = this.flagCard;
    if (!f) return;
    const kIn = easeOutCubic(clamp(f.t / 0.35, 0, 1));
    const kOut = clamp((f.dur - f.t) / 0.3, 0, 1);
    const w = 440, h = f.lines?.length ? 74 + f.lines.length * 22 : 96;
    const x = 512 - w / 2, y = 150 - (1 - kIn) * 60;
    ctx.save();
    ctx.globalAlpha = kOut * kIn;
    glossBar(ctx, x, y, w, 34, '#ffe85a', '#d9b000');
    vText(ctx, 'FLAG', x + 16, y + 26, 22, { color: '#1a1400', weight: 0.22 });
    text(ctx, f.title || '', x + w - 14, y + 23, { size: 15, weight: 900, color: '#1a1400', align: 'right', spacing: 1, shadow: false });
    glossBar(ctx, x, y + 34, w, h - 34, '#1f2737', '#070a12');
    vText(ctx, f.name || '', x + 16, y + 66, 21, { color: '#ffffff', weight: 0.19 });
    (f.lines || []).forEach((l, i) => text(ctx, l, x + 18, y + 92 + i * 22, { size: 15, weight: 700, color: i === 0 ? '#ffd23a' : '#c9d1df', spacing: 1 }));
    ctx.restore();
  }

  // ---------------------------------------------------------------- closed captions
  drawCaptions(ctx) {
    if (!this.captions.length) return;
    ctx.save();
    ctx.font = '700 17px "Consolas", "Lucida Console", "DejaVu Sans Mono", monospace';
    let y = 104;
    for (const c of this.captions) {
      const words = c.text.split(' ');
      const lines = [];
      let cur = '>> ';
      for (const w of words) {
        if ((cur + w).length > 46) { lines.push(cur.trimEnd()); cur = ''; }
        cur += w + ' ';
      }
      if (cur.trim()) lines.push(cur.trimEnd());
      // the caption box pops on line by line, the way the old decoders painted it
      const shown = Math.min(lines.length, 1 + Math.floor(c.t / 0.35));
      for (let i = 0; i < shown; i++) {
        const l = lines[i];
        const w = ctx.measureText(l).width + 16;
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(512 - w / 2, y - 18, w, 24);
        ctx.fillStyle = '#f2f2f2';
        ctx.textAlign = 'center';
        ctx.fillText(l, 512, y);
        y += 24;
      }
      y += 4;
    }
    ctx.restore();
  }

  drawToasts(ctx) {
    let y = 250;
    for (const t of this.toasts) {
      const a = clamp(Math.min(t.t / 0.15, (t.dur - t.t) / 0.25), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      const w = vWidth(t.str, 26) + 50;
      glossBar(ctx, 512 - w / 2, y - 26, w, 38, '#38383e', '#0c0c0f');
      vText(ctx, t.str, 512, y + 2, 26, { align: 'center', color: '#ffd23a', weight: 0.2 });
      ctx.restore();
      y += 46;
    }
  }

  // ---------------------------------------------------------------- receiver / player icons
  drawIcons(ctx, icons) {
    for (const ic of icons) {
      if (!ic.p) continue;
      const r = ic.big ? 14 : 12;
      ctx.save();
      ctx.globalAlpha = ic.alpha ?? 1;
      if (ic.open !== undefined) {
        // a soft halo: green when he's open, red when he's blanketed
        ctx.beginPath();
        ctx.arc(ic.p.x, ic.p.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = ic.open > 0.25 ? 'rgba(80,255,140,0.35)' : ic.open > -0.1 ? 'rgba(255,220,80,0.3)' : 'rgba(255,80,80,0.3)';
        ctx.fill();
      }
      if (usingPad()) padGlyph(ctx, ic.btn === 'r1' ? 'R1' : ic.btn === 'l1' ? 'L1' : ic.btn, ic.p.x, ic.p.y, r);
      else keyCap(ctx, BTN_KEYS[ic.btn] || ic.btn.toUpperCase(), ic.p.x, ic.p.y, r * 1.8);
      if (ic.label) text(ctx, ic.label, ic.p.x, ic.p.y - r - 6, { size: 11, weight: 800, align: 'center', color: '#ffffff', spacing: 1 });
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- kick meter
  drawKickMeter(ctx, k) {
    if (!k) return;
    const x = 912, y = 170, w = 30, h = 360;
    ctx.save();
    glossBar(ctx, x - 8, y - 46, w + 16, h + 92, '#232b3c', '#06080d');
    vText(ctx, 'KICK', x + w / 2, y - 18, 16, { align: 'center', color: '#ffd23a', weight: 0.2 });
    // the tube
    ctx.fillStyle = '#05070b';
    ctx.fillRect(x, y, w, h);
    // accuracy sweet spot near the bottom
    const accY = y + h - h * k.accZone;
    ctx.fillStyle = 'rgba(80,255,140,0.35)';
    ctx.fillRect(x, accY - 9, w, 18);
    // power fill
    const p = clamp(k.power, 0, 1);
    const g = ctx.createLinearGradient(0, y + h, 0, y);
    g.addColorStop(0, '#2dd36a'); g.addColorStop(0.7, '#ffd23a'); g.addColorStop(1, '#ff3d52');
    ctx.fillStyle = g;
    ctx.fillRect(x + 3, y + h - h * p, w - 6, h * p);
    // the set power line, and the accuracy needle coming back down
    if (k.setPower !== null && k.setPower !== undefined) {
      const py = y + h - h * k.setPower;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 6, py - 1.5, w + 12, 3);
    }
    if (k.needle !== null && k.needle !== undefined) {
      const ny = y + h - h * k.needle;
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.moveTo(x - 10, ny); ctx.lineTo(x - 2, ny - 6); ctx.lineTo(x - 2, ny + 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + w + 10, ny); ctx.lineTo(x + w + 2, ny - 6); ctx.lineTo(x + w + 2, ny + 6); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(220,230,255,0.5)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text(ctx, k.label || '', x + w / 2, y + h + 26, { size: 13, weight: 800, align: 'center', color: '#cfd7e6', spacing: 1 });
    if (k.dist) text(ctx, k.dist, x + w / 2, y + h + 44, { size: 12, weight: 700, align: 'center', color: '#8c95a8', spacing: 1 });
    ctx.restore();
  }

  /** Small pre-snap panel: the call, the formation, the man you're on. */
  drawCallPanel(ctx, lines) {
    if (!lines || !lines.length) return;
    ctx.save();
    const w = 290, h = 22 + lines.length * 20;
    glossBar(ctx, 52, 52, w, h, '#232b3c', '#06080d');
    lines.forEach((l, i) => text(ctx, l.text, 66, 74 + i * 20, { size: l.size || 14, weight: l.weight || 800, color: l.color || '#e6ebf5', spacing: 1, italic: !!l.italic }));
    ctx.restore();
  }

  draw(ctx, dt, s) {
    const m = s.m;
    if (s.icons) this.drawIcons(ctx, s.icons);
    if (s.customBug) { this.bugIn = 0; s.customBug(ctx); } else if (!s.hideBug) this.drawBug(ctx, m, s);
    else this.bugIn = 0;
    this.drawCallPanel(ctx, s.callPanel);
    this.drawKickMeter(ctx, s.kick);
    this.drawCard(ctx);
    this.drawFlagCard(ctx);
    this.drawBanners(ctx);
    this.drawToasts(ctx);
    if (s.captions !== false) this.drawCaptions(ctx);
  }
}

export { glossBar, shadeHex, lum, footballIcon };
