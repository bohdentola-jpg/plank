// Props: everything that can sit on an ofrenda (and a few things that can't),
// built from primitives. Each builder returns a Group; animated ones carry
// userData.update(t, dt). PROP_INFO holds names + which "element" they bring.
import * as THREE from 'three';
import { toon, flat, sphere, cyl, box, mesh, lathe, tube, rbox, mkCanvas, tex, shade, rng, PAL, glowSprite, outline, mergeByParent } from './toon.js';
import { marigolds, marigoldBunch, papelString } from './world.js';

const TAU = Math.PI * 2;
const G = (...c) => { const g = new THREE.Group(); for (const x of c) if (x) g.add(x); return g; };

// ------------------------------------------------------------------ candles
export function flame(scale = 1) {
  const g = new THREE.Group();
  const outer = sphere(0.022 * scale, flat('#ffb43a', { transparent: true, opacity: 0.95 }), 10);
  outer.scale.set(1, 2.1, 1);
  outer.position.y = 0.03 * scale;
  outer.castShadow = false;
  const inner = sphere(0.012 * scale, flat('#fff6c2'), 8);
  inner.scale.set(1, 1.9, 1);
  inner.position.y = 0.022 * scale;
  inner.castShadow = false;
  const glow = glowSprite('#ffae42', 0.32 * scale, 0.75);
  glow.position.y = 0.035 * scale;
  g.add(outer, inner, glow);
  g.userData.phase = Math.random() * 10;
  g.userData.update = (t) => {
    const f = 1 + Math.sin(t * 13 + g.userData.phase) * 0.08 + Math.sin(t * 23 + g.userData.phase) * 0.05;
    outer.scale.set(1, 2.1 * f, 1);
    glow.material.opacity = 0.6 + (f - 1) * 2;
    g.rotation.z = Math.sin(t * 3 + g.userData.phase) * 0.06;
  };
  g.traverse((o) => { o.raycast = () => {}; o.userData.noOutline = true; });
  return g;
}

// veladora: a candle in a tall colored glass
export function veladora({ color = '#f7e4c8', glass = '#d8293b', lit = false } = {}) {
  const g = new THREE.Group();
  const glassM = toon(glass, { transparent: true, opacity: 0.78 });
  const jar = cyl(0.045, 0.045, 0.17, glassM, 16);
  jar.position.y = 0.085;
  g.add(jar);
  const wax = cyl(0.04, 0.04, 0.14, toon(color), 14);
  wax.position.y = 0.07;
  g.add(wax);
  // printed band on the glass
  const band = cyl(0.0465, 0.0465, 0.05, toon('#fff3dc', { transparent: true, opacity: 0.9 }), 16);
  band.position.y = 0.09;
  g.add(band);
  const wick = cyl(0.003, 0.003, 0.02, toon('#222'), 4);
  wick.position.y = 0.15;
  g.add(wick);
  const f = flame(1);
  f.position.y = 0.155;
  f.visible = lit;
  g.add(f);
  g.userData.flame = f;
  g.userData.lit = lit;
  g.userData.update = (t) => f.visible && f.userData.update(t);
  g.userData.light = (on = true) => { f.visible = on; g.userData.lit = on; };
  return g;
}

// tall white cirio in a clay holder
export function cirio({ lit = false, h = 0.32 } = {}) {
  const g = new THREE.Group();
  const holder = lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.05, 0.04], [0.035, 0.07], [0.04, 0.08], [0, 0.08]], toon(PAL.terracotta));
  g.add(holder);
  const c = cyl(0.026, 0.028, h, toon('#fbf4e4'), 12);
  c.position.y = 0.08 + h / 2;
  g.add(c);
  const drip = sphere(0.02, toon('#fbf4e4'), 8);
  drip.scale.set(0.6, 1.5, 0.6);
  drip.position.set(0.024, 0.08 + h - 0.03, 0);
  g.add(drip);
  const f = flame(1.1);
  f.position.y = 0.08 + h + 0.004;
  f.visible = lit;
  g.add(f);
  g.userData.flame = f;
  g.userData.lit = lit;
  g.userData.update = (t) => f.visible && f.userData.update(t);
  g.userData.light = (on = true) => { f.visible = on; g.userData.lit = on; };
  return g;
}

// ------------------------------------------------------------------ flowers
export function marigoldVase({ seed = 1, big = 1 } = {}) {
  const g = new THREE.Group();
  const vase = lathe([[0, 0], [0.07, 0], [0.09, 0.05], [0.085, 0.12], [0.06, 0.17], [0.065, 0.2], [0, 0.2]].map(([r, y]) => [r * big, y * big]), toon(PAL.terracotta));
  g.add(vase);
  // painted band on the clay
  const band = mesh(new THREE.TorusGeometry(0.087 * big, 0.006 * big, 6, 24), toon(PAL.cream), { cast: false });
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.09 * big;
  g.add(band);
  // stems + leaves
  const stemM = toon('#3e7d3a');
  for (let i = 0; i < 5; i++) {
    const s = cyl(0.005, 0.005, 0.14 * big, stemM, 4);
    s.position.set((i - 2) * 0.012, 0.25 * big, 0);
    s.rotation.z = (i - 2) * 0.12;
    g.add(s);
  }
  const bunch = marigoldBunch(16, 0.13 * big, seed, 0.042 * big);
  bunch.position.y = 0.27 * big;
  g.add(bunch);
  const leafM = toon('#3b8a3c');
  for (let i = 0; i < 6; i++) {
    const l = sphere(0.035 * big, leafM, 6);
    const a = (i / 6) * TAU;
    l.scale.set(1.6, 0.25, 0.7);
    l.position.set(Math.cos(a) * 0.1 * big, 0.25 * big, Math.sin(a) * 0.1 * big);
    l.rotation.y = -a;
    g.add(l);
  }
  return g;
}

export function cockscombVase({ seed = 2 } = {}) {
  // terciopelo / mano de león: velvety magenta crests
  const g = new THREE.Group();
  const vase = lathe([[0, 0], [0.06, 0], [0.07, 0.08], [0.05, 0.16], [0, 0.16]], toon('#2a6fb5'));
  g.add(vase);
  const r = rng(seed);
  const m = toon('#c3125d');
  for (let i = 0; i < 5; i++) {
    const crest = sphere(0.055, m, 12);
    const p = new THREE.Vector3((r() - 0.5) * 0.12, 0.25 + r() * 0.08, (r() - 0.5) * 0.08);
    crest.position.copy(p);
    crest.scale.set(1.3, 0.8, 0.5);
    crest.rotation.set(r(), r() * 3, r() - 0.5);
    g.add(crest);
    const st = cyl(0.006, 0.006, p.y - 0.12, toon('#3e7d3a'), 4);
    st.position.set(p.x * 0.5, 0.12 + (p.y - 0.12) / 2, p.z * 0.5);
    g.add(st);
  }
  return g;
}

export function nubeVase() {
  // nube (baby's breath): a cloud of tiny white blossoms
  const g = new THREE.Group();
  const vase = lathe([[0, 0], [0.05, 0], [0.055, 0.12], [0.04, 0.16], [0, 0.16]], toon('#e8e0f0', { transparent: true, opacity: 0.85 }));
  g.add(vase);
  const r = rng(8);
  const spots = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 0.12;
    spots.push([Math.cos(a) * d, 0.24 + r() * 0.08, Math.sin(a) * d, 0.012]);
  }
  g.add(marigolds(spots, { colors: ['#ffffff', '#f6f1ff', '#fff8f0'], seed: 8 }));
  return g;
}

// ------------------------------------------------------------------ the four elements
export function waterGlass() {
  const g = new THREE.Group();
  const glass = lathe([[0, 0], [0.045, 0], [0.05, 0.12], [0.052, 0.13], [0, 0.13]], toon('#d8f1ff', { transparent: true, opacity: 0.45 }));
  g.add(glass);
  const water = cyl(0.044, 0.04, 0.1, toon('#6fc7ef', { transparent: true, opacity: 0.75 }), 16);
  water.position.y = 0.055;
  g.add(water);
  const top = mesh(new THREE.CircleGeometry(0.046, 16), flat('#bfe9ff'), { cast: false });
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.106;
  g.add(top);
  return g;
}

export function jarrito() {
  // clay jarrito of water
  const g = new THREE.Group();
  const j = lathe([[0, 0], [0.04, 0], [0.055, 0.04], [0.05, 0.08], [0.035, 0.1], [0.045, 0.12], [0, 0.12]], toon(PAL.terracotta));
  g.add(j);
  const handle = mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI * 1.2), toon(PAL.terracotta));
  handle.position.set(0.05, 0.07, 0);
  handle.rotation.z = -Math.PI / 2;
  g.add(handle);
  const dots = mesh(new THREE.TorusGeometry(0.052, 0.004, 4, 20), toon(PAL.cream), { cast: false });
  dots.rotation.x = Math.PI / 2;
  dots.position.y = 0.06;
  g.add(dots);
  return g;
}

export function saltDish() {
  const g = new THREE.Group();
  const dish = lathe([[0, 0], [0.07, 0], [0.085, 0.03], [0.09, 0.035], [0, 0.035]], toon('#2a6fb5'));
  g.add(dish);
  const salt = mesh(new THREE.ConeGeometry(0.06, 0.05, 16), toon('#ffffff'));
  salt.position.y = 0.05;
  g.add(salt);
  const rim = mesh(new THREE.TorusGeometry(0.087, 0.005, 4, 24), toon('#ffffff'), { cast: false });
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.033;
  g.add(rim);
  return g;
}

// sahumerio / copalero with smoldering copal and rising smoke
export function copalBurner({ lit = false } = {}) {
  const g = new THREE.Group();
  const clay = toon('#b45f3c');
  const cup = lathe([[0, 0.04], [0.06, 0.05], [0.085, 0.1], [0.09, 0.12], [0, 0.12]], clay);
  g.add(cup);
  const foot = lathe([[0, 0], [0.05, 0], [0.04, 0.02], [0.025, 0.05], [0, 0.05]], clay);
  g.add(foot);
  const handle = cyl(0.014, 0.018, 0.14, clay, 8);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.15, 0.09, 0);
  g.add(handle);
  for (let i = 0; i < 6; i++) {
    const hole = mesh(new THREE.CircleGeometry(0.008, 6), flat('#3a1a10'), { cast: false });
    const a = (i / 6) * TAU;
    hole.position.set(Math.cos(a) * 0.076, 0.085, Math.sin(a) * 0.076);
    hole.lookAt(Math.cos(a) * 2, 0.085, Math.sin(a) * 2);
    g.add(hole);
  }
  const coals = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const c = sphere(0.018, toon('#f5eed7'), 6);
    c.position.set((Math.random() - 0.5) * 0.07, 0.125, (Math.random() - 0.5) * 0.07);
    coals.add(c);
  }
  g.add(coals);
  const ember = glowSprite('#ff7a2a', 0.22, 0.6);
  ember.position.y = 0.13;
  ember.visible = lit;
  g.add(ember);
  // smoke puffs
  const smoke = new THREE.Group();
  const smokeM = new THREE.SpriteMaterial({ map: glowSprite().material.map, color: '#e9e4f2', transparent: true, opacity: 0.35, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(smokeM.clone());
    s.raycast = () => {};
    smoke.add(s);
    puffs.push({ s, t: i / 9 });
  }
  smoke.position.y = 0.14;
  smoke.visible = lit;
  g.add(smoke);
  g.userData.lit = lit;
  g.userData.light = (on = true) => { smoke.visible = on; ember.visible = on; g.userData.lit = on; };
  g.userData.update = (t, dt = 0.016) => {
    if (!smoke.visible) return;
    for (const p of puffs) {
      p.t = (p.t + dt * 0.22) % 1;
      const k = p.t;
      p.s.position.set(Math.sin(k * 7 + t * 0.5) * 0.05 * k, k * 0.75, Math.cos(k * 5) * 0.03 * k);
      const sc = 0.06 + k * 0.28;
      p.s.scale.set(sc, sc, sc);
      p.s.material.opacity = Math.sin(k * Math.PI) * 0.32;
    }
    ember.material.opacity = 0.45 + Math.sin(t * 5) * 0.15;
  };
  return g;
}

// ------------------------------------------------------------------ food
export function panDeMuerto({ topping = 'sugar', size = 1 } = {}) {
  const g = new THREE.Group();
  const s = size;
  const crust = toon('#d68a3c');
  const loaf = sphere(0.1 * s, crust, 24);
  loaf.scale.set(1, 0.55, 1);
  loaf.position.y = 0.04 * s;
  g.add(loaf);
  // huesitos: four bone ridges crossing over the top
  const boneM = toon('#c97a32');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8 * 2 - 1;
      const r = u * 0.1 * s;
      const y = 0.04 * s + Math.sqrt(Math.max(0, 1 - u * u)) * 0.058 * s + 0.004;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const bone = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.011 * s, 6), boneM);
    g.add(bone);
    // knobby "joints" along the bone
    for (const u of [-0.55, 0, 0.55]) {
      const k = sphere(0.016 * s, boneM, 8);
      const r = u * 0.1 * s;
      k.position.set(Math.cos(a) * r, 0.04 * s + Math.sqrt(1 - u * u) * 0.058 * s + 0.006, Math.sin(a) * r);
      g.add(k);
    }
  }
  // the little ball on top (the skull / a tear)
  const ball = sphere(0.025 * s, boneM, 12);
  ball.position.y = 0.105 * s;
  g.add(ball);
  if (topping === 'sugar') {
    const sugar = sphere(0.101 * s, toon('#ffffff', { map: sugarTex(), transparent: true, alphaTest: 0.5 }), 24);
    sugar.scale.set(1, 0.56, 1);
    sugar.position.y = 0.041 * s;
    sugar.castShadow = false;
    sugar.userData.noOutline = true;
    g.add(sugar);
  } else if (topping === 'sesame') {
    const r = rng(4);
    const seedM = toon('#f4e2b6');
    for (let i = 0; i < 60; i++) {
      const a = r() * TAU, u = Math.sqrt(r()) * 0.95;
      const sd = sphere(0.004 * s, seedM, 4);
      sd.scale.set(1, 0.5, 1.6);
      sd.position.set(Math.cos(a) * u * 0.1 * s, 0.04 * s + Math.sqrt(1 - u * u) * 0.055 * s + 0.002, Math.sin(a) * u * 0.1 * s);
      g.add(sd);
    }
  }
  return g;
}

let _sugar = null;
function sugarTex() {
  if (_sugar) return _sugar;
  const cv = mkCanvas(128, 64);
  const ctx = cv.getContext('2d');
  const r = rng(3);
  for (let i = 0; i < 1400; i++) {
    const y = r() * 30; // only the upper half of the sphere (the crown)
    ctx.fillStyle = r() > 0.4 ? '#ffffff' : '#ffe9c8';
    ctx.fillRect(r() * 128, y, 1.5, 1.5);
  }
  _sugar = tex(cv);
  _sugar.userData.shared = true;
  return _sugar;
}

// calavera de azúcar. decor: { eyes, nose, flowers, name, swirls, base } or a canvas
export function sugarSkull({ decor = null, size = 1, canvas = null, dataUrl = null, plain = false } = {}) {
  const g = new THREE.Group();
  const s = size;
  const cv = canvas || (plain ? plainSkullCanvas() : skullCanvas(decor || {}));
  const m = toon('#ffffff', { map: tex(cv) });
  if (dataUrl && !canvas) {
    // a decorated skull saved from the workshop
    const img = new Image();
    img.onload = () => {
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      m.map.needsUpdate = true;
    };
    img.src = dataUrl;
  }
  // cranium: a sphere squashed + a jaw block, both mapped with the decor canvas
  const geo = new THREE.SphereGeometry(0.06 * s, 32, 24);
  const head = mesh(geo, m);
  head.scale.set(1, 0.92, 0.88);
  head.position.y = 0.075 * s;
  head.rotation.y = -Math.PI / 2; // put the canvas center (u=.5) facing +z
  g.add(head);
  const jaw = rbox(0.075 * s, 0.045 * s, 0.07 * s, 0.015 * s, toon('#fffdf5'));
  jaw.position.set(0, 0.03 * s, 0.006 * s);
  g.add(jaw);
  // teeth line on the jaw
  const teethM = toon('#7a4a9a');
  for (let i = -2; i <= 2; i++) {
    const tline = box(0.003 * s, 0.022 * s, 0.002 * s, teethM);
    tline.position.set(i * 0.012 * s, 0.032 * s, 0.042 * s);
    tline.userData.noOutline = true;
    g.add(tline);
  }
  g.userData.canvas = cv;
  g.userData.material = m;
  g.userData.head = head;
  return g;
}

export function plainSkullCanvas() {
  const cv = mkCanvas(512, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 512, 256);
  const r = rng(6);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r() > 0.5 ? '#f3ede0' : '#ffffff';
    ctx.fillRect(r() * 512, r() * 256, 2, 2);
  }
  // molded eye sockets and nose, still undecorated
  ctx.fillStyle = '#efe7d6';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(256 + sx * 36, 128, 26, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(256, 152); ctx.lineTo(246, 176); ctx.lineTo(266, 176); ctx.fill();
  return cv;
}

// decorate the skull canvas (u: around, v: down). The face sits at u≈0.5
export function skullCanvas({ eyes = '#16b3ac', nose = '#e4007c', flowers = '#ff9a0d', swirls = '#7b3fbf', name = '', foil = true, extra = [] } = {}) {
  const cv = mkCanvas(512, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 512, 256);
  // sugar sparkle
  const r = rng(6);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r() > 0.5 ? '#f3ede0' : '#ffffff';
    ctx.fillRect(r() * 512, r() * 256, 2, 2);
  }
  const cx = 256;
  // eye sockets with foil
  for (const sx of [-1, 1]) {
    ctx.fillStyle = eyes;
    ctx.beginPath(); ctx.ellipse(cx + sx * 36, 128, 26, 30, 0, 0, TAU); ctx.fill();
    if (foil) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(cx + sx * 36 - 8, 118, 9, 12, -0.4, 0, TAU); ctx.fill();
    }
    // petal ring around the eye
    ctx.fillStyle = flowers;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      ctx.beginPath(); ctx.arc(cx + sx * 36 + Math.cos(a) * 34, 128 + Math.sin(a) * 37, 5, 0, TAU); ctx.fill();
    }
  }
  // nose: an upside-down heart
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.moveTo(cx, 152);
  ctx.bezierCurveTo(cx - 16, 168, cx - 12, 182, cx, 178);
  ctx.bezierCurveTo(cx + 12, 182, cx + 16, 168, cx, 152);
  ctx.fill();
  // forehead flower
  ctx.fillStyle = flowers;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 15, 62 + Math.sin(a) * 15, 11, 6, a, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = nose;
  ctx.beginPath(); ctx.arc(cx, 62, 8, 0, TAU); ctx.fill();
  // swirls on the cheeks/temples
  ctx.strokeStyle = swirls;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    for (let k = 0; k < 40; k++) {
      const a = k * 0.32, rr = 2 + k * 0.6;
      ctx.lineTo(cx + sx * (92 + Math.cos(a) * rr), 110 + Math.sin(a) * rr);
    }
    ctx.stroke();
    // dots
    ctx.fillStyle = swirls;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx + sx * (70 + k * 10), 200, 4, 0, TAU); ctx.fill(); }
  }
  for (const e of extra) e(ctx);
  // the name on the forehead
  if (name) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 64, 18, 128, 28);
    ctx.strokeStyle = PAL.rosa;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 64, 18, 128, 28);
    ctx.fillStyle = '#7b3fbf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fs = 22;
    ctx.font = `${fs}px 'Lilita One', sans-serif`;
    while (ctx.measureText(name).width > 118 && fs > 9) { fs--; ctx.font = `${fs}px 'Lilita One', sans-serif`; }
    ctx.fillText(name, cx, 33);
  }
  return cv;
}

export function fruitBasket({ seed = 5 } = {}) {
  const g = new THREE.Group();
  const bowl = lathe([[0, 0], [0.09, 0], [0.14, 0.05], [0.15, 0.07], [0, 0.07]], toon('#c9a063'));
  g.add(bowl);
  const r = rng(seed);
  const kinds = [['#ff8c1a', 0.032], ['#ffb02e', 0.018], ['#f5c542', 0.018], ['#9cc34a', 0.026], ['#ff8c1a', 0.032]];
  for (let i = 0; i < 11; i++) {
    const [c, rad] = kinds[i % kinds.length];
    const f = sphere(rad, toon(c), 12);
    const a = r() * TAU, d = r() * 0.08;
    f.position.set(Math.cos(a) * d, 0.07 + rad * 0.8 + (i > 6 ? 0.03 : 0), Math.sin(a) * d);
    g.add(f);
    if (rad > 0.03) {
      const leaf = sphere(0.01, toon('#3b8a3c'), 6);
      leaf.scale.set(1.5, 0.4, 0.8);
      leaf.position.set(f.position.x, f.position.y + rad, f.position.z);
      g.add(leaf);
    }
  }
  // a stick of sugarcane leaning across
  const cane = cyl(0.012, 0.012, 0.3, toon('#8fb04a'), 8);
  cane.rotation.z = 1.1;
  cane.position.set(0, 0.13, -0.04);
  g.add(cane);
  for (let k = -2; k <= 2; k++) {
    const node = cyl(0.014, 0.014, 0.008, toon('#6c8a32'), 8);
    node.rotation.z = 1.1;
    node.position.set(Math.cos(1.1 - Math.PI / 2) * k * 0.055, 0.13 + Math.sin(1.1 - Math.PI / 2) * k * 0.055, -0.04);
    g.add(node);
  }
  return g;
}

export function sugarcane() {
  // tall stalks of caña, often tied into an arch
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = cyl(0.016, 0.016, 0.7, toon(i % 2 ? '#8fb04a' : '#a9b84e'), 8);
    c.position.set((i - 1) * 0.04, 0.35, 0);
    c.rotation.z = (i - 1) * 0.05;
    g.add(c);
    for (let k = 0; k < 6; k++) {
      const n = cyl(0.018, 0.018, 0.01, toon('#6c8a32'), 8);
      n.position.set((i - 1) * 0.04, 0.08 + k * 0.11, 0);
      g.add(n);
    }
  }
  return g;
}

function plate(color = '#ffffff', rim = PAL.cobalt, r = 0.11) {
  const g = new THREE.Group();
  const p = lathe([[0, 0], [r * 0.6, 0], [r, 0.02], [r * 1.02, 0.025], [0, 0.025]], toon(color));
  g.add(p);
  const ring = mesh(new THREE.TorusGeometry(r * 0.92, 0.006, 4, 28), toon(rim), { cast: false });
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.022;
  g.add(ring);
  return g;
}

export function mole() {
  const g = plate('#f6efdc', '#2a6fb5', 0.12);
  const sauce = sphere(0.085, toon('#4a2018'), 18);
  sauce.scale.set(1, 0.18, 1);
  sauce.position.y = 0.028;
  g.add(sauce);
  const chicken = sphere(0.04, toon('#7b3a24'), 10);
  chicken.scale.set(1.2, 0.6, 0.8);
  chicken.position.set(-0.02, 0.04, 0);
  g.add(chicken);
  const rice = sphere(0.045, toon('#f6c977'), 10);
  rice.scale.set(1, 0.45, 0.8);
  rice.position.set(0.06, 0.035, 0.03);
  g.add(rice);
  const r = rng(2);
  for (let i = 0; i < 20; i++) {
    const sd = sphere(0.004, toon('#f4e2b6'), 4);
    sd.position.set((r() - 0.5) * 0.12, 0.046, (r() - 0.5) * 0.1);
    g.add(sd);
  }
  return g;
}

export function tamales() {
  const g = plate('#fbf4e4', PAL.rosa, 0.12);
  const husk = toon('#e6cf8f');
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Group();
    const body = sphere(0.035, husk, 12);
    body.scale.set(0.9, 0.55, 2.0);
    t.add(body);
    const masa = sphere(0.025, toon('#f7dd8e'), 10);
    masa.scale.set(0.9, 0.6, 1.6);
    masa.position.y = 0.012;
    t.add(masa);
    t.position.set((i - 1) * 0.06, 0.035 + (i === 1 ? 0.02 : 0), 0);
    t.rotation.y = 0.2 * (i - 1);
    g.add(t);
  }
  return g;
}

export function hotChocolate() {
  const g = new THREE.Group();
  const clay = toon('#a8552f');
  const mug = lathe([[0, 0], [0.04, 0], [0.05, 0.05], [0.048, 0.09], [0.052, 0.095], [0, 0.095]], clay);
  g.add(mug);
  const handle = mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI * 1.2), clay);
  handle.position.set(0.055, 0.05, 0);
  handle.rotation.z = -Math.PI / 2;
  g.add(handle);
  const foam = sphere(0.047, toon('#d9a77a'), 14);
  foam.scale.y = 0.3;
  foam.position.y = 0.093;
  g.add(foam);
  const band = mesh(new THREE.TorusGeometry(0.049, 0.004, 4, 20), toon(PAL.cream), { cast: false });
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.06;
  g.add(band);
  // tablet of Mexican chocolate leaning beside it
  const tab = cyl(0.04, 0.04, 0.015, toon('#5a2d1a'), 8);
  tab.rotation.x = Math.PI / 2 - 0.4;
  tab.position.set(-0.07, 0.035, 0.01);
  g.add(tab);
  return g;
}

export function cafeDeOlla() {
  const g = new THREE.Group();
  const clay = toon('#b4673c');
  const olla = lathe([[0, 0], [0.04, 0], [0.065, 0.05], [0.055, 0.1], [0.04, 0.11], [0.045, 0.12], [0, 0.12]], clay);
  g.add(olla);
  for (const sx of [-1, 1]) {
    const h = mesh(new THREE.TorusGeometry(0.018, 0.006, 6, 10, Math.PI), clay);
    h.position.set(sx * 0.06, 0.09, 0);
    h.rotation.set(0, sx > 0 ? 0 : Math.PI, -Math.PI / 2);
    g.add(h);
  }
  const cinn = cyl(0.006, 0.006, 0.09, toon('#8a4b2a'), 6);
  cinn.position.set(0.02, 0.14, 0);
  cinn.rotation.z = 0.4;
  g.add(cinn);
  return g;
}

export function calabazaEnTacha() {
  const g = plate('#fbf4e4', PAL.marigold, 0.11);
  const m = toon('#c7531c');
  for (let i = 0; i < 4; i++) {
    const p = sphere(0.04, m, 10);
    p.scale.set(1.3, 0.55, 0.8);
    p.position.set((i % 2 - 0.5) * 0.08, 0.04 + Math.floor(i / 2) * 0.02, (Math.floor(i / 2) - 0.5) * 0.05);
    p.rotation.y = i;
    g.add(p);
  }
  const syrup = sphere(0.09, toon('#7a3010', { transparent: true, opacity: 0.6 }), 14);
  syrup.scale.y = 0.08;
  syrup.position.y = 0.026;
  g.add(syrup);
  return g;
}

export function atole() {
  const g = new THREE.Group();
  const clay = toon('#c9814d');
  const j = lathe([[0, 0], [0.035, 0], [0.05, 0.05], [0.042, 0.1], [0.046, 0.105], [0, 0.105]], clay);
  g.add(j);
  const top = sphere(0.04, toon('#f0dcc0'), 12);
  top.scale.y = 0.25;
  top.position.y = 0.1;
  g.add(top);
  return g;
}

// ------------------------------------------------------------------ remembrance
// photo frame; portrait is a canvas or data URL image
export function photoFrame({ canvas = null, color = '#7a4a2a', w = 0.2, h = 0.26, ornate = true } = {}) {
  const g = new THREE.Group();
  const fm = toon(color);
  const back = rbox(w + 0.05, h + 0.05, 0.025, 0.012, fm);
  back.position.y = (h + 0.05) / 2;
  g.add(back);
  const pic = mesh(new THREE.PlaneGeometry(w, h), toon('#ffffff', { map: canvas ? tex(canvas) : null, rim: 0 }), { cast: false });
  pic.position.set(0, (h + 0.05) / 2, 0.014);
  pic.userData.noOutline = true;
  g.add(pic);
  g.userData.pic = pic;
  if (ornate) {
    const gold = toon(PAL.gold);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const c = sphere(0.014, gold, 8);
      c.position.set(x * (w / 2 + 0.012), (h + 0.05) / 2 + y * (h / 2 + 0.012), 0.016);
      g.add(c);
    }
  }
  const stand = box(0.02, h * 0.8, 0.02, fm);
  stand.position.set(0, h * 0.4, -0.05);
  stand.rotation.x = -0.35;
  g.add(stand);
  g.rotation.x = -0.08;
  g.userData.setPicture = (cv) => {
    pic.material.map?.dispose();
    pic.material.map = tex(cv);
    pic.material.needsUpdate = true;
  };
  return g;
}

export function cross({ marigold = true } = {}) {
  const g = new THREE.Group();
  const m = toon('#6e4127');
  const v = box(0.03, 0.3, 0.03, m);
  v.position.y = 0.15;
  const hz = box(0.17, 0.03, 0.03, m);
  hz.position.y = 0.21;
  g.add(v, hz);
  if (marigold) {
    const spots = [];
    for (let i = 0; i < 9; i++) spots.push([0, 0.03 + i * 0.03, 0.022, 0.016]);
    for (let i = -2; i <= 2; i++) if (i) spots.push([i * 0.03, 0.21, 0.022, 0.016]);
    g.add(marigolds(spots, { seed: 12 }));
  }
  const base = box(0.1, 0.03, 0.06, m);
  base.position.y = 0.015;
  g.add(base);
  return g;
}

export function xoloFigure() {
  // little clay Xoloitzcuintle in the style of the Colima ceramic dogs
  const g = new THREE.Group();
  const clay = toon('#b8582d');
  const body = sphere(0.055, clay, 16);
  body.scale.set(0.8, 0.7, 1.3);
  body.position.y = 0.075;
  g.add(body);
  for (const [x, z] of [[0.03, 0.045], [-0.03, 0.045], [0.03, -0.045], [-0.03, -0.045]]) {
    const leg = cyl(0.013, 0.011, 0.055, clay, 6);
    leg.position.set(x, 0.027, z);
    g.add(leg);
  }
  const head = sphere(0.035, clay, 14);
  head.position.set(0, 0.125, 0.065);
  g.add(head);
  const snout = sphere(0.02, clay, 10);
  snout.scale.set(1, 0.8, 1.4);
  snout.position.set(0, 0.115, 0.098);
  g.add(snout);
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.015, 0.04, 8), clay);
    ear.position.set(sx * 0.02, 0.16, 0.06);
    ear.rotation.z = -sx * 0.25;
    g.add(ear);
    const eye = sphere(0.005, toon('#2a1a10'), 6);
    eye.position.set(sx * 0.014, 0.13, 0.093);
    g.add(eye);
  }
  const tail = cyl(0.006, 0.004, 0.05, clay, 5);
  tail.position.set(0, 0.1, -0.085);
  tail.rotation.x = -0.8;
  g.add(tail);
  return g;
}

export function toys() {
  const g = new THREE.Group();
  // trompo (spinning top)
  const trompo = lathe([[0, 0], [0.004, 0.005], [0.03, 0.04], [0.032, 0.05], [0.02, 0.065], [0.006, 0.07], [0, 0.07]], toon(PAL.red));
  const band = mesh(new THREE.TorusGeometry(0.031, 0.004, 4, 16), toon(PAL.gold), { cast: false });
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.045;
  trompo.add(band);
  trompo.position.set(-0.06, 0, 0);
  trompo.rotation.z = 0.2;
  g.add(trompo);
  // balero (cup-and-ball)
  const bal = new THREE.Group();
  const stick = cyl(0.006, 0.006, 0.1, toon('#d8b07a'), 6);
  stick.position.y = 0.05;
  bal.add(stick);
  const barrel = cyl(0.025, 0.025, 0.045, toon(PAL.turquoise), 12);
  barrel.position.y = 0.11;
  bal.add(barrel);
  const stripe = cyl(0.026, 0.026, 0.01, toon(PAL.rosa), 12);
  stripe.position.y = 0.11;
  bal.add(stripe);
  bal.position.set(0.05, 0, 0);
  bal.rotation.z = -0.3;
  g.add(bal);
  // a little ball
  const ball = sphere(0.025, toon(PAL.lime), 12);
  ball.position.set(0, 0.025, 0.05);
  g.add(ball);
  return g;
}

export function guitar() {
  const g = new THREE.Group();
  const wood = toon('#d99a52');
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.17);
  shape.bezierCurveTo(0.12, -0.17, 0.13, -0.06, 0.07, -0.02);
  shape.bezierCurveTo(0.1, 0.03, 0.1, 0.1, 0, 0.1);
  shape.bezierCurveTo(-0.1, 0.1, -0.1, 0.03, -0.07, -0.02);
  shape.bezierCurveTo(-0.13, -0.06, -0.12, -0.17, 0, -0.17);
  const body = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }), wood);
  g.add(body);
  const hole = mesh(new THREE.CircleGeometry(0.03, 16), flat('#2a1a10'), { cast: false });
  hole.position.set(0, 0.0, 0.06);
  g.add(hole);
  const rosette = mesh(new THREE.TorusGeometry(0.036, 0.004, 4, 20), toon(PAL.turquoise), { cast: false });
  rosette.position.set(0, 0, 0.06);
  g.add(rosette);
  const neck = box(0.035, 0.26, 0.02, toon('#7a4a2a'));
  neck.position.set(0, 0.23, 0.035);
  g.add(neck);
  const headstock = box(0.05, 0.07, 0.02, toon('#5a3420'));
  headstock.position.set(0, 0.39, 0.033);
  g.add(headstock);
  const bridge = box(0.07, 0.012, 0.01, toon('#5a3420'));
  bridge.position.set(0, -0.09, 0.062);
  g.add(bridge);
  for (let i = 0; i < 6; i++) {
    const st = box(0.0015, 0.47, 0.002, toon('#eeeeee', { rim: 0 }));
    st.position.set(-0.0125 + i * 0.005, 0.14, 0.064);
    st.userData.noOutline = true;
    g.add(st);
  }
  g.rotation.z = 0.25;
  g.position.y = 0.18;
  return G(g);
}

export function flatCap({ color = '#5b6b7a' } = {}) {
  // Abuelo's gorra
  const g = new THREE.Group();
  const m = toon(color);
  const crown = sphere(0.1, m, 20);
  crown.scale.set(1, 0.38, 1.1);
  crown.position.y = 0.035;
  g.add(crown);
  const bill = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 18, 1, false, -Math.PI / 2, Math.PI), toon(shade(color, -20)));
  bill.scale.set(1.2, 1, 0.8);
  bill.position.set(0, 0.02, 0.09);
  bill.rotation.x = 0.15;
  g.add(bill);
  const button = sphere(0.008, m, 6);
  button.position.y = 0.074;
  g.add(button);
  return g;
}

export function dominoes() {
  const g = new THREE.Group();
  const boxM = toon('#2357d1');
  const bx = box(0.16, 0.035, 0.08, boxM);
  bx.position.set(0.02, 0.0175, -0.02);
  g.add(bx);
  const r = rng(9);
  for (let i = 0; i < 4; i++) {
    const tile = rbox(0.03, 0.06, 0.012, 0.004, toon('#fbf6ea'));
    tile.rotation.set(-Math.PI / 2, 0, r() * 0.8 - 0.4);
    tile.position.set(-0.08 + i * 0.045, 0.006, 0.05 + (r() - 0.5) * 0.02);
    g.add(tile);
    for (let k = 0; k < 3; k++) {
      const dot = sphere(0.0035, toon('#1a1a1a'), 5);
      dot.position.set(tile.position.x + (k - 1) * 0.007, 0.0135, tile.position.z + (k - 1) * 0.012);
      g.add(dot);
    }
  }
  return g;
}

export function eyeglasses() {
  const g = new THREE.Group();
  const m = toon('#4a3020');
  for (const sx of [-1, 1]) {
    const l = mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 18), m);
    l.position.set(sx * 0.027, 0.022, 0);
    g.add(l);
    const arm = box(0.003, 0.003, 0.07, m);
    arm.position.set(sx * 0.048, 0.022, -0.035);
    g.add(arm);
  }
  const bridge = box(0.012, 0.003, 0.003, m);
  bridge.position.y = 0.026;
  g.add(bridge);
  g.rotation.x = -0.3;
  return g;
}

export function book({ color = PAL.purple, title = '' } = {}) {
  const g = new THREE.Group();
  const cover = rbox(0.14, 0.03, 0.19, 0.005, toon(color));
  cover.position.y = 0.015;
  g.add(cover);
  const pages = box(0.13, 0.024, 0.18, toon('#fbf6ea'));
  pages.position.set(0.004, 0.015, 0);
  g.add(pages);
  if (title) g.userData.title = title;
  return g;
}

export function papelBanner({ customs = null, w = 1.0 } = {}) {
  const s = papelString([-w / 2, 0, 0], [w / 2, 0, 0], { sheetW: 0.2, sag: 0.05, customs, seed: 3 });
  return s;
}

// marigold arch (arco) that frames the ofrenda: the doorway between worlds
export function marigoldArch({ w = 1.5, h = 1.9 } = {}) {
  const g = new THREE.Group();
  const spots = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = Math.PI * t;
    const x = -Math.cos(a) * w / 2;
    const y = Math.sin(a) * (h - 1.0) + 1.0 * Math.min(1, Math.sin(a) * 3);
    spots.push([x, y, 0, 0.055]);
    if (i % 2) spots.push([x * 0.97, y - 0.04, 0.04, 0.045]);
  }
  for (let i = 0; i < 18; i++) {
    for (const sx of [-1, 1]) spots.push([sx * w / 2, i * 0.055, 0, 0.055]);
  }
  g.add(marigolds(spots, { seed: 21 }));
  // the reed frame behind the flowers follows the arch only
  const archPts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (i / 24);
    archPts.push(new THREE.Vector3(-Math.cos(a) * w / 2, Math.sin(a) * (h - 1.0) + 1.0 * Math.min(1, Math.sin(a) * 3), -0.03));
  }
  const reed = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts), 40, 0.012, 5), toon('#6c8a32'));
  g.add(reed);
  return g;
}

export function petate({ w = 1.4, d = 0.9 } = {}) {
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d8b878';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      ctx.fillStyle = (x / 8 + y / 8) % 2 ? '#c9a463' : '#e3c78c';
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = 'rgba(120,80,30,0.25)';
      ctx.fillRect(x, y + ((x / 8) % 2 ? 0 : 7), 8, 1);
    }
  }
  const m = toon('#ffffff', { map: tex(cv, { repeat: [3, 2] }), rim: 0 });
  const p = box(w, 0.012, d, m);
  p.position.y = 0.006;
  p.receiveShadow = true;
  p.castShadow = false;
  return G(p);
}

export function washbasin() {
  // some families leave a basin, soap, towel and mirror so visitors can freshen up
  const g = new THREE.Group();
  const basin = lathe([[0, 0], [0.08, 0], [0.12, 0.05], [0.125, 0.055], [0, 0.055]], toon('#2a6fb5'));
  g.add(basin);
  const water = cyl(0.11, 0.11, 0.005, toon('#8fd3f2'), 18);
  water.position.y = 0.045;
  g.add(water);
  const soap = rbox(0.05, 0.02, 0.035, 0.008, toon('#f7c6d9'));
  soap.position.set(0.15, 0.01, 0.02);
  g.add(soap);
  const towel = box(0.12, 0.012, 0.08, toon('#ffffff', { map: towelTex() }));
  towel.position.set(-0.17, 0.006, 0.02);
  g.add(towel);
  const mirror = new THREE.Group();
  const frame = cyl(0.06, 0.06, 0.012, toon(PAL.gold), 20);
  frame.rotation.x = Math.PI / 2;
  mirror.add(frame);
  const glass = mesh(new THREE.CircleGeometry(0.05, 20), toon('#cfe8ff'), { cast: false });
  glass.position.z = 0.007;
  mirror.add(glass);
  mirror.position.set(0, 0.07, -0.13);
  mirror.rotation.x = -0.2;
  g.add(mirror);
  return g;
}

function towelTex() {
  const cv = mkCanvas(32, 32);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = PAL.rosa;
  ctx.fillRect(0, 4, 32, 3);
  ctx.fillRect(0, 25, 32, 3);
  return tex(cv);
}

export function catrinaFigure() {
  // clay Catrina: an elegant skeleton lady in a big flowered hat
  const g = new THREE.Group();
  const dress = cyl(0.02, 0.07, 0.17, toon(PAL.purple), 16);
  dress.position.y = 0.085;
  g.add(dress);
  const ruffle = mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 20), toon(PAL.rosa));
  ruffle.rotation.x = Math.PI / 2;
  ruffle.position.y = 0.012;
  g.add(ruffle);
  const bone = toon('#fbf6ea');
  const head = sphere(0.032, bone, 14);
  head.scale.set(0.9, 1, 0.9);
  head.position.y = 0.205;
  g.add(head);
  for (const sx of [-1, 1]) {
    const eye = sphere(0.009, toon('#1a1a1a'), 6);
    eye.position.set(sx * 0.011, 0.21, 0.025);
    g.add(eye);
    const arm = cyl(0.005, 0.005, 0.08, bone, 4);
    arm.position.set(sx * 0.03, 0.13, 0.012);
    arm.rotation.z = sx * 0.4;
    g.add(arm);
  }
  const hat = cyl(0.075, 0.075, 0.008, toon('#2a1a30'), 18);
  hat.position.y = 0.232;
  hat.rotation.x = -0.2;
  g.add(hat);
  const crown = cyl(0.03, 0.035, 0.03, toon('#2a1a30'), 12);
  crown.position.y = 0.25;
  g.add(crown);
  for (let i = 0; i < 5; i++) {
    const f = sphere(0.013, toon([PAL.rosa, PAL.marigold, PAL.turquoise][i % 3]), 6);
    const a = (i / 5) * Math.PI - Math.PI / 2;
    f.position.set(Math.cos(a) * 0.045, 0.245, Math.sin(a) * 0.045 * 0.3 + 0.02);
    g.add(f);
  }
  const feather = sphere(0.02, toon(PAL.lime), 8);
  feather.scale.set(0.4, 1.8, 0.4);
  feather.position.set(-0.03, 0.28, -0.01);
  feather.rotation.z = 0.5;
  g.add(feather);
  return g;
}

export function alebrije() {
  // a small fantastical creature, painted in every color
  const g = new THREE.Group();
  const body = sphere(0.05, toon(PAL.turquoise), 14);
  body.scale.set(0.8, 0.75, 1.4);
  body.position.y = 0.08;
  g.add(body);
  const spots = [PAL.rosa, PAL.gold, PAL.purple, PAL.lime];
  for (let i = 0; i < 8; i++) {
    const s = sphere(0.012, toon(spots[i % 4]), 6);
    s.position.set(Math.sin(i) * 0.035, 0.1 + Math.cos(i * 2) * 0.015, (i / 8 - 0.5) * 0.11);
    g.add(s);
  }
  const head = sphere(0.035, toon(PAL.rosa), 12);
  head.position.set(0, 0.13, 0.08);
  g.add(head);
  for (const sx of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(0.008, 0.05, 6), toon(PAL.gold));
    horn.position.set(sx * 0.018, 0.17, 0.075);
    horn.rotation.z = -sx * 0.4;
    g.add(horn);
    const wing = sphere(0.04, toon(PAL.purple), 10);
    wing.scale.set(0.15, 0.7, 1);
    wing.position.set(sx * 0.05, 0.12, -0.01);
    wing.rotation.z = sx * 0.5;
    g.add(wing);
    const eye = sphere(0.008, toon('#ffffff'), 6);
    eye.position.set(sx * 0.014, 0.14, 0.108);
    g.add(eye);
  }
  for (const [x, z] of [[0.025, 0.04], [-0.025, 0.04], [0.025, -0.04], [-0.025, -0.04]]) {
    const leg = cyl(0.008, 0.008, 0.05, toon(PAL.orange), 6);
    leg.position.set(x, 0.025, z);
    g.add(leg);
  }
  const tail = tube([[0, 0.09, -0.06], [0, 0.13, -0.11], [0, 0.17, -0.09]], 0.007, toon(PAL.lime), 8);
  g.add(tail);
  return g;
}

export function monarch({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const wingTex = (() => {
    const cv = mkCanvas(64, 64);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#1a1210';
    ctx.beginPath(); ctx.ellipse(32, 32, 31, 31, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8a14';
    ctx.beginPath(); ctx.ellipse(32, 32, 25, 25, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a1210';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(4, 32); ctx.lineTo(32 + Math.cos(i - 2.5) * 30, 32 + Math.sin(i - 2.5) * 30); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(32 + Math.cos(i * 0.6 - 1.5) * 28, 32 + Math.sin(i * 0.6 - 1.5) * 28, 1.6, 0, TAU); ctx.fill(); }
    return tex(cv);
  })();
  const wm = new THREE.MeshBasicMaterial({ map: wingTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  const wings = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.06 * scale, 0.07 * scale), wm);
    w.position.x = sx * 0.032 * scale;
    w.raycast = () => {};
    pivot.add(w);
    g.add(pivot);
    wings.push({ pivot, sx });
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.004 * scale, 0.04 * scale, 2, 6), new THREE.MeshBasicMaterial({ color: '#1a1210' }));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  g.userData.phase = Math.random() * 10;
  g.userData.update = (t) => {
    const f = Math.sin(t * 16 + g.userData.phase) * 0.9;
    for (const w of wings) w.pivot.rotation.z = w.sx * f;
  };
  return g;
}

// ------------------------------------------------------------------ free-mode favorites
export function pizza() {
  const g = plate('#ffffff', PAL.red, 0.1);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.09, 0.05);
  shape.quadraticCurveTo(0.1, 0, 0.09, -0.05);
  shape.lineTo(0, 0);
  const slice = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }), toon('#f2c14e'));
  slice.rotation.x = -Math.PI / 2;
  slice.position.set(-0.045, 0.028, 0);
  g.add(slice);
  for (const [x, z] of [[0.0, 0.0], [0.025, 0.012], [0.02, -0.015]]) {
    const pep = cyl(0.009, 0.009, 0.004, toon('#c0392b'), 10);
    pep.position.set(x, 0.042, z);
    g.add(pep);
  }
  return g;
}

export function soda({ color = '#5a1a12', label = PAL.red } = {}) {
  const g = new THREE.Group();
  const bottle = lathe([[0, 0], [0.03, 0], [0.032, 0.1], [0.022, 0.14], [0.012, 0.18], [0.013, 0.2], [0, 0.2]], toon(color, { transparent: true, opacity: 0.85 }));
  g.add(bottle);
  const lab = cyl(0.033, 0.033, 0.04, toon(label), 14);
  lab.position.y = 0.06;
  g.add(lab);
  const cap = cyl(0.014, 0.014, 0.012, toon('#d9d9d9'), 10);
  cap.position.y = 0.205;
  g.add(cap);
  return g;
}

export function cookies() {
  const g = plate('#ffffff', PAL.turquoise, 0.09);
  for (let i = 0; i < 4; i++) {
    const c = cyl(0.03, 0.03, 0.012, toon('#d39b55'), 14);
    c.position.set((i % 2 - 0.5) * 0.06, 0.03 + Math.floor(i / 2) * 0.012, (Math.floor(i / 2) - 0.5) * 0.04);
    g.add(c);
    for (let k = 0; k < 3; k++) {
      const chip = sphere(0.005, toon('#4a2a18'), 4);
      chip.position.set(c.position.x + (k - 1) * 0.012, c.position.y + 0.007, c.position.z + Math.sin(k) * 0.01);
      g.add(chip);
    }
  }
  return g;
}

export function dogBowl() {
  const g = new THREE.Group();
  const bowl = lathe([[0, 0], [0.07, 0], [0.09, 0.045], [0.06, 0.045], [0.055, 0.015], [0, 0.015]], toon(PAL.red));
  g.add(bowl);
  for (let i = 0; i < 9; i++) {
    const k = sphere(0.01, toon('#8a5a33'), 5);
    k.position.set((Math.sin(i * 2) * 0.03), 0.025, Math.cos(i * 3) * 0.03);
    g.add(k);
  }
  const ball = sphere(0.035, toon(PAL.lime), 14);
  ball.position.set(0.12, 0.035, 0.03);
  g.add(ball);
  const seam = mesh(new THREE.TorusGeometry(0.035, 0.003, 4, 20), toon('#ffffff'), { cast: false });
  seam.position.copy(ball.position);
  seam.rotation.x = 0.6;
  g.add(seam);
  return g;
}

export function soccerBall() {
  const g = new THREE.Group();
  const cv = mkCanvas(128, 64);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const x = (i * 37) % 128, y = 14 + (i % 3) * 18;
    for (let k = 0; k < 5; k++) ctx.lineTo(x + Math.cos((k / 5) * TAU) * 7, y + Math.sin((k / 5) * TAU) * 7);
    ctx.fill();
  }
  const b = sphere(0.06, toon('#ffffff', { map: tex(cv) }), 20);
  b.position.y = 0.06;
  g.add(b);
  return g;
}

export function radio() {
  const g = new THREE.Group();
  const body = rbox(0.18, 0.11, 0.07, 0.02, toon(PAL.turquoise));
  body.position.y = 0.055;
  g.add(body);
  const grill = cyl(0.035, 0.035, 0.01, toon('#3a3a3a'), 16);
  grill.rotation.x = Math.PI / 2;
  grill.position.set(-0.04, 0.055, 0.038);
  g.add(grill);
  for (let i = 0; i < 2; i++) {
    const knob = cyl(0.012, 0.012, 0.012, toon(PAL.cream), 10);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.045 + i * 0.03, 0.055, 0.038);
    g.add(knob);
  }
  const ant = cyl(0.003, 0.003, 0.15, toon('#bbbbbb'), 4);
  ant.position.set(0.06, 0.18, 0);
  ant.rotation.z = -0.4;
  g.add(ant);
  return g;
}

export function drawing({ canvas = null } = {}) {
  // a child's crayon drawing, propped up
  const g = new THREE.Group();
  const cv = canvas || (() => {
    const c = mkCanvas(128, 96);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(0, 0, 128, 96);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#d8293b';
    ctx.beginPath(); ctx.arc(64, 34, 16, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#2357d1';
    ctx.beginPath(); ctx.moveTo(64, 50); ctx.lineTo(64, 76); ctx.moveTo(48, 60); ctx.lineTo(80, 60); ctx.moveTo(64, 76); ctx.lineTo(54, 92); ctx.moveTo(64, 76); ctx.lineTo(74, 92); ctx.stroke();
    ctx.fillStyle = '#ff9a0d';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(14 + i * 20, 88, 6, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#3e9b4f';
    ctx.beginPath(); ctx.moveTo(96, 50); ctx.lineTo(112, 30); ctx.stroke();
    ctx.fillStyle = '#7b3fbf';
    ctx.font = "14px 'Lilita One', sans-serif";
    ctx.fillText('ABUELO', 6, 16);
    return c;
  })();
  const paper = mesh(new THREE.PlaneGeometry(0.17, 0.13), toon('#ffffff', { map: tex(cv), side: THREE.DoubleSide, rim: 0 }), { cast: false });
  paper.position.y = 0.07;
  paper.rotation.x = -0.25;
  paper.userData.noOutline = true;
  g.add(paper);
  return g;
}

// ------------------------------------------------------------------ catalog
// element: which of the four natural elements an item represents on the ofrenda
export const PROP_INFO = {
  foto: { es: 'La foto', en: 'Photo of your loved one', make: (o) => photoFrame(o), card: 'foto' },
  cempasuchil: { es: 'Cempasúchil', en: 'Marigold flowers', make: (o) => marigoldVase(o), card: 'cempasuchil', element: 'earth' },
  terciopelo: { es: 'Terciopelo', en: 'Cockscomb flowers', make: () => cockscombVase(), card: 'terciopelo', element: 'earth' },
  nube: { es: 'Nube', en: "Baby's breath flowers", make: () => nubeVase(), card: 'nube', element: 'earth' },
  vela: { es: 'Veladoras', en: 'Candles', make: (o) => veladora(o), card: 'velas', element: 'fire' },
  cirio: { es: 'Cirio', en: 'Tall candle', make: (o) => cirio(o), card: 'velas', element: 'fire' },
  copal: { es: 'Copal', en: 'Copal incense', make: (o) => copalBurner(o), card: 'copal', element: 'wind' },
  agua: { es: 'Agua', en: 'A glass of water', make: () => waterGlass(), card: 'agua', element: 'water' },
  jarrito: { es: 'Jarrito de agua', en: 'Clay cup of water', make: () => jarrito(), card: 'agua', element: 'water' },
  sal: { es: 'Sal', en: 'Salt', make: () => saltDish(), card: 'sal' },
  pan: { es: 'Pan de muerto', en: 'Bread of the dead', make: (o) => panDeMuerto(o), card: 'pan', element: 'earth' },
  calavera: { es: 'Calavera de azúcar', en: 'Sugar skull', make: (o) => sugarSkull(o), card: 'calavera' },
  fruta: { es: 'Fruta', en: 'Fruit: oranges, tejocotes, guavas', make: () => fruitBasket(), card: 'fruta', element: 'earth' },
  cana: { es: 'Caña', en: 'Sugarcane', make: () => sugarcane(), card: 'fruta', element: 'earth' },
  mole: { es: 'Mole', en: 'Mole with rice', make: () => mole(), card: 'mole', element: 'earth' },
  tamales: { es: 'Tamales', en: 'Tamales', make: () => tamales(), card: 'tamales', element: 'earth' },
  chocolate: { es: 'Chocolate caliente', en: 'Hot chocolate', make: () => hotChocolate(), card: 'bebidas', element: 'earth' },
  cafe: { es: 'Café de olla', en: 'Clay-pot coffee', make: () => cafeDeOlla(), card: 'bebidas', element: 'earth' },
  atole: { es: 'Atole', en: 'Atole (warm corn drink)', make: () => atole(), card: 'bebidas', element: 'earth' },
  calabaza: { es: 'Calabaza en tacha', en: 'Candied pumpkin', make: () => calabazaEnTacha(), card: 'calabaza', element: 'earth' },
  cruz: { es: 'La cruz', en: 'A cross', make: () => cross(), card: 'cruz' },
  xolo: { es: 'Xoloitzcuintle', en: 'Clay Xolo dog', make: () => xoloFigure(), card: 'xolo' },
  juguetes: { es: 'Juguetes', en: 'Toys for the angelitos', make: () => toys(), card: 'juguetes' },
  guitarra: { es: 'La guitarra', en: "Abuelo's guitar", make: () => guitar(), card: 'personales' },
  gorra: { es: 'Su gorra', en: "Abuelo's flat cap", make: () => flatCap(), card: 'personales' },
  domino: { es: 'Dominó', en: "Abuelo's dominoes", make: () => dominoes(), card: 'personales' },
  lentes: { es: 'Sus lentes', en: 'His eyeglasses', make: () => eyeglasses(), card: 'personales' },
  libro: { es: 'Un libro', en: 'A favorite book', make: () => book(), card: 'personales' },
  papel: { es: 'Papel picado', en: 'Cut-paper banners', make: (o) => papelBanner(o), card: 'papel', element: 'wind' },
  arco: { es: 'El arco', en: 'Marigold arch', make: (o) => marigoldArch(o), card: 'arco' },
  petate: { es: 'Petate', en: 'Woven palm mat', make: () => petate(), card: 'petate' },
  lavamanos: { es: 'Agua, jabón y toalla', en: 'Basin, soap, towel and mirror', make: () => washbasin(), card: 'lavamanos', element: 'water' },
  catrina: { es: 'Catrina', en: 'Clay Catrina figure', make: () => catrinaFigure(), card: 'catrina' },
  alebrije: { es: 'Alebrije', en: 'Alebrije', make: () => alebrije(), card: 'alebrije' },
  dibujo: { es: 'Mi dibujo', en: 'Your drawing', make: (o) => drawing(o), card: 'personales' },
  mariposa: { es: 'Mariposa monarca', en: 'Monarch butterfly', make: () => monarch({ scale: 2 }), card: 'monarca' },
  pizza: { es: 'Pizza', en: 'Pizza (a favorite food!)', make: () => pizza(), card: 'favoritos', element: 'earth' },
  refresco: { es: 'Refresco', en: 'A favorite soda', make: () => soda(), card: 'favoritos', element: 'earth' },
  galletas: { es: 'Galletas', en: 'Cookies', make: () => cookies(), card: 'favoritos', element: 'earth' },
  plato: { es: 'Su platito', en: "A pet's bowl and ball", make: () => dogBowl(), card: 'mascotas' },
  balon: { es: 'Balón', en: 'Soccer ball', make: () => soccerBall(), card: 'favoritos' },
  radio: { es: 'Radio', en: 'Their favorite music', make: () => radio(), card: 'favoritos' },
};

export function makeProp(id, opts = {}) {
  const info = PROP_INFO[id];
  if (!info) throw new Error(`unknown prop ${id}`);
  const g = info.make(opts);
  g.userData.propId = id;
  mergeByParent(g);
  if (!opts.noOutline) outline(g, 0.004);
  return g;
}
