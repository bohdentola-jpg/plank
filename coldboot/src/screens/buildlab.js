// QA screen for the building kit (world/buildings, world/props).
//   ?screen=buildlab&type=church&state=0&time=night|day|dusk&interior=0|1&seed=3&cam=0..n
//   &variant=ranch&snow=1&yaw=0.4&dist=1.0
//   type=props  → a grid of every prop
//   type=street → a row of six houses with old sodium + new smart streetlights
// Keys: ←/→ orbit, ↑/↓ zoom, C next camera, Q/E state −/+, R reseed.
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { input } from '../core/input.js';
import { text, C } from '../core/ui.js';
import { createSky } from '../world/sky.js';
import { createSnow } from '../world/snow.js';
import { getEnvMap } from '../core/envmap.js';
import { WU, updateNightMaterials } from '../world/worldUniforms.js';
import { getMaterial } from '../world/materials.js';
import { buildBuilding, BUILDING_KINDS } from '../world/buildings/index.js';
import { makeProp, PROP_TYPES, powerLine } from '../world/props.js';

const LIGHT_BUDGET = 10;

registerScreen('buildlab', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 3000);
  let sky = null, snow = null;
  let root = new THREE.Group();
  let params = {};
  let info = '', info2 = '';
  let t = 0;
  let presets = [];
  let camIdx = 0;
  let orbit = { yaw: 0, pitch: 0, dist: 1 };
  let labels = [];
  let dynLights = [];
  let res = null;

  function setTime(time) {
    const u = sky.uniforms;
    if (time === 'day') {
      WU.night.value = 0;
      u.zenith.value.setRGB(0.32, 0.38, 0.46);
      u.horizon.value.setRGB(0.62, 0.66, 0.7);
      u.ground.value.setRGB(0.35, 0.36, 0.38);
      u.sunAmt.value = 0.25;
      u.sunDir.value.set(0.5, 0.12, -0.85).normalize();
      u.starAmt.value = 0;
      u.aurora.value = 0;
      u.moonAmt.value = 0;
      u.cloud.value = 1;
      u.cloudColor.value.setRGB(0.66, 0.68, 0.72);
      scene.fog = new THREE.FogExp2(0x9aa3ad, 0.011);
      game.renderer.setPost({ exposure: 1.0, bloomStrength: 0.25, bloomThreshold: 1.6, vignette: 0.4, saturation: 0.95, contrast: 1.05, lift: [0.0, 0.0, 0.01] }, true);
    } else if (time === 'dusk') {
      WU.night.value = 0.7;
      u.zenith.value.setRGB(0.04, 0.06, 0.13);
      u.horizon.value.setRGB(0.35, 0.22, 0.25);
      u.sunAmt.value = 0.6;
      u.sunDir.value.set(0.7, 0.02, -0.7).normalize();
      u.starAmt.value = 0.3;
      u.aurora.value = 0.3;
      scene.fog = new THREE.FogExp2(0x1a1820, 0.008);
      game.renderer.setPost({ exposure: 1.1, bloomStrength: 0.7, vignette: 0.5, saturation: 1.0, lift: [0.0, 0.0, 0.01] }, true);
    } else {
      WU.night.value = 1;
      u.horizon.value.setRGB(0.03, 0.05, 0.075);
      u.ground.value.setRGB(0.02, 0.03, 0.045);
      u.aurora.value = 0.75;
      scene.fog = new THREE.FogExp2(0x070b12, 0.014);
      game.renderer.setPost({ exposure: 1.15, bloomStrength: 0.85, bloomThreshold: 1.0, vignette: 0.55, saturation: 1.05, lift: [0.0, 0.004, 0.012] }, true);
    }
    updateNightMaterials();
  }

  function addLights(time) {
    const day = time === 'day';
    const hemi = day ? new THREE.HemisphereLight(0xc8d4e0, 0x8a8a88, 1.35) : new THREE.HemisphereLight(0x1a2a44, 0x08090c, 0.4);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(day ? 0xfff2e0 : 0x8aa4d8, day ? 1.2 : 0.3);
    key.position.set(day ? 30 : -30, day ? 24 : 40, day ? 20 : 25);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = 40;
    key.shadow.camera.left = -s; key.shadow.camera.right = s; key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
    key.shadow.camera.far = 200;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    scene.add(key.target);
    if (!day) {
      const aur = new THREE.DirectionalLight(0x40ffa0, 0.1);
      aur.position.set(10, 50, -60);
      scene.add(aur);
    }
    return key;
  }

  // dark arctic night environment for reflections (the core 'night' preset is a neon city)
  function nightEnv() {
    const es = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = vP.y;
        vec3 c = h > 0.0 ? mix(vec3(0.03,0.06,0.08), vec3(0.01,0.015,0.03), pow(h, 0.6)) : mix(vec3(0.05,0.06,0.08), vec3(0.03,0.035,0.045), pow(-h, 0.5));
        c += vec3(0.02, 0.12, 0.07) * smoothstep(0.1, 0.5, h) * (1.0 - smoothstep(0.5, 0.95, h));
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    es.add(dome);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.5, 0.45) }));
      m.position.set(Math.cos(a) * 25, 6, Math.sin(a) * 25);
      es.add(m);
    }
    const pm = new THREE.PMREMGenerator(game.renderer.gl);
    const rt = pm.fromScene(es, 0.03, 0.1, 100);
    pm.dispose();
    return rt.texture;
  }

  function ground(size = 160) {
    const g = new THREE.CircleGeometry(size, 64);
    g.rotateX(-Math.PI / 2);
    // UVs in metres for the snow texture
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
    const m = new THREE.Mesh(g, getMaterial('snow'));
    m.receiveShadow = true;
    m.position.y = -0.02;
    return m;
  }

  function addResultLights(r, M) {
    for (const l of r.lights || []) {
      const v = new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(M);
      dynLights.push({ pos: v, color: l.color, intensity: l.intensity, distance: l.distance });
    }
  }

  function flushLights(focus) {
    // keep the strongest few lights near the focus point as real PointLights
    dynLights.sort((a, b) => a.pos.distanceTo(focus) / a.intensity - b.pos.distanceTo(focus) / b.intensity);
    const k = params.time === 'day' ? 0.8 : 4.0;
    for (const l of dynLights.slice(0, LIGHT_BUDGET)) {
      const pl = new THREE.PointLight(l.color, l.intensity * k, l.distance * 1.6, 1.4);
      pl.position.copy(l.pos);
      root.add(pl);
    }
  }

  function presetsFor(box, fp, interiorBox) {
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const R = Math.max(size.x, size.z, size.y * 1.2);
    const h = Math.max(size.y, 3);
    const list = [
      { pos: [c.x - R * 0.75, Math.min(h * 0.45, 6) + 1.2, box.max.z + R * 0.9], look: [c.x, h * 0.4, c.z], fov: 45 },
      { pos: [c.x + R * 0.8, Math.min(h * 0.4, 6) + 1.0, box.max.z + R * 0.85], look: [c.x, h * 0.38, c.z], fov: 45 },
      { pos: [c.x, 1.7, box.max.z + R * 1.1], look: [c.x, h * 0.42, c.z], fov: 42 },
      { pos: [c.x + R * 0.9, h * 0.6 + 2, box.min.z - R * 0.8], look: [c.x, h * 0.35, c.z], fov: 45 },
      { pos: [c.x - R * 0.9, h + R * 0.9, box.max.z + R * 1.0], look: [c.x, h * 0.2, c.z], fov: 45 },
      { pos: [c.x + 2.5, 1.65, box.max.z + 5.5], look: [c.x, 1.6, box.max.z - 1], fov: 50 },
    ];
    if (interiorBox) {
      // interior cameras from the gameplay points: from the door looking in, then
      // standing behind each point looking along its facing direction
      const pts = res ? res.points : {};
      const ic = interiorBox.getCenter(new THREE.Vector3());
      const ins = [];
      const din = pts.door_in;
      if (din) ins.push({ pos: [din.x - Math.sin(din.rot) * 0.6, din.y + 1.65, din.z - Math.cos(din.rot) * 0.6], look: [ic.x, din.y + 1.2, ic.z], fov: 72 });
      for (const [name, p] of Object.entries(pts)) {
        if (/^door|ladderTop|belfry|bells|domeTop|relay|steps|oilTank|yard|gate$/.test(name)) continue;
        if (p.y < interiorBox.min.y - 0.5) continue;
        const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
        ins.push({ name, pos: [p.x - fx * 2.2, p.y + 1.7, p.z - fz * 2.2], look: [p.x + fx * 1.2, p.y + 1.0, p.z + fz * 1.2], fov: 68 });
      }
      list.unshift(...ins);
    }
    return list;
  }

  function buildOne(type, p) {
    const t0 = performance.now();
    const r = buildBuilding(type, { seed: p.seed, state: p.state, interior: p.interior, variant: p.variant || undefined, name: p.name || undefined });
    const ms = performance.now() - t0;
    res = r;
    root.add(r.group);
    if (r.interior) root.add(r.interior);
    root.updateMatrixWorld(true);
    addResultLights(r, r.group.matrixWorld);
    const st = r.group.userData.stats || {};
    let calls = 0, tris = 0, icalls = 0, itris = 0;
    r.group.traverse((o) => { if (o.isMesh) { calls++; tris += o.geometry.index ? o.geometry.index.count / 3 : 0; } });
    if (r.interior) r.interior.traverse((o) => { if (o.isMesh) { icalls++; itris += o.geometry.index ? o.geometry.index.count / 3 : 0; } });
    info = `${type}${p.variant ? ' / ' + p.variant : ''}  seed ${p.seed}  state ${p.state}  ·  ext ${calls} calls ${Math.round(tris / 1000)}k tris${r.interior ? `  ·  int ${icalls} calls ${Math.round(itris / 1000)}k tris` : ''}  ·  ${ms.toFixed(0)} ms`;
    info2 = `footprint ${r.footprint.w.toFixed(1)}×${r.footprint.d.toFixed(1)} m  ·  doors ${r.doors.length}  colliders ${r.colliders.length}  lights ${r.lights.length}  cameras ${r.cameras.length}  ·  points: ${Object.keys(r.points).slice(0, 14).join(', ')}${Object.keys(r.points).length > 14 ? '…' : ''}`;
    void st;
    const box = new THREE.Box3().setFromObject(r.group);
    const ibox = r.interior ? new THREE.Box3().setFromObject(r.interior) : null;
    presets = presetsFor(box, r.footprint, p.interior ? ibox : null);
    return box;
  }

  function buildProps(p) {
    const types = PROP_TYPES;
    const cols = 8;
    const sp = 6.5;
    types.forEach((ty, i) => {
      const g = makeProp(ty, { seed: p.seed, names: ['Front St', 'Main St'], name: 'MARGARET ROSE II', lit: true, light: true, transformer: i % 2 === 0 });
      const x = ((i % cols) - (cols - 1) / 2) * sp, z = -Math.floor(i / cols) * sp;
      g.position.set(x, 0, z);
      if (ty === 'fishingBoat') { g.position.set(0, 0, 9); g.rotation.y = Math.PI / 2; }
      root.add(g);
      labels.push({ text: ty, pos: new THREE.Vector3(g.position.x, -0.3, g.position.z + 2.2) });
      root.updateMatrixWorld(true);
      for (const l of g.userData.lights) dynLights.push({ pos: new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(g.matrixWorld), color: l.color, intensity: l.intensity, distance: l.distance });
    });
    info = `props: ${types.length} types`;
    const rows = Math.ceil(types.length / cols);
    const box = new THREE.Box3(new THREE.Vector3(-cols * sp / 2, 0, -rows * sp), new THREE.Vector3(cols * sp / 2, 4, 3));
    presets = [
      { pos: [0, 26, 28], look: [0, 0, -12], fov: 50 },
      { pos: [-14, 6, 10], look: [-12, 1, -2], fov: 45 },
      { pos: [10, 6, 10], look: [12, 1, -2], fov: 45 },
      { pos: [-14, 6, -4], look: [-12, 1, -15], fov: 45 },
      { pos: [10, 6, -4], look: [12, 1, -15], fov: 45 },
      { pos: [-14, 6, -16], look: [-12, 1, -28], fov: 45 },
      { pos: [10, 6, -16], look: [12, 1, -28], fov: 45 },
    ];
    return box;
  }

  function buildStreet(p) {
    // road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 8).rotateX(-Math.PI / 2), getMaterial('snow_dirty'));
    const uv = road.geometry.attributes.uv, pos = road.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    road.position.set(0, 0.01, 12);
    road.receiveShadow = true;
    root.add(road);
    let tris = 0;
    const poles = [];
    for (let i = 0; i < 6; i++) {
      const r = buildBuilding('house', { seed: p.seed * 10 + i, state: Math.min(1, Math.max(0, p.state + ((i * 37) % 5 - 2) * 0.15)) });
      r.group.position.set((i - 2.5) * 16, 0, 0);
      root.add(r.group);
      root.updateMatrixWorld(true);
      addResultLights(r, r.group.matrixWorld);
      r.group.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
      // streetlights across the road: old sodium on power poles, a NORTHSTAR smart light every third
      const smart = i % 3 === 1;
      const lp = smart ? makeProp('smartLight', {}) : makeProp('powerPole', { light: true, transformer: i % 2 === 0 });
      lp.position.set((i - 2.5) * 16 + 8, 0, smart ? 16.6 : 17);
      lp.rotation.y = Math.PI;
      root.add(lp);
      root.updateMatrixWorld(true);
      for (const l of lp.userData.lights) dynLights.push({ pos: new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(lp.matrixWorld), color: l.color, intensity: l.intensity, distance: l.distance });
      if (!smart) poles.push({ x: lp.position.x, z: lp.position.z, rot: Math.PI });
    }
    for (let i = 0; i < poles.length - 1; i++) root.add(powerLine(poles[i], poles[i + 1]));
    for (let i = 0; i < 4; i++) {
      const sb = makeProp('snowbank', { len: 6 + (i % 2) * 3, w: 1.6, h: 0.9, seed: i });
      sb.position.set(-40 + i * 24, 0, 16.8);
      root.add(sb);
    }
    info = `street: 6 houses  ·  ${Math.round(tris / 1000)}k tris`;
    const box = new THREE.Box3(new THREE.Vector3(-48, 0, -8), new THREE.Vector3(48, 10, 18));
    presets = [
      { pos: [-30, 5, 30], look: [-5, 3, 2], fov: 50 },
      { pos: [25, 3.5, 26], look: [0, 3, 4], fov: 50 },
      { pos: [0, 1.7, 22], look: [0, 3, 0], fov: 60 },
      { pos: [-45, 22, 50], look: [0, 0, 0], fov: 50 },
    ];
    return box;
  }

  return {
    heavy: true,
    enter(q) {
      params = {
        type: q.type || 'house',
        seed: parseInt(q.seed || '1', 10),
        state: parseFloat(q.state ?? '0.5'),
        time: q.time || 'night',
        interior: q.interior === '1' || q.interior === 'true',
        variant: q.variant || '',
        name: q.name || '',
        lamps: q.lamps !== '0',
      };
      camIdx = parseInt(q.cam || '0', 10);
      orbit.yaw = parseFloat(q.yaw || '0');
      orbit.dist = parseFloat(q.dist || '1');
      WU.snowCover.value = parseFloat(q.snow ?? '1');
      sky = createSky();
      scene.add(sky.mesh);
      snow = createSnow({ count: 6000, box: 70, height: 35 });
      snow.uniforms.size.value = 0.05;
      snow.intensity = q.falling === '0' ? 0 : params.time === 'day' ? 0.5 : 0.75;
      scene.add(snow.points);
      setTime(params.time);
      scene.environment = params.time === 'day' ? getEnvMap(game.renderer.gl, 'overcast') : nightEnv();
      scene.environmentIntensity = params.time === 'day' ? 0.6 : 0.22;
      scene.add(root);
      root.add(ground());
      const key = addLights(params.time);
      let box;
      try {
        if (params.type === 'props') box = buildProps(params);
        else if (params.type === 'street') box = buildStreet(params);
        else box = buildOne(params.type, params);
      } catch (e) {
        console.error(e);
        info = 'ERROR: ' + (e.message || e);
        box = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 5, 5));
        presets = presetsFor(box, { w: 10, d: 10 });
      }
      const c = box.getCenter(new THREE.Vector3());
      // a couple of old sodium streetlights for night shots of a single building
      if (params.time !== 'day' && params.lamps !== false && !['props', 'street'].includes(params.type) && !params.interior) {
        const sz = box.getSize(new THREE.Vector3());
        for (const sx of [-1, 1]) {
          const lp = makeProp('sodiumLight', {});
          lp.position.set(c.x + sx * (sz.x / 2 + 5), 0, box.max.z + 6);
          lp.rotation.y = Math.PI + sx * 0.5;
          root.add(lp);
          root.updateMatrixWorld(true);
          for (const l of lp.userData.lights) dynLights.push({ pos: new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(lp.matrixWorld), color: l.color, intensity: l.intensity, distance: l.distance });
        }
      }
      key.target.position.copy(c);
      key.position.copy(c).add(params.time === 'day' ? new THREE.Vector3(30, 26, 22) : new THREE.Vector3(-30, 40, 25));
      const half = Math.max(box.getSize(new THREE.Vector3()).length() * 0.6, 12);
      Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
      key.shadow.camera.updateProjectionMatrix();
      flushLights(c);
      camIdx = Math.min(camIdx, presets.length - 1);
    },
    exit() {
      scene.traverse((o) => { if (o.isPoints) { o.geometry.dispose(); o.material.dispose(); } });
    },
    update(dt) {
      t += dt;
      WU.time.value += dt;
      if (input.pressed('left')) orbit.yaw -= 0.25;
      if (input.pressed('right')) orbit.yaw += 0.25;
      if (input.pressed('up')) orbit.dist = Math.max(0.3, orbit.dist * 0.85);
      if (input.pressed('down')) orbit.dist = Math.min(3, orbit.dist / 0.85);
      if (input.pressed('camera')) { camIdx = (camIdx + 1) % Math.max(1, presets.length); orbit.yaw = 0; orbit.dist = 1; }
      const pr = presets[camIdx] || { pos: [10, 6, 14], look: [0, 2, 0], fov: 45 };
      const look = new THREE.Vector3(...pr.look);
      const off = new THREE.Vector3(...pr.pos).sub(look);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.yaw).multiplyScalar(orbit.dist);
      camera.position.copy(look).add(off);
      camera.fov = pr.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(look);
      sky.update(dt, camera);
      snow.update(dt, camera, game.renderer.targets.h);
    },
    draw(ctx) {
      text(ctx, info, 30, 664, { size: 14, color: '#d8e8f0' });
      text(ctx, info2, 30, 686, { size: 12, color: C.dim });
      text(ctx, `cam ${camIdx}/${Math.max(0, presets.length - 1)}${presets[camIdx]?.name ? ' ' + presets[camIdx].name : ''}  ·  ${game.fps ? game.fps.toFixed(0) + ' fps' : ''}`, 1250, 686, { size: 12, color: C.dim, align: 'right' });
      if (labels.length) {
        for (const l of labels) {
          const v = l.pos.clone().project(camera);
          if (v.z > 1 || v.z < -1) continue;
          const x = (v.x * 0.5 + 0.5) * 1280, y = (-v.y * 0.5 + 0.5) * 720;
          if (x < 0 || x > 1280 || y < 0 || y > 720) continue;
          text(ctx, l.text, x, y, { size: 12, color: '#ffe8a0', align: 'center' });
        }
      }
    },
    view() { return { scene, camera }; },
  };
});

export { BUILDING_KINDS };
