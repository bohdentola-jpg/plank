// The view layer: renderer, camera, rigs, and everything that turns sim state
// into pixels. The N64 look comes from here — the scene renders at about a third
// of the window's resolution and gets scaled up with nearest-neighbour, there
// are no shadow maps (blob shadows instead), and nothing is antialiased.
import * as THREE from 'three';
import { buildFighter, buildBlobShadow, buildPlayerRing } from './models.js';
import { Animator } from './anim.js';
import { makeClips, chargeShake } from './poses.js';
import { Fx } from './fx.js';
import { mat, box, cyl, sph, cone, plane, put, pixTex, tileMat, canvasMat, skyDome, seeded, shade } from './kit.js';

const BASE_CLIPS = makeClips();

export const RES_SCALES = { n64: 3.2, crisp: 2.1, sharp: 1.35 };

/** Which clip plays for a given fighter state. */
function clipFor(f) {
  switch (f.state) {
    case 'idle': return 'idle';
    case 'walk': return 'walk';
    case 'dash': return 'dash';
    case 'run': return 'run';
    case 'skid': return 'skid';
    case 'turn': return 'turn';
    case 'crouch': return 'crouch';
    case 'jumpsquat': return 'jumpsquat';
    case 'air': return f.vy > 1 ? (f.jumps < f.stats.jumps - 1 ? 'djump' : 'jump') : (f.fastFalling ? 'fastfall' : 'fall');
    case 'land': case 'landLag': return f.landLagLeft > 8 ? 'landHeavy' : 'land';
    case 'shield': return 'shield';
    case 'shieldBreak': return 'shieldBreak';
    case 'roll': return 'roll';
    case 'spotdodge': return 'spotdodge';
    case 'airdodge': return 'airdodge';
    case 'grabbing': return 'grabHold';
    case 'held': return 'held';
    case 'hitstun': return 'hitstun';
    case 'tumble': return 'tumble';
    case 'downed': return 'downed';
    case 'getup': return 'getup';
    case 'ledge': return 'ledgeHang';
    case 'ledgeGetup': return 'ledgeGetup';
    case 'helpless': return 'helpless';
    case 'taunt': return 'taunt';
    case 'entry': return 'entry';
    case 'win': return 'win';
    case 'dead': return 'ko';
    default: return 'idle';
  }
}

const PROJ_GEO = {};
function projGeo(kind) {
  if (PROJ_GEO[kind]) return PROJ_GEO[kind];
  let g;
  switch (kind) {
    case 'feather': g = new THREE.BoxGeometry(0.46, 0.1, 0.1); break;
    case 'bolt': g = new THREE.ConeGeometry(0.16, 0.6, 5); g.rotateZ(-Math.PI / 2); break;
    case 'bomb': g = new THREE.SphereGeometry(0.3, 7, 5); break;
    case 'disc': g = new THREE.CylinderGeometry(0.3, 0.3, 0.09, 8); g.rotateX(Math.PI / 2); break;
    case 'wave': g = new THREE.BoxGeometry(0.5, 0.7, 0.2); break;
    case 'nut': g = new THREE.SphereGeometry(0.2, 6, 5); break;
    case 'ball': default: g = new THREE.SphereGeometry(0.24, 7, 5);
  }
  PROJ_GEO[kind] = g;
  return g;
}

/**
 * A little turntable renderer for one fighter — used by the title screen and the
 * character-select pane. Its own canvas, its own loop-free update.
 */
export class Preview {
  constructor(holder, { crt = true } = {}) {
    this.holder = holder;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setPixelRatio(1);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'melee-canvas';
    holder.appendChild(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    const amb = new THREE.AmbientLight('#b9c4e0', 0.95);
    const key = new THREE.DirectionalLight('#fff4dc', 1.0);
    key.position.set(-3, 6, 8);
    const rim = new THREE.DirectionalLight('#7fa8ff', 0.4);
    rim.position.set(4, 2, -6);
    this.scene.add(amb, key, rim);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.35, 0.18, 14),
      new THREE.MeshPhongMaterial({ color: '#232842', flatShading: true }),
    );
    disc.position.y = -0.09;
    this.scene.add(disc);
    this.disc = disc;
    this.rig = null;
    this.anim = null;
    this.spin = 0;
    this.resize();
  }

  show(def, alt = 0) {
    if (this.def === def && this.alt === alt) return;
    this.def = def;
    this.alt = alt;
    if (this.rig) { this.scene.remove(this.rig.group); this.rig.dispose(); }
    this.rig = buildFighter(def, alt);
    this.scene.add(this.rig.group);
    this.anim = new Animator(this.rig, { ...BASE_CLIPS, ...(def.clips || {}) });
    this.anim.play('idle', { fade: 0 });
    this.disc.material.color.set(shade(def.colors?.trim || '#f2b705', -92));
  }

  resize() {
    const w = this.holder.clientWidth || 320;
    const h = this.holder.clientHeight || 320;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(120, Math.round(w / 2.4)), Math.max(120, Math.round(h / 2.4)), false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  update(dt) {
    if (!this.rig) return;
    this.spin += dt * 0.55;
    this.rig.group.rotation.y = Math.sin(this.spin) * 0.9 + Math.PI / 2;
    this.anim.update(dt);
    const h = this.rig.height;
    this.camera.position.set(0, h * 0.62, h * 1.85);
    this.camera.lookAt(0, h * 0.5, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.rig) { this.scene.remove(this.rig.group); this.rig.dispose(); }
    this.disc.geometry.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

export class View {
  constructor(holder, match, { res = 'n64', crt = true } = {}) {
    this.holder = holder;
    this.match = match;
    this.res = res;
    this.scale = RES_SCALES[res] || 3.2;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor('#0a0c14');
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'melee-canvas';
    holder.appendChild(this.canvas);
    this.setCrt(crt);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.5, 220);
    this.camera.position.set(0, 4, 20);
    this.camTarget = { x: 0, y: 3, w: 22 };
    this.camNow = { x: 0, y: 3, w: 26 };

    const stage = match.stage;
    const amb = new THREE.AmbientLight(stage.light?.ambient || '#9aa4c0', stage.light?.ambientI ?? 0.86);
    const key = new THREE.DirectionalLight(stage.light?.key || '#fff6e0', stage.light?.keyI ?? 0.95);
    key.position.set(-6, 14, 12);
    const rim = new THREE.DirectionalLight(stage.light?.rim || '#7fa8ff', 0.35);
    rim.position.set(8, 4, -10);
    this.scene.add(amb, key, rim);
    if (stage.fog) this.scene.fog = new THREE.Fog(stage.fog.color, stage.fog.near, stage.fog.far);

    // ---- stage visuals
    this.stageView = stage.build
      ? stage.build({ THREE, mat, box, cyl, sph, cone, plane, put, pixTex, tileMat, canvasMat, skyDome, seeded, world: match.world })
      : null;
    if (this.stageView?.group) this.scene.add(this.stageView.group);

    this.fx = new Fx(this.scene);
    match.fx = this.fx;

    // ---- fighters
    this.rigs = match.fighters.map((f) => this.buildRigFor(f));

    // ---- pooled projectile + item meshes
    this.projPool = [];
    this.itemPool = [];
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(projGeo('ball'), new THREE.MeshPhongMaterial({ color: '#ffffff', flatShading: true, shininess: 40 }));
      m.visible = false;
      this.scene.add(m);
      this.projPool.push(m);
    }
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = box(0.62, 0.62, 0.62, mat('#8a8f9a'));
      const glow = sph(0.34, mat('#ffffff', { basic: true }));
      g.add(body, glow);
      g.visible = false;
      this.scene.add(g);
      this.itemPool.push({ g, body, glow });
    }

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  buildRigFor(f) {
    const rig = buildFighter(f.def, f.alt);
    this.scene.add(rig.group);
    const shadow = buildBlobShadow(0.46 * (f.stats.size || 1));
    const ring = buildPlayerRing(f.color);
    this.scene.add(shadow, ring);
    const clips = { ...BASE_CLIPS, ...(f.def.clips || {}) };
    const anim = new Animator(rig, clips);
    anim.overlays.push(chargeShake(() => (f.state === 'charge' ? Math.min(1, f.chargeFrames / 22) : 0)));
    // the respawn platform they drop in on
    const pad = box(1.9, 0.16, 1.1, mat('#9fd8ff', { basic: true, opacity: 0.55 }));
    pad.visible = false;
    this.scene.add(pad);
    return { f, rig, anim, shadow, ring, pad, lastClip: null };
  }

  resize() {
    const w = this.holder.clientWidth || window.innerWidth;
    const h = this.holder.clientHeight || window.innerHeight;
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(160, Math.round(w / this.scale)), Math.max(120, Math.round(h / this.scale)), false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  setRes(res) {
    this.res = res;
    this.scale = RES_SCALES[res] || 3.2;
    this.resize();
  }

  /** The scanline overlay is a DOM layer, not a canvas filter — cheaper and crisper. */
  setCrt(on) {
    document.body.classList.toggle('crt-on', !!on);
  }

  /** Sync every rig to sim state, move the camera, draw one frame. */
  update(dt) {
    const m = this.match;
    for (const r of this.rigs) this.syncFighter(r, dt);
    this.syncProjectiles();
    this.syncItems();
    this.stageView?.update?.(dt, m);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  syncFighter(r, dt) {
    const { f, rig, anim } = r;
    const dead = f.state === 'dead';
    rig.group.visible = !dead || f.deadTimer > 60;
    r.shadow.visible = rig.group.visible;
    r.ring.visible = rig.group.visible && !dead;

    rig.group.position.set(f.x, f.y, 0);
    rig.group.rotation.y = f.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    // landing squash, purely cosmetic
    const sq = f.landSquash;
    rig.group.scale.set(1 + sq * 0.16, 1 - sq * 0.2, 1 + sq * 0.16);

    const name = clipFor(f);
    const inMove = f.state === 'attack' || f.state === 'throwing' || f.state === 'charge' || (f.state === 'grabbing' && false);
    if (inMove && f.move) {
      const clip = (f.move.clip && anim.clips[f.move.clip]) ? f.move.clip : 'nspecial';
      if (r.lastClip !== clip) { anim.play(clip, { fade: 0, dur: f.move.frames / 60 }); r.lastClip = clip; }
      const phase = f.state === 'charge' ? 0 : Math.min(1, f.moveFrame / Math.max(1, f.move.frames));
      anim.dur = f.move.frames / 60;
      anim.seek(phase);
      anim.update(0);
    } else {
      if (r.lastClip !== name) { anim.play(name, { fade: 0.07 }); r.lastClip = name; }
      anim.update(dt);
    }

    // shadow on whatever surface is below
    const gy = this.match.world.groundYAt(f.x, f.y + 0.05);
    const airH = Math.max(0, f.y - (gy === -Infinity ? f.y : gy));
    r.shadow.position.set(f.x, (gy === -Infinity ? f.y : gy) + 0.03, 0);
    const shrink = Math.max(0.25, 1 - airH * 0.1);
    r.shadow.scale.setScalar(shrink);
    r.shadow.material.opacity = 0.34 * shrink;
    r.shadow.visible = r.shadow.visible && gy !== -Infinity && airH < 9;
    r.ring.position.set(f.x, f.y + 0.04, 0);
    r.ring.material.opacity = f.grounded ? 0.8 : 0.3;

    // respawn platform
    r.pad.visible = f.state === 'entry';
    if (r.pad.visible) r.pad.position.set(f.x, f.y - 0.12, 0);

    // flashes: hitlag white, invincibility blink, charge heat, power-up glow
    let flashColor = null, flashAmt = 0;
    if (f.hitlagFlash > 0) { flashColor = '#ffffff'; flashAmt = 0.75; }
    else if (f.state === 'charge') { flashColor = '#ff6a3a'; flashAmt = Math.min(0.6, f.chargeFrames / 40); }
    else if (f.powerUp > 0) { flashColor = '#ff9a4a'; flashAmt = 0.25 + Math.sin(f.frame * 0.4) * 0.12; }
    else if (f.invuln > 0 || f.respawnInvuln > 0) { flashColor = '#8ad6ff'; flashAmt = 0.3 + Math.sin(f.frame * 0.8) * 0.2; }
    rig.setFlash(flashColor || '#ffffff', flashColor ? flashAmt : 0);
    rig.setFace(dead || f.state === 'shieldBreak' ? 'ko' : 'normal');

    // shield bubble
    if (f.state === 'shield') {
      if (!r.bubble) {
        r.bubble = sph(0.95, mat(f.color, { basic: true, opacity: 0.3 }), 10, 8);
        this.scene.add(r.bubble);
      }
      r.bubble.visible = true;
      const k = Math.max(0.35, f.shieldHp / 55);
      r.bubble.scale.setScalar(0.7 + k * 0.5);
      r.bubble.position.set(f.x, f.y + f.height * 0.5, 0);
      r.bubble.material.opacity = 0.18 + k * 0.22;
    } else if (r.bubble) {
      r.bubble.visible = false;
    }
  }

  syncProjectiles() {
    const ps = this.match.projectiles;
    for (let i = 0; i < this.projPool.length; i++) {
      const m = this.projPool[i];
      const p = ps[i];
      if (!p) { m.visible = false; continue; }
      m.visible = true;
      if (m.geometry !== projGeo(p.kind)) m.geometry = projGeo(p.kind);
      m.material.color.set(p.color);
      m.position.set(p.x, p.y, 0);
      m.rotation.z = p.rot + (p.dir < 0 ? Math.PI : 0);
      m.scale.setScalar(Math.max(0.4, p.r / 0.24));
    }
  }

  syncItems() {
    const items = this.match.items;
    for (let i = 0; i < this.itemPool.length; i++) {
      const slot = this.itemPool[i];
      const it = items[i];
      if (!it) { slot.g.visible = false; continue; }
      slot.g.visible = true;
      slot.g.position.set(it.x, it.y + Math.sin(it.bob) * 0.06, 0);
      slot.g.rotation.y += 0.03;
      slot.body.material = mat(it.def.color);
      slot.glow.visible = it.kind === 'orb' || it.kind === 'star';
      slot.glow.material = mat(it.def.color, { basic: true });
      slot.glow.scale.setScalar(1 + Math.sin(it.bob * 2) * 0.12);
      slot.body.visible = it.kind !== 'orb';
    }
  }

  updateCamera(dt) {
    const t = this.match.world.cameraTarget(this.match.fighters);
    const lerp = 1 - Math.exp(-dt * 6.5);
    this.camNow.x += (t.x - this.camNow.x) * lerp;
    this.camNow.y += (t.y - this.camNow.y) * lerp;
    this.camNow.w += (t.w - this.camNow.w) * lerp * 0.8;
    const shake = this.fx.consumeShake();
    const fovR = (this.camera.fov * Math.PI) / 180;
    const dist = (this.camNow.w / 2) / (Math.tan(fovR / 2) * this.aspect);
    // almost level with the action: a high camera turns platforms into floors
    this.camera.position.set(this.camNow.x + shake.x, this.camNow.y + shake.y + this.camNow.w * 0.012, dist);
    this.camera.lookAt(this.camNow.x, this.camNow.y, 0);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.fx.dispose();
    for (const r of this.rigs) {
      this.scene.remove(r.rig.group, r.shadow, r.ring, r.pad);
      if (r.bubble) this.scene.remove(r.bubble);
      r.rig.dispose();
      r.shadow.geometry.dispose();
      r.ring.geometry.dispose();
    }
    this.stageView?.dispose?.();
    for (const m of this.projPool) m.material.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
