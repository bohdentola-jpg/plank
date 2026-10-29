// Little dioramas used only as pictures on the learning cards.
import * as THREE from 'three';
import { toon, sphere, cyl, box, mesh, lathe, rbox, mkCanvas, tex, rng, PAL } from './toon.js';
import { marigolds, marigoldBunch, papelCanvas } from './world.js';
import { veladora, cirio, xoloFigure, panDeMuerto, sugarSkull, waterGlass, PROP_INFO, catrinaFigure, copalBurner } from './props.js';

const TAU = Math.PI * 2;

function canvasPlane(cv, w, h, opts = {}) {
  const m = mesh(new THREE.PlaneGeometry(w, h), toon('#ffffff', { map: tex(cv), rim: 0, side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, alphaTest: opts.alphaTest ?? 0 }), { cast: false });
  m.userData.noOutline = true;
  return m;
}

function calendario() {
  const g = new THREE.Group();
  const cv = mkCanvas(256, 300);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, 256, 300);
  ctx.fillStyle = PAL.rosa; ctx.fillRect(0, 0, 256, 70);
  ctx.fillStyle = '#fff'; ctx.font = "44px 'Lilita One', sans-serif"; ctx.textAlign = 'center';
  ctx.fillText('NOV', 128, 52);
  ctx.fillStyle = '#2a1a14'; ctx.font = "120px 'Lilita One', sans-serif";
  ctx.fillText('1·2', 128, 200);
  ctx.fillStyle = PAL.marigold;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(24 + i * 26, 262, 9, 0, TAU); ctx.fill(); }
  const page = canvasPlane(cv, 0.26, 0.3);
  page.position.set(0, 0.18, 0.012);
  g.add(page);
  const back = rbox(0.28, 0.33, 0.02, 0.01, toon(PAL.purple));
  back.position.set(0, 0.17, 0);
  g.add(back);
  for (const x of [-0.07, 0.07]) {
    const ring = mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14), toon('#999'));
    ring.position.set(x, 0.335, 0.012);
    g.add(ring);
  }
  const fl = marigoldBunch(6, 0.05, 4, 0.03);
  fl.position.set(0.13, 0.02, 0.06);
  g.add(fl);
  return g;
}

function raices() {
  // a stepped pyramid and a church side by side: two roots, one tradition
  const g = new THREE.Group();
  const stone = toon('#c9b18c');
  for (let i = 0; i < 4; i++) {
    const s = box(0.3 - i * 0.065, 0.05, 0.3 - i * 0.065, stone);
    s.position.set(-0.17, 0.025 + i * 0.05, 0);
    g.add(s);
  }
  const temple = box(0.07, 0.06, 0.07, toon(PAL.terracotta));
  temple.position.set(-0.17, 0.23, 0);
  g.add(temple);
  const stairs = box(0.06, 0.2, 0.02, toon('#b49a73'));
  stairs.position.set(-0.17, 0.1, 0.15);
  stairs.rotation.x = -0.75;
  g.add(stairs);
  const wall = toon('#f2b6a0');
  const nave = box(0.16, 0.16, 0.22, wall);
  nave.position.set(0.17, 0.08, 0);
  g.add(nave);
  const tower = box(0.07, 0.3, 0.07, wall);
  tower.position.set(0.22, 0.15, 0.08);
  g.add(tower);
  const dome = mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, TAU, 0, Math.PI / 2), toon('#e9c46a'));
  dome.position.set(0.22, 0.3, 0.08);
  g.add(dome);
  const crossV = box(0.01, 0.05, 0.01, toon('#3a3030'));
  crossV.position.set(0.22, 0.37, 0.08);
  g.add(crossV);
  const crossH = box(0.03, 0.01, 0.01, toon('#3a3030'));
  crossH.position.set(0.22, 0.38, 0.08);
  g.add(crossH);
  const path = [];
  for (let i = 0; i < 16; i++) path.push([-0.15 + i * 0.02, 0.005, 0.2 + Math.sin(i * 0.6) * 0.02, 0.016]);
  g.add(marigolds(path, { seed: 3 }));
  return g;
}

function rio() {
  // the river crossing on the way to Mictlán, with a little dog
  const g = new THREE.Group();
  const water = mesh(new THREE.PlaneGeometry(0.6, 0.24, 8, 4), toon('#3d7fc4', { rim: 0 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.01;
  g.add(water);
  const pos = water.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 30) * 0.004);
  water.geometry.computeVertexNormals();
  for (const z of [-0.18, 0.18]) {
    const bank = box(0.62, 0.04, 0.12, toon('#8a6a45'));
    bank.position.set(0, 0.02, z);
    g.add(bank);
  }
  const dog = xoloFigure();
  dog.position.set(0, 0.0, 0);
  dog.rotation.y = 0.6;
  dog.scale.setScalar(1.2);
  g.add(dog);
  for (let i = 0; i < 5; i++) {
    const r = sphere(0.02, toon('#6b6b6b'), 6);
    r.position.set(-0.25 + i * 0.12, 0.012, 0.09 * Math.sin(i * 2));
    r.scale.y = 0.4;
    g.add(r);
  }
  return g;
}

function globo() {
  const g = new THREE.Group();
  const cv = mkCanvas(256, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4aa3df'; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#79c25a';
  const blobs = [[60, 40, 30, 20], [70, 80, 18, 26], [130, 40, 26, 18], [150, 70, 20, 30], [200, 50, 34, 22], [215, 95, 14, 10]];
  for (const [x, y, w, h] of blobs) { ctx.beginPath(); ctx.ellipse(x, y, w, h, 0.3, 0, TAU); ctx.fill(); }
  const ball = sphere(0.14, toon('#ffffff', { map: tex(cv) }), 28);
  ball.position.y = 0.22;
  ball.rotation.set(0.3, 1.2, 0);
  g.add(ball);
  const ring = mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 32, Math.PI * 1.3), toon(PAL.gold));
  ring.position.y = 0.22;
  ring.rotation.set(0, Math.PI / 2, 0.4);
  g.add(ring);
  const stand = cyl(0.01, 0.01, 0.08, toon(PAL.gold), 8);
  stand.position.y = 0.05;
  g.add(stand);
  const base = cyl(0.07, 0.09, 0.03, toon(PAL.woodDark), 16);
  base.position.y = 0.015;
  g.add(base);
  return g;
}

// a tiny ofrenda with N levels (for cards about ofrendas)
export function miniOfrenda({ levels = 3, white = false, photos = 1 } = {}) {
  const g = new THREE.Group();
  const frames = [];
  g.userData.frames = frames;
  const cloth = toon(white ? '#ffffff' : '#fffaf0');
  const trim = toon(white ? '#e8e8ff' : PAL.rosa);
  for (let i = 0; i < levels; i++) {
    const w = 0.5 - i * (0.36 / levels), d = 0.3 - i * (0.18 / levels);
    const tier = box(w, 0.08, d, cloth);
    tier.position.set(0, 0.04 + i * 0.08, -i * 0.04);
    g.add(tier);
    const band = box(w + 0.004, 0.015, d + 0.004, trim);
    band.position.set(0, 0.075 + i * 0.08, -i * 0.04);
    g.add(band);
    const top = 0.08 + i * 0.08;
    if (i === levels - 1) {
      const frame = PROP_INFO.foto.make({});
      frame.scale.setScalar(0.45);
      frame.position.set(0, top, -i * 0.04 - 0.02);
      g.add(frame);
      frames.push(frame);
      if (photos > 1) {
        for (const sx of [-1, 1]) {
          const f2 = PROP_INFO.foto.make({});
          f2.scale.setScalar(0.36);
          f2.position.set(sx * 0.12, top, -i * 0.04 + 0.02);
          f2.rotation.y = -sx * 0.25;
          g.add(f2);
          frames.push(f2);
        }
      }
    } else {
      for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
        const c = veladora({ lit: true, glass: i % 2 ? PAL.purple : PAL.red });
        c.scale.setScalar(0.6);
        c.position.set(x, top, -i * 0.04 + d / 2 - 0.05);
        g.add(c);
      }
      const p = panDeMuerto({});
      p.scale.setScalar(0.45);
      p.position.set(0, top, -i * 0.04 + d / 2 - 0.06);
      g.add(p);
    }
  }
  const spots = [];
  for (let i = 0; i < 18; i++) spots.push([-0.27 + (i % 2) * 0.54, 0.02 + Math.floor(i / 2) * 0.04, 0.12, 0.022]);
  g.add(marigolds(spots, { seed: 7 }));
  return g;
}

function papelito({ color = PAL.rosa } = {}) {
  const g = new THREE.Group();
  const colors = [color, PAL.marigold, PAL.turquoise];
  colors.forEach((c, i) => {
    const sheet = canvasPlane(papelCanvas(c, ['calavera', 'flor', 'mariposa'][i]), 0.2, 0.25, { side: THREE.DoubleSide, alphaTest: 0.4 });
    sheet.position.set((i - 1) * 0.21, 0.2 + (i === 1 ? 0.02 : 0), 0);
    sheet.rotation.z = (i - 1) * 0.06;
    g.add(sheet);
  });
  const cord = cyl(0.003, 0.003, 0.7, toon('#efe6d6'), 4);
  cord.rotation.z = Math.PI / 2;
  cord.position.y = 0.325;
  g.add(cord);
  return g;
}

function elementos() {
  // earth (bread), wind (papel), water (glass), fire (candle)
  const g = new THREE.Group();
  const p = panDeMuerto({});
  p.position.set(-0.18, 0, 0);
  g.add(p);
  const w = waterGlass();
  w.position.set(0.05, 0, 0.05);
  g.add(w);
  const c = veladora({ lit: true });
  c.position.set(0.2, 0, 0);
  g.add(c);
  const pp = papelito({});
  pp.scale.setScalar(0.6);
  pp.position.set(0, 0.12, -0.12);
  g.add(pp);
  return g;
}

function grabado() {
  // a Posada-style print of a dancing calavera, on a little easel
  const g = new THREE.Group();
  const cv = mkCanvas(256, 320);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f3ead2'; ctx.fillRect(0, 0, 256, 320);
  ctx.strokeStyle = '#1d1712'; ctx.fillStyle = '#1d1712'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  // hat
  ctx.beginPath(); ctx.ellipse(128, 70, 80, 16, -0.15, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(128, 52, 40, 22, -0.15, 0, TAU); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(100 + i * 20, 38 - i * 4, 7, 22, 0.6, 0, TAU); ctx.stroke(); }
  // skull
  ctx.fillStyle = '#f3ead2';
  ctx.beginPath(); ctx.ellipse(128, 112, 36, 40, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1d1712';
  ctx.beginPath(); ctx.ellipse(114, 108, 10, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(142, 108, 10, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(128, 120); ctx.lineTo(122, 132); ctx.lineTo(134, 132); ctx.fill();
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(128 + i * 6, 138); ctx.lineTo(128 + i * 6, 150); ctx.stroke(); }
  // body with ruffled dress
  ctx.beginPath(); ctx.moveTo(128, 152); ctx.lineTo(128, 210); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(128, 170); ctx.lineTo(80, 150); ctx.moveTo(128, 170); ctx.lineTo(180, 140); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(100, 300); ctx.quadraticCurveTo(128, 200, 156, 300); ctx.stroke();
  for (let y = 230; y < 300; y += 14) { ctx.beginPath(); ctx.moveTo(108 - (y - 230) * 0.2, y); ctx.lineTo(148 + (y - 230) * 0.2, y); ctx.stroke(); }
  ctx.font = "26px 'Lilita One', serif"; ctx.textAlign = 'center';
  ctx.fillText('CALAVERA', 128, 316);
  const pic = canvasPlane(cv, 0.24, 0.3);
  pic.position.set(0, 0.2, 0.01);
  pic.rotation.x = -0.1;
  g.add(pic);
  const board = box(0.27, 0.33, 0.01, toon(PAL.woodDark));
  board.position.set(0, 0.2, 0);
  board.rotation.x = -0.1;
  g.add(board);
  for (const x of [-0.1, 0.1]) {
    const leg = cyl(0.008, 0.008, 0.42, toon(PAL.wood), 6);
    leg.position.set(x, 0.19, -0.03);
    leg.rotation.x = -0.12;
    g.add(leg);
  }
  return g;
}

function pergamino() {
  const g = new THREE.Group();
  const cv = mkCanvas(256, 300);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff6dc'; ctx.fillRect(0, 0, 256, 300);
  ctx.fillStyle = PAL.purple; ctx.font = "30px 'Lilita One', sans-serif"; ctx.textAlign = 'center';
  ctx.fillText('Calaverita', 128, 44);
  ctx.fillStyle = '#3a2a20'; ctx.font = "bold 19px 'Nunito', sans-serif";
  const lines = ['La Flaca vino a buscar', 'a Chispa por la mañana,', 'pero la xolo, ¡qué lista!,', 'se escondió en la ventana.'];
  lines.forEach((l, i) => ctx.fillText(l, 128, 100 + i * 38));
  ctx.fillStyle = PAL.marigold;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(30 + i * 33, 270, 8, 0, TAU); ctx.fill(); }
  const paper = canvasPlane(cv, 0.26, 0.3, { side: THREE.DoubleSide });
  paper.position.set(0, 0.17, 0);
  paper.rotation.x = -0.15;
  g.add(paper);
  for (const y of [0.02, 0.32]) {
    const roll = cyl(0.016, 0.016, 0.3, toon('#f0dfb0'), 12);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, y, y > 0.1 ? -0.05 : 0.02);
    g.add(roll);
  }
  return g;
}

export function tumba({ lit = true } = {}) {
  const g = new THREE.Group();
  const stone = toon('#d9d2c5');
  const base = box(0.36, 0.06, 0.5, stone);
  base.position.set(0, 0.03, 0);
  g.add(base);
  const head = rbox(0.3, 0.32, 0.05, 0.05, stone);
  head.position.set(0, 0.2, -0.24);
  g.add(head);
  const cross = new THREE.Group();
  const v = box(0.03, 0.14, 0.02, toon('#8a7f72'));
  const h = box(0.09, 0.03, 0.02, toon('#8a7f72'));
  h.position.y = 0.03;
  cross.add(v, h);
  cross.position.set(0, 0.24, -0.21);
  g.add(cross);
  const spots = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    spots.push([Math.cos(a) * 0.16, 0.075, Math.sin(a) * 0.2 + 0.03, 0.025]);
  }
  for (let i = 0; i < 10; i++) spots.push([(Math.random() - 0.5) * 0.2, 0.07, (Math.random() - 0.5) * 0.3 + 0.03, 0.02]);
  g.add(marigolds(spots, { seed: 9 }));
  if (lit) {
    for (const [x, z] of [[-0.14, 0.2], [0.14, 0.2], [-0.14, -0.12], [0.14, -0.12]]) {
      const c = cirio({ lit: true, h: 0.14 });
      c.scale.setScalar(0.7);
      c.position.set(x, 0.06, z);
      g.add(c);
    }
  }
  return g;
}

function canoa() {
  const g = new THREE.Group();
  const water = mesh(new THREE.CircleGeometry(0.42, 32), toon('#24407a', { rim: 0 }), { cast: false });
  water.rotation.x = -Math.PI / 2;
  g.add(water);
  const hull = mesh(new THREE.SphereGeometry(0.1, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), toon('#6b4426', { side: THREE.DoubleSide }));
  hull.scale.set(3.2, 0.8, 1);
  hull.position.y = 0.06;
  g.add(hull);
  for (let i = 0; i < 3; i++) {
    const c = veladora({ lit: true, glass: [PAL.red, PAL.purple, PAL.marigold][i] });
    c.scale.setScalar(0.65);
    c.position.set(-0.15 + i * 0.15, 0.05, 0);
    g.add(c);
  }
  const fl = marigoldBunch(10, 0.06, 2, 0.028);
  fl.position.set(0.25, 0.06, 0);
  g.add(fl);
  return g;
}

function velasGrupo() {
  const g = new THREE.Group();
  const r = rng(13);
  for (let i = 0; i < 14; i++) {
    const c = i % 3 ? veladora({ lit: true, glass: [PAL.red, PAL.purple, '#f7e4c8'][i % 3] }) : cirio({ lit: true, h: 0.2 + r() * 0.1 });
    const a = r() * TAU, d = Math.sqrt(r()) * 0.25;
    c.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    c.scale.setScalar(0.8);
    g.add(c);
  }
  return g;
}

function tapete() {
  const g = new THREE.Group();
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e9d8b8'; ctx.fillRect(0, 0, 256, 256);
  const rings = [PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple, PAL.gold];
  rings.forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(128, 128, 120 - i * 22, 0, TAU); ctx.fill(); });
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.ellipse(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70, 14, 7, a, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath(); ctx.arc(128, 128, 14, 0, TAU); ctx.fill();
  const plane = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.5), toon('#ffffff', { map: tex(cv), rim: 0 }));
  plane.position.y = 0.01;
  plane.userData.noOutline = true;
  g.add(plane);
  const spots = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; spots.push([Math.cos(a) * 0.29, 0.02, Math.sin(a) * 0.29, 0.02]); }
  g.add(marigolds(spots, { seed: 5 }));
  return g;
}

function mucbipollo() {
  const g = new THREE.Group();
  const leaf = toon('#3f8f3c');
  const wrap = sphere(0.16, leaf, 20);
  wrap.scale.set(1, 0.4, 0.85);
  wrap.position.y = 0.06;
  g.add(wrap);
  const top = sphere(0.13, toon('#d9a441'), 18);
  top.scale.set(1, 0.32, 0.8);
  top.position.y = 0.1;
  g.add(top);
  const tie = mesh(new THREE.TorusGeometry(0.13, 0.006, 4, 24), toon('#c9b07a'));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.1;
  tie.scale.set(1, 0.85, 1);
  g.add(tie);
  const tray = cyl(0.22, 0.22, 0.02, toon('#8a6a45'), 24);
  tray.position.y = 0.01;
  g.add(tray);
  return g;
}

function barrilete() {
  const g = new THREE.Group();
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.translate(128, 128);
  const cols = [PAL.rosa, PAL.gold, PAL.turquoise, PAL.purple, PAL.lime, PAL.red, PAL.cobalt, PAL.marigold];
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 126, (i / 16) * TAU, ((i + 1) / 16) * TAU); ctx.fill();
  }
  for (let r = 100; r > 20; r -= 26) {
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
  const kite = mesh(new THREE.CircleGeometry(0.22, 32), toon('#ffffff', { map: tex(cv), side: THREE.DoubleSide, rim: 0 }), { cast: false });
  kite.position.y = 0.3;
  kite.userData.noOutline = true;
  g.add(kite);
  const rim = mesh(new THREE.TorusGeometry(0.22, 0.008, 6, 40), toon('#7a5a3a'));
  rim.position.y = 0.3;
  g.add(rim);
  for (let i = 0; i < 10; i++) {
    const tail = box(0.02, 0.02, 0.006, toon(cols[i % cols.length]));
    tail.position.set(Math.sin(i * 0.8) * 0.03, 0.06 - i * 0.012 + 0.02, 0);
    g.add(tail);
  }
  const pole = cyl(0.008, 0.008, 0.08, toon('#7a5a3a'), 6);
  pole.position.y = 0.04;
  g.add(pole);
  return g;
}

function guagua() {
  // a bread baby: swaddled dough with a painted face
  const g = new THREE.Group();
  const body = sphere(0.08, toon('#d38a42'), 18);
  body.scale.set(0.75, 1.4, 0.55);
  body.position.y = 0.11;
  g.add(body);
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f1c08a'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath(); ctx.arc(46, 58, 7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(82, 58, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(64, 74, 16, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.arc(36, 78, 8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(92, 78, 8, 0, TAU); ctx.fill();
  const face = mesh(new THREE.CircleGeometry(0.035, 20), toon('#ffffff', { map: tex(cv), rim: 0 }), { cast: false });
  face.position.set(0, 0.17, 0.045);
  face.userData.noOutline = true;
  g.add(face);
  const colors = [PAL.rosa, PAL.turquoise, PAL.gold];
  for (let i = 0; i < 3; i++) {
    const band = mesh(new THREE.TorusGeometry(0.058 - i * 0.004, 0.006, 4, 20), toon(colors[i]));
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 0.73, 1);
    band.position.y = 0.06 + i * 0.03;
    g.add(band);
  }
  const cup = lathe([[0, 0], [0.04, 0], [0.048, 0.09], [0, 0.09]], toon('#5e2a6e'));
  cup.position.set(0.13, 0, 0.02);
  g.add(cup);
  return g;
}

function mural() {
  // a community mural wall with calaveras and marigolds
  const g = new THREE.Group();
  const cv = mkCanvas(320, 200);
  const ctx = cv.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#2b2d7a'); grad.addColorStop(1, '#7b3fbf');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = '#ffc21a'; ctx.beginPath(); ctx.arc(260, 46, 26, 0, TAU); ctx.fill();
  for (const [x, c] of [[80, '#fffaf0'], [170, '#ffe1f0']]) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(x, 100, 34, 38, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.turquoise; ctx.beginPath(); ctx.arc(x - 13, 95, 10, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x + 13, 95, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.rosa; ctx.beginPath(); ctx.arc(x, 112, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1a14'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 7 - 1, 122, 3, 10);
  }
  ctx.fillStyle = PAL.marigold;
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(14 + i * 27, 180, 12, 0, TAU); ctx.fill(); }
  const pic = canvasPlane(cv, 0.5, 0.31);
  pic.position.set(0, 0.2, 0.031);
  g.add(pic);
  const wall = box(0.56, 0.38, 0.06, toon('#d9a07a'));
  wall.position.set(0, 0.19, 0);
  g.add(wall);
  return g;
}

function claqueta() {
  const g = new THREE.Group();
  const board = box(0.3, 0.2, 0.02, toon('#2a2a30'));
  board.position.set(0, 0.12, 0);
  board.rotation.x = -0.2;
  g.add(board);
  const top = new THREE.Group();
  const stick = box(0.3, 0.045, 0.02, toon('#2a2a30'));
  top.add(stick);
  for (let i = 0; i < 5; i++) {
    const stripe = box(0.03, 0.046, 0.021, toon('#f2f2f2'));
    stripe.position.x = -0.12 + i * 0.06;
    stripe.rotation.z = 0.5;
    top.add(stripe);
  }
  top.position.set(0, 0.25, 0.03);
  top.rotation.set(-0.2, 0, 0.3);
  g.add(top);
  const fl = marigoldBunch(8, 0.05, 6, 0.028);
  fl.position.set(0.17, 0.0, 0.08);
  g.add(fl);
  return g;
}

function corazon() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.1);
  shape.bezierCurveTo(-0.16, 0.0, -0.08, 0.13, 0, 0.05);
  shape.bezierCurveTo(0.08, 0.13, 0.16, 0.0, 0, -0.1);
  const heart = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 4 }), toon(PAL.rosa));
  heart.position.set(0, 0.2, 0);
  g.add(heart);
  const spots = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; spots.push([Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.12, 0.022]); }
  g.add(marigolds(spots, { seed: 4 }));
  return g;
}

export const CARD_PROPS = {
  calendario, raices, rio, globo, 'mini-ofrenda': miniOfrenda, papelito, elementos, grabado, pergamino,
  tumba, canoa, 'velas-grupo': velasGrupo, tapete, mucbipollo, barrilete, guagua, mural, claqueta, corazon,
  catrina: () => catrinaFigure(), skull: () => sugarSkull({}), copal: (o) => copalBurner(o),
};
