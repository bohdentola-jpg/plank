// STORY hub set: Santos Auto Body, the late Mr. Santos's one-bay shop that
// Rosa lends you. Two-post lift, pegboard and workbench, rolling tool chest,
// tire stacks, the race board (corkboard + city map), an old TV on a crate,
// a roll-up door half open onto a rainy alley under a sodium lamp.
//
// Frame: the car sits at the origin facing +z. x+ is the right wall (board),
// x- the left wall (bench), z- the roll-up door.
import * as THREE from 'three';
import { getEnvMap } from '../core/envmap.js';
import { toTex, concreteTexture } from '../track/textures.js';
import { makeRng } from '../core/util.js';
import { canvas, grain, blot } from './lotScene.js';

const RW = 5.2;   // half width
const RD = 7.5;   // half depth
const RH = 4.2;   // height

function floorTex() {
  const PX = 48;
  const w = RW * 2 * PX, h = RD * 2 * PX;
  const c = canvas(w, h), r = canvas(w, h);
  const x = c.getContext('2d'), y = r.getContext('2d');
  const rng = makeRng('shopfloor');
  x.fillStyle = '#6d7068';
  x.fillRect(0, 0, w, h);
  y.fillStyle = '#9a9a9a';
  y.fillRect(0, 0, w, h);
  grain(x, w, h, rng, w * h * 0.3, 0.14);
  for (let i = 0; i < 60; i++) blot(x, rng() * w, rng() * h, 10 + rng() * 70, '10,10,8', 0.12 + rng() * 0.15);
  // worn epoxy: lighter scuffs where the floor paint wore through
  for (let i = 0; i < 30; i++) blot(x, rng() * w, rng() * h, 20 + rng() * 60, '180,175,160', 0.08);
  // work bay outline (yellow), drain, oil under the car
  x.strokeStyle = 'rgba(226,182,40,0.8)';
  x.lineWidth = 7;
  x.setLineDash([36, 18]);
  x.strokeRect(w / 2 - 1.9 * PX, h / 2 - 3.2 * PX, 3.8 * PX, 6.4 * PX);
  x.setLineDash([]);
  for (let i = 0; i < 6; i++) blot(x, w / 2 + (rng() - 0.5) * 60, h / 2 + (rng() - 0.5) * 120, 20 + rng() * 30, '5,4,2', 0.55);
  blot(y, w / 2, h / 2, 110, '30,30,30', 0.7);
  x.fillStyle = '#26282a';
  x.fillRect(w / 2 - 20, h / 2 + 3.6 * PX, 40, 40);
  // puddle tracked in from the alley
  y.save();
  y.translate(w / 2 + 40, 30);
  y.scale(1, 0.5);
  const g = y.createRadialGradient(0, 0, 10, 0, 0, 140);
  g.addColorStop(0, 'rgba(12,12,12,1)');
  g.addColorStop(1, 'rgba(12,12,12,0)');
  y.fillStyle = g;
  y.fillRect(-140, -140, 280, 280);
  y.restore();
  blot(x, w / 2 + 40, 30, 120, '0,0,0', 0.25);
  return { map: toTex(c, { repeat: false }), rough: toTex(r, { srgb: false, repeat: false }) };
}

function wallTex(side, meters) {
  const PX = 48;
  const len = Math.round(meters * PX), h = RH * PX;
  const c = canvas(len, h);
  const x = c.getContext('2d');
  const rng = makeRng('shopwall' + side);
  x.fillStyle = '#b9b6a8';
  x.fillRect(0, 0, len, h);
  const bw = 0.4 * PX, bh = 0.2 * PX;
  for (let row = 0; row * bh < h; row++) {
    for (let col = -1; col * bw < len; col++) {
      const bx = col * bw + (row % 2 ? bw / 2 : 0);
      const t = 180 + Math.floor((rng() - 0.5) * 14);
      x.fillStyle = `rgb(${t},${t - 2},${t - 14})`;
      x.fillRect(bx + 1, h - (row + 1) * bh + 1, bw - 2, bh - 2);
    }
  }
  grain(x, len, h, rng, len * h * 0.18, 0.14);
  // dark green wainscot + red pinstripe
  x.fillStyle = 'rgba(30,58,44,0.95)';
  x.fillRect(0, h - 1.2 * PX, len, 1.2 * PX);
  x.fillStyle = 'rgba(160,30,30,0.9)';
  x.fillRect(0, h - 1.3 * PX, len, 0.06 * PX);
  for (let k = 0; k < 10; k++) {
    const sx = rng() * len, sl = (0.5 + rng() * 1.6) * PX;
    const g = x.createLinearGradient(0, 0, 0, sl);
    g.addColorStop(0, 'rgba(40,32,20,0.35)');
    g.addColorStop(1, 'rgba(40,32,20,0)');
    x.fillStyle = g;
    x.fillRect(sx, 0, 8 + rng() * 26, sl);
  }
  if (side === 'side') {
    // hand-painted shop sign
    x.save();
    x.font = 'italic 900 64px Georgia, "Times New Roman", serif';
    x.fillStyle = 'rgba(140,24,24,0.88)';
    x.fillText('Santos', 1.2 * PX, h - 2.4 * PX);
    x.font = '900 26px Arial Black, Arial, sans-serif';
    x.fillStyle = 'rgba(28,30,34,0.85)';
    x.fillText('AUTO BODY  ·  EST. 1978', 1.3 * PX, h - 1.85 * PX);
    x.restore();
  }
  return toTex(c, { repeat: false });
}

function pegboardTex() {
  const c = canvas(512, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#8a6f4e';
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = 'rgba(40,28,16,0.55)';
  for (let i = 8; i < 512; i += 16) for (let j = 8; j < 256; j += 16) { x.beginPath(); x.arc(i, j, 2, 0, Math.PI * 2); x.fill(); }
  const rng = makeRng('tools');
  // tool silhouettes with painted outlines (every shop does this)
  const tools = [
    (tx, ty) => { x.fillRect(tx, ty, 10, 70); x.fillRect(tx - 8, ty, 26, 14); },          // wrench-ish
    (tx, ty) => { x.fillRect(tx, ty, 8, 60); x.fillRect(tx - 6, ty + 56, 20, 26); },        // screwdriver
    (tx, ty) => { x.fillRect(tx, ty, 34, 12); x.fillRect(tx + 12, ty + 12, 10, 50); },      // hammer
    (tx, ty) => { x.beginPath(); x.arc(tx + 14, ty + 14, 14, 0, Math.PI * 2); x.fill(); x.fillRect(tx + 10, ty + 20, 8, 50); }, // mallet
  ];
  for (let k = 0; k < 14; k++) {
    const tx = 24 + k * 34, ty = 30 + (k % 3) * 20;
    x.fillStyle = 'rgba(20,20,22,0.92)';
    tools[Math.floor(rng() * tools.length)](tx, ty);
  }
  x.fillStyle = 'rgba(200,40,30,0.85)';
  x.fillRect(20, 190, 470, 6);
  return toTex(c, { repeat: false });
}

function corkTex() {
  const c = canvas(1024, 512);
  const x = c.getContext('2d');
  const rng = makeRng('cork');
  x.fillStyle = '#9b6d3e';
  x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = rng() < 0.5 ? 'rgba(60,36,14,0.35)' : 'rgba(200,160,110,0.25)';
    x.fillRect(rng() * 1024, rng() * 512, 2, 2);
  }
  // pinned city map
  x.save();
  x.translate(60, 40);
  x.rotate(-0.02);
  x.fillStyle = '#e8e1cc';
  x.fillRect(0, 0, 560, 420);
  x.strokeStyle = 'rgba(80,120,170,0.5)';
  x.lineWidth = 3;
  for (let k = 0; k < 14; k++) { x.beginPath(); x.moveTo(0, k * 32); x.lineTo(560, k * 32 + (rng() - 0.5) * 30); x.stroke(); }
  for (let k = 0; k < 18; k++) { x.beginPath(); x.moveTo(k * 32, 0); x.lineTo(k * 32 + (rng() - 0.5) * 30, 420); x.stroke(); }
  x.fillStyle = 'rgba(90,140,200,0.55)';
  x.beginPath(); x.moveTo(0, 300); x.bezierCurveTo(160, 260, 300, 380, 560, 330); x.lineTo(560, 420); x.lineTo(0, 420); x.fill();
  x.strokeStyle = '#d42a2a';
  x.lineWidth = 6;
  x.beginPath(); x.moveTo(90, 120); x.lineTo(240, 90); x.lineTo(400, 200); x.lineTo(480, 120); x.stroke();
  x.fillStyle = '#1a1a1a';
  x.font = 'bold 30px Arial';
  x.fillText('PORT HALCYON', 20, 40);
  x.restore();
  // flyers
  const cols = ['#f4f0e0', '#ffe066', '#ff8fb0', '#9fe0ff', '#f4f0e0'];
  for (let k = 0; k < 6; k++) {
    x.save();
    x.translate(660 + (k % 2) * 170, 50 + Math.floor(k / 2) * 150);
    x.rotate((rng() - 0.5) * 0.18);
    x.fillStyle = cols[k % cols.length];
    x.fillRect(0, 0, 140, 120);
    x.fillStyle = '#151515';
    x.font = 'bold 22px Arial Black, Arial';
    x.fillText(['RACE', 'FRI', 'MAIN', 'DOCKS', '$$$', '1/4 MI'][k], 12, 36);
    x.fillRect(12, 50, 110, 6);
    x.fillRect(12, 64, 80, 6);
    x.fillRect(12, 78, 96, 6);
    x.fillStyle = '#c21c1c';
    x.beginPath(); x.arc(70, 8, 7, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // polaroids
  for (let k = 0; k < 3; k++) {
    x.save();
    x.translate(80 + k * 190, 400);
    x.rotate((rng() - 0.5) * 0.3);
    x.fillStyle = '#f2f2ee';
    x.fillRect(0, 0, 120, 100);
    x.fillStyle = ['#22304a', '#3a2a22', '#1e3a2e'][k];
    x.fillRect(8, 8, 104, 70);
    x.restore();
  }
  return toTex(c, { repeat: false });
}

function posterTex(title, sub, bg, fg) {
  const c = canvas(256, 360);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 360);
  g.addColorStop(0, bg);
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 360);
  x.fillStyle = fg;
  x.font = 'italic 900 52px Arial Black, Arial';
  x.fillText(title, 16, 300);
  x.font = 'bold 20px Arial';
  x.fillText(sub, 18, 330);
  // a car-ish silhouette
  x.fillStyle = 'rgba(255,255,255,0.18)';
  x.beginPath();
  x.moveTo(30, 220); x.lineTo(70, 170); x.lineTo(170, 165); x.lineTo(230, 205); x.lineTo(232, 235); x.lineTo(28, 238);
  x.fill();
  grain(x, 256, 360, makeRng(title), 3000, 0.2);
  return toTex(c, { repeat: false });
}

export function buildGarageScene(gl) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  scene.fog = new THREE.FogExp2(0x0b0b0d, 0.025);
  scene.environment = getEnvMap(gl, 'garage');
  const add = (m) => { scene.add(m); return m; };
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // ---------------------------------------------------------------- shell
  const ft = floorTex();
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2), std({ map: ft.map, roughnessMap: ft.rough, roughness: 1, metalness: 0, envMapIntensity: 0.8 })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const sideT = wallTex('side', RD * 2);
  const left = add(new THREE.Mesh(new THREE.PlaneGeometry(RD * 2, RH), std({ map: sideT, roughness: 0.92 })));
  left.rotation.y = Math.PI / 2;
  left.position.set(-RW, RH / 2, 0);
  const right = add(new THREE.Mesh(new THREE.PlaneGeometry(RD * 2, RH), std({ map: wallTex('side2', RD * 2), roughness: 0.92 })));
  right.rotation.y = -Math.PI / 2;
  right.position.set(RW, RH / 2, 0);
  const front = add(new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RH), std({ map: wallTex('end', RW * 2), roughness: 0.92 })));
  front.rotation.y = Math.PI;
  front.position.set(0, RH / 2, RD);
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2), std({ map: concreteTexture('#4e4d4a', 'shopceil'), roughness: 0.95 })));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = RH;
  // trusses
  const steel = std({ color: 0x3b3e44, roughness: 0.6, metalness: 0.7 });
  for (let k = -2; k <= 2; k++) {
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(RW * 2, 0.25, 0.12), steel));
    b.position.set(0, RH - 0.35, k * 3);
  }

  // back wall with the roll-up door, half open
  const backL = add(new THREE.Mesh(new THREE.PlaneGeometry(RW - 1.9, RH), std({ map: wallTex('end2', RW - 1.9), roughness: 0.92 })));
  backL.position.set(-RW + (RW - 1.9) / 2, RH / 2, -RD);
  const backR = backL.clone();
  backR.position.x = -backL.position.x;
  add(backR);
  const lintel = add(new THREE.Mesh(new THREE.PlaneGeometry(3.8, RH - 3.0), std({ map: concreteTexture('#9a978c', 'lintel'), roughness: 0.9 })));
  lintel.position.set(0, 3.0 + (RH - 3.0) / 2, -RD);
  const corr = canvas(64, 256);
  {
    const x = corr.getContext('2d');
    for (let i = 0; i < 256; i++) {
      const v = 120 + Math.sin(i * 0.8) * 50;
      x.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
      x.fillRect(0, i, 64, 1);
    }
    grain(x, 64, 256, makeRng('corr'), 2500, 0.25);
  }
  const corrT = toTex(corr);
  corrT.repeat.set(4, 2);
  const door = add(new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.9), std({ map: corrT, roughness: 0.55, metalness: 0.6 })));
  door.position.set(0, 3.0 - 0.95, -RD + 0.05);
  // the alley outside: wet ground, opposite wall, sodium lamp, rain
  const alleyG = add(new THREE.Mesh(new THREE.PlaneGeometry(14, 8), std({ color: 0x1a1a1c, roughness: 0.15, metalness: 0.0 })));
  alleyG.rotation.x = -Math.PI / 2;
  alleyG.position.set(0, -0.01, -RD - 4);
  const alleyW = add(new THREE.Mesh(new THREE.PlaneGeometry(14, 6), std({ map: concreteTexture('#3a3836', 'alley'), roughness: 0.9 })));
  alleyW.position.set(0, 3, -RD - 6);
  const sodium = add(new THREE.PointLight(0xff9a3a, 26, 18, 1.5));
  sodium.position.set(1.2, 3.4, -RD - 3.2);
  const lampHead = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb060).multiplyScalar(4) })));
  lampHead.position.copy(sodium.position);
  const rainN = 260;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(rainN * 6);
  const rr = makeRng('rain');
  for (let i = 0; i < rainN; i++) {
    const x = (rr() - 0.5) * 6, y = rr() * 4, z = -RD - 0.3 - rr() * 4.5;
    rp.set([x, y, z, x, y - 0.3, z], i * 6);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.35 })));

  // ---------------------------------------------------------------- the lift
  const liftMat = std({ color: 0xd7a21c, roughness: 0.5, metalness: 0.3 });
  const lift = add(new THREE.Group());
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.36), liftMat);
    post.position.set(sx * 1.85, 1.7, -0.2);
    post.castShadow = true;
    lift.add(post);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.7), steel);
    base.position.set(sx * 1.85, 0.03, -0.2);
    lift.add(base);
    for (const az of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.1), steel);
      arm.position.set(sx * 1.4, 0.12, -0.2 + az * 0.35);
      arm.rotation.y = az * sx * 0.4;
      lift.add(arm);
    }
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.98, 0.18, 0.2), liftMat);
  beam.position.set(0, 3.45, -0.2);
  lift.add(beam);

  // ---------------------------------------------------------------- left wall: bench, pegboard, tool chest
  const wood = std({ color: 0x6b5236, roughness: 0.8 });
  const bench = add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 3.2), wood));
  bench.position.set(-RW + 0.4, 0.92, 2.2);
  for (const dz of [-1.5, 1.5]) {
    const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.06), steel));
    leg.position.set(-RW + 0.7, 0.46, 2.2 + dz);
  }
  const shelf = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 3.2), wood));
  shelf.position.set(-RW + 0.4, 0.3, 2.2);
  const peg = add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), std({ map: pegboardTex(), roughness: 0.85 })));
  peg.rotation.y = Math.PI / 2;
  peg.position.set(-RW + 0.02, 1.85, 2.2);
  const vise = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.14), std({ color: 0x2c4a7a, roughness: 0.5, metalness: 0.4 })));
  vise.position.set(-RW + 0.55, 1.04, 1.0);
  const lampArm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6), steel));
  lampArm.position.set(-RW + 0.35, 1.25, 3.2);
  lampArm.rotation.z = -0.5;
  const benchLight = add(new THREE.SpotLight(0xffd8a0, 8, 4, 0.8, 0.6, 1.5));
  benchLight.position.set(-RW + 0.5, 1.5, 3.2);
  benchLight.target.position.set(-RW + 0.4, 0.9, 2.6);
  add(benchLight.target);
  // parts boxes on the shelf
  const boxRng = makeRng('boxes');
  for (let k = 0; k < 7; k++) {
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2 + boxRng() * 0.15, 0.3), std({ color: [0xb08a5a, 0x9a7a52, 0xc24a2a, 0x2a4a8a][k % 4], roughness: 0.9 })));
    b.position.set(-RW + 0.4, 0.42 + 0.05, 0.9 + k * 0.42);
  }
  // red rolling tool chest
  const chest = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 1.2), std({ color: 0xa3140f, roughness: 0.35, metalness: 0.4 })));
  chest.position.set(-RW + 0.4, 0.62, -1.6);
  chest.castShadow = true;
  for (let k = 0; k < 6; k++) {
    const h = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.9), std({ color: 0xd8d8d8, metalness: 1, roughness: 0.2 })));
    h.position.set(-RW + 0.71, 0.25 + k * 0.17, -1.6);
  }

  // ---------------------------------------------------------------- right wall: the board, tires, TV, posters
  const board = add(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), std({ map: corkTex(), roughness: 0.95 })));
  board.rotation.y = -Math.PI / 2;
  board.position.set(RW - 0.03, 1.75, 1.6);
  const frame = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 3.5), wood));
  frame.position.set(RW - 0.05, 1.75, 1.6);
  const boardLight = add(new THREE.SpotLight(0xfff0d8, 9, 6, 0.7, 0.7, 1.5));
  boardLight.position.set(RW - 1.4, 3.3, 1.6);
  boardLight.target.position.set(RW, 1.7, 1.6);
  add(boardLight.target);
  const tireMat = std({ color: 0x141414, roughness: 0.85 });
  const tireGeo = new THREE.TorusGeometry(0.29, 0.11, 10, 22);
  for (let s = 0; s < 2; s++) {
    for (let k = 0; k < 4 - s; k++) {
      const t = add(new THREE.Mesh(tireGeo, tireMat));
      t.rotation.x = Math.PI / 2;
      t.position.set(RW - 0.55 - s * 0.8, 0.11 + k * 0.22, -2.6 - s * 0.1);
      t.castShadow = true;
    }
  }
  // crate + old TV playing static
  const crate = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), wood));
  crate.position.set(RW - 0.6, 0.3, -4.8);
  const tvBox = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), std({ color: 0x1a1a1c, roughness: 0.5 })));
  tvBox.position.set(RW - 0.62, 0.86, -4.8);
  const tvC = canvas(64, 48);
  const tvT = toTex(tvC, { repeat: false });
  const tvScreen = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshBasicMaterial({ map: tvT, color: new THREE.Color(1.6, 1.7, 1.9) })));
  tvScreen.rotation.y = -Math.PI / 2;
  tvScreen.position.set(RW - 0.92, 0.88, -4.8);
  const tvGlow = add(new THREE.PointLight(0x9ab8ff, 2.5, 4, 1.6));
  tvGlow.position.set(RW - 1.3, 0.9, -4.8);
  const poster1 = add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), std({ map: posterTex('NITRO', 'FRIDAY · 11PM', '#7a1238', '#ffd34a'), roughness: 0.8 })));
  poster1.rotation.y = -Math.PI / 2;
  poster1.position.set(RW - 0.02, 2.0, -1.6);
  const poster2 = add(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), std({ map: posterTex('JDM', 'TUNER SHOW 03', '#123a7a', '#9fe8ff'), roughness: 0.8 })));
  poster2.rotation.y = Math.PI / 2;
  poster2.position.set(-RW + 0.02, 2.1, -3.6);

  // engine hoist in the back corner
  const hoistMat = std({ color: 0x1f4fa0, roughness: 0.5, metalness: 0.4 });
  const mast = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), hoistMat));
  mast.position.set(-RW + 1.0, 0.95, -5.6);
  const boom = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), hoistMat));
  boom.position.set(-RW + 1.0, 1.85, -5.0);
  boom.rotation.x = 0.25;
  const chain = add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6), steel));
  chain.position.set(-RW + 1.0, 1.35, -4.4);
  const block = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.6), std({ color: 0x55585e, roughness: 0.45, metalness: 0.8 })));
  block.position.set(-RW + 1.0, 0.85, -4.4);
  block.castShadow = true;

  // ---------------------------------------------------------------- lighting
  scene.add(new THREE.HemisphereLight(0x8a96aa, 0x2a2218, 0.35));
  const key = add(new THREE.SpotLight(0xfff4e6, 11, 12, 0.85, 0.55, 1.6));
  key.position.set(0.6, RH - 0.5, 1.2);
  key.target.position.set(0, 0, 0);
  add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 9;
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeef6ff).multiplyScalar(3.0) });
  const tubes = [];
  for (const [x, z] of [[-2.2, 2.6], [2.2, 2.6], [-2.2, -3.2], [2.2, -3.2]]) {
    const tube = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 1.3), tubeMat));
    tube.position.set(x, RH - 0.55, z);
    tubes.push(tube);
  }
  const fillA = add(new THREE.PointLight(0xe8f0ff, 4, 10, 1.6));
  fillA.position.set(-2.2, RH - 0.7, 2.6);
  const fillB = add(new THREE.PointLight(0xe8f0ff, 4, 10, 1.6));
  fillB.position.set(2.2, RH - 0.7, -3.2);
  // hanging work lamp over the hood
  const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(5) })));
  bulb.position.set(0.3, 2.6, 1.9);
  const cord = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, RH - 2.6), new THREE.MeshBasicMaterial({ color: 0x111111 })));
  cord.position.set(0.3, (RH + 2.6) / 2, 1.9);
  const bulbLight = add(new THREE.PointLight(0xffc98a, 2.2, 6, 1.7));
  bulbLight.position.copy(bulb.position);

  const camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.05, 80);

  let tvT0 = 0;
  const tvRng = makeRng('tvstatic');
  return {
    scene, camera, key, rain, bulb, lift,
    /** Camera stations: [position, target]. */
    stations: {
      hub: [[3.9, 1.55, 5.6], [-0.9, 0.55, -0.3]],
      board: [[1.0, 1.72, 1.6], [RW, 1.62, 1.6]],
      perf: [[1.8, 0.95, 4.2], [-0.5, 0.45, 0.4]],
      body: [[0, 1.3, 6.0], [0, 0.55, 0]],
      dealer: [[-4.3, 1.6, 6.3], [1.3, 0.5, -0.4]],
      phone: [[3.2, 1.35, 4.6], [-0.4, 0.75, 0.0]],
    },
    update(dt, t) {
      // rain falls outside
      const p = rainGeo.attributes.position.array;
      for (let i = 0; i < rainN; i++) {
        const o = i * 6;
        let y = p[o + 1] - dt * 9;
        if (y < 0) y += 4;
        p[o + 1] = y;
        p[o + 4] = y - 0.3;
      }
      rainGeo.attributes.position.needsUpdate = true;
      // the bulb sways a little; the TV crawls with snow
      bulb.position.x = 0.3 + Math.sin(t * 0.7) * 0.02;
      bulbLight.position.x = bulb.position.x;
      tvT0 += dt;
      if (tvT0 > 0.06) {
        tvT0 = 0;
        const x = tvC.getContext('2d');
        const img = x.createImageData(64, 48);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = tvRng() * 200;
          img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 20; img.data[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        tvT.needsUpdate = true;
        tvGlow.intensity = 1.8 + tvRng() * 1.4;
      }
    },
    dispose() {
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { m.map?.dispose?.(); m.roughnessMap?.dispose?.(); m.dispose?.(); }
      });
    },
  };
}
