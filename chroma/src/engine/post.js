// HDR render pipeline: scene -> MSAA half-float target -> bloom mip chain ->
// filmic tonemap + grade + vignette -> screen.
import * as THREE from 'three';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uFirst;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  // 13-tap downsample (Jimenez 2014)
  vec3 a = s(vec2(-2., 2.)), b = s(vec2(0., 2.)), c = s(vec2(2., 2.));
  vec3 d = s(vec2(-2., 0.)), e = s(vec2(0., 0.)), f = s(vec2(2., 0.));
  vec3 g = s(vec2(-2., -2.)), h = s(vec2(0., -2.)), i = s(vec2(2., -2.));
  vec3 j = s(vec2(-1., 1.)), k = s(vec2(1., 1.)), l = s(vec2(-1., -1.)), m = s(vec2(1., -1.));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uFirst > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float knee = uThreshold * 0.6;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= w;
    col = min(col, vec3(40.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const UP_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel * uRadius).rgb; }
void main() {
  vec3 col = s(vec2(0.)) * 4.0
    + (s(vec2(-1., 0.)) + s(vec2(1., 0.)) + s(vec2(0., -1.)) + s(vec2(0., 1.))) * 2.0
    + s(vec2(-1., -1.)) + s(vec2(1., -1.)) + s(vec2(-1., 1.)) + s(vec2(1., 1.));
  gl_FragColor = vec4(col / 16.0, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom, uExposure, uSat, uVignette, uTime, uFlash, uContrast;
uniform vec3 uFlashColor; uniform vec3 uTint; uniform float uDesat;
varying vec2 vUv;
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  c += b * uBloom;
  c *= uExposure * uTint;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat * (1.0 - uDesat));
  c = mix(vec3(0.5), c, uContrast);
  vec2 q = vUv - 0.5;
  float v = 1.0 - dot(q, q) * uVignette * 2.2;
  c *= clamp(v, 0.0, 1.0);
  c = mix(c, uFlashColor, uFlash);
  vec3 o = toSRGB(c);
  o += (hash(vUv * 1000.0 + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.scale = 1;
    this.bloomStrength = 0.55;
    this.levels = 6;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.quad);

    const msaa = renderer.capabilities.isWebGL2 ? 4 : 0;
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, samples: msaa, depthBuffer: true,
    });
    this.bloomRTs = [];
    for (let i = 0; i < this.levels; i++) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      this.bloomRTs.push(rt);
    }
    this.downMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: DOWN_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uFirst: { value: 0 } },
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: UP_FRAG, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, transparent: true,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } },
    });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: this.sceneRT.texture }, tBloom: { value: this.bloomRTs[0].texture },
        uBloom: { value: 0.55 }, uExposure: { value: 1.0 }, uSat: { value: 1.12 }, uVignette: { value: 0.55 },
        uTime: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uContrast: { value: 1.04 }, uTint: { value: new THREE.Color(1, 1, 1) }, uDesat: { value: 0 },
      },
    });
    this.threshold = 1.0;
    this.flash = 0;
    this.time = 0;
  }

  setSize(w, h, pixelRatio) {
    this.w = w; this.h = h; this.pr = pixelRatio;
    const W = Math.max(4, Math.floor(w * pixelRatio * this.scale));
    const H = Math.max(4, Math.floor(h * pixelRatio * this.scale));
    this.sceneRT.setSize(W, H);
    let bw = W, bh = H;
    for (let i = 0; i < this.levels; i++) {
      bw = Math.max(2, Math.floor(bw / 2)); bh = Math.max(2, Math.floor(bh / 2));
      this.bloomRTs[i].setSize(bw, bh);
    }
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
  }

  setScale(s) {
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.setSize(this.w, this.h, this.pr);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.cam);
  }

  render(scene, camera, dt = 0.016) {
    const r = this.renderer;
    this.time += dt;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    // bloom down chain
    let src = this.sceneRT.texture, sw = this.sceneRT.width, sh = this.sceneRT.height;
    for (let i = 0; i < this.levels; i++) {
      const dst = this.bloomRTs[i];
      this.downMat.uniforms.tSrc.value = src;
      this.downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this.downMat.uniforms.uThreshold.value = this.threshold;
      this.pass(this.downMat, dst);
      src = dst.texture; sw = dst.width; sh = dst.height;
    }
    // up chain, additive into the larger level
    for (let i = this.levels - 1; i > 0; i--) {
      const s = this.bloomRTs[i], d = this.bloomRTs[i - 1];
      this.upMat.uniforms.tSrc.value = s.texture;
      this.upMat.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      this.pass(this.upMat, d);
    }
    const u = this.compMat.uniforms;
    u.uBloom.value = this.bloomStrength;
    u.uTime.value = this.time % 100;
    u.uFlash.value = this.flash;
    this.pass(this.compMat, null);
  }

  // Render a simple overlay view (minimap / judge cam) into a viewport rect of the screen.
  renderViewport(scene, camera, x, y, w, h) {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setScissorTest(true);
    r.setScissor(x, y, w, h);
    r.setViewport(x, y, w, h);
    r.render(scene, camera);
    r.setScissorTest(false);
    r.setViewport(0, 0, this.w, this.h);
  }

  get uniforms() { return this.compMat.uniforms; }
}
