// Stadiums: field, stands with an instanced crowd, lights, dome, scoreboard, and planet-themed surroundings.
import * as THREE from '../../vendor/three.module.js';
import { fieldTexture, skyTexture, planetTexture, FIELD, canvas, gradientMap } from './textures.js';
import { toonMat } from './character.js';
import { buildRocket } from './space.js';
import { makeRng, hashStr, shade, mix, rgba, hsl, clamp } from '../util.js';

const SIZES = {
  backyard: { rows: 0, ends: 0, upper: 0, crowd: 0, towers: 0 },
  small: { rows: 4, ends: 0, upper: 0, crowd: 380, towers: 2 },
  medium: { rows: 9, ends: 5, upper: 0, crowd: 1300, towers: 4 },
  large: { rows: 13, ends: 9, upper: 0, crowd: 2600, towers: 4 },
  mega: { rows: 12, ends: 10, upper: 9, crowd: 4200, towers: 6 },
};
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);

export function buildUFO(radius = 6) {
  const g = new THREE.Group();
  const disc = M(cyl(radius, radius * 0.6, radius * 0.3, 40), toonMat('#8a95a5')); g.add(disc);
  const rim = M(new THREE.TorusGeometry(radius * 0.98, radius * 0.07, 10, 48), toonMat('#5a6575')); rim.rotation.x = Math.PI / 2; rim.position.y = radius * 0.08; g.add(rim);
  const dome = M(new THREE.SphereGeometry(radius * 0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toonMat('#7fffd4', { opacity: 0.6, emissive: '#1a5a4a' })); dome.position.y = radius * 0.15; g.add(dome);
  const pilot = M(sph(radius * 0.13), toonMat('#b7bcc7'), 0, radius * 0.25, 0); pilot.scale.set(1, 1.3, 1); g.add(pilot);
  for (const s of [-1, 1]) { const e = M(sph(radius * 0.045), toonMat('#0a0a12'), s * radius * 0.05, radius * 0.28, radius * 0.1); e.scale.set(1, 1.5, 0.6); g.add(e); }
  const lights = new THREE.Group(); g.add(lights); g.userData.lights = lights;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const l = M(sph(radius * 0.06, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? '#7fffd4' : '#ff5ce6' }), Math.cos(a) * radius * 0.9, -radius * 0.05, Math.sin(a) * radius * 0.9); lights.add(l); }
  const beam = M(cyl(radius * 0.25, radius * 1.1, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#9fffe0', transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = -20 - radius * 0.15; beam.visible = false; g.add(beam); g.userData.beam = beam;
  const glow = new THREE.PointLight('#7fffd4', 0, 60); glow.position.y = -2; g.add(glow); g.userData.glow = glow;
  return g;
}

export function buildHouse(rnd, palette) {
  const g = new THREE.Group(); const w = rnd.range(7, 10), d = rnd.range(6, 9), h = rnd.range(4, 6);
  const wall = toonMat(rnd.pick(['#f3e2c7', '#dfe6ee', '#f7d9c4', '#e8e4d0', '#cfe0f0', '#f2efe6']));
  g.add(M(box(w, h, d), wall, 0, h / 2, 0));
  const roof = M(cone(Math.max(w, d) * 0.78, h * 0.6, 4), toonMat(rnd.pick(['#6b4a3a', '#4a4a5a', '#8a3a2a', '#3a5a3a'])), 0, h + h * 0.3, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); g.add(roof);
  g.add(M(box(1.2, 2.2, 0.2), toonMat('#5a3a2a'), rnd.range(-w / 4, w / 4), 1.1, d / 2 + 0.05));
  for (const x of [-w / 3, w / 3]) g.add(M(box(1.4, 1.2, 0.15), toonMat('#8ec5ff', { emissive: '#8ec5ff', emissiveIntensity: 0.15 }), x, h * 0.6, d / 2 + 0.05));
  const chimney = M(box(0.8, 1.6, 0.8), toonMat('#8a4a3a'), w / 3, h + h * 0.4, -d / 4); g.add(chimney);
  return g;
}
export function buildTree(rnd, leaf = '#3f9b3f', trunk = '#6b4a2a') {
  const g = new THREE.Group(); const h = rnd.range(2, 4);
  g.add(M(cyl(0.25, 0.4, h, 8), toonMat(trunk), 0, h / 2, 0));
  const c = M(sph(rnd.range(1.6, 2.6), 12, 10), toonMat(leaf), 0, h + 1.2, 0); c.scale.y = 1.15; g.add(c);
  return g;
}

function makeProp(kind, rnd, theme, palette) {
  const g = new THREE.Group(); const P = palette; const pick = () => rnd.pick(P);
  switch (kind) {
    case 'suburb': if (rnd.chance(0.6)) g.add(buildHouse(rnd, P)); else g.add(buildTree(rnd)); break;
    case 'domes': { const r = rnd.range(4, 9); g.add(M(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toonMat('#dfe1ea'))); g.add(M(cyl(0.1, 0.1, r * 0.8, 6), toonMat('#8b90a8'), 0, r * 1.3, 0)); for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; g.add(M(box(1, 1.2, 0.2), toonMat('#7fd8ff', { emissive: '#7fd8ff', emissiveIntensity: 0.4 }), Math.cos(a) * r * 0.85, r * 0.5, Math.sin(a) * r * 0.85)).lookAt(0, r * 0.5, 0); } break; }
    case 'mesas': { const r = rnd.range(6, 14), h = rnd.range(6, 16); g.add(M(cyl(r * 0.7, r, h, 9), toonMat(rnd.pick(['#b8552a', '#9a4526', '#c8643a'])), 0, h / 2, 0)); break; }
    case 'clouds': { const y = rnd.range(6, 22); for (let i = 0; i < 6; i++) { const c = M(sph(rnd.range(2.5, 5), 12, 8), toonMat('#fff8e6'), rnd.range(-6, 6), y + rnd.range(-1, 1), rnd.range(-3, 3)); g.add(c); } break; }
    case 'icebergs': { const h = rnd.range(6, 18); const ice = M(new THREE.ConeGeometry(rnd.range(3, 7), h, 5), toonMat(rnd.pick(['#e6f7ff', '#bfefff', '#ffffff']), { opacity: 0.95 }), 0, h / 2, 0); ice.rotation.y = rnd() * 6; g.add(ice); if (rnd.chance(0.5)) { const ig = M(new THREE.SphereGeometry(3, 16, 8, 0, 6.28, 0, Math.PI / 2), toonMat('#f4fbff'), rnd.range(5, 9), 0, 0); g.add(ig); } break; }
    case 'volcanoes': { const h = rnd.range(8, 20), r = rnd.range(6, 12); g.add(M(cyl(r * 0.3, r, h, 12), toonMat('#2a2a2e'), 0, h / 2, 0)); g.add(M(cyl(r * 0.28, r * 0.28, 0.4, 12), toonMat('#ff6a1f', { emissive: '#ff5500', emissiveIntensity: 1 }), 0, h, 0)); const gl = new THREE.PointLight('#ff6a1f', 1.5, r * 4); gl.position.y = h + 1; g.add(gl); break; }
    case 'mushrooms': { const h = rnd.range(5, 14), r = rnd.range(3, 7); g.add(M(cyl(r * 0.35, r * 0.45, h, 12), toonMat('#f6e8d8'), 0, h / 2, 0)); const cap = M(new THREE.SphereGeometry(r, 20, 10, 0, 6.28, 0, Math.PI / 2), toonMat(rnd.pick(['#e2493b', '#c9a0ff', '#ffb347'])), 0, h, 0); cap.scale.y = 0.65; g.add(cap); for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, rr = rnd() * r * 0.7; const s = M(sph(0.5, 8, 6), toonMat('#fff3e6'), Math.cos(a) * rr, h + Math.sqrt(Math.max(0, r * r - rr * rr)) * 0.62, Math.sin(a) * rr); g.add(s); } const gl = new THREE.PointLight('#9bff8a', 0.6, r * 3); gl.position.y = h * 0.5; g.add(gl); break; }
    case 'coral': { for (let i = 0; i < 4; i++) { const h = rnd.range(3, 9); const c = M(cyl(0.3, 0.7, h, 8), toonMat(rnd.pick(['#ff9f1c', '#ff6b6b', '#2ec4b6', '#c77dff'])), rnd.range(-2, 2), h / 2, rnd.range(-2, 2)); c.rotation.z = rnd.range(-0.3, 0.3); g.add(c); g.add(M(sph(rnd.range(0.6, 1.2), 10, 8), toonMat(rnd.pick(['#ffe66d', '#ff6b6b'])), c.position.x, h, c.position.z)); } break; }
    case 'dunes': { const d = M(sph(rnd.range(8, 16), 16, 8), toonMat(rnd.pick(['#e8c27a', '#f0c070', '#d9ad5e'])), 0, -2, 0); d.scale.y = 0.35; g.add(d); if (rnd.chance(0.3)) { g.add(M(cyl(0.3, 0.4, 5, 8), toonMat('#6a8a3a'), 0, 3.5, 0)); g.add(M(sph(1.6, 8, 6), toonMat('#3ec7c2'), 0, 6.2, 0)); } break; }
    case 'candy': { const t = rnd.int(0, 2); if (t === 0) { const h = rnd.range(6, 12); g.add(M(cyl(0.3, 0.3, h, 8), toonMat('#ffffff'), 0, h / 2, 0)); const d = M(cyl(rnd.range(2.5, 4), 3, 0.8, 24), toonMat(pick()), 0, h + 2, 0); d.rotation.x = Math.PI / 2; g.add(d); } else if (t === 1) { const c = M(new THREE.TorusGeometry(3, 0.7, 10, 24, Math.PI), toonMat('#ff4f79'), 0, 8, 0); g.add(c); g.add(M(cyl(0.7, 0.7, 8, 10), toonMat('#ffffff'), 3, 4, 0)); } else { const gd = M(new THREE.SphereGeometry(rnd.range(3, 5), 16, 8, 0, 6.28, 0, Math.PI / 2), toonMat(pick()), 0, 0, 0); gd.scale.y = 0.8; g.add(gd); } break; }
    case 'crystals': { for (let i = 0; i < 3; i++) { const h = rnd.range(5, 16); const c = M(cone(rnd.range(1.2, 2.6), h, 6), toonMat(rnd.pick(['#a8e6ff', '#d9b3ff', '#b3ffd9']), { opacity: 0.85, emissive: '#88ccff', emissiveIntensity: 0.25 }), rnd.range(-3, 3), h / 2, rnd.range(-3, 3)); c.rotation.z = rnd.range(-0.25, 0.25); c.rotation.x = rnd.range(-0.25, 0.25); g.add(c); } break; }
    case 'city': { const h = rnd.range(12, 40), w = rnd.range(5, 10); const b = M(box(w, h, w), toonMat(rnd.pick(['#12122a', '#1e1e3e', '#2a1a4a'])), 0, h / 2, 0); g.add(b); const win = M(box(w * 1.01, h * 0.95, w * 1.01), new THREE.MeshBasicMaterial({ map: windowsTexture(rnd, rnd.pick(['#2bf0ff', '#ff2bd6', '#ffe14d'])), transparent: true }), 0, h / 2, 0); g.add(win); if (rnd.chance(0.5)) g.add(M(box(w * 0.8, 1, 0.3), new THREE.MeshBasicMaterial({ color: rnd.pick(['#ff2bd6', '#2bf0ff', '#ffe14d']) }), 0, h * 0.7, w / 2 + 0.2)); break; }
    case 'junk': { for (let i = 0; i < 5; i++) { const s = rnd.range(1.5, 4); const b = M(box(s, s * rnd.range(0.5, 1.2), s), toonMat(rnd.pick(['#a0632b', '#7d7f86', '#5d6068', '#8c5a2b', '#3a6a8a'])), rnd.range(-3, 3), i * 1.8 + 1, rnd.range(-3, 3)); b.rotation.y = rnd() * 1; g.add(b); } const tire = M(new THREE.TorusGeometry(1.2, 0.5, 10, 20), toonMat('#1a1a1a'), 4, 0.5, 0); tire.rotation.x = Math.PI / 2; g.add(tire); break; }
    case 'hive': { for (let i = 0; i < 3; i++) { const h = rnd.range(4, 12); const hx = M(cyl(3, 3, h, 6), toonMat(rnd.pick(['#ffd23f', '#f0b323', '#c98a12'])), (i - 1) * 5.4, h / 2, (i % 2) * 4.6); g.add(hx); g.add(M(cyl(1.6, 1.6, 0.4, 6), toonMat('#7a5200'), hx.position.x, h, hx.position.z)); } break; }
    case 'mansions': { const h = rnd.range(10, 18), w = rnd.range(6, 10); g.add(M(box(w, h, w * 0.8), toonMat('#2a1f3d'), 0, h / 2, 0)); const r = M(cone(w * 0.8, h * 0.5, 4), toonMat('#1a1428'), 0, h + h * 0.25, 0); r.rotation.y = Math.PI / 4; g.add(r); for (let i = 0; i < 4; i++) g.add(M(box(1.2, 1.8, 0.2), new THREE.MeshBasicMaterial({ color: '#c6ff5a' }), (i % 2 ? 1 : -1) * w * 0.25, h * (0.3 + Math.floor(i / 2) * 0.35), w * 0.4 + 0.05)); const tree = M(cyl(0.2, 0.5, 6, 6), toonMat('#1a1428'), w, 3, 2); g.add(tree); break; }
    case 'jungle': { const h = rnd.range(6, 14); const trunk = M(cyl(0.35, 0.6, h, 8), toonMat('#8b5a2b'), 0, h / 2, 0); trunk.rotation.z = rnd.range(-0.15, 0.15); g.add(trunk); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const f = M(box(1.2, 0.15, 5), toonMat(rnd.pick(['#4caf50', '#2f7a32', '#6ccf70'])), Math.cos(a) * 2.2, h + 0.3, Math.sin(a) * 2.2); f.rotation.y = -a + Math.PI / 2; f.rotation.z = 0.35; g.add(f); } if (rnd.chance(0.5)) g.add(M(cone(2, 2.5, 8), toonMat('#3d8b40'), rnd.range(3, 6), 1.2, rnd.range(-3, 3))); break; }
    case 'cheese': { if (rnd.chance(0.5)) { const w = M(cyl(rnd.range(4, 7), rnd.range(4, 7), 3, 24), toonMat('#ffd24a'), 0, 1.5, 0); g.add(w); g.add(M(cyl(4.1, 4.1, 3.1, 24, 1, true), toonMat('#e6b400'), 0, 1.5, 0)); } else { const wedge = M(cyl(5, 5, 4, 3), toonMat('#ffd24a'), 0, 2, 0); g.add(wedge); for (let i = 0; i < 4; i++) g.add(M(sph(0.6, 8, 6), toonMat('#c98a00'), rnd.range(-2, 2), rnd.range(0.5, 3.5), rnd.range(-1, 1))); } break; }
    case 'ships': { const hull = M(box(14, 4, 5), toonMat('#6a4a2a'), 0, 2, 0); hull.rotation.z = rnd.range(-0.2, 0.2); g.add(hull); g.add(M(cyl(0.25, 0.3, 12, 8), toonMat('#4a3a2a'), 0, 10, 0)); g.add(M(box(5, 3.5, 0.1), toonMat('#f4f4f4'), 2.6, 11, 0)); g.add(M(box(2.5, 1.5, 0.1), toonMat('#111111'), 1.3, 15, 0)); break; }
    case 'casino': { const h = rnd.range(10, 24), w = rnd.range(6, 10); g.add(M(box(w, h, w), toonMat('#1a1030'), 0, h / 2, 0)); for (let i = 0; i < 5; i++) g.add(M(box(w * 1.02, 0.5, w * 1.02), new THREE.MeshBasicMaterial({ color: rnd.pick(['#ffd700', '#e0115f', '#2bf0ff']) }), 0, h * (0.15 + i * 0.17), 0)); if (rnd.chance(0.4)) { const dice = M(box(4, 4, 4), toonMat('#ffffff'), w, h + 2, 0); dice.rotation.set(0.4, 0.6, 0.2); g.add(dice); } break; }
    case 'flowers': { const h = rnd.range(6, 14); g.add(M(cyl(0.3, 0.45, h, 8), toonMat('#3f9b3f'), 0, h / 2, 0)); g.add(M(sph(1.6, 12, 8), toonMat('#ffe66d'), 0, h + 0.5, 0)); const c = rnd.pick(['#ff7bac', '#c77dff', '#ff6b6b', '#ffb347', '#ffffff']); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; const p = M(sph(1.6, 10, 6), toonMat(c), Math.cos(a) * 2.6, h + 0.5, Math.sin(a) * 2.6); p.scale.set(1, 0.4, 1.4); p.rotation.y = -a + Math.PI / 2; g.add(p); } break; }
    case 'factory': { const h = rnd.range(12, 24); g.add(M(cyl(1.2, 1.8, h, 12), toonMat('#5a5a66'), 0, h / 2, 0)); for (let i = 0; i < 3; i++) g.add(M(sph(2 + i, 10, 8), toonMat('#9a9aa6', { opacity: 0.7 }), i * 1.5, h + 2 + i * 3, 0)); g.add(M(box(10, 6, 8), toonMat('#4a4a52'), 6, 3, 2)); const gear = M(new THREE.TorusGeometry(2.5, 0.8, 8, 12), toonMat('#ff8c00'), 6, 8, 6); g.add(gear); break; }
    case 'balloons': { const y = rnd.range(8, 26); const b = M(sph(rnd.range(3, 5), 16, 12), toonMat(rnd.pick(['#9fd8ff', '#c9b6ff', '#ffd6a5', '#ff9ad5'])), 0, y, 0); b.scale.y = 1.2; g.add(b); g.add(M(box(2, 1.5, 2), toonMat('#8a6a3a'), 0, y - 7, 0)); for (const s of [-1, 1]) g.add(M(cyl(0.03, 0.03, 4, 4), toonMat('#4a3a2a'), s * 0.8, y - 4.5, 0)); break; }
    case 'bubbles': { for (let i = 0; i < 4; i++) { const b = M(sph(rnd.range(1.5, 4), 16, 12), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0, transmission: 0 }), rnd.range(-5, 5), rnd.range(3, 20), rnd.range(-5, 5)); g.add(b); } break; }
    case 'disco': { if (rnd.chance(0.5)) { const h = rnd.range(8, 16); g.add(M(cyl(0.3, 0.3, h, 8), toonMat('#3a1a5a'), 0, h / 2, 0)); g.add(M(sph(3, 16, 12), new THREE.MeshStandardMaterial({ map: planetTexture({ type: 'disco', colors: ['#fff', '#fff', '#fff'] }, 'disco' + rnd.int(0, 99)), metalness: 0.8, roughness: 0.2 }), 0, h + 3, 0)); } else { g.add(M(box(5, 8, 4), toonMat('#1a0030'), 0, 4, 0)); g.add(M(cyl(1.5, 1.5, 0.3, 20), toonMat('#ff2bd6', { emissive: '#ff2bd6', emissiveIntensity: 0.8 }), 0, 5.5, 2.1)).rotation.x = Math.PI / 2; } break; }
    case 'books': { for (let i = 0; i < 5; i++) { const w = rnd.range(6, 10), h = rnd.range(1.2, 2.2); const b = M(box(w, h, w * 0.7), toonMat(rnd.pick(['#a83232', '#3a5a8a', '#4a7a3a', '#8b6b4a', '#5a3a8a'])), rnd.range(-1, 1), i * 1.8 + h / 2, rnd.range(-1, 1)); b.rotation.y = rnd.range(-0.4, 0.4); g.add(b); g.add(M(box(w * 0.92, h * 0.8, w * 0.72), toonMat('#f0e0c0'), b.position.x + 0.3, b.position.y, b.position.z)); } break; }
    case 'goo': { const b = M(sph(rnd.range(3, 7), 16, 10), toonMat(rnd.pick(['#5ce65c', '#3ecf3e', '#9dff5c']), { opacity: 0.85 }), 0, 0, 0); b.scale.y = 0.6; g.add(b); for (let i = 0; i < 3; i++) g.add(M(sph(0.8, 8, 6), toonMat('#7cff7c', { opacity: 0.8 }), rnd.range(-3, 3), rnd.range(2, 5), rnd.range(-3, 3))); break; }
    case 'pizza': { if (rnd.chance(0.5)) { const s = M(cyl(6, 6, 1.2, 3), toonMat('#e0a040'), 0, 0.6, 0); g.add(s); g.add(M(cyl(5.4, 5.4, 0.4, 3), toonMat('#c8282a'), 0, 1.3, 0)); for (let i = 0; i < 5; i++) g.add(M(cyl(0.8, 0.8, 0.2, 12), toonMat('#8a1a1c'), rnd.range(-2, 2), 1.6, rnd.range(-2, 2))); } else { g.add(M(box(9, 1.5, 9), toonMat('#f0d080'), 0, 0.75, 0)); g.add(M(box(9, 0.3, 9), toonMat('#e63b2e'), 0, 1.6, 0)); } break; }
    case 'ring': { const h = rnd.range(10, 24); g.add(M(cyl(1, 1.4, h, 8), toonMat('#c9d1df'), 0, h / 2, 0)); g.add(M(new THREE.TorusGeometry(2.5, 0.4, 8, 24), toonMat('#3ee8ff', { emissive: '#3ee8ff', emissiveIntensity: 0.6 }), 0, h, 0)).rotation.x = Math.PI / 2; break; }
    case 'void': { const r = M(new THREE.IcosahedronGeometry(rnd.range(2, 6), 0), toonMat('#2b1b4a', { emissive: '#6a2fd0', emissiveIntensity: 0.3 }), 0, rnd.range(2, 18), 0); r.rotation.set(rnd() * 3, rnd() * 3, 0); g.add(r); break; }
    case 'clocks': { const h = rnd.range(12, 24), w = rnd.range(4, 6); g.add(M(box(w, h, w), toonMat('#c99a3b'), 0, h / 2, 0)); const face = M(new THREE.CircleGeometry(w * 0.4, 24), toonMat('#fff8dc'), 0, h * 0.8, w / 2 + 0.05); g.add(face); g.add(M(box(0.2, w * 0.3, 0.05), toonMat('#3a2a0a'), 0, h * 0.8 + w * 0.12, w / 2 + 0.1)); g.add(M(cone(w * 0.75, h * 0.3, 4), toonMat('#5a3a8a'), 0, h + h * 0.15, 0)).rotation.y = Math.PI / 4; break; }
    case 'ship': { const h = rnd.range(8, 20); g.add(M(cyl(1.2, 1.5, h, 10), toonMat('#4a5a6a'), 0, h / 2, 0)); for (let i = 0; i < 3; i++) g.add(M(new THREE.TorusGeometry(1.7, 0.15, 8, 20), toonMat('#7fffd4', { emissive: '#7fffd4', emissiveIntensity: 0.8 }), 0, h * (0.25 + i * 0.25), 0)).rotation.x = Math.PI / 2; if (rnd.chance(0.4)) g.add(M(new THREE.CapsuleGeometry(1.5, 3, 6, 12), toonMat('#7fffd4', { opacity: 0.3 }), 4, 3.5, 0)); break; }
    default: { g.add(M(sph(rnd.range(2, 5), 12, 8), toonMat(pick()), 0, 1, 0)); }
  }
  return g;
}
function windowsTexture(rnd, color) {
  const { cv, ctx } = canvas(64, 128); ctx.clearRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8) if (rnd.chance(0.55)) { ctx.fillStyle = color; ctx.fillRect(x, y, 4, 5); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Stadium {
  constructor(planet, homeTeam, awayTeam, opts = {}) {
    this.planet = planet; this.spec = planet.stadium; this.theme = planet.theme; this.home = homeTeam; this.away = awayTeam; this.opts = opts;
    this.rnd = makeRng(hashStr(planet.id + ':stadium'));
    this.scene = new THREE.Scene(); this.group = new THREE.Group(); this.scene.add(this.group);
    this.time = 0; this.excite = 0; this.size = SIZES[this.spec.size] || SIZES.medium;
    this._lights(); this._sky(); this._ground(); this._field(); this._goalposts(); this._stands(); this._towers(); this._scoreboard(); this._environment(); this._particles();
    if (this.spec.dome) this._dome();
  }
  get night() { return !!this.spec.night; }
  _lights() {
    const t = this.theme; const night = this.night;
    this.scene.add(new THREE.HemisphereLight(t.sky[1], t.ground, night ? 0.55 : 0.85));
    this.scene.add(new THREE.AmbientLight('#ffffff', night ? 0.35 : 0.3));
    const sun = new THREE.DirectionalLight(night ? '#e8f0ff' : '#fff4e0', night ? 1.6 : 2.0);
    sun.position.set(night ? 10 : 40, night ? 80 : 70, night ? 20 : 15).add(new THREE.Vector3(0, 0, FIELD.L / 2)); sun.target.position.set(0, 0, FIELD.L / 2); this.scene.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = -44; c.right = 44; c.top = 44; c.bottom = -44; c.near = 10; c.far = 200; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    this.scene.add(sun); this.sun = sun;
  }
  _sky() {
    const sky = M(new THREE.SphereGeometry(420, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(this.theme, this.night), side: THREE.BackSide, fog: false }));
    sky.position.z = FIELD.L / 2; this.scene.add(sky); this.sky = sky;
    const horizon = this.theme.sky[1];
    if (this.spec.quirks.includes('fog')) this.scene.fog = new THREE.FogExp2(mix(horizon, '#ffffff', 0.3), 0.022);
    else this.scene.fog = new THREE.Fog(horizon, 160, 420);
    // celestial decorations
    for (const c of this.theme.celestial || []) {
      if (c.type === 'sun' || c.type === 'moon' || c.type === 'earth' || c.type === 'clockmoon') {
        const r = (c.r || 0.05) * 300; const mat = c.type === 'sun' ? new THREE.MeshBasicMaterial({ color: c.colors ? c.colors[1] : '#ffd66b', fog: false }) : c.type === 'earth' ? new THREE.MeshBasicMaterial({ map: planetTexture({ type: 'earth', colors: ['#2f6fd6', '#3aa655', '#f4f4f4'], clouds: true }, 'skyearth'), fog: false }) : new THREE.MeshBasicMaterial({ color: c.colors ? c.colors[0] : '#eeeeff', fog: false });
        const m = M(sph(r, 24, 16), mat, (c.x - 0.5) * 600, (0.45 - c.y) * 400 + 120, FIELD.L / 2 - 330); this.scene.add(m);
        if (c.type === 'sun') { const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: c.colors ? c.colors[0] : '#fff6c7', transparent: true, opacity: 0.35, fog: false, depthWrite: false })); glow.scale.setScalar(r * 5); glow.position.copy(m.position); this.scene.add(glow); }
      }
      if (c.type === 'ring' || c.type === 'ringarc') { const ring = M(new THREE.TorusGeometry(260, c.type === 'ringarc' ? 8 : 3, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c.colors ? c.colors[0] : '#dfe4ee', fog: false, transparent: true, opacity: 0.7 }), 0, -40, FIELD.L / 2); ring.rotation.x = 0.2; ring.rotation.z = 0; this.scene.add(ring); }
      if (c.type === 'blackhole') { const h = M(sph(30, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000', fog: false }), 90, 160, FIELD.L / 2 - 300); this.scene.add(h); const d = M(new THREE.RingGeometry(34, 70, 48), new THREE.MeshBasicMaterial({ color: '#c77dff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }), 90, 160, FIELD.L / 2 - 300); d.rotation.x = 1.2; this.scene.add(d); }
      if (c.type === 'aurora') { for (let i = 0; i < 3; i++) { const a = M(new THREE.PlaneGeometry(500, 60), new THREE.MeshBasicMaterial({ color: ['#5ce65c', '#7fe3ff', '#c77dff'][i], transparent: true, opacity: 0.18, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 180 + i * 30, FIELD.L / 2 - 320 + i * 20); a.rotation.x = 0.3; this.scene.add(a); } }
      if (c.type === 'mirrorball') { const mb = M(sph(12, 24, 16), new THREE.MeshStandardMaterial({ map: planetTexture({ type: 'disco', colors: ['#fff', '#fff', '#fff'] }, 'mb'), metalness: 0.9, roughness: 0.2, fog: false }), 0, 70, FIELD.L / 2); this.scene.add(mb); this.mirrorball = mb; }
    }
  }
  _ground() {
    const g = M(new THREE.PlaneGeometry(700, 700), toonMat(this.theme.ground), 0, -0.05, FIELD.L / 2); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; this.scene.add(g);
    // ground detail patches
    const rnd = this.rnd; const gt = this.theme.groundType;
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, d = rnd.range(50, 200); const x = Math.cos(a) * d, z = FIELD.L / 2 + Math.sin(a) * d;
      if (gt === 'craters') { const c = M(new THREE.TorusGeometry(rnd.range(3, 9), 0.8, 8, 24), toonMat(shade(this.theme.ground, -0.15)), x, 0, z); c.rotation.x = Math.PI / 2; this.scene.add(c); }
      else if (gt === 'lava') { const l = M(new THREE.CircleGeometry(rnd.range(3, 8), 16), toonMat('#ff6a1f', { emissive: '#ff5500', emissiveIntensity: 0.9 }), x, 0.02, z); l.rotation.x = -Math.PI / 2; this.scene.add(l); }
      else if (gt === 'honey' || gt === 'goo' || gt === 'candy') { const l = M(new THREE.CircleGeometry(rnd.range(2, 6), 16), toonMat(shade(this.theme.ground, 0.2)), x, 0.02, z); l.rotation.x = -Math.PI / 2; this.scene.add(l); }
      else { const l = M(new THREE.CircleGeometry(rnd.range(3, 9), 12), toonMat(shade(this.theme.ground, rnd.range(-0.15, 0.15))), x, 0.01, z); l.rotation.x = -Math.PI / 2; this.scene.add(l); }
    }
  }
  _field() {
    const { W, L, APRON } = FIELD;
    const tex = fieldTexture(this.spec.surface, this.home, this.away);
    const f = M(new THREE.PlaneGeometry(W + APRON * 2, L + APRON * 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: gradientMap() }), 0, 0, L / 2);
    f.rotation.x = -Math.PI / 2; f.receiveShadow = true; this.group.add(f); this.field = f;
    if (this.spec.surface.type === 'ice' || this.spec.surface.type === 'glass') { f.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, metalness: 0.1 }); }
  }
  _goalposts() {
    const y = toonMat('#ffd23f'); const cb = 3.33, up = 10, half = 3.08;
    for (const z of [-0.3, FIELD.L + 0.3]) {
      const g = new THREE.Group(); g.position.z = z; this.group.add(g);
      const zoff = z < 1 ? -1.2 : 1.2;
      g.add(M(cyl(0.12, 0.14, cb, 10), y, 0, cb / 2, zoff));
      const neck = M(cyl(0.1, 0.1, 1.3, 8), y, 0, cb, zoff / 2); neck.rotation.x = Math.PI / 2; g.add(neck);
      g.add(M(cyl(0.09, 0.09, half * 2, 8), y, 0, cb, 0)).rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) g.add(M(cyl(0.08, 0.08, up, 8), y, s * half, cb + up / 2, 0));
      const pad = M(cyl(0.3, 0.3, 2, 10), toonMat(this.home.colors[0]), 0, 1, zoff); g.add(pad);
    }
  }
  _stands() {
    const S = this.size; if (!S.rows) return;
    const { W, L, APRON } = FIELD; const rnd = this.rnd;
    const standMat = toonMat(mix(this.theme.palette[3] || '#3a4058', '#5a6078', 0.5)); const stepH = 0.72, stepD = 1.45;
    const off = W / 2 + APRON + 3;
    const buildSide = (rows, len, cz, rotY, dist, baseY = 0) => {
      const g = new THREE.Group(); g.position.set(0, baseY, cz); g.rotation.y = rotY; this.group.add(g);
      for (let i = 0; i < rows; i++) { const h = (i + 1) * stepH; const b = M(box(stepD, h, len), standMat, -(dist + i * stepD), h / 2, 0); b.receiveShadow = true; g.add(b); }
      const wall = M(box(1, rows * stepH + 1, len + 2), toonMat(shade(this.theme.palette[3] || '#3a4058', -0.2)), -(dist + rows * stepD + 0.3), (rows * stepH + 1) / 2, 0); g.add(wall);
      // railing at the front
      const rail = M(box(0.1, 0.9, len), toonMat('#dfe4ee'), -(dist - 0.5), 1.1, 0); g.add(rail);
      this.seatSlots.push({ g, rows, len, dist });
      return g;
    };
    this.seatSlots = [];
    buildSide(S.rows, L + APRON * 2, L / 2, 0, off);
    buildSide(S.rows, L + APRON * 2, L / 2, Math.PI, off);
    if (S.ends) { buildSide(S.ends, W + APRON * 2 + 6, L + APRON + 8, Math.PI / 2, 0); buildSide(S.ends, W + APRON * 2 + 6, -APRON - 8, -Math.PI / 2, 0); }
    if (S.upper) { const baseY = S.rows * stepH + 3; buildSide(S.upper, L + APRON * 2, L / 2, 0, off + 4, baseY); buildSide(S.upper, L + APRON * 2, L / 2, Math.PI, off + 4, baseY); }
    // crowd
    const seats = [];
    for (const slot of this.seatSlots) for (let i = 0; i < slot.rows; i++) for (let s = -slot.len / 2 + 1; s < slot.len / 2 - 1; s += 1.15) if (rnd.chance(0.85)) seats.push({ slot, i, s: s + rnd.range(-0.25, 0.25) });
    const n = Math.min(seats.length, S.crowd); this.crowdN = n;
    const bodyGeo = new THREE.CapsuleGeometry(0.28, 0.45, 3, 8), headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshToonMaterial({ gradientMap: gradientMap() }), n);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshToonMaterial({ gradientMap: gradientMap() }), n);
    const colors = [this.home.colors[0], this.home.colors[0], this.home.colors[1], this.away.colors[0], '#f4f4f8', '#2a2a3a', '#ffd23f'];
    const skins = ['#f5cba7', '#c68642', '#8d5524', '#ffdbac', '#7fd8ff', '#9dff5c', '#c9c9d6'];
    const m = new THREE.Matrix4(); const c = new THREE.Color(); this.crowdData = [];
    for (let k = 0; k < n; k++) {
      const { slot, i, s } = seats[k]; const localX = -(slot.dist + i * stepD), localY = (i + 1) * stepH; const p = new THREE.Vector3(localX, localY, s); slot.g.localToWorld(p);
      this.crowdData.push({ x: p.x, y: p.y, z: p.z, ph: rnd() * 6.28, jump: rnd.range(0.6, 1.4) });
      m.makeTranslation(p.x, p.y + 0.55, p.z); bodies.setMatrixAt(k, m); bodies.setColorAt(k, c.set(rnd.pick(colors)));
      m.makeTranslation(p.x, p.y + 1.15, p.z); heads.setMatrixAt(k, m); heads.setColorAt(k, c.set(rnd.pick(skins)));
    }
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; bodies.instanceColor.needsUpdate = true; heads.instanceColor.needsUpdate = true;
    bodies.castShadow = false; heads.castShadow = false; this.group.add(bodies); this.group.add(heads); this.crowdBodies = bodies; this.crowdHeads = heads;
  }
  _towers() {
    const n = this.size.towers; if (!n) return; const { W, L } = FIELD; const pole = toonMat('#8a919c'); const lampMat = new THREE.MeshBasicMaterial({ color: this.night ? '#fff8d8' : '#c8c8d0' });
    const spots = n === 2 ? [[-W / 2 - 12, L * 0.5], [W / 2 + 12, L * 0.5]] : [[-W / 2 - 14, -6], [W / 2 + 14, -6], [-W / 2 - 14, L + 6], [W / 2 + 14, L + 6], ...(n === 6 ? [[-W / 2 - 16, L / 2], [W / 2 + 16, L / 2]] : [])];
    for (const [x, z] of spots) {
      const h = 22 + this.size.rows * 0.7; const g = new THREE.Group(); g.position.set(x, 0, z); this.group.add(g);
      g.add(M(cyl(0.3, 0.5, h, 10), pole, 0, h / 2, 0));
      const bank = M(box(5, 2.5, 0.6), toonMat('#3a3f4a'), 0, h + 1, 0); bank.lookAt(0, 0, L / 2); g.add(bank);
      for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) { const lamp = M(sph(0.35, 8, 6), lampMat); lamp.position.set(i * 0.9, j * 1.0 - 0.5, 0.35); bank.add(lamp); }
      if (this.night) { const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#fff4c0', transparent: true, opacity: 0.35, depthWrite: false })); glow.scale.setScalar(9); glow.position.y = h + 1; g.add(glow); }
    }
  }
  _scoreboard() {
    const { L } = FIELD; const big = this.size.rows >= 12;
    const w = big ? 22 : 15, h = big ? 9 : 6, y = this.size.rows * 0.72 + (this.size.upper ? 12 : 6) + 5, z = L + FIELD.APRON + (this.size.ends ? 22 : 12);
    const g = new THREE.Group(); g.position.set(0, y, z); this.group.add(g);
    g.add(M(box(w + 1, h + 1, 1), toonMat('#23233a'), 0, 0, 0));
    for (const s of [-1, 1]) g.add(M(cyl(0.3, 0.4, y, 8), toonMat('#3a3f4a'), s * (w / 2 - 1), -y / 2, 0.4));
    const { cv, ctx } = canvas(512, 224); this.sbCanvas = cv; this.sbCtx = ctx;
    this.sbTex = new THREE.CanvasTexture(cv); this.sbTex.colorSpace = THREE.SRGBColorSpace;
    const face = M(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.sbTex }), 0, 0, -0.55); face.rotation.y = Math.PI; g.add(face);
    this.setScoreboard({ home: 0, away: 0, clock: '0:00', quarter: 1, down: 1, togo: 10, homeName: this.home.short, awayName: this.away.short });
    // team banner
    const bn = M(new THREE.PlaneGeometry(w, 1.6), new THREE.MeshBasicMaterial({ color: this.home.colors[0] }), 0, h / 2 + 1.4, -0.55); bn.rotation.y = Math.PI; g.add(bn);
  }
  setScoreboard(d) {
    const ctx = this.sbCtx; if (!ctx) return; const key = JSON.stringify(d); if (key === this._sbKey) return; this._sbKey = key;
    ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, 512, 224);
    ctx.font = 'bold 34px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
    ctx.fillText(String(d.homeName).slice(0, 8), 24, 60); ctx.fillText(String(d.awayName).slice(0, 8), 24, 130);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 54px "Arial Black", Impact, sans-serif'; ctx.fillText(String(d.home), 300, 68); ctx.fillText(String(d.away), 300, 138);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 44px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.clock, 420, 70);
    ctx.fillStyle = '#7fe3a6'; ctx.font = 'bold 26px "Arial Black", Impact, sans-serif'; ctx.fillText(d.quarter === 'OT' ? 'OT' : `Q${d.quarter}`, 420, 120);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px "Arial Black", Impact, sans-serif'; ctx.fillText(d.msg || `${['1ST', '2ND', '3RD', '4TH'][(d.down || 1) - 1]} & ${d.togo >= 60 ? 'GOAL' : d.togo}`, 256, 200);
    ctx.strokeStyle = '#3a3f5a'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 500, 212);
    this.sbTex.needsUpdate = true;
  }
  _environment() {
    const rnd = this.rnd; const t = this.theme; const { W, L } = FIELD;
    const kind = t.skyline === 'suburb' ? 'suburb' : t.skyline;
    const count = kind === 'suburb' ? 22 : 30; const inner = this.size.rows ? 52 + this.size.rows * 1.5 + (this.size.upper ? 12 : 0) : 26;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd.range(-0.1, 0.1); const d = rnd.range(inner, inner + 60);
      const p = makeProp(kind, rnd, t, t.palette); p.position.set(Math.cos(a) * d, 0, L / 2 + Math.sin(a) * d * 1.15); p.rotation.y = rnd() * 6.28; p.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); this.group.add(p);
    }
    if (kind === 'suburb') {
      // white picket fences down the sidelines, Kevin's garage with the rocket peeking out
      for (const s of [-1, 1]) for (let z = 2; z < L - 2; z += 2.2) { const f = M(box(0.15, 1.1, 1.8), toonMat('#f4f4f8'), s * (W / 2 + 4), 0.55, z); this.group.add(f); const post = M(box(0.25, 1.4, 0.25), toonMat('#f4f4f8'), s * (W / 2 + 4), 0.7, z + 1); this.group.add(post); }
      const garage = new THREE.Group(); garage.position.set(-W / 2 - 16, 0, -12); this.group.add(garage);
      garage.add(M(box(10, 6, 9), toonMat('#dfe6ee'), 0, 3, 0)); garage.add(M(box(6, 4.8, 0.3), toonMat('#8a919c'), 0, 2.4, 4.6));
      const roof = M(cone(8, 3.5, 4), toonMat('#4a4a5a'), 0, 7.6, 0); roof.rotation.y = Math.PI / 4; garage.add(roof);
      const rocket = buildRocket(2.2); rocket.rotation.x = -Math.PI / 2 + 0.15; rocket.position.set(0, 7, -1); garage.add(rocket); this.garageRocket = rocket;
      const sign = M(box(4, 1, 0.1), toonMat('#ffd23f'), 3, 5, 4.7); garage.add(sign);
      for (let i = 0; i < 6; i++) { const tr = buildTree(rnd); tr.position.set(rnd.pick([-1, 1]) * (W / 2 + rnd.range(8, 14)), 0, rnd.range(4, L - 4)); this.group.add(tr); }
    }
  }
  _dome() {
    const { L } = FIELD; const glass = ['ocean', 'crystal', 'bubble', 'gas'].includes(this.planet.look.type) || this.planet.id === 'aquaria';
    const R = 70 + this.size.rows * 2 + (this.size.upper ? 20 : 0);
    const mat = glass ? new THREE.MeshPhysicalMaterial({ color: '#cfefff', transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }) : new THREE.MeshToonMaterial({ color: shade(this.theme.palette[3] || '#1a1a2e', 0.05), gradientMap: gradientMap(), side: THREE.BackSide });
    const domeG = new THREE.Group(); domeG.position.set(0, -R * 0.04, L / 2); domeG.scale.set(1, 0.75, 1.25); this.group.add(domeG); this.dome = domeG;
    domeG.add(M(new THREE.SphereGeometry(R, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.52), mat));
    if (!glass) {
      const ribs = toonMat(this.theme.palette[1] || '#7fb3ff', { emissive: this.theme.palette[1] || '#7fb3ff', emissiveIntensity: 0.5 });
      for (let i = 0; i < 8; i++) { const r = M(new THREE.TorusGeometry(R * 0.995, 0.5, 6, 64, Math.PI), ribs); r.rotation.y = i / 8 * Math.PI; domeG.add(r); }
      // ring of lights under the roof
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const l = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#fff4c0', transparent: true, opacity: 0.6, depthWrite: false })); l.scale.setScalar(7); l.position.set(Math.cos(a) * R * 0.6, R * 0.45, L / 2 + Math.sin(a) * R * 0.75); this.group.add(l); }
      this.scene.add(new THREE.AmbientLight('#ffffff', 0.35));
    }
  }
  _particles() {
    const type = this.theme.particles; if (!type || type === 'none' || type === 'fog' || (type === 'stars' && this.spec.dome)) return;
    const N = 260; const pos = new Float32Array(N * 3); const rnd = this.rnd; this.pVel = [];
    const cfg = {
      snow: { c: '#ffffff', s: 0.5, v: [0, -1.4, 0], j: 0.6 }, embers: { c: '#ffb347', s: 0.35, v: [0.3, 1.6, 0], j: 0.8 }, spores: { c: '#c6ff5a', s: 0.45, v: [0.2, 0.3, 0.1], j: 0.5 }, bubbles: { c: '#dff6ff', s: 0.55, v: [0, 1.2, 0], j: 0.5 },
      rain: { c: '#9fd8ff', s: 0.25, v: [1, -14, 0], j: 0.2 }, dust: { c: '#e0a070', s: 0.4, v: [3, 0.1, 0], j: 0.8 }, sand: { c: '#f0c070', s: 0.35, v: [5, 0.2, 0], j: 1 }, confetti: { c: '#ff4f79', s: 0.4, v: [0.5, -1.2, 0], j: 1.2, multi: true },
      sparkles: { c: '#ffffff', s: 0.35, v: [0, 0.2, 0], j: 0.6 }, petals: { c: '#ff7bac', s: 0.45, v: [0.8, -0.9, 0], j: 1 }, leaves: { c: '#6ccf70', s: 0.45, v: [1.2, -1.0, 0], j: 1.2 }, crumbs: { c: '#ffe680', s: 0.3, v: [0, -1.5, 0], j: 0.4 },
      coins: { c: '#ffd700', s: 0.4, v: [0, -1.8, 0], j: 0.6 }, steam: { c: '#dddddd', s: 0.7, v: [0.2, 1.4, 0], j: 0.5 }, pages: { c: '#f0e0c0', s: 0.5, v: [1.5, -0.6, 0], j: 1.4 }, drips: { c: '#9dff5c', s: 0.35, v: [0, -2.2, 0], j: 0.2 },
      pollen: { c: '#ffe08a', s: 0.3, v: [0.8, 0.2, 0], j: 0.9 }, sparks: { c: '#ffb060', s: 0.25, v: [0, -3, 0], j: 1.5 }, stars: { c: '#ffffff', s: 0.25, v: [0, 0, 0], j: 0.05 },
    }[type] || { c: '#ffffff', s: 0.4, v: [0, -1, 0], j: 0.5 };
    for (let i = 0; i < N; i++) { pos[i * 3] = rnd.range(-60, 60); pos[i * 3 + 1] = rnd.range(0, 45); pos[i * 3 + 2] = rnd.range(-20, FIELD.L + 20); this.pVel.push([cfg.v[0] + rnd.range(-cfg.j, cfg.j), cfg.v[1] + rnd.range(-cfg.j, cfg.j) * 0.5, cfg.v[2] + rnd.range(-cfg.j, cfg.j)]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (cfg.multi) { const col = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const c = new THREE.Color(hsl(rnd() * 360, 0.9, 0.6)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    const mat = new THREE.PointsMaterial({ color: cfg.multi ? '#ffffff' : cfg.c, size: cfg.s, transparent: true, opacity: 0.85, vertexColors: !!cfg.multi, depthWrite: false, sizeAttenuation: true });
    this.particles = new THREE.Points(geo, mat); this.scene.add(this.particles); this.pCfg = cfg;
  }
  cheer(intensity = 1) { this.excite = Math.max(this.excite, intensity); }
  update(dt) {
    this.time += dt; this.excite = Math.max(0, this.excite - dt * 0.5);
    if (this.crowdBodies && (this._crowdFrame = (this._crowdFrame || 0) + 1) % 2 === 0) {
      const m = new THREE.Matrix4(); const ex = this.excite; const t = this.time;
      for (let k = 0; k < this.crowdN; k++) {
        const d = this.crowdData[k]; const bob = Math.max(0, Math.sin(t * 6 * d.jump + d.ph)) * (0.06 + ex * 0.45) + Math.sin(t * 2 + d.ph) * 0.02;
        m.makeTranslation(d.x, d.y + 0.55 + bob, d.z); this.crowdBodies.setMatrixAt(k, m);
        m.makeTranslation(d.x, d.y + 1.15 + bob, d.z); this.crowdHeads.setMatrixAt(k, m);
      }
      this.crowdBodies.instanceMatrix.needsUpdate = true; this.crowdHeads.instanceMatrix.needsUpdate = true;
    }
    if (this.particles) {
      const p = this.particles.geometry.attributes.position; const arr = p.array;
      for (let i = 0; i < this.pVel.length; i++) {
        const v = this.pVel[i]; arr[i * 3] += v[0] * dt; arr[i * 3 + 1] += v[1] * dt; arr[i * 3 + 2] += v[2] * dt;
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 45; if (arr[i * 3 + 1] > 46) arr[i * 3 + 1] = 0; if (arr[i * 3] > 60) arr[i * 3] = -60; if (arr[i * 3] < -60) arr[i * 3] = 60; if (arr[i * 3 + 2] > FIELD.L + 20) arr[i * 3 + 2] = -20; if (arr[i * 3 + 2] < -20) arr[i * 3 + 2] = FIELD.L + 20;
      }
      p.needsUpdate = true;
    }
    if (this.mirrorball) this.mirrorball.rotation.y += dt * 0.5;
  }
  dispose() { this.scene.traverse(o => { if (o.geometry && !o.userData.shared) { /* geometry is per-stadium */ } }); }
}
