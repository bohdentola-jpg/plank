// Interior kit: walls with openings, the painted guardapolvo band, tile floors,
// wooden ceiling beams (vigas) and furniture.
import * as THREE from 'three';
import { toon, box, mesh, cyl, sphere, rbox, tube, PAL, shade, mkCanvas, tex, rng } from './toon.js';
import { plasterTex, tileTex, woodTex, talaveraTex } from './world.js';

// a wall in its local XY plane (facing +z), with rectangular holes {x, y, w, h}
export function wall(w, h, holes = [], color = '#f4c9a8', { band = null, bandH = 0.85, thick = 0.18 } = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.lineTo(-w / 2, 0);
  for (const o of holes) {
    const p = new THREE.Path();
    p.moveTo(o.x - o.w / 2, o.y); p.lineTo(o.x - o.w / 2, o.y + o.h); p.lineTo(o.x + o.w / 2, o.y + o.h); p.lineTo(o.x + o.w / 2, o.y); p.lineTo(o.x - o.w / 2, o.y);
    shape.holes.push(p);
  }
  const geo = new THREE.ShapeGeometry(shape, 4);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.4, uv.getY(i) / 2.4);
  const m = toon('#ffffff', { map: plasterTex(color, null), rim: 0 });
  m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
  const face = mesh(geo, m, { cast: false, receive: true });
  g.add(face);
  // back face so light doesn't leak and the wall has thickness at openings
  const backFace = mesh(geo, toon(shade(color, -30), { rim: 0, side: THREE.BackSide }), { cast: true, receive: false });
  backFace.position.z = -thick;
  g.add(backFace);
  for (const o of holes) {
    // reveal (the wall thickness inside the opening)
    const revM = toon(shade(color, -18), { rim: 0 });
    const top = box(o.w, 0.04, thick, revM);
    top.position.set(o.x, o.y + o.h, -thick / 2);
    g.add(top);
    if (o.y > 0.01) {
      const bot = box(o.w, 0.04, thick, revM);
      bot.position.set(o.x, o.y, -thick / 2);
      g.add(bot);
    }
    for (const sx of [-1, 1]) {
      const side = box(0.04, o.h, thick, revM);
      side.position.set(o.x + sx * o.w / 2, o.y + o.h / 2, -thick / 2);
      g.add(side);
    }
  }
  if (band) {
    // the painted band along the bottom, interrupted by door openings
    const doors = holes.filter((o) => o.y < 0.05).sort((a, b) => a.x - b.x);
    let x0 = -w / 2;
    const segs = [];
    for (const d of doors) { segs.push([x0, d.x - d.w / 2]); x0 = d.x + d.w / 2; }
    segs.push([x0, w / 2]);
    const bm = toon(band, { rim: 0 });
    for (const [a, b] of segs) {
      if (b - a < 0.02) continue;
      const strip = box(b - a, bandH, 0.012, bm);
      strip.position.set((a + b) / 2, bandH / 2, 0.006);
      strip.receiveShadow = true;
      strip.castShadow = false;
      g.add(strip);
      const line = box(b - a, 0.05, 0.02, toon(shade(band, -35), { rim: 0 }));
      line.position.set((a + b) / 2, bandH, 0.01);
      line.castShadow = false;
      g.add(line);
    }
  }
  return g;
}

export function floor(w, d, a = '#c8643b', b = '#b85532') {
  const f = mesh(new THREE.PlaneGeometry(w, d), toon('#ffffff', { map: tileTex(a, b, 4), rim: 0 }), { cast: false, receive: true });
  f.material.map.repeat.set(w / 1.6, d / 1.6);
  f.rotation.x = -Math.PI / 2;
  return f;
}

export function beams(w, d, h, n = 6) {
  const g = new THREE.Group();
  const m = toon('#ffffff', { map: woodTex('#6e4127'), rim: 0 });
  for (let i = 0; i < n; i++) {
    const b = box(0.22, 0.24, d, m);
    b.position.set(-w / 2 + (w / (n - 1)) * i, h - 0.12, 0);
    b.castShadow = false;
    g.add(b);
  }
  const ceil = mesh(new THREE.PlaneGeometry(w, d), toon('#e9d6bd', { rim: 0, side: THREE.DoubleSide }), { cast: false });
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  g.add(ceil);
  return g;
}

export function rug(w = 3, d = 2) {
  const cv = mkCanvas(256, 160);
  const ctx = cv.getContext('2d');
  const cols = [PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple, PAL.gold, '#fff3dc'];
  ctx.fillStyle = '#f3e3c3';
  ctx.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(0, 10 + i * 9, 256, i % 3 === 0 ? 6 : 3);
  }
  ctx.fillStyle = '#2a1a14';
  for (let x = 8; x < 256; x += 22) {
    ctx.beginPath(); ctx.moveTo(x, 80); ctx.lineTo(x + 8, 70); ctx.lineTo(x + 16, 80); ctx.lineTo(x + 8, 90); ctx.fill();
  }
  const r = box(w, 0.02, d, toon('#ffffff', { map: tex(cv), rim: 0 }));
  r.position.y = 0.01;
  r.receiveShadow = true;
  r.castShadow = false;
  return r;
}

export function table({ w = 1.8, d = 0.8, h = 0.78, color = '#8a5a33' } = {}) {
  const g = new THREE.Group();
  const m = toon('#ffffff', { map: woodTex(color), rim: 0 });
  const top = box(w, 0.07, d, m);
  top.position.y = h - 0.035;
  g.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = box(0.08, h - 0.07, 0.08, m);
    leg.position.set(x * (w / 2 - 0.08), (h - 0.07) / 2, z * (d / 2 - 0.08));
    g.add(leg);
  }
  const apron = box(w - 0.1, 0.1, d - 0.1, m);
  apron.position.y = h - 0.12;
  g.add(apron);
  g.userData.top = h;
  return g;
}

export function sofa({ color = PAL.turquoise } = {}) {
  const g = new THREE.Group();
  const m = toon(color);
  const base = rbox(2.2, 0.42, 0.9, 0.12, m);
  base.position.y = 0.32;
  g.add(base);
  const back = rbox(2.2, 0.7, 0.24, 0.12, m);
  back.position.set(0, 0.72, -0.36);
  g.add(back);
  for (const sx of [-1, 1]) {
    const arm = rbox(0.24, 0.5, 0.9, 0.1, toon(shade(color, -20)));
    arm.position.set(sx * 1.1, 0.5, 0);
    g.add(arm);
  }
  const cols = [PAL.rosa, PAL.marigold, PAL.purple];
  cols.forEach((c, i) => {
    const cu = rbox(0.42, 0.4, 0.14, 0.1, toon(c));
    cu.position.set(-0.6 + i * 0.6, 0.72, -0.18);
    cu.rotation.x = -0.2;
    cu.rotation.z = (i - 1) * 0.15;
    g.add(cu);
  });
  for (const x of [-0.95, 0.95]) {
    const f = cyl(0.05, 0.04, 0.12, toon(PAL.woodDark), 8);
    f.position.set(x, 0.06, 0.3);
    g.add(f);
  }
  return g;
}

export function armchair({ color = PAL.rosa } = {}) {
  const g = new THREE.Group();
  const m = toon(color);
  const seat = rbox(0.9, 0.4, 0.8, 0.12, m);
  seat.position.y = 0.3;
  g.add(seat);
  const back = rbox(0.9, 0.75, 0.22, 0.12, m);
  back.position.set(0, 0.75, -0.32);
  g.add(back);
  for (const sx of [-1, 1]) {
    const arm = rbox(0.18, 0.45, 0.8, 0.08, toon(shade(color, -25)));
    arm.position.set(sx * 0.48, 0.5, 0);
    g.add(arm);
  }
  // crocheted doily on the back — every abuela's chair has one
  const d = cyl(0.22, 0.22, 0.01, toon('#ffffff'), 18);
  d.rotation.x = Math.PI / 2 - 0.2;
  d.position.set(0, 0.95, -0.2);
  g.add(d);
  return g;
}

export function trastero() {
  // a painted cupboard with clay pots and plates
  const g = new THREE.Group();
  const m = toon('#ffffff', { map: woodTex('#2f6f8f'), rim: 0 });
  const body = box(1.3, 1.9, 0.45, m);
  body.position.y = 0.95;
  g.add(body);
  const top = box(1.42, 0.08, 0.52, toon(PAL.woodDark, { rim: 0 }));
  top.position.y = 1.93;
  g.add(top);
  for (let s = 0; s < 3; s++) {
    const shelf = box(1.2, 0.04, 0.38, toon(PAL.wood, { rim: 0 }));
    shelf.position.set(0, 0.9 + s * 0.38, 0.06);
    g.add(shelf);
  }
  const inner = box(1.18, 1.0, 0.02, toon('#1f4f6a', { rim: 0 }));
  inner.position.set(0, 1.35, 0.03);
  g.add(inner);
  const clay = [PAL.terracotta, '#b4673c', '#9a4a2a'];
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 3; i++) {
      if (s === 1) {
        const plate = cyl(0.13, 0.13, 0.02, toon('#ffffff', { map: talaveraTex() }), 20);
        plate.rotation.x = Math.PI / 2 - 0.15;
        plate.position.set(-0.38 + i * 0.38, 0.9 + s * 0.38 + 0.15, 0.08);
        g.add(plate);
      } else {
        const pot = sphere(0.1 + (i % 2) * 0.02, toon(clay[i]), 14);
        pot.scale.y = 0.85;
        pot.position.set(-0.38 + i * 0.38, 0.9 + s * 0.38 + 0.11, 0.1);
        g.add(pot);
      }
    }
  }
  for (const sx of [-1, 1]) {
    const door = box(0.58, 0.72, 0.03, toon('#ffffff', { map: woodTex('#3b86a8'), rim: 0 }));
    door.position.set(sx * 0.31, 0.42, 0.235);
    g.add(door);
    const flower = sphere(0.07, toon(PAL.gold), 10);
    flower.scale.z = 0.3;
    flower.position.set(sx * 0.31, 0.45, 0.255);
    g.add(flower);
  }
  return g;
}

export function plant({ big = 1, seed = 1 } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  const pot = cyl(0.22 * big, 0.16 * big, 0.36 * big, toon(PAL.terracotta), 14);
  pot.position.y = 0.18 * big;
  g.add(pot);
  const rim = cyl(0.24 * big, 0.24 * big, 0.06 * big, toon(shade(PAL.terracotta, -20)), 14);
  rim.position.y = 0.36 * big;
  g.add(rim);
  const leaf = toon('#3e8a45');
  for (let i = 0; i < 9; i++) {
    const l = sphere(0.18 * big, i % 2 ? leaf : toon('#4fa053'), 8);
    const a = (i / 9) * Math.PI * 2;
    l.scale.set(0.55, 1.2, 0.25);
    l.position.set(Math.cos(a) * 0.15 * big, (0.6 + r() * 0.3) * big, Math.sin(a) * 0.15 * big);
    l.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
    g.add(l);
  }
  return g;
}

export function wallFrame(canvas, w = 0.4, h = 0.5, color = '#7a4a2a') {
  const g = new THREE.Group();
  const back = rbox(w + 0.08, h + 0.08, 0.04, 0.02, toon(color));
  g.add(back);
  const pic = mesh(new THREE.PlaneGeometry(w, h), toon('#ffffff', { map: canvas ? tex(canvas) : null, rim: 0 }), { cast: false });
  pic.position.z = 0.023;
  pic.userData.noOutline = true;
  g.add(pic);
  g.userData.pic = pic;
  return g;
}

export function calendarProp() {
  const cv = mkCanvas(200, 260);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, 200, 260);
  ctx.fillStyle = PAL.rosa; ctx.fillRect(0, 0, 200, 54);
  ctx.fillStyle = '#fff'; ctx.font = "34px 'Lilita One', sans-serif"; ctx.textAlign = 'center';
  ctx.fillText('NOVIEMBRE', 100, 40);
  ctx.fillStyle = '#2a1a14'; ctx.font = "bold 16px 'Nunito', sans-serif";
  const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  days.forEach((d, i) => ctx.fillText(d, 18 + i * 27, 76));
  ctx.font = "bold 18px 'Nunito', sans-serif";
  // November 2026 starts on a Sunday
  for (let d = 1; d <= 30; d++) {
    const i = d - 1, x = 18 + (i % 7) * 27, y = 104 + Math.floor(i / 7) * 30;
    if (d <= 2) {
      ctx.fillStyle = PAL.marigold;
      ctx.beginPath(); ctx.arc(x, y - 6, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
    } else ctx.fillStyle = '#2a1a14';
    ctx.fillText(String(d), x, y);
  }
  return wallFrame(cv, 0.4, 0.52, '#ffffff');
}

export function guitarCase() {
  const g = new THREE.Group();
  const m = toon('#3a2a24');
  const body = sphere(0.24, m, 16);
  body.scale.set(1, 1.15, 0.35);
  body.position.y = 0.32;
  g.add(body);
  const upper = sphere(0.19, m, 16);
  upper.scale.set(1, 1, 0.35);
  upper.position.y = 0.66;
  g.add(upper);
  const neck = box(0.14, 0.5, 0.1, m);
  neck.position.y = 1.0;
  g.add(neck);
  const handle = tube([[-0.08, 0.5, 0.09], [0, 0.56, 0.12], [0.08, 0.5, 0.09]], 0.015, toon('#1a1210'), 6);
  g.add(handle);
  const sticker = cyl(0.06, 0.06, 0.01, toon(PAL.marigold), 12);
  sticker.rotation.x = Math.PI / 2;
  sticker.position.set(0.05, 0.3, 0.085);
  g.add(sticker);
  g.rotation.z = 0.12;
  return g;
}

export function radioProp() {
  const g = new THREE.Group();
  const body = rbox(0.42, 0.26, 0.18, 0.05, toon('#7a4a2a'));
  body.position.y = 0.13;
  g.add(body);
  const grill = mesh(new THREE.CircleGeometry(0.08, 18), toon('#d9c09a'), { cast: false });
  grill.position.set(-0.08, 0.13, 0.092);
  g.add(grill);
  for (let i = 0; i < 2; i++) {
    const k = cyl(0.025, 0.025, 0.02, toon(PAL.gold), 10);
    k.rotation.x = Math.PI / 2;
    k.position.set(0.1 + i * 0.07, 0.13, 0.095);
    g.add(k);
  }
  return g;
}

export function smallTable({ color = '#8a5a33', h = 0.55, r = 0.3 } = {}) {
  const g = new THREE.Group();
  const m = toon('#ffffff', { map: woodTex(color), rim: 0 });
  const top = cyl(r, r, 0.05, m, 18);
  top.position.y = h;
  g.add(top);
  const leg = cyl(0.04, 0.06, h, m, 8);
  leg.position.y = h / 2;
  g.add(leg);
  const foot = cyl(0.18, 0.2, 0.04, m, 12);
  foot.position.y = 0.02;
  g.add(foot);
  return g;
}

export function doormat() {
  const m = box(1.0, 0.02, 0.6, toon('#b99a68', { rim: 0 }));
  m.position.y = 0.01;
  m.castShadow = false;
  return m;
}

export function hangingPapel(x0, x1, y, z, customs = null) {
  return { x0, x1, y, z, customs };
}
