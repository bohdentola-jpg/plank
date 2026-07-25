// Everything in the rooms that isn't the rooms: light fixtures, furniture,
// pipework, cars, gurneys, party cake. Each builder returns a THREE.Group in
// metres with its origin on the floor, facing +Z, ready to be dropped on a cell.
//
// The rules that keep 130 props cheap: box-and-cylinder primitives only, shared
// materials wherever the surface repeats, and no prop over about 40 triangles
// unless the player is meant to look straight at it. Anything emissive gets its
// glow from the material — real lights are placed by the level, not by props.

import * as THREE from 'three';
import { simple, material } from './textures.js';
import { rng } from './util.js';

// ------------------------------------------------------------------ shorthand
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
};
const cyl = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 8) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  return m;
};
const sph = (r, mat, x = 0, y = 0, z = 0, seg = 8) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2)), mat);
  m.position.set(x, y, z);
  return m;
};
const plane = (w, h, mat, rotX = -Math.PI / 2) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.rotation.x = rotX;
  return m;
};
const G = (...kids) => {
  const g = new THREE.Group();
  for (const k of kids) if (k) g.add(k);
  return g;
};


// ------------------------------------------------------------------ chalk
// Chalk on a hard floor: a stick of it dragged fast by somebody who was not stopping to
// do a neat job. Every stroke is a scatter of dust along its path rather than a line —
// heavier where the stick bit, gone where it skipped, with a smudge where a shoe went
// over it afterwards. Six of them are drawn on demand and shared by every mark on the
// floor; the variation you see is which of the six plus which way it points.
const CHALK = [];
function chalkMark(variant) {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  let seed = (variant * 9781 + 12345) | 0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // one stroke: dust along the path, thinning and skipping like real chalk
  const stroke = (x0, y0, x1, y1, width, press) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(8, Math.round(len * 2.2));
    let skip = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // pressure: firm in the middle of a stroke, light at both ends
      const taper = Math.min(1, Math.sin(t * Math.PI) * 1.5);
      if (skip > 0) { skip--; continue; }
      if (rnd() < 0.06) { skip = 1 + Math.floor(rnd() * 2); continue; }   // the stick skips
      const cx = x0 + (x1 - x0) * t + (rnd() - 0.5) * width * 0.5;
      const cy = y0 + (y1 - y0) * t + (rnd() - 0.5) * width * 0.5;
      const grains = 5 + Math.floor(rnd() * 5);
      for (let k = 0; k < grains; k++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.pow(rnd(), 0.6) * width * 0.55;
        const dust = 0.10 + rnd() * 0.30;
        ctx.fillStyle = `rgba(238,236,226,${(dust * taper * press).toFixed(3)})`;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        ctx.fillRect(px, py, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
      }
    }
  };

  // the arrow: shaft, then the head, drawn twice over with a wobble so the strokes
  // double up the way a hand does when it goes back over a mark
  const wob = () => (rnd() - 0.5) * 5;
  for (let pass = 0; pass < 2; pass++) {
    const press = pass === 0 ? 1 : 0.55;
    stroke(20 + wob(), 64 + wob(), 96 + wob(), 64 + wob(), 9, press);
    stroke(74 + wob(), 40 + wob(), 100 + wob(), 64 + wob(), 8, press);
    stroke(74 + wob(), 88 + wob(), 100 + wob(), 64 + wob(), 8, press);
  }
  // a shoe went through it: a smear pulling the dust sideways
  ctx.globalAlpha = 0.35;
  ctx.drawImage(cv, Math.round(rnd() * 5) - 2, Math.round(rnd() * 7) - 3);
  ctx.globalAlpha = 1;
  // and the floor eats some of it back
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(0,0,0,${(0.05 + rnd() * 0.12).toFixed(3)})`;
    ctx.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 7, 1 + rnd() * 3);
  }

  const tex = new THREE.CanvasTexture(cv);
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, metalness: 0 });
}

// ------------------------------------------------------------------ palette
// Shared materials: one instance each, so a hundred chairs are one material.
const M = {};
const mat = (key, color, opts) => (M[key] = M[key] || simple(color, opts));
const steel = () => mat('steel', 0x9aa0a6, { rough: 0.45, metal: 0.8 });
const darkSteel = () => mat('darkSteel', 0x4a4e54, { rough: 0.5, metal: 0.7 });
const painted = () => mat('painted', 0xb9b4a6, { rough: 0.7 });
const plasticGrey = () => mat('plasticGrey', 0x6e7276, { rough: 0.6 });
const plasticBeige = () => mat('plasticBeige', 0xd6cdb4, { rough: 0.65 });
const wood = () => mat('wood', 0x6b4a29, { rough: 0.75 });
const darkWood = () => mat('darkWood', 0x3e2a17, { rough: 0.7 });
const fabric = () => mat('fabric', 0x5a5f55, { rough: 0.98 });
const redFabric = () => mat('redFabric', 0x6d2029, { rough: 0.98 });
const rubber = () => mat('rubber', 0x1a1a1c, { rough: 0.95 });
const glassMat = () => mat('glassy', 0xa8c0cc, { rough: 0.08, metal: 0.2, opacity: 0.35 });
const glowWhite = () => mat('glowWhite', 0xfff6dc, { emissive: 0xfff2c8, emissiveIntensity: 1.6, rough: 0.4 });
const glowDead = () => mat('glowDead', 0x9a9686, { rough: 0.5 });
const glowRed = () => mat('glowRed', 0xff5040, { emissive: 0xff2418, emissiveIntensity: 1.8, rough: 0.4 });
const glowGreen = () => mat('glowGreen', 0x60ff90, { emissive: 0x30ff70, emissiveIntensity: 1.5, rough: 0.4 });
const glowCyan = () => mat('glowCyan', 0x90eaff, { emissive: 0x60d8ff, emissiveIntensity: 1.5, rough: 0.3 });
const paper = () => mat('paperProp', 0xdcd6c2, { rough: 0.95 });
const flesh = () => mat('fleshProp', 0x6d3f3a, { rough: 0.6 });
const concreteM = () => mat('concreteProp', 0x8d8c86, { rough: 0.92 });
const rustM = () => mat('rustProp', 0x6d4526, { rough: 0.9, metal: 0.25 });

// ------------------------------------------------------------------ builders
// Each takes (o) — the level's prop record — and returns a Group. `o.height`,
// `o.scale`, `o.rot` and anything else a level passed through is available.
export const BUILDERS = {
  // ------------------------------------------------------------ light fittings
  tube(o) {
    const on = o.dead !== true;
    const g = G(
      box(0.16, 0.08, 1.5, darkSteel(), 0, -0.08, 0),
      box(0.1, 0.05, 1.36, on ? glowWhite() : glowDead(), 0, -0.11, 0),
    );
    g.userData.hang = true;
    return g;
  },
  tubeBroken() {
    const g = G(
      box(0.16, 0.08, 1.5, darkSteel(), 0, -0.08, 0),
      box(0.09, 0.04, 0.5, glowDead(), 0, -0.11, -0.4),
    );
    g.userData.hang = true;
    return g;
  },
  panelLight(o) {
    const g = G(
      box(1.2, 0.06, 1.2, darkSteel(), 0, -0.06, 0),
      box(1.1, 0.03, 1.1, o.dead ? glowDead() : glowWhite(), 0, -0.085, 0),
    );
    g.userData.hang = true;
    return g;
  },
  bulb(o) {
    const g = G(
      cyl(0.012, 0.012, 0.4, darkSteel(), 0, -0.4, 0, 5),
      sph(0.075, o.dead ? glowDead() : glowWhite(), 0, -0.46, 0),
    );
    g.userData.hang = true;
    return g;
  },
  cageLight(o) {
    const g = G(
      sph(0.1, o.dead ? glowDead() : glowWhite(), 0, -0.2, 0),
      cyl(0.14, 0.14, 0.22, null, 0, -0.32, 0, 6),
    );
    g.children[1].material = darkSteel();
    g.children[1].material.wireframe = false;
    g.userData.hang = true;
    return g;
  },
  lamp(o) {
    return G(
      cyl(0.14, 0.1, 0.03, darkSteel()),
      cyl(0.02, 0.02, 0.42, darkSteel(), 0, 0.03),
      cyl(0.17, 0.11, 0.2, o.dead ? plasticBeige() : glowWhite(), 0, 0.42),
    );
  },
  floodlight() {
    return G(
      cyl(0.2, 0.24, 0.05, darkSteel()),
      cyl(0.03, 0.03, 1.3, darkSteel(), 0, 0.05),
      box(0.34, 0.24, 0.16, darkSteel(), 0, 1.3),
      box(0.28, 0.18, 0.03, glowWhite(), 0, 1.36, 0.09),
    );
  },
  exitSign() {
    const g = G(
      box(0.5, 0.22, 0.05, mat('exitBox', 0x1d3a20, { rough: 0.6 }), 0, -0.3),
      box(0.44, 0.16, 0.02, glowGreen(), 0, -0.27, 0.035),
    );
    g.userData.hang = true;
    return g;
  },
  emergencyLight() {
    const g = G(
      box(0.3, 0.14, 0.12, painted(), 0, -0.2),
      box(0.1, 0.08, 0.04, glowRed(), -0.07, -0.17, 0.07),
      box(0.1, 0.08, 0.04, glowRed(), 0.07, -0.17, 0.07),
    );
    g.userData.hang = true;
    return g;
  },
  chandelier() {
    const g = new THREE.Group();
    g.add(cyl(0.02, 0.02, 0.8, mat('brass', 0xa8863c, { rough: 0.4, metal: 0.7 }), 0, -0.8, 0, 5));
    g.add(cyl(0.34, 0.4, 0.06, mat('brass', 0xa8863c), 0, -0.86, 0, 10));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(sph(0.06, glowWhite(), Math.cos(a) * 0.42, -0.9, Math.sin(a) * 0.42, 6));
      g.add(cyl(0.008, 0.008, 0.22, glassMat(), Math.cos(a) * 0.5, -1.14, Math.sin(a) * 0.5, 4));
    }
    g.userData.hang = true;
    return g;
  },
  lantern() {
    return G(
      cyl(0.09, 0.11, 0.06, darkSteel()),
      box(0.13, 0.2, 0.13, glowWhite(), 0, 0.06),
      cyl(0.1, 0.06, 0.07, darkSteel(), 0, 0.26),
    );
  },
  streetlight() {
    const g = G(
      cyl(0.14, 0.11, 0.5, concreteM()),
      cyl(0.08, 0.06, 7.2, painted(), 0, 0.5, 0, 6),
      box(0.16, 0.1, 1.4, painted(), 0, 7.6, 0.6),
      box(0.4, 0.14, 0.7, mat('sodium', 0xffd08a, { emissive: 0xffb050, emissiveIntensity: 2.0, rough: 0.4 }), 0, 7.5, 1.2),
    );
    return g;
  },
  poolLight() {
    const g = G(cyl(0.22, 0.24, 0.06, mat('poolRim', 0xdfe8e4, { rough: 0.2 })));
    g.add(cyl(0.18, 0.18, 0.02, glowCyan(), 0, 0.06, 0, 10));
    g.rotation.x = Math.PI / 2;
    return g;
  },

  // ------------------------------------------------------------ structure
  pillar(o) {
    const h = o.height ?? 3;
    return G(cyl(0.34, 0.36, h, concreteM(), 0, 0, 0, 10));
  },
  pillarSquare(o) {
    const h = o.height ?? 3;
    return G(box(0.7, h, 0.7, concreteM()), box(0.82, 0.12, 0.82, concreteM(), 0, h - 0.12));
  },
  beam(o) {
    const g = G(box(o.len ?? 6, 0.35, 0.22, darkSteel()));
    g.position.y = (o.height ?? 2.8);
    return g;
  },
  ductRun(o) {
    const g = G(box(o.len ?? 6, 0.5, 0.6, mat('duct', 0x9aa2ac, { rough: 0.5, metal: 0.6 })));
    for (let i = -2; i <= 2; i++) g.add(box(0.06, 0.56, 0.66, darkSteel(), i * 1.2, -0.03));
    g.position.y = (o.height ?? 2.5);
    return g;
  },
  pipeRun(o) {
    const len = o.len ?? 6;
    const g = new THREE.Group();
    for (const [dy, r, m] of [[0, 0.1, rustM()], [0.26, 0.07, steel()], [0.44, 0.05, rustM()]]) {
      const p = cyl(r, r, len, m, 0, dy, 0, 7);
      p.rotation.z = Math.PI / 2;
      g.add(p);
    }
    g.position.y = (o.height ?? 2.2);
    return g;
  },
  pipeCluster(o) {
    const g = new THREE.Group();
    const R = rng(7 + Math.round((o.x || 0) * 13));
    for (let i = 0; i < 5; i++) {
      const p = cyl(0.05 + R() * 0.07, 0.05, o.len ?? 5, R() < 0.5 ? rustM() : steel(), (R() - 0.5) * 0.5, 1.6 + R() * 1.2, (R() - 0.5) * 0.4, 6);
      p.rotation.z = Math.PI / 2;
      g.add(p);
    }
    for (let i = 0; i < 2; i++) g.add(cyl(0.06, 0.06, 2.2, rustM(), (R() - 0.5) * 0.6, 0, (R() - 0.5) * 0.4, 6));
    return g;
  },
  vent() {
    const g = G(box(0.7, 0.5, 0.06, darkSteel(), 0, -0.25));
    for (let i = 0; i < 5; i++) g.add(box(0.62, 0.03, 0.02, plasticGrey(), 0, -0.44 + i * 0.09, 0.04));
    return g;
  },
  ventFloor() {
    const g = G(plane(0.8, 0.8, mat('ventFloorM', 0x2a2c2e, { rough: 0.6, metal: 0.5 })));
    g.position.y = 0.01;
    return g;
  },
  doorFrame() {
    return G(
      box(0.14, 2.2, 0.2, painted(), -1.0),
      box(0.14, 2.2, 0.2, painted(), 1.0),
      box(2.14, 0.16, 0.2, painted(), 0, 2.2),
    );
  },
  door(o) {
    const g = new THREE.Group();
    const d = box(0.95, 2.05, 0.06, o.metal ? darkSteel() : wood(), 0.48);
    d.rotation.y = o.open ? -1.1 : 0;
    if (o.open) { d.position.set(0.2, 1.02, 0.45); }
    g.add(d);
    g.add(sph(0.045, steel(), o.open ? 0.72 : 0.9, 1.05, o.open ? 0.9 : 0.06, 6));
    g.add(BUILDERS.doorFrame({}));
    return g;
  },
  doubleDoor() {
    const g = G(BUILDERS.doorFrame({}));
    const l = box(0.95, 2.05, 0.06, darkSteel(), -0.48);
    const r = box(0.95, 2.05, 0.06, darkSteel(), 0.48);
    g.add(l, r);
    g.add(box(0.1, 0.06, 0.05, steel(), -0.1, 1.05, 0.06));
    g.add(box(0.1, 0.06, 0.05, steel(), 0.1, 1.05, 0.06));
    return g;
  },
  elevatorDoors() {
    const g = G(
      box(2.4, 2.4, 0.12, brushed(), 0, 0, -0.06),
      box(1.05, 2.2, 0.06, brushed(), -0.54, 0, 0.02),
      box(1.05, 2.2, 0.06, brushed(), 0.54, 0, 0.02),
      box(0.3, 0.16, 0.04, mat('elevIndicator', 0x201a10, { rough: 0.5 }), 0, 2.5, 0.04),
      box(0.22, 0.09, 0.02, glowRed(), 0, 2.53, 0.06),
    );
    return g;
  },

  // THE SERVICE LIFT. The one thing on a floor you are actually looking for, so it is
  // built like a real one and gets the triangles to prove it: a recessed architrave in
  // the wall, two centre-opening panels with a seam down the middle, a lantern above
  // with the car's position lit up in it, a call plate at hand height, and a brass
  // threshold worn pale by everyone who found it before you. The doors slide (main.js
  // opens them as you come up), so `userData.doors` is the pair.
  liftEntrance(o = {}) {
    const g = new THREE.Group();
    const frameM = brushed();
    // The panels carry a little light of their own. A point light out in the corridor
    // puts a hard hotspot in the middle of them and leaves the rest black; steel that
    // glows very slightly reads as pale metal from the far end of a dark floor, which
    // is the job this object has.
    const panelM = mat('liftPanel', 0x8e959c, {
      rough: 0.38, metal: 0.5, emissive: 0x4a463c, emissiveIntensity: 1.4,
    });
    const recessM = mat('liftRecess', 0x2b2e32, { rough: 0.7, metal: 0.3 });
    const H = 2.45, W = 1.15;                     // door leaf height and width

    // architrave: a raised surround, so it reads as set into the wall
    g.add(box(3.1, 0.16, 0.3, frameM, 0, H + 0.18, 0.06));      // lintel
    g.add(box(0.22, H + 0.34, 0.3, frameM, -1.44, 0, 0.06));    // jambs
    g.add(box(0.22, H + 0.34, 0.3, frameM, 1.44, 0, 0.06));
    // A shallow car behind the doors, lit and panelled, so opening them shows you
    // somewhere to go rather than a black rectangle. The real car you can walk around
    // in gets built when you step in; this is the metre and a bit you see from outside.
    const carWall = mat('liftCarWall', 0x8a8474, { rough: 0.55, metal: 0.25, emissive: 0x241f16, emissiveIntensity: 0.8 });
    const carFloor = mat('liftCarFloor', 0x3a352c, { rough: 0.8 });
    g.add(box(2.4, H + 0.1, 0.08, carWall, 0, 0, -1.5));            // back wall
    g.add(box(0.08, H + 0.1, 1.5, carWall, -1.2, 0, -0.78));        // sides
    g.add(box(0.08, H + 0.1, 1.5, carWall, 1.2, 0, -0.78));
    g.add(box(2.4, 0.06, 1.5, carFloor, 0, -0.03, -0.78));          // floor
    g.add(box(2.4, 0.08, 1.5, recessM, 0, H + 0.02, -0.78));        // ceiling
    g.add(box(1.1, 0.05, 0.5, mat('liftCarLamp', 0xfff2cc, {
      emissive: 0xffe0a0, emissiveIntensity: 2.4, rough: 0.4,
    }), 0, H - 0.06, -0.78));
    // a handrail along the back, because every service lift has one
    const rail = cyl(0.035, 0.035, 2.1, brushed(), 0, 0, -1.4, 8);
    rail.rotation.z = Math.PI / 2;
    rail.position.y = 0.95;
    g.add(rail);

    // the two leaves, centre-opening
    const leaf = (side) => {
      const l = new THREE.Group();
      l.add(box(W, H, 0.09, panelM, 0, 0, 0));
      // a raised style down each leaf and a scuffed kick plate at the bottom
      l.add(box(0.05, H - 0.12, 0.02, frameM, side * (W / 2 - 0.09), 0.06, 0.055));
      l.add(box(W - 0.1, 0.26, 0.02, mat('liftKick', 0x767c82, { rough: 0.55, metal: 0.7 }), 0, 0.03, 0.055));
      l.position.x = side * (W / 2);
      return l;
    };
    const dl = leaf(-1), dr = leaf(1);
    g.add(dl, dr);

    // the lantern: the car's floor, lit, above the doors
    g.add(box(1.1, 0.34, 0.12, mat('liftLantern', 0x1a1c1e, { rough: 0.6 }), 0, H + 0.36, 0.14));
    const lamp = box(0.86, 0.2, 0.03, mat('liftLampLit', 0xffcf7a, {
      emissive: 0xffa020, emissiveIntensity: 2.1, rough: 0.4,
    }), 0, H + 0.43, 0.2);
    g.add(lamp);
    // a down-arrow beside it, because the only direction this thing goes is down
    const tri = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.16, 3),
      mat('liftArrow', 0xffe0a0, { emissive: 0xffb040, emissiveIntensity: 1.6, rough: 0.4 }),
    );
    tri.rotation.x = Math.PI;
    tri.rotation.y = Math.PI / 2;
    tri.position.set(0.72, H + 0.53, 0.2);
    g.add(tri);

    // call plate at hand height: worn steel, one lit button, a scratched legend
    g.add(box(0.24, 0.44, 0.05, frameM, 1.66, 1.0, 0.1));
    const btn = cyl(0.05, 0.05, 0.03, mat('liftBtn', 0xffd070, {
      emissive: 0xff9020, emissiveIntensity: 1.8, rough: 0.4,
    }), 1.66, 1.28, 0.13, 10);
    btn.rotation.x = Math.PI / 2;
    g.add(btn);
    g.add(box(0.1, 0.03, 0.01, mat('liftLegend', 0x30343a, { rough: 0.8 }), 1.66, 1.1, 0.13));

    // threshold: brass, and pale down the middle
    g.add(box(2.7, 0.04, 0.34, mat('liftSill', 0x9c8a5e, { rough: 0.5, metal: 0.6 }), 0, 0, 0.2));
    g.add(box(2.7, 0.05, 0.1, mat('liftSillWorn', 0xc4b489, { rough: 0.35, metal: 0.7 }), 0, 0, 0.2));

    g.userData.doors = { l: dl, r: dr, closedL: -(W / 2), closedR: W / 2, open: W * 0.98 };
    g.userData.lamp = lamp;
    return g;
  },
  window(o) {
    const w = o.w ?? 1.6, h = o.h ?? 1.2, sill = o.sill ?? 0.9;
    return G(
      box(w + 0.16, h + 0.16, 0.1, painted(), 0, sill - 0.08, 0),
      box(w, h, 0.03, glassMat(), 0, sill, 0.04),
      box(w + 0.2, 0.08, 0.18, painted(), 0, sill - 0.08),
    );
  },
  archway() {
    const g = G(box(0.3, 2.6, 0.4, painted(), -1.2), box(0.3, 2.6, 0.4, painted(), 1.2));
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.16, 6, 12, Math.PI), painted());
    arch.position.y = 2.6;
    arch.rotation.z = 0;
    g.add(arch);
    return g;
  },
  railing(o) {
    const len = o.len ?? 3;
    const g = new THREE.Group();
    const top = cyl(0.035, 0.035, len, steel(), 0, 1.05, 0, 6);
    top.rotation.z = Math.PI / 2;
    const mid = cyl(0.03, 0.03, len, steel(), 0, 0.55, 0, 6);
    mid.rotation.z = Math.PI / 2;
    g.add(top, mid);
    for (let i = 0; i <= Math.floor(len); i++) g.add(cyl(0.03, 0.03, 1.05, steel(), -len / 2 + i, 0, 0, 6));
    return g;
  },
  chainFence(o) {
    const len = o.len ?? 3;
    const g = new THREE.Group();
    const m = mat('chain', 0x8d949a, { rough: 0.5, metal: 0.7, opacity: 0.55 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), m);
    mesh.position.y = 1.1;
    g.add(mesh);
    g.add(cyl(0.04, 0.04, 2.3, steel(), -len / 2, 0, 0, 6), cyl(0.04, 0.04, 2.3, steel(), len / 2, 0, 0, 6));
    return g;
  },
  ladder(o) {
    const h = o.height ?? 3;
    const g = new THREE.Group();
    g.add(cyl(0.035, 0.035, h, steel(), -0.22, 0, 0, 6), cyl(0.035, 0.035, h, steel(), 0.22, 0, 0, 6));
    for (let y = 0.3; y < h; y += 0.32) {
      const r = cyl(0.025, 0.025, 0.44, steel(), 0, y, 0, 5);
      r.rotation.z = Math.PI / 2;
      g.add(r);
    }
    return g;
  },
  stairFlight(o) {
    const g = new THREE.Group();
    const steps = o.steps ?? 8, rise = (o.height ?? 2.4) / steps;
    for (let i = 0; i < steps; i++) g.add(box(1.4, rise, 0.3, concreteM(), 0, i * rise, i * 0.3));
    return g;
  },
  rubblePile(o) {
    const g = new THREE.Group();
    const R = rng(3 + Math.round((o.x || 1) * 31 + (o.z || 1) * 7));
    for (let i = 0; i < 9; i++) {
      const s = 0.12 + R() * 0.3;
      const b = box(s, s * 0.7, s, concreteM(), (R() - 0.5) * 1.1, R() * 0.2, (R() - 0.5) * 1.1);
      b.rotation.set(R(), R() * 3, R());
      g.add(b);
    }
    return g;
  },
  columnBroken(o) {
    const h = (o.height ?? 3) * 0.55;
    return G(cyl(0.36, 0.32, h, concreteM(), 0, 0, 0, 9), BUILDERS.rubblePile(o));
  },
  trapdoor() {
    const g = G(plane(1.1, 1.1, mat('trap', 0x4a3a26, { rough: 0.8 })));
    g.position.y = 0.02;
    g.add(box(0.2, 0.03, 0.05, steel(), 0.4, 0.02, 0));
    return g;
  },

  // ------------------------------------------------------------ workplaces
  desk() {
    return G(
      box(1.5, 0.05, 0.75, mat('deskTop', 0x9a8a6e, { rough: 0.6 }), 0, 0.7),
      box(0.06, 0.7, 0.7, plasticGrey(), -0.7),
      box(0.06, 0.7, 0.7, plasticGrey(), 0.7),
      box(0.5, 0.55, 0.6, plasticGrey(), 0.44, 0.08),
    );
  },
  officeChair() {
    return G(
      cyl(0.03, 0.03, 0.4, darkSteel(), 0, 0.06),
      cyl(0.28, 0.05, 0.04, darkSteel(), 0, 0.02, 0, 5),
      box(0.46, 0.08, 0.46, fabric(), 0, 0.46),
      box(0.44, 0.5, 0.08, fabric(), 0, 0.54, -0.2),
    );
  },
  cubicle(o) {
    const len = o.len ?? 2;
    return G(
      box(len, 1.35, 0.07, material('cubicleFabric'), 0, 0),
      box(0.07, 1.35, len * 0.7, material('cubicleFabric'), -len / 2, 0, len * 0.35),
    );
  },
  filingCabinet() {
    const g = G(box(0.5, 1.32, 0.62, mat('cabinet', 0x7b7f79, { rough: 0.55, metal: 0.4 })));
    for (let i = 0; i < 4; i++) g.add(box(0.44, 0.28, 0.02, darkSteel(), 0, 0.06 + i * 0.32, 0.32));
    return g;
  },
  shelf(o) {
    const h = o.height ?? 2;
    const g = new THREE.Group();
    g.add(box(0.07, h, 0.5, steel(), -0.6), box(0.07, h, 0.5, steel(), 0.6));
    for (let i = 0; i < 4; i++) g.add(box(1.3, 0.04, 0.5, steel(), 0, 0.25 + i * (h - 0.4) / 3));
    return g;
  },
  bookshelf(o) {
    const h = o.height ?? 2;
    return G(
      box(1.2, h, 0.34, material('shelfWall')),
      box(1.3, 0.06, 0.4, darkWood(), 0, h - 0.06),
    );
  },
  archiveShelf(o) {
    const h = o.height ?? 2.4;
    const g = G(box(1.6, h, 0.55, material('shelfWall')));
    g.add(box(1.7, 0.06, 0.62, darkSteel(), 0, h - 0.06));
    g.add(box(0.3, 0.1, 0.02, paper(), 0, h * 0.55, 0.3));
    return g;
  },
  serverRack() {
    const g = G(box(0.7, 2, 0.9, darkSteel()));
    const R = rng(21);
    for (let i = 0; i < 14; i++) {
      g.add(box(0.62, 0.1, 0.02, plasticGrey(), 0, 0.1 + i * 0.13, 0.46));
      if (R() < 0.5) g.add(box(0.03, 0.02, 0.01, R() < 0.7 ? glowGreen() : glowRed(), 0.26, 0.14 + i * 0.13, 0.48));
    }
    return g;
  },
  breakerBox() {
    const g = G(box(0.6, 0.85, 0.18, mat('breakerM', 0x67707a, { rough: 0.5, metal: 0.5 }), 0, 0.9));
    for (let i = 0; i < 6; i++) {
      g.add(box(0.06, 0.1, 0.04, i % 3 ? plasticBeige() : glowRed(), -0.2 + (i % 3) * 0.2, 1.05 + Math.floor(i / 3) * 0.22, 0.1));
    }
    return g;
  },
  transformer() {
    const g = G(
      box(1.3, 1.9, 1.0, mat('transM', 0x5d6165, { rough: 0.6, metal: 0.5 })),
      box(1.4, 0.12, 1.1, darkSteel(), 0, 1.9),
    );
    for (let i = 0; i < 3; i++) {
      g.add(cyl(0.1, 0.13, 0.4, mat('insulator', 0x8a5a3a, { rough: 0.4 }), -0.4 + i * 0.4, 2.02, 0, 8));
    }
    for (let i = 0; i < 8; i++) g.add(box(0.05, 1.6, 0.06, darkSteel(), -0.6 + i * 0.17, 0.15, 0.53));
    return g;
  },
  valveWheel() {
    const g = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 5, 12), rustM());
    wheel.position.y = 1.2;
    g.add(wheel, cyl(0.06, 0.06, 0.4, steel(), 0, 0.8, 0, 6));
    for (let i = 0; i < 4; i++) {
      const s = cyl(0.02, 0.02, 0.56, rustM(), 0, 1.2, 0, 4);
      s.rotation.z = Math.PI / 2;
      s.rotation.y = (i / 4) * Math.PI;
      g.add(s);
    }
    return g;
  },
  payphone() {
    return G(
      box(0.34, 0.6, 0.2, mat('phoneBody', 0x3a4a4e, { rough: 0.5, metal: 0.3 }), 0, 1.1),
      box(0.1, 0.24, 0.1, rubber(), -0.22, 1.28),
      box(0.2, 0.02, 0.02, rubber(), -0.12, 1.2, 0.1),
    );
  },
  crtMonitor() {
    return G(
      box(0.42, 0.36, 0.42, plasticBeige(), 0, 0.72),
      box(0.34, 0.26, 0.02, mat('crtGlass', 0x14181c, { rough: 0.15 }), 0, 0.78, 0.21),
    );
  },
  vendingMachine() {
    const g = G(
      box(1.0, 1.95, 0.75, mat('vendBody', 0x8a1f22, { rough: 0.5 })),
      box(0.62, 1.3, 0.03, glassMat(), -0.14, 0.5, 0.38),
      box(0.3, 1.9, 0.04, mat('vendPanel', 0x2a2a2e, { rough: 0.6 }), 0.32, 0.03, 0.38),
    );
    const R = rng(88);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        g.add(box(0.1, 0.16, 0.08, simple(new THREE.Color().setHSL(R(), 0.55, 0.5).getHex(), { rough: 0.6 }), -0.4 + c * 0.14, 0.62 + r * 0.28, 0.3));
      }
    }
    g.add(box(0.26, 0.5, 0.02, glowWhite(), 0.32, 1.3, 0.39));
    return g;
  },
  lockers(o) {
    const n = o.n ?? 3;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) g.add(box(0.4, 1.8, 0.45, material('lockerWall'), (i - (n - 1) / 2) * 0.42));
    return g;
  },
  clock() {
    const g = G(cyl(0.16, 0.16, 0.05, painted(), 0, 2.1, 0, 12));
    g.children[0].rotation.x = Math.PI / 2;
    g.add(box(0.02, 0.1, 0.01, rubber(), 0, 2.14, 0.04));
    return g;
  },
  corkboard() {
    const g = G(box(1.4, 0.9, 0.05, mat('cork', 0xa8804c, { rough: 0.9 }), 0, 1.1));
    const R = rng(55);
    for (let i = 0; i < 9; i++) {
      const p = box(0.16, 0.22, 0.01, paper(), (R() - 0.5) * 1.1, 1.15 + (R() - 0.5) * 0.6, 0.03);
      p.rotation.z = (R() - 0.5) * 0.3;
      g.add(p);
    }
    return g;
  },
  watercooler() {
    return G(
      box(0.36, 1.0, 0.36, plasticBeige()),
      cyl(0.17, 0.14, 0.45, mat('waterJug', 0x9fd0e0, { rough: 0.2, opacity: 0.6 }), 0, 1.0, 0, 10),
    );
  },
  trashcan() {
    return G(cyl(0.19, 0.16, 0.55, plasticGrey(), 0, 0, 0, 9));
  },
  mopBucket() {
    return G(
      box(0.42, 0.28, 0.32, mat('bucketM', 0xd8c832, { rough: 0.6 })),
      cyl(0.02, 0.02, 1.3, wood(), 0.16, 0.28, 0, 5),
    );
  },
  wetFloorSign() {
    const g = new THREE.Group();
    const m = mat('signYellow', 0xe8c22a, { rough: 0.6 });
    const a = box(0.35, 0.6, 0.02, m, 0, 0, -0.08);
    a.rotation.x = 0.22;
    const b = box(0.35, 0.6, 0.02, m, 0, 0, 0.08);
    b.rotation.x = -0.22;
    g.add(a, b);
    return g;
  },
  crate(o) {
    const s = o.size ?? 0.8;
    return G(box(s, s * 0.85, s, wood()), box(s * 1.02, 0.05, s * 0.2, darkWood(), 0, s * 0.4));
  },
  crateStack(o) {
    const g = new THREE.Group();
    const R = rng(11 + Math.round((o.x || 0) * 17));
    for (let i = 0; i < 3; i++) {
      const c = BUILDERS.crate({ size: 0.7 + R() * 0.2 });
      c.position.set((R() - 0.5) * 0.2, i * 0.65, (R() - 0.5) * 0.2);
      c.rotation.y = (R() - 0.5) * 0.4;
      g.add(c);
    }
    return g;
  },
  pallet() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) g.add(box(1.1, 0.04, 0.12, wood(), 0, 0.12, -0.5 + i * 0.25));
    g.add(box(1.1, 0.12, 0.12, wood(), 0, 0, -0.5), box(1.1, 0.12, 0.12, wood(), 0, 0, 0), box(1.1, 0.12, 0.12, wood(), 0, 0, 0.5));
    return g;
  },
  barrel() {
    return G(
      cyl(0.29, 0.29, 0.88, rustM(), 0, 0, 0, 12),
      cyl(0.3, 0.3, 0.06, darkSteel(), 0, 0.22, 0, 12),
      cyl(0.3, 0.3, 0.06, darkSteel(), 0, 0.6, 0, 12),
    );
  },
  drum() {
    return G(cyl(0.3, 0.3, 0.9, mat('drumBlue', 0x2a4a7a, { rough: 0.55 }), 0, 0, 0, 12));
  },
  boxStack(o) {
    const g = new THREE.Group();
    const R = rng(31 + Math.round((o.x || 0) * 7 + (o.z || 0) * 13));
    const m = mat('cardboard', 0x9a7a52, { rough: 0.9 });
    for (let i = 0; i < 4; i++) {
      const w = 0.4 + R() * 0.3;
      const b = box(w, 0.3 + R() * 0.2, w, m, (R() - 0.5) * 0.3, i * 0.36, (R() - 0.5) * 0.3);
      b.rotation.y = R() * 0.6;
      g.add(b);
    }
    return g;
  },
  trolley() {
    return G(
      box(0.9, 0.05, 0.6, steel(), 0, 0.75),
      box(0.9, 0.05, 0.6, steel(), 0, 0.25),
      box(0.05, 0.9, 0.05, steel(), -0.42, 0, -0.27),
      box(0.05, 0.9, 0.05, steel(), 0.42, 0, -0.27),
      box(0.05, 0.9, 0.05, steel(), -0.42, 0, 0.27),
      box(0.05, 0.9, 0.05, steel(), 0.42, 0, 0.27),
    );
  },

  // ------------------------------------------------------------ living rooms
  sofa() {
    return G(
      box(1.9, 0.42, 0.85, redFabric(), 0, 0.1),
      box(1.9, 0.65, 0.22, redFabric(), 0, 0.52, -0.36),
      box(0.22, 0.55, 0.85, redFabric(), -0.86, 0.52),
      box(0.22, 0.55, 0.85, redFabric(), 0.86, 0.52),
    );
  },
  armchair() {
    return G(
      box(0.85, 0.4, 0.8, fabric(), 0, 0.12),
      box(0.85, 0.6, 0.2, fabric(), 0, 0.52, -0.32),
      box(0.18, 0.5, 0.75, fabric(), -0.36, 0.52),
      box(0.18, 0.5, 0.75, fabric(), 0.36, 0.52),
    );
  },
  bed() {
    return G(
      box(1.35, 0.32, 2.0, wood(), 0, 0.1),
      box(1.3, 0.2, 1.95, mat('mattressM', 0xd8d2c0, { rough: 0.95 }), 0, 0.42),
      box(1.3, 0.7, 0.1, wood(), 0, 0.32, -1.0),
      box(0.5, 0.14, 0.34, mat('pillowM', 0xe8e4d8, { rough: 0.97 }), 0, 0.62, -0.72),
    );
  },
  mattress() {
    const g = G(box(1.3, 0.24, 1.95, mat('mattressDirty', 0xa8a08a, { rough: 0.98 })));
    return g;
  },
  table() {
    const g = G(box(1.4, 0.06, 0.9, wood(), 0, 0.72));
    for (const [x, z] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) {
      g.add(box(0.07, 0.72, 0.07, wood(), x, 0, z));
    }
    return g;
  },
  chair() {
    const g = G(box(0.45, 0.05, 0.45, wood(), 0, 0.45), box(0.45, 0.5, 0.05, wood(), 0, 0.5, -0.2));
    for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      g.add(box(0.045, 0.45, 0.045, wood(), x, 0, z));
    }
    return g;
  },
  diningTable() {
    const g = G(box(2.6, 0.07, 1.1, darkWood(), 0, 0.74));
    for (const x of [-1.1, 1.1]) g.add(box(0.12, 0.74, 0.9, darkWood(), x));
    return g;
  },
  sideTable() {
    return G(box(0.5, 0.04, 0.5, darkWood(), 0, 0.6), box(0.08, 0.6, 0.08, darkWood()));
  },
  tv() {
    return G(
      box(0.7, 0.5, 0.55, plasticBeige(), 0, 0.5),
      box(0.56, 0.4, 0.03, mat('tvGlass', 0x101418, { rough: 0.12 }), 0, 0.56, 0.28),
      box(0.6, 0.5, 0.4, darkWood(), 0, 0),
    );
  },
  radio() {
    return G(
      box(0.4, 0.22, 0.16, plasticBeige(), 0, 0.7),
      box(0.14, 0.14, 0.02, mat('speakerM', 0x3a3a36, { rough: 0.9 }), -0.1, 0.78, 0.09),
      cyl(0.006, 0.006, 0.4, steel(), 0.16, 0.92, 0, 4),
    );
  },
  plant() {
    const g = G(cyl(0.16, 0.12, 0.28, mat('pot', 0x8a5a3a, { rough: 0.8 }), 0, 0, 0, 8));
    const R = rng(9);
    const leaf = mat('leafDead', 0x4a5230, { rough: 0.9 });
    for (let i = 0; i < 7; i++) {
      const l = box(0.05, 0.5, 0.14, leaf, (R() - 0.5) * 0.2, 0.28, (R() - 0.5) * 0.2);
      l.rotation.set((R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.8);
      g.add(l);
    }
    return g;
  },
  pottedPalm() {
    const g = G(cyl(0.24, 0.2, 0.4, mat('potBig', 0x6a5a4a, { rough: 0.85 }), 0, 0, 0, 9));
    const R = rng(19);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const l = box(0.08, 1.1, 0.3, mat('palmLeaf', 0x3a5a34, { rough: 0.9 }), Math.cos(a) * 0.1, 0.4, Math.sin(a) * 0.1);
      l.rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5);
      g.add(l);
    }
    return g;
  },
  rug(o) {
    const g = G(plane(o.w ?? 2, o.d ?? 1.4, mat('rugM', 0x5a2a2e, { rough: 0.98 })));
    g.position.y = 0.012;
    return g;
  },
  picture() {
    return G(
      box(0.6, 0.45, 0.04, darkWood(), 0, 1.5),
      box(0.5, 0.36, 0.01, mat('pictureM', 0x6a6a5e, { rough: 0.7 }), 0, 1.52, 0.025),
    );
  },
  mirrorPanel() {
    return G(
      box(1.2, 2.0, 0.06, painted(), 0, 0.2, -0.04),
      box(1.1, 1.9, 0.02, material('mirror'), 0, 0.25, 0.01),
    );
  },
  sink() {
    return G(
      box(0.5, 0.18, 0.4, mat('porcelain', 0xe4e6e2, { rough: 0.2 }), 0, 0.78),
      box(0.4, 0.5, 0.3, mat('porcelain', 0xe4e6e2), 0, 0.28),
      cyl(0.02, 0.02, 0.18, steel(), 0, 0.96, -0.12, 6),
    );
  },
  toilet() {
    return G(
      box(0.36, 0.4, 0.5, mat('porcelain', 0xe4e6e2, { rough: 0.2 })),
      box(0.4, 0.06, 0.42, mat('porcelain', 0xe4e6e2), 0, 0.4),
      box(0.38, 0.42, 0.16, mat('porcelain', 0xe4e6e2), 0, 0.4, -0.24),
    );
  },
  bathStall() {
    return G(
      box(1.1, 2.0, 0.06, mat('stall', 0x7a8a7a, { rough: 0.6 }), 0, 0.2, -0.5),
      box(0.06, 2.0, 1.0, mat('stall', 0x7a8a7a), -0.55, 0.2),
      box(0.06, 2.0, 1.0, mat('stall', 0x7a8a7a), 0.55, 0.2),
      BUILDERS.toilet({}),
    );
  },
  gurney() {
    const g = G(
      box(0.75, 0.08, 1.95, mat('gurneyPad', 0x9aa8a4, { rough: 0.7 }), 0, 0.78),
      box(0.7, 0.06, 1.9, steel(), 0, 0.7),
    );
    for (const [x, z] of [[-0.32, -0.85], [0.32, -0.85], [-0.32, 0.85], [0.32, 0.85]]) {
      g.add(cyl(0.02, 0.02, 0.68, steel(), x, 0.06, z, 5));
      g.add(sph(0.06, rubber(), x, 0.06, z, 6));
    }
    g.add(BUILDERS.railing({ len: 1.6 }));
    g.children[g.children.length - 1].position.set(0.36, -0.35, 0);
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    return g;
  },
  ivStand() {
    return G(
      cyl(0.16, 0.14, 0.04, steel(), 0, 0, 0, 8),
      cyl(0.018, 0.018, 1.7, steel(), 0, 0.04, 0, 5),
      box(0.12, 0.22, 0.06, mat('ivBag', 0xd8e8d8, { rough: 0.3, opacity: 0.7 }), 0.08, 1.5),
    );
  },
  wheelchair() {
    const g = G(
      box(0.5, 0.06, 0.5, fabric(), 0, 0.5),
      box(0.5, 0.55, 0.06, fabric(), 0, 0.56, -0.24),
    );
    for (const x of [-0.3, 0.3]) {
      const w = cyl(0.3, 0.3, 0.04, rubber(), x, 0.3, 0, 12);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
    return g;
  },
  partyTable() {
    const g = G(
      box(1.6, 0.06, 1.0, mat('tablecloth', 0xf0e0e8, { rough: 0.95 }), 0, 0.74),
      box(1.66, 0.35, 1.06, mat('tablecloth', 0xf0e0e8), 0, 0.4),
    );
    const R = rng(77);
    for (let i = 0; i < 6; i++) {
      g.add(cyl(0.04, 0.04, 0.12, simple(new THREE.Color().setHSL(R(), 0.7, 0.6).getHex(), { rough: 0.5 }), (R() - 0.5) * 1.2, 0.8, (R() - 0.5) * 0.7, 7));
    }
    return g;
  },
  balloonCluster() {
    const g = new THREE.Group();
    const R = rng(101 + Math.round((o0(g) || 0)));
    for (let i = 0; i < 5; i++) {
      const h = 1.3 + R() * 0.9;
      const c = new THREE.Color().setHSL(R(), 0.75, 0.6).getHex();
      g.add(sph(0.16, simple(c, { rough: 0.35 }), (R() - 0.5) * 0.5, h, (R() - 0.5) * 0.5, 8));
      const s = cyl(0.004, 0.004, h - 0.2, mat('string', 0xe8e8e0, { rough: 0.9 }), (R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4, 3);
      g.add(s);
    }
    return g;
  },
  banner(o) {
    const g = G(box(o.w ?? 3, 0.7, 0.04, mat('bannerM', 0xf0d040, { rough: 0.85 }), 0, 2.0));
    g.add(box((o.w ?? 3) * 0.8, 0.16, 0.01, mat('bannerText', 0x8a2050, { rough: 0.8 }), 0, 2.3, 0.03));
    return g;
  },
  cake() {
    return G(
      cyl(0.34, 0.36, 0.22, mat('icing', 0xf4e8e8, { rough: 0.7 }), 0, 0.74, 0, 14),
      cyl(0.22, 0.24, 0.18, mat('icing', 0xf4e8e8), 0, 0.96, 0, 14),
      cyl(0.012, 0.012, 0.1, mat('candle', 0xe86a8a, { rough: 0.5 }), 0, 1.14, 0, 5),
      sph(0.022, glowWhite(), 0, 1.26, 0, 5),
    );
  },
  streamers(o) {
    const g = new THREE.Group();
    const R = rng(131);
    for (let i = 0; i < 7; i++) {
      const h = 0.4 + R() * 1.1;
      const s = box(0.06, h, 0.01, simple(new THREE.Color().setHSL(R(), 0.7, 0.62).getHex(), { rough: 0.8 }), (R() - 0.5) * 1.6, (o.height ?? 2.6) - h, (R() - 0.5) * 0.4);
      s.rotation.z = (R() - 0.5) * 0.5;
      g.add(s);
    }
    return g;
  },
  partyHatPile() {
    const g = new THREE.Group();
    const R = rng(151);
    for (let i = 0; i < 5; i++) {
      const c = cyl(0, 0.09, 0.2, simple(new THREE.Color().setHSL(R(), 0.8, 0.6).getHex(), { rough: 0.6 }), (R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5, 7);
      c.rotation.set(R() * 1.4, R() * 3, R() * 1.4);
      g.add(c);
    }
    return g;
  },

  // ------------------------------------------------------------ water
  poolLadder() {
    const g = new THREE.Group();
    const m = mat('chrome', 0xc8d0d4, { rough: 0.15, metal: 0.9 });
    for (const x of [-0.22, 0.22]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 5, 8, Math.PI), m);
      rail.position.set(x, 0.7, 0.22);
      rail.rotation.y = Math.PI / 2;
      g.add(rail);
      g.add(cyl(0.025, 0.025, 1.4, m, x, -0.7, 0, 6));
    }
    for (let i = 0; i < 3; i++) {
      const r = cyl(0.02, 0.02, 0.44, m, 0, -0.2 - i * 0.4, 0.06, 5);
      r.rotation.z = Math.PI / 2;
      g.add(r);
    }
    return g;
  },
  divingBoard() {
    return G(
      box(0.5, 0.06, 2.6, mat('boardM', 0xe8e4d4, { rough: 0.7 }), 0, 0.8, 0.9),
      box(0.3, 0.8, 0.3, mat('chrome', 0xc8d0d4), 0, 0, -0.2),
    );
  },
  lounger() {
    const g = new THREE.Group();
    const m = mat('loungerM', 0xd8dcd4, { rough: 0.7 });
    const seat = box(0.62, 0.06, 1.5, m, 0, 0.34);
    const backM = box(0.62, 0.06, 0.7, m, 0, 0.5, -0.95);
    backM.rotation.x = 0.6;
    g.add(seat, backM);
    for (const [x, z] of [[-0.26, -0.6], [0.26, -0.6], [-0.26, 0.6], [0.26, 0.6]]) g.add(cyl(0.02, 0.02, 0.34, steel(), x, 0, z, 5));
    return g;
  },
  lifebuoy() {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 6, 14), mat('buoy', 0xd84a2a, { rough: 0.7 }));
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.09;
    g.add(t);
    return g;
  },
  poolNoodle() {
    const g = G(cyl(0.05, 0.05, 1.4, mat('noodle', 0x40c8e0, { rough: 0.8 }), 0, 0.05, 0, 7));
    g.children[0].rotation.z = Math.PI / 2;
    return g;
  },
  drainGrate(o) {
    const s = o.scale ?? 1;
    const g = G(plane(0.9 * s, 0.9 * s, material('grate')));
    g.position.y = 0.015;
    return g;
  },
  fountain() {
    const g = G(
      cyl(1.3, 1.4, 0.4, mat('fountainM', 0xd0d4cc, { rough: 0.3 }), 0, 0, 0, 16),
      cyl(0.3, 0.4, 0.9, mat('fountainM', 0xd0d4cc), 0, 0.4, 0, 12),
      cyl(0.7, 0.1, 0.1, mat('fountainM', 0xd0d4cc), 0, 1.3, 0, 14),
    );
    return g;
  },

  // ------------------------------------------------------------ outside-ish
  car(o) {
    const g = new THREE.Group();
    const body = simple(o.color ?? 0x6a7480, { rough: 0.35, metal: 0.5 });
    g.add(box(1.8, 0.55, 4.3, body, 0, 0.42));
    g.add(box(1.66, 0.5, 2.1, body, 0, 0.97, -0.2));
    g.add(box(1.6, 0.42, 1.9, mat('carGlass', 0x2a3238, { rough: 0.1, metal: 0.3, opacity: 0.6 }), 0, 1.0, -0.2));
    for (const [x, z] of [[-0.85, -1.5], [0.85, -1.5], [-0.85, 1.5], [0.85, 1.5]]) {
      const w = cyl(0.33, 0.33, 0.22, rubber(), x, 0.33, z, 10);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
    g.add(box(0.4, 0.16, 0.06, mat('headlight', 0xd8d8c8, { rough: 0.2 }), -0.55, 0.6, 2.16));
    g.add(box(0.4, 0.16, 0.06, mat('headlight', 0xd8d8c8), 0.55, 0.6, 2.16));
    return g;
  },
  carWreck(o) {
    const g = BUILDERS.car({ ...o, color: 0x4a4640 });
    g.rotation.z = 0.1;
    g.children[2].visible = false;
    g.add(BUILDERS.rubblePile(o));
    return g;
  },
  dumpster() {
    return G(
      box(1.8, 1.2, 1.1, mat('dumpsterM', 0x2a5a3a, { rough: 0.7, metal: 0.3 })),
      box(1.86, 0.08, 1.16, mat('dumpsterM', 0x2a5a3a), 0, 1.2),
    );
  },
  trafficCone() {
    return G(
      box(0.34, 0.04, 0.34, mat('coneM', 0xe8621a, { rough: 0.7 })),
      cyl(0.04, 0.16, 0.6, mat('coneM', 0xe8621a), 0, 0.04, 0, 8),
    );
  },
  shoppingCart() {
    const g = G(
      box(0.6, 0.5, 0.9, mat('cartM', 0xb8bcc0, { rough: 0.4, metal: 0.6, opacity: 0.85 }), 0, 0.45),
      box(0.55, 0.03, 0.85, steel(), 0, 0.42),
    );
    for (const [x, z] of [[-0.24, -0.36], [0.24, -0.36], [-0.24, 0.36], [0.24, 0.36]]) g.add(sph(0.07, rubber(), x, 0.07, z, 6));
    return g;
  },
  houseFacade(o) {
    const w = o.w ?? 8, h = o.h ?? 5.5, d = o.d ?? 8;
    const g = new THREE.Group();
    g.add(box(w, h, d, material('siding')));
    // roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 2.2, 4), mat('shingle', 0x3a3632, { rough: 0.9 }));
    roof.position.y = h + 1.1;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    // door and windows, dark
    g.add(box(1.1, 2.1, 0.1, darkWood(), 0, 0, d / 2 + 0.02));
    const dark = mat('darkWindow', 0x0e1014, { rough: 0.2 });
    for (const [x, y] of [[-w * 0.28, 1.2], [w * 0.28, 1.2], [-w * 0.28, h * 0.62], [w * 0.28, h * 0.62]]) {
      g.add(box(1.3, 1.1, 0.08, dark, x, y, d / 2 + 0.02));
    }
    return g;
  },
  fencePanel(o) {
    const len = o.len ?? 2.4;
    const g = new THREE.Group();
    for (let i = 0; i < Math.floor(len / 0.16); i++) g.add(box(0.12, 1.5, 0.04, wood(), -len / 2 + i * 0.16));
    g.add(box(len, 0.08, 0.06, wood(), 0, 1.1), box(len, 0.08, 0.06, wood(), 0, 0.3));
    return g;
  },
  deadTree() {
    const g = G(cyl(0.22, 0.16, 3.4, mat('bark', 0x3a2e22, { rough: 0.95 }), 0, 0, 0, 7));
    const R = rng(211);
    for (let i = 0; i < 6; i++) {
      const b = cyl(0.06, 0.02, 1.4, mat('bark', 0x3a2e22), 0, 2.2 + R() * 1.0, 0, 5);
      b.rotation.set(R() * 0.9, R() * 6, R() * 0.9);
      g.add(b);
    }
    return g;
  },
  wheatPatch() {
    const g = new THREE.Group();
    const R = rng(233);
    const m = material('wheat');
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.9), m);
      p.position.set((R() - 0.5) * 0.6, 0.95, (R() - 0.5) * 0.6);
      p.rotation.y = R() * Math.PI;
      p.material.side = THREE.DoubleSide;
      g.add(p);
    }
    return g;
  },
  boulder(o) {
    const R = rng(251 + Math.round((o.x || 0) * 7));
    const geo = new THREE.IcosahedronGeometry(0.6 + R() * 0.5, 0);
    const m = new THREE.Mesh(geo, material('rock'));
    m.position.y = 0.4;
    m.rotation.set(R() * 3, R() * 3, R() * 3);
    return G(m);
  },
  stalagmite(o) {
    const h = o.height ?? 1.4;
    const g = G(cyl(0.02, 0.3, h, material('rock'), 0, 0, 0, 7));
    if (o.down) { g.children[0].rotation.x = Math.PI; g.children[0].position.y = -h / 2; }
    return g;
  },
  snowDrift(o) {
    const R = rng(271 + Math.round((o.x || 0) * 11));
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = sph(0.7 + R() * 0.9, material('snow'), (R() - 0.5) * 1.4, -0.3 + R() * 0.2, (R() - 0.5) * 1.4, 8);
      s.scale.y = 0.42;
      g.add(s);
    }
    return g;
  },
  radioTower() {
    const g = new THREE.Group();
    const m = darkSteel();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const leg = cyl(0.05, 0.05, 14, m, Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7, 4);
      leg.rotation.x = Math.cos(a) * 0.04;
      leg.rotation.z = Math.sin(a) * 0.04;
      g.add(leg);
    }
    for (let y = 1; y < 14; y += 1.6) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.02, 3, 4), m);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    g.add(sph(0.1, glowRed(), 0, 14.2, 0, 6));
    return g;
  },
  trainCar() {
    const g = G(
      box(3.0, 3.2, 14, mat('trainBody', 0x3a4248, { rough: 0.6, metal: 0.4 }), 0, 0.9),
      box(3.1, 0.4, 14.2, darkSteel(), 0, 0.5),
    );
    for (let i = -5; i <= 5; i += 2) {
      g.add(box(0.05, 1.0, 1.3, mat('trainWindow', 0x14181c, { rough: 0.15 }), 1.5, 2.0, i));
      g.add(box(0.05, 1.0, 1.3, mat('trainWindow', 0x14181c), -1.5, 2.0, i));
    }
    for (const z of [-5, -3.6, 3.6, 5]) {
      const w = cyl(0.45, 0.45, 0.2, darkSteel(), 1.2, 0.05, z, 10);
      w.rotation.z = Math.PI / 2;
      const w2 = w.clone();
      w2.position.x = -1.2;
      g.add(w, w2);
    }
    return g;
  },
  busShelter() {
    return G(
      box(3.0, 0.1, 1.4, glassMat(), 0, 2.4),
      box(3.0, 2.4, 0.06, glassMat(), 0, 0, -0.7),
      box(0.08, 2.4, 1.4, steel(), -1.5),
      box(0.08, 2.4, 1.4, steel(), 1.5),
      BUILDERS.chair({}),
    );
  },
  phoneBooth() {
    const g = G(
      box(1.0, 2.3, 1.0, mat('boothM', 0x8a1a1a, { rough: 0.6 })),
      box(0.88, 1.9, 0.88, glassMat(), 0, 0.2),
      box(1.06, 0.14, 1.06, mat('boothM', 0x8a1a1a), 0, 2.3),
    );
    g.add(BUILDERS.payphone({}));
    return g;
  },
  campLight() {
    return G(
      cyl(0.12, 0.14, 0.08, darkSteel()),
      cyl(0.1, 0.1, 0.22, glowWhite(), 0, 0.08, 0, 8),
      cyl(0.12, 0.06, 0.08, darkSteel(), 0, 0.3),
    );
  },
  tent() {
    const g = new THREE.Group();
    const m = mat('tentM', 0x3a5a4a, { rough: 0.9 });
    const a = box(2.2, 1.6, 0.06, m, 0, 0, -0.5);
    a.rotation.x = -0.6;
    const b = box(2.2, 1.6, 0.06, m, 0, 0, 0.5);
    b.rotation.x = 0.6;
    g.add(a, b);
    return g;
  },
  sleepingBag() {
    const g = G(box(0.7, 0.22, 1.9, mat('bagM', 0x4a5a6a, { rough: 0.95 })));
    return g;
  },
  signpost(o) {
    const g = G(cyl(0.05, 0.05, 2.4, steel(), 0, 0, 0, 6));
    g.add(box(1.1, 0.3, 0.04, mat('signGreen', 0x2a5a3a, { rough: 0.7 }), 0, 2.0));
    return g;
  },

  // ------------------------------------------------------------ wrongness
  fleshGrowth(o) {
    const R = rng(311 + Math.round((o.x || 0) * 13));
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const s = sph(0.2 + R() * 0.35, flesh(), (R() - 0.5) * 1.2, 0.2 + R() * 0.8, (R() - 0.5) * 1.2, 7);
      s.scale.set(1, 0.7 + R() * 0.6, 1);
      g.add(s);
    }
    return g;
  },
  bacteriaMat(o) {
    const R = rng(331 + Math.round((o.x || 0) * 17));
    const g = new THREE.Group();
    const m = mat('bacteriaM', 0x5a6a2a, { rough: 0.85, emissive: 0x141a06, emissiveIntensity: 0.6 });
    for (let i = 0; i < 5; i++) {
      const d = sph(0.4 + R() * 0.6, m, (R() - 0.5) * 1.6, 0.02, (R() - 0.5) * 1.6, 8);
      d.scale.y = 0.12 + R() * 0.1;
      g.add(d);
    }
    return g;
  },
  cocoon() {
    const g = G(sph(0.35, mat('cocoonM', 0xb8b09a, { rough: 0.9 }), 0, 0.9, 0, 8));
    g.children[0].scale.set(0.7, 1.7, 0.7);
    g.add(cyl(0.02, 0.02, 0.6, mat('cocoonM', 0xb8b09a), 0, 1.6, 0, 4));
    return g;
  },
  bodyBag() {
    const g = G(box(0.7, 0.28, 1.9, mat('bodyBagM', 0x24262a, { rough: 0.7 })));
    g.add(box(0.72, 0.02, 0.1, mat('zipper', 0x6a6e72, { rough: 0.4, metal: 0.6 }), 0, 0.28, 0));
    return g;
  },
  mannequinProp() {
    const m = mat('mannequinM', 0xd8cfc0, { rough: 0.55 });
    return G(
      cyl(0.16, 0.12, 0.9, m, 0, 0, 0, 8),
      box(0.34, 0.6, 0.2, m, 0, 0.9),
      sph(0.12, m, 0, 1.62, 0, 8),
      box(0.1, 0.55, 0.1, m, -0.24, 0.95),
      box(0.1, 0.55, 0.1, m, 0.24, 0.95),
    );
  },
  shrine(o) {
    const g = new THREE.Group();
    const R = rng(353);
    g.add(box(0.9, 0.3, 0.6, concreteM()));
    for (let i = 0; i < 5; i++) {
      g.add(cyl(0.02, 0.02, 0.1 + R() * 0.1, mat('candleWax', 0xe8e0c8, { rough: 0.6 }), (R() - 0.5) * 0.6, 0.3, (R() - 0.5) * 0.4, 5));
      g.add(sph(0.02, glowWhite(), (R() - 0.5) * 0.6, 0.44, (R() - 0.5) * 0.4, 4));
    }
    return g;
  },
  tapePile(o) {
    const R = rng(373 + Math.round((o.x || 0) * 7));
    const g = new THREE.Group();
    const m = mat('tapeM', 0x1e1e20, { rough: 0.6 });
    for (let i = 0; i < 4; i++) {
      const t = box(0.19, 0.03, 0.11, m, (R() - 0.5) * 0.3, i * 0.035, (R() - 0.5) * 0.3);
      t.rotation.y = R() * 3;
      g.add(t);
      g.add(box(0.08, 0.01, 0.05, paper(), t.position.x, i * 0.035 + 0.02, t.position.z));
    }
    return g;
  },
  almondCrate() {
    const g = BUILDERS.crate({ size: 0.9 });
    const R = rng(391);
    for (let i = 0; i < 4; i++) {
      g.add(cyl(0.045, 0.045, 0.22, mat('almondCarton', 0xe8e4d0, { rough: 0.7 }), (R() - 0.5) * 0.5, 0.77, (R() - 0.5) * 0.5, 6));
    }
    return g;
  },
  graffiti(o) {
    const w = o.big ? 2.2 : 1.2;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    const R = rng(401 + Math.round((o.x || 0) * 13 + (o.z || 0) * 7));
    const words = o.text ? [o.text] : [
      'GO BACK', 'NOT A DOOR', 'IT HEARS YOU', 'COUNT THE LIGHTS', 'I WAS HERE 6 TIMES',
      'DO NOT SLEEP', 'THE HUM IS SAFE', 'LEFT HAND ON THE WALL', 'NO EXIT THIS WAY',
      'DAY 412', 'STILL LOOKING', 'TURN AROUND', 'ALMOND WATER →', 'DON\'T RUN',
    ];
    const t = words[Math.floor(R() * words.length)];
    ctx.font = `bold ${28 + R() * 18}px "Courier New", monospace`;
    ctx.fillStyle = ['#c8342a', '#1e1e1e', '#2a5a8a', '#7a5a1a'][Math.floor(R() * 4)];
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(128, 64);
    ctx.rotate((R() - 0.5) * 0.24);
    ctx.fillText(t, 0, 0);
    ctx.restore();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 2),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }),
    );
    m.position.y = 1.5;
    m.position.z = 0.02;
    return G(m);
  },
  bloodTrail(o) {
    const g = G(plane(1.4, 1.4, mat('trailM', 0x3a1a16, { rough: 0.85, opacity: 0.75 })));
    g.position.y = 0.014;
    return g;
  },
  clawMarks() {
    const g = new THREE.Group();
    const m = mat('clawM', 0x2a2018, { rough: 0.9 });
    for (let i = 0; i < 4; i++) {
      const s = box(0.03, 0.7, 0.01, m, -0.12 + i * 0.08, 1.1, 0.02);
      s.rotation.z = 0.16;
      g.add(s);
    }
    return g;
  },
  noteSheet() {
    const g = G(plane(0.3, 0.42, paper(), -Math.PI / 2));
    g.position.y = 0.02;
    g.rotation.z = 0.3;
    return g;
  },
  // Chalk on a hard floor: a stick of it dragged fast by somebody who was not stopping
  // to do a neat job. Every stroke is laid down as a scatter of dust along its path
  // rather than a line — heavier where the stick bit, gone where it skipped, with the
  // grit of the floor showing through and a smudge where a shoe went over it.
  chalkArrow(o) {
    // Six marks, drawn once and shared. A floor carries a couple of hundred of these and
    // a canvas texture each would be a couple of hundred texture binds and ten megabytes
    // of uploads — which is exactly how the poolrooms stopped being able to draw a frame.
    const pick = Math.abs(Math.floor((o.px ?? 0) * 3.1 + (o.pz ?? 0) * 7.7)) % 6;
    CHALK[pick] = CHALK[pick] || chalkMark(pick);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), CHALK[pick]);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    return G(m);
  },

  // ---------------------------------------------------------------- the stall
  // Somebody set up a trestle table against the panelling of the lift car and put three
  // things on it. This is the only commerce in the building.
  shopStall(o = {}) {
    const len = o.len ?? 3.4;
    const top = mat('stallTop', 0x6a5334, { rough: 0.7 });
    const cloth = mat('stallCloth', 0x5a2a2e, { rough: 0.95 });
    const g = G(
      box(0.78, 0.06, len, top, 0, 0.9, 0),                       // table top
      box(0.7, 0.5, 0.04, cloth, 0, 0.4, len / 2 - 0.03),          // cloth over each end
      box(0.7, 0.5, 0.04, cloth, 0, 0.4, -len / 2 + 0.03),
      box(0.06, 0.9, 0.06, darkSteel(), -0.3, 0, len / 2 - 0.2),   // legs
      box(0.06, 0.9, 0.06, darkSteel(), 0.3, 0, len / 2 - 0.2),
      box(0.06, 0.9, 0.06, darkSteel(), -0.3, 0, -len / 2 + 0.2),
      box(0.06, 0.9, 0.06, darkSteel(), 0.3, 0, -len / 2 + 0.2),
    );
    // a strip light clipped to the front edge, pointing at the goods
    g.add(box(0.05, 0.05, len - 0.4, mat('stallStrip', 0xfff0c8, {
      emissive: 0xffd890, emissiveIntensity: 1.5, rough: 0.4,
    }), -0.34, 0.94, 0));
    return g;
  },

  // What is actually for sale, built to look like the thing rather than an icon: a boot,
  // a lens, a board, a roll of tape. `key` picks which.
  shopGood(o = {}) {
    const g = new THREE.Group();
    const card = mat('goodCard', 0xb8ae94, { rough: 0.9 });
    const glassy = mat('goodGlass', 0xa8c8d8, { rough: 0.1, metal: 0.3 });
    switch (o.key) {
      case 'shoes': {                                   // a pair of trainers, laces knotted
        for (const x of [-0.11, 0.11]) {
          g.add(box(0.11, 0.09, 0.28, mat('goodShoe', 0xd8d2c0, { rough: 0.8 }), x, 0.04, 0));
          g.add(box(0.1, 0.07, 0.1, rubber(), x, 0.11, -0.08));
        }
        break;
      }
      case 'lens': {                                    // a screw-on wide-angle in its cap
        g.add(cyl(0.09, 0.11, 0.1, darkSteel(), 0, 0, 0, 12));
        g.add(cyl(0.085, 0.085, 0.02, glassy, 0, 0.1, 0, 12));
        break;
      }
      case 'ccd': {                                     // a camera board in an antistatic bag
        g.add(box(0.22, 0.02, 0.16, mat('goodBoard', 0x1f4a2a, { rough: 0.6 }), 0, 0.01, 0));
        g.add(box(0.24, 0.005, 0.18, mat('goodBag', 0x8a94a0, { rough: 0.3, opacity: 0.5 }), 0, 0.03, 0));
        break;
      }
      case 'soles': {                                   // sorbothane pads, cut to shape
        for (let i = 0; i < 3; i++) g.add(box(0.16, 0.012, 0.1, mat('goodPad', 0x3a3a44, { rough: 0.9 }), 0, 0.006 + i * 0.014, i * 0.01));
        break;
      }
      case 'tracker': {                                 // a field-strength meter
        g.add(box(0.14, 0.16, 0.06, plasticGrey(), 0, 0.08, 0));
        g.add(box(0.1, 0.06, 0.01, mat('goodDial', 0xd8e0c0, { emissive: 0x60ff90, emissiveIntensity: 0.6, rough: 0.5 }), 0, 0.12, 0.035));
        g.add(cyl(0.006, 0.006, 0.3, steel(), 0.05, 0.16, 0, 6));
        break;
      }
      case 'cells': {                                   // four D-cells in the shrink-wrap
        for (let i = 0; i < 4; i++) g.add(cyl(0.017, 0.017, 0.06, mat('goodCell', 0x2a2a30, { rough: 0.5, metal: 0.4 }), -0.06 + i * 0.04, 0.03, 0, 8));
        break;
      }
      case 'lungs': {                                   // a spirometer with a best on it
        g.add(cyl(0.05, 0.05, 0.2, glassy, 0, 0.1, 0, 10));
        g.add(cyl(0.02, 0.02, 0.09, rubber(), 0.07, 0.05, 0, 8));
        break;
      }
      case 'quickhands': {                              // fingerless gloves, one bitten
        for (const x of [-0.08, 0.08]) g.add(box(0.11, 0.04, 0.16, mat('goodGlove', 0x4a3a2a, { rough: 0.9 }), x, 0.02, 0));
        break;
      }
      case 'chalk': {                                   // a tin of chalk stubs
        g.add(cyl(0.08, 0.08, 0.05, mat('goodTin', 0x9aa0a6, { rough: 0.4, metal: 0.7 }), 0, 0.025, 0, 12));
        for (let i = 0; i < 4; i++) g.add(cyl(0.012, 0.012, 0.06, mat('goodChalk', 0xefeade, { rough: 1 }), -0.03 + i * 0.02, 0.055, 0, 6));
        break;
      }
      case 'gaffer': {                                  // a roll of two-inch tape
        const r = cyl(0.07, 0.07, 0.05, mat('goodTape', 0x23232a, { rough: 0.85 }), 0, 0.035, 0, 14);
        r.rotation.x = Math.PI / 2;
        g.add(r);
        break;
      }
      case 'adrenaline': {                              // two auto-injectors in a box
        g.add(box(0.2, 0.05, 0.12, card, 0, 0.025, 0));
        for (const x of [-0.04, 0.04]) g.add(cyl(0.014, 0.014, 0.14, mat('goodPen', 0xd8c860, { rough: 0.5 }), x, 0.06, 0, 8));
        break;
      }
      default: {                                        // a photocopied floor plan
        g.add(box(0.26, 0.004, 0.2, mat('goodPaper', 0xd8d2bc, { rough: 0.95 }), 0, 0.002, 0));
        g.add(box(0.08, 0.005, 0.06, mat('goodInk', 0xc03028, { rough: 0.9 }), 0.05, 0.006, -0.03));
        break;
      }
    }
    g.position.y = o.y ?? 0;
    return g;
  },

  // The price on a bit of card, biro on both sides, propped against the goods. SOLD OUT
  // gets struck through, which is the only typography in the game.
  shopTag(o = {}) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ded5b8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = 'rgba(120,110,80,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = '#23324a';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.textAlign = 'center';
    const name = String(o.text ?? '').slice(0, 15);
    ctx.fillText(name, 128, 52);
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillStyle = o.sold ? '#7a2a24' : '#1d3a24';
    ctx.fillText(o.sold ? 'SOLD OUT' : `${o.price ?? '?'} ft`, 128, 100);
    if (o.sold) {
      ctx.strokeStyle = '#7a2a24';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(30, 92); ctx.lineTo(226, 86); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.15),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }),
    );
    m.rotation.x = -0.5;
    const g = G(m, box(0.02, 0.1, 0.02, mat('tagWire', 0x8a8a90, { rough: 0.5, metal: 0.6 }), 0, -0.08, 0.02));
    g.position.y = o.y ?? 0.95;
    return g;
  },

  // The car's own button panel: one per floor of the descent, the next one lit.
  liftPanel(o = {}) {
    const g = new THREE.Group();
    const plate = mat('panelPlate', 0x8e959c, { rough: 0.35, metal: 0.85 });
    g.add(box(0.05, 0.9, 0.34, plate, 0, 0, 0));
    const lit = mat('panelBtnLit', 0xffd070, { emissive: 0xff9820, emissiveIntensity: 2.2, rough: 0.4 });
    const dead = mat('panelBtnDead', 0x54585e, { rough: 0.6 });
    const rows = o.floors ?? 10;
    const on = o.at ?? 1;
    for (let i = 0; i < rows; i++) {
      const b = cyl(0.024, 0.024, 0.02, i === on ? lit : dead, 0.035, 0, 0, 8);
      b.rotation.z = Math.PI / 2;
      b.position.set(0.035, 0.82 - Math.floor(i / 2) * 0.15, (i % 2 ? 0.07 : -0.07));
      g.add(b);
    }
    // and the big one you actually press
    const go = cyl(0.055, 0.055, 0.03, lit, 0.04, 0, 0, 12);
    go.rotation.z = Math.PI / 2;
    go.position.set(0.04, 0.12, 0);
    g.add(go);
    g.userData.go = go;
    g.position.y = o.y ?? 0;
    return g;
  },

  // The inspection certificate nobody has signed since before you were born.
  notice() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 160;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#d8d2bc';
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = 'rgba(40,40,50,0.75)';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INSPECTION', 64, 26);
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('THIS CAR', 64, 46);
    ctx.textAlign = 'left';
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `rgba(60,60,70,${0.5 - i * 0.05})`;
      ctx.fillRect(14, 60 + i * 12, 90 - i * 6, 3);
    }
    ctx.strokeStyle = 'rgba(120,30,30,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(90, 128, 22, 0, Math.PI * 2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.3),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
    );
    m.position.set(0, 1.45, 0.03);
    return G(m);
  },
  skull() {
    const g = G(sph(0.11, mat('boneM', 0xd8d0b8, { rough: 0.7 }), 0, 0.11, 0, 8));
    g.children[0].scale.set(1, 1.15, 1.25);
    g.add(box(0.03, 0.03, 0.02, rubber(), -0.04, 0.13, 0.1), box(0.03, 0.03, 0.02, rubber(), 0.04, 0.13, 0.1));
    return g;
  },
};

// balloonCluster needs a stable per-instance seed; keep it simple and cheap
function o0() { return 0; }

// brushed metal for lift doors
function brushed() { return mat('brushed', 0xa8adb2, { rough: 0.3, metal: 0.85 }); }

// ------------------------------------------------------------------ build one
// Instantiates a prop record. `atY` is the floor height of the cell it sits on;
// props tagged userData.hang are positioned from the ceiling instead.
export function buildProp(rec, atY = 0, ceilY = 3) {
  const b = BUILDERS[rec.name];
  if (!b) throw new Error(`no prop builder for "${rec.name}"`);
  const g = b(rec);
  const y = rec.y !== null && rec.y !== undefined ? rec.y : (g.userData.hang ? ceilY : atY);
  g.position.set(rec.px, y, rec.pz);
  g.rotation.y += rec.rot || 0;
  if (rec.scale && rec.scale !== 1) g.scale.multiplyScalar(rec.scale);
  g.matrixAutoUpdate = false;
  g.updateMatrix();
  return g;
}

export const PROP_NAMES = Object.keys(BUILDERS);
