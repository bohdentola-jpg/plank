// THE LENS. Every frame of this game goes through here, and which of three
// looks it comes out as is the whole story.
//
//   EYE    your own eyes. Warm, clean, a breath of grain. As Valco's interest
//          in you rises, a soft key light that has no source in the room
//          creeps in and the shadows fill. The flat is being lit for
//          television and you cannot quite prove it.
//   CAM    a 1974 time-lapse security deck. Wide, barrelled, near-monochrome,
//          fixed-pattern column noise, coarse scanlines — and the frame is
//          HELD. Real surveillance recorded at a few frames a second, and so
//          does this: the scene only redraws every nth frame while the post
//          pass keeps running. It is the single most unpleasant thing in here.
//   FILM   16mm, for the commercials. Gate weave, halation, dust, hair, a
//          scratch that wanders, and a shutter that is not quite steady.
//
// One render target, one fullscreen triangle, one DOM strip for the burn-in.

import * as THREE from 'three';
import { clamp, clamp01, damp } from './util.js';

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
uniform vec2  uRes;
uniform float uTime;
uniform float uCam;      // surveillance look 0..1
uniform float uFilm;     // 16mm look 0..1
uniform float uGrain;
uniform float uWarm;     // how hard the room is being lit for television 0..1
uniform float uTear;     // head-switch tear on the security deck
uniform float uFlash;    // white
uniform float uFade;     // black
uniform float uVign;
uniform float uSick;     // things are not right 0..1
uniform vec3  uTint;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float hash1(float p) { return fract(sin(p * 78.233) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);

  // ---- the glass. A security camera is a wide-angle lens screwed into a
  // ceiling, and it looks like one.
  float barrel = 0.012 + uCam * 0.115 + uFilm * 0.02;
  uv = 0.5 + c * (1.0 + barrel * r2 + barrel * 0.5 * r2 * r2);

  // ---- 16mm gate weave: the film is not held perfectly still, ever
  if (uFilm > 0.01) {
    uv += vec2(vnoise(vec2(uTime * 3.1, 0.0)) - 0.5,
               vnoise(vec2(0.0, uTime * 2.4)) - 0.5) * 0.0035 * uFilm;
  }

  // ---- something is wrong with the room and the walls know first
  if (uSick > 0.01) {
    uv.x += sin(uv.y * 21.0 + uTime * 1.3) * 0.0026 * uSick;
    uv.y += cos(uv.x * 17.0 - uTime * 0.9) * 0.0018 * uSick;
  }

  // ---- head-switch tear: a band of the picture slides sideways
  if (uTear > 0.001) {
    float band = step(0.72, vnoise(vec2(uTime * 1.6, floor(uv.y * 42.0))));
    float jump = vnoise(vec2(floor(uv.y * 42.0), floor(uTime * 5.0))) - 0.5;
    uv.x += band * jump * 0.07 * uTear;
  }

  // ---- sample. Film halates and splits; the security deck barely has colour
  // to split in the first place.
  float ca = (0.0009 + uFilm * 0.0026) * (1.0 - uCam * 0.7);
  vec3 col;
  col.r = texture2D(tDiffuse, clamp(uv + vec2(ca, 0.0), 0.001, 0.999)).r;
  col.g = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).g;
  col.b = texture2D(tDiffuse, clamp(uv - vec2(ca, 0.0), 0.001, 0.999)).b;

  // ---- bloom. Four taps of whatever is already bright: halation on film,
  // and on EYE it is the studio light that nobody will admit is there.
  float bloomAmt = 0.35 + uFilm * 1.5 + uWarm * 0.9;
  {
    vec3 b = vec3(0.0);
    vec2 px = (2.0 + uFilm * 3.0) / uRes;
    b += texture2D(tDiffuse, uv + vec2( px.x,  px.y)).rgb;
    b += texture2D(tDiffuse, uv + vec2(-px.x,  px.y)).rgb;
    b += texture2D(tDiffuse, uv + vec2( px.x, -px.y)).rgb;
    b += texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb;
    b *= 0.25;
    col += max(vec3(0.0), b - 0.66) * bloomAmt;
  }

  // ---- lit for television: the shadows fill in and everything gets a little
  // too even, and a warm key arrives from off-frame left.
  if (uWarm > 0.01) {
    vec3 fill = mix(col, vec3(luma(col)) * 1.25 + 0.06, 0.35);
    float key = smoothstep(0.95, 0.05, distance(vUv, vec2(-0.05, 0.34)));
    col = mix(col, fill * (1.0 + key * 0.22), uWarm);
    col = mix(col, col * vec3(1.10, 1.02, 0.90), uWarm * 0.7);
  }

  // ---- the security deck
  if (uCam > 0.01) {
    float l = luma(col);
    // it gains up in the dark and it is not proud of the result
    l = pow(clamp(l * 1.32 + 0.03, 0.0, 1.0), 0.86);
    vec3 mono = vec3(l) * vec3(0.90, 1.0, 0.99);      // a hair of green in the tube
    // fixed-pattern column noise: the same sensor faults, in the same columns,
    // every frame, forever
    float fp = (hash1(floor(vUv.x * uRes.x)) - 0.5) * 0.055;
    mono += fp;
    // and a slow horizontal roll bar that never quite leaves
    float roll = sin((vUv.y + uTime * 0.06) * 6.2831) * 0.5 + 0.5;
    mono *= 1.0 - pow(roll, 22.0) * 0.16;
    col = mix(col, mono, uCam);
  }

  // ---- 16mm: warm stock, dust in the gate, one hair, one scratch
  if (uFilm > 0.01) {
    vec3 stock = col * vec3(1.14, 1.02, 0.86);
    stock = pow(clamp(stock, 0.0, 2.0), vec3(0.92, 0.95, 1.04));
    col = mix(col, stock, uFilm);
    // shutter: the lamp in a 1974 telecine is not a steady lamp
    col *= 1.0 + (vnoise(vec2(uTime * 21.0, 3.7)) - 0.5) * 0.075 * uFilm;
    // dust and sparkle, a fresh handful every frame at 24
    float fr = floor(uTime * 24.0);
    float d = hash(floor(vUv * vec2(190.0, 140.0)) + fr * 7.13);
    col += step(0.9975, d) * 0.65 * uFilm;
    col -= step(0.9988, hash(floor(vUv * vec2(150.0, 110.0)) + fr * 3.31)) * 0.45 * uFilm;
    // a scratch that wanders across the frame over about a minute
    float sx = 0.2 + vnoise(vec2(uTime * 0.13, 9.0)) * 0.6;
    col += smoothstep(0.0016, 0.0, abs(vUv.x - sx)) * 0.22 * uFilm;
  }

  col *= uTint;

  // ---- grain. Heavier on film, heaviest on a deck recording at 2fps.
  float g = vnoise(uv * uRes * 0.75 + uTime * 71.0) - 0.5;
  col += g * (0.022 + uGrain * 0.13 + uCam * 0.075 + uFilm * 0.085);

  // ---- lines. A security monitor is 240-odd lines and proud of none of them.
  if (uCam > 0.01) {
    float sl = 0.88 + 0.12 * sin(vUv.y * 480.0 * 3.14159);
    col *= mix(1.0, sl, uCam);
    float field = mod(floor(vUv.y * 480.0) + floor(uTime * 25.0), 2.0);
    col *= 1.0 - field * 0.055 * uCam;
    // dropout flecks
    float drop = step(0.9993, hash(vec2(floor(vUv.y * 300.0), floor(uTime * 18.0))));
    col = mix(col, vec3(0.78), drop * 0.4 * uCam);
  } else {
    col *= 0.985 + 0.015 * sin(vUv.y * uRes.y * 1.5);
  }

  // ---- vignette. The security lens is the worst offender.
  float vamt = uVign * (1.0 + uCam * 0.55 + uFilm * 0.25);
  float v = smoothstep(1.05, 0.28, length((vUv - 0.5) * vec2(1.05, 1.0)));
  col *= mix(1.0, v, clamp(vamt, 0.0, 1.0));

  // ---- flash, fade, and the edge of the frame
  col = mix(col, vec3(1.0), clamp(uFlash, 0.0, 1.0));
  col *= 1.0 - clamp(uFade, 0.0, 1.0);
  float frame = step(0.001, vUv.x) * step(vUv.x, 0.999) * step(0.001, vUv.y) * step(vUv.y, 0.999);
  col *= frame;

  gl_FragColor = vec4(col, 1.0);
}`;

export class Lens {
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
      uRes: { value: new THREE.Vector2(size.x, size.y) },
      uTime: { value: 0 },
      uCam: { value: 0 },
      uFilm: { value: 0 },
      uGrain: { value: 0 },
      uWarm: { value: 0 },
      uTear: { value: 0 },
      uFlash: { value: 0 },
      uFade: { value: 0 },
      uVign: { value: 0.85 },
      uSick: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
    };

    this.quadScene = new THREE.Scene();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    }));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.Camera();

    // frame hold — the thing that makes CAM feel like surveillance and not
    // like a filter. 0 means every frame; 8 means eight a second.
    this.holdFps = 0;
    this.holdT = 0;

    this.buildStrip();
  }

  // -------------------------------------------------------------- burn-in

  buildStrip() {
    const el = document.createElement('div');
    el.id = 'burn';
    el.hidden = true;
    el.innerHTML = `
      <div class="burn-tl"><span class="burn-rec"><i></i>REC</span><span class="burn-cam">CAM 00</span></div>
      <div class="burn-bl"><span class="burn-note"></span></div>
      <div class="burn-br"><span class="burn-stamp">74-03-05  00:00:00</span></div>`;
    this.host.appendChild(el);
    this.el = el;
    this.camEl = el.querySelector('.burn-cam');
    this.stampEl = el.querySelector('.burn-stamp');
    this.noteEl = el.querySelector('.burn-note');
  }

  /** @param {null|{cam:number, stamp:string, note:string}} s */
  setStrip(s) {
    if (!this.el) return;
    this.el.hidden = !s;
    if (!s) return;
    this.camEl.textContent = `CAM ${String(s.cam ?? 0).padStart(2, '0')}`;
    this.stampEl.textContent = s.stamp || '';
    this.noteEl.textContent = s.note || '';
  }

  // -------------------------------------------------------------- sizing

  resize(w, h) {
    const px = clamp(this.scale, 0.55, 1);
    this.target.setSize(Math.max(2, Math.floor(w * px)), Math.max(2, Math.floor(h * px)));
    // the grain and the scanlines belong to the display, not to the buffer
    this.uniforms.uRes.value.set(w, h);
  }

  // -------------------------------------------------------------- frame

  /**
   * Renders the world and the look over it. This is the only place either
   * happens.
   * @param {number} dt
   * @param {object} s { mode, warm, grain, tear, flash, fade, sick, tint, vign, holdFps }
   */
  render(dt, s) {
    const u = this.uniforms;
    u.uTime.value += dt;

    const wantCam = s.mode === 'cam' ? 1 : 0;
    const wantFilm = s.mode === 'film' ? 1 : 0;
    // the cut is instant — a vision mixer does not crossfade — but coming back
    // to your own eyes takes a moment, the way it does
    u.uCam.value = wantCam ? 1 : damp(u.uCam.value, 0, 9, dt);
    u.uFilm.value = wantFilm ? 1 : damp(u.uFilm.value, 0, 12, dt);

    u.uWarm.value = damp(u.uWarm.value, s.warm ?? 0, 1.2, dt);
    u.uGrain.value = s.grain ?? 0;
    u.uTear.value = s.tear ?? 0;
    u.uFlash.value = s.flash ?? 0;
    u.uFade.value = s.fade ?? 0;
    u.uSick.value = damp(u.uSick.value, s.sick ?? 0, 2.5, dt);
    u.uVign.value = s.vign ?? 0.85;
    if (s.tint) u.uTint.value.set(s.tint.r, s.tint.g, s.tint.b);

    // ---- the hold. A time-lapse deck writes a frame and then does nothing
    // for a while, so the world stops and your input arrives late, and there
    // is nothing you can do about that because they are not filming for you.
    const fps = s.holdFps ?? this.holdFps;
    let draw = true;
    if (fps > 0) {
      this.holdT += dt;
      const period = 1 / fps;
      if (this.holdT < period) draw = false;
      else this.holdT %= period;
    } else {
      this.holdT = 0;
    }

    const r = this.renderer;
    if (draw) {
      r.setRenderTarget(this.target);
      r.clear();
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
    }
    r.render(this.quadScene, this.quadCam);
  }

  /** Force the next frame to redraw, so a cut never shows the previous shot. */
  breakHold() { this.holdT = 1e6; }

  dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    this.el?.remove();
  }
}
