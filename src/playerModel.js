// The athletes. A hand-built articulated rig: 16 posable joints, shoulder pads,
// helmet with facemask + decals, uniform styles, number decals, build variants.
// Forward is +Z in rig-local space. World units are yards; players stand ~2.0 tall.
import * as THREE from 'three';
import { mkCanvas, tex, numberCanvas, contrastText, shade } from './textures.js';

const matCache = new Map();
function phong(color, opts = {}) {
  const key = `${color}|${opts.shin || 0}|${opts.spec || ''}|${opts.flat || 0}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhongMaterial({
      color,
      shininess: opts.shin ?? 14,
      specular: opts.spec ?? '#2a2a2a',
      flatShading: !!opts.flat,
    }));
  }
  return matCache.get(key);
}

function capsule(r, len, mat, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), mat);
  m.scale.set(sx, 1, sz);
  m.castShadow = true;
  return m;
}

const BUILDS = {
  slim: { torso: 0.92, shoulder: 0.95, limb: 0.92, belly: 0 },
  avg:  { torso: 1.00, shoulder: 1.00, limb: 1.00, belly: 0 },
  big:  { torso: 1.10, shoulder: 1.07, limb: 1.10, belly: 0.3 },
  huge: { torso: 1.24, shoulder: 1.13, limb: 1.22, belly: 1 },
};

/**
 * A team kit: shared materials + cached number decals for one uniform config.
 * uniform: { jersey, pants, helmet, sleeve, numberFill, numberStroke, pantsStripe,
 *            helmetStripe, facemask, socks, style: 'classic'|'panel'|'plain', stripes2 }
 */
export function makeKit(uniform, logoCv) {
  const kit = {
    u: uniform,
    jersey: phong(uniform.jersey, { shin: 8 }),
    pants:  phong(uniform.pants, { shin: 22, spec: '#3a3a3a' }),
    helmet: phong(uniform.helmet, { shin: 90, spec: '#9a9a9a' }),
    mask:   phong(uniform.facemask, { shin: 30 }),
    sock:   phong(uniform.socks || '#f0f0ea'),
    trim:   phong(uniform.sleeve, { shin: 8 }),
    stripe: phong(uniform.helmetStripe, { shin: 60, spec: '#888' }),
    pstripe: phong(uniform.pantsStripe, { shin: 18 }),
    cleat:  phong('#17181c', { shin: 28 }),
    glove:  phong(uniform.gloves || '#f4f4f2', { shin: 10 }),
    numTex: new Map(),
    logoTex: null,
  };
  if (logoCv) {
    kit.logoTex = tex(logoCv);
  }
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

/** Build one posable player. info: { num, build, skin, accessories } */
export function buildPlayer(kit, info = {}) {
  const b = BUILDS[info.build || 'avg'];
  const skin = skinMat(info.skin || '#c68863');
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hipY = 1.04;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  body.add(hips);

  // pelvis
  const pelvis = capsule(0.15 * b.torso, 0.10, kit.pants, 1.06, 0.82);
  pelvis.position.y = 0.02;
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.13;
  hips.add(spine);
  const belly = capsule(0.165 * b.torso * (1 + b.belly * 0.14), 0.12, kit.jersey, 1.02, 0.85 + b.belly * 0.12);
  belly.position.y = 0.06;
  spine.add(belly);

  const chest = new THREE.Group();
  chest.position.y = 0.26;
  spine.add(chest);
  const torso = capsule(0.175 * b.torso, 0.26, kit.jersey, 1.06, 0.78);
  torso.position.y = 0.02;
  chest.add(torso);

  // shoulder pads
  const padR = 0.135 * b.shoulder * (b.torso * 0.5 + 0.5);
  for (const s of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(padR, 12, 10), kit.jersey);
    pad.scale.set(1.25, 0.62, 1.05);
    pad.position.set(s * 0.21 * b.shoulder, 0.20, 0);
    pad.castShadow = true;
    chest.add(pad);
    if (kit.u.style === 'panel') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(padR * 1.02, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), kit.trim);
      cap.scale.copy(pad.scale);
      cap.position.copy(pad.position);
      chest.add(cap);
    }
  }
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 16), kit.trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.245;
  chest.add(collar);

  // jersey side panels
  if (kit.u.style === 'panel') {
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.20), kit.trim);
      panel.position.set(s * 0.165 * b.torso, -0.02, 0);
      chest.add(panel);
    }
  }

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
  const front = mkNum(0.182 * b.torso * 0.86, 0.16, false);
  front.position.set(0, 0.02, 0.052 * b.torso);
  front.scale.z = 0.62;
  chest.add(front);
  const back = mkNum(0.182 * b.torso * 0.86, 0.19, true);
  back.position.set(0, 0.03, -0.052 * b.torso);
  back.scale.z = 0.62;
  chest.add(back);

  // ---- head & helmet
  const neck = new THREE.Group();
  neck.position.y = 0.27;
  chest.add(neck);
  const neckM = capsule(0.055, 0.05, skin);
  neckM.position.y = 0.01;
  neck.add(neckM);

  const head = new THREE.Group();
  head.position.y = 0.115;
  neck.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skin);
  face.position.set(0, -0.015, 0.03);
  head.add(face);

  const shellScale = new THREE.Vector3(1, 1.06, 1.16);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 14), kit.helmet);
  shell.scale.copy(shellScale);
  shell.position.y = 0.02;
  shell.castShadow = true;
  head.add(shell);

  // facemask: two horizontal arcs + vertical bars
  for (const [y, arc] of [[-0.02, 1.45], [-0.075, 1.30]]) {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.0115, 6, 18, arc), kit.mask);
    bar.rotation.x = Math.PI / 2;
    bar.rotation.z = Math.PI / 2 - arc / 2;
    bar.position.set(0, y, 0.038);
    head.add(bar);
  }
  for (const x of [-0.062, 0, 0.062]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.085, 6), kit.mask);
    v.position.set(x, -0.048, Math.sqrt(Math.max(0, 0.135 * 0.135 - x * x)) + 0.040);
    head.add(v);
  }
  // brow bumper
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.022, 0.02), phong('#1c1d22'));
  brow.position.set(0, 0.045, 0.165);
  head.add(brow);

  // helmet stripe(s) over the crown
  const mkStripe = (off) => {
    // ring stands in the YZ plane (rotateY); the arc runs nape → crown → brow.
    // local X maps to world -Z, so scale.x tracks the shell's front-back stretch.
    const arc = Math.PI * 1.12;
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.150, 0.013, 6, 28, arc), kit.stripe);
    s.rotation.set(0, Math.PI / 2, -0.10);
    s.scale.set(shellScale.z, shellScale.y, 1);
    s.position.set(off, 0.02, 0);
    return s;
  };
  if (kit.u.stripes2) {
    head.add(mkStripe(-0.024));
    head.add(mkStripe(0.024));
  } else if (kit.u.helmetStripe !== kit.u.helmet) {
    head.add(mkStripe(0));
  }

  // helmet side logos
  if (kit.logoTex) {
    for (const s of [-1, 1]) {
      const decal = new THREE.Mesh(
        new THREE.CircleGeometry(0.082, 20),
        new THREE.MeshPhongMaterial({ map: kit.logoTex, transparent: true, shininess: 60, polygonOffset: true, polygonOffsetFactor: -2 })
      );
      decal.position.set(s * 0.150, 0.012, 0.012);
      decal.rotation.y = s * Math.PI / 2;
      if (s < 0) decal.rotation.z = 0; // mirror naturally
      head.add(decal);
    }
  }

  // ---- arms
  const arms = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const sh = new THREE.Group();
    sh.position.set(s * 0.265 * b.shoulder, 0.185, 0);
    chest.add(sh);
    const sleeve = capsule(0.062 * b.limb, 0.16, kit.jersey);
    sleeve.position.y = -0.10;
    sh.add(sleeve);
    // sleeve trim bands
    if (kit.u.style === 'classic') {
      for (const [bandY, m] of [[-0.175, kit.trim], [-0.205, phong(kit.u.numberStroke)]]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.060 * b.limb, 0.012, 6, 14), m);
        band.rotation.x = Math.PI / 2;
        band.position.y = bandY;
        sh.add(band);
      }
    }
    const el = new THREE.Group();
    el.position.y = -0.30;
    sh.add(el);
    const fore = capsule(0.05 * b.limb, 0.16, skin);
    fore.position.y = -0.10;
    el.add(fore);
    // wristband
    const wrist = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.014, 6, 12), phong('#f4f4f2'));
    wrist.rotation.x = Math.PI / 2;
    wrist.position.y = -0.195;
    el.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), kit.glove);
    hand.scale.set(0.85, 1.15, 1.0);
    hand.position.y = -0.26;
    el.add(hand);
    const grip = new THREE.Group();
    grip.position.y = -0.28;
    el.add(grip);
    arms['sh' + side] = sh;
    arms['el' + side] = el;
    arms['grip' + side] = grip;
  }

  // ---- legs
  const legs = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const th = new THREE.Group();
    th.position.set(s * 0.115, -0.04, 0);
    hips.add(th);
    const thigh = capsule(0.094 * b.limb, 0.24, kit.pants, 1, 1.06);
    thigh.position.y = -0.18;
    th.add(thigh);
    // pant side stripe
    if (kit.u.pantsStripe !== kit.u.pants) {
      const ps = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.30, 0.05), kit.pstripe);
      ps.position.set(s * 0.095 * b.limb, -0.18, 0);
      th.add(ps);
    }
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    th.add(knee);
    const calfPant = capsule(0.066 * b.limb, 0.07, kit.pants);
    calfPant.position.y = -0.045;
    knee.add(calfPant);
    const sock = capsule(0.058 * b.limb, 0.17, kit.sock);
    sock.position.y = -0.24;
    knee.add(sock);
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.085, 0.27), kit.cleat);
    cleat.position.set(0, -0.115, 0.055);
    cleat.castShadow = true;
    ankle.add(cleat);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), kit.cleat);
    toe.scale.set(1, 0.78, 1.1);
    toe.position.set(0, -0.115, 0.185);
    ankle.add(toe);
    legs['thigh' + side] = th;
    legs['knee' + side] = knee;
    legs['ankle' + side] = ankle;
  }

  // optional towel for skill players
  if (info.accessories?.towel) {
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.015), phong('#f4f4f0'));
    towel.position.set(0.10, -0.06, 0.13);
    towel.rotation.x = 0.1;
    hips.add(towel);
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
  };
}

// ------------------------------------------------------------------ extras

/** Striped official with a cap and a whistle-ready stance. */
export function buildRef() {
  const cv = mkCanvas(64, 64);
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#16161a' : '#f4f4f2';
    ctx.fillRect(i * 8, 0, 8, 64);
  }
  const stripeTex = tex(cv, { repeat: [2, 1] });
  const kit = makeKit({
    jersey: '#ffffff', pants: '#ffffff', helmet: '#16161a', sleeve: '#16161a',
    numberFill: '#16161a', numberStroke: '#16161a', pantsStripe: '#ffffff',
    helmetStripe: '#16161a', facemask: '#16161a', socks: '#16161a', style: 'plain',
  });
  const rig = buildPlayer(kit, { num: '', build: 'avg', skin: '#c68863' });
  // re-skin torso parts with stripes, swap helmet for a cap
  rig.j.chest.traverse((o) => {
    if (o.isMesh && o.material === kit.jersey) {
      o.material = new THREE.MeshPhongMaterial({ map: stripeTex, shininess: 4 });
    }
  });
  rig.j.head.children.forEach((c) => { c.visible = false; });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat('#c68863'));
  rig.j.head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), phong('#16161a'));
  cap.position.y = 0.035;
  rig.j.head.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.10), phong('#16161a'));
  brim.position.set(0, 0.045, 0.12);
  rig.j.head.add(brim);
  return rig;
}

/** Sideline coach: polo, khakis, cap, headset. */
export function buildCoach(primary, secondary) {
  const kit = makeKit({
    jersey: primary, pants: '#b8a888', helmet: primary, sleeve: secondary,
    numberFill: primary, numberStroke: primary, pantsStripe: '#b8a888',
    helmetStripe: primary, facemask: '#222', socks: '#222', style: 'plain',
  });
  const rig = buildPlayer(kit, { num: '', build: 'big', skin: '#d8a87f' });
  rig.j.head.children.forEach((c) => { c.visible = false; });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat('#d8a87f'));
  rig.j.head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), phong(secondary));
  cap.position.y = 0.035;
  rig.j.head.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.10), phong(secondary));
  brim.position.set(0, 0.045, 0.12);
  rig.j.head.add(brim);
  // headset
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.011, 6, 14, Math.PI), phong('#23242a'));
  band.rotation.z = Math.PI;
  band.rotation.y = Math.PI / 2;
  rig.j.head.add(band);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6), phong('#23242a'));
  mic.rotation.z = 1.1;
  mic.position.set(0.05, -0.04, 0.09);
  rig.j.head.add(mic);
  return rig;
}

/** The football: prolate spheroid + stripes + laces. */
export function buildBall() {
  const g = new THREE.Group();
  const leather = new THREE.MeshPhongMaterial({ color: '#7a3c1e', shininess: 24, specular: '#553322' });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), leather);
  ball.scale.set(1.65, 1, 1);
  ball.castShadow = true;
  g.add(ball);
  for (const x of [-0.095, 0.095]) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16), phong('#f4f4f2'));
    stripe.rotation.y = Math.PI / 2;
    stripe.position.x = x;
    stripe.scale.set(0.82, 0.82, 1.4);
    g.add(stripe);
  }
  const lace = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.018), phong('#f4f4f2'));
  lace.position.y = 0.092;
  g.add(lace);
  for (let i = 0; i < 4; i++) {
    const x = -0.036 + i * 0.024;
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.045), phong('#f4f4f2'));
    cross.position.set(x, 0.094, 0);
    g.add(cross);
  }
  // long axis = X
  return g;
}
