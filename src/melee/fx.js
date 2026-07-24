// Hit feedback: chunky sparks, dust, KO blasts, floating damage text, screen
// shake and freeze frames. Everything is pooled and preallocated — no geometry
// or material is created once a match is running.
import * as THREE from 'three';

let TEX = null;

function pixCanvas(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  return cv;
}

function nearest(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The four flat sprite shapes every effect is built from. */
function buildTextures() {
  if (TEX) return TEX;
  // an 8-point impact star, hard edges only
  const star = pixCanvas(64, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    const c = s / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = i % 2 ? s * 0.26 : s * 0.48;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.07);
      ctx.lineTo(len, 0);
      ctx.lineTo(0, s * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(c, c, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });
  // a stepped ring — three concentric hard bands, no gradient
  const ring = pixCanvas(64, (ctx, s) => {
    const c = s / 2;
    const bands = [[0.46, 'rgba(255,255,255,1)'], [0.38, 'rgba(255,255,255,0.55)'], [0.3, 'rgba(255,255,255,0.22)']];
    for (const [r, col] of bands) {
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.arc(c, c, s * r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  // a slash: a fat crescent
  const slash = pixCanvas(64, (ctx, s) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.arc(s * 0.2, s * 0.5, s * 0.42, -1.1, 1.1);
    ctx.stroke();
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(s * 0.3, s * 0.5, s * 0.44, -0.9, 0.9);
    ctx.stroke();
  });
  // a soft-ish puff, still banded
  const puff = pixCanvas(32, (ctx, s) => {
    const c = s / 2;
    for (const [r, a] of [[0.46, 0.9], [0.34, 0.6], [0.2, 0.35]]) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(c, c, s * r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const blast = pixCanvas(64, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a);
      ctx.fillRect(s * 0.12, -s * 0.035, s * 0.36, s * 0.07);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(c, c, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  TEX = { star: nearest(star), ring: nearest(ring), slash: nearest(slash), puff: nearest(puff), blast: nearest(blast) };
  return TEX;
}

const KIND_STYLE = {
  spark: { tex: 'star', color: '#fff6c4', size: 1.5, life: 0.22, parts: 7, partColor: ['#fff3b0', '#ffd45e', '#ffffff'] },
  slash: { tex: 'slash', color: '#eafaff', size: 1.9, life: 0.2, parts: 6, partColor: ['#dff4ff', '#9fd8ff', '#ffffff'] },
  flame: { tex: 'star', color: '#ffa33a', size: 2.0, life: 0.3, parts: 10, partColor: ['#ff8a2a', '#ffd23a', '#c62d1b'] },
  zap: { tex: 'star', color: '#9fe8ff', size: 1.6, life: 0.18, parts: 8, partColor: ['#a8ecff', '#4fb8ff', '#ffffff'] },
  star: { tex: 'star', color: '#ffffff', size: 2.4, life: 0.28, parts: 12, partColor: ['#ffffff', '#ffe98a', '#ff9f5a'] },
  ring: { tex: 'ring', color: '#ffffff', size: 2.2, life: 0.26, parts: 5, partColor: ['#ffffff', '#cfe6ff'] },
  bonk: { tex: 'star', color: '#ffe98a', size: 1.4, life: 0.2, parts: 5, partColor: ['#ffe98a', '#ffffff'] },
};

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.renderOrder = 4;
    scene.add(this.group);
    const T = buildTextures();

    // ---- sprite pool (impacts, rings, blasts)
    this.sprites = [];
    const quad = new THREE.PlaneGeometry(1, 1);
    this._quad = quad;
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({
        map: T.star, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      m.visible = false;
      this.group.add(m);
      this.sprites.push({ m, live: false, t: 0, life: 1, size: 1, grow: 1, spin: 0 });
    }

    // ---- chunky particle pool
    this.parts = [];
    const cube = new THREE.BoxGeometry(1, 1, 1);
    this._cube = cube;
    for (let i = 0; i < 240; i++) {
      const m = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      this.group.add(m);
      this.parts.push({ m, live: false, t: 0, life: 1, vx: 0, vy: 0, vz: 0, g: 0, size: 0.1, spin: 0 });
    }

    // ---- floating text pool
    this.popups = [];
    for (let i = 0; i < 12; i++) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const tex = nearest(cv);
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      m.scale.set(2.6, 0.65, 1);
      m.visible = false;
      this.group.add(m);
      this.popups.push({ m, cv, tex, live: false, t: 0, life: 1 });
    }

    this.shakeMag = 0;
    this._shake = { x: 0, y: 0 };
    this._flash = null;
    this._freeze = 0;
    this._c = new THREE.Color();
  }

  // ---------------------------------------------------------------- spawning
  _sprite(x, y, kind, size, life, color, spin = 0, grow = 2.2) {
    const T = buildTextures();
    for (const s of this.sprites) {
      if (s.live) continue;
      s.live = true;
      s.t = 0;
      s.life = life;
      s.size = size;
      s.grow = grow;
      s.spin = spin;
      s.m.material.map = T[kind] || T.star;
      s.m.material.color.set(color);
      s.m.material.opacity = 1;
      s.m.position.set(x, y, 0.35);
      s.m.rotation.z = Math.random() * Math.PI;
      s.m.scale.setScalar(size * 0.5);
      s.m.visible = true;
      return s;
    }
    return null;
  }

  _part(x, y, vx, vy, color, size, life, g = 9, vz = 0) {
    for (const p of this.parts) {
      if (p.live) continue;
      p.live = true;
      p.t = 0;
      p.life = life;
      p.vx = vx; p.vy = vy; p.vz = vz;
      p.g = g;
      p.size = size;
      p.spin = (Math.random() - 0.5) * 18;
      p.m.material.color.set(color);
      p.m.material.opacity = 1;
      p.m.position.set(x, y, 0.2 + Math.random() * 0.3);
      p.m.scale.setScalar(size);
      p.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.m.visible = true;
      return p;
    }
    return null;
  }

  /** The classic impact: one flat star plus a burst of pixels. */
  spark(x, y, kind = 'spark', power = 0.5) {
    const st = KIND_STYLE[kind] || KIND_STYLE.spark;
    const p = Math.max(0.2, Math.min(1, power));
    this._sprite(x, y, st.tex, st.size * (0.7 + p * 0.9), st.life * (0.8 + p * 0.5), st.color, (Math.random() - 0.5) * 6);
    const n = Math.round(st.parts * (0.5 + p));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (2.4 + Math.random() * 7) * (0.5 + p);
      this._part(
        x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        st.partColor[(Math.random() * st.partColor.length) | 0],
        0.055 + Math.random() * 0.09 * (0.6 + p), 0.22 + Math.random() * 0.3, kind === 'flame' ? 2 : 12,
        (Math.random() - 0.5) * 2,
      );
    }
  }

  hitFlash(x, y, power = 0.5) {
    this._sprite(x, y, 'blast', 1.4 + power * 2.4, 0.1 + power * 0.08, '#ffffff', 0, 3.4);
  }

  smoke(x, y, amount = 4) {
    for (let i = 0; i < amount; i++) {
      this._sprite(x + (Math.random() - 0.5) * 0.5, y + Math.random() * 0.4, 'puff',
        0.5 + Math.random() * 0.5, 0.4 + Math.random() * 0.3, '#6a6a72', 0, 1.9);
    }
  }

  dust(x, y, dir = 0) {
    for (let i = 0; i < 5; i++) {
      const d = dir === 0 ? (Math.random() < 0.5 ? -1 : 1) : dir;
      this._part(x + d * 0.14, y + 0.06, d * (1.4 + Math.random() * 2.4), 1.4 + Math.random() * 2.2,
        '#d8cfae', 0.07 + Math.random() * 0.06, 0.26, 10);
    }
    this._sprite(x, y + 0.12, 'puff', 0.8, 0.2, '#cfc6a8', 0, 2.2);
  }

  trail(x, y, color = '#ffffff') {
    this._sprite(x, y, 'puff', 0.9, 0.22, color, 0, 0.6);
  }

  ring(x, y, color = '#ffffff', scale = 1) {
    this._sprite(x, y, 'ring', 1.6 * scale, 0.3, color, 0, 3);
  }

  /** The big one: a fighter just left the stage. */
  koBlast(x, y, color = '#ffffff') {
    this._sprite(x, y, 'blast', 4.5, 0.45, '#ffffff', 0, 4.5);
    this._sprite(x, y, 'ring', 3.2, 0.55, color, 0, 5.5);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 16;
      this._part(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        i % 3 ? color : '#ffffff', 0.09 + Math.random() * 0.12, 0.4 + Math.random() * 0.4, 6, (Math.random() - 0.5) * 3);
    }
    this.flash(color, 0.35);
  }

  /** The shrinking twinkle when someone is launched straight up. */
  starKo(x, y) {
    const s = this._sprite(x, y, 'star', 2.4, 0.9, '#ffffff', 4, 0.06);
    if (s) s.starKo = true;
  }

  popup(x, y, text, color = '#ffffff') {
    for (const p of this.popups) {
      if (p.live) continue;
      const ctx = p.cv.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      ctx.font = "700 42px Impact, 'Arial Black', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#101018';
      ctx.lineWidth = 10;
      ctx.strokeText(text, 128, 34);
      ctx.fillStyle = color;
      ctx.fillText(text, 128, 34);
      p.tex.needsUpdate = true;
      p.live = true;
      p.t = 0;
      p.life = 0.9;
      p.m.position.set(x, y, 0.6);
      p.m.material.opacity = 1;
      p.m.visible = true;
      return;
    }
  }

  shake(mag) { this.shakeMag = Math.min(1.4, this.shakeMag + mag); }

  /** Camera offset for this frame; decays on its own. */
  consumeShake() {
    const m = this.shakeMag;
    if (m <= 0.001) { this._shake.x = 0; this._shake.y = 0; return this._shake; }
    this._shake.x = (Math.random() - 0.5) * m * 0.85;
    this._shake.y = (Math.random() - 0.5) * m * 0.7;
    this.shakeMag *= 0.86;
    if (this.shakeMag < 0.01) this.shakeMag = 0;
    return this._shake;
  }

  flash(color, strength) { this._flash = { color, strength }; }
  takeFlash() { const f = this._flash; this._flash = null; return f; }
  freezeFrames(n) { this._freeze = Math.max(this._freeze, n | 0); }
  takeFreeze() { const f = this._freeze; this._freeze = 0; return f; }

  // ------------------------------------------------------------------ update
  update(dt) {
    for (const s of this.sprites) {
      if (!s.live) continue;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { s.live = false; s.m.visible = false; s.m.material.opacity = 0; s.starKo = false; continue; }
      const scale = s.starKo
        ? s.size * (1 - k) * 0.5
        : s.size * (0.5 + k * s.grow * 0.5);
      s.m.scale.setScalar(Math.max(0.01, scale));
      s.m.material.opacity = 1 - k * k;
      s.m.rotation.z += s.spin * dt;
      if (s.starKo) s.m.position.y += dt * 16;
    }
    for (const p of this.parts) {
      if (!p.live) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.live = false; p.m.visible = false; p.m.material.opacity = 0; continue; }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.m.rotation.x += p.spin * dt;
      p.m.rotation.y += p.spin * dt * 0.7;
      p.m.material.opacity = 1 - k;
      p.m.scale.setScalar(p.size * (1 - k * 0.4));
    }
    for (const p of this.popups) {
      if (!p.live) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.live = false; p.m.visible = false; continue; }
      p.m.position.y += dt * 1.9;
      p.m.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
      const pop = k < 0.15 ? 0.7 + (k / 0.15) * 0.3 : 1;
      p.m.scale.set(2.6 * pop, 0.65 * pop, 1);
    }
  }

  reset() {
    for (const s of this.sprites) { s.live = false; s.m.visible = false; }
    for (const p of this.parts) { p.live = false; p.m.visible = false; }
    for (const p of this.popups) { p.live = false; p.m.visible = false; }
    this.shakeMag = 0;
    this._flash = null;
    this._freeze = 0;
  }

  dispose() {
    this.reset();
    for (const s of this.sprites) s.m.material.dispose();
    for (const p of this.parts) p.m.material.dispose();
    for (const p of this.popups) { p.m.material.dispose(); p.tex.dispose(); }
    this._quad.dispose();
    this._cube.dispose();
    this.scene.remove(this.group);
  }
}
