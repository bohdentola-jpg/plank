// Weather around the camera, all instanced and animated in the vertex shader:
// rain streaks (world-stable, wrapped in a box that follows the camera),
// splashes on the turf, snowflakes that drift and sway, drifting fog banks,
// and the breath-steam puffs the match emits at players' heads in the cold.
//
//   const wx = createWeather(scene, { weather, wind, windDir, quality, night, field });
//   wx.update(dt, camera, time);  wx.dispose();
//   const breath = createBreath(scene);  breath.emit(x, y, z, dx, dz);  breath.update(dt);
import * as THREE from 'three';
import { makeRng } from '../../core/util.js';

function quadBase() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('corner', new THREE.Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function seeds(n, rng, w = 4) {
  const a = new Float32Array(n * w);
  for (let i = 0; i < a.length; i++) a[i] = rng();
  return a;
}

// ------------------------------------------------------------------ rain

const RAIN_VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec4 aSeed;
  uniform vec3 uCenter, uBox, uVel;
  uniform float uTime, uLen, uWidth;
  varying vec2 vC;
  varying float vFade;
  void main() {
    vec3 lo = uCenter - uBox * 0.5;
    vec3 p = aSeed.xyz * uBox + uVel * uTime * (0.85 + 0.3 * aSeed.w);
    p = mod(p - lo, uBox) + lo;
    vec3 v = normalize(uVel);
    vec3 toCam = cameraPosition - p;
    float dist = max(length(toCam), 1e-3);
    vec3 cx = cross(v, toCam / dist);
    float cl = length(cx);
    vec3 side = cl > 1e-4 ? cx / cl : vec3(1.0, 0.0, 0.0);
    // at least ~1.3 px wide so far streaks don't break into dashes; dimmer as they widen
    float w = max(uWidth, dist * 0.0021);
    vec3 wp = p + v * (corner.y * uLen) + side * corner.x * w;
    vec3 rel = abs(p - uCenter) / (uBox * 0.5);
    vFade = (1.0 - smoothstep(0.7, 1.0, max(rel.x, max(rel.y, rel.z)))) * smoothstep(0.8, 3.0, dist) * clamp(uWidth * 1.6 / w, 0.22, 1.0);
    vC = corner;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const RAIN_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying vec2 vC;
  varying float vFade;
  void main() {
    // MSAA can shade a pixel centre outside a sub-pixel quad: clamp everything
    vec2 c = clamp(vC, vec2(-0.5, 0.0), vec2(0.5, 1.0));
    float a = (1.0 - abs(c.x) * 2.0) * smoothstep(0.0, 0.3, c.y) * (1.0 - smoothstep(0.7, 1.0, c.y));
    gl_FragColor = vec4(uColor * max(a, 0.0) * clamp(vFade, 0.0, 1.0), 1.0);
  }`;

const SPLASH_VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec4 aSeed;
  uniform vec3 uCenter;
  uniform float uTime, uR;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    float period = 0.45 + aSeed.w * 0.6;
    float cyc = uTime / period + aSeed.z * 13.0;
    float k = floor(cyc);
    vAge = fract(cyc);
    // a new spot every cycle
    vec2 r = fract(vec2(sin(k * 12.9898 + aSeed.x * 78.2), sin(k * 39.346 + aSeed.y * 11.13)) * 43758.5453);
    vec2 c = uCenter.xz + (r - 0.5) * 2.0 * uR;
    float s = 0.08 + vAge * 0.32;
    vec3 wp = vec3(c.x + corner.x * s, 0.03, c.y + (corner.y - 0.5) * s);
    vUv = vec2(corner.x + 0.5, corner.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const SPLASH_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    float d = length(clamp(vUv, 0.0, 1.0) - 0.5) * 2.0;
    float ring = smoothstep(0.55, 0.8, d) * (1.0 - smoothstep(0.8, 1.0, d));
    float g = clamp(1.0 - vAge, 0.0, 1.0);
    gl_FragColor = vec4(uColor * max(ring, 0.0) * g * g, 1.0);
  }`;

// ------------------------------------------------------------------ snow

const SNOW_VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec4 aSeed;
  uniform vec3 uCenter, uBox, uVel;
  uniform float uTime, uSize;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vec3 lo = uCenter - uBox * 0.5;
    float t = uTime * (0.7 + 0.6 * aSeed.w);
    vec3 p = aSeed.xyz * uBox + uVel * t;
    p.x += sin(t * 1.3 + aSeed.x * 40.0) * 0.6;
    p.z += cos(t * 1.1 + aSeed.y * 40.0) * 0.6;
    p = mod(p - lo, uBox) + lo;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    float s = max(uSize * (0.6 + 0.8 * aSeed.w), dist * 0.0026);
    mv.xy += (corner - vec2(0.0, 0.5)) * s;
    vec3 rel = abs(p - uCenter) / (uBox * 0.5);
    vFade = (1.0 - smoothstep(0.65, 1.0, max(rel.x, max(rel.y, rel.z)))) * smoothstep(0.5, 2.0, dist);
    vUv = vec2(corner.x + 0.5, corner.y);
    gl_Position = projectionMatrix * mv;
  }`;
const SNOW_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float d = length(clamp(vUv, 0.0, 1.0) - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.3, 1.0, d)) * clamp(vFade, 0.0, 1.0);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * 0.85);
  }`;

// ------------------------------------------------------------------ fog banks + breath (soft puffs)

const PUFF_VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec4 aA;   // x, y, z, birth
  attribute vec4 aB;   // dx, dz, size, life
  uniform float uTime, uRise, uGrow;
  uniform vec4 uWrap;  // x0, z0, w, d (w > 0: drifting banks wrap around the bowl)
  varying vec2 vUv;
  varying float vA;
  void main() {
    float age = uTime - aA.w;
    float k = clamp(age / aB.w, 0.0, 1.0);
    vec3 p = aA.xyz + vec3(aB.x, 0.0, aB.y) * age + vec3(0.0, uRise * age, 0.0);
    if (uWrap.z > 0.0) {
      p.x = mod(p.x - uWrap.x, uWrap.z) + uWrap.x;
      p.z = mod(p.z - uWrap.y, uWrap.w) + uWrap.y;
      k = 0.0;
    }
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float s = aB.z * (1.0 + k * uGrow);
    mv.xy += (corner - vec2(0.0, 0.5)) * s;
    vA = uWrap.z > 0.0 ? 1.0 : ((age >= 0.0 && age < aB.w) ? sin(k * 3.14159) * (1.0 - k * 0.5) : 0.0);
    vUv = vec2(corner.x + 0.5, corner.y);
    gl_Position = projectionMatrix * mv;
  }`;
const PUFF_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  varying float vA;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, d)) ;
    a = a * a * vA * uAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

/**
 * opts: { weather, wind 0..1, windDir (rad), quality, night, dusk, field, hazeColor }
 */
export function createWeather(scene, opts) {
  const group = new THREE.Group();
  group.name = 'weather';
  scene.add(group);
  const rng = makeRng('weather' + opts.weather);
  const low = opts.quality === 'low';
  const wind = opts.wind ?? 0.3;
  const wd = opts.windDir ?? 0.6;
  const wv = new THREE.Vector2(Math.cos(wd), Math.sin(wd)).multiplyScalar(wind);
  const parts = [];
  const lit = opts.night ? 1.0 : opts.dusk ? 0.8 : 0.65;

  if (opts.weather === 'rain') {
    const n = low ? 3500 : 11000;
    const g = quadBase();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(n, rng), 4));
    g.instanceCount = n;
    const u = {
      uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(34, 22, 34) },
      uVel: { value: new THREE.Vector3(wv.x * 9, -26, wv.y * 9) }, uTime: { value: 0 },
      uLen: { value: 0.6 }, uWidth: { value: 0.01 },
      uColor: { value: new THREE.Color(0.25, 0.28, 0.33).multiplyScalar(lit) },
    };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, uniforms: u,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.frustumCulled = false;
    m.renderOrder = 8;
    group.add(m);
    parts.push({ u, follow: 'cam', ahead: 12 });
    // splashes on the ground near the camera
    const ns = low ? 0 : 700;
    if (ns) {
      const gs = quadBase();
      gs.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(ns, rng), 4));
      gs.instanceCount = ns;
      const us = {
        uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 }, uR: { value: 22 },
        uColor: { value: new THREE.Color(0.55, 0.6, 0.66).multiplyScalar(lit * 0.9) },
      };
      const ms = new THREE.Mesh(gs, new THREE.ShaderMaterial({
        vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG, uniforms: us,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      }));
      ms.frustumCulled = false;
      ms.renderOrder = 3;
      group.add(ms);
      parts.push({ u: us, follow: 'ground' });
    }
  }

  if (opts.weather === 'snow') {
    const n = low ? 3500 : 9000;
    const g = quadBase();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(n, rng), 4));
    g.instanceCount = n;
    const u = {
      uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(46, 28, 46) },
      uVel: { value: new THREE.Vector3(wv.x * 4, -1.6, wv.y * 4) }, uTime: { value: 0 },
      uSize: { value: 0.05 },
      uColor: { value: new THREE.Color(0.95, 0.97, 1.0).multiplyScalar(opts.night ? 1.3 : 1.1) },
    };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG, uniforms: u,
      transparent: true, depthWrite: false,
    }));
    m.frustumCulled = false;
    m.renderOrder = 8;
    group.add(m);
    parts.push({ u, follow: 'cam', ahead: 14 });
  }

  if (opts.weather === 'fog' || (opts.weather === 'rain' && opts.night)) {
    // slow banks of fog drifting across the bowl at a few yards up
    const n = opts.weather === 'fog' ? (low ? 30 : 60) : 18;
    const g = quadBase();
    const A = new Float32Array(n * 4), Bv = new Float32Array(n * 4);
    const F = opts.field || { halfW: 20, end: 50 };
    const WX = F.halfW * 2 + 60, WZ = F.end * 2 + 50;
    for (let i = 0; i < n; i++) {
      A.set([(rng() - 0.5) * WX, 1.5 + rng() * 7, (rng() - 0.5) * WZ, 0], i * 4);
      Bv.set([wv.x * 1.5 + (rng() - 0.5) * 0.4 + 0.2, wv.y * 1.5 + (rng() - 0.5) * 0.4, 14 + rng() * 16, 1e6], i * 4);
    }
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
    g.setAttribute('aB', new THREE.InstancedBufferAttribute(Bv, 4));
    g.instanceCount = n;
    const u = {
      uTime: { value: 0 }, uRise: { value: 0 }, uGrow: { value: 0.3 },
      uWrap: { value: new THREE.Vector4(-WX / 2, -WZ / 2, WX, WZ) },
      uColor: { value: new THREE.Color(opts.hazeColor || '#9aa4b0') }, uAlpha: { value: opts.weather === 'fog' ? 0.16 : 0.06 },
    };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, uniforms: u, transparent: true, depthWrite: false,
    }));
    m.frustumCulled = false;
    m.renderOrder = 7;
    group.add(m);
    parts.push({ u, follow: null });
  }

  const fwd = new THREE.Vector3();
  return {
    group,
    update(dt, camera, t) {
      if (!camera) return;
      camera.getWorldDirection(fwd);
      for (const p of parts) {
        p.u.uTime.value = t;
        if (p.follow === 'cam') p.u.uCenter.value.copy(camera.position).addScaledVector(fwd, p.ahead || 0);
        else if (p.follow === 'ground') {
          // the patch of turf the camera is looking at
          const k = fwd.y < -0.05 ? Math.min(40, camera.position.y / -fwd.y) : 20;
          p.u.uCenter.value.copy(camera.position).addScaledVector(fwd, k * 0.7);
        }
      }
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    },
  };
}

/**
 * Breath steam for the cold: emit(x, y, z, dx, dz) at a player's mouth
 * (dx, dz = facing, the puff drifts that way), update(dt) every frame.
 */
export function createBreath(scene, opts = {}) {
  const N = opts.count || 96;
  const g = quadBase();
  const A = new Float32Array(N * 4).fill(-100), Bv = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) Bv.set([0, 0, 0.12, 1.2], i * 4);
  const aA = new THREE.InstancedBufferAttribute(A, 4); aA.setUsage(THREE.DynamicDrawUsage);
  const aB = new THREE.InstancedBufferAttribute(Bv, 4); aB.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aA', aA);
  g.setAttribute('aB', aB);
  g.instanceCount = N;
  const u = {
    uTime: { value: 0 }, uRise: { value: 0.12 }, uGrow: { value: 3.2 }, uWrap: { value: new THREE.Vector4(0, 0, 0, 0) },
    uColor: { value: new THREE.Color(opts.color || '#e8eef6').multiplyScalar(opts.bright ?? 0.95) }, uAlpha: { value: opts.alpha ?? 0.3 },
  };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, uniforms: u, transparent: true, depthWrite: false,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  mesh.name = 'breath';
  scene.add(mesh);
  let head = 0, t = 0;
  return {
    mesh,
    emit(x, y, z, dx = 0, dz = 0) {
      const l = Math.hypot(dx, dz) || 1;
      const sp = 0.35;
      A.set([x + (dx / l) * 0.3, y - 0.06, z + (dz / l) * 0.3, t], head * 4);
      Bv.set([(dx / l) * sp, (dz / l) * sp, 0.1 + Math.random() * 0.05, 0.9 + Math.random() * 0.6], head * 4);
      head = (head + 1) % N;
      aA.needsUpdate = true;
      aB.needsUpdate = true;
    },
    update(dt) { t += dt; u.uTime.value = t; },
    dispose() { scene.remove(mesh); g.dispose(); mesh.material.dispose(); },
  };
}
