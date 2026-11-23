// Materials for people. Skin is a MeshPhysicalMaterial with:
//  • wrapped diffuse + a red subsurface tint where light rolls off (cheap SSS)
//  • per-pixel features painted from the baked face-coordinate field (aFace:
//    offset from between the eyes in half-eye-distances): brows with hair
//    strokes, lip colour (baked vermilion mask), stubble/beard shadow, cheek
//    and nose flush, eyelid tint, under-eye shade, age wrinkles, freckles
//  • baked ambient occlusion and procedural pore normals
import * as THREE from 'three';

// real-ish skin tones (sRGB), fair → deep
const TONES = ['#e9c4aa', '#ddb090', '#cc9874', '#b5805c', '#966040', '#72462d', '#4e2f1f', '#37211a'];

function toneColor(t, warmth = 0.5) {
  const x = THREE.MathUtils.clamp(t, 0, 1) * (TONES.length - 1);
  const i = Math.min(TONES.length - 2, Math.floor(x));
  const c = new THREE.Color(TONES[i]).lerp(new THREE.Color(TONES[i + 1]), x - i);
  // warmth: cool/pink ↔ golden/olive
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h + (warmth - 0.5) * 0.025, hsl.s * (0.85 + warmth * 0.3), hsl.l);
  return c; // sRGB-ish values in a THREE.Color (convert at use)
}

export function skinColorFor(dna) {
  return toneColor(dna.skin?.tone ?? 0.3, dna.skin?.warmth ?? 0.5);
}

const SKIN_PARS = /* glsl */`
attribute vec3 aFace;
attribute vec4 aMask;
varying vec3 vFace;
varying vec4 vMask;
`;
const SKIN_FPARS = /* glsl */`
varying vec3 vFace;
varying vec4 vMask;
uniform vec3 uLip;
uniform vec3 uBrow;
uniform vec4 uBrowP;   // density, thickness, arch, length
uniform vec3 uBeard;
uniform vec4 uBeardP;  // stubble, full beard, moustache, sideburn reach
uniform vec4 uFlush;   // cheeks, nose, ears, lips saturation
uniform vec4 uAge;     // wrinkles 0..1, under-eye, freckles, ao strength
uniform vec3 uSss;
uniform vec3 uEyeShadow;
uniform float uEyeShadowAmt;
uniform vec3 uScalpCol;
uniform float uScalp;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float gauss1(float x, float c, float w) { float d = (x - c) / w; return exp(-d * d); }
// eyebrow coverage at face coords (x mirrored)
float browMask(vec3 f) {
  float ax = abs(f.x);
  float t = clamp((ax - 0.2) / (1.72 * uBrowP.w), 0.0, 1.0);
  // inner end low, peak two-thirds out, tail dropping
  float yc = 0.9 + uBrowP.z * 0.36 * sin(3.14159 * pow(t, 0.8)) - 0.14 * t * t;
  float th = mix(0.2, 0.06, t) * (0.55 + uBrowP.y * 0.7);
  float inX = smoothstep(0.14, 0.32, ax) * (1.0 - smoothstep(1.5 * uBrowP.w, 1.9 * uBrowP.w, ax));
  float d = abs(f.y - yc) / th;
  float body = (1.0 - smoothstep(0.35, 1.05, d)) * inX * smoothstep(-0.8, -0.2, f.z);
  // individual hairs: streaks that fan upward at the inner end, run outward along the brow
  float ang = mix(1.1, 0.12, smoothstep(0.0, 0.45, t));
  vec2 q = vec2(ax * cos(ang) + f.y * sin(ang), -ax * sin(ang) + f.y * cos(ang));
  float fwB = max(length(fwidth(f)), 1e-5);
  float strands = vnoise(vec3(q.x * 7.0, q.y * 95.0, 3.1)) * 0.55 + vnoise(vec3(q.x * 14.0, q.y * 190.0, 7.7)) * 0.45;
  float hairs = mix(0.55, smoothstep(0.3, 0.75, strands), 1.0 - smoothstep(0.12, 0.35, 95.0 * fwB));
  // sparse stray hairs outside the main body
  float stray = smoothstep(0.82, 0.95, vnoise(vec3(q.x * 30.0, q.y * 60.0, 1.3))) * inX * (1.0 - smoothstep(0.9, 1.7, d)) * 0.5;
  return clamp((body * (0.25 + hairs * 0.85) + stray) * uBrowP.x * 0.95, 0.0, 0.92);
}
float beardMask(vec3 f) {
  float ax = abs(f.x);
  float front = smoothstep(-3.4, -1.6, f.z);
  // under the nose to the jaw and chin, down the front of the neck
  float lower = smoothstep(-1.55, -1.95, f.y) * (1.0 - smoothstep(-5.2, -6.0, f.y));
  // cheeks: up to a line from the nose wing to below the ear
  float cheekLine = -1.35 - (ax - 0.9) * 0.55;
  float cheek = smoothstep(0.9, 1.25, ax) * smoothstep(cheekLine + 0.25, cheekLine - 0.2, f.y);
  // sideburns
  float side = smoothstep(2.05, 2.35, ax) * smoothstep(0.35 * uBeardP.w, -0.2, f.y) * smoothstep(-3.2, -2.4, f.z) * (1.0 - smoothstep(-1.2, -0.6, f.z));
  float m = max(max(lower, cheek), side) * front;
  // keep the lips and a little ring round them clear
  m *= 1.0 - smoothstep(0.15, 0.45, vMask.y);
  // the neck below the jaw thins out
  m *= 1.0 - smoothstep(-4.6, -5.6, f.y) * 0.7;
  return clamp(m, 0.0, 1.0);
}
`;

const SKIN_COLOR = /* glsl */`
#include <color_fragment>
{
  vec3 f = vFace;
  float ax = abs(f.x);
  vec3 base = diffuseColor.rgb;
  // mottling: subtle large-scale variation + fine pores in albedo
  float fwA = max(length(fwidth(f)), 1e-5);
  float mott = vnoise(f * 1.7) * 0.65 + vnoise(f * 5.0) * 0.35 * (1.0 - smoothstep(0.2, 0.5, 5.0 * fwA));
  base *= 0.94 + 0.1 * mott;
  // flush: cheeks, nose tip, ears
  float cheeks = exp(-pow((ax - 1.35) / 0.65, 2.0) - pow((f.y + 1.0) / 0.75, 2.0)) * smoothstep(-1.5, -0.3, f.z);
  float nose = exp(-pow(f.x / 0.45, 2.0) - pow((f.y + 1.35) / 0.45, 2.0)) * smoothstep(0.6, 1.3, f.z);
  float ears = smoothstep(2.3, 2.6, ax) * smoothstep(-1.2, -0.2, f.y) * (1.0 - smoothstep(0.6, 1.1, f.y));
  vec3 red = base * vec3(1.18, 0.82, 0.8);
  base = mix(base, red, clamp(cheeks * uFlush.x + nose * uFlush.y + ears * uFlush.z, 0.0, 0.85));
  // eyelids + under-eye
  float lid = exp(-pow((ax - 1.0) / 0.55, 2.0) - pow((f.y - 0.38) / 0.22, 2.0)) * smoothstep(-0.6, 0.0, f.z);
  float under = exp(-pow((ax - 1.0) / 0.55, 2.0) - pow((f.y + 0.48) / 0.2, 2.0)) * smoothstep(-0.6, 0.0, f.z);
  base *= 1.0 - lid * 0.1 - under * uAge.y * 0.2;
  base = mix(base, uEyeShadow, lid * uEyeShadowAmt);
  // lips
  float lip = smoothstep(0.22, 0.5, vMask.y);
  base = mix(base, uLip, lip * 0.85);
  // stubble / beard shadow (grows from follicles: noise)
  float bm = beardMask(f);
  float foll = mix(0.7, smoothstep(0.35, 0.75, vnoise(f * 38.0)) * 0.6 + 0.4, 1.0 - smoothstep(0.2, 0.5, 38.0 * fwA));
  float stub = bm * uBeardP.x * foll;
  base = mix(base, uBeard, clamp(stub * 0.75, 0.0, 0.8));
  // scalp under short hair
  base = mix(base, uScalpCol, vMask.z * uScalp * mix(0.8, 0.6 + 0.4 * vnoise(f * 30.0), 1.0 - smoothstep(0.2, 0.5, 30.0 * fwA)));
  // brows
  float br = browMask(f);
  base = mix(base, uBrow, br);
  // freckles
  float frk = smoothstep(0.78, 0.86, vnoise(f * 11.0)) * (1.0 - smoothstep(0.25, 0.6, 11.0 * fwA)) * uAge.z * (cheeks + nose * 1.5 + smoothstep(1.2, 2.6, f.y) * 0.3);
  base *= 1.0 - clamp(frk, 0.0, 1.0) * 0.28;
  // baked occlusion
  float ao = mix(1.0, vMask.x, uAge.w);
  base *= mix(0.55, 1.0, ao);
  diffuseColor.rgb = base;
}
`;

const SKIN_ROUGH = /* glsl */`
#include <roughnessmap_fragment>
{
  vec3 f = vFace;
  float tzone = exp(-pow(f.x / 0.6, 2.0) - pow((f.y - 1.6) / 1.2, 2.0)) + exp(-pow(f.x / 0.35, 2.0) - pow((f.y + 1.0) / 0.8, 2.0));
  roughnessFactor = clamp(roughnessFactor - tzone * 0.12 - smoothstep(0.25, 0.5, vMask.y) * 0.22, 0.18, 1.0);
  roughnessFactor = mix(roughnessFactor, 0.7, beardMask(f) * uBeardP.x * 0.6);
}
`;

// pores + wrinkles as a height field (metres), turned into a normal with the
// surface-gradient method; every octave fades out once it's smaller than a pixel
const SKIN_NORMAL = /* glsl */`
#include <normal_fragment_maps>
{
  vec3 f = vFace;
  float ax = abs(f.x);
  float fw = max(length(fwidth(f)), 1e-5);
  #define LOD(freq) (1.0 - smoothstep(0.18, 0.5, (freq) * fw))
  float h = (vnoise(f * 45.0) - 0.5) * 7e-5 * LOD(45.0)
          + (vnoise(f * 110.0) - 0.5) * 3e-5 * LOD(110.0)
          + (vnoise(f * 9.0) - 0.5) * 1.2e-4 * LOD(9.0);
  float w = uAge.x;
  if (w > 0.01) {
    float fh = smoothstep(1.35, 1.7, f.y) * (1.0 - smoothstep(2.3, 2.7, f.y)) * (1.0 - smoothstep(1.2, 1.8, ax));
    float lines = pow(abs(sin(f.y * 9.0 + vnoise(f * 2.5) * 2.0)), 4.0);
    h -= fh * lines * w * 3.5e-4 * LOD(9.0);
    float cf = smoothstep(1.5, 1.75, ax) * (1.0 - smoothstep(2.15, 2.35, ax)) * (1.0 - smoothstep(0.0, 0.45, abs(f.y + 0.05)));
    h -= cf * pow(abs(sin(atan(f.y, ax - 1.0) * 8.0)), 6.0) * w * 3e-4 * LOD(16.0);
    float nl = abs((ax - 0.72) + (f.y + 1.55) * 0.45);
    h -= exp(-nl * nl / 0.012) * smoothstep(-1.35, -1.65, f.y) * (1.0 - smoothstep(-2.4, -2.75, f.y)) * w * 9e-4;
  }
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhdx = dFdx(h), dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  normal = normalize(abs(det) * normal - grad);
}
`;

// wrapped diffuse + subsurface tint (replaces the direct-light term)
function patchLighting(src) {
  const a = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;';
  const b = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Physical';
  if (!src.includes(a) || !src.includes(b)) { console.warn('skin: lighting patch did not apply'); return src; }
  return src.replace(a, `float ndlRaw = dot( geometryNormal, directLight.direction );
	float dotNL = saturate( ndlRaw );
	vec3 irradiance = dotNL * directLight.color;
	float wrapT = saturate( ( ndlRaw + 0.45 ) / 1.45 );
	vec3 sssIrr = uSss * max( wrapT * wrapT - dotNL, 0.0 ) * directLight.color;`)
    .replace(b, 'reflectedLight.directDiffuse += ( irradiance + sssIrr ) * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Physical');
}

export function createSkinMaterial(dna, rng) {
  const tone = skinColorFor(dna);
  const mat = new THREE.MeshPhysicalMaterial({
    color: tone.clone(),
    roughness: 0.52,
    metalness: 0,
    sheen: 0.12,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0.6, 0.45, 0.4),
    specularIntensity: 0.55,
  });
  const dark = dna.skin?.tone ?? 0.3;
  const lipBase = dna.lips?.color ? new THREE.Color(dna.lips.color)
    : tone.clone().multiply(new THREE.Color(0.74, 0.43, 0.42)).lerp(new THREE.Color(0.48, 0.19, 0.2), 0.28);
  const browCol = new THREE.Color(dna.brows?.color || dna.hair?.color || '#2b1d14');
  const beardCol = new THREE.Color(dna.beard?.color || dna.hair?.color || '#2b1d14');
  const age = dna.age || 30;
  const uniforms = {
    uLip: { value: lipBase },
    uBrow: { value: browCol },
    uBrowP: { value: new THREE.Vector4(dna.brows?.density ?? 0.8, dna.brows?.thickness ?? 0.5, dna.brows?.arch ?? 0.5, dna.brows?.length ?? 1.0) },
    uBeard: { value: beardCol.clone().lerp(tone, 0.25) },
    uBeardP: { value: new THREE.Vector4(dna.beard?.stubble ?? 0, 0, 0, 1) },
    uFlush: { value: new THREE.Vector4(0.28 * (dna.skin?.rosy ?? 0.5) * (1 - dark * 0.6), 0.3 * (dna.skin?.rosy ?? 0.5), 0.35, 1) },
    uAge: { value: new THREE.Vector4(THREE.MathUtils.smoothstep(age, 32, 78), THREE.MathUtils.smoothstep(age, 25, 70) * 0.8 + 0.2, dna.skin?.freckles ?? 0, 0.85) },
    uSss: { value: new THREE.Color(0.85, 0.25, 0.14).multiplyScalar(1 - dark * 0.45) },
    uEyeShadow: { value: new THREE.Color(dna.makeup?.eyeshadow || '#3a2a2a') },
    uEyeShadowAmt: { value: dna.makeup?.eyeshadowAmt ?? 0 },
    uScalpCol: { value: new THREE.Color(dna.hair?.color || '#2b1d14').lerp(tone, 0.45) },
    uScalp: { value: 0 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SKIN_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFace = aFace;\nvMask = aMask;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SKIN_FPARS)
      .replace('#include <color_fragment>', SKIN_COLOR)
      .replace('#include <roughnessmap_fragment>', SKIN_ROUGH)
      .replace('#include <normal_fragment_maps>', SKIN_NORMAL)
      .replace('#include <lights_physical_pars_fragment>', patchLighting(THREE.ShaderChunk.lights_physical_pars_fragment));
  };
  mat.customProgramCacheKey = () => 'cb-skin-v1';
  void rng;
  return mat;
}

let eyeTex = null;
export function createEyeMaterial(dna, url) {
  if (!eyeTex) {
    eyeTex = new THREE.TextureLoader().load(url);
    eyeTex.colorSpace = THREE.SRGBColorSpace;
    eyeTex.anisotropy = 4;
  }
  const mat = new THREE.MeshPhysicalMaterial({
    map: eyeTex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 0.6,
  });
  const iris = new THREE.Color(dna.eyes?.color || '#5a3a22');
  mat.userData.uniforms = { uIris: { value: iris }, uPupil: { value: 1.0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uIris;\nuniform float uPupil;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec2 c1 = vec2(0.7070, 0.7030), c2 = vec2(0.2910, 0.2930);
        float d = min(distance(vMapUv, c1), distance(vMapUv, c2));
        float iris = 1.0 - smoothstep(0.098, 0.112, d);
        float pupil = 1.0 - smoothstep(0.03 * uPupil, 0.038 * uPupil, d);
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
        vec3 ic = uIris * (0.45 + lum * 2.2);
        ic *= 1.0 - 0.55 * smoothstep(0.08, 0.11, d); // limbal ring
        diffuseColor.rgb = mix(diffuseColor.rgb, ic, iris * (1.0 - pupil));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.01), pupil);
        // sclera a touch dimmer than paper white
        diffuseColor.rgb *= mix(0.82, 1.0, iris);
      }`);
  };
  mat.customProgramCacheKey = () => 'cb-eye-v1';
  // the cornea: a clear shell that only adds its reflections (wet glints)
  const cornea = new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    envMapIntensity: 1.6,
  });
  return [mat, cornea];
}

export function createLashMaterial(dna) {
  const c = new THREE.Color(dna.brows?.color || '#1a120c').multiplyScalar(0.5);
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide });
}

export function createMouthMaterials() {
  return {
    teeth: new THREE.MeshPhysicalMaterial({ color: 0x8a8274, roughness: 0.35, clearcoat: 0.4 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0x5a2422, roughness: 0.5 }),
  };
}
