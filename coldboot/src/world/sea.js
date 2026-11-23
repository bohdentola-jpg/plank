// The Bering Sea in November: black water with a slow swell, a cold sky
// reflection, the moon's path, and shore-fast ice — white plates with
// pressure cracks where the water is shallow, broken floes further out.
import * as THREE from 'three';
import { MAP, groundY } from './terrain.js';
import { WU } from './worldUniforms.js';

const VERT = /* glsl */`
varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uDepth;
uniform vec4 uMap;      // x0, z0, 1/w, 1/h
uniform vec3 uSkyTop;
uniform vec3 uSkyHor;
uniform vec3 uMoonDir;
uniform float uNight;
uniform vec3 uAurora;
varying vec3 vW;
#include <fog_pars_fragment>
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// voronoi distance to the nearest cell edge (ice plates)
vec2 vor(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; float id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(h21(n + g), h21(n + g + 17.0));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = h21(n + g + 3.0); } else if (d < d2) d2 = d;
  }
  return vec2(d2 - d1, id);
}
void main() {
  vec2 uv = (vW.xz - uMap.xy) * uMap.zw;
  float depth = texture2D(uDepth, uv).r * 16.0; // metres below sea level (0..16)
  float inMap = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  depth = mix(16.0, depth, inMap);
  vec3 V = normalize(cameraPosition - vW);
  // swell normal
  float t = uTime;
  vec2 q = vW.xz * 0.08;
  float hx = vn(q + vec2(t * 0.05, t * 0.03)) - vn(q + vec2(0.37, 0.0) + vec2(t * 0.05, t * 0.03));
  float hz = vn(q + vec2(t * 0.04, -t * 0.02)) - vn(q + vec2(0.0, 0.37) + vec2(t * 0.04, -t * 0.02));
  vec3 N = normalize(vec3(hx * 0.6, 1.0, hz * 0.6));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y * 2.0, 0.0, 1.0)) + uAurora * 0.25 * smoothstep(0.1, 0.5, R.y);
  float moon = pow(max(dot(R, uMoonDir), 0.0), 300.0) * 6.0 + pow(max(dot(R, uMoonDir), 0.0), 20.0) * 0.15;
  vec3 water = vec3(0.004, 0.012, 0.018) + sky * fres + vec3(0.75, 0.82, 0.95) * moon * uNight;
  // ice: shore-fast where shallow, floes beyond
  vec2 v = vor(vW.xz * 0.06);
  vec2 v2 = vor(vW.xz * 0.22 + 4.0);
  float shallow = smoothstep(5.5, 1.5, depth);
  float floes = step(0.62, v.y) * smoothstep(9.0, 5.0, depth) * 0.9;
  float ice = max(shallow, floes);
  float crack = smoothstep(0.0, 0.06, v.x) * mix(1.0, smoothstep(0.0, 0.05, v2.x), 0.6);
  vec3 iceCol = vec3(0.78, 0.84, 0.9) * (0.85 + 0.15 * vn(vW.xz * 0.5));
  iceCol = mix(vec3(0.05, 0.12, 0.16), iceCol, crack);           // dark water in the cracks
  iceCol += vec3(0.75, 0.82, 0.95) * moon * 0.05 * uNight;
  // lit by the night: the ice catches moonlight and aurora a little
  iceCol *= mix(1.0, 0.32, uNight);
  iceCol += uAurora * 0.05 * uNight;
  vec3 col = mix(water, iceCol, ice * (0.6 + 0.4 * step(0.5, crack)));
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

export function buildSea() {
  // depth texture from the terrain (4 m cells; sea floor only)
  const step = 4;
  const w = Math.floor((MAP.x1 - MAP.x0) / step), h = Math.floor((MAP.z1 - MAP.z0) / step);
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const y = groundY(MAP.x0 + i * step, MAP.z0 + j * step);
    const d = Math.max(0, Math.min(1, -y / 16));
    const k = (j * w + i) * 4;
    data[k] = d * 255; data[k + 1] = 0; data[k + 2] = 0; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: WU.time, uNight: WU.night,
    uDepth: { value: tex },
    uMap: { value: new THREE.Vector4(MAP.x0, MAP.z0, 1 / (w * step), 1 / (h * step)) },
    uSkyTop: { value: new THREE.Color(0.01, 0.02, 0.05) },
    uSkyHor: { value: new THREE.Color(0.03, 0.06, 0.09) },
    uMoonDir: { value: new THREE.Vector3(-0.4, 0.45, -0.8).normalize() },
    uAurora: { value: new THREE.Color(0.05, 0.4, 0.22) },
  }]);
  uniforms.uTime = WU.time; uniforms.uNight = WU.night;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(250, 0.0, 0);
  mesh.name = 'sea';
  return { mesh, uniforms };
}
