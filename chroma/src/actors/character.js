// "Dripkin" character model: built from primitives, procedurally animated,
// with an inverted-hull outline and a gooey blob form for swimming in ink.
import * as THREE from 'three';
import { clamp, lerp, damp } from '../util.js';

const G = {}; // shared geometries
function geo(key, make) { return G[key] || (G[key] = make()); }

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.BackSide });
OUTLINE_MAT.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.011;');
};
OUTLINE_MAT.customProgramCacheKey = () => 'outline';

export const SKIN_TONES = ['#ffd9c2', '#f3c19f', '#d99a73', '#b8774f', '#8a5536', '#5e3a26', '#c9e4ff', '#d8f5c9'];
export const EYE_COLORS = ['#3a7bff', '#18b06a', '#a0522d', '#8e44ff', '#ff6a3d', '#e0b000', '#00b3c6', '#ff3d8b'];
export const HAIR_STYLES = ['drop', 'twin', 'mohawk', 'bob'];
export const OUTFIT_COLORS = ['#2b2f45', '#f4f1ea', '#ff5d5d', '#ffb02e', '#2ec4b6', '#5b6cff', '#9b5de5', '#3d405b', '#66bb6a', '#ef476f'];

export function randomLook(r = Math.random) {
  const p = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: p(SKIN_TONES.slice(0, 6)), hair: p(HAIR_STYLES), eyes: p(EYE_COLORS),
    top: p(OUTFIT_COLORS), topStyle: p(['hoodie', 'jacket', 'tee']), bottom: p(['#23263a', '#3d405b', '#5a4a3a', '#2f5d62', '#1d3557', '#6d597a']),
    shoes: p(['#ffffff', '#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#f4f1ea']),
  };
}

function std(color, rough = 0.6, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function gooMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
  });
}

function addMesh(parent, g, mat, opts = {}) {
  const m = new THREE.Mesh(g, mat);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = false;
  parent.add(m);
  if (opts.outline !== false) {
    const o = new THREE.Mesh(g, OUTLINE_MAT);
    o.castShadow = false;
    m.add(o);
  }
  return m;
}

// Droplet lathe: round bottom, pointed tip at +y
function dropletGeometry(r = 0.2, h = 0.5, seg = 28) {
  const pts = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = -r + t * (h + r);
    let x;
    if (y < 0) x = Math.sqrt(Math.max(r * r - y * y, 0));
    else { const k = y / h; x = r * Math.pow(1 - k, 1.6) * (1 + 0.15 * Math.sin(k * Math.PI)); }
    pts.push(new THREE.Vector2(Math.max(x, 0.0005), y));
  }
  pts[0].x = 0.0005;
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

function torsoGeometry(style) {
  const prof = style === 'tee'
    ? [[0.0, 0.0], [0.15, 0.0], [0.16, 0.08], [0.165, 0.2], [0.175, 0.28], [0.15, 0.34], [0.08, 0.37], [0.0, 0.37]]
    : [[0.0, -0.02], [0.165, -0.02], [0.17, 0.08], [0.175, 0.2], [0.185, 0.28], [0.16, 0.345], [0.09, 0.375], [0.0, 0.375]];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 24);
  g.scale(1, 1, 0.78);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ weapons
export function buildWeaponModel(id, teamColor) {
  const g = new THREE.Group();
  const dark = std(0x2b2e3b, 0.45, 0.4);
  const light = std(0xe9e6df, 0.5, 0.1);
  const accent = std(0xffc93c, 0.4, 0.2);
  const ink = gooMaterial(teamColor);
  g.userData.inkMats = [ink];
  const muzzle = new THREE.Object3D();
  if (id === 'spritzer') {
    addMesh(g, geo('box1', () => new THREE.BoxGeometry(0.075, 0.1, 0.3)), light, { pos: [0, 0.03, 0.08] });
    addMesh(g, geo('cyl1', () => new THREE.CylinderGeometry(0.028, 0.034, 0.14, 14).rotateX(Math.PI / 2)), dark, { pos: [0, 0.045, 0.28] });
    addMesh(g, geo('sph1', () => new THREE.SphereGeometry(0.055, 18, 14)), ink, { pos: [0, 0.11, 0.06] });
    addMesh(g, geo('box2', () => new THREE.BoxGeometry(0.05, 0.12, 0.05)), dark, { pos: [0, -0.04, -0.02], rot: [0.3, 0, 0] });
    addMesh(g, geo('box3', () => new THREE.BoxGeometry(0.08, 0.025, 0.2)), accent, { pos: [0, -0.02, 0.12], outline: false });
    muzzle.position.set(0, 0.045, 0.36);
  } else if (id === 'popper') {
    addMesh(g, geo('cyl2', () => new THREE.CylinderGeometry(0.06, 0.06, 0.28, 18).rotateX(Math.PI / 2)), dark, { pos: [0, 0.04, 0.1] });
    addMesh(g, geo('cone1', () => new THREE.CylinderGeometry(0.095, 0.06, 0.1, 18, 1, true).rotateX(Math.PI / 2)), accent, { pos: [0, 0.04, 0.28] });
    addMesh(g, geo('sph2', () => new THREE.SphereGeometry(0.07, 18, 14)), ink, { pos: [0, 0.13, 0.02] });
    addMesh(g, geo('box2', () => new THREE.BoxGeometry(0.05, 0.12, 0.05)), dark, { pos: [0, -0.04, -0.02], rot: [0.3, 0, 0] });
    muzzle.position.set(0, 0.04, 0.34);
  } else if (id === 'roller') {
    addMesh(g, geo('rhandle', () => new THREE.CylinderGeometry(0.018, 0.018, 0.95, 10).rotateX(Math.PI / 2)), dark, { pos: [0, 0, 0.42] });
    addMesh(g, geo('rgrip', () => new THREE.CylinderGeometry(0.026, 0.026, 0.16, 10).rotateX(Math.PI / 2)), accent, { pos: [0, 0, 0.02] });
    addMesh(g, geo('rframe', () => new THREE.BoxGeometry(0.62, 0.03, 0.04)), dark, { pos: [0, 0, 0.88] });
    const drum = addMesh(g, geo('rdrum', () => new THREE.CylinderGeometry(0.12, 0.12, 0.6, 22).rotateZ(Math.PI / 2)), ink, { pos: [0, -0.02, 0.98] });
    drum.name = 'drum';
    addMesh(g, geo('rcap', () => new THREE.CylinderGeometry(0.125, 0.125, 0.04, 22).rotateZ(Math.PI / 2)), light, { pos: [0.32, -0.02, 0.98] });
    addMesh(g, geo('rcap', () => new THREE.CylinderGeometry(0.125, 0.125, 0.04, 22).rotateZ(Math.PI / 2)), light, { pos: [-0.32, -0.02, 0.98] });
    muzzle.position.set(0, 0, 1.0);
  } else if (id === 'longshot') {
    addMesh(g, geo('lbody', () => new THREE.BoxGeometry(0.07, 0.1, 0.36)), light, { pos: [0, 0.02, 0.06] });
    addMesh(g, geo('lbarrel', () => new THREE.CylinderGeometry(0.02, 0.026, 0.62, 12).rotateX(Math.PI / 2)), dark, { pos: [0, 0.04, 0.52] });
    addMesh(g, geo('lscope', () => new THREE.CylinderGeometry(0.03, 0.03, 0.2, 14).rotateX(Math.PI / 2)), dark, { pos: [0, 0.12, 0.12] });
    addMesh(g, geo('llens', () => new THREE.CircleGeometry(0.026, 14)), new THREE.MeshBasicMaterial({ color: 0x9fe7ff }), { pos: [0, 0.12, 0.221], outline: false });
    addMesh(g, geo('ltank', () => new THREE.CapsuleGeometry(0.035, 0.14, 6, 12).rotateX(Math.PI / 2)), ink, { pos: [0, -0.04, 0.1] });
    addMesh(g, geo('lstock', () => new THREE.BoxGeometry(0.05, 0.12, 0.14)), accent, { pos: [0, -0.01, -0.16] });
    muzzle.position.set(0, 0.04, 0.84);
  }
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

export function buildBombModel(teamColor) {
  const g = new THREE.Group();
  const ink = gooMaterial(teamColor);
  addMesh(g, geo('bomb', () => new THREE.SphereGeometry(0.15, 20, 16)), ink, {});
  addMesh(g, geo('bombcap', () => new THREE.CylinderGeometry(0.06, 0.08, 0.07, 14)), std(0xe9e6df, 0.4, 0.3), { pos: [0, 0.15, 0] });
  addMesh(g, geo('bombnub', () => new THREE.SphereGeometry(0.035, 10, 8)), std(0xffc93c, 0.4, 0.2), { pos: [0, 0.2, 0], outline: false });
  g.userData.inkMat = ink;
  return g;
}

// ------------------------------------------------------------------ Dripkin
export class Dripkin {
  constructor(look, teamColor = '#ff2e88', weaponId = 'spritzer') {
    this.look = { ...look };
    this.teamColor = new THREE.Color(teamColor);
    this.root = new THREE.Group();
    this.kid = new THREE.Group();
    this.root.add(this.kid);
    this.phase = 0;
    this.time = Math.random() * 10;
    this.blink = 2 + Math.random() * 3;
    this.gooT = 0; // 0 = kid, 1 = goo
    this.recoil = 0;
    this.flick = 0;
    this.hurt = 0;
    this.emote = null;
    this.lean = 0;
    this.build();
    this.setWeapon(weaponId);
  }

  build() {
    const L = this.look;
    this.mats = {
      skin: std(L.skin, 0.55),
      top: std(L.top, 0.75),
      bottom: std(L.bottom, 0.8),
      shoes: std(L.shoes, 0.5),
      sole: std(0x2a2a33, 0.7),
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }),
      iris: new THREE.MeshStandardMaterial({ color: L.eyes, roughness: 0.2 }),
      pupil: new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.2 }),
      shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      dark: std(0x2b2140, 0.6),
      blush: std(0xff8a9a, 0.7),
      goo: gooMaterial(this.teamColor),
      metal: std(0xd8dde6, 0.35, 0.6),
    };
    const M = this.mats;
    const hips = this.hips = new THREE.Group();
    hips.position.y = 0.6;
    this.kid.add(hips);
    // shorts
    addMesh(hips, geo('pelvis', () => new THREE.SphereGeometry(0.16, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(Math.PI)), M.bottom, { pos: [0, 0.05, 0], scale: [1, 0.9, 0.8] });
    // legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(0.085 * side, -0.02, 0);
      hips.add(leg);
      addMesh(leg, geo('thigh', () => new THREE.CapsuleGeometry(0.072, 0.16, 6, 12).translate(0, -0.12, 0)), M.bottom, {});
      const knee = new THREE.Group();
      knee.position.y = -0.26;
      leg.add(knee);
      addMesh(knee, geo('shin', () => new THREE.CapsuleGeometry(0.058, 0.17, 6, 12).translate(0, -0.12, 0)), M.skin, {});
      const foot = new THREE.Group();
      foot.position.y = -0.27;
      knee.add(foot);
      addMesh(foot, geo('shoe', () => new THREE.SphereGeometry(0.08, 16, 12)), M.shoes, { pos: [0, -0.02, 0.035], scale: [0.95, 0.72, 1.45] });
      addMesh(foot, geo('sole', () => new THREE.BoxGeometry(0.15, 0.035, 0.24)), M.sole, { pos: [0, -0.065, 0.035], outline: false });
      this.legs.push({ leg, knee, foot });
    }
    // torso
    const spine = this.spine = new THREE.Group();
    spine.position.y = 0.06;
    hips.add(spine);
    addMesh(spine, geo('torso-' + L.topStyle, () => torsoGeometry(L.topStyle)), M.top, {});
    if (L.topStyle === 'hoodie') {
      addMesh(spine, geo('hood', () => new THREE.TorusGeometry(0.1, 0.045, 10, 20)), M.top, { pos: [0, 0.35, -0.06], rot: [Math.PI / 2 + 0.5, 0, 0] });
      addMesh(spine, geo('pocket', () => new THREE.BoxGeometry(0.2, 0.08, 0.02)), M.top, { pos: [0, 0.1, 0.13], outline: false });
    } else if (L.topStyle === 'jacket') {
      addMesh(spine, geo('collar', () => new THREE.TorusGeometry(0.085, 0.03, 8, 18)), M.white, { pos: [0, 0.355, 0], rot: [Math.PI / 2, 0, 0] });
      addMesh(spine, geo('zip', () => new THREE.BoxGeometry(0.012, 0.3, 0.01)), M.metal, { pos: [0, 0.17, 0.145], outline: false });
    }
    // team badge on chest
    this.badge = addMesh(spine, geo('badge', () => new THREE.SphereGeometry(0.035, 12, 10)), M.goo, { pos: [0.075, 0.25, 0.12], scale: [1, 1, 0.4], outline: false });
    // paint can backpack
    const pack = this.pack = new THREE.Group();
    pack.position.set(0, 0.2, -0.17);
    spine.add(pack);
    addMesh(pack, geo('can', () => new THREE.CylinderGeometry(0.085, 0.085, 0.26, 18, 1, true)), M.metal, {});
    addMesh(pack, geo('canTop', () => new THREE.CylinderGeometry(0.088, 0.088, 0.03, 18)), M.dark, { pos: [0, 0.14, 0] });
    addMesh(pack, geo('canTop', () => new THREE.CylinderGeometry(0.088, 0.088, 0.03, 18)), M.dark, { pos: [0, -0.14, 0] });
    addMesh(pack, geo('nozzle', () => new THREE.CylinderGeometry(0.018, 0.025, 0.06, 10)), M.dark, { pos: [0, 0.18, 0] });
    this.inkLevel = addMesh(pack, geo('canInk', () => new THREE.CylinderGeometry(0.075, 0.075, 1, 18).translate(0, 0.5, 0)), M.goo, { pos: [0, -0.125, 0.012], outline: false });
    this.inkLevel.scale.y = 0.25;
    // neck + head
    const neck = this.neck = new THREE.Group();
    neck.position.y = 0.37;
    spine.add(neck);
    addMesh(neck, geo('neck', () => new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10)), M.skin, { pos: [0, 0.02, 0], outline: false });
    const head = this.head = new THREE.Group();
    head.position.y = 0.2;
    neck.add(head);
    addMesh(head, geo('head', () => new THREE.SphereGeometry(0.205, 32, 24)), M.skin, { scale: [1.02, 0.95, 0.97] });
    // ears (little fins)
    for (const side of [-1, 1]) {
      addMesh(head, geo('ear', () => new THREE.ConeGeometry(0.05, 0.12, 10).rotateZ(-Math.PI / 2).scale(1, 0.6, 1)), M.skin, { pos: [0.2 * side, 0.0, -0.01], rot: [0, side > 0 ? 0 : Math.PI, 0.25 * side] });
    }
    // eyes
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.078 * side, 0.005, 0.16);
      eye.rotation.y = 0.32 * side;
      head.add(eye);
      addMesh(eye, geo('sclera', () => new THREE.SphereGeometry(0.06, 18, 14)), M.white, { scale: [0.8, 1.12, 0.45], outline: false });
      addMesh(eye, geo('iris', () => new THREE.SphereGeometry(0.038, 16, 12)), M.iris, { pos: [0, -0.004, 0.018], scale: [0.85, 1.1, 0.4], outline: false, shadow: false });
      addMesh(eye, geo('pupil', () => new THREE.SphereGeometry(0.02, 12, 10)), M.pupil, { pos: [0, -0.004, 0.028], scale: [0.85, 1.1, 0.4], outline: false, shadow: false });
      addMesh(eye, geo('shine', () => new THREE.SphereGeometry(0.009, 8, 6)), M.shine, { pos: [0.012, 0.022, 0.031], outline: false, shadow: false });
      addMesh(eye, geo('brow', () => new THREE.CapsuleGeometry(0.008, 0.04, 4, 6).rotateZ(Math.PI / 2)), M.dark, { pos: [0, 0.085, 0.01], rot: [0, 0, -0.18 * side], outline: false, shadow: false });
      this.eyes.push(eye);
    }
    addMesh(head, geo('mouth', () => new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI)), M.dark, { pos: [0, -0.085, 0.185], rot: [0.25, 0, Math.PI], outline: false, shadow: false });
    for (const side of [-1, 1]) {
      addMesh(head, geo('blush', () => new THREE.SphereGeometry(0.03, 10, 8)), M.blush, { pos: [0.12 * side, -0.05, 0.15], scale: [1, 0.55, 0.3], rot: [0, 0.6 * side, 0], outline: false, shadow: false });
    }
    this.buildHair();
    // arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.18 * side, 0.31, 0);
      spine.add(sh);
      addMesh(sh, geo('upperArm', () => new THREE.CapsuleGeometry(0.052, 0.12, 6, 10).translate(0, -0.09, 0)), L.topStyle === 'tee' ? M.skin : M.top, {});
      addMesh(sh, geo('shoulderPad', () => new THREE.SphereGeometry(0.065, 12, 10)), M.top, { outline: false });
      const elbow = new THREE.Group();
      elbow.position.y = -0.19;
      sh.add(elbow);
      addMesh(elbow, geo('forearm', () => new THREE.CapsuleGeometry(0.046, 0.11, 6, 10).translate(0, -0.085, 0)), M.skin, {});
      const hand = new THREE.Group();
      hand.position.y = -0.19;
      elbow.add(hand);
      addMesh(hand, geo('hand', () => new THREE.SphereGeometry(0.055, 12, 10)), M.skin, { scale: [0.9, 1, 1] });
      this.arms.push({ sh, elbow, hand, side });
    }
    // goo blob form
    this.goo = new THREE.Group();
    this.root.add(this.goo);
    this.blob = addMesh(this.goo, geo('blob', () => new THREE.SphereGeometry(0.36, 28, 20)), M.goo, {});
    for (const side of [-1, 1]) {
      const e = addMesh(this.blob, geo('sclera', () => new THREE.SphereGeometry(0.06, 18, 14)), M.white, { pos: [0.1 * side, 0.22, 0.24], scale: [0.85, 1.1, 0.6], outline: false });
      addMesh(e, geo('pupil', () => new THREE.SphereGeometry(0.02, 12, 10)), M.pupil, { pos: [0, 0, 0.05], scale: [1.4, 1.4, 0.6], outline: false });
    }
    this.goo.visible = false;
  }

  buildHair() {
    if (this.hair) this.head.remove(this.hair);
    const hair = this.hair = new THREE.Group();
    this.head.add(hair);
    const M = this.mats;
    const cap = geo('cap', () => new THREE.SphereGeometry(0.225, 30, 20, 0, Math.PI * 2, 0, Math.PI * 0.56));
    const style = this.look.hair;
    const capMesh = addMesh(hair, cap, M.goo, { pos: [0, 0.015, -0.02], rot: [-0.42, 0, 0], scale: [1.03, 1.02, 1.05] });
    void capMesh;
    const drip = (x, y, z, len, r, rx = 0, rz = 0) => {
      const g = geo('drip' + len + r, () => {
        const gg = new THREE.CapsuleGeometry(r, len, 6, 10);
        gg.translate(0, -len / 2, 0);
        return gg;
      });
      addMesh(hair, g, M.goo, { pos: [x, y, z], rot: [rx, 0, rz] });
      addMesh(hair, geo('dripEnd' + r, () => new THREE.SphereGeometry(r * 1.45, 12, 10)), M.goo, { pos: [x + Math.sin(rz) * len * 0.95, y - Math.cos(rx) * len * 1.02, z + Math.sin(rx) * len * 0.95], outline: false });
    };
    if (style === 'drop') {
      addMesh(hair, geo('drop1', () => dropletGeometry(0.13, 0.34)), M.goo, { pos: [0, 0.2, -0.06], rot: [-0.75, 0, 0] });
      drip(-0.12, -0.02, -0.16, 0.12, 0.03, 0.2, 0.1);
      drip(0.1, -0.04, -0.17, 0.08, 0.025, 0.2, -0.1);
      // fringe
      addMesh(hair, geo('fringe', () => new THREE.SphereGeometry(0.09, 16, 12)), M.goo, { pos: [0.07, 0.12, 0.13], scale: [1.4, 0.55, 0.7], rot: [0.4, 0, -0.3] });
    } else if (style === 'twin') {
      for (const side of [-1, 1]) {
        addMesh(hair, geo('drop2', () => dropletGeometry(0.085, 0.22)), M.goo, { pos: [0.2 * side, -0.05, -0.08], rot: [0, 0, Math.PI + 0.35 * side] });
      }
      addMesh(hair, geo('fringe', () => new THREE.SphereGeometry(0.09, 16, 12)), M.goo, { pos: [-0.05, 0.13, 0.12], scale: [1.6, 0.5, 0.7], rot: [0.5, 0, 0.25] });
    } else if (style === 'mohawk') {
      for (let i = 0; i < 4; i++) {
        addMesh(hair, geo('drop3', () => dropletGeometry(0.06, 0.15)), M.goo, { pos: [0, 0.2 - i * 0.02, 0.08 - i * 0.09], rot: [-0.5 - i * 0.35, 0, 0] });
      }
      drip(0, -0.06, -0.19, 0.1, 0.03, 0.15, 0);
    } else {
      // bob: longer cap with drips all around the back
      addMesh(hair, geo('bob', () => new THREE.SphereGeometry(0.235, 30, 20, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.72)), M.goo, { pos: [0, 0.0, -0.01], rot: [0, Math.PI, 0] });
      for (let i = -2; i <= 2; i++) drip(i * 0.08, -0.1, -0.15 + Math.abs(i) * 0.02, 0.06 + (i % 2 ? 0.04 : 0), 0.026, 0.1, i * 0.08);
      addMesh(hair, geo('fringe', () => new THREE.SphereGeometry(0.09, 16, 12)), M.goo, { pos: [0, 0.13, 0.13], scale: [2.0, 0.5, 0.7], rot: [0.45, 0, 0] });
    }
  }

  setLook(look) {
    this.look = { ...look };
    // rebuild everything except preserve root transform + weapon id
    const pos = this.root.position.clone(), rot = this.root.rotation.y, w = this.weaponId;
    this.root.clear();
    this.kid = new THREE.Group();
    this.root.add(this.kid);
    this.build();
    this.weaponId = null;
    this.setWeapon(w);
    this.root.position.copy(pos);
    this.root.rotation.y = rot;
  }

  setTeamColor(c) {
    this.teamColor.set(c);
    this.mats.goo.color.set(c);
    this.mats.goo.emissive.copy(this.mats.goo.color).multiplyScalar(0.12);
    if (this.weapon) for (const m of this.weapon.userData.inkMats) { m.color.set(c); m.emissive.copy(m.color).multiplyScalar(0.12); }
  }

  setWeapon(id) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    if (this.weapon) this.weapon.parent?.remove(this.weapon);
    if (!id) { this.weapon = null; return; }
    this.weapon = buildWeaponModel(id, this.teamColor);
    this.weapon.rotation.x = Math.PI / 2;
    this.weapon.position.set(0, -0.02, 0.0);
    this.arms[1].hand.add(this.weapon);
  }

  muzzleWorld(out) {
    if (!this.weapon) return this.root.getWorldPosition(out).setY(this.root.position.y + 1);
    this.weapon.userData.muzzle.updateWorldMatrix(true, false);
    return this.weapon.userData.muzzle.getWorldPosition(out);
  }

  setInk(f) { this.inkLevel.scale.y = clamp(f, 0.02, 1) * 0.25; }

  flash() { this.hurt = 1; }

  // st: {speed, back, grounded, vy, pitch, aiming, firing, weapon, goo, submerged, climbing, wallNormal, dead, rolling}
  update(dt, st) {
    this.time += dt;
    const sf = clamp(st.speed / 6, 0, 1.6);
    // ---- goo transition
    const gooTarget = st.goo ? 1 : 0;
    this.gooT += (gooTarget - this.gooT) * damp(st.goo ? 22 : 16, dt);
    if (Math.abs(this.gooT - gooTarget) < 0.01) this.gooT = gooTarget;
    const kS = clamp(1 - this.gooT * 1.6, 0, 1);
    this.kid.visible = kS > 0.01;
    this.kid.scale.setScalar(Math.max(kS, 0.001));
    this.goo.visible = this.gooT > 0.05;
    if (this.goo.visible) {
      const gS = clamp(this.gooT * 1.4 - 0.2, 0, 1);
      const wob = Math.sin(this.time * 14) * 0.06 * clamp(sf, 0.2, 1);
      const stretch = 1 + clamp(st.speed / 12, 0, 0.5);
      if (st.climbing) {
        this.goo.rotation.set(0, 0, 0);
        this.blob.scale.set(1.0 * gS, 1.35 * gS, 0.6 * gS);
        this.blob.position.set(0, 0.35, -0.05);
        this.blob.rotation.set(-0.1, 0, 0);
      } else if (st.submerged) {
        this.blob.scale.set(0.95 * gS * (1 - wob), 0.38 * gS, 1.05 * stretch * gS);
        this.blob.position.set(0, -0.02 + Math.sin(this.time * 9) * 0.01, 0);
        this.blob.rotation.set(0, 0, 0);
      } else {
        this.blob.scale.set(1.0 * gS * (1 + wob), 0.72 * gS * (1 - wob), 1.05 * gS * stretch);
        this.blob.position.set(0, 0.22 * gS, 0);
        this.blob.rotation.set(st.grounded ? 0 : clamp(-st.vy * 0.05, -0.5, 0.5), 0, 0);
      }
    }
    if (!this.kid.visible) return;

    // ---- blink
    this.blink -= dt;
    const closed = this.blink < 0.12;
    if (this.blink < 0) this.blink = 2 + Math.random() * 4;
    for (const e of this.eyes) e.scale.y = closed ? 0.12 : 1;

    // ---- hurt flash
    if (this.hurt > 0) {
      this.hurt = Math.max(0, this.hurt - dt * 5);
      const k = this.hurt;
      this.mats.skin.emissive.setRGB(k, k, k);
      this.mats.top.emissive.setRGB(k * 0.8, k * 0.8, k * 0.8);
    }

    // ---- locomotion
    const run = st.grounded && st.speed > 0.4;
    if (run) this.phase += dt * (5 + st.speed * 1.55) * (st.back ? -1 : 1);
    const ph = this.phase;
    const A = run ? clamp(0.25 + sf * 0.55, 0, 0.95) : 0;
    const legs = this.legs;
    const swing = Math.sin(ph);
    const tgt = (o, x, k = 18) => { o.rotation.x += (x - o.rotation.x) * damp(k, dt); };
    if (!st.grounded) {
      const up = st.vy > 0;
      tgt(legs[0].leg, up ? -0.7 : -0.3, 12); tgt(legs[0].knee, up ? 1.2 : 0.5, 12);
      tgt(legs[1].leg, up ? 0.2 : 0.1, 12); tgt(legs[1].knee, up ? 0.5 : 0.3, 12);
    } else {
      tgt(legs[0].leg, -swing * A, 30); tgt(legs[1].leg, swing * A, 30);
      tgt(legs[0].knee, run ? 0.15 + Math.max(0, Math.cos(ph)) * A * 1.4 : 0.05, 30);
      tgt(legs[1].knee, run ? 0.15 + Math.max(0, -Math.cos(ph)) * A * 1.4 : 0.05, 30);
    }
    for (const l of legs) l.foot.rotation.x = -l.leg.rotation.x * 0.4 - l.knee.rotation.x * 0.5;
    const bob = run ? Math.abs(Math.cos(ph)) * 0.045 * sf : Math.sin(this.time * 2.2) * 0.006;
    this.hips.position.y = 0.6 + bob - (run ? 0.02 : 0);
    const leanTarget = run ? (st.back ? -0.1 : 0.12 * sf) : 0;
    this.lean += (leanTarget - this.lean) * damp(10, dt);
    this.spine.rotation.x = this.lean;
    this.spine.rotation.y = run ? Math.sin(ph) * 0.12 * sf : 0;
    this.hips.rotation.y = run ? -Math.sin(ph) * 0.1 * sf : 0;

    // ---- arms
    const [aL, aR] = this.arms;
    const pitch = st.pitch || 0;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    const weapon = st.weapon || this.weaponId;
    let emote = this.emote;
    if (emote && (run || st.aiming)) emote = null;
    this.neck.rotation.x += ((emote === 'sad' ? 0.4 : -clamp(pitch, -0.6, 0.6) * 0.35) - this.neck.rotation.x) * damp(12, dt);
    this.neck.rotation.y = 0;
    if (emote) {
      this.applyEmote(emote, dt);
    } else if (weapon === 'roller') {
      this.flick = Math.max(0, this.flick - dt * 3.2);
      const f = this.flick > 0 ? Math.sin((1 - this.flick) * Math.PI) : 0;
      const down = st.rolling ? -0.8 : -0.55;
      const sx = down - f * 2.0;
      for (const a of [aL, aR]) {
        tgt(a.sh, sx, 25);
        a.sh.rotation.z = a.side * -0.05 + (a === aL ? 0.42 : -0.05);
        tgt(a.elbow, -0.05, 25);
      }
      aL.sh.rotation.y = -0.2;
      aR.sh.rotation.y = 0;
      if (this.weapon) {
        this.weapon.rotation.x = Math.PI / 2;
        this.weapon.position.set(-0.05, -0.05, 0);
        const drum = this.weapon.getObjectByName('drum');
        if (drum && st.rolling) drum.rotation.x -= dt * st.speed * 8;
      }
    } else if (st.aiming || st.firing) {
      const ax = -Math.PI / 2 - pitch * 0.9 + this.recoil * 0.12;
      tgt(aR.sh, ax, 40); aR.sh.rotation.z = 0.05; aR.sh.rotation.y = 0.12;
      tgt(aR.elbow, -0.08, 40);
      tgt(aL.sh, ax + 0.1, 40); aL.sh.rotation.z = -0.55; aL.sh.rotation.y = -0.55;
      tgt(aL.elbow, -0.75, 40);
      if (this.weapon) { this.weapon.rotation.x = Math.PI / 2; this.weapon.position.set(0, -0.02, -this.recoil * 0.03); }
    } else {
      const sw = run ? swing * A * 0.9 : Math.sin(this.time * 2.2) * 0.03;
      tgt(aL.sh, sw - 0.05, 20); aL.sh.rotation.z = -0.12; aL.sh.rotation.y = 0;
      tgt(aL.elbow, run ? -0.5 - Math.max(0, sw) * 0.6 : -0.15, 20);
      tgt(aR.sh, run ? -0.55 - sw * 0.25 : -0.5, 20); aR.sh.rotation.z = 0.1; aR.sh.rotation.y = 0.1;
      tgt(aR.elbow, -0.85, 20);
      if (this.weapon) { this.weapon.rotation.x = Math.PI / 2 + 0.25; this.weapon.position.set(0, -0.02, 0); }
    }
    if (!st.grounded && !emote) {
      tgt(aL.sh, -2.2, 10);
      aL.sh.rotation.z = -0.5;
    }
  }

  applyEmote(name, dt) {
    const [aL, aR] = this.arms;
    const t = this.time;
    const tgt = (o, x, k = 14) => { o.rotation.x += (x - o.rotation.x) * damp(k, dt); };
    if (name === 'wave') {
      tgt(aR.sh, -2.7); aR.sh.rotation.z = 0.4 + Math.sin(t * 9) * 0.35; tgt(aR.elbow, -0.3);
      tgt(aL.sh, 0); aL.sh.rotation.z = -0.12; tgt(aL.elbow, -0.1);
    } else if (name === 'cheer') {
      const b = Math.abs(Math.sin(t * 7));
      this.hips.position.y = 0.6 + b * 0.12;
      for (const a of [aL, aR]) { tgt(a.sh, -2.9); a.sh.rotation.z = a.side * (0.5 + b * 0.2); tgt(a.elbow, -0.2); }
    } else if (name === 'dance') {
      const b = Math.sin(t * 8);
      this.hips.position.y = 0.6 + Math.abs(b) * 0.06;
      this.spine.rotation.z = b * 0.15;
      this.hips.rotation.y = b * 0.3;
      tgt(aL.sh, b > 0 ? -2.6 : -0.6, 18); aL.sh.rotation.z = -0.4;
      tgt(aR.sh, b > 0 ? -0.6 : -2.6, 18); aR.sh.rotation.z = 0.4;
      tgt(aL.elbow, -0.6); tgt(aR.elbow, -0.6);
    } else if (name === 'sad') {
      this.spine.rotation.x = 0.25;
      for (const a of [aL, aR]) { tgt(a.sh, 0.15); a.sh.rotation.z = a.side * -0.05; tgt(a.elbow, -0.05); }
    } else if (name === 'think') {
      tgt(aR.sh, -1.4); aR.sh.rotation.z = -0.5; tgt(aR.elbow, -2.0);
      tgt(aL.sh, -0.4); aL.sh.rotation.z = 0.6; tgt(aL.elbow, -1.6);
      this.neck.rotation.z = Math.sin(t * 1.5) * 0.12;
    } else if (name === 'sit') {
      this.hips.position.y = 0.42;
      for (const l of this.legs) { tgt(l.leg, -1.5); tgt(l.knee, 1.5); }
      tgt(aL.sh, -0.3); tgt(aR.sh, -0.3);
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.material && o.material !== OUTLINE_MAT) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) m.dispose?.();
      }
    });
    this.root.parent?.remove(this.root);
  }
}
