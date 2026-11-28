// Sky dome, image-based lighting, sun + shadows, stylised water.
import * as THREE from 'three';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uZenith, uHorizon, uGround, uSunColor, uSunDir, uCloudColor, uCloudShade;
uniform float uTime, uClouds, uSunSize;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.55));
  col = mix(col, uGround, smoothstep(0.0, -0.12, y));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.25 + pow(sd, 64.0) * 0.6);
  col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, sd) * 14.0;
  // horizon haze band
  col = mix(col, uHorizon * 1.08, exp(-abs(y) * 18.0) * 0.5);
  if (uClouds > 0.0 && y > 0.0) {
    vec2 cp = d.xz / (y + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
    float c = fbm(cp);
    float c2 = fbm(cp * 2.1 + 3.3);
    float m = smoothstep(0.52 - uClouds * 0.18, 0.78, c * 0.75 + c2 * 0.35);
    vec3 cc = mix(uCloudShade, uCloudColor, smoothstep(0.4, 0.9, c2));
    cc += uSunColor * pow(sd, 8.0) * 0.6 * m;
    col = mix(col, cc, m * smoothstep(0.0, 0.18, y) * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export const SKIES = {
  day: {
    zenith: 0x1f6ff2, horizon: 0xb4e2ff, ground: 0x6d8fa8, sun: 0xfff1d6, sunDir: [0.45, 0.62, 0.35],
    cloud: 0xffffff, cloudShade: 0xb9c9e6, clouds: 0.85, sunI: 4.2, hemiSky: 0xcfe8ff, hemiGround: 0x8a7f74, hemiI: 0.35,
    fog: 0xbfe0f6, fogD: 0.003, envI: 0.9, exposure: 1.0,
  },
  golden: {
    zenith: 0x3b63c9, horizon: 0xffc69a, ground: 0x7a6a78, sun: 0xffd2a0, sunDir: [-0.55, 0.32, -0.45],
    cloud: 0xfff0e2, cloudShade: 0xd48fa0, clouds: 0.75, sunI: 4.0, hemiSky: 0xffd9c2, hemiGround: 0x6d5a64, hemiI: 0.32,
    fog: 0xf2c6a8, fogD: 0.0032, envI: 0.85, exposure: 1.02,
  },
};

export class Environment {
  constructor(scene, renderer, preset = 'day') {
    this.scene = scene;
    this.renderer = renderer;
    // preset: a name from SKIES, or a full preset object (same keys) for custom skies
    const P = this.preset = typeof preset === 'string' ? (SKIES[preset] || SKIES.day) : { ...SKIES.day, ...preset };
    const sunDir = new THREE.Vector3(...P.sunDir).normalize();
    this.sunDir = sunDir;

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color(P.zenith) }, uHorizon: { value: new THREE.Color(P.horizon) },
        uGround: { value: new THREE.Color(P.ground) }, uSunColor: { value: new THREE.Color(P.sun) },
        uSunDir: { value: sunDir }, uCloudColor: { value: new THREE.Color(P.cloud) },
        uCloudShade: { value: new THREE.Color(P.cloudShade) }, uTime: { value: 0 }, uClouds: { value: P.clouds },
        uSunSize: { value: 0.0009 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // Image based lighting from the sky (no clouds, softer)
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSkyMat = this.skyMat.clone();
    envSkyMat.uniforms.uClouds.value = 0.0;
    envSkyMat.uniforms.uSunSize.value = 0.02;
    envSkyMat.uniforms.uSunColor.value = new THREE.Color(P.sun).multiplyScalar(0.35);
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envSkyMat);
    envScene.add(envSky);
    // fake bounce from a warm ground disc
    const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.hemiGround).multiplyScalar(0.9), side: THREE.DoubleSide }));
    groundDisc.rotation.x = -Math.PI / 2; groundDisc.position.y = -8;
    envScene.add(groundDisc);
    this.envRT = pm.fromScene(envScene, 0.03);
    scene.environment = this.envRT.texture;
    pm.dispose();
    envSkyMat.dispose();
    envSky.geometry.dispose();
    groundDisc.geometry.dispose();
    groundDisc.material.dispose();

    this.hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiI);
    scene.add(this.hemi);

    const sun = this.sun = new THREE.DirectionalLight(P.sun, P.sunI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    this.shadowExtent = 34;
    sc.left = -this.shadowExtent; sc.right = this.shadowExtent; sc.top = this.shadowExtent; sc.bottom = -this.shadowExtent;
    sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    scene.add(sun);
    scene.add(sun.target);

    scene.fog = new THREE.FogExp2(P.fog, P.fogD);
    this.time = 0;
    this.water = null;
  }

  setShadowExtent(e, mapSize) {
    this.shadowExtent = e;
    const sc = this.sun.shadow.camera;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e;
    sc.updateProjectionMatrix();
    if (mapSize && this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  // Keep the shadow frustum centred on the action, snapped to texels
  follow(focus) {
    const texel = (this.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx, 0, fz).addScaledVector(this.sunDir, 80);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(focus).setY(0);
  }

  addWater(y = -1.6, color = 0x1aa6b8) {
    const geo = new THREE.PlaneGeometry(1600, 1600, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.0, envMapIntensity: 1.0 });
    const uniforms = { uTime: { value: 0 }, uDeep: { value: new THREE.Color(color).multiplyScalar(0.35) }, uShallow: { value: new THREE.Color(color) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; varying vec3 vWPos;
float wh(vec2 p){ return sin(p.x*0.9+uTime*1.3)*0.5 + sin(p.y*1.3-uTime*1.1)*0.5 + sin((p.x+p.y)*2.7+uTime*2.1)*0.25 + sin((p.x-p.y)*4.1-uTime*2.6)*0.15; }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 p = vWPos.xz;
  float e = 0.05;
  float h0 = wh(p), hx = wh(p + vec2(e, 0.0)), hz = wh(p + vec2(0.0, e));
  float fade = clamp(1.0 - length(vViewPosition) / 150.0, 0.1, 1.0);
  fade *= fade;
  vec3 wn = normalize(vec3(-(hx - h0) / e * 0.06 * fade, 1.0, -(hz - h0) / e * 0.06 * fade));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float dist = length(vWPos.xz);
  float f = smoothstep(30.0, 140.0, dist);
  diffuseColor.rgb = mix(uShallow, uDeep, f * 0.5 + 0.35);
}`);
    };
    const water = new THREE.Mesh(geo, mat);
    water.position.y = y;
    water.receiveShadow = true;
    this.scene.add(water);
    this.water = water;
    this.waterUniforms = uniforms;
    return water;
  }

  update(dt) {
    this.time += dt;
    this.skyMat.uniforms.uTime.value = this.time;
    if (this.waterUniforms) this.waterUniforms.uTime.value = this.time;
  }

  dispose() {
    this.envRT?.dispose();
    this.skyMat.dispose();
    this.sky.geometry.dispose();
    this.sun.shadow.map?.dispose();
  }
}
