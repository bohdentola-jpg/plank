// Residential houses of Port Zarya — many variations by seed:
//   ranch (1-storey side gable), twostory, frontgable (1½ storey), shed (mono-pitch
//   80s HUD house), trailer (single-wide on blocks), quonset, cabin.
// Raised on posts with skirting, arctic entries, stovepipes, oil tanks, dishes,
// snowmobiles and fuel drums in the yard; state 0 run-down … 1 restored.
import {
  makeCtx, finish, walls, roofGable, roofShed, raisedFloor, steps, porch, arcticEntry, stovepipe, chimney,
  porchLight, sideFrame, wallFace, pick, chance, range, windowCond, weather, rgb, LIGHT,
  SIDING_COLORS, TRIM_COLORS, ROOF_COLORS, DOOR_COLORS, PI, HALF_PI, icicles,
} from './common.js';
import { addProp } from '../props.js';

const VARIANTS = [['ranch', 0.3], ['twostory', 0.18], ['frontgable', 0.17], ['shed', 0.1], ['trailer', 0.11], ['quonset', 0.05], ['cabin', 0.09]];

export function build(opts = {}) {
  const ctx = makeCtx('house', opts);
  const r = ctx.rng;
  let variant = opts.variant;
  if (!variant) {
    let x = r();
    for (const [v, p] of VARIANTS) { if ((x -= p) <= 0) { variant = v; break; } }
    variant = variant || 'ranch';
  }
  ctx.variant = variant;
  const wear = ctx.wear;
  // palette
  const baseColor = opts.color || pick(ctx, SIDING_COLORS);
  ctx.paint = weather(baseColor, Math.max(0, wear - 0.15) * 1.1);
  ctx.trim = weather(opts.trim || (chance(ctx, 0.75) ? '#efeadc' : pick(ctx, TRIM_COLORS)), wear * 0.6);
  ctx.roofColor = pick(ctx, ROOF_COLORS);
  ctx.doorColor = pick(ctx, DOOR_COLORS);
  if (variant === 'trailer') trailer(ctx);
  else if (variant === 'quonset') quonset(ctx);
  else boxHouse(ctx, variant);
  yard(ctx);
  return finish(ctx);
}

function sidingKey(ctx, prefer) {
  const w = ctx.wear;
  if (prefer === 'panel') return w > 0.6 && chance(ctx, 0.6) ? 'siding_peel' : 'siding_panel';
  if (w > 0.62) return chance(ctx, 0.5) ? 'siding_lap_old' : 'siding_peel';
  if (w > 0.45 && chance(ctx, 0.35)) return 'siding_lap_old';
  return 'siding_lap';
}

function roofChoice(ctx) {
  const w = ctx.wear;
  const metal = chance(ctx, 0.62);
  if (metal) {
    if (w > 0.55 && chance(ctx, 0.7)) return { key: 'metal_corr_rust', color: '#ffffff' };
    if (chance(ctx, 0.35)) return { key: 'metal_corr', color: weather('#ffffff', w * 0.4) };
    return { key: 'metal_corr_paint', color: weather(ctx.roofColor, w * 0.8) };
  }
  return { key: 'roof_shingle', color: weather(pick(ctx, ['#4a4440', '#3a3c40', '#5a4636', '#3e4a3e', '#2c2c2e', '#6a5a4a']), w * 0.5) };
}

// ------------------------------------------------------------------ box houses

function boxHouse(ctx, variant) {
  const b = ctx.b, r = ctx.rng, wear = ctx.wear;
  let W, D, storeys = 1, roofType = 'gable', axis = 'x', pitch;
  if (variant === 'ranch') { W = range(ctx, 8.5, 11.5); D = range(ctx, 6.8, 8.2); pitch = range(ctx, 0.33, 0.55); }
  else if (variant === 'twostory') { W = range(ctx, 7.2, 9.2); D = range(ctx, 6.6, 7.8); storeys = 2; pitch = range(ctx, 0.42, 0.66); axis = chance(ctx, 0.6) ? 'x' : 'z'; }
  else if (variant === 'frontgable') { W = range(ctx, 6.4, 7.6); D = range(ctx, 8.5, 10.5); axis = 'z'; pitch = range(ctx, 0.75, 1.0); }
  else if (variant === 'shed') { W = range(ctx, 8, 10.5); D = range(ctx, 7, 8.4); roofType = 'shed'; pitch = range(ctx, 0.18, 0.28); }
  else { W = range(ctx, 5.0, 6.2); D = range(ctx, 5.4, 6.6); pitch = range(ctx, 0.7, 0.95); axis = chance(ctx, 0.5) ? 'x' : 'z'; }
  const cabin = variant === 'cabin';
  const floorY = cabin ? range(ctx, 0.35, 0.7) : range(ctx, 0.55, 1.25);
  const sH = 2.75;
  const wallTop = floorY + sH * storeys + (variant === 'frontgable' ? 0.0 : 0);
  const key = cabin && chance(ctx, 0.6) ? 'logs' : sidingKey(ctx, variant === 'shed' || chance(ctx, 0.25) ? 'panel' : 'lap');
  const paint = key === 'logs' ? weather('#c8a27a', wear * 0.5) : ctx.paint;
  const trim = key === 'logs' ? weather('#8a6a4a', wear * 0.3) : ctx.trim;
  ctx.footprint = { w: W + 1.2, d: D + 1.2 };

  // ---- openings
  const sides = [[], [], [], []];
  const doorU = W * (chance(ctx, 0.5) ? range(ctx, 0.22, 0.35) : range(ctx, 0.65, 0.78));
  const doorLeftSide = doorU < W / 2;
  const frontDoor = { kind: 'door', u: doorU, y: floorY, w: 0.9, h: 2.05, style: chance(ctx, 0.55) ? 'steel' : 'panel', color: weather(ctx.doorColor, wear * 0.5), id: 'house', light: ctx.lit(0.5) };
  sides[0].push(frontDoor);
  const sill = floorY + 0.92;
  const winStyle = pick(ctx, ['slider', 'slider', 'dh', 'dh', 'fixed', 'grid']);
  const mk = (u, y, w, h, extra = {}) => ({ kind: 'win', u, y, w, h, style: winStyle, light: ctx.lit(0.55), cond: windowCond(ctx), ...extra });
  // front: picture window on the far side from the door, a small one near it
  const farU = doorLeftSide ? W * range(ctx, 0.6, 0.72) : W * range(ctx, 0.28, 0.4);
  const picW = cabin ? 1.0 : range(ctx, 1.4, 2.1);
  sides[0].push(mk(farU, sill, picW, 1.25, { style: winStyle === 'grid' ? 'grid' : 'pane2', gx: 3 }));
  if (!cabin && W > 8.5) {
    const nearU = doorLeftSide ? Math.max(0.8, doorU - 1.5) : Math.min(W - 0.8, doorU + 1.5);
    if (Math.abs(nearU - doorU) > 1.1 && Math.abs(nearU - farU) > picW / 2 + 0.9) sides[0].push(mk(nearU, sill + 0.3, 0.7, 0.9));
  }
  // sides
  for (const s of [1, 3]) {
    const n = cabin ? 1 : D > 7.5 ? 2 : 1;
    const us = n === 1 ? [D * range(ctx, 0.4, 0.6)] : [D * 0.28, D * 0.72];
    for (const u of us) sides[s].push(mk(u, sill, range(ctx, 0.75, 1.05), 1.15));
  }
  // back
  {
    const n = cabin ? 1 : W > 9 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const u = (W * (i + 0.5)) / n;
      if (i === 0 && chance(ctx, 0.45) && !cabin) sides[2].push({ kind: 'door', u, y: floorY, w: 0.86, h: 2.03, style: 'steel', color: '#7a7a76', light: LIGHT.off });
      else sides[2].push(mk(u, sill + (i === n - 1 ? 0.3 : 0), i === n - 1 ? 0.6 : 0.9, i === n - 1 ? 0.75 : 1.1));
    }
  }
  // upper storey
  if (storeys === 2) {
    const y2 = floorY + sH + 0.9;
    for (const s of [0, 2]) {
      const n = W > 8 ? 3 : 2;
      for (let i = 0; i < n; i++) sides[s].push(mk((W * (i + 0.5)) / n, y2, 0.9, 1.1));
    }
    for (const s of [1, 3]) sides[s].push(mk(D / 2, y2, 0.9, 1.1));
  }
  // attic window in the gable of a front-gable 1½ storey
  const yR = wallTop + (axis === 'x' ? D : W) / 2 * pitch;
  if (variant === 'frontgable' || (cabin && axis === 'z')) {
    const ya = wallTop + 0.35;
    if (yR - ya > 1.4) {
      sides[0].push(mk(W / 2, ya, 0.85, 1.0, { style: 'dh' }));
      sides[2].push(mk(W / 2, ya, 0.85, 1.0, { style: 'dh' }));
    }
  }

  // ---- walls
  const gable = roofType === 'gable' ? { axis, yRidge: yR } : null;
  const shedInfo = roofType === 'shed' ? (() => { const hi = chance(ctx, 0.5) ? 'front' : 'back'; const rise = D * pitch; return { hi, yFront: hi === 'front' ? wallTop + rise : wallTop, yBack: hi === 'back' ? wallTop + rise : wallTop }; })() : null;
  // run-down houses: one side re-sided in a different paint/plywood
  const sideColor = [paint, paint, paint, paint];
  if (wear > 0.45 && chance(ctx, 0.4)) sideColor[1 + ((r() * 3) | 0)] = weather(pick(ctx, SIDING_COLORS), wear);
  walls(ctx, {
    W, D, y0: floorY - 0.05, y1: wallTop, key, color: paint, sideColor, trim, sides, gable,
    shed: shedInfo, thick: 0.2, corner: key === 'logs' ? 0 : 0.1, bands: key !== 'logs',
  });
  if (key === 'logs') logCorners(ctx, W, D, floorY, wallTop);
  ctx.col(0, 0, W, D, wallTop + 1);

  // plywood patches where siding failed
  if (wear > 0.5) {
    const n = Math.floor((wear - 0.45) * 6);
    for (let i = 0; i < n; i++) {
      const s = (r() * 4) | 0;
      const len = sideFrame(b, s, W, D);
      const pw = range(ctx, 0.8, 1.5), ph = range(ctx, 0.6, 1.4);
      const u = range(ctx, 0.3 + pw / 2, len - 0.3 - pw / 2), y = floorY + range(ctx, 0.0, 1.0);
      const clash = (ctx.lastOps = s === 0 ? sides[0] : sides[s]).some((op) => Math.abs(op.u - u) < (op.w || 0.9) / 2 + pw / 2 + 0.15 && y < op.y + (op.h || 2) && y + ph > op.y);
      if (!clash) b.box(chance(ctx, 0.5) ? 'plywood' : 'osb', u, y, 0.03, pw, ph, 0.014, { color: weather('#b8a888', 0.3 + r() * 0.5) });
      b.pop();
    }
  }

  // ---- roof
  const rf = roofChoice(ctx);
  const ice = wear < 0.7 && chance(ctx, 0.55) ? range(ctx, 0.4, 1.0) : 0;
  let roofTop;
  if (roofType === 'gable') {
    const res = roofGable(ctx, { W, D, yEave: wallTop, pitch, axis, eave: range(ctx, 0.35, 0.55), rake: range(ctx, 0.25, 0.4), key: rf.key, color: rf.color, trim, wear, icicles: ice, gutters: chance(ctx, 0.2) });
    roofTop = res.yRidge;
  } else {
    roofShed(ctx, { W, D, yLow: Math.min(shedInfo.yFront, shedInfo.yBack), yHigh: Math.max(shedInfo.yFront, shedInfo.yBack), high: shedInfo.hi, key: rf.key, color: rf.color, trim, eave: 0.5, rake: 0.35, icicles: ice });
    roofTop = Math.max(shedInfo.yFront, shedInfo.yBack);
  }

  // ---- base
  raisedFloor(ctx, {
    W, D, floorY, skirt: chance(ctx, 0.7) ? pick(ctx, ['plywood', 'plywood', 't111']) : null,
    gaps: wear > 0.4 ? (wear - 0.35) * 0.5 : 0, trim, postKey: chance(ctx, 0.25) ? 'galv' : 'wood_raw',
    color: chance(ctx, 0.5) ? weather(paint, 0.3) : undefined,
  });

  // ---- entry: arctic entry (most) or porch/deck
  const doorX = -W / 2 + doorU;
  const useEntry = chance(ctx, cabin ? 0.4 : 0.62);
  let doorOut;
  if (useEntry) {
    const ew = range(ctx, 1.8, 2.4), ed = range(ctx, 1.4, 2.0);
    const eSide = chance(ctx, 0.6) ? 'front' : doorLeftSide ? 'left' : 'right';
    const eKey = wear > 0.5 && chance(ctx, 0.5) ? 'plywood' : chance(ctx, 0.6) ? key === 'logs' ? 'siding_panel' : key : 'siding_panel';
    const eColor = eKey === 'plywood' ? weather('#b8a07a', wear) : chance(ctx, 0.7) ? paint : weather(pick(ctx, SIDING_COLORS), wear * 0.8);
    doorOut = arcticEntry(ctx, doorX, D / 2 + ed / 2, {
      w: ew, d: ed, h: 2.4, floorY, key: eKey, color: eColor, trim, doorSide: eSide,
      doorStyle: chance(ctx, 0.6) ? 'steel' : 'panel', doorColor: weather(ctx.doorColor, wear * 0.4),
      roofKey: rf.key === 'roof_shingle' ? 'metal_corr' : rf.key, roofColor: rf.color, gable: chance(ctx, 0.35), light: ctx.lit(0.4),
      lightOn: chance(ctx, 0.7 * ctx.state + 0.2), icicles: ice * 0.7,
    });
    // steps up to the entry door
    if (floorY > 0.25) {
      const sx = doorOut.x, sz = doorOut.z;
      const out = 0.02;
      steps(ctx, sx + Math.sin(doorOut.rot) * out, sz + Math.cos(doorOut.rot) * out, doorOut.rot, { rise: floorY, w: 1.1, rail: floorY > 0.6 && chance(ctx, 0.6), solid: false });
    }
  } else {
    const pw = cabin ? W : Math.min(W, range(ctx, 3.0, 5.0)), pd = range(ctx, 1.6, 2.4);
    const px = cabin ? 0 : Math.max(-W / 2 + pw / 2, Math.min(W / 2 - pw / 2, doorX));
    porch(ctx, px, D / 2 + pd / 2, pw, pd, floorY, { wear, roof: chance(ctx, cabin ? 0.9 : 0.45), roofColor: rf.color, roofKey: rf.key === 'roof_shingle' ? 'metal_corr' : rf.key, postColor: trim, gap: 0.6, icicles: ice * 0.6 });
    steps(ctx, px, D / 2 + pd, 0, { rise: floorY, w: 1.1, rail: false });
    porchLight(ctx, doorX + 0.75, floorY + 2.25, D / 2 + 0.03, 0, chance(ctx, 0.75 * ctx.state + 0.15));
    doorOut = { x: doorX, z: D / 2 + pd + 0.9, rot: 0 };
  }
  ctx.door = doorOut;
  ctx.doors.push({ id: 'front', x: doorOut.x, z: doorOut.z, rot: doorOut.rot, w: 0.9, leadsTo: 'exterior' });
  ctx.point('door', doorOut.x + Math.sin(doorOut.rot) * 1.2, 0, doorOut.z + Math.cos(doorOut.rot) * 1.2, doorOut.rot + PI);

  // ---- roof stuff
  const pipeX = range(ctx, -W / 3, W / 3), pipeZ = axis === 'x' ? range(ctx, -D / 4, D / 4) : range(ctx, -D / 3, D / 3);
  const roofYAt = (x, z) => {
    if (roofType === 'shed') {
      const t = (z + D / 2) / D; // 0 back .. 1 front
      return shedInfo.yBack + (shedInfo.yFront - shedInfo.yBack) * t + 0.15;
    }
    const d = axis === 'x' ? Math.abs(z) : Math.abs(x);
    return yR - d * pitch + 0.15;
  };
  if (chance(ctx, 0.82)) stovepipe(ctx, pipeX, roofYAt(pipeX, pipeZ), pipeZ, Math.max(roofTop + 0.6, roofYAt(pipeX, pipeZ) + 1.0), { lean: wear > 0.6 ? range(ctx, -0.06, 0.06) : 0 });
  else chimney(ctx, pipeX, roofYAt(pipeX, pipeZ) - 0.8, pipeZ, roofTop + 0.7, { color: chance(ctx, 0.5) ? '#a08a7a' : '#8a8a84', key: chance(ctx, 0.5) ? 'brick' : 'concrete' });
  // plumbing vent
  const vx = -pipeX * 0.6, vz = pipeZ * -0.5;
  b.cyl('plastic', vx, roofYAt(vx, vz) - 0.2, vz, 0.05, 0.55, { segs: 8, color: '#2a2a2a' });

  ctx.house = { W, D, floorY, wallTop, axis, pitch, roofTop, roofType, sides, key, paint, trim };
}

function logCorners(ctx, W, D, y0, y1) {
  const b = ctx.b;
  const n = Math.floor((y1 - y0) / 0.25);
  for (let i = 0; i < n; i++) {
    const y = y0 + i * 0.25 + 0.12;
    for (const [x, z] of [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) {
      const ax = i % 2 === 0;
      b.push().translate(x, y, z);
      if (ax) b.rotateZ(HALF_PI); else b.rotateX(HALF_PI);
      b.cyl('logs', 0, -0.3, 0, 0.13, 0.6, { segs: 8, color: '#b89a74' });
      b.pop();
    }
  }
}

// ------------------------------------------------------------------ trailer

function trailer(ctx) {
  const b = ctx.b, r = ctx.rng, wear = ctx.wear;
  const W = range(ctx, 14, 18), D = range(ctx, 4.2, 4.6);
  const floorY = range(ctx, 0.75, 1.0);
  const wallTop = floorY + 2.35;
  ctx.footprint = { w: W + 1, d: D + 3.5 };
  const skin = wear > 0.55 ? 'metal_paint_rust' : 'metal_corr_paint';
  const two = chance(ctx, 0.6);
  const c1 = weather(pick(ctx, ['#e8e2d0', '#c8d2c8', '#d8c8a8', '#b8c4cc', '#e0d8c8']), wear * 0.5);
  const sides = [[], [], [], []];
  const doorU = W * range(ctx, 0.3, 0.45);
  sides[0].push({ kind: 'door', u: doorU, y: floorY, w: 0.86, h: 1.95, style: 'steel', color: '#e8e4d8', light: LIGHT.dim, id: 'house' });
  const mk = (u, w = 1.0, h = 1.0) => ({ kind: 'win', u, y: floorY + 1.0, w, h, style: 'slider', light: ctx.lit(0.55), cond: windowCond(ctx), sashColor: '#b8bcbe', trim: '#c8ccce' });
  for (const u of [W * 0.1, W * 0.55, W * 0.72, W * 0.9]) if (Math.abs(u - doorU) > 1.2) sides[0].push(mk(u, u === W * 0.55 ? 1.6 : 1.0));
  for (const u of [W * 0.12, W * 0.35, W * 0.6, W * 0.88]) sides[2].push(mk(u, 0.9, 0.9));
  sides[1].push(mk(D / 2, 0.9, 0.9));
  sides[3].push(mk(D / 2, 0.9, 0.9));
  walls(ctx, { W, D, y0: floorY - 0.05, y1: wallTop, key: skin, color: c1, trim: '#c8ccce', sides, thick: 0.12, corner: 0.06, bands: false, recess: 0.04, casing: 0.05 });
  // trailer skin is horizontal-ribbed: add a stripe band
  if (two) {
    const c2 = weather(pick(ctx, ['#7a3a2a', '#3a4a6a', '#5a6a4a', '#8a6a3a']), wear * 0.5);
    for (let s = 0; s < 4; s++) {
      const len = sideFrame(b, s, W, D);
      b.boxMinMax('sheet_metal', 0, floorY + 0.55, 0.0, len, floorY + 0.75, 0.012, { color: c2 });
      b.pop();
    }
  }
  // low barrel roof
  const rf = wear > 0.5 ? 'metal_corr_rust' : 'metal_corr';
  b.push().translate(0, wallTop, 0).rotateZ(HALF_PI);
  b.cyl(rf, 0, -W / 2 - 0.05, 0, D / 2 + 0.08, W + 0.1, { segs: 10, thetaStart: HALF_PI - 0.55, thetaLen: 1.1, smooth: true, caps: '', color: '#ffffff', uvScale: [1, 1] });
  b.pop();
  // end caps of the barrel roof
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = -0.55 + (i / 8) * 1.1; pts.push([sx * (W / 2 + 0.05), wallTop + Math.cos(t) * (D / 2 + 0.08) - (D / 2 + 0.08) * Math.cos(0.55), Math.sin(t) * (D / 2 + 0.08)]); }
    b.poly('sheet_metal', pts, { color: '#c8ccce', want: [sx, 0, 0] });
  }
  // skirting + blocks
  raisedFloor(ctx, { W, D, floorY, skirt: chance(ctx, 0.75) ? 'plywood' : null, gaps: wear * 0.4, trim: '#c8ccce', color: weather('#a8a090', wear) });
  ctx.col(0, 0, W, D, wallTop + 0.6);
  // tongue (hitch) at one end, often still there
  if (chance(ctx, 0.5)) {
    b.beam('metal', [W / 2, 0.45, -0.5], [W / 2 + 1.4, 0.35, 0], 0.1, 0.1, { color: '#2a2a2a' });
    b.beam('metal', [W / 2, 0.45, 0.5], [W / 2 + 1.4, 0.35, 0], 0.1, 0.1, { color: '#2a2a2a' });
  }
  // built-on deck + arctic entry or steps
  const dx = -W / 2 + doorU;
  if (chance(ctx, 0.55)) {
    const eo = arcticEntry(ctx, dx, D / 2 + 0.8, { w: 2.0, d: 1.6, h: 2.2, floorY, key: chance(ctx, 0.6) ? 'plywood' : 'siding_panel', color: weather('#b8a07a', wear), trim: '#d8d2c4', doorSide: 'front', roofKey: 'metal_corr', icicles: 0.5 });
    steps(ctx, eo.x, eo.z + 0.02, eo.rot, { rise: floorY, w: 1.1 });
    ctx.door = eo;
  } else {
    porch(ctx, dx, D / 2 + 1.1, 3.0, 2.2, floorY, { wear, roof: false });
    steps(ctx, dx, D / 2 + 2.2, 0, { rise: floorY, w: 1.1 });
    porchLight(ctx, dx + 0.7, floorY + 2.1, D / 2 + 0.03, 0, chance(ctx, 0.6));
    ctx.door = { x: dx, z: D / 2 + 3.0, rot: 0 };
  }
  ctx.doors.push({ id: 'front', x: ctx.door.x, z: ctx.door.z, rot: ctx.door.rot, w: 0.86, leadsTo: 'exterior' });
  ctx.point('door', ctx.door.x, 0, ctx.door.z + 1.2, PI);
  stovepipe(ctx, W * 0.15, wallTop + 0.3, -0.6, wallTop + 1.5);
  ctx.house = { W, D, floorY, wallTop, roofTop: wallTop + 0.35, trailer: true };
}

// ------------------------------------------------------------------ quonset

function quonset(ctx) {
  const b = ctx.b, wear = ctx.wear;
  const R = range(ctx, 3.2, 4.2), L = range(ctx, 8, 12);
  ctx.footprint = { w: R * 2 + 1, d: L + 2 };
  const rust = wear > 0.45;
  const key = rust ? 'metal_corr_rust' : 'metal_corr';
  // the hut runs along Z; the arch is a half cylinder about the Z axis
  b.push().translate(0, 0.25, 0).rotateX(HALF_PI);
  b.cyl(key, 0, -L / 2, 0, R, L, { segs: 18, thetaStart: -HALF_PI, thetaLen: PI, caps: '', color: rust ? '#ffffff' : weather('#e0e4e6', wear * 0.5) });
  b.pop();
  // ribs
  for (let i = 0; i <= 6; i++) {
    const z = -L / 2 + (L * i) / 6;
    b.push().translate(0, 0.25, z).rotateX(HALF_PI);
    b.cyl('galv', 0, -0.04, 0, R + 0.03, 0.08, { segs: 18, thetaStart: -HALF_PI, thetaLen: PI, caps: '', color: '#8a8e90' });
    b.pop();
  }
  // concrete stem + end walls (wood/plywood) with a big door and windows
  b.box('concrete', 0, 0, 0, R * 2 + 0.3, 0.25, L + 0.2, { color: '#8a8a84' });
  for (const s of [0, 2]) {
    const zf = s === 0 ? L / 2 : -L / 2;
    b.push().translate(0, 0, zf).rotateY(s === 0 ? 0 : PI);
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = -HALF_PI + (i / 12) * PI; pts.push([Math.sin(a) * R, 0.25 + Math.cos(a) * R]); }
    // end wall with a door + window (siding_panel with holes approximated by overlay boards)
    const holes = s === 0 ? [{ x0: -1.4, x1: 1.4, y0: 0.25, y1: 2.65 }, { x0: 1.9, x1: 2.7, y0: 1.2, y1: 2.0 }] : [{ x0: -0.45, x1: 0.45, y0: 0.25, y1: 2.3 }];
    const key2 = wear > 0.5 ? 'plywood' : 'siding_panel';
    const col2 = wear > 0.5 ? weather('#b0a080', wear) : ctx.paint;
    // wallFace expects a convex CCW outline in u (left→right), y
    const ol = pts.map(([x, y]) => [x + R, y]).reverse();
    b.push().translate(-R, 0, 0);
    wallFaceHoles(ctx, key2, ol, holes.map((h) => ({ x0: h.x0 + R, x1: h.x1 + R, y0: h.y0, y1: h.y1 })), col2);
    b.pop();
    if (s === 0) {
      // big sliding door (wood) + window
      b.box('wood_weathered', 0, 0.25, -0.03, 2.8, 2.4, 0.06, { color: weather('#8a7a64', wear) });
      for (const x of [-0.7, 0.7]) b.beam('wood_raw', [x - 0.6, 0.4, 0.02], [x + 0.6, 2.5, 0.02], 0.12, 0.03, { color: '#6a5a48' });
      b.box('metal', 0, 2.68, 0.06, 3.2, 0.08, 0.1, { color: '#3a3a3a' });
      b.poly('glass_warm', [[1.9, 1.2, -0.04], [2.7, 1.2, -0.04], [2.7, 2.0, -0.04], [1.9, 2.0, -0.04]], { color: ctx.lit(0.5), uv: [[0.5, 0], [0.75, 0], [0.75, 0.5], [0.5, 0.5]] });
      b.box('paint', 2.3, 1.15, 0.02, 0.95, 0.06, 0.08, { color: ctx.trim });
      ctx.light(0, 3.0, 0.5, 0xffb060, 1.5, 7, true);
      b.box('metal', 0, 2.95, 0.05, 0.2, 0.12, 0.12, { color: '#2a2a2a' });
      b.sphere('neon', 0, 2.92, 0.14, 0.05, { color: ctx.state > 0.3 ? [4, 2.6, 1.3] : [0.05, 0.05, 0.05], rings: 4, segs: 6 });
    } else {
      b.box('paint', 0, 0.25, -0.03, 0.9, 2.05, 0.05, { color: '#6a6a66' });
    }
    b.pop();
  }
  ctx.col(0, 0, R * 2, L, R + 0.3);
  ctx.door = { x: 0, z: L / 2 + 0.1, rot: 0 };
  ctx.doors.push({ id: 'front', x: 0, z: L / 2 + 0.1, rot: 0, w: 2.8, leadsTo: 'exterior' });
  ctx.point('door', 0, 0, L / 2 + 1.5, PI);
  stovepipe(ctx, R * 0.55, 0.25 + R * Math.cos(Math.asin(0.55)) - 0.1, -L * 0.25, 0.25 + R + 0.8);
  ctx.house = { W: R * 2, D: L, floorY: 0.25, wallTop: 0.25 + R, quonset: true };
}

// wall face with holes for a custom convex outline in the current frame (z = 0)
function wallFaceHoles(ctx, key, outline, holes, color) {
  wallFace(ctx.b, key, outline, holes, 0, { color });
}

// ------------------------------------------------------------------ yard

function yard(ctx) {
  const b = ctx.b, r = ctx.rng, wear = ctx.wear;
  const H = ctx.house;
  if (!H) return;
  const W = H.W, D = H.D;
  const sideX = chance(ctx, 0.5) ? 1 : -1;
  // heating-oil tank on a stand beside the house (+ copper line)
  if (!H.quonset && chance(ctx, 0.75)) {
    const tz = range(ctx, -D / 4, D / 4);
    b.at(sideX * (W / 2 + 0.9), 0, tz, sideX > 0 ? HALF_PI : -HALF_PI);
    addProp(b, 'oilTank', { rust: wear, color: pick(ctx, ['#7a2a22', '#4a5a4a', '#8a8a84', '#c8c0a8', '#3a4a5a']) }, r);
    b.pop();
    b.beam('metal', [sideX * (W / 2 + 0.55), 0.35, tz], [sideX * (W / 2 + 0.02), (H.floorY || 0.5) + 0.1, tz], 0.012, 0.012, { color: '#b87333' });
    ctx.point('oilTank', sideX * (W / 2 + 2.2), 0, tz, sideX > 0 ? -HALF_PI : HALF_PI);
  }
  // satellite dish on the wall or a post
  if (chance(ctx, 0.5)) {
    const onWall = chance(ctx, 0.6) && !H.quonset;
    if (onWall) {
      b.at(-sideX * (W / 2 + 0.05), (H.wallTop || 3) - 0.6, range(ctx, -D / 4, D / 4), -sideX * HALF_PI + range(ctx, -0.4, 0.4));
      addProp(b, 'satDish', { size: range(ctx, 0.6, 0.9), mount: 'wall' }, r);
      b.pop();
    } else {
      b.at(-sideX * (W / 2 + 2.0), 0, D / 2 + 1.5, range(ctx, -0.6, 0.6));
      addProp(b, 'satDish', { size: chance(ctx, 0.2) ? 2.8 : 0.9, mount: 'post' }, r);
      b.pop();
    }
  }
  // electric meter + service mast
  if (!H.quonset) {
    b.at(-sideX * (W / 2 + 0.03), 0, -D / 2 + 1.2, -sideX * HALF_PI);
    b.box('sheet_metal', 0, (H.floorY || 0.5) + 0.9, 0.06, 0.32, 0.45, 0.12, { color: '#9aa0a0' });
    b.cyl('glass_dark', 0, (H.floorY || 0.5) + 1.15, 0.13, 0.08, 0.05, { segs: 10, color: '#888' });
    b.cyl('galv', 0, (H.floorY || 0.5) + 1.3, 0.05, 0.03, (H.wallTop || 3) - (H.floorY || 0.5) + 0.2, { segs: 6, color: '#9aa0a0' });
    b.pop();
  }
  // yard clutter: snowmobile, drums, sled, crab pots, pallets, woodpile, boat
  const n = Math.floor(1 + wear * 4 + r() * 2);
  const spots = [
    [sideX * (W / 2 + 2.4), D / 2 + 2.0], [-sideX * (W / 2 + 1.8), D / 2 + 3.0], [sideX * (W / 2 + 2.2), -D / 4],
    [-sideX * (W / 2 + 2.0), -D / 3], [sideX * (W / 3), -D / 2 - 2.0], [-sideX * (W / 4), -D / 2 - 2.4],
  ];
  const pool = ['snowmobile', 'fuelDrums', 'crabPots', 'woodpile', 'pallets', 'dogSled', 'fishRack', 'propane', 'atv', 'boatTrailer', 'snowmobile', 'crates'];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [x, z] = spots[i];
    let type = pick(ctx, pool);
    if (type === 'boatTrailer' && wear < 0.3) type = 'snowmobile';
    b.at(x, 0, z, range(ctx, -PI, PI));
    if (type === 'fuelDrums') { addProp(b, 'fuelDrum', { rust: wear }, r); b.translate(0.65, 0, 0.1); addProp(b, 'fuelDrum', { rust: wear, tipped: chance(ctx, 0.3) }, r); }
    else if (type === 'crabPots') { addProp(b, 'crabPot', {}, r); b.translate(0, 0.62, 0).rotateY(0.3); addProp(b, 'crabPot', {}, r); }
    else if (type === 'pallets') { addProp(b, 'pallet', {}, r); b.translate(0, 0.14, 0).rotateY(0.2); addProp(b, 'pallet', {}, r); }
    else addProp(b, type === 'crates' ? 'crate' : type, { rust: wear }, r);
    b.pop();
  }
  ctx.point('yard', spots[0][0], 0, spots[0][1], 0);
}
