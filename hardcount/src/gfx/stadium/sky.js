// Time of day × weather: sky colours, fog, the key light (sun or the
// floodlight key), hemisphere fill, environment preset, floodlight level and
// the CRT post grade. Plus the sky dome: gradient, sun, clouds, stars and the
// haze glowing over the stadium from its light banks.
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);

/** Direction toward the sun / key from elevation + azimuth (radians). */
function dirFrom(el, az) {
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

/**
 * atmosphere(time, weather, opts) → everything the venue needs to light itself.
 * opts: { roof: 'open'|'dome', sunAz }
 */
export function atmosphere(time, weather, opts = {}) {
  const dome = opts.roof === 'dome';
  const az = opts.sunAz ?? 0.9;
  let A;
  if (dome) {
    A = {
      sky: ['#05060a', '#0a0c12', '#12141c'], glow: '#ffffff', clouds: 0, stars: 0, haze: 0,
      fog: ['#1a1d26', 0.0018],
      key: { color: '#f4f6ff', i: 3.0, dir: dirFrom(1.35, 0.4) },
      hemi: ['#c8d0e0', '#55584e', 1.15], env: 'dome', envI: 1.0,
      lights: 1, lamp: 7, spill: 0.16,
      post: { exposure: 1.02, bloomStrength: 0.75, bloomThreshold: 1.05, bloomKnee: 0.5, saturation: 1.1, contrast: 1.05, lift: [0.0, 0.0, 0.01], gain: [1.0, 1.0, 1.02], vignette: 0.5 },
    };
  } else if (time === 'night') {
    A = {
      sky: ['#010206', '#040814', '#10172a'], glow: '#9fb4ff', clouds: 0.18, stars: 0.6, haze: 1.0, hazeColor: '#2a3246',
      fog: ['#0d1322', 0.0032],
      key: { color: '#e3ebff', i: 2.9, dir: dirFrom(1.18, az + 0.3) },
      hemi: ['#3a4a70', '#16220f', 0.55], env: 'stadium_night', envI: 0.9,
      lights: 1, lamp: 9, spill: 0.12,
      post: { exposure: 1.06, bloomStrength: 1.0, bloomThreshold: 0.95, bloomKnee: 0.6, saturation: 1.12, contrast: 1.07, lift: [0.0, 0.004, 0.018], gain: [1.0, 1.0, 1.03] },
    };
  } else if (time === 'dusk') {
    A = {
      sky: ['#141d44', '#4a3e72', '#f08a5a'], glow: '#ffb27a', clouds: 0.35, stars: 0.05, haze: 0.45, hazeColor: '#6a5070',
      fog: ['#5a4a5e', 0.0026],
      key: { color: '#ffb47a', i: 2.4, dir: dirFrom(0.13, az) },
      hemi: ['#7a78b0', '#2a2418', 0.85], env: 'stadium_dusk', envI: 0.9,
      lights: 1, lamp: 6, spill: 0.07,
      post: { exposure: 1.02, bloomStrength: 0.85, bloomThreshold: 1.0, bloomKnee: 0.6, saturation: 1.1, contrast: 1.05, lift: [0.012, 0.0, 0.02], gain: [1.04, 0.99, 0.98] },
    };
  } else {
    A = {
      sky: ['#2a62bc', '#5d95da', '#c3d8ec'], glow: '#fff1d6', clouds: 0.3, stars: 0, haze: 0,
      fog: ['#b4c8dc', 0.0016],
      key: { color: '#fff1dc', i: 3.4, dir: dirFrom(0.95, az) },
      hemi: ['#bcd2ff', '#4e5a34', 0.95], env: 'stadium_day', envI: 0.8,
      lights: 0, lamp: 1.2, spill: 0,
      post: { exposure: 0.96, bloomStrength: 0.45, bloomThreshold: 1.35, bloomKnee: 0.6, saturation: 1.08, contrast: 1.05, lift: [0, 0, 0], gain: [1.02, 1.0, 0.98] },
    };
  }
  A.time = time;
  A.weather = dome ? 'clear' : weather;
  const w = A.weather;
  const night = time === 'night', dusk = time === 'dusk';
  if (!dome && w !== 'clear') {
    // clouds roll in: flatter light, lower contrast; lights on for anything gloomy
    const grey = night ? ['#06080c', '#0c1018', '#1a2028'] : dusk ? ['#1e1e2a', '#3a3640', '#5c4e4e'] : ['#7d8692', '#9aa2ac', '#bcc2c8'];
    A.sky = grey;
    A.clouds = 0.95;
    A.stars = 0;
    A.key.i *= night ? 0.92 : 0.5;
    A.hemi[2] *= night ? 1.05 : 1.25;
    if (!night) A.key.dir = dirFrom(1.2, az);
    if (!night && !dusk) { A.env = 'stadium_overcast'; A.lights = 1; A.lamp = 3; A.spill = 0.02; }
    A.post.saturation *= 0.9;
    A.post.contrast *= 0.98;
    if (w === 'overcast') {
      A.fog = [night ? '#10141c' : dusk ? '#4a4450' : '#a4acb4', A.fog[1] * 1.6];
      if (!night && !dusk) A.lights = 0;
    } else if (w === 'rain') {
      A.fog = [night ? '#141a26' : dusk ? '#3a3a46' : '#8a929a', night ? 0.0075 : 0.0065];
      A.haze *= 1.6;
      A.post.saturation *= 0.95;
      A.wet = true;
    } else if (w === 'snow') {
      A.fog = [night ? '#1e2634' : dusk ? '#4e4c5a' : '#9aa4b0', night ? 0.0075 : 0.006];
      if (!night) { A.post.contrast *= 1.07; A.post.exposure *= 0.93; A.post.saturation *= 1.04; }
      A.hemi = [night ? '#4a5a80' : '#d8e0ea', night ? '#2a3038' : '#9aa0a8', A.hemi[2] * 1.15];
      A.haze *= 1.5;
      A.cold = true;
    } else if (w === 'fog') {
      A.fog = [night ? '#262e3c' : dusk ? '#6a6068' : '#b9bdc0', night ? 0.0155 : 0.0135];
      A.haze *= 2.2;
      A.post.contrast *= 0.95;
    }
    A.hazeColor = night ? '#4a5878' : '#9aa0aa';
  }
  if (opts.cold) A.cold = true;
  // floodlights on before dark: a soft, shadowless fill from above on top of the low sun
  if (!dome && !night && A.lights) A.fill = { color: '#eef2ff', i: dusk ? 1.5 : 0.9, dir: dirFrom(1.3, az + 1.6) };
  A.night = night;
  A.dusk = dusk;
  A.day = !night && !dusk;
  A.dome = dome;
  return A;
}

/** The sky dome (follows the camera). `banks` = light-bank directions for the haze glow. */
export function skyDome(A, banks = []) {
  const bankDirs = [];
  for (let i = 0; i < 8; i++) {
    const b = banks[i];
    bankDirs.push(b ? new THREE.Vector4(b.x, b.y, b.z, b.w) : new THREE.Vector4(0, 1, 0, 0));
  }
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      cTop: { value: C(A.sky[0]) }, cMid: { value: C(A.sky[1]) }, cHor: { value: C(A.sky[2]) },
      cGlow: { value: C(A.glow) }, cHaze: { value: C(A.hazeColor || '#3a4a6e') }, cFog: { value: C(A.fog[0]) },
      sunDir: { value: A.key.dir.clone() },
      uSun: { value: A.day || A.dusk ? 1 : 0 },
      uMoon: { value: A.night && A.weather === 'clear' ? 1 : 0 },
      uStars: { value: A.stars || 0 },
      uClouds: { value: A.clouds || 0 },
      uHaze: { value: A.haze || 0 },
      uFogK: { value: A.weather === 'fog' ? 0.85 : A.weather === 'rain' || A.weather === 'snow' ? 0.55 : 0.12 },
      uBanks: { value: bankDirs },
      time: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 cTop, cMid, cHor, cGlow, cHaze, cFog, sunDir;
      uniform float uSun, uMoon, uStars, uClouds, uHaze, uFogK, time;
      uniform vec4 uBanks[8];
      varying vec3 vDir;
      float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.13 + 1.7) * 0.28 + vnoise(p * 4.37 + 3.1) * 0.12 + vnoise(p * 9.1) * 0.05; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0
          ? mix(cHor, mix(cMid, cTop, smoothstep(0.18, 0.75, h)), smoothstep(0.0, 0.3, h))
          : mix(cHor, cHor * 0.4, smoothstep(0.0, 0.25, -h));
        vec3 sd3 = normalize(sunDir);
        float sd = max(dot(d, sd3), 0.0);
        // sun glow + disc
        col += cGlow * (pow(sd, 5.0) * 0.35 + pow(sd, 60.0) * 0.6) * uSun;
        col += cGlow * smoothstep(0.9994, 0.99975, sd) * 14.0 * uSun;
        // moon
        vec3 md = normalize(vec3(-0.45, 0.55, -0.7));
        float mdd = max(dot(d, md), 0.0);
        col += vec3(0.75, 0.82, 1.0) * (smoothstep(0.99955, 0.9998, mdd) * 2.2 + pow(mdd, 400.0) * 0.25) * uMoon;
        // stadium light haze: the air over the bowl glows, brightest toward the banks
        float band = pow(1.0 - clamp(h, 0.0, 1.0), 5.0);
        vec3 haze = cHaze * band * 0.4;
        for (int i = 0; i < 8; i++) {
          vec4 b = uBanks[i];
          if (b.w > 0.0) {
            float k = max(dot(d, normalize(b.xyz)), 0.0);
            haze += cHaze * (pow(k, 18.0) * 0.9 + pow(k, 90.0) * 1.6) * b.w;
          }
        }
        col += haze * uHaze;
        // clouds on a flattened dome
        if (uClouds > 0.0) {
          vec2 cp = d.xz / max(0.06, h + 0.1) * 1.2 + vec2(time * 0.006, time * 0.002);
          float cl = fbm(cp);
          float cover = mix(0.72, 0.18, uClouds);
          float c = smoothstep(cover, cover + 0.28, cl) * smoothstep(-0.02, 0.15, h);
          vec3 cc = mix(cHor * 1.05, cMid * 0.9, 0.35);
          cc += cGlow * pow(sd, 3.0) * 0.5 * uSun;
          cc += cHaze * uHaze * 0.6 * band;
          col = mix(col, cc, c * mix(0.75, 0.95, uClouds));
        }
        // stars (washed out by the lights near the horizon)
        if (uStars > 0.0 && h > 0.08) {
          vec2 sp = d.xz / (h + 0.25) * 240.0;
          float st = h21(floor(sp));
          float tw = 0.6 + 0.4 * sin(time * 1.7 + st * 50.0);
          col += vec3(step(0.9975, st) * tw * smoothstep(0.15, 0.6, h)) * uStars * 0.8;
        }
        // into the fog toward the horizon
        col = mix(col, cFog, uFogK * (1.0 - smoothstep(0.0, 0.5, h)) + uFogK * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  m.scale.setScalar(1500);
  m.frustumCulled = false;
  m.renderOrder = -10;
  m.name = 'sky';
  return m;
}
