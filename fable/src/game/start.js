// Title screen, new-game flow, and the glue ("hooks") between the overworld
// and everything it can launch (battles, minigames, menus, cutscenes).
import * as THREE from 'three';
import { G, Mode } from '../core/game.js';
import { newSave, loadSave, hasSave, clearSave, writeSave } from '../core/save.js';
import { Fx } from '../core/fx.js';
import { Character, SPECIES } from '../art/characters.js';
import { lightRig, toon, M, plane } from '../art/kit.js';
import { PROPS } from '../art/props.js';
import { portrait, clearPortraits } from '../art/portraits.js';
import { CAST, teamSpec, displayName, normalizeSquads, charState, maxStamina } from '../data/cast.js';
import { NPCS } from '../data/npcs.js';
import { el, rand, TAU } from '../core/util.js';
import { World } from '../world/world.js';
import { AREAS } from '../areas/index.js';
import { setFlag, recruit, startQuest } from './state.js';

export const CAPTAIN_SPECIES = ['fox', 'cat', 'dog', 'raccoon', 'badger', 'deer', 'squirrel', 'skunk'];

function installSpeakers() {
  G.ui.speakers = (id) => {
    if (CAST[id]) {
      const t = G.S.team;
      const sig = `${t.jersey}${t.helmet}${t.stripe}${id === 'captain' ? G.S.captain.species : ''}`;
      return { name: displayName(id), color: CAST[id].color, pitch: CAST[id].pitch, portrait: () => portrait(`cast:${id}:${sig}`, teamSpec(id)) };
    }
    const n = NPCS[id];
    if (n) return { name: n.name, color: n.color, pitch: n.pitch, voice: n.voice, portrait: () => portrait(`npc:${id}`, n.spec) };
    return null;
  };
}

// ------------------------------------------------------------------ title
class Title extends Mode {
  constructor() { super(); this.name = 'title'; }
  enter() {
    this.fx = new Fx(this.scene);
    this.rig = lightRig(this.scene, 'dusk', { fog: [30, 90] });
    const ground = M(plane(120, 120), toon(0x7fae58), 0, 0, 0, { rx: -Math.PI / 2, shadow: false });
    this.scene.add(ground);
    const house = PROPS.clubhouse({ night: true, fixed: 1 });
    house.position.set(-1.5, 0, -4);
    this.scene.add(house);
    const sb = PROPS.scoreboard({ w: 9, h: 3.6, lines: ['WELCOME BACK,', 'CAPTAIN.'] });
    sb.position.set(7.4, 0, -10.5); sb.rotation.y = -0.42;
    this.scene.add(sb);
    for (const [x, z, s] of [[-9, -5, 1.2], [-12, 1, 1], [8, -3, 1.1], [14, 2, 1.3], [-6, -10, 1.3], [4, -11, 1.1]]) { const t = PROPS.tree({ s }); t.position.set(x, 0, z); this.scene.add(t); }
    const lamp = PROPS.lamp({ night: true }); lamp.position.set(4.6, 0, 0.5); this.scene.add(lamp);
    this.cast = [];
    const S = G.S;
    const prev = G.S;
    const lineup = [['waffle', -3.6, 2.2], ['pip', -1.9, 2.9], ['captain', 0, 3.3], ['zip', 1.8, 2.9], ['june', 3.3, 2.3], ['hollow', -5.4, 1.4]];
    for (const [id, x, z] of lineup) {
      const ch = new Character(teamSpec(id));
      ch.setPos(x, z);
      ch.face(Math.atan2(-x * 0.3, 6));
      this.scene.add(ch.root);
      this.cast.push({ ch, id, t: rand(3) });
    }
    void S; void prev;
    this.camera.fov = 30;
    this.t = 0;
    this._place();
    G.audio.music('town');
    this._menu();
  }
  _place() {
    const a = Math.sin(this.t * 0.12) * 0.22;
    const d = 19;
    // frame the lineup on the right so the logo and menu sit clear of it on the left
    const wide = this.camera.aspect > 1.25;
    this.camera.position.set(Math.sin(a) * d + (wide ? -4.5 : 0), 6.5, Math.cos(a) * d + 2);
    this.camera.lookAt(wide ? -5.2 : 0.6, wide ? 2.9 : 4.4, 0);
    this.rig.follow(0, 0);
  }
  _menu() {
    const can = hasSave();
    const wrap = el('div.title-wrap',
      el('div.logo',
        el('div.l1', { html: 'FOURTH <span class="amp">&amp;</span>' }),
        el('div.l2', 'FABLE'),
        el('div.tagline', 'A football RPG where your teammates are also your neighbors')),
      el('div.title-menu',
        can ? el('button.btn.focusable', { text: 'Continue', onclick: () => this._continue() }) : null,
        el('button.btn.focusable' + (can ? '.alt' : ''), { text: 'New Game', onclick: () => this._new() }),
        el('button.btn.alt.small.focusable', { text: 'How to play', onclick: () => this._help() })),
      el('div.title-foot', { html: `Keyboard or gamepad · ${G.ui.key('mute')} mutes · everything you see and hear is generated in code` }));
    this.layer = G.ui.pushLayer({ el: wrap, blocking: false });
  }
  async _help() {
    await G.ui.panel({ title: 'How to play', build: (body) => {
      body.append(el('div', { html: `
        <p><b>Explore.</b> ${G.ui.key('move')} to walk, hold ${G.ui.key('b')} to run, ${G.ui.key('a')} to talk and use things. ${G.ui.key('x')} throws your football at switches — and at opponents, to stun them.</p>
        <p><b>Opponents are visible.</b> Sneak up behind one (or bonk it first) for a <b>Blindside</b>: you get the ball with a head start. If one chases you down, you play <b>defense</b> first.</p>
        <p><b>Drives.</b> Pick a play, arm abilities, then: time the <b>snap</b> on the third beat · read the field and throw with ${G.ui.key('t1')}${G.ui.key('t2')}${G.ui.key('t3')} or scramble · time the <b>catch</b> · then run: ${G.ui.key('a')} jukes, ${G.ui.key('b')} spins, ${G.ui.key('y')} laterals.</p>
        <p><b>Stamina</b> is your health. Tackles and abilities spend it. Exhausted teammates lose their abilities until they rest on a bench, eat a snack, or you swap squads.</p>
        <p><b>Home.</b> Win coins and parts, rebuild Huddle Hollow at the notice board, and the town opens up new things to do.</p>` }));
    } });
  }
  async _continue() {
    const s = loadSave();
    if (!s) return;
    this.layer.close();
    G.S = s;
    normalizeSquads();
    await enterWorld();
  }
  async _new() {
    if (hasSave() && !(await G.ui.confirm('Start over? Your current save will be replaced.', 'Start over', 'Keep it'))) return;
    const made = await captainCreator();
    if (!made) return;
    this.layer.close();
    clearSave();
    G.S = newSave();
    G.S.captain = made;
    normalizeSquads();
    clearPortraits('cast:');
    await intro();
    await enterWorld();
  }
  update(dt) {
    this.t += dt;
    this._place();
    for (const c of this.cast) {
      c.t -= dt;
      if (c.t <= 0) { c.t = rand(3, 7); c.ch.play(['wave', 'hop', 'nod'][Math.floor(rand(3))]); }
      c.ch.update(dt, 0);
    }
    if (Math.random() < dt * 5) this.fx.emit('leaf', rand(-14, 14), 9, rand(-8, 6), { vx: rand(-1.4, -0.4), vy: -1.6, vz: rand(-0.3, 0.3), g: 0, life: 6, s0: 0.3, s1: 0.3, color: [0xe8842c, 0xd4502f, 0xf2b632][Math.floor(rand(3))], vrot: rand(-3, 3), flip: 3 });
    this.fx.update(dt, this.camera);
  }
  exit() { if (this.layer) this.layer.close(); this.fx.dispose(); }
}

function captainCreator() {
  if (G.debug.fastDialog) return Promise.resolve({ name: 'Captain', species: 'fox', number: 1 });
  return G.ui.panel({
    title: 'Who\'s the new Captain?', closable: true,
    build: (body, api) => {
      const st = { name: 'Captain', species: 'fox', number: 1 };
      const img = el('img.creator-face');
      const refresh = () => {
        const spec = { ...CAST.captain.spec, species: st.species, jersey: G.S.team.jersey, pants: G.S.team.pants, trim: G.S.team.trim, number: st.number, helmet: { color: G.S.team.helmet, stripe: G.S.team.stripe } };
        img.src = portrait(`creator:${st.species}`, spec);
        for (const b of body.querySelectorAll('.sp')) b.classList.toggle('sel', b.dataset.sp === st.species);
        num.textContent = `#${st.number}`;
      };
      const name = el('input.text-in', { type: 'text', maxlength: 12, value: st.name, spellcheck: 'false' });
      name.addEventListener('input', () => { st.name = name.value.trim() || 'Captain'; });
      const num = el('span.num', '#1');
      body.append(el('div.creator',
        el('div.col.center', img, el('div.row.center', el('button.btn.small.alt.focusable', { text: '−', onclick: () => { st.number = (st.number + 98) % 100; refresh(); } }), num, el('button.btn.small.alt.focusable', { text: '+', onclick: () => { st.number = (st.number + 1) % 100; refresh(); } }))),
        el('div.col.grow',
          el('label.lbl', 'Name'), name,
          el('label.lbl', 'Species'),
          el('div.sp-grid', CAPTAIN_SPECIES.map((s) => el('button.card.sp.focusable', { text: s, dataset: { sp: s }, onclick: () => { st.species = s; refresh(); } }))),
          el('div.row', { style: { marginTop: '0.8em' } }, el('button.btn.focusable.first', { text: 'Catch the bus →', onclick: () => api.close({ ...st }) })))));
      refresh();
    },
  });
}

async function intro() {
  await G.fadeOut();
  while (G.modes.length) G.pop();
  const m = new Mode();
  m.name = 'intro';
  m.scene.background = new THREE.Color(0x1b1024);
  G.push(m);
  await G.fadeIn(0.2);
  G.audio.music('night');
  const lines = [
    'The bus to Huddle Hollow only runs when somebody needs it to.',
    'Today, apparently, that\'s you.',
    'In your pocket: a letter, a brass key, and a whistle that doesn\'t whistle.',
    '"*Captain* — the clubhouse is yours now. So is the team, once you find it. Don\'t mind the Coach. He comes with the building.  — G."',
    'You have never been called Captain in your life.',
  ];
  for (const l of lines) await G.ui.say(null, l, { big: true });
}

export async function enterWorld(o = {}) {
  const S = G.S;
  const world = new World();
  G.world = world;
  const pos = S.pos || {};
  const area = o.area || (AREAS[S.area] ? S.area : 'hollow');
  await G.reset(world, { area, x: o.x ?? pos.x, z: o.z ?? pos.z });
  return world;
}

// ------------------------------------------------------------------ boot entry
export async function startGame(params) {
  G.session = { beaten: new Set() };
  G.hooks = G.hooks || {};
  installSpeakers();
  const mods = await Promise.all([
    import('../minigames/index.js'),
    import('../battle/index.js'),
    import('./cutscenes.js'),
    import('./menu.js'),
    import('./town.js'),
    import('./story2.js'),
    import('./hooks.js'),
  ]);
  for (const m of mods) if (m.install) m.install();

  if (params.has('mg')) {
    // QA shortcut: launch one minigame directly.  ?test&mg=snack&hard=1
    G.S = newSave();
    applyPreset(params.get('preset') || 'team');
    const { MINIGAMES } = mods[0];
    const mod = await MINIGAMES[params.get('mg')].load();
    if (params.has('auto')) G.debug.auto = true;
    const opts = { hard: params.has('hard'), noLeave: true };
    for (const [k, v] of params) if (!['mg', 'hard', 'test', 'preset', 'shadows', 'dialog'].includes(k)) opts[k] = isNaN(parseFloat(v)) ? v : parseFloat(v);
    G.push(new mod.default(), opts).then((r) => { G.debug.lastResult = r; });
    return;
  }

  if (params.has('battle')) {
    // QA shortcut: jump into a battle.  ?test&battle=gnomes&kind=match&side=off&auto=1
    G.S = newSave();
    applyPreset(params.get('preset') || 'team');
    if (params.has('auto')) G.debug.auto = true;
    const cfg = { team: params.get('battle'), kind: params.get('kind') || 'drive', side: params.get('side') || 'off', venue: params.get('venue') || 'backyard', drives: parseInt(params.get('drives') || '2', 10), start: params.has('start') ? parseFloat(params.get('start')) : undefined, tod: params.get('tod') || undefined, tutorial: params.get('tutorial') || undefined };
    G.hooks.battle(cfg).then((r) => { G.debug.lastResult = r; });
    return;
  }

  if (params.has('area') || params.has('preset')) {
    // QA shortcut:  ?test&area=borough&x=40&z=20&preset=team
    G.S = newSave();
    G.S.area = 'hollow';
    applyPreset(params.get('preset') || 'team');
    if (params.has('tod')) G.S.tod = params.get('tod');
    const world = new World();
    G.world = world;
    G.push(world, { area: params.get('area') || 'hollow', x: params.has('x') ? parseFloat(params.get('x')) : undefined, z: params.has('z') ? parseFloat(params.get('z')) : undefined });
    return;
  }
  G.push(new Title());
}

/** Debug: jump the save to a point in the story. */
export function applyPreset(name) {
  const S = G.S;
  const all = (ids) => { for (const id of ids) recruit(id, true); };
  S.flags.intro_done = true;
  if (name === 'fresh') { S.questLog = []; S.quests = {}; startQuest('five'); return; }
  S.flags.has_ball = true; S.flags.met_hollow = true; S.flags.clubhouse_intro = true;
  S.quests.five = { stage: 1, done: false }; S.questLog = ['five'];
  recruit('hollow', true);
  if (name === 'start') return;
  all(['pip', 'zip', 'waffle', 'june']);
  Object.assign(S.flags, { pip_ladder: true, quill_met: true, zip_met: true, waffle_met: true, waffle_drill: true, board_open: true, dusk_fell: true, dusk_told: true });
  S.quests.five.done = true;
  S.quests.first_match = { stage: 0, done: false }; S.questLog.push('first_match');
  S.chapter = 1; S.tod = 'dusk';
  S.plays.push('hollow_dive');
  S.coins = 80; S.parts = 3;
  S.items = { orange: 3, drink: 1 };
  if (name === 'team') return;
  // after the first match
  S.wins.gnomes = 1; S.chapter = 2; S.tod = 'night';
  Object.assign(S.flags, { gnomes_met: true, scoreboard_on: true, seen_scoreboard: true, seen_stadium_approach_gate: true, bus_open: true, bus_fair: true, marigold_board: true });
  S.quests.first_match.done = true;
  S.quests.welcome_back = { stage: 2, done: false }; S.questLog.push('welcome_back');
  S.quests.rebuild = { stage: 0, done: false }; S.questLog.push('rebuild');
  S.coins = 400; S.parts = 12;
  S.decor.owned.push('trophy_borough', 'gnome');
  if (name === 'ch2') return;
  if (name === 'rich') { S.coins = 5000; S.parts = 99; return; }
  if (name === 'all') {
    all(['cheese', 'slush', 'sal']);
    S.coins = 5000; S.parts = 99; S.chapter = 5;
    S.town = { diner: 1, arcade: 1, field: 1, stadium: 2 };
    S.wins = { gnomes: 1, haymakers: 1, flurries: 1, buzzers: 1 };
    Object.assign(S.flags, { bus_frost: true, bus_neon: true, has_rod: true });
    for (const id of S.roster) { charState(id).lv = 8; charState(id).st = maxStamina(id); }
  }
}

export { Title, writeSave, SPECIES, TAU };
