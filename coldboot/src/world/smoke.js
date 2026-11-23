// Chimney and stovepipe smoke: one Points cloud for the whole town. Every
// emitter (a building's `smoke*` point) owns a few particles that loop up and
// drift with the wind; all the motion is in the vertex shader.
import * as THREE from 'three';
import { WU } from './worldUniforms.js';

const VERT = /* glsl */`
  attribute float seed;
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uScale;
  varying float vA;
  #include <fog_pars_vertex>
  void main() {
    float life = fract(uTime * 0.11 + seed);
    vec3 p = position;
    float rise = life * 4.8;
    p.y += rise;
    p.xz += uWind * (life * life * 4.0 + life * 1.2);
    p.x += sin(uTime * 0.7 + seed * 40.0 + life * 5.0) * 0.35 * life;
    p.z += cos(uTime * 0.6 + seed * 31.0 + life * 4.0) * 0.35 * life;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float size = mix(0.9, 6.5, life);
    gl_PointSize = size * uScale / max(1.0, -mvPosition.z);
    vA = smoothstep(0.0, 0.08, life) * (1.0 - life);
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */`
  uniform float uNight;
  varying float vA;
  #include <fog_pars_fragment>
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.05, r) * vA * mix(0.16, 0.12, uNight);
    if (a < 0.003) discard;
    vec3 c = mix(vec3(0.6, 0.6, 0.64), vec3(0.14, 0.15, 0.18), uNight);
    gl_FragColor = vec4(c, a);
    #include <fog_fragment>
  }
`;

export class ChimneySmoke {
  /** points: [{x, y, z}] emitter positions in world space */
  constructor(points, per = 12) {
    const n = points.length * per;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    points.forEach((p, i) => {
      for (let k = 0; k < per; k++) {
        const j = i * per + k;
        pos[j * 3] = p.x; pos[j * 3 + 1] = p.y; pos[j * 3 + 2] = p.z;
        seed[j] = k / per + (i * 0.618) % 1 / per;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2000);
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.6, 0.2) }, uScale: { value: 400 }, uNight: WU.night,
    }]);
    this.uniforms.uNight = WU.night;
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  update(dt, viewHeight = 720) {
    const u = this.uniforms;
    u.uTime.value += dt;
    u.uScale.value = viewHeight * 0.9;
    const w = WU.wind.value;
    u.uWind.value.set(w.x * 0.55, w.y * 0.55);
  }
}
