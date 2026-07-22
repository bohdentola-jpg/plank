// Bot combatants: perception (vision cones, smoke occlusion, flash blindness,
// hearing footsteps/gunfire), engagement with human-like reaction time and
// burst discipline, A* patrolling toward objectives, economy-aware buying,
// and simple humanoid models with team identity.
import * as THREE from './three.js';
import { G } from './state.js';
import { Combatant } from './entity.js';
import { WEAPONS } from './weapons.js';
import { clamp, lerp, rand, pick, angleDiff, moveToward } from './util.js';
import { cloneModel } from './models/index.js';

const GRAV = 16;
const ACCEL = 55, FRICTION = 7.5;

const DIFF = [
  { react: 0.55, aimErr: 3.4, burst: [2, 4], headChance: 0.08, spot: 45 },
  { react: 0.36, aimErr: 2.0, burst: [3, 6], headChance: 0.2, spot: 60 },
  { react: 0.22, aimErr: 1.05, burst: [4, 8], headChance: 0.38, spot: 80 },
];

export const BOT_NAMES = {
  CT: ['Rook', 'Vector', 'Saber', 'Frost', 'Bishop'],
  T: ['Viper', 'Crow', 'Havoc', 'Dune', 'Jackal'],
};

export class Bot extends Combatant {
  constructor(name, team) {
    super(name, team);
    this.state = 'patrol';
    this.target = null;         // current visible enemy
    this.seenAt = 0;            // when target became visible
    this.lastKnown = null;      // {pos, time}
    this.path = null;
    this.pathIdx = 0;
    this.pathGoal = null;
    this.repathAt = 0;
    this.perceptAt = 0;
    this.burstLeft = 0;
    this.burstPauseUntil = 0;
    this.aimYaw = 0; this.aimPitch = 0;
    this.wanderLook = 0;
    this.stepAcc = 0;
    this.walkPhase = 0;
    this.strafeDir = 0;
    this.strafeUntil = 0;
    this.utilityThrown = false;
    this.buildBody();
  }

  // ------------------------------------------------------------- visuals
  buildBody() {
    const g = new THREE.Group();
    const isCT = this.team === 'CT';
    const cloth = new THREE.MeshStandardMaterial({ color: isCT ? 0x2e3d55 : 0x6e5b3a, roughness: 0.85 });
    const vest = new THREE.MeshStandardMaterial({ color: isCT ? 0x1d2735 : 0x4a3d28, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb08c66, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.7 });
    const mk = (mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    this.legL = mk(cloth, 0.16, 0.78, 0.18, -0.11, 0.39, 0);
    this.legR = mk(cloth, 0.16, 0.78, 0.18, 0.11, 0.39, 0);
    mk(dark, 0.17, 0.1, 0.26, -0.11, 0.05, -0.03);
    mk(dark, 0.17, 0.1, 0.26, 0.11, 0.05, -0.03);
    this.torso = mk(cloth, 0.44, 0.62, 0.24, 0, 1.1, 0);
    mk(vest, 0.46, 0.4, 0.28, 0, 1.16, 0);
    this.armL = mk(cloth, 0.11, 0.5, 0.13, -0.29, 1.16, 0);
    this.armR = mk(cloth, 0.11, 0.5, 0.13, 0.29, 1.16, 0);
    this.head = mk(skin, 0.22, 0.24, 0.23, 0, 1.55, 0);
    this.helmetMesh = mk(dark, 0.25, 0.1, 0.26, 0, 1.68, 0);
    this.helmetMesh.material = new THREE.MeshStandardMaterial({ color: isCT ? 0x25303f : 0x3d3526, roughness: 0.6 });
    if (isCT) mk(dark, 0.24, 0.06, 0.05, 0, 1.55, -0.115); // visor
    else mk(new THREE.MeshStandardMaterial({ color: 0x8a2418, roughness: 0.9 }), 0.23, 0.08, 0.24, 0, 1.47, 0); // bandana
    // gun mount
    this.gunMount = new THREE.Group();
    this.gunMount.position.set(0.24, 1.32, -0.2);
    g.add(this.gunMount);
    this.gunModelId = null;
    this.mesh = g;
    G.scene.add(g);
  }

  updateGunModel() {
    const def = this.currentDef();
    const id = this.slot === 'knife' ? 'knife' : this.slot === 'grenade' ? (this.currentGrenadeId() || 'knife') : this.currentWeapon().id;
    if (id === this.gunModelId) return;
    this.gunModelId = id;
    while (this.gunMount.children.length) this.gunMount.remove(this.gunMount.children[0]);
    const model = cloneModel(id, def ? def.class : 'pistol');
    model.group.scale.setScalar(0.95);
    this.gunMount.add(model.group);
  }

  syncMesh(dt) {
    const m = this.mesh;
    m.position.copy(this.pos);
    if (!this.alive) return;
    m.rotation.y = -this.yaw + Math.PI; // model faces -Z when yaw=0... align to view
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * speed * 2.4;
    const swing = Math.sin(this.walkPhase) * clamp(speed / 4, 0, 1) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.5;
    this.gunMount.rotation.x = this.pitch;
    this.helmetMesh.visible = this.helmet;
    const crouchScale = this.crouched ? 0.78 : 1;
    m.scale.y = lerp(m.scale.y, crouchScale, Math.min(1, dt * 8));
    this.updateGunModel();
  }

  onDeath() {
    // corpse: tip over
    this.mesh.rotation.z = (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2;
    this.mesh.rotation.y = rand(0, Math.PI * 2);
    this.mesh.position.y = this.pos.y + 0.18;
    this.mesh.scale.y = 1;
  }

  onDamaged(attacker) {
    // getting shot reveals the shooter's rough direction
    if (attacker && attacker.team !== this.team) {
      this.lastKnown = { pos: attacker.pos.clone(), time: G.time };
      if (this.state === 'patrol') this.state = 'hunt';
    }
  }

  onBurned() {
    // run out of fire: pick a point away from the nearest fire
    let nearest = null;
    for (const f of G.fires) {
      const d = Math.hypot(f.center.x - this.pos.x, f.center.z - this.pos.z);
      if (!nearest || d < nearest.d) nearest = { f, d };
    }
    if (nearest) {
      const away = new THREE.Vector3(this.pos.x - nearest.f.center.x, 0, this.pos.z - nearest.f.center.z).normalize();
      const goal = { x: this.pos.x + away.x * 6, z: this.pos.z + away.z * 6 };
      this.setGoal(goal, true);
    }
  }

  // ------------------------------------------------------------- economy
  buyRound() {
    const diff = DIFF[G.settings.difficulty];
    const buy = (id) => {
      const def = WEAPONS[id];
      if (this.money < def.price) return false;
      this.money -= def.price;
      this.giveWeapon(id);
      return true;
    };
    const buyArmor = (full) => {
      const cost = full ? 1000 : 650;
      if (this.money < cost) return false;
      this.money -= cost;
      this.armor = 100;
      this.helmet = full;
      return true;
    };
    const T = this.team === 'T';
    if (!this.weapons.primary) {
      if (this.money >= (T ? 3700 : 4100)) { buyArmor(true); buy(T ? 'ak47' : 'm4a4'); }
      else if (this.money >= (T ? 2800 : 3050)) { buyArmor(false); buy(T ? 'galil' : 'famas'); }
      else if (this.money >= 2100) { buyArmor(false); buy(T ? 'mac10' : 'mp9'); }
      else if (this.money >= 1400) { buy(T ? 'mac10' : 'mp9'); }
      else if (this.money >= 850) { buyArmor(false); if (this.money >= 500) buy(T ? 'tec9' : 'fiveseven'); }
      // else full eco
    } else {
      if (this.armor < 40 && this.money >= 1000) buyArmor(true);
    }
    // occasionally an AWP for rich hard bots
    if (G.settings.difficulty >= 1 && this.money >= 5750 && Math.random() < 0.3) { buy('awp'); buyArmor(true); }
    // grenades with leftovers
    const nade = (id, cost) => { if (this.money >= cost + 300) { this.money -= cost; this.giveGrenade(id); } };
    nade('flash', 200);
    nade('smoke', 300);
    nade('he', 300);
    if (this.money > 2000) nade(T ? 'molotov' : 'incendiary', T ? 400 : 600);
    this.slot = this.weapons.primary ? 'primary' : 'secondary';
    this.utilityThrown = false;
  }

  // ------------------------------------------------------------ movement
  setGoal(goal, force = false) {
    if (!force && this.pathGoal && Math.hypot(goal.x - this.pathGoal.x, goal.z - this.pathGoal.z) < 2) return;
    this.pathGoal = goal;
    this.path = G.world.findPath(this.pos, goal);
    this.pathIdx = 0;
    this.repathAt = G.time + 3;
  }

  moveAlongPath(dt, sprint = true) {
    if (!this.path || this.pathIdx >= this.path.length) return false;
    const node = this.path[this.pathIdx];
    const dx = node.x - this.pos.x, dz = node.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.7) { this.pathIdx++; return this.pathIdx < this.path.length; }
    this.applyMove(dx / d, dz / d, dt);
    if (this.state !== 'engage') {
      const wantYaw = Math.atan2(-dx, -dz);
      this.yaw += angleDiff(this.yaw, wantYaw) * Math.min(1, dt * 6);
      this.pitch = lerp(this.pitch, 0, dt * 3);
    }
    return true;
  }

  applyMove(wx, wz, dt) {
    const max = this.maxSpeed();
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = Math.min(ACCEL * dt, Math.max(0, max - cur));
    this.vel.x += wx * add;
    this.vel.z += wz * add;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > max) { this.vel.x *= max / sp; this.vel.z *= max / sp; }
  }

  physics(dt) {
    // recoil/spread recovery (the player does this in Player.update)
    const def = this.currentDef();
    const recovery = def && def.recovery ? def.recovery : 0.4;
    if (G.time - this.lastShotTime > 0.11 && this.recoilIndex > 0) {
      this.recoilIndex = Math.max(0, this.recoilIndex - dt * (10 / recovery));
    }
    this.fireInacc = moveToward(this.fireInacc, 0, dt * 5);
    // crouch moves the eye line and hitbox, matching the visual scale
    this.eyeHeight = lerp(this.eyeHeight, this.crouched ? 1.06 : 1.62, Math.min(1, dt * 8));
    this.height = lerp(this.height, this.crouched ? 1.3 : 1.85, Math.min(1, dt * 8));
    if (this.grounded) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const ns = Math.max(0, sp - sp * FRICTION * dt) / sp;
        this.vel.x *= ns; this.vel.z *= ns;
      }
    }
    this.vel.y -= GRAV * dt;
    const res = G.world.moveEntity(this.pos, this.vel, dt, this.radius, this.height, true);
    this.grounded = res.grounded || this.pos.y <= 0.02;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && speed > 1.5) {
      this.stepAcc += speed * dt;
      if (this.stepAcc > 2.2) {
        this.stepAcc = 0;
        G.audio.footstep(this.eyePos(new THREE.Vector3()), this.walking, false);
      }
    }
  }

  // ----------------------------------------------------------- perception
  canSee(ent) {
    const eye = this.eyePos(this._e1 || (this._e1 = new THREE.Vector3()));
    const theirEye = ent.eyePos(this._e2 || (this._e2 = new THREE.Vector3()));
    const d = eye.distanceTo(theirEye);
    const diff = DIFF[G.settings.difficulty];
    if (d > diff.spot * 1.6) return false;
    // FOV check (relaxed when they've been loud recently)
    const to = theirEye.clone().sub(eye).normalize();
    const look = this.viewDir(new THREE.Vector3());
    if (to.dot(look) < 0.25 && d > 3) return false;
    if (G.world.lineBlocked(eye, theirEye)) {
      // try chest
      const chest = new THREE.Vector3(ent.pos.x, ent.pos.y + 1.0, ent.pos.z);
      if (G.world.lineBlocked(eye, chest)) return false;
    }
    if (G.grenades.smokeBlocks(eye, theirEye)) return false;
    return true;
  }

  perceive() {
    if (this.isBlind()) { this.target = null; return; }
    let best = null;
    for (const ent of [G.player, ...G.bots]) {
      if (!ent.alive || ent.team === this.team || ent === this) continue;
      if (!this.canSee(ent)) continue;
      const d = this.pos.distanceTo(ent.pos);
      if (!best || d < best.d) best = { ent, d };
    }
    if (best) {
      if (this.target !== best.ent) { this.target = best.ent; this.seenAt = G.time; }
      this.lastKnown = { pos: best.ent.pos.clone(), time: G.time };
      this.state = 'engage';
    } else {
      if (this.target) { this.target = null; this.state = 'hunt'; }
    }
    // hearing
    for (const ev of G.soundEvents) {
      if (ev.consumedBy && ev.consumedBy.has(this.id)) continue;
      const d = Math.hypot(ev.pos.x - this.pos.x, ev.pos.z - this.pos.z);
      if (d > ev.loudness) continue;
      (ev.consumedBy = ev.consumedBy || new Set()).add(this.id);
      // can't tell friend from foe by sound alone unless very loud; approximate:
      // treat gunfire/explosions as intel, footsteps as suspicion
      const guess = new THREE.Vector3(ev.pos.x + rand(-2, 2), 0, ev.pos.z + rand(-2, 2));
      const isEnemyish = !this._soundFromTeam(ev);
      if (isEnemyish && (!this.lastKnown || G.time - this.lastKnown.time > 1.5)) {
        this.lastKnown = { pos: guess, time: G.time - 0.5 };
        if (this.state === 'patrol') this.state = 'hunt';
      }
    }
  }

  _soundFromTeam(ev) {
    // crude attribution: if a teammate is within 2m of the event it was ours
    for (const ent of [G.player, ...G.bots]) {
      if (ent.team !== this.team || !ent.alive) continue;
      if (Math.hypot(ev.pos.x - ent.pos.x, ev.pos.z - ent.pos.z) < 2.5) return true;
    }
    return false;
  }

  friendInLine(dir, maxDist) {
    const eye = this.eyePos(new THREE.Vector3());
    for (const ent of [G.player, ...G.bots]) {
      if (ent === this || !ent.alive || ent.team !== this.team) continue;
      const to = new THREE.Vector3(ent.pos.x - eye.x, ent.pos.y + 1 - eye.y, ent.pos.z - eye.z);
      const along = to.dot(dir);
      if (along < 0 || along > maxDist) continue;
      const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
      if (perp < 0.6) return true;
    }
    return false;
  }

  // -------------------------------------------------------------- combat
  engage(dt) {
    const t = this.target;
    if (!t || !t.alive) { this.target = null; this.state = 'hunt'; return; }
    const diff = DIFF[G.settings.difficulty];
    const dist = this.pos.distanceTo(t.pos);
    // aim point: chest, or head for skilled bots
    const aimHead = Math.random() < diff.headChance;
    const aimY = t.pos.y + (aimHead ? t.eyeHeight + 0.05 : 1.05);
    // aim error shrinks with focus time
    const focus = clamp((G.time - this.seenAt) / 0.9, 0, 1);
    const err = diff.aimErr * (1.3 - focus) * (0.014 + dist * 0.0018);
    const ax = t.pos.x + rand(-err, err) * 8;
    const az = t.pos.z + rand(-err, err) * 8;
    const dx = ax - this.pos.x, dz = az - this.pos.z;
    const wantYaw = Math.atan2(-dx, -dz);
    const dy = aimY - (this.pos.y + this.eyeHeight);
    const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
    const turnSpeed = 6 + G.settings.difficulty * 4;
    this.yaw += angleDiff(this.yaw, wantYaw) * Math.min(1, dt * turnSpeed);
    this.pitch = lerp(this.pitch, wantPitch, Math.min(1, dt * turnSpeed));

    // movement: stop to shoot (counter-strafe emulation), jiggle at mid range
    if (G.time > this.strafeUntil) {
      const roll = Math.random();
      if (dist < 14 && roll < 0.4) { this.strafeDir = Math.random() > 0.5 ? 1 : -1; this.strafeUntil = G.time + rand(0.25, 0.5); }
      else { this.strafeDir = 0; this.strafeUntil = G.time + rand(0.3, 0.8); }
      this.crouched = dist > 20 && Math.random() < 0.3;
    }
    if (this.strafeDir !== 0) {
      // right vector for our yaw convention (forward = (-sin, -cos))
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      this.applyMove(rx * this.strafeDir, rz * this.strafeDir, dt);
    }

    // weapon discipline
    const w = this.currentWeapon();
    if (w && w.ammo === 0 && w.reserve === 0) {
      if (this.slot === 'primary' && this.weapons.secondary) G.combat.switchSlot(this, 'secondary');
    }
    const aligned = Math.abs(angleDiff(this.yaw, wantYaw)) < 0.09 && Math.abs(this.pitch - wantPitch) < 0.09;
    const reacted = G.time - this.seenAt > diff.react + rand(0, 0.1);
    if (aligned && reacted && G.time > this.burstPauseUntil && !this.isBlind()) {
      const dir = this.viewDir(new THREE.Vector3());
      if (!this.friendInLine(dir, dist)) {
        if (this.burstLeft <= 0) {
          this.burstLeft = Math.round(rand(diff.burst[0], diff.burst[1]));
          if (dist > 25) this.burstLeft = Math.max(1, Math.round(this.burstLeft / 2));
        }
        const speed = Math.hypot(this.vel.x, this.vel.z);
        if (speed < 1.8 || dist < 8) { // wait until braked, unless point-blank
          if (G.combat.tryFire(this, G.time)) {
            this.burstLeft--;
            if (this.burstLeft <= 0) this.burstPauseUntil = G.time + rand(0.18, 0.42) + (dist > 25 ? 0.25 : 0);
          }
        }
      }
    }
    // scoped weapons: zoom in when engaging at range
    const def = this.currentDef();
    if (def && def.zoom && !this.scoped && dist > 15) this.scoped = true;
    if (def && def.zoom && this.scoped && dist < 8) this.scoped = false;
  }

  hunt(dt) {
    if (!this.lastKnown || G.time - this.lastKnown.time > 8) { this.state = 'patrol'; this.pathGoal = null; return; }
    this.setGoal({ x: this.lastKnown.pos.x, z: this.lastKnown.pos.z });
    const more = this.moveAlongPath(dt);
    if (!more && Math.hypot(this.lastKnown.pos.x - this.pos.x, this.lastKnown.pos.z - this.pos.z) < 2.5) {
      this.lastKnown = null;
      this.state = 'patrol';
      this.pathGoal = null;
    }
  }

  patrol(dt) {
    if (!this.pathGoal || (this.path && this.pathIdx >= this.path.length) || G.time > this.repathAt + 6) {
      // objective: bias toward map middle / enemy side
      const enemySide = this.team === 'CT' ? 1 : -1;
      const objectives = [
        { x: 0, z: 0 }, { x: -22, z: -18 }, { x: 24, z: -18 }, { x: -22, z: 14 }, { x: 22, z: 16 },
        { x: 0, z: 20 * enemySide }, { x: rand(-30, 30), z: rand(-35, 35) },
      ];
      this.setGoal(pick(objectives), true);
    }
    this.moveAlongPath(dt);
    // scan while moving
    if (G.time > this.wanderLook) {
      this.wanderLook = G.time + rand(1.2, 3);
      this._scanOffset = rand(-0.7, 0.7);
    }
    // throw utility on the way in, once per round
    if (!this.utilityThrown && Math.abs(this.pos.z) < 26 && Math.random() < 0.003) {
      const gid = ['smoke', 'flash', 'he'].find((id) => this.weapons.grenades[id] > 0);
      if (gid) {
        this.utilityThrown = true;
        const enemyDir = this.team === 'CT' ? 1 : -1;
        G.grenades.throwAt(this, gid, { x: this.pos.x + rand(-6, 6), z: this.pos.z + enemyDir * rand(12, 20) });
        this.weapons.grenades[gid]--;
      }
    }
    // reload when safe
    const w = this.currentWeapon();
    if (w && w.ammo < w.def.mag * 0.4 && w.reserve > 0 && !this.reloadEnd) G.combat.startReload(this);
    // grab an upgrade if walking past one
    if (!this.weapons.primary) {
      const drop = G.combat.nearestDrop(this, 3.5);
      if (drop && drop.inst.def.class !== 'pistol') G.combat.tryPickup(this);
    }
  }

  update(dt) {
    if (!this.alive) return;
    if (G.game.movementFrozen()) { this.syncMesh(dt); return; }
    if (G.time > this.perceptAt) { this.perceptAt = G.time + 0.12; this.perceive(); }
    if (this.isBlind()) {
      // blind: back up and spray-pray occasionally
      this.applyMove(Math.sin(this.yaw), Math.cos(this.yaw), dt * 0.5);
      if (this.target && Math.random() < 0.05) G.combat.tryFire(this, G.time);
    } else if (this.state === 'engage') this.engage(dt);
    else if (this.state === 'hunt') this.hunt(dt);
    else this.patrol(dt);
    this.physics(dt);
    this.syncMesh(dt);
  }

  resetForRound(spawn, keepGear) {
    super.resetForRound(spawn, keepGear);
    this.state = 'patrol';
    this.target = null;
    this.lastKnown = null;
    this.path = null; this.pathGoal = null;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.scale.set(1, 1, 1);
    this.mesh.visible = true;
    this.crouched = false;
  }
}
