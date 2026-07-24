// The mascots: chunky low-poly rigs built from a parts kit. Every fighter is
// the same 14-joint skeleton wearing different geometry, so one clip library
// animates all of them.
//
// N64 budget, enforced by taste: boxes, 8-segment cylinders, 8x6 spheres,
// flat shading, no textures on the bodies at all (colour blocks only), eyes and
// mouths built as separate chunky meshes so they stay readable at 1/3 render
// resolution. A whole fighter lands around 300-450 triangles.
import * as THREE from 'three';

const D2R = Math.PI / 180;

function mat(color, { shin = 0, flat = true } = {}) {
  return new THREE.MeshPhongMaterial({
    color, flatShading: flat, shininess: shin, specular: shin ? '#8a8a8a' : '#101010',
  });
}

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1), m);
const sph = (r, m, seg = 8, rings = 6) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, rings), m);
const cone = (r, h, m, seg = 6) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);

function put(mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx * D2R, ry * D2R, rz * D2R);
  return mesh;
}

// ---------------------------------------------------------------- heads
function buildHead(spec, M, s) {
  const g = new THREE.Group();
  const kind = spec.kind || 'round';
  const r = (spec.size || 0.19) * s;
  const eyeStyle = spec.eyes || 'dot';

  let skull;
  if (kind === 'box') skull = box(r * 1.9, r * 1.9, r * 1.8, M.body);
  else if (kind === 'tall') skull = box(r * 1.6, r * 2.3, r * 1.7, M.body);
  else if (kind === 'wide') skull = box(r * 2.4, r * 1.5, r * 1.9, M.body);
  else if (kind === 'dome') { skull = sph(r, M.body, 8, 5); skull.scale.set(1.15, 0.95, 1.05); }
  else skull = sph(r, M.body, 8, 6);
  // box heads are flatter than spheres — seat them lower so nothing floats
  skull.position.y = (kind === 'round' || kind === 'dome') ? r * 0.9 : r * 0.78;
  g.add(skull);
  const neck = cyl(r * 0.46, r * 0.52, r * 0.5, M.skin2 || M.body, 6);
  neck.position.y = r * 0.1;
  g.add(neck);

  // face plate: a lighter muzzle/belly-coloured front so the face reads
  if (spec.face !== false) {
    const f = box(r * 1.25, r * 0.95, r * 0.5, M.skin);
    put(f, 0, r * 0.72, r * (kind === 'box' ? 0.85 : 0.78));
    g.add(f);
  }

  if (spec.snout) {
    const sn = box(r * 0.95, r * 0.72, r * 1.0, M.skin);
    put(sn, 0, r * 0.6, r * 1.25);
    g.add(sn);
    if (spec.teeth) {
      for (const sx of [-1, 1]) {
        const t = cone(r * 0.14, r * 0.4, M.white, 4);
        put(t, sx * r * 0.3, r * 0.3, r * 1.6, 180);
        g.add(t);
      }
    }
    if (spec.nose) {
      const n = box(r * 0.34, r * 0.2, r * 0.16, M.dark);
      put(n, 0, r * 0.78, r * 1.74);
      g.add(n);
    }
  }
  if (spec.beak) {
    const b = cone(r * 0.5, r * 0.95, M.trim2 || M.trim, 4);
    put(b, 0, r * 0.72, r * 1.35, 90, 45, 0);
    g.add(b);
  }
  if (spec.horns) {
    for (const sx of [-1, 1]) {
      const h = cone(r * 0.22, r * 0.85, M.white, 5);
      put(h, sx * r * 0.75, r * 1.5, 0, -14, 0, sx * 26);
      g.add(h);
    }
  }
  if (spec.ears === 'round') {
    for (const sx of [-1, 1]) {
      const e = cyl(r * 0.42, r * 0.42, r * 0.16, M.body, 8);
      put(e, sx * r * 0.9, r * 1.45, 0, 0, 0, 90);
      g.add(e);
      const i = cyl(r * 0.24, r * 0.24, r * 0.2, M.skin, 8);
      put(i, sx * r * 1.0, r * 1.45, 0, 0, 0, 90);
      g.add(i);
    }
  } else if (spec.ears === 'long') {
    for (const sx of [-1, 1]) {
      const e = box(r * 0.3, r * 1.1, r * 0.24, M.body);
      put(e, sx * r * 0.7, r * 2.05, -r * 0.1, 0, 0, sx * 12);
      g.add(e);
    }
  } else if (spec.ears === 'fin') {
    for (const sx of [-1, 1]) {
      const e = box(r * 0.7, r * 0.5, r * 0.1, M.trim);
      put(e, sx * r * 1.05, r * 1.0, -r * 0.2, 0, sx * 22, 0);
      g.add(e);
    }
  }
  if (spec.crest) {
    for (let i = 0; i < 3; i++) {
      const c = cone(r * (0.3 - i * 0.06), r * (0.7 - i * 0.14), M.trim, 4);
      put(c, 0, r * (1.85 - i * 0.06), -r * (0.15 + i * 0.42), -22 - i * 8);
      g.add(c);
    }
  }
  if (spec.antenna) {
    const stalk = cyl(r * 0.07, r * 0.07, r * 0.8, M.dark, 5);
    put(stalk, 0, r * 2.15, 0);
    g.add(stalk);
    const bulb = sph(r * 0.2, M.glow || M.trim, 6, 4);
    put(bulb, 0, r * 2.6, 0);
    g.add(bulb);
  }
  if (spec.visor) {
    const v = box(r * 1.7, r * 0.5, r * 0.24, M.glow || M.trim);
    put(v, 0, r * 1.0, r * (kind === 'box' ? 0.94 : 0.84));
    g.add(v);
  }
  if (spec.hat === 'cap') {
    const c = cyl(r * 1.0, r * 1.08, r * 0.42, M.trim, 8);
    put(c, 0, r * 1.86, 0);
    g.add(c);
    const brim = box(r * 1.5, r * 0.14, r * 0.9, M.trim);
    put(brim, 0, r * 1.66, r * 0.85);
    g.add(brim);
  } else if (spec.hat === 'helm') {
    const c = sph(r * 1.06, M.metal || M.trim, 8, 5);
    c.scale.set(1.1, 0.9, 1.05);
    put(c, 0, r * 1.15, 0);
    g.add(c);
    const crestPiece = box(r * 0.16, r * 0.5, r * 1.6, M.trim);
    put(crestPiece, 0, r * 2.0, -r * 0.05);
    g.add(crestPiece);
  } else if (spec.hat === 'band') {
    const c = box(r * 1.95, r * 0.34, r * 1.85, M.trim);
    put(c, 0, r * 1.34, 0);
    g.add(c);
    const tail = box(r * 0.22, r * 0.9, r * 0.1, M.trim);
    put(tail, -r * 0.9, r * 1.0, -r * 0.9, 0, 0, 18);
    g.add(tail);
  }

  // ---- eyes: normal pair + a KO'd X pair that swaps in on a stock loss
  const eyes = new THREE.Group();
  const koEyes = new THREE.Group();
  const ez = r * (kind === 'box' ? 0.92 : 0.84);
  const ey = r * 1.05;
  const ex = r * 0.42;
  for (const sx of [-1, 1]) {
    if (eyeStyle === 'wide') {
      const white = sph(r * 0.3, M.white, 6, 4);
      put(white, sx * ex * 1.15, ey, ez * 0.9);
      eyes.add(white);
      const pup = box(r * 0.14, r * 0.18, r * 0.1, M.eye);
      put(pup, sx * ex * 1.15, ey, ez * 1.15);
      eyes.add(pup);
    } else if (eyeStyle === 'stalk') {
      const stalk = cyl(r * 0.1, r * 0.1, r * 0.4, M.body, 5);
      put(stalk, sx * ex, r * 1.7, ez * 0.3);
      eyes.add(stalk);
      const ball = sph(r * 0.22, M.white, 6, 4);
      put(ball, sx * ex, r * 1.95, ez * 0.3);
      eyes.add(ball);
      const pup = box(r * 0.12, r * 0.14, r * 0.1, M.eye);
      put(pup, sx * ex, r * 1.95, ez * 0.5);
      eyes.add(pup);
    } else {
      const e = box(r * 0.24, r * 0.3, r * 0.12, M.white);
      put(e, sx * ex, ey, ez);
      eyes.add(e);
      const pup = box(r * 0.12, r * 0.16, r * 0.1, M.eye);
      put(pup, sx * ex + sx * r * 0.03, ey, ez + r * 0.05);
      eyes.add(pup);
    }
    // the X: two crossed bars
    for (const rot of [38, -38]) {
      const bar = box(r * 0.34, r * 0.08, r * 0.08, M.dark);
      put(bar, sx * ex, ey, ez + r * 0.06, 0, 0, rot);
      koEyes.add(bar);
    }
  }
  koEyes.visible = false;
  g.add(eyes, koEyes);

  if (spec.brows) {
    for (const sx of [-1, 1]) {
      const b = box(r * 0.34, r * 0.09, r * 0.1, M.dark);
      put(b, sx * ex, ey + r * 0.28, ez, 0, 0, sx * -14);
      g.add(b);
    }
  }
  if (spec.mouth !== false && !spec.beak) {
    const m = box(r * 0.5, r * 0.11, r * 0.1, M.dark);
    put(m, 0, r * 0.5, ez + (spec.snout ? r * 0.9 : 0));
    g.add(m);
  }

  return { group: g, eyes, koEyes, r };
}

// ---------------------------------------------------------------- torso
function buildTorso(spec, M, s) {
  const g = new THREE.Group();
  const w = (spec.w || 0.34) * s, h = (spec.h || 0.44) * s, d = (spec.d || 0.26) * s;
  const kind = spec.kind || 'box';
  let body;
  if (kind === 'round') { body = sph(w * 0.62, M.body, 8, 6); body.scale.set(1, h / (w * 1.2), d / w * 1.1); }
  else if (kind === 'barrel') body = cyl(w * 0.52, w * 0.62, h, M.body, 8);
  else if (kind === 'pear') body = cyl(w * 0.44, w * 0.68, h, M.body, 8);
  else if (kind === 'blob') { body = sph(w * 0.7, M.body, 8, 6); body.scale.set(1, 0.86, 0.9); }
  else body = box(w, h, d, M.body);
  body.position.y = h * 0.5;
  g.add(body);

  if (spec.belly !== false) {
    const b = box(w * 0.6, h * 0.62, d * 0.5, M.skin);
    put(b, 0, h * 0.44, d * 0.52);
    g.add(b);
  }
  if (spec.chestMark) {
    const c = box(w * 0.36, h * 0.3, d * 0.2, M.trim);
    put(c, 0, h * 0.62, d * 0.68);
    g.add(c);
  }
  if (spec.belt) {
    const b = box(w * 1.06, h * 0.14, d * 1.06, M.trim);
    put(b, 0, h * 0.1, 0);
    g.add(b);
    const buckle = box(w * 0.3, h * 0.16, d * 0.2, M.metal || M.white);
    put(buckle, 0, h * 0.1, d * 0.6);
    g.add(buckle);
  }
  if (spec.pads) {
    for (const sx of [-1, 1]) {
      const p = sph(w * 0.34, M.trim, 8, 5);
      p.scale.set(1, 0.7, 0.9);
      put(p, sx * w * 0.56, h * 0.94, 0);
      g.add(p);
    }
  }
  if (spec.shell) {
    const sh = sph(w * 0.72, M.trim, 8, 6);
    sh.scale.set(1, 0.8, 0.55);
    put(sh, 0, h * 0.56, -d * 0.55);
    g.add(sh);
  }
  if (spec.cape) {
    const c = box(w * 1.1, h * 1.5, d * 0.12, M.trim);
    put(c, 0, h * 0.1, -d * 0.62, 6);
    g.add(c);
  }
  if (spec.pack) {
    const p = box(w * 0.72, h * 0.6, d * 0.44, M.metal || M.trim);
    put(p, 0, h * 0.6, -d * 0.72);
    g.add(p);
    for (const sx of [-1, 1]) {
      const noz = cyl(w * 0.1, w * 0.13, h * 0.2, M.dark, 6);
      put(noz, sx * w * 0.22, h * 0.28, -d * 0.72);
      g.add(noz);
    }
  }
  if (spec.jersey) {
    const j = box(w * 1.04, h * 0.5, d * 1.04, M.trim);
    put(j, 0, h * 0.66, 0);
    g.add(j);
  }
  return { group: g, w, h, d };
}

// ---------------------------------------------------------------- limbs
function buildArm(side, spec, M, s, torsoW, torsoH) {
  // shoulder joint group at the top corner of the torso
  const sh = new THREE.Group();
  sh.position.set(side * torsoW * 0.58, torsoH * 0.86, 0);
  const len = (spec.arm || 0.3) * s;
  // limbs are deliberately fat: at a third of the screen resolution a thin arm
  // breaks up into loose pixels and the hand looks detached from the body
  const r = (spec.armR || 0.075) * s * 1.22;
  const kind = spec.armKind || 'tube';
  const upper = kind === 'box' ? box(r * 2, len * 0.52, r * 2, M.body) : cyl(r, r * 0.94, len * 0.52, M.body, 7);
  upper.position.y = -len * 0.26;
  sh.add(upper);
  if (spec.sleeve) {
    const sl = kind === 'box' ? box(r * 2.2, len * 0.2, r * 2.2, M.trim) : cyl(r * 1.12, r * 1.06, len * 0.2, M.trim, 7);
    sl.position.y = -len * 0.06;
    sh.add(sl);
  }
  const el = new THREE.Group();
  el.position.y = -len * 0.52;
  sh.add(el);
  const fore = kind === 'box' ? box(r * 1.8, len * 0.42, r * 1.8, M.skin2 || M.body) : cyl(r * 0.94, r * 0.86, len * 0.42, M.skin2 || M.body, 7);
  fore.position.y = -len * 0.21;
  el.add(fore);
  // hand
  const paw = spec.paw || 'glove';
  let hand;
  if (paw === 'mitt') { hand = sph(r * 1.5, M.white, 8, 5); }
  else if (paw === 'claw') {
    hand = new THREE.Group();
    const palm = box(r * 1.6, r * 1.5, r * 1.3, M.skin2 || M.body);
    hand.add(palm);
    for (let i = -1; i <= 1; i++) {
      const c = cone(r * 0.24, r * 0.8, M.white, 4);
      put(c, i * r * 0.5, -r * 0.9, r * 0.2, 180);
      hand.add(c);
    }
  } else if (paw === 'metal') { hand = box(r * 1.7, r * 1.7, r * 1.6, M.metal || M.trim); }
  else if (paw === 'hoof') { hand = cyl(r * 1.2, r * 1.4, r * 1.4, M.dark, 6); }
  else { hand = sph(r * 1.36, M.glove || M.white, 8, 5); }
  hand.position.y = -len * 0.5;
  el.add(hand);
  return { sh, el, hand };
}

function buildLeg(side, spec, M, s, torsoW) {
  const hip = new THREE.Group();
  hip.position.set(side * torsoW * 0.26, 0, 0);
  const len = (spec.leg || 0.32) * s;
  const r = (spec.legR || 0.085) * s * 1.18;
  const kind = spec.legKind || 'tube';
  const thigh = kind === 'box' ? box(r * 2.1, len * 0.54, r * 2.1, M.body) : cyl(r * 1.05, r, len * 0.54, M.body, 7);
  thigh.position.y = -len * 0.27;
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.y = -len * 0.54;
  hip.add(knee);
  const shin = kind === 'box' ? box(r * 1.85, len * 0.46, r * 1.85, M.skin2 || M.body) : cyl(r, r * 0.9, len * 0.46, M.skin2 || M.body, 7);
  shin.position.y = -len * 0.23;
  knee.add(shin);
  if (spec.sock) {
    const sk = cyl(r * 1.1, r * 1.05, len * 0.2, M.trim, 7);
    sk.position.y = -len * 0.08;
    knee.add(sk);
  }
  const foot = spec.foot || 'shoe';
  let f;
  if (foot === 'paw') { f = sph(r * 1.5, M.skin2 || M.body, 8, 5); f.scale.set(1, 0.7, 1.5); }
  else if (foot === 'claw') {
    f = new THREE.Group();
    const p = box(r * 1.7, r * 0.9, r * 2.2, M.skin2 || M.body);
    f.add(p);
    for (let i = -1; i <= 1; i++) {
      const c = cone(r * 0.2, r * 0.6, M.white, 4);
      put(c, i * r * 0.55, -r * 0.1, r * 1.3, 90);
      f.add(c);
    }
  } else if (foot === 'hoof') { f = cyl(r * 1.05, r * 1.3, r * 1.1, M.dark, 6); }
  else if (foot === 'boot') { f = box(r * 2.1, r * 1.1, r * 2.6, M.metal || M.dark); }
  else { f = box(r * 1.9, r * 0.9, r * 2.4, M.shoe || M.dark); }
  f.position.set(0, -len * 0.46 - r * 0.35, r * 0.45);
  knee.add(f);
  return { hip, knee };
}

function buildTail(spec, M, s) {
  const g = new THREE.Group();
  const kind = spec.kind;
  const len = (spec.len || 0.3) * s;
  if (kind === 'bush') {
    const b = sph(len * 0.5, M.trim, 8, 6);
    b.scale.set(0.7, 1.5, 0.7);
    put(b, 0, len * 0.35, -len * 0.35, -34);
    g.add(b);
  } else if (kind === 'lizard') {
    let z = 0, y = 0, r = len * 0.24;
    for (let i = 0; i < 4; i++) {
      const seg = cyl(r * 0.72, r, len * 0.3, M.body, 6);
      put(seg, 0, y, z, 90);
      g.add(seg);
      z -= len * 0.28;
      y -= len * 0.03;
      r *= 0.72;
    }
  } else if (kind === 'stub') {
    const t = sph(len * 0.36, M.body, 6, 4);
    put(t, 0, 0, -len * 0.4);
    g.add(t);
  } else if (kind === 'wire') {
    const t = cyl(len * 0.05, len * 0.05, len, M.dark, 5);
    put(t, 0, len * 0.1, -len * 0.4, 60);
    g.add(t);
    const tip = sph(len * 0.12, M.trim, 6, 4);
    put(tip, 0, len * 0.42, -len * 0.72);
    g.add(tip);
  }
  return g;
}

function buildExt(spec, M, s) {
  // the back-mounted extra: wings, cape flare, pom-poms, jet fins
  const g = new THREE.Group();
  if (spec === 'wings') {
    for (const sx of [-1, 1]) {
      const w = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const f = box(0.06 * s, 0.34 * s - i * 0.05 * s, 0.02 * s, M.trim);
        put(f, sx * (0.12 + i * 0.1) * s, -i * 0.05 * s, -0.02 * s, 0, 0, sx * (14 + i * 10));
        w.add(f);
      }
      g.add(w);
    }
  } else if (spec === 'pompoms') {
    for (const sx of [-1, 1]) {
      const p = sph(0.13 * s, M.trim, 8, 6);
      put(p, sx * 0.3 * s, -0.02 * s, 0.1 * s);
      g.add(p);
    }
  } else if (spec === 'fins') {
    for (const sx of [-1, 1]) {
      const f = box(0.04 * s, 0.22 * s, 0.16 * s, M.metal || M.trim);
      put(f, sx * 0.2 * s, 0, -0.1 * s, 0, 0, sx * 10);
      g.add(f);
    }
  }
  return g;
}

/**
 * Build one fighter rig.
 * def  — the CharDef (uses def.build, def.colors)
 * alt  — index into def.alts for the main colour (0 = default)
 */
export function buildFighter(def, alt = 0) {
  const b = def.build || {};
  const c = def.colors || {};
  const main = alt > 0 && def.alts?.[alt - 1] ? def.alts[alt - 1] : c.main || '#3a6fd8';
  const M = {
    body: mat(main),
    trim: mat(c.trim || '#f2b705'),
    trim2: c.trim2 ? mat(c.trim2) : null,
    skin: mat(c.skin || '#f0e2c0'),
    skin2: c.skin2 ? mat(c.skin2) : mat(main),
    white: mat('#f6f6f0'),
    dark: mat('#191a20'),
    eye: mat(c.eye || '#14141a'),
    metal: mat(c.metal || '#b9c0cc', { shin: 55 }),
    glow: mat(c.glow || '#66e2ff', { shin: 70 }),
    glove: mat(c.glove || '#f4f4f2'),
    shoe: mat(c.shoe || '#2a2c33'),
  };

  const s = b.scale || 1;                 // overall build scale
  const group = new THREE.Group();        // world node (view sets position/facing)
  const root = new THREE.Group();         // spin node (flips, rolls)
  group.add(root);
  const hips = new THREE.Group();
  root.add(hips);

  const torso = buildTorso(b.torso || {}, M, s);
  hips.add(torso.group);
  const head = buildHead(b.head || {}, M, s);
  head.group.position.y = torso.h * 1.02;
  torso.group.add(head.group);

  const armL = buildArm(-1, b, M, s, torso.w, torso.h);
  const armR = buildArm(1, b, M, s, torso.w, torso.h);
  torso.group.add(armL.sh, armR.sh);

  const legL = buildLeg(-1, b, M, s, torso.w);
  const legR = buildLeg(1, b, M, s, torso.w);
  hips.add(legL.hip, legR.hip);

  const tail = buildTail(b.tail || {}, M, s);
  hips.add(tail);
  const ext = buildExt(b.ext, M, s);
  torso.group.add(ext);
  ext.position.y = torso.h * 0.8;

  const legLen = (b.leg || 0.32) * s;
  const hipY = legLen + (b.legR || 0.085) * s * 1.3;
  const rawHeight = hipY + torso.h + head.r * 2.1;
  // The sim treats every fighter as 1.75 units tall (times their size stat) when
  // it builds hurtboxes, so scale the assembled rig to match exactly — otherwise
  // the model and the thing you can hit are different sizes. The scale goes on
  // `root` so view.js can still use group.scale for the landing squash.
  const height = 1.75 * (def.stats?.size ?? 1);
  root.scale.setScalar(height / rawHeight);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  return {
    group,
    j: {
      root, hips, torso: torso.group, head: head.group,
      shL: armL.sh, elL: armL.el, shR: armR.sh, elR: armR.el,
      hipL: legL.hip, kneeL: legL.knee, hipR: legR.hip, kneeR: legR.knee,
      tail, ext,
    },
    hands: { L: armL.hand, R: armR.hand },
    hipY,
    height,
    rawHeight,
    width: torso.w * 1.5,
    mats: M,
    /** 'normal' | 'ko' — swaps the eyes for X's when they get launched off. */
    setFace(state) {
      head.eyes.visible = state !== 'ko';
      head.koEyes.visible = state === 'ko';
    },
    /** Flash the whole body a colour (hitlag, invincibility, charge). */
    setFlash(color, amount) {
      for (const k of ['body', 'trim', 'skin', 'skin2', 'metal']) {
        const m = M[k];
        if (!m) continue;
        if (!m.userData.base) m.userData.base = m.color.clone();
        if (amount <= 0) m.color.copy(m.userData.base);
        else m.color.copy(m.userData.base).lerp(new THREE.Color(color), amount);
      }
    },
    dispose() {
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const k in M) M[k]?.dispose?.();
    },
  };
}

/** A blob shadow — the N64 way. Follows a fighter, scaled by air height. */
export function buildBlobShadow(radius = 0.5) {
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 12),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.34, depthWrite: false }),
  );
  g.rotation.x = -Math.PI / 2;
  return g;
}

/** The player-colour ring drawn under each fighter, like the Smash 64 arrows. */
export function buildPlayerRing(color) {
  const g = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.56, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  g.rotation.x = -Math.PI / 2;
  return g;
}
