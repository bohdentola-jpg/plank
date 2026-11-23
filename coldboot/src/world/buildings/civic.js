// Shared body for the town's boxy public buildings (post office, clinic, police,
// city hall, community hall, school, radio station, terminal, bar, diner…):
// walls with auto-laid-out windows that dodge the doors, a roof, an entry
// canopy or porch with steps/ramp, a sign, an optional flag pole.
import {
  walls, roofGable, roofHip, roofFlat, roofShed, raisedFloor, steps, porch, porchLight, sign, flagpole, stovepipe,
  sideFrame, windowCond, weather, rgb, LIGHT, PI, HALF_PI,
} from './common.js';

/**
 * spec: { W, D, cx, cz, fy, storeys, sH, key, color, trim, glass, grime,
 *   roof: {type, axis, pitch, key, color, eave, rake, parapet, high},
 *   win: {w, h, sill, per, style, cell, lit, sides:[bool x4], margin, gx, gy},
 *   doors: [{side, u, w, h, style, color, id, leaf, light}],
 *   entry: {type:'canopy'|'porch'|'none', w, d, h, roofKey, roofColor, posts},
 *   access: 'steps'|'ramp'|'both'|'none', skirt, inner }
 * returns { wallTop, yRidge, sides }
 */
export function civic(ctx, spec) {
  const b = ctx.b;
  const W = spec.W, D = spec.D, fy = spec.fy ?? 0.4, n = spec.storeys ?? 1, sH = spec.sH ?? 3.2;
  const cx = spec.cx || 0, cz = spec.cz || 0;
  const wallTop = fy + n * sH;
  const trim = spec.trim || '#e8e4da';
  const win = spec.win || {};
  const sides = [[], [], [], []];
  for (const d of spec.doors || []) sides[d.side].push({ kind: 'door', u: d.u, y: fy, w: d.w ?? 0.95, h: d.h ?? 2.15, style: d.style || 'steel', color: d.color || '#6a6a66', id: d.id, leaf: d.leaf, light: d.light || LIGHT.dim, open: d.open, frame: d.frame, glass: d.glass, cell: d.cell });
  const ww = win.w ?? 1.1, wh = win.h ?? 1.3, per = win.per ?? 2.6, sill = win.sill ?? 0.95, margin = win.margin ?? 1.2;
  for (let s = 0; s < 4; s++) {
    if (win.sides && !win.sides[s]) continue;
    const len = s % 2 === 0 ? W : D;
    const doorOps = sides[s].filter((o) => o.kind === 'door');
    const cnt = Math.max(1, Math.floor((len - 2 * margin) / per) + 1);
    for (let k = 0; k < n; k++) {
      const extra = (win.extraByStorey && win.extraByStorey[k]) || {};
      for (let i = 0; i < cnt; i++) {
        const u = cnt === 1 ? len / 2 : margin + ((len - 2 * margin) * i) / (cnt - 1);
        if (k === 0 && doorOps.some((d) => Math.abs(d.u - u) < (d.w ?? 0.95) / 2 + ww / 2 + 0.35)) continue;
        if (win.skip && win.skip(s, k, i, u)) continue;
        const lit = typeof win.lit === 'function' ? win.lit(s, k, i) : ctx.lit(win.lit ?? 0.5);
        sides[s].push({ kind: 'win', u, y: fy + k * sH + sill, w: extra.w ?? ww, h: extra.h ?? wh, style: win.style || 'dh', gx: win.gx, gy: win.gy, light: lit, cond: windowCond(ctx, win.condBias ?? -0.05), cell: win.cell ?? 7, trim: win.trim });
      }
    }
  }
  if (spec.extraOps) for (const [s, op] of spec.extraOps) sides[s].push(op);
  const rf = spec.roof || { type: 'gable' };
  let gable = null, shed = null;
  if (rf.type === 'gable') gable = { axis: rf.axis || 'x', yRidge: wallTop + ((rf.axis === 'z' ? W : D) / 2) * (rf.pitch ?? 0.45) };
  if (rf.type === 'shed') {
    const rise = D * (rf.pitch ?? 0.15);
    shed = { hi: rf.high || 'front', yFront: rf.high === 'back' ? wallTop : wallTop + rise, yBack: rf.high === 'back' ? wallTop + rise : wallTop };
  }
  walls(ctx, {
    W, D, cx, cz, y0: fy - 0.05, y1: wallTop, key: spec.key || 'siding_lap', color: spec.color || '#c8c0b0', trim, sides, gable,
    shed, thick: 0.25, corner: spec.corner ?? 0.12, inner: spec.inner || null, glass: spec.glass, grime: spec.grime, sideColor: spec.sideColor,
    trimKey: spec.trimKey, recess: spec.recess, casing: spec.casing, bands: spec.bands,
  });
  let yRidge = wallTop;
  const rk = rf.key || 'metal_corr_paint', rc = rf.color || '#5a5e60';
  if (rf.type === 'gable') yRidge = roofGable(ctx, { W, D, cx, cz, yEave: wallTop, pitch: rf.pitch ?? 0.45, axis: rf.axis || 'x', eave: rf.eave ?? 0.5, rake: rf.rake ?? 0.35, key: rk, color: rc, trim: rf.trim || trim, wear: ctx.wear, icicles: rf.icicles, gutters: rf.gutters }).yRidge;
  else if (rf.type === 'hip') yRidge = roofHip(ctx, { W, D, cx, cz, yEave: wallTop, pitch: rf.pitch ?? 0.4, eave: rf.eave ?? 0.5, key: rk, color: rc, trim: rf.trim || trim }).yRidge;
  else if (rf.type === 'flat') { roofFlat(ctx, { W, D, cx, cz, y: wallTop, parapet: rf.parapet ?? 0.5, key: rf.wallKey || 'paint', color: rf.parapetColor || spec.color, capColor: rf.capColor || '#8a8e90' }); yRidge = wallTop + (rf.parapet ?? 0.5); }
  else if (rf.type === 'shed') { roofShed(ctx, { W, D, cx, cz, yLow: Math.min(shed.yFront, shed.yBack), yHigh: Math.max(shed.yFront, shed.yBack), high: shed.hi, key: rk, color: rc, trim, eave: rf.eave ?? 0.5, rake: rf.rake ?? 0.3, icicles: rf.icicles }); yRidge = Math.max(shed.yFront, shed.yBack); }
  // base
  if (fy > 0.25) raisedFloor(ctx, { W, D, cx, cz, floorY: fy, skirt: spec.skirt ?? 'plywood', gaps: ctx.wear > 0.5 ? (ctx.wear - 0.5) * 0.4 : 0, trim, color: spec.skirtColor, postKey: spec.postKey });
  else b.box('concrete', cx, -0.1, cz, W + 0.1, fy + 0.1, D + 0.1, { color: '#8a8a86', skip: 't' });
  // entry at the main door
  const main = (spec.doors || []).find((d) => d.main) || (spec.doors || [])[0];
  if (main && spec.entry && spec.entry.type !== 'none') entry(ctx, spec, main, wallTop);
  if (!spec.noCollider) ctx.col(cx, cz, W, D, wallTop);
  return { wallTop, yRidge, sides };
}

/** Entry for a door on side s: canopy on posts / brackets, or a porch, + steps/ramp. */
function entry(ctx, spec, d, wallTop) {
  const b = ctx.b;
  const e = spec.entry;
  const W = spec.W, D = spec.D, fy = spec.fy ?? 0.4;
  sideFrame(b, d.side, W, D, spec.cx || 0, spec.cz || 0);
  const ew = e.w ?? 3.0, ed = e.d ?? 1.8;
  const trim = spec.trim || '#e8e4da';
  if (e.type === 'porch') {
    b.push().translate(d.u, 0, 0);
    porch(ctx, 0, ed / 2, ew, ed, fy, { wear: ctx.wear, roof: e.roof !== false, roofKey: e.roofKey || 'metal_corr', roofColor: e.roofColor || '#8a8e90', postColor: trim, gap: 0.65, postH: e.h ?? 2.5, rail: fy > 0.35 });
    b.pop();
  } else {
    // canopy: a thin slab with a fascia, on two posts or on brackets
    const ch = fy + (e.h ?? 2.7);
    b.box(e.roofKey || 'sheet_metal', d.u, ch, ed / 2, ew, 0.22, ed, { color: e.roofColor || trim });
    b.box('paint', d.u, ch - 0.06, ed / 2, ew + 0.04, 0.08, ed + 0.04, { color: trim });
    if (e.posts !== false) for (const sx of [-1, 1]) b.box(e.postKey || 'paint', d.u + sx * (ew / 2 - 0.12), 0, ed - 0.12, 0.14, ch, 0.14, { color: e.postColor || trim });
    else for (const sx of [-1, 1]) b.beam('metal', [d.u + sx * (ew / 2 - 0.3), ch - 0.9, 0.02], [d.u + sx * (ew / 2 - 0.3), ch, ed - 0.2], 0.06, 0.06, { color: '#4a4a4a' });
    // landing slab
    if (fy > 0.15) {
      b.box('concrete', d.u, 0, ed / 2, ew, fy, ed, { color: '#a8a8a2' });
      ctx.floorLocal(d.u, ed / 2, ew, ed, fy);
    }
    // light under the canopy
    b.box('neon', d.u, ch - 0.07, ed / 2, 0.4, 0.02, 0.4, { color: ctx.state > 0.2 ? [5, 4.4, 3.6] : [0.05, 0.05, 0.05] });
    if (ctx.state > 0.2) ctx.light(d.u, ch - 0.3, ed / 2 + 0.3, 0xffe0b0, 1.6, 8, true);
  }
  // steps and/or ramp down from the landing
  const acc = spec.access || 'steps';
  if (fy > 0.15 && (acc === 'steps' || acc === 'both')) steps(ctx, d.u, ed, 0, { rise: fy, w: Math.min(ew - 0.2, 1.8), solid: e.type !== 'porch', key: e.type === 'porch' ? 'wood_raw' : 'concrete', color: e.type === 'porch' ? '#9a8466' : '#a8a8a2' });
  if (fy > 0.15 && (acc === 'ramp' || acc === 'both')) {
    // wheelchair ramp along the wall (1:12)
    const len = fy * 12 > 9 ? 9 : fy * 12;
    const x0 = d.u + ew / 2;
    b.push().translate(x0 + len / 2, 0, ed - 0.6);
    b.poly('concrete', [[-len / 2, fy, -0.6], [len / 2, 0.02, -0.6], [len / 2, 0.02, 0.6], [-len / 2, fy, 0.6]].map(([x, y, z]) => [x, y, z]), { color: '#a8a8a2', want: [fy, 1, 0] });
    b.poly('concrete', [[-len / 2, 0, 0.6], [len / 2, 0, 0.6], [len / 2, 0.02, 0.6], [-len / 2, fy, 0.6]], { color: '#9a9a94', want: [0, 0, 1] });
    for (const z of [-0.62, 0.62]) b.beam('galv', [-len / 2, fy + 0.9, z], [len / 2, 0.92, z], 0.04, 0.04, { color: '#a8aeb0' });
    for (let i = 0; i <= 4; i++) for (const z of [-0.62, 0.62]) b.box('galv', -len / 2 + (len * i) / 4, 0, z, 0.05, fy * (1 - i / 4) + 0.9, 0.05, { color: '#a8aeb0' });
    ctx.rampLocal(len / 2 - len, 0, 1.2, len, 0, fy, false);
    // the ramp's +Z must point up the slope (toward −x of this frame)
    const last = ctx.ramps[ctx.ramps.length - 1];
    const p0 = b.P(len / 2, 0, 0), p1 = b.P(-len / 2, 0, 0);
    last.x = (p0[0] + p1[0]) / 2; last.z = (p0[2] + p1[2]) / 2;
    last.rot = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]);
    last.w = 1.2; last.d = len;
    b.pop();
  }
  b.pop();
}

/** Ground-mounted monument sign (two posts + board), facing +z of the current frame. */
export function monumentSign(ctx, key, x, z, w, h, spec, o = {}) {
  const b = ctx.b;
  b.push().translate(x, 0, z).rotateY(o.rot || 0);
  for (const sx of [-1, 1]) b.box(o.postKey || 'wood_raw', sx * (w / 2 + 0.05), 0, 0, 0.14, h + (o.lift ?? 0.6) + 0.1, 0.14, { color: o.postColor || '#5a4a3a' });
  b.box(o.boardKey || 'paint', 0, o.lift ?? 0.6, -0.03, w + 0.1, h + 0.1, 0.06, { color: o.board || '#2a3a4a' });
  sign(ctx, key, 0, (o.lift ?? 0.6) + h / 2 + 0.05, 0.005, w, h, spec, { back: false });
  b.push().rotateY(PI);
  sign(ctx, key, 0, (o.lift ?? 0.6) + h / 2 + 0.05, 0.065, w, h, spec, { back: false });
  b.pop();
  b.pop();
}

export { flagpole, stovepipe, porchLight, rgb, weather, LIGHT, PI, HALF_PI, sideFrame };
