// FRIDAY — small-town high school under the lights: a red running track around
// the field, aluminium bleachers (home side with the press box on top, a
// smaller visitors' side), six steel light poles, chain-link fence with
// booster-club banners, the classic bulb scoreboard with the school's name,
// a concession stand, the parking lot, trees, houses and the water tower.
import * as THREE from 'three';
import { RRPath, ringFlat } from '../bowl.js';
import { bleachers, chainFence, lightPole, house, trees, waterTower, V3, box, beam, pole, wall, spill } from '../kit.js';
import { cv, tex, label, speckle, noiseCanvas, FONT } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { blockText } from '../blockfont.js';
import { makeRng } from '../../../core/util.js';
import { GeoBuilder } from '../../geo.js';
import { logoCanvas } from '../../logos.js';

export const SUN_AZ = 2.3;
export const WIND_DIR = 0.9;
export const POOL = [52, 78];

export function paint(ctx) {
  const h = ctx.home;
  return {
    surface: 'grass', pattern: 'stripes', grass: ['#3e782c', '#4d8a36'], wear: 0.55, border: 'hs',
    endzone: { style: 'outline', fill: h.colors.primary, text: [h.name.toUpperCase(), h.name.toUpperCase()], color: h.colors.primary, outline: '#ffffff' },
    logo: logoCanvas(h, 1024, { flat: true }), logoSize: Math.min(ctx.field.W * 0.22, 9), marginSide: 12, marginEnd: 8,
  };
}

function schoolName(team) {
  if (team.school) return team.school.toUpperCase();
  return `${team.city} ${team.level === 'hs' ? 'HIGH' : ''}`.trim().toUpperCase();
}

function trackTex() {
  const [c, x] = cv(512, 512);
  const rng = makeRng('track');
  x.fillStyle = '#a8432e';
  x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, rng, 30000, ['#7a2a1a', '#c8634a', '#5a2014', '#d07050'], 0.1, 0.45, 1, 2);
  x.save();
  x.globalCompositeOperation = 'soft-light';
  x.globalAlpha = 0.5;
  x.drawImage(noiseCanvas(256, 41, 8, 3, 1), 0, 0, 512, 512);
  x.restore();
  // six lanes: lane lines along u at v = k/6 (v = 0 inner edge)
  x.fillStyle = 'rgba(240,240,232,0.92)';
  for (let k = 0; k <= 6; k++) {
    const y = 512 - (k / 6) * 512;
    x.fillRect(0, Math.min(509, Math.max(0, y - 3)), 512, 5);
  }
  return tex(c);
}

/** All the fence banners on one atlas (one draw call): 8 slots of 512 × 128. */
function bannerAtlas(defs) {
  const [c, x] = cv(1024, 512);
  defs.forEach(([lines, bg, fg], k) => {
    const ox = (k % 2) * 512, oy = Math.floor(k / 2) * 128;
    x.save();
    x.translate(ox, oy);
    x.fillStyle = bg;
    x.fillRect(0, 0, 512, 128);
    x.strokeStyle = fg;
    x.lineWidth = 5;
    x.strokeRect(8, 8, 496, 112);
    label(x, lines[0], 256, lines[1] ? 50 : 66, lines[1] ? 52 : 66, fg, { max: 470, f: FONT });
    if (lines[1]) label(x, lines[1], 256, 98, 26, fg, { max: 470, w: 700 });
    x.fillStyle = '#c8c8c0';
    for (const gx of [16, 496]) for (const gy of [16, 112]) { x.beginPath(); x.arc(gx, gy, 5, 0, 7); x.fill(); }
    x.restore();
  });
  return tex(c, { repeat: false, aniso: 8 });
}

export async function build(ctx) {
  const { B, rig, field, home, away, root } = ctx;
  const rng = makeRng('friday');
  const hw = field.halfW, hl = field.halfL;
  const seats = [];
  const disposables = [];

  // ---- running track: a stadium-shaped ring around the field
  const a = hw + 7;                         // inner edge on the straights
  const S = hl;                             // half-length of the straights
  const path = new RRPath(a, S + a, a);
  const ss = path.samples(0, path.P, 8, 0.08);
  const tg = new GeoBuilder();
  ringFlat(tg, path, ss, 0, 8, 0, { uScale: 8 });
  const trackMat = spill(new THREE.MeshStandardMaterial({ map: trackTex(), roughness: ctx.wet ? 0.35 : 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: ctx.wet ? 1.2 : 0.4 }), ctx, 0.3);
  const track = new THREE.Mesh(tg.build(), trackMat);
  track.receiveShadow = true;
  track.name = 'track';
  root.add(track);
  // concrete curb on the inside of the track
  const curb = B.get('concrete');
  curb.setColor(0.85, 0.85, 0.82);
  ringFlat(curb, path, ss, -0.25, 0, 0.06);

  // ---- fences: the low fence between track and stands, the tall property fence
  const fpts = [];
  for (const s of path.samples(0, path.P, 6, 0.1)) { const p = path.at(s, 9.5); fpts.push([p.x, p.z]); }
  fpts.push(fpts[0]);
  // gaps at the bleacher fronts are covered by the bleachers themselves
  chainFence(B, fpts, 1.35, {});
  const outer = new RRPath(80, 125, 40);
  const opts2 = [];
  for (const s of outer.samples(0, outer.P, 8, 0.1)) { const p = outer.at(s, 0); opts2.push([p.x, p.z]); }
  opts2.push(opts2[0]);
  chainFence(B, opts2, 2.3, {});

  // ---- banners on the track fence
  const bannerDefs = [
    [[`GO ${home.name.toUpperCase()}!`], home.colors.primary, '#ffffff'],
    [['MILLER HARDWARE', 'SINCE 1952'], '#f4f2ea', '#1a3a7a'],
    [['FIRST STATE BANK', 'PROUD SUPPORTER'], '#0b2a5a', '#f2d48a'],
    [['BOLT COLA'], '#e8241c', '#ffffff'],
    [['DAIRY BARN', 'BURGERS · SHAKES'], '#ffd22a', '#7a1010'],
    [['ACE AUTO BODY'], '#1a1a1c', '#ff7a12'],
    [[`BEAT THE ${away.name.toUpperCase()}`], home.colors.secondary, home.colors.dark || '#000'],
    [['ORTIZ FAMILY DENTAL'], '#ffffff', '#2a7a4a'],
  ];
  const bAtlas = bannerAtlas(bannerDefs);
  disposables.push(bAtlas);
  const bg = new GeoBuilder();
  let bi = 0;
  for (const sx of [-1, 1]) {
    for (let z = -hl + 6; z <= hl - 6; z += 13) {
      if (sx < 0 && Math.abs(z) < 34) continue; // home bleachers sit there
      if (sx > 0 && Math.abs(z) < 22) continue;
      const k = bi++ % 8;
      const u0 = (k % 2) * 0.5, v1 = 1 - Math.floor(k / 2) * 0.25, v0 = v1 - 0.25;
      const fx = sx * (a + 9.5) - sx * 0.04;
      // facing the field: CCW seen from the field side
      const zA = z + sx * 2.1, zB = z - sx * 2.1;
      bg.quad(V3(fx, 0.2, zA), V3(fx, 0.2, zB), V3(fx, 1.25, zB), V3(fx, 1.25, zA), [u0, v0, u0 + 0.5, v1]);
    }
  }
  const banners = new THREE.Mesh(bg.build(), spill(new THREE.MeshStandardMaterial({ map: bAtlas, roughness: 0.8, side: THREE.DoubleSide }), ctx, 0.6));
  banners.name = 'banners';
  root.add(banners);

  // ---- bleachers: home (−x) with press box, visitors (+x)
  const homeLen = Math.min(70, 2 * hl - 6), homeRows = 15;
  const hb = bleachers(B, -(a + 10.5), 0, Math.PI / 2, homeLen, homeRows, { base: 1.1, rng });
  for (const s of hb.seats) {
    const z = s.p.z;
    const group = Math.abs(z + 4) < 7 && s.row > 3 ? 'student' : (z > homeLen / 2 - 9 && s.row > 7 ? 'band' : 'home');
    seats.push({ ...s, group, want: 1 - Math.abs(z) / (homeLen / 2) * 0.6 - s.row / homeRows * 0.2, light: 0.85 - s.row * 0.015, sec: Math.floor((z + 100) / 8) });
  }
  const awayLen = Math.min(46, 2 * hl - 20), awayRows = 9;
  const ab = bleachers(B, a + 10.5, 0, -Math.PI / 2, awayLen, awayRows, { base: 0.9, rng });
  for (const s of ab.seats) seats.push({ ...s, group: 'away', want: 0.75 - Math.abs(s.p.z) / awayLen * 0.5, light: 0.85, sec: 0 });

  // press box on stilts above the home bleachers
  const pbx = -(a + 10.5) - hb.back - 1.2, pby = 1.1 + hb.top + 0.6;
  const paintB = B.get('paint');
  const metal = B.get('metal');
  metal.setColor(0.45, 0.46, 0.48);
  for (const zz of [-8, -3, 3, 8]) for (const xx of [pbx - 1.6, pbx + 1.6]) beam(metal, V3(xx, 0, zz), V3(xx, pby, zz), 0.25);
  paintB.setColor(0.86, 0.84, 0.78);
  box(paintB, pbx, pby, 0, 4.2, 3.4, 18.5, 0, { top: false });
  paintB.setColor(...new THREE.Color(home.colors.primary).toArray());
  box(paintB, pbx, pby + 3.4, 0, 4.8, 0.5, 19.2, 0, {});
  // lit window band facing the field + the sign under it
  const glow = B.get('glow');
  glow.setColor(1.9, 1.5, 0.95);
  wall(glow, pbx + 2.12, 8.8, pbx + 2.12, -8.8, pby + 1.4, pby + 2.9);
  const [sc, sx2] = cv(1024, 128);
  sx2.fillStyle = home.colors.primary;
  sx2.fillRect(0, 0, 1024, 128);
  blockText(sx2, ctx.def.name.toUpperCase(), 512, 100, 76, { align: 'center', color: '#ffffff', weight: 1.1 });
  const signT = tex(sc, { repeat: false, aniso: 8 });
  disposables.push(signT);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 2.1), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.7, emissive: 0xffffff, emissiveMap: signT, emissiveIntensity: ctx.night ? 0.35 : 0 }));
  sign.position.set(pbx + 2.14, pby + 0.75, 0);
  sign.rotation.y = Math.PI / 2;
  root.add(sign);
  // stairs up the side of the home bleachers
  metal.setColor(0.6, 0.62, 0.64);
  for (const zz of [-homeLen / 2 - 0.6, homeLen / 2 + 0.6]) beam(metal, V3(-(a + 10.5), 0.2, zz), V3(-(a + 10.5) - hb.back, hb.top + 1.1, zz), 0.9, 0.12);

  // ---- light poles: four at the corners, two tall ones behind the bleachers
  const polesAt = [
    [-(a + 4), -(hl + 15), 24], [a + 4, -(hl + 15), 24], [-(a + 4), hl + 15, 24], [a + 4, hl + 15, 24],
    [-(a + 10.5) - hb.back - 6, 0, 30], [a + 10.5 + ab.back + 5, 0, 26],
  ];
  for (const [px, pz, ph] of polesAt) {
    const aim = [px * 0.25, 0, pz * 0.35];
    const spec = lightPole(B, px, pz, ph, aim, { kind: 'steel', cols: 5, rows: 3, lamp: 0.85, tilt: 0.5 });
    rig.bank({ ...spec, warm: false, glare: 1.1 });
  }

  // ---- scoreboard behind the +z end
  const board = createScoreboard('hs', { home, away, title: schoolName(home), sub: `HOME OF THE ${home.name.toUpperCase()}`, intensity: ctx.night ? 1.7 : 1.25 });
  const bz = path.az + 14;
  const bw = 14, bh = 7, by = 5.5;
  metal.setColor(0.32, 0.34, 0.36);
  for (const sx of [-4.5, 4.5]) beam(metal, V3(sx, 0, bz + 0.6), V3(sx, by + bh * 0.7, bz + 0.6), 0.45);
  paintB.setColor(0.1, 0.12, 0.11);
  box(paintB, 0, by - 0.3, bz + 0.45, bw + 0.8, bh + 0.6, 0.6, 0, {});
  const face = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), board.material);
  face.position.set(0, by + bh / 2, bz + 0.1);
  face.rotation.y = Math.PI;
  root.add(face);
  // sponsor panel under it
  const [pc, px] = cv(1024, 160);
  px.fillStyle = '#e8241c';
  px.fillRect(0, 0, 1024, 160);
  label(px, 'BOLT COLA', 300, 82, 92, '#ffffff', { italic: true });
  label(px, 'DAIRY BARN', 770, 82, 70, '#ffd22a', { italic: true });
  const panT = tex(pc, { repeat: false, aniso: 8 });
  disposables.push(panT);
  const pan = new THREE.Mesh(new THREE.PlaneGeometry(bw, 1.6), new THREE.MeshStandardMaterial({ map: panT, roughness: 0.6, emissive: 0xffffff, emissiveMap: panT, emissiveIntensity: ctx.night ? 0.45 : 0 }));
  pan.position.set(0, by - 1.1, bz + 0.1);
  pan.rotation.y = Math.PI;
  root.add(pan);
  ctx.lightsList.push({ pos: V3(-6, by + bh + 0.6, bz - 0.5), color: [1, 0.9, 0.7], size: 1.2, k: 0.8 }, { pos: V3(6, by + bh + 0.6, bz - 0.5), color: [1, 0.9, 0.7], size: 1.2, k: 0.8 });

  // ---- concession stand behind the home bleachers' south end
  const cxs = -(a + 14), czs = -(homeLen / 2 + 11);
  paintB.setColor(0.72, 0.36, 0.26);
  box(paintB, cxs, 0, czs, 9, 3.2, 6, 0, { top: false });
  paintB.setColor(0.25, 0.26, 0.28);
  box(paintB, cxs, 3.2, czs, 10, 0.35, 7.2, 0, {});
  glow.setColor(2.4, 1.9, 1.1);
  wall(glow, cxs - 3.2, czs + 3.02, cxs + 3.2, czs + 3.02, 1.1, 2.4);
  const [mc, mx] = cv(512, 128);
  mx.fillStyle = '#f6efe0';
  mx.fillRect(0, 0, 512, 128);
  label(mx, 'CONCESSIONS', 256, 48, 52, '#7a1010');
  label(mx, 'HOT DOGS · NACHOS · COCOA · POPCORN', 256, 100, 24, '#222', { w: 700, max: 480 });
  const menuT = tex(mc, { repeat: false });
  disposables.push(menuT);
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.6), new THREE.MeshStandardMaterial({ map: menuT, emissive: 0xffffff, emissiveMap: menuT, emissiveIntensity: ctx.night ? 0.6 : 0, roughness: 0.8 }));
  menu.position.set(cxs, 3.25, czs + 3.62);
  root.add(menu);
  ctx.lightsList.push({ pos: V3(cxs, 3.0, czs + 3.6), color: [1, 0.85, 0.6], size: 2.2, k: 0.9 });
  // people at the window
  for (let i = 0; i < 6; i++) seats.push({ p: V3(cxs - 3 + i * 1.1 + (rng() - 0.5) * 0.4, 0, czs + 4.6 + rng() * 1.6), group: 'home', want: 0.8, light: 0.7, sec: 0 });

  // ---- parking lot behind the visitors' side, cars + lot lamps
  const lot = B.get('ground');
  lot.setColor(0.16, 0.16, 0.17);
  const lx0 = a + 26, lx1 = a + 62;
  lot.quad(V3(lx0, 0.02, 60), V3(lx1, 0.02, 60), V3(lx1, 0.02, -60), V3(lx0, 0.02, -60));
  const carCols = [[0.6, 0.06, 0.06], [0.1, 0.12, 0.2], [0.8, 0.8, 0.78], [0.15, 0.15, 0.16], [0.35, 0.4, 0.45], [0.1, 0.25, 0.15], [0.55, 0.45, 0.3]];
  const carB = B.get('metal');
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 22; k++) {
      if (rng() < 0.25) continue;
      const cxp = lx0 + 5 + row * 11, czp = -54 + k * 5 + (rng() - 0.5);
      const cc = carCols[(rng() * carCols.length) | 0];
      carB.setColor(...cc);
      const truck = rng() < 0.3;
      box(carB, cxp, 0.25, czp, 4.6, truck ? 1.1 : 0.85, 1.9, Math.PI / 2 + (rng() - 0.5) * 0.08, {});
      box(carB, cxp + (truck ? -0.8 : 0.2), truck ? 1.35 : 1.1, czp, truck ? 1.8 : 2.4, 0.65, 1.7, Math.PI / 2, {});
    }
  }
  for (const zz of [-40, 0, 40]) {
    metal.setColor(0.35, 0.36, 0.38);
    pole(metal, V3(lx0 + 16, 0, zz), V3(lx0 + 16, 9, zz), 0.12, 6);
    ctx.lightsList.push({ pos: V3(lx0 + 16, 9, zz), color: [1, 0.6, 0.25], size: 3, k: 1.1 });
  }

  // ---- trees, houses, water tower
  const treeList = [];
  for (let i = 0; i < (ctx.quality === 'low' ? 70 : 150); i++) {
    const ang = rng() * Math.PI * 2;
    const r = 1 + rng() * 0.5;
    const tx = Math.cos(ang) * 95 * r, tz = Math.sin(ang) * 140 * r;
    if (tx > lx0 - 5 && tx < lx1 + 5 && Math.abs(tz) < 65) continue;
    treeList.push({ x: tx, z: tz, h: 9 + rng() * 9, kind: rng() < 0.3 ? 'pine' : 'oak', tint: rng() < 0.5 ? '#2c4424' : '#38502a' });
  }
  root.add(trees(treeList, ctx));
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const hz = side * (165 + rng() * 15);
    const hx = -110 + (i >> 1) * 28 + (rng() - 0.5) * 6;
    house(B, ctx, rng, hx, hz, side > 0 ? Math.PI : 0, 9 + rng() * 3, 8 + rng() * 2, 3 + (rng() < 0.3 ? 2.6 : 0));
  }
  for (let i = 0; i < 8; i++) house(B, ctx, rng, 130 + rng() * 20, -100 + i * 26, -Math.PI / 2, 9, 9, 3);
  root.add(waterTower(B, ctx, -95, 235, 34, home.city, ['#c9ced4', home.colors.primary]));

  // ---- ground beyond: dark grass/asphalt handled by the apron; a road
  const road = B.get('ground');
  road.setColor(0.13, 0.13, 0.14);
  road.quad(V3(-260, 0.03, 152), V3(260, 0.03, 152), V3(260, 0.03, 142), V3(-260, 0.03, 142));
  ctx.lightsList.push(...[-120, -60, 0, 60, 120].map((x) => ({ pos: V3(x, 7, 147), color: [1, 0.62, 0.28], size: 2.6, k: 1 })));

  return {
    seats,
    boards: [board],
    disposables,
    sideline: { benchOff: 5.2, cheer: true, photographers: 4, coaches: 3, players: 12, chainSide: 1, vest: '#ff7a12' },
    post: ctx.night ? { saturation: 1.12, exposure: 1.05 } : {},
  };
}
