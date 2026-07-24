// THE CAMCORDER. Everything you see is through it, which is the point: the tape
// is the reason you can see in the dark at all, and the reason you can't see
// properly. One render target, one fullscreen shader, one DOM overlay.
//
// The pass does: barrel warp, chromatic split, tape tracking bands, dropout
// lines, head-switching noise at the bottom of the frame, scanlines, grain that
// climbs as the light falls, bloom on the bright bits, vignette, a per-level
// colour cast, and a night-vision mode that trades colour for gain. The overlay
// does the furniture — REC, timecode, battery, focus box, zoom.

import * as THREE from 'three';
import { lensDirtTexture } from './textures.js';
import { fmtTimecode, clamp01, damp } from './util.js';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tDirt;
uniform vec2  uRes;
uniform float uTime;
uniform float uGlitch;     // tape damage 0..1
uniform float uGrain;      // added noise 0..1
uniform float uGain;       // low-light gain (rises as the room gets darker)
uniform float uNight;      // night vision mix
uniform float uVign;
uniform float uDamage;     // red pulse when hurt
uniform float uSanity;     // 1 = fine, 0 = the walls breathe
uniform float uUnder;      // underwater
uniform vec3  uTint;
uniform float uBloom;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 uv = vUv;

  // ---- lens: a little barrel, a little bit of tape stretch at the edges
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  uv = 0.5 + c * (1.0 + 0.055 * r2 + 0.02 * r2 * r2);

  // ---- sanity: the geometry starts to breathe
  float sway = (1.0 - uSanity);
  uv.x += sin(uv.y * 18.0 + uTime * 1.7) * 0.0035 * sway;
  uv.y += cos(uv.x * 14.0 - uTime * 1.1) * 0.0025 * sway;

  // ---- underwater ripple
  uv += vec2(sin(uv.y * 30.0 + uTime * 3.0), cos(uv.x * 26.0 + uTime * 2.4)) * 0.004 * uUnder;

  // ---- tracking: horizontal bands that jump sideways
  float band = step(0.55, noise(vec2(uTime * 2.5, floor(uv.y * 90.0))));
  float jump = (noise(vec2(floor(uv.y * 90.0), floor(uTime * 9.0))) - 0.5);
  uv.x += band * jump * 0.09 * uGlitch;
  // head-switching noise: the bottom two percent of a real tape is always torn
  float hs = smoothstep(0.03, 0.0, uv.y);
  uv.x += hs * (noise(vec2(uTime * 30.0, uv.y * 200.0)) - 0.5) * 0.05;

  // ---- chromatic split, wider under damage
  float ca = 0.0014 + uGlitch * 0.006 + uDamage * 0.004;
  vec3 col;
  col.r = texture2D(tDiffuse, clamp(uv + vec2(ca, 0.0), 0.001, 0.999)).r;
  col.g = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).g;
  col.b = texture2D(tDiffuse, clamp(uv - vec2(ca, 0.0), 0.001, 0.999)).b;

  // ---- cheap bloom: four taps of whatever is already bright
  if (uBloom > 0.01) {
    vec3 b = vec3(0.0);
    vec2 px = 2.5 / uRes;
    b += texture2D(tDiffuse, uv + vec2( px.x,  px.y)).rgb;
    b += texture2D(tDiffuse, uv + vec2(-px.x,  px.y)).rgb;
    b += texture2D(tDiffuse, uv + vec2( px.x, -px.y)).rgb;
    b += texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb;
    b *= 0.25;
    col += max(vec3(0.0), b - 0.62) * uBloom * 1.8;
  }

  // ---- low-light gain: the camera tries, and shows you the noise floor
  col *= 1.0 + uGain * 1.25;
  col = pow(col, vec3(1.0 - uGain * 0.16));

  // ---- night vision
  if (uNight > 0.01) {
    float l = dot(col, vec3(0.3, 0.6, 0.1));
    vec3 nv = vec3(l * 0.25, l * 1.55 + 0.03, l * 0.3);
    nv += (noise(uv * uRes * 0.5 + uTime * 40.0) - 0.5) * 0.14;
    col = mix(col, nv, uNight);
  }

  // ---- per-level colour cast, then the tape's own bias
  col *= uTint;
  col = mix(col, col * vec3(1.05, 0.99, 0.94), 0.5);

  // ---- grain, heavier in the dark
  float g = noise(uv * uRes * 0.7 + uTime * 60.0) - 0.5;
  col += g * (0.035 + uGrain * 0.16 + uGain * 0.06);

  // ---- dropout: white/black flecks and the occasional dead line
  float drop = step(0.9985 - uGlitch * 0.02, hash(vec2(floor(uv.y * 240.0), floor(uTime * 24.0))));
  col = mix(col, vec3(0.85), drop * 0.5 * uGlitch);
  float deadLine = step(0.998, hash(vec2(floor(uv.y * 400.0), floor(uTime * 6.0))));
  col *= 1.0 - deadLine * 0.5 * uGlitch;

  // ---- scanlines + shadow mask
  col *= 0.93 + 0.07 * sin(uv.y * uRes.y * 1.6);
  col *= 0.97 + 0.03 * sin(uv.x * uRes.x * 2.1);

  // ---- lens dirt, lit by whatever is bright behind it
  vec3 dirt = texture2D(tDirt, uv * vec2(1.0, uRes.y / uRes.x)).rgb;
  col += dirt * (0.035 + uBloom * 0.06) * (0.25 + col.g);

  // ---- damage pulse and vignette
  col = mix(col, vec3(0.55, 0.06, 0.05), uDamage * 0.42);
  float v = smoothstep(0.95, 0.30, length((vUv - 0.5) * vec2(1.06, 1.0)));
  col *= mix(1.0, v, uVign);

  // ---- edge of the frame: the tape never quite fills it
  float frame = step(0.002, vUv.x) * step(vUv.x, 0.998) * step(0.002, vUv.y) * step(vUv.y, 0.998);
  col *= frame;

  gl_FragColor = vec4(col, 1.0);
}`;

export class Camcorder {
  constructor(renderer, scene, camera, host) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.host = host;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.scale = 1;
    this.target = new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
    });
    this.uniforms = {
      tDiffuse: { value: this.target.texture },
      tDirt: { value: lensDirtTexture() },
      uRes: { value: new THREE.Vector2(size.x, size.y) },
      uTime: { value: 0 },
      uGlitch: { value: 0 },
      uGrain: { value: 0.1 },
      uGain: { value: 0 },
      uNight: { value: 0 },
      uVign: { value: 0.9 },
      uDamage: { value: 0 },
      uSanity: { value: 1 },
      uUnder: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uBloom: { value: 0.6 },
    };
    this.quadScene = new THREE.Scene();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false,
    }));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.Camera();

    this.buildOverlay();
    this.zoom = 1;
    this.night = false;
    this.smoothGain = 0;
  }

  // ---------------------------------------------------------------- overlay
  buildOverlay() {
    const el = document.createElement('div');
    el.id = 'tape';
    el.innerHTML = `
      <div class="tape-tl">
        <span class="rec-dot"></span><span class="rec-word">REC</span>
        <span class="tape-sp">SP</span>
      </div>
      <div class="tape-tr">
        <span class="bat"><i></i></span><span class="bat-pct">100</span>
      </div>
      <div class="tape-bl"><span class="tc">00:00:00:00</span></div>
      <div class="tape-br">
        <span class="zoom">W &nbsp;▬▬▬▬▬▬▬&nbsp; T</span>
        <span class="nv" hidden>0 LUX · NIGHTSHOT</span>
      </div>
      <div class="tape-focus"><i></i><i></i><i></i><i></i></div>
      <div class="tape-warn" hidden>BATT LOW</div>`;
    this.host.appendChild(el);
    this.el = el;
    this.recDot = el.querySelector('.rec-dot');
    this.batBar = el.querySelector('.bat i');
    this.batPct = el.querySelector('.bat-pct');
    this.tcEl = el.querySelector('.tc');
    this.zoomEl = el.querySelector('.zoom');
    this.nvEl = el.querySelector('.nv');
    this.warnEl = el.querySelector('.tape-warn');
  }

  resize(w, h) {
    const px = Math.max(0.55, Math.min(1, this.scale));
    this.target.setSize(Math.max(2, Math.floor(w * px)), Math.max(2, Math.floor(h * px)));
    this.uniforms.uRes.value.set(w, h);
  }

  // ---------------------------------------------------------------- frame
  render(dt, s) {
    const u = this.uniforms;
    u.uTime.value += dt;
    u.uGlitch.value = s.glitch;
    u.uGrain.value = 0.06 + s.grain * 0.9 + (1 - s.sanity) * 0.25;
    // the camera's auto-gain: it takes a moment to give up on the dark
    const want = clamp01(1 - s.light * 1.8) * (s.night ? 0.25 : 1);
    this.smoothGain = damp(this.smoothGain, want, 1.4, dt);
    u.uGain.value = this.smoothGain;
    u.uNight.value = damp(u.uNight.value, s.night ? 1 : 0, 6, dt);
    u.uDamage.value = s.damage;
    u.uSanity.value = s.sanity;
    u.uUnder.value = s.underwater ? 1 : 0;
    u.uVign.value = s.night ? 1 : 0.9;
    u.uBloom.value = s.night ? 0.2 : 0.65;
    if (s.tint) u.uTint.value.set(s.tint.r, s.tint.g, s.tint.b);

    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);

    // ---- overlay furniture
    this.tcEl.textContent = fmtTimecode(s.tapeTime);
    const b = Math.max(0, Math.round(s.battery));
    this.batPct.textContent = String(b);
    this.batBar.style.width = `${b}%`;
    this.batBar.style.background = b < 15 ? '#ff4030' : b < 35 ? '#ffb020' : '#e8e4d8';
    this.warnEl.hidden = b >= 15;
    this.recDot.classList.toggle('blink', s.recording);
    this.el.classList.toggle('paused', !s.recording);
    this.nvEl.hidden = !s.night;
    if (this.lastZoom !== s.zoom) {
      this.lastZoom = s.zoom;
      const bars = 7;
      const k = Math.round(((s.zoom - 1) / 2) * (bars - 1));
      this.zoomEl.innerHTML = `W&nbsp;${'▬'.repeat(k)}<b>▮</b>${'▬'.repeat(bars - 1 - k)}&nbsp;T`;
    }
  }

  dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    this.el.remove();
  }
}
