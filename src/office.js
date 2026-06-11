// The coach's office: a 3D room in the press box overlooking the field by day.
// Everything you do in a week starts here — click the helmet to play Friday's
// game, the papers for decisions, the window for practice, the whiteboard for
// the play designer, the trophy shelf for the season, the door to leave.
import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { logoCanvas } from './logos.js';
import { drawPlayArt, OFFENSE_PLAYS } from './plays.js';
import { mkCanvas, tex, shade, contrastText } from './textures.js';
import { weekLabel, wins, losses, DRILLS } from './franchise.js';
import { sfx } from './audio.js';

function mat(color, opts = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: opts.shin ?? 12, specular: opts.spec ?? '#222' });
}
function box(w, h, d, m) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

const POSTERS = {
  win: ['WIN THE NIGHT', '#8f1d2c'],
  earn: ['EARN YOUR STRIPES', '#14306e'],
  hustle: ['HUSTLE BEATS TALENT', '#1d4d2b'],
  state: ['STATE OR BUST', '#46245e'],
};

function posterCanvas(id, school) {
  const [text, bg] = POSTERS[id] || POSTERS.win;
  const cv = mkCanvas(256, 384);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = '#f2efe4';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 364);
  ctx.fillStyle = '#f2efe4';
  ctx.textAlign = 'center';
  ctx.font = `900 44px Impact, 'Arial Black', sans-serif`;
  const words = text.split(' ');
  words.forEach((w, i) => ctx.fillText(w, 128, 150 + i * 52));
  ctx.font = `700 18px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText(`${school.name.toUpperCase()} FOOTBALL`, 128, 348);
  return cv;
}

function nameplateCanvas(school) {
  const cv = mkCanvas(512, 96);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#e8c860';
  ctx.font = `900 44px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`HEAD COACH · ${school.mascot.toUpperCase()}`, 256, 62);
  return cv;
}

export class Office {
  constructor(container, state, cb) {
    this.container = container;
    this.state = state;
    this.cb = cb; // { onGame, onPractice, onPlaybook, onExit, onSave, onDecision, onStandings, onSeasonEnd }
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.05, 900);

    const school = state.school;
    this.logoCv = logoCanvas(school.logoId, {
      fg: school.colors.secondary, bg: school.colors.primary, line: '#101014', letter: school.name[0],
    });

    // the world outside: the stadium at noon (no crowd)
    this.stadium = buildStadium(this.scene, school, { name: 'Visitors', colors: { primary: '#444', secondary: '#999' } }, this.logoCv, { daytime: true });
    this.stadium.scoreboard.draw({
      stadium: `${school.mascot} Stadium`, mascot: school.mascot,
      headerColor: school.colors.primary, headerText: contrastText(school.colors.primary),
      home: 0, away: 0, clock: '--:--', down: '-', toGo: '-', ballOn: '-', qtr: '-',
    });

    // the office sits like a press box over the home stands
    this.room = null;
    this.hotspots = [];
    this.buildRoom();

    // interior light
    this.roomLight = new THREE.PointLight('#fff2dc', 14, 16);
    this.roomLight.position.set(0.5, 11.2, 41);
    this.scene.add(this.roomLight);
    const fill = new THREE.AmbientLight('#9fb0cc', 0.35);
    this.scene.add(fill);

    // camera: coach's eye, gentle mouse parallax
    this._mx = 0; this._my = 0;
    this._onMove = (e) => {
      const r = container.getBoundingClientRect();
      this._mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      this._my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      this._mouse = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };
      this._mousePx = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.checkHover();
    };
    this._onClick = () => {
      sfx.ensure();
      if (this.hovered) {
        sfx.chime();
        this.hovered.action();
      }
    };
    container.addEventListener('pointermove', this._onMove);
    container.addEventListener('click', this._onClick);
    this._onResize = () => {
      if (!container.clientWidth) return;
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', this._onResize);

    this.raycaster = new THREE.Raycaster();
    this.hovered = null;
    this.tooltip = document.getElementById('office-tip');
    this.clock = new THREE.Clock();
    this.t = 0;
    this.disposed = false;
    this.loop();
  }

  hotspot(group, label, action) {
    group.traverse((o) => { o.userData.hotspotRef = { group, label, action }; });
    this.hotspots.push(group);
    return group;
  }

  buildRoom() {
    if (this.room) this.scene.remove(this.room);
    this.hotspots = [];
    const st = this.state.office;
    const school = this.state.school;
    const fr = this.state.franchise;
    const g = new THREE.Group();
    // room shell: 7 x 3.1 x 5.4, window wall faces the field (-z)
    const wallMat = mat(st.wall, { shin: 4 });
    const woodMat = mat(st.wood, { shin: 26, spec: '#553' });
    const carpetMat = mat(st.carpet, { shin: 2 });

    const floor = box(7, 0.1, 5.4, carpetMat);
    floor.position.y = -0.05;
    g.add(floor);
    const ceil = box(7, 0.1, 5.4, mat('#e8e4da', { shin: 2 }));
    ceil.position.y = 3.1;
    g.add(ceil);
    const lightPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.9), new THREE.MeshBasicMaterial({ color: '#fff8e0' }));
    lightPanel.position.set(0, 3.04, 0.4);
    g.add(lightPanel);

    const backWall = box(7, 3.1, 0.12, wallMat);
    backWall.position.set(0, 1.55, 2.7);
    g.add(backWall);
    const leftWall = box(0.12, 3.1, 5.4, wallMat);
    leftWall.position.set(-3.5, 1.55, 0);
    g.add(leftWall);
    const rightWall = box(0.12, 3.1, 5.4, wallMat);
    rightWall.position.set(3.5, 1.55, 0);
    g.add(rightWall);
    // window wall: sill + header + side piers, big glass between
    const sill = box(7, 0.42, 0.14, wallMat);
    sill.position.set(0, 0.21, -2.7);
    g.add(sill);
    const header = box(7, 0.35, 0.14, wallMat);
    header.position.set(0, 2.92, -2.7);
    g.add(header);
    for (const x of [-3.25, 3.25]) {
      const pier = box(0.5, 2.35, 0.14, wallMat);
      pier.position.set(x, 1.57, -2.7);
      g.add(pier);
    }
    const sillTop = box(7, 0.07, 0.3, woodMat);
    sillTop.position.set(0, 0.45, -2.62);
    g.add(sillTop);
    // glass (the practice hotspot) + mullions
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 2.28, 0.04),
      new THREE.MeshPhongMaterial({ color: '#cfe2f0', transparent: true, opacity: 0.10, shininess: 95, depthWrite: false })
    );
    glass.position.set(0, 1.6, -2.7);
    g.add(this.hotspot(glass, 'GO TO PRACTICE — run a drill', () => this.cb.onPractice()));
    for (const x of [-1.5, 1.5]) {
      const mull = box(0.06, 2.28, 0.1, mat('#d8d4c8'));
      mull.position.set(x, 1.6, -2.7);
      g.add(mull);
    }

    // ------------------------------------------------ desk + chair
    const desk = new THREE.Group();
    const top = box(2.7, 0.09, 1.25, woodMat);
    top.position.y = 0.78;
    desk.add(top);
    const modesty = box(2.5, 0.62, 0.08, woodMat);
    modesty.position.set(0, 0.42, 0.45);
    desk.add(modesty);
    for (const x of [-1.25, 1.25]) {
      const side = box(0.08, 0.78, 1.1, woodMat);
      side.position.set(x, 0.39, 0);
      desk.add(side);
    }
    desk.position.set(0, 0, -1.25);
    g.add(desk);
    const chair = new THREE.Group();
    const seat = box(0.6, 0.08, 0.55, mat('#23242a', { shin: 30 }));
    seat.position.y = 0.55;
    chair.add(seat);
    const backr = box(0.6, 0.7, 0.08, mat('#23242a', { shin: 30 }));
    backr.position.set(0, 0.95, 0.26);
    chair.add(backr);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), mat('#555'));
    post.position.y = 0.27;
    chair.add(post);
    chair.position.set(1.05, 0, -0.15);
    chair.rotation.y = 0.55;
    g.add(chair);

    // ------------------------------------------------ desk things
    // THE HELMET → play the game
    const helmet = this.buildHelmet();
    helmet.position.set(-0.78, 1.02, -1.35);
    helmet.rotation.y = 0.7;
    g.add(this.hotspot(helmet, this.gameLabel(), () => this.cb.onGame()));

    // papers → decisions
    const papers = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const sheet = box(0.34, 0.012, 0.46, mat('#f4f2ea', { shin: 2 }));
      sheet.position.set(i * 0.02 - 0.02, 0.835 + i * 0.013, i * 0.015);
      sheet.rotation.y = (i - 1) * 0.12;
      papers.add(sheet);
    }
    const folder = box(0.38, 0.015, 0.5, mat('#d8b46a', { shin: 4 }));
    folder.position.y = 0.875;
    folder.rotation.y = -0.08;
    papers.add(folder);
    this.papersGlow = new THREE.PointLight('#ffd870', 0, 1.2);
    this.papersGlow.position.set(0.55, 1.1, -1.2);
    papers.position.set(0.55, 0, -1.2);
    g.add(this.papersGlow);
    g.add(this.hotspot(papers, "THIS WEEK'S DECISIONS", () => this.cb.onDecision()));

    // phone → the AD calls
    const phone = new THREE.Group();
    const body = box(0.34, 0.09, 0.22, mat('#2a2c33', { shin: 40 }));
    body.position.y = 0.87;
    phone.add(body);
    const handset = box(0.36, 0.06, 0.09, mat('#1c1e24', { shin: 40 }));
    handset.position.set(0, 0.945, -0.05);
    phone.add(handset);
    this.handset = handset;
    phone.position.set(1.05, 0, -1.5);
    phone.rotation.y = -0.5;
    g.add(this.hotspot(phone, 'THE PHONE', () => this.cb.onPhone()));
    this.phoneGroup = phone;

    // nameplate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.05), new THREE.MeshPhongMaterial({ map: tex(nameplateCanvas(school)), shininess: 30 }));
    plate.position.set(0.1, 0.89, -0.85);
    plate.rotation.x = -0.15;
    g.add(plate);

    // lamp
    const lamp = new THREE.Group();
    const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.04, 12), mat('#2e5230', { shin: 60 }));
    lbase.position.y = 0.85;
    lamp.add(lbase);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), mat('#caa84a', { shin: 80 }));
    stem.position.y = 1.02;
    stem.rotation.z = 0.18;
    lamp.add(stem);
    const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.16, 12, 1, true), new THREE.MeshPhongMaterial({ color: '#2e5230', side: THREE.DoubleSide, emissive: '#1d3a1e' }));
    shadeM.position.set(0.06, 1.2, 0);
    lamp.add(shadeM);
    const lampLight = new THREE.PointLight('#ffe9b0', 4, 3.5);
    lampLight.position.set(0.06, 1.15, 0);
    lamp.add(lampLight);
    lamp.position.set(-1.15, 0, -0.85);
    g.add(lamp);

    // bobblehead (optional decoration)
    if (st.bobble) {
      const bob = new THREE.Group();
      const bbase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 10), mat('#caa84a', { shin: 70 }));
      bbase.position.y = 0.86;
      bob.add(bbase);
      const bodyB = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.07, 3, 8), mat(school.colors.primary));
      bodyB.position.y = 0.97;
      bob.add(bodyB);
      this.bobHead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(school.colors.secondary, { shin: 70 }));
      this.bobHead.position.y = 1.1;
      bob.add(this.bobHead);
      bob.position.set(0.62, 0, -1.65);
      g.add(bob);
    }

    // ------------------------------------------------ whiteboard → play designer
    const board = new THREE.Group();
    const frame = box(0.06, 1.5, 2.3, mat('#888'));
    board.add(frame);
    const play = OFFENSE_PLAYS[(fr?.week || 1) % OFFENSE_PLAYS.length];
    const art = drawPlayArt(play);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.34), new THREE.MeshBasicMaterial({ map: tex(art) }));
    face.rotation.y = -Math.PI / 2;
    face.position.x = -0.04;
    board.add(face);
    board.position.set(2.96, 1.8, -1.55);
    board.rotation.y = 0.45; // angled toward the desk
    g.add(this.hotspot(board, 'THE PLAYBOOK — design your own plays', () => this.cb.onPlaybook()));

    // ------------------------------------------------ trophy shelf → standings
    const shelf = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const plank = box(0.35, 0.05, 2.0, woodMat);
      plank.position.set(0, 1.5 + i * 0.55, 0);
      shelf.add(plank);
    }
    // game balls for wins, cups for titles
    const winCount = fr ? wins(fr) : 0;
    for (let i = 0; i < Math.min(8, winCount); i++) {
      const ballM = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('#7a3c1e', { shin: 40 }));
      ballM.scale.set(1.5, 1, 1);
      ballM.rotation.y = 0.6;
      ballM.position.set(0, 1.59, -0.85 + i * 0.25);
      shelf.add(ballM);
    }
    const cups = (fr?.trophies || []).filter((t) => t === 'district' || t === 'state');
    cups.forEach((t, i) => {
      const cup = new THREE.Group();
      const cbase = box(0.12, 0.05, 0.12, woodMat);
      cup.add(cbase);
      const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 8), mat('#caa84a', { shin: 90 }));
      stem2.position.y = 0.08;
      cup.add(stem2);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.12, 12), mat(t === 'state' ? '#ffd75e' : '#c8ccd4', { shin: 95, spec: '#fff' }));
      bowl.position.y = 0.19;
      cup.add(bowl);
      cup.position.set(0, 2.07, -0.5 + i * 0.5);
      shelf.add(cup);
    });
    shelf.position.set(-2.96, 0, -1.55);
    shelf.rotation.y = -0.45;
    g.add(this.hotspot(shelf, 'SEASON & TROPHIES', () => this.cb.onStandings()));

    // pennant + poster + clock on back wall
    const penCv = mkCanvas(256, 128);
    const pctx = penCv.getContext('2d');
    pctx.fillStyle = school.colors.primary;
    pctx.beginPath(); pctx.moveTo(0, 0); pctx.lineTo(256, 64); pctx.lineTo(0, 128); pctx.closePath(); pctx.fill();
    pctx.fillStyle = school.colors.secondary;
    pctx.font = `900 36px Impact, sans-serif`;
    pctx.fillText(school.mascot.toUpperCase().slice(0, 9), 14, 76);
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshBasicMaterial({ map: tex(penCv), transparent: true }));
    pen.position.set(-3.42, 2.45, -0.6);
    pen.rotation.y = Math.PI / 2;
    g.add(pen);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.27), new THREE.MeshPhongMaterial({ map: tex(posterCanvas(st.poster, school)), shininess: 4 }));
    poster.position.set(3.42, 1.8, 0.1);
    poster.rotation.y = -Math.PI / 2;
    g.add(poster);

    // file cabinet + radio (mute) + paint can (decorate)
    const cab = box(0.55, 1.15, 0.6, mat('#9aa0a8', { shin: 40 }));
    cab.position.set(3.05, 0.575, -0.7);
    g.add(cab);
    const radio = new THREE.Group();
    const rbody = box(0.4, 0.18, 0.16, mat('#3a2c1c', { shin: 50 }));
    rbody.position.y = 1.24;
    radio.add(rbody);
    for (const x of [-0.12, 0.12]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), mat('#caa84a', { shin: 80 }));
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, 1.24, 0.09);
      radio.add(knob);
    }
    radio.position.set(3.05, 0, -0.7);
    radio.rotation.y = -0.7;
    g.add(this.hotspot(radio, 'THE RADIO — sound on/off', () => {
      sfx.setMuted(!sfx.muted);
      this.setHeader();
    }));
    const paint = new THREE.Group();
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), mat('#d8d4c8', { shin: 60 }));
    can.position.y = 0.11;
    paint.add(can);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), mat(st.wall, { shin: 60 }));
    lid.position.y = 0.23;
    paint.add(lid);
    const brush = box(0.04, 0.18, 0.02, woodMat);
    brush.position.set(0.12, 0.09, 0.05);
    brush.rotation.z = -0.4;
    paint.add(brush);
    paint.position.set(3.08, 1.15, -1.05);
    paint.scale.setScalar(0.85);
    g.add(this.hotspot(paint, 'DECORATE THE OFFICE', () => this.cb.onDecorate()));

    // plant (optional)
    if (st.plant) {
      const plant = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 10), mat('#a05a2c'));
      pot.position.y = 0.13;
      plant.add(pot);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat('#2a5a2c'));
        leaf.position.set(Math.sin(i * 2.1) * 0.1, 0.4 + (i % 2) * 0.14, Math.cos(i * 2.1) * 0.1);
        leaf.scale.y = 1.4;
        plant.add(leaf);
      }
      plant.position.set(-3.0, 0, -2.2);
      g.add(plant);
    }

    // door → exit
    const doorG = new THREE.Group();
    const slab = box(0.9, 2.1, 0.07, woodMat);
    slab.position.y = 1.05;
    doorG.add(slab);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#caa84a', { shin: 90 }));
    knob.position.set(0.32, 1.0, -0.06);
    doorG.add(knob);
    const dframe = box(1.04, 2.2, 0.05, mat('#d8d4c8'));
    dframe.position.set(0, 1.08, 0.04);
    doorG.add(dframe);
    doorG.position.set(3.4, 0, 0.95);
    doorG.rotation.y = -Math.PI / 2;
    g.add(this.hotspot(doorG, 'LEAVE THE OFFICE — back to title', () => this.cb.onExit()));

    // place the room over the home stands like a press box;
    // local -z already faces the field, so no rotation needed
    g.position.set(0, 9.6, 40.2);
    this.room = g;
    this.scene.add(g);
    this.setHeader();
  }

  gameLabel() {
    const fr = this.state.franchise;
    if (!fr || fr.seasonOver) return 'THE HELMET — season wrap-up';
    return `THE HELMET — play Friday's game`;
  }

  buildHelmet() {
    const school = this.state.school;
    const u = this.state.uniform;
    const g = new THREE.Group();
    const scaleUp = 2.0;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), mat(u.helmet, { shin: 90, spec: '#999' }));
    shell.scale.set(1, 1.06, 1.16);
    g.add(shell);
    for (const [y, arc] of [[-0.02, 1.45], [-0.075, 1.3]]) {
      const bar = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.0115, 6, 18, arc), mat(u.facemask, { shin: 30 }));
      bar.rotation.x = Math.PI / 2;
      bar.rotation.z = Math.PI / 2 - arc / 2;
      bar.position.set(0, y, 0.038);
      g.add(bar);
    }
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.013, 6, 28, Math.PI * 1.12), mat(u.helmetStripe, { shin: 60 }));
    stripe.rotation.set(0, Math.PI / 2, -0.1);
    stripe.scale.set(1.16, 1.06, 1);
    stripe.position.y = 0.02;
    g.add(stripe);
    const logoTex = tex(this.logoCv);
    for (const s of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.CircleGeometry(0.082, 20), new THREE.MeshPhongMaterial({ map: logoTex, transparent: true, shininess: 50 }));
      decal.position.set(s * 0.15, 0.012, 0.012);
      decal.rotation.y = s * Math.PI / 2;
      g.add(decal);
    }
    g.scale.setScalar(scaleUp);
    return g;
  }

  setHeader() {
    const fr = this.state.franchise;
    const school = this.state.school;
    const el = document.getElementById('office-head');
    if (!el || !fr) return;
    const trust = Math.round(fr.adTrust);
    const trustColor = trust > 55 ? '#69c46a' : trust > 28 ? '#e8b923' : '#ff5a4a';
    el.innerHTML = `
      <div class="oh-week">${fr.seasonOver ? (fr.fired ? 'CLEAN OUT YOUR DESK' : 'SEASON COMPLETE') : weekLabel(fr, school)}</div>
      <div class="oh-sub">
        <span>${school.name.toUpperCase()} ${school.mascot.toUpperCase()} · ${wins(fr)}–${losses(fr)}</span>
        <span class="oh-meter">AD TRUST <i><b style="width:${trust}%;background:${trustColor}"></b></i></span>
        <span>MORALE ${fr.morale > 0 ? '+' + fr.morale : fr.morale}</span>
        ${fr.practice ? `<span class="oh-chip">✔ ${fr.practice.label}</span>` : '<span class="oh-chip dim">PRACTICE PENDING</span>'}
        ${fr.decisionDone ? '<span class="oh-chip">✔ DECISIONS MADE</span>' : '<span class="oh-chip hot">PAPERS ON YOUR DESK</span>'}
        ${fr.ultimatum ? '<span class="oh-chip bad">⚠ WIN OR ELSE</span>' : ''}
      </div>`;
  }

  /** Controller focus: highlight hotspot i and park the tooltip on it. */
  padFocusHotspot(i) {
    const g = this.hotspots[(i % this.hotspots.length + this.hotspots.length) % this.hotspots.length];
    if (!g) return;
    const ref = g.userData.hotspotRef;
    if (this.hovered && this.hovered.group !== ref.group) this.hovered.group.scale.setScalar(this.hovered.baseScale);
    this.hovered = { ...ref, ref, baseScale: ref.group.scale.x };
    if (this.tooltip) {
      const v = new THREE.Vector3();
      ref.group.getWorldPosition(v);
      v.project(this.camera);
      const r = this.container.getBoundingClientRect();
      this.tooltip.textContent = ref.label;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${(v.x * 0.5 + 0.5) * r.width}px`;
      this.tooltip.style.top = `${(-v.y * 0.5 + 0.5) * r.height - 30}px`;
    }
  }

  padActivate() {
    if (this.hovered) { sfx.chime(); this.hovered.action(); }
  }

  checkHover() {
    if (!this._mouse) return;
    this.raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.hotspots, true);
    let found = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.hotspotRef) o = o.parent;
      if (o) { found = o.userData.hotspotRef; break; }
    }
    if (found !== (this.hovered?.ref || null)) {
      if (this.hovered) this.hovered.group.scale.setScalar(this.hovered.baseScale);
      this.hovered = found ? { ...found, ref: found, baseScale: found.group.scale.x } : null;
      this.container.style.cursor = found ? 'pointer' : 'default';
    }
    if (this.tooltip) {
      if (found && this._mousePx) {
        this.tooltip.textContent = found.label === 'THE HELMET — play Friday\'s game' ? this.gameLabel() : found.label;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${this._mousePx.x + 16}px`;
        this.tooltip.style.top = `${this._mousePx.y + 10}px`;
      } else {
        this.tooltip.style.display = 'none';
      }
    }
  }

  loop() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.t += dt;
    const fr = this.state.franchise;
    // hover pulse
    if (this.hovered) {
      this.hovered.group.scale.setScalar(this.hovered.baseScale * (1 + Math.sin(this.t * 6) * 0.025 + 0.03));
    }
    // papers glow when a decision waits
    if (this.papersGlow) this.papersGlow.intensity = fr && !fr.decisionDone ? 1.4 + Math.sin(this.t * 4) * 0.7 : 0;
    // the phone hops when the AD is calling
    if (this.handset && fr?.phoneEvent) {
      this.handset.position.y = 0.945 + Math.max(0, Math.sin(this.t * 22)) * 0.02 * (Math.sin(this.t * 1.5) > 0.4 ? 1 : 0);
      if (Math.sin(this.t * 1.5) > 0.4 && Math.sin((this.t - dt) * 1.5) <= 0.4) sfx.chime();
    }
    if (this.bobHead) this.bobHead.rotation.z = Math.sin(this.t * 2.4) * 0.12;
    // coach's eye with parallax
    const px = this._mx * 0.35, py = this._my * 0.2;
    this.camera.position.set(0 + px * 0.6, 11.55 + py * -0.3, 41.75);
    this.camera.lookAt(px * 2.0, 9.4 - py * 1.1, 32.0);
    this.renderer.render(this.scene, this.camera);
  }

  rebuild() { this.buildRoom(); }

  dispose() {
    this.disposed = true;
    this.container.removeEventListener('pointermove', this._onMove);
    this.container.removeEventListener('click', this._onClick);
    window.removeEventListener('resize', this._onResize);
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
