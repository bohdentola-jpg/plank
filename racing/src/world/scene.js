// PORT HALCYON — the world as rendered: sky, fog and lights for the time of
// day, the bay, the lake and the river, the far layer (the whole map's
// ground at 32 m, and every street lamp as a point of light, each world cell
// hiding itself from the far layer once its detailed version is up), and the
// streamer that builds detailed cells round the player a few milliseconds a
// frame and lets them go behind. Nothing here ever stops the game to load.
import * as THREE from 'three';
import { ATMOS, skyMesh } from '../track/build.js';
import { getEnvMap } from '../core/envmap.js';
import { CELL, natural } from './terrain.js';
import { BOUNDS, LAKE, LAKE_Y, RIVER } from './map/base.js';
import { groundColor } from './ground.js';
import { buildCell } from './build/cell.js';
import { roadLamps } from './build/roads.js';
import { U, updateKit, allMaterials } from './kit.js';
import { packMaterials } from './districts/builder.js';
import { warmRoads } from './build/roads.js';
import { buildFarSkyline } from './districts/far.js';
import { disposeTree } from '../core/util.js';

const CX0 = Math.floor(BOUNDS.x0 / CELL), CX1 = Math.ceil(BOUNDS.x1 / CELL);
const CZ0 = Math.floor(BOUNDS.z0 / CELL), CZ1 = Math.ceil(BOUNDS.z1 / CELL);
const MX = CX1 - CX0, MZ = CZ1 - CZ0;
const cellIndex = (cx, cz) => (cx - CX0) + (cz - CZ0) * MX;
export const cellKey = (cx, cz) => `${cx},${cz}`;

export class WorldScene {
  /**
   * ctx: { net, terrain, districts? }. opts: { time: 'night'|'dusk'|'day'|…,
   * near (m, detailed radius), keep (m), budget (ms a frame) }
   */
  constructor(ctx, renderer, opts = {}) {
    this.ctx = ctx;
    this.renderer = renderer;
    this.opts = opts;
    this.near = opts.near ?? 600;
    this.keep = opts.keep ?? 860;
    this.budget = opts.budget ?? 6;
    this.propsRange = opts.propsRange ?? 330;
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.cells = new Map();
    this.jobs = [];
    this.current = null;
    this.time = 0;
    this.setupAtmosphere(opts.time || 'night');
    this.setupWater();
    this.maskData = new Uint8Array(MX * MZ);
    this.mask = new THREE.DataTexture(this.maskData, MX, MZ, THREE.RedFormat, THREE.UnsignedByteType);
    this.mask.magFilter = this.mask.minFilter = THREE.NearestFilter;
    this.mask.needsUpdate = true;
    this.maskU = { uMask: { value: this.mask }, uMaskN: { value: new THREE.Vector2(MX, MZ) } };
    this.stats = { built: 0, disposed: 0, buildMs: 0 };
  }

  // ---------------------------------------------------------------- atmosphere

  setupAtmosphere(time) {
    const at = { ...ATMOS[time] };
    this.at = at;
    const scene = this.scene;
    scene.fog = new THREE.FogExp2(new THREE.Color(at.fog), at.fogD * 0.75);
    scene.background = new THREE.Color(at.sky[2]);
    this.sky = skyMesh(at);
    scene.add(this.sky);
    this.sunDir = new THREE.Vector3(Math.cos(at.sun.az) * Math.cos(at.sun.el), Math.sin(at.sun.el), Math.sin(at.sun.az) * Math.cos(at.sun.el)).normalize();
    this.sky.material.uniforms.sunDir.value.copy(this.sunDir);
    this.hemi = new THREE.HemisphereLight(at.hemi[0], at.hemi[1], at.hemi[2]);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(at.sun.color, at.sun.i);
    sun.castShadow = !at.lamps || time === 'dusk';
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 500;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    scene.environment = getEnvMap(this.renderer, at.env);
    updateKit(at.lamps ? 1 : 0, 0);
  }

  // ---------------------------------------------------------------- water

  setupWater() {
    const tex = waterNormals();
    this.waterTex = tex;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b2234, roughness: 0.1, metalness: 0.05, envMapIntensity: 1.1,
      normalMap: tex, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.94,
    });
    this.waterMat = mat;
    // the bay
    const sg = new THREE.PlaneGeometry(40000, 40000, 1, 1);
    // (one ripple tile every 40 m, like the lake and the river)
    const suv = sg.attributes.uv;
    for (let k = 0; k < suv.count; k++) suv.setXY(k, suv.getX(k) * 1000, suv.getY(k) * 1000);
    const sea = new THREE.Mesh(sg, mat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0, 0);
    sea.renderOrder = 1;
    this.scene.add(sea);
    // the lake
    const tri = THREE.ShapeUtils.triangulateShape(LAKE.map((p) => new THREE.Vector2(p[0], p[1])), []);
    const lp = [];
    for (const p of LAKE) lp.push(p[0], LAKE_Y, p[1]);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const li = [];
    for (const t of tri) li.push(t[0], t[2], t[1]);
    lg.setIndex(li);
    lg.computeVertexNormals();
    // the lake's surface must face up whichever way the polygon winds
    if (lg.attributes.normal.getY(0) < 0) { for (let k = 0; k < li.length; k += 3) [li[k + 1], li[k + 2]] = [li[k + 2], li[k + 1]]; lg.setIndex(li); lg.computeVertexNormals(); }
    const uvs = [];
    for (const p of LAKE) uvs.push(p[0] / 40, p[1] / 40);
    lg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const lake = new THREE.Mesh(lg, mat);
    lake.renderOrder = 1;
    this.scene.add(lake);
    // the river: a ribbon at its own falling water level
    const P = RIVER.path, ys = RIVER.ys;
    const pos = [], uv = [], idx = [];
    const half = RIVER.width / 2 + 3;
    let s = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 12));
      for (let k = i ? 1 : 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const y = ys[i] + (ys[i + 1] - ys[i]) * t + 0.02;
        // direction: average of the neighbouring segments at the joins
        let dx = (bx - ax) / len, dz = (bz - az) / len;
        if (k === n && i < P.length - 2) {
          const [cx2, cz2] = P[i + 2];
          const l2 = Math.hypot(cx2 - bx, cz2 - bz);
          dx = (dx + (cx2 - bx) / l2) / 2; dz = (dz + (cz2 - bz) / l2) / 2;
        }
        const lx = dz, lz = -dx;
        const base = pos.length / 3;
        pos.push(x - lx * half, y, z - lz * half, x + lx * half, y, z + lz * half);
        uv.push(0, (s + len * t) / 40, half * 2 / 40, (s + len * t) / 40);
        if (base > 0) idx.push(base - 2, base, base - 1, base - 1, base, base + 1);
      }
      s += len;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    if (rg.attributes.normal.getY(0) < 0) { for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]]; rg.setIndex(idx); rg.computeVertexNormals(); }
    const river = new THREE.Mesh(rg, mat);
    river.renderOrder = 1;
    this.scene.add(river);
  }

  // ---------------------------------------------------------------- far layer

  /** The whole map's ground at 32 m, and its lamps as points (built in slices). */
  async buildFar(onProgress = () => {}, sliceMs = 12) {
    const per = 9, nCells = MX * MZ;
    const pos = new Float32Array(nCells * per * per * 3);
    const col = new Float32Array(nCells * per * per * 3);
    const cid = new Float32Array(nCells * per * per);
    const idx = new Uint32Array(nCells * (per - 1) * (per - 1) * 6);
    const res = CELL / (per - 1);
    const c = [0, 0, 0];
    let v = 0, q = 0, done = 0;
    let t0 = performance.now();
    const H = new Float32Array(per * per);
    for (let cz = CZ0; cz < CZ1; cz++) {
      for (let cx = CX0; cx < CX1; cx++) {
        const id = cellIndex(cx, cz);
        const base = v;
        for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) H[j * per + i] = natural(cx * CELL + i * res, cz * CELL + j * res);
        for (let j = 0; j < per; j++) {
          for (let i = 0; i < per; i++) {
            const x = cx * CELL + i * res, z = cz * CELL + j * res, h = H[j * per + i];
            const hx = H[j * per + Math.min(per - 1, i + 1)] - H[j * per + Math.max(0, i - 1)];
            const hz = H[Math.min(per - 1, j + 1) * per + i] - H[Math.max(0, j - 1) * per + i];
            const ny = 2 * res / Math.hypot(hx, 2 * res, hz);
            groundColor(x, z, h, ny, 0, c);
            pos[v * 3] = x; pos[v * 3 + 1] = h - 0.4; pos[v * 3 + 2] = z;
            col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
            cid[v] = id;
            v++;
          }
        }
        for (let j = 0; j < per - 1; j++) {
          for (let i = 0; i < per - 1; i++) {
            const a = base + j * per + i, b = a + 1, cc = a + per, d = cc + 1;
            idx[q++] = a; idx[q++] = cc; idx[q++] = b;
            idx[q++] = b; idx[q++] = cc; idx[q++] = d;
          }
        }
        done++;
        if (performance.now() - t0 > sliceMs) {
          onProgress(done / nCells * 0.85, 'SURVEYING THE CITY');
          await new Promise((r) => setTimeout(r, 0));
          t0 = performance.now();
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('cellId', new THREE.BufferAttribute(cid, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.3 });
    const mu = this.maskU;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = mu.uMask;
      sh.uniforms.uMaskN = mu.uMaskN;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float cellId;\nuniform sampler2D uMask;\nuniform vec2 uMaskN;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec2 mc = vec2(mod(cellId, uMaskN.x), floor(cellId / uMaskN.x));
          if (texture2D(uMask, (mc + 0.5) / uMaskN).r > 0.5) transformed.y -= 4000.0;`);
    };
    mat.customProgramCacheKey = () => 'world-far-terrain';
    const far = new THREE.Mesh(g, mat);
    far.frustumCulled = false;
    far.receiveShadow = false;
    this.scene.add(far);
    this.far = far;
    onProgress(0.9, 'LIGHTING THE STREETS');
    await new Promise((r) => setTimeout(r, 0));
    this.buildFarLamps();
    if (this.ctx.districts?.farList.length) {
      onProgress(0.95, 'RAISING THE SKYLINE');
      await new Promise((r) => setTimeout(r, 0));
      this.skyline = buildFarSkyline(this.ctx.districts.farList, (x, z) => cellIndex(Math.floor(x / CELL), Math.floor(z / CELL)), this.maskU);
      this.scene.add(this.skyline);
    }
    onProgress(1, 'READY');
  }

  /** Every street lamp in town as a point of light (masked like the far ground). */
  buildFarLamps() {
    const p = [], c = [], id = [];
    for (const r of this.ctx.net.roads) {
      for (const L of roadLamps(r)) {
        p.push(L.hx, L.hy, L.hz);
        c.push(L.color.r, L.color.g, L.color.b);
        id.push(cellIndex(Math.floor(L.x / CELL), Math.floor(L.z / CELL)));
      }
    }
    if (this.ctx.districts?.farLamps) for (const L of this.ctx.districts.farLamps()) {
      p.push(L.hx, L.hy, L.hz);
      c.push(L.color.r, L.color.g, L.color.b);
      id.push(cellIndex(Math.floor(L.x / CELL), Math.floor(L.z / CELL)));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('cellId', new THREE.Float32BufferAttribute(id, 1));
    const mu = this.maskU;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMask: mu.uMask, uMaskN: mu.uMaskN, uNight: U.night, uScale: { value: 900 } },
      vertexShader: `
        attribute vec3 color; attribute float cellId; uniform sampler2D uMask; uniform vec2 uMaskN; uniform float uScale;
        varying vec3 vCol; varying float vHide;
        void main(){
          vec2 mc = vec2(mod(cellId, uMaskN.x), floor(cellId / uMaskN.x));
          vHide = texture2D(uMask, (mc + 0.5) / uMaskN).r;
          vCol = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uScale / -mv.z, 1.5, 9.0);
        }`,
      fragmentShader: `
        varying vec3 vCol; varying float vHide; uniform float uNight;
        void main(){
          if (vHide > 0.5) discard;
          vec2 d = gl_PointCoord - 0.5; float a = max(0.0, 1.0 - dot(d, d) * 4.0);
          gl_FragColor = vec4(vCol * a * a * uNight * 1.6, 1.0);
        }`,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    this.scene.add(pts);
    this.farLamps = pts;
  }

  // ---------------------------------------------------------------- warming up

  /**
   * Everything the streamer will need, made now (in slices): the roads' and
   * districts' materials (their textures are drawn on first use), then every
   * shader compiled, so a new part of town never stalls a frame.
   */
  async warm(camera, onProgress = () => {}, sliceMs = 20) {
    let t0 = performance.now();
    const slice = async () => { if (performance.now() - t0 > sliceMs) { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); } };
    for (const _ of warmRoads(this.ctx.net)) await slice();
    onProgress(0.4);
    if (this.ctx.districts) for (const _ of this.ctx.districts.warm()) await slice();
    onProgress(0.7);
    // a tiny mesh per material, compiled against the real scene (its lights and fog)
    const g = new THREE.BufferGeometry();
    const tri = (n, v) => new THREE.Float32BufferAttribute(new Array(n * 3).fill(0).map((_, i) => v[i % v.length]), n);
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
    g.setAttribute('normal', tri(3, [0, 1, 0]));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    g.setAttribute('color', tri(3, [1, 1, 1]));
    g.setAttribute('glow', tri(3, [0, 0, 0]));
    const tmp = new THREE.Group();
    for (const m of new Set([...allMaterials(), ...packMaterials()])) {
      if (m.isShaderMaterial) continue;
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      tmp.add(mesh);
    }
    tmp.position.copy(camera.position);
    this.scene.add(tmp);
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, camera);
      else this.renderer.compile(this.scene, camera);
    } catch (e) { console.warn('world: compile', e); }
    this.scene.remove(tmp);
    g.dispose();
    onProgress(1);
  }

  // ---------------------------------------------------------------- streaming

  /** Cells wanted round the focus points (with a look-ahead along the velocity). */
  wanted(focus) {
    const want = new Map();
    for (const f of focus) {
      const ax = f.x + (f.vx || 0) * 2.5, az = f.z + (f.vz || 0) * 2.5;
      const R = this.near;
      for (let cx = Math.floor((Math.min(f.x, ax) - R) / CELL); cx <= Math.floor((Math.max(f.x, ax) + R) / CELL); cx++) {
        for (let cz = Math.floor((Math.min(f.z, az) - R) / CELL); cz <= Math.floor((Math.max(f.z, az) + R) / CELL); cz++) {
          if (cx < CX0 || cx >= CX1 || cz < CZ0 || cz >= CZ1) continue;
          const mx = (cx + 0.5) * CELL, mz = (cz + 0.5) * CELL;
          // nearest point of the cell to the focus and to the look-ahead point
          const d0 = boxDist(cx, cz, f.x, f.z), d1 = boxDist(cx, cz, ax, az);
          const d = Math.min(d0, d1 + 60);
          if (d > R) continue;
          const k = cellKey(cx, cz);
          const prev = want.get(k);
          // priority: what's close, and what's ahead
          const pri = d0 * 0.6 + d1 * 0.4 + Math.hypot(mx - f.x, mz - f.z) * 0.05;
          if (prev === undefined || pri < prev.pri) want.set(k, { cx, cz, pri });
        }
      }
    }
    return want;
  }

  /** Streaming step. focus: [{x, z, vx, vz}]. */
  stream(focus, budgetMs = this.budget) {
    const want = this.wanted(focus);
    // let go of cells nobody is near any more
    for (const [k, c] of this.cells) {
      if (want.has(k)) continue;
      let far = true;
      for (const f of focus) if (boxDist(c.cx, c.cz, f.x, f.z) < this.keep) { far = false; break; }
      if (!far) continue;
      if (c.state === 'ready') this.drop(c);
      if (this.current === c) this.current = null;
      this.cells.delete(k);
    }
    // queue what's missing, nearest/most-ahead first
    const missing = [];
    for (const [k, w] of want) if (!this.cells.has(k)) missing.push(w);
    missing.sort((a, b) => a.pri - b.pri);
    for (const w of missing) this.cells.set(cellKey(w.cx, w.cz), { cx: w.cx, cz: w.cz, state: 'queued', pri: w.pri });
    // run builds for a few milliseconds
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (!this.current) {
        let best = null;
        for (const c of this.cells.values()) {
          if (c.state !== 'queued') continue;
          const w = want.get(cellKey(c.cx, c.cz));
          c.pri = w ? w.pri : 1e9;
          if (!best || c.pri < best.pri) best = c;
        }
        if (!best) break;
        best.state = 'building';
        best.job = buildCell(this.ctx, best.cx, best.cz);
        best.t = 0;
        this.current = best;
      }
      const c = this.current;
      const ts = performance.now();
      let r;
      try { r = c.job.next(); } catch (e) { console.error('world cell', c.cx, c.cz, e); c.state = 'failed'; this.current = null; continue; }
      c.t += performance.now() - ts;
      if (r.done) {
        c.state = 'ready';
        c.out = r.value;
        c.job = null;
        this.group.add(c.out.group);
        this.setMask(c.cx, c.cz, 1);
        this.current = null;
        this.stats.built++;
        this.stats.buildMs += c.t;
        this.onCell?.(c);
      }
    }
  }

  /** Build every cell within r of (x, z) right now (behind a loading screen). */
  ensure(x, z, r, onProgress = () => {}) {
    const focus = [{ x, z, vx: 0, vz: 0 }];
    const want = this.wanted([{ x, z }]);
    const need = [...want.values()].filter((w) => boxDist(w.cx, w.cz, x, z) <= r).length || 1;
    let guard = 0;
    while (guard++ < 100000) {
      this.stream(focus, 50);
      let ready = 0;
      for (const w of want.values()) {
        if (boxDist(w.cx, w.cz, x, z) > r) continue;
        const c = this.cells.get(cellKey(w.cx, w.cz));
        if (c && (c.state === 'ready' || c.state === 'failed')) ready++;
      }
      onProgress(ready / need);
      if (ready >= need) break;
    }
  }

  /** Is the cell under (x, z) built? */
  ready(x, z) {
    const c = this.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    return !!c && c.state === 'ready';
  }

  drop(c) {
    this.group.remove(c.out.group);
    freeGeometry(c.out.group);
    this.setMask(c.cx, c.cz, 0);
    this.stats.disposed++;
    this.onDrop?.(c);
  }

  setMask(cx, cz, on) {
    if (cx < CX0 || cx >= CX1 || cz < CZ0 || cz >= CZ1) return;
    this.maskData[cellIndex(cx, cz)] = on ? 255 : 0;
    this.mask.needsUpdate = true;
  }

  // ---------------------------------------------------------------- per frame

  update(dt, camera, focus) {
    this.time += dt;
    if (this.sky) {
      this.sky.position.copy(camera.position);
      this.sky.material.uniforms.time.value += dt;
    }
    if (this.sunFollow) {
      this.sun.position.copy(this.sunFollow).addScaledVector(this.sunDir, 160);
      this.sun.target.position.copy(this.sunFollow);
      this.sun.target.updateMatrixWorld();
    }
    if (this.waterTex) { this.waterTex.offset.x = this.time * 0.006; this.waterTex.offset.y = this.time * 0.004; }
    if (focus) this.stream(focus);
    updateKit(U.night.value, this.time);
    // close-up props only close up; the districts' moving things while they're near
    const cp = camera.position;
    for (const c of this.cells.values()) {
      if (c.state !== 'ready') continue;
      const d = boxDist(c.cx, c.cz, cp.x, cp.z);
      if (c.out.near) c.out.near.visible = d < this.propsRange;
      if (c.out.anims?.length && d < 900) for (const fn of c.out.anims) fn(this.time, dt, d);
    }
  }

  dispose() {
    for (const c of this.cells.values()) if (c.state === 'ready') freeGeometry(c.out.group);
    this.cells.clear();
    // (the shared materials and their textures stay made for next time)
    this.scene.remove(this.group);
    disposeTree(this.scene);
  }
}

/**
 * Free a dropped cell's geometry. Not its materials: those are shared by
 * every cell (freeing one would recompile its shader and re-upload its
 * textures the next time anything used it).
 */
function freeGeometry(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isInstancedMesh) o.dispose();
  });
}

function boxDist(cx, cz, x, z) {
  const x0 = cx * CELL, z0 = cz * CELL;
  const dx = x < x0 ? x0 - x : x > x0 + CELL ? x - x0 - CELL : 0;
  const dz = z < z0 ? z0 - z : z > z0 + CELL ? z - z0 - CELL : 0;
  return Math.hypot(dx, dz);
}

/** Tiling ripples for the water's normal map. */
function waterNormals() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  const h = (i, j) => {
    let v = 0;
    for (let k = 1; k <= 4; k++) v += Math.sin((i * k * 0.049 + j * (5 - k) * 0.037) * Math.PI) / k + Math.cos((j * k * 0.061 - i * 0.027 * k) * Math.PI) / k;
    return v;
  };
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const dx = h(i + 1, j) - h(i - 1, j), dz = h(i, j + 1) - h(i, j - 1);
      const k = (j * S + i) * 4;
      img.data[k] = 128 + dx * 40; img.data[k + 1] = 128 + dz * 40; img.data[k + 2] = 255; img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}
