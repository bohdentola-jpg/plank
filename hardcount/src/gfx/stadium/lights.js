// Floodlights as things you can see: lamp banks (emissive lamp grids), glare
// halos and anamorphic streaks that bloom through the CRT pipeline, a big
// faint haze around every bank (stronger in rain, snow and fog), volumetric
// beams down onto the field, and small point glows (aviation lights, porch
// lights, street lamps, sodium lamps). All batched: ~5 draw calls total.
import * as THREE from 'three';
import { GeoBuilder } from '../geo.js';
import { lampTex, glowTex, streakTex } from './tex.js';

const SPRITE_VERT = /* glsl */`
  attribute vec3 aCenter;
  attribute vec2 aCorner;
  attribute vec2 aSize;
  attribute vec4 aColor;
  uniform float uTime, uPull, uScale;
  varying vec2 vUv;
  varying vec3 vCol;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(aCenter, 1.0);
    float dist = length(mvPosition.xyz);
    mvPosition.xyz += normalize(-mvPosition.xyz) * min(uPull, dist * 0.5);
    // blink: aColor.w > 0 = phase of a slow on/off (aviation lights)
    float blink = aColor.w > 0.0 ? step(0.55, fract(uTime * 0.6 + aColor.w)) : 1.0;
    mvPosition.xy += aCorner * aSize * uScale;
    vUv = aCorner + 0.5;
    vCol = aColor.rgb * blink;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const SPRITE_FRAG = /* glsl */`
  uniform sampler2D map;
  uniform float uGain;
  varying vec2 vUv;
  varying vec3 vCol;
  #include <fog_pars_fragment>
  void main() {
    vec3 c = texture2D(map, vUv).rgb * vCol * uGain;
    gl_FragColor = vec4(c, 1.0);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      gl_FragColor.rgb *= 1.0 - fogFactor * 0.6;
    #endif
  }`;

/** A batch of camera-facing additive sprites. items: { pos, w, h, color: [r,g,b], blink } */
export function spriteMesh(items, map, opts = {}) {
  const n = items.length;
  const center = new Float32Array(n * 12), corner = new Float32Array(n * 8), size = new Float32Array(n * 8), color = new Float32Array(n * 16);
  const idx = [];
  const cs = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  items.forEach((it, i) => {
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      center.set([it.pos.x, it.pos.y, it.pos.z], v * 3);
      corner.set(cs[k], v * 2);
      size.set([it.w, it.h ?? it.w], v * 2);
      color.set([it.color[0], it.color[1], it.color[2], it.blink || 0], v * 4);
    }
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(center.slice(), 3));
  g.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 2));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 4));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      map: { value: map }, uTime: { value: 0 }, uPull: { value: opts.pull ?? 1.0 }, uScale: { value: 1 }, uGain: { value: opts.gain ?? 1 },
    }]),
    transparent: true, depthWrite: false, depthTest: opts.depthTest !== false, blending: THREE.AdditiveBlending, fog: opts.fog !== false,
  });
  mat.uniforms.map.value = map;
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = opts.order ?? 5;
  return m;
}

const BEAM_VERT = /* glsl */`
  attribute float aAlong;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vAlong = aAlong;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BEAM_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uI;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // MSAA can shade a pixel centre just past the cone's ends: keep pow() off negatives (NaN on real GPUs)
    float f = clamp(abs(dot(vN, vV)), 0.0, 1.0);
    float along = clamp(vAlong, 0.0, 1.0);
    float a = pow(f, 1.6) * pow(1.0 - along, 1.7) * smoothstep(0.0, 0.06, along);
    gl_FragColor = vec4(uColor * a * uI, 1.0);
  }`;

/**
 * The venue's light rig. Add banks (from kit.lightPole or bowl rims) and
 * points, then build(group).
 */
export class LightRig {
  constructor(ctx) {
    this.ctx = ctx;
    this.banks = [];
    this.points = [];
  }
  /** spec: { center, yaw, tilt, cols, rows, lamp, w, h, aim, warm, glare } */
  bank(spec) { this.banks.push(spec); return spec; }
  point(p) { this.points.push(p); }

  /** Directions of the brightest banks seen from the field centre, for the sky haze. */
  skyBanks() {
    const out = [];
    const sorted = [...this.banks].sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const step = Math.max(1, Math.floor(sorted.length / 8));
    for (let i = 0; i < sorted.length && out.length < 8; i += step) {
      const b = sorted[i];
      const d = b.center.clone().normalize();
      out.push(new THREE.Vector4(d.x, Math.max(0.05, d.y), d.z, 0.6));
    }
    return out;
  }

  build(group) {
    const A = this.ctx.atmos;
    const on = A.lights > 0;
    const lampI = A.lamp;
    const faces = { c: new GeoBuilder(), w: new GeoBuilder() };
    const beamG = new GeoBuilder();
    const along = [];
    const glare = [], streaks = [], haze = [];
    const wx = A.weather;
    const hazeK = wx === 'fog' ? 2.6 : wx === 'rain' || wx === 'snow' ? 1.6 : A.night ? 1 : 0.5;
    for (const b of this.banks) {
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      const r = new THREE.Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw));
      const t = b.tilt ?? 0.4;
      const up = new THREE.Vector3(Math.sin(t) * fx, Math.cos(t), Math.sin(t) * fz);
      const n = new THREE.Vector3(fx * Math.cos(t), -Math.sin(t), fz * Math.cos(t));
      const c = b.center;
      const hw = r.clone().multiplyScalar(b.w / 2), hh = up.clone().multiplyScalar(b.h / 2);
      const gb = b.warm ? faces.w : faces.c;
      gb.quad(c.clone().sub(hw).sub(hh), c.clone().add(hw).sub(hh), c.clone().add(hw).add(hh), c.clone().sub(hw).add(hh), [0, 0, b.cols, b.rows]);
      b.normal = n;
      if (!on) continue;
      const tint = b.warm ? [1.0, 0.82, 0.6] : [0.92, 0.96, 1.0];
      const g = (b.glare ?? 1);
      const s = Math.max(b.w, b.h);
      const front = c.clone().addScaledVector(n, 0.4);
      glare.push({ pos: front, w: s * 2.4, h: s * 2.4, color: tint.map((v) => v * 3.2 * g) });
      streaks.push({ pos: front, w: s * 9, h: s * 0.55, color: tint.map((v) => v * 1.1 * g) });
      haze.push({ pos: front, w: s * 9 * Math.sqrt(hazeK), h: s * 7 * Math.sqrt(hazeK), color: tint.map((v) => v * 0.09 * hazeK * g) });
      // beam: a cone from the bank toward its aim point
      if (b.aim && this.ctx.quality !== 'low') {
        const dir = b.aim.clone().sub(c);
        const L = dir.length() * 1.05;
        dir.normalize();
        const cone = new THREE.CylinderGeometry(s * 0.45, L * 0.32, L, 14, 1, true);
        cone.translate(0, -L / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        const m = new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1));
        const p = cone.attributes.position;
        for (let i = 0; i < p.count; i++) along.push(-p.getY(i) / L);
        beamG.geometry(cone, m);
        cone.dispose();
      }
    }
    const out = { update: () => {} };
    // lamp faces
    const faceMat = (warm) => new THREE.MeshBasicMaterial({ map: lampTex(warm), color: new THREE.Color(1, 1, 1).multiplyScalar(on ? lampI : 0.9), side: THREE.DoubleSide });
    for (const k of ['c', 'w']) {
      if (!faces[k].count) continue;
      const m = new THREE.Mesh(faces[k].build(), faceMat(k === 'w'));
      m.name = 'lampFaces';
      group.add(m);
    }
    const sprites = [];
    if (on && glare.length) {
      const fogGain = wx === 'fog' ? 0.75 : 1;
      const gm = spriteMesh([...haze, ...glare], glowTex(), { pull: 1.0, gain: fogGain });
      gm.name = 'glare';
      group.add(gm);
      sprites.push(gm);
      const sm = spriteMesh(streaks, streakTex(), { pull: 1.2, gain: 1 });
      sm.name = 'streaks';
      group.add(sm);
      sprites.push(sm);
    }
    if (beamG.count) {
      const g = beamG.build();
      g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
      const bi = wx === 'fog' ? 0.075 : wx === 'rain' || wx === 'snow' ? 0.045 : A.night ? 0.012 : 0.008;
      const mat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
        uniforms: { uColor: { value: new THREE.Color(0.85, 0.9, 1.0) }, uI: { value: bi } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const bm = new THREE.Mesh(g, mat);
      bm.name = 'beams';
      bm.renderOrder = 4;
      group.add(bm);
    }
    // point glows (aviation, porch, street lamps)
    if (this.points.length) {
      const pts = this.points.map((p) => ({ pos: p.pos, w: p.size, h: p.size, color: p.color.map((v) => v * (p.k ?? 1) * (A.day ? 0.25 : 1)), blink: p.blink ? (p.pos.x * 0.37 % 1 + 1) % 1 + 0.01 : 0 }));
      const pm = spriteMesh(pts, glowTex(), { pull: 0.3 });
      pm.name = 'points';
      group.add(pm);
      sprites.push(pm);
    }
    out.update = (t) => { for (const s of sprites) s.material.uniforms.uTime.value = t; };
    return out;
  }
}
