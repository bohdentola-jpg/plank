// FOCUS GROUP — the furniture.
//
// Everything is boxes, cylinders and one or two lathes, which is what a 1974
// flat mostly is anyway. Each prop is a function that takes the world and a
// position and returns a THREE.Group; a few of them hand back a handle as
// well, because the game needs to open them, light them, or put a picture on
// them later.

import * as THREE from 'three';
import { material, simple, liveCanvas, valFace, valcoLogo, drawSnow } from './textures.js';
import { scaleBoxUVs } from './world.js';
import { rng } from './util.js';

const R = rng(740305);

// A textured box that is *not* registered as a collider — props do their own.
function tbox(w, h, d, mat, x, y, z, o = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = typeof mat === 'string' ? material(mat) : mat;
  if (typeof mat === 'string') scaleBoxUVs(geo, w, h, d, o.tile ?? 0.5);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  if (o.rotY) mesh.rotation.y = o.rotY;
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = true;
  return mesh;
}

const cyl = (rt, rb, h, mat, seg = 14) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

// shared materials for the small metal and plastic bits
const CHROME = simple(0xc8c8cc, { rough: 0.22, metal: 0.85 });
const DARKPLASTIC = simple(0x24222a, { rough: 0.6 });
const CREAMPLASTIC = simple(0xd8cfb2, { rough: 0.55 });
const GLASS = simple(0xaab8bc, { rough: 0.08, metal: 0.1, opacity: 0.32 });
const RED = simple(0x9c2f26, { rough: 0.5 });

/** The little dark eye that is in more of these objects than you would like. */
export function lensBead(size = 0.011) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(size, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    simple(0x08080c, { rough: 0.05, metal: 0.3 })
  );
  body.rotation.x = -Math.PI / 2;
  g.add(body);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(size * 1.15, size * 0.22, 6, 14),
    simple(0x3a3a42, { rough: 0.3, metal: 0.6 })
  );
  g.add(ring);
  g.userData.isLens = true;
  return g;
}

// ------------------------------------------------------------------ living room

export function sofa(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const fab = material('upholstery');

  g.add(tbox(1.94, 0.34, 0.86, fab, 0, 0.30, 0));            // base
  g.add(tbox(1.94, 0.62, 0.20, fab, 0, 0.72, -0.33));        // back
  g.add(tbox(0.20, 0.50, 0.86, fab, -0.87, 0.60, 0));        // arms
  g.add(tbox(0.20, 0.50, 0.86, fab, 0.87, 0.60, 0));
  [-0.47, 0.47].forEach((cx) => {
    const c = tbox(0.86, 0.15, 0.72, fab, cx, 0.545, 0.03);
    c.rotation.x = -0.03;
    g.add(c);
  });
  // stubby dark legs, four of them, one slightly proud
  [[-0.84, -0.35], [0.84, -0.35], [-0.84, 0.35], [0.84, 0.35]].forEach(([lx, lz]) => {
    const l = cyl(0.028, 0.034, 0.13, simple(0x3a2818, { rough: 0.5 }), 8);
    l.position.set(lx, 0.065, lz);
    g.add(l);
  });

  world.add(g);
  const c = Math.abs(Math.cos(rotY)) > 0.5;
  world.solid(x - (c ? 1.0 : 0.5), x + (c ? 1.0 : 0.5), z - (c ? 0.5 : 1.0), z + (c ? 0.5 : 1.0), 0, 0.8, 'prop');
  return g;
}

export function coffeeTable(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(tbox(1.06, 0.045, 0.52, 'woodVeneer', 0, 0.40, 0, { tile: 0.9 }));
  g.add(tbox(0.92, 0.03, 0.40, 'woodVeneer', 0, 0.16, 0, { tile: 0.9 }));   // magazine shelf
  [[-0.46, -0.20], [0.46, -0.20], [-0.46, 0.20], [0.46, 0.20]].forEach(([lx, lz]) => {
    const l = cyl(0.020, 0.026, 0.40, simple(0x4a3018, { rough: 0.45 }), 8);
    l.position.set(lx, 0.20, lz);
    g.add(l);
  });
  // a folded paper nobody has read
  const paper = tbox(0.30, 0.006, 0.22, simple(0xd8d2bc, { rough: 0.95 }), 0.18, 0.427, 0.04);
  paper.rotation.y = 0.24;
  g.add(paper);
  world.add(g);
  world.solid(x - 0.53, x + 0.53, z - 0.26, z + 0.26, 0, 0.44, 'prop');
  return g;
}

/**
 * The set. A walnut cabinet on splayed legs with a picture in it and a lens
 * above the channel dial, where no dial is.
 * @returns {{group, screen, glow, setPicture, on}}
 */
export function television(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const W = 0.92, H = 0.70, D = 0.52;
  g.add(tbox(W, H, D, 'woodVeneer', 0, 0.42 + H / 2, 0, { tile: 0.8 }));
  // splayed legs
  [[-0.34, -0.16, -0.16], [0.34, -0.16, 0.16], [-0.34, 0.16, -0.16], [0.34, 0.16, 0.16]]
    .forEach(([lx, lz, tilt]) => {
      const l = cyl(0.018, 0.026, 0.44, simple(0x3a2414, { rough: 0.5 }), 8);
      l.position.set(lx, 0.22, lz);
      l.rotation.z = tilt * 0.5;
      g.add(l);
    });

  // the screen: a slightly proud rounded rectangle of glass with a canvas in it
  const live = liveCanvas(320, 240);
  const screenMat = new THREE.MeshStandardMaterial({
    map: live.tex,
    emissiveMap: live.tex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.05,
    roughness: 0.28,
    metalness: 0,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), screenMat);
  screen.position.set(-0.12, 0.42 + H / 2 + 0.02, D / 2 + 0.006);
  g.add(screen);

  // bezel: four dark strips around the picture
  const bez = simple(0x141114, { rough: 0.65 });
  [[0, 0.245, 0.62, 0.06], [0, -0.245, 0.62, 0.06], [-0.31, 0, 0.06, 0.55], [0.31, 0, 0.06, 0.55]]
    .forEach(([bx, by, bw, bh]) => {
      g.add(tbox(bw, bh, 0.02, bez, -0.12 + bx, 0.42 + H / 2 + 0.02 + by, D / 2 + 0.002));
    });

  // controls: a speaker grille, two dials, and the lens
  g.add(tbox(0.20, 0.30, 0.014, simple(0x6a5a44, { rough: 0.95 }), 0.32, 0.42 + H / 2 - 0.06, D / 2 + 0.004));
  [[0.28, 0.20], [0.38, 0.20]].forEach(([dx, dy]) => {
    const d = cyl(0.032, 0.032, 0.022, CREAMPLASTIC, 12);
    d.rotation.x = Math.PI / 2;
    d.position.set(dx, 0.42 + H / 2 + dy, D / 2 + 0.012);
    g.add(d);
  });

  const lens = lensBead(0.010);
  lens.position.set(0.33, 0.42 + H / 2 + 0.30, D / 2 + 0.008);
  lens.rotation.x = Math.PI / 2;
  g.add(lens);

  // the picture throws light into the room, and the room notices
  const glow = new THREE.PointLight(0x9ec4e8, 0, 5.0, 2);
  glow.position.set(-0.12, 0.42 + H / 2 + 0.02, D / 2 + 0.55);
  g.add(glow);

  world.add(g);
  world.solidRot(x, z, W, D, 0, 1.14, rotY);

  const api = {
    group: g,
    lens,
    screen,
    live,
    glow,
    on: false,
    /** @param {(ctx, w, h) => void} draw */
    paint(draw) {
      draw(live.ctx, live.cv.width, live.cv.height);
      live.touch();
    },
    setOn(v) {
      api.on = v;
      screenMat.emissiveIntensity = v ? 1.05 : 0.06;
      glow.intensity = v ? 14 : 0;
    },
  };
  api.paint((ctx, w, h) => { ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, w, h); });
  api.setOn(false);
  return api;
}

export function sideboard(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.add(tbox(1.5, 0.62, 0.42, 'woodVeneer', 0, 0.48, 0, { tile: 0.8 }));
  [[-0.75, 0], [0.75, 0]].forEach(([lx]) => {
    const l = cyl(0.02, 0.026, 0.17, simple(0x3a2414, { rough: 0.5 }), 8);
    l.position.set(lx * 0.92, 0.085, 0);
    g.add(l);
  });
  // three drawer pulls
  [-0.42, 0, 0.42].forEach((dx) => {
    const p = cyl(0.012, 0.012, 0.14, CHROME, 8);
    p.rotation.z = Math.PI / 2;
    p.position.set(dx, 0.55, 0.215);
    g.add(p);
  });
  world.add(g);
  world.solidRot(x, z, 1.5, 0.42, 0, 0.8, rotY);
  return g;
}

export function standardLamp(world, x, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const base = cyl(0.15, 0.17, 0.03, simple(0x4a3a22, { rough: 0.5 }), 16);
  base.position.y = 0.015;
  g.add(base);
  const stem = cyl(0.014, 0.014, 1.32, CHROME, 10);
  stem.position.y = 0.68;
  g.add(stem);
  const shadeMat = simple(o.shade ?? 0xd8bc84, {
    rough: 0.95, emissive: o.shade ?? 0xd8bc84, emissiveIntensity: 0, side: THREE.DoubleSide,
  });
  const shade = cyl(0.17, 0.24, 0.28, shadeMat, 18);
  shade.position.y = 1.44;
  g.add(shade);

  const bulb = new THREE.PointLight(o.colour ?? 0xffc98a, 0, 6.5, 2);
  bulb.position.set(0, 1.40, 0);
  g.add(bulb);

  world.add(g);
  world.solid(x - 0.17, x + 0.17, z - 0.17, z + 0.17, 0, 0.5, 'prop');
  return {
    group: g,
    light: bulb,
    setOn(v) {
      bulb.intensity = v ? 30 : 0;
      shadeMat.emissiveIntensity = v ? 0.55 : 0;
    },
  };
}

/**
 * The window, its frame, and a venetian blind that actually opens. The cord
 * toggle at the side unscrews, though you would have to be looking.
 */
export function window7(world, x, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const W = o.w ?? 2.4, H = o.h ?? 1.25, Y = o.y ?? 0.95;

  // frame
  const fr = material('gloss');
  g.add(tbox(W + 0.14, 0.09, 0.14, fr, 0, Y - 0.045, 0, { tile: 1.2 }));
  g.add(tbox(W + 0.14, 0.09, 0.14, fr, 0, Y + H + 0.045, 0, { tile: 1.2 }));
  g.add(tbox(0.09, H + 0.18, 0.14, fr, -W / 2 - 0.045, Y + H / 2, 0, { tile: 1.2 }));
  g.add(tbox(0.09, H + 0.18, 0.14, fr, W / 2 + 0.045, Y + H / 2, 0, { tile: 1.2 }));
  g.add(tbox(0.05, H, 0.10, fr, 0, Y + H / 2, 0, { tile: 1.2 }));   // centre mullion
  g.add(tbox(W + 0.30, 0.05, 0.24, fr, 0, Y - 0.10, 0.03, { tile: 1.2 }));   // sill

  // the glass, and the night behind it
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    simple(0x2a3348, { rough: 0.05, metal: 0.2, opacity: 0.55, emissive: 0x151d2e, emissiveIntensity: 0.7 })
  );
  glass.position.set(0, Y + H / 2, 0.01);
  g.add(glass);

  // venetian slats: one group that rotates and one that lifts
  const slats = new THREE.Group();
  const slatMat = simple(0xcfc6ac, { rough: 0.7, side: THREE.DoubleSide });
  const n = 22;
  const pitch = (H - 0.08) / (n - 1);
  for (let i = 0; i < n; i++) {
    // each slat is deeper than the gap below it, so turned down they overlap
    const s = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.004, pitch * 1.06), slatMat);
    s.position.set(0, Y + H - 0.03 - i * pitch, 0.055);
    slats.add(s);
  }
  g.add(slats);

  // the pull cord, and the toggle on the end of it
  const cord = cyl(0.0035, 0.0035, 0.72, simple(0xbcae90, { rough: 0.9 }), 5);
  cord.position.set(W / 2 - 0.06, Y + H - 0.36, 0.075);
  g.add(cord);
  const toggle = cyl(0.016, 0.016, 0.052, CREAMPLASTIC, 10);
  toggle.position.set(W / 2 - 0.06, Y + H - 0.74, 0.075);
  g.add(toggle);

  world.add(g);
  world.solid(x - W / 2 - 0.2, x + W / 2 + 0.2, z - 0.1, z + 0.14, 0, 0.9, 'prop');

  let open = 0;
  const api = {
    group: g,
    toggle,
    glass,
    get open() { return open; },
    /** 0 = shut, 1 = slats turned flat and lifted clear */
    setOpen(v) {
      open = v;
      slats.children.forEach((s, i) => {
        // shut: turned right down. open: flat, and stacked at the top.
        s.rotation.x = -(1 - v) * 1.30;
        const lift = v * (H - 0.10) * (1 - i / (n - 1));
        s.position.y = Y + H - 0.03 - i * pitch + lift * 0.94;
        s.visible = v < 0.98 || i < 5;
      });
    },
  };
  api.setOpen(0);
  return api;
}

export function radiator(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const m = simple(0xdcd6c2, { rough: 0.42, metal: 0.15 });
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.56, 0.085), m);
    f.position.set(-0.30 + i * 0.10, 0.44, 0);
    g.add(f);
  }
  g.add(tbox(0.72, 0.03, 0.10, m, 0, 0.735, 0));
  world.add(g);
  world.solidRot(x, z, 0.72, 0.12, 0, 0.76, rotY);
  return g;
}

export function wallClock(world, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const face = cyl(0.13, 0.13, 0.045, simple(0xe4dcc2, { rough: 0.5 }), 22);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 6, 24), simple(0x54381e, { rough: 0.5 }));
  g.add(rim);
  const hands = new THREE.Group();
  const hMat = simple(0x1a1614, { rough: 0.6 });
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.062, 0.006), hMat);
  hh.position.y = 0.031;
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.098, 0.006), hMat);
  mh.position.y = 0.049;
  const hg = new THREE.Group(); hg.add(hh);
  const mg = new THREE.Group(); mg.add(mh);
  hands.add(hg, mg);
  hands.position.z = 0.026;
  g.add(hands);
  world.add(g);
  return {
    group: g,
    /** @param {number} mins minutes past midnight */
    setTime(mins) {
      mg.rotation.z = -((mins % 60) / 60) * Math.PI * 2;
      hg.rotation.z = -(((mins / 60) % 12) / 12) * Math.PI * 2;
    },
  };
}

// ------------------------------------------------------------------ kitchen

export function counterRun(world, x0, x1, z, o = {}) {
  const g = new THREE.Group();
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  const D = 0.60;
  const face = o.face ?? 1;      // which side the doors and handles are on
  g.add(tbox(len, 0.78, D, 'gloss', cx, 0.39, z, { tile: 1.0 }));
  g.add(tbox(len + 0.03, 0.04, D + 0.03, 'formica', cx, 0.80, z, { tile: 1.0 }));
  // cupboard doors and their handles
  const doors = Math.max(1, Math.round(len / 0.5));
  for (let i = 0; i < doors; i++) {
    const dx = x0 + (i + 0.5) * (len / doors);
    g.add(tbox(len / doors - 0.03, 0.60, 0.02, 'gloss', dx, 0.40, z + face * (D / 2 + 0.012), { tile: 1.4 }));
    const h = cyl(0.008, 0.008, 0.10, CHROME, 6);
    h.rotation.z = Math.PI / 2;
    h.position.set(dx, 0.66, z + face * (D / 2 + 0.03));
    g.add(h);
  }
  world.add(g);
  world.solid(x0, x1, z - D / 2, z + D / 2, 0, 0.85, 'prop');
  return g;
}

export function wallUnits(world, x0, x1, z, o = {}) {
  const g = new THREE.Group();
  const len = x1 - x0, cx = (x0 + x1) / 2;
  const face = o.face ?? 1;
  g.add(tbox(len, 0.66, 0.32, 'gloss', cx, 1.72, z, { tile: 1.0 }));
  const doors = Math.max(1, Math.round(len / 0.5));
  for (let i = 0; i < doors; i++) {
    const dx = x0 + (i + 0.5) * (len / doors);
    g.add(tbox(len / doors - 0.03, 0.60, 0.02, 'gloss', dx, 1.72, z + face * 0.17, { tile: 1.4 }));
    const h = cyl(0.008, 0.008, 0.09, CHROME, 6);
    h.rotation.z = Math.PI / 2;
    h.position.set(dx, 1.46, z + face * 0.19);
    g.add(h);
  }
  world.add(g);
  return g;
}

export function sink(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const steel = simple(0xb8bcc0, { rough: 0.24, metal: 0.8 });
  g.add(tbox(0.54, 0.02, 0.42, steel, 0, 0.815, 0));
  g.add(tbox(0.44, 0.16, 0.32, steel, 0, 0.735, 0));      // the bowl, roughly
  const spout = cyl(0.014, 0.014, 0.26, CHROME, 10);
  spout.position.set(0, 0.95, -0.20);
  g.add(spout);
  const arm = cyl(0.012, 0.012, 0.16, CHROME, 10);
  arm.rotation.z = Math.PI / 2;
  arm.rotation.y = Math.PI / 2;
  arm.position.set(0, 1.07, -0.13);
  g.add(arm);
  world.add(g);
  return g;
}

export function fridge(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const body = simple(0xd8d4c4, { rough: 0.36, metal: 0.06 });
  g.add(tbox(0.60, 1.42, 0.62, body, 0, 0.71, 0));
  g.add(tbox(0.58, 0.98, 0.03, body, 0, 0.50, 0.32));
  g.add(tbox(0.58, 0.38, 0.03, body, 0, 1.16, 0.32));
  const handle = cyl(0.013, 0.013, 0.20, CHROME, 8);
  handle.position.set(0.24, 0.72, 0.35);
  g.add(handle);
  world.add(g);
  world.solidRot(x, z, 0.64, 0.64, 0, 1.44, rotY);
  return g;
}

export function cooker(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = simple(0xdad6c6, { rough: 0.4 });
  g.add(tbox(0.58, 0.86, 0.60, body, 0, 0.43, 0));
  g.add(tbox(0.58, 0.03, 0.60, simple(0x2a2a2c, { rough: 0.5 }), 0, 0.875, 0));
  [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]].forEach(([rx, rz]) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.010, 5, 18), simple(0x3a3a3c, { rough: 0.55 }));
    r.rotation.x = Math.PI / 2;
    r.position.set(rx, 0.895, rz);
    g.add(r);
  });
  g.add(tbox(0.52, 0.32, 0.02, simple(0x18181c, { rough: 0.2, metal: 0.1, opacity: 0.7 }), 0, 0.50, 0.31));
  world.add(g);
  world.solid(x - 0.30, x + 0.30, z - 0.31, z + 0.31, 0, 0.9, 'prop');
  return g;
}

/**
 * The coffee maker. Valco Filtermatic. Note the badge: chrome, convex, and
 * facing into the room rather than at the wall, which is a strange way to
 * mount a badge.
 */
export function coffeeMaker(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.82, z);
  g.rotation.y = rotY;

  g.add(tbox(0.20, 0.09, 0.22, CREAMPLASTIC, 0, 0.045, 0));                 // base
  g.add(tbox(0.20, 0.34, 0.09, CREAMPLASTIC, 0, 0.26, -0.065));             // tower
  const carafe = cyl(0.072, 0.062, 0.15, GLASS, 16);
  carafe.position.set(0, 0.165, 0.03);
  g.add(carafe);
  const coffee = cyl(0.066, 0.058, 0.09, simple(0x2a1408, { rough: 0.35, opacity: 0.92 }), 16);
  coffee.position.set(0, 0.135, 0.03);
  coffee.visible = false;
  g.add(coffee);
  const lid = cyl(0.076, 0.076, 0.02, DARKPLASTIC, 16);
  lid.position.set(0, 0.25, 0.03);
  g.add(lid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 5, 12, Math.PI), DARKPLASTIC);
  handle.rotation.y = Math.PI / 2;
  handle.position.set(0.075, 0.17, 0.03);
  g.add(handle);

  // the badge
  const badge = new THREE.Mesh(
    new THREE.SphereGeometry(0.019, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    simple(0xd0d0d4, { rough: 0.12, metal: 0.9 })
  );
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 0.30, -0.02);
  g.add(badge);
  const lens = lensBead(0.0075);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.30, -0.005);
  g.add(lens);

  // the red light that says it is doing something
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6),
    simple(0x501008, { rough: 0.3, emissive: 0x000000 }));
  led.position.set(-0.07, 0.08, 0.11);
  g.add(led);

  world.add(g);
  return {
    group: g, lens, badge,
    brewing: false,
    setBrewing(v) {
      this.brewing = v;
      led.material.emissive.setHex(v ? 0xff2010 : 0x000000);
      led.material.emissiveIntensity = v ? 2 : 0;
    },
    setFull(v) { coffee.visible = v; },
  };
}

/** A mug. VAL is on it. On the gift one, his left eye is glass. */
export function mug(world, x, y, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const faceTex = new THREE.CanvasTexture(valFace(128, { bg: '#e8e2d0' }));
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.35 });
  const plain = simple(o.colour ?? 0xe8e2d0, { rough: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 18, 1, true), side);
  body.position.y = 0.047;
  g.add(body);
  const bottom = cyl(0.038, 0.038, 0.008, plain, 18);
  bottom.position.y = 0.004;
  g.add(bottom);
  const inner = cyl(0.038, 0.034, 0.085, simple(0x3a2a18, { rough: 0.5 }), 16);
  inner.position.y = 0.048;
  inner.scale.setScalar(0.96);
  g.add(inner);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 14, Math.PI * 1.25), plain);
  handle.rotation.y = Math.PI / 2;
  handle.rotation.z = -0.4;
  handle.position.set(0.046, 0.052, 0);
  g.add(handle);

  if (o.lens) {
    const lens = lensBead(0.005);
    lens.position.set(-0.014, 0.062, 0.041);
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
    g.userData.lens = lens;
  }
  world.add(g);
  return g;
}

/** The extractor hood. Third slat from the left is glass. */
export function extractor(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const m = simple(0xc8c4b4, { rough: 0.4, metal: 0.2 });
  g.add(tbox(0.62, 0.20, 0.42, m, 0, 1.52, 0));
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.20, 0.22, 4, 1, true), m);
  hood.rotation.y = Math.PI / 4;
  hood.position.set(0, 1.31, 0);
  g.add(hood);
  // the grille
  const slats = simple(0x8e8a7e, { rough: 0.5, metal: 0.3 });
  let lens = null;
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.20), slats);
    s.position.set(-0.19 + i * 0.064, 1.615, 0.12);
    s.rotation.x = 0.3;
    g.add(s);
    if (i === 2) {
      lens = lensBead(0.008);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(s.position.x, 1.607, 0.19);
      g.add(lens);
    }
  }
  g.add(tbox(0.28, 0.72, 0.24, m, 0, 1.98, -0.08));    // the duct up to the ceiling
  world.add(g);
  return { group: g, lens };
}

export function dinetteTable(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(tbox(0.88, 0.035, 0.62, 'formica', 0, 0.73, 0, { tile: 1.0 }));
  const leg = simple(0xb0b4b8, { rough: 0.3, metal: 0.7 });
  [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]].forEach(([lx, lz]) => {
    const l = cyl(0.016, 0.016, 0.72, leg, 8);
    l.position.set(lx, 0.36, lz);
    g.add(l);
  });
  world.add(g);
  world.solid(x - 0.44, x + 0.44, z - 0.31, z + 0.31, 0, 0.76, 'prop');
  return g;
}

export function chair(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const seat = simple(0xa8541f, { rough: 0.75 });
  const leg = simple(0xb0b4b8, { rough: 0.3, metal: 0.7 });
  g.add(tbox(0.40, 0.05, 0.38, seat, 0, 0.44, 0));
  g.add(tbox(0.38, 0.34, 0.05, seat, 0, 0.66, -0.16));
  [[-0.17, -0.16], [0.17, -0.16], [-0.17, 0.16], [0.17, 0.16]].forEach(([lx, lz]) => {
    const l = cyl(0.012, 0.012, 0.44, leg, 6);
    l.position.set(lx, 0.22, lz);
    g.add(l);
  });
  world.add(g);
  world.solidRot(x, z, 0.42, 0.40, 0, 0.5, rotY);
  return g;
}

// ------------------------------------------------------------------ bedroom

export function bed(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.add(tbox(1.42, 0.26, 2.00, simple(0x5a3a20, { rough: 0.6 }), 0, 0.16, 0));
  g.add(tbox(1.38, 0.20, 1.96, simple(0xd8d0bc, { rough: 0.95 }), 0, 0.38, 0));   // mattress
  // the covers, thrown back on the side you get out of
  const quilt = tbox(1.38, 0.11, 1.34, simple(0x8a6a3a, { rough: 0.98 }), 0, 0.50, 0.30);
  quilt.rotation.x = 0.02;
  g.add(quilt);
  g.add(tbox(0.56, 0.11, 0.34, simple(0xe4dcc6, { rough: 0.98 }), -0.32, 0.51, -0.78));
  g.add(tbox(0.56, 0.09, 0.34, simple(0xe4dcc6, { rough: 0.98 }), 0.32, 0.50, -0.80));
  g.add(tbox(1.46, 0.62, 0.07, 'woodVeneer', 0, 0.55, -1.02, { tile: 1.0 }));     // headboard
  world.add(g);
  world.solidRot(x, z, 1.48, 2.08, 0, 0.6, rotY);
  return g;
}

export function bedsideTable(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(tbox(0.40, 0.50, 0.36, 'woodVeneer', 0, 0.29, 0, { tile: 1.1 }));
  const p = cyl(0.010, 0.010, 0.09, CHROME, 6);
  p.rotation.z = Math.PI / 2;
  p.position.set(0, 0.36, 0.19);
  g.add(p);
  world.add(g);
  world.solid(x - 0.20, x + 0.20, z - 0.18, z + 0.18, 0, 0.55, 'prop');
  return g;
}

/**
 * Valco Chrono 400. A wedge, a chrome bar, and a red display in which one of
 * the digits has a segment that is not a segment.
 */
export function clockRadio(world, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.15), DARKPLASTIC);
  shell.position.set(0, 0.05, 0);
  g.add(shell);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.02), simple(0x18161a, { rough: 0.3 }));
  face.position.set(0, 0.058, 0.076);
  face.rotation.x = -0.22;
  g.add(face);

  const live = liveCanvas(160, 48);
  const dispMat = new THREE.MeshStandardMaterial({
    map: live.tex, emissiveMap: live.tex, emissive: new THREE.Color(0xff2a10),
    emissiveIntensity: 1.6, roughness: 0.3,
  });
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.034), dispMat);
  disp.position.set(-0.045, 0.060, 0.088);
  disp.rotation.x = -0.22;
  g.add(disp);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.014, 0.03), CHROME);
  bar.position.set(0, 0.104, -0.01);
  g.add(bar);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.012), simple(0x5a5548, { rough: 0.95 }));
  grille.position.set(0.085, 0.055, 0.078);
  g.add(grille);

  // the lens lives behind the display glass, on the right of the six
  const lens = lensBead(0.0055);
  lens.rotation.x = Math.PI / 2 - 0.22;
  lens.position.set(0.008, 0.060, 0.090);
  g.add(lens);

  world.add(g);
  const api = {
    group: g, lens,
    paint(text, on = true) {
      const { ctx, cv } = live;
      ctx.fillStyle = '#0a0406';
      ctx.fillRect(0, 0, cv.width, cv.height);
      if (on) {
        ctx.fillStyle = '#ff3418';
        ctx.font = 'bold 38px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
      }
      live.touch();
      dispMat.emissiveIntensity = on ? 1.6 : 0;
    },
  };
  api.paint('6:41');
  return api;
}

export function wardrobe(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.add(tbox(1.06, 1.94, 0.56, 'woodVeneer', 0, 0.97, 0, { tile: 0.7 }));
  [-0.26, 0.26].forEach((dx) => {
    g.add(tbox(0.50, 1.84, 0.02, 'woodDark', dx, 0.97, 0.29, { tile: 0.9 }));
    const h = cyl(0.010, 0.010, 0.11, CHROME, 6);
    h.position.set(dx + (dx > 0 ? -0.20 : 0.20), 1.06, 0.31);
    g.add(h);
  });
  world.add(g);
  world.solidRot(x, z, 1.06, 0.56, 0, 1.96, rotY);
  return g;
}

// ------------------------------------------------------------------ bathroom

export function basin(world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const white = simple(0xe6e4dc, { rough: 0.16, metal: 0.02 });
  const bowl = cyl(0.24, 0.16, 0.16, white, 20);
  bowl.position.set(0, 0.80, 0);
  g.add(bowl);
  g.add(tbox(0.54, 0.05, 0.40, white, 0, 0.885, 0));
  const ped = cyl(0.09, 0.13, 0.72, white, 14);
  ped.position.set(0, 0.36, -0.02);
  g.add(ped);
  const tap = cyl(0.011, 0.011, 0.11, CHROME, 8);
  tap.position.set(0, 0.955, -0.15);
  g.add(tap);
  world.add(g);
  world.solid(x - 0.27, x + 0.27, z - 0.20, z + 0.20, 0, 0.92, 'prop');
  return g;
}

/**
 * The cabinet over the basin. There is a flaw in the silvering, and you can
 * see round the back of it, which is not a thing a flaw does.
 */
export function cabinetMirror(world, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(tbox(0.58, 0.52, 0.16, simple(0xdcd6c4, { rough: 0.4 }), 0, 0, 0));
  const mir = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.46),
    simple(0x9aa8ac, { rough: 0.06, metal: 0.92 })
  );
  mir.position.set(0, 0, 0.082);
  g.add(mir);
  const frame = simple(0xb8b2a0, { rough: 0.4, metal: 0.3 });
  [[0, 0.245, 0.56, 0.03], [0, -0.245, 0.56, 0.03], [-0.275, 0, 0.03, 0.52], [0.275, 0, 0.03, 0.52]]
    .forEach(([bx, by, bw, bh]) => g.add(tbox(bw, bh, 0.02, frame, bx, by, 0.086)));
  const lens = lensBead(0.006);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.19, 0.14, 0.084);
  g.add(lens);
  world.add(g);
  return { group: g, lens, mirror: mir };
}

export function bath(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const white = simple(0xe6e4dc, { rough: 0.18 });
  g.add(tbox(1.60, 0.55, 0.72, white, 0, 0.275, 0));
  const inner = tbox(1.44, 0.42, 0.58, simple(0xd8d6ce, { rough: 0.22 }), 0, 0.40, 0);
  g.add(inner);
  const tap = cyl(0.012, 0.012, 0.10, CHROME, 8);
  tap.position.set(-0.68, 0.62, 0);
  g.add(tap);
  world.add(g);
  world.solidRot(x, z, 1.60, 0.72, 0, 0.58, rotY);
  return g;
}

export function toilet(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const white = simple(0xe6e4dc, { rough: 0.18 });
  g.add(tbox(0.36, 0.38, 0.52, white, 0, 0.19, 0.03));
  const seat = cyl(0.19, 0.19, 0.04, white, 18);
  seat.position.set(0, 0.40, 0.06);
  g.add(seat);
  g.add(tbox(0.42, 0.42, 0.18, white, 0, 0.60, -0.26));
  world.add(g);
  world.solidRot(x, z, 0.44, 0.60, 0, 0.62, rotY);
  return g;
}

// ------------------------------------------------------------------ hall

/** Ceiling smoke detector. Its test light does not blink, and has two glints. */
export function smokeDetector(world, x, y, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const body = cyl(0.075, 0.082, 0.032, simple(o.colour ?? 0xe8e4d6, { rough: 0.5 }), 18);
  body.position.y = -0.016;
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.012), simple(0xc8c4b6, { rough: 0.6 }));
    v.position.set(Math.cos(a) * 0.052, -0.032, Math.sin(a) * 0.052);
    v.rotation.y = -a;
    g.add(v);
  }
  const lens = lensBead(0.007);
  lens.position.set(0.026, -0.034, 0.0);
  lens.rotation.x = Math.PI;
  g.add(lens);
  if (o.noBattery) {
    // the gift one has nowhere for a battery to go
    g.add(tbox(0.05, 0.004, 0.03, simple(0xd8d4c6, { rough: 0.6 }), -0.03, -0.033, 0));
  }
  world.add(g);
  return { group: g, lens };
}

export function frontDoor(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.add(tbox(0.86, 2.04, 0.05, 'gloss', 0, 1.02, 0, { tile: 1.0 }));
  const panel = simple(0x000000, { opacity: 0.16, rough: 1 });
  [[0.55, 0.42], [1.20, 0.42], [1.72, 0.24]].forEach(([py, ph]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.60, ph, 0.008), panel);
    p.position.set(0, py, 0.03);
    g.add(p);
  });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), simple(0xb08a44, { rough: 0.3, metal: 0.75 }));
  knob.position.set(0.32, 1.02, 0.05);
  g.add(knob);
  // letter flap
  g.add(tbox(0.28, 0.055, 0.02, simple(0xb08a44, { rough: 0.35, metal: 0.7 }), 0, 0.94, 0.032));
  // and the peephole, fitted the wrong way round
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.005, 6, 14), CHROME);
  ring.position.set(0, 1.56, 0.028);
  g.add(ring);
  const lens = lensBead(0.008);
  lens.rotation.x = -Math.PI / 2;
  lens.position.set(0, 1.56, 0.032);
  g.add(lens);
  world.add(g);
  world.solidRot(x, z, 0.90, 0.12, 0, 2.05, rotY, 'wall');
  return { group: g, lens };
}

/** The parcel. Your name is on it and it is spelled right. */
export function parcel(world, x, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = o.rotY ?? 0.2;
  g.add(tbox(0.46, 0.30, 0.36, 'cardboard', 0, 0.15, 0, { tile: 2.2 }));
  // tape
  g.add(tbox(0.06, 0.002, 0.37, simple(0xc8b88c, { rough: 0.4, opacity: 0.85 }), 0, 0.301, 0));
  // and a label, with the starburst on it
  const lab = new THREE.CanvasTexture(valcoLogo(256, 128, { bg: '#e8e0c8', ink: '#7a2018' }));
  lab.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11),
    new THREE.MeshStandardMaterial({ map: lab, roughness: 0.9 }));
  label.position.set(0, 0.16, 0.181);
  g.add(label);
  world.add(g);
  world.solid(x - 0.24, x + 0.24, z - 0.19, z + 0.19, 0, 0.32, 'prop');
  return g;
}

/** A four-inch VAL, in painted resin. Both eyes have been dusted. */
export function figurine(world, x, y, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const cream = simple(0xefe2c4, { rough: 0.42 });
  const dark = simple(0x181418, { rough: 0.45 });

  const body = cyl(0.026, 0.042, 0.07, simple(0x2a4a6a, { rough: 0.5 }), 12);
  body.position.y = 0.035;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), cream);
  head.position.y = 0.098;
  g.add(head);
  const brim = cyl(0.040, 0.040, 0.005, dark, 16);
  brim.position.y = 0.122;
  g.add(brim);
  const crown = cyl(0.023, 0.025, 0.028, dark, 14);
  crown.position.y = 0.136;
  g.add(crown);

  // the face is a decal on the front of the head
  const ft = new THREE.CanvasTexture(valFace(128, { bg: '#efe2c4' }));
  ft.colorSpace = THREE.SRGBColorSpace;
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.048),
    new THREE.MeshStandardMaterial({ map: ft, roughness: 0.4, transparent: true }));
  decal.position.set(0, 0.098, 0.031);
  g.add(decal);

  // arms out, welcoming
  [[-1, 0.4], [1, 0.4]].forEach(([sx, tilt]) => {
    const a = cyl(0.008, 0.008, 0.05, simple(0x2a4a6a, { rough: 0.5 }), 6);
    a.position.set(sx * 0.036, 0.052, 0);
    a.rotation.z = sx * tilt;
    g.add(a);
  });

  if (o.lens) {
    const l = lensBead(0.0035);
    l.rotation.x = Math.PI / 2;
    l.position.set(0, 0.104, 0.032);
    g.add(l);
    g.userData.lens = l;
  }
  world.add(g);
  return g;
}

/** The little table lamp from the gift box. There is a dark bulb behind it. */
export function giftLamp(world, x, y, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const base = cyl(0.055, 0.065, 0.018, simple(0x6a4a2a, { rough: 0.5 }), 14);
  g.add(base);
  const stem = cyl(0.010, 0.010, 0.18, simple(0xb8a068, { rough: 0.3, metal: 0.6 }), 8);
  stem.position.y = 0.095;
  g.add(stem);
  const shadeMat = simple(0xd8b878, { rough: 0.95, emissive: 0xd8b878, emissiveIntensity: 0, side: THREE.DoubleSide });
  const shade = cyl(0.062, 0.088, 0.11, shadeMat, 16);
  shade.position.y = 0.225;
  g.add(shade);
  const bulb = new THREE.PointLight(0xffc078, 0, 4.0, 2);
  bulb.position.y = 0.20;
  g.add(bulb);
  if (o.lens) {
    // the second bulb, which is dark, and stays dark
    const dark = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), simple(0x101014, { rough: 0.2 }));
    dark.position.set(0, 0.20, 0.03);
    g.add(dark);
    const l = lensBead(0.006);
    l.rotation.x = Math.PI / 2;
    l.position.set(0, 0.20, 0.044);
    g.add(l);
    g.userData.lens = l;
  }
  world.add(g);
  return {
    group: g,
    setOn(v) { bulb.intensity = v ? 15 : 0; shadeMat.emissiveIntensity = v ? 0.5 : 0; },
  };
}

/** A strip of white tape, crossed, on the floor. You know what it is for. */
export function floorMark(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.006, z);
  g.rotation.y = rotY;
  const m = simple(0xe8e6dc, { rough: 0.8 });
  const a = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.045), m);
  a.rotation.x = -Math.PI / 2;
  g.add(a);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.32), m);
  b.rotation.x = -Math.PI / 2;
  g.add(b);
  world.add(g);
  return g;
}

// ------------------------------------------------------------------ the studio

/**
 * A wall of monitors, drawn on one canvas so it stays one draw call.
 * @returns {{group, live, cols, rows, paint}}
 */
export function monitorWall(world, x, y, z, o = {}) {
  const cols = o.cols ?? 8, rows = o.rows ?? 5;
  const W = o.w ?? 4.6, H = o.h ?? 2.1;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = o.rotY ?? 0;

  const live = liveCanvas(cols * 128, rows * 96);
  const mat = new THREE.MeshStandardMaterial({
    map: live.tex, emissiveMap: live.tex, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.15, roughness: 0.35,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  screen.position.z = 0.03;
  g.add(screen);

  // the rack behind them, and the bezel grid in front
  g.add(tbox(W + 0.16, H + 0.16, 0.26, 'monitorBezel', 0, 0, -0.10, { tile: 1.4 }));
  const bez = simple(0x1a1a1e, { rough: 0.6 });
  for (let c = 1; c < cols; c++) {
    g.add(tbox(0.022, H, 0.02, bez, -W / 2 + (c * W) / cols, 0, 0.04));
  }
  for (let r = 1; r < rows; r++) {
    g.add(tbox(W, 0.022, 0.02, bez, 0, -H / 2 + (r * H) / rows, 0.04));
  }

  const wash = new THREE.PointLight(0xa8c8e8, 16, 9, 2);
  wash.position.set(0, 0, 1.4);
  g.add(wash);

  world.add(g);
  world.solid(x - W / 2, x + W / 2, z - 0.2, z + 0.2, 0, y + H / 2, 'wall');
  return { group: g, live, cols, rows, light: wash };
}

/** A studio camera on a pedestal. Big, black, and pointing at you. */
export function studioCamera(world, x, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = o.rotY ?? 0;
  const black = simple(0x1c1c20, { rough: 0.55 });

  const foot = cyl(0.30, 0.34, 0.06, black, 14);
  foot.position.y = 0.03;
  g.add(foot);
  [0, 2.1, 4.2].forEach((a) => {
    const w = cyl(0.05, 0.05, 0.03, simple(0x101014, { rough: 0.7 }), 10);
    w.rotation.z = Math.PI / 2;
    w.position.set(Math.cos(a) * 0.30, 0.05, Math.sin(a) * 0.30);
    g.add(w);
  });
  const col = cyl(0.07, 0.09, 1.18, black, 12);
  col.position.y = 0.65;
  g.add(col);

  const head = new THREE.Group();
  head.position.y = 1.30;
  g.add(head);
  head.add(tbox(0.34, 0.30, 0.62, black, 0, 0, 0));
  const barrel = cyl(0.085, 0.10, 0.40, simple(0x141418, { rough: 0.4 }), 16);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.46);
  head.add(barrel);
  const glass = cyl(0.078, 0.078, 0.012, simple(0x0a0a12, { rough: 0.04, metal: 0.4 }), 16);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0, 0.665);
  head.add(glass);
  // tally light — the red one that tells you which camera is live
  const tallyMat = simple(0x400a06, { rough: 0.35 });
  const tally = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.03), tallyMat);
  tally.position.set(0, 0.19, 0.30);
  head.add(tally);
  // and the little hood over the viewfinder
  head.add(tbox(0.20, 0.16, 0.18, black, -0.20, 0.10, -0.10));

  world.add(g);
  world.solid(x - 0.34, x + 0.34, z - 0.34, z + 0.34, 0, 1.5, 'prop');
  return {
    group: g, head, tally,
    setLive(v) {
      tallyMat.emissive.setHex(v ? 0xff2010 : 0x000000);
      tallyMat.emissiveIntensity = v ? 2.4 : 0;
    },
  };
}

/** A bank of studio lamps on a bar, with barn doors. */
export function lightBar(world, x, y, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const bar = cyl(0.032, 0.032, o.w ?? 5.0, simple(0x2a2a2e, { rough: 0.5, metal: 0.4 }), 10);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  const lamps = [];
  const n = o.n ?? 5;
  for (let i = 0; i < n; i++) {
    const lx = -(o.w ?? 5) / 2 + ((i + 0.5) * (o.w ?? 5)) / n;
    const can = new THREE.Group();
    can.position.set(lx, -0.20, 0);
    can.rotation.x = o.tilt ?? 0.55;
    const body = cyl(0.11, 0.13, 0.24, simple(0x24242a, { rough: 0.55 }), 12);
    can.add(body);
    const face = cyl(0.125, 0.125, 0.014, simple(0xfff0c8, { rough: 0.3, emissive: 0xfff0c8, emissiveIntensity: 0 }), 12);
    face.position.y = -0.13;
    can.add(face);
    // barn doors
    [[0, -0.15, 0.6], [0, 0.15, -0.6]].forEach(([dx, dz, rot]) => {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.006), simple(0x1a1a1e, { rough: 0.6 }));
      d.position.set(dx, -0.20, dz);
      d.rotation.x = rot;
      can.add(d);
    });
    g.add(can);
    lamps.push({ can, face: face.material });
  }
  world.add(g);
  return {
    group: g, lamps,
    /** @param {number} k 0..1 across the whole bar */
    setLevel(k) {
      lamps.forEach((l) => { l.face.emissiveIntensity = k * 2.2; });
    },
    /** Kill them one bank at a time, the way a studio actually goes dark. */
    killBank(i) { if (lamps[i]) lamps[i].face.emissiveIntensity = 0; },
  };
}

/**
 * Rows of seats with people in them. Instanced, because there are ninety and
 * none of them need to be told apart.
 */
export function audience(world, x, z, o = {}) {
  const rows = o.rows ?? 6, per = o.per ?? 15;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = o.rotY ?? 0;

  const dark = simple(0x14141a, { rough: 0.95 });
  const seatMat = simple(0x2a1e1e, { rough: 0.9 });
  const n = rows * per;

  const torso = new THREE.InstancedMesh(new THREE.BoxGeometry(0.40, 0.52, 0.26), dark, n);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.115, 10, 8), dark, n);
  const lap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.40, 0.20, 0.40), dark, n);
  const seat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.70, 0.46), seatMat, n);

  const m = new THREE.Matrix4();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < per; c++) {
      const px = (c - (per - 1) / 2) * 0.56 + (R() - 0.5) * 0.05;
      const pz = r * 0.78;
      const py = r * 0.24;          // raked, so they can all see you
      const lean = (R() - 0.5) * 0.10;
      m.makeRotationY(lean);
      m.setPosition(px, py + 0.86, pz);
      torso.setMatrixAt(i, m);
      m.makeRotationY(lean);
      m.setPosition(px, py + 1.24, pz - 0.02);
      head.setMatrixAt(i, m);
      m.makeRotationY(lean);
      m.setPosition(px, py + 0.66, pz + 0.14);
      lap.setMatrixAt(i, m);
      m.makeRotationY(0);
      m.setPosition(px, py + 0.35, pz + 0.06);
      seat.setMatrixAt(i, m);
      i++;
    }
  }
  [torso, head, lap, seat].forEach((im) => { im.instanceMatrix.needsUpdate = true; g.add(im); });

  // the rake they are sitting on
  for (let r = 0; r < rows; r++) {
    const step = tbox(per * 0.56 + 0.6, 0.24, 0.78, simple(0x18181c, { rough: 0.9 }),
      0, r * 0.24 + 0.12, r * 0.78, { cast: false });
    g.add(step);
  }

  world.add(g);
  // the rake is a solid block of people; the collider follows the turn
  const bw = per * 0.56 + 0.8;
  const bd = rows * 0.78 + 1.0;
  const rot = o.rotY ?? 0;
  const cx = x + Math.sin(rot) * (bd / 2 - 0.5);
  const cz = z + Math.cos(rot) * (bd / 2 - 0.5);
  world.solidRot(cx, cz, bw, bd, 0, 2.2, rot, 'wall');
  return { group: g, count: n };
}

/** APPLAUSE. It is not a request. */
export function applauseSign(world, x, y, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = o.rotY ?? 0;
  const live = liveCanvas(512, 128);
  const mat = new THREE.MeshStandardMaterial({
    map: live.tex, emissiveMap: live.tex, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.05, roughness: 0.5,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), mat);
  face.position.z = 0.03;
  g.add(face);
  g.add(tbox(1.62, 0.48, 0.10, simple(0x1a1a1e, { rough: 0.6 }), 0, 0, -0.02));

  const paint = (on) => {
    const { ctx, cv } = live;
    ctx.fillStyle = on ? '#f8e8a0' : '#2a2620';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = on ? '#7a1810' : '#3c3830';
    ctx.font = 'bold 74px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('APPLAUSE', cv.width / 2, cv.height / 2 + 4);
    live.touch();
  };
  paint(false);
  world.add(g);
  return {
    group: g,
    setOn(v) {
      paint(v);
      mat.emissiveIntensity = v ? 1.5 : 0.05;
    },
  };
}

// ------------------------------------------------------------------ basement

export function pipeRun(world, x0, x1, y, z, o = {}) {
  const g = new THREE.Group();
  const len = x1 - x0;
  const n = o.n ?? 3;
  for (let i = 0; i < n; i++) {
    const p = cyl(o.r ?? 0.055, o.r ?? 0.055, len, material('rust'), 10);
    p.rotation.z = Math.PI / 2;
    p.position.set((x0 + x1) / 2, y - i * 0.14, z);
    g.add(p);
  }
  // brackets
  for (let d = 0.6; d < len; d += 1.4) {
    g.add(tbox(0.04, 0.06 + n * 0.14, 0.12, simple(0x4a443c, { rough: 0.8 }), x0 + d, y - (n - 1) * 0.07, z));
  }
  world.add(g);
  return g;
}

/** Cable tray. There is far more cable down here than a block this size needs. */
export function cableTray(world, x0, x1, y, z, o = {}) {
  const g = new THREE.Group();
  const len = x1 - x0, cx = (x0 + x1) / 2;
  const tray = simple(0x50504a, { rough: 0.7, metal: 0.35 });
  g.add(tbox(len, 0.02, 0.34, tray, cx, y, z));
  g.add(tbox(len, 0.10, 0.02, tray, cx, y + 0.05, z - 0.17));
  g.add(tbox(len, 0.10, 0.02, tray, cx, y + 0.05, z + 0.17));
  const cols = [0x2a2a2e, 0x6a2a1e, 0x2a4a2a, 0x54542a];
  for (let i = 0; i < (o.cables ?? 9); i++) {
    const c = cyl(0.014, 0.014, len, simple(cols[i % cols.length], { rough: 0.85 }), 6);
    c.rotation.z = Math.PI / 2;
    c.position.set(cx, y + 0.03 + Math.floor(i / 5) * 0.03, z - 0.14 + (i % 5) * 0.07);
    g.add(c);
  }
  world.add(g);
  return g;
}

/** A door with a plaque and a bell push beside it. */
export function servicesDoor(world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.add(tbox(0.94, 2.06, 0.06, simple(0x3a4a44, { rough: 0.55, metal: 0.2 }), 0, 1.03, 0));
  // the plaque
  const live = liveCanvas(256, 96);
  const { ctx, cv } = live;
  ctx.fillStyle = '#b8a878';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#241c10';
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('VALCO', cv.width / 2, 34);
  ctx.font = '18px Georgia, serif';
  ctx.fillText('VIEWER SERVICES', cv.width / 2, 60);
  ctx.font = '12px Georgia, serif';
  ctx.fillText('RING FOR ATTENTION', cv.width / 2, 82);
  live.touch();
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.128),
    new THREE.MeshStandardMaterial({ map: live.tex, roughness: 0.5, metalness: 0.3 }));
  plaque.position.set(0, 1.52, 0.032);
  g.add(plaque);

  const push = cyl(0.022, 0.022, 0.016, simple(0xe8e4d4, { rough: 0.5 }), 12);
  push.rotation.x = Math.PI / 2;
  push.position.set(0.62, 1.16, 0.02);
  g.add(push);
  g.add(tbox(0.07, 0.10, 0.02, simple(0x8a7a58, { rough: 0.4, metal: 0.5 }), 0.62, 1.16, 0.008));

  world.add(g);
  world.solidRot(x, z, 1.0, 0.12, 0, 2.08, rotY, 'wall');
  return { group: g, push, plaque };
}

// ------------------------------------------------------------------ people

/**
 * VAL, life size. He is exactly as tall as the advertisements make him and he
 * does not smell of anything. He never moves while you are looking.
 */
export function valMascot(world, x, z, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = o.rotY ?? 0;

  const suit = simple(0x25405c, { rough: 0.72 });
  const cream = simple(0xefe2c4, { rough: 0.5 });
  const dark = simple(0x161216, { rough: 0.5 });

  g.add(tbox(0.44, 0.66, 0.28, suit, 0, 1.12, 0));                 // torso
  g.add(tbox(0.30, 0.44, 0.24, dark, 0, 0.62, 0));                 // legs, together
  [[-0.28, 1], [0.28, -1]].forEach(([ax, s]) => {
    const arm = cyl(0.055, 0.05, 0.56, suit, 8);
    arm.position.set(ax, 1.08, 0.02);
    arm.rotation.z = s * 0.13;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), cream);
    hand.position.set(ax + s * -0.07, 0.80, 0.02);
    g.add(hand);
  });
  [-0.10, 0.10].forEach((fx) => {
    g.add(tbox(0.13, 0.07, 0.24, dark, fx, 0.035, 0.05));
  });

  const head = new THREE.Group();
  head.position.y = 1.62;
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), cream);
  head.add(skull);
  const brim = cyl(0.245, 0.245, 0.018, dark, 20);
  brim.position.y = 0.145;
  head.add(brim);
  const crown = cyl(0.145, 0.155, 0.135, dark, 18);
  crown.position.y = 0.212;
  head.add(crown);
  const band = cyl(0.158, 0.158, 0.030, simple(0x7a231c, { rough: 0.6 }), 18);
  band.position.y = 0.162;
  head.add(band);

  const ft = new THREE.CanvasTexture(valFace(256, { bg: '#efe2c4' }));
  ft.colorSpace = THREE.SRGBColorSpace;
  const faceMat = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.46, transparent: true });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), faceMat);
  face.position.set(0, 0.005, 0.186);
  head.add(face);

  g.visible = false;
  world.add(g);
  return { group: g, head, face };
}

/**
 * A low-poly stand-in for you, because on Day 1 you have your own eyes and by
 * Day 6 you are somebody the cameras are pointing at.
 */
export function avatar(o = {}) {
  const g = new THREE.Group();
  const cloth = simple(o.shirt ?? 0x6a6f78, { rough: 0.9 });
  const trews = simple(o.trousers ?? 0x33333c, { rough: 0.9 });
  const skin = simple(o.skin ?? 0xc49a76, { rough: 0.72 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.58, 0.23), cloth);
  torso.position.y = 1.20;
  g.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), trews);
  hips.position.y = 0.86;
  g.add(hips);

  const legs = [];
  [-0.10, 0.10].forEach((lx) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.80, 0.17), trews);
    leg.position.y = -0.40;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.26), simple(0x201a16, { rough: 0.8 }));
    shoe.position.set(0, -0.78, 0.04);
    pivot.add(shoe);
    g.add(pivot);
    legs.push(pivot);
  });

  const arms = [];
  [-0.26, 0.26].forEach((ax) => {
    const pivot = new THREE.Group();
    pivot.position.set(ax, 1.42, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.14), cloth);
    arm.position.y = -0.28;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin);
    hand.position.y = -0.58;
    pivot.add(hand);
    g.add(pivot);
    arms.push(pivot);
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 8), skin);
  neck.position.y = 1.52;
  g.add(neck);
  const head = new THREE.Group();
  head.position.y = 1.66;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.20), skin);
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.09, 0.215), simple(o.hair ?? 0x2c2018, { rough: 0.95 }));
  hair.position.y = 0.10;
  head.add(hair);
  g.add(head);

  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { group: g, head, legs, arms };
}

/** Walk cycle for the stand-in. Only ever seen from across the room. */
export function poseAvatar(av, walk, t, pitch = 0) {
  const s = Math.sin(t * 8.4) * Math.min(1, walk);
  av.legs[0].rotation.x = s * 0.62;
  av.legs[1].rotation.x = -s * 0.62;
  av.arms[0].rotation.x = -s * 0.44;
  av.arms[1].rotation.x = s * 0.44;
  av.arms[0].rotation.z = 0.06;
  av.arms[1].rotation.z = -0.06;
  av.head.rotation.x = pitch * 0.55;
  av.group.position.y = Math.abs(Math.cos(t * 8.4)) * 0.022 * Math.min(1, walk);
}
