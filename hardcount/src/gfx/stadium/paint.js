// The painted field, drawn onto big canvas tiles in WORLD YARDS (canvas x =
// world x, canvas y = world z). Grass or turf with mowing stripes and noise,
// then a separate paint layer (lines, ticks, hashes, numbers + arrows, end
// zones, midfield logo, border, coaching boxes) that gets worn before it is
// laid down, then weather (mud, snow with the lines swept, frost).
//
// paintField(field, opts) → { tiles: [{ canvas, z0, z1 }], x0, x1, z0, z1, ppy, rough: canvas }
import { makeRng } from '../../core/util.js';
import { cv, noiseCanvas, grainCanvas, blotch } from './tex.js';
import { blockText, blockMetrics } from './blockfont.js';

const WHITE = '#f3f3ec';

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Layout of the canvas tiles for a field + its sideline margins. */
export function fieldExtent(field, opts = {}) {
  const side = opts.side ?? 12, end = opts.end ?? 8;
  const px = opts.px || 2048;
  const x1 = field.halfW + side;
  const ppy = px / (2 * x1);
  const span = px / ppy;
  const need = 2 * (field.end + end);
  const n = Math.max(1, Math.ceil(need / span - 0.02));
  const z1 = (n * span) / 2;
  return { x0: -x1, x1, z0: -z1, z1, ppy, span, n, px };
}

/**
 * opts: {
 *   quality, seed, surface: 'grass'|'turf', pattern: 'stripes'|'checker'|'wide'|'none',
 *   grass: [base, light], wear 0..1, border: 'pro'|'college'|'hs'|'park',
 *   endzone: { style: 'solid'|'stripes'|'outline'|'none', fill, fill2, text: [minusZ, plusZ], color, outline },
 *   logo: canvas|null, logoSize, sideLogos: canvas|null,
 *   weather, frozen, lineAlpha, numbers: true, boxColor
 * }
 */
export function paintField(field, opts) {
  const q = opts.quality === 'low';
  const ext = fieldExtent(field, { px: q ? 1024 : 2048, side: opts.marginSide, end: opts.marginEnd });
  const rng = makeRng('paint' + (opts.seed || 'x'));
  const tiles = [];
  const plan = buildPlan(field, opts, rng);
  for (let t = 0; t < ext.n; t++) {
    const tz0 = ext.z0 + t * ext.span;
    const [c, x] = cv(ext.px, ext.px);
    const [pc, px] = cv(ext.px, ext.px);
    const world = (ctx) => ctx.setTransform(ext.ppy, 0, 0, ext.ppy, -ext.x0 * ext.ppy, -tz0 * ext.ppy);
    // ---- grass / turf
    world(x);
    drawGround(x, field, opts, ext, plan);
    // ---- paint layer, worn, then laid down
    world(px);
    drawPaint(px, field, opts, plan);
    wearPaint(px, field, opts, ext, tz0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = opts.lineAlpha ?? 0.94;
    x.drawImage(pc, 0, 0);
    x.globalAlpha = 1;
    // ---- weather + final grain
    world(x);
    drawWeather(x, field, opts, ext, tz0, plan);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const pat = x.createPattern(grainCanvas(256, 'fieldgrain2', 0.5, '255,255,240', '0,10,0', 0.12), 'repeat');
    x.fillStyle = pat;
    x.fillRect(0, 0, ext.px, ext.px);
    pc.width = pc.height = 1;
    tiles.push({ canvas: c, z0: tz0, z1: tz0 + ext.span });
  }
  const rough = roughMap(field, opts, ext, plan);
  return { tiles, ...ext, rough };
}

// ------------------------------------------------------------------ plan

/** Things shared by the passes: line rectangles (for sweeping snow) and wear spots. */
function buildPlan(field, opts, rng) {
  const lw = field.lineWidth, glw = field.goalLineWidth;
  const hw = field.halfW, hl = field.halfL, E = field.end;
  const lines = [];
  // sidelines + end lines (out of bounds, outside the field of play)
  lines.push([hw, -E - lw, lw, 2 * (E + lw)], [-hw - lw, -E - lw, lw, 2 * (E + lw)]);
  lines.push([-hw - lw, E, 2 * (hw + lw), lw], [-hw - lw, -E - lw, 2 * (hw + lw), lw]);
  // goal lines (8", inside the end zone)
  lines.push([-hw, hl, 2 * hw, glw], [-hw, -hl - glw, 2 * hw, glw]);
  // yard lines every 5
  for (let y = 5; y < field.L; y += 5) {
    const z = -hl + y;
    lines.push([-hw + 0.11, z - lw / 2, 2 * hw - 0.22, lw]);
  }
  const ticks = [];
  for (let y = 1; y < field.L; y++) {
    if (y % 5 === 0) continue;
    const z = -hl + y;
    for (const s of [-1, 1]) {
      ticks.push([s > 0 ? hw - 0.11 - 0.667 : -hw + 0.11, z - lw / 2, 0.667, lw]);
      ticks.push([s * field.hash - 0.333, z - lw / 2, 0.667, lw]);
    }
  }
  // two-point try tick, 1 yd wide, at the try spot
  for (const s of [-1, 1]) ticks.push([-0.5, s * (hl - field.twoPtYard) - lw / 2, 1, lw]);
  // wear spots: between the hashes, heavier in the middle of the field and the goal mouths
  const wear = [];
  const W = opts.wear ?? 0.4;
  const n = Math.round(60 + W * 260);
  for (let i = 0; i < n; i++) {
    const zf = rng.gauss() * 0.45;
    const z = Math.max(-E + 1, Math.min(E - 1, zf * hl));
    const x = rng.gauss() * (field.hash * 0.75 + 1);
    wear.push([x, z, 0.4 + rng() * 1.6 * (0.5 + W), 0.15 + rng() * 0.35 * (0.4 + W)]);
  }
  for (const s of [-1, 1]) {
    // goal mouth: the try spot and the kick spot get beaten up
    for (let i = 0; i < 10 + W * 30; i++) {
      wear.push([rng.gauss() * 2.2, s * (hl - 2 - rng() * 8), 0.4 + rng() * 1.3, 0.2 + rng() * 0.3 * (0.4 + W)]);
    }
    // in front of the benches
    for (let i = 0; i < 20 + W * 40; i++) {
      wear.push([s * (hw + 2.5 + rng() * 5), (rng() - 0.5) * hl * 0.7, 0.5 + rng() * 1.8, 0.15 + rng() * 0.3 * (0.4 + W)]);
    }
  }
  return { lines, ticks, wear };
}

// ------------------------------------------------------------------ ground

function drawGround(x, field, opts, ext, plan) {
  const rng = makeRng('ground' + (opts.seed || 'x'));
  const turf = opts.surface === 'turf';
  const [base, light] = opts.grass || (turf ? ['#2f7a34', '#36863b'] : ['#3d7a2c', '#4a8a35']);
  const X0 = ext.x0, X1 = ext.x1, Z0 = ext.z0, Z1 = ext.z1;
  x.fillStyle = base;
  x.fillRect(X0, Z0, X1 - X0, Z1 - Z0);
  // large-scale colour variation (world-continuous across tiles)
  x.save();
  x.globalCompositeOperation = 'soft-light';
  x.globalAlpha = turf ? 0.2 : 0.4;
  x.imageSmoothingEnabled = true;
  x.drawImage(noiseCanvas(256, 77, 9, 4, 1.1), X0, Z0, X1 - X0, Z1 - Z0);
  x.globalAlpha = turf ? 0.1 : 0.22;
  x.drawImage(noiseCanvas(256, 13, 34, 3, 1.2), X0, Z0, X1 - X0, Z1 - Z0);
  x.restore();
  // mowing pattern (grass) / sewn panels (turf)
  const pat = opts.pattern ?? (turf ? 'none' : 'stripes');
  const band = 5;
  if (pat !== 'none') {
    const a = turf ? 0.075 : 0.135;
    const w = pat === 'wide' ? 10 : band;
    for (let z = -field.end - 20; z < field.end + 20; z += w) {
      const k = Math.round((z + field.end + 20) / w) % 2;
      x.fillStyle = k ? rgba(light, a * 2.2) : 'rgba(0,20,0,' + a * 0.8 + ')';
      x.fillRect(X0, z, X1 - X0, w);
    }
    if (pat === 'checker') {
      for (let xx = -field.halfW; xx < field.halfW; xx += 5) {
        const k = Math.round((xx + field.halfW) / 5) % 2;
        x.fillStyle = k ? 'rgba(255,255,230,0.05)' : 'rgba(0,15,0,0.06)';
        x.fillRect(xx, -field.end, 5, 2 * field.end);
      }
    }
  }
  // the area outside the playing surface a touch different (worn, shaded)
  x.fillStyle = 'rgba(30,25,10,0.08)';
  x.fillRect(X0, Z0, X1 - X0, -field.end - 1 - Z0);
  x.fillRect(X0, field.end + 1, X1 - X0, Z1 - field.end - 1);
  // wear: dirt between the hashes, goal mouths, bench areas
  if (!turf) {
    for (const [wx, wz, r, a] of plan.wear) {
      blotch(x, wx, wz, r, `rgba(132,108,66,${a * 0.85})`);
      if (a > 0.3) blotch(x, wx + 0.2, wz - 0.1, r * 0.5, `rgba(112,90,56,${a * 0.5})`);
    }
    // thin patches in the grass texture (cheap, scattered)
    for (let i = 0; i < 260 * (opts.wear ?? 0.4) + 40; i++) {
      const wx = (rng() - 0.5) * 2 * field.halfW, wz = (rng() - 0.5) * 2 * field.end;
      blotch(x, wx, wz, 0.3 + rng() * 0.8, `rgba(130,120,60,${0.06 + rng() * 0.1})`);
    }
  } else {
    // turf seams every 5 yd (barely there) + pellet scuffs between the hashes
    x.fillStyle = 'rgba(0,0,0,0.06)';
    for (let z = -field.end; z <= field.end; z += 5) x.fillRect(X0, z - 0.03, X1 - X0, 0.06);
    for (let i = 0; i < 160; i++) {
      blotch(x, rng.gauss() * field.hash, rng.gauss() * field.halfL * 0.5, 0.5 + rng() * 1.5, 'rgba(30,30,25,0.10)');
    }
  }
  // fine blades/grain in pixel space
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = x.createPattern(grainCanvas(256, turf ? 'turfg' : 'grassg', 0.9, turf ? '200,255,200' : '220,255,170', '0,20,0', 0.2), 'repeat');
  x.fillRect(0, 0, ext.px, ext.px);
  x.restore();
}

// ------------------------------------------------------------------ paint

function drawPaint(x, field, opts, plan) {
  const hw = field.halfW, hl = field.halfL, E = field.end, EZ = field.EZ;
  const lw = field.lineWidth;
  const border = opts.border || 'pro';
  const white = opts.lineColor || WHITE;
  const ez = opts.endzone || { style: 'solid' };
  // ---- end zones (under the lines)
  if (ez.style && ez.style !== 'none') {
    for (const s of [-1, 1]) {
      const zA = s > 0 ? hl + field.goalLineWidth : -E, zB = s > 0 ? E : -hl - field.goalLineWidth;
      const inset = 0.45;
      if (ez.style === 'solid' || ez.style === 'stripes' || ez.style === 'checker') {
        x.fillStyle = ez.fill;
        x.fillRect(-hw + inset, zA + inset, 2 * hw - 2 * inset, zB - zA - 2 * inset);
        if (ez.style === 'stripes') {
          x.save();
          x.beginPath();
          x.rect(-hw + inset, zA + inset, 2 * hw - 2 * inset, zB - zA - 2 * inset);
          x.clip();
          x.fillStyle = ez.fill2 || '#ffffff';
          for (let k = -hw - 12; k < hw + 12; k += 2.4) {
            x.beginPath();
            x.moveTo(k, zA); x.lineTo(k + 1.0, zA); x.lineTo(k + 1.0 + (zB - zA), zB); x.lineTo(k + (zB - zA), zB);
            x.closePath();
            x.fill();
          }
          x.restore();
        } else if (ez.style === 'checker') {
          x.fillStyle = ez.fill2 || '#ffffff';
          const n = 8, w = (2 * hw - 2 * inset) / n;
          for (let k = 0; k < n; k++) {
            x.fillRect(-hw + inset + k * w + (k % 2 ? 0 : w * 0.5), zA + inset, w * 0.5, 0.6);
            x.fillRect(-hw + inset + k * w + (k % 2 ? w * 0.5 : 0), zB - inset - 0.6, w * 0.5, 0.6);
          }
        }
      }
      const name = (ez.text && ez.text[s > 0 ? 1 : 0]) || '';
      if (name) {
        x.save();
        x.translate(0, s * (hl + EZ / 2));
        // letters' feet toward the goal line: readable from the field of play
        if (s > 0) x.transform(-1, 0, 0, -1, 0, 0);
        const size = Math.min(EZ * 0.56, 5.6);
        const m = blockMetrics(name, size, 1.15, 0.9);
        const maxW = 2 * hw * 0.84;
        const sq = Math.min(1.1, maxW / m.width);
        blockText(x, name, 0, size / 2, size, {
          align: 'center', weight: 1.15, gap: 0.9, squeeze: sq,
          color: ez.color || white, outline: ez.outline ? 0.22 : 0, outlineColor: ez.outline || '#000',
        });
        x.restore();
      }
    }
  }
  // ---- border (pro: 2-yd solid white around the field; college: 4 ft)
  x.fillStyle = white;
  if (border === 'pro' || border === 'college') {
    const b = border === 'pro' ? 2 : 1.333;
    x.fillRect(hw, -E - b, b, 2 * (E + b));
    x.fillRect(-hw - b, -E - b, b, 2 * (E + b));
    x.fillRect(-hw - b, E, 2 * (hw + b), b);
    x.fillRect(-hw - b, -E - b, 2 * (hw + b), b);
  }
  // ---- lines, ticks, hashes
  for (const r of plan.lines) x.fillRect(r[0], r[1], r[2], r[3]);
  if (border !== 'park' || opts.ticks !== false) for (const r of plan.ticks) x.fillRect(r[0], r[1], r[2], r[3]);
  // ---- coaching boxes + team areas
  const box = opts.boxColor || (border === 'pro' ? '#f0d020' : white);
  if (border !== 'park') {
    const zc = hl - (field.size === 'full' ? 18 : 15);
    const off = border === 'pro' ? 2 : 0;
    for (const s of [-1, 1]) {
      const xr = s * (hw + off + 2);           // restraining line
      x.fillStyle = box;
      if (border === 'hs') {
        for (let z = -hl; z < hl; z += 1) x.fillRect(xr - lw / 2, z, lw, 0.5);
      } else x.fillRect(xr - lw / 2, -hl, lw, 2 * hl);
      // coaching box: hatched between the restraining line and the team area
      const xa = s * (hw + off + 2), xb = s * (hw + off + 4.5);
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      x.fillRect(lo, -zc - lw / 2, hi - lo, lw);
      x.fillRect(lo, zc - lw / 2, hi - lo, lw);
      x.fillRect(xb - lw / 2, -zc, lw, 2 * zc);
      x.save();
      x.beginPath();
      x.rect(lo, -zc, hi - lo, 2 * zc);
      x.clip();
      x.globalAlpha = border === 'pro' ? 0.0 : 0.55;
      for (let z = -zc - 4; z < zc + 4; z += 1.2) {
        x.beginPath();
        x.moveTo(lo, z); x.lineTo(lo + lw * 1.4, z); x.lineTo(hi + lw * 1.4, z + (hi - lo)); x.lineTo(hi, z + (hi - lo));
        x.closePath();
        x.fill();
      }
      x.restore();
    }
  }
  // ---- yard numbers + arrows
  if (opts.numbers !== false) {
    const H = field.numberHeight;
    const inset = field.numberInset;
    const wt = 1.2;
    const m1 = blockMetrics('0', H, wt);
    const digitW = m1.width * 0.88;
    const gap = 0.55;
    for (let y = 10; y < field.L; y += 10) {
      const zl = -hl + y;
      const n = field.yardNumberAt(zl);
      const str = String(n);
      for (const s of [-1, 1]) {
        x.save();
        x.translate(s * (hw - inset), zl);
        // text space: +X = text right, +Y = text down (toward this sideline)
        if (s > 0) x.transform(0, -1, 1, 0, 0, 0); else x.transform(0, 1, -1, 0, 0, 0);
        x.fillStyle = white;
        const t = str.length > 1 ? str[0] : '';
        const o = str.length > 1 ? str[1] : str[0];
        const opt = { weight: wt, color: white, squeeze: 0.88 };
        if (t) blockText(x, t, -gap / 2, 0, H, { ...opt, align: 'right' });
        blockText(x, o, gap / 2, 0, H, { ...opt, align: 'left' });
        // arrow toward the nearest goal line (none at midfield)
        if (Math.abs(zl) > 0.5) {
          const toward = Math.sign(zl);           // world z direction of the nearest goal line
          const textDir = s > 0 ? -toward : toward; // in text-space X
          const ax = textDir * (gap / 2 + digitW + 0.42);
          const ay = -H * 0.86;
          x.beginPath();
          x.moveTo(ax + textDir * 0.55, ay);
          x.lineTo(ax - textDir * 0.35, ay - 0.27);
          x.lineTo(ax - textDir * 0.35, ay + 0.27);
          x.closePath();
          x.fill();
        }
        x.restore();
      }
    }
  }
  // ---- midfield logo (+ optional logos at the 25s)
  if (opts.logo) {
    const S = opts.logoSize || Math.min(field.W * 0.26, 12);
    x.save();
    // readable from the -x (home / press box) sideline
    x.transform(0, 1, -1, 0, 0, 0);
    x.drawImage(opts.logo, -S / 2, -S / 2, S, S);
    x.restore();
  }
  if (opts.sideLogos) {
    const S = 3.2;
    for (const s of [-1, 1]) {
      x.save();
      x.translate(0, s * (hl - 25 * field.L / 100));
      x.transform(0, 1, -1, 0, 0, 0);
      x.globalAlpha = 0.9;
      x.drawImage(opts.sideLogos, -S / 2, -S / 2, S, S);
      x.restore();
    }
  }
}

function wearPaint(x, field, opts, ext, tz0) {
  const W = opts.wear ?? 0.4;
  const rng = makeRng('pwear' + (opts.seed || ''));
  x.save();
  x.globalCompositeOperation = 'destination-out';
  // speckled loss everywhere (paint over grass is never solid)
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = x.createPattern(grainCanvas(128, 'paintloss', 0.8, '0,0,0', '0,0,0', 0.5), 'repeat');
  x.globalAlpha = 0.5;
  x.fillRect(0, 0, ext.px, ext.px);
  x.globalAlpha = 1;
  x.setTransform(ext.ppy, 0, 0, ext.ppy, -ext.x0 * ext.ppy, -tz0 * ext.ppy);
  // scuffed between the hashes, numbers worn at the edges
  const n = Math.round(80 + W * 500);
  for (let i = 0; i < n; i++) {
    const wx = rng.gauss() * (field.hash + 1.5), wz = rng.gauss() * field.halfL * 0.6;
    blotch(x, wx, wz, 0.2 + rng() * 0.9, `rgba(0,0,0,${0.2 + rng() * 0.5 * W})`);
  }
  for (let i = 0; i < 90 * W + 10; i++) {
    const wx = (rng() < 0.5 ? -1 : 1) * (field.halfW - field.numberInset - rng() * field.numberHeight);
    const wz = (rng() - 0.5) * field.L;
    blotch(x, wx, wz, 0.15 + rng() * 0.5, `rgba(0,0,0,${0.3 + rng() * 0.5})`);
  }
  x.restore();
}

// ------------------------------------------------------------------ weather

function drawWeather(x, field, opts, ext, tz0, plan) {
  const wthr = opts.weather;
  const rng = makeRng('wx' + (opts.seed || '') + wthr);
  const turf = opts.surface === 'turf';
  const X0 = ext.x0, Z0 = ext.z0, WW = ext.x1 - ext.x0, HH = ext.z1 - ext.z0;
  if (wthr === 'rain') {
    // darker, saturated wet grass; mud between the hashes (grass only)
    x.fillStyle = 'rgba(0,18,10,0.12)';
    x.fillRect(X0, Z0, WW, HH);
    if (!turf) {
      for (const [wx, wz, r, a] of plan.wear) {
        blotch(x, wx, wz, r * 1.4, `rgba(96,72,44,${Math.min(0.7, a * 1.5)})`);
      }
      for (let i = 0; i < 60; i++) {
        const wx = rng.gauss() * field.hash * 0.8, wz = rng.gauss() * field.halfL * 0.5;
        blotch(x, wx, wz, 0.8 + rng() * 2.2, `rgba(88,64,38,${0.22 + rng() * 0.3})`);
      }
    }
  } else if (wthr === 'snow') {
    // a blanket of snow, trampled between the hashes, lines swept clear
    const [sc, sx] = cv(ext.px, ext.px);
    sx.setTransform(ext.ppy, 0, 0, ext.ppy, -ext.x0 * ext.ppy, -tz0 * ext.ppy);
    sx.fillStyle = '#e9eef4';
    sx.fillRect(X0, Z0, WW, HH);
    sx.save();
    sx.globalCompositeOperation = 'multiply';
    sx.globalAlpha = 0.35;
    sx.drawImage(noiseCanvas(256, 5, 14, 3, 1.3), X0, Z0, WW, HH);
    sx.restore();
    sx.save();
    sx.globalCompositeOperation = 'destination-out';
    // trampled / slushy
    for (let i = 0; i < 260; i++) {
      const wx = rng.gauss() * (field.hash + 2), wz = rng.gauss() * field.halfL * 0.55;
      blotch(sx, wx, wz, 0.6 + rng() * 2.4, `rgba(0,0,0,${0.15 + rng() * 0.35})`);
    }
    // swept lines: a brushed strip wider than the paint
    sx.fillStyle = 'rgba(0,0,0,0.92)';
    for (const r of plan.lines) {
      const horiz = r[2] > r[3];
      if (horiz) sx.fillRect(r[0], r[1] - 0.12, r[2], r[3] + 0.24);
      else sx.fillRect(r[0] - 0.12, r[1], r[2] + 0.24, r[3]);
    }
    sx.fillStyle = 'rgba(0,0,0,0.75)';
    for (const r of plan.ticks) sx.fillRect(r[0] - 0.08, r[1] - 0.08, r[2] + 0.16, r[3] + 0.16);
    sx.restore();
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 0.93;
    x.drawImage(sc, 0, 0);
    x.restore();
    // brushed edges: a little snow dust back over the swept strips
    x.fillStyle = 'rgba(235,240,246,0.18)';
    for (const r of plan.lines) {
      const horiz = r[2] > r[3];
      if (horiz) { x.fillRect(r[0], r[1] - 0.14, r[2], 0.06); x.fillRect(r[0], r[1] + r[3] + 0.08, r[2], 0.06); }
    }
    sc.width = sc.height = 1;
  } else if (opts.frozen) {
    x.save();
    x.globalAlpha = 0.32;
    x.globalCompositeOperation = 'screen';
    x.drawImage(noiseCanvas(256, 31, 20, 3, 1.4), X0, Z0, WW, HH);
    x.restore();
    x.fillStyle = 'rgba(205,220,230,0.12)';
    x.fillRect(X0, Z0, WW, HH);
  }
}

/** Roughness (G channel) over the whole extent at 4 px/yd: wet grass, mud, puddles. */
function roughMap(field, opts, ext, plan) {
  const ppy = 4;
  const w = Math.round((ext.x1 - ext.x0) * ppy), h = Math.round((ext.z1 - ext.z0) * ppy);
  const [c, x] = cv(w, h);
  const turf = opts.surface === 'turf';
  const wet = opts.weather === 'rain';
  const snow = opts.weather === 'snow';
  const base = snow ? 0.62 : wet ? (turf ? 0.42 : 0.58) : (turf ? 0.78 : 0.92);
  const g = (v) => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${k},${k},${k})`; };
  x.fillStyle = g(base);
  x.fillRect(0, 0, w, h);
  x.setTransform(ppy, 0, 0, ppy, -ext.x0 * ppy, -ext.z0 * ppy);
  // painted lines are a bit smoother
  x.fillStyle = g(base - 0.12);
  for (const r of plan.lines) x.fillRect(r[0], r[1], r[2], Math.max(r[3], 0.25));
  if (wet) {
    const rng = makeRng('puddles' + opts.seed);
    if (!turf) for (const [wx, wz, r] of plan.wear) blotch(x, wx, wz, r * 1.3, 'rgba(60,60,60,0.5)');
    for (let i = 0; i < 40; i++) {
      const wx = (rng() - 0.5) * 2 * (field.halfW + 6), wz = (rng() - 0.5) * 2 * field.end;
      blotch(x, wx, wz, 1 + rng() * 3, 'rgba(10,10,10,0.7)');
    }
  }
  return c;
}

/** A tiling ground texture for the area around the painted tiles (8 yd per repeat). */
export function apronCanvas(opts, px = 512) {
  const turf = opts.surface === 'turf';
  const [base] = opts.grass || (turf ? ['#2f7a34'] : ['#3d7a2c']);
  const [c, x] = cv(px, px);
  x.fillStyle = base;
  x.fillRect(0, 0, px, px);
  x.save();
  x.globalCompositeOperation = 'soft-light';
  x.globalAlpha = turf ? 0.15 : 0.35;
  x.drawImage(noiseCanvas(256, 13, 6, 3, 1.2), 0, 0, px, px);
  x.restore();
  x.fillStyle = 'rgba(30,25,10,0.08)';
  x.fillRect(0, 0, px, px);
  x.fillStyle = x.createPattern(grainCanvas(256, turf ? 'turfg' : 'grassg', 0.9, turf ? '200,255,200' : '220,255,170', '0,20,0', 0.2), 'repeat');
  x.fillRect(0, 0, px, px);
  return c;
}
