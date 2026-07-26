// Friday night: the field, grandstands, animated crowd, light towers,
// scoreboard, goalposts, and the town around it. Field length runs along X;
// goal lines at x = ±50, sidelines at z = ±26.67.
import * as THREE from 'three';
import {
  mkCanvas, tex, fieldCanvas, grassTileCanvas, concreteCanvas, skyCanvas,
  daySkyCanvas, bannerCanvas, shade, contrastText,
} from './textures.js';
import { buildSchool } from './school.js';

function glowSprite(color = '#fff8e0', size = 26) {
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color + 'cc');
  g.addColorStop(1, '#00000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mat = new THREE.SpriteMaterial({ map: tex(cv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

function lightTower(x, z) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshPhongMaterial({ color: '#6a6f76', shininess: 30 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 24, 8), poleMat);
  pole.position.y = 12;
  g.add(pole);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.6, 0.5), new THREE.MeshPhongMaterial({ color: '#3a3e44' }));
  bank.position.y = 24.6;
  g.add(bank);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 5; i++) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), lampMat);
      lamp.position.set(-2.2 + i * 1.1, 24.1 + r * 1.15, 0.28);
      g.add(lamp);
    }
  }
  const glow = glowSprite('#fff6d8', 18);
  glow.position.y = 24.6;
  g.add(glow);
  g.position.set(x, 0, z);
  // aim the bank at midfield
  bank.lookAt(new THREE.Vector3(-x * 0.5, -24, -z * 0.5));
  g.userData.bankY = 24.6;
  return g;
}

function goalpost(x) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: '#e8c422', shininess: 50 });
  const dir = Math.sign(x);
  const crossY = 3.88;
  // gooseneck: vertical base behind the end line, one clean slanted arm up
  // to the crossbar center
  const baseX = dir * 1.5;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.1, 10), mat);
  base.position.set(baseX, 1.05, 0);
  g.add(base);
  const armLen = Math.hypot(baseX, crossY - 2.1);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, armLen, 10), mat);
  arm.position.set(baseX / 2, (2.1 + crossY) / 2, 0);
  arm.rotation.z = Math.atan2(baseX, crossY - 2.1);
  g.add(arm);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7.78, 8), mat);
  cross.rotation.x = Math.PI / 2;
  cross.position.set(0, crossY, 0);
  g.add(cross);
  for (const s of [-1, 1]) {
    const upr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 6.7, 8), mat);
    upr.position.set(0, crossY + 3.35, s * 3.89);
    g.add(upr);
    const flagCv = mkCanvas(32, 24);
    const fctx = flagCv.getContext('2d');
    fctx.fillStyle = '#cc4422';
    fctx.fillRect(0, 0, 32, 24);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ map: tex(flagCv), side: THREE.DoubleSide }));
    flag.position.set(0, crossY + 6.7, s * 3.89 + (s > 0 ? 0.3 : -0.3));
    g.add(flag);
  }
  // pad
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.9, 10), new THREE.MeshPhongMaterial({ color: '#2255aa' }));
  pad.position.set(dir * 1.5, 0.95, 0);
  g.add(pad);
  g.position.x = x;
  return g;
}

function treeRing() {
  const g = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
  const crownGeo = new THREE.ConeGeometry(2.6, 6.5, 8);
  const trunkMat = new THREE.MeshPhongMaterial({ color: '#3a2a1c' });
  const crownMat = new THREE.MeshPhongMaterial({ color: '#11281a' });
  const n = 56;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
    const r = 105 + Math.random() * 40;
    const x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r;
    const s = 0.8 + Math.random() * 1.3;
    m4.compose(new THREE.Vector3(x, 1.5 * s, z), q, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, (3 + 3.2) * s, z), q, new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(i, m4);
  }
  g.add(trunks, crowns);
  return g;
}

function waterTower(town) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: '#9fb6bd', shininess: 25 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 16, 6), mat);
    leg.position.set(Math.cos(a) * 3.2, 8, Math.sin(a) * 3.2);
    leg.rotation.z = Math.cos(a) * 0.12;
    leg.rotation.x = -Math.sin(a) * 0.12;
    g.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 5, 14), mat);
  tank.position.y = 18.5;
  g.add(tank);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.4, 14), mat);
  cap.position.y = 22.2;
  g.add(cap);
  const cv = bannerCanvas(town, '#9fb6bd', '#1d3557', 512, 96);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.4), new THREE.MeshBasicMaterial({ map: tex(cv) }));
  label.position.set(0, 18.5, 4.65);
  g.add(label);
  return g;
}

function scoreboardCanvas() { return mkCanvas(1024, 560); }

function drawScoreboard(cv, d) {
  const ctx = cv.getContext('2d');
  const led = (s, x, y, size, color = '#ffb820', align = 'center') => {
    ctx.font = `700 ${size}px 'Courier New', monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
  };
  ctx.fillStyle = '#101116';
  ctx.fillRect(0, 0, 1024, 560);
  // header
  ctx.fillStyle = d.headerColor;
  ctx.fillRect(0, 0, 1024, 86);
  ctx.font = `900 56px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = d.headerText;
  ctx.fillText(`${d.stadium.toUpperCase()}`, 512, 60);
  ctx.strokeStyle = '#2c2e36';
  ctx.lineWidth = 4;
  for (const [x, y, w, h] of [[28, 116, 300, 190], [696, 116, 300, 190], [368, 116, 288, 190]]) {
    ctx.strokeRect(x, y, w, h);
  }
  ctx.font = `700 40px Arial, sans-serif`;
  ctx.fillStyle = '#d8d9de';
  ctx.fillText('HOME', 178, 148);
  ctx.fillText('GUEST', 846, 148);
  ctx.fillText('TIME', 512, 148);
  led(String(d.home).padStart(2, '0'), 178, 238, 110);
  led(String(d.away).padStart(2, '0'), 846, 238, 110);
  led(d.clock, 512, 238, 86, '#ff4838');
  // bottom row
  ctx.fillStyle = '#d8d9de';
  ctx.font = `700 34px Arial, sans-serif`;
  ctx.fillText('DOWN', 150, 360);
  ctx.fillText('TO GO', 400, 360);
  ctx.fillText('BALL ON', 640, 360);
  ctx.fillText('QTR', 880, 360);
  led(d.down, 150, 428, 72);
  led(d.toGo, 400, 428, 72);
  led(d.ballOn, 640, 428, 72);
  led(d.qtr, 880, 428, 72);
  // sponsor strip
  ctx.fillStyle = '#e8e4d6';
  ctx.fillRect(20, 488, 984, 56);
  ctx.font = `700 34px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillStyle = '#7a1d22';
  ctx.fillText(`BIG MIKE'S BAR-B-QUE  ·  GOOD LUCK ${d.mascot.toUpperCase()}!  ·  CORNER OF 5TH & MAIN`, 512, 524);
}

function buildScoreboard(school) {
  const g = new THREE.Group();
  const cv = scoreboardCanvas();
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: texture });
  const postMat = new THREE.MeshPhongMaterial({ color: '#4a4e55' });
  for (const z of [-4.2, 4.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7.5, 8), postMat);
    post.position.set(0, 3.75, z);
    g.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 11.4), postMat);
  board.position.y = 9.5;
  g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.9), mat);
  face.rotation.y = -Math.PI / 2;
  face.position.set(-0.28, 9.5, 0);
  g.add(face);
  const api = {
    group: g,
    draw(d) {
      drawScoreboard(cv, d);
      texture.needsUpdate = true;
    },
  };
  return api;
}

function buildStands(side, school) {
  // side: +1 home (z>0), -1 visitor
  const g = new THREE.Group();
  const rows = side > 0 ? 13 : 9;
  const width = side > 0 ? 76 : 64;
  const z0 = 31.5;
  const stepMat = new THREE.MeshPhongMaterial({ map: tex(concreteCanvas('#a6a49c'), { repeat: [22, 1] }), shininess: 8 });
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, 1.05), stepMat);
    step.position.set(0, 0.7 + r * 0.55, side * (z0 + r * 1.0));
    step.receiveShadow = true;
    g.add(step);
    seats.push({ y: 0.7 + r * 0.55 + 0.275, z: side * (z0 + r * 1.0) });
  }
  // base wall
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 1.0, 0.3), stepMat);
  wall.position.set(0, 0.5, side * (z0 - 0.6));
  g.add(wall);
  // rails
  const railMat = new THREE.MeshPhongMaterial({ color: '#c4c8ce', shininess: 60 });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, width, 6), railMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 1.45, side * (z0 - 0.62));
  g.add(rail);
  // banners on the front wall
  const texts = [`GO ${school.mascot.toUpperCase()}!`, `${school.name.toUpperCase()} PRIDE`, `SENIORS '04`];
  texts.forEach((t, i) => {
    const cvB = bannerCanvas(t, school.colors.primary, contrastText(school.colors.primary), 768, 96);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshBasicMaterial({ map: tex(cvB) }));
    b.position.set(-26 + i * 26, 0.85, side * (z0 - 0.78));
    if (side > 0) b.rotation.y = Math.PI;
    g.add(b);
  });

  // press box on home side
  if (side > 0) {
    const pbz = z0 + rows * 1.0 + 0.5;
    const pb = new THREE.Mesh(new THREE.BoxGeometry(20, 3.2, 3.4), new THREE.MeshPhongMaterial({ color: shade(school.colors.primary, -22), shininess: 16 }));
    pb.position.set(0, 0.7 + rows * 0.55 + 1.6, side * pbz);
    g.add(pb);
    const winStrip = new THREE.Mesh(new THREE.BoxGeometry(18.6, 1.1, 0.1), new THREE.MeshBasicMaterial({ color: '#ffe9b0' }));
    winStrip.position.set(0, pb.position.y + 0.35, side * (pbz - 1.78));
    g.add(winStrip);
    const cvP = bannerCanvas(`${school.name.toUpperCase()} ${school.mascot.toUpperCase()}`, school.colors.secondary, contrastText(school.colors.secondary), 1024, 110);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.5), new THREE.MeshBasicMaterial({ map: tex(cvP) }));
    ban.position.set(0, pb.position.y - 2.0, side * (pbz - 1.75));
    if (side > 0) ban.rotation.y = Math.PI;
    g.add(ban);
  }
  return { group: g, seats, width };
}

function buildCrowd(stands, school) {
  const fans = [];
  for (const stand of stands) {
    for (const seat of stand.seats) {
      for (let x = -stand.width / 2 + 1; x < stand.width / 2 - 1; x += 0.95) {
        if (Math.random() < 0.32) continue;
        fans.push({ x: x + Math.random() * 0.3, y: seat.y, z: seat.z, phase: Math.random() * Math.PI * 2, amp: 0.5 + Math.random() });
      }
    }
  }
  const n = fans.length;
  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.34, 3, 6);
  const headGeo = new THREE.SphereGeometry(0.1, 6, 5);
  const bodyMat = new THREE.MeshLambertMaterial();
  const headMat = new THREE.MeshLambertMaterial();
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
  const heads = new THREE.InstancedMesh(headGeo, headMat, n);
  const palette = [
    school.colors.primary, school.colors.primary, school.colors.secondary,
    shade(school.colors.primary, 26), '#d8d5cc', '#3a4254', '#23242a', '#7a8290',
  ].map((c) => new THREE.Color(c));
  const skins = ['#c68863', '#8d5a3b', '#5d3a26', '#e0a87f'].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  fans.forEach((f, i) => {
    m4.compose(new THREE.Vector3(f.x, f.y + 0.42, f.z), q, s1);
    bodies.setMatrixAt(i, m4);
    bodies.setColorAt(i, palette[(Math.random() * palette.length) | 0]);
    m4.compose(new THREE.Vector3(f.x, f.y + 0.86, f.z), q, s1);
    heads.setMatrixAt(i, m4);
    heads.setColorAt(i, skins[(Math.random() * skins.length) | 0]);
  });
  let excite = 0.25;
  const api = {
    bodies, heads,
    setExcitement(e) { excite = Math.max(excite, e); },
    update(t, dt) {
      excite = Math.max(0.22, excite - dt * 0.12);
      const eb = bodies.instanceMatrix.array, eh = heads.instanceMatrix.array;
      for (let i = 0; i < n; i++) {
        const f = fans[i];
        const bob = Math.max(0, Math.sin(t * (3.2 + f.amp) + f.phase)) * 0.16 * excite * f.amp;
        eb[i * 16 + 13] = f.y + 0.42 + bob;
        eh[i * 16 + 13] = f.y + 0.86 + bob * 1.25;
      }
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}

/** Build the whole scene around the field. Returns refs for live elements. */
export function buildStadium(scene, school, rival, logoCv, { daytime = false } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // sky + fog + ground
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex(daytime ? daySkyCanvas() : skyCanvas()), side: THREE.BackSide, fog: false })
  );
  group.add(sky);
  scene.fog = daytime ? new THREE.Fog('#c2d4e8', 220, 520) : new THREE.Fog('#101524', 120, 400);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshPhongMaterial({ map: tex(grassTileCanvas('#23461f'), { repeat: [90, 90] }) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  group.add(ground);

  // moon (night) or sun glare (day)
  const moon = glowSprite(daytime ? '#fff6d0' : '#e8ecf4', daytime ? 60 : 34);
  moon.position.set(-160, 150, -220);
  group.add(moon);
  if (!daytime) {
    const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 20), new THREE.MeshBasicMaterial({ color: '#dde4ee', fog: false }));
    moonDisc.position.copy(moon.position);
    moonDisc.lookAt(0, 0, 0);
    group.add(moonDisc);
  }

  // the field
  const fieldTex = tex(fieldCanvas({
    schoolName: school.name, mascot: school.mascot, rivalName: rival.name,
    primary: school.colors.primary, secondary: school.colors.secondary, logo: logoCv,
  }), { aniso: 16 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(120, 160 / 3), new THREE.MeshPhongMaterial({ map: fieldTex, shininess: 2 }));
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  group.add(field);
  // apron
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(150, 76), new THREE.MeshPhongMaterial({ map: tex(grassTileCanvas('#2a5526'), { repeat: [30, 16] }) }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  group.add(apron);

  // pylons
  const pylonMat = new THREE.MeshPhongMaterial({ color: '#ff7a1a', emissive: '#993f00' });
  for (const gx of [-60, -50, 50, 60]) {
    for (const gz of [-160 / 6, 160 / 6]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), pylonMat);
      p.position.set(gx, 0.25, gz);
      group.add(p);
    }
  }

  group.add(goalpost(-60));
  group.add(goalpost(60));

  // stands + crowd
  const home = buildStands(1, school);
  const away = buildStands(-1, school);
  group.add(home.group, away.group);
  const crowd = daytime
    ? { bodies: null, heads: null, setExcitement() {}, update() {} }
    : buildCrowd([home, away], school);
  if (!daytime) group.add(crowd.bodies, crowd.heads);

  // light towers
  const towers = [];
  for (const [x, z] of [[-44, -33], [44, -33], [-44, 33], [44, 33]]) {
    const t = lightTower(x, z);
    towers.push(t);
    group.add(t);
  }

  // scoreboard behind +X end zone
  const scoreboard = buildScoreboard(school);
  scoreboard.group.position.set(74, 0, 0);
  group.add(scoreboard.group);

  // benches
  const benchMat = new THREE.MeshPhongMaterial({ color: '#8c9097', shininess: 40 });
  for (const side of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 0.55), benchMat);
    bench.position.set(side > 0 ? -12 : 12, 0.45, side * 29.2);
    group.add(bench);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.45, 0.4), new THREE.MeshPhongMaterial({ color: '#5b5f66' }));
    legs.position.set(bench.position.x, 0.22, side * 29.2);
    group.add(legs);
    // the orange cooler
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.7), new THREE.MeshPhongMaterial({ color: '#777' }));
    table.position.set(bench.position.x + 9.5, 0.35, side * 29.2);
    group.add(table);
    const cooler = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.5, 10), new THREE.MeshPhongMaterial({ color: '#ff7a1a' }));
    cooler.position.set(bench.position.x + 9.5, 0.95, side * 29.2);
    group.add(cooler);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 10), new THREE.MeshPhongMaterial({ color: '#f2f2ee' }));
    lid.position.set(bench.position.x + 9.5, 1.23, side * 29.2);
    group.add(lid);
  }

  // perimeter fence
  const fenceMat = new THREE.MeshPhongMaterial({ color: '#aab0b8', shininess: 30 });
  const fenceGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5);
  const railGeo = new THREE.BoxGeometry(1, 0.06, 0.06);
  const fence = new THREE.Group();
  const fr = { x: 69, z: 30.4 };
  const posts = [];
  for (let x = -fr.x; x <= fr.x; x += 4) { posts.push([x, -fr.z]); posts.push([x, fr.z]); }
  for (let z = -fr.z; z <= fr.z; z += 4) { posts.push([-fr.x, z]); posts.push([fr.x, z]); }
  const inst = new THREE.InstancedMesh(fenceGeo, fenceMat, posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach((p, i) => {
    m4.makeTranslation(p[0], 0.55, p[1]);
    inst.setMatrixAt(i, m4);
  });
  fence.add(inst);
  for (const z of [-fr.z, fr.z]) {
    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.scale.x = fr.x * 2;
    rail.position.set(0, 1.08, z);
    fence.add(rail);
  }
  for (const x of [-fr.x, fr.x]) {
    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.scale.x = fr.z * 2;
    rail.rotation.y = Math.PI / 2;
    rail.position.set(x, 1.08, 0);
    fence.add(rail);
  }
  group.add(fence);

  // town dressing
  group.add(treeRing());
  const wt = waterTower(school.name);
  wt.position.set(120, 0, -95);
  group.add(wt);

  // your school on the hill behind the west end zone
  const schoolBuilding = buildSchool(school, { signLine2: `FRI: VS ${rival.name.toUpperCase()}`, ground: true });
  schoolBuilding.rotation.y = Math.PI / 2;
  schoolBuilding.position.set(-108, 0, 0);
  group.add(schoolBuilding);
  // floodlight wash on the school facade
  const schoolGlow = glowSprite('#ffeebb', 30);
  schoolGlow.position.set(-100, 8, 0);
  group.add(schoolGlow);

  // ---- lighting
  const hemi = new THREE.HemisphereLight(daytime ? '#bcd2f0' : '#5b6c96', daytime ? '#5a6a48' : '#1c2415', daytime ? 1.15 : 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(daytime ? '#fff4dc' : '#f4ead2', daytime ? 2.6 : 2.1);
  key.position.set(34, 52, 26);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -70;
  key.shadow.camera.right = 70;
  key.shadow.camera.top = 45;
  key.shadow.camera.bottom = -45;
  key.shadow.camera.far = 140;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new THREE.DirectionalLight(daytime ? '#dce8ff' : '#aebcf0', daytime ? 0.5 : 0.7);
  rim.position.set(-40, 40, -30);
  scene.add(rim);
  if (!daytime) {
    const moonLight = new THREE.DirectionalLight('#7888b8', 0.35);
    moonLight.position.copy(moon.position);
    scene.add(moonLight);
  }

  return { group, scoreboard, crowd, towers, sky, keyLight: key };
}
