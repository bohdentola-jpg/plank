// Lawn Dash — a three-lane sprint down Mulberry Loop against Zip, the fastest
// feet in Backyard Borough. You both run on your own; you pick lanes and hop.
// Clean running builds "flow" (top speed); sprinklers soak you, lawn chairs
// trip you, leaf piles drag, and the yellow chevrons are free speed.
//
// Story call: G.hooks.minigame('dash', { rival: 'zip', ease })  → result.won
// (ease 0..3 makes Zip slower and clumsier each time the player has lost).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { Character } from '../art/characters.js';
import { toon, flat, M, box, cyl, cone, ring, circle, lightRig, canvasTex, texMat, signPlane, bake } from '../art/kit.js';
import { PROPS, fence, bunting } from '../art/props.js';
import { teamSpec } from '../data/cast.js';
import { NPCS } from '../data/npcs.js';
import { clamp, damp, makeRng, el } from '../core/util.js';

const LANES = [-1.7, 0, 1.7];
const HOP = 0.52;            // seconds in the air
const BASE = 9.2;            // cruising speed, units/s
const FLOW = 2.3;            // extra speed at full flow
const BOOST = 4.2;

const FANS = ['pig', 'duck', 'cat', 'dog', 'frog', 'owl', 'goat', 'hedgehog', 'beaver', 'deer', 'mouse', 'raccoon', 'turtle', 'badger', 'skunk'];
const SHIRTS = [0xd4502f, 0x2a6f77, 0xf08a24, 0x6aa84f, 0x58b8c9, 0x8a5aa8, 0xffd45a];
const QUIPS = {
  idle: ['Is this fast? This feels fast!', 'I can see my house!', 'Left foot, right foot, left foot—', 'Did you know lawns have a top speed? I do.', 'Is that a gnome? That\'s a gnome.', 'I beat the mail truck! Twice!', 'Are we racing? We\'re racing!', 'My ears are so aerodynamic!'],
  soak: ['Cold! COLD!', 'I meant to do that!', 'Free bath!'],
  trip: ['The lawn did that!', 'Who put a chair there?!', 'I\'m fine! I\'m fine. Am I fine?'],
  boost: ['WHEEEE!', 'Zoom zoom zoom!'],
  ahead: ['Hi! Bye!', 'Keep up! Or don\'t! Your call!', 'You\'re doing great back there!'],
  behind: ['Wait, how are you— HOW?', 'Okay you\'re fast. I\'m faster. Usually.', 'That\'s MY spot!'],
};

function injectCss() {
  if (document.getElementById('mg-dash-css')) return;
  const s = document.createElement('style');
  s.id = 'mg-dash-css';
  s.textContent = `
.ld-strip { position:absolute; left:50%; top:4.3em; transform:translateX(-50%); width:min(34em,64vw); height:1.5em; }
.ld-strip .rail { position:absolute; left:0; right:0; top:0.55em; height:0.45em; border-radius:0.3em; background:rgba(27,16,36,.6); border:0.13em solid #2b1a33; }
.ld-strip .fill { position:absolute; left:0; top:0; bottom:0; background:#ffd45a; border-radius:0.2em; }
.ld-strip .flag { position:absolute; right:-0.9em; top:-0.35em; font-size:1.25em; }
.ld-strip .dot { position:absolute; top:-0.05em; width:1.6em; height:1.6em; margin-left:-0.8em; border-radius:50%; border:0.14em solid #2b1a33; font-size:0.9em; line-height:1.4em;
  text-align:center; font-weight:900; box-shadow:0 0.14em 0 rgba(43,26,51,.5); }
.ld-strip .dot.you { background:#f08a24; color:#fff4dc; z-index:2; }
.ld-strip .dot.zip { background:#f7b9c2; color:#2b1a33; }
.ld-you { position:absolute; transform:translate(-50%,-100%); font-weight:900; font-size:0.95em; color:#ffd45a; text-shadow:0 0.1em 0 #2b1a33, 0 0 0.4em rgba(27,16,36,.9); white-space:nowrap; }
.ld-speedwrap { position:absolute; left:50%; bottom:2.9em; transform:translateX(-50%); display:flex; align-items:center; gap:0.5em; font-weight:900; font-size:0.8em; letter-spacing:.12em;
  color:#fff4dc; text-shadow:0 0.1em 0 #2b1a33, 0 0 0.4em rgba(27,16,36,.9); }
.ld-speed { width:12em; height:0.85em; border-radius:0.5em; border:0.17em solid #2b1a33; background:rgba(27,16,36,.6); overflow:hidden; }
.ld-speed > i { display:block; height:100%; background:linear-gradient(90deg,#6aa84f,#ffd45a 70%,#f08a24); }
.ld-speed.boost > i { background:#fff4dc; }
.ld-say { position:absolute; transform:translate(-50%,-100%); max-width:15em; background:#fff4dc; color:#2b1a33; border:0.16em solid #2b1a33; border-radius:0.9em; padding:0.12em 0.6em;
  font-weight:800; font-size:0.92em; line-height:1.2; text-align:center; box-shadow:0 0.18em 0 rgba(43,26,51,.45); }
.ld-say:after { content:''; position:absolute; left:50%; bottom:-0.62em; margin-left:-0.3em; border:0.3em solid transparent; border-top-color:#2b1a33; }
.ld-edge { position:absolute; transform:translate(0,-50%); background:#f7b9c2; color:#2b1a33; border:0.15em solid #2b1a33; border-radius:0.8em; padding:0 0.6em; font-weight:900; font-size:0.86em; white-space:nowrap; }
`;
  document.head.appendChild(s);
}

/** Rows of obstacles: each row leaves a way through (a free lane, or something you can hop). */
function buildCourse(rng, hard, L) {
  const rows = [];
  const low = () => ['sprinkler', 'leaf', 'gnome', 'sprinkler', 'leaf'][Math.floor(rng() * 5)];
  let x = 22;
  let lastFree = 1;
  while (x < L - 16) {
    const p = (x - 22) / (L - 38);
    const cells = [null, null, null];
    const r = rng();
    if (r < 0.15) {
      const k = Math.floor(rng() * 3);
      cells[k] = 'pad';
      if (rng() < 0.45 + p * 0.3) { const o = (k + 1 + Math.floor(rng() * 2)) % 3; cells[o] = rng() < 0.5 ? 'chair' : low(); }
    } else if (r < 0.5 - p * 0.14) {
      cells[Math.floor(rng() * 3)] = rng() < 0.45 ? 'chair' : low();
    } else if (r < (hard ? 0.76 : 0.84)) {
      // two lanes blocked — and not always the same free lane twice in a row
      let free = Math.floor(rng() * 3);
      if (free === lastFree && rng() < 0.6) free = (free + 1 + Math.floor(rng() * 2)) % 3;
      lastFree = free;
      for (let k = 0; k < 3; k++) if (k !== free) cells[k] = rng() < 0.5 ? 'chair' : low();
    } else {
      // a wall: something in every lane, at least one of them hoppable
      const hop = Math.floor(rng() * 3);
      for (let k = 0; k < 3; k++) cells[k] = k === hop ? low() : (rng() < 0.5 ? 'chair' : low());
    }
    rows.push({ x, cells });
    x += hard ? rng.range(7.4, 10.6) : rng.range(9.2, 13.4);
  }
  return rows;
}

const _v = new THREE.Vector3();

export default class LawnDash extends Minigame {
  static meta = {
    id: 'dash', title: 'Lawn Dash', icon: '🐇',
    blurb: 'First to the far fence! You run by yourself — <b>switch lanes</b> to dodge and <b>hop</b> the low stuff. Clean running builds speed; yellow chevrons are a free boost. Sprinklers soak, lawn chairs trip (you can\'t hop a chair).',
    controls: [['move', 'up / down: change lane'], ['a', 'hop']],
    scoreLabel: 'seconds', goals: [37, 32.5, 29.5], lower: true, hasHard: true, music: 'borough',
  };
  get meta() { return this.hard ? HARD_META : LawnDash.meta; }

  // ================================================================ setup
  setup(opts) {
    injectCss();
    this.L = this.hard ? 330 : 300;
    const seed = opts.seed ? opts.seed * 104729 : (Math.random() * 1e9) | 0;
    this.rng = makeRng(seed);
    this.aiRng = makeRng(seed ^ 0x5bd1e995);
    this.ease = clamp(opts.ease || 0, 0, 3);
    this.rows = buildCourse(this.rng, this.hard, this.L);
    this.t = 0;
    this.camX = 5;
    this.finT = 0;
    this._buildScene();
    this._buildRunners();
    this._buildHud();
    this._camera(0, true);
  }

  _buildScene() {
    const sc = this.scene, L = this.L;
    this.rig = lightRig(sc, 'day', { shadowSize: 22, fog: [70, 150] });
    const stat = new THREE.Group();
    sc.add(stat);
    const r = makeRng(4242);
    // lawn (mowing stripes) and the dirt track with lane lines
    const gt = canvasTex(64, 64, (c) => {
      c.fillStyle = '#8cc261'; c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#98cc6d'; c.fillRect(32, 0, 32, 64);
      for (let i = 0; i < 26; i++) { c.fillStyle = ['#e8842c', '#d4502f', '#f2b632'][i % 3]; c.beginPath(); c.ellipse(Math.random() * 64, Math.random() * 64, 1.6, 1, Math.random() * 3, 0, 6.3); c.fill(); }
    }, { repeat: [(L + 90) / 6, 9] });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(L + 90, 54), texMat(gt));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(L / 2, 0, -1); lawn.receiveShadow = true;
    sc.add(lawn);
    const tt = canvasTex(128, 96, (c) => {
      c.fillStyle = '#e6d3a4'; c.fillRect(0, 0, 128, 96);
      c.fillStyle = '#cdb684'; c.fillRect(0, 0, 128, 5); c.fillRect(0, 91, 128, 5);
      for (let i = 0; i < 40; i++) { c.fillStyle = i % 2 ? '#d9c594' : '#efdfb6'; c.beginPath(); c.arc(Math.random() * 128, 6 + Math.random() * 84, 1 + Math.random() * 1.6, 0, 6.3); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const y of [35.2, 60.8]) for (let x = 0; x < 128; x += 32) c.fillRect(x + 4, y - 1.2, 18, 2.4);
    }, { repeat: [(L + 40) / 8, 1] });
    const track = new THREE.Mesh(new THREE.PlaneGeometry(L + 40, 6.4), texMat(tt));
    track.rotation.x = -Math.PI / 2; track.position.set(L / 2, 0.02, 0); track.receiveShadow = true;
    sc.add(track);
    // start + finish paint
    stat.add(M(box(0.3, 0.02, 6.4), toon(0xfffaf0), 0, 0.035, 0, { shadow: false }));
    const ck = canvasTex(32, 128, (c) => { for (let x = 0; x < 2; x++) for (let y = 0; y < 8; y++) { c.fillStyle = (x + y) % 2 ? '#2b1a33' : '#fffaf0'; c.fillRect(x * 16, y * 16, 16, 16); } }, { nearest: true });
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 6.4), new THREE.MeshBasicMaterial({ map: ck }));
    fin.rotation.x = -Math.PI / 2; fin.position.set(L, 0.04, 0);
    sc.add(fin);
    // north side: picket fence, houses, trees, lamp posts
    stat.add(fence(-16, -4.7, L + 22, -4.7, { style: 'picket' }));
    const walls = [0xf2d9b8, 0xf7efe0, 0xdfeedd, 0xf2e2c4, 0xe9e2f2, 0xf7dcc0], roofs = [0x2a6f77, 0xc8452d, 0x8a5aa8, 0x5a4a5e, 0xd4502f], doors = [0xd4502f, 0x2a6f77, 0xf08a24, 0x6aa84f];
    let hi = 0;
    for (let x = -12; x < L + 24; x += 27) {
      const h = PROPS.house({ w: 6.2, d: 4.6, h: 3.1, wall: walls[hi % 6], roof: roofs[hi % 5], doorC: doors[hi % 4], hip: hi % 4 === 3, chimney: hi % 2 === 0, roofH: 2.1 });
      h.position.set(x + r.range(-2, 2), 0, -9.4);
      stat.add(h);
      hi++;
      const t = PROPS.tree({ rng: r, s: r.range(0.8, 1.05) }); t.position.set(x + 13.5 + r.range(-2.5, 2.5), 0, r.range(-8.4, -6.6)); stat.add(t);
      const lp = PROPS.lamp({}); lp.position.set(x + 7, 0, -5.5); stat.add(lp);
      if (r() < 0.6) { const mb = PROPS.mailbox({ color: doors[hi % 4] }); mb.position.set(x + 4.4, 0, -5.4); stat.add(mb); }
    }
    // south side: low planting, then the street
    for (let x = -12; x < L + 22; x += r.range(4.5, 8.5)) {
      const k = r();
      const b = k < 0.4 ? PROPS.bush({ berries: r() < 0.3 }) : k < 0.8 ? PROPS.flowers({ n: 7 }) : PROPS.leafPile({ color: r() < 0.5 ? 0xe8842c : 0xd4502f });
      b.position.set(x, 0, r.range(4.4, 5.3));
      stat.add(b);
    }
    stat.add(M(box(L + 90, 0.05, 4.6), toon(0x8d8a96), L / 2, 0.0, 8.6, { shadow: false }));
    stat.add(M(box(L + 90, 0.14, 0.3), toon(0xd9d2c2), L / 2, 0.04, 6.2, { shadow: false }));
    for (let x = -30; x < L + 50; x += 4.2) stat.add(M(box(1.9, 0.02, 0.16), toon(0xf4efdf), x, 0.04, 9.2, { shadow: false }));
    // block-party dressing at both ends, bunting along the way
    const pole = (x, z, h = 3.9) => stat.add(M(cyl(0.07, 0.09, h, 6), toon(0xfffaf0), x, h / 2, z));
    for (const x0 of [-10, L - 14]) {
      for (let i = 0; i < 3; i++) { pole(x0 + i * 12, -5.3); if (i < 2) stat.add(bunting(x0 + i * 12, -5.3, x0 + (i + 1) * 12, -5.3, { y: 3.7, sag: 0.7 })); }
    }
    for (let x = 60; x < L - 40; x += 75) { pole(x, -5.3); pole(x + 12, -5.3); stat.add(bunting(x, -5.3, x + 12, -5.3, { y: 3.7, sag: 0.7 })); }
    const booth = PROPS.booth({ text: 'LAWN DASH', color: 0xd4502f }); booth.position.set(-6.2, 0, -6.6); stat.add(booth);
    const tent = PROPS.tent({ color: 0x2a6f77, r: 2 }); tent.position.set(-12.5, 0, -7.6); stat.add(tent);
    const tent2 = PROPS.tent({ color: 0xd4502f, r: 2.1 }); tent2.position.set(L + 9, 0, -7.8); stat.add(tent2);
    const lemon = PROPS.booth({ text: 'LEMONADE', color: 0xf2b632 }); lemon.position.set(L + 2.5, 0, -6.6); stat.add(lemon);
    for (const [x, sd] of [[-2.4, 1], [L - 4.5, 2], [L + 6.5, 3]]) { const bl = PROPS.balloons({ seed: sd }); bl.position.set(x, 0, -4.1); stat.add(bl); }
    const s1 = PROPS.signPost({ text: 'START', w: 2.2, h: 0.8 }); s1.position.set(0.2, 0, -3.75); stat.add(s1);
    const s2 = PROPS.signPost({ text: 'FINISH', w: 2.6, h: 0.9, bg: '#ffd45a' }); s2.position.set(L + 0.2, 0, -3.75); stat.add(s2);
    [['¼', 0.25], ['½', 0.5], ['¾', 0.75]].forEach(([txt, f]) => { const y = PROPS.yardSign({ text: txt }); y.position.set(L * f, 0, -3.6); stat.add(y); });
    for (const z of [-3.5, 3.5]) { stat.add(M(cyl(0.08, 0.1, 3.4, 6), toon(0xfffaf0), L, 1.7, z)); stat.add(M(cone(0.42, 0.7, 4), toon(z < 0 ? 0xd4502f : 0xffd45a), L + 0.45, 3.1, z, { rz: -Math.PI / 2, sz: 0.15 })); }
    bake(stat);

    // ---- obstacles (dynamic: they get knocked about)
    this.obs = [];
    const padTex = canvasTex(64, 64, (c) => {
      c.strokeStyle = '#ffd45a'; c.lineWidth = 9; c.lineJoin = 'round'; c.lineCap = 'round';
      for (const x of [10, 28, 46]) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x + 14, 32); c.lineTo(x, 52); c.stroke(); }
    });
    const padMat = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false });
    const chairCols = [0x58b8c9, 0xd4502f, 0xffd45a, 0x8a5aa8];
    const wetMat = new THREE.MeshBasicMaterial({ color: 0x8fd8f0, transparent: true, opacity: 0.45, depthWrite: false });
    for (const row of this.rows) {
      row.cells.forEach((type, lane) => {
        if (!type) return;
        let obj;
        if (type === 'pad') {
          obj = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), padMat);
          obj.rotation.x = -Math.PI / 2; obj.position.y = 0.05; obj.renderOrder = 3;
        } else if (type === 'sprinkler') {
          obj = PROPS.sprinkler(); obj.scale.setScalar(1.7);
          const wet = new THREE.Mesh(circle(0.5, 20), wetMat);
          wet.rotation.x = -Math.PI / 2; wet.position.y = 0.025; wet.renderOrder = 2;
          obj.add(wet);
        }
        else if (type === 'leaf') { obj = PROPS.leafPile({ color: r() < 0.5 ? 0xe8842c : 0xd4502f }); obj.scale.setScalar(0.72); }
        else if (type === 'gnome') { obj = PROPS.gnomeStatue({ color: r() < 0.5 ? 0xc8452d : 0x3f6fb5 }); obj.scale.setScalar(1.45); obj.rotation.y = -Math.PI / 2; }
        else { obj = PROPS.lawnChair({ color: chairCols[Math.floor(r() * 4)] }); obj.scale.setScalar(1.15); obj.rotation.y = -Math.PI / 2 + r.range(-0.3, 0.3); }
        obj.position.x = row.x; obj.position.z = LANES[lane];
        sc.add(obj);
        this.obs.push({ x: row.x, lane, type, obj, gone: false, done: {}, row, fly: null });
      });
    }
    this.obs.sort((a, b) => a.x - b.x);

    // ---- the crowd
    this.fans = [];
    const addFan = (x, spec) => {
      const ch = new Character(spec);
      ch.setPos(x, r.range(-4.25, -3.75));
      ch.face(r.range(-0.25, 0.25));
      ch.setBase(r() < 0.7 ? 'cheer' : 'move');
      ch.t = r() * 10;
      sc.add(ch.root);
      this.fans.push({ ch, x });
    };
    const rnd = () => ({ kind: 'animal', species: FANS[Math.floor(r() * FANS.length)], shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], build: ['small', 'normal', 'normal', 'big'][Math.floor(r() * 4)], hat: r() < 0.4 ? ['cap', 'beanie', 'straw', 'bow'][Math.floor(r() * 4)] : undefined, hatC: SHIRTS[Math.floor(r() * SHIRTS.length)] });
    addFan(-3.6, NPCS.bleat.spec); addFan(3.2, NPCS.quill.spec); addFan(6.4, rnd()); addFan(9.6, NPCS.biscuit.spec);
    for (let x = 34; x < L - 30; x += r.range(20, 34)) { addFan(x, rnd()); if (r() < 0.5) addFan(x + 1.6, rnd()); }
    addFan(L - 8, NPCS.nutmeg.spec); addFan(L - 6.2, NPCS.clove.spec); addFan(L - 2.6, rnd()); addFan(L + 3.4, rnd()); addFan(L + 5.8, NPCS.hamm.spec);

    // ---- the mail truck Zip keeps bringing up
    const truck = PROPS.car({ color: 0xf4f0e6 });
    truck.add(M(box(3.64, 0.3, 1.94), toon(0x2a6f9a), 0, 0.72, 0, { shadow: false }));
    const ms = signPlane('MAIL', 1.2, 0.4, { color: '#2a6f9a' }); ms.position.set(-0.2, 1.12, 0.87); truck.add(ms);
    truck.position.set(-9, 0, 7.7);
    sc.add(truck);
    this.truck = truck;
  }

  _buildRunners() {
    const mk = (id, spec, lane, off) => {
      const ch = new Character(spec);
      ch.setBase('ready');
      this.scene.add(ch.root);
      return { id, ch, x: -0.6, lane, z: LANES[lane], off, y: 0, v: 0, flow: 0, base: BASE, rubber: 1, slowT: 0, slowK: 1, stumbleT: 0, boostT: 0, niceT: 0, hopT: 0, hopX: 0, oi: 0, fin: 0, hits: 0, dust: 0 };
    };
    this.P = mk('you', teamSpec('captain'), 1, 0.26);
    this.Z = mk('zip', teamSpec('zip', { jersey: 0xf7b9c2, trim: 0xffffff, pants: 0xfffaf0, helmet: { color: 0xfffaf0, stripe: 0xe58a9c } }), 0, -0.26);
    const Z = this.Z;
    if (this.hard) { Z.base = 9.75; Z.err = 0.1; }
    else { Z.base = BASE - 0.35 * this.ease; Z.err = 0.3 + 0.08 * this.ease; }
    Z.plan = []; Z.ri = 0; Z.laneCd = 0; Z.quipT = 2.2; Z.lead = 0;
    const mark = new THREE.Mesh(ring(0.52, 0.68, 24), flat(0xffd45a, { transparent: true, opacity: 0.9, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.renderOrder = 4;
    this.scene.add(mark);
    this.mark = mark;
    this._poseRunner(this.P, 0); this._poseRunner(this.Z, 0);
  }

  _buildHud() {
    this.dYou = el('div.dot.you', 'U');
    this.dZip = el('div.dot.zip', 'Z');
    this.elFill = el('div.fill');
    this.elStrip = el('div.ld-strip', el('div.rail', this.elFill), el('div.flag', '🏁'), this.dZip, this.dYou);
    this.elYou = el('div.ld-you', '▼ YOU');
    this.elSpeed = el('div.ld-speed', el('i'));
    this.elSay = el('div.ld-say', { style: { display: 'none' } });
    this.elEdge = el('div.ld-edge', { style: { display: 'none' } });
    this.pops = [];
    this.sayT = 0;
    this.hud.append(this.elStrip, this.elYou, el('div.ld-speedwrap', el('span', 'SPEED'), this.elSpeed), this.elEdge, this.elSay);
    this.hudScore('0.0 s');
  }

  _camera(dt, snap) {
    const cam = this.camera;
    const tx = clamp(this.P.x + 6.8, 5, this.L + 3);
    this.camX = snap ? tx : damp(this.camX, tx, 7, dt);
    cam.fov = 22;
    const d = 42 * Math.max(1, 1.62 / (cam.aspect || 1.78));
    const pitch = 0.93;
    cam.position.set(this.camX, Math.sin(pitch) * d + 0.6, 0.5 + Math.cos(pitch) * d);
    cam.lookAt(this.camX, 0.6, 0.5);
    this.fx.applyShake(cam);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    this.rig.follow(this.camX, 0);
  }
  _px(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return [(_v.x * 0.5 + 0.5) * G.W, (-_v.y * 0.5 + 0.5) * G.H];
  }

  // ================================================================ running
  begin() {
    this.P.ch.setBase('move'); this.Z.ch.setBase('move');
    this.P.v = this.Z.v = 3;
    G.audio.sfx('hike');
    this._say(this.Z, 'Go go go go go!');
  }

  /** Floating text that stays with a runner (they move far too fast for world-anchored pops). */
  _say(r, text, cls = 'white small') {
    if (r === this.Z) { this.elSay.textContent = text; this.elSay.style.display = ''; this.sayT = 1.9; return; }
    const node = el(`div.pop.${cls.split(' ').join('.')}`, text);
    node.style.animationDuration = '1.1s';
    this.hud.appendChild(node);
    this.pops.push({ node, r, t: 1.1 });
  }
  _quip(kind) { const list = QUIPS[kind]; this._say(this.Z, list[Math.floor(this.aiRng() * list.length)]); this.Z.quipT = 3.4 + this.aiRng() * 2.6; }

  _hop(r) {
    if (r.hopT > 0 || r.stumbleT > 0 || r.fin) return false;
    r.hopT = 0.0001; r.hopX = r.x;
    r.ch.play('hop', HOP);
    if (r === this.P) G.audio.sfx('hop');
    return true;
  }

  _hit(r, o) {
    const mine = r === this.P;
    const air = r.y > 0.42;
    const pos = { x: o.x, y: 1.2, z: LANES[o.lane] };
    o.done[r.id] = true;
    if (o.type === 'pad') {
      r.boostT = 1.3; r.flow = 1; r.v = Math.max(r.v, r.base + FLOW + 1.5);
      this.fx.burst('spark', { x: r.x, y: 0.6, z: r.z }, 8, { speed: 3, up: 2, life: 0.5, s0: 0.36, color: 0xffd45a, g: -2 });
      if (mine) { G.audio.sfx('power'); this._say(r, 'ZOOM!', ''); } else if (this.aiRng() < 0.5) this._quip('boost');
      return;
    }
    if (o.type !== 'chair' && air) {
      // cleared it — a hop started close to the obstacle earns a little kick
      if (o.x - r.hopX < Math.max(r.v, 6) * 0.27) {
        r.flow = Math.min(1, r.flow + 0.3); r.niceT = 0.7;
        if (mine) { G.audio.sfx('good'); this._say(r, 'NICE HOP!', 'green small'); }
      }
      return;
    }
    r.hits++;
    r.flow = o.type === 'leaf' ? r.flow * 0.45 : 0;
    r.boostT = 0;
    if (o.type === 'sprinkler') {
      r.slowT = 1.3; r.slowK = 0.45; r.v *= 0.6;
      r.ch.play('flinch'); r.ch.setExpr('wide', 1.2);
      this.fx.burst('drop', pos, 14, { speed: 3.4, up: 3.6, life: 0.55, s0: 0.26, color: 0x9be8ff });
      if (mine) { G.audio.sfx('splash'); this._say(r, 'SOAKED!', 'cool'); this.fx.shake(0.12, 0.2); } else this._quip('soak');
    } else if (o.type === 'leaf') {
      r.slowT = 0.55; r.slowK = 0.74;
      o.gone = true; o.obj.visible = false;
      this.fx.burst('leaf', pos, 16, { speed: 3.6, up: 4, g: -5, life: 1.1, s0: 0.3, s1: 0.2, flip: 8, color: [0xe8842c, 0xd4502f, 0xf2b632] });
      if (mine) { G.audio.sfx('land'); this._say(r, 'Fwumph', 'white small'); }
    } else {
      // chair or gnome: a proper trip
      r.stumbleT = o.type === 'chair' ? 0.85 : 0.65; r.v = 2.4;
      r.ch.play('stumble', r.stumbleT + 0.1); r.ch.setExpr('dizzy', 0.9);
      o.gone = true;
      o.fly = { vx: 5 + r.v, vy: 6.5, vz: (this.aiRng() - 0.5) * 5, t: 0, spin: 9 };
      this.fx.impact(pos, 0xffd45a, 0.75);
      if (mine) { G.audio.sfx(o.type === 'chair' ? 'tackle' : 'bonk'); this._say(r, o.type === 'chair' ? 'OOF!' : 'BONK!', 'bad'); this.fx.shake(0.2, 0.25); } else this._quip('trip');
    }
  }

  _stepRunner(r, dt) {
    if (r.slowT > 0) r.slowT -= dt;
    if (r.stumbleT > 0) r.stumbleT -= dt;
    if (r.boostT > 0) r.boostT -= dt;
    if (r.niceT > 0) r.niceT -= dt;
    let target;
    if (r.fin) target = 3.2;
    else {
      if (r.stumbleT <= 0 && r.slowT <= 0) r.flow = Math.min(1, r.flow + dt / 4.5);
      target = (r.base + r.flow * FLOW + (r.boostT > 0 ? BOOST : 0) + (r.niceT > 0 ? 1.2 : 0)) * r.rubber;
      if (r.slowT > 0) target *= r.slowK;
      if (r.stumbleT > 0) target = 2.4;
    }
    r.v = damp(r.v, target, r.v > target ? 7 : 3.4, dt);
    r.x += r.v * dt;
    r.z = damp(r.z, LANES[r.lane], 17, dt);
    if (r.hopT > 0) {
      r.hopT += dt;
      if (r.hopT >= HOP) { r.hopT = 0; this.fx.dust(r.x, r.z + r.off, 0xe8d9b8, 2); if (r === this.P) G.audio.sfx('land'); }
    }
    r.y = r.hopT > 0 ? Math.sin((r.hopT / HOP) * Math.PI) * 1.15 : 0;
    // obstacles in reach
    while (r.oi < this.obs.length && this.obs[r.oi].x < r.x - 1.2) r.oi++;
    for (let i = r.oi; i < this.obs.length; i++) {
      const o = this.obs[i];
      if (o.x > r.x + 1.1) break;
      if (o.gone || o.done[r.id] || r.fin) continue;
      const reach = o.type === 'pad' ? 0.9 : 0.5;
      if (Math.abs(o.x - r.x) < reach && Math.abs(r.z - LANES[o.lane]) < 0.8) this._hit(r, o);
    }
    // footfalls
    r.dust += r.v * dt;
    if (r.dust > 2.4 && r.y === 0) { r.dust = 0; if (r.v > 8) this.fx.dust(r.x - 0.3, r.z + r.off, 0xe8d9b8, 1); if (r === this.P) G.audio.sfx('step', 1.2); }
    if (r.boostT > 0 && Math.random() < dt * 30) this.fx.emit('spark', r.x - 0.6, 0.5 + Math.random() * 0.9, r.z + r.off + (Math.random() - 0.5) * 0.6, { vx: -6, life: 0.3, s0: 0.3, color: 0xffd45a });
  }

  /** Lane plan for a row: which lane a careful runner in `lane` would pick, and whether they must hop. */
  _plan(row, lane) {
    let best = lane, bs = -1e9, hop = false;
    for (let k = 0; k < 3; k++) {
      const o = this.obs.find((x) => x.row === row && x.lane === k && !x.gone);
      const t = o ? o.type : null;
      let sc = t === 'pad' ? 3 : t === null ? 2 : t === 'chair' ? -6 : 0.7;
      sc -= Math.abs(k - lane) * 0.55;
      if (sc > bs) { bs = sc; best = k; hop = !!t && t !== 'pad' && t !== 'chair'; }
    }
    return { x: row.x, lane: best, hop };
  }

  _zipAI(dt) {
    const Z = this.Z, P = this.P;
    if (Z.fin) return;
    Z.laneCd -= dt;
    while (Z.ri < this.rows.length && this.rows[Z.ri].x < Z.x + 12) {
      const row = this.rows[Z.ri++];
      Z.plan.push(this.aiRng() < Z.err ? { x: row.x, lane: null, hop: false } : this._plan(row, Z.plan.length ? (Z.plan[Z.plan.length - 1].lane ?? Z.lane) : Z.lane));
    }
    while (Z.plan.length && Z.x > Z.plan[0].x + 0.7) Z.plan.shift();
    const p = Z.plan[0];
    if (p && p.lane !== null) {
      const dx = p.x - Z.x;
      if (Z.lane !== p.lane && Z.laneCd <= 0 && dx < Z.v * 0.8) { Z.lane += Math.sign(p.lane - Z.lane); Z.laneCd = 0.13; }
      if (p.hop && Z.lane === p.lane && dx > 0 && dx < Z.v * 0.3) this._hop(Z);
    }
    // she can't help looking back when she's way out in front — and digs in when she's behind
    const gap = Z.x - P.x;
    Z.rubber = gap > 12 ? 0.95 : gap < -12 ? 1.04 : 1;
    Z.quipT -= dt;
    const lead = gap > 1.5 ? 1 : gap < -1.5 ? -1 : 0;
    if (lead !== 0 && lead !== Z.lead && this.elapsed > 2.5) { Z.lead = lead; if (Z.quipT < 2.6) this._quip(lead > 0 ? 'ahead' : 'behind'); }
    if (Z.quipT <= 0) this._quip('idle');
  }

  tick(dt) {
    const P = this.P, Z = this.Z, inp = G.input, L = this.L;
    if (this.opts.auto) this._bot(dt);
    if (!P.fin) {
      const nav = inp.nav();
      if (nav === 'up' && P.lane > 0) { P.lane--; G.audio.sfx('move'); }
      else if (nav === 'down' && P.lane < 2) { P.lane++; G.audio.sfx('move'); }
      if (inp.hit('a')) this._hop(P);
    }
    this._zipAI(dt);
    this._stepRunner(P, dt);
    this._stepRunner(Z, dt);
    // finish line
    for (const r of [P, Z]) {
      if (!r.fin && r.x >= L) {
        r.fin = this.elapsed;
        const first = r === P ? !Z.fin : !P.fin;
        this.fx.confetti({ x: L + 0.5, y: 2.2, z: r.z }, first ? 46 : 16);
        r.ch.setBase(first ? 'cheer' : 'sad');
        if (first) { G.audio.sfx('td'); G.ui.banner(r === P ? 'YOU WIN!' : 'ZIP WINS!', r === P ? 'Fastest feet in the Borough' : 'She will not stop talking about this', { dur: 1.4, cls: r === P ? '' : 'bad' }); }
        if (r === Z) this._say(Z, first ? 'I WIN! Again! Still!' : 'Second?! The LAWN came second.');
      }
    }
    this.hudScore(`${(P.fin || this.elapsed).toFixed(1)} s`);
    if (P.fin) {
      this.finT += dt;
      if (this.finT > 0.9) this._done();
    } else if (this.elapsed > 80) this._done(true);
  }

  _done(dnf) {
    const P = this.P, Z = this.Z;
    const time = Math.round((P.fin || 99.9) * 10) / 10;
    const won = !dnf && (!Z.fin || P.fin <= Z.fin);
    G.input.setAxis(0, 0);
    this.finish({
      score: time, won, fail: !!dnf, failText: 'Did not finish',
      title: won ? 'You win!' : 'Zip wins!',
      detail: dnf ? 'Zip has already told the whole block party about it.'
        : `${won ? 'You beat Zip' : 'Zip finished first'}${Z.fin ? ` — her time: ${Z.fin.toFixed(1)} s` : ''} · you tripped or got soaked ${P.hits} time${P.hits === 1 ? '' : 's'}`,
      extra: { time, zip: Z.fin ? Math.round(Z.fin * 10) / 10 : null, hits: P.hits, zipHits: Z.hits },
    });
  }

  // ================================================================ autopilot (QA + tuning):  ?mg=dash&auto=1&skill=0.7
  _bot(dt) {
    const b = this.bot || (this.bot = { skill: this.opts.skill ?? 0.7, plan: [], ri: 0, pulse: 0, cd: 0 });
    const P = this.P, inp = G.input;
    b.cd -= dt;
    if (b.pulse > 0) { b.pulse--; if (b.pulse === 0) inp.setAxis(0, 0); }
    while (b.ri < this.rows.length && this.rows[b.ri].x < P.x + 11) {
      const row = this.rows[b.ri++];
      const oops = Math.random() < (1 - b.skill) * 0.75;
      b.plan.push(oops ? { x: row.x, lane: null, hop: false } : this._plan(row, b.plan.length ? (b.plan[b.plan.length - 1].lane ?? P.lane) : P.lane));
    }
    while (b.plan.length && P.x > b.plan[0].x + 0.7) b.plan.shift();
    const p = b.plan[0];
    if (!p || p.lane === null || P.fin) return;
    const dx = p.x - P.x;
    if (P.lane !== p.lane && b.cd <= 0 && b.pulse === 0 && dx < P.v * 0.85) { inp.setAxis(0, Math.sign(p.lane - P.lane)); b.pulse = 2; b.cd = 0.16; }
    if (p.hop && P.lane === p.lane && dx > 0 && dx < P.v * (0.2 + 0.2 * Math.random())) inp.press('a');
  }

  // ================================================================ every frame
  _poseRunner(r, dt) {
    r.ch.setPos(r.x, r.z + r.off, r.y);
    r.ch.face(Math.atan2(Math.max(r.v, 3), (LANES[r.lane] - r.z) * 5), dt || undefined, 14);
    if (dt) r.ch.update(dt, this.playing ? r.v : 0);
  }

  ambient(dt) {
    this.t += dt;
    const P = this.P, Z = this.Z;
    if (this.state === 'over') { for (const r of [P, Z]) { r.v = damp(r.v, 0, 4, dt); r.x += r.v * dt; } }
    this._poseRunner(P, dt); this._poseRunner(Z, dt);
    this._camera(dt, false);
    this.mark.position.set(P.x, 0.06, P.z + P.off);
    this.mark.scale.setScalar(1 + Math.sin(this.t * 6) * 0.06);
    // knocked-over furniture
    for (const o of this.obs) {
      if (o.fly) {
        const f = o.fly;
        f.t += dt; f.vy -= 22 * dt;
        o.obj.position.x += f.vx * dt; o.obj.position.z += f.vz * dt; o.obj.position.y = Math.max(0, o.obj.position.y + f.vy * dt);
        o.obj.rotation.z -= f.spin * dt; o.obj.rotation.x += f.spin * 0.6 * dt;
        if (o.obj.position.y === 0 && f.t > 0.3) { f.vx *= 0.5; f.vz *= 0.5; f.spin *= 0.4; f.vy = Math.abs(f.vy) * 0.25; if (f.t > 1.4) { o.fly = null; o.obj.visible = false; this.fx.burst('puff', o.obj.position, 5, { speed: 1.5, up: 1.5, life: 0.4, s0: 0.4, g: 0 }); } }
      } else if (o.type === 'pad') {
        o.obj.scale.setScalar(1 + Math.sin(this.t * 7 + o.x) * 0.08);
      } else if (o.type === 'sprinkler' && Math.abs(o.x - this.camX) < 18) {
        const a = this.t * 5 + o.x;
        for (let k = 0; k < 2; k++) this.fx.emit('drop', o.x, 0.7, LANES[o.lane], { vx: Math.cos(a + k * 3.14) * 1.9, vz: Math.sin(a + k * 3.14) * 1.9, vy: 4.2, g: -13, life: 0.62, s0: 0.2, s1: 0.1, color: 0x9be8ff });
      }
    }
    // crowd: only the ones on screen bother animating
    for (const f of this.fans) if (Math.abs(f.x - this.camX) < 21) f.ch.update(dt, 0);
    // the mail truck paces the race
    if (this.playing) { this.truck.position.x += 9.7 * dt; if (Math.random() < dt * 6) this.fx.emit('puff', this.truck.position.x - 2, 0.4, 7.7, { vx: -1, vy: 0.6, life: 0.5, s0: 0.3, s1: 0.5, color: 0xd9d2c2, g: 0 }); }
    if (Math.random() < dt * 2.5) this.fx.emit('leaf', this.camX + 18, 7 + Math.random() * 3, -8 + Math.random() * 14, { vx: -4 - Math.random() * 2, vy: -1.6, g: 0, life: 5, s0: 0.28, s1: 0.28, vrot: 3, flip: 3, color: [0xe8842c, 0xd4502f, 0xf2b632][Math.floor(Math.random() * 3)] });
    // hud
    const L = this.L;
    const fy = clamp(P.x / L, 0, 1), fz = clamp(Z.x / L, 0, 1);
    this.dYou.style.left = `${fy * 100}%`; this.dZip.style.left = `${fz * 100}%`;
    this.elFill.style.width = `${fy * 100}%`;
    const [sx, sy] = this._px(P.x, 2.75 + P.y, P.z + P.off);
    this.elYou.style.left = `${sx}px`; this.elYou.style.top = `${sy}px`;
    this.elYou.style.display = this.state === 'play' && this.elapsed > 4 ? 'none' : '';
    this.elSpeed.firstChild.style.width = `${clamp((P.v - 2) / (BASE + FLOW + BOOST - 2), 0, 1) * 100}%`;
    this.elSpeed.classList.toggle('boost', P.boostT > 0);
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t -= dt;
      if (p.t <= 0) { p.node.remove(); this.pops.splice(i, 1); continue; }
      const [x, y] = this._px(p.r.x, 2.7 + p.r.y, p.r.z + p.r.off);
      p.node.style.left = `${x}px`; p.node.style.top = `${y}px`;
    }
    // Zip: speech bubble (clamped on screen so you still hear her from behind) + an edge tag when she is out of frame
    const [zx, zy] = this._px(Z.x, 2.9 + Z.y, Z.z + Z.off);
    const off = zx < 30 ? -1 : zx > G.W - 30 ? 1 : 0;
    if (this.sayT > 0) {
      this.sayT -= dt;
      if (this.sayT <= 0) this.elSay.style.display = 'none';
      else { this.elSay.style.left = `${clamp(zx, 130, G.W - 130)}px`; this.elSay.style.top = `${zy - (off ? 14 : 0)}px`; }
    }
    if (off && this.state !== 'intro') {
      const gap = Math.abs(Math.round(Z.x - P.x));
      this.elEdge.style.display = '';
      this.elEdge.textContent = off < 0 ? `◀ Zip ${gap}m` : `Zip ${gap}m ▶`;
      this.elEdge.style.left = off < 0 ? '8px' : ''; this.elEdge.style.right = off > 0 ? '8px' : '';
      this.elEdge.style.top = `${zy + 46}px`;
    } else this.elEdge.style.display = 'none';
  }

  cleanup() {
    this.P.ch.dispose(); this.Z.ch.dispose();
    for (const f of this.fans) f.ch.dispose();
    for (const p of this.pops) p.node.remove();
    G.input.setAxis(0, 0);
  }
}

const HARD_META = { ...LawnDash.meta, goals: [41, 36, 32.5] };
