// BIG INNING '27 — the ballplayers. Same 16-joint articulated rig as VARSITY 27
// (so the Animator drives it unchanged) but dressed for summer: cap or batting
// helmet, button-front jersey, belt, stirrups, a leather mitt, and a bat.
// Forward is +Z in rig-local space. World units are yards; players stand ~2.0 tall.
import * as THREE from 'three';
import { mkCanvas, tex, numberCanvas } from './textures.js';

const matCache = new Map();
function phong(color, opts = {}) {
  const key = `${color}|${opts.shin || 0}|${opts.spec || ''}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhongMaterial({
      color, shininess: opts.shin ?? 14, specular: opts.spec ?? '#2a2a2a',
    }));
  }
  return matCache.get(key);
}

function capsule(r, len, mat, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 18), mat);
  m.scale.set(sx, 1, sz);
  m.castShadow = true;
  return m;
}

/** Sculpted limb: smooth taper with a muscle bulge, hung from y=0 down to -len. */
function limb(r0, rMid, r1, len, mat, bulgeAt = 0.32) {
  const pts = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let r;
    if (t < bulgeAt) {
      const k = t / bulgeAt;
      r = r0 + (rMid - r0) * Math.sin(k * Math.PI / 2);
    } else {
      const k = (t - bulgeAt) / (1 - bulgeAt);
      r = rMid + (r1 - rMid) * (k * k * 0.6 + k * 0.4);
    }
    pts.push(new THREE.Vector2(Math.max(0.012, r), -t * len));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat);
  m.castShadow = true;
  return m;
}

/** Contoured torso: waist → chest swell → shoulder taper. Leaner than the gridiron cut. */
function torsoMesh(rWaist, rChest, h, mat, zScale = 0.76) {
  const pts = [];
  const profile = [
    [0.30, rWaist], [0.05, rWaist * 1.01], [-0.25, rChest * 0.97],
    [-0.45, rChest], [-0.62, rChest * 0.90], [-0.72, rChest * 0.66],
  ];
  for (const [y, r] of profile) pts.push(new THREE.Vector2(r, -y * h));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat);
  m.scale.z = zScale;
  m.castShadow = true;
  return m;
}

const BUILDS = {
  slim: { torso: 0.90, shoulder: 0.94, limb: 0.91, belly: 0 },
  avg:  { torso: 0.97, shoulder: 1.00, limb: 0.98, belly: 0 },
  big:  { torso: 1.08, shoulder: 1.06, limb: 1.08, belly: 0.35 },
  huge: { torso: 1.18, shoulder: 1.10, limb: 1.16, belly: 0.8 },
};

/**
 * A team kit for baseball.
 * uniform: { jersey, pants, cap, brim, sleeve, numberFill, numberStroke, belt, socks, style }
 * style: 'classic' (sleeve trim + placket) | 'plain'
 */
export function makeBBKit(uniform) {
  const kit = {
    u: uniform,
    jersey: phong(uniform.jersey, { shin: 8 }),
    sleevem: phong(uniform.sleeve, { shin: 8 }),
    pants:  phong(uniform.pants, { shin: 16, spec: '#3a3a3a' }),
    cap:    phong(uniform.cap, { shin: 26 }),
    brim:   phong(uniform.brim || uniform.cap, { shin: 34 }),
    helmet: phong(uniform.cap, { shin: 92, spec: '#9a9a9a' }),
    belt:   phong(uniform.belt || '#17181c', { shin: 40 }),
    sock:   phong(uniform.socks || uniform.cap),
    cleat:  phong('#17181c', { shin: 28 }),
    leather: phong('#7a4a22', { shin: 18, spec: '#553322' }),
    numTex: new Map(),
  };
  kit.numberOf = (num) => {
    if (!kit.numTex.has(num)) {
      kit.numTex.set(num, tex(numberCanvas(num, uniform.numberFill, uniform.numberStroke)));
    }
    return kit.numTex.get(num);
  };
  return kit;
}

const skinCache = new Map();
function skinMat(tone) {
  if (!skinCache.has(tone)) skinCache.set(tone, new THREE.MeshPhongMaterial({ color: tone, shininess: 6 }));
  return skinCache.get(tone);
}

// painted face — sunny-day edition (no eye black by default, cap shadow instead)
const faceCache = new Map();
function faceMat(tone, look = {}) {
  const key = tone + '|' + JSON.stringify([look.brow ?? 1, look.eyeBlack ?? false, look.facial || 'none', look.eyeCol || '#241a12']);
  if (faceCache.has(key)) return faceCache.get(key);
  const cv = mkCanvas(256, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(150, 0, 106, 128);
  ctx.fillRect(0, 0, 22, 128);
  const cx = 64;
  ctx.strokeStyle = 'rgba(30,18,10,0.85)';
  ctx.lineWidth = 2.2 + (look.brow ?? 1) * 1.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 14, 50);
    ctx.quadraticCurveTo(cx + s * 9, 47.5, cx + s * 4.5, 49.5);
    ctx.stroke();
  }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#f2ede4';
    ctx.beginPath();
    ctx.ellipse(cx + s * 9, 57, 4.6, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.eyeCol || '#241a12';
    ctx.beginPath();
    ctx.arc(cx + s * 8.4, 57.4, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.eyeBlack) {
    ctx.fillStyle = 'rgba(20,16,14,0.8)';
    for (const s of [-1, 1]) ctx.fillRect(cx + s * 5.4 - 3.4, 63.5, 6.8, 3.4);
  }
  if (look.facial === 'stache' || look.facial === 'goatee') {
    ctx.fillStyle = 'rgba(28,18,10,0.9)';
    ctx.fillRect(cx - 7, 71.5, 14, 3.2);
  }
  if (look.facial === 'goatee') {
    ctx.fillStyle = 'rgba(28,18,10,0.9)';
    ctx.beginPath(); ctx.ellipse(cx, 82, 5.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(60,36,22,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 60); ctx.lineTo(cx, 68); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 6, 76); ctx.quadraticCurveTo(cx, 78.5, cx + 6, 76); ctx.stroke();
  const m = new THREE.MeshPhongMaterial({ map: tex(cv), shininess: 6 });
  faceCache.set(key, m);
  return m;
}

function jointBall(r, m) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
  b.castShadow = true;
  return b;
}

/**
 * Build one posable ballplayer.
 * info: { num, build, skin, look, throws: 'R'|'L' } — the mitt goes on the glove hand.
 * Returns { group, j, gripR, gripL, capParts, helmetParts, mitt }.
 */
export function buildBallplayer(kit, info = {}) {
  const b = BUILDS[info.build || 'avg'];
  const skin = skinMat(info.skin || '#c68863');
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hipY = 1.04;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  body.add(hips);

  const pelvis = capsule(0.15 * b.torso, 0.10, kit.pants, 1.05, 0.80);
  pelvis.position.y = 0.02;
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.13;
  hips.add(spine);
  const belly = capsule(0.160 * b.torso * (1 + b.belly * 0.14), 0.12, kit.jersey, 1.02, 0.84 + b.belly * 0.12);
  belly.position.y = 0.06;
  spine.add(belly);

  // belt where jersey meets pants
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.155 * b.torso, 0.020, 8, 18), kit.belt);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.04, 0.84, 1);
  belt.position.y = -0.02;
  spine.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.015), phong('#c8c8c0', { shin: 80 }));
  buckle.position.set(0, -0.02, 0.135 * b.torso);
  spine.add(buckle);

  const chest = new THREE.Group();
  chest.position.y = 0.26;
  spine.add(chest);
  const torso = torsoMesh(0.150 * b.torso, 0.172 * b.torso, 0.46, kit.jersey, 0.76);
  torso.scale.x = 1.04;
  torso.position.y = -0.07;
  chest.add(torso);

  // shoulder caps (skin-tight jersey, no pads) — raglan sleeve color
  for (const s of [-1, 1]) {
    const capM = new THREE.Mesh(
      new THREE.SphereGeometry(0.085 * b.shoulder, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      kit.u.style === 'classic' ? kit.sleevem : kit.jersey
    );
    capM.scale.set(1.05, 0.95, 1.0);
    capM.position.set(s * (0.205 * b.shoulder), 0.185, 0);
    capM.castShadow = true;
    chest.add(capM);
  }
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.016, 8, 16), kit.sleevem);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.235;
  chest.add(collar);
  // button placket down the front
  if (kit.u.style === 'classic') {
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.34, 0.012), kit.sleevem);
    placket.position.set(0, 0.02, 0.132 * b.torso);
    chest.add(placket);
  }

  // chest + back numbers
  const numTex = kit.numberOf(info.num ?? 0);
  const mkNum = (radius, h, zFlip) => {
    const geo = new THREE.CylinderGeometry(radius, radius, h, 14, 1, true, -0.42, 0.84);
    const mat = new THREE.MeshPhongMaterial({
      map: numTex, transparent: true, shininess: 4,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.FrontSide,
    });
    const m = new THREE.Mesh(geo, mat);
    if (zFlip) m.rotation.y = Math.PI;
    return m;
  };
  const front = mkNum(0.172 * b.torso * 0.86, 0.14, false);
  front.position.set(0.052, -0.02, 0.050 * b.torso); // off-heart, over the ribs
  front.scale.z = 0.60;
  chest.add(front);
  const back = mkNum(0.172 * b.torso * 0.86, 0.19, true);
  back.position.set(0, 0.03, -0.050 * b.torso);
  back.scale.z = 0.60;
  chest.add(back);

  // ---- head, cap, batting helmet
  const neck = new THREE.Group();
  neck.position.y = 0.27;
  chest.add(neck);
  const neckM = capsule(0.055, 0.05, skin);
  neckM.position.y = 0.01;
  neck.add(neckM);

  const head = new THREE.Group();
  head.position.y = 0.115;
  neck.add(head);

  const look = info.look || {};
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.107, 20, 16), faceMat(info.skin || '#c68863', look));
  face.position.set(0, -0.018, 0.032);
  face.scale.x = look.jaw ?? 1;
  head.add(face);

  // hair under the cap line
  if (look.hair && look.hair !== 'none') {
    const hairM = phong(look.hairCol || '#2a1c10', { shin: 8 });
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.110, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    hairCap.position.set(0, -0.012, 0.026);
    hairCap.scale.set(look.jaw ?? 1, 1, 1.02);
    head.add(hairCap);
  }

  const capParts = [];
  const helmetParts = [];
  // ball cap: crown + button + curved brim
  {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), kit.cap);
    crown.scale.set(1.0, 1.06, 1.06);
    crown.position.set(0, 0.020, 0.012);
    crown.castShadow = true;
    head.add(crown);
    capParts.push(crown);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), kit.brim);
    button.position.set(0, 0.142, 0.012);
    head.add(button);
    capParts.push(button);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 16, 1, false, -Math.PI * 0.42, Math.PI * 0.84), kit.brim);
    brim.scale.z = 1.35;
    brim.rotation.x = -0.12;
    brim.position.set(0, 0.062, 0.085);
    brim.castShadow = true;
    head.add(brim);
    capParts.push(brim);
  }
  // batting helmet: glossy shell + ear flap + short brim (hidden until at bat)
  {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), kit.helmet);
    shell.scale.set(1.02, 1.06, 1.10);
    shell.position.set(0, 0.008, 0.008);
    shell.castShadow = true;
    head.add(shell);
    helmetParts.push(shell);
    const flapSide = (info.bats === 'L' ? 1 : -1); // flap faces the pitcher
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), kit.helmet);
    flap.scale.set(0.42, 0.85, 0.85);
    flap.position.set(flapSide * 0.105, -0.035, 0.01);
    head.add(flap);
    helmetParts.push(flap);
    const hbrim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.013, 16, 1, false, -Math.PI * 0.36, Math.PI * 0.72), kit.helmet);
    hbrim.scale.z = 1.25;
    hbrim.rotation.x = -0.10;
    hbrim.position.set(0, 0.055, 0.088);
    head.add(hbrim);
    helmetParts.push(hbrim);
  }
  for (const p of helmetParts) p.visible = false;

  // ---- arms (bare forearms, jersey sleeve to the elbow)
  const arms = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const sh = new THREE.Group();
    sh.position.set(s * 0.225 * b.shoulder, 0.185, 0);
    chest.add(sh);
    sh.add(jointBall(0.062 * b.limb, kit.u.style === 'classic' ? kit.sleevem : kit.jersey));
    const sleeve = limb(0.060 * b.limb, 0.057 * b.limb, 0.044 * b.limb, 0.30, kit.u.style === 'classic' ? kit.sleevem : kit.jersey, 0.22);
    sh.add(sleeve);
    const el = new THREE.Group();
    el.position.y = -0.30;
    sh.add(el);
    el.add(jointBall(0.047 * b.limb, skin));
    const fore = limb(0.044 * b.limb, 0.051 * b.limb, 0.030 * b.limb, 0.27, skin, 0.3);
    el.add(fore);
    const wrist = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.012, 6, 12), kit.sleevem);
    wrist.rotation.x = Math.PI / 2;
    wrist.position.y = -0.20;
    el.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.049, 10, 8), skin);
    hand.scale.set(0.85, 1.15, 1.0);
    hand.position.y = -0.26;
    el.add(hand);
    // batting glove shell, toggled on at the plate
    const bglove = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), phong(info.gloveColor || '#c0273a', { shin: 20 }));
    bglove.scale.set(0.87, 1.17, 1.02);
    bglove.position.y = -0.26;
    bglove.visible = false;
    el.add(bglove);
    const grip = new THREE.Group();
    grip.position.y = -0.28;
    el.add(grip);
    arms['sh' + side] = sh;
    arms['el' + side] = el;
    arms['grip' + side] = grip;
    arms['hand' + side] = hand;
    arms['bglove' + side] = bglove;
  }

  // the mitt on the glove hand (opposite the throwing arm)
  const gloveSide = (info.throws || 'R') === 'R' ? 'L' : 'R';
  const mitt = new THREE.Group();
  {
    const pocket = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), kit.leather);
    pocket.scale.set(1.0, 1.15, 0.55);
    pocket.castShadow = true;
    mitt.add(pocket);
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.02), phong('#5e3618', { shin: 10 }));
    web.position.set(0, 0.085, 0);
    mitt.add(web);
    const lace = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 6, 14), phong('#c8a060'));
    lace.rotation.y = Math.PI / 2;
    mitt.add(lace);
  }
  const gloveHand = arms['el' + gloveSide];
  mitt.position.y = -0.27;
  mitt.rotation.x = -0.5;
  gloveHand.add(mitt);

  // ---- legs: baseball pants to the shin, sock/stirrup below
  const legs = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const th = new THREE.Group();
    th.position.set(s * 0.112, -0.04, 0);
    hips.add(th);
    th.add(jointBall(0.094 * b.limb, kit.pants));
    const thigh = limb(0.094 * b.limb, 0.092 * b.limb, 0.062 * b.limb, 0.49, kit.pants, 0.3);
    thigh.scale.z = 1.05;
    th.add(thigh);
    // pant piping
    if (kit.u.sleeve !== kit.u.pants) {
      const ps = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.30, 0.04), kit.sleevem);
      ps.position.set(s * 0.090 * b.limb, -0.18, 0);
      th.add(ps);
    }
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    th.add(knee);
    knee.add(jointBall(0.066 * b.limb, kit.pants));
    const calfPant = limb(0.062 * b.limb, 0.060 * b.limb, 0.052 * b.limb, 0.22, kit.pants, 0.5);
    knee.add(calfPant);
    const sock = limb(0.052 * b.limb, 0.060 * b.limb, 0.033 * b.limb, 0.26, kit.sock, 0.28);
    sock.position.y = -0.18;
    knee.add(sock);
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.100, 0.082, 0.26), kit.cleat);
    cleat.position.set(0, -0.115, 0.05);
    cleat.castShadow = true;
    ankle.add(cleat);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.050, 8, 6), kit.cleat);
    toe.scale.set(1, 0.76, 1.1);
    toe.position.set(0, -0.115, 0.175);
    ankle.add(toe);
    legs['thigh' + side] = th;
    legs['knee' + side] = knee;
    legs['ankle' + side] = ankle;
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group: root,
    baseY: 0,
    j: {
      body, hips, spine, chest, neck, head,
      shL: arms.shL, shR: arms.shR, elL: arms.elL, elR: arms.elR,
      thighL: legs.thighL, thighR: legs.thighR,
      kneeL: legs.kneeL, kneeR: legs.kneeR,
      ankleL: legs.ankleL, ankleR: legs.ankleR,
    },
    gripR: arms.gripR,
    gripL: arms.gripL,
    capParts,
    helmetParts,
    mitt,
    gloveSide,
    bgloves: [arms.bgloveL, arms.bgloveR],
    hands: [arms.handL, arms.handR],
  };
}

/** Show cap or batting helmet. mode: 'cap' | 'helmet' | 'none' */
export function setHeadgear(rig, mode) {
  for (const p of rig.capParts) p.visible = mode === 'cap';
  for (const p of rig.helmetParts) p.visible = mode === 'helmet';
}

/** Batting gloves on at the plate, off in the field. */
export function setBattingGloves(rig, on) {
  for (const g of rig.bgloves) g.visible = !!on;
}

/** Strap the tools of ignorance onto a catcher: mask, chest protector, shin guards. */
export function addCatcherGear(rig, kit) {
  const j = rig.j;
  const gear = [];
  const shellM = phong(kit.u.cap, { shin: 60, spec: '#888' });
  const padM = phong(kit.u.sleeve, { shin: 10 });
  const barM = phong('#c8c8c0', { shin: 60 });

  // mask: brow shell + cage bars in front of the face
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), shellM);
  brow.position.set(0, 0.02, 0.01);
  brow.scale.set(1.02, 1.0, 1.08);
  j.head.add(brow);
  gear.push(brow);
  for (const [y, arc, rad] of [[-0.01, 1.4, 0.135], [-0.055, 1.3, 0.135], [-0.10, 1.15, 0.128]]) {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.010, 6, 18, arc), barM);
    bar.rotation.x = Math.PI / 2;
    bar.rotation.z = Math.PI / 2 - arc / 2;
    bar.position.set(0, y, 0.040);
    j.head.add(bar);
    gear.push(bar);
  }
  for (const x of [-0.05, 0.05]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6), barM);
    v.position.set(x, -0.05, Math.sqrt(Math.max(0, 0.13 * 0.13 - x * x)) + 0.042);
    j.head.add(v);
    gear.push(v);
  }

  // chest protector
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.20, 6, 12), padM);
  chest.scale.set(1.12, 1, 0.45);
  chest.position.set(0, 0.02, 0.115);
  chest.castShadow = true;
  j.chest.add(chest);
  gear.push(chest);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.06, 6, 12), padM);
  belly.scale.set(1.1, 1, 0.4);
  belly.position.set(0, 0.05, 0.115);
  j.spine.add(belly);
  gear.push(belly);

  // shin guards on both legs
  for (const side of ['L', 'R']) {
    const knee = j['knee' + side];
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 6, 10), padM);
    shin.scale.set(1, 1, 0.6);
    shin.position.set(0, -0.20, 0.055);
    shin.castShadow = true;
    knee.add(shin);
    gear.push(shin);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), padM);
    cap.scale.set(1, 0.8, 0.7);
    cap.position.set(0, -0.015, 0.06);
    knee.add(cap);
    gear.push(cap);
  }
  rig.catcherGear = gear;
  return gear;
}

/** The bat: a lathe-turned barrel. Handle at local origin, barrel up +Y. */
export function buildBat(color = '#b8834a') {
  const pts = [
    new THREE.Vector2(0.028, 0),        // knob
    new THREE.Vector2(0.016, 0.015),
    new THREE.Vector2(0.014, 0.06),
    new THREE.Vector2(0.015, 0.30),
    new THREE.Vector2(0.024, 0.55),
    new THREE.Vector2(0.033, 0.75),
    new THREE.Vector2(0.035, 0.92),
    new THREE.Vector2(0.030, 0.97),
    new THREE.Vector2(0.0, 0.98),
  ];
  const wood = new THREE.MeshPhongMaterial({ color, shininess: 42, specular: '#6a4a22' });
  const bat = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), wood);
  bat.castShadow = true;
  const g = new THREE.Group();
  g.add(bat);
  return g;
}

/** The baseball: white leather, painted seams. Radius 0.05 world units. */
export function buildBaseball() {
  const cv = mkCanvas(128, 64);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#b0342c';
  ctx.lineWidth = 2.4;
  for (const off of [26, 102]) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = off + Math.sin(t * Math.PI * 2) * 9;
      const y = t * 64;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 10),
    new THREE.MeshPhongMaterial({ map: tex(cv), shininess: 30 })
  );
  ball.castShadow = true;
  const g = new THREE.Group();
  g.add(ball);
  return g;
}

/** Umpire: navy shirt, gray slacks, mask-less (little league style). */
export function buildUmp() {
  const kit = makeBBKit({
    jersey: '#1b2436', pants: '#6a6d74', cap: '#101420', brim: '#101420',
    sleeve: '#1b2436', numberFill: '#1b2436', numberStroke: '#1b2436',
    belt: '#17181c', socks: '#17181c', style: 'plain',
  });
  return buildBallplayer(kit, { num: '', build: 'big', skin: '#d8a87f' });
}
