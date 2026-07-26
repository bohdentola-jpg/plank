// FOCUS GROUP — ?props
//
// Every model in the game, on a grid, under one even light, with its name
// written on the floor in front of it. This exists because a prop that is
// wrong is only wrong from one angle in one room, and a grid shows you all of
// them at once.
//
//   ?props                a slow orbit of the whole shelf
//   ?props&row=2          look at one row head-on
//   ?props&only=television
//   ?props&spin=0         hold still

import * as THREE from 'three';
import { World } from './world.js';
import { simple, liveCanvas } from './textures.js';
import * as P from './props.js';

// [name, height it wants, how it gets built]. The build gets the world and a
// centre, and everything must sit with its feet on y = 0.
const SHELF = [
  ['sofa', (w, x, z) => P.sofa(w, x, z, 0)],
  ['coffeeTable', (w, x, z) => P.coffeeTable(w, x, z)],
  ['television', (w, x, z) => P.television(w, x, z, 0).setOn(true)],
  ['sideboard', (w, x, z) => P.sideboard(w, x, z, 0)],
  ['standardLamp', (w, x, z) => P.standardLamp(w, x, z).setOn(true)],
  ['radiator', (w, x, z) => P.radiator(w, x, z, 0)],
  ['wallClock', (w, x, z) => P.wallClock(w, x, 1.6, z, 0).setTime(401)],
  ['window7 (shut)', (w, x, z) => P.window7(w, x, z, { w: 2.0, h: 1.2, y: 0.95 }).setOpen(0)],
  ['window7 (open)', (w, x, z) => P.window7(w, x, z, { w: 2.0, h: 1.2, y: 0.95 }).setOpen(1)],

  ['counterRun', (w, x, z) => P.counterRun(w, x - 0.95, x + 0.95, z, { face: -1 })],
  ['wallUnits', (w, x, z) => P.wallUnits(w, x - 0.5, x + 0.5, z, { face: -1 })],
  ['sink', (w, x, z) => P.sink(w, x, z)],
  ['fridge', (w, x, z) => P.fridge(w, x, z, 0)],
  ['cooker', (w, x, z) => P.cooker(w, x, z)],
  ['extractor', (w, x, z) => P.extractor(w, x, z)],
  ['coffeeMaker', (w, x, z) => { const c = P.coffeeMaker(w, x, z, 0); c.setFull(true); c.setBrewing(true); }],
  ['mug', (w, x, z) => P.mug(w, x, 0.82, z, { lens: true })],
  ['dinetteTable', (w, x, z) => P.dinetteTable(w, x, z)],
  ['chair', (w, x, z) => P.chair(w, x, z, 0)],

  ['bed', (w, x, z) => P.bed(w, x, z, 0)],
  ['bedsideTable', (w, x, z) => P.bedsideTable(w, x, z)],
  ['clockRadio', (w, x, z) => P.clockRadio(w, x, 0.55, z, 0)],
  ['wardrobe', (w, x, z) => P.wardrobe(w, x, z, 0)],

  ['basin', (w, x, z) => P.basin(w, x, z)],
  ['cabinetMirror', (w, x, z) => P.cabinetMirror(w, x, 1.5, z)],
  ['bath', (w, x, z) => P.bath(w, x, z, 0)],
  ['toilet', (w, x, z) => P.toilet(w, x, z, 0)],

  ['smokeDetector', (w, x, z) => P.smokeDetector(w, x, 1.9, z)],
  ['frontDoor', (w, x, z) => P.frontDoor(w, x, z, 0)],
  ['parcel', (w, x, z) => P.parcel(w, x, z)],
  ['figurine', (w, x, z) => P.figurine(w, x, 0.82, z, { lens: true })],
  ['giftLamp', (w, x, z) => P.giftLamp(w, x, 0.82, z, { lens: true }).setOn(true)],
  ['floorMark', (w, x, z) => P.floorMark(w, x, z, 0)],
  ['lensBead', (w, x, z) => { const g = P.lensBead(0.09); g.position.set(x, 1.0, z); w.add(g); }],

  ['studioCamera', (w, x, z) => P.studioCamera(w, x, z, { rotY: 0 }).setLive(true)],
  ['monitorWall', (w, x, z) => P.monitorWall(w, x, 1.4, z, { cols: 4, rows: 3, w: 2.2, h: 1.4 })],
  ['lightBar', (w, x, z) => P.lightBar(w, x, 2.2, z, { w: 2.2, n: 3 }).setLevel(1)],
  ['applauseSign', (w, x, z) => P.applauseSign(w, x, 1.5, z).setOn(true)],
  ['audience', (w, x, z) => P.audience(w, x, z - 0.6, { rows: 2, per: 4 })],

  ['pipeRun', (w, x, z) => P.pipeRun(w, x - 1.0, x + 1.0, 1.8, z)],
  ['cableTray', (w, x, z) => P.cableTray(w, x - 1.0, x + 1.0, 1.6, z)],
  ['servicesDoor', (w, x, z) => P.servicesDoor(w, x, z, 0)],

  ['valMascot', (w, x, z) => { P.valMascot(w, x, z, { rotY: 0 }).group.visible = true; }],
  ['avatar', (w, x, z) => {
    const a = P.avatar({});
    a.group.position.set(x, 0, z);
    a.group.rotation.y = 0;
    P.poseAvatar(a, 1, 0.6, 0);
    w.add(a.group);
  }],
];

const COLS = 5;
const CELL = 3.0;

function nameplate(world, text, x, z) {
  const live = liveCanvas(256, 64);
  const { ctx, cv } = live;
  ctx.fillStyle = '#101014';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#e8dcb4';
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  live.touch();
  const geo = new THREE.PlaneGeometry(1.5, 0.375);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: live.tex }));
  m.position.set(x, 0.02, z + CELL * 0.42);
  world.add(m);
}

export function propsMode(game) {
  const qs = new URLSearchParams(location.search);
  const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);
  const only = qs.get('only');

  const rowArg = qs.has('row') ? Math.round(num('row', 0)) : null;
  let list = only ? SHELF.filter(([n]) => n.startsWith(only)) : SHELF;
  // one row at a time, alone on the deck — otherwise the row behind stands in
  // front of the row you are trying to look at
  if (rowArg !== null && !only) list = list.slice(rowArg * COLS, rowArg * COLS + COLS);
  const w = new World('props');
  w.bounds = { x0: -200, x1: 200, z0: -200, z1: 200 };
  w.room('stage', -200, -200, 200, 200, 'concrete');

  // a short row centres on what is actually in it, so `only=` puts its one
  // model in front of the camera instead of out at column zero
  const cols = Math.min(COLS, Math.max(1, list.length));
  const rows = Math.ceil(list.length / cols);
  const width = cols * CELL, depth = rows * CELL;

  // a plain grey deck and a grid, so anything floating or sunk is obvious
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(width + CELL * 2, depth + CELL * 2),
    simple(0x6e6e78, { rough: 0.95 })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, -0.001, 0);
  deck.receiveShadow = true;
  w.add(deck);
  const grid = new THREE.GridHelper(Math.max(width, depth) + CELL * 2,
    Math.round((Math.max(width, depth) + CELL * 2) / CELL), 0x6a6a72, 0x3a3a40);
  grid.position.y = 0.004;
  w.add(grid);

  list.forEach(([name, build], i) => {
    const cx = (i % cols - (cols - 1) / 2) * CELL;
    const cz = (Math.floor(i / cols) - (rows - 1) / 2) * CELL;
    try { build(w, cx, cz); } catch (e) { console.error(`prop '${name}' threw:`, e.message); }
    nameplate(w, name, cx, cz);
  });

  // even, boring light: no mood, nowhere for a mistake to hide
  w.light(new THREE.AmbientLight(0xffffff, 4.6), 'ambient');
  w.light(new THREE.HemisphereLight(0xe8eef8, 0x6a6252, 3.4), 'ambient');
  const key = new THREE.DirectionalLight(0xffffff, 3.6);
  key.position.set(6, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const R = Math.max(width, depth);
  Object.assign(key.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 60 });
  w.light(key, 'ambient');
  const back = new THREE.DirectionalLight(0xc8d4ff, 1.8);
  back.position.set(-8, 6, -10);
  w.light(back, 'ambient');

  game.teardown();
  game.world = w;
  game.scene.add(w.group);
  game.scene.background = new THREE.Color(0x1a1a20);
  game.showScreen('play');
  game.hud.setVisible(false);
  game.lens.setStrip(null);
  // a gallery wants no mood: no vignette, no grain, no key light with a story
  game.galleryClean = true;
  game.renderer.toneMappingExposure = 1.25;
  game.day = { n: 4, light: 0, lenses: [] };
  game.dayIndex = 3;
  game.steps = [];
  game.warm = 0;

  const spin = num('spin', 0.12);
  let ang = num('ang', 0);

  game.tick = (dt) => {
    if (rowArg !== null || only) {
      game.camera.position.set(num('x', 0), num('y', 2.8), num('dist', 10.6));
      game.camera.lookAt(num('x', 0), num('h', 0.9), 0);
    } else {
      ang += spin * dt;
      const r = num('dist', Math.max(width, depth) * 0.85);
      game.camera.position.set(Math.sin(ang) * r, num('y', r * 0.62), Math.cos(ang) * r);
      game.camera.lookAt(0, 0.8, 0);
    }
    w.update(dt, game);
  };
  game.state = 'play';
  game.paused = false;

  window.__fgprops = { world: w, rows, cols: COLS, cell: CELL, names: list.map(([n]) => n) };
}
