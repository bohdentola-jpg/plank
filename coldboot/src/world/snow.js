// Falling snow: a box of flakes that follows the camera and wraps, drawn as
// soft points that drift on the wind and tumble. Lit flakes near lamps bloom.
import * as THREE from 'three';

const VERT = /* glsl */`
uniform float time;
uniform vec3 boxMin;
uniform vec3 boxSize;
uniform vec3 wind;
uniform float fall;
uniform float size;
uniform float pxScale;
attribute float seed;
varying float vAlpha;
void main() {
  vec3 p = position;
  float t = time;
  p.y -= t * fall * (0.6 + seed * 0.8);
  p.xz += wind.xz * t * (0.7 + seed * 0.6);
  p.x += sin(t * (0.8 + seed) + seed * 30.0) * 0.35;
  p.z += cos(t * (0.6 + seed * 0.7) + seed * 17.0) * 0.35;
  // wrap into the box that follows the camera
  p = boxMin + mod(p - boxMin, boxSize);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = size * (0.5 + seed) * pxScale / max(d, 0.3);
  vAlpha = smoothstep(0.2, 1.5, d) * (1.0 - smoothstep(boxSize.x * 0.35, boxSize.x * 0.5, d));
}
`;

const FRAG = /* glsl */`
uniform vec3 color;
uniform float opacity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c) * 4.0;
  float a = (1.0 - r) * (1.0 - r);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(color, a * vAlpha * opacity);
}
`;

export function createSnow({ count = 9000, box = 60, height = 30 } = {}) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * box;
    pos[i * 3 + 1] = Math.random() * height;
    pos[i * 3 + 2] = Math.random() * box;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    time: { value: 0 },
    boxMin: { value: new THREE.Vector3() },
    boxSize: { value: new THREE.Vector3(box, height, box) },
    wind: { value: new THREE.Vector3(1.2, 0, 0.4) },
    fall: { value: 1.1 },
    size: { value: 0.09 },
    pxScale: { value: 700 },
    color: { value: new THREE.Color(1.6, 1.7, 1.85) },
    opacity: { value: 0.8 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return {
    points,
    uniforms,
    set intensity(v) { uniforms.opacity.value = v; points.visible = v > 0.01; },
    update(dt, camera, viewportH = 720) {
      uniforms.time.value += dt;
      uniforms.pxScale.value = viewportH * 1.0;
      if (camera) {
        uniforms.boxMin.value.set(camera.position.x - box / 2, camera.position.y - height * 0.6, camera.position.z - box / 2);
      }
    },
  };
}
