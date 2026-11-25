// Paint system. Every paintable surface is a rectangle ("face") with its own
// region in one big RGBA atlas: R = team A ink, G = team B ink, B = baked AO.
// Splats are rasterised on the CPU (exact gameplay queries + turf counts) and
// only the touched rectangles are re-uploaded to the GPU each frame.
import * as THREE from 'three';
import { clamp } from '../util.js';

export const NONE = 0, TEAM_A = 1, TEAM_B = 2;
const PAD = 2;
const _v = new THREE.Vector3();

export class PaintSystem {
  constructor({ size = 2048, tpm = 8 } = {}) {
    this.size = size;
    this.tpm = tpm;
    this.faces = [];
    this.data = null;
    this.texture = null;
    this.dirty = new Map();
    this.fullDirty = true;
    this.count = [0, 0, 0];
    this.floorTotal = 0;
    this.colors = [new THREE.Color(0xffffff), new THREE.Color(0xff2e88), new THREE.Color(0x3cf03c)];
    this.uniforms = {
      uPaint: { value: null },
      uColA: { value: this.colors[1] },
      uColB: { value: this.colors[2] },
      uNoise: { value: null },
      uInkBump: { value: 0.55 },
      uTime: { value: 0 },
    };
    this.frameGain = [0, 0, 0];
  }

  setColors(a, b) {
    this.colors[1].set(a);
    this.colors[2].set(b);
  }

  // Register a rectangular face. origin = corner, u/v = unit axes along the
  // face, w/h = size in metres along u/v. Returns the face object (uv mapping
  // available after finalize()).
  addFace(origin, u, v, w, h, opts = {}) {
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    const f = {
      id: this.faces.length,
      origin: origin.clone(), u: u.clone().normalize(), v: v.clone().normalize(), n,
      w, h, isFloor: opts.floor ?? n.y > 0.6, paintable: opts.paintable !== false,
      solid: opts.solid ?? null, x0: 0, y0: 0, tw: 0, th: 0,
      center: origin.clone().addScaledVector(u, w / 2).addScaledVector(v, h / 2),
      radius: Math.hypot(w, h) / 2,
    };
    this.faces.push(f);
    return f;
  }

  finalize() {
    // pick a texel density that fits the atlas
    const area = this.faces.reduce((s, f) => s + (f.w * this.tpm + 2 * PAD + 1) * (f.h * this.tpm + 2 * PAD + 1), 0);
    const cap = this.size * this.size * 0.82;
    if (area > cap) this.tpm = Math.max(2, Math.floor(this.tpm * Math.sqrt(cap / area) * 10) / 10);
    for (let attempt = 0; attempt < 8; attempt++) {
      if (this.pack()) break;
      this.tpm *= 0.9;
    }
    this.data = new Uint8Array(this.size * this.size * 4);
    for (let i = 0; i < this.data.length; i += 4) { this.data[i + 2] = 255; this.data[i + 3] = 255; }
    const tex = new THREE.DataTexture(this.data, this.size, this.size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.flipY = false;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    this.texture = tex;
    this.uniforms.uPaint.value = tex;
    this.floorTotal = 0;
    for (const f of this.faces) {
      f.cw = Math.ceil(f.w * this.tpm); f.ch = Math.ceil(f.h * this.tpm);
      if (f.isFloor && f.paintable) this.floorTotal += f.cw * f.ch;
    }
    this.count = [this.floorTotal, 0, 0];
  }

  pack() {
    const tpm = this.tpm, S = this.size;
    const order = [...this.faces].sort((a, b) => b.h - a.h);
    let x = 0, y = 0, rowH = 0;
    for (const f of order) {
      f.tw = Math.ceil(f.w * tpm) + 2 * PAD;
      f.th = Math.ceil(f.h * tpm) + 2 * PAD;
      if (f.tw > S || f.th > S) return false;
      if (x + f.tw > S) { x = 0; y += rowH; rowH = 0; }
      if (y + f.th > S) return false;
      f.x0 = x; f.y0 = y;
      x += f.tw; rowH = Math.max(rowH, f.th);
    }
    return true;
  }

  // Atlas UV for face-local coords (metres)
  uvOf(f, s, t, out = [0, 0]) {
    out[0] = (f.x0 + PAD + s * this.tpm) / this.size;
    out[1] = (f.y0 + PAD + t * this.tpm) / this.size;
    return out;
  }

  // ------------------------------------------------------------------ painting
  // Paint a sphere of radius r at world point p. Returns floor m² newly claimed.
  splat(p, r, team, opts = {}) {
    if (!this.data || team === NONE) return 0;
    const ph = opts.phase ?? Math.random() * 100;
    const wob = opts.wobble ?? 0.22;
    let gained = 0;
    const faces = this.faces;
    for (let k = 0; k < faces.length; k++) {
      const f = faces[k];
      if (!f.paintable) continue;
      const dx = p.x - f.center.x, dy = p.y - f.center.y, dz = p.z - f.center.z;
      const rr = r + f.radius;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      const ox = p.x - f.origin.x, oy = p.y - f.origin.y, oz = p.z - f.origin.z;
      const d = ox * f.n.x + oy * f.n.y + oz * f.n.z;
      if (d < -0.3 || d > r) continue;
      const dd = Math.max(d, 0);
      const rEff = Math.sqrt(Math.max(r * r - dd * dd, 0));
      if (rEff < 0.06) continue;
      const s = ox * f.u.x + oy * f.u.y + oz * f.u.z;
      const t = ox * f.v.x + oy * f.v.y + oz * f.v.z;
      const m = PAD / this.tpm;
      if (s + rEff * 1.3 < -m || s - rEff * 1.3 > f.w + m || t + rEff * 1.3 < -m || t - rEff * 1.3 > f.h + m) continue;
      gained += this.rasterDisc(f, s, t, rEff, team, ph, wob);
      if (opts.drips && Math.abs(f.n.y) < 0.35 && d < r * 0.6) this.drips(f, s, t, rEff, team, opts.drips);
    }
    return gained;
  }

  rasterDisc(f, s, t, rEff, team, ph, wob) {
    const tpm = this.tpm, S = this.size, data = this.data;
    const cx = s * tpm + PAD - 0.5, cy = t * tpm + PAD - 0.5;
    const rT = rEff * tpm;
    const rMax = rT * (1 + wob * 1.3) + 1.5;
    const i0 = Math.max(0, Math.floor(cx - rMax)), i1 = Math.min(f.tw - 1, Math.ceil(cx + rMax));
    const j0 = Math.max(0, Math.floor(cy - rMax)), j1 = Math.min(f.th - 1, Math.ceil(cy + rMax));
    if (i0 > i1 || j0 > j1) return 0;
    const ch = team === TEAM_A ? 0 : 1, oc = 1 - ch;
    const a1 = ph, a2 = ph * 1.7 + 1.3, a3 = ph * 2.3 + 4.1;
    let changed = false, gained = 0;
    const floor = f.isFloor;
    const ci0 = PAD, ci1 = PAD + f.cw, cj0 = PAD, cj1 = PAD + f.ch;
    for (let j = j0; j <= j1; j++) {
      const ddy = j - cy;
      let idx = ((f.y0 + j) * S + f.x0 + i0) * 4;
      for (let i = i0; i <= i1; i++, idx += 4) {
        const ddx = i - cx;
        const dist2 = ddx * ddx + ddy * ddy;
        if (dist2 > rMax * rMax) continue;
        const dist = Math.sqrt(dist2);
        let rn = rT;
        if (dist > rT * 0.45) {
          const ang = Math.atan2(ddy, ddx);
          rn = rT * (1 + wob * (0.55 * Math.sin(3 * ang + a1) + 0.3 * Math.sin(5 * ang + a2) + 0.25 * Math.sin(8 * ang + a3)));
        }
        let val = (rn - dist) * 0.5 + 0.5;
        if (val <= 0) continue;
        if (val > 1) val = 1;
        const v8 = (val * 255) | 0;
        const old = data[idx + ch], oldO = data[idx + oc];
        const nv = old > v8 ? old : v8;
        const no = oldO < 255 - v8 ? oldO : 255 - v8;
        if (nv === old && no === oldO) continue;
        if (floor && i >= ci0 && i < ci1 && j >= cj0 && j < cj1) {
          const before = old >= 128 ? team : oldO >= 128 ? 3 - team : 0;
          const after = nv >= 128 ? team : no >= 128 ? 3 - team : 0;
          if (before !== after) {
            this.count[before]--; this.count[after]++;
            if (after === team) gained++;
          }
        }
        data[idx + ch] = nv; data[idx + oc] = no;
        changed = true;
      }
    }
    if (changed) this.markDirty(f, i0, j0, i1, j1);
    return gained / (tpm * tpm);
  }

  // A few paint runs dribbling down a wall from a splat
  drips(f, s, t, rEff, team, n) {
    // world-down direction in face space
    let ds = -f.u.y, dt = -f.v.y;
    const l = Math.hypot(ds, dt);
    if (l < 0.5) return;
    ds /= l; dt /= l;
    const count = typeof n === 'number' ? n : 2;
    for (let k = 0; k < count; k++) {
      const off = (Math.random() - 0.5) * rEff * 1.2;
      const s0 = s + (-dt) * off, t0 = t + ds * off;
      const len = rEff * (0.8 + Math.random() * 1.8);
      const w0 = rEff * (0.2 + Math.random() * 0.14);
      this.rasterCapsule(f, s0, t0, s0 + ds * len, t0 + dt * len, w0, w0 * 0.55, team);
    }
  }

  rasterCapsule(f, sa, ta, sb, tb, ra, rb, team) {
    const tpm = this.tpm, S = this.size, data = this.data;
    const ax = sa * tpm + PAD - 0.5, ay = ta * tpm + PAD - 0.5;
    const bx = sb * tpm + PAD - 0.5, by = tb * tpm + PAD - 0.5;
    const RA = ra * tpm, RB = rb * tpm;
    const R = Math.max(RA, RB) + 1.5;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - R)), i1 = Math.min(f.tw - 1, Math.ceil(Math.max(ax, bx) + R));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by) - R)), j1 = Math.min(f.th - 1, Math.ceil(Math.max(ay, by) + R));
    if (i0 > i1 || j0 > j1) return;
    const ch = team === TEAM_A ? 0 : 1, oc = 1 - ch;
    const abx = bx - ax, aby = by - ay, len2 = abx * abx + aby * aby || 1;
    const floor = f.isFloor;
    for (let j = j0; j <= j1; j++) {
      let idx = ((f.y0 + j) * S + f.x0 + i0) * 4;
      for (let i = i0; i <= i1; i++, idx += 4) {
        let h = ((i - ax) * abx + (j - ay) * aby) / len2;
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        const px = ax + abx * h - i, py = ay + aby * h - j;
        const dist = Math.sqrt(px * px + py * py);
        const rad = RA + (RB - RA) * h + (h > 0.97 ? RB * 0.5 : 0);
        let val = (rad - dist) * 0.5 + 0.5;
        if (val <= 0) continue;
        if (val > 1) val = 1;
        const v8 = (val * 255) | 0;
        const old = data[idx + ch], oldO = data[idx + oc];
        const nv = old > v8 ? old : v8;
        const no = oldO < 255 - v8 ? oldO : 255 - v8;
        if (floor) {
          const before = old >= 128 ? team : oldO >= 128 ? 3 - team : 0;
          const after = nv >= 128 ? team : no >= 128 ? 3 - team : 0;
          if (before !== after) { this.count[before]--; this.count[after]++; }
        }
        data[idx + ch] = nv; data[idx + oc] = no;
      }
    }
    this.markDirty(f, i0, j0, i1, j1);
  }

  markDirty(f, i0, j0, i1, j1) {
    const x0 = f.x0 + i0, y0 = f.y0 + j0, x1 = f.x0 + i1, y1 = f.y0 + j1;
    const r = this.dirty.get(f.id);
    if (r) {
      if (x0 < r[0]) r[0] = x0; if (y0 < r[1]) r[1] = y0;
      if (x1 > r[2]) r[2] = x1; if (y1 > r[3]) r[3] = y1;
    } else this.dirty.set(f.id, [x0, y0, x1, y1]);
  }

  // ------------------------------------------------------------------ queries
  // Owner team of face-local point (s,t in metres)
  ownerAtFace(f, s, t) {
    if (!f || !this.data) return NONE;
    const i = clamp(Math.round(s * this.tpm + PAD - 0.5), 0, f.tw - 1);
    const j = clamp(Math.round(t * this.tpm + PAD - 0.5), 0, f.th - 1);
    const idx = ((f.y0 + j) * this.size + f.x0 + i) * 4;
    const a = this.data[idx], b = this.data[idx + 1];
    return a >= 128 ? TEAM_A : b >= 128 ? TEAM_B : NONE;
  }

  ownerAt(f, p) {
    if (!f) return NONE;
    _v.subVectors(p, f.origin);
    return this.ownerAtFace(f, _v.dot(f.u), _v.dot(f.v));
  }

  // Fraction of a small disc around p that is owned by team (for "mostly in ink")
  coverageAt(f, p, team, r = 0.3) {
    if (!f) return 0;
    _v.subVectors(p, f.origin);
    const s = _v.dot(f.u), t = _v.dot(f.v);
    let n = 0, k = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      k++;
      if (this.ownerAtFace(f, s + a * r * 0.7, t + b * r * 0.7) === team) n++;
    }
    return n / k;
  }

  coverage() {
    const T = Math.max(1, this.floorTotal);
    return { a: this.count[TEAM_A] / T, b: this.count[TEAM_B] / T };
  }

  areaOf(team) { return this.count[team] / (this.tpm * this.tpm); }

  clear() {
    if (!this.data) return;
    for (let i = 0; i < this.data.length; i += 4) { this.data[i] = 0; this.data[i + 1] = 0; }
    this.count = [this.floorTotal, 0, 0];
    this.fullDirty = true;
  }

  resetCounts() { this.count = [this.floorTotal, 0, 0]; }

  // Bake ambient occlusion into channel B using a signed distance function
  bakeAO(sdf, strength = 1) {
    const tpm = this.tpm, S = this.size, data = this.data;
    const H = [0.12, 0.3, 0.55, 0.9, 1.4];
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (const f of this.faces) {
      const area = f.w * f.h;
      const step = area > 1500 ? 0.5 : area > 300 ? 0.36 : 0.25; // metres between AO samples
      const ns = Math.max(2, Math.ceil(f.w / step) + 1), nt = Math.max(2, Math.ceil(f.h / step) + 1);
      const grid = new Float32Array(ns * nt);
      for (let b = 0; b < nt; b++) {
        for (let a = 0; a < ns; a++) {
          const s = (a / (ns - 1)) * f.w, t = (b / (nt - 1)) * f.h;
          p.copy(f.origin).addScaledVector(f.u, s).addScaledVector(f.v, t);
          let occ = 0, w = 1;
          for (let k = 0; k < H.length; k++) {
            q.copy(p).addScaledVector(f.n, H[k]);
            const d = sdf(q);
            occ += Math.max(0, H[k] - d) * w / H[k];
            w *= 0.62;
          }
          grid[b * ns + a] = clamp(1 - occ * 0.42 * strength, 0.22, 1);
        }
      }
      for (let j = 0; j < f.th; j++) {
        const t = clamp((j - PAD + 0.5) / tpm, 0, f.h);
        const gy = (t / f.h) * (nt - 1);
        const y0 = Math.min(nt - 2, Math.floor(gy)), fy = gy - y0;
        let idx = ((f.y0 + j) * S + f.x0) * 4;
        for (let i = 0; i < f.tw; i++, idx += 4) {
          const s = clamp((i - PAD + 0.5) / tpm, 0, f.w);
          const gx = (s / f.w) * (ns - 1);
          const x0 = Math.min(ns - 2, Math.floor(gx)), fx = gx - x0;
          const g00 = grid[y0 * ns + x0], g10 = grid[y0 * ns + x0 + 1];
          const g01 = grid[(y0 + 1) * ns + x0], g11 = grid[(y0 + 1) * ns + x0 + 1];
          const v = (g00 * (1 - fx) + g10 * fx) * (1 - fy) + (g01 * (1 - fx) + g11 * fx) * fy;
          data[idx + 2] = (v * 255) | 0;
        }
      }
    }
    this.fullDirty = true;
  }

  // Push CPU changes to the GPU (dirty rectangles only)
  flush(renderer) {
    if (!this.texture) return;
    if (this.fullDirty) {
      this.texture.needsUpdate = true;
      this.fullDirty = false;
      this.dirty.clear();
      return;
    }
    if (!this.dirty.size) return;
    const props = renderer.properties.get(this.texture);
    if (!props.__webglTexture) { this.dirty.clear(); this.texture.needsUpdate = true; return; }
    const gl = renderer.getContext();
    renderer.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, this.size);
    for (const r of this.dirty.values()) {
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, r[0]);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, r[1]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
    }
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.dirty.clear();
  }

  dispose() { this.texture?.dispose(); }
}

// ---------------------------------------------------------------------------
// Shader patch: turns any MeshStandardMaterial into a paint-receiving surface.
// Geometry needs attributes: paintUv (vec2) and faceInfo (vec4: s, t, w, h).
export function makePaintable(material, paint, opts = {}) {
  const bevel = opts.bevel ?? 0.16;
  const aoStr = opts.ao ?? 1.0;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, paint.uniforms);
    sh.uniforms.uBevel = { value: bevel };
    sh.uniforms.uAOStr = { value: aoStr };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 paintUv;
attribute vec4 faceInfo;
varying vec2 vPaintUv;
varying vec4 vFaceInfo;
varying vec3 vPW;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vPaintUv = paintUv;
vFaceInfo = faceInfo;
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uPaint;
uniform sampler2D uNoise;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uInkBump;
uniform float uBevel;
uniform float uAOStr;
uniform float uTime;
varying vec2 vPaintUv;
varying vec4 vFaceInfo;
varying vec3 vPW;
vec3 inkPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
float inkHeightAt(vec2 puv, vec2 nuv) {
  vec4 p = texture2D(uPaint, puv);
  float n1 = texture2D(uNoise, nuv * 0.21).r;
  float n2 = texture2D(uNoise, nuv * 0.9 + 0.37).g;
  float n3 = texture2D(uNoise, nuv * 2.6 + 0.11).r;
  float m = max(p.r, p.g) + (n1 - 0.5) * 0.34 + (n2 - 0.5) * 0.1;
  float body = smoothstep(0.32, 0.72, m);
  return body * (1.0 + (n3 - 0.5) * 0.3 + (n2 - 0.5) * 0.45);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec4 pnt = texture2D(uPaint, vPaintUv);
vec2 nuv = vec2(vPW.x + vPW.y * 0.71, vPW.z - vPW.y * 0.53);
float nz = texture2D(uNoise, nuv * 0.21).r;
float nz2 = texture2D(uNoise, nuv * 0.9 + 0.37).g;
float na = (nz - 0.5) * 0.34 + (nz2 - 0.5) * 0.1;
float inkA = smoothstep(0.43, 0.57, pnt.r + na);
float inkB = smoothstep(0.43, 0.57, pnt.g + na);
float ink = clamp(inkA + inkB, 0.0, 1.0);
vec3 inkCol = (inkA * uColA + inkB * uColB) / max(inkA + inkB, 1e-3);
inkCol *= 0.88 + 0.2 * nz2;
float bevelE = min(min(vFaceInfo.x, vFaceInfo.z - vFaceInfo.x), min(vFaceInfo.y, vFaceInfo.w - vFaceInfo.y));
float bevelL = 1.0 - smoothstep(0.0, 0.07, bevelE);
diffuseColor.rgb *= 1.0 + bevelL * uBevel;
diffuseColor.rgb = mix(diffuseColor.rgb, inkCol, ink);
float aoV = mix(1.0, pnt.b, uAOStr);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.1 + nz2 * 0.08, ink);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, ink);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  normal = normalize(mix(normal, nonPerturbedNormal, ink * 0.92));
  vec2 dPx = dFdx(vPaintUv), dPy = dFdy(vPaintUv);
  vec2 dNx = dFdx(nuv), dNy = dFdy(nuv);
  float h0 = inkHeightAt(vPaintUv, nuv);
  float hx = inkHeightAt(vPaintUv + dPx, nuv + dNx) - h0;
  float hy = inkHeightAt(vPaintUv + dPy, nuv + dNy) - h0;
  normal = inkPerturb(-vViewPosition, normal, vec2(hx, hy) * uInkBump, faceDirection);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += inkCol * ink * 0.06;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= aoV;
reflectedLight.indirectSpecular *= mix(aoV, 1.0, 0.35);
reflectedLight.directDiffuse *= mix(1.0, aoV, 0.45);`);
  };
  material.customProgramCacheKey = () => 'paintable' + bevel.toFixed(2);
  return material;
}

// Tileable noise texture used to roughen paint edges
export function makeNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const grid = (cells, seed) => {
    const g = new Float32Array(cells * cells);
    let s = seed;
    for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
    return g;
  };
  const octs = [[8, 0.5, 11], [16, 0.25, 23], [32, 0.15, 37], [64, 0.1, 51]];
  const grids = octs.map(([c, , s]) => grid(c, s));
  const grids2 = octs.map(([c, , s]) => grid(c, s + 999));
  const sample = (g, cells, x, y) => {
    const fx = x * cells, fy = y * cells;
    const xi = Math.floor(fx), yi = Math.floor(fy);
    const tx = fx - xi, ty = fy - yi;
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    const a = g[(yi % cells) * cells + (xi % cells)], b = g[(yi % cells) * cells + ((xi + 1) % cells)];
    const c = g[((yi + 1) % cells) * cells + (xi % cells)], d = g[((yi + 1) % cells) * cells + ((xi + 1) % cells)];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n1 = 0, n2 = 0, norm = 0;
    octs.forEach(([c, amp], k) => {
      n1 += sample(grids[k], c, x / size, y / size) * amp;
      n2 += sample(grids2[k], c, x / size, y / size) * amp;
      norm += amp;
    });
    const i = (y * size + x) * 4;
    data[i] = (n1 / norm) * 255; data[i + 1] = (n2 / norm) * 255; data[i + 2] = 128; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
