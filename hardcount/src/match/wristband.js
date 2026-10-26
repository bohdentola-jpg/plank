// Calling plays off the wristband: the laminated card a quarterback wears on
// his forearm, held up to the camera between downs. Tabs across the top
// (formations on offense, families on defense), six plays to a page, each
// with its number and its diagram. Two people at once get a card each,
// side by side.
//
//   const wb = new Wristband({ m, side, kind, player: input.p1, area });
//   wb.update(dt) → null | { id, flip } once the call is made
//   wb.draw(ctx)
import { OFFENSE } from '../sim/plays/offense.js';
import { DEFENSE } from '../sim/plays/defense.js';
import { FORMATIONS } from '../sim/plays/formations.js';
import { KICKOFF_PLAYS, RETURN_PLAYS, PUNT_PLAYS, PUNT_RETURN_PLAYS, FG_PLAYS, FG_DEFENSE_PLAYS } from '../sim/plays/special.js';
import { offenseCall, defenseCall, cpuCalls, fgRange } from '../sim/ai/playcall.js';
import { drawPlayArt, drawDefArt, drawSpecialArt } from './playart.js';
import { vText, vWidth, text, padGlyph, usingPad, keyCap, roundRect } from '../core/ui.js';
import { drawLogo } from '../gfx/logos.js';
import { clamp, easeOutBack } from '../core/util.js';
import { uiSound } from '../core/menu.js';
import { downText, quarterText, fmtClock } from './hud.js';

const FORM_ORDER = ['gun_spread', 'gun_trips', 'gun_bunch', 'gun_empty', 'gun_twins', 'pistol', 'i_form', 'ace_twins', 'flexbone', 'wishbone', 'wildcat', 'goal_line'];
const PLAY_NO = new Map(OFFENSE.map((p, i) => [p.id, 10 + i]));
const DEF_NO = new Map(DEFENSE.map((p, i) => [p.id, 70 + i]));

const DEF_GROUPS = [
  { name: 'ZONE', ids: ['c3', 'c2', 'tampa', 'c4', 'dime_c3', 'prevent'] },
  { name: 'MAN', ids: ['c1', 'c1press', 'spy', 'c0', 'cblitz', 'sblitz'] },
  { name: 'PRESSURE', ids: ['firezone', 'mike', 'c0', 'cblitz', 'sblitz', 'bear'] },
  { name: 'SHORT YARDAGE', ids: ['bear', 'goal', 'c1press', 'c0', 'spy', 'c3'] },
];

/**
 * The quarterback's forearm, held up under the card: a tapered, rounded limb
 * with a little skin sheen and the jersey sleeve at the bottom.
 * (x, y) is the top-left of the area the band sits on, w its width.
 */
export function drawForearm(ctx, x, y, w, h, opts = {}) {
  const skin = opts.skin || '#8d5a3a';
  const sleeve = opts.sleeve || '#1d3f94';
  const trim = opts.trim || '#ffffff';
  const cx = x + w / 2;
  const top = y - 10, bot = y + h + 260;
  const wTop = w * 0.62, wBot = w * 0.86;
  ctx.save();
  // the limb
  ctx.beginPath();
  ctx.moveTo(cx - wTop / 2, top);
  ctx.bezierCurveTo(cx - wTop / 2 - w * 0.04, top + h * 0.5, cx - wBot / 2, bot - 120, cx - wBot / 2 - w * 0.02, bot);
  ctx.lineTo(cx + wBot / 2 + w * 0.02, bot);
  ctx.bezierCurveTo(cx + wBot / 2, bot - 120, cx + wTop / 2 + w * 0.04, top + h * 0.5, cx + wTop / 2, top);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - wBot / 2, 0, cx + wBot / 2, 0);
  g.addColorStop(0, shadeSkin(skin, -0.55));
  g.addColorStop(0.18, shadeSkin(skin, -0.2));
  g.addColorStop(0.42, skin);
  g.addColorStop(0.55, shadeSkin(skin, 0.12));
  g.addColorStop(0.8, shadeSkin(skin, -0.25));
  g.addColorStop(1, shadeSkin(skin, -0.6));
  ctx.fillStyle = g;
  ctx.fill();
  // a soft highlight down the muscle
  const hl = ctx.createLinearGradient(cx - w * 0.1, 0, cx + w * 0.12, 0);
  hl.addColorStop(0, 'rgba(255,230,200,0)'); hl.addColorStop(0.5, 'rgba(255,230,200,0.12)'); hl.addColorStop(1, 'rgba(255,230,200,0)');
  ctx.fillStyle = hl;
  ctx.fill();
  // the sleeve (team colour, a trim band)
  const sy = y + h + 120;
  ctx.beginPath();
  ctx.moveTo(cx - wBot / 2 - 18, sy + 14); ctx.quadraticCurveTo(cx, sy - 16, cx + wBot / 2 + 18, sy + 14);
  ctx.lineTo(cx + wBot / 2 + 40, bot + 40); ctx.lineTo(cx - wBot / 2 - 40, bot + 40); ctx.closePath();
  const sg = ctx.createLinearGradient(cx - wBot / 2, 0, cx + wBot / 2, 0);
  sg.addColorStop(0, shadeSkin(sleeve, -0.6)); sg.addColorStop(0.45, sleeve); sg.addColorStop(1, shadeSkin(sleeve, -0.6));
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(cx - wBot / 2 - 14, sy + 26); ctx.quadraticCurveTo(cx, sy - 2, cx + wBot / 2 + 14, sy + 26); ctx.stroke();
  ctx.restore();
}

function shadeSkin(hex, f) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Per-player stick / d-pad / key navigation with auto-repeat. */
class PadNav {
  constructor(pl) { this.pl = pl; this.r = {}; this.edges = new Set(); }
  update(dt) {
    const pl = this.pl, e = this.edges;
    e.clear();
    const kx = pl.index === 0 ? pl.rx : 0, ky = pl.index === 0 ? pl.ry : 0;
    const x = Math.abs(pl.lx) > 0.5 ? pl.lx : kx, y = Math.abs(pl.ly) > 0.5 ? pl.ly : ky;
    const dirs = { up: y < -0.5, down: y > 0.5, left: x < -0.5, right: x > 0.5 };
    for (const [d, held] of Object.entries(dirs)) {
      const r = this.r[d] || (this.r[d] = { t: 0, held: false });
      if (held && !r.held) { r.held = true; r.t = 0.36; e.add(d); } else if (held) { r.t -= dt; if (r.t <= 0) { r.t = 0.09; e.add(d); } } else r.held = false;
    }
  }
  has(d) { return this.edges.has(d); }
}

function special(list, ids) { return ids.map((id) => list.find((p) => p.id === id)).filter(Boolean); }

/** The pages for a kind of call. */
export function wristbandTabs(m, side, kind, offCall = null) {
  if (kind === 'kickoff') return [{ name: 'KICKOFF', plays: KICKOFF_PLAYS, special: true }];
  if (kind === 'return') return [{ name: 'KICK RETURN', plays: RETURN_PLAYS, special: true }];
  if (kind === 'pat') return [{ name: 'AFTER THE TOUCHDOWN', plays: [{ id: 'kick', name: 'EXTRA POINT', kind: 'fg', pat: true }, { id: 'two', name: 'GO FOR TWO', kind: 'two', pat: true }], special: true }];
  if (kind === 'specialDef') {
    if (offCall?.startsWith('fg_')) return [{ name: 'FIELD GOAL DEFENSE', plays: FG_DEFENSE_PLAYS, special: true }];
    return [{ name: 'PUNT RETURN', plays: PUNT_RETURN_PLAYS, special: true }];
  }
  if (kind === 'defense') {
    return DEF_GROUPS.map((g) => ({ name: g.name, plays: g.ids.map((id) => DEFENSE.find((d) => d.id === id)).filter(Boolean), def: true }));
  }
  // offense
  const two = kind === 'two';
  const tabs = [];
  for (const f of FORM_ORDER) {
    const plays = OFFENSE.filter((p) => p.form === f && p.kind !== 'kneel' && p.kind !== 'spike');
    if (plays.length) tabs.push({ name: FORMATIONS[f]?.name || f.toUpperCase(), plays });
  }
  if (!two) {
    const fgOk = m.field.toGoal(m.los, m.dirOf(side)) + m.field.EZ + 7 <= fgRange(m, side) + 8;
    tabs.push({ name: 'SPECIAL TEAMS', plays: [...special(PUNT_PLAYS, ['pt_normal', 'pt_coffin', 'pt_fakepass', 'pt_fakerun']), ...(fgOk || m.down === 4 ? special(FG_PLAYS, ['fg_kick', 'fg_fakepass']) : [])], special: true });
    tabs.push({ name: 'CLOCK', plays: OFFENSE.filter((p) => p.kind === 'kneel' || p.kind === 'spike') });
  }
  return tabs;
}

export class Wristband {
  constructor({ m, side, kind, player, area, offCall = null, label = null }) {
    this.m = m;
    this.side = side;
    this.kind = kind;
    this.pl = player;
    this.nav = new PadNav(player);
    this.area = area || { x: 132, y: 112, w: 760, h: 476 };
    this.tabs = wristbandTabs(m, side, kind, offCall);
    this.tab = 0;
    this.sel = 0;
    this.page = 0;
    this.flip = false;
    this.t = 0;
    this.done = null;
    this.label = label;
    this.coach = null;
    this.offCall = offCall;
    // open on a sensible page: the coach's idea of the situation
    this.suggest(false);
  }

  get plays() { return this.tabs[this.tab]?.plays || []; }
  get pages() { return Math.max(1, Math.ceil(this.plays.length / 6)); }

  /** Coach's pick: jump to what the CPU would call here. */
  suggest(apply = true) {
    const m = this.m;
    let id = null;
    try {
      if (this.kind === 'offense' || this.kind === 'two') id = offenseCall(m);
      else if (this.kind === 'defense') id = defenseCall(m);
      else if (this.kind === 'kickoff' || this.kind === 'return' || this.kind === 'pat') {
        const c = cpuCalls(m);
        id = this.kind === 'kickoff' ? c.off : this.kind === 'return' ? c.def : c.pat;
      }
    } catch { id = null; }
    if (!id) return;
    this.coach = id;
    for (let t = 0; t < this.tabs.length; t++) {
      const i = this.tabs[t].plays.findIndex((p) => p.id === id);
      if (i >= 0) {
        this.tab = t; this.page = Math.floor(i / 6); this.sel = i % 6;
        if (apply) uiSound('move');
        return;
      }
    }
  }

  update(dt) {
    this.t += dt;
    if (this.done) return this.done;
    const pl = this.pl, nav = this.nav;
    nav.update(dt);
    const n = this.plays.length;
    const onPage = Math.min(6, n - this.page * 6);
    const col = this.sel % 3, row = Math.floor(this.sel / 3);
    if (pl.pressed('r1')) { this.tab = (this.tab + 1) % this.tabs.length; this.sel = 0; this.page = 0; uiSound('tab'); }
    if (pl.pressed('l1')) { this.tab = (this.tab - 1 + this.tabs.length) % this.tabs.length; this.sel = 0; this.page = 0; uiSound('tab'); }
    if (nav.has('right')) {
      if (col < 2 && this.sel + 1 < onPage) this.sel++;
      else if (this.page + 1 < this.pages) { this.page++; this.sel = row * 3; if (this.sel >= Math.min(6, n - this.page * 6)) this.sel = 0; }
      else { this.tab = (this.tab + 1) % this.tabs.length; this.page = 0; this.sel = 0; }
      uiSound('move');
    }
    if (nav.has('left')) {
      if (col > 0) this.sel--;
      else if (this.page > 0) { this.page--; this.sel = row * 3 + 2; }
      else { this.tab = (this.tab - 1 + this.tabs.length) % this.tabs.length; this.page = this.pages - 1; this.sel = Math.max(0, Math.min(5, this.plays.length - this.page * 6 - 1)); }
      uiSound('move');
    }
    if (nav.has('down') && this.sel + 3 < Math.min(6, n - this.page * 6)) { this.sel += 3; uiSound('move'); }
    if (nav.has('up') && this.sel >= 3) { this.sel -= 3; uiSound('move'); }
    const curN = Math.min(6, this.plays.length - this.page * 6);
    if (this.sel >= curN) this.sel = Math.max(0, curN - 1);
    if (pl.pressed('triangle') && !this.tabs[this.tab].special) { this.flip = !this.flip; uiSound('tab'); }
    if (pl.pressed('square')) this.suggest(true);
    if (pl.pressed('cross')) {
      const p = this.plays[this.page * 6 + this.sel];
      if (p) {
        uiSound('select');
        this.done = { id: p.id, flip: this.flip, play: p };
        this.doneT = 0;
        return this.done;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- drawing
  draw(ctx) {
    const { x, y, w, h } = this.area;
    const m = this.m;
    const k = easeOutBack(clamp(this.t / 0.42, 0, 1));
    const oy = (1 - k) * 520;
    const small = w < 600;
    ctx.save();
    ctx.translate(0, oy);
    // the forearm under the band, the jersey sleeve below
    const team = m.teams[this.side];
    const qbLook = m.rosters?.[this.side]?.depth?.QB?.[0]?.look;
    const kit = team.uniform?.home || {};
    drawForearm(ctx, x, y, w, h, { skin: qbLook?.skinHex || '#8d5a3a', sleeve: kit.jersey || team.colors.primary, trim: kit.numbers || team.colors.secondary });
    // the elastic band
    const bx = x - 18, by = y - 26, bw = w + 36, bh = h + 52;
    ctx.save();
    roundRect(ctx, bx, by, bw, bh, 26);
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, '#1b1d22'); bg.addColorStop(0.5, '#0c0d10'); bg.addColorStop(1, '#1a1c21');
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // ribbing on the band
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 2;
    for (let i = 0; i < bw; i += 7) { ctx.beginPath(); ctx.moveTo(bx + i, by + 6); ctx.lineTo(bx + i, by + 18); ctx.moveTo(bx + i, by + bh - 18); ctx.lineTo(bx + i, by + bh - 6); ctx.stroke(); }
    // stitching
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, bx + 7, by + 7, bw - 14, bh - 14, 20);
    ctx.stroke();
    ctx.setLineDash([]);
    // the team mark stitched on the band
    try { drawLogo(ctx, team, bx + bw - 26, by + 22, 26, { flat: true }); } catch { /* */ }
    ctx.restore();

    // the card under clear vinyl
    const cx = x, cy = y, cw = w, ch = h;
    ctx.save();
    ctx.fillStyle = '#efe9d8';
    ctx.fillRect(cx, cy, cw, ch);
    // paper grain
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 2 ? '#000' : '#fff'; ctx.fillRect(cx + ((i * 97) % cw), cy, 1, ch); }
    ctx.globalAlpha = 1;
    // header bar: the situation, the tabs
    const hdrH = small ? 46 : 52;
    ctx.fillStyle = '#16181d';
    ctx.fillRect(cx, cy, cw, hdrH);
    const title = this.label || (this.kind === 'defense' ? 'DEFENSE' : this.kind === 'specialDef' ? 'SPECIAL TEAMS' : this.kind === 'kickoff' ? 'KICKOFF' : this.kind === 'return' ? 'RECEIVE' : this.kind === 'pat' ? 'THE TRY' : 'OFFENSE');
    vText(ctx, title, cx + 12, cy + (small ? 20 : 22), small ? 13 : 15, { color: team.colors.secondary === '#ffffff' ? '#ffd23a' : '#ffd23a', weight: 0.2 });
    const sit = m.tryMode ? downText(m) : this.kind === 'kickoff' || this.kind === 'return' ? 'KICKOFF' : `${downText(m)}  ·  ${m.field.spotText(m.los, m.offDir)}`;
    text(ctx, `${sit}  ·  ${quarterText(m)} ${fmtClock(m.clock)}`, cx + cw - 12, cy + (small ? 18 : 20), { size: small ? 11 : 13, weight: 800, color: '#cfd5df', align: 'right', spacing: 1, shadow: false });
    // tab strip
    const tab = this.tabs[this.tab];
    const ty = cy + hdrH - 10;
    if (this.tabs.length > 1) {
      if (usingPad()) { padGlyph(ctx, 'L1', cx + 22, ty - 4, 9); padGlyph(ctx, 'R1', cx + cw - 22, ty - 4, 9); } else { keyCap(ctx, 'Q', cx + 20, ty - 4, 16); keyCap(ctx, 'E', cx + cw - 20, ty - 4, 16); }
    }
    vText(ctx, tab?.name || '', cx + cw / 2, ty, small ? 15 : 18, { align: 'center', color: '#ffffff', weight: 0.2 });
    if (this.tabs.length > 1) {
      // little dots for where we are among the tabs
      const dw = Math.min(10, (cw - 200) / this.tabs.length);
      for (let i = 0; i < this.tabs.length; i++) {
        ctx.fillStyle = i === this.tab ? '#ffd23a' : 'rgba(255,255,255,0.22)';
        ctx.fillRect(cx + cw / 2 - this.tabs.length * dw / 2 + i * dw + 1, ty + 4, dw - 2, 2);
      }
    }
    // the six cells
    const gx = cx + 8, gy = cy + hdrH + 6, gw = cw - 16, gh = ch - hdrH - (small ? 38 : 44);
    const cellW = gw / 3, cellH = gh / 2;
    const plays = this.plays;
    for (let i = 0; i < 6; i++) {
      const p = plays[this.page * 6 + i];
      const col = i % 3, row = Math.floor(i / 3);
      const x0 = gx + col * cellW, y0 = gy + row * cellH;
      ctx.strokeStyle = 'rgba(30,30,30,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, cellW - 1, cellH - 1);
      if (!p) continue;
      const selected = i === this.sel;
      if (selected) {
        // highlighter
        const pulse = 0.55 + Math.sin(this.t * 6) * 0.12;
        ctx.fillStyle = `rgba(255,228,60,${pulse})`;
        ctx.fillRect(x0 + 2, y0 + 2, cellW - 4, cellH - 4);
      }
      // number badge
      const no = this.tabs[this.tab].def ? DEF_NO.get(p.id) : PLAY_NO.get(p.id);
      const pid = p.id;
      if (no !== undefined) {
        ctx.fillStyle = '#16181d';
        ctx.fillRect(x0 + 5, y0 + 5, small ? 22 : 26, small ? 16 : 18);
        text(ctx, String(no), x0 + 5 + (small ? 11 : 13), y0 + (small ? 18 : 19), { size: small ? 11 : 13, weight: 900, color: '#ffffff', align: 'center', shadow: false });
      }
      text(ctx, p.name, x0 + (no !== undefined ? (small ? 32 : 38) : 8), y0 + (small ? 18 : 19), { size: small ? 11 : 13.5, weight: 900, color: '#111', shadow: false, spacing: 0.5 });
      if (this.coach === pid) text(ctx, 'COACH', x0 + cellW - 8, y0 + (small ? 18 : 19), { size: small ? 8 : 9, weight: 900, color: '#b4121f', align: 'right', shadow: false, spacing: 1 });
      // the diagram
      const dx = x0 + 6, dy = y0 + (small ? 22 : 26), dw = cellW - 12, dh = cellH - (small ? 26 : 30);
      try {
        if (this.tabs[this.tab].def) drawDefArt(ctx, p, dx, dy, dw, dh, { paper: selected ? '#fff3a8' : '#efe9d8' });
        else if (this.tabs[this.tab].special || p.pat) drawSpecialArt(ctx, p.pat ? (p.id === 'kick' ? { kind: 'fg', id: 'pat' } : OFFENSE.find((q) => q.id === 'gl_sneak') || { kind: 'fg', id: 'two' }) : p, dx, dy, dw, dh, { paper: selected ? '#fff3a8' : '#efe9d8' });
        else drawPlayArt(ctx, p, dx, dy, dw, dh, { flip: this.flip, paper: selected ? '#fff3a8' : '#efe9d8' });
      } catch (e) { /* a bad diagram never breaks the call */ }
      if (selected) {
        // a red pen circle around the number
        ctx.strokeStyle = '#c4101f';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(x0 + (small ? 16 : 18), y0 + (small ? 13 : 14), small ? 17 : 20, small ? 12 : 14, -0.15, 0.2, Math.PI * 2.05);
        ctx.stroke();
      }
    }
    // page marker + footer hints
    const fy = cy + ch - (small ? 12 : 14);
    if (this.pages > 1) text(ctx, `PAGE ${this.page + 1}/${this.pages}`, cx + cw - 12, fy, { size: 11, weight: 900, color: '#333', align: 'right', shadow: false, spacing: 1 });
    const hintsList = [['cross', 'CALL'], ...(this.tabs[this.tab].special ? [] : [['triangle', this.flip ? 'FLIPPED' : 'FLIP']]), ['square', "COACH'S PICK"]];
    let hx = cx + 14;
    for (const [btn, lbl] of hintsList) {
      if (usingPad()) padGlyph(ctx, btn, hx + 8, fy - 4, small ? 7 : 8);
      else keyCap(ctx, { cross: 'K', triangle: 'I', square: 'J' }[btn], hx + 8, fy - 4, small ? 13 : 15);
      text(ctx, lbl, hx + 20, fy, { size: small ? 10 : 12, weight: 900, color: lbl === 'FLIPPED' ? '#b4121f' : '#222', shadow: false, spacing: 1 });
      hx += 34 + vWidth(lbl, small ? 9 : 11) * 1.05;
    }
    // vinyl sheen
    const g = ctx.createLinearGradient(cx, cy, cx + cw * 0.6, cy + ch);
    g.addColorStop(0, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.04)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 1, cy - 1, cw + 2, ch + 2);
    // the call is in: a stamp
    if (this.done) {
      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.rotate(-0.12);
      const s = 1 + Math.max(0, 0.3 - (this.t - (this.doneAt ?? this.t)) * 2);
      ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(190,20,30,0.85)'; ctx.lineWidth = 4;
      ctx.strokeRect(-120, -32, 240, 64);
      vText(ctx, 'CALLED', 0, 16, 40, { align: 'center', color: 'rgba(190,20,30,0.9)', weight: 0.2, skew: 0 });
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }
}

export { PLAY_NO, DEF_NO };
