// In-race HUD, drawn on the UI canvas (1024×768) under the CRT glass:
// tachometer + digital speed + gear + nitrous/boost, radar minimap,
// position / laps / standings, timers, countdown lights, center messages,
// wrong-way warning, rival name tags.
import * as THREE from 'three';
import { C, vText, vWidth, text, panel } from '../core/ui.js';
import { settings } from '../core/settings.js';
import { clamp, fmtTime } from '../core/util.js';

const _p = new THREE.Vector3();

function ordSuffix(n) {
  const v = n % 100;
  return ['TH', 'ST', 'ND', 'RD'][(v - 20) % 10] || ['TH', 'ST', 'ND', 'RD'][v] || 'TH';
}

export class HUD {
  constructor(session) {
    this.s = session;
    this.t = 0;
    this.buildMap();
  }

  buildMap() {
    const T = this.s.track;
    const step = Math.max(1, Math.floor(6 / T.step));
    const pts = [];
    for (let i = 0; i < T.N; i += step) pts.push([T.X[i], T.Z[i]]);
    if (T.closed) pts.push([T.X[0], T.Z[0]]);
    this.mapPts = pts;
    const path = new Path2D();
    pts.forEach(([x, z], k) => (k ? path.lineTo(x, z) : path.moveTo(x, z)));
    this.mapPath = path;
    const sp = T.posAt(T.startS);
    this.startPos = sp;
    if (!T.closed) this.finishPos = T.posAt(T.finishS);
  }

  draw(ctx, dt) {
    this.t += dt;
    const s = this.s;
    if (!s.sim) return;
    const st = s.state;
    if (st === 'intro') { this.drawIntro(ctx); return; }
    this.drawNameTags(ctx);
    this.drawMinimap(ctx, 108, 652, 82);
    this.drawTach(ctx, 908, 650, 96);
    if (s.type === 'drift') this.drawDrift(ctx); else this.drawRaceInfo(ctx);
    this.drawTimers(ctx);
    this.drawCountdown(ctx);
    this.drawMessages(ctx);
    this.drawWarnings(ctx);
  }

  // ------------------------------------------------------------------ intro
  drawIntro(ctx) {
    const s = this.s;
    const def = s.def;
    const a = clamp(s.introT / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 560, 0, 768);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 560, 1024, 208);
    vText(ctx, def.name, 64, 680, 46, { color: C.text, outline: 3, outlineColor: 'rgba(0,0,0,0.7)' });
    const kind = { circuit: `CIRCUIT · ${s.sim.laps} LAPS`, sprint: 'SPRINT', knockout: `LAP KNOCKOUT · ${s.sim.laps} LAPS`, drag: 'DRAG · 1/4 MILE', drift: `DRIFT · ${s.sim.laps} LAPS`, timeattack: 'TIME ATTACK' }[s.type] || s.type.toUpperCase();
    text(ctx, `${kind}   ·   ${settings.get('units') === 'kmh' ? (s.track.length / 1000).toFixed(2) + ' KM' : (s.track.length / 1609.34).toFixed(2) + ' MI'}   ·   ${s.sim.racers.length} RACER${s.sim.racers.length > 1 ? 'S' : ''}`, 66, 712, { size: 17, color: C.accent, weight: 700, spacing: 2 });
    text(ctx, def.blurb || '', 66, 738, { size: 15, color: C.dim });
    // story banner: event + crew, and the boss card
    const b = s.opts.banner;
    if (b) {
      panel(ctx, 40, 40, 420, 74, { accent: b.color || C.accent, accentLen: 160, alpha: 0.9 });
      text(ctx, b.sub || '', 64, 66, { size: 12, color: b.color || C.accent, weight: 900, spacing: 2 });
      vText(ctx, b.title || '', 62, 98, Math.min(26, 380 / Math.max(1, vWidth(b.title || '', 1))), { color: '#fff' });
      if (b.boss) {
        const k = clamp((s.introT - 0.5) / 0.5, 0, 1);
        ctx.save();
        ctx.globalAlpha *= k;
        ctx.translate((1 - k) * 60, 0);
        panel(ctx, 560, 150, 420, 150, { accent: b.color || C.red, accentLen: 420, alpha: 0.92 });
        vText(ctx, 'VS', 590, 230, 64, { color: b.color || C.red, outline: 3, outlineColor: '#000' });
        vText(ctx, b.boss.name, 700, 210, 40, { color: '#fff', outline: 3, outlineColor: '#000' });
        text(ctx, b.boss.car, 702, 240, { size: 14, color: C.dim, weight: 800, spacing: 1.5 });
        if (b.boss.quote) text(ctx, `"${b.boss.quote}"`, 590, 280, { size: 14, color: '#d8dee8', weight: 600, italic: true });
        ctx.restore();
      }
    }
    ctx.restore();
    if (Math.floor(this.t * 2) % 2) text(ctx, 'PRESS ✕ / ENTER TO START', 960, 738, { size: 13, color: C.dim, align: 'right', weight: 700, spacing: 2 });
  }

  // ------------------------------------------------------------------ minimap
  drawMinimap(ctx, cx, cy, R) {
    const s = this.s;
    const pv = s.player.vehicle;
    const scale = R / 220; // ~220 m radius visible
    ctx.save();
    // backing disc
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4,8,14,0.66)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(150,175,220,0.35)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    // rotate so the player's heading points up
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI + pv.heading);
    ctx.scale(-scale, scale);
    ctx.translate(-pv.x, -pv.z);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 15 / scale * 0.55;
    ctx.stroke(this.mapPath);
    ctx.strokeStyle = 'rgba(200,214,236,0.85)';
    ctx.lineWidth = 9 / scale * 0.55;
    ctx.stroke(this.mapPath);
    // start/finish
    const mark = (p, col) => {
      ctx.save();
      ctx.translate(p.x, p.z);
      ctx.rotate(-p.heading);
      ctx.fillStyle = col;
      ctx.fillRect(-14, -3, 28, 6);
      ctx.restore();
    };
    mark(this.startPos, '#ffffff');
    if (this.finishPos) mark(this.finishPos, '#4dff8b');
    // civilian traffic
    if (s.sim.traffic) {
      ctx.fillStyle = 'rgba(170,180,195,0.75)';
      for (const c of s.sim.traffic.cars) {
        ctx.beginPath();
        ctx.arc(c.x, c.z, 4 / scale * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // opponents
    for (const r of s.sim.racers) {
      if (r.isPlayer || (r.out && r.parked)) continue;
      const v = r.vehicle;
      ctx.beginPath();
      ctx.arc(v.x, v.z, 5.5 / scale * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = r.out ? '#666' : (r.pos < s.player.pos ? '#ff3d52' : '#ffb21e');
      ctx.fill();
    }
    ctx.restore();
    // player arrow (always center, up)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath();
    ctx.fillStyle = C.cyan;
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // compass tick
    text(ctx, 'N', cx + Math.sin(-pv.heading + Math.PI) * (R - 10), cy - Math.cos(-pv.heading + Math.PI) * (R - 10) + 4, { size: 11, color: C.dim, align: 'center', weight: 700 });
  }

  // ------------------------------------------------------------------ tach
  drawTach(ctx, cx, cy, R) {
    const s = this.s;
    const v = s.player.vehicle;
    const P = v.P;
    const maxRpm = Math.ceil((P.redline + 500) / 1000) * 1000;
    const a0 = Math.PI * 0.78, a1 = Math.PI * 2.2; // sweep (clockwise, canvas angles)
    const ang = (rpm) => a0 + (a1 - a0) * clamp(rpm / maxRpm, 0, 1.04);
    ctx.save();
    // face
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(28,34,48,0.88)');
    g.addColorStop(1, 'rgba(4,6,10,0.9)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(170,190,225,0.5)';
    ctx.stroke();
    // redline arc
    ctx.beginPath();
    ctx.arc(cx, cy, R - 9, ang(P.redline), ang(maxRpm));
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(255,40,50,0.85)';
    ctx.stroke();
    // ticks + numbers
    for (let r = 0; r <= maxRpm; r += 500) {
      const a = ang(r);
      const major = r % 1000 === 0;
      const r0 = R - (major ? 17 : 12), r1 = R - 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.strokeStyle = r >= P.redline ? '#ff6a6a' : '#dfe6f2';
      ctx.stroke();
      if (major) {
        const rn = R - 30;
        vText(ctx, String(r / 1000), cx + Math.cos(a) * rn, cy + Math.sin(a) * rn + 6, 13, { align: 'center', color: r >= P.redline ? '#ff8a8a' : '#e8eef8', weight: 0.16, skew: -0.12 });
      }
    }
    text(ctx, 'x1000 RPM', cx, cy - R * 0.3, { size: 9, color: C.dim, align: 'center', weight: 700, spacing: 1 });
    // nitrous arc (inner left)
    const nA0 = Math.PI * 0.62, nA1 = Math.PI * 0.18;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 13, nA0, nA1, true);
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    if (v.nitro > 0.001) {
      ctx.beginPath();
      ctx.arc(cx, cy, R + 13, nA0, nA0 - (nA0 - nA1) * v.nitro, true);
      ctx.strokeStyle = v.nitroOn ? '#9ae8ff' : '#2f8dff';
      ctx.shadowColor = '#46a8ff';
      ctx.shadowBlur = v.nitroOn ? 14 : 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    text(ctx, 'N₂O', cx - R * 0.36, cy + R + 22, { size: 11, color: '#7fc4ff', weight: 800, align: 'center' });
    // gear
    const gear = v.shiftT > 0 ? (v.pendingGear || v.gear) : v.gear;
    const gtxt = gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear);
    const manual = settings.get('transmission') === 'manual' || s.type === 'drag';
    const hot = v.rpm > P.redline * 0.93;
    // shift-light LED bar over the dial (stick shift)
    if (manual) {
      const f = v.rpm / P.redline;
      const cols = ['#3dff7a', '#3dff7a', '#ffd23a', '#ffd23a', '#ff3a3a'];
      const flash = f > 0.955 && Math.floor(this.t * 14) % 2;
      for (let k = 0; k < 5; k++) {
        const on = f > 0.72 + k * 0.055;
        const lx = cx - 44 + k * 22, ly = cy - R - 30;
        ctx.beginPath();
        ctx.arc(lx, ly, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = on && !flash ? cols[k] : 'rgba(255,255,255,0.1)';
        if (on && !flash) { ctx.shadowColor = cols[k]; ctx.shadowBlur = 12; }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    // gear: boxed digit right of center
    const gx = cx + R * 0.36, gy = cy + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(gx - 15, gy - 26, 30, 32);
    ctx.strokeStyle = hot && manual ? '#ff4a4a' : 'rgba(255,178,30,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx - 15, gy - 26, 30, 32);
    vText(ctx, gtxt, gx, gy, 24, { align: 'center', color: hot && manual ? '#ff4a4a' : C.accent, weight: 0.2, glow: hot && manual ? 10 : 0, glowColor: '#ff3030', skew: 0 });
    // digital speed (bottom of the dial)
    const kmh = settings.get('units') === 'kmh';
    const spd = Math.round(v.speed * (kmh ? 3.6 : 2.23694));
    vText(ctx, String(spd), cx, cy + R * 0.56, 30, { align: 'center', color: '#ffffff', weight: 0.18, outline: 2, outlineColor: 'rgba(0,0,0,0.6)' });
    text(ctx, kmh ? 'KM/H' : 'MPH', cx, cy + R * 0.56 + 15, { size: 10, color: C.dim, align: 'center', weight: 800, spacing: 1 });
    // needle
    const na = ang(v.rpm);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(na);
    ctx.beginPath();
    ctx.moveTo(-10, -2.5); ctx.lineTo(R - 10, -1); ctx.lineTo(R - 10, 1); ctx.lineTo(-10, 2.5); ctx.closePath();
    ctx.fillStyle = '#ff7a1a';
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#20242c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // boost mini gauge (turbo cars)
    if (P.turbo > 0) this.drawBoost(ctx, cx - R * 0.92, cy + R * 0.62, 26, v.boost * (v.throttle > 0.1 ? 1 : 0.2));
    // shift light
    if (hot && manual) {
      const on = Math.floor(this.t * 12) % 2 === 0;
      if (on) text(ctx, 'SHIFT', cx, cy - R - 12, { size: 14, color: '#ff4040', weight: 900, align: 'center', glow: 10 });
    }
  }

  drawBoost(ctx, cx, cy, r, b) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,8,12,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,190,225,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (a1 - a0) * k / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.strokeStyle = '#cfd6e4';
      ctx.stroke();
    }
    const a = a0 + (a1 - a0) * clamp(b, 0, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, 'BOOST', cx, cy + r * 0.62, { size: 7, color: C.dim, align: 'center', weight: 800 });
    ctx.restore();
  }

  // ------------------------------------------------------------------ race info
  drawRaceInfo(ctx) {
    const s = this.s;
    const sim = s.sim;
    const P = s.player;
    const n = sim.racers.length;
    const x = 1000;
    panel(ctx, 742, 18, 268, 64 + Math.min(n, 8) * 21 + (sim.laps > 1 ? 18 : 0), { accent: C.accent, accentLen: 120 });
    // position
    if (n > 1 && sim.type !== 'timeattack') {
      const pos = P.out ? '-' : String(P.pos);
      const w1 = vWidth(pos, 50);
      const w2 = vWidth(ordSuffix(P.pos), 20);
      const w3 = vWidth(`/${n}`, 28);
      const x0 = x - 20 - (w1 + w2 + w3 + 8);
      vText(ctx, pos, x0, 82, 50, { color: '#fff', outline: 3, outlineColor: '#000' });
      vText(ctx, ordSuffix(P.pos), x0 + w1 + 4, 60, 20, { color: C.accent });
      vText(ctx, `/${n}`, x0 + w1 + w2 + 10, 82, 28, { color: C.dim });
    }
    let y = 104;
    if (sim.laps > 1 || sim.T.closed) {
      const lap = Math.min(sim.laps, Math.max(1, P.lap + 1));
      text(ctx, 'LAP', 772, y, { size: 13, color: C.dim, weight: 800, spacing: 2 });
      vText(ctx, `${lap}/${sim.laps}`, 1000 - 22, y + 2, 17, { align: 'right', color: '#fff' });
      y += 22;
    } else {
      const target = sim.T.finishS - sim.T.startS;
      const k = clamp(P.total / target, 0, 1);
      text(ctx, 'DIST', 772, y, { size: 13, color: C.dim, weight: 800, spacing: 2 });
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(820, y - 9, 160, 7);
      ctx.fillStyle = C.accent;
      ctx.fillRect(820, y - 9, 160 * k, 7);
      y += 22;
    }
    // standings
    const order = sim.order || sim.racers;
    for (let k = 0; k < Math.min(order.length, 8); k++) {
      const r = order[k];
      const me = r === P;
      const col = r.out ? '#6a6f7a' : me ? C.cyan : '#e6ebf3';
      text(ctx, `${k + 1}`, 772, y, { size: 14, color: col, weight: 800 });
      text(ctx, (r.out ? '✕ ' : '') + r.name.toUpperCase().slice(0, 14), 794, y, { size: 14, color: col, weight: me ? 900 : 600 });
      if (!me && !r.out && sim.state !== 'grid') {
        const gap = r.total - P.total;
        const sec = gap / Math.max(8, P.vehicle.speed);
        text(ctx, `${gap > 0 ? '+' : '-'}${Math.abs(sec).toFixed(1)}`, 1000 - 22, y, { size: 12, color: gap > 0 ? '#ff8a8a' : '#8affb0', align: 'right', weight: 700 });
      }
      y += 21;
    }
  }

  /** Drift: posted scores to beat (right) and the live slide meter (center). */
  drawDrift(ctx) {
    const s = this.s;
    const sim = s.sim;
    const P = s.player;
    const D = P.dr || { cur: 0, mult: 1, t: 0, total: 0 };
    const rows = sim.driftRivals.map((r) => ({ name: r.name, score: r.score, me: false }));
    rows.push({ name: 'YOU', score: D.total, me: true });
    rows.sort((a, b) => b.score - a.score);
    panel(ctx, 742, 18, 268, 60 + rows.length * 22 + 18, { accent: C.accent, accentLen: 120 });
    text(ctx, 'DRIFT', 772, 46, { size: 13, color: C.dim, weight: 800, spacing: 3 });
    vText(ctx, D.total.toLocaleString(), 1000 - 22, 72, 30, { align: 'right', color: '#fff', outline: 2, outlineColor: '#000' });
    const lap = Math.min(sim.laps, Math.max(1, P.lap + 1));
    text(ctx, `LAP ${lap}/${sim.laps}`, 772, 72, { size: 12, color: C.dim, weight: 800 });
    rows.forEach((r, k) => {
      const y = 100 + k * 22;
      const col = r.me ? C.cyan : '#e6ebf3';
      text(ctx, `${k + 1}`, 772, y, { size: 14, color: col, weight: 800 });
      text(ctx, r.name, 794, y, { size: 14, color: col, weight: r.me ? 900 : 600 });
      text(ctx, r.score.toLocaleString(), 1000 - 22, y, { size: 13, color: col, weight: 700, align: 'right' });
    });
    // live slide
    if (D.cur > 0) {
      const pts = Math.round(D.cur);
      const pulse = 1 + Math.sin(this.t * 14) * 0.03;
      vText(ctx, pts.toLocaleString(), 512, 178, 40 * pulse, { align: 'center', color: '#fff', outline: 4, outlineColor: 'rgba(0,0,0,0.8)' });
      vText(ctx, `X${D.mult}`, 512 + vWidth(pts.toLocaleString(), 40) / 2 + 40, 172, 30, { align: 'center', color: D.mult >= 4 ? '#ff3d6e' : D.mult >= 3 ? C.accent : C.cyan, outline: 3, outlineColor: '#000' });
      // progress to the next multiplier
      const k = D.mult >= 5 ? 1 : (D.t % 1.6) / 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(432, 190, 160, 6);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(432, 190, 160 * k, 6);
    }
  }

  drawTimers(ctx) {
    const s = this.s;
    const sim = s.sim;
    const P = s.player;
    const raceT = sim.state === 'grid' || sim.state === 'countdown' ? 0 : sim.raceTime;
    const lapT = P.finished ? (P.lastLap ?? raceT) : raceT - P.lapStart;
    const tgt = s.target;
    panel(ctx, 20, 18, 236, (sim.T.closed ? 86 : 60) + (tgt ? 30 : 0), { accent: C.cyan, accentLen: 90 });
    text(ctx, sim.T.closed ? 'LAP TIME' : 'TIME', 44, 42, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, fmtTime(sim.T.closed ? lapT : raceT), 44, 70, 24, { color: '#fff' });
    let y = 93;
    if (sim.T.closed) {
      text(ctx, 'BEST', 44, y, { size: 12, color: C.dim, weight: 800, spacing: 2 });
      text(ctx, P.bestLap ? fmtTime(P.bestLap) : '-:--.--', 92, y, { size: 14, color: P.bestLap && tgt && P.bestLap <= tgt ? C.green : C.accent, weight: 800 });
      text(ctx, 'TOTAL ' + fmtTime(raceT), 236, y, { size: 11, color: C.dim, weight: 700, align: 'right' });
      y += 24;
    } else y = 93;
    if (tgt) {
      text(ctx, 'TARGET', 44, y, { size: 12, color: C.dim, weight: 800, spacing: 2 });
      text(ctx, fmtTime(tgt), 112, y, { size: 14, color: '#fff', weight: 800 });
      const d = s.ghostDelta;
      if (d !== null && d !== undefined && sim.state === 'racing') {
        text(ctx, `${d > 0 ? '+' : '-'}${Math.abs(d).toFixed(2)}`, 236, y, { size: 15, color: d > 0 ? '#ff8a8a' : '#8affb0', weight: 900, align: 'right' });
      }
    }
  }

  drawCountdown(ctx) {
    const s = this.s;
    const sim = s.sim;
    if (sim.state === 'countdown') {
      const n = Math.ceil(sim.countdown);
      const f = sim.countdown - Math.floor(sim.countdown);
      const sc = 1 + (f) * 0.5;
      vText(ctx, String(n), 512, 330 + 30 * sc, 90 * sc, { align: 'center', color: C.accent, outline: 5, outlineColor: 'rgba(0,0,0,0.8)', alpha: clamp(f * 2, 0, 1) });
      // start lights
      for (let k = 0; k < 3; k++) {
        const lit = k < 4 - n;
        this.lamp(ctx, 512 + (k - 1) * 46, 210, lit ? '#ff2a1a' : '#2a0a0a', lit);
      }
      if (n <= 3) text(ctx, settings.get('transmission') === 'manual' ? 'REV IT UP — HOLD THE REVS IN THE GREEN FOR A PERFECT START' : 'HOLD THE GAS FOR A LAUNCH — WATCH THE REVS', 512, 268, { size: 13, color: C.dim, align: 'center', weight: 700, spacing: 1 });
    }
    // GO flash
    const go = s.hudEvents.find((e) => e.type === 'go');
    if (go) {
      const t = s.time - go.t;
      if (t < 1.1) {
        const sc = 1 + t * 0.6;
        vText(ctx, 'GO!', 512, 380 + 20 * sc, 96 * sc, { align: 'center', color: '#4dff8b', outline: 5, outlineColor: 'rgba(0,0,0,0.8)', alpha: clamp(1.4 - t * 1.3, 0, 1), glow: 20, glowColor: '#2aff6a' });
        for (let k = 0; k < 3; k++) this.lamp(ctx, 512 + (k - 1) * 46, 210, '#2aff6a', true, clamp(1.2 - t, 0, 1));
      }
    }
  }

  lamp(ctx, x, y, color, lit, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,12,0.9)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 22; }
    ctx.fill();
    ctx.restore();
  }

  drawMessages(ctx) {
    for (const m of this.s.messages) {
      const a = clamp(Math.min(m.t / 0.15, (m.dur - m.t) / 0.4), 0, 1);
      const y = m.slot === 'top' ? 150 : 250;
      const size = m.big ? 54 : m.slot === 'top' ? 26 : 36;
      const pop = 1 + Math.max(0, 0.25 - m.t) * 1.2;
      vText(ctx, m.text, 512, y, size * pop, { align: 'center', color: m.color || '#fff', outline: 4, outlineColor: 'rgba(0,0,0,0.75)', alpha: a });
      if (m.sub) text(ctx, m.sub, 512, y + 30, { size: 18, color: m.color || C.accent, align: 'center', weight: 800, spacing: 2, alpha: a });
    }
  }

  drawWarnings(ctx) {
    const s = this.s;
    const P = s.player;
    if (s.wrongWay && Math.floor(this.t * 3) % 2 === 0) {
      vText(ctx, 'WRONG WAY', 512, 330, 52, { align: 'center', color: '#ff2a3a', outline: 4, outlineColor: '#000', glow: 16, glowColor: '#ff0000' });
      text(ctx, 'TURN AROUND  ·  ' + (s.player && 'PRESS R / CREATE TO RESET'), 512, 360, { size: 14, color: '#ffb0b0', align: 'center', weight: 800 });
    }
    if (P.draft > 0.35 && P.vehicle.speed > 22 && s.sim.state === 'racing') {
      text(ctx, 'DRAFTING', 512, 112, { size: 15, color: C.cyan, align: 'center', weight: 900, spacing: 4, glow: 8, alpha: 0.6 + 0.4 * Math.sin(this.t * 8) });
    }
    const v = P.vehicle;
    if (v.nitro < 0.02 && v.nitroOn === false && s.inputNitro) {
      text(ctx, 'NITROUS EMPTY', 908, 520, { size: 12, color: '#ff8a8a', align: 'center', weight: 800 });
    }
  }

  /** Rival name tags: small arrow + name above cars ahead within range. */
  drawNameTags(ctx) {
    const s = this.s;
    const cam = s.camera.cam;
    const P = s.player;
    for (const r of s.sim.racers) {
      if (r.isPlayer || r.out) continue;
      const v = r.vehicle;
      const d = Math.hypot(v.x - P.vehicle.x, v.z - P.vehicle.z);
      if (d > 110 || d < 6) continue;
      _p.set(v.x, v.y + 1.9, v.z).project(cam);
      if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) continue;
      const sx = (_p.x * 0.5 + 0.5) * 1024, sy = (1 - (_p.y * 0.5 + 0.5)) * 768;
      const a = clamp(1 - (d - 60) / 50, 0, 1) * 0.9;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy - 8); ctx.lineTo(sx + 6, sy - 8); ctx.lineTo(sx, sy);
      ctx.fillStyle = r.pos < P.pos ? '#ff3d52' : '#ffb21e';
      ctx.fill();
      text(ctx, `${r.pos}. ${r.name.toUpperCase()}`, sx, sy - 13, { size: 12, color: '#fff', align: 'center', weight: 800 });
      ctx.restore();
    }
  }
}
