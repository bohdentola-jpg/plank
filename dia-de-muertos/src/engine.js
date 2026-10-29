// The engine: one renderer for the whole game, a stage (the current 3D place),
// a camera rig with gentle mouse parallax, clickable hotspots that glow gold on
// hover, tweens on the game clock, and an offscreen "photo booth" that renders
// 3D props/characters into thumbnails for the UI.
import * as THREE from 'three';
import { glowSprite, mkCanvas } from './toon.js';

const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export { ease };

let sparkleTex = null;
function sparkleTexture() {
  if (sparkleTex) return sparkleTex;
  const cv = mkCanvas(64, 64);
  const ctx = cv.getContext('2d');
  ctx.translate(32, 32);
  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 7 : 30;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  sparkleTex = new THREE.CanvasTexture(cv);
  sparkleTex.colorSpace = THREE.SRGBColorSpace;
  return sparkleTex;
}

export class Engine {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.maxPixelRatio = 1.75;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    r.setSize(container.clientWidth || 800, container.clientHeight || 600);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    r.domElement.setAttribute('aria-label', 'Game view');

    this.camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.05, 400);
    this.rig = {
      pos: new THREE.Vector3(0, 2, 8), target: new THREE.Vector3(0, 1, 0), fov: 40,
      parallax: 0.3, // world units of sway at the screen edge
    };
    this.par = { x: 0, y: 0, tx: 0, ty: 0 };
    this.stage = null;
    this.hotspots = [];
    this.hovered = null;
    this.tweens = [];
    this.timers = [];
    this.time = 0;
    this.locked = 0;        // >0 while a dialog/modal owns input
    this.mouse = new THREE.Vector2(-9, -9);
    this.mousePx = { x: 0, y: 0 };
    this.raycaster = new THREE.Raycaster();
    this.listeners = { hover: [] };
    this.fpsSamples = [];
    this.quality = 2;
    this.paused = false;
    // tests run headless at a few fps: ?fast lets game time keep up with real time
    this.maxDt = /[?&]fast/.test(location.search) ? 0.5 : 0.05;
    // automated tests: no shadows, low resolution
    if (/[?&]lowq/.test(location.search)) {
      r.shadowMap.enabled = false;
      r.setPixelRatio(0.5);
      this.maxPixelRatio = 0.5;
    }

    this.tooltip = document.getElementById('tooltip');
    this.installInput();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(container);
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
    this.clock = new THREE.Clock();
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- stage
  async setStage(stage, opts = {}) {
    const old = this.stage;
    if (old) {
      old.exit?.();
      this.clearHotspots();
      old.dispose?.();
    }
    this.tweens = this.tweens.filter((t) => t.keep);
    this.timers = [];
    this.stage = stage;
    if (!stage.scene) await stage.build();
    const rig = stage.cameraRig?.();
    if (rig) this.setRig(rig.pos, rig.target, rig.fov ?? 40, 0, rig.parallax);
    this.renderer.shadowMap.needsUpdate = true;
    await stage.enter?.(opts);
  }

  setRig(pos, target, fov = this.rig.fov, dur = 0, parallax = this.rig.parallax) {
    const P = pos.isVector3 ? pos.clone() : new THREE.Vector3(...pos);
    const T = target.isVector3 ? target.clone() : new THREE.Vector3(...target);
    this.rig.parallax = parallax;
    if (!dur) {
      this.rig.pos.copy(P);
      this.rig.target.copy(T);
      this.rig.fov = fov;
      return Promise.resolve();
    }
    const p0 = this.rig.pos.clone(), t0 = this.rig.target.clone(), f0 = this.rig.fov;
    return this.tween(dur, (k) => {
      this.rig.pos.lerpVectors(p0, P, k);
      this.rig.target.lerpVectors(t0, T, k);
      this.rig.fov = f0 + (fov - f0) * k;
    }, 'inOut');
  }

  // ---------------------------------------------------------------- time
  tween(dur, fn, easing = 'inOut', opts = {}) {
    return new Promise((resolve) => {
      const tw = { t: 0, dur: Math.max(0.0001, dur), fn, e: ease[easing] || easing, resolve, keep: opts.keep };
      this.tweens.push(tw);
      fn(0);
    });
  }

  wait(sec) {
    return new Promise((resolve) => this.timers.push({ at: this.time + sec, resolve }));
  }

  // ---------------------------------------------------------------- hotspots
  // obj: Object3D. opts: label, onClick, enabled(), sparkle (bool), glow (bool),
  // icon (emoji-free short tag for the tooltip), hoverIn/hoverOut callbacks
  addHotspot(obj, opts) {
    const hs = { obj, enabled: () => true, glow: true, sparkle: true, ...opts };
    obj.traverse((o) => {
      o.userData.hotspot = hs;
      if (!o.isMesh || o.userData.isOutlineHull) return;
      // own the materials so the glow doesn't light up every object sharing them
      if (hs.glow && o.material && !o.userData.ownMat) {
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        o.userData.ownMat = true;
      }
    });
    if (hs.sparkle) {
      const box = new THREE.Box3().setFromObject(obj);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false, depthTest: false, opacity: 0.9 }));
      const size = Math.min(0.35, Math.max(0.12, box.getSize(new THREE.Vector3()).length() * 0.12));
      s.scale.setScalar(size);
      s.renderOrder = 999;
      s.raycast = () => {};
      const top = new THREE.Vector3((box.min.x + box.max.x) / 2 + size * 0.6, box.max.y + size * 0.3, (box.min.z + box.max.z) / 2);
      s.position.copy(top);
      s.userData.base = top.clone();
      s.userData.phase = Math.random() * 6;
      hs.sparkleSprite = s;
      this.stage?.scene?.add(s);
    }
    this.hotspots.push(hs);
    return hs;
  }

  removeHotspot(obj) {
    const i = this.hotspots.findIndex((h) => h.obj === obj);
    if (i < 0) return;
    const hs = this.hotspots[i];
    if (this.hovered === hs) this.setHover(null);
    hs.sparkleSprite?.parent?.remove(hs.sparkleSprite);
    obj.traverse((o) => { delete o.userData.hotspot; });
    this.hotspots.splice(i, 1);
  }

  clearHotspots() {
    for (const hs of [...this.hotspots]) this.removeHotspot(hs.obj);
    this.setHover(null);
  }

  // mark a hotspot as visited: its sparkle fades out
  visited(obj) {
    const hs = this.hotspots.find((h) => h.obj === obj);
    if (hs?.sparkleSprite) {
      hs.sparkleSprite.parent?.remove(hs.sparkleSprite);
      hs.sparkleSprite = null;
    }
  }

  // "hint": flash all live hotspots for a moment
  flashHotspots() {
    const live = this.hotspots.filter((h) => h.enabled());
    this.tween(2.2, (k) => {
      const v = Math.sin(k * Math.PI * 4) * 0.5 + 0.5;
      for (const h of live) this.glowObj(h.obj, v * (1 - k * 0.6));
    }, 'linear').then(() => { for (const h of live) this.glowObj(h.obj, h === this.hovered ? 1 : 0); });
  }

  glowObj(obj, amt) {
    obj.traverse((o) => {
      if (!o.isMesh || !o.userData.ownMat) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        if (!m.userData.baseEm) m.userData.baseEm = m.emissive.clone();
        m.emissive.copy(m.userData.baseEm).lerp(new THREE.Color('#ffb52e'), amt * 0.55);
      }
    });
  }

  setHover(hs) {
    if (this.hovered === hs) return;
    if (this.hovered) {
      this.glowObj(this.hovered.obj, 0);
      this.hovered.hoverOut?.();
    }
    this.hovered = hs;
    if (hs) {
      hs.hoverIn?.();
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.renderer.domElement.style.cursor = '';
    }
    this.showTooltip(hs ? (typeof hs.label === 'function' ? hs.label() : hs.label) : null);
    for (const fn of this.listeners.hover) fn(hs);
  }

  showTooltip(text) {
    if (!this.tooltip) return;
    if (!text || this.locked) {
      this.tooltip.classList.remove('on');
      return;
    }
    this.tooltip.textContent = text;
    this.tooltip.classList.add('on');
    this.placeTooltip();
  }

  placeTooltip() {
    if (!this.tooltip) return;
    const r = this.container.getBoundingClientRect();
    const x = Math.min(r.width - 20, Math.max(20, this.mousePx.x));
    this.tooltip.style.transform = `translate(${x + r.left}px, ${this.mousePx.y + r.top - 18}px) translate(-50%, -100%)`;
  }

  pick(list = this.hotspots.filter((h) => h.enabled()).map((h) => h.obj)) {
    if (!list.length) return null;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(list, true);
    for (const h of hits) {
      if (h.object.userData.isOutlineHull || !h.object.visible) continue;
      let o = h.object;
      while (o && !o.userData.hotspot) o = o.parent;
      if (o) return { hs: o.userData.hotspot, point: h.point, object: h.object };
    }
    return null;
  }

  // world point under the pointer on a horizontal (or custom) plane
  pointOnPlane(plane) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  raycastObjects(objs) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(objs, true).filter((h) => !h.object.userData.isOutlineHull);
  }

  // ---------------------------------------------------------------- input
  installInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let down = null;
    const setMouse = (e) => {
      const r = el.getBoundingClientRect();
      this.mousePx = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.mouse.set((this.mousePx.x / r.width) * 2 - 1, -(this.mousePx.y / r.height) * 2 + 1);
      this.par.tx = this.mouse.x;
      this.par.ty = this.mouse.y;
    };
    el.addEventListener('pointermove', (e) => {
      setMouse(e);
      if (this.stage?.onPointerMove && !this.locked) this.stage.onPointerMove(e, down);
      if (e.pointerType === 'mouse' || down) this._hoverDirty = true;
      this.placeTooltip();
    });
    el.addEventListener('pointerdown', (e) => {
      setMouse(e);
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
      for (const fn of this.listeners.anyInput || []) fn();
      if (this.stage?.onPointerDown && !this.locked) this.stage.onPointerDown(e);
    });
    el.addEventListener('pointerup', (e) => {
      setMouse(e);
      const d = down;
      down = null;
      if (this.stage?.onPointerUp && !this.locked) this.stage.onPointerUp(e);
      if (!d || this.locked) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (moved > 12 || performance.now() - d.t > 900) return;
      if (this.stage?.onTap?.(e)) return;
      const hit = this.pick();
      if (hit) {
        this.visited(hit.hs.obj);
        if (e.pointerType !== 'mouse') this.setHover(null);
        hit.hs.onClick?.(hit);
        for (const fn of this.listeners.click || []) fn(hit);
      }
    });
    el.addEventListener('pointerleave', () => {
      this.mouse.set(-9, -9);
      this.par.tx = this.par.ty = 0;
      this.setHover(null);
    });
  }

  // keyboard players: Tab walks through clickable things, Enter/Space clicks
  focusNext(dir = 1) {
    const live = this.hotspots.filter((h) => h.enabled());
    if (!live.length) return;
    let i = live.indexOf(this.hovered);
    i = (i + dir + live.length) % live.length;
    const hs = live[i];
    this.setHover(hs);
    const box = new THREE.Box3().setFromObject(hs.obj);
    const c = box.getCenter(new THREE.Vector3()).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mousePx = { x: (c.x + 1) / 2 * r.width, y: (1 - c.y) / 2 * r.height - 30 };
    this.placeTooltip();
  }

  activateFocused() {
    const hs = this.hovered;
    if (!hs || this.locked) return;
    this.visited(hs.obj);
    hs.onClick?.({ hs, point: new THREE.Box3().setFromObject(hs.obj).getCenter(new THREE.Vector3()) });
  }

  on(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }

  lock() {
    this.locked++;
    this.setHover(null);
  }

  unlock() { this.locked = Math.max(0, this.locked - 1); }

  // ---------------------------------------------------------------- frame
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    if (this.paused) return;
    const dt = Math.min(this.maxDt, raw);
    this.time += dt;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.time >= this.timers[i].at) {
        const t = this.timers[i];
        this.timers.splice(i, 1);
        t.resolve();
      }
    }

    // camera: rig + parallax sway
    const p = this.par;
    p.x += (p.tx - p.x) * Math.min(1, dt * 2.5);
    p.y += (p.ty - p.y) * Math.min(1, dt * 2.5);
    const cam = this.camera;
    const fwd = new THREE.Vector3().subVectors(this.rig.target, this.rig.pos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const amp = this.locked ? this.rig.parallax * 0.4 : this.rig.parallax;
    cam.position.copy(this.rig.pos).addScaledVector(right, p.x * amp).add(new THREE.Vector3(0, p.y * amp * 0.45, 0));
    cam.lookAt(this.rig.target);
    if (cam.fov !== this.rig.fov) {
      cam.fov = this.rig.fov;
      cam.updateProjectionMatrix();
    }

    if (this.stage?.scene) {
      this.stage.update?.(dt, this.time);
      // sparkles bob and twinkle
      for (const hs of this.hotspots) {
        const s = hs.sparkleSprite;
        if (!s) continue;
        const on = hs.enabled() && !this.locked;
        s.visible = on;
        if (!on) continue;
        const ph = this.time * 2 + s.userData.phase;
        s.position.y = s.userData.base.y + Math.sin(ph) * 0.04;
        s.material.opacity = 0.45 + Math.sin(ph * 1.7) * 0.4;
        s.material.rotation = this.time * 0.8;
      }
      if (this._hoverDirty && !this.locked) {
        this._hoverDirty = false;
        const hit = this.pick();
        this.setHover(hit ? hit.hs : null);
      } else if (this.locked && this.hovered) {
        this.setHover(null);
      }
      if (this.hovered) this.glowObj(this.hovered.obj, 0.65 + Math.sin(this.time * 6) * 0.25);
      this.renderer.render(this.stage.scene, cam);
    }
    this.watchFps(raw);
  }

  // drop resolution / shadows if the machine is struggling
  watchFps(raw) {
    this.fpsSamples.push(raw);
    if (this.fpsSamples.length < 90) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fpsSamples = [];
    if (avg > 1 / 32 && this.quality > 0) {
      this.quality--;
      if (this.quality === 1) this.renderer.setPixelRatio(1);
      if (this.quality === 0) {
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(0.85);
        this.stage?.scene?.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      }
      this.resize();
    }
  }

  // ---------------------------------------------------------------- photos
  // Render an object alone into a transparent PNG data URL (icons, portraits).
  thumb(obj, { size = 256, dir = [0.35, 0.25, 1], fill = 0.82, bg = null, target = null, radius = null } = {}) {
    if (!this._thumb) {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#fff7ea', '#b89a7a', 1.9));
      const key = new THREE.DirectionalLight('#fff3e0', 2.6);
      key.position.set(2, 4, 5);
      scene.add(key);
      const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      this._thumb = { scene, cam: new THREE.PerspectiveCamera(28, 1, 0.01, 100), rt, size };
    }
    const T = this._thumb;
    if (T.size !== size) {
      T.rt.setSize(size, size);
      T.size = size;
    }
    const parent = obj.parent;
    const holder = new THREE.Group();
    holder.add(obj);
    T.scene.add(holder);
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = target || box.getCenter(new THREE.Vector3());
    const r = radius || box.getSize(new THREE.Vector3()).length() / 2;
    const d = new THREE.Vector3(...dir).normalize();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(T.cam.fov / 2)) * fill;
    T.cam.position.copy(c).addScaledVector(d, dist);
    T.cam.lookAt(c);
    T.cam.near = dist / 50;
    T.cam.far = dist * 4;
    T.cam.updateProjectionMatrix();
    const r0 = this.renderer;
    const prevTarget = r0.getRenderTarget();
    const prevClear = r0.getClearColor(new THREE.Color());
    const prevAlpha = r0.getClearAlpha();
    const prevShadow = r0.shadowMap.enabled;
    r0.shadowMap.enabled = false;
    r0.setRenderTarget(T.rt);
    r0.setClearColor(bg || '#000000', bg ? 1 : 0);
    r0.clear();
    r0.render(T.scene, T.cam);
    const px = new Uint8Array(size * size * 4);
    r0.readRenderTargetPixels(T.rt, 0, 0, size, size, px);
    r0.setRenderTarget(prevTarget);
    r0.setClearColor(prevClear, prevAlpha);
    r0.shadowMap.enabled = prevShadow;
    holder.remove(obj);
    T.scene.remove(holder);
    if (parent) parent.add(obj);
    // flip rows into a 2D canvas
    const cv = mkCanvas(size, size);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  // Screenshot of the current view (photo mode). Renders a frame then reads it.
  snapshot() {
    if (!this.stage?.scene) return null;
    this.renderer.render(this.stage.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  // a soft additive glow at a point (candles, lamps)
  glow(color, size, opacity) { return glowSprite(color, size, opacity); }
}
