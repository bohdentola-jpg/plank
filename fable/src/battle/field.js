// Battle venues: a compact football field as a diorama, dressed per region,
// plus that region's on-field hazard. World coordinates:
//   x: 0 = your goal line … L = theirs (you attack +x); z: −HW (top) … +HW (bottom).
import * as THREE from 'three';
import { toon, lit, M, rbox, box, cyl, sphere, circle, lightRig, bake, glowSprite, FONT, canvasTex, roundRect } from '../art/kit.js';
import { PROPS, fence as fenceProp, bunting } from '../art/props.js';
import { Character } from '../art/characters.js';
import { NPCS } from '../data/npcs.js';
import { makeRng, TAU } from '../core/util.js';

const PPU = 16;

const THEMES = {
  practice: { g1: '#7fb357', g2: '#8cbf63', out: '#8dbd62', line: 'rgba(255,255,255,0.8)', sky: null, music: 'battle', weeds: true },
  backyard: { g1: '#7fb655', g2: '#8cc261', out: '#89bb5e', line: 'rgba(255,255,255,0.9)', sky: null, music: 'battle', crooked: true },
  blitz: { g1: '#84b85a', g2: '#91c467', out: '#89bb5e', line: 'rgba(255,255,255,0.85)', sky: null, music: 'minigame', crooked: true },
  fair: { g1: '#a9b85a', g2: '#b6c466', out: '#c2b06a', line: 'rgba(255,250,235,0.92)', sky: null, music: 'battle' },
  frost: { g1: '#dcecf6', g2: '#e9f4fb', out: '#f4fafe', line: 'rgba(70,120,170,0.75)', sky: 'snow', music: 'battle', leaves: false, text: '#4a78aa' },
  neon: { g1: '#2e2562', g2: '#372c72', out: '#1e1840', line: 'rgba(120,230,255,0.9)', sky: 'neon', music: 'rival', leaves: false, text: '#58e6ff' },
  stadium: { g1: '#3f7a52', g2: '#478659', out: '#3a4a5a', line: 'rgba(255,255,255,0.92)', sky: 'bowl', music: 'bowl', leaves: false },
};

export function buildField(scene, o) {
  const { venue = 'backyard', L = 50, HW = 10, EZ = 6, home, away, tod = 'day', hazard } = o;
  const th = THEMES[venue] || THEMES.backyard;
  const sky = th.sky || (tod === 'night' ? 'night' : tod === 'dusk' ? 'dusk' : 'day');
  const rig = lightRig(scene, sky, { shadowSize: 30, fog: venue === 'stadium' ? [55, 120] : [80, 190] });
  const night = sky === 'night' || sky === 'dusk' || sky === 'neon' || sky === 'bowl';
  const root = new THREE.Group();
  scene.add(root);
  const stat = new THREE.Group(); root.add(stat);
  const dyn = new THREE.Group(); root.add(dyn);
  const r = makeRng(L * 7 + venue.length * 13);
  const updaters = [];
  const crowd = [];

  // ---------------------------------------------------------------- ground
  const padX = 9, padN = 10, padS = 7;
  const gx0 = -EZ - padX, gz0 = -HW - padN, gw = L + EZ * 2 + padX * 2, gd = HW * 2 + padN + padS;
  const tex = canvasTex(Math.round(gw * PPU), Math.round(gd * PPU), (c) => {
    const X = (x) => (x - gx0) * PPU, Z = (z) => (z - gz0) * PPU;
    c.fillStyle = th.out; c.fillRect(0, 0, gw * PPU, gd * PPU);
    for (let i = 0; i < 260; i++) { c.fillStyle = ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.04)'][i % 2]; c.beginPath(); c.ellipse(r() * gw * PPU, r() * gd * PPU, (0.6 + r() * 1.4) * PPU, (0.4 + r()) * PPU, r() * 3, 0, TAU); c.fill(); }
    // mowed stripes
    const n = L / 5;
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? th.g2 : th.g1; c.fillRect(X(i * 5), Z(-HW), 5 * PPU + 1, HW * 2 * PPU); }
    // end zones
    c.fillStyle = home.color; c.fillRect(X(-EZ), Z(-HW), EZ * PPU, HW * 2 * PPU);
    c.fillStyle = away.color; c.fillRect(X(L), Z(-HW), EZ * PPU, HW * 2 * PPU);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = -HW; i < HW; i += 2) { c.fillRect(X(-EZ), Z(i), EZ * PPU, PPU); c.fillRect(X(L), Z(i), EZ * PPU, PPU); }
    const label = (text, x, rot) => {
      c.save(); c.translate(X(x), Z(0)); c.rotate(rot);
      let fs = EZ * 0.62 * PPU;
      c.font = `900 ${fs}px ${FONT}`;
      while (c.measureText(text).width > HW * 1.8 * PPU && fs > 10) { fs -= 2; c.font = `900 ${fs}px ${FONT}`; }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = fs * 0.14; c.strokeStyle = 'rgba(27,16,36,0.55)'; c.lineJoin = 'round'; c.strokeText(text, 0, 0);
      c.fillStyle = '#fff4dc'; c.fillText(text, 0, 0);
      c.restore();
    };
    label(home.name.toUpperCase(), -EZ / 2, -Math.PI / 2);
    label(away.short.toUpperCase(), L + EZ / 2, Math.PI / 2);
    // yard lines
    c.strokeStyle = th.line; c.lineCap = 'butt';
    for (let i = 0; i <= n; i++) {
      const wob = th.crooked ? (((i * 7) % 5) - 2) * 0.09 : 0;
      c.lineWidth = (i % 2 === 0 ? 0.18 : 0.1) * PPU;
      c.beginPath(); c.moveTo(X(i * 5 + wob), Z(-HW)); c.lineTo(X(i * 5 - wob), Z(HW)); c.stroke();
    }
    // hash marks
    c.lineWidth = 0.09 * PPU;
    for (let x = 1; x < L; x++) if (x % 5) for (const z of [-HW + 0.3, -3, 3, HW - 0.9]) { c.beginPath(); c.moveTo(X(x), Z(z)); c.lineTo(X(x), Z(z + 0.6)); c.stroke(); }
    // numbers
    c.fillStyle = th.text || 'rgba(255,255,255,0.85)';
    c.font = `900 ${2.0 * PPU}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let x = 10; x < L; x += 10) {
      const num = String(Math.min(x, L - x));
      for (const z of [-HW + 2.8, HW - 2.8]) c.fillText(num, X(x), Z(z));
    }
    // border
    c.lineWidth = 0.24 * PPU; c.strokeStyle = th.line;
    c.strokeRect(X(-EZ), Z(-HW), (L + EZ * 2) * PPU, HW * 2 * PPU);
    if (th.weeds) { c.fillStyle = 'rgba(110,150,70,0.5)'; for (let i = 0; i < 120; i++) { c.beginPath(); c.ellipse(X(-EZ + r() * (L + EZ * 2)), Z(-HW + r() * HW * 2), (0.3 + r() * 0.8) * PPU, (0.2 + r() * 0.5) * PPU, r() * 3, 0, TAU); c.fill(); } }
    if (th.leaves !== false) { for (let i = 0; i < 520; i++) { c.fillStyle = ['#e8842c', '#d4502f', '#f2b632', '#c9652a'][i % 4]; c.beginPath(); c.ellipse(r() * gw * PPU, r() * gd * PPU, (0.07 + r() * 0.1) * PPU, 0.07 * PPU, r() * 3, 0, TAU); c.fill(); } }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(gx0 + gw / 2, 0, gz0 + gd / 2);
  ground.receiveShadow = true;
  root.add(ground);
  const slab = M(new THREE.BoxGeometry(gw + 0.8, 2.4, gd + 0.8), toon(0x7a5a48), gx0 + gw / 2, -1.21, gz0 + gd / 2, { shadow: false });
  root.add(slab);
  root.add(M(new THREE.BoxGeometry(gw + 1.2, 0.3, gd + 1.2), toon(0xd9c9a8), gx0 + gw / 2, -0.17, gz0 + gd / 2, { shadow: false }));

  const put = (name, x, z, opts = {}) => {
    const p = PROPS[name]({ night, ...opts });
    p.position.x += x; p.position.z += z;
    if (opts.ry) p.rotation.y += opts.ry;
    if (opts.y) p.position.y += opts.y;
    (p.userData.keep ? dyn : stat).add(p);
    return p;
  };
  const fan = (spec, x, z, face = 0) => {
    const ch = new Character(spec);
    ch.setPos(x, z); ch.face(face); ch.setBase('move');
    dyn.add(ch.root);
    crowd.push(ch);
    return ch;
  };

  // goalposts
  put('goalpost', -EZ - 0.3, 0, { w: 5.2, ry: Math.PI / 2, crooked: th.crooked ? 0.07 : 0, color: venue === 'neon' ? 0x58e6ff : 0xffd45a });
  put('goalpost', L + EZ + 0.3, 0, { w: 5.2, ry: Math.PI / 2, crooked: th.crooked ? -0.06 : 0, color: venue === 'neon' ? 0xff5ad0 : 0xffd45a });

  // ---------------------------------------------------------------- dressing per venue
  const N = -HW - 2.2, Sz = HW + 2.2;       // sideline rows
  const townies = ['hamm', 'mittens', 'quill', 'biscuit', 'dot', 'marigold', 'croaker', 'nan', 'bleat', 'gus'].map((k) => NPCS[k].spec);
  if (venue === 'backyard' || venue === 'blitz') {
    stat.add(fenceProp(-EZ - 6, N - 2.4, L + EZ + 6, N - 2.4, { style: 'picket' }));
    stat.add(fenceProp(-EZ - 6, Sz + 2, L / 2 - 4, Sz + 2, { style: 'wood', h: 1.1 }));
    stat.add(fenceProp(L / 2 + 4, Sz + 2, L + EZ + 6, Sz + 2, { style: 'wood', h: 1.1 }));
    for (let i = 0; i < Math.round(L / 3.4); i++) {
      const x = 3 + i * 3.3 + (i % 3) * 0.3;
      if (x > L - 2) break;
      put('foldingChair', x, N, { color: [0x8f9aa6, 0xd4502f, 0x58b8c9, 0xffd45a][i % 4], ry: 0 });
      if (i % 2 === 0) { const f = fan(townies[i % townies.length], x, N + 0.25, 0); f.setBase('sit'); f.root.position.y = 0.38; }
    }
    for (const [x, c] of [[4, 0xf2d9b8], [L / 2, 0xf7efe0], [L - 4, 0xdfeedd]]) put('house', x, N - 6.6, { w: 7, d: 5, wall: c, roof: [0x2a6f77, 0xc8452d, 0x8a5aa8][Math.round(x) % 3] });
    put('tree', -EZ - 4, N - 1, { rng: r }); put('tree', L + EZ + 4.5, N - 0.5, { rng: r }); put('tree', L * 0.3, N - 5, { rng: r, s: 1.2 }); put('tree', L * 0.72, N - 5.4, { rng: r });
    put('gnomeStatue', L / 2, N + 1.1, { color: 0x6aa84f });
    put('grill', L + EZ + 3, Sz - 3); put('kiddiePool', -EZ - 4.6, Sz - 2);
    put('waterCooler', L / 2 - 6, Sz); put('bench', L / 2 - 2.6, Sz + 0.2); put('lawnChair', L / 2 + 6, Sz, { color: 0xd4502f });
    for (let i = 0; i < 4; i++) fan({ kind: 'gnome', build: 'small', shirt: 0x3f6fb5, helmet: { color: 0xc8452d, stripe: 0xfff4dc } }, L - 6 - i * 1.6, Sz + 0.6, Math.PI);
  } else if (venue === 'practice') {
    stat.add(fenceProp(-EZ - 6, N - 1.5, L + EZ + 6, N - 1.5, { style: 'rail' }));
    put('clubhouse', L * 0.25, N - 7, { fixed: 0 }); put('lightTower', L * 0.75, N - 4, { h: 9, on: false });
    for (let i = 0; i < 4; i++) put('tackleDummy', 8 + i * 2.2, N);
    put('waterCooler', L / 2, Sz); put('bench', L / 2 - 4, Sz + 0.2); put('bench', L / 2 + 4, Sz + 0.2);
    for (const [x, z] of [[-EZ - 5, N - 3], [L + EZ + 5, N - 2], [L * 0.55, N - 6], [-EZ - 4, Sz + 1], [L + EZ + 4, Sz]]) put('tree', x, z, { rng: r });
    fan(NPCS.marigold.spec, L / 2 + 1, Sz + 0.4, Math.PI); fan(NPCS.maple.spec, L / 2 - 1.4, Sz + 0.5, Math.PI);
  } else if (venue === 'fair') {
    for (let i = 0; i < 4; i++) put('tent', 2 + i * (L / 3.3), N - 4 - (i % 2) * 2, { color: [0xd4502f, 0x2a6f77, 0xf2b632, 0x8a5aa8][i], r: 2.2 });
    put('ferrisWheel', L * 0.62, N - 8.5, {});
    stat.add(bunting(-EZ, N - 1.2, L / 2, N - 1.2, { y: 3 })); stat.add(bunting(L / 2, N - 1.2, L + EZ, N - 1.2, { y: 3 }));
    for (let i = 0; i < 7; i++) put('hayBale', -2 + i * (L / 6), N + 0.2, {});
    for (let i = 0; i < 6; i++) put('cornBlock', -EZ - 4 + i * (L / 4.4), Sz + 3.2, { w: 6, d: 2.4, seed: i });
    for (let i = 0; i < 6; i++) put('pumpkin', L * r(), Sz + 0.6 + r(), { s: 0.7 + r() * 0.6 });
    put('scarecrowPost', L + EZ + 4, N); put('booth', -EZ - 3.4, N - 0.5, { text: 'CIDER', color: 0xd4502f, ry: 0.3 });
    for (let i = 0; i < 6; i++) fan(i % 2 ? { kind: 'scarecrow', shirt: 0x4a6fa5 } : townies[i], 4 + i * (L / 6.4), N + 1.5, 0).setBase('cheer');
  } else if (venue === 'frost') {
    for (let i = 0; i < 9; i++) put('tree', -EZ - 5 + i * ((L + EZ * 2 + 10) / 8), N - 3 - (i % 2) * 2.4, { kind: 'pine', snow: true, s: 1 + (i % 3) * 0.15, rng: r });
    put('cabin', L * 0.3, N - 7.5, {}); put('igloo', L * 0.72, N - 5, {}); put('skiLift', L + EZ + 5, N - 3, {});
    for (let i = 0; i < 8; i++) put('snowPile', -EZ - 3 + i * (L / 6), N + 0.4 + (i % 2) * 0.3, { s: 0.8 + (i % 3) * 0.3 });
    for (let i = 0; i < 6; i++) put('icicleRock', L * r(), Sz + 1 + r(), { s: 0.6 + r() * 0.5 });
    put('bench', L / 2, Sz + 0.2);
    for (let i = 0; i < 5; i++) fan({ kind: 'animal', species: 'penguin', build: 'small', shirt: 0x2a6f9a, acc: ['scarf'] }, 6 + i * (L / 5.4), N + 1.6, 0).setBase('cheer');
  } else if (venue === 'neon') {
    stat.add(M(box(L + EZ * 2 + 18, 5, 1), toon(0x241c52), L / 2, 2.5, N - 6.5));
    for (let i = 0; i < 5; i++) put('neonSign', 3 + i * (L / 4.3), N - 5.6, { text: ['BUZZ', 'HI-SCORE', 'INSERT COIN', '1UP', 'GAME ON'][i], color: [0xff5ad0, 0x58e6ff, 0xffd45a, 0xb6f08a, 0xff5ad0][i], w: 4.4, h: 1.3, y: 3.4, wall: true });
    for (let i = 0; i < 10; i++) put('arcadeCabinet', -EZ + i * ((L + EZ * 2) / 9), N - 1.2, { color: [0x5a3f8a, 0x2a3a6a, 0x8a2f6a][i % 3], neon: [0x58e6ff, 0xff5ad0, 0xffd45a][i % 3] });
    for (let i = 0; i < 6; i++) fan({ kind: 'robot', neon: [0x58e6ff, 0xff5ad0, 0xb6f08a][i % 3], jersey: 0x4a3ad6 }, 5 + i * (L / 6), N + 0.9, 0).setBase('cheer');
    for (const x of [-EZ - 4, L + EZ + 4]) { const g = glowSprite(0xb07aff, 14, 0.25); g.position.set(x, 3, 0); dyn.add(g); }
  } else if (venue === 'stadium') {
    for (const s of [-1, 1]) {
      const z = s < 0 ? N - 1.5 : Sz + 2.8;
      for (let k = 0; k < 3; k++) { const b = put('bleachers', 6 + k * (L / 2.3), z, { len: L / 2.6, rows: s < 0 ? 6 : 3, ry: s < 0 ? 0 : Math.PI, color: 0xb9b0c4 }); void b; }
    }
    const sb = put('scoreboard', L / 2, N - 9.5, { w: 12, h: 4.6, lines: o.boardLines || ['MIDNIGHT', 'BOWL'] });
    sb.position.y = 3.5;
    root.userData.scoreboard = sb;
    for (const x of [-EZ - 5, L + EZ + 5]) for (const z of [N - 5, Sz + 4]) put('lightTower', x, z, { h: 11, on: true });
    // the ghost crowd: little lantern-lit blobs that bob
    const blobs = new THREE.InstancedMesh(sphere(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0.7 }), 150);
    const mm = new THREE.Matrix4();
    const seats = [];
    for (let i = 0; i < 150; i++) { const row = i % 6, x = 1 + r() * (L - 2), z = N - 1.6 - row * 0.72, y = 0.9 + row * 0.5; seats.push([x, y, z, r() * 6]); mm.makeTranslation(x, y, z); blobs.setMatrixAt(i, mm); }
    dyn.add(blobs);
    updaters.push((dt, t, hype) => { for (let i = 0; i < 150; i++) { const s = seats[i]; mm.makeTranslation(s[0], s[1] + Math.abs(Math.sin(t * (2 + hype * 5) + s[3])) * (0.08 + hype * 0.4), s[2]); blobs.setMatrixAt(i, mm); } blobs.instanceMatrix.needsUpdate = true; });
  }
  if (venue === 'blitz') { put('trampoline', L + EZ + 3.4, -4); put('doghouse', -EZ - 4, -6, {}); }

  // ---------------------------------------------------------------- hazards
  const hz = { type: hazard || null, list: [], dark: 0 };
  if (hazard === 'sprinklers') {
    const spots = venue === 'blitz' ? [[L * 0.3, -3.5], [L * 0.62, 3.5]] : [[L * 0.24, -4.6], [L * 0.5, 4.8], [L * 0.76, -3.6]];
    spots.forEach(([x, z], i) => { put('sprinkler', x, z); hz.list.push({ x, z, r: 2.6, period: 5.5, duty: 0.5, phase: i * 1.9, on: false, spin: 0 }); });
  } else if (hazard === 'bales') {
    for (const [x, z] of [[L * 0.3, 4.4], [L * 0.52, -4.8], [L * 0.72, 2.6]]) { put('hayBale', x, z, {}); hz.list.push({ x, z, r: 1.15, solid: true }); }
  } else if (hazard === 'ice') {
    for (const [x, z, w, d] of [[L * 0.3, -3.5, 7, 9], [L * 0.62, 3.2, 8, 9]]) {
      const m = M(box(w, 0.03, d), toon(0xbfe6f5, { transparent: true, opacity: 0.85 }), x, 0.03, z, { shadow: false });
      m.userData.keep = true; dyn.add(m);
      dyn.add(M(box(w * 0.5, 0.035, 0.12), toon(0xffffff), x - w * 0.1, 0.05, z - d * 0.2, { ry: 0.5, shadow: false }));
      hz.list.push({ x, z, w, d, ice: true });
    }
  }

  bake(stat);
  rig.follow(L / 2, 0);

  return {
    root, rig, hz, crowd, night, L, HW, EZ, theme: th, music: th.music,
    update(dt, t, hype = 0) {
      for (const u of updaters) u(dt, t, hype);
      for (const c of crowd) { c.update(dt, 0); }
      const fw = root.userData.spin; void fw;
    },
    cheer(on) { for (const c of crowd) { if (on) c.play('celebrate', 1.2 + Math.random()); } },
    dispose() { scene.remove(root); scene.remove(rig.sun, rig.sun.target, rig.hemi); },
  };
}

export { THEMES, roundRect, lit, rbox, cyl, circle };
