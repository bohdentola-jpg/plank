// THE FINALE. Night 14 → dawn 15.
//  1. FLIGHT    Wade's little red chopper across the Bering Strait, a black
//               Northstar helicopter behind you: tracers, a missile, an ice
//               ridge between the Diomedes. QTEs: break left/right, dive,
//               climb, flares. Too many hits and you go down (flight restarts).
//  2. LANDING   Grisha's radio dies ("Border guards!"). Alone, you put her
//               down in the floodlit ring by the warehouse at Bely Mys.
//  3. WAREHOUSE Empty. Chairs over, tea spilled, the lamp still burning.
//               Lyosha's note. Baba Valya's doll.
//  4. CODE      Lyosha's laptop. The drive. Ten minutes: write unwrap(shards).
//  5. UPLINK    The dish on the roof turns; 06:00 comes; the lights stay on.
//  6. ARREST    Border guards.
//  7. JAIL      A cell, the sun going down over the strait, the team in the
//               next cells. Credits.
// The warehouse interior and the jail are both built around the origin; only
// one set is ever visible, so they share the space.
// QA: ?screen=finale&phase=flight|landing|warehouse|code|uplink|arrest|jail|credits  (&auto=1 plays itself)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, vText, actionGlyph, MONO_FONT, panel, paragraph } from '../core/ui.js';
import { createSky } from '../world/sky.js';
import { buildSea } from '../world/sea.js';
import { WU } from '../world/worldUniforms.js';
import { buildChopper } from '../world/chopper.js';
import { buildWarehouse } from './warehouseSet.js';
import { buildCharacter } from '../human/character.js';
import { Animator } from '../human/anim.js';
import { Director } from './director.js';
import { CAST } from '../data/cast.js';
import { playerDNA } from './warehouse.js';
import { voice } from '../audio/voice.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { getEnvMap } from '../core/envmap.js';
import { makeNoise2D, makeRng, smoothstep, wrapAngle, clamp } from '../core/util.js';
import { openLaptop } from '../screens/laptop.js';
import { CHALLENGES } from '../code/challenges.js';
import { newState, game$ } from '../game/state.js';
import { store } from '../core/settings.js';
import { LINES as FIN } from '../data/script/finale.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const noise = makeNoise2D(1867);
const GY = 0.4;                     // Bely Mys ground height
const PAD = V(26, GY, -6358);       // the floodlit landing ring
const SHED = V(0, GY, -6372);       // the warehouse (26 × 16, door on the east wall)
const RIDGE_Z = -3160, RIDGE_TOP = 78;
const SPEED = 58;

// ------------------------------------------------------------------ helpers
let _soft;
function softTex() {
  if (_soft) return _soft;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _soft = new THREE.CanvasTexture(c);
  return _soft;
}

/** A pool of soft sprites: smoke, sparks, flares, explosions. */
class Puffs {
  constructor(parent, n, additive) {
    this.list = [];
    this.i = 0;
    for (let k = 0; k < n; k++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTex(), transparent: true, depthWrite: false, opacity: 0,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      m.visible = false;
      parent.add(m);
      this.list.push({ m, life: 0, max: 1, v: new THREE.Vector3(), s0: 1, s1: 1, a: 1, g: 0 });
    }
  }
  emit(p, o = {}) {
    const P = this.list[this.i++ % this.list.length];
    P.m.position.copy(p);
    P.v.copy(o.v || V(0, 0, 0));
    P.life = 0; P.max = o.life ?? 1; P.s0 = o.s0 ?? 1; P.s1 = o.s1 ?? 3; P.a = o.a ?? 0.6; P.g = o.g ?? 0;
    P.m.material.color.copy(o.color || new THREE.Color(1, 1, 1));
    P.m.scale.setScalar(P.s0);
    P.m.visible = true;
    return P;
  }
  update(dt) {
    for (const P of this.list) {
      if (!P.m.visible) continue;
      P.life += dt;
      const k = P.life / P.max;
      if (k >= 1) { P.m.visible = false; continue; }
      P.v.y -= P.g * dt;
      P.m.position.addScaledVector(P.v, dt);
      P.m.scale.setScalar(P.s0 + (P.s1 - P.s0) * k);
      P.m.material.opacity = P.a * (1 - k) * Math.min(1, P.life * 10);
    }
  }
  clear() { for (const P of this.list) P.m.visible = false; }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** One of the Diomedes: steep cliffs, a snowy plateau. */
function island(radius, height, seed) {
  const g = new THREE.SphereGeometry(1, 96, 40);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const r = radius * (1 + noise.fbm(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + seed, 4) * 0.45);
    const hy = y < 0 ? -40 : Math.pow(y, 0.3) * height * (1 + noise.fbm(x * 2.5 + seed, z * 2.5, 3) * 0.3);
    p.setXYZ(i, x * r, hy, z * r);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const s = smoothstep(0.5, 0.75, n.getY(i));
    const rock = 0.09 + Math.abs(noise(p.getX(i) * 0.01, p.getY(i) * 0.03)) * 0.08;
    col[i * 3] = rock + (0.78 - rock) * s;
    col[i * 3 + 1] = rock + (0.83 - rock) * s;
    col[i * 3 + 2] = rock + 0.02 + (0.9 - rock) * s;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
}

/** The pressure ridge between the islands: a wall of broken ice you have to climb over. */
function iceRidge() {
  const rng = makeRng(404);
  const parts = [];
  for (let i = 0; i < 34; i++) {
    const x = -520 + i * 32 + (rng() - 0.5) * 20;
    const hgt = Math.abs(x) < 140 ? 64 + rng() * 14 : 25 + rng() * 45;
    const g = new THREE.IcosahedronGeometry(1, 0);
    g.scale(20 + rng() * 18, hgt, 14 + rng() * 14);
    g.rotateY(rng() * Math.PI);
    g.translate(x, hgt * 0.15, RIDGE_Z + (rng() - 0.5) * 30);
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa8cede, roughness: 0.3, flatShading: true, emissive: 0x16303c }));
}

/** A troposcatter dish on a little mast. head.rotation: x = elevation, y = azimuth. */
function dish(r = 2.4) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.6, metalness: 0.5 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.8, 10), dark);
  mast.position.y = 0.9;
  g.add(mast);
  const head = new THREE.Group();
  head.position.y = 1.9;
  head.rotation.order = 'YXZ';
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 10, 0, Math.PI * 2, 0, 0.55), metal);
  bowl.rotation.x = -Math.PI / 2;          // opening faces +z
  bowl.position.z = -r * 0.85;
  head.add(bowl);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, r * 0.9, 6), dark);
  feed.rotation.x = Math.PI / 2;
  feed.position.z = -r * 0.85 + r * 0.55;
  head.add(feed);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 0.8) }));
  tip.position.z = -r * 0.85 + r;
  head.add(tip);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 9, 900, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 450),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.z = tip.position.z;
  head.add(beam);
  g.add(head);
  return { group: g, head, tip, beam };
}

/** Bely Mys: a snowy shore, the fish warehouse with the dish on its roof, a floodlight, a village. */
function belyMys() {
  const g = new THREE.Group();
  // the land rises inland
  const land = new THREE.PlaneGeometry(3400, 1600, 110, 50);
  land.rotateX(-Math.PI / 2);
  land.translate(0, 0, -7080);
  const p = land.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const shore = -6300 + noise.fbm(x * 0.004, 3.3, 3) * 40;
    const inland = shore - z;
    let y;
    if (inland < 0) y = -3;
    else {
      y = GY + smoothstep(0, 12, inland) * 0.3 + smoothstep(250, 1100, inland) * (40 + noise.fbm(x * 0.003, z * 0.003, 4) * 60);
      y += noise.fbm(x * 0.02, z * 0.02, 3) * Math.min(1, inland / 60) * 1.2;
    }
    // keep the yard flat
    const fy = Math.max(Math.abs(x - 10) - 70, Math.abs(z - SHED.z) - 45);
    if (fy < 0) y = GY;
    else if (fy < 20) y = GY + (y - GY) * (fy / 20);
    p.setY(i, y);
  }
  land.computeVertexNormals();
  const snow = new THREE.MeshStandardMaterial({ color: 0xc4ced8, roughness: 0.93 });
  const ground = new THREE.Mesh(land, snow);
  ground.receiveShadow = true;
  g.add(ground);

  // the warehouse
  const corr = new THREE.MeshStandardMaterial({ color: 0x4a524c, roughness: 0.7, metalness: 0.35 });
  const shed = new THREE.Mesh(new THREE.BoxGeometry(26, 7.5, 16), corr);
  shed.position.set(SHED.x, GY + 3.75, SHED.z);
  shed.castShadow = true; shed.receiveShadow = true;
  g.add(shed);
  const roofSnow = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.3, 16.4), snow);
  roofSnow.position.set(SHED.x, GY + 7.65, SHED.z);
  g.add(roofSnow);
  // roll-up door on the east wall, a warm strip of light under it
  const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.5), new THREE.MeshStandardMaterial({ color: 0x5e6660, roughness: 0.6, metalness: 0.4 }));
  door.rotation.y = Math.PI / 2;
  door.position.set(SHED.x + 13.02, GY + 2.25, SHED.z + 3);
  g.add(door);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 4.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.8) }));
  strip.position.set(SHED.x + 13.04, GY + 0.05, SHED.z + 3);
  g.add(strip);
  const doorGlow = new THREE.PointLight(0xffb070, 6, 8, 2);
  doorGlow.position.set(SHED.x + 13.6, GY + 0.4, SHED.z + 3);
  g.add(doorGlow);
  // the neon fish sign
  const signTex = canvasTex(256, 80, (c, w, h) => {
    c.font = 'bold 60px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 6; c.strokeStyle = '#fff'; c.strokeText('РЫБА', w / 2, h / 2);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(8, 0.6, 0.45), transparent: true, depthWrite: false }));
  sign.rotation.y = Math.PI / 2;
  sign.position.set(SHED.x + 13.05, GY + 5.4, SHED.z - 3);
  g.add(sign);
  // the floodlight
  const lampAt = V(16, GY + 9.2, -6345);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 9.2, 8), new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.6, metalness: 0.5 }));
  pole.position.set(lampAt.x, GY + 4.6, lampAt.z);
  g.add(pole);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.6, 7.6) }));
  lampHead.position.copy(lampAt);
  lampHead.lookAt(PAD);
  g.add(lampHead);
  const flood = new THREE.SpotLight(0xfff0d8, 520, 60, 0.62, 0.6, 2);
  flood.position.copy(lampAt).add(V(0, -0.2, 0));
  flood.target.position.copy(PAD);
  flood.castShadow = true;
  flood.shadow.mapSize.set(1024, 1024);
  flood.shadow.bias = -0.0005;
  g.add(flood, flood.target);
  // a faint cone in the cold air
  const from = flood.position.clone(), to = PAD.clone();
  const len = from.distanceTo(to);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6.5, len, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.21, 0.19), transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.copy(from).lerp(to, 0.5);
  cone.quaternion.setFromUnitVectors(V(0, 1, 0), from.clone().sub(to).normalize());
  g.add(cone);
  // the landing ring (pulses during the landing)
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.4, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.3), transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(PAD).add(V(0, 0.03, 0));
  ring.visible = false;
  g.add(ring);
  // the village: little houses, warm windows
  const rng = makeRng(77);
  const walls = [], roofs = [], wins = [];
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 34; i++) {
    let x = -460 + rng() * 920;
    if (Math.abs(x - 5) < 70) x += 150 * Math.sign(x - 5 || 1);
    const z = -6410 - rng() * 300;
    const w = 5 + rng() * 3, d = 7 + rng() * 3, h = 2.8 + rng() * 1.2, rot = (rng() - 0.5) * 0.5;
    mtx.compose(V(x, GY, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rot), V(1, 1, 1));
    walls.push(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).applyMatrix4(mtx));
    const r = (w / 2 + 0.35) / 0.866;
    roofs.push(new THREE.CylinderGeometry(r, r, d + 0.6, 3).rotateX(-Math.PI / 2).translate(0, h + 0.5 * r, 0).applyMatrix4(mtx));
    for (const s of [-1, 1]) {
      if (rng() < 0.35) continue;
      wins.push(new THREE.PlaneGeometry(0.9, 0.75).translate(s * w * 0.25, h * 0.55, d / 2 + 0.03).applyMatrix4(mtx));
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(walls), new THREE.MeshStandardMaterial({ color: 0x6a5e50, roughness: 0.85 })));
  g.add(new THREE.Mesh(mergeGeometries(roofs), snow));
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.1, 0.9) });
  g.add(new THREE.Mesh(mergeGeometries(wins), winMat));
  // the dish on the roof
  const dsh = dish(2.3);
  dsh.group.position.set(SHED.x + 6, GY + 7.8, SHED.z - 2);
  dsh.head.rotation.set(-0.35, 0.6, 0);
  g.add(dsh.group);
  return { group: g, ring, dish: dsh, winMat, door, flood };
}

/** The holding cells: four cells in a row, barred windows on the back wall, the sun going down outside. */
function jailSet() {
  const g = new THREE.Group();
  const wallLow = new THREE.MeshStandardMaterial({ color: 0x4e6458, roughness: 0.7 });
  const wallHigh = new THREE.MeshStandardMaterial({ color: 0xcfcab8, roughness: 0.9 });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.8 });
  const bars = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.35, metalness: 0.85 });
  const L = 14, D = 3.6, Hh = 3.2, back = -D / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, D + 4), floorM);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 2;
  floor.receiveShadow = true;
  g.add(floor);
  const cells = [];
  const solid = (w, h, d, x, y, z, m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
    return b;
  };
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 });
  const wool = new THREE.MeshStandardMaterial({ color: 0x3e4a3a, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const cx = -L / 2 + 1.75 + i * 3.5;
    cells.push(cx);
    // back wall with a window gap (x ± 0.5, y 1.45 … 2.35)
    solid(3.5, 1.45, 0.3, cx, 0.725, back, wallLow);
    solid(3.5, 0.85, 0.3, cx, 2.775, back, wallHigh);
    for (const s of [-1, 1]) solid(1.25, 0.9, 0.3, cx + s * 1.125, 1.9, back, wallHigh);
    for (let k = -2; k <= 2; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), bars);
      b.position.set(cx + k * 0.2, 1.9, back);
      b.castShadow = true;
      g.add(b);
    }
    // front bars
    for (let k = 0; k < 16; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, Hh, 6), bars);
      b.position.set(cx - 1.65 + k * 0.22, Hh / 2, D / 2);
      b.castShadow = true;
      g.add(b);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 0.06), bars);
    rail.position.set(cx, 1.1, D / 2);
    g.add(rail);
    // dividing wall, a bunk with a grey blanket
    solid(0.2, Hh, D, cx + 1.75, Hh / 2, 0, wallLow);
    solid(0.8, 0.1, 1.9, cx + 1.15, 0.45, -0.3, wood);
    solid(0.78, 0.07, 1.5, cx + 1.15, 0.53, -0.15, wool);
    for (const z of [-1.15, 0.55]) solid(0.06, 0.45, 0.06, cx + 1.45, 0.225, z, bars);
  }
  solid(0.2, Hh, D, -L / 2, Hh / 2, 0, wallLow);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(L, D + 4), wallHigh);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, Hh, 2);
  g.add(ceil);
  solid(L, Hh, 0.2, 0, Hh / 2, D / 2 + 2.2, wallHigh);   // corridor wall
  // the sunset: a painted sky far behind the windows, the low sun in it
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float t;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 top = vec3(0.16, 0.22, 0.45), hor = vec3(2.4, 1.15, 0.45), sea = vec3(0.10, 0.09, 0.13);
        float h = vUv.y, horizon = 0.40;
        vec3 c = h > horizon ? mix(hor, top, pow(smoothstep(horizon, 1.0, h), 0.6)) : mix(sea, hor * 0.5, pow(smoothstep(0.0, horizon, h), 2.0));
        vec2 sp = vec2(0.47, horizon + 0.035);
        float sd = length((vUv - sp) * vec2(2.65, 1.0));
        c += vec3(7.0, 3.6, 1.3) * smoothstep(0.035, 0.028, sd) + vec3(1.6, 0.6, 0.2) * exp(-sd * 7.0);
        float cl = smoothstep(0.55, 0.85, sin(vUv.x * 9.0 + sin(vUv.y * 20.0)) * 0.5 + 0.5) * smoothstep(0.45, 0.6, h) * smoothstep(0.85, 0.6, h);
        c = mix(c, vec3(1.6, 0.7, 0.5), cl * 0.35);
        if (h < horizon) {
          float lane = smoothstep(0.07, 0.0, abs(vUv.x - sp.x) * (1.0 + (horizon - h) * 6.0));
          float sp2 = step(0.82, h21(floor(vUv * vec2(160.0, 90.0)) + floor(t * 6.0)));
          c += vec3(3.0, 1.5, 0.5) * lane * sp2;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.position.set(0, 3.5, -30);
  g.add(sky);
  const sun = new THREE.DirectionalLight(0xffa458, 2.6);
  sun.position.set(-1.5, 3.4, -14);
  sun.target.position.set(0, 0.6, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera;
  sc.left = -9; sc.right = 9; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 40;
  g.add(sun, sun.target);
  g.add(new THREE.HemisphereLight(0xffc8a0, 0x2a2228, 0.35));
  const bulb = new THREE.PointLight(0xfff0d0, 0.6, 6, 2);
  bulb.position.set(0, 3.0, 2.6);
  g.add(bulb);
  const fill = new THREE.PointLight(0xffe2c4, 0.9, 3.5, 2);   // rides with the camera
  g.add(fill);
  return { group: g, sky, cells, fill };
}

function guardDNA(seed, officer) {
  const camo = { pattern: 'camo', color: '#3e4636', color2: '#272c22', color3: '#5c5e4c' };
  return {
    seed, sex: 1, age: officer ? 41 : 24 + (seed % 9), muscle: 0.62, weight: officer ? 0.56 : 0.48, height: officer ? 1.02 : 1.0,
    ethnic: { caucasian: 0.85, asian: 0.15 }, skin: { tone: 0.17, rosy: 0.55 },
    hair: { style: 'buzz', color: officer ? '#4a3a2a' : '#6a5038' }, brows: { color: '#3a2a1a', density: 0.8, thickness: 0.5 },
    eyes: { color: '#4a5a6a' }, beard: { style: officer ? 'moustache' : 'none', color: '#3a2a1a', stubble: 0.5 },
    outfit: [
      { slot: 'top', ...camo, color: '#4a5240', thick: 0.007, hem: 'hip' },
      { slot: 'coat', ...camo, thick: 0.014, puff: 0.01, hem: 'hip', neckUp: 0.03 },
      { slot: 'bottom', ...camo, thick: 0.007 },
      { slot: 'boots', pattern: 'leather', color: '#0e0c0a', thick: 0.014, shaft: 0.32 },
    ],
  };
}

const QTE = {
  left: { prompt: 'BREAK LEFT', action: 'left', line: 'f.g.left' },
  right: { prompt: 'BREAK RIGHT', action: 'right', line: 'f.g.right' },
  dive: { prompt: 'DIVE', action: 'down', line: 'f.g.down' },
  climb: { prompt: 'CLIMB', action: 'up', line: 'f.g.up' },
  flares: { prompt: 'FLARES', action: 'interact', line: 'f.g.flares' },
};

// seconds into the flight → what happens
const SCRIPT = [
  [3, 'radio1'], [9, 'behind'], [14, 'left'], [21, 'right'], [27, 'dive'], [34, 'flares'], [40, 'right'],
  [45, 'islands'], [50, 'climb'], [58, 'left'], [63, 'flares'], [69, 'dive'], [75, 'right'], [80, 'border'],
  [86, 'landline'], [93, 'guards'], [99, 'land'],
];
// where the black helicopter hangs, relative to you: [t, dx, dy, dz] (it shoots from the side you break away from)
const PURSUIT = [
  [0, 0, 40, 420], [8, 0, 22, 110], [11, 6, 16, -30], [13.5, 26, 6, 6], [20, 24, 4, 8], [22, -26, 6, 6], [26.5, -22, 8, 10],
  [28, 0, 26, 22], [33, 0, 18, 60], [39, -22, 6, 10], [44, -30, 10, 30], [49, 0, 30, 40], [56, 24, 8, 6], [62, 0, 20, 70],
  [68, 0, 28, 20], [74, -24, 6, 6], [79, -20, 10, 30], [80, 0, 30, 120], [100, 0, 60, 900],
];
function pursuerOffset(t) {
  let i = 0;
  while (i < PURSUIT.length - 2 && PURSUIT[i + 1][0] < t) i++;
  const a = PURSUIT[i], b = PURSUIT[i + 1];
  const k = smoothstep(a[0], b[0], t);
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}
const RADIO = { radio1: 'f.g.radio1', behind: 'f.g.behind', islands: 'f.g.islands', border: 'f.g.border', landline: 'f.g.land' };

const CREDITS = [
  ['COLD BOOT', 'title'], ['ХОЛОДНЫЙ ПУСК', 'sub'], ['', ''],
  ['Six people at a table in a fish warehouse.', ''],
  ['One stranger they pulled out of the sea.', ''],
  ['Fourteen days. One small town. The whole world.', ''],
  ['Nobody will ever know.', ''], ['', ''],
  ['— THE TEAM —', 'head'],
  ['Dmitri Volkov', ''], ['Nadia Sokolova', ''], ['Lyosha Orlov', ''], ['Grisha Bondarenko', ''], ['Baba Valya', ''], ['Ivan Tikhonov', ''],
  ['and Rybka', ''], ['', ''],
  ['— PORT ZARYA, ALASKA —', 'head'],
  ['Sasha Koshkin · Dolly Finch · Hank Brubaker', ''], ['Ruth Aqpik · Ray Moody · Lyle Pruitt', ''],
  ['Father Gabriel · Chief Marta Kowalczyk · Nina', ''], ['Wade Tolliver · Lou Amarok · Tommy Aqpik', ''],
  ['Doc Ellen Haverford · Pearl Jessup', ''], ['Mayor Walt Hennessey · Gideon Shaw · Evan Pike', ''],
  ['Special Agent Daniel Okafor', ''], ['and Cyrus Halloran', ''], ['', ''],
  ['— MADE WITH —', 'head'],
  ['three.js', ''], ['People grown from the MakeHuman base mesh (CC0)', ''], ['Voices: Silero & Piper neural speech', ''],
  ['Textures: Poly Haven & ambientCG (CC0)', ''], ['Everything else: code', ''], ['', ''],
  ['Thank you for playing.', 'head'], ['', ''], ['', ''],
  ['Тихо.', 'title'],
];
const CREDIT_ROW = 44, CREDIT_SPEED = 26;

registerScreen('finale', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 12000);
  const AUTO = game.query.has('auto');
  const prof = store.load('profile') || {};
  const S = game$.s || newState(prof);
  const lessons = ['flight1', 'flight2', 'flight3'].filter((f) => S.flags?.[f]).length;
  const WINDOW = 1.5 + lessons * 0.2;             // Wade's lessons buy you time
  const MAX_HITS = 3 + (lessons >= 2 ? 1 : 0);

  let phase = 'load', t = 0, pt = 0, d, sky, sea, me, them, outside, inside, jail, bm, wh;
  let hits = 0, events = [], qte = null, msg = null, tracers = [], missile = null, smoke, fire;
  let press = null, codeG = null, uplink = null, briefing = null, credits = 0, clock = null, controlsHint = 0;
  let resolvePhase = null, rotor = 1, doorLight = null;
  let doorOpen = 0, dollOpen = 0, dishTurn = 0, blink = 0, sent = '', leftAt = 0, lastCode = null;
  const pos = V(0, 45, 0);
  let lateral = 0, alt = 45, shake = 0, vs = 0, landT = 0, gust = 0, ridgePassed = false, crashing = false;
  const actors = {};
  const walkers = new Set();
  const turners = new Set();
  const torches = [];
  const tracerMeshes = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 5, 1.4) });
  const tracerGeo = new THREE.BoxGeometry(0.14, 0.14, 7);
  let slip, dollTop;

  const say = (who, id, o = {}) => d.say(who, id, { listeners: [], ...o });
  const radio = (id) => { voice.stopAll(); return d.say('grisha', id, { listeners: [], radio: true }); };
  const wait = (s) => d.wait(s);
  const phaseDone = () => new Promise((r) => { resolvePhase = r; });
  const finishPhase = () => { const r = resolvePhase; resolvePhase = null; r?.(); };
  const waitPress = (action, label, timeout = Infinity) => new Promise((resolve) => {
    press = { action, label, resolve, t: 0, timeout: AUTO ? 1.5 : timeout };
  });

  // ---------------------------------------------------------------- people
  function walk(id, pts, speed = 1.3) {
    const a = actors[id];
    return new Promise((resolve) => walkers.add({ a, pts: pts.map((p) => p.clone()), speed, resolve }));
  }
  function updateWalkers(dt) {
    for (const w of walkers) {
      const g = w.a.ch.group;
      const tgt = w.pts[0];
      const dx = tgt.x - g.position.x, dz = tgt.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.06) {
        w.pts.shift();
        if (!w.pts.length) { w.a.anim.targetSpeed = 0; walkers.delete(w); w.resolve(); }
        continue;
      }
      const step = Math.min(dist, w.speed * dt * Math.min(1, w.a.anim.speed / w.speed + 0.35));
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.rotation.y += wrapAngle(Math.atan2(dx, dz) - g.rotation.y) * Math.min(1, dt * 7);
      w.a.anim.targetSpeed = w.speed;
    }
  }
  function turn(id, yaw, dur = 0.8) {
    const g = actors[id].ch.group;
    const from = g.rotation.y, delta = wrapAngle(yaw - from);
    let k = 0;
    return new Promise((resolve) => {
      turners.add({ step(dt) { k = Math.min(1, k + dt / dur); g.rotation.y = from + delta * smoothstep(0, 1, k); if (k >= 1) { resolve(); return true; } return false; } });
    });
  }
  const yawTo = (id, p) => { const g = actors[id].ch.group.position; return Math.atan2(p.x - g.x, p.z - g.z); };

  function handsUp(an) {
    let k = 0;
    an.override = (pose, a, dt) => {
      k = Math.min(1, k + dt * 1.6);
      const e = smoothstep(0, 1, k);
      for (const [side, s] of [['L', 1], ['R', -1]]) {
        const u = pose[`upperarm01.${side}`]?.aim || [s * 0.1, -1, 0];
        const l = pose[`lowerarm01.${side}`]?.aim || [s * 0.05, -1, 0.1];
        const U = [s * 0.95, 0.3, 0.12], L2 = [s * 0.12, 1, 0.08];
        pose[`upperarm01.${side}`] = { aim: u.map((v, i) => v + (U[i] - v) * e) };
        pose[`lowerarm01.${side}`] = { aim: l.map((v, i) => v + (L2[i] - v) * e), tw: s * -20 * e };
        pose[`wrist.${side}`] = { e: [0, 0, 0] };
      }
    };
  }

  async function makeActor(id, dna, parent) {
    const ch = await buildCharacter(dna);
    parent.add(ch.group);
    const an = new Animator(ch);
    actors[id] = { id, ch, anim: an };
    d.addActor(id, ch, an);
    return actors[id];
  }
  function seat(id, x, z, rot, h = 0.47) {
    const a = actors[id];
    a.ch.group.position.set(x, 0, z);
    a.ch.group.rotation.y = rot;
    a.anim.setPosture('sit');
    a.anim.postureW.sit = 1; a.anim.postureW.stand = 0;
    a.anim.sitHeight = h;
  }
  function place(id, x, z, rot) {
    const a = actors[id];
    a.ch.group.position.set(x, 0, z);
    a.ch.group.rotation.y = rot;
    a.anim.setPosture('stand');
    a.anim.postureW.sit = 0; a.anim.postureW.stand = 1;
  }
  const moveTo = (id, parent) => { parent.add(actors[id].ch.group); actors[id].ch.group.visible = true; };

  // ---------------------------------------------------------------- sets
  function show(which) {
    d.setFill(which === 'inside' ? 0.5 : which === 'jail' ? 0.25 : 0);
    outside.visible = which === 'outside';
    inside.visible = which === 'inside';
    jail.group.visible = which === 'jail';
    if (which === 'outside') {
      scene.environment = getEnvMap(game.renderer.gl, 'night');
      scene.environmentIntensity = 0.25;
      scene.fog = new THREE.FogExp2(0x061018, 0.0006);
      scene.background = null;
    } else if (which === 'inside') {
      scene.environment = getEnvMap(game.renderer.gl, 'interior');
      scene.environmentIntensity = 0.25;
      scene.fog = new THREE.FogExp2(0x0a0c0e, 0.04);
      scene.background = new THREE.Color(0x020304);
    } else {
      scene.environment = getEnvMap(game.renderer.gl, 'sunset');
      scene.environmentIntensity = 0.35;
      scene.fog = null;
      scene.background = new THREE.Color(0x1a1418);
    }
  }
  function postFor(which, letterbox) {
    const P = which === 'outside'
      ? { exposure: 1.15, bloomStrength: 0.95, vignette: 0.6, saturation: 1.0, lift: [0.0, 0.01, 0.02], grain: 0.05, letterbox: 0 }
      : which === 'inside'
        ? { exposure: 1.05, bloomStrength: 0.85, bloomThreshold: 1.1, vignette: 0.7, saturation: 0.92, contrast: 1.06, lift: [0.012, 0.008, 0.012], gain: [1.02, 0.98, 0.94], grain: 0.05, letterbox: 1 }
        : { exposure: 1.0, bloomStrength: 1.0, vignette: 0.62, saturation: 1.08, contrast: 1.04, gain: [1.05, 0.98, 0.9], grain: 0.04, letterbox: 1 };
    if (letterbox !== undefined) P.letterbox = letterbox;
    game.renderer.setPost(P, true);
  }

  // ================================================================ 1. FLIGHT
  function resetFlight() {
    t = 0; hits = 0; lateral = 0; alt = 45; pos.set(0, 45, 0); qte = null; tracers = []; ridgePassed = false; crashing = false;
    if (missile) { missile.mesh.removeFromParent(); missile = null; }
    events = SCRIPT.map((e) => ({ at: e[0], kind: e[1], fired: false }));
    smoke.clear(); fire.clear();
    them.group.position.set(0, 80, 500);
    camera.position.set(pos.x + 14, pos.y + 2, pos.z - 12);
    controlsHint = 9;
    msg = { text: 'BERING STRAIT  ·  05:31', sub: 'Wormwood wakes at 06:00. The drive is in your pocket.', t: 0 };
  }

  function fireBurst(aim, spread = 1) {
    try { sfx.gunfire(12, Math.min(1, them.group.position.distanceTo(pos) / 160)); } catch { /* */ }
    for (let i = 0; i < 12; i++) {
      const target = aim.clone().add(V((Math.random() - 0.5) * 14 * spread, (Math.random() - 0.5) * 8 * spread, (Math.random() - 0.5) * 10));
      tracers.push({ p: them.group.position.clone().add(V(0, 0.6, 0)), v: target.sub(them.group.position).normalize().multiplyScalar(430), life: 1.3, delay: i * 0.06 });
    }
  }

  function takeHit() {
    hits++;
    shake = 1.3;
    game.fx.flash = 0.4;
    game.fx.flashColor = new THREE.Color(1, 0.35, 0.1);
    for (let i = 0; i < 10; i++) fire.emit(pos.clone().add(V(0, 1.4, 0)), { v: V((Math.random() - 0.5) * 18, Math.random() * 12, (Math.random() - 0.5) * 18), life: 0.6, s0: 0.6, s1: 0.2, a: 1, g: 20, color: new THREE.Color(6, 2.6, 0.6) });
    try { sfx.impact(0.8, 'car'); } catch { /* */ }
    input.rumble?.(1, 0.8, 350);
    radio('f.g.hit');
    if (hits >= MAX_HITS && !crashing) crash();
  }

  async function crash() {
    crashing = true;
    qte = null;
    msg = { text: 'DOWN IN THE ICE', sub: 'The flight starts over.', t: 0 };
    game.renderer.tweakPost({ fade: 1 });
    await wait(2.2);
    resetFlight();
    game.renderer.tweakPost({ fade: 0 });
  }

  function flightUpdate(dt) {
    t += dt;
    controlsHint = Math.max(0, controlsHint - dt);
    let mx = input.move.x, my = input.move.y;
    if (AUTO && qte) {
      if (qte.kind === 'left') mx = -1;
      if (qte.kind === 'right') mx = 1;
      if (qte.kind === 'dive') my = -1;
      if (qte.kind === 'climb') my = 1;
    }
    if (!crashing) {
      lateral = clamp(lateral + mx * dt * 36, -70, 70);
      alt = clamp(alt + my * dt * 32, 9, 150);
      pos.z -= SPEED * dt;
    }
    pos.x += (lateral - pos.x) * Math.min(1, dt * 2.4);
    pos.y += (alt - pos.y) * Math.min(1, dt * 2.0);
    // the ridge is real ice
    if (!ridgePassed && pos.z < RIDGE_Z + 8) {
      ridgePassed = true;
      if (pos.y < RIDGE_TOP) { alt = Math.max(alt, RIDGE_TOP + 14); pos.y = RIDGE_TOP + 4; takeHit(); }
    }
    const bank = clamp((lateral - pos.x) * 0.014, -0.55, 0.55);
    const pitch = 0.12 + clamp((alt - pos.y) * -0.006, -0.25, 0.25);
    me.group.position.copy(pos);
    me.group.rotation.set(pitch, Math.PI, bank, 'YXZ');
    me.update(dt, 1);
    if (hits > 0 && Math.random() < dt * 14 * hits) smoke.emit(pos.clone().add(V(0, 1.9, 1.2)), { v: V((Math.random() - 0.5) * 2, 2, SPEED * 0.6), life: 2.2, s0: 1.2, s1: 6, a: 0.45, color: new THREE.Color(0.12, 0.12, 0.13) });

    // the pursuer: closes in, shows itself, swings out to either side to shoot
    const off = pursuerOffset(t);
    const tp = V(pos.x + off[0], pos.y + off[1], pos.z + off[2]);
    them.group.position.lerp(tp, Math.min(1, dt * 1.6));
    them.group.lookAt(pos);
    them.update(dt, 1);
    if (them.spot) them.spot.target.position.copy(them.group.worldToLocal(pos.clone()));
    if (t > 10 && t < 79 && Math.random() < dt * 0.3) fireBurst(pos.clone().add(V((Math.random() < 0.5 ? -1 : 1) * 18, 6, -20)), 1.4);

    // camera: a side shot to open, then the chase
    shake = Math.max(0, shake - dt * 1.2);
    const intro = 1 - smoothstep(2.5, 5, t);
    const cp = V(pos.x + (pos.x - lateral) * 0.2, pos.y + 3.6, pos.z + 12.5).lerp(V(pos.x + 15, pos.y + 1.5, pos.z - 10), intro);
    camera.position.lerp(cp, Math.min(1, dt * (intro > 0.01 ? 8 : 4)));
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    camera.lookAt(V(pos.x, pos.y + 1.5, pos.z - 30).lerp(V(pos.x, pos.y + 1.3, pos.z), intro));
    camera.fov = 60;
    camera.updateProjectionMatrix();
    sea.mesh.position.set(pos.x, 0, pos.z - 1500);

    // tracers
    let ti = 0;
    for (const tr of tracers) {
      if (tr.delay > 0) { tr.delay -= dt; continue; }
      tr.p.addScaledVector(tr.v, dt);
      tr.life -= dt;
      const m = tracerMeshes[ti++];
      if (m && tr.life > 0) { m.visible = true; m.position.copy(tr.p); m.lookAt(tr.p.clone().add(tr.v)); }
    }
    for (; ti < tracerMeshes.length; ti++) tracerMeshes[ti].visible = false;
    tracers = tracers.filter((x) => x.life > 0);

    // a missile: homes on you, or on the flares
    if (missile) {
      missile.t += dt;
      const target = missile.flare ? missile.flare.m.position : pos.clone().add(V(0, 1.2, 0));
      const left = Math.max(0.05, missile.eta - missile.t);
      missile.p.lerp(target, Math.min(1, dt / left));
      missile.mesh.position.copy(missile.p);
      missile.mesh.lookAt(target);
      fire.emit(missile.p, { life: 0.25, s0: 1.6, s1: 0.5, a: 1, color: new THREE.Color(5, 3, 1.4) });
      smoke.emit(missile.p, { v: V(0, 0.5, 0), life: 1.6, s0: 0.6, s1: 3, a: 0.3, color: new THREE.Color(0.5, 0.5, 0.52) });
      if (missile.t >= missile.eta) {
        for (let i = 0; i < 16; i++) fire.emit(missile.p, { v: V((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30), life: 0.8, s0: 3, s1: 7, a: 1, color: new THREE.Color(7, 3, 0.8) });
        game.fx.flash = Math.max(game.fx.flash, missile.flare ? 0.15 : 0.4);
        try { sfx.explosion(missile.flare ? 0.5 : 0.9); } catch { /* */ }
        missile.mesh.removeFromParent();
        missile = null;
      }
    }

    // the script
    for (const e of events) {
      if (e.fired || t < e.at || crashing) continue;
      e.fired = true;
      if (QTE[e.kind]) {
        const q = QTE[e.kind];
        const extra = e.kind === 'climb' || e.kind === 'dive' ? 2.4 : e.kind === 'flares' ? 0.3 : 0;
        qte = { ...q, kind: e.kind, t: 0, start: { x: pos.x, y: pos.y }, ok: false, window: WINDOW + extra };
        radio(q.line);
        if (e.kind === 'left') fireBurst(pos.clone().add(V(4, 0, -6)));
        if (e.kind === 'right') fireBurst(pos.clone().add(V(-4, 0, -6)));
        if (e.kind === 'dive') fireBurst(pos.clone().add(V(0, 3, -6)));
        if (e.kind === 'flares') {
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9aa0a8 }));
          outside.add(mesh);
          missile = { p: them.group.position.clone(), t: 0, eta: qte.window + 0.25, mesh, flare: null };
          try { sfx.missile(); } catch { /* */ }
        }
      } else if (e.kind === 'land') {
        phase = 'landing';
        landT = 0; vs = 0;
        bm.ring.visible = true;
        msg = { text: 'BELY MYS', sub: 'No one on the radio. Put her down in the ring.', t: 0 };
      } else if (e.kind === 'guards') {
        radio('f.g.guards');
        game.fx.staticAmt = 0.35;
        setTimeout(() => { game.fx.staticAmt = 0; }, 1600);
      } else radio(RADIO[e.kind]);
    }
    if (qte) {
      qte.t += dt;
      const dx = pos.x - qte.start.x;
      if (qte.kind === 'left' && dx < -14) qte.ok = true;
      if (qte.kind === 'right' && dx > 14) qte.ok = true;
      if (qte.kind === 'dive' && pos.y < 22) qte.ok = true;
      if (qte.kind === 'climb' && pos.y > RIDGE_TOP + 7) qte.ok = true;
      if (qte.kind === 'flares' && (input.pressed('interact') || input.pressed('confirm') || (AUTO && qte.t > 0.4))) {
        qte.ok = true;
        for (let i = 0; i < 6; i++) {
          const f = fire.emit(pos.clone().add(V(0, 0.8, 1)), { v: V((i - 2.5) * 7, 4 + Math.random() * 4, 14 + Math.random() * 6), life: 2.4, s0: 1.4, s1: 0.8, a: 1, g: 6, color: new THREE.Color(9, 4.5, 1.2) });
          if (i === 2 && missile) missile.flare = f;
        }
        if (missile) missile.eta = missile.t + 0.7;
        try { sfx.flare(6); } catch { /* */ }
      }
      if (qte.ok) { qte = null; if (Math.random() < 0.6) radio('f.g.good'); }
      else if (qte.t > qte.window) {
        const k2 = qte.kind;
        qte = null;
        if (k2 === 'flares' && missile) missile.eta = missile.t + 0.05;
        if (k2 !== 'climb') takeHit();    // the ridge itself punishes a missed climb
      }
    }
  }

  // ================================================================ 2. LANDING
  function landingUpdate(dt) {
    t += dt;
    landT += dt;
    const toPad = V(PAD.x - pos.x, 0, PAD.z - pos.z);
    const h = toPad.length();
    // the approach flies itself to the yard; then it's yours (A/D, W/S)
    if (h > 26 && landT < 40) {
      const sp = Math.min(SPEED, 3 + h * 0.3);
      pos.addScaledVector(toPad.normalize(), Math.min(h, sp * dt));
    } else {
      gust = Math.sin(landT * 0.9) * 0.9 + Math.sin(landT * 2.3) * 0.4;
      let mx = input.move.x;
      if (AUTO) mx = clamp((PAD.x - pos.x) * 0.3, -1, 1);
      pos.x += (mx * 3.2 + gust) * dt;
      pos.z += (PAD.z - pos.z) * Math.min(1, dt * 0.8);
    }
    const agl = pos.y - GY;
    let my = input.move.y;
    if (AUTO) my = agl > 1.2 ? -1 : -0.3;
    const want = my < -0.2 ? -(1.0 + agl * 0.35) * Math.min(1, -my * 1.2) : my > 0.2 ? 4 : 0;
    vs += (want - vs) * Math.min(1, dt * 1.6) + (agl < 6 ? gust * 0.6 * dt : 0);
    pos.y = Math.max(GY, pos.y + vs * dt);
    me.group.position.copy(pos);
    me.group.rotation.set(0.04 + clamp(-vs * 0.01, -0.1, 0.1), Math.PI - 0.15, clamp(-gust * 0.05, -0.1, 0.1), 'YXZ');
    me.update(dt, 1);
    bm.ring.material.opacity = 0.45 + 0.35 * Math.sin(t * 5);
    const cp = V(pos.x + 9, pos.y + 4 + Math.min(10, h * 0.04), pos.z + 19);
    camera.position.lerp(cp, Math.min(1, dt * 2.2));
    camera.lookAt(V(pos.x * 0.6 + PAD.x * 0.4, Math.max(GY + 1, pos.y * 0.6), pos.z * 0.6 + PAD.z * 0.4));
    camera.fov = 52;
    camera.updateProjectionMatrix();
    sea.mesh.position.set(pos.x, 0, pos.z - 1500);
    them.group.position.add(V(0, dt * 3, dt * 40));
    them.update(dt, 1);
    if (pos.y <= GY + 0.001 && h < 30) {
      const off = Math.hypot(pos.x - PAD.x, pos.z - PAD.z);
      if (vs < -2.6) {
        vs = 3.5; pos.y = GY + 0.3; shake = 0.7;
        game.fx.flash = 0.2;
        msg = { text: 'TOO HARD', sub: 'Lift, and come down slower.', t: 0 };
      } else if (off > 7) {
        vs = 2.5; pos.y = GY + 0.3;
        msg = { text: 'OUTSIDE THE RING', sub: 'Lift and line up with the floodlight.', t: 0 };
      } else {
        phase = 'landed';
        landT = 0;
        rotor = 1;
        bm.ring.visible = false;
        msg = { text: 'Down.', sub: 'The rotor winds down. The floodlight hums.', t: 0 };
        finishPhase();
      }
    }
  }

  // ================================================================ the story
  async function run(from) {
    const order = ['flight', 'landing', 'warehouse', 'code', 'uplink', 'arrest', 'jail', 'credits'];
    const at = (p) => order.indexOf(from) <= order.indexOf(p);

    if (at('landing')) {
      show('outside'); postFor('outside');
      try { music.play('cb_chase', { fade: 2 }); } catch { /* */ }
      if (from === 'landing') {
        resetFlight();
        t = 99; pos.set(0, 60, -5742); lateral = 0; alt = 60; msg = null; controlsHint = 0;
        events = SCRIPT.map((e) => ({ at: e[0], kind: e[1], fired: e[0] < 99 }));
      } else resetFlight();
      phase = 'flight';
      await phaseDone();
      try { music.stop(3); } catch { /* */ }
      game.renderer.tweakPost({ letterbox: 1 });
      // out of the chopper and across the yard
      moveTo('player', outside);
      place('player', PAD.x - 2.2, PAD.z + 0.5, -Math.PI / 2);
      actors.player.ch.group.position.y = GY;
      d.cam({ pos: V(PAD.x - 9, GY + 1.4, PAD.z + 9), look: V(PAD.x - 3, GY + 1.3, PAD.z), fov: 42, dof: false });
      await wait(1.2);
      const walking = walk('player', [V(PAD.x - 7, GY, PAD.z - 5), V(SHED.x + 14.5, GY, SHED.z + 3)], 1.35);
      d.cam({ pos: V(SHED.x + 24, GY + 1.6, SHED.z + 16), look: () => actors.player.ch.group.position.clone().add(V(0, 1.2, 0)), fov: 38, dur: 6, dof: false });
      await Promise.race([walking, wait(9)]);
      walkers.clear();
      msg = { text: 'BELY MYS  ·  05:49', t: 0 };
    }

    if (at('warehouse')) {
      // inside: the door rolls up, cold light, a silhouette
      phase = 'warehouse';
      show('inside'); postFor('inside');
      moveTo('player', inside);
      place('player', 12.75, 3, -Math.PI / 2);
      const P = actors.player;
      P.ch.group.visible = false;
      wh.door.position.y = 2.25;
      d.cam({ pos: V(-2.6, 1.5, -2.2), look: V(11, 1.4, 2.6), fov: 40, dof: false });
      await wait(0.8);
      doorOpen = 0.001;
      try { sfx.rollDoor(true); } catch { /* */ }
      await wait(1.0);
      P.ch.group.visible = true;
      await wait(0.6);
      const w1 = walk('player', [V(9, 0, 2.6), V(3.6, 0, 1.3)], 1.1);
      d.cam({ pos: V(-1.4, 1.45, -1.4), look: () => actors.player.ch.group.position.clone().add(V(0, 1.4, 0)), fov: 34, dur: 7, dof: false });
      await w1;
      P.anim.lookAt = V(1.2, 0.8, 0.1);
      // the chairs, the glasses: a slow pan
      d.cam({ pos: V(2.8, 1.25, 2.6), look: V(0.2, 0.55, 0.2), fov: 38, dof: false });
      d.cam({ pos: V(-1.8, 1.15, 2.4), look: V(-0.4, 0.55, -0.2), fov: 36, dur: 6, dof: false });
      msg = { text: 'Nobody.', sub: 'Chairs on the floor. The tea is still warm.', t: 0 };
      await wait(5.5);
      // the note
      d.cam({ pos: V(2.9, 1.75, 1.6), look: V(1.65, 0.77, 0.15), fov: 30, dof: 1.7 });
      P.anim.lookAt = V(1.65, 0.77, 0.15);
      await waitPress('interact', 'Read the note');
      d.cam({ pos: V(1.75, 1.18, 0.42), look: V(1.65, 0.765, 0.12), fov: 28, dur: 1.2, dof: 0.42 });
      msg = { note: true, text: 'Погранцы. Нас забрали. Код — твой. Ты справишься. — Л.', sub: 'Border guards. They took us. The code is yours. You can do this. — L.', t: 0 };
      await wait(1.2);
      await waitPress('interact', 'Put it down', 9);
      msg = null;
      // Valya's doll
      P.anim.lookAt = V(1.25, 0.82, -0.2);
      d.cam({ pos: V(2.2, 1.3, 0.5), look: V(1.25, 0.82, -0.2), fov: 30, dof: 1.1 });
      await waitPress('interact', "Open Baba Valya's doll");
      dollOpen = 0.001;
      await wait(1.0);
      msg = { note: true, text: 'Не спеши. Но поторопись. — В.', sub: "Inside the smallest doll, a slip of paper: «Don't rush. But hurry.» — V.", t: 0 };
      await wait(1.2);
      await waitPress('interact', 'Sit at the laptop', 9);
      msg = null;
      // Lyosha's chair
      await walk('player', [V(2.2, 0, -1.5), V(0.1, 0, -1.4)], 1.0);
      await turn('player', 0, 0.5);
      seat('player', 0.1, -0.88, 0, 0.47);
      P.anim.handsOnTable = 1;
      P.anim.lookAt = V(0.1, 0.9, -0.3);
      d.cam({ pos: V(-0.9, 1.3, 0.6), look: V(0.1, 1.0, -0.6), fov: 34, dof: 1.4 });
      await wait(1.5);
    }

    if (at('code')) {
      phase = 'code';
      if (from === 'code') {
        show('inside'); postFor('inside');
        moveTo('player', inside);
        seat('player', 0.1, -0.88, 0, 0.47);
        actors.player.anim.handsOnTable = 1;
      }
      d.cam({ pos: V(0.55, 1.25, 0.25), look: V(0.1, 0.95, -0.4), fov: 32, dof: 0.75 });
      briefing = { t: 0, text: CHALLENGES.final.briefing };
      await waitPress('interact', 'Plug in the drive — the clock starts');
      briefing = null;
      try { music.play('cb_tension', { fade: 2, intensity: 0.65 }); } catch { /* */ }
      let res = AUTO ? { pass: true, received: [['send', 'AURORA-ABORT-0415']], left: 312 } : null;
      while (!res?.pass) {
        const G = { state: S, hud: { toast() {} }, player: { locked: false }, overlay: null, sfx };
        codeG = G;
        res = await openLaptop(G, { challenge: 'final', code: lastCode });
        codeG = null;
        lastCode = res?.code ?? lastCode;
        if (!res?.pass) {
          msg = res?.timeout
            ? { text: 'TOO LATE', sub: 'The screen goes dark… and Lyosha\'s backup timer gives you one more go.', t: 0 }
            : { text: 'NOTHING SENT YET', sub: 'The dish is waiting.', t: 0 };
          await wait(2.8);
          msg = null;
        }
      }
      sent = res.received?.find((r) => r[0] === 'send')?.[1] || 'AURORA-ABORT-0415';
      leftAt = res.left ?? 120;
    }

    if (at('uplink')) {
      phase = 'uplink';
      if (from === 'uplink') { show('inside'); postFor('inside'); sent = 'AURORA-ABORT-0415'; leftAt = 200; }
      uplink = { t: 0, lines: [] };
      try { music.stop(2.5); sfx.sting('success'); } catch { /* */ }
      await wait(9.5);
      uplink = null;
      // outside: the dish turns toward home; 06:00 comes; the lights stay on
      show('outside'); postFor('outside', 1);
      them.group.visible = false;
      me.group.position.copy(PAD);
      me.group.rotation.set(0, Math.PI - 0.15, 0, 'YXZ');
      rotor = 0;
      dishTurn = 0.001;
      d.cam({ pos: V(SHED.x + 22, GY + 13, SHED.z + 14), look: V(SHED.x + 6, GY + 9.6, SHED.z - 2), fov: 34, dof: false });
      d.cam({ pos: V(SHED.x + 15, GY + 11.5, SHED.z + 9), look: V(SHED.x + 6, GY + 9.8, SHED.z - 2), fov: 30, dur: 9, dof: false });
      const secs = Math.max(12, Math.floor(leftAt));
      clock = { t: 0, from: 6 * 3600 - secs, k: secs / 9 };
      await wait(9);
      d.cam({ pos: V(SHED.x + 40, GY + 14, SHED.z + 60), look: V(SHED.x - 40, GY + 6, SHED.z - 160), fov: 48, dof: false });
      blink = 0.001;
      await wait(5);
      clock = null;
      msg = { text: '06:00', sub: 'Nothing happens. Everywhere.', t: 0 };
      await wait(4);
      msg = null;
    }

    if (at('arrest')) {
      phase = 'arrest';
      show('inside'); postFor('inside');
      moveTo('player', inside);
      seat('player', 0.1, -0.88, 0, 0.47);
      const P = actors.player;
      P.anim.handsOnTable = 1;
      P.anim.lookAt = V(0.1, 0.9, -0.3);
      wh.door.position.y = 2.25;
      doorOpen = 0;
      doorLight.intensity = 0;
      d.cam({ pos: V(-1.6, 1.35, -1.9), look: V(10, 1.3, 2.5), fov: 36, dof: false });
      await wait(1.2);
      doorOpen = 0.001;
      try { sfx.rollDoor(true); sfx.sting('spotted'); } catch { /* */ }
      await wait(0.9);
      torches.forEach((l) => { l.visible = true; });
      game.fx.flash = 0.25;
      moveTo('guard', inside);
      moveTo('officer', inside);
      place('guard', 12.7, 2.3, -Math.PI / 2);
      place('officer', 12.75, 3.7, -Math.PI / 2);
      const g1 = walk('guard', [V(6, 0, 1.6), V(2.4, 0, 1.0)], 2.2);
      walk('officer', [V(7, 0, 3.0), V(3.4, 0, 2.0)], 1.5);
      await wait(1.0);
      P.anim.lookAt = V(8, 1.5, 2);
      await say('guard', 'f.guard.stop', { lookAt: 'player' });
      await g1;
      handsUp(P.anim);
      d.cam({ pos: V(1.3, 1.35, -2.4), look: V(0.1, 1.2, -0.8), fov: 34, dof: 1.6 });
      await wait(1.2);
      await say('officer', 'f.guard.papers', { cam: d.overShoulder('player', 'officer', { side: -1 }), lookAt: 'player' });
      stand('player');
      P.anim.handsOnTable = 0;
      await turn('player', yawTo('player', actors.officer.ch.group.position), 1.2);
      P.anim.lookAt = d.headPos('officer');
      await wait(0.6);
      // the officer looks at the screen
      await walk('officer', [V(2.6, 0, -1.5), V(1.05, 0, -1.45)], 1.0);
      actors.officer.anim.lookAt = V(0.1, 0.85, -0.32);
      d.cam({ pos: V(1.9, 1.45, 0.9), look: () => d.headPos('officer'), fov: 30, dofOn: 'officer' });
      await say('officer', 'f.guard.what');
      game.renderer.tweakPost({ fade: 1 });
      await wait(2.6);
    }
    await toJail(from);
  }

  function stand(id) { actors[id].anim.setPosture('stand'); }

  async function toJail(from) {
    phase = 'jail';
    torches.forEach((l) => { l.visible = false; });
    for (const id of ['guard', 'officer']) actors[id].ch.group.visible = false;
    show('jail'); postFor('jail');
    game.renderer.tweakPost({ fade: 1 }, true);
    const cells = jail.cells, cx = cells[1];
    const P = actors.player;
    P.anim.override = null;
    P.anim.handsOnTable = 0;
    moveTo('player', jail.group);
    seat('player', cx + 0.85, -0.5, -Math.PI / 2 - 0.55, 0.53);
    for (const id of ['dmitri', 'valya', 'lyosha', 'grisha', 'nadia', 'ivan']) moveTo(id, jail.group);
    // the team at their bars, talking down the corridor toward your cell; Grisha and Ivan on their bunks
    place('dmitri', cells[0] + 0.9, 1.3, 0.5);
    place('valya', cells[0] + 0.15, 1.2, 0.3);
    place('lyosha', cells[2] - 0.9, 1.3, -0.5);
    seat('grisha', cells[2] + 0.85, -0.5, -Math.PI / 2, 0.53);
    place('nadia', cells[3] - 0.9, 1.3, -0.45);
    seat('ivan', cells[3] + 0.85, -0.3, -Math.PI / 2 - 0.3, 0.53);
    actors.dmitri.anim.armsCrossed = 0.8;
    actors.ivan.anim.armsCrossed = 0.6;
    const toYou = V(cx + 0.6, 1.3, 1.7);
    const gaze = (id) => (id === 'player' ? V(cx - 0.2, 1.95, -6) : toYou);
    const team = ['player', 'dmitri', 'valya', 'lyosha', 'grisha', 'nadia', 'ivan'];
    for (const id of team) actors[id].anim.lookAt = gaze(id);
    d.cam({ pos: V(cx + 0.35, 1.25, 1.55), look: V(cx - 0.1, 1.75, -2.5), fov: 40, dof: false });
    d.cam({ pos: V(cx + 0.9, 1.1, 0.95), look: V(cx + 0.2, 1.8, -2.5), fov: 36, dur: 10, dof: false });
    await wait(0.4);
    game.renderer.tweakPost({ fade: 0 });
    try { music.play('cb_credits', { fade: 4 }); } catch { /* */ }
    msg = { text: 'BORDER SERVICE HOLDING CELLS  ·  CHUKOTKA', sub: 'Day 15 · 14:21', t: 0 };
    await wait(6.5);
    msg = null;
    if (from !== 'credits') {
      await say('dmitri', 'j.dmitri', { cam: d.closeUp('dmitri', { side: -1, dist: 1.0, fov: 30 }) });
      await say('lyosha', 'j.lyosha', { cam: d.closeUp('lyosha', { side: 1, dist: 1.0, fov: 30 }) });
      await say('grisha', 'j.grisha', { cam: d.closeUp('grisha', { side: 1, dist: 1.1, angle: 0.6 }), radio: false });
      await say('valya', 'j.valya', { cam: d.closeUp('valya', { side: 1, dist: 1.0 }) });
      await say('ivan', 'j.ivan', { cam: d.closeUp('ivan', { side: 1, dist: 1.1, angle: 0.6 }) });
      await say('nadia', 'j.nadia', { cam: d.closeUp('nadia', { side: -1, dist: 1.0 }) });
      await say('dmitri', 'j.dmitri2', { cam: d.closeUp('dmitri', { side: 1, dist: 1.2 }) });
      for (const id of team) actors[id].anim.lookAt = id === 'player' ? gaze(id) : V(actors[id].ch.group.position.x, 1.9, -6);
      // you, the window, the sun
      d.cam({ pos: V(cx + 0.05, 1.3, -1.1), look: () => d.headPos('player'), fov: 30, dofOn: 'player' });
      await wait(5);
    }
    d.cam({ pos: V(cx + 1.6, 1.15, 1.2), look: V(cx + 0.6, 1.75, -3), fov: 34, dof: false });
    d.cam({ pos: V(cx + 1.35, 1.5, 0.2), look: V(cx + 0.7, 1.95, -3), fov: 30, dur: 70, dof: false });
    phase = 'credits';
    credits = 0;
    if (game$.s) {
      game$.s.flags.finished = true;
      store.save('save0', game$.s);
    }
  }

  return {
    heavy: true,
    async enter(params = {}) {
      const from = params.phase || game.query.get('phase') || 'flight';
      d = new Director(scene, camera);
      d.radioFor.add('grisha');
      WU.night.value = 1;
      // ---- outside: sky, sea, islands, the ridge, Bely Mys, two helicopters
      outside = new THREE.Group();
      scene.add(outside);
      sky = createSky();
      sky.uniforms.aurora.value = 1.15;
      outside.add(sky.mesh);
      sea = buildSea();
      sea.mesh.scale.set(4, 4, 1);
      outside.add(sea.mesh);
      const moon = new THREE.DirectionalLight(0x9ab8e8, 0.8);
      moon.position.set(-200, 300, -300);
      outside.add(moon);
      outside.add(new THREE.HemisphereLight(0x3a6a6a, 0x101418, 0.55));
      const big = island(1100, 420, 1);
      big.position.set(-1800, 0, -3150);
      const little = island(700, 330, 7);
      little.position.set(1350, 0, -3200);
      outside.add(big, little, iceRidge());
      bm = belyMys();
      outside.add(bm.group);
      me = buildChopper({ color: '#a3221c', trim: '#e8e2d2' });
      them = buildChopper({ color: '#0e1012', trim: '#1a1c1e', searchlight: true });
      outside.add(me.group, them.group);
      if (them.spot) { them.spot.intensity = 22; them.spot.distance = 120; }
      for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(tracerGeo, tracerMat); m.visible = false; outside.add(m); tracerMeshes.push(m); }
      smoke = new Puffs(outside, 160, false);
      fire = new Puffs(outside, 120, true);
      // ---- inside: the warehouse, emptied
      inside = new THREE.Group();
      scene.add(inside);
      wh = buildWarehouse();
      inside.add(wh.group);
      let n = 0;
      wh.group.traverse((o) => {
        if (o.name !== 'chair') return;
        if (Math.hypot(o.position.x - 0.1, o.position.z + 1.02) < 0.3) return;   // Lyosha's chair stays up
        o.rotation.order = 'YXZ';
        if (n++ % 2 === 0) { o.rotation.x = -Math.PI / 2; o.position.y = 0.2; } else { o.rotation.z = Math.PI / 2; o.position.y = 0.22; }
        o.rotation.y += ((n * 1.7) % 1.2) - 0.6;
      });
      let gi = 0;
      for (const [k, gl] of Object.entries(wh.props.glasses)) {
        if (k === 'player' || gi++ % 2) continue;
        gl.rotation.z = Math.PI / 2;
        gl.position.y += 0.035;
      }
      // the note
      const noteTex = canvasTex(256, 340, (c, w, h) => {
        c.fillStyle = '#efe8d8'; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(80,110,160,0.35)';
        for (let y = 40; y < h; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        c.fillStyle = '#1a2a5a'; c.font = 'italic 25px Georgia, serif';
        ['Погранцы.', 'Нас забрали.', 'Код — твой.', 'Ты справишься.', '', '          — Л.'].forEach((l, i) => c.fillText(l, 18, 62 + i * 40));
      });
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshStandardMaterial({ map: noteTex, roughness: 0.9 }));
      note.rotation.x = -Math.PI / 2;
      note.rotation.z = 0.35;
      note.position.set(1.65, wh.top + 0.003, 0.12);
      inside.add(note);
      // Valya's doll opens on a slip of paper
      dollTop = wh.props.doll;
      const slipTex = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#f4eee0'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a2a1a'; c.font = 'italic 18px Georgia'; c.fillText('Не спеши.', 10, 26); c.fillText('Но поторопись.', 10, 50); });
      slip = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshStandardMaterial({ map: slipTex, roughness: 0.9 }));
      slip.rotation.x = -Math.PI / 2;
      slip.position.set(1.35, wh.top + 0.002, -0.12);
      slip.visible = false;
      inside.add(slip);
      // behind the roll-up door: the night yard (the set's wall has no hole)
      const nightTex = canvasTex(256, 230, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#04080e'); gr.addColorStop(0.55, '#0a1420'); gr.addColorStop(0.62, '#3a4450'); gr.addColorStop(1, '#8a96a4');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        const fl = c.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, 60);
        fl.addColorStop(0, 'rgba(255,240,210,0.9)'); fl.addColorStop(1, 'rgba(255,240,210,0)');
        c.fillStyle = fl; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 90; i++) c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      });
      const night = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.5), new THREE.MeshBasicMaterial({ map: nightTex, color: new THREE.Color(1.1, 1.15, 1.3) }));
      night.rotation.y = -Math.PI / 2;
      night.position.set(12.975, 2.25, 3);
      inside.add(night);
      // cold light through the door when it rolls up
      doorLight = new THREE.SpotLight(0x9ab8e8, 0, 22, 0.55, 0.6, 1.5);
      doorLight.position.set(16, 2.6, 3);
      doorLight.target.position.set(4, 0, 1);
      inside.add(doorLight, doorLight.target);
      // ---- the jail
      jail = jailSet();
      scene.add(jail.group);
      // ---- people, built up front (the flight is no place for hitches)
      await makeActor('player', playerDNA(), inside);
      for (const id of ['dmitri', 'nadia', 'lyosha', 'grisha', 'valya', 'ivan']) {
        const a = await makeActor(id, CAST[id].dna, jail.group);
        a.ch.group.visible = false;
      }
      for (const [id, dna] of [['guard', CAST.guard?.dna || guardDNA(211, false)], ['officer', guardDNA(229, true)]]) {
        const a = await makeActor(id, dna, inside);
        a.ch.group.visible = false;
        const torch = new THREE.SpotLight(0xe8f0ff, 30, 16, 0.32, 0.5, 1.6);
        torch.position.set(-0.28, 1.25, 0.35);
        torch.target.position.set(-0.4, 0.9, 6);
        torch.visible = false;
        a.ch.group.add(torch, torch.target);
        torches.push(torch);
      }
      voice.preload(Object.keys(FIN));
      game.renderer.setPost({ fade: 0 }, true);
      run(from).catch((e) => console.error(e));
    },
    exit() {
      voice.stopAll();
      try { sfx.rotor(0, 0, 'main'); sfx.rotor(0, 0, 'them'); } catch { /* */ }
      game.renderer.dof = null;
      game.fx.flash = 0;
      game.fx.flashColor = null;
      game.fx.staticAmt = 0;
      for (const a of Object.values(actors)) a.ch.dispose?.();
    },
    update(dt) {
      pt += dt;
      game.fx.flash = Math.max(0, (game.fx.flash || 0) - dt * 1.6);
      if (game.fx.flash <= 0) game.fx.flashColor = null;
      WU.time.value += dt;
      if (msg) msg.t += dt;
      if (briefing) briefing.t += dt;
      if (uplink) uplink.t += dt;
      if (clock) clock.t += dt;
      if (press) {
        press.t += dt;
        if ((press.t > 0.3 && (input.pressed(press.action) || input.pressed('confirm'))) || press.t > press.timeout) { const r = press.resolve; press = null; r(); }
      }
      if (codeG?.overlay) { codeG.overlay.update(dt); d.update(dt); return; }
      d.update(dt);
      if (outside?.visible) { sky.update(dt, camera); smoke.update(dt); fire.update(dt); }
      for (const w of [...turners]) if (w.step(dt)) turners.delete(w);
      updateWalkers(dt);
      if (phase === 'flight') flightUpdate(dt);
      else if (phase === 'landing') landingUpdate(dt);
      else if (outside?.visible) { rotor = Math.max(0, rotor - dt * 0.15); me.update(dt, rotor); }
      try {
        const flying = phase === 'flight' || phase === 'landing';
        sfx.rotor(flying ? 1 : outside?.visible ? rotor : 0, flying ? 1 : outside?.visible ? rotor * 0.8 : 0, 'main');
        const dThem = them?.group.visible ? them.group.position.distanceTo(camera.position) : 9999;
        sfx.rotor(flying && dThem < 600 ? 0.95 : 0, flying ? Math.max(0, 1 - dThem / 600) * 0.8 : 0, 'them');
      } catch { /* */ }
      wh?.update(dt, pt);
      if (doorOpen > 0 && doorOpen < 1) {
        doorOpen = Math.min(1, doorOpen + dt / 1.6);
        wh.door.position.y = 2.25 + smoothstep(0, 1, doorOpen) * 3.6;
        doorLight.intensity = 70 * doorOpen;
      }
      if (dollOpen > 0 && dollOpen < 1) {
        dollOpen = Math.min(1, dollOpen + dt / 0.8);
        dollTop.position.y = wh.top + smoothstep(0, 1, dollOpen) * 0.02;
        dollTop.rotation.z = smoothstep(0, 1, dollOpen) * 0.25;
        slip.visible = dollOpen > 0.6;
      }
      if (dishTurn > 0 && dishTurn < 1) {
        dishTurn = Math.min(1, dishTurn + dt / 4);
        const e = smoothstep(0, 1, dishTurn);
        bm.dish.head.rotation.set(-0.35 + e * 0.27, 0.6 - e * 0.6, 0);
        bm.dish.tip.material.color.setRGB(0.3 + e * 6, 1.2 + e * 6, 0.8 + e * 4);
      }
      if (dishTurn >= 1) bm.dish.beam.material.opacity = Math.min(0.22, bm.dish.beam.material.opacity + dt * 0.1) * (0.85 + 0.15 * Math.sin(pt * 23));
      if (blink > 0 && blink < 1) {
        blink = Math.min(1, blink + dt / 3);
        const f = blink > 0.3 && blink < 0.42 ? 0.25 : 1;
        bm.winMat.color.setRGB(3.4 * f, 2.1 * f, 0.9 * f);
      }
      if (jail?.group.visible) { jail.sky.material.uniforms.t.value = pt; jail.fill.position.copy(camera.position).add(V(0, 0.25, 0)); }
      if (phase === 'credits') {
        credits += dt;
        const stopAt = (H + 30 - (H / 2 - (CREDITS.length - 1) * CREDIT_ROW)) / CREDIT_SPEED;
        if (credits > stopAt + 7 || (credits > 4 && (input.pressed('back') || input.pressed('pause')))) {
          phase = 'end';
          try { music.stop(3); } catch { /* */ }
          go('title', {}, { transition: 'fade' });
        }
      }
    },
    draw(ctx) {
      if (codeG?.overlay) { codeG.overlay.draw(ctx, 1 / 60); return; }
      d.draw(ctx);
      if (phase === 'flight' && !crashing) {
        text(ctx, 'DRAGONFLY', 40, 60, { size: 14, weight: 800, color: C.dim, spacing: 3 });
        for (let i = 0; i < MAX_HITS; i++) { ctx.fillStyle = i < MAX_HITS - hits ? C.green : 'rgba(255,64,72,0.55)'; ctx.fillRect(40 + i * 26, 72, 20, 8); }
        text(ctx, `ALT ${Math.round(pos.y)} m   ·   BELY MYS ${Math.max(0, (pos.z - PAD.z) / 1000).toFixed(1)} km`, 40, 104, { size: 13, weight: 700, color: C.dim, font: MONO_FONT });
        if (controlsHint > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, controlsHint);
          let x = W / 2 - 250;
          for (const [act, label] of [['left', ''], ['right', 'SLIDE'], ['up', ''], ['down', 'CLIMB / DIVE'], ['interact', 'FLARES']]) {
            x += actionGlyph(ctx, act, x, H - 70, 11) + 6;
            if (label) { text(ctx, label, x + 4, H - 64, { size: 14, weight: 700, color: '#fff', spacing: 1 }); x += label.length * 10 + 34; }
          }
          ctx.restore();
        }
        if (qte) {
          const a = 0.6 + 0.4 * Math.sin(pt * 20);
          panel(ctx, W / 2 - 180, 160, 360, 74, { accent: C.red, accentLen: 200 });
          const gw = actionGlyph(ctx, qte.action, W / 2 - 150, 197, 13);
          vText(ctx, qte.prompt, W / 2 - 150 + gw + 18, 208, 30, { color: `rgba(255,255,255,${a})`, weight: 0.17 });
          ctx.fillStyle = C.red;
          ctx.fillRect(W / 2 - 160, 222, 320 * Math.max(0, 1 - qte.t / qte.window), 4);
        }
      }
      if (phase === 'landing') {
        const agl = pos.y - GY;
        const off = Math.hypot(pos.x - PAD.x, pos.z - PAD.z);
        panel(ctx, W - 250, 140, 210, 150, {});
        text(ctx, 'ALT', W - 230, 172, { size: 12, weight: 800, color: C.dim, spacing: 2 });
        text(ctx, `${agl.toFixed(1)} m`, W - 60, 172, { size: 16, weight: 800, color: '#fff', align: 'right', font: MONO_FONT });
        text(ctx, 'SINK', W - 230, 204, { size: 12, weight: 800, color: C.dim, spacing: 2 });
        text(ctx, `${(-vs).toFixed(1)} m/s`, W - 60, 204, { size: 16, weight: 800, color: vs < -2.6 ? C.red : C.green, align: 'right', font: MONO_FONT });
        text(ctx, 'RING', W - 230, 236, { size: 12, weight: 800, color: C.dim, spacing: 2 });
        text(ctx, off < 7 ? 'OVER IT' : `${off.toFixed(0)} m`, W - 60, 236, { size: 16, weight: 800, color: off < 7 ? C.green : '#ffd166', align: 'right', font: MONO_FONT });
        text(ctx, 'touch down under 2.6 m/s', W - 230, 270, { size: 12, color: C.dim });
        let x = W / 2 - 190;
        x += actionGlyph(ctx, 'down', x, H - 70, 11) + 8;
        text(ctx, 'DESCEND', x, H - 64, { size: 14, weight: 700, color: '#fff', spacing: 1 }); x += 100;
        x += actionGlyph(ctx, 'up', x, H - 70, 11) + 8;
        text(ctx, 'LIFT', x, H - 64, { size: 14, weight: 700, color: '#fff', spacing: 1 }); x += 64;
        x += actionGlyph(ctx, 'left', x, H - 70, 11) + 4;
        x += actionGlyph(ctx, 'right', x, H - 70, 11) + 8;
        text(ctx, 'LINE UP', x, H - 64, { size: 14, weight: 700, color: '#fff', spacing: 1 });
      }
      if (press) {
        const lw = 400, x = W / 2 - lw / 2, y = H - 170;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, y - 22, lw, 42);
        const gw = actionGlyph(ctx, press.action, x + 16, y - 1, 11);
        text(ctx, press.label, x + 30 + gw, y + 5, { size: 17, weight: 700, color: '#fff' });
      }
      if (briefing) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, briefing.t * 2);
        ctx.fillStyle = 'rgba(2,8,6,0.9)';
        ctx.fillRect(160, 110, W - 320, 340);
        text(ctx, 'LYOSHA LEFT THE LAPTOP OPEN', 190, 150, { size: 14, weight: 800, color: C.green, spacing: 2, font: MONO_FONT });
        paragraph(ctx, briefing.text, 190, 188, W - 380, { size: 17, lineHeight: 27, color: '#e8f0e8' });
        text(ctx, 'TEN MINUTES.  HINTS COST 30 SECONDS.', 190, 428, { size: 14, weight: 800, color: '#ffd166', spacing: 2 });
        ctx.restore();
      }
      if (msg) {
        const a = Math.min(1, msg.t * 2) * (msg.note ? 1 : clamp(6 - msg.t, 0, 1));
        ctx.save();
        ctx.globalAlpha = a;
        if (msg.note) {
          ctx.fillStyle = 'rgba(240,232,214,0.94)';
          ctx.fillRect(W / 2 - 340, 110, 680, 116);
          text(ctx, msg.text, W / 2, 158, { size: 23, weight: 600, color: '#1a2a5a', align: 'center', italic: true, shadow: false });
          if (msg.sub) text(ctx, msg.sub, W / 2, 196, { size: 15, weight: 600, color: '#5a4a3a', align: 'center', shadow: false });
        } else {
          const my = game.renderer.post.letterbox > 0.5 ? 150 : 104;
          text(ctx, msg.text, W / 2, my, { size: 19, weight: 800, color: '#fff', align: 'center', spacing: 3 });
          if (msg.sub) text(ctx, msg.sub, W / 2, my + 28, { size: 15, weight: 600, color: 'rgba(230,236,244,0.8)', align: 'center' });
        }
        ctx.restore();
      }
      if (uplink) {
        const cities = ['ANCHORAGE', 'MOSCOW', 'LONDON', 'TOKYO', 'CHICAGO', 'LAGOS', 'SÃO PAULO', 'MUMBAI', 'SYDNEY', 'BERLIN', 'CAIRO', 'TORONTO', 'JAKARTA', 'SEOUL', 'MEXICO CITY', 'NOME', 'ANADYR', 'PORT ZARYA'];
        const k = Math.floor(Math.max(0, uplink.t - 1.2) * 2.4);
        while (uplink.lines.length < Math.min(cities.length, k)) uplink.lines.push(cities[uplink.lines.length]);
        ctx.fillStyle = 'rgba(0,6,4,0.92)';
        ctx.fillRect(0, 0, W, H);
        text(ctx, `>>> send(unwrap(shards))   →   '${sent}'`, 110, 100, { size: 19, weight: 600, color: '#5dffb0', font: MONO_FONT });
        text(ctx, 'TROPOSCATTER UPLINK  ·  LOCKED  ·  WORMWOOD ABORT BROADCAST', 110, 134, { size: 15, weight: 600, color: '#c3e88d', font: MONO_FONT });
        uplink.lines.forEach((c, i) => text(ctx, `  grid ${String(i + 1).padStart(2, '0')}  ${c.padEnd(13)}  wormwood ..... DISARMED    lights ON`, 110, 174 + i * 25, { size: 15, weight: 600, color: i === uplink.lines.length - 1 ? '#fff' : '#5dffb0', font: MONO_FONT }));
        if (uplink.lines.length >= cities.length) text(ctx, '9 210 / 9 210 NODES ABORTED.', 110, 174 + cities.length * 25 + 14, { size: 17, weight: 800, color: '#ffd166', font: MONO_FONT });
      }
      if (clock) {
        const s = Math.min(6 * 3600, clock.from + clock.t * clock.k);
        const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = Math.floor(s % 60);
        vText(ctx, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, W / 2, 196, 34, { align: 'center', color: '#fff', weight: 0.16, glow: 10, glowColor: 'rgba(120,255,190,0.5)' });
      }
      if (phase === 'credits') {
        const y0 = Math.max(H / 2 - (CREDITS.length - 1) * CREDIT_ROW, H + 30 - credits * CREDIT_SPEED);
        ctx.save();
        CREDITS.forEach(([s, kind], i) => {
          const y = y0 + i * CREDIT_ROW;
          if (y < -40 || y > H + 40 || !s) return;
          ctx.globalAlpha = clamp(Math.min(y - 40, H - 40 - y) / 80, 0, 1);
          if (kind === 'title' && /^[\x20-\x7e]*$/.test(s)) vText(ctx, s, W * 0.73, y, 34, { align: 'center', color: '#fff', weight: 0.16, glow: 12, glowColor: 'rgba(255,170,90,0.6)' });
          else if (kind === 'title') text(ctx, s, W * 0.73, y + 10, { size: 36, weight: 800, color: '#fff', align: 'center', glow: 14, glowColor: 'rgba(255,170,90,0.7)' });
          else text(ctx, s, W * 0.73, y, { size: kind === 'sub' ? 20 : 17, weight: kind === 'head' ? 800 : 600, color: kind === 'head' ? '#ffd8a8' : '#f4eee4', align: 'center', spacing: kind === 'head' ? 3 : 0 });
        });
        ctx.restore();
      }
    },
    view() { return { scene, camera }; },
  };
});
