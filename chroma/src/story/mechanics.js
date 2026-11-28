// Story mechanics runtime: moving platforms, crumbling floors, sponge blocks,
// paint switches + doors (optionally timed), ink rails, updraft fans, conveyor
// belts, rising gray floods with drains, chroma membranes, combat arenas, the
// defend-the-pump objective, paintable lanterns, Hue Shards and floor arrows.
// Built from the markers a level put on its Course; driven by the Story mode:
//   pre(dt)  before the player's physics step (moves solids, carries/pushes)
//   post(dt) after it (triggers, paint checks, pickups, objectives)
import * as THREE from 'three';
import { part, rod, std, glowMat, gooMat, posOf, disposeTree, canvasTexture, OUTLINE_S } from './kit.js';
import { GRAY_HEX } from './enemies.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _grab = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const damp = (r, dt) => 1 - Math.exp(-r * dt);
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inBox = (p, min, max, pad = 0) => p.x > min.x - pad && p.x < max.x + pad && p.z > min.z - pad && p.z < max.z + pad && p.y > min.y - pad && p.y < max.y + pad;

let spongeTex = null;
function spongeTexture() {
  if (spongeTex) return spongeTex;
  spongeTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rad = 4 + r() * 11;
      ctx.fillStyle = `rgba(150,110,40,${0.25 + r() * 0.3})`;
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  });
  spongeTex.wrapS = spongeTex.wrapT = THREE.RepeatWrapping;
  return spongeTex;
}

export class Mechanics {
  // S: the Story mode (course, world, player, fx, hud, colors, audio, spawnEnemy...)
  constructor(S) {
    this.S = S;
    const c = this.c = S.course;
    this.root = new THREE.Group();
    this.root.name = 'story-mechanics';
    S.scene.add(this.root);
    this.t = 0;
    this.flags = new Set();
    this.ink = S.colors[1];
    this.inkHex = '#' + this.ink.getHexString();
    this.disposables = [];
    this.lightPool = [];
    // ---- doors
    this.doors = c.mech.doors.map((d) => { this.decorDoor(d); return d; });
    for (const d of this.doors) if (d.open) c.moveDyn(d.dyn, d.dir);
    // ---- movers
    this.movers = c.mech.movers.map((m) => this.initMover(m));
    // ---- crumbles
    this.crumbles = c.mech.crumbles.map((k) => ({ ...k, state: 'idle', t: 0, base: new THREE.Vector3() }));
    for (const k of this.crumbles) this.decorCrumble(k);
    // ---- sponges
    this.sponges = c.mech.sponges.map((s) => {
      const d = s.dyn;
      const hFull = d.h0;
      c.setDynHeight(d, s.h0);
      const mat = d.mesh?.material;
      if (mat) { mat.map = spongeTexture(); mat.needsUpdate = true; }
      return { ...s, hFull, grown: false, k: 0, checkT: Math.random() * 0.2, timer: 0, cov: 0 };
    });
    // ---- switches
    this.switches = c.mech.switches.map((sw) => this.initSwitch(sw));
    // ---- rails
    this.rails = c.mech.rails.map((r) => this.initRail(r));
    this.ride = null; this.rideCool = 0;
    // ---- fans
    this.fans = c.mech.fans.map((f) => this.initFan(f));
    // ---- conveyors
    this.conveyors = c.mech.conveyors.map((cv) => this.initConveyor(cv));
    // ---- floods
    this.floods = c.mech.floods.map((f) => this.initFlood(f));
    // ---- membranes
    this.gates = c.mech.gates.map((g) => this.initGate(g));
    // ---- arenas
    this.arenas = c.mech.arenas.map((a) => ({ ...a, state: 'idle', wave: 0, waitT: 0, group: 'arena:' + a.id }));
    // ---- pump
    this.pumps = c.mech.pumps.map((p) => this.initPump(p));
    // ---- lanterns
    this.lanterns = c.mech.lanterns.map((l) => this.initLantern(l));
    // a small pool of real lights handed to the nearest lit lanterns (light count stays constant)
    if (this.lanterns.length) {
      const n = Math.max(0, Math.min(2, (c.maxLights ?? 6) - c.lights.length));
      for (let i = 0; i < n; i++) {
        const L = new THREE.PointLight(0xffc46b, 0, 12, 1.6);
        L.castShadow = false;
        this.root.add(L);
        this.lightPool.push(L);
      }
    }
    // ---- shards
    this.initShards();
    // ---- arrows
    this.initArrows();
    this.timer = null; // { t, max, label }
  }

  get player() { return this.S.player; }
  flag(id) { return this.flags.has(id); }
  setFlag(id) {
    if (this.flags.has(id)) return;
    this.flags.add(id);
    // doors that need a set of flags (e.g. two switches) open once all are set
    for (const d of this.doors) if (d.need && !d.open && d.need.every((f) => this.flags.has(f))) { this.setDoor(d.id, true); this.S.hud?.toast('Something heavy just <b>unlocked</b>…', 2.4); }
    this.S.onFlag?.(id);
  }

  // ================================================================ doors
  decorDoor(d) {
    const m = d.dyn.mesh;
    if (!m || !d.stripes) return;
    const s = d.dyn.solid;
    const w = s.max.x - s.min.x, dd = s.max.z - s.min.z, h = s.max.y - s.min.y;
    const yellow = this.c.mat('doorStripe', () => std(0xffc83d, 0.6, 0.2));
    const dark = this.c.mat('doorStripeDk', () => std(0x1b1530, 0.6, 0.2));
    const thin = w < dd ? 'x' : 'z';
    for (let i = 0; i < 4; i++) {
      const y = s.min.y + h * 0.12 + i * 0.32;
      const g = thin === 'x' ? new THREE.BoxGeometry(w + 0.04, 0.16, dd * 0.98) : new THREE.BoxGeometry(w * 0.98, 0.16, dd + 0.04);
      const mm = part(m, g, i % 2 ? dark : yellow, { pos: [(s.min.x + s.max.x) / 2, y, (s.min.z + s.max.z) / 2], shadow: false });
      mm.raycast = () => {};
    }
  }
  setDoor(id, open) {
    let any = false;
    for (const d of this.doors) {
      if (d.id !== id || d.open === open) continue;
      d.open = open; any = true;
      const s = d.dyn.solid;
      this.S.audio?.sfx('door_heavy', { ...posOf(s.center), volume: 0.8 });
    }
    return any;
  }
  updateDoors(dt) {
    for (const d of this.doors) {
      const want = d.open ? 1 : 0;
      if (d.k === want) continue;
      const step = (dt * d.speed) / Math.max(1, d.dir.length() / 3);
      d.k = want > d.k ? Math.min(1, d.k + step) : Math.max(0, d.k - step);
      const off = _v.copy(d.dir).multiplyScalar(smooth(d.k));
      const p = this.player, s = d.dyn.solid;
      // a closing door never traps the player inside it: lift them on top / push out
      this.c.moveDyn(d.dyn, off);
      if (p.alive && !d.open && p.pos.x > s.min.x - 0.3 && p.pos.x < s.max.x + 0.3 && p.pos.z > s.min.z - 0.3 && p.pos.z < s.max.z + 0.3 && p.pos.y < s.max.y && p.pos.y + 1.4 > s.min.y) {
        // push the player out along the thin axis toward the open side
        const thinX = s.max.x - s.min.x < s.max.z - s.min.z;
        if (thinX) p.pos.x = p.pos.x < s.center.x ? s.min.x - 0.42 : s.max.x + 0.42;
        else p.pos.z = p.pos.z < s.center.z ? s.min.z - 0.42 : s.max.z + 0.42;
      }
    }
  }

  // ================================================================ movers
  initMover(m) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < m.path.length - 1; i++) { const L = m.path[i].distanceTo(m.path[i + 1]); segs.push(L); total += L; }
    const st = { ...m, segs, total, s: 0, dir: 1, waitT: m.wait, idleT: 0, cur: new THREE.Vector3(), pos: 0 };
    if (m.orbit) st.ang = m.phase;
    // a little rim so platforms read as "machines"
    const mesh = m.dyn.mesh, so = m.dyn.solid;
    if (mesh) {
      const w = so.max.x - so.min.x, d = so.max.z - so.min.z;
      const rim = this.c.mat('moverRim', () => glowMat(0xffd04a, 1.6));
      for (const sgn of [-1, 1]) {
        part(mesh, new THREE.BoxGeometry(w + 0.06, 0.06, 0.06), rim, { pos: [(so.min.x + so.max.x) / 2, so.max.y - 0.04, (sgn > 0 ? so.max.z : so.min.z)], shadow: false });
        part(mesh, new THREE.BoxGeometry(0.06, 0.06, d + 0.06), rim, { pos: [(sgn > 0 ? so.max.x : so.min.x), so.max.y - 0.04, (so.min.z + so.max.z) / 2], shadow: false });
      }
    }
    return st;
  }
  pointOnPath(m, s, out) {
    let acc = 0;
    for (let i = 0; i < m.segs.length; i++) {
      if (s <= acc + m.segs[i] || i === m.segs.length - 1) return out.copy(m.path[i]).lerp(m.path[i + 1], m.segs[i] > 0 ? Math.min(1, Math.max(0, (s - acc) / m.segs[i])) : 0);
      acc += m.segs[i];
    }
    return out.copy(m.path[0]);
  }
  updateMovers(dt) {
    const p = this.player;
    for (const m of this.movers) {
      const so = m.dyn.solid;
      const riding = p.alive && p.onGround && p.groundSolid === so;
      if (m.trigger === 'ride') {
        if (riding) { m.on = true; m.idleT = 0; } else m.idleT += dt;
      }
      let off;
      if (m.orbit) {
        if (m.on) m.ang += m.orbit.w * dt;
        const r = m.orbit.r;
        off = _w.set(r * (Math.cos(m.ang) - Math.cos(m.phase)), (m.orbit.y || 0) * Math.sin(m.ang * 2), r * (Math.sin(m.ang) - Math.sin(m.phase)));
      } else if (m.total > 0) {
        if (m.trigger === 'ride') {
          // elevator: up while ridden, back down after a while empty
          const goal = m.idleT > 2.2 ? 0 : m.on ? m.total : 0;
          if (m.idleT > 2.2) m.on = false;
          if (m.waitT > 0) m.waitT -= dt;
          else if (Math.abs(goal - m.s) > 1e-3) m.s += Math.sign(goal - m.s) * Math.min(Math.abs(goal - m.s), m.speed * dt);
          if (riding && m.s === 0 && m.waitT <= 0 && !m.started) { m.started = true; m.waitT = 0.4; }
          if (!riding && m.s === 0) m.started = false;
        } else if (m.on) {
          if (m.waitT > 0) m.waitT -= dt;
          else {
            m.s += m.dir * m.speed * dt;
            if (m.loop) { if (m.s >= m.total) { m.s -= m.total; } }
            else if (m.s >= m.total) { m.s = m.total; m.dir = -1; m.waitT = m.wait; }
            else if (m.s <= 0) { m.s = 0; m.dir = 1; m.waitT = m.wait; }
          }
        }
        off = this.pointOnPath(m, m.s, _w);
      } else continue;
      const before = _p.copy(m.dyn.offset);
      this.c.moveDyn(m.dyn, off);
      const dy = off.y - before.y;
      if (riding) { p.pos.x += off.x - before.x; p.pos.y += dy; p.pos.z += off.z - before.z; }
      else if (dy > 0 && p.alive && p.vel.y <= 0.5 && p.pos.x > so.min.x && p.pos.x < so.max.x && p.pos.z > so.min.z && p.pos.z < so.max.z && p.pos.y < so.max.y && p.pos.y > so.max.y - dy - 0.3) {
        // a rising platform catches a player who is just landing on it (low frame rates)
        p.pos.y = so.max.y; p.vel.y = 0;
      }
    }
  }
  setMover(id, on) { for (const m of this.movers) if (m.id === id) m.on = on; }

  // ================================================================ crumbles
  decorCrumble(k) {
    const mesh = k.dyn.mesh, so = k.dyn.solid;
    if (!mesh) return;
    k.base.copy(mesh.position);
    const crack = this.c.mat('crack', () => std(0x2b2026, 0.9));
    const w = so.max.x - so.min.x, d = so.max.z - so.min.z;
    for (let i = 0; i < 3; i++) {
      const a = i * 1.1 + 0.4;
      const len = Math.min(w, d) * 0.7;
      const m = part(mesh, new THREE.BoxGeometry(len, 0.02, 0.05), crack, { pos: [(so.min.x + so.max.x) / 2 + Math.cos(a) * w * 0.15, so.max.y + 0.005, (so.min.z + so.max.z) / 2 + Math.sin(a) * d * 0.15], rot: [0, a * 1.7, 0], shadow: false });
      m.raycast = () => {};
    }
  }
  updateCrumbles(dt) {
    const p = this.player, fx = this.S.fx;
    for (const k of this.crumbles) {
      const so = k.dyn.solid, mesh = k.dyn.mesh;
      if (k.state === 'idle') {
        if (p.alive && p.onGround && p.groundSolid === so) {
          k.state = 'shake'; k.t = k.delay;
          this.S.audio?.sfx('land_heavy', { ...posOf(so.center), volume: 0.5, pitch: 0.6 });
        }
      } else if (k.state === 'shake') {
        k.t -= dt;
        if (mesh) mesh.position.set(k.base.x + rand(-0.05, 0.05), k.base.y + rand(-0.03, 0.03), k.base.z + rand(-0.05, 0.05));
        if (Math.random() < dt * 30) fx.spawn(_v.set(rand(so.min.x, so.max.x), so.min.y, rand(so.min.z, so.max.z)), _w.set(0, -1, 0), 0x9a8a7a, rand(0.04, 0.09), 0.8, { grav: 1 });
        if (k.t <= 0) {
          k.state = 'fall'; k.t = k.back; k.fall = 0;
          so.collide = false;
          this.S.audio?.sfx('explode', { ...posOf(so.center), volume: 0.35, pitch: 1.6 });
          fx.splash(_v.copy(so.center), UP, 0x9a8a7a, 12, 4, 0.09);
        }
      } else if (k.state === 'fall') {
        k.t -= dt;
        k.fall += dt;
        if (mesh) { mesh.position.set(k.base.x, k.base.y - k.fall * k.fall * 9, k.base.z); mesh.visible = k.fall < 1.6; }
        if (k.t <= 0 && !(p.alive && inBox(p.pos, so.min, so.max, 0.5))) {
          k.state = 'idle'; so.collide = true;
          if (mesh) { mesh.visible = true; mesh.position.copy(k.base); }
          fx.ring(_v.copy(so.center).setY(so.max.y + 0.05), 0xffd04a, 0.3, 1.6, 0.4, { alpha: 0.7 });
        }
      }
    }
  }
  resetCrumbles() {
    for (const k of this.crumbles) {
      k.state = 'idle'; k.dyn.solid.collide = true;
      if (k.dyn.mesh) { k.dyn.mesh.visible = true; k.dyn.mesh.position.copy(k.base); }
    }
  }

  // ================================================================ sponges
  updateSponges(dt) {
    const p = this.player, c = this.c;
    for (const s of this.sponges) {
      const d = s.dyn, so = d.solid;
      if (!s.grown) {
        s.checkT -= dt;
        if (s.checkT <= 0) {
          s.checkT = 0.25;
          const sf = so.sideFace;
          const scale = s.hFull / Math.max(0.1, d.h);
          let cov = c.faceCoverage(sf.top, 1, 6);
          for (const k of ['px', 'nx', 'pz', 'nz']) if (sf[k]) cov = Math.max(cov, c.faceCoverage(sf[k], 1, 6) * scale);
          s.cov = cov;
          const mat = d.mesh?.material;
          if (mat) mat.emissive.setRGB(0.25 * Math.min(1, cov / s.need), 0.18 * Math.min(1, cov / s.need), 0.02);
          if (cov >= s.need) {
            s.grown = true; s.timer = s.shrink;
            this.S.audio?.sfx('goo_in', { ...posOf(so.center), volume: 0.9, pitch: 0.55 });
            this.S.fx.splash(_v.copy(so.center).setY(so.max.y), UP, this.ink, 14, 4, 0.09);
          }
        }
      }
      const want = s.grown ? 1 : 0;
      if (s.k !== want) {
        const before = d.h;
        s.k = want > s.k ? Math.min(1, s.k + dt * 1.8) : Math.max(0, s.k - dt * 1.2);
        const h = s.h0 + (s.hFull - s.h0) * smooth(s.k);
        const riding = p.alive && p.onGround && p.groundSolid === so;
        c.setDynHeight(d, h);
        if (riding) p.pos.y += h - before;
        // squash-and-stretch wobble while growing
        if (d.mesh) { const wob = Math.sin(s.k * Math.PI) * 0.08; d.mesh.scale.x = 1 + wob; d.mesh.scale.z = 1 + wob; }
      }
      if (s.grown && s.shrink > 0) {
        s.timer -= dt;
        if (s.timer < 1.6 && d.mesh) d.mesh.position.x = d.offset.x + Math.sin(this.t * 40) * 0.03;
        if (s.timer <= 0) {
          s.grown = false;
          if (d.mesh) d.mesh.position.x = d.offset.x;
          // wring the ink out: the sponge goes gray and must be repainted
          for (const k of ['top', 'px', 'nx', 'pz', 'nz']) { const f = so.sideFace[k]; if (f) this.S.world.paint.splat(_v.copy(f.center), Math.max(f.w, f.h) * 0.8, 2, { wobble: 0.1 }); }
          this.S.audio?.sfx('goo_out', { ...posOf(so.center), volume: 0.7, pitch: 0.6 });
        }
      }
    }
  }

  // ================================================================ switches
  initSwitch(sw) {
    const d = sw.dyn, so = d.solid;
    const face = so.sideFace[sw.face];
    const st = { ...sw, faceObj: face, active: false, cov: 0, checkT: Math.random() * 0.2, timer: 0 };
    // glowing frame around the face + a bullseye so it reads as a target
    if (d.mesh && face) {
      const g = new THREE.Group();
      d.mesh.add(g);
      st.frameMat = glowMat(sw.drain ? 0x8be0ff : 0xffd04a, 1.4);
      const c = face.center, n = face.n, u = face.u, v = face.v;
      const off = 0.03;
      const mk = (cx, cy, w, h) => {
        const m = part(g, new THREE.BoxGeometry(1, 1, 0.04), st.frameMat, { shadow: false });
        m.position.copy(c).addScaledVector(n, off).addScaledVector(u, cx).addScaledVector(v, cy);
        m.quaternion.setFromRotationMatrix(_m.makeBasis(u, v, n));
        m.scale.set(w, h, 1);
        m.raycast = () => {};
      };
      const W = face.w, H = face.h, b = 0.09;
      mk(0, H / 2 - b / 2, W, b); mk(0, -H / 2 + b / 2, W, b); mk(W / 2 - b / 2, 0, b, H); mk(-W / 2 + b / 2, 0, b, H);
      const ring = part(g, new THREE.TorusGeometry(Math.min(W, H) * 0.28, 0.05, 6, 32), st.frameMat, { shadow: false });
      ring.position.copy(c).addScaledVector(n, off);
      ring.quaternion.setFromRotationMatrix(_m.makeBasis(u, v, n));
      ring.raycast = () => {};
      st.ring = ring;
      if (sw.drain) {
        // grille bars: a drain cover
        for (let i = -2; i <= 2; i++) mk(i * W * 0.16, 0, 0.05, H * 0.7);
      }
    }
    return st;
  }
  updateSwitches(dt) {
    for (const sw of this.switches) {
      if (sw.timer > 0) {
        sw.timer -= dt;
        if (sw.timer <= 0) this.deactivateSwitch(sw);
      }
      sw.checkT -= dt;
      if (sw.checkT > 0) continue;
      sw.checkT = 0.2;
      if (sw.disabled) { if (sw.frameMat) sw.frameMat.color.setRGB(0.25, 0.25, 0.3); continue; }
      if (sw.active) {
        if (sw.ring) sw.ring.rotation.z += 0.2;
        continue;
      }
      const cov = this.c.faceCoverage(sw.faceObj, 1, 7);
      sw.cov = cov;
      const mat = sw.dyn.mesh?.material;
      const k = Math.min(1, cov / sw.need);
      if (mat) mat.emissive.copy(this.ink).multiplyScalar(0.25 * k);
      if (sw.frameMat) sw.frameMat.color.set(sw.drain ? 0x8be0ff : 0xffd04a).multiplyScalar(1.2 + Math.sin(this.t * 6) * 0.4);
      if (cov >= sw.need) this.activateSwitch(sw);
    }
  }
  activateSwitch(sw) {
    sw.active = true;
    const S = this.S, so = sw.dyn.solid;
    if (sw.frameMat) sw.frameMat.color.copy(this.ink).multiplyScalar(2.6);
    S.fx.ring(_v.copy(sw.faceObj.center).addScaledVector(sw.faceObj.n, 0.1), this.ink, 0.3, 2.4, 0.5, { alpha: 0.9 });
    S.fx.splash(_v.copy(sw.faceObj.center), sw.faceObj.n, this.ink, 14, 5, 0.08);
    S.audio?.sfx('checkpoint', { ...posOf(so.center), volume: 0.7 });
    for (const id of sw.targets) this.trigger(id, true);
    if (sw.timed) {
      sw.timer = sw.timed;
      this.timer = { sw, max: sw.timed };
      S.hud.toast(`<b>${sw.label || 'Switch'}</b> on! Hurry: <b>${sw.timed}</b> seconds!`, 2.6);
    } else if (sw.label) S.hud.toast(`<b>${sw.label}</b>`, 2.6);
    this.setFlag('switch:' + sw.id);
    if (sw.drain) this.setFlag('drain:' + sw.id);
    if (sw.lantern) this.setFlag('lantern:' + sw.id);
  }
  deactivateSwitch(sw) {
    sw.active = false;
    sw.timer = 0;
    if (this.timer?.sw === sw) this.timer = null;
    for (const id of sw.targets) this.trigger(id, false);
    // the gray creeps back over the panel
    const f = sw.faceObj;
    this.S.world.paint.splat(_v.copy(f.center).addScaledVector(f.n, 0.1), Math.max(f.w, f.h), 2, { wobble: 0.1 });
    this.S.audio?.sfx('ui_error', { volume: 0.6 });
    this.S.hud.toast('Too slow! The switch reset. <b>Paint it again!</b>', 2.6);
    this.flags.delete('switch:' + sw.id);
  }
  // enable/disable a switch (e.g. boss drains); a reset wipes its paint and flags
  setSwitch(id, enabled, reset = false) {
    for (const sw of this.switches) {
      if (sw.id !== id) continue;
      sw.disabled = !enabled;
      if (reset) {
        sw.active = false; sw.timer = 0;
        this.flags.delete('switch:' + sw.id); this.flags.delete('drain:' + sw.id);
        const f = sw.faceObj;
        this.S.world.paint.splat(_v.copy(f.center).addScaledVector(f.n, 0.1), Math.max(f.w, f.h), 2, { wobble: 0.1 });
        if (sw.frameMat) sw.frameMat.color.set(sw.drain ? 0x8be0ff : 0xffd04a).multiplyScalar(1.4);
      }
    }
  }
  switchActive(id) { return this.switches.some((sw) => sw.id === id && sw.active); }
  trigger(id, on) {
    this.setDoor(id, on);
    this.setMover(id, on);
    for (const f of this.fans) if (f.id === id) f.on = on;
  }

  // ================================================================ rails
  initRail(r) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < r.pts.length - 1; i++) { const L = r.pts[i].distanceTo(r.pts[i + 1]); segs.push(L); total += L; }
    const st = { ...r, segs, total };
    const tube = this.c.mat('railTube', () => std(0x3a3742, 0.35, 0.8));
    const glow = this.c.mat('railGlow', () => glowMat(0xffd04a, 2.0));
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      rod(this.root, a.toArray(), b.toArray(), 0.07, tube, { seg: 8 });
      rod(this.root, [a.x, a.y + 0.075, a.z], [b.x, b.y + 0.075, b.z], 0.025, glow, { seg: 6, shadow: false });
    }
    // posts + a hook ring at the start
    const post = this.c.mat('railPost', () => std(0x2b2833, 0.5, 0.7));
    for (const pt of [r.pts[0], r.pts[r.pts.length - 1]]) {
      const g = this.S.world.level.heightAt(pt.x, pt.z).y;
      if (Number.isFinite(g) && pt.y - g < 9) rod(this.root, [pt.x, g, pt.z], [pt.x, pt.y, pt.z], 0.09, post, { seg: 8 });
    }
    const hook = part(this.root, new THREE.TorusGeometry(0.45, 0.06, 8, 24), glowMat(0xffd04a, 2.4), { pos: r.pts[0].toArray(), shadow: false });
    st.hook = hook;
    // flowing chevrons
    const n = Math.max(4, Math.round(total / 1.6));
    st.dots = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.24, 6).rotateX(Math.PI / 2), glowMat(0xffe08a, 2.4), n);
    st.dots.frustumCulled = false;
    st.dots.castShadow = false;
    this.root.add(st.dots);
    st.n = n;
    return st;
  }
  railPoint(r, s, out, tan) {
    let acc = 0;
    for (let i = 0; i < r.segs.length; i++) {
      if (s <= acc + r.segs[i] || i === r.segs.length - 1) {
        const k = Math.min(1, Math.max(0, (s - acc) / r.segs[i]));
        if (tan) tan.subVectors(r.pts[i + 1], r.pts[i]).normalize();
        return out.copy(r.pts[i]).lerp(r.pts[i + 1], k);
      }
      acc += r.segs[i];
    }
    return out.copy(r.pts[0]);
  }
  // nearest arc-length position on a rail to p (returns {s, d})
  railNearest(r, p) {
    let best = { s: 0, d: Infinity }, acc = 0;
    for (let i = 0; i < r.segs.length; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      _v.subVectors(b, a);
      const L2 = _v.lengthSq() || 1;
      const t = Math.max(0, Math.min(1, _w.subVectors(p, a).dot(_v) / L2));
      const q = _p.copy(a).addScaledVector(_v, t);
      const d = q.distanceTo(p);
      if (d < best.d) best = { s: acc + t * r.segs[i], d };
      acc += r.segs[i];
    }
    return best;
  }
  updateRails(dt) {
    const p = this.player, I = p.intent;
    this.rideCool = Math.max(0, this.rideCool - dt);
    for (const r of this.rails) {
      // chevrons flow along the rail
      for (let i = 0; i < r.n; i++) {
        const s = ((i / r.n) + (this.t * r.speed * 0.08) % 1) % 1 * r.total;
        this.railPoint(r, s, _v, _w);
        _v.y += 0.18;
        _q.setFromUnitVectors(Z_AXIS, _w);
        _m.compose(_v, _q, _s.set(1, 1, 1));
        r.dots.setMatrixAt(i, _m);
      }
      r.dots.instanceMatrix.needsUpdate = true;
      r.hook.rotation.y += dt * 2;
      r.hook.rotation.x = Math.sin(this.t * 2) * 0.3;
    }
    if (!p.alive) { this.ride = null; return; }
    if (this.ride) {
      const R = this.ride, r = R.rail;
      if (I.jump) {
        this.detach(true);
        return;
      }
      R.s += r.speed * dt;
      if (R.s >= r.total) { this.detach(false); return; }
      this.railPoint(r, R.s, _v, _w);
      p.pos.set(_v.x, _v.y - 1.3, _v.z);
      p.vel.copy(_w).multiplyScalar(r.speed);
      p.vel.y += 24 * dt; // cancel the gravity Fighter applies this step
      I.mx = I.mz = 0; I.goo = false; I.jump = false;
      if (Math.random() < dt * 30) this.S.fx.spawn(_p.copy(_v), _w.clone().multiplyScalar(-2).add(new THREE.Vector3(rand(-1, 1), rand(0, 2), rand(-1, 1))), 0xffd04a, 0.05, 0.3, { grav: 1 });
      return;
    }
    if (this.rideCool > 0 || this.S.flight) return;
    const grab = _grab.set(p.pos.x, p.pos.y + 1.2, p.pos.z);
    for (const r of this.rails) {
      const nr = this.railNearest(r, grab);
      if (nr.d < (p.onGround ? 1.0 : 1.5) && nr.s < r.total - 1.5) {
        this.ride = { rail: r, s: nr.s };
        p.onGround = false;
        this.S.audio?.sfx('launch', { volume: 0.6, pitch: 1.4 });
        this.S.hud.tipOnce?.('rail', 'Riding an <b>ink rail</b>! Press <b>SPACE</b> to jump off early.');
        break;
      }
    }
  }
  detach(jump) {
    const p = this.player, R = this.ride;
    if (!R) return;
    this.railPoint(R.rail, Math.min(R.s, R.rail.total), _v, _w);
    p.vel.copy(_w).multiplyScalar(R.rail.speed * (jump ? 0.75 : 0.9));
    p.vel.y = Math.max(p.vel.y, jump ? 8.5 : 4);
    this.ride = null;
    this.rideCool = 0.6;
    this.S.audio?.sfx('jump', { volume: 0.5 });
  }
  get riding() { return !!this.ride; }

  // ================================================================ fans
  initFan(f) {
    const g = new THREE.Group();
    g.position.copy(f.pos);
    this.root.add(g);
    const iron = this.c.mat('fanIron', () => std(0x3a3742, 0.45, 0.7));
    part(g, new THREE.CylinderGeometry(f.r + 0.15, f.r + 0.25, 0.3, 28), iron, { pos: [0, 0.15, 0], outline: OUTLINE_S });
    part(g, new THREE.TorusGeometry(f.r + 0.05, 0.06, 6, 32), glowMat(0x8be0ff, 1.8), { pos: [0, 0.32, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    const blades = new THREE.Group();
    blades.position.y = 0.22;
    g.add(blades);
    const bm = this.c.mat('fanBlade', () => std(0xc8c4d0, 0.4, 0.6));
    for (let i = 0; i < 5; i++) part(blades, new THREE.BoxGeometry(f.r * 0.9, 0.04, 0.32), bm, { pos: [Math.cos(i * 1.2566) * f.r * 0.45, 0, Math.sin(i * 1.2566) * f.r * 0.45], rot: [0.3, -i * 1.2566, 0], shadow: false });
    // faint column so the updraft reads at a distance
    const colMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.disposables.push(colMat);
    const col = part(g, new THREE.CylinderGeometry(f.r * 0.9, f.r, f.h, 20, 1, true), colMat, { pos: [0, f.h / 2, 0], shadow: false });
    return { ...f, g, blades, col, colMat, spin: f.on ? 1 : 0 };
  }
  updateFans(dt) {
    const p = this.player, fx = this.S.fx;
    for (const f of this.fans) {
      f.spin += ((f.on ? 1 : 0) - f.spin) * damp(2, dt);
      f.blades.rotation.y += dt * 22 * f.spin;
      f.colMat.opacity = 0.07 * f.spin;
      if (f.spin > 0.5 && Math.random() < dt * 14) fx.spawn(_v.set(f.pos.x + rand(-f.r, f.r) * 0.7, f.pos.y + 0.4, f.pos.z + rand(-f.r, f.r) * 0.7), _w.set(0, rand(6, 10), 0), 0xd8f6ff, 0.035, f.h / 9, { grav: 0, stretch: 3, drag: 0 });
      if (!f.on || !p.alive) continue;
      const dy = p.pos.y - f.pos.y;
      if (flat(p.pos, f.pos) < f.r && dy > -0.6 && dy < f.h) {
        const target = f.lift * (1 - Math.max(0, dy) / f.h) + 2.2;
        if (p.vel.y < target) p.vel.y += (target - p.vel.y) * damp(9, dt) + 24 * dt;
        p.onGround = false;
        if (!this.fanTip) { this.fanTip = true; this.S.hud.tipOnce?.('fan', 'Updraft! Ride it up and <b>steer</b> toward the ledge.'); }
      }
    }
  }

  // ================================================================ conveyors
  initConveyor(cv) {
    const so = cv.solid;
    const w = cv.max.x - cv.min.x, d = cv.max.z - cv.min.z;
    const along = Math.abs(cv.dir.x) > Math.abs(cv.dir.z) ? 'x' : 'z';
    const len = along === 'x' ? w : d, wid = along === 'x' ? d : w;
    const n = Math.max(3, Math.floor(len / 1.2));
    const geo = new THREE.ShapeGeometry(chevronShape(Math.min(wid * 0.35, 0.8)));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, glowMat(0xffd04a, 1.3), n);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    this.root.add(mesh);
    // belt rollers at the ends
    const roll = this.c.mat('roller', () => std(0x2b2833, 0.4, 0.8));
    for (const e of [0, 1]) {
      const g = along === 'x' ? new THREE.CylinderGeometry(0.22, 0.22, wid + 0.1, 12).rotateX(Math.PI / 2) : new THREE.CylinderGeometry(0.22, 0.22, wid + 0.1, 12).rotateZ(Math.PI / 2);
      const pos = along === 'x' ? [e ? cv.max.x : cv.min.x, cv.max.y - 0.2, (cv.min.z + cv.max.z) / 2] : [(cv.min.x + cv.max.x) / 2, cv.max.y - 0.2, e ? cv.max.z : cv.min.z];
      part(this.root, g, roll, { pos, shadow: false });
    }
    return { ...cv, solid: so, along, len, n, mesh, yaw: Math.atan2(cv.dir.x, cv.dir.z) };
  }
  updateConveyors(dt) {
    const p = this.player;
    for (const cv of this.conveyors) {
      for (let i = 0; i < cv.n; i++) {
        const u = ((i / cv.n) + (this.t * cv.speed / cv.len)) % 1;
        const s = (cv.dir.x + cv.dir.z > 0 ? u : 1 - u) * cv.len;
        if (cv.along === 'x') _v.set(cv.min.x + s, cv.max.y + 0.02, (cv.min.z + cv.max.z) / 2);
        else _v.set((cv.min.x + cv.max.x) / 2, cv.max.y + 0.02, cv.min.z + s);
        _q.setFromAxisAngle(UP, cv.yaw);
        const fade = Math.min(1, Math.min(s, cv.len - s) / 0.6);
        _m.compose(_v, _q, _s.set(fade, 1, fade));
        cv.mesh.setMatrixAt(i, _m);
      }
      cv.mesh.instanceMatrix.needsUpdate = true;
      if (p.alive && p.onGround && p.groundSolid === cv.solid) {
        p.pos.x += cv.dir.x * cv.speed * dt;
        p.pos.z += cv.dir.z * cv.speed * dt;
      }
    }
  }

  // ================================================================ floods
  initFlood(f) {
    const w = f.max[0] - f.min[0], d = f.max[1] - f.min[1];
    const mat = gooMat(f.color, { transparent: true, opacity: 0.88, emissive: 0x15131a });
    this.disposables.push(mat);
    const mesh = part(this.root, new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2), mat, { pos: [(f.min[0] + f.max[0]) / 2, f.y0, (f.min[1] + f.max[1]) / 2], shadow: false, receive: true });
    // warning stripe on the surface edge
    const edgeMat = glowMat(0xffb020, 1.2, { transparent: true, opacity: 0.0, depthWrite: false });
    this.disposables.push(edgeMat);
    const edge = part(mesh, new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), edgeMat, { pos: [0, 0.02, 0], shadow: false });
    return { ...f, y: f.y0, mesh, edgeMat, edge, on: !f.start, hurtT: 0, rising: false };
  }
  floodTarget(f) {
    const n = f.drains.filter((id) => this.flag('drain:' + id)).length;
    if (f.drains.length && n >= f.drains.length) return f.y0 - 1;
    return f.ymax - f.drop * n;
  }
  updateFloods(dt) {
    const p = this.player, S = this.S;
    for (const f of this.floods) {
      if (!f.on && f.start && p.alive && inBox(p.pos, new THREE.Vector3(...f.start[0]), new THREE.Vector3(...f.start[1]))) {
        f.on = true;
        S.audio?.sfx('boss_roar', { volume: 0.6, pitch: 0.6 });
        S.hud.warn('⚠ The gray is <b>rising</b>! Paint the <b>drains</b>!', 3);
      }
      if (!f.on) continue;
      const target = this.floodTarget(f);
      const prev = f.y;
      if (f.y < target) f.y = Math.min(target, f.y + f.rate * dt);
      else if (f.y > target) f.y = Math.max(target, f.y - f.rate * 3 * dt);
      f.rising = f.y > prev;
      f.mesh.position.y = f.y + Math.sin(this.t * 1.7) * 0.04;
      f.edgeMat.opacity = f.rising ? 0.05 + 0.05 * Math.sin(this.t * 6) : 0;
      if (Math.random() < dt * 8) S.fx.spawn(_v.set(rand(f.min[0], f.max[0]), f.y, rand(f.min[1], f.max[1])), _w.set(0, rand(0.5, 1.5), 0), GRAY_HEX, rand(0.08, 0.16), 0.6, { grav: 0.5 });
      if (!p.alive || p.pos.x < f.min[0] || p.pos.x > f.max[0] || p.pos.z < f.min[1] || p.pos.z > f.max[1]) continue;
      const depth = f.y - p.pos.y;
      if (depth > 0.1 && p.invuln <= 0) {
        const dps = (depth > 1.2 ? 70 : 26) * (S.effects?.armor ?? 1);
        p.hp -= dps * dt;
        p.lastDamage = p.time;
        p.vel.x *= Math.exp(-3 * dt); p.vel.z *= Math.exp(-3 * dt);
        f.hurtT -= dt;
        if (f.hurtT <= 0) { f.hurtT = 0.6; S.onPlayerHurt?.(dps, null); S.hud.tipOnce?.('flood', 'Gray goo burns! Climb out and <b>paint the drains</b> to lower it.'); }
        if (p.hp <= 0) p.splatted(null, 'goo');
      }
    }
  }
  // after a respawn, give the player some air
  floodRespawn(y) { for (const f of this.floods) if (f.on && f.y > y - 1.5) f.y = y - 1.5; }

  // ================================================================ membranes
  initGate(g) {
    const sz = _v.subVectors(g.max, g.min);
    const mat = new THREE.MeshPhysicalMaterial({ color: this.ink, emissive: this.ink, emissiveIntensity: 0.32, transparent: true, opacity: 0.34, roughness: 0.1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    this.disposables.push(mat);
    const geo = g.axis === 'x' ? new THREE.PlaneGeometry(sz.z, sz.y, 12, 8).rotateY(Math.PI / 2) : new THREE.PlaneGeometry(sz.x, sz.y, 12, 8);
    const mesh = part(this.root, geo, mat, { pos: [(g.min.x + g.max.x) / 2, (g.min.y + g.max.y) / 2, (g.min.z + g.max.z) / 2], shadow: false });
    mesh.raycast = () => {};
    const base = Float32Array.from(geo.attributes.position.array);
    // frame
    const fm = this.c.mat('gateFrame', () => std(0x2b2833, 0.4, 0.7));
    const pts = g.axis === 'x'
      ? [[g.min.z, g.min.y], [g.max.z, g.min.y]]
      : [[g.min.x, g.min.y], [g.max.x, g.min.y]];
    for (const [a] of pts) {
      const P = g.axis === 'x' ? [(g.min.x + g.max.x) / 2, 0, a] : [a, 0, (g.min.z + g.max.z) / 2];
      part(this.root, new THREE.BoxGeometry(0.3, sz.y, 0.3), fm, { pos: [P[0], (g.min.y + g.max.y) / 2, P[2]], outline: OUTLINE_S });
    }
    return { ...g, mesh, mat, geo, base, wasIn: false };
  }
  updateGates(dt) {
    const p = this.player;
    const pass = p.alive && (p.form === 'goo' || p.intent.goo);
    for (const g of this.gates) {
      g.solid.collide = !pass;
      g.mat.opacity = pass ? 0.18 : 0.34 + Math.sin(this.t * 3) * 0.05;
      const a = g.geo.attributes.position, b = g.base;
      for (let i = 0; i < a.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
        const w = Math.sin(this.t * 3 + (g.axis === 'x' ? z : x) * 2 + y * 1.5) * 0.05;
        if (g.axis === 'x') a.array[i * 3] = x + w; else a.array[i * 3 + 2] = z + w;
      }
      a.needsUpdate = true;
      const inside = p.alive && inBox(p.pos, g.min, g.max, 0.35);
      if (inside && !g.wasIn) {
        this.S.fx.ring(_v.copy(p.pos).setY(p.pos.y + 0.4), this.ink, 0.3, 1.6, 0.4, { alpha: 0.8 });
        this.S.audio?.sfx('goo_in', { volume: 0.5, pitch: 1.3 });
      }
      g.wasIn = inside;
    }
  }

  // ================================================================ arenas
  updateArenas(dt) {
    const p = this.player, S = this.S;
    for (const a of this.arenas) {
      if (a.state === 'idle') {
        if (p.alive && inBox(p.pos, a.min, a.max)) this.startArena(a);
      } else if (a.state === 'active') {
        const left = S.enemies.filter((e) => e.alive && e.group === a.group).length;
        if (left === 0) {
          if (a.waitT <= 0) a.waitT = 1.3;
          a.waitT -= dt;
          if (a.waitT <= 0) {
            a.wave++;
            if (a.wave < a.waves.length) this.spawnWave(a);
            else this.finishArena(a);
          }
        }
      }
    }
  }
  startArena(a) {
    const S = this.S;
    a.state = 'active'; a.wave = 0; a.waitT = 0;
    a.prevOpen = a.doors.map((id) => this.doors.some((d) => d.id === id && d.open));
    for (const id of a.doors) this.setDoor(id, false);
    S.audio?.sfx('boss_roar', { volume: 0.55, pitch: 1.6 });
    S.hud.warn(`⚠ ${a.name ? a.name.toUpperCase() + ': ' : ''}<b>AMBUSH!</b> Splash every Drab!`, 2.4);
    S.rig?.shake(0.3, 0.4);
    this.spawnWave(a);
  }
  spawnWave(a) {
    const S = this.S;
    for (const e of a.waves[a.wave]) {
      S.fx.splash(_v.copy(e.pos).setY(e.pos.y + 0.6), UP, GRAY_HEX, 14, 5, 0.1);
      S.spawnEnemy({ ...e, pos: e.pos.clone(), group: a.group, spawnIn: true });
    }
    if (a.wave > 0) S.hud.toast(`Wave <b>${a.wave + 1}</b> of ${a.waves.length}!`, 2);
  }
  finishArena(a) {
    const S = this.S;
    a.state = 'done';
    for (const id of a.doors) this.setDoor(id, true);
    S.audio?.sfx('core_get', { volume: 0.6, pitch: 1.3 });
    S.hud.toast(`${a.name ? `<b>${a.name}</b> cleared!` : 'Area cleared!'} The doors are open.`, 3);
    const c = _v.copy(a.min).add(a.max).multiplyScalar(0.5);
    c.y = Math.max(a.min.y, S.player.pos.y) + 1.5;
    this.dropShards(S.player.pos.clone().setY(S.player.pos.y + 1.5), a.shards, 4);
    this.setFlag('arena:' + a.id);
  }
  resetArenas() {
    for (const a of this.arenas) {
      if (a.state !== 'active') continue;
      a.state = 'idle';
      for (const e of this.S.enemies) if (e.alive && e.group === a.group) e.die(this.player, 'clear');
      a.doors.forEach((id, i) => this.setDoor(id, a.prevOpen ? a.prevOpen[i] : true));
    }
  }
  get arenaActive() { return this.arenas.find((a) => a.state === 'active') || null; }

  // ================================================================ pump (defend)
  initPump(pd) {
    const g = new THREE.Group();
    g.position.copy(pd.pos);
    this.root.add(g);
    const iron = this.c.mat('pumpIron', () => std(0x3a3742, 0.45, 0.7));
    part(g, new THREE.CylinderGeometry(1.6, 1.8, 0.5, 20), iron, { pos: [0, 0.25, 0], outline: OUTLINE_S });
    const tankMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false });
    this.disposables.push(tankMat);
    part(g, new THREE.CylinderGeometry(1.1, 1.1, 3, 24, 1, true), tankMat, { pos: [0, 2.0, 0], shadow: false });
    const fillMat = new THREE.MeshStandardMaterial({ color: 0x2ee6a8, emissive: 0x2ee6a8, emissiveIntensity: 0.8, roughness: 0.2 });
    this.disposables.push(fillMat);
    const fill = part(g, new THREE.CylinderGeometry(1.0, 1.0, 1, 24), fillMat, { pos: [0, 0.5, 0], shadow: false });
    fill.scale.y = 0.02;
    part(g, new THREE.CylinderGeometry(1.25, 1.25, 0.3, 20), iron, { pos: [0, 3.6, 0], outline: OUTLINE_S });
    const wheel = part(g, new THREE.TorusGeometry(0.6, 0.08, 8, 20), std(0xc8643c, 0.4, 0.6), { pos: [0, 4.0, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    for (let i = 0; i < 4; i++) part(g, new THREE.BoxGeometry(0.12, 2.6, 0.12), iron, { pos: [Math.cos(i * 1.57 + 0.78) * 1.2, 2.0, Math.sin(i * 1.57 + 0.78) * 1.2], shadow: false });
    // combat proxy: Drab shots, bombs and bites damage it (same team as the player)
    const self = this;
    const proxy = {
      team: 1, name: 'Color Pump', pos: pd.pos.clone(), vel: new THREE.Vector3(), alive: true, invuln: 0, submerged: false, form: 'kid', time: 0,
      hitHeight: () => 3.4, isPump: true,
      takeDamage(dmg) { if (st.state !== 'run') return; st.hp -= dmg; st.flash = 1; if (st.hp <= 0) self.failPump(st); },
    };
    const st = { ...pd, g, fill, fillMat, wheel, proxy, state: 'idle', hp: pd.hp, t: 0, waveI: 0, flash: 0, ctx: null };
    return st;
  }
  updatePumps(dt) {
    const p = this.player, S = this.S;
    for (const pm of this.pumps) {
      pm.flash = Math.max(0, pm.flash - dt * 5);
      pm.fillMat.emissiveIntensity = 0.8 + pm.flash * 2;
      if (pm.state === 'idle') {
        if (pm.retryT > 0) { pm.retryT -= dt; continue; }
        if (p.alive && pm.zone && inBox(p.pos, pm.zone.min, pm.zone.max)) this.startPump(pm);
      } else if (pm.state === 'run') {
        pm.t += dt;
        pm.wheel.rotation.z += dt * 3;
        pm.fill.scale.y = Math.max(0.02, (pm.t / pm.time) * 2.9);
        pm.fill.position.y = 0.5 + pm.fill.scale.y / 2;
        while (pm.waveI < pm.waves.length && pm.t >= pm.waves[pm.waveI].t) {
          for (const e of pm.waves[pm.waveI].list) {
            S.fx.splash(_v.copy(e.pos).setY(e.pos.y + 0.6), UP, GRAY_HEX, 14, 5, 0.1);
            const en = S.spawnEnemy({ ...e, pos: e.pos.clone(), group: 'pump', spawnIn: true });
            if (e.atPump !== false) en.foe = pm.proxy;
          }
          pm.waveI++;
        }
        if (Math.random() < dt * 6) S.fx.spawn(_v.set(pm.pos.x + rand(-0.8, 0.8), pm.pos.y + 3.7, pm.pos.z + rand(-0.8, 0.8)), _w.set(0, 2, 0), 0x2ee6a8, 0.06, 0.8, { grav: -0.1 });
        if (pm.t >= pm.time) this.finishPump(pm);
      }
    }
  }
  startPump(pm) {
    const S = this.S;
    pm.state = 'run'; pm.t = 0; pm.hp = pm.hp0 ?? pm.hp; pm.hp0 = pm.hp0 ?? pm.hp; pm.waveI = 0;
    pm.proxy.alive = true;
    if (!S.world.fighters.includes(pm.proxy)) S.world.fighters.push(pm.proxy);
    S.audio?.sfx('door_heavy', { volume: 0.8 });
    S.hud.warn('⚠ The Drab want that pump! <b>Defend it</b> until the tank is full!', 3);
    S.hud.boss(true, 'COLOR PUMP');
    S.audio?.music('battle_b');
  }
  failPump(pm) {
    const S = this.S;
    pm.state = 'idle'; pm.retryT = 3;
    pm.fill.scale.y = 0.02;
    for (const e of S.enemies) if (e.alive && e.group === 'pump') e.die(this.player, 'clear');
    S.hud.boss(false);
    S.hud.warn('The pump was swamped! Step back onto the platform to <b>try again</b>.', 3.5);
    S.audio?.sfx('lose_sting', { volume: 0.6 });
    S.audio?.music(S.def.music);
    pm.hp = pm.hp0;
  }
  finishPump(pm) {
    const S = this.S;
    pm.state = 'done';
    const i = S.world.fighters.indexOf(pm.proxy); if (i >= 0) S.world.fighters.splice(i, 1);
    pm.proxy.alive = false;
    for (const e of S.enemies) if (e.alive && e.group === 'pump') e.die(this.player, 'clear');
    S.hud.boss(false);
    S.fx.explosion(pm.pos.clone().setY(3), 0x2ee6a8, 3);
    S.audio?.sfx('core_get', { volume: 0.8 });
    S.audio?.music(S.def.music);
    S.hud.toast('Tank full! The <b>Kelp Core</b> chamber is unsealed!', 3.5);
    this.setFlag('pump');
  }
  resetPumps() { for (const pm of this.pumps) if (pm.state === 'run') this.failPump(pm); }
  get pumpRunning() { return this.pumps.find((pm) => pm.state === 'run') || null; }

  // ================================================================ lanterns
  initLantern(l) {
    const g = new THREE.Group();
    g.position.copy(l.pos);
    this.root.add(g);
    const iron = this.c.mat('lanternIron', () => std(0x1d1b22, 0.5, 0.6));
    part(g, new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), iron, { pos: [0, 1.2, 0], outline: OUTLINE_S });
    part(g, new THREE.BoxGeometry(0.5, 0.06, 0.5), iron, { pos: [0, 2.4, 0], shadow: false });
    const glass = new THREE.MeshStandardMaterial({ color: 0x3a3742, emissive: 0x000000, roughness: 0.2, metalness: 0.1 });
    this.disposables.push(glass);
    const bulb = part(g, new THREE.SphereGeometry(0.28, 14, 10), glass, { pos: [0, 2.72, 0], shadow: false });
    part(g, new THREE.ConeGeometry(0.36, 0.3, 4), iron, { pos: [0, 3.12, 0], rot: [0, Math.PI / 4, 0], shadow: false });
    const st = { ...l, g, glass, bulb, k: l.lit ? 1 : 0, checkT: Math.random() * 0.3, plate: null };
    return st;
  }
  updateLanterns(dt) {
    if (!this.lanterns.length) return;
    const p = this.player, S = this.S;
    for (const l of this.lanterns) {
      if (!l.lit) {
        l.checkT -= dt;
        if (l.checkT <= 0) {
          l.checkT = 0.25;
          // paint the floor at its foot (or shoot the lamp) to light it
          const face = S.world.level.groundAt(l.pos.x, l.pos.z, l.pos.y + 0.2, 0.3, 0.6).solid?.sideFace?.top;
          let n = 0;
          if (face) for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0, 0]]) if (S.world.paint.ownerAt(face, _v.set(l.pos.x + dx, l.pos.y, l.pos.z + dz)) === 1) n++;
          if (n >= 3 || l.hit) this.lightLantern(l);
        }
      }
      l.k += ((l.lit ? 1 : 0) - l.k) * damp(4, dt);
      l.glass.emissive.set(l.color).multiplyScalar(l.k * (2.4 + Math.sin(this.t * 7 + l.pos.x) * 0.15));
    }
    // hand the light pool to the nearest lit lanterns
    if (this.lightPool.length) {
      const lit = this.lanterns.filter((l) => l.lit).sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
      this.lightPool.forEach((L, i) => {
        const l = lit[i];
        if (!l) { L.intensity = 0; return; }
        L.position.copy(l.pos).setY(l.pos.y + 2.7);
        L.color.set(l.color);
        L.distance = l.r * 1.6;
        L.intensity = 18 * l.k;
      });
    }
  }
  lightLantern(l) {
    if (l.lit) return;
    l.lit = true;
    const S = this.S;
    S.fx.explosion(l.pos.clone().setY(l.pos.y + 2.7), l.color, 1.2);
    S.audio?.sfx('pickup', { ...posOf(l.pos), volume: 0.7, pitch: 0.8 });
    this.dropShards(l.pos.clone().setY(l.pos.y + 2.5), 2, 2);
    this.setFlag('lantern');
    const n = this.lanterns.filter((x) => x.lit).length;
    S.hud.toast(`Lantern lit! <b>${n}/${this.lanterns.length}</b>`, 1.8);
  }

  // ================================================================ shards
  initShards() {
    const S = this.S, c = this.c;
    const got = new Set(S.shardsGot || []);
    this.shards = c.shards.map((d, i) => ({ i, pos: d.pos.clone(), base: d.pos.clone(), big: d.big, value: d.big ? 5 : 1, taken: false, echo: got.has(i), fly: false }));
    const smallGeo = new THREE.OctahedronGeometry(0.17, 0); smallGeo.scale(0.8, 1.35, 0.8);
    const bigGeo = new THREE.OctahedronGeometry(0.34, 0); bigGeo.scale(0.8, 1.35, 0.8);
    this.shardMat = new THREE.MeshPhysicalMaterial({ color: 0x9ff4ff, emissive: 0x5fd8ff, emissiveIntensity: 1.0, roughness: 0.05, clearcoat: 1, flatShading: true });
    this.shardEcho = new THREE.MeshBasicMaterial({ color: 0x9ff4ff, transparent: true, opacity: 0.18, depthWrite: false });
    this.bigMat = new THREE.MeshPhysicalMaterial({ color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: 1.1, roughness: 0.05, clearcoat: 1, flatShading: true });
    this.disposables.push(this.shardMat, this.shardEcho, this.bigMat, smallGeo, bigGeo);
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.frustumCulled = false; m.castShadow = false; m.count = n; this.root.add(m); return m; };
    this.shardMesh = mk(smallGeo, this.shardMat, 160);
    this.echoMesh = mk(smallGeo, this.shardEcho, Math.max(1, this.shards.filter((s) => s.echo).length + 8));
    this.bigMesh = mk(bigGeo, this.bigMat, Math.max(1, this.shards.filter((s) => s.big).length));
    this.drops = [];
    this.levelShards = this.shards.filter((s) => !s.echo).reduce((a, s) => a + s.value, 0);
  }
  dropShards(pos, n, spread = 2) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.drops.push({ pos: pos.clone(), vel: new THREE.Vector3(Math.cos(a) * rand(1, spread), rand(4, 7), Math.sin(a) * rand(1, spread)), t: 0 });
    }
  }
  updateShards(dt) {
    const S = this.S, p = this.player;
    const mag = S.effects?.magnet ?? 1.4;
    const cx = p.pos.x, cy = p.pos.y + 0.8, cz = p.pos.z;
    let ns = 0, ne = 0, nb = 0;
    const spin = this.t * 2.2;
    for (const s of this.shards) {
      if (s.taken) continue;
      const dx = cx - s.pos.x, dy = cy - s.pos.y, dz = cz - s.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!s.echo && p.alive) {
        if (d < 0.85) { this.takeShard(s); continue; }
        if (d < mag || s.fly) {
          s.fly = true;
          const sp = Math.min(d, (8 + (mag - d) * 3) * dt);
          s.pos.x += (dx / d) * sp; s.pos.y += (dy / d) * sp; s.pos.z += (dz / d) * sp;
        }
      }
      const bob = s.fly ? 0 : Math.sin(this.t * 2.4 + s.i) * 0.12;
      _q.setFromAxisAngle(UP, spin + s.i);
      _m.compose(_v.set(s.pos.x, s.pos.y + 0.35 + bob, s.pos.z), _q, _s.set(1, 1, 1));
      if (s.echo) { if (ne < this.echoMesh.instanceMatrix.count) this.echoMesh.setMatrixAt(ne++, _m); }
      else if (s.big) this.bigMesh.setMatrixAt(nb++, _m);
      else if (ns < 160) this.shardMesh.setMatrixAt(ns++, _m);
    }
    // enemy drops: pop out, then home in
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const s = this.drops[i];
      s.t += dt;
      if (s.t < 0.55) { s.vel.y -= 18 * dt; s.pos.addScaledVector(s.vel, dt); }
      else {
        const dx = cx - s.pos.x, dy = cy - s.pos.y, dz = cz - s.pos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 0.7 || s.t > 6 || !p.alive) { this.drops.splice(i, 1); if (p.alive) this.gainShards(1, s.pos, true); continue; }
        const sp = Math.min(d, (10 + s.t * 6) * dt);
        s.pos.x += (dx / d) * sp; s.pos.y += (dy / d) * sp; s.pos.z += (dz / d) * sp;
      }
      _q.setFromAxisAngle(UP, spin * 3 + i);
      _m.compose(s.pos, _q, _s.set(0.8, 0.8, 0.8));
      if (ns < 160) this.shardMesh.setMatrixAt(ns++, _m);
    }
    this.shardMesh.count = ns; this.echoMesh.count = ne; this.bigMesh.count = nb;
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.echoMesh.instanceMatrix.needsUpdate = true;
    this.bigMesh.instanceMatrix.needsUpdate = true;
  }
  takeShard(s) {
    s.taken = true;
    this.S.onShardIndex?.(s.i);
    this.gainShards(s.value, s.pos, false);
    if (s.big) this.S.fx.explosion(s.pos.clone().setY(s.pos.y + 0.4), 0xffd04a, 0.9);
  }
  gainShards(n, pos, quiet) {
    const S = this.S;
    S.addShards(n);
    S.fx.splash(_v.copy(pos).setY(pos.y + 0.4), UP, n >= 5 ? 0xffd04a : 0x9ff4ff, n >= 5 ? 12 : 4, 3, 0.05);
    this.shardSfxT = this.shardSfxT || 0;
    if (!quiet || this.t - this.shardSfxT > 0.08) {
      this.shardSfxT = this.t;
      this.combo = this.t - (this.lastShardT || -9) < 0.6 ? Math.min(10, (this.combo || 0) + 1) : 0;
      this.lastShardT = this.t;
      S.audio?.sfx('coin', { volume: n >= 5 ? 0.8 : 0.45, pitch: 1.2 + this.combo * 0.06 });
    }
  }

  // ================================================================ arrows
  initArrows() {
    if (!this.c.arrows.length) return;
    const geo = new THREE.ShapeGeometry(arrowShape());
    this.disposables.push(geo);
    this.arrowMats = [];
    for (const a of this.c.arrows) {
      const mat = glowMat(a.color, 1.5, { transparent: true, opacity: 0.85, depthWrite: false });
      this.arrowMats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.scale.setScalar(a.s);
      m.position.copy(a.pos);
      if (a.wall) {
        // standing on a wall: arrow points along yaw in the wall plane (yaw 0 = up)
        m.rotation.set(0, a.wall, 0);
        m.rotateZ(-a.yaw);
      } else {
        m.rotation.set(-Math.PI / 2, 0, 0);
        m.position.y += 0.03;
        m.rotateZ(a.yaw + Math.PI);
      }
      m.raycast = () => {};
      m.renderOrder = 2;
      this.root.add(m);
    }
    this.disposables.push(...this.arrowMats);
  }

  // ================================================================ frame
  pre(dt) {
    this.t += dt;
    this.updateDoors(dt);
    this.updateMovers(dt);
    this.updateConveyors(dt);
    this.updateFans(dt);
    this.updateGates(dt);
    this.updateRails(dt);
  }
  post(dt) {
    this.updateCrumbles(dt);
    this.updateSponges(dt);
    this.updateSwitches(dt);
    this.updateFloods(dt);
    this.updateArenas(dt);
    this.updatePumps(dt);
    this.updateLanterns(dt);
    this.updateShards(dt);
    if (this.arrowMats) for (let i = 0; i < this.arrowMats.length; i++) this.arrowMats[i].opacity = 0.55 + 0.35 * Math.sin(this.t * 3 - i * 0.7);
    if (this.timer) {
      const sw = this.timer.sw;
      this.S.hud.timer(sw.timer > 0 ? sw.timer : null, sw.label);
      if (sw.timer > 0 && Math.ceil(sw.timer) !== this.tickS) { this.tickS = Math.ceil(sw.timer); if (this.tickS <= 5) this.S.audio?.sfx('countdown', { volume: 0.5 }); }
    } else this.S.hud.timer(null);
  }
  onPlayerDeath() {
    this.ride = null;
    this.resetArenas();
    this.resetPumps();
    for (const sw of this.switches) if (sw.timer > 0) this.deactivateSwitch(sw);
  }
  onRespawn(pos) {
    this.resetCrumbles();
    this.floodRespawn(pos.y);
  }

  dispose() {
    // the sponge texture is cached across visits; free its GPU copy (it re-uploads on reuse)
    if (this.sponges.length) spongeTex?.dispose();
    for (const m of this.disposables) m.dispose?.();
    for (const r of this.rails) { r.dots.geometry.dispose(); r.dots.material.dispose(); }
    for (const cv of this.conveyors) { cv.mesh.geometry.dispose(); cv.mesh.material.dispose(); }
    for (const L of this.lightPool) L.dispose?.();
    disposeTree(this.root);
  }
}

function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.9); s.lineTo(0.62, 0.2); s.lineTo(0.24, 0.2); s.lineTo(0.24, -0.8);
  s.lineTo(-0.24, -0.8); s.lineTo(-0.24, 0.2); s.lineTo(-0.62, 0.2); s.closePath();
  return s;
}
function chevronShape(w) {
  const s = new THREE.Shape();
  s.moveTo(-w, -0.15); s.lineTo(0, 0.25); s.lineTo(w, -0.15); s.lineTo(w, -0.4); s.lineTo(0, 0); s.lineTo(-w, -0.4); s.closePath();
  return s;
}
