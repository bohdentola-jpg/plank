// THE MATCH: a football game on the TV. The sim (src/sim) plays the game; this
// screen is the broadcast — it builds the stadium and the players, calls the
// shots, runs the pre-snap and the controller, the play clock and the kick
// meter, puts the broadcast package over the picture, cuts to close-ups and
// replays, and walks through the toss, the halves and the final.
//
// Query / params: home, away (team ids), user (home|away|both|none), p1 (home|away
// when both), difficulty, qlen (minutes), venue, time, weather, field (sevens|full),
// seed, intro=0 (skip the open), qa=play (straight to a first-and-ten),
// mode=practice + drill=offense|defense|twominute|fg|returns (match/practice.js).
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { C, vText, vWidth, text, hints, osd, panel, padGlyph, usingPad, keyCap } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { clamp, easeOutCubic, makeRng } from '../core/util.js';
import { Match } from '../sim/match.js';
import * as RULES from '../sim/rules.js';
import { getTeam, TEAMS } from '../data/teams.js';
import { cpuCalls, cpuDefenseFor, specialDefenseFor } from '../sim/ai/playcall.js';
import { MatchWorld } from '../match/world.js';
import { CameraDirector, GAME_CAMS, GAME_CAM_NAMES } from '../match/camera.js';
import { Hud, glossBar, shadeHex, lum, fmtClock, downText, quarterText } from '../match/hud.js';
import { Wristband } from '../match/wristband.js';
import { buildCmd, Presnap, KickMeter } from '../match/controls.js';
import { Booth } from '../match/commentary.js';
import { Tape, ReplayViewer } from '../match/replay.js';
import { Officials } from '../match/officials.js';
import { captureFrame } from '../match/frame.js';
import { MatchSound } from '../match/sound.js';
import { Drill } from '../match/practice.js';
import { drawBoxScore, playerOfGame } from '../match/statsview.js';
import { drawLogo, drawWordmark } from '../gfx/logos.js';
import { recordGame } from '../data/records.js';
import { music } from '../audio/music.js';
import { crowd } from '../audio/crowd.js';
import { sfx } from '../audio/sfx.js';
import { audio } from '../audio/audio.js';

const STEP = 1 / 60;
const other = (s) => (s === 'home' ? 'away' : 'home');
const KICK_KINDS = new Set(['kickoff', 'fg', 'punt']);

let VENUES_META = null;
import('../gfx/stadium/index.js').then((mod) => { VENUES_META = mod.VENUES || null; }).catch(() => {});

class MatchScreen {
  async enter(params = {}) {
    const q = params;
    this.params = q;
    const home = getTeam(q.home || 'pht');
    const away = getTeam(q.away || (home.id === 'det' ? 'pht' : 'det'));
    const user = q.user || 'home';
    const users = { home: null, away: null };
    if (user === 'home') users.home = 0;
    else if (user === 'away') users.away = 0;
    else if (user === 'both') { const p1 = q.p1 === 'away' ? 'away' : 'home'; users[p1] = 0; users[other(p1)] = 1; }
    this.users = users;
    // (who is playing, kept even after SIM TO THE FINAL hands both sides to the CPU)
    this.players = ['home', 'away'].filter((s) => users[s] !== null);
    this.userSide = users.home === 0 ? 'home' : users.away === 0 ? 'away' : null;
    this.mode = q.mode || 'free';
    const practice = this.mode === 'practice';
    this.onDone = q.onDone || null;
    this.weather = q.weather || null;
    const venueId = q.venue || home.venue || 'bayside';
    this.m = new Match({
      home, away, users,
      seed: q.seed !== undefined ? +q.seed : undefined,
      difficulty: q.difficulty || settings.get('difficulty'),
      fieldSize: q.field || settings.get('fieldSize') || 'sevens',
      weather: q.weather || 'clear',
      wind: q.wind !== undefined ? +q.wind : 0.2,
      lock: q.lock || null,
      lockReturns: !!q.lockReturns,
      rosters: q.rosters || null,
      settings: {
        quarterLen: +(q.qlen || settings.get('quarterLen') || 4),
        accelClock: settings.get('accelClock') !== false,
        penalties: settings.get('penalties') !== 'off',
        fatigue: settings.get('fatigue') !== false,
        autoSwitch: settings.get('autoSwitch') !== false,
        passLead: settings.get('passLead'),
      },
    });
    const m = this.m;
    // the 3D world
    this.world = new MatchWorld(game.renderer, m, { venue: venueId, time: q.time, weather: q.weather, wind: m.wind, quality: game.renderer.internalLines <= 480 ? 'low' : 'high' });
    await this.world.build();
    game.renderer.setPost(this.world.post || {}, true);
    this.quietCrowd = practice;
    this.warmSounds();
    const vmeta = this.world.venue?.def || (VENUES_META || []).find((v) => v.id === venueId) || { name: 'Memorial Stadium', city: home.city, capacity: 40000, roof: 'open' };
    this.venueMeta = vmeta;
    this.weatherName = this.world.venue?.weather || q.weather || vmeta.defaultWeather || 'clear';
    this.timeOfDay = this.world.venue?.time || q.time || vmeta.defaultTime || 'night';
    // the crew
    this.cam = new CameraDirector(m.field);
    this.cam.clear = (L, P, o) => this.world?.venue?.clearView?.(L, P, o) ?? 1;
    this.hud = new Hud();
    this.booth = new Booth(m, this.hud, { seed: (q.seed ?? 7) + 3, venueName: vmeta.name, enabled: true });
    this.officials = new Officials(m);
    this.tape = new Tape();
    this.sound = new MatchSound(m, { users, roof: vmeta.roof, capacity: vmeta.capacity, weather: this.weatherName, wind: m.wind, quiet: practice });
    this.unsub = m.on((ev) => this.onEvent(ev));
    // state
    this.t = 0;
    this.acc = 0;
    this.stage = 'intro';
    this.stageT = 0;
    this.calls = null;
    this.wbs = [];
    this.walk = null;
    this.override = null;
    this.presnaps = {};
    this.eat = { home: null, away: null };
    this.kick = null;
    this.playClock = null;
    this.post = null;
    this.viewer = null;
    this.pause = null;
    this.viewDir = 1;
    this.camMode = GAME_CAMS.includes(settings.get('camera')) ? settings.get('camera') : 'broadcast';
    this.captions = settings.get('captions') !== false;
    this.frame = captureFrame(m, this.officials.snapshot());
    this.toss = null;
    this.flagUp = false;
    this.cardQueue = [];
    this.drill = practice ? new Drill(q.drill, 'home') : null;
    // practice: no open, no toss — straight to the drill
    if (this.drill) {
      m.start({ kicking: 'away' });
      this.drill.start(m);
      this.stage = 'game';
    } else if (q.qa === 'play' || q.qa === 'kick' || q.intro === '0') {
      if (q.qa === 'play') {
        m.start({ kicking: 'away' });
        m.newSeries('home', m.field.ownYardZ(m.dirOf('home'), 25), 0);
        this.stage = 'game';
      } else if (q.qa === 'kick') { m.start({ kicking: q.kicking === 'home' ? 'home' : 'away' }); this.stage = 'game'; } else this.beginToss();
    } else {
      music.play('pregame', { fade: 1 });
      this.booth.intro();
    }
  }

  /**
   * Synthesize what the first plays need while LOADING is up: the first use of a
   * sound renders it on the spot, which would hitch the picture at the snap. (No
   * sound yet — nobody has pressed anything — means it waits for the first frame
   * that has it.)
   */
  warmSounds() {
    if (this.soundsWarm || !audio.ctx) return;
    this.soundsWarm = true;
    try {
      sfx.prewarm(['whistle:short', 'whistle:long', 'whistle:double', 'cadence:hut', 'cadence:set', 'cadence:hard', 'snap', 'hit:pads', 'hit:tackle', 'hit:ground', 'hit:helmet', 'grunt', 'catch:hands', 'catch:body', 'catch:bobble', 'bounce', 'kick:kickoff', 'kick:punt', 'kick:fg', 'steps:few', 'steps:many', 'flag', 'chains']);
      if (!this.quietCrowd) crowd.prewarm(['bed:murmur', 'bed:buzz', 'bed:few', 'cheer', 'ooh', 'groan', 'roar', 'aah', 'gasp', 'murmur']);
    } catch { /* sound never stops the game */ }
  }

  exit() {
    this.unsub?.();
    try { this.drill?.saveBest(); } catch { /* */ }
    try { this.booth.dispose(); } catch { /* */ }
    try { this.officials.dispose(); } catch { /* */ }
    try { this.sound.dispose(); } catch { /* */ }
    try { this.world.dispose(); } catch { /* */ }
    try { music.stop(1); } catch { /* */ }
  }

  view() { return this.world?.scene ? { scene: this.world.scene, camera: this.cam.camera } : null; }

  onPadEvent(ev) { if (ev === 'lost' && this.stage === 'game') this.openPause(); }

  // ================================================================ helpers
  humanSides() { return ['home', 'away'].filter((s) => this.m.isUser(s)); }
  plFor(side) { return input.players[this.users[side] ?? 0] || input.p1; }
  setStage(s) { this.stage = s; this.stageT = 0; }

  /**
   * In a career, the plays you're not on the field for go by on fast forward.
   * (Before the call nobody knows who's out there yet; after it, m.active does.)
   */
  ffMode() {
    const m = this.m;
    if (!m.lock || this.mode !== 'career') return false;
    if (m.phase === 'playcall' || m.phase === 'kickoff' || m.phase === 'pat') {
      // the coach calls it unless you're the quarterback with the ball
      return !(m.lock.side === m.offSide && m.lock.player.pos === 'QB' && m.phase === 'playcall');
    }
    return !m.active.some((e) => e.p?.id === m.lock.player.id);
  }

  /** Which way the camera looks: from behind the person playing (or the offense). */
  desiredViewDir() {
    const m = this.m;
    const hs = this.humanSides();
    if (hs.length === 1) return m.dirOf(hs[0]);
    return m.offDir || 1;
  }

  // ================================================================ events from the sim
  onEvent(ev) {
    const m = this.m, hud = this.hud;
    this.drill?.onEvent(ev);
    switch (ev.type) {
      case 'snap':
        // (the person's snap happens outside stepSim, so the sim's own event is the one to trust)
        this.onSnap();
        break;
      case 'firstDown':
        hud.banner('FIRST DOWN', { color: '#ffd23a', kind: 'result', dur: 1.8 });
        break;
      case 'turnover':
        hud.banner('TURNOVER', { color: '#c4101f', kind: 'result', team: m.teams[ev.side], dur: 2.2 });
        break;
      case 'turnoverOnDowns':
        hud.banner('TURNOVER ON DOWNS', { color: '#c4101f', kind: 'result', dur: 2.2 });
        break;
      case 'interception':
        hud.banner('INTERCEPTED!', { color: '#c4101f', kind: 'live', team: m.teams[ev.e.side], dur: 1.8 });
        this.cam.shake(0.4);
        break;
      case 'fumble':
        if (ev.c) hud.banner('FUMBLE!', { color: '#c4101f', kind: 'live', dur: 1.4 });
        break;
      case 'touchback':
        hud.banner('TOUCHBACK', { color: '#38383e', kind: 'result', dur: 1.6 });
        break;
      case 'twoMinute':
        hud.banner('TWO-MINUTE WARNING', { color: '#ffd23a', kind: 'info', dur: 2.6 });
        break;
      case 'quarterEnd':
        if (ev.quarter === 1 || ev.quarter === 3) hud.banner(`END OF ${quarterText({ quarter: ev.quarter, phase: '' })} QUARTER`, { color: '#38383e', kind: 'info', dur: 2.6 });
        break;
      case 'timeout':
        hud.banner(`TIMEOUT ${m.teams[ev.side].abbr}`, { color: m.teams[ev.side].colors.primary, team: m.teams[ev.side], kind: 'info', dur: 2 });
        break;
      case 'flag':
        this.flagUp = true;
        break;
      case 'penaltyAccepted': case 'penaltyDeclined': case 'penalty': {
        const f = ev.flag || m.flags?.[0];
        if (!f) break;
        const team = m.teams[f.on];
        const lines = ev.type === 'penaltyDeclined'
          ? ['DECLINED']
          : [`${ev.yards ?? f.yards} YARD PENALTY`, f.lossOfDown ? 'LOSS OF DOWN' : f.autoFirst ? 'AUTOMATIC FIRST DOWN' : f.replayDown ? 'REPEAT THE DOWN' : ''].filter(Boolean);
        hud.showFlag({ name: `${f.name}`.toUpperCase(), title: team.abbr, lines, dur: 3.6 });
        this.flagUp = false;
        break;
      }
      case 'score':
        if (ev.kind === 'fg') hud.banner("IT'S GOOD!", { color: '#2a9d46', team: m.teams[ev.side], kind: 'result', dur: 2.2 });
        if (ev.kind === 'pat') hud.banner('EXTRA POINT GOOD', { color: '#2a9d46', kind: 'result', dur: 1.6 });
        if (ev.kind === 'two') hud.banner('TWO-POINT TRY GOOD!', { color: '#2a9d46', kind: 'result', dur: 2 });
        if (ev.kind === 'safety') hud.banner('SAFETY!', { color: '#c4101f', team: m.teams[ev.side], kind: 'result', big: true, dur: 2.6 });
        break;
      case 'fgMissed':
        hud.banner('NO GOOD', { color: '#c4101f', kind: 'result', dur: 2 });
        break;
      case 'tryFailed':
        hud.banner(ev.kind === 'patMiss' ? 'PAT NO GOOD' : 'TRY FAILS', { color: '#c4101f', kind: 'result', dur: 1.8 });
        break;
      case 'offsides':
        hud.toast('OFFSIDE!');
        break;
      case 'prompt':
        hud.toast(ev.text || '', 1.4);
        break;
      case 'switch':
        break;
      default: break;
    }
  }

  // ================================================================ the toss
  beginToss() {
    this.setStage('toss');
    this.toss = { step: 'call', t: 0, call: null, result: null, winner: null, choice: null };
    music.play('pregame', { fade: 1 });
  }

  updateToss(dt) {
    const T = this.toss, m = this.m;
    T.t += dt;
    if (T.step === 'call') {
      // the visitors call it in the air
      if (m.isUser('away') && !m.lock) {
        const pl = this.plFor('away');
        if (pl.pressed('cross')) T.call = 'heads';
        if (pl.pressed('circle')) T.call = 'tails';
      } else if (T.t > 1.4) T.call = m.rng() < 0.5 ? 'heads' : 'tails';
      if (T.call) { T.step = 'flip'; T.t = 0; T.result = m.rng() < 0.5 ? 'heads' : 'tails'; uiSound('select'); }
    } else if (T.step === 'flip') {
      if (T.t > 2.2) { T.step = 'result'; T.t = 0; T.winner = T.call === T.result ? 'away' : 'home'; }
    } else if (T.step === 'result') {
      if (m.isUser(T.winner) && !m.lock) {
        const pl = this.plFor(T.winner);
        if (T.t > 0.6 && pl.pressed('cross')) T.choice = 'receive';
        if (T.t > 0.6 && pl.pressed('circle')) T.choice = 'kick';
      } else if (T.t > 1.8) T.choice = m.rng() < 0.75 ? 'receive' : 'kick';
      if (T.choice) {
        T.step = 'done'; T.t = 0;
        this.hud.caption(`${m.teams[T.winner].name} WIN THE TOSS AND WILL ${T.choice === 'receive' ? 'RECEIVE' : 'KICK'}.`);
      }
    } else if (T.step === 'done' && T.t > 1.4) {
      const kicking = T.choice === 'receive' ? other(T.winner) : T.winner;
      m.start({ kicking });
      this.setStage('game');
      this.cam.cut();
    }
  }

  drawToss(ctx) {
    const T = this.toss, m = this.m;
    if (!T) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, 1024, 768);
    glossBar(ctx, 262, 176, 500, 46, '#38383e', '#0c0c0f');
    vText(ctx, 'THE COIN TOSS', 512, 209, 26, { align: 'center', color: '#ffd23a', weight: 0.2 });
    // the coin
    const cx = 512, cy = 330;
    let sx = 1, face = T.result || 'heads';
    if (T.step === 'flip') { const a = T.t * 22 * (1 - T.t / 2.6); sx = Math.cos(a); face = sx > 0 ? 'heads' : 'tails'; }
    const yo = T.step === 'flip' ? -Math.sin(Math.min(1, T.t / 2.2) * Math.PI) * 120 : 0;
    ctx.translate(cx, cy + yo);
    ctx.scale(Math.max(0.06, Math.abs(sx)), 1);
    const g = ctx.createRadialGradient(-20, -24, 6, 0, 0, 74);
    g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#d9a63a'); g.addColorStop(1, '#7a5512');
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#8a6418'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,60,10,0.7)'; ctx.stroke();
    vText(ctx, face === 'heads' ? 'H' : 'T', 0, 22, 56, { align: 'center', color: '#6a4810', weight: 0.2, skew: 0 });
    ctx.setTransform(game.renderer.uiScale, 0, 0, game.renderer.uiScale, 0, 0);
    const away = m.teams.away, home = m.teams.home;
    if (T.step === 'call') {
      text(ctx, `${away.city.toUpperCase()} ${away.name.toUpperCase()} CALL IT IN THE AIR`, 512, 470, { size: 18, weight: 900, color: '#fff', align: 'center', spacing: 2 });
      if (m.isUser('away') && !m.lock) this.choiceRow(ctx, [['cross', 'HEADS'], ['circle', 'TAILS']], 520);
    } else if (T.step === 'flip') {
      text(ctx, `${away.abbr} CALLS ${T.call.toUpperCase()}`, 512, 470, { size: 18, weight: 900, color: '#fff', align: 'center', spacing: 2 });
    } else {
      const w = m.teams[T.winner];
      vText(ctx, `${T.result.toUpperCase()}!`, 512, 470, 30, { align: 'center', color: '#ffd23a', weight: 0.2 });
      text(ctx, `${w.city.toUpperCase()} WINS THE TOSS`, 512, 506, { size: 18, weight: 900, color: '#fff', align: 'center', spacing: 2 });
      if (T.step === 'result' && m.isUser(T.winner) && !m.lock) this.choiceRow(ctx, [['cross', 'RECEIVE'], ['circle', 'KICK']], 552);
      if (T.choice) text(ctx, T.choice === 'receive' ? 'THEY WILL RECEIVE' : 'THEY WILL KICK OFF', 512, 552, { size: 16, weight: 800, color: '#cfd7e6', align: 'center', spacing: 2 });
    }
    void home;
    ctx.restore();
  }

  choiceRow(ctx, items, y) {
    let total = 0;
    const widths = items.map(([, l]) => vWidth(l, 20) + 60);
    for (const w of widths) total += w;
    let x = 512 - total / 2;
    items.forEach(([btn, label], i) => {
      if (usingPad()) padGlyph(ctx, btn, x + 14, y - 7, 12); else keyCap(ctx, { cross: 'K', circle: 'L', square: 'J', triangle: 'I' }[btn], x + 14, y - 7, 22);
      vText(ctx, label, x + 34, y, 20, { color: '#ffffff', weight: 0.2 });
      x += widths[i];
    });
  }

  // ================================================================ play calling
  beginCalls() {
    const m = this.m;
    const n = m.callNeeds();
    if (!n) return;
    let cpu = {};
    try { cpu = cpuCalls(m); } catch (e) { console.error(e); }
    // a drill can make the call itself (the field goal ladder) or fix the scout team's (kick returns)
    const dc = this.drill?.calls(m, cpu);
    if (dc?.skipBand) {
      this.calls = { kind: n.kind, off: dc.off, def: dc.def, flip: false, pat: null, t: 0, need: n };
      this.wbs = [];
      this.hud.hideFlag();
      return;
    }
    if (dc?.off) cpu = { ...cpu, off: dc.off };
    const C = { kind: n.kind, off: null, def: null, flip: !!cpu.flip, pat: null, t: 0, need: n };
    const lockQB = m.lock && m.lock.side === n.off && m.lock.player.pos === 'QB';
    const hOff = m.isUser(n.off) && (!m.lock || (lockQB && n.kind !== 'kickoff' && n.kind !== 'pat')), hDef = m.isUser(n.def) && !m.lock;
    const both = hOff && hDef;
    const areas = both ? [{ x: 22, y: 140, w: 478, h: 392 }, { x: 524, y: 140, w: 478, h: 392 }] : [{ x: 132, y: 112, w: 760, h: 476 }];
    const wbs = [];
    const lbl = (side, s) => (both ? `P${this.users[side] + 1} · ${s}` : null);
    const wbx = { clock: this.drill && this.drill.id !== 'twominute' ? 'PRACTICE' : null };
    if (n.kind === 'kickoff') {
      if (hOff) wbs.push(new Wristband({ ...wbx, m, side: n.off, kind: 'kickoff', player: this.plFor(n.off), area: areas[0], label: lbl(n.off, 'KICKOFF') }));
      else C.off = cpu.off;
      if (hDef) wbs.push(new Wristband({ ...wbx, m, side: n.def, kind: 'return', player: this.plFor(n.def), area: areas[both ? 1 : 0], label: lbl(n.def, 'RECEIVE') }));
      else C.def = cpu.def;
    } else if (n.kind === 'pat') {
      if (hOff) wbs.push(new Wristband({ ...wbx, m, side: n.off, kind: 'pat', player: this.plFor(n.off), area: areas[0] }));
      else C.pat = cpu.pat || 'kick';
      C.def = 'none';
    } else {
      if (hOff) wbs.push(new Wristband({ ...wbx, m, side: n.off, kind: n.kind === 'two' ? 'two' : 'offense', player: this.plFor(n.off), area: areas[0], label: lbl(n.off, 'OFFENSE') }));
      else C.off = cpu.off;
      if (hDef) {
        const off = hOff ? null : C.off;
        const spec = off && (off.startsWith('pt_') || off.startsWith('fg_'));
        wbs.push(new Wristband({ ...wbx, m, side: n.def, kind: spec ? 'specialDef' : 'defense', player: this.plFor(n.def), area: areas[both ? 1 : 0], offCall: off, label: lbl(n.def, 'DEFENSE') }));
      } else C.def = hOff ? null : cpu.def;
    }
    this.calls = C;
    this.wbs = wbs;
    this.hud.hideFlag();
    try { music.play('playcall', { fade: 1.2 }); } catch { /* */ }
    if (C.kind === 'scrimmage' && this.playsRun) this.sound.betweenPlays();
  }

  updateCalls(dt) {
    const m = this.m;
    if (!this.calls) { this.ff = this.ffMode(); this.beginCalls(); }
    const C = this.calls;
    if (!C) return;
    C.t += dt;
    // replay of the last play from the huddle
    if (input.p1.pressed('create') && this.tape.last && !this.wbs.some((w) => w.done)) { this.openReplay(false); return; }
    for (const wb of this.wbs) {
      const r = wb.update(dt);
      if (r && !wb.applied) {
        wb.applied = true;
        wb.doneAt = wb.t;
        if (wb.kind === 'pat') C.pat = r.id;
        else if (wb.kind === 'kickoff' || wb.kind === 'offense' || wb.kind === 'two') { C.off = r.id; C.flip = r.flip; }
        else C.def = r.id;
      }
    }
    // timeouts from the huddle
    for (const side of this.humanSides()) {
      const pl = this.plFor(side);
      if (pl.pressed('touch') && m.phase === 'playcall') { if (!m.callTimeout(side)) this.hud.toast(m.timeouts[side] > 0 ? 'NOT NOW' : 'NO TIMEOUTS LEFT'); }
    }
    const allIn = this.wbs.every((w) => w.applied && w.t - w.doneAt > 0.5);
    const minT = this.wbs.length || this.ffMode() ? 0 : C.kind === 'kickoff' ? 1.0 : 1.6;
    if (!allIn || C.t < minT) return;
    // make the call
    try {
      if (C.kind === 'pat') m.choosePat(C.pat === 'two' ? 'two' : 'kick');
      else if (C.kind === 'kickoff') m.callKickoff(C.off, C.def);
      else {
        if (!C.def) C.def = cpuDefenseFor(m, C.off);
        const offSpecial = C.off.startsWith('pt_') || C.off.startsWith('fg_');
        const defSpecial = C.def.startsWith('pr_') || C.def.startsWith('fgd_');
        if (offSpecial && !defSpecial) C.def = specialDefenseFor(m, C.off) || (C.off.startsWith('fg_') ? 'fgd_block' : 'pr_return');
        if (!offSpecial && defSpecial) C.def = cpuDefenseFor(m, C.off);
        m.callPlays(C.off, C.def, { flip: C.flip });
      }
    } catch (e) { console.error('call failed', e); m.callPlays('sp_slants', 'c3'); }
    this.calls = null;
    this.wbs = [];
    if (m.phase === 'presnap') this.beginPresnap();
  }

  // ================================================================ huddle + walk-in visuals
  huddleSpots() {
    const m = this.m;
    const out = new Map();
    if (m.playKind === 'kickoff' && m.phase !== 'playcall' && m.phase !== 'pat') return out;
    const dir = m.offDir || 1;
    const F = m.field;
    const hx = clamp(m.ballX, -F.halfW + 6, F.halfW - 6);
    const hz = clamp(m.los - dir * 7.5, -F.end + 2, F.end - 2);
    const off = this.frame.ents.filter((e) => e.side === m.offSide);
    const def = this.frame.ents.filter((e) => e.side !== m.offSide);
    off.forEach((e, i) => {
      // a horseshoe, the QB at the open end facing his men
      if (e.role === 'QB' || (i === 0 && !off.some((o) => o.role === 'QB'))) {
        out.set(e.id, { x: hx, z: hz + dir * 1.5, h: Math.atan2(0, -dir), base: 'stand', act: null });
        return;
      }
      const k = off.length > 1 ? i / (off.length - 1) : 0.5;
      const a = -Math.PI * 0.85 + k * Math.PI * 1.7;
      const x = hx + Math.sin(a) * 1.5, z = hz - dir * Math.cos(a) * 1.1;
      out.set(e.id, { x, z, h: Math.atan2(hx - x, hz + dir * 0.4 - z), base: 'huddle', act: null });
    });
    const dz = clamp(m.los + dir * 5.5, -F.end + 2, F.end - 2);
    def.forEach((e, i) => {
      const a = (i / Math.max(1, def.length)) * Math.PI * 2;
      const x = clamp(hx * 0.6 + Math.sin(a) * 2.3, -F.halfW + 2, F.halfW - 2), z = dz + Math.cos(a) * 1.6;
      out.set(e.id, { x, z, h: Math.atan2(hx * 0.6 - x, dz - z), base: i % 3 === 0 ? 'hips' : 'huddle', act: null });
    });
    return out;
  }

  beginPresnap() {
    const m = this.m;
    // everybody walks from where we last showed them to his spot
    const from = new Map();
    const huddle = this.override || null;
    for (const f of this.frame.ents) {
      const h = huddle?.get(f.id);
      from.set(f.id, h ? { x: h.x, z: h.z } : { x: f.x, z: f.z });
    }
    const list = [];
    let longest = 0;
    for (const e of m.active) {
      let s = from.get(e.id);
      if (!s) {
        // a sub coming on: from his sideline
        const sx = (e.side === 'home' ? -1 : 1) * (m.field.halfW + 3);
        s = { x: sx, z: e.z };
      }
      let dx = e.x - s.x, dz = e.z - s.z;
      let d = Math.hypot(dx, dz);
      if (d > 14) { s = { x: e.x - dx / d * 14, z: e.z - dz / d * 14 }; dx = e.x - s.x; dz = e.z - s.z; d = 14; }
      list.push({ e, x: s.x, z: s.z, d });
      longest = Math.max(longest, d);
    }
    const kick = m.playKind === 'kickoff';
    this.ff = this.ffMode();
    this.walk = kick || longest < 0.5 || this.ff ? null : { t: 0, dur: clamp(longest / 5.2, 0.8, 2.6), list };
    this.override = null;
    this.playClock = kick || (this.drill && this.drill.id !== 'twominute') ? null : 25;
    this.presnaps = {};
    // the pre-snap tools are the quarterback's and the defensive play-caller's; a
    // career man who isn't the QB just lines up and waits for the snap
    for (const side of this.humanSides()) {
      if (m.lock && m.lock.side === side && !(side === m.offSide && m.userSnaps())) continue;
      this.presnaps[side] = new Presnap(m, side, this.plFor(side));
    }
    // the kick meter for a person kicking
    this.kick = null;
    const kickSide = m.offSide;
    const kicking = m.playKind === 'kickoff' || m.playKind === 'fg' || m.playKind === 'punt';
    if (kicking && m.isUser(kickSide) && !m.lock) {
      const kind = m.playKind === 'kickoff' ? 'kickoff' : m.playKind === 'punt' ? 'punt' : m.tryMode === 'pat' ? 'pat' : 'fg';
      this.kick = { side: kickSide, meter: new KickMeter(kind), kind };
    }
    this.viewDir = this.desiredViewDir();
    this.cam.cut();
    this.officials.place();
    this.tape.start();
    this.walkIdle = 0;
    const f = captureFrame(m, this.officials.snapshot());
    this.frame = f;
  }

  stepWalk(dt) {
    const W = this.walk;
    W.t += dt;
    const k = clamp(W.t / W.dur, 0, 1);
    const ov = new Map();
    for (const w of W.list) {
      const e = w.e;
      // each man goes at a jog and gets there when he gets there
      const go = Math.min(1, (W.t * 5.2) / Math.max(0.01, w.d));
      if (go >= 1) continue;
      const x = w.x + (e.x - w.x) * go, z = w.z + (e.z - w.z) * go;
      const dx = e.x - w.x, dz = e.z - w.z;
      ov.set(e.id, { x, z, h: Math.atan2(dx, dz), base: 'stand', vx: dx / Math.max(0.01, w.d) * 5.2, vz: dz / Math.max(0.01, w.d) * 5.2, ws: 0.45 });
    }
    this.override = ov;
    const skip = this.humanSides().some((s) => this.plFor(s).pressed('cross'));
    if (k >= 1 || skip) { this.walk = null; this.override = null; }
  }

  // ================================================================ pre-snap
  updatePresnap(dt) {
    const m = this.m;
    if (this.walk) {
      this.stepWalk(dt);
      this.frame = captureFrame(m, this.officials.snapshot());
      return;
    }
    // the play clock (a person on offense can run it out)
    if (this.playClock !== null) {
      this.playClock -= dt;
      if (this.playClock <= 0 && m.isUser(m.offSide) && !this.kick && !m.snapArmed) { RULES.delayOfGame(m); this.playClock = null; return; }
    }
    const camRight = { x: -(this.cam.look.z - this.cam.pos.z), z: this.cam.look.x - this.cam.pos.x };
    const cl = Math.hypot(camRight.x, camRight.z) || 1;
    camRight.x /= cl; camRight.z /= cl;
    for (const side of this.humanSides()) {
      const ps = this.presnaps[side];
      if (!ps || this.ff) { if (!this.ff) m.cmd[side] = buildCmd(this.plFor(side), this.cam, {}); continue; }
      ps.camRight = camRight;
      const evs = ps.update(dt);
      for (const ev of evs) {
        if (ev.type === 'snap') { this.eat[side] = new Set(ps.eat); m.snap(); }
        if (ev.type === 'toast') this.hud.toast(ev.text);
        if (ev.type === 'timeout') this.playClock = 25;
      }
      if (m.phase !== 'presnap') break;
      m.cmd[side] = buildCmd(this.plFor(side), this.cam, { eat: ps.eat });
    }
    // the kick meter
    if (this.kick && m.phase === 'presnap') {
      const r = this.kick.meter.update(dt, this.plFor(this.kick.side));
      if (r) {
        m.kickParams = { ...(m.kickParams || {}), [this.kick.side]: r };
        this.eat[this.kick.side] = new Set(['cross']);
        m.snap();
      }
      // aim arrow on the field
    }
    this.stepSim(dt);
  }

  // ================================================================ the live play
  updateLive(dt) {
    const m = this.m;
    for (const side of this.humanSides()) {
      m.cmd[side] = buildCmd(this.plFor(side), this.cam, { eat: this.eat[side] });
      this.eat[side] = null;
    }
    this.stepSim(dt);
  }

  stepSim(dt) {
    const m = this.m;
    const speed = this.ff ? 9 : 1;
    this.acc = Math.min(this.acc + dt * speed, STEP * 8 * speed);
    while (this.acc >= STEP - 1e-6) {
      this.acc -= STEP;
      const prev = m.phase;
      m.step(STEP);
      if (m.phase === 'live' || m.phase === 'post') this.officials.update(STEP);
      if (prev === 'live' && m.phase === 'post') this.onWhistle();
      const f = captureFrame(m, this.officials.snapshot());
      f.flags = this.officials.flags.map((x) => ({ ...x }));
      this.frame = f;
      if (m.phase === 'live' || m.phase === 'post') this.tape.push(f);
      if (prev === 'post' && m.phase !== 'post') { this.onAdvance(prev); break; }
      if (m.phase !== 'live' && m.phase !== 'post' && m.phase !== 'presnap') break;
      if (this.stage !== 'game') break;
    }
  }

  onSnap() {
    this.drill?.onSnap(this.m);
    this.tape.push(this.frame);
    this.playClock = null;
    this.snapT = this.t;
    this.cam.shake(0.05);
  }

  onWhistle() {
    const m = this.m, r = m.result;
    this.playsRun = (this.playsRun || 0) + 1;
    this.post = { t: 0, r, cut: false, replay: false, replayed: false, card: false, celebrated: false };
    if (!r) return;
    const offTeam = m.teams[m.offSide];
    const scorer = r.e;
    const runOrPass = !m.tryMode && !['kickoff', 'fg', 'punt'].includes(m.playKind);
    if (r.type === 'td' || r.type === 'twoGood') {
      const t = m.teams[r.side];
      this.hud.banner(r.type === 'td' ? 'TOUCHDOWN' : 'TWO POINTS', { color: t.colors.primary, team: t, big: true, kind: 'result', dur: 3.2 });
      this.celebrate(r.side, scorer);
      this.post.replay = r.type === 'td';
    } else if (r.sack) {
      this.hud.banner('SACK!', { color: '#c4101f', kind: 'result', dur: 1.6 });
    } else if (r.type === 'incomplete') {
      this.hud.banner('INCOMPLETE', { color: '#38383e', kind: 'result', dur: 1.4 });
    } else if (runOrPass && (r.type === 'tackle' || r.type === 'oob') && r.side === m.offSide) {
      const y = r.yards;
      this.hud.banner(y > 0 ? `GAIN OF ${y}` : y === 0 ? 'NO GAIN' : `LOSS OF ${-y}`, { color: y > 0 ? '#1f3f73' : '#5a1a22', kind: 'result', dur: 1.5 });
      if (y >= 22) this.post.replay = true;
    }
    if (r.side !== m.offSide && runOrPass) this.post.replay = true;   // a turnover
    if (m.flags.length) this.post.replay = false;
    // the player of the moment
    if (scorer && (r.type === 'td' || (r.yards >= 15 && r.side === m.offSide && runOrPass))) this.post.card = scorer;
    // practice keeps the reps moving: no broadcast replays, no player cards
    if (this.drill) { this.post.replay = false; this.post.card = false; }
    void offTeam;
  }

  /**
   * The lower-third for the man of the moment. The sim credits a play's yards
   * when the result is applied (after this card is up), so this play is added
   * by hand: "34 YD CATCH · TOUCHDOWN  ·  4 REC 71 YDS".
   */
  playerCard(e, r) {
    const m = this.m;
    const s = m.stats.players.get(e.id) || {};
    // this play's carries for him (yards along his way, never past the goal line)
    const half = m.field.halfL;
    const segs = (m.segments || []).filter((g) => g.e === e);
    const y = Math.round(segs.reduce((a, g) => a + Math.min(g.end ?? g.start, half) - g.start, 0));
    const kind = segs[0]?.kind || 'rush';
    const play = `${y} YD ${kind === 'rec' ? 'CATCH' : kind === 'return' ? 'RETURN' : 'RUN'}`;
    const tot = kind === 'rec' ? `${(s.rec || 0) + 1} REC · ${(s.recYds || 0) + y} YDS`
      : kind === 'rush' ? `${(s.car || 0) + 1} CAR · ${(s.rushYds || 0) + y} YDS` : null;
    const line = [r?.type === 'td' ? `${play} · TOUCHDOWN` : play, tot].filter(Boolean).join('  ·  ');
    return { name: `${e.p.first} ${e.p.last}`.toUpperCase(), number: e.p.number, pos: e.p.pos, team: m.teams[e.side], line, dur: 4 };
  }

  celebrate(side, scorer) {
    const m = this.m;
    const moves = ['celebrate_spike', 'celebrate_point', 'celebrate_flex', 'celebrate_dance', 'celebrate_jump', 'celebrate_salute'];
    const rng = makeRng(Math.floor(m.time * 1000));
    for (const e of m.active) {
      if (!e.standing && !e.onGround) continue;
      if (e === scorer) { if (!e.onGround) e.act(moves[Math.floor(rng() * moves.length)]); continue; }
      if (e.side === side) { if (rng() < 0.6 && !e.onGround) e.act(rng() < 0.5 ? 'celebrate_jump' : 'raise_roof'); } else if (rng() < 0.5 && !e.onGround) e.act('dejected');
    }
  }

  updatePost(dt) {
    const m = this.m, P = this.post;
    if (!P) { this.stepSim(dt); return; }
    P.t += dt;
    if (P.card && P.t > 1.1 && !P.cardShown) {
      P.cardShown = true;
      this.hud.showCard(this.playerCard(P.card, P.r));
    }
    if (this.ff) { this.stepSim(dt); return; }
    // the broadcast's own replay of the big ones
    if (P.replay && !P.replayed && P.t > 2.0 && this.tape.frames.length > 30) {
      P.replayed = true;
      this.openReplay(true);
      return;
    }
    // hold the result on screen a beat longer than the sim needs
    const minT = P.r?.type === 'td' ? 3.8 : 1.8;
    if (m.postT >= m.postDur - 0.03 && P.t < minT) return;
    this.stepSim(dt);
  }

  onAdvance() {
    const m = this.m;
    const r = this.post?.r;
    if (this.drill) this.drill.pending = r || m.result || { type: 'none', side: m.offSide, offense: m.offSide, z: m.los, yards: 0 };
    const label = r ? `${m.play?.name || ''}${r.type === 'td' ? ' · TOUCHDOWN' : r.yards ? ` · ${r.yards > 0 ? '+' : ''}${r.yards} YDS` : ''}` : '';
    this.tape.close(label);
    this.post = null;
    this.flagUp = false;
    this.override = null;
    this.viewDir = this.desiredViewDir();
    for (const s of ['home', 'away']) m.cmd[s] = null;
  }

  // ================================================================ penalties, breaks, the end
  updatePenalty(dt) {
    const m = this.m;
    const P = m.pendingPenalty;
    if (!P) { RULES.choosePenalty(m, true); return; }
    const pl = this.plFor(P.beneficiary);
    if (!this.penT) this.penT = 0;
    this.penT += dt;
    if (this.penT < 0.6) return;
    if (pl.pressed('cross')) { this.penT = 0; RULES.choosePenalty(m, true); }
    else if (pl.pressed('circle')) { this.penT = 0; RULES.choosePenalty(m, false); }
  }

  drawPenalty(ctx) {
    const m = this.m;
    const P = m.pendingPenalty;
    if (!P) return;
    const f = P.flag;
    const x = 262, y = 230, w = 500;
    glossBar(ctx, x, y, w, 40, '#ffe85a', '#d9a200');
    vText(ctx, 'FLAG ON THE PLAY', x + 16, y + 29, 22, { color: '#1a1400', weight: 0.22 });
    glossBar(ctx, x, y + 40, w, 170, '#1f2737', '#070a12');
    vText(ctx, `${f.name}`.toUpperCase(), x + 18, y + 78, 22, { color: '#ffffff', weight: 0.2 });
    text(ctx, `ON ${m.teams[f.on].name.toUpperCase()} · ${Math.round(P.preview?.yards ?? f.yards)} YARDS`, x + 18, y + 102, { size: 15, weight: 800, color: '#ffd23a', spacing: 1 });
    const r = P.play;
    const playTxt = r.type === 'incomplete' ? 'INCOMPLETE PASS' : r.type === 'td' ? 'TOUCHDOWN' : r.side !== r.offense ? 'TURNOVER' : `${r.yards >= 0 ? 'GAIN' : 'LOSS'} OF ${Math.abs(r.yards)}`;
    text(ctx, `THE PLAY: ${playTxt}`, x + 18, y + 128, { size: 14, weight: 700, color: '#cfd7e6', spacing: 1 });
    text(ctx, `${m.teams[P.beneficiary].abbr}, YOUR CALL${P.better ? ' (COACH SAYS ACCEPT)' : ' (COACH SAYS DECLINE)'}`, x + 18, y + 152, { size: 13, weight: 800, color: '#8fd0ff', spacing: 1 });
    let bx = x + 18;
    for (const [btn, lbl, rec] of [['cross', 'ACCEPT', P.better], ['circle', 'DECLINE', !P.better]]) {
      if (usingPad()) padGlyph(ctx, btn, bx + 12, y + 186, 11); else keyCap(ctx, btn === 'cross' ? 'K' : 'L', bx + 12, y + 186, 20);
      vText(ctx, lbl, bx + 30, y + 193, 18, { color: rec ? '#ffd23a' : '#ffffff', weight: 0.2 });
      bx += 190;
    }
  }

  updateBreak(dt) {
    const m = this.m;
    this.breakT = (this.breakT || 0) + dt;
    if (m.phase === 'final' && !this.recorded) {
      this.recorded = true;
      try { recordGame(m, this.players, { mode: this.mode }); } catch (e) { console.warn(e); }
    }
    const any = this.players.length ? this.players.some((s) => this.plFor(s).pressed('cross')) : this.breakT > 6;
    if (m.phase === 'halftime') {
      if (any && this.breakT > 1) { this.breakT = 0; RULES.resumeAfterBreak(m); this.cam.cut(); }
    } else if (m.phase === 'final') {
      if (any && this.breakT > 2) {
        this.breakT = 0;
        const result = { score: { ...m.score }, stats: m.stats, home: m.teams.home.id, away: m.teams.away.id, pog: playerOfGame(m), label: this.params.gameLabel };
        if (this.onDone) this.onDone(result);
        else go(this.params.returnTo || 'huddle', { from: 'match', result });
      }
    }
  }

  // ================================================================ replay + pause
  openReplay(auto) {
    const tape = this.tape.last || (this.tape.frames.length > 30 ? { frames: this.tape.frames.slice(), label: '' } : null);
    if (!tape) { this.hud.toast('NO REPLAY YET'); return; }
    this.viewer = new ReplayViewer(tape, { auto });
    this.prevStage = this.stage === 'pause' ? this.pause.prev : this.stage;
    this.pause = null;
    this.setStage('replay');
    this.cam.cut();
    game.fx.staticAmt = 0.6;
    setTimeout(() => { game.fx.staticAmt = 0; }, 160);
    try { if (!auto) music.setPA?.(null); } catch { /* */ }
  }

  updateReplay(dt) {
    const v = this.viewer;
    const res = v.update(dt, input.p1);
    this.frame = v.frame();
    if (res === 'exit') {
      this.viewer = null;
      this.setStage(this.prevStage || 'game');
      this.prevStage = null;
      this.cam.cut();
      // back to the live picture: re-capture the sim's present
      this.frame = captureFrame(this.m, this.officials.snapshot());
    }
  }

  canPause() { return this.stage === 'game' || this.stage === 'toss'; }

  openPause() {
    const self = this;
    const D = this.drill;
    const items = [
      { label: 'RESUME', type: 'action', id: 'resume' },
      { label: 'INSTANT REPLAY', type: 'action', id: 'replay', disabled: !this.tape.last },
      { label: 'CAMERA', type: 'choice', options: GAME_CAMS.map((c) => ({ label: GAME_CAM_NAMES[c], value: c })), get: () => self.camMode, set: (v) => { self.camMode = v; settings.set('camera', v); self.cam.cut(); } },
      { label: D ? 'COACH CAPTIONS' : 'CLOSED CAPTIONS', type: 'toggle', get: () => self.captions, set: (v) => { self.captions = v; settings.set('captions', v); } },
      D ? null : { label: 'GAME STATS', type: 'action', id: 'stats' },
      { label: 'CONTROLS', type: 'action', id: 'controls' },
      D && D.id !== 'twominute' ? null : { label: 'CALL TIMEOUT', type: 'action', id: 'timeout', disabled: !this.userSide || this.m.phase === 'live' || this.m.timeouts[this.userSide] <= 0 || !!this.m.lock },
      D ? { label: 'RESTART DRILL', type: 'action', id: 'restart', disabled: this.m.phase === 'live' || this.m.phase === 'post' || this.m.phase === 'penalty' }
        : { label: 'SIM TO THE FINAL', type: 'action', id: 'simall' },
      { label: D ? 'END PRACTICE' : this.mode === 'career' ? 'QUIT TO THE HUB' : 'QUIT GAME', type: 'action', id: 'quit' },
    ].filter(Boolean);
    this.pause = { prev: this.stage, menu: new Menu(items), sub: null, confirm: false };
    this.setStage('pause');
    uiSound('select');
    try { music.setPA?.(0); } catch { /* */ }
  }

  updatePause(dt) {
    const P = this.pause;
    if (P.sub) {
      if (input.pressed('back') || input.pressed('confirm') || input.pressed('pause')) { P.sub = null; uiSound('back'); }
      return;
    }
    if (P.confirm) {
      if (input.pressed('confirm')) { go(this.params.returnTo || 'huddle', { from: 'match' }); return; }
      if (input.pressed('back')) { P.confirm = false; uiSound('back'); }
      return;
    }
    if (input.pressed('pause') || input.pressed('back')) { this.setStage(P.prev); this.pause = null; uiSound('back'); try { music.setPA?.(null); } catch { /* */ } return; }
    const it = P.menu.update(dt);
    if (!it) return;
    switch (it.id) {
      case 'resume': this.setStage(P.prev); this.pause = null; break;
      case 'replay': this.openReplay(false); break;
      case 'stats': P.sub = 'stats'; break;
      case 'controls': P.sub = 'controls'; break;
      case 'timeout': if (this.m.callTimeout(this.userSide)) { this.setStage(P.prev); this.pause = null; } break;
      case 'quit': P.confirm = true; break;
      case 'simall': this.simToFinal(); break;
      case 'restart': this.setStage(P.prev); this.pause = null; this.restartDrill(); break;
      default: break;
    }
  }

  /** Play the rest of the game out headless (the CPU on both sides) and go to the final. */
  simToFinal() {
    const m = this.m;
    m.users = { home: null, away: null };
    for (const side of ['home', 'away']) { m.cmd[side] = null; if (m.userEnt[side]) m.userEnt[side].ctrl = null; m.userEnt[side] = null; }
    m.lock = null;
    m.autoCalls = true;
    this.calls = null; this.wbs = []; this.walk = null; this.override = null; this.kick = null; this.post = null;
    if (m.phase === 'presnap') m.snap();
    let n = 0;
    while (m.phase !== 'final' && n++ < 60 * 60 * 90) {
      m.step(STEP);
      if (m.phase === 'penalty') RULES.choosePenalty(m, true);
      if (m.phase === 'halftime') RULES.resumeAfterBreak(m);
    }
    this.pause = null;
    this.setStage('game');
    this.frame = captureFrame(m, this.officials.snapshot());
    this.cam.cut();
  }

  drawPause(ctx) {
    const P = this.pause;
    ctx.fillStyle = 'rgba(2,4,8,0.62)';
    ctx.fillRect(0, 0, 1024, 768);
    if (P.sub === 'stats') { drawBoxScore(ctx, this.m, { title: 'GAME STATS' }); hints(ctx, [['back', 'BACK']]); return; }
    if (P.sub === 'controls') { this.drawControls(ctx); hints(ctx, [['back', 'BACK']]); return; }
    panel(ctx, 300, 150, 424, 162 + P.menu.items.length * 40, { accentLen: 260 });
    vText(ctx, 'PAUSED', 340, 206, 34, { color: '#ffffff', weight: 0.2 });
    const m = this.m;
    const sc = m.scoreShown();
    const sub = this.drill && this.drill.id !== 'twominute' ? `PRACTICE  ·  ${this.drill.name}` : `${m.teams.away.abbr} ${sc.away}  ·  ${m.teams.home.abbr} ${sc.home}  ·  ${quarterText(m)} ${fmtClock(m.clock)}`;
    text(ctx, sub, 342, 234, { size: 14, weight: 800, color: C.dim, spacing: 1 });
    P.menu.draw(ctx, 352, 286, 340, { rowH: 40, size: 20 });
    if (P.confirm) {
      panel(ctx, 312, 330, 400, 120, { accent: C.red });
      vText(ctx, this.drill ? 'END PRACTICE?' : 'QUIT THIS GAME?', 512, 380, 24, { align: 'center', color: '#fff', weight: 0.2 });
      text(ctx, this.drill ? 'BACK TO THE PRACTICE FIELD' : 'THE GAME WILL NOT BE SAVED', 512, 410, { size: 13, weight: 800, color: C.dim, align: 'center', spacing: 2 });
      hints(ctx, [['confirm', 'QUIT'], ['back', 'CANCEL']]);
      return;
    }
    hints(ctx, [['confirm', 'SELECT'], ['lr', 'CHANGE'], ['back', 'RESUME']]);
  }

  drawControls(ctx) {
    panel(ctx, 112, 96, 800, 560, { accentLen: 300 });
    vText(ctx, 'CONTROLS', 150, 148, 30, { color: '#fff', weight: 0.2 });
    const cols = [
      ['PRE-SNAP (OFFENSE)', [['cross', 'SNAP'], ['square', 'HARD COUNT'], ['triangle', 'AUDIBLE'], ['r1', 'HOT ROUTE'], ['l1', 'MOTION'], ['touch', 'TIMEOUT'], ['create', 'INSTANT REPLAY']]],
      ['PASSING', [['cross', 'THROW TO ✕'], ['circle', 'THROW TO ◯'], ['square', 'THROW TO □'], ['triangle', 'THROW TO △'], ['l1', 'PUMP FAKE'], ['r3', 'THROW AWAY'], ['l2', 'LEAD THE THROW (HOLD)']]],
      ['BALL CARRIER', [['r2', 'SPRINT'], ['square', 'STIFF ARM'], ['circle', 'SPIN'], ['triangle', 'HURDLE'], ['cross', 'DIVE'], ['l1', 'LATERAL'], ['r1', 'PROTECT BALL'], ['rstick', 'JUKE / TRUCK / SPIN']]],
      ['DEFENSE', [['circle', 'SWITCH PLAYER'], ['cross', 'DIVE TACKLE'], ['square', 'STRIP'], ['triangle', 'JUMP / SWAT'], ['rstick', 'HIT STICK ↑ / CUT ↓'], ['r2', 'SPRINT']]],
    ];
    cols.forEach(([title, list], i) => {
      const x = 150 + (i % 2) * 380, y = 196 + Math.floor(i / 2) * 230;
      text(ctx, title, x, y, { size: 14, weight: 900, color: C.accent, spacing: 2 });
      list.forEach(([b, l], k) => {
        const yy = y + 28 + k * 25;
        if (usingPad()) padGlyph(ctx, { r1: 'R1', l1: 'L1', r2: 'R2', l2: 'L2', r3: 'R3', create: 'CREATE', touch: 'TOUCHPAD', rstick: 'rstick' }[b] || b, x + 12, yy - 5, 10);
        else keyCap(ctx, { cross: 'K', circle: 'L', square: 'J', triangle: 'I', l1: 'Q', r1: 'E', l2: 'Z', r2: 'SHIFT', r3: 'V', create: 'R', touch: 'T', rstick: 'ARROWS' }[b] || b, x + 14, yy - 5, 18);
        text(ctx, l, x + 44, yy, { size: 14, weight: 700, color: '#e6ebf5' });
      });
    });
    text(ctx, 'MOVE: LEFT STICK (WASD)', 150, 640, { size: 13, weight: 800, color: C.dim, spacing: 1 });
  }

  // ================================================================ the frame
  update(dt, busy) {
    if (!this.m || !this.world?.ready) return;
    const m = this.m;
    this.t += dt;
    this.stageT += dt;
    if (busy) { this.drawWorld(dt); return; }
    if (!this.soundsWarm) this.warmSounds();
    // (the press that opens the pause menu mustn't also close it this frame)
    const pausing = (input.p1.pressed('options') || input.p2.pressed('options')) && this.canPause();
    if (pausing) this.openPause();
    else switch (this.stage) {
      case 'intro':
        if (this.stageT > 7.5 || input.p1.pressed('cross') || input.pressed('confirm')) { this.beginToss(); this.cam.cut(); }
        break;
      case 'toss': this.updateToss(dt); break;
      case 'game': this.updateGame(dt); break;
      case 'replay': this.updateReplay(dt); break;
      case 'pause': this.updatePause(dt); break;
      default: break;
    }
    if (this.ff !== this._ffWas) { game.fx.interference = this.ff ? 0.1 : 0; this._ffWas = this.ff; }
    this.hud.update(dt, m);
    this.booth.enabled = this.captions && !this.ff && !this.drill;
    this.booth.update(dt);
    this.sound.update(dt, { userSide: this.userSide });
    this.updateCamera(dt);
    this.drawWorld(dt);
  }

  updateGame(dt) {
    const m = this.m;
    if (this.drill && this.updateDrill(dt)) return;
    switch (m.phase) {
      case 'kickoff': case 'playcall': case 'pat':
        if (!this.calls) { this.override = this.huddleSpots(); this.frame = captureFrame(m, this.officials.snapshot()); }
        this.updateCalls(dt);
        if (this.calls) this.override = this.huddleSpots();
        break;
      case 'presnap': this.updatePresnap(dt); break;
      case 'live': this.updateLive(dt); break;
      case 'post': this.updatePost(dt); break;
      case 'penalty': this.updatePenalty(dt); break;
      case 'halftime': case 'final': this.updateBreak(dt); break;
      case 'pregame': m.start({ kicking: 'away' }); break;
      default: break;
    }
  }

  // ================================================================ practice
  /** The drill's turn in the loop. True when it took the frame (the drill is over). */
  updateDrill(dt) {
    const m = this.m, D = this.drill;
    D.t += dt;
    if (D.over) {
      if (D.t < 0.8) return true;
      if (input.pressed('confirm')) { uiSound('select'); this.restartDrill(); } else if (input.pressed('back')) { uiSound('back'); go(this.params.returnTo || 'practice'); }
      return true;
    }
    // the play's result is in and the sim has moved on: write it down, put the ball back
    if (D.pending && !['post', 'penalty', 'live', 'presnap'].includes(m.phase)) {
      D.settle(m, (line) => this.hud.caption(`COACH: ${line}`));
      this.calls = null; this.wbs = [];
      if (D.over) return true;
    }
    if (m.phase === 'final' || m.phase === 'halftime') { D.timeUp(m); D.t = 0; return true; }
    return false;
  }

  /** Start the drill over from its first rep. */
  restartDrill() {
    const m = this.m;
    const id = this.drill.id;
    try { this.drill.saveBest(); } catch { /* */ }
    this.drill = new Drill(id, 'home');
    this.calls = null; this.wbs = []; this.walk = null; this.override = null; this.kick = null; this.post = null; this.presnaps = {};
    m.cmd.home = null; m.cmd.away = null;
    this.drill.start(m);
    this.frame = captureFrame(m, this.officials.snapshot());
    this.viewDir = this.desiredViewDir();
    this.cam.cut();
  }

  drawWorld(dt) {
    const m = this.m;
    if (!this.frame) return;
    const users = {};
    for (const side of this.humanSides()) users[side] = m.userEnt[side]?.id || null;
    const showRing = this.stage === 'game' && (m.phase === 'presnap' || m.phase === 'live') && !this.walk;
    let aim = null;
    if (this.kick && m.phase === 'presnap' && !this.walk && this.kick.meter.state === 'aim') {
      const dir = m.offDir;
      const k = this.kick.kind;
      const fromZ = k === 'kickoff' ? m.los : m.los - dir * (k === 'punt' ? 10 : 7);
      const len = k === 'punt' ? 18 : k === 'kickoff' ? 22 : Math.min(30, m.field.end - fromZ * dir);
      aim = { show: true, x: m.ballX, z: fromZ, angle: Math.atan2(this.kick.meter.aimX / Math.max(8, len), dir), length: len };
    }
    this.world.draw(this.frame, dt, {
      camera: this.cam.camera,
      users: showRing ? users : {},
      override: this.stage === 'replay' ? null : this.override,
      flags: this.frame.flags || this.officials.flags,
      aim,
    });
    // the line of scrimmage and the line to gain
    const show = this.stage === 'game' && (m.phase === 'presnap' || m.phase === 'live' || m.phase === 'playcall') && m.playKind !== 'kickoff' && !m.tryMode;
    const fd = m.goalToGo ? null : m.firstDownZ;
    try {
      this.world.venue.setMarkers({ los: m.los, firstDown: fd, dir: m.offDir, show, ballX: m.ballX, camera: this.cam.camera });
      if (!this._sbT || this.t - this._sbT > 0.5) {
        this._sbT = this.t;
        // the boards in the stadium (gfx/stadium/scoreboard.js state)
        const td = this.post?.r && (this.post.r.type === 'td' || this.post.r.type === 'twoGood') && m.phase === 'post';
        const sc = m.scoreShown();
        this.world.venue.setScoreboard({
          home: { abbr: m.teams.home.abbr, score: sc.home, timeouts: m.timeouts.home },
          away: { abbr: m.teams.away.abbr, score: sc.away, timeouts: m.timeouts.away },
          quarter: m.quarter, clock: `${Math.floor(Math.ceil(Math.max(0, m.clock)) / 60)}:${String(Math.ceil(Math.max(0, m.clock)) % 60).padStart(2, '0')}`,
          playClock: m.phase === 'presnap' && this.playClock !== null ? Math.ceil(Math.max(0, this.playClock)) : '',
          down: m.tryMode || (m.playKind === 'kickoff' && m.phase !== 'playcall') || m.phase === 'kickoff' ? 0 : m.down,
          toGo: m.goalToGo ? 0 : Math.round(m.toGo), possession: m.possession,
          ballOn: m.field.spotText(m.los, m.offDir),
          msg: td ? 'TOUCHDOWN' : m.phase === 'final' ? 'FINAL' : null,
        });
      }
      const b = this.frame.ball;
      this.world.venue.focusShadow?.(b.x * 0.6, b.z, 34);
      this.world.venue.update(dt, { camera: this.cam.camera, excitement: this.sound.excite, homeHasBall: m.possession === 'home', ball: b, time: this.t });
    } catch (e) { /* the venue is decoration */ }
  }

  updateCamera(dt) {
    const m = this.m, f = this.frame;
    const s = { offDir: m.offDir || 1, viewDir: this.viewDir, ballX: m.ballX, los: m.los, kind: m.playKind, live: m.phase === 'live' };
    // the focus: the man with the ball, else the ball
    const ballFocus = () => {
      const b = f.ball;
      if (b.car) { const e = f.ents.find((x) => x.id === b.car); if (e) return { x: e.x, y: 1, z: e.z, vx: e.vx, vz: e.vz }; }
      return { x: b.x, y: Math.max(0.6, b.y), z: b.z, vx: b.vx, vz: b.vz };
    };
    const board = this.world.venue?.cams?.scoreboard;
    if (this.stage === 'game' && (m.phase === 'halftime' || m.phase === 'final') && board && !this.drill) {
      // the break: up at the stadium's scoreboard (it has the score, and FINAL)
      s.shot = 'fixed'; s.pos = board.pos; s.target = board.target; s.fov = 44;
    } else if (this.stage === 'intro' || (this.stage === 'game' && (m.phase === 'halftime' || m.phase === 'final'))) {
      s.shot = 'flyover'; s.dur = 8;
    } else if (this.stage === 'toss') {
      s.shot = 'sideline'; s.focus = { x: 0, y: 1, z: 0 }; s.spread = 12;
    } else if (this.stage === 'replay') {
      const v = this.viewer;
      const fo = v.focusOf(f);
      s.shot = v.auto ? ['sideline', 'endzone', 'reverse', 'skycam', 'tracking', 'field'][v.cam] || 'endzone' : v.camName;
      s.focus = fo; s.vel = { x: fo.vx || 0, z: fo.vz || 0 }; s.spread = 16;
      s.freeTarget = fo;
      if (s.shot === 'free') {
        const pl = input.p1;
        this.cam.free.yaw += (pl.rx || 0) * dt * 2.2;
        this.cam.free.pitch = clamp(this.cam.free.pitch + (pl.ry || 0) * dt * 1.4, 0.05, 1.4);
      }
    } else if (this.stage === 'pause') {
      return;
    } else {
      // the game
      const phase = m.phase;
      if (phase === 'playcall' || phase === 'pat' || (phase === 'kickoff' && this.calls)) {
        const dir = m.offDir || 1;
        if (phase === 'kickoff') { s.shot = 'kickoff'; s.focus = { x: 0, y: 0, z: m.los }; s.viewDir = dir; }
        else {
          s.shot = 'closeup';
          s.target = { x: clamp(m.ballX, -m.field.halfW + 6, m.field.halfW - 6), z: m.los - dir * 7.5 };
          s.angle = (this.playsRun || 0) % 2 ? 2.3 : 0.7;
          s.dist = 10; s.fov = 34;
        }
      } else if (phase === 'post' && this.post && this.post.t > 0.75) {
        const r = this.post.r;
        const fo = ballFocus();
        if (r?.type === 'td' || r?.type === 'twoGood') { s.shot = 'celebrate'; s.target = fo; }
        else { s.shot = 'closeup'; s.target = fo; s.angle = fo.x > 0 ? -0.9 : 0.9; s.dist = 8.5; s.fov = 30; }
      } else if (phase === 'penalty') {
        const ref = this.officials.by('R');
        s.shot = 'closeup'; s.target = { x: ref.x, z: ref.z }; s.dist = 7; s.fov = 28;
      } else {
        const fo = ballFocus();
        s.focus = fo;
        s.vel = { x: fo.vx || 0, z: fo.vz || 0 };
        s.shot = this.camMode;
        // kickoffs: behind the kicker until somebody fields it
        if (m.playKind === 'kickoff' && !m.ball.carrier && (phase === 'presnap' || phase === 'live')) {
          const recvHuman = m.isUser(m.defSide) && !m.isUser(m.offSide);
          if (recvHuman) {
            const kr = m.defense.find((e) => e.asg?.type === 'returner') || m.defense[0];
            s.focus = m.ball.state === 'air' ? { x: (m.ball.x + kr.x) / 2, y: 1, z: (m.ball.z + kr.z) / 2 } : { x: kr.x, y: 1, z: kr.z };
            s.viewDir = m.dirOf(m.defSide);
          } else { s.shot = 'kickoff'; s.focus = phase === 'presnap' ? { x: m.ballX, y: 0, z: m.los } : { x: m.ball.x, y: 0, z: m.ball.z }; s.viewDir = m.offDir; }
        } else if (phase === 'presnap') {
          s.focus = { x: m.ballX, y: 0, z: m.los + this.viewDir * 2 };
        }
        // how wide the picture needs to be: the widest man on the side we're behind
        if (phase === 'presnap' || (phase === 'live' && m.playT < 2.5 && m.ball.carrier === m.qb)) {
          let w = 6;
          for (const e of m.active) if (Math.abs(e.z - m.los) < 12) w = Math.max(w, Math.abs(e.x - s.focus.x));
          s.spreadX = Math.min(w, 18);
        } else s.spreadX = 8;
        // a pass in the air: frame the throw and where it's going
        if (phase === 'live' && m.ball.state === 'air' && m.ball.kind === 'pass' && m.ball.targetPt) {
          const tp = m.ball.targetPt;
          s.focus = { x: (m.ball.x + tp.x) / 2, y: 1, z: (m.ball.z + tp.z) / 2 };
          s.deep = Math.abs(tp.z - m.los) > 15;
        }
        // possession changed hands mid-play: swing around behind the new runner's direction
        const want = m.ball.carrier && m.isUser(m.ball.carrier.side) && this.humanSides().length === 1 ? m.dirOf(m.ball.carrier.side) : this.viewDir;
        if (phase === 'live' && want !== this.viewDir && m.ball.carrier && m.ball.carrier.side !== m.offSide) { this.viewDir = want; this.cam.cut(); }
        s.viewDir = s.viewDir ?? this.viewDir;
        s.spread = 18;
      }
    }
    this.cam.update(dt, s);
  }

  // ================================================================ drawing
  draw(ctx, dt) {
    if (!this.m) return;
    const m = this.m;
    if (!this.world?.ready) {
      osd(ctx, 'LOADING', 512, 384, 30, '#d8ffd8', 'center');
      return;
    }
    switch (this.stage) {
      case 'intro': this.drawIntro(ctx); break;
      case 'toss': this.drawToss(ctx); this.hud.draw(ctx, dt, { m, hideBug: true }); break;
      case 'replay': this.viewer?.draw(ctx, this.t); if (this.viewer?.auto) this.hud.draw(ctx, dt, { m, icons: [] }); break;
      case 'pause': this.drawGameHud(ctx, dt); this.drawPause(ctx); break;
      default: this.drawGameHud(ctx, dt); break;
    }
  }

  receiverIcons() {
    const m = this.m;
    const out = [];
    const side = m.offSide;
    if (!m.isUser(side)) return out;
    const qb = m.qb;
    const passing = (m.phase === 'presnap' && !this.walk && !['kickoff', 'fg', 'punt'].includes(m.playKind)) ||
      (m.phase === 'live' && !KICK_KINDS.has(m.playKind) && qb && m.ball.carrier === qb && !m.handedOff && (m.los - qb.z) * m.offDir > -0.3 && m.userEnt[side] === qb);
    if (!passing) return out;
    const ps = this.presnaps[side];
    const pick = ps && (ps.mode === 'hot' || ps.mode === 'motion');
    for (const [btn, e] of Object.entries(m.icons[side] || {})) {
      if (!e || !e.standing) continue;
      const head = this.world.headOf(e.id);
      if (!head) continue;
      head.y += 0.62;
      const p = this.cam.project(head);
      if (!p) continue;
      let open;
      if (m.phase === 'live') {
        let nd = 9;
        for (const d of m.defense) if (d.standing) nd = Math.min(nd, Math.hypot(d.x - e.x, d.z - e.z));
        open = (nd - 2.2) / 3;
      }
      out.push({ btn, p: { x: p.x, y: p.y }, open, big: pick, alpha: m.phase === 'presnap' && !pick ? 0.85 : 1 });
    }
    return out;
  }

  drawGameHud(ctx, dt) {
    const m = this.m;
    const icons = this.stage === 'game' ? this.receiverIcons() : [];
    let callPanel = null;
    if (m.phase === 'presnap' && !this.walk) {
      const lines = [];
      for (const side of this.humanSides()) {
        if (side === m.offSide && m.play) lines.push({ text: `${m.tryMode === 'pat' ? 'EXTRA POINT' : m.play.name}${m.flip ? ' (FLIPPED)' : ''}`, color: '#ffd23a', size: 16 });
        else if (side === m.defSide && m.dplay) lines.push({ text: `${m.dplay.name}`, color: '#8fd0ff', size: 16 });
      }
      // on a kick the person's part is the kicker's leg, whoever they're holding the stick for
      const u = this.kick ? (m.byRole(this.kick.kind === 'punt' ? 'P' : 'K') || m.userEnt[this.kick.side]) : m.userEnt[this.userSide || 'home'];
      if (u) lines.push({ text: `#${u.p.number} ${u.p.last.toUpperCase()} · ${u.p.pos}`, color: '#e6ebf5', size: 13, weight: 700 });
      if (lines.length) callPanel = lines;
    }
    const kick = this.kick && m.phase === 'presnap' && !this.walk ? this.kick.meter.view(this.kickDistText()) : null;
    this.hud.draw(ctx, dt, {
      m, icons,
      playClock: m.phase === 'presnap' && this.playClock !== null && !this.walk ? Math.max(0, this.playClock) : null,
      flag: this.flagUp || (m.phase === 'post' && m.flags.length > 0),
      kick, callPanel,
      captions: this.captions,
      hideBug: ((m.phase === 'playcall' || m.phase === 'kickoff' || m.phase === 'pat') && this.wbs.length > 1) || !!this.drill?.over,
      customBug: this.drill && this.drill.id !== 'twominute' && !this.drill.over ? (c) => this.drill.drawBug(c, m) : null,
    });
    // play calling
    if (this.calls) {
      if (this.wbs.length) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, 0, 1024, 768);
        for (const wb of this.wbs) wb.draw(ctx);
        if (this.tape.last && !this.wbs.some((w) => w.done)) hints(ctx, [['create', 'REPLAY'], ['touch', 'TIMEOUT']], { y: 744 });
      } else {
        const off = m.teams[m.offSide];
        text(ctx, this.drill?.huddleLine(m) || `${off.name.toUpperCase()} IN THE HUDDLE`, 512, 120, { size: 15, weight: 900, color: '#ffffff', align: 'center', spacing: 3 });
      }
    }
    if (this.drill && !(this.calls && this.wbs.length)) this.drill.drawLog(ctx, m);
    // pre-snap tools
    if (m.phase === 'presnap' && !this.walk && !this.ff) {
      for (const side of this.humanSides()) {
        const ps = this.presnaps[side];
        if (!ps) continue;
        const d = ps.describe();
        if (d.list) {
          glossBar(ctx, 312, 150, 400, 40 + d.list.length * 34, '#232b3c', '#06080d');
          vText(ctx, d.title, 512, 178, 18, { align: 'center', color: '#ffd23a', weight: 0.2 });
          d.list.forEach((a, i) => {
            const y = 214 + i * 34;
            if (usingPad()) padGlyph(ctx, d.btns[i], 342, y - 6, 11); else keyCap(ctx, { square: 'J', triangle: 'I', circle: 'L', cross: 'K' }[d.btns[i]], 342, y - 6, 20);
            text(ctx, a.label, 364, y, { size: 12, weight: 900, color: C.dim, spacing: 1 });
            text(ctx, a.play.name, 430, y, { size: 16, weight: 800, color: '#ffffff' });
          });
        } else if (d.title) {
          glossBar(ctx, 312, 150, 400, 56, '#232b3c', '#06080d');
          vText(ctx, d.title, 512, 176, 18, { align: 'center', color: '#ffd23a', weight: 0.2 });
          text(ctx, d.sub || '', 512, 197, { size: 12, weight: 800, color: '#dfe6f2', align: 'center', spacing: 1 });
        }
        if (d.hints && !this.kick) hints(ctx, d.hints, { y: 662 });
      }
      if (this.kick) hints(ctx, [['stick', 'AIM'], ['cross', this.kick.meter.state === 'aim' ? 'START' : this.kick.meter.state === 'power' ? 'POWER' : 'ACCURACY']], { y: 662 });
    }
    if (m.phase === 'live' && this.humanSides().length) {
      const u = m.userEnt[this.userSide || 'home'];
      if (u && m.ball.carrier === u && u !== m.qb) hints(ctx, [['square', 'STIFF ARM'], ['circle', 'SPIN'], ['triangle', 'HURDLE'], ['l1', 'LATERAL']], { y: 662 });
    }
    // a career's fast forward: the VCR's FF under the picture while you watch from the sideline
    if (this.ff && ['presnap', 'live', 'post', 'playcall', 'kickoff', 'pat'].includes(m.phase)) {
      osd(ctx, '▶▶ FF', 60, 92, 30, '#d8ffd8');
      const lockSide = m.lock?.side;
      const why = !lockSide ? '' : m.offSide === lockSide ? `${m.teams[lockSide].name.toUpperCase()} OFFENSE — YOU'RE ON THE SIDELINE` : `${m.teams[lockSide].name.toUpperCase()} DEFENSE ON THE FIELD`;
      text(ctx, why, 60, 120, { size: 13, weight: 900, color: '#d8ffd8', spacing: 2 });
    }
    if (this.drill?.over) { this.drill.drawOver(ctx); return; }
    if (m.phase === 'penalty') this.drawPenalty(ctx);
    if (m.phase === 'halftime') this.drawBreak(ctx, 'HALFTIME');
    if (m.phase === 'final') this.drawBreak(ctx, 'FINAL');
  }

  kickDistText() {
    const m = this.m;
    if (m.playKind === 'fg') return `${Math.round(m.field.toGoal(m.los, m.offDir) + m.field.EZ + 7)} YD ATTEMPT`;
    return null;
  }

  drawBreak(ctx, title) {
    const m = this.m;
    ctx.fillStyle = 'rgba(2,4,8,0.45)';
    ctx.fillRect(0, 0, 1024, 768);
    drawBoxScore(ctx, m, { title: title === 'FINAL' ? `FINAL${m.ot ? ' / OT' : ''}` : 'HALFTIME', y: 96 });
    if (title === 'FINAL') {
      const p = playerOfGame(m);
      if (p) {
        glossBar(ctx, 152, 664, 720, 34, '#38383e', '#0c0c0f');
        text(ctx, `PLAYER OF THE GAME: ${p.name.toUpperCase()} (${p.pos})`, 512, 686, { size: 15, weight: 900, color: '#ffd23a', align: 'center', spacing: 1 });
      }
    }
    if ((this.breakT || 0) > 1) hints(ctx, [['confirm', title === 'FINAL' ? 'CONTINUE' : 'SECOND HALF']], { y: 740 });
  }

  drawIntro(ctx) {
    const m = this.m;
    const k = clamp(this.stageT / 0.8, 0, 1);
    // LIVE bug
    ctx.save();
    ctx.fillStyle = '#c4101f';
    ctx.fillRect(64, 60, 64, 26);
    vText(ctx, 'LIVE', 96, 80, 16, { align: 'center', color: '#fff', weight: 0.22 });
    ctx.restore();
    text(ctx, 'HARD COUNT NETWORK PRESENTS', 140, 79, { size: 13, weight: 900, color: '#fff', spacing: 3 });
    // the matchup slab
    const y = 470 + (1 - easeOutCubic(k)) * 300;
    const away = m.teams.away, home = m.teams.home;
    ctx.save();
    for (const [side, team, x0] of [['away', away, 112], ['home', home, 528]]) {
      const col = team.colors.primary;
      glossBar(ctx, x0, y, 384, 120, shadeHex(col, 0.2), shadeHex(col, -0.45));
      try { drawLogo(ctx, team, x0 + 64, y + 60, 96); } catch { /* */ }
      text(ctx, team.city.toUpperCase(), x0 + 126, y + 44, { size: 15, weight: 900, color: lum(col) > 0.62 ? '#111' : '#e8edf6', spacing: 2 });
      try { drawWordmark(ctx, team, x0 + 250, y + 82, 40, { maxWidth: 240 }); } catch { vText(ctx, team.name.toUpperCase(), x0 + 126, y + 86, 30, { color: '#fff', weight: 0.2 }); }
      void side;
    }
    glossBar(ctx, 462, y + 36, 100, 48, '#f2f4f8', '#c7ccd6');
    vText(ctx, 'VS', 512, y + 70, 28, { align: 'center', color: '#111', weight: 0.22 });
    glossBar(ctx, 112, y + 120, 800, 36, '#1f2737', '#070a12');
    const v = this.venueMeta;
    const wx = { clear: 'CLEAR', overcast: 'OVERCAST', rain: 'RAIN', snow: 'SNOW', fog: 'FOG' }[this.weatherName] || 'CLEAR';
    const temp = this.weatherName === 'snow' ? 28 : this.weatherName === 'rain' ? 51 : this.timeOfDay === 'night' ? 58 : 67;
    text(ctx, `${(v.name || '').toUpperCase()} · ${(v.city || '').toUpperCase()}   ·   ${wx} ${v.roof === 'dome' ? '(INDOORS)' : `${temp}°`}   ·   ${this.timeOfDay === 'night' ? 'PRIMETIME' : this.timeOfDay === 'dusk' ? 'LATE AFTERNOON' : 'AFTERNOON'}`, 512, y + 144, { size: 14, weight: 800, color: '#ffd23a', align: 'center', spacing: 2 });
    ctx.restore();
    this.hud.drawCaptions(ctx);
    hints(ctx, [['confirm', 'SKIP']]);
  }
}

registerScreen('match', () => new MatchScreen());

export { MatchScreen };
