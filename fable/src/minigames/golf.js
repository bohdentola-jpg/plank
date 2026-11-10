// FIELD GOAL GOLF — kick a football through carnival obstacle courses.
// One hole at a time: aim, pick a kick (chip / drive / boot), time the power
// meter, and let the bounces, slopes and wind do the rest. Lowest total wins.
//
// The ball physics is a small deterministic simulation (fixed 120 Hz steps,
// no Math.random): the same kick from the same lie always does the same thing,
// including the football's oblong hops, which are hashed from where it lands.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { toon, flat, lit, M, box, cyl, cone, sphere, circle, ring, lightRig, canvasTex, glowSprite, signPlane, bake, disposeTree, roundRect } from '../art/kit.js';
import { PROPS, fence, bunting } from '../art/props.js';
import { Character, buildFootball } from '../art/characters.js';
import { teamSpec } from '../data/cast.js';
import { NPCS } from '../data/npcs.js';
import { clamp, lerp, damp, el, TAU, wrapAngle, makeRng } from '../core/util.js';

const DEG = Math.PI / 180;
const H = 1 / 120;                 // physics step
const GRAV = 22, R_BALL = 0.28, WIND_K = 0.8, FRICTION = 8.5, SLOPE_ACC = 11, RAIL_H = 1.0;
const METER_SPEED = 1.15, WINDUP = 0.22, MAX_STROKES = 6, POST_H = 5.4;
const PPU = 14;                    // ground texture pixels per unit
const LOFTS = [
  { name: 'CHIP', tip: 'low — skips and runs, but bumps into bales', ang: 18 * DEG, v: 17 },
  { name: 'DRIVE', tip: 'the long one — clears a single bale', ang: 36 * DEG, v: 18.5 },
  { name: 'BOOT', tip: 'sky-high — hops walls, lands soft, drifts in the wind', ang: 62 * DEG, v: 18.5 },
];
const speedFor = (p) => 0.2 + 0.8 * p;

// ------------------------------------------------------------------ courses
// Hole-local coordinates: x 0..L (left→right), z 0..D (top→bottom of the screen).
//   bales   [cx, cz, w=1.8, d=1.8, h=1.25]      solid, bouncy
//   sand    [cx, cz, w, d]                      kills the roll           rough: same, milder
//   ponds   [cx, cz, rx, rz]                    splash: +1 stroke, replay from the last lie
//   slopes  [cx, cz, w, d, dx, dz]              pushes a ball on the ground along (dx,dz)
//   bumpers [x, z, r]                           pinball kick
//   mills   [x, z, halfLen, omega, phase]       a tall spinning sign
//   carts   [x1, z1, x2, z2, period]            a hay bale on wheels trundling back and forth
//   goal    { x, z, w, a }                      a = direction of travel through the posts (0 = +x)
// Most uprights do NOT face the tee: you have to work the ball round to the open side first.
// A full DRIVE travels about 19 units, a BOOT 15 (and clears a double-stacked wall), a CHIP 11.
const HOLES = [
  { name: 'Kickoff', par: 2, size: [34, 18], tee: [5, 9], goal: { x: 27, z: 9, w: 5.6 }, wind: [0, 0],
    bales: [[15, 3.2], [20.5, 14.8], [9.5, 15.4]] },
  { name: 'Bale Out', par: 3, size: [36, 20], tee: [4.5, 10], goal: { x: 30, z: 10, w: 5.2, a: Math.PI / 2 }, wind: [0, 1.5],
    bales: [[16, 4.1, 1.8, 8.2, 2.5], [16, 15.9, 1.8, 8.2, 2.5]], sand: [[22.4, 10, 5, 8]] },
  { name: 'The Dogleg', par: 3, size: [34, 24], tee: [5, 19], goal: { x: 28, z: 5, w: 5.2, a: -Math.PI / 2 }, wind: [1, 0],
    bales: [[11, 13, 22, 1.8, 2.5]], ponds: [[13, 6.2, 6.4, 3.5]], slopes: [[28.6, 18.4, 9.5, 6.6, 0, -1]] },
  { name: 'Crosswind Alley', par: 3, size: [36, 18], tee: [4.5, 9], goal: { x: 30, z: 9, w: 4.4 }, wind: [0, -4],
    sand: [[19.5, 3.4, 8, 4.4], [19.5, 14.6, 8, 4.4]], bumpers: [[27, 5.2, 0.9], [27, 12.8, 0.9]] },
  { name: 'Spin to Win', par: 3, size: [36, 20], tee: [4.5, 10], goal: { x: 30, z: 10, w: 5 }, wind: [1.5, 1],
    bales: [[17, 3.3, 1.8, 6.6, 2.5], [17, 16.7, 1.8, 6.6, 2.5]], mills: [[17, 10, 3.0, 1.5, 0.4]], rough: [[24.6, 10, 3.6, 8]] },
  { name: 'Pond Hop', par: 4, size: [42, 24], tee: [4.5, 18.6], goal: { x: 37, z: 6, w: 5.2, a: Math.PI / 2 }, wind: [2, -1],
    ponds: [[20, 11.6, 8, 6.4]], sand: [[32.6, 21.6, 4, 3.4]], slopes: [[21, 21.6, 16, 3.6, 1, 0]],
    bales: [[37, 11.4, 9, 1.8, 2.5], [12, 3], [28.4, 2.4]] },
];
const HARD_HOLES = [
  { name: 'Gusty Kickoff', par: 3, size: [34, 18], tee: [5, 9], goal: { x: 27, z: 9, w: 4.2 }, wind: [0, 4.5],
    bales: [[22.5, 4.6], [22.5, 13.4], [14, 9, 1.8, 3.6, 2.5]] },
  { name: 'Double Wall', par: 4, size: [38, 20], tee: [4.5, 10], goal: { x: 33, z: 12, w: 4.6, a: Math.PI / 2 }, wind: [-2, 2],
    bales: [[13, 6.2, 1.8, 12.4, 2.5], [23, 13.8, 1.8, 12.4, 2.5]], sand: [[18, 4.6, 6, 6]], rough: [[28.6, 6, 6, 5]] },
  { name: 'Corkscrew', par: 5, size: [40, 26], tee: [4.5, 22], goal: { x: 35.5, z: 3.8, w: 4.6 }, wind: [1.5, 1.5],
    bales: [[13, 17.5, 26, 1.8, 2.5], [27, 8.5, 26, 1.8, 2.5]], ponds: [[19, 13, 4.2, 2.3]],
    slopes: [[33.2, 22, 12, 6.6, 0, -1]] },
  { name: 'Pinball Alley', par: 3, size: [36, 20], tee: [4.5, 10], goal: { x: 31, z: 10, w: 4.2, a: Math.PI / 2 }, wind: [0, -3],
    bumpers: [[13.5, 6, 0.9], [13.5, 14, 0.9], [19, 10, 0.9], [24, 5.4, 0.9], [24, 14.6, 0.9], [27.4, 10, 0.8]],
    sand: [[9, 2.6, 5, 3.4], [9, 17.4, 5, 3.4]] },
  { name: 'Twin Turnstiles', par: 4, size: [40, 20], tee: [4.5, 10], goal: { x: 35.5, z: 10, w: 4.6 }, wind: [2, 2],
    bales: [[14, 3, 1.8, 6, 2.5], [14, 17, 1.8, 6, 2.5], [25, 3, 1.8, 6, 2.5], [25, 17, 1.8, 6, 2.5]],
    mills: [[14, 10, 3.2, 1.7, 0], [25, 10, 3.2, -1.7, 1.2]], carts: [[31, 4.6, 31, 15.4, 4.4]] },
  { name: 'The Moat', par: 4, size: [42, 24], tee: [4.5, 12], goal: { x: 36, z: 12, w: 4.6, a: Math.PI / 2 }, wind: [-1.5, 4],
    ponds: [[27, 5.6, 2.3, 4.6], [27, 18.4, 2.3, 4.6], [34.5, 3.2, 7, 2.2], [34.5, 20.8, 7, 2.2]],
    sand: [[31.6, 12, 3, 5]], bumpers: [[18, 5, 0.9], [18, 19, 0.9]], bales: [[12, 12, 1.8, 3.6]] },
];

// ------------------------------------------------------------------ physics
const hash = (a, b, c) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); };

/** Turn a hole definition into flat arrays the simulation can chew on. */
function compile(def) {
  const [L, D] = def.size;
  const a = def.goal.a || 0;
  const rect = ([cx, cz, w, d]) => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
  const hole = {
    def, L, D, wind: def.wind || [0, 0],
    goal: { x: def.goal.x, z: def.goal.z, hw: def.goal.w / 2, nx: Math.cos(a), nz: Math.sin(a), tx: -Math.sin(a), tz: Math.cos(a) },
    bales: (def.bales || []).map(([x, z, w = 1.8, d = 1.8, h = 1.25]) => ({ x, z, hw: w / 2, hd: d / 2, h })),
    sand: (def.sand || []).map(rect),
    rough: (def.rough || []).map(rect),
    slopes: (def.slopes || []).map((s) => ({ ...rect(s), dx: s[4], dz: s[5] })),
    ponds: (def.ponds || []).map(([x, z, rx, rz]) => ({ x, z, rx, rz })),
    bumpers: (def.bumpers || []).map(([x, z, r]) => ({ x, z, r })),
    mills: (def.mills || []).map(([x, z, half, om, ph]) => ({ x, z, half, om, ph })),
  };
  for (const [x1, z1, x2, z2, period] of def.carts || []) hole.bales.push({ x: x1, z: z1, hw: 0.9, hd: 0.9, h: 1.45, cart: { x1, z1, x2, z2, period } });
  return hole;
}

function cartPos(c, T) {
  const ph = (TAU * T) / c.period;
  const u = 0.5 - 0.5 * Math.cos(ph), du = 0.5 * Math.sin(ph) * (TAU / c.period);
  return { x: lerp(c.x1, c.x2, u), z: lerp(c.z1, c.z2, u), vx: (c.x2 - c.x1) * du, vz: (c.z2 - c.z1) * du };
}

const ZONE = { sand: false, rough: false, pond: false, slope: null };
function zoneAt(hole, x, z) {
  ZONE.sand = ZONE.rough = ZONE.pond = false; ZONE.slope = null;
  for (const p of hole.ponds) { const ux = (x - p.x) / p.rx, uz = (z - p.z) / p.rz; if (ux * ux + uz * uz < 1) { ZONE.pond = true; return ZONE; } }
  for (const s of hole.sand) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) { ZONE.sand = true; break; }
  if (!ZONE.sand) for (const s of hole.rough) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) { ZONE.rough = true; break; }
  for (const s of hole.slopes) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) { ZONE.slope = s; break; }
  return ZONE;
}

function newBall(x, z) {
  return { x, y: 0, z, vx: 0, vy: 0, vz: 0, air: false, n: 0, t: 0, still: 0, rest: false, made: false, dead: null, out: false };
}

/** Advance the ball one fixed step. T = hole clock (drives moving obstacles). ev(name, x, y, z, extra) reports what happened. */
function stepBall(b, hole, T, ev) {
  const px = b.x, py = b.y, pz = b.z;
  if (b.air) {
    b.vy -= GRAV * H;
    if (b.y > 0.3) { b.vx += hole.wind[0] * WIND_K * H; b.vz += hole.wind[1] * WIND_K * H; }
  } else {
    const zn = zoneAt(hole, b.x, b.z);
    const fr = zn.sand ? 34 : zn.rough ? 18 : FRICTION;
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 1e-6) { const dec = Math.min(sp, fr * H); b.vx -= (b.vx / sp) * dec; b.vz -= (b.vz / sp) * dec; }
    if (zn.slope) { b.vx += zn.slope.dx * SLOPE_ACC * H; b.vz += zn.slope.dz * SLOPE_ACC * H; }
  }
  b.x += b.vx * H; b.y += b.vy * H; b.z += b.vz * H;
  b.t += H;

  // ---- the uprights: crossing the goal line between the posts scores
  const g = hole.goal;
  const s0 = (px - g.x) * g.nx + (pz - g.z) * g.nz, s1 = (b.x - g.x) * g.nx + (b.z - g.z) * g.nz;
  if ((s0 > 0) !== (s1 > 0) && s0 !== s1) {
    const u = s0 / (s0 - s1);
    const cx = px + (b.x - px) * u, cz = pz + (b.z - pz) * u, cy = py + (b.y - py) * u;
    const lat = (cx - g.x) * g.tx + (cz - g.z) * g.tz, al = Math.abs(lat);
    const bounceBack = (e) => {
      const vn = b.vx * g.nx + b.vz * g.nz;
      b.vx -= (1 + e) * vn * g.nx; b.vz -= (1 + e) * vn * g.nz;
      b.x = px; b.y = py; b.z = pz;
    };
    if (Math.abs(al - g.hw) < 0.3 && cy < POST_H + 0.1) {   // clanged a post
      bounceBack(0.45);
      const k = (lat > 0 ? 1 : -1) * (al > g.hw ? 1 : -1) * 2.5;
      b.vx += g.tx * k; b.vz += g.tz * k;
      ev('doink', cx, cy, cz);
      return;
    }
    if (al < g.hw && Math.abs(cy - 2.6) < 0.24) {          // crossbar
      bounceBack(0.4);
      b.vy = cy > 2.6 ? Math.abs(b.vy) * 0.35 + 2.5 : -Math.abs(b.vy) * 0.3 - 1;
      b.air = true;
      ev('doink', cx, cy, cz);
      return;
    }
    if (al < g.hw) { b.made = true; ev('good', cx, cy, cz); return; }
  }

  // ---- hay bales (and the cart)
  for (const B of hole.bales) {
    let bx = B.x, bz = B.z, bvx = 0, bvz = 0;
    if (B.cart) { const c = cartPos(B.cart, T); bx = c.x; bz = c.z; bvx = c.vx; bvz = c.vz; }
    const ex = B.hw + R_BALL, ez = B.hd + R_BALL;
    const dx = b.x - bx, dz = b.z - bz;
    if (Math.abs(dx) >= ex || Math.abs(dz) >= ez || b.y >= B.h) continue;
    if (py >= B.h - 0.03) {
      // came down on top: bounce, and always slide off the nearer edge
      b.y = B.h;
      if (b.vy < 0) {
        const vin = -b.vy;
        b.vy = vin * 0.4;
        if (vin > 2) { b.vx *= 0.72; b.vz *= 0.72; ev('straw', b.x, b.y, b.z, vin); }
        if (b.vy < 1.3) b.vy = 0;
      }
      if (Math.abs(dx) / ex > Math.abs(dz) / ez) b.vx += (dx >= 0 ? 1 : -1) * 6 * H; else b.vz += (dz >= 0 ? 1 : -1) * 6 * H;
      b.air = true;
    } else {
      const wasOutX = Math.abs(px - bx) >= ex - 1e-6, wasOutZ = Math.abs(pz - bz) >= ez - 1e-6;
      const axisX = wasOutX && !wasOutZ ? true : !wasOutX && wasOutZ ? false : (ex - Math.abs(dx)) < (ez - Math.abs(dz));
      let hit;
      if (axisX) { hit = Math.abs(b.vx - bvx); b.x = bx + (dx >= 0 ? 1 : -1) * ex; b.vx = -(b.vx - bvx) * 0.6 + bvx; }
      else { hit = Math.abs(b.vz - bvz); b.z = bz + (dz >= 0 ? 1 : -1) * ez; b.vz = -(b.vz - bvz) * 0.6 + bvz; }
      if (hit > 1.5) ev('bale', b.x, b.y, b.z, hit);
    }
  }

  // ---- bumpers
  for (let i = 0; i < hole.bumpers.length; i++) {
    const q = hole.bumpers[i];
    if (b.y > 1.5) continue;
    const dx = b.x - q.x, dz = b.z - q.z, d = Math.hypot(dx, dz), rr = q.r + R_BALL;
    if (d >= rr) continue;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) { b.vx -= 2 * vn * nx; b.vz -= 2 * vn * nz; }
    const out = b.vx * nx + b.vz * nz;
    if (out < 9) { b.vx += (9 - out) * nx; b.vz += (9 - out) * nz; }
    b.x = q.x + nx * rr; b.z = q.z + nz * rr;
    ev('bumper', b.x, b.y, b.z, i);
  }

  // ---- spinning signs
  for (let i = 0; i < hole.mills.length; i++) {
    const m = hole.mills[i];
    if (b.y > 4.95) continue;
    const th = m.ph + m.om * T, ax = Math.cos(th), az = Math.sin(th);
    const rx = b.x - m.x, rz = b.z - m.z;
    const cl = clamp(rx * ax + rz * az, -m.half, m.half);
    const qx = rx - ax * cl, qz = rz - az * cl;
    const d = Math.hypot(qx, qz), rr = 0.14 + R_BALL;
    if (d >= rr) continue;
    let nx, nz;
    if (d > 1e-5) { nx = qx / d; nz = qz / d; } else { nx = -az; nz = ax; }
    const cxp = ax * cl, czp = az * cl;
    const avx = -m.om * czp, avz = m.om * cxp;            // how fast the panel is moving where we hit it
    const vn = (b.vx - avx) * nx + (b.vz - avz) * nz;
    if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vz -= 1.5 * vn * nz; if (vn < -1.5) ev('mill', b.x, b.y, b.z, i); }
    b.x = m.x + cxp + nx * rr; b.z = m.z + czp + nz * rr;
  }

  // ---- the rail around the hole: low balls bounce off it, high ones sail out of bounds
  if (b.y < RAIL_H && !b.out) {
    if (b.x < R_BALL) { b.x = R_BALL; if (b.vx < 0) { if (b.vx < -1.5) ev('rail', b.x, b.y, b.z); b.vx = -b.vx * 0.55; } }
    else if (b.x > hole.L - R_BALL) { b.x = hole.L - R_BALL; if (b.vx > 0) { if (b.vx > 1.5) ev('rail', b.x, b.y, b.z); b.vx = -b.vx * 0.55; } }
    if (b.z < R_BALL) { b.z = R_BALL; if (b.vz < 0) { if (b.vz < -1.5) ev('rail', b.x, b.y, b.z); b.vz = -b.vz * 0.55; } }
    else if (b.z > hole.D - R_BALL) { b.z = hole.D - R_BALL; if (b.vz > 0) { if (b.vz > 1.5) ev('rail', b.x, b.y, b.z); b.vz = -b.vz * 0.55; } }
  } else if (b.y >= RAIL_H) {
    b.out = b.x < 0 || b.x > hole.L || b.z < 0 || b.z > hole.D;
  }

  // ---- ground
  if (b.air && b.y <= 0 && b.vy <= 0) {
    b.y = 0;
    if (b.out) { b.dead = 'ob'; ev('ob', b.x, 0, b.z); return; }
    const zn = zoneAt(hole, b.x, b.z);
    if (zn.pond) { b.dead = 'water'; ev('splash', b.x, 0, b.z); return; }
    const vin = -b.vy;
    b.n++;
    const soft = zn.sand ? 0 : zn.rough ? 1 : 2;
    const h1 = hash(b.x, b.z, b.n), h2 = hash(b.z, b.x, b.n + 7);
    const e = soft === 0 ? 0.1 : soft === 1 ? 0.22 : 0.38 * (0.75 + 0.5 * h2);
    const hsp = Math.hypot(b.vx, b.vz);
    const skim = hsp / Math.max(1e-6, Math.hypot(hsp, vin));              // steep landings bite, shallow ones skip
    const keep = soft === 0 ? 0.3 : soft === 1 ? 0.45 : 0.62 * (0.55 + 0.45 * skim);
    const turn = soft === 2 ? (h1 - 0.5) * 0.42 * clamp(vin / 12, 0, 1) : 0;    // the football hop
    const c = Math.cos(turn), s = Math.sin(turn);
    const vx = (b.vx * c - b.vz * s) * keep, vz = (b.vx * s + b.vz * c) * keep;
    b.vx = vx; b.vz = vz;
    b.vy = vin * e;
    if (b.vy < 1.5) { b.vy = 0; b.air = false; }
    ev(soft === 0 ? 'sand' : soft === 1 ? 'rough' : 'bounce', b.x, 0, b.z, vin);
  }
  if (!b.air) {
    b.y = 0;
    const zn = zoneAt(hole, b.x, b.z);
    if (zn.pond) { b.dead = 'water'; ev('splash', b.x, 0, b.z); return; }
    const sp = Math.hypot(b.vx, b.vz);
    if (sp < 0.5) b.still += H; else b.still = 0;
    if ((sp < 0.3 && !zn.slope) || b.still > 0.7) { b.vx = b.vz = 0; b.rest = true; }
  }
  if (b.t > 14 && !b.rest) { b.rest = true; b.vx = b.vy = b.vz = 0; if (b.y < 0) b.y = 0; }
}

function launchBall(lie, aim, lofti, power) {
  const lo = LOFTS[lofti];
  const v = lo.v * speedFor(power);
  const b = newBall(lie.x, lie.z);
  b.vx = Math.cos(aim) * Math.cos(lo.ang) * v;
  b.vz = Math.sin(aim) * Math.cos(lo.ang) * v;
  b.vy = Math.sin(lo.ang) * v;
  b.air = true;
  return b;
}
/** No-wind carry of a kick (where the dotted guide ends). */
const carryOf = (lofti, power) => { const lo = LOFTS[lofti]; const v = lo.v * speedFor(power); return (v * v * Math.sin(2 * lo.ang)) / GRAV; };
const NOEV = () => {};

// ------------------------------------------------------------------ visuals
function injectCss() {
  if (document.getElementById('mg-golf-css')) return;
  const s = document.createElement('style');
  s.id = 'mg-golf-css';
  s.textContent = `
.golf-ui { position: absolute; left: 50%; bottom: 2.7em; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 0.45em; transition: opacity .2s; }
.golf-ui.off { opacity: 0.25; }
.golf-lofts { display: flex; gap: 0.45em; align-items: flex-end; }
.golf-loft { background: rgba(27,16,36,0.78); color: var(--cream); border: 0.18em solid var(--ink); border-radius: 0.85em; padding: 0.08em 0.85em; font-weight: 900; letter-spacing: .04em; opacity: 0.72; transition: transform .1s; }
.golf-loft.on { background: var(--gold); color: var(--ink); opacity: 1; transform: translateY(-0.2em) scale(1.12); box-shadow: 0 0.22em 0 var(--ink); }
.golf-tip { color: var(--cream); font-weight: 800; font-size: 0.86em; text-shadow: 0 0.1em 0 var(--ink), 0 0 0.4em rgba(27,16,36,0.9); min-height: 1.2em; }
.golf-meter { width: 23em; height: 1.5em; }
.golf-meter > i { background: linear-gradient(90deg, #6aa84f, #ffd45a 62%, #f08a24 86%, #d4502f); transition: none; }
.golf-meter > span { position: absolute; top: 0; bottom: 0; width: 0.14em; background: rgba(255,244,220,0.55); }
.golf-wind { position: absolute; right: 1em; top: 4.4em; display: flex; flex-direction: column; align-items: center; gap: 0.2em; }
.golf-wind .dial { width: 4.6em; height: 4.6em; border-radius: 50%; background: rgba(255,244,220,0.94); border: 0.22em solid var(--ink); box-shadow: 0 0.25em 0 rgba(43,26,51,0.45); display: flex; align-items: center; justify-content: center; }
.golf-wind .arrow { font-size: 2.3em; line-height: 1; color: var(--maple); font-weight: 900; transition: transform .4s; }
.golf-wind .lbl { background: var(--ink); color: var(--cream); border-radius: 0.8em; padding: 0.05em 0.8em; font-weight: 900; font-size: 0.86em; letter-spacing: .06em; border: 0.14em solid var(--gold); }
.golf-wind.calm .arrow { color: #9aa3ad; }
.golf-sc { position: absolute; left: 0.9em; top: 0.9em; display: flex; gap: 0.25em; }
.golf-sc div { width: 2.3em; background: rgba(255,244,220,0.94); border: 0.16em solid var(--ink); border-radius: 0.6em; text-align: center; font-weight: 900; line-height: 1.05; padding: 0.12em 0 0.2em; }
.golf-sc div small { display: block; font-size: 0.6em; opacity: 0.7; letter-spacing: .04em; }
.golf-sc div.now { background: var(--gold); transform: translateY(0.15em); }
.golf-sc div.under { color: #2f7a2f; } .golf-sc div.over { color: var(--maple); }
.golf-card { position: absolute; left: 50%; top: 24%; transform: translate(-50%, -50%) rotate(-2deg); text-align: center; background: var(--cream); border: 0.3em solid var(--ink); border-radius: 1.3em; padding: 0.5em 1.8em 0.6em; box-shadow: 0 0.45em 0 rgba(27,16,36,0.6); animation: golfcard .35s cubic-bezier(.2,1.5,.4,1); }
.golf-card .n { font-weight: 900; font-size: 0.9em; letter-spacing: .14em; color: var(--maple); }
.golf-card .t { font-weight: 900; font-size: 2.2em; line-height: 1; }
.golf-card .p { font-weight: 800; }
@keyframes golfcard { from { transform: translate(-50%, -50%) rotate(-8deg) scale(.5); opacity: 0; } }
`;
  document.head.appendChild(s);
}

function paintHole(def) {
  const [L, D] = def.size;
  const m = 1, s = PPU;
  return canvasTex(Math.round((L + 2 * m) * s), Math.round((D + 2 * m) * s), (c, w, h) => {
    const X = (x) => (x + m) * s, Z = (z) => (z + m) * s;
    let seed = Math.round(L * 131 + D * 17);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    c.fillStyle = '#6da64b'; roundRect(c, 0, 0, w, h, 1.6 * s); c.fill();
    c.save();
    roundRect(c, X(0), Z(0), L * s, D * s, 0.9 * s); c.clip();
    for (let i = 0; i * 2 < L + 2; i++) { c.fillStyle = i % 2 ? '#8ccb63' : '#80bf59'; c.fillRect(X(i * 2), Z(0), 2 * s + 1, D * s); }
    // rough
    for (const [cx, cz, rw, rd] of def.rough || []) {
      c.fillStyle = '#5e9a41'; roundRect(c, X(cx - rw / 2), Z(cz - rd / 2), rw * s, rd * s, 0.8 * s); c.fill();
      c.strokeStyle = '#3f7a2f'; c.lineWidth = 0.07 * s; c.lineCap = 'round';
      for (let i = 0; i < rw * rd * 1.4; i++) { const x = X(cx - rw / 2 + rnd() * rw), z = Z(cz - rd / 2 + rnd() * rd); c.beginPath(); c.moveTo(x, z); c.lineTo(x + (rnd() - 0.5) * 0.2 * s, z - 0.3 * s); c.stroke(); }
    }
    // sand
    for (const [cx, cz, sw, sd] of def.sand || []) {
      c.fillStyle = '#d9c284'; roundRect(c, X(cx - sw / 2) - 0.12 * s, Z(cz - sd / 2) - 0.12 * s, sw * s + 0.24 * s, sd * s + 0.24 * s, 1.3 * s); c.fill();
      c.fillStyle = '#eedaa2'; roundRect(c, X(cx - sw / 2), Z(cz - sd / 2), sw * s, sd * s, 1.2 * s); c.fill();
      for (let i = 0; i < sw * sd * 2.2; i++) { c.fillStyle = rnd() < 0.5 ? '#dcc68c' : '#f7e8ba'; c.beginPath(); c.arc(X(cx - sw / 2 + 0.3 + rnd() * (sw - 0.6)), Z(cz - sd / 2 + 0.3 + rnd() * (sd - 0.6)), (0.05 + rnd() * 0.07) * s, 0, TAU); c.fill(); }
    }
    // slopes: a paler band full of chevrons pointing downhill
    for (const [cx, cz, sw, sd, dx, dz] of def.slopes || []) {
      c.fillStyle = 'rgba(255,255,255,0.17)'; roundRect(c, X(cx - sw / 2), Z(cz - sd / 2), sw * s, sd * s, 0.8 * s); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.2 * s; c.lineCap = 'round'; c.lineJoin = 'round';
      const ang = Math.atan2(dz, dx);
      for (let x = cx - sw / 2 + 1.1; x < cx + sw / 2 - 0.4; x += 2) for (let z = cz - sd / 2 + 1.1; z < cz + sd / 2 - 0.4; z += 2) {
        c.save(); c.translate(X(x), Z(z)); c.rotate(ang);
        c.beginPath(); c.moveTo(-0.3 * s, -0.42 * s); c.lineTo(0.3 * s, 0); c.lineTo(-0.3 * s, 0.42 * s); c.stroke();
        c.restore();
      }
    }
    // ponds
    for (const [cx, cz, rx, rz] of def.ponds || []) {
      c.fillStyle = '#c4b382'; c.beginPath(); c.ellipse(X(cx), Z(cz), (rx + 0.45) * s, (rz + 0.45) * s, 0, 0, TAU); c.fill();
      c.fillStyle = '#56b0c4'; c.beginPath(); c.ellipse(X(cx), Z(cz), rx * s, rz * s, 0, 0, TAU); c.fill();
      c.fillStyle = '#72c7d8'; c.beginPath(); c.ellipse(X(cx - rx * 0.12), Z(cz - rz * 0.14), rx * 0.7 * s, rz * 0.66 * s, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(X(cx - rx * 0.34), Z(cz - rz * 0.36), rx * 0.22 * s, rz * 0.1 * s, -0.3, 0, TAU); c.fill();
      c.fillStyle = '#6aa84f';
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(X(cx + (rnd() - 0.5) * rx), Z(cz + (rnd() - 0.2) * rz * 0.8), 0.34 * s, 0.4, TAU - 0.2); c.lineTo(X(cx), Z(cz)); c.fill(); }
    }
    // tee box
    const [tx, tz] = def.tee;
    c.fillStyle = '#62a548'; roundRect(c, X(tx - 1.7), Z(tz - 1.7), 3.4 * s, 3.4 * s, 0.7 * s); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.12 * s; roundRect(c, X(tx - 1.7), Z(tz - 1.7), 3.4 * s, 3.4 * s, 0.7 * s); c.stroke();
    // chequered goal mouth
    const a = def.goal.a || 0, hw = def.goal.w / 2;
    c.save(); c.translate(X(def.goal.x), Z(def.goal.z)); c.rotate(a + Math.PI / 2);
    const n = Math.round(def.goal.w / 0.65);
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(43,26,51,0.75)'; c.fillRect((-hw + (i * def.goal.w) / n) * s, (-0.65 + j * 0.65) * s, (def.goal.w / n) * s + 0.5, 0.65 * s + 0.5); }
    c.restore();
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.16 * s; roundRect(c, X(0), Z(0), L * s, D * s, 0.9 * s); c.stroke();
  });
}

function buildGoal(g) {
  const grp = new THREE.Group();
  const gold = toon(0xffd45a);
  for (const sgn of [-1, 1]) {
    grp.add(M(cyl(0.13, 0.16, POST_H, 8), gold, sgn * g.hw, POST_H / 2, 0));
    grp.add(M(cyl(0.36, 0.36, 1.5, 10), toon(0xd4502f), sgn * g.hw, 0.75, 0));
    grp.add(M(cone(0.24, 0.55, 6), toon(sgn > 0 ? 0xd4502f : 0x2a6f77), sgn * g.hw, POST_H + 0.27, 0));
  }
  grp.add(M(cyl(0.1, 0.1, g.hw * 2, 8), gold, 0, 2.6, 0, { rz: Math.PI / 2 }));
  grp.position.set(g.x, 0, g.z);
  grp.rotation.y = Math.atan2(-g.tz, g.tx);
  return grp;
}

function buildBumper(q) {
  const grp = new THREE.Group();
  grp.add(M(cyl(q.r, q.r * 1.08, 0.5, 14), toon(0xd4502f), 0, 0.25, 0));
  grp.add(M(cyl(q.r * 0.96, q.r * 0.96, 0.4, 14), toon(0xfffaf0), 0, 0.7, 0));
  grp.add(M(cyl(q.r, q.r, 0.3, 14), toon(0xd4502f), 0, 1.05, 0));
  grp.add(M(sphere(q.r * 0.62, 12, 8), lit(0xffe27a, 0xffc93c, 1.1), 0, 1.3, 0, { sy: 0.6 }));
  grp.position.set(q.x, 0, q.z);
  grp.userData.keep = true;
  return grp;
}

function buildMill(m) {
  const grp = new THREE.Group();
  grp.add(M(cyl(0.2, 0.26, 5.5, 8), toon(0x4a4458), 0, 2.75, 0));
  grp.add(M(sphere(0.34, 10, 8), toon(0xffd45a), 0, 5.6, 0));
  const arm = new THREE.Group();
  const n = 6;
  for (let i = 0; i < n; i++) arm.add(M(box((m.half * 2) / n, 4.5, 0.28), toon(i % 2 ? 0xd4502f : 0xfff4dc), -m.half + ((i + 0.5) * m.half * 2) / n, 2.65, 0));
  arm.add(M(box(m.half * 2 + 0.1, 0.22, 0.34), toon(0x2b1a33), 0, 4.95, 0));
  arm.add(M(box(m.half * 2 + 0.1, 0.22, 0.34), toon(0x2b1a33), 0, 0.42, 0));
  for (const s of [-1, 1]) {
    const sign = signPlane('SPIN!', 2.4, 0.9, { bg: '#ffd45a', color: '#2b1a33', radius: 14, border: '#2b1a33' });
    sign.position.set(0, 3.4, s * 0.16);
    if (s < 0) sign.rotation.y = Math.PI;
    arm.add(sign);
  }
  grp.add(arm);
  grp.position.set(m.x, 0, m.z);
  grp.userData.keep = true;
  grp.userData.arm = arm;
  return grp;
}

function buildCart() {
  const grp = new THREE.Group();
  const bale = PROPS.hayBale();
  bale.position.y = 0.2;
  grp.add(bale);
  grp.add(M(box(2.0, 0.14, 2.0), toon(0x8a5a34), 0, 0.2, 0));
  for (const [x, z] of [[-0.8, 1.02], [0.8, 1.02], [-0.8, -1.02], [0.8, -1.02]]) grp.add(M(cyl(0.22, 0.22, 0.12, 10), toon(0x2b1a33), x, 0.22, z, { rx: Math.PI / 2 }));
  grp.userData.keep = true;
  return grp;
}

function buildSock() {
  const grp = new THREE.Group();
  grp.add(M(cyl(0.06, 0.08, 3.4, 6), toon(0xfffaf0), 0, 1.7, 0));
  const pivot = new THREE.Group();
  pivot.position.y = 3.3;
  const sock = new THREE.Group();
  const cols = [0xf08a24, 0xfffaf0, 0xf08a24, 0xfffaf0];
  for (let i = 0; i < 4; i++) sock.add(M(cyl(0.3 - i * 0.055, 0.36 - i * 0.055, 0.42, 10, true), toon(cols[i], { side: THREE.DoubleSide }), 0.3 + i * 0.42, 0, 0, { rz: -Math.PI / 2, shadow: false }));
  pivot.add(sock);
  grp.add(pivot);
  grp.userData.keep = true;
  grp.userData.pivot = pivot; grp.userData.sock = sock;
  return grp;
}

// ------------------------------------------------------------------ the game
export default class FieldGoalGolf extends Minigame {
  static meta = {
    id: 'golf', title: 'Field Goal Golf', icon: '⛳',
    blurb: 'Kick the football through the uprights in as few kicks as you can. Hay bales bounce it, sand stops it, slopes carry it — and the wind has opinions.',
    controls: [['move', 'aim ◄ ► · pick a kick ▲ ▼'], ['a', 'start the meter, press again to kick'], ['b', 'hold to fine-aim · cancels the meter']],
    scoreLabel: 'kicks', goals: [27, 22, 18], lower: true, hasHard: true, music: 'fair',
  };

  setup() {
    injectCss();
    this.holes = this.hard ? HARD_HOLES : HOLES;
    this.card = [];
    this.holeIndex = 0;
    this.camera.fov = 22;
    this.camera.near = 1; this.camera.far = 500;
    this.camera.updateProjectionMatrix();
    this.rig = lightRig(this.scene, 'day', { shadowSize: 34, fog: [110, 260] });
    this.cam = { x: 0, z: 0, d: 60 };
    this.acc = 0;
    this._buildBackdrop();
    this._buildHelpers();
    this._buildUi();
    this._loadHole(0);
    this._syncCamera(1, true);
    this._refreshUi();
  }

  cleanup() {
    for (const g of [this.backdrop, this.holeGroup, this.helpers]) if (g) { this.scene.remove(g); disposeTree(g); }
    for (const c of this.fans) c.ch.dispose();
    this.hollow.dispose();
  }

  // ---------------------------------------------------------------- scenery
  _buildBackdrop() {
    const g = new THREE.Group();
    const lawn = M(new THREE.PlaneGeometry(320, 260), toon(0x86b860), 0, -0.03, -10, { rx: -Math.PI / 2, shadow: false });
    lawn.userData.keep = true;
    g.add(lawn);
    const put = (name, x, z, o = {}) => { const p = PROPS[name](o); p.position.x += x; p.position.z += z; if (o.ry) p.rotation.y += o.ry; if (o.scale) p.scale.multiplyScalar(o.scale); g.add(p); return p; };
    // the midway behind the course (laid out for a far rail at z = -13; slid into place per hole)
    put('tent', -25, -19.6, { color: 0xd4502f, r: 2.8 });
    put('tent', 26, -20, { color: 0x2a6f77, r: 2.8 });
    put('tent', 2, -23.5, { color: 0x8a5aa8, r: 2.6 });
    put('booth', -11.5, -17.6, { text: 'POPCORN', color: 0xd4502f });
    put('booth', 13.5, -17.8, { text: 'PRIZES', color: 0x2a6f77 });
    put('balloons', -9.2, -17.2, { seed: 1 }); put('balloons', 15.9, -17.4, { seed: 2 }); put('balloons', -28.4, -17.6, { seed: 3 });
    const wheel = put('ferrisWheel', -3, -35, { scale: 1.5 });
    this.wheel = wheel.userData.spin;
    for (const [x, z, s] of [[-40, -22, 1.3], [-36, -6, 1.1], [-41, 8, 1.2], [40, -24, 1.3], [38, -4, 1.1], [42, 11, 1.2], [-19, -27, 1.2], [20, -28, 1.3], [-48, -12, 1.2], [50, -14, 1.2], [-34, 20, 1.1], [35, 21, 1.1], [9, -30, 1.2]]) put('tree', x, z, { s, rng: makeRng(Math.round(x * 7 + z * 13 + 999)) });
    for (const [x, z] of [[-31, -14], [-32.8, -14.4], [-31.8, -13.4], [32, -14.6], [33.4, -14]]) put('hayBale', x, z, { ry: x * 0.3 });
    for (const [x, z, s] of [[-29.4, -13.2, 1], [-28.6, -13.9, 0.7], [30.6, -13.4, 0.9], [-33, 16, 1.1], [33.6, 16.4, 0.8], [34.5, 15.6, 1.1]]) put('pumpkin', x, z, { s });
    put('scarecrowPost', 36.5, -11);
    g.add(bunting(-27, -15.6, -9, -15.6, { y: 4.1 })); g.add(bunting(-9, -15.6, 9, -15.6, { y: 4.1 })); g.add(bunting(9, -15.6, 27, -15.6, { y: 4.1 }));
    for (const x of [-27, -9, 9, 27]) g.add(M(cyl(0.08, 0.1, 4.5, 6), toon(0xfffaf0), x, 2.25, -15.6));
    bake(g);
    this.scene.add(g);
    this.backdrop = g;
    // a small gallery of fans
    this.fans = [];
    const who = ['bleat', 'quill', 'hamm', 'mittens', 'nutmeg'];
    who.forEach((id, i) => {
      const n = NPCS[id];
      if (!n) return;
      const ch = new Character(n.spec);
      this.scene.add(ch.root);
      this.fans.push({ ch, i, t: i * 0.7 });
    });
  }

  _buildHelpers() {
    const g = new THREE.Group();
    g.userData.keep = true;
    this.helpers = g;
    this.scene.add(g);
    // the ball + its shadow
    this.ballMesh = buildFootball(2.1);
    g.add(this.ballMesh);
    this.ballShadow = new THREE.Mesh(circle(0.5, 14), new THREE.MeshBasicMaterial({ color: 0x1b1024, transparent: true, opacity: 0.28, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.renderOrder = 3;
    g.add(this.ballShadow);
    // aim guide: dots to the full-power landing spot, rings at 50 / 75 / 100 %
    this.dots = [];
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 34; i++) { const d = new THREE.Mesh(circle(0.15, 8), dotMat); d.rotation.x = -Math.PI / 2; d.renderOrder = 4; g.add(d); this.dots.push(d); }
    this.marks = [0.5, 0.75, 1].map((p, i) => {
      const r = new THREE.Mesh(ring(0.3, 0.46, 18), new THREE.MeshBasicMaterial({ color: i === 2 ? 0xff8f7a : 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.renderOrder = 4; g.add(r);
      const label = signPlane(['50%', '75%', 'MAX'][i], 1.5, 0.62, { color: i === 2 ? '#ffb3a4' : '#ffffff', stroke: '#2b1a33', strokeW: 9 });
      label.rotation.x = -Math.PI / 2; label.renderOrder = 6; label.material.depthWrite = false;
      g.add(label);
      return { mesh: r, p, label };
    });
    const tri = new THREE.Shape();
    tri.moveTo(0.9, 0); tri.lineTo(-0.35, 0.62); tri.lineTo(-0.1, 0); tri.lineTo(-0.35, -0.62); tri.closePath();
    this.chevron = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffd45a, depthWrite: false, side: THREE.DoubleSide }));
    this.chevron.renderOrder = 5;
    g.add(this.chevron);
    // where the kick will first land at the current meter power
    this.landRing = new THREE.Group();
    const lr = new THREE.Mesh(ring(0.62, 0.92, 24), new THREE.MeshBasicMaterial({ color: 0xffd45a, depthWrite: false, side: THREE.DoubleSide }));
    lr.rotation.x = -Math.PI / 2; lr.renderOrder = 5;
    const ld = new THREE.Mesh(circle(0.24, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }));
    ld.rotation.x = -Math.PI / 2; ld.renderOrder = 5;
    this.landRing.add(lr, ld);
    g.add(this.landRing);
    // a star hovering over the uprights so you can always find them
    this.star = new THREE.Group();
    this.star.add(M(sphere(0.36, 8, 6), flat(0xffe27a), 0, 0, 0, { shadow: false }));
    this.star.add(glowSprite(0xffd45a, 3.4, 0.6));
    g.add(this.star);
    // the kicker
    this.hollow = new Character(teamSpec('hollow'));
    this.scene.add(this.hollow.root);
    this.hpos = { x: 0, z: 0 };
    this.sock = buildSock();
    g.add(this.sock);
  }

  _loadHole(i) {
    if (this.holeGroup) { this.scene.remove(this.holeGroup); disposeTree(this.holeGroup); }
    const def = this.holes[i];
    const hole = compile(def);
    this.hole = hole; this.def = def; this.holeIndex = i;
    const [L, D] = def.size;
    this.ox = -L / 2; this.oz = -D / 2;
    const g = new THREE.Group();
    g.position.set(this.ox, 0, this.oz);
    // the green
    const tex = paintHole(def);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(L + 2, D + 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(L / 2, 0.012, D / 2);
    ground.receiveShadow = true;
    ground.userData.keep = true;
    g.add(ground);
    const stat = new THREE.Group();
    g.add(stat);
    for (const [x1, z1, x2, z2] of [[0, 0, L, 0], [L, 0, L, D], [L, D, 0, D], [0, D, 0, 0]]) stat.add(fence(x1, z1, x2, z2, { style: 'rail', color: 0xfffaf0 }));
    // hay bales
    this.cartMeshes = [];
    for (const B of hole.bales) {
      if (B.cart) { const cm = buildCart(); g.add(cm); this.cartMeshes.push({ mesh: cm, cart: B.cart }); continue; }
      const nx = Math.max(1, Math.round((B.hw * 2) / 1.8)), nz = Math.max(1, Math.round((B.hd * 2) / 1.8)), ny = Math.max(1, Math.round(B.h / 1.25));
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) for (let c = 0; c < ny; c++) {
        const p = PROPS.hayBale();
        p.scale.set((B.hw * 2) / nx / 1.8, B.h / ny / 1.25, (B.hd * 2) / nz / 1.8);
        p.position.set(B.x - B.hw + ((a + 0.5) * B.hw * 2) / nx, (c * B.h) / ny, B.z - B.hd + ((b + 0.5) * B.hd * 2) / nz);
        stat.add(p);
      }
    }
    for (const [x, z, c] of [[-0.3, -0.3, 0xd4502f], [L + 0.3, -0.3, 0x2a6f77], [-0.3, D + 0.3, 0xffd45a], [L + 0.3, D + 0.3, 0xf08a24]]) {
      stat.add(M(cyl(0.07, 0.09, 2.6, 6), toon(0xfffaf0), x, 1.3, z));
      stat.add(M(cone(0.34, 0.8, 4), toon(c), x + 0.36, 2.3, z, { rz: -Math.PI / 2, sz: 0.2 }));
    }
    stat.add(buildGoal(hole.goal));
    // tee marker
    stat.add(M(cyl(0.12, 0.16, 0.5, 8), toon(0xd4502f), def.tee[0] - 1.2, 0.25, def.tee[1] + 1.2));
    stat.add(M(cyl(0.12, 0.16, 0.5, 8), toon(0xd4502f), def.tee[0] - 1.2, 0.25, def.tee[1] - 1.2));
    // reeds round the ponds
    for (const p of hole.ponds) for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + p.x, rx = p.rx + 0.25, rz = p.rz + 0.25;
      const x = p.x + Math.cos(a) * rx, z = p.z + Math.sin(a) * rz;
      if (x < 0.6 || z < 0.6 || x > L - 0.6 || z > D - 0.6) continue;
      stat.add(M(cyl(0.035, 0.05, 1.3, 5), toon(0x5f9a4a), x, 0.65, z));
      stat.add(M(cyl(0.085, 0.085, 0.36, 6), toon(0x7a5230), x, 1.36, z));
    }
    bake(stat);
    this.bumperMeshes = hole.bumpers.map((q) => { const b = buildBumper(q); g.add(b); return { mesh: b, flash: 0 }; });
    this.millMeshes = hole.mills.map((m) => { const mm = buildMill(m); g.add(mm); return mm; });
    this.scene.add(g);
    this.holeGroup = g;

    // helpers ride in the same hole-local space
    this.helpers.position.copy(g.position);
    this.sock.position.set(def.tee[0] - 2.4, 0, def.tee[1] - 2.6 < 0.8 ? def.tee[1] + 2.6 : def.tee[1] - 2.6);
    this.star.position.set(hole.goal.x, 7.4, hole.goal.z);
    // the fairground slides up behind this hole's far rail; fans line the rail
    this.backdrop.position.z = this.oz + 13;
    this.fans.forEach((f, k) => {
      const x = this.ox + L * (0.14 + 0.18 * k), z = this.oz - 1.7 - (k % 2) * 0.8;
      f.ch.setPos(x, z); f.ch.face(0); f.home = { x, z };
    });

    // state for this hole
    this.T = 0;
    this.strokes = 0;
    this.lie = { x: def.tee[0], z: def.tee[1] };
    this.ball = newBall(this.lie.x, this.lie.z);
    this.aim = Math.atan2(hole.goal.z - this.lie.z, hole.goal.x - this.lie.x);
    this.loft = 1;
    this.meter = 0; this.meterDir = 1; this.power = 0;
    this.phase = 'intro'; this.pt = G.debug.fast ? 0.05 : 1.5;
    this.spin = 0; this.trailT = 0;
    this.hpos.x = this.lie.x - Math.cos(this.aim) * 1.6; this.hpos.z = this.lie.z - Math.sin(this.aim) * 1.6;
    if (this.playing) this._showCard(`HOLE ${i + 1} OF ${this.holes.length}`, def.name, `Par ${def.par}`);
    this._windUi();
  }

  // ---------------------------------------------------------------- dom
  _buildUi() {
    this.eLofts = LOFTS.map((l) => el('div.golf-loft', l.name));
    this.eTip = el('div.golf-tip');
    this.eFill = el('i');
    this.eMeter = el('div.meter.golf-meter', this.eFill, el('span', { style: { left: '50%' } }), el('span', { style: { left: '75%' } }));
    this.eUi = el('div.golf-ui', el('div.golf-lofts', this.eLofts), this.eMeter, this.eTip);
    this.eArrow = el('div.arrow', '➤');
    this.eWindLbl = el('div.lbl', 'CALM');
    this.eWind = el('div.golf-wind', el('div.dial', this.eArrow), this.eWindLbl);
    this.eSc = el('div.golf-sc');
    this.hud.append(this.eUi, this.eWind, this.eSc);
  }
  _windUi() {
    const [wx, wz] = this.hole.wind;
    const s = Math.hypot(wx, wz);
    this.eWind.classList.toggle('calm', s < 0.1);
    this.eArrow.style.transform = `rotate(${(Math.atan2(wz, wx) * 180) / Math.PI}deg) scale(${s < 0.1 ? 0.6 : 0.75 + s * 0.09})`;
    this.eArrow.textContent = s < 0.1 ? '•' : '➤';
    this.eWindLbl.textContent = s < 0.1 ? 'CALM' : `WIND ${Math.round(s * 10) / 10}`;
  }
  _showCard(n, t, p) {
    if (this.eCard) this.eCard.remove();
    this.eCard = el('div.golf-card', el('div.n', n), el('div.t', t), el('div.p', p));
    this.hud.appendChild(this.eCard);
  }
  _hideCard() { if (this.eCard) { this.eCard.remove(); this.eCard = null; } }
  _refreshUi() {
    const def = this.def;
    const holed = this.phase === 'made' || this.phase === 'pickup' || this.phase === 'done';
    const total = this.card.reduce((a, b) => a + b, 0) + (holed ? 0 : this.strokes);
    this.hudScore(`⛳ Hole ${this.holeIndex + 1}/${this.holes.length} · Par ${def.par}`);
    const upNext = this.phase === 'intro' || this.phase === 'aim' || this.phase === 'power' || this.phase === 'walk';
    this.hudInfo(`Kick ${Math.min(this.strokes + (upNext ? 1 : 0), MAX_STROKES)} · Total ${total}`);
    const sig = `${this.holeIndex}|${this.card.join(',')}|${this.strokes}`;
    if (sig !== this._scSig) {
      this._scSig = sig;
      this.eSc.innerHTML = '';
      this.holes.forEach((h, i) => {
        const done = i < this.card.length;
        const v = done ? this.card[i] : i === this.holeIndex ? (this.strokes || '·') : '';
        const cls = done ? (this.card[i] < h.par ? '.under' : this.card[i] > h.par ? '.over' : '') : i === this.holeIndex ? '.now' : '';
        this.eSc.appendChild(el(`div${cls}`, el('small', `P${h.par}`), String(v)));
      });
    }
    this.eLofts.forEach((e, i) => e.classList.toggle('on', i === this.loft));
    const tip = this.phase === 'power' ? `${G.ui.key('a')} kick!  ${G.ui.key('b')} cancel` : this.phase === 'aim' ? LOFTS[this.loft].tip : '';
    if (tip !== this._tip) { this._tip = tip; this.eTip.innerHTML = tip; }
    this.eUi.classList.toggle('off', this.phase !== 'aim' && this.phase !== 'power');
    this.eFill.style.width = `${(this.phase === 'power' ? this.meter : this.phase === 'windup' || this.phase === 'fly' ? this.power : 0) * 100}%`;
  }

  /** Hole-local → world. */
  wp(x, y, z) { return { x: x + this.ox, y, z: z + this.oz }; }

  // ---------------------------------------------------------------- flow
  begin() {
    this.pt = G.debug.fast ? 0.05 : 1.5;
    this._showCard(`HOLE 1 OF ${this.holes.length}`, this.def.name, `Par ${this.def.par}`);
    this._refreshUi();
  }

  tick(dt) {
    const inp = G.input;
    // fixed-step clock: moving obstacles and the ball both run off this.T
    this.acc += dt;
    while (this.acc >= H - 1e-9) {
      this.acc -= H;
      this.T += H;
      if (this.phase === 'fly') this._physStep();
    }
    this.pt -= dt;
    if (this.phase === 'intro') {
      if (this.pt <= 0 || inp.hit('a')) { inp.consume('a'); this._hideCard(); this.phase = 'aim'; }
    } else if (this.phase === 'aim') {
      const ax = inp.axis();
      const rate = inp.down('b') ? 0.28 : 1.25;
      if (Math.abs(ax.x) > 0.05) this.aim = wrapAngle(this.aim + ax.x * rate * dt);
      const nav = inp.nav();
      if (nav === 'up' && this.loft < LOFTS.length - 1) { this.loft++; G.audio.sfx('move'); }
      if (nav === 'down' && this.loft > 0) { this.loft--; G.audio.sfx('move'); }
      if (inp.hit('y')) { this.loft = (this.loft + 1) % LOFTS.length; G.audio.sfx('move'); }
      if (inp.hit('a')) { this.phase = 'power'; this.meter = 0; this.meterDir = 1; G.audio.sfx('tick'); }
    } else if (this.phase === 'power') {
      this.meter += this.meterDir * METER_SPEED * dt;
      if (this.meter >= 1) { this.meter = 1; this.meterDir = -1; G.audio.sfx('tock'); }
      if (this.meter <= 0) { this.meter = 0; this.meterDir = 1; G.audio.sfx('tock'); }
      if (inp.hit('a')) this._swing(this.meter);
      else if (inp.hit('b')) { this.phase = 'aim'; G.audio.sfx('back'); }
    } else if (this.phase === 'windup') {
      if (this.pt <= 0) this._launch(this.aim, this.loft, this.power);
    } else if (this.phase === 'walk') {
      const tx = this.lie.x - Math.cos(this.aim) * 1.6, tz = this.lie.z - Math.sin(this.aim) * 1.6;
      if (this.pt <= 0 || Math.hypot(this.hpos.x - tx, this.hpos.z - tz) < 0.35) this.phase = 'aim';
    } else if (this.phase === 'penalty') {
      if (this.pt <= 0) this._afterShot();
    } else if (this.phase === 'made' || this.phase === 'pickup') {
      if (this.pt <= 0) this._nextHole();
    }
    this._refreshUi();
  }

  _swing(power) {
    this.power = power;
    this.phase = 'windup';
    this.pt = WINDUP;
    this.hollow.play('kick');
    G.audio.sfx('ok');
  }

  _launch(aim, lofti, power) {
    this.aim = aim; this.loft = lofti; this.power = power;
    this.strokes++;
    this.ball = launchBall(this.lie, aim, lofti, power);
    this.phase = 'fly';
    this.spin = 0;
    this.trailT = 0;
    G.audio.sfx('kick'); G.audio.sfx('ghost');
    const p = this.wp(this.lie.x, 0.4, this.lie.z);
    this.fx.impact(p, 0xbfeee0, 0.55 + power * 0.5);
    this.fx.shake(0.08 + power * 0.14, 0.2);
    G.ui.pop(power > 0.93 ? 'BOOM!' : power > 0.6 ? 'THWACK!' : 'tap', this.wp(this.lie.x, 2.2, this.lie.z), power > 0.6 ? '' : 'white small', 0.8);
  }

  _physStep() {
    const b = this.ball;
    stepBall(b, this.hole, this.T, (name, x, y, z, extra) => this._event(name, x, y, z, extra));
    if (b.made) this._made();
    else if (b.dead) this._penalty(b.dead);
    else if (b.rest) { this.lie = { x: clamp(b.x, 0.3, this.hole.L - 0.3), z: clamp(b.z, 0.3, this.hole.D - 0.3) }; this._afterShot(); }
  }

  _event(name, x, y, z, extra) {
    const p = this.wp(x, Math.max(y, 0.2), z);
    if (name === 'bounce') {
      if (extra > 3) { G.audio.sfx(extra > 9 ? 'thud' : 'land'); this.fx.dust(p.x, p.z, 0xdff0c0, extra > 9 ? 4 : 2); }
    } else if (name === 'sand') {
      G.audio.sfx('land'); this.fx.burst('puff', p, 7, { speed: 2.2, up: 2.2, life: 0.45, s0: 0.35, color: 0xeedaa2 });
      if (extra > 4) G.ui.pop('PFFT', p, 'white small', 0.7);
    } else if (name === 'rough') {
      G.audio.sfx('land'); this.fx.burst('leaf', p, 5, { speed: 2, up: 2.4, life: 0.5, s0: 0.25, color: 0x5e9a41 });
    } else if (name === 'straw') {
      G.audio.sfx('land'); this.fx.burst('conf', p, 8, { speed: 3, up: 3.5, life: 0.6, s0: 0.2, s1: 0.1, color: [0xe8c95a, 0xb98a3a], flip: 8 });
    } else if (name === 'bale') {
      G.audio.sfx('thud'); this.fx.burst('conf', p, 10, { speed: 3.5, up: 3, life: 0.6, s0: 0.2, s1: 0.1, color: [0xe8c95a, 0xb98a3a], flip: 8 });
      G.ui.pop('WHUMP', p, 'white small', 0.7);
    } else if (name === 'bumper') {
      G.audio.sfx('boing'); this.fx.impact(p, 0xffe27a, 0.6); G.ui.pop('BOING!', p, '', 0.8);
      if (this.bumperMeshes[extra]) this.bumperMeshes[extra].flash = 1;
    } else if (name === 'mill') {
      G.audio.sfx('bonk'); this.fx.impact(p, 0xffffff, 0.5); G.ui.pop('WHAP!', p, '', 0.8);
    } else if (name === 'rail') {
      G.audio.sfx('tock'); this.fx.dust(p.x, p.z, 0xffffff, 2);
    } else if (name === 'doink') {
      G.audio.sfx('doink'); this.fx.impact(p, 0xffd45a, 0.7); this.fx.shake(0.12, 0.2); G.ui.pop('DOINK!', p, 'bad', 1);
    } else if (name === 'splash') {
      G.audio.sfx('splash');
      this.fx.burst('drop', p, 16, { speed: 3.4, up: 5.5, life: 0.7, s0: 0.3, color: 0x9be8ff });
      this.fx.emit('ring', p.x, 0.08, p.z, { life: 0.6, s0: 0.5, s1: 3.2, color: 0xffffff });
    } else if (name === 'ob') {
      G.audio.sfx('miss'); this.fx.dust(p.x, p.z, 0xdff0c0, 4);
    }
  }

  _made() {
    const par = this.def.par, n = this.strokes;
    const g = this.hole.goal;
    const d = n - par;
    const word = n === 1 ? 'ACE!' : d <= -2 ? 'EAGLE!' : d === -1 ? 'BIRDIE!' : d === 0 ? 'PAR' : d === 1 ? 'BOGEY' : `+${d}`;
    this.card.push(n);
    this.phase = 'made'; this.pt = G.debug.fast ? 0.3 : 2.2;
    G.audio.sfx('td');
    const p = this.wp(g.x, 3.4, g.z);
    this.fx.confetti(p, 46);
    this.fx.sparkle(p, 0xfff2a8, 12);
    this.fx.shake(0.16, 0.3);
    G.ui.banner('IT\'S GOOD!', `${word} — ${n} kick${n === 1 ? '' : 's'}`, { dur: 1.7, cls: d <= 0 ? '' : 'cool' });
    for (const f of this.fans) f.ch.play('celebrate', 1.4 + f.i * 0.1);
    this.hollow.play('celebrate');
  }

  _penalty(kind) {
    this.strokes++;
    this.phase = 'penalty'; this.pt = G.debug.fast ? 0.2 : 1.25;
    const b = this.ball;
    G.ui.pop(kind === 'water' ? 'SPLASH! +1' : 'OUT OF BOUNDS! +1', this.wp(b.x, 2.4, b.z), 'bad', 1.2);
    this.hollow.play('flinch');
  }

  _afterShot() {
    if (this.ball.dead) this.ball = newBall(this.lie.x, this.lie.z);    // drop back at the old lie
    if (this.strokes >= MAX_STROKES) {
      this.card.push(MAX_STROKES + 1);
      this.phase = 'pickup'; this.pt = G.debug.fast ? 0.3 : 1.7;
      G.audio.sfx('sad');
      G.ui.banner('PICK IT UP', `That's a ${MAX_STROKES + 1}. On to the next one.`, { dur: 1.4, cls: 'bad small' });
      return;
    }
    const g = this.hole.goal;
    this.aim = Math.atan2(g.z - this.lie.z, g.x - this.lie.x);
    // close in? default to the low kick
    if (Math.hypot(g.x - this.lie.x, g.z - this.lie.z) < 9) this.loft = 0;
    this.phase = 'walk'; this.pt = G.debug.fast ? 0.1 : 0.7;
  }

  _nextHole() {
    if (this.holeIndex + 1 >= this.holes.length) { this._end(); return; }
    this._loadHole(this.holeIndex + 1);
    this._syncCamera(1, true);
  }

  _end() {
    const total = this.card.reduce((a, b) => a + b, 0);
    const par = this.holes.reduce((a, h) => a + h.par, 0);
    const rel = total - par;
    const rows = this.holes.map((h, i) => `${i + 1}. ${h.name}: <b>${this.card[i]}</b> <span class="muted">(par ${h.par})</span>`).join('<br>');
    this.phase = 'done';
    this.finish({ score: total, title: rel <= 0 ? 'What a round!' : 'Round over', detail: `${rows}<br>Course par ${par} — you finished <b>${rel === 0 ? 'level' : rel > 0 ? `${rel} over` : `${-rel} under`}</b>.`, extra: { card: this.card.slice(), par } });
  }

  // ---------------------------------------------------------------- per-frame visuals
  ambient(dt) {
    const hole = this.hole, b = this.ball;
    if (this.state !== 'play') scrubNulls();
    const t = this.time;
    // ball
    const sp = Math.hypot(b.vx, b.vz);
    if (this.phase === 'fly' || this.phase === 'made') {
      this.spin += dt * (b.air ? 13 : sp * 1.6);
      if (sp > 0.4) this.ballYaw = Math.atan2(b.vx, b.vz);
      if (this.phase === 'made') {            // let it sail on through
        b.vy -= GRAV * dt * (b.y > 0 ? 1 : 0); b.x += b.vx * dt; b.z += b.vz * dt; b.y = Math.max(0, b.y + b.vy * dt);
        if (b.y <= 0) { b.vx *= 0.9; b.vz *= 0.9; b.vy = 0; }
      }
      this.trailT -= dt;
      if (b.air && b.y > 0.5 && this.trailT <= 0 && this.phase === 'fly') { this.trailT = 0.035; this.fx.emit('puff', b.x + this.ox, b.y + 0.3, b.z + this.oz, { life: 0.35, s0: 0.26, s1: 0.02, color: 0xffffff }); }
    }
    this.ballMesh.visible = this.phase !== 'penalty' || this.pt > 0.9;
    this.ballMesh.position.set(b.x, b.y + 0.34, b.z);
    this.ballMesh.rotation.set(this.spin || 0, this.ballYaw ?? Math.PI / 2, 0, 'YXZ');
    this.ballShadow.visible = this.ballMesh.visible;
    this.ballShadow.position.set(b.x, 0.03, b.z);
    this.ballShadow.scale.setScalar(clamp(1 - b.y / 16, 0.4, 1));

    // moving obstacles
    this.millMeshes.forEach((mm, i) => { const m = hole.mills[i]; mm.userData.arm.rotation.y = -(m.ph + m.om * this.T); });
    for (const c of this.cartMeshes) { const p = cartPos(c.cart, this.T); c.mesh.position.set(p.x, 0, p.z); }
    for (const bm of this.bumperMeshes) { if (bm.flash > 0) bm.flash = Math.max(0, bm.flash - dt * 4); const k = 1 + bm.flash * 0.28; bm.mesh.scale.set(k, 1 - bm.flash * 0.12, k); }
    if (this.wheel) this.wheel.rotation.z += dt * 0.16;
    this.star.position.y = 7.4 + Math.sin(t * 2.4) * 0.35;
    this.star.rotation.y += dt * 2;
    this.star.visible = this.phase !== 'made';

    // wind sock + drifting leaves
    const [wx, wz] = hole.wind, ws = Math.hypot(wx, wz);
    const piv = this.sock.userData.pivot;
    piv.rotation.y = -Math.atan2(wz, wx) + Math.sin(t * 3.1) * 0.12 * Math.min(1, ws);
    this.sock.userData.sock.rotation.z = -clamp(1.25 - ws * 0.3, 0.06, 1.25) + Math.sin(t * 5.3) * 0.05 * ws;
    if (ws > 0.2 && Math.random() < dt * ws * 2.2) {
      const L = hole.L, D = hole.D;
      this.fx.emit('leaf', this.ox + Math.random() * L - wx * 2, 0.6 + Math.random() * 4, this.oz + Math.random() * D - wz * 2, { vx: wx * 1.5, vz: wz * 1.5, vy: -0.5, g: 0, life: 2.6, s0: 0.3, s1: 0.22, color: [0xe8842c, 0xd4502f, 0xf2b632][Math.floor(Math.random() * 3)], vrot: 4, flip: 4 });
    }

    // aim guide
    const aiming = this.phase === 'aim' || this.phase === 'power';
    const ca = Math.cos(this.aim), sa = Math.sin(this.aim);
    const full = carryOf(this.loft, 1);
    this.dots.forEach((d, i) => {
      const dist = 1.6 + i * 0.85;
      d.visible = aiming && dist < full - 0.3;
      if (d.visible) d.position.set(this.lie.x + ca * dist, 0.05, this.lie.z + sa * dist);
    });
    for (const mk of this.marks) {
      mk.mesh.visible = aiming;
      const c = carryOf(this.loft, mk.p);
      mk.mesh.position.set(this.lie.x + ca * c, 0.06, this.lie.z + sa * c);
      mk.label.visible = aiming;
      // tuck the label on whichever side of the line is away from the aim, so it never sits on the dots
      const side = Math.abs(sa) > 0.75 ? 0 : 1;
      mk.label.position.set(this.lie.x + ca * c + (side ? 0 : 1.25), 0.09, this.lie.z + sa * c + (side ? 0.95 : 0));
    }
    this.chevron.visible = aiming;
    this.chevron.position.set(this.lie.x + ca * 1.15, 0.07, this.lie.z + sa * 1.15);
    this.chevron.rotation.set(-Math.PI / 2, 0, -this.aim);
    this.landRing.visible = this.phase === 'power';
    if (this.landRing.visible) {
      const c = carryOf(this.loft, this.meter);
      this.landRing.position.set(this.lie.x + ca * c, 0.08, this.lie.z + sa * c);
      this.landRing.scale.setScalar(1 + Math.sin(t * 16) * 0.08);
    }

    // Coach Hollow floats behind the ball, swoops through it to kick, then follows it
    let hx, hz, lam = 7;
    if (this.phase === 'windup') { hx = this.lie.x + ca * 0.5; hz = this.lie.z + sa * 0.5; lam = 26; }
    else if (this.phase === 'fly' || this.phase === 'penalty' || this.phase === 'made' || this.phase === 'pickup') { hx = this.hpos.x; hz = this.hpos.z; }
    else { hx = this.lie.x - ca * 1.6; hz = this.lie.z - sa * 1.6; }
    this.hpos.x = damp(this.hpos.x, hx, lam, dt); this.hpos.z = damp(this.hpos.z, hz, lam, dt);
    this.hollow.setPos(this.hpos.x + this.ox, this.hpos.z + this.oz);
    const look = aiming || this.phase === 'windup' || this.phase === 'intro' || this.phase === 'walk' ? Math.atan2(ca, sa) : Math.atan2(b.x - this.hpos.x, b.z - this.hpos.z);
    this.hollow.face(look, dt, 10);
    this.hollow.update(dt, 0);
    for (const f of this.fans) {
      f.t -= dt;
      if (f.t <= 0) { f.t = 3 + f.i * 1.3; if (!f.ch.busy) f.ch.play(['nod', 'wave', 'hop'][(f.i + Math.floor(t)) % 3]); }
      f.ch.faceTo(b.x + this.ox, b.z + this.oz, dt, 4);
      f.ch.update(dt, 0);
    }
    this._syncCamera(dt, false);
  }

  _syncCamera(dt, snap) {
    const hole = this.hole, b = this.ball, g = hole.goal;
    const bx = this.phase === 'penalty' ? this.lie.x : b.x, bz = this.phase === 'penalty' ? this.lie.z : b.z;
    const k = this.phase === 'made' ? 0.8 : 0.5;
    let tx = lerp(bx, g.x, k) + this.ox, tz = lerp(bz, g.z, k) + this.oz;
    const aspect = this.camera.aspect;
    const spanX = Math.abs(bx - g.x) + 15, spanZ = Math.abs(bz - g.z) + 13 + Math.min(8, b.y * 0.5);
    let d = Math.max(spanX / (0.389 * aspect), spanZ / 0.484);
    d = clamp(d * 1.03, 36, 90);
    tz += d * 0.026;
    if (snap) { this.cam.x = tx; this.cam.z = tz; this.cam.d = d; }
    else { const lam = 2.6; this.cam.x = damp(this.cam.x, tx, lam, dt); this.cam.z = damp(this.cam.z, tz, lam, dt); this.cam.d = damp(this.cam.d, d, 2.2, dt); }
    const pitch = 0.93;
    this.camera.position.set(this.cam.x, Math.sin(pitch) * this.cam.d, this.cam.z + Math.cos(pitch) * this.cam.d);
    this.camera.lookAt(this.cam.x, 0.6, this.cam.z);
    this.fx.applyShake(this.camera);
    this.rig.follow(this.cam.x, this.cam.z);
  }

  // ---------------------------------------------------------------- QA helpers (used by tools/fable-scenarios/mg-golf.cjs)
  /** Dry-run a kick from the current lie. Returns where it ends up. */
  simulate(aim, lofti, power, T0 = this.T) {
    const b = launchBall(this.lie, aim, lofti, power);
    let T = T0, steps = 0;
    while (!b.rest && !b.dead && !b.made && steps++ < 1800) { T += H; stepBall(b, this.hole, T, NOEV); }
    return { made: b.made, dead: b.dead, x: b.x, z: b.z, t: b.t };
  }
  /** Kick right now, skipping the meter (the planner bot uses this). */
  debugKick(aim, lofti, power) {
    if (this.phase !== 'aim' && this.phase !== 'power') return false;
    this.hollow.play('kick');
    this._launch(aim, lofti, power);
    return true;
  }
  /** Walking distance to the uprights from every cell, around bales and ponds. */
  _field() {
    if (this._fieldFor === this.hole) return this._dist;
    const hole = this.hole, W = Math.ceil(hole.L), Dp = Math.ceil(hole.D);
    const blocked = new Uint8Array(W * Dp), dist = new Float32Array(W * Dp).fill(1e9);
    for (let x = 0; x < W; x++) for (let z = 0; z < Dp; z++) {
      const cx = x + 0.5, cz = z + 0.5;
      for (const B of hole.bales) if (!B.cart && Math.abs(cx - B.x) < B.hw + 0.6 && Math.abs(cz - B.z) < B.hd + 0.6) blocked[x + z * W] = 1;
      for (const p of hole.ponds) { const ux = (cx - p.x) / (p.rx + 0.5), uz = (cz - p.z) / (p.rz + 0.5); if (ux * ux + uz * uz < 1) blocked[x + z * W] = 1; }
    }
    const g = hole.goal;
    const q = [];
    const sx = clamp(Math.floor(g.x), 0, W - 1), sz = clamp(Math.floor(g.z), 0, Dp - 1);
    dist[sx + sz * W] = 0; q.push(sx + sz * W);
    for (let qi = 0; qi < q.length; qi++) {
      const id = q[qi], x = id % W, z = (id - x) / W;
      for (const [dx, dz, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= Dp) continue;
        const ni = nx + nz * W;
        if (blocked[ni] || dist[ni] <= dist[id] + c) continue;
        dist[ni] = dist[id] + c; q.push(ni);
      }
    }
    this._fieldFor = hole; this._dist = dist; this._fw = W; this._fd = Dp;
    return dist;
  }
  /** Brute-force the best kick from here. */
  plan() {
    const hole = this.hole, g = hole.goal, lie = this.lie;
    const dist = this._field(), W = this._fw, Dp = this._fd;
    const base = Math.atan2(g.z - lie.z, g.x - lie.x);
    let best = null;
    const tryShot = (aim, lofti, power) => {
      const r = this.simulate(aim, lofti, power);
      let score;
      if (r.made) score = -1000 + r.t;
      else if (r.dead) score = 900;
      else {
        const cx = clamp(Math.floor(r.x), 0, W - 1), cz = clamp(Math.floor(r.z), 0, Dp - 1);
        score = Math.min(dist[cx + cz * W], 400) + (((r.x - g.x) * g.nx + (r.z - g.z) * g.nz) > 0 ? 6 : 0);
      }
      if (!best || score < best.score) best = { aim, lofti, power, score, made: r.made };
    };
    for (let lofti = 0; lofti < 3; lofti++) for (let k = 0; k < 48; k++) for (let p = 0.1; p <= 1.001; p += 0.1) tryShot((k / 48) * TAU, lofti, p);
    for (let lofti = 0; lofti < 3; lofti++) for (let da = -0.3; da <= 0.301; da += 0.03) for (let p = 0.05; p <= 1.001; p += 0.05) tryShot(base + da, lofti, p);
    const c = best;
    for (let da = -0.06; da <= 0.0601; da += 0.012) for (let dp = -0.08; dp <= 0.0801; dp += 0.02) tryShot(c.aim + da, c.lofti, clamp(c.power + dp, 0, 1));
    return best;
  }
}

/** The shell builds its cards with native append(), which prints null/false children as text. Sweep them away. */
function scrubNulls() {
  for (const b of document.querySelectorAll('.mg-card .panel-body')) {
    for (const n of [...b.childNodes]) if (n.nodeType === 3 && /^(null|false|undefined)+$/.test(n.nodeValue)) n.remove();
  }
}

export { HOLES, HARD_HOLES, LOFTS, carryOf };
