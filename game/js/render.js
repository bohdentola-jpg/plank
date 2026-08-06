// render.js — the 3D view.
//
// Everything renders into a small offscreen buffer and gets blown up with
// nearest-neighbour filtering, so the whole world comes out in chunky pixels
// no matter how big the window is. Lighting is deliberately plain: a sky/ground
// hemisphere plus one soft sun, no shadow maps — blob shadows instead, which
// read better at this resolution and cost nothing.

import * as THREE from '../vendor/three.module.js';
import { clamp, lerp, COLORS, angleDelta } from './util.js';

export const PIXEL_LEVELS = [2, 3, 4, 6];      // device px per rendered px

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0xffffff, 1);
    this.pixel = 3;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.fog = new THREE.Fog(0xffffff, 150, 340);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.35, 900);

    // lights: sky bounce + a low sun
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.75);
    this.sun.position.set(0.55, 1, 0.3).multiplyScalar(100);
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.ambient);

    // offscreen target + the fullscreen blit
    this.target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });
    this.blitScene = new THREE.Scene();
    this.blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitMat = new THREE.MeshBasicMaterial({ map: this.target.texture, depthTest: false, depthWrite: false });
    this.blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blitMat);
    this.blitQuad.frustumCulled = false;
    this.blitScene.add(this.blitQuad);

    // camera rig state (third person orbit)
    this.cam = { yaw: 0, pitch: 0.3, dist: 9.5, target: new THREE.Vector3(), shake: 0 };
    this.camDist = 9.5;
    this.resize();
  }

  setPixel(n) { this.pixel = clamp(n | 0, 1, 8); this.resize(); }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const rw = Math.max(64, Math.floor(w / this.pixel));
    const rh = Math.max(48, Math.floor(h / this.pixel));
    this.rw = rw; this.rh = rh;
    this.target.setSize(rw, rh);
    this.camera.aspect = rw / rh;
    this.camera.updateProjectionMatrix();
  }

  setBiomeLook(fogColor, sunTint) {
    const c = new THREE.Color(fogColor);
    this.fog.color.lerp(c, 0.06);
    this.scene.background.lerp(c, 0.06);
    this.renderer.setClearColor(this.scene.background, 1);
    if (sunTint != null) this.sun.color.lerp(new THREE.Color(sunTint), 0.05);
  }

  setFogRange(near, far) {
    this.fog.near = near;
    this.fog.far = far;
    this.camera.far = far + 120;
    this.camera.updateProjectionMatrix();
  }

  shake(secs) { this.cam.shake = Math.max(this.cam.shake, clamp(secs, 0, 3)); }

  // place the camera behind a target point, pulling in if terrain gets in the way
  updateCamera(target, dt, world, opts = {}) {
    const c = this.cam;
    c.target.lerp(target, opts.snap ? 1 : clamp(dt * 12, 0, 1));
    const wantDist = opts.dist != null ? opts.dist : c.dist;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    let dist = wantDist;

    // Keep the distance and let the camera ride up over the ground. Squeezing it
    // in towards the player instead would put it inside their head whenever they
    // look up from flat ground.
    const tryPos = new THREE.Vector3(
      c.target.x - Math.sin(c.yaw) * cp * dist,
      c.target.y + sp * dist + 1.2,
      c.target.z - Math.cos(c.yaw) * cp * dist,
    );
    if (world) {
      const gh = world.heightAt(tryPos.x, tryPos.z);
      // sample along the way too, so a hill between you and the camera lifts it
      const mid = world.heightAt((tryPos.x + c.target.x) / 2, (tryPos.z + c.target.z) / 2);
      tryPos.y = Math.max(tryPos.y, gh + 1.5, mid + 1.2);
    }
    this.camDist = tryPos.distanceTo(c.target);
    if (c.shake > 0) {
      c.shake -= dt;
      const a = Math.min(0.4, c.shake) * 0.9;
      tryPos.x += (Math.random() - 0.5) * a;
      tryPos.y += (Math.random() - 0.5) * a;
      tryPos.z += (Math.random() - 0.5) * a;
    }
    this.camera.position.copy(tryPos);
    this.camera.lookAt(c.target.x, c.target.y + 0.5, c.target.z);
  }

  // free-fly camera (map editor)
  flyCamera(pos, yaw, pitch) {
    this.camera.position.copy(pos);
    const cp = Math.cos(pitch);
    this.camera.lookAt(
      pos.x + Math.sin(yaw) * cp,
      pos.y + Math.sin(pitch),
      pos.z + Math.cos(yaw) * cp,
    );
  }

  render() {
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blitScene, this.blitCam);
  }

  // screen (css px) → normalised device coords in the render buffer
  ndc(sx, sy) {
    return new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
  }

  // world point → screen (css px), plus whether it's in front of the camera
  project(v3) {
    const p = v3.clone().project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.w,
      y: (-p.y * 0.5 + 0.5) * this.h,
      visible: p.z < 1 && p.z > -1,
      depth: p.z,
    };
  }

  dispose() {
    this.target.dispose();
    this.blitQuad.geometry.dispose();
    this.blitMat.dispose();
    this.renderer.dispose();
  }
}

// ---------------------------------------------------------------- blob shadow
let SHADOW_TEX = null;
function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const size = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  SHADOW_TEX = new THREE.CanvasTexture(cv);
  SHADOW_TEX.magFilter = THREE.NearestFilter;
  SHADOW_TEX.minFilter = THREE.NearestFilter;
  return SHADOW_TEX;
}

export function makeShadow(radius = 0.8) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false, opacity: 1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------- box helper
const boxGeoCache = new Map();
export function boxGeo(w, h, d) {
  const key = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
  let g = boxGeoCache.get(key);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); boxGeoCache.set(key, g); }
  return g;
}

const matCache = new Map();
export function flatMat(color) {
  const key = color;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); matCache.set(key, m); }
  return m;
}

// a cardboard box mesh: tan cube with a tape seam
export function cardboardBox(size = 1.4) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo(size, size, size), flatMat(COLORS.cardboard));
  g.add(body);
  const t = size * 0.16;
  const tape1 = new THREE.Mesh(boxGeo(t, size * 1.004, size * 1.004), flatMat(COLORS.tape));
  g.add(tape1);
  const tape2 = new THREE.Mesh(boxGeo(size * 1.004, size * 1.004, t), flatMat(COLORS.tape));
  tape2.rotation.y = Math.PI / 2;
  g.add(tape2);
  g.userData.size = size;
  return g;
}

export { angleDelta, lerp, clamp };
