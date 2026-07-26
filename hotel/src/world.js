// The hotel you can actually look at: a dollhouse cutaway you orbit around.
// Rooms have no front wall, so you watch the beds get stripped and the guests
// flop onto them. Structure is rebuilt only when the building changes; the rest
// (people, light, the sign, the water) is updated every frame.
import * as THREE from 'three';
import {
  mkCanvas, tex, shade, mix, carpetCanvas, roomCarpetCanvas, wallpaperCanvas, stuccoCanvas,
  brickCanvas, tileCanvas, asphaltCanvas, grassCanvas, bedCanvas, artCanvas, tvCanvas,
  signCanvas, vacancyCanvas, doorPlateCanvas, skyCanvas, posterCanvas, woodCanvas,
  marbleCanvas, poolWaterCanvas,
} from './textures.js';
import { buildPerson, posePerson, setPersonMood, disposePerson, randomLook, staffLook } from './people.js';
import * as nav from './nav.js';
import { TIERS, SLOTS_PER_FLOOR } from './data.js';
import { roomNumber } from './sim.js';

const ROOM_H = 3.0;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, m) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function plane(w, h, m) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.receiveShadow = true;
  return mesh;
}

// Sky anchors get regenerated on the half hour; everything else is built once.
const SKY_STEP = 30;

export class World {
  constructor(holder, state) {
    this.holder = holder;
    this.state = state;
    this.people = new Map();     // id -> rig
    this.roomVis = new Map();    // roomId -> parts
    this.pickables = [];
    this.hovered = null;
    this.selected = null;
    this.time = 0;
    this._skyHour = -99;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    holder.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#1b2436', 70, 190);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
    this.orbit = { yaw: 0.30, pitch: 0.42, dist: 52, target: new THREE.Vector3(0, 6, -1) };

    this.sun = new THREE.DirectionalLight('#fff4dd', 1.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -46; cam.right = 46; cam.top = 40; cam.bottom = -24; cam.near = 1; cam.far = 160;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#bfd8ff', '#5a4a3a', 0.55);
    this.scene.add(this.hemi);

    this.lobbyLight = new THREE.PointLight('#ffd9a0', 0, 26, 1.6);
    this.lobbyLight.position.set(nav.DESK_X + 3, 2.6, -1.4);
    this.scene.add(this.lobbyLight);

    this.signLight = new THREE.PointLight('#ff8f5a', 0, 22, 2);
    this.signLight.position.set(-nav.HALF_W - 3, 7.5, 9);
    this.scene.add(this.signLight);

    this.buildStatic();
    this.rebuild();
    this.resize();
    this.bindInput();
  }

  // ---------------------------------------------------------------- ground
  buildStatic() {
    this.static = new THREE.Group();
    this.scene.add(this.static);

    const lot = plane(190, 190, new THREE.MeshLambertMaterial({ map: tex(asphaltCanvas('#3c3d43'), { repeat: [16, 16] }) }));
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(0, -0.02, 10);
    this.static.add(lot);

    const grass = plane(190, 74, new THREE.MeshLambertMaterial({ map: tex(grassCanvas('#4e6b3c'), { repeat: [20, 8] }) }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.01, -50);
    this.static.add(grass);

    // The road out front, and the stripes that say this place is off a highway.
    const road = plane(190, 13, mat('#2b2c31'));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 30);
    this.static.add(road);
    const stripeMat = mat('#d8c46a');
    for (let i = -9; i <= 9; i++) {
      const s = plane(5.5, 0.42, stripeMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(i * 10, 0.03, 30);
      this.static.add(s);
    }
    // Parking bays.
    const bayMat = mat('#cfc9b6');
    for (let i = 0; i < 9; i++) {
      const s = plane(0.24, 8, bayMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(-18 + i * 4.6, 0.02, 14);
      this.static.add(s);
    }

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 32, 20),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false }),
    );
    this.scene.add(this.sky);
    this.updateSky(12);

    // Two lot lights so the parking apron is not a black hole after dark.
    this.lotLamps = [];
    for (const lx of [-24, 24]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 9, 8), mat('#5c5952'));
      pole.position.set(lx, 4.5, 16);
      this.static.add(pole);
      const head = box(1.5, 0.3, 0.9, mat('#6d6a62'));
      head.position.set(lx, 9.1, 16);
      this.static.add(head);
      const bulb = plane(1.3, 0.75, new THREE.MeshBasicMaterial({ color: '#ffeec2', transparent: true, opacity: 0 }));
      bulb.rotation.x = -Math.PI / 2;
      bulb.position.set(lx, 8.92, 16);
      this.static.add(bulb);
      const light = new THREE.PointLight('#ffe3ad', 0, 40, 1.7);
      light.position.set(lx, 8.6, 16);
      this.scene.add(light);
      this.lotLamps.push({ bulb, light });
    }

    this.cars = new THREE.Group();
    this.static.add(this.cars);
  }

  updateSky(h) {
    if (Math.abs(h * 60 - this._skyHour) < SKY_STEP) return;
    this._skyHour = h * 60;
    const old = this.sky.material.map;
    this.sky.material.map = tex(skyCanvas(h), { srgb: true });
    this.sky.material.needsUpdate = true;
    if (old) old.dispose();
  }

  // ---------------------------------------------------------------- building
  structureKey(s) {
    return [
      s.floors,
      s.rooms.map((r) => `${r.built ? r.tier : 0}`).join(''),
      Object.keys(s.amenities).filter((k) => s.amenities[k]).sort().join(','),
      s.facade, s.ink, s.accent, s.name,
    ].join('|');
  }

  rebuild() {
    const s = this.state;
    this._key = this.structureKey(s);
    if (this.building) {
      this.scene.remove(this.building);
      disposeTree(this.building);
    }
    this.roomVis.clear();
    this.pickables = [];
    this.building = new THREE.Group();
    this.scene.add(this.building);

    const facadeCanvas = s.facade === 'brick' ? brickCanvas('#9a4a32')
      : s.facade === 'modern' ? stuccoCanvas('#8f96a3') : stuccoCanvas('#d8c9a8');
    this.facadeMat = new THREE.MeshLambertMaterial({ map: tex(facadeCanvas, { repeat: [6, 2] }) });
    this.trimMat = mat(s.accent);
    this.slabMat = new THREE.MeshLambertMaterial({ map: tex(marbleCanvas('#cdc7bb', '#9b958a'), { repeat: [8, 2] }) });

    this.walkwayLights = [];
    this.buildLobby();
    for (let f = 1; f <= s.floors; f++) this.buildFloor(f);
    this.buildStairs();
    if (s.amenities.elevator) this.buildElevator();
    this.buildSign();
    this.buildOutside();
  }

  addPick(mesh, kind, id) {
    mesh.userData.pick = { kind, id };
    this.pickables.push(mesh);
  }

  buildLobby() {
    const s = this.state;
    const g = new THREE.Group();
    this.building.add(g);

    const floor = plane(nav.WIDTH, 7.6, new THREE.MeshLambertMaterial({ map: tex(marbleCanvas('#d9d2c4', '#a89f8e'), { repeat: [5, 2] }) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, (nav.LOBBY_BACK + nav.RAIL_Z) / 2);
    g.add(floor);

    const back = box(nav.WIDTH, ROOM_H + 0.4, 0.35, new THREE.MeshLambertMaterial({ map: tex(wallpaperCanvas('#e3d9c4', s.ink), { repeat: [8, 1] }) }));
    back.position.set(0, (ROOM_H + 0.4) / 2, nav.LOBBY_BACK);
    g.add(back);

    for (const sx of [-nav.HALF_W, nav.HALF_W]) {
      const side = box(0.35, ROOM_H + 0.4, 8, this.facadeMat);
      side.position.set(sx, (ROOM_H + 0.4) / 2, (nav.LOBBY_BACK + nav.RAIL_Z) / 2);
      g.add(side);
    }

    // Front glazing with a gap where the doors are.
    const glass = new THREE.MeshLambertMaterial({ color: '#9fd0dd', transparent: true, opacity: 0.28 });
    for (const seg of [[-nav.HALF_W, nav.DOOR_X - 1.9], [nav.DOOR_X + 1.9, nav.HALF_W]]) {
      const w = seg[1] - seg[0];
      if (w < 0.4) continue;
      const pane = box(w, ROOM_H - 0.3, 0.12, glass);
      pane.position.set((seg[0] + seg[1]) / 2, (ROOM_H - 0.3) / 2 + 0.2, nav.RAIL_Z);
      pane.castShadow = false;
      g.add(pane);
    }
    const canopy = box(9, 0.3, 4.4, this.trimMat);
    canopy.position.set(nav.DOOR_X, ROOM_H + 0.35, nav.RAIL_Z + 1.6);
    g.add(canopy);
    for (const px of [nav.DOOR_X - 3.6, nav.DOOR_X + 3.6]) {
      const post = box(0.28, ROOM_H + 0.3, 0.28, mat('#9a958c'));
      post.position.set(px, (ROOM_H + 0.3) / 2, nav.RAIL_Z + 3.3);
      g.add(post);
    }

    // ---- front desk
    const deskMat = new THREE.MeshLambertMaterial({ map: tex(woodCanvas('#6b4426'), { repeat: [3, 1] }) });
    const desk = box(6.2, 1.15, 1.5, deskMat);
    desk.position.set(nav.DESK_X, 0.575, nav.DESK_Z);
    g.add(desk);
    const counter = box(6.6, 0.14, 1.9, mat(shade('#6b4426', 40)));
    counter.position.set(nav.DESK_X, 1.19, nav.DESK_Z);
    g.add(counter);
    this.addPick(desk, 'desk', 'desk');

    const keyRack = box(3.0, 1.5, 0.16, mat('#5a3a1f'));
    keyRack.position.set(nav.DESK_X, 1.9, nav.LOBBY_BACK + 0.3);
    g.add(keyRack);
    for (let i = 0; i < 12; i++) {
      const k = box(0.1, 0.34, 0.06, mat(i % 3 === 0 ? s.accent : '#c9c2b4'));
      k.position.set(nav.DESK_X - 1.25 + (i % 6) * 0.5, 2.28 - Math.floor(i / 6) * 0.52, nav.LOBBY_BACK + 0.4);
      g.add(k);
    }
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d8b24a'));
    bell.position.set(nav.DESK_X + 2.4, 1.3, nav.DESK_Z + 0.4);
    g.add(bell);

    // ---- seating cluster
    const sofaMat = mat(mix(s.ink, '#4a3b33', 0.45));
    for (let i = 0; i < 2; i++) {
      const seat = box(2.6, 0.42, 1.0, sofaMat);
      seat.position.set(2.6 + i * 4.2, 0.36, -3.6);
      g.add(seat);
      const back2 = box(2.6, 0.75, 0.28, sofaMat);
      back2.position.set(2.6 + i * 4.2, 0.75, -4.05);
      g.add(back2);
    }
    const table = box(1.5, 0.1, 1.0, mat('#5a4a38'));
    table.position.set(4.7, 0.5, -2.3);
    g.add(table);
    g.add(potted(3.0, 0, -4.9));
    g.add(potted(11.2, 0, -4.4));

    // ---- laundry / linen room
    const linenWall = box(0.3, ROOM_H, 3.6, mat('#c8bda6'));
    linenWall.position.set(nav.LAUNDRY_X - 2.2, ROOM_H / 2, nav.LAUNDRY_Z + 0.4);
    g.add(linenWall);
    for (let i = 0; i < 3; i++) {
      const washer = box(0.95, 1.0, 0.9, mat('#dcdcd6'));
      washer.position.set(nav.LAUNDRY_X - 1.2 + i * 1.15, 0.5, nav.LAUNDRY_Z);
      g.add(washer);
      const port = box(0.42, 0.42, 0.06, mat('#39424a'));
      port.position.set(nav.LAUNDRY_X - 1.2 + i * 1.15, 0.58, nav.LAUNDRY_Z + 0.48);
      g.add(port);
    }
    const shelf = box(3.6, 1.6, 0.7, mat('#b8ae98'));
    shelf.position.set(nav.LAUNDRY_X + 0.4, 0.8, nav.LAUNDRY_Z - 1.6);
    g.add(shelf);
    this.addPick(shelf, 'laundry', 'laundry');

    this.buildAmenityProps(g);
  }

  buildAmenityProps(g) {
    const s = this.state;
    const A = s.amenities;
    if (A.vending) {
      for (let i = 0; i < 2; i++) {
        const m = box(1.1, 2.0, 0.7, mat(i ? '#b8352f' : '#2f5aa8'));
        m.position.set(-nav.HALF_W + 1.2 + i * 1.3, 1.0, nav.LOBBY_BACK + 0.8);
        g.add(m);
        const win = box(0.7, 1.2, 0.06, new THREE.MeshLambertMaterial({ color: '#cfe6ef', emissive: '#28323a' }));
        win.position.set(-nav.HALF_W + 1.2 + i * 1.3, 1.25, nav.LOBBY_BACK + 1.18);
        g.add(win);
      }
    }
    if (A.coffee) {
      const bar = box(2.6, 1.0, 0.8, mat('#4b3524'));
      bar.position.set(-1.6, 0.5, nav.LOBBY_BACK + 0.9);
      g.add(bar);
      for (let i = 0; i < 2; i++) {
        const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.5, 10), mat('#cfd3d6'));
        urn.position.set(-2.2 + i * 1.2, 1.25, nav.LOBBY_BACK + 0.9);
        g.add(urn);
      }
    }
    if (A.breakfast) {
      const buffet = box(4.4, 0.95, 1.1, mat('#d9c9a6'));
      buffet.position.set(-11.5, 0.48, -3.4);
      g.add(buffet);
      for (let i = 0; i < 3; i++) {
        const tray = box(1.0, 0.14, 0.7, mat('#b6bcc2'));
        tray.position.set(-13 + i * 1.5, 1.02, -3.4);
        g.add(tray);
      }
      for (let i = 0; i < 2; i++) {
        const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 14), mat('#e6dcc6'));
        tbl.position.set(-11 + i * 2.6, 0.76, -1.2);
        g.add(tbl);
        const leg = box(0.14, 0.76, 0.14, mat('#6d6357'));
        leg.position.set(-11 + i * 2.6, 0.38, -1.2);
        g.add(leg);
      }
    }
    if (A.bar) {
      const counter = box(5.2, 1.15, 1.0, mat('#3a2418'));
      counter.position.set(-9.5, 0.58, nav.LOBBY_BACK + 1.0);
      g.add(counter);
      const backbar = box(5.2, 1.8, 0.3, mat('#2c1c12'));
      backbar.position.set(-9.5, 1.6, nav.LOBBY_BACK + 0.25);
      g.add(backbar);
      for (let i = 0; i < 9; i++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6), mat(['#7fae6a', '#b07a3a', '#8d5f8f'][i % 3]));
        bottle.position.set(-11.6 + i * 0.55, 1.85, nav.LOBBY_BACK + 0.5);
        g.add(bottle);
      }
      for (let i = 0; i < 3; i++) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.75, 10), mat('#5d3b26'));
        stool.position.set(-11 + i * 1.5, 0.38, nav.LOBBY_BACK + 2.1);
        g.add(stool);
      }
    }
    if (A.giftshop) {
      const stand = box(2.4, 1.5, 1.0, mat('#8a6f4b'));
      stand.position.set(nav.HALF_W - 3.2, 0.75, -4.2);
      g.add(stand);
      for (let i = 0; i < 6; i++) {
        const item = box(0.3, 0.3, 0.2, mat(['#c94f4f', '#4f8ec9', '#c9a94f'][i % 3]));
        item.position.set(nav.HALF_W - 4.1 + (i % 3) * 0.9, 1.65 - Math.floor(i / 3) * 0.55, -3.9);
        g.add(item);
      }
    }
    if (A.chandelier) {
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshLambertMaterial({ color: '#f4e6b0', emissive: '#5a4a18' }));
      hub.position.set(nav.DOOR_X - 2, ROOM_H - 0.5, -1.4);
      g.add(hub);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const drop = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), new THREE.MeshLambertMaterial({ color: '#fff6d0', emissive: '#4a3c12' }));
        drop.position.set(nav.DOOR_X - 2 + Math.cos(a) * 0.62, ROOM_H - 0.82, -1.4 + Math.sin(a) * 0.62);
        g.add(drop);
      }
      this.chandelier = hub;
    }
    if (A.pms) {
      const screen = box(0.7, 0.5, 0.1, new THREE.MeshLambertMaterial({ color: '#25303a', emissive: '#12303a' }));
      screen.position.set(nav.DESK_X - 1.6, 1.5, nav.DESK_Z - 0.2);
      g.add(screen);
      const base = box(0.5, 0.06, 0.4, mat('#8d8d8d'));
      base.position.set(nav.DESK_X - 1.6, 1.26, nav.DESK_Z - 0.2);
      g.add(base);
    }
    if (A.gym) {
      const room = box(0.28, ROOM_H, 4.4, mat('#c2c8cc'));
      room.position.set(-nav.HALF_W + 4.6, ROOM_H / 2, -3.0);
      g.add(room);
      for (let i = 0; i < 2; i++) {
        const mill = box(0.8, 0.3, 1.6, mat('#39414a'));
        mill.position.set(-nav.HALF_W + 2.0 + i * 1.4, 0.2, -3.2);
        g.add(mill);
        const bar = box(0.1, 1.1, 0.1, mat('#6c757d'));
        bar.position.set(-nav.HALF_W + 2.0 + i * 1.4, 0.75, -3.9);
        g.add(bar);
      }
    }
    if (A.conference) {
      const tbl = box(4.6, 0.14, 1.6, mat('#4a3624'));
      tbl.position.set(nav.HALF_W - 4.6, 0.78, -1.1);
      g.add(tbl);
      for (let i = 0; i < 6; i++) {
        const ch = box(0.5, 0.5, 0.5, mat('#3d4a56'));
        ch.position.set(nav.HALF_W - 6.4 + (i % 3) * 1.8, 0.25, -1.1 + (i < 3 ? -1.3 : 1.3));
        g.add(ch);
      }
    }
  }

  buildFloor(f) {
    const s = this.state;
    const y = nav.floorY(f);
    const g = new THREE.Group();
    this.building.add(g);

    // Balcony slab + railing.
    const slab = box(nav.WIDTH + 4.2, 0.28, nav.RAIL_Z - nav.ROOM_BACK + 0.5, this.slabMat);
    slab.position.set(0, y - 0.14, (nav.RAIL_Z + nav.ROOM_BACK) / 2);
    g.add(slab);

    const railMat = mat(shade(s.accent, -30));
    const topRail = box(nav.WIDTH + 4.2, 0.12, 0.12, railMat);
    topRail.position.set(0, y + 1.0, nav.RAIL_Z);
    g.add(topRail);
    for (let i = 0; i <= SLOTS_PER_FLOOR * 3; i++) {
      const post = box(0.08, 1.0, 0.08, railMat);
      post.position.set(-nav.HALF_W - 2 + i * ((nav.WIDTH + 4) / (SLOTS_PER_FLOOR * 3)), y + 0.5, nav.RAIL_Z);
      g.add(post);
    }

    const backWall = box(nav.WIDTH, ROOM_H, 0.3, this.facadeMat);
    backWall.position.set(0, y + ROOM_H / 2, nav.ROOM_BACK);
    g.add(backWall);

    // Soffit strip over the walkway — the reason you can see anything at 3am.
    const strip = plane(nav.WIDTH + 4, 1.9, new THREE.MeshBasicMaterial({ color: '#ffdca8', transparent: true, opacity: 0.2 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, y + 0.16, (nav.RAIL_Z + nav.ROOM_FRONT) / 2 + 0.2);
    g.add(strip);
    this.walkwayLights.push(strip);
    for (let i = 0; i < SLOTS_PER_FLOOR; i++) {
      const lamp = plane(0.5, 0.32, new THREE.MeshBasicMaterial({ color: '#ffe6b8', transparent: true, opacity: 0.3 }));
      lamp.position.set(nav.slotX(i) + nav.ROOM_W / 2 - 1.6, y + 2.3, nav.ROOM_FRONT + 0.09);
      g.add(lamp);
      this.walkwayLights.push(lamp);
    }

    for (const room of s.rooms) {
      if (room.floor !== f) continue;
      if (room.built) this.buildRoom(g, room);
      else this.buildShell(g, room);
    }
  }

  buildShell(g, room) {
    const x = nav.slotX(room.slot);
    const y = nav.floorY(room.floor);
    const wall = box(nav.ROOM_W - 0.2, ROOM_H, 0.2, mat('#8e8a80'));
    wall.position.set(x, y + ROOM_H / 2, nav.ROOM_FRONT);
    g.add(wall);
    for (let i = 0; i < 3; i++) {
      const ply = box(nav.ROOM_W - 0.9, 0.34, 0.08, mat('#a5834f'));
      ply.rotation.z = (i - 1) * 0.06;
      ply.position.set(x, y + 1.0 + i * 0.5, nav.ROOM_FRONT + 0.16);
      g.add(ply);
    }
    this.addPick(wall, 'slot', room.id);
  }

  buildRoom(g, room) {
    const s = this.state;
    const x = nav.slotX(room.slot);
    const y = nav.floorY(room.floor);
    const tier = TIERS[room.tier];
    const parts = { group: new THREE.Group(), room };
    g.add(parts.group);
    const rg = parts.group;

    const carpetHue = room.tier === 3 ? '#7a5c46' : room.tier === 2 ? '#5d6b7d' : '#6d5f52';
    const floorMat = new THREE.MeshLambertMaterial({ map: tex(roomCarpetCanvas(carpetHue), { repeat: [2, 2] }) });
    const fl = plane(nav.ROOM_W - 0.2, nav.ROOM_FRONT - nav.ROOM_BACK - 0.3, floorMat);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(x, y + 0.02, (nav.ROOM_FRONT + nav.ROOM_BACK) / 2);
    rg.add(fl);

    const wallMat = new THREE.MeshLambertMaterial({ map: tex(wallpaperCanvas(room.tier === 3 ? '#e8ddc4' : '#ddd6c6', s.ink), { repeat: [2, 1] }) });
    const back = box(nav.ROOM_W - 0.2, ROOM_H, 0.12, wallMat);
    back.position.set(x, y + ROOM_H / 2, nav.ROOM_BACK + 0.2);
    rg.add(back);
    for (const dx of [-(nav.ROOM_W / 2) + 0.08, (nav.ROOM_W / 2) - 0.08]) {
      const side = box(0.16, ROOM_H, nav.ROOM_FRONT - nav.ROOM_BACK, wallMat);
      side.position.set(x + dx, y + ROOM_H / 2, (nav.ROOM_FRONT + nav.ROOM_BACK) / 2);
      rg.add(side);
    }
    const ceil = box(nav.ROOM_W - 0.2, 0.12, nav.ROOM_FRONT - nav.ROOM_BACK, mat('#e9e5da'));
    ceil.position.set(x, y + ROOM_H, (nav.ROOM_FRONT + nav.ROOM_BACK) / 2);
    rg.add(ceil);

    // Front face: a doorway and a picture window, leaving the middle open to look in.
    const doorMat = mat(shade(s.ink, 20));
    const door = box(1.0, 2.1, 0.12, doorMat);
    door.position.set(x + nav.ROOM_W / 2 - 0.85, y + 1.05, nav.ROOM_FRONT);
    rg.add(door);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ map: tex(doorPlateCanvas(String(roomNumber(room)), room.tier)), transparent: true }));
    plate.position.set(x + nav.ROOM_W / 2 - 0.85, y + 2.0, nav.ROOM_FRONT + 0.08);
    rg.add(plate);
    const sill = box(nav.ROOM_W - 2.2, 0.9, 0.14, mat(shade('#cfc6b4', -6)));
    sill.position.set(x - 0.6, y + 0.45, nav.ROOM_FRONT);
    rg.add(sill);
    const header = box(nav.ROOM_W - 0.2, 0.55, 0.14, this.facadeMat);
    header.position.set(x, y + ROOM_H - 0.28, nav.ROOM_FRONT);
    rg.add(header);

    // Beds: two doubles at standard, one king above.
    const bedMat = new THREE.MeshLambertMaterial({ map: tex(bedCanvas(mix(s.ink, '#f0e7d4', 0.55), s.accent)) });
    parts.beds = [];
    const bedSpots = room.tier === 1 ? [[-1.4, -2.9], [0.35, -2.9]] : [[-0.9, -3.0]];
    for (const [bx, bz] of bedSpots) {
      const w = room.tier === 1 ? 1.25 : 1.9;
      const base = box(w, 0.34, 2.1, mat('#7a6a58'));
      base.position.set(x + bx, y + 0.19, bz);
      rg.add(base);
      const duvet = box(w + 0.1, 0.2, 2.15, bedMat);
      duvet.position.set(x + bx, y + 0.45, bz);
      rg.add(duvet);
      const pillow = box(w - 0.2, 0.16, 0.42, mat('#f4f1e8'));
      pillow.position.set(x + bx, y + 0.6, bz - 0.78);
      rg.add(pillow);
      const head = box(w + 0.2, 0.8, 0.1, mat('#5d4a37'));
      head.position.set(x + bx, y + 0.6, bz - 1.14);
      rg.add(head);
      parts.beds.push({ duvet, pillow });
    }

    const stand = box(0.5, 0.5, 0.5, mat('#6b5942'));
    stand.position.set(x + (room.tier === 1 ? -0.53 : 0.45), y + 0.25, -3.4);
    rg.add(stand);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 10, 1, true), new THREE.MeshLambertMaterial({ color: '#f0e0b8', emissive: '#000', side: THREE.DoubleSide }));
    lampShade.position.set(stand.position.x, y + 0.75, -3.4);
    rg.add(lampShade);
    parts.lamp = lampShade;

    const dresser = box(1.8, 0.85, 0.55, mat('#6b5942'));
    dresser.position.set(x - 0.4, y + 0.42, nav.ROOM_FRONT - 1.0);
    rg.add(dresser);
    const tvMat = new THREE.MeshLambertMaterial({ map: tex(tvCanvas(false)), emissive: '#000' });
    const tv = box(0.95, 0.62, 0.12, tvMat);
    tv.position.set(x - 0.4, y + 1.16, nav.ROOM_FRONT - 1.05);
    tv.rotation.y = Math.PI;
    rg.add(tv);
    parts.tv = tv;

    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshLambertMaterial({ map: tex(artCanvas(room.seed)) }));
    art.position.set(x + 1.15, y + 1.8, nav.ROOM_BACK + 0.28);
    rg.add(art);

    if (room.tier >= 2) {
      const chair = box(0.62, 0.5, 0.62, mat(mix(s.accent, '#6a5a4a', 0.6)));
      chair.position.set(x + 1.4, y + 0.28, -1.3);
      rg.add(chair);
      const chairBack = box(0.62, 0.6, 0.14, mat(mix(s.accent, '#6a5a4a', 0.6)));
      chairBack.position.set(x + 1.4, y + 0.72, -1.6);
      rg.add(chairBack);
    }
    if (room.tier === 3) {
      const wetbar = box(1.1, 0.85, 0.5, mat('#4a3a28'));
      wetbar.position.set(x - 1.55, y + 0.42, -1.2);
      rg.add(wetbar);
      const rug = plane(2.0, 1.4, new THREE.MeshLambertMaterial({ map: tex(tileCanvas(s.accent, shade(s.accent, -60))) }));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(x, y + 0.05, -1.4);
      rg.add(rug);
    }

    // Bathroom nook behind a half wall on the far side.
    const bathWall = box(0.14, ROOM_H, 1.5, mat('#e6e2d8'));
    bathWall.position.set(x - nav.ROOM_W / 2 + 1.25, y + ROOM_H / 2, nav.ROOM_BACK + 0.95);
    rg.add(bathWall);
    const bathFloor = plane(1.1, 1.5, new THREE.MeshLambertMaterial({ map: tex(tileCanvas('#eceae2', '#c3c8cc'), { repeat: [2, 2] }) }));
    bathFloor.rotation.x = -Math.PI / 2;
    bathFloor.position.set(x - nav.ROOM_W / 2 + 0.68, y + 0.04, nav.ROOM_BACK + 0.95);
    rg.add(bathFloor);

    // Status marker floating over the doorway.
    const markerMat = new THREE.SpriteMaterial({ map: this.markerTexture('empty'), depthTest: false, transparent: true });
    const marker = new THREE.Sprite(markerMat);
    marker.scale.set(1.3, 1.3, 1);
    marker.position.set(x, y + ROOM_H + 0.55, nav.ROOM_FRONT + 0.6);
    marker.renderOrder = 8;
    rg.add(marker);
    parts.marker = marker;
    parts.markerState = 'empty';

    // The whole room is one click target.
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(nav.ROOM_W - 0.2, ROOM_H, nav.ROOM_FRONT - nav.ROOM_BACK),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(x, y + ROOM_H / 2, (nav.ROOM_FRONT + nav.ROOM_BACK) / 2);
    rg.add(hit);
    this.addPick(hit, 'room', room.id);

    // Grime overlay, shown when the room needs turning over.
    const grime = plane(nav.ROOM_W - 0.4, nav.ROOM_FRONT - nav.ROOM_BACK - 0.4, new THREE.MeshLambertMaterial({ color: '#6a5c3a', transparent: true, opacity: 0 }));
    grime.rotation.x = -Math.PI / 2;
    grime.position.set(x, y + 0.05, (nav.ROOM_FRONT + nav.ROOM_BACK) / 2);
    rg.add(grime);
    parts.grime = grime;

    // Warm window glow at night.
    const glow = plane(nav.ROOM_W - 2.2, 0.8, new THREE.MeshBasicMaterial({ color: '#ffd79a', transparent: true, opacity: 0 }));
    glow.position.set(x - 0.6, y + 1.5, nav.ROOM_FRONT + 0.1);
    rg.add(glow);
    parts.glow = glow;

    parts.tierName = tier.name;
    this.roomVis.set(room.id, parts);
  }

  buildStairs() {
    const s = this.state;
    const g = new THREE.Group();
    this.building.add(g);
    const stepMat = mat('#b7b1a2');
    for (let f = 0; f < s.floors; f++) {
      const y0 = nav.floorY(f);
      for (let i = 0; i < 10; i++) {
        const step = box(1.9, 0.12, 0.42, stepMat);
        step.position.set(nav.STAIR_X, y0 + (i + 1) * (nav.FLOOR_H / 10), nav.LANE_Z + 1.4 - i * 0.28);
        g.add(step);
      }
      const rail = box(0.1, 0.9, 4.2, mat(shade(s.accent, -30)));
      rail.position.set(nav.STAIR_X + 0.95, y0 + nav.FLOOR_H * 0.6, nav.LANE_Z);
      rail.rotation.x = -0.55;
      g.add(rail);
    }
    const landing = box(2.4, 0.2, 2.4, this.slabMat);
    landing.position.set(nav.STAIR_X, 0.1, nav.LANE_Z);
    g.add(landing);
  }

  buildElevator() {
    const g = new THREE.Group();
    this.building.add(g);
    const h = nav.floorY(this.state.floors) + 4;
    const shaft = box(2.4, h, 2.6, new THREE.MeshLambertMaterial({ color: '#8d939c', transparent: true, opacity: 0.35 }));
    shaft.position.set(nav.ELEV_X, h / 2, nav.LANE_Z - 0.4);
    g.add(shaft);
    const frame = box(2.7, 0.2, 2.9, this.trimMat);
    frame.position.set(nav.ELEV_X, h, nav.LANE_Z - 0.4);
    g.add(frame);
    const car = box(1.8, 2.3, 1.9, mat('#c8ac6a'));
    car.position.set(nav.ELEV_X, 1.15, nav.LANE_Z - 0.4);
    g.add(car);
    this.elevatorCar = car;
  }

  buildSign() {
    const s = this.state;
    const g = new THREE.Group();
    this.building.add(g);
    const big = !!s.amenities.signneon;
    const px = -nav.HALF_W - 4.5;
    const pz = 10;
    const poleH = big ? 9.5 : 7.0;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, poleH, 10), mat('#6e6a63'));
    pole.position.set(px, poleH / 2, pz);
    g.add(pole);

    const w = big ? 8.4 : 6.2;
    const hgt = w * 0.375;
    const faceMat = new THREE.MeshBasicMaterial({ map: tex(signCanvas(s.name, { face: '#f3e7cf', ink: s.ink, lit: true, sub: signBrag(s) })) });
    const face = box(w, hgt, 0.3, faceMat);
    face.position.set(px, poleH + hgt / 2 - 0.4, pz);
    face.rotation.y = 0.34;
    g.add(face);
    this.signFace = face;

    const frame = box(w + 0.4, hgt + 0.4, 0.18, this.trimMat);
    frame.position.set(px, poleH + hgt / 2 - 0.4, pz - 0.12);
    frame.rotation.y = 0.34;
    g.add(frame);

    const vac = box(w * 0.55, hgt * 0.34, 0.22, new THREE.MeshBasicMaterial({ map: tex(vacancyCanvas(true, true)), transparent: true }));
    vac.position.set(px + 0.2, poleH - hgt * 0.35, pz + 0.1);
    vac.rotation.y = 0.34;
    g.add(vac);
    this.vacancySign = vac;
    this._vacancyState = null;
  }

  buildOutside() {
    const s = this.state;
    const g = new THREE.Group();
    this.building.add(g);

    if (s.amenities.pool) {
      const deck = plane(13, 11, new THREE.MeshLambertMaterial({ map: tex(tileCanvas('#e4e0d4', '#c6c2b4'), { repeat: [6, 5] }) }));
      deck.rotation.x = -Math.PI / 2;
      deck.position.set(nav.POOL_X, 0.03, 1.4);
      g.add(deck);
      const water = plane(8.4, 6.4, new THREE.MeshLambertMaterial({ map: tex(poolWaterCanvas(0), { repeat: [2, 2] }), transparent: true, opacity: 0.92 }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(nav.POOL_X, 0.06, 1.4);
      g.add(water);
      this.poolWater = water;
      const lip = box(9.2, 0.24, 7.2, mat('#dcd6c6'));
      lip.position.set(nav.POOL_X, 0.09, 1.4);
      g.add(lip);
      water.position.y = 0.22;
      lip.position.y = 0.1;
      for (let i = 0; i < 4; i++) {
        const chair = box(0.7, 0.12, 1.7, mat('#e9e4d6'));
        chair.position.set(nav.POOL_X - 5.2 + (i % 2) * 10.4, 0.35, -1.4 + Math.floor(i / 2) * 5.4);
        g.add(chair);
      }
      const fence = mat('#9fa6ad');
      for (let i = 0; i <= 12; i++) {
        const post = box(0.08, 1.4, 0.08, fence);
        post.position.set(nav.POOL_X - 6.5 + i * 1.1, 0.7, 7.0);
        g.add(post);
      }
    }
    if (s.amenities.valet) {
      const stand = box(1.4, 1.2, 1.0, mat(mix(s.ink, '#3a2a20', 0.4)));
      stand.position.set(nav.DOOR_X + 5.4, 0.6, nav.RAIL_Z + 3.6);
      g.add(stand);
      const roof = box(1.9, 0.14, 1.5, this.trimMat);
      roof.position.set(nav.DOOR_X + 5.4, 1.9, nav.RAIL_Z + 3.6);
      g.add(roof);
    }
    if (s.amenities.spa) {
      const hut = box(5.2, 2.8, 4.2, mat('#7d6a52'));
      hut.position.set(-nav.HALF_W - 8.5, 1.4, -2.4);
      g.add(hut);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.6, 4), mat(shade(s.ink, -20)));
      roof.rotation.y = Math.PI / 4;
      roof.position.set(-nav.HALF_W - 8.5, 3.6, -2.4);
      g.add(roof);
    }
    // A few parked cars so the lot is never empty.
    const rand = mulberry32(1337);
    const carColors = ['#8d3b3b', '#2f4f7a', '#d8d3c6', '#3d5a45', '#6a6a70'];
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Group();
      const bodyMat = mat(carColors[i % carColors.length]);
      const body = box(2.0, 0.7, 4.4, bodyMat);
      body.position.y = 0.62;
      c.add(body);
      const cabin = box(1.8, 0.62, 2.1, mat('#2f3338'));
      cabin.position.set(0, 1.22, -0.2);
      c.add(cabin);
      for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), mat('#1e2024'));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.34, wz);
        c.add(wheel);
      }
      c.position.set(-16 + i * 4.6 + rand() * 0.6, 0, 13 + rand() * 1.2);
      this.cars.add(c);
    }
  }

  markerTexture(kind) {
    this._markerCache = this._markerCache || {};
    if (this._markerCache[kind]) return this._markerCache[kind];
    const cv = mkCanvas(128, 128);
    const ctx = cv.getContext('2d');
    const look = {
      dirty: ['#c2892f', '🧹'], broken: ['#b3402f', '🔧'], occupied: ['#3d7a4e', '💤'],
      empty: ['#4d5b6b', '✔'], reserved: ['#4f6ea8', '🔑'], service: ['#c25a1f', '🔔'],
    }[kind] || ['#4d5b6b', '·'];
    ctx.beginPath();
    ctx.arc(64, 58, 42, 0, Math.PI * 2);
    ctx.fillStyle = look[0];
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(12,14,18,0.75)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 92); ctx.lineTo(78, 92); ctx.lineTo(64, 116); ctx.closePath();
    ctx.fillStyle = look[0];
    ctx.fill();
    ctx.font = '46px system-ui, "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(look[1], 64, 60);
    const t = tex(cv);
    this._markerCache[kind] = t;
    return t;
  }

  // ---------------------------------------------------------------- people
  syncPeople(state) {
    const seen = new Set();
    for (const g of state.guests) {
      seen.add(g.id);
      let rig = this.people.get(g.id);
      if (!rig) {
        rig = buildPerson(randomLook(mulberry32(g.seed)));
        this.scene.add(rig);
        this.people.set(g.id, rig);
      }
      placeActor(rig, g);
      rig.userData.actorAction = g.action;
      rig.userData.actorSpeed = g.state === 'queue' || g.state === 'checkout' ? 1 - g.patience : 2.5;
      setPersonMood(rig, g.mood);
    }
    for (const w of [state.you, ...state.staff]) {
      seen.add(w.id);
      let rig = this.people.get(w.id);
      if (!rig) {
        rig = buildPerson(staffLook(w.kind === 'you' ? 'you' : w.role, mulberry32(w.seed)));
        this.scene.add(rig);
        this.people.set(w.id, rig);
        if (w.kind === 'you') {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.45, 0.62, 20),
            new THREE.MeshBasicMaterial({ color: '#ffd35e', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.03;
          ring.renderOrder = 3;
          rig.add(ring);
        }
      }
      placeActor(rig, w);
      rig.userData.actorAction = w.action;
      rig.userData.actorSpeed = w.path && w.path.length ? 3 : 0;
    }
    for (const [id, rig] of this.people) {
      if (seen.has(id)) continue;
      this.scene.remove(rig);
      disposePerson(rig);
      this.people.delete(id);
    }
  }

  // ---------------------------------------------------------------- update
  update(dt, state) {
    this.state = state;
    this.time += dt;
    if (this.structureKey(state) !== this._key) this.rebuild();

    const h = state.clock / 60;
    this.updateSky(h);
    this.updateLight(h);
    this.updateRooms(state, h);
    this.syncPeople(state);
    for (const [, rig] of this.people) {
      posePerson(rig, dt, { action: rig.userData.actorAction || 'idle', speed: rig.userData.actorSpeed || 0 });
    }
    if (this.poolWater && this.poolWater.material.map) {
      this.poolWater.material.map.offset.x = (this.time * 0.04) % 1;
      this.poolWater.material.map.offset.y = (Math.sin(this.time * 0.3) * 0.03);
    }
    if (this.elevatorCar) {
      const riders = [...state.guests, state.you, ...state.staff].filter((a) => a.path && a.path.some((p) => p.vert));
      const targetY = riders.length ? riders[0].y + 1.15 : 1.15;
      this.elevatorCar.position.y += (targetY - this.elevatorCar.position.y) * Math.min(1, dt * 2.4);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateLight(h) {
    // Sun up at 5, down at 19. Even at 3am the place stays readable — a motel
    // with the lights on is the whole point of the sign.
    const day = Math.max(0, Math.sin(((h - 5) / 14) * Math.PI));
    const dusk = Math.max(0, 1 - Math.abs(h - 18.6) / 2.4) + Math.max(0, 1 - Math.abs(h - 6.2) / 2.4);
    const night = 1 - Math.min(1, day * 2.2);
    this.sun.intensity = 0.34 + day * 1.05;
    this.sun.color.set(dusk > 0.4 ? '#ffb070' : day > 0.2 ? '#fff4dd' : '#93a9dc');
    const ang = ((h - 5) / 14) * Math.PI;
    this.sun.position.set(Math.cos(ang) * 60, 14 + Math.sin(ang) * 56, 34);
    this.sun.target.position.set(0, 4, -1);
    this.hemi.intensity = 0.46 + day * 0.36;
    this.hemi.color.set(day > 0.15 ? '#bfd8ff' : '#4b5c8e');
    this.hemi.groundColor.set(day > 0.15 ? '#6a5a44' : '#2c2f3a');
    this.lobbyLight.intensity = 0.5 + night * 1.7;
    this.signLight.intensity = night * 2.6;
    if (this.walkwayLights) {
      for (const m of this.walkwayLights) m.material.opacity = 0.10 + night * 0.55;
    }
    if (this.lotLamps) {
      for (const l of this.lotLamps) { l.bulb.material.opacity = night * 0.9; l.light.intensity = night * 1.9; }
    }
    if (this.scene.fog) this.scene.fog.color.set(day > 0.15 ? '#93a8c4' : '#1a2136');
    if (this.chandelier) this.chandelier.material.emissive.setScalar(0.12 + night * 0.5);
    this._night = night;
  }

  updateRooms(state, h) {
    const night = this._night ?? 0;
    for (const room of state.rooms) {
      const parts = this.roomVis.get(room.id);
      if (!parts) continue;
      const kind = room.state === 'broken' ? 'broken'
        : room.state === 'dirty' ? 'dirty'
          : room.state === 'occupied' ? (roomHasRequest(state, room) ? 'service' : 'occupied')
            : room.state === 'reserved' ? 'reserved' : 'empty';
      if (kind !== parts.markerState) {
        parts.marker.material.map = this.markerTexture(kind);
        parts.marker.material.needsUpdate = true;
        parts.markerState = kind;
      }
      const showMarker = kind !== 'empty' || this.hovered === room.id;
      parts.marker.visible = showMarker;
      parts.marker.scale.setScalar(1.15 + (kind === 'dirty' || kind === 'broken' || kind === 'service' ? Math.sin(this.time * 4) * 0.08 : 0));
      parts.grime.material.opacity = room.state === 'dirty' ? 0.16 + room.dirt * 0.3 : 0;
      const lightsOn = room.state === 'occupied' && (night > 0.25 || h < 7);
      parts.glow.material.opacity = lightsOn ? 0.55 * Math.min(1, night + 0.3) : 0;
      parts.lamp.material.emissive.setScalar(lightsOn ? 0.55 : 0);
      for (const bed of parts.beds) {
        bed.duvet.rotation.z = room.state === 'dirty' ? 0.05 : 0;
        bed.pillow.visible = room.state !== 'dirty';
      }
      if (parts.tv) parts.tv.material.emissive.setScalar(room.state === 'occupied' && night > 0.2 ? 0.4 : 0);
    }
    const vacant = state.rooms.some((r) => r.built && r.state === 'empty');
    if (this.vacancySign && this._vacancyState !== vacant) {
      this._vacancyState = vacant;
      const old = this.vacancySign.material.map;
      this.vacancySign.material.map = tex(vacancyCanvas(true, vacant));
      this.vacancySign.material.needsUpdate = true;
      if (old) old.dispose();
    }
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    const o = this.orbit;
    const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
    this.camera.position.set(
      o.target.x + Math.sin(o.yaw) * cp * o.dist,
      o.target.y + sp * o.dist,
      o.target.z + Math.cos(o.yaw) * cp * o.dist,
    );
    this.camera.lookAt(o.target);
  }

  focusFloor(f) {
    this.orbit.target.y = Math.max(4, nav.floorY(f) + 1.5);
  }

  // Frame the whole building in the strip of screen the HUD panels leave free.
  frameAll() {
    const s = this.state;
    const w = this.holder.clientWidth || 1280;
    const gapFrac = Math.min(1, Math.max(0.42, (w - 660) / w));
    const halfTan = Math.tan((this.camera.fov * Math.PI / 180) / 2);
    const aspect = this.camera.aspect || 1.6;
    const byWidth = (nav.WIDTH + 13) / gapFrac / (2 * halfTan * aspect);
    const byHeight = (nav.floorY(s.floors) + 9) * 1.25 / (2 * halfTan);
    this.orbit.dist = Math.max(30, Math.min(120, Math.max(byWidth, byHeight)));
    this.orbit.target.set(0, Math.min(11, 2.8 + s.floors * 1.5), -1);
    this.orbit.yaw = 0.17;
    this.orbit.pitch = 0.30;
    this.userFramed = false;
  }

  resize() {
    const w = this.holder.clientWidth || 1280;
    const h = this.holder.clientHeight || 720;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.userFramed === false) this.frameAll();
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const el = this.renderer.domElement;
    let dragging = false, moved = 0, lx = 0, ly = 0;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    el.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly;
        moved += Math.abs(dx) + Math.abs(dy);
        this.orbit.yaw -= dx * 0.006;
        this.orbit.pitch = Math.max(0.06, Math.min(1.15, this.orbit.pitch + dy * 0.004));
        this.userFramed = true;
        lx = e.clientX; ly = e.clientY;
      } else {
        const hit = this.pickAt(e.clientX, e.clientY);
        this.hovered = hit && hit.kind === 'room' ? hit.id : null;
        el.style.cursor = hit ? 'pointer' : 'grab';
        this.onHover?.(hit);
      }
    });
    el.addEventListener('pointerup', (e) => {
      dragging = false;
      el.releasePointerCapture?.(e.pointerId);
      if (moved < 6) {
        const hit = this.pickAt(e.clientX, e.clientY);
        this.onPick?.(hit);
      }
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.dist = Math.max(16, Math.min(130, this.orbit.dist + e.deltaY * 0.045));
      this.userFramed = true;
    }, { passive: false });
  }

  pickAt(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, false);
    return hits.length ? hits[0].object.userData.pick : null;
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function placeActor(rig, a) {
  rig.position.set(a.x, a.y, a.z);
  const want = a.heading ?? 0;
  let d = want - rig.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  rig.rotation.y += d * 0.2;
}

// What the marquee brags about, in the order a motel sign would brag about it.
function signBrag(s) {
  const brag = [];
  if (s.amenities.pool) brag.push('POOL');
  if (s.amenities.wifi) brag.push('FREE WI-FI');
  if (s.amenities.breakfast) brag.push('FREE BREAKFAST');
  if (s.amenities.bar) brag.push('LOUNGE');
  if (s.amenities.spa) brag.push('SPA');
  if (s.amenities.gym) brag.push('FITNESS');
  if (!brag.length) brag.push('CLEAN ROOMS', 'LOW RATES');
  return brag.slice(0, 3).join(' · ');
}

function roomHasRequest(state, room) {
  return state.guests.some((g) => g.roomId === room.id && g.request);
}

function potted(x, y, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 10), new THREE.MeshLambertMaterial({ color: '#8c5a3c' }));
  pot.position.y = 0.21;
  g.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 5), new THREE.MeshLambertMaterial({ color: i % 2 ? '#3f7a45' : '#4f8e51' }));
    leaf.position.set(Math.cos(i) * 0.14, 0.82, Math.sin(i) * 0.14);
    leaf.rotation.z = Math.cos(i) * 0.4;
    leaf.rotation.x = Math.sin(i) * 0.4;
    g.add(leaf);
  }
  g.position.set(x, y, z);
  return g;
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
  });
}
