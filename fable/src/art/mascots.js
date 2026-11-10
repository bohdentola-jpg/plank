// Oversized foam mascot costumes: a huge themed shell with a goofy face, tiny
// arms and stubby legs poking out. Self-contained (only needs the art kit), so
// anything can drop one in — Mascot Mayhem contestants, a sideline mascot…
//
//   const m = buildMascot('pumpkin', { color: 0x2a6f77 });   // color tints shoes/gloves trim
//   scene.add(m.root);  m.root.position.set(x, y, z);  m.root.rotation.y = yaw;
//   m.update(dt, speed, state);   // state: 'idle' | 'run' | 'jump' | 'fall' | 'cheer'
//   m.lean.x / m.lean.z           // optional extra wobble (radians) the owner can drive
import * as THREE from 'three';
import { toon, sphere, cyl, cone, torus, capsule, box, circle, M, bake, shade } from './kit.js';

export const MASCOT_KINDS = ['football', 'acorn', 'pumpkin', 'corn', 'cheese'];
export const MASCOT_NAMES = { football: 'Pigskin', acorn: 'Nutty', pumpkin: 'Gourdon', corn: 'The Kernel', cheese: 'Big Cheese' };
export const MASCOT_ICONS = { football: '🏈', acorn: '🌰', pumpkin: '🎃', corn: '🌽', cheese: '🧀' };

const TAU = Math.PI * 2;
const geos = new Map();
const cached = (key, make) => { let g = geos.get(key); if (!g) { g = make(); geos.set(key, g); } return g; };
const ellipZ = (sx, sy, sz) => (x, y) => sz * Math.sqrt(Math.max(0.02, 1 - (x / sx) ** 2 - (y / sy) ** 2));

// ---------------------------------------------------------------- shells
// Each builder fills `g` (later baked into one mesh) and returns the metrics the
// shared face / limb code needs: body centre height, a surface function for the
// front, where the arms attach, default trim colour.
const SHELLS = {
  football(g) {
    const cy = 1.42, sx = 0.82, sy = 1.1, sz = 0.82;
    g.add(M(sphere(1, 20, 16), toon(0x8a4a26), 0, cy, 0, { sx, sy, sz }));
    for (const s of [-1, 1]) {
      const y = s * 0.76, r = sx * Math.sqrt(1 - (y / sy) ** 2);
      g.add(M(torus(Math.round(r * 100) / 100 + 0.01, 0.06, 6, 22), toon(0xfff4dc), 0, cy + y, 0, { rx: Math.PI / 2 }));
    }
    // laces up the forehead
    const ly = 0.52, lz = sz * Math.sqrt(1 - (ly / sy) ** 2) + 0.02, tilt = -0.37;
    g.add(M(box(0.08, 0.5, 0.05), toon(0xfff4dc), 0, cy + ly, lz, { rx: tilt }));
    for (let i = -1.5; i <= 1.5; i++) g.add(M(box(0.3, 0.06, 0.05), toon(0xfff4dc), 0, cy + ly + i * 0.12 * Math.cos(tilt), lz + i * 0.12 * Math.sin(tilt), { rx: tilt }));
    return { cy, faceY: cy - 0.12, surf: ellipZ(sx, sy, sz), sx, armY: cy - 0.1, top: cy + sy, trim: 0xd4502f, legX: 0.3 };
  },
  acorn(g) {
    const cy = 1.22, sx = 0.88, sy = 0.92, sz = 0.88;
    g.add(M(sphere(1, 20, 16), toon(0xd3a064), 0, cy, 0, { sx, sy, sz }));
    const capC = 0x7a4a2a, capY = cy + 0.36;
    g.add(M(cached('halfdome', () => new THREE.SphereGeometry(1, 20, 8, 0, TAU, 0, Math.PI / 2)), toon(capC), 0, capY, 0, { sx: 0.97, sy: 0.62, sz: 0.97 }));
    g.add(M(torus(0.95, 0.085, 6, 22), toon(shade(capC, -0.15)), 0, capY, 0, { rx: Math.PI / 2 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + (i % 2) * 0.2, el = i % 2 ? 0.55 : 0.2;
      g.add(M(sphere(0.1, 7, 5), toon(shade(capC, i % 2 ? 0.12 : -0.1)), Math.cos(a) * 0.95 * Math.cos(el), capY + Math.sin(el) * 0.62, Math.sin(a) * 0.95 * Math.cos(el)));
    }
    g.add(M(cyl(0.07, 0.12, 0.36, 7), toon(0x5a3a22), 0.03, capY + 0.74, 0, { rz: -0.22 }));
    return { cy, faceY: cy - 0.2, surf: ellipZ(sx, sy, sz), sx, armY: cy - 0.18, top: capY + 0.62, trim: 0x6aa84f, legX: 0.3 };
  },
  pumpkin(g) {
    const cy = 1.14, sx = 1.0, sy = 0.84, sz = 1.0;
    const c = 0xf08a24;
    g.add(M(sphere(1, 20, 16), toon(c), 0, cy, 0, { sx, sy, sz }));
    for (let i = 0; i < 4; i++) g.add(M(torus(1.0, 0.075, 6, 22), toon(shade(c, -0.14)), 0, cy, 0, { ry: (i / 4) * Math.PI + Math.PI / 8, sy: sy / sx }));
    g.add(M(cyl(0.1, 0.17, 0.38, 7), toon(0x5a7a3c), 0.04, cy + sy + 0.12, 0, { rz: -0.25 }));
    g.add(M(sphere(0.22, 10, 6), toon(0x6f9a4a), 0.32, cy + sy + 0.02, 0.05, { sx: 1.4, sy: 0.22, sz: 0.8, rz: -0.3 }));
    g.add(M(torus(0.13, 0.028, 5, 12, Math.PI * 1.5), toon(0x5a7a3c), -0.26, cy + sy + 0.1, 0.02));
    return { cy, faceY: cy - 0.02, surf: ellipZ(sx, sy, sz), sx, armY: cy - 0.05, top: cy + sy, trim: 0x8a5aa8, legX: 0.36 };
  },
  corn(g) {
    const cy = 1.5, r = 0.64, half = 0.55;
    const c = 0xf2c23c;
    g.add(M(capsule(r, half * 2, 14), toon(c), 0, cy, 0));
    for (let row = 0; row < 8; row++) {
      const y = -0.78 + row * 0.25;
      const over = Math.max(0, Math.abs(y) - half);
      const rr = Math.sqrt(Math.max(0.01, r * r - over * over));
      for (let i = 0; i < 12; i++) {
        const a = ((i + (row % 2) * 0.5) / 12) * TAU;
        const front = Math.abs(a - Math.PI / 2) < 0.8 && y > -0.42 && y < 0.5;
        if (front) continue;
        g.add(M(sphere(0.11, 7, 5), toon(shade(c, (i + row) % 2 ? 0.1 : -0.07)), Math.cos(a) * rr, cy + y, Math.sin(a) * rr));
      }
    }
    for (const phi of [Math.PI / 2 + 0.25, -Math.PI / 2 - 0.25, Math.PI]) {
      const hg = new THREE.Group();
      hg.rotation.y = phi;
      hg.add(M(sphere(1, 12, 8), toon(0x86b85a), 0, cy - 0.5, r + 0.05, { sx: 0.46, sy: 0.92, sz: 0.1, rx: 0.3 }));
      g.add(hg);
    }
    for (let i = 0; i < 5; i++) g.add(M(cone(0.045, 0.42, 5), toon(0xf6e7a8), (i - 2) * 0.08, cy + half + r + 0.16, 0, { rz: -(i - 2) * 0.28 }));
    return { cy, faceY: cy + 0.06, surf: (x) => Math.sqrt(Math.max(0.02, r * r - x * x)), sx: r, armY: cy - 0.15, top: cy + half + r, trim: 0x2a6f77, legX: 0.26 };
  },
  cheese(g) {
    const R = 1.08, h = 1.56, cy = 0.3 + h / 2, zf = R * 0.5;
    const c = 0xf7c948, rind = 0xe8b032, hole = 0xdba226;
    const wedge = cached(`wedge:${h}`, () => { const w = new THREE.CylinderGeometry(R, R, h, 3); w.rotateY(Math.PI); return w; });
    const slab = cached('wedgeslab', () => { const w = new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.08, 3); w.rotateY(Math.PI); return w; });
    g.add(M(wedge, toon(c), 0, cy, 0));
    g.add(M(slab, toon(rind), 0, cy + h / 2, 0));
    g.add(M(slab, toon(rind), 0, cy - h / 2, 0));
    const holes = [[-0.56, 0.44, 0.16], [0.6, -0.42, 0.13], [0.12, -0.6, 0.09], [0.64, 0.52, 0.1], [-0.66, -0.5, 0.11]];
    for (const ry of [0, TAU / 3, -TAU / 3]) {
      const fg = new THREE.Group();
      fg.rotation.y = ry;
      for (const [x, y, r] of ry === 0 ? holes : holes.slice(0, 3)) fg.add(M(sphere(r, 9, 7), toon(hole), x * (ry === 0 ? 1 : 0.8), cy + y, zf + 0.005, { sz: 0.18 }));
      g.add(fg);
    }
    g.add(M(sphere(0.15, 9, 7), toon(hole), 0.2, cy + h / 2 + 0.045, -0.25, { sy: 0.15 }));
    g.add(M(sphere(0.1, 9, 7), toon(hole), -0.3, cy + h / 2 + 0.045, 0.1, { sy: 0.15 }));
    // the mouse inside: ears, tail — and the champ's crown
    const top = cy + h / 2;
    for (const s of [-1, 1]) {
      g.add(M(sphere(0.25, 12, 8), toon(0xc9b9a6), s * 0.5, top + 0.2, 0.18, { sz: 0.4 }));
      g.add(M(sphere(0.16, 10, 6), toon(0xf4a9b8), s * 0.5, top + 0.2, 0.25, { sz: 0.3 }));
    }
    g.add(M(cyl(0.2, 0.17, 0.14, 8), toon(0xffd45a), 0, top + 0.11, 0.12));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.add(M(cone(0.05, 0.13, 4), toon(0xffd45a), Math.cos(a) * 0.17, top + 0.24, 0.12 + Math.sin(a) * 0.17)); }
    g.add(M(torus(0.26, 0.04, 5, 12, Math.PI * 1.3), toon(0xf0a8b4), 0, 0.62, -R - 0.02, { ry: Math.PI / 2 }));
    return { cy, faceY: cy + 0.06, surf: () => zf, sx: 0.94, flat: true, armY: cy - 0.12, top, trim: 0x3f6fb5, legX: 0.34, armX: 0.74, armZ: 0.2 };
  },
};

function limbLeg(trim) {
  const g = new THREE.Group();
  g.add(M(cyl(0.12, 0.12, 0.36, 8), toon(0xfffaf0), 0, -0.14, 0));
  g.add(M(sphere(0.2, 10, 8), toon(trim), 0, -0.3, 0.09, { sx: 1.2, sy: 0.62, sz: 1.75 }));
  bake(g);
  return g;
}
function limbArm(side, trim) {
  const g = new THREE.Group();
  g.add(M(capsule(0.085, 0.16, 8), toon(0xfffaf0), side * 0.13, 0, 0, { rz: Math.PI / 2 }));
  g.add(M(sphere(0.17, 10, 8), toon(trim), side * 0.33, 0, 0));
  bake(g);
  return g;
}

/**
 * Build a mascot costume.
 * @param {'football'|'acorn'|'pumpkin'|'corn'|'cheese'} kind
 * @param {{ color?: number, scale?: number }} opts  color tints the shoes + gloves
 * @returns {{ root: THREE.Group, radius: number, height: number, kind: string, lean: {x:number,z:number},
 *             update(dt:number, speed?:number, state?:string): void }}
 */
export function buildMascot(kind = 'football', opts = {}) {
  const make = SHELLS[kind] || SHELLS.football;
  const scale = opts.scale || 1;
  const root = new THREE.Group();
  const lean = new THREE.Group();     // rocks about the feet
  const pivot = new THREE.Group();    // tumbles about the middle
  const inner = new THREE.Group();
  root.add(lean); lean.add(pivot); pivot.add(inner);
  root.scale.setScalar(scale);

  const shell = new THREE.Group();
  const m = make(shell);
  const trim = opts.color ?? m.trim;
  // cheeks ride along with the shell
  const fz = (x, y) => m.surf(x, y);
  for (const s of [-1, 1]) {
    const cx = s * 0.5, cyy = -0.12;
    shell.add(M(sphere(0.1, 8, 6), toon(0xf59aa6), cx, m.faceY + cyy, fz(cx, m.faceY + cyy - m.cy) - 0.01, { sz: 0.3, ry: m.flat ? 0 : s * 0.5 }));
  }
  bake(shell);
  inner.add(shell);
  pivot.position.y = m.cy; inner.position.y = -m.cy;

  // eyes (each baked to one mesh so a blink is a single scale)
  const eyes = [];
  for (const s of [-1, 1]) {
    const ex = s * 0.28, ey = 0.16;
    const eg = new THREE.Group();
    eg.add(M(sphere(0.2, 12, 10), toon(0xffffff), 0, 0, 0, { sy: 1.25, sz: 0.5 }));
    eg.add(M(sphere(0.095, 10, 8), toon(0x231a26), -s * 0.035, -0.03, 0.085, { sy: 1.2, sz: 0.5 }));
    eg.add(M(sphere(0.035, 6, 5), toon(0xffffff), -s * 0.035 + 0.04, 0.05, 0.125));
    bake(eg);
    eg.position.set(ex, m.faceY + ey, fz(ex, m.faceY + ey - m.cy) + 0.01);
    if (!m.flat) eg.rotation.y = s * Math.asin(Math.min(0.9, 0.28 / m.sx)) * 0.75;
    inner.add(eg);
    eyes.push(eg);
  }
  const mz = fz(0, m.faceY - 0.2 - m.cy) + 0.02;
  const smile = M(torus(0.2, 0.042, 6, 12, Math.PI), toon(0x3a1f26), 0, m.faceY - 0.12, mz, { rz: Math.PI, shadow: false });
  const ooh = M(sphere(0.14, 10, 8), toon(0x3a1f26), 0, m.faceY - 0.22, mz, { sz: 0.3, sy: 1.2, shadow: false });
  ooh.visible = false;
  inner.add(smile, ooh);

  // limbs
  const legL = limbLeg(trim), legR = limbLeg(trim);
  legL.position.set(m.legX, 0.4, 0); legR.position.set(-m.legX, 0.4, 0);
  inner.add(legL, legR);
  const ax = m.armX ?? (m.flat ? m.sx : m.sx * Math.sqrt(Math.max(0.05, 1 - ((m.armY - m.cy) / 1.0) ** 2)) - 0.06);
  const armL = limbArm(1, trim), armR = limbArm(-1, trim);
  armL.position.set(ax, m.armY, m.armZ ?? 0.1); armR.position.set(-ax, m.armY, m.armZ ?? 0.1);
  inner.add(armL, armR);

  const blob = new THREE.Mesh(circle(0.95, 20), new THREE.MeshBasicMaterial({ color: 0x1b1024, transparent: true, opacity: 0.26, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  blob.renderOrder = 2;
  root.add(blob);

  const seed = Math.random() * 10;
  const st = { t: seed, phase: seed, tumble: 0, blink: 1 + Math.random() * 3, rock: 0, bob: 0, sq: 1, legL: 0, legR: 0, armL: -0.25, armR: -0.25, lx: 0, lz: 0 };
  const out = {
    root, kind, radius: 0.85 * scale, height: (m.top + 0.1) * scale, lean: { x: 0, z: 0 }, blob,
    parts: { lean, pivot, inner, eyes, smile, ooh, legL, legR, armL, armR },
    /** Animate. speed = ground speed (units/s); state = idle | run | jump | fall | cheer. */
    update(dt, speed = 0, state = 'idle') {
      st.t += dt;
      const t = st.t;
      const grounded = state !== 'jump' && state !== 'fall';
      const moving = grounded && state !== 'cheer' && (state === 'run' || speed > 0.4);
      if (moving) st.phase += dt * (5.2 + Math.min(speed, 9) * 1.5);
      let rock = Math.sin(t * 1.4) * 0.03, bob = 0, sq = 1 + Math.sin(t * 2.3) * 0.015;
      let lL = 0, lR = 0, aL = -0.25 + Math.sin(t * 2.3) * 0.05, aR = aL, wide = false;
      if (state === 'fall') {
        st.tumble += dt * 8.5;
        aL = 1.1 + Math.sin(t * 28) * 0.55; aR = 1.1 - Math.sin(t * 28) * 0.55;
        lL = Math.sin(t * 22) * 0.8; lR = -lL; wide = true; sq = 1; rock = 0;
      } else {
        // settle upright again
        st.tumble %= TAU;
        if (st.tumble > Math.PI) st.tumble -= TAU;
        st.tumble *= Math.max(0, 1 - 10 * dt);
        if (state === 'jump') { sq = 1.13; aL = aR = 1.25; lL = lR = 0.6; wide = true; rock = 0; }
        else if (state === 'cheer') { bob = Math.abs(Math.sin(t * 8)) * 0.34; aL = 1.3 + Math.sin(t * 17) * 0.3; aR = 1.3 - Math.sin(t * 17) * 0.3; sq = 1 + Math.sin(t * 16) * 0.05; }
        else if (moving) {
          const s = Math.sin(st.phase);
          rock = s * 0.16; bob = Math.abs(Math.cos(st.phase)) * 0.1; sq = 1 - Math.abs(s) * 0.05;
          lL = s * 0.78; lR = -s * 0.78; aL = 0.1 + s * 0.3; aR = 0.1 - s * 0.3;
        }
      }
      const k = 1 - Math.exp(-16 * dt);
      st.rock += (rock - st.rock) * k; st.bob += (bob - st.bob) * k; st.sq += (sq - st.sq) * k;
      st.legL += (lL - st.legL) * k; st.legR += (lR - st.legR) * k; st.armL += (aL - st.armL) * k; st.armR += (aR - st.armR) * k;
      st.lx += (out.lean.x - st.lx) * k; st.lz += (out.lean.z - st.lz) * k;
      lean.rotation.set(st.lx, 0, st.rock + st.lz);
      lean.position.y = st.bob;
      const inv = 1 / Math.sqrt(st.sq);
      lean.scale.set(inv, st.sq, inv);
      pivot.rotation.x = st.tumble;
      legL.rotation.x = -st.legL; legR.rotation.x = -st.legR;
      armL.rotation.z = st.armL; armR.rotation.z = -st.armR;
      // face
      st.blink -= dt;
      let ey = wide ? 1.18 : 1;
      if (!wide && st.blink < 0.1) ey = 0.12;
      if (st.blink < 0) st.blink = 1.6 + Math.random() * 3.5;
      for (const e of eyes) e.scale.set(wide ? 1.1 : 1, ey, 1);
      smile.visible = !wide; ooh.visible = wide;
      // keep the blob on the floor while the costume hops
      const y = root.position.y;
      blob.visible = y > -0.05;
      blob.position.y = 0.03 - y / scale;
      blob.scale.setScalar(Math.max(0.45, 1 - Math.max(0, y) * 0.22));
    },
  };
  return out;
}
