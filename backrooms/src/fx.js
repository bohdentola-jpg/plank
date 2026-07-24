// THE SCARES — twenty-two scripted one-shots, plus the runtime that plays them.
//
// A scare is a short timeline written against a small set of verbs: put a shape
// in the corridor for a third of a second, chew the tape, kill the lights, whip
// the camera, breathe on the microphone. None of them damage the player. They
// exist to make you stop walking, which is when the things that *do* damage you
// catch up.
//
// The rule the whole file obeys: never fire two scares within eight seconds, and
// never fire one while an entity is already hunting. Dread is a resource.

import * as THREE from 'three';
import { buildCreature } from './bestiary.js';
import { clamp01, damp } from './util.js';

// ------------------------------------------------------------------ scripts
// Each script gets `ctx` — the verbs below — and describes what happens.
export const SCARE_SCRIPTS = {
  faceInHall: {
    dread: 0.65,
    run(ctx) {
      const p = ctx.aheadOfPlayer(9, 16);
      if (!p) return;
      ctx.apparition('faceling', p.x, p.z, { life: 0.45, faceCamera: true });
      ctx.sfx('stingerLow', 0.5);
      ctx.glitch(0.5, 0.5);
    },
  },
  shadowCross: {
    dread: 0.4,
    run(ctx) {
      const p = ctx.aheadOfPlayer(6, 12);
      if (!p) return;
      ctx.apparition('duller', p.x, p.z, { life: 1.1, walk: ctx.sideways(p, 3.2) });
      ctx.sfx('stepsAway', 0.4);
    },
  },
  lightBurst: {
    dread: 0.7,
    run(ctx) {
      ctx.killNearestLight(1);
      ctx.sfx('glassPop', 0.8);
      ctx.shake(0.5, 0.4);
      ctx.glitch(0.7, 0.35);
      ctx.sparks(ctx.player.x, ctx.player.z);
    },
  },
  lightsOut: {
    dread: 1.0,
    run(ctx) {
      ctx.lightsOut(4.5, 22);
      ctx.sfx('breakerThunk', 0.9);
      ctx.glitch(0.9, 1.2);
      ctx.say('Every tube in the wing goes out at once.');
    },
  },
  doorSlam: {
    dread: 0.5,
    run(ctx) {
      ctx.sfx('doorSlam', 0.9, ctx.behindPlayer(5));
      ctx.shake(0.35, 0.25);
    },
  },
  handFromCeiling: {
    dread: 0.85,
    run(ctx) {
      const b = ctx.behindPlayer(1.4);
      ctx.apparition('crawler', b.x, b.z, { life: 0.7, fromCeiling: true });
      ctx.sfx('tileCrack', 0.8);
      ctx.whip(0.6);
      ctx.glitch(0.8, 0.6);
    },
  },
  crawlerDrop: {
    dread: 0.9,
    run(ctx) {
      const p = ctx.aheadOfPlayer(4, 8);
      if (!p) return;
      ctx.apparition('crawler', p.x, p.z, { life: 1.4, fromCeiling: true, walk: ctx.away(p, 5) });
      ctx.sfx('tileCrack', 1);
      ctx.shake(0.6, 0.5);
    },
  },
  facePressWindow: {
    dread: 0.8,
    run(ctx) {
      const g = ctx.nearestGlass(6);
      const at = g || ctx.besidePlayer(1.2);
      ctx.apparition('windows', at.x, at.z, { life: 1.0, faceCamera: true });
      ctx.sfx('glassKnock', 0.7);
      ctx.glitch(0.6, 0.5);
    },
  },
  mirrorFigure: {
    dread: 0.75,
    run(ctx) {
      const b = ctx.behindPlayer(2.2);
      ctx.apparition('watcher', b.x, b.z, { life: 0.9, faceCamera: true, tall: 1.15 });
      ctx.sfx('stingerHigh', 0.5);
      ctx.glitch(0.5, 0.8);
    },
  },
  thingBehindYou: {
    dread: 0.95,
    run(ctx) {
      const b = ctx.behindPlayer(2.6);
      ctx.apparition('faceling', b.x, b.z, { life: 0.5, faceCamera: true });
      ctx.whip(1);
      ctx.sfx('stingerHigh', 0.8);
      ctx.glitch(1, 0.7);
    },
  },
  breathing: {
    dread: 0.55,
    run(ctx) {
      ctx.sfx('breathClose', 0.8);
      ctx.grain(0.5, 4);
      ctx.say('That is very close and it is not you.');
    },
  },
  whisper: {
    dread: 0.5,
    run(ctx) {
      ctx.sfx('whisper', 0.7);
      ctx.grain(0.35, 5);
      ctx.say(ctx.scare.text || 'Something says a name that is almost yours.');
    },
  },
  screamDistant: {
    dread: 0.45,
    run(ctx) {
      ctx.sfx('screamFar', 0.6);
      ctx.say('Somebody, a long way off, is having a worse night.');
    },
  },
  footstepsFollow: {
    dread: 0.6,
    run(ctx) {
      ctx.follower(9);
      ctx.say('Footsteps. In time with yours, one beat behind.');
    },
  },
  bodyFall: {
    dread: 0.6,
    run(ctx) {
      ctx.sfx('bodyThud', 0.9, ctx.aheadOfPlayer(5, 9));
      ctx.shake(0.3, 0.3);
    },
  },
  phoneRing: {
    dread: 0.5,
    run(ctx) {
      ctx.ringPhone(14);
      ctx.say('A phone is ringing. It will not stop until you look at it.');
    },
  },
  crowdLaugh: {
    dread: 0.55,
    run(ctx) {
      ctx.sfx('crowdLaugh', 0.6);
      ctx.say('A party, three walls away, enjoying itself very much.');
    },
  },
  floorGiveWay: {
    dread: 0.7,
    run(ctx) {
      ctx.shake(0.9, 0.5);
      ctx.sfx('floorCrack', 0.9);
      ctx.drop(0.25);
      ctx.say('The floor drops an inch and holds.');
    },
  },
  tapeGlitch: {
    dread: 0.45,
    run(ctx) {
      ctx.glitch(1, 1.8);
      ctx.sfx('tapeChew', 0.8);
      ctx.skipTape(1 + Math.random() * 2);
    },
  },
  staticBurst: {
    dread: 0.4,
    run(ctx) {
      ctx.glitch(1, 0.9);
      ctx.grain(1, 2.5);
      ctx.sfx('staticHit', 0.7);
    },
  },
  waterStir: {
    dread: 0.8,
    run(ctx) {
      ctx.sfx('waterHeave', 0.9);
      ctx.ripple(ctx.player.x, ctx.player.z);
      ctx.say('Something the size of a car moves in the water you are standing in.');
    },
  },
  nameOnWall: {
    dread: 0.6,
    run(ctx) {
      ctx.say('The graffiti here is about you. It has today\'s date on it.');
      ctx.grain(0.6, 6);
      ctx.sfx('stingerLow', 0.4);
    },
  },
};

// ------------------------------------------------------------------ runtime
// Owns the apparitions (short-lived creature models with no AI), the tape
// distortion state the camcorder reads, and the cooldown that keeps the game
// from becoming a haunted house.
export class Fx {
  constructor(game) {
    this.game = game;
    this.apparitions = [];
    this.sparks = [];
    this.ripples = [];
    this.cooldown = 0;
    this.fired = new Set();
    this.glitchAmt = 0;
    this.grainAmt = 0;
    this.shakeAmt = 0;
    this.whipAmt = 0;
    this.dropAmt = 0;
    this.blackout = 0;
    this.follow = 0;
    this.ringing = null;
    this.dread = 0;         // slow-moving mood value the audio bed listens to
  }

  // ---------------------------------------------------------------- verbs
  makeCtx(scare) {
    const g = this.game;
    const p = g.player;
    const cellOf = (x, z) => [Math.round(x / g.world.cell), Math.round(z / g.world.cell)];
    const openAt = (cx, cz) => g.world.isOpenCell(cx, cz);
    return {
      scare,
      player: { x: p.pos.x, z: p.pos.z, y: p.pos.y },
      // a point down the corridor the camera is already looking at
      aheadOfPlayer: (min, max) => {
        for (let d = max; d >= min; d -= 1) {
          const x = p.pos.x - Math.sin(p.yaw) * d;
          const z = p.pos.z - Math.cos(p.yaw) * d;
          const [cx, cz] = cellOf(x, z);
          if (openAt(cx, cz) && g.world.sightClear(p.pos.x, p.pos.z, x, z)) return { x, z };
        }
        return null;
      },
      behindPlayer: (d) => ({ x: p.pos.x + Math.sin(p.yaw) * d, z: p.pos.z + Math.cos(p.yaw) * d }),
      besidePlayer: (d) => ({ x: p.pos.x + Math.cos(p.yaw) * d, z: p.pos.z - Math.sin(p.yaw) * d }),
      sideways: (at, len) => ({ x: at.x + Math.cos(p.yaw) * len, z: at.z - Math.sin(p.yaw) * len }),
      away: (at, len) => ({ x: at.x - Math.sin(p.yaw) * len, z: at.z - Math.cos(p.yaw) * len }),
      nearestGlass: (r) => g.world.nearestGlass(p.pos.x, p.pos.z, r),
      apparition: (type, x, z, o) => this.apparition(type, x, z, o),
      sfx: (name, gain, at) => g.audio?.oneShot(name, gain, at),
      say: (text) => g.hud?.subtitle(text),
      glitch: (amt, time) => { this.glitchAmt = Math.max(this.glitchAmt, amt); this.glitchT = time; },
      grain: (amt, time) => { this.grainAmt = Math.max(this.grainAmt, amt); this.grainT = time; },
      shake: (amt) => { this.shakeAmt = Math.max(this.shakeAmt, amt); },
      whip: (amt) => { this.whipAmt = amt; },
      drop: (amt) => { this.dropAmt = amt; },
      lightsOut: (secs, radius) => { this.blackout = secs; g.world.douse(p.pos.x, p.pos.z, radius, secs); },
      killNearestLight: () => g.world.killNearestLight(p.pos.x, p.pos.z),
      sparks: (x, z) => this.spark(x, z),
      ripple: (x, z) => this.ripple(x, z),
      follower: (secs) => { this.follow = secs; },
      ringPhone: (secs) => { this.ringing = { t: secs, x: p.pos.x, z: p.pos.z }; },
      skipTape: (secs) => { g.tapeTime += secs; },
    };
  }

  // Fire a scare record if the mood allows it.
  trigger(scare) {
    if (scare.once && this.fired.has(scare)) return false;
    if (this.cooldown > 0) return false;
    const script = SCARE_SCRIPTS[scare.name];
    if (!script) return false;
    if (this.game.entities?.anyHunting() && script.dread < 0.9) return false;
    this.fired.add(scare);
    this.cooldown = 8 + Math.random() * 5;
    this.dread = Math.min(1, this.dread + script.dread * 0.5);
    script.run(this.makeCtx(scare));
    this.game.audio?.stinger(script.dread);
    return true;
  }

  // ---------------------------------------------------------------- pieces
  apparition(type, x, z, o = {}) {
    const g = this.game;
    const mesh = buildCreature(type);
    const y = g.world.floorAtWorld(x, z);
    mesh.position.set(x, y + (o.fromCeiling ? 2.2 : 0), z);
    if (o.tall) mesh.scale.multiplyScalar(o.tall);
    if (o.fromCeiling) mesh.rotation.x = Math.PI * 0.9;
    g.scene.add(mesh);
    const a = {
      mesh, life: o.life ?? 0.6, age: 0, faceCamera: !!o.faceCamera,
      from: { x, z, y }, to: o.walk || null, fromCeiling: !!o.fromCeiling,
    };
    this.apparitions.push(a);
    return a;
  }

  spark(x, z) {
    const g = this.game;
    const geo = new THREE.BufferGeometry();
    const n = 40;
    const pos = new Float32Array(n * 3);
    const vel = [];
    const y = g.world.ceilAtWorld(x, z) - 0.15;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel.push([(Math.random() - 0.5) * 3, -Math.random() * 2, (Math.random() - 0.5) * 3]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffd070, size: 0.06, transparent: true, depthWrite: false,
    }));
    g.scene.add(pts);
    this.sparks.push({ pts, vel, age: 0, life: 1.1 });
  }

  ripple(x, z) {
    const g = this.game;
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.6, 20),
      new THREE.MeshBasicMaterial({ color: 0xcfeef8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, (g.world.waterY ?? 0) + 0.02, z);
    g.scene.add(m);
    this.ripples.push({ m, age: 0, life: 2.6 });
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.glitchAmt = damp(this.glitchAmt, 0, this.glitchT ? 1.6 / Math.max(0.2, this.glitchT) : 3, dt);
    this.grainAmt = damp(this.grainAmt, 0, this.grainT ? 1.2 / Math.max(0.2, this.grainT) : 2, dt);
    this.shakeAmt = damp(this.shakeAmt, 0, 4.5, dt);
    this.whipAmt = damp(this.whipAmt, 0, 6, dt);
    this.dropAmt = damp(this.dropAmt, 0, 5, dt);
    this.blackout = Math.max(0, this.blackout - dt);
    this.dread = damp(this.dread, 0, 0.12, dt);

    // the follower: footsteps behind you, then nothing
    if (this.follow > 0) {
      this.follow -= dt;
      this.followT = (this.followT || 0) + dt;
      if (this.followT > 0.55) {
        this.followT = 0;
        g.audio?.oneShot('stepBehind', 0.3);
      }
    }
    if (this.ringing) {
      this.ringing.t -= dt;
      this.ringT = (this.ringT || 0) + dt;
      if (this.ringT > 2.2) {
        this.ringT = 0;
        g.audio?.oneShot('phoneRing', 0.45, this.ringing);
      }
      if (this.ringing.t <= 0) this.ringing = null;
    }

    for (let i = this.apparitions.length - 1; i >= 0; i--) {
      const a = this.apparitions[i];
      a.age += dt;
      const t = clamp01(a.age / a.life);
      if (a.to) {
        a.mesh.position.x = a.from.x + (a.to.x - a.from.x) * t;
        a.mesh.position.z = a.from.z + (a.to.z - a.from.z) * t;
        a.mesh.position.y = a.from.y;
        a.mesh.lookAt(a.to.x, a.from.y + 1, a.to.z);
      } else if (a.fromCeiling) {
        a.mesh.position.y = a.from.y + 2.2 - t * 1.4;
      }
      if (a.faceCamera) {
        a.mesh.lookAt(g.camera.position.x, a.mesh.position.y + 1.5, g.camera.position.z);
      }
      // they don't fade out, they're just not there on the next frame
      if (a.age >= a.life) {
        g.scene.remove(a.mesh);
        a.mesh.traverse((o) => o.geometry?.dispose?.());
        this.apparitions.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      const pos = s.pts.geometry.attributes.position;
      for (let k = 0; k < s.vel.length; k++) {
        s.vel[k][1] -= 9 * dt;
        pos.array[k * 3] += s.vel[k][0] * dt;
        pos.array[k * 3 + 1] += s.vel[k][1] * dt;
        pos.array[k * 3 + 2] += s.vel[k][2] * dt;
      }
      pos.needsUpdate = true;
      s.pts.material.opacity = 1 - s.age / s.life;
      if (s.age >= s.life) {
        g.scene.remove(s.pts);
        s.pts.geometry.dispose();
        this.sparks.splice(i, 1);
      }
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const t = r.age / r.life;
      r.m.scale.setScalar(1 + t * 9);
      r.m.material.opacity = 0.6 * (1 - t);
      if (r.age >= r.life) {
        g.scene.remove(r.m);
        r.m.geometry.dispose();
        this.ripples.splice(i, 1);
      }
    }
  }

  reset() {
    for (const a of this.apparitions) this.game.scene.remove(a.mesh);
    for (const s of this.sparks) this.game.scene.remove(s.pts);
    for (const r of this.ripples) this.game.scene.remove(r.m);
    this.apparitions = [];
    this.sparks = [];
    this.ripples = [];
    this.fired = new Set();
    this.glitchAmt = this.grainAmt = this.shakeAmt = this.whipAmt = this.dropAmt = 0;
    this.blackout = 0;
    this.follow = 0;
    this.ringing = null;
    this.dread = 0;
    this.cooldown = 4;
  }
}
