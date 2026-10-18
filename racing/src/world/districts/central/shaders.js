// PORT HALCYON — Downtown and Uptown's own materials, shared by both packs
// (each pack makes its own copies through B.mat). Most of the night here is
// drawn by the shaders, off one uniform (the world's clock), so nothing has
// to be touched per frame:
//   windowMat   facades whose windows light at night storey by storey, picked
//               per building / floor / bay by a hash (no emissive texture, no
//               visible repeats); offices light whole floors, homes room by room
//   screenMat   LED screens cycling through an atlas of ads, with a wipe, a
//               scanline shimmer and the odd glitching one
//   signalMat   traffic signals running their cycle (two phases, by approach)
//   blinkMat    aircraft warning lights (all in step, like the real thing)
//   chaseMat    marquee bulbs chasing round a sign
//   nightGlow   LED strips, lit crowns and lamp glass that glow only at night
// A pack's materials are made once for the whole world (never per cell).
import * as THREE from 'three';
import { U, nightEmissive, glowMat } from '../../kit.js';

export const HASH = `
float ctH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

/**
 * A material Downtown and Uptown both use (trees, LED glow, signals, beacons):
 * one object, made through whichever pack's B.mat asks for it first, so a
 * cell on their border has one of each, not two.
 */
const SHARED = new Map();
export function sharedMat(B, key, make) {
  if (!SHARED.has(key)) SHARED.set(key, B.mat(`ct-${key}`, make));
  return SHARED.get(key);
}

const v3 = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
const f = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/**
 * The lit-window code (GLSL, into a standard material's emissive). o:
 *   bays, floors     cells in one texture tile (u, v in tiles)
 *   win              [x0, x1, y0, y1] the window inside a cell (0..1, y up)
 *   occ              [min, max] share of a building's floors lit
 *   dense, sparse    chance a bay is lit on a lit floor / on a dark one
 *   pal              [[hex, weight], ...] lit colours (picked per floor, or per
 *                    window with perWindow)
 *   curtains         lit windows show drawn curtains at their sides
 *   tv               chance a lit window is a flickering television
 *   all              every window lit (a crown, a lantern)
 *   crown            { hex, k }: with tint, faces drawn with 2 added to their
 *                    vertex colour's red are a lit crown (every window on, in
 *                    hex, k times as bright): crowns share the facade's material
 * The building's seed is floor(u / 8): give each building its own u offset
 * in steps of 8 tiles (and a whole-storey v offset) so no two light alike.
 */
function windowGLSL(o) {
  const [wx0, wx1, wy0, wy1] = o.win;
  const pal = o.pal;
  const tot = pal.reduce((a, p) => a + p[1], 0);
  let acc = 0;
  const cut = pal.map((p) => (acc += p[1] / tot));
  const colExpr = pal.length === 1 ? v3(pal[0][0])
    : pal.length === 2 ? `(ctK < ${cut[0].toFixed(3)} ? ${v3(pal[0][0])} : ${v3(pal[1][0])})`
      : `(ctK < ${cut[0].toFixed(3)} ? ${v3(pal[0][0])} : (ctK < ${cut[1].toFixed(3)} ? ${v3(pal[1][0])} : ${v3(pal[2][0])}))`;
  const occ = o.occ || [0.3, 0.7];
  const area = (wx1 - wx0) * (wy1 - wy0);
  const cr = o.tint ? o.crown : null;
  return `{
    ${o.tint ? '' : 'float ctCr = 0.0;'}
    vec2 ctG = vMapUv * vec2(${f(o.bays)}, ${f(o.floors)});
    vec2 ctC = floor(ctG), ctF = fract(ctG);
    float ctSeed = floor(vMapUv.x / 8.0);
    float ctOcc = mix(${f(occ[0])}, ${f(occ[1])}, ctH(vec2(ctSeed, 17.0)));
    float ctFl = step(ctH(vec2(ctC.y + 0.5, ctSeed * 1.37 + 3.0)), ctOcc);
    float ctB = ctH(vec2(ctC.x + ctSeed * 31.0, ctC.y * 1.7 + 11.0));
    float ctOn = ${o.all ? '1.0' : `mix(step(ctB, ${f(o.sparse ?? 0.05)}), step(ctB, ${f(o.dense ?? 0.92)}), ctFl)`};
    ${cr ? 'ctOn = max(ctOn, ctCr);' : ''}
    float ctIn = step(${f(wx0)}, ctF.x) * step(ctF.x, ${f(wx1)}) * step(${f(wy0)}, ctF.y) * step(ctF.y, ${f(wy1)});
    float ctY = clamp((ctF.y - ${f(wy0)}) / ${f(wy1 - wy0)}, 0.0, 1.0);
    float ctX = clamp((ctF.x - ${f(wx0)}) / ${f(wx1 - wx0)}, 0.0, 1.0);
    float ctI = 0.42 + 0.38 * ctY + 0.75 * smoothstep(0.8, 0.88, ctY) * (1.0 - smoothstep(0.92, 0.99, ctY));
    ${o.curtains ? 'ctI *= 0.35 + 0.65 * smoothstep(0.1, 0.24, ctX) * smoothstep(0.1, 0.24, 1.0 - ctX);' : ''}
    float ctK = ctH(${o.perWindow ? 'ctC * vec2(1.31, 0.77) + vec2(ctSeed, 5.0)' : 'vec2(ctC.y * 0.37 + ctSeed, 5.0)'});
    vec3 ctCol = ${colExpr};
    ${o.tv ? `if (ctCr < 0.5 && ctH(ctC + vec2(ctSeed * 3.1, 91.0)) < ${f(o.tv)}) ctCol = vec3(0.45, 0.6, 1.0) * (0.55 + 0.45 * sin(uTime * 9.0 + ctB * 40.0) * sin(uTime * 2.3 + ctB * 17.0));` : ''}
    ${cr ? `ctCol = mix(ctCol, ${v3(cr.hex)}, ctCr);` : ''}
    float ctSmall = clamp((max(fwidth(ctG.x), fwidth(ctG.y)) - 0.45) * 2.2, 0.0, 1.0);
    vec3 ctAvg = ${v3(pal[0][0])} * ${o.all ? '1.0' : `(ctOcc * ${f(o.dense ?? 0.92)} + (1.0 - ctOcc) * ${f(o.sparse ?? 0.05)})`} * ${area.toFixed(3)} * 0.7;
    ${cr ? `ctAvg = mix(ctAvg, ${v3(cr.hex)} * ${area.toFixed(3)} * 0.7, ctCr);` : ''}
    totalEmissiveRadiance *= mix(ctCol * ctOn * ctIn * ctI, ctAvg, ctSmall)${cr ? ` * mix(1.0, ${f(cr.k)}, ctCr)` : ''};
  }`;
}

/**
 * A facade material with shader-lit windows (see windowGLSL for o). Not
 * lamp-lit (towers above the street); o.lit makes it take the street lamps'
 * baked light too (low buildings). o.tint: the map is tinted by vertex
 * colour (one texture, many glass/stone colours).
 */
export function windowMat(map, o) {
  const params = {
    map, vertexColors: !!o.tint, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0.1,
    envMapIntensity: o.env ?? 0.6, emissive: new THREE.Color(0xffffff),
  };
  const m = o.lit ? glowMat(params, o.glow ?? 2.4) : new THREE.MeshStandardMaterial(params);
  nightEmissive(m, o.night ?? 1.2);
  m.userData.castShadow = true;
  const prev = m.onBeforeCompile;
  const code = windowGLSL(o);
  m.onBeforeCompile = (sh, r) => {
    if (o.lit) prev.call(m, sh, r);
    sh.uniforms.uTime = U.time;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\n${HASH}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${code}`);
    if (o.tint) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
        float ctCr = 0.0;
        #if defined( USE_COLOR )
          ctCr = step(1.5, vColor.r);
          diffuseColor.rgb *= vec3(vColor.r - 2.0 * ctCr, vColor.g, vColor.b);
        #endif`);
    }
  };
  // (a lamp-lit one must still read as 'world-glow…' so the cell bakes its light)
  const key = (o.lit ? 'world-glow-ct-win-' : 'ct-win-') + o.key + (o.tint ? 'vc' : '');
  m.customProgramCacheKey = () => key;
  return m;
}

/**
 * LED screens: an atlas of cols × rows ads; each screen's u carries its
 * phase in its whole part (u = phase + 0..1), v is 0..1 over the screen.
 * They change every few seconds with a wipe, shimmer, and one in seven
 * glitches now and then.
 */
export function screenMat(tex, cols, rows, k = 1.5) {
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uNight = U.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uNight;\n${HASH}`)
      .replace('#include <map_fragment>', `
        float scPh = floor(vMapUv.x);
        vec2 scF = vec2(fract(vMapUv.x), clamp(vMapUv.y, 0.001, 0.999));
        float scT = uTime / 7.0 + scPh * 0.379;
        float scN = floor(scT), scW = fract(scT);
        float scFr = mod(scN * 3.0 + scPh * 5.0, ${f(cols * rows)});
        float scPrev = mod((scN - 1.0) * 3.0 + scPh * 5.0, ${f(cols * rows)});
        // a wipe from the top in the first moment of each new ad
        float scUse = scF.y > 1.0 - scW * 6.0 ? scFr : scPrev;
        float scC = mod(scUse, ${f(cols)}), scR = floor(scUse / ${f(cols)});
        vec2 scUv = vec2((scC + scF.x) / ${f(cols)}, 1.0 - (scR + 1.0 - scF.y) / ${f(rows)});
        vec4 sampledDiffuseColor = texture2D(map, scUv);
        // LED rows shimmer, the wipe's edge is bright, the odd screen glitches
        float scEdge = 1.0 - smoothstep(0.0, 0.025, abs(scF.y - (1.0 - scW * 6.0)));
        float scG = step(0.86, ctH(vec2(scPh, floor(uTime * 3.0)))) * step(0.5, ctH(vec2(scPh, 3.0)));
        sampledDiffuseColor.rgb *= 0.88 + 0.12 * sin(scF.y * 180.0 + uTime * 6.0);
        sampledDiffuseColor.rgb += scEdge * 0.6;
        sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.gbr * 1.3, scG * step(0.5, fract(scF.y * 9.0 + uTime * 13.0)));
        // a touch dimmer by day (the sun washes them out)
        sampledDiffuseColor.rgb *= 0.7 + 0.3 * uNight;
        diffuseColor *= sampledDiffuseColor;`);
  };
  m.customProgramCacheKey = () => 'ct-screen';
  return m;
}

/**
 * Traffic signals: vertex colour is the lens (red / amber / green); uv.x the
 * approach's phase (0 or 0.5 of the cycle) plus a per-junction offset. Lit
 * lenses glow, the others are dark glass.
 */
export function signalMat(cycle = 26) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSg;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSg = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vSg;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sgC = fract(uTime / ${f(cycle)} + vSg.x);
        // green 0..0.44, amber 0.44..0.5, red 0.5..1 (the other phase is its mirror)
        float sgKind = vColor.g > 0.8 ? 2.0 : (vColor.g > 0.3 ? 1.0 : 0.0);
        float sgOn = sgKind > 1.5 ? step(sgC, 0.44) : (sgKind > 0.5 ? step(0.44, sgC) * step(sgC, 0.5) : step(0.5, sgC));
        diffuseColor.rgb *= mix(0.12, 3.2, sgOn);`);
  };
  m.customProgramCacheKey = () => 'ct-signal';
  return m;
}

/** Aircraft warning lights (or any beacon): on 0.6 s every 1.6 s, all in step. */
export function blinkMat(hex, k = 4, period = 1.6) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float bkT = fract(uTime / ${f(period)});
        diffuseColor.rgb *= mix(0.15, ${f(k)}, smoothstep(0.0, 0.05, bkT) * (1.0 - smoothstep(0.35, 0.42, bkT)));`);
  };
  m.customProgramCacheKey = () => 'ct-blink' + period;
  return m;
}

/**
 * Marquee bulbs: uv.x is a bulb's index along its row (whole numbers); every
 * third bulb is lit and the pattern walks along. vertex colour tints.
 */
export function chaseMat(k = 3.2, speed = 6) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uNight = U.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCh;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCh = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uNight;\nvarying vec2 vCh;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float chI = floor(vCh.x + 0.5);
        float chOn = step(mod(chI - floor(uTime * ${f(speed)}), 3.0), 0.5);
        diffuseColor.rgb *= mix(0.8, ${f(k)}, chOn) * (0.55 + 0.45 * uNight);`);
  };
  m.customProgramCacheKey = () => 'ct-chase';
  return m;
}

/** Something that glows at night only (LED strips, lit crowns, lamp glass); dayHex by day. */
export function nightGlow(dayHex, nightHex, k = 3, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(dayHex), emissive: new THREE.Color(nightHex), roughness: o.rough ?? 0.4, metalness: o.metal ?? 0.3 });
  nightEmissive(m, k);
  m.userData.castShadow = false;
  return m;
}

/**
 * Night glow in the vertex colour: one material for every LED strip, lit
 * crown edge and lamp glass, whatever its colour (paint(mat, col): col is
 * the glow's colour × its brightness / k; by day a greyer version × day).
 */
export function nightGlowVC(k = 4, o = {}) {
  const d = o.day ?? 0.9;
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(d, d, d), emissive: new THREE.Color(0xffffff), vertexColors: true, roughness: o.rough ?? 0.4, metalness: o.metal ?? 0.3 });
  nightEmissive(m, k);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      // by day the glass is a paler, greyer version of its glow
      .replace('#include <color_fragment>', '#if defined( USE_COLOR )\n  diffuseColor.rgb *= mix(vec3(dot(vColor.rgb, vec3(0.3333))), vColor.rgb, 0.6);\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;');
  };
  m.customProgramCacheKey = () => 'ct-glowvc';
  m.userData.castShadow = false;
  return m;
}

/**
 * Water in a basin or a pond: a texture drifting slowly (two ways at once,
 * by the shader), darker by night with a glint of the lamps.
 */
export function waterMat(map, o = {}) {
  const m = glowMat({ map, color: new THREE.Color(o.color ?? 0xffffff), roughness: 0.08, metalness: 0.2, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, 1.6);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uTime = U.time;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = 0.5 * (texture2D(map, vMapUv + vec2(uTime * 0.011, uTime * 0.006)) + texture2D(map, vMapUv * 1.37 + vec2(-uTime * 0.008, uTime * 0.01)));
        diffuseColor *= sampledDiffuseColor;`);
  };
  m.customProgramCacheKey = () => 'world-glow-ct-water';
  m.userData.castShadow = false;
  return m;
}
