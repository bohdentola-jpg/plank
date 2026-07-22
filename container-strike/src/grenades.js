// All six grenades. Smokes are particle clouds whose sprites get pushed by
// HE blasts and punched through by bullets (they drift back afterwards);
// molotov/incendiary fires are area denial that smokes extinguish; flashes
// blind by view angle and line of sight; decoys fake gunfire on the radar.
import * as THREE from './three.js';
import { G } from './state.js';
import { GRENADES, WEAPONS } from './weapons.js';
import { clamp, rand } from './util.js';
import { cloneModel } from './models/index.js';

const GRAV = 12;

let smokeTexCache = null;
function smokeTexture() {
  if (smokeTexCache) return smokeTexCache;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(210,212,208,0.9)');
  g.addColorStop(0.55, 'rgba(190,192,188,0.5)');
  g.addColorStop(1, 'rgba(180,182,178,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  smokeTexCache = new THREE.CanvasTexture(c);
  return smokeTexCache;
}

let fireTexCache = null;
function fireTexture() {
  if (fireTexCache) return fireTexCache;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 40, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.4, 'rgba(255,150,40,0.85)');
  g.addColorStop(1, 'rgba(200,40,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  fireTexCache = new THREE.CanvasTexture(c);
  return fireTexCache;
}

export class GrenadeSystem {
  constructor() {
    this.live = [];    // in-flight grenades
    this.group = new THREE.Group();
    G.scene.add(this.group);
    this._fireId = 1;
  }

  throwFrom(ent, gid, power) {
    const def = GRENADES[gid];
    const eye = ent.eyePos(new THREE.Vector3());
    const dir = ent.isPlayer ? G.camera.getWorldDirection(new THREE.Vector3()) : ent.viewDir(new THREE.Vector3());
    const pos = eye.clone().addScaledVector(dir, 0.4);
    const vel = dir.clone().multiplyScalar(power);
    vel.y += power * 0.12; // slight loft
    vel.addScaledVector(ent.vel, 0.6);
    this.spawn(ent, gid, pos, vel);
    G.audio.registerEvent(ent.pos, 12, 'throw');
  }

  // Bot helper: throw toward a world point with a lobbed arc.
  throwAt(ent, gid, target) {
    const eye = ent.eyePos(new THREE.Vector3());
    const to = new THREE.Vector3(target.x - eye.x, 0, target.z - eye.z);
    const dist = to.length();
    to.normalize();
    const power = clamp(Math.sqrt(dist * GRAV * 0.6), 6, 18);
    const vel = to.multiplyScalar(power);
    vel.y = power * 0.55;
    this.spawn(ent, gid, eye.clone().addScaledVector(to, 0.4), vel);
  }

  spawn(owner, gid, pos, vel) {
    const def = GRENADES[gid];
    const model = cloneModel(gid, 'pistol');
    model.group.scale.setScalar(1.4);
    model.group.position.copy(pos);
    this.group.add(model.group);
    this.live.push({
      gid, def, owner, pos: pos.clone(), vel: vel.clone(), mesh: model.group,
      born: G.time, bounced: 0, restTime: 0,
    });
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const n = this.live[i];
      n.vel.y -= GRAV * dt;
      const speed = n.vel.length();
      const prev = n.pos.clone();
      const res = G.world.moveEntity(n.pos, n.vel, dt, 0.07, 0.14, false);
      // detect bounce: velocity got zeroed on an axis by collision
      const moved = n.pos.distanceTo(prev);
      if (res.hitWall || (res.grounded && speed > 2.5 && n.vel.y === 0)) {
        if (speed > 2) {
          // reflect-ish: damp and randomize slightly
          n.vel.multiplyScalar(0.45);
          if (res.grounded) n.vel.y = speed * 0.25;
          n.bounced++;
          G.audio.bounce(n.pos);
        }
      }
      if (res.grounded && speed < 2.5) { n.vel.x *= 0.8; n.vel.z *= 0.8; }
      n.mesh.position.copy(n.pos);
      n.mesh.rotation.x += dt * speed * 2;
      n.mesh.rotation.y += dt * speed * 1.3;

      const age = G.time - n.born;
      const resting = res.grounded && speed < 0.8;
      let boom = false;
      if (n.gid === 'he' || n.gid === 'flash') boom = age > n.def.fuse;
      else if (n.gid === 'smoke') boom = (resting && age > n.def.fuse) || age > 4;
      else if (n.gid === 'molotov' || n.gid === 'incendiary') boom = (n.bounced > 0 && age > 0.5) || resting || age > n.def.fuse + 1.5;
      else if (n.gid === 'decoy') boom = resting || age > 4;
      if (boom) {
        this.group.remove(n.mesh);
        this.live.splice(i, 1);
        this.detonate(n);
      }
    }
    this.updateSmokes(dt);
    this.updateFires(dt);
    this.updateDecoys(dt);
    this.updateFlash(dt);
  }

  detonate(n) {
    switch (n.gid) {
      case 'he': this.explodeHE(n); break;
      case 'flash': this.explodeFlash(n); break;
      case 'smoke': this.popSmoke(n); break;
      case 'molotov': case 'incendiary': this.igniteFire(n); break;
      case 'decoy': this.startDecoy(n); break;
    }
  }

  // ------------------------------------------------------------------- HE
  explodeHE(n) {
    G.audio.explosion(n.pos);
    // flash sphere + light
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.95 }));
    flash.position.copy(n.pos);
    this.group.add(flash);
    const light = new THREE.PointLight(0xffaa44, 30, 26);
    light.position.copy(n.pos);
    this.group.add(light);
    let t = 0;
    const tick = () => {
      t += 1 / 60;
      flash.scale.setScalar(1 + t * 22);
      flash.material.opacity = Math.max(0, 0.95 - t * 3.2);
      light.intensity = Math.max(0, 30 - t * 130);
      if (t < 0.35) requestAnimationFrame(tick);
      else { this.group.remove(flash); this.group.remove(light); }
    };
    tick();
    G.combat.particleBurst(n.pos, 0x775533, 20, 8);
    // damage with LOS falloff
    for (const ent of [G.player, ...G.bots]) {
      if (!ent.alive) continue;
      const center = new THREE.Vector3(ent.pos.x, ent.pos.y + 1, ent.pos.z);
      const d = center.distanceTo(n.pos);
      if (d > n.def.radius) continue;
      let dmg = n.def.damage * (1 - d / n.def.radius);
      if (G.world.lineBlocked(n.pos, center)) dmg *= 0.3;
      if (ent.armor > 0) { dmg *= 0.6; ent.armor = Math.max(0, ent.armor - dmg * 0.3); }
      if (ent.team === n.owner.team && ent !== n.owner) continue; // FF off
      dmg = Math.round(dmg);
      if (dmg <= 0) continue;
      ent.health -= dmg;
      ent.tagUntil = G.time + 0.4; ent.tagFactor = 0.7;
      if (ent.isPlayer) { G.hud.onPlayerDamaged(null, dmg); G.audio.takeDamage(); }
      if (ent.health <= 0) { ent.health = 0; G.combat.kill(ent, n.owner, GRENADES.he, false); }
    }
    // displace nearby smokes
    for (const s of G.smokes) {
      if (s.center.distanceTo(n.pos) < s.r + 6) this.displaceSmoke(s, n.pos, 7);
    }
    // extinguish nothing; HE doesn't kill fires
  }

  // ---------------------------------------------------------------- flash
  explodeFlash(n) {
    const def = n.def;
    for (const ent of [G.player, ...G.bots]) {
      if (!ent.alive) continue;
      const eye = ent.eyePos(new THREE.Vector3());
      const d = eye.distanceTo(n.pos);
      if (d > def.radius) continue;
      if (G.world.lineBlocked(n.pos, eye)) continue;
      const toFlash = n.pos.clone().sub(eye).normalize();
      const look = ent.isPlayer ? G.camera.getWorldDirection(new THREE.Vector3()) : ent.viewDir(new THREE.Vector3());
      const facing = look.dot(toFlash); // 1 looking straight at it
      const distF = 1 - d / def.radius;
      let amount = distF * (0.35 + 0.65 * clamp((facing + 0.4) / 1.4, 0, 1));
      if (amount <= 0.08) continue;
      const dur = 0.6 + amount * 3.4;
      ent.flashedUntil = Math.max(ent.flashedUntil, G.time + dur);
      if (ent.isPlayer) {
        G.hud.flash(amount);
        G.audio.flashBang(n.pos, amount);
      }
    }
    if (!G.player.alive || G.player.eyePos(new THREE.Vector3()).distanceTo(n.pos) > def.radius) {
      G.audio.flashBang(n.pos, 0);
    }
  }

  // ---------------------------------------------------------------- smoke
  popSmoke(n) {
    G.audio.smokePop(n.pos);
    const def = n.def;
    const center = n.pos.clone();
    center.y = Math.max(center.y, 0.2);
    const sprites = [];
    const tex = smokeTexture();
    const count = 42;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(mat);
      const off = new THREE.Vector3(rand(-1, 1), rand(0, 1.1), rand(-1, 1)).normalize()
        .multiplyScalar(def.radius * Math.cbrt(Math.random()) * 0.9);
      off.y = Math.abs(off.y) * 0.75;
      s.position.copy(center).add(off);
      s.scale.setScalar(rand(2.2, 3.6));
      this.group.add(s);
      sprites.push({
        sprite: s, home: s.position.clone(), disp: new THREE.Vector3(),
        phase: rand(0, Math.PI * 2), holePunch: 0,
      });
    }
    const smoke = { center, r: def.radius, sprites, born: G.time, duration: def.duration, dead: false };
    G.smokes.push(smoke);
    // smokes extinguish fires they land on
    for (const f of [...G.fires]) {
      if (Math.hypot(f.center.x - center.x, f.center.z - center.z) < f.r + def.radius * 0.7) this.killFire(f);
    }
  }

  displaceSmoke(smoke, from, strength) {
    for (const p of smoke.sprites) {
      const away = p.sprite.position.clone().sub(from);
      const d = away.length();
      if (d > 8) continue;
      away.normalize().multiplyScalar(strength * Math.max(0, 1 - d / 8));
      p.disp.add(away);
    }
  }

  bulletThroughSmoke(origin, dir, dist) {
    for (const smoke of G.smokes) {
      const toC = smoke.center.clone().sub(origin);
      const along = toC.dot(dir);
      if (along < 0 || along > dist) continue;
      const closest = origin.clone().addScaledVector(dir, along);
      if (closest.distanceTo(smoke.center) > smoke.r + 1) continue;
      // punch nearby sprites away from the bullet line briefly
      for (const p of smoke.sprites) {
        const toP = p.sprite.position.clone().sub(origin);
        const a = toP.dot(dir);
        if (a < 0 || a > dist) continue;
        const linePt = origin.clone().addScaledVector(dir, a);
        const away = p.sprite.position.clone().sub(linePt);
        const d = away.length();
        if (d < 1.1) {
          away.normalize().multiplyScalar((1.1 - d) * 1.6);
          p.disp.add(away);
          p.holePunch = Math.max(p.holePunch, 0.5);
        }
      }
    }
  }

  updateSmokes(dt) {
    for (let i = G.smokes.length - 1; i >= 0; i--) {
      const s = G.smokes[i];
      const age = G.time - s.born;
      const fadeIn = clamp(age / 0.7, 0, 1);
      const fadeOut = clamp((s.duration - age) / 2.2, 0, 1);
      const alpha = 0.92 * fadeIn * fadeOut;
      for (const p of s.sprites) {
        p.disp.multiplyScalar(Math.max(0, 1 - dt * 1.6)); // drift back
        p.holePunch = Math.max(0, p.holePunch - dt * 1.4);
        const sway = Math.sin(G.time * 0.5 + p.phase) * 0.15;
        p.sprite.position.set(
          p.home.x + p.disp.x + sway,
          p.home.y + p.disp.y + Math.cos(G.time * 0.4 + p.phase) * 0.1,
          p.home.z + p.disp.z + sway * 0.7
        );
        p.sprite.material.opacity = alpha * (1 - p.holePunch);
      }
      if (age > s.duration) {
        for (const p of s.sprites) this.group.remove(p.sprite);
        G.smokes.splice(i, 1);
      }
    }
  }

  // Does the segment a->b pass through active smoke? (bot vision)
  smokeBlocks(a, b) {
    for (const s of G.smokes) {
      if (G.time - s.born < 0.5) continue;
      const ab = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
      const len = ab.length();
      if (len < 1e-6) continue;
      ab.divideScalar(len);
      const toC = new THREE.Vector3(s.center.x - a.x, s.center.y - a.y, s.center.z - a.z);
      const along = clamp(toC.dot(ab), 0, len);
      const closest = new THREE.Vector3(a.x, a.y, a.z).addScaledVector(ab, along);
      if (closest.distanceTo(s.center) < s.r * 0.85) return true;
    }
    return false;
  }

  // ----------------------------------------------------------------- fire
  igniteFire(n) {
    G.audio.fireIgnite(n.pos);
    const def = n.def;
    const center = n.pos.clone(); center.y = Math.max(0.05, center.y - 0.1);
    const tex = fireTexture();
    const sprites = [];
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      const a = Math.random() * Math.PI * 2, r = def.radius * Math.sqrt(Math.random());
      s.position.set(center.x + Math.cos(a) * r, center.y + 0.3, center.z + Math.sin(a) * r);
      s.scale.setScalar(rand(0.5, 1.1));
      this.group.add(s);
      sprites.push({ sprite: s, base: s.position.clone(), phase: rand(0, 7), speed: rand(2, 4) });
    }
    const light = new THREE.PointLight(0xff7722, 6, def.radius * 4);
    light.position.set(center.x, center.y + 0.8, center.z);
    this.group.add(light);
    const id = this._fireId++;
    const fire = { id, gid: n.gid, center, r: def.radius, sprites, light, born: G.time, duration: def.duration, dps: def.dps, owner: n.owner, nextTick: 0 };
    G.fires.push(fire);
    G.audio.startFireLoop(id, center);
  }

  killFire(f) {
    const i = G.fires.indexOf(f);
    if (i < 0) return;
    for (const s of f.sprites) this.group.remove(s.sprite);
    this.group.remove(f.light);
    G.audio.stopFireLoop(f.id);
    G.fires.splice(i, 1);
  }

  updateFires(dt) {
    for (let i = G.fires.length - 1; i >= 0; i--) {
      const f = G.fires[i];
      const age = G.time - f.born;
      if (age > f.duration) { this.killFire(f); continue; }
      const fade = clamp((f.duration - age) / 1.2, 0, 1) * clamp(age / 0.4, 0, 1);
      for (const s of f.sprites) {
        const flick = 0.6 + 0.4 * Math.sin(G.time * s.speed * 3 + s.phase);
        s.sprite.material.opacity = 0.85 * fade * flick;
        s.sprite.position.y = s.base.y + Math.sin(G.time * s.speed + s.phase) * 0.18 + 0.1;
        s.sprite.scale.setScalar((0.6 + 0.5 * flick) * fade + 0.2);
      }
      f.light.intensity = (4 + Math.sin(G.time * 11 + f.id) * 1.5) * fade;
      // damage ticks
      if (G.time > f.nextTick) {
        f.nextTick = G.time + 0.25;
        for (const ent of [G.player, ...G.bots]) {
          if (!ent.alive) continue;
          if (ent.pos.y > f.center.y + 2.2) continue;
          if (Math.hypot(ent.pos.x - f.center.x, ent.pos.z - f.center.z) > f.r) continue;
          const dmg = Math.round(f.dps * 0.25);
          ent.health -= dmg;
          ent.tagUntil = G.time + 0.3; ent.tagFactor = 0.85;
          if (ent.isPlayer) { G.hud.onPlayerDamaged(null, dmg); }
          if (ent.health <= 0) {
            ent.health = 0;
            G.combat.kill(ent, f.owner, GRENADES[f.gid], false);
          } else if (!ent.isPlayer) {
            ent.onBurned && ent.onBurned(f);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- decoy
  startDecoy(n) {
    const weaponId = n.owner.weapons.primary ? n.owner.weapons.primary.id : n.owner.weapons.secondary.id;
    const model = cloneModel('decoy', 'pistol');
    model.group.position.copy(n.pos);
    this.group.add(model.group);
    G.decoys = G.decoys || [];
    G.decoys.push({
      pos: n.pos.clone(), mesh: model.group, born: G.time, owner: n.owner,
      weapon: WEAPONS[weaponId] || WEAPONS.ak47, next: G.time + rand(0.3, 1),
      duration: GRENADES.decoy.duration,
    });
  }

  updateDecoys(dt) {
    if (!G.decoys) return;
    for (let i = G.decoys.length - 1; i >= 0; i--) {
      const d = G.decoys[i];
      const age = G.time - d.born;
      if (age > d.duration) {
        // small pop at the end
        G.audio.explosion(d.pos);
        this.group.remove(d.mesh);
        G.decoys.splice(i, 1);
        continue;
      }
      if (G.time > d.next) {
        d.next = G.time + rand(0.25, 1.4);
        G.audio.decoyShot(d.pos, d.weapon);
        d.fakeBlip = G.time; // radar shows it as an enemy-ish blip
      }
    }
  }

  // ---------------------------------------------------------------- flash overlay
  updateFlash(dt) {
    const p = G.player;
    const f = p.blindFactor();
    G.hud.setFlashOpacity(f > 0 ? Math.min(1, f * 1.4) : 0);
  }

  clearAll() {
    for (const n of this.live) this.group.remove(n.mesh);
    this.live.length = 0;
    for (const s of G.smokes) for (const p of s.sprites) this.group.remove(p.sprite);
    G.smokes.length = 0;
    for (const f of [...G.fires]) this.killFire(f);
    if (G.decoys) { for (const d of G.decoys) this.group.remove(d.mesh); G.decoys.length = 0; }
  }
}
