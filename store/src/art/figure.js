// The cast of DRIP LINE: your vinyl figure (front view for the train, side
// view for the runner) wearing anything from the catalog, plus the object-head
// shopkeepers. Feet at (0,0), about 100 units tall at scale 1.
import {
  INK, shape, rect, rrect, ellipse, blob, stroke, tube, dot, text, FONTS,
  mulberry32, shade, tint, mix, rgba, ellipsePts, rrectPts, pathPts, lerp,
} from '../ink.js';
import {
  fabric, finishFill, emblem, dropPts, heartPts, starPts, flamePts, twinkle, sprayCanShape,
} from './products.js';

export const SLOTS = ['head', 'face', 'neck', 'top', 'bottom', 'feet', 'hand', 'aura'];

export const SKINS = [
  { id: 'cream', name: 'Cream', c: '#f2e6cf' },
  { id: 'bubblegum', name: 'Bubblegum', c: '#ff9ccf' },
  { id: 'mint', name: 'Mint', c: '#9ff0cf' },
  { id: 'sky', name: 'Sky', c: '#8fd0ff' },
  { id: 'lemon', name: 'Lemon', c: '#ffe46b' },
  { id: 'tangerine', name: 'Tangerine', c: '#ff9a4a' },
  { id: 'coral', name: 'Coral', c: '#ff6f6f' },
  { id: 'grape', name: 'Grape', c: '#a77bff' },
  { id: 'charcoal', name: 'Charcoal', c: '#4a4658' },
  { id: 'snow', name: 'Snow', c: '#f7f7fb' },
  { id: 'toxic', name: 'Toxic', c: '#b6ff3d' },
  { id: 'chrome', name: 'Chrome', c: '#c9cfe0', special: true },
];
export const HEADS = ['round', 'square', 'bean', 'drop'];
export const FACES = ['dots', 'happy', 'cool', 'wide', 'x', 'cyclops'];
export const NPC_IDS = ['signal', 'drippy', 'lace', 'cone', 'mira', 'joy', 'plug', 'static', 'eight'];
export const DEFAULT_BODY = { skin: 'cream', head: 'round', face: 'dots' };

const TAU = Math.PI * 2;
const LONG = { hoodie: 1, jacket: 1, windbreaker: 1, puffer: 1 };

function skinColor(skin) {
  const s = SKINS.find((k) => k.id === skin);
  if (s) return s.c;
  return typeof skin === 'string' && skin.startsWith('#') ? skin : SKINS[0].c;
}
const isChrome = (skin) => skin === 'chrome';

// ---------------------------------------------------------------- heads

const HEAD_M = {
  round: { shape: 'round', cx: 0, cy: -78, rx: 24.5, ry: 23 },
  square: { shape: 'square', cx: 0, cy: -78, rx: 23.5, ry: 22.5 },
  bean: { shape: 'bean', cx: 0, cy: -80.5, rx: 20.5, ry: 25.5 },
  drop: { shape: 'drop', cx: 0, cy: -76.5, rx: 22.5, ry: 22.5 },
};

function headM(name, dx = 0) {
  const b = HEAD_M[name] || HEAD_M.round;
  const top = b.shape === 'drop' ? b.cy - b.ry * 1.55 : b.cy - b.ry;
  return {
    ...b, cx: b.cx + dx, top, bottom: b.cy + b.ry, w: b.rx,
    eyeY: b.cy - 1, mouthY: b.cy + 10.5, brimY: b.cy - 13,
  };
}

function headPts(m) {
  switch (m.shape) {
    case 'square': return rrectPts(m.cx - m.rx, m.cy - m.ry, m.rx * 2, m.ry * 2, 13);
    case 'drop': return dropPts(m.cx, m.cy, m.rx, 1.55);
    default: return ellipsePts(m.cx, m.cy, m.rx, m.ry);
  }
}

function drawHeadShape(g, m, skin, sd, t) {
  const c = skinColor(skin);
  fabric(g, headPts(m), { c, finish: isChrome(skin) ? 'chrome' : undefined }, { seed: sd, t, shadeAmt: 0.17, sdx: 3.6, sdy: 3.4, lw: 3.2 });
  // vinyl gloss
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.42)';
  g.beginPath();
  g.ellipse(m.cx - m.rx * 0.45, m.cy - m.ry * 0.52, m.rx * 0.28, m.ry * 0.14, -0.6, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.arc(m.cx - m.rx * 0.18, m.cy - m.ry * 0.72, 1.6, 0, TAU);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- faces

function drawFace(g, m, face, o) {
  const { t = 0, blink = 0, talk = false, noMouth = false } = o;
  const ex = m.w * 0.37, ey = m.eyeY, my = m.mouthY;
  const open = talk ? Math.max(0, Math.sin(t * 18)) : 0;
  const lineEye = (x) => stroke(g, [[x - 3.4, ey + 0.5], [x + 3.4, ey + 0.5]], { lw: 2.4, amp: 0 });
  // blush
  g.fillStyle = 'rgba(255,90,140,0.22)';
  g.beginPath(); g.ellipse(m.cx - ex - 4, my - 3.5, 4, 2.4, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(m.cx + ex + 4, my - 3.5, 4, 2.4, 0, 0, TAU); g.fill();
  const cx = m.cx;
  switch (face) {
    case 'happy':
      for (const s of [-1, 1]) stroke(g, pathPts([['M', cx + s * ex - 3.8, ey + 1.5], ['Q', cx + s * ex, ey - 4, cx + s * ex + 3.8, ey + 1.5]]), { lw: 2.6, amp: 0 });
      break;
    case 'cool':
      for (const s of [-1, 1]) {
        if (blink) { lineEye(cx + s * ex); continue; }
        dot(g, cx + s * ex, ey + 1, 3, INK);
        stroke(g, [[cx + s * ex - 4.4, ey - 1.4], [cx + s * ex + 4.4, ey - 0.6 - s * 0.6]], { lw: 2.6, amp: 0 });
      }
      break;
    case 'wide':
      for (const s of [-1, 1]) {
        if (blink) { lineEye(cx + s * ex); continue; }
        ellipse(g, cx + s * ex, ey, 5.6, 6.2, { fill: '#fffaf0', lw: 2.2, amp: 0.2, seed: 5 + s });
        dot(g, cx + s * ex + 1, ey + 0.8, 3, INK);
        dot(g, cx + s * ex - 0.2, ey - 1.2, 1.1, '#ffffff');
      }
      break;
    case 'x':
      for (const s of [-1, 1]) {
        const x = cx + s * ex;
        stroke(g, [[x - 3, ey - 3], [x + 3, ey + 3]], { lw: 2.4, amp: 0 });
        stroke(g, [[x + 3, ey - 3], [x - 3, ey + 3]], { lw: 2.4, amp: 0 });
      }
      break;
    case 'cyclops':
      if (blink) stroke(g, [[cx - 6, ey], [cx + 6, ey]], { lw: 2.6, amp: 0 });
      else {
        ellipse(g, cx, ey - 1, 8.4, 8.8, { fill: '#fffaf0', lw: 2.4, amp: 0.2, seed: 9 });
        dot(g, cx + 1.4, ey, 4.4, INK);
        dot(g, cx - 0.4, ey - 2.4, 1.5, '#ffffff');
      }
      break;
    default: // dots
      for (const s of [-1, 1]) {
        if (blink) { lineEye(cx + s * ex); continue; }
        dot(g, cx + s * ex, ey, 2.9, INK);
        dot(g, cx + s * ex - 0.9, ey - 1, 0.9, '#ffffff');
      }
  }
  if (noMouth) return;
  if (open > 0.15) {
    ellipse(g, cx, my, 3.4, 1.4 + open * 2.4, { fill: '#5a1a3a', lw: 2, amp: 0, seed: 11 });
  } else if (face === 'happy') {
    blob(g, [['M', cx - 6, my - 1.5], ['Q', cx, my + 7, cx + 6, my - 1.5], ['Z']], { fill: '#5a1a3a', lw: 2.2, amp: 0, seed: 12 });
    ellipse(g, cx, my + 2.2, 2.2, 1.2, { fill: '#ff7a9a', lw: 0, amp: 0 });
  } else if (face === 'cool') {
    stroke(g, pathPts([['M', cx - 4, my], ['Q', cx + 1, my + 2.2, cx + 4.8, my - 1.6]]), { lw: 2.2, amp: 0 });
  } else if (face === 'x') {
    ellipse(g, cx, my, 2.2, 1.8, { fill: '#5a1a3a', lw: 1.8, amp: 0 });
  } else {
    stroke(g, pathPts([['M', cx - 3.6, my - 0.6], ['Q', cx, my + 2.6, cx + 3.6, my - 0.6]]), { lw: 2.2, amp: 0 });
  }
}

// ---------------------------------------------------------------- pose

function frontPose(pose, t, held) {
  const sway = Math.sin(t * 2.1) * 0.8;
  const P = {
    bob: Math.sin(t * 2.4) * 0.7, hop: 0,
    sL: [-15, -54], sR: [15, -54],
    eL: [-21, -42 + sway * 0.2], hL: [-23.5 + sway * 0.3, -31],
    eR: [21, -42 - sway * 0.2], hR: [23.5 - sway * 0.3, -31],
  };
  if (pose === 'wave') {
    const w = Math.sin(t * 9);
    P.eL = [-28, -60];
    P.hL = [-31 + w * 3.2, -75 + Math.abs(w)];
  } else if (pose === 'cheer') {
    P.hop = -Math.abs(Math.sin(t * 7)) * 5;
    P.eL = [-25, -66]; P.hL = [-28, -80];
    P.eR = [25, -66]; P.hR = [28, -80];
  } else if (pose === 'pose') {
    P.eL = [-28, -45]; P.hL = [-17.5, -34];
  } else if (pose === 'point') {
    P.eR = [28, -52]; P.hR = [39, -54];
  }
  if (held === 'boombox') { P.eR = [26, -56]; P.hR = [27, -66]; }
  return P;
}

// ---------------------------------------------------------------- body

function torsoPts(hem = -26.5, w = 17.5) {
  return pathPts([
    ['M', -15, -58], ['Q', 0, -60.5, 15, -58],
    ['Q', w + 1, -56, w, -49],
    ['L', w + 0.6, hem - 1.2], ['Q', 0, hem + 1.8, -(w + 0.6), hem - 1.2],
    ['L', -w, -49], ['Q', -(w + 1), -56, -15, -58],
  ], 6);
}

const mitt = (g, x, y, c, sd, chrome) => fabric(g, ellipsePts(x, y, 5.6, 5.3), { c, finish: chrome ? 'chrome' : undefined }, { seed: sd, lw: 2.4, amp: 0.3, shadeAmt: 0.16, sdx: 1.2, sdy: 1.4 });

function drawArm(g, side, P, skinC, chrome, top, sd, t) {
  const s = side < 0 ? P.sL : P.sR, e = side < 0 ? P.eL : P.eR, h = side < 0 ? P.hL : P.hR;
  const wrist = [lerp(e[0], h[0], 0.8), lerp(e[1], h[1], 0.8)];
  if (top && LONG[top.type]) {
    const puff = top.type === 'puffer';
    const c = top.type === 'windbreaker' ? (top.c2 || top.a || '#7b5cff') : top.c;
    const col = top.finish === 'gold' || top.finish === 'chrome' ? finishFill(g, c, top.finish, [-30, -60, 30, -20]) : c;
    tube(g, [s, e, wrist], col, puff ? 13.5 : 10.5, { lw: 2.6, seed: sd, amp: puff ? 0.9 : 0.4 });
    if (puff) {
      const m1 = [lerp(s[0], e[0], 0.55), lerp(s[1], e[1], 0.55)];
      const m2 = [lerp(e[0], wrist[0], 0.5), lerp(e[1], wrist[1], 0.5)];
      for (const m of [m1, m2]) {
        g.strokeStyle = rgba('#1a1236', 0.35);
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(m[0] - 6, m[1] - 1); g.quadraticCurveTo(m[0], m[1] + 2.4, m[0] + 6, m[1] - 1); g.stroke();
      }
    }
    if (top.type === 'jacket') tube(g, [s, e, wrist], top.a || '#fffaf0', 2.6, { lw: 0, seed: sd + 3 });
    const cw = [lerp(e[0], h[0], 0.66), lerp(e[1], h[1], 0.66)];
    tube(g, [cw, wrist], shade(c, 0.25), puff ? 12 : 9.5, { lw: 2.2, seed: sd + 1, amp: 0.3 });
  } else {
    tube(g, [s, e, wrist], chrome ? '#b8bfd2' : skinC, 9.2, { lw: 2.6, seed: sd, amp: 0.4 });
    if (top && (top.type === 'tee')) {
      const end = [lerp(s[0], e[0], 0.78), lerp(s[1], e[1], 0.78)];
      tube(g, [s, end], top.c, 12.6, { lw: 2.6, seed: sd + 2, amp: 0.4 });
    }
  }
  mitt(g, h[0], h[1], skinC, sd + 4, chrome);
}

function pantsPts(bot = -7.5, out = 18, inn = 2.4, waist = -32) {
  return pathPts([
    ['M', -17.6, waist], ['L', 17.6, waist],
    ['L', out, bot], ['L', inn, bot], ['L', 0.6, -21], ['L', -inn, bot], ['L', -out, bot], ['Z'],
  ], 6);
}

function drawLegs(g, P, skinC, chrome, sd) {
  const c = chrome ? '#b8bfd2' : skinC;
  tube(g, [[-8.5, -31], [-9.6, -7]], c, 11, { lw: 2.6, seed: sd, amp: 0.3 });
  tube(g, [[8.5, -31], [9.6, -7]], c, 11, { lw: 2.6, seed: sd + 1, amp: 0.3 });
}

function drawBottom(g, p, sd, t) {
  const c = p.c || '#4a4a5a';
  switch (p.type) {
    case 'trackpants': {
      fabric(g, pantsPts(-7.5, 15.6, 2.6), p, { seed: sd, t, smooth: false, amp: 0.5 });
      const a = p.a || '#fffaf0';
      stroke(g, [[-17, -29], [-15.2, -9]], { lw: 2.4, color: a, amp: 0 });
      stroke(g, [[17, -29], [15.2, -9]], { lw: 2.4, color: a, amp: 0 });
      rrect(g, -16.2, -10.5, 13.6, 4, 2, { fill: shade(c, 0.25), lw: 2, seed: sd + 1 });
      rrect(g, 2.6, -10.5, 13.6, 4, 2, { fill: shade(c, 0.25), lw: 2, seed: sd + 2 });
      break;
    }
    case 'shorts':
      fabric(g, pantsPts(-16, 19.6, 2.6), p, { seed: sd, t, smooth: false, amp: 0.5 });
      stroke(g, [[-19, -22], [-18.5, -17]], { lw: 2.4, color: p.a || '#fffaf0', amp: 0 });
      stroke(g, [[19, -22], [18.5, -17]], { lw: 2.4, color: p.a || '#fffaf0', amp: 0 });
      break;
    case 'jeans': {
      const jc = p.c || '#3e6fd8';
      fabric(g, pantsPts(-7.5, 17.8, 2.4), { ...p, c: jc }, { seed: sd, t, smooth: false, amp: 0.5 });
      rrect(g, -18.2, -11.5, 15.4, 4.6, 1.5, { fill: tint(jc, 0.28), lw: 2, seed: sd + 1 });
      rrect(g, 2.8, -11.5, 15.4, 4.6, 1.5, { fill: tint(jc, 0.28), lw: 2, seed: sd + 2 });
      g.setLineDash([1.6, 1.6]);
      stroke(g, [[-11, -27], [-11.6, -12]], { lw: 1, color: p.a || '#ff9a3c', amp: 0 });
      stroke(g, [[11, -27], [11.6, -12]], { lw: 1, color: p.a || '#ff9a3c', amp: 0 });
      g.setLineDash([]);
      break;
    }
    default: // cargos / pants
      fabric(g, pantsPts(-7.5, 19, 2.4), p, { seed: sd, t, smooth: false, amp: 0.5 });
      rrect(g, -20, -22, 7, 8, 1.5, { fill: shade(c, 0.22), lw: 1.8, seed: sd + 1 });
      rrect(g, 13, -22, 7, 8, 1.5, { fill: shade(c, 0.22), lw: 1.8, seed: sd + 2 });
  }
}

function drawShoe(g, p, side, sd, t, skinC) {
  const fx = side * 10.6;
  g.save();
  g.translate(fx, 0);
  g.rotate(side * 0.06);
  const c = p.c || '#f4efe6', a = p.a || '#d4473f', s = p.s || '#f4efe6';
  switch (p.type) {
    case 'high':
      fabric(g, pathPts([['M', -11, 0], ['L', -11.4, -15], ['Q', 0, -17.4, 11.4, -15], ['L', 11, 0], ['Z']]), p, { seed: sd, t, amp: 0.4 });
      ellipse(g, 0, -15, 10.4, 2.6, { fill: shade(c, 0.2), lw: 2, seed: sd + 1 });
      dot(g, side * -6.4, -9, 2.8, a);
      for (let i = 0; i < 3; i++) stroke(g, [[-3, -13 + i * 3], [3, -13 + i * 3]], { lw: 1.4, color: '#fffaf0', amp: 0 });
      stroke(g, [[-10, -5], [-3, -7.6], [3, -4.8], [10, -7.4]], { lw: 2.2, color: a, amp: 0, smooth: false });
      rrect(g, -12, -3.8, 24, 4.2, 2, { fill: s, lw: 2.2, seed: sd + 2 });
      break;
    case 'boots':
      fabric(g, pathPts([['M', -11.6, 0], ['L', -11.6, -17], ['Q', 0, -19.4, 11.6, -17], ['L', 11.6, 0], ['Z']]), { ...p, c: p.c || '#8a5a2e' }, { seed: sd, t, amp: 0.4 });
      for (let i = 0; i < 3; i++) {
        stroke(g, [[-3.4, -15 + i * 3.6], [3.4, -12.6 + i * 3.6]], { lw: 1.4, color: p.a || '#ffd23f', amp: 0 });
        stroke(g, [[3.4, -15 + i * 3.6], [-3.4, -12.6 + i * 3.6]], { lw: 1.4, color: p.a || '#ffd23f', amp: 0 });
      }
      rrect(g, -12.6, -5, 25.2, 5.6, 1.5, { fill: '#2a2238', lw: 2.2, seed: sd + 2 });
      for (let i = 0; i < 4; i++) g.fillRect(-10 + i * 6, -0.4, 3, 1.2);
      break;
    case 'slides':
      ellipse(g, 0, -4, 8.6, 4.4, { fill: skinC, lw: 2.2, seed: sd + 5 });
      rrect(g, -11.4, -2.8, 22.8, 3.4, 1.6, { fill: p.s || '#f4efe6', lw: 2, seed: sd + 1 });
      fabric(g, pathPts([['M', -9.6, -2.6], ['Q', 0, -11.4, 9.6, -2.6], ['Z']]), p, { seed: sd, t, amp: 0.3, lw: 2.2 });
      emblem(g, p.g || 'drop', 0, -5.4, 0.18, '#fffaf0', sd + 3);
      break;
    default: // low
      fabric(g, pathPts([['M', -11, 0], ['L', -11, -6], ['Q', -10, -11.6, 0, -11.8], ['Q', 10, -11.6, 11, -6], ['L', 11, 0], ['Z']]), p, { seed: sd, t, amp: 0.4 });
      stroke(g, [[-2.6, -10.2], [2.6, -10.2]], { lw: 1.4, color: '#fffaf0', amp: 0 });
      stroke(g, [[-2.2, -8], [2.2, -8]], { lw: 1.4, color: '#fffaf0', amp: 0 });
      stroke(g, [[-10, -4.4], [-3, -6.8], [3, -4.2], [10, -6.6]], { lw: 2.2, color: a, amp: 0, smooth: false });
      rrect(g, -12, -3.6, 24, 4, 2, { fill: s, lw: 2.2, seed: sd + 2 });
  }
  g.restore();
}

function drawBareFeet(g, skinC, sd) {
  ellipse(g, -10.4, -3.6, 8.6, 4.6, { fill: skinC, lw: 2.4, seed: sd, shade: shade(skinC, 0.15), sdx: 1, sdy: 1.2 });
  ellipse(g, 10.4, -3.6, 8.6, 4.6, { fill: skinC, lw: 2.4, seed: sd + 1, shade: shade(skinC, 0.15), sdx: 1, sdy: 1.2 });
}

// ---------------------------------------------------------------- tops (front)

function drawTopBody(g, p, sd, t) {
  const c = p.c || '#8a86a8', a = p.a || '#fffaf0';
  switch (p.type) {
    case 'hoodie': {
      fabric(g, torsoPts(-25.5, 17.6), p, { seed: sd, t });
      rrect(g, -17.6, -29, 35.2, 4.6, 2, { fill: shade(c, 0.25), lw: 2.2, seed: sd + 1 });
      stroke(g, [[-11, -30], [-8, -38], [8, -38], [11, -30]], { lw: 1.6, color: rgba('#140f26', 0.55), amp: 0.2, seed: sd + 2 });
      if (p.g) emblem(g, p.g, 0, -46, 0.5, a === '#fffaf0' ? '#ffd23f' : a, sd + 3);
      // hood around the neck
      fabric(g, pathPts([['M', -21, -61], ['Q', 0, -48, 21, -61], ['Q', 23, -52, 14, -50], ['Q', 0, -44, -14, -50], ['Q', -23, -52, -21, -61]]), { ...p, c: shade(c, 0.12) }, { seed: sd + 4, t });
      stroke(g, [[-4, -51], [-4.6, -42]], { lw: 1.6, color: a, amp: 0.2, seed: sd + 5 });
      stroke(g, [[4, -51], [4.6, -42]], { lw: 1.6, color: a, amp: 0.2, seed: sd + 6 });
      dot(g, -4.6, -41.6, 1.3, a); dot(g, 4.6, -41.6, 1.3, a);
      break;
    }
    case 'jacket': {
      fabric(g, torsoPts(-25.5, 17.6), p, { seed: sd, t });
      stroke(g, [[-14, -55], [-15.6, -27]], { lw: 2.4, color: a, amp: 0 });
      stroke(g, [[14, -55], [15.6, -27]], { lw: 2.4, color: a, amp: 0 });
      stroke(g, [[0, -56], [0, -26]], { lw: 1.8, color: '#c8c8e0', amp: 0 });
      ellipse(g, 0, -50, 1.4, 2.2, { fill: '#c8c8e0', lw: 1.2, amp: 0 });
      rrect(g, -10, -61, 20, 6, 2.5, { fill: shade(c, 0.2), lw: 2.2, seed: sd + 2 });
      break;
    }
    case 'windbreaker': {
      const c2 = p.c2 || p.a || '#7b5cff';
      fabric(g, torsoPts(-25.5, 17.6), p, {
        seed: sd, t,
        inner: (gg) => {
          gg.fillStyle = c2;
          gg.beginPath(); gg.moveTo(-20, -40); gg.lineTo(20, -48); gg.lineTo(20, -40); gg.lineTo(-20, -32); gg.fill();
          gg.fillStyle = '#fffaf0';
          gg.beginPath(); gg.moveTo(-20, -32); gg.lineTo(20, -40); gg.lineTo(20, -37.6); gg.lineTo(-20, -29.6); gg.fill();
        },
      });
      stroke(g, [[0, -56], [0, -26]], { lw: 1.6, color: INK, amp: 0 });
      rrect(g, -10, -61, 20, 6, 2.5, { fill: shade(c, 0.25), lw: 2.2, seed: sd + 2 });
      break;
    }
    case 'puffer': {
      const quilt = (gg, box) => {
        gg.strokeStyle = rgba('#1a1236', 0.33);
        gg.lineWidth = 1.5;
        for (let y = box[1] + 7; y < box[3] - 1; y += 6.5) { gg.beginPath(); gg.moveTo(box[0], y); gg.quadraticCurveTo(0, y + 2.2, box[2], y); gg.stroke(); }
      };
      fabric(g, torsoPts(-24, 20), p, { seed: sd, t, inner: quilt, amp: 1.5 });
      stroke(g, [[0, -57], [0, -25]], { lw: 2, color: p.a || shade(c, 0.4), amp: 0 });
      rrect(g, -12, -63, 24, 8.5, 4, { fill: c, shade: shade(c, 0.25), sdx: 0, sdy: 2, lw: 2.4, seed: sd + 2 });
      break;
    }
    case 'jersey': {
      fabric(g, pathPts([
        ['M', -12, -59], ['Q', 0, -48, 12, -59], ['L', 15.6, -58.6], ['Q', 13, -49, 17.6, -45],
        ['L', 18, -26.6], ['Q', 0, -24.4, -18, -26.6], ['L', -17.6, -45], ['Q', -13, -49, -15.6, -58.6], ['Z'],
      ], 6), p, { seed: sd, t });
      stroke(g, pathPts([['M', -11.6, -58.4], ['Q', 0, -48.6, 11.6, -58.4]]), { lw: 2.6, color: a, amp: 0 });
      stroke(g, pathPts([['M', 15.4, -58], ['Q', 13.2, -49, 17.4, -45.6]]), { lw: 2.6, color: a, amp: 0 });
      stroke(g, pathPts([['M', -15.4, -58], ['Q', -13.2, -49, -17.4, -45.6]]), { lw: 2.6, color: a, amp: 0 });
      text(g, String(p.num ?? '00'), 0, -33, { size: 13, font: FONTS.sign, fill: a, lw: 2.4 });
      break;
    }
    default: { // tee
      const pp = p.dye && !p.p ? { ...p, p: 'tiedye', p2: p.dye } : p;
      fabric(g, torsoPts(-25.8, 17.5), pp, { seed: sd, t });
      stroke(g, pathPts([['M', -7, -58.6], ['Q', 0, -54.6, 7, -58.6]]), { lw: 1.8, color: shade(c, 0.4), amp: 0 });
      if (p.g) emblem(g, p.g, 0, -43, 0.56, a === '#fffaf0' ? '#d4473f' : a, sd + 2);
    }
  }
}

// ---------------------------------------------------------------- neck (front)

function drawNeck(g, p, sd, t) {
  const c = p.c || '#ffd23f';
  switch (p.type) {
    case 'rope': {
      const pts = pathPts([['M', -13.5, -57.5], ['Q', 0, -35, 13.5, -57.5]], 9);
      for (let i = 0; i < pts.length; i++) {
        ellipse(g, pts[i][0], pts[i][1], 2.8, 1.8, { fill: i % 2 ? tint(c, 0.15) : shade(c, 0.15), lw: 1.4, rot: 0.8 + (i % 2) * 0.9, seed: sd + i, amp: 0.1 });
      }
      fabric(g, ellipsePts(0, -40.5, 6.8, 6.8), { ...p, c, finish: p.finish || 'gold' }, { seed: sd + 30, t, lw: 2.2 });
      emblem(g, p.g || 'drop', 0, -40.5, 0.3, shade(c, 0.45), sd + 31);
      break;
    }
    case 'pendant':
      stroke(g, pathPts([['M', -11, -57.5], ['Q', 0, -43, 11, -57.5]]), { lw: 1.3, color: '#2a2238', amp: 0 });
      fabric(g, dropPts(0, -45.4, 3.6, 1.6), { ...p, c: p.c || '#c8c8e0' }, { seed: sd + 2, t, lw: 1.8 });
      break;
    case 'scarf': {
      const a = p.a || '#fffaf0';
      const stripes = (gg, box) => { gg.fillStyle = a; for (let y = box[1] + 2.5; y < box[3]; y += 5.5) gg.fillRect(box[0], y, box[2] - box[0], 1.8); };
      fabric(g, pathPts([['M', -10, -55], ['L', -4.6, -55], ['L', -6.4, -37], ['L', -12.6, -37.6], ['Z']]), p, { seed: sd + 1, t, inner: stripes, smooth: false, lw: 2.2 });
      for (let i = 0; i < 3; i++) stroke(g, [[-11.6 + i * 2.2, -37.4], [-11.8 + i * 2.2, -34.6]], { lw: 1.2, color: c, amp: 0 });
      fabric(g, pathPts([['M', -17, -62], ['Q', 0, -55, 17, -62], ['L', 16.6, -53.6], ['Q', 0, -47, -16.6, -53.6], ['Z']]), p, { seed: sd, t, inner: stripes, lw: 2.4 });
      break;
    }
    default: { // chain
      const pts = pathPts([['M', -12.5, -57.5], ['Q', 0, -40, 12.5, -57.5]], 11);
      for (let i = 0; i < pts.length; i++) ellipse(g, pts[i][0], pts[i][1], 1.9, 1.3, { fill: i % 2 ? c : shade(c, 0.15), lw: 1.1, rot: i * 0.9, seed: sd + i, amp: 0.1 });
      fabric(g, ellipsePts(0, -45.6, 4.3, 4.3), { ...p, c, finish: p.finish || 'gold' }, { seed: sd + 30, t, lw: 1.8 });
      emblem(g, p.g || 'token', 0, -45.6, 0.2, p.g ? shade(c, 0.45) : c, sd + 31);
    }
  }
}

// ---------------------------------------------------------------- face items

function drawFaceItem(g, p, m, sd, t) {
  const c = p.c || '#140f26', a = p.a || '#3ec7b0';
  const ex = m.w * 0.38, ey = m.eyeY, cx = m.cx;
  switch (p.type) {
    case 'bandana': {
      const ba = p.a || '#fffaf0';
      fabric(g, [[cx - m.w * 0.96, m.mouthY - 7.5], [cx + m.w * 0.96, m.mouthY - 7.5], [cx + m.w * 0.5, m.bottom - 1], [cx, m.bottom + 8], [cx - m.w * 0.5, m.bottom - 1]], { ...p, c: p.c || '#d4473f' }, {
        seed: sd, t, amp: 0.5,
        inner: (gg) => {
          gg.fillStyle = ba;
          const r = mulberry32(sd);
          for (let i = 0; i < 12; i++) {
            const x = cx - m.w * 0.8 + r() * m.w * 1.6, y = m.mouthY - 6 + r() * 16;
            gg.beginPath(); gg.ellipse(x, y, 1.8, 1.1, r() * 3, 0, TAU); gg.fill();
          }
        },
      });
      stroke(g, [[cx - m.w * 0.9, m.mouthY - 5.4], [cx + m.w * 0.9, m.mouthY - 5.4]], { lw: 1.2, color: ba, amp: 0 });
      break;
    }
    case 'visor': {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(cx, ey, 2, cx, ey, m.w * 1.6);
      gr.addColorStop(0, rgba(p.a || '#3ef0d8', 0.32));
      gr.addColorStop(1, rgba(p.a || '#3ef0d8', 0));
      g.fillStyle = gr;
      g.fillRect(cx - m.w * 1.7, ey - m.w, m.w * 3.4, m.w * 2);
      g.restore();
      fabric(g, pathPts([['M', cx - m.w - 2, ey - 6], ['C', cx - m.w * 0.4, ey - 9.4, cx + m.w * 0.4, ey - 9.4, cx + m.w + 2, ey - 6], ['L', cx + m.w + 1, ey + 5], ['C', cx + m.w * 0.4, ey + 2.4, cx - m.w * 0.4, ey + 2.4, cx - m.w - 1, ey + 5], ['Z']]), p, {
        seed: sd, t, color: p.a || '#3ef0d8', line: p.c || '#2a2238', lw: 2.8, shadeAmt: 0.1,
        inner: (gg, box) => {
          gg.fillStyle = 'rgba(255,255,255,0.2)';
          for (let y = box[1] + 2; y < box[3]; y += 2.6) gg.fillRect(box[0], y, box[2] - box[0], 0.8);
          gg.fillStyle = 'rgba(255,255,255,0.6)';
          gg.beginPath(); gg.ellipse(cx - m.w * 0.4, ey - 4.4, m.w * 0.42, 1.4, -0.05, 0, TAU); gg.fill();
        },
      });
      break;
    }
    case 'goggles': {
      rrect(g, cx - m.w - 1.4, ey - 3, (m.w + 1.4) * 2, 5.6, 2.6, { fill: shade(p.c || '#ff8a3d', 0.2), lw: 2.2, seed: sd });
      for (const s of [-1, 1]) {
        ellipse(g, cx + s * ex * 1.05, ey, 10.4, 9.2, { fill: p.c || '#ff8a3d', lw: 2.6, seed: sd + 2 + s, shade: shade(p.c || '#ff8a3d', 0.25), sdx: 1.4, sdy: 1.4 });
        fabric(g, ellipsePts(cx + s * ex * 1.05, ey, 7.6, 6.6), p, {
          seed: sd + 5 + s, t, color: p.a || '#7b5cff', lw: 1.8, shadeAmt: 0.1,
          inner: (gg, box) => {
            const gr = gg.createLinearGradient(box[0], box[1], box[2], box[3]);
            gr.addColorStop(0, 'rgba(255,255,255,0.55)');
            gr.addColorStop(0.5, 'rgba(255,255,255,0)');
            gr.addColorStop(1, 'rgba(255,79,154,0.35)');
            gg.fillStyle = gr;
            gg.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
          },
        });
      }
      break;
    }
    case 'grill': {
      const my = m.mouthY + 0.6;
      blob(g, [['M', cx - 9.6, my - 3.2], ['Q', cx, my - 5.6, cx + 9.6, my - 3.2], ['Q', cx + 8, my + 6.6, cx, my + 6.8], ['Q', cx - 8, my + 6.6, cx - 9.6, my - 3.2], ['Z']], { fill: '#5a1a3a', lw: 2.2, amp: 0, seed: sd });
      const gp = { ...p, c: p.c || '#ffd23f', finish: p.finish || 'gold' };
      for (let i = 0; i < 6; i++) {
        const x = cx - 7.5 + i * 3;
        fabric(g, rrectPts(x - 1.4, my - 3.6 + Math.abs(i - 2.5) * 0.25, 2.8, 4.2, 0.8), gp, { seed: sd + 1 + i, t, lw: 1, shadeAmt: 0.12, amp: 0 });
        fabric(g, rrectPts(x - 1.3, my + 1.4, 2.6, 3.4, 0.8), gp, { seed: sd + 10 + i, t, lw: 1, shadeAmt: 0.12, amp: 0 });
      }
      dot(g, cx - 1.5, my - 1.4, 1.1, p.a || '#7ef7ff');
      dot(g, cx + 4.5, my - 1.2, 1.1, p.a || '#7ef7ff');
      break;
    }
    default: { // shades
      const style = p.style || 'round';
      const lens = (pts, k, smooth = true) => fabric(g, pts, p, { seed: sd + k, t, color: a, line: c, lw: 2.4, shadeAmt: 0.1, smooth, amp: 0.3 });
      stroke(g, [[cx - ex - 6, ey - 2], [cx - m.w - 0.6, ey - 3.4]], { lw: 2.2, color: c, amp: 0 });
      stroke(g, [[cx + ex + 6, ey - 2], [cx + m.w + 0.6, ey - 3.4]], { lw: 2.2, color: c, amp: 0 });
      if (style === 'shield') {
        lens(pathPts([['M', cx - m.w * 0.86, ey - 5.6], ['C', cx - 6, ey - 7.6, cx + 6, ey - 7.6, cx + m.w * 0.86, ey - 5.6], ['C', cx + m.w * 0.84, ey + 4.6, cx + 6, ey + 6.4, cx + 2, ey + 3.2], ['L', cx, ey + 1.4], ['L', cx - 2, ey + 3.2], ['C', cx - 6, ey + 6.4, cx - m.w * 0.84, ey + 4.6, cx - m.w * 0.86, ey - 5.6], ['Z']]), 0);
      } else {
        for (const s of [-1, 1]) {
          const lx = cx + s * ex;
          let pts;
          if (style === 'star') pts = starPts(lx, ey, 8.6, 4);
          else if (style === 'heart') pts = heartPts(lx, ey + 0.4, 6.4);
          else pts = ellipsePts(lx, ey, 7.2, 6.2);
          lens(pts, s > 0 ? 1 : 0, style !== 'star');
        }
        stroke(g, [[cx - ex + 6, ey - 1.6], [cx + ex - 6, ey - 1.6]], { lw: 2.2, color: c, amp: 0 });
      }
      stroke(g, [[cx - ex - 3.4, ey - 2.4], [cx - ex - 0.6, ey + 0.8]], { lw: 1.6, color: 'rgba(255,255,255,0.8)', amp: 0 });
      stroke(g, [[cx + ex - 3.4, ey - 2.4], [cx + ex - 0.6, ey + 0.8]], { lw: 1.6, color: 'rgba(255,255,255,0.8)', amp: 0 });
    }
  }
}

// ---------------------------------------------------------------- head items

function drawHeadItemBehind(g, p, m, sd, t) {
  if (p.type === 'durag') {
    const c = p.c || '#7b5cff';
    const wave = Math.sin(t * 3) * 2;
    tube(g, pathPts([['M', m.cx + m.w - 6, m.cy + 4], ['C', m.cx + m.w + 2, m.cy + 16, m.cx + m.w + 8 + wave, m.cy + 26, m.cx + m.w + 4 + wave, m.cy + 36]]), shade(c, 0.15), 6.4, { lw: 2.4, seed: sd });
    tube(g, pathPts([['M', m.cx - m.w + 6, m.cy + 4], ['C', m.cx - m.w - 2, m.cy + 16, m.cx - m.w - 8 - wave, m.cy + 26, m.cx - m.w - 4 - wave, m.cy + 36]]), shade(c, 0.22), 6.4, { lw: 2.4, seed: sd + 1 });
  }
}

function drawHeadItem(g, p, m, sd, t) {
  const c = p.c || '#3ec7b0', a = p.a || shade(c, 0.35);
  const w = m.w + 1.6, by = m.brimY + 1, top = m.top - 1.4, cx = m.cx;
  switch (p.type) {
    case 'beanie': {
      const btop = top - 3;
      fabric(g, pathPts([['M', cx - w, by + 1], ['C', cx - w - 1.6, btop + 6, cx - w * 0.5, btop, cx, btop], ['C', cx + w * 0.5, btop, cx + w + 1.6, btop + 6, cx + w, by + 1], ['Z']]), p, {
        seed: sd, t,
        inner: (gg, box) => {
          gg.strokeStyle = rgba('#140f26', 0.28);
          gg.lineWidth = 1.2;
          for (let x = box[0] + 4; x < box[2]; x += 4.2) { gg.beginPath(); gg.moveTo(x, box[1]); gg.lineTo(x, box[3]); gg.stroke(); }
        },
      });
      fabric(g, rrectPts(cx - w - 1.6, by - 2.6, (w + 1.6) * 2, 8, 3), { ...p, c: a, p: undefined }, { seed: sd + 1, t, lw: 2.4 });
      ellipse(g, cx, btop - 3, 5.8, 5.2, { fill: tint(c, 0.3), lw: 2.4, seed: sd + 2, amp: 1.2 });
      break;
    }
    case 'bucket': {
      const pp = p.p ? p : { ...p, p: 'check', p2: p.a || '#fffaf0' };
      fabric(g, pathPts([['M', cx - w + 2.6, by + 1], ['C', cx - w + 0.6, top + 5, cx - w * 0.4, top + 1.4, cx, top + 1.4], ['C', cx + w * 0.4, top + 1.4, cx + w - 0.6, top + 5, cx + w - 2.6, by + 1], ['Z']]), pp, { seed: sd, t });
      fabric(g, pathPts([['M', cx - w - 9, by + 3.4], ['Q', cx, by - 7, cx + w + 9, by + 3.4], ['Q', cx + w + 4, by + 9, cx, by + 8.6], ['Q', cx - w - 4, by + 9, cx - w - 9, by + 3.4], ['Z']]), pp, { seed: sd + 1, t });
      rrect(g, cx - w + 2, by - 2.4, (w - 2) * 2, 3, 1.2, { fill: INK, lw: 0, seed: sd + 2 });
      break;
    }
    case 'fedora': {
      const fc = p.c || '#3a3456';
      fabric(g, pathPts([['M', cx - w - 11, by + 2.6], ['Q', cx, by - 7, cx + w + 11, by + 2.6], ['Q', cx, by + 9, cx - w - 11, by + 2.6], ['Z']]), { ...p, c: shade(fc, 0.12) }, { seed: sd, t });
      fabric(g, pathPts([['M', cx - w + 3, by + 1], ['C', cx - w + 1, top + 4, cx - w * 0.45, top - 1, cx - 5, top + 0.6], ['Q', cx, top + 5, cx + 5, top + 0.6], ['C', cx + w * 0.45, top - 1, cx + w - 1, top + 4, cx + w - 3, by + 1], ['Z']]), { ...p, c: fc }, { seed: sd + 1, t });
      fabric(g, rrectPts(cx - w + 2.6, by - 4.6, (w - 2.6) * 2, 4.8, 1.6), { c: p.a || '#ff4f9a' }, { seed: sd + 2, t, lw: 2 });
      break;
    }
    case 'crown': {
      const cc = p.c || '#ffd23f';
      const bw = w * 0.86, base = by - 3, peak = top - 12;
      const pts = [[cx - bw, base + 6], [cx - bw - 2, peak + 6], [cx - bw * 0.52, base - 6], [cx - bw * 0.26, peak], [cx, base - 7], [cx + bw * 0.26, peak], [cx + bw * 0.52, base - 6], [cx + bw + 2, peak + 6], [cx + bw, base + 6]];
      fabric(g, pts, { ...p, c: cc, finish: p.finish || 'gold' }, { seed: sd, t, smooth: false, amp: 0.4, lw: 2.6 });
      fabric(g, rrectPts(cx - bw - 1, base, (bw + 1) * 2, 6.4, 1.6), { ...p, c: shade(cc, 0.1), finish: p.finish || 'gold', p: undefined }, { seed: sd + 1, t, lw: 2.2 });
      const gem = p.a || '#ff4f9a';
      for (const [x, y, r] of [[cx - bw - 2, peak + 5, 2.4], [cx - bw * 0.26, peak - 1, 2.6], [cx + bw * 0.26, peak - 1, 2.6], [cx + bw + 2, peak + 5, 2.4], [cx, base + 3.2, 2.6]]) {
        ellipse(g, x, y, r, r, { fill: gem, lw: 1.4, seed: sd + Math.round(x * 3) });
        dot(g, x - r * 0.3, y - r * 0.35, r * 0.32, 'rgba(255,255,255,0.85)');
      }
      break;
    }
    case 'headphones': {
      const hc = p.c || '#3ec7b0';
      tube(g, pathPts([['M', cx - m.w - 1.6, m.eyeY - 3], ['C', cx - m.w - 2, top - 7, cx + m.w + 2, top - 7, cx + m.w + 1.6, m.eyeY - 3]]), hc, 4.4, { lw: 2.4, seed: sd });
      for (const s of [-1, 1]) {
        fabric(g, rrectPts(cx + s * (m.w + 1.6) - 5, m.eyeY - 9.6, 10, 18, 4.6), { ...p, c: hc }, { seed: sd + 2 + s, t, lw: 2.4 });
        rrect(g, cx + s * (m.w + 1.6) - (s > 0 ? 6.4 : -3.2), m.eyeY - 7, 3.2, 13, 1.6, { fill: p.a || '#2a2238', lw: 1.4, seed: sd + 6 + s });
      }
      break;
    }
    case 'durag': {
      const dc = p.c || '#7b5cff';
      fabric(g, pathPts([['M', cx - w, by + 4], ['C', cx - w - 1.6, top + 4, cx - w * 0.5, top - 1, cx, top - 1], ['C', cx + w * 0.5, top - 1, cx + w + 1.6, top + 4, cx + w, by + 4], ['Q', cx, by + 0.4, cx - w, by + 4], ['Z']]), { ...p, c: dc }, {
        seed: sd, t,
        inner: (gg) => {
          gg.strokeStyle = 'rgba(255,255,255,0.42)';
          gg.lineWidth = 2.6;
          gg.beginPath(); gg.moveTo(cx - w * 0.6, by - 6); gg.quadraticCurveTo(cx - w * 0.3, top + 4, cx + w * 0.2, top + 3); gg.stroke();
        },
      });
      stroke(g, pathPts([['M', cx, top], ['Q', cx + 1, (top + by) / 2, cx, by + 1.6]]), { lw: 1.4, color: p.a || tint(dc, 0.4), amp: 0 });
      break;
    }
    case 'halo': {
      const hc = p.c || '#fff2a8';
      const hy = top - 9 + Math.sin(t * 2.2) * 1.6;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(cx, hy, 2, cx, hy, 28);
      gr.addColorStop(0, rgba(hc, 0.55));
      gr.addColorStop(1, rgba(hc, 0));
      g.fillStyle = gr;
      g.fillRect(cx - 30, hy - 22, 60, 44);
      g.restore();
      g.lineWidth = 6.4;
      g.strokeStyle = INK;
      g.beginPath(); g.ellipse(cx, hy, 16, 4.6, 0, 0, TAU); g.stroke();
      g.lineWidth = 3.6;
      g.strokeStyle = finishFill(g, hc, p.finish || 'gold', [cx - 16, hy - 5, cx + 16, hy + 5]);
      g.beginPath(); g.ellipse(cx, hy, 16, 4.6, 0, 0, TAU); g.stroke();
      if (p.prismatic) {
        g.lineWidth = 2;
        g.strokeStyle = `hsl(${(t * 120) % 360},100%,72%)`;
        g.beginPath(); g.ellipse(cx, hy, 16, 4.6, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
      const tw = (Math.sin(t * 4) + 1) / 2;
      twinkle(g, cx - 17, hy - 5, 2 + tw * 2, '#fffaf0');
      twinkle(g, cx + 15, hy + 4, 1.6 + (1 - tw) * 2, '#fffaf0');
      break;
    }
    default: { // cap
      fabric(g, pathPts([['M', cx - w, by], ['C', cx - w - 1, top + 2.4, cx + w + 1, top + 2.4, cx + w, by], ['Q', cx, by + 2.4, cx - w, by], ['Z']]), p, { seed: sd, t });
      stroke(g, pathPts([['M', cx, top + 1.6], ['Q', cx + 1, (top + by) / 2, cx, by + 1]]), { lw: 1.4, color: rgba('#140f26', 0.42), amp: 0 });
      dot(g, cx, top + 1.6, 2, a);
      if (p.g) emblem(g, p.g, cx, by - 7.5, 0.4, p.a || '#fffaf0', sd + 3);
      fabric(g, pathPts([['M', cx - w * 0.98, by - 1.4], ['Q', cx, by + 15.6, cx + w * 0.98, by - 1.4], ['Q', cx, by + 4, cx - w * 0.98, by - 1.4], ['Z']]), { ...p, c: a, p: undefined }, { seed: sd + 2, t, lw: 2.4 });
    }
  }
}

// ---------------------------------------------------------------- hand items (front)

function drawHandItem(g, p, P, sd, t, skinC, chrome) {
  const [hx, hy] = P.hR;
  switch (p.type) {
    case 'deck': {
      const c = p.c || '#ff4f9a', a = p.a || '#ffd23f';
      g.save();
      g.translate(hx + 7, hy - 3);
      g.rotate(0.08);
      for (const yy of [-24, 24]) for (const xx of [-7.6, 7.6]) ellipse(g, xx, yy, 2.6, 2.6, { fill: a, lw: 1.6, seed: sd + yy + xx });
      fabric(g, rrectPts(-5.6, -30, 11.2, 60, 5.6), { ...p, c }, { seed: sd, t, lw: 2.4 });
      emblem(g, p.g || 'drop', 0, -6, 0.32, '#fffaf0', sd + 1);
      g.restore();
      mitt(g, hx, hy, skinC, sd + 9, chrome);
      break;
    }
    case 'boombox': {
      const c = p.c || '#d4473f', a = p.a || '#3ec7b0';
      const bx = hx + 6, by = hy - 10;
      stroke(g, pathPts([['M', bx - 11, by - 9], ['Q', bx, by - 17, bx + 11, by - 9]]), { lw: 2.6, color: '#c8c8e0', amp: 0 });
      fabric(g, rrectPts(bx - 17, by - 9.6, 34, 19.2, 3.6), { ...p, c }, { seed: sd, t, lw: 2.4 });
      for (const s of [-1, 1]) {
        ellipse(g, bx + s * 9.6, by + 1.4, 5.6, 5.6, { fill: '#2a2238', lw: 1.6, seed: sd + 2 + s });
        dot(g, bx + s * 9.6, by + 1.4, 2 + Math.max(0, Math.sin(t * 9.4)) * 0.8, '#5a5276');
      }
      rrect(g, bx - 3.6, by - 6, 7.2, 4.6, 1, { fill: a, lw: 1.2, seed: sd + 5 });
      mitt(g, hx, hy, skinC, sd + 9, chrome);
      break;
    }
    case 'spraycan': {
      g.save();
      g.translate(hx + 1, hy - 8);
      g.rotate(-0.18);
      sprayCanShape(g, 0, 0, 0.55, p, sd, t);
      g.restore();
      if (Math.sin(t * 2.3) > 0.7) for (let i = 0; i < 6; i++) dot(g, hx + 3 + i * 2.2, hy - 24 - i * 1.4 + Math.sin(t * 20 + i) * 0.8, 0.9 + (i % 2) * 0.5, rgba(p.c || '#ff4f9a', 0.65));
      mitt(g, hx, hy, skinC, sd + 9, chrome);
      break;
    }
    case 'lantern': {
      const c = p.c || '#9affe0';
      const lx = hx + 1, ly = hy + 7;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(lx, ly, 2, lx, ly, 30);
      gr.addColorStop(0, rgba(c, 0.5 + Math.sin(t * 6) * 0.06));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(lx - 32, ly - 32, 64, 64);
      g.restore();
      stroke(g, pathPts([['M', lx - 4, ly - 8], ['Q', lx, ly - 13, lx + 4, ly - 8]]), { lw: 1.6, color: '#3a3456', amp: 0 });
      rrect(g, lx - 6.4, ly - 8.6, 12.8, 3, 1, { fill: '#3a3456', lw: 1.6, seed: sd });
      fabric(g, rrectPts(lx - 5.6, ly - 6, 11.2, 14, 2.4), { ...p, c: mix(c, '#ffffff', 0.3) }, { seed: sd + 1, t, lw: 1.8, shadeAmt: 0.08 });
      dot(g, lx, ly + 1, 2.2, '#fffbe0');
      rrect(g, lx - 6.4, ly + 7.6, 12.8, 3, 1, { fill: '#3a3456', lw: 1.6, seed: sd + 2 });
      mitt(g, hx, hy, skinC, sd + 9, chrome);
      break;
    }
    default: break;
  }
}

function drawBag(g, p, sd, t) {
  const c = p.c || '#1d1830', a = p.a || '#d4473f';
  stroke(g, [[-13, -57], [12, -31]], { lw: 4.6, color: INK, amp: 0 });
  stroke(g, [[-13, -57], [12, -31]], { lw: 2.6, color: shade(c, 0.1), amp: 0 });
  fabric(g, rrectPts(-3, -41, 18, 12.6, 3.4), { ...p, c }, { seed: sd, t, lw: 2.2 });
  stroke(g, [[-1, -37.6], [13, -37.6]], { lw: 1.4, color: a, amp: 0 });
  emblem(g, p.g || 'drop', 6, -32.6, 0.17, a, sd + 2);
}

// ---------------------------------------------------------------- auras

function drawAura(g, p, t, sd) {
  const c = p.c;
  const cy = -50;
  g.save();
  switch (p.type) {
    case 'flame': {
      const oc = c || '#ff6a2a', ic = p.a || '#ffd23f';
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, cy + 10, 6, 0, cy + 10, 70);
      gr.addColorStop(0, rgba(oc, 0.35));
      gr.addColorStop(1, rgba(oc, 0));
      g.fillStyle = gr;
      g.fillRect(-75, cy - 70, 150, 140);
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 11; i++) {
        const fx = (i / 10 - 0.5) * 70;
        const base = 2 - Math.abs(fx) * 0.25;
        const h = 44 + Math.sin(t * 7 + i * 1.7) * 9 + (i % 3) * 10 - Math.abs(fx) * 0.3;
        g.globalAlpha = 0.92;
        g.fillStyle = oc;
        g.fill(flamePath(fx, base, 18, h, sd + i, t * 9 + i));
        g.fillStyle = ic;
        g.fill(flamePath(fx, base, 9, h * 0.55, sd + i + 30, t * 9 + i + 1.3));
      }
      break;
    }
    case 'ghostglow': {
      const gc = c || '#9affe0';
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, cy, 8, 0, cy, 72);
      gr.addColorStop(0, rgba(gc, 0.42));
      gr.addColorStop(1, rgba(gc, 0));
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(0, cy, 66, 76, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 5; i++) {
        const k = ((t * 0.4 + i / 5) % 1);
        const x = -40 + i * 20 + Math.sin(t * 2 + i) * 5;
        const y = 4 - k * 120;
        g.strokeStyle = rgba(gc, 0.7 * (1 - k));
        g.lineWidth = 3.4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x - 7, y - 10, x + 7, y - 20, x, y - 30);
        g.stroke();
      }
      break;
    }
    case 'moneyrain': {
      for (let i = 0; i < 10; i++) {
        const r = mulberry32(sd + i * 31);
        const x = -62 + r() * 124;
        if (Math.abs(x) < 18) continue;
        const sp = 40 + r() * 30;
        const y = -150 + (((t * sp + r() * 160) % 160));
        const spin = Math.cos(t * 5 + i);
        g.save();
        g.translate(x, y);
        g.scale(Math.max(0.18, Math.abs(spin)), 1);
        emblem(g, 'token', 0, 0, 0.44, '#ffd23f', sd + i);
        g.restore();
        if (i % 3 === 0) twinkle(g, x + 6, y - 6, 1.8, '#fff6c8');
      }
      break;
    }
    case 'rainbow': {
      const cols = ['#ff4f6f', '#ff9a3d', '#ffd23f', '#7ed957', '#3ec7ff', '#9a6bff'];
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, cy - 10, 10, 0, cy - 10, 70);
      gr.addColorStop(0, `hsla(${(t * 60) % 360},100%,70%,0.3)`);
      gr.addColorStop(1, 'hsla(0,100%,70%,0)');
      g.fillStyle = gr;
      g.fillRect(-72, cy - 80, 144, 150);
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      cols.forEach((col, i) => {
        g.strokeStyle = INK;
        g.lineWidth = 7.4;
        g.beginPath(); g.arc(0, -16, 62 - i * 6, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
      });
      cols.forEach((col, i) => {
        g.strokeStyle = col;
        g.lineWidth = 5;
        g.beginPath(); g.arc(0, -16, 62 - i * 6, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (1.15 + ((t * 0.2 + i / 3) % 1) * 0.7);
        twinkle(g, Math.cos(a) * 60, -16 + Math.sin(a) * 60, 3.2, '#ffffff');
      }
      break;
    }
    case 'lightning': {
      const lc = c || '#7ef7ff';
      g.globalCompositeOperation = 'lighter';
      const flash = Math.sin(t * 13) > 0.2 || Math.sin(t * 7.3) > 0.7;
      const gr = g.createRadialGradient(0, cy, 8, 0, cy, 70);
      gr.addColorStop(0, rgba(lc, flash ? 0.35 : 0.15));
      gr.addColorStop(1, rgba(lc, 0));
      g.fillStyle = gr;
      g.fillRect(-75, cy - 75, 150, 150);
      const frame = Math.floor(t * 9);
      const r = mulberry32(sd + frame * 13);
      for (let b = 0; b < 4; b++) {
        if (!flash && b > 1) continue;
        const side = b % 2 ? 1 : -1;
        let x = side * (30 + r() * 18), y = -110 + r() * 30;
        g.strokeStyle = rgba(lc, 0.95);
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (r() - 0.5) * 16 + side * 2;
          y += 12 + r() * 6;
          g.lineTo(x, y);
        }
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 1;
        g.stroke();
      }
      break;
    }
    default: { // sparkle
      const sc = c || '#ffd23f';
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, cy, 10, 0, cy, 66);
      gr.addColorStop(0, rgba(sc, 0.25));
      gr.addColorStop(1, rgba(sc, 0));
      g.fillStyle = gr;
      g.fillRect(-70, cy - 70, 140, 140);
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.35;
        const rr = 44 + (i % 3) * 8;
        const x = Math.cos(a) * rr * 0.8, y = cy + Math.sin(a) * rr;
        const tw = Math.max(0, Math.sin(t * 3.4 + i * 1.9));
        if (tw < 0.05) continue;
        twinkle(g, x, y, 1.6 + tw * (i % 2 ? 3.2 : 4.6), i % 2 ? sc : '#fffaf0');
      }
    }
  }
  g.restore();
}

function flamePath(cx, cy, w, h, seed, k) {
  const pts = flamePts(cx, cy, w, h, seed, k);
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------- figure

function prismaticTwinkles(g, t, sd) {
  for (let i = 0; i < 4; i++) {
    const r = mulberry32(sd + i * 17);
    const k = Math.max(0, Math.sin(t * 2.6 + i * 1.7));
    if (k < 0.3) continue;
    const x = -34 + r() * 68, y = -110 + r() * 100;
    twinkle(g, x, y, 1 + k * 3.4, INK);
    twinkle(g, x, y, k * 3, `hsl(${(t * 140 + i * 90) % 360},100%,72%)`);
  }
}

export function drawFigure(g, x, y, opts = {}) {
  const body = { ...DEFAULT_BODY, ...(opts.body || {}) };
  const outfit = opts.outfit || {};
  const t = opts.t || 0;
  const sc = opts.scale || 1;
  const facing = opts.facing || 1;
  const sd = opts.boil ?? 11;
  g.save();
  g.translate(x, y);
  g.scale(facing * sc, sc);
  if (opts.view === 'side') drawSide(g, body, outfit, opts, t, sd);
  else drawFront(g, body, outfit, opts, t, sd);
  g.restore();
}

function drawFront(g, body, outfit, opts, t, sd) {
  const skinC = skinColor(body.skin), chrome = isChrome(body.skin);
  const hand = outfit.hand;
  const P = frontPose(opts.pose || 'idle', t, hand && hand.type);
  const m = headM(body.head);
  // shadow
  g.fillStyle = 'rgba(10,6,24,0.32)';
  g.beginPath(); g.ellipse(0, 0.5, 27, 4.6, 0, 0, TAU); g.fill();
  if (outfit.aura) drawAura(g, outfit.aura, t, sd + 900);
  g.translate(0, P.bob + P.hop);
  // lower body
  drawLegs(g, P, skinC, chrome, sd + 10);
  if (outfit.bottom) drawBottom(g, outfit.bottom, sd + 20, t);
  else { // bare vinyl hips
    fabric(g, pathPts([['M', -16.8, -33], ['L', 16.8, -33], ['Q', 17.4, -24, 9, -22], ['L', -9, -22], ['Q', -17.4, -24, -16.8, -33], ['Z']]), { c: skinC, finish: chrome ? 'chrome' : undefined }, { seed: sd + 21, t, lw: 2.6 });
  }
  if (outfit.feet) {
    drawShoe(g, outfit.feet, -1, sd + 30, t, skinC);
    drawShoe(g, outfit.feet, 1, sd + 34, t, skinC);
  } else drawBareFeet(g, skinC, sd + 30);
  // torso
  if (outfit.top) drawTopBody(g, outfit.top, sd + 40, t);
  else fabric(g, torsoPts(-26.8, 17.2), { c: skinC, finish: chrome ? 'chrome' : undefined }, { seed: sd + 40, t });
  drawArm(g, -1, P, skinC, chrome, outfit.top, sd + 60, t);
  drawArm(g, 1, P, skinC, chrome, outfit.top, sd + 70, t);
  if (outfit.neck) drawNeck(g, outfit.neck, sd + 80, t);
  if (hand && hand.type === 'bag') drawBag(g, hand, sd + 90, t);
  // head
  if (outfit.head) drawHeadItemBehind(g, outfit.head, m, sd + 100, t);
  drawHeadShape(g, m, body.skin, sd + 110, t);
  const face = outfit.face;
  drawFace(g, m, body.face, { t, blink: opts.blink, talk: opts.talk, noMouth: face && (face.type === 'grill' || face.type === 'bandana') });
  if (face) drawFaceItem(g, face, m, sd + 120, t);
  if (outfit.head) drawHeadItem(g, outfit.head, m, sd + 130, t);
  if (hand && hand.type !== 'bag') drawHandItem(g, hand, P, sd + 140, t, skinC, chrome);
  if (SLOTS.some((s) => outfit[s] && outfit[s].prismatic)) prismaticTwinkles(g, t, sd + 150);
}

// ---------------------------------------------------------------- side view (runner)

function sideLeg(a, bend) {
  const hip = [0, -30];
  const knee = [hip[0] + Math.sin(a) * 12.5, hip[1] + Math.cos(a) * 12.5];
  const ankle = [knee[0] + Math.sin(a - bend) * 12, knee[1] + Math.cos(a - bend) * 12];
  return [hip, knee, ankle];
}

function sideArm(a, bend) {
  const s = [1, -53];
  const e = [s[0] + Math.sin(a) * 10, s[1] + Math.cos(a) * 10];
  const h = [e[0] + Math.sin(a + bend) * 10, e[1] + Math.cos(a + bend) * 10];
  return [s, e, h];
}

function drawSideShoe(g, p, ankle, sd, t, skinC, dark) {
  const [x, y] = ankle;
  g.save();
  g.translate(x + 2, y + 6.6);
  const tint2 = (col) => (dark ? shade(col, 0.18) : col);
  if (!p) {
    ellipse(g, 2, -2.6, 8.6, 4, { fill: tint2(skinC), lw: 2.2, seed: sd });
    g.restore();
    return;
  }
  const c = tint2(p.c || '#f4efe6'), a = p.a || '#d4473f', s = p.s || '#f4efe6';
  if (p.type === 'slides') {
    ellipse(g, 2, -3, 8.2, 3.4, { fill: tint2(skinC), lw: 2, seed: sd + 3 });
    rrect(g, -7, -1.8, 19, 3, 1.4, { fill: s, lw: 1.8, seed: sd });
    fabric(g, pathPts([['M', -2, -1.6], ['Q', 3, -8, 8, -1.6], ['Z']]), { ...p, c }, { seed: sd + 1, t, lw: 1.8 });
  } else {
    const hh = p.type === 'high' ? 13 : p.type === 'boots' ? 15 : 8;
    fabric(g, pathPts([['M', -7, 0], ['L', -7, -hh], ['Q', -2, -hh - 1.6, 2, -hh + 0.6], ['L', 3, -7], ['Q', 12, -6, 14, -1.4], ['L', 14, 0], ['Z']]), { ...p, c }, { seed: sd, t, lw: 2.2 });
    if (p.type === 'boots') rrect(g, -8, -3.4, 23, 4.6, 1.4, { fill: '#2a2238', lw: 1.8, seed: sd + 1 });
    else {
      stroke(g, [[-5, -3.4], [1, -5.4], [5, -3], [11, -4.4]], { lw: 1.8, color: a, amp: 0, smooth: false });
      rrect(g, -8, -2.6, 23, 3.4, 1.6, { fill: s, lw: 1.8, seed: sd + 1 });
    }
  }
  g.restore();
}

function drawSideHead(g, body, outfit, m, t, sd, opts) {
  const skinC = skinColor(body.skin);
  const head = outfit.head;
  // behind: durag tails flow back
  if (head && head.type === 'durag') {
    const wave = Math.sin(t * 12) * 3;
    tube(g, pathPts([['M', m.cx - m.w + 4, m.cy - 6], ['C', m.cx - m.w - 8, m.cy - 4 + wave, m.cx - m.w - 16, m.cy + 2 - wave, m.cx - m.w - 24, m.cy + wave]]), shade(head.c || '#7b5cff', 0.15), 5.6, { lw: 2.2, seed: sd });
  }
  drawHeadShape(g, m, body.skin, sd + 1, t);
  // ear dot for depth
  ellipse(g, m.cx - 3, m.eyeY + 3, 3.2, 4, { fill: shade(skinC, 0.1), lw: 1.8, seed: sd + 2 });
  // eye on the front side
  const ex = m.cx + m.w * 0.52, ey = m.eyeY;
  const blink = opts.blink;
  switch (body.face) {
    case 'happy': stroke(g, pathPts([['M', ex - 3.4, ey + 1.4], ['Q', ex, ey - 3.6, ex + 3.4, ey + 1.4]]), { lw: 2.4, amp: 0 }); break;
    case 'x': stroke(g, [[ex - 2.6, ey - 2.6], [ex + 2.6, ey + 2.6]], { lw: 2.2, amp: 0 }); stroke(g, [[ex + 2.6, ey - 2.6], [ex - 2.6, ey + 2.6]], { lw: 2.2, amp: 0 }); break;
    case 'wide':
    case 'cyclops':
      if (blink) stroke(g, [[ex - 3.4, ey], [ex + 3.4, ey]], { lw: 2.2, amp: 0 });
      else { ellipse(g, ex, ey, 4.8, 5.4, { fill: '#fffaf0', lw: 2, amp: 0.2, seed: sd + 3 }); dot(g, ex + 1.6, ey + 0.6, 2.6, INK); }
      break;
    case 'cool':
      if (blink) stroke(g, [[ex - 3.4, ey], [ex + 3.4, ey]], { lw: 2.2, amp: 0 });
      else { dot(g, ex + 0.6, ey + 1, 2.7, INK); stroke(g, [[ex - 3.6, ey - 1.6], [ex + 3.8, ey - 1.2]], { lw: 2.2, amp: 0 }); }
      break;
    default:
      if (blink) stroke(g, [[ex - 3, ey], [ex + 3, ey]], { lw: 2.2, amp: 0 });
      else dot(g, ex + 0.6, ey, 2.7, INK);
  }
  const face = outfit.face;
  if (!face || (face.type !== 'bandana' && face.type !== 'grill')) stroke(g, [[m.cx + m.w * 0.5, m.mouthY], [m.cx + m.w * 0.82, m.mouthY - 1.4]], { lw: 2, amp: 0 });
  if (face) {
    const fc = face.c || '#140f26', fa = face.a || '#3ec7b0';
    if (face.type === 'bandana') {
      fabric(g, [[m.cx + m.w * 0.1, m.mouthY - 7], [m.cx + m.w + 2, m.mouthY - 7], [m.cx + m.w * 0.7, m.bottom + 6]], { ...face, c: face.c || '#d4473f' }, { seed: sd + 5, t, lw: 2.2 });
    } else if (face.type === 'visor') {
      fabric(g, rrectPts(m.cx + m.w * 0.15, ey - 5.6, m.w * 0.95, 10.4, 3), face, { seed: sd + 5, t, color: fa === '#3ec7b0' ? '#3ef0d8' : fa, line: fc, lw: 2.4, shadeAmt: 0.1 });
    } else if (face.type === 'goggles') {
      stroke(g, [[m.cx - m.w, ey - 1], [m.cx + m.w * 0.5, ey - 1]], { lw: 4.4, color: shade(face.c || '#ff8a3d', 0.2), amp: 0 });
      ellipse(g, ex + 1.4, ey, 7.4, 6.8, { fill: face.c || '#ff8a3d', lw: 2.2, seed: sd + 6 });
      fabric(g, ellipsePts(ex + 1.4, ey, 5, 4.4), face, { seed: sd + 7, t, color: face.a || '#7b5cff', lw: 1.4, shadeAmt: 0.1 });
    } else if (face.type === 'shades') {
      stroke(g, [[m.cx - 2, ey - 2.4], [ex - 3, ey - 1.6]], { lw: 2, color: fc, amp: 0 });
      const pts = face.style === 'star' ? starPts(ex + 1, ey, 6.6, 3) : face.style === 'heart' ? heartPts(ex + 1, ey + 0.4, 5) : ellipsePts(ex + 1, ey, 5.4, 4.8);
      fabric(g, pts, face, { seed: sd + 6, t, color: fa, line: fc, lw: 2, shadeAmt: 0.1, smooth: face.style !== 'star' });
    }
  }
  if (head) {
    const hc = head.c || '#3ec7b0', ha = head.a || shade(hc, 0.35);
    const w = m.w + 1.4, by = m.brimY + 1, top = m.top - 1.2, cx = m.cx;
    switch (head.type) {
      case 'beanie':
        fabric(g, pathPts([['M', cx - w, by + 1], ['C', cx - w, top - 2, cx + w, top - 2, cx + w, by + 1], ['Z']]), head, { seed: sd + 10, t });
        fabric(g, rrectPts(cx - w - 1, by - 2.4, (w + 1) * 2, 7, 3), { ...head, c: ha, p: undefined }, { seed: sd + 11, t, lw: 2.2 });
        ellipse(g, cx - 3, top - 5, 5, 4.6, { fill: tint(hc, 0.3), lw: 2.2, seed: sd + 12, amp: 1 });
        break;
      case 'bucket': {
        const pp = head.p ? head : { ...head, p: 'check', p2: head.a || '#fffaf0' };
        fabric(g, pathPts([['M', cx - w + 3, by + 1], ['C', cx - w + 2, top + 2, cx + w - 2, top + 2, cx + w - 3, by + 1], ['Z']]), pp, { seed: sd + 10, t });
        fabric(g, pathPts([['M', cx - w - 8, by + 6], ['Q', cx, by - 3, cx + w + 8, by + 6], ['Q', cx, by + 3, cx - w - 8, by + 6], ['Z']]), pp, { seed: sd + 11, t });
        break;
      }
      case 'fedora':
        fabric(g, pathPts([['M', cx - w - 9, by + 2], ['L', cx + w + 9, by + 2], ['L', cx + w + 8, by + 5], ['L', cx - w - 8, by + 5], ['Z']]), { ...head, c: shade(head.c || '#3a3456', 0.12) }, { seed: sd + 10, t, smooth: false });
        fabric(g, pathPts([['M', cx - w + 3, by + 2], ['C', cx - w + 2, top, cx + w - 2, top, cx + w - 3, by + 2], ['Z']]), { ...head, c: head.c || '#3a3456' }, { seed: sd + 11, t });
        rrect(g, cx - w + 3, by - 3.6, (w - 3) * 2, 4, 1.2, { fill: head.a || '#ff4f9a', lw: 1.8, seed: sd + 12 });
        break;
      case 'crown': {
        const bw = w * 0.8, base = by - 3, peak = top - 10;
        fabric(g, [[cx - bw, base + 5], [cx - bw - 1, peak + 4], [cx - bw * 0.4, base - 5], [cx, peak], [cx + bw * 0.4, base - 5], [cx + bw + 1, peak + 4], [cx + bw, base + 5]], { ...head, c: head.c || '#ffd23f', finish: head.finish || 'gold' }, { seed: sd + 10, t, smooth: false, lw: 2.2 });
        break;
      }
      case 'headphones':
        tube(g, pathPts([['M', cx - 3, m.eyeY - 2], ['C', cx - 5, top - 5, cx + 4, top - 6, cx + 3, top + 1]]), hc, 4, { lw: 2.2, seed: sd + 10 });
        fabric(g, ellipsePts(cx - 3, m.eyeY + 2, 6.6, 8.4), head, { seed: sd + 11, t, lw: 2.2 });
        break;
      case 'durag':
        fabric(g, pathPts([['M', cx - w, by + 4], ['C', cx - w, top - 2, cx + w, top - 2, cx + w, by + 4], ['Z']]), { ...head, c: head.c || '#7b5cff' }, { seed: sd + 10, t });
        break;
      case 'halo': {
        const hy = top - 9;
        g.lineWidth = 5.6; g.strokeStyle = INK;
        g.beginPath(); g.ellipse(cx, hy, 13, 3.8, 0, 0, TAU); g.stroke();
        g.lineWidth = 3.2; g.strokeStyle = head.c || '#fff2a8';
        g.beginPath(); g.ellipse(cx, hy, 13, 3.8, 0, 0, TAU); g.stroke();
        break;
      }
      default: // cap: brim forward
        fabric(g, pathPts([['M', cx - w, by + 1], ['C', cx - w, top + 1, cx + w, top + 1, cx + w, by + 1], ['Z']]), head, { seed: sd + 10, t });
        fabric(g, pathPts([['M', cx + w * 0.4, by - 0.6], ['Q', cx + w + 12, by - 2, cx + w + 15, by + 3.4], ['Q', cx + w + 4, by + 4.2, cx + w * 0.3, by + 2.4], ['Z']]), { ...head, c: ha, p: undefined }, { seed: sd + 11, t, lw: 2.2 });
    }
  }
}

function drawSide(g, body, outfit, opts, t, sd) {
  const skinC = skinColor(body.skin), chrome = isChrome(body.skin);
  const limbC = chrome ? '#b8bfd2' : skinC;
  const pose = opts.pose || 'run';
  const ph = opts.phase || 0;
  const sw = Math.sin(ph * TAU);
  let legF, legB, armF, armB, bob = 0, lean = 0.1;
  if (pose === 'jump') {
    legF = sideLeg(0.95, 1.5); legB = sideLeg(-0.35, 0.9);
    armF = sideArm(-2.5, 0.4); armB = sideArm(-2.1, 0.3); lean = 0.04;
  } else if (pose === 'fall') {
    legF = sideLeg(0.35, 0.4); legB = sideLeg(-0.2, 0.2);
    armF = sideArm(-2.7 + Math.sin(t * 20) * 0.2, 0.2); armB = sideArm(-2.4, 0.3); lean = 0;
  } else if (pose === 'idle') {
    legF = sideLeg(0.08, 0); legB = sideLeg(-0.08, 0);
    armF = sideArm(0.15, 0.3); armB = sideArm(-0.1, 0.3); lean = 0; bob = Math.sin(t * 2.4) * 0.6;
  } else {
    const aF = sw * 0.85, aB = -sw * 0.85;
    legF = sideLeg(aF, Math.max(0, -aF) * 1.3 + 0.15);
    legB = sideLeg(aB, Math.max(0, -aB) * 1.3 + 0.15);
    armF = sideArm(-sw * 0.9, -0.9); armB = sideArm(sw * 0.9, -0.9);
    bob = -Math.abs(Math.sin(ph * TAU)) * 2.6;
  }
  g.fillStyle = 'rgba(10,6,24,0.32)';
  g.beginPath(); g.ellipse(2, 0.5, 22, 4, 0, 0, TAU); g.fill();
  if (outfit.aura) drawAura(g, outfit.aura, t, sd + 900);
  g.translate(0, bob);
  g.rotate(lean);
  const bot = outfit.bottom, top = outfit.top;
  const legCol = (dark) => {
    if (!bot) return dark ? shade(limbC, 0.18) : limbC;
    const c = bot.type === 'jeans' ? (bot.c || '#3e6fd8') : (bot.c || '#4a4a5a');
    return dark ? shade(c, 0.18) : c;
  };
  const drawLeg = (L, dark, k) => {
    const short = bot && bot.type === 'shorts';
    tube(g, L, dark ? shade(limbC, 0.18) : limbC, 9.6, { lw: 2.4, seed: sd + k, amp: 0.3 });
    if (bot) {
      if (short) tube(g, [L[0], [lerp(L[0][0], L[1][0], 0.9), lerp(L[0][1], L[1][1], 0.9)]], legCol(dark), 12, { lw: 2.4, seed: sd + k + 1, amp: 0.3 });
      else tube(g, L, legCol(dark), bot.type === 'cargos' || bot.type === 'pants' ? 12 : 10.8, { lw: 2.4, seed: sd + k + 1, amp: 0.3 });
      if (bot.type === 'trackpants') tube(g, L, bot.a || '#fffaf0', 2.2, { lw: 0, seed: sd + k + 2 });
    }
    drawSideShoe(g, outfit.feet, L[2], sd + k + 3, t, limbC, dark);
  };
  const sleeveCol = (dark) => {
    const c = top ? (top.type === 'windbreaker' ? (top.c2 || top.a || '#7b5cff') : top.c) : limbC;
    return dark ? shade(c, 0.2) : c;
  };
  const drawArmSide = (A, dark, k) => {
    const long = top && LONG[top.type];
    tube(g, A, long ? sleeveCol(dark) : (dark ? shade(limbC, 0.18) : limbC), top && top.type === 'puffer' ? 12 : 9, { lw: 2.4, seed: sd + k, amp: 0.4 });
    if (top && top.type === 'tee') tube(g, [A[0], [lerp(A[0][0], A[1][0], 0.75), lerp(A[0][1], A[1][1], 0.75)]], sleeveCol(dark), 11.6, { lw: 2.4, seed: sd + k + 1, amp: 0.4 });
    ellipse(g, A[2][0], A[2][1], 5, 4.8, { fill: dark ? shade(limbC, 0.15) : limbC, lw: 2.2, seed: sd + k + 2 });
  };
  drawArmSide(armB, true, 10);
  drawLeg(legB, true, 20);
  drawLeg(legF, false, 30);
  // torso
  const tw = top && top.type === 'puffer' ? 15 : 13;
  const torso = pathPts([['M', -tw + 2, -58], ['Q', 0, -61, tw - 1, -58], ['Q', tw + 1, -45, tw, -27], ['Q', 0, -24.6, -tw, -27], ['Q', -tw - 1, -45, -tw + 2, -58]], 6);
  if (top) {
    fabric(g, torso, top.dye && !top.p ? { ...top, p: 'tiedye', p2: top.dye } : top, { seed: sd + 40, t, amp: top.type === 'puffer' ? 1.4 : 0.8 });
    if (top.type === 'hoodie') ellipse(g, -tw + 1, -56, 6.4, 5, { fill: shade(top.c, 0.15), lw: 2.4, seed: sd + 41 });
    if (top.type === 'jersey') text(g, String(top.num ?? '00'), 0, -36, { size: 11, font: FONTS.sign, fill: top.a || '#fffaf0', lw: 2 });
  } else {
    fabric(g, torso, { c: skinC, finish: chrome ? 'chrome' : undefined }, { seed: sd + 40, t });
  }
  if (outfit.neck) {
    const nc = outfit.neck.c || '#ffd23f';
    for (let i = 0; i < 4; i++) dot(g, 7 + i * 1.2, -57 + i * 2.6, outfit.neck.type === 'rope' ? 1.8 : 1.2, i % 2 ? nc : shade(nc, 0.2));
    ellipse(g, 11.4, -46.6, outfit.neck.type === 'rope' ? 3.6 : 2.4, outfit.neck.type === 'rope' ? 3.6 : 2.4, { fill: nc, lw: 1.4, seed: sd + 45 });
  }
  const m = headM(body.head, 3);
  drawSideHead(g, body, outfit, m, t, sd + 50, opts);
  drawArmSide(armF, false, 60);
  if (SLOTS.some((s) => outfit[s] && outfit[s].prismatic)) prismaticTwinkles(g, t, sd + 150);
}

// ---------------------------------------------------------------- portraits

function framePortrait(canvas, frame, draw) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const [fx, fy, fw, fh] = frame;
  const s = Math.min(W / fw, H / fh);
  g.setTransform(s, 0, 0, s, (W - fw * s) / 2 - fx * s, (H - fh * s) / 2 - fy * s);
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

export function drawFigurePortrait(canvas, body, outfit, opts = {}) {
  const head = (body && body.head) || 'round';
  const top = head === 'drop' ? -124 : head === 'bean' ? -118 : -114;
  const hat = outfit && outfit.head;
  const extra = hat && (hat.type === 'crown' || hat.type === 'halo' || hat.type === 'beanie') ? 12 : 0;
  framePortrait(canvas, [-44, top - extra, 88, 84 + extra], (g) => {
    drawFigure(g, 0, 0, { body, outfit, t: opts.t || 0, blink: opts.blink, talk: opts.talk, boil: opts.boil, pose: 'idle' });
  });
}

const NPC_FRAME = {
  signal: [-40, -134, 80, 92], drippy: [-40, -130, 80, 90], lace: [-40, -132, 80, 92], cone: [-40, -132, 80, 92],
  mira: [-40, -132, 80, 92], joy: [-40, -132, 80, 92], plug: [-40, -126, 80, 90], static: [-44, -134, 88, 94], eight: [-40, -112, 80, 82],
};

export function drawNpcPortrait(canvas, id, opts = {}) {
  framePortrait(canvas, NPC_FRAME[id] || [-40, -130, 80, 90], (g) => {
    drawNpc(g, id, 0, 0, { ...opts, scale: 1, pose: 'idle' });
  });
}

// ---------------------------------------------------------------- NPC rig

// Shared body for the shopkeepers: legs, bottoms, shoes, torso, arms.
function npcBody(g, o, outfit, skinC, extraTorso) {
  const { t, sd, pose } = o;
  const P = frontPose(pose || 'idle', t, null);
  g.fillStyle = 'rgba(10,6,24,0.32)';
  g.beginPath(); g.ellipse(0, 0.5, 26, 4.4, 0, 0, TAU); g.fill();
  g.translate(0, P.bob + P.hop);
  drawLegs(g, P, skinC, false, sd + 10);
  if (outfit.bottom) drawBottom(g, outfit.bottom, sd + 20, t);
  if (outfit.feet) { drawShoe(g, outfit.feet, -1, sd + 30, t, skinC); drawShoe(g, outfit.feet, 1, sd + 34, t, skinC); }
  else drawBareFeet(g, skinC, sd + 30);
  if (outfit.top) drawTopBody(g, outfit.top, sd + 40, t);
  else fabric(g, torsoPts(-26.8, 17.2), { c: skinC }, { seed: sd + 40, t });
  if (extraTorso) extraTorso(P);
  drawArm(g, -1, P, skinC, false, outfit.top, sd + 60, t);
  drawArm(g, 1, P, skinC, false, outfit.top, sd + 70, t);
  if (outfit.neck) drawNeck(g, outfit.neck, sd + 80, t);
  return P;
}

const glowDot = (g, x, y, r, col, a = 0.5) => {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
  gr.addColorStop(0, rgba(col, a));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr;
  g.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
  g.restore();
};

// ---- SIGNAL: traffic-light conductor. Eyes in the top lamp, nose in the
// middle, mouth in the bottom lamp.
function npcSignal(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'jacket', c: '#2b3a6b', a: '#ffd23f' },
    bottom: { type: 'cargos', c: '#252a44' },
    feet: { type: 'boots', c: '#1d1a2a', a: '#ffd23f' },
  }, '#efe6d4', () => {
    for (let i = 0; i < 3; i++) dot(g, -5, -51 + i * 7, 1.6, '#ffd23f');
  });
  rect(g, -4.5, -62, 9, 8, { fill: '#2a2638', lw: 2.2, seed: sd + 1 });
  rrect(g, -21, -124, 42, 66, 11, { fill: '#e8b830', lw: 3, seed: sd + 2 });
  fabric(g, rrectPts(-17, -121, 34, 60, 8), { c: '#24212e' }, { seed: sd + 3, t, shadeAmt: 0.18 });
  const talkK = talk ? (Math.sin(t * 18) > 0 ? 1 : 0.55) : 0.75;
  const lamps = [[-107, '#ff5a4a', 0.95], [-91, '#ffb02e', 0.8], [-75, '#3ee07a', talkK]];
  for (const [ly, col, on] of lamps) {
    glowDot(g, 0, ly, 8, col, 0.35 * on);
    ellipse(g, 0, ly, 7.6, 7.6, { fill: mix(shade(col, 0.55), col, on), lw: 2.2, seed: sd + ly });
    dot(g, -2.6, ly - 2.8, 1.6, rgba('#ffffff', 0.55 * on));
    // hood visor
    blob(g, [['M', -9.4, ly - 4], ['Q', 0, ly - 13, 9.4, ly - 4], ['Q', 0, ly - 9, -9.4, ly - 4], ['Z']], { fill: '#15131d', lw: 1.8, seed: sd + ly + 1 });
  }
  // face in the lamps
  if (blink) { stroke(g, [[-4.4, -106.6], [-1.4, -106.6]], { lw: 1.6, amp: 0 }); stroke(g, [[1.4, -106.6], [4.4, -106.6]], { lw: 1.6, amp: 0 }); }
  else { dot(g, -3, -106.6, 1.7, INK); dot(g, 3, -106.6, 1.7, INK); }
  dot(g, 0, -90, 1.4, shade('#ffb02e', 0.5));
  if (talk && Math.sin(t * 18) > 0) ellipse(g, 0, -74, 3.4, 2.6, { fill: '#123a20', lw: 1.4, amp: 0 });
  else stroke(g, pathPts([['M', -3.6, -76], ['Q', 0, -72.4, 3.6, -76]]), { lw: 1.8, amp: 0, color: '#123a20' });
  // conductor cap
  fabric(g, pathPts([['M', -19, -124], ['C', -20, -138, 20, -138, 19, -124], ['Z']]), { c: '#2b3a6b' }, { seed: sd + 20, t });
  fabric(g, pathPts([['M', -21, -125], ['Q', 0, -117, 21, -125], ['Q', 0, -121, -21, -125], ['Z']]), { c: '#15131d' }, { seed: sd + 21, t, lw: 2.2 });
  rrect(g, -5, -133, 10, 5.6, 1.4, { fill: '#ffd23f', lw: 1.6, seed: sd + 22 });
}

// ---- DRIPPY: paint bucket overflowing with drips (THREADS)
function npcDrippy(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'tee', c: '#f4efe6', p: 'stripes', p2: '#ff4f9a' },
    bottom: { type: 'jeans', c: '#3e6fd8' },
    feet: { type: 'boots', c: '#5a3a22', a: '#ff4f9a' },
  }, '#ff9ccf', () => {
    // overalls bib + straps
    fabric(g, pathPts([['M', -12, -50], ['L', 12, -50], ['L', 13.4, -28], ['L', -13.4, -28], ['Z']]), { c: '#3e6fd8', p: 'splatter', p2: '#ff4f9a' }, { seed: sd + 5, t, smooth: false, lw: 2.4 });
    stroke(g, [[-11, -50], [-14, -58]], { lw: 3.6, color: INK, amp: 0 });
    stroke(g, [[-11, -50], [-14, -58]], { lw: 2, color: '#3e6fd8', amp: 0 });
    stroke(g, [[11, -50], [14, -58]], { lw: 3.6, color: INK, amp: 0 });
    stroke(g, [[11, -50], [14, -58]], { lw: 2, color: '#3e6fd8', amp: 0 });
    dot(g, -10.6, -48.6, 1.6, '#ffd23f'); dot(g, 10.6, -48.6, 1.6, '#ffd23f');
  });
  const pink = '#ff4f9a';
  // handle
  stroke(g, pathPts([['M', -21, -97], ['Q', -24, -126, 0, -128], ['Q', 24, -126, 21, -97]]), { lw: 2.4, color: '#5a5876', amp: 0 });
  fabric(g, pathPts([['M', -21, -108], ['L', 21, -108], ['L', 17.6, -58], ['Q', 0, -55, -17.6, -58], ['Z']]), { c: '#c8ccdc' }, { seed: sd + 1, t, smooth: false, amp: 0.4 });
  // rim + paint surface + overflow drips
  ellipse(g, 0, -108, 21.6, 5.4, { fill: '#a8acc0', lw: 2.6, seed: sd + 2 });
  ellipse(g, 0, -108, 18.6, 3.8, { fill: pink, lw: 0, seed: sd + 3 });
  blob(g, [['M', -21, -108], ['Q', -22, -101, -17, -99], ['Q', -12, -103, -8, -100], ['Q', -2, -96, 3, -100], ['Q', 9, -104, 14, -99], ['Q', 20, -97, 21, -108], ['Z']], { fill: pink, lw: 2.4, seed: sd + 4 });
  const drips = [[-15, 16], [-6, 10], [6, 22], [15, 12]];
  for (const [dx, len] of drips) {
    const grow = len + Math.sin(t * 1.2 + dx) * 2;
    stroke(g, [[dx, -101], [dx, -101 + grow]], { lw: 4.6, color: INK, amp: 0 });
    stroke(g, [[dx, -101], [dx, -101 + grow]], { lw: 2.6, color: pink, amp: 0 });
    dot(g, dx, -100 + grow, 2.4, INK);
    dot(g, dx, -100 + grow, 1.6, pink);
  }
  // face
  for (const s of [-1, 1]) {
    if (blink) stroke(g, [[s * 7 - 3.4, -80], [s * 7 + 3.4, -80]], { lw: 2.2, amp: 0 });
    else {
      ellipse(g, s * 7, -80, 4.2, 5, { fill: '#fffaf0', lw: 2, amp: 0.2, seed: sd + 10 + s });
      dot(g, s * 7 + 0.8, -79.4, 2.2, INK);
    }
  }
  if (talk && Math.sin(t * 18) > 0) ellipse(g, 0, -68, 4.4, 3.2, { fill: '#5a1a3a', lw: 1.8, amp: 0 });
  else blob(g, [['M', -6, -70], ['Q', 0, -63, 6, -70], ['Z']], { fill: '#5a1a3a', lw: 1.8, amp: 0, seed: sd + 14 });
  text(g, 'DRIP', 0, -88.6, { size: 5.4, font: FONTS.sign, fill: rgba('#2a2238', 0.6), lw: 0 });
}

// ---- LACE: a high-top in profile for a head (KICKS)
function npcLace(g, o) {
  const { t, talk, blink, sd } = o;
  const purple = '#7b5cff', white = '#fffaf0';
  npcBody(g, o, {
    top: { type: 'jacket', c: purple, a: white },
    bottom: { type: 'trackpants', c: purple, a: white },
    feet: { type: 'high', c: white, a: purple, s: '#ffd23f' },
  }, '#8fd0ff');
  rrect(g, -7, -66, 14, 9, 3, { fill: purple, lw: 2.4, seed: sd + 1 });
  // lace ends flop back over the collar like hair
  const sway = Math.sin(t * 2.6) * 2;
  for (const [ex2, ey2] of [[-15 + sway, -124], [-8 + sway, -129]]) {
    stroke(g, pathPts([['M', 1, -106], ['Q', -2, -120, ex2, ey2]]), { lw: 3.6, color: INK, amp: 0 });
    stroke(g, pathPts([['M', 1, -106], ['Q', -2, -120, ex2, ey2]]), { lw: 1.9, color: white, amp: 0 });
  }
  // tongue
  fabric(g, pathPts([['M', -7, -110], ['Q', -6, -125, 3, -123], ['Q', 8, -113, 3, -104], ['Z']]), { c: purple }, { seed: sd + 2, t, lw: 2.4 });
  // upper: heel on the left, toe on the right
  fabric(g, pathPts([
    ['M', -23, -64], ['L', -24.6, -108], ['Q', -16, -115, -6, -111],
    ['L', 2, -104], ['Q', 14, -86, 25, -76], ['Q', 31, -71, 27, -64], ['Z'],
  ]), { c: white }, { seed: sd + 3, t });
  // collar padding + ankle patch + our lightning stripe
  stroke(g, pathPts([['M', -24, -107], ['Q', -15, -113, -6, -110]]), { lw: 2.4, color: shade(white, 0.25), amp: 0 });
  ellipse(g, -14.6, -98, 5.6, 5.6, { fill: purple, lw: 2.2, seed: sd + 4 });
  dot(g, -14.6, -98, 1.8, '#ffd23f');
  stroke(g, [[-21, -86], [-9, -93], [-4, -85.6], [10, -92]], { lw: 3.6, color: purple, amp: 0, smooth: false });
  // laces down the slope
  for (let i = 0; i < 4; i++) {
    const lx = 3.4 + i * 4.6, ly = -101 + i * 5.8;
    for (const [a1, a2] of [[[lx - 3, ly - 2], [lx + 3, ly + 2]], [[lx + 3, ly - 2.4], [lx - 3, ly + 1.6]]]) {
      stroke(g, [a1, a2], { lw: 3.4, color: INK, amp: 0 });
      stroke(g, [a1, a2], { lw: 1.7, color: white, amp: 0 });
    }
  }
  // rubber toe cap
  fabric(g, pathPts([['M', 9, -64], ['Q', 10, -77, 22, -77.6], ['Q', 31, -73, 27, -64], ['Z']]), { c: '#efe8da' }, { seed: sd + 5, t, lw: 2.2, shadeAmt: 0.12 });
  // sole
  fabric(g, pathPts([['M', -25, -66], ['L', 24, -66], ['Q', 31, -66, 30.4, -61], ['Q', 29.6, -57, 23, -57], ['L', -25, -57], ['Q', -27.6, -61.5, -25, -66], ['Z']]), { c: '#ffd23f' }, { seed: sd + 6, t, lw: 2.6, shadeAmt: 0.15 });
  stroke(g, [[-22, -59.6], [26, -59.6]], { lw: 1.2, color: shade('#ffd23f', 0.4), amp: 0 });
  // face on the side panel
  for (const ex of [-6, 3]) {
    if (blink) stroke(g, [[ex - 2.6, -74], [ex + 2.6, -74]], { lw: 2, amp: 0 });
    else {
      ellipse(g, ex, -74.6, 3.6, 4.2, { fill: '#fffaf0', lw: 1.8, amp: 0.1, seed: sd + 10 + ex });
      dot(g, ex + 0.9, -74, 2, INK);
      dot(g, ex + 0.2, -75.4, 0.7, '#ffffff');
    }
  }
  if (talk && Math.sin(t * 18) > 0) ellipse(g, -1.4, -67.6, 2.8, 2, { fill: '#5a1a3a', lw: 1.4, amp: 0 });
  else stroke(g, pathPts([['M', -4.6, -68.6], ['Q', -1.4, -66.4, 2, -68.6]]), { lw: 1.8, amp: 0 });
}

// ---- CONE: traffic cone head (LIDS)
function npcCone(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'hoodie', c: '#5a5872', a: '#fffaf0' },
    bottom: { type: 'cargos', c: '#4a5a3a' },
    feet: { type: 'boots', c: '#3a2a22', a: '#ff8a3d' },
  }, '#f2e6cf', () => {
    // hi-vis vest
    fabric(g, pathPts([['M', -15, -57], ['L', -6, -57], ['L', -3, -27], ['L', -17.6, -27], ['Z']]), { c: '#d8ff3d' }, { seed: sd + 5, t, smooth: false, lw: 2.2 });
    fabric(g, pathPts([['M', 15, -57], ['L', 6, -57], ['L', 3, -27], ['L', 17.6, -27], ['Z']]), { c: '#d8ff3d' }, { seed: sd + 6, t, smooth: false, lw: 2.2 });
    for (const y of [-42, -34]) {
      stroke(g, [[-16.6, y], [-4, y]], { lw: 2.4, color: '#d8dce8', amp: 0 });
      stroke(g, [[16.6, y], [4, y]], { lw: 2.4, color: '#d8dce8', amp: 0 });
    }
  });
  rect(g, -23, -63, 46, 7.6, { fill: '#2a2238', lw: 2.6, seed: sd + 1 });
  const conePts = pathPts([['M', -17.6, -62], ['L', -4.4, -121], ['Q', 0, -125, 4.4, -121], ['L', 17.6, -62], ['Z']]);
  fabric(g, conePts, { c: '#ff8a3d' }, {
    seed: sd + 2, t,
    inner: (gg) => {
      gg.fillStyle = '#f4f4f8';
      gg.fillRect(-20, -106, 40, 8);
      gg.fillRect(-22, -84, 40 + 4, 9);
      gg.fillStyle = 'rgba(255,255,255,0.35)';
      gg.fillRect(-4, -120, 2.4, 56);
    },
  });
  for (const s of [-1, 1]) {
    if (blink) stroke(g, [[s * 5 - 2.4, -91], [s * 5 + 2.4, -91]], { lw: 2, amp: 0 });
    else { dot(g, s * 5, -91, 2.3, INK); dot(g, s * 5 - 0.7, -91.8, 0.8, '#ffffff'); }
  }
  if (talk && Math.sin(t * 18) > 0) ellipse(g, 0, -69, 3.4, 2.4, { fill: '#5a1a3a', lw: 1.6, amp: 0 });
  else stroke(g, pathPts([['M', -4, -70], ['Q', 0, -66.4, 4, -70]]), { lw: 1.8, amp: 0 });
}

// ---- MIRA: disco-ball head (ICE)
function npcMira(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'tee', c: '#ffd23f', finish: 'gold' },
    bottom: { type: 'cargos', c: '#1d1830' },
    feet: { type: 'low', c: '#ff4f9a', a: '#ffd23f', s: '#fffaf0' },
  }, '#ffd6e8', () => {
    // faux-fur stole
    const fur = '#ff8ccf';
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const x = lerp(-19, 19, k), y = -57 + Math.sin(k * Math.PI) * 5;
      ellipse(g, x, y, 5.2, 4.6, { fill: i % 2 ? fur : tint(fur, 0.2), lw: 2, seed: sd + 40 + i, amp: 1.2 });
    }
    ellipse(g, -16, -46, 4.6, 7, { fill: fur, lw: 2, seed: sd + 50, amp: 1.2 });
  });
  stroke(g, [[0, -105], [0, -132]], { lw: 1.8, color: '#8a8aa0', amp: 0 });
  const shimmer = Math.floor(t * 6);
  fabric(g, ellipsePts(0, -80, 25, 25), { c: '#b8bcd4' }, {
    seed: sd + 1, t,
    inner: (gg) => {
      const r = mulberry32(sd + shimmer * 7);
      for (let row = -6; row <= 6; row++) {
        const y = -80 + row * 4;
        const half = Math.sqrt(Math.max(0, 625 - (y + 80) ** 2));
        for (let x = -half; x < half; x += 4.2) {
          const v = r();
          if (v < 0.18) gg.fillStyle = 'rgba(255,255,255,0.85)';
          else if (v < 0.28) gg.fillStyle = 'rgba(255,120,210,0.7)';
          else if (v < 0.36) gg.fillStyle = 'rgba(120,230,255,0.7)';
          else if (v < 0.6) gg.fillStyle = 'rgba(40,30,70,0.35)';
          else continue;
          gg.fillRect(x + 0.4, y + 0.4, 3.4, 3.2);
        }
      }
      gg.strokeStyle = 'rgba(40,30,70,0.5)';
      gg.lineWidth = 0.8;
      for (let row = -6; row <= 6; row++) { gg.beginPath(); gg.moveTo(-26, -80 + row * 4); gg.lineTo(26, -80 + row * 4); gg.stroke(); }
    },
  });
  for (const s of [-1, 1]) {
    if (blink) stroke(g, pathPts([['M', s * 8 - 3.6, -82], ['Q', s * 8, -79.6, s * 8 + 3.6, -82]]), { lw: 2.2, amp: 0 });
    else {
      ellipse(g, s * 8, -82, 3.8, 4.6, { fill: '#1d1830', lw: 1.6, amp: 0.1, seed: sd + 5 + s });
      dot(g, s * 8 - 1, -83.6, 1, '#ffffff');
      for (let k = 0; k < 3; k++) stroke(g, [[s * 8 + s * (1.6 + k * 1.4), -86 + k * 0.8], [s * 8 + s * (3.2 + k * 1.8), -89 + k * 0.6]], { lw: 1.2, amp: 0 });
    }
  }
  if (talk && Math.sin(t * 18) > 0) ellipse(g, 0, -70, 3.6, 2.6, { fill: '#c2185b', lw: 1.6, amp: 0 });
  else blob(g, [['M', -5, -71.6], ['Q', 0, -66.6, 5, -71.6], ['Q', 0, -69.6, -5, -71.6], ['Z']], { fill: '#e8456b', lw: 1.4, amp: 0, seed: sd + 9 });
  for (let i = 0; i < 4; i++) {
    const k = Math.max(0, Math.sin(t * 3.2 + i * 1.6));
    if (k > 0.1) twinkle(g, [-30, 28, -24, 32][i], [-104, -98, -62, -70][i], 1 + k * 3.4, '#fffaf0');
  }
}

// ---- JOY: arcade-cabinet head (ARCADE)
function npcJoy(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'jacket', c: '#2f8a5a', a: '#ffd23f' },
    bottom: { type: 'jeans', c: '#3e6fd8' },
    feet: { type: 'low', c: '#f4efe6', a: '#ff4f9a', s: '#f4efe6' },
  }, '#9ff0cf');
  // joystick on top
  stroke(g, [[8, -113], [10, -126]], { lw: 3.4, color: INK, amp: 0 });
  stroke(g, [[8, -113], [10, -126]], { lw: 1.8, color: '#c8c8e0', amp: 0 });
  ellipse(g, 10.4, -128, 4.4, 4.4, { fill: '#ff4f4f', lw: 2, seed: sd + 1 });
  fabric(g, rrectPts(-21, -114, 42, 56, 5), { c: '#7b5cff', p: 'stripes', p2: shade('#7b5cff', 0.15) }, { seed: sd + 2, t });
  fabric(g, rrectPts(-19, -112, 38, 10, 2.6), { c: '#ffd23f' }, { seed: sd + 3, t, lw: 2 });
  text(g, 'JOY', 0, -104.4, { size: 7, font: FONTS.sign, fill: '#e8456b', lw: 0 });
  rrect(g, -16, -99, 32, 23, 3, { fill: '#0c0a18', lw: 2.2, seed: sd + 4 });
  const px = (x, y, w = 2.6, h = 2.6, col = '#7ed957') => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (blink) { px(-9, -91.6, 6, 1.4); px(3, -91.6, 6, 1.4); }
  else { px(-8.4, -93.6, 4.4, 4.4); px(4, -93.6, 4.4, 4.4); px(-7.2, -92.6, 1.4, 1.4, '#ffffff'); px(5.2, -92.6, 1.4, 1.4, '#ffffff'); }
  if (talk && Math.sin(t * 18) > 0) { px(-3.4, -85, 6.8, 4.6); px(-2, -83.8, 4, 2.2, '#0c0a18'); }
  else { px(-6, -84.4, 2.4, 2.2); px(-3.6, -82.6, 7.2, 2.2); px(3.6, -84.4, 2.4, 2.2); }
  g.fillStyle = 'rgba(126,217,87,0.12)';
  for (let y = -98; y < -77; y += 2.2) g.fillRect(-15.4, y, 30.8, 0.8);
  fabric(g, pathPts([['M', -19, -74], ['L', 19, -74], ['L', 21, -63], ['L', -21, -63], ['Z']]), { c: '#2a2238' }, { seed: sd + 5, t, smooth: false, lw: 2.2 });
  dot(g, 7, -68.4, 2.2, '#ff4f4f'); dot(g, 13, -69.4, 2.2, '#3ec7ff');
  stroke(g, [[-9, -68], [-8, -72]], { lw: 1.8, color: '#c8c8e0', amp: 0 });
  dot(g, -8, -72.6, 1.8, '#ffd23f');
}

// ---- PLUG: fire-hydrant head with bolt eyes (CAPSULES + VAULT)
function npcPlug(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'puffer', c: '#1d1830', a: '#ffd23f' },
    bottom: { type: 'cargos', c: '#3a3a4a' },
    feet: { type: 'boots', c: '#d9a441', a: '#2a2238' },
    neck: { type: 'rope', c: '#ffd23f', g: 'drop' },
  }, '#ff6f6f');
  const red = '#e8453f';
  rrect(g, -19, -64, 38, 7, 2, { fill: shade(red, 0.15), lw: 2.6, seed: sd + 1 });
  for (const s of [-1, 1]) {
    fabric(g, rrectPts(s * 15 + (s > 0 ? 0 : -9), -89.6, 9, 11.4, 2.6), { c: red }, { seed: sd + 2 + s, t, lw: 2.2 });
    ellipse(g, s * 24.6, -84, 3, 4.4, { fill: '#c8c8e0', lw: 1.6, seed: sd + 4 + s });
  }
  fabric(g, pathPts([['M', -15.6, -58], ['L', -15.6, -98], ['Q', -15.6, -102, -11.6, -102], ['L', 11.6, -102], ['Q', 15.6, -102, 15.6, -98], ['L', 15.6, -58], ['Z']]), { c: red }, { seed: sd + 6, t });
  fabric(g, pathPts([['M', -14.6, -101], ['C', -14.6, -118, 14.6, -118, 14.6, -101], ['Z']]), { c: red }, { seed: sd + 7, t });
  rrect(g, -17.6, -104, 35.2, 5, 1.6, { fill: shade(red, 0.18), lw: 2.2, seed: sd + 8 });
  shape(g, [[-4.4, -116], [4.4, -116], [5.6, -121], [0, -124.6], [-5.6, -121]], { fill: '#c8c8e0', lw: 2, smooth: false, seed: sd + 9 });
  // bolt eyes
  for (const s of [-1, 1]) {
    const ex = s * 7, ey = -88;
    const hex = [];
    for (let k = 0; k < 6; k++) hex.push([ex + Math.cos(k * Math.PI / 3) * 4.6, ey + Math.sin(k * Math.PI / 3) * 4.6]);
    shape(g, hex, { fill: '#d8dce8', lw: 1.8, smooth: false, seed: sd + 10 + s });
    if (blink) stroke(g, [[ex - 2.4, ey], [ex + 2.4, ey]], { lw: 1.8, amp: 0 });
    else { const look = Math.sin(t * 0.7) * 0.8; dot(g, ex + look, ey + 0.3, 1.9, INK); }
  }
  // front outlet = mouth
  ellipse(g, 0, -72, 8.6, 8, { fill: shade(red, 0.12), lw: 2.4, seed: sd + 14 });
  if (talk && Math.sin(t * 18) > 0) ellipse(g, 0, -72, 5.2, 4, { fill: '#3a0a10', lw: 1.6, amp: 0 });
  else stroke(g, pathPts([['M', -4.4, -72.6], ['Q', 0, -69, 4.4, -72.6]]), { lw: 2, amp: 0 });
}

// ---- STATIC: ghostly CRT-TV conductor (GHOST CAR)
function npcStatic(g, o) {
  const { t, talk, blink, sd } = o;
  const float = Math.sin(t * 1.7) * 3 - 4;
  const mint = '#bff8ec';
  glowDot(g, 0, -70, 30, '#9affe0', 0.3);
  g.save();
  g.translate(0, float);
  g.globalAlpha *= 0.82;
  // wisp tail instead of legs
  const wv = Math.sin(t * 3) * 3;
  fabric(g, pathPts([['M', -14, -30], ['Q', -16, -14, -6 + wv, -6], ['Q', 2 + wv, 0, 8 + wv, 4], ['Q', 4, -6, 10, -16], ['Q', 14, -24, 14, -30], ['Z']]), { c: mint }, { seed: sd + 1, t, line: '#1d4a4a', lw: 2.4, shadeAmt: 0.14 });
  // long conductor coat
  fabric(g, pathPts([['M', -16, -58], ['Q', 0, -61, 16, -58], ['L', 19, -20], ['Q', 0, -15, -19, -20], ['Z']]), { c: '#24506a' }, { seed: sd + 2, t, line: '#1d4a4a', lw: 2.6 });
  stroke(g, [[0, -57], [0, -19]], { lw: 1.4, color: '#1d4a4a', amp: 0 });
  for (let i = 0; i < 4; i++) dot(g, 3.6, -52 + i * 8, 1.6, '#ffd23f');
  const P = frontPose(o.pose || 'idle', t, null);
  for (const [s, e, h] of [[P.sL, P.eL, P.hL], [P.sR, P.eR, P.hR]]) {
    tube(g, [s, e, [lerp(e[0], h[0], 0.8), lerp(e[1], h[1], 0.8)]], '#24506a', 10, { lw: 2.4, line: '#1d4a4a', seed: sd + 5 });
    ellipse(g, h[0], h[1], 5, 4.8, { fill: mint, lw: 2, line: '#1d4a4a', seed: sd + 6 });
  }
  // TV head
  stroke(g, [[-6, -113], [-17, -131]], { lw: 1.8, color: '#5a5a6e', amp: 0 });
  stroke(g, [[6, -113], [18, -129]], { lw: 1.8, color: '#5a5a6e', amp: 0 });
  dot(g, -17, -131, 2, '#ff4f9a'); dot(g, 18, -129, 2, '#ff4f9a');
  fabric(g, rrectPts(-25, -114, 50, 52, 8), { c: '#cdbf9a' }, { seed: sd + 7, t, line: '#1d4a4a' });
  rrect(g, -20.6, -109, 32, 42, 8, { fill: '#163a3a', lw: 2.4, line: '#1d4a4a', seed: sd + 8 });
  g.save();
  g.beginPath();
  g.rect(-19.6, -108, 30, 40);
  g.clip();
  const r = mulberry32(sd + Math.floor(t * 18) * 31);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(220,255,245,0.55)' : 'rgba(80,140,130,0.6)';
    g.fillRect(-20 + r() * 32, -108 + r() * 40, 1.6 + r() * 2.4, 0.9);
  }
  g.restore();
  const flick = 0.75 + Math.sin(t * 23) * 0.15;
  if (blink) {
    stroke(g, [[-11, -92], [-6, -92]], { lw: 2, color: rgba('#9affe0', flick), amp: 0 });
    stroke(g, [[-1, -92], [4, -92]], { lw: 2, color: rgba('#9affe0', flick), amp: 0 });
  } else {
    ellipse(g, -8.6, -92, 2.8, 3.6, { fill: rgba('#9affe0', flick), lw: 0, amp: 0 });
    ellipse(g, 1.6, -92, 2.8, 3.6, { fill: rgba('#9affe0', flick), lw: 0, amp: 0 });
  }
  if (talk && Math.sin(t * 18) > 0) ellipse(g, -3.4, -80, 4.4, 2.8, { fill: rgba('#9affe0', flick), lw: 0, amp: 0 });
  else stroke(g, pathPts([['M', -8, -81], ['Q', -3.4, -77.6, 1.4, -81]]), { lw: 2, color: rgba('#9affe0', flick), amp: 0 });
  for (let i = 0; i < 2; i++) ellipse(g, 17.4, -101 + i * 10, 2.8, 2.8, { fill: '#8a7a5a', lw: 1.6, line: '#1d4a4a', seed: sd + 20 + i });
  for (let i = 0; i < 3; i++) stroke(g, [[14.6, -78 + i * 3], [20.4, -78 + i * 3]], { lw: 1.2, color: '#5a4a3a', amp: 0 });
  g.restore();
}

// ---- EIGHT: 8-ball head, runs the shell game
function npcEight(g, o) {
  const { t, talk, blink, sd } = o;
  npcBody(g, o, {
    top: { type: 'tee', c: '#1d1830' },
    bottom: { type: 'cargos', c: '#2a2238' },
    feet: { type: 'low', c: '#1d1830', a: '#ffd23f', s: '#1d1830' },
    neck: { type: 'chain', c: '#ffd23f', g: 'eightball' },
  }, '#4a4658', () => {
    // velvet blazer with lapels
    const vel = '#6a2a8a';
    fabric(g, pathPts([['M', -16, -57], ['L', -4, -57], ['L', -1, -40], ['L', -4, -26], ['L', -18, -26.6], ['Q', -18.6, -45, -16, -57], ['Z']]), { c: vel }, { seed: sd + 5, t, lw: 2.4 });
    fabric(g, pathPts([['M', 16, -57], ['L', 4, -57], ['L', 1, -40], ['L', 4, -26], ['L', 18, -26.6], ['Q', 18.6, -45, 16, -57], ['Z']]), { c: vel }, { seed: sd + 6, t, lw: 2.4 });
    stroke(g, [[-4, -57], [-8, -44], [-1.6, -40]], { lw: 1.6, color: shade(vel, 0.35), amp: 0, smooth: false });
    stroke(g, [[4, -57], [8, -44], [1.6, -40]], { lw: 1.6, color: shade(vel, 0.35), amp: 0, smooth: false });
  });
  fabric(g, ellipsePts(0, -80, 25, 25), { c: '#1d1830' }, { seed: sd + 1, t, shadeAmt: 0.25 });
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath(); g.ellipse(-11, -94, 7, 3.4, -0.6, 0, TAU); g.fill();
  ellipse(g, 2, -84, 13, 13, { fill: '#fffaf0', lw: 2.4, seed: sd + 2 });
  text(g, '8', 2, -90.4, { size: 6.4, font: FONTS.sign, fill: rgba('#1d1830', 0.55), lw: 0 });
  for (const s of [-1, 1]) {
    const ex = 2 + s * 4.6;
    if (blink) stroke(g, [[ex - 2.2, -83], [ex + 2.2, -83]], { lw: 1.8, amp: 0 });
    else { dot(g, ex, -83, 2.4, INK); dot(g, ex - 0.7, -83.8, 0.8, '#ffffff'); }
  }
  stroke(g, pathPts([['M', -2, -77.4], ['Q', 2.6, -75.6, 6.6, -78.2]]), { lw: 1.6, amp: 0 });
  if (talk && Math.sin(t * 18) > 0) ellipse(g, 0, -64.6, 3.6, 2.2, { fill: '#e8456b', lw: 1.4, line: '#fffaf0', amp: 0 });
  else stroke(g, pathPts([['M', -5, -65.6], ['Q', 0, -62.6, 5, -65.6]]), { lw: 1.8, color: '#fffaf0', amp: 0 });
}

const NPC_DRAW = {
  signal: npcSignal, drippy: npcDrippy, lace: npcLace, cone: npcCone, mira: npcMira,
  joy: npcJoy, plug: npcPlug, static: npcStatic, eight: npcEight,
};

export function drawNpc(g, id, x, y, opts = {}) {
  const fn = NPC_DRAW[id];
  if (!fn) return;
  const sc = opts.scale || 1;
  g.save();
  g.translate(x, y);
  g.scale((opts.facing || 1) * sc, sc);
  fn(g, { t: opts.t || 0, talk: !!opts.talk, blink: opts.blink || 0, sd: opts.boil ?? 300, pose: opts.pose || 'idle' });
  g.restore();
}
