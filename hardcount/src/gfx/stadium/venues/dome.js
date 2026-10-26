// DOME — an indoor pro dome: a closed three-level bowl (lower, club, upper)
// with two rings of suites, LED ribbons on every fascia, the dome roof on its
// steel ribs and rings (translucent fabric that glows in the day), rings of
// light banks hung from the trusses for that even TV light, a centre-hung
// four-sided jumbotron, end boards on the rim, championship banners, turf.
import * as THREE from 'three';
import { RRPath, ringWall, ringFlat, buildTier } from '../bowl.js';
import { V3, box, beam, spill } from '../kit.js';
import { cv, tex, BRANDS, label } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { logoCanvas } from '../../logos.js';
import { makeRng } from '../../../core/util.js';
import { GeoBuilder } from '../../geo.js';
import { wantFn, angleAt, adWallMat, ribbonMat, suiteMat } from './common.js';

export const SUN_AZ = 0.4;
export const POOL = [1000, 1000];

export function paint(ctx) {
  const h = ctx.home;
  return {
    surface: 'turf', pattern: 'wide', grass: ['#2c7434', '#33823c'], wear: 0.12, border: 'pro',
    endzone: { style: 'solid', fill: h.colors.primary, text: [h.name.toUpperCase(), h.city.toUpperCase()], color: h.colors.secondary, outline: '#ffffff' },
    logo: logoCanvas(h, 1024, { flat: true }), logoSize: Math.min(ctx.field.W * 0.3, 14),
    marginSide: 12, marginEnd: 8,
  };
}

function roofTex(ctx) {
  const [c, x] = cv(1024, 512);
  const rng = makeRng('roof');
  x.fillStyle = '#c9cbcc';
  x.fillRect(0, 0, 1024, 512);
  // fabric panels between the ribs (u: 32 around), rings every 64 px
  for (let k = 0; k < 32; k++) {
    for (let r = 0; r < 8; r++) {
      const v = 0.9 + rng() * 0.12;
      x.fillStyle = `rgba(${200 * v | 0},${203 * v | 0},${206 * v | 0},1)`;
      x.fillRect(k * 32 + 2, r * 64 + 2, 28, 60);
      const g = x.createLinearGradient(k * 32, 0, k * 32 + 32, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.12)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      x.fillStyle = g;
      x.fillRect(k * 32 + 2, r * 64 + 2, 28, 60);
    }
  }
  x.fillStyle = '#4a4e54';
  for (let k = 0; k <= 32; k++) x.fillRect(k * 32 - 2, 0, 4, 512);
  for (let r = 0; r <= 8; r++) x.fillRect(0, r * 64 - 2, 1024, 4);
  const t = tex(c, { aniso: 8 });
  const day = ctx.time === 'day';
  return spill(new THREE.MeshStandardMaterial({
    map: t, side: THREE.BackSide, roughness: 0.85, emissive: 0xffffff, emissiveMap: t,
    emissiveIntensity: day ? 0.85 : ctx.time === 'dusk' ? 0.25 : 0.04, envMapIntensity: 0.3,
  }), ctx, 0.25);
}

function bannerAtlas(home) {
  const [c, x] = cv(1024, 512);
  const years = ['1998', '2001', '2003', '2004', 'DIVISION', 'CONFERENCE', '2002', 'RETIRED'];
  for (let k = 0; k < 8; k++) {
    const ox = k * 128;
    x.fillStyle = k % 2 ? home.colors.primary : (home.colors.dark || '#111');
    x.fillRect(ox, 0, 128, 512);
    x.fillStyle = home.colors.secondary;
    x.fillRect(ox + 8, 8, 112, 6);
    x.fillRect(ox + 8, 498, 112, 6);
    x.drawImage(logoCanvas(home, 128), ox + 14, 40, 100, 100);
    label(x, years[k], ox + 64, 220, k > 3 && k < 6 ? 20 : 34, '#ffffff', { max: 116 });
    label(x, k === 7 ? '#7' : 'CHAMPIONS', ox + 64, 290, k === 7 ? 60 : 18, home.colors.secondary === '#ffffff' ? '#ffd23a' : home.colors.secondary, { max: 116 });
    // pennant cut at the bottom
    x.fillStyle = '#000';
    x.beginPath(); x.moveTo(ox, 512); x.lineTo(ox + 64, 440); x.lineTo(ox + 128, 512); x.closePath();
    x.globalCompositeOperation = 'destination-out'; x.fill(); x.globalCompositeOperation = 'source-over';
  }
  return tex(c, { repeat: false, aniso: 8 });
}

export async function build(ctx) {
  const { B, rig, field, home, root } = ctx;
  const hw = field.halfW, E = field.end;
  const disposables = [];
  const path = new RRPath(hw + 13, E + 11, 26);
  const P = path.P;
  B.get('adwall', () => adWallMat(ctx, 'adwall8', BRANDS.slice(0, 8)));
  B.get('suites', () => suiteMat(ctx, 'suites-dome'));
  const rib = ribbonMat(ctx, [`${home.city.toUpperCase()} ${home.name.toUpperCase()}`, 'NOVATRON', 'DEFENSE!', 'RAZOR FUEL', `${home.abbr} ${home.abbr} ${home.abbr}`, 'HALCYON BANK', 'GET LOUD!', 'IRONSIDE AUTO']);
  B.get('ribbon', () => rib.mat);
  const seatCol = (lvl) => (s, r) => {
    const a = angleAt(path, s);
    if (lvl === 1) return home.colors.secondary;
    // alternate sections, a stripe of the second colour near the top
    if (r > (lvl === 0 ? 22 : 20)) return '#7a7c80';
    return Math.floor(a / 18) % 2 ? home.colors.primary : '#5a1018';
  };
  const lower = buildTier(B, path, {
    s0: 0, s1: P, d0: 0, rows: 28, depth: 0.95, h0: 1.9, rise: 0.42, riseGrow: 0.003,
    tint: [0.62, 0.62, 0.64], seats: 'seats', seatColor: seatCol(0),
    aisleEvery: 24, aisleW: 1.1, vom: { every: 24, offset: 8, row: 10, rows: 4, w: 2.6 },
    group: () => 'home', want: wantFn(path, field, 28), light: (r) => (r > 21 ? 0.8 : 1),
    front: { y0: 0, rail: 0.3, key: 'adwall', vFit: true, uScale: 68 },
    back: { h: 2.6 }, exterior: false,
  });
  const mD0 = lower.dEnd - 4, mH0 = lower.top + 8.2;
  const mid = buildTier(B, path, {
    s0: 0, s1: P, d0: mD0, rows: 13, depth: 1.05, h0: mH0, rise: 0.55,
    tint: [0.6, 0.6, 0.62], seats: 'seats', seatColor: seatCol(1),
    aisleEvery: 20, aisleW: 1.1, group: () => 'home', want: wantFn(path, field, 13), light: () => 0.85,
    back: { h: 2.4 }, exterior: false,
  });
  const uD0 = mid.dEnd - 5, uH0 = mid.top + 9;
  const groupUp = (s, r) => { const a = angleAt(path, s); return a > 300 && a < 335 && r > 2 ? 'away' : 'home'; };
  const upper = buildTier(B, path, {
    s0: 0, s1: P, d0: uD0, rows: 24, depth: 1.0, h0: uH0, rise: 0.66,
    tint: [0.6, 0.6, 0.62], seats: 'seats', seatColor: seatCol(2),
    aisleEvery: 24, aisleW: 1.1, vom: { every: 30, offset: 12, row: 5, rows: 3, w: 2.4 },
    group: groupUp, want: wantFn(path, field, 24), light: () => 0.9,
    back: { h: 3 }, exterior: true, exteriorTint: [0.85, 0.86, 0.88],
  });
  // suite rings, soffits and ribbon fascias between the levels
  const ss = path.samples(0, P, 6);
  const conc = B.get('concrete');
  const fas = B.get('paint');
  const level = (below, d0, h0) => {
    const soffit = h0 - 3.6;
    ringWall(B.get('suites'), path, ss, below.dEnd + 0.4, below.top + 2.6, soffit, { uScale: 8, vFit: true });
    conc.setColor(0.55, 0.55, 0.57);
    ringFlat(conc, path, ss, d0, below.dEnd + 0.4, soffit, { down: true });
    fas.setColor(0.1, 0.1, 0.12);
    ringWall(fas, path, ss, d0 - 0.02, soffit, h0 + 0.35);
    ringWall(B.get('ribbon'), path, ss, d0 - 0.1, soffit + 0.9, soffit + 2.6, { uScale: 54, vFit: true });
  };
  level(lower, mD0, mH0);
  level(mid, uD0, uH0);

  // ---- the dome: fabric on ribs, compression ring at the crown
  const AX = path.ax + upper.dEnd + 1, AZ = path.az + upper.dEnd + 1;
  const base = upper.backTop + 1, H = 30;
  const dg = new THREE.SphereGeometry(1, 64, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  dg.scale(AX, H, AZ);
  dg.translate(0, base, 0);
  const domeMesh = new THREE.Mesh(dg, roofTex(ctx));
  domeMesh.name = 'dome';
  root.add(domeMesh);
  // ring wall between the upper deck's top and the dome's spring line
  conc.setColor(0.7, 0.71, 0.73);
  ringWall(conc, path, ss, upper.dEnd + 0.6, upper.backTop, base + 0.2);
  const surf = (th, ph, inset = 0) => {
    const k = 1 - inset / Math.min(AX, AZ);
    return V3(Math.cos(ph) * Math.cos(th) * AX * k, base + Math.sin(ph) * H * k - inset * 0.3, Math.cos(ph) * Math.sin(th) * AZ * k);
  };
  const steel = B.get('metal');
  steel.setColor(0.42, 0.44, 0.47);
  const NR = 24, NS = 9;
  for (let i = 0; i < NR; i++) {
    const th = (i / NR) * Math.PI * 2;
    for (let j = 0; j < NS; j++) {
      const p0 = j / NS * 1.45, p1 = (j + 1) / NS * 1.45;
      const a = surf(th, p0, 1.2), b = surf(th, p1, 1.2);
      const c = surf(th, p0, 4.2), d = surf(th, p1, 4.2);
      beam(steel, a, b, 0.6);
      beam(steel, c, d, 0.45);
      beam(steel, a, d, 0.25);
      if (j % 2 === 0) beam(steel, a, c, 0.25);
    }
  }
  for (const ph of [0.35, 0.75, 1.1, 1.45]) {
    for (let i = 0; i < 48; i++) {
      const a = surf((i / 48) * Math.PI * 2, ph, 1.6), b = surf(((i + 1) / 48) * Math.PI * 2, ph, 1.6);
      beam(steel, a, b, ph > 1.4 ? 0.9 : 0.4);
    }
  }
  // ---- light banks hung from the trusses: two rings aimed at the field
  for (const [ph, n, cols] of [[0.55, 16, 7], [0.95, 10, 6]]) {
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + 0.1;
      const c = surf(th, ph, 6);
      const yaw = Math.atan2(-c.x, -c.z);
      rig.bank({ center: c, yaw, tilt: ph > 0.8 ? 1.15 : 0.95, cols, rows: 3, lamp: 0.9, w: cols * 0.9, h: 2.7, aim: V3(c.x * 0.12, 0, c.z * 0.25), glare: 0.8 });
      steel.setColor(0.25, 0.26, 0.28);
      box(steel, c.x, c.y + 1.5, c.z, cols * 0.9 + 1, 0.4, 1.6, yaw, {});
    }
  }

  // ---- centre-hung jumbotron (4 faces), end boards on the rim
  const board = createScoreboard('video', { home, away: ctx.away, intensity: 1.5 });
  const jw = Math.min(26, hw * 1.2), jh = jw * 0.4, jd = jw * 0.62, jy = Math.min(base + H * 0.45, 46);
  const frame = B.get('paint');
  frame.setColor(0.08, 0.08, 0.1);
  box(frame, 0, jy - 1.3, 0, jw, jh + 3.8, jd, 0, {});
  // four faces (long ones look down the field), each a full copy of the board
  const jg = new GeoBuilder();
  const y0 = jy, y1 = jy + jh, fx = jw / 2 + 0.03, fz = jd / 2 + 0.03, lw = jw / 2 - 0.3, sw = jd / 2 - 0.3;
  jg.quad(V3(-lw, y0, fz), V3(lw, y0, fz), V3(lw, y1, fz), V3(-lw, y1, fz));
  jg.quad(V3(lw, y0, -fz), V3(-lw, y0, -fz), V3(-lw, y1, -fz), V3(lw, y1, -fz));
  jg.quad(V3(fx, y0, sw), V3(fx, y0, -sw), V3(fx, y1, -sw), V3(fx, y1, sw));
  jg.quad(V3(-fx, y0, -sw), V3(-fx, y0, sw), V3(-fx, y1, sw), V3(-fx, y1, -sw));
  const jumbo = new THREE.Mesh(jg.build(), board.material);
  jumbo.name = 'jumbotron';
  root.add(jumbo);
  ringWallBox(B.get('ribbon'), 0, jy - 1.15, 0, jw + 0.06, jd + 0.06, 0.95);
  steel.setColor(0.3, 0.3, 0.32);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(steel, V3(sx * jw * 0.4, jy + jh + 2.5, sz * jd * 0.4), V3(sx * jw * 0.9, base + H - 2, sz * jd * 1.2), 0.08);
  // end boards on the rim above each end
  const ew = Math.min(36, hw * 1.7), eh = ew * 0.36;
  for (const sz of [-1, 1]) {
    const z = sz * (path.az + upper.dEnd - 4);
    frame.setColor(0.08, 0.08, 0.1);
    box(frame, 0, upper.backTop - eh * 0.6, z + sz * 0.6, ew + 1.4, eh + 1.4, 1.0, 0, {});
    const f = new THREE.Mesh(new THREE.PlaneGeometry(ew, eh), board.material);
    f.position.set(0, upper.backTop - eh * 0.6 + 0.7 + eh / 2, z - sz * 0.02);
    f.rotation.y = sz > 0 ? Math.PI : 0;
    root.add(f);
  }

  // ---- championship banners hung under the rim along the ends
  const bt = bannerAtlas(home);
  disposables.push(bt);
  const bgb = new GeoBuilder();
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const x0 = -ew / 2 - 22 + k * 6.2 + (k > 3 ? ew + 10 : 0);
      if (Math.abs(x0) > path.ax + upper.dEnd - 20) continue;
      const z = sz * (path.az + upper.dEnd - 6);
      const y1b = base - 0.5, y0b = y1b - 9;
      const u0 = k / 8, u1 = (k + 1) / 8;
      if (sz > 0) bgb.quad(V3(x0 + 4.2, y0b, z), V3(x0, y0b, z), V3(x0, y1b, z), V3(x0 + 4.2, y1b, z), [u0, 0, u1, 1]);
      else bgb.quad(V3(x0, y0b, z), V3(x0 + 4.2, y0b, z), V3(x0 + 4.2, y1b, z), V3(x0, y1b, z), [u0, 0, u1, 1]);
    }
  }
  const banners = new THREE.Mesh(bgb.build(), spill(new THREE.MeshStandardMaterial({ map: bt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }), ctx, 0.6));
  banners.name = 'banners';
  root.add(banners);

  return {
    seats: [...lower.seats, ...mid.seats, ...upper.seats],
    boards: [board],
    disposables,
    sideline: { benchOff: 8.5, cheer: 'big', photographers: 10, coaches: 4, players: 16, chainSide: 1, vest: '#f2f2ee' },
    cams: {
      scoreboard: { pos: V3(0, 6, -E + 2), target: V3(0, jy + jh * 0.5, 0) },
      crowd: { pos: V3(hw + 4, 4, -10), target: V3(hw + 26, 16, 6) },
    },
    post: { exposure: 1.0 },
    update(dt, st, t) { rib.scroll(t); },
  };
}

/** LED ribbon wrapped round a box (the jumbotron's bottom edge). */
function ringWallBox(gb, x, y, z, w, d, h) {
  const c = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2], [-w / 2, d / 2]];
  let u = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = c[i], [bx, bz] = c[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    // outward facing: CCW seen from outside
    gb.quad(V3(x + bx, y, z + bz), V3(x + ax, y, z + az), V3(x + ax, y + h, z + az), V3(x + bx, y + h, z + bz), [(u + len) / 54, 0, u / 54, 1]);
    u += len;
  }
}
