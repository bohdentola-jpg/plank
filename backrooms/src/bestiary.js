// THE BESTIARY — what lives here, how it hunts, and what it looks like.
//
// Each species is one record: how fast it is, what senses it has, what wakes it
// up, what it does when it reaches you, and a model builder. entities.js runs
// the state machine; this file is the personality. The behaviour flags are the
// interesting part — a hound that cannot see and a mannequin that only moves
// when unobserved come out of the same twelve lines of AI.

import * as THREE from 'three';
import { simple } from './textures.js';
import { rng } from './util.js';

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
const cyl = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 7) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  m.position.set(x, y, z);
  return m;
};
const sph = (r, mat, x = 0, y = 0, z = 0, seg = 8) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat);
  m.position.set(x, y, z);
  return m;
};

// Creature materials are per-species (a few instances only) so they can pulse,
// go translucent, or catch the flashlight differently.
const skin = (color, opts = {}) => simple(color, { rough: 0.72, ...opts });
const wetSkin = (color) => simple(color, { rough: 0.28, metal: 0.05 });
const shadow = (color = 0x05050a) => simple(color, { rough: 1, bake: false });
const teeth = () => simple(0xe8e2d0, { rough: 0.4 });
const eyeGlow = (c = 0xffe090) => simple(c, { emissive: c, emissiveIntensity: 2.2, rough: 0.3, bake: false });

// A humanoid frame every biped species dresses differently. Returns the group
// plus the parts entities.js animates (head, arms, legs).
function biped(opts = {}) {
  const m = opts.mat || skin(0x8a7f72);
  const h = opts.height ?? 1.85;
  const s = h / 1.85;
  const g = new THREE.Group();
  const hips = box(0.34 * s, 0.26 * s, 0.2 * s, m, 0, 0.92 * s, 0);
  const torso = box(0.4 * s, 0.62 * s, 0.24 * s, m, 0, 1.32 * s, 0);
  const neck = cyl(0.06 * s, 0.06 * s, 0.12 * s, m, 0, 1.68 * s, 0, 6);
  const head = opts.head ? opts.head(m, s) : sph(0.13 * s, m, 0, 1.8 * s, 0);
  const armL = box(0.1 * s, 0.66 * s, 0.1 * s, m, -0.26 * s, 1.28 * s, 0);
  const armR = box(0.1 * s, 0.66 * s, 0.1 * s, m, 0.26 * s, 1.28 * s, 0);
  const legL = box(0.13 * s, 0.86 * s, 0.13 * s, m, -0.11 * s, 0.44 * s, 0);
  const legR = box(0.13 * s, 0.86 * s, 0.13 * s, m, 0.11 * s, 0.44 * s, 0);
  g.add(hips, torso, neck, head, armL, armR, legL, legR);
  g.userData.parts = { head, torso, armL, armR, legL, legR, scale: s };
  return g;
}

// ------------------------------------------------------------------ species
export const SPECIES = {
  // ---------------------------------------------------------------- hound
  hound: {
    name: 'HOUND',
    note: 'Blind. Hunts what it hears. Never alone for long.',
    speed: 5.6, walk: 1.9, hp: 60, damage: 34, radius: 0.45, height: 1.1,
    senses: { sight: 0, hearing: 34, fov: 0, smell: 12 },
    aggro: { lose: 9, patience: 7 },
    flags: { pack: true, sprints: true, blind: true, opensDoors: false },
    sound: { idle: 'houndBreath', alert: 'houndBark', attack: 'houndSnarl', step: 'clawStep' },
    model() {
      const m = skin(0x6a5348, { rough: 0.85 });
      const g = new THREE.Group();
      const body = box(0.44, 0.44, 1.15, m, 0, 0.66, 0);
      const chest = box(0.5, 0.5, 0.4, m, 0, 0.7, 0.5);
      const neck = cyl(0.14, 0.16, 0.34, m, 0, 0.82, 0.72, 6);
      neck.rotation.x = 0.5;
      const head = new THREE.Group();
      head.position.set(0, 0.9, 0.92);
      const skull = box(0.26, 0.24, 0.42, m, 0, 0, 0.06);
      const jaw = box(0.2, 0.1, 0.34, m, 0, -0.12, 0.14);
      for (let i = 0; i < 5; i++) {
        jaw.add(box(0.03, 0.09, 0.03, teeth(), -0.07 + i * 0.035, 0.08, 0.1 - i * 0.02));
        skull.add(box(0.03, 0.09, 0.03, teeth(), -0.07 + i * 0.035, -0.1, 0.12 - i * 0.02));
      }
      head.add(skull, jaw);
      const legs = [];
      for (const [x, z] of [[-0.2, 0.44], [0.2, 0.44], [-0.2, -0.42], [0.2, -0.42]]) {
        const l = box(0.11, 0.62, 0.12, m, x, 0.31, z);
        legs.push(l);
        g.add(l);
      }
      const tail = cyl(0.05, 0.02, 0.6, m, 0, 0.72, -0.7, 5);
      tail.rotation.x = -0.9;
      g.add(body, chest, neck, head, tail);
      g.userData.parts = { head, jaw, legs, tail, quad: true, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- smiler
  smiler: {
    name: 'SMILER',
    note: 'Only the grin is visible. Light stops it. Darkness does not.',
    speed: 6.4, walk: 0, hp: 9999, damage: 100, radius: 0.5, height: 2.0,
    senses: { sight: 26, hearing: 14, fov: 3.14 },
    aggro: { lose: 30, patience: 999 },
    flags: { freezeWhenLit: true, needsDark: true, silent: true, invulnerable: true },
    sound: { idle: 'smilerHum', alert: 'smilerShriek', attack: 'smilerShriek' },
    model() {
      const g = new THREE.Group();
      const body = sph(0.55, shadow(0x02020a), 0, 1.2, 0, 8);
      body.scale.set(0.8, 1.7, 0.6);
      const face = new THREE.Group();
      face.position.set(0, 1.72, 0.22);
      // two eyes and a very wide row of teeth, floating in the dark
      face.add(sph(0.055, eyeGlow(0xf6f2d8), -0.16, 0.1, 0, 6));
      face.add(sph(0.055, eyeGlow(0xf6f2d8), 0.16, 0.1, 0, 6));
      for (let i = 0; i < 11; i++) {
        const t = box(0.045, 0.075, 0.02, eyeGlow(0xf8f4e0), -0.25 + i * 0.05, -0.08 - Math.cos((i / 10) * Math.PI) * 0.03, 0);
        face.add(t);
      }
      g.add(body, face);
      g.userData.parts = { head: face, body, grin: face, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- faceling
  faceling: {
    name: 'FACELING',
    note: 'Wanders. Ignores you. Do not keep looking at it.',
    speed: 2.2, walk: 1.2, hp: 80, damage: 18, radius: 0.4, height: 1.9,
    senses: { sight: 18, hearing: 10, fov: 2.4 },
    aggro: { lose: 6, patience: 5 },
    flags: { punishesStaring: true, wanders: true },
    sound: { idle: 'facelingBreath', alert: 'facelingClick', attack: 'facelingScream' },
    model() {
      return biped({
        mat: skin(0xcfc4b4, { rough: 0.6 }),
        height: 1.9,
        head: (m, s) => {
          const h = sph(0.135 * s, m, 0, 1.8 * s, 0);
          h.scale.set(0.9, 1.1, 0.9);
          return h;   // no features at all. That's the point.
        },
      });
    },
  },

  // ---------------------------------------------------------------- skinstealer
  skinstealer: {
    name: 'SKIN-STEALER',
    note: 'Wears someone who did not make it. The proportions are close.',
    speed: 4.6, walk: 1.4, hp: 90, damage: 40, radius: 0.42, height: 1.95,
    senses: { sight: 30, hearing: 18, fov: 1.8 },
    aggro: { lose: 14, patience: 20 },
    flags: { mimics: true, stalks: true, opensDoors: true, keepsDistance: 8 },
    sound: { idle: 'stealerHello', alert: 'stealerWrong', attack: 'stealerTear' },
    model() {
      const g = biped({ mat: skin(0xb8a898, { rough: 0.5 }), height: 1.95 });
      const p = g.userData.parts;
      // the give-away: the arms are a little too long and the smile never moves
      p.armL.scale.y = 1.25;
      p.armR.scale.y = 1.25;
      p.armL.position.y -= 0.08;
      p.armR.position.y -= 0.08;
      const mouth = box(0.11, 0.02, 0.02, simple(0x3a1a1a, { rough: 0.6 }), 0, 1.76, 0.12);
      g.add(mouth);
      p.mouth = mouth;
      return g;
    },
  },

  // ---------------------------------------------------------------- clump
  clump: {
    name: 'CLUMP',
    note: 'Several people, once. It fills the corridor and it is in no hurry.',
    speed: 1.5, walk: 0.9, hp: 220, damage: 26, radius: 0.95, height: 2.1,
    senses: { sight: 12, hearing: 22, fov: 6.28 },
    aggro: { lose: 20, patience: 60 },
    flags: { blocksCorridor: true, contactDamage: true, slow: true },
    sound: { idle: 'clumpWet', alert: 'clumpMoan', attack: 'clumpGrab' },
    model() {
      const m = wetSkin(0x7a4a44);
      const g = new THREE.Group();
      const R = rng(17);
      const core = sph(0.8, m, 0, 1.0, 0, 9);
      core.scale.set(1.1, 0.95, 1.05);
      g.add(core);
      const limbs = [];
      for (let i = 0; i < 12; i++) {
        const a = R() * Math.PI * 2;
        const l = box(0.11, 0.7 + R() * 0.5, 0.11, m, Math.cos(a) * 0.7, 0.7 + R() * 0.9, Math.sin(a) * 0.7);
        l.rotation.set((R() - 0.5) * 1.6, a, (R() - 0.5) * 1.6);
        limbs.push(l);
        g.add(l);
      }
      for (let i = 0; i < 3; i++) {
        const h = sph(0.16, m, (R() - 0.5) * 0.9, 1.2 + R() * 0.6, (R() - 0.5) * 0.9, 7);
        g.add(h);
      }
      g.userData.parts = { limbs, body: core, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- deathmoth
  deathmoth: {
    name: 'DEATH MOTH',
    note: 'Goes to light. Yours counts. In numbers they take the warmth with them.',
    speed: 3.4, walk: 2.2, hp: 22, damage: 8, radius: 0.35, height: 1.5,
    senses: { sight: 22, hearing: 6, fov: 4 },
    aggro: { lose: 8, patience: 30 },
    flags: { flies: true, seeksLight: true, swarm: true },
    sound: { idle: 'mothFlutter', alert: 'mothFlutter', attack: 'mothBite' },
    model() {
      const m = skin(0x5a4a3a, { rough: 0.9 });
      const g = new THREE.Group();
      const body = cyl(0.09, 0.05, 0.6, m, 0, 1.4, 0, 6);
      body.rotation.x = Math.PI / 2;
      const wingM = simple(0x8a7a5a, { rough: 0.85, opacity: 0.8, side: THREE.DoubleSide });
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), wingM);
      wL.position.set(-0.4, 1.42, 0);
      const wR = wL.clone();
      wR.position.x = 0.4;
      const head = sph(0.075, m, 0, 1.44, 0.3, 6);
      head.add(sph(0.028, eyeGlow(0xff6060), -0.05, 0.02, 0.04, 5));
      head.add(sph(0.028, eyeGlow(0xff6060), 0.05, 0.02, 0.04, 5));
      g.add(body, wL, wR, head);
      g.userData.parts = { head, wings: [wL, wR], flies: true, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- partygoer
  partygoer: {
    name: 'PARTYGOER',
    note: 'Very happy you came. Runs. Laughs the whole way.',
    speed: 6.0, walk: 2.6, hp: 45, damage: 30, radius: 0.38, height: 1.75,
    senses: { sight: 24, hearing: 30, fov: 2.6 },
    aggro: { lose: 12, patience: 40 },
    flags: { sprints: true, pack: true, hearsFun: true },
    sound: { idle: 'partyGiggle', alert: 'partyShriek', attack: 'partyBite' },
    model() {
      const g = biped({ mat: skin(0xc8a0a8, { rough: 0.55 }), height: 1.75 });
      const p = g.userData.parts;
      const hat = cyl(0, 0.11, 0.26, simple(0xe84a7a, { rough: 0.6 }), 0, 2.0, 0, 7);
      const grin = box(0.14, 0.03, 0.02, teeth(), 0, 1.72, 0.12);
      g.add(hat, grin);
      p.hat = hat;
      return g;
    },
  },

  // ---------------------------------------------------------------- bacteria
  bacteria: {
    name: 'BACTERIA',
    note: 'Not an animal. Still eats.',
    speed: 0, walk: 0, hp: 40, damage: 12, radius: 1.2, height: 0.6,
    senses: { sight: 0, hearing: 0, fov: 0 },
    aggro: { lose: 0, patience: 0 },
    flags: { static: true, contactDamage: true, spreads: true },
    sound: { idle: 'bacteriaHiss', alert: 'bacteriaHiss', attack: 'bacteriaBurn' },
    model() {
      const m = simple(0x6a7a2a, { rough: 0.8, emissive: 0x1a2408, emissiveIntensity: 0.8 });
      const g = new THREE.Group();
      const R = rng(23);
      for (let i = 0; i < 8; i++) {
        const d = sph(0.3 + R() * 0.5, m, (R() - 0.5) * 2, 0.05 + R() * 0.2, (R() - 0.5) * 2, 7);
        d.scale.y = 0.25 + R() * 0.3;
        g.add(d);
      }
      g.userData.parts = { pulse: g.children, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- windows
  windows: {
    name: 'THE ONE IN THE GLASS',
    note: 'It is in the window. It is not behind you. Check anyway.',
    speed: 0, walk: 0, hp: 9999, damage: 0, radius: 0.4, height: 1.9,
    senses: { sight: 40, hearing: 0, fov: 6.28 },
    aggro: { lose: 0, patience: 0 },
    flags: { inGlass: true, teleports: true, harmless: true, invulnerable: true },
    sound: { idle: 'glassTick', alert: 'glassKnock', attack: 'glassKnock' },
    model() {
      const g = biped({ mat: shadow(0x0a0a10), height: 1.9 });
      const p = g.userData.parts;
      p.head.add(sph(0.03, eyeGlow(0xd8f0ff), -0.05, 0.02, 0.1, 5));
      p.head.add(sph(0.03, eyeGlow(0xd8f0ff), 0.05, 0.02, 0.1, 5));
      return g;
    },
  },

  // ---------------------------------------------------------------- wretch
  wretch: {
    name: 'WRETCH',
    note: 'Swims. Waits at the edge of the deep end where the tile drops away.',
    speed: 4.2, walk: 1.0, hp: 70, damage: 36, radius: 0.42, height: 1.7,
    senses: { sight: 14, hearing: 26, fov: 3.2 },
    aggro: { lose: 10, patience: 25 },
    flags: { swims: true, needsWater: true, pullsUnder: true },
    sound: { idle: 'wretchGurgle', alert: 'wretchSurface', attack: 'wretchPull' },
    model() {
      const m = wetSkin(0x4a6a68);
      const g = biped({ mat: m, height: 1.7 });
      const p = g.userData.parts;
      p.head.scale.set(0.85, 1.25, 0.85);
      p.head.add(sph(0.026, eyeGlow(0x90ffe0), -0.045, 0.03, 0.1, 5));
      p.head.add(sph(0.026, eyeGlow(0x90ffe0), 0.045, 0.03, 0.1, 5));
      // long hands for the pulling
      p.armL.scale.y = 1.3;
      p.armR.scale.y = 1.3;
      return g;
    },
  },

  // ---------------------------------------------------------------- howler
  howler: {
    name: 'HOWLER',
    note: 'Weak. Loud. Tells everything else exactly where you are.',
    speed: 3.6, walk: 1.6, hp: 25, damage: 10, radius: 0.36, height: 1.6,
    senses: { sight: 20, hearing: 30, fov: 3.0 },
    aggro: { lose: 14, patience: 12 },
    flags: { screams: true, cowardly: true },
    sound: { idle: 'howlerWheeze', alert: 'howlerScream', attack: 'howlerScream' },
    model() {
      const g = biped({ mat: skin(0x9a8a6a, { rough: 0.8 }), height: 1.6 });
      const p = g.userData.parts;
      // most of it is mouth
      const maw = sph(0.1, simple(0x2a1010, { rough: 0.5 }), 0, 1.66, 0.1, 7);
      maw.scale.set(1, 1.6, 0.8);
      g.add(maw);
      p.maw = maw;
      return g;
    },
  },

  // ---------------------------------------------------------------- crawler
  crawler: {
    name: 'CRAWLER',
    note: 'Lives above the tiles. Comes down head first.',
    speed: 5.0, walk: 1.4, hp: 50, damage: 28, radius: 0.4, height: 0.9,
    senses: { sight: 16, hearing: 24, fov: 4.2 },
    aggro: { lose: 10, patience: 30 },
    flags: { ceiling: true, ambush: true, sprints: true },
    sound: { idle: 'crawlerScrape', alert: 'crawlerChitter', attack: 'crawlerBite' },
    model() {
      const m = skin(0x50403a, { rough: 0.85 });
      const g = new THREE.Group();
      const body = box(0.34, 0.26, 0.9, m, 0, 0.4, 0);
      const head = sph(0.15, m, 0, 0.42, 0.52, 7);
      head.add(sph(0.025, eyeGlow(0xffd060), -0.06, 0.04, 0.1, 5));
      head.add(sph(0.025, eyeGlow(0xffd060), 0.06, 0.04, 0.1, 5));
      const legs = [];
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const l = box(0.06, 0.5, 0.06, m, side * 0.22, 0.34, -0.3 + Math.floor(i / 2) * 0.32);
        l.rotation.z = side * 0.6;
        legs.push(l);
        g.add(l);
      }
      g.add(body, head);
      g.userData.parts = { head, legs, quad: true, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- mannequin
  mannequin: {
    name: 'MANNEQUIN',
    note: 'It has not moved. It is closer.',
    speed: 7.5, walk: 0, hp: 9999, damage: 45, radius: 0.4, height: 1.9,
    senses: { sight: 60, hearing: 0, fov: 6.28 },
    aggro: { lose: 999, patience: 999 },
    flags: { movesWhenUnobserved: true, invulnerable: true, silent: true },
    sound: { idle: 'none', alert: 'mannequinScrape', attack: 'mannequinStrike' },
    model() {
      const g = biped({ mat: simple(0xd8cfc0, { rough: 0.5 }), height: 1.9 });
      const p = g.userData.parts;
      p.head.scale.set(0.9, 1.05, 0.9);
      p.armL.rotation.x = -0.3;
      p.armR.rotation.x = -0.3;
      return g;
    },
  },

  // ---------------------------------------------------------------- nurse
  nurse: {
    name: 'THE NURSE',
    note: 'Walks. Never stops walking. Carries her own light.',
    speed: 2.4, walk: 2.4, hp: 9999, damage: 55, radius: 0.42, height: 1.95,
    senses: { sight: 22, hearing: 30, fov: 2.2 },
    aggro: { lose: 60, patience: 999 },
    flags: { relentless: true, carriesLight: true, invulnerable: true, opensDoors: true },
    sound: { idle: 'nurseHeels', alert: 'nurseSigh', attack: 'nurseCut' },
    model() {
      const g = biped({ mat: simple(0xdce4e0, { rough: 0.6 }), height: 1.95 });
      const p = g.userData.parts;
      const apron = box(0.42, 0.7, 0.06, simple(0xc8d0cc, { rough: 0.8 }), 0, 1.2, 0.14);
      const cap = box(0.2, 0.08, 0.16, simple(0xf0f4f0, { rough: 0.7 }), 0, 1.92, 0);
      const lamp = sph(0.07, eyeGlow(0xffe0a0), 0.3, 0.9, 0.18, 6);
      g.add(apron, cap, lamp);
      p.lamp = lamp;
      return g;
    },
  },

  // ---------------------------------------------------------------- leviathan
  leviathan: {
    name: 'SOMETHING LARGE',
    note: 'You will not see all of it. Get out of the water.',
    speed: 6.5, walk: 3.0, hp: 9999, damage: 200, radius: 2.4, height: 3.0,
    senses: { sight: 20, hearing: 45, fov: 6.28 },
    aggro: { lose: 40, patience: 999 },
    flags: { swims: true, needsDeep: true, invulnerable: true, huge: true },
    sound: { idle: 'levDeep', alert: 'levRush', attack: 'levTake' },
    model() {
      const m = wetSkin(0x1a2a30);
      const g = new THREE.Group();
      const body = sph(1.6, m, 0, 0, 0, 10);
      body.scale.set(0.7, 0.6, 3.2);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), m);
      fin.position.set(0, 1.0, -0.6);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.0, 5), m);
      tail.position.set(0, 0, -4.4);
      tail.rotation.x = -Math.PI / 2;
      g.add(body, fin, tail);
      g.userData.parts = { body, fin, tail, swims: true, scale: 1 };
      return g;
    },
  },

  // ---------------------------------------------------------------- watcher
  watcher: {
    name: 'WATCHER',
    note: 'Stands at the far end. Does nothing. Is unbearable.',
    speed: 0, walk: 0, hp: 9999, damage: 0, radius: 0.4, height: 2.2,
    senses: { sight: 60, hearing: 0, fov: 6.28 },
    aggro: { lose: 0, patience: 0 },
    flags: { vanishesWhenClose: true, harmless: true, invulnerable: true, silent: true },
    sound: { idle: 'none', alert: 'watcherGone', attack: 'none' },
    model() {
      const g = biped({ mat: shadow(0x08080e), height: 2.2 });
      const p = g.userData.parts;
      p.armL.rotation.x = 0;
      p.armR.rotation.x = 0;
      p.head.add(sph(0.022, eyeGlow(0xfff0d0), -0.05, 0.02, 0.11, 5));
      p.head.add(sph(0.022, eyeGlow(0xfff0d0), 0.05, 0.02, 0.11, 5));
      return g;
    },
  },

  // ---------------------------------------------------------------- duller
  duller: {
    name: 'DULLER',
    note: 'Was a person for a while. Walks toward noise out of habit.',
    speed: 1.9, walk: 1.0, hp: 55, damage: 14, radius: 0.4, height: 1.8,
    senses: { sight: 14, hearing: 20, fov: 2.8 },
    aggro: { lose: 12, patience: 25 },
    flags: { crowd: true, shambles: true },
    sound: { idle: 'dullerShuffle', alert: 'dullerMoan', attack: 'dullerGrab' },
    model() {
      const g = biped({ mat: skin(0x8a8272, { rough: 0.9 }), height: 1.8 });
      const p = g.userData.parts;
      p.head.rotation.x = 0.35;
      p.armL.rotation.x = 0.4;
      p.armR.rotation.x = 0.5;
      return g;
    },
  },

  // ---------------------------------------------------------------- shepherd
  shepherd: {
    name: 'SHEPHERD',
    note: 'Hums. Points at the way out, and is right every time. Walks the whole while.',
    speed: 2.2, walk: 2.2, hp: 9999, damage: 99, radius: 0.45, height: 2.4,
    senses: { sight: 30, hearing: 20, fov: 6.28 },
    aggro: { lose: 30, patience: 60 },
    flags: { invulnerable: true, pointsTheWay: true, relentless: true },
    sound: { idle: 'shepherdHum', alert: 'shepherdHum', attack: 'none' },
    model() {
      const g = new THREE.Group();
      const m = simple(0xd8d0b8, { rough: 0.85, emissive: 0x201c10, emissiveIntensity: 0.5 });
      const robe = cyl(0.34, 0.62, 2.0, m, 0, 1.0, 0, 10);
      const hood = sph(0.24, m, 0, 2.06, 0, 8);
      hood.scale.set(1, 1.15, 1);
      const dark = sph(0.16, shadow(0x0a0a0a), 0, 2.02, 0.1, 7);
      const arm = box(0.1, 0.7, 0.1, m, 0.3, 1.5, 0.2);
      arm.rotation.x = -1.1;
      g.add(robe, hood, dark, arm);
      g.userData.parts = { head: hood, arm, scale: 1 };
      return g;
    },
  },
};

// Instantiate a species model. Kept out of SPECIES so a level can place fifty
// dullers and still only pay for fifty small groups.
export function buildCreature(type) {
  const s = SPECIES[type];
  if (!s) throw new Error(`no species "${type}"`);
  const g = s.model();
  g.userData.species = type;
  return g;
}

export const SPECIES_NAMES = Object.keys(SPECIES);
