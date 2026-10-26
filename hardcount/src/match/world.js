// The 3D side of a match: the venue, a model for every player who takes the
// field, the ball, the officials and the little bits of broadcast furniture
// that live in the scene (the controlled-player ring, the kick aim arrow,
// yellow flags). It draws frames (frame.js) — live ones from the sim or
// recorded ones from the replay deck — and knows nothing about the rules.
//
//   const w = new MatchWorld(renderer, match, { venue, time, weather, home, away });
//   await w.build(progress);
//   w.draw(frame, dt, { camera, users, ... });
import * as THREE from 'three';
import { clamp, wrapAngle } from '../core/util.js';
import { kitsFor } from '../data/teams.js';
import { buildRoster } from '../data/roster.js';

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
const AX_Z = new THREE.Vector3(0, 0, 1), AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ fallbacks (no art modules yet)

function fallbackField(field) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#2f6a2a'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 24; i++) { x.fillStyle = i % 2 ? '#2c6427' : '#33702e'; x.fillRect(i * 1024 / 24, 0, 1024 / 24, 512); }
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3;
  const total = field.L + field.EZ * 2;
  for (let yd = 0; yd <= field.L; yd += 5) { const px = (field.EZ + yd) / total * 1024; x.beginPath(); x.moveTo(px, 10); x.lineTo(px, 502); x.stroke(); }
  x.strokeRect(2, 10, 1020, 492);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(total, field.W + 4), new THREE.MeshLambertMaterial({ map: tex }));
  mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = Math.PI / 2;
  g.add(mesh);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x1e3a1c }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  g.add(ground);
  return g;
}

function fallbackVenue(field) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1220);
  scene.fog = new THREE.Fog(0x0d1220, 80, 260);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x203018, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(30, 60, 20);
  scene.add(key);
  scene.add(fallbackField(field));
  let lines = null;
  return {
    scene, post: {}, field, cams: {},
    update() {},
    setScoreboard() {},
    setMarkers(mk = {}) {
      if (!lines) {
        lines = new THREE.Group();
        const mat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false });
        const geo = new THREE.PlaneGeometry(field.W, 0.25);
        const a = new THREE.Mesh(geo, mat(0x3a7bff)); a.rotation.x = -Math.PI / 2; a.position.y = 0.03; a.name = 'los';
        const b = new THREE.Mesh(geo, mat(0xffd21a)); b.rotation.x = -Math.PI / 2; b.position.y = 0.035; b.name = 'fd';
        lines.add(a, b);
        scene.add(lines);
      }
      lines.visible = mk.show !== false;
      lines.children[0].position.z = mk.los ?? 0;
      lines.children[1].position.z = mk.firstDown ?? 0;
      lines.children[1].visible = mk.firstDown !== null && mk.firstDown !== undefined;
    },
    focusShadow() {},
    flashes() {},
    dispose() {},
  };
}

/** A blocky stand-in used until (or if) the real player models fail to load. */
function fallbackPlayer({ team, kit }) {
  const group = new THREE.Group();
  const k = team.uniform?.[kit] || team.uniform?.home || {};
  const jersey = new THREE.Color(k.jersey || team.colors.primary);
  const pants = new THREE.Color(k.pants || '#dddddd');
  const helmet = new THREE.Color(team.helmet?.shell || team.colors.primary);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 10), new THREE.MeshLambertMaterial({ color: jersey }));
  body.position.y = 1.35;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.95, 8), new THREE.MeshLambertMaterial({ color: pants }));
  legs.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshLambertMaterial({ color: helmet }));
  head.position.y = 2.0;
  group.add(body, legs, head);
  return {
    group,
    update(dt, A) {
      group.position.set(A.x, 0, A.z);
      group.rotation.y = A.heading;
      const down = A.base === 'lie_front' || A.base === 'lie_back';
      group.rotation.x = down ? (A.base === 'lie_front' ? Math.PI / 2 : -Math.PI / 2) : 0;
      group.position.y = down ? 0.25 : 0;
    },
    ballTransform(carry, outPos, outQuat) {
      outPos.set(0.18, 1.3, 0.3).applyQuaternion(group.quaternion).add(group.position);
      outQuat.copy(group.quaternion);
    },
    handWorld(side, out) { return out.set(side === 'L' ? 0.3 : -0.3, 1.2, 0.3).applyQuaternion(group.quaternion).add(group.position); },
    headWorld(out) { return out.set(0, 2.0, 0).add(group.position); },
    setDirt() {}, setLod() {}, setHelmet() {}, setKit() {}, setPlayer() {},
    dispose() { group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); },
  };
}

function fallbackBall() {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshLambertMaterial({ color: 0x6a3a1c }));
  mesh.scale.set(1, 1, 1.6);
  g.add(mesh);
  return { group: g };
}

// ------------------------------------------------------------------ ring / arrow / flag props

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 30, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  // a notch that points where he's facing
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath(); x.moveTo(64, 2); x.lineTo(56, 16); x.lineTo(72, 16); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeRing(color) {
  const mat = new THREE.MeshBasicMaterial({ map: ringTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 5;
  const holder = new THREE.Group();
  holder.add(mesh);
  holder.visible = false;
  return holder;
}

function makeArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.35, 0); shape.lineTo(0.35, 0); shape.lineTo(0.35, 6); shape.lineTo(1.1, 6); shape.lineTo(0, 8); shape.lineTo(-1.1, 6); shape.lineTo(-0.35, 6); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  geo.scale(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.06;
  const g = new THREE.Group();
  g.add(mesh);
  g.visible = false;
  return g;
}

function makeFlagProp() {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42, 2, 2), new THREE.MeshLambertMaterial({ color: 0xffd400, side: THREE.DoubleSide, emissive: 0x332a00 }));
  cloth.rotation.x = -Math.PI / 2;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshLambertMaterial({ color: 0xffd400 }));
  knot.position.y = 0.04;
  g.add(cloth, knot);
  return g;
}

// ------------------------------------------------------------------ the world

export class MatchWorld {
  constructor(renderer, m, opts = {}) {
    this.renderer = renderer;
    this.m = m;
    this.opts = opts;
    this.models = new Map();       // entity id → { model, team, side, A, prev, dirt, vis }
    this.refModels = new Map();    // official id → { model, prev }
    this.flagProps = [];
    this.ballAngle = 0;
    this.time = 0;
    this.ready = false;
    this.huddle = null;            // visual-only huddle / walk-in positions
  }

  async build(progress = () => {}) {
    const m = this.m;
    const o = this.opts;
    let venueMod = null, playerMod = null;
    try { venueMod = await import('../gfx/stadium/index.js'); } catch (e) { console.warn('venue module unavailable', e); }
    progress(0.2);
    try { playerMod = await import('../gfx/player/index.js'); } catch (e) { console.warn('player module unavailable', e); }
    this.playerMod = playerMod;
    progress(0.35);
    if (venueMod?.buildVenue) {
      try {
        this.venue = await venueMod.buildVenue(this.renderer.gl || this.renderer.renderer || this.renderer, {
          venue: o.venue, field: m.field, home: m.teams.home, away: m.teams.away,
          time: o.time, weather: o.weather, wind: o.wind ?? m.wind, crowd: o.crowd ?? 0.85, quality: o.quality,
        });
      } catch (e) { console.error('venue build failed', e); }
    }
    if (!this.venue) this.venue = fallbackVenue(m.field);
    this.scene = this.venue.scene;
    progress(0.65);

    // kits: the visitors wear whatever contrasts
    const kits = kitsFor ? kitsFor(m.teams.home, m.teams.away) : { home: 'home', away: 'away' };
    this.kits = { home: kits.home || 'home', away: kits.away || 'away' };

    // the starters get models now; anybody else when he first takes the field
    const pre = [];
    for (const side of ['home', 'away']) {
      const roster = buildRoster(m.teams[side]);
      const d = roster.depth;
      const starters = [d.QB[0], d.RB[0], d.WR[0], d.WR[1], d.WR[2], d.TE[0], d.C[0], d.G[0], d.G[1], d.DL[0], d.DL[1], d.LB[0], d.LB[1], d.CB[0], d.CB[1], d.S[0], d.K[0]];
      for (const p of starters) if (p) pre.push({ side, p });
    }
    let i = 0;
    for (const { side, p } of pre) {
      this.modelFor(p.id, side, p);
      if (++i % 4 === 0) { progress(0.65 + 0.3 * (i / pre.length)); await new Promise((r) => setTimeout(r, 0)); }
    }

    // the ball
    try { this.ball = playerMod?.createBallModel ? playerMod.createBallModel({ stripes: m.teams.home.level === 'college' || m.teams.home.level === 'hs', lod: 'high' }) : fallbackBall(); } catch (e) { console.warn(e); this.ball = fallbackBall(); }
    this.scene.add(this.ball.group);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.scale.set(1, 1.7, 1);
    this.scene.add(this.ballShadow);

    // officials
    for (const id of ['R', 'U', 'HL', 'LJ', 'BJ']) {
      let model = null;
      try { model = playerMod?.createRefModel ? playerMod.createRefModel({ role: id === 'R' ? 'referee' : id === 'U' ? 'umpire' : 'judge', lod: 'low' }) : null; } catch (e) { console.warn(e); }
      if (!model) model = fallbackPlayer({ team: { colors: { primary: '#111111' }, uniform: { home: { jersey: '#eeeeee', pants: '#ffffff' } }, helmet: { shell: '#111111' } }, kit: 'home' });
      this.scene.add(model.group);
      this.refModels.set(id, { model, prev: null });
    }

    // broadcast furniture
    this.rings = [makeRing(0x46e8ff), makeRing(0xff9a2a)];
    for (const r of this.rings) this.scene.add(r);
    this.arrow = makeArrow();
    this.scene.add(this.arrow);
    progress(1);
    this.ready = true;
  }

  get post() { return this.venue?.post || {}; }

  modelFor(id, side, player = null) {
    let rec = this.models.get(id);
    if (rec) return rec;
    const m = this.m;
    const team = m.teams[side];
    if (!player) player = m.rosters?.[side]?.byId?.[id] || buildRoster(team).byId[id] || null;
    let model = null;
    try {
      model = this.playerMod?.createPlayerModel ? this.playerMod.createPlayerModel({ team, kit: this.kits[side], player, lod: 'high' }) : null;
    } catch (e) { console.warn('player model failed', e); }
    if (!model) model = fallbackPlayer({ team, kit: this.kits[side] });
    model.group.visible = false;
    this.scene.add(model.group);
    rec = { model, side, team, player, prev: null, dirt: 0, lod: 'high', vis: null };
    this.models.set(id, rec);
    return rec;
  }

  /** Build the model's animation state from one entity record (and the previous one). */
  animState(rec, f, dt) {
    const sp = Math.hypot(f.vx, f.vz);
    const prev = rec.prev;
    const moveDir = sp > 0.2 ? Math.atan2(f.vx, f.vz) : f.h;
    let accel = 0, turn = 0;
    if (prev && dt > 0) {
      accel = (sp - prev.speed) / dt;
      turn = wrapAngle(f.h - prev.heading) / dt;
      accel = prev.accel + (clamp(accel, -30, 30) - prev.accel) * Math.min(1, dt * 10);
      turn = prev.turnRate + (clamp(turn, -12, 12) - prev.turnRate) * Math.min(1, dt * 10);
    }
    // dirt: every trip to the turf leaves its mark
    if ((f.base === 'lie_front' || f.base === 'lie_back') && (!prev || (prev.base !== f.base))) rec.dirt = Math.min(1, rec.dirt + 0.12 + (this.opts.weather === 'rain' || this.opts.weather === 'snow' ? 0.12 : 0));
    const A = {
      x: f.x, z: f.z, heading: f.h, speed: sp,
      moveAngle: wrapAngle(moveDir - f.h),
      accel, turnRate: turn,
      effort: clamp(Math.max(f.ws || 0, (sp - 3) / Math.max(1, (f.vTop || 9) - 3)), 0, 1),
      base: f.base,
      action: f.act ? { name: f.act.name, t: f.act.t, side: f.act.side, power: f.act.power } : null,
      carry: f.carry || null,
      look: f.look, reach: f.reach,
      engage: f.eng,
      dirt: rec.dirt,
    };
    rec.prev = { speed: sp, heading: f.h, accel, turnRate: turn, base: f.base };
    return A;
  }

  /**
   * Draw one frame. opts: { camera, users: { home: ent id|null, away: … },
   *   huddle: null | {…} (visual positions override), aim: null | { x, z, angle, show } }
   */
  draw(frame, dt, opts = {}) {
    if (!this.ready || !frame) return;
    this.time += dt;
    const seen = new Set();
    const cam = opts.camera;
    const over = opts.override || null;   // id → { x, z, h, base, speed, act } (huddle / walk-in)
    for (const f of frame.ents) {
      const rec = this.modelFor(f.id, f.side);
      seen.add(f.id);
      let fr = f;
      const ov = over?.get(f.id);
      if (ov) fr = { ...f, x: ov.x, z: ov.z, h: ov.h, vx: ov.vx ?? 0, vz: ov.vz ?? 0, base: ov.base ?? f.base, act: ov.act ?? null, carry: null, look: ov.look ?? null, reach: null, eng: null, ws: ov.ws ?? 0, y: 0 };
      const A = this.animState(rec, fr, dt);
      rec.model.group.visible = true;
      rec.model.update(dt, A);
      if (fr.y > 0.01) rec.model.group.position.y = fr.y;
      // level of detail by distance
      if (cam) {
        const d = cam.position.distanceTo(rec.model.group.position);
        const want = d > 48 ? 'low' : 'high';
        if (want !== rec.lod) { rec.lod = want; try { rec.model.setLod?.(want); } catch { /* */ } }
      }
    }
    for (const [id, rec] of this.models) if (!seen.has(id)) { rec.model.group.visible = false; rec.prev = null; }

    // officials
    if (frame.refs) {
      for (const r of frame.refs) {
        const rr = this.refModels.get(r.id);
        if (!rr) continue;
        const sp = Math.hypot(r.vx, r.vz);
        const A = {
          x: r.x, z: r.z, heading: r.h, speed: sp, moveAngle: wrapAngle((sp > 0.2 ? Math.atan2(r.vx, r.vz) : r.h) - r.h),
          accel: 0, turnRate: 0, effort: clamp(sp / 8, 0, 1), base: 'ref',
          action: r.act ? { ...r.act } : null, carry: null, look: r.look, reach: null, engage: null, dirt: 0,
        };
        rr.model.group.visible = opts.showRefs !== false;
        rr.model.update(dt, A);
      }
    }

    this.drawBall(frame, dt);
    this.drawRings(frame, opts);
    this.drawFlags(opts.flags || []);
    this.drawArrow(opts.aim);
  }

  drawBall(frame, dt) {
    const b = frame.ball;
    const g = this.ball.group;
    g.visible = b.st !== 'gone';
    let gy = 0;
    if (b.car) {
      const rec = this.models.get(b.car);
      if (rec?.model?.ballTransform && rec.model.group.visible) {
        rec.model.ballTransform(b.carry || 'two', tmpV, tmpQ);
        g.position.copy(tmpV);
        g.quaternion.copy(tmpQ);
      } else { g.position.set(b.x, b.y || 1, b.z); }
    } else if (b.tee || b.st === 'snap' || b.st === 'dead') {
      // on the ground at the spot, nose up the field (a kickoff stands on its tee)
      g.position.set(b.x, b.tee ? 0.2 : 0.1, b.z);
      g.quaternion.setFromAxisAngle(AX_X, b.tee ? -Math.PI / 2 * 0.85 : 0);
    } else {
      g.position.set(b.x, Math.max(0.09, b.y), b.z);
      const v = tmpV.set(b.vx, b.vy, b.vz);
      const sp = v.length();
      if ((b.kind === 'pass' || b.kind === 'punt') && sp > 2 && b.st === 'air') {
        // a spiral: nose along the flight path, spinning about it
        v.normalize();
        tmpQ.setFromUnitVectors(AX_Z, v);
        this.ballAngle += dt * (b.spin || 60);
        tmpQ2.setFromAxisAngle(AX_Z, this.ballAngle);
        g.quaternion.copy(tmpQ).multiply(tmpQ2);
      } else if (b.st === 'air' || b.st === 'loose') {
        // end over end (kicks, fumbles, laterals that wobble)
        const rate = b.st === 'loose' ? clamp(sp * 1.6, 0, 14) : (b.tumble || 6);
        this.ballAngle += dt * rate;
        const yaw = Math.atan2(b.vx, b.vz || 1e-6);
        tmpQ.setFromAxisAngle(AX_Y, yaw);
        tmpQ2.setFromAxisAngle(AX_X, this.ballAngle);
        g.quaternion.copy(tmpQ).multiply(tmpQ2);
      }
    }
    gy = g.position.y;
    this.ballShadow.visible = g.visible && gy > 0.12;
    this.ballShadow.position.set(g.position.x, 0.02, g.position.z);
    const s = clamp(1 - gy / 30, 0.35, 1);
    this.ballShadow.material.opacity = 0.35 * s;
  }

  drawRings(frame, opts) {
    const users = opts.users || {};
    let i = 0;
    for (const side of ['home', 'away']) {
      const id = users[side];
      const ring = this.rings[i];
      i++;
      if (!ring) continue;
      if (!id || opts.hideRings) { ring.visible = false; continue; }
      const f = frame.ents.find((e) => e.id === id);
      if (!f) { ring.visible = false; continue; }
      ring.visible = true;
      const rec = this.models.get(id);
      const p = rec?.model?.group?.position;
      ring.position.set(p ? p.x : f.x, 0.04, p ? p.z : f.z);
      ring.rotation.y = f.h;
      const pulse = 1 + Math.sin(this.time * 6) * 0.05;
      ring.scale.set(pulse, 1, pulse);
      ring.children[0].material.color.set(opts.ringColors?.[side] || (side === 'home' ? 0x46e8ff : 0xff9a2a));
    }
  }

  drawFlags(list) {
    while (this.flagProps.length < list.length) { const f = makeFlagProp(); this.scene.add(f); this.flagProps.push(f); }
    this.flagProps.forEach((p, i) => {
      const f = list[i];
      p.visible = !!f && f.t >= 0;
      if (!p.visible) return;
      p.position.set(f.x, Math.max(0.02, f.y), f.z);
      p.rotation.y = f.t * 9;
      p.rotation.z = f.landed ? 0 : Math.sin(f.t * 20) * 0.6;
    });
  }

  drawArrow(aim) {
    if (!aim || !aim.show) { this.arrow.visible = false; return; }
    this.arrow.visible = true;
    this.arrow.position.set(aim.x, 0, aim.z);
    this.arrow.rotation.y = aim.angle;
    const k = 0.8 + Math.sin(this.time * 5) * 0.08;
    this.arrow.scale.set(1, 1, aim.length ? aim.length / 8 * k : k);
  }

  headOf(id, out = new THREE.Vector3()) {
    const rec = this.models.get(id);
    if (!rec) return null;
    if (rec.model.headWorld) return rec.model.headWorld(out);
    return out.copy(rec.model.group.position).setY(1.9);
  }

  ballPos(out = new THREE.Vector3()) { return out.copy(this.ball.group.position); }

  dispose() {
    for (const rec of this.models.values()) { try { rec.model.dispose?.(); } catch { /* */ } }
    for (const rec of this.refModels.values()) { try { rec.model.dispose?.(); } catch { /* */ } }
    this.models.clear();
    try { this.venue?.dispose?.(); } catch { /* */ }
  }
}

export { tmpV2 };
