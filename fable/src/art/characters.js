// Procedural chibi characters: big heads, oversized helmets, stubby limbs.
// One generic rig (root → tilt → body → head/arms/legs) is dressed up as an
// animal, ghost, gnome, scarecrow, snowman, robot or the lantern mascot, and
// animated by a small pose-blending animator (no keyframe data).
import * as THREE from 'three';
import { toon, flat, lit, sphere, cyl, cone, capsule, torus, box, rbox, circle, plane, M, group, canvasTex, textTex, glowSprite, shade, bake, disposeTree } from './kit.js';
import { TAU, clamp, lerp, damp, rand, wrapAngle } from '../core/util.js';

const BUILDS = {
  tiny: { s: 0.7, tx: 0.9, ty: 0.92, tz: 0.9, arm: 0.9, sh: 0.38 },
  small: { s: 0.84, tx: 0.94, ty: 0.96, tz: 0.94, arm: 0.92, sh: 0.4 },
  normal: { s: 1, tx: 1, ty: 1, tz: 1, arm: 1, sh: 0.43 },
  big: { s: 1.08, tx: 1.28, ty: 1.08, tz: 1.18, arm: 1.2, sh: 0.52 },
  huge: { s: 1.22, tx: 1.62, ty: 1.2, tz: 1.42, arm: 1.5, sh: 0.64 },
};

export const SPECIES = {
  possum: { fur: 0xa9a4a0, face: 0xf6f1ea, ears: 'round', earC: 0x3b3340, earS: 1.15, snout: [0.115, 0.3], snoutC: 0xf6f1ea, nose: 0xf08fa8, tail: 'rat', tailC: 0xf0a8b4, patch: 0x5d5560 },
  bear: { fur: 0x8b5a3a, ears: 'round', earIn: 0xc99a6b, snout: [0.17, 0.15], snoutC: 0xd1a377, nose: 0x2a1c16, tail: 'nub' },
  rabbit: { fur: 0xf3e9dc, ears: 'long', earIn: 0xf4a9b8, snout: [0.11, 0.1], snoutC: 0xffffff, nose: 0xf08fa8, tail: 'puff', teeth: true, blush: 0xf7b9c2 },
  moth: { fur: 0xe9dcc0, face: 0xf6edd6, ears: 'antenna', eyes: 'big', eyeC: 0x3b2a1e, wings: 0xf3e3bd, ruff: 0xffffff, limbC: 0x7b6650 },
  fox: { fur: 0xe07a2f, ears: 'pointy', earIn: 0x3a2a26, snout: [0.11, 0.24], snoutC: 0xfff3e2, nose: 0x2a1c16, tail: 'bushy', tailTip: 0xfff3e2 },
  cat: { fur: 0x6f7480, ears: 'pointy', earIn: 0xf4a9b8, snout: [0.1, 0.09], snoutC: 0xe8e8ee, nose: 0xf08fa8, tail: 'cat' },
  dog: { fur: 0xc99a5b, ears: 'floppy', earC: 0x8a5a34, snout: [0.14, 0.2], snoutC: 0xf1dcb8, nose: 0x2a1c16, tail: 'cat' },
  raccoon: { fur: 0x8b8e99, face: 0xdadce4, ears: 'round', earC: 0x4a4c58, snout: [0.11, 0.2], snoutC: 0xf4f4f8, nose: 0x22222a, tail: 'ringed', patch: 0x33343f },
  mouse: { fur: 0xc9b9a6, ears: 'round', earS: 1.75, earIn: 0xf4a9b8, snout: [0.09, 0.16], nose: 0xf08fa8, tail: 'rat', tailC: 0xf0a8b4 },
  goat: { fur: 0xeeeae0, ears: 'floppy', earC: 0xd9d2c2, snout: [0.13, 0.2], snoutC: 0xf6f2e8, nose: 0x8a6f66, tail: 'nub', horns: 0xb7a98c, beard: 0xd9d2c2 },
  penguin: { fur: 0x2e3440, face: 0xffffff, beak: 0xf5a623, belly: 0xffffff, flipper: true },
  owl: { fur: 0x9b7653, face: 0xe6d3b4, ears: 'tuft', beak: 0xe2a53a, eyes: 'big', eyeC: 0x2a1c16, eyeRing: 0xf8eed6 },
  frog: { fur: 0x6fb558, eyes: 'top', belly: 0xd9efb0, mouth: true },
  turtle: { fur: 0x86b566, snout: [0.12, 0.1], shell: 0x5a7a3c, tail: 'nub' },
  pig: { fur: 0xf2a9b4, ears: 'pointy', earIn: 0xe58a9c, snout: [0.13, 0.12], snoutC: 0xe58a9c, tail: 'nub', pigNose: true },
  duck: { fur: 0xf7f2e6, beak: 0xf5a623, bill: true, tail: 'nub' },
  squirrel: { fur: 0xb5683a, ears: 'pointy', earIn: 0x8a4a26, snout: [0.1, 0.12], snoutC: 0xf3dcc0, nose: 0x2a1c16, tail: 'squirrel', teeth: true },
  hedgehog: { fur: 0xd9c2a0, ears: 'round', earS: 0.7, snout: [0.1, 0.2], nose: 0x2a1c16, spikes: 0x7a5a40 },
  beaver: { fur: 0x8a5d3b, ears: 'round', earS: 0.6, snout: [0.14, 0.14], snoutC: 0xb98b62, nose: 0x2a1c16, teeth: true, tail: 'flat' },
  skunk: { fur: 0x2c2c34, ears: 'round', earS: 0.7, snout: [0.1, 0.16], nose: 0x22222a, tail: 'bushy', tailTip: 0xffffff, stripe: 0xffffff },
  deer: { fur: 0xc08a55, ears: 'floppy', earC: 0xc08a55, snout: [0.12, 0.2], snoutC: 0xf1dcb8, nose: 0x2a1c16, tail: 'puff', antlers: 0xd8c6a0 },
  yeti: { fur: 0xf2f6fa, face: 0x8fb7d9, snout: [0.14, 0.08], snoutC: 0x8fb7d9, nose: 0x35506b, horns: 0x9fb0c2, shaggy: true },
  seagull: { fur: 0xf6f6f2, beak: 0xf2b632, tail: 'nub', flipper: true, flipperC: 0x9aa3ad },
  crow: { fur: 0x2b2b36, beak: 0x4a4a58, tail: 'nub', flipper: true },
  badger: { fur: 0x55565e, face: 0xf4f4f0, ears: 'round', earS: 0.7, snout: [0.12, 0.2], snoutC: 0xf4f4f0, nose: 0x22222a, tail: 'nub', patch: 0x2c2c34 },
};

const HC = 0.36; // head centre above the neck pivot
const geoCache = new Map();
const tubeArc = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); } return g; };

function maskBar(y, rx, rz, t0, t1, r = 0.022) {
  return tubeArc(`mb:${y}:${rx}:${rz}:${t0}:${t1}:${r}`, () => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = lerp(t0, t1, i / 8);
      pts.push(new THREE.Vector3(Math.sin(t) * rx, y, Math.cos(t) * rz));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r, 5, false);
  });
}
function curveTube(key, pts, r, seg = 10) {
  return tubeArc(`ct:${key}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6, false));
}
const helmDome = (r) => tubeArc(`hd:${r}`, () => new THREE.SphereGeometry(r, 20, 8, 0, TAU, 0, Math.PI * 0.35));
const helmBand = (r, a) => tubeArc(`hb:${r}:${a}`, () => new THREE.SphereGeometry(r, 18, 6, Math.PI / 2 + a, TAU - 2 * a, Math.PI * 0.35, Math.PI * 0.44));

/** Football helmet: dome + face-open band + stripe + facemask. Origin = head centre. */
function buildHelmet(h, snoutLen = 0.12, r = 0.47) {
  const g = new THREE.Group();
  const mat = toon(h.color, { side: THREE.DoubleSide });
  g.add(M(helmDome(r), mat));
  g.add(M(helmBand(r, 0.98), mat));
  if (h.stripe !== null && h.stripe !== undefined) {
    const s = M(torus(r + 0.004, 0.022, 4, 14, Math.PI * 0.93), toon(h.stripe), 0, 0, 0, { ry: Math.PI / 2, shadow: false });
    s.scale.z = 3.4;
    g.add(s);
  }
  if (h.mask !== false) {
    const mc = toon(h.mask ?? 0xf4f0e6);
    const rz = r + 0.03 + snoutLen;
    g.add(M(maskBar(-0.19, r - 0.005, rz, -1.3, 1.3), mc, 0, 0, 0, { shadow: false }));
    g.add(M(maskBar(-0.32, r - 0.03, rz - 0.03, -1.2, 1.2), mc, 0, 0, 0, { shadow: false }));
    for (const s of [-1, 1]) {
      const t = 0.5 * s;
      g.add(M(cyl(0.02, 0.02, 0.14, 5), mc, Math.sin(t) * (r - 0.02), -0.255, Math.cos(t) * (rz - 0.015), { shadow: false }));
    }
  }
  if (h.logo) {
    for (const s of [-1, 1]) g.add(M(sphere(0.085, 10, 8), toon(h.logo), s * (r - 0.02), 0.06, -0.02, { sx: 0.3, shadow: false }));
  }
  return g;
}

function numberTex(n, color, stroke) {
  const t = textTex(String(n), { w: 64, h: 64, color, stroke, strokeW: 8, size: 52 });
  return t;
}
const numCache = new Map();
function numberMat(n, color, stroke) {
  const k = `${n}:${color}:${stroke}`;
  let m = numCache.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: numberTex(n, color, stroke), transparent: true, depthWrite: false }); m.userData.shared = true; m.map.userData.shared = true; numCache.set(k, m); }
  return m;
}

function limb(r, len, color, endGeo, endMat, endY, endZ = 0) {
  const g = new THREE.Group();
  g.add(M(capsule(r, len), toon(color), 0, -(len / 2 + r * 0.6), 0));
  const end = M(endGeo, endMat, 0, endY, endZ);
  g.add(end);
  g.userData.end = end;
  return g;
}

// ---------------------------------------------------------------- face bits
function addEyes(hc, o, list) {
  const eyeC = toon(o.eyeC ?? 0x231a26);
  const big = o.eyes === 'big';
  const r = big ? 0.1 : 0.066;
  const ex = o.ex ?? (big ? 0.17 : 0.15), ey = o.ey ?? 0.04;
  const R = o.faceR ?? 0.4;
  const ez = Math.sqrt(Math.max(0.01, R * R - ex * ex - ey * ey)) - 0.012;
  for (const s of [-1, 1]) {
    const eg = group(s * ex, ey, ez);
    if (o.eyeRing) eg.add(M(sphere(r * 1.5, 12, 8), toon(o.eyeRing), 0, 0, -0.03, { sz: 0.4, shadow: false }));
    const eye = M(sphere(r, 12, 10), eyeC, 0, 0, 0, { shadow: false });
    eye.scale.set(1, big ? 1.1 : 1.3, 0.55);
    eg.add(eye);
    eg.add(M(sphere(r * 0.32, 6, 5), flat(0xffffff), r * 0.3 * s, r * 0.45, r * 0.5, { shadow: false }));
    eg.userData.base = eye.scale.clone();
    eg.userData.eye = eye;
    eg.userData.side = s;
    hc.add(eg);
    list.push(eg);
  }
}

function addEars(parent, sp, helmetR) {
  const ears = [];
  const type = sp.ears;
  if (!type) return ears;
  const furC = sp.earC ?? sp.fur;
  const R = helmetR || 0.4;
  const es = sp.earS || 1;
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    if (type === 'round') {
      e.position.set(s * R * 0.66, R * 0.78, 0);
      e.add(M(sphere(0.13 * es, 12, 8), toon(furC), 0, 0.03, 0, { sz: 0.45 }));
      if (sp.earIn) e.add(M(sphere(0.08 * es, 10, 6), toon(sp.earIn), 0, 0.03, 0.03, { sz: 0.4, shadow: false }));
      e.rotation.z = -s * 0.5;
    } else if (type === 'long') {
      e.position.set(s * R * 0.36, R * 0.86, -0.03);
      e.add(M(capsule(0.075, 0.42), toon(furC), 0, 0.26, 0, { sz: 0.6 }));
      if (sp.earIn) e.add(M(capsule(0.04, 0.34), toon(sp.earIn), 0, 0.26, 0.035, { sz: 0.4, shadow: false }));
      e.rotation.z = -s * 0.2;
      e.userData.flop = true;
    } else if (type === 'pointy') {
      e.position.set(s * R * 0.62, R * 0.72, 0);
      e.add(M(cone(0.14, 0.3, 8), toon(furC), 0, 0.12, 0, { sz: 0.6 }));
      if (sp.earIn) e.add(M(cone(0.085, 0.2, 6), toon(sp.earIn), 0, 0.1, 0.04, { sz: 0.5, shadow: false }));
      e.rotation.z = -s * 0.42;
    } else if (type === 'floppy') {
      e.position.set(s * (R + 0.02), R * 0.3, 0);
      e.add(M(capsule(0.085, 0.2), toon(furC), s * 0.03, -0.14, 0, { sz: 0.5 }));
      e.rotation.z = s * 0.25;
      e.userData.flop = true;
    } else if (type === 'antenna') {
      e.position.set(s * R * 0.3, R * 0.9, 0.04);
      e.add(M(curveTube(`ant${s}`, [[0, 0, 0], [s * 0.05, 0.2, 0.02], [s * 0.16, 0.36, 0.08], [s * 0.25, 0.4, 0.16]], 0.016), toon(sp.limbC ?? 0x6b5a44)));
      for (let i = 0; i < 5; i++) {
        const k = 0.3 + i * 0.16;
        e.add(M(cone(0.035, 0.13, 4), toon(sp.fur), s * (0.03 + 0.21 * k), 0.2 + 0.2 * k, 0.02 + 0.13 * k, { rz: -s * 1.2, shadow: false }));
      }
      e.userData.flop = true;
    } else if (type === 'tuft') {
      e.position.set(s * R * 0.6, R * 0.74, 0);
      e.add(M(cone(0.09, 0.26, 5), toon(furC), 0, 0.1, 0));
      e.rotation.z = -s * 0.6;
    }
    parent.add(e);
    ears.push(e);
  }
  return ears;
}

function addTail(body, sp, spec) {
  const type = sp.tail;
  if (!type) return null;
  const t = group(0, 0.5, -0.27);
  const c = sp.tailC ?? sp.fur;
  if (type === 'rat') {
    t.add(M(curveTube('rat', [[0, 0, 0], [0, -0.1, -0.22], [0.08, -0.2, -0.42], [0.2, -0.1, -0.55], [0.22, 0.08, -0.5]], 0.035, 14), toon(c)));
  } else if (type === 'puff') {
    t.add(M(sphere(0.12, 10, 8), toon(0xffffff), 0, -0.08, -0.08));
  } else if (type === 'nub') {
    t.add(M(sphere(0.08, 8, 6), toon(c), 0, -0.1, -0.06));
  } else if (type === 'bushy') {
    const g = group(0, -0.08, 0);
    g.add(M(sphere(0.16, 10, 8), toon(c), 0, 0.12, -0.26, { sz: 2.1, sy: 1.1, rx: -0.75 }));
    if (sp.tailTip) g.add(M(sphere(0.115, 10, 8), toon(sp.tailTip), 0, 0.31, -0.47, { sz: 1.3, rx: -0.75 }));
    t.add(g);
  } else if (type === 'cat') {
    t.add(M(curveTube('cat', [[0, -0.1, 0], [0, -0.12, -0.25], [0, 0.05, -0.42], [0, 0.3, -0.42], [0.04, 0.42, -0.34]], 0.04, 14), toon(c)));
  } else if (type === 'ringed') {
    const g = group(0, -0.1, 0);
    g.rotation.x = -0.9;
    for (let i = 0; i < 5; i++) g.add(M(cyl(0.1 - i * 0.008, 0.105 - i * 0.008, 0.11, 10), toon(i % 2 ? 0x33343f : c), 0, 0, -0.12 - i * 0.11, { rx: Math.PI / 2 }));
    g.add(M(sphere(0.07, 8, 6), toon(0x33343f), 0, 0, -0.68));
    t.add(g);
  } else if (type === 'squirrel') {
    t.add(M(sphere(0.2, 12, 10), toon(c), 0, 0.3, -0.25, { sy: 2.1, sz: 1.1 }));
    t.add(M(sphere(0.17, 10, 8), toon(shade(c, 0.15)), 0, 0.68, -0.14, { sy: 1.2 }));
  } else if (type === 'flat') {
    t.add(M(rbox(0.3, 0.07, 0.5, 0.03), toon(0x4a3626), 0, -0.2, -0.3, { rx: 0.35 }));
  }
  body.add(t);
  return t;
}

function addHat(hc, kind, color = 0xfffaf0, R = 0.4) {
  const g = new THREE.Group();
  const c = toon(color);
  if (kind === 'chef') {
    g.add(M(cyl(0.3, 0.27, 0.22, 14), c, 0, R + 0.02, 0));
    g.add(M(sphere(0.36, 14, 10), c, 0, R + 0.28, 0, { sy: 0.66 }));
  } else if (kind === 'cap') {
    g.add(M(tubeArc(`cap:${R}`, () => new THREE.SphereGeometry(R + 0.03, 16, 8, 0, TAU, 0, Math.PI * 0.42)), c, 0, 0.02, 0));
    g.add(M(cyl(0.24, 0.24, 0.035, 14), c, 0, 0.13, R * 0.86, { sz: 1.1, rx: 0.12 }));
    g.add(M(sphere(0.04, 6, 5), c, 0, R + 0.05, 0));
  } else if (kind === 'beanie') {
    g.add(M(tubeArc(`bean:${R}`, () => new THREE.SphereGeometry(R + 0.035, 16, 8, 0, TAU, 0, Math.PI * 0.45)), c, 0, 0.02, 0));
    g.add(M(torus(R + 0.02, 0.05, 6, 18), toon(shade(color, -0.18)), 0, 0.08, 0, { rx: Math.PI / 2 }));
    g.add(M(sphere(0.09, 8, 6), toon(0xffffff), 0, R + 0.1, 0));
  } else if (kind === 'bow') {
    for (const s of [-1, 1]) g.add(M(cone(0.12, 0.2, 6), c, s * 0.12, R + 0.02, 0.1, { rz: s * Math.PI / 2 }));
    g.add(M(sphere(0.06, 8, 6), c, 0, R + 0.02, 0.1));
  } else if (kind === 'straw') {
    g.add(M(cyl(0.62, 0.62, 0.035, 18), c, 0, R * 0.62, 0));
    g.add(M(cyl(0.3, 0.34, 0.22, 14), c, 0, R * 0.62 + 0.12, 0));
    g.add(M(cyl(0.345, 0.345, 0.06, 14), toon(0xd4502f), 0, R * 0.62 + 0.06, 0));
  } else if (kind === 'top') {
    g.add(M(cyl(0.42, 0.42, 0.04, 16), c, 0, R * 0.8, 0));
    g.add(M(cyl(0.27, 0.27, 0.42, 14), c, 0, R * 0.8 + 0.22, 0));
    g.add(M(cyl(0.275, 0.275, 0.07, 14), toon(0xd4502f), 0, R * 0.8 + 0.07, 0));
  } else if (kind === 'leather') {
    const cap = M(tubeArc(`lea:${R}`, () => new THREE.SphereGeometry(R + 0.035, 16, 8, 0, TAU, 0, Math.PI * 0.4)), c, 0, 0.0, -0.02);
    cap.rotation.x = -0.28;
    g.add(cap);
    for (const s of [-1, 1]) g.add(M(sphere(0.14, 10, 8), c, s * (R + 0.005), -0.02, -0.04, { sx: 0.3, sy: 1.25 }));
    for (let i = -1; i <= 1; i++) g.add(M(torus(R + 0.04, 0.016, 4, 12, Math.PI * 0.8), toon(shade(color, -0.3)), 0, 0.0, -0.02, { ry: Math.PI / 2 + i * 0.55, rx: 0, shadow: false }));
    g.add(M(torus(R + 0.02, 0.03, 5, 16), toon(shade(color, -0.3)), 0, 0.17, -0.06, { rx: Math.PI / 2 - 0.28, shadow: false }));
  } else if (kind === 'bucket') {
    g.add(M(cyl(0.26, 0.33, 0.36, 14), c, 0, R * 0.7 + 0.14, 0, { rz: 0.12 }));
  } else if (kind === 'visor') {
    g.add(M(torus(R + 0.01, 0.045, 6, 18), c, 0, 0.12, 0, { rx: Math.PI / 2 }));
    g.add(M(cyl(0.26, 0.26, 0.03, 14), c, 0, 0.12, R * 0.9, { sz: 1.15 }));
  } else if (kind === 'crown') {
    g.add(M(cyl(0.24, 0.22, 0.14, 10, true), toon(color, { side: THREE.DoubleSide }), 0, R + 0.03, 0));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.add(M(cone(0.05, 0.12, 4), c, Math.cos(a) * 0.23, R + 0.15, Math.sin(a) * 0.23)); }
  } else if (kind === 'witch') {
    g.add(M(cyl(0.6, 0.6, 0.035, 18), c, 0, R * 0.62, 0));
    g.add(M(cone(0.34, 0.62, 12), c, 0, R * 0.62 + 0.3, 0, { rz: 0.14 }));
  }
  hc.add(g);
  return g;
}

function addAccessories(ch, spec, B) {
  const acc = spec.acc || [];
  const { body, head } = ch;
  const hc = ch.hc;
  for (const a of acc) {
    if (a === 'glasses') {
      const m = toon(0x2b1a33);
      for (const s of [-1, 1]) hc.add(M(torus(0.085, 0.014, 5, 14), m, s * 0.15, 0.05, 0.385, { shadow: false }));
      hc.add(M(cyl(0.012, 0.012, 0.13, 4), m, 0, 0.05, 0.39, { rz: Math.PI / 2, shadow: false }));
    } else if (a === 'apron') {
      body.add(M(sphere(0.35, 14, 10), toon(0xfffaf0), 0, 0.6, 0.05, { sx: B.tx * 0.92, sy: B.ty * 1.0, sz: B.tz * 0.84 }));
      body.add(M(torus(0.3 * B.tx, 0.02, 4, 14), toon(0xfffaf0), 0, 0.96 * B.ty, 0, { rx: Math.PI / 2, shadow: false }));
    } else if (a === 'scarf') {
      body.add(M(torus(0.27, 0.075, 6, 16), toon(spec.scarfC ?? 0xd4502f), 0, 1.02 * B.ty, 0.02, { rx: Math.PI / 2 }));
      body.add(M(rbox(0.13, 0.3, 0.06, 0.02), toon(spec.scarfC ?? 0xd4502f), 0.16, 0.86 * B.ty, 0.25, { rz: 0.15 }));
    } else if (a === 'whistle') {
      body.add(M(torus(0.24, 0.012, 4, 14), toon(0x2b1a33), 0, 0.97 * B.ty, 0.06, { rx: Math.PI / 2 - 0.5, shadow: false }));
      body.add(M(cyl(0.04, 0.04, 0.07, 8), toon(0xc9d2da), 0, 0.78 * B.ty, 0.3 * B.tz, { rz: Math.PI / 2 }));
    } else if (a === 'mustache') {
      for (const s of [-1, 1]) hc.add(M(capsule(0.035, 0.12), toon(spec.stacheC ?? 0xe8f2ee), s * 0.09, -0.1, 0.4, { rz: s * 1.2, shadow: false }));
    } else if (a === 'tie') {
      body.add(M(cone(0.07, 0.3, 4), toon(0xd4502f), 0, 0.72 * B.ty, 0.3 * B.tz, { rx: Math.PI, shadow: false }));
    } else if (a === 'backpack') {
      body.add(M(rbox(0.4, 0.44, 0.2, 0.07), toon(spec.packC ?? 0x2a6f77), 0, 0.68 * B.ty, -0.34 * B.tz));
    } else if (a === 'cape') {
      body.add(M(tubeArc('cape', () => new THREE.CylinderGeometry(0.3, 0.52, 0.8, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8)), toon(spec.capeC ?? 0xd4502f, { side: THREE.DoubleSide }), 0, 0.56 * B.ty, 0));
    } else if (a === 'cheese') {
      const cg = group(0, 0.62, 0);
      const wedge = new THREE.Mesh(tubeArc('wedge', () => { const g = new THREE.CylinderGeometry(0.62, 0.62, 0.62, 3); g.rotateY(Math.PI); return g; }), toon(0xf7c948));
      wedge.castShadow = true;
      cg.add(wedge);
      for (const [x, y, z, r] of [[0.2, 0.1, 0.33, 0.09], [-0.18, -0.12, 0.33, 0.07], [0.02, -0.2, 0.34, 0.05], [-0.3, 0.14, 0.12, 0.06]]) cg.add(M(sphere(r, 8, 6), toon(0xe0a92e), x, y, z, { sz: 0.4, shadow: false }));
      body.add(cg);
    } else if (a === 'clipboard') {
      ch.armL.userData.end.add(M(rbox(0.26, 0.34, 0.03, 0.012), toon(0xb07a45), 0.02, -0.08, 0.09, { rx: -0.4 }));
    } else if (a === 'key') {
      body.add(M(cyl(0.03, 0.03, 0.2, 6), toon(0xd9a441), 0, 0.7, -0.4 * B.tz, { rx: Math.PI / 2 }));
      const k = M(torus(0.11, 0.03, 5, 12), toon(0xd9a441), 0, 0.7, -0.52 * B.tz);
      k.userData.keep = true;
      body.add(k);
      ch.windKey = k;
    }
  }
  if (spec.hat) addHat(hc, spec.hat, spec.hatC, spec.kind === 'ghost' ? 0.42 : 0.4);
  void head;
}

// ---------------------------------------------------------------- the rig
export class Character {
  constructor(spec = {}) {
    this.spec = spec;
    const kind = spec.kind || 'animal';
    const sp = kind === 'animal' ? { ...(SPECIES[spec.species] || SPECIES.fox), ...(spec.over || {}) } : {};
    if (spec.fur !== undefined) { if (sp.face === undefined || sp.face === sp.fur) sp.face = spec.fur; sp.fur = spec.fur; }
    this.sp = sp;
    const B = { ...BUILDS[spec.build || 'normal'] };
    this.B = B;
    const scale = B.s * (spec.scale || 1);

    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.tilt);
    this.tilt.add(this.body);
    this.root.scale.setScalar(scale);
    this.scale = scale;
    this.eyes = [];
    this.ears = [];
    this.wings = [];
    this.tail = null;
    this.floaty = kind === 'ghost';
    this.small = (spec.build === 'small' || spec.build === 'tiny') && kind !== 'gnome';
    this.radius = 0.42 * Math.max(scale, 0.8) * (B.tx > 1.3 ? 1.25 : 1);
    this.height = 1.9 * scale;

    // blob shadow
    const blob = new THREE.Mesh(circle(0.46 * B.tx, 18), new THREE.MeshBasicMaterial({ color: 0x1b1024, transparent: true, opacity: kind === 'ghost' ? 0.12 : 0.24, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.025;
    blob.renderOrder = 2;
    this.root.add(blob);
    this.blob = blob;

    if (kind === 'ghost') this._buildGhost(spec, B);
    else if (kind === 'snowman') this._buildSnowman(spec, B);
    else if (kind === 'robot') this._buildRobot(spec, B);
    else if (kind === 'wick') this._buildWick(spec, B);
    else this._buildBiped(spec, B, sp, kind);

    addAccessories(this, spec, B);
    this._bakeStatic();

    // animation state
    this.base = this.floaty ? 'float' : 'move';
    this.one = null; this.oneT = 0; this.oneDur = 0;
    this.t = rand(10);
    this.phase = rand(TAU);
    this.speed = 0;
    this.pose = {};
    this.cur = {};
    this.blinkT = rand(1, 4);
    this.expr = 'open'; this.exprT = 0;
    this.yaw = 0;
    this.carrying = false;
    this._apply(0, true);
  }

  // ------------------------------------------------------------ builders
  _buildBiped(spec, B, sp, kind) {
    const body = this.body;
    const uniform = !!spec.jersey;
    const fur = kind === 'animal' ? sp.fur : (spec.skin ?? 0xf2c9a0);
    const shirt = spec.jersey ?? spec.shirt ?? fur;
    const pants = spec.pants ?? (uniform ? 0xfff4dc : (spec.shirt !== undefined ? shade(shirt, -0.25) : fur));
    const limbC = sp.limbC ?? spec.limbC ?? fur;
    const handC = spec.gloves ?? limbC;

    // torso
    const torso = M(sphere(0.34, 16, 12), toon(shirt), 0, 0.66 * B.ty, 0);
    torso.scale.set(B.tx, 1.12 * B.ty, 0.88 * B.tz);
    body.add(torso);
    this.torso = torso;
    if (sp.belly && !uniform) body.add(M(sphere(0.3, 14, 10), toon(sp.belly), 0, 0.62 * B.ty, 0.06, { sx: B.tx * 0.86, sy: B.ty * 1.05, sz: B.tz * 0.82, shadow: false }));
    if (uniform) {
      const pads = M(sphere(0.3, 14, 8), toon(shirt), 0, 0.93 * B.ty, 0);
      pads.scale.set(1.5 * B.tx * 0.96, 0.5, 1.02 * B.tz);
      body.add(pads);
      if (spec.trim !== undefined) {
        body.add(M(torus(0.2 * B.tx, 0.035, 5, 14), toon(spec.trim), 0, 1.03 * B.ty, 0, { rx: Math.PI / 2, shadow: false }));
      }
      const hip = M(sphere(0.3, 14, 8), toon(pants), 0, 0.42 * B.ty, 0);
      hip.scale.set(B.tx * 0.98, 0.62, 0.84 * B.tz);
      body.add(hip);
      if (spec.number !== undefined) {
        const nm = numberMat(spec.number, spec.numC || '#fff4dc', spec.numS || '#2b1a33');
        const back = new THREE.Mesh(plane(0.34, 0.34), nm);
        back.position.set(0, 0.7 * B.ty, -0.31 * B.tz); back.rotation.y = Math.PI;
        const front = new THREE.Mesh(plane(0.28, 0.28), nm);
        front.position.set(0, 0.68 * B.ty, 0.31 * B.tz);
        body.add(back, front);
      }
    } else if (spec.shirt !== undefined && spec.belt !== false) {
      const hip = M(sphere(0.3, 14, 8), toon(pants), 0, 0.42 * B.ty, 0);
      hip.scale.set(B.tx * 0.98, 0.6, 0.84 * B.tz);
      body.add(hip);
    }
    if (sp.shell) body.add(M(sphere(0.36, 14, 10), toon(sp.shell), 0, 0.68 * B.ty, -0.14, { sx: B.tx, sy: 1.1, sz: 0.8 }));
    if (sp.spikes) for (let i = 0; i < 9; i++) body.add(M(cone(0.07, 0.2, 5), toon(sp.spikes), ((i % 3) - 1) * 0.16, 0.5 + Math.floor(i / 3) * 0.2, -0.3, { rx: -1.3 }));
    if (sp.ruff) for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; body.add(M(sphere(0.11, 8, 6), toon(sp.ruff), Math.cos(a) * 0.22, 1.02 * B.ty, Math.sin(a) * 0.18, { shadow: false })); }
    if (sp.wings) {
      const wm = new THREE.MeshToonMaterial({ color: sp.wings, side: THREE.DoubleSide, map: wingTex(), gradientMap: toon(0xffffff).gradientMap });
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(s * 0.1, 0.86 * B.ty, -0.24);
        const up = new THREE.Mesh(circle(0.34, 14), wm); up.scale.set(1, 1.25, 1); up.position.set(s * 0.26, 0.14, 0); up.castShadow = true;
        const lo = new THREE.Mesh(circle(0.24, 12), wm); lo.position.set(s * 0.2, -0.24, 0.01); lo.castShadow = true;
        w.add(up, lo);
        w.userData.side = s;
        body.add(w);
        this.wings.push(w);
      }
    }

    // arms
    const aw = 0.08 * B.arm;
    const shx = B.sh;
    const mk = (s) => {
      let arm;
      if (sp.flipper) {
        arm = new THREE.Group();
        const f = M(sphere(0.12, 10, 8), toon(sp.flipperC ?? fur), 0, -0.2, 0, { sx: 0.5, sy: 2 });
        arm.add(f); arm.userData.end = f;
      } else if (kind === 'scarecrow' || kind === 'pumpkin') {
        arm = limb(aw * 0.8, 0.16, spec.sleeve ?? 0xb23a2e, sphere(0.1, 8, 6), toon(0xe8c95a), -0.33);
        for (let i = 0; i < 4; i++) arm.userData.end.add(M(cone(0.03, 0.16, 4), toon(0xe8c95a), rand(-0.05, 0.05), -0.1, rand(-0.05, 0.05), { rx: Math.PI + rand(-0.5, 0.5), rz: rand(-0.5, 0.5), shadow: false }));
      } else {
        arm = limb(aw, 0.15, uniform ? limbC : (spec.sleeve ?? limbC), sphere(0.115 * Math.min(B.arm, 1.25), 10, 8), toon(handC), -0.33);
      }
      arm.position.set(s * shx, 0.9 * B.ty, 0);
      body.add(arm);
      return arm;
    };
    this.armL = mk(1);
    this.armR = mk(-1);

    // legs
    const footC = spec.shoes ?? (uniform ? 0x2b1a33 : limbC);
    const lk = (s) => {
      const leg = limb(0.095 * Math.min(B.arm, 1.3), 0.1, uniform || spec.shirt !== undefined ? pants : limbC, sphere(0.11, 10, 8), toon(footC), -0.29, 0.05);
      leg.userData.end.scale.set(1.2 * Math.min(B.arm, 1.3), 0.66, 1.65);
      leg.position.set(s * 0.17 * B.tx, 0.36, 0);
      body.add(leg);
      return leg;
    };
    this.legL = lk(1);
    this.legR = lk(-1);

    this.tail = addTail(body, sp, spec);

    // head
    const head = new THREE.Group();
    head.position.y = 1.06 * B.ty;
    body.add(head);
    this.head = head;
    const hc = group(0, HC, 0);
    head.add(hc);
    this.hc = hc;
    if (kind === 'gnome') this._gnomeHead(hc, spec);
    else if (kind === 'scarecrow') this._sackHead(hc, spec);
    else if (kind === 'pumpkin') this._pumpkinHead(hc, spec);
    else this._animalHead(hc, spec, sp);
  }

  _animalHead(hc, spec, sp) {
    const faceC = sp.face ?? sp.fur;
    hc.add(M(sphere(0.4, 18, 14), toon(faceC)));
    const snoutLen = sp.snout ? sp.snout[1] : sp.beak ? 0.2 : 0.06;
    if (sp.patch) for (const s of [-1, 1]) hc.add(M(sphere(0.12, 10, 8), toon(sp.patch), s * 0.15, 0.05, 0.3, { sz: 0.5, sx: 1.15, shadow: false }));
    if (sp.stripe) hc.add(M(sphere(0.12, 8, 8), toon(sp.stripe), 0, 0.25, 0.28, { sy: 1.6, sz: 0.5, shadow: false }));
    addEyes(hc, sp, this.eyes);
    if (sp.eyes === 'top') {
      for (const eg of this.eyes) { eg.position.set(eg.userData.side * 0.2, 0.36, 0.16); eg.add(M(sphere(0.12, 10, 8), toon(sp.fur), 0, -0.02, -0.06)); }
    }
    if (sp.snout) {
      const [r, len] = sp.snout;
      const sn = M(sphere(r, 12, 10), toon(sp.snoutC ?? faceC), 0, -0.09, 0.3 + len * 0.45);
      sn.scale.set(1.15, 0.82, 0.6 + len / r);
      hc.add(sn);
      if (sp.nose) hc.add(M(sphere(0.047, 8, 6), toon(sp.nose), 0, -0.05, 0.3 + len * 0.45 + r * (0.6 + len / r) * 0.92, { shadow: false }));
      if (sp.pigNose) hc.add(M(cyl(0.085, 0.085, 0.03, 10), toon(0xd9788e), 0, -0.09, 0.3 + len * 0.45 + r * (0.6 + len / r), { rx: Math.PI / 2, shadow: false }));
      if (sp.teeth) hc.add(M(box(0.07, 0.07, 0.02), toon(0xffffff), 0, -0.19, 0.3 + len * 0.45 + r * 0.6, { shadow: false }));
    }
    if (sp.beak) {
      if (sp.bill) hc.add(M(sphere(0.13, 10, 8), toon(sp.beak), 0, -0.08, 0.42, { sy: 0.4, sz: 1.3 }));
      else hc.add(M(cone(0.09, 0.24, 8), toon(sp.beak), 0, -0.06, 0.47, { rx: Math.PI / 2 }));
    }
    if (sp.mouth) hc.add(M(torus(0.2, 0.014, 4, 12, Math.PI), toon(0x3a5a2a), 0, -0.1, 0.33, { rz: Math.PI, rx: -0.2, shadow: false }));
    if (sp.blush) for (const s of [-1, 1]) hc.add(M(sphere(0.06, 8, 6), toon(sp.blush), s * 0.26, -0.06, 0.29, { sz: 0.4, shadow: false }));
    if (sp.beard) hc.add(M(cone(0.1, 0.24, 6), toon(sp.beard), 0, -0.36, 0.32, { rx: Math.PI }));
    if (sp.shaggy && !spec.helmet) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; hc.add(M(cone(0.1, 0.22, 5), toon(sp.fur), Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3 - 0.05, { rx: Math.sin(a) * 0.6, rz: -Math.cos(a) * 0.6 })); }

    let earParent = hc, R = 0.4;
    if (spec.helmet) {
      const hm = buildHelmet(spec.helmet, snoutLen);
      hm.rotation.x = -0.1;
      hc.add(hm);
      this.helmet = hm;
      R = 0.48;
    }
    this.ears = addEars(earParent, sp, R);
    if (sp.horns) for (const s of [-1, 1]) hc.add(M(cone(0.07, 0.3, 6), toon(sp.horns), s * 0.26, R * 0.95, -0.05, { rz: -s * 0.5, rx: -0.3 }));
    if (sp.antlers) for (const s of [-1, 1]) {
      const a = group(s * 0.2, R * 0.92, 0);
      a.add(M(cyl(0.025, 0.035, 0.36, 5), toon(sp.antlers), s * 0.06, 0.16, 0, { rz: -s * 0.35 }));
      a.add(M(cyl(0.02, 0.025, 0.18, 5), toon(sp.antlers), s * 0.16, 0.24, 0, { rz: -s * 1.1 }));
      hc.add(a);
    }
  }

  _gnomeHead(hc, spec) {
    const skin = spec.skin ?? 0xf2c9a0;
    hc.add(M(sphere(0.37, 16, 12), toon(skin)));
    addEyes(hc, { ex: 0.14, ey: 0.04, faceR: 0.37 }, this.eyes);
    hc.add(M(sphere(0.105, 10, 8), toon(shade(skin, -0.08)), 0, -0.06, 0.37));
    hc.add(M(sphere(0.3, 12, 10), toon(0xfdfbf5), 0, -0.24, 0.16, { sy: 0.9, sz: 0.8 }));
    hc.add(M(cone(0.22, 0.42, 8), toon(0xfdfbf5), 0, -0.5, 0.2, { rx: Math.PI }));
    for (const s of [-1, 1]) hc.add(M(sphere(0.11, 8, 6), toon(skin), s * 0.37, 0, 0, { sx: 0.5 }));
    const hatC = spec.helmet ? spec.helmet.color : (spec.hatC ?? 0xc8452d);
    const hat = group(0, 0.16, -0.02);
    hat.add(M(cone(0.43, 0.62, 14), toon(hatC), 0, 0.3, 0));
    hat.add(M(cone(0.2, 0.42, 10), toon(hatC), 0.06, 0.68, -0.03, { rz: -0.35 }));
    if (spec.helmet && spec.helmet.stripe !== undefined) hat.add(M(torus(0.4, 0.045, 5, 16), toon(spec.helmet.stripe), 0, 0.04, 0, { rx: Math.PI / 2 }));
    hat.rotation.x = -0.12;
    hc.add(hat);
    const mc = toon(0xf4f0e6);
    hc.add(M(maskBar(-0.05, 0.4, 0.62, -1.3, 1.3), mc, 0, 0, 0, { shadow: false }));
    hc.add(M(maskBar(-0.22, 0.38, 0.6, -1.2, 1.2), mc, 0, 0, 0, { shadow: false }));
  }

  _sackHead(hc, spec) {
    hc.add(M(sphere(0.39, 14, 10), toon(spec.skin ?? 0xd8b98a), 0, 0, 0, { sy: 1.05 }));
    const dark = toon(0x2b1a33);
    for (const [s, r] of [[-1, 0.07], [1, 0.05]]) {
      const eg = group(s * 0.15, 0.06, 0.35);
      const e = M(cyl(r, r, 0.03, 10), dark, 0, 0, 0, { rx: Math.PI / 2, shadow: false });
      eg.add(e); eg.userData.base = e.scale.clone(); eg.userData.eye = e; eg.userData.side = s;
      hc.add(eg); this.eyes.push(eg);
    }
    for (let i = -2; i <= 2; i++) hc.add(M(box(0.02, 0.07, 0.02), dark, i * 0.07, -0.16 + Math.abs(i) * 0.025, 0.37 - Math.abs(i) * 0.012, { rz: i * 0.1, shadow: false }));
    hc.add(M(torus(0.15, 0.012, 4, 10, Math.PI), dark, 0, -0.13, 0.36, { rz: Math.PI, shadow: false }));
    hc.add(M(cone(0.05, 0.12, 4), toon(0xf08a24), 0, -0.04, 0.42, { rx: Math.PI / 2 }));
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; hc.add(M(cone(0.045, 0.22, 4), toon(0xe8c95a), Math.cos(a) * 0.27, -0.42, Math.sin(a) * 0.24, { rx: Math.PI + Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5, shadow: false })); }
    if (spec.helmet) { const hm = buildHelmet(spec.helmet, 0.1); hc.add(hm); this.helmet = hm; } else addHat(hc, 'witch', spec.hatC ?? 0x6b4a2e);
  }

  _pumpkinHead(hc, spec) {
    const c = spec.skin ?? 0xf08a24;
    hc.add(M(sphere(0.42, 16, 12), toon(c), 0, 0, 0, { sy: 0.92 }));
    for (let i = 0; i < 4; i++) hc.add(M(torus(0.415, 0.03, 5, 18), toon(shade(c, -0.14)), 0, 0, 0, { ry: (i / 4) * Math.PI, sy: 0.92, shadow: false }));
    hc.add(M(cyl(0.05, 0.07, 0.16, 6), toon(0x5a7a3c), 0.02, 0.44, 0, { rz: 0.25 }));
    const glow = lit(0xffe27a, 0xffc93c, 1.4);
    for (const s of [-1, 1]) {
      const eg = group(s * 0.15, 0.07, 0.385);
      const e = new THREE.Mesh(circle(0.085, 3), glow);
      e.rotation.z = s * 0.35 + Math.PI / 2;
      eg.add(e); eg.userData.base = e.scale.clone(); eg.userData.eye = e; eg.userData.side = s;
      hc.add(eg); this.eyes.push(eg);
    }
    for (let i = -2; i <= 2; i++) { const m = new THREE.Mesh(circle(0.05, 3), glow); m.position.set(i * 0.08, -0.15 - (i % 2 ? 0.02 : 0), 0.385 - Math.abs(i) * 0.02); m.rotation.z = i % 2 ? Math.PI / 2 : -Math.PI / 2; hc.add(m); }
    if (spec.helmet) {
      const mc = toon(spec.helmet.mask ?? 0xf4f0e6);
      hc.add(M(maskBar(-0.08, 0.43, 0.62, -1.3, 1.3), mc, 0, 0, 0, { shadow: false }));
      hc.add(M(maskBar(-0.24, 0.4, 0.6, -1.2, 1.2), mc, 0, 0, 0, { shadow: false }));
      hc.add(M(torus(0.43, 0.035, 5, 18), toon(spec.helmet.color), 0, 0.2, 0, { rx: Math.PI / 2 }));
    }
  }

  _buildGhost(spec, B) {
    const c = spec.fur ?? 0xbfeee0;
    const mat = new THREE.MeshToonMaterial({ color: c, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: spec.opacity ?? 0.86, emissive: c, emissiveIntensity: 0.22 });
    const body = this.body;
    const skirt = new THREE.Mesh(tubeArc('gskirt', () => {
      const pts = [[0.4, 0], [0.46, 0.14], [0.44, 0.4], [0.37, 0.7], [0.3, 0.95]].map(([x, y]) => new THREE.Vector2(x, y));
      return new THREE.LatheGeometry(pts, 16);
    }), mat);
    skirt.position.y = 0.22;
    body.add(skirt);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; body.add(new THREE.Mesh(sphere(0.12, 8, 6), mat).translateX(Math.cos(a) * 0.36).translateY(0.2).translateZ(Math.sin(a) * 0.36)); }
    this.torso = skirt;
    if (spec.jersey) {
      const band = M(cyl(0.4, 0.45, 0.2, 16, true), toon(spec.jersey, { side: THREE.DoubleSide }), 0, 0.74, 0, { shadow: false });
      body.add(band);
      if (spec.number !== undefined) {
        const nm = numberMat(spec.number, '#fff4dc', '#2b1a33');
        const p = new THREE.Mesh(plane(0.22, 0.22), nm); p.position.set(0, 0.74, 0.45); body.add(p);
      }
    }
    const mk = (s) => {
      const arm = new THREE.Group();
      const m = new THREE.Mesh(capsule(0.085, 0.16), mat); m.position.y = -0.14; arm.add(m);
      const h = new THREE.Mesh(sphere(0.1, 8, 6), mat); h.position.y = -0.3; arm.add(h);
      arm.userData.end = h;
      arm.position.set(s * 0.4, 1.0, 0.03);
      body.add(arm);
      return arm;
    };
    this.armL = mk(1); this.armR = mk(-1);
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.legL.userData.end = this.legL; this.legR.userData.end = this.legR;
    const head = new THREE.Group(); head.position.y = 1.06; body.add(head); this.head = head;
    const hc = group(0, HC, 0); head.add(hc); this.hc = hc;
    hc.add(new THREE.Mesh(sphere(0.42, 18, 14), mat));
    addEyes(hc, { eyeC: spec.eyeC ?? 0x1d2a4a, faceR: 0.42, ex: 0.15, ey: 0.03 }, this.eyes);
    hc.add(M(sphere(0.05, 8, 6), toon(0x1d2a4a), 0, -0.14, 0.4, { sy: 0.7, sz: 0.4, shadow: false }));
    if (spec.helmet) { const hm = buildHelmet(spec.helmet, 0.08, 0.49); hc.add(hm); this.helmet = hm; }
    const gl = glowSprite(c, 2.6, 0.28); gl.position.y = 0.9; this.root.add(gl);
    this.blob.material = this.blob.material.clone(); this.blob.material.opacity = 0.1;
    this.root.traverse((o) => { if (o.isMesh && o !== this.blob) { o.castShadow = false; } });
  }

  _buildSnowman(spec, B) {
    const body = this.body;
    const snow = toon(0xfbfdff);
    body.add(M(sphere(0.44, 16, 12), snow, 0, 0.42, 0));
    const torso = M(sphere(0.34, 16, 12), snow, 0, 0.98, 0);
    body.add(torso); this.torso = torso;
    if (spec.jersey) {
      body.add(M(cyl(0.345, 0.36, 0.3, 16, true), toon(spec.jersey, { side: THREE.DoubleSide }), 0, 0.98, 0));
      if (spec.number !== undefined) { const p = new THREE.Mesh(plane(0.22, 0.22), numberMat(spec.number, '#fff4dc', '#2b1a33')); p.position.set(0, 0.98, 0.36); body.add(p); }
    }
    for (let i = 0; i < 2; i++) body.add(M(sphere(0.04, 6, 5), toon(0x2b2b36), 0, 0.5 + i * 0.2, 0.42 - i * 0.03, { shadow: false }));
    const mk = (s) => {
      const arm = new THREE.Group();
      arm.add(M(cyl(0.025, 0.03, 0.36, 5), toon(0x7a5230), 0, -0.18, 0));
      const mit = M(sphere(0.1, 8, 6), toon(spec.jersey ?? 0xd4502f), 0, -0.38, 0);
      arm.add(mit); arm.userData.end = mit;
      arm.position.set(s * 0.34, 1.1, 0);
      body.add(arm);
      return arm;
    };
    this.armL = mk(1); this.armR = mk(-1);
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.legL.userData.end = this.legL; this.legR.userData.end = this.legR;
    const head = new THREE.Group(); head.position.y = 1.2; body.add(head); this.head = head;
    const hc = group(0, 0.3, 0); head.add(hc); this.hc = hc;
    hc.add(M(sphere(0.33, 16, 12), snow));
    addEyes(hc, { faceR: 0.33, ex: 0.12, ey: 0.06, eyeC: 0x22222a }, this.eyes);
    hc.add(M(cone(0.055, 0.3, 6), toon(0xf08a24), 0, -0.02, 0.44, { rx: Math.PI / 2 }));
    for (let i = -2; i <= 2; i++) hc.add(M(sphere(0.025, 5, 4), toon(0x22222a), i * 0.06, -0.15 + Math.abs(i) * 0.02, 0.3 - Math.abs(i) * 0.012, { shadow: false }));
    body.add(M(torus(0.24, 0.06, 6, 14), toon(spec.scarfC ?? 0xd4502f), 0, 1.24, 0, { rx: Math.PI / 2 }));
    if (spec.helmet) { const hm = buildHelmet(spec.helmet, 0.22, 0.4); hc.add(hm); this.helmet = hm; } else addHat(hc, 'bucket', spec.hatC ?? 0x8f9aa6, 0.33);
    this.hoppy = true;
  }

  _buildRobot(spec, B) {
    const body = this.body;
    const shell = toon(spec.shell ?? 0x3a3f5c);
    const neon = spec.neon ?? 0x58e6ff;
    const neonM = lit(neon, neon, 1.3);
    const torso = M(rbox(0.66 * B.tx, 0.6 * B.ty, 0.46 * B.tz, 0.1), shell, 0, 0.68 * B.ty, 0);
    body.add(torso); this.torso = torso;
    body.add(M(box(0.67 * B.tx, 0.07, 0.47 * B.tz), neonM, 0, 0.5 * B.ty, 0, { shadow: false }));
    if (spec.jersey) body.add(M(rbox(0.68 * B.tx, 0.3 * B.ty, 0.48 * B.tz, 0.08), toon(spec.jersey), 0, 0.8 * B.ty, 0));
    if (spec.number !== undefined) { const p = new THREE.Mesh(plane(0.24, 0.24), numberMat(spec.number, '#ffffff', '#1b1024')); p.position.set(0, 0.8 * B.ty, 0.245 * B.tz); body.add(p); }
    const mk = (s) => {
      const arm = new THREE.Group();
      arm.add(M(cyl(0.065, 0.065, 0.3, 8), shell, 0, -0.16, 0));
      arm.add(M(cyl(0.07, 0.07, 0.05, 8), neonM, 0, -0.16, 0, { shadow: false }));
      const h = M(rbox(0.2, 0.18, 0.2, 0.05), toon(spec.jersey ?? 0x8f9aa6), 0, -0.36, 0);
      arm.add(h); arm.userData.end = h;
      arm.position.set(s * (B.sh + 0.02), 0.9 * B.ty, 0);
      body.add(arm);
      return arm;
    };
    this.armL = mk(1); this.armR = mk(-1);
    const lk = (s) => {
      const leg = new THREE.Group();
      leg.add(M(cyl(0.07, 0.07, 0.2, 8), shell, 0, -0.1, 0));
      const f = M(rbox(0.24, 0.14, 0.34, 0.05), toon(0x23263a), 0, -0.29, 0.04);
      leg.add(f); leg.userData.end = f;
      leg.position.set(s * 0.18 * B.tx, 0.36, 0);
      body.add(leg);
      return leg;
    };
    this.legL = lk(1); this.legR = lk(-1);
    const head = new THREE.Group(); head.position.y = 1.02 * B.ty; body.add(head); this.head = head;
    const hc = group(0, 0.34, 0); head.add(hc); this.hc = hc;
    hc.add(M(rbox(0.8, 0.62, 0.6, 0.12), shell));
    const screen = new THREE.Mesh(plane(0.62, 0.44), new THREE.MeshBasicMaterial({ map: robotFace(neon, 'open'), toneMapped: false }));
    screen.position.set(0, 0, 0.305);
    hc.add(screen);
    this.screen = screen; this.neon = neon;
    for (const s of [-1, 1]) hc.add(M(cyl(0.09, 0.09, 0.08, 10), neonM, s * 0.42, 0, 0, { rz: Math.PI / 2, shadow: false }));
    hc.add(M(cyl(0.015, 0.015, 0.22, 5), shell, 0.2, 0.42, 0));
    hc.add(M(sphere(0.05, 8, 6), neonM, 0.2, 0.55, 0, { shadow: false }));
    if (spec.helmet) hc.add(M(rbox(0.84, 0.16, 0.64, 0.06), toon(spec.helmet.color), 0, 0.3, 0));
  }

  _buildWick(spec, B) {
    const body = this.body;
    const brass = toon(0xb8862f), copper = toon(0x9a5a34), dark = toon(0x3a2a2e);
    const torso = M(cyl(0.34, 0.4, 0.62, 12), copper, 0, 0.68, 0);
    body.add(torso); this.torso = torso;
    body.add(M(torus(0.385, 0.035, 5, 14), brass, 0, 0.42, 0, { rx: Math.PI / 2 }));
    body.add(M(torus(0.345, 0.035, 5, 14), brass, 0, 0.94, 0, { rx: Math.PI / 2 }));
    for (let i = 0; i < 3; i++) body.add(M(sphere(0.035, 6, 5), brass, 0, 0.52 + i * 0.14, 0.38 - i * 0.02, { shadow: false }));
    body.add(M(rbox(0.5, 0.14, 0.05, 0.02), toon(0xf08a24), 0, 0.9, 0.34, { rx: -0.1 }));
    const mk = (s) => {
      const arm = new THREE.Group();
      arm.add(M(cyl(0.05, 0.05, 0.4, 6), dark, 0, -0.2, 0));
      arm.add(M(sphere(0.07, 8, 6), brass, 0, -0.2, 0));
      const h = M(sphere(0.17, 10, 8), toon(0xfdfbf5), 0, -0.46, 0, { sy: 0.9 });
      arm.add(h); arm.userData.end = h;
      arm.position.set(s * 0.44, 0.92, 0);
      body.add(arm);
      return arm;
    };
    this.armL = mk(1); this.armR = mk(-1);
    const lk = (s) => {
      const leg = new THREE.Group();
      leg.add(M(cyl(0.06, 0.06, 0.22, 6), dark, 0, -0.1, 0));
      const f = M(sphere(0.15, 10, 8), toon(0x5a3424), 0, -0.28, 0.06, { sy: 0.6, sz: 1.5 });
      leg.add(f); leg.userData.end = f;
      leg.position.set(s * 0.18, 0.36, 0);
      body.add(leg);
      return leg;
    };
    this.legL = lk(1); this.legR = lk(-1);
    const head = new THREE.Group(); head.position.y = 1.02; body.add(head); this.head = head;
    const hc = group(0, 0.4, 0); head.add(hc); this.hc = hc;
    hc.add(M(cyl(0.36, 0.4, 0.07, 6), brass, 0, -0.3, 0));
    hc.add(M(cyl(0.38, 0.3, 0.1, 6), brass, 0, 0.32, 0));
    hc.add(M(cone(0.3, 0.2, 6), brass, 0, 0.46, 0));
    hc.add(M(torus(0.09, 0.02, 5, 12), brass, 0, 0.62, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; hc.add(M(cyl(0.025, 0.025, 0.58, 5), brass, Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34)); }
    const glass = new THREE.Mesh(cyl(0.31, 0.33, 0.56, 6), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.55, toneMapped: false }));
    hc.add(glass);
    const flame = new THREE.Mesh(cone(0.12, 0.3, 7), flat(0xff9d2e, { toneMapped: false }));
    flame.position.y = -0.06;
    hc.add(flame);
    hc.add(new THREE.Mesh(sphere(0.07, 8, 6), flat(0xfff3b8)).translateY(-0.14));
    this.flame = flame;
    for (const s of [-1, 1]) {
      const eg = group(s * 0.12, 0.06, 0.3);
      const e = new THREE.Mesh(circle(0.06, 12), flat(0x2a1420));
      e.scale.set(1, 1.5, 1);
      eg.add(e); eg.userData.base = e.scale.clone(); eg.userData.eye = e; eg.userData.side = s;
      hc.add(eg); this.eyes.push(eg);
    }
    const gl = glowSprite(0xffb347, 4.2, 0.5); gl.position.y = 1.45; this.root.add(gl);
    this.glow = gl;
  }

  /**
   * Collapse everything that never moves on its own (helmet, face, torso,
   * each limb) into a handful of merged meshes — a character goes from ~40
   * draw calls to ~15. Eyes, floppy ears, tails and wings stay separate.
   */
  _bakeStatic() {
    const moving = new Set([this.head, this.armL, this.armR, this.legL, this.legR, this.tail, ...this.wings].filter(Boolean));
    for (const limb of [this.armL, this.armR, this.legL, this.legR]) {
      const end = limb && limb.userData.end;
      if (!end || end === limb) continue;
      // keep an attachment point where the hand / foot was (lanterns, rods…)
      const anchor = new THREE.Group();
      anchor.position.copy(end.position);
      anchor.userData.keep = true;
      limb.add(anchor);
      limb.userData.end = anchor;
      bake(limb);
    }
    bake(this.body, { skip: (o) => moving.has(o) });
    if (this.hc) bake(this.hc, { skip: (o) => (o.userData.eye !== undefined && o !== this.hc) || !!o.userData.flop });
    if (this.windKey) this.windKey.userData.keep = true;
  }

  // ------------------------------------------------------------ animation API
  /** Set the looping base state: move | carry | block | float | sit | down | dead | talk | cheer | sad | fish | hold */
  setBase(name) { if (this.base !== name) { this.base = name; } return this; }
  /** Play a one-shot (throw, catch, dive, kick, spin, juke, stumble, celebrate, wave, hop, getup, push, flinch). */
  play(name, dur) {
    const D = { throw: 0.46, catch: 0.4, dive: 0.5, kick: 0.5, spin: 0.42, juke: 0.26, stumble: 0.7, celebrate: 1.4, wave: 1.2, hop: 0.36, getup: 0.4, push: 0.5, flinch: 0.4, nod: 0.5, shake: 0.6, cast: 0.5, snap: 0.3, toss: 0.34, yank: 0.4 };
    this.one = name; this.oneT = 0; this.oneDur = dur || D[name] || 0.5;
    return this;
  }
  stop() { this.one = null; }
  get busy() { return !!this.one; }

  setExpr(name, dur = 0) { this.expr = name; this.exprT = dur; if (this.screen) this.screen.material.map = robotFace(this.neon, name); }

  /** Smoothly turn toward a yaw angle (radians, 0 = facing +z). */
  face(yaw, dt, rate = 14) {
    this.yaw = dt === undefined ? yaw : this.yaw + wrapAngle(yaw - this.yaw) * (1 - Math.exp(-rate * dt));
    this.root.rotation.y = this.yaw;
  }
  faceTo(x, z, dt, rate) {
    const dx = x - this.root.position.x, dz = z - this.root.position.z;
    if (dx * dx + dz * dz > 1e-6) this.face(Math.atan2(dx, dz), dt, rate);
  }
  setPos(x, z, y = 0) { this.root.position.set(x, y, z); return this; }
  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }

  _targets(dt) {
    const p = this.pose;
    // reset
    p.y = 0; p.rx = 0; p.rz = 0; p.ry = 0; p.by = 0; p.brx = 0; p.brz = 0; p.bry = 0; p.sq = 1;
    p.hx = 0; p.hy = 0; p.hz = 0; p.alf = 0; p.arf = 0; p.alo = 0.14; p.aro = 0.14; p.llf = 0; p.lrf = 0;
    const t = this.t;
    const sp = this.speed;
    let st = this.base;
    const floaty = this.floaty;
    const run = (k = 1) => {
      const A = clamp(0.3 + sp / 7, 0.3, 1.05) * k;
      const s = Math.sin(this.phase);
      p.llf = s * A; p.lrf = -s * A;
      p.arf = s * A * 0.95; p.alf = -s * A * 0.95;
      p.by = Math.abs(Math.cos(this.phase)) * 0.07 * A;
      p.brx = 0.1 + clamp(sp / 9, 0, 1) * 0.26;
      p.brz = s * 0.05;
      p.hx = -0.06;
    };
    if (st === 'move' || st === 'carry') {
      if (sp > 0.25) {
        run();
        if (this.hoppy) { p.llf = p.lrf = 0; p.y = Math.abs(Math.sin(this.phase)) * 0.22; p.sq = 1 - Math.abs(Math.cos(this.phase)) * 0.08; }
      } else {
        p.by = Math.sin(t * 2.1) * 0.012;
        p.alo = 0.16 + Math.sin(t * 2.1) * 0.03; p.aro = p.alo;
        p.hz = Math.sin(t * 0.7) * 0.03;
      }
      if (st === 'carry') { p.arf = 1.15; p.aro = -0.5; }
    } else if (st === 'float') {
      p.y = 0.16 + Math.sin(t * 2.2) * 0.06;
      p.brz = Math.sin(t * 1.3) * 0.05;
      p.brx = clamp(sp / 8, 0, 1) * 0.3;
      p.alo = 0.3 + Math.sin(t * 2.2) * 0.1; p.aro = p.alo;
      p.alf = p.arf = -0.2 * clamp(sp / 6, 0, 1);
    } else if (st === 'block') {
      p.alf = p.arf = 1.5; p.alo = p.aro = 0.3;
      p.llf = -0.25; p.lrf = 0.25; p.brx = 0.3;
      p.by = Math.abs(Math.sin(t * 13)) * 0.03;
    } else if (st === 'sit') {
      p.llf = p.lrf = 1.35; p.y = -0.2; p.brx = -0.08; p.alo = p.aro = 0.25;
      p.hz = Math.sin(t * 0.8) * 0.04;
    } else if (st === 'down') {
      p.rx = 1.5; p.y = 0.3; p.alo = p.aro = 1.2; p.alf = 0.6; p.arf = 2.4; p.llf = -0.3; p.lrf = 0.4;
    } else if (st === 'dead') {
      p.rx = -1.5; p.y = 0.3; p.llf = 1.2 + Math.sin(t * 9) * 0.04; p.lrf = 1.45; p.alf = 1.9; p.arf = 2.2; p.alo = 0.5; p.aro = 0.7;
    } else if (st === 'talk') {
      p.by = Math.abs(Math.sin(t * 8)) * 0.025; p.arf = 0.7 + Math.sin(t * 5) * 0.35; p.aro = 0.3; p.hz = Math.sin(t * 3) * 0.05;
    } else if (st === 'cheer') {
      p.y = Math.abs(Math.sin(t * 7)) * 0.3; p.alf = p.arf = 2.9; p.alo = p.aro = 0.45 + Math.sin(t * 14) * 0.2;
    } else if (st === 'sad') {
      p.hx = 0.45; p.brx = 0.2; p.alo = p.aro = 0.05;
    } else if (st === 'fish') {
      p.arf = 1.25; p.alf = 1.0; p.aro = -0.2; p.alo = -0.2; p.brx = 0.05;
    } else if (st === 'hold') {
      p.arf = 1.3; p.alf = 1.3; p.aro = -0.25; p.alo = -0.25;
    } else if (st === 'panic') {
      p.alf = p.arf = 2.8; p.alo = 0.4 + Math.sin(t * 22) * 0.4; p.aro = 0.4 - Math.sin(t * 22) * 0.4;
      p.llf = Math.sin(t * 20) * 0.6; p.lrf = -p.llf; p.hz = Math.sin(t * 16) * 0.12;
    } else if (st === 'ready') {
      p.brx = 0.34; p.llf = -0.2; p.lrf = 0.2; p.alf = p.arf = 0.5; p.alo = p.aro = 0.3; p.by = -0.04;
    } else if (st === 'sleep') {
      p.rx = -1.5; p.y = 0.3; p.alo = p.aro = 0.6; p.sq = 1 + Math.sin(t * 1.6) * 0.03;
    }
    if (floaty && st !== 'float' && st !== 'down' && st !== 'dead') p.y += 0.16 + Math.sin(t * 2.2) * 0.05;

    // one-shots override on top
    if (this.one) {
      const k = clamp(this.oneT / this.oneDur, 0, 1);
      const o = this.one;
      if (o === 'throw') {
        if (k < 0.4) { const u = k / 0.4; p.arf = lerp(0.6, 3.7, u); p.bry = -0.5 * u; p.alf = 1.2 * u; p.brx = -0.15 * u; } else { const u = (k - 0.4) / 0.6; p.arf = lerp(3.7, 0.9, Math.min(1, u * 2.2)); p.bry = lerp(-0.5, 0.5, Math.min(1, u * 2.2)); p.brx = 0.25 * Math.min(1, u * 2); p.alf = 0.3; }
        p.aro = 0.2; p.llf = 0.3; p.lrf = -0.3;
      } else if (o === 'toss') {
        p.arf = lerp(0.2, 1.7, Math.sin(k * Math.PI)); p.aro = 0.5; p.bry = 0.3 * Math.sin(k * Math.PI);
      } else if (o === 'catch') {
        const u = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        p.alf = p.arf = 2.3 * u + 0.4; p.alo = p.aro = 0.25; p.brx = -0.18 * u; p.hx = -0.25 * u; p.y += Math.sin(k * Math.PI) * 0.16;
      } else if (o === 'dive') {
        const u = Math.min(1, k * 2.4);
        p.rx = 1.35 * u; p.y = 0.25 + Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.35; p.alf = p.arf = 3.0; p.alo = p.aro = 0.2; p.llf = -0.5; p.lrf = -0.3; p.brx = 0;
      } else if (o === 'kick') {
        const u = k < 0.45 ? -0.9 * (k / 0.45) : lerp(-0.9, 1.7, Math.min(1, (k - 0.45) / 0.2));
        p.lrf = k > 0.8 ? lerp(1.7, 0.2, (k - 0.8) / 0.2) : u; p.llf = -0.15; p.alo = 0.9; p.aro = 0.7; p.brx = k > 0.45 ? -0.22 : 0.1; p.alf = -0.4; p.arf = 0.5;
      } else if (o === 'spin') {
        p.ry = TAU * (1 - Math.pow(1 - k, 2)); p.alo = p.aro = 1.2; p.by = 0.06; p.brx = 0.1;
      } else if (o === 'juke') {
        const u = Math.sin(k * Math.PI);
        p.brz = 0.5 * u * (this.jukeDir || 1); p.sq = 1 - 0.12 * u; p.alo = p.aro = 0.7; p.llf = 0.4 * u; p.lrf = -0.4 * u;
      } else if (o === 'stumble') {
        p.brx = 0.65 * Math.sin(k * Math.PI); p.alf = 1.5 + Math.sin(k * 30) * 0.8; p.arf = 1.5 - Math.sin(k * 30) * 0.8; p.alo = p.aro = 0.8; p.llf = Math.sin(k * 26) * 0.6; p.lrf = -p.llf; p.hz = Math.sin(k * 20) * 0.15;
      } else if (o === 'celebrate') {
        p.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.5; p.alf = p.arf = 3.0; p.alo = p.aro = 0.4 + Math.sin(k * 40) * 0.25; p.ry = k * TAU; p.sq = 1 + Math.sin(k * Math.PI * 6) * 0.06;
      } else if (o === 'wave') {
        p.arf = 2.9 + Math.sin(k * 26) * 0.3; p.aro = 0.45; p.hz = 0.1; p.by = Math.abs(Math.sin(k * 10)) * 0.02;
      } else if (o === 'hop') {
        p.y += Math.sin(k * Math.PI) * 0.45; p.sq = 1 + Math.sin(k * Math.PI * 2) * 0.1; p.alo = p.aro = 0.7; p.llf = p.lrf = 0.3 * Math.sin(k * Math.PI);
      } else if (o === 'getup') {
        const u = 1 - k; p.rx = 1.5 * u * u; p.y = 0.3 * u; p.alo = p.aro = 0.8 * u;
      } else if (o === 'push') {
        p.alf = p.arf = 1.55; p.alo = p.aro = 0.1; p.brx = 0.5 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.6 + 0.3); p.llf = Math.sin(k * 14) * 0.5; p.lrf = -p.llf;
      } else if (o === 'flinch') {
        const u = Math.sin(k * Math.PI);
        p.brx = -0.3 * u; p.alf = p.arf = 2.4 * u; p.alo = p.aro = 0.5; p.y += 0.2 * u; p.sq = 1 + 0.1 * u;
      } else if (o === 'nod') {
        p.hx = Math.sin(k * Math.PI * 2) * 0.3;
      } else if (o === 'shake') {
        p.hy = Math.sin(k * Math.PI * 4) * 0.4;
      } else if (o === 'cast') {
        p.arf = k < 0.4 ? lerp(1.2, 3.4, k / 0.4) : lerp(3.4, 1.3, (k - 0.4) / 0.6); p.brx = k < 0.4 ? -0.15 : 0.2;
      } else if (o === 'snap') {
        p.brx = 0.7; p.alf = p.arf = lerp(0.4, -0.9, k); p.llf = -0.3; p.lrf = -0.3; p.by = -0.08;
      } else if (o === 'yank') {
        p.arf = 2.6; p.alf = 2.6; p.brx = -0.3; p.y += Math.sin(k * Math.PI) * 0.12;
      }
      this.oneT += dt;
      if (this.oneT >= this.oneDur) this.one = null;
    }
  }

  _apply(dt, snap) {
    this._targets(dt);
    const p = this.pose, c = this.cur;
    const k = snap ? 1 : 1 - Math.exp(-(this.one ? 26 : 16) * dt);
    for (const key in p) c[key] = c[key] === undefined || snap ? p[key] : c[key] + (p[key] - c[key]) * k;
    if (this.one === 'spin' || this.one === 'celebrate') c.ry = p.ry; else if (Math.abs(c.ry) > 0.01 && !this.one) c.ry = p.ry;
    this.tilt.position.y = c.y;
    this.tilt.rotation.set(c.rx, c.ry, c.rz);
    this.body.position.y = c.by;
    this.body.rotation.set(c.brx, c.bry, c.brz);
    const sq = c.sq;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.head.rotation.set(c.hx, c.hy, c.hz);
    this.armL.rotation.set(-c.alf, 0, c.alo);
    this.armR.rotation.set(-c.arf, 0, -c.aro);
    this.legL.rotation.x = -c.llf;
    this.legR.rotation.x = -c.lrf;
    this.blob.scale.setScalar(clamp(1 - c.y * 0.6, 0.45, 1));
  }

  /** Advance animation. speed = horizontal speed in units/sec (drives the run cycle). */
  update(dt, speed = 0) {
    this.t += dt;
    this.speed = damp(this.speed, speed, 12, dt);
    this.phase += dt * (4.5 + this.speed * 1.55) * (this.speed > 0.25 ? 1 : 0);
    this._apply(dt, false);
    const t = this.t;
    // secondary motion
    if (this.tail) this.tail.rotation.y = Math.sin(t * (2 + this.speed)) * (0.18 + Math.min(0.3, this.speed * 0.04));
    for (const e of this.ears) if (e.userData.flop) e.rotation.x = -clamp(this.speed * 0.05, 0, 0.5) + Math.sin(t * 3 + e.position.x * 9) * 0.04;
    for (const w of this.wings) {
      const f = this.speed > 0.5 || this.one ? 26 : 5;
      w.rotation.y = w.userData.side * (0.35 + Math.sin(t * f) * (this.speed > 0.5 ? 0.6 : 0.2));
    }
    if (this.flame) { const s = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 7.3) * 0.08; this.flame.scale.set(1, s, 1); if (this.glow) this.glow.material.opacity = 0.42 + Math.sin(t * 11) * 0.07; }
    if (this.windKey) this.windKey.rotation.z = t * 2.4;
    // eyes
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.setExpr('open'); }
    this.blinkT -= dt;
    let sx = 1, sy = 1, rz = 0;
    const ex = this.expr;
    if (ex === 'happy') { sy = 0.34; sx = 1.15; } else if (ex === 'wide') { sy = 1.3; sx = 1.25; } else if (ex === 'angry') { sy = 0.62; rz = 0.45; } else if (ex === 'sad') { sy = 0.7; rz = -0.4; } else if (ex === 'closed' || ex === 'dead') { sy = 0.1; } else if (ex === 'dizzy') { sy = 1.2; sx = 1.2; rz = t * 9; }
    if (ex === 'open' && this.blinkT < 0.1) sy = 0.1;
    if (this.blinkT < 0) this.blinkT = rand(1.8, 5);
    for (const eg of this.eyes) {
      const b = eg.userData.base, e = eg.userData.eye;
      e.scale.set(b.x * sx, b.y * sy, b.z);
      eg.rotation.z = rz * (ex === 'dizzy' ? 1 : eg.userData.side);
    }
  }

  dispose() {
    disposeTree(this.root);          // baked meshes and one-off materials; shared geometry is left alone
    this.root.removeFromParent();
  }
}

// ---------------------------------------------------------------- helpers
let _wingTex = null;
function wingTex() {
  if (_wingTex) return _wingTex;
  _wingTex = canvasTex(64, 64, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = 'rgba(160,110,60,0.55)';
    c.beginPath(); c.arc(32, 26, 11, 0, TAU); c.fill();
    c.fillStyle = 'rgba(60,40,30,0.7)';
    c.beginPath(); c.arc(32, 26, 5, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(150,110,70,0.5)'; c.lineWidth = 3;
    c.beginPath(); c.arc(32, 32, 26, 0, TAU); c.stroke();
  });
  _wingTex.userData.shared = true;
  return _wingTex;
}

const faceCache = new Map();
function robotFace(neon, expr) {
  const key = `${neon}:${expr}`;
  let t = faceCache.get(key);
  if (t) return t;
  const col = `#${new THREE.Color(neon).getHexString()}`;
  t = canvasTex(64, 44, (c) => {
    c.fillStyle = '#0d1022'; c.fillRect(0, 0, 64, 44);
    c.fillStyle = col;
    const px = (x, y, w, h) => c.fillRect(x * 4, y * 4, w * 4, h * 4);
    if (expr === 'happy') { px(3, 4, 3, 1); px(2, 5, 1, 1); px(6, 5, 1, 1); px(10, 4, 3, 1); px(9, 5, 1, 1); px(13, 5, 1, 1); px(5, 8, 6, 1); px(4, 7, 1, 1); px(11, 7, 1, 1); }
    else if (expr === 'angry') { px(2, 3, 1, 1); px(3, 4, 2, 1); px(4, 5, 2, 2); px(13, 3, 1, 1); px(11, 4, 2, 1); px(10, 5, 2, 2); px(5, 8, 6, 1); }
    else if (expr === 'dizzy' || expr === 'dead' || expr === 'closed') { for (let i = 0; i < 3; i++) { px(3 + i, 3 + i, 1, 1); px(5 - i, 3 + i, 1, 1); px(10 + i, 3 + i, 1, 1); px(12 - i, 3 + i, 1, 1); } px(5, 8, 6, 1); }
    else if (expr === 'wide') { px(3, 2, 3, 4); px(10, 2, 3, 4); px(6, 8, 4, 2); }
    else { px(3, 3, 3, 3); px(10, 3, 3, 3); px(5, 8, 6, 1); }
    c.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 44; y += 4) c.fillRect(0, y, 64, 1);
  }, { nearest: true });
  t.userData.shared = true;
  faceCache.set(key, t);
  return t;
}

/** The football. Long axis = local z. */
export function buildFootball(scale = 1) {
  const g = new THREE.Group();
  const ball = M(sphere(0.17, 12, 10), toon(0x8a4a26), 0, 0, 0);
  ball.scale.set(0.62, 0.62, 1.05);
  g.add(ball);
  for (const s of [-1, 1]) g.add(M(torus(0.085, 0.014, 4, 12), toon(0xfff4dc), 0, 0, s * 0.105, { shadow: false }));
  g.add(M(box(0.03, 0.02, 0.13), toon(0xfff4dc), 0, 0.1, 0, { shadow: false }));
  g.scale.setScalar(scale);
  return g;
}

export { buildHelmet, addHat };
