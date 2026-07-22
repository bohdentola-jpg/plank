// Weapon model registry. Each build function returns
// { group, muzzle: Vector3, parts: {...} }; results are cached per weapon id
// and cloned for world instances (dropped guns, bot hands).
import * as THREE from '../three.js';
import { genericWeapon } from './common.js';
import * as pistolsA from './pistols_a.js';
import * as pistolsB from './pistols_b.js';
import * as heavy from './heavy.js';
import * as smgsA from './smgs_a.js';
import * as smgsB from './smgs_b.js';
import * as riflesA from './rifles_a.js';
import * as riflesB from './rifles_b.js';
import * as misc from './misc.js';

const BUILDERS = {
  glock: pistolsA.buildGlock, usps: pistolsA.buildUSPS, p2000: pistolsA.buildP2000,
  dualies: pistolsA.buildDualies, p250: pistolsA.buildP250,
  fiveseven: pistolsB.buildFiveSeven, cz75: pistolsB.buildCZ75, tec9: pistolsB.buildTec9,
  deagle: pistolsB.buildDeagle, r8: pistolsB.buildR8,
  nova: heavy.buildNova, xm1014: heavy.buildXM1014, mag7: heavy.buildMAG7,
  sawedoff: heavy.buildSawedOff, m249: heavy.buildM249, negev: heavy.buildNegev,
  mp9: smgsA.buildMP9, mac10: smgsA.buildMAC10, mp5sd: smgsA.buildMP5SD, mp7: smgsA.buildMP7,
  mp8: smgsB.buildMP8, ump45: smgsB.buildUMP45, p90: smgsB.buildP90, bizon: smgsB.buildBizon,
  famas: riflesA.buildFAMAS, galil: riflesA.buildGalil, m4a4: riflesA.buildM4A4,
  m4a1s: riflesA.buildM4A1S, ak47: riflesA.buildAK47,
  aug: riflesB.buildAUG, sg553: riflesB.buildSG553, ssg08: riflesB.buildSSG08,
  awp: riflesB.buildAWP, scar20: riflesB.buildSCAR20, g3sg1: riflesB.buildG3SG1,
  knife: misc.buildKnife,
  he: misc.buildHE, flash: misc.buildFlashbang, smoke: misc.buildSmoke,
  molotov: misc.buildMolotov, incendiary: misc.buildIncendiary, decoy: misc.buildDecoy,
};

const cache = new Map();

// Build (or fetch cached) master model for a weapon id.
export function getModel(id, cls = 'rifle') {
  if (cache.has(id)) return cache.get(id);
  let model;
  const builder = BUILDERS[id];
  try {
    model = builder ? builder() : genericWeapon(cls);
  } catch (err) {
    console.error(`Model builder for "${id}" failed, using fallback:`, err);
    model = genericWeapon(cls);
  }
  if (!model || !model.group) model = genericWeapon(cls);
  model.parts = model.parts || {};
  model.muzzle = model.muzzle || new THREE.Vector3(0, 0.05, -0.4);
  model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  cache.set(id, model);
  return model;
}

// A fresh clone for placing in the world (drops, bot hands). Parts references
// are not tracked on clones — only the first-person viewmodel animates parts.
export function cloneModel(id, cls) {
  const m = getModel(id, cls);
  return { group: m.group.clone(true), muzzle: m.muzzle.clone() };
}

export function listBuilderIds() { return Object.keys(BUILDERS); }
