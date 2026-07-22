// Firing, penetration, damage, and the first-person viewmodel.
// Bullets are hitscan: the ray collects every wall-panel crossing and body
// hit in order, spends the weapon's penetration budget on each surface, and
// applies range falloff at the moment of impact.
import * as THREE from './three.js';
import { G } from './state.js';
import { WEAPONS, KNIFE, recoilPattern, computeInaccuracy, killRewardFor } from './weapons.js';
import { raySphere, clamp, lerp, DEG } from './util.js';
import { getModel, cloneModel } from './models/index.js';
import { MATERIALS } from './world.js';

const MAX_RANGE = 300;
const HEAD_R = 0.15;

export class Combat {
  constructor() {
    this.viewModel = new ViewModel();
    this.tracers = [];
    this.impacts = [];
    this.decals = [];
    this.decalGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    G.scene.add(this.decalGroup, this.fxGroup);
    this.muzzleLight = new THREE.PointLight(0xffc860, 0, 9);
    G.scene.add(this.muzzleLight);
    this.grenadeArmed = false;
    this._v1 = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._v3 = new THREE.Vector3();
  }

  // ------------------------------------------------------------- input
  onTriggerDown(ts) {
    const p = G.player;
    if (!p.alive) { p.spectateNext(); return; }
    if (p.slot === 'grenade') {
      if (p.currentGrenadeId() && !this.grenadeArmed) { this.grenadeArmed = true; G.audio.pinPull(); }
      return;
    }
    this.tryFire(p, Math.max(ts, G.time));
  }

  onTriggerUp() {
    const p = G.player;
    if (p.slot === 'grenade' && this.grenadeArmed && p.alive) {
      this.grenadeArmed = false;
      const gid = p.currentGrenadeId();
      if (gid) {
        G.grenades.throwFrom(p, gid, p.mouse2Down ? 7.5 : 17);
        p.weapons.grenades[gid]--;
        this.viewModel.kick(0.5);
        if (!p.currentGrenadeId()) this.switchSlot(p, p.weapons.primary ? 'primary' : 'secondary');
        else this.viewModel.switchTo('grenade:' + p.currentGrenadeId());
      }
    }
  }

  onAltFire() {
    const p = G.player;
    if (!p.alive) return;
    const def = p.currentDef();
    if (p.slot === 'knife') { this.knifeAttack(p, true); return; }
    if (def && def.zoom) {
      p.scoped = !p.scoped;
      p.zoomLevel = p.scoped ? 1 : 0;
      G.audio.ui('click');
    }
  }

  onKeyPress(code) {
    const p = G.player;
    if (!G.started || !p.alive || G.paused) return;
    if (code === 'Digit1' && p.weapons.primary) this.switchSlot(p, 'primary');
    else if (code === 'Digit2') this.switchSlot(p, 'secondary');
    else if (code === 'Digit3') this.switchSlot(p, 'knife');
    else if (code === 'Digit4') {
      if (p.slot === 'grenade') { p.grenadeSel++; const g = p.currentGrenadeId(); if (g) this.viewModel.switchTo('grenade:' + g); }
      else if (p.currentGrenadeId()) this.switchSlot(p, 'grenade');
    }
    else if (code === 'KeyR') this.startReload(p);
    else if (code === 'KeyE') this.tryPickup(p);
    else if (code === 'KeyG') this.playerDrop();
  }

  cycleSlot(dir) {
    const p = G.player;
    if (!p.alive) return;
    const slots = ['primary', 'secondary', 'knife'];
    if (p.currentGrenadeId()) slots.push('grenade');
    const avail = slots.filter((s) => s !== 'primary' || p.weapons.primary);
    let i = avail.indexOf(p.slot);
    i = (i + dir + avail.length) % avail.length;
    this.switchSlot(p, avail[i]);
  }

  switchSlot(ent, slot) {
    if (ent.slot === slot) return;
    if (slot === 'primary' && !ent.weapons.primary) return;
    ent.slot = slot;
    ent.reloadEnd = 0;
    ent.reloadShell = false;
    ent.scoped = false;
    ent.drawEnd = G.time + (slot === 'knife' ? 0.25 : 0.45);
    ent.recoilIndex = 0;
    if (ent.isPlayer) {
      this.grenadeArmed = false;
      let vm = slot;
      if (slot === 'primary' || slot === 'secondary') vm = ent.currentWeapon().id;
      if (slot === 'grenade') vm = 'grenade:' + ent.currentGrenadeId();
      this.viewModel.switchTo(vm);
      G.audio.drawWeapon();
      G.hud.refreshWeapon();
    }
  }

  // ------------------------------------------------------------- reload
  startReload(ent) {
    const w = ent.currentWeapon();
    if (!w || ent.reloadEnd > G.time || !ent.alive) return;
    if (w.ammo >= w.def.mag || w.reserve <= 0) return;
    ent.scoped = false;
    if (w.def.shellReload) {
      ent.reloadShell = true;
      ent.reloadEnd = G.time + 0.6 + w.def.reloadTime;
      G.audio.boltCycle(ent.isPlayer ? null : ent.pos, ent.isPlayer);
    } else {
      ent.reloadEnd = G.time + w.def.reloadTime;
      G.audio.reload(w.def, ent.isPlayer ? null : ent.pos, ent.isPlayer);
    }
    if (ent.isPlayer) G.hud.refreshWeapon();
  }

  updateReload(ent) {
    const w = ent.currentWeapon();
    if (!w || !ent.reloadEnd || G.time < ent.reloadEnd) return;
    if (ent.reloadShell) {
      const take = Math.min(1, w.reserve, w.def.mag - w.ammo);
      w.ammo += take; w.reserve -= take;
      if (w.ammo < w.def.mag && w.reserve > 0) {
        ent.reloadEnd = G.time + w.def.reloadTime;
        G.audio.boltCycle(ent.isPlayer ? null : ent.pos, ent.isPlayer);
      } else { ent.reloadEnd = 0; ent.reloadShell = false; }
    } else {
      const take = Math.min(w.reserve, w.def.mag - w.ammo);
      w.ammo += take; w.reserve -= take;
      ent.reloadEnd = 0;
    }
    if (ent.isPlayer) G.hud.refreshWeapon();
  }

  // ------------------------------------------------------------- firing
  tryFire(ent, now) {
    if (!ent.alive || (G.game && !G.game.canFight())) return false;
    if (ent.slot === 'knife') { this.knifeAttack(ent, false); return true; }
    if (ent.slot === 'grenade') return false;
    const w = ent.currentWeapon();
    if (!w) return false;
    const def = w.def;
    if (now < ent.nextFireTime || now < ent.drawEnd) return false;
    if (ent.reloadEnd > G.time) {
      if (ent.reloadShell && w.ammo > 0) { ent.reloadEnd = 0; ent.reloadShell = false; } // pump interrupt
      else return false;
    }
    if (w.ammo <= 0) {
      if (ent.isPlayer) { G.audio.dryFire(); this.startReload(ent); }
      else this.startReload(ent);
      ent.nextFireTime = now + 0.25;
      return false;
    }
    ent.nextFireTime = now + 60 / def.rpm;
    w.ammo--;
    ent.lastShotTime = G.time;

    // deterministic recoil: advance through the fixed pattern
    const pat = recoilPattern(def.id);
    const idx = Math.min(Math.floor(ent.recoilIndex), pat.length - 1);
    const kick = pat[idx];
    ent.recoilIndex = Math.min(pat.length - 1, ent.recoilIndex + 1);
    if (ent.isPlayer) {
      ent.viewPunch.x += kick.y;
      ent.viewPunch.y += kick.x;
    }
    ent.fireInacc += Math.max(-0.4, def.inacc.fire);

    // spread
    const speed = Math.hypot(ent.vel.x, ent.vel.z);
    // fireInacc may be negative (Negev settles into a laser while spraying)
    const inacc = Math.max(0.012 * DEG, computeInaccuracy(def, {
      speed, maxSpeed: def.moveSpeed, grounded: ent.grounded,
      crouched: ent.crouched, fireInacc: ent.fireInacc, scoped: ent.scoped,
    }));

    const eye = ent.eyePos(this._v1);
    const dir = ent.isPlayer ? G.camera.getWorldDirection(this._v2) : ent.viewDir(this._v2);
    const pellets = def.pellets || 1;
    const baseSpread = (def.spread || 0) * DEG;
    for (let i = 0; i < pellets; i++) {
      const d = this._spreadDir(dir, inacc + (pellets > 1 ? baseSpread : 0));
      this.traceShot(ent, def, eye, d);
    }

    // audio + fx
    G.audio.shot(def, ent.pos, ent.isPlayer);
    if (ent.isPlayer) {
      this.viewModel.kick(def.class === 'sniper' || def.class === 'shotgun' ? 1.6 : 1);
      this.viewModel.slideKick();
      this.muzzleFlash(this.viewModel.muzzleWorld());
      if (def.boltAction) { ent.scoped = false; G.audio.boltCycle(null, true); }
      G.hud.refreshWeapon();
      if (w.ammo === 0) this.startReload(ent);
    } else {
      const mz = this._v3.copy(dir).multiplyScalar(0.6).add(eye);
      this.muzzleFlash(mz);
      if (ent.gunFlash) ent.gunFlash();
    }
    return true;
  }

  _spreadDir(dir, angle) {
    // sample a cone: gaussian-ish radial falloff
    const r = angle * Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const d = new THREE.Vector3().copy(dir);
    const up = Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(d, up).normalize();
    const t2 = new THREE.Vector3().crossVectors(d, t1);
    d.addScaledVector(t1, Math.cos(theta) * Math.tan(r)).addScaledVector(t2, Math.sin(theta) * Math.tan(r));
    return d.normalize();
  }

  traceShot(shooter, def, origin, dir) {
    // collect world surface crossings
    const worldHits = G.world.raycast(origin, dir, MAX_RANGE);
    // collect body hits
    const bodies = [];
    for (const ent of [G.player, ...G.bots]) {
      if (!ent.alive || ent === shooter) continue;
      const hit = this._hitEntity(ent, origin, dir);
      if (hit) bodies.push(hit);
    }
    bodies.sort((a, b) => a.t - b.t);

    let penBudget = def.penPower;
    let dmgMult = 1;
    let bodyIdx = 0, wallIdx = 0;
    let lastT = 0;
    let tracerEnd = null;
    let guard = 0;
    while (guard++ < 12) {
      const body = bodies[bodyIdx];
      const wall = worldHits[wallIdx];
      if (!body && !wall) { tracerEnd = origin.clone().addScaledVector(dir, MAX_RANGE); break; }
      if (body && (!wall || body.t < wall.t)) {
        bodyIdx++;
        if (body.ent.team === shooter.team && body.ent !== shooter) { // FF off: bullets stop, no damage
          tracerEnd = origin.clone().addScaledVector(dir, body.t);
          break;
        }
        const falloff = Math.pow(def.rangeMod, body.t / 15);
        const dmg = def.damage * falloff * dmgMult;
        const point = origin.clone().addScaledVector(dir, body.t);
        this.bloodFX(point);
        this.applyDamage(body.ent, dmg, shooter, def, body.head, dir);
        tracerEnd = point;
        break; // bullets stop in bodies
      }
      // wall crossing
      wallIdx++;
      if (wall.material === MATERIALS.ground || wall.material === MATERIALS.concrete) {
        const p = origin.clone().addScaledVector(dir, wall.t);
        this.impactFX(p, wall, dir);
        tracerEnd = p;
        break;
      }
      const thickness = Math.max(0.02, wall.tExit - wall.t);
      const cost = wall.material.penCost * (0.5 + thickness * 2.2);
      const p = origin.clone().addScaledVector(dir, wall.t);
      this.impactFX(p, wall, dir);
      if (cost > penBudget) { tracerEnd = p; break; }
      penBudget -= cost;
      dmgMult *= wall.material.dmgMult;
      lastT = wall.tExit;
      // exit puff
      this.impactFX(origin.clone().addScaledVector(dir, wall.tExit + 0.01), wall, dir, true);
    }
    if (tracerEnd && !def.suppressed) this.spawnTracer(shooter, origin, tracerEnd);
    // smoke displacement from bullets
    G.grenades.bulletThroughSmoke(origin, dir, tracerEnd ? origin.distanceTo(tracerEnd) : MAX_RANGE);
    // near-miss whiz for the player
    if (shooter !== G.player && G.player.alive && shooter.team !== G.player.team) {
      const eye = G.player.eyePos(new THREE.Vector3());
      const toP = eye.clone().sub(origin);
      const along = toP.dot(dir);
      if (along > 0) {
        const perp = toP.sub(dir.clone().multiplyScalar(along)).length();
        if (perp < 1.2) G.audio.bulletWhiz(eye);
      }
    }
  }

  _hitEntity(ent, origin, dir) {
    // head sphere first
    const eh = ent.pos.y + ent.eyeHeight + 0.07;
    const tHead = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, ent.pos.x, eh, ent.pos.z, HEAD_R);
    // body box
    const r = 0.34;
    const min = { x: ent.pos.x - r, y: ent.pos.y, z: ent.pos.z - r };
    const max = { x: ent.pos.x + r, y: ent.pos.y + ent.eyeHeight + 0.02, z: ent.pos.z + r };
    let tBody = -1;
    const hit = rayBox(origin, dir, min, max);
    if (hit !== null && hit >= 0) tBody = hit;
    if (tHead >= 0 && (tBody < 0 || tHead <= tBody + 0.01)) return { ent, t: tHead, head: true };
    if (tBody >= 0) return { ent, t: tBody, head: false };
    return null;
  }

  applyDamage(target, rawDmg, attacker, def, headshot, dir) {
    if (!target.alive) return 0;
    let dmg = rawDmg;
    const pen = def.armorPen !== undefined ? def.armorPen : 1;
    if (headshot) {
      dmg *= def.headshotMult || 4;
      if (target.helmet) { dmg *= pen; target.helmet = target.armor > 0; }
    } else if (target.armor > 0) {
      const before = dmg;
      dmg *= pen;
      target.armor = Math.max(0, Math.round(target.armor - (before - dmg) * 0.5 - 1));
    }
    dmg = Math.round(dmg);
    target.health -= dmg;
    // tagging: getting hit slows you
    target.tagFactor = def.class === 'sniper' ? 0.4 : 0.6;
    target.tagUntil = G.time + 0.5;
    if (target.isPlayer) {
      G.hud.onPlayerDamaged(dir, dmg);
      G.audio.takeDamage();
    }
    if (attacker === G.player && target !== G.player) G.audio.hitConfirm();
    if (target.health <= 0) {
      target.health = 0;
      this.kill(target, attacker, def, headshot);
    } else if (!target.isPlayer) {
      target.onDamaged && target.onDamaged(attacker);
    }
    return dmg;
  }

  kill(victim, attacker, def, headshot) {
    victim.alive = false;
    victim.deaths++;
    victim.scoped = false;
    if (attacker && attacker !== victim) {
      if (attacker.team === victim.team) attacker.kills--;
      else {
        attacker.kills++;
        attacker.money = Math.min(16000, attacker.money + killRewardFor(def.id));
      }
    } else if (attacker === victim) victim.kills--;
    // drop the best gun
    const drop = victim.weapons.primary || victim.weapons.secondary;
    if (drop) this.spawnDrop(drop, victim.pos.clone().add(new THREE.Vector3(0, 0.4, 0)));
    victim.weapons.primary = null;
    if (victim.isPlayer) {
      G.hud.refreshAll();
      victim.spectating = null;
    } else victim.onDeath && victim.onDeath();
    G.game.onKill(attacker, victim, def, headshot);
  }

  knifeAttack(ent, heavy) {
    const now = G.time;
    if (now < ent.nextFireTime || now < ent.drawEnd || !ent.alive) return;
    ent.nextFireTime = now + (heavy ? 1.0 : 0.45);
    if (ent.isPlayer) this.viewModel.knifeSwing(heavy);
    G.audio.shot(KNIFE, ent.pos, ent.isPlayer);
    const eye = ent.eyePos(this._v1);
    const dir = ent.isPlayer ? G.camera.getWorldDirection(this._v2) : ent.viewDir(this._v2);
    let best = null;
    for (const t of [G.player, ...G.bots]) {
      if (!t.alive || t === ent || t.team === ent.team) continue;
      const to = this._v3.set(t.pos.x - eye.x, (t.pos.y + 1) - eye.y, t.pos.z - eye.z);
      const dist = to.length();
      if (dist > KNIFE.range) continue;
      if (to.normalize().dot(dir) < 0.55) continue;
      if (G.world.lineBlocked(eye, { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z })) continue;
      if (!best || dist < best.dist) best = { t, dist };
    }
    if (best) {
      const victim = best.t;
      const facing = victim.viewDir(new THREE.Vector3());
      const backstab = facing.dot(dir) > 0.45; // both looking same way = attack from behind
      let dmg = heavy ? 65 : 40;
      if (backstab && heavy) dmg = 180;
      else if (backstab) dmg *= 2;
      this.bloodFX(new THREE.Vector3(victim.pos.x, victim.pos.y + 1.2, victim.pos.z));
      this.applyDamage(victim, dmg, ent, KNIFE, false, dir);
    }
  }

  // ------------------------------------------------------------- pickups
  spawnDrop(weaponInst, pos) {
    const model = cloneModel(weaponInst.id, weaponInst.def.class);
    model.group.position.copy(pos);
    model.group.position.y = Math.max(0.06, pos.y - 0.3);
    model.group.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2 * 0.9);
    G.scene.add(model.group);
    G.drops.push({ inst: weaponInst, group: model.group, pos: model.group.position });
  }

  clearDrops() {
    for (const d of G.drops) G.scene.remove(d.group);
    G.drops.length = 0;
  }

  nearestDrop(ent, maxDist = 1.8) {
    let best = null;
    for (const d of G.drops) {
      const dist = Math.hypot(d.pos.x - ent.pos.x, d.pos.z - ent.pos.z);
      if (dist < maxDist && (!best || dist < best.dist)) best = { d, dist };
    }
    return best && best.d;
  }

  tryPickup(ent) {
    const d = this.nearestDrop(ent);
    if (!d) return;
    const slot = d.inst.def.class === 'pistol' ? 'secondary' : 'primary';
    const old = ent.weapons[slot];
    ent.weapons[slot] = d.inst;
    G.scene.remove(d.group);
    G.drops.splice(G.drops.indexOf(d), 1);
    if (old) this.spawnDrop(old, ent.pos.clone().add(new THREE.Vector3(0, 0.4, 0)));
    G.audio.pickup(ent.pos, ent.isPlayer);
    if (ent.isPlayer) { this.switchSlot(ent, slot); if (ent.slot === slot) { this.viewModel.switchTo(d.inst.id); } G.hud.refreshAll(); }
  }

  playerDrop() {
    const p = G.player;
    const w = p.currentWeapon();
    if (!w) return;
    p.weapons[p.slot] = null;
    const dir = G.camera.getWorldDirection(this._v2);
    this.spawnDrop(w, p.eyePos(new THREE.Vector3()).addScaledVector(dir, 0.8));
    G.audio.pickup(p.pos, true);
    this.switchSlot(p, p.weapons.primary ? 'primary' : (p.weapons.secondary ? 'secondary' : 'knife'));
    G.hud.refreshAll();
  }

  // ------------------------------------------------------------- effects
  muzzleFlash(pos) {
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = 14;
  }

  spawnTracer(shooter, from, to) {
    const start = shooter.isPlayer
      ? this.viewModel.muzzleWorld()
      : from.clone().addScaledVector(to.clone().sub(from).normalize(), 0.7);
    const geo = new THREE.BufferGeometry().setFromPoints([start, to]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.fxGroup.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  impactFX(pos, wall, dir, isExit = false) {
    const matName = wall.material.name;
    if (!isExit) G.audio.bulletImpact(pos, matName);
    const color = matName === 'metal' ? 0xffcf70 : matName === 'wood' ? 0x9a7040 : 0xb0aca0;
    this.particleBurst(pos, color, isExit ? 4 : 7, 2.2);
    if (!isExit && this.decals.length < 220) {
      const dec = new THREE.Mesh(
        new THREE.CircleGeometry(0.028, 8),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 })
      );
      dec.position.set(pos.x + wall.nx * 0.01, pos.y + wall.ny * 0.01, pos.z + wall.nz * 0.01);
      dec.lookAt(pos.x + wall.nx, pos.y + wall.ny, pos.z + wall.nz);
      this.decalGroup.add(dec);
      this.decals.push(dec);
    }
  }

  bloodFX(pos) { this.particleBurst(pos, 0x8a1010, 10, 2.6); }

  particleBurst(pos, color, count, speed) {
    if (this.impacts.length > 60) return;
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      vels.push(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.9, (Math.random() - 0.5)).normalize().multiplyScalar(speed * (0.4 + Math.random())));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.95 });
    const pts = new THREE.Points(geo, mat);
    this.fxGroup.add(pts);
    this.impacts.push({ pts, vels, life: 0.35, maxLife: 0.35 });
  }

  clearRoundFX() {
    for (const t of this.tracers) this.fxGroup.remove(t.line);
    this.tracers.length = 0;
    for (const i of this.impacts) this.fxGroup.remove(i.pts);
    this.impacts.length = 0;
  }

  clearDecals() {
    for (const d of this.decals) this.decalGroup.remove(d);
    this.decals.length = 0;
  }

  // ------------------------------------------------------------- update
  update(dt) {
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 260);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
      if (t.life <= 0) { this.fxGroup.remove(t.line); this.tracers.splice(i, 1); }
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const im = this.impacts[i];
      im.life -= dt;
      const posAttr = im.pts.geometry.attributes.position;
      for (let j = 0; j < im.vels.length; j++) {
        im.vels[j].y -= 9 * dt;
        posAttr.array[j * 3] += im.vels[j].x * dt;
        posAttr.array[j * 3 + 1] += im.vels[j].y * dt;
        posAttr.array[j * 3 + 2] += im.vels[j].z * dt;
      }
      posAttr.needsUpdate = true;
      im.pts.material.opacity = Math.max(0, im.life / im.maxLife);
      if (im.life <= 0) { this.fxGroup.remove(im.pts); this.impacts.splice(i, 1); }
    }
    // drops bob gently
    for (const d of G.drops) d.group.rotation.y += dt * 0.8;
    this.updateReload(G.player);
    for (const b of G.bots) this.updateReload(b);
    this.viewModel.update(dt);
    // pickup hint
    if (G.player.alive) {
      const d = this.nearestDrop(G.player);
      G.hud.showPickupHint(d ? d.inst.def.name : null);
    }
  }
}

function rayBox(origin, dir, min, max) {
  let tMin = -Infinity, tMax = Infinity;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const lo = [min.x, min.y, min.z], hi = [max.x, max.y, max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
      continue;
    }
    let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (tMax < 0) return null;
  return Math.max(0, tMin);
}

// ---------------------------------------------------------------------------
// First-person viewmodel: holds the current weapon model under the camera and
// animates draw, sway, bob, recoil kick, slide/bolt, reloads and knife swings.
// ---------------------------------------------------------------------------
class ViewModel {
  constructor() {
    this.root = new THREE.Group();
    G.camera.add(this.root);
    this.root.position.set(0.26, -0.25, -0.42);
    this.current = null;
    this.currentKey = null;
    this.drawT = 0;
    this.kickT = 0; this.kickAmt = 0;
    this.slideT = 0;
    this.swingT = 0;
    this.lastYaw = 0; this.lastPitch = 0;
    this.swayX = 0; this.swayY = 0;
  }

  switchTo(key) {
    if (this.currentKey === key) return;
    this.currentKey = key;
    if (this.current) this.root.remove(this.current.group);
    let id = key;
    if (key.startsWith('grenade:')) id = key.split(':')[1];
    const model = getModel(id, WEAPONS[id] ? WEAPONS[id].class : 'pistol');
    // viewmodel uses the master model (parts animate); world clones elsewhere
    this.current = model;
    this.root.add(model.group);
    model.group.position.set(0, 0, 0);
    model.group.rotation.set(0, 0, 0);
    this.drawT = 0.35;
    this._restoreParts();
  }

  _restoreParts() {
    const p = this.current && this.current.parts;
    if (!p) return;
    for (const k of Object.keys(p)) {
      const part = p[k];
      if (part && part.userData.homePos === undefined) {
        part.userData.homePos = part.position.clone();
      } else if (part) part.position.copy(part.userData.homePos);
    }
  }

  kick(amt) { this.kickT = 0.09; this.kickAmt = amt; }
  slideKick() { this.slideT = 0.09; }
  knifeSwing(heavy) { this.swingT = heavy ? 0.3 : 0.2; }

  muzzleWorld() {
    if (!this.current) return G.camera.position.clone();
    return this.current.group.localToWorld(this.current.muzzle.clone());
  }

  update(dt) {
    if (!this.current) return;
    const p = G.player;
    const g = this.root;
    const hide = (p.scoped && (p.currentDef()?.zoom || 0) >= 3) || !p.alive;
    g.visible = !hide && G.started;
    if (hide) return;

    this.drawT = Math.max(0, this.drawT - dt);
    this.kickT = Math.max(0, this.kickT - dt);
    this.slideT = Math.max(0, this.slideT - dt);
    this.swingT = Math.max(0, this.swingT - dt);

    // sway from view movement
    const dy = p.yaw - this.lastYaw, dp = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    this.swayX = lerp(this.swayX, clamp(-dy * 2.2, -0.05, 0.05), Math.min(1, dt * 10));
    this.swayY = lerp(this.swayY, clamp(-dp * 2.2, -0.04, 0.04), Math.min(1, dt * 10));

    const speed = Math.hypot(p.vel.x, p.vel.z);
    const bobA = Math.min(1, speed / 4.3) * (p.grounded ? 1 : 0.2);
    const bx = Math.sin(p.bobPhase) * 0.008 * bobA;
    const by = -Math.abs(Math.cos(p.bobPhase)) * 0.006 * bobA;

    const draw = this.drawT > 0 ? this.drawT / 0.35 : 0;
    const kick = this.kickT > 0 ? (this.kickT / 0.09) * this.kickAmt : 0;

    let reloadDip = 0, reloadRot = 0;
    const w = p.currentWeapon();
    if (w && p.reloadEnd > G.time) {
      const total = p.reloadShell ? w.def.reloadTime : w.def.reloadTime;
      const remain = p.reloadEnd - G.time;
      const t = clamp(1 - remain / total, 0, 1);
      const env = Math.sin(t * Math.PI);
      reloadDip = env * 0.06;
      reloadRot = env * 0.5;
      const mag = this.current.parts.magazine;
      if (mag && mag.userData.homePos) {
        const magT = clamp((t - 0.15) / 0.5, 0, 1);
        const out = Math.sin(magT * Math.PI);
        mag.position.copy(mag.userData.homePos);
        mag.position.y -= out * 0.13;
        mag.position.z += out * 0.03;
      }
    } else {
      const mag = this.current.parts.magazine;
      if (mag && mag.userData.homePos) mag.position.copy(mag.userData.homePos);
    }

    // slide/bolt animation
    const slide = this.current.parts.slide || this.current.parts.bolt;
    if (slide && slide.userData.homePos) {
      slide.position.copy(slide.userData.homePos);
      if (this.slideT > 0) slide.position.z += Math.sin((this.slideT / 0.09) * Math.PI) * 0.035;
    }

    // knife swing
    let swingRot = 0, swingX = 0;
    if (this.swingT > 0) {
      const st = this.swingT / 0.25;
      swingRot = Math.sin(st * Math.PI) * 1.1;
      swingX = -Math.sin(st * Math.PI) * 0.12;
    }

    g.position.set(
      0.26 + bx + this.swayX + swingX,
      -0.25 + by + this.swayY - draw * 0.25 - reloadDip,
      -0.42 + kick * 0.05
    );
    g.rotation.set(
      kick * 0.06 + draw * 0.9 + reloadRot * 0.35 - swingRot * 0.5,
      this.swayX * 1.6 + swingRot * 0.35,
      this.swayY * 0.6
    );
  }
}
