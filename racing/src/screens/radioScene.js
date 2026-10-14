// The main-menu set: you, behind the wheel, stopped at a red light on a wet
// downtown street at 2 AM. Interior (dash, gauges, steering wheel, head unit,
// shifter, mirror + swinging air freshener, flip phone on the passenger
// seat), rain on the windshield with wipers, and the street outside (shops,
// neon, lamps, traffic light, parked cars, cross traffic, a rival who pulls up).
//
// Frame: our car at the origin facing +z; +x is the car's LEFT (driver side).
import * as THREE from 'three';
import { getEnvMap } from '../core/envmap.js';
import { roadTextures, concreteTexture, facadeTextures, shopfrontTextures, glowTexture, streakTexture, toTex, groundTexture } from '../track/textures.js';
import { buildCarModel } from '../car/model.js';
import { mergeByMaterial } from '../race/trafficModels.js';
import { CAR_BY_ID } from '../car/cars.js';
import { vText } from '../core/ui.js';
import { makeRng } from '../core/util.js';
import { GeoBuilder } from '../track/env/common.js';

const EYE = new THREE.Vector3(0.37, 1.17, -0.05);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ------------------------------------------------------------------ interior

function plastic(color = 0x1a1b1e, rough = 0.78) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}

function noisePlastic(color) {
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 128);
  const rng = makeRng('dash' + color);
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    x.fillRect(rng() * 128, rng() * 128, 1, 1);
  }
  const t = toTex(c);
  t.repeat.set(6, 6);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.0, envMapIntensity: 2.2 });
}

/** A gauge face canvas: amber backlit numbers, red needle drawn per frame. */
export class Gauge {
  constructor(kind) {
    this.kind = kind;
    this.c = canvas(256, 256);
    this.tex = toTex(this.c, { repeat: false });
    this.value = 0;
    this.draw(0);
  }
  draw(v) {
    const x = this.c.getContext('2d');
    x.clearRect(0, 0, 256, 256);
    x.fillStyle = '#050505';
    x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
    const max = this.kind === 'tach' ? 8 : 160;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    x.strokeStyle = '#ffb04a';
    x.fillStyle = '#ffb04a';
    x.lineWidth = 3;
    x.font = 'bold 22px Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const n = this.kind === 'tach' ? 8 : 8;
    for (let k = 0; k <= n; k++) {
      const a = a0 + (a1 - a0) * k / n;
      x.beginPath();
      x.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
      x.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118);
      x.stroke();
      const lbl = this.kind === 'tach' ? String(k) : String(k * 20);
      x.fillStyle = this.kind === 'tach' && k >= 7 ? '#ff4a3a' : '#ffb04a';
      x.fillText(lbl, 128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82);
    }
    x.font = 'bold 13px Arial';
    x.fillStyle = '#c98a3a';
    x.fillText(this.kind === 'tach' ? 'x1000 r/min' : 'MPH', 128, 175);
    const a = a0 + (a1 - a0) * Math.min(1, v / max);
    x.strokeStyle = '#ff3a1a';
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(128, 128);
    x.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108);
    x.stroke();
    x.fillStyle = '#222';
    x.beginPath(); x.arc(128, 128, 12, 0, Math.PI * 2); x.fill();
    this.tex.needsUpdate = true;
  }
}

/** Head-unit VFD display canvas. */
export class Display {
  constructor() {
    this.c = canvas(512, 160);
    this.tex = toTex(this.c, { repeat: false });
    this.tex.colorSpace = THREE.SRGBColorSpace;
  }
  draw(state) {
    const x = this.c.getContext('2d');
    x.fillStyle = '#020806';
    x.fillRect(0, 0, 512, 160);
    // faint unlit segments grid
    x.fillStyle = 'rgba(70,232,255,0.05)';
    for (let i = 0; i < 512; i += 4) x.fillRect(i, 0, 1, 160);
    const col = '#46e8ff';
    x.save();
    x.shadowColor = col;
    x.shadowBlur = 12;
    vText(x, state.band || 'FM', 22, 64, 24, { color: col, weight: 0.17, skew: 0 });
    vText(x, state.freq, 300, 92, 64, { color: col, weight: 0.15, skew: 0, align: 'right' });
    vText(x, 'MHZ', 312, 92, 18, { color: col, weight: 0.17, skew: 0 });
    // scrolling RDS text
    const rds = state.rds || '';
    x.font = 'bold 26px "Consolas", "DejaVu Sans Mono", monospace';
    x.fillStyle = col;
    x.textBaseline = 'alphabetic';
    const view = 14;
    let shown = rds;
    if (rds.length > view) {
      const k = Math.floor(state.t * 4) % (rds.length + 6);
      shown = (rds + '      ' + rds).slice(k, k + view);
    }
    x.fillText(shown.padEnd(view), 24, 140);
    // signal bars + ST
    for (let k = 0; k < 5; k++) {
      x.globalAlpha = k < state.signal * 5 ? 1 : 0.15;
      x.fillRect(400 + k * 18, 70 - k * 9, 12, 12 + k * 9);
    }
    x.globalAlpha = state.signal > 0.85 ? 1 : 0.15;
    vText(x, 'ST', 400, 112, 18, { color: col, skew: 0 });
    x.globalAlpha = 1;
    vText(x, state.preset ? `P${state.preset}` : '', 470, 112, 18, { color: col, skew: 0 });
    x.restore();
    this.tex.needsUpdate = true;
  }
}

function buildInterior(group, rng) {
  const dashMat = noisePlastic('#1c1d21');
  const darkMat = plastic(0x0e0f11, 0.7);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.4, metalness: 0.6 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 });

  // dashboard: an extruded profile across the car (x), sloping toward the glass
  const prof = new THREE.Shape();
  prof.moveTo(0.5, 0.5);
  prof.lineTo(0.5, 0.8);
  prof.quadraticCurveTo(0.54, 0.9, 0.68, 0.91);
  prof.lineTo(1.12, 0.92);
  prof.lineTo(1.2, 0.9);
  prof.lineTo(1.2, 0.5);
  prof.closePath();
  const dashG = new THREE.ExtrudeGeometry(prof, { depth: 1.62, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 8 });
  dashG.rotateY(-Math.PI / 2);
  dashG.translate(0.81, 0, 0); // shape x → car z (forward), extrusion → across the car
  const dash = new THREE.Mesh(dashG, dashMat);
  group.add(dash);

  // instrument binnacle hood + two gauges in front of the driver
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 20, 1, true, Math.PI * 0.08, Math.PI * 0.84), darkMat);
  hood.rotation.z = Math.PI / 2;
  hood.position.set(0.37, 0.9, 0.6);
  hood.material.side = THREE.DoubleSide;
  group.add(hood);
  const tach = new Gauge('tach');
  const speedo = new Gauge('speed');
  const gaugeMat = (g) => new THREE.MeshStandardMaterial({ map: g.tex, emissive: 0xffffff, emissiveMap: g.tex, emissiveIntensity: 0.9, roughness: 0.3 });
  const gT = new THREE.Mesh(new THREE.CircleGeometry(0.065, 32), gaugeMat(tach));
  const gS = new THREE.Mesh(new THREE.CircleGeometry(0.065, 32), gaugeMat(speedo));
  for (const [g, gx] of [[gT, 0.45], [gS, 0.29]]) {
    g.position.set(gx, 0.89, 0.62);
    g.rotation.y = Math.PI;
    g.rotation.x = -0.12;
    group.add(g);
  }

  // steering wheel (rim, three spokes, hub with emblem)
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 40), leather);
  wheel.add(rim);
  for (const a of [0, Math.PI * 0.82, Math.PI * 1.18]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.02), trimMat);
    sp.position.set(Math.cos(a - Math.PI / 2) * 0.09, Math.sin(a - Math.PI / 2) * 0.09, 0);
    sp.rotation.z = a - Math.PI / 2;
    wheel.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 20), leather);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.25 }));
  badge.position.z = -0.026;
  badge.rotation.y = Math.PI;
  wheel.add(badge);
  wheel.position.set(0.37, 0.8, 0.4);
  wheel.rotation.x = -0.42;
  group.add(wheel);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 10), darkMat);
  column.rotation.x = Math.PI / 2 - 0.42;
  column.position.set(0.37, 0.74, 0.54);
  group.add(column);

  // center stack + head unit
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.1), dashMat);
  stack.position.set(0, 0.64, 0.5);
  stack.rotation.x = 0.12;
  group.add(stack);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.03), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.35, metalness: 0.4 }));
  face.position.set(0, 0.79, 0.44);
  face.rotation.x = 0.12;
  group.add(face);
  const display = new Display();
  const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.047), new THREE.MeshBasicMaterial({ map: display.tex, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  dispMesh.position.set(0, 0.802, 0.423);
  dispMesh.rotation.y = Math.PI;
  dispMesh.rotation.x = -0.12;
  group.add(dispMesh);
  // knobs (tune + volume) and preset buttons
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.35, metalness: 0.7 });
  const knobs = [];
  for (const kx of [0.085, -0.085]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.022, 16), knobMat);
    k.rotation.x = Math.PI / 2 + 0.12;
    k.position.set(kx, 0.78, 0.423);
    group.add(k);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.01, 0.002), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1).multiplyScalar(2) }));
    mark.position.set(0, 0.008, -0.012);
    k.add(mark);
    knobs.push(k);
  }
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.5, emissive: new THREE.Color('#1a6a7a'), emissiveIntensity: 0.6 });
  const presets = [];
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.008), btnMat.clone());
    b.position.set(-0.06 + k * 0.03, 0.755, 0.426);
    b.rotation.x = 0.12;
    group.add(b);
    presets.push(b);
  }
  // climate knobs with backlight
  for (const kx of [-0.08, 0, 0.08]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 16), knobMat);
    k.rotation.x = Math.PI / 2 + 0.12;
    k.position.set(kx, 0.61, 0.452);
    group.add(k);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.028, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(1.6) }));
    ring.position.set(kx, 0.61, 0.441);
    ring.rotation.y = Math.PI;
    ring.rotation.x = -0.12;
    group.add(ring);
  }
  // hazard button
  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2a1a, emissiveIntensity: 0.3 }));
  hz.position.set(0, 0.86, 0.43);
  group.add(hz);

  // console + shifter
  const cons = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.7), dashMat);
  cons.position.set(0, 0.42, 0.2);
  group.add(cons);
  const boot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 12), leather);
  boot.position.set(0, 0.58, 0.18);
  group.add(boot);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.16, 8), trimMat);
  lever.position.set(0, 0.66, 0.16);
  lever.rotation.x = -0.2;
  group.add(lever);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.25, metalness: 0.2 }));
  knob.position.set(0, 0.74, 0.145);
  group.add(knob);

  // pillars, header, headliner, door top (frame the windshield)
  const pillarMat = plastic(0x0a0a0b, 0.85);
  for (const sx of [1, -1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), pillarMat);
    p.position.set(sx * 0.78, 1.2, 0.78);
    p.rotation.x = -0.92;
    p.rotation.z = sx * 0.08;
    group.add(p);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.3), pillarMat);
  header.position.set(0, 1.47, 0.42);
  group.add(header);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 1.6), plastic(0x16171a, 0.95));
  roof.position.set(0, 1.5, -0.2);
  group.add(roof);
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.4), dashMat);
  doorL.position.set(0.86, 0.75, -0.1);
  group.add(doorL);

  // rearview mirror + air freshener on a string
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.03), darkMat);
  mirror.position.set(0, 1.33, 0.5);
  group.add(mirror);
  const mglass = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.055), new THREE.MeshStandardMaterial({ color: 0x334055, roughness: 0.05, metalness: 1 }));
  mglass.position.set(0, 1.33, 0.484);
  group.add(mglass);
  const fresh = new THREE.Group();
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.14, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
  string.position.y = -0.07;
  fresh.add(string);
  const tree = new THREE.Shape();
  tree.moveTo(0, 0); tree.lineTo(0.035, -0.04); tree.lineTo(0.015, -0.04); tree.lineTo(0.045, -0.08); tree.lineTo(0.02, -0.08); tree.lineTo(0.05, -0.12);
  tree.lineTo(-0.05, -0.12); tree.lineTo(-0.02, -0.08); tree.lineTo(-0.045, -0.08); tree.lineTo(-0.015, -0.04); tree.lineTo(-0.035, -0.04); tree.closePath();
  const tm = new THREE.Mesh(new THREE.ShapeGeometry(tree), new THREE.MeshStandardMaterial({ color: 0x1f8a3a, roughness: 0.8, side: THREE.DoubleSide }));
  tm.position.y = -0.14;
  fresh.add(tm);
  fresh.position.set(0, 1.3, 0.48);
  fresh.scale.setScalar(0.45);
  group.add(fresh);

  // passenger seat + flip phone
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), leather);
  seat.position.set(-0.38, 0.45, -0.1);
  group.add(seat);
  const phone = new THREE.Group();
  const pbase = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.7, roughness: 0.35 }));
  phone.add(pbase);
  const pscreenC = canvas(64, 96);
  const pscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.05), new THREE.MeshBasicMaterial({ map: toTex(pscreenC, { repeat: false }), toneMapped: false }));
  pscreen.rotation.x = -Math.PI / 2;
  pscreen.position.set(0, 0.0065, 0.005);
  phone.add(pscreen);
  phone.position.set(-0.32, 0.52, 0.02);
  phone.rotation.y = 0.5;
  group.add(phone);

  return { tach, speedo, display, knobs, presets, fresh, wheel, phone, pscreen, pscreenC, dispMesh };
}

// ------------------------------------------------------------------ rain + wipers

function buildWindshield(group) {
  // a quad covering the glass, from the cowl up to the header
  const g = new THREE.PlaneGeometry(1.62, 0.78, 1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, wipe: { value: -10 }, rain: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float time, wipe, rain; varying vec2 vUv;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      vec2 h22(vec2 p){ float n = h21(p); return vec2(n, h21(p + n)); }
      void main(){
        vec2 uv = vUv * vec2(2.1, 1.0);
        // premultiplied accumulation: drops are mostly clear lenses
        vec3 pc = vec3(0.0); float pa = 0.0;
        float since = time - wipe;
        for (int layer = 0; layer < 3; layer++) {
          float sc = layer == 0 ? 15.0 : (layer == 1 ? 9.0 : 5.5);
          vec2 g = uv * sc;
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          vec2 r = h22(id + float(layer) * 17.0);
          float present = step(0.35, h21(id + float(layer) * 5.3));
          float born = r.x * 7.0;
          float age = mod(time + born, 7.0);
          // cleared by the wiper (drops born before the sweep vanish)
          float clearMask = step(since, age) * step(0.0, since);
          present *= (1.0 - clearMask) * rain;
          vec2 off = (r - 0.5) * 0.55;
          float size = mix(0.07, 0.17, r.y) * (layer == 2 ? 1.25 : 1.0) * smoothstep(0.0, 0.8, age);
          vec2 q = f - off;
          q.y *= 1.12; // drops sag a little
          float d = length(q);
          float body = smoothstep(size, size * 0.72, d);
          // light from the street gathers along the lower edge (refraction flips it)
          float lower = body * smoothstep(0.1 * size, -0.75 * size, q.y) * smoothstep(size * 0.35, size * 0.9, d);
          // tiny specular glint, upper left
          float glint = smoothstep(size * 0.28, 0.0, length(q - vec2(-0.3, 0.35) * size));
          vec3 tint = mix(vec3(1.0, 0.62, 0.3), vec3(0.45, 0.8, 1.0), h21(id + 3.1));
          tint = mix(tint, vec3(1.0, 0.25, 0.4), step(0.85, h21(id + 9.7)));
          pc += present * (tint * lower * 0.42 + vec3(1.0) * glint * 0.75);
          pa += present * (body * 0.14 + lower * 0.24 + glint * 0.5);
        }
        // a few running streaks
        float sx = floor(uv.x * 40.0);
        float sr = h21(vec2(sx, 7.0));
        if (sr > 0.93) {
          float y = fract(vUv.y + time * (0.05 + sr * 0.1) + sr * 10.0);
          float streak = smoothstep(0.02, 0.0, abs(fract(uv.x * 40.0) - 0.5) * 0.05) * smoothstep(0.0, 0.3, y) * (1.0 - y) * rain;
          pc += vec3(0.6, 0.7, 0.8) * streak * 0.12;
          pa += streak * 0.12;
        }
        pa = clamp(pa, 0.0, 0.85);
        vec3 col = pc / max(pa, 0.001);
        float a = pa;
        gl_FragColor = vec4(col, a);
      }`,
  });
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, mat);
  // lie on the glass: from the cowl (z 1.13, y 0.94) up to the header (z 0.55, y 1.44)
  m.position.set(0, 1.19, 0.84);
  m.rotation.x = -0.86;
  m.renderOrder = 10;
  group.add(m);
  // wiper blades
  const blades = [];
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  for (const px of [0.5, -0.1]) {
    const pivot = new THREE.Group();
    pivot.position.set(px, 0.96, 1.1);
    const tilt = new THREE.Group();
    tilt.rotation.x = -0.86;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.6, 0.012), bladeMat);
    blade.position.y = 0.3;
    tilt.add(blade);
    pivot.add(tilt);
    group.add(pivot);
    blades.push(tilt);
  }
  return { mat, blades };
}

// ------------------------------------------------------------------ street

function bakeGlow(geo, lamps) {
  const p = geo.attributes.position;
  const gl = new Float32Array(p.count * 3);
  for (let v = 0; v < p.count; v++) {
    const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
    let r = 0, g = 0, b = 0;
    for (const L of lamps) {
      const d2 = (L.x - x) ** 2 + (L.z - z) ** 2;
      if (d2 > L.r * L.r) continue;
      const d = Math.sqrt(d2 + (L.y - y) ** 2 * 0.3);
      const f = Math.max(0, 1 - d / L.r);
      const k = f * f * L.i;
      r += L.c.r * k; g += L.c.g * k; b += L.c.b * k;
    }
    gl[v * 3] = r; gl[v * 3 + 1] = g; gl[v * 3 + 2] = b;
  }
  geo.setAttribute('glow', new THREE.BufferAttribute(gl, 3));
}

function glowMat(mat, strength = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlow;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * diffuseColor.rgb * ${strength.toFixed(2)};`);
  };
  mat.customProgramCacheKey = () => 'radio-glow' + strength;
  return mat;
}

function buildStreet(scene, rng) {
  const street = new THREE.Group();
  scene.add(street);
  const lamps = [];
  const lampAt = (x, y, z, color, r = 18, i = 1.2) => lamps.push({ x, y, z, c: new THREE.Color(color), r, i });
  // lamp posts along both sides
  const lampHeads = [];
  for (let z = -10; z < 260; z += 28) {
    for (const sx of [1, -1]) {
      const x = sx * 8.6, zz = z + (sx > 0 ? 14 : 0);
      lampAt(x - sx * 2, 8.2, zz, '#ffab52');
      lampHeads.push([x, zz, sx]);
    }
  }
  // cross street lamps
  lampAt(14, 8, 24, '#ffab52'); lampAt(-14, 8, 26, '#ffab52');
  // neon spill colors near shop fronts
  const neon = ['#ff2a6a', '#2ae0ff', '#ffb02a', '#7aff4a', '#c84aff'];
  for (let z = -20; z < 200; z += 11) {
    if (z > 16 && z < 34) continue;
    lampAt(rng() < 0.5 ? 10.5 : -10.5, 3, z, neon[Math.floor(rng() * neon.length)], 7, 0.7);
  }

  // road (with the cross street) as a dense grid so the lamp glow bakes in
  const rt = roadTextures(16, { lanes: 4, center: 'double-yellow', wet: true, worn: 0.4 });
  const roadG = new THREE.PlaneGeometry(16, 320, 16, 320);
  roadG.rotateX(-Math.PI / 2);
  roadG.translate(0, 0, 130);
  roadG.attributes.uv.array.forEach((v, k, arr) => { if (k % 2) arr[k] = v * 320 / 12; });
  bakeGlow(roadG, lamps);
  const roadMat = glowMat(new THREE.MeshStandardMaterial({ map: rt.map, roughnessMap: rt.rough, roughness: 1, envMapIntensity: 1.6 }), 3.2);
  street.add(new THREE.Mesh(roadG, roadMat));
  const crossG = new THREE.PlaneGeometry(200, 14, 100, 7);
  crossG.rotateX(-Math.PI / 2);
  crossG.translate(0, 0.004, 25);
  bakeGlow(crossG, lamps);
  const crossTex = roadTextures(14, { lanes: 2, center: 'double-yellow', wet: true });
  const crossMat = glowMat(new THREE.MeshStandardMaterial({ map: crossTex.map, roughness: 0.4, envMapIntensity: 1.4 }), 3.2);
  crossMat.map = crossTex.map.clone();
  crossMat.map.rotation = Math.PI / 2;
  crossMat.map.repeat.set(1, 200 / 12);
  crossMat.map.needsUpdate = true;
  street.add(new THREE.Mesh(crossG, crossMat));
  // crosswalk stripes
  const cw = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  const flat = (gb, cx, cz, w, d, y = 0.012) => {
    const V = (x, z) => new THREE.Vector3(x, y, z);
    gb.quad(V(cx - w / 2, cz + d / 2), V(cx + w / 2, cz + d / 2), V(cx + w / 2, cz - d / 2), V(cx - w / 2, cz - d / 2));
  };
  const cwB = new GeoBuilder();
  for (let k = -7; k <= 7; k++) flat(cwB, k * 1.0, 16.3, 0.6, 3);
  flat(cwB, -3.8, 14.2, 7.5, 0.45); // stop line
  street.add(new THREE.Mesh(cwB.build(), cw));

  // sidewalks + ground
  const walkMat = glowMat(new THREE.MeshStandardMaterial({ map: concreteTexture('#76756f', 'menu'), roughness: 0.5, envMapIntensity: 0.8 }), 1.2);
  for (const sx of [1, -1]) {
    for (const [z0, z1] of [[-40, 18], [32, 300]]) {
      const len = z1 - z0;
      const wg = new THREE.BoxGeometry(5, 0.18, len, 5, 1, Math.ceil(len / 2));
      wg.translate(sx * 10.5, 0.09, (z0 + z1) / 2);
      const uv = wg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.3, uv.getY(i) * len / 4);
      bakeGlow(wg, lamps);
      street.add(new THREE.Mesh(wg, walkMat));
    }
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: (() => { const t = groundTexture('asphaltlot'); t.repeat.set(80, 80); return t; })(), roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  street.add(ground);

  // buildings: both sides, gap for the cross street
  const styles = ['brick', 'concrete', 'glass', 'stucco', 'dark'];
  const bB = {};
  const shopB = [new GeoBuilder(), new GeoBuilder(), new GeoBuilder()];
  for (const sx of [1, -1]) {
    let z = -40;
    while (z < 300) {
      if (z > 12 && z < 36) { z = 36; continue; }
      const w = 10 + rng() * 18;
      const d = 18 + rng() * 14;
      const h = z > 60 ? 18 + rng() * 70 : 9 + rng() * 22;
      const st = styles[Math.floor(rng() * styles.length)];
      const key = st + Math.floor(rng() * 2);
      (bB[key] = bB[key] || new GeoBuilder()).box(sx * (13 + d / 2), -0.3, z + w / 2, d, h, w, 0, { uw: 14, uh: 40, top: false });
      // shopfront on the street face (normal toward the road)
      if (z + w < 300) {
        const fx = sx * 12.98, y0 = 0.15, y1 = 4.35, za = z + 0.3, zb = z + w - 0.3;
        const A = new THREE.Vector3(fx, y0, sx > 0 ? za : zb), B = new THREE.Vector3(fx, y0, sx > 0 ? zb : za);
        shopB[Math.floor(rng() * 3)].quad(A, B, new THREE.Vector3(B.x, y1, B.z), new THREE.Vector3(A.x, y1, A.z), [0, 0, Math.max(1, Math.round(w / 10)), 1]);
      }
      z += w + 0.5;
    }
  }
  for (const [key, gb] of Object.entries(bB)) {
    const st = key.slice(0, -1);
    const tx = facadeTextures(st, 'menu' + key.slice(-1));
    street.add(new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ map: tx.map, emissive: 0xffffff, emissiveMap: tx.emi, emissiveIntensity: 0.9, roughness: st === 'glass' ? 0.3 : 0.85 })));
  }
  shopB.forEach((gb, k) => {
    if (!gb.count) return;
    const shop = shopfrontTextures('menu' + k);
    street.add(new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ map: shop.map, emissive: 0xffffff, emissiveMap: shop.emi, emissiveIntensity: 1.2, roughness: 0.4 })));
  });
  // street lamp posts + heads
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffab52, emissiveIntensity: 3.5 });
  const halo = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#ffab52').multiplyScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const poleB = new GeoBuilder(), headB = new GeoBuilder(), haloB = new GeoBuilder();
  // the menu camera never moves: halos are flat cards turned toward the eye
  const card = (gb, cx, cy, cz, size) => {
    const toEye = new THREE.Vector3(EYE.x - cx, 0, EYE.z - cz).normalize();
    const side = new THREE.Vector3(toEye.z, 0, -toEye.x).multiplyScalar(size / 2);
    const up = new THREE.Vector3(0, size / 2, 0);
    const c = new THREE.Vector3(cx, cy, cz);
    gb.quad(c.clone().sub(side).sub(up), c.clone().add(side).sub(up), c.clone().add(side).add(up), c.clone().sub(side).add(up));
  };
  for (const [x, z, sx] of lampHeads) {
    poleB.cylinder(x, 0, z, 0.14, 8.4, 6, 0.1);
    poleB.box(x - sx * 1.2, 8.25, z, 2.4, 0.1, 0.1, 0);
    headB.box(x - sx * 2.2, 8.11, z, 0.9, 0.18, 0.5, 0);
    card(haloB, x - sx * 2.2, 8.0, z, 3);
  }
  street.add(new THREE.Mesh(poleB.build(), poleMat));
  street.add(new THREE.Mesh(headB.build(), headMat));
  const haloMesh = new THREE.Mesh(haloB.build(), new THREE.MeshBasicMaterial({ map: halo.map, color: halo.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  haloMesh.renderOrder = 4;
  street.add(haloMesh);
  // wet-road light streaks pointing at the (static) camera, one mesh
  const stB = new GeoBuilder();
  for (const L of lamps) {
    if (Math.abs(L.x) > 9.5) continue;
    const dz = L.z - EYE.z, dx = L.x - EYE.x;
    const dist = Math.hypot(dx, dz);
    const len = Math.min(26, dist * 0.55);
    const fx = -dx / dist, fz = -dz / dist;           // toward the eye
    const sxv = fz * 0.7, szv = -fx * 0.7;              // half width sideways
    const y = 0.03;
    // v = 0 under the lamp, 1 toward the viewer (the texture's convention)
    stB.setColor(L.c.r * 1.6, L.c.g * 1.6, L.c.b * 1.6);
    const A = new THREE.Vector3(L.x - sxv, y, L.z - szv), B = new THREE.Vector3(L.x + sxv, y, L.z + szv);
    const C2 = new THREE.Vector3(B.x + fx * len, y, B.z + fz * len), D = new THREE.Vector3(A.x + fx * len, y, A.z + fz * len);
    const up = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(D, A)).y > 0;
    if (up) stB.quad(A, B, C2, D, [0, 0, 1, 1]); else stB.quad(B, A, D, C2, [1, 0, 0, 1]);
  }
  const streaks = new THREE.Mesh(stB.build(true), new THREE.MeshBasicMaterial({ map: streakTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  streaks.renderOrder = 3;
  street.add(streaks);

  // traffic light on a mast arm over our lanes
  const sig = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 6.5, 8), poleMat);
  mast.position.set(-9.5, 3.25, 15.5);
  sig.add(mast);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(8, 0.14, 0.14), poleMat);
  armL.position.set(-5.5, 6.3, 15.5);
  sig.add(armL);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.6 }));
  housing.position.set(-2.5, 5.6, 15.5);
  sig.add(housing);
  const bulbs = [];
  const bulbCols = ['#ff2a1a', '#ffb21a', '#2aff8a'];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(bulbCols[k]).multiplyScalar(0.08) });
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), m);
    b.position.set(-2.5, 5.98 - k * 0.38, 15.32);
    b.rotation.y = Math.PI;
    sig.add(b);
    bulbs.push({ m, col: new THREE.Color(bulbCols[k]) });
  }
  const sigGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sigGlow.position.set(-2.5, 5.98, 15.25);
  sigGlow.scale.setScalar(1.6);
  sig.add(sigGlow);
  street.add(sig);

  return { street, bulbs, sigGlow, lamps };
}

// ------------------------------------------------------------------ build all

export function buildRadioScene(renderer) {
  const rng = makeRng('radio-menu');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d1426, 0.011);
  scene.background = new THREE.Color(0x060a16);
  scene.environment = getEnvMap(renderer, 'night');
  scene.add(new THREE.HemisphereLight(0x33447a, 0x0a0a10, 0.45));
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.18);
  moon.position.set(10, 30, 20);
  scene.add(moon);

  // sky dome (simple gradient + light pollution)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.07,0.045,0.08), vec3(0.008,0.014,0.04), smoothstep(0.0, 0.45, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);

  const car = new THREE.Group(); // interior moves with the idle shake
  scene.add(car);
  const interior = buildInterior(car, rng);
  const shield = buildWindshield(car);
  const streetParts = buildStreet(scene, rng);

  // dashboard glow for the cabin
  const dashLight = new THREE.PointLight(0x3a8aa8, 0.18, 1.2, 2);
  dashLight.position.set(0, 0.9, 0.3);
  car.add(dashLight);
  const ambientCab = new THREE.PointLight(0xffa860, 0.35, 3, 2);
  ambientCab.position.set(0.2, 1.4, 1.6);
  car.add(ambientCab);

  // parked cars along the far curb (real models, merged into a few meshes)
  const parkSrc = new THREE.Group();
  const parkHandles = [];
  ['m3', 'golfo', 'stallion'].forEach((id, k) => {
    const m = buildCarModel(CAR_BY_ID[id], { paint: ['#2a2f3a', '#7a1a1a', '#c8c8c0'][k] }, { interior: true });
    m.group.position.set(6.3, 0, 40 + k * 9);
    m.group.rotation.y = Math.PI;
    m.setLights(0, 0, 0);
    parkSrc.add(m.group);
    parkHandles.push(m);
  });
  const parkedGroup = new THREE.Group();
  for (const p of mergeByMaterial(parkSrc)) parkedGroup.add(new THREE.Mesh(p.geometry, p.material));
  for (const m of parkHandles) m.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  scene.add(parkedGroup);
  const parked = [{ group: parkedGroup }];

  const camera = new THREE.PerspectiveCamera(62, 4 / 3, 0.05, 900);
  camera.position.copy(EYE);
  camera.lookAt(-0.12, 0.84, 2.6);
  const baseQuat = camera.quaternion.clone();

  return { scene, camera, baseQuat, car, interior, shield, ...streetParts, parked };
}

export { EYE };
