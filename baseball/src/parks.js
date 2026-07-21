// The ballparks. Six hand-designed yards — different fences, dirt, skies,
// backdrops, and moods — every texture painted in code. Home plate sits at
// the origin; center field runs up +Z. Units are yards.
import * as THREE from 'three';
import { mkCanvas, tex, speckle, shade, daySkyCanvas, skyCanvas } from './textures.js';

export const BASEPATH = 24;          // base-to-base distance
export const MOUND = 16.5;           // rubber distance from the plate
export const FOUL_BACK = 13;         // backstop distance

export const PARKS = [
  {
    id: 'cathedral', name: 'The Green Cathedral', tag: 'ivy on the wall, day ball',
    sky: 'day', wallLine: 76, wallCenter: 92, wallHeight: 2.6, tallSide: null,
    grassA: '#2c672d', grassB: '#357a36', infield: '#3a8039', dirt: '#a2683a',
    wallColor: '#1e5c34', capColor: '#e8c840', backdrop: 'trees', stands: 'big',
  },
  {
    id: 'bayside', name: 'Bayside Yard', tag: 'gulls, masts, splash hits',
    sky: 'dusk', wallLine: 71, wallCenter: 86, wallHeight: 2.6, tallSide: 'R', tallHeight: 5.0,
    grassA: '#2a6448', grassB: '#337a56', infield: '#38835e', dirt: '#9a6a48',
    wallColor: '#1d4a68', capColor: '#f4f2ea', backdrop: 'water', stands: 'big',
  },
  {
    id: 'mesa', name: 'Red Mesa Field', tag: 'thin air, long balls',
    sky: 'day', wallLine: 80, wallCenter: 97, wallHeight: 2.4, tallSide: null,
    grassA: '#5a7a2e', grassB: '#688a38', infield: '#6e9040', dirt: '#b05a34',
    wallColor: '#7a4026', capColor: '#e8c840', backdrop: 'mesa', stands: 'small',
  },
  {
    id: 'ironcity', name: 'Iron City Grounds', tag: 'night ball under the smokestacks',
    sky: 'night', wallLine: 74, wallCenter: 90, wallHeight: 2.6, tallSide: 'L', tallHeight: 6.2,
    grassA: '#245c2c', grassB: '#2c6c34', infield: '#307434', dirt: '#8a5a38',
    wallColor: '#23262c', capColor: '#e8c840', backdrop: 'skyline', stands: 'big',
  },
  {
    id: 'sandlot', name: 'Prairie Lot', tag: 'wood fence, corn past center',
    sky: 'day', wallLine: 66, wallCenter: 80, wallHeight: 1.9, tallSide: null,
    grassA: '#4c7a30', grassB: '#5a8a3a', infield: '#5e8e40', dirt: '#a8763e',
    wallColor: '#8a5a30', capColor: '#c8a060', backdrop: 'corn', stands: 'none',
  },
  {
    id: 'northgrove', name: 'North Grove Park', tag: 'pines and cold gaps',
    sky: 'dusk', wallLine: 78, wallCenter: 98, wallHeight: 3.0, tallSide: null,
    grassA: '#255c33', grassB: '#2d6c3d', infield: '#317440', dirt: '#96603c',
    wallColor: '#2c3a30', capColor: '#f4f2ea', backdrop: 'pines', stands: 'small',
  },
];

export function parkById(id) { return PARKS.find((p) => p.id === id) || PARKS[0]; }

export function basePos(i) {
  const d = BASEPATH / Math.SQRT2;
  return [
    new THREE.Vector3(0, 0, 0),            // home
    new THREE.Vector3(d, 0, d),            // first
    new THREE.Vector3(0, 0, d * 2),        // second
    new THREE.Vector3(-d, 0, d),           // third
  ][i % 4];
}

/** Wall distance for a direction angle (radians off +Z; fair is ±π/4). */
export function wallDistFor(park, ang) {
  const t = Math.min(1, Math.abs(ang) / (Math.PI / 4));
  return park.wallCenter - (park.wallCenter - park.wallLine) * t * t;
}

/** Wall height for a direction (monster walls live on one side). */
export function wallHeightFor(park, ang) {
  if (park.tallSide === 'L' && ang < -0.12) return park.tallHeight;
  if (park.tallSide === 'R' && ang > 0.12) return park.tallHeight;
  return park.wallHeight;
}

// ------------------------------------------------------------ skies
function nightSkyCanvas() {
  const cv = mkCanvas(1024, 512);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04060f');
  g.addColorStop(0.6, '#0a1024');
  g.addColorStop(1, '#141c34');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 600; i++) {
    const y = Math.random() * 420;
    ctx.globalAlpha = 0.3 + Math.random() * 0.7;
    ctx.fillStyle = Math.random() < 0.1 ? '#ffe9c4' : '#ffffff';
    ctx.fillRect(Math.random() * 1024, y, Math.random() < 0.06 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  return cv;
}

// ------------------------------------------------------------ ground paint
function groundCanvas(park, club) {
  const W = 2048, H = 2048;
  const cv = mkCanvas(W, H);
  const ctx = cv.getContext('2d');
  // world → canvas: x ∈ [-100,100], z ∈ [-20,180]; world +Z runs DOWN the canvas
  const sx = W / 200, sz = H / 200;
  const X = (x) => (x + 100) * sx;
  const Y = (z) => (z + 20) * sz;

  // outfield grass, radial mow wedges
  ctx.fillStyle = park.grassA;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = i % 2 ? park.grassA : park.grassB;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    const a0 = -Math.PI / 4 + (i / 22) * Math.PI / 2;
    const a1 = -Math.PI / 4 + ((i + 1) / 22) * Math.PI / 2;
    ctx.arc(X(0), Y(0), 120 * sx, Math.PI / 2 + a0, Math.PI / 2 + a1);
    ctx.closePath();
    ctx.fill();
  }
  speckle(ctx, 0, 0, W, H, 9000, [shade(park.grassA, -22), shade(park.grassB, 26)], 1, 2.4);

  const dirt = park.dirt;
  const dirtDark = shade(dirt, -26);
  const d = BASEPATH / Math.SQRT2;

  // infield dirt fan
  ctx.fillStyle = dirt;
  ctx.beginPath();
  const arcR = BASEPATH * 1.32;
  ctx.moveTo(X(d + 3.2), Y(d - 3.2));
  ctx.arc(X(0), Y(0.4), arcR * sx, Math.PI * 0.25, Math.PI * 0.75);
  ctx.lineTo(X(-3.2), Y(-2.6));
  ctx.lineTo(X(3.2), Y(-2.6));
  ctx.closePath();
  ctx.fill();

  // infield grass square
  ctx.fillStyle = park.infield;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(2.6));
  ctx.lineTo(X(d - 2.6), Y(d));
  ctx.lineTo(X(0), Y(2 * d - 2.8));
  ctx.lineTo(X(-(d - 2.6)), Y(d));
  ctx.closePath();
  ctx.fill();
  speckle(ctx, X(-d), Y(0), 2 * d * sx, 2 * d * sz, 900, [shade(park.infield, -20), shade(park.infield, 24)], 1, 2);

  // base cutouts + mound + plate circle
  ctx.fillStyle = dirt;
  for (let i = 1; i <= 3; i++) {
    const p = basePos(i);
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.z), 2.6 * sx, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath(); ctx.arc(X(0), Y(MOUND), 3.0 * sx, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(X(0), Y(0), 4.4 * sx, 0, Math.PI * 2); ctx.fill();
  speckle(ctx, 0, Y(BASEPATH * 1.5), W, H - Y(BASEPATH * 1.5), 4000, [dirtDark, shade(dirt, 30)], 1, 2.2);

  // chalk: foul lines, batter's boxes, plate
  const chalk = 'rgba(248,248,244,0.95)';
  ctx.strokeStyle = chalk;
  ctx.lineWidth = 0.35 * sx;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    const fx = s * (park.wallLine + 6) / Math.SQRT2;
    ctx.lineTo(X(fx), Y((park.wallLine + 6) / Math.SQRT2));
    ctx.stroke();
  }
  ctx.lineWidth = 0.16 * sx;
  for (const s of [-1, 1]) {
    ctx.strokeRect(X(s * 1.5 - 0.62), Y(-1.05), 1.24 * sx, 2.1 * sz);
  }
  ctx.fillStyle = '#f4f2ea';
  ctx.beginPath();
  ctx.moveTo(X(-0.35), Y(0.42));
  ctx.lineTo(X(0.35), Y(0.42));
  ctx.lineTo(X(0.35), Y(0.06));
  ctx.lineTo(X(0), Y(-0.3));
  ctx.lineTo(X(-0.35), Y(0.06));
  ctx.closePath();
  ctx.fill();

  // on-deck circles
  for (const s of [-1, 1]) {
    ctx.strokeStyle = chalk;
    ctx.lineWidth = 0.2 * sx;
    ctx.beginPath();
    ctx.arc(X(s * 9), Y(-4), 1.5 * sx, 0, Math.PI * 2);
    ctx.stroke();
  }

  // club name mowed into the outfield
  if (club) {
    ctx.save();
    ctx.translate(X(0), Y(58));
    ctx.rotate(Math.PI); // readable from behind home plate
    ctx.font = `900 ${9 * sx}px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = shade(park.grassA, -30);
    ctx.fillText(club.toUpperCase(), 0, 0);
    ctx.restore();
  }
  return cv;
}

// windowed-tower canvas for the skyline backdrop
function towerCanvas(w, h, lit) {
  const cv = mkCanvas(64, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = lit ? '#181c26' : '#20242e';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 10) {
    for (let x = 6; x < 58; x += 10) {
      ctx.fillStyle = Math.random() < (lit ? 0.55 : 0.12) ? '#ffd76a' : '#0c0e14';
      ctx.fillRect(x, y, 6, 6);
    }
  }
  return cv;
}

// ------------------------------------------------------------ backdrops
function buildBackdrop(group, park) {
  const kind = park.backdrop;
  if (kind === 'trees' || kind === 'pines') {
    const leaf = new THREE.MeshPhongMaterial({ color: kind === 'pines' ? '#1b4226' : '#2a5c2e' });
    const trunk = new THREE.MeshPhongMaterial({ color: '#4a3018' });
    for (let i = 0; i < 26; i++) {
      const ang = -Math.PI / 3 + (i / 25) * (Math.PI * 2 / 3);
      const r = wallDistFor(park, Math.max(-Math.PI / 4, Math.min(Math.PI / 4, ang))) + 7 + Math.random() * 9;
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), trunk);
      tr.position.y = 1.2;
      t.add(tr);
      if (kind === 'pines') {
        for (let k = 0; k < 3; k++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2 - k * 0.55, 2.6, 8), leaf);
          cone.position.y = 2.6 + k * 1.5;
          t.add(cone);
        }
      } else {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 1.2, 8, 6), leaf);
        puff.position.y = 3.4;
        puff.scale.y = 0.85;
        t.add(puff);
      }
      t.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r);
      t.rotation.y = Math.random() * Math.PI;
      const s = 0.8 + Math.random() * 0.7;
      t.scale.setScalar(s);
      group.add(t);
    }
  } else if (kind === 'water') {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 120),
      new THREE.MeshPhongMaterial({ color: '#1d4a68', shininess: 90, specular: '#9ab8d8' })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(70, 0.02, 120);
    group.add(water);
    // little sailboats
    for (let i = 0; i < 4; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), new THREE.MeshPhongMaterial({ color: '#f4f2ea' }));
      hull.position.y = 0.3;
      boat.add(hull);
      const sail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4), new THREE.MeshPhongMaterial({ color: '#f4f2ea' }));
      sail.position.y = 1.9;
      boat.add(sail);
      boat.position.set(45 + i * 16 + Math.random() * 6, 0, 96 + Math.random() * 30);
      group.add(boat);
    }
  } else if (kind === 'mesa') {
    const rock = new THREE.MeshPhongMaterial({ color: '#a04a2a' });
    const rockTop = new THREE.MeshPhongMaterial({ color: '#c06a3a' });
    for (const [mx, mz, mw, mh] of [[-70, 140, 40, 18], [10, 165, 55, 24], [78, 135, 34, 15]]) {
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(mw * 0.42, mw * 0.55, mh, 10), rock);
      mesa.position.set(mx, mh / 2 - 1, mz);
      group.add(mesa);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(mw * 0.44, mw * 0.42, 2, 10), rockTop);
      cap.position.set(mx, mh - 0.5, mz);
      group.add(cap);
    }
    // saguaros
    const cactus = new THREE.MeshPhongMaterial({ color: '#3c7a3a' });
    for (let i = 0; i < 8; i++) {
      const ang = -Math.PI / 3.2 + (i / 7) * (Math.PI * 2 / 3.2);
      const r = wallDistFor(park, Math.max(-Math.PI / 4, Math.min(Math.PI / 4, ang))) + 8 + Math.random() * 12;
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 2.8, 4, 8), cactus);
      c.position.set(Math.sin(ang) * r, 1.8, Math.cos(ang) * r);
      group.add(c);
    }
  } else if (kind === 'skyline') {
    for (let i = 0; i < 12; i++) {
      const w = 8 + Math.random() * 12;
      const h = 18 + Math.random() * 34;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshPhongMaterial({ map: tex(towerCanvas(w, h, park.sky === 'night'), { repeat: [1, Math.max(1, Math.round(h / 14))] }) })
      );
      const ang = -Math.PI / 3 + (i / 11) * (Math.PI * 2 / 3);
      const r = park.wallCenter + 26 + Math.random() * 30;
      bldg.position.set(Math.sin(ang) * r, h / 2, Math.cos(ang) * r);
      bldg.rotation.y = Math.random() * 0.6;
      group.add(bldg);
    }
    // smokestacks
    for (const sx2 of [-30, 44]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 30, 8), new THREE.MeshPhongMaterial({ color: '#3a2c28' }));
      stack.position.set(sx2, 15, park.wallCenter + 44);
      group.add(stack);
    }
  } else if (kind === 'corn') {
    // a band of corn past the fence
    const corn = new THREE.MeshPhongMaterial({ color: '#8aa03c' });
    const cornDark = new THREE.MeshPhongMaterial({ color: '#728a30' });
    for (let i = 0; i < 60; i++) {
      const ang = -Math.PI / 3.4 + (i / 59) * (Math.PI * 2 / 3.4);
      const r = wallDistFor(park, Math.max(-Math.PI / 4, Math.min(Math.PI / 4, ang))) + 3 + Math.random() * 14;
      const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6 + Math.random(), 5), Math.random() < 0.5 ? corn : cornDark);
      stalk.position.set(Math.sin(ang) * r, 1.3, Math.cos(ang) * r);
      group.add(stalk);
    }
    // the barn
    const barn = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshPhongMaterial({ color: '#8f2a24' }));
    body.position.y = 3;
    barn.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 10.4, 3, 1), new THREE.MeshPhongMaterial({ color: '#5a5c62' }));
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 7.2;
    roof.scale.y = 1;
    barn.add(roof);
    barn.position.set(-34, 0, park.wallCenter + 20);
    barn.rotation.y = 0.5;
    group.add(barn);
  }
}

// ------------------------------------------------------------ the park
export function buildBallpark(scene, park, home) {
  const group = new THREE.Group();
  scene.add(group);
  const skyCv = park.sky === 'day' ? daySkyCanvas() : park.sky === 'dusk' ? skyCanvas() : nightSkyCanvas();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 12),
    new THREE.MeshBasicMaterial({ map: tex(skyCv), side: THREE.BackSide, fog: false })
  );
  sky.position.y = -10;
  group.add(sky);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshPhongMaterial({ map: tex(groundCanvas(park, home?.mascot)), shininess: 4 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 80);
  ground.receiveShadow = true;
  group.add(ground);

  // mound + rubber
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.3),
    new THREE.MeshPhongMaterial({ color: park.dirt, shininess: 4 })
  );
  mound.scale.y = 0.35;
  mound.position.set(0, -0.94, MOUND);
  mound.receiveShadow = true;
  group.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.18), new THREE.MeshPhongMaterial({ color: '#f0eee6' }));
  rubber.position.set(0, 0.09, MOUND);
  group.add(rubber);

  // bases
  const baseMat = new THREE.MeshPhongMaterial({ color: '#f2f0e8', shininess: 12 });
  for (let i = 1; i <= 3; i++) {
    const p = basePos(i);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.75), baseMat);
    bag.rotation.y = Math.PI / 4;
    bag.position.set(p.x, 0.06, p.z);
    bag.castShadow = true;
    group.add(bag);
  }

  // outfield wall — arced segments, park-height (with monster sides)
  const wallMat = new THREE.MeshPhongMaterial({ color: park.wallColor, shininess: 8 });
  const capMat = new THREE.MeshPhongMaterial({ color: park.capColor, shininess: 30 });
  const SEGS = 26;
  for (let i = 0; i < SEGS; i++) {
    const a0 = -Math.PI / 4 + (i / SEGS) * (Math.PI / 2);
    const a1 = -Math.PI / 4 + ((i + 1) / SEGS) * (Math.PI / 2);
    const am = (a0 + a1) / 2;
    const r = wallDistFor(park, am);
    const hh = wallHeightFor(park, am);
    const p0 = new THREE.Vector3(Math.sin(a0) * wallDistFor(park, a0), 0, Math.cos(a0) * wallDistFor(park, a0));
    const p1 = new THREE.Vector3(Math.sin(a1) * wallDistFor(park, a1), 0, Math.cos(a1) * wallDistFor(park, a1));
    const len = p0.distanceTo(p1) + 0.25;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 0.5), wallMat);
    seg.position.set(Math.sin(am) * r, hh / 2, Math.cos(am) * r);
    seg.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2;
    seg.castShadow = true;
    seg.receiveShadow = true;
    group.add(seg);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.56), capMat);
    cap.position.set(seg.position.x, hh + 0.06, seg.position.z);
    cap.rotation.y = seg.rotation.y;
    group.add(cap);
  }
  // distance signs (yards → feet-ish flavor numbers)
  const signAt = (ang, dist) => {
    const cv = mkCanvas(128, 64);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f4f2ea';
    ctx.font = `900 44px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(dist), 64, 46);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.3),
      new THREE.MeshBasicMaterial({ map: tex(cv), transparent: true })
    );
    const r = wallDistFor(park, ang) - 0.35;
    sign.position.set(Math.sin(ang) * r, Math.min(1.5, wallHeightFor(park, ang) * 0.55), Math.cos(ang) * r);
    sign.rotation.y = Math.PI + ang;
    group.add(sign);
  };
  signAt(-Math.PI / 4 + 0.06, Math.round(park.wallLine * 3.6));
  signAt(0, Math.round(park.wallCenter * 3.75));
  signAt(Math.PI / 4 - 0.06, Math.round(park.wallLine * 3.6));

  // foul poles
  for (const s of [-1, 1]) {
    const r = wallDistFor(park, s * Math.PI / 4);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 11, 8),
      new THREE.MeshPhongMaterial({ color: '#e8c840', shininess: 40 })
    );
    pole.position.set(s * r / Math.SQRT2, 5.5, r / Math.SQRT2);
    group.add(pole);
  }

  // backstop
  const fence = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUL_BACK, FOUL_BACK, 5.5, 18, 1, true, Math.PI * 0.72, Math.PI * 0.56),
    new THREE.MeshPhongMaterial({ color: '#20262e', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  fence.position.set(0, 2.75, 0);
  group.add(fence);

  // stands + crowd
  const crowd = [];
  if (park.stands !== 'none') {
    const rows = park.stands === 'big' ? 6 : 3;
    const crowdMats = ['#c74a4a', '#4a6ac7', '#e0d6b8', '#4aa06a', '#c7a04a', '#8a5ac0'].map((c) => new THREE.MeshPhongMaterial({ color: c }));
    const standMat = new THREE.MeshPhongMaterial({ color: park.sky === 'night' ? '#3c434e' : '#5a6472', shininess: 8 });
    for (const s of [-1, 1]) {
      const stand = new THREE.Group();
      for (let row = 0; row < rows; row++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(34, 0.7, 2.0), standMat);
        step.position.set(0, 0.35 + row * 0.7, row * 2.0);
        step.castShadow = true;
        step.receiveShadow = true;
        stand.add(step);
        for (let k = 0; k < 26; k++) {
          if (Math.random() < 0.18) continue;
          const fan = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), crowdMats[(Math.random() * crowdMats.length) | 0]);
          fan.position.set(-16 + k * 1.25 + Math.random() * 0.5, 1.0 + row * 0.7, row * 2.0 - 0.4);
          fan.userData.baseY = fan.position.y;
          fan.userData.ph = Math.random() * Math.PI * 2;
          stand.add(fan);
          crowd.push(fan);
        }
      }
      stand.position.set(s * 30, 0, 22);
      stand.rotation.y = -s * 1.35;
      group.add(stand);
    }
  } else {
    // sandlot: a couple of wooden benches and parked pickups
    const woodM = new THREE.MeshPhongMaterial({ color: '#7a5a34' });
    for (const s of [-1, 1]) {
      for (let b = 0; b < 2; b++) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 1.0), woodM);
        bench.position.set(s * (16 + b * 4), 0.8, 10 + b * 4);
        bench.rotation.y = -s * 1.1;
        group.add(bench);
      }
      const truck = new THREE.Group();
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 2.0), new THREE.MeshPhongMaterial({ color: s < 0 ? '#8f2a24' : '#3c5c8a' }));
      cab.position.y = 1.2;
      truck.add(cab);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 2.0), new THREE.MeshPhongMaterial({ color: s < 0 ? '#701e1a' : '#2c4468' }));
      bed.position.set(-2.6, 0.9, 0);
      truck.add(bed);
      truck.position.set(s * 28, 0, 16);
      truck.rotation.y = -s * 0.9;
      group.add(truck);
    }
  }

  // light towers (dusk + night parks run the lights)
  const lightsOn = park.sky !== 'day';
  for (const [lx, lz] of [[-34, 2], [34, 2], [-52, 52], [52, 52], [0, park.wallCenter + 12]]) {
    const tower = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 16, 8), new THREE.MeshPhongMaterial({ color: '#3a3f48' }));
    mast.position.y = 8;
    tower.add(mast);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.5), new THREE.MeshPhongMaterial({ color: '#23262c' }));
    bank.position.y = 16.5;
    bank.lookAt(new THREE.Vector3(0, 2, 30));
    tower.add(bank);
    for (let i = 0; i < 8; i++) {
      const bulb = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 8),
        new THREE.MeshBasicMaterial({ color: lightsOn ? '#fff6d8' : '#5a5c60' })
      );
      bulb.position.set(-1.6 + (i % 4) * 1.06, 16.1 + Math.floor(i / 4) * 0.95, 0);
      bulb.lookAt(new THREE.Vector3(0, 0, 30));
      bulb.position.add(new THREE.Vector3(0, 0.4, 0));
      tower.add(bulb);
    }
    tower.position.set(lx, 0, lz);
    group.add(tower);
  }

  // scoreboard
  const sbCv = mkCanvas(512, 256);
  const sb = {
    cv: sbCv,
    tx: tex(sbCv),
    draw({ homeName = 'HOME', awayName = 'AWAY', hr = 0, ar = 0, inning = 1, top = true, outs = 0, primary = '#14306e' }) {
      const ctx = sbCv.getContext('2d');
      ctx.fillStyle = '#101418';
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = primary;
      ctx.fillRect(0, 0, 512, 52);
      ctx.fillStyle = '#f4f2ea';
      ctx.font = `900 34px Impact, 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(park.name.toUpperCase(), 256, 38);
      ctx.font = `900 44px Impact, 'Arial Black', sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8c840';
      ctx.fillText(awayName.slice(0, 10).toUpperCase(), 30, 120);
      ctx.fillText(homeName.slice(0, 10).toUpperCase(), 30, 185);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(ar), 470, 120);
      ctx.fillText(String(hr), 470, 185);
      ctx.textAlign = 'left';
      ctx.font = `700 30px 'Arial Narrow', Arial, sans-serif`;
      ctx.fillStyle = '#9ab0c8';
      ctx.fillText(`${top ? '▲' : '▼'} INN ${inning}   OUTS ${'●'.repeat(outs)}${'○'.repeat(Math.max(0, 2 - outs))}`, 30, 236);
      this.tx.needsUpdate = true;
    },
  };
  const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 7.5), new THREE.MeshBasicMaterial({ map: sb.tx }));
  board.position.set(0, 7.8, park.wallCenter + 6);
  board.rotation.y = Math.PI;
  group.add(board);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(15.6, 8.2, 0.5), new THREE.MeshPhongMaterial({ color: '#23262c' }));
  legs.position.set(0, 7.8, park.wallCenter + 6.35);
  group.add(legs);

  // dugouts
  if (park.stands !== 'none') {
    for (const s of [-1, 1]) {
      const dug = new THREE.Mesh(new THREE.BoxGeometry(10, 1.7, 3), new THREE.MeshPhongMaterial({ color: '#2a3242' }));
      dug.position.set(s * 13, 0.85, 2.5);
      dug.rotation.y = s * -0.78;
      dug.castShadow = true;
      group.add(dug);
    }
  }

  buildBackdrop(group, park);

  return {
    group,
    scoreboard: sb,
    crowd: {
      update(excite, t) {
        for (const fan of crowd) {
          fan.position.y = fan.userData.baseY + Math.max(0, Math.sin(t * (3 + excite * 4) + fan.userData.ph)) * 0.12 * Math.min(2.2, 0.4 + excite);
        }
      },
    },
  };
}

/** Light rig tuned per sky. */
export function lightBallpark(scene, park) {
  if (park.sky === 'day') {
    scene.fog = new THREE.Fog('#bcd2ec', 130, 320);
    scene.add(new THREE.HemisphereLight('#cfe0f4', '#3d5233', 0.95));
    const sun = new THREE.DirectionalLight('#ffe8c4', 2.6);
    sun.position.set(-40, 55, -25);
    configureShadow(sun);
    scene.add(sun);
    const bounce = new THREE.DirectionalLight('#b8d0e8', 0.7);
    bounce.position.set(30, 20, 40);
    scene.add(bounce);
    return '#9ec2e8';
  }
  if (park.sky === 'dusk') {
    scene.fog = new THREE.Fog('#4a3c58', 130, 320);
    scene.add(new THREE.HemisphereLight('#b8a0c8', '#2c3423', 0.75));
    const sun = new THREE.DirectionalLight('#ff9a5a', 1.6);
    sun.position.set(-55, 24, -20);
    configureShadow(sun);
    scene.add(sun);
    const lightsL = new THREE.DirectionalLight('#fff2cc', 1.4);
    lightsL.position.set(-30, 40, 10);
    scene.add(lightsL);
    const lightsR = new THREE.DirectionalLight('#fff2cc', 1.1);
    lightsR.position.set(30, 40, 10);
    scene.add(lightsR);
    return '#2c2440';
  }
  // night
  scene.fog = new THREE.Fog('#0a0e1a', 120, 300);
  scene.add(new THREE.HemisphereLight('#3c4658', '#161c14', 0.55));
  const key = new THREE.DirectionalLight('#fff6d8', 2.2);
  key.position.set(-34, 40, 4);
  configureShadow(key);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#d8e4ff', 1.0);
  fill.position.set(34, 36, 30);
  scene.add(fill);
  const cf = new THREE.DirectionalLight('#fff6d8', 0.7);
  cf.position.set(0, 34, 110);
  scene.add(cf);
  return '#0a0e1a';
}

function configureShadow(sun) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 220;
}
