// The ballers. Same articulated 16-joint rig that powers VARSITY 27, rebuilt
// for the hardwood: tank jerseys, baggy shorts, sneakers, headbands, and a
// head you can actually see — so the hair matters now.
// Forward is +Z in rig-local space. World units are meters; rig stands ~2.0.
import * as THREE from 'three';
import { mkCanvas, tex, shade } from './util.js';

const matCache = new Map();
function phong(color, opts = {}) {
  const key = `${color}|${opts.shin || 0}|${opts.spec || ''}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhongMaterial({
      color,
      shininess: opts.shin ?? 14,
      specular: opts.spec ?? '#2a2a2a',
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

/** A sculpted limb: smooth taper with muscle bulge, hangs from y=0 to y=-len. */
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

/** A contoured torso: waist → chest swell → shoulder taper. */
function torsoMesh(rWaist, rChest, h, mat, zScale = 0.78) {
  const pts = [];
  const profile = [
    [0.30, rWaist], [0.05, rWaist * 1.02], [-0.25, rChest * 0.99],
    [-0.45, rChest], [-0.62, rChest * 0.92], [-0.72, rChest * 0.72],
  ];
  for (const [y, r] of profile) pts.push(new THREE.Vector2(r, -y * h));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat);
  m.scale.z = zScale;
  m.castShadow = true;
  return m;
}

const BUILDS = {
  slim: { torso: 0.90, shoulder: 0.94, limb: 0.90 },
  avg:  { torso: 1.00, shoulder: 1.00, limb: 1.00 },
  big:  { torso: 1.10, shoulder: 1.08, limb: 1.12 },
};

const skinCache = new Map();
function skinMat(tone) {
  if (!skinCache.has(tone)) skinCache.set(tone, new THREE.MeshPhongMaterial({ color: tone, shininess: 10, specular: '#443322' }));
  return skinCache.get(tone);
}

// face painted onto the head sphere: eyes, brows, nose, mouth, facial hair.
// Sphere UV: front (+z) sits at u=0.25, eyes just above the equator.
const faceCache = new Map();
function faceMat(tone, look = {}) {
  const key = tone + '|' + JSON.stringify([look.facial || 'none', look.hairCol || '']);
  if (faceCache.has(key)) return faceCache.get(key);
  const cv = mkCanvas(256, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(150, 0, 106, 128);
  ctx.fillRect(0, 0, 22, 128);
  const cx = 64; // u = 0.25 → front center
  // brows
  ctx.strokeStyle = 'rgba(30,18,10,0.85)';
  ctx.lineWidth = 3.4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 14, 50);
    ctx.quadraticCurveTo(cx + s * 9, 47.5, cx + s * 4.5, 49.5);
    ctx.stroke();
  }
  // eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#f2ede4';
    ctx.beginPath();
    ctx.ellipse(cx + s * 9, 57, 4.6, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241a12';
    ctx.beginPath();
    ctx.arc(cx + s * 8.4, 57.4, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // facial hair
  const hc = look.hairCol || '#1c120a';
  if (look.facial === 'stache' || look.facial === 'goatee') {
    ctx.fillStyle = hc;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(cx - 7, 70.5, 14, 3.4);
    ctx.globalAlpha = 1;
  }
  if (look.facial === 'goatee') {
    ctx.fillStyle = hc;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(cx, 82, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // nose + mouth hints
  ctx.strokeStyle = 'rgba(60,36,22,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 60); ctx.lineTo(cx, 68); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 6, 76); ctx.quadraticCurveTo(cx, 78.5, cx + 6, 76); ctx.stroke();
  const m = new THREE.MeshPhongMaterial({ map: tex(cv), shininess: 8 });
  faceCache.set(key, m);
  return m;
}

function numberCanvas(num, fill, stroke) {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.font = `900 196px 'Arial Narrow', Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 26;
  ctx.strokeText(String(num), 128, 140);
  ctx.fillStyle = fill;
  ctx.fillText(String(num), 128, 140);
  return cv;
}

/** A small sphere parented at a joint pivot so bent limbs never show gaps. */
function jointBall(r, m) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
  b.castShadow = true;
  return b;
}

/**
 * A crew kit: shared materials + cached number decals for one uniform.
 * colors: { primary, secondary }
 */
export function makeKit(colors) {
  const numberFill = '#f4f4f2';
  const kit = {
    colors,
    jersey: phong(colors.primary, { shin: 10 }),
    shorts: phong(colors.primary, { shin: 10 }),
    trim:   phong(colors.secondary, { shin: 10 }),
    band:   phong(colors.secondary, { shin: 6 }),
    shoe:   phong(shade(colors.primary, 18), { shin: 60, spec: '#888888' }),
    sole:   phong('#f0efe8', { shin: 30 }),
    sock:   phong('#f0efe8'),
    numberFill,
    numTex: new Map(),
  };
  kit.numberOf = (num) => {
    if (!kit.numTex.has(num)) {
      kit.numTex.set(num, tex(numberCanvas(num, numberFill, colors.secondary)));
    }
    return kit.numTex.get(num);
  };
  return kit;
}

function addHair(head, look) {
  const style = look.hair || 'buzz';
  if (style === 'bald') return;
  const hairM = phong(look.hairCol || '#1c120a', { shin: 6 });
  if (style !== 'afro') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
    cap.position.set(0, -0.008, 0.024);
    cap.scale.set(1, style === 'buzz' ? 0.98 : 1.05, 1.04);
    head.add(cap);
  }
  if (style === 'afro') {
    const fro = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10), hairM);
    fro.position.set(0, 0.055, 0.012);
    fro.scale.set(1.02, 0.92, 1.02);
    fro.castShadow = true;
    head.add(fro);
  } else if (style === 'hightop') {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 12), hairM);
    top.position.set(0, 0.135, 0.018);
    top.castShadow = true;
    head.add(top);
  } else if (style === 'curls') {
    for (const [hx, hz] of [[-0.05, 0.05], [0.05, 0.05], [0, -0.02]]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), hairM);
      puff.position.set(hx, 0.085, hz + 0.03);
      head.add(puff);
    }
  } else if (style === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), hairM);
    bun.position.set(0, 0.075, -0.085);
    head.add(bun);
  } else if (style === 'braids') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.5;
      const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.10, 4, 6), hairM);
      braid.position.set(Math.sin(a) * 0.082, 0.02, -0.055 - Math.abs(Math.cos(a)) * 0.03);
      braid.rotation.x = 0.5;
      braid.rotation.z = -a * 0.35;
      head.add(braid);
    }
  }
}

/** Build one posable baller. info: { num, build, h, look } — look from teams.js. */
export function buildPlayer(kit, info = {}) {
  const b = BUILDS[info.build || 'avg'];
  const look = info.look || {};
  const skin = skinMat(look.skin || '#8d5a3b');
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hipY = 1.04;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  body.add(hips);

  // pelvis — top of the shorts
  const pelvis = capsule(0.155 * b.torso, 0.10, kit.shorts, 1.06, 0.84);
  pelvis.position.y = 0.02;
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.13;
  hips.add(spine);
  const belly = capsule(0.158 * b.torso, 0.12, kit.jersey, 1.02, 0.85);
  belly.position.y = 0.06;
  spine.add(belly);

  const chest = new THREE.Group();
  chest.position.y = 0.26;
  spine.add(chest);
  const torso = torsoMesh(0.150 * b.torso, 0.175 * b.torso, 0.46, kit.jersey, 0.78);
  torso.scale.x = 1.06;
  torso.position.y = -0.07;
  chest.add(torso);

  // jersey side panels in the trim color
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.19), kit.trim);
    panel.position.set(s * 0.158 * b.torso, -0.02, 0);
    chest.add(panel);
  }
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.016, 8, 16), kit.trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.215;
  chest.add(collar);

  // chest + back numbers on curved decals
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
  const front = mkNum(0.175 * b.torso * 0.86, 0.15, false);
  front.position.set(0, 0.0, 0.05 * b.torso);
  front.scale.z = 0.62;
  chest.add(front);
  const back = mkNum(0.175 * b.torso * 0.86, 0.18, true);
  back.position.set(0, 0.02, -0.05 * b.torso);
  back.scale.z = 0.62;
  chest.add(back);

  // ---- head (no helmet in this league)
  const neck = new THREE.Group();
  neck.position.y = 0.27;
  chest.add(neck);
  const neckM = capsule(0.05, 0.05, skin);
  neckM.position.y = 0.01;
  neck.add(neckM);

  const head = new THREE.Group();
  head.position.y = 0.115;
  neck.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.107, 20, 16), faceMat(look.skin || '#8d5a3b', look));
  face.position.set(0, -0.005, 0.018);
  face.castShadow = true;
  head.add(face);
  // ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * 0.105, -0.01, 0.01);
    head.add(ear);
  }
  addHair(head, look);
  if (look.headband) {
    const hb = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 8, 18), kit.band);
    hb.rotation.x = Math.PI / 2 - 0.18;
    hb.position.set(0, 0.035, 0.015);
    head.add(hb);
  }

  // ---- arms (bare — tank top league)
  const arms = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const sleeved = look.sleeve === side;
    const armMat = sleeved ? kit.trim : skin;
    const sh = new THREE.Group();
    sh.position.set(s * 0.235 * b.shoulder, 0.185, 0);
    chest.add(sh);
    sh.add(jointBall(0.062 * b.limb, armMat));
    // armhole trim ring where the jersey ends
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055 * b.limb, 0.012, 6, 14), kit.trim);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(s * -0.012, 0.01, 0);
    sh.add(ring);
    const upper = limb(0.058 * b.limb, 0.062 * b.limb, 0.044 * b.limb, 0.30, armMat, 0.30);
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.29;
    sh.add(el);
    el.add(jointBall(0.046 * b.limb, armMat));
    const fore = limb(0.043 * b.limb, 0.05 * b.limb, 0.030 * b.limb, 0.27, sleeved ? armMat : skin, 0.3);
    el.add(fore);
    // wristband
    const wrist = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.013, 6, 12), kit.band);
    wrist.rotation.x = Math.PI / 2;
    wrist.position.y = -0.20;
    el.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
    hand.scale.set(0.85, 1.2, 1.0);
    hand.position.y = -0.265;
    el.add(hand);
    const grip = new THREE.Group();
    grip.position.y = -0.30;
    el.add(grip);
    arms['sh' + side] = sh;
    arms['el' + side] = el;
    arms['grip' + side] = grip;
  }

  // ---- legs: baggy shorts to the knee, then skin, low socks, sneakers
  const legs = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const th = new THREE.Group();
    th.position.set(s * 0.112, -0.04, 0);
    hips.add(th);
    th.add(jointBall(0.096 * b.limb, kit.shorts));
    const short = limb(0.098 * b.limb, 0.10 * b.limb, 0.085 * b.limb, 0.42, kit.shorts, 0.4);
    short.scale.z = 1.06;
    th.add(short);
    // shorts side stripe
    const ps = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.30, 0.05), kit.trim);
    ps.position.set(s * 0.094 * b.limb, -0.20, 0);
    th.add(ps);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    th.add(knee);
    knee.add(jointBall(0.055 * b.limb, skin));
    const calf = limb(0.052 * b.limb, 0.062 * b.limb, 0.032 * b.limb, 0.30, skin, 0.30);
    knee.add(calf);
    const sock = limb(0.04 * b.limb, 0.045 * b.limb, 0.034 * b.limb, 0.12, kit.sock, 0.4);
    sock.position.y = -0.30;
    knee.add(sock);
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.075, 0.25), kit.shoe);
    shoe.position.set(0, -0.115, 0.05);
    shoe.castShadow = true;
    ankle.add(shoe);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), kit.shoe);
    toe.scale.set(1, 0.75, 1.1);
    toe.position.set(0, -0.118, 0.17);
    ankle.add(toe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.025, 0.28), kit.sole);
    sole.position.set(0, -0.155, 0.06);
    ankle.add(sole);
    legs['thigh' + side] = th;
    legs['knee' + side] = knee;
    legs['ankle' + side] = ankle;
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // height: the bare rig stands ~2.02m
  const scale = (info.h || 2.0) / 2.02;
  root.scale.setScalar(scale);

  return {
    group: root,
    scale,
    j: {
      body, hips, spine, chest, neck, head,
      shL: arms.shL, shR: arms.shR, elL: arms.elL, elR: arms.elR,
      thighL: legs.thighL, thighR: legs.thighR,
      kneeL: legs.kneeL, kneeR: legs.kneeR,
      ankleL: legs.ankleL, ankleR: legs.ankleR,
    },
    gripR: arms.gripR,
    gripL: arms.gripL,
  };
}

/** The rock: orange sphere, black channel seams. */
export function buildBall() {
  const g = new THREE.Group();
  const rubber = new THREE.MeshPhongMaterial({ color: '#d96b27', shininess: 18, specular: '#553311' });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.121, 18, 14), rubber);
  ball.castShadow = true;
  g.add(ball);
  const seamM = new THREE.MeshPhongMaterial({ color: '#26180e', shininess: 8 });
  const mkSeam = (rx, ry) => {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.1205, 0.0045, 5, 32), seamM);
    s.rotation.x = rx; s.rotation.y = ry;
    g.add(s);
  };
  mkSeam(0, 0);
  mkSeam(0, Math.PI / 2);
  mkSeam(Math.PI / 2, 0);
  return g;
}
