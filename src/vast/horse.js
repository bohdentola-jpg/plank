// The horse: whistle it in from anywhere (H), mount up (E), and the vast
// gets a lot smaller. Same heightfield physics as the player, four-beat
// hoof audio hook, refuses deep water like any sensible animal.

import * as THREE from 'three';
import { clamp } from './noise.js';
import { SEA_LEVEL } from './world.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
function part(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const TROT = 6, GALLOP = 13.5, TURN = 5.5;

export class Horse {
  constructor(scene, world, sfx) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;
    this.state = 'away'; // away | grazing | coming | ridden
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.phase = 0;
    this.speed = 0;
    this._hoofPulse = 0;
    this.onHoof = null;
    this._build();
    this.root.visible = false;
  }

  _build() {
    const BODY = 0x6e4a30, DARK = 0x3a2c20;
    this.root = new THREE.Group();
    const g = this.root;
    g.add(part(new THREE.BoxGeometry(1.65, 0.72, 0.6), BODY, 0, 1.28, 0));
    g.add(part(new THREE.SphereGeometry(0.36, 8, 7), BODY, 0.75, 1.28, 0));
    const neck = part(new THREE.BoxGeometry(0.3, 0.85, 0.32), BODY, 0.95, 1.75, 0);
    neck.rotation.z = -0.55;
    g.add(neck);
    this.head = part(new THREE.BoxGeometry(0.52, 0.26, 0.24), BODY, 1.32, 2.08, 0);
    this.head.add(part(new THREE.BoxGeometry(0.07, 0.16, 0.05), DARK, -0.1, 0.19, 0.07));
    this.head.add(part(new THREE.BoxGeometry(0.07, 0.16, 0.05), DARK, -0.1, 0.19, -0.07));
    g.add(this.head);
    const mane = part(new THREE.BoxGeometry(0.12, 0.7, 0.1), DARK, 0.83, 1.85, 0);
    mane.rotation.z = -0.55;
    g.add(mane);
    this.tail = part(new THREE.ConeGeometry(0.09, 0.75, 6), DARK, -0.85, 1.25, 0);
    this.tail.rotation.z = 0.9;
    g.add(this.tail);
    this.legs = [];
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Group();
      leg.position.set(i < 2 ? 0.62 : -0.62, 1.05, i % 2 ? 0.2 : -0.2);
      leg.add(part(new THREE.CylinderGeometry(0.09, 0.06, 1.05, 6), i % 2 ? BODY : 0x62422b, 0, -0.5, 0));
      leg.add(part(new THREE.BoxGeometry(0.14, 0.09, 0.16), 0x2c2118, 0.02, -1.02, 0));
      this.legs.push(leg);
      g.add(leg);
    }
    // tack
    g.add(part(new THREE.BoxGeometry(0.55, 0.09, 0.68), 0x9e3f3a, 0.05, 1.66, 0)); // blanket
    this.saddle = part(new THREE.BoxGeometry(0.42, 0.14, 0.4), 0x7a4a22, 0.05, 1.76, 0);
    g.add(this.saddle);
    this.scene.add(this.root);
  }

  whistle(px, pz, camYaw) {
    if (this.state === 'ridden') return false;
    // a horse left far behind finds its own way — it just appears nearby
    if (this.state === 'away' || this.distTo(px, pz) > 120) {
      // trot in from just past the fog of the player's back
      const a = camYaw + Math.PI + (Math.random() - 0.5) * 1.2;
      let x = px + Math.sin(a) * 38, z = pz + Math.cos(a) * 38;
      // don't spawn in the sea
      for (let tries = 0; tries < 8 && this.world.heightAt(x, z) < SEA_LEVEL + 0.6; tries++) {
        const b = Math.random() * Math.PI * 2;
        x = px + Math.sin(b) * 30; z = pz + Math.cos(b) * 30;
      }
      this.pos.set(x, this.world.heightAt(x, z), z);
      this.root.visible = true;
    }
    this.state = 'coming';
    return true;
  }

  mount() { this.state = 'ridden'; }
  dismount(px, pz) {
    this.state = 'grazing';
    this.vel.set(0, 0, 0);
    this.speed = 0;
  }

  seatWorld() {
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.heading) * 0.05,
      this.pos.y + 1.85,
      this.pos.z + Math.cos(this.heading) * 0.05
    );
  }

  distTo(px, pz) {
    return this.state === 'away' ? Infinity : Math.hypot(this.pos.x - px, this.pos.z - pz);
  }

  update(dt, inp, camYaw, px, pz) {
    if (this.state === 'away') return;

    let targetSpeed = 0, wantHeading = this.heading;

    if (this.state === 'ridden') {
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const dx = inp.moveX * cos - inp.moveZ * sin;
      const dz = -inp.moveX * sin - inp.moveZ * cos;
      const mag = Math.hypot(dx, dz);
      if (mag > 0.05) {
        wantHeading = Math.atan2(dx, dz);
        targetSpeed = (inp.sprint ? GALLOP : TROT) * Math.min(1, mag);
      }
    } else if (this.state === 'coming') {
      const d = Math.hypot(px - this.pos.x, pz - this.pos.z);
      // failsafe: a horse blocked too long finds its own way off-screen
      this._comingT = (this._comingT || 0) + dt;
      if (this._comingT > 20 && d > 25) {
        for (let tries = 0; tries < 12; tries++) {
          const a = Math.random() * Math.PI * 2;
          const nx2 = px + Math.sin(a) * (24 + Math.random() * 14);
          const nz2 = pz + Math.cos(a) * (24 + Math.random() * 14);
          if (this.world.heightAt(nx2, nz2) > SEA_LEVEL + 0.6 && this.world.slopeAt(nx2, nz2) < 0.8) {
            this.pos.set(nx2, this.world.heightAt(nx2, nz2), nz2);
            break;
          }
        }
        this._comingT = 0;
      }
      if (d > 5.5) {
        wantHeading = Math.atan2(px - this.pos.x, pz - this.pos.z);
        targetSpeed = d > 30 ? GALLOP : TROT;
        if (this._avoidT > 0) wantHeading += this._avoidSign * this._avoidAng; // detouring
      } else { this.state = 'grazing'; this._comingT = 0; }
    } else {
      // grazing: the occasional idle shuffle
      if (Math.random() < dt * 0.06) {
        this.heading += (Math.random() - 0.5) * 1.4;
      }
    }

    // turn toward the desired heading
    let dh = wantHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += clamp(dh, -TURN * dt, TURN * dt);
    // sharp turns bleed speed
    this.speed += (targetSpeed * (1 - Math.abs(dh) * 0.4) - this.speed) * Math.min(1, dt * 3);

    if (this.speed > 0.05) {
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      const nh = this.world.heightAt(nx, nz);
      if (nh > SEA_LEVEL - 0.9 && this.world.slopeAt(nx, nz) < 1.1) {
        this.pos.x = nx; this.pos.z = nz;
        if (this._avoidT > 0) {
          this._avoidT -= dt;
          if (this._avoidT <= 0) this._balk = 0; // detour paid off
        }
      } else if (this.state === 'ridden') {
        this.speed *= 0.6; // balk at deep water / cliff walls; the rider steers
      } else {
        // detour around the obstacle: keep one side, push further off-axis
        // with every consecutive balk until we're walking along (or away
        // from) the wall instead of grinding into it
        if (!(this._avoidT > 0)) this._avoidSign = Math.random() < 0.5 ? 1 : -1;
        this._balk = Math.min(8, (this._balk || 0) + 1);
        this._avoidAng = 1.1 + this._balk * 0.28;
        this._avoidT = 1.2;
        this.speed *= 0.9;
      }
    }
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);

    // pose
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading - Math.PI / 2;
    const runF = clamp(this.speed / GALLOP, 0, 1);
    this.phase += dt * (2 + this.speed * 1.7);
    for (let i = 0; i < 4; i++) {
      const diag = i === 0 || i === 3 ? 1 : -1;
      this.legs[i].rotation.z = Math.sin(this.phase + (diag > 0 ? 0 : Math.PI)) * 0.65 * Math.min(1, runF * 3 + 0.02);
    }
    this.root.position.y += Math.abs(Math.sin(this.phase)) * 0.09 * runF;
    this.root.rotation.z = Math.sin(this.phase) * 0.03 * runF;
    this.head.rotation.z = Math.sin(this.phase * 0.5) * 0.08 * (1 - runF) - runF * 0.15;
    this.tail.rotation.x = Math.sin(this.phase * 0.7) * 0.3;
    if (this.state === 'grazing') {
      this.head.position.y = 2.08 - (Math.sin(this.phase * 0.23) > 0.4 ? 0.55 : 0);
      this.head.rotation.z = this.head.position.y < 2 ? -0.9 : 0;
    } else {
      this.head.position.y = 2.08;
    }

    // hoofbeats
    if (this.speed > 1 && this.onHoof) {
      this._hoofPulse -= dt;
      if (this._hoofPulse <= 0) {
        this.onHoof(runF);
        this._hoofPulse = clamp(0.62 - runF * 0.34, 0.22, 0.62);
      }
    }
  }
}
