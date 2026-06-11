// App shell: title → build your program → training camp → the office, where
// every week begins. Quick Play stays a one-off Friday night exhibition.
import * as THREE from 'three';
import { genRoster, genRival } from './names.js';
import { SchoolBuilder, UniformBuilder, TeamBuilder } from './builders.js';
import { Game } from './game.js';
import { Office } from './office.js';
import { PlayEditor } from './playEditor.js';
import {
  newFranchise, rollNewSeason, recordResult, currentOpponent, weekLabel,
  weeklyDecision, adDecision, applyDecision, practiceBonusFor,
  wins, losses, DRILLS,
} from './franchise.js';
import { OFFENSE_PLAYS, sanitizePlay } from './plays.js';
import { makeKit, buildPlayer } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips } from './clips.js';
import { logoCanvas } from './logos.js';
import { sfx } from './audio.js';
import { PadUI } from './padui.js';

const SAVE_KEY = 'fng04_save_v2';
const OLD_SAVE_KEY = 'fng04_save_v1';

function defaultState() {
  return {
    school: {
      name: 'Westfield', mascot: 'Falcons', logoId: 'wing',
      colors: { primary: '#14306e', secondary: '#f2b705' },
      building: { style: 'brick', floors: 2, length: 2, wingL: true, wingR: false, gym: true, cupola: true, brick: '#9a4a32', buses: true },
    },
    uniform: {
      jersey: '#14306e', pants: '#f2f1ec', helmet: '#14306e', sleeve: '#f2b705',
      numberFill: '#f4f4f2', numberStroke: '#f2b705', pantsStripe: '#14306e',
      helmetStripe: '#f2b705', facemask: '#2d2f33', socks: '#14306e',
      style: 'classic', stripes2: false,
    },
    roster: genRoster(4),
    rival: null,
    customPlays: [],
    office: { wall: '#b8b2a4', carpet: '#5a2e28', wood: '#6a4a2c', poster: 'win', plant: true, radio: true, bobble: true },
    franchise: null,
    _uniformInit: false,
  };
}

function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      school: state.school, uniform: state.uniform, roster: state.roster,
      customPlays: state.customPlays, office: state.office, franchise: state.franchise,
    }));
  } catch { /* private mode */ }
}

function loadState() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      // migrate a v1 save: keep the school, start the career fresh
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (!old) return null;
      const data = JSON.parse(old);
      if (!data.school?.name) return null;
      return { ...defaultState(), school: data.school, uniform: data.uniform || defaultState().uniform, roster: data.roster || genRoster(4), _uniformInit: true };
    }
    const data = JSON.parse(raw);
    if (!data.school?.name || !data.roster?.length) return null;
    return { ...defaultState(), ...data, _uniformInit: true };
  } catch { return null; }
}

// ------------------------------------------------------------- shell
const screens = ['title', 'school', 'uniform', 'team', 'office', 'editor', 'game'];
function showScreen(id) {
  for (const s of screens) {
    document.getElementById(`scr-${s}`).classList.toggle('active', s === id);
  }
}

// generic office modal
function modal(html, buttons = [], { sticky = false } = {}) {
  const wrap = document.getElementById('office-modal');
  const card = wrap.querySelector('.om-card');
  card.innerHTML = html;
  const btnHolder = document.createElement('div');
  btnHolder.className = 'om-buttons';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.innerHTML = b.label + (b.fx ? `<span class="fx">${b.fx}</span>` : '');
    if (b.gold) el.classList.add('gold');
    el.onclick = () => { sfx.chime(); if (!b.keepOpen) wrap.classList.remove('show'); b.onPick?.(); };
    btnHolder.appendChild(el);
  }
  card.appendChild(btnHolder);
  wrap.classList.add('show');
  if (!sticky) {
    wrap.onclick = (e) => { if (e.target === wrap) wrap.classList.remove('show'); };
  } else {
    wrap.onclick = null;
  }
}
function closeModal() { document.getElementById('office-modal').classList.remove('show'); }

class App {
  constructor() {
    this.state = defaultState();
    this.current = null;
    this.bindTitle();
  }

  swap(thing) {
    if (this.current?.dispose) this.current.dispose();
    this.current = thing;
  }

  playbook() {
    const customs = (this.state.customPlays || []).map(sanitizePlay).filter(Boolean);
    return [...OFFENSE_PLAYS, ...customs];
  }

  bindTitle() {
    const saved = loadState();
    const cont = document.getElementById('title-continue');
    cont.style.display = saved ? '' : 'none';
    document.getElementById('title-new').onclick = () => { sfx.ensure(); sfx.chime(); this.toSchool(); };
    document.getElementById('title-quick').onclick = () => { sfx.ensure(); sfx.chime(); this.toExhibition(); };
    cont.onclick = () => {
      sfx.ensure(); sfx.chime();
      this.state = loadState() || this.state;
      if (!this.state.franchise) this.state.franchise = { ...newFranchise(), campDone: true };
      this.toOffice();
    };
    this.titleScene();
  }

  titleScene() {
    const holder = document.getElementById('title-3d');
    if (!holder || holder.dataset.built) return;
    holder.dataset.built = '1';
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(holder.clientWidth, holder.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a1024');
    scene.fog = new THREE.Fog('#0a1024', 14, 50);
    const cam = new THREE.PerspectiveCamera(40, holder.clientWidth / holder.clientHeight, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#8a9cd8', '#1c2415', 1.3));
    const key = new THREE.DirectionalLight('#ffe8c4', 3.2);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7a9aff', 1.8);
    rim.position.set(-8, 6, -6);
    scene.add(rim);
    const glow = new THREE.PointLight('#ffd890', 30, 18);
    glow.position.set(0, 4, 3);
    scene.add(glow);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshPhongMaterial({ color: '#1d3a1c' }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const s = this.state.school;
    const logo = logoCanvas(s.logoId, { fg: s.colors.secondary, bg: s.colors.primary, line: '#101014', letter: s.name[0] });
    const kit = makeKit(this.state.uniform, logo);
    const CLIPS = makeClips();
    const anims = [];
    const add = (build, num, clip, x, z, face, rate = 1) => {
      const rig = buildPlayer(kit, { num, build, skin: '#8d5a3b' });
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = face;
      scene.add(rig.group);
      const a = new Animator(rig, CLIPS);
      a.play(clip, { fade: 0, startAt: Math.random() * 0.5 });
      a.rate = rate;
      anims.push(a);
    };
    add('avg', 7, 'throwHold', 0.6, 0, -0.5, 0.7);
    add('slim', 81, 'sprint', -2.0, -1.4, -0.2);
    add('huge', 72, 'block', 2.4, -1.2, 0.4, 0.8);
    const clock = new THREE.Clock();
    let t = 0;
    const tick = () => {
      if (!document.getElementById('scr-title').classList.contains('active')) {
        requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      const cv = renderer.domElement;
      if (holder.clientWidth && cv.width !== Math.round(holder.clientWidth * renderer.getPixelRatio())) {
        cam.aspect = holder.clientWidth / holder.clientHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(holder.clientWidth, holder.clientHeight);
      }
      for (const a of anims) a.update(dt);
      cam.position.set(2.2 + Math.sin(t * 0.14) * 4.4, 1.9 + Math.sin(t * 0.4) * 0.15, Math.cos(t * 0.14) * 6.2);
      cam.lookAt(0.4, 1.25, 0);
      renderer.render(scene, cam);
      requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('resize', () => {
      if (!holder.clientWidth) return;
      cam.aspect = holder.clientWidth / holder.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(holder.clientWidth, holder.clientHeight);
    });
  }

  // ----------------------------------------------------------- builders
  toSchool() {
    showScreen('school');
    const b = new SchoolBuilder(document.querySelector('#scr-school .panel'), document.querySelector('#scr-school .preview3d'), this.state);
    b.onNext(() => this.toUniform());
    this.swap(b);
  }

  toUniform() {
    if (!this.state._uniformInit) {
      const c = this.state.school.colors;
      Object.assign(this.state.uniform, {
        jersey: c.primary, helmet: c.primary, sleeve: c.secondary,
        numberFill: '#f4f4f2', numberStroke: c.secondary,
        pantsStripe: c.primary, helmetStripe: c.secondary, socks: c.primary,
      });
      this.state._uniformInit = true;
    }
    showScreen('uniform');
    const b = new UniformBuilder(document.querySelector('#scr-uniform .panel'), document.querySelector('#scr-uniform .preview3d'), this.state);
    b.onNext(() => this.toTeam());
    this.swap(b);
  }

  toTeam() {
    showScreen('team');
    const b = new TeamBuilder(document.querySelector('#scr-team .panel'), document.querySelector('#scr-team .preview3d'), this.state);
    b.onNext(() => this.startCareer());
    this.swap(b);
  }

  // ----------------------------------------------------------- career flow
  startCareer() {
    this.state.franchise = newFranchise();
    saveState(this.state);
    showScreen('office'); // backdrop for the modal
    this.swap(null);
    modal(`
      <div class="om-title">TRAINING CAMP — TWO-A-DAYS</div>
      <div class="om-text">August. The grass is burnt and the water cooler is the most popular kid in school.
      Before the season opens, run your three camp drills — your grades set the team's sharpness for Week 1.</div>`,
      [
        { label: '🏈 START CAMP — Drill 1: Route Tree', gold: true, onPick: () => this.toDrill('routes', { camp: 0 }) },
        { label: 'Skip camp (the bus is late)', fx: 'No practice bonus for Week 1', onPick: () => { this.state.franchise.campDone = true; saveState(this.state); this.toOffice(); } },
      ], { sticky: true });
  }

  toDrill(drillId, { camp = null } = {}) {
    showScreen('game');
    const fr = this.state.franchise;
    const game = new Game(document.getElementById('game-holder'), { ...this.state, rival: genRival(this.state.school.name, this.state.school.mascot) }, {
      mode: 'drill',
      drill: drillId,
      onDrillEnd: (frac) => {
        this.swap(null);
        const bonus = practiceBonusFor(drillId, frac);
        if (camp !== null) {
          fr.campScores = fr.campScores || [];
          fr.campScores[camp] = frac;
          const next = camp + 1;
          if (next < DRILLS.length) {
            showScreen('office');
            modal(`
              <div class="om-title">${DRILLS[camp].name}: ${Math.round(frac * 100)}%</div>
              <div class="om-text">Coach's whistle. Next up: <b>${DRILLS[next].name}</b> — ${DRILLS[next].desc}</div>`,
              [{ label: `▸ RUN ${DRILLS[next].name}`, gold: true, onPick: () => this.toDrill(DRILLS[next].id, { camp: next }) }], { sticky: true });
          } else {
            fr.campDone = true;
            const avg = (fr.campScores || []).reduce((a, b) => a + (b || 0), 0) / DRILLS.length;
            fr.practice = practiceBonusFor(avg >= 0.6 ? 'routes' : 'hits', avg);
            fr.practice.label = `CAMP GRADE ${Math.round(avg * 100)}%`;
            saveState(this.state);
            showScreen('office');
            modal(`
              <div class="om-title">CAMP BREAKS — SEASON AHEAD</div>
              <div class="om-text">Camp grade: <b>${Math.round(avg * 100)}%</b>. The schedule is on your desk —
              eight Fridays, then the playoffs if you earn them. Your office is the heart of it all.</div>
              <div class="om-note">Click the HELMET to play Friday's game · the PAPERS for weekly decisions ·
              the WINDOW for practice · the WHITEBOARD to design plays · the TROPHY SHELF for the season.</div>`,
              [{ label: '▸ TO THE OFFICE', gold: true, onPick: () => this.toOffice() }], { sticky: true });
          }
        } else {
          fr.practice = bonus;
          saveState(this.state);
          this.toOffice();
          modal(`
            <div class="om-title">PRACTICE COMPLETE</div>
            <div class="om-text">${bonus.label} — the boost applies to this Friday's game.</div>`,
            [{ label: 'BACK TO WORK', gold: true }]);
        }
      },
      onExit: () => { this.swap(null); this.toOffice(); },
    });
    this.swap(game);
    window.__fng = { state: this.state, game };
  }

  toOffice() {
    showScreen('office');
    closeModal();
    const fr = this.state.franchise;
    const office = new Office(document.getElementById('office-holder'), this.state, {
      onGame: () => {
        if (fr.seasonOver) this.seasonEndModal();
        else this.toWeekGame();
      },
      onPractice: () => {
        if (fr.seasonOver) { modal(`<div class="om-title">OFF-SEASON</div><div class="om-text">The field can wait. Wrap up the season at the helmet.</div>`, [{ label: 'OK' }]); return; }
        if (fr.practice) {
          modal(`<div class="om-title">PRACTICE IS IN THE BOOKS</div><div class="om-text">${fr.practice.label} is locked in for Friday. One practice a week — legs need to live.</div>`, [{ label: 'GOT IT' }]);
          return;
        }
        this.drillPicker();
      },
      onPlaybook: () => this.toEditor(),
      onExit: () => { this.swap(null); showScreen('title'); this.bindTitle(); },
      onDecision: () => this.decisionModal(),
      onPhone: () => this.phoneModal(),
      onStandings: () => this.standingsModal(),
      onDecorate: () => this.decorateModal(),
    });
    this.swap(office);
    window.__fng = { state: this.state, office };
    saveState(this.state);
  }

  drillPicker() {
    modal(`
      <div class="om-title">AFTER-SCHOOL PRACTICE</div>
      <div class="om-text">Pick this week's emphasis. The drill grade sets the size of Friday's boost.</div>`,
      DRILLS.map((d) => ({
        label: `${d.icon} ${d.name}`,
        fx: d.desc,
        onPick: () => this.toDrill(d.id),
      })).concat([{ label: 'Not today', fx: 'No practice bonus this week' }]));
  }

  decisionModal() {
    const fr = this.state.franchise;
    if (fr.seasonOver) { modal(`<div class="om-title">EMPTY DESK</div><div class="om-text">Nothing left to sign this season.</div>`, [{ label: 'OK' }]); return; }
    if (fr.decisionDone) {
      modal(`<div class="om-title">PAPERWORK DONE</div><div class="om-text">The inbox is clear. See you Friday, coach.</div>`, [{ label: 'OK' }]);
      return;
    }
    const card = weeklyDecision(fr);
    modal(`
      <div class="om-title">${card.title}</div>
      <div class="om-text">${card.text}</div>`,
      card.options.map((o) => ({
        label: o.label,
        fx: fxLabel(o.effect),
        onPick: () => {
          applyDecision(fr, o.effect);
          fr.decisionDone = true;
          saveState(this.state);
          this.current?.setHeader?.();
          modal(`<div class="om-title">${card.title}</div><div class="om-note">${o.note}</div>`, [{ label: 'BACK TO WORK', gold: true }]);
        },
        keepOpen: true,
      })), { sticky: true });
  }

  phoneModal() {
    const fr = this.state.franchise;
    if (!fr.phoneEvent) {
      modal(`<div class="om-title">DIAL TONE</div><div class="om-text">Quiet line. Probably for the best.</div>`, [{ label: 'HANG UP' }]);
      return;
    }
    const card = adDecision();
    modal(`
      <div class="om-title">📞 ${card.title}</div>
      <div class="om-text">${card.text}</div>`,
      card.options.map((o) => ({
        label: o.label,
        fx: fxLabel(o.effect),
        onPick: () => {
          applyDecision(fr, o.effect);
          fr.phoneEvent = null;
          saveState(this.state);
          this.current?.setHeader?.();
          modal(`<div class="om-title">CALL ENDED</div><div class="om-note">${o.note}</div>`, [{ label: 'BACK TO WORK', gold: true }]);
        },
        keepOpen: true,
      })), { sticky: true });
  }

  standingsModal() {
    const fr = this.state.franchise;
    const rows = fr.schedule.map((g, i) => {
      const r = fr.record[i];
      const result = r ? `<b class="${r.won ? 'w' : 'l'}">${r.won ? 'W' : 'L'} ${r.home}–${r.away}</b>` : (i + 1 === fr.week ? '<b>FRIDAY</b>' : '—');
      return `<div class="om-row"><span>WK ${g.week} · ${g.name} ${g.mascot}${g.homecoming ? ' 🎉' : ''}</span>${result}</div>`;
    }).join('');
    const playoffRows = fr.record.slice(8).map((r, i) => {
      const names = ['QUARTERFINAL', 'DISTRICT FINAL', 'STATE FINAL'];
      return `<div class="om-row"><span>${names[i]} · ${r.opp}</span><b class="${r.won ? 'w' : 'l'}">${r.won ? 'W' : 'L'} ${r.home}–${r.away}</b></div>`;
    }).join('');
    const trophies = fr.trophies.filter((t) => t !== 'district-berth').map((t) => t === 'state' ? '🏆 STATE CHAMPIONS' : '🥇 DISTRICT CHAMPIONS').join(' · ');
    modal(`
      <div class="om-title">SEASON ${fr.seasons + 1} — ${wins(fr)}–${losses(fr)}</div>
      <div class="om-rows">${rows}${playoffRows}</div>
      ${trophies ? `<div class="om-note">${trophies}</div>` : ''}`,
      [{ label: 'CLOSE' }]);
  }

  decorateModal() {
    const st = this.state.office;
    const swatch = (key, colors) => `<div class="om-swatches" data-key="${key}">${colors.map((c) => `<button data-c="${c}" class="${st[key] === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>`;
    modal(`
      <div class="om-title">DECORATE THE OFFICE</div>
      <div class="om-label">WALL PAINT</div>
      ${swatch('wall', ['#b8b2a4', '#cfc6b0', '#9fb3a6', '#b0a0c0', '#c2b099', '#8fa3b8'])}
      <div class="om-label">CARPET</div>
      ${swatch('carpet', ['#5a2e28', '#2e4a5a', '#3a4a2e', '#4a4a52', '#6a5a2e', '#52303f'])}
      <div class="om-label">WOODWORK</div>
      ${swatch('wood', ['#6a4a2c', '#4a3018', '#8a6a40', '#3a2a20'])}
      <div class="om-label">POSTER</div>
      <div class="om-swatches" data-key="poster">
        ${['win', 'earn', 'hustle', 'state'].map((p) => `<button data-c="${p}" class="${st.poster === p ? 'on' : ''}" style="background:#1c2848;color:#fff;width:auto;padding:0 8px;font-size:10px;font-weight:700">${p.toUpperCase()}</button>`).join('')}
      </div>
      <div class="om-label">EXTRAS</div>
      <div class="om-swatches" data-key="toggles">
        ${['plant', 'radio', 'bobble'].map((k) => `<button data-t="${k}" class="${st[k] ? 'on' : ''}" style="background:#1c2848;color:#fff;width:auto;padding:0 8px;font-size:10px;font-weight:700">${k.toUpperCase()}</button>`).join('')}
      </div>`,
      [{ label: 'DONE — LOOKS SHARP', gold: true, onPick: () => saveState(this.state) }]);
    // wire swatches
    const card = document.querySelector('#office-modal .om-card');
    card.querySelectorAll('.om-swatches').forEach((rowEl) => {
      const key = rowEl.dataset.key;
      rowEl.querySelectorAll('button').forEach((btn) => {
        btn.onclick = () => {
          if (btn.dataset.t) st[btn.dataset.t] = !st[btn.dataset.t];
          else st[key] = btn.dataset.c;
          rowEl.querySelectorAll('button').forEach((b2) => b2.classList.toggle('on', b2.dataset.t ? st[b2.dataset.t] : b2.dataset.c === st[key]));
          this.current?.rebuild?.();
          sfx.chime();
        };
      });
    });
  }

  toEditor() {
    showScreen('editor');
    const ed = new PlayEditor(
      document.querySelector('#scr-editor .panel'),
      document.querySelector('#scr-editor .ed-board'),
      this.state,
      () => { saveState(this.state); this.toOffice(); }
    );
    this.swap(ed);
  }

  toWeekGame() {
    const fr = this.state.franchise;
    const opponent = currentOpponent(fr);
    const modifiers = {
      flat: fr.morale,
      attrs: fr.practice?.attrs || {},
    };
    showScreen('game');
    const game = new Game(document.getElementById('game-holder'), { ...this.state, rival: opponent }, {
      weekLabel: weekLabel(fr, this.state.school),
      modifiers,
      playbook: this.playbook(),
      onGameEnd: ({ won, home, away }) => {
        this.swap(null);
        const events = recordResult(fr, { won, home, away, oppName: `${opponent.name} ${opponent.mascot}` });
        saveState(this.state);
        this.toOffice();
        if (events.length || fr.seasonOver) {
          modal(`
            <div class="om-title">${won ? 'FRIDAY: ' + home + '–' + away : 'FRIDAY: ' + home + '–' + away}</div>
            ${events.map((e) => `<div class="om-note">${e}</div>`).join('')}`,
            [{ label: fr.seasonOver ? 'SO IT GOES' : 'NEXT WEEK ▸', gold: true, onPick: () => { if (fr.seasonOver) this.seasonEndModal(); } }],
            { sticky: fr.seasonOver });
        }
      },
      onExit: () => { this.swap(null); this.toOffice(); },
    });
    this.swap(game);
    window.__fng = { state: this.state, game };
  }

  seasonEndModal() {
    const fr = this.state.franchise;
    const champion = fr.trophies.includes('state');
    const headline = fr.fired ? 'CLEAN OUT YOUR DESK'
      : champion ? '🏆 STATE CHAMPIONS!'
      : `SEASON ${fr.seasons + 1} COMPLETE`;
    const sub = fr.fired
      ? 'The AD\'s patience ran out. Take a year, drink some sweet tea, and another school will call.'
      : champion ? 'They\'ll paint the water tower for this one. Banner up, rings ordered.'
      : `Final: ${wins(fr)}–${losses(fr)}. The program grows.`;
    modal(`
      <div class="om-title">${headline}</div>
      <div class="om-text">${sub}</div>`,
      [
        { label: '★ START NEXT SEASON', gold: true, onPick: () => {
          this.state.franchise = rollNewSeason(fr);
          this.state.roster = genRoster(5); // a new class of kids comes up
          saveState(this.state);
          this.toOffice();
        } },
        { label: 'BACK TO TITLE', onPick: () => { this.swap(null); showScreen('title'); this.bindTitle(); } },
      ], { sticky: true });
  }

  // ----------------------------------------------------------- exhibition
  toExhibition(rematch = false) {
    saveState(this.state);
    if (!rematch || !this.state.rival) {
      this.state.rival = genRival(this.state.school.name, this.state.school.mascot);
    }
    showScreen('game');
    const game = new Game(document.getElementById('game-holder'), this.state, {
      playbook: this.playbook(),
      onExit: () => { this.swap(null); showScreen('title'); this.bindTitle(); },
      onRematch: () => { this.toExhibition(true); },
    });
    this.swap(game);
    window.__fng = { state: this.state, game };
  }
}

function fxLabel(effect) {
  const parts = [];
  if (effect.morale) parts.push(`MORALE ${effect.morale > 0 ? '+' : ''}${effect.morale}`);
  if (effect.adTrust) parts.push(`AD TRUST ${effect.adTrust > 0 ? '+' : ''}${effect.adTrust}`);
  if (effect.crowdBoost) parts.push('LOUDER CROWD');
  return parts.join(' · ') || 'NO STRINGS ATTACHED';
}

// ------------------------------------------------------------- modes
const params = new URLSearchParams(location.search);
if (params.has('gallery')) {
  // QA: grid of rigs cycling through clips
  (async () => {
    const { galleryMode } = await import('./gallery.js');
    galleryMode(defaultState);
  })();
} else {
  showScreen('title');
  const app = new App();
  const padUI = new PadUI(() => (app.current && app.current.padFocusHotspot ? app.current : null));
  window.__padui = padUI;
  if (params.has('quick')) app.toExhibition();
  if (params.has('office')) {
    app.state.franchise = { ...newFranchise(), campDone: true };
    app.toOffice();
  }
  if (params.has('editor')) {
    app.toEditor();
  }
  if (params.has('drill')) {
    app.state.franchise = { ...newFranchise(), campDone: true };
    app.toDrill(params.get('drill') || 'routes');
  }
  window.__app = app;
}
