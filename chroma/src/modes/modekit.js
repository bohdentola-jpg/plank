// Shared helpers for the extra battle modes (Zone Clash, Hue Hoops):
// measuring ink inside an area of floor, glow textures, labels and beams.
import * as THREE from 'three';
import { TEAM_A, TEAM_B } from '../world/paint.js';

const PAD = 2; // must match paint.js

// Counts the floor texels of the paint atlas that fall inside an area.
// test(x, y, z) decides membership; hidden floor (covered by another solid)
// is skipped so every counted texel can really be painted.
export class InkSampler {
  constructor(paint, level, bounds, test) {
    const offs = [];
    const pts = [];
    const tpm = paint.tpm, S = paint.size;
    for (const f of paint.faces) {
      if (!f.isFloor || !f.paintable || !f.cw) continue;
      // reject faces far from the area (bounding circle vs rectangle in xz)
      const cx = Math.max(bounds.x0, Math.min(bounds.x1, f.center.x)), cz = Math.max(bounds.z0, Math.min(bounds.z1, f.center.z));
      if ((cx - f.center.x) ** 2 + (cz - f.center.z) ** 2 > (f.radius + 0.5) ** 2) continue;
      for (let j = 0; j < f.ch; j++) {
        const t = (j + 0.5) / tpm;
        for (let i = 0; i < f.cw; i++) {
          const s = (i + 0.5) / tpm;
          const x = f.origin.x + f.u.x * s + f.v.x * t;
          const y = f.origin.y + f.u.y * s + f.v.y * t;
          const z = f.origin.z + f.u.z * s + f.v.z * t;
          if (x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1) continue;
          if (!test(x, y, z)) continue;
          if (level.heightAt(x, z).y > y + 0.05) continue; // under another solid
          offs.push(((f.y0 + PAD + j) * S + f.x0 + PAD + i) * 4);
          // ~1 sample point per square metre for bots / aiming
          if ((i % Math.max(1, Math.round(tpm))) === 0 && (j % Math.max(1, Math.round(tpm))) === 0) pts.push({ p: new THREE.Vector3(x, y, z), face: f, s, t });
        }
      }
    }
    this.paint = paint;
    this.offs = Int32Array.from(offs);
    this.n = offs.length;
    this.points = pts;
    this.a = 0; this.b = 0;
  }

  // fractions of the area owned by each team (same rule as paint.ownerAtFace)
  measure() {
    const d = this.paint.data, o = this.offs;
    let a = 0, b = 0;
    for (let k = 0; k < o.length; k++) {
      const i = o[k];
      if (d[i] >= 128) a++;
      else if (d[i + 1] >= 128) b++;
    }
    const n = Math.max(1, this.n);
    this.a = a / n; this.b = b / n;
    this.ca = a; this.cb = b;
    return this;
  }

  of(team) { return team === TEAM_A ? this.a : team === TEAM_B ? this.b : 0; }

  // owner of one sample point (cheap per-point check for bots)
  ownerOf(pt) { return this.paint.ownerAtFace(pt.face, pt.s, pt.t); }
}

// ------------------------------------------------------------------ textures (cached per page)
const cache = {};
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const shared = (t) => { t.userData.shared = true; return t; };

// soft round glow (for halos / sprites)
export function glowTexture() {
  return cache.glow ||= shared(canvas(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }));
}

// vertical fade (bright at the bottom) for light curtains and beams
export function fadeTexture() {
  return cache.fade ||= shared(canvas(4, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }));
}

// diagonal stripes for zone floor tint
export function stripeTexture() {
  const t = cache.stripe ||= shared(canvas(64, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = -2; i < 4; i++) {
      x.beginPath();
      x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + 64, 64); x.lineTo(i * 32 + 64, 64);
      x.closePath(); x.fill();
    }
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// net mesh for the hoops (diamond lattice with alpha)
export function netTexture() {
  const t = cache.net ||= shared(canvas(128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 5;
    for (let i = -4; i <= 8; i++) {
      x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 128, h); x.stroke();
      x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 128, 0); x.stroke();
    }
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// glowball surface: bright panels with dark seams (emissive map too)
export function ballTexture() {
  return cache.ball ||= shared(canvas(256, 128, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,.0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#1b1530'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    for (const cx of [w * 0.25, w * 0.75]) { x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, h); x.stroke(); }
    x.lineWidth = 6;
    for (const cx of [0, w / 2, w]) { x.beginPath(); x.ellipse(cx, h / 2, w * 0.12, h * 0.5, 0, 0, Math.PI * 2); x.stroke(); }
  }));
}

// ------------------------------------------------------------------ meshes
// A text label that always faces the camera. setText() redraws it.
export function textSprite(text, { w = 512, h = 128, scale = [2.6, 0.65], color = '#ffffff', bg = 'rgba(27,21,48,.85)', size = 74 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scale[0], scale[1], 1);
  sp.renderOrder = 5;
  sp.setText = (t, col = color, back = bg) => {
    if (sp._t === t + col + back) return;
    sp._t = t + col + back;
    ctx.clearRect(0, 0, w, h);
    if (back) { ctx.fillStyle = back; ctx.beginPath(); ctx.roundRect(6, 6, w - 12, h - 12, h / 2 - 6); ctx.fill(); }
    ctx.font = `${size}px "Lilita One", "Arial Black", Impact, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12; ctx.strokeStyle = '#1b1530'; ctx.lineJoin = 'round';
    ctx.strokeText(t, w / 2, h / 2 + 4);
    ctx.fillStyle = col; ctx.fillText(t, w / 2, h / 2 + 4);
    tex.needsUpdate = true;
  };
  sp.setText(text);
  return sp;
}

// Tall additive light pillar (marks the ball / an open hoop from afar)
export function beam(radius = 0.18, height = 26, opacity = 0.5) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.6, height, 12, 1, true);
  geo.translate(0, height / 2, 0);
  // the fade texture is bright at the bottom of the cylinder and fades upward
  const mat = new THREE.MeshBasicMaterial({ map: fadeTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 3;
  return m;
}

// Launch velocity that carries a projectile from o to t in T seconds under gravity g.
export function ballisticVel(o, t, T, g, out = new THREE.Vector3()) {
  return out.set((t.x - o.x) / T, (t.y - o.y) / T + 0.5 * g * T, (t.z - o.z) / T);
}
