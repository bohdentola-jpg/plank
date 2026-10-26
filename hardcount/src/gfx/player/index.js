// Player and official models for HARD COUNT.
//
//   const m = createPlayerModel({ team, kit: 'home' | 'away', player, lod: 'high' | 'low' });
//   scene.add(m.group);          // root at the feet, yards, faces +z at heading 0
//   m.update(dt, A);             // A = anim state (src/sim/anims.js)
//   m.setKit(team, kit); m.setPlayer(player); m.setDirt(0..1); m.setHelmet(on); m.setLod(lod)
//   m.ballTransform(carry, outPos, outQuat); m.headWorld(out); m.handWorld('L' | 'R', out)
//   m.dispose();
//   const r = createRefModel({ role: 'referee' | 'umpire' | 'judge', lod });  // + r.setFlag(on)
//
// Draw calls: body (one skinned mesh: uniform, skin, face, eyes, hair, cleats,
// gloves, props) + helmet (shell + facemask + strap, team material) + visor
// when worn. Low LOD: the same two with lighter meshes, no visor.
import * as THREE from 'three';
import { M_TO_YD } from '../../sim/field.js';
import { makeRng, hashString } from '../../core/util.js';
import { B, NB, PARENT, BONE_NAMES, makeBuild, makeRigDims } from './rig.js';
import { buildBody, headCenter, headScale, MeshBuilder } from './body.js';
import { paintAtlas, REF_KIT } from './atlas.js';
import { makeBodyMaterial, visorMaterial } from './materials.js';
import { helmetGeometry, helmetMaterialFor, visorGeometry, addHelmetNumberDecal } from './helmet.js';
import { hairParts } from './hair.js';
import { Animator } from './animator.js';
import { R, uvOf, ATLAS } from './layout.js';
import { ACTIONS } from '../../sim/anims.js';

export { createBallModel } from '../ball.js';

const YARD_M = 0.9144;
/** Height (yards) of the bench seat the 'sit' base sits on: put benches this high. */
export const SEAT_HEIGHT = 0.46 / YARD_M;
const HELMET_SCALE = 1.05;   // helmets read a touch big, like the games

// ---------------------------------------------------------------- shared body geometry (ref-counted)

const geoCache = new Map();
function acquireBody(key, make) {
  let e = geoCache.get(key);
  if (!e) { e = { ...make(), refs: 0 }; geoCache.set(key, e); }
  e.refs++;
  return e;
}
function releaseBody(key) {
  const e = geoCache.get(key);
  if (!e) return;
  if (--e.refs <= 0) { e.geometry.dispose(); geoCache.delete(key); }
}
/** Number of distinct body geometries alive (QA: re-dressing must not leak them). */
export function bodyCacheSize() { return geoCache.size; }

// officials' cap (shared): a crown over the head + a bill, mapped to the CAP swatch
let capGeo = null;
function capGeometry() {
  if (capGeo) return capGeo;
  const mb = new MeshBuilder();
  const uv = uvOf(R.CAP, 0.35, 0.5, [0, 0]);
  const crown = new THREE.SphereGeometry(0.098, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5);
  crown.scale(0.86, 0.7, 1.0);
  crown.translate(0, 0.045, -0.004);
  mb.piece(crown, new THREE.Matrix4(), (lx, ly, lz, gu, gv, out) => { out[0] = uv[0]; out[1] = uv[1]; }, () => [0, 1]);
  crown.dispose();
  // bill: a curved, slightly drooping plate, two-sided
  const verts = [], tris = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = (-0.42 + (0.84 * i) / n) * Math.PI;
    for (const [r, y] of [[0.088, 0.05], [0.158, 0.034]]) {
      const p = new THREE.Vector3(Math.sin(a) * r * 0.86, y - Math.abs(Math.sin(a)) * 0.004, Math.cos(a) * r);
      verts.push({ p, n: new THREE.Vector3(0, 1, 0.1).normalize(), uv, w: [0, 1] });
      verts.push({ p: p.clone().add(new THREE.Vector3(0, -0.004, 0)), n: new THREE.Vector3(0, -1, 0), uv, w: [0, 1] });
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    tris.push([a, a + 2, a + 6], [a, a + 6, a + 4]);
    tris.push([a + 1, a + 5, a + 7], [a + 1, a + 7, a + 3]);
  }
  mb.raw(verts, tris);
  const g = mb.build();
  g.deleteAttribute('skinIndex');
  g.deleteAttribute('skinWeight');
  capGeo = g;
  return g;
}

let flagGeo = null;
function flagGeometry() {
  if (flagGeo) return flagGeo;
  const g = new THREE.SphereGeometry(0.035, 6, 4);
  g.scale(1, 1.6, 0.8);
  g.translate(0, -0.06, 0.01);
  const uv = uvOf(R.CAP, 0.86, 0.5, [0, 0]);
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0], uv[1]);
  flagGeo = g;
  return g;
}

// ---------------------------------------------------------------- model

const REF_ROLES = {
  referee: { cap: '#f4f4f2', letter: 'R' },
  umpire: { cap: '#111111', letter: 'U' },
  judge: { cap: '#111111', letter: 'J' },
};

function refPlayer(role, seed) {
  const rng = makeRng(hashString('ref:' + role + ':' + seed));
  const skins = ['#f1d3bd', '#e5b896', '#d4a07a', '#c08a63', '#8d5a3a', '#5c3521'];
  const skinI = Math.floor(rng() * skins.length);
  return {
    id: 'ref-' + role, last: role.toUpperCase(), first: '', number: Math.floor(rng() * 120) + 1, pos: 'REF',
    height: 70 + Math.floor(rng() * 6), weight: 190 + Math.floor(rng() * 50),
    look: {
      skin: skinI / 5, skinHex: skins[skinI], hair: rng.pick(['short', 'buzz', 'bald', 'fade']),
      hairColor: rng.pick(['#2b1d14', '#3d2a1c', '#6a6560', '#9a958e', '#1b1612']), beard: rng() < 0.3 ? 'stubble' : 'none',
      eyeBlack: 'none', visor: null, sleeves: 'none', gloves: false, wristbands: false, towel: false, neckRoll: false,
      handWarmer: false, facemask: 'skill', socks: 'high', shoes: 'low', armBand: false, bodyType: 'ref',
    },
  };
}

class PlayerModel {
  constructor(o) {
    this.lod = o.lod === 'low' ? 'low' : 'high';
    this.ref = o.ref || null;
    this.team = o.team || null;
    this.kitName = typeof o.kit === 'string' ? o.kit : 'home';
    this.kitObj = typeof o.kit === 'object' ? o.kit : null;
    this.player = this.ref ? refPlayer(this.ref, o.seed || 0) : (o.player || {});
    this.helmetOn = !this.ref;
    this.dirt = 0;
    this.flagOn = false;
    this.group = new THREE.Group();
    this.group.name = this.ref ? `official-${this.ref}` : `player-${this.player.number ?? ''}`;
    this.group.scale.setScalar(M_TO_YD);
    this.atlas = document.createElement('canvas');
    this.atlas.width = this.atlas.height = ATLAS;
    this.atlasTex = new THREE.CanvasTexture(this.atlas);
    this.atlasTex.colorSpace = THREE.SRGBColorSpace;
    this.atlasTex.anisotropy = 4;
    this.material = makeBodyMaterial(this.atlasTex);
    this._x = 0; this._z = 0; this._h = 0;
    this._build();
  }

  get kit() {
    if (this.ref) return REF_KIT;
    if (this.kitObj) return this.kitObj;
    const u = this.team?.uniform;
    return (u && (u[this.kitName] || u.home)) || REF_KIT;
  }

  _bodyKey() {
    const p = this.player, L = p.look || {};
    const bd = this.bd;
    const hn = !this.ref && !!this.team?.helmet?.number;
    return [bd.hIn, bd.wLb, bd.type, L.shoes, !!L.towel, !!L.neckRoll, !!L.handWarmer, L.hair, this.lod, hn, this.ref || ''].join('|');
  }

  _build() {
    const p = this.player;
    const L = p.look || {};
    const wq = Math.round((p.weight ?? 215) / 5) * 5;
    this.bd = makeBuild({ ...p, weight: wq }, { pads: !this.ref, type: this.ref ? 'ref' : undefined });
    this.dims = makeRigDims(this.bd);
    const d = this.dims;
    // skeleton
    if (!this.bones) {
      this.bones = BONE_NAMES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
      for (let i = 1; i < NB; i++) this.bones[PARENT[i]].add(this.bones[i]);
      this.skeleton = new THREE.Skeleton(this.bones, this.bones.map(() => new THREE.Matrix4()));
    }
    for (let i = 0; i < NB; i++) {
      this.bones[i].position.copy(d.off[i]);
      this.bones[i].quaternion.identity();
      const bp = d.bind[i];
      this.skeleton.boneInverses[i].makeTranslation(-bp.x, -bp.y, -bp.z);
    }
    // body geometry
    const key = this._bodyKey();
    if (this.bodyKey !== key) {
      if (this.bodyKey) releaseBody(this.bodyKey);
      const C = headCenter(d), hs = headScale(this.bd);
      const hp = hairParts(L, C, hs, this.lod);
      const hn = !this.ref && !!this.team?.helmet?.number;
      this.bodyEntry = acquireBody(key, () => buildBody(d, L, {
        lod: this.lod,
        whistle: !!this.ref,
        helmetOn: hn ? [(mb) => addHelmetNumberDecal(mb, C, hs * HELMET_SCALE, B.head)] : [],
        hairAlways: hp.always,
        hairOff: hp.off,
      }));
      this.bodyKey = key;
    }
    if (!this.body) {
      this.body = new THREE.SkinnedMesh(this.bodyEntry.geometry, this.material);
      this.body.name = 'body';
      this.body.castShadow = true;
      this.body.receiveShadow = true;
      this.body.add(this.bones[0]);
      this.body.bind(this.skeleton, new THREE.Matrix4());
      this.body.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.4);
      this.group.add(this.body);
    } else {
      this.body.geometry = this.bodyEntry.geometry;
    }
    this._applyRange();
    // helmet / cap
    const headBone = this.bones[B.head];
    const C = headCenter(d), hs = headScale(this.bd);
    const rel = C.clone().sub(d.bind[B.head]);
    if (this.ref) {
      if (!this.cap) {
        this.cap = new THREE.Mesh(capGeometry(), this.material);
        this.cap.castShadow = true;
        headBone.add(this.cap);
        this.flag = new THREE.Mesh(flagGeometry(), this.material);
        this.flag.visible = false;
        this.bones[B.handR].add(this.flag);
      }
      this.cap.position.copy(rel).add(new THREE.Vector3(0, 0.035 * hs, 0.0));
      this.cap.scale.setScalar(hs);
      this.flag.position.set(-0.01, -0.06 * this.bd.s, 0.0);
    } else {
      const style = L.facemask || 'skill';
      const g = helmetGeometry(style, this.lod);
      const mat = helmetMaterialFor(this.team || { id: 'none', helmet: {}, colors: {} }, this.lod);
      if (!this.helmet) {
        this.helmet = new THREE.Mesh(g, mat);
        this.helmet.name = 'helmet';
        this.helmet.castShadow = true;
        this.helmet.receiveShadow = true;
        headBone.add(this.helmet);
      } else { this.helmet.geometry = g; this.helmet.material = mat; }
      this.helmet.position.copy(rel);
      this.helmet.scale.setScalar(hs * HELMET_SCALE);
      const wantVisor = this.lod === 'high' && !!L.visor;
      if (wantVisor) {
        if (!this.visor) { this.visor = new THREE.Mesh(visorGeometry(), visorMaterial(L.visor)); this.visor.renderOrder = 2; headBone.add(this.visor); }
        this.visor.material = visorMaterial(L.visor);
        this.visor.position.copy(rel);
        this.visor.scale.setScalar(hs * HELMET_SCALE);
      } else if (this.visor) { this.visor.removeFromParent(); this.visor = null; }
      this.helmet.visible = this.helmetOn;
      if (this.visor) this.visor.visible = this.helmetOn;
    }
    // animator
    if (!this.animator) this.animator = new Animator(d, (hashString(String(p.id || p.last || 'p')) % 1000) / 1000);
    else this.animator.setDims(d);
    this._paint();
    // settle into a pose right away (menus build and draw on the same frame)
    this.update(0, this._lastA || { base: this.ref ? 'ref' : 'stand' });
  }

  _applyRange() {
    const r = this.bodyEntry.ranges[this.helmetOn ? 'helmetOn' : 'helmetOff'];
    this.body.geometry.setDrawRange(r.start, r.count);
  }

  _paint() {
    const team = this.team || { colors: {}, helmet: {} };
    const role = this.ref ? REF_ROLES[this.ref] || REF_ROLES.referee : null;
    paintAtlas(this.atlas, {
      team, kit: this.kit, player: this.player, look: this.player.look || {},
      landmarks: {
        vAtY: this.bodyEntry.landmarks.vAtY, vFromTop: this.bodyEntry.landmarks.vFromTop,
        armV: limbVFn(this.dims, 'arm'), legV: limbVFn(this.dims, 'leg'),
      },
      ref: !!this.ref, refLetter: role?.letter, capColor: role?.cap,
      helmetNumber: !this.ref && !!team.helmet?.number, shellColor: team.helmet?.shell,
    });
    this.atlasTex.needsUpdate = true;
  }

  // ------------------------------------------------------------ public API

  update(dt, A) {
    this._lastA = A;
    this._x = A.x || 0; this._z = A.z || 0; this._h = A.heading || 0;
    this._y = A.y || 0;
    this.group.position.set(this._x, this._y, this._z);
    this.group.rotation.set(0, this._h, 0);
    if (A.dirt !== undefined && A.dirt !== this.dirt) this.setDirt(A.dirt);
    this.animator.update(dt, A);
    this.animator.writeBones(this.bones);
    if (this.flag) {
      const throwing = A.action?.name === 'sig_flag' && (A.action.t || 0) < (ACTIONS.sig_flag.key.release);
      this.flag.visible = this.flagOn || throwing;
    }
  }

  setKit(team, kit) {
    const helmetNumberChanged = !!team?.helmet?.number !== !!this.team?.helmet?.number;
    this.team = team || this.team;
    if (typeof kit === 'string') { this.kitName = kit; this.kitObj = null; } else if (kit) this.kitObj = kit;
    if (helmetNumberChanged) { this._build(); return; }
    if (this.helmet) this.helmet.material = helmetMaterialFor(this.team, this.lod);
    this._paint();
  }

  setPlayer(player) {
    if (this.ref) return;
    this.player = player || {};
    this.group.name = `player-${this.player.number ?? ''}`;
    this._build();
  }

  setLod(lod) {
    lod = lod === 'low' ? 'low' : 'high';
    if (lod === this.lod) return;
    this.lod = lod;
    this._build();
  }

  setDirt(v) {
    this.dirt = Math.max(0, Math.min(1, v || 0));
    this.material.userData.dirt.value = this.dirt;
  }

  setHelmet(on) {
    if (this.ref) return;
    this.helmetOn = !!on;
    if (this.helmet) this.helmet.visible = this.helmetOn;
    if (this.visor) this.visor.visible = this.helmetOn;
    this._applyRange();
  }

  setFlag(on) { this.flagOn = !!on; if (this.flag) this.flag.visible = this.flagOn; }

  _toWorld(p, out) {
    const c = Math.cos(this._h), s = Math.sin(this._h);
    const x = p.x * M_TO_YD, y = p.y * M_TO_YD, z = p.z * M_TO_YD;
    out.set(this._x + x * c + z * s, (this._y || 0) + y, this._z - x * s + z * c);
    return out;
  }

  /** World transform of a held ball (ball model: long axis +z, laces +y). */
  ballTransform(carry, outPos, outQuat) {
    const an = this.animator, s = this.dims.s;
    const pos = an.pos, rot = an.rot;
    const p = _bp, q = _bq;
    if (carry === 'two') {
      p.set(0, 0, 0);
      for (const [hb, sg] of [[B.handL, 1], [B.handR, -1]]) {
        _bv.set(-sg * 0.045 * s, -0.065 * s, 0.01 * s).applyQuaternion(rot[hb]).add(pos[hb]);
        p.addScaledVector(_bv, 0.5);
      }
      q.copy(rot[B.chest]);
      // keep the ball level-ish and pointing where the chest points
      _bv.set(0, 0, 1).applyQuaternion(q);
      _bv.y *= 0.3;
      _bv.normalize();
      q.setFromUnitVectors(_bz, _bv);
    } else {
      const L = carry === 'L';
      const hb = L ? B.handL : B.handR, sg = L ? 1 : -1;
      // tucked: lying along the inside of the forearm, nose in the palm
      _bv.set(-sg * 0.075 * s, 0.11 * s, 0.006 * s).applyQuaternion(rot[hb]).add(pos[hb]);
      _bq2.copy(rot[hb]).multiply(_tuckQ);
      // palm: in the fingers, nose along the thumb, laces under the fingers — in the
      // hand the clip throws with (a lefty's throw keeps the ball in his left hand)
      if (an.grip > 0.001) {
        const PL = an.clipNow && an.clipNow.grip === 'palm' ? an.side === 'L' : L;
        const pb = PL ? B.handL : B.handR, ps = PL ? 1 : -1;
        _bv2.set(-ps * 0.05 * s, -0.075 * s, 0.0).applyQuaternion(rot[pb]).add(pos[pb]);
        _bq3.copy(rot[pb]).multiply(PL ? _palmQL : _palmQR);
        _bv.lerp(_bv2, an.grip);
        _bq2.slerp(_bq3, an.grip);
      }
      p.copy(_bv);
      q.copy(_bq2);
    }
    if (outPos) this._toWorld(p, outPos);
    if (outQuat) { _hq.setFromAxisAngle(_by, this._h); outQuat.multiplyQuaternions(_hq, q); }
    return outPos;
  }

  headWorld(out) {
    const an = this.animator, s = this.dims.s;
    _bv.set(0, 0.09 * s, 0.025 * s).applyQuaternion(an.rot[B.head]).add(an.pos[B.head]);
    return this._toWorld(_bv, out);
  }

  handWorld(side, out) {
    const an = this.animator, s = this.dims.s;
    const hb = side === 'L' ? B.handL : B.handR;
    _bv.set(0, -0.07 * s, 0.005 * s).applyQuaternion(an.rot[hb]).add(an.pos[hb]);
    return this._toWorld(_bv, out);
  }

  /** Triangle and draw-call counts (QA). */
  stats() {
    const r = this.bodyEntry.ranges[this.helmetOn ? 'helmetOn' : 'helmetOff'];
    let tris = r.count / 3, calls = 1;
    if (this.helmet?.visible) { tris += this.helmet.geometry.index.count / 3; calls++; }
    if (this.visor?.visible) { tris += this.visor.geometry.index.count / 3; calls++; }
    if (this.cap) { tris += this.cap.geometry.index.count / 3; calls++; }
    return { tris: Math.round(tris), calls, bones: NB };
  }

  dispose() {
    this.group.removeFromParent();
    if (this.bodyKey) releaseBody(this.bodyKey);
    this.bodyKey = null;
    this.atlasTex.dispose();
    this.material.dispose();
  }
}

const _bp = new THREE.Vector3(), _bv = new THREE.Vector3(), _bv2 = new THREE.Vector3();
const _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion(), _bq3 = new THREE.Quaternion(), _hq = new THREE.Quaternion();
const _by = new THREE.Vector3(0, 1, 0), _bz = new THREE.Vector3(0, 0, 1);
// ball +z → the hand's fingers (−y): Rx(+90°)
const _tuckQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
// palm grip: ball +z along the thumb (+z), laces (+y) toward the palm (Rz ±90°)
const _palmQL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const _palmQR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);

/** v (texture) along a limb tube for t ∈ [0, 2] (0 joint … 1 middle joint … 2 end), matching body.js. */
function limbVFn(dims, kind) {
  const bd = dims.bd, s = bd.s, m = bd.musc * bd.limb;
  const P = dims.bind;
  const arm = kind === 'arm';
  const L1 = arm ? P[B.armL].distanceTo(P[B.foreL]) : P[B.thighL].distanceTo(P[B.shinL]);
  const L2 = arm ? P[B.foreL].distanceTo(P[B.handL]) : P[B.shinL].distanceTo(P[B.footL]);
  const capR = arm ? 0.061 * s * m : 0.084 * s * m * bd.hip;
  const capH = capR * 0.92;
  const total = L1 + L2;
  return (t) => { const dd = t <= 1 ? t * L1 : L1 + (t - 1) * L2; return 1 - (dd + capH) / (total + capH); };
}

export function createPlayerModel({ team, kit = 'home', player, lod = 'high' } = {}) {
  return new PlayerModel({ team, kit, player, lod });
}

export function createRefModel({ role = 'referee', lod = 'high', seed = 0 } = {}) {
  return new PlayerModel({ ref: REF_ROLES[role] ? role : 'referee', lod, seed });
}

export { PlayerModel };
