// Cartoon characters, built from primitives: big heads, big eyes, chunky hands.
// People share one parametric body; Chispa the Xoloitzcuintle has her own rig.
// Animation is procedural: every frame each pose writes target joint angles and
// the rig eases toward them, so any pose blends smoothly into any other.
import * as THREE from 'three';
import { toon, flat, sphere, capsule, cyl, tube, mesh, outline, mergeByParent, mkCanvas, tex, shade, PAL } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ cast
export const CAST = {
  lupita: {
    name: 'Lupita', age: 'kid', skin: '#9c6038', eyes: '#3a2213',
    hair: { style: 'braids', color: '#2b1a12', ribbon: PAL.marigold },
    top: { color: PAL.turquoise, sleeves: 'short', trim: PAL.gold, flower: true },
    bottom: { kind: 'skirt', color: PAL.purple },
    legs: '#9c6038', socks: PAL.paper, shoes: PAL.rosa, extras: ['backpack'],
  },
  nico: {
    name: 'Nico', age: 'small', skin: '#9c6038', eyes: '#3a2213',
    hair: { style: 'curly', color: '#2b1a12' },
    top: { color: PAL.gold, sleeves: 'short' }, bottom: { kind: 'shorts', color: '#3a6fd8' }, shoes: PAL.red,
  },
  mateo: {
    name: 'Mateo', age: 'kid', skin: '#5e3a25', eyes: '#2a1a10',
    hair: { style: 'curly', color: '#16100c' },
    top: { color: '#1f9d55', sleeves: 'short', trim: '#ffffff' }, bottom: { kind: 'shorts', color: '#ffffff' },
    socks: '#1f9d55', shoes: '#ffffff',
  },
  abuela: {
    name: 'Abuela Rosa', age: 'elder', build: 'round', skin: '#b07448', eyes: '#3a2416',
    hair: { style: 'bun', color: '#d9d6d2' },
    top: { color: '#f7f2ea', sleeves: 'long', embroidery: [PAL.rosa, PAL.marigold, PAL.turquoise] },
    bottom: { kind: 'long', color: PAL.purple },
    shoes: '#3a2b26', extras: ['glasses', 'rebozo'], rebozo: ['#1d5f8f', '#e9e4da'],
  },
  mama: {
    name: 'Mamá', age: 'adult', skin: '#b97d50', eyes: '#3a2213',
    hair: { style: 'ponytail', color: '#2a1810' },
    top: { color: PAL.rosa, sleeves: 'long' }, bottom: { kind: 'pants', color: '#2f4f8a' }, shoes: '#3a2b26',
    extras: ['earrings'],
  },
  papa: {
    name: 'Papá', age: 'adult', build: 'avg', skin: '#7e4a2b', eyes: '#2e1c10',
    hair: { style: 'short', color: '#1f140e' },
    top: { color: '#3d8f5a', sleeves: 'long' }, bottom: { kind: 'pants', color: '#5b4636' }, shoes: '#2a201b',
    extras: ['beard'],
  },
  chela: {
    name: 'Doña Chela', age: 'adult', build: 'round', skin: '#c08a5f', eyes: '#2e1c10',
    hair: { style: 'braid', color: '#24160f', ribbon: PAL.rosa },
    top: { color: PAL.violet, sleeves: 'short' }, bottom: { kind: 'long', color: '#2c6e63' }, shoes: '#3a2b26',
    extras: ['apron'], gingham: PAL.rosa,
  },
  tomas: {
    name: 'Don Tomás', age: 'adult', skin: '#a8724b', eyes: '#2e1c10',
    hair: { style: 'short', color: '#2a1d16' },
    top: { color: '#e9e2cf', sleeves: 'long' }, bottom: { kind: 'pants', color: '#3e3a5c' }, shoes: '#2a201b',
    extras: ['cap', 'apron'], cap: PAL.red, apron: '#6a8fc9',
  },
  ramon: {
    name: 'Don Ramón', age: 'elder', build: 'round', skin: '#8a5232', eyes: '#3a2416',
    hair: { style: 'bald', color: '#cfc9c2' },
    top: { color: '#fbf6ea', sleeves: 'short' }, bottom: { kind: 'pants', color: '#6b5a49' }, shoes: '#2a201b',
    extras: ['apron', 'bakercap', 'beard', 'glasses'], apron: '#f5efe3', beardColor: '#d8d2ca',
  },
  lucia: {
    name: 'Tía Lucía', age: 'adult', skin: '#c48d62', eyes: '#3a2213',
    hair: { style: 'bob', color: '#3b1f2e' },
    top: { color: PAL.gold, sleeves: 'short' }, bottom: { kind: 'skirt', color: PAL.rosa }, legs: '#c48d62',
    socks: '#c48d62', shoes: PAL.purple, extras: ['earrings', 'headband'], headband: PAL.turquoise,
  },
  pancho: {
    name: 'Don Pancho', age: 'elder', build: 'slim', skin: '#9e6a45', eyes: '#2e1c10',
    hair: { style: 'short', color: '#d6d1ca' },
    top: { color: '#efe8d8', sleeves: 'long' }, bottom: { kind: 'pants', color: '#3b3b46' }, shoes: '#2a201b',
    extras: ['hat', 'vest', 'glasses'], vest: '#7a3b2e', hatColor: '#4a3a2c',
  },
  erendira: {
    name: 'Maestra Eréndira', age: 'adult', skin: '#8c5634', eyes: '#2e1c10',
    hair: { style: 'long', color: '#1d120c' },
    top: { color: PAL.cobalt, sleeves: 'long' },
    bottom: { kind: 'long', color: '#3a2a3f' }, shoes: '#3a2b26', extras: ['earrings', 'glasses'],
  },
  mago: {
    name: 'Doña Mago', age: 'elder', build: 'round', skin: '#a26a44', eyes: '#2e1c10',
    hair: { style: 'bun', color: '#5a4a44' },
    top: { color: PAL.turquoise, sleeves: 'short' }, bottom: { kind: 'long', color: '#5a3a2a' }, shoes: '#3a2b26',
    extras: ['apron', 'glasses'], gingham: PAL.cobalt,
  },
  catrina: {
    name: 'Catrina', age: 'adult', skin: '#c48d62', eyes: '#2e1c10',
    hair: { style: 'long', color: '#1d120c' },
    top: { color: '#5a1f6a', sleeves: 'long', trim: PAL.gold }, bottom: { kind: 'long', color: '#5a1f6a' }, shoes: '#1d1420',
    extras: ['facepaint', 'catrinahat', 'earrings'], paint: PAL.rosa, hatColor: '#2a1a30',
  },
  catrin: {
    name: 'Catrín', age: 'adult', skin: '#7e4a2b', eyes: '#2e1c10',
    hair: { style: 'short', color: '#1f140e' },
    top: { color: '#1e1a22', sleeves: 'long', trim: PAL.rosa }, bottom: { kind: 'pants', color: '#1e1a22' }, shoes: '#1d1420',
    extras: ['facepaint', 'tophat', 'vest'], vest: PAL.marigold, paint: PAL.turquoise,
  },
  musico1: {
    name: 'Músico', age: 'adult', skin: '#9a5f3a', eyes: '#2e1c10', hair: { style: 'short', color: '#1f140e' },
    top: { color: '#ffffff', sleeves: 'long' }, bottom: { kind: 'pants', color: '#1f2a44' }, shoes: '#2a201b', extras: ['vest'], vest: '#1f2a44',
  },
  musico2: {
    name: 'Música', age: 'adult', skin: '#c48d62', eyes: '#2e1c10', hair: { style: 'ponytail', color: '#2a1810' },
    top: { color: '#ffffff', sleeves: 'long' }, bottom: { kind: 'pants', color: '#1f2a44' }, shoes: '#2a201b', extras: ['vest'], vest: '#1f2a44',
  },
  musico3: {
    name: 'Músico', age: 'elder', skin: '#b0764d', eyes: '#2e1c10', hair: { style: 'short', color: '#d6d1ca' },
    top: { color: '#ffffff', sleeves: 'long' }, bottom: { kind: 'pants', color: '#1f2a44' }, shoes: '#2a201b', extras: ['vest', 'glasses'], vest: '#1f2a44',
  },
  abuelo: {
    name: 'Abuelo Beto', age: 'elder', build: 'avg', skin: '#8f5a36', eyes: '#2e1c10',
    hair: { style: 'short', color: '#e3ded6' },
    top: { color: '#c74b3a', sleeves: 'long' }, bottom: { kind: 'pants', color: '#3b3b46' }, shoes: '#2a201b',
    extras: ['flatcap', 'glasses'], cap: '#5b6b7a',
  },
};

// body proportions per age group (units: meters-ish, kid ≈ 1.3 tall)
const AGES = {
  small: { head: 0.25, torso: 0.24, thigh: 0.13, shin: 0.12, arm: 0.12, waist: 0.13, sh: 0.15, tw: 1.0 },
  kid: { head: 0.27, torso: 0.3, thigh: 0.17, shin: 0.17, arm: 0.15, waist: 0.14, sh: 0.17, tw: 1.0 },
  adult: { head: 0.27, torso: 0.46, thigh: 0.28, shin: 0.27, arm: 0.24, waist: 0.17, sh: 0.23, tw: 1.0 },
  elder: { head: 0.27, torso: 0.42, thigh: 0.24, shin: 0.24, arm: 0.22, waist: 0.18, sh: 0.22, tw: 1.0 },
};
const BUILDS = { slim: 0.86, avg: 1, round: 1.25 };

// position + orientation on the head sphere: yaw (left/right), pitch (up/down)
function onHead(R, yaw, pitch, out = 0) {
  const r = R + out;
  const p = V(r * Math.cos(pitch) * Math.sin(yaw), r * Math.sin(pitch), r * Math.cos(pitch) * Math.cos(yaw));
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), p.clone().normalize());
  return { p, q };
}

function place(obj, { p, q }) {
  obj.position.copy(p);
  obj.quaternion.copy(q);
  return obj;
}

function embroideryTexture(base, colors) {
  const cv = mkCanvas(256, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 128);
  // a band of stitched flowers around the yoke (capsule v≈0.75)
  for (let i = 0; i < 12; i++) {
    const x = i * 21.33 + 10, y = 26;
    const c = colors[i % colors.length];
    ctx.fillStyle = c;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 2.6, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = colors[(i + 1) % colors.length];
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.green;
    ctx.fillRect(x + 7, y + 7, 5, 2);
  }
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(0, 42); ctx.lineTo(256, 42); ctx.stroke();
  return tex(cv);
}

// a painted calavera face: white face, colored circles around the eyes, petals
function facePaintTex(accent) {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(128, 128, 124, 126, 0, 0, TAU); ctx.fill();
  for (const sx of [-1, 1]) {
    const x = 128 + sx * 58;
    ctx.fillStyle = accent;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 42, 128 + Math.sin(a) * 46, 12, 7, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#1d1420';
    ctx.beginPath(); ctx.ellipse(x, 128, 36, 40, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#1d1420';
  ctx.beginPath(); ctx.moveTo(128, 150); ctx.lineTo(116, 176); ctx.lineTo(140, 176); ctx.fill();
  ctx.strokeStyle = '#1d1420';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(76, 214); ctx.quadraticCurveTo(128, 238, 180, 214); ctx.stroke();
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(128 + i * 12, 212 + Math.abs(i)); ctx.lineTo(128 + i * 12, 232 - Math.abs(i)); ctx.stroke(); }
  ctx.fillStyle = PAL.gold;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.beginPath(); ctx.arc(128 + Math.cos(a) * 14, 54 + Math.sin(a) * 14, 7, 0, TAU); ctx.fill(); }
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(128, 54, 7, 0, TAU); ctx.fill();
  return tex(cv);
}

function ginghamTexture(color) {
  const cv = mkCanvas(64, 64);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * 16, 0, 8, 64);
    ctx.fillRect(0, i * 16, 64, 8);
  }
  ctx.globalAlpha = 1;
  return tex(cv, { repeat: [3, 2] });
}

function stripeTexture(colors, vertical = false, n = 10) {
  const cv = mkCanvas(64, 64);
  const ctx = cv.getContext('2d');
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    if (vertical) ctx.fillRect((i * 64) / n, 0, 64 / n + 1, 64);
    else ctx.fillRect(0, (i * 64) / n, 64, 64 / n + 1);
  }
  // little ikat-style dots for the rebozo
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % 64, (i * 23) % 64, 2, 1);
  return tex(cv, { repeat: [4, 2] });
}

function hairMaterial(color) {
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  const r = rngLocal(color.length * 31 + color.charCodeAt(1));
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 70; i++) {
    const x = r() * 128;
    ctx.strokeStyle = r() > 0.5 ? shade(color, -28) : shade(color, 22);
    ctx.globalAlpha = 0.35 + r() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 4, 40, x - 4, 80, x + (r() - 0.5) * 6, 128);
    ctx.stroke();
  }
  // glossy sheen band
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = shade(color, 70);
  ctx.fillRect(0, 34, 128, 9);
  ctx.globalAlpha = 1;
  return toon('#ffffff', { map: tex(cv) });
}

// ------------------------------------------------------------------ people
export class Person {
  constructor(spec) {
    this.spec = spec;
    this.name = spec.name;
    this.root = new THREE.Group();
    this.root.name = spec.name;
    this.body = new THREE.Group(); // bob/lean lives here
    this.root.add(this.body);
    this.t = Math.random() * 10;
    this.anim = 'idle';
    this.animT = 0;
    this.talking = false;
    this.talkAmt = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.lookTarget = null;
    this.pointTarget = null;
    this.emoteName = 'smile';
    this.walk = null;
    this.j = {};
    this.cur = {};
    this.build();
  }

  build() {
    const s = this.spec;
    const A = AGES[s.age || 'adult'];
    const bw = BUILDS[s.build || 'avg'];
    const skin = toon(s.skin);
    const topM = s.top.embroidery
      ? toon('#ffffff', { map: embroideryTexture(s.top.color, s.top.embroidery) })
      : toon(s.top.color);
    const botM = toon(s.bottom.color);
    const shoeM = toon(s.shoes || '#333');
    const legM = s.bottom.kind === 'pants' ? botM : toon(s.legs || s.skin);
    const R = A.head;
    this.R = R;

    const legLen = A.thigh + A.shin;
    const hipY = legLen + 0.06;
    this.hipY = hipY;

    // ---- hips + legs
    const hips = new THREE.Group();
    hips.position.y = hipY;
    this.body.add(hips);
    this.j.hips = hips;
    const pelvis = sphere(A.waist * bw, s.bottom.kind === 'skirt' || s.bottom.kind === 'long' ? botM : (s.bottom.kind === 'pants' || s.bottom.kind === 'shorts' ? botM : topM), 18);
    pelvis.scale.set(1.05, 0.72, 0.9);
    hips.add(pelvis);

    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(side * A.waist * 0.52 * bw, -0.02, 0);
      hips.add(hip);
      const thighR = 0.052 * (s.age === 'kid' || s.age === 'small' ? 1 : 1.25) * Math.sqrt(bw);
      const thigh = capsule(thighR, A.thigh - thighR, s.bottom.kind === 'shorts' ? botM : legM);
      thigh.position.y = -A.thigh / 2;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -A.thigh;
      hip.add(knee);
      const shinM = s.bottom.kind === 'pants' ? botM : toon(s.socks || s.legs || s.skin);
      const shin = capsule(thighR * 0.9, A.shin - thighR, shinM);
      shin.position.y = -A.shin / 2;
      knee.add(shin);
      const shoe = sphere(0.075 * (s.age === 'small' ? 0.85 : 1) * (s.age === 'kid' ? 1 : 1.12), shoeM, 18);
      shoe.scale.set(0.9, 0.62, 1.45);
      shoe.position.set(0, -A.shin + 0.005, 0.035);
      knee.add(shoe);
      if (s.age === 'kid' || s.age === 'small') {
        const sole = sphere(0.075, toon('#ffffff'), 14);
        sole.scale.set(0.95, 0.25, 1.5);
        sole.position.set(0, -A.shin - 0.028, 0.035);
        knee.add(sole);
      }
      this.j[side > 0 ? 'hipL' : 'hipR'] = hip;
      this.j[side > 0 ? 'kneeL' : 'kneeR'] = knee;
    }

    // skirts / long skirts
    if (s.bottom.kind === 'skirt' || s.bottom.kind === 'long') {
      const len = s.bottom.kind === 'long' ? legLen * 0.86 : legLen * 0.5;
      const skirt = cyl(A.waist * 0.95 * bw, A.waist * (s.bottom.kind === 'long' ? 1.55 : 1.75) * bw, len, botM, 24, true);
      skirt.material = toon(s.bottom.color, { side: THREE.DoubleSide });
      skirt.position.y = -len / 2 + 0.02;
      hips.add(skirt);
      // hem trim
      const hem = new THREE.Mesh(new THREE.TorusGeometry(A.waist * (s.bottom.kind === 'long' ? 1.55 : 1.75) * bw, 0.012, 6, 32), toon(shade(s.bottom.color, -40)));
      hem.rotation.x = Math.PI / 2;
      hem.position.y = -len + 0.02;
      hem.userData.noOutline = true;
      hips.add(hem);
    }

    // ---- spine + torso
    const spine = new THREE.Group();
    spine.position.y = 0.02;
    hips.add(spine);
    this.j.spine = spine;
    const tW = (s.age === 'kid' || s.age === 'small' ? 0.13 : 0.16) * bw;
    const torso = capsule(tW, A.torso - tW * 1.2, topM, 20);
    torso.scale.set(1.12, 1, 0.82 * (bw > 1.1 ? 1.08 : 1));
    torso.position.y = A.torso / 2;
    spine.add(torso);
    if (s.top.trim) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(tW * 0.62, 0.016, 8, 24), toon(s.top.trim));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = A.torso - 0.02;
      collar.scale.set(1.12, 0.82, 1);
      collar.userData.noOutline = true;
      spine.add(collar);
    }
    if (s.top.flower) {
      // marigold patch on the shirt
      const fl = new THREE.Group();
      for (let k = 0; k < 8; k++) {
        const pet = sphere(0.022, toon(PAL.marigold), 8);
        const a = (k / 8) * TAU;
        pet.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0);
        pet.scale.set(1, 1, 0.4);
        fl.add(pet);
      }
      const mid = sphere(0.018, toon(PAL.orange), 8);
      mid.scale.z = 0.5;
      fl.add(mid);
      fl.position.set(0.05, A.torso * 0.62, tW * 0.82);
      fl.traverse((o) => { o.userData.noOutline = true; o.castShadow = false; });
      spine.add(fl);
    }
    if (s.extras?.includes('vest')) {
      const vest = capsule(tW * 1.04, A.torso * 0.55, toon(s.vest), 20);
      vest.scale.set(1.12, 1, 0.84);
      vest.position.y = A.torso * 0.48;
      spine.add(vest);
    }
    if (s.extras?.includes('apron')) {
      const apM = s.gingham
        ? toon('#ffffff', { map: ginghamTexture(s.gingham), side: THREE.DoubleSide })
        : toon(s.apron || '#fff', { side: THREE.DoubleSide });
      const ap = mesh(new THREE.CylinderGeometry(tW * 1.18, tW * 1.6, A.torso * 0.62 + 0.28, 20, 1, true, -1.0, 2.0), apM);
      ap.position.set(0, A.torso * 0.12, 0.012);
      ap.scale.z = 0.86;
      spine.add(ap);
    }

    // ---- shoulders + arms
    const shY = A.torso - 0.05;
    for (const side of [1, -1]) {
      const sh = new THREE.Group();
      sh.position.set(side * (A.sh * bw * 0.92), shY, 0);
      spine.add(sh);
      const armR = (s.age === 'kid' || s.age === 'small' ? 0.042 : 0.05) * Math.sqrt(bw);
      const upperM = topM === skin ? skin : (s.top.embroidery ? toon(s.top.color) : topM);
      const upper = capsule(armR, A.arm - armR, upperM);
      upper.position.y = -A.arm / 2;
      sh.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -A.arm;
      sh.add(elbow);
      const foreM = s.top.sleeves === 'long' ? upperM : skin;
      const fore = capsule(armR * 0.92, A.arm - armR, foreM);
      fore.position.y = -A.arm / 2;
      elbow.add(fore);
      const hand = sphere(armR * 1.45, skin, 14);
      hand.scale.set(0.9, 1.05, 0.75);
      hand.position.y = -A.arm - 0.012;
      elbow.add(hand);
      const thumb = sphere(armR * 0.6, skin, 8);
      thumb.position.set(side * -armR * 0.9, -A.arm + 0.01, armR * 0.5);
      elbow.add(thumb);
      this.j[side > 0 ? 'shL' : 'shR'] = sh;
      this.j[side > 0 ? 'elL' : 'elR'] = elbow;
    }

    if (s.extras?.includes('rebozo')) {
      // shawl draped over the shoulders, hanging in front
      const [c1, c2] = s.rebozo;
      const m = toon('#ffffff', { map: stripeTexture([c1, c1, c2, c1, shade(c1, 30)], false, 10), side: THREE.DoubleSide });
      const drape = mesh(new THREE.CylinderGeometry(tW * 1.18, tW * 1.6, A.torso * 0.5, 28, 1, true, Math.PI * 0.2, Math.PI * 1.6), m);
      drape.position.y = A.torso * 0.7;
      drape.scale.z = 0.86;
      spine.add(drape);
      for (const side of [1, -1]) {
        const tail = mesh(new THREE.BoxGeometry(0.075, A.torso * 0.75, 0.014), m);
        tail.position.set(side * tW * 0.62, A.torso * 0.42, tW * 0.86);
        tail.rotation.z = side * 0.1;
        spine.add(tail);
        const fringe = mesh(new THREE.BoxGeometry(0.075, 0.045, 0.008), toon(c2));
        fringe.position.set(side * tW * 0.66, A.torso * 0.03, tW * 0.88);
        fringe.rotation.z = side * 0.1;
        fringe.userData.noOutline = true;
        spine.add(fringe);
      }
    }

    if (s.extras?.includes('backpack')) {
      const pack = mesh(new THREE.CapsuleGeometry(0.1, 0.1, 6, 16), toon(PAL.marigold));
      pack.scale.set(1.15, 1, 0.6);
      pack.position.set(0, A.torso * 0.5, -tW * 0.95);
      spine.add(pack);
      const flap = sphere(0.09, toon(PAL.orange), 16);
      flap.scale.set(1.25, 0.6, 0.55);
      flap.position.set(0, A.torso * 0.68, -tW * 1.05);
      spine.add(flap);
      const pocket = sphere(0.06, toon(PAL.gold), 12);
      pocket.scale.set(1.3, 0.8, 0.45);
      pocket.position.set(0, A.torso * 0.36, -tW * 1.32);
      spine.add(pocket);
      for (const side of [1, -1]) {
        const strap = mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 16, Math.PI * 1.15), toon(PAL.orange));
        strap.rotation.y = Math.PI / 2;
        strap.rotation.z = -0.4;
        strap.position.set(side * 0.075, A.torso * 0.62, -0.01);
        strap.userData.noOutline = true;
        spine.add(strap);
      }
    }

    // ---- neck + head
    const neck = new THREE.Group();
    neck.position.y = A.torso + 0.01;
    spine.add(neck);
    this.j.neck = neck;
    const neckMesh = cyl(0.045, 0.05, 0.08, skin, 12);
    neckMesh.position.y = 0.02;
    neck.add(neckMesh);
    const head = new THREE.Group();
    head.position.y = R * 0.92;
    neck.add(head);
    this.j.head = head;
    const skull = sphere(R, skin, 32);
    skull.scale.set(1, s.age === 'elder' ? 0.98 : 1, 0.96);
    head.add(skull);

    // ears
    for (const side of [1, -1]) {
      const ear = sphere(R * 0.2, skin, 12);
      ear.scale.set(0.55, 1, 0.8);
      ear.position.set(side * R * 0.97, -R * 0.06, -R * 0.04);
      head.add(ear);
      if (s.extras?.includes('earrings')) {
        const ring = mesh(new THREE.TorusGeometry(R * 0.08, R * 0.018, 6, 16), toon(PAL.gold), { cast: false });
        ring.position.set(side * R * 1.0, -R * 0.3, -R * 0.02);
        ring.rotation.y = Math.PI / 2;
        ring.userData.noOutline = true;
        head.add(ring);
      }
    }

    // eyes: tall cartoon ovals, big glossy irises, a lid line on top
    this.eyes = [];
    const white = toon('#ffffff', { rim: 0 });
    const irisM = flat(s.eyes || '#3a2213');
    const irisRing = flat(shade(s.eyes || '#3a2213', -25));
    const pupilM = flat('#0d0806');
    const shineM = flat('#ffffff');
    const lidM = toon('#1f120c');
    const eyeSize = s.age === 'kid' || s.age === 'small' ? 1.08 : (s.age === 'elder' ? 0.84 : 0.92);
    const girl = !['short', 'bald', 'curly'].includes(s.hair.style);
    for (const side of [1, -1]) {
      const eg = new THREE.Group();
      place(eg, onHead(R, side * 0.335, -0.05, -R * 0.06));
      head.add(eg);
      const lid = new THREE.Group(); // blink scales this
      eg.add(lid);
      const sclera = sphere(R * 0.22 * eyeSize, white, 20);
      sclera.scale.set(0.8, 1.16, 0.5);
      sclera.position.z = R * 0.04;
      lid.add(sclera);
      const look = new THREE.Group();
      look.position.z = R * 0.145 * eyeSize;
      lid.add(look);
      const ring = mesh(new THREE.CircleGeometry(R * 0.158 * eyeSize, 24), irisRing, { cast: false });
      ring.scale.y = 1.12;
      look.add(ring);
      const iris = mesh(new THREE.CircleGeometry(R * 0.138 * eyeSize, 24), irisM, { cast: false });
      iris.scale.y = 1.12;
      iris.position.z = 0.001;
      look.add(iris);
      const pupil = mesh(new THREE.CircleGeometry(R * 0.075 * eyeSize, 16), pupilM, { cast: false });
      pupil.scale.y = 1.1;
      pupil.position.z = 0.002;
      look.add(pupil);
      const sh1 = mesh(new THREE.CircleGeometry(R * 0.05 * eyeSize, 12), shineM, { cast: false });
      sh1.position.set(R * 0.05 * eyeSize, R * 0.06 * eyeSize, 0.004);
      look.add(sh1);
      const sh2 = mesh(new THREE.CircleGeometry(R * 0.022 * eyeSize, 10), shineM, { cast: false });
      sh2.position.set(-R * 0.045 * eyeSize, -R * 0.06 * eyeSize, 0.004);
      look.add(sh2);
      for (const o of [ring, iris, pupil, sh1, sh2]) o.userData.noOutline = true;
      // upper lid line, with a little lash flick for the girls & women
      const w = R * 0.19 * eyeSize, hgt = R * 0.25 * eyeSize, z = R * 0.1;
      const pts = [[-w, hgt * 0.35, z * 0.6], [-w * 0.5, hgt * 0.9, z], [0, hgt * 1.02, z * 1.1], [w * 0.5, hgt * 0.9, z], [w, hgt * 0.35, z * 0.6]];
      if (girl) pts.push([w * 1.25 * 1, hgt * 0.62, z * 0.3]);
      const lidLine = tube(pts.map(([x, y, zz]) => [side > 0 ? x : -x, y, zz]), R * 0.022, lidM, 14);
      lid.add(lidLine);
      this.eyes.push({ g: eg, lid, look, side });
    }

    // brows
    this.brows = [];
    const browM = toon(s.hair.style === 'bald' ? (s.beardColor || '#bbb') : shade(s.hair.color, s.age === 'elder' ? -30 : -5));
    for (const side of [1, -1]) {
      const bg = new THREE.Group();
      place(bg, onHead(R, side * 0.335, 0.36, R * 0.0));
      const b = tube([[-R * 0.13, -R * 0.02, 0], [0, R * 0.03, R * 0.02], [R * 0.13, -R * 0.01, 0]], R * 0.028, browM, 10);
      bg.add(b);
      head.add(bg);
      this.brows.push({ g: bg, side, base: bg.position.clone() });
    }

    // nose
    const nose = sphere(R * 0.075, toon(shade(s.skin, -8)), 12);
    place(nose, onHead(R, 0, -0.16, R * 0.02));
    nose.scale.set(1.15, 0.9, 0.9);
    head.add(nose);

    // cheeks
    const blushM = flat('#ff6f7d', { transparent: true, opacity: 0.32, depthWrite: false });
    for (const side of [1, -1]) {
      const c = mesh(new THREE.CircleGeometry(R * 0.11, 16), blushM, { cast: false });
      place(c, onHead(R, side * 0.58, -0.3, R * 0.012));
      c.userData.noOutline = true;
      head.add(c);
    }

    // mouth: a smile line + an open "D" mouth for talking/laughing
    const mouth = new THREE.Group();
    place(mouth, onHead(R, 0, -0.42, R * 0.005));
    head.add(mouth);
    const lipM = toon('#5b1f1f');
    const smile = tube([[-R * 0.17, R * 0.04, 0], [-R * 0.08, -R * 0.045, R * 0.01], [0, -R * 0.06, R * 0.012], [R * 0.08, -R * 0.045, R * 0.01], [R * 0.17, R * 0.04, 0]], R * 0.022, lipM, 16);
    mouth.add(smile);
    const openG = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-R * 0.16, 0);
    shape.quadraticCurveTo(0, R * 0.02, R * 0.16, 0);
    shape.quadraticCurveTo(R * 0.15, -R * 0.2, 0, -R * 0.21);
    shape.quadraticCurveTo(-R * 0.15, -R * 0.2, -R * 0.16, 0);
    const openM = mesh(new THREE.ShapeGeometry(shape, 12), flat('#4a1216'), { cast: false });
    openG.add(openM);
    const tongue = mesh(new THREE.CircleGeometry(R * 0.075, 14), flat('#e06a72'), { cast: false });
    tongue.scale.set(1.3, 0.7, 1);
    tongue.position.set(0, -R * 0.15, 0.002);
    openG.add(tongue);
    const teeth = mesh(new THREE.PlaneGeometry(R * 0.2, R * 0.045), flat('#ffffff'), { cast: false });
    teeth.position.set(0, -R * 0.025, 0.003);
    openG.add(teeth);
    openG.position.z = R * 0.012;
    openG.traverse((o) => { o.userData.noOutline = true; });
    mouth.add(openG);
    this.mouth = { g: mouth, smile, open: openG };

    // facial hair
    if (s.extras?.includes('mustache')) {
      const mm = toon(s.beardColor || shade(s.hair.color, -10));
      for (const side of [1, -1]) {
        const m = sphere(R * 0.1, mm, 12);
        m.scale.set(1.45, 0.55, 0.65);
        place(m, onHead(R, side * 0.13, -0.27, R * 0.03));
        m.rotateZ(side * -0.25);
        head.add(m);
      }
    }
    if (s.extras?.includes('beard')) {
      const bm = toon(s.beardColor || s.hair.color);
      const beard = sphere(R * 0.62, bm, 20);
      beard.scale.set(1.05, 0.62, 0.72);
      beard.position.set(0, -R * 0.62, R * 0.32);
      head.add(beard);
      // keep the mouth visible above the beard
      mouth.position.add(V(0, R * 0.02, R * 0.04));
    }

    // glasses
    if (s.extras?.includes('glasses')) {
      const gm = toon('#6b3e26');
      for (const side of [1, -1]) {
        const lens = mesh(new THREE.TorusGeometry(R * 0.2, R * 0.022, 8, 24), gm, { cast: false });
        place(lens, onHead(R, side * 0.335, -0.05, R * 0.12));
        lens.userData.noOutline = true;
        head.add(lens);
        const glass = mesh(new THREE.CircleGeometry(R * 0.19, 20), flat('#cfe8ff', { transparent: true, opacity: 0.18, depthWrite: false }), { cast: false });
        place(glass, onHead(R, side * 0.335, -0.05, R * 0.13));
        glass.userData.noOutline = true;
        head.add(glass);
        const arm = tube([[side * R * 0.5, R * 0.0, R * 0.78], [side * R * 0.92, R * 0.02, R * 0.25], [side * R * 0.95, -R * 0.05, -R * 0.15]], R * 0.018, gm, 6);
        head.add(arm);
      }
      const bridge = tube([[-R * 0.12, -R * 0.0, R * 1.05], [0, R * 0.04, R * 1.1], [R * 0.12, -R * 0.0, R * 1.05]], R * 0.02, gm, 6);
      head.add(bridge);
    }

    this.buildHair(head, R, s);

    // hats
    if (s.extras?.includes('cap')) {
      const cm = toon(s.cap || PAL.red);
      const crown = mesh(new THREE.SphereGeometry(R * 1.05, 24, 12, 0, TAU, 0, Math.PI * 0.45), cm);
      crown.position.y = R * 0.08;
      crown.rotation.x = -0.12;
      head.add(crown);
      const bill = cyl(R * 0.6, R * 0.6, R * 0.05, cm, 20);
      bill.geometry = new THREE.CylinderGeometry(R * 0.62, R * 0.62, R * 0.05, 20, 1, false, -Math.PI / 2, Math.PI);
      bill.material = toon(shade(s.cap || PAL.red, -30));
      bill.scale.set(1.05, 1, 1.1);
      bill.position.set(0, R * 0.36, R * 0.66);
      bill.rotation.x = 0.18;
      head.add(bill);
    }
    if (s.extras?.includes('flatcap')) {
      const cm = toon(s.cap || '#5b6b7a');
      const crown = sphere(R * 1.1, cm, 24);
      crown.scale.set(1, 0.42, 1.08);
      crown.position.set(0, R * 0.55, -R * 0.02);
      crown.rotation.x = 0.12;
      head.add(crown);
      const bill = mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, R * 0.05, 20, 1, false, -Math.PI / 2, Math.PI), toon(shade(s.cap || '#5b6b7a', -20)));
      bill.scale.set(1.1, 1, 0.7);
      bill.position.set(0, R * 0.5, R * 0.8);
      bill.rotation.x = 0.3;
      head.add(bill);
      const button = sphere(R * 0.07, cm, 8);
      button.position.set(0, R * 0.98, R * 0.05);
      head.add(button);
    }
    if (s.extras?.includes('facepaint')) {
      const paint = mesh(new THREE.SphereGeometry(R * 1.004, 32, 24, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.18, Math.PI * 0.62), toon('#ffffff', { map: facePaintTex(s.paint || PAL.rosa), transparent: true, alphaTest: 0.4 }), { cast: false });
      paint.userData.noOutline = true;
      head.add(paint);
    }
    if (s.extras?.includes('catrinahat')) {
      const hm = toon(s.hatColor || '#2a1a30');
      const brim = cyl(R * 2.1, R * 2.1, R * 0.06, hm, 32);
      brim.position.y = R * 0.7;
      brim.rotation.x = -0.15;
      brim.rotation.z = 0.12;
      head.add(brim);
      const crown = cyl(R * 0.75, R * 0.85, R * 0.45, hm, 24);
      crown.position.y = R * 0.95;
      crown.rotation.z = 0.12;
      head.add(crown);
      const fl = [PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple, PAL.gold, PAL.red];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 1.2 - Math.PI * 0.1;
        const f = sphere(R * 0.24, toon(fl[i % fl.length]), 10);
        f.position.set(Math.cos(a) * R * 1.0, R * 0.95 + Math.sin(i) * R * 0.08, Math.sin(a) * R * 0.75 + R * 0.1);
        head.add(f);
      }
      for (let i = 0; i < 3; i++) {
        const feather = sphere(R * 0.25, toon([PAL.lime, PAL.cobalt, PAL.rosa][i]), 8);
        feather.scale.set(0.35, 2.6, 0.35);
        feather.position.set(-R * 0.55 + i * R * 0.18, R * 1.55, -R * 0.4);
        feather.rotation.z = 0.5 - i * 0.25;
        head.add(feather);
      }
    }
    if (s.extras?.includes('tophat')) {
      const hm = toon('#1e1a22');
      const brim = cyl(R * 1.15, R * 1.15, R * 0.05, hm, 24);
      brim.position.y = R * 0.68;
      head.add(brim);
      const crown = cyl(R * 0.72, R * 0.75, R * 0.9, hm, 24);
      crown.position.y = R * 1.15;
      head.add(crown);
      const band = cyl(R * 0.755, R * 0.76, R * 0.14, toon(PAL.rosa), 24);
      band.position.y = R * 0.8;
      band.userData.noOutline = true;
      head.add(band);
    }
    if (s.extras?.includes('bakercap')) {
      const cm = toon('#ffffff');
      const crown = cyl(R * 0.86, R * 0.92, R * 0.42, cm, 24);
      crown.position.y = R * 0.78;
      crown.rotation.x = -0.1;
      head.add(crown);
      const puff = sphere(R * 0.9, cm, 20);
      puff.scale.set(1, 0.42, 1);
      puff.position.y = R * 1.0;
      head.add(puff);
    }
    if (s.extras?.includes('hat')) {
      const hm = toon(s.hatColor || '#4a3a2c');
      const brim = cyl(R * 1.45, R * 1.45, R * 0.05, hm, 28);
      brim.position.y = R * 0.62;
      brim.rotation.x = -0.08;
      head.add(brim);
      const crown = cyl(R * 0.78, R * 0.88, R * 0.52, hm, 24);
      crown.position.y = R * 0.9;
      crown.rotation.x = -0.08;
      head.add(crown);
      const band = cyl(R * 0.885, R * 0.89, R * 0.1, toon(PAL.ink), 24);
      band.position.y = R * 0.7;
      band.rotation.x = -0.08;
      band.userData.noOutline = true;
      head.add(band);
    }

    // scale the whole person by age/height
    const hScale = s.height || 1;
    this.root.scale.setScalar(hScale);
    // the mouth parts toggle and the eyes blink/look, so keep them separate
    this.mouth.smile.userData.keep = true;
    mergeByParent(this.root);
    outline(this.root, s.age === 'kid' || s.age === 'small' ? 0.011 : 0.013);

    // rest pose of each joint (targets are offsets from this)
    for (const [k, o] of Object.entries(this.j)) this.cur[k] = { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z };
    this.height = (hipY + A.torso + R * 2.1) * hScale;
  }

  buildHair(head, R, s) {
    const st = s.hair.style;
    const hatted = s.extras?.some((e) => ['hat', 'cap', 'bakercap', 'flatcap', 'catrinahat', 'tophat'].includes(e));
    const hm = hairMaterial(s.hair.color);
    if (st === 'bald' || hatted) {
      // a fringe of hair around the back and sides (under the hat brim)
      const ring = mesh(new THREE.TorusGeometry(R * 0.93, R * 0.17, 10, 28, Math.PI * 1.3), hm);
      ring.rotation.set(Math.PI / 2 + 0.22, 0, Math.PI * 0.85);
      ring.position.set(0, st === 'bald' ? -R * 0.02 : -R * 0.02, -R * 0.1);
      head.add(ring);
      if (st === 'bald') return;
    }
    const domeT = st === 'short' || st === 'curly' ? 0.41 : 0.44;
    const tilt = -0.42;
    const partYaw = { braids: 0, braid: 0, bun: 0, long: 0, bob: 0.5 }[st];
    if (!hatted) {
      if (partYaw === undefined) {
        const cap = mesh(new THREE.SphereGeometry(R * 1.06, 32, 16, 0, TAU, 0, Math.PI * domeT), hm);
        cap.rotation.x = tilt;
        head.add(cap);
      } else {
        // two half-domes leaning apart leave a part line down the middle
        const capG = new THREE.Group();
        capG.rotation.set(tilt, partYaw, 0);
        head.add(capG);
        for (const side of [1, -1]) {
          const half = mesh(new THREE.SphereGeometry(R * 1.06, 18, 16, side > 0 ? Math.PI / 2 : Math.PI * 1.5, Math.PI, 0, Math.PI * domeT), hm);
          half.rotation.z = -side * 0.05;
          capG.add(half);
        }
      }
    }
    // back of the head
    const back = sphere(R * 1.04, hm, 24);
    if (st === 'short' || st === 'curly' || hatted) {
      back.scale.set(0.98, 0.8, 0.8);
      back.position.set(0, hatted ? R * 0.1 : R * 0.05, -R * 0.2);
    } else {
      back.scale.set(1.0, st === 'long' ? 1.05 : 0.95, 0.88);
      back.position.set(0, -R * 0.08, -R * 0.14);
    }
    head.add(back);
    if (hatted) return;

    // bangs / fringe
    if (st === 'braids' || st === 'bob' || st === 'long' || st === 'braid') {
      const n = st === 'bob' ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const bang = sphere(R * 0.27, hm, 14);
        place(bang, onHead(R, t * (st === 'bob' ? 1.1 : 1.45) + (st === 'bob' ? 0.25 : 0), 0.66 - Math.abs(t) * 0.38, R * 0.0));
        bang.scale.set(1.0, 0.62, 0.5);
        bang.rotateZ(-t * 0.9);
        head.add(bang);
      }
    }
    if (st === 'short') {
      for (let i = 0; i < 5; i++) {
        const tuft = sphere(R * 0.24, hm, 12);
        place(tuft, onHead(R, (i - 2) * 0.3, 0.78 - Math.abs(i - 2) * 0.06, R * 0.03));
        tuft.scale.set(1, 0.5, 0.75);
        tuft.rotateZ((i - 2) * -0.3);
        head.add(tuft);
      }
    }
    if (st === 'curly') {
      const r = rngLocal(7);
      for (let i = 0; i < 26; i++) {
        const c = sphere(R * (0.19 + r() * 0.07), hm, 10);
        place(c, onHead(R, (r() - 0.5) * 3.8, 0.55 + r() * 0.8, R * 0.06));
        head.add(c);
      }
    }
    if (st === 'braids' || st === 'braid') {
      const sides = st === 'braids' ? [1, -1] : [0];
      for (const side of sides) {
        const g = new THREE.Group();
        g.position.set(side * R * 0.84, -R * 0.32, side ? -R * 0.2 : -R * 0.92);
        head.add(g);
        const n = st === 'braid' ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const k = sphere(R * (0.2 - i * 0.012), hm, 12);
          k.position.set(side * R * 0.015 * i, -i * R * 0.27, side ? R * 0.02 * i : -R * 0.04 * i);
          k.scale.set(1, 1.15, 1);
          k.rotation.z = (i % 2 ? 0.35 : -0.35);
          g.add(k);
        }
        const rib = new THREE.Group();
        rib.position.set(side * R * 0.015 * n, -n * R * 0.27 + R * 0.12, side ? R * 0.02 * n : -R * 0.04 * n);
        const rm = toon(s.hair.ribbon || PAL.rosa);
        for (const sx of [1, -1]) {
          const loop = sphere(R * 0.12, rm, 10);
          loop.scale.set(1.3, 0.8, 0.6);
          loop.position.x = sx * R * 0.13;
          rib.add(loop);
        }
        rib.add(sphere(R * 0.07, rm, 8));
        g.add(rib);
        const tip = sphere(R * 0.12, hm, 10);
        tip.position.set(side * R * 0.015 * n, -n * R * 0.27 - R * 0.02, side ? R * 0.02 * n : -R * 0.04 * n);
        tip.scale.set(1, 1.5, 1);
        g.add(tip);
        this[side > 0 ? 'braidL' : side < 0 ? 'braidR' : 'braidB'] = g;
      }
      if (st === 'braids') {
        // a marigold hair clip
        const clip = new THREE.Group();
        for (let k = 0; k < 7; k++) {
          const pet = sphere(R * 0.075, toon(PAL.marigold), 8);
          const a = (k / 7) * TAU;
          pet.position.set(Math.cos(a) * R * 0.08, Math.sin(a) * R * 0.08, 0);
          clip.add(pet);
        }
        const mid = sphere(R * 0.07, toon(PAL.orange), 8);
        mid.position.z = R * 0.03;
        clip.add(mid);
        place(clip, onHead(R, 0.62, 0.72, R * 0.1));
        head.add(clip);
      }
    }
    if (st === 'bun') {
      const bun = sphere(R * 0.42, hm, 18);
      bun.position.set(0, R * 0.42, -R * 0.82);
      head.add(bun);
      const pin = cyl(R * 0.025, R * 0.025, R * 1.0, toon(PAL.marigold), 6);
      pin.position.set(0, R * 0.5, -R * 0.84);
      pin.rotation.z = 1.1;
      head.add(pin);
      const flower = sphere(R * 0.11, toon(PAL.rosa), 10);
      flower.position.set(R * 0.36, R * 0.62, -R * 0.66);
      head.add(flower);
    }
    if (st === 'ponytail') {
      const pt = new THREE.Group();
      pt.position.set(0, R * 0.3, -R * 0.98);
      head.add(pt);
      pt.add(sphere(R * 0.14, toon(PAL.gold), 10));
      const tail = mesh(new THREE.CapsuleGeometry(R * 0.2, R * 0.9, 6, 12), hm);
      tail.position.set(0, -R * 0.55, -R * 0.14);
      tail.rotation.x = 0.25;
      pt.add(tail);
      this.ponytail = pt;
    }
    if (st === 'bob' || st === 'long') {
      for (const side of [1, -1]) {
        const lock = mesh(new THREE.CapsuleGeometry(R * 0.3, st === 'long' ? R * 1.4 : R * 0.5, 6, 12), hm);
        lock.position.set(side * R * 0.8, st === 'long' ? -R * 0.72 : -R * 0.32, -R * 0.18);
        lock.scale.set(0.75, 1, 1.1);
        head.add(lock);
      }
      if (st === 'long') {
        const backLock = mesh(new THREE.CapsuleGeometry(R * 0.6, R * 1.2, 6, 14), hm);
        backLock.position.set(0, -R * 0.78, -R * 0.55);
        backLock.scale.set(1.2, 1, 0.55);
        head.add(backLock);
      }
    }
    if (s.extras?.includes('headband')) {
      const hb = mesh(new THREE.TorusGeometry(R * 1.07, R * 0.06, 8, 32, Math.PI), toon(s.headband || PAL.turquoise));
      hb.rotation.set(-0.5, 0, 0);
      hb.position.y = R * 0.12;
      head.add(hb);
    }
  }

  // ---------------------------------------------------------------- control
  play(anim, opts = {}) {
    if (this.anim === anim && !opts.restart) return;
    this.anim = anim;
    this.animT = 0;
    this.animOpts = opts;
  }

  say(on) { this.talking = on; }

  emote(name) { this.emoteName = name; }

  look(target) { this.lookTarget = target; }

  point(target) {
    this.pointTarget = target;
    this.play('point');
  }

  // walk to a world-space x/z; resolves when there
  walkTo(x, z, speed = 1.1) {
    return new Promise((resolve) => {
      this.walk = { x, z, speed, resolve };
      this.play('walk');
    });
  }

  faceTo(x, z) {
    const p = this.root.position;
    this.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.t += dt;
    this.animT += dt;
    const t = this.t, at = this.animT;
    const tg = {}; // target rotations
    const set = (k, x = 0, y = 0, z = 0) => { tg[k] = { x, y, z }; };
    let bob = Math.sin(t * 2.2) * 0.006, lean = 0, twist = 0, sway = Math.sin(t * 1.1) * 0.02;
    let headX = Math.sin(t * 0.9) * 0.03, headY = Math.sin(t * 0.55) * 0.06, headZ = 0;
    // arms rest slightly out from the body
    set('shL', 0.02, 0, 0.12 + Math.sin(t * 2.2) * 0.02);
    set('shR', 0.02, 0, -0.12 - Math.sin(t * 2.2) * 0.02);
    set('elL', -0.15, 0, 0);
    set('elR', -0.15, 0, 0);
    set('hipL'); set('hipR'); set('kneeL'); set('kneeR');

    const a = this.anim;
    if (a === 'walk') {
      const f = t * 7.5;
      set('hipL', Math.sin(f) * 0.55); set('hipR', -Math.sin(f) * 0.55);
      set('kneeL', Math.max(0, -Math.sin(f + 1.2)) * 0.9); set('kneeR', Math.max(0, Math.sin(f + 1.2)) * 0.9);
      set('shL', -Math.sin(f) * 0.5, 0, 0.1); set('shR', Math.sin(f) * 0.5, 0, -0.1);
      set('elL', -0.4); set('elR', -0.4);
      bob = Math.abs(Math.sin(f)) * 0.035;
      lean = 0.06;
    } else if (a === 'wave') {
      const w = Math.sin(at * 9) * 0.45;
      set('shR', 0, 0, -2.6); set('elR', 0, 0, -0.35 + w);
      headZ = 0.08;
      if (at > (this.animOpts?.dur || 1.8)) this.play('idle');
    } else if (a === 'cheer') {
      const up = Math.abs(Math.sin(at * 6));
      set('shL', -0.2, 0, 2.6); set('shR', -0.2, 0, -2.6);
      set('elL', 0, 0, 0.3); set('elR', 0, 0, -0.3);
      bob = up * 0.09;
      set('kneeL', up * 0.3); set('kneeR', up * 0.3);
      if (at > (this.animOpts?.dur || 1.6)) this.play('idle');
    } else if (a === 'point') {
      // aim the right arm at the target
      let yaw = 0.4, pitch = 0;
      if (this.pointTarget) {
        const local = this.root.worldToLocal(this.pointTarget.clone());
        const d = local.sub(V(-0.15, this.hipY + 0.3, 0));
        yaw = Math.atan2(d.x, d.z);
        pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      }
      set('shR', -Math.PI / 2 - pitch * 0.9, 0, Math.max(-1.4, Math.min(0.2, yaw * 0.9)));
      set('elR', -0.05);
      twist = Math.max(-0.5, Math.min(0.5, yaw * 0.3));
      if (at > (this.animOpts?.dur || 2.2)) this.play('idle');
    } else if (a === 'think') {
      set('shR', -1.5, 0, -0.7); set('elR', 0, 0, -2.0);
      headZ = 0.15; headX = -0.08;
    } else if (a === 'clap') {
      const c = Math.sin(at * 14) * 0.25;
      set('shL', -1.2, 0, 0.5 + c); set('shR', -1.2, 0, -0.5 - c);
      set('elL', 0, 0, 1.3); set('elR', 0, 0, -1.3);
      if (at > (this.animOpts?.dur || 1.4)) this.play('idle');
    } else if (a === 'nod') {
      headX = Math.sin(at * 9) * 0.18;
      if (at > 1.0) this.play('idle');
    } else if (a === 'present') {
      // palms out, "look at this!"
      set('shL', -0.9, 0, 0.6); set('shR', -0.9, 0, -0.6);
      set('elL', -0.5); set('elR', -0.5);
      if (at > (this.animOpts?.dur || 1.8)) this.play('idle');
    } else if (a === 'hold') {
      // arms forward as if carrying
      set('shL', -0.9, 0, 0.25); set('shR', -0.9, 0, -0.25);
      set('elL', -0.7); set('elR', -0.7);
    } else if (a === 'sit') {
      set('hipL', -1.45); set('hipR', -1.45);
      set('kneeL', 1.45); set('kneeR', 1.45);
      set('shL', -0.3, 0, 0.2); set('shR', -0.3, 0, -0.2);
      set('elL', -0.9); set('elR', -0.9);
      bob = -(this.spec.age === 'kid' ? 0.2 : 0.3);
    } else if (a === 'kneel') {
      set('hipL', -1.3); set('hipR', 0.3);
      set('kneeL', 1.3); set('kneeR', 1.6);
      bob = -0.22;
      lean = 0.15;
      set('shL', -0.7, 0, 0.2); set('shR', -0.7, 0, -0.2);
      set('elL', -0.6); set('elR', -0.6);
    } else if (a === 'dance') {
      const f = t * 5;
      set('shL', -0.3, 0, 1.6 + Math.sin(f) * 0.4); set('shR', -0.3, 0, -1.6 + Math.sin(f) * 0.4);
      set('elL', 0, 0, 0.6); set('elR', 0, 0, -0.6);
      sway = Math.sin(f) * 0.12;
      bob = Math.abs(Math.sin(f)) * 0.04;
      set('kneeL', Math.max(0, Math.sin(f)) * 0.4); set('kneeR', Math.max(0, -Math.sin(f)) * 0.4);
    } else if (a === 'play-guitar') {
      set('shL', -1.0, 0, 0.6); set('elL', 0, 0, 1.4);
      set('shR', -0.7, 0, -0.3 + Math.sin(t * 10) * 0.08); set('elR', -0.6);
      headZ = 0.12; headX = 0.1;
    } else if (a === 'sad') {
      headX = 0.25; bob = -0.01;
    }

    // talking: little head bobs + hand beats
    if (this.talking) {
      headX += Math.sin(t * 6.3) * 0.04;
      headZ += Math.sin(t * 2.7) * 0.04;
      if (a === 'idle') {
        set('shL', -0.25 + Math.sin(t * 3.1) * 0.12, 0, 0.2);
        set('elL', -0.7 + Math.sin(t * 3.1) * 0.2);
      }
    }

    // look-at: turn the head (and a bit of the torso) toward a world point
    if (this.lookTarget) {
      const local = this.root.worldToLocal(this.lookTarget.clone());
      const headPos = V(0, this.height * 0.82 / (this.spec.height || 1), 0);
      const d = local.sub(headPos);
      const yaw = Math.max(-1.0, Math.min(1.0, Math.atan2(d.x, d.z)));
      const pitch = Math.max(-0.5, Math.min(0.4, Math.atan2(d.y, Math.hypot(d.x, d.z))));
      headY = yaw * 0.75;
      headX += -pitch * 0.8;
      twist += yaw * 0.2;
    }

    // ease joints toward targets
    for (const [k, o] of Object.entries(this.j)) {
      if (k === 'hips' || k === 'spine' || k === 'neck' || k === 'head') continue;
      const g = tg[k] || { x: 0, y: 0, z: 0 };
      const c = this.cur[k];
      const kk = a === 'walk' ? 18 : 9;
      c.x = damp(c.x, g.x, kk, dt); c.y = damp(c.y, g.y, kk, dt); c.z = damp(c.z, g.z, kk, dt);
      o.rotation.set(c.x, c.y, c.z);
    }
    const ease = (key, x, y, z, k = 8) => {
      const c = this.cur[key];
      c.x = damp(c.x, x, k, dt); c.y = damp(c.y, y, k, dt); c.z = damp(c.z, z, k, dt);
      this.j[key].rotation.set(c.x, c.y, c.z);
    };
    ease('head', headX, headY, headZ, 7);
    ease('spine', lean, twist, sway * 0.5, 6);
    this.body.position.y = damp(this.body.position.y, bob, 14, dt);
    if (this.braidL) this.braidL.rotation.z = Math.sin(t * 2) * 0.05 + (a === 'walk' ? Math.sin(t * 7.5) * 0.1 : 0);
    if (this.braidR) this.braidR.rotation.z = -Math.sin(t * 2) * 0.05 - (a === 'walk' ? Math.sin(t * 7.5) * 0.1 : 0);
    if (this.ponytail) this.ponytail.rotation.x = Math.sin(t * 2.4) * 0.06;

    // blink: the lid closes and opens over 0.12 s (never stretches past open)
    this.blinkT -= dt;
    let lid = 1;
    if (this.blinkT <= 0) this.blinkT = 2 + Math.random() * 3.5;
    else if (this.blinkT < 0.12) lid = Math.max(0.08, Math.abs(this.blinkT / 0.06 - 1));
    // emotes
    const e = this.emoteName;
    let browY = 0, browTilt = 0, open = 0, smileScale = 1;
    if (e === 'happy') { browY = 0.02; open = 0.55; }
    else if (e === 'laugh') { browY = 0.03; open = 0.9; lid = Math.min(lid, 0.45); }
    else if (e === 'surprised') { browY = 0.05; open = 0.7; }
    else if (e === 'sad') { browY = -0.01; browTilt = 0.35; smileScale = -0.6; }
    else if (e === 'thinking') { browTilt = -0.2; smileScale = 0.4; }
    else if (e === 'wink') { lid = 1; }
    if (this.talking) {
      this.talkAmt = damp(this.talkAmt, 0.25 + Math.abs(Math.sin(t * 13) * Math.sin(t * 5.3)) * 0.75, 30, dt);
    } else {
      this.talkAmt = damp(this.talkAmt, 0, 20, dt);
    }
    const mo = Math.max(open, this.talkAmt);
    this.mouth.open.visible = mo > 0.08;
    this.mouth.open.scale.set(0.85 + mo * 0.15, Math.max(0.05, mo), 1);
    this.mouth.smile.visible = mo < 0.35;
    this.mouth.smile.scale.y = smileScale;
    for (const ey of this.eyes) {
      const l = e === 'wink' && ey.side < 0 ? 0.1 : lid;
      ey.lid.scale.y = damp(ey.lid.scale.y, l, 40, dt);
      // pupils drift toward the look direction
      ey.look.position.x = damp(ey.look.position.x, headY * 0.03, 8, dt);
    }
    for (const b of this.brows) {
      b.g.position.y = damp(b.g.position.y, b.base.y + browY * this.R * 4, 10, dt);
      b.g.rotation.z = damp(b.g.rotation.z, b.side * browTilt, 10, dt);
    }

    // walking movement
    if (this.walk) {
      const p = this.root.position;
      const dx = this.walk.x - p.x, dz = this.walk.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.04) {
        const r = this.walk.resolve;
        this.walk = null;
        this.play('idle');
        r();
      } else {
        const step = Math.min(dist, this.walk.speed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        const want = Math.atan2(dx, dz);
        let d = want - this.root.rotation.y;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        this.root.rotation.y += d * Math.min(1, dt * 10);
      }
    }
  }
}

function rngLocal(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ------------------------------------------------------------------ Chispa the Xolo
export class Xolo {
  constructor({ skin = '#55525f', collar = PAL.marigold } = {}) {
    this.name = 'Chispa';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.t = 0;
    this.anim = 'idle';
    this.animT = 0;
    this.talking = false;
    this.lookTarget = null;
    this.walk = null;
    this.blinkT = 2;
    this.j = {};
    const sk = toon(skin);
    const belly = toon(shade(skin, 22));
    const dark = toon(shade(skin, -25));

    const torso = capsule(0.11, 0.22, sk, 18);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(0.95, 1, 1);
    torso.position.y = 0.36;
    this.body.add(torso);
    const chest = sphere(0.12, sk, 18);
    chest.position.set(0, 0.39, 0.15);
    this.body.add(chest);
    const tummy = sphere(0.09, belly, 14);
    tummy.scale.set(1, 0.6, 1.6);
    tummy.position.set(0, 0.29, 0.02);
    this.body.add(tummy);

    // legs: front pair at z=+0.15, back pair at z=-0.15
    const legs = [['fl', 0.07, 0.17], ['fr', -0.07, 0.17], ['bl', 0.07, -0.16], ['br', -0.07, -0.16]];
    for (const [k, x, z] of legs) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.33, z);
      this.body.add(hip);
      const up = capsule(0.035, 0.12, sk, 10);
      up.position.y = -0.08;
      hip.add(up);
      const knee = new THREE.Group();
      knee.position.y = -0.16;
      hip.add(knee);
      const low = capsule(0.028, 0.12, sk, 10);
      low.position.y = -0.07;
      knee.add(low);
      const paw = sphere(0.04, dark, 10);
      paw.scale.set(1, 0.6, 1.3);
      paw.position.set(0, -0.15, 0.015);
      knee.add(paw);
      this.j[k] = hip;
      this.j[k + 'k'] = knee;
    }

    // tail: chain of segments that wag
    const tail = new THREE.Group();
    tail.position.set(0, 0.42, -0.25);
    this.body.add(tail);
    let parent = tail;
    this.tailSegs = [];
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0 : 0.055, 0);
      parent.add(seg);
      const m = capsule(0.022 - i * 0.003, 0.04, sk, 8);
      m.position.y = 0.03;
      seg.add(m);
      this.tailSegs.push(seg);
      parent = seg;
    }
    tail.rotation.x = -0.9;
    this.tail = tail;

    // neck + head
    const neck = new THREE.Group();
    neck.position.set(0, 0.44, 0.2);
    this.body.add(neck);
    const neckM = capsule(0.06, 0.1, sk, 12);
    neckM.position.set(0, 0.06, 0.02);
    neckM.rotation.x = 0.5;
    neck.add(neckM);
    const collarRing = mesh(new THREE.TorusGeometry(0.068, 0.018, 8, 20), toon(collar));
    collarRing.position.set(0, 0.06, 0.03);
    collarRing.rotation.x = Math.PI / 2 + 0.5;
    neck.add(collarRing);
    // little marigold tag
    const tag = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const pet = sphere(0.014, toon(PAL.gold), 6);
      const a2 = (k / 6) * TAU;
      pet.position.set(Math.cos(a2) * 0.014, Math.sin(a2) * 0.014, 0);
      tag.add(pet);
    }
    tag.position.set(0, 0.0, 0.1);
    neck.add(tag);
    const head = new THREE.Group();
    head.position.set(0, 0.16, 0.05);
    neck.add(head);
    this.j.neck = neck;
    this.j.head = head;
    const skull = sphere(0.12, sk, 24);
    skull.scale.set(1, 0.95, 1);
    head.add(skull);
    const snout = capsule(0.065, 0.08, sk, 14);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.035, 0.12);
    head.add(snout);
    const nose = sphere(0.03, toon('#1b1418'), 10);
    nose.scale.set(1.2, 0.9, 1);
    nose.position.set(0, -0.015, 0.215);
    head.add(nose);
    // big bat ears
    this.ears = [];
    for (const side of [1, -1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 0.075, 0.08, -0.01);
      ear.rotation.z = -side * 0.28;
      head.add(ear);
      const shape = new THREE.Shape();
      shape.moveTo(-0.055, 0);
      shape.quadraticCurveTo(-0.05, 0.15, 0, 0.2);
      shape.quadraticCurveTo(0.05, 0.15, 0.055, 0);
      shape.lineTo(-0.055, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
      const outer = mesh(geo, sk);
      ear.add(outer);
      const innerShape = new THREE.Shape();
      innerShape.moveTo(-0.032, 0.02);
      innerShape.quadraticCurveTo(-0.03, 0.12, 0, 0.16);
      innerShape.quadraticCurveTo(0.03, 0.12, 0.032, 0.02);
      innerShape.lineTo(-0.032, 0.02);
      const inner = mesh(new THREE.ShapeGeometry(innerShape), toon('#c98a9a'), { cast: false });
      inner.position.z = 0.02;
      inner.userData.noOutline = true;
      ear.add(inner);
      this.ears.push({ g: ear, side });
    }
    // tuft of hair
    for (let i = 0; i < 5; i++) {
      const tuft = sphere(0.03, toon('#d9d4dd'), 8);
      tuft.position.set((i - 2) * 0.018, 0.115 + Math.sin(i) * 0.01, 0.0 - Math.abs(i - 2) * 0.01);
      head.add(tuft);
    }
    // eyes
    this.eyes = [];
    for (const side of [1, -1]) {
      const eg = new THREE.Group();
      eg.position.set(side * 0.055, 0.025, 0.095);
      eg.rotation.y = side * 0.38;
      head.add(eg);
      const sclera = sphere(0.04, toon('#ffffff', { rim: 0 }), 14);
      sclera.scale.set(0.95, 1.1, 0.55);
      eg.add(sclera);
      const iris = mesh(new THREE.CircleGeometry(0.027, 16), flat('#5a3a1c'), { cast: false });
      iris.position.z = 0.023;
      eg.add(iris);
      const pupil = mesh(new THREE.CircleGeometry(0.016, 12), flat('#0a0606'), { cast: false });
      pupil.position.z = 0.024;
      eg.add(pupil);
      const shine = mesh(new THREE.CircleGeometry(0.008, 8), flat('#ffffff'), { cast: false });
      shine.position.set(0.008, 0.01, 0.025);
      eg.add(shine);
      for (const o of [iris, pupil, shine]) o.userData.noOutline = true;
      this.eyes.push(eg);
    }
    // mouth: smile line + open mouth with tongue
    const mouth = new THREE.Group();
    mouth.position.set(0, -0.07, 0.165);
    head.add(mouth);
    const smile = tube([[-0.035, 0.008, 0], [0, -0.01, 0.006], [0.035, 0.008, 0]], 0.005, toon('#1b1418'), 8);
    mouth.add(smile);
    const tongue = sphere(0.022, toon('#e8707e'), 10);
    tongue.scale.set(1, 0.4, 1.4);
    tongue.position.set(0, -0.022, 0.0);
    tongue.visible = false;
    mouth.add(tongue);
    this.tongue = tongue;
    this.smile = smile;

    this.smile.userData.keep = true;
    mergeByParent(this.root);
    outline(this.root, 0.006);
    this.cur = {};
    for (const [k, o] of Object.entries(this.j)) this.cur[k] = { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z };
    this.height = 0.62;
  }

  play(anim, opts = {}) {
    if (this.anim === anim && !opts.restart) return;
    this.anim = anim;
    this.animT = 0;
    this.animOpts = opts;
  }

  say(on) { this.talking = on; }
  emote() {}
  look(target) { this.lookTarget = target; }
  faceTo(x, z) {
    const p = this.root.position;
    this.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  }

  walkTo(x, z, speed = 1.6) {
    return new Promise((resolve) => {
      this.walk = { x, z, speed, resolve };
      this.play('trot');
    });
  }

  update(dt) {
    this.t += dt;
    this.animT += dt;
    const t = this.t, at = this.animT;
    const tg = {};
    const set = (k, x = 0, y = 0, z = 0) => { tg[k] = { x, y, z }; };
    let bob = 0, pitch = 0, headX = Math.sin(t * 1.3) * 0.05, headY = Math.sin(t * 0.7) * 0.15, headZ = 0;
    let wag = Math.sin(t * 9) * 0.35, tailLift = -0.9, tongue = false;
    for (const k of ['fl', 'fr', 'bl', 'br', 'flk', 'frk', 'blk', 'brk']) set(k);
    set('neck');
    const a = this.anim;
    if (a === 'trot') {
      const f = t * 11;
      set('fl', Math.sin(f) * 0.6); set('br', Math.sin(f) * 0.6);
      set('fr', -Math.sin(f) * 0.6); set('bl', -Math.sin(f) * 0.6);
      set('flk', Math.max(0, Math.sin(f + 1)) * 0.6); set('frk', Math.max(0, -Math.sin(f + 1)) * 0.6);
      bob = Math.abs(Math.sin(f)) * 0.03;
      wag = Math.sin(t * 14) * 0.5;
      tongue = true;
    } else if (a === 'sit') {
      set('bl', -1.2); set('br', -1.2); set('blk', 1.9); set('brk', 1.9);
      set('fl', 0.15); set('fr', 0.15);
      pitch = -0.55;
      bob = -0.06;
      tailLift = -1.6;
    } else if (a === 'happy') {
      wag = Math.sin(t * 22) * 0.7;
      bob = Math.abs(Math.sin(at * 9)) * 0.06;
      tongue = true;
      if (at > (this.animOpts?.dur || 2)) this.play('idle');
    } else if (a === 'jump') {
      const h = Math.max(0, Math.sin(Math.min(at, 0.6) / 0.6 * Math.PI));
      bob = h * 0.3;
      set('fl', -0.8 * h); set('fr', -0.8 * h); set('bl', 0.7 * h); set('br', 0.7 * h);
      wag = Math.sin(t * 22) * 0.7;
      tongue = true;
      if (at > 0.7) this.play(this.animOpts?.then || 'happy');
    } else if (a === 'sniff') {
      headX = 0.5 + Math.sin(t * 18) * 0.05;
      pitch = 0.12;
    } else if (a === 'bark') {
      headX = -0.25;
      tongue = at % 0.5 < 0.25;
      if (at > 1) this.play('happy');
    } else if (a === 'lie') {
      set('fl', -1.4); set('fr', -1.4); set('bl', 1.3); set('br', 1.3);
      set('flk', 0.2); set('frk', 0.2);
      bob = -0.2;
      wag = Math.sin(t * 4) * 0.2;
      tailLift = -1.4;
    } else if (a === 'tilt') {
      headZ = 0.35;
      if (at > 1.4) this.play('idle');
    }
    if (this.talking) { tongue = Math.sin(t * 16) > 0; wag = Math.sin(t * 20) * 0.7; }

    if (this.lookTarget) {
      const local = this.root.worldToLocal(this.lookTarget.clone());
      const d = local.sub(V(0, 0.6, 0.25));
      headY = Math.max(-1, Math.min(1, Math.atan2(d.x, d.z))) * 0.8;
      headX += -Math.max(-0.5, Math.min(0.5, Math.atan2(d.y, Math.hypot(d.x, d.z)))) * 0.8;
    }

    for (const [k, o] of Object.entries(this.j)) {
      if (k === 'head' || k === 'neck') continue;
      const g = tg[k] || { x: 0, y: 0, z: 0 };
      const c = this.cur[k];
      c.x = damp(c.x, g.x, 14, dt); c.y = damp(c.y, g.y, 14, dt); c.z = damp(c.z, g.z, 14, dt);
      o.rotation.set(c.x, c.y, c.z);
    }
    const ch = this.cur.head;
    ch.x = damp(ch.x, headX, 8, dt); ch.y = damp(ch.y, headY, 8, dt); ch.z = damp(ch.z, headZ, 8, dt);
    this.j.head.rotation.set(ch.x, ch.y, ch.z);
    this.body.position.y = damp(this.body.position.y, bob, 14, dt);
    this.body.rotation.x = damp(this.body.rotation.x, pitch, 8, dt);
    this.tail.rotation.x = damp(this.tail.rotation.x, tailLift, 6, dt);
    this.tailSegs.forEach((s, i) => { s.rotation.z = wag * (0.4 + i * 0.15); s.rotation.x = -0.15; });
    for (const e of this.ears) e.g.rotation.x = Math.sin(t * 3 + e.side) * 0.05 + (a === 'tilt' ? 0.2 : 0);
    this.tongue.visible = tongue;
    // blink
    this.blinkT -= dt;
    const lid = this.blinkT < 0.1 ? 0.1 : 1;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = lid;

    if (this.walk) {
      const p = this.root.position;
      const dx = this.walk.x - p.x, dz = this.walk.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.04) {
        const r = this.walk.resolve;
        this.walk = null;
        this.play('idle');
        r();
      } else {
        const step = Math.min(dist, this.walk.speed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        const want = Math.atan2(dx, dz);
        let d = want - this.root.rotation.y;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        this.root.rotation.y += d * Math.min(1, dt * 10);
      }
    }
  }
}

// townsfolk: varied, everyday people for crowds (seeded so they stay the same)
const SKINS = ['#f1c9a0', '#e0ac7e', '#c68a5c', '#b07448', '#9c6038', '#7e4a2b', '#5e3a25', '#d39a6a'];
const HAIRS = ['#1a120c', '#2b1a12', '#3b2417', '#5a3a26', '#1d1d24', '#d6d1ca'];
const TOPS = [PAL.rosa, PAL.turquoise, PAL.gold, PAL.lime, PAL.cobalt, '#e9e2cf', PAL.purple, PAL.red, '#3d8f5a', '#f26b1d', '#ffffff'];
const BOTTOMS = ['#2f4f8a', '#3b3b46', '#5b4636', '#2c6e63', PAL.purple, '#6b2a3a', '#1f2a44'];
export function townSpec(seed) {
  let x = seed * 9301 + 49297;
  const r = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  const pick = (a) => a[Math.floor(r() * a.length)];
  const age = pick(['adult', 'adult', 'adult', 'elder', 'kid']);
  const fem = r() > 0.5;
  const style = fem ? pick(['long', 'ponytail', 'bob', 'braid', 'bun']) : pick(['short', 'short', 'curly', 'bald']);
  const skin = pick(SKINS);
  const spec = {
    name: 'Vecino', age, build: pick(['slim', 'avg', 'avg', 'round']), skin, eyes: '#2e1c10',
    hair: { style: age === 'elder' && style !== 'bald' ? (fem ? 'bun' : 'short') : style, color: age === 'elder' ? '#d6d1ca' : pick(HAIRS), ribbon: pick(TOPS) },
    top: { color: pick(TOPS), sleeves: r() > 0.5 ? 'long' : 'short' },
    bottom: { kind: fem ? pick(['long', 'skirt', 'pants']) : (age === 'kid' ? 'shorts' : 'pants'), color: pick(BOTTOMS) },
    legs: skin, socks: '#ffffff', shoes: pick(['#2a201b', '#3a2b26', PAL.red, '#ffffff']),
    extras: [],
  };
  if (r() > 0.75) spec.extras.push('glasses');
  if (fem && r() > 0.5) spec.extras.push('earrings');
  if (!fem && age !== 'kid' && r() > 0.7) spec.extras.push('beard');
  if (fem && age !== 'kid' && r() > 0.65) { spec.extras.push('rebozo'); spec.rebozo = [pick(['#1d5f8f', '#6a2a5a', '#2c6e63', '#7a3b2e']), '#e9e4da']; }
  if (age === 'elder' && !fem && r() > 0.5) { spec.extras.push('hat'); spec.hatColor = pick(['#4a3a2c', '#d8c08a', '#2a2a30']); }
  return spec;
}

export function makeCharacter(id) {
  if (id === 'chispa') return new Xolo();
  if (typeof id === 'number') return new Person(townSpec(id));
  return new Person(CAST[id]);
}
