import { emblemCanvas } from './portraits.js';
import { charById } from './roster.js';

// Six stages. Each one is collision data the sim reads, a build() that raises
// the scenery, an optional hazard() that runs every frame, and a thumb() that
// paints its own select-screen tile.
//
// Collision convention: `solids` are walkable and block from every side (y is
// the TOP surface, h the thickness); `soft` platforms can be jumped through from
// below and dropped through with down. `ledges` list the x positions you can hang on.

// ============================================================ HOMETOWN FIELD
const HOMEFIELD = {
  id: 'homefield', name: 'HOMETOWN FIELD', blurb: 'Friday night, 50-yard line, the whole town watching.',
  music: 'gridiron', friction: 1,
  cam: { minW: 13, maxW: 31, yBias: 0.9 },
  blast: { left: -21, right: 21, top: 17, bottom: -12 },
  spawns: [{ x: -6, y: 5 }, { x: 6, y: 5 }, { x: -2.5, y: 8 }, { x: 2.5, y: 8 }],
  solids: [{ x: 0, y: 0, w: 25, h: 3.2, ledges: [-12.5, 12.5] }],
  soft: [{ x: -8.4, y: 5.4, w: 6.4 }, { x: 8.4, y: 5.4, w: 6.4 }],
  light: { ambient: '#8b95bd', ambientI: 0.8, key: '#ffe9c0', keyI: 1.0, rim: '#5f7fd0' },
  fog: { color: '#1b2444', near: 40, far: 120 },
  build(k) {
    const g = new k.THREE.Group();
    g.add(k.skyDome(['#0a1230', '#152250', '#2c3d74', '#5c4b78', '#b4653f', '#e0965a']));
    // the turf slab, mow stripes painted in a 64px tile
    const turf = k.tileMat(64, (ctx, s) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#2c6a2e' : '#367c36';
        ctx.fillRect((i * s) / 8, 0, s / 8 + 1, s);
      }
      ctx.fillStyle = '#e8e8e0';
      ctx.fillRect(s / 2 - 1, 0, 2, s);
    }, [6, 1]);
    const slab = k.box(25, 3.2, 4.6, turf);
    k.put(slab, 0, -1.6, 0);
    g.add(slab);
    const dirt = k.box(25.4, 0.5, 5.0, k.mat('#6b4a2c'));
    k.put(dirt, 0, -3.2, 0);
    g.add(dirt);
    // end-zone paint blocks at both ends
    for (const sx of [-1, 1]) {
      const ez = k.box(3.4, 0.06, 4.6, k.mat('#14306e'));
      k.put(ez, sx * 10.6, 0.02, 0);
      g.add(ez);
    }
    // goalposts double as the soft platforms
    for (const sx of [-1, 1]) {
      const post = k.cyl(0.14, 0.14, 5.4, k.mat('#f2b705', { shin: 30 }), 6);
      k.put(post, sx * 8.4, 2.7, -0.6);
      g.add(post);
      const bar = k.box(6.4, 0.34, 0.6, k.mat('#f2b705', { shin: 30 }));
      k.put(bar, sx * 8.4, 5.25, 0);
      g.add(bar);
      for (const ux of [-1, 1]) {
        const up = k.cyl(0.11, 0.11, 3.2, k.mat('#f2b705', { shin: 30 }), 6);
        k.put(up, sx * 8.4 + ux * 3.1, 6.9, 0);
        g.add(up);
      }
    }
    // bleachers behind, kept dark so the fighters stay the brightest thing on
    // screen, with a blocky crowd in school colours
    for (const sz of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        const stand = k.box(30, 0.7, 1.5, k.mat(row % 2 ? '#3d4354' : '#474e60'));
        k.put(stand, 0, -1.4 + row * 0.7, sz * (7 + row * 1.4));
        g.add(stand);
        for (let i = -9; i <= 9; i++) {
          if (k.seeded(row * 40 + i + (sz > 0 ? 7 : 0)) < 0.45) continue;
          const navy = k.seeded(i * 3 + row) > 0.5;
          const p = k.box(0.32, 0.46, 0.3, k.mat(navy ? '#1d2a52' : '#8a6a1e'));
          k.put(p, i * 1.55 + (k.seeded(i + row) - 0.5), -0.86 + row * 0.7, sz * (7 + row * 1.4));
          g.add(p);
        }
      }
    }
    // light towers
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const mast = k.cyl(0.16, 0.22, 16, k.mat('#4a4f5a'), 6);
        k.put(mast, sx * 15, 8, sz * 13);
        g.add(mast);
        const rack = k.box(4.2, 1.6, 0.4, k.mat('#2f333b'));
        k.put(rack, sx * 15, 16.2, sz * 13);
        g.add(rack);
        for (let i = -1; i <= 1; i++) {
          const lamp = k.box(1.1, 1.1, 0.3, k.mat('#fff6d0', { basic: true }));
          k.put(lamp, sx * 15 + i * 1.35, 16.2, sz * 13 + (sz > 0 ? -0.3 : 0.3));
          g.add(lamp);
        }
      }
    }
    // scoreboard, with an actual scoreline burned into a 64px LED texture
    const board = k.box(9, 4.4, 0.7, k.mat('#1b1d24'));
    k.put(board, 0, 9.6, -16);
    const ledTex = k.tileMat(64, (ctx, sz) => {
      ctx.fillStyle = '#120e05';
      ctx.fillRect(0, 0, sz, sz);
      // the board is 2.5x wider than tall, so squash the glyphs to compensate
      ctx.save();
      ctx.scale(0.4, 1);
      ctx.font = `700 ${sz * 0.3}px 'Arial Narrow', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f2b705';
      ctx.fillText('HOME 24', sz * 1.25, sz * 0.34);
      ctx.fillText('AWAY 17', sz * 1.25, sz * 0.66);
      ctx.fillStyle = '#e8433f';
      ctx.fillText('4TH  1:08', sz * 1.25, sz * 0.96);
      ctx.restore();
      // scanline gaps so it reads as an LED board, not a poster
      ctx.fillStyle = 'rgba(10,8,4,0.55)';
      for (let y = 0; y < sz; y += 3) ctx.fillRect(0, y, sz, 1);
    }, [1, 1], { basic: true });
    const led = k.plane(7.6, 3, ledTex);
    k.put(led, 0, 9.8, -15.6);
    const boardLegs = k.box(0.6, 6, 0.6, k.mat('#2f333b'));
    k.put(boardLegs, 0, 6, -16);
    g.add(board, led, boardLegs);
    return { group: g, update() {} };
  },
  thumb(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d1636'); sky.addColorStop(0.7, '#3b3f74'); sky.addColorStop(1, '#c97a44');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f7a34'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(w * 0.18, h * 0.3, 3, h * 0.34);
    ctx.fillRect(w * 0.72, h * 0.3, 3, h * 0.34);
    ctx.fillRect(w * 0.1, h * 0.3, w * 0.2, 4);
    ctx.fillRect(w * 0.64, h * 0.3, w * 0.2, 4);
    ctx.fillStyle = '#fff6d0';
    ctx.fillRect(w * 0.06, h * 0.12, 6, 5);
    ctx.fillRect(w * 0.88, h * 0.12, 6, 5);
    ctx.fillStyle = '#e8e8e0';
    for (let i = 1; i < 6; i++) ctx.fillRect((w / 6) * i, h * 0.66, 2, h * 0.3);
  },
};

// ============================================================ ARCADE ATTIC
const ARCADE = {
  id: 'arcade', name: 'ARCADE ATTIC', blurb: 'The stockroom above the shop floor. Mind the demo kiosks.',
  music: 'arcade', friction: 1,
  cam: { minW: 12.5, maxW: 29, yBias: 1.0 },
  blast: { left: -19, right: 19, top: 16, bottom: -11 },
  spawns: [{ x: -5, y: 5 }, { x: 5, y: 5 }, { x: -1.5, y: 9 }, { x: 1.5, y: 9 }],
  solids: [{ x: 0, y: 0, w: 21, h: 2.6, ledges: [-10.5, 10.5] }],
  soft: [{ x: -6.6, y: 4.6, w: 5.2 }, { x: 6.6, y: 4.6, w: 5.2 }, { x: 0, y: 8.4, w: 5.6 }],
  light: { ambient: '#9d94b8', ambientI: 0.82, key: '#ffeccf', keyI: 0.9, rim: '#ff6ad0' },
  fog: { color: '#221a2e', near: 34, far: 100 },
  build(k) {
    const g = new k.THREE.Group();
    g.add(k.skyDome(['#1a1426', '#241a33', '#2f2140', '#3a2748']));
    const carpetTex = k.tileMat(64, (ctx, s) => {
      ctx.fillStyle = '#3a2748'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = ['#f24aa0', '#2ad6a0', '#f2d23a', '#4a8af2'][i % 4];
        ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
      }
    }, [5, 2]);
    const floor = k.box(21, 2.6, 4.6, carpetTex);
    k.put(floor, 0, -1.3, 0);
    g.add(floor);
    // shelving that matches the soft platforms
    for (const p of [[-6.6, 4.6], [6.6, 4.6], [0, 8.4]]) {
      const shelf = k.box(p[0] === 0 ? 5.6 : 5.2, 0.34, 1.8, k.mat('#8a5a2c'));
      k.put(shelf, p[0], p[1] - 0.17, 0);
      g.add(shelf);
      // boxed games stacked on top, chunky and colourful
      for (let i = -2; i <= 2; i++) {
        if (k.seeded(p[0] * 7 + i) < 0.3) continue;
        const gb = k.box(0.5, 0.72, 0.34, k.mat(['#e8433f', '#3f7ce8', '#f2c14a', '#3fbf6a', '#8a5ad6'][(i + 3) % 5]));
        k.put(gb, p[0] + i * 0.92, p[1] + 0.36, -0.6);
        g.add(gb);
      }
    }
    // demo kiosks with glowing CRTs in the background
    for (const sx of [-1, 0, 1]) {
      const cab = k.box(2.6, 4.4, 1.6, k.mat('#23262e'));
      k.put(cab, sx * 7.2, 2.2, -7.5);
      const screen = k.box(2.0, 1.5, 0.2, k.mat(['#66e2ff', '#f24aa0', '#2ad6a0'][sx + 1], { basic: true }));
      k.put(screen, sx * 7.2, 3.1, -6.66);
      const marquee = k.box(2.4, 0.8, 0.2, k.mat('#f2d23a', { basic: true }));
      k.put(marquee, sx * 7.2, 4.6, -6.7);
      g.add(cab, screen, marquee);
    }
    // ceiling strip lights
    for (const sx of [-1, 1]) {
      const tube = k.box(9, 0.24, 0.6, k.mat('#fff8e0', { basic: true }));
      k.put(tube, sx * 5, 14.4, -2);
      g.add(tube);
    }
    // a cardboard standee of the falcon, printed with his own select-screen emblem
    const standee = k.box(3, 5, 0.16, k.mat('#1d2a52'));
    k.put(standee, -11.5, 2.5, -5, 0, 16, 0);
    const print = k.plane(2.6, 2.6, k.canvasMat(emblemCanvas(charById('blitz'), 128)));
    k.put(print, -11.5, 3.4, -4.88, 0, 16, 0);
    print.position.x += 0.03;
    g.add(standee, print);
    const screens = g.children.filter((c) => c.material?.map === undefined && c.material?.color);
    return {
      group: g,
      update(dt, match) {
        // CRTs flicker on the beat-ish
        const t = match.frame;
        for (let i = 0; i < screens.length; i++) {
          const m = screens[i];
          if (!m.userData.isScreen) continue;
          m.material.opacity = 0.8 + Math.sin(t * 0.2 + i) * 0.2;
        }
      },
    };
  },
  thumb(ctx, w, h) {
    ctx.fillStyle = '#2b1e3a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a2748'; ctx.fillRect(0, h * 0.66, w, h * 0.34);
    ctx.fillStyle = '#8a5a2c';
    ctx.fillRect(w * 0.08, h * 0.46, w * 0.28, 5);
    ctx.fillRect(w * 0.64, h * 0.46, w * 0.28, 5);
    ctx.fillRect(w * 0.36, h * 0.26, w * 0.28, 5);
    const cols = ['#e8433f', '#3f7ce8', '#f2c14a', '#3fbf6a'];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = cols[i % 4];
      ctx.fillRect(w * 0.1 + i * (w * 0.1), h * 0.36 + (i % 2 ? 0 : h * 0.2), 7, 9);
    }
    ctx.fillStyle = '#66e2ff';
    ctx.fillRect(w * 0.2, h * 0.1, w * 0.16, h * 0.1);
    ctx.fillStyle = '#f24aa0';
    ctx.fillRect(w * 0.62, h * 0.1, w * 0.16, h * 0.1);
  },
};

// ============================================================ MAGMA BIN
const MAGMA = {
  id: 'magma', name: 'MAGMA BIN', blurb: 'The clearance bin at the centre of the earth. Watch the plumes.',
  music: 'volcano', friction: 1,
  cam: { minW: 13, maxW: 30, yBias: 0.9 },
  blast: { left: -20, right: 20, top: 16, bottom: -10 },
  spawns: [{ x: -5.5, y: 6 }, { x: 5.5, y: 6 }, { x: -2, y: 9 }, { x: 2, y: 9 }],
  solids: [
    { x: 0, y: 0, w: 15, h: 3, ledges: [-7.5, 7.5] },
    { x: -11.5, y: 3.4, w: 4.4, h: 1.2, ledges: [-13.7] },
    { x: 11.5, y: 3.4, w: 4.4, h: 1.2, ledges: [13.7] },
  ],
  soft: [{ x: 0, y: 6.6, w: 6 }],
  light: { ambient: '#b08070', ambientI: 0.9, key: '#ffd0a0', keyI: 0.95, rim: '#ff5a2a' },
  fog: { color: '#3a1410', near: 28, far: 90 },
  build(k) {
    const g = new k.THREE.Group();
    g.add(k.skyDome(['#1a0a10', '#33121a', '#5a1c18', '#8a2c18', '#c4491c']));
    const rock = k.tileMat(64, (ctx, s) => {
      ctx.fillStyle = '#3a2c2a'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = ['#4a3632', '#2c211f', '#5a423a'][i % 3];
        ctx.fillRect(Math.random() * s, Math.random() * s, 5, 4);
      }
      ctx.fillStyle = '#c4491c';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 3, 2);
    }, [4, 1]);
    const main = k.box(15, 3, 4.4, rock);
    k.put(main, 0, -1.5, 0);
    g.add(main);
    for (const sx of [-1, 1]) {
      const led = k.box(4.4, 1.2, 3.2, rock);
      k.put(led, sx * 11.5, 2.8, 0);
      g.add(led);
      const chain = k.cyl(0.08, 0.08, 12, k.mat('#5a4a44'), 5);
      k.put(chain, sx * 11.5, 9.4, 0);
      g.add(chain);
    }
    const soft = k.box(6, 0.3, 1.7, k.mat('#4a3632'));
    k.put(soft, 0, 6.45, 0);
    g.add(soft);
    // the lava sea, animated by scrolling its texture
    const lavaTex = k.pixTex(64, (ctx, s) => {
      ctx.fillStyle = '#e0521c'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = ['#ff8a2a', '#c22a12', '#ffd23a'][i % 3];
        ctx.fillRect(Math.random() * s, Math.random() * s, 6, 4);
      }
    }, { repeat: [8, 8] });
    const lava = k.plane(90, 60, new k.THREE.MeshBasicMaterial({ map: lavaTex }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = -8.5;
    g.add(lava);
    // background cinder cones
    for (let i = -2; i <= 2; i++) {
      const cone = k.cone(5 + k.seeded(i) * 3, 9 + k.seeded(i + 9) * 5, k.mat('#2c211f'), 5);
      k.put(cone, i * 13, -2, -22 - k.seeded(i) * 8);
      g.add(cone);
    }
    // plume markers: three vents that erupt on a timer
    const vents = [-5, 0, 5].map((x) => {
      const col = k.box(1.5, 9, 1.5, k.mat('#ff8a2a', { basic: true, opacity: 0.85 }));
      k.put(col, x, 4.5, 0);
      col.visible = false;
      g.add(col);
      return { x, mesh: col };
    });
    return {
      group: g,
      vents,
      update(dt, match) {
        lavaTex.offset.x += dt * 0.05;
        lavaTex.offset.y += dt * 0.03;
        for (const v of vents) {
          const on = match._plume && match._plume.x === v.x && match._plume.t > 0;
          v.mesh.visible = !!on;
          if (on) v.mesh.scale.set(1, 0.4 + match._plume.t / 40, 1);
        }
      },
    };
  },
  /** A lava plume erupts through one of three vents every few seconds. */
  hazard(match, frame) {
    if (frame % 420 === 200) {
      const xs = [-5, 0, 5];
      match._plume = { x: xs[(match.rand() * 3) | 0], t: 46, warn: 26 };
      match.sfx?.explode?.(0.5);
    }
    const p = match._plume;
    if (!p) return;
    p.t--;
    if (p.t <= 0) { match._plume = null; return; }
    if (p.t > 30) return;                 // warning window before it burns
    for (const f of match.fighters) {
      if (!f.alive || f.state === 'dead' || f.hitlag > 0) continue;
      if (Math.abs(f.x - p.x) > 1.1 || f.y > 8 || f.y < -1) continue;
      f.takeHit({
        dmg: 9, angle: 88, kbBase: 44, kbGrowth: 66, hitlag: 1.2, fx: 'flame', sfx: 'burn',
        r: 1, x: 0, y: 0, group: 99, setKb: 0, noFlip: false, noShield: true, grabHit: null, shieldDmg: 0,
      }, null, { dir: Math.sign(f.x - p.x) || 1, fromX: p.x });
      match.fx?.spark?.(f.x, f.y + 0.6, 'flame', 0.8);
    }
  },
  thumb(ctx, w, h) {
    ctx.fillStyle = '#3a1410'; ctx.fillRect(0, 0, w, h);
    const lava = ctx.createLinearGradient(0, h * 0.7, 0, h);
    lava.addColorStop(0, '#ff8a2a'); lava.addColorStop(1, '#c22a12');
    ctx.fillStyle = lava; ctx.fillRect(0, h * 0.74, w, h * 0.26);
    ctx.fillStyle = '#2c211f';
    ctx.fillRect(w * 0.28, h * 0.56, w * 0.44, h * 0.2);
    ctx.fillRect(w * 0.04, h * 0.44, w * 0.16, h * 0.08);
    ctx.fillRect(w * 0.8, h * 0.44, w * 0.16, h * 0.08);
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(w * 0.46, h * 0.2, w * 0.08, h * 0.36);
    ctx.fillStyle = '#5a1c18';
    ctx.beginPath(); ctx.moveTo(0, h * 0.74); ctx.lineTo(w * 0.2, h * 0.3); ctx.lineTo(w * 0.42, h * 0.74); ctx.fill();
  },
};

// ============================================================ SKY BLIMP
const BLIMP = {
  id: 'blimp', name: 'SKY BLIMP', blurb: 'The store blimp, still advertising a sale from 2003.',
  music: 'blimp', friction: 1,
  cam: { minW: 13, maxW: 29, yBias: 0.85 },
  blast: { left: -20, right: 20, top: 17, bottom: -12 },
  spawns: [{ x: -4.5, y: 6 }, { x: 4.5, y: 6 }, { x: -1.5, y: 9 }, { x: 1.5, y: 9 }],
  solids: [{ x: 0, y: 0, w: 17, h: 2.2, ledges: [-8.5, 8.5] }],
  soft: [{ x: -7.5, y: 5.2, w: 4.6 }, { x: 7.5, y: 5.2, w: 4.6 }],
  light: { ambient: '#a8c0e0', ambientI: 0.92, key: '#fffaf0', keyI: 1.0, rim: '#8ab0ff' },
  fog: { color: '#a8c8e8', near: 50, far: 150 },
  build(k) {
    const g = new k.THREE.Group();
    g.add(k.skyDome(['#3d7edb', '#5b95e2', '#84b2ea', '#b6d2f2', '#dbe8f6']));
    // the envelope above, the gondola deck below
    const env = k.sph(9, k.mat('#e8433f'), 12, 8);
    env.scale.set(1.5, 0.62, 0.7);
    k.put(env, 0, 13.5, 0);
    g.add(env);
    const stripe = k.sph(9.05, k.mat('#f4f4f2'), 12, 8);
    stripe.scale.set(1.505, 0.14, 0.705);
    k.put(stripe, 0, 13.5, 0);
    g.add(stripe);
    const fin = k.box(0.3, 3.4, 3.4, k.mat('#f4f4f2'));
    k.put(fin, -13, 13.5, 0);
    g.add(fin);
    const deck = k.box(17, 2.2, 4.4, k.mat('#c9a24a', { shin: 20 }));
    k.put(deck, 0, -1.1, 0);
    g.add(deck);
    const rail = k.box(17.4, 0.24, 0.24, k.mat('#8a6a2c'));
    k.put(rail, 0, 0.6, 2.1);
    g.add(rail);
    for (const sx of [-1, 1]) {
      const cable = k.cyl(0.07, 0.07, 8, k.mat('#7a6a58'), 5);
      k.put(cable, sx * 6, 4.4, 0, 0, 0, sx * -6);
      g.add(cable);
      const wing = k.box(4.6, 0.28, 1.6, k.mat('#d9d2c0'));
      k.put(wing, sx * 7.5, 5.05, 0);
      g.add(wing);
    }
    // drifting clouds
    const clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = new k.THREE.Group();
      for (let j = 0; j < 3; j++) {
        const p = k.sph(1.6 + k.seeded(i * 3 + j) * 1.6, k.mat('#f8fbff', { basic: true }), 7, 5);
        k.put(p, (j - 1) * 2.2, k.seeded(i + j) * 0.7, 0);
        c.add(p);
      }
      k.put(c, -40 + k.seeded(i) * 80, -6 + k.seeded(i + 20) * 26, -26 - k.seeded(i + 5) * 20);
      g.add(c);
      clouds.push(c);
    }
    return {
      group: g,
      update(dt) {
        for (const c of clouds) {
          c.position.x -= dt * (1.4 + (c.position.z + 40) * 0.03);
          if (c.position.x < -46) c.position.x = 46;
        }
        // the whole blimp sways
        g.position.y = Math.sin(Date.now() / 2200) * 0.18;
      },
    };
  },
  /** A steady crosswind that makes recoveries a real decision. */
  hazard(match, frame) {
    const wind = Math.sin(frame / 260) * 2.6;
    match._wind = wind;
    for (const f of match.fighters) {
      if (!f.alive || f.grounded || f.hitlag > 0) continue;
      f.vx += wind * (1 / 60) * 1.6;
    }
  },
  thumb(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3d7edb'); sky.addColorStop(1, '#cfe2f6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f8fbff';
    ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.7, w * 0.18, h * 0.07, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.82, h * 0.4, w * 0.14, h * 0.06, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#e8433f';
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.3, w * 0.34, h * 0.16, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#f4f4f2';
    ctx.fillRect(w * 0.16, h * 0.29, w * 0.68, 4);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(w * 0.28, h * 0.62, w * 0.44, h * 0.08);
  },
};

// ============================================================ FROZEN POND
const POND = {
  id: 'pond', name: 'FROZEN POND', blurb: 'Behind the loading dock in January. Nobody has traction here.',
  music: 'ice', friction: 0.22,
  cam: { minW: 13.5, maxW: 30, yBias: 0.8 },
  blast: { left: -20, right: 20, top: 16, bottom: -11 },
  spawns: [{ x: -6, y: 5 }, { x: 6, y: 5 }, { x: -2, y: 8 }, { x: 2, y: 8 }],
  solids: [{ x: 0, y: 0, w: 23, h: 2.4, ledges: [-11.5, 11.5] }],
  soft: [{ x: -6, y: 4.8, w: 4.4 }, { x: 6, y: 4.8, w: 4.4 }, { x: 0, y: 8, w: 4.8 }],
  light: { ambient: '#bcd0e8', ambientI: 0.95, key: '#ffffff', keyI: 0.9, rim: '#9fd8ff' },
  fog: { color: '#cfe0ee', near: 44, far: 130 },
  build(k) {
    const g = new k.THREE.Group();
    g.add(k.skyDome(['#8fb6da', '#a9c8e4', '#c6dcee', '#e2eef6']));
    const iceTex = k.tileMat(64, (ctx, s) => {
      ctx.fillStyle = '#cfe8f4'; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#a8d0e4';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * s, 0);
        ctx.lineTo(Math.random() * s, s);
        ctx.stroke();
      }
      ctx.fillStyle = '#f4fbff';
      for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 4, 2);
    }, [4, 1], { shin: 60 });
    const slab = k.box(23, 2.4, 4.6, iceTex);
    k.put(slab, 0, -1.2, 0);
    g.add(slab);
    for (const p of [[-6, 4.8, 4.4], [6, 4.8, 4.4], [0, 8, 4.8]]) {
      const floe = k.box(p[2], 0.3, 1.7, k.mat('#e8f6ff', { shin: 40 }));
      k.put(floe, p[0], p[1] - 0.15, 0);
      g.add(floe);
      const icicle = k.cone(0.2, 0.9, k.mat('#bfe4f4'), 5);
      k.put(icicle, p[0], p[1] - 0.7, 0.6, 180);
      g.add(icicle);
    }
    // snowbanks and pines behind
    for (let i = -3; i <= 3; i++) {
      const trunk = k.cyl(0.2, 0.26, 2, k.mat('#5a4030'), 5);
      k.put(trunk, i * 6.5 + k.seeded(i) * 2, -1 + k.seeded(i + 3), -16);
      g.add(trunk);
      for (let j = 0; j < 3; j++) {
        const tier = k.cone(2.2 - j * 0.5, 2.6, k.mat(j % 2 ? '#245a3a' : '#2c6a44'), 6);
        k.put(tier, i * 6.5 + k.seeded(i) * 2, 1 + j * 1.5 + k.seeded(i + 3), -16);
        g.add(tier);
      }
    }
    const bank = k.box(70, 3, 8, k.mat('#eef7ff'));
    k.put(bank, 0, -3, -18);
    g.add(bank);
    // falling snow, recycled forever
    const flakes = [];
    for (let i = 0; i < 40; i++) {
      const f = k.box(0.12, 0.12, 0.12, k.mat('#ffffff', { basic: true }));
      k.put(f, -22 + k.seeded(i) * 44, -6 + k.seeded(i + 30) * 26, -6 + k.seeded(i + 60) * 10);
      g.add(f);
      flakes.push(f);
    }
    return {
      group: g,
      update(dt) {
        for (const f of flakes) {
          f.position.y -= dt * 1.6;
          f.position.x += Math.sin(f.position.y * 0.6) * dt * 0.6;
          if (f.position.y < -8) f.position.y = 18;
        }
      },
    };
  },
  thumb(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8fb6da'); sky.addColorStop(1, '#dfeef8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2c6a44';
    for (const x of [0.1, 0.3, 0.78, 0.92]) {
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.32); ctx.lineTo(w * x - 12, h * 0.66); ctx.lineTo(w * x + 12, h * 0.66);
      ctx.fill();
    }
    ctx.fillStyle = '#eef7ff'; ctx.fillRect(0, h * 0.62, w, h * 0.1);
    ctx.fillStyle = '#cfe8f4'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(w * 0.14, h * 0.52, w * 0.2, 5);
    ctx.fillRect(w * 0.66, h * 0.52, w * 0.2, 5);
    ctx.fillRect(w * 0.4, h * 0.38, w * 0.2, 5);
  },
};

// ============================================================ THE VOID DECK
const VOID = {
  id: 'void', name: 'THE VOID DECK', blurb: 'Where unfinished games go. Four platforms and no horizon.',
  music: 'void', friction: 1,
  cam: { minW: 12.5, maxW: 29, yBias: 0.95 },
  blast: { left: -19, right: 19, top: 16, bottom: -11 },
  spawns: [{ x: -5, y: 5 }, { x: 5, y: 5 }, { x: -2, y: 9 }, { x: 2, y: 9 }],
  solids: [{ x: 0, y: 0, w: 19, h: 2.4, ledges: [-9.5, 9.5] }],
  soft: [{ x: -5.6, y: 4.4, w: 4.6 }, { x: 5.6, y: 4.4, w: 4.6 }, { x: 0, y: 7.8, w: 4.6 }],
  light: { ambient: '#7a86b8', ambientI: 0.7, key: '#dfe8ff', keyI: 0.85, rim: '#8a5ad6' },
  fog: { color: '#0a0a14', near: 26, far: 80 },
  build(k) {
    const g = new k.THREE.Group();
    g.add(k.skyDome(['#05050c', '#0b0b18', '#141024', '#1c1130']));
    const gridTex = k.tileMat(64, (ctx, s) => {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#4a5ad6';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, s, s);
      ctx.fillStyle = '#2ad6a0';
      ctx.fillRect(s / 2 - 2, s / 2 - 2, 4, 4);
    }, [5, 1], { shin: 30 });
    const main = k.box(19, 2.4, 4.4, gridTex);
    k.put(main, 0, -1.2, 0);
    g.add(main);
    for (const p of [[-5.6, 4.4, 4.6], [5.6, 4.4, 4.6], [0, 7.8, 4.6]]) {
      const plat = k.box(p[2], 0.3, 1.7, k.mat('#2a2f48', { shin: 24 }));
      k.put(plat, p[0], p[1] - 0.15, 0);
      const edge = k.box(p[2], 0.08, 1.8, k.mat('#4a5ad6', { basic: true }));
      k.put(edge, p[0], p[1] - 0.005, 0);
      g.add(plat, edge);
    }
    // floating debris: unfinished geometry drifting past
    const junk = [];
    for (let i = 0; i < 22; i++) {
      const shape = i % 3 === 0 ? k.box(1.2, 1.2, 1.2, k.mat('#2c3050')) : i % 3 === 1
        ? k.cone(0.9, 1.6, k.mat('#3a2f58'), 5)
        : k.sph(0.8, k.mat('#242a44'), 6, 4);
      k.put(shape, -26 + k.seeded(i) * 52, -8 + k.seeded(i + 11) * 30, -14 - k.seeded(i + 3) * 18);
      g.add(shape);
      junk.push(shape);
    }
    // starfield
    for (let i = 0; i < 70; i++) {
      const s = k.box(0.16, 0.16, 0.16, k.mat(k.seeded(i) > 0.8 ? '#8ad6ff' : '#ffffff', { basic: true }));
      k.put(s, -40 + k.seeded(i * 2) * 80, -14 + k.seeded(i * 3) * 44, -32 - k.seeded(i) * 20);
      g.add(s);
    }
    return {
      group: g,
      update(dt) {
        for (let i = 0; i < junk.length; i++) {
          const j = junk[i];
          j.rotation.x += dt * 0.3;
          j.rotation.y += dt * 0.22;
          j.position.y += Math.sin(i + j.position.x) * dt * 0.4;
        }
      },
    };
  },
  thumb(ctx, w, h) {
    ctx.fillStyle = '#0a0a16'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 6 ? '#ffffff' : '#8ad6ff';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#2a2f48'; ctx.fillRect(w * 0.16, h * 0.68, w * 0.68, h * 0.1);
    ctx.fillStyle = '#4a5ad6'; ctx.fillRect(w * 0.16, h * 0.68, w * 0.68, 3);
    for (const [x, y] of [[0.22, 0.5], [0.62, 0.5], [0.42, 0.34]]) {
      ctx.fillStyle = '#2a2f48'; ctx.fillRect(w * x, h * y, w * 0.16, 5);
      ctx.fillStyle = '#4a5ad6'; ctx.fillRect(w * x, h * y, w * 0.16, 2);
    }
  },
};

export const STAGES = [HOMEFIELD, ARCADE, MAGMA, BLIMP, POND, VOID];

export function stageById(id) { return STAGES.find((s) => s.id === id) || STAGES[0]; }

export function randomStage() { return STAGES[(Math.random() * STAGES.length) | 0]; }
