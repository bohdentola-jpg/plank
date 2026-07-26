// Procedural mascot decal art, drawn bold and flat like a 2000s helmet sticker.
// Every logo is drawn into a transparent 512x512 canvas using the school colors.

export const LOGO_IDS = ['bolt', 'star', 'paw', 'wing', 'helm', 'bulldog', 'horns', 'comet', 'letter'];

export const LOGO_LABELS = {
  bolt: 'Lightning', star: 'All-Star', paw: 'Paw', wing: 'Winged Shield', helm: 'Spartan',
  bulldog: 'Bulldog', horns: 'Ram Horns', comet: 'Comet', letter: 'Varsity Letter',
};

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function fillStroke(ctx, fill, stroke, lw) {
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function blockLetter(ctx, letter, x, y, size, fill, stroke, lw) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
  ctx.lineJoin = 'round';
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(letter, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(letter, x, y);
  ctx.restore();
}

const ART = {
  bolt(ctx, c) {
    const pts = [[300, 18], [128, 258], [232, 258], [96, 494], [400, 218], [286, 218], [444, 18]];
    poly(ctx, pts);
    fillStroke(ctx, c.fg, c.line, 30);
    // hot core
    const core = [[296, 60], [180, 244], [262, 244], [186, 408], [356, 232], [258, 232], [382, 60]];
    poly(ctx, core);
    ctx.fillStyle = c.bg;
    ctx.fill();
  },

  star(ctx, c) {
    const star = (cx, cy, R, r, rot) => {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const a = rot + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? R : r;
        p.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
      }
      return p;
    };
    poly(ctx, star(256, 268, 230, 95, -Math.PI / 2));
    fillStroke(ctx, c.fg, c.line, 28);
    poly(ctx, star(256, 268, 150, 62, -Math.PI / 2));
    ctx.fillStyle = c.bg;
    ctx.fill();
  },

  paw(ctx, c) {
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(-0.18);
    const pad = (x, y, rx, ry, rot) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      fillStroke(ctx, c.fg, c.line, 24);
      ctx.restore();
    };
    // main pad: rounded triangle-ish via ellipse + bottom bulge
    ctx.beginPath();
    ctx.ellipse(0, 92, 142, 118, 0, 0, Math.PI * 2);
    fillStroke(ctx, c.fg, c.line, 26);
    pad(-138, -56, 52, 72, -0.35);
    pad(-48, -120, 50, 70, -0.12);
    pad(48, -126, 50, 70, 0.10);
    pad(140, -66, 52, 72, 0.35);
    ctx.restore();
  },

  wing(ctx, c) {
    // spread wings
    const wing = (sx) => {
      ctx.save();
      ctx.translate(256, 252);
      ctx.scale(sx, 1);
      for (let f = 0; f < 4; f++) {
        ctx.beginPath();
        const y0 = -64 + f * 34, len = 196 - f * 30, droop = 14 + f * 30;
        ctx.moveTo(40, y0);
        ctx.quadraticCurveTo(40 + len * 0.62, y0 - 36, 40 + len, y0 + droop - 28);
        ctx.quadraticCurveTo(40 + len * 0.6, y0 + droop + 6, 40, y0 + 38);
        ctx.closePath();
        fillStroke(ctx, c.fg, c.line, 18);
      }
      ctx.restore();
    };
    wing(1); wing(-1);
    // center shield
    ctx.beginPath();
    ctx.moveTo(186, 150);
    ctx.lineTo(326, 150);
    ctx.quadraticCurveTo(326, 318, 256, 392);
    ctx.quadraticCurveTo(186, 318, 186, 150);
    ctx.closePath();
    fillStroke(ctx, c.bg, c.line, 22);
    blockLetter(ctx, c.letter, 256, 252, 150, c.fg, c.line, 14);
  },

  helm(ctx, c) {
    ctx.save();
    ctx.translate(238, 268);
    // crest (mohawk)
    ctx.beginPath();
    ctx.moveTo(-92, -86);
    ctx.quadraticCurveTo(-10, -236, 152, -148);
    ctx.quadraticCurveTo(180, -128, 168, -96);
    ctx.quadraticCurveTo(40, -168, -54, -50);
    ctx.closePath();
    fillStroke(ctx, c.bg, c.line, 20);
    // helmet dome + cheek + nose guard (classic corinthian profile, facing right)
    ctx.beginPath();
    ctx.moveTo(-104, 22);
    ctx.quadraticCurveTo(-118, -120, 24, -134);
    ctx.quadraticCurveTo(150, -126, 152, -10);
    ctx.lineTo(152, 30);          // brow front
    ctx.lineTo(96, 30);           // eye slot top
    ctx.lineTo(122, 142);         // nose guard
    ctx.lineTo(86, 150);
    ctx.lineTo(70, 70);           // under eye
    ctx.lineTo(40, 178);          // cheek guard
    ctx.lineTo(-40, 190);
    ctx.quadraticCurveTo(-106, 130, -104, 22);
    ctx.closePath();
    fillStroke(ctx, c.fg, c.line, 22);
    // eye slit
    ctx.beginPath();
    poly(ctx, [[96, 44], [144, 44], [150, 64], [104, 70]]);
    ctx.fillStyle = c.line;
    ctx.fill();
    ctx.restore();
  },

  bulldog(ctx, c) {
    ctx.save();
    ctx.translate(256, 268);
    // ears
    poly(ctx, [[-168, -148], [-96, -196], [-72, -120]]);
    fillStroke(ctx, c.fg, c.line, 20);
    poly(ctx, [[168, -148], [96, -196], [72, -120]]);
    fillStroke(ctx, c.fg, c.line, 20);
    // head
    ctx.beginPath();
    ctx.moveTo(-150, -130);
    ctx.quadraticCurveTo(0, -212, 150, -130);
    ctx.quadraticCurveTo(186, -40, 158, 70);
    ctx.quadraticCurveTo(120, 180, 0, 190);
    ctx.quadraticCurveTo(-120, 180, -158, 70);
    ctx.quadraticCurveTo(-186, -40, -150, -130);
    ctx.closePath();
    fillStroke(ctx, c.fg, c.line, 24);
    // jowls
    ctx.beginPath(); ctx.ellipse(-62, 108, 62, 74, 0.1, 0, Math.PI * 2); fillStroke(ctx, c.bg, c.line, 16);
    ctx.beginPath(); ctx.ellipse(62, 108, 62, 74, -0.1, 0, Math.PI * 2); fillStroke(ctx, c.bg, c.line, 16);
    // snout + nose
    ctx.beginPath(); ctx.ellipse(0, 38, 56, 42, 0, 0, Math.PI * 2); fillStroke(ctx, c.bg, c.line, 14);
    ctx.beginPath(); ctx.ellipse(0, 28, 26, 18, 0, 0, Math.PI * 2); ctx.fillStyle = c.line; ctx.fill();
    // angry brow + eyes
    poly(ctx, [[-118, -76], [-30, -38], [-34, -10], [-122, -42]]);
    ctx.fillStyle = c.line; ctx.fill();
    poly(ctx, [[118, -76], [30, -38], [34, -10], [122, -42]]);
    ctx.fillStyle = c.line; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-66, -16, 17, 13, 0.15, 0, Math.PI * 2); ctx.fillStyle = c.bg; ctx.fill();
    ctx.beginPath(); ctx.ellipse(66, -16, 17, 13, -0.15, 0, Math.PI * 2); ctx.fillStyle = c.bg; ctx.fill();
    // fangs
    poly(ctx, [[-94, 142], [-78, 184], [-62, 144]]); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = 8; ctx.stroke();
    poly(ctx, [[94, 142], [78, 184], [62, 144]]); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.restore();
  },

  horns(ctx, c) {
    const horn = (sx) => {
      ctx.save();
      ctx.translate(256, 256);
      ctx.scale(sx, 1);
      ctx.beginPath();
      // curling ram horn: outer spiral
      ctx.moveTo(34, -150);
      ctx.bezierCurveTo(150, -210, 232, -130, 222, -22);
      ctx.bezierCurveTo(214, 78, 140, 130, 78, 116);
      ctx.bezierCurveTo(36, 106, 16, 72, 26, 40);
      // inner return
      ctx.bezierCurveTo(34, 76, 76, 86, 104, 68);
      ctx.bezierCurveTo(160, 34, 168, -52, 124, -104);
      ctx.bezierCurveTo(96, -136, 56, -134, 34, -112);
      ctx.closePath();
      fillStroke(ctx, c.fg, c.line, 20);
      ctx.restore();
    };
    horn(1); horn(-1);
    blockLetter(ctx, c.letter, 256, 268, 168, c.bg, c.line, 16);
  },

  comet(ctx, c) {
    ctx.save();
    ctx.translate(0, 30);
    // swoosh tails
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const y = 150 + i * 56, w = 380 - i * 70;
      ctx.moveTo(470, y);
      ctx.quadraticCurveTo(470 - w * 0.5, y - 36, 470 - w, y + 4);
      ctx.quadraticCurveTo(470 - w * 0.5, y + 26, 470, y + 34 - i * 4);
      ctx.closePath();
      fillStroke(ctx, i === 1 ? c.bg : c.fg, c.line, 14);
    }
    // comet head
    ctx.beginPath(); ctx.arc(366, 196, 96, 0, Math.PI * 2);
    fillStroke(ctx, c.fg, c.line, 22);
    ctx.beginPath(); ctx.arc(366, 196, 56, 0, Math.PI * 2);
    ctx.fillStyle = c.bg; ctx.fill();
    ctx.restore();
  },

  letter(ctx, c) {
    ctx.beginPath(); ctx.arc(256, 256, 218, 0, Math.PI * 2);
    fillStroke(ctx, c.fg, c.line, 24);
    ctx.beginPath(); ctx.arc(256, 256, 178, 0, Math.PI * 2);
    ctx.fillStyle = c.bg; ctx.fill();
    blockLetter(ctx, c.letter, 256, 262, 250, c.fg, c.line, 20);
  },
};

/**
 * Render a logo into a fresh canvas.
 * opts: { fg, bg, line, letter } — fg = main color, bg = accent, line = outline.
 */
export function logoCanvas(id, opts) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  const c = {
    fg: opts.fg || '#ffffff',
    bg: opts.bg || '#222222',
    line: opts.line || '#101014',
    letter: (opts.letter || 'W').toUpperCase().slice(0, 1),
  };
  (ART[id] || ART.star)(ctx, c);
  return cv;
}
