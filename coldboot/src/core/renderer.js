// The picture pipeline. Every frame:
//   3D scene → HDR multisampled target (internal res, e.g. 1280×720)
//   → optional depth-of-field (dialogue shots)
//   → bloom mip chain (13-tap down / tent up)
//   → final pass: filmic tonemap, a cold grade with a gentle split-tone,
//     fine film grain and a soft vignette on the picture, cinema bars in
//     cutscenes, then the 2D UI composited crisp on top, then fades/flashes.
import * as THREE from 'three';

export const UI_W = 1280;
export const UI_H = 720;

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWN_FRAG = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
uniform float first;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * texel).rgb; }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (!(col.r == col.r && col.g == col.g && col.b == col.b) || any(greaterThan(col, vec3(1e6)))) col = vec3(0.0);
  if (first > 0.5) {
    col = min(col, vec3(24.0));
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    col *= max(soft, br - threshold) / max(br, 1e-4);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float radius;
uniform float weight;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * texel * radius).rgb; }
void main() {
  vec3 col = s(vec2(-1.0, 1.0)) + s(vec2(0.0, 1.0)) * 2.0 + s(vec2(1.0, 1.0))
           + s(vec2(-1.0, 0.0)) * 2.0 + s(vec2(0.0)) * 4.0 + s(vec2(1.0, 0.0)) * 2.0
           + s(vec2(-1.0, -1.0)) + s(vec2(0.0, -1.0)) * 2.0 + s(vec2(1.0, -1.0));
  gl_FragColor = vec4(col / 16.0 * weight, 1.0);
}
`;

// Depth of field: a golden-angle disc gather whose radius follows the circle
// of confusion from the depth buffer. Cheap and only on for close-ups.
const DOF_FRAG = /* glsl */`
#include <packing>
uniform sampler2D tSrc;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float focus;     // metres
uniform float aperture;  // blur px per unit CoC
uniform float maxBlur;   // px
uniform float cNear;
uniform float cFar;
varying vec2 vUv;
float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return perspectiveDepthToViewZ(d, cNear, cFar) * -1.0;
}
float coc(float z) { return clamp(abs(z - focus) / max(z, 0.01) * aperture, 0.0, maxBlur); }
void main() {
  float z = linDepth(vUv);
  float c0 = coc(z);
  vec3 sum = texture2D(tSrc, vUv).rgb;
  float wsum = 1.0;
  if (c0 > 0.6) {
    const float GA = 2.39996323;
    for (int i = 1; i < 28; i++) {
      float fi = float(i);
      float r = sqrt(fi / 28.0) * c0;
      vec2 o = vec2(cos(fi * GA), sin(fi * GA)) * r * texel;
      float zs = linDepth(vUv + o);
      // a sharp foreground sample doesn't bleed into the background blur
      float cs = coc(zs);
      float w = zs < z ? smoothstep(0.0, 1.0, cs / max(r, 0.001)) : 1.0;
      sum += texture2D(tSrc, vUv + o).rgb * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}
`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tUI;
uniform vec2 resolution;
uniform float time;
uniform float bloomStrength;
uniform float exposure;
uniform vec3 lift;
uniform vec3 gammaV;
uniform vec3 gain;
uniform float saturation;
uniform float contrast;
uniform float vignette;
uniform float aberration;
uniform float grain;
uniform float staticAmt;
uniform float scanline;
uniform float curvature;
uniform float flash;
uniform vec3 flashColor;
uniform float fade;
uniform float interference;
uniform float maskStr;
uniform float uiAlpha;
uniform float power;
uniform float sceneOn;
uniform float letterbox;
uniform vec3 tint;
uniform float tintAmt;
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// ACES (Narkowicz fit), slightly shoulder-softened
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 hdrAt(vec2 uv) {
  vec3 c = texture2D(tScene, uv).rgb + texture2D(tBloom, uv).rgb * bloomStrength;
  return (c.r == c.r && c.g == c.g && c.b == c.b) ? min(c, vec3(64.0)) : vec3(0.0);
}

void main() {
  vec2 uv = vUv;
  vec3 col = vec3(0.0);
  if (sceneOn > 0.5) {
    col = hdrAt(uv);
    col = aces(col * exposure);
    col = toSRGB(col);
    col = pow(max(col, 0.0), 1.0 / gammaV);
    col = col * gain + lift * (1.0 - col);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, saturation);
    col = (col - 0.5) * contrast + 0.5;
    col = mix(col, col * tint, tintAmt);
    // the North in November: shadows lean steel-blue, highlights a touch warm
    l = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
    col += (1.0 - l) * vec3(-0.010, 0.002, 0.016) + l * vec3(0.012, 0.004, -0.010);
    // fine film grain, strongest in the mid-tones
    float gn = hash12(gl_FragCoord.xy + fract(time * 13.7) * 811.0) - 0.5;
    col += gn * grain * (0.35 + 0.65 * (1.0 - abs(l - 0.45) * 1.6));
    // soft vignette
    vec2 d = (uv - 0.5) * vec2(1.0, 0.8);
    col *= mix(1.0, 1.0 - smoothstep(0.25, 0.85, length(d) * 1.25), vignette);
    // cinema bars (2.39:1 inside 16:9)
    if (letterbox > 0.001) {
      float bar = letterbox * 0.128;
      float inBar = step(uv.y, bar) + step(1.0 - bar, uv.y);
      col *= 1.0 - clamp(inBar, 0.0, 1.0);
    }
  }
  vec4 ui = texture2D(tUI, uv);
  col = mix(col, ui.rgb, ui.a * uiAlpha);
  col = mix(col, flashColor, flash);
  col *= (1.0 - fade);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export const DEFAULT_POST = {
  bloomStrength: 0.45,
  bloomThreshold: 1.0,
  bloomKnee: 0.6,
  bloomRadius: 1.0,
  exposure: 1.0,
  lift: [0.0, 0.0, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  saturation: 1.0,
  contrast: 1.0,
  vignette: 0.35,
  aberration: 0.0,
  grain: 0.025,
  staticAmt: 0.0,
  scanline: 0.0,
  curvature: 0.0,
  flash: 0.0,
  fade: 0.0,
  interference: 0.0,
  maskStr: 0.0,
  letterbox: 0.0,
  tint: [1, 1, 1],
  tintAmt: 0,
};

// params driven per-frame by effects rather than eased
const DIRECT = new Set(['staticAmt', 'flash', 'fade', 'interference']);

function fsTriangle() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
    });
    this.gl.autoClear = false;
    this.gl.setClearColor(0x000000, 1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.NoToneMapping;

    const caps = this.gl.capabilities;
    this.hdr = caps.isWebGL2 && !!this.gl.extensions.get('EXT_color_buffer_float');
    this.msaa = caps.isWebGL2 ? Math.min(4, caps.maxSamples || 4) : 0;

    this.post = { ...DEFAULT_POST };
    this.postTarget = { ...DEFAULT_POST };
    this.power = 1;
    this.crt = 0;
    this.sceneOn = true;
    this.time = 0;
    this.internalLines = 720;
    this.useMsaa = true;
    this.displayScale = 1;
    // depth of field: null = off, or { focus, aperture, maxBlur }
    this.dof = null;
    this.flashColor = new THREE.Color(1, 1, 1);

    this.uiCanvas = document.createElement('canvas');
    this.uiCtx = this.uiCanvas.getContext('2d');
    this.uiTex = new THREE.CanvasTexture(this.uiCanvas);
    this.uiTex.colorSpace = THREE.NoColorSpace;
    this.uiTex.minFilter = THREE.LinearFilter;
    this.uiTex.magFilter = THREE.LinearFilter;
    this.uiTex.generateMipmaps = false;

    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.fsMesh = new THREE.Mesh(fsTriangle(), null);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);

    const mat = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, uniforms, ...extra,
    });
    this.downMat = mat(DOWN_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 }, first: { value: 0 } });
    this.upMat = mat(UP_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 }, weight: { value: 1 } },
      { blending: THREE.AdditiveBlending, transparent: true });
    this.dofMat = mat(DOF_FRAG, {
      tSrc: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
      focus: { value: 2 }, aperture: { value: 8 }, maxBlur: { value: 10 }, cNear: { value: 0.1 }, cFar: { value: 1000 },
    });
    this.finalMat = mat(FINAL_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, tUI: { value: this.uiTex },
      resolution: { value: new THREE.Vector2() }, time: { value: 0 },
      bloomStrength: { value: 1 }, exposure: { value: 1 },
      lift: { value: new THREE.Vector3() }, gammaV: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
      saturation: { value: 1 }, contrast: { value: 1 }, vignette: { value: 0.5 }, aberration: { value: 0 },
      grain: { value: 0 }, staticAmt: { value: 0 }, scanline: { value: 0 }, curvature: { value: 0 },
      flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) }, fade: { value: 0 }, interference: { value: 0 }, maskStr: { value: 0 },
      uiAlpha: { value: 1 }, power: { value: 0 }, sceneOn: { value: 1 }, letterbox: { value: 0 },
      tint: { value: new THREE.Vector3(1, 1, 1) }, tintAmt: { value: 0 },
    });

    this.targets = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setInternalLines(lines) {
    this.internalLines = lines;
    this.qualityRung = undefined;
    this.useMsaa = true;
    if (this.displayScale !== 1) { this.displayScale = 1; this.resize(); }
    this._buildTargets();
  }

  setQuality({ lines, msaa = true, display = 1 }) {
    this.internalLines = lines;
    this.useMsaa = msaa;
    if (display !== this.displayScale) { this.displayScale = display; this.resize(); }
    this._buildTargets();
  }

  _buildTargets() {
    if (this.targets) {
      this.targets.scene.dispose();
      this.targets.dof.dispose();
      for (const t of this.targets.mips) t.dispose();
    }
    const h = this.internalLines;
    const w = Math.round(h * 16 / 9);
    const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    const scene = new THREE.WebGLRenderTarget(w, h, {
      type, samples: this.useMsaa ? this.msaa : 0, depthBuffer: true, stencilBuffer: false, depthTexture,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    const dof = new THREE.WebGLRenderTarget(w, h, {
      type, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    const mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < 6; i++) {
      mw = Math.max(2, Math.floor(mw / 2));
      mh = Math.max(2, Math.floor(mh / 2));
      mips.push(new THREE.WebGLRenderTarget(mw, mh, {
        type, depthBuffer: false, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      }));
    }
    this.targets = { scene, dof, mips, w, h };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.displayScale || 1);
    const cw = Math.max(320, Math.round(rect.width * dpr));
    const ch = Math.max(180, Math.round(rect.height * dpr));
    this.gl.setPixelRatio(1);
    this.gl.setSize(cw, ch, false);
    this.displayW = cw;
    this.displayH = ch;
    const scale = Math.min(2, Math.max(0.6, ch / UI_H));
    this.uiScale = scale;
    this.uiCanvas.width = Math.round(UI_W * scale);
    this.uiCanvas.height = Math.round(UI_H * scale);
    this.uiTex.dispose();
    this.uiTex.needsUpdate = true;
    if (!this.targets) this._buildTargets();
    this.finalMat.uniforms.resolution.value.set(cw, ch);
  }

  beginUI() {
    const ctx = this.uiCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    ctx.setTransform(this.uiScale, 0, 0, this.uiScale, 0, 0);
    return ctx;
  }

  setPost(params, instant = false) {
    this.postTarget = { ...DEFAULT_POST, ...params };
    if (instant) this.post = { ...this.postTarget };
  }

  /** Merge into the current target without resetting the rest. */
  tweakPost(params, instant = false) {
    Object.assign(this.postTarget, params);
    if (instant) Object.assign(this.post, params);
  }

  _stepPost(dt) {
    const k = 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(this.postTarget)) {
      const tv = this.postTarget[key];
      if (Array.isArray(tv)) {
        const cur = this.post[key] || [0, 0, 0];
        this.post[key] = cur.map((c, i) => c + (tv[i] - c) * k);
      } else if (DIRECT.has(key)) {
        this.post[key] = tv;
      } else {
        this.post[key] += (tv - this.post[key]) * k;
      }
    }
  }

  _fs(material, target) {
    this.fsMesh.material = material;
    this.gl.setRenderTarget(target);
    this.gl.render(this.fsScene, this.fsCam);
  }

  /** fx: per-frame overrides {staticAmt, flash, fade, interference} */
  render(scene, camera, dt, fx = {}) {
    this.time += dt;
    this._stepPost(dt);
    const gl = this.gl;
    const p = this.post;
    const t = this.targets;
    const hasScene = !!(scene && camera) && this.sceneOn;
    let sceneTex = t.scene.texture;

    if (hasScene) {
      gl.setRenderTarget(t.scene);
      gl.clear(true, true, false);
      gl.render(scene, camera);

      if (this.dof && camera.isPerspectiveCamera) {
        const u = this.dofMat.uniforms;
        u.tSrc.value = t.scene.texture;
        u.tDepth.value = t.scene.depthTexture;
        u.texel.value.set(1 / t.w, 1 / t.h);
        u.focus.value = this.dof.focus;
        u.aperture.value = (this.dof.aperture ?? 6) * (t.h / 720);
        u.maxBlur.value = (this.dof.maxBlur ?? 9) * (t.h / 720);
        u.cNear.value = camera.near;
        u.cFar.value = camera.far;
        this._fs(this.dofMat, t.dof);
        sceneTex = t.dof.texture;
      }

      let src = { texture: sceneTex, width: t.w, height: t.h };
      for (let i = 0; i < t.mips.length; i++) {
        const dst = t.mips[i];
        const u = this.downMat.uniforms;
        u.tSrc.value = src.texture;
        u.texel.value.set(1 / src.width, 1 / src.height);
        u.threshold.value = p.bloomThreshold;
        u.knee.value = p.bloomKnee;
        u.first.value = i === 0 ? 1 : 0;
        this._fs(this.downMat, dst);
        src = dst;
      }
      for (let i = t.mips.length - 1; i > 0; i--) {
        const s = t.mips[i];
        const u = this.upMat.uniforms;
        u.tSrc.value = s.texture;
        u.texel.value.set(1 / s.width, 1 / s.height);
        u.radius.value = p.bloomRadius;
        u.weight.value = 1.0;
        this._fs(this.upMat, t.mips[i - 1]);
      }
    }

    const u = this.finalMat.uniforms;
    u.tScene.value = sceneTex;
    u.tBloom.value = t.mips[0].texture;
    u.time.value = this.time;
    u.bloomStrength.value = p.bloomStrength;
    u.exposure.value = p.exposure;
    u.lift.value.fromArray(p.lift);
    u.gammaV.value.fromArray(p.gamma);
    u.gain.value.fromArray(p.gain);
    u.saturation.value = p.saturation;
    u.contrast.value = p.contrast;
    u.vignette.value = p.vignette;
    u.aberration.value = 0;
    u.grain.value = p.grain;
    u.scanline.value = 0;
    u.curvature.value = 0;
    u.maskStr.value = 0;
    u.staticAmt.value = Math.max(p.staticAmt, fx.staticAmt || 0);
    u.flash.value = Math.max(p.flash, fx.flash || 0);
    u.flashColor.value.copy(fx.flashColor || this.flashColor);
    u.fade.value = Math.max(p.fade, fx.fade || 0);
    u.interference.value = Math.max(p.interference, fx.interference || 0);
    u.letterbox.value = p.letterbox;
    u.tint.value.fromArray(p.tint);
    u.tintAmt.value = p.tintAmt;
    u.power.value = this.power;
    u.sceneOn.value = hasScene ? 1 : 0;

    this.uiTex.needsUpdate = true;
    gl.setRenderTarget(null);
    gl.clear(true, true, false);
    this._fs(this.finalMat, null);
  }

  /** Client (mouse) position → UI coordinates (1280×720) through the glass curvature. */
  clientToUI(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * UI_W, y: ((clientY - r.top) / r.height) * UI_H };
  }

}
