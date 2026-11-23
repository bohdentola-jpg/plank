// QA: people on a turntable under portrait lighting.
//   ?screen=humanlab&cast=dmitri,nadia&cam=face|bust|full&yaw=0.3&expr=mouth-open:1
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { input } from '../core/input.js';
import { text, C } from '../core/ui.js';
import { buildCharacter } from '../human/character.js';
import { CAST } from '../data/cast.js';
import { getEnvMap } from '../core/envmap.js';
import { PoseRig, standPose } from '../human/pose.js';
import { Animator } from '../human/anim.js';

registerScreen('humanlab', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100);
  const people = [];
  let t = 0;
  let yaw = 0;
  let camMode = 'bust';
  let ready = false;
  let info = '';
  return {
    async enter(params) {
      game.renderer.setPost({ exposure: 1.0, bloomStrength: 0.35, vignette: 0.45, grain: 0.03, scanline: 0.08 }, true);
      scene.environment = getEnvMap(game.renderer.gl, 'studio');
      scene.environmentIntensity = 0.35;
      const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
      key.position.set(1.6, 2.4, 2.2);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -0.5;
      key.shadow.bias = -0.0002;
      key.shadow.normalBias = 0.01;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9fb8ff, 0.5);
      fill.position.set(-2, 1.5, 1.5);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xbfe8ff, 1.6);
      rim.position.set(-1.2, 2.2, -2.5);
      scene.add(rim);
      scene.add(new THREE.HemisphereLight(0x404850, 0x201814, 0.3));
      const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      const names = (params.cast || 'player').split(',');
      camMode = params.cam || (names.length > 2 ? 'full' : 'bust');
      yaw = parseFloat(params.yaw || '0');
      const t0 = performance.now();
      for (let i = 0; i < names.length; i++) {
        const dna = CAST[names[i]]?.dna || {};
        const ch = await buildCharacter(dna, { frustumCulled: false });
        ch.group.position.x = (i - (names.length - 1) / 2) * 0.75;
        scene.add(ch.group);
        people.push(ch);
        if (params.expr) for (const kv of params.expr.split(';')) { const [k, v] = kv.split(':'); ch.setExpr(k, +v); }
        ch.applyExpr();
        if (params.hide) for (const k of params.hide.split(',')) if (ch.meshes[k]) ch.meshes[k].visible = false;
        if (params.anim) {
          ch.anim = new Animator(ch);
          const a = params.anim;
          if (a === 'walk') ch.anim.targetSpeed = ch.anim.speed = 1.4;
          if (a === 'run') ch.anim.targetSpeed = ch.anim.speed = 4.2;
          if (a === 'sit') { ch.anim.setPosture('sit'); ch.anim.postureW.sit = 1; ch.anim.postureW.stand = 0; }
          if (a === 'talk') ch.anim.talk = 1;
          if (params.phase) ch.anim.phase = +params.phase;
        } else if (params.pose !== 'rest') {
          ch.poser = new PoseRig(ch);
          ch.poser.resolve(standPose()).apply();
        }
      }
      info = `${names.join(', ')} · built in ${Math.round(performance.now() - t0)} ms`;
      ready = true;
    },
    exit() { for (const p of people) p.dispose(); },
    update(dt) {
      t += dt;
      if (input.pressed('left')) yaw -= 0.3;
      if (input.pressed('right')) yaw += 0.3;
      if (input.pressed('camera')) camMode = camMode === 'face' ? 'bust' : camMode === 'bust' ? 'full' : 'face';
      for (const p of people) {
        p.group.rotation.y = yaw;
        if (p.anim) {
          p.anim.update(this.freeze ? 0 : dt);
          if (p.anim.talk) { p.anim.voice.open = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 3.1); p.anim.voice.wide = 0.5; }
        }
      }
      const n = people.length;
      const h = people[0]?.height || 1.7;
      if (camMode === 'face') {
        camera.fov = 18;
        camera.position.set(0, h - 0.11, 1.15);
        camera.lookAt(0, h - 0.12, 0);
      } else if (camMode === 'bust') {
        camera.fov = 26;
        camera.position.set(0, h - 0.2, 1.6 + n * 0.35);
        camera.lookAt(0, h - 0.25, 0);
      } else {
        camera.fov = 30;
        camera.position.set(0, 1.0, 3.6 + n * 0.5);
        camera.lookAt(0, 0.9, 0);
      }
      camera.updateProjectionMatrix();
    },
    draw(ctx) {
      text(ctx, ready ? info : 'building…', 30, 690, { size: 14, color: C.dim });
    },
    view() { return { scene, camera }; },
  };
});
