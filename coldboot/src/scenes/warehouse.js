// PROLOGUE I — "Тихо". Bely Mys, Chukotka. Night. Six people and a fished-out
// stranger around a table under one lamp, deciding to save the world quietly.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { buildCharacter } from '../human/character.js';
import { Animator } from '../human/anim.js';
import { CAST } from '../data/cast.js';
import { Director } from './director.js';
import { music } from '../audio/music.js';
import { buildWarehouse } from './warehouseSet.js';
import { createSnow } from '../world/snow.js';
import { voice } from '../audio/voice.js';
import { getEnvMap } from '../core/envmap.js';
import { store } from '../core/settings.js';
import { text, W, H, C } from '../core/ui.js';
import { DAYS } from '../game/state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function playerDNA() {
  const prof = store.load('profile');
  return prof?.dna ? { ...CAST.player.dna, ...prof.dna } : CAST.player.dna;
}

registerScreen('warehouse', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 80);
  let set, d, snow;
  let t = 0;
  let card = 1;          // opening title card alpha
  let skipHold = 0;
  let finished = false;
  let youLine = null;

  async function script() {
    const top = set.top;
    // ------------------------------------------------ establishing
    d.cam({ pos: V(-8, 5.2, 6.5), look: V(0, 0.9, 0), fov: 42, dof: false });
    await d.wait(1.2);
    d.cam({ pos: V(-3.6, 2.0, 2.9), look: V(0.2, 0.95, 0), fov: 34, dur: 8, dof: 3.6, aperture: 4 });
    await d.wait(3.5);
    card = 0;
    await d.wait(2.5);
    await d.say('valya', 'w.valya.tea', { cam: d.closeUp('valya', { side: -1, dist: 0.8 }) });
    await d.say('grisha', 'w.grisha.tea', { cam: d.closeUp('grisha', { side: 1, dist: 0.85 }) });
    await d.say('valya', 'w.valya.tea2', { cam: d.overShoulder('grisha', 'valya', { side: -1 }) });
    await d.say('dmitri', 'w.dmitri.enough', { cam: d.closeUp('dmitri', { side: -1, dist: 0.95, angle: 0.3 }) });
    // ------------------------------------------------ the laptop
    const lap = set.props.laptop;
    await d.say('lyosha', 'w.lyosha.aurora1', { cam: d.closeUp('lyosha', { side: 1, dist: 0.8 }) });
    d.cam({ pos: V(0.1, top + 0.42, 0.32), look: V(0.1, top + 0.12, -0.38), fov: 30, dof: 0.62, aperture: 5, dur: 0 });
    d.cam({ pos: V(0.1, top + 0.36, 0.18), look: V(0.1, top + 0.12, -0.38), fov: 30, dof: 0.5, aperture: 5, dur: 7 });
    await d.say('lyosha', 'w.lyosha.aurora2');
    await d.say('nadia', 'w.nadia.worm', { cam: d.closeUp('nadia', { side: 1, dist: 0.8 }) });
    await d.say('lyosha', 'w.lyosha.worm', { cam: d.closeUp('lyosha', { side: -1, dist: 0.75 }) });
    await d.say('grisha', 'w.grisha.hosp', { cam: d.closeUp('grisha', { side: -1, dist: 0.8 }) });
    await d.say('dmitri', 'w.dmitri.war', { cam: d.closeUp('dmitri', { side: 1, dist: 0.85 }) });
    // ------------------------------------------------ choice 1
    d.cam({ ...d.overShoulder('player', 'dmitri', { side: 1 }), dur: 0 });
    const c1 = await d.choose(['Who would build something like that?', "Why not tell someone? A government?", '…And what do you need from me?']);
    youSay(['Who would build something like that?', 'Why not tell someone? A government?', '…And what do you need from me?'][c1]);
    await d.wait(1.6);
    if (c1 === 0) await d.say('nadia', 'w.nadia.who', { cam: d.closeUp('nadia', { side: -1 }) });
    if (c1 === 1) await d.say('dmitri', 'w.dmitri.tell', { cam: d.closeUp('dmitri', { side: -1 }) });
    if (c1 === 2) await d.say('valya', 'w.valya.listen', { cam: d.closeUp('valya', { side: 1 }) });
    if (c1 !== 0) await d.say('nadia', 'w.nadia.who', { cam: d.closeUp('nadia', { side: 1 }) });
    await d.say('lyosha', 'w.lyosha.key', { cam: d.closeUp('lyosha', { side: 1, dist: 0.8 }) });
    // ------------------------------------------------ the map
    d.cam({ pos: V(-0.55, top + 0.9, 0.45), look: V(-0.25, top, 0.1), fov: 34, dof: 0.95, aperture: 4, dur: 0 });
    d.cam({ pos: V(-0.2, top + 0.7, 0.35), look: V(0.15, top, 0.12), fov: 34, dof: 0.75, aperture: 4, dur: 9 });
    await d.say('nadia', 'w.nadia.where');
    await d.say('dmitri', 'w.dmitri.bought', { cam: d.closeUp('dmitri', { side: -1, dist: 0.9 }) });
    await d.say('grisha', 'w.grisha.top', { cam: d.closeUp('grisha', { side: 1 }) });
    await d.say('dmitri', 'w.dmitri.climb', { cam: d.closeUp('dmitri', { side: 1, dist: 0.8 }) });
    await d.say('nadia', 'w.nadia.inside', { cam: d.closeUp('nadia', { side: -1, dist: 0.85 }) });
    // everyone turns to the player
    for (const a of Object.values(d.actors)) if (a.id !== 'player') { a.anim.lookAt = d.headPos('player'); a.lockLook = true; }
    d.cam({ pos: V(1.0, 1.25, 0.45), look: () => d.headPos('player'), fov: 30, dofOn: 'player', aperture: 7, dur: 0 });
    await d.wait(2.2);
    // ------------------------------------------------ choice 2
    const opts2 = ['Me?', "I'm a deckhand, not a spy.", '(Say nothing. Nod.)'];
    const c2 = await d.choose(opts2);
    if (c2 !== 2) youSay(opts2[c2]);
    else d.actors.player.anim.headTilt = 0;
    await d.wait(c2 === 2 ? 0.6 : 1.4);
    for (const a of Object.values(d.actors)) a.lockLook = false;
    if (c2 === 0) await d.say('grisha', 'w.grisha.who', { cam: d.closeUp('grisha', { side: -1 }), emo: 'laugh' });
    if (c2 === 1) await d.say('dmitri', 'w.dmitri.debt', { cam: d.closeUp('dmitri', { side: 1, dist: 0.8 }) });
    if (c2 === 2) await d.say('valya', 'w.valya.silence', { cam: d.closeUp('valya', { side: -1 }) });
    // ------------------------------------------------ gifts
    await d.say('nadia', 'w.nadia.ear', { cam: d.closeUp('nadia', { side: 1, dist: 0.8 }) });
    slide(set.props.earpiece, V(1.6, top, -0.12), 1.6);
    await d.say('lyosha', 'w.lyosha.teach', { cam: d.closeUp('lyosha', { side: -1 }) });
    await d.say('grisha', 'w.grisha.fly', { cam: d.closeUp('grisha', { side: 1 }), emo: 'laugh' });
    d.cam({ pos: V(0.9, top + 0.5, 0.85), look: V(1.2, top, 0.3), fov: 30, dof: 0.75, dur: 0 });
    slide(set.props.passport, V(1.62, top + 0.004, 0.22), 1.8);
    await d.say('ivan', 'w.ivan.papers');
    await d.say('ivan', 'w.ivan.lose', { cam: d.closeUp('ivan', { side: 1, dist: 0.9 }) });
    slide(set.props.doll, V(1.6, top, -0.38), 1.4);
    await d.say('valya', 'w.valya.doll', { cam: d.closeUp('valya', { side: 1, dist: 0.75 }) });
    await d.say('dmitri', 'w.dmitri.plane', { cam: d.closeUp('dmitri', { side: -1 }) });
    d.cam({ pos: V(-1.2, 1.35, 1.6), look: V(-1.9, 1.15, 0), fov: 32, dofOn: 'dmitri', dur: 8 });
    await d.say('dmitri', 'w.dmitri.heroes');
    await d.say('nadia', 'w.nadia.quiet', { cam: d.closeUp('nadia', { side: -1, dist: 0.9 }) });
    await d.say('valya', 'w.valya.end', { cam: d.closeUp('valya', { side: -1, dist: 0.9 }), emo: 'laugh' });
    // everyone laughs, the camera rises away
    for (const a of Object.values(d.actors)) { d._setEmo(a, 'laugh'); a.anim.lookAt = null; }
    d.cam({ pos: V(-6, 4.8, 5.8), look: V(0, 0.9, 0), fov: 40, dof: false, dur: 7 });
    await d.wait(4.5);
    finished = true;
    game.renderer.tweakPost({ fade: 1 });
    await d.wait(1.6);
    go('plane', {}, { transition: 'black' });
  }

  const slides = [];
  function slide(obj, to, dur) { slides.push({ obj, from: obj.position.clone(), to, t: 0, dur }); }
  function youSay(s) { youLine = { s, t: 0 }; }

  return {
    heavy: true,
    async enter() {
      game.renderer.setPost({
        exposure: 1.05, bloomStrength: 0.5, bloomThreshold: 1.1, vignette: 0.7, saturation: 0.92, contrast: 1.06,
        lift: [0.012, 0.008, 0.012], gain: [1.02, 0.98, 0.94], grain: 0.05, letterbox: 1,
      }, true);
      scene.background = new THREE.Color(0x020304);
      scene.fog = new THREE.FogExp2(0x0a0c0e, 0.045);
      scene.environment = getEnvMap(game.renderer.gl, 'interior');
      scene.environmentIntensity = 0.25;
      set = buildWarehouse();
      scene.add(set.group);
      snow = createSnow({ count: 900, box: 26, height: 8 });
      snow.points.position.set(0, 0, 0);
      d = new Director(scene, camera);
      d.setFill(0.55);
      try { music.play('cb_warehouse', { fade: 3 }); } catch { /* */ }
      const cast = { dmitri: CAST.dmitri.dna, nadia: CAST.nadia.dna, lyosha: CAST.lyosha.dna, grisha: CAST.grisha.dna, valya: CAST.valya.dna, ivan: CAST.ivan.dna, player: playerDNA() };
      for (const [id, dna] of Object.entries(cast)) {
        const ch = await buildCharacter(dna);
        const s = set.seats[id];
        ch.group.position.set(s.x, 0, s.z);
        ch.group.rotation.y = s.rot;
        scene.add(ch.group);
        const an = new Animator(ch);
        an.setPosture('sit');
        an.postureW.sit = 1; an.postureW.stand = 0;
        an.handsOnTable = 1;
        d.addActor(id, ch, an);
      }
      d.actors.valya.anim.handsOnTable = 0;
      d.actors.dmitri.anim.armsCrossed = 0.0;
      d.actors.ivan.anim.armsCrossed = 0.8;
      voice.preload(Object.keys((await import('../data/script/prologue.js')).LINES).filter((k) => k.startsWith('w.')));
      script().catch((e) => console.error(e));
    },
    exit() {
      game.renderer.dof = null;
      voice.stopAll();
      scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    },
    update(dt) {
      t += dt;
      d.update(dt);
      set.update(dt, t);
      for (const s of slides) {
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        s.obj.position.lerpVectors(s.from, s.to, e);
      }
      if (youLine) { youLine.t += dt; if (youLine.t > 2.6) youLine = null; }
      // hold to skip the whole scene
      if (input.keys.has('Escape') || input.padHeld(9)) skipHold += dt; else skipHold = 0;
      if (skipHold > 1.2 && !finished) { finished = true; voice.stopAll(); go('plane', {}, { transition: 'black' }); }
    },
    draw(ctx) {
      d.draw(ctx);
      if (card > 0 || t < 6) {
        const a = Math.min(1, t / 1.5) * (card ? 1 : Math.max(0, 1 - (t - 3.5) / 1.5));
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          // a film location card, bottom-left inside the frame
          const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen'];
          text(ctx, 'Bely Mys, Chukotka', 96, H - 172, { size: 30, weight: 300, color: '#ffffff', spacing: 1 });
          text(ctx, 'БЕЛЫЙ МЫС', 98, H - 144, { size: 12, weight: 500, color: C.dim, spacing: 6 });
          text(ctx, `${words[DAYS] || DAYS} days before the worm wakes`, 98, H - 120, { size: 15, weight: 400, color: '#c9cfd5' });
          ctx.restore();
        }
      }
      if (youLine) {
        const a = Math.max(0, Math.min(1, youLine.t * 5) * Math.min(1, (2.6 - youLine.t) * 3));
        const base = game.renderer.post.letterbox > 0.5 ? H - 104 : H - 64;
        ctx.save();
        ctx.globalAlpha = a;
        text(ctx, 'YOU', W / 2, base - 28, { size: 12, weight: 600, color: '#a9d4b2', align: 'center', spacing: 2.5 });
        text(ctx, youLine.s, W / 2, base, { size: 23, weight: 500, color: '#f6f7f8', align: 'center' });
        ctx.restore();
      }
      if (skipHold > 0.1) text(ctx, 'Hold to skip', W - 60, 60, { size: 14, weight: 500, color: '#fff', align: 'right', alpha: Math.min(1, skipHold * 2) });
    },
    view() { return { scene, camera }; },
  };
});
