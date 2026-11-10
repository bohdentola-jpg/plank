// QA view: line up character models to eyeball them.  ?gallery[=team|foes|town|anim]
import * as THREE from 'three';
import { G, Mode } from '../core/game.js';
import { Character, SPECIES, buildFootball } from '../art/characters.js';
import { lightRig, toon, M, plane } from '../art/kit.js';
import { CAST } from '../data/cast.js';
import { el } from '../core/util.js';

const UNI = { jersey: 0xf08a24, pants: 0xfff4dc, trim: 0xffd45a, helmet: { color: 0x3b2148, stripe: 0xffd45a } };

export class Gallery extends Mode {
  enter(params) {
    const q = new URLSearchParams(location.search);
    const set = params.set || q.get('gallery') || 'team';
    this.rig = lightRig(this.scene, q.get('sky') || 'day', { fog: null });
    const ground = M(plane(80, 80), toon(0x86b860), 0, 0, 0, { rx: -Math.PI / 2 });
    this.scene.add(ground);
    this.chars = [];
    let specs = [];
    if (set === 'team') {
      specs = Object.entries(CAST).map(([id, c]) => [c.name, { ...c.spec, ...UNI, number: c.number, helmet: c.spec.kind === 'ghost' ? null : UNI.helmet }]);
    } else if (set === 'foes') {
      const foe = (jersey, helmet, stripe) => ({ jersey, pants: 0xf4f0e6, helmet: { color: helmet, stripe } });
      specs = [
        ['gnome', { kind: 'gnome', build: 'small', shirt: 0x3f6fb5, helmet: { color: 0xc8452d, stripe: 0xfff4dc }, shoes: 0x3a2a2e }],
        ['gnome big', { kind: 'gnome', build: 'big', shirt: 0x4f8a4a, helmet: { color: 0x2a6f77, stripe: 0xffd45a }, shoes: 0x3a2a2e }],
        ['scarecrow', { kind: 'scarecrow', shirt: 0x4a6fa5, ...foe(0x4a6fa5, 0x8a5a34, 0xe8c95a) }],
        ['scarecrow hat', { kind: 'scarecrow', shirt: 0x4a6fa5 }],
        ['pumpkin', { kind: 'pumpkin', shirt: 0x4a3a5a, helmet: { color: 0x5a7a3c } }],
        ['snowman', { kind: 'snowman', jersey: 0x2a6f9a, number: 12, helmet: { color: 0x2a6f9a, stripe: 0xffffff } }],
        ['snowman bucket', { kind: 'snowman', jersey: 0x2a6f9a }],
        ['penguin', { kind: 'animal', species: 'penguin', build: 'small', ...foe(0x2a6f9a, 0x2a6f9a, 0xffffff) }],
        ['yeti', { kind: 'animal', species: 'yeti', build: 'huge', ...foe(0x2a6f9a, 0x2a6f9a, 0xffffff) }],
        ['robot', { kind: 'robot', neon: 0x58e6ff, jersey: 0xd63f8c, number: 64 }],
        ['robot big', { kind: 'robot', build: 'big', neon: 0xff5ad0, jersey: 0x4a3ad6 }],
        ['ghost foe', { kind: 'ghost', fur: 0xc9b6f2, jersey: 0x4a2f7a, number: 13, hat: 'leather', hatC: 0x3a2a4a }],
        ['wick', { kind: 'wick', scale: 1.25, acc: ['key'] }],
      ];
    } else if (set === 'town') {
      specs = Object.keys(SPECIES).map((s, i) => [s, { kind: 'animal', species: s, shirt: [0xd4502f, 0x2a6f77, 0xf08a24, 0x6aa84f, 0x58b8c9, 0x8a5aa8][i % 6], hat: [null, 'cap', 'chef', 'beanie', 'straw', 'bow', 'top', 'visor'][i % 8], hatC: [0xfffaf0, 0xd4502f, 0xfffaf0, 0x2a6f77, 0xe8c95a, 0xd4502f, 0x2b1a33, 0xfffaf0][i % 8], acc: i % 5 === 0 ? ['glasses'] : i % 5 === 1 ? ['apron'] : i % 5 === 2 ? ['scarf'] : [] }]);
    } else if (set === 'anim') {
      const states = ['move', 'carry', 'block', 'sit', 'down', 'dead', 'talk', 'cheer', 'sad', 'ready', 'panic', 'throw', 'catch', 'dive', 'kick', 'spin', 'celebrate', 'stumble'];
      specs = states.map((s) => [s, { kind: 'animal', species: 'fox', ...UNI, number: 1, _state: s }]);
    }
    const perRow = parseInt(q.get('row') || '7', 10);
    const gap = 2.2;
    this.labels = [];
    specs.forEach(([label, spec], i) => {
      const ch = new Character(spec);
      const cx = (i % perRow) - (Math.min(perRow, specs.length) - 1) / 2;
      const row = Math.floor(i / perRow);
      ch.setPos(cx * gap, row * 3.2);
      ch.face(parseFloat(q.get('yaw') || '0.35'));
      this.scene.add(ch.root);
      const st = spec._state;
      const oneShots = ['throw', 'catch', 'dive', 'kick', 'spin', 'celebrate', 'stumble'];
      if (st && !oneShots.includes(st)) ch.setBase(st);
      this.chars.push({ ch, st: oneShots.includes(st) ? st : null, moving: st === 'move' || st === 'carry' });
      const lab = el('div.gallery-label', label);
      this.hud.appendChild(lab);
      this.labels.push({ lab, pos: new THREE.Vector3(cx * gap, -0.1, row * 3.2 + 0.7) });
    });
    const ball = buildFootball();
    ball.position.set(0, 0.2, 1.4);
    this.scene.add(ball);
    const rows = Math.ceil(specs.length / perRow);
    const cz = ((rows - 1) * 3.2) / 2;
    const d = parseFloat(q.get('d') || String(9 + rows * 3.4));
    const pitch = parseFloat(q.get('pitch') || '0.62');
    this.camera.fov = 32;
    this.camera.position.set(0, 1 + Math.sin(pitch) * d, cz + Math.cos(pitch) * d);
    this.camera.lookAt(0, 0.9, cz);
    this.camera.updateProjectionMatrix();
    this.rig.follow(0, cz);
    this.tt = 0;
  }

  update(dt) {
    this.tt += dt;
    for (const c of this.chars) {
      if (c.st && !c.ch.busy && Math.floor(this.tt * 0.8) % 2 === 0) c.ch.play(c.st);
      c.ch.update(dt, c.moving ? 6 : 0);
    }
    for (const l of this.labels) {
      const s = G.ui.project(l.pos, this.camera);
      l.lab.style.left = `${s.x}px`; l.lab.style.top = `${s.y}px`;
    }
  }
}
