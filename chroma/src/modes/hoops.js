// HUE HOOPS: a glowing ball (the Glowball) and a hoop in front of each base.
// Touch the ball to grab it; the carrier can't use their weapon, and FIRE
// throws (hold to throw harder). Splat the carrier to make them drop it.
// Shots through the enemy hoop score 2, dunks (jumping at the rim while
// carrying) score 3. A hoop is shielded until the attackers have painted
// half of the pad around it. First to the target score wins, otherwise the
// higher score at time-up; a tie at time-up goes to sudden-death overtime.
// The host runs the rules and ball physics; clients predict their own
// grabs/throws and render the replicated ball smoothly.
import * as THREE from 'three';
import { InkSampler, glowTexture, netTexture, ballTexture, textSprite, beam, ballisticVel } from './modekit.js';
import { ModeHUD } from '../ui/modehud.js';
import { clamp, damp, hexToCss, rand, chance, pick } from '../util.js';
import { v3a } from '../actors/weapons.js';

export const BALL_R = 0.3;
export const BALL_G = 17;
export const RIM_H = 3.0;
export const RIM_R = 0.72;
const TUBE = 0.05;
const BOARD_OFF = 0.62, BOARD_W = 2.1, BOARD_H = 1.3, BOARD_T = 0.1, BOARD_Y0 = -0.35;
const SHIELD_R = 1.75;
export const HOOP_OPEN = 0.4;  // attackers' share of the pad that opens the hoop
const HOOP_CLOSE = 0.28;       // ...and below this it closes again
const RESET_T = 3.0;
const HOLD_MAX = 15;
const OT_MAX = 60;
const ST = { reset: 0, free: 1, held: 2 };
const ST_NAME = ['reset', 'free', 'held'];
const GOLD = new THREE.Color(0xffd21a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ------------------------------------------------------------------ shaders
const SHIELD_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const SHIELD_FS = `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uFlash;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main() {
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  vec2 g = vUv * vec2(26.0, 13.0);
  g.x += 0.5 * mod(floor(g.y), 2.0);
  vec2 f = abs(fract(g) - 0.5);
  float line = smoothstep(0.41, 0.49, max(f.x, f.y * 1.15));
  float scan = smoothstep(0.85, 1.0, sin(vUv.y * 30.0 - uTime * 4.0));
  float a = (0.07 + fr * 0.75 + line * 0.32 + scan * 0.12 + uFlash * 0.8) * uOpacity;
  gl_FragColor = vec4(uColor * a * 1.6, a);
}`;
const RING_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FS = `uniform vec3 uDef; uniform vec3 uAtt; uniform float uProg; uniform float uNeed; uniform float uTime; uniform float uOpen;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float ang = fract(atan(p.x, p.y) / 6.2831853 + 1.0);
  float r = length(p) * 2.0;
  float fill = step(ang, uProg);
  vec3 col = mix(uDef * 0.55, uAtt * 1.4, fill);
  float tick = 1.0 - smoothstep(0.0, 0.006, abs(ang - uNeed));
  col = mix(col, vec3(2.0), tick);
  float edge = smoothstep(0.93, 1.0, r) + (1.0 - smoothstep(0.0, 0.08, r - 0.86));
  col += edge * 0.35;
  float pulse = uOpen * (0.5 + 0.5 * sin(uTime * 6.0));
  col = mix(col, uAtt * 2.2, pulse * 0.45);
  gl_FragColor = vec4(col, 0.88);
}`;

export class HoopsRules {
  constructor(battle) {
    this.b = battle;
    this.kind = 'hoops';
    this.name = 'HUE HOOPS';
  }

  get client() { return this.b.net?.role === 'client'; }

  init() {
    const b = this.b, st = b.stage, def = st.def.modes || {};
    const time = b.timeLeft || 180;
    this.target = Math.max(4, Math.round(12 * Math.min(1, time / 180)));
    const hd = def.hoop || { x: 0, z: st.spawns[1][0].z * 0.62, y: 0, r: 3.8 };
    this.hoops = {};
    for (const team of [1, 2]) {
      const s = team === 1 ? 1 : -1;
      const base = new THREE.Vector3(hd.x * s, hd.y, hd.z * s);
      const dir = team === 1 ? 1 : -1; // the rim faces the middle of the map
      const r = hd.r;
      const sampler = new InkSampler(st.paint, st.level, { x0: base.x - r, z0: base.z - r, x1: base.x + r, z1: base.z + r },
        (x, y, z) => (x - base.x) ** 2 + (z - base.z) ** 2 <= r * r && Math.abs(y - base.y) < 0.35);
      this.hoops[team] = {
        team, base, dir, r, sampler,
        rim: new THREE.Vector3(base.x, base.y + RIM_H, base.z),
        boardZ: base.z - dir * (BOARD_OFF + BOARD_T / 2),
        shieldC: new THREE.Vector3(base.x, base.y + RIM_H + 0.15, base.z - dir * 0.15),
        prog: 0, open: false, lockT: 0, flashT: 0, swishT: 0, blockT: 0,
      };
    }
    const tip = def.tip || [-3, st.level.heightAt(-3, -1).y, -1];
    this.tips = { 1: new THREE.Vector3(tip[0], tip[1], tip[2]), 2: new THREE.Vector3(-tip[0], tip[1], -tip[2]) };
    const top = st.level.heightAt(0, 0).y;
    this.hover = new THREE.Vector3(0, (Number.isFinite(top) ? top : 0) + 1.5, 0);
    this.ball = { st: ST.reset, pos: this.hover.clone(), vel: new THREE.Vector3(), carrier: null, holdT: 0, resetT: 1.4, thrower: null, throwT: -9, restT: 0, spin: 0 };
    this.tipSide = Math.random() < 0.5 ? 1 : 2;
    this.score = { 1: 0, 2: 0 };
    this.noGrab = new Map();
    this.time = 0;
    this.measureT = 0;
    this.ot = false; this.otT = 0;
    this.finished = false; this.winner = 0; this.byTarget = false;
    this.charge = 0; this.armed = false;
    this.pred = null;
    this.reqT = 0; this.dunkReqT = 0; this.bumpT = 0;
    this.render = new THREE.Vector3().copy(this.hover);
    this.stats = { grabs: 0, throws: 0, scores: 0, dunks: 0, drops: 0, tips: 0, blocks: 0, opens: 0 };
    this.cssColors = { 1: hexToCss(b.colors[1]), 2: hexToCss(b.colors[2]) };
    this.buildVisuals();
    this.hud = new ModeHUD(b.hudRoot, 'hoops', b.player.team);
  }

  // ---------------------------------------------------------------- visuals
  buildVisuals() {
    const scene = this.b.scene, colors = this.b.colors;
    this.group = new THREE.Group();
    this.group.name = 'hoops';
    scene.add(this.group);
    const std = (c, ro = 0.5, me = 0.3, ex = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me, ...ex });
    const metal = std(0x2d3040, 0.45, 0.6);
    for (const team of [1, 2]) {
      const h = this.hoops[team], att = 3 - team;
      const g = new THREE.Group();
      g.position.copy(h.base);
      g.rotation.y = h.dir > 0 ? 0 : Math.PI;
      this.group.add(g);
      h.group = g;
      const postZ = -BOARD_OFF - 0.7;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, RIM_H + 1.1, 0.26), metal);
      post.position.set(0, (RIM_H + 1.1) / 2, postZ); post.castShadow = true; g.add(post);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), std(colors[team], 0.4, 0.1, { emissive: colors[team], emissiveIntensity: 0.6 }));
      stripe.position.set(0, 1.0, postZ); g.add(stripe);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.2, 18), metal);
      plate.position.set(0, 0.1, postZ); g.add(plate);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.75), metal);
      arm.position.set(0, RIM_H + 0.6, -BOARD_OFF - 0.36); g.add(arm);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.95), metal);
      brace.position.set(0, RIM_H + 0.2, -BOARD_OFF - 0.4); brace.rotation.x = -0.75; g.add(brace);
      // backboard: white with a team frame
      const boardTex = this.boardTexture(hexToCss(colors[team]));
      const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, BOARD_H, BOARD_T), [metal, metal, metal, metal,
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.25, metalness: 0.05, emissive: 0xffffff, emissiveMap: boardTex, emissiveIntensity: 0.35 }), metal]);
      board.position.set(0, RIM_H + BOARD_Y0 + BOARD_H / 2, -BOARD_OFF - BOARD_T / 2); board.castShadow = true; g.add(board);
      // rim + bracket
      h.rimMat = new THREE.MeshStandardMaterial({ color: 0xff7a1f, emissive: 0xff7a1f, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.5 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, TUBE, 8, 40), h.rimMat);
      rim.rotation.x = Math.PI / 2; rim.position.set(0, RIM_H, 0); g.add(rim);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, BOARD_OFF - RIM_R + 0.06), h.rimMat);
      bracket.position.set(0, RIM_H, -BOARD_OFF + (BOARD_OFF - RIM_R) / 2); g.add(bracket);
      // net
      const nt = netTexture().clone(); nt.userData.shared = false; nt.repeat.set(7, 2); nt.needsUpdate = true;
      h.net = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R * 0.97, RIM_R * 0.55, 0.8, 18, 1, true),
        new THREE.MeshBasicMaterial({ map: nt, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, color: 0xf4f0ff, toneMapped: false }));
      h.net.geometry.translate(0, -0.4, 0);
      h.net.position.set(0, RIM_H, 0); g.add(h.net);
      // shield bubble
      h.shieldMat = new THREE.ShaderMaterial({
        vertexShader: SHIELD_VS, fragmentShader: SHIELD_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(colors[team]) }, uOpacity: { value: 1 }, uTime: { value: 0 }, uFlash: { value: 0 } },
      });
      h.shield = new THREE.Mesh(new THREE.SphereGeometry(SHIELD_R, 32, 18), h.shieldMat);
      h.shield.position.set(0, RIM_H + 0.15, -0.15); h.shield.renderOrder = 4; g.add(h.shield);
      // pad ring (shows how much of the pad the attackers have painted)
      h.ringMat = new THREE.ShaderMaterial({
        vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
        uniforms: { uDef: { value: new THREE.Color(colors[team]) }, uAtt: { value: new THREE.Color(colors[att]) }, uProg: { value: 0 }, uNeed: { value: HOOP_OPEN }, uTime: { value: 0 }, uOpen: { value: 0 } },
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(h.r - 0.3, h.r, 96, 1), h.ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.renderOrder = 2; g.add(ring);
      h.discMat = new THREE.MeshBasicMaterial({ color: colors[team], transparent: true, opacity: 0.07, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(h.r - 0.3, 64), h.discMat);
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03; disc.renderOrder = 1; g.add(disc);
      // status sign + beam when open
      h.sign = textSprite('SHIELDED', { scale: [2.7, 0.68] });
      h.sign.position.set(0, RIM_H + BOARD_Y0 + BOARD_H + 0.75, -BOARD_OFF); g.add(h.sign);
      h.beam = beam(0.35, 24, 0.55);
      h.beam.material.color.set(colors[att]);
      h.beam.position.set(0, RIM_H + 0.1, 0);
      h.beam.visible = false; g.add(h.beam);
    }
    // the Glowball
    const bt = ballTexture();
    this.ballMat = new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, color: 0xffffff, emissive: GOLD.clone(), emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.1 });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), this.ballMat);
    this.ballMesh.castShadow = true;
    this.group.add(this.ballMesh);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: GOLD.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.halo.scale.setScalar(2.2);
    this.halo.renderOrder = 4;
    this.group.add(this.halo);
    this.ballBeam = beam(0.16, 30, 0.6);
    this.ballBeam.material.color.copy(GOLD);
    this.group.add(this.ballBeam);
    this.ballCol = GOLD.clone();
    // throw preview dots (local carrier only)
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), 28);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 5;
    this.group.add(this.dots);
  }

  boardTexture(team) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#f7f4ff'; x.fillRect(0, 0, 256, 160);
    x.strokeStyle = team; x.lineWidth = 14; x.strokeRect(7, 7, 242, 146);
    x.lineWidth = 9; x.strokeRect(88, 70, 80, 60);
    x.fillStyle = team; x.globalAlpha = 0.18; x.fillRect(88, 70, 80, 60);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---------------------------------------------------------------- helpers
  carryPos(f, out) {
    const goo = f.form === 'goo';
    const bob = Math.sin(this.time * 6) * 0.05;
    return out.set(f.pos.x, f.pos.y + (goo ? (f.submerged ? 0.6 : 0.85) : 2.02) + bob, f.pos.z);
  }

  ballWorld(out) {
    const ball = this.ball;
    if (ball.st === ST.held && ball.carrier) return this.carryPos(ball.carrier, out);
    return out.copy(ball.pos);
  }

  canGrab(f) {
    const ball = this.ball;
    if (!f.alive || ball.st !== ST.free || f.jetT > 0 || f.nova) return false;
    const until = this.noGrab.get(f);
    if (until && this.time < until) return false;
    return this.touching(f, ball.pos, 0);
  }

  touching(f, p, slack) {
    const dx = p.x - f.pos.x, dz = p.z - f.pos.z;
    const r = (f.form === 'goo' ? 0.85 : 0.95) + slack;
    if (dx * dx + dz * dz > r * r) return false;
    const dy = p.y - f.pos.y;
    return dy > -0.35 - slack && dy < (f.form === 'goo' ? 1.15 : 2.35) + slack;
  }

  // throw velocity for a human carrier (aim with the camera; power 0..1)
  throwVel(f, power, origin, out) {
    const I = f.intent;
    if (I.aimPoint && I.aimPoint.distanceToSquared(origin) > 1.5) out.subVectors(I.aimPoint, origin).normalize();
    else { const cp = Math.cos(f.aimPitch); out.set(Math.sin(f.aimYaw) * cp, Math.sin(f.aimPitch), Math.cos(f.aimYaw) * cp); }
    const speed = 8 + 11 * power;
    out.multiplyScalar(speed);
    out.y += 2.6 + 1.8 * power;
    return out;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const b = this.b, ball = this.ball;
    this.time += dt;
    const playing = b.state === 'play';
    for (const t of [1, 2]) { const h = this.hoops[t]; h.lockT = Math.max(0, h.lockT - dt); }
    if (!this.client) {
      this.measureT -= dt;
      if (this.measureT <= 0) { this.measureT = 0.15; this.measurePads(); }
      if (playing && !this.finished) {
        this.hostStep(dt);
        if (this.ot) { this.otT += dt; if (this.otT > OT_MAX) this.finished = true; }
      } else if (ball.st === ST.free) this.stepBall(dt, true);
    } else this.clientStep(dt, playing);
    this.localCarrier(dt, playing);
    this.updateVisuals(dt);
    this.updateHUD();
  }

  measurePads() {
    for (const t of [1, 2]) {
      const h = this.hoops[t], att = 3 - t;
      h.sampler.measure();
      h.prog = h.sampler.of(att);
      if (h.lockT > 0) { if (h.open) this.setOpen(h, false); continue; }
      if (!h.open && h.prog >= HOOP_OPEN) this.setOpen(h, true);
      else if (h.open && h.prog < HOOP_CLOSE) this.setOpen(h, false);
    }
  }

  setOpen(h, open) {
    h.open = open;
    if (open) this.stats.opens++;
    this.b.net?.emit?.({ e: 'md', k: open ? 'open' : 'close', h: h.team });
    this.fxOpen(h, open);
  }

  hostStep(dt) {
    const b = this.b, ball = this.ball, w = b.world;
    if (ball.st === ST.reset) {
      ball.pos.copy(this.hover);
      ball.resetT -= dt;
      if (ball.resetT <= 0) this.tipOff();
      return;
    }
    if (ball.st === ST.held) {
      const f = ball.carrier;
      ball.holdT += dt;
      if (!f || !f.alive) { this.drop(f, false); return; }
      this.carryPos(f, ball.pos);
      ball.vel.set(f.vel.x, f.vel.y, f.vel.z);
      if (f.pos.y < w.level.killY + 0.3) { this.resetBall(0); return; }
      this.checkDunk(f);
      if (ball.st === ST.held && ball.holdT > HOLD_MAX) {
        this.b.net?.emit?.({ e: 'md', k: 'clock', f: f.netId });
        this.fxClock(f);
        this.drop(f, true);
      }
      return;
    }
    // free ball
    this.stepBall(dt, true);
    if (ball.st !== ST.free) return;
    // grabs (closest fighter touching it wins)
    let best = null, bd = Infinity;
    for (const f of w.fighters) {
      if (!this.canGrab(f)) continue;
      const d = f.pos.distanceToSquared(ball.pos);
      if (d < bd) { bd = d; best = f; }
    }
    if (best) { this.give(best); return; }
    const sp = ball.vel.lengthSq();
    ball.restT = sp < 0.2 ? ball.restT + dt : 0;
    if (ball.restT > 12) this.resetBall(0);
  }

  // ---------------------------------------------------------------- ball physics (host + client prediction)
  stepBall(dt, host) {
    const ball = this.ball, lvl = this.b.world.level;
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    const h = dt / n;
    for (let i = 0; i < n && ball.st === ST.free; i++) {
      const p = ball.pos, v = ball.vel;
      const prevY = p.y, px = p.x, pz = p.z;
      v.y -= BALL_G * h;
      const len = v.length() * h;
      if (len > 1e-6) {
        _d.copy(v).divideScalar(v.length());
        const hit = lvl.raycast(p, _d, len + BALL_R);
        if (hit) {
          p.addScaledVector(_d, Math.max(0, hit.t - BALL_R - 0.002));
          this.bounce(v, hit.normal, 0.6, 0.85, host);
        } else p.addScaledVector(_d, len);
      }
      // resting / rolling on the floor
      const down = lvl.raycast(_w.set(p.x, p.y + 0.05, p.z), _down, BALL_R + 0.1);
      if (down && v.y <= 0.01 && down.t - 0.05 <= BALL_R + 0.01) {
        p.y = down.point.y + BALL_R;
        if (v.y < -1.6) this.bounce(v, down.normal, 0.58, 0.9, host);
        else {
          v.y = 0;
          const k = Math.exp(-1.4 * h);
          v.x *= k; v.z *= k;
          const nn = down.normal;
          if (nn.y < 0.995) { v.x += BALL_G * nn.y * nn.x * h; v.z += BALL_G * nn.y * nn.z * h; }
        }
      }
      // hoops: rim, backboard, shield, scoring
      for (const t of [1, 2]) this.hoopCollide(this.hoops[t], prevY, px, pz, host);
      if (p.y < lvl.killY - 1) { if (host) this.resetBall(0); else { v.set(0, 0, 0); } return; }
    }
    ball.spin += ball.vel.length() * dt * 2.2;
  }

  bounce(v, nrm, e, fr, host) {
    const vn = v.dot(nrm);
    if (vn >= 0) return;
    const speed = -vn;
    _n.copy(nrm).multiplyScalar(vn);
    v.sub(_n).multiplyScalar(fr).addScaledVector(nrm, -vn * e);
    if (speed > 2.5 && this.time - (this.lastBounceT || 0) > 0.12) {
      this.lastBounceT = this.time;
      const p = this.ball.pos;
      this.b.app.audio?.sfx('ball_bounce', { x: p.x, y: p.y, z: p.z, volume: Math.min(1, 0.25 + speed * 0.06) });
    }
    void host;
  }

  hoopCollide(h, prevY, px, pz, host) {
    const ball = this.ball, p = ball.pos, v = ball.vel;
    const dxr = p.x - h.rim.x, dzr = p.z - h.rim.z;
    const hd2 = dxr * dxr + dzr * dzr;
    if (hd2 > 25 || Math.abs(p.y - h.rim.y) > 4) return;
    // shield bubble (only blocks from the outside)
    if (!h.open) {
      _v.subVectors(p, h.shieldC);
      const d = _v.length(), R = SHIELD_R + BALL_R;
      if (d < R && d > SHIELD_R - 0.6) {
        _v.divideScalar(d || 1);
        if (v.dot(_v) < 0) {
          p.copy(h.shieldC).addScaledVector(_v, R + 0.01);
          this.bounce(v, _v, 0.75, 0.9, host);
          v.addScaledVector(_v, 1.5);
          if (host && this.time - h.blockT > 0.3) {
            h.blockT = this.time;
            this.stats.blocks++;
            this.b.net?.emit?.({ e: 'md', k: 'blk', h: h.team });
            this.fxBlock(h);
          }
        }
        return;
      }
    }
    // scoring: the ball centre drops through the rim
    if (prevY >= h.rim.y && p.y < h.rim.y && h.open) {
      const t = (prevY - h.rim.y) / Math.max(1e-6, prevY - p.y);
      const cx = px + (p.x - px) * t - h.rim.x, cz = pz + (p.z - pz) * t - h.rim.z;
      if (cx * cx + cz * cz < (RIM_R - 0.06) ** 2) {
        const att = 3 - h.team;
        const th = ball.thrower;
        if (host && th && th.team === att) { this.scored(att, 2, th, false); return; }
        h.swishT = 0.5;
      }
    }
    // rim tube (closest point on the ring)
    const hd = Math.sqrt(hd2);
    if (hd > 1e-4) {
      _q.set(h.rim.x + dxr / hd * RIM_R, h.rim.y, h.rim.z + dzr / hd * RIM_R);
      _v.subVectors(p, _q);
      const d = _v.length();
      if (d < BALL_R + TUBE && d > 1e-5) {
        _v.divideScalar(d);
        p.copy(_q).addScaledVector(_v, BALL_R + TUBE + 0.002);
        if (v.dot(_v) < -1.5 && this.time - (this.rimT || 0) > 0.15) { this.rimT = this.time; this.b.app.audio?.sfx('rim_clang', { x: p.x, y: p.y, z: p.z, volume: 0.8 }); }
        this.bounce(v, _v, 0.55, 0.9, false);
      }
    }
    // backboard (axis-aligned box)
    const bx0 = h.rim.x - BOARD_W / 2, bx1 = h.rim.x + BOARD_W / 2;
    const by0 = h.rim.y + BOARD_Y0, by1 = by0 + BOARD_H;
    const bz0 = h.boardZ - BOARD_T / 2, bz1 = h.boardZ + BOARD_T / 2;
    _q.set(clamp(p.x, bx0, bx1), clamp(p.y, by0, by1), clamp(p.z, bz0, bz1));
    _v.subVectors(p, _q);
    const d = _v.length();
    if (d < BALL_R) {
      if (d < 1e-5) _v.set(0, 0, h.dir); else _v.divideScalar(d);
      p.copy(_q).addScaledVector(_v, BALL_R + 0.002);
      this.bounce(v, _v, 0.62, 0.9, host);
    }
  }

  // ---------------------------------------------------------------- state changes (host)
  give(f) {
    const ball = this.ball;
    ball.st = ST.held; ball.carrier = f; ball.holdT = 0; ball.restT = 0;
    f.canFight = false;
    f.cancelWeapon?.();
    if (f === this.b.player) { this.armed = false; this.charge = 0; }
    this.stats.grabs++;
    this.b.net?.emit?.({ e: 'md', k: 'grab', f: f.netId });
    this.fxGrab(f);
  }

  release(f) { if (f) f.canFight = true; if (f === this.b.player) this.charge = 0; }

  doThrow(f, p, v) {
    const ball = this.ball;
    ball.st = ST.free; ball.carrier = null;
    ball.pos.copy(p); ball.vel.copy(v);
    ball.thrower = f; ball.throwT = this.time; ball.restT = 0;
    this.noGrab.set(f, this.time + 0.45);
    this.release(f);
    this.stats.throws++;
    this.b.net?.emit?.({ e: 'md', k: 'thr', f: f.netId, p: v3a(p), v: v3a(v) }, this.b.net.fromPeer);
    this.fxThrow(f, p);
  }

  // anyone (bot, host player, client player) throwing: route through the network when needed
  throwBall(f, p, v) {
    if (this.client) {
      if (f !== this.b.player) return;
      const ball = this.ball;
      ball.st = ST.free; ball.carrier = null; ball.pos.copy(p); ball.vel.copy(v); ball.thrower = f;
      this.render.copy(p);
      this.release(f);
      this.noGrab.set(f, this.time + 0.45);
      this.pred = { k: 'thr', until: this.time + 0.7 };
      this.stats.throws++;
      this.b.net.action({ m: 'md', k: 'thr', p: v3a(p), v: v3a(v) }, f);
      this.fxThrow(f, p);
      return;
    }
    if (this.ball.carrier === f) this.doThrow(f, p, v);
  }

  drop(f, pop) {
    const ball = this.ball;
    const at = f ? _v.set(f.pos.x, f.pos.y + 1.2, f.pos.z) : ball.pos;
    ball.st = ST.free; ball.carrier = null; ball.thrower = null; ball.restT = 0;
    ball.pos.copy(at);
    ball.vel.set(rand(-1.6, 1.6), pop ? 6.5 : 4.5, rand(-1.6, 1.6));
    if (f) { this.noGrab.set(f, this.time + 1.0); this.release(f); }
    this.stats.drops++;
    this.b.net?.emit?.({ e: 'md', k: 'drop', f: f ? f.netId : -1 });
    this.fxDrop(f);
  }

  resetBall(side) {
    const ball = this.ball;
    if (ball.carrier) this.release(ball.carrier);
    ball.st = ST.reset; ball.carrier = null; ball.thrower = null;
    ball.resetT = RESET_T; ball.pos.copy(this.hover); ball.vel.set(0, 0, 0);
    if (side) this.tipSide = side;
    this.b.net?.emit?.({ e: 'md', k: 'rst' });
  }

  tipOff() {
    const ball = this.ball;
    const land = this.tips[this.tipSide] || this.tips[1];
    _w.copy(land).setY(land.y + BALL_R);
    const T = 1.15;
    ballisticVel(this.hover, _w, T, BALL_G, ball.vel);
    ball.pos.copy(this.hover);
    ball.st = ST.free; ball.thrower = null; ball.restT = 0;
    this.tipSide = Math.random() < 0.5 ? 1 : 2; // next neutral tip
    this.stats.tips++;
    this.b.net?.emit?.({ e: 'md', k: 'tip', p: v3a(ball.pos), v: v3a(ball.vel) });
    this.fxTip();
  }

  checkDunk(f) {
    if (f.onGround || f.climbing) return;
    const h = this.hoops[3 - f.team];
    const dx = f.pos.x - h.rim.x, dz = f.pos.z - h.rim.z;
    if (dx * dx + dz * dz > 1.5 * 1.5) return;
    if (f.pos.y + 2.05 < h.rim.y || f.pos.y > h.rim.y + 0.4) return;
    if (h.open) this.scored(f.team, 3, f, true);
    else this.bump(f, h);
  }

  bump(f, h) {
    const until = this.bumpMap?.get(f) || 0;
    if (this.time < until) return;
    (this.bumpMap ||= new Map()).set(f, this.time + 0.8);
    if (f.puppet === 'host') this.b.net?.to?.(f.peer, { e: 'md', k: 'bump', h: h.team });
    else this.applyBump(f, h);
    this.b.net?.emit?.({ e: 'md', k: 'blk', h: h.team });
    this.fxBlock(h);
  }

  applyBump(f, h) {
    let nx = f.pos.x - h.rim.x, nz = f.pos.z - h.rim.z;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    if (l < 0.05) { nx = 0; nz = h.dir; }
    f.vel.x = nx * 7; f.vel.z = nz * 7; f.vel.y = Math.min(f.vel.y, 2);
    if (f === this.b.player) this.b.hud.showBanner('SHIELDED!', 'Paint the pad around the hoop to open it', 'mmid', 1.6);
  }

  scored(team, pts, f, dunk) {
    const h = this.hoops[3 - team];
    this.score[team] += pts;
    this.stats.scores++;
    if (dunk) this.stats.dunks++;
    if (f?.stats) f.stats.hoopPts = (f.stats.hoopPts || 0) + pts;
    // the pad recharges: a burst of defender ink re-shields the hoop
    const def = h.team, paint = this.b.stage.paint;
    paint.splat(_v.copy(h.base).setY(h.base.y + 0.05), h.r * 0.42, def, { phase: 3.1, wobble: 0.18 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.4;
      paint.splat(_v.set(h.base.x + Math.cos(a) * h.r * 0.62, h.base.y + 0.05, h.base.z + Math.sin(a) * h.r * 0.62), h.r * 0.34, def, { phase: 1.3 + i, wobble: 0.2 });
    }
    h.lockT = 3.5;
    if (h.open) this.setOpen(h, false);
    this.release(this.ball.carrier);
    this.ball.carrier = null;
    this.b.net?.emit?.({ e: 'md', k: 'sc', t: team, n: pts, f: f ? f.netId : -1, d: dunk ? 1 : 0, a: this.score[1], b: this.score[2] });
    this.fxScore(team, pts, f, dunk);
    this.resetBall(def); // the team that conceded gets the tip on its side
    if (this.score[team] >= this.target) { this.finished = true; this.winner = team; this.byTarget = true; }
    else if (this.ot) { this.finished = true; this.winner = team; }
  }

  // ---------------------------------------------------------------- local player (host or client)
  localCarrier(dt, playing) {
    const b = this.b, p = b.player, ball = this.ball;
    const mine = ball.st === ST.held && ball.carrier === p && p.alive;
    if (this.client) p.canFight = !mine;
    if (!mine || !playing) { this.charge = 0; this.dots.count = 0; if (!mine) this.armed = false; return; }
    if (this.client) this.checkDunkLocal(p);
    if (b.autoplay) { this.dots.count = 0; return; }
    const I = p.intent;
    if (!this.armed) { this.armed = !I.fire; this.charge = 0; }
    else if (I.fire) this.charge = Math.min(1, this.charge + dt / 0.9);
    else if (this.charge > 0) {
      const power = this.charge;
      this.charge = 0;
      const o = this.carryPos(p, new THREE.Vector3());
      const v = this.throwVel(p, power, o, new THREE.Vector3());
      this.throwBall(p, o, v);
      this.dots.count = 0;
      return;
    }
    this.preview(p);
  }

  // dotted arc of where a throw would go right now
  preview(p) {
    const o = this.carryPos(p, _q.clone());
    const v = this.throwVel(p, Math.max(this.charge, 0.35), o, _n.clone());
    const lvl = this.b.world.level, m4 = new THREE.Matrix4();
    let n = 0;
    const a = o.clone(), c = new THREE.Vector3();
    for (let i = 1; i <= 28; i++) {
      const t = i * 0.055;
      c.set(o.x + v.x * t, o.y + v.y * t - 0.5 * BALL_G * t * t, o.z + v.z * t);
      _d.subVectors(c, a);
      const l = _d.length();
      if (l > 1e-4 && lvl.raycast(a, _d.divideScalar(l), l)) break;
      const s = 1 - i / 40;
      m4.makeScale(s, s, s).setPosition(c);
      this.dots.setMatrixAt(n++, m4);
      a.copy(c);
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.material.color.copy(this.b.colors[p.team]).multiplyScalar(1.6);
  }

  checkDunkLocal(f) {
    if (f.onGround || f.climbing || this.time < this.dunkReqT) return;
    const h = this.hoops[3 - f.team];
    const dx = f.pos.x - h.rim.x, dz = f.pos.z - h.rim.z;
    if (dx * dx + dz * dz > 1.5 * 1.5 || f.pos.y + 2.05 < h.rim.y || f.pos.y > h.rim.y + 0.4) return;
    this.dunkReqT = this.time + 0.6;
    if (h.open) this.b.net.action({ m: 'md', k: 'dunk', h: h.team, p: v3a(f.pos) }, f);
    else { this.applyBump(f, h); this.fxBlock(h); }
  }

  // ---------------------------------------------------------------- client side
  clientStep(dt, playing) {
    const b = this.b, ball = this.ball, p = b.player;
    if (this.pred && this.time > this.pred.until) this.pred = null;
    if (ball.st === ST.free) this.stepBall(dt, false);
    else if (ball.st === ST.reset) ball.pos.copy(this.hover);
    // ask the host for the ball when we touch it (and show it in our hands right away)
    if (playing && ball.st === ST.free && p.alive && !this.pred && this.time > this.reqT && !(this.noGrab.get(p) > this.time) && p.jetT <= 0) {
      if (this.touching(p, this.render, 0.1)) {
        this.reqT = this.time + 0.3;
        this.b.net.action({ m: 'md', k: 'grab' }, p);
        ball.st = ST.held; ball.carrier = p; ball.holdT = 0;
        this.armed = false;
        this.pred = { k: 'grab', until: this.time + 0.5 };
        this.fxGrab(p);
      }
    }
    if (ball.st === ST.held) ball.holdT += dt;
  }

  netPack() {
    const ball = this.ball, r = (x) => Math.round(x * 100);
    const h1 = this.hoops[1], h2 = this.hoops[2];
    return [ball.st, ball.carrier ? ball.carrier.netId : -1, r(ball.pos.x), r(ball.pos.y), r(ball.pos.z), r(ball.vel.x), r(ball.vel.y), r(ball.vel.z),
      this.score[1], this.score[2], Math.round(h1.prog * 1000), Math.round(h2.prog * 1000),
      (h1.open ? 1 : 0) | (h2.open ? 2 : 0) | (this.ot ? 4 : 0) | (this.finished ? 8 : 0), Math.round(ball.resetT * 10), Math.round(ball.holdT * 10), ball.thrower ? ball.thrower.netId : -1];
  }

  netApply(m) {
    if (!Array.isArray(m)) return;
    const ball = this.ball, w = this.b.world, me = this.b.player;
    this.score[1] = m[8]; this.score[2] = m[9];
    const h1 = this.hoops[1], h2 = this.hoops[2];
    h1.prog = m[10] / 1000; h2.prog = m[11] / 1000;
    h1.open = !!(m[12] & 1); h2.open = !!(m[12] & 2);
    this.ot = !!(m[12] & 4); this.finished = !!(m[12] & 8);
    const st = m[0], carrier = m[1] >= 0 ? w.fighters[m[1]] : null;
    // our own prediction wins until the host has caught up
    if (this.pred) {
      if (this.pred.k === 'thr' && st === ST.held && carrier === me) return;
      if (this.pred.k === 'grab' && st === ST.free) return;
      this.pred = null;
    }
    const wasHeld = ball.st === ST.held ? ball.carrier : null;
    ball.st = st; ball.carrier = st === ST.held ? carrier : null;
    ball.resetT = m[13] / 10; ball.holdT = m[14] / 10;
    ball.thrower = m[15] >= 0 ? w.fighters[m[15]] : null;
    if (st === ST.free) {
      ball.pos.set(m[2] / 100, m[3] / 100, m[4] / 100);
      ball.vel.set(m[5] / 100, m[6] / 100, m[7] / 100);
      // the snapshot is a little old: run it forward
      this.stepBall(0.05, false);
    } else if (st === ST.reset) ball.pos.copy(this.hover);
    if (wasHeld === me && ball.carrier !== me) { this.charge = 0; me.canFight = true; }
  }

  event(e) {
    const w = this.b.world, me = this.b.player, ball = this.ball;
    const f = e.f >= 0 ? w.fighters[e.f] : null;
    switch (e.k) {
      case 'grab': if (f !== me) { this.stats.grabs++; this.fxGrab(f); } break;
      case 'thr':
        if (f === me) break;
        this.stats.throws++;
        ball.st = ST.free; ball.carrier = null; ball.thrower = f;
        ball.pos.copy(V(e.p)); ball.vel.copy(V(e.v));
        this.render.copy(ball.pos);
        this.fxThrow(f, ball.pos);
        break;
      case 'drop': this.stats.drops++; this.fxDrop(f); break;
      case 'tip':
        this.stats.tips++;
        ball.st = ST.free; ball.carrier = null; ball.thrower = null;
        ball.pos.copy(V(e.p)); ball.vel.copy(V(e.v));
        this.render.copy(ball.pos);
        this.fxTip();
        break;
      case 'rst': ball.st = ST.reset; ball.carrier = null; ball.resetT = RESET_T; break;
      case 'sc':
        this.stats.scores++; if (e.d) this.stats.dunks++;
        if (e.a != null) { this.score[1] = e.a; this.score[2] = e.b; }
        if (ball.carrier === me) me.canFight = true;
        ball.st = ST.reset; ball.carrier = null; this.pred = null;
        this.fxScore(e.t, e.n, f, !!e.d);
        break;
      case 'open': case 'close': { const h = this.hoops[e.h]; if (h) { h.open = e.k === 'open'; if (h.open) this.stats.opens++; this.fxOpen(h, h.open); } break; }
      case 'blk': { const h = this.hoops[e.h]; if (h) this.fxBlock(h); break; }
      case 'bump': { const h = this.hoops[e.h]; if (h) this.applyBump(me, h); break; }
      case 'clock': this.fxClock(f); break;
      case 'ot': this.ot = true; this.fxOvertime(); break;
    }
  }

  // host: requests from a remote player
  action(f, a) {
    const ball = this.ball;
    if (this.b.state !== 'play' || this.finished) return;
    if (a.k === 'grab') {
      if (ball.st !== ST.free || !f.alive || (this.noGrab.get(f) || 0) > this.time) return;
      if (this.touching(f, ball.pos, 1.8)) this.give(f);
    } else if (a.k === 'thr') {
      if (ball.st !== ST.held || ball.carrier !== f || !Array.isArray(a.p) || !Array.isArray(a.v)) return;
      const p = V(a.p), v = V(a.v);
      if (![...a.p, ...a.v].every(Number.isFinite) || p.distanceTo(f.pos) > 4) p.copy(this.carryPos(f, _v));
      if (v.length() > 24) v.setLength(24);
      this.doThrow(f, p, v);
    } else if (a.k === 'dunk') {
      if (ball.st !== ST.held || ball.carrier !== f || !Array.isArray(a.p)) return;
      const h = this.hoops[3 - f.team];
      const p = V(a.p);
      if (!h.open || !p.toArray().every(Number.isFinite)) return;
      const dx = p.x - h.rim.x, dz = p.z - h.rim.z;
      if (dx * dx + dz * dz < 2.0 * 2.0 && p.y + 2.05 >= h.rim.y - 0.3 && p.distanceTo(f.pos) < 3.5) this.scored(f.team, 3, f, true);
    }
  }

  onSplat(victim, attacker, kind) {
    if (this.client) { if (victim === this.b.player && this.ball.carrier === victim) victim.canFight = true; return; }
    if (this.ball.st === ST.held && this.ball.carrier === victim) {
      if (kind === 'fall') this.resetBall(0);
      else this.drop(victim, false);
    }
  }

  holdOvertime() {
    if (this.finished) return false;
    if (!this.ot) {
      if (this.score[1] !== this.score[2]) return false;
      this.ot = true; this.otT = 0;
      this.b.net?.emit?.({ e: 'md', k: 'ot' });
      this.fxOvertime();
      return true;
    }
    return true;
  }

  endBanner() { return this.finished && (this.byTarget || this.ot) ? 'GAME!' : 'TIME!'; }

  result() {
    const a = this.score[1], b = this.score[2];
    let winner = a > b ? 1 : b > a ? 2 : 0;
    if (!winner) { const c = this.b.stage.paint.coverage(); winner = c.a >= c.b ? 1 : 2; }
    return { mode: 'hoops', a, b, winner, target: this.target, ot: this.ot ? 1 : 0 };
  }

  // ---------------------------------------------------------------- visuals per frame
  updateVisuals(dt) {
    const b = this.b, ball = this.ball, colors = b.colors;
    // ball position: host = authoritative; client = smoothed toward its prediction
    const want = this.ballWorld(_w);
    if (this.client && ball.st === ST.free) {
      const d2 = this.render.distanceToSquared(want);
      if (d2 > 9) this.render.copy(want); else this.render.lerp(want, damp(18, dt));
    } else this.render.copy(want);
    if (ball.st === ST.reset) this.render.y = this.hover.y + Math.sin(this.time * 2.5) * 0.15;
    this.ballMesh.position.copy(this.render);
    this.ballMesh.rotation.set(ball.spin, this.time * (ball.st === ST.held ? 3 : 1.2), 0);
    const carrierTeam = ball.st === ST.held && ball.carrier ? ball.carrier.team : 0;
    this.ballCol.lerp(carrierTeam ? colors[carrierTeam] : GOLD, damp(8, dt));
    this.ballMat.emissive.copy(this.ballCol);
    this.ballMat.emissiveIntensity = 1.2 + Math.sin(this.time * 8) * 0.25;
    this.halo.position.copy(this.render);
    this.halo.material.color.copy(this.ballCol);
    this.halo.scale.setScalar(2.0 + Math.sin(this.time * 6) * 0.25 + (ball.st === ST.reset ? 0.8 : 0));
    this.ballBeam.position.copy(this.render).setY(this.render.y + BALL_R);
    this.ballBeam.material.color.copy(this.ballCol);
    const vis = b.state !== 'results';
    this.ballMesh.visible = this.halo.visible = vis && !(ball.carrier && !ball.carrier.alive);
    this.ballBeam.visible = this.ballMesh.visible;
    if (ball.st === ST.free && ball.vel.lengthSq() > 30 && Math.random() < dt * 30) {
      b.fx.spawn(this.render, _v.set(rand(-0.5, 0.5), rand(-0.2, 0.6), rand(-0.5, 0.5)), this.ballCol, 0.06, 0.35, { grav: 0.2 });
    }
    // hoops
    for (const t of [1, 2]) {
      const h = this.hoops[t];
      h.flashT = Math.max(0, h.flashT - dt);
      h.swishT = Math.max(0, h.swishT - dt);
      const targetOp = h.open ? 0 : 1;
      const u = h.shieldMat.uniforms;
      u.uOpacity.value += (targetOp - u.uOpacity.value) * damp(6, dt);
      u.uTime.value = this.time;
      u.uFlash.value = h.flashT;
      h.shield.visible = u.uOpacity.value > 0.02;
      const ru = h.ringMat.uniforms;
      ru.uProg.value += (clamp(h.prog, 0, 1) - ru.uProg.value) * damp(8, dt);
      ru.uTime.value = this.time;
      ru.uOpen.value = h.open ? 1 : 0;
      h.rimMat.emissive.copy(h.open ? colors[3 - t] : colors[t]);
      h.rimMat.emissiveIntensity = h.open ? 1.6 + Math.sin(this.time * 7) * 0.5 : 0.5;
      h.beam.visible = h.open;
      h.discMat.color.copy(h.open ? colors[3 - t] : colors[t]);
      h.discMat.opacity = h.open ? 0.12 + Math.sin(this.time * 6) * 0.04 : 0.06;
      h.sign.setText(h.open ? 'OPEN!' : 'SHIELDED', hexToCss(h.open ? colors[3 - t] : colors[t]));
      const sw = h.swishT;
      h.net.scale.set(1, 1 + Math.sin(sw * 20) * sw * 0.6, 1);
    }
    for (const f of b.world.fighters) if (f._icon) f._icon.classList.toggle('ball', ball.st === ST.held && ball.carrier === f);
  }

  updateHUD() {
    const b = this.b, ball = this.ball, my = b.player.team, me = b.player;
    const css = this.cssColors;
    const carrierTeam = ball.st === ST.held && ball.carrier ? ball.carrier.team : 0;
    this.hud.setHoops({
      score: this.score, target: this.target, carrierTeam, need: HOOP_OPEN, ot: this.ot, colors: css,
      open: { 1: this.hoops[1].open, 2: this.hoops[2].open }, prog: { 1: this.hoops[1].prog, 2: this.hoops[2].prog },
    });
    const cam = b.camera;
    const playing = b.state === 'play' || b.state === 'countdown';
    const enemyHoop = this.hoops[3 - my], myHoop = this.hoops[my];
    const mine = ball.carrier === me && ball.st === ST.held;
    // markers: the ball (unless I carry it), the hoop to attack / defend
    const bp = _v.copy(this.render).setY(this.render.y + 0.7);
    const bcol = carrierTeam ? css[carrierTeam] : '#ffd21a';
    const blabel = ball.st === ST.held && ball.carrier ? (ball.carrier.team === my ? ball.carrier.name : `${ball.carrier.name}!`) : ball.st === ST.reset ? 'TIP-OFF' : `BALL ${Math.round(this.render.distanceTo(me.pos))}m`;
    this.hud.marker(0, bp, cam, { color: bcol, label: blabel, show: playing && !mine });
    const attack = carrierTeam === my;
    this.hud.marker(1, _w.copy(enemyHoop.rim).setY(enemyHoop.rim.y + 1.2), cam, {
      color: enemyHoop.open ? css[my] : css[3 - my], hoop: true, label: enemyHoop.open ? (mine ? 'DUNK / SHOOT!' : 'HOOP OPEN') : 'SHIELDED', show: playing && attack,
    });
    this.hud.marker(2, _d.copy(myHoop.rim).setY(myHoop.rim.y + 1.2), cam, {
      color: css[my], hoop: true, label: myHoop.open ? 'DEFEND! OPEN' : 'DEFEND', show: playing && carrierTeam && carrierTeam !== my,
    });
    this.hud.power(mine && this.charge > 0 ? this.charge : null, this.charge >= 1 ? 'MAX!' : 'THROW');
    if (b.state !== 'play') { this.hud.status(null); return; }
    let msg = null, col = null, alert = false;
    if (ball.st === ST.reset) msg = `TIP-OFF IN <b>${Math.max(1, Math.ceil(ball.resetT))}</b>…`;
    else if (mine) {
      const left = HOLD_MAX - ball.holdT;
      if (left < 5) { msg = `SHOT CLOCK <b>${Math.max(0, Math.ceil(left))}</b> — throw it!`; alert = true; }
      else msg = enemyHoop.open ? '<b>You have the ball!</b> Jump at the rim to DUNK (3) or hold FIRE to shoot (2)' : '<b>You have the ball!</b> Enemy hoop is shielded — pass (FIRE) while your team paints the pad';
      col = css[my];
    } else if (carrierTeam === my) { msg = enemyHoop.open ? `<b>${ball.carrier.name}</b> has the ball — the hoop is OPEN, get open!` : `<b>${ball.carrier.name}</b> has the ball — paint the enemy pad to open the hoop!`; col = css[my]; }
    else if (carrierTeam) { msg = `<b>${ball.carrier.name}</b> has the ball — splat them!`; col = css[carrierTeam]; alert = myHoop.open; }
    else msg = '<b>LOOSE BALL!</b> Grab the Glowball!';
    this.hud.status(msg, col, alert);
  }

  // ---------------------------------------------------------------- effects
  fxGrab(f) {
    if (!f) return;
    const b = this.b, p = f.pos;
    b.app.audio?.sfx('ball_grab', { x: p.x, y: p.y, z: p.z, volume: f === b.player ? 1 : 0.7 });
    b.fx.ring(_v.copy(p).setY(p.y + 0.06), b.colors[f.team], 0.3, 1.6, 0.4, { alpha: 0.8 });
    if (f === b.player) b.hud.showBanner('GOT THE BALL!', '', 'ko', 1.0);
    else b.hud.feedMsg(`<b style="color:${this.cssColors[f.team]}">${f.name}</b> <span class="fx">grabbed the Glowball</span>`);
  }

  fxThrow(f, p) {
    this.b.app.audio?.sfx('ball_throw', { x: p.x, y: p.y, z: p.z, volume: 0.8 });
    void f;
  }

  fxDrop(f) {
    if (!f) return;
    const b = this.b;
    b.hud.feedMsg(`<b style="color:${this.cssColors[f.team]}">${f.name}</b> <span class="fx">dropped the ball!</span>`);
    b.app.audio?.sfx('ball_bounce', { x: f.pos.x, y: f.pos.y, z: f.pos.z, volume: 0.8 });
  }

  fxClock(f) {
    if (f === this.b.player) this.b.hud.showBanner('SHOT CLOCK!', 'Throw sooner next time', 'mmid', 1.4);
  }

  fxTip() {
    const b = this.b;
    b.app.audio?.sfx('launch', { x: this.hover.x, y: this.hover.y, z: this.hover.z, volume: 0.9 });
    b.fx.ring(this.hover.clone(), GOLD, 0.3, 3, 0.6, { alpha: 0.9 });
  }

  fxOpen(h, open) {
    const b = this.b, my = b.player.team, att = 3 - h.team;
    h.flashT = 0.8;
    b.fx.ring(_v.copy(h.base).setY(h.base.y + 0.08), b.colors[open ? att : h.team], h.r * 0.3, h.r * 1.1, 0.7, { alpha: 0.9 });
    if (open) {
      b.app.audio?.sfx('shield_break', { x: h.rim.x, y: h.rim.y, z: h.rim.z, volume: 0.9 });
      b.fx.splash(h.rim.clone(), new THREE.Vector3(0, 1, 0), b.colors[h.team], 26, 6, 0.1, 1.2);
      b.hud.feedMsg(h.team === my ? `<b style="color:${this.cssColors[att]}">Your hoop</b> <span class="fx">is OPEN — defend it!</span>` : `<b style="color:${this.cssColors[att]}">Enemy hoop</b> <span class="fx">is OPEN — score!</span>`);
      if (h.team !== my) b.app.audio?.sfx('special_ready', { volume: 0.5 });
    } else b.app.audio?.sfx('shield_up', { x: h.rim.x, y: h.rim.y, z: h.rim.z, volume: 0.6 });
  }

  fxBlock(h) {
    h.flashT = 0.7;
    this.b.app.audio?.sfx('shield_block', { x: h.rim.x, y: h.rim.y, z: h.rim.z, volume: 0.9 });
    this.b.fx.splash(_v.copy(h.rim), new THREE.Vector3(0, 0, h.dir), this.b.colors[h.team], 12, 4, 0.08, 1);
  }

  fxScore(team, pts, f, dunk) {
    const b = this.b, h = this.hoops[3 - team], col = b.colors[team];
    h.swishT = 0.8; h.flashT = 1;
    const p = h.rim.clone();
    b.fx.explosion(p, col, dunk ? 3.4 : 2.6);
    for (let i = 0; i < 3; i++) b.fx.splash(p, new THREE.Vector3(0, 1, 0), [col, GOLD, 0xffffff][i], 24, 9, 0.1, 1.2);
    b.fx.ring(_v.copy(h.base).setY(h.base.y + 0.1), col, 0.5, h.r * 1.6, 0.9, { alpha: 1 });
    b.app.audio?.sfx(dunk ? 'dunk_slam' : 'swish', { x: p.x, y: p.y, z: p.z, volume: 1 });
    b.app.audio?.sfx('crowd_cheer', { volume: 0.9 });
    const c = this.cssColors[team];
    const who = f ? `<span style="color:${c}">${f.name}</span> +${pts}` : `+${pts}`;
    b.hud.showBanner(`<span style="color:${c}">${dunk ? 'DUNK!' : 'SCORE!'}</span>`, who, 'mbig', 2.4);
    b.hud.feedMsg(`<b style="color:${c}">${f ? f.name : 'Team'}</b> <span class="fx">${dunk ? 'DUNKED for 3' : 'scored 2'}</span>`);
    this.hud.pop(team);
    if (b.player.pos.distanceTo(p) < 14) b.rig?.shake(dunk ? 0.6 : 0.3, 0.35);
  }

  fxOvertime() {
    this.b.hud.showBanner('OVERTIME!', 'Next score wins!', 'mbig', 2);
    this.b.app.audio?.sfx('one_minute');
  }

  // ---------------------------------------------------------------- bots
  // a plan for one bot: { goal, aim, urgent, carry, dunk, prefer, key }
  botPlan(bot) {
    const f = bot.f, team = f.team, ball = this.ball;
    const enemyHoop = this.hoops[3 - team], myHoop = this.hoops[team];
    if (ball.st === ST.held && ball.carrier === f) return this.carrierPlan(bot, enemyHoop);
    const bp = this.ballWorld(_w).clone();
    const threat = myHoop.open || myHoop.prog > 0.2;
    if (ball.st === ST.held && ball.carrier) {
      const c = ball.carrier;
      if (c.team === team) {
        if (!enemyHoop.open) return this.padPlan(bot, enemyHoop, true) || { key: 'escort', goal: this.escortPoint(f, c, enemyHoop) };
        return { key: 'escort', goal: this.escortPoint(f, c, enemyHoop) };
      }
      const r = this.rank(f, c.pos);
      if (r < 2 || (myHoop.open && r < 3)) return { key: 'chase', goal: c.pos.clone(), urgent: true, prefer: c };
      if (threat) return this.padPlan(bot, myHoop, false) || this.padPlan(bot, enemyHoop, true);
      return this.padPlan(bot, enemyHoop, true);
    }
    // loose ball or tip-off: the two closest go for it, one guards a threatened pad, the rest paint
    const target = ball.st === ST.reset ? this.tips[this.tipSide].clone() : bp;
    const r = this.rank(f, target);
    if (r === 0 || (r === 1 && f.pos.distanceTo(target) < 22)) return { key: 'ball', goal: target, urgent: true };
    if (threat && r === 3) return this.padPlan(bot, myHoop, false) || this.padPlan(bot, enemyHoop, true);
    return this.padPlan(bot, enemyHoop, true);
  }

  // 0 = closest living teammate to p (including humans)
  rank(f, p) {
    const d = f.pos.distanceToSquared(p);
    let r = 0;
    for (const o of this.b.world.fighters) if (o !== f && o.team === f.team && o.alive && o.pos.distanceToSquared(p) < d) r++;
    return r;
  }

  escortPoint(f, c, h) {
    _v.subVectors(h.rim, c.pos).setY(0);
    const l = _v.length() || 1;
    _v.divideScalar(l);
    const side = (f.netId % 2 ? 1 : -1) * 3.5;
    return new THREE.Vector3(c.pos.x + _v.x * 4 - _v.z * side, c.pos.y, c.pos.z + _v.z * 4 + _v.x * side);
  }

  // paint a hoop pad: theirs to open it (attack), ours to wipe their ink off it (defend)
  padPlan(bot, h, attack) {
    const f = bot.f, team = f.team, foe = 3 - team;
    if (attack ? h.sampler.of(team) > 0.8 : h.sampler.of(foe) < 0.08) return null;
    const pts = h.sampler.points;
    if (!pts.length) return null;
    const wanted = (pt) => { const o = h.sampler.ownerOf(pt); return attack ? o !== team : o === foe; };
    let aim = null, bd = 81;
    for (let i = 0; i < 20; i++) {
      const pt = pick(pts);
      const d = pt.p.distanceToSquared(f.pos);
      if (d < bd && wanted(pt)) { bd = d; aim = pt.p; }
    }
    let goal = null;
    const near = f.pos.distanceToSquared(h.base) < (h.r + 1) ** 2;
    if (!near || !aim || bot.goalT > 4) { for (let i = 0; i < 12 && !goal; i++) { const pt = pick(pts); if (wanted(pt)) goal = pt.p; } goal ||= h.base; }
    return { key: 'pad' + h.team, goal, aim, keep: near, urgent: !attack && h.open };
  }

  carrierPlan(bot, h) {
    const f = bot.f, ball = this.ball, team = f.team;
    const dx = h.rim.x - f.pos.x, dz = h.rim.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    const front = new THREE.Vector3(h.base.x, h.base.y, h.base.z + h.dir * 0.9);
    const sk = bot.sk || { aimErr: 0.085 };
    const lvl = this.b.world.level;
    const o = this.carryPos(f, new THREE.Vector3());
    let enemyNear = false;
    for (const e of this.b.world.fighters) if (e.alive && e.team !== team && e.pos.distanceToSquared(f.pos) < 25) enemyNear = true;
    if (h.open) {
      const clear = lvl.visible(o, h.rim);
      if (d > 3.4 && d < 10 && clear && (ball.holdT > 1.2 || enemyNear) && chance(enemyNear ? 0.5 : 0.22)) {
        this.botShoot(f, h, o, sk);
        return { key: 'carry', carry: true, goal: null };
      }
      return { key: 'carry', carry: true, goal: front, dunk: true };
    }
    // shielded: wait outside the pad and pass when pressured or stuck
    const side = (f.netId % 2 ? 1 : -1) * 3;
    const stage = new THREE.Vector3(h.base.x + side, h.base.y, h.base.z + h.dir * (h.r + 4));
    const mates = this.b.world.fighters.filter((m) => m !== f && m.alive && m.team === team);
    const late = ball.holdT > HOLD_MAX - 3;
    if ((enemyNear && ball.holdT > 0.8) || (ball.holdT > 4 && chance(0.3)) || late) {
      let best = null, bs = -Infinity;
      for (const m of mates) {
        const md = m.pos.distanceTo(f.pos);
        if (md < 3 || md > 22) continue;
        if (!lvl.visible(o, _v.set(m.pos.x, m.pos.y + 1.2, m.pos.z))) continue;
        const toHoop = m.pos.distanceTo(h.rim);
        let s = -toHoop * 0.4 - Math.abs(md - 10) * 0.2;
        for (const e of this.b.world.fighters) if (e.alive && e.team !== team && e.pos.distanceToSquared(m.pos) < 16) s -= 4;
        if (s > bs) { bs = s; best = m; }
      }
      if (best) { this.botPass(f, best, o); return { key: 'carry', carry: true, goal: null }; }
      if (late) { // lob it toward the enemy pad rather than lose it
        const T = 1.1;
        this.throwBall(f, o, ballisticVel(o, _v.copy(h.base).setY(h.base.y + 0.5).addScaledVector(_d.set(0, 0, h.dir), h.r + 2), T, BALL_G, new THREE.Vector3()));
        return { key: 'carry', carry: true, goal: null };
      }
    }
    return { key: 'carry', carry: true, goal: stage };
  }

  botShoot(f, h, o, sk) {
    const err = (sk.aimErr || 0.085) * 5;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * err;
    _v.copy(h.rim).add(_d.set(Math.cos(a) * r, 0.05 + rand(-0.15, 0.25) * err, Math.sin(a) * r));
    const dist = Math.hypot(_v.x - o.x, _v.z - o.z);
    const T = clamp(dist / 10 + 0.45, 0.6, 1.3);
    this.throwBall(f, o, ballisticVel(o, _v, T, BALL_G, new THREE.Vector3()));
  }

  botPass(f, m, o) {
    const dist = m.pos.distanceTo(f.pos);
    const T = clamp(dist / 13, 0.45, 1.1);
    _v.set(m.pos.x + m.vel.x * T * 0.7, m.pos.y + 1.3, m.pos.z + m.vel.z * T * 0.7);
    this.throwBall(f, o, ballisticVel(o, _v, T, BALL_G, new THREE.Vector3()));
  }

  // every frame: final approach + jump for dunks
  botFrame(bot) {
    const f = bot.f, ball = this.ball, I = f.intent;
    if (ball.st !== ST.held || ball.carrier !== f || !bot.plan?.dunk) return;
    const h = this.hoops[3 - f.team];
    if (!h.open) return;
    const dx = h.rim.x - f.pos.x, dz = h.rim.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 4.5) return;
    // come in from the front of the rim (from the middle of the map)
    const fx = h.rim.x, fz = h.rim.z + h.dir * 1.2;
    const ahead = (f.pos.z - h.rim.z) * h.dir > 0.4;
    const tx = ahead ? h.rim.x - f.pos.x : fx - f.pos.x, tz = ahead ? h.rim.z - f.pos.z : fz - f.pos.z;
    const tl = Math.hypot(tx, tz) || 1;
    I.mx = tx / tl; I.mz = tz / tl;
    I.goo = false; I.fire = false;
    if (ahead && f.onGround && d < 2.3) I.jump = true;
    if (!f.onGround && d < 0.4) { I.mx = 0; I.mz = 0; }
  }

  dispose() {
    for (const f of this.b.world.fighters) f.canFight = true;
    this.hud.dispose();
    this.group.parent?.remove(this.group);
    const mats = new Set();
    this.group.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) mats.add(m); });
    for (const m of mats) { if (m.map && !m.map.userData.shared) m.map.dispose(); if (m.emissiveMap && !m.emissiveMap.userData.shared) m.emissiveMap.dispose(); m.dispose(); }
  }
}

export { ST_NAME as BALL_STATES };
