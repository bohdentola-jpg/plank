// Quahog, Rhode Island — laid out street by street on the road network in
// roads.js. Spooner Street is a dead end with the right houses in the right
// order, the Clam is on its corner downtown, and Al Harrington's has the
// inflatable tube men out front, because of course it does.
import * as THREE from 'three';
import { toon, flat, mkCanvas, tex, shade, INK } from './toon.js';
import * as B from './buildings.js';
import {
  ROADS, HALF, SHORE_X, roadPoint, plot, nearestRoad, onRoad, roadClearance, roadGraph,
} from './roads.js';

export { HALF, SHORE_X };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ ground
const GROUND_PX = 2048;
const S = GROUND_PX / (HALF * 2);
const px = (v) => (v + HALF) * S;

function strokeRoad(ctx, road, width, style, dash = null) {
  const pts = road.loop ? [...road.pts, road.pts[0]] : road.pts;
  ctx.strokeStyle = style;
  ctx.lineWidth = width * S;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash.map((d) => d * S));
  else ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(px(pts[0][0]), px(pts[0][1]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(px(pts[i][0]), px(pts[i][1]));
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintGround(extra) {
  const cv = mkCanvas(GROUND_PX, GROUND_PX);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#63ac48';
  ctx.fillRect(0, 0, GROUND_PX, GROUND_PX);
  for (let i = 0; i < 24000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#5aa040' : '#6fb852';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(Math.random() * GROUND_PX, Math.random() * GROUND_PX, 3, 3);
  }
  ctx.globalAlpha = 1;

  const rect = (x, z, w, d, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(px(x - w / 2), px(z - d / 2), w * S, d * S);
  };
  const blob = (x, z, rx, rz, fill, rot = 0) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(px(x), px(z), rx * S, rz * S, rot, 0, Math.PI * 2);
    ctx.fill();
  };

  // ---- district ground
  blob(196, -206, 74, 58, '#8f9aa4');            // the docks
  blob(56, -196, 66, 54, '#6cb84f');             // the park
  rect(-52, 196, 120, 96, '#9a9a92');            // mill / industrial
  rect(120, 210, 130, 74, '#a8a8a0');            // airport apron
  blob(206, 190, 56, 48, '#8a8478');             // salvage yard
  blob(238, 40, 44, 84, '#e8dfae');              // beach

  // water east of the shoreline
  ctx.fillStyle = '#2f7fb8';
  ctx.beginPath();
  ctx.moveTo(px(SHORE_X - 6), 0);
  ctx.lineTo(GROUND_PX, 0);
  ctx.lineTo(GROUND_PX, GROUND_PX);
  ctx.lineTo(px(SHORE_X - 26), GROUND_PX);
  ctx.quadraticCurveTo(px(SHORE_X + 10), px(0), px(SHORE_X - 6), 0);
  ctx.closePath();
  ctx.fill();
  blob(72, -178, 24, 16, '#3f95cf', 0.2);        // the park pond

  // ---- the roads themselves
  for (const road of ROADS) strokeRoad(ctx, road, road.w + 9, '#cfcabb');
  for (const road of ROADS) strokeRoad(ctx, road, road.w, '#4d5058');
  for (const road of ROADS) {
    if (road.kind === 'residential') continue;
    strokeRoad(ctx, road, 0.55, '#f0c93a', [5, 6]);
  }
  ctx.globalAlpha = 0.22;
  for (const road of ROADS) strokeRoad(ctx, road, road.w * 0.9, '#5c6068', [1.5, 7]);
  ctx.globalAlpha = 1;

  // ---- car parks, plazas and the rest
  const lot = (x, z, w, d, rot = 0) => {
    ctx.save();
    ctx.translate(px(x), px(z));
    ctx.rotate(rot);
    ctx.fillStyle = '#54575e';
    ctx.fillRect(-w / 2 * S, -d / 2 * S, w * S, d * S);
    ctx.strokeStyle = 'rgba(248,248,242,0.7)';
    ctx.lineWidth = 2;
    for (let i = -w / 2 + 4; i < w / 2 - 2; i += 3.4) {
      ctx.beginPath();
      ctx.moveTo(i * S, (-d / 2 + 1.5) * S);
      ctx.lineTo(i * S, (-d / 2 + 7) * S);
      ctx.moveTo(i * S, (d / 2 - 1.5) * S);
      ctx.lineTo(i * S, (d / 2 - 7) * S);
      ctx.stroke();
    }
    ctx.restore();
  };
  for (const l of extra.lots) lot(l.x, l.z, l.w, l.d, l.rot || 0);
  for (const p of extra.paved) rect(p.x, p.z, p.w, p.d, p.color || '#d8d2c0');

  // driveways
  ctx.fillStyle = '#6a6d74';
  for (const d of extra.driveways) {
    ctx.save();
    ctx.translate(px(d.x), px(d.z));
    ctx.rotate(-d.rot);
    ctx.fillRect(-2.3 * S, -d.len / 2 * S, 4.6 * S, d.len * S);
    ctx.restore();
  }

  // the school football field
  ctx.save();
  ctx.translate(px(-96), px(-206));
  ctx.fillStyle = '#4f9e3f';
  ctx.fillRect(-30 * S, -17 * S, 60 * S, 34 * S);
  ctx.strokeStyle = 'rgba(250,250,246,0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(-28 * S, -15 * S, 56 * S, 30 * S);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9 * S, -15 * S);
    ctx.lineTo(i * 9 * S, 15 * S);
    ctx.stroke();
  }
  ctx.restore();

  // the runway
  ctx.save();
  ctx.translate(px(126), px(236));
  ctx.fillStyle = '#5a5d64';
  ctx.fillRect(-62 * S, -10 * S, 124 * S, 20 * S);
  ctx.fillStyle = '#f4f4f0';
  for (let i = -56; i < 56; i += 13) ctx.fillRect(i * S, -1.4 * S, 7 * S, 2.8 * S);
  ctx.strokeStyle = 'rgba(248,248,242,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(-62 * S, -10 * S, 124 * S, 20 * S);
  ctx.restore();

  // salvage-yard dirt
  ctx.strokeStyle = '#7a6a52';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(px(176), px(160));
  ctx.bezierCurveTo(px(232), px(158), px(244), px(216), px(180), px(222));
  ctx.stroke();

  return cv;
}

// --------------------------------------------------------------- colliders
class Colliders {
  constructor(cell = 24) {
    this.cell = cell;
    this.map = new Map();
    this.all = [];
  }

  key(cx, cz) { return cx * 10007 + cz; }

  add(box) {
    box.id = this.all.length;
    this.all.push(box);
    const c = this.cell;
    for (let cx = Math.floor(box.minX / c); cx <= Math.floor(box.maxX / c); cx++) {
      for (let cz = Math.floor(box.minZ / c); cz <= Math.floor(box.maxZ / c); cz++) {
        const k = this.key(cx, cz);
        let list = this.map.get(k);
        if (!list) { list = []; this.map.set(k, list); }
        list.push(box);
      }
    }
  }

  near(x, z, r = 4) {
    const c = this.cell;
    const out = [];
    const seen = new Set();
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) {
      for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
        const list = this.map.get(this.key(cx, cz));
        if (!list) continue;
        for (const b of list) {
          if (b.dead || seen.has(b.id)) continue;
          seen.add(b.id);
          out.push(b);
        }
      }
    }
    return out;
  }

  resolve(x, z, r) {
    let hit = null;
    let nx = x, nz = z;
    for (const b of this.near(nx, nz, r + 2)) {
      const cx = Math.max(b.minX, Math.min(nx, b.maxX));
      const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
      const dx = nx - cx, dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        const left = nx - b.minX, right = b.maxX - nx, up = nz - b.minZ, down = b.maxZ - nz;
        const m = Math.min(left, right, up, down);
        if (m === left) nx = b.minX - r;
        else if (m === right) nx = b.maxX + r;
        else if (m === up) nz = b.minZ - r;
        else nz = b.maxZ + r;
      }
      hit = b;
    }
    return { x: nx, z: nz, hit };
  }
}

// ------------------------------------------------------------------ the town
export function buildCity() {
  const rand = mulberry32(20030916);
  const root = new THREE.Group();
  const colliders = new Colliders();
  const landmarks = [];
  const props = [];
  const animated = [];
  const driveways = [];
  const lots = [];
  const paved = [];
  const spots = {};

  const addCollider = (x, z, rotY, col, extra = {}) => {
    if (!col) return null;
    let hw = col.hw, hd = col.hd;
    // rotated footprints get a conservative square so nothing pokes through
    const q = Math.abs(((rotY % Math.PI) + Math.PI) % Math.PI);
    if (q > 0.25 && q < Math.PI - 0.25) {
      const m = Math.max(hw, hd) * (q > Math.PI * 0.35 && q < Math.PI * 0.65 ? 1 : 0.92);
      hw = q > Math.PI * 0.35 && q < Math.PI * 0.65 ? col.hd : m;
      hd = q > Math.PI * 0.35 && q < Math.PI * 0.65 ? col.hw : m;
    }
    const box = {
      minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd,
      h: col.h || 6, smash: !!col.smash, ...extra,
    };
    colliders.add(box);
    return box;
  };

  /** Worst road clearance across a footprint's corners. */
  const footClear = (x, z, hw, hd) => {
    let worst = 999;
    for (const [dx, dz] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd], [hw, 0], [-hw, 0], [0, hd], [0, -hd]]) {
      worst = Math.min(worst, roadClearance(x + dx, z + dz));
    }
    return worst;
  };

  const place = (obj, x, z, rotY = 0, opts = {}) => {
    // Nothing gets built on the tarmac. If a plot overlaps a road — usually
    // near a junction where two streets pinch — shove it back until it fits.
    const col = obj.userData.col;
    if (col) {
      const q = Math.abs(((rotY % Math.PI) + Math.PI) % Math.PI);
      const swap = q > Math.PI * 0.35 && q < Math.PI * 0.65;
      const hw = (swap ? col.hd : col.hw) + 0.6;
      const hd = (swap ? col.hw : col.hd) + 0.6;
      // lamps, bins, signs and the like are small enough to live on the kerb;
      // anything bigger has to find real ground
      const small = (col.h || 6) <= 4 && col.hw <= 2.5 && col.hd <= 2.5;
      const need = opts.pavement || small ? 0.15 : 0.8;
      let tries = 0;
      while (footClear(x, z, hw, hd) < need && tries++ < 16) {
        const n = nearestRoad(x, z);
        let ax = x - n.px, az = z - n.pz;
        const l = Math.hypot(ax, az) || 1;
        ax /= l; az /= l;
        x += ax * 1.6;
        z += az * 1.6;
      }
      if (footClear(x, z, hw, hd) < need) {
        if (opts.pavement || opts.optional || small) return null;
      }
    }
    const baked = opts.raw ? obj : B.bake(obj);
    baked.position.set(x, 0, z);
    baked.rotation.y = rotY;
    root.add(baked);
    if (obj.userData.animate) animated.push({ obj: baked, fn: obj.userData.animate, phase: obj.userData.phase || 0 });
    const box = addCollider(x, z, rotY, baked.userData.col, opts.colliderExtra);
    if (box && baked.userData.col?.smash) props.push({ obj: baked, box, kind: opts.kind || 'prop' });
    if (opts.landmark) {
      landmarks.push({
        id: opts.landmark.id, name: opts.landmark.name, x, z,
        icon: opts.landmark.icon || '◆', color: opts.landmark.color || '#c0392b',
      });
      spots[opts.landmark.id] = { x, z, name: opts.landmark.name, face: rotY };
    }
    return baked;
  };

  /** Put a building on a plot beside a named road. */
  const build = (road, t, side, dist, obj, opts = {}) => {
    const p = plot(road, t, side, dist);
    const b = place(obj, p.x, p.z, p.rot + (opts.turn || 0), opts);
    if (opts.driveway) {
      driveways.push({
        x: p.x - Math.sin(p.rot) * (opts.drivewayOff || 6) + Math.sin(p.rot + Math.PI / 2) * (opts.drivewaySide ?? 5),
        z: p.z - Math.cos(p.rot) * (opts.drivewayOff || 6) + Math.cos(p.rot + Math.PI / 2) * (opts.drivewaySide ?? 5),
        len: opts.drivewayLen || 16,
        rot: p.rot,
      });
    }
    return b;
  };

  // ======================================================= SPOONER STREET
  // North side, walking west from Elm: 33 (Swansons), 31 (Griffins), 29
  // (Quagmire). South side facing them: the Browns, Herbert, the Goldmans.
  const spoonerHouses = [
    ['swanson', 'The Swansons — 33 Spooner', 0.22, 1, B.swansonHouse()],
    ['griffin', '31 Spooner Street', 0.56, 1, B.griffinHouse()],
    ['quagmire', "Quagmire's — 29 Spooner", 0.9, 1, B.quagmireHouse()],
    ['brown', "Cleveland's — 30 Spooner", 0.26, -1, B.brownHouse()],
    ['herbert', "Herbert's — 32 Spooner", 0.6, -1, B.herbertHouse()],
    ['goldman', 'The Goldmans — 34 Spooner', 0.93, -1, B.house({
      w: 9, d: 8, wall: '#e0e0ea', roof: '#4a6a4a', garage: true, door: '#8a5a2c',
    })],
  ];
  for (const [id, name, t, side, obj] of spoonerHouses) {
    build('spooner', t, side, 13, obj, {
      landmark: { id, name, icon: '🏠', color: '#3f7a3a' },
      driveway: true, drivewayLen: 17, drivewaySide: 5.5,
    });
    const p = plot('spooner', t, side, 4.5);
    place(B.mailbox(), p.x - Math.sin(p.rot + Math.PI / 2) * 5.5, p.z - Math.cos(p.rot + Math.PI / 2) * 5.5, 0, { kind: 'mailbox' });
    if (rand() < 0.7) {
      const tp = plot('spooner', t + 0.045, side, 9);
      place(B.tree(rand() < 0.35 ? 'pine' : 'oak', rand), tp.x, tp.z);
    }
  }
  spots.spooner = { x: -188, z: -195, name: 'Spooner Street' };
  // two more houses round the bulb, and the street sign on the corner
  for (const t of [0.34, 0.62]) {
    build('spoonerbulb', t, 1, 11, B.randomHouse(rand), { driveway: true, drivewayLen: 12 });
  }
  place(B.streetSign('SPOONER ST'), -144, -184, 0.3);
  for (const t of [0.1, 0.45, 0.8]) {
    const p = plot('spooner', t, 1, 3.2);
    place(B.streetLamp(6), p.x, p.z, p.rot);
  }

  // ============================================================ DOWNTOWN
  // The Clam sits on the corner of Center and Dock with its own gravel lot.
  build('center', 0.615, 1, 15, B.drunkenClam(), {
    landmark: { id: 'clam', name: 'The Drunken Clam', icon: '🍺', color: '#c0392b' },
  });
  lots.push({ x: plot('center', 0.66, 1, 16).x, z: plot('center', 0.66, 1, 16).z, w: 26, d: 18 });

  build('center', 0.53, 1, 14, B.pharmacy(), {
    landmark: { id: 'pharmacy', name: "Goldman's Pharmacy", icon: '💊', color: '#3f8478' },
  });

  // Al Harrington's Wacky Waving Inflatable Arm-Flailing Tube Men Emporium
  const harrington = build('center', 0.47, -1, 16, B.harringtons(), {
    landmark: {
      id: 'harrington',
      name: "Al Harrington's Wacky Waving Inflatable Arm-Flailing Tube Men Emporium",
      icon: '🎈', color: '#7a3f8a',
    },
  });
  {
    const p = plot('center', 0.47, -1, 5);
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * 6.2;
      const tx = p.x + Math.sin(p.dir) * off;
      const tz = p.z + Math.cos(p.dir) * off;
      const tm = B.tubeMan(['#ff5b4d', '#f2b705', '#3fc86a', '#4aa6e8', '#f27ac0'][i]);
      tm.userData.phase = i * 0.9;
      place(tm, tx, tz, 0, { raw: true });
    }
  }

  build('center', 0.72, -1, 15, B.cityBlock({
    w: 18, d: 13, floors: 2, wall: '#e8dcc8', style: 'siding', shop: 'QUAHOG DINER', shopBg: '#c0392b',
  }), { landmark: { id: 'diner', name: 'Quahog Diner', icon: '🍽', color: '#c0392b' } });

  build('center', 0.44, 1, 16, B.performingArts(), {
    landmark: { id: 'arts', name: 'Quahog Performing Arts Center', icon: '🎭', color: '#7a3f8a' },
  });

  // City Hall faces its plaza on Main Street
  const hallPlot = plot('main', 0.55, -1, 26);
  place(B.cityHall(), hallPlot.x, hallPlot.z, hallPlot.rot, {
    landmark: { id: 'cityhall', name: 'Quahog City Hall', icon: '🏛', color: '#1e3f7a' },
  });
  paved.push({ x: hallPlot.x + Math.sin(hallPlot.rot) * 15, z: hallPlot.z + Math.cos(hallPlot.rot) * 15, w: 44, d: 26 });
  for (const dx of [-12, 12]) {
    place(B.bench(), hallPlot.x + dx, hallPlot.z + 16, Math.PI);
  }
  place(B.statue('guy'), hallPlot.x, hallPlot.z + 19);

  build('quahogave', 0.30, -1, 16, B.newsStation(), {
    landmark: { id: 'channel5', name: 'Channel 5 Action News', icon: '📺', color: '#c0392b' },
  });
  build('main', 0.70, 1, 16, B.policeStation(), {
    landmark: { id: 'police', name: 'Quahog Police Department', icon: '🚓', color: '#1e3f7a' },
  });
  build('southside', 0.30, -1, 18, B.hospital(), {
    landmark: { id: 'hospital', name: 'Quahog Hospital', icon: '🏥', color: '#c0392b' },
  });

  // the mall and its enormous car park
  const mallPlot = plot('southside', 0.58, 1, 34);
  place(B.mall(), mallPlot.x, mallPlot.z, mallPlot.rot, {
    landmark: { id: 'mall', name: 'Quahog Mall', icon: '🛍', color: '#7a3f8a' },
  });
  lots.push({ x: mallPlot.x, z: mallPlot.z - 24, w: 84, d: 30 });
  for (let i = 0; i < 6; i++) place(B.streetLamp(), mallPlot.x - 34 + i * 14, mallPlot.z - 26);

  // ============================================================== SCHOOL
  const schoolPlot = plot('harbor', 0.30, -1, 22);
  place(B.highSchool(), schoolPlot.x, schoolPlot.z, schoolPlot.rot, {
    landmark: { id: 'school', name: 'James Woods Regional High', icon: '🎓', color: '#1e3f7a' },
  });
  lots.push({ x: schoolPlot.x + 4, z: schoolPlot.z + 22, w: 48, d: 16 });
  for (const sz of [-1, 1]) {
    const bleach = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 1.4), toon('#b8b0a0'));
      step.position.set(0, 0.5 + i * 0.7, i * 1.4);
      bleach.add(step);
    }
    bleach.userData.col = { hw: 15, hd: 3, h: 3 };
    place(bleach, -96, -206 + sz * 21, sz > 0 ? Math.PI : 0);
  }
  place(B.billboard('GO WOODCHUCKS!', 'JAMES WOODS ATHLETICS', '#1e3f7a'), -132, -168, 0.5);
  build('harbor', 0.44, -1, 20, B.cityBlock({
    w: 22, d: 14, floors: 2, wall: '#c8b8a8', style: 'brick', shop: 'BUDDY CIANCI JR. HIGH', shopBg: '#3f7a5a',
  }), { landmark: { id: 'cianci', name: 'Buddy Cianci Jr. High', icon: '🎓', color: '#3f7a5a' } });

  // ================================================================ PARK
  place(B.bandStand(), 56, -196, 0, { landmark: { id: 'park', name: 'Quahog Park', icon: '🌳', color: '#3f7a3a' } });
  place(B.statue('clam'), 20, -216);
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2, r = 14 + rand() * 30;
    const x = 56 + Math.cos(a) * r, z = -196 + Math.sin(a) * r * 0.8;
    if (Math.hypot(x - 72, z + 178) < 26) continue;   // keep the pond clear
    if (roadClearance(x, z) > 5) place(B.tree(rand() < 0.35 ? 'pine' : 'oak', rand), x, z);
  }
  for (let i = 0; i < 6; i++) {
    const p = roadPoint('parkloop', i / 6);
    place(B.bench(), p.x + Math.cos(p.dir) * 9, p.z - Math.sin(p.dir) * 9, p.dir + Math.PI / 2, { optional: true });
  }

  // ============================================================== HARBOUR
  build('harbor', 0.86, -1, 18, B.cityBlock({
    w: 22, d: 16, floors: 1, wall: '#9aa4b0', style: 'brick', shop: 'QUAHOG FISH CO.', shopBg: '#2e5a9e',
  }), { landmark: { id: 'docks', name: 'Quahog Docks', icon: '⚓', color: '#2e5a9e' } });
  build('harbor', 0.78, -1, 18, B.cityBlock({
    w: 20, d: 16, floors: 1, wall: '#8a94a0', style: 'brick', shop: 'DOCK 4 WAREHOUSE', shopBg: '#4a5a6a',
  }));
  place(B.lighthouse(), 258, -238, 0, { landmark: { id: 'lighthouse', name: 'Quahog Light', icon: '🗼', color: '#c0392b' } });
  for (let i = 0; i < 5; i++) {
    const p = roadPoint('shore', 0.12 + i * 0.06);
    place(B.boat(), p.x + 14, p.z, p.dir);
  }
  for (let i = 0; i < 6; i++) place(B.dumpster(i % 2 ? '#3f7a5a' : '#7a5a3a'), 168 + i * 9, -176, 0, { kind: 'dumpster' });

  build('shore', 0.45, -1, 16, B.cabanaClub(), {
    landmark: { id: 'cabana', name: 'Quahog Cabana Club', icon: '🏖', color: '#f2b705' },
  });
  for (let i = 0; i < 8; i++) {
    const p = roadPoint('shore', 0.5 + i * 0.03);
    place(B.tree('palm', rand), p.x - 16 - rand() * 10, p.z);
  }

  // ============================================================== ESTATE
  const estate = plot('elm', 0.115, -1, 46);
  place(B.mansion(), estate.x, estate.z, estate.rot, {
    landmark: { id: 'pewterschmidt', name: 'Pewterschmidt Manor', icon: '🏛', color: '#f2b705' },
  });
  for (let i = 0; i < 7; i++) {
    const p = plot('elm', 0.055 + i * 0.014, -1, 12);
    place(B.hedge(13, 1.8), p.x, p.z, p.rot);
  }
  place(B.gates(), plot('elm', 0.12, -1, 12).x, plot('elm', 0.12, -1, 12).z, plot('elm', 0.12, -1, 12).rot);
  for (let i = 0; i < 6; i++) {
    place(B.tree('pine', rand), estate.x - 34 + i * 14, estate.z - 22 + (i % 2) * 10, 0, { optional: true });
  }

  // ============================================================== CHURCH
  build('maple', 0.42, 1, 18, B.church(), {
    landmark: { id: 'church', name: "St. Philomena's", icon: '⛪', color: '#5a5a68' },
  });

  // ============================================================ BREWERY
  const brew = plot('mill', 0.42, 1, 26);
  place(B.brewery(), brew.x, brew.z, brew.rot, {
    landmark: { id: 'brewery', name: 'Pawtucket Patriot Brewery', icon: '🍻', color: '#1e3f7a' },
  });
  lots.push({ x: brew.x, z: brew.z + 26, w: 46, d: 18 });
  for (let i = 0; i < 6; i++) place(B.dumpster('#7a5a3a'), brew.x - 26 + i * 10, brew.z + 30, 0, { kind: 'dumpster' });
  place(B.billboard('PAWTUCKET PATRIOT ALE', 'IT IS BEER. WE CHECKED.', '#1e3f7a'), -30, 150, -0.5);

  // ============================================================ AIRPORT
  const air = plot('airportrd', 0.42, -1, 24);
  place(B.airport(), air.x, air.z, air.rot, {
    landmark: { id: 'airport', name: 'Quahog Airport', icon: '✈', color: '#1e3f7a' },
  });
  place(B.airliner(), 150, 240, 0.1);
  for (let i = 0; i < 5; i++) {
    const p = roadPoint('airportrd', 0.25 + i * 0.12);
    place(B.streetLamp(8), p.x, p.z + 9);
  }

  // ============================================================= SALVAGE
  for (let i = 0; i < 16; i++) {
    const x = 168 + rand() * 70, z = 158 + rand() * 62;
    if (roadClearance(x, z) < 6) continue;
    const stack = new THREE.Group();
    const n = 2 + ((rand() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const wreck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 2.0), toon(['#8a4a3a', '#4a5a6a', '#6a6a4a', '#7a4a5a'][(rand() * 4) | 0]));
      wreck.position.set((rand() - 0.5) * 0.6, 0.7 + k * 1.35, (rand() - 0.5) * 0.6);
      wreck.rotation.y = rand() * 0.4 - 0.2;
      stack.add(wreck);
    }
    stack.userData.col = { hw: 2.4, hd: 1.4, h: 4 };
    place(stack, x, z, rand() * Math.PI);
  }
  place(B.ramp(8, 12, 3), 196, 206, 0.4);
  place(B.ramp(8, 12, 3), 226, 168, 1.9);
  place(B.billboard('QUAHOG SALVAGE', 'IF IT IS BROKE, WE HAVE IT', '#8a6a44'), 168, 140, 0.3);
  spots.junkyard = { x: 200, z: 190, name: 'Quahog Salvage' };

  // ====================================================== STREET FRONTAGE
  const SHOPS = [
    ['DRY CLEANERS', '#3f7a5a'], ['CHECK CASHING', '#c0392b'], ['NAIL SALON', '#e07a2c'],
    ['TAX PREP', '#1e3f7a'], ['SUB SHOP', '#f2b705'], ['THRIFT', '#7a3f8a'],
    ['HARDWARE', '#8a5a2c'], ['COMIC BOOKS', '#c0392b'], ['DONUTS', '#e07a2c'],
    ['SHOE REPAIR', '#3f5f9f'], ['DELI', '#3f7a5a'], ['ARCADE', '#7a3f8a'],
    ['BOOKS', '#3f7a5a'], ['BARBER', '#e07a2c'], ['FLORIST', '#c0392b'],
    ['BAKERY', '#f2b705'], ['MUSIC', '#7a3f8a'], ['BANK OF QUAHOG', '#1e3f7a'],
    ['PIZZA', '#c0392b'], ['LAUNDROMAT', '#7a3f8a'], ['PAWN', '#4a4a58'],
  ];
  let shopIdx = 0;
  const nextShop = () => SHOPS[shopIdx++ % SHOPS.length];
  const shopRow = (road, from, to, side, n, dist = 15) => {
    for (let i = 0; i < n; i++) {
      const t = from + ((to - from) * i) / Math.max(1, n - 1);
      const p = plot(road, t, side, dist);
      if (roadClearance(p.x, p.z) < 6) continue;
      if (colliders.resolve(p.x, p.z, 9).hit) continue;
      const [name, color] = nextShop();
      place(B.cityBlock({
        w: 15, d: 13, floors: 1 + ((rand() * 4) | 0),
        wall: ['#b8746a', '#c8b8a8', '#d8cfc0', '#9aa4b0', '#c8a89a'][(rand() * 5) | 0],
        style: rand() < 0.55 ? 'brick' : 'stucco', shop: name, shopBg: color,
      }), p.x, p.z, p.rot, { optional: true });
    }
  };
  shopRow('center', 0.36, 0.44, -1, 3);
  shopRow('center', 0.56, 0.70, -1, 4);
  shopRow('center', 0.80, 0.96, -1, 5);
  shopRow('center', 0.30, 0.42, 1, 4);
  shopRow('center', 0.76, 0.96, 1, 5);
  shopRow('main', 0.34, 0.48, 1, 4);
  shopRow('main', 0.58, 0.68, -1, 3);
  shopRow('main', 0.78, 0.92, -1, 4);
  shopRow('quahogave', 0.45, 0.72, 1, 5, 16);
  shopRow('quahogave', 0.50, 0.75, -1, 4, 16);
  shopRow('southside', 0.10, 0.24, 1, 4);
  shopRow('southside', 0.72, 0.92, -1, 5);
  shopRow('harbor', 0.60, 0.72, 1, 3);

  // ====================================================== HOUSING ESTATES
  const houseRow = (road, from, to, side, n, dist = 14) => {
    for (let i = 0; i < n; i++) {
      const t = from + ((to - from) * i) / Math.max(1, n - 1);
      const p = plot(road, t, side, dist);
      if (roadClearance(p.x, p.z) < 6) continue;
      if (colliders.resolve(p.x, p.z, 9).hit) continue;
      if (Math.abs(p.x) > HALF - 18 || Math.abs(p.z) > HALF - 18) continue;
      if (!place(B.randomHouse(rand), p.x, p.z, p.rot, { optional: true })) continue;
      driveways.push({
        x: p.x - Math.sin(p.rot) * 7 + Math.sin(p.rot + Math.PI / 2) * 5,
        z: p.z - Math.cos(p.rot) * 7 + Math.cos(p.rot + Math.PI / 2) * 5,
        len: 16, rot: p.rot,
      });
      if (rand() < 0.5) {
        const tp = plot(road, t + 0.02, side, dist - 6);
        place(B.tree(rand() < 0.3 ? 'pine' : 'oak', rand), tp.x, tp.z);
      }
    }
  };
  // the west end of Center Street is houses, not shops — downtown starts later
  houseRow('center', 0.06, 0.24, -1, 5);
  houseRow('center', 0.06, 0.22, 1, 5);
  houseRow('maple', 0.05, 0.35, 1, 5);
  houseRow('maple', 0.05, 0.30, -1, 4);
  houseRow('maple', 0.55, 0.95, 1, 5);
  houseRow('cedar', 0.08, 0.9, 1, 6);
  houseRow('cedar', 0.15, 0.8, -1, 4);
  houseRow('elm', 0.30, 0.44, 1, 3);
  houseRow('elm', 0.62, 0.80, -1, 4);
  houseRow('elm', 0.60, 0.78, 1, 4);
  houseRow('west', 0.20, 0.40, 1, 4);
  houseRow('west', 0.62, 0.86, 1, 5);
  houseRow('millside', 0.15, 0.85, 1, 3);
  houseRow('millside', 0.2, 0.8, -1, 3);
  houseRow('birch', 0.15, 0.85, 1, 3);
  houseRow('spoonerbulb', 0.05, 0.2, 1, 2, 12);

  // Seamus down by the water, on his own
  build('shore', 0.86, -1, 20, B.house({
    w: 7, d: 6, wall: '#c8b8a8', roof: '#4a4a44', storeys: 1, porch: true, garage: false, door: '#3f5f3f',
  }), { landmark: { id: 'seamus', name: "Seamus's Shack", icon: '⚓', color: '#8a6a44' } });

  // ==================================================== STREET FURNITURE
  for (const road of ROADS) {
    if (road.kind === 'residential') continue;
    const steps = Math.max(3, Math.round(road.pts.length * 2.2));
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      for (const side of [-1, 1]) {
        const p = plot(road.name, t, side, 2.6);
        if (colliders.resolve(p.x, p.z, 2).hit) continue;
        const o = { pavement: true };
        if ((i + (side > 0 ? 0 : 1)) % 2 === 0) place(B.streetLamp(), p.x, p.z, p.rot, o);
        else if (i % 3 === 0) place(B.hydrant(), p.x, p.z, p.rot, { ...o, kind: 'hydrant' });
        else if (i % 5 === 0) place(B.trashCan(), p.x, p.z, p.rot, { ...o, kind: 'bin' });
      }
    }
  }
  // lights at the busiest junctions
  for (const [road, t] of [['center', 0.5], ['center', 0.62], ['main', 0.55], ['main', 0.35], ['southside', 0.5], ['harbor', 0.5]]) {
    for (const side of [-1, 1]) {
      const p = plot(road, t, side, 3.2);
      place(B.trafficLight(), p.x, p.z, p.rot, { pavement: true });
    }
  }
  for (const [road, t, side] of [['center', 0.2, 1], ['center', 0.75, -1], ['southside', 0.4, 1], ['harbor', 0.36, 1], ['main', 0.8, -1]]) {
    const p = plot(road, t, side, 5);
    place(B.busStop(), p.x, p.z, p.rot, { pavement: true, optional: true });
  }

  // ============================================================= EDGES
  for (let i = 0; i < 90; i++) {
    const x = -HALF + 4 + rand() * 22;
    const z = -HALF + rand() * HALF * 2;
    if (roadClearance(x, z) > 8) place(B.tree('pine', rand), x, z);
    const x2 = -HALF + rand() * HALF * 2;
    const z2 = i % 2 ? -HALF + 4 + rand() * 18 : HALF - 6 - rand() * 18;
    if (roadClearance(x2, z2) > 8 && x2 < SHORE_X - 20) place(B.tree('pine', rand), x2, z2);
  }
  const wall = (x, z, hw, hd) => colliders.add({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: 20, edge: true });
  wall(-HALF - 6, 0, 6, HALF + 10);
  wall(HALF + 6, 0, 6, HALF + 10);
  wall(0, -HALF - 6, HALF + 10, 6);
  wall(0, HALF + 6, HALF + 10, 6);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(760, 1500), toon('#3182bd'));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SHORE_X + 372, -0.12, 0);
  root.add(sea);

  const groundCanvas = paintGround({ driveways, lots, paved });
  const gtex = tex(groundCanvas);
  gtex.anisotropy = 16;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), toon('#ffffff', { map: gtex, mapKey: 'ground' }));
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  const graph = roadGraph();

  return {
    group: root, colliders, landmarks, props, spots, groundCanvas, sea, animated,
    roads: ROADS, graph, nodes: graph.nodes, edges: graph.edges,
    nearestRoad, onRoad, roadClearance,
    snapToRoad(x, z) {
      const n = nearestRoad(x, z);
      return n ? { x: n.px, z: n.pz, dir: n.dir } : { x, z, dir: 0 };
    },
    /** Tick anything that waves, spins or flails. */
    update(t, dt) {
      for (const a of animated) a.fn(t + (a.phase || 0), dt, a.obj);
    },
  };
}

/** Where each named character is, hour by hour. */
export const SCHEDULE = {
  peter: [[0, 'griffin'], [9, 'brewery'], [17, 'clam'], [23, 'griffin']],
  lois: [[0, 'griffin'], [10, 'mall'], [14, 'griffin'], [19, 'clam'], [22, 'griffin']],
  stewie: [[0, 'griffin'], [11, 'park'], [16, 'griffin']],
  brian: [[0, 'griffin'], [10, 'clam'], [15, 'park'], [20, 'clam'], [23, 'griffin']],
  chris: [[0, 'griffin'], [8, 'school'], [15, 'mall'], [20, 'griffin']],
  meg: [[0, 'griffin'], [8, 'school'], [15, 'diner'], [20, 'griffin']],
  quagmire: [[0, 'quagmire'], [9, 'airport'], [18, 'clam'], [23, 'quagmire']],
  cleveland: [[0, 'brown'], [9, 'mall'], [17, 'clam'], [23, 'brown']],
  joe: [[0, 'swanson'], [8, 'police'], [18, 'clam'], [23, 'swanson']],
  bonnie: [[0, 'swanson'], [11, 'mall'], [18, 'swanson']],
  mort: [[0, 'goldman'], [8, 'pharmacy'], [19, 'goldman']],
  herbert: [[0, 'herbert'], [7, 'herbert'], [15, 'school'], [19, 'herbert']],
  west: [[0, 'cityhall'], [9, 'cityhall'], [18, 'park'], [22, 'cityhall']],
  tucker: [[0, 'channel5'], [6, 'channel5'], [19, 'clam'], [23, 'channel5']],
  consuela: [[0, 'pewterschmidt'], [8, 'griffin'], [16, 'pewterschmidt']],
  carter: [[0, 'pewterschmidt'], [10, 'cabana'], [17, 'pewterschmidt']],
  barbara: [[0, 'pewterschmidt'], [11, 'cabana'], [16, 'pewterschmidt']],
  seamus: [[0, 'seamus'], [8, 'docks'], [18, 'clam'], [22, 'seamus']],
  hartman: [[0, 'hospital'], [8, 'hospital'], [19, 'clam'], [22, 'hospital']],
  jerome: [[0, 'clam'], [11, 'clam'], [23, 'clam']],
  bruce: [[0, 'harrington'], [9, 'harrington'], [18, 'diner'], [22, 'harrington']],
  neil: [[0, 'goldman'], [8, 'school'], [16, 'mall'], [21, 'goldman']],
  shepherd: [[0, 'school'], [8, 'school'], [17, 'clam'], [21, 'school']],
  angela: [[0, 'brewery'], [9, 'brewery'], [18, 'diner'], [22, 'brewery']],
  death: [[0, 'church'], [22, 'church']],
};

export function whereIs(id, hour) {
  const s = SCHEDULE[id];
  if (!s) return null;
  let at = s[0][1];
  for (const [h, place] of s) if (hour >= h) at = place;
  return at;
}
