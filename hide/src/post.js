// Post-processing. Desktop: HDR render target with MSAA -> bloom chain ->
// one composite pass (exposure, ACES, chromatic aberration, lens distortion,
// vignette, grain, fear/hidden grading). Mobile renders straight to the
// canvas and uses cheap CSS overlays instead (see ui.js).
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 texel; uniform float threshold; uniform float knee;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tDiffuse, vUv + texel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - threshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * contrib, vec3(30.0)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.25;
  c += texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0)).rgb * 0.1875;
  c += texture2D(tDiffuse, vUv + texel * vec2( 1.0, -1.0)).rgb * 0.1875;
  c += texture2D(tDiffuse, vUv + texel * vec2(-1.0,  1.0)).rgb * 0.1875;
  c += texture2D(tDiffuse, vUv + texel * vec2( 1.0,  1.0)).rgb * 0.1875;
  gl_FragColor = vec4(c, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D tBase; uniform vec2 texel; uniform float radius;
varying vec2 vUv;
void main() {
  vec2 o = texel * radius;
  vec3 c = texture2D(tDiffuse, vUv).rgb * 4.0;
  c += texture2D(tDiffuse, vUv + vec2(-o.x, 0.0)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2( o.x, 0.0)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(0.0, -o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(0.0,  o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2( o.x, -o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-o.x,  o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2( o.x,  o.y)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(tBase, vUv).rgb, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform vec2 res; uniform float time; uniform float exposure; uniform float bloomStrength;
uniform float fear; uniform float hidden; uniform float fade; uniform float hurt; uniform float pulse;
uniform float warmth; uniform float aberr; uniform float grain; uniform float dawn;
varying vec2 vUv;

vec3 aces(vec3 x) {
  x *= 0.6;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  // slight barrel distortion, stronger when panicking
  vec2 uv = 0.5 + c * (1.0 - 0.035 * r2 - fear * 0.04 * r2);
  float ca = (aberr + fear * 0.006 + hurt * 0.02) * (0.3 + r2 * 2.2);
  vec2 dir = normalize(c + 1e-5) * ca;
  vec3 col;
  col.r = texture2D(tScene, uv + dir).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - dir).b;
  vec3 bloom = texture2D(tBloom, uv).rgb;
  col += bloom * bloomStrength;
  col *= exposure;
  vec3 m = aces(col);
  // grade: cold teal shadows, warmth when cosy in the hiding spot
  float lum = dot(m, vec3(0.2126, 0.7152, 0.0722));
  vec3 cold = vec3(0.86, 0.98, 1.08);
  vec3 warm = vec3(1.12, 0.98, 0.82);
  m *= mix(cold, warm, warmth * 0.7);
  m = mix(m, vec3(lum), clamp(fear * 0.45 - warmth * 0.2, 0.0, 0.6));
  m += vec3(0.004, 0.006, 0.009) * (1.0 - lum);
  m = mix(m, m * vec3(1.06, 1.0, 0.92) + 0.04, dawn * 0.6);
  vec3 s = toSRGB(clamp(m, 0.0, 1.0));
  // vignette (heartbeat pulse when afraid, tighter when hidden)
  float vig = smoothstep(0.85, 0.18, length(c * vec2(1.0, 0.85)) * (1.0 + hidden * 0.35 + fear * 0.25 + pulse * fear * 0.18));
  s *= mix(0.25, 1.0, vig);
  s = mix(s, s * vec3(1.0, 0.35, 0.3), hurt * 0.45);
  // film grain, stronger in the dark
  float n = hash(vUv * res + fract(time * 7.13) * 100.0) - 0.5;
  s += n * grain * (1.0 - lum * 0.6) * (1.0 + fear);
  s *= 1.0 - fade;
  gl_FragColor = vec4(s, 1.0);
}`;

export class Post {
  constructor(renderer, cfg) {
    this.renderer = renderer;
    this.full = cfg.post === 'full';
    this.u = {
      time: 0, fear: 0, hidden: 0, fade: 1, hurt: 0, pulse: 0, warmth: 0, dawn: 0,
      exposure: 1, bloomStrength: 0.55, aberr: 0.0015, grain: 0.05,
    };
    if (!this.full) return;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.levels = 5;
    this.down = [];
    this.up = [];
    for (let i = 0; i < this.levels; i++) {
      this.down.push(new THREE.WebGLRenderTarget(4, 4, opts));
      this.up.push(new THREE.WebGLRenderTarget(4, 4, opts));
    }
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
    this.mBright = mk(BRIGHT, { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.1 }, knee: { value: 0.6 } });
    this.mDown = mk(DOWN, { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tDiffuse: { value: null }, tBase: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1.0 } });
    this.mComp = mk(COMPOSITE, {
      tScene: { value: this.rt.texture }, tBloom: { value: null }, res: { value: new THREE.Vector2() },
      time: { value: 0 }, exposure: { value: 1 }, bloomStrength: { value: 0.9 }, fear: { value: 0 }, hidden: { value: 0 },
      fade: { value: 1 }, hurt: { value: 0 }, pulse: { value: 0 }, warmth: { value: 0 }, aberr: { value: 0.0015 }, grain: { value: 0.055 }, dawn: { value: 0 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mBright);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h) {
    if (!this.full) return;
    this.rt.setSize(w, h);
    let cw = Math.max(1, w >> 1), ch = Math.max(1, h >> 1);
    for (let i = 0; i < this.levels; i++) {
      this.down[i].setSize(cw, ch);
      this.up[i].setSize(cw, ch);
      cw = Math.max(1, cw >> 1);
      ch = Math.max(1, ch >> 1);
    }
    this.mComp.uniforms.res.value.set(w, h);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.full) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    // bloom
    this.mBright.uniforms.tDiffuse.value = this.rt.texture;
    this.mBright.uniforms.texel.value.set(1 / this.rt.width, 1 / this.rt.height);
    this.pass(this.mBright, this.down[0]);
    for (let i = 1; i < this.levels; i++) {
      const src = this.down[i - 1];
      this.mDown.uniforms.tDiffuse.value = src.texture;
      this.mDown.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, this.down[i]);
    }
    let prev = this.down[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      this.mUp.uniforms.tDiffuse.value = prev.texture;
      this.mUp.uniforms.tBase.value = this.down[i].texture;
      this.mUp.uniforms.texel.value.set(1 / prev.width, 1 / prev.height);
      this.pass(this.mUp, this.up[i]);
      prev = this.up[i];
    }
    const U = this.mComp.uniforms;
    U.tBloom.value = this.up[0].texture;
    for (const k in this.u) if (U[k]) U[k].value = this.u[k];
    this.pass(this.mComp, null);
  }
}
