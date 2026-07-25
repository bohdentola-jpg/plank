// WHAT THE OTHERS LOOK LIKE.
//
// Everybody who comes down here comes down dressed for it: a hooded suit, taped cuffs, a
// full-face respirator with two filters, and a camcorder held up at eye height because
// that is the whole reason anybody is on this tape. The suits are all the same cut and
// differ only by colour, so at forty metres in a corridor you can tell which one is your
// friend and nothing else about them.
//
// Built the same way as everything else in the game: boxes and cylinders, one material
// per surface, no more than a couple of hundred triangles. It is lit only by what people
// are carrying, so the suit gets a little emissive of its own to stay legible — the same
// trick the creatures use.

import * as THREE from 'three';
import { simple } from './textures.js';

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
const cyl = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 8) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y, z);
  return m;
};
const sph = (r, mat, x = 0, y = 0, z = 0, seg = 8) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2)), mat);
  m.position.set(x, y, z);
  return m;
};

// The colours a suit comes in. Bright, because the only thing worse than being lost is
// being lost and unable to find each other.
export const SUITS = [
  { key: 'hazard', name: 'HAZARD', suit: 0xe8d24a, trim: 0x2a2a30 },
  { key: 'medical', name: 'MEDICAL', suit: 0xdce6ea, trim: 0x2a4a6a },
  { key: 'orange', name: 'CONTRACTOR', suit: 0xe07a2a, trim: 0x2a2a30 },
  { key: 'forest', name: 'SURVEY', suit: 0x4a7a52, trim: 0x1e2a20 },
  { key: 'violet', name: 'RESEARCH', suit: 0x8a6ac0, trim: 0x241a34 },
  { key: 'grey', name: 'MAINTENANCE', suit: 0x9a9a94, trim: 0x33333a },
];

export const suitByKey = (key) => SUITS.find((s) => s.key === key) || SUITS[0];

const dim = (c, f) => {
  const r = Math.round(((c >> 16) & 255) * f), g = Math.round(((c >> 8) & 255) * f);
  return (r << 16) | (g << 8) | Math.round((c & 255) * f);
};

// One suit. `parts` is what the animator moves: legs, arms, the camcorder, the torch.
export function buildHazmat(suitKey = 'hazard') {
  const s = suitByKey(suitKey);
  const cloth = simple(s.suit, {
    rough: 0.82, emissive: dim(s.suit, 0.16), emissiveIntensity: 0.5,
  });
  const trim = simple(s.trim, { rough: 0.6 });
  const rubber = simple(0x23232a, { rough: 0.9 });
  const glassM = simple(0x2a3a44, { rough: 0.12, metal: 0.4, opacity: 0.85 });
  const filterM = simple(0x6a6f75, { rough: 0.5, metal: 0.5 });
  const camM = simple(0x35353c, { rough: 0.55 });
  const lensM = simple(0xbfe0ee, {
    rough: 0.08, metal: 0.3, emissive: 0x50c0e0, emissiveIntensity: 0.5,
  });

  const g = new THREE.Group();

  // ---- body: a suit is a bag with a person in it, so nothing is tailored
  const hips = box(0.36, 0.24, 0.24, cloth, 0, 0.94, 0);
  const torso = box(0.44, 0.6, 0.28, cloth, 0, 1.34, 0);
  const chestTape = box(0.45, 0.05, 0.29, trim, 0, 1.16, 0);      // taped seam
  const belt = box(0.4, 0.07, 0.26, trim, 0, 1.02, 0);
  // the hood, and the respirator inside it
  const hood = sph(0.19, cloth, 0, 1.76, 0, 9);
  hood.scale.set(1, 1.08, 1.02);
  const visor = box(0.2, 0.12, 0.06, glassM, 0, 1.75, 0.15);
  const mask = box(0.16, 0.13, 0.08, rubber, 0, 1.66, 0.14);
  const f1 = cyl(0.045, 0.045, 0.05, filterM, -0.11, 1.66, 0.1, 8);
  const f2 = cyl(0.045, 0.045, 0.05, filterM, 0.11, 1.66, 0.1, 8);
  f1.rotation.z = Math.PI / 2;
  f2.rotation.z = Math.PI / 2;

  // ---- limbs
  const armL = box(0.11, 0.6, 0.12, cloth, -0.28, 1.3, 0.02);
  const armR = box(0.11, 0.6, 0.12, cloth, 0.28, 1.3, 0.02);
  const cuffL = box(0.12, 0.05, 0.13, trim, -0.28, 1.02, 0.02);
  const cuffR = box(0.12, 0.05, 0.13, trim, 0.28, 1.02, 0.02);
  const legL = box(0.14, 0.84, 0.15, cloth, -0.11, 0.45, 0);
  const legR = box(0.14, 0.84, 0.15, cloth, 0.11, 0.45, 0);
  const bootL = box(0.16, 0.12, 0.22, rubber, -0.11, 0.06, 0.02);
  const bootR = box(0.16, 0.12, 0.22, rubber, 0.11, 0.06, 0.02);

  // ---- the camcorder, held up at eye height in both hands
  const cam = new THREE.Group();
  cam.position.set(0.16, 1.5, 0.3);
  cam.add(box(0.14, 0.11, 0.2, camM));
  cam.add(cyl(0.045, 0.05, 0.05, camM, 0, 0, 0.12, 10));
  cam.add(cyl(0.038, 0.038, 0.01, lensM, 0, 0, 0.152, 10));
  cam.add(box(0.05, 0.06, 0.02, trim, 0, 0.05, -0.09));           // the eyecup
  const tally = box(0.02, 0.02, 0.02, simple(0xff3020, {
    emissive: 0xff2010, emissiveIntensity: 2.2, rough: 0.4,
  }), 0.06, 0.05, 0.09);
  cam.add(tally);

  // ---- and the torch on the other hand, pointing wherever they are looking
  const torch = new THREE.Group();
  torch.position.set(-0.24, 1.36, 0.22);
  torch.add(cyl(0.03, 0.035, 0.16, camM, 0, 0, 0, 8));
  const bulb = cyl(0.036, 0.03, 0.02, simple(0xfff3d0, {
    emissive: 0xffe0a0, emissiveIntensity: 2.4, rough: 0.4,
  }), 0, 0, 0.09, 8);
  torch.add(bulb);
  torch.children[0].rotation.x = Math.PI / 2;
  bulb.rotation.x = Math.PI / 2;

  g.add(hips, torso, chestTape, belt, hood, visor, mask, f1, f2,
    armL, armR, cuffL, cuffR, legL, legR, bootL, bootR, cam, torch);

  g.userData.parts = { hood, armL, armR, legL, legR, torso, cam, torch, tally, bulb };
  g.userData.suit = s.key;
  return g;
}

// Walk cycle, hood turn, and the two things in their hands. `speed` is metres a second,
// `crouch` squashes them, `torchOn` decides whether their lamp is lit.
export function animateHazmat(mesh, dt, t, { speed = 0, crouch = 0, torchOn = true, recording = true, pitch = 0 } = {}) {
  const p = mesh.userData.parts;
  if (!p) return;
  const gait = Math.sin(t * (3.2 + speed * 1.1));
  const amp = Math.min(1, speed / 3.4) * 0.8 + 0.04;
  p.legL.rotation.x = gait * amp;
  p.legR.rotation.x = -gait * amp;
  p.armR.rotation.x = -gait * amp * 0.4;
  p.armL.rotation.x = gait * amp * 0.4;
  p.torso.rotation.y = gait * amp * 0.1;
  // they hold the camera where they are looking, which is how you tell what they can see
  p.cam.rotation.x = -pitch * 0.8;
  p.torch.rotation.x = -pitch * 0.9;
  p.hood.rotation.x = pitch * 0.25;
  p.bulb.visible = torchOn;
  p.tally.visible = recording;
  mesh.scale.y = 1 - crouch * 0.22;
}
