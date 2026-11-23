// Materials for Rocketbox people, built from the maps in each avatar's GLB:
//  skin  — physical shading with wrapped, red-shifted diffuse (light bleeds a
//          little past the terminator, as through skin), lowered specular F0,
//          a faint sheen (peach fuzz); roughness from the converted specular map
//          (so eyes, lips and teeth are glossy and the cheeks are not);
//  hair  — alpha-to-coverage cards (order-independent with the renderer's MSAA,
//          a clean alpha test without it), double-sided, satin roughness;
//  cloth — standard PBR; the body map's alpha marks cloth vs skin so clothes
//          can be tinted per person (uniforms: clothTint rgb, clothTintAmt);
//  props — glasses blend, everything else is opaque standard.
import * as THREE from 'three';

const WRAP_LINE = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
const WRAPPED = `{
		float nlW = dot( geometryNormal, directLight.direction );
		vec3 wrapNL = saturate( ( vec3( nlW ) + SKIN_WRAP ) / ( 1.0 + SKIN_WRAP ) );
		reflectedLight.directDiffuse += wrapNL * directLight.color * BRDF_Lambert( material.diffuseColor );
	}`;
let skinChunk = null;
function skinLightsChunk() {
  if (!skinChunk) {
    const src = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (!src.includes(WRAP_LINE)) console.warn('people: skin wrap hook not found (three changed?)');
    skinChunk = src.replace(WRAP_LINE, WRAPPED);
  }
  return skinChunk;
}

function texOf(m, k) { return m && m[k] ? m[k] : null; }

/** Skin (face + hands share the head/body maps; the head part is all skin, eyes, mouth). */
export function skinMaterial(src, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'people-skin',
    map: texOf(src, 'map'),
    normalMap: texOf(src, 'normalMap'),
    normalScale: src?.normalScale ? src.normalScale.clone() : new THREE.Vector2(1, 1),
    roughnessMap: texOf(src, 'roughnessMap'),
    roughness: o.roughness ?? 1.0,
    metalness: 0,
    specularIntensity: 0.62,
    sheen: 0.22,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(0.95, 0.62, 0.52),
  });
  const wrap = o.wrap || [0.38, 0.16, 0.1];
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = `#define SKIN_WRAP vec3(${wrap.map((v) => v.toFixed(3)).join(',')})\n` +
      sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', skinLightsChunk());
  };
  m.customProgramCacheKey = () => 'people-skin-' + wrap.join(',');
  return m;
}

/** Clothes (+ hands, whose texels the cloth mask leaves untinted). */
export function clothMaterial(src) {
  const m = new THREE.MeshStandardMaterial({
    name: 'people-cloth',
    map: texOf(src, 'map'),
    normalMap: texOf(src, 'normalMap'),
    normalScale: src?.normalScale ? src.normalScale.clone() : new THREE.Vector2(1, 1),
    roughnessMap: texOf(src, 'roughnessMap'),
    roughness: 1.0,
    metalness: 0,
  });
  m.userData.tint = { value: new THREE.Color(1, 1, 1) };
  m.userData.tintAmt = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.clothTint = m.userData.tint;
    sh.uniforms.clothTintAmt = m.userData.tintAmt;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 clothTint;\nuniform float clothTintAmt;')
      .replace('#include <map_fragment>', `#include <map_fragment>
	{
		// alpha of the body map = cloth (1) vs skin (0); recolour cloth, keep its shading
		float clothK = clamp( diffuseColor.a, 0.0, 1.0 ) * clothTintAmt;
		float l = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		float lt = max( dot( clothTint, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.03 );
		vec3 dyed = clothTint * ( l / lt ) * 0.85 + clothTint * 0.06;
		diffuseColor.rgb = mix( diffuseColor.rgb, min( dyed, vec3( 1.0 ) ), clothK );
		diffuseColor.a = 1.0;
	}`);
  };
  m.customProgramCacheKey = () => 'people-cloth';
  return m;
}

/**
 * Hair cards, brows and lashes. Two passes: an opaque core (alpha ≥ 0.5, writes
 * depth, alpha-to-coverage under MSAA) and a blended fringe on top for the soft
 * strand tips (userData.fringe, drawn by a second mesh on the same skeleton).
 */
export function hairMaterial(src) {
  const params = {
    map: texOf(src, 'map'),
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
    sheen: 0.35,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(0.8, 0.75, 0.68),
    specularIntensity: 0.5,
  };
  const core = new THREE.MeshPhysicalMaterial({ ...params, name: 'people-hair', alphaTest: 0.5, alphaToCoverage: true });
  // the fringe is thin strands: little specular, or the tips turn to glass at grazing angles
  const fringe = new THREE.MeshPhysicalMaterial({ ...params, name: 'people-hair-fringe', transparent: true, depthWrite: false, alphaTest: 0.02,
    specularIntensity: 0.15, sheen: 0.1, envMapIntensity: 0.35 });
  core.userData.fringe = fringe;
  return core;
}

export function glassesMaterial(src) {
  return new THREE.MeshPhysicalMaterial({
    name: 'people-glasses',
    map: texOf(src, 'map'),
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    specularIntensity: 1,
  });
}

export function propMaterial(src) {
  return new THREE.MeshStandardMaterial({
    name: 'people-prop',
    map: texOf(src, 'map'),
    normalMap: texOf(src, 'normalMap'),
    roughnessMap: texOf(src, 'roughnessMap'),
    roughness: 1.0,
    metalness: 0,
  });
}

/** Replace a loaded avatar's glTF materials with ours (once per avatar template). */
export function upgradeMaterials(root) {
  const made = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    if (made.has(src)) { o.material = made.get(src); return; }
    const part = o.name;
    let m;
    if (part === 'head') m = skinMaterial(src);
    else if (part === 'body') m = clothMaterial(src);
    else if (part === 'hair') m = hairMaterial(src);
    else if (part === 'glasses') m = glassesMaterial(src);
    else m = propMaterial(src);
    m.userData.part = part;
    made.set(src, m);
    o.material = m;
    src.dispose();
  });
}
