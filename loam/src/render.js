// Putting the world on screen: a chunk shader that mixes the two baked light
// channels (sky × time-of-day tint + warm torchlight) with radial fog, a
// mesh manager that turns mesher output into scene geometry on a budget, and
// the sky itself — square sun, square moon, drifting blocky clouds, stars.
import * as THREE from 'three';
import { buildAtlas, tileUV } from './textures.js';
import { buildChunkMesh } from './mesher.js';
import { ckey } from './world.js';
import { clamp, lerp, rng } from './util.js';

const VERT = /* glsl */`
attribute vec2 light;
varying vec2 vUv; varying vec2 vLight; varying float vDist;
void main() {
  vUv = uv; vLight = light;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDist = distance(wp.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform vec3 skyTint; uniform vec3 torchTint;
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
uniform float alpha;
varying vec2 vUv; varying vec2 vLight; varying float vDist;
void main() {
  vec4 tex = texture2D(map, vUv);
  #ifdef CUTOUT
  if (tex.a < 0.5) discard;
  #endif
  vec3 lit = tex.rgb * min(vec3(1.25), skyTint * vLight.x + torchTint * vLight.y + vec3(0.032, 0.036, 0.052));
  float f = smoothstep(fogNear, fogFar, vDist);
  gl_FragColor = vec4(mix(lit, fogColor, f), tex.a * alpha);
}`;

export function makeChunkMaterials() {
  const atlas = buildAtlas();
  const tex = new THREE.CanvasTexture(atlas.canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace; // shader works in display space, retro and crisp
  const uniforms = () => ({
    map: { value: tex },
    skyTint: { value: new THREE.Color(1, 1, 1) },
    torchTint: { value: new THREE.Color(1.25, 0.92, 0.55) },
    fogColor: { value: new THREE.Color('#86b8e8') },
    fogNear: { value: 60 }, fogFar: { value: 110 },
    alpha: { value: 1 },
  });
  const solid = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: uniforms(), defines: { CUTOUT: 1 },
  });
  const fluid = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: uniforms(),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  fluid.uniforms.alpha.value = 0.82;
  return { solid, fluid };
}

export class ChunkView {
  constructor(scene) {
    this.scene = scene;
    this.mats = makeChunkMaterials();
    this.meshes = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  // light + fog uniforms, shared by both passes
  setLight({ skyTint, fogColor, fogNear, fogFar }) {
    for (const m of [this.mats.solid, this.mats.fluid]) {
      m.uniforms.skyTint.value.setRGB(...skyTint);
      m.uniforms.fogColor.value.copy(fogColor);
      m.uniforms.fogNear.value = fogNear;
      m.uniforms.fogFar.value = fogFar;
    }
  }

  // rebuild at most `maxBuilds` chunk meshes this frame
  consume(world, { mesh, removed }, maxBuilds = 2) {
    for (const k of removed) this._drop(k);
    let built = 0;
    for (const chunk of mesh) {
      if (built >= maxBuilds) break;
      this._build(world, chunk);
      built++;
    }
    return built;
  }

  _build(world, chunk) {
    const k = ckey(chunk.cx, chunk.cz);
    this._drop(k);
    const data = buildChunkMesh(world, chunk, tileUV);
    const entry = {};
    for (const pass of ['solid', 'fluid']) {
      const d = data[pass];
      if (!d.count) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
      geo.setAttribute('light', new THREE.BufferAttribute(d.light, 2));
      geo.setIndex(new THREE.BufferAttribute(d.index, 1));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, this.mats[pass]);
      m.renderOrder = pass === 'fluid' ? 2 : 0;
      this.group.add(m);
      entry[pass] = m;
    }
    this.meshes.set(k, entry);
    chunk.meshStale = false;
    chunk.hasMesh = true;
  }

  _drop(k) {
    const e = this.meshes.get(k);
    if (!e) return;
    for (const pass of Object.values(e)) {
      this.group.remove(pass);
      pass.geometry.dispose();
    }
    this.meshes.delete(k);
  }

  dispose() {
    for (const k of [...this.meshes.keys()]) this._drop(k);
    this.scene.remove(this.group);
  }
}

// ------------------------------------------------------------ sky
// time t in [0,1): 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 deep night
export function dayState(t) {
  const elev = Math.sin(t * Math.PI * 2);
  const day = clamp((elev + 0.12) / 0.3, 0, 1) ** 1.3;
  const dusk = Math.exp(-(elev * elev) / 0.018);
  const mix3 = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  let sky = mix3([0.015, 0.025, 0.07], [0.46, 0.7, 0.94], day);
  sky = mix3(sky, [0.93, 0.48, 0.26], dusk * 0.5 * clamp(elev + 0.3, 0, 1));
  const skyTint = mix3([0.10, 0.13, 0.25], [1.0, 0.98, 0.92], day);
  return {
    day, elev, sky, skyTint,
    sun: [Math.cos(t * Math.PI * 2), Math.sin(t * Math.PI * 2), 0.18],
  };
}

function squareTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

export class Sky {
  constructor(scene, camera) {
    this.scene = scene;
    this.anchor = new THREE.Group(); // follows the camera so the sky never "arrives"
    scene.add(this.anchor);

    const sunTex = squareTex((g) => {
      g.fillStyle = '#fdf2b0'; g.fillRect(8, 8, 48, 48);
      g.fillStyle = '#fff9d8'; g.fillRect(16, 16, 32, 32);
    });
    const moonTex = squareTex((g) => {
      g.fillStyle = '#e8ecf4'; g.fillRect(12, 12, 40, 40);
      g.fillStyle = '#c4ccdc'; g.fillRect(20, 20, 16, 16); g.fillRect(40, 32, 8, 12);
    });
    const mkBillboard = (tex, size) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }),
      );
      m.renderOrder = -8;
      this.anchor.add(m);
      return m;
    };
    this.sun = mkBillboard(sunTex, 34);
    this.moon = mkBillboard(moonTex, 22);

    // stars: fixed shell, fades with daylight
    const starGeo = new THREE.BufferGeometry();
    const r = rng(4242);
    const n = 420, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = s * Math.cos(a) * 180; pos[i * 3 + 1] = Math.abs(u) * 180; pos[i * 3 + 2] = s * Math.sin(a) * 180;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: '#cdd8ee', size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false,
    }));
    this.stars.renderOrder = -9;
    this.anchor.add(this.stars);

    // blocky cloud sheet, scrolling forever
    const cloudCan = document.createElement('canvas');
    cloudCan.width = cloudCan.height = 64;
    const g = cloudCan.getContext('2d');
    const cr = rng(777);
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 0; i < 26; i++) {
      const x = (cr() * 64) | 0, y = (cr() * 64) | 0, w = 4 + ((cr() * 10) | 0), h = 2 + ((cr() * 5) | 0);
      g.fillRect(x, y, w, h);
      if (cr() < 0.6) g.fillRect(x + 2, y + h, w - 4, 2);
    }
    this.cloudTex = new THREE.CanvasTexture(cloudCan);
    this.cloudTex.wrapS = this.cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudTex.magFilter = THREE.NearestFilter;
    this.cloudTex.repeat.set(3, 3);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760),
      new THREE.MeshBasicMaterial({
        map: this.cloudTex, transparent: true, opacity: 0.55, fog: false,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.renderOrder = -1;
    scene.add(this.clouds);
  }

  update(t, camera, elapsed) {
    const st = dayState(t);
    this.anchor.position.copy(camera.position);
    const sd = new THREE.Vector3(...st.sun).normalize();
    this.sun.position.copy(sd).multiplyScalar(170);
    this.sun.lookAt(camera.position);
    this.moon.position.copy(sd).multiplyScalar(-170);
    this.moon.lookAt(camera.position);
    this.sun.material.opacity = clamp(st.elev * 4 + 0.6, 0, 1);
    this.moon.material.opacity = clamp(-st.elev * 4 + 0.6, 0, 0.95);
    this.stars.material.opacity = clamp(0.9 - st.day * 1.4, 0, 0.9);
    this.stars.rotation.z = t * Math.PI * 2 * 0.25;

    this.clouds.position.set(camera.position.x, 91, camera.position.z);
    this.cloudTex.offset.set(
      camera.position.x / 256 + elapsed * 0.004,
      -camera.position.z / 256,
    );
    const cd = Math.max(0.07, st.day * st.day);
    this.clouds.material.color.setRGB(cd, cd, cd * 1.05);
    this.clouds.material.opacity = 0.32 + st.day * 0.23;
    return st;
  }
}
