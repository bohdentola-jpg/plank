// QA: people on a turntable. Rocketbox avatars, mocap, faces.
//   ?screen=humanlab&cast=dmitri,nadia            cast ids (or avatar=Male_Adult_05,…)
//     &cam=face|bust|full   &yaw=0.3   &light=studio|lamp|night
//     &anim=idle|walk|jog|run|sit|sitchair|talk|sittalk|drive|crouch|crouchwalk|handsup|listen|<clip>
//     &speed=1.4 (walk speeds)   &expr=smile:1;worry:0.5   &look=1 (eyes to camera)   &mouth=1 (fake speech)
//     &open=0.8&wide=0&round=0 (a held vowel)   &sit=1 (&table=1): play the clip seated (upper body over the sitting legs)   &time=4 (advance s)
// Keys: ←/→ turn, camera key cycles face/bust/full, [ ] previous/next cast member, A next animation.
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { input } from '../core/input.js';
import { text, C } from '../core/ui.js';
import { buildCharacter } from '../people/person.js';
import { Animator } from '../people/animator.js';
import { CAST } from '../data/cast.js';
import { getEnvMap } from '../core/envmap.js';

const ANIMS = ['idle', 'walk', 'jog', 'run', 'talk', 'listen', 'sit', 'sittalk', 'sitchair', 'drive', 'crouch', 'crouchwalk', 'handsup', 'laugh', 'shrug', 'nod', 'phone', 'photo', 'wave', 'arms'];
const SPEEDS = { walk: 1.35, jog: 2.6, run: 4.2, crouchwalk: 1.0 };

registerScreen('humanlab', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100);
  let people = [];
  let t = 0, yaw = 0, camMode = 'bust', ready = false, info = '', params = {};
  let anim = 'idle', castList = [], castIdx = 0, props = null, mouth = false;
  const lights = new THREE.Group();
  scene.add(lights);

  function setLight(kind) {
    lights.clear();
    if (kind === 'lamp') {
      // the warehouse: one warm bulb over the table (same light as warehouseSet), near darkness around
      scene.background = new THREE.Color(0x020304);
      scene.environment = getEnvMap(game.renderer.gl, 'interior');
      scene.environmentIntensity = 0.25;
      const lamp = new THREE.SpotLight(0xffc98a, 8.5, 9, 1.0, 0.65, 1.6);
      lamp.position.set(0, 2.23, 1.0);
      lamp.target.position.set(0, 0, 1.0);
      lamp.castShadow = true;
      lamp.shadow.mapSize.set(2048, 2048);
      lamp.shadow.bias = -0.0003;
      lamp.shadow.normalBias = 0.02;
      lamp.shadow.camera.near = 0.2;
      lights.add(lamp, lamp.target);
      const lampFill = new THREE.PointLight(0xffb070, 1.3, 6, 2);
      lampFill.position.set(0, 2.05, 1.0);
      lights.add(lampFill);
      const camFill = new THREE.PointLight(0xffe4c8, 0.55, 3.2, 2);   // the director's fill, above the camera
      camFill.position.set(0, 1.6, 2.2);
      lights.add(camFill);
      const moon = new THREE.DirectionalLight(0x6a9ac8, 0.55);
      moon.position.set(-3, 9, -10);
      lights.add(moon);
      lights.add(new THREE.HemisphereLight(0x1c2a36, 0x0c0a08, 0.35));
    } else if (kind === 'night') {
      scene.background = new THREE.Color(0x05070c);
      scene.environment = getEnvMap(game.renderer.gl, 'night');
      scene.environmentIntensity = 0.3;
      const moon = new THREE.DirectionalLight(0x9ab0e0, 0.9);
      moon.position.set(-2, 4, 3);
      moon.castShadow = true;
      lights.add(moon);
      const sodium = new THREE.PointLight(0xffa040, 6, 8, 1.6);
      sodium.position.set(2, 3, 1);
      lights.add(sodium);
      lights.add(new THREE.HemisphereLight(0x223040, 0x080808, 0.4));
    } else {
      scene.background = new THREE.Color(0x0b0d10);
      scene.environment = getEnvMap(game.renderer.gl, 'studio');
      scene.environmentIntensity = 0.35;
      const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
      key.position.set(1.6, 2.4, 2.2);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -0.5;
      key.shadow.bias = -0.0002;
      key.shadow.normalBias = 0.01;
      lights.add(key);
      const fill = new THREE.DirectionalLight(0x9fb8ff, 0.5);
      fill.position.set(-2, 1.5, 1.5);
      lights.add(fill);
      const rim = new THREE.DirectionalLight(0xbfe8ff, 1.6);
      rim.position.set(-1.2, 2.2, -2.5);
      lights.add(rim);
      lights.add(new THREE.HemisphereLight(0x404850, 0x201814, 0.3));
    }
  }

  function furniture(on, x) {
    if (props) { scene.remove(props); props = null; }
    if (!on) return;
    props = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 0.7 });
    for (const px of x) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.42), wood);
      seat.position.set(px, 0.46, -0.14);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.03), wood);
      back.position.set(px, 0.72, -0.34);
      props.add(seat, back);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.2, x.length * 0.8), 0.06, 0.9), wood);
    top.position.set(0, 0.73, 0.73);
    props.add(top);
    for (const o of props.children) { o.castShadow = true; o.receiveShadow = true; }
    scene.add(props);
  }

  function setAnim(p, a) {
    const an = p.anim;
    an.setPosture('stand');
    an.targetSpeed = an.speed = SPEEDS[a] || 0;
    an.talk = 0;
    an.handsOnTable = 0;
    an.armsCrossed = 0;
    an.stop();
    if (a === 'sit' || a === 'sittalk') { an.setPosture('sit'); an.handsOnTable = 1; an.sitHeight = 0.48; }
    if (a === 'sitchair') { an.setPosture('sit'); an.sitHeight = 0.48; }
    if (a === 'drive') { an.setPosture('drive'); an.sitHeight = 0.48; }
    if (a === 'crouch' || a === 'crouchwalk') an.setPosture('crouch');
    if (a === 'handsup') an.play('handsUp');
    if (a === 'arms') an.armsCrossed = 1;
    if (a === 'listen') an.lookAt = camera.position.clone();
    if (params.sit === '1' && an.posture === 'stand') { an.setPosture('sit'); an.sitHeight = 0.48; an.handsOnTable = params.table === '1' ? 1 : 0; }
    if (an.has(a) && !['idle', 'walk', 'jog', 'run'].includes(a)) an.play(a, { hold: true });
    for (const k of Object.keys(an.postureW)) an.postureW[k] = k === an.posture ? 1 : 0;
    an.snap();
  }

  async function load(names) {
    ready = false;
    for (const p of people) p.ch.dispose();
    people = [];
    const t0 = performance.now();
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      const dna = CAST[n]?.dna || { avatar: n };
      const ch = await buildCharacter(dna, { frustumCulled: false });
      ch.group.position.x = (i - (names.length - 1) / 2) * 0.8;
      scene.add(ch.group);
      const an = new Animator(ch);
      people.push({ ch, anim: an, name: n });
      setAnim(people[i], anim);
      if (params.expr) for (const kv of params.expr.split(';')) { const [k, v] = kv.split(':'); if (k in an.exprTarget) an.exprTarget[k] = an.expr[k] = +v; else ch.setExpr(k, +v); }
    }
    let tris = 0;
    people[0]?.ch.root.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
    furniture(['sit', 'sittalk', 'sitchair'].includes(anim), people.map((p) => p.ch.group.position.x));
    info = `${names.map((n) => `${n}${CAST[n] ? ' → ' + people.find((p) => p.name === n)?.ch.avatar : ''}`).join(', ')} · ${anim} · ${tris} tris · ${Math.round(performance.now() - t0)} ms`;
    ready = true;
    window.__people = people;   // QA handle
  }

  return {
    async enter(p) {
      params = p;
      game.renderer.setPost({ exposure: 1.0, bloomStrength: 0.35, vignette: 0.45, grain: 0.03, scanline: 0.08 }, true);
      setLight(p.light || 'studio');
      const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      castList = (p.cast || p.avatar || 'player').split(',');
      camMode = p.cam || (castList.length > 2 ? 'full' : 'bust');
      yaw = parseFloat(p.yaw || '0');
      anim = (p.anim || 'idle').toLowerCase().replace('handsup', 'handsup');
      mouth = p.mouth === '1' || anim === 'talk' || anim === 'sittalk';
      if (SPEEDS[anim] && p.speed) SPEEDS[anim] = +p.speed;
      await load(castList);
      if (p.time) for (let i = 0; i < +p.time * 30; i++) for (const q of people) q.anim.update(1 / 30);
    },
    exit() { for (const p of people) p.ch.dispose(); },
    update(dt) {
      t += dt;
      if (input.pressed('left')) yaw -= 0.3;
      if (input.pressed('right')) yaw += 0.3;
      if (input.pressed('camera')) camMode = camMode === 'face' ? 'bust' : camMode === 'bust' ? 'full' : 'face';
      if (ready && input.keys.has('BracketRight') && input.pressed('any')) { castIdx = (castIdx + 1) % Object.keys(CAST).length; load([Object.keys(CAST)[castIdx]]); }
      if (ready && input.keys.has('BracketLeft') && input.pressed('any')) { castIdx = (castIdx + Object.keys(CAST).length - 1) % Object.keys(CAST).length; load([Object.keys(CAST)[castIdx]]); }
      if (ready && input.keys.has('KeyA') && input.pressed('any')) {
        anim = ANIMS[(ANIMS.indexOf(anim) + 1) % ANIMS.length];
        mouth = anim === 'talk' || anim === 'sittalk';
        for (const p of people) setAnim(p, anim);
        furniture(['sit', 'sittalk', 'sitchair'].includes(anim), people.map((p) => p.ch.group.position.x));
      }
      for (const p of people) {
        p.ch.group.rotation.y = yaw;
        const an = p.anim;
        if (params.open) { an.voice.open = +params.open; an.voice.wide = +(params.wide || 0); an.voice.round = +(params.round || 0); an.talk = 0.9; } else if (mouth) {
          // a fake voice: syllables at ~5 Hz with vowel colour changes
          const syl = Math.max(0, Math.sin(t * 13) * Math.sin(t * 3.1 + 1) + 0.15);
          an.voice.open = Math.min(1, syl * 1.1);
          an.voice.wide = 0.5 + 0.5 * Math.sin(t * 2.3);
          an.voice.round = Math.max(0, Math.sin(t * 1.7 + 2));
          an.talk = 0.9;
        }
        if (params.look === '1' || anim === 'listen') an.lookAt = camera.position.clone();
        an.update(dt);
      }
      const n = people.length;
      const h = people[0]?.ch.height || 1.75;
      const seatedK = people[0] ? people[0].anim.postureW.sit + people[0].anim.postureW.drive : 0;
      const eye = people[0] ? people[0].ch.bones.head.getWorldPosition(new THREE.Vector3()).y + 0.06 : h - 0.1;
      if (camMode === 'face') {
        camera.fov = 18;
        camera.position.set(0, eye + 0.01, 1.05);
        camera.lookAt(0, eye - 0.03, 0);
      } else if (camMode === 'bust') {
        camera.fov = 26;
        camera.position.set(0, eye - 0.08, 1.45 + n * 0.35);
        camera.lookAt(0, eye - 0.16, 0);
      } else {
        camera.fov = 30;
        const mid = seatedK > 0.5 ? 0.7 : 0.9;
        camera.position.set(0, mid + 0.1, 3.6 + n * 0.5);
        camera.lookAt(0, mid, 0);
      }
      camera.updateProjectionMatrix();
    },
    draw(ctx) {
      text(ctx, ready ? info : 'loading…', 30, 690, { size: 14, color: C.dim });
    },
    view() { return { scene, camera }; },
  };
});
