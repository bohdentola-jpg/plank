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

/** A horizontal band around the eye (stands, horizon city) from y0 to y1. */
function ring(scene, color, intensity, radius, y0, y1) {
  const g = new THREE.CylinderGeometry(radius, radius, y1 - y0, 32, 1, true);
  g.translate(0, (y0 + y1) / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.BackSide }));
  scene.add(m);
  return m;
}

/** Stadium light banks all around at an elevation, aimed at the middle. */
function banks(scene, n, color, intensity, radius, y, w = 4, h = 1.6, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    glow(scene, color, intensity, w, h, Math.cos(a) * radius, y, Math.sin(a) * radius);
  }
}

const PRESETS = {
  // ---- stadiums (HARD COUNT venues): the field below, stands around, banks above
  stadium_night(s) {
    s.add(skyDome('#03050b', '#141c30', '#2a4a22', 1.8));
    ring(s, '#1c2232', 1, 30, -2, 8);
    ring(s, '#2a3044', 1, 30, -6, -2);
    banks(s, 8, '#eef3ff', 16, 26, 15, 5, 1.8, 0.2);
    banks(s, 6, '#ffffff', 6, 28, 9, 3, 1.0, 0.7);
    glow(s, '#3a6a2c', 1.6, 50, 50, 0, -12, 0, [0, 0, 0]);
  },
  stadium_dusk(s) {
    s.add(skyDome('#1c2450', '#d07a5a', '#2c3a1e', 1.3));
    ring(s, '#3a3440', 1, 30, -2, 7);
    glow(s, '#ffb070', 14, 6, 2.5, 30, 3, -8);
    banks(s, 8, '#fff0dc', 8, 26, 15, 5, 1.8, 0.2);
    glow(s, '#4a6a30', 1.6, 50, 50, 0, -12, 0, [0, 0, 0]);
  },
  stadium_day(s) {
    s.add(skyDome('#3a72c4', '#cfe0f0', '#4a6a34', 1.4));
    ring(s, '#7a7c82', 1, 30, -2, 7);
    glow(s, '#fff6e0', 40, 3, 3, 18, 26, 14);
    glow(s, '#5a8a3c', 2.2, 50, 50, 0, -12, 0, [0, 0, 0]);
  },
  stadium_overcast(s) {
    s.add(skyDome('#9aa2ad', '#c4cad0', '#45583a', 1.0));
    ring(s, '#5a5c62', 1, 30, -2, 7);
    glow(s, '#ffffff', 2.5, 40, 20, 0, 25, 0);
    banks(s, 8, '#ffffff', 3, 26, 15, 5, 1.8, 0.2);
    glow(s, '#4a6a3a', 1.6, 50, 50, 0, -12, 0, [0, 0, 0]);
  },
  dome(s) {
    s.add(skyDome('#0c0e14', '#1a1e28', '#2a5a2a', 1.6));
    ring(s, '#2a2e3a', 1, 30, -3, 9);
    ring(s, '#ffd9a0', 1.2, 29.5, 4.5, 5.2);
    banks(s, 12, '#f4f8ff', 14, 20, 22, 4, 1.4, 0.1);
    banks(s, 8, '#ffffff', 9, 12, 26, 3, 1.0, 0.4);
    glow(s, '#3a7a34', 2.2, 50, 50, 0, -12, 0, [0, 0, 0]);
  },
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
