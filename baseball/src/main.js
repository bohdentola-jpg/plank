// BIG INNING '27 app shell: boot gate → title (live 3D batting-cage scene) →
// exhibition (pick your yard) / season mode / road to glory. Saves to the browser.
import * as THREE from 'three';
import { Animator } from './animation.js';
import { makeBBClips } from './bbclips.js';
import { makeBBKit, buildBallplayer, setHeadgear, setBattingGloves, buildBat } from './model.js';
import { BBGame } from './game.js';
import { PARKS, parkById } from './parks.js';
import { genTeam, genClub, overall, battingOrder } from './players.js';
import {
  newSeason, currentOpponent, isHomeGame, recordWeek, standings, signFreeAgent,
  playoffOpponent, recordPlayoff, SEASON_GAMES,
  newRtg, rtgAvg, rtgStars, rtgBuyUpgrade, RTG_UPGRADES, rtgPaContext, rtgGameResult,
  rtgEvent, RTG_GAMES,
} from './league.js';
import { sfx } from './audio.js';
import { PadUI } from './padui.js';
import { pads } from './gamepad.js';
import { mkCanvas } from './textures.js';

const SAVE_KEY = 'biginning27_save_v1';
const CLIPS = makeBBClips();
const SKINS = ['#e8c49a', '#e0a87f', '#c68863', '#a16a45', '#8d5a3b', '#74462c', '#5d3a26', '#4a2e1e'];
const HAIRC = ['#1a1208', '#2a1c10', '#4a3018', '#6a4a22', '#8a6a3a', '#b8b2a8'];

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function showScreen(id) {
  for (const s of ['title', 'create', 'hub', 'game']) {
    document.getElementById(`scr-${s}`).classList.toggle('active', s === id);
  }
}

function modal(html, buttons = [], { sticky = false } = {}) {
  const wrap = document.getElementById('office-modal');
  const card = wrap.querySelector('.om-card');
  card.innerHTML = html;
  const btnHolder = el('div', 'om-buttons');
  for (const b of buttons) {
    const bn = el('button', b.gold ? 'gold' : '', b.label + (b.fx ? `<span class="fx">${b.fx}</span>` : ''));
    bn.onclick = () => { sfx.chime(); if (!b.keepOpen) wrap.classList.remove('show'); b.onPick?.(); };
    btnHolder.appendChild(bn);
  }
  card.appendChild(btnHolder);
  wrap.classList.add('show');
  wrap.onclick = sticky ? null : (e) => { if (e.target === wrap) wrap.classList.remove('show'); };
}
function closeModal() { document.getElementById('office-modal').classList.remove('show'); }

function defaultState() {
  return { season: null, rtg: null, exhibParkId: 'cathedral' };
}
function saveState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch { return null; }
}

// ------------------------------------------------------------------ logo
export function bigInningLogoCanvas(w = 1200, h = 420) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.5);
  glow.addColorStop(0, 'rgba(80,200,120,0.28)');
  glow.addColorStop(1, 'rgba(80,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const word = (text, y, size) => {
    ctx.save();
    ctx.translate(w * 0.5, y);
    ctx.transform(1, 0, -0.14, 1, 0, 0);
    ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
    const grad = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.42);
    grad.addColorStop(0, '#f6fff0');
    grad.addColorStop(0.42, '#7fd894');
    grad.addColorStop(0.55, '#1d6b3a');
    grad.addColorStop(0.72, '#4aa964');
    grad.addColorStop(1, '#d8ffc8');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#06120a';
    ctx.lineWidth = size * 0.085;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = grad;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  word('BIG INNING', h * 0.47, h * 0.40);
  // the '27 ball
  ctx.save();
  ctx.translate(w * 0.85, h * 0.28);
  ctx.rotate(0.18);
  ctx.fillStyle = '#f6f4ec';
  ctx.beginPath(); ctx.arc(0, 0, h * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0c0405'; ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = '#c0273a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(-h * 0.05, 0, h * 0.125, -1.1, 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(h * 0.05, 0, h * 0.125, Math.PI - 1.1, Math.PI + 1.1); ctx.stroke();
  ctx.fillStyle = '#101418';
  ctx.font = `900 ${h * 0.14}px Impact, 'Arial Black', sans-serif`;
  ctx.fillText(`'27`, 0, h * 0.05);
  ctx.restore();
  // tag bar
  ctx.fillStyle = '#e8c840';
  const bw = w * 0.56, bh = h * 0.115;
  ctx.save();
  ctx.translate(w * 0.5, h * 0.72);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#16100a';
  ctx.font = `900 ${bh * 0.62}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText('SUMMER LEAGUE BASEBALL · EVERY YARD IS DIFFERENT', 0, bh * 0.22);
  ctx.restore();
  return cv;
}

// ------------------------------------------------------------------ app
class App {
  constructor() {
    this.state = loadState() || defaultState();
    this.current = null;
    this.bindTitle();
  }

  swap(thing) {
    if (this.current?.dispose) this.current.dispose();
    this.current = thing;
  }

  bindTitle() {
    showScreen('title');
    const cont = document.getElementById('title-continue');
    cont.style.display = (this.state.season && !this.state.season.over) || (this.state.rtg && !this.state.rtg.signed) ? '' : 'none';
    document.getElementById('title-rtg').onclick = () => {
      sfx.ensure(); sfx.chime();
      if (this.state.rtg && !this.state.rtg.signed) this.toRtgHub();
      else this.toCreate();
    };
    document.getElementById('title-season').onclick = () => {
      sfx.ensure(); sfx.chime();
      if (this.state.season && !this.state.season.over) this.toSeasonHub();
      else this.newSeasonFlow();
    };
    document.getElementById('title-quick').onclick = () => { sfx.ensure(); sfx.chime(); this.exhibitionFlow(); };
    cont.onclick = () => {
      sfx.ensure(); sfx.chime();
      if (this.state.rtg && !this.state.rtg.seasonOver) this.toRtgHub();
      else if (this.state.season && !this.state.season.over) this.toSeasonHub();
      else if (this.state.rtg) this.toRtgHub();
      else this.toSeasonHub();
    };
    this.titleScene();
  }

  titleScene() {
    const holder = document.getElementById('title-3d');
    if (!holder || holder.dataset.built) return;
    holder.dataset.built = '1';
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(holder.clientWidth, holder.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a1810');
    scene.fog = new THREE.Fog('#0a1810', 14, 50);
    const cam = new THREE.PerspectiveCamera(40, holder.clientWidth / holder.clientHeight, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#8ad89c', '#1c2415', 1.1));
    const key = new THREE.DirectionalLight('#ffe8c4', 3.0);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7ad0ff', 1.6);
    rim.position.set(-8, 6, -6);
    scene.add(rim);
    const glowL = new THREE.PointLight('#ffd890', 26, 18);
    glowL.position.set(0, 4, 3);
    scene.add(glowL);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshPhongMaterial({ color: '#1d3a1c' }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshPhongMaterial({ color: '#8a5a30' }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.01;
    scene.add(dirt);
    const kit = makeBBKit({
      jersey: '#f4f2e8', sleeve: '#d35f12', pants: '#f4f2e8', cap: '#d35f12', brim: '#1c1c1e',
      belt: '#d35f12', socks: '#d35f12', numberFill: '#d35f12', numberStroke: '#1c1c1e', style: 'classic',
    });
    const anims = [];
    const batter = buildBallplayer(kit, { num: 9, build: 'avg', skin: '#8d5a3b', bats: 'R' });
    setHeadgear(batter, 'helmet');
    setBattingGloves(batter, true);
    batter.group.position.set(0.4, 0, 0);
    batter.group.rotation.y = 0.9;
    scene.add(batter.group);
    const aBat = new Animator(batter, CLIPS);
    aBat.play('batStance');
    anims.push(aBat);
    const bat = buildBat();
    scene.add(bat);
    const pitcher = buildBallplayer(kit, { num: 21, build: 'slim', skin: '#c68863' });
    setHeadgear(pitcher, 'cap');
    pitcher.group.position.set(-2.2, 0, -1.6);
    pitcher.group.rotation.y = -0.3;
    scene.add(pitcher.group);
    const aP = new Animator(pitcher, CLIPS);
    aP.play('pitchSet');
    aP.rate = 0.8;
    anims.push(aP);
    const fielder = buildBallplayer(kit, { num: 4, build: 'big', skin: '#5d3a26' });
    setHeadgear(fielder, 'cap');
    fielder.group.position.set(2.6, 0, -1.4);
    fielder.group.rotation.y = 0.4;
    scene.add(fielder.group);
    const aF = new Animator(fielder, CLIPS);
    aF.play('fieldReady');
    aF.rate = 0.9;
    anims.push(aF);
    const clock = new THREE.Clock();
    let t = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      if (!document.getElementById('scr-title').classList.contains('active')) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      for (const a of anims) a.update(dt);
      const grip = batter.gripR;
      grip.updateWorldMatrix(true, false);
      bat.position.setFromMatrixPosition(grip.matrixWorld);
      const q = new THREE.Quaternion();
      grip.getWorldQuaternion(q);
      bat.quaternion.copy(q);
      bat.rotateX(-0.5);
      const cv = renderer.domElement;
      if (holder.clientWidth && cv.width !== Math.round(holder.clientWidth * renderer.getPixelRatio())) {
        cam.aspect = holder.clientWidth / holder.clientHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(holder.clientWidth, holder.clientHeight);
      }
      cam.position.set(2.2 + Math.sin(t * 0.14) * 4.4, 1.9 + Math.sin(t * 0.4) * 0.15, Math.cos(t * 0.14) * 6.2);
      cam.lookAt(0.4, 1.25, 0);
      renderer.render(scene, cam);
    };
    tick();
    window.addEventListener('resize', () => {
      if (!holder.clientWidth) return;
      cam.aspect = holder.clientWidth / holder.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(holder.clientWidth, holder.clientHeight);
    });
  }

  // ----------------------------------------------------------- exhibition
  exhibitionFlow() {
    // pick your yard first — six parks, six moods
    modal(`
      <div class="om-title">PICK YOUR YARD</div>
      <div class="om-text">Six parks, six moods. Short fences, monster walls, corn past center.</div>`,
      PARKS.map((p) => ({
        label: `${p.name}`,
        fx: `${p.tag} · lines ${Math.round(p.wallLine * 3.6)} / center ${Math.round(p.wallCenter * 3.75)}${p.tallSide ? ' · MONSTER WALL' : ''}`,
        onPick: () => {
          this.state.exhibParkId = p.id;
          saveState(this.state);
          this.toExhibition();
        },
      })).concat([{ label: 'Back to the title' }]), { sticky: false });
  }

  toExhibition(rematch = false) {
    const mine = this.state.season?.teams?.[0] || this._exMine || genTeam(2, new Set());
    if (!mine.roster) mine.roster = genClub(2);
    this._exMine = mine;
    if (!rematch || !this._exOpp) this._exOpp = genTeam(3, new Set([mine.name]));
    showScreen('game');
    const qa = new URLSearchParams(location.search);
    const turbo = +qa.get('turbo') || 1; // QA hooks: ?turbo=6&auto watches CPU vs CPU
    const game = new BBGame(document.getElementById('game-holder'), mine, this._exOpp, {
      innings: 3,
      turbo,
      park: parkById(qa.get('park') || this.state.exhibParkId),
      userTeam: qa.has('auto') ? null : 'home',
      label: 'FRIDAY EXHIBITION',
      onGameEnd: () => { this.swap(null); this.bindTitle(); },
      onRematch: () => { this.swap(null); this.toExhibition(true); },
      onExit: () => { this.swap(null); this.bindTitle(); },
    });
    this.swap(game);
    window.__bb = { app: this, game };
  }

  // ----------------------------------------------------------- season mode
  newSeasonFlow() {
    modal(`
      <div class="om-title">A SUMMER OF BASEBALL</div>
      <div class="om-text">Fourteen games. Seven rival clubs, each with a home yard of their own.
      A shoebox of coins, and a fence line where free agents wait for a phone call.</div>
      <div class="om-note">Win games to earn coins · sign free agents between weeks · top four make the playoffs.</div>`,
      [
        { label: '▸ START THE SEASON', gold: true, onPick: () => {
          this.state.season = newSeason(null);
          saveState(this.state);
          this.toSeasonHub();
        } },
        { label: 'Back to the title' },
      ], { sticky: true });
  }

  toSeasonHub() {
    showScreen('hub');
    closeModal();
    this.swap(null);
    this.renderSeasonHub();
    saveState(this.state);
  }

  renderSeasonHub() {
    const s = this.state.season;
    if (!s) { this.newSeasonFlow(); return; }
    const you = s.teams[0];
    const head = document.getElementById('hub-head');
    const table = standings(s);
    const myRow = table.findIndex((r) => r.idx === 0) + 1;
    head.innerHTML = `
      <div class="hh-name">${you.name.toUpperCase()} ${you.mascot.toUpperCase()} — SEASON MODE</div>
      <div class="hh-sub">
        <span>${s.over ? 'SEASON COMPLETE' : s.playoffs ? 'PLAYOFFS' : `WEEK ${Math.min(s.week, SEASON_GAMES)} OF ${SEASON_GAMES}`}</span>
        <span>${s.wins[0]}–${s.losses[0]} · ${myRow}${['ST', 'ND', 'RD'][myRow - 1] || 'TH'} PLACE</span>
        <span>HOME: ${parkById(you.parkId).name.toUpperCase()}</span>
        <span class="oh-chip hot">🪙 ${s.coins} COINS</span>
        ${s.champion ? '<span class="oh-chip hot">🏆 CHAMPIONS</span>' : ''}
      </div>`;
    const grid = document.getElementById('hub-grid');
    grid.innerHTML = '';
    const card = (cls, html, onClick) => {
      const d = el('button', 'hero-card' + (cls ? ' ' + cls : ''), html);
      if (onClick) d.onclick = () => { sfx.ensure(); sfx.chime(); onClick(); };
      grid.appendChild(d);
      return d;
    };

    if (!s.over && !s.playoffs) {
      const opp = currentOpponent(s);
      const park = parkById(isHomeGame(s) ? you.parkId : opp.parkId);
      card('big', `
        <h3>NEXT GAME</h3>
        <div class="hc-line">WEEK ${s.week} — ${isHomeGame(s) ? 'VS' : 'AT'} ${opp.name.toUpperCase()} ${opp.mascot.toUpperCase()}</div>
        <div class="hc-line">${park.name} · ${park.tag}</div>
        <div class="hc-line">Their record: ${s.wins[s.schedule[s.week - 1].oppIdx]}–${s.losses[s.schedule[s.week - 1].oppIdx]}</div>
        <div class="hc-value">PLAY BALL ▸</div>`,
        () => this.toSeasonGame());
    } else if (s.playoffs?.made && s.playoffs.alive) {
      const opp = playoffOpponent(s);
      card('big', `
        <h3>${s.playoffs.round === 0 ? 'SEMIFINAL' : '🏆 THE CHAMPIONSHIP'}</h3>
        <div class="hc-line">VS ${opp.name.toUpperCase()} ${opp.mascot.toUpperCase()} — win or go home.</div>
        <div class="hc-value">PLAY BALL ▸</div>`,
        () => this.toSeasonGame(true));
    } else {
      card('big', `
        <h3>${s.champion ? '🏆 CHAMPIONS' : 'SEASON OVER'}</h3>
        <div class="hc-line">${s.champion ? 'The trophy rides in the front seat all winter.' : s.playoffs?.made === false ? 'Missed the bracket. The fence line will remember.' : 'The summer ends. The game goes on.'}</div>
        <div class="hc-value">START A NEW SEASON ▸</div>`,
        () => { this.state.season = null; saveState(this.state); this.newSeasonFlow(); });
    }

    card('', `
      <h3>STANDINGS</h3>
      ${table.slice(0, 8).map((r, i) => `
        <div class="bb-row ${r.idx === 0 ? 'head' : ''}" style="grid-template-columns: 20px 1fr 40px">
          <span>${i + 1}</span><span>${r.team.name} ${r.team.mascot}</span><span>${r.w}–${r.l}</span>
        </div>`).join('')}`);

    card('', `
      <h3>THE FENCE LINE (FREE AGENTS)</h3>
      <div class="hc-line">Coins buy ballplayers. Ballplayers buy pennants.</div>
      <div class="hc-value">BROWSE ▸</div>`,
      () => this.freeAgencyModal());

    card('', `
      <h3>MY CLUB</h3>
      <div class="hc-line">${you.roster.length} men. ${battingOrder(you).slice(0, 3).map((p) => p.name.split(' ')[1]).join(', ')} at the top of the order.</div>
      <div class="hc-value">ROSTER ▸</div>`,
      () => this.rosterModal(you));

    card('', `
      <h3>THE SUMMER SO FAR</h3>
      <div class="hc-line">${s.results.length ? s.results.slice(-3).map((r) => `${r.won ? 'W' : 'L'} ${r.hr}–${r.ar} ${r.opp.mascot}`).join('<br/>') : 'No games yet. Dew still on the grass.'}</div>
      <div class="hc-value" style="font-size:15px">FULL RESULTS ▸</div>`,
      () => this.resultsModal());

    card('', `
      <h3>BACK TO TITLE</h3>
      <div class="hc-line">The season keeps. Come back before Friday.</div>
      <div class="hc-value">◂ LEAVE</div>`,
      () => this.bindTitle());
  }

  rosterModal(team) {
    const rows = team.roster.map((p) => `
      <div class="bb-row">
        <span class="pos">${p.role || p.pos}</span><span>${p.name}${p.isHero ? ' ★' : ''}</span>
        <span>C${p.con}</span><span>P${p.pow}</span><span>S${p.spd}</span><b class="ovr">${overall(p)}</b>
      </div>`).join('');
    modal(`
      <div class="om-title">${team.name.toUpperCase()} ${team.mascot.toUpperCase()}</div>
      <div class="bb-row head"><span>POS</span><span>NAME</span><span>CON</span><span>POW</span><span>SPD</span><span>OVR</span></div>
      ${rows}`,
      [{ label: 'CLOSE' }]);
  }

  resultsModal() {
    const s = this.state.season;
    const rows = s.results.map((r, i) => `
      <div class="om-row"><span>WK ${i + 1} · ${r.home ? 'VS' : 'AT'} ${r.opp.name} ${r.opp.mascot}</span>
      <b class="${r.won ? 'w' : 'l'}">${r.won ? 'W' : 'L'} ${r.hr}–${r.ar}</b></div>`).join('');
    modal(`
      <div class="om-title">SEASON ${s.wins[0]}–${s.losses[0]}</div>
      <div class="om-rows">${rows || '<div class="om-row"><span>The slate is clean.</span></div>'}</div>`,
      [{ label: 'CLOSE' }]);
  }

  freeAgencyModal() {
    const s = this.state.season;
    if (!s.freeAgents.length) {
      modal(`<div class="om-title">EMPTY FENCE LINE</div><div class="om-text">Everyone worth signing is signed. New faces drift in every couple of weeks.</div>`, [{ label: 'OK' }]);
      return;
    }
    modal(`
      <div class="om-title">THE FENCE LINE — 🪙 ${s.coins}</div>
      <div class="om-text">Ballplayers between teams, chewing seeds, waiting on a call.</div>`,
      s.freeAgents.map((fa) => ({
        label: `${fa.pos} ${fa.name} — OVR ${overall(fa)} (C${fa.con}/P${fa.pow}/S${fa.spd})`,
        fx: `🪙 ${fa.cost} · ${fa.quirk}`,
        keepOpen: true,
        onPick: () => {
          const res = signFreeAgent(s, fa);
          saveState(this.state);
          modal(`<div class="om-title">${res.ok ? 'SIGNED.' : 'NO DEAL'}</div><div class="om-text">${res.note}</div>`,
            [{ label: res.ok ? 'WELCOME ABOARD' : 'BACK', gold: res.ok, onPick: () => { this.renderSeasonHub(); this.freeAgencyModal(); } }], { sticky: true });
        },
      })).concat([{ label: 'CLOSE THE GATE' }]), { sticky: false });
  }

  toSeasonGame(playoff = false) {
    const s = this.state.season;
    const opp = playoff ? playoffOpponent(s) : currentOpponent(s);
    const home = playoff ? true : isHomeGame(s);
    showScreen('game');
    const you = s.teams[0];
    const game = new BBGame(
      document.getElementById('game-holder'),
      home ? you : opp,
      home ? opp : you,
      {
        innings: 3,
        userTeam: home ? 'home' : 'away',
        park: parkById(home ? you.parkId : opp.parkId),
        label: playoff ? (s.playoffs.round === 0 ? 'PLAYOFF SEMIFINAL' : 'THE CHAMPIONSHIP GAME') : `WEEK ${s.week} — SUMMER LEAGUE`,
        onGameEnd: ({ home: hr, away: ar, won }) => {
          this.swap(null);
          const userRuns = home ? hr : ar;
          const oppRuns = home ? ar : hr;
          let note;
          if (playoff) {
            note = recordPlayoff(s, { userRuns, oppRuns });
          } else {
            const res = recordWeek(s, { userRuns, oppRuns });
            note = `${res.won ? 'Winner winner.' : 'A tough one.'} +🪙 ${res.purse} in the shoebox.`;
          }
          saveState(this.state);
          this.toSeasonHub();
          modal(`
            <div class="om-title">${won ? 'W' : 'L'} ${userRuns}–${oppRuns}</div>
            <div class="om-text">${note}</div>`,
            [{ label: 'BACK TO THE CLUB', gold: true }]);
        },
        onExit: () => { this.swap(null); this.toSeasonHub(); },
      }
    );
    this.swap(game);
    window.__bb = { app: this, game };
  }

  // ----------------------------------------------------------- road to glory
  toCreate() {
    showScreen('create');
    const holder = document.querySelector('#scr-create .preview3d');
    const panel = document.querySelector('#scr-create .panel');
    const editor = new RtgCreator(panel, holder, (spec) => {
      this.swap(null);
      this.state.rtg = newRtg(spec, null);
      saveState(this.state);
      this.toRtgHub();
      modal(`
        <div class="om-title">FIRST DAY OF SUMMER BALL</div>
        <div class="om-text">You're ${this.state.rtg.name}, the new ${this.state.rtg.pos} for the
        ${this.state.rtg.team.name} ${this.state.rtg.team.mascot}. Twelve games on the calendar.
        Every at-bat is yours — the box score does the talking.</div>
        <div class="om-note">Play your plate appearances live. Train between games. Big clubs are listening.</div>`,
        [{ label: 'GRAB A BAT', gold: true }]);
    });
    this.swap(editor);
  }

  toRtgHub() {
    showScreen('hub');
    closeModal();
    this.swap(null);
    this.renderRtgHub();
    saveState(this.state);
  }

  renderRtgHub() {
    const r = this.state.rtg;
    if (!r) { this.toCreate(); return; }
    const head = document.getElementById('hub-head');
    const avg = rtgAvg(r);
    const stars = '★'.repeat(rtgStars(r)) + '☆'.repeat(5 - rtgStars(r));
    const wins = r.record.filter((g) => g.won).length;
    head.innerHTML = `
      <div class="hh-name">${r.name.toUpperCase()} · ${r.pos} #${r.num} — ${r.team.name.toUpperCase()} ${r.team.mascot.toUpperCase()}</div>
      <div class="hh-sub">
        <span>${r.seasonOver ? 'SEASON COMPLETE' : `GAME ${r.game} OF ${RTG_GAMES}`}</span>
        <span>${wins}–${r.record.length - wins}</span>
        <span>AVG .${String(Math.round(avg * 1000)).padStart(3, '0')}</span>
        <span>${r.stats.hr} HR · ${r.stats.rbi} RBI</span>
        <span>SCOUTS ${stars}</span>
        <span class="oh-chip">${r.xp} XP</span>
      </div>`;
    const grid = document.getElementById('hub-grid');
    grid.innerHTML = '';
    const card = (cls, html, onClick) => {
      const d = el('button', 'hero-card' + (cls ? ' ' + cls : ''), html);
      if (onClick) d.onclick = () => { sfx.ensure(); sfx.chime(); onClick(); };
      grid.appendChild(d);
      return d;
    };

    const entry = r.schedule[Math.min(r.game, RTG_GAMES) - 1];
    card('big', `
      <h3>${r.seasonOver ? 'SIGNING DAY' : 'GAME DAY'}</h3>
      <div class="hc-line">${r.seasonOver ? 'The phone is ringing. Pick a future.' :
        `${entry.home ? 'VS' : 'AT'} ${entry.opp.name.toUpperCase()} ${entry.opp.mascot.toUpperCase()} — ${parkById(entry.home ? r.team.parkId : entry.opp.parkId).name} — your bats decide it.`}</div>
      <div class="hc-value">${r.seasonOver ? '🖊' : 'PLAY ▸'}</div>`,
      () => r.seasonOver ? this.rtgSigningDay() : this.rtgGameDay());

    card('', `
      <h3>MY GAME (${r.xp} XP)</h3>
      <div class="hc-bars">
        ${['con', 'pow', 'spd', 'arm', 'glv'].map((k) => `
          <div class="hc-bar"><span>${k.toUpperCase()}</span><i><b style="width:${r.me[k]}%"></b></i><span>${r.me[k]}</span></div>`).join('')}
      </div>`,
      () => this.rtgUpgrades());

    const ev = rtgEvent(r);
    card('', `
      <h3>AROUND THE YARD</h3>
      <div class="hc-line">${r.eventDone ? 'Handled for now.' : ev.title}</div>
      <div class="hc-value">${r.eventDone ? '✔' : 'DEAL WITH IT ▸'}</div>`,
      () => this.rtgEventModal());

    card('', `
      <h3>THE BOX SCORE</h3>
      <div class="hc-line">
        ${r.stats.ab} AB · ${r.stats.hits} H · ${r.stats.doubles} 2B · ${r.stats.triples} 3B<br/>
        ${r.stats.hr} HR · ${r.stats.rbi} RBI · ${r.stats.bb} BB · ${r.stats.k} K
      </div>`);

    card('', `
      <h3>BIG CLUB OFFERS (${r.offers.length})</h3>
      <div class="hc-line">${r.offers.length ? r.offers.map((o) => `${o.stars} ${o.club}`).join('<br/>') : 'Hit, and they will find you.'}</div>`);

    card('', `
      <h3>BACK TO TITLE</h3>
      <div class="hc-line">The story keeps. See you at the yard.</div>
      <div class="hc-value">◂ LEAVE</div>`,
      () => this.bindTitle());
  }

  rtgEventModal() {
    const r = this.state.rtg;
    if (r.eventDone || r.seasonOver) return;
    const ev = rtgEvent(r);
    modal(`
      <div class="om-title">${ev.title}</div>
      <div class="om-text">${ev.text}</div>`,
      ev.options.map((o) => ({
        label: o.label, fx: o.fx,
        onPick: () => { o.effect(r); r.eventDone = true; saveState(this.state); this.renderRtgHub(); },
      })), { sticky: true });
  }

  rtgUpgrades() {
    const r = this.state.rtg;
    modal(`
      <div class="om-title">CAGE WORK (${r.xp} XP)</div>
      <div class="om-text">Swings in the dark become hits in the light.</div>`,
      RTG_UPGRADES.map((u) => ({
        label: `${u.label} ${r.me[u.id]} → ${Math.min(99, r.me[u.id] + 2)}`,
        fx: `${u.cost} XP`,
        keepOpen: true,
        onPick: () => { if (rtgBuyUpgrade(r, u.id)) { saveState(this.state); this.renderRtgHub(); this.rtgUpgrades(); } },
      })).concat([{ label: 'DONE', gold: true }]));
  }

  /** Game day: 4 live plate appearances stitched into a simmed game. */
  rtgGameDay() {
    this.paResults = [];
    this.paIndex = 0;
    this.paTotal = 4;
    this.playNextPa();
  }

  playNextPa() {
    const r = this.state.rtg;
    const entry = r.schedule[r.game - 1];
    const ctx = rtgPaContext(r, this.paIndex);
    showScreen('game');
    // PA mode always bats the bottom half, so your club takes the home slot
    const game = new BBGame(
      document.getElementById('game-holder'),
      r.team,
      entry.opp,
      {
        mode: 'pa',
        park: parkById(entry.home ? r.team.parkId : entry.opp.parkId),
        label: `AT-BAT ${this.paIndex + 1} OF ${this.paTotal} — ${entry.home ? 'VS' : 'AT'} ${entry.opp.mascot.toUpperCase()}`,
        pa: { ...ctx, batter: r.me },
        onPaEnd: (res) => {
          this.swap(null);
          this.paResults.push(res);
          this.paIndex++;
          if (this.paIndex < this.paTotal) this.playNextPa();
          else this.finishRtgGame();
        },
        onExit: () => {
          this.swap(null);
          while (this.paResults.length < this.paTotal) this.paResults.push({ outcome: 'out', rbi: 0, runs: 0 });
          this.finishRtgGame();
        },
      }
    );
    this.swap(game);
    window.__bb = { app: this, game };
  }

  finishRtgGame() {
    const r = this.state.rtg;
    const res = rtgGameResult(r, this.paResults);
    r.eventDone = false;
    saveState(this.state);
    this.toRtgHub();
    const lastName = r.name.split(' ').slice(-1)[0].toUpperCase();
    const hits = this.paResults.filter((p) => !['out', 'k', 'bb'].includes(p.outcome)).length;
    const hrs = this.paResults.filter((p) => p.outcome === 'hr').length;
    const headline = res.won
      ? (hrs ? `${lastName} GOES DEEP${hrs > 1 ? ' TWICE' : ''} — ${r.team.mascot.toUpperCase()} WIN`
        : hits >= 2 ? `${lastName} RAPS ${hits} HITS IN ${res.us}–${res.them} WIN`
        : `${r.team.mascot.toUpperCase()} TAKE IT, ${res.us}–${res.them}`)
      : (hits ? `${lastName} SHINES BUT ${r.team.mascot.toUpperCase()} FALL ${res.them}–${res.us}`
        : `QUIET NIGHT AT THE PLATE IN ${res.them}–${res.us} LOSS`);
    modal(`
      <div class="om-title">🗞 ${headline}</div>
      <div class="om-note">${r.team.name.toUpperCase()} LEDGER — MORNING EDITION</div>
      <div class="om-text">Your line: ${hits}-for-${this.paResults.filter((p) => p.outcome !== 'bb').length}
      · ${this.paResults.reduce((a, p) => a + (p.rbi || 0), 0)} RBI · +${res.xp} XP · FAME ${res.fame >= 0 ? '+' : ''}${res.fame}</div>`,
      [{ label: r.seasonOver ? 'SO IT GOES' : 'NEXT GAME ▸', gold: true, onPick: () => { if (r.seasonOver) this.rtgSigningDay(); } }],
      { sticky: true });
  }

  rtgSigningDay() {
    const r = this.state.rtg;
    const offers = r.offers.length ? r.offers : [{ club: 'Player-coach, Twin Forks Miners', stars: '★' }];
    modal(`
      <div class="om-title">🖊 SIGNING DAY</div>
      <div class="om-text">A season of .${String(Math.round(rtgAvg(r) * 1000)).padStart(3, '0')} ball,
      ${r.stats.hr} home runs, ${r.stats.rbi} driven in. The letters are on the kitchen table.</div>`,
      offers.map((o) => ({
        label: `${o.stars} ${o.club}`,
        keepOpen: true,
        onPick: () => {
          r.signed = o.club;
          saveState(this.state);
          modal(`
            <div class="om-title">SIGNED.</div>
            <div class="om-text">${r.name} — ${o.club}. The county paper runs your swing on the front page.
            Somewhere a kid at the fence decides they want to be you.</div>`,
            [{ label: 'BACK TO TITLE', gold: true, onPick: () => this.bindTitle() }], { sticky: true });
        },
      })), { sticky: true });
  }
}

// ------------------------------------------------------------- RTG creator
class RtgCreator {
  constructor(panel, holder, onDone) {
    this.panel = panel;
    this.holder = holder;
    this.onDone = onDone;
    this.name = 'Sam Cross';
    this.num = 9;
    this.build = 'avg';
    this.pos = 'CF';
    this.look = { skin: '#c68863', hair: 'buzz', hairCol: '#2a1c10', eyeCol: '#241a12', brow: 1, jaw: 1, facial: 'none', eyeBlack: false, visor: null };
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(holder.clientWidth, holder.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    holder.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#101c12');
    this.scene.add(new THREE.HemisphereLight('#9fd8b0', '#22261c', 1.0));
    const key = new THREE.DirectionalLight('#ffe8c4', 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7ad0ff', 1.4);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.12, 28), new THREE.MeshPhongMaterial({ color: '#4a5a46', shininess: 60 }));
    dais.position.y = 0.06;
    this.scene.add(dais);
    this.camera = new THREE.PerspectiveCamera(36, holder.clientWidth / holder.clientHeight, 0.05, 100);
    this.yaw = 0.4;
    this._drag = null;
    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { this._drag = e.clientX; });
    cv.addEventListener('pointermove', (e) => { if (this._drag != null) { this.yaw -= (e.clientX - this._drag) * 0.01; this._drag = e.clientX; } });
    cv.addEventListener('pointerup', () => { this._drag = null; });
    this._onResize = () => {
      if (!holder.clientWidth) return;
      this.camera.aspect = holder.clientWidth / holder.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(holder.clientWidth, holder.clientHeight);
    };
    window.addEventListener('resize', this._onResize);
    this.clock = new THREE.Clock();
    this.disposed = false;
    this.rebuild();
    this.render();
    this.loop();
  }

  rebuild() {
    if (this.rigGroup) this.scene.remove(this.rigGroup);
    const kit = makeBBKit({
      jersey: '#f4f2e8', sleeve: '#d35f12', pants: '#f4f2e8', cap: '#d35f12', brim: '#1c1c1e',
      belt: '#d35f12', socks: '#d35f12', numberFill: '#d35f12', numberStroke: '#1c1c1e', style: 'classic',
    });
    const rig = buildBallplayer(kit, { num: this.num, build: this.build, skin: this.look.skin, look: { ...this.look } });
    setHeadgear(rig, 'cap');
    rig.group.position.y = 0.12;
    this.rigGroup = rig.group;
    this.scene.add(rig.group);
    this.anim = new Animator(rig, CLIPS);
    this.anim.play('idle');
  }

  loop() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this._drag == null) this.yaw += dt * 0.25;
    this.anim?.update(dt);
    this.camera.position.set(Math.sin(this.yaw) * 2.7, 1.75, Math.cos(this.yaw) * 2.7);
    this.camera.lookAt(0, 1.55, 0);
    this.renderer.render(this.scene, this.camera);
  }

  seg(opts, get, set) {
    const row = el('div', 'seg-row');
    for (const [val, label] of opts) {
      const b = el('button', 'seg' + (get() === val ? ' on' : ''), label);
      b.onclick = () => { set(val); sfx.chime(); this.render(); this.rebuild(); };
      row.appendChild(b);
    }
    return row;
  }

  sw(values, get, set) {
    const row = el('div', 'preset-row');
    for (const v of values) {
      const b = el('button', 'preset-chip' + (get() === v ? ' on' : ''));
      b.style.background = v;
      b.onclick = () => { set(v); sfx.chime(); this.render(); this.rebuild(); };
      row.appendChild(b);
    }
    return row;
  }

  render() {
    const p = this.panel;
    const L = this.look;
    p.innerHTML = '';
    p.appendChild(el('h2', 'panel-title', 'WHO STEPS IN THE BOX?'));

    const nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.maxLength = 22; nameIn.value = this.name;
    nameIn.addEventListener('input', () => { this.name = nameIn.value || 'Sam Cross'; });
    const f1 = el('label', 'field');
    f1.appendChild(el('span', 'field-label', 'YOUR NAME'));
    f1.appendChild(nameIn);
    p.appendChild(f1);

    p.appendChild(el('h3', 'panel-sub', 'NUMBER'));
    p.appendChild(this.seg([[3, '3'], [9, '9'], [13, '13'], [21, '21'], [24, '24'], [42, '42']], () => this.num, (v) => { this.num = v; }));

    p.appendChild(el('h3', 'panel-sub', 'POSITION'));
    p.appendChild(this.seg([['CF', 'CENTER FIELD'], ['SS', 'SHORTSTOP'], ['1B', 'FIRST BASE'], ['C', 'CATCHER']], () => this.pos, (v) => { this.pos = v; }));

    p.appendChild(el('h3', 'panel-sub', 'SKIN TONE'));
    p.appendChild(this.sw(SKINS, () => L.skin, (v) => { L.skin = v; }));

    p.appendChild(el('h3', 'panel-sub', 'HAIR'));
    p.appendChild(this.seg([['none', 'SHAVED'], ['buzz', 'BUZZ'], ['curl', 'CURLS']], () => L.hair, (v) => { L.hair = v; }));
    p.appendChild(this.sw(HAIRC, () => L.hairCol, (v) => { L.hairCol = v; }));

    p.appendChild(el('h3', 'panel-sub', 'FACE'));
    p.appendChild(this.seg([[0.92, 'NARROW'], [1, 'AVERAGE'], [1.09, 'SQUARE']], () => L.jaw, (v) => { L.jaw = v; }));
    p.appendChild(this.seg([['none', 'CLEAN'], ['stache', 'MUSTACHE'], ['goatee', 'GOATEE']], () => L.facial, (v) => { L.facial = v; }));

    p.appendChild(el('h3', 'panel-sub', 'BUILD'));
    p.appendChild(this.seg([['slim', 'WIRY'], ['avg', 'ATHLETIC'], ['big', 'SLUGGER']], () => this.build, (v) => { this.build = v; }));

    const go = el('button', 'cta big', '★ PLAY BALL — START MY STORY ▸');
    go.onclick = () => {
      sfx.firstDown();
      this.onDone({ name: this.name, num: this.num, build: this.build, pos: this.pos, look: { ...L } });
    };
    p.appendChild(go);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.panel.innerHTML = '';
    this.holder.innerHTML = '';
  }
}

// ------------------------------------------------------------- boot
const params = new URLSearchParams(location.search);
const app = new App();
const padUI = new PadUI(() => null);
window.__padui = padUI;
window.__bbApp = app;

if (params.has('quick')) {
  document.getElementById('boot').classList.remove('show');
  app.toExhibition();
} else if (params.has('season')) {
  document.getElementById('boot').classList.remove('show');
  if (!app.state.season) app.state.season = newSeason(null);
  app.toSeasonHub();
} else if (params.has('nointro')) {
  document.getElementById('boot').classList.remove('show');
} else {
  // press-any-button gate
  const boot = document.getElementById('boot');
  document.getElementById('boot-logo').src = bigInningLogoCanvas().toDataURL();
  boot.classList.add('show');
  const begin = () => {
    window.removeEventListener('keydown', begin);
    boot.removeEventListener('pointerdown', begin);
    clearInterval(bootPad);
    sfx.ensure();
    sfx.firstDown();
    boot.classList.remove('show');
  };
  window.addEventListener('keydown', begin);
  boot.addEventListener('pointerdown', begin);
  const bootPad = setInterval(() => {
    pads.poll();
    if (pads.anyEdge()) begin();
  }, 120);
}
document.getElementById('title-logo').src = bigInningLogoCanvas().toDataURL();
