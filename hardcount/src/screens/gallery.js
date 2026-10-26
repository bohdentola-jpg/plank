// GALLERY — QA screen for the player models and their animation.
//
// URL params (?screen=gallery&…):
//   mode=lineup   all four sample teams, home + away, every position / body type, plus officials
//                 (team=pht → one team's eleven positions, home in front, away behind; side=back shows the backs)
//   mode=actions  actions=throw,catch_high,juke | all   t=0.25 freezes every clip at that time (else loops)
//   mode=bases    every BASE stance (bases=stand,ready… | all)
//   mode=run      runners at 2 / 5 / 8 / 10.5 yd/s, backpedal, shuffle, ball carrier, a banking curve, kick-slide
//   mode=closeup  head / helmet / facemask turntable: helmets on (every facemask + visors) and off (hair styles)
//   mode=huddle   six players in the huddle around a first-person camera at QB eye height (the main menu shot)
//   mode=ball     footballs (pro + striped) spinning in a spiral
//   mode=perf     22 players running around; shows the animation cost per frame
// Common: cam=az,el,dist | front | back | side | top | low   fov=   light=night|day   crt=0   full=1
//   lod=low   dirt=0..1   helmet=0   ts=0.25 (time scale)   rot=deg (closeup)   bones=1 (skeleton overlay)
// Drag with the mouse / arrow keys to orbit, wheel to zoom.
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { TEAMS, getTeam } from '../data/teams.js';
import { buildRoster } from '../data/roster.js';
import { createPlayerModel, createRefModel } from '../gfx/player/index.js';
import { createBallModel } from '../gfx/ball.js';
import { getEnvMap } from '../core/envmap.js';
import { ACTIONS, BASES } from '../sim/anims.js';
import { text } from '../core/ui.js';
import { input } from '../core/input.js';
import { makeRng } from '../core/util.js';
import { canvas as mkCanvas, toTex } from '../gfx/textures.js';

const D2R = Math.PI / 180;

// which kind of player performs each action, its base and carry
const ACTION_CAST = {
  snap: ['C', 'center'], longsnap: ['C', 'center'], take_snap: ['QB', 'qbUnder', 'two'], catch_snap: ['QB', 'qbGun'],
  throw: ['QB', 'qbGun', 'R'], pump: ['QB', 'qbGun', 'R'], pitch: ['QB', 'stand', 'two'], lateral: ['RB', 'stand', 'R'],
  handoff_give: ['QB', 'stand', 'two'], handoff_take: ['RB', 'stand'], spike: ['QB', 'stand', 'two'], kneel_down: ['QB', 'stand', 'two'],
  juke: ['RB', 'stand', 'R'], spin: ['RB', 'stand', 'R'], stiff: ['RB', 'stand', 'L'], hurdle: ['RB', 'stand', 'R'], truck: ['RB', 'stand', 'R'],
  dive: ['RB', 'stand', 'R'], slide: ['QB', 'stand', 'R'], protect: ['RB', 'stand', 'R'], highstep: ['WR', 'stand', 'R'], wrapped: ['RB', 'stand', 'R'],
  catch_chest: ['WR', 'ready'], catch_high: ['WR', 'ready'], catch_low: ['WR', 'ready'], catch_dive: ['WR', 'ready'],
  catch_shoulder: ['WR', 'ready'], catch_side: ['TE', 'ready'], catch_onehand: ['WR', 'ready'], bobble: ['WR', 'ready'], drop: ['WR', 'ready'],
  tackle: ['LB', 'ready'], dive_tackle: ['S', 'ready'], hit: ['S', 'ready'], cut: ['CB', 'ready'], wrap_hold: ['LB', 'ready'],
  swat: ['CB', 'ready'], jump_swat: ['CB', 'ready'], strip: ['LB', 'ready'], jam: ['CB', 'ready'], shed: ['DL', 'rush'], bull: ['DL', 'rush'],
  fall_fwd: ['RB', 'stand'], fall_back: ['WR', 'stand'], fall_side: ['TE', 'stand'], stumble: ['WR', 'stand'], pancaked: ['DL', 'rush'],
  getup_front: ['RB', 'lie_front'], getup_back: ['WR', 'lie_back'], scoop: ['LB', 'ready'], fumble_dive: ['S', 'ready'],
  kick: ['K', 'kick_ready'], punt: ['K', 'stand'], hold: ['QB', 'kneel'],
  celebrate_spike: ['WR', 'stand', 'R'], celebrate_point: ['WR', 'stand'], celebrate_flex: ['LB', 'stand'], celebrate_dance: ['RB', 'stand'],
  celebrate_jump: ['WR', 'stand'], celebrate_salute: ['CB', 'stand'], dejected: ['QB', 'stand'], clap: ['TE', 'stand'], huddle_clap: ['G', 'huddle'],
  raise_roof: ['RB', 'stand'],
};
// reach points (yards, model frame: x left, y up, z forward) for the clips that reach
const REACH = {
  catch_chest: [0, 1.5, 0.5], catch_high: [0, 2.65, 0.35], catch_low: [0, 0.22, 0.65], catch_dive: [0, 0.75, 1.25],
  catch_shoulder: [0.25, 1.95, -0.15], catch_side: [-0.75, 1.5, 0.35], catch_onehand: [-0.45, 2.4, 0.35], catch_snap: [0, 1.25, 0.5],
  swat: [-0.3, 2.25, 0.45], jump_swat: [-0.25, 2.95, 0.35], strip: [-0.1, 1.15, 0.55], jam: [0, 1.4, 0.6], tackle: [0, 1.05, 0.6],
};

function rosterPick(team, pos, i = 0) {
  const r = buildRoster(team);
  const list = r.depth[pos] || r.players;
  return list[i % list.length];
}

function blankA(over = {}) {
  return {
    x: 0, z: 0, heading: 0, speed: 0, moveAngle: 0, accel: 0, turnRate: 0, effort: 0.5,
    base: 'stand', action: null, carry: null, look: null, reach: null, engage: null, dirt: 0, ...over,
  };
}

function grassTexture() {
  const c = mkCanvas(512, 512);
  const x = c.getContext('2d');
  const rng = makeRng(7);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = i % 2 ? '#2d5a22' : '#356628';
    x.fillRect(0, i * 128, 512, 128);
  }
  for (let i = 0; i < 26000; i++) {
    const px = rng() * 512, py = rng() * 512;
    x.fillStyle = rng() < 0.5 ? 'rgba(10,30,5,0.35)' : 'rgba(120,170,80,0.18)';
    x.fillRect(px, py, 1, 2 + rng() * 3);
  }
  // a yard line every 5 yards (texture spans 10 yards)
  x.fillStyle = 'rgba(240,240,232,0.92)';
  x.fillRect(0, 0, 512, 6);
  x.fillRect(0, 256 - 3, 512, 6);
  const t = toTex(c);
  t.repeat.set(8, 8);
  return t;
}

registerScreen('gallery', () => {
  const q = game.query;
  const mode = q.get('mode') || 'lineup';
  const lod = q.get('lod') === 'low' ? 'low' : 'high';
  const timeScale = parseFloat(q.get('ts') || '1');
  const tParam = q.get('t');
  const keyName = tParam && Number.isNaN(parseFloat(tParam)) ? tParam : null;   // t=key | t=release | t=end …
  const freezeT = tParam !== null ? (keyName ? 0 : parseFloat(tParam)) : null;
  const dirt = q.has('dirt') ? parseFloat(q.get('dirt')) : 0;
  const night = q.get('light') !== 'day';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(parseFloat(q.get('fov') || '38'), 4 / 3, 0.05, 400);
  const items = [];            // { model, A, label, ball, tick(dt, t) }
  const extras = [];           // other disposables
  let focus = new THREE.Vector3(0, 1, 0);
  let orbit = { az: 0, el: 12, dist: 14 };
  let time = 0;
  let perf = { acc: 0, n: 0, ms: 0 };
  let styleEl = null;
  let savedCrt = null;
  let helper = null;
  let fixedCam = null;           // huddle: first-person camera

  function lights() {
    scene.environment = getEnvMap(game.renderer.gl, night ? 'stadium' : 'day');
    scene.background = new THREE.Color(night ? '#04060c' : '#7fa6d6');
    if (night) scene.fog = new THREE.Fog('#04060c', 40, 120);
    const key = new THREE.DirectionalLight(night ? '#e4ecff' : '#fff2dc', night ? 3.4 : 3.8);
    key.position.set(night ? 9 : 14, night ? 24 : 20, night ? 13 : 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    const sc = key.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
    scene.add(key, key.target);
    if (night) {
      const back = new THREE.DirectionalLight('#c8d8ff', 1.6);
      back.position.set(-12, 18, -14);
      scene.add(back);
      const side = new THREE.DirectionalLight('#ffe6c8', 0.5);
      side.position.set(-16, 6, 8);
      scene.add(side);
    }
    const hemi = new THREE.HemisphereLight(night ? '#33415e' : '#b8d4ff', night ? '#1a2a12' : '#4a6a34', night ? 0.75 : 1.0);
    scene.add(hemi);
    // the field
    const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    scene.add(g);
    extras.push(g);
  }

  function add(model, A, label, opts = {}) {
    scene.add(model.group);
    if (dirt) { model.setDirt(dirt); A.dirt = dirt; }
    if (q.get('helmet') === '0') model.setHelmet(false);
    const it = { model, A, label, ...opts };
    if (opts.ball || A.carry) {
      it.ballModel = createBallModel({ stripes: opts.stripes });
      scene.add(it.ballModel.group);
    }
    items.push(it);
    return it;
  }

  // --------------------------------------------------------------- modes

  function lineup() {
    const one = q.get('team');
    const back = q.get('side') === 'back';
    const heading = back ? Math.PI : 0;
    if (one) {
      const team = getTeam(one);
      const order = ['QB', 'RB', 'WR', 'TE', 'C', 'G', 'DL', 'LB', 'CB', 'S', 'K'];
      order.forEach((pos, i) => {
        const x = (i - (order.length - 1) / 2) * 1.15;
        add(createPlayerModel({ team, kit: 'home', player: rosterPick(team, pos), lod }), blankA({ x, z: 0, heading }), pos);
        add(createPlayerModel({ team, kit: 'away', player: rosterPick(team, pos, 1), lod }), blankA({ x: x + 0.3, z: -2.6, heading }), '');
      });
      focus.set(0, 1.0, -1);
      orbit = { az: back ? 180 : 0, el: 10, dist: 16 };
      return;
    }
    const front = [['QB', 0], ['WR', 0], ['CB', 0], ['RB', 0], ['S', 0], ['K', 0], ['WR', 1], ['CB', 1]];
    const rear = [['G', 0], ['DL', 0], ['TE', 0], ['LB', 0], ['C', 0], ['DL', 1], ['LB', 1], ['G', 1]];
    let col = 0;
    for (const team of TEAMS) {
      for (const kit of ['home', 'away']) {
        const x = (col - 3.5) * 1.25;
        const [fp, fi] = front[col], [rp, ri] = rear[col];
        add(createPlayerModel({ team, kit, player: rosterPick(team, fp, fi), lod }), blankA({ x, z: 0.6, heading }), `${team.abbr} ${kit[0].toUpperCase()} ${fp}`);
        add(createPlayerModel({ team, kit, player: rosterPick(team, rp, ri), lod }), blankA({ x: x + 0.25, z: -1.6, heading }), rp);
        col++;
      }
    }
    ['referee', 'umpire', 'judge'].forEach((role, i) => {
      add(createRefModel({ role, lod, seed: i }), blankA({ x: 6.2 + i * 0.9, z: -0.4 - i * 0.7, heading: heading - 0.5, base: 'ref' }), role.toUpperCase().slice(0, 3));
    });
    focus.set(0.6, 1.0, -0.5);
    orbit = { az: back ? 180 : 0, el: 9, dist: 15.5 };
  }

  function actionsMode() {
    let names = (q.get('actions') || 'throw,catch_high,juke').split(',').map((s) => s.trim()).filter(Boolean);
    if (names.includes('all')) names = Object.keys(ACTIONS);
    const teams = TEAMS;
    const cols = Math.ceil(Math.sqrt(names.length * 1.33));
    const gap = names.length > 20 ? 2.4 : 2.8;
    names.forEach((name, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = (c - (cols - 1) / 2) * gap, z = -r * gap * 1.05;
      const cast = name.startsWith('sig_') ? ['REF', 'ref'] : (ACTION_CAST[name] || ['WR', 'stand']);
      const team = teams[i % teams.length];
      const model = cast[0] === 'REF' ? createRefModel({ role: 'referee', lod, seed: i }) : createPlayerModel({ team, kit: i % 2 ? 'away' : 'home', player: rosterPick(team, cast[0]), lod });
      const A = blankA({ x, z, heading: 0, base: cast[1], carry: cast[2] || null });
      const it = add(model, A, name, { action: name, carryWas: A.carry });
      if (['highstep', 'wrapped'].includes(name)) { A.speed = 4; A.effort = 0.6; }
    });
    const rows = Math.ceil(names.length / cols);
    focus.set(0, 0.85, -(rows - 1) * gap * 0.52);
    orbit = { az: 20, el: names.length > 12 ? 24 : 16, dist: Math.max(6.5, cols * gap * 1.12 + rows * 0.8) };
  }

  function basesMode() {
    let names = (q.get('bases') || 'all').split(',');
    if (names.includes('all')) names = BASES.slice();
    const cols = Math.ceil(Math.sqrt(names.length * 1.3));
    names.forEach((b, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const team = TEAMS[i % TEAMS.length];
      const pos = { stance3: 'G', center: 'C', qbUnder: 'QB', qbGun: 'QB', block: 'G', rush: 'DL', kick_ready: 'K', stance2: 'WR', ready: 'CB', huddle: 'TE' }[b] || 'RB';
      const model = b === 'ref' ? createRefModel({ lod }) : createPlayerModel({ team, kit: 'home', player: rosterPick(team, pos), lod });
      add(model, blankA({ x: (c - (cols - 1) / 2) * 2.4, z: -r * 2.6, base: b }), b);
    });
    const rows = Math.ceil(names.length / cols);
    focus.set(0, 0.8, -(rows - 1) * 1.3);
    orbit = { az: 25, el: 20, dist: cols * 3.6 };
  }

  function runMode() {
    const team = getTeam(q.get('team') || 'pht');
    const lanes = [
      { label: 'WALK 2 yd/s', speed: 2, pos: 'QB', effort: 0.1 },
      { label: 'JOG 5', speed: 5, pos: 'WR', effort: 0.3 },
      { label: 'RUN 8', speed: 8, pos: 'CB', effort: 0.7 },
      { label: 'SPRINT 10.5', speed: 10.5, pos: 'WR', effort: 1 },
      { label: 'CARRY 8', speed: 8, pos: 'RB', effort: 0.8, carry: 'R' },
      { label: 'BACKPEDAL 4', speed: 4, pos: 'CB', ma: Math.PI, base: 'ready' },
      { label: 'SHUFFLE 3', speed: 3, pos: 'LB', ma: Math.PI / 2, base: 'ready' },
      { label: 'KICK-SLIDE 2', speed: 2, pos: 'G', ma: Math.PI * 0.72, base: 'block' },
      { label: 'LINEMAN 6', speed: 6, pos: 'DL', effort: 0.8 },
      { label: 'CURVE 7', speed: 7, pos: 'S', effort: 0.7, curve: true },
    ];
    lanes.forEach((L, i) => {
      const model = createPlayerModel({ team: i % 2 ? TEAMS[1] : team, kit: i % 3 ? 'home' : 'away', player: rosterPick(i % 2 ? TEAMS[1] : team, L.pos), lod });
      const z = -i * 2.2;
      const ma = L.ma || 0;
      // travel +x: heading = π/2 − moveAngle so that heading + moveAngle points along +x
      const heading = L.curve ? 0 : Math.PI / 2 - ma;
      const A = blankA({ x: -10 + (i * 3.7) % 18, z, heading, speed: L.speed, moveAngle: ma, effort: L.effort ?? 0.5, base: L.base || 'stand', carry: L.carry || null });
      add(model, A, L.label, { lane: L, z0: z });
    });
    focus.set(0, 0.9, -9.5);
    orbit = { az: 0, el: 28, dist: 30 };
  }

  function closeupMode() {
    const teams = TEAMS;
    const masks = ['qb', 'skill', 'lineman', 'robot', 'cage', 'kicker'];
    const visors = [null, 'smoke', null, 'gold', null, 'mirror'];
    const hairs = ['afro', 'dreads', 'mohawk', 'flat', 'long', 'curly'];
    const beards = ['none', 'full', 'goatee', 'stubble', 'chinstrap', 'none'];
    const which = q.get('which') || 'both';
    for (let i = 0; i < 6; i++) {
      const team = teams[i % 4];
      const base = rosterPick(team, ['QB', 'WR', 'G', 'LB', 'DL', 'K'][i]);
      if (which !== 'bare') {
        const p = { ...base, look: { ...base.look, facemask: masks[i], visor: visors[i], eyeBlack: i % 2 ? 'stripe' : 'sticker' } };
        add(createPlayerModel({ team, kit: 'home', player: p, lod }), blankA({ x: (i - 2.5) * 0.62, z: 0, base: 'stand' }), masks[i] + (visors[i] ? ' ' + visors[i] : ''), { turn: true, i });
      }
      if (which !== 'helmet') {
        const p = { ...base, look: { ...base.look, hair: hairs[i], beard: beards[i], skinHex: ['#f1d3bd', '#73452b', '#c08a63', '#4a2a1a', '#e5b896', '#8d5a3a'][i] } };
        const m = createPlayerModel({ team, kit: 'away', player: p, lod });
        m.setHelmet(false);
        // the helmet-off row stands on a riser behind, so both rows of heads show
        add(m, blankA({ x: (i - 2.5) * 0.62, z: which === 'bare' ? 0 : -1.1, y: which === 'bare' ? 0 : 0.62, base: 'stand' }), hairs[i], { turn: true, i: i + 6 });
      }
    }
    if (which === 'both') {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.62, 0.9), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.8 }));
      riser.position.set(0, 0.31, -1.1);
      riser.receiveShadow = true;
      scene.add(riser);
      extras.push(riser);
    }
    focus.set(0, which === 'both' ? 2.2 : 1.95, which === 'both' ? -0.5 : 0);
    orbit = { az: 0, el: 6, dist: which === 'both' ? 4.6 : 3.4 };
    camera.fov = parseFloat(q.get('fov') || '32');
  }

  function huddleMode() {
    const team = getTeam(q.get('team') || 'pht');
    const kit = q.get('kit') || 'home';
    const cast = [['G', 0], ['C', 0], ['G', 1], ['WR', 0], ['RB', 0], ['TE', 0]];
    const eye = parseFloat(q.get('eye') || '1.92');
    const n = cast.length;
    cast.forEach(([pos, k], i) => {
      const a = (-62 + (124 * i) / (n - 1)) * D2R;
      const r = 1.45 + (Math.abs(i - (n - 1) / 2) < 1 ? 0.12 : 0);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const heading = Math.atan2(-x, -z);
      add(createPlayerModel({ team, kit, player: rosterPick(team, pos, k), lod }), blankA({ x, z, heading, base: 'huddle', look: { x: 0, y: eye, z: 0 } }), '', { huddle: true, i });
    });
    fixedCam = { pos: new THREE.Vector3(0, eye, 0), target: new THREE.Vector3(0, 1.05, 2.2) };
    camera.fov = parseFloat(q.get('fov') || '62');
  }

  function ballMode() {
    for (let i = 0; i < 3; i++) {
      const b = createBallModel({ stripes: i === 1 });
      b.group.position.set((i - 1) * 0.45, 1.2, 0);
      b.group.rotation.set(0.25, 0.6 + i, 0, 'YXZ');
      scene.add(b.group);
      items.push({ ballOnly: b, i });
    }
    focus.set(0, 1.2, 0);
    orbit = { az: 20, el: 15, dist: 1.6 };
    camera.fov = 30;
  }

  // Muybridge strip: one runner, simulated with fixed steps to successive moments of the stride
  function strideMode() {
    const team = getTeam(q.get('team') || 'det');
    const n = parseInt(q.get('n') || '7', 10);
    const speed = parseFloat(q.get('speed') || '8');
    const ma = parseFloat(q.get('ma') || '0') * D2R;
    const pos = q.get('pos') || 'RB';
    const span = parseFloat(q.get('span') || '0.7');      // seconds covered by the strip
    for (let k = 0; k < n; k++) {
      const model = createPlayerModel({ team, kit: q.get('kit') || 'home', player: rosterPick(team, pos), lod });
      const A = blankA({ x: (k - (n - 1) / 2) * 1.25, z: 0, heading: Math.PI / 2 - ma, speed, moveAngle: ma, effort: parseFloat(q.get('effort') || String(Math.min(1, speed / 10))), base: q.get('base') || 'stand', carry: q.get('carry') || null });
      const it = add(model, A, `${(k * span / Math.max(1, n - 1)).toFixed(2)}s`, { strip: true });
      // pre-roll: 2 s to settle into the gait, then up to this copy's moment
      const T = 2 + (k * span) / Math.max(1, n - 1);
      for (let t = 0; t < T; t += 1 / 60) model.update(1 / 60, A);
      if (it.ballModel) model.ballTransform(A.carry, it.ballModel.group.position, it.ballModel.group.quaternion);
      if (it.ballModel && q.get('debug') === '1') {
        const hw = model.handWorld('R', new THREE.Vector3());
        console.log('[ball]', k, 'ball', it.ballModel.group.position.toArray().map((v) => v.toFixed(3)).join(','), 'hand', hw.toArray().map((v) => v.toFixed(3)).join(','), 'A', A.x.toFixed(2), A.z.toFixed(2), 'vis', it.ballModel.group.visible, 'parent', !!it.ballModel.group.parent);
      }
    }
    focus.set(0, 0.95, 0);
    orbit = { az: 0, el: 4, dist: n * 1.25 * 1.05 };
  }

  // filmstrip of one action: copies frozen at evenly spaced moments (plus its key moments)
  function clipMode() {
    const name = q.get('action') || 'throw';
    const info = ACTIONS[name] || { dur: 0.5 };
    const n = parseInt(q.get('n') || '6', 10);
    const cast = name.startsWith('sig_') ? ['REF', 'ref'] : (ACTION_CAST[name] || ['WR', 'stand']);
    const team = getTeam(q.get('team') || 'det');
    const times = [];
    for (let k = 0; k < n; k++) times.push((info.dur * k) / (n - 1));
    for (const v of Object.values(info.key || {})) if (!times.some((t) => Math.abs(t - v) < 0.02)) times.push(v);
    times.sort((a, b) => a - b);
    const gap = parseFloat(q.get('gap') || '1.6');
    const speed = parseFloat(q.get('speed') || '0');
    const side = q.get('side') || null;
    times.forEach((tk, k) => {
      const model = cast[0] === 'REF' ? createRefModel({ role: 'referee', lod }) : createPlayerModel({ team, kit: q.get('kit') || 'away', player: rosterPick(team, cast[0]), lod });
      const A = blankA({ x: (k - (times.length - 1) / 2) * gap, z: 0, heading: parseFloat(q.get('face') || '0') * D2R, base: q.get('base') || cast[1], carry: cast[2] || null, speed, effort: 0.7 });
      const it = add(model, A, `${name} ${tk.toFixed(2)}`, { strip: true, action: name, carryWas: A.carry });
      // settle in the base, then run the clip with fixed steps up to tk
      for (let i = 0; i < 40; i++) model.update(1 / 60, A);
      const key = info.key || {};
      const R = REACH[name];
      for (let t = 0; t <= tk + 1e-6; t += 1 / 60) {
        A.action = { name, t: Math.min(t, tk), side, power: parseFloat(q.get('power') || '1') };
        if (it.carryWas) A.carry = key.release !== undefined && t > key.release ? null : it.carryWas;
        if (key.ball !== undefined && !it.carryWas) A.carry = t > key.ball + 0.05 ? 'two' : null;
        A.reach = R ? { x: A.x + R[0], y: R[1], z: A.z + R[2] } : null;
        if (['throw', 'pump'].includes(name)) A.look = { x: A.x, y: 1.8, z: A.z + 20 };
        model.update(1 / 60, A);
      }
      if (it.ballModel) {
        it.ballModel.group.visible = !!A.carry;
        if (A.carry) model.ballTransform(A.carry, it.ballModel.group.position, it.ballModel.group.quaternion);
      }
    });
    focus.set(0, 0.95, 0);
    orbit = { az: parseFloat(q.get('az') || '25'), el: 8, dist: times.length * gap * 0.95 + 2 };
  }

  // linemen locked up: pushes +1 / 0 / −1 (the OL drives, stalemate, the DL drives)
  function engageMode() {
    const ol = getTeam('det'), dl = getTeam('hou');
    const pushes = [1, 0, -1];
    pushes.forEach((push, i) => {
      const x = (i - 1) * 2.6;
      const off = add(createPlayerModel({ team: ol, kit: 'home', player: rosterPick(ol, 'G', i), lod }), blankA({ x, z: -0.45, heading: 0, base: 'block', engage: { dx: 0, dz: 1, push } }), `OL push ${push > 0 ? '+' : ''}${push}`);
      const def = add(createPlayerModel({ team: dl, kit: 'away', player: rosterPick(dl, 'DL', i), lod }), blankA({ x, z: 0.45, heading: Math.PI, base: 'rush', engage: { dx: 0, dz: -1, push: -push } }), `DL ${-push > 0 ? '+' : ''}${-push}`);
      // the side that is driven back slides at a walk, the winner chops forward
      off.A.speed = push < 0 ? 0.9 : push > 0 ? 0.9 : 0;
      off.A.moveAngle = push < 0 ? Math.PI : 0;
      def.A.speed = push > 0 ? 0.9 : push < 0 ? 0.9 : 0;
      def.A.moveAngle = push > 0 ? Math.PI : 0;
    });
    focus.set(0, 0.9, 0);
    orbit = { az: 70, el: 12, dist: 9 };
  }

  // a ball looping overhead: everyone tracks it with their eyes, two receivers reach for it
  function lookMode() {
    const team = getTeam('slc');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.sin(a) * 2.6, z = Math.cos(a) * 2.6;
      const it = add(createPlayerModel({ team, kit: i % 2 ? 'home' : 'away', player: rosterPick(team, ['WR', 'CB', 'S', 'LB', 'RB', 'TE'][i]), lod }), blankA({ x, z, heading: Math.atan2(-x, -z) + (i % 3 - 1) * 0.6, base: i < 2 ? 'ready' : 'stand' }), i < 2 ? 'look + reach' : 'look', { looker: true, reacher: i < 2 });
    }
    const ball = createBallModel({});
    scene.add(ball.group);
    items.push({ ballOnly: ball, flying: true });
    focus.set(0, 1.2, 0);
    orbit = { az: 30, el: 18, dist: 9.5 };
  }

  function perfMode() {
    const rng = makeRng(3);
    for (let i = 0; i < 22; i++) {
      const team = TEAMS[i % 4];
      const pos = ['QB', 'RB', 'WR', 'TE', 'C', 'G', 'DL', 'LB', 'CB', 'S'][i % 10];
      const A = blankA({ x: (rng() - 0.5) * 20, z: (rng() - 0.5) * 30, heading: rng() * 6.28, speed: 3 + rng() * 7, effort: rng(), carry: i === 1 ? 'R' : null });
      add(createPlayerModel({ team, kit: i < 11 ? 'home' : 'away', player: rosterPick(team, pos, i), lod }), A, '', { wander: rng() * 10 });
    }
    for (let i = 0; i < 3; i++) add(createRefModel({ role: ['referee', 'umpire', 'judge'][i], lod, seed: i }), blankA({ x: -8 + i * 8, z: 12, base: 'ref', speed: 2, heading: 1 }), '', { wander: i * 3 });
    // CPU benchmark: animation updates only (no rendering), fixed 60 Hz steps
    const models = items.filter((it) => it.model);
    for (let f = 0; f < 60; f++) for (const it of models) { tickItem(it, 1 / 60, f / 60); it.model.update(1 / 60, it.A); }
    const frames = 300;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      for (const it of models) { tickItem(it, 1 / 60, 1 + f / 60); it.model.update(1 / 60, it.A); }
    }
    const ms = (performance.now() - t0) / frames;
    perf.bench = ms;
    console.log(`[perf] ${models.length} models: ${ms.toFixed(3)} ms per frame for all animation updates (${(ms / models.length * 1000).toFixed(1)} µs per model)`);
    focus.set(0, 0, 0);
    orbit = { az: 30, el: 35, dist: 42 };
  }

  // --------------------------------------------------------------- per-frame driving

  const _p = new THREE.Vector3(), _q = new THREE.Quaternion();

  function tickItem(it, dt, t) {
    const A = it.A;
    if (it.action) {
      const dur = ACTIONS[it.action]?.dur ?? 0.5;
      const held = ACTIONS[it.action]?.held;
      const cyc = dur + (held ? 1.2 : 0.7);
      let at = freezeT !== null ? freezeT : (t + (it.i || 0) * 0.13) % cyc;
      if (keyName) {
        const keys = ACTIONS[it.action]?.key || {};
        at = keyName === 'end' ? dur : keyName === 'key' ? (Object.values(keys).sort((a, b) => a - b)[0] ?? dur * 0.5) : (keys[keyName] ?? dur * 0.5);
        it.labelT = at;
      }
      if (held || at <= dur) {
        A.action = { name: it.action, t: at, side: null, power: 1 };
      } else {
        A.action = null;
        const end = ACTIONS[it.action]?.end;
        if (end) A.base = end;
      }
      if (!A.action && !ACTIONS[it.action]?.end) A.base = (ACTION_CAST[it.action] || [])[1] || (it.action.startsWith('sig_') ? 'ref' : 'stand');
      if (A.action) A.base = it.action.startsWith('sig_') ? 'ref' : ((ACTION_CAST[it.action] || [])[1] || 'stand');
      // the ball leaves the hand at release / is caught at the ball key
      const key = ACTIONS[it.action]?.key || {};
      if (it.carryWas) A.carry = A.action && key.release !== undefined && at > key.release ? null : it.carryWas;
      if (key.ball !== undefined && !it.carryWas) A.carry = A.action && at > key.ball + 0.05 ? (it.action === 'catch_onehand' ? 'R' : 'two') : null;
      const R = REACH[it.action];
      A.reach = R ? { x: A.x + R[0], y: R[1], z: A.z + R[2] } : null;
      if (['throw', 'pump', 'catch_chest', 'catch_high', 'catch_low', 'catch_dive', 'catch_side', 'catch_onehand', 'catch_shoulder'].includes(it.action)) {
        A.look = R ? { x: A.x + R[0], y: R[1], z: A.z + R[2] } : { x: A.x, y: 1.8, z: A.z + 20 };
      }
    }
    if (it.lane) {
      const L = it.lane;
      if (L.curve) {
        it.ang = (it.ang ?? 0) + dt * L.speed / 4.5;
        A.x = Math.sin(it.ang) * 4.5;
        A.z = it.z0 - 2 + Math.cos(it.ang) * 4.5 - 4.5;
        A.heading = it.ang + Math.PI / 2;
        A.turnRate = L.speed / 4.5;
      } else {
        const dir = A.heading + (A.moveAngle || 0);
        A.x += Math.sin(dir) * A.speed * dt;
        A.z += Math.cos(dir) * A.speed * dt;
        if (A.x > 13) A.x -= 26;
      }
    }
    if (it.wander !== undefined) {
      it.wander += dt;
      A.turnRate = Math.sin(it.wander * 0.7) * 1.1;
      A.heading += A.turnRate * dt;
      const dir = A.heading + (A.moveAngle || 0);
      A.x += Math.sin(dir) * A.speed * dt;
      A.z += Math.cos(dir) * A.speed * dt;
      if (Math.abs(A.x) > 18 || Math.abs(A.z) > 24) { A.heading += Math.PI; A.x = Math.max(-18, Math.min(18, A.x)); A.z = Math.max(-24, Math.min(24, A.z)); }
    }
    if (it.turn) {
      const rot = q.has('rot') ? parseFloat(q.get('rot')) * D2R : t * 0.45;
      A.heading = rot + (q.has('rot') ? 0 : it.i * 0.35);
    }
    if (it.looker) {
      const bt = t * 0.9;
      const bp = { x: Math.sin(bt) * 2.2, y: 1.6 + Math.sin(bt * 2.3) * 0.9 + 0.6, z: Math.cos(bt * 0.7) * 1.6 };
      A.look = bp;
      if (it.reacher) {
        const d = Math.hypot(bp.x - A.x, bp.z - A.z);
        A.reach = d < 2.2 ? bp : null;
      }
    }
    if (it.huddle && q.get('clap') === '1') {
      const ct = (t % 4) - 2.5;
      A.action = ct > 0 && ct < 0.6 ? { name: 'huddle_clap', t: ct, side: null, power: 1 } : null;
    }
  }

  function placeCamera() {
    if (fixedCam) {
      camera.position.copy(fixedCam.pos);
      camera.lookAt(fixedCam.target);
      camera.updateProjectionMatrix();
      return;
    }
    const el = orbit.el * D2R, az = orbit.az * D2R;
    camera.position.set(
      focus.x + Math.sin(az) * Math.cos(el) * orbit.dist,
      focus.y + Math.sin(el) * orbit.dist,
      focus.z + Math.cos(az) * Math.cos(el) * orbit.dist,
    );
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
  }

  function applyCamParam() {
    const c = q.get('cam');
    if (!c) return;
    const presets = { front: [0, 8], back: [180, 8], side: [90, 6], top: [0, 70], low: [15, -2] };
    if (presets[c]) { orbit.az = presets[c][0]; orbit.el = presets[c][1]; return; }
    const [az, el, dist] = c.split(',').map(parseFloat);
    if (!Number.isNaN(az)) orbit.az = az;
    if (!Number.isNaN(el)) orbit.el = el;
    if (!Number.isNaN(dist)) orbit.dist = dist;
  }

  return {
    enter() {
      if (q.get('full') === '1') {
        styleEl = document.createElement('style');
        styleEl.textContent = '#tv-screen{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0!important;z-index:50}#tv-glass{display:none}';
        document.head.appendChild(styleEl);
        game.renderer.resize();
      }
      if (q.get('crt') === '0') { savedCrt = game.renderer.crt; game.renderer.crt = 0; }
      game.renderer.setPost({ bloomStrength: 0.7, vignette: 0.4, exposure: night ? 1.05 : 1.0 }, true);
      lights();
      ({ lineup, actions: actionsMode, bases: basesMode, run: runMode, stride: strideMode, clip: clipMode, engage: engageMode, look: lookMode, closeup: closeupMode, huddle: huddleMode, ball: ballMode, perf: perfMode }[mode] || lineup)();
      applyCamParam();
      if (q.get('bones') === '1' && items[0]?.model) {
        helper = new THREE.SkeletonHelper(items[0].model.group);
        scene.add(helper);
      }
      // settle everyone into their first pose (fixed steps; frozen clips get a full second)
      const pre = freezeT !== null ? 60 : 3;
      for (let i = 0; i < pre; i++) for (const it of items) if (it.model && !it.strip) { tickItem(it, 1 / 60, 0); it.model.update(1 / 60, it.A); }
      window.__gallery = { items, scene, camera, stats: () => items.filter((it) => it.model).map((it) => it.model.stats()) };
      if (q.get('debug') === '1') {
        for (const it of items.slice(0, 4)) {
          if (!it.model) continue;
          console.log('[gallery]', it.label || it.model.group.name, JSON.stringify(it.model.stats()), JSON.stringify(it.model.bodyEntry.parts), 'helmet', it.model.helmet ? it.model.helmet.geometry.index.count / 3 : 0);
        }
      }
    },
    exit() {
      for (const it of items) { it.model?.dispose(); it.ballModel?.dispose(); it.ballOnly?.dispose(); }
      if (styleEl) { styleEl.remove(); game.renderer.resize(); }
      if (savedCrt !== null) game.renderer.crt = savedCrt;
      for (const e of extras) { e.geometry?.dispose(); e.material?.map?.dispose(); e.material?.dispose(); }
    },
    update(dt) {
      // orbit with the mouse / arrows
      if (input.mouse?.down) { orbit.az -= input.mouse.dx * 0.25; orbit.el = Math.max(-10, Math.min(85, orbit.el + input.mouse.dy * 0.2)); }
      if (input.mouse?.wheel) { orbit.dist *= Math.pow(1.1, input.mouse.wheel); input.mouse.wheel = 0; }
      if (input.pressed('left')) orbit.az -= 15;
      if (input.pressed('right')) orbit.az += 15;
      if (input.pressed('up')) orbit.el = Math.min(85, orbit.el + 8);
      if (input.pressed('down')) orbit.el = Math.max(-10, orbit.el - 8);
      const sdt = dt * timeScale;
      time += sdt;
      const t0 = performance.now();
      for (const it of items) {
        if (it.strip) continue;
        if (it.ballOnly) {
          if (it.flying) {
            const bt = time * 0.9;
            it.ballOnly.group.position.set(Math.sin(bt) * 2.2, 1.6 + Math.sin(bt * 2.3) * 0.9 + 0.6, Math.cos(bt * 0.7) * 1.6);
          }
          it.ballOnly.group.rotateZ(sdt * 9);
          continue;
        }
        tickItem(it, sdt, time);
        it.model.update(sdt, it.A);
        if (it.ballModel) {
          if (it.A.carry) {
            it.ballModel.group.visible = true;
            it.model.ballTransform(it.A.carry, it.ballModel.group.position, it.ballModel.group.quaternion);
          } else it.ballModel.group.visible = false;
        }
      }
      perf.acc += performance.now() - t0;
      perf.n++;
      if (perf.n >= 30) { perf.ms = perf.acc / perf.n; perf.acc = 0; perf.n = 0; }
      placeCamera();
    },
    draw(ctx) {
      // labels under each model
      const v = new THREE.Vector3();
      for (const it of items) {
        if (!it.label || !it.model) continue;
        v.set(it.A.x, (it.A.y || 0) + (mode === 'closeup' ? 1.55 : -0.05), it.A.z).project(camera);
        if (v.z > 1) continue;
        const x = (v.x + 1) * 512, y = (1 - v.y) * 384;
        text(ctx, it.label.toUpperCase(), x, y + 14, { size: 11, align: 'center', color: '#e8eefc', weight: 700 });
        if ((freezeT === null || keyName) && it.action && it.A.action) text(ctx, it.A.action.t.toFixed(2), x, y + 27, { size: 10, align: 'center', color: '#ffb21e' });
      }
      const st = items.find((it) => it.model)?.model.stats();
      const head = `GALLERY · ${mode.toUpperCase()} · ${items.length} MODELS` + (st ? ` · ${st.tris} TRIS / ${st.calls} CALLS / ${st.bones} BONES (FIRST)` : '') + ` · ANIM ${perf.ms.toFixed(2)} MS`;
      text(ctx, head, 24, 30, { size: 13, color: '#9fb4d8', weight: 700 });
      if (perf.bench) text(ctx, `BENCH ${perf.bench.toFixed(2)} MS / FRAME FOR ${items.filter((it) => it.model).length} MODELS (ANIMATION ONLY)`, 24, 66, { size: 13, color: '#46e8ff', weight: 700 });
      if (freezeT !== null) text(ctx, keyName ? `t = ${keyName}` : `t = ${freezeT.toFixed(2)} s`, 24, 48, { size: 13, color: '#ffb21e', weight: 700 });
    },
    view() { return { scene, camera }; },
  };
});
