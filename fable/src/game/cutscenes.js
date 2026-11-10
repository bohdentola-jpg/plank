// Small standalone scenes: the scoreboard waking up, and the ending.
import * as THREE from 'three';
import { G, Mode } from '../core/game.js';
import { Fx } from '../core/fx.js';
import { lightRig, toon, M, plane, glowSprite, box } from '../art/kit.js';
import { PROPS } from '../art/props.js';
import { Character } from '../art/characters.js';
import { NPCS } from '../data/npcs.js';
import { teamSpec } from '../data/cast.js';
import { damp, ease } from '../core/util.js';

class StadiumScene extends Mode {
  constructor() { super(); this.name = 'cutscene'; this.camera.fov = 26; }
  enter(p) {
    this.fx = new Fx(this.scene);
    this.rig = lightRig(this.scene, 'night', { fog: [40, 120] });
    this.scene.add(M(plane(160, 120), toon(0x3f6a4f), 0, 0, 0, { rx: -Math.PI / 2, shadow: false }));
    // an empty field, bleachers, and the board
    const field = M(plane(46, 20), toon(0x4a7d5a), 0, 0.02, 4, { rx: -Math.PI / 2, shadow: false });
    this.scene.add(field);
    for (let i = -4; i <= 4; i++) this.scene.add(M(box(0.16, 0.02, 20), toon(0x9fb8a8), i * 5, 0.04, 4, { shadow: false }));
    for (const x of [-14, 0, 14]) { const b = PROPS.bleachers({ len: 13, rows: 6, color: 0xb9b0c4 }); b.position.set(x, 0, -8.5); this.scene.add(b); }
    this.board = PROPS.scoreboard({ w: 13, h: 5, on: !!p.lit, lines: p.lines || [] });
    this.board.position.set(0, 3.2, -15);
    this.scene.add(this.board);
    for (const x of [-22, 22]) { const t = PROPS.lightTower({ h: 11, on: !!p.towers }); t.position.set(x, 0, -9); this.scene.add(t); }
    this.glow = glowSprite(0xffb53c, 22, 0); this.glow.position.set(0, 9.8, -13.6); this.scene.add(this.glow);
    this.wickGlow = glowSprite(0xffb347, 3.4, 0.5); this.wickGlow.position.set(-14, 1.2, -8.2); this.scene.add(this.wickGlow);
    this.t = 0;
    this.cam = { x: p.cam ? p.cam[0] : -6, y: 5.5, z: 30, tx: 0, ty: 5.5, tz: -12 };
    this.actors = [];
    if (p.setup) p.setup(this);
    this._place();
    G.audio.music(p.music === undefined ? 'night' : p.music);
    G.ui.cine(true);
    this.script = p.script;
    this._go();
  }
  async _go() {
    try { await this.script(this); } catch (e) { G.reportError(e); }
    G.ui.cine(false);
    G.leave(true);
  }
  _place() {
    const c = this.cam;
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(c.tx, c.ty, c.tz);
    this.rig.follow(0, 0);
  }
  add(spec, x, z, face = 0) {
    const ch = new Character(spec);
    ch.setPos(x, z); ch.face(face);
    this.scene.add(ch.root);
    this.actors.push(ch);
    return ch;
  }
  update(dt) {
    this.t += dt;
    this.wickGlow.position.x = -14 + Math.sin(this.t * 0.5) * 9;
    this.wickGlow.material.opacity = 0.4 + Math.sin(this.t * 9) * 0.08;
    for (const a of this.actors) a.update(dt, a.speedHint || 0);
    this._place();
    this.fx.update(dt, this.camera);
  }
  exit() { this.fx.dispose(); G.ui.cine(false); }
}

/** The scoreboard turns itself on (cut to during the first match). */
export function scoreboardCut() {
  return G.run(new StadiumScene(), {
    script: async (s) => {
      const say = (t) => G.ui.say(null, t, { big: true });
      s.tween(9, (k) => { s.cam.x = -6 + k * 6; s.cam.z = 30 - k * 9; }, ease.inOut2);
      await s.wait(0.8);
      await say('Across town, in a stadium nobody has set foot in for years...');
      for (let i = 0; i < 4; i++) {
        G.audio.sfx('zap');
        s.board.userData.draw(['WELCOME BACK,', 'CAPTAIN.']);
        s.glow.material.opacity = 0.45;
        await s.wait(0.07 + i * 0.03);
        s.board.userData.draw([], { on: false });
        s.glow.material.opacity = 0;
        await s.wait(0.16 - i * 0.03);
      }
      G.audio.sfx('power');
      s.board.userData.draw(['WELCOME BACK,', 'CAPTAIN.']);
      s.glow.material.opacity = 0.5;
      s.fx.shake(0.12, 0.3);
      await s.wait(1.1);
      await say('...a scoreboard turns itself on.');
      await say('It reads: *WELCOME BACK, CAPTAIN.*');
      await say('You have never been there before.');
      await s.wait(0.4);
    },
  });
}

/** After the Midnight Bowl. */
export function endingCut() {
  return G.run(new StadiumScene(), {
    lit: true, towers: true, lines: [{ t: 'FINAL', c: '#9be8ff' }, 'THANK YOU,', 'CAPTAIN.'], music: 'town', cam: [0],
    setup: (s) => {
      s.glow.material.opacity = 0.5;
      s.wickGlow.visible = false;
      const ids = ['waffle', 'pip', 'captain', 'zip', 'june', 'hollow'];
      ids.forEach((id, i) => { if (G.S.roster.includes(id)) { const c = s.add(teamSpec(id), -5 + i * 2, 6 + Math.abs(i - 2.5) * 0.5, 0); c.setBase('cheer'); } });
      const w = s.add(NPCS.wick.spec, 9, 2, -0.6); w.setBase('move');
      s.wick = w;
      s.cam.y = 7; s.cam.z = 26; s.cam.ty = 3; s.cam.tz = -2;
    },
    script: async (s) => {
      const say = (who, t) => G.ui.say(who, t);
      s.tween(14, (k) => { s.cam.z = 26 - k * 5; }, ease.inOut2);
      await s.wait(1);
      await G.ui.say(null, 'The lights hold. For the first time in a very long time, the Midnight Bowl has a final score.', { big: true });
      await say('wick', '...tick. Tick. *Game over.* Lights... stay on?');
      await say('hollow', 'Lights stay on, old friend. You can stop looking for that fuse.');
      await say('hollow', 'So that\'s it. Contract fulfilled. "Until the final whistle of the Midnight Bowl." I suppose I\'m free to go.');
      await say('pip', 'Go?! Go where? You can\'t go. Who\'s going to yell at me?');
      await say('hollow', '...Funny thing. I read the back page. There\'s a renewal clause. *"So long as the Hollow has a Captain."*');
      await say('hollow', 'And it looks like it does.');
      await say('zip', 'Does that mean we play again next season? Is there a next season? Are there more buses? I have so many questions and one of them is about snacks.');
      await G.ui.say(null, 'The board flickers once more. Not a greeting this time.', { big: true });
      await G.ui.say(null, '*THANK YOU, CAPTAIN.*', { big: true });
      await G.ui.say(null, 'You have definitely been here before.', { big: true });
      await s.wait(0.5);
    },
  });
}

export function install() {
  G.hooks.cutscene = (id) => (id === 'scoreboard' ? scoreboardCut() : id === 'ending' ? endingCut() : Promise.resolve());
}

export { damp, THREE };
