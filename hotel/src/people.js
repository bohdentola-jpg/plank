// The little people: guests dragging suitcases in off the road, staff on shift,
// and you. One articulated rig, about 1.7 units tall, built to read from across
// the lobby at a downward angle — a silhouette, a posture, and two dots for a
// face. Boxes, cylinders and spheres only; no art files, no loaders, no canvas.
//
// Ownership rule, because a hotel churns people all day: geometries are cached
// module-level and are NEVER disposed (they outlive any one guest, so checking
// somebody out cannot yank a box out from under the forty still standing in the
// lobby). Materials are the opposite — every rig makes its own, and
// disposePerson frees exactly those and nothing else.
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ palettes
// Roadside-motel wardrobe: nothing designer, everything a little sun-faded.
export const PALETTES = {
  skins: [
    '#f4d7bb', '#e8bf9a', '#d9a273', '#c1854f',
    '#a06a3c', '#7d4c2c', '#5d3620', '#42261a',
  ],
  shirts: [
    '#c9483c', '#e0a03a', '#4f7fa8', '#3c6b52',
    '#8a5b9c', '#e7e3d8', '#2f3540', '#c9748a',
    '#5f6f4c', '#d97b3f', '#7fa8b8', '#9fae4e',
  ],
  pants: [
    '#3a4356', '#5b6572', '#2c2e34', '#7c6a4f',
    '#8f8677', '#46372c', '#6b7f8a', '#3f4a3c',
  ],
  hairs: [
    '#1c1713', '#3b2a1c', '#5c3f26', '#7a2f22',
    '#8a6034', '#c39a5c', '#e0cb95', '#8c8f95', '#dcd9d3',
  ],
};

// Weighted tables, flat [value, weight, value, weight, ...].
const HAIR_W = ['short', 34, 'long', 21, 'bun', 15, 'cap', 13, 'bald', 12];
const BUILD_W = ['avg', 46, 'slim', 29, 'stout', 25];
const BAG_W = [null, 60, 'suitcase', 17, 'duffel', 12, 'backpack', 11];
const HAT_W = [null, 84, 'cap', 11, 'visor', 5];

// Staff kit. The shirt colours mirror ROLES[].uniform in data.js on purpose;
// they are written out literally so this module stays dependency-free.
const UNIFORMS = {
  you:         { shirt: '#b1442f', pants: '#3a4356', accent: '#e0c37a', band: 'belt', tool: null, hat: null },
  clerk:       { shirt: '#1d3557', pants: '#22283a', accent: '#c8a24c', band: 'vest', tool: 'clipboard', hat: null },
  housekeeper: { shirt: '#4a7c59', pants: '#33463a', accent: '#ece7d8', band: 'apron', tool: 'cart', hat: null },
  maintenance: { shirt: '#8a5a2b', pants: '#4a4b52', accent: '#d9b03c', band: 'belt', tool: 'toolbox', hat: 'cap' },
  bellhop:     { shirt: '#7d2836', pants: '#2b2026', accent: '#d8b45c', band: 'vest', tool: 'tray', hat: 'cap' },
  laundry:     { shirt: '#5d6b8a', pants: '#3d4557', accent: '#e8e9ec', band: 'apron', tool: 'basket', hat: null },
  auditor:     { shirt: '#2f2a44', pants: '#24202f', accent: '#8f86b8', band: 'vest', tool: null, hat: null },
  manager:     { shirt: '#3d3b39', pants: '#2a2927', accent: '#b9a06a', band: 'vest', tool: 'clipboard', hat: null },
};

// Where a carried thing hangs off the rig.
const PROP_MOUNT = {
  suitcase: 'hand', duffel: 'hand', backpack: 'hand',
  toolbox: 'hand', clipboard: 'hand',
  tray: 'carry', basket: 'carry',
  cart: 'push', // the one prop that lives on the floor — see buildPerson
};

const DEFAULT_LOOK = {
  skin: '#d9a273', shirt: '#4f7fa8', pants: '#3a4356', hair: '#3b2a1c',
  hairStyle: 'short', build: 'avg', bag: null, hat: null,
};

const BUILDS = {
  slim:  { w: 0.87, limb: 0.90, belly: 0, tall: 1.025 },
  avg:   { w: 1.00, limb: 1.00, belly: 0, tall: 1.000 },
  stout: { w: 1.19, limb: 1.15, belly: 1, tall: 0.965 },
};

// ------------------------------------------------------------------ tiny math
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function smooth01(v, lo, hi) {
  const t = clamp((v - lo) / (hi - lo || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

function shade(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  if (!Number.isFinite(n)) return hex;
  const c = (v) => clamp(Math.round(v), 0, 255);
  const r = c(((n >> 16) & 255) + amt);
  const g = c(((n >> 8) & 255) + amt);
  const b = c((n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function pick(arr, rand) { return arr[Math.floor(rand() * arr.length) % arr.length]; }

// A stable phase offset per look, so a lobby full of people never breathes in
// lockstep. Cheap string hash — no randomness, so a reloaded save looks the same.
function hashSeed(look) {
  const s = `${look.skin}|${look.shirt}|${look.pants}|${look.hair}|${look.hairStyle}|${look.build}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 * TAU;
}

function wpick(table, rand) {
  let total = 0;
  for (let i = 1; i < table.length; i += 2) total += table[i];
  let r = rand() * total;
  for (let i = 0; i < table.length; i += 2) {
    r -= table[i + 1];
    if (r <= 0) return table[i];
  }
  return table[0];
}

// ------------------------------------------------------------------ looks
/** A traveller. Nothing coordinated — that is the point. */
export function randomLook(rand = Math.random) {
  const r = typeof rand === 'function' ? rand : Math.random;
  return {
    skin: pick(PALETTES.skins, r),
    shirt: pick(PALETTES.shirts, r),
    pants: pick(PALETTES.pants, r),
    hair: pick(PALETTES.hairs, r),
    hairStyle: wpick(HAIR_W, r),
    build: wpick(BUILD_W, r),
    bag: wpick(BAG_W, r),
    hat: wpick(HAT_W, r),
  };
}

/** Same shape as a guest, but on the clock: uniform colours, a band, a tool. */
export function staffLook(role, rand = Math.random) {
  const r = typeof rand === 'function' ? rand : Math.random;
  const u = UNIFORMS[role] || UNIFORMS.clerk;
  const look = randomLook(r);
  look.role = role;
  look.shirt = u.shirt;
  look.pants = u.pants;
  look.accent = u.accent;
  look.band = u.band;
  look.tool = u.tool;
  look.bag = null;
  look.hat = u.hat;
  // No beanies on shift.
  if (look.hairStyle === 'cap') look.hairStyle = r() < 0.5 ? 'short' : 'bun';
  return look;
}

// ------------------------------------------------------------- geometry cache
// Shared for the life of the page; see the ownership note at the top of the file.
const GEO = new Map();
function cached(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
}
const n4 = (v) => (+v).toFixed(4);

function gBox(w, h, d) {
  return cached(`b${n4(w)},${n4(h)},${n4(d)}`, () => new THREE.BoxGeometry(w, h, d));
}
function gCyl(rt, rb, h, seg = 10) {
  return cached(`c${n4(rt)},${n4(rb)},${n4(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}
function gSph(r, w = 12, h = 9, thetaLen = Math.PI) {
  return cached(`s${n4(r)},${w},${h},${n4(thetaLen)}`,
    () => new THREE.SphereGeometry(r, w, h, 0, TAU, 0, thetaLen));
}
function gTor(r, tube, ring = 14, arc = TAU) {
  return cached(`t${n4(r)},${n4(tube)},${ring},${n4(arc)}`,
    () => new THREE.TorusGeometry(r, tube, 6, ring, arc));
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function group(x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

// ------------------------------------------------------------------ skeleton
// Standing proportions, feet at y = 0.
const HIP_Y = 0.90;
const TORSO_Y = 0.06;     // torso pivot, above the hips
const SHOULDER_Y = 0.38;  // above the torso pivot
const HEAD_Y = 0.50;
const PIP_Y = 0.256;      // the mood bead, resting on the crown

// ------------------------------------------------------------------ the rig
/**
 * Build one person. `look` is whatever randomLook/staffLook produced; missing
 * fields fall back to a plain brown-haired guest in a blue shirt.
 * Returns a THREE.Group with `.j` (joints), `.prop` (carried thing or null)
 * and `.userData = { phase, look, ... }`.
 */
export function buildPerson(look = {}) {
  const L = Object.assign({}, DEFAULT_LOOK, look || {});
  const b = BUILDS[L.build] || BUILDS.avg;
  const W = b.w;
  const Lb = b.limb;
  const mats = [];
  const mat = (color, shininess = 8, opts) => {
    const m = new THREE.MeshPhongMaterial(Object.assign(
      { color, shininess, specular: '#22222a' }, opts || {}));
    mats.push(m);
    return m;
  };

  const uniformed = !!L.band;
  const accentCol = L.accent || shade(L.shirt, -34);
  const M = {
    skin: mat(L.skin, 4),
    skinDark: mat(shade(L.skin, -22), 4),
    shirt: mat(L.shirt, 10),
    pants: mat(L.pants, 6),
    hair: mat(L.hair, 16),
    accent: mat(accentCol, 14),
    shoe: mat('#2a272d', 28),
    sole: mat('#4a464e', 6),
    dark: mat('#191820', 12),
    metal: mat('#adb2bb', 70, { specular: '#e8ecf2' }),
    leather: mat('#6d4a30', 22),
    linen: mat('#eceade', 4),
    plastic: mat('#c9ccd2', 24),
  };

  const rig = new THREE.Group();
  // Everything animated hangs off `root`, so posePerson can crouch, sit or lie
  // the body down without touching where the caller parked the rig.
  const root = group();
  root.scale.setScalar(b.tall);
  rig.add(root);

  // ---- hips + pelvis
  const hips = group(0, HIP_Y, 0);
  root.add(hips);
  const pelvis = mesh(gCyl(0.126 * W, 0.112 * W, 0.19, 12), M.pants, 0, -0.02, 0);
  pelvis.scale.z = 0.66;
  hips.add(pelvis);

  // ---- torso
  const torso = group(0, TORSO_Y, 0);
  hips.add(torso);
  const chest = mesh(gCyl(0.160 * W, 0.130 * W, 0.42, 12), M.shirt, 0, 0.21, 0);
  chest.scale.z = 0.62;
  torso.add(chest);
  if (b.belly) {
    const gut = mesh(gSph(0.132 * W, 12, 9), M.shirt, 0, 0.110, 0.012);
    gut.scale.set(0.98, 0.80, 0.62);
    torso.add(gut);
  }
  // collar + a placket of buttons: the two details that say "shirt" at 20 units out
  const collar = mesh(gTor(0.070 * W, 0.020, 14), uniformed ? M.accent : M.shirt, 0, 0.418, 0);
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.72;
  torso.add(collar);
  const frontZ = 0.160 * W * 0.62;
  for (let i = 0; i < 3; i++) {
    torso.add(mesh(gSph(0.009, 6, 5), M.dark, 0, 0.355 - i * 0.072, frontZ + 0.004));
  }

  // ---- the uniform band: what tells housekeeping from the bellhop at a glance
  if (L.band === 'vest') {
    const vest = mesh(gCyl(0.168 * W, 0.150 * W, 0.32, 12), M.accent, 0, 0.21, 0);
    vest.scale.z = 0.63;
    torso.add(vest);
    for (let i = 0; i < 2; i++) {
      torso.add(mesh(gSph(0.011, 6, 5), M.metal, 0, 0.25 - i * 0.080, 0.108 * W + 0.004));
    }
  } else if (L.band === 'apron') {
    const bib = mesh(gBox(0.21 * W, 0.36, 0.02), M.accent, 0, 0.15, frontZ + 0.012);
    torso.add(bib);
    for (const s of [-1, 1]) {
      const strap = mesh(gBox(0.030, 0.20, 0.018), M.accent, s * 0.072 * W, 0.36, frontZ * 0.72);
      strap.rotation.x = -0.30;
      torso.add(strap);
    }
    const tie = mesh(gTor(0.148 * W, 0.014, 14), M.accent, 0, 0.05, 0);
    tie.rotation.x = Math.PI / 2;
    tie.scale.z = 0.66;
    torso.add(tie);
  } else if (L.band === 'belt') {
    const belt = mesh(gTor(0.140 * W, 0.026, 14), M.leather, 0, 0.015, 0);
    belt.rotation.x = Math.PI / 2;
    belt.scale.z = 0.70;
    torso.add(belt);
    torso.add(mesh(gBox(0.05, 0.05, 0.018), M.accent, 0, 0.015, frontZ + 0.010));
    for (const s of [-1, 1]) {
      torso.add(mesh(gBox(0.055, 0.075, 0.045), M.leather, s * 0.108 * W, -0.01, 0.02));
    }
  }

  // ---- neck + head
  torso.add(mesh(gCyl(0.048, 0.054, 0.10, 8), M.skin, 0, 0.45, 0));
  const head = group(0, HEAD_Y, 0);
  torso.add(head);
  const skull = mesh(gSph(0.125, 14, 11), M.skin, 0, 0.095, 0);
  skull.scale.set(0.98, 1.06, 0.94);
  head.add(skull);
  for (const s of [-1, 1]) {
    const eye = mesh(gSph(0.019, 8, 6), M.dark, s * 0.048, 0.100, 0.104);
    eye.scale.set(1, 1.15, 0.45);
    head.add(eye);
  }
  const nose = mesh(gSph(0.020, 6, 5), M.skinDark, 0, 0.066, 0.110);
  nose.scale.set(0.8, 0.85, 1.15);
  head.add(nose);
  addHair(head, L, M);
  addHat(head, L, M, mat);

  // The mood bead. Unlit so it stays legible in a dark corridor at 2am.
  const pipMat = new THREE.MeshBasicMaterial({ color: '#5fb96c' });
  mats.push(pipMat);
  const pip = mesh(gSph(0.026, 8, 6), pipMat, 0, PIP_Y, 0);
  pip.castShadow = false;
  head.add(pip);

  // ---- arms
  const arms = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const sh = group(s * 0.166 * W, SHOULDER_Y, 0);
    torso.add(sh);
    sh.add(mesh(gSph(0.052 * Lb, 10, 8), M.shirt));
    sh.add(mesh(gCyl(0.045 * Lb, 0.040 * Lb, 0.26, 8), M.skin, 0, -0.13, 0));
    if (uniformed) {
      sh.add(mesh(gCyl(0.051 * Lb, 0.045 * Lb, 0.245, 9), M.shirt, 0, -0.12, 0));
    } else {
      sh.add(mesh(gCyl(0.052 * Lb, 0.049 * Lb, 0.14, 9), M.shirt, 0, -0.06, 0));
    }

    const fore = group(0, -0.25, 0);
    sh.add(fore);
    fore.add(mesh(gSph(0.041 * Lb, 8, 6), uniformed ? M.shirt : M.skin));
    if (uniformed) {
      const cuff = mesh(gTor(0.043 * Lb, 0.012, 12), M.accent, 0, -0.012, 0);
      cuff.rotation.x = Math.PI / 2;
      fore.add(cuff);
    }
    fore.add(mesh(gCyl(0.041 * Lb, 0.036 * Lb, 0.24, 8), M.skin, 0, -0.12, 0));
    const hand = mesh(gSph(0.046, 8, 6), M.skin, 0, -0.245, 0);
    hand.scale.set(0.85, 1.05, 0.9);
    fore.add(hand);
    const grip = group(0, -0.278, 0.012);
    fore.add(grip);

    arms['arm' + side] = sh;
    arms['fore' + side] = fore;
    arms['hand' + side] = grip;
  }

  // ---- legs
  const legs = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const leg = group(s * 0.078 * W, -0.02, 0);
    hips.add(leg);
    leg.add(mesh(gSph(0.067 * Lb, 10, 8), M.pants));
    leg.add(mesh(gCyl(0.064 * Lb, 0.052 * Lb, 0.40, 9), M.pants, 0, -0.20, 0));

    const shin = group(0, -0.40, 0);
    leg.add(shin);
    shin.add(mesh(gSph(0.052 * Lb, 8, 6), M.pants));
    shin.add(mesh(gCyl(0.051 * Lb, 0.042 * Lb, 0.42, 8), M.pants, 0, -0.21, 0));

    const foot = group(0, -0.42, 0);
    shin.add(foot);
    foot.add(mesh(gBox(0.096 * W, 0.070, 0.185), M.shoe, 0, -0.008, 0.026));
    foot.add(mesh(gBox(0.102 * W, 0.016, 0.192), M.sole, 0, -0.052, 0.026));
    const toe = mesh(gSph(0.048, 8, 6), M.shoe, 0, -0.010, 0.090);
    toe.scale.set(1, 0.64, 1.0);
    foot.add(toe);

    legs['leg' + side] = leg;
    legs['shin' + side] = shin;
    legs['foot' + side] = foot;
  }

  // ---- attachment points
  // Hand-held props hang off handR; trays and baskets ride `carry`. `push` is
  // the exception: a housekeeping cart has wheels on the carpet, so it hangs
  // off the root at floor level instead of swinging from the chest.
  const carry = group(0, 0.26, 0.24);      // level, in front of the chest
  torso.add(carry);
  const push = group(0, 0, 0.42);          // floor level, at arm's length
  root.add(push);

  rig.j = {
    root, hips, torso, head, carry, push,
    armL: arms.armL, armR: arms.armR,
    foreL: arms.foreL, foreR: arms.foreR,
    handL: arms.handL, handR: arms.handR,
    legL: legs.legL, legR: legs.legR,
    shinL: legs.shinL, shinR: legs.shinR,
    footL: legs.footL, footR: legs.footR,
  };

  // ---- the carried thing
  const kind = L.tool || L.bag || null;
  const mount = kind ? (PROP_MOUNT[kind] || 'hand') : null;
  let prop = null;
  if (kind) {
    prop = buildProp(kind, M, mat);
    if (prop) {
      const host = mount === 'carry' ? carry : mount === 'push' ? push : arms.handR;
      host.add(prop);
    }
  }
  rig.prop = prop;

  rig.traverse((o) => { if (o.isMesh && o !== pip) o.castShadow = true; });

  rig.userData = {
    phase: 0,
    look: L,
    slow: 0,
    seed: hashSeed(L),
    mood: 0.7,
    moodStep: -1,
    slump: 0,
    mats,
    pip,
    propMount: prop ? mount : null,
    uniformed,
  };
  setPersonMood(rig, 0.7);
  return rig;
}

// ------------------------------------------------------------------ head bits
function addHair(head, L, M) {
  const style = L.hairStyle;
  if (style === 'bald') {
    // A horseshoe of holdouts around the back. Reads instantly from behind.
    const ring = mesh(gTor(0.117, 0.017, 16, Math.PI * 1.25), M.hair, 0, 0.052, -0.004);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = -Math.PI * 0.375;
    ring.scale.set(1, 1, 0.94);
    head.add(ring);
    return;
  }
  const thetaLen = style === 'long' ? Math.PI * 0.60
    : style === 'cap' ? Math.PI * 0.62
      : style === 'bun' ? Math.PI * 0.50 : Math.PI * 0.55;
  const r = style === 'cap' ? 0.134 : 0.129;
  const cap = mesh(gSph(r, 14, 10, thetaLen), M.hair, 0, 0.095, -0.004);
  cap.scale.set(0.99, 1.07, 0.97);
  head.add(cap);

  if (style === 'short') {
    const nape = mesh(gSph(0.112, 10, 8), M.hair, 0, 0.058, -0.040);
    nape.scale.set(0.92, 0.60, 0.80);
    head.add(nape);
  } else if (style === 'bun') {
    head.add(mesh(gSph(0.052, 10, 8), M.hair, 0, 0.176, -0.082));
    const band = mesh(gTor(0.040, 0.010, 10), M.hair, 0, 0.152, -0.062);
    band.rotation.x = 0.7;
    head.add(band);
  } else if (style === 'long') {
    const fall = mesh(gSph(0.132, 12, 10), M.hair, 0, 0.040, -0.036);
    fall.scale.set(0.96, 1.10, 0.76);
    head.add(fall);
    const tail = mesh(gBox(0.185, 0.20, 0.085), M.hair, 0, -0.070, -0.062);
    tail.rotation.x = -0.10;
    head.add(tail);
  } else if (style === 'cap') {
    const brim = mesh(gTor(0.126, 0.019, 16), M.hair, 0, 0.048, -0.004);
    brim.rotation.x = Math.PI / 2;
    brim.scale.set(1, 1, 0.97);
    head.add(brim);
  }
}

function addHat(head, L, M, mat) {
  if (!L.hat) return;
  const hatMat = L.band ? M.accent : mat(shade(L.shirt, -46), 12);
  // Both ride high on the forehead — a bill at eye level erases the whole face.
  if (L.hat === 'cap') {
    const crown = mesh(gSph(0.132, 12, 8, Math.PI * 0.5), hatMat, 0, 0.128, -0.006);
    crown.scale.set(1, 0.94, 1.02);
    head.add(crown);
    const bill = mesh(gBox(0.148, 0.017, 0.105), hatMat, 0, 0.127, 0.122);
    bill.rotation.x = -0.10;
    head.add(bill);
    head.add(mesh(gSph(0.014, 6, 5), hatMat, 0, 0.248, -0.006));
  } else {
    const band = mesh(gTor(0.116, 0.015, 16), hatMat, 0, 0.150, -0.004);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 1, 0.96);
    head.add(band);
    const brim = mesh(gBox(0.150, 0.014, 0.098), hatMat, 0, 0.148, 0.112);
    brim.rotation.x = -0.14;
    head.add(brim);
  }
}

// ------------------------------------------------------------------ the props
function buildProp(kind, M, mat) {
  const g = new THREE.Group();
  switch (kind) {
    case 'suitcase': {
      const shell = mat('#7a4f33', 20);
      g.add(mesh(gBox(0.215, 0.275, 0.085), shell));
      for (const s of [-1, 1]) g.add(mesh(gBox(0.022, 0.285, 0.092), M.leather, s * 0.062, 0, 0));
      const handle = mesh(gTor(0.042, 0.009, 12, Math.PI), M.dark, 0, 0.138, 0);
      g.add(handle);
      for (const s of [-1, 1]) {
        for (const t of [-1, 1]) g.add(mesh(gSph(0.012, 6, 5), M.metal, s * 0.093, t * 0.123, 0.038));
      }
      g.add(mesh(gBox(0.052, 0.036, 0.006), mat('#d8b23f', 30), 0.045, -0.062, 0.046));
      g.position.set(0.01, -0.20, 0.01);
      break;
    }
    case 'duffel': {
      const canvasM = mat('#455a68', 8);
      const body = mesh(gCyl(0.088, 0.088, 0.30, 12), canvasM);
      body.rotation.z = Math.PI / 2;
      g.add(body);
      for (const s of [-1, 1]) {
        const cap = mesh(gSph(0.088, 10, 8), canvasM, s * 0.15, 0, 0);
        cap.scale.x = 0.55;
        g.add(cap);
      }
      g.add(mesh(gBox(0.088, 0.014, 0.19), M.leather, 0, 0.086, 0));
      g.add(mesh(gBox(0.145, 0.086, 0.020), shadeMesh(canvasM, mat), 0, -0.012, 0.090));
      g.add(mesh(gCyl(0.012, 0.012, 0.05, 6), M.metal, 0.078, 0.052, 0.058));
      g.position.set(0.01, -0.175, 0.01);
      g.rotation.y = 0.22;
      break;
    }
    case 'backpack': {
      const nylon = mat('#3f5d4a', 12);
      g.add(mesh(gBox(0.195, 0.255, 0.115), nylon));
      g.add(mesh(gBox(0.202, 0.088, 0.122), mat('#334c3c', 12), 0, 0.098, 0));
      g.add(mesh(gBox(0.125, 0.098, 0.028), mat('#334c3c', 12), 0, -0.058, 0.070));
      for (const s of [-1, 1]) g.add(mesh(gBox(0.030, 0.235, 0.020), M.dark, s * 0.058, -0.010, -0.066));
      g.add(mesh(gTor(0.028, 0.008, 10, Math.PI), M.dark, 0, 0.140, 0));
      g.position.set(0.01, -0.205, -0.02);
      break;
    }
    case 'toolbox': {
      const steel = mat('#b8403a', 34);
      g.add(mesh(gBox(0.255, 0.115, 0.130), steel));
      g.add(mesh(gBox(0.265, 0.028, 0.138), mat('#8f2f2b', 34), 0, 0.068, 0));
      g.add(mesh(gTor(0.050, 0.010, 12, Math.PI), M.metal, 0, 0.086, 0));
      for (const s of [-1, 1]) g.add(mesh(gBox(0.024, 0.030, 0.014), M.metal, s * 0.088, 0.052, 0.068));
      g.position.set(0.01, -0.165, 0.01);
      break;
    }
    case 'clipboard': {
      g.add(mesh(gBox(0.155, 0.205, 0.010), M.leather));
      g.add(mesh(gBox(0.135, 0.175, 0.005), M.linen, 0, -0.008, 0.008));
      g.add(mesh(gBox(0.068, 0.022, 0.018), M.metal, 0, 0.094, 0.011));
      const pen = mesh(gCyl(0.006, 0.006, 0.11, 6), M.dark, 0.055, 0.020, 0.016);
      pen.rotation.z = 0.42;
      g.add(pen);
      g.position.set(0.015, -0.105, 0.048);
      g.rotation.set(-1.05, 0, 0.18);
      break;
    }
    case 'tray': {
      g.add(mesh(gCyl(0.128, 0.124, 0.013, 18), M.metal));
      const rim = mesh(gTor(0.126, 0.009, 20), M.metal, 0, 0.008, 0);
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      g.add(mesh(gCyl(0.044, 0.038, 0.080, 12), M.plastic, -0.046, 0.047, -0.004));
      const glass = mat('#cfe6ea', 90, { transparent: true, opacity: 0.5 });
      g.add(mesh(gCyl(0.025, 0.021, 0.070, 10), glass, 0.049, 0.043, 0.018));
      g.add(mesh(gBox(0.080, 0.028, 0.056), M.linen, 0.026, 0.021, -0.052));
      g.position.set(0, 0.045, 0.19);   // sits just under the fingertips
      break;
    }
    case 'basket': {
      const tub = mat('#d8dbe0', 20);
      g.add(mesh(gBox(0.30, 0.020, 0.225), tub));
      for (const s of [-1, 1]) {
        g.add(mesh(gBox(0.30, 0.155, 0.020), tub, 0, 0.075, s * 0.112));
        g.add(mesh(gBox(0.020, 0.155, 0.225), tub, s * 0.150, 0.075, 0));
      }
      const pile = mesh(gSph(0.128, 10, 8), M.linen, 0, 0.135, 0);
      pile.scale.set(1.06, 0.52, 0.78);
      g.add(pile);
      g.add(mesh(gBox(0.16, 0.045, 0.13), mat('#cfd8dd', 4), 0.04, 0.175, -0.01));
      g.position.set(0, -0.06, 0.14);   // hips-high, hands on the rim
      g.rotation.x = -0.14;
      break;
    }
    case 'cart': {
      // Chest-high housekeeping cart. It stands on the floor, so it is the one
      // prop mounted on the root's `push` anchor instead of a hand or the chest.
      const frame = M.metal;
      const shelfM = mat('#8d939c', 20);
      const bar = mesh(gCyl(0.016, 0.016, 0.58, 8), frame, 0, 1.00, 0.02);
      bar.rotation.z = Math.PI / 2;
      g.add(bar);
      for (const s of [-1, 1]) {
        g.add(mesh(gCyl(0.015, 0.015, 1.00, 6), frame, s * 0.24, 0.50, 0.05));
        g.add(mesh(gCyl(0.015, 0.015, 0.84, 6), frame, s * 0.24, 0.42, 0.45));
        for (const z of [0.06, 0.44]) {
          const wheel = mesh(gCyl(0.055, 0.055, 0.030, 10), M.dark, s * 0.24, 0.055, z);
          wheel.rotation.z = Math.PI / 2;
          g.add(wheel);
        }
      }
      g.add(mesh(gBox(0.52, 0.028, 0.46), shelfM, 0, 0.22, 0.25));
      g.add(mesh(gBox(0.52, 0.028, 0.46), shelfM, 0, 0.72, 0.25));
      g.add(mesh(gBox(0.46, 0.40, 0.38), M.linen, 0, 0.45, 0.25));
      for (let i = 0; i < 3; i++) {
        g.add(mesh(gBox(0.140, 0.052, 0.165), i === 1 ? M.linen : mat('#dfe3e0', 4),
          -0.16 + i * 0.16, 0.762, 0.24));
      }
      g.add(mesh(gCyl(0.026, 0.026, 0.10, 8), mat('#4f8fa8', 40), 0.20, 0.788, 0.40));
      g.add(mesh(gBox(0.030, 0.035, 0.045), M.dark, 0.20, 0.855, 0.408));
      break;
    }
    default:
      return null;
  }
  return g;
}

// A slightly darker sibling of an existing material, for pockets and panels.
function shadeMesh(src, mat) {
  return mat('#' + src.color.clone().multiplyScalar(0.72).getHexString(), src.shininess);
}

// ------------------------------------------------------------------ animation
// One reusable target buffer — posePerson runs for every person every frame and
// must not allocate.
const T = {
  rootY: 0, rootZ: 0, rootPitch: 0,
  hipsY: 0, hipsPitch: 0, hipsRoll: 0, hipsYaw: 0,
  torsoPitch: 0, torsoRoll: 0, torsoYaw: 0,
  headPitch: 0, headYaw: 0, headRoll: 0,
  aLp: 0, aLr: 0, aLy: 0, aRp: 0, aRr: 0, aRy: 0,
  fL: 0, fR: 0, fLz: 0, fRz: 0,
  lLp: 0, lLr: 0, lRp: 0, lRr: 0,
  sL: 0, sR: 0, fbL: 0, fbR: 0,
};

function resetTargets() {
  T.rootY = 0; T.rootZ = 0; T.rootPitch = 0;
  T.hipsY = 0; T.hipsPitch = 0; T.hipsRoll = 0; T.hipsYaw = 0;
  T.torsoPitch = 0.02; T.torsoRoll = 0; T.torsoYaw = 0;
  T.headPitch = 0; T.headYaw = 0; T.headRoll = 0;
  T.aLp = -0.04; T.aLr = -0.12; T.aLy = 0;
  T.aRp = -0.04; T.aRr = 0.12; T.aRy = 0;
  T.fL = -0.14; T.fR = -0.14; T.fLz = 0; T.fRz = 0;
  T.lLp = 0; T.lLr = -0.025; T.lRp = 0; T.lRr = 0.025;
  T.sL = 0.05; T.sR = 0.05; T.fbL = 0; T.fbR = 0;
}

function toward(o, x, y, z, k) {
  const r = o.rotation;
  r.x += (x - r.x) * k;
  r.y += (y - r.y) * k;
  r.z += (z - r.z) * k;
}

// Legs shared by 'walk' and 'carry'.
function walkLegs(ph, amp) {
  const a = Math.sin(ph);
  T.lRp = -a * 0.62 * amp;
  T.lLp = a * 0.62 * amp;
  T.sR = 0.06 + Math.max(0, -Math.sin(ph - 0.55)) * 1.05 * amp;
  T.sL = 0.06 + Math.max(0, Math.sin(ph - 0.55)) * 1.05 * amp;
  T.fbR = a * 0.20 * amp;
  T.fbL = -a * 0.20 * amp;
  T.hipsY = (Math.abs(Math.cos(ph)) - 0.6) * 0.038 * amp;
  T.hipsRoll = a * 0.06 * amp;
  T.hipsYaw = a * 0.10 * amp;
  T.torsoYaw = -a * 0.13 * amp;
  T.torsoRoll = -a * 0.045 * amp;
  return a;
}

/**
 * Advance one rig. `dt` in seconds, `speed` in units/sec (and reused as an
 * 0..1 impatience value by the 'wait' action). Unknown actions read as 'idle'.
 * 'sit' and 'sleep' expect the caller to have parked the rig at the seat/bed;
 * the body folds or lies down relative to that spot.
 */
export function posePerson(rig, dt, { action = 'idle', speed = 0 } = {}) {
  if (!rig || !rig.j || !rig.userData) return;
  const j = rig.j;
  const ud = rig.userData;

  let d = Number(dt);
  if (!Number.isFinite(d) || d < 0) d = 0;
  if (d > 0.1) d = 0.1;
  let sp = Number(speed);
  if (!Number.isFinite(sp)) sp = 0;

  let ph = ud.phase;
  if (!Number.isFinite(ph)) ph = 0;
  let slow = ud.slow;
  if (!Number.isFinite(slow)) slow = 0;
  const seed = Number.isFinite(ud.seed) ? ud.seed : 0;

  // Pick the cycle rate before advancing, so frequency tracks speed honestly.
  let rate = 1.5;
  if (action === 'walk' || action === 'carry') rate = 3.0 + clamp(sp, 0, 6) * 1.55;
  else if (action === 'clean') rate = 3.4;
  else if (action === 'fix') rate = 3.0;
  else if (action === 'wave') rate = 6.6;
  else if (action === 'wait') rate = 1.8 + clamp(sp, 0, 1) * 3.4;
  else if (action === 'sleep') rate = 0.55;
  // Both accumulators wrap at TAU, so every multiplier applied to them below
  // MUST be a whole number — sin(1.9 * slow) would jump at the wrap and pop the
  // pose. Decorrelate with phase offsets, not with fractional rates.
  ph = (ph + rate * d) % TAU;
  slow = (slow + 0.37 * d) % TAU;
  ud.phase = ph;
  ud.slow = slow;

  const a = Math.sin(ph + seed);
  const sway = Math.sin(slow * 2 + seed);

  resetTargets();

  switch (action) {
    case 'walk':
    case 'carry': {
      // A bellhop standing at a door still uses 'carry'; without this gate the
      // legs keep swinging and they march on the spot for the whole delivery.
      const amp = sp > 0.06 ? clamp(0.45 + clamp(sp, 0, 6) * 0.24, 0.42, 1.15) : 0;
      const w = walkLegs(ph, amp);
      T.torsoPitch = 0.05 + clamp(sp, 0, 6) * 0.020;
      T.headPitch = -T.torsoPitch * 0.55;
      if (ud.propMount === 'push') {
        // Both hands on the cart bar, whether or not the sim called it 'carry'.
        T.aLp = -0.80; T.aRp = -0.80;
        T.aLr = -0.22; T.aRr = 0.22;
        T.fL = -0.24; T.fR = -0.24;
        T.torsoPitch = 0.11;
        T.torsoYaw *= 0.30;
        T.headPitch = 0.04;
      } else if (action === 'carry') {
        T.aLp = -1.05 + w * 0.03; T.aRp = -1.05 - w * 0.03;
        T.aLr = -0.20; T.aRr = 0.20;
        T.fL = -0.72; T.fR = -0.72;
        T.torsoPitch = 0.04;
        T.torsoYaw *= 0.35;
        T.headPitch = 0.06;
      } else {
        T.aRp = w * 0.46 * amp;
        T.aLp = -w * 0.46 * amp;
        T.fR = -0.22 - Math.max(0, w) * 0.45;
        T.fL = -0.22 - Math.max(0, -w) * 0.45;
        if (ud.propMount === 'hand') {
          // A loaded hand does not swing. It hangs, and it leans you sideways.
          T.aRp *= 0.28;
          T.aRr = 0.24;
          T.fR = -0.10;
          T.torsoRoll -= 0.05;
        }
      }
      break;
    }

    case 'clean': {
      const a2 = Math.sin(ph * 2);
      T.torsoPitch = 0.30 + Math.max(0, a) * 0.10;
      T.torsoYaw = a * 0.18;
      T.hipsY = -0.02 - Math.max(0, a) * 0.020;
      T.aRp = -1.28 + a2 * 0.10;
      T.aRy = -a * 0.62;
      T.aRr = 0.42;
      T.fR = -0.55 - Math.max(0, -a) * 0.25;
      T.aLp = -0.30; T.aLr = -0.32; T.fL = -0.58;
      T.headPitch = 0.32; T.headYaw = a * 0.24;
      T.lLp = -0.12; T.lRp = 0.09;
      T.sL = 0.20; T.sR = 0.13;
      T.lLr = -0.10; T.lRr = 0.10;
      break;
    }

    case 'fix': {
      // Squat, elbows on knees, one hand tapping at whatever is broken.
      const tap = Math.sin(ph);
      T.rootY = -0.264;
      T.lLp = -0.88; T.lRp = -0.92;
      T.sL = 1.63; T.sR = 1.67;
      T.lLr = -0.20; T.lRr = 0.20;
      T.hipsPitch = 0.14;
      T.torsoPitch = 0.30;
      T.aRp = -0.95 - Math.max(0, tap) * 0.28;
      T.fR = -0.52 + Math.max(0, tap) * 0.34;
      T.aRr = 0.18;
      T.aLp = -0.78; T.aLr = -0.44; T.fL = -1.05;
      T.headPitch = 0.44;
      T.headYaw = Math.sin(slow * 3 + seed) * 0.10;
      break;
    }

    case 'desk': {
      const g = clamp(Math.max(0, Math.sin(slow * 3 + seed * 3) - 0.82) * 5.5, 0, 1);
      T.torsoPitch = 0.10 + a * 0.012;
      T.aRp = -0.62 - g * 0.58; T.fR = -0.95 + g * 0.34; T.aRr = 0.26; T.aRy = -g * 0.24;
      T.aLp = -0.58; T.fL = -1.00; T.aLr = -0.24;
      T.headPitch = 0.18 - g * 0.24;
      T.headYaw = Math.sin(slow * 2 + seed * 2) * 0.18 + g * 0.12;
      T.torsoYaw = g * 0.14;
      T.hipsRoll = Math.sin(slow + seed) * 0.05;
      T.hipsY = a * 0.004;
      break;
    }

    case 'sit': {
      // Hips drop to seat height, thighs go level, shins drop to the carpet.
      T.rootY = -0.385;
      T.lLp = -1.55; T.lRp = -1.55;
      T.sL = 1.53; T.sR = 1.53;
      T.lLr = -0.09; T.lRr = 0.09;
      T.hipsPitch = 0.03;
      T.torsoPitch = -0.05 + a * 0.012;
      T.aLp = -0.52; T.aRp = -0.52;
      T.aLr = -0.26; T.aRr = 0.26;
      T.fL = -0.58; T.fR = -0.58;
      T.headYaw = Math.sin(slow + seed) * 0.20;
      T.headPitch = 0.06;
      break;
    }

    case 'sleep': {
      // Flat on the back, feet toward +Z, head toward -Z, centred on the rig.
      T.rootPitch = -Math.PI / 2;
      T.rootY = 0.15;
      T.rootZ = 0.85;
      T.lLr = -0.13; T.lRr = 0.15;
      T.lLp = 0.03; T.lRp = 0.01;
      T.sL = 0.07; T.sR = 0.04;
      T.fbL = -0.42; T.fbR = -0.46;   // toes droop, the way real feet do
      T.aLr = -0.30; T.aRr = 0.30;
      T.aLp = -0.10; T.aRp = -0.14;
      T.fL = -0.42; T.fR = -0.46;
      T.torsoPitch = Math.sin(ph) * 0.022;          // breathing
      T.hipsY = Math.sin(ph) * 0.004;
      T.headRoll = 0.14;
      T.headPitch = -0.06;
      break;
    }

    case 'wave': {
      T.aRr = 2.28 + Math.sin(ph) * 0.07;
      T.aRp = -0.34;
      T.fR = -0.30;
      T.fRz = Math.sin(ph) * 0.60;
      T.aLp = -0.06; T.aLr = -0.16; T.fL = -0.20;
      T.torsoRoll = -0.06;
      T.torsoPitch = 0.03;
      T.headYaw = 0.10;
      T.headPitch = -0.05;
      T.headRoll = Math.sin(ph) * 0.05;
      T.hipsY = Math.sin(ph * 2) * 0.005;
      break;
    }

    case 'wait': {
      const imp = clamp(sp, 0, 1);
      const cross = smooth01(imp, 0.22, 0.80);
      const tap = Math.max(0, Math.sin(ph * 2 + seed)) * imp;
      T.hipsRoll = sway * 0.06 * (1 + imp);
      T.torsoRoll = -sway * 0.04;
      T.torsoPitch = 0.02 - imp * 0.05;
      T.hipsY = a * 0.005 - tap * 0.004;
      // Arms fold as the patience drains: elbows bend to horizontal, then the
      // shoulders yaw the forearms across the chest. Right stacks over left.
      const holding = ud.propMount === 'hand';
      T.aLp = -0.14 - cross * 0.06; T.aLr = -0.12 + cross * 0.09;
      T.fL = -0.28 - cross * 1.06; T.aLy = cross * 0.92;
      if (holding) {
        T.aRp = -0.02; T.aRr = 0.20; T.fR = -0.08; T.aRy = 0;
      } else {
        T.aRp = -0.26 - cross * 0.07; T.aRr = 0.12 - cross * 0.09;
        T.fR = -0.30 - cross * 1.12; T.aRy = -cross * 0.95;
      }
      // Foot tap: heel up, toe planted.
      T.lRp = -0.05 * tap;
      T.sR = 0.05 + 0.44 * tap;
      T.fbR = 0.34 * tap;
      T.lLp = 0.02 * imp;
      // Head sweeps the lobby; the twitchy fast component grows with impatience
      // (ph itself already speeds up, so this reads as "antsier", not just wider).
      T.headYaw = (Math.sin(slow * 2 + seed) * 0.26
        + Math.sin(ph + seed * 2) * 0.12 * imp) * (0.45 + imp);
      T.headPitch = 0.03 - imp * 0.10;
      break;
    }

    default: { // 'idle' and anything the sim invents
      T.hipsY = a * 0.006;
      T.torsoPitch = 0.02 + a * 0.018;
      T.hipsRoll = sway * 0.055;
      T.torsoRoll = -sway * 0.035;
      T.headYaw = Math.sin(slow + seed * 2) * 0.22;
      T.headPitch = 0.03 + a * 0.010;
      T.aLp = -0.05 + a * 0.030; T.aRp = -0.05 - a * 0.030;
      T.aLr = -0.12 - sway * 0.03; T.aRr = 0.12 - sway * 0.03;
      T.lLp = sway * 0.05; T.lRp = -sway * 0.05;
      T.sL = 0.05 + Math.max(0, sway) * 0.11;
      T.sR = 0.05 + Math.max(0, -sway) * 0.11;
      break;
    }
  }

  // A miserable guest stands differently. This is most of what mood reads as.
  const slump = Number.isFinite(ud.slump) ? ud.slump : 0;
  if (slump > 0.001 && action !== 'sleep') {
    T.torsoPitch += slump * 0.13;
    T.headPitch += slump * 0.20;
    T.aLp -= slump * 0.07; T.aRp -= slump * 0.07;
    T.aLr -= slump * 0.05; T.aRr += slump * 0.05;
    T.rootY -= slump * 0.012;
  }

  // Frame-rate independent blend toward the targets: switching actions eases
  // instead of popping, and a zero dt freezes the pose exactly where it is.
  const k = d > 0 ? 1 - Math.exp(-d * 20) : 0;
  if (k <= 0) return;

  j.root.position.y += (T.rootY - j.root.position.y) * k;
  j.root.position.z += (T.rootZ - j.root.position.z) * k;
  j.root.rotation.x += (T.rootPitch - j.root.rotation.x) * k;
  j.hips.position.y += (HIP_Y + T.hipsY - j.hips.position.y) * k;
  toward(j.hips, T.hipsPitch, T.hipsYaw, T.hipsRoll, k);
  toward(j.torso, T.torsoPitch, T.torsoYaw, T.torsoRoll, k);
  toward(j.head, T.headPitch, T.headYaw, T.headRoll, k);
  toward(j.armL, T.aLp, T.aLy, T.aLr, k);
  toward(j.armR, T.aRp, T.aRy, T.aRr, k);
  toward(j.foreL, T.fL, 0, T.fLz, k);
  toward(j.foreR, T.fR, 0, T.fRz, k);
  toward(j.legL, T.lLp, 0, T.lLr, k);
  toward(j.legR, T.lRp, 0, T.lRr, k);
  toward(j.shinL, T.sL, 0, 0, k);
  toward(j.shinR, T.sR, 0, 0, k);
  // Ankles cancel the leg chain so soles stay flat on the carpet.
  toward(j.footL, -(T.lLp + T.sL) + T.fbL, 0, 0, k);
  toward(j.footR, -(T.lRp + T.sR) + T.fbR, 0, 0, k);

  if (ud.pip) ud.pip.position.y = PIP_Y + Math.sin(slow * 4 + seed) * 0.006;
}

// ------------------------------------------------------------------ mood
// Twelve steps of red → amber → green. Bucketing keeps setPersonMood from
// touching the material at all on the frames where nothing meaningful changed.
const MOOD_RAMP = [
  '#c4342b', '#cf4629', '#d75e2c', '#dd7531', '#e18c37', '#e3a13f',
  '#dcb349', '#c8b950', '#adba57', '#8fb85e', '#71b466', '#57ac6e',
];

/** mood 0..1 — tints the bead over the head and sets how far the shoulders go. */
export function setPersonMood(rig, mood) {
  if (!rig || !rig.userData) return;
  let m = Number(mood);
  if (!Number.isFinite(m)) m = 0.7;
  m = clamp(m, 0, 1);
  const ud = rig.userData;
  ud.mood = m;
  ud.slump = 1 - smooth01(m, 0.12, 0.68);
  const step = Math.round(m * (MOOD_RAMP.length - 1));
  if (step === ud.moodStep) return;   // no material churn on tiny drifts
  ud.moodStep = step;
  const pip = ud.pip;
  if (!pip) return;
  pip.material.color.set(MOOD_RAMP[step]);
  // Contentment shrinks the bead to nearly nothing; misery makes it a beacon.
  const s = 0.55 + (1 - m) * 0.95;
  pip.scale.setScalar(s);
}

// ------------------------------------------------------------------ teardown
/**
 * Free what this rig owns: its materials (every rig makes its own set, so this
 * can never pull a material out from under another person). Geometries are
 * module-level and shared on purpose, so they are deliberately left alone.
 */
export function disposePerson(rig) {
  if (!rig) return;
  const ud = rig.userData;
  if (ud && Array.isArray(ud.mats)) {
    for (const m of ud.mats) {
      if (!m) continue;
      if (m.map && m.map.dispose) m.map.dispose();
      m.dispose();
    }
    ud.mats.length = 0;
    ud.pip = null;
    ud.disposed = true;
  }
  if (rig.parent) rig.parent.remove(rig);
  rig.clear();
  rig.prop = null;
  rig.j = null;
}
