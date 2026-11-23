// The sky over the Bering Strait: a gradient dome with stars, a moon, a sun
// that barely clears the hills in November, thin cloud, and the aurora — curtains
// raymarched through layered triangle-wave noise (after nimitz's "Auroras").
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // on the far plane
}
`;

const FRAG = /* glsl */`
uniform float time;
uniform vec3 sunDir;
uniform vec3 moonDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 sunColor;
uniform float sunAmt;
uniform float starAmt;
uniform float aurora;
uniform vec3 auroraA;
uniform vec3 auroraB;
uniform float cloud;
uniform vec3 cloudColor;
uniform float moonAmt;
varying vec3 vDir;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float tri(float x) { return clamp(abs(fract(x) - 0.5), 0.01, 0.49); }
vec2 tri2(vec2 p) { return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x))); }
float triNoise2d(vec2 p, float spd) {
  float z = 1.8, z2 = 2.5, rz = 0.0;
  p *= rot(p.x * 0.06);
  vec2 bp = p;
  for (int i = 0; i < 5; i++) {
    vec2 dg = tri2(bp * 1.85) * 0.75;
    dg *= rot(time * spd);
    p -= dg / z2;
    bp *= 1.3;
    z2 *= 0.45;
    z *= 0.42;
    p *= 1.21 + (rz - 1.0) * 0.02;
    rz += tri(p.x + tri(p.y)) * z;
    p *= -mat2(0.95534, 0.29552, -0.29552, 0.95534);
  }
  return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
}
vec4 auroraCol(vec3 rd) {
  vec4 col = vec4(0.0);
  vec4 avg = vec4(0.0);
  for (int i = 0; i < 36; i++) {
    float of = 0.006 * hash12(gl_FragCoord.xy) * smoothstep(0.0, 15.0, float(i));
    float pt = ((0.8 + pow(float(i), 1.4) * 0.002)) / (rd.y * 2.0 + 0.4);
    pt -= of;
    vec3 bpos = vec3(0.0, 0.0, -6.5) + pt * rd;
    vec2 p = bpos.zx;
    float rzt = triNoise2d(p, 0.06);
    vec4 col2 = vec4(0.0, 0.0, 0.0, rzt);
    float k = float(i) / 36.0;
    col2.rgb = mix(auroraA, auroraB, smoothstep(0.15, 0.9, k)) * rzt;
    avg = mix(avg, col2, 0.5);
    col += avg * exp2(-float(i) * 0.065 - 2.5) * smoothstep(0.0, 5.0, float(i));
  }
  col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
  return col * 1.8;
}

void main() {
  vec3 rd = normalize(vDir);
  float h = rd.y;
  // base gradient
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
  col = mix(col, ground, smoothstep(0.0, -0.08, h));
  // sun glow low on the horizon
  float sd = max(dot(rd, sunDir), 0.0);
  col += sunColor * (pow(sd, 6.0) * 0.35 + pow(sd, 64.0) * 1.2 + pow(sd, 2400.0) * 40.0) * sunAmt;
  col += sunColor * 0.25 * sunAmt * exp(-abs(h) * 9.0) * (0.4 + 0.6 * pow(max(dot(normalize(rd.xz), normalize(sunDir.xz)), 0.0), 3.0));
  if (h > 0.0) {
    // stars
    vec3 sp = rd * 420.0;
    vec3 cell = floor(sp);
    float st = hash13(cell);
    float tw = 0.65 + 0.35 * sin(time * (1.5 + st * 4.0) + st * 40.0);
    float star = smoothstep(0.9965, 1.0, st) * tw * smoothstep(0.02, 0.25, h);
    col += vec3(0.8, 0.88, 1.0) * star * starAmt * 2.2;
    // milky haze
    col += vec3(0.05, 0.06, 0.09) * starAmt * smoothstep(0.5, 1.0, 1.0 - abs(dot(rd, normalize(vec3(0.3, 0.6, -0.74))))) * 0.6;
    // aurora
    if (aurora > 0.001) {
      vec4 a = auroraCol(rd);
      col = col * (1.0 - a.a * aurora * 0.6) + a.rgb * aurora;
    }
    // moon
    float md = dot(rd, moonDir);
    col += vec3(0.75, 0.8, 0.9) * (smoothstep(0.99955, 0.9997, md) * 6.0 + pow(max(md, 0.0), 200.0) * 0.25) * moonAmt;
  }
  // thin high cloud
  if (cloud > 0.001 && h > 0.0) {
    vec2 uv = rd.xz / (h + 0.15) * 1.2 + vec2(time * 0.004, 0.0);
    float n = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { n += a * hash12(floor(uv * 3.0)) ; uv *= 2.03; a *= 0.5; }
    float c = smoothstep(0.45, 0.85, n) * cloud * smoothstep(0.0, 0.2, h);
    col = mix(col, cloudColor, c * 0.6);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky() {
  const uniforms = {
    time: { value: 0 },
    sunDir: { value: new THREE.Vector3(0.6, -0.2, -0.7).normalize() },
    moonDir: { value: new THREE.Vector3(-0.4, 0.45, -0.8).normalize() },
    zenith: { value: new THREE.Color(0.004, 0.008, 0.022) },
    horizon: { value: new THREE.Color(0.02, 0.05, 0.08) },
    ground: { value: new THREE.Color(0.01, 0.012, 0.018) },
    sunColor: { value: new THREE.Color(1.0, 0.55, 0.3) },
    sunAmt: { value: 0 },
    starAmt: { value: 1 },
    aurora: { value: 1 },
    auroraA: { value: new THREE.Color(0.1, 1.0, 0.55) },
    auroraB: { value: new THREE.Color(0.55, 0.2, 0.95) },
    cloud: { value: 0 },
    cloudColor: { value: new THREE.Color(0.05, 0.06, 0.08) },
    moonAmt: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.scale.setScalar(1000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    uniforms,
    update(dt, camera) {
      uniforms.time.value += dt;
      if (camera) mesh.position.copy(camera.position);
    },
  };
}
