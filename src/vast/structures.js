// Landmark structures + the POI manager: builds shrines, ruins, camps,
// villages, towers, stones and obelisks near the player, animates them
// (fires, crystals, relics, villagers), and runs the discovery/interaction
// rules. Pure-logic placement lives in poi.js; this file is the 3D half.

import * as THREE from 'three';
import { mulberry32, hashU32, clamp } from './noise.js';
import { DISCOVER_R } from './poi.js';

const STONE = 0x8a857c, STONE_D = 0x6e6a62, WOOD = 0x6a4a2c, THATCH = 0xb89a56;
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---- structure builders (origin = ground level at the POI) -----------------
function buildShrine(rng, lit) {
  const g = new THREE.Group();
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.9, 10), lam(STONE));
  dais.position.y = 0.45; dais.castShadow = true; g.add(dais);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = box(0.5, 3.4, 0.5, STONE_D, Math.cos(a) * 2.6, 2.4, Math.sin(a) * 2.6);
    g.add(p);
    g.add(box(0.7, 0.35, 0.7, STONE, Math.cos(a) * 2.6, 4.2, Math.sin(a) * 2.6));
  }
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55),
    new THREE.MeshLambertMaterial({ color: 0x8fd8ff, emissive: 0x2b7d9e, emissiveIntensity: lit ? 1.6 : 0.35 })
  );
  crystal.position.y = 2.6;
  g.add(crystal);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.9, 130, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  beam.position.y = 66;
  beam.visible = !!lit;
  g.add(beam);
  const glow = new THREE.PointLight(0x7fd4ff, lit ? 1.4 : 0.0, 26);
  glow.position.y = 3;
  g.add(glow);
  return { group: g, parts: { crystal, beam, glow } };
}

function buildRuin(rng) {
  const g = new THREE.Group();
  const n = 5 + (rng() * 4 | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const r = 3.5 + rng() * 3;
    const h = 0.8 + rng() * 2.6;
    const wall = box(2 + rng() * 1.6, h, 0.7, rng() < 0.5 ? STONE : STONE_D, Math.cos(a) * r, h / 2, Math.sin(a) * r);
    wall.rotation.y = -a + rng() * 0.4;
    g.add(wall);
  }
  for (let i = 0; i < 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 3 + rng() * 2, 8), lam(STONE));
    col.castShadow = true;
    col.position.set((rng() - 0.5) * 6, 0.4, (rng() - 0.5) * 6);
    col.rotation.z = Math.PI / 2 - 0.15 + rng() * 0.3;
    col.rotation.y = rng() * Math.PI;
    g.add(col);
  }
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 1.6, 8), lam(STONE_D));
  stump.position.set(2 + rng(), 0.8, -1 - rng());
  stump.castShadow = true;
  g.add(stump);
  return { group: g, parts: {} };
}

function buildCamp(rng) {
  const g = new THREE.Group();
  const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 3, 1, false, Math.PI / 2), lam(0x7a6448));
  tent.rotation.z = Math.PI / 2;
  tent.position.set(-2.6, 1.02, 0.5);
  tent.rotation.y = rng() * Math.PI;
  tent.castShadow = true;
  g.add(tent);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(box(0.5, 0.35, 0.5, STONE_D, Math.cos(a) * 0.9, 0.18, Math.sin(a) * 0.9));
  }
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.4, 7), lam(WOOD));
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.7;
  log.position.set(1.9, 0.28, 1.4);
  log.castShadow = true;
  g.add(log);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.1, 7),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  flame.position.y = 0.7;
  g.add(flame);
  const fire = new THREE.PointLight(0xff8a3c, 1.6, 22);
  fire.position.y = 1.2;
  g.add(fire);
  return { group: g, parts: { flame, fire } };
}

function buildStones(rng) {
  const g = new THREE.Group();
  const n = 5 + (rng() * 5 | 0);
  const r = 5.5 + rng() * 3.5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 2.2 + rng() * 2.4;
    const s = box(0.9 + rng() * 0.5, h, 0.6, rng() < 0.4 ? STONE_D : STONE, Math.cos(a) * r, h / 2 - 0.3, Math.sin(a) * r);
    s.rotation.set((rng() - 0.5) * 0.16, a, (rng() - 0.5) * 0.16);
    g.add(s);
  }
  return { group: g, parts: {} };
}

function buildTower(rng) {
  const g = new THREE.Group();
  const H = 9;
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, H, 6), lam(WOOD));
    leg.position.set(sx * 1.5, H / 2, sz * 1.5);
    leg.rotation.z = -sx * 0.09;
    leg.rotation.x = sz * 0.09;
    leg.castShadow = true;
    g.add(leg);
    if (i < 2) {
      g.add(box(2.6, 0.14, 0.14, WOOD, 0, 2.4 + i * 2.6, sz * 1.35));
      g.add(box(0.14, 0.14, 2.6, WOOD, sx * 1.35, 3.7 + i * 2.6, 0));
    }
  }
  g.add(box(3.4, 0.25, 3.4, 0x7a5a36, 0, H, 0));
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    g.add(box(0.12, 1, 0.12, WOOD, sx * 1.55, H + 0.6, sz * 1.55));
  }
  g.add(box(3.5, 0.12, 0.12, WOOD, 0, H + 1.1, 1.55));
  g.add(box(3.5, 0.12, 0.12, WOOD, 0, H + 1.1, -1.55));
  g.add(box(0.12, 0.12, 3.5, WOOD, 1.55, H + 1.1, 0));
  g.add(box(0.12, 0.12, 3.5, WOOD, -1.55, H + 1.1, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.6, 4), lam(THATCH));
  roof.position.y = H + 2.2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  return { group: g, parts: {} };
}

function buildHut(rng, x, z, rot) {
  const g = new THREE.Group();
  const w = 3 + rng() * 1.4, d = 2.6 + rng() * 1.2, h = 2 + rng() * 0.5;
  const base = box(w, h, d, rng() < 0.4 ? 0x9c8a6e : 0x8a7a5e, 0, h / 2, 0);
  g.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, 1.6 + rng() * 0.7, 4), lam(THATCH));
  roof.position.y = h + 0.8;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = box(0.7, 1.3, 0.08, 0x4a3826, 0, 0.65, d / 2 + 0.02);
  door.castShadow = false;
  g.add(door);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

function buildVillage(rng) {
  const g = new THREE.Group();
  const n = 4 + (rng() * 3 | 0);
  const homes = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.4;
    const r = 7 + rng() * 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    g.add(buildHut(rng, x, z, -a + Math.PI / 2 + (rng() - 0.5) * 0.4));
    homes.push([x, z]);
  }
  // well
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 9), lam(STONE));
  well.position.y = 0.45; well.castShadow = true;
  g.add(well);
  g.add(box(0.14, 2, 0.14, WOOD, -0.9, 1.4, 0));
  g.add(box(0.14, 2, 0.14, WOOD, 0.9, 1.4, 0));
  const wr = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), lam(THATCH));
  wr.position.y = 2.7; wr.rotation.y = Math.PI / 4;
  g.add(wr);
  // lantern post
  const post = box(0.16, 3, 0.16, WOOD, 2.6, 1.5, 2.6);
  g.add(post);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc86e }));
  lampGlow.position.set(2.6, 2.9, 2.6);
  g.add(lampGlow);
  const lamp = new THREE.PointLight(0xffb45e, 0, 20);
  lamp.position.set(2.6, 3, 2.6);
  g.add(lamp);
  return { group: g, parts: { lamp, lampGlow, homes } };
}

function buildObelisk(rng) {
  const g = new THREE.Group();
  const h = 10 + rng() * 6;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, h, 4), lam(0x565266));
  shaft.position.y = h / 2;
  shaft.rotation.y = rng() * Math.PI;
  shaft.castShadow = true;
  g.add(shaft);
  g.add(box(2.4, 0.7, 2.4, STONE_D, 0, 0.35, 0));
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
    new THREE.MeshLambertMaterial({ color: 0xd8b3ff, emissive: 0x7a3fae, emissiveIntensity: 1.2 }));
  tip.position.y = h + 0.6;
  g.add(tip);
  return { group: g, parts: { tip } };
}

function buildRelic() {
  const relic = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.36, 0),
    new THREE.MeshLambertMaterial({ color: 0xffd870, emissive: 0xcc8f1a, emissiveIntensity: 1.5 })
  );
  const halo = new THREE.PointLight(0xffce5e, 0.9, 10);
  relic.add(halo);
  return relic;
}

// simple villager: body + head + hat, wanders near home
function buildVillager(rng) {
  const g = new THREE.Group();
  const cloth = [0x8a4a3a, 0x4a6a8a, 0x6a8a4a, 0x8a7a4a][(rng() * 4) | 0];
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.0, 7), lam(cloth));
  body.position.y = 0.75; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 7), lam(0xc98f68));
  head.position.y = 1.48;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.24, 8), lam(THATCH));
  hat.position.y = 1.66;
  g.add(hat);
  return g;
}

const BUILDERS = { ruin: buildRuin, camp: buildCamp, stones: buildStones, tower: buildTower, village: buildVillage, obelisk: buildObelisk };

// ---- the manager ------------------------------------------------------------
const ACTIVE_R = 640, DROP_R = 720;

export class POIManager {
  constructor(scene, world, poiField, state) {
    this.scene = scene;
    this.world = world;
    this.field = poiField;
    this.state = state; // { discovered:Set, litShrines:Set, relics:Set, rumors:Set }
    this.active = new Map(); // id → record
    this.time = 0;
    this.prompt = null;      // current interactable {kind, poi, dist}
    this.onDiscover = null; this.onRelic = null; this.onShrine = null;
    this.onRest = null; this.onSurvey = null;
  }

  _build(poi) {
    const rng = mulberry32(hashU32(Math.imul(poi.x | 0, 73856093) ^ Math.imul(poi.z | 0, 19349663) ^ this.world.seed));
    let built;
    if (poi.type === 'shrine') built = buildShrine(rng, this.state.litShrines.has(poi.id));
    else built = BUILDERS[poi.type](rng);
    const { group, parts } = built;
    group.position.set(poi.x, poi.y - 0.15, poi.z);
    group.rotation.y = poi.variant * Math.PI * 2;

    const rec = { poi, group, parts, villagers: [], flicker: Math.random() * 10 };
    if (poi.hasRelic && !this.state.relics.has(poi.id)) {
      rec.relic = buildRelic();
      rec.relic.position.set(0, 1.6, 0);
      group.add(rec.relic);
    }
    if (poi.type === 'village') {
      const n = 2 + (rng() * 2 | 0);
      for (let i = 0; i < n; i++) {
        const v = buildVillager(rng);
        const home = parts.homes[(rng() * parts.homes.length) | 0];
        const vr = {
          mesh: v, hx: home[0], hz: home[1],
          tx: home[0], tz: home[1], wait: rng() * 4,
        };
        v.position.set(home[0], 0, home[1]);
        group.add(v);
        rec.villagers.push(vr);
      }
    }
    this.scene.add(group);
    return rec;
  }

  update(px, pz, dt, isNight) {
    this.time += dt;

    // stream structures in/out (one build a frame keeps hitches invisible)
    const nearby = this.field.poisNear(px, pz, ACTIVE_R);
    let builtOne = false;
    for (const poi of nearby) {
      if (!this.active.has(poi.id) && !builtOne) {
        this.active.set(poi.id, this._build(poi));
        builtOne = true;
      }
    }
    for (const [id, rec] of this.active) {
      const d = Math.hypot(rec.poi.x - px, rec.poi.z - pz);
      if (d > DROP_R) {
        this.scene.remove(rec.group);
        rec.group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        this.active.delete(id);
      }
    }

    // per-frame rules on active POIs
    this.prompt = null;
    let bestD = 7;
    for (const rec of this.active.values()) {
      const poi = rec.poi;
      const d = Math.hypot(poi.x - px, poi.z - pz);

      if (d < DISCOVER_R && !this.state.discovered.has(poi.id)) {
        this.state.discovered.add(poi.id);
        this.state.rumors.delete(poi.id);
        if (this.onDiscover) this.onDiscover(poi);
      }

      // relic pickup by walking over it
      if (rec.relic && d < 3.2 && !this.state.relics.has(poi.id)) {
        this.state.relics.add(poi.id);
        rec.group.remove(rec.relic);
        rec.relic = null;
        if (this.onRelic) this.onRelic(poi);
      }

      // interact prompts
      if (d < bestD) {
        if (poi.type === 'shrine' && !this.state.litShrines.has(poi.id)) {
          this.prompt = { kind: 'awaken', poi, label: 'Awaken the shrine' }; bestD = d;
        } else if (poi.type === 'camp') {
          this.prompt = { kind: 'rest', poi, label: 'Rest until dawn' }; bestD = d;
        } else if (poi.type === 'tower') {
          this.prompt = { kind: 'survey', poi, label: 'Survey the land' }; bestD = d;
        }
      }

      // animations
      const t = this.time + rec.flicker;
      if (rec.relic) {
        rec.relic.position.y = 1.6 + Math.sin(t * 2.1) * 0.25;
        rec.relic.rotation.y = t * 1.4;
      }
      const P = rec.parts;
      if (P.crystal) {
        P.crystal.position.y = 2.6 + Math.sin(t * 1.3) * 0.18;
        P.crystal.rotation.y = t * 0.8;
        if (this.state.litShrines.has(poi.id)) {
          P.crystal.material.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.3;
          P.glow.intensity = 1.3 + Math.sin(t * 2.2) * 0.25;
        }
      }
      if (P.flame) {
        P.flame.scale.set(1 + Math.sin(t * 9) * 0.12, 1 + Math.sin(t * 13) * 0.22, 1);
        P.fire.intensity = 1.5 + Math.sin(t * 11) * 0.4 + Math.sin(t * 23) * 0.2;
      }
      if (P.lamp) P.lamp.intensity = isNight ? 1.3 : 0;
      if (P.tip) P.tip.rotation.y = t * 0.5;

      // villagers shuffle about (and turn in at night)
      for (const vr of rec.villagers) {
        if (isNight) {
          vr.mesh.visible = false;
          continue;
        }
        vr.mesh.visible = true;
        vr.wait -= dt;
        if (vr.wait <= 0) {
          vr.tx = vr.hx + (Math.random() - 0.5) * 14;
          vr.tz = vr.hz + (Math.random() - 0.5) * 14;
          vr.wait = 3 + Math.random() * 6;
        }
        const dx = vr.tx - vr.mesh.position.x, dz = vr.tz - vr.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.3) {
          const sp = Math.min(1.1 * dt, dist);
          vr.mesh.position.x += (dx / dist) * sp;
          vr.mesh.position.z += (dz / dist) * sp;
          vr.mesh.rotation.y = Math.atan2(dx, dz);
          vr.mesh.position.y = Math.sin(this.time * 9) * 0.03;
        }
      }
    }
  }

  interact() {
    const p = this.prompt;
    if (!p) return false;
    if (p.kind === 'awaken') {
      this.state.litShrines.add(p.poi.id);
      const rec = this.active.get(p.poi.id);
      if (rec) {
        rec.parts.beam.visible = true;
        rec.parts.glow.intensity = 1.4;
        rec.parts.crystal.material.emissiveIntensity = 1.6;
      }
      if (this.onShrine) this.onShrine(p.poi);
    } else if (p.kind === 'rest') {
      if (this.onRest) this.onRest(p.poi);
    } else if (p.kind === 'survey') {
      const found = this.field.poisNear(p.poi.x, p.poi.z, 1500)
        .filter((q) => !this.state.discovered.has(q.id) && !this.state.rumors.has(q.id) && q.id !== p.poi.id)
        .sort((a, b) => Math.hypot(a.x - p.poi.x, a.z - p.poi.z) - Math.hypot(b.x - p.poi.x, b.z - p.poi.z))
        .slice(0, 3);
      for (const q of found) this.state.rumors.add(q.id);
      if (this.onSurvey) this.onSurvey(p.poi, found);
    }
    return true;
  }

  dispose() {
    for (const rec of this.active.values()) {
      this.scene.remove(rec.group);
      rec.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.active.clear();
  }
}
