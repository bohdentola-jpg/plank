// Shared town pieces: a cobbled street lined with pueblo houses, used by the
// title screen, the market and the plaza.
import * as THREE from 'three';
import { toon, rng, PAL, box, mesh } from '../toon.js';
import { house, cobbleTex, papelString, lamp, church, marigolds } from '../world.js';

const WALLS = [
  [PAL.pinkWall, '#b84a7c'], [PAL.yellowWall, '#c4562e'], [PAL.blueWall, '#2f5f9e'], [PAL.greenWall, '#3b7a4a'],
  ['#f0b48c', '#9a4a2a'], ['#c9a0ff', '#6a3fa0'], ['#ff9f8a', '#a83a3a'], ['#fff1c9', '#c97a2a'],
];

// a street running along -z; houses on both sides. returns { group, doors }
export function street({ length = 40, width = 7, seed = 1, startZ = 6, churchAt = true, papel = true, lit = false } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  const ground = mesh(new THREE.PlaneGeometry(width + 2, length + 30), toon('#ffffff', { map: cobbleTex('#c9b49a'), rim: 0 }), { cast: false, receive: true });
  ground.material.map.repeat.set(4, 18);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, startZ - length / 2);
  g.add(ground);
  // sidewalks
  for (const sx of [-1, 1]) {
    const sw = box(1.2, 0.16, length + 30, toon('#d9cbb8', { rim: 0 }));
    sw.position.set(sx * (width / 2 + 0.6), 0.08, startZ - length / 2);
    sw.receiveShadow = true;
    g.add(sw);
  }
  let z = startZ;
  let i = 0;
  const houses = [];
  while (z > startZ - length) {
    for (const sx of [-1, 1]) {
      const w = 3.6 + r() * 2.2;
      const h = 3 + r() * 1.6 + (r() > 0.8 ? 1.8 : 0);
      const [color, band] = WALLS[(i + (sx > 0 ? 3 : 0)) % WALLS.length];
      const hs = house({ w, h, d: 3, color, band, roof: r() > 0.55 ? 'tile' : 'flat', bugambilia: r() > 0.6, seed: seed * 31 + i * 7 + (sx > 0 ? 1 : 0), windows: w > 4.5 ? 2 : 1, balcony: h > 4.6 && r() > 0.4, upper: h > 4.6 });
      hs.position.set(sx * (width / 2 + 1.2 + 1.5), 0, z - w / 2);
      hs.rotation.y = -sx * Math.PI / 2;
      g.add(hs);
      houses.push(hs);
      i++;
    }
    z -= 4.6 + r() * 1.2;
  }
  if (churchAt) {
    const ch = church();
    ch.position.set(0, 0, startZ - length - 7);
    g.add(ch);
  }
  const strings = [];
  if (papel) {
    for (let k = 0; k < 6; k++) {
      const zz = startZ - 3 - k * (length / 6);
      const s = papelString([-(width / 2 + 1.3), 3.9 + (k % 2) * 0.3, zz], [width / 2 + 1.3, 3.9 + ((k + 1) % 2) * 0.3, zz - 1.2], { seed: seed + k, sheetW: 0.42, sag: 0.45 });
      g.add(s);
      strings.push(s);
    }
  }
  for (let k = 0; k < 4; k++) {
    for (const sx of [-1, 1]) {
      const l = lamp({ lit });
      l.position.set(sx * (width / 2 + 0.3), 0, startZ - 6 - k * 10 - (sx > 0 ? 5 : 0));
      g.add(l);
    }
  }
  return { group: g, strings, houses };
}

// pots of marigolds along a wall or path
export function potRow(x0, z0, x1, z1, n = 6, seed = 2) {
  const g = new THREE.Group();
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
    const pot = mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 12), toon(PAL.terracotta));
    pot.position.set(x, 0.16, z);
    g.add(pot);
    const spots = [];
    for (let j = 0; j < 9; j++) {
      const a = r() * Math.PI * 2, d = r() * 0.16;
      spots.push([x + Math.cos(a) * d, 0.42 + r() * 0.12, z + Math.sin(a) * d, 0.07]);
    }
    g.add(marigolds(spots, { seed: seed + i }));
  }
  return g;
}
