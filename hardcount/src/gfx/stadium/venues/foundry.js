// FOUNDRY — an industrial pro stadium: a brick-clad bowl, two steel-framed
// side decks under roofs held up by exposed truss girders, an old brick
// factory facade standing behind the south end with THE FOUNDRY across it,
// four lattice light towers in the corners, a video board on a steel gantry
// in the north end, and beyond it the works: smokestacks breathing smoke,
// sawtooth sheds, a gas holder, cranes and the orange glow of the furnaces.
import * as THREE from 'three';
import { RRPath, ringWall, ringFlat, buildTier } from '../bowl.js';
import { V3, beam, spill, smokestack, building, lightPole, exteriorMat } from '../kit.js';
import { cv, tex, BRANDS } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { blockText } from '../blockfont.js';
import { logoCanvas } from '../../logos.js';
import { makeRng } from '../../../core/util.js';
import { wantFn, angleAt, adWallMat, ribbonMat, suiteMat, edgeBanks, videoBoard } from './common.js';

export const SUN_AZ = 2.0;
export const WIND_DIR = 0.4;
export const FLAG_COLOR = '#f26a1b';

export function paint(ctx) {
  const h = ctx.home;
  return {
    surface: ctx.def.surface, pattern: 'wide', grass: ['#2e7232', '#357c38'], wear: 0.25, border: 'pro',
    endzone: { style: 'solid', fill: h.colors.primary, text: [h.name.toUpperCase(), h.city.toUpperCase()], color: h.colors.secondary, outline: '#ffffff' },
    logo: logoCanvas(h, 1024, { flat: true }), logoSize: Math.min(ctx.field.W * 0.3, 13),
    marginSide: 12, marginEnd: 8,
  };
}

// ------------------------------------------------------------------ smoke

const SMOKE_VERT = /* glsl */`
  attribute vec2 corner;
  attribute vec4 aA;   // x, y, z (stack top), phase
  attribute vec4 aB;   // life, rise, spread, seed
  uniform float uTime;
  uniform vec2 uWind;
  varying vec2 vUv;
  varying float vA;
  #include <fog_pars_vertex>
  void main() {
    float age = mod(uTime + aA.w * aB.x, aB.x);
    float k = age / aB.x;
    vec3 p = aA.xyz + vec3(uWind.x, 0.0, uWind.y) * age * (0.6 + k) + vec3(sin(aB.w * 20.0 + age * 0.4), 0.0, cos(aB.w * 13.0 + age * 0.3)) * k * 4.0;
    p.y += aB.y * age * (1.0 - 0.35 * k);
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    float s = 4.0 + aB.z * k * 24.0;
    mvPosition.xy += (corner - vec2(0.0, 0.5)) * s;
    vA = smoothstep(0.0, 0.08, k) * (1.0 - k);
    vUv = vec2(corner.x + 0.5, corner.y);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const SMOKE_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uGlow;
  varying vec2 vUv;
  varying float vA;
  #include <fog_pars_fragment>
  void main() {
    float d = length(clamp(vUv, 0.0, 1.0) - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.15, 1.0, d)) * vA * 0.72;
    if (a < 0.004) discard;
    vec3 c = uColor + uGlow * (1.0 - vUv.y) * 0.6;
    gl_FragColor = vec4(c, a);
    #include <fog_fragment>
  }`;

function smoke(stacks, ctx) {
  const per = ctx.quality === 'low' ? 16 : 34;
  const n = stacks.length * per;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('corner', new THREE.Float32BufferAttribute([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1], 2));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const A = new Float32Array(n * 4), Bv = new Float32Array(n * 4);
  const rng = makeRng('smoke');
  stacks.forEach((s, i) => {
    for (let k = 0; k < per; k++) {
      const j = i * per + k;
      A.set([s.x, s.y + 1, s.z, k / per + rng() * 0.03], j * 4);
      Bv.set([20 + rng() * 6, 1.6 + rng() * 0.6, 0.8 + rng() * 0.5, rng()], j * 4);
    }
  });
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(Bv, 4));
  g.instanceCount = n;
  const A2 = ctx.atmos;
  const base = A2.night ? [0.07, 0.065, 0.07] : A2.dusk ? [0.2, 0.18, 0.18] : [0.5, 0.5, 0.52];
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uWind: { value: new THREE.Vector2(Math.cos(ctx.windDir), Math.sin(ctx.windDir)).multiplyScalar(1 + ctx.wind * 5) },
    uColor: { value: new THREE.Color(...base) }, uGlow: { value: new THREE.Color(A2.day ? 0 : 0.55, A2.day ? 0 : 0.2, A2.day ? 0 : 0.04) },
  }]);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, uniforms: u, transparent: true, depthWrite: false, fog: true }));
  m.frustumCulled = false;
  m.renderOrder = 6;
  m.name = 'smoke';
  return { mesh: m, u };
}

// ------------------------------------------------------------------ build

export async function build(ctx) {
  const { B, field, home, root } = ctx;
  const rng = makeRng('foundry');
  const hw = field.halfW, E = field.end;
  const disposables = [];
  const path = new RRPath(hw + 12, E + 10, 22);
  const P = path.P;
  B.get('adwall', () => adWallMat(ctx, 'adwall8', BRANDS.slice(4, 12)));
  B.get('suites', () => suiteMat(ctx, 'suites-foundry'));
  B.get('exterior', (c) => exteriorMat(c, 'foundry', '#7a3a2c', home.colors.secondary, { brick: true }));
  const rib = ribbonMat(ctx, ['DETROIT MOTORMEN', 'IRONSIDE AUTO', 'FULL THROTTLE', 'RAZOR FUEL', 'DEFENSE!', 'BOLT COLA', 'MOTOR CITY', 'STATIC TIRES']);
  B.get('ribbon', () => rib.mat);
  B.get('roofdeck', (c) => spill(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }), c, 0.3, { direct: 0.12 }));
  const orange = home.colors.secondary, charcoal = home.colors.primary;
  const seatCol = (s, r) => (Math.floor(angleAt(path, s) / 12) % 2 ? orange : '#3a3c40');
  const groupLo = (s, r) => { const a = angleAt(path, s); return a > 70 && a < 110 && r > 2 ? 'student' : 'home'; };
  const lowerSpec = (s0, s1, rows) => ({
    s0, s1, d0: 0, rows, depth: 0.95, h0: 1.8, rise: 0.42, riseGrow: 0.003,
    tint: [0.7, 0.66, 0.62], seats: 'seats', seatColor: seatCol,
    aisleEvery: 24, aisleW: 1.1, vom: { every: 26, offset: 10, row: 9, rows: 4, w: 2.6 },
    group: groupLo, want: wantFn(path, field, rows), light: (r) => (r > 18 ? 0.82 : 1),
    front: { y0: 0, rail: 0.3, key: 'adwall', vFit: true, uScale: 68 },
    back: { h: 2.4 }, exterior: true, exteriorKey: 'exterior', exteriorTint: [1, 1, 1], exteriorU: 16, exteriorV: 16,
  });
  // lower bowl: full height except a lower north end
  const c1 = path.segs[1], c2 = path.segs[3];
  const nS0 = c1.s0 + c1.len * 0.5, nS1 = c2.s0 + c2.len * 0.5;
  const lower = buildTier(B, path, lowerSpec(nS1, nS0 + P, 24));
  const north = buildTier(B, path, { ...lowerSpec(nS0, nS1, 12), vom: null });
  // side upper decks
  const uD0 = lower.dEnd - 6, uH0 = lower.top + 8;
  const sides = [];
  for (const seg of [path.segs[0], path.segs[4]]) {
    const s0 = seg.s0 + 1, s1 = seg.s1 - 1;
    const spec = {
      s0, s1, d0: uD0, rows: 22, depth: 1.0, h0: uH0, rise: 0.62,
      tint: [0.68, 0.64, 0.6], seats: 'seats', seatColor: seatCol,
      aisleEvery: 24, aisleW: 1.1, vom: { every: 28, offset: 12, row: 6, rows: 3, w: 2.4 },
      group: (s, r) => (seg.name === 'px' && r > 6 && path.at(s, 0).z > E * 0.3 ? 'away' : 'home'),
      want: wantFn(path, field, 22), light: (r) => (r > 8 ? 0.75 : 0.9),
      back: { h: 2.6 }, exterior: true, exteriorKey: 'exterior', exteriorTint: [1, 1, 1], exteriorU: 16, exteriorV: 16,
      roof: { depth: 17, h: 4, rise: 1.5, key: 'roofdeck', tint: [0.35, 0.36, 0.38], fascia: new THREE.Color(charcoal).toArray(), fasciaH: 1.8, colEvery: 12 },
    };
    const t = buildTier(B, path, spec);
    sides.push({ seg, t, spec });
    const ss = path.samples(s0, s1, 6);
    const soffit = uH0 - 3.6;
    ringWall(B.get('suites'), path, ss, lower.dEnd + 0.4, lower.top + 2.4, soffit, { uScale: 8, vFit: true });
    const conc = B.get('concrete');
    conc.setColor(0.55, 0.52, 0.5);
    ringFlat(conc, path, ss, uD0, lower.dEnd + 0.4, soffit, { down: true });
    const fas = B.get('paint');
    fas.setColor(...new THREE.Color(charcoal).toArray());
    ringWall(fas, path, ss, uD0 - 0.02, soffit, uH0 + 0.35);
    ringWall(B.get('ribbon'), path, ss, uD0 - 0.1, soffit + 0.9, soffit + 2.6, { uScale: 54, vFit: true });
    // exposed truss girders on top of the roof, cantilevered out over the deck
    const steel = B.get('metal');
    steel.setColor(0.62, 0.22, 0.12);
    const edge = spec.roofEdge;
    const yb = t.backTop + 4;
    for (const s of path.samples(s0 + 2, s1 - 2, 12)) {
      const back = path.at(s, t.dEnd + 0.8), front = path.at(s, edge.d);
      const top0 = V3(back.x, yb + 9, back.z), bot0 = V3(back.x, yb, back.z);
      const top1 = V3(front.x, edge.y + 1.6, front.z), bot1 = V3(front.x, edge.y + 0.2, front.z);
      beam(steel, top0, top1, 0.5);
      beam(steel, bot0, bot1, 0.45);
      for (let k = 0; k < 6; k++) {
        const a = k / 6, b = (k + 1) / 6;
        const pa = top0.clone().lerp(top1, a), pb = bot0.clone().lerp(bot1, b);
        const qa = bot0.clone().lerp(bot1, a);
        beam(steel, pa, pb, 0.22);
        beam(steel, pa, qa, 0.22);
      }
      // back mast + tie
      beam(steel, V3(back.x, t.top, back.z), top0, 0.6);
    }
    edgeBanks(ctx, path, [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => seg.s0 + seg.len * k), edge.d + 0.6, edge.y - 2.6, { cols: 8, rows: 3, lamp: 0.85, tilt: 0.78 });
  }

  // ---- lattice light towers in the four corners
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = path.at(path.segs[sz > 0 ? (sx > 0 ? 1 : 3) : (sx > 0 ? 7 : 5)].s0 + path.segs[1].len * 0.5, lower.dEnd + 6);
    const spec = lightPole(B, p.x, p.z, 52, [p.x * 0.2, 0, p.z * 0.3], { kind: 'lattice', cols: 7, rows: 5, lamp: 0.95, tilt: 0.62 });
    ctx.rig.bank({ ...spec, glare: 1.2 });
    ctx.lightsList.push({ pos: V3(p.x, 54 + 5, p.z), color: [1, 0.12, 0.06], size: 2, k: 1.4, blink: 1 });
  }

  // ---- the factory facade behind the south end
  const fz = -(path.az + lower.dEnd + 2);
  const fw = path.ax * 2 + 16;
  building(B, ctx, 0, fz - 8, fw, 14, 34, 0, 'brick', 'factory', { uw: 10, uh: 12, glow: 1.8 });
  const brick = B.get('brick');
  brick.setColor(0.85, 0.55, 0.45);
  // stepped parapet
  for (let k = -3; k <= 3; k++) brick.box(k * (fw / 7), 34, fz - 2, fw / 7 - 0.4, 2 + (3 - Math.abs(k)) * 1.2, 2, 0, { uw: 4, uh: 4 });
  // THE FOUNDRY sign across it
  const [sc, sx] = cv(2048, 256);
  sx.clearRect(0, 0, 2048, 256);
  sx.shadowColor = orange; sx.shadowBlur = 24;
  blockText(sx, 'THE FOUNDRY', 1024, 210, 168, { align: 'center', color: orange, weight: 1.1, outline: 6, outlineColor: '#2a1206' });
  const signT = tex(sc, { repeat: false, aniso: 8 });
  disposables.push(signT);
  const k = ctx.day ? 1.1 : 2.4;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.8, fw * 0.1), new THREE.MeshBasicMaterial({ map: signT, transparent: true, color: new THREE.Color(k, k * 0.95, k * 0.9), depthWrite: false }));
  sign.position.set(0, 26, fz - 0.9);
  sign.renderOrder = 2;
  root.add(sign);

  // ---- video board on a steel gantry in the north end
  const board = createScoreboard('video', { home, away: ctx.away, intensity: ctx.day ? 1.3 : 1.55 });
  const bw = Math.min(42, hw * 2), bh = bw * 0.36;
  const bz = path.az + north.dEnd + 4;
  const by = north.backTop + 4;
  videoBoard(ctx, 0, by, bz, bw, bh, Math.PI, board, { legs: false });
  const steel = B.get('metal');
  steel.setColor(0.4, 0.42, 0.45);
  for (const sx2 of [-1, 1]) {
    const x0 = sx2 * bw * 0.42;
    for (const dz of [0.5, 4.5]) beam(steel, V3(x0, 0, bz + dz), V3(x0, by + bh, bz + dz), 0.7);
    for (let y = 4; y < by + bh; y += 5) {
      beam(steel, V3(x0, y, bz + 0.5), V3(x0, y + 5, bz + 4.5), 0.25);
      beam(steel, V3(x0, y, bz + 0.5), V3(x0, y, bz + 4.5), 0.25);
    }
  }
  beam(steel, V3(-bw * 0.42, by + bh + 1, bz + 2.5), V3(bw * 0.42, by + bh + 1, bz + 2.5), 0.9);

  // ---- the works beyond the north end
  const stacks = [];
  const wz = path.az + 90;
  for (let i = 0; i < 6; i++) {
    const x = -150 + i * 58 + (rng() - 0.5) * 20, z = wz + 60 + rng() * 120, h = 55 + rng() * 40;
    smokestack(B, x, z, h, 2.6 + rng() * 1.2);
    stacks.push({ x, y: h, z });
    ctx.lightsList.push({ pos: V3(x, h + 1.5, z), color: [1, 0.1, 0.05], size: 2.4, k: 1.5, blink: 1 });
  }
  // sawtooth sheds
  const clad = B.get('clad');
  for (let i = 0; i < 9; i++) {
    const x = -200 + i * 46 + (rng() - 0.5) * 10, z = wz + rng() * 70, w = 38, d = 30 + rng() * 20, h = 10 + rng() * 6;
    clad.setColor(0.5 + rng() * 0.15, 0.48, 0.45);
    clad.box(x, 0, z, w, h, d, 0, { uw: 6, uh: 6, top: false });
    // sawtooth roof
    const n = 5;
    for (let k2 = 0; k2 < n; k2++) {
      const z0 = z - d / 2 + (k2 / n) * d, z1 = z0 + d / n;
      clad.quad(V3(x - w / 2, h, z0), V3(x + w / 2, h, z0), V3(x + w / 2, h + 4, z1), V3(x - w / 2, h + 4, z1), [0, 0, w / 6, 1]);
      const glow = B.get('glow');
      glow.setColor(...(ctx.day ? [0.5, 0.55, 0.6] : [2.2, 1.0, 0.35]));
      glow.quad(V3(x + w / 2, h, z1), V3(x - w / 2, h, z1), V3(x - w / 2, h + 4, z1), V3(x + w / 2, h + 4, z1));
    }
    if (!ctx.day && rng() < 0.6) ctx.lightsList.push({ pos: V3(x, h + 8, z + d / 2 + 2), color: [1, 0.45, 0.12], size: 18, k: 0.35 });
  }
  // gas holder + cranes
  const tank = B.get('metal');
  tank.setColor(0.45, 0.5, 0.48);
  const tg = new THREE.CylinderGeometry(22, 22, 36, 24, 1, false);
  tg.translate(170, 18, wz + 160);
  tank.geometry(tg, new THREE.Matrix4());
  tg.dispose();
  for (let k2 = 0; k2 < 12; k2++) {
    const a = (k2 / 12) * Math.PI * 2;
    beam(tank, V3(170 + Math.cos(a) * 22.6, 0, wz + 160 + Math.sin(a) * 22.6), V3(170 + Math.cos(a) * 22.6, 40, wz + 160 + Math.sin(a) * 22.6), 0.5);
  }
  for (const [x, z] of [[-90, wz + 20], [60, wz + 40]]) {
    tank.setColor(0.85, 0.6, 0.1);
    beam(tank, V3(x, 0, z), V3(x, 40, z), 1.4);
    beam(tank, V3(x - 20, 40, z), V3(x + 34, 40, z), 1.6, 2);
  }
  // street lamps on the approach + low-rise brick blocks on the sides
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    building(B, ctx, side * (path.ax + 80 + rng() * 40), -120 + (i >> 1) * 40, 30, 24, 14 + rng() * 16, 0, rng() < 0.5 ? 'brick' : 'dark', 'w' + (i % 2), { uw: 12, uh: 12 });
  }
  const sm = smoke(stacks, ctx);
  root.add(sm.mesh);

  return {
    seats: [...lower.seats, ...north.seats, ...sides.flatMap((s) => s.t.seats)],
    pool: [path.ax + sides[0].t.dEnd + 3, path.az + lower.dEnd + 18],
    boards: [board],
    disposables,
    sideline: { benchOff: 8.5, cheer: true, photographers: 10, coaches: 4, players: 16, chainSide: 1, vest: '#f26a1b', heaters: ctx.weather === 'snow' },
    cams: {
      scoreboard: { pos: V3(0, 5, E - 8), target: V3(0, by + bh * 0.5, bz) },
      crowd: { pos: V3(hw + 5, 3.5, -12), target: V3(hw + 26, 14, 4) },
    },
    post: ctx.dusk ? { saturation: 1.05, gain: [1.05, 0.98, 0.94] } : {},
    update(dt, st, t) { rib.scroll(t); sm.u.uTime.value = t; },
  };
}
