// Assembles a complete car: painted hull + fascias + glass cabin + interior,
// wheels (tires, rims, discs, calipers), mirrors, spoiler, exhausts, pop-ups,
// underglow, contact shadow. Returns a handle the race code animates.
import * as THREE from 'three';
import { shapeOf, buildLowerBody, buildCabin, projectedPatch } from './hull.js';
import { paintLight } from './lights.js';
import { paintBody, paintCap, paintCabin, tireCanvas, exhaustLayout, FINISHES } from './paint.js';
import { mergeGeos, place } from './geom.js';
import { applyLook } from './kits.js';

const texCache = new Map();

function canvasTex(cnv, srgb) {
  const t = new THREE.CanvasTexture(cnv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Physical paint material driven by an ORM canvas + optional light channels. */
function paintMaterial(layers, lights, opts = {}) {
  const map = canvasTex(layers.A, true);
  const orm = canvasTex(layers.O, false);
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    roughnessMap: orm, metalnessMap: orm, clearcoatMap: orm,
    roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: opts.env ?? 1.0,
    transparent: !!opts.transparent,
    alphaTest: opts.alphaTest || 0,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  if (opts.iridescence) {
    mat.iridescence = opts.iridescence;
    mat.iridescenceIOR = 1.6;
    mat.iridescenceThicknessRange = [250, 600];
  }
  if (layers.E) {
    mat.emissiveMap = canvasTex(layers.E, false);
    mat.emissive = new THREE.Color(1, 1, 1);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uHead = lights.head;
      sh.uniforms.uTail = lights.tail;
      sh.uniforms.uBrake = lights.brake;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uHead;\nuniform float uTail;\nuniform float uBrake;')
        .replace('#include <emissivemap_fragment>', `
#ifdef USE_EMISSIVEMAP
  vec4 emi = texture2D( emissiveMap, vEmissiveMapUv );
  totalEmissiveRadiance = emi.r * vec3(1.0, 0.92, 0.78) * uHead * 8.0
    + emi.g * vec3(1.0, 0.025, 0.015) * uTail * 1.7
    + emi.b * vec3(1.0, 0.02, 0.01) * uBrake * 5.5;
#endif`);
    };
    mat.customProgramCacheKey = () => 'mf-car-lights';
  }
  return mat;
}

function solidPaint(look, opts = {}) {
  const fin = FINISHES[look.finish] || FINISHES.metallic;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(look.paint),
    metalness: fin.metal, roughness: fin.rough, clearcoat: fin.coat, clearcoatRoughness: 0.05,
    envMapIntensity: opts.env ?? 1.0,
  });
}

// ------------------------------------------------------------------ wheels

function flipGeo(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

function tireGeometry(R, rr, tw) {
  const prof = [
    [rr + 0.004, -tw * 0.43], [rr + (R - rr) * 0.3, -tw * 0.5], [R - 0.03, -tw * 0.5],
    [R - 0.008, -tw * 0.45], [R, -tw * 0.32], [R, tw * 0.32], [R - 0.008, tw * 0.45],
    [R - 0.03, tw * 0.5], [rr + (R - rr) * 0.3, tw * 0.5], [rr + 0.004, tw * 0.43],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 36);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** Spoke from radius r0 (hub) to r1 (rim): widths w0/w1, angular offset tw (twist), thickness t. */
function spoke(r0, r1, w0, w1, t, twist = 0, curve = 0) {
  const s = new THREE.Shape();
  const n = 6;
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const r = r0 + (r1 - r0) * f;
    const w = (w0 + (w1 - w0) * f) / 2;
    const off = twist * f + curve * Math.sin(Math.PI * f);
    left.push([off - w, r]);
    right.push([off + w, r]);
  }
  s.moveTo(left[0][0], left[0][1]);
  for (const p of left.slice(1)) s.lineTo(p[0], p[1]);
  for (const p of right.reverse()) s.lineTo(p[0], p[1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 4 });
  g.rotateY(Math.PI / 2); // extrusion → +x, radial → y, tangential → -z
  return g;
}

const RIM_STYLES = {
  stock: { n: 7, w0: 0.05, w1: 0.045, concave: 0.012, lip: 0.9 },
  five: { n: 5, w0: 0.08, w1: 0.07, concave: 0.035, lip: 0.92 },
  six: { n: 6, w0: 0.065, w1: 0.05, concave: 0.05, lip: 0.9, ribs: true },
  split: { n: 5, pair: 0.12, w0: 0.03, w1: 0.028, concave: 0.035, lip: 0.92 },
  mesh: { n: 10, cross: 0.32, w0: 0.02, w1: 0.018, concave: 0.025, lip: 0.86 },
  multi: { n: 16, w0: 0.02, w1: 0.016, concave: 0.02, lip: 0.78 },
  dish: { n: 4, w0: 0.09, w1: 0.075, concave: 0.075, lip: 0.72 },
  turbine: { n: 12, w0: 0.03, w1: 0.03, concave: 0.025, lip: 0.9, curve: 0.05 },
  star: { n: 5, pair: 0.22, w0: 0.028, w1: 0.03, concave: 0.04, lip: 0.92 },
};
export const RIM_NAMES = Object.keys(RIM_STYLES);

const rimGeoCache = new Map();
function rimGeometry(style, rr, tw) {
  const key = `${style}|${rr.toFixed(3)}|${tw.toFixed(3)}`;
  if (rimGeoCache.has(key)) return rimGeoCache.get(key);
  const st = RIM_STYLES[style] || RIM_STYLES.five;
  const faceX = tw * 0.36;
  const hubX = faceX - st.concave;
  const rh = rr * 0.24;
  const r1 = rr * st.lip * 0.99;
  const parts = [];
  // lip (flat ring facing +x) + outer band
  const lip = new THREE.RingGeometry(rr * st.lip * 0.98, rr * 1.01, 40, 1);
  lip.rotateY(Math.PI / 2);
  place(lip, faceX + 0.004, 0, 0);
  parts.push(lip);
  const band = new THREE.CylinderGeometry(rr * 1.01, rr * 1.01, 0.014, 40, 1, true);
  band.rotateZ(Math.PI / 2);
  place(band, faceX - 0.003, 0, 0);
  parts.push(band);
  // spokes
  const addSpoke = (ang, twist, w0, w1, curve = 0) => {
    const g = spoke(rh * 0.9, r1, w0, w1, 0.028, twist, curve);
    // concavity: push spoke roots inboard
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      const r = Math.sqrt(y * y + z * z);
      const k = Math.min(1, Math.max(0, (r1 - r) / (r1 - rh)));
      p.setX(i, p.getX(i) + hubX - 0.028 + (faceX - hubX) * (1 - k) * (1 - k));
    }
    g.computeVertexNormals();
    g.rotateX(ang);
    parts.push(g);
  };
  for (let k = 0; k < st.n; k++) {
    const a = (k / st.n) * Math.PI * 2;
    if (st.pair) {
      addSpoke(a, st.pair * rr, st.w0, st.w1);
      addSpoke(a, -st.pair * rr, st.w0, st.w1);
    } else if (st.cross) {
      addSpoke(a, st.cross * rr, st.w0, st.w1);
      addSpoke(a + Math.PI / st.n, -st.cross * rr, st.w0, st.w1);
    } else {
      addSpoke(a, 0, st.w0, st.w1, st.curve ? st.curve * rr : 0);
    }
  }
  // hub + center cap + lug nuts
  const hub = new THREE.CylinderGeometry(rh, rh * 1.1, 0.04, 20);
  hub.rotateZ(Math.PI / 2);
  place(hub, hubX + 0.005, 0, 0);
  parts.push(hub);
  const cap = new THREE.CylinderGeometry(rh * 0.45, rh * 0.5, 0.02, 16);
  cap.rotateZ(Math.PI / 2);
  place(cap, hubX + 0.03, 0, 0);
  parts.push(cap);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    const nut = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6);
    nut.rotateZ(Math.PI / 2);
    place(nut, hubX + 0.028, Math.cos(a) * rh * 0.68, Math.sin(a) * rh * 0.68);
    parts.push(nut);
  }
  const g = mergeGeos(parts);
  const barrel = flipGeo(new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, tw * 0.8, 32, 1, true).rotateZ(Math.PI / 2));
  place(barrel, -tw * 0.02, 0, 0);
  const out = { face: g, barrel };
  rimGeoCache.set(key, out);
  return out;
}

const RIM_COLORS = {
  silver: { color: '#c9ced6', metal: 1, rough: 0.28 },
  chrome: { color: '#f2f4f7', metal: 1, rough: 0.06 },
  black: { color: '#1a1b1e', metal: 0.6, rough: 0.4 },
  gunmetal: { color: '#4a4e55', metal: 1, rough: 0.3 },
  gold: { color: '#c9a043', metal: 1, rough: 0.28 },
  bronze: { color: '#8a6a3c', metal: 1, rough: 0.32 },
  white: { color: '#eceff2', metal: 0.1, rough: 0.35 },
  red: { color: '#b3141e', metal: 0.4, rough: 0.35 },
};
export const RIM_COLOR_NAMES = Object.keys(RIM_COLORS);

// ------------------------------------------------------------------ parts

function airfoil(chord, thick, camber = 0.04) {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const t = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const c = camber * (1 - (2 * x - 1) ** 2);
    pts.push([c + t, x]);
  }
  for (let i = n - 1; i > 0; i--) {
    const x = i / n;
    const t = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const c = camber * (1 - (2 * x - 1) ** 2);
    pts.push([c - t, x]);
  }
  // [y, z] with chord along -z (leading edge forward)
  return pts.map(([y, x]) => [y * chord, -x * chord]);
}

function extrudeAcross(profile, halfSpan) {
  // profile: [[y, z], …] closed; extrude along x from -halfSpan..halfSpan with end caps
  const shape = new THREE.Shape();
  shape.moveTo(profile[0][1], profile[0][0]);
  for (const [y, z] of profile.slice(1)) shape.lineTo(z, y);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: halfSpan * 2, bevelEnabled: false, curveSegments: 2 });
  // shape plane XY (x=z_profile, y=y_profile), extrusion +z → we want extrusion along x
  g.rotateY(-Math.PI / 2);
  place(g, halfSpan, 0, 0);
  return g;
}

function buildSpoiler(S, kind, rearZ) {
  const b = S.b;
  const L = S.L;
  const parts = [];
  if (!kind || kind === 'none') return null;
  const uEdge = L - (b.trunkEnd ?? 0.1) - 0.02;
  const y0 = S.topF(uEdge) + (b.section?.crown ?? 0.025);
  const half = Math.max(0.4, S.hwTopAt(uEdge) - 0.08);
  const z = S.z(uEdge);
  if (kind === 'lip' || kind === 'ducktail') {
    const h = kind === 'ducktail' ? 0.07 : 0.035;
    const prof = [[0, 0.06], [h, -0.04], [h * 0.6, -0.07], [0, -0.07]];
    const g = extrudeAcross(prof, half);
    place(g, 0, y0 - 0.005, z + 0.02);
    parts.push(g);
  } else if (kind === 'roof') {
    const ur = b.roof[b.roof.length - 2][0];
    const yr = S.roofF(ur) + (b.cabin?.crown ?? 0.035);
    const hr = Math.max(0.4, S.beltHalf(ur) - (b.cabin?.tumble ?? 0.2));
    const prof = [[0.02, 0.04], [0.03, -0.18], [-0.01, -0.2], [-0.02, 0.0]];
    const g = extrudeAcross(prof, hr);
    place(g, 0, yr - 0.01, S.z(ur) + 0.02);
    parts.push(g);
  } else if (kind === 'whale') {
    // 996 Turbo bi-plane tail: a lip on the lid edge plus a low, wide blade
    // on thick body-colour risers, all part of the engine lid
    const lip = extrudeAcross([[0, 0.05], [0.05, -0.04], [0.03, -0.07], [0, -0.07]], half * 0.92);
    place(lip, 0, y0 - 0.005, z + 0.02);
    parts.push(lip);
    const bl = extrudeAcross(airfoil(0.3, 0.13, 0.02), half * 0.9);
    place(bl, 0, y0 + 0.1, z + 0.16);
    parts.push(bl);
    for (const s of [-1, 1]) {
      const r = new THREE.BoxGeometry(0.16, 0.11, 0.24);
      place(r, s * half * 0.45, y0 + 0.05, z + 0.04);
      parts.push(r);
    }
  } else {
    // winged: gt / big / hoop / evo
    const height = kind === 'big' ? 0.3 : kind === 'evo' ? 0.2 : kind === 'hoop' ? 0.2 : 0.17;
    const chord = kind === 'big' ? 0.3 : 0.24;
    const span = kind === 'hoop' ? half : half * 0.98;
    const blade = extrudeAcross(airfoil(chord, 0.11, 0.035), span);
    place(blade, 0, y0 + height, z + 0.1);
    blade.rotateX(0);
    parts.push(blade);
    // endplates
    if (kind !== 'hoop') {
      for (const s of [-1, 1]) {
        const ep = new THREE.BoxGeometry(0.012, 0.12, chord * 1.15);
        place(ep, s * span, y0 + height - 0.02, z + 0.1 - chord * 0.5);
        parts.push(ep);
      }
    }
    // uprights
    for (const s of [-1, 1]) {
      const ux = kind === 'hoop' ? s * (span - 0.03) : s * span * 0.62;
      const up = new THREE.BoxGeometry(kind === 'hoop' ? 0.05 : 0.025, height + 0.02, 0.08);
      place(up, ux, y0 + height / 2, z + 0.06, kind === 'hoop' ? -0.12 : 0, 0, kind === 'hoop' ? s * 0.08 : 0);
      parts.push(up);
    }
    if (kind === 'big') {
      const flap = extrudeAcross(airfoil(0.12, 0.1, 0.03), span * 0.98);
      place(flap, 0, y0 + height + 0.055, z + 0.1 - chord * 0.9);
      parts.push(flap);
    }
  }
  void rearZ;
  return mergeGeos(parts);
}

function buildInterior(S) {
  const b = S.b;
  const u0 = b.cowl, u1 = b.deck;
  const belt = S.topF((u0 + u1) / 2);
  const hw = S.beltHalf((u0 + u1) / 2) * 0.92;
  const parts = [];
  const tEnd = b.roadster ? b.cowl + 1.35 : u1;
  const tubLen = (tEnd - u0) * 0.92;
  const tub = new THREE.BoxGeometry(hw * 2, 0.36, tubLen);
  place(tub, 0, belt - 0.2, S.z((u0 + tEnd) / 2));
  parts.push(tub);
  if (b.roadster) {
    // roll hoops behind the seats
    for (const s of [-1, 1]) {
      const hoop = new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI);
      place(hoop, s * hw * 0.48, belt + 0.12, S.z(b.cowl + 1.12), 0, 0, 0);
      parts.push(hoop);
    }
  }
  const dash = new THREE.BoxGeometry(hw * 2, 0.16, 0.42);
  place(dash, 0, belt + 0.02, S.z(u0 + 0.28));
  parts.push(dash);
  const seatU = b.roadster ? b.cowl + 0.95 : b.roof[1][0] + (b.roof[b.roof.length - 2][0] - b.roof[1][0]) * (b.seats2 ? 0.38 : 0.5);
  const room = b.roadster ? 0.62 : Math.max(0.2, S.roofF(seatU) - S.topF(seatU));
  const backH = Math.min(0.6, room + 0.0);
  for (const s of [-1, 1]) {
    const sx = s * hw * 0.48;
    const back = new THREE.BoxGeometry(0.46, backH, 0.12);
    place(back, sx, belt - 0.22 + backH / 2, S.z(seatU) - 0.08, -0.22, 0, 0);
    parts.push(back);
    const head = new THREE.BoxGeometry(0.26, 0.15, 0.1);
    place(head, sx, belt - 0.22 + backH + 0.05, S.z(seatU) - 0.08 - backH * 0.22, -0.2, 0, 0);
    parts.push(head);
  }
  if (b.seats2) {
    const room2 = Math.max(0.2, S.roofF(Math.min(b.deck - 0.1, seatU + 0.85)) - S.topF(seatU + 0.85));
    const bh = Math.min(0.5, 0.25 + room2 * 0.6);
    const bench = new THREE.BoxGeometry(hw * 1.7, bh, 0.14);
    place(bench, 0, belt - 0.2 + bh / 2, S.z(Math.min(b.deck - 0.15, seatU + 0.85)), -0.25, 0, 0);
    parts.push(bench);
  }
  const wheel = new THREE.TorusGeometry(0.17, 0.022, 6, 18);
  place(wheel, hw * 0.48, belt + 0.12, S.z(u0 + 0.62), -0.45, 0, 0);
  parts.push(wheel);
  return mergeGeos(parts);
}

function radialTexture(inner, outer, size = 64) {
  const key = `${inner}|${outer}|${size}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.55, inner.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.6})`));
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  texCache.set(key, t);
  return t;
}

// ------------------------------------------------------------------ build

/**
 * spec: a car from cars.js ({ body, ... }); look: paint/kit/rims/etc.
 * opts: { hiRes: bool (1024 body texture), interior: bool, shadow: bool }
 */
export function buildCarModel(spec, lookIn = {}, opts = {}) {
  const { body: b, look } = applyLook(spec, lookIn);
  const S = shapeOf(b);
  const res = opts.hiRes ? 1024 : 512;
  const lights = { head: { value: 0 }, tail: { value: 0.12 }, brake: { value: 0 } };
  const fin = FINISHES[look.finish] || FINISHES.metallic;

  const group = new THREE.Group();
  group.name = spec.id || 'car';
  const body = new THREE.Group();
  group.add(body);
  const disposables = [];

  const solid = solidPaint(look);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.12, metalness: 1 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.3, metalness: 0.3 });
  disposables.push(solid, trimMat, chrome, carbonMat);

  // hull + caps
  const hull = buildLowerBody(S);
  const bodyLayers = paintBody(S, look, hull.vs, res * (opts.hiRes ? 1 : 1));
  const bodyMat = paintMaterial(bodyLayers, lights, { iridescence: look.finish === 'pearl' ? 0.7 : 0 });
  const bodyMesh = new THREE.Mesh(hull.geometry, bodyMat);
  bodyMesh.castShadow = true;
  body.add(bodyMesh);
  const capRes = opts.hiRes ? 512 : 256;
  const frontMat = paintMaterial(paintCap(S, hull.capFront, look, 'front', capRes), lights);
  const rearMat = paintMaterial(paintCap(S, hull.capRear, look, 'rear', capRes), lights);
  body.add(new THREE.Mesh(hull.capFront.geometry, frontMat));
  body.add(new THREE.Mesh(hull.capRear.geometry, rearMat));
  disposables.push(hull.geometry, hull.capFront.geometry, hull.capRear.geometry, bodyMat, frontMat, rearMat);

  // light units projected onto the nose/tail
  {
    const hwF = S.hwAt(0.3), hwR = S.hwAt(S.L - 0.3);
    const yF = S.topF(0.04);
    const hb = { x0: hwF * 0.42, x1: hwF * 0.97, y0: yF - 0.15, y1: yF - 0.005, ...(b.headBox || {}) };
    const yR = S.topF(S.L - 0.04);
    const tb = { x0: hwR * 0.5, x1: hwR * 0.985, y0: yR - 0.15, y1: yR - 0.02, ...(b.tailBox || {}) };
    if (b.head !== 'popup') {
      const hm = paintMaterial(paintLight('head', b.head || 'rect', hb.x1 - hb.x0, hb.y1 - hb.y0), lights, { alphaTest: 0.5 });
      disposables.push(hm);
      for (const side of [1, -1]) {
        const g = projectedPatch(S, hb.x0, hb.x1, hb.y0, hb.y1, true, side);
        body.add(new THREE.Mesh(g, hm));
        disposables.push(g);
      }
    }
    const tm = paintMaterial(paintLight('tail', b.tail || 'bar', tb.x1 - tb.x0, tb.y1 - tb.y0), lights, { alphaTest: 0.5 });
    disposables.push(tm);
    for (const side of [1, -1]) {
      const g = projectedPatch(S, tb.x0, tb.x1, tb.y0, tb.y1, false, side);
      body.add(new THREE.Mesh(g, tm));
      disposables.push(g);
    }
  }

  // cabin
  const cab = buildCabin(S);
  const cabLayers = paintCabin(S, look, cab.vs, opts.hiRes ? 512 : 256);
  const cabMat = paintMaterial(cabLayers, lights, { transparent: true });
  const cabMesh = new THREE.Mesh(cab.geometry, cabMat);
  cabMesh.renderOrder = 2;
  cabMesh.castShadow = true;
  body.add(cabMesh);
  disposables.push(cab.geometry, cabMat);
  // dark inner shell (headliner, pillar trim, far-side door cards): through
  // the glass you see a dim cabin instead of the world behind the car
  if (!b.roadster) {
    const shellG = cab.geometry.clone();
    const pa = shellG.attributes.position;
    const beltY = S.topF(b.cowl + (b.deck - b.cowl) * 0.5);
    for (let k = 0; k < pa.count; k++) {
      pa.setX(k, pa.getX(k) * 0.965);
      pa.setY(k, beltY + (pa.getY(k) - beltY) * 0.965);
    }
    shellG.computeVertexNormals();
    const shellM = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.92, metalness: 0, side: THREE.BackSide });
    const shell = new THREE.Mesh(shellG, shellM);
    shell.renderOrder = 1;
    body.add(shell);
    disposables.push(shellG, shellM);
  }

  // interior
  if (opts.interior !== false) {
    const ig = buildInterior(S);
    const im = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.85, metalness: 0 });
    body.add(new THREE.Mesh(ig, im));
    disposables.push(ig, im);
  }


  // wheel-arch lips (wide kits get chunky black over-fenders)
  {
    const wide = look.kit === 'wide';
    const r = wide ? 0.03 : 0.013;
    const lipMat = wide ? trimMat : solid;
    for (const ua of [S.uF, S.uR]) {
      const pts = [];
      const yLow = Math.max(S.botF(ua - S.archR) , S.botF(ua + S.archR)) + 0.04;
      const t0 = Math.asin(Math.min(0.95, Math.max(-0.3, (yLow - S.wheelR) / S.archR)));
      for (let k = 0; k <= 16; k++) {
        const t = t0 + (Math.PI - 2 * t0) * (k / 16);
        const u = ua + Math.cos(t) * (S.archR + 0.004);
        const y = S.wheelR + Math.sin(t) * (S.archR + 0.004);
        pts.push([u, y]);
      }
      for (const side of [1, -1]) {
        const curve = new THREE.CatmullRomCurve3(pts.map(([u, y]) => {
          const x = S.hwAt(u) - (b.section?.tumble ?? 0.05) * Math.max(0, y - S.botF(u)) * 0.6 + (wide ? 0.02 : 0.004);
          return new THREE.Vector3(side * x, y, S.z(u));
        }));
        const tg = new THREE.TubeGeometry(curve, 24, r, 6, false);
        const tm = new THREE.Mesh(tg, lipMat);
        body.add(tm);
        disposables.push(tg);
      }
    }
  }

  // mirrors
  {
    const u = b.cowl + 0.16;
    const y = S.topF(u) + 0.09;
    const x = S.beltHalf(u) + 0.11;
    // D-shaped housing: rounded nose, flat glass face toward the rear
    const pod = new THREE.SphereGeometry(1, 14, 8);
    {
      const pp = pod.attributes.position;
      for (let k = 0; k < pp.count; k++) {
        const zz = pp.getZ(k);
        if (zz < 0) pp.setZ(k, zz * 0.25);
        pp.setX(k, pp.getX(k) * (1 + 0.15 * Math.max(0, -pp.getY(k))));
      }
      pod.scale(0.1, 0.06, 0.07);
      pod.computeVertexNormals();
    }
    disposables.push(pod);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(pod, solid);
      m.position.set(s * x, y, S.z(u));
      body.add(m);
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.05), trimMat);
      stalk.position.set(s * (x - 0.07), y - 0.02, S.z(u) + 0.01);
      body.add(stalk);
      const glassG = new THREE.CircleGeometry(1, 14);
      glassG.scale(0.088, 0.05, 1);
      const mg = new THREE.Mesh(glassG, chrome);
      mg.rotation.y = Math.PI;
      mg.position.set(s * x, y, S.z(u) - 0.019);
      body.add(mg);
    }
  }

  // spoiler
  const spoilerKind = look.spoiler === 'stock' ? (b.wing || 'none') : look.spoiler;
  const sg = buildSpoiler(S, spoilerKind);
  if (sg) {
    const sm = new THREE.Mesh(sg, look.wingCarbon ? carbonMat : solid);
    sm.castShadow = true;
    body.add(sm);
    disposables.push(sg);
  }

  // hood scoop
  if (look.hood === 'scoop' || (look.hood === 'stock' && b.scoop)) {
    const u = (b.cowl + (b.hoodFront ?? 0.2)) / 2 + 0.15;
    const sc = new THREE.BoxGeometry(0.42, 0.07, 0.38, 1, 1, 1);
    const p = sc.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getZ(i) > 0) p.setY(i, p.getY(i) * 0.15 - 0.03);
      if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.85);
    }
    sc.computeVertexNormals();
    const scm = new THREE.Mesh(sc, look.hood === 'scoop' ? solid : solid);
    scm.position.set(0, S.topF(u) + (b.section?.crown ?? 0.025) + 0.025, S.z(u));
    body.add(scm);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.045), trimMat);
    mouth.position.set(0, S.topF(u) + 0.06, S.z(u) + 0.19);
    body.add(mouth);
    disposables.push(sc);
  }

  // exhausts
  const exhaustPos = [];
  {
    const ex = look.exhaust || b.exhaust || 'single';
    const capR = hull.capRear;
    const diffH = (capR.maxY - capR.minY) * 0.2;
    const exY = capR.minY + diffH * 0.55;
    const tipR = look.bigExhaust ? 0.055 : 0.042;
    for (const xl of exhaustLayout(ex, capR.w / 2)) {
      const x = -xl; // rear cap texture is mirrored (viewer's left = car's left = +x)
      exhaustPos.push([x, exY]);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(tipR, tipR * 0.92, 0.14, 16, 1, true), chrome);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(x, exY, -S.L / 2 - 0.035);
      body.add(tube);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(tipR * 0.85, 14), trimMat);
      inner.rotation.y = Math.PI;
      inner.position.set(x, exY, -S.L / 2 - 0.08);
      body.add(inner);
    }
    if (ex === 'side') {
      for (const s of [-1, 1]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, b.wb * 0.55, 14), chrome);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(s * (S.hwAt((S.uF + S.uR) / 2) + 0.01), S.botF((S.uF + S.uR) / 2) + 0.06, S.z((S.uF + S.uR) / 2));
        body.add(pipe);
      }
    }
  }

  // pop-up headlights
  const popups = [];
  if (b.head === 'popup') {
    const u = 0.32;
    const y = S.topF(u) + (b.section?.crown ?? 0.025) * 0.5;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.1 });
    disposables.push(lampMat);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * (S.hwTopAt(u) - 0.27), y - 0.035, S.z(u - 0.14));
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.28), solid);
      box.position.set(0, 0.0, -0.14);
      pivot.add(box);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.085), lampMat);
      face.position.set(0, 0, 0.002);
      pivot.add(face);
      body.add(pivot);
      popups.push(pivot);
    }
    popups.lampMat = lampMat;
  }

  // ---------------------------------------------------------- wheels
  const wheels = [];
  const wr = S.wheelR;
  const rimR = b.rimR + (look.rimSize || 0) * 0.0127;
  const tw = b.tireW + (look.kit === 'wide' ? 0.03 : 0);
  const tireTex = canvasTex(tireCanvas(), true);
  tireTex.wrapS = THREE.RepeatWrapping;
  const tireMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tireTex, roughness: 0.92, metalness: 0 });
  const rc = RIM_COLORS[look.rimColor] || RIM_COLORS.silver;
  const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(rc.color), metalness: rc.metal, roughness: rc.rough, envMapIntensity: 1.2 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.45 });
  const discMat = new THREE.MeshStandardMaterial({ color: 0x6d6f73, metalness: 0.9, roughness: 0.45 });
  const calMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.caliper || '#b8141c'), metalness: 0.3, roughness: 0.4 });
  disposables.push(tireMat, rimMat, barrelMat, discMat, calMat, tireTex);
  const tireG = tireGeometry(wr, rimR, tw);
  const rim = rimGeometry(look.rims || 'five', rimR, tw);
  const discG = new THREE.CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.026, 28).rotateZ(Math.PI / 2);
  const calG = new THREE.BoxGeometry(0.05, rimR * 0.5, 0.09);
  disposables.push(tireG, discG, calG);
  const stance = look.kit === 'wide' ? 0.035 : 0;
  const wheelX = (u) => S.hwAt(u) - tw / 2 - (b.wheelInset ?? 0.025) + stance;
  for (const [u, front] of [[S.uF, true], [S.uR, false]]) {
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * wheelX(u), wr, S.z(u));
      const spin = new THREE.Group();
      pivot.add(spin);
      const vis = new THREE.Group();
      if (side < 0) vis.rotation.y = Math.PI;
      spin.add(vis);
      const tire = new THREE.Mesh(tireG, tireMat);
      tire.castShadow = true;
      vis.add(tire);
      vis.add(new THREE.Mesh(rim.face, rimMat));
      vis.add(new THREE.Mesh(rim.barrel, barrelMat));
      const disc = new THREE.Mesh(discG, discMat);
      disc.position.x = -0.01;
      vis.add(disc);
      const cal = new THREE.Mesh(calG, calMat);
      cal.position.set(side * 0.02, rimR * 0.5, -rimR * 0.42);
      cal.rotation.x = 0.7;
      pivot.add(cal);
      group.add(pivot);
      wheels.push({ pivot, spin, front, side, radius: wr });
    }
  }

  // ---------------------------------------------------------- underglow + shadow
  let neon = null;
  if (look.neon) {
    const nm = new THREE.MeshBasicMaterial({
      color: new THREE.Color(look.neon).multiplyScalar(2.2),
      map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    neon = new THREE.Mesh(new THREE.PlaneGeometry(S.W * 1.7, S.L * 1.25), nm);
    neon.rotation.x = -Math.PI / 2;
    neon.position.y = 0.03;
    neon.renderOrder = 1;
    group.add(neon);
    disposables.push(nm, neon.geometry);
  }
  if (opts.shadow !== false) {
    const shm = new THREE.MeshBasicMaterial({
      color: 0x000000, map: radialTexture('rgba(255,255,255,0.92)', 'rgba(255,255,255,0)'),
      transparent: true, depthWrite: false, opacity: 0.85,
    });
    shm.alphaMap = shm.map;
    shm.map = null;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(S.W * 1.35, S.L * 1.18), shm);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.015;
    sh.renderOrder = 0;
    group.add(sh);
    disposables.push(shm, sh.geometry);
  }

  // ride height (suspension mods lower the body)
  const lower = (look.ride ?? 0) * 0.045 + (look.kit === 'wide' ? 0.01 : 0);
  body.position.y = -lower;

  const state = { spin: 0, popup: 0 };
  const handle = {
    group, body, wheels, S, spec, look, lights, popups, neon, exhausts: exhaustPos.length ? exhaustPos : [[0.4, 0.3]],
    dims: { L: S.L, W: S.W, wb: b.wb, track: wheelX(S.uF) * 2, wheelR: wr, uF: S.uF, uR: S.uR, rideLower: lower },
    /** head/tail 0..1, brake 0..1 */
    setLights(head, tail, brake) {
      lights.head.value = head;
      lights.tail.value = tail;
      lights.brake.value = brake;
      if (popups.lampMat) popups.lampMat.emissiveIntensity = head * 6;
      state.popupTarget = head > 0.5 ? 1 : 0;
    },
    /**
     * Per-frame animation: speed (m/s), steer (radians, + = left), pitch/roll (radians),
     * heave (m), dt.
     */
    animate(dt, speed, steer, pitch = 0, roll = 0, heave = 0, wheelSpinSpeed = null) {
      const w = wheelSpinSpeed !== null ? wheelSpinSpeed : speed / wr;
      state.spin += w * dt;
      for (const wh of wheels) {
        wh.spin.rotation.x = state.spin;
        if (wh.front) wh.pivot.rotation.y = steer;
      }
      body.rotation.x = pitch;
      body.rotation.z = roll;
      body.position.y = -lower + heave;
      if (popups.length) {
        state.popup += ((state.popupTarget || 0) - state.popup) * Math.min(1, dt * 5);
        for (const p of popups) p.rotation.x = -state.popup * 0.95;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
      for (const m of [bodyMat, frontMat, rearMat, cabMat]) {
        for (const k of ['map', 'roughnessMap', 'emissiveMap']) m[k]?.dispose?.();
      }
    },
  };
  void fin;
  return handle;
}
