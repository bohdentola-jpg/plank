// PROLOGUE II — Beringia Air 211, Anadyr → Port Zarya, before dawn.
// A cramped turboprop cabin; aurora outside the windows; the earpiece comes
// alive; a man in a grey parka across the aisle takes your picture.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { buildCharacter } from '../human/character.js';
import { Animator } from '../human/anim.js';
import { CAST } from '../data/cast.js';
import { Director } from './director.js';
import { music } from '../audio/music.js';
import { createSky } from '../world/sky.js';
import { voice } from '../audio/voice.js';
import { getEnvMap } from '../core/envmap.js';
import { playerDNA } from './warehouse.js';
import { text, W, H, C, actionGlyph } from '../core/ui.js';
import { store } from '../core/settings.js';
import { makeNoise2D } from '../core/util.js';
import { fabric } from '../human/fabric.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function buildCabin() {
  const g = new THREE.Group();
  const L = 11, Wd = 1.86, Hh = 1.78;
  const panelTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#c9c4ba'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    c.fillStyle = 'rgba(40,40,40,0.35)'; c.fillRect(0, 0, 256, 3); c.fillRect(0, 0, 3, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1);
    return t;
  })();
  const shell = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.7 });
  const cf = fabric({ pattern: 'plaid', color: '#24324a', color2: '#121a28', color3: '#7a8aa0', repeat: 4 });
  const cp = fabric({ pattern: 'wool', color: '#3a2e38', repeat: 3 });
  cp.map.repeat.set(3, 18);
  const carpet = new THREE.MeshStandardMaterial({ map: cp.map, normalMap: cp.normalMap, roughness: 1 });
  cf.map.repeat.set(3, 3); cf.normalMap.repeat.set(3, 3);
  const seatMat = new THREE.MeshStandardMaterial({ map: cf.map, normalMap: cf.normalMap, roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.5, metalness: 0.3 });
  const parts = [];
  const add = (geo, x, y, z) => { geo.translate(x, y, z); parts.push(geo); };
  // floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.05, L), carpet);
  floor.position.y = -0.025;
  floor.receiveShadow = true;
  g.add(floor);
  // shell: lower wall, a window band of pillars, and a curved upper wall +
  // ceiling extruded along the fuselage
  const winY = 1.0, winH = 0.36, winW = 0.3;
  const half = Wd / 2;
  add(new THREE.BoxGeometry(0.06, winY - winH / 2, L), -half, (winY - winH / 2) / 2, 0);
  add(new THREE.BoxGeometry(0.06, winY - winH / 2, L), half, (winY - winH / 2) / 2, 0);
  for (const side of [-1, 1]) {
    for (let z = -L / 2; z < L / 2 - 0.01; z += 0.85) {
      add(new THREE.BoxGeometry(0.06, winH, 0.85 - winW), side * half, winY, z + winW + (0.85 - winW) / 2);
    }
  }
  const prof = new THREE.Shape();
  const top = winY + winH / 2;
  prof.moveTo(-half, top);
  prof.lineTo(-half, top + 0.12);
  prof.quadraticCurveTo(-half + 0.05, Hh, 0, Hh);
  prof.quadraticCurveTo(half - 0.05, Hh, half, top + 0.12);
  prof.lineTo(half, top);
  prof.lineTo(half - 0.05, top);
  prof.lineTo(half - 0.05, top + 0.12);
  prof.quadraticCurveTo(half - 0.1, Hh - 0.05, 0, Hh - 0.05);
  prof.quadraticCurveTo(-half + 0.1, Hh - 0.05, -half + 0.05, top + 0.12);
  prof.lineTo(-half + 0.05, top);
  const upper = new THREE.ExtrudeGeometry(prof, { depth: L, bevelEnabled: false, curveSegments: 16 });
  upper.translate(0, 0, -L / 2);
  const upperM = new THREE.Mesh(upper, new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.75, side: THREE.DoubleSide }));
  upperM.receiveShadow = true;
  g.add(upperM);
  // end bulkheads
  add(new THREE.BoxGeometry(Wd, Hh, 0.06), 0, Hh / 2, -L / 2);
  add(new THREE.BoxGeometry(Wd, Hh, 0.06), 0, Hh / 2, L / 2);
  const walls = new THREE.Mesh(mergeGeometries(parts), shell);
  walls.receiveShadow = true;
  g.add(walls);
  // overhead lockers
  const lock = [];
  for (const side of [-1, 1]) lock.push(new THREE.BoxGeometry(0.3, 0.24, L - 0.4).translate(side * (Wd / 2 - 0.22), Hh - 0.36, 0));
  g.add(new THREE.Mesh(mergeGeometries(lock), new THREE.MeshStandardMaterial({ color: 0xe0dcd4, roughness: 0.6 })));
  // seats: single column each side
  const seatParts = [];
  const seats = [];
  for (let r = 0; r < 9; r++) {
    const z = -L / 2 + 1.2 + r * 0.85;
    for (const side of [-1, 1]) {
      const x = side * (Wd / 2 - 0.36);
      seatParts.push(new THREE.BoxGeometry(0.46, 0.12, 0.46).translate(x, 0.42, z));
      seatParts.push(new THREE.BoxGeometry(0.46, 0.7, 0.1).translate(x, 0.82, z + 0.27));
      seatParts.push(new THREE.BoxGeometry(0.26, 0.18, 0.08).translate(x, 1.24, z + 0.29));
      seats.push({ x, z, side, row: r });
    }
  }
  const seatMesh = new THREE.Mesh(mergeGeometries(seatParts), seatMat);
  seatMesh.castShadow = true; seatMesh.receiveShadow = true;
  g.add(seatMesh);
  const trims = [];
  for (const s of seats) trims.push(new THREE.BoxGeometry(0.05, 0.05, 0.4).translate(s.x + s.side * -0.25, 0.62, s.z));
  g.add(new THREE.Mesh(mergeGeometries(trims), trim));
  // window frames (soft-cornered) catch the aurora light
  const frames = [];
  for (const side of [-1, 1]) for (let z = -L / 2; z < L / 2 - 0.01; z += 0.85) {
    const fr = new THREE.TorusGeometry(0.17, 0.018, 6, 24);
    fr.scale(1, 1.1, 1);
    fr.rotateY(Math.PI / 2);
    fr.translate(side * (Wd / 2 - 0.035), winY, z + winW / 2);
    frames.push(fr);
  }
  g.add(new THREE.Mesh(mergeGeometries(frames), new THREE.MeshStandardMaterial({ color: 0xbab6ae, roughness: 0.4 })));
  // dim cabin light strip + reading lights
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, L - 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.5, 0.42) }));
  strip.position.set(0, Hh - 0.12, 0);
  g.add(strip);
  for (const z of [-3.5, -1.0, 1.5, 3.9]) for (const side of [-1, 1]) {
    const gl = new THREE.PointLight(0x50e0b0, 0.3, 1.4, 2);
    gl.position.set(side * (Wd / 2 - 0.15), winY, z);
    g.add(gl);
  }
  return { group: g, seats, L, Wd, Hh, winY };
}

function buildOutside() {
  const g = new THREE.Group();
  // the wing out of the right side windows, with its nav light and a prop disc
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(7.5, 0.4); wingShape.lineTo(7.5, 1.1); wingShape.lineTo(0, 2.1);
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.45, metalness: 0.4 }));
  wing.rotation.x = Math.PI / 2;
  wing.position.set(0.85, 0.35, 0.4);
  g.add(wing);
  const nav = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 12, 1.5) }));
  nav.position.set(8.35, 0.5, -0.2);
  g.add(nav);
  const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 2.6, 16), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.5 }));
  nacelle.rotation.x = Math.PI / 2;
  nacelle.position.set(3.0, 0.3, -0.6);
  g.add(nacelle);
  const prop = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  prop.position.set(3.0, 0.3, -1.95);
  g.add(prop);
  // a moonlit cloud deck far below
  const noise = makeNoise2D(3);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  const img = c.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const n = noise.fbm(x / 70, y / 70, 5) * 0.5 + 0.5;
    const v = Math.max(0, (n - 0.42) * 2.4);
    const i = (y * 512 + x) * 4;
    img.data[i] = 150 * v; img.data[i + 1] = 175 * v; img.data[i + 2] = 200 * v; img.data[i + 3] = Math.min(255, v * 400);
  }
  c.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(0.5, 0.62, 0.7), depthWrite: false }));
  clouds.rotation.x = -Math.PI / 2;
  clouds.position.y = -900;
  g.add(clouds);
  return { group: g, nav, prop, clouds, tex };
}

registerScreen('plane', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.03, 6000);
  let cab, out, sky, d;
  let t = 0, yaw = 0.12, pitch = -0.12, fp = true, flashT = -1, taps = 0, waitTaps = false, shake = 0.004;
  let prompt = null;
  let finished = false, skipHold = 0;
  const camRoot = new THREE.Object3D();
  const plane = new THREE.Group(); // everything that flies

  function headCam() {
    const p = d.headPos('player');
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    camRoot.position.copy(p).add(new THREE.Vector3(0, 0.02, -0.06));
    camRoot.quaternion.copy(q);
    camera.position.copy(camRoot.position);
    camera.quaternion.copy(q);
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }

  async function script() {
    d.radioFor.add('nadia'); d.radioFor.add('lyosha'); d.radioFor.add('grisha'); d.radioFor.add('pilot');
    await d.wait(2.0);
    await d.say('pilot', 'p.pilot.welcome');
    await d.wait(2.5);
    await d.say('nadia', 'p.nadia.check');
    // tap the earpiece twice
    prompt = { text: 'TAP THE EARPIECE TWICE', action: 'interact' };
    waitTaps = true;
    taps = 0;
    let waited = 0;
    while (taps < 2 && waited < 25) { await d.wait(0.1); waited += 0.1; }
    waitTaps = false;
    prompt = null;
    await d.wait(0.6);
    await d.say('nadia', 'p.nadia.good');
    await d.say('lyosha', 'p.lyosha.hi');
    await d.say('nadia', 'p.nadia.lyosha');
    await d.say('nadia', 'p.nadia.rules');
    await d.say('nadia', 'p.nadia.koshkin');
    prompt = { text: 'LOOK AROUND', action: 'look' };
    await d.wait(7);
    prompt = null;
    // the flash
    d.actors.okafor.anim.override = (pose) => {
      pose.spine03 = { e: [0, 25, 0] }; pose.spine02 = { e: [0, 20, 0] }; pose.spine01 = { e: [0, 15, 0] };
      pose['upperarm01.R'] = { aim: [-0.2, -0.3, 1] };
      pose['lowerarm01.R'] = { aim: [0.3, 0.75, 0.6] };
      pose['upperarm01.L'] = { aim: [0.25, -0.3, 1] };
      pose['lowerarm01.L'] = { aim: [-0.35, 0.75, 0.6] };
    };
    await d.wait(1.2);
    flashT = 0;
    d.actors.okafor.anim.lookAt = d.headPos('player');
    await d.wait(0.5);
    // cut to him
    fp = false;
    d.cam({ ...d.closeUp('okafor', { side: 1, dist: 0.9, fov: 30 }), dur: 0 });
    await d.wait(1.6);
    d.actors.okafor.anim.override = null;
    fp = true;
    await d.say('nadia', 'p.nadia.flash');
    const c = await d.choose(['(Look away. Look out the window.)', '(Hold his stare.)'], { prompt: 'MR. GREY' });
    const prof = store.load('profile') || {};
    prof.flags = { ...(prof.flags || {}), stareGrey: c === 1 };
    store.save('profile', prof);
    if (c === 1) { yaw = 0.8; await d.wait(1.8); d.actors.okafor.anim.exprTarget.smile = 0.3; await d.wait(1.0); } else { yaw = -1.2; }
    await d.say('nadia', 'p.nadia.calm');
    // turbulence
    shake = 0.03;
    d.camShake = 0.02;
    await d.say('grisha', 'p.grisha.wind');
    await d.wait(1.5);
    shake = 0.004; d.camShake = 0;
    await d.say('nadia', 'p.nadia.land');
    await d.wait(2);
    await d.say('pilot', 'p.pilot.descent');
    await d.wait(1.5);
    finished = true;
    go('town', { newgame: 1 }, { transition: 'black' });
  }

  return {
    heavy: true,
    async enter() {
      game.renderer.setPost({ exposure: 1.1, bloomStrength: 0.5, vignette: 0.65, saturation: 0.95, grain: 0.05, letterbox: 0, lift: [0.01, 0.012, 0.02] }, true);
      scene.environment = getEnvMap(game.renderer.gl, 'night');
      scene.environmentIntensity = 0.3;
      sky = createSky();
      sky.uniforms.aurora.value = 1.4;
      scene.add(sky.mesh);
      cab = buildCabin();
      out = buildOutside();
      plane.add(cab.group, out.group);
      scene.add(plane);
      // light: aurora + moon through the windows, warm reading lights
      const auroraL = new THREE.DirectionalLight(0x50ffb0, 0.12);
      auroraL.position.set(10, 6, -4);
      scene.add(auroraL);
      const moon = new THREE.DirectionalLight(0x8aa8d8, 0.5);
      moon.position.set(-8, 10, 6);
      scene.add(moon);
      const cabinL = new THREE.PointLight(0xffe0b0, 1.4, 5, 2);
      cabinL.position.set(0, 1.5, 0.5);
      scene.add(cabinL);
      for (const z of [-1.6, 1.8]) {
        const rl = new THREE.SpotLight(0xffd8a0, 4, 2.2, 0.5, 0.6, 2);
        rl.position.set(0.5, 1.5, z);
        rl.target.position.set(0.5, 0.4, z);
        scene.add(rl, rl.target);
      }
      scene.add(new THREE.HemisphereLight(0x3a4a5a, 0x101418, 0.4));
      d = new Director(scene, camera);
      try { music.play('cb_night', { fade: 3, intensity: 0.3 }); } catch { /* */ }
      // passengers
      const seatOf = (row, side) => cab.seats.find((s) => s.row === row && s.side === side);
      const people = [['player', playerDNA(), seatOf(4, 1)], ['okafor', CAST.okafor.dna, seatOf(3, -1)],
        ['p1', { ...CAST.hank.dna, seed: 991, age: 60, beard: { style: 'full', stubble: 1 }, hair: { style: 'short', color: '#7a6a5a' } }, seatOf(2, -1)],
        ['p2', { ...CAST.ruth.dna, seed: 992, age: 52, hair: { style: 'long', color: '#1a1410' } }, seatOf(6, 1)]];
      for (const [id, dna, s] of people) {
        const ch = await buildCharacter(dna);
        ch.group.position.set(s.x, 0, s.z + 0.05);
        ch.group.rotation.y = Math.PI; // facing the front of the plane (−Z)
        plane.add(ch.group);
        const an = new Animator(ch);
        an.setPosture('sit'); an.postureW.sit = 1; an.postureW.stand = 0;
        an.sitHeight = 0.48;
        d.addActor(id, ch, an);
      }
      d.actors.p1.anim.exprTarget.squint = 1; // asleep
      d.actors.player.ch.meshes.head.visible = false; // first person: no head in the way
      for (const k of ['eyes', 'lashes', 'beard', 'teeth', 'tongue']) if (d.actors.player.ch.meshes[k]) d.actors.player.ch.meshes[k].visible = false;
      if (d.actors.player.ch.hair?.group) d.actors.player.ch.hair.group.visible = false;
      voice.preload(['p.pilot.welcome', 'p.nadia.check', 'p.nadia.good', 'p.lyosha.hi', 'p.nadia.lyosha', 'p.nadia.rules', 'p.nadia.koshkin', 'p.nadia.flash', 'p.nadia.calm', 'p.grisha.wind', 'p.nadia.land', 'p.pilot.descent']);
      input.wantPointerLock = true;
      script().catch((e) => console.error(e));
    },
    exit() { input.wantPointerLock = false; input.releasePointer(); voice.stopAll(); game.renderer.dof = null; },
    update(dt) {
      t += dt;
      // free look (mouse / right stick) in first person
      if (fp && !d.choice) {
        yaw -= input.mouseLook.dx * 0.0025 + input.look.x * dt * 1.8;
        pitch -= input.mouseLook.dy * 0.0025 + input.look.y * dt * 1.4;
        yaw = Math.max(-1.7, Math.min(1.7, yaw));
        pitch = Math.max(-0.7, Math.min(0.6, pitch));
      }
      d.update(dt);
      if (fp) { game.renderer.dof = null; headCam(); }
      if (game.query.has('debugcam')) { camera.position.set(0, 1.55, 5.2); camera.lookAt(0, 0.6, -2); camera.quaternion.premultiply(plane.quaternion); }
      sky.update(dt, camera);
      // the plane banks gently; the world outside drifts by
      plane.rotation.z = Math.sin(t * 0.21) * 0.012 + (shake > 0.01 ? Math.sin(t * 7) * 0.01 : 0);
      plane.position.y = Math.sin(t * 0.5) * 0.01;
      out.tex.offset.y += dt * 0.004;
      out.prop.rotation.z += dt * 40;
      out.nav.visible = Math.floor(t * 1.2) % 2 === 0;
      // the earpiece taps
      if (waitTaps && input.pressed('interact')) taps++;
      if (flashT >= 0) {
        flashT += dt;
        game.fx.flash = Math.max(0, 1 - flashT * 5) * 0.85;
        if (flashT > 0.4) flashT = -1;
      }
      if (input.keys.has('Escape') || input.padHeld(9)) skipHold += dt; else skipHold = 0;
      if (skipHold > 1.2 && !finished) { finished = true; voice.stopAll(); go('town', { newgame: 1 }, { transition: 'black' }); }
    },
    draw(ctx) {
      d.draw(ctx);
      if (t < 6) {
        const a = Math.min(1, t / 1.2) * Math.min(1, (6 - t) / 1.2);
        text(ctx, 'BERINGIA AIR 211', 80, 110, { size: 34, weight: 900, color: '#fff', alpha: a, italic: true, spacing: 4 });
        text(ctx, 'ANADYR → PORT ZARYA  ·  05:40', 82, 140, { size: 15, weight: 700, color: C.dim, alpha: a, spacing: 3 });
      }
      if (prompt) {
        const px = W / 2, py = 120;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(px - 190, py - 26, 380, 44);
        const gw = actionGlyph(ctx, prompt.action === 'look' ? 'look' : 'interact', px - 170, py - 4, 11);
        text(ctx, prompt.text + (prompt.action === 'interact' ? `  ${taps}/2` : ''), px - 170 + gw + 14, py + 2, { size: 16, weight: 800, color: '#fff', spacing: 2 });
      }
      if (skipHold > 0.1) text(ctx, 'HOLD TO SKIP', W - 60, 60, { size: 14, weight: 800, color: '#fff', align: 'right', alpha: Math.min(1, skipHold * 2), spacing: 2 });
    },
    view() { return { scene, camera }; },
  };
});
