// Loading people: avatar templates (one GLB per avatar, loaded once, shared by
// every instance: geometry, textures, materials) and the motion-capture clip
// libraries (one per sex). Instances are skeleton clones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { AVATARS } from './catalog.js';
import { upgradeMaterials } from './materials.js';

const BASE = new URL('../../assets/people/', import.meta.url).href;
const loader = new GLTFLoader();
const avatarCache = new Map();
const clipCache = new Map();

function loadGLB(name) {
  return new Promise((resolve, reject) => loader.load(BASE + name, resolve, undefined, (e) => reject(new Error(`people: ${name}: ${e?.message || e}`))));
}

/** The avatar template: { id, scene, meta } (cached). */
export function loadAvatar(id) {
  if (!AVATARS[id]) id = 'Male_Adult_07';
  if (!avatarCache.has(id)) {
    avatarCache.set(id, loadGLB(id + '.glb').then((gltf) => {
      const scene = gltf.scene;
      const meta = scene.userData.people || {};
      upgradeMaterials(scene);
      scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = o.name !== 'glasses';
          o.receiveShadow = true;
          // poses reach further than the bind shape
          o.geometry.computeBoundingSphere();
          o.geometry.boundingSphere.radius *= 1.25;
        }
      });
      return { id, scene, meta: { ...AVATARS[id], ...meta } };
    }).catch((e) => { avatarCache.delete(id); throw e; }));
  }
  return avatarCache.get(id);
}

/** A new skinned copy of a template (shared geometry and materials). Pair with release(). */
export function instantiate(tpl) {
  tpl.users = (tpl.users || 0) + 1;
  clearTimeout(tpl.dropTimer);
  return cloneSkinned(tpl.scene);
}

/**
 * An instance is gone. When nobody has used an avatar for a while (townsfolk
 * left behind across town), its textures and meshes leave the GPU; it loads
 * again (about a megabyte) if someone with that face comes back.
 */
export function release(tpl, keepMs = 45000) {
  tpl.users = Math.max(0, (tpl.users || 0) - 1);
  if (tpl.users || tpl.pinned) return;
  clearTimeout(tpl.dropTimer);
  tpl.dropTimer = setTimeout(() => {
    if (tpl.users) return;
    avatarCache.delete(tpl.id);
    const seen = new Set();
    tpl.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of [o.material, o.material.userData?.fringe].filter(Boolean)) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      }
    });
  }, keepMs);
}

/** Keep an avatar loaded for good (the player). */
export function pin(id, on = true) {
  const p = avatarCache.get(id);
  if (p) p.then((tpl) => { tpl.pinned = on; });
}

/** Bones that move the legs/hips (Biped: the thighs hang off Bip01_Spine). */
export const LOWER = new Set(['Bip01', 'Bip01_Pelvis', 'Bip01_Spine', 'Bip01_L_Thigh', 'Bip01_L_Calf', 'Bip01_L_Foot', 'Bip01_L_Toe0',
  'Bip01_R_Thigh', 'Bip01_R_Calf', 'Bip01_R_Foot', 'Bip01_R_Toe0']);

function split(clip, keep, suffix) {
  const tracks = clip.tracks.filter((t) => keep(t.name.slice(0, t.name.lastIndexOf('.'))));
  return new THREE.AnimationClip(clip.name + suffix, clip.duration, tracks);
}

/** Clip library for a sex: { clips: {name: full}, lower: {}, upper: {}, meta: {name: {dur, loop, speed, phase}}, hip } */
export function loadClips(sex = 'm') {
  sex = sex === 'f' ? 'f' : 'm';
  if (!clipCache.has(sex)) {
    clipCache.set(sex, loadGLB(`anim_${sex}.glb`).then((gltf) => {
      const info = gltf.scene.userData.people || {};
      const lib = { sex, hip: info.hip || 0.9, meta: info.clips || {}, clips: {}, lower: {}, upper: {}, scaled: new Map() };
      for (const c of gltf.animations) {
        lib.clips[c.name] = c;
        lib.lower[c.name] = split(c, (b) => LOWER.has(b), ':lo');
        lib.upper[c.name] = split(c, (b) => !LOWER.has(b), ':up');
      }
      return lib;
    }).catch((e) => { clipCache.delete(sex); throw e; }));
  }
  return clipCache.get(sex);
}

/**
 * The lower-body clip with the root's translation scaled to an avatar's hip
 * height (clips were captured on one skeleton per sex). Cached per scale.
 */
export function lowerClipFor(lib, name, k) {
  const base = lib.lower[name];
  if (!base || Math.abs(k - 1) < 0.004) return base;
  const key = name + '@' + k.toFixed(3);
  let c = lib.scaled.get(key);
  if (!c) {
    const tracks = base.tracks.map((t) => {
      if (t.name !== 'Bip01.position') return t;
      const v = t.values.slice();
      for (let i = 0; i < v.length; i++) v[i] *= k;
      return new THREE.VectorKeyframeTrack(t.name, t.times, v);
    });
    c = new THREE.AnimationClip(base.name, base.duration, tracks);
    lib.scaled.set(key, c);
  }
  return c;
}

/** Warm the caches (e.g. while a scene fades in). */
export function preload(ids = [], sexes = ['m', 'f']) {
  return Promise.all([...ids.map((id) => loadAvatar(id).catch(() => null)), ...sexes.map((s) => loadClips(s).catch(() => null))]);
}
