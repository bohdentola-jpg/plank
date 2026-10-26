// Reflection environments for car paint/glass. Each preset is a tiny scene
// (gradient sky dome + glowing shapes) baked through PMREM once.
import * as THREE from 'three';

const cache = new Map();

function skyDome(top, horizon, bottom, sharp = 1.5) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
      sharp: { value: sharp },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform float sharp; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 1.0/sharp)) : mix(horizon, bottom, pow(-h, 0.5));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), mat);
}

function glow(scene, color, intensity, w, h, x, y, z, lookAt = [0, 0, 0]) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
  );
  m.position.set(x, y, z);
  m.lookAt(...lookAt);
  scene.add(m);
  return m;
}

const PRESETS = {
  studio(s) {
    s.add(skyDome('#1a1c21', '#2b2e35', '#0d0e10'));
    glow(s, '#ffffff', 5, 16, 6, 0, 16, 0);
    glow(s, '#e9f0ff', 3, 2, 26, -14, 6, 0);
    glow(s, '#e9f0ff', 3, 2, 26, 14, 6, 0);
    glow(s, '#ffffff', 1.5, 30, 1, 0, 3, -18);
  },
  garage(s) {
    s.add(skyDome('#121417', '#1d2024', '#0b0c0e'));
    for (let i = -2; i <= 2; i++) {
      glow(s, '#eaf4ff', 6, 0.6, 9, i * 4, 9, 0, [i * 4, 0, 0]);
    }
    glow(s, '#ff9a3a', 1.2, 6, 3, 15, 3, 6);
    glow(s, '#3a7bff', 0.8, 6, 3, -15, 3, -6);
  },
  night(s) {
    s.add(skyDome('#05070d', '#1b1d2a', '#07080a', 2.2));
    const cols = ['#ff9c3a', '#ffb050', '#ff8a2a'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      glow(s, cols[i % 3], 7, 1.1, 1.1, Math.cos(a) * 22, 8 + (i % 3) * 2, Math.sin(a) * 22);
    }
    glow(s, '#ff2a8a', 3, 4, 1.2, 18, 3, -10);
    glow(s, '#2ad8ff', 3, 5, 1.0, -20, 4, 8);
    glow(s, '#9a5cff', 2, 6, 1.0, 5, 2.5, 22);
    glow(s, '#ffffff', 0.25, 40, 6, 0, 1, -30);
  },
  day(s) {
    s.add(skyDome('#3f78c9', '#c9dcf0', '#5a5650', 1.4));
    glow(s, '#fff6e0', 40, 3, 3, 20, 26, 12);
    glow(s, '#ffffff', 1.2, 30, 8, 0, 6, -30);
  },
  sunset(s) {
    s.add(skyDome('#2a2f5e', '#ff8a4a', '#2a1c1a', 1.1));
    glow(s, '#ffb070', 30, 3, 3, 28, 4, -10);
    glow(s, '#ff6a8a', 2, 30, 4, -20, 6, 20);
  },
  dusk(s) {
    s.add(skyDome('#101736', '#a85a5a', '#0f0d12', 1.6));
    glow(s, '#ffb070', 6, 6, 2, 25, 2, -15);
    for (let i = 0; i < 8; i++) glow(s, '#ffa040', 4, 0.8, 0.8, -25 + i * 7, 6, 20);
  },
  overcast(s) {
    s.add(skyDome('#9aa2ad', '#c6ccd3', '#4b4a48', 1.0));
    glow(s, '#ffffff', 2.5, 40, 20, 0, 25, 0);
  },
  stadium(s) {
    // night game: black sky, four banks of cool-white floodlights high up,
    // a dim warm ring of stands at the horizon, green bounce from the field
    s.add(skyDome('#020309', '#10141f', '#06080a', 2.6));
    for (const [x, z] of [[-21, -17], [21, -17], [-21, 17], [21, 17]]) {
      glow(s, '#eef4ff', 16, 7, 2.4, x, 15, z);
      glow(s, '#cfe0ff', 3, 9, 4.5, x * 1.02, 15, z * 1.02);
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      glow(s, i % 3 ? '#ffc890' : '#9ab0ff', 0.32, 8, 2.6, Math.cos(a) * 27, 2.5, Math.sin(a) * 27);
    }
    glow(s, '#1d3a14', 0.9, 70, 70, 0, -7, 0);
  },
  interior(s) {
    s.add(skyDome('#05060a', '#0e1018', '#030304', 2));
    glow(s, '#ffa640', 3, 3, 0.6, 0, 6, 20);
    glow(s, '#ff2a6a', 2, 3, 1, 14, 3, 12);
    glow(s, '#30c0ff', 2, 3, 1, -14, 3, 12);
  },
};

/** Returns a PMREM texture for a preset name (cached per renderer). */
export function getEnvMap(renderer, name = 'studio') {
  if (cache.has(name)) return cache.get(name);
  const scene = new THREE.Scene();
  (PRESETS[name] || PRESETS.studio)(scene);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  cache.set(name, rt.texture);
  return rt.texture;
}
