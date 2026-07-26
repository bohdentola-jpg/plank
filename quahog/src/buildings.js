// Quahog, brick by brick. Facades are painted into canvases (with the ink
// lines drawn right into the texture) so the geometry stays cheap; the
// landmarks you actually recognise get built out in 3D.
import * as THREE from 'three';
import { toon, flat, mkCanvas, tex, shade, signBoard, signTex, INK, mergeByMaterial } from './toon.js';

// Shared materials so the whole town merges down to a handful of draw calls.
export const MAT = {
  glass: flat('#a9d8ef'),
  lampGlow: flat('#fff3c4'),
  neon: flat('#ff5b4d'),
  asphalt: toon('#4a4d55'),
  concrete: toon('#c8c4b8'),
  roof: toon('#7a4a3a'),
  wood: toon('#8a6a44'),
  metal: toon('#9aa0a8'),
  dark: toon('#3a3a44'),
  ink: flat(INK),
  water: toon('#3f8fc8'),
  grass: toon('#5fa845'),
  hedge: toon('#3f7a3a'),
  trunk: toon('#7a5230'),
  leaf: toon('#4a9440'),
  leaf2: toon('#5fae4a'),
};

// facade materials get their map swapped when the sun goes down
const facadeMats = [];
let isNight = false;

export function setNight(on) {
  if (on === isNight) return;
  isNight = on;
  for (const m of facadeMats) {
    m.map = on ? m.userData.night : m.userData.day;
    m.needsUpdate = true;
  }
  MAT.glass.color.set(on ? '#ffe08a' : '#a9d8ef');
  MAT.lampGlow.color.set(on ? '#fff3c4' : '#e8e4d0');
}
export function nightNow() { return isNight; }

// ---------------------------------------------------------------- facades
function inkRect(ctx, x, y, w, h, fill, lw = 3) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
}

/**
 * Paint a building face. Returns a material whose map swaps at night.
 * style: 'siding' | 'brick' | 'stucco' | 'glassbox' | 'shop'
 */
export function facade({
  wall = '#e8e4d8', trim = '#f8f8f2', style = 'siding', rows = 2, cols = 3,
  shop = null, shopBg = '#c0392b', px = 256, ratio = 1, litChance = 0.55, door = true,
} = {}) {
  const W = px, H = Math.max(64, Math.round(px * ratio));
  const make = (night) => {
    const cv = mkCanvas(W, H);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = night ? shade(wall, -46) : wall;
    ctx.fillRect(0, 0, W, H);
    if (style === 'siding') {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1.5;
      for (let y = 0; y < H; y += Math.max(7, H / 26)) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    } else if (style === 'brick') {
      const bh = Math.max(6, H / 30), bw = bh * 2.4;
      for (let r = 0, y = 0; y < H; r++, y += bh) {
        for (let x = (r % 2 ? -bw / 2 : 0); x < W; x += bw) {
          ctx.fillStyle = shade(night ? shade(wall, -46) : wall, (Math.random() * 14 - 7) | 0);
          ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        }
      }
    } else if (style === 'glassbox') {
      ctx.fillStyle = night ? '#1d2a44' : '#2e4f72';
      ctx.fillRect(0, 0, W, H);
    }
    // window grid
    const padX = W * 0.10, padY = H * 0.12;
    const cw = (W - padX * 2) / cols, ch = (H - padY * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * cw + cw * 0.16;
        const y = padY + r * ch + ch * 0.14;
        const w = cw * 0.68, h = ch * 0.62;
        const lit = night && Math.random() < litChance;
        inkRect(ctx, x, y, w, h, lit ? '#ffe08a' : (night ? '#2a3550' : '#a9d8ef'), Math.max(2, W / 110));
        // panes
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.5, W / 190);
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
        ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
        ctx.stroke();
        if (style === 'siding' && r === 0) {
          // shutters
          ctx.fillStyle = trim;
          for (const sx of [x - w * 0.22, x + w * 1.02]) inkRect(ctx, sx, y, w * 0.2, h, trim, 2);
        }
      }
    }
    if (shop) {
      // storefront band along the bottom
      const bandH = H * 0.30;
      ctx.fillStyle = night ? shade(shopBg, -30) : shopBg;
      ctx.fillRect(0, H - bandH, W, bandH);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(3, W / 90);
      ctx.strokeRect(0, H - bandH, W, bandH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fs = Math.min(bandH * 0.5, (W * 1.6) / Math.max(7, shop.length));
      ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.14;
      ctx.strokeStyle = INK;
      ctx.strokeText(shop, W / 2, H - bandH * 0.52);
      ctx.fillStyle = '#fdfaf2';
      ctx.fillText(shop, W / 2, H - bandH * 0.52);
      // big display windows
      for (const dx of [0.08, 0.62]) {
        inkRect(ctx, W * dx, H - bandH * 0.02 - H * 0.001, W * 0.30, bandH * 0.0, null, 0);
      }
    } else if (door) {
      const dw = W * 0.13, dh = H * 0.22;
      inkRect(ctx, W / 2 - dw / 2, H - dh, dw, dh, night ? shade(trim, -40) : trim, Math.max(2, W / 110));
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(W / 2 + dw * 0.28, H - dh * 0.5, Math.max(2, W / 130), 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(cv);
  };
  const day = make(false), night = make(true);
  const m = toon('#ffffff', { map: day, mapKey: `${wall}${style}${rows}${cols}${shop}` });
  m.userData = { day, night };
  facadeMats.push(m);
  if (isNight) { m.map = night; m.needsUpdate = true; }
  return m;
}

// ------------------------------------------------------------------ pieces
export function gableRoof(w, d, h, mat, overhang = 0.4) {
  const s = new THREE.Shape();
  const hw = w / 2 + overhang;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d + overhang * 2, bevelEnabled: false });
  g.translate(0, 0, -(d / 2 + overhang));
  const m = new THREE.Mesh(g, mat);
  return m;
}

export function flatRoof(w, d, mat, lip = 0.3) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat);
  g.add(top);
  for (const [sx, sz, ww, dd] of [[0, d / 2, w, lip], [0, -d / 2, w, lip], [w / 2, 0, lip, d], [-w / 2, 0, lip, d]]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(ww + lip, 0.5, dd + lip), mat);
    edge.position.set(sx, 0.2, sz);
    g.add(edge);
  }
  return g;
}

function boxAt(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

/** A door you can see from the street: frame, panel, knob, step. */
function door3D(w = 1.1, h = 2.2, color = '#c0392b') {
  const g = new THREE.Group();
  g.add(boxAt(w + 0.18, h + 0.14, 0.16, MAT.ink, 0, 0, 0));
  const panel = boxAt(w, h, 0.2, toon(color), 0, 0, 0.05);
  g.add(panel);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon('#f2b705'));
  knob.position.set(w * 0.32, h * 0.5, 0.18);
  g.add(knob);
  return g;
}

export function windowBox(w, h, frame = true) {
  const g = new THREE.Group();
  if (frame) g.add(boxAt(w + 0.16, h + 0.16, 0.1, MAT.ink, 0, -h / 2, 0));
  const pane = boxAt(w, h, 0.16, MAT.glass, 0, -h / 2, 0.04);
  g.add(pane);
  return g;
}

// ------------------------------------------------------------------ houses
const HOUSE_WALLS = ['#e8e4d8', '#bfe0f0', '#f2d9a8', '#d8ecc8', '#f0c8d4', '#e0e0ea', '#f6f2e6', '#cfe0d8'];
const HOUSE_ROOFS = ['#8a4a3a', '#3f5f7a', '#6a5a4a', '#4a6a4a', '#7a4a5a', '#5a5a6a'];

/**
 * A New England two-storey. This is 80% of the town.
 * opts: { w, d, wall, roof, garage, porch, storeys, fence, name }
 */
export function house(opts = {}) {
  const {
    w = 9, d = 8, wall = HOUSE_WALLS[0], roof = HOUSE_ROOFS[0], storeys = 2,
    garage = false, porch = true, door = '#c0392b', chimney = true, sign = null,
  } = opts;
  const g = new THREE.Group();
  const h = storeys * 2.7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall, trim: '#f8f8f2', style: 'siding', rows: storeys, cols: Math.max(2, Math.round(w / 3.4)),
    ratio: h / w, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  const rf = gableRoof(w, d, 2.4, toon(roof), 0.45);
  rf.position.y = h;
  g.add(rf);
  if (chimney) {
    const c = boxAt(0.9, 2.2, 0.9, toon('#8a5a4a'), w * 0.28, h, -d * 0.18);
    g.add(c);
  }
  const dr = door3D(1.15, 2.2, door);
  dr.position.set(0, 0, d / 2 + 0.02);
  g.add(dr);
  if (porch) {
    const deck = boxAt(w * 0.62, 0.25, 2.0, toon('#c8bfa8'), 0, 0, d / 2 + 1.0);
    g.add(deck);
    const cover = boxAt(w * 0.66, 0.22, 2.2, toon(roof), 0, 2.6, d / 2 + 1.0);
    g.add(cover);
    for (const sx of [-1, 1]) {
      const post = boxAt(0.18, 2.6, 0.18, toon('#f8f8f2'), sx * w * 0.28, 0.2, d / 2 + 1.9);
      g.add(post);
    }
    const step = boxAt(1.6, 0.12, 0.5, toon('#c8c4b8'), 0, 0, d / 2 + 2.2);
    g.add(step);
  }
  if (garage) {
    const gw = 3.6;
    const gar = new THREE.Mesh(new THREE.BoxGeometry(gw, 2.9, d * 0.7), toon(wall));
    gar.position.set(w / 2 + gw / 2 - 0.2, 1.45, d * 0.14);
    g.add(gar);
    const grf = gableRoof(gw, d * 0.7, 1.2, toon(roof), 0.3);
    grf.position.set(w / 2 + gw / 2 - 0.2, 2.9, d * 0.14);
    g.add(grf);
    const gdoor = boxAt(gw * 0.86, 2.4, 0.2, toon('#e8e8e2'), w / 2 + gw / 2 - 0.2, 0, d * 0.14 + d * 0.35);
    g.add(gdoor);
  }
  if (sign) {
    const s = signBoard(sign, 3.2, 0.9, { bg: '#2e5a9e' });
    s.position.set(0, 3.6, d / 2 + 0.12);
    g.add(s);
  }
  g.userData.col = { hw: w / 2 + (garage ? 1.9 : 0), hd: d / 2, h: h + 2.4 };
  return g;
}

export function randomHouse(rand = Math.random) {
  const pick = (a) => a[(rand() * a.length) | 0];
  return house({
    w: 8 + rand() * 3, d: 7 + rand() * 2.5,
    wall: pick(HOUSE_WALLS), roof: pick(HOUSE_ROOFS),
    storeys: rand() < 0.25 ? 1 : 2,
    garage: rand() < 0.45, porch: rand() < 0.8,
    door: pick(['#c0392b', '#2e5a9e', '#3f7a3a', '#f2b705', '#6a4a2c']),
  });
}

/** Downtown filler: brick or glass, storefront on the ground floor. */
export function cityBlock(opts = {}) {
  const {
    w = 14, d = 12, floors = 4, wall = '#b8746a', style = 'brick', shop = 'SHOP',
    shopBg = '#c0392b', roofKit = true,
  } = opts;
  const g = new THREE.Group();
  const h = floors * 3.2 + 1.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall, style, rows: floors, cols: Math.max(2, Math.round(w / 3.6)), shop, shopBg, ratio: h / w, px: 320,
  }));
  body.position.y = h / 2;
  g.add(body);
  const cap = flatRoof(w, d, toon(shade(wall, -30)));
  cap.position.y = h;
  g.add(cap);
  if (roofKit) {
    const ac = boxAt(1.6, 0.9, 1.4, MAT.metal, w * 0.2, h + 0.2, -d * 0.2);
    g.add(ac);
    const stair = boxAt(1.8, 1.6, 1.8, toon(shade(wall, -18)), -w * 0.24, h + 0.2, d * 0.1);
    g.add(stair);
  }
  // awning over the shop front
  const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.16, 1.6), toon(shopBg));
  aw.position.set(0, 3.1, d / 2 + 0.7);
  aw.rotation.x = 0.18;
  g.add(aw);
  g.userData.col = { hw: w / 2, hd: d / 2, h };
  return g;
}

// -------------------------------------------------------------- landmarks
/** 31 Spooner Street. Two storeys, white clapboard, red door, the works. */
export function griffinHouse() {
  const g = house({
    w: 10.5, d: 9, wall: '#f2efe4', roof: '#8a4a3a', storeys: 2,
    garage: true, porch: true, door: '#b03a2e',
  });
  // the dormer over the porch
  const dormer = boxAt(2.6, 1.6, 1.4, toon('#f2efe4'), 0, 5.4, 3.4);
  g.add(dormer);
  const drf = gableRoof(2.6, 1.4, 0.9, toon('#8a4a3a'), 0.2);
  drf.position.set(0, 7.0, 3.4);
  g.add(drf);
  const num = signBoard('31', 0.7, 0.5, { bg: '#f2efe4', fg: '#141418' });
  num.position.set(1.0, 2.6, 4.56);
  g.add(num);
  return g;
}

/** 29 Spooner Street. Quagmire's: tidy, blue, hot tub round the side. */
export function quagmireHouse() {
  const g = house({
    w: 9.5, d: 8, wall: '#bfe0f0', roof: '#3f5f7a', storeys: 2,
    garage: true, porch: true, door: '#2e5a9e',
  });
  const tub = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.5, 1.0, 14), MAT.wood);
  shell.position.y = 0.5;
  tub.add(shell);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 14), toon('#5fb8e0'));
  water.position.y = 0.98;
  tub.add(water);
  tub.position.set(-7.5, 0, -3);
  g.add(tub);
  const s = signBoard('29', 0.7, 0.5, { bg: '#bfe0f0', fg: '#141418' });
  s.position.set(1.1, 2.6, 4.06);
  g.add(s);
  return g;
}

/** 33 Spooner Street. The Swansons: Joe's ramp instead of the front steps. */
export function swansonHouse() {
  const g = house({
    w: 9.5, d: 8, wall: '#f2d9a8', roof: '#6a5a4a', storeys: 2,
    garage: false, porch: true, door: '#3f7a3a',
  });
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(5, 0); s.lineTo(5, 0.75); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  const ramp = new THREE.Mesh(geo, toon('#c8bfa8'));
  ramp.position.set(0.8, 0, 8.6);
  ramp.rotation.y = Math.PI;
  g.add(ramp);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 5), MAT.metal);
  rail.position.set(1.6, 0.9, 6.4);
  g.add(rail);
  const s2 = signBoard('33', 0.7, 0.5, { bg: '#f2d9a8', fg: '#141418' });
  s2.position.set(1.1, 2.6, 4.06);
  g.add(s2);
  return g;
}

/** 30 Spooner Street. Cleveland's, with the bathtub halfway out of the wall. */
export function brownHouse() {
  const g = house({
    w: 9.5, d: 8, wall: '#d8ecc8', roof: '#7a4a5a', storeys: 2,
    garage: true, porch: true, door: '#c0392b',
  });
  // the tub, mid-exit, forever
  const tub = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.5, 5, 12), toon('#f4f4f2'));
  shell.rotation.z = Math.PI / 2;
  tub.add(shell);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), toon('#c8c8cc'));
  foot.position.set(-0.9, -0.7, 0.4);
  tub.add(foot);
  tub.position.set(-5.3, 4.1, 1.6);
  tub.rotation.z = -0.35;
  tub.rotation.y = 0.2;
  g.add(tub);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 2.6), flat('#2a2a2e'));
  hole.position.set(-4.78, 4.4, 1.6);
  g.add(hole);
  return g;
}

/** 32 Spooner Street. Herbert's, with the long porch and the bike out front. */
export function herbertHouse() {
  const g = house({
    w: 9, d: 8, wall: '#f0c8d4', roof: '#5a5a6a', storeys: 1,
    garage: false, porch: true, door: '#f2b705',
  });
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), MAT.wood);
  rocker.position.set(-2.6, 0.6, 5.2);
  g.add(rocker);
  // a bicycle, leant on the porch post, waiting
  const bike = new THREE.Group();
  for (const dz of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 5, 14), MAT.dark);
    wheel.position.set(0, 0.34, dz);
    wheel.rotation.y = Math.PI / 2;
    bike.add(wheel);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), toon('#c0392b'));
  frame.position.set(0, 0.55, 0);
  bike.add(frame);
  bike.position.set(3.0, 0, 5.6);
  bike.rotation.y = 0.4;
  g.add(bike);
  return g;
}

/** Al Harrington's Wacky Waving Inflatable Arm-Flailing Tube Men Emporium
 *  and Warehouse. The sign is nearly as wide as the building. */
export function harringtons() {
  const g = new THREE.Group();
  const w = 26, d = 15, h = 7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#e8dcc8', style: 'stucco', rows: 1, cols: 7, ratio: h / w, px: 448, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#c8bca8'))).position.y = h;
  const s1 = signBoard("AL HARRINGTON'S", 20, 3, { bg: '#7a3f8a', fg: '#ffe9a0' });
  s1.position.set(0, h + 2.1, d / 2 + 0.2);
  g.add(s1);
  const s2 = signBoard('WACKY WAVING INFLATABLE ARM-FLAILING TUBE MEN', 22, 1.5, { bg: '#f2b705', fg: '#141418' });
  s2.position.set(0, h - 1.2, d / 2 + 0.22);
  g.add(s2);
  const s3 = signBoard('EMPORIUM AND WAREHOUSE', 12, 1.1, { bg: '#c0392b', fg: '#fdfaf2' });
  s3.position.set(0, h - 3.0, d / 2 + 0.22);
  g.add(s3);
  const dr = door3D(2.4, 3, '#3a2a20');
  dr.position.set(0, 0, d / 2 + 0.02);
  g.add(dr);
  g.userData.col = { hw: w / 2, hd: d / 2, h: h + 4 };
  return g;
}

/**
 * One wacky waving inflatable arm-flailing tube man. A chain of segments that
 * whips about; the arms have their own, faster whip.
 */
export function tubeMan(color = '#ff5b4d') {
  const g = new THREE.Group();
  const mat = toon(color);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.35, 12), MAT.dark);
  base.position.y = 0.17;
  g.add(base);
  const joints = [];
  let parent = g;
  const SEG = 7;
  for (let i = 0; i < SEG; i++) {
    const j = new THREE.Group();
    j.position.y = i === 0 ? 0.3 : 0.85;
    parent.add(j);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - i * 0.025, 0.58 - i * 0.025, 0.85, 10), mat);
    seg.position.y = 0.42;
    j.add(seg);
    joints.push(j);
    parent = j;
  }
  // head with a face, on the last joint
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), mat);
  head.position.y = 1.0;
  parent.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), flat('#ffffff'));
    eye.position.set(s * 0.14, 1.06, 0.4);
    parent.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), flat(INK));
    pupil.position.set(s * 0.14, 1.06, 0.42);
    parent.add(pupil);
  }
  // two flailing arms hung off the fourth segment
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.3, 0.5, 0);
    shoulder.rotation.z = s * 0.9;
    joints[3].add(shoulder);
    let ap = shoulder;
    const chain = [];
    for (let i = 0; i < 3; i++) {
      const j = new THREE.Group();
      j.position.y = i === 0 ? 0 : 0.6;
      ap.add(j);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.65, 8), mat);
      seg.position.y = 0.3;
      j.add(seg);
      chain.push(j);
      ap = j;
    }
    arms.push({ chain, side: s });
  }
  g.userData.col = { hw: 0.8, hd: 0.8, h: 6 };
  g.userData.animate = (t) => {
    const w = Math.sin(t * 2.2);
    const w2 = Math.sin(t * 3.1 + 1.2);
    joints.forEach((j, i) => {
      const k = i / SEG;
      j.rotation.z = Math.sin(t * 2.4 - i * 0.7) * (0.10 + k * 0.34) * (0.6 + 0.4 * w);
      j.rotation.x = Math.sin(t * 1.9 - i * 0.5 + 1.1) * (0.06 + k * 0.22);
    });
    for (const { chain, side } of arms) {
      chain.forEach((j, i) => {
        j.rotation.z = side * (0.5 + Math.sin(t * 5.5 - i * 1.1) * 0.9);
        j.rotation.x = Math.sin(t * 4.7 - i * 0.9 + side) * 0.7 * (0.5 + 0.5 * w2);
      });
    }
  };
  return g;
}

/** A green street-name blade on a pole. */
export function streetSign(text) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 8), MAT.dark);
  pole.position.y = 1.6;
  g.add(pole);
  const blade = signBoard(text, 2.6, 0.6, { bg: '#2e6a3f', fg: '#f4f4f2' });
  blade.position.y = 3.0;
  g.add(blade);
  const back = signBoard(text, 2.6, 0.6, { bg: '#2e6a3f', fg: '#f4f4f2' });
  back.position.y = 3.0;
  back.rotation.y = Math.PI;
  g.add(back);
  g.userData.col = { hw: 0.3, hd: 0.3, h: 3.2 };
  return g;
}

/** Estate gates: two brick piers and a lot of ironwork. */
export function gates() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.4, 1.6), toon('#c8b8a0'));
    pier.position.set(s * 5, 2.2, 0);
    g.add(pier);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toon('#d8d0b8'));
    cap.position.set(s * 5, 4.7, 0);
    g.add(cap);
    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), MAT.dark);
      bar.position.set(s * (0.6 + i * 0.52), 1.7, 0);
      g.add(bar);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.12), MAT.dark);
    rail.position.set(s * 2.6, 3.3, 0);
    g.add(rail);
  }
  g.userData.col = { hw: 6, hd: 0.9, h: 4.6 };
  return g;
}

/** The Drunken Clam: shingled bar with a big clam sign and a neon window. */
export function drunkenClam() {
  const g = new THREE.Group();
  const w = 14, d = 11, h = 5.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#6a4a3a', style: 'siding', rows: 1, cols: 3, ratio: h / w, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  const rf = gableRoof(w, d, 2.0, toon('#4a3a30'), 0.5);
  rf.position.y = h;
  g.add(rf);
  const s = signBoard('THE DRUNKEN CLAM', 9, 2.2, { bg: '#c0392b', fg: '#ffe9a0', sub: 'BEER · FIGHTS · MORE BEER' });
  s.position.set(0, 6.2, d / 2 + 0.3);
  g.add(s);
  // the clam itself, over the door
  const clam = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toon('#f0b8c8'));
  clam.rotation.x = -0.35;
  clam.position.set(-4.4, 3.4, d / 2 + 0.5);
  g.add(clam);
  const dr = door3D(1.4, 2.4, '#3a2a20');
  dr.position.set(0, 0, d / 2 + 0.02);
  g.add(dr);
  const neon = signBoard('OPEN', 1.8, 0.7, { bg: '#141418', fg: '#ff5b4d' });
  neon.position.set(3.6, 2.6, d / 2 + 0.12);
  g.add(neon);
  for (const sx of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10), toon('#8a6a44'));
    barrel.position.set(sx * 5.6, 0.55, d / 2 + 1.2);
    g.add(barrel);
  }
  g.userData.col = { hw: w / 2, hd: d / 2, h: h + 2 };
  return g;
}

/** Pawtucket Patriot Ale — silos, pipes, and a beer bottle you can see from space. */
export function brewery() {
  const g = new THREE.Group();
  const w = 26, d = 18, h = 9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#a8563c', style: 'brick', rows: 3, cols: 7, ratio: h / w, px: 384, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#7a4030'))).position.y = h;
  for (let i = 0; i < 3; i++) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 12, 14), MAT.metal);
    silo.position.set(-w / 2 + 4 + i * 5.2, 6, -d / 2 - 3);
    g.add(silo);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), MAT.metal);
    cap.position.set(-w / 2 + 4 + i * 5.2, 12, -d / 2 - 3);
    g.add(cap);
  }
  // the giant bottle on the roof
  const bottle = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 6, 14), toon('#6a4a1a'));
  glass.position.y = 3;
  bottle.add(glass);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 2.4, 12), toon('#6a4a1a'));
  neck.position.y = 7.2;
  bottle.add(neck);
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12), toon('#c0392b'));
  capT.position.y = 8.6;
  bottle.add(capT);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.72, 2.4, 14, 1, true), flat('#ffffff', { map: signTex('PATRIOT', { bg: '#1e3f7a', fg: '#f2b705', w: 512, h: 256 }), mapKey: 'patriot' }));
  label.position.y = 3.2;
  bottle.add(label);
  bottle.position.set(w * 0.3, h, 0);
  g.add(bottle);
  const s = signBoard('PAWTUCKET PATRIOT ALE', 18, 3, { bg: '#1e3f7a', fg: '#f2b705', sub: 'BREWED IN QUAHOG SINCE 1892' });
  s.position.set(0, h * 0.62, d / 2 + 0.2);
  g.add(s);
  g.userData.col = { hw: w / 2, hd: d / 2 + 5, h: h + 9 };
  return g;
}

/** James Woods Regional High — long brick building, flagpole, marquee. */
export function highSchool() {
  const g = new THREE.Group();
  const w = 34, d = 14, h = 8.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#b8746a', style: 'brick', rows: 2, cols: 10, ratio: h / w, px: 512, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#8a5a4a'))).position.y = h;
  // entrance block with columns
  const ent = boxAt(9, 6.4, 3.5, toon('#e8e0cc'), 0, 0, d / 2 + 1.6);
  g.add(ent);
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 5.4, 10), toon('#f4f0e2'));
    col.position.set(i * 1.9, 2.7, d / 2 + 3.3);
    g.add(col);
  }
  const s = signBoard('JAMES WOODS REGIONAL HIGH', 12, 1.8, { bg: '#1e3f7a', fg: '#f2f2ee' });
  s.position.set(0, 7.4, d / 2 + 1.75);
  g.add(s);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 8), MAT.metal);
  pole.position.set(-w / 2 - 3, 4.5, d / 2 + 4);
  g.add(pole);
  const flagM = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), flat('#c0392b'));
  flagM.position.set(-w / 2 - 1.8, 8.2, d / 2 + 4);
  g.add(flagM);
  g.userData.col = { hw: w / 2, hd: d / 2 + 2.4, h };
  return g;
}

/** Quahog City Hall — dome, columns, and a mayor who fights the water supply. */
export function cityHall() {
  const g = new THREE.Group();
  const w = 26, d = 16, h = 11;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#e6e0cc', style: 'stucco', rows: 2, cols: 8, ratio: h / w, px: 384, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#d8d0b8'))).position.y = h;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 3, 18), toon('#e6e0cc'));
  drum.position.y = h + 1.6;
  g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), toon('#3f8478'));
  dome.position.y = h + 3.1;
  g.add(dome);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 8), toon('#f2b705'));
  finial.position.y = h + 8.2;
  g.add(finial);
  // portico
  const ped = boxAt(14, 1.2, 5, toon('#d8d0b8'), 0, 0, d / 2 + 2.4);
  g.add(ped);
  for (let i = -3; i <= 3; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 8.4, 12), toon('#f4f0e2'));
    col.position.set(i * 2.1, 5.4, d / 2 + 4.2);
    g.add(col);
  }
  const pedimentGeo = new THREE.CylinderGeometry(0, 7.6, 2.6, 3);
  const pediment = new THREE.Mesh(pedimentGeo, toon('#f4f0e2'));
  pediment.rotation.y = Math.PI / 2;
  pediment.rotation.x = Math.PI / 2;
  pediment.scale.z = 0.6;
  pediment.position.set(0, 10.6, d / 2 + 4.2);
  g.add(pediment);
  const s = signBoard('QUAHOG CITY HALL', 11, 1.5, { bg: '#1e3f7a', fg: '#f2f2ee' });
  s.position.set(0, 8.6, d / 2 + 0.2);
  g.add(s);
  g.userData.col = { hw: w / 2, hd: d / 2 + 3.2, h: h + 8 };
  return g;
}

/** Channel 5 Action News — dishes, mast, and Tom Tucker's enormous face. */
export function newsStation() {
  const g = new THREE.Group();
  const w = 20, d = 14, h = 8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#8fa8bc', style: 'glassbox', rows: 2, cols: 6, ratio: h / w, px: 384, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#6a7a8a'))).position.y = h;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 16, 8), MAT.metal);
  mast.position.set(w * 0.3, h + 8, 0);
  g.add(mast);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.2, 0.08, 5, 12), MAT.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(w * 0.3, h + 4 + i * 4.6, 0);
    g.add(ring);
  }
  for (const sx of [-1, 1]) {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), toon('#f2f2ee'));
    dish.rotation.x = -1.0;
    dish.position.set(sx * 5.5, h + 1.8, -2);
    g.add(dish);
  }
  const s = signBoard('CHANNEL 5 ACTION NEWS', 13, 2.2, { bg: '#c0392b', fg: '#f2f2ee', sub: 'QUAHOG — WE REPORT, YOU WATCH' });
  s.position.set(0, 5.6, d / 2 + 0.2);
  g.add(s);
  g.userData.col = { hw: w / 2, hd: d / 2, h: h + 16 };
  return g;
}

/** The Quahog Mall — big box, tall entry arch, rooftop letters. */
export function mall() {
  const g = new THREE.Group();
  const w = 42, d = 26, h = 9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#d8cfc0', style: 'stucco', rows: 1, cols: 10, ratio: h / w, px: 512, door: false, litChance: 0.8,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#b8b0a0'))).position.y = h;
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 6, 16, 1, false, 0, Math.PI), toon('#8fd0ee'));
  arch.rotation.z = Math.PI / 2;
  arch.rotation.y = Math.PI / 2;
  arch.position.set(0, 6, d / 2 + 1);
  g.add(arch);
  const entry = boxAt(10, 6, 3, toon('#e8e0cc'), 0, 0, d / 2 + 1);
  g.add(entry);
  const s = signBoard('QUAHOG MALL', 16, 3, { bg: '#7a3f8a', fg: '#ffe9a0', sub: '40 STORES · FOOD COURT · SANTA (SEASONAL)' });
  s.position.set(0, 11, d / 2 + 0.4);
  g.add(s);
  g.userData.col = { hw: w / 2, hd: d / 2 + 2, h: h + 4 };
  return g;
}

export function pharmacy() {
  const g = cityBlock({ w: 15, d: 12, floors: 2, wall: '#c8b8a8', style: 'brick', shop: "GOLDMAN'S PHARMACY", shopBg: '#3f8478' });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.3), flat('#3f8478'));
  cross.position.set(-5, 8.4, 6.2);
  g.add(cross);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.3), flat('#3f8478'));
  cross2.position.set(-5, 8.4, 6.2);
  g.add(cross2);
  return g;
}

export function lighthouse() {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.0, 16, 16), toon('#f4f0e2'));
  tower.position.y = 8;
  g.add(tower);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.35 - i * 0.16, 2.5 - i * 0.16, 1.6, 16), toon('#c0392b'));
    band.position.y = 3.4 + i * 5;
    g.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 16), MAT.dark);
  gallery.position.y = 16;
  g.add(gallery);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 12), MAT.lampGlow);
  lamp.position.y = 17.5;
  g.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2, 12), toon('#3a3a44'));
  cap.position.y = 19.8;
  g.add(cap);
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 6), toon('#e8e4d8'));
  base.position.set(4, 1.7, 2);
  g.add(base);
  g.userData.col = { hw: 5, hd: 4, h: 20 };
  return g;
}

export function church() {
  const g = new THREE.Group();
  const w = 12, d = 18, h = 7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#f2efe4', style: 'siding', rows: 1, cols: 5, ratio: h / w, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  const rf = gableRoof(w, d, 3.2, toon('#5a5a68'), 0.4);
  rf.position.y = h;
  g.add(rf);
  const tower = boxAt(5, 13, 5, toon('#f2efe4'), 0, 0, d / 2 - 1);
  g.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7, 4), toon('#5a5a68'));
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, 16.4, d / 2 - 1);
  g.add(spire);
  const crossV = boxAt(0.24, 2, 0.24, flat('#f2b705'), 0, 20, d / 2 - 1);
  g.add(crossV);
  const crossH = boxAt(1.1, 0.24, 0.24, flat('#f2b705'), 0, 21, d / 2 - 1);
  g.add(crossH);
  const s = signBoard("ST. PHILOMENA'S", 5.5, 1.1, { bg: '#3f5f9f', fg: '#f2f2ee' });
  s.position.set(0, 9.5, d / 2 + 1.6);
  g.add(s);
  g.userData.col = { hw: w / 2, hd: d / 2 + 1, h: 22 };
  return g;
}

export function hospital() {
  const g = new THREE.Group();
  const w = 26, d = 18, h = 16;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#e8ecef', style: 'stucco', rows: 5, cols: 8, ratio: h / w, px: 384, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  g.add(flatRoof(w, d, toon('#c8ccd0'))).position.y = h;
  const s = signBoard('QUAHOG HOSPITAL', 12, 2, { bg: '#c0392b', fg: '#ffffff', sub: 'EMERGENCY · DR. HARTMAN, PROBABLY' });
  s.position.set(0, 4.5, d / 2 + 0.2);
  g.add(s);
  const heli = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20), flat('#8a9098'));
  heli.rotation.x = -Math.PI / 2;
  heli.position.set(0, h + 0.35, 0);
  g.add(heli);
  g.userData.col = { hw: w / 2, hd: d / 2, h };
  return g;
}

/** Pewterschmidt Manor: Lois's parents' money, in architectural form. */
export function mansion() {
  const g = new THREE.Group();
  const w = 30, d = 16, h = 11;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#e4dcc8', style: 'brick', rows: 3, cols: 9, ratio: h / w, px: 448, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  const rf = gableRoof(w, d, 2.6, toon('#4a4a58'), 0.6);
  rf.position.y = h;
  g.add(rf);
  for (const sx of [-1, 1]) {
    const wing = boxAt(9, 8, 12, toon('#e4dcc8'), sx * (w / 2 + 3.5), 0, -1);
    g.add(wing);
    const wr = gableRoof(9, 12, 2, toon('#4a4a58'), 0.5);
    wr.position.set(sx * (w / 2 + 3.5), 8, -1);
    g.add(wr);
  }
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 9.4, 12), toon('#f4f0e2'));
    col.position.set(i * 2.6, 4.7, d / 2 + 2.2);
    g.add(col);
  }
  const porch = boxAt(14, 0.6, 4.6, toon('#d8d0b8'), 0, 0, d / 2 + 2.2);
  g.add(porch);
  const dr = door3D(2.2, 3.2, '#3a2a20');
  dr.position.set(0, 0, d / 2 + 0.05);
  g.add(dr);
  const s = signBoard('PEWTERSCHMIDT', 7, 1.1, { bg: '#1a1a22', fg: '#f2b705' });
  s.position.set(0, 10.2, d / 2 + 0.2);
  g.add(s);
  g.userData.col = { hw: w / 2 + 8, hd: d / 2 + 2, h: h + 3 };
  return g;
}

export function performingArts() {
  const g = cityBlock({ w: 22, d: 16, floors: 3, wall: '#c8b09a', style: 'stucco', shop: 'PERFORMING ARTS CENTER', shopBg: '#7a3f8a' });
  const marquee = signBoard('TONIGHT: THE KING & I (SORT OF)', 12, 1.6, { bg: '#f2b705', fg: '#141418' });
  marquee.position.set(0, 5.4, 8.2);
  g.add(marquee);
  return g;
}

export function policeStation() {
  const g = cityBlock({ w: 18, d: 14, floors: 2, wall: '#9aa4b0', style: 'brick', shop: 'QUAHOG POLICE', shopBg: '#1e3f7a' });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), flat('#3f6fd8'));
  light.position.set(0, 8.6, 7.2);
  g.add(light);
  return g;
}

export function airport() {
  const g = new THREE.Group();
  const w = 34, d = 14, h = 7;
  const term = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#cfd6dc', style: 'glassbox', rows: 2, cols: 12, ratio: h / w, px: 512, door: false,
  }));
  term.position.y = h / 2;
  g.add(term);
  g.add(flatRoof(w, d, toon('#a8b0b8'))).position.y = h;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.6, 18, 12), toon('#dfe4e8'));
  tower.position.set(w / 2 + 6, 9, 0);
  g.add(tower);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.0, 3.4, 12), MAT.glass);
  cab.position.set(w / 2 + 6, 19, 0);
  g.add(cab);
  const capT = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 12), toon('#3a3a44'));
  capT.position.set(w / 2 + 6, 21.4, 0);
  g.add(capT);
  const s = signBoard('QUAHOG AIRPORT', 14, 2.2, { bg: '#1e3f7a', fg: '#f2f2ee', sub: 'DEPARTURES · ARRIVALS · LOST LUGGAGE' });
  s.position.set(0, 5, d / 2 + 0.2);
  g.add(s);
  g.userData.col = { hw: w / 2 + 9, hd: d / 2, h: 22 };
  return g;
}

/** A parked airliner — scenery, and a great thing to drive under. */
export function airliner() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 20, 6, 14), toon('#f4f4f2'));
  body.rotation.z = Math.PI / 2;
  body.position.y = 4.2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 14), toon('#f4f4f2'));
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(12.6, 4.2, 0);
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 6, 0.5), toon('#c0392b'));
  tail.position.set(-11, 7.4, 0);
  g.add(tail);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 26), toon('#e8e8e4'));
  wing.position.set(1, 3.8, 0);
  g.add(wing);
  for (const sz of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 12), MAT.metal);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(0.5, 2.6, sz * 7);
    g.add(eng);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.4, 8), MAT.dark);
    strut.position.set(2, 1.2, sz * 4);
    g.add(strut);
  }
  const nosegear = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.4, 8), MAT.dark);
  nosegear.position.set(10, 1.2, 0);
  g.add(nosegear);
  g.userData.col = { hw: 13, hd: 3, h: 9 };
  return g;
}

export function cabanaClub() {
  const g = new THREE.Group();
  const w = 20, d = 12, h = 5.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade({
    wall: '#f0e2c8', style: 'stucco', rows: 1, cols: 6, ratio: h / w, door: false,
  }));
  body.position.y = h / 2;
  g.add(body);
  const rf = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.5, d + 2), toon('#c8a06a'));
  rf.position.y = h + 0.25;
  g.add(rf);
  const s = signBoard('QUAHOG CABANA CLUB', 12, 2, { bg: '#f2b705', fg: '#141418', sub: 'MEMBERS ONLY (ASK CARTER)' });
  s.position.set(0, h - 1, d / 2 + 0.2);
  g.add(s);
  for (let i = 0; i < 4; i++) {
    const umb = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), MAT.wood);
    pole.position.y = 1.2;
    umb.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.8, 10), toon(i % 2 ? '#c0392b' : '#f2f2ee'));
    top.position.y = 2.6;
    umb.add(top);
    umb.position.set(-7 + i * 4.6, 0, d / 2 + 5);
    g.add(umb);
  }
  g.userData.col = { hw: w / 2, hd: d / 2, h: h + 1 };
  return g;
}

export function stripMall(shops) {
  const g = new THREE.Group();
  let x = 0;
  const unitW = 11;
  for (let i = 0; i < shops.length; i++) {
    const s = shops[i];
    const unit = cityBlock({
      w: unitW, d: 11, floors: 1, wall: s.wall || '#d8cfc0', style: 'stucco',
      shop: s.name, shopBg: s.color || '#c0392b', roofKit: i === 0,
    });
    unit.position.x = x;
    g.add(unit);
    x += unitW;
  }
  g.position.x = -(x - unitW) / 2;
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.userData.col = { hw: x / 2, hd: 5.5, h: 5 };
  return wrap;
}

// -------------------------------------------------------------------- props
export function tree(kind = 'oak', rand = Math.random) {
  const g = new THREE.Group();
  if (kind === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.2, 7), MAT.trunk);
    trunk.position.y = 1.1;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.5, 3, 9), i % 2 ? MAT.leaf : MAT.leaf2);
      cone.position.y = 2.4 + i * 1.7;
      g.add(cone);
    }
    g.userData.col = { hw: 0.5, hd: 0.5, h: 7 };
  } else if (kind === 'palm') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 6, 8), MAT.trunk);
    trunk.position.y = 3;
    trunk.rotation.z = 0.1;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 5), MAT.leaf);
      frond.scale.set(1, 0.16, 0.5);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.3 + 0.6, 6.1, Math.sin(a) * 1.3);
      frond.rotation.y = -a;
      frond.rotation.z = -0.25;
      g.add(frond);
    }
    g.userData.col = { hw: 0.5, hd: 0.5, h: 7 };
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.44, 2.6, 8), MAT.trunk);
    trunk.position.y = 1.3;
    g.add(trunk);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(1.7 + rand() * 0.5, 10, 8), i % 2 ? MAT.leaf : MAT.leaf2);
      blob.position.set((rand() - 0.5) * 1.6, 3.5 + i * 0.7, (rand() - 0.5) * 1.6);
      g.add(blob);
    }
    g.userData.col = { hw: 0.6, hd: 0.6, h: 6 };
  }
  return g;
}

export function streetLamp(h = 6) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, h, 8), MAT.dark);
  pole.position.y = h / 2;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), MAT.dark);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.7, h, 0);
  g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7), MAT.dark);
  head.position.set(1.35, h - 0.1, 0);
  g.add(head);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.55), MAT.lampGlow);
  bulb.position.set(1.35, h - 0.3, 0);
  g.add(bulb);
  g.userData.col = { hw: 0.3, hd: 0.3, h };
  return g;
}

export function hydrant() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.75, 8), toon('#c0392b'));
  body.position.y = 0.38;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toon('#c0392b'));
  cap.position.y = 0.78;
  g.add(cap);
  for (const s of [-1, 1]) {
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 6), toon('#a02a1c'));
    nut.rotation.z = Math.PI / 2;
    nut.position.set(s * 0.25, 0.5, 0);
    g.add(nut);
  }
  g.userData.col = { hw: 0.3, hd: 0.3, h: 1, smash: true };
  return g;
}

export function mailbox() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), MAT.wood);
  post.position.y = 0.55;
  g.add(post);
  const box = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), MAT.metal);
  box.rotation.z = Math.PI / 2;
  box.rotation.y = Math.PI / 2;
  box.position.y = 1.2;
  g.add(box);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.14), toon('#c0392b'));
  flag.position.set(0.2, 1.4, 0);
  g.add(flag);
  g.userData.col = { hw: 0.3, hd: 0.3, h: 1.4, smash: true };
  return g;
}

export function bench() {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.6), MAT.wood);
  seat.position.y = 0.5;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.12), MAT.wood);
  back.position.set(0, 0.82, -0.26);
  g.add(back);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.5), MAT.dark);
    leg.position.set(s * 0.9, 0.25, 0);
    g.add(leg);
  }
  g.userData.col = { hw: 1.2, hd: 0.4, h: 1 };
  return g;
}

export function trashCan() {
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 1.0, 10), toon('#4a7a4a'));
  can.position.y = 0.5;
  g.add(can);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 10), toon('#3a5a3a'));
  lid.position.y = 1.05;
  g.add(lid);
  g.userData.col = { hw: 0.45, hd: 0.45, h: 1.1, smash: true };
  return g;
}

export function trafficLight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 8), MAT.dark);
  pole.position.y = 3;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), MAT.dark);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(1.7, 5.8, 0);
  g.add(arm);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), MAT.dark);
  box.position.set(3.2, 5.3, 0);
  g.add(box);
  const colors = ['#c0392b', '#f2b705', '#3f9a3f'];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), flat(colors[i]));
    light.position.set(3.2, 5.78 - i * 0.44, 0.22);
    g.add(light);
  }
  g.userData.col = { hw: 0.35, hd: 0.35, h: 6 };
  return g;
}

export function busStop() {
  const g = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.6), toon('#3f6fa8'));
  roof.position.y = 2.6;
  g.add(roof);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), MAT.metal);
    post.position.set(s * 1.6, 1.3, -0.7);
    g.add(post);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.1), MAT.glass);
  back.position.set(0, 1.4, -0.75);
  g.add(back);
  const b = bench();
  b.position.z = 0.1;
  g.add(b);
  g.userData.col = { hw: 1.8, hd: 0.9, h: 2.7 };
  return g;
}

export function fence(len = 8, color = '#f2efe4') {
  const g = new THREE.Group();
  const mat = toon(color);
  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), mat);
  rail1.position.y = 0.9;
  g.add(rail1);
  const rail2 = rail1.clone();
  rail2.position.y = 0.45;
  g.add(rail2);
  const n = Math.max(2, Math.round(len / 0.9));
  for (let i = 0; i <= n; i++) {
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.1), mat);
    picket.position.set(-len / 2 + (i * len) / n, 0.6, 0);
    g.add(picket);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), mat);
    tip.position.set(-len / 2 + (i * len) / n, 1.28, 0);
    g.add(tip);
  }
  g.userData.col = { hw: len / 2, hd: 0.2, h: 1.3 };
  return g;
}

export function hedge(len = 8, h = 1.6) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, 1.2), MAT.hedge);
  body.position.y = h / 2;
  g.add(body);
  for (let i = 0; i < Math.max(2, len / 2); i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), MAT.hedge);
    puff.scale.set(1, 0.5, 0.8);
    puff.position.set(-len / 2 + 1 + i * 2, h, 0);
    g.add(puff);
  }
  g.userData.col = { hw: len / 2, hd: 0.7, h };
  return g;
}

export function dumpster(color = '#3f7a5a') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.5), toon(color));
  body.position.y = 0.8;
  g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 1.6), toon(shade(color, -22)));
  lid.position.y = 1.56;
  g.add(lid);
  g.userData.col = { hw: 1.4, hd: 0.85, h: 1.6, smash: true };
  return g;
}

export function boat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 5, 5, 10), toon('#f4f4f2'));
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 1, 0.6);
  hull.position.y = 0.7;
  g.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), toon('#2e5a9e'));
  cabin.position.set(-0.6, 1.7, 0);
  g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4, 6), MAT.wood);
  mast.position.set(1.2, 2.7, 0);
  g.add(mast);
  g.userData.col = { hw: 3.6, hd: 1.4, h: 3 };
  return g;
}

export function ramp(w = 6, len = 8, h = 2.2) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(w / 2, 0, -len / 2);
  const m = new THREE.Mesh(geo, toon('#c8a06a'));
  m.userData.ramp = { w, len, h };
  return m;
}

export function billboard(text, sub, bg = '#c0392b') {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), MAT.dark);
    leg.position.set(s * 3, 3, 0);
    g.add(leg);
  }
  const board = signBoard(text, 10, 3.4, { bg, fg: '#fdfaf2', sub });
  board.position.y = 7.6;
  g.add(board);
  const back = new THREE.Mesh(new THREE.BoxGeometry(10, 3.4, 0.2), MAT.dark);
  back.position.set(0, 7.6, -0.12);
  g.add(back);
  g.userData.col = { hw: 3.3, hd: 0.4, h: 9 };
  return g;
}

export function bandStand() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.6, 12), toon('#d8d0b8'));
  base.position.y = 0.3;
  g.add(base);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3, 8), toon('#f4f0e2'));
    post.position.set(Math.cos(a) * 3.5, 2.1, Math.sin(a) * 3.5);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2, 12), toon('#3f7a5a'));
  roof.position.y = 4.6;
  g.add(roof);
  g.userData.col = { hw: 4, hd: 4, h: 5 };
  return g;
}

export function statue(what = 'clam') {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), toon('#c8c4b8'));
  base.position.y = 1.1;
  g.add(base);
  const plaque = signBoard(what === 'clam' ? 'QUAHOG' : 'A GUY', 1.8, 0.6, { bg: '#8a6a44', fg: '#f2e2c0' });
  plaque.position.set(0, 1.4, 1.32);
  g.add(plaque);
  if (what === 'clam') {
    for (const s of [-1, 1]) {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toon('#c8a86a'));
      shell.rotation.z = s * 0.5;
      shell.position.set(s * 0.4, 3, 0);
      g.add(shell);
    }
  } else {
    const fig = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.6, 5, 10), toon('#b8a86a'));
    fig.position.y = 3.6;
    g.add(fig);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toon('#b8a86a'));
    head.position.y = 4.9;
    g.add(head);
  }
  g.userData.col = { hw: 1.6, hd: 1.6, h: 5 };
  return g;
}

/** Every building gets flattened before it goes in the world. */
export function bake(group) {
  const merged = mergeByMaterial(group);
  merged.userData.col = group.userData.col;
  return merged;
}
