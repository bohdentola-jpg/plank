// A person: a Rocketbox avatar instance with a face API. Built from a "DNA"
// record (src/data/cast.js): { avatar, height (scale), tint (cloth colour),
// tintAmt, sex (derived from the avatar when missing) }.
//
//   const ch = await buildCharacter(dna);  scene.add(ch.group);
//   ch.group     — place/rotate this
//   ch.holder    — the scaled body inside it
//   ch.bones     — Bip01_* bones by name, plus .head (a point riding the head
//                  bone, 8 cm under the eyes: the director adds 6 cm for eye line)
//   ch.meshes    — body, head, hair (+ glasses, hat… per avatar)
//   ch.morph(name, v) / ch.setExpr(name, v) — blendshapes (ARKit names, visemes,
//                  or the old MakeHuman expression names)
import * as THREE from 'three';
import { AVATARS, PLAYER_AVATARS } from './catalog.js';
import { loadAvatar, loadClips, instantiate } from './loader.js';

// old expression names (MakeHuman rig) → blendshapes [name, gain]
const LEGACY = {
  'eye-left-closure': [['AK_09_EyeBlinkLeft', 1]], 'eye-right-closure': [['AK_10_EyeBlinkRight', 1]],
  'eye-left-slit': [['AK_19_EyeSquintLeft', 1]], 'eye-right-slit': [['AK_20_EyeSquintRight', 1]],
  'eye-left-opened-up': [['AK_21_EyeWideLeft', 1]], 'eye-right-opened-up': [['AK_22_EyeWideRight', 1]],
  'eyebrows-left-up': [['AK_04_BrowOuterUpLeft', 1], ['AK_03_BrowInnerUp', 0.5]], 'eyebrows-right-up': [['AK_05_BrowOuterUpRight', 1], ['AK_03_BrowInnerUp', 0.5]],
  'eyebrows-left-down': [['AK_01_BrowDownLeft', 1]], 'eyebrows-right-down': [['AK_02_BrowDownRight', 1]],
  'eyebrows-left-inner-up': [['AK_03_BrowInnerUp', 0.5]], 'eyebrows-right-inner-up': [['AK_03_BrowInnerUp', 0.5]],
  'mouth-open': [['AK_25_JawOpen', 1]], 'mouth-corner-puller': [['AK_44_MouthSmileLeft', 1], ['AK_45_MouthSmileRight', 1]],
  'mouth-depression': [['AK_30_MouthFrownLeft', 1], ['AK_31_MouthFrownRight', 1]], 'mouth-pursing': [['AK_38_MouthPucker', 1]],
  'mouth-retraction': [['AK_46_MouthStretchLeft', 1], ['AK_47_MouthStretchRight', 1]], 'mouth-protusion': [['AK_32_MouthFunnel', 1]],
  'mouth-compression': [['AK_36_MouthPressLeft', 1], ['AK_37_MouthPressRight', 1]], 'mouth-elevation': [['AK_43_MouthShrugUpper', 1]],
  'nose-left-elevation': [['AK_50_NoseSneerLeft', 1]], 'nose-right-elevation': [['AK_51_NoseSneerRight', 1]],
};

export const DEFAULT_DNA = { avatar: 'Male_Adult_07', height: 1 };

/** Which avatar a DNA record means (old MakeHuman profiles fall back by sex). */
export function avatarOf(dna = {}) {
  if (dna.avatar && AVATARS[dna.avatar]) return dna.avatar;
  const female = (dna.sex ?? 1) < 0.5;
  const pool = PLAYER_AVATARS.filter((id) => AVATARS[id].sex === (female ? 'f' : 'm'));
  return pool[Math.abs(dna.seed | 0) % pool.length] || DEFAULT_DNA.avatar;
}

export class Character {
  constructor(tpl, lib, dna, opts = {}) {
    this.dna = dna;
    this.avatar = tpl.id;
    this.meta = tpl.meta;
    this.sex = tpl.meta.sex === 'f' ? 'f' : 'm';
    this.lib = lib;
    this.group = new THREE.Group();
    this.group.name = 'person:' + tpl.id;
    this.holder = new THREE.Group();
    this.holder.name = 'person';
    this.group.add(this.holder);
    const root = instantiate(tpl);
    this.root = root;
    this.holder.add(root);
    const s = dna.height || 1;
    this.holder.scale.setScalar(s);
    this.meshes = {};
    this.bones = {};
    this.materials = [];
    let skeleton = null;
    root.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) {
        this.meshes[o.name] = o;
        o.frustumCulled = opts.frustumCulled ?? true;
        // one skeleton for every part: bone matrices are computed once a frame
        if (!skeleton) skeleton = o.skeleton;
        else { o.skeleton.dispose(); o.bind(skeleton, o.bindMatrix); }
      }
    });
    this.skeleton = skeleton;
    // hair: the soft-edged second pass
    const hair = this.meshes.hair;
    if (hair?.material.userData.fringe) {
      const fr = new THREE.SkinnedMesh(hair.geometry, hair.material.userData.fringe);
      fr.name = 'hairFringe';
      fr.bind(skeleton, hair.bindMatrix);
      fr.renderOrder = 2;
      fr.frustumCulled = hair.frustumCulled;
      fr.castShadow = false;
      fr.receiveShadow = true;
      hair.add(fr);   // a child: hiding the hair hides both (same transform: the root's)
      this.meshes.hairFringe = fr;
    }
    // optional parts (hats) start shown; keep: listed parts are hideable via setPart
    // clothes tint (per person: its own copy of the cloth material)
    if (dna.tint && this.meshes.body) this.setClothTint(dna.tint, dna.tintAmt ?? 0.75);
    // the face
    const head = this.meshes.head;
    this.morphDict = head?.morphTargetDictionary || {};
    this.influences = head?.morphTargetInfluences || [];
    this.morphIndex = {};
    for (const [k, i] of Object.entries(this.morphDict)) {
      this.morphIndex[k] = i;
      this.morphIndex[k.replace(/^(AK|AA_VI)_\d+_/, '')] = i;   // short names: JawOpen, aa, PP
    }
    this.hair = { group: this.meshes.hair || new THREE.Object3D() };
    // a point on the head the director can track (it adds 6 cm for the eye line)
    root.updateMatrixWorld(true);
    const hb = this.bones.Bip01_Head;
    const eyes = new THREE.Vector3();
    const le = this.bones.Bip01_LEye, re = this.bones.Bip01_REye;
    if (le && re) eyes.setFromMatrixPosition(le.matrixWorld).add(new THREE.Vector3().setFromMatrixPosition(re.matrixWorld)).multiplyScalar(0.5);
    else eyes.setFromMatrixPosition(hb.matrixWorld).add(new THREE.Vector3(0, 0.1 * s, 0.08 * s));
    this.eyeHeight = eyes.y / s;
    const anchor = new THREE.Object3D();
    anchor.name = 'headAnchor';
    hb.add(anchor);
    anchor.position.copy(hb.worldToLocal(eyes.clone().add(new THREE.Vector3(0, -0.08 * s, 0))));
    this.bones.head = anchor;
    this.headBone = hb;
    this.height = (tpl.meta.height || 1.75) * s;
    this.hip = (tpl.meta.hip || 0.9);
    // level of detail: the animator throttles people far from the camera or out of view
    this.camDist = 0;
    this.seenAt = performance.now() / 1000;
    const probe = this.meshes.body || this.meshes.head;
    if (probe) {
      const p = new THREE.Vector3();
      probe.onBeforeRender = (r, sc, cam) => {
        this.seenAt = performance.now() / 1000;
        this.camDist = cam.position.distanceTo(p.setFromMatrixPosition(this.group.matrixWorld));
      };
    }
  }

  /** Blendshape by name (ARKit 'AK_25_JawOpen' / 'JawOpen', viseme 'AA_VI_10_aa' / 'aa'). */
  morph(name, v) {
    const i = this.morphIndex[name];
    if (i !== undefined) this.influences[i] = v;
  }

  /** Expression unit (blendshape name or an old MakeHuman expression name), 0..1. */
  setExpr(name, v) {
    const map = LEGACY[name];
    if (map) for (const [n, g] of map) this.morph(n, v * g);
    else this.morph(name, v);
  }

  applyExpr() { /* morph influences are live */ }

  /** Tint the clothes (hands stay as they are). color: hex/Color or null. */
  setClothTint(color, amount = 0.75) {
    const body = this.meshes.body;
    if (!body) return;
    if (!this._ownCloth) {
      const m = body.material.clone();
      m.userData.tint = { value: new THREE.Color(1, 1, 1) };
      m.userData.tintAmt = { value: 0 };
      m.onBeforeCompile = body.material.onBeforeCompile;
      m.customProgramCacheKey = body.material.customProgramCacheKey;
      // the clone's onBeforeCompile must reach the clone's own uniforms
      const src = body.material.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => { src.call(m, sh, r); sh.uniforms.clothTint = m.userData.tint; sh.uniforms.clothTintAmt = m.userData.tintAmt; };
      body.material = m;
      this.materials.push(m);
      this._ownCloth = m;
    }
    const m = this._ownCloth;
    if (color == null) m.userData.tintAmt.value = 0;
    else { m.userData.tint.value.set(color); m.userData.tintAmt.value = amount; }
  }

  /** Show/hide an optional part (hat, glasses, pistol…). */
  setPart(name, on) { if (this.meshes[name]) this.meshes[name].visible = on; }

  /** First person: hide everything above the collar. */
  setFirstPerson(on) {
    for (const k of ['head', 'hair', 'glasses', 'hat', 'cap', 'helmet']) if (this.meshes[k]) this.meshes[k].visible = !on;
  }

  dispose() {
    this.group.removeFromParent();
    for (const m of this.materials) m.dispose();
    this.skeleton?.dispose();
    this.animator?.dispose?.();
  }
}

/** Build a person (async: the avatar and its sex's clips load once, then come from cache). */
export async function buildCharacter(dnaIn = {}, opts = {}) {
  const id = avatarOf(dnaIn);
  const tpl = await loadAvatar(id);
  const lib = await loadClips(tpl.meta.sex);
  const dna = { ...dnaIn, avatar: tpl.id, sex: tpl.meta.sex === 'f' ? 0 : 1 };
  return new Character(tpl, lib, dna, opts);
}
