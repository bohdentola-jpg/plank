// PORT HALCYON — your garage: a two-storey brick workshop on Foundry St in
// The Works, its neon sign over a roll-up door that opens onto the street.
// Inside: an epoxy floor with the bay marked out, a bench and pegboard, tool
// chests, a tyre rack, a two-post lift, shelves of parts, a couch and an old
// TV, fluorescent tubes on the trusses. It is part of the world (built once,
// where it stands), not a separate set: the camera turns round inside it and
// the car drives straight out of the door into the city.
//
// Local frame: a across (+ to your right as you face the door from inside),
// b toward the door (+), y up; the car's spot (GARAGE) is a = 0, b = 0.
import * as THREE from 'three';
import { GARAGE } from './map/base.js';
import { glowMat, nightEmissive, U } from './kit.js';
import { bake } from './build/cell.js';
import { lampsInBox } from './build/roads.js';
import { Acc } from './build/geo.js';
import { box, cylinder, lattice } from './districts/builder.js';
import { toTex, concreteTexture } from '../track/textures.js';
import { canvas, grain, blot } from '../screens/lotScene.js';
import { makeRng } from '../core/util.js';

const AW = 8.6;            // inner half-width
const BF = 11.6;           // inner face of the front (door) wall
const BB = -12.0;          // inner face of the back wall
const WT = 0.4;            // wall thickness
const RH = 7.0;            // roof underside
const FH = 9.4;            // facade top (parapet)
const DW = 2.8;            // half the door's width
const DH = 4.8;            // door height

/** Inside the garage the tubes light everything, day or night (baked like the street lamps). */
function shopMat(params, strength = 2.4) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * diffuseColor.rgb * ${strength.toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'garage-glow' + strength.toFixed(2) + (params.map ? 'm' : '') + (params.vertexColors ? 'vc' : '');
  return m;
}

// ------------------------------------------------------------------ textures

function floorTex() {
  const PX = 24, w = Math.round(AW * 2 * PX), h = Math.round((BF - BB) * PX);
  const c = canvas(w, h), x = c.getContext('2d');
  const rng = makeRng('mygarage-floor');
  x.fillStyle = '#5f6466';
  x.fillRect(0, 0, w, h);
  grain(x, w, h, rng, w * h * 0.25, 0.12);
  for (let i = 0; i < 50; i++) blot(x, rng() * w, rng() * h, 8 + rng() * 60, '12,12,10', 0.1 + rng() * 0.12);
  for (let i = 0; i < 25; i++) blot(x, rng() * w, rng() * h, 20 + rng() * 50, '170,175,170', 0.06);
  // the bay: a yellow dashed box round where the car stands, an arrow to the door
  const cx = w / 2, cy = h + BB * PX;              // b = 0 (v runs from the back wall up to the door)
  x.strokeStyle = 'rgba(232,186,40,0.85)';
  x.lineWidth = 6;
  x.setLineDash([30, 14]);
  x.strokeRect(cx - 1.9 * PX, cy - 3.3 * PX, 3.8 * PX, 6.6 * PX);
  x.setLineDash([]);
  x.fillStyle = 'rgba(232,186,40,0.7)';
  for (let k = 0; k < 3; k++) {
    const y0 = cy - (4.6 + k * 1.4) * PX;
    x.beginPath(); x.moveTo(cx, y0 - 0.9 * PX); x.lineTo(cx + 0.7 * PX, y0); x.lineTo(cx - 0.7 * PX, y0); x.closePath(); x.fill();
  }
  // the lift's bay on the right, hatched
  x.strokeStyle = 'rgba(232,186,40,0.5)';
  x.lineWidth = 4;
  x.strokeRect(w / 2 + 3.6 * PX, cy - 6.5 * PX, 3.6 * PX, 7 * PX);
  // oil under the car, a drain
  for (let i = 0; i < 6; i++) blot(x, cx + (rng() - 0.5) * 40, cy + (rng() - 0.5) * 80, 14 + rng() * 26, '6,5,3', 0.45);
  x.fillStyle = '#25282a';
  x.fillRect(cx - 14, cy + 4.2 * PX, 28, 28);
  const t = toTex(c, { repeat: false });
  return t;
}

function wallTex() {
  // painted brick, a dark green wainscot with a red pinstripe (1 repeat = 8 m wide × 7 m tall)
  const PX = 40, w = 8 * PX, h = 7 * PX;
  const c = canvas(w, h), x = c.getContext('2d');
  const rng = makeRng('mygarage-wall');
  x.fillStyle = '#b4b0a2';
  x.fillRect(0, 0, w, h);
  const bw = 0.42 * PX, bh = 0.2 * PX;
  for (let row = 0; row * bh < h; row++) {
    for (let col = -1; col * bw < w; col++) {
      const bx = col * bw + (row % 2 ? bw / 2 : 0);
      const tt = 172 + Math.floor((rng() - 0.5) * 16);
      x.fillStyle = `rgb(${tt},${tt - 3},${tt - 15})`;
      x.fillRect(bx + 1, h - (row + 1) * bh + 1, bw - 2, bh - 2);
    }
  }
  grain(x, w, h, rng, w * h * 0.15, 0.12);
  x.fillStyle = 'rgba(28,56,44,0.96)';
  x.fillRect(0, h - 1.25 * PX, w, 1.25 * PX);
  x.fillStyle = 'rgba(170,32,32,0.9)';
  x.fillRect(0, h - 1.33 * PX, w, 0.06 * PX);
  for (let k = 0; k < 8; k++) blot(x, rng() * w, h - rng() * PX, 20 + rng() * 40, '0,0,0', 0.15);
  return toTex(c);
}

function brickTex() {
  // the street front: dark red brick, soot (1 repeat = 6 m × 6 m)
  const PX = 48, w = 6 * PX, h = 6 * PX;
  const c = canvas(w, h), x = c.getContext('2d');
  const rng = makeRng('mygarage-brick');
  x.fillStyle = '#3a2420';
  x.fillRect(0, 0, w, h);
  const bw = 0.42 * PX, bh = 0.18 * PX;
  for (let row = 0; row * bh < h; row++) {
    for (let col = -1; col * bw < w; col++) {
      const bx = col * bw + (row % 2 ? bw / 2 : 0);
      const r = 96 + Math.floor((rng() - 0.5) * 36), g = 46 + Math.floor((rng() - 0.5) * 16);
      x.fillStyle = `rgb(${r},${g},${g - 10})`;
      x.fillRect(bx + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
  }
  grain(x, w, h, rng, w * h * 0.2, 0.15);
  for (let i = 0; i < 12; i++) {
    const sx = rng() * w;
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(sx, 0, 6 + rng() * 20, h * (0.3 + rng() * 0.5));
  }
  return toTex(c);
}

function doorTex() {
  // corrugated slats, pale steel with a red band (one repeat = the whole door)
  const w = 256, h = 512;
  const c = canvas(w, h), x = c.getContext('2d');
  const rng = makeRng('mygarage-door');
  const slats = 24;
  for (let k = 0; k < slats; k++) {
    const y = (k / slats) * h, sh = h / slats;
    const g = x.createLinearGradient(0, y, 0, y + sh);
    g.addColorStop(0, '#c9cdd0'); g.addColorStop(0.5, '#a9aeb2'); g.addColorStop(0.9, '#7c8186'); g.addColorStop(1, '#4a4e52');
    x.fillStyle = g;
    x.fillRect(0, y, w, sh);
  }
  x.fillStyle = 'rgba(176,28,32,0.85)';
  x.fillRect(0, h * 0.62, w, h / slats * 2);
  grain(x, w, h, rng, w * h * 0.2, 0.1);
  for (let i = 0; i < 14; i++) blot(x, rng() * w, h - rng() * 120, 10 + rng() * 40, '40,30,20', 0.18);
  return toTex(c, { repeat: true });
}

function pegTex() {
  const w = 512, h = 256;
  const c = canvas(w, h), x = c.getContext('2d');
  const rng = makeRng('mygarage-peg');
  x.fillStyle = '#9b8058';
  x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(40,28,14,0.6)';
  for (let yy = 8; yy < h; yy += 14) for (let xx = 8; xx < w; xx += 14) x.fillRect(xx, yy, 3, 3);
  // tool outlines and tools
  const tools = 26;
  for (let i = 0; i < tools; i++) {
    const tx = 20 + rng() * (w - 40), ty = 20 + rng() * (h - 70), len = 30 + rng() * 60;
    x.strokeStyle = '#1a1a1a';
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + (rng() - 0.5) * 12, ty + len); x.stroke();
    x.fillStyle = ['#c21f1f', '#e0b020', '#2a5ab0', '#202020'][Math.floor(rng() * 4)];
    x.fillRect(tx - 5, ty + len - 14, 10, 16);
  }
  return toTex(c, { repeat: false });
}

function signTex() {
  // the neon over the door: GARAGE in cyan, FOUNDRY ST in pink, on a dark board
  const w = 1024, h = 256;
  const c = canvas(w, h), x = c.getContext('2d');
  const e = canvas(w, h), ex = e.getContext('2d');
  x.fillStyle = '#121418';
  x.fillRect(0, 0, w, h);
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, w, h);
  const neon = (ctx, txt, size, y, col, blur) => {
    ctx.font = `900 ${size}px "Bahnschrift", "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    ctx.lineWidth = size * 0.08;
    ctx.strokeStyle = col;
    ctx.strokeText(txt, w / 2, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.0)';
  };
  for (const [ctx, blur] of [[x, 0], [ex, 18]]) {
    neon(ctx, 'GARAGE', 150, 104, '#3ae8ff', blur);
    neon(ctx, 'FOUNDRY  ST', 54, 214, '#ff4fa3', blur);
  }
  // the tubes' own brightness on the board by day (unlit glass)
  x.globalAlpha = 0.6;
  x.drawImage(e, 0, 0);
  x.globalAlpha = 1;
  return { map: toTex(c, { repeat: false }), emi: toTex(e, { repeat: false }) };
}

function tvTex() {
  const c = canvas(128, 96), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, '#5a7ab8'); g.addColorStop(1, '#1a2448');
  x.fillStyle = g; x.fillRect(0, 0, 128, 96);
  x.fillStyle = 'rgba(255,255,255,0.15)';
  for (let y = 0; y < 96; y += 3) x.fillRect(0, y, 128, 1);
  x.fillStyle = '#e8f0ff'; x.font = 'bold 14px monospace'; x.fillText('92.7', 46, 52);
  return toTex(c, { repeat: false });
}

// ------------------------------------------------------------------ the building

export class Garage {
  /** ctx: { net, terrain, districts? }. spot: { x, z, heading } (default GARAGE). */
  constructor(ctx, spot = GARAGE) {
    this.ctx = ctx;
    this.spot = spot;
    const h = spot.heading;
    this.f = [Math.sin(h), Math.cos(h)];          // toward the door
    this.r = [-Math.cos(h), Math.sin(h)];         // to the right, facing the door
    this.ry = h;
    // the floor: level with the sidewalk outside the door (no lip to drive over)
    const out = this.w(0, BF + 1.2);
    const walk = ctx.net.surfaces(out[0], out[1], []);
    let ys = -Infinity;
    for (const s of walk) ys = Math.max(ys, s.h);
    let yt = -Infinity;
    for (let a = -AW; a <= AW; a += 2) for (let b = BB; b <= BF; b += 2) { const p = this.w(a, b); yt = Math.max(yt, ctx.terrain.heightAt(p[0], p[1])); }
    this.y = Math.max(ys > -1e8 ? ys + 0.02 : -Infinity, yt + 0.04);
    this.door = 0;             // 0 shut … 1 open
    this.doorTarget = 0;
    this.colliders = [];
    this.lamps = [];
    this.group = null;
  }

  /** World [x, z] of local (a, b). */
  w(a, b) {
    return [this.spot.x + this.r[0] * a + this.f[0] * b, this.spot.z + this.r[1] * a + this.f[1] * b];
  }
  /** World Vector3 of local (a, b, y above the floor). */
  v(a, b, y = 0, out = new THREE.Vector3()) {
    const p = this.w(a, b);
    return out.set(p[0], this.y + y, p[1]);
  }
  /** Local (a, b) of a world point. */
  local(x, z) {
    const dx = x - this.spot.x, dz = z - this.spot.z;
    return [dx * this.r[0] + dz * this.r[1], dx * this.f[0] + dz * this.f[1]];
  }
  /** Is (x, z) inside the building (pad m in from its walls)? */
  inside(x, z, pad = 0) {
    const [a, b] = this.local(x, z);
    return Math.abs(a) < AW - pad && b > BB + pad && b < BF - pad;
  }

  /** The floor as something to drive on: { h } where it covers (x, z), else null. */
  floorAt(x, z) {
    const [a, b] = this.local(x, z);
    if (Math.abs(a) <= AW && b >= BB && b <= BF + (Math.abs(a) <= DW + 0.2 ? 0.8 : 0)) return this.y;
    return null;
  }

  build() {
    const g = new THREE.Group();
    g.name = 'your garage';
    this.group = g;
    const acc = new Map();
    const A = (mat) => { let a = acc.get(mat); if (!a) { a = new Acc(false); acc.set(mat, a); } return a; };
    const M = this.mats = this.mats || makeMats();
    const y = this.y, ry = this.ry;
    const at = (a, b) => this.w(a, b);
    const bx = (mat, a, b, y0, w, hh, d, o = {}) => { const p = at(a, b); box(A(mat), p[0], y + y0, p[1], w, hh, d, ry, o); };
    const solid = (a, b, w, d, y0, y1, tag) => {
      const p = at(a, b);
      const c = { kind: 'box', x: p[0], z: p[1], hx: w / 2, hz: d / 2, ry, y0: y + y0, y1: y + y1, tag };
      this.colliders.push(c);
      return c;
    };

    // ---- shell: walls out to the street, the floor, the roof
    const base = -1.6;
    // side and back walls (outside: brick; inside: painted brick)
    for (const sd of [-1, 1]) {
      bx(M.brick, sd * (AW + WT / 2), (BF + BB) / 2, base, WT, FH - base, BF - BB + WT * 2, { u: 6, v: 6, faces: (sd > 0 ? 'l' : 'r') + 'fb' });
      solid(sd * (AW + WT / 2), (BF + BB) / 2, WT, BF - BB + WT * 2, base, FH);
      // the inside face
      const p = at(sd * (AW - 0.01), (BF + BB) / 2);
      const W0 = A(M.wall);
      box(W0, p[0], y, p[1], 0.02, RH, BF - BB, ry, { u: 8, v: 7, faces: sd > 0 ? 'r' : 'l', top: false });
    }
    bx(M.brick, 0, BB - WT / 2, base, AW * 2 + WT * 2, FH - base, WT, { u: 6, v: 6, faces: 'blr' });
    solid(0, BB - WT / 2, AW * 2 + WT * 2, WT, base, FH);
    { const p = at(0, BB + 0.01); box(A(M.wall), p[0], y, p[1], AW * 2, RH, 0.02, ry, { u: 8, v: 7, faces: 'f', top: false }); }
    // the front: either side of the door, and over it
    const sideW = AW + WT - DW;
    for (const sd of [-1, 1]) {
      const a = sd * (DW + sideW / 2);
      bx(M.brick, a, BF + WT / 2, base, sideW, FH - base, WT, { u: 6, v: 6, faces: 'flr' });
      solid(a, BF + WT / 2, sideW, WT, base, FH);
      const p = at(sd * (DW + (AW - DW) / 2), BF - 0.01);
      box(A(M.wall), p[0], y, p[1], AW - DW, RH, 0.02, ry, { u: 8, v: 7, faces: 'b', top: false });
    }
    bx(M.brick, 0, BF + WT / 2, DH, DW * 2, FH - DH, WT, { u: 6, v: 6, top: false });
    // a steel lintel and the door's housing inside
    bx(M.steel, 0, BF + WT + 0.05, DH - 0.05, DW * 2 + 0.6, 0.3, 0.12);
    bx(M.steel, 0, BF - 0.35, DH, DW * 2 + 0.2, 0.55, 0.6);
    // parapet coping and a concrete plinth along the street
    bx(M.concrete, 0, BF + WT / 2, FH, AW * 2 + WT * 2 + 0.3, 0.25, WT + 0.3);
    for (const sd of [-1, 1]) bx(M.concrete, sd * (DW + sideW / 2), BF + WT + 0.04, -0.1, sideW, 0.6, 0.12);
    // the floor and the threshold out to the sidewalk
    {
      const P0 = at(-AW, BB), P1 = at(AW, BB), P2 = at(AW, BF), P3 = at(-AW, BF);
      A(M.floor).quadP([P0[0], y, P0[1]], [P1[0], y, P1[1]], [P2[0], y, P2[1]], [P3[0], y, P3[1]], [0, 0, 1, 1]);
      const Q0 = at(-DW, BF), Q1 = at(DW, BF), Q2 = at(DW, BF + WT + 0.6), Q3 = at(-DW, BF + WT + 0.6);
      A(M.concrete).quadP([Q0[0], y, Q0[1]], [Q1[0], y, Q1[1]], [Q2[0], y - 0.01, Q2[1]], [Q3[0], y - 0.01, Q3[1]], [0, 0, 1, 0.2]);
    }
    // the roof: dark corrugated underside, a roof deck above
    bx(M.roofUnder, 0, (BF + BB) / 2, RH, AW * 2, 0.05, BF - BB, { u: 2, top: false, bottom: true, faces: 'x' });
    bx(M.concrete, 0, (BF + BB) / 2, RH + 0.05, AW * 2 + WT * 2, 0.35, BF - BB + WT * 2, { u: 6 });

    // ---- the trusses, the tubes (they light the place)
    for (const b of [-8.5, -3.5, 1.5, 6.5]) {
      const L = at(-AW, b), R = at(AW, b);
      lattice(A(M.steel), [L[0], y + 6.3, L[1]], [R[0], y + 6.3, R[1]], 0.5, { bar: 0.05, bay: 1.2 });
    }
    for (const a of [-3.2, 3.2]) {
      for (const b of [-10, -5.5, -1, 3.5, 8]) {
        bx(M.fixture, a, b, 5.6, 0.32, 0.12, 2.4);
        bx(M.tube, a, b, 5.55, 0.12, 0.06, 2.3, { top: false, bottom: true });
        const p = at(a, b);
        // (chains up to the truss)
        const c0 = at(a, b - 1), c1 = at(a, b + 1);
        A(M.steel).beam(c0[0], y + 5.7, c0[1], c0[0], y + 6.3, c0[1], 0.03, 0.03);
        A(M.steel).beam(c1[0], y + 5.7, c1[1], c1[0], y + 6.3, c1[1], 0.03, 0.03);
        this.lamps.push({ x: p[0], z: p[1], hx: p[0], hy: y + 5.5, hz: p[1], color: new THREE.Color('#e4eeff'), radius: 10.5, intensity: 0.55, halo: 0, inside: true });
      }
    }

    // ---- the bench wall (left): bench, pegboard, vise, chests
    const L = -AW + 0.45;
    bx(M.wood, L, -2, 0.95, 0.9, 0.08, 7.5);
    for (const b of [-5.6, -2, 1.6]) bx(M.steelDark, L, b, 0, 0.8, 0.95, 0.08);
    bx(M.steelDark, L, -2, 0.25, 0.8, 0.05, 7.4);
    bx(M.peg, -AW + 0.03, -2, 1.3, 0.04, 1.5, 7.2, { u: 7.2, v: 1.5, faces: 'l', top: false });
    bx(M.steelDark, L + 0.1, -4.3, 1.03, 0.2, 0.22, 0.3);
    solid(L, -2, 0.9, 7.5, 0, 1.05);
    for (const [b, hh] of [[3.6, 1.05], [5.0, 1.35]]) {
      bx(M.redTool, -AW + 0.5, b, 0.12, 0.75, hh, 1.15);
      for (let k = 1; k < 6; k++) bx(M.steel, -AW + 0.9, b, 0.12 + k * hh / 6, 0.02, 0.03, 0.9);
      solid(-AW + 0.5, b, 0.75, 1.15, 0, hh + 0.12);
    }
    // ---- the tyre wall (right, back): a rack of tyres
    const TR = AW - 0.5;
    for (const yy of [0.05, 1.05, 2.05]) bx(M.steelDark, TR, -8, yy, 0.8, 0.06, 6);
    for (const b of [-10.9, -5.1]) bx(M.steelDark, TR, b, 0, 0.08, 2.4, 0.08);
    for (let k = 0; k < 18; k++) {
      const yy = [0.11, 1.11, 2.11][k % 3], b = -10.5 + Math.floor(k / 3) * 1.0;
      const p = at(TR, b);
      cylinder(A(M.tyre), p[0], y + yy + 0.33, p[1], 0.33, 0.24, 10, { top: true, bottom: true });
    }
    solid(TR, -8, 0.9, 6, 0, 2.5);
    // ---- the lift (right bay): two posts and their arms
    for (const b of [-4.2, 0.8]) {
      bx(M.liftBlue, AW - 1.6, b, 0, 0.42, 3.9, 0.42);
      solid(AW - 1.6, b, 0.42, 0.42, 0, 3.9);
      bx(M.steel, AW - 2.7, b, 0.22, 2.2, 0.1, 0.16);
    }
    bx(M.liftBlue, AW - 1.6, -1.7, 3.8, 0.3, 0.3, 5.4);
    // ---- the back wall: shelves of parts, the couch, the TV, a fridge
    const BK = BB + 0.45;
    for (const yy of [0, 0.9, 1.8, 2.7]) bx(M.steelDark, -4.5, BK, yy, 4.2, 0.05, 0.8);
    for (const a of [-6.55, -2.45]) bx(M.steelDark, a, BK, 0, 0.06, 2.8, 0.8);
    const rng = makeRng('mygarage-parts');
    for (let k = 0; k < 16; k++) {
      const yy = [0.05, 0.95, 1.85, 2.75][k % 4], a = -6.2 + Math.floor(k / 4) * 1.05 + rng() * 0.3;
      bx(rng() < 0.5 ? M.boxes : M.redTool, a, BK, yy, 0.5 + rng() * 0.3, 0.3 + rng() * 0.4, 0.5);
    }
    solid(-4.5, BK, 4.2, 0.9, 0, 3);
    bx(M.couch, 2.5, BB + 0.6, 0, 2.4, 0.45, 0.9);
    bx(M.couch, 2.5, BB + 0.2, 0.45, 2.4, 0.5, 0.25);
    solid(2.5, BB + 0.5, 2.4, 1.0, 0, 1);
    bx(M.wood, 2.5, BB + 2.0, 0, 1.2, 0.4, 0.6);
    bx(M.steelDark, 5.2, BB + 0.5, 0, 0.9, 0.6, 0.6);
    bx(M.tvCase, 5.2, BB + 0.5, 0.6, 0.7, 0.55, 0.55);
    bx(M.tv, 5.2, BB + 0.79, 0.66, 0.56, 0.42, 0.02, { top: false });
    bx(M.fridge, 7.3, BB + 0.5, 0, 0.8, 1.8, 0.75);
    solid(6.2, BB + 0.5, 3, 1, 0, 1.8);
    { const p = at(5.2, BB + 1.2); this.lamps.push({ x: p[0], z: p[1], hx: p[0], hy: y + 0.9, hz: p[1], color: new THREE.Color('#6a8cff'), radius: 3.5, intensity: 0.6, halo: 0, inside: true }); }
    // ---- by the door: a compressor, drums, cones
    bx(M.redTool, -AW + 0.7, BF - 1.2, 0, 0.6, 0.7, 1.0);
    solid(-AW + 0.7, BF - 1.2, 0.6, 1, 0, 0.7);
    for (const [a, b] of [[AW - 0.7, BF - 0.9], [AW - 1.4, BF - 0.8], [AW - 0.8, BF - 1.7]]) {
      const p = at(a, b);
      cylinder(A(M.drum), p[0], y, p[1], 0.3, 0.9, 10, { top: true });
      this.colliders.push({ kind: 'circle', x: p[0], z: p[1], r: 0.3, y0: y, y1: y + 0.9 });
    }

    // ---- outside: the sign, two lamps by the door, upstairs windows
    {
      const p = at(0, BF + WT + 0.12);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), M.sign);
      sign.position.set(p[0], y + 6.7, p[1]);
      sign.rotation.y = ry;
      g.add(sign);
      bx(M.steelDark, 0, BF + WT + 0.06, 5.5, 9.4, 2.45, 0.1);
      for (const sd of [-1, 1]) {
        const q = at(sd * (DW + 0.9), BF + WT + 0.35);
        bx(M.steelDark, sd * (DW + 0.9), BF + WT + 0.15, 3.6, 0.2, 0.25, 0.4);
        bx(M.lampGlass, sd * (DW + 0.9), BF + WT + 0.35, 3.45, 0.3, 0.16, 0.3, { bottom: true });
        this.lamps.push({ x: q[0], z: q[1], hx: q[0], hy: y + 3.4, hz: q[1], color: new THREE.Color('#ffb060'), radius: 13, intensity: 1.1, halo: 2.2 });
      }
      for (const sd of [-1, 1]) {
        for (const yy of [1.4, 5.6]) {
          if (yy < 2 && Math.abs(sd) > 0) {
            // ground-floor windows: frosted glass blocks (light from inside at night)
            bx(M.glassBlock, sd * (DW + 3.3), BF + WT + 0.02, yy, 2.2, 1.6, 0.04, { top: false });
          } else {
            bx(M.window, sd * (DW + 3.3), BF + WT + 0.02, yy, 2.0, 1.8, 0.04, { top: false });
          }
        }
      }
    }

    // ---- the roll-up door (moves on its own)
    this.doorTexture = M.doorTex;
    const dg = new THREE.PlaneGeometry(DW * 2, DH);
    dg.translate(0, -DH / 2, 0);   // hangs from its top edge
    const door = new THREE.Mesh(dg, M.door);
    const dp = at(0, BF + WT * 0.5);
    door.position.set(dp[0], y + DH, dp[1]);
    door.rotation.y = ry;
    g.add(door);
    this.doorMesh = door;
    this.doorCollider = solid(0, BF + WT / 2, DW * 2, WT, 0, DH, 'door');

    // ---- meshes, then the light baked onto them
    const inside = [], outside = [];
    for (const [mat, a] of acc) {
      if (!a.idx.length) continue;
      const m = new THREE.Mesh(a.toGeometry(true), mat);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.receiveShadow = true;
      m.castShadow = !!mat.userData.castShadow;
      g.add(m);
      (mat.userData.inside ? inside : outside).push(m);
    }
    bake(inside, this.lamps.filter((l) => l.inside));
    const c = this.w(0, 0);
    const street = lampsInBox(this.ctx.net, c[0] - 60, c[1] - 60, c[0] + 60, c[1] + 60, []).slice();
    bake(outside, [...street, ...this.lamps.filter((l) => !l.inside)]);
    // a soft shadow under the car while it's in here
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.2), M.blob);
    const sp = at(0, 0);
    sh.position.set(sp[0], y + 0.015, sp[1]);
    sh.rotation.set(-Math.PI / 2, 0, ry);
    sh.renderOrder = 2;
    g.add(sh);
    this.blob = sh;
    this.setDoor(0);
    return g;
  }

  /** The street lamps of the garage (outside) for the world's lamp lists. */
  streetLamps() { return this.lamps.filter((l) => !l.inside); }

  setDoor(f) {
    this.door = Math.max(0, Math.min(1, f));
    const k = 1 - this.door;
    const d = this.doorMesh;
    if (!d) return;
    d.scale.y = Math.max(0.001, k);
    d.visible = k > 0.002;
    // keep the slats the right size as it rolls up into its drum
    const t = this.doorTexture;
    t.repeat.set(1, k);
    t.offset.set(0, 1 - k);
    this.doorCollider.on = this.door < 0.8;
  }

  /** Per frame: the door toward where it's going. */
  update(dt) {
    if (this.door !== this.doorTarget) {
      const sp = this.doorTarget > this.door ? 0.42 : 0.6;
      const f = this.door + Math.sign(this.doorTarget - this.door) * Math.min(Math.abs(this.doorTarget - this.door), sp * dt);
      this.setDoor(f);
    }
  }

  /** Camera in the showroom view: orbiting the car at yaw (0 = in front of it), height, distance. */
  showroomPose(yaw, out = {}) {
    const dist = out.dist ?? 5.8, hgt = out.height ?? 1.55;
    const a = Math.sin(yaw) * dist, b = Math.cos(yaw) * dist;
    // stay inside the walls
    const ac = Math.max(-AW + 0.7, Math.min(AW - 0.7, a)), bc = Math.max(BB + 0.8, Math.min(BF - 0.9, b));
    out.pos = this.v(ac, bc, hgt, out.pos || new THREE.Vector3());
    out.look = this.v(0, 0.2, 0.62, out.look || new THREE.Vector3());
    return out;
  }
}

function makeMats() {
  const M = {};
  const inside = (m) => { m.userData.inside = true; return m; };
  M.floor = inside(shopMat({ map: floorTex(), roughness: 0.45, metalness: 0.05, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }, 2.0));
  const wt = wallTex();
  M.wall = inside(shopMat({ map: wt, roughness: 0.9 }, 2.2));
  M.roofUnder = inside(shopMat({ color: 0x2c2f33, roughness: 0.8 }, 1.4));
  M.steel = inside(shopMat({ color: 0x8e959c, roughness: 0.45, metalness: 0.6 }, 1.6));
  M.steelDark = inside(shopMat({ color: 0x3c4046, roughness: 0.55, metalness: 0.4 }, 1.8));
  M.wood = inside(shopMat({ color: 0x7a5534, roughness: 0.8 }, 2.0));
  M.peg = inside(shopMat({ map: pegTex(), roughness: 0.85 }, 2.0));
  M.redTool = inside(shopMat({ color: 0xa8161c, roughness: 0.35, metalness: 0.3 }, 1.8));
  M.liftBlue = inside(shopMat({ color: 0x1d4f9a, roughness: 0.45, metalness: 0.3 }, 1.8));
  M.tyre = inside(shopMat({ color: 0x141414, roughness: 0.9 }, 1.6));
  M.boxes = inside(shopMat({ color: 0x9a7a4a, roughness: 0.9 }, 2.0));
  M.couch = inside(shopMat({ color: 0x5a2e24, roughness: 0.95 }, 2.0));
  M.tvCase = inside(shopMat({ color: 0x2a2620, roughness: 0.6 }, 1.6));
  M.fridge = inside(shopMat({ color: 0xd8d4c8, roughness: 0.4 }, 1.8));
  M.drum = inside(shopMat({ color: 0x2a5a8a, roughness: 0.5, metalness: 0.3 }, 1.8));
  M.fixture = inside(shopMat({ color: 0xd0d4d8, roughness: 0.5 }, 1.0));
  M.tube = new THREE.MeshBasicMaterial({ color: new THREE.Color('#eef4ff').multiplyScalar(3) });
  M.tv = new THREE.MeshBasicMaterial({ map: tvTex(), color: new THREE.Color(1.6, 1.6, 1.6) });
  // the outside takes the street's light at night
  M.brick = glowMat({ map: brickTex(), roughness: 0.92, envMapIntensity: 0.3 }, 2.6);
  M.brick.userData.castShadow = true;
  M.concrete = glowMat({ map: concreteTexture('#7d7a74', 'garage'), roughness: 0.9 }, 2.4);
  M.concrete.userData.castShadow = true;
  M.lampGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(3) });
  M.window = nightEmissive(new THREE.MeshStandardMaterial({ color: 0x1c2430, emissive: 0xffc078, roughness: 0.2, metalness: 0.4 }), 1.4);
  M.glassBlock = nightEmissive(new THREE.MeshStandardMaterial({ color: 0x8a9aa8, emissive: 0xdde8ff, roughness: 0.6 }), 0.9);
  const st = signTex();
  M.sign = nightEmissive(new THREE.MeshStandardMaterial({ map: st.map, emissive: 0xffffff, emissiveMap: st.emi, roughness: 0.6, transparent: false }), 3.2);
  M.doorTex = doorTex();
  M.door = new THREE.MeshStandardMaterial({ map: M.doorTex, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.7 });
  M.blob = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.85 });
  return M;
}

function blobTex() {
  const c = canvas(128, 256), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 128, 10, 64, 128, 120);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.save();
  x.scale(1, 1);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 256);
  x.restore();
  const t = toTex(c, { repeat: false, srgb: false });
  return t;
}

void U;
