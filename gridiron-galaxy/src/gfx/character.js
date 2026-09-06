// Parametric toon football players: one builder, 31 species, procedural animation. Feet at y=0, faces +z.
import * as THREE from '../../vendor/three.module.js';
import { getSpecies } from '../data/species.js';
import { gradientMap, numberTexture, emblemTexture, canvas } from './textures.js';
import { makeRng, hashStr, shade, clamp, lerp, damp, textOn, mix } from '../util.js';

const geoCache = new Map();
const G = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const sphere = (r, w = 24, h = 16) => G(`s${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
const capsule = (r, l, rs = 16) => G(`c${r}_${l}_${rs}`, () => new THREE.CapsuleGeometry(r, l, 6, rs));
const box = (x, y, z) => G(`b${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (rt, rb, h, s = 16) => G(`y${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 16) => G(`k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
const torus = (r, t, arc = Math.PI * 2, ts = 32) => G(`t${r}_${t}_${arc}_${ts}`, () => new THREE.TorusGeometry(r, t, 8, ts, arc));
const ico = (r) => G(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0));
const plane = (w, h) => G(`p${w}_${h}`, () => new THREE.PlaneGeometry(w, h));

const matCache = new Map();
export function toonMat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!matCache.has(key)) { const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts }); if (opts.opacity !== undefined && opts.opacity < 1) { m.transparent = true; } matCache.set(key, m); }
  return matCache.get(key);
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#141a2e', side: THREE.BackSide });
let outlinesEnabled = true;
export function setOutlines(on) { outlinesEnabled = on; }

function M(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
function outline(mesh, r) { if (!outlinesEnabled) return null; const o = new THREE.Mesh(mesh.geometry, OUTLINE); const k = 1 + 0.03 / Math.max(0.05, r); o.scale.set(k, k, k); mesh.add(o); return o; }
function shadowOff(m) { m.castShadow = false; return m; }

export function buildBall() {
  const g = new THREE.Group();
  const b = M(sphere(0.15, 20, 14), toonMat('#8a4a1e')); b.scale.set(1, 0.62, 0.62); g.add(b); outline(b, 0.15);
  const lace = toonMat('#f4f4f4');
  for (let i = -1; i <= 1; i++) { const l = M(box(0.012, 0.012, 0.05), lace, i * 0.03, 0.09, 0); g.add(l); }
  g.add(M(box(0.11, 0.012, 0.012), lace, 0, 0.09, 0));
  for (const s of [-1, 1]) { const band = M(torus(0.075, 0.008), lace, s * 0.09, 0, 0); band.rotation.y = Math.PI / 2; g.add(band); }
  g.userData.isBall = true;
  return g;
}

const DIM = { hipY: 0.64, thigh: 0.3, shin: 0.27, torsoH: 0.58, torsoR: 0.24, headR: 0.33, armUp: 0.26, armLo: 0.23, handR: 0.075 };
const LIMB_R = { normal: 0.085, thin: 0.06, thick: 0.11, mech: 0.09, wisp: 0.07 };

export class Character {
  constructor(opts) {
    this.opts = opts; this.sp = getSpecies(opts.species); this.team = opts.team;
    this.rnd = makeRng(hashStr(opts.id || 'x'));
    this.skin = opts.skin || this.sp.skin[(opts.skinIndex || 0) % this.sp.skin.length];
    this.group = new THREE.Group(); this.group.userData.character = this;
    this.joints = {};
    this.anim = { state: 'idle', t: 0, phase: this.rnd() * 6, speed: 0, celebrate: 0, blink: 0, lookX: 0, lookY: 0 };
    this.cur = {}; // smoothed joint targets
    this._build();
  }
  _build() {
    const sp = this.sp, team = this.team, D = DIM; const [pri, sec] = team.colors;
    const bodyScale = (sp.body.scale || [1, 1, 1]);
    const limbR = LIMB_R[sp.limbs.style] || 0.085;
    const skinMat = toonMat(this.skin, { ...(sp.glow ? { emissive: sp.glow, emissiveIntensity: 0.25 } : {}), ...(sp.body.opacity !== undefined ? { opacity: sp.body.opacity } : {}) });
    const jersey = toonMat(pri), sleeve = toonMat(sec), pants = toonMat(shade(sec, 0.15)), sockMat = toonMat(sp.id === 'kid' || sp.helmet ? '#f4f4f8' : this.skin), cleat = toonMat(sp.features.includes('feet:orange') ? '#ffb84d' : '#23233a');
    const isMech = sp.limbs.style === 'mech'; const isWisp = sp.body.shape === 'wisp';
    const root = this.group;
    // ---- hips & legs ----
    const hips = new THREE.Group(); hips.position.y = D.hipY * bodyScale[1]; root.add(hips); this.joints.hips = hips;
    if (!isWisp) {
      for (const side of [-1, 1]) {
        const thigh = new THREE.Group(); thigh.position.set(side * 0.13 * bodyScale[0], 0, 0); hips.add(thigh);
        const tm = isMech ? M(box(limbR * 1.8, D.thigh, limbR * 1.8), pants, 0, -D.thigh / 2, 0) : M(capsule(limbR * 1.15, D.thigh - limbR), pants, 0, -D.thigh / 2, 0);
        thigh.add(tm); outline(tm, limbR);
        const knee = new THREE.Group(); knee.position.y = -D.thigh; thigh.add(knee);
        const sm = isMech ? M(box(limbR * 1.5, D.shin, limbR * 1.5), skinMat, 0, -D.shin / 2, 0) : M(capsule(limbR, D.shin - limbR), sp.helmet ? sockMat : skinMat, 0, -D.shin / 2, 0);
        knee.add(sm); outline(sm, limbR);
        const foot = M(box(0.16, 0.1, 0.27), sp.features.includes('treads') ? toonMat('#3a3f4a') : cleat, 0, -D.shin - 0.02, 0.05); knee.add(foot); outline(foot, 0.1);
        this.joints['thigh' + (side < 0 ? 'L' : 'R')] = thigh; this.joints['knee' + (side < 0 ? 'L' : 'R')] = knee;
      }
    } else {
      const w = M(cone(D.torsoR * 1.1, D.hipY * 1.1), skinMat, 0, -D.hipY * 0.45, 0); w.rotation.x = Math.PI; hips.add(w); outline(w, 0.2);
    }
    // ---- torso ----
    const torso = new THREE.Group(); hips.add(torso); this.joints.torso = torso;
    const th = D.torsoH * bodyScale[1], tr = D.torsoR * bodyScale[0];
    let body;
    switch (sp.body.shape) {
      case 'round': body = M(sphere(0.33), jersey, 0, th * 0.5, 0); body.scale.set(bodyScale[0] * 1.05, bodyScale[1] * 0.95, bodyScale[2] * 0.98); break;
      case 'box': body = M(box(tr * 2.1, th, tr * 1.7), jersey, 0, th * 0.5, 0); break;
      case 'blob': body = M(sphere(0.33), jersey, 0, th * 0.48, 0); body.scale.set(1.2 * bodyScale[0], 0.9 * bodyScale[1], 1.1 * bodyScale[2]); break;
      case 'wisp': body = M(sphere(0.3), jersey, 0, th * 0.5, 0); body.scale.set(1.1, 1, 1); break;
      default: body = M(capsule(tr, Math.max(0.05, th - 2 * tr)), jersey, 0, th * 0.5, 0); body.scale.set(1, 1, bodyScale[2] * 0.9);
    }
    torso.add(body); outline(body, tr); this.body = body;
    const bodyZ = (sp.body.shape === 'round' || sp.body.shape === 'blob') ? 0.33 * bodyScale[2] : tr * (sp.body.shape === 'box' ? 0.85 : 0.9) * bodyScale[2];
    // shoulder pads
    for (const s of [-1, 1]) { const pad = M(sphere(0.13), jersey, s * (tr + 0.06), th - 0.03, 0); torso.add(pad); outline(pad, 0.13); }
    // stripes / belly / plates
    if (sp.features.includes('stripes')) for (let i = 0; i < 3; i++) { const st = M(torus(tr * 1.02, 0.03), toonMat(sp.accent), 0, th * 0.25 + i * 0.13, 0); st.rotation.x = Math.PI / 2; st.scale.set(1, 1, bodyScale[2] * 0.9); torso.add(st); }
    if (sp.features.includes('belly')) { const b = M(sphere(0.2), toonMat(sp.belly || '#f4f4f4'), 0, th * 0.42, bodyZ * 0.55); b.scale.set(1, 1.15, 0.6); torso.add(b); }
    if (sp.features.includes('plates')) for (let i = 0; i < 3; i++) { const p = M(box(tr * 1.6, 0.07, 0.06), toonMat(shade(this.skin, -0.25)), 0, th * 0.2 + i * 0.16, bodyZ * 0.95); torso.add(p); }
    if (sp.features.includes('shell:pizza')) { const sh = M(sphere(0.34, 24, 16, ), toonMat('#e0a040'), 0, th * 0.5, -bodyZ * 0.6); sh.scale.set(1.15, 1.05, 0.7); torso.add(sh); outline(sh, 0.34); const sauce = M(sphere(0.3), toonMat('#c8282a'), 0, th * 0.5, -bodyZ * 0.72); sauce.scale.set(1.05, 0.95, 0.55); torso.add(sauce); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; const pep = M(sphere(0.045), toonMat('#8a1a1c'), Math.cos(a) * 0.17, th * 0.5 + Math.sin(a) * 0.17, -bodyZ * 1.02); torso.add(pep); } }
    if (sp.features.includes('gear')) { const gear = M(cyl(0.12, 0.12, 0.06, 12), toonMat('#8a919c'), tr + 0.02, th + 0.06, -0.02); gear.rotation.z = Math.PI / 2; torso.add(gear); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const t = M(box(0.05, 0.05, 0.05), toonMat('#8a919c'), tr + 0.02, th + 0.06 + Math.sin(a) * 0.13, -0.02 + Math.cos(a) * 0.13); torso.add(t); } }
    if (sp.features.includes('smokestack')) { const st = M(cyl(0.05, 0.06, 0.28, 10), toonMat('#3a3a44'), -tr - 0.02, th + 0.12, -0.05); torso.add(st); }
    if (sp.features.includes('key')) { const k = M(box(0.04, 0.18, 0.04), toonMat('#8a6a1a'), 0, th * 0.55, -bodyZ - 0.1); torso.add(k); const kh = M(torus(0.07, 0.02), toonMat('#8a6a1a'), 0, th * 0.55 + 0.14, -bodyZ - 0.1); torso.add(kh); }
    if (sp.features.includes('clockface')) { const cf = M(plane(0.3, 0.3), new THREE.MeshBasicMaterial({ map: clockTexture(), transparent: true }), 0, th * 0.5, bodyZ + 0.02); torso.add(cf); }
    if (sp.features.includes('bowtie')) { const bt = toonMat('#e0115f'); for (const s of [-1, 1]) { const w = M(box(0.09, 0.07, 0.04), bt, s * 0.06, th - 0.02, bodyZ * 0.8); torso.add(w); } }
    if (sp.features.includes('wings:small') || sp.features.includes('wings:clear') || sp.features.includes('wings:feather')) {
      const clear = sp.features.includes('wings:clear'); const wm = clear ? toonMat('#e8f8ff', { opacity: 0.55 }) : toonMat(sp.features.includes('wings:feather') ? shade(this.skin, 0.2) : '#ffffff');
      for (const s of [-1, 1]) { const w = M(sphere(0.16), wm, s * 0.2, th * 0.7, -bodyZ - 0.05); w.scale.set(1.1, 0.35, 0.5); w.rotation.z = s * 0.5; torso.add(w); this.joints['wing' + (s < 0 ? 'L' : 'R')] = w; }
    }
    if (sp.features.includes('fin:dorsal')) { const f = M(box(0.04, 0.22, 0.2), toonMat(sp.accent), 0, th * 0.75, -bodyZ - 0.06); f.rotation.x = -0.4; torso.add(f); }
    if (sp.features.includes('stinger')) { const st = M(cone(0.06, 0.2, 10), toonMat('#1c1c1c'), 0, th * 0.25, -bodyZ - 0.1); st.rotation.x = -Math.PI / 2 - 0.4; torso.add(st); }
    if (sp.features.includes('shards')) for (const s of [-1, 1]) { const sh = M(ico(0.13), toonMat(mix(this.skin, '#ffffff', 0.3), { opacity: 0.9 }), s * (tr + 0.1), th + 0.1, 0); sh.scale.set(0.7, 1.6, 0.7); sh.rotation.z = -s * 0.3; torso.add(sh); }
    if (sp.features.includes('leaves')) for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; const lf = M(sphere(0.12), toonMat('#3f9b3f'), Math.cos(a) * (tr + 0.05), th * 0.35, Math.sin(a) * (tr + 0.05)); lf.scale.set(1, 0.35, 1.8); lf.rotation.y = -a; torso.add(lf); }
    if (sp.features.includes('balloon')) { body.scale.multiplyScalar(1.0); }
    if (sp.features.includes('patches')) for (let i = 0; i < 3; i++) { const p = M(box(0.12, 0.1, 0.03), toonMat(['#a0632b', '#5d6068', '#e8c25a'][i]), (i - 1) * 0.15, th * (0.3 + i * 0.15), bodyZ * 0.9); torso.add(p); }
    if (sp.features.includes('rivets')) for (let i = 0; i < 6; i++) { const r = M(sphere(0.025), toonMat('#ffe08a'), -tr * 0.8 + (i % 3) * tr * 0.8, th * (i < 3 ? 0.2 : 0.8), bodyZ * 0.95); torso.add(r); }
    // numbers
    if (this.opts.num !== undefined && this.opts.num !== null) {
      const nm = new THREE.MeshBasicMaterial({ map: numberTexture(this.opts.num, textOn(pri) === '#ffffff' ? '#ffffff' : sec, shade(pri, -0.5)), transparent: true, depthWrite: false });
      const front = shadowOff(M(plane(0.36, 0.36), nm, 0, th * 0.55, bodyZ + 0.012)); torso.add(front);
      const back = shadowOff(M(plane(0.36, 0.36), nm, 0, th * 0.6, -bodyZ - 0.012)); back.rotation.y = Math.PI; torso.add(back);
    }
    // ---- arms ----
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * (tr + 0.08), th - 0.06, 0); torso.add(sh);
      const isPincer = sp.features.includes('pincers'); const isFlipper = sp.features.includes('flippers');
      const up = isMech ? M(box(limbR * 1.7, D.armUp, limbR * 1.7), sleeve, 0, -D.armUp / 2, 0) : M(capsule(limbR * 1.05, D.armUp - limbR), sleeve, 0, -D.armUp / 2, 0);
      sh.add(up); outline(up, limbR);
      const el = new THREE.Group(); el.position.y = -D.armUp; sh.add(el);
      const lo = isFlipper ? M(box(0.06, D.armLo + 0.1, 0.16), skinMat, 0, -D.armLo / 2, 0) : isMech ? M(box(limbR * 1.5, D.armLo, limbR * 1.5), skinMat, 0, -D.armLo / 2, 0) : M(capsule(limbR * 0.95, D.armLo - limbR), skinMat, 0, -D.armLo / 2, 0);
      el.add(lo); outline(lo, limbR);
      if (sp.features.includes('fin:arms')) { const f = M(box(0.03, 0.14, 0.12), toonMat(sp.accent), side * 0.05, -D.armLo / 2, -0.06); el.add(f); }
      if (sp.features.includes('vines')) { const v = M(torus(limbR * 1.3, 0.02), toonMat('#2f7a32'), 0, -D.armLo * 0.4, 0); v.rotation.x = Math.PI / 2; el.add(v); }
      const hand = new THREE.Group(); hand.position.y = -D.armLo; el.add(hand);
      if (isPincer) { const c1 = M(box(0.07, 0.16, 0.09), toonMat(shade(this.skin, -0.2)), -0.04, -0.06, 0); c1.rotation.z = 0.35; hand.add(c1); const c2 = M(box(0.07, 0.16, 0.09), toonMat(shade(this.skin, -0.2)), 0.04, -0.06, 0); c2.rotation.z = -0.35; hand.add(c2); }
      else if (!isFlipper) { const hm = M(sphere(D.handR * (sp.limbs.style === 'thick' ? 1.3 : 1)), this.opts.gloves ? toonMat(sec) : skinMat); hand.add(hm); outline(hm, D.handR); }
      const key = side < 0 ? 'L' : 'R'; this.joints['shoulder' + key] = sh; this.joints['elbow' + key] = el; this.joints['hand' + key] = hand;
    }
    // ---- tail ----
    this._buildTail(hips, bodyZ);
    // ---- head ----
    const neck = new THREE.Group(); neck.position.y = th + 0.02; torso.add(neck); this.joints.neck = neck;
    const hs = sp.head.scale, hr = D.headR;
    const headG = new THREE.Group(); headG.position.y = hr * hs[1] * 0.95; neck.add(headG); this.joints.head = headG; this.headR = hr; this.hs = hs;
    let head;
    switch (sp.head.shape) {
      case 'box': head = M(box(hr * 1.9, hr * 1.8, hr * 1.9), skinMat); break;
      case 'gem': head = M(ico(hr * 1.15), toonMat(this.skin, { opacity: 0.92, emissive: sp.glow || '#000000', emissiveIntensity: 0.2 })); break;
      default: head = M(sphere(hr, 32, 24), skinMat);
    }
    const shapeScale = { egg: [1, 1.22, 1], wide: [1.15, 0.92, 1.05], flat: [1.2, 0.78, 1.1] }[sp.head.shape] || [1, 1, 1];
    head.scale.set(hs[0] * shapeScale[0], hs[1] * shapeScale[1], hs[2] * shapeScale[2]); headG.add(head); outline(head, hr); this.head = head;
    const sx = head.scale.x, sy = head.scale.y, sz = head.scale.z;
    this._buildFace(headG, hr, sx, sy, sz);
    if (sp.helmet) this._buildHelmet(headG, hr, sx, sy, sz); else this._buildHeadwear(headG, hr, sx, sy, sz);
    this._buildHeadFeatures(headG, hr, sx, sy, sz);
    root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  }
  _buildTail(hips, bodyZ) {
    const sp = this.sp; const f = sp.features.find(x => x.startsWith('tail:')); if (!f) return;
    const kind = f.split(':')[1]; const tail = new THREE.Group(); tail.position.set(0, 0.05, -bodyZ * 0.9); hips.add(tail); this.joints.tail = tail;
    const skin = toonMat(this.skin);
    if (kind === 'puff') { const p = M(sphere(0.12), toonMat('#ffffff'), 0, 0, -0.06); tail.add(p); outline(p, 0.12); }
    else if (kind === 'lizard' || kind === 'thick') { const t = M(cone(kind === 'thick' ? 0.16 : 0.11, 0.7, 12), skin, 0, -0.05, -0.32); t.rotation.x = -Math.PI / 2 + 0.35; tail.add(t); outline(t, 0.12); }
    else if (kind === 'long' || kind === 'thin' || kind === 'striped') { let prev = tail; for (let i = 0; i < 4; i++) { const seg = new THREE.Group(); seg.position.z = -0.14; seg.rotation.x = 0.35; prev.add(seg); const m = M(capsule(kind === 'thin' ? 0.03 : 0.05, 0.12), kind === 'striped' ? toonMat(i % 2 ? '#1a1a24' : '#8f8f9d') : skin, 0, 0, -0.07); m.rotation.x = Math.PI / 2; seg.add(m); prev = seg; } }
    else if (kind === 'fin') { const t = M(box(0.04, 0.22, 0.18), toonMat(sp.accent), 0, 0, -0.1); tail.add(t); }
    else if (kind === 'feathers') { for (let i = -1; i <= 1; i++) { const t = M(box(0.06, 0.03, 0.3), toonMat(['#e63946', '#2a9d8f', '#f4d35e'][i + 1]), i * 0.06, 0, -0.15); t.rotation.y = i * 0.3; t.rotation.x = 0.3; tail.add(t); } }
    else if (kind === 'stinger') { let prev = tail; for (let i = 0; i < 5; i++) { const seg = new THREE.Group(); seg.position.z = -0.13; seg.rotation.x = 0.5; prev.add(seg); const m = M(sphere(0.07 - i * 0.006), skin, 0, 0, -0.06); seg.add(m); prev = seg; } const st = M(cone(0.045, 0.16, 8), toonMat('#1c1c1c'), 0, 0, -0.14); st.rotation.x = -Math.PI / 2 - 0.5; prev.add(st); }
  }
  _buildFace(headG, hr, sx, sy, sz) {
    const sp = this.sp, e = sp.eyes; const eyeMat = toonMat(e.color && e.style === 'normal' ? e.color : '#ffffff'); const pupilMat = toonMat(e.pupil || '#101018');
    const layouts = { 0: [], 1: [[0, 0.06]], 2: [[-0.13, 0.05], [0.13, 0.05]], 3: [[-0.14, 0.03], [0.14, 0.03], [0, 0.2]], 4: [[-0.1, 0.02], [0.1, 0.02], [-0.19, 0.13], [0.19, 0.13]] };
    const pos = layouts[e.count] || layouts[2]; const size = e.size || 1; this.eyes = [];
    if (e.style === 'visor') { const v = M(box(hr * 1.7 * sx, 0.11, 0.06), toonMat(e.color || '#3ee8ff', { emissive: e.color || '#3ee8ff', emissiveIntensity: 0.8 }), 0, 0.04 * sy, hr * 0.9 * sz); headG.add(v); }
    else if (e.style === 'clock') { const cf = M(plane(hr * 1.6, hr * 1.6), new THREE.MeshBasicMaterial({ map: clockTexture(), transparent: true }), 0, 0.02, hr * 0.98 * sz); headG.add(cf); }
    for (const [px, py] of pos) {
      const ex = px * sx * hr / 0.33, ey = py * sy * hr / 0.33; const ez = Math.sqrt(Math.max(0.01, (hr * sz) ** 2 - (ex / sx * sz) ** 2 - (ey / sy * sz) ** 2 * 0.6)) * 0.98;
      const g = new THREE.Group(); g.position.set(ex, ey, ez); headG.add(g); this.eyes.push(g);
      const small = pos.length > 3 || e.count === 3 && py > 0.1 ? 0.7 : 1; const r = 0.085 * size * small;
      if (e.style === 'black') { const b = M(sphere(r * 1.25), toonMat('#0a0a12')); b.scale.set(1, e.size > 1.4 ? 1.5 : 1.1, 0.55); b.rotation.z = -Math.sign(px) * 0.35; g.add(b); const hl = M(sphere(r * 0.3), toonMat('#ffffff'), -r * 0.35 * Math.sign(px || 1), r * 0.5, r * 0.5); g.add(hl); }
      else if (e.style === 'glow') { const b = M(sphere(r * 1.05), toonMat(e.color || '#fff', { emissive: e.color || '#fff', emissiveIntensity: 0.9 })); g.add(b); if (e.pupil) { const p = M(sphere(r * 0.5), pupilMat, 0, 0, r * 0.7); g.add(p); } }
      else if (e.style === 'dot') { const b = M(sphere(r * 0.5), pupilMat); g.add(b); }
      else if (e.style === 'hollow') { const b = M(sphere(r * 1.1), toonMat('#1a1030')); b.scale.set(1, 1.3, 0.5); g.add(b); }
      else { const w = M(sphere(r, 16, 12), eyeMat); w.scale.set(1, 1.15, 0.7); g.add(w); const p = M(sphere(r * 0.55, 12, 8), pupilMat, 0, 0, r * 0.55); g.add(p); this.pupils = this.pupils || []; this.pupils.push(p); const hl = M(sphere(r * 0.22), toonMat('#ffffff'), r * 0.2, r * 0.3, r * 0.9); g.add(hl); }
    }
    // mouth
    const mz = hr * 0.98 * sz, my = -0.12 * sy * hr / 0.33; const dark = toonMat('#2a1a1a');
    const m = sp.mouth;
    if (m === 'smile' || m === 'smirk') { const s = M(torus(0.07, 0.014, Math.PI, 12), dark, m === 'smirk' ? 0.03 : 0, my + 0.03, mz); s.rotation.z = Math.PI; s.rotation.x = -0.2; headG.add(s); }
    else if (m === 'grin' || m === 'teeth') { const t = M(box(0.16, 0.05, 0.03), toonMat('#ffffff'), 0, my, mz); headG.add(t); const l = M(box(0.18, 0.012, 0.035), dark, 0, my + 0.03, mz); headG.add(l); }
    else if (m === 'buck') { const t = M(box(0.06, 0.06, 0.03), toonMat('#ffffff'), 0, my - 0.02, mz); headG.add(t); }
    else if (m === 'beak' || m === 'beak:big' || m === 'beak:curved') { const big = m === 'beak:big'; const b = M(cone(big ? 0.1 : 0.07, big ? 0.22 : 0.16, 12), toonMat(sp.accent || '#ffb347'), 0, my + 0.06, mz + 0.02); b.rotation.x = Math.PI / 2 + (m === 'beak:curved' ? 0.5 : 0.1); headG.add(b); outline(b, 0.08); }
    else if (m === 'snout' || m === 'snout:big') { const s = M(sphere(m === 'snout:big' ? 0.14 : 0.1), toonMat(shade(this.skin, 0.12)), 0, my + 0.03, mz); s.scale.set(1.2, 0.8, 1); headG.add(s); const n = M(sphere(0.035), dark, 0, my + 0.07, mz + 0.1); headG.add(n); }
    else if (m === 'fishlips') { const l = M(torus(0.06, 0.025), toonMat('#ff8fa0'), 0, my, mz); headG.add(l); }
    else if (m === 'ooo') { const o = M(sphere(0.045), dark, 0, my, mz); o.scale.set(1, 1.3, 0.6); headG.add(o); }
    else if (m === 'grill') { const g = M(box(0.2, 0.07, 0.03), toonMat('#1a1a24'), 0, my, mz); headG.add(g); for (let i = -1; i <= 1; i++) { const bar = M(box(0.01, 0.07, 0.035), toonMat(sp.accent), i * 0.06, my, mz); headG.add(bar); } }
    else if (m === 'mandible') { for (const s of [-1, 1]) { const md = M(cone(0.03, 0.1, 8), dark, s * 0.06, my, mz); md.rotation.x = Math.PI / 2; md.rotation.z = -s * 0.5; headG.add(md); } }
    else if (m === 'line') { const l = M(box(0.1, 0.012, 0.03), dark, 0, my, mz); headG.add(l); }
    else if (m === 'fangs') { for (const s of [-1, 1]) { const f = M(cone(0.02, 0.06, 6), toonMat('#fff'), s * 0.05, my - 0.03, mz); f.rotation.x = Math.PI; headG.add(f); } }
    if (sp.features.includes('nose:pink')) { const n = M(sphere(0.035), toonMat('#ff9bb0'), 0, my + 0.1, mz + 0.03); headG.add(n); }
    if (sp.features.includes('whiskers')) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const w = M(cyl(0.005, 0.005, 0.28, 6), toonMat('#f4f4f4'), s * 0.14, my + 0.08 - i * 0.04, mz - 0.02); w.rotation.z = Math.PI / 2 + s * (0.15 + i * 0.15); headG.add(w); }
  }
  _buildHelmet(headG, hr, sx, sy, sz) {
    const [pri, sec] = this.team.colors; const R = hr * 1.14; const helm = new THREE.Group(); helm.scale.set(sx, sy, sz); helm.position.y = 0.02; headG.add(helm); this.helmet = helm;
    const hm = toonMat(pri);
    const back = M(G(`hb${R}`, () => new THREE.SphereGeometry(R, 28, 18, Math.PI, Math.PI, 0, Math.PI * 0.86)), hm); helm.add(back); outline(back, R);
    const front = M(G(`hf${R}`, () => new THREE.SphereGeometry(R, 28, 18, 0, Math.PI, 0, Math.PI * 0.36)), hm); helm.add(front); outline(front, R);
    for (const s of [-1, 1]) { const jaw = M(G(`hj${R}`, () => new THREE.SphereGeometry(R, 14, 10, s < 0 ? -0.35 : Math.PI - 0.35, 0.7, Math.PI * 0.4, Math.PI * 0.45)), hm); helm.add(jaw); }
    // stripe over the top
    const stripe = M(torus(R * 1.005, 0.035, Math.PI, 24), toonMat(sec)); stripe.rotation.y = Math.PI / 2; stripe.rotation.z = 0; helm.add(stripe);
    // facemask
    const fm = toonMat(sec === '#ffffff' ? '#aaaaaa' : sec);
    for (const y of [-0.1, -0.24]) { const bar = M(torus(R * 1.04, 0.02, Math.PI, 24), fm, 0, y, 0); bar.rotation.x = Math.PI / 2; bar.rotation.z = Math.PI; helm.add(bar); }
    for (const x of [-0.16, 0, 0.16]) { const v = M(cyl(0.018, 0.018, 0.36, 8), fm, x, -0.12, Math.sqrt(Math.max(0.05, (R * 1.04) ** 2 - x * x))); helm.add(v); }
    // side emblems
    const em = new THREE.MeshBasicMaterial({ map: this.team._emblem || (this.team._emblem = emblemTexture(this.team)), transparent: true });
    for (const s of [-1, 1]) { const d = shadowOff(M(plane(0.3, 0.3), em, s * (R + 0.005), 0.05, -0.02)); d.rotation.y = s * Math.PI / 2; helm.add(d); }
    // hair poking out (kids)
    if (this.sp.features.includes('hair')) this._buildHair(headG, hr);
    // ears through the helmet
    const ear = this.sp.features.find(f => f.startsWith('ears:')); if (ear) this._buildEars(headG, hr, ear.split(':')[1], R);
  }
  _buildHair(headG, hr) {
    const style = this.opts.hair || 'short'; const hm = toonMat(this.opts.hairColor || '#3a2a1a');
    if (style === 'ponytail') { const p = M(capsule(0.06, 0.28), hm, 0, -0.1, -hr * 1.05); p.rotation.x = 0.5; headG.add(p); outline(p, 0.06); const tie = M(torus(0.055, 0.018), toonMat('#ff5fa2'), 0, 0.02, -hr * 1.08); tie.rotation.x = 0.5; headG.add(tie); }
    else if (style === 'braid') { const p = M(capsule(0.045, 0.34), hm, 0.1, -0.14, -hr * 1.0); p.rotation.x = 0.35; headG.add(p); }
    else if (style === 'curly') { for (let i = 0; i < 7; i++) { const a = Math.PI * 0.75 + i / 6 * Math.PI * 1.5; const c = M(sphere(0.07), hm, Math.cos(a) * hr * 1.02, -hr * 0.45, Math.sin(a) * hr * 1.02); headG.add(c); } }
    else if (style === 'bob') { for (const s of [-1, 1]) { const b = M(sphere(0.1), hm, s * hr * 1.0, -hr * 0.4, 0); b.scale.set(0.6, 1.2, 1); headG.add(b); } }
    else if (style === 'spiky') { for (let i = -1; i <= 1; i++) { const s = M(cone(0.04, 0.14, 6), hm, i * 0.09, -hr * 0.4, -hr * 1.02); s.rotation.x = 2.6; headG.add(s); } }
    else { const n = M(sphere(0.12), hm, 0, -hr * 0.45, -hr * 0.85); n.scale.set(1.6, 0.6, 0.6); headG.add(n); }
  }
  _buildEars(headG, hr, kind, R) {
    const skin = toonMat(this.skin), inner = toonMat(this.sp.accent || '#ff9bb0');
    for (const s of [-1, 1]) {
      if (kind === 'long') { const e = M(capsule(0.065, 0.36), skin, s * 0.13, R + 0.22, -0.05); e.rotation.z = -s * 0.18; headG.add(e); outline(e, 0.065); const i = M(capsule(0.035, 0.28), inner, s * 0.13, R + 0.22, 0.0); i.rotation.z = -s * 0.18; headG.add(i); this.joints['ear' + (s < 0 ? 'L' : 'R')] = e; }
      else if (kind === 'pointy') { const e = M(cone(0.09, 0.2, 10), skin, s * (R * 0.7), R * 0.85, 0); e.rotation.z = -s * 0.35; headG.add(e); outline(e, 0.09); }
      else if (kind === 'round') { const e = M(sphere(0.12), skin, s * (R * 0.85), R * 0.75, 0); e.scale.set(1, 1, 0.5); headG.add(e); outline(e, 0.12); const i = M(sphere(0.075), inner, s * (R * 0.85), R * 0.75, 0.04); i.scale.set(1, 1, 0.4); headG.add(i); }
      else if (kind === 'floppy') { const e = M(capsule(0.06, 0.2), skin, s * (R * 0.95), R * 0.2, -0.05); e.rotation.z = -s * 0.25; headG.add(e); outline(e, 0.06); }
    }
  }
  _buildHeadwear(headG, hr, sx, sy, sz) {
    const sp = this.sp, [pri, sec] = this.team.colors;
    if (sp.features.includes('cap')) { const cap = M(G(`cap${hr}`, () => new THREE.SphereGeometry(hr * 1.6, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)), toonMat(pri), 0, hr * 0.35, 0); cap.scale.set(1, 0.7, 1); headG.add(cap); outline(cap, hr * 1.6); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.4; const sp2 = M(sphere(0.07), toonMat(sec), Math.cos(a) * hr * 1.15, hr * 0.35 + 0.35 + (i % 2) * 0.08, Math.sin(a) * hr * 1.15); sp2.scale.set(1, 0.5, 1); headG.add(sp2); } const rim = M(torus(hr * 1.58, 0.03), toonMat(shade(pri, -0.3)), 0, hr * 0.36, 0); rim.rotation.x = Math.PI / 2; headG.add(rim); }
    if (sp.features.includes('afro')) { const a = M(sphere(hr * 1.45), toonMat('#1a1a1a'), 0, hr * 0.55, -hr * 0.1); headG.add(a); outline(a, hr * 1.45); const band = M(torus(hr * 1.02, 0.04), toonMat(pri), 0, hr * 0.15, 0); band.rotation.x = Math.PI / 2; headG.add(band); }
    if (sp.features.includes('bubblehelm')) { const b = M(sphere(hr * 1.45, 32, 24), toonMat('#bfefff', { opacity: 0.28 }), 0, 0.05, 0); b.castShadow = false; headG.add(b); const rim = M(torus(hr * 1.2, 0.05), toonMat(sec), 0, -hr * 0.85, 0); rim.rotation.x = Math.PI / 2; headG.add(rim); }
    if (sp.features.includes('bandana')) { const b = M(G(`bd${hr}`, () => new THREE.SphereGeometry(hr * 1.06 * sx, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), toonMat(pri), 0, 0.02, 0); headG.add(b); const knot = M(box(0.12, 0.08, 0.16), toonMat(pri), 0.1, -0.05, -hr * 0.95); knot.rotation.y = 0.5; headG.add(knot); }
    if (sp.features.includes('flower')) { const c = M(sphere(0.09), toonMat('#ffe66d'), 0, hr * 1.05, 0); headG.add(c); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const p = M(sphere(0.08), toonMat(sp.accent), Math.cos(a) * 0.14, hr * 1.05, Math.sin(a) * 0.14); p.scale.set(1, 0.5, 1); headG.add(p); } }
    if (sp.features.includes('halo')) { const h = M(torus(hr * 0.8, 0.03), toonMat(sp.accent, { emissive: sp.accent, emissiveIntensity: 0.9 }), 0, hr * 1.35, 0); h.rotation.x = Math.PI / 2; headG.add(h); this.joints.halo = h; }
    if (sp.features.includes('visor:glow')) { /* eyes visor already glowing */ }
    if (sp.features.includes('crest') || sp.features.includes('tufts')) { const n = sp.features.includes('tufts') ? 2 : 3; for (let i = 0; i < n; i++) { const x = n === 2 ? (i ? 0.16 : -0.16) : (i - 1) * 0.1; const c = M(cone(0.05, 0.22, 8), toonMat(sp.accent), x * sx, hr * 0.95 * sy, -0.05); c.rotation.z = -x * 2; headG.add(c); } }
    if (sp.features.includes('monocle')) { const m = M(torus(0.11, 0.015), toonMat('#ffd700'), 0.15 * sx, 0.05, hr * 0.95 * sz); headG.add(m); }
    if (sp.features.includes('shades')) { const s = M(box(hr * 1.6 * sx, 0.1, 0.05), toonMat('#111118'), 0, 0.06, hr * 0.92 * sz); headG.add(s); }
    if (sp.features.includes('eyepatch')) { const p = M(sphere(0.1), toonMat('#111118'), 0.13 * sx, 0.05, hr * 0.9 * sz); p.scale.set(1, 1, 0.4); headG.add(p); const strap = M(torus(hr * 1.02, 0.012), toonMat('#111118'), 0, 0.08, 0); strap.rotation.x = Math.PI / 2 + 0.3; headG.add(strap); }
  }
  _buildHeadFeatures(headG, hr, sx, sy, sz) {
    const sp = this.sp, skin = toonMat(this.skin);
    const ant = sp.features.find(f => f.startsWith('antenna:')); if (ant) { const n = +ant.split(':')[1]; for (let i = 0; i < n; i++) { const x = n === 1 ? 0 : (i ? 0.14 : -0.14); const a = M(cyl(0.015, 0.015, 0.3, 6), toonMat('#2a2a34'), x, hr * 1.3, 0); a.rotation.z = -x * 1.5; headG.add(a); const ball = M(sphere(0.045), toonMat(sp.accent, { emissive: sp.accent, emissiveIntensity: 0.6 }), x * 1.6, hr * 1.3 + 0.15, 0); headG.add(ball); } }
    if (sp.features.includes('flame')) { this.flames = []; for (let i = -1; i <= 1; i++) { const f = M(cone(0.08 - Math.abs(i) * 0.02, 0.26, 8), new THREE.MeshBasicMaterial({ color: i ? '#ffb347' : '#ffe14d' }), i * 0.09, hr * 1.25, -0.05); f.castShadow = false; headG.add(f); this.flames.push(f); } }
    if (sp.features.includes('spikes') || sp.features.includes('spikes:small')) { const small = sp.features.includes('spikes:small'); for (let i = 0; i < 3; i++) { const s = M(cone(small ? 0.04 : 0.06, small ? 0.1 : 0.16, 6), toonMat(sp.accent), 0, hr * (1.05 - i * 0.25), -hr * (0.5 + i * 0.3)); s.rotation.x = -0.6 - i * 0.3; headG.add(s); } }
    if (sp.features.includes('drips')) for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.5; const d = M(sphere(0.05), toonMat(this.skin, { opacity: 0.8 }), Math.cos(a) * hr * 0.95, -hr * 0.6 - (i % 2) * 0.06, Math.sin(a) * hr * 0.95); d.scale.set(1, 1.6, 1); headG.add(d); }
    if (sp.features.includes('bolts')) for (const s of [-1, 1]) { const b = M(cyl(0.05, 0.05, 0.08, 8), toonMat('#3a3f4a'), s * hr * 1.05 * sx, -0.02, 0); b.rotation.z = Math.PI / 2; headG.add(b); }
    if (sp.features.includes('mask')) { const m = M(box(hr * 1.4 * sx, 0.14, 0.06), toonMat('#1a1a24'), 0, 0.05, hr * 0.88 * sz); headG.add(m); }
    if (sp.features.includes('visor:cyber')) { const v = M(box(hr * 1.7 * sx, 0.07, 0.04), toonMat('#2bf0ff', { emissive: '#2bf0ff', emissiveIntensity: 0.7, opacity: 0.7 }), 0, 0.12, hr * 0.9 * sz); headG.add(v); }
    if (sp.features.includes('sparkles')) { this.sparkles = []; for (let i = 0; i < 5; i++) { const s = M(sphere(0.02), new THREE.MeshBasicMaterial({ color: '#ffffff' })); s.castShadow = false; headG.add(s); this.sparkles.push(s); } }
    if (sp.features.includes('fluffy')) for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; const f = M(sphere(0.12), toonMat(this.skin), Math.cos(a) * hr * 0.85, hr * 0.75, Math.sin(a) * hr * 0.85); headG.add(f); }
    if (sp.features.includes('glossy')) { const g = M(sphere(0.07), toonMat('#ffffff'), -hr * 0.4 * sx, hr * 0.5 * sy, hr * 0.75 * sz); g.scale.set(1.4, 0.7, 0.3); g.castShadow = false; headG.add(g); }
    if (sp.features.includes('iridescent')) { const g = M(sphere(0.1), toonMat('#ffd6f5', { opacity: 0.6 }), hr * 0.45 * sx, hr * 0.5 * sy, hr * 0.7 * sz); g.scale.set(1.2, 0.6, 0.3); g.castShadow = false; headG.add(g); }
  }

  // ---- ball attachment ----
  holdBall(ball) { if (!ball) return; const h = this.joints.handR; h.add(ball); ball.position.set(-0.02, -0.02, 0.06); ball.rotation.set(0.3, 0.5, 1.2); this.hasBall = true; }
  releaseBall(ball) { if (ball && ball.parent) ball.parent.remove(ball); this.hasBall = false; }
  handWorldPos(v) { return this.joints.handR.getWorldPosition(v || new THREE.Vector3()); }

  // ---- animation ----
  setState(state, opts = {}) { if (this.anim.state !== state || opts.restart) { this.anim.state = state; this.anim.t = 0; this.anim.opts = opts; } }
  update(dt, speed = 0) {
    const a = this.anim, J = this.joints; a.t += dt; a.speed = speed;
    const T = {}; // targets: key -> value
    const set = (k, v) => { T[k] = v; };
    const strideRate = clamp(speed, 0, 12) * 2.9; a.phase += strideRate * dt;
    const ph = a.phase;
    let rootPitch = 0, rootY = 0, rootRoll = 0, spinY = null; let stiff = 16;
    const runLegs = (amp = 0.9, kneeAmp = 1.15) => {
      const tL = Math.sin(ph) * amp, tR = Math.sin(ph + Math.PI) * amp;
      set('thighL', tL); set('thighR', tR);
      set('kneeL', Math.max(0, -Math.sin(ph - 0.5)) * kneeAmp + 0.12); set('kneeR', Math.max(0, -Math.sin(ph + Math.PI - 0.5)) * kneeAmp + 0.12);
      set('hipsY', Math.abs(Math.sin(ph)) * 0.05 - 0.02); set('lean', 0.18 + clamp(speed, 0, 10) * 0.02); set('twist', Math.sin(ph) * 0.1);
    };
    const runArms = () => { const tL = Math.sin(ph), tR = Math.sin(ph + Math.PI); set('shL', -tL * 0.9 - 0.2); set('shR', -tR * 0.9 - 0.2); set('elL', -1.4); set('elR', -1.4); set('szL', -0.12); set('szR', 0.12); };
    const idle = () => { set('thighL', 0); set('thighR', 0); set('kneeL', 0.08); set('kneeR', 0.08); set('shL', 0.08 + Math.sin(a.t * 1.7) * 0.04); set('shR', 0.08 - Math.sin(a.t * 1.7) * 0.04); set('elL', -0.3); set('elR', -0.3); set('szL', -0.15); set('szR', 0.15); set('lean', 0.04); set('hipsY', Math.sin(a.t * 2) * 0.008); set('twist', 0); };
    switch (a.state) {
      case 'idle': idle(); break;
      case 'set': // pre-snap stance
        set('thighL', -0.55); set('thighR', -0.55); set('kneeL', 1.05); set('kneeR', 1.05); set('hipsY', -0.16); set('lean', 0.42);
        set('shL', -0.75); set('shR', -0.75); set('elL', -0.7); set('elR', -0.7); set('szL', -0.25); set('szR', 0.25); set('twist', 0); break;
      case 'qbset':
        set('thighL', -0.25); set('thighR', -0.25); set('kneeL', 0.55); set('kneeR', 0.55); set('hipsY', -0.07); set('lean', 0.18);
        set('shL', -1.1); set('shR', -1.1); set('elL', -1.4); set('elR', -1.4); set('szL', -0.2); set('szR', 0.2); set('twist', 0); break;
      case 'snapset':
        set('thighL', -0.7); set('thighR', -0.7); set('kneeL', 1.3); set('kneeR', 1.3); set('hipsY', -0.22); set('lean', 0.6);
        set('shL', -0.9); set('shR', -1.6); set('elL', -0.4); set('elR', -0.3); set('szL', -0.2); set('szR', 0.1); break;
      case 'run': runLegs(); runArms(); break;
      case 'carry': runLegs(); { const tL = Math.sin(ph); set('shL', -tL * 0.9 - 0.2); set('elL', -1.4); set('szL', -0.12); set('shR', -1.05); set('elR', -2.1); set('szR', 0.35); } break;
      case 'block':
        if (speed > 0.5) runLegs(0.5, 0.7); else { set('thighL', -0.4); set('thighR', -0.4); set('kneeL', 0.9); set('kneeR', 0.9); set('hipsY', -0.12 + Math.sin(a.t * 12) * 0.01); }
        set('lean', 0.35); set('shL', -1.5); set('shR', -1.5); set('elL', -0.9); set('elR', -0.9); set('szL', -0.35); set('szR', 0.35); set('twist', 0); break;
      case 'throw': {
        const t = a.t; stiff = 30;
        if (speed > 0.5) runLegs(0.5, 0.7); else { set('thighL', -0.25); set('thighR', 0.35); set('kneeL', 0.5); set('kneeR', 0.3); set('hipsY', -0.05); }
        if (t < 0.18) { const k = t / 0.18; set('shR', lerp(-1.0, 0.7, k)); set('szR', lerp(0.35, 2.2, k)); set('elR', lerp(-2.1, -1.6, k)); set('twist', lerp(0, -0.55, k)); set('lean', -0.05); }
        else if (t < 0.32) { const k = (t - 0.18) / 0.14; set('shR', lerp(0.7, -1.9, k)); set('szR', lerp(2.2, 1.0, k)); set('elR', lerp(-1.6, -0.2, k)); set('twist', lerp(-0.55, 0.5, k)); set('lean', lerp(-0.05, 0.3, k)); }
        else { set('shR', -1.9 + (t - 0.32) * 0.8); set('szR', 0.9); set('elR', -0.3); set('twist', 0.4); set('lean', 0.3); }
        set('shL', -0.9); set('elL', -1.3); set('szL', -0.5); break;
      }
      case 'catch': stiff = 26;
        if (speed > 0.5) runLegs(0.8, 1.0); else idle();
        { const up = a.opts && a.opts.high ? 1 : 0; set('shL', -2.3 - up * 0.6); set('shR', -2.3 - up * 0.6); set('elL', -0.4); set('elR', -0.4); set('szL', -0.35); set('szR', 0.35); set('lean', 0.1 - up * 0.2); set('twist', 0); }
        break;
      case 'kick': { const t = a.t; stiff = 30; set('thighL', -0.15); set('kneeL', 0.3);
        if (t < 0.25) { set('thighR', lerp(0.2, 0.9, t / 0.25)); set('kneeR', 1.4); set('lean', 0.15); }
        else if (t < 0.45) { const k = (t - 0.25) / 0.2; set('thighR', lerp(0.9, -1.7, k)); set('kneeR', lerp(1.4, 0.05, k)); set('lean', lerp(0.15, -0.25, k)); }
        else { set('thighR', -1.6); set('kneeR', 0.1); set('lean', -0.25); }
        set('shL', -1.3); set('shR', 0.6); set('szL', -0.9); set('szR', 0.9); set('elL', -0.5); set('elR', -0.4); set('hipsY', 0); break; }
      case 'dive': { const t = a.t; stiff = 24; const k = clamp(t / 0.3, 0, 1);
        rootPitch = lerp(0.3, 1.35, k); rootY = lerp(0.1, 0.55, Math.sin(k * Math.PI)) + 0.15 * (1 - k);
        set('shL', -2.6); set('shR', -2.6); set('elL', -0.3); set('elR', -0.3); set('szL', -0.25); set('szR', 0.25); set('thighL', 0.35); set('thighR', 0.45); set('kneeL', 0.2); set('kneeR', 0.35); set('lean', 0.3); set('hipsY', 0); break; }
      case 'down': { // face down on the turf
        stiff = 14; rootPitch = 1.5; rootY = 0.32; set('shL', -2.2); set('shR', -1.0); set('elL', -0.8); set('elR', -1.6); set('szL', -0.6); set('szR', 0.5); set('thighL', 0.3); set('thighR', -0.1); set('kneeL', 0.5); set('kneeR', 0.9); set('lean', 0); set('hipsY', 0); break; }
      case 'downback': { stiff = 14; rootPitch = -1.5; rootY = 0.3; set('shL', 0.6); set('shR', 0.6); set('szL', -1.3); set('szR', 1.3); set('elL', -0.8); set('elR', -0.8); set('thighL', -0.3); set('thighR', -0.5); set('kneeL', 0.9); set('kneeR', 0.6); set('lean', -0.1); set('hipsY', 0); break; }
      case 'getup': { const k = clamp(a.t / 0.6, 0, 1); stiff = 12; rootPitch = lerp(1.5, 0, k); rootY = lerp(0.32, 0, k); set('thighL', lerp(0.3, -0.5, k)); set('thighR', lerp(-0.1, -0.3, k)); set('kneeL', lerp(0.5, 1.0, k)); set('kneeR', 0.8); set('shL', lerp(-2.2, -0.6, k)); set('shR', lerp(-1.0, -0.6, k)); set('elL', -0.7); set('elR', -0.7); set('lean', lerp(0.6, 0.2, k)); set('hipsY', -0.05); break; }
      case 'juke': { stiff = 26; runLegs(0.6, 0.9); runArms(); rootRoll = (a.opts && a.opts.dir || 1) * -0.45 * Math.sin(clamp(a.t / 0.35, 0, 1) * Math.PI); rootY = Math.sin(clamp(a.t / 0.35, 0, 1) * Math.PI) * 0.12; break; }
      case 'spin': { stiff = 26; runLegs(0.5, 0.8); set('shL', -0.8); set('shR', -0.8); set('szL', -1.1); set('szR', 1.1); set('elL', -1.2); set('elR', -1.2); spinY = clamp(a.t / 0.45, 0, 1) * Math.PI * 2; break; }
      case 'stumble': { stiff = 12; runLegs(0.5, 0.8); set('shL', -1.6); set('shR', 0.4); set('szL', -1.2); set('szR', 0.9); set('elL', -0.4); set('elR', -0.6); rootRoll = 0.3; set('lean', 0.6); break; }
      case 'celebrate': { const v = (a.opts && a.opts.variant) || 0; const t = a.t;
        if (v === 0) { rootY = Math.abs(Math.sin(t * 6)) * 0.3; set('shL', 0.3); set('shR', 0.3); set('szL', -2.8); set('szR', 2.8); set('elL', -0.6); set('elR', -0.6); set('thighL', -0.3); set('thighR', -0.3); set('kneeL', 0.4); set('kneeR', 0.4); set('lean', -0.15); }
        else if (v === 1) { set('shL', -0.2); set('shR', -0.2); set('szL', -1.5); set('szR', 1.5); set('elL', -2.4); set('elR', -2.4); set('lean', -0.1 + Math.sin(t * 8) * 0.05); set('kneeL', 0.3); set('kneeR', 0.3); set('thighL', -0.15); set('thighR', -0.15); set('hipsY', 0); }
        else { set('twist', Math.sin(t * 7) * 0.4); set('shL', -0.4 + Math.sin(t * 7) * 0.8); set('shR', -0.4 - Math.sin(t * 7) * 0.8); set('szL', -0.8); set('szR', 0.8); set('elL', -1.5); set('elR', -1.5); set('thighL', -0.2 + Math.sin(t * 7) * 0.3); set('thighR', -0.2 - Math.sin(t * 7) * 0.3); set('kneeL', 0.5); set('kneeR', 0.5); set('hipsY', Math.abs(Math.sin(t * 7)) * 0.05); }
        break; }
      case 'sad': set('lean', 0.35); set('shL', 0.2); set('shR', 0.2); set('szL', -0.1); set('szR', 0.1); set('elL', -0.1); set('elR', -0.1); set('kneeL', 0.2); set('kneeR', 0.2); set('thighL', -0.1); set('thighR', -0.1); set('headPitch', 0.5); break;
      case 'wave': idle(); set('shR', 0.2); set('szR', 2.6 + Math.sin(a.t * 8) * 0.3); set('elR', -0.6); break;
      case 'point': idle(); set('shR', -1.6); set('szR', 0.2); set('elR', -0.1); break;
      default: idle();
    }
    // smoothing
    const k = 1 - Math.exp(-stiff * dt);
    for (const key of ['thighL', 'thighR', 'kneeL', 'kneeR', 'shL', 'shR', 'elL', 'elR', 'szL', 'szR', 'lean', 'twist', 'hipsY', 'headPitch']) {
      const target = T[key] !== undefined ? T[key] : (key === 'kneeL' || key === 'kneeR' ? 0.1 : 0);
      this.cur[key] = this.cur[key] === undefined ? target : this.cur[key] + (target - this.cur[key]) * k;
    }
    const c = this.cur;
    if (J.thighL) { J.thighL.rotation.x = c.thighL; J.thighR.rotation.x = c.thighR; J.kneeL.rotation.x = c.kneeL; J.kneeR.rotation.x = c.kneeR; }
    J.shoulderL.rotation.x = c.shL; J.shoulderR.rotation.x = c.shR; J.shoulderL.rotation.z = c.szL; J.shoulderR.rotation.z = c.szR; J.elbowL.rotation.x = c.elL; J.elbowR.rotation.x = c.elR;
    J.torso.rotation.x = c.lean; J.torso.rotation.y = c.twist; J.hips.position.y = DIM.hipY * (this.sp.body.scale ? this.sp.body.scale[1] : 1) + c.hipsY + (this.sp.features.includes('float') ? 0.25 + Math.sin(a.t * 3 + a.phase) * 0.06 : 0);
    J.head.rotation.x = (c.headPitch || 0) + a.lookY - c.lean * 0.6; J.head.rotation.y = a.lookX;
    // root pose (dive/down)
    this.cur.rootPitch = this.cur.rootPitch === undefined ? rootPitch : this.cur.rootPitch + (rootPitch - this.cur.rootPitch) * k;
    this.cur.rootY = this.cur.rootY === undefined ? rootY : this.cur.rootY + (rootY - this.cur.rootY) * k;
    this.cur.rootRoll = this.cur.rootRoll === undefined ? rootRoll : this.cur.rootRoll + (rootRoll - this.cur.rootRoll) * k;
    this.pose = this.pose || new THREE.Group();
    this.group.children.forEach(ch => { if (ch === J.hips) { ch.rotation.x = this.cur.rootPitch; ch.rotation.z = this.cur.rootRoll; ch.position.y = J.hips.position.y + this.cur.rootY - (this.cur.rootPitch > 0.5 ? Math.sin(this.cur.rootPitch) * 0.35 : 0); ch.rotation.y = spinY !== null ? spinY : 0; } });
    // extras: blink, tails, wings, flames, sparkles, ears
    a.blink -= dt; if (a.blink < 0) { a.blink = 2 + this.rnd() * 3; this._blinkT = 0.12; }
    if (this._blinkT > 0) { this._blinkT -= dt; for (const e of this.eyes) e.scale.y = 0.15; } else for (const e of this.eyes) e.scale.y = 1;
    if (J.tail) { J.tail.rotation.y = Math.sin(a.t * 4 + a.phase) * 0.4; J.tail.rotation.x = Math.sin(a.t * 3) * 0.15; }
    if (J.wingL) { const f = Math.sin(a.t * 18) * 0.5; J.wingL.rotation.z = 0.5 + f; J.wingR.rotation.z = -0.5 - f; }
    if (this.flames) this.flames.forEach((f, i) => { f.scale.y = 0.85 + 0.3 * Math.sin(a.t * 23 + i * 2); f.rotation.z = Math.sin(a.t * 9 + i) * 0.15; });
    if (this.sparkles) this.sparkles.forEach((s, i) => { const t = a.t * 2 + i * 1.3; s.position.set(Math.cos(t) * 0.5, 0.2 + Math.sin(t * 1.7) * 0.4, Math.sin(t) * 0.5); });
    if (J.halo) J.halo.position.y = this.headR * 1.35 + Math.sin(a.t * 2) * 0.03;
    if (J.earL) { J.earL.rotation.z = -(-0.18) + Math.sin(a.t * 5 + 1) * 0.1 + 0.18 * -1; J.earR.rotation.z = 0.18 * -1 * -1 + Math.sin(a.t * 5) * 0.1 * -1; }
  }
  setFacing(yaw) { this.group.rotation.y = yaw; }
  lookAt(dx, dz) { const yaw = Math.atan2(dx, dz) - this.group.rotation.y; let d = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; this.anim.lookX = clamp(d, -0.9, 0.9); }
  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}

let _clockTex = null;
function clockTexture() {
  if (_clockTex) return _clockTex;
  const { cv, ctx } = canvas(128, 128);
  ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, 7); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#5a3a1a'; ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; ctx.fillStyle = '#5a3a1a'; ctx.fillRect(64 + Math.cos(a) * 48 - 3, 64 + Math.sin(a) * 48 - 3, 6, 6); }
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64, 30); ctx.moveTo(64, 64); ctx.lineTo(90, 70); ctx.stroke();
  _clockTex = new THREE.CanvasTexture(cv); _clockTex.colorSpace = THREE.SRGBColorSpace; return _clockTex;
}

// Team object helper: characters need colors + a cached emblem texture.
export function ensureTeamArt(team) { if (!team._emblem) team._emblem = emblemTexture(team); return team; }
