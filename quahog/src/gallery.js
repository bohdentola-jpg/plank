// QA mode: line the whole cast up on a turntable so the models can be eyeballed.
//   quahog/index.html?cast            → the six Griffins
//   quahog/index.html?cast=all        → everyone in town
//   &clip=walk&spin=0.6&camy=1.6
import * as THREE from 'three';
import { InkPass, buildSky, toon } from './toon.js';
import { CHARACTERS, SUPPORTING, PLAYABLE, buildCharacter, poseRig, talk } from './cast.js';

/** QA: drop a camera over the town. ?city&x=..&z=..&h=..&ang=.. */
export async function cityPreview() {
  const { buildCity } = await import('./city.js');
  const params = new URLSearchParams(location.search);
  const holder = document.getElementById('world-holder');
  document.getElementById('scr-world').classList.add('active');
  document.getElementById('hud').style.display = 'none';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.4, 1400);
  const sky = buildSky(700);
  scene.add(sky.group);
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#6a7a4a', 1.0));
  const sun = new THREE.DirectionalLight('#fff6e0', 1.25);
  sun.position.set(120, 200, 90);
  scene.add(sun);

  const t0 = performance.now();
  const city = buildCity();
  scene.add(city.group);
  console.log('city built in', Math.round(performance.now() - t0), 'ms');
  let meshes = 0;
  city.group.traverse((o) => { if (o.isMesh) meshes++; });
  console.log('city meshes:', meshes, 'colliders:', city.colliders.all.length);

  const ink = new InkPass(renderer);
  ink.enabled = !params.has('noink');
  ink.setSize(innerWidth, innerHeight);
  scene.fog = new THREE.Fog('#dcecf8', 180, 520);

  const x = parseFloat(params.get('x') || '-180');
  const z = parseFloat(params.get('z') || '-40');
  const h = parseFloat(params.get('h') || '26');
  const ang = parseFloat(params.get('ang') || '0.6');
  const spin = parseFloat(params.get('spin') || '0');
  const dist = parseFloat(params.get('dist') || '46');
  const clock = new THREE.Clock();
  let t = 0;
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const a = ang + t * spin;
    cam.position.set(x + Math.sin(a) * dist, h, z + Math.cos(a) * dist);
    cam.lookAt(x, 2, z);
    sky.update(parseFloat(params.get('hour') || '12'), dt, cam.position);
    ink.render(scene, cam, [sky.dome]);
    requestAnimationFrame(tick);
  }
  tick();
  window.__city = { city, scene, cam };
}

export function castGallery() {
  const params = new URLSearchParams(location.search);
  const which = params.get('cast');
  const ids = which === 'all'
    ? [...PLAYABLE, ...Object.keys(SUPPORTING)]
    : which && which !== '' && which !== 'true' ? which.split(',') : PLAYABLE;
  const clip = params.get('clip') || 'idle';
  const spin = parseFloat(params.get('spin') || '0.25');

  const holder = document.getElementById('world-holder');
  document.getElementById('scr-world').classList.add('active');
  document.getElementById('hud').style.display = 'none';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 900);
  const sky = buildSky(500);
  scene.add(sky.group);
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#6a7a4a', 1.15));
  const sun = new THREE.DirectionalLight('#fff6e0', 1.3);
  sun.position.set(30, 60, 24);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon('#6fae4f'));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const perRow = Math.ceil(Math.sqrt(ids.length));
  const rigs = [];
  ids.forEach((id, i) => {
    const spec = CHARACTERS[id] || SUPPORTING[id];
    if (!spec) return;
    const rig = buildCharacter(spec);
    const col = i % perRow, row = (i / perRow) | 0;
    rig.group.position.set((col - (perRow - 1) / 2) * 1.9, 0, (row - (perRow - 1) / 2) * 2.2);
    scene.add(rig.group);
    rigs.push(rig);
  });

  const ink = new InkPass(renderer);
  ink.enabled = !params.has('noink');
  ink.setSize(innerWidth, innerHeight);

  const radius = parseFloat(params.get('dist') || String(3.2 + perRow * 1.7));
  const lookY = parseFloat(params.get('look') || '1.0');
  const clock = new THREE.Clock();
  let t = 0;
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    for (let i = 0; i < rigs.length; i++) {
      poseRig(rigs[i], clip, t + i * 0.37, { dt });
      if (Math.random() < 0.004) talk(rigs[i], 1.4);
    }
    sky.update(parseFloat(params.get('hour') || '12'), dt, new THREE.Vector3());
    const a = t * spin;
    cam.position.set(Math.sin(a) * radius, parseFloat(params.get('camy') || '1.9'), Math.cos(a) * radius);
    cam.lookAt(0, lookY, 0);
    ink.render(scene, cam, [sky.dome]);
    requestAnimationFrame(tick);
  }
  tick();

  addEventListener('resize', () => {
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    ink.setSize(innerWidth, innerHeight);
  });
  window.__gallery = { scene, cam, rigs, ink };
}
