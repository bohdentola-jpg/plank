// The picture pipeline. Every frame:
//   3D scene → HDR multisampled target (internal res, e.g. 800×600)
//   → bloom mip chain (13-tap down / tent up)
//   → final CRT pass to the canvas: chromatic aberration, speed blur, bloom,
//     ACES tonemap, grade, 2D UI layer composited *under the glass* (so menus
//     get the same curvature, scanlines, and static), grain, snow, tearing,
//     vignette, power-on/off collapse.
import * as THREE from 'three';

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
// NaN or Inf, read off the exponent bits (x != x checks get optimised away by some compilers)
#if __VERSION__ >= 300
bool badf(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
#else
bool badf(float x) { return !(x == x) || abs(x) > 1e30; }
#endif
bool bad(vec3 c) { return badf(c.r) || badf(c.g) || badf(c.b); }
vec3 s(vec2 o) { vec3 c = texture2D(tSrc, vUv + o * texel).rgb; return bad(c) ? vec3(0.0) : max(c, vec3(0.0)); }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  // a single NaN/Inf texel would smear into a black hole through the chain
  if (bad(col) || any(greaterThan(col, vec3(1e6)))) col = vec3(0.0);
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
uniform float radialBlur;
uniform vec2 blurCenter;
uniform float flash;
uniform float fade;
uniform float interference;
uniform float maskStr;
uniform float uiAlpha;
uniform float power;
uniform float sceneOn;
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

#if __VERSION__ >= 300
bool badf(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
#else
bool badf(float x) { return !(x == x) || abs(x) > 1e30; }
#endif
vec3 clean(vec3 c) { return (badf(c.r) || badf(c.g) || badf(c.b)) ? vec3(0.0) : clamp(c, vec3(0.0), vec3(64.0)); }
vec3 hdrAt(vec2 uv) {
  return clean(texture2D(tScene, uv).rgb) + clean(texture2D(tBloom, uv).rgb) * bloomStrength;
}

void main() {
  vec2 uv = vUv;

  // --- CRT power on/off: picture squeezed to a line, then a dot
  float bright = 1.0;
  if (power < 0.999) {
    float hs = clamp(power / 0.3, 0.004, 1.0);
    float vs = clamp((power - 0.3) / 0.7, 0.003, 1.0);
    uv = (uv - 0.5) / vec2(hs, vs) + 0.5;
    bright = 1.0 + (1.0 - vs) * 4.0 + (1.0 - hs) * 6.0;
  }

  // --- glass curvature
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  uv = 0.5 + cc * (1.0 + curvature * r2);

  // --- signal tearing (transitions, crashes)
  if (interference > 0.001) {
    float row = floor(uv.y * 180.0);
    float tear = hash12(vec2(row, floor(time * 24.0))) - 0.5;
    tear *= step(0.55, hash12(vec2(floor(time * 13.0), row * 0.37)));
    uv.x += tear * interference * 0.06 + sin(uv.y * 40.0 + time * 23.0) * interference * 0.004;
  }

  vec2 dir = uv - 0.5;
  vec3 col = vec3(0.0);
  if (sceneOn > 0.5) {
    // chromatic aberration grows toward the edges
    float ca = aberration * (0.25 + dot(dir, dir) * 3.0);
    if (radialBlur > 0.002) {
      vec2 toC = (blurCenter - uv) * radialBlur * 0.11;
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        vec2 u = uv + toC * t;
        col.r += hdrAt(u - dir * ca).r;
        col.g += hdrAt(u).g;
        col.b += hdrAt(u + dir * ca).b;
      }
      col /= 8.0;
    } else {
      col.r = hdrAt(uv - dir * ca).r;
      col.g = hdrAt(uv).g;
      col.b = hdrAt(uv + dir * ca).b;
    }
    col = aces(col * exposure);
    col = toSRGB(col);
    // display-referred grade
    col = pow(max(col, 0.0), 1.0 / gammaV);
    col = col * gain + lift * (1.0 - col);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, saturation);
    col = (col - 0.5) * contrast + 0.5;
  }

  // --- 2D UI layer, under the glass
  vec4 ui = texture2D(tUI, uv);
  col = mix(col, ui.rgb, ui.a * uiAlpha);

  // --- TV snow
  float snowSeed = floor(time * 50.0);
  vec2 sp = floor(gl_FragCoord.xy / vec2(2.0, 2.0));
  float snow = hash12(vec2(floor(sp.x / 2.0) * 1.7 + sp.y * 31.0, sp.y) + snowSeed * 7.13);
  snow = pow(snow, 1.6);
  float band = 0.75 + 0.25 * sin(uv.y * 9.0 - time * 7.0);
  col = mix(col, vec3(snow * band * 0.95 + 0.04), clamp(staticAmt, 0.0, 1.0));

  // --- film grain / signal noise
  float g = hash12(gl_FragCoord.xy + fract(time * 7.31) * 517.0) - 0.5;
  col += g * grain;

  // --- scanlines + aperture grille
  float lines = resolution.y / 3.0;
  float sl = sin(uv.y * lines * 3.14159265);
  col *= 1.0 - scanline * sl * sl;
  col *= 1.0 + scanline * 0.45;
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.0, 0.82, 0.82) : (m < 2.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0));
  col *= mix(vec3(1.0), mask, maskStr);

  // --- slow hum bar
  col *= 1.0 - 0.025 * smoothstep(0.0, 0.15, fract(uv.y * 0.6 - time * 0.07)) * (1.0 - smoothstep(0.15, 0.3, fract(uv.y * 0.6 - time * 0.07)));

  // --- vignette
  float v = 1.0 - smoothstep(0.25, 0.95, length(dir * vec2(1.0, 1.12)));
  col *= mix(1.0, v, vignette);

  col = mix(col, vec3(1.0), flash);
  col *= (1.0 - fade) * bright;

  // --- outside the tube
  vec2 edge = smoothstep(vec2(0.0), vec2(0.004), uv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - uv);
  col *= edge.x * edge.y;
  if (power < 0.999) col *= smoothstep(0.0, 0.05, power);

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export const DEFAULT_POST = {
  bloomStrength: 0.9,
  bloomThreshold: 1.0,
  bloomKnee: 0.6,
  bloomRadius: 1.0,
  exposure: 1.0,
  lift: [0.0, 0.0, 0.0],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  saturation: 1.0,
  contrast: 1.0,
  vignette: 0.55,
  aberration: 0.0025,
  grain: 0.045,
  staticAmt: 0.0,
  scanline: 0.16,
  curvature: 0.075,
  radialBlur: 0.0,
  flash: 0.0,
  fade: 0.0,
  interference: 0.0,
  maskStr: 0.12,
};

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
    this.power = 0;      // CRT power 0 (off) → 1 (on)
    this.crt = 1;        // player's CRT-effect strength (options)
    this.sceneOn = true; // false = only UI over black (cheaper title cards)
    this.time = 0;
    this.internalLines = 600;
    this.useMsaa = true;
    this.displayScale = 1;

    // 2D UI layer — logical 1024×768, backing store matches the display
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

    this.downMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: DOWN_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 }, first: { value: 0 } },
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: UP_FRAG, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, transparent: true,
      uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 }, weight: { value: 1 } },
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tUI: { value: this.uiTex },
        resolution: { value: new THREE.Vector2() }, time: { value: 0 },
        bloomStrength: { value: 1 }, exposure: { value: 1 },
        lift: { value: new THREE.Vector3() }, gammaV: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
        saturation: { value: 1 }, contrast: { value: 1 }, vignette: { value: 0.5 }, aberration: { value: 0 },
        grain: { value: 0 }, staticAmt: { value: 0 }, scanline: { value: 0 }, curvature: { value: 0 },
        radialBlur: { value: 0 }, blurCenter: { value: new THREE.Vector2(0.5, 0.5) },
        flash: { value: 0 }, fade: { value: 0 }, interference: { value: 0 }, maskStr: { value: 0 },
        uiAlpha: { value: 1 }, power: { value: 0 }, sceneOn: { value: 1 },
      },
    });

    this.targets = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Internal 3D resolution (lines). 480 = PS2-crunchy, 600 default, 720 sharp. */
  setInternalLines(lines) {
    this.internalLines = lines;
    this.qualityRung = undefined;
    this.useMsaa = true;
    if (this.displayScale !== 1) { this.displayScale = 1; this.resize(); }
    this._buildTargets();
  }

  /** Auto-quality: lines, multisampling on/off, and the scale the final
   *  TV picture is drawn at (1 = the screen's own pixels). */
  setQuality({ lines, msaa = true, display = 1 }) {
    this.internalLines = lines;
    this.useMsaa = msaa;
    if (display !== this.displayScale) { this.displayScale = display; this.resize(); }
    this._buildTargets();
  }

  _buildTargets() {
    if (this.targets) {
      this.targets.scene.dispose();
      for (const t of this.targets.mips) t.dispose();
    }
    const h = this.internalLines;
    const w = Math.round(h * 4 / 3);
    const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    // 24-bit depth (three's default for multisampled targets is 16-bit, which
    // z-fights badly between the road and the ground beneath it)
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    const scene = new THREE.WebGLRenderTarget(w, h, {
      type, samples: this.useMsaa ? this.msaa : 0, depthBuffer: true, stencilBuffer: false, depthTexture,
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
    this.targets = { scene, mips, w, h };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.displayScale || 1);
    const cw = Math.max(320, Math.round(rect.width * dpr));
    const ch = Math.max(240, Math.round(rect.height * dpr));
    this.gl.setPixelRatio(1);
    this.gl.setSize(cw, ch, false);
    this.displayW = cw;
    this.displayH = ch;
    // UI backing store: crisp at the display size, capped
    const scale = Math.min(1.6, Math.max(0.75, ch / 768));
    this.uiScale = scale;
    this.uiCanvas.width = Math.round(1024 * scale);
    this.uiCanvas.height = Math.round(768 * scale);
    this.uiTex.dispose();
    this.uiTex.needsUpdate = true;
    if (!this.targets) this._buildTargets();
    this.finalMat.uniforms.resolution.value.set(cw, ch);
  }

  /** Begin a UI frame: clears the canvas and returns a ctx in 1024×768 units. */
  beginUI() {
    const ctx = this.uiCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    ctx.setTransform(this.uiScale, 0, 0, this.uiScale, 0, 0);
    return ctx;
  }

  /** Smoothly steer post params toward a target set (merged over defaults). */
  setPost(params, instant = false) {
    this.postTarget = { ...DEFAULT_POST, ...params };
    if (instant) this.post = { ...this.postTarget };
  }

  _stepPost(dt) {
    const k = 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(this.postTarget)) {
      const tv = this.postTarget[key];
      if (Array.isArray(tv)) {
        const cur = this.post[key] || [0, 0, 0];
        this.post[key] = cur.map((c, i) => c + (tv[i] - c) * k);
      } else if (key === 'staticAmt' || key === 'flash' || key === 'fade' || key === 'interference' || key === 'radialBlur') {
        // these are driven directly by effects every frame
        this.post[key] = tv;
      } else {
        this.post[key] += (tv - this.post[key]) * k;
      }
    }
  }

  /**
   * Render a frame. scene/camera may be null (UI only).
   * fx: per-frame overrides {staticAmt, flash, fade, interference, radialBlur, blurCenter}
   */
  render(scene, camera, dt, fx = {}) {
    this.time += dt;
    this._stepPost(dt);
    const gl = this.gl;
    const p = this.post;
    const t = this.targets;
    const hasScene = !!(scene && camera) && this.sceneOn;

    if (hasScene) {
      gl.setRenderTarget(t.scene);
      gl.clear(true, true, false);
      gl.render(scene, camera);

      // bloom: down chain
      let src = t.scene;
      for (let i = 0; i < t.mips.length; i++) {
        const dst = t.mips[i];
        this.downMat.uniforms.tSrc.value = src.texture;
        this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
        this.downMat.uniforms.threshold.value = p.bloomThreshold;
        this.downMat.uniforms.knee.value = p.bloomKnee;
        this.downMat.uniforms.first.value = i === 0 ? 1 : 0;
        this.fsMesh.material = this.downMat;
        gl.setRenderTarget(dst);
        gl.render(this.fsScene, this.fsCam);
        src = dst;
      }
      // up chain (additive into the next larger mip)
      for (let i = t.mips.length - 1; i > 0; i--) {
        const s = t.mips[i];
        const d = t.mips[i - 1];
        this.upMat.uniforms.tSrc.value = s.texture;
        this.upMat.uniforms.texel.value.set(1 / s.width, 1 / s.height);
        this.upMat.uniforms.radius.value = p.bloomRadius;
        this.upMat.uniforms.weight.value = 1.0;
        this.fsMesh.material = this.upMat;
        gl.setRenderTarget(d);
        gl.render(this.fsScene, this.fsCam);
      }
    }

    const u = this.finalMat.uniforms;
    u.tScene.value = t.scene.texture;
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
    const crt = this.crt;
    u.aberration.value = p.aberration * crt;
    u.grain.value = p.grain * (0.35 + 0.65 * crt);
    u.scanline.value = p.scanline * crt;
    u.curvature.value = p.curvature * (0.3 + 0.7 * crt);
    u.maskStr.value = p.maskStr * crt;
    u.staticAmt.value = Math.max(p.staticAmt, fx.staticAmt || 0);
    u.flash.value = Math.max(p.flash, fx.flash || 0);
    u.fade.value = Math.max(p.fade, fx.fade || 0);
    u.interference.value = Math.max(p.interference, fx.interference || 0);
    u.radialBlur.value = Math.max(p.radialBlur, fx.radialBlur || 0);
    if (fx.blurCenter) u.blurCenter.value.set(fx.blurCenter[0], fx.blurCenter[1]);
    u.power.value = this.power;
    u.sceneOn.value = hasScene ? 1 : 0;

    this.uiTex.needsUpdate = true;
    this.fsMesh.material = this.finalMat;
    gl.setRenderTarget(null);
    gl.clear(true, true, false);
    gl.render(this.fsScene, this.fsCam);
  }

  /**
   * Map a client (mouse) position to UI coordinates (1024×768), undoing the
   * glass curvature so clicks land where things are drawn.
   */
  clientToUI(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    let x = (clientX - r.left) / r.width;
    let y = 1 - (clientY - r.top) / r.height;
    // invert uv' = 0.5 + c(1 + k|c|²) by fixed-point iteration (screen → source)
    const k = this.post.curvature * (0.3 + 0.7 * this.crt);
    const tx = x - 0.5, ty = y - 0.5;
    // we want the source uv that the shader samples for this fragment: it's forward, not inverse
    const r2 = tx * tx + ty * ty;
    const sx = 0.5 + tx * (1 + k * r2);
    const sy = 0.5 + ty * (1 + k * r2);
    return { x: sx * 1024, y: (1 - sy) * 768 };
  }
}
