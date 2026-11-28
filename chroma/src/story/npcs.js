// Hub characters and furniture: Dabble (a Smudge who got splashed with color and
// now runs the Hue Shard shop), Agent Tint (rescued Chroma Guard agent), supply
// terminals (the shop, in sector hubs), Swatch Book lecterns and sector gates.
import * as THREE from 'three';
import { Dripkin } from '../actors/character.js';
import { part, rod, std, gooMat, glowMat, canvasTexture, textSprite, HFONT, BFONT, OUTLINE_S, OUTLINE_M, disposeTree } from './kit.js';

const damp = (r, dt) => 1 - Math.exp(-r * dt);
const angleTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function label(parent, text, y, color = '#ffe0f0') {
  const s = textSprite(text, { color, scale: 0.26 });
  s.position.set(0, y, 0);
  parent.add(s);
  return s;
}
function bang(parent, y) {
  const s = textSprite('!', { color: '#1b1530', bg: '#ffd21a', scale: 0.34, size: 70 });
  s.position.set(0, y, 0);
  parent.add(s);
  return s;
}

class NPCBase {
  constructor(parent, d) {
    this.kind = d.kind;
    this.pos = d.pos.clone();
    this.yaw = d.yaw; this.baseYaw = d.yaw;
    this.root = new THREE.Group();
    this.root.position.copy(d.pos);
    parent.add(this.root);
    this.t = Math.random() * 5;
    this.radius = 2.6;
    this.attention = false;
  }
  faceToward(p, dt, rate = 4) {
    const near = p && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 7;
    const want = near ? Math.atan2(p.x - this.pos.x, p.z - this.pos.z) : this.baseYaw;
    this.yaw += angleTo(this.yaw, want) * damp(rate, dt);
  }
  setAttention(on) { this.attention = on; if (this.bang) this.bang.visible = on; }
  dispose() { disposeTree(this.root); }
}

// ---------------------------------------------------------------- Dabble
export class Dabble extends NPCBase {
  constructor(parent, d) {
    super(parent, d);
    this.name = 'Dabble';
    this.label = 'Shop with <b>Dabble</b>';
    // the stall
    const stall = new THREE.Group();
    stall.position.set(0, 0, 0);
    this.root.add(stall);
    const wood = std(0x8a5a3a, 0.8), dark = std(0x2b2833, 0.6, 0.4);
    part(stall, new THREE.BoxGeometry(2.6, 0.95, 0.8), wood, { pos: [0, 0.475, 0.9], outline: OUTLINE_S });
    part(stall, new THREE.BoxGeometry(2.7, 0.08, 0.9), std(0xf4f1ea, 0.6), { pos: [0, 0.99, 0.9], shadow: false });
    for (const x of [-1.25, 1.25]) part(stall, new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), dark, { pos: [x, 1.25, 1.25], shadow: false });
    // striped awning
    const aw = canvasTexture(256, 64, (ctx, w, h) => { for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fff6f0' : '#ff8ccf'; ctx.fillRect(i * w / 8, 0, w / 8, h); } });
    const am = new THREE.MeshStandardMaterial({ map: aw, roughness: 0.8, side: THREE.DoubleSide });
    const awn = part(stall, new THREE.PlaneGeometry(2.8, 1.1), am, { pos: [0, 2.45, 0.85], rot: [-1.0, 0, 0], shadow: false });
    void awn;
    const sign = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 30); ctx.fill();
      ctx.strokeStyle = '#ff8ccf'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(12, 12, w - 24, h - 24, 24); ctx.stroke();
      ctx.font = `56px ${HFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe0f0';
      ctx.fillText('DABBLE\'S SWAP SHOP', w / 2, h / 2 + 4, w - 60);
    });
    part(stall, new THREE.PlaneGeometry(2.3, 0.58), new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.5 }), { pos: [0, 2.95, 1.0], rot: [0.2, 0, 0], shadow: false });
    // jars of shards on the counter
    const jar = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false });
    for (const x of [-0.9, 0.85]) {
      part(stall, new THREE.CylinderGeometry(0.18, 0.18, 0.4, 14), jar, { pos: [x, 1.23, 0.95], shadow: false });
      part(stall, new THREE.OctahedronGeometry(0.11, 0), glowMat(x < 0 ? 0x9ff4ff : 0xffe08a, 2), { pos: [x, 1.2, 0.95], shadow: false });
    }
    // Dabble: a little pink goo blob behind the counter
    const body = this.body = new THREE.Group();
    body.position.set(0, 0.55, 0.25);
    this.root.add(body);
    const pink = gooMat(0xff8ccf, { emissive: 0x401028 });
    part(body, new THREE.SphereGeometry(0.55, 24, 18), pink, { pos: [0, 0.5, 0], scale: [1.1, 0.9, 1.1], outline: OUTLINE_M });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(body, new THREE.SphereGeometry(0.16, 10, 8), pink, { pos: [Math.cos(a) * 0.5, 0.12, Math.sin(a) * 0.5], scale: [1, 0.7, 1], shadow: false }); }
    const white = std(0xffffff, 0.2), dk = std(0x1b1530, 0.4);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = part(body, new THREE.SphereGeometry(0.17, 16, 12), white, { pos: [0.21 * s, 0.72, 0.43], outline: OUTLINE_S });
      part(e, new THREE.SphereGeometry(0.09, 10, 8), dk, { pos: [0, 0.01, 0.11], shadow: false });
      part(e, new THREE.SphereGeometry(0.03, 6, 4), white, { pos: [0.03, 0.05, 0.17], shadow: false });
      this.eyes.push(e);
    }
    part(body, new THREE.TorusGeometry(0.13, 0.03, 6, 14, Math.PI), dk, { pos: [0, 0.48, 0.5], rot: [0, 0, Math.PI], shadow: false });
    for (const s of [-1, 1]) part(body, new THREE.SphereGeometry(0.07, 8, 6), std(0xff5da8, 0.6), { pos: [0.34 * s, 0.55, 0.42], shadow: false });
    // tiny shop cap
    part(body, new THREE.CylinderGeometry(0.25, 0.28, 0.16, 16), std(0x3cb4ff, 0.5), { pos: [0, 1.0, 0], outline: OUTLINE_S });
    part(body, new THREE.BoxGeometry(0.34, 0.03, 0.2), std(0x3cb4ff, 0.5), { pos: [0, 0.93, 0.25], shadow: false });
    this.tag = label(this.root, 'DABBLE', 2.2, '#ffd6ec');
    this.bang = bang(this.root, 2.6);
    this.root.rotation.y = d.yaw;
    this.hop = 0;
  }
  update(dt, p) {
    this.t += dt;
    this.hop = Math.max(0, this.hop - dt * 2);
    const b = Math.abs(Math.sin(this.t * 3.2)) * 0.08 + Math.sin(this.hop * Math.PI) * 0.35;
    this.body.position.y = 0.55 + b;
    this.body.scale.set(1 + Math.sin(this.t * 6.4) * 0.03, 1 - Math.sin(this.t * 6.4) * 0.03, 1);
    for (const e of this.eyes) e.scale.y = Math.sin(this.t * 0.8) > 0.985 ? 0.15 : 1;
    if (p) {
      const local = Math.atan2(p.x - this.pos.x, p.z - this.pos.z) - this.baseYaw;
      this.body.rotation.y += (Math.max(-0.8, Math.min(0.8, angleTo(0, local))) - this.body.rotation.y) * damp(5, dt);
    }
    if (this.bang) this.bang.position.y = 2.6 + Math.sin(this.t * 4) * 0.08;
  }
  greet() { this.hop = 1; }
}

// ---------------------------------------------------------------- Agent Tint (a Chromeleon)
const TINT_LOOK = { skin: '#5fb8a6', pattern: 'bands', patternColor: '#1f4f6b', crest: 'fan', eyes: '#ffd23f', bottom: '#1d3557', hat: 'goggles', clothes: 'jacket_night', shoes: 'boots_black' };
export class Agent extends NPCBase {
  constructor(parent, d, scene) {
    super(parent, d);
    this.name = 'Agent Tint';
    this.label = 'Talk to <b>Agent Tint</b>';
    const m = this.model = new Dripkin(TINT_LOOK, '#2ee6c8', 'longshot');
    m.root.scale.setScalar(1.04);
    this.root.add(m.root);
    m.emote = 'think';
    this.tag = label(this.root, 'AGENT TINT', 2.15, '#c8fff4');
    this.bang = bang(this.root, 2.55);
    this.wave = 0;
    void scene;
  }
  update(dt, p) {
    this.t += dt;
    this.faceToward(p, dt);
    this.model.root.rotation.y = this.yaw;
    if (this.wave > 0) { this.wave -= dt; this.model.emote = 'wave'; } else this.model.emote = this.cheer ? 'cheer' : 'think';
    this.model.update(dt, { speed: 0, grounded: true, vy: 0, pitch: 0, weapon: null });
    if (this.bang) this.bang.position.y = 2.55 + Math.sin(this.t * 4) * 0.08;
  }
  greet() { this.wave = 1.4; }
  dispose() { this.model.dispose?.(); super.dispose(); }
}

// ---------------------------------------------------------------- supply terminal (shop in sector hubs)
export class Terminal extends NPCBase {
  constructor(parent, d) {
    super(parent, d);
    this.name = 'Supply Terminal';
    this.label = 'Use the <b>Supply Terminal</b> (upgrades)';
    this.radius = 2.2;
    const iron = std(0x3a3742, 0.45, 0.7);
    part(this.root, new THREE.BoxGeometry(1.4, 1.1, 0.8), iron, { pos: [0, 0.55, 0], outline: OUTLINE_S });
    part(this.root, new THREE.BoxGeometry(1.5, 0.12, 0.95), std(0x2b2833, 0.5, 0.6), { pos: [0, 1.16, 0.05], rot: [0.35, 0, 0], shadow: false });
    const scr = canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#0b2a2f'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9ff4ff'; ctx.font = `44px ${HFONT}`; ctx.textAlign = 'center'; ctx.fillText('◆ SUPPLY', w / 2, 64);
      ctx.font = `800 22px ${BFONT}`; ctx.fillStyle = '#5fd8ff'; ctx.fillText('upgrades for shards', w / 2, 104);
      ctx.fillText('— Dabble Co. —', w / 2, 136);
    });
    this.scrMat = new THREE.MeshBasicMaterial({ map: scr });
    part(this.root, new THREE.PlaneGeometry(1.2, 0.75), this.scrMat, { pos: [0, 1.62, -0.12], rot: [-0.25, 0, 0], shadow: false });
    part(this.root, new THREE.BoxGeometry(1.3, 0.85, 0.12), iron, { pos: [0, 1.62, -0.2], rot: [-0.25, 0, 0], shadow: false });
    this.lamp = part(this.root, new THREE.SphereGeometry(0.08, 8, 6), glowMat(0x5ee05a, 3), { pos: [0.55, 1.1, 0.35], shadow: false });
    this.root.rotation.y = d.yaw;
  }
  update(dt) { this.t += dt; this.lamp.visible = Math.sin(this.t * 3) > -0.4; }
}

// ---------------------------------------------------------------- swatch book lectern
export class Lectern extends NPCBase {
  constructor(parent, d) {
    super(parent, d);
    this.name = 'Swatch Book';
    this.label = 'Read the <b>Swatch Book</b> (collection)';
    this.radius = 2.0;
    const wood = std(0x6b4a32, 0.8);
    part(this.root, new THREE.CylinderGeometry(0.12, 0.2, 1.1, 10), wood, { pos: [0, 0.55, 0], outline: OUTLINE_S });
    part(this.root, new THREE.BoxGeometry(0.9, 0.08, 0.65), wood, { pos: [0, 1.15, 0], rot: [-0.35, 0, 0], outline: OUTLINE_S });
    const pages = canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d8d0c0'; ctx.fillRect(w / 2 - 2, 0, 4, h);
      const cols = ['#ff3d7f', '#ffc83d', '#22d3ee', '#5ee05a', '#b06bff', '#ff7a5c'];
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(20 + (i % 3) * 36 + (i >= 3 ? 128 : 0), 30, 26, 70); });
    });
    part(this.root, new THREE.PlaneGeometry(0.82, 0.56), new THREE.MeshStandardMaterial({ map: pages, roughness: 0.8, emissive: 0xffffff, emissiveMap: pages, emissiveIntensity: 0.25 }), { pos: [0, 1.2, 0.01], rot: [-Math.PI / 2 - 0.35, 0, 0], shadow: false });
    this.glow = part(this.root, new THREE.OctahedronGeometry(0.1, 0), glowMat(0xffd21a, 2.4), { pos: [0, 1.65, 0], shadow: false });
    this.root.rotation.y = d.yaw;
  }
  update(dt) { this.t += dt; this.glow.rotation.y += dt * 2; this.glow.position.y = 1.65 + Math.sin(this.t * 2) * 0.06; }
}

// ---------------------------------------------------------------- sector gate (big door between hubs)
export class SectorGate {
  constructor(parent, d, sector, open, done) {
    this.to = d.to; this.needs = d.needs; this.pos = d.pos.clone(); this.open = open; this.sector = sector;
    const g = this.root = new THREE.Group();
    g.position.copy(d.pos);
    g.rotation.y = d.yaw;
    parent.add(g);
    const color = new THREE.Color(sector.color);
    const iron = std(0x3a3742, 0.45, 0.7);
    // arch
    for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.5, 4.6, 0.6), iron, { pos: [s * 2.0, 2.3, 0], outline: OUTLINE_S });
    part(g, new THREE.BoxGeometry(4.6, 0.6, 0.6), iron, { pos: [0, 4.75, 0], outline: OUTLINE_S });
    // doors (slid apart when open)
    const doorMat = open ? new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.35), emissive: color, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.5 }) : std(0x55525d, 0.55, 0.6);
    this.doors = [];
    for (const s of [-1, 1]) {
      const dm = part(g, new THREE.BoxGeometry(1.75, 4.1, 0.2), doorMat, { pos: [s * (open ? 1.85 : 0.9), 2.1, -0.05], outline: OUTLINE_S });
      this.doors.push(dm);
    }
    // glowing portal when open
    if (open) {
      this.portalMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      part(g, new THREE.PlaneGeometry(3.5, 4.1), this.portalMat, { pos: [0, 2.1, -0.1], shadow: false });
    } else {
      const chain = std(0x2e2b35, 0.5, 0.8);
      for (const r of [0.75, -0.75]) part(g, new THREE.BoxGeometry(4.0, 0.14, 0.2), chain, { pos: [0, 2.2, 0.25], rot: [0, 0, r], shadow: false });
      part(g, new THREE.BoxGeometry(0.6, 0.7, 0.3), std(0x8a6a30, 0.4, 0.8), { pos: [0, 2.2, 0.35], outline: OUTLINE_S });
    }
    // sign
    const tex = canvasTexture(512, 192, (ctx, w, h) => {
      ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 30); ctx.fill();
      ctx.strokeStyle = open ? sector.color : '#55525d'; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(14, 14, w - 28, h - 28, 22); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 30px ${BFONT}`; ctx.fillStyle = open ? sector.color : '#8a8794';
      ctx.fillText(`SECTOR ${sector.num}`, w / 2, 56);
      ctx.font = `52px ${HFONT}`; ctx.fillStyle = open ? '#ffffff' : '#8a8794';
      ctx.fillText(sector.name.toUpperCase(), w / 2, 110, w - 50);
      ctx.font = `800 24px ${BFONT}`; ctx.fillStyle = done ? '#7dff7a' : open ? '#ffd21a' : '#8a8794';
      ctx.fillText(done ? 'SECTOR CLEARED ✓' : open ? 'OPEN · PRESS E' : 'SEALED', w / 2, 156);
    });
    this.signMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6 });
    part(g, new THREE.PlaneGeometry(3.4, 1.28), this.signMat, { pos: [0, 5.75, 0.05], shadow: false });
    part(g, new THREE.BoxGeometry(3.5, 1.36, 0.08), iron, { pos: [0, 5.75, -0.01], shadow: false });
    this.t = 0;
  }
  update(dt, fx) {
    this.t += dt;
    if (this.portalMat) {
      this.portalMat.opacity = 0.3 + Math.sin(this.t * 2.2) * 0.1;
      if (fx && Math.random() < dt * 6) {
        const a = this.root.rotation.y;
        const x = (Math.random() - 0.5) * 3.2;
        fx.spawn(new THREE.Vector3(this.pos.x + Math.cos(a) * x, this.pos.y + 0.2, this.pos.z - Math.sin(a) * x), new THREE.Vector3(0, 1.6, 0), new THREE.Color(this.sector.color), 0.05, 1.4, { grav: -0.05, drag: 1 });
      }
    }
  }
  dispose() { disposeTree(this.root); }
}

export function makeNPC(parent, d, scene) {
  if (d.kind === 'dabble') return new Dabble(parent, d);
  if (d.kind === 'tint') return new Agent(parent, d, scene);
  if (d.kind === 'terminal') return new Terminal(parent, d);
  if (d.kind === 'book') return new Lectern(parent, d);
  return null;
}
