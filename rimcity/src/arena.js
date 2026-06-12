// The Garden of RIM CITY: parquet floor, glass boards, a center-hung
// jumbotron, four sides of bouncing crowd, ad boards, banners, spotlights.
// Court length runs along X; rims at x = ±12.7, sidelines at z = ±7.62.
import * as THREE from 'three';
import { mkCanvas, tex, shade } from './util.js';

export const COURT = {
  HALF_LEN: 14.325,   // baseline
  HALF_WID: 7.62,     // sideline
  RIM_X: 12.7,        // rim center distance from half court
  RIM_Y: 3.05,
  RIM_R: 0.225,
  BOARD_X: 13.12,     // backboard plane
  BOARD_HALF_W: 0.915,
  BOARD_BOT: 2.92,
  BOARD_TOP: 3.97,
  THREE_R: 6.75,      // three-point arc radius from the rim
  FLOOR_HALF_LEN: 17.4,
  FLOOR_HALF_WID: 10.2,
};

// ------------------------------------------------------------------ floor
function courtCanvas(home, away) {
  const W = 2048, H = 1200;
  const cv = mkCanvas(W, H);
  const ctx = cv.getContext('2d');
  const sx = W / (COURT.FLOOR_HALF_LEN * 2), sy = H / (COURT.FLOOR_HALF_WID * 2);
  const X = (m) => (m + COURT.FLOOR_HALF_LEN) * sx;
  const Y = (m) => (m + COURT.FLOOR_HALF_WID) * sy;

  // parquet: alternating-grain squares, Boston style
  const tile = 1.31;
  let row = 0;
  for (let ty = -COURT.FLOOR_HALF_WID; ty < COURT.FLOOR_HALF_WID; ty += tile, row++) {
    let col = 0;
    for (let tx = -COURT.FLOOR_HALF_LEN; tx < COURT.FLOOR_HALF_LEN; tx += tile, col++) {
      const light = (row + col) % 2 === 0;
      const base = light ? '#c08a4e' : '#a8743c';
      ctx.fillStyle = shade(base, Math.random() * 14 - 7);
      ctx.fillRect(X(tx), Y(ty), tile * sx + 1, tile * sy + 1);
      // grain
      ctx.strokeStyle = 'rgba(70,40,16,0.20)';
      ctx.lineWidth = 1.5;
      const n = 5;
      for (let i = 1; i < n; i++) {
        ctx.beginPath();
        if (light) {
          ctx.moveTo(X(tx) + (i / n) * tile * sx, Y(ty));
          ctx.lineTo(X(tx) + (i / n) * tile * sx, Y(ty + tile));
        } else {
          ctx.moveTo(X(tx), Y(ty) + (i / n) * tile * sy);
          ctx.lineTo(X(tx + tile), Y(ty) + (i / n) * tile * sy);
        }
        ctx.stroke();
      }
    }
  }
  // soft sheen down the middle
  const sheen = ctx.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0, 'rgba(255,240,210,0.05)');
  sheen.addColorStop(0.5, 'rgba(255,250,230,0.16)');
  sheen.addColorStop(1, 'rgba(255,240,210,0.05)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  // apron stain beyond the lines
  ctx.fillStyle = 'rgba(60,30,10,0.28)';
  ctx.fillRect(0, 0, X(-COURT.HALF_LEN), H);
  ctx.fillRect(X(COURT.HALF_LEN), 0, W, H);
  ctx.fillRect(0, 0, W, Y(-COURT.HALF_WID));
  ctx.fillRect(0, Y(COURT.HALF_WID), W, H);

  const line = (w = 5) => { ctx.strokeStyle = '#f4f2ec'; ctx.lineWidth = w; };

  // keys (painted in each crew's color), free-throw circles
  const KEY_L = 5.8, KEY_HW = 2.45;
  const paintKey = (dir, color) => {
    const x0 = dir * COURT.HALF_LEN, x1 = dir * (COURT.HALF_LEN - KEY_L);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(Math.min(X(x0), X(x1)), Y(-KEY_HW), Math.abs(X(x1) - X(x0)), (KEY_HW * 2) * sy);
    ctx.globalAlpha = 1;
    line();
    ctx.strokeRect(Math.min(X(x0), X(x1)), Y(-KEY_HW), Math.abs(X(x1) - X(x0)), (KEY_HW * 2) * sy);
    // free-throw circle
    ctx.beginPath();
    ctx.arc(X(x1), Y(0), 1.8 * sx, 0, Math.PI * 2);
    ctx.stroke();
    // restricted arc under the rim
    ctx.beginPath();
    ctx.arc(X(dir * COURT.RIM_X), Y(0), 1.25 * sx, 0, Math.PI * 2);
    ctx.stroke();
  };
  paintKey(-1, home.colors.primary);
  paintKey(1, away.colors.primary);

  // three-point line: corner straights + arc
  const threeArc = (dir) => {
    const rimX = dir * COURT.RIM_X;
    const cornerZ = 6.55;
    const dx = Math.sqrt(Math.max(0, COURT.THREE_R ** 2 - cornerZ ** 2));
    line(6);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(X(dir * COURT.HALF_LEN), Y(s * cornerZ));
      ctx.lineTo(X(rimX - dir * dx), Y(s * cornerZ));
      ctx.stroke();
    }
    ctx.beginPath();
    const a0 = Math.atan2(cornerZ, -dir * dx);
    const a1 = Math.atan2(-cornerZ, -dir * dx);
    // arc in canvas coords (y flipped is fine — symmetric)
    ctx.arc(X(rimX), Y(0), COURT.THREE_R * sx, a0, a1, dir < 0 ? true : false);
    ctx.stroke();
  };
  threeArc(-1);
  threeArc(1);

  // boundary + half line + center circles
  line(6);
  ctx.strokeRect(X(-COURT.HALF_LEN), Y(-COURT.HALF_WID), COURT.HALF_LEN * 2 * sx, COURT.HALF_WID * 2 * sy);
  ctx.beginPath(); ctx.moveTo(X(0), Y(-COURT.HALF_WID)); ctx.lineTo(X(0), Y(COURT.HALF_WID)); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(0), Y(0), 1.8 * sx, 0, Math.PI * 2); ctx.stroke();

  // center logo
  ctx.save();
  ctx.translate(X(0), Y(0));
  ctx.fillStyle = 'rgba(20,16,12,0.78)';
  ctx.beginPath(); ctx.arc(0, 0, 1.62 * sx, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2b705';
  ctx.font = `900 ${1.05 * sx}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RC', 0, 4);
  ctx.restore();

  // sideline wordmarks
  ctx.fillStyle = 'rgba(20,16,12,0.66)';
  ctx.font = `900 ${0.86 * sy}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(X(-7), Y(COURT.HALF_WID - 0.62));
  ctx.fillText('RIM CITY', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(X(7), Y(-COURT.HALF_WID + 0.95));
  ctx.rotate(Math.PI);
  ctx.fillText('RIM CITY', 0, 0);
  ctx.restore();
  // baseline crew names
  const baseName = (dir, crew) => {
    ctx.save();
    ctx.translate(X(dir * (COURT.HALF_LEN + 1.45)), Y(0));
    ctx.rotate(dir < 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = crew.colors.primary;
    ctx.font = `900 ${1.5 * sy}px Impact, 'Arial Black', sans-serif`;
    ctx.strokeStyle = '#f4f2ec';
    ctx.lineWidth = 5;
    ctx.strokeText(crew.name, 0, 0);
    ctx.fillText(crew.name, 0, 0);
    ctx.restore();
  };
  baseName(-1, home);
  baseName(1, away);
  return cv;
}

// ------------------------------------------------------------------ hoops
function netCanvas() {
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(245,245,240,0.95)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i++) {
    const x = i * 16 + 8;
    ctx.beginPath(); ctx.moveTo(x - 14, 0); ctx.lineTo(x + 14, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, 0); ctx.lineTo(x - 14, 128); ctx.stroke();
  }
  return cv;
}

function buildHoop(dir) {
  const g = new THREE.Group();
  const steel = new THREE.MeshPhongMaterial({ color: '#3a3d44', shininess: 40 });
  const padM = new THREE.MeshPhongMaterial({ color: '#15161c', shininess: 8 });

  // stanchion behind the baseline, arm reaching in to the board
  const baseX = dir * (COURT.HALF_LEN + 1.7);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.15), padM);
  base.position.set(baseX, 0.28, 0);
  g.add(base);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), steel);
  post.position.set(baseX, 2.0, 0);
  g.add(post);
  const postPad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.7, 10), padM);
  postPad.position.set(baseX, 1.0, 0);
  g.add(postPad);
  const armLen = Math.abs(baseX) - Math.abs(COURT.BOARD_X) + 0.1;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.22, 0.22), steel);
  arm.position.set(baseX - dir * armLen / 2, 3.72, 0);
  arm.rotation.z = dir * 0.06;
  g.add(arm);

  // backboard: glass + frame + shooter square
  const boardC = (COURT.BOARD_BOT + COURT.BOARD_TOP) / 2;
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, COURT.BOARD_TOP - COURT.BOARD_BOT, COURT.BOARD_HALF_W * 2),
    new THREE.MeshPhongMaterial({ color: '#cfe0ea', transparent: true, opacity: 0.34, shininess: 120, specular: '#ffffff' })
  );
  glass.position.set(dir * COURT.BOARD_X, boardC, 0);
  g.add(glass);
  const frameM = new THREE.MeshPhongMaterial({ color: '#e8e6e0', shininess: 30 });
  for (const [h, w, y, z] of [
    [0.07, COURT.BOARD_HALF_W * 2 + 0.07, COURT.BOARD_TOP, 0],
    [0.07, COURT.BOARD_HALF_W * 2 + 0.07, COURT.BOARD_BOT, 0],
    [COURT.BOARD_TOP - COURT.BOARD_BOT, 0.07, boardC, COURT.BOARD_HALF_W],
    [COURT.BOARD_TOP - COURT.BOARD_BOT, 0.07, boardC, -COURT.BOARD_HALF_W],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), frameM);
    bar.position.set(dir * COURT.BOARD_X, y, z);
    g.add(bar);
  }
  // shooter square
  const sq = mkCanvas(128, 96);
  {
    const c = sq.getContext('2d');
    c.clearRect(0, 0, 128, 96);
    c.strokeStyle = '#e85d20';
    c.lineWidth = 10;
    c.strokeRect(24, 28, 80, 56);
  }
  const sqMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.59, 0.45),
    new THREE.MeshBasicMaterial({ map: tex(sq), transparent: true })
  );
  sqMesh.position.set(dir * (COURT.BOARD_X - 0.035), 3.32, 0);
  sqMesh.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  g.add(sqMesh);

  // rim group (shakeable): ring + net + board bracket
  const rimGroup = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(COURT.RIM_R, 0.018, 8, 24),
    new THREE.MeshPhongMaterial({ color: '#e8542a', shininess: 70, specular: '#883311' })
  );
  rim.rotation.x = Math.PI / 2;
  rimGroup.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, 0.10), steel);
  bracket.position.set(dir * (COURT.RIM_R + 0.09), -0.02, 0);
  rimGroup.add(bracket);
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.13, 0.42, 12, 1, true),
    new THREE.MeshBasicMaterial({ map: tex(netCanvas()), transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  net.position.y = -0.24;
  rimGroup.add(net);
  rimGroup.position.set(dir * COURT.RIM_X, COURT.RIM_Y, 0);
  g.add(rimGroup);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  glass.castShadow = false;
  net.castShadow = false;

  return {
    group: g,
    rimGroup,
    net,
    glass,
    dir,
    center: new THREE.Vector3(dir * COURT.RIM_X, COURT.RIM_Y, 0),
    shake: 0,
    netKick: 0,
  };
}

// ------------------------------------------------------------------ crowd
function buildStandsAndCrowd(scene, home, away) {
  const group = new THREE.Group();
  const riser = new THREE.MeshPhongMaterial({ color: '#23252e', shininess: 4 });
  const seats = [];

  const addBank = (side) => {
    // side: 0/1 = ±z sidelines, 2/3 = ±x baselines
    const rows = side < 2 ? 9 : 7;
    for (let r = 0; r < rows; r++) {
      const y = 0.55 + r * 0.62;
      const d = (side < 2 ? 9.6 : 18.6) + r * 1.05;
      const len = side < 2 ? 30 + r * 1.4 : 15 + r * 1.4;
      const step = new THREE.Mesh(new THREE.BoxGeometry(side < 2 ? len : 1.05, 0.62, side < 2 ? 1.05 : len), riser);
      const sgn = side % 2 === 0 ? 1 : -1;
      if (side < 2) step.position.set(0, y - 0.31, sgn * d);
      else step.position.set(sgn * d, y - 0.31, 0);
      step.receiveShadow = true;
      group.add(step);
      const count = Math.floor(len / 0.78);
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.12) continue; // empty seats
        const along = -len / 2 + 0.4 + i * 0.78 + Math.random() * 0.18;
        const px = side < 2 ? along : sgn * d;
        const pz = side < 2 ? sgn * d : along;
        seats.push({ x: px, y: y + 0.18, z: pz, phase: Math.random() * Math.PI * 2, jump: 0.5 + Math.random() });
      }
    }
  };
  addBank(0); addBank(1); addBank(2); addBank(3);

  const n = seats.length;
  const bodyGeo = new THREE.BoxGeometry(0.34, 0.46, 0.26);
  const headGeo = new THREE.SphereGeometry(0.11, 6, 5);
  const bodyMat = new THREE.MeshLambertMaterial();
  const headMat = new THREE.MeshLambertMaterial();
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
  const heads = new THREE.InstancedMesh(headGeo, headMat, n);
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const shirt = [
    home.colors.primary, home.colors.primary, home.colors.secondary,
    away.colors.primary, '#d8d5cc', '#3a4254', '#23242a', '#7a8290', '#5e3a2c',
  ];
  const skin = ['#8d5a3b', '#6b4226', '#c68863', '#a06a42', '#5a3620', '#d8a87f', '#e0b088'];
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    bodies.setColorAt(i, col.set(shirt[(Math.random() * shirt.length) | 0]));
    heads.setColorAt(i, col.set(skin[(Math.random() * skin.length) | 0]));
  }
  const m4 = new THREE.Matrix4();
  const update = (t, excite) => {
    const amp = 0.05 + excite * 0.30;
    for (let i = 0; i < n; i++) {
      const s = seats[i];
      const bob = Math.max(0, Math.sin(t * (1.6 + s.jump) + s.phase)) * amp * s.jump;
      m4.makeTranslation(s.x, s.y + bob, s.z);
      bodies.setMatrixAt(i, m4);
      m4.makeTranslation(s.x, s.y + 0.38 + bob, s.z);
      heads.setMatrixAt(i, m4);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };
  update(0, 0);
  group.add(bodies, heads);
  scene.add(group);
  return { group, update };
}

// ------------------------------------------------------------------ jumbotron
function buildJumbotron(scene) {
  const g = new THREE.Group();
  const cv = mkCanvas(512, 288);
  const screenTex = tex(cv);
  const draw = (s = {}) => {
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#07080e';
    ctx.fillRect(0, 0, 512, 288);
    ctx.strokeStyle = '#2a2f48';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 276);
    ctx.textAlign = 'center';
    if (s.marquee) {
      ctx.fillStyle = s.marqueeColor || '#ff5a1f';
      ctx.font = `900 64px Impact, 'Arial Black', sans-serif`;
      ctx.fillText(s.marquee, 256, 120);
      ctx.fillStyle = '#f4f2ec';
      ctx.font = `700 30px 'Arial Narrow', sans-serif`;
      if (s.sub) ctx.fillText(s.sub, 256, 175);
    } else {
      ctx.fillStyle = '#f2b705';
      ctx.font = `900 38px Impact, 'Arial Black', sans-serif`;
      ctx.fillText('RIM CITY', 256, 52);
      ctx.fillStyle = '#f4f2ec';
      ctx.font = `900 58px 'Courier New', monospace`;
      ctx.fillText(`${s.abbrA ?? 'AWY'} ${s.away ?? 0}   ${s.home ?? 0} ${s.abbrH ?? 'HOM'}`, 256, 140);
      ctx.font = `900 44px 'Courier New', monospace`;
      ctx.fillStyle = '#7db9e8';
      ctx.fillText(`${s.qtr ?? 'Q1'}  ${s.clock ?? '2:30'}`, 256, 205);
      ctx.fillStyle = (s.shot ?? 14) <= 5 ? '#ff4040' : '#9aa0a6';
      ctx.font = `900 40px 'Courier New', monospace`;
      ctx.fillText(`SHOT ${s.shot ?? 14}`, 256, 258);
    }
    screenTex.needsUpdate = true;
  };
  draw();
  const boxM = new THREE.MeshPhongMaterial({ color: '#15161c', shininess: 20 });
  const core = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.8, 4.6), boxM);
  g.add(core);
  const faceM = new THREE.MeshBasicMaterial({ map: screenTex });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.42), faceM);
    const a = (i * Math.PI) / 2;
    f.position.set(Math.sin(a) * 2.32, 0, Math.cos(a) * 2.32);
    f.rotation.y = a;
    g.add(f);
  }
  const ring = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.4, 5.0), new THREE.MeshPhongMaterial({ color: '#f2b705', emissive: '#5a4002', shininess: 60 }));
  ring.position.y = -1.6;
  g.add(ring);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 6), boxM);
  cable.position.y = 3.6;
  g.add(cable);
  g.position.set(0, 9.6, 0);
  scene.add(g);
  return { group: g, draw };
}

// ------------------------------------------------------------------ extras
function adBoardCanvas(label, bg, fg) {
  const cv = mkCanvas(512, 64);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = fg;
  ctx.font = `900 40px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 34);
  return cv;
}

function addAdBoards(scene) {
  const ads = [
    ['EB SPORTS', '#101418', '#f2b705'],
    ['PLANK COLA', '#7a1620', '#f4f2ec'],
    ['LOAM SOIL CO.', '#2c3e1c', '#e8d9a0'],
    ['VARSITY 27', '#14306e', '#f2b705'],
    ['RC ENERGY', '#0e7c7b', '#f25c9b'],
    ['AIR APPARENT', '#17181c', '#7db9e8'],
  ];
  let i = 0;
  const mk = (x, z, ry, len = 5.6) => {
    const [label, bg, fg] = ads[i++ % ads.length];
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.78, 0.12),
      new THREE.MeshPhongMaterial({ map: tex(adBoardCanvas(label, bg, fg)), shininess: 30 })
    );
    m.position.set(x, 0.42, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  // far sideline (faces the broadcast camera)
  for (const x of [-11.5, -5.8, 0, 5.8, 11.5]) mk(x, -8.6, 0);
  // baselines, angled in
  mk(-15.6, -4.2, Math.PI / 2 - 0.18, 5);
  mk(-15.6, 4.2, Math.PI / 2 + 0.18, 5);
  mk(15.6, -4.2, -Math.PI / 2 + 0.18, 5);
  mk(15.6, 4.2, -Math.PI / 2 - 0.18, 5);
}

function bannerCanvas(text, sub, bg, fg) {
  const cv = mkCanvas(256, 384);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 364);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = `900 44px Impact, 'Arial Black', sans-serif`;
  const words = text.split(' ');
  words.forEach((w, i) => ctx.fillText(w, 128, 90 + i * 52));
  ctx.font = `700 30px 'Arial Narrow', sans-serif`;
  ctx.fillText(sub, 128, 330);
  return cv;
}

// ------------------------------------------------------------------ build
export function buildArena(scene, home, away) {
  scene.background = new THREE.Color('#0a0b12');
  scene.fog = new THREE.Fog('#0a0b12', 38, 78);

  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.FLOOR_HALF_LEN * 2, COURT.FLOOR_HALF_WID * 2),
    new THREE.MeshPhongMaterial({ map: tex(courtCanvas(home, away)), shininess: 70, specular: '#5a4a33' })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // surrounding concrete
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 52),
    new THREE.MeshPhongMaterial({ color: '#17181f', shininess: 6 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  scene.add(apron);

  // hoops
  const hoopA = buildHoop(-1);
  const hoopB = buildHoop(1);
  scene.add(hoopA.group, hoopB.group);

  // stands + crowd + jumbotron + ads
  const crowd = buildStandsAndCrowd(scene, home, away);
  const jumbo = buildJumbotron(scene);
  addAdBoards(scene);

  // arena shell: dark walls with banners
  const wallM = new THREE.MeshPhongMaterial({ color: '#101220', shininess: 4, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(70, 30, 52), wallM);
  shell.position.y = 14.8;
  scene.add(shell);
  const banners = [
    ['RIM CITY OPEN', 'OAKLAND QUAKE · 24'],
    ['KINGS OF THE RIM', 'CHICAGO WIND · 23'],
    ['RIM CITY OPEN', 'NEW YORK EMPIRE · 22'],
    ['INVITATIONAL', 'SEATTLE RAIN · 21'],
  ];
  banners.forEach(([t, s], i) => {
    const crew = [home, away][i % 2];
    const b = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 3.9),
      new THREE.MeshPhongMaterial({ map: tex(bannerCanvas(t, s, crew.colors.primary, '#f4f2ec')) })
    );
    b.position.set(-12 + i * 8, 11.5, -25.4);
    scene.add(b);
  });

  // lighting: hemisphere + shadow key + warm fills + visible fixtures
  scene.add(new THREE.HemisphereLight('#cdd6ee', '#241a10', 0.85));
  const key = new THREE.DirectionalLight('#fff2dc', 2.4);
  key.position.set(10, 22, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rimL = new THREE.DirectionalLight('#7a9aff', 0.7);
  rimL.position.set(-12, 14, -16);
  scene.add(rimL);
  // light truss with glowing cans
  const trussM = new THREE.MeshPhongMaterial({ color: '#1c1e28', shininess: 20 });
  for (const z of [-6, 6]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 0.5), trussM);
    beam.position.set(0, 13.4, z);
    scene.add(beam);
    for (let x = -16; x <= 16; x += 4) {
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 0.6, 10),
        new THREE.MeshPhongMaterial({ color: '#202230', emissive: '#fff3d8', emissiveIntensity: 0.9 })
      );
      can.position.set(x, 13.0, z);
      scene.add(can);
    }
  }

  return { floor, hoops: [hoopA, hoopB], crowd, jumbo, key };
}

/** Per-frame arena life: rim shake decay, net flutter, crowd bob. */
export function updateArena(arena, t, dt, excite) {
  for (const h of arena.hoops) {
    if (h.shake > 0.001) {
      h.shake *= Math.pow(0.0005, dt);
      h.rimGroup.position.y = COURT.RIM_Y + Math.sin(t * 55) * 0.02 * h.shake;
      h.rimGroup.rotation.z = Math.sin(t * 47) * 0.05 * h.shake * h.dir;
    } else {
      h.rimGroup.position.y = COURT.RIM_Y;
      h.rimGroup.rotation.z = 0;
    }
    if (h.netKick > 0.001) {
      h.netKick *= Math.pow(0.002, dt);
      h.net.scale.set(1 + Math.sin(t * 30) * 0.16 * h.netKick, 1 + 0.3 * h.netKick, 1 + Math.cos(t * 26) * 0.16 * h.netKick);
    } else {
      h.net.scale.set(1, 1, 1);
    }
  }
  arena.crowd.update(t, excite);
}
