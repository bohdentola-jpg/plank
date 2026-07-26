// The cast. Every character in Quahog is built from one parametric rig: a
// lathed body, stubby limbs, and the thing that makes the whole show read —
// two big white eyeballs stuck on the front of the head with ink around them.
import * as THREE from 'three';
import { toon, flat, egg, INK, blobShadow, mkCanvas } from './toon.js';

// --------------------------------------------------------------- the roster
// tone: skin. Colours are flat by design — the ink pass does the line work.
export const CHARACTERS = {
  peter: {
    name: 'Peter Griffin', short: 'PETER', tag: 'THE DAD',
    skin: '#f6cfa0', shirt: '#f4f4ee', pants: '#3d8b46', shoes: '#5a3a20',
    body: 'round', head: 'round', scale: 1.0, headScale: 1.18,
    hair: { style: 'fringe', color: '#8a5a2c' }, glasses: 'round',
    chin: 1.0, cleft: true, eyeSize: 0.94, sleeve: 'long',
    voice: 76, speed: 1.0, strength: 1.6, special: 'Bar Brawl shoulder charge',
    bio: 'Slowest on his feet, hardest to stop. Hits things and calls it a plan.',
    car: 'wagon',
  },
  lois: {
    name: 'Lois Griffin', short: 'LOIS', tag: 'THE MOM',
    skin: '#f7d3ac', shirt: '#8fd0c2', pants: '#3f8478', shoes: '#c04a5a',
    body: 'pear', head: 'round', scale: 0.95, headScale: 0.94,
    hair: { style: 'bob', color: '#c8541e' }, glasses: null,
    chin: 0.18, cleft: false, eyeSize: 0.95, lashes: true, lips: '#c0392b', sleeve: 'long',
    voice: 210, speed: 1.12, strength: 1.0, special: 'Piano-teacher slap',
    bio: 'Handles better than anyone in the family, in a car and out of one.',
    car: 'sedan',
  },
  stewie: {
    name: 'Stewie Griffin', short: 'STEWIE', tag: 'THE BABY',
    skin: '#f7d3ac', shirt: '#f2c94c', pants: '#c0392b', shoes: '#6a4326',
    body: 'kid', head: 'football', scale: 0.56, headScale: 1.5,
    hair: { style: 'none', color: '#8a5a2c' }, glasses: null, overalls: true,
    chin: 0.1, cleft: false, eyeSize: 1.0, sleeve: 'long',
    voice: 250, speed: 1.22, strength: 0.6, special: 'Ray gun (knocks everyone flat)',
    bio: 'Small, fast, and armed with something he built in the nursery.',
    car: 'trike',
  },
  brian: {
    name: 'Brian Griffin', short: 'BRIAN', tag: 'THE DOG',
    skin: '#f6f4ee', shirt: null, pants: null, shoes: null,
    body: 'dog', head: 'dog', scale: 0.82, headScale: 1.0,
    hair: { style: 'none' }, glasses: null, collar: '#c0392b',
    chin: 0.2, cleft: false, eyeSize: 0.9, sleeve: 'none',
    voice: 150, speed: 1.3, strength: 0.9, special: 'Sniff out anything hidden',
    bio: 'The fastest Griffin on foot. Also the only one with a library card.',
    car: 'hybrid',
  },
  chris: {
    name: 'Chris Griffin', short: 'CHRIS', tag: 'THE SON',
    skin: '#f6cfa0', shirt: '#f0f0e8', pants: '#3f5f9f', shoes: '#d8d8d0',
    body: 'chubby', head: 'round', scale: 0.88, headScale: 1.0,
    hair: { style: 'bowl', color: '#c8963c' }, glasses: null,
    chin: 0.35, cleft: false, eyeSize: 1.0, sleeve: 'short',
    voice: 120, speed: 1.02, strength: 1.25, special: 'Panicked flail (clears a crowd)',
    bio: 'Built like a fridge, moves like a fridge with something to prove.',
    car: 'van',
  },
  meg: {
    name: 'Meg Griffin', short: 'MEG', tag: 'THE DAUGHTER',
    skin: '#f7d3ac', shirt: '#f4f4ee', pants: '#4a6fae', shoes: '#e0e0da',
    body: 'pear', head: 'round', scale: 0.86, headScale: 0.98,
    hair: { style: 'long', color: '#8a5a2c' }, glasses: 'round', beanie: '#f2a0c0',
    chin: 0.15, cleft: false, eyeSize: 0.9, sleeve: 'long',
    voice: 190, speed: 1.18, strength: 0.85, special: 'Nobody notices Meg (cops lose interest)',
    bio: 'Nimble, ignored, and quietly the best getaway driver in the house.',
    car: 'moped',
  },
};

// Everyone else you bump into. Same rig, different dials.
export const SUPPORTING = {
  quagmire: {
    name: 'Glenn Quagmire', short: 'QUAGMIRE', skin: '#f6cfa0', shirt: '#e8ecef', pants: '#2c3e50',
    shoes: '#2a2a30', body: 'slim', head: 'round', scale: 0.98, headScale: 1.0,
    hair: { style: 'fringe', color: '#3a2a18' }, chin: 1.5, jut: 0.16, eyeSize: 0.95, sleeve: 'short',
  },
  cleveland: {
    name: 'Cleveland Brown', short: 'CLEVELAND', skin: '#7a4a2c', shirt: '#e07a2c', pants: '#4a4a52',
    shoes: '#2a2a30', body: 'chubby', head: 'round', scale: 0.97, headScale: 1.02,
    hair: { style: 'none' }, glasses: null, chin: 0.4, eyeSize: 1.0, sleeve: 'long', droopy: true,
  },
  joe: {
    name: 'Joe Swanson', short: 'JOE', skin: '#f2c99a', shirt: '#2e5a9e', pants: '#2e5a9e',
    shoes: '#1a1a22', body: 'round', head: 'square', scale: 1.0, headScale: 1.0,
    hair: { style: 'flat', color: '#6a4a2a' }, chin: 0.7, eyeSize: 0.95, sleeve: 'long', wheelchair: true,
  },
  bonnie: {
    name: 'Bonnie Swanson', short: 'BONNIE', skin: '#f7d3ac', shirt: '#e8c8dc', pants: '#8a5a8a',
    shoes: '#a04a6a', body: 'pear', head: 'round', scale: 0.92, headScale: 0.94,
    hair: { style: 'bob', color: '#e0c060' }, chin: 0.15, eyeSize: 0.9, lashes: true, lips: '#c0392b', sleeve: 'long',
  },
  mort: {
    name: 'Mort Goldman', short: 'MORT', skin: '#f2c99a', shirt: '#9ab87a', pants: '#5a5a4a',
    shoes: '#3a3a30', body: 'slim', head: 'round', scale: 0.92, headScale: 1.0,
    hair: { style: 'ring', color: '#3a2a18' }, glasses: 'square', chin: 0.2, nose: 1.8, eyeSize: 0.85, sleeve: 'long',
  },
  herbert: {
    name: 'Herbert', short: 'HERBERT', skin: '#f0d8bc', shirt: '#a8c8e0', pants: '#a8c8e0',
    shoes: '#8a7a6a', body: 'slim', head: 'round', scale: 0.9, headScale: 0.98,
    hair: { style: 'ring', color: '#f0f0ee' }, chin: 0.3, eyeSize: 0.8, sleeve: 'long', hunch: 0.3, walker: true,
  },
  west: {
    name: 'Mayor Adam West', short: 'MAYOR WEST', skin: '#f2c99a', shirt: '#39445c', pants: '#39445c',
    shoes: '#1a1a22', body: 'slim', head: 'round', scale: 1.0, headScale: 0.98,
    hair: { style: 'flat', color: '#5a5a5a' }, chin: 0.5, eyeSize: 1.0, sleeve: 'long', tie: '#c0392b',
  },
  tucker: {
    name: 'Tom Tucker', short: 'TOM TUCKER', skin: '#f2c99a', shirt: '#2a3550', pants: '#2a3550',
    shoes: '#1a1a22', body: 'slim', head: 'round', scale: 1.0, headScale: 1.0,
    hair: { style: 'flat', color: '#b8b8bc' }, chin: 1.3, jut: 0.1, eyeSize: 0.95, sleeve: 'long', tie: '#c02a2a',
  },
  consuela: {
    name: 'Consuela', short: 'CONSUELA', skin: '#c88a5a', shirt: '#f0c8d8', pants: '#f0c8d8',
    shoes: '#6a4a3a', body: 'pear', head: 'round', scale: 0.86, headScale: 0.96,
    hair: { style: 'bun', color: '#2a1a12' }, chin: 0.2, eyeSize: 0.9, sleeve: 'short', mop: true,
  },
  carter: {
    name: 'Carter Pewterschmidt', short: 'CARTER', skin: '#f2c99a', shirt: '#4a4a58', pants: '#4a4a58',
    shoes: '#2a2a2a', body: 'chubby', head: 'round', scale: 1.0, headScale: 1.0,
    hair: { style: 'ring', color: '#d8d8dc' }, chin: 0.6, eyeSize: 0.9, sleeve: 'long', tie: '#8a2a3a', stache: '#d8d8dc',
  },
  barbara: {
    name: 'Barbara Pewterschmidt', short: 'BABS', skin: '#f7d3ac', shirt: '#d8c8e8', pants: '#8a7aa8',
    shoes: '#6a5a7a', body: 'pear', head: 'round', scale: 0.93, headScale: 0.94,
    hair: { style: 'bun', color: '#e8e4e0' }, chin: 0.15, eyeSize: 0.88, lashes: true, lips: '#a02a4a', sleeve: 'long',
  },
  seamus: {
    name: 'Seamus', short: 'SEAMUS', skin: '#f0c090', shirt: '#e8d8b8', pants: '#3a4a6a',
    shoes: '#3a2a1a', body: 'slim', head: 'round', scale: 0.94, headScale: 1.0,
    hair: { style: 'flat', color: '#d8a848' }, chin: 0.4, eyeSize: 0.9, sleeve: 'long', beard: '#d8a848', peg: true,
  },
  hartman: {
    name: 'Dr. Hartman', short: 'DR. HARTMAN', skin: '#f2c99a', shirt: '#f4f4f6', pants: '#5a6a7a',
    shoes: '#2a2a30', body: 'slim', head: 'round', scale: 0.98, headScale: 0.98,
    hair: { style: 'flat', color: '#6a4a2a' }, chin: 0.5, eyeSize: 0.9, sleeve: 'long', coat: true,
  },
  jerome: {
    name: 'Jerome', short: 'JEROME', skin: '#5a3a24', shirt: '#c8a83c', pants: '#3a3a48',
    shoes: '#2a2a30', body: 'chubby', head: 'round', scale: 1.02, headScale: 1.0,
    hair: { style: 'flat', color: '#1a1210' }, chin: 0.5, eyeSize: 0.95, sleeve: 'short',
  },
  bruce: {
    name: 'Bruce', short: 'BRUCE', skin: '#f2c99a', shirt: '#e8b8c8', pants: '#7a6a5a',
    shoes: '#5a4a3a', body: 'slim', head: 'round', scale: 0.92, headScale: 0.96,
    hair: { style: 'fringe', color: '#c8a848' }, chin: 0.2, eyeSize: 1.05, sleeve: 'short',
  },
  neil: {
    name: 'Neil Goldman', short: 'NEIL', skin: '#f2c99a', shirt: '#c8b83c', pants: '#7a6a4a',
    shoes: '#5a4a3a', body: 'slim', head: 'round', scale: 0.8, headScale: 1.05,
    hair: { style: 'bowl', color: '#3a2a18' }, glasses: 'square', chin: 0.15, nose: 1.4, eyeSize: 0.9, sleeve: 'short',
  },
  shepherd: {
    name: 'Principal Shepherd', short: 'PRINCIPAL', skin: '#f2c99a', shirt: '#7a6a4a', pants: '#4a4438',
    shoes: '#2a2a2a', body: 'chubby', head: 'round', scale: 0.98, headScale: 0.98,
    hair: { style: 'ring', color: '#5a5a5a' }, glasses: 'square', chin: 0.5, eyeSize: 0.9, sleeve: 'long', tie: '#3a6a4a',
  },
  angela: {
    name: 'Angela', short: 'ANGELA', skin: '#f2c99a', shirt: '#b8a8c8', pants: '#5a4a6a',
    shoes: '#4a3a5a', body: 'pear', head: 'round', scale: 0.9, headScale: 0.96,
    hair: { style: 'bob', color: '#8a6a4a' }, glasses: 'square', chin: 0.2, eyeSize: 0.85, lashes: true, sleeve: 'long',
  },
  chicken: {
    name: 'Ernie the Giant Chicken', short: 'ERNIE', skin: '#f6f2e2', shirt: null, pants: null,
    shoes: null, body: 'chicken', head: 'chicken', scale: 1.9, headScale: 1.0,
    hair: { style: 'none' }, chin: 0, eyeSize: 1.1, sleeve: 'none',
  },
  death: {
    name: 'Death', short: 'DEATH', skin: '#e8e8e0', shirt: '#1a1a22', pants: '#1a1a22',
    shoes: '#1a1a22', body: 'slim', head: 'skull', scale: 1.05, headScale: 1.0,
    hair: { style: 'none' }, chin: 0.2, eyeSize: 1.0, sleeve: 'long', hood: true,
  },
};

export const PLAYABLE = ['peter', 'lois', 'stewie', 'brian', 'chris', 'meg'];

export function charSpec(id) {
  return CHARACTERS[id] || SUPPORTING[id] || CHARACTERS.peter;
}

// ------------------------------------------------------------------ the rig
const BODIES = {
  //          hip   waist  chest  shoulder   height of torso
  round:    { hip: 0.30, waist: 0.40, chest: 0.36, shoulder: 0.30, torso: 0.52, legs: 0.46, arm: 0.44 },
  chubby:   { hip: 0.26, waist: 0.31, chest: 0.31, shoulder: 0.27, torso: 0.52, legs: 0.52, arm: 0.46 },
  pear:     { hip: 0.24, waist: 0.17, chest: 0.22, shoulder: 0.19, torso: 0.54, legs: 0.56, arm: 0.44 },
  slim:     { hip: 0.19, waist: 0.19, chest: 0.23, shoulder: 0.21, torso: 0.56, legs: 0.58, arm: 0.48 },
  kid:      { hip: 0.21, waist: 0.22, chest: 0.21, shoulder: 0.18, torso: 0.34, legs: 0.26, arm: 0.26 },
  dog:      { hip: 0.16, waist: 0.18, chest: 0.22, shoulder: 0.19, torso: 0.44, legs: 0.42, arm: 0.40 },
  chicken:  { hip: 0.24, waist: 0.30, chest: 0.34, shoulder: 0.26, torso: 0.60, legs: 0.62, arm: 0.50 },
};

function latheBody(profile, mat, seg = 14) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(0.008, r), y));
  const g = new THREE.LatheGeometry(pts, seg);
  return new THREE.Mesh(g, mat);
}

/** The eyes are the whole game. Two spheres on the front of the face with
 *  pupils, lids that blink, and brows that do the acting. */
function buildEye(side, r, skinMat) {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), flat('#ffffff'));
  g.add(white);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 10, 8), flat('#16161c'));
  pupil.position.set(0, -r * 0.04, r * 0.82);
  pupil.scale.z = 0.55;
  g.add(pupil);
  // lid: a cap of skin parked above the eye that swings down to blink
  const lid = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.03, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    skinMat
  );
  lid.rotation.x = -1.0;
  g.add(lid);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.22, r * 0.3), flat(INK));
  brow.position.set(0, r * 1.0, r * 0.5);
  brow.rotation.z = side * -0.12;
  g.add(brow);
  return { group: g, pupil, lid, brow, r };
}

/** Hair sits on the back and crown only. The eyes bulge off the front of the
 *  face, so anything draped over the forehead would swallow them whole. */
function buildHair(style, color, headR) {
  const m = toon(color || '#8a5a2c');
  const g = new THREE.Group();
  if (!style || style === 'none') return g;
  const R = headR;
  // crown: a shallow cap, kept above the brow line
  const crown = (theta = 0.32, r = 1.03, z = -0.04) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * r, 16, 10, 0, Math.PI * 2, 0, Math.PI * theta), m);
    cap.position.set(0, R * 0.02, R * z);
    g.add(cap);
    return cap;
  };
  // back mass: hidden from the front, gives the silhouette its shape
  const backMass = (ry = 0.9, rz = 0.75, y = -0.05, z = -0.5, rx = 0.95) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(R * 0.82, 14, 10), m);
    b.scale.set(rx, ry, rz);
    b.position.set(0, R * y, R * z);
    g.add(b);
    return b;
  };
  const sideLocks = (len = 1.0, drop = -0.3, x = 0.94) => {
    for (const s of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.SphereGeometry(R * 0.30, 10, 8), m);
      lock.scale.set(0.62, len, 0.9);
      lock.position.set(s * R * x, R * drop, -R * 0.14);
      g.add(lock);
    }
  };

  if (style === 'flat') {
    crown(0.30, 1.02, -0.06);
    backMass(0.7, 0.6, -0.02, -0.42);
  } else if (style === 'fringe') {
    crown(0.31, 1.03, -0.04);
    backMass(0.8, 0.66, -0.02, -0.44);
    // the little tuft over the forehead, sat high enough to clear the brows
    const f = new THREE.Mesh(new THREE.SphereGeometry(R * 0.30, 10, 8), m);
    f.scale.set(1.7, 0.42, 0.8);
    f.position.set(0, R * 0.74, R * 0.44);
    g.add(f);
  } else if (style === 'bob') {
    crown(0.33, 1.04, -0.05);
    backMass(1.05, 0.9, -0.18, -0.46, 1.05);
    sideLocks(1.5, -0.42, 0.96);
  } else if (style === 'long') {
    crown(0.31, 1.03, -0.05);
    backMass(1.25, 0.85, -0.35, -0.48, 1.0);
    sideLocks(2.0, -0.72, 0.92);
  } else if (style === 'bowl') {
    crown(0.34, 1.05, -0.02);
    backMass(0.85, 0.75, -0.08, -0.42);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, R * 0.10, 6, 18), m);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, R * 0.52, -R * 0.06);
    rim.scale.z = 1.04;
    g.add(rim);
  } else if (style === 'ring') {
    // the horseshoe: bare on top, hair around the back and sides
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.92, R * 0.14, 6, 18, Math.PI * 1.35), m);
    rim.rotation.set(Math.PI / 2, 0, -Math.PI * 0.18);
    rim.position.set(0, R * 0.16, 0);
    rim.scale.z = 1.08;
    g.add(rim);
  } else if (style === 'bun') {
    crown(0.32, 1.03, -0.05);
    backMass(0.8, 0.62, -0.02, -0.44);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(R * 0.36, 10, 8), m);
    bun.position.set(0, R * 0.56, -R * 0.92);
    g.add(bun);
  } else if (style === 'spiky') {
    crown(0.30, 1.02, -0.05);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(R * 0.14, R * 0.4, 6), m);
      const a = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(a) * R * 0.5, R * 0.9, Math.sin(a) * R * 0.5 - R * 0.1);
      spike.rotation.z = Math.cos(a) * 0.4;
      spike.rotation.x = -Math.sin(a) * 0.4;
      g.add(spike);
    }
  }
  return g;
}

/** Build one character. Returns a rig with named joints the animator poses. */
export function buildCharacter(spec, { lod = 1 } = {}) {
  const S = spec.scale ?? 1;
  const B = BODIES[spec.body] || BODIES.slim;
  const seg = lod > 0.5 ? 14 : 8;
  const skinMat = toon(spec.skin);
  const shirtMat = toon(spec.shirt || spec.skin);
  const pantsMat = toon(spec.pants || spec.shirt || spec.skin);
  const shoeMat = toon(spec.shoes || '#3a2a20');

  const root = new THREE.Group();
  const body = new THREE.Group();       // whole-body bob / lean
  root.add(body);

  const hipY = B.legs;
  const hips = new THREE.Group();
  hips.position.y = hipY;
  body.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // ---- torso: one lathe from hip to shoulder in the shirt colour
  const t = B.torso;
  const shirtProfile = [
    [0, B.hip * 0.98], [t * 0.16, B.waist * 1.02], [t * 0.42, B.chest * 1.04],
    [t * 0.72, B.chest * 0.98], [t * 0.9, B.shoulder], [t, B.shoulder * 0.62],
  ];
  const shirt = latheBody(shirtProfile, shirtMat, seg);
  shirt.scale.z = spec.body === 'round' ? 0.94 : 0.86;
  torso.add(shirt);

  // hips/shorts cap so the legs read as trousers
  const pelvis = latheBody([[-0.14, B.hip * 0.86], [-0.04, B.hip * 1.0], [0.1, B.hip * 0.98]], pantsMat, seg);
  pelvis.scale.z = 0.88;
  hips.add(pelvis);

  if (spec.overalls) {
    const bib = new THREE.Mesh(new THREE.BoxGeometry(B.chest * 1.1, t * 0.42, 0.06), pantsMat);
    bib.position.set(0, t * 0.34, B.chest * 0.80);
    torso.add(bib);
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, t * 0.5, 0.05), pantsMat);
      strap.position.set(s * B.chest * 0.36, t * 0.62, B.chest * 0.68);
      strap.rotation.x = -0.12;
      torso.add(strap);
    }
  }
  if (spec.coat) {
    const coat = latheBody([[-0.16, B.hip * 1.1], [t * 0.5, B.chest * 1.12], [t * 0.92, B.shoulder * 1.05]], toon('#f4f4f6'), seg);
    coat.scale.z = 0.9;
    torso.add(coat);
  }
  if (spec.tie) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, t * 0.46, 0.03), toon(spec.tie));
    tie.position.set(0, t * 0.52, B.chest * 0.86);
    torso.add(tie);
  }
  if (spec.hood) {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(spec.shirt));
    hood.position.y = t + 0.22;
    torso.add(hood);
  }

  // ---- head
  const neck = new THREE.Group();
  neck.position.y = t + 0.03;
  torso.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.09, 10), skinMat);
  neckMesh.position.y = 0.03;
  neck.add(neckMesh);

  const head = new THREE.Group();
  const headR = 0.30 * (spec.headScale ?? 1);
  head.position.y = 0.06 + headR * 0.86;
  neck.add(head);

  let skull;
  if (spec.head === 'football') {
    // an American football stood on end and tipped back — that is the whole gag
    skull = new THREE.Mesh(egg(headR, 1.30, 0.92, seg + 2), skinMat);
    skull.rotation.x = -0.26;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.46, headR * 0.62, 12), skinMat);
    tip.position.set(0, headR * 1.16, -headR * 0.34);
    tip.rotation.x = -0.45;
    head.add(tip);
  } else if (spec.head === 'square') {
    skull = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.7, headR * 1.9, headR * 1.6), skinMat);
  } else if (spec.head === 'dog') {
    skull = new THREE.Mesh(egg(headR, 0.92, 1.0, seg), skinMat);
  } else if (spec.head === 'chicken') {
    skull = new THREE.Mesh(egg(headR * 0.9, 1.0, 1.1, seg), skinMat);
  } else if (spec.head === 'skull') {
    skull = new THREE.Mesh(egg(headR * 0.92, 1.1, 1.0, seg), flat('#efeee6'));
  } else {
    skull = new THREE.Mesh(egg(headR, 1.0, 0.98, seg), skinMat);
  }
  head.add(skull);

  // jaw / chin — Peter's is a whole second head, Quagmire's leaves the county
  const chinAmt = spec.chin ?? 0.3;
  let chinMesh = null;
  if (chinAmt > 0.05 && spec.head !== 'chicken') {
    chinMesh = new THREE.Mesh(egg(headR * (0.40 + chinAmt * 0.20), 0.80, 0.94, seg), skinMat);
    chinMesh.scale.x *= 1 + chinAmt * 0.34;
    chinMesh.position.set(0, -headR * (0.58 + chinAmt * 0.14), headR * (0.28 + (spec.jut || 0) * 2.2));
    head.add(chinMesh);
    if (spec.cleft) {
      const cleft = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.026, headR * 0.026, headR * 0.20, 6), flat(INK));
      cleft.position.set(0, -headR * 0.90, headR * (0.62 + (spec.jut || 0) * 2.2));
      head.add(cleft);
    }
  }

  // ---- the eyes
  const eyeR = headR * 0.365 * (spec.eyeSize ?? 1);
  const gap = eyeR * 0.96;
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = buildEye(s, eyeR, skinMat);
    const fwd = spec.head === 'dog' ? headR * 0.46 : headR * 0.56;
    e.group.position.set(s * gap, headR * 0.16, fwd);
    head.add(e.group);
    eyes.push(e);
  }
  if (spec.lashes) {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(eyeR * 0.09, eyeR * 0.34, eyeR * 0.09), flat(INK));
        l.position.set(s * gap + (i - 1) * eyeR * 0.42, headR * 0.16 + eyeR * 0.96, headR * 0.56 + eyeR * 0.5);
        l.rotation.z = (i - 1) * 0.35 * s;
        head.add(l);
      }
    }
  }

  // ---- nose + snout
  if (spec.head === 'dog') {
    const snout = new THREE.Mesh(egg(headR * 0.36, 0.72, 1.5, seg), skinMat);
    snout.position.set(0, -headR * 0.12, headR * 0.82);
    head.add(snout);
    const nose = new THREE.Mesh(egg(headR * 0.16, 0.8, 0.9, 10), flat('#22222a'));
    nose.position.set(0, -headR * 0.04, headR * 1.32);
    head.add(nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(egg(headR * 0.24, 1.5, 0.4, 10), skinMat);
      ear.position.set(s * headR * 0.88, headR * 0.1, -headR * 0.1);
      ear.rotation.z = s * 0.4;
      head.add(ear);
    }
  } else if (spec.head === 'chicken') {
    const beakTop = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.3, headR * 0.7, 6), toon('#f2b705'));
    beakTop.rotation.x = Math.PI / 2;
    beakTop.position.set(0, -headR * 0.05, headR * 1.0);
    head.add(beakTop);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.14, headR * 0.34, headR * 0.9), toon('#c0392b'));
    comb.position.set(0, headR * 1.02, 0);
    head.add(comb);
  } else if (spec.head !== 'skull') {
    const nose = new THREE.Mesh(egg(headR * 0.13 * (spec.nose || 1), 0.9, 1.3 * (spec.nose || 1), 10), skinMat);
    nose.position.set(0, -headR * 0.06, headR * 0.94);
    head.add(nose);
  }
  if (spec.stache) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.62, headR * 0.11, headR * 0.14), toon(spec.stache));
    st.position.set(0, -headR * 0.3, headR * 0.92);
    head.add(st);
  }
  if (spec.beard) {
    const bd = new THREE.Mesh(egg(headR * 0.5, 0.9, 0.7, 10), toon(spec.beard));
    bd.position.set(0, -headR * 0.62, headR * 0.42);
    head.add(bd);
  }

  // ---- mouth (drives every line of dialogue)
  const mouth = new THREE.Group();
  mouth.position.set(0, -headR * (0.40 + chinAmt * 0.14), headR * (0.80 + chinAmt * 0.16 + (spec.jut || 0) * 1.8));
  head.add(mouth);
  const mouthMesh = new THREE.Mesh(egg(headR * 0.22, 0.55, 0.4, 10), flat(spec.lips || '#8c3a3a'));
  mouth.add(mouthMesh);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.3, headR * 0.05, headR * 0.06), flat('#fbfbf6'));
  teeth.position.y = headR * 0.06;
  mouth.add(teeth);
  mouth.scale.y = 0.35;

  // ---- glasses / hats
  if (spec.glasses) {
    const frame = flat(INK);
    const gz = headR * 0.56 + eyeR * 0.94;
    for (const s of [-1, 1]) {
      const ring = spec.glasses === 'square'
        ? new THREE.Mesh(new THREE.TorusGeometry(eyeR * 1.3, eyeR * 0.11, 4, 4), frame)
        : new THREE.Mesh(new THREE.TorusGeometry(eyeR * 1.28, eyeR * 0.11, 6, 18), frame);
      ring.position.set(s * gap, headR * 0.16, gz);
      if (spec.glasses === 'square') ring.rotation.z = Math.PI / 4;
      head.add(ring);
      // temple arm running back to the ear
      const arm = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.5, eyeR * 0.1, eyeR * 0.1), frame);
      arm.position.set(s * (gap + eyeR * 1.1), headR * 0.2, gz - headR * 0.34);
      arm.rotation.y = s * 0.7;
      head.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(gap * 0.8, eyeR * 0.12, eyeR * 0.1), frame);
    bridge.position.set(0, headR * 0.16, gz);
    head.add(bridge);
  }
  const hair = buildHair(spec.hair?.style, spec.hair?.color, headR);
  head.add(hair);
  if (spec.beanie) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.09, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(spec.beanie));
    cap.position.y = headR * 0.1;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(headR * 1.05, headR * 0.11, 6, 18), toon(spec.beanie));
    brim.rotation.x = Math.PI / 2;
    brim.position.y = headR * 0.36;
    head.add(brim);
  }
  if (spec.collar) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.032, 6, 14), toon(spec.collar));
    c.rotation.x = Math.PI / 2;
    c.position.y = t + 0.02;
    torso.add(c);
    const tag = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), flat('#f2c94c'));
    tag.position.set(0, t - 0.04, 0.13);
    torso.add(tag);
  }

  // ---- arms
  const arms = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const sh = new THREE.Group();
    sh.position.set(s * (Math.max(B.shoulder, B.chest * 0.92) + 0.055), t * 0.86, 0);
    torso.add(sh);
    const sleeveLen = spec.sleeve === 'short' ? B.arm * 0.32 : spec.sleeve === 'none' ? 0 : B.arm * 0.52;
    const upperMat = spec.sleeve === 'none' ? skinMat : shirtMat;
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, B.arm * 0.46, 4, seg > 10 ? 10 : 6), upperMat);
    upper.position.y = -B.arm * 0.28;
    sh.add(upper);
    if (sleeveLen > 0 && spec.sleeve === 'short') {
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.078, 0.05, 10), shirtMat);
      cuff.position.y = -sleeveLen;
      sh.add(cuff);
    }
    const el = new THREE.Group();
    el.position.y = -B.arm * 0.52;
    sh.add(el);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, B.arm * 0.36, 4, seg > 10 ? 10 : 6), spec.sleeve === 'long' ? shirtMat : skinMat);
    fore.position.y = -B.arm * 0.22;
    el.add(fore);
    const hand = new THREE.Mesh(egg(0.085, 0.9, 0.8, 10), skinMat);
    hand.position.y = -B.arm * 0.46;
    el.add(hand);
    const grip = new THREE.Group();
    grip.position.y = -B.arm * 0.52;
    el.add(grip);
    arms['sh' + side] = sh;
    arms['el' + side] = el;
    arms['grip' + side] = grip;
  }

  // ---- legs
  const legs = {};
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const hip = new THREE.Group();
    hip.position.set(s * B.hip * 0.52, -0.06, 0);
    hips.add(hip);
    const isPeg = spec.peg && s === -1;
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(isPeg ? 0.04 : 0.092, B.legs * 0.4, 4, seg > 10 ? 10 : 6), isPeg ? toon('#8a6a4a') : pantsMat);
    thigh.position.y = -B.legs * 0.24;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -B.legs * 0.46;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(isPeg ? 0.035 : 0.082, B.legs * 0.3, 4, seg > 10 ? 10 : 6), isPeg ? toon('#8a6a4a') : pantsMat);
    shin.position.y = -B.legs * 0.2;
    knee.add(shin);
    const ankle = new THREE.Group();
    ankle.position.y = -B.legs * 0.42;
    knee.add(ankle);
    if (!isPeg) {
      const shoe = new THREE.Mesh(egg(0.11, 0.62, 1.5, 10), shoeMat);
      shoe.position.set(0, -0.04, 0.05);
      ankle.add(shoe);
    }
    legs['hip' + side] = hip;
    legs['knee' + side] = knee;
    legs['ankle' + side] = ankle;
  }

  // ---- odds and ends
  const extras = {};
  if (spec.wheelchair) {
    const chair = new THREE.Group();
    const frameMat = toon('#3a3a44');
    for (const s of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.035, 6, 20), frameMat);
      wheel.position.set(s * 0.34, 0.30, -0.02);
      chair.add(wheel);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.58, 0.02), frameMat);
        spoke.position.set(s * 0.34, 0.30, -0.02);
        spoke.rotation.z = (i / 4) * Math.PI;
        chair.add(spoke);
      }
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.5), toon('#22222a'));
    seat.position.y = 0.44;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.06), toon('#22222a'));
    back.position.set(0, 0.68, -0.24);
    chair.add(back);
    root.add(chair);
    extras.chair = chair;
    body.position.y = 0.06;
  }
  if (spec.walker) {
    const w = new THREE.Group();
    const m = toon('#c8c8cc');
    for (const s of [-1, 1]) {
      for (const z of [-0.14, 0.16]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), m);
        leg.position.set(s * 0.26, 0.4, z);
        w.add(leg);
      }
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.04), m);
    bar.position.set(0, 0.8, 0.16);
    w.add(bar);
    w.position.z = 0.34;
    root.add(w);
    extras.walker = w;
  }
  if (spec.mop) {
    const mop = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), toon('#a8763c'));
    mop.add(stick);
    const head2 = new THREE.Mesh(egg(0.12, 0.7, 0.8, 8), toon('#e8e4d0'));
    head2.position.y = -0.56;
    mop.add(head2);
    mop.position.set(0.3, 0.6, 0.2);
    mop.rotation.z = 0.3;
    root.add(mop);
    extras.mop = mop;
  }
  if (spec.body === 'chicken') {
    // wings + tail feathers for Ernie
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(egg(0.3, 1.4, 0.5, 10), skinMat);
      wing.position.set(s * (B.shoulder + 0.2), t * 0.55, -0.05);
      wing.rotation.z = s * 0.3;
      torso.add(wing);
    }
    const tail = new THREE.Mesh(egg(0.3, 0.8, 0.5, 10), skinMat);
    tail.position.set(0, t * 0.3, -B.chest * 1.4);
    tail.rotation.x = 0.6;
    torso.add(tail);
  }

  root.scale.setScalar(S);
  const shadow = blobShadow(Math.max(0.34, B.chest * 1.5), 0.3);
  root.add(shadow);

  const rig = {
    group: root, spec, eyes, extras, shadow,
    height: (hipY + t + 0.3 + headR) * S,
    j: {
      body, hips, torso, neck, head,
      shL: arms.shL, shR: arms.shR, elL: arms.elL, elR: arms.elR,
      gripL: arms.gripL, gripR: arms.gripR,
      hipL: legs.hipL, hipR: legs.hipR, kneeL: legs.kneeL, kneeR: legs.kneeR,
      ankleL: legs.ankleL, ankleR: legs.ankleR,
    },
    mouth, mouthMesh,
    _blink: Math.random() * 4,
    _talk: 0,
  };
  return rig;
}

/**
 * A background Quahogite at a fraction of the cost: fourteen meshes, the same
 * joint names, so the animator cannot tell the difference. The town needs
 * dozens of these on screen at once.
 */
export function buildSimplePed(spec) {
  const S = spec.scale ?? 1;
  const B = BODIES[spec.body] || BODIES.slim;
  const skinMat = toon(spec.skin);
  const shirtMat = toon(spec.shirt || spec.skin);
  const pantsMat = toon(spec.pants || '#3a3a48');

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = B.legs;
  body.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);

  const t = B.torso;
  const shirt = latheBody([
    [0, B.hip * 0.98], [t * 0.4, B.chest * 1.04], [t * 0.86, B.shoulder], [t, B.shoulder * 0.6],
  ], shirtMat, 9);
  shirt.scale.z = 0.88;
  torso.add(shirt);
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(B.hip * 0.98, B.hip * 0.86, 0.22, 9), pantsMat);
  pelvis.position.y = -0.04;
  hips.add(pelvis);

  const neck = new THREE.Group();
  neck.position.y = t + 0.03;
  torso.add(neck);
  const head = new THREE.Group();
  const headR = 0.30 * (spec.headScale ?? 1);
  head.position.y = 0.06 + headR * 0.86;
  neck.add(head);
  head.add(new THREE.Mesh(egg(headR, 1.0, 0.98, 10), skinMat));
  const eyeR = headR * 0.36 * (spec.eyeSize ?? 1);
  const eyes = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(eyeR, 8, 6), flat('#ffffff')));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.36, 6, 5), flat('#16161c'));
    pupil.position.set(0, -eyeR * 0.04, eyeR * 0.8);
    g.add(pupil);
    g.position.set(s * eyeR * 0.96, headR * 0.16, headR * 0.56);
    head.add(g);
    eyes.push({ group: g, pupil, lid: { rotation: { x: 0 } }, r: eyeR });
  }
  if (spec.hair?.style && spec.hair.style !== 'none') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.03, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.32), toon(spec.hair.color));
    cap.position.set(0, headR * 0.02, -headR * 0.05);
    head.add(cap);
    const back = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.7, 8, 6), toon(spec.hair.color));
    back.position.set(0, -headR * 0.04, -headR * 0.42);
    head.add(back);
  }
  const mouth = new THREE.Group();
  mouth.position.set(0, -headR * 0.42, headR * 0.86);
  mouth.scale.y = 0.32;
  head.add(mouth);
  mouth.add(new THREE.Mesh(egg(headR * 0.2, 0.55, 0.4, 7), flat('#8c3a3a')));

  const j = { body, hips, torso, neck, head };
  for (const s of [-1, 1]) {
    const side = s === 1 ? 'R' : 'L';
    const sh = new THREE.Group();
    sh.position.set(s * (Math.max(B.shoulder, B.chest * 0.92) + 0.05), t * 0.86, 0);
    torso.add(sh);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, B.arm * 0.8, 3, 7), spec.sleeve === 'short' ? skinMat : shirtMat);
    arm.position.y = -B.arm * 0.48;
    sh.add(arm);
    const hip = new THREE.Group();
    hip.position.set(s * B.hip * 0.52, -0.06, 0);
    hips.add(hip);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, B.legs * 0.72, 3, 7), pantsMat);
    leg.position.y = -B.legs * 0.44;
    hip.add(leg);
    j['sh' + side] = sh;
    j['hip' + side] = hip;
    j['el' + side] = new THREE.Group();
    j['knee' + side] = new THREE.Group();
    j['ankle' + side] = new THREE.Group();
    j['grip' + side] = new THREE.Group();
    sh.add(j['el' + side]);
    hip.add(j['knee' + side]);
  }
  root.scale.setScalar(S);
  const shadow = blobShadow(0.42, 0.26);
  root.add(shadow);
  return {
    group: root, spec, eyes, extras: {}, shadow,
    height: (B.legs + t + 0.3 + headR) * S,
    j, mouth, simple: true, _blink: 9, _talk: 0,
  };
}

// --------------------------------------------------------------- the acting
const CLIPS = {
  idle:  { armSwing: 0.05, legSwing: 0.0, bob: 0.012, rate: 1.4, lean: 0 },
  walk:  { armSwing: 0.55, legSwing: 0.62, bob: 0.05, rate: 7.2, lean: 0.06 },
  run:   { armSwing: 0.95, legSwing: 1.05, bob: 0.09, rate: 10.5, lean: 0.22 },
  sit:   { armSwing: 0, legSwing: 0, bob: 0.004, rate: 1.0, lean: 0.1 },
  talk:  { armSwing: 0.16, legSwing: 0, bob: 0.02, rate: 2.6, lean: 0 },
  cheer: { armSwing: 0, legSwing: 0, bob: 0.14, rate: 6.0, lean: -0.1 },
  hit:   { armSwing: 0, legSwing: 0, bob: 0, rate: 1, lean: 0.5 },
  fall:  { armSwing: 0, legSwing: 0, bob: 0, rate: 1, lean: 0 },
};

/** Pose a rig. Everything is procedural — the clips are eight numbers each. */
export function poseRig(rig, clip, t, opts = {}) {
  const c = CLIPS[clip] || CLIPS.idle;
  const j = rig.j;
  const p = t * c.rate;
  const sw = Math.sin(p);
  const swc = Math.cos(p * 2);
  const amp = opts.amp ?? 1;

  j.body.position.y = c.bob * swc * amp + (opts.yOffset || 0);
  j.body.rotation.x = c.lean * amp;
  j.body.rotation.z = clip === 'walk' || clip === 'run' ? Math.sin(p) * 0.03 * amp : 0;

  if (clip === 'sit') {
    j.hipL.rotation.x = -1.45; j.hipR.rotation.x = -1.45;
    j.kneeL.rotation.x = 1.35; j.kneeR.rotation.x = 1.35;
    j.shL.rotation.x = -0.85; j.shR.rotation.x = -0.85;
    j.shL.rotation.z = 0.28; j.shR.rotation.z = -0.28;
    j.elL.rotation.x = -0.55; j.elR.rotation.x = -0.55;
    j.torso.rotation.x = 0.05;
  } else if (clip === 'cheer') {
    j.shL.rotation.x = -2.5 + sw * 0.2; j.shR.rotation.x = -2.5 - sw * 0.2;
    j.shL.rotation.z = 0.5; j.shR.rotation.z = -0.5;
    j.elL.rotation.x = -0.4; j.elR.rotation.x = -0.4;
    j.hipL.rotation.x = 0; j.hipR.rotation.x = 0;
    j.kneeL.rotation.x = 0; j.kneeR.rotation.x = 0;
  } else if (clip === 'hit') {
    j.torso.rotation.x = -0.5;
    j.shL.rotation.x = -1.9; j.shR.rotation.x = -1.9;
    j.shL.rotation.z = 0.9; j.shR.rotation.z = -0.9;
    j.hipL.rotation.x = 0.4; j.hipR.rotation.x = -0.2;
    j.kneeL.rotation.x = 0.3; j.kneeR.rotation.x = 0.5;
  } else if (clip === 'fall') {
    j.body.rotation.x = -1.5;
    j.body.position.y = -0.35;
    j.shL.rotation.x = -1.4; j.shR.rotation.x = -1.4;
    j.hipL.rotation.x = 0.6; j.hipR.rotation.x = 0.4;
    j.kneeL.rotation.x = 0.8; j.kneeR.rotation.x = 0.6;
  } else {
    j.shL.rotation.x = sw * c.armSwing * amp;
    j.shR.rotation.x = -sw * c.armSwing * amp;
    j.shL.rotation.z = 0.14 + (clip === 'run' ? 0.1 : 0);
    j.shR.rotation.z = -0.14 - (clip === 'run' ? 0.1 : 0);
    j.elL.rotation.x = -Math.max(0, sw) * c.armSwing * 0.7 - (clip === 'run' ? 0.9 : 0.15);
    j.elR.rotation.x = -Math.max(0, -sw) * c.armSwing * 0.7 - (clip === 'run' ? 0.9 : 0.15);
    j.hipL.rotation.x = -sw * c.legSwing * amp;
    j.hipR.rotation.x = sw * c.legSwing * amp;
    j.kneeL.rotation.x = Math.max(0, sw) * c.legSwing * 0.9;
    j.kneeR.rotation.x = Math.max(0, -sw) * c.legSwing * 0.9;
    j.torso.rotation.x = 0;
  }

  // head life: a little sway, and it turns toward whatever matters
  const look = opts.lookYaw || 0;
  j.head.rotation.y = THREE.MathUtils.clamp(look, -0.9, 0.9);
  j.head.rotation.x = (opts.lookPitch || 0) + Math.sin(p * 0.5) * 0.02;
  j.head.rotation.z = clip === 'walk' ? Math.sin(p) * 0.025 : 0;

  // blink
  rig._blink -= opts.dt || 0.016;
  if (rig._blink < 0) rig._blink = 2.2 + Math.random() * 3.4;
  if (!rig.simple) {
    const blinking = rig._blink < 0.13;
    for (const e of rig.eyes) {
      e.lid.rotation.x = blinking ? 1.5 : -1.0 + (opts.squint || 0);
    }
  }

  // mouth: talking is a fast open/close with a little randomness
  if (rig._talk > 0) {
    rig._talk -= opts.dt || 0.016;
    const o = 0.3 + Math.abs(Math.sin(t * 19)) * 0.85 + Math.sin(t * 31) * 0.12;
    rig.mouth.scale.set(0.85 + o * 0.2, Math.max(0.2, o), 1);
  } else {
    rig.mouth.scale.set(1, 0.32, 1);
  }
}

export function talk(rig, seconds = 1.2) {
  if (rig) rig._talk = seconds;
}

// ------------------------------------------------------------------ extras
/** Random background Quahogite. Cheap rig, loud shirt. */
const PED_SKINS = ['#f6cfa0', '#f7d3ac', '#e0b088', '#c88a5a', '#8a5a34', '#5a3a24'];
const PED_SHIRTS = ['#c0392b', '#2e86c1', '#f2b705', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#7f8c8d', '#2c3e50', '#e8b8c8', '#3f5f9f'];
const PED_PANTS = ['#34495e', '#4a6fae', '#5a4a3a', '#2c3e50', '#7a6a5a', '#3a3a48'];
const PED_HAIR = ['#2a1a12', '#8a5a2c', '#c8541e', '#d8c060', '#4a4a4a', '#e8e8e8'];
const PED_BODY = ['slim', 'chubby', 'pear', 'round'];
const PED_HAIRSTYLE = ['fringe', 'bob', 'flat', 'bowl', 'ring', 'bun', 'long'];

export function randomPedSpec(rand = Math.random) {
  const pick = (a) => a[(rand() * a.length) | 0];
  return {
    name: 'Quahogite', short: 'LOCAL',
    skin: pick(PED_SKINS), shirt: pick(PED_SHIRTS), pants: pick(PED_PANTS), shoes: '#3a2a20',
    body: pick(PED_BODY), head: 'round',
    scale: 0.86 + rand() * 0.22, headScale: 0.92 + rand() * 0.16,
    hair: { style: pick(PED_HAIRSTYLE), color: pick(PED_HAIR) },
    glasses: rand() < 0.22 ? (rand() < 0.5 ? 'round' : 'square') : null,
    chin: rand() * 0.5, eyeSize: 0.85 + rand() * 0.25,
    lashes: rand() < 0.3, sleeve: rand() < 0.5 ? 'short' : 'long',
  };
}

// ------------------------------------------------------- 2D face for the HUD
/** The same face, drawn flat — used for portraits in dialogue and the HUD. */
export function portrait(spec, size = 120) {
  const cv = mkCanvas(size, size);
  const ctx = cv.getContext('2d');
  const cx = size / 2, cy = size * 0.54, R = size * 0.34;
  const ink = INK;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.strokeStyle = ink;

  // background disc
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#9fd6f5');
  g.addColorStop(1, '#4a9bdc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const skin = spec.skin || '#f6cfa0';
  const drawHead = () => {
    ctx.fillStyle = skin;
    ctx.beginPath();
    if (spec.head === 'football') ctx.ellipse(cx, cy, R * 0.86, R * 1.2, 0, 0, Math.PI * 2);
    else if (spec.head === 'square') { ctx.rect(cx - R * 0.86, cy - R, R * 1.72, R * 1.9); }
    else ctx.ellipse(cx, cy, R, R * 0.98, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  drawHead();

  // chin
  if ((spec.chin ?? 0) > 0.3) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 0.62, R * (0.44 + spec.chin * 0.22), R * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (spec.cleft) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + R * 0.56);
      ctx.lineTo(cx, cy + R * 0.86);
      ctx.stroke();
    }
  }
  // hair
  if (spec.hair?.style && spec.hair.style !== 'none') {
    ctx.fillStyle = spec.hair.color || '#8a5a2c';
    ctx.beginPath();
    ctx.ellipse(cx, cy - R * 0.62, R * 0.98, R * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (spec.beanie) {
    ctx.fillStyle = spec.beanie;
    ctx.beginPath();
    ctx.ellipse(cx, cy - R * 0.66, R * 1.02, R * 0.62, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // eyes
  const er = R * 0.40 * (spec.eyeSize || 1);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx + s * er * 0.98, cy - R * 0.12, er, er * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx + s * er * 0.98 + s * er * 0.12, cy - R * 0.1, er * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spec.glasses) {
    ctx.lineWidth = Math.max(2, size * 0.028);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * er * 0.98, cy - R * 0.12, er * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // mouth
  ctx.fillStyle = spec.lips || '#8c3a3a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + R * ((spec.chin ?? 0) > 0.6 ? 0.5 : 0.42), R * 0.26, R * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.03);
  ctx.stroke();
  return cv;
}
