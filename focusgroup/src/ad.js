// FOCUS GROUP — the commercial.
//
// Everything Valco has ever said to you is drawn here, on a 2D canvas, in
// flat 1974 colour with a shutter on top. The same painter runs at 320x240
// inside the television in your living room and at full screen for the cold
// open and the credits, which is the joke: it is the same advertisement, and
// the only thing that changes across the week is how much of it is you.
//
// A script is a list of shots: [caption, seconds, shotName, opts]. A caption
// beginning with @ is filled in by the game (your survey answers; the line).

import { valFace, valcoLogo, agedPass } from './textures.js';
import { rng, clamp01, lerp } from './util.js';

const R = rng(19741103);

// 1974 process colour: four inks and a lot of optimism
const INK = {
  cream: '#f2e6c6',
  bone: '#e4d6ae',
  ochre: '#c8933a',
  orange: '#d1622a',
  rust: '#8c3a22',
  brown: '#5c3a1e',
  olive: '#7d8b3a',
  teal: '#3d6a6a',
  sky: '#8fb4c4',
  ink: '#241c14',
  red: '#a8281c',
};

// ---------------------------------------------------------------- little people

function head(ctx, x, y, r, o = {}) {
  ctx.fillStyle = o.skin || '#e8b98c';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // hair as one shape, the way a 1974 ad would key it
  ctx.fillStyle = o.hair || INK.brown;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.14, r * 1.02, Math.PI * (o.bald ? 1.15 : 1.0), Math.PI * 2.0);
  ctx.fill();
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.arc(x - r * 0.34, y + r * 0.05, r * 0.10, 0, Math.PI * 2);
  ctx.arc(x + r * 0.34, y + r * 0.05, r * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.rust;
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.16, r * 0.42, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();
}

function seated(ctx, x, y, s, colour, o = {}) {
  const bob = Math.sin((o.t || 0) * 2.2 + (o.phase || 0)) * s * 0.015;
  const sh = y - s * 0.02 + bob;         // where the shoulders are
  const hip = y + s * 0.62;

  // one torso shape, hips to shoulders, so the head has something to sit on
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.40, hip);
  ctx.lineTo(x - s * 0.27, sh + s * 0.02);
  ctx.quadraticCurveTo(x, sh - s * 0.13, x + s * 0.27, sh + s * 0.02);
  ctx.lineTo(x + s * 0.40, hip);
  ctx.closePath();
  ctx.fill();

  // the arm, from the shoulder, out to the table or up in a wave
  const a = Math.sin((o.t || 0) * 7 + (o.phase || 0)) * 0.32;
  ctx.strokeStyle = colour;
  ctx.lineWidth = s * 0.15;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.24, sh + s * 0.08);
  const hx = o.wave ? x + s * 0.52 + a * s * 0.18 : x + s * 0.48;
  const hy = o.wave ? sh - s * 0.46 : sh + s * 0.44;
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = o.skin || '#e8b98c';
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.085, 0, Math.PI * 2);
  ctx.fill();

  head(ctx, x, sh - s * 0.30, s * 0.27, o);
}

function steam(ctx, x, y, s, t, n = 3) {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = t * 1.6 + i * 1.9;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      ctx.lineTo(x + (i - (n - 1) / 2) * s * 0.16 + Math.sin(ph + u * 4) * s * 0.06,
        y - u * s * 0.5);
    }
    ctx.stroke();
  }
}

/** VAL, drawn flat, because on television he is a drawing. */
let VAL_IMG = null;
function val(ctx, x, y, s, t, waving = true) {
  if (!VAL_IMG) VAL_IMG = valFace(256, { bg: 'rgba(0,0,0,0)' });
  // body
  ctx.fillStyle = '#2a4a6a';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, y + s * 0.95);
  ctx.quadraticCurveTo(x, y - s * 0.05, x + s * 0.36, y + s * 0.95);
  ctx.closePath();
  ctx.fill();
  // the arm, which never stops
  ctx.strokeStyle = '#2a4a6a';
  ctx.lineWidth = s * 0.15;
  ctx.lineCap = 'round';
  const a = waving ? Math.sin(t * 6.2) * 0.45 : 0.1;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.24, y + s * 0.30);
  ctx.lineTo(x + s * 0.60 + a * s * 0.2, y - s * 0.38 + Math.abs(a) * s * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#efe2c4';
  ctx.beginPath();
  ctx.arc(x + s * 0.62 + a * s * 0.2, y - s * 0.42 + Math.abs(a) * s * 0.1, s * 0.11, 0, Math.PI * 2);
  ctx.fill();
  // the head, from the same artwork that is on every package
  const hs = s * 1.05;
  ctx.drawImage(VAL_IMG, x - hs / 2, y - s * 0.98, hs, hs);
}

// ---------------------------------------------------------------- rooms

function sunWindow(ctx, x, y, w, h, t) {
  ctx.fillStyle = '#bfd8dd';
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,232,160,0.75)';
  for (let i = 0; i < 7; i++) {
    const a = -0.85 + i * 0.10 + Math.sin(t * 0.4) * 0.02;
    ctx.save();
    ctx.translate(x + w * 0.5, y);
    ctx.rotate(a);
    ctx.fillRect(-w * 0.035, 0, w * 0.07, h * 2.4);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = INK.cream;
  ctx.lineWidth = Math.max(2, w * 0.045);
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

function coffeePot(ctx, x, y, s, pouring, t) {
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.30, y);
  ctx.lineTo(x - s * 0.36, y + s * 0.72);
  ctx.lineTo(x + s * 0.36, y + s * 0.72);
  ctx.lineTo(x + s * 0.30, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a1c0c';
  ctx.fillRect(x - s * 0.32, y + s * 0.26, s * 0.64, s * 0.44);
  ctx.fillStyle = INK.cream;
  ctx.fillRect(x - s * 0.34, y - s * 0.12, s * 0.68, s * 0.14);
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.arc(x + s * 0.46, y + s * 0.34, s * 0.20, -1.1, 1.1);
  ctx.stroke();
  if (pouring) {
    ctx.strokeStyle = '#4a250e';
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.34, y + s * 0.10);
    ctx.quadraticCurveTo(x - s * 0.62, y + s * 0.40, x - s * 0.66, y + s * 0.95);
    ctx.stroke();
    steam(ctx, x - s * 0.66, y + s * 0.9, s * 0.7, t, 2);
  }
}

// ---------------------------------------------------------------- shots
//
// Each takes (ctx, W, H, u, t, ctxData) where u is 0..1 through the shot.

const SHOTS = {
  starburst(ctx, W, H, u, t) {
    ctx.fillStyle = INK.rust;
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.35);
    ctx.fillStyle = INK.ochre;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = (i % 2 ? 0.28 : 0.62) * W;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const k = Math.min(1, u * 3.2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.fillStyle = INK.cream;
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.34, H * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.rust;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(H * 0.12)}px Georgia, "Times New Roman", serif`;
    ctx.fillText('VALCO', 0, -H * 0.03);
    ctx.font = `${Math.floor(H * 0.045)}px Georgia, serif`;
    ctx.fillText('PRESENTS', 0, H * 0.08);
    ctx.restore();
  },

  'kitchen-wide'(ctx, W, H, u, t) {
    ctx.fillStyle = INK.bone;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK.olive;
    ctx.fillRect(0, H * 0.68, W, H * 0.32);
    sunWindow(ctx, W * 0.58, H * 0.12, W * 0.30, H * 0.34, t);
    // counter, kettle, and a slow push in
    const push = 1 + u * 0.04;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(push, push);
    ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = INK.ochre;
    ctx.fillRect(W * 0.05, H * 0.56, W * 0.52, H * 0.13);
    ctx.fillStyle = INK.brown;
    ctx.fillRect(W * 0.05, H * 0.69, W * 0.52, H * 0.16);
    coffeePot(ctx, W * 0.22, H * 0.42, H * 0.20, false, t);
    ctx.fillStyle = INK.cream;
    ctx.fillRect(W * 0.36, H * 0.50, W * 0.05, H * 0.06);
    ctx.restore();
  },

  'family-table'(ctx, W, H, u, t) {
    ctx.fillStyle = INK.bone;
    ctx.fillRect(0, 0, W, H);
    sunWindow(ctx, W * 0.06, H * 0.08, W * 0.24, H * 0.30, t);
    ctx.fillStyle = INK.teal;
    ctx.fillRect(0, H * 0.74, W, H * 0.26);
    const s = H * 0.42;
    seated(ctx, W * 0.30, H * 0.60, s, INK.orange, { t, phase: 0, hair: INK.brown });
    seated(ctx, W * 0.52, H * 0.58, s * 1.04, INK.teal, { t, phase: 2.1, hair: '#3a2a18', bald: true });
    seated(ctx, W * 0.72, H * 0.62, s * 0.82, INK.ochre, { t, phase: 4.0, hair: '#8a5a24' });
    // the table, and three cups steaming in time
    ctx.fillStyle = INK.cream;
    ctx.fillRect(W * 0.16, H * 0.76, W * 0.70, H * 0.06);
    ctx.fillStyle = INK.brown;
    ctx.fillRect(W * 0.16, H * 0.82, W * 0.70, H * 0.03);
    [0.30, 0.52, 0.72].forEach((cx, i) => {
      ctx.fillStyle = INK.cream;
      ctx.fillRect(W * cx - H * 0.035, H * 0.70, H * 0.07, H * 0.062);
      steam(ctx, W * cx, H * 0.70, H * 0.10, t + i, 2);
    });
  },

  'pot-close'(ctx, W, H, u, t) {
    ctx.fillStyle = INK.ochre;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,240,200,0.35)';
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, H * (0.55 + Math.sin(t * 1.4) * 0.02), 0, Math.PI * 2);
    ctx.fill();
    coffeePot(ctx, W * 0.56, H * 0.20, H * 0.62, u > 0.25, t);
    ctx.fillStyle = INK.cream;
    ctx.fillRect(W * 0.30, H * 0.72, H * 0.20, H * 0.18);
  },

  'bathroom-close'(ctx, W, H, u, t) {
    ctx.fillStyle = '#cfdcdc';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 9; x++) {
        ctx.strokeStyle = 'rgba(150,170,170,0.6)';
        ctx.strokeRect((x * W) / 9, (y * H) / 6, W / 9, H / 6);
      }
    }
    // a tap, and a bar of soap with the starburst pressed into it
    ctx.fillStyle = '#b8bcc0';
    ctx.fillRect(W * 0.20, H * 0.18, W * 0.05, H * 0.34);
    ctx.fillRect(W * 0.20, H * 0.16, W * 0.22, H * 0.05);
    ctx.fillStyle = 'rgba(190,220,235,0.8)';
    ctx.fillRect(W * 0.40, H * 0.21, W * 0.03, H * (0.30 + Math.sin(t * 9) * 0.02));
    ctx.fillStyle = INK.cream;
    ctx.beginPath();
    ctx.ellipse(W * 0.66, H * 0.62, W * 0.14, H * 0.10, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.ochre;
    ctx.font = `bold ${Math.floor(H * 0.07)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VALCO', W * 0.66, H * 0.645);
  },

  'clock-close'(ctx, W, H, u, t) {
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(W * 0.16, H * 0.30, W * 0.68, H * 0.40);
    ctx.fillStyle = '#0a0406';
    ctx.fillRect(W * 0.24, H * 0.38, W * 0.38, H * 0.22);
    ctx.fillStyle = '#ff3418';
    ctx.font = `bold ${Math.floor(H * 0.19)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(t * 2) % 2 ? '6 41' : '6:41', W * 0.43, H * 0.49);
    ctx.fillStyle = '#b8bcc0';
    ctx.fillRect(W * 0.20, H * 0.26, W * 0.60, H * 0.035);
    ctx.fillStyle = '#6a6250';
    ctx.fillRect(W * 0.66, H * 0.40, W * 0.14, H * 0.18);
  },

  'living-wide'(ctx, W, H, u, t, d) {
    ctx.fillStyle = INK.bone;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(0, H * 0.70, W, H * 0.30);
    // sofa
    ctx.fillStyle = INK.orange;
    ctx.fillRect(W * 0.10, H * 0.50, W * 0.34, H * 0.24);
    ctx.fillRect(W * 0.08, H * 0.44, W * 0.38, H * 0.10);
    // the set, showing this advertisement
    ctx.fillStyle = INK.brown;
    ctx.fillRect(W * 0.60, H * 0.40, W * 0.28, H * 0.30);
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(W * 0.63, H * 0.44, W * 0.22, H * 0.19);
    ctx.save();
    ctx.beginPath();
    ctx.rect(W * 0.63, H * 0.44, W * 0.22, H * 0.19);
    ctx.clip();
    ctx.translate(W * 0.63, H * 0.44);
    ctx.scale((W * 0.22) / W, (H * 0.19) / H);
    // one level of recursion is charming; two is a bill
    if (!d?.noRecurse) SHOTS['family-table'](ctx, W, H, u, t, { noRecurse: true });
    ctx.restore();
    // lamp
    ctx.strokeStyle = INK.ink;
    ctx.lineWidth = Math.max(2, W * 0.006);
    ctx.beginPath();
    ctx.moveTo(W * 0.52, H * 0.72);
    ctx.lineTo(W * 0.52, H * 0.34);
    ctx.stroke();
    ctx.fillStyle = INK.ochre;
    ctx.beginPath();
    ctx.moveTo(W * 0.46, H * 0.34);
    ctx.lineTo(W * 0.58, H * 0.34);
    ctx.lineTo(W * 0.555, H * 0.22);
    ctx.lineTo(W * 0.485, H * 0.22);
    ctx.closePath();
    ctx.fill();
  },

  'val-wave'(ctx, W, H, u, t) {
    ctx.fillStyle = INK.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H * 0.52);
    ctx.rotate(t * -0.25);
    ctx.fillStyle = 'rgba(255,240,190,0.55)';
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r = (i % 2 ? 0.24 : 0.55) * W;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    val(ctx, W * 0.5, H * 0.72, H * 0.46, t, true);
  },

  'family-wave'(ctx, W, H, u, t) {
    ctx.fillStyle = INK.bone;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK.olive;
    ctx.fillRect(0, H * 0.76, W, H * 0.24);
    const s = H * 0.40;
    seated(ctx, W * 0.26, H * 0.68, s, INK.orange, { t, phase: 0, wave: true });
    seated(ctx, W * 0.48, H * 0.66, s * 1.05, INK.teal, { t, phase: 1.4, wave: true, bald: true });
    seated(ctx, W * 0.68, H * 0.70, s * 0.84, INK.ochre, { t, phase: 2.6, wave: true });
    val(ctx, W * 0.845, H * 0.74, H * 0.30, t, true);
  },

  logo(ctx, W, H, u, t, d) {
    ctx.fillStyle = INK.ink;
    ctx.fillRect(0, 0, W, H);
    if (!d.logoImg) d.logoImg = valcoLogo(512, 256, { bg: null });
    const k = 0.55 + Math.min(1, u * 4) * 0.35;
    const lw = W * 0.72 * k, lh = lw * 0.5;
    ctx.drawImage(d.logoImg, (W - lw) / 2, H * 0.30 - lh * 0.35, lw, lh);
    ctx.fillStyle = INK.cream;
    ctx.textAlign = 'center';
    ctx.font = `${Math.floor(H * 0.062)}px Georgia, serif`;
    // the tagline is the plot
    ctx.fillText(d.tagline || "WE'RE PART OF YOUR MORNING", W / 2, H * 0.80);
  },

  smallprint(ctx, W, H) {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8a8474';
    ctx.textAlign = 'center';
    ctx.font = `${Math.floor(H * 0.042)}px Georgia, serif`;
    ctx.fillText('VALCO HOME PRODUCTS · A FAMILY OF BRANDS · EST. 1954', W / 2, H * 0.44);
    ctx.font = `${Math.floor(H * 0.034)}px Georgia, serif`;
    ctx.fillText('MEMBER, NATIONAL ASSOCIATION OF ADVERTISERS', W / 2, H * 0.56);
    ctx.fillText('PARTICIPATION IS VOLUNTARY WHERE REQUIRED BY LAW', W / 2, H * 0.66);
  },

  // one frame of a room with nobody in it. You will not be sure you saw it.
  thehouse(ctx, W, H, u, t, d) {
    ctx.fillStyle = '#0e0f12';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    ctx.fillStyle = '#23252c';
    ctx.fillRect(W * 0.10, H * 0.44, W * 0.34, H * 0.26);      // the sofa
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(W * 0.62, H * 0.40, W * 0.24, H * 0.28);      // the set
    ctx.fillStyle = 'rgba(150,180,210,0.10)';
    ctx.fillRect(W * 0.64, H * 0.43, W * 0.20, H * 0.17);
    // a doorway with the hall light behind it
    ctx.fillStyle = 'rgba(210,190,140,0.14)';
    ctx.fillRect(W * 0.47, H * 0.22, W * 0.09, H * 0.44);
    ctx.fillStyle = '#c8c4b0';
    ctx.font = `${Math.floor(H * 0.05)}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('CAM 04', W * 0.04, H * 0.10);
    ctx.textAlign = 'right';
    ctx.fillText('74-03-04  03:12:40', W * 0.96, H * 0.94);
    agedPass(ctx, W, H, { grain: 40, vign: 0.7 });
  },

  // a captured frame of your own week, cut into the advertisement
  grab(ctx, W, H, u, t, d) {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);
    const f = d.frame;
    if (!f) { SHOTS['family-table'](ctx, W, H, u, t, d); return; }
    // a slow push, because it is being used as footage now
    const k = 1.04 + u * 0.06;
    const iw = W * k, ih = H * k;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(f.cv, (W - iw) / 2, (H - ih) / 2, iw, ih);
    ctx.restore();
    // warm it up to match the stock it has been cut into
    ctx.fillStyle = 'rgba(200,140,60,0.16)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(230,220,190,0.85)';
    ctx.font = `${Math.floor(H * 0.036)}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`CAM ${String(f.cam).padStart(2, '0')}   ${f.stamp}`, W * 0.035, H * 0.945);
  },

  // the last shot of the game: a different flat, a different morning
  nextsubject(ctx, W, H, u, t, d) {
    ctx.fillStyle = '#141017';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#20222c';
    ctx.fillRect(0, H * 0.66, W, H * 0.34);
    // somebody sitting up in a bed that is not yours
    ctx.fillStyle = '#2c2a34';
    ctx.fillRect(W * 0.06, H * 0.52, W * 0.34, H * 0.22);
    ctx.fillStyle = '#3a3644';
    ctx.beginPath();
    ctx.ellipse(W * 0.17, H * 0.50, W * 0.045, H * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    // and their television, which is showing you
    ctx.fillStyle = '#241c14';
    ctx.fillRect(W * 0.58, H * 0.36, W * 0.30, H * 0.32);
    const sx = W * 0.605, sy = H * 0.395, sw = W * 0.25, sh = H * 0.22;
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(sx, sy, sw, sh);
    if (d.frame) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, sw, sh);
      ctx.clip();
      ctx.drawImage(d.frame.cv, sx, sy, sw, sh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#3a4a5a';
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.fillStyle = 'rgba(150,180,215,0.14)';
    ctx.beginPath();
    ctx.moveTo(sx, sy + sh);
    ctx.lineTo(sx - W * 0.30, H * 0.92);
    ctx.lineTo(sx + sw + W * 0.06, H * 0.92);
    ctx.lineTo(sx + sw, sy + sh);
    ctx.closePath();
    ctx.fill();
    agedPass(ctx, W, H, { grain: 20, vign: 0.62 });
  },
};

// ---------------------------------------------------------------- the projector

export class AdReel {
  /**
   * @param {object} o { audio, onCaption(text|null), onEnd() }
   */
  constructor(o = {}) {
    this.audio = o.audio || null;
    this.onCaption = o.onCaption || null;
    this.script = null;
    this.shot = -1;
    this.t = 0;
    this.shotT = 0;
    this.playing = false;
    this.onTv = true;
    this.data = { tagline: "WE'RE PART OF YOUR MORNING" };
    this.resolve = null;
    this.frames = [];
  }

  /**
   * @param {object} script from story.js
   * @param {object} o { tagline, frames, onTv, resolve }
   * @returns {Promise<void>}
   */
  play(script, o = {}) {
    this.script = script;
    this.shot = -1;
    this.t = 0;
    this.playing = true;
    this.onTv = o.onTv !== false;
    this.frames = o.frames || [];
    this.data.tagline = o.tagline || this.data.tagline;
    this.data.survey = o.survey || '';
    this.data.line = o.line || '';
    if (this.audio && script.music) {
      this.audio.playJingle(script.music, this.onTv, this.onTv ? 0.75 : 1);
    }
    this.next();
    return new Promise((res) => { this.resolve = res; });
  }

  next() {
    this.shot++;
    this.shotT = 0;
    const shots = this.script?.shots || [];
    if (this.shot >= shots.length) { this.end(); return; }
    const [caption, , , opts] = shots[this.shot];
    this.data.frame = opts && opts.grab !== undefined
      ? this.frames[opts.grab % Math.max(1, this.frames.length)]
      : null;

    const text = this.captionText(caption);
    this.onCaption?.(text);
    if (text && this.audio) this.audio.announce(text, { onTv: this.onTv, gain: this.onTv ? 0.7 : 0.95 });
  }

  captionText(caption) {
    if (!caption) return '';
    if (caption === '@survey') return this.data.survey || 'You told us a great deal.';
    if (caption === '@line') return this.data.line || '';
    return caption;
  }

  update(dt) {
    if (!this.playing) return;
    this.t += dt;
    this.shotT += dt;
    const s = this.script.shots[this.shot];
    if (!s) { this.end(); return; }
    if (this.shotT >= s[1]) this.next();
  }

  skip() {
    if (!this.playing) return;
    this.end();
  }

  end() {
    if (!this.playing) return;
    this.playing = false;
    this.onCaption?.(null);
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  /**
   * Paint the current frame at whatever size you have. Used both for the
   * 320x240 in the corner of the living room and for the whole screen.
   */
  paint(ctx, W, H, o = {}) {
    const s = this.script?.shots?.[this.shot];
    if (!s) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const [, dur, name] = s;
    const u = clamp01(this.shotT / Math.max(0.001, dur));

    // gate weave — the print is not held perfectly still, ever
    const wob = o.steady ? 0 : 1;
    const wx = Math.sin(this.t * 8.3) * 0.0022 * W * wob;
    const wy = Math.cos(this.t * 6.1) * 0.0018 * H * wob;

    ctx.save();
    ctx.translate(wx, wy);
    const painter = SHOTS[name] || SHOTS.starburst;
    painter(ctx, W, H, u, this.t, this.data);
    ctx.restore();

    // the burned-in caption, in the type a 1974 spot would use
    const text = this.captionText(s[0]);
    if (text && o.captions !== false) {
      const fs = Math.max(9, Math.floor(H * 0.058));
      ctx.font = `${fs}px Georgia, "Times New Roman", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const lines = wrap(ctx, text, W * 0.86);
      lines.forEach((ln, i) => {
        const y = H * 0.94 - (lines.length - 1 - i) * fs * 1.22;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(ln, W / 2 + 1, y + 1);
        ctx.fillStyle = '#f4ecd0';
        ctx.fillText(ln, W / 2, y);
      });
    }

    if (o.film !== false) filmPass(ctx, W, H, this.t);
  }
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const wd of words) {
    const test = line ? `${line} ${wd}` : wd;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(-3);
}

/** 16mm on top of whatever was just drawn: grain, dust, a hair, a shutter. */
export function filmPass(ctx, W, H, t) {
  // shutter flicker
  ctx.fillStyle = `rgba(0,0,0,${0.035 + Math.sin(t * 31.4) * 0.022 + 0.022})`;
  ctx.fillRect(0, 0, W, H);

  // dust and sparkle, a fresh handful every frame
  const n = Math.max(6, Math.floor((W * H) / 9000));
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H;
    ctx.fillStyle = R() > 0.35 ? 'rgba(250,246,230,0.55)' : 'rgba(20,14,8,0.5)';
    ctx.fillRect(x, y, 1 + R() * 1.6, 1 + R() * 2.4);
  }
  // one hair in the gate, wandering
  const hx = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.11)));
  ctx.strokeStyle = 'rgba(20,14,8,0.32)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 0; k <= 8; k++) {
    ctx.lineTo(hx + Math.sin(k * 1.3 + t * 0.4) * W * 0.012, (k / 8) * H * 0.34);
  }
  ctx.stroke();
  // a scratch, on a slower clock
  const sx = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.07 + 2)));
  ctx.fillStyle = 'rgba(255,250,235,0.16)';
  ctx.fillRect(sx, 0, 1.4, H);

  // warm the stock and put a corner on it
  ctx.fillStyle = 'rgba(190,140,60,0.055)';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.66);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // and the lines, because it is being played off a television
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  const step = Math.max(2, Math.round(H / 200));
  for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, 1);
}
