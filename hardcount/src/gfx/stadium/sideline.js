// The sidelines: team benches, coolers and heaters, the players who aren't on
// the field, coaches with headsets, photographers behind the end lines,
// cheerleaders facing the stands, and the chain gang with the sticks and the
// down box (moved by setMarkers). Home bench on the -x sideline, away on +x,
// chain crew on the away side.
import * as THREE from 'three';
import { buildFigures } from './people.js';
import { V3, pole, box } from './kit.js';
import { cv, tex } from './tex.js';
import { blockText } from './blockfont.js';
import { makeRng } from '../../core/util.js';

const SKINS = ['#f2c7a6', '#e0ab84', '#c68b62', '#9c6a46', '#6e4630', '#4a2e20'];

/**
 * opts: { benchOff, cheer, photographers, heaters, coaches, players, staff }
 */
export function buildSideline(ctx, B, opts = {}) {
  const { field, home, away } = ctx;
  const rng = makeRng('sideline' + ctx.def.id);
  const hw = field.halfW, hl = field.halfL;
  const group = new THREE.Group();
  group.name = 'sideline';
  const list = [];
  const pick = (a) => a[(rng() * a.length) | 0];
  const benchOff = opts.benchOff ?? 8.5;
  const zc = Math.min(hl - 15, 12);
  const kitOf = (team, which) => team.uniform?.[which] || team.uniform?.home;

  // ---- benches, tables, coolers (+ heaters in the cold)
  const paint = B.get('paint');
  const metal = B.get('metal');
  for (const s of [-1, 1]) {
    const team = s < 0 ? home : away;
    const col = new THREE.Color(team.colors.primary);
    const xb = s * (hw + benchOff);
    const ry = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let z = -zc + 3; z <= zc - 3 + 0.01; z += 6.5) {
      paint.setColor(col.r, col.g, col.b);
      box(paint, xb, 0.42, z, 6, 0.08, 0.45, ry);           // seat
      box(paint, xb + s * 0.25, 0.5, z, 6, 0.45, 0.06, ry);  // back rest
      metal.setColor(0.3, 0.3, 0.32);
      for (const dz of [-2.6, 0, 2.6]) box(metal, xb, 0, z + dz, 0.06, 0.42, 0.4, ry);
    }
    // tables with orange coolers + cup stacks
    for (const z of [-zc - 2.5, zc + 2.5]) {
      paint.setColor(0.85, 0.85, 0.82);
      box(paint, xb + s * 0.6, 0.85, z, 2.2, 0.06, 0.8, ry);
      metal.setColor(0.25, 0.25, 0.27);
      box(metal, xb + s * 0.6, 0, z, 2.0, 0.85, 0.6, ry, {});
      paint.setColor(1.0, 0.42, 0.05);
      for (const dz of [-0.6, 0.6]) {
        const g = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10);
        g.translate(xb + s * 0.6, 1.16, z + dz);
        paint.geometry(g, new THREE.Matrix4());
        g.dispose();
      }
      paint.setColor(0.95, 0.95, 0.95);
      box(paint, xb + s * 0.6, 0.91, z, 0.25, 0.3, 0.25, 0);
    }
    if (opts.heaters) {
      for (const z of [-zc + 1, 0, zc - 1]) {
        metal.setColor(0.2, 0.2, 0.22);
        const hx = xb - s * 1.4;
        pole(metal, V3(hx, 0, z), V3(hx, 1.3, z), 0.28, 10);
        ctx.lightsList.push({ pos: V3(hx, 1.45, z), color: [1.0, 0.45, 0.12], size: 1.2, k: 1.6 });
      }
    }
  }

  // ---- players on the sideline
  const low = ctx.quality === 'low';
  const nPlayers = Math.round((opts.players ?? 14) * (low ? 0.5 : 1));
  for (const s of [-1, 1]) {
    const team = s < 0 ? home : away;
    const kit = kitOf(team, s < 0 ? 'home' : 'away');
    for (let i = 0; i < nPlayers; i++) {
      const seated = rng() < 0.3;
      const helmetOn = rng() < 0.65;
      const z = seated ? -zc + 3 + Math.floor(rng() * 3) * 6.5 + (rng() - 0.5) * 5 : (rng() - 0.5) * 2 * (zc + 2);
      const x = seated ? s * (hw + benchOff - 0.05) : s * (hw + 4.6 + rng() * 2.6);
      const face = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      list.push({
        x, z, ry: face + (seated ? 0 : (rng() - 0.5) * 1.4),
        pose: seated ? 0 : pick([0, 0, 1, 5, 6]), kneel: seated ? 2 : 0, build: 1.28 + rng() * 0.12,
        top: kit.jersey, bottom: kit.pants, head: helmetOn ? team.helmet.shell : pick(['#1a1410', '#2a1a10', '#0a0806']),
        skin: pick(SKINS), accent: kit.collar || team.colors.secondary, seed: rng(), kind: 'player', side: s,
      });
    }
    // coaches
    const nc = opts.coaches ?? 3;
    for (let i = 0; i < nc; i++) {
      list.push({
        x: s * (hw + (ctx.paint.border === 'pro' ? 4.6 : 2.8) + rng() * 0.8), z: (rng() - 0.5) * 2 * zc * 0.7,
        ry: (s < 0 ? Math.PI / 2 : -Math.PI / 2) + (rng() - 0.5) * 0.8,
        pose: pick([1, 5, 5, 0]), build: 1.05 + rng() * 0.1,
        top: rng() < 0.6 ? team.colors.primary : '#1a1c20', bottom: pick(['#c8b48a', '#1a1a1c', '#3a3e46']),
        head: rng() < 0.6 ? team.colors.primary : '#d8d8d0', skin: pick(SKINS), accent: '#111111', seed: rng(), kind: 'coach',
      });
    }
  }

  // ---- photographers: kneeling behind the end lines, a few standing near the corners
  const nPh = Math.round((opts.photographers ?? 8) * (low ? 0.5 : 1));
  for (const s of [-1, 1]) {
    for (let i = 0; i < nPh; i++) {
      const behind = i < nPh * 0.65;
      const x = behind ? (rng() - 0.5) * 2 * (hw - 2) : (rng() < 0.5 ? -1 : 1) * (hw + 3 + rng() * 1.5);
      const z = behind ? s * (field.end + 2.6 + rng() * 1.5) : s * (hl - 4 - rng() * 10);
      // face the field (toward z = 0 / x = 0)
      const ry = behind ? (s > 0 ? Math.PI : 0) + (rng() - 0.5) * 0.7 : Math.atan2(-x, -z * 0.3);
      list.push({
        x, z, ry, pose: 2, kneel: behind ? 1 : 0, build: 1.0,
        top: pick(['#1a1a1c', '#2a2c30', '#3a3a3e', '#4a4a40', '#e8e8e0']), bottom: pick(['#1a1a1c', '#3a3a3a', '#5a5040']),
        head: pick(['#1a1410', '#202024', '#c8c0a8']), skin: pick(SKINS), accent: '#1a1a1a', seed: rng(), kind: 'photo',
      });
    }
  }

  // ---- cheerleaders: home sideline, by the end zones, facing the stands
  if (opts.cheer !== false) {
    const kit = kitOf(home, 'home');
    const n = low ? 3 : opts.cheer === 'big' ? 7 : 5;
    for (const zg of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        list.push({
          x: -(hw + 3.4 + (i % 2) * 1.0), z: zg * (hl - 6) + (i - n / 2) * 1.2,
          ry: -Math.PI / 2 + (rng() - 0.5) * 0.3, pose: 3, build: 0.95,
          top: home.colors.primary, bottom: home.colors.accent === '#ffffff' || !home.colors.accent ? '#ffffff' : kit.pants,
          head: pick(['#3a2210', '#c89a50', '#1a1008', '#6a3a18']), skin: pick(SKINS),
          accent: home.colors.secondary, seed: rng(), kind: 'cheer', scale: 0.93,
        });
      }
    }
  }

  // ---- chain gang (3) — placed by setChains
  const chainSide = opts.chainSide ?? 1;
  const chainX = chainSide * (hw + (ctx.paint.border === 'pro' ? 1.2 : 1.6));
  const crew0 = list.length;
  const vest = opts.vest || '#ff7a12';
  for (let i = 0; i < 3; i++) {
    list.push({
      x: chainX, z: -5 + i * 5, ry: chainSide > 0 ? -Math.PI / 2 : Math.PI / 2, pose: 4, build: 1.05,
      top: vest, bottom: '#1a1a1c', head: i === 2 ? '#ffffff' : '#1a1a1c', skin: pick(SKINS), accent: '#ffffff', seed: rng(), kind: 'chain',
    });
  }

  const figs = buildFigures(list, ctx);
  group.add(figs.mesh);

  // ---- sticks, chain, down box
  const gear = new THREE.Group();
  gear.name = 'chains';
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.5, metalness: 0.4 });
  const markMat = new THREE.MeshStandardMaterial({ color: 0xff5a0a, roughness: 0.6, emissive: 0xff3a00, emissiveIntensity: 0.4 });
  const stickGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6);
  stickGeo.translate(0, 1.3, 0);
  const markGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 14);
  markGeo.rotateX(Math.PI / 2);
  markGeo.translate(0, 2.55, 0);
  const sticks = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(stickGeo, stickMat));
    if (i < 2) g.add(new THREE.Mesh(markGeo, markMat));
    g.children.forEach((m) => { m.castShadow = true; });
    gear.add(g);
    sticks.push(g);
  }
  // down box: four faces showing the down
  const [dc, dx] = cv(512, 128);
  for (let k = 0; k < 4; k++) {
    dx.fillStyle = '#ff6a10';
    dx.fillRect(k * 128, 0, 128, 128);
    blockText(dx, String(k + 1), k * 128 + 64, 108, 88, { align: 'center', color: '#111111', weight: 1.2 });
  }
  const dTex = tex(dc, { repeat: false, aniso: 4 });
  dTex.repeat.set(0.25, 1);
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ map: dTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: dTex, emissiveIntensity: 0.25 }));
  boxMesh.position.y = 2.75;
  sticks[2].add(boxMesh);
  const chainGeo = new THREE.BoxGeometry(0.04, 0.03, 1);
  chainGeo.translate(0, 0.02, 0.5);
  const chain = new THREE.Mesh(chainGeo, new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.4, metalness: 0.8 }));
  gear.add(chain);
  group.add(gear);

  const api = {
    group, figures: figs, list,
    setChains({ los, firstDown, dir = 1, show = true }) {
      const ok = show !== false && Number.isFinite(los);
      gear.visible = ok;
      const zf = Number.isFinite(firstDown) ? firstDown : los + 10 * dir;
      const zb = zf - 10 * (dir || 1);
      const zs = ok ? [zb, zf, los] : [-3, 3, 0];
      const off = [0.0, 0.0, 0.0];
      for (let i = 0; i < 3; i++) {
        const z = Math.max(-field.end, Math.min(field.end, zs[i]));
        sticks[i].position.set(chainX + chainSide * 0.15, 0, z);
        // crew stand just outside their stick
        figs.setAt(crew0 + i, chainX + chainSide * (0.55 + off[i]), z + (i === 2 ? 0.3 : 0), chainSide > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      chain.position.set(chainX + chainSide * 0.15, 0, Math.min(zb, zf));
      chain.scale.z = Math.abs(zf - zb);
    },
    setDown(d) {
      const k = Math.max(1, Math.min(4, d | 0)) - 1;
      dTex.offset.x = k * 0.25;
    },
    update(dt, t) { figs.uniforms.uTime.value = t; },
  };
  api.setChains({ los: 0, firstDown: 10, dir: 1, show: false });
  api.setDown(1);
  return api;
}
