// FREE PLAY setup — midfield before the toss: the two captains face each
// other, the referee between them with the coin. Pick the teams (pro,
// college or high school), who plays which side, the difficulty, the quarter
// length, the stadium, the time of day and the weather, then kick it off.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { C, vText, vWidth, text, hints, panel, padGlyph, usingPad, keyCap } from '../core/ui.js';
import { uiSound } from '../core/menu.js';
import { clamp, easeOutCubic } from '../core/util.js';
import { TEAMS, COLLEGES, HS_RIVALS, getTeam, kitsFor } from '../data/teams.js';
import { buildRoster, teamRatings } from '../data/roster.js';
import { drawLogo, drawWordmark } from '../gfx/logos.js';
import { music } from '../audio/music.js';
import { glossBar, shadeHex, lum } from '../match/hud.js';

const LEAGUES = [
  { id: 'pro', name: 'THE SEVENS LEAGUE', list: TEAMS },
  { id: 'college', name: 'COLLEGE', list: COLLEGES },
  { id: 'hs', name: 'HIGH SCHOOL', list: HS_RIVALS },
];
const CONTROL = [
  { id: 'home', label: 'YOU ARE HOME' }, { id: 'away', label: 'YOU ARE AWAY' },
  { id: 'both', label: '2 PLAYERS' }, { id: 'none', label: 'WATCH CPU vs CPU' },
];
const DIFF = [{ id: 'rookie', label: 'ROOKIE' }, { id: 'pro', label: 'PRO' }, { id: 'allpro', label: 'ALL-PRO' }, { id: 'allglory', label: 'ALL-GLORY' }];
const QLEN = [2, 3, 4, 5, 6, 8];
const TIMES = [{ id: 'auto', label: 'STADIUM DEFAULT' }, { id: 'day', label: 'AFTERNOON' }, { id: 'dusk', label: 'DUSK' }, { id: 'night', label: 'PRIMETIME' }];
const WEATHERS = [{ id: 'auto', label: 'STADIUM DEFAULT' }, { id: 'clear', label: 'CLEAR' }, { id: 'overcast', label: 'OVERCAST' }, { id: 'rain', label: 'RAIN' }, { id: 'snow', label: 'SNOW' }, { id: 'fog', label: 'FOG' }];
const FIELDS = [{ id: 'sevens', label: 'SEVENS (80 × 40)' }, { id: 'full', label: 'FULL (100 × 53)' }];

function blankA(over = {}) {
  return { x: 0, z: 0, heading: 0, speed: 0, moveAngle: 0, accel: 0, turnRate: 0, effort: 0.3, base: 'stand', action: null, carry: null, look: null, reach: null, engage: null, dirt: 0, ...over };
}

registerScreen('cointoss', () => {
  let scene = null, camera = null, venue = null, pmod = null, venues = [];
  let t = 0, row = 0, ready = false, starting = -1;
  const S = {};
  const cap = { home: null, away: null };
  let ref = null;
  const rowsDef = ['away', 'home', 'control', 'difficulty', 'qlen', 'venue', 'time', 'weather', 'field', 'start'];

  function leagueOf(id) { return LEAGUES.findIndex((l) => l.list.some((tm) => tm.id === id)); }

  function load() {
    const last = store.load('lastSetup') || {};
    S.home = last.home || 'pht';
    S.away = last.away || 'det';
    S.lg = { home: Math.max(0, leagueOf(S.home)), away: Math.max(0, leagueOf(S.away)) };
    S.control = last.control || 'home';
    S.difficulty = last.difficulty || settings.get('difficulty') || 'pro';
    S.qlen = last.qlen || settings.get('quarterLen') || 4;
    S.venue = last.venue || 'auto';
    S.time = last.time || 'auto';
    S.weather = last.weather || 'auto';
    S.field = last.field || settings.get('fieldSize') || 'sevens';
  }

  function save() { store.save('lastSetup', { ...S, lg: undefined }); }

  function captainFor(team) {
    const r = buildRoster(team);
    return r.depth.QB[0];
  }

  async function build() {
    try { pmod = await import('../gfx/player/index.js'); } catch { /* */ }
    let mod = null;
    try { mod = await import('../gfx/stadium/index.js'); venues = mod.VENUES || []; } catch { /* */ }
    const home = getTeam(S.home);
    if (mod?.buildVenue) {
      try {
        venue = await mod.buildVenue(game.renderer.gl, { venue: home.venue || 'bayside', home, away: getTeam(S.away), time: 'night', weather: 'clear', crowd: 0.7, quality: game.renderer.internalLines <= 480 ? 'low' : 'high' });
        scene = venue.scene;
        game.renderer.setPost({ ...(venue.post || {}), vignette: 0.7 }, true);
      } catch (e) { console.warn(e); }
    }
    if (!scene) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#05070d');
      scene.add(new THREE.HemisphereLight('#8aa0ff', '#1a2a12', 1.2));
      const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(8, 20, 10); scene.add(key);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#2d5a22' }));
      g.rotation.x = -Math.PI / 2; scene.add(g);
    }
    camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 1200);
    if (pmod?.createPlayerModel) {
      for (const side of ['home', 'away']) {
        const team = getTeam(S[side]);
        const k = kitsFor(getTeam(S.home), getTeam(S.away));
        try {
          cap[side] = { model: pmod.createPlayerModel({ team, kit: k[side], player: captainFor(team), lod: 'high' }), id: S[side] };
          scene.add(cap[side].model.group);
        } catch (e) { console.warn(e); }
      }
      try { ref = pmod.createRefModel({ role: 'referee', lod: 'high' }); scene.add(ref.group); } catch { /* */ }
    }
    ready = true;
  }

  function refreshCaptains() {
    const home = getTeam(S.home), away = getTeam(S.away);
    const k = kitsFor(home, away);
    for (const side of ['home', 'away']) {
      const c = cap[side];
      if (!c) continue;
      const team = side === 'home' ? home : away;
      try { c.model.setKit(team, k[side]); c.model.setPlayer(captainFor(team)); } catch (e) { console.warn(e); }
    }
  }

  function cycleTeam(side, d) {
    const L = LEAGUES[S.lg[side]].list;
    let i = L.findIndex((tm) => tm.id === S[side]);
    for (let k = 0; k < L.length; k++) {
      i = (i + d + L.length) % L.length;
      if (L[i].id !== S[side === 'home' ? 'away' : 'home']) break;
    }
    S[side] = L[i].id;
    refreshCaptains();
  }

  function cycleLeague(side, d) {
    S.lg[side] = (S.lg[side] + d + LEAGUES.length) % LEAGUES.length;
    const L = LEAGUES[S.lg[side]].list;
    S[side] = (L.find((tm) => tm.id !== S[side === 'home' ? 'away' : 'home']) || L[0]).id;
    refreshCaptains();
  }

  const opt = (list, cur, d) => { const i = list.findIndex((o) => (o.id ?? o) === cur); return list[(i + d + list.length) % list.length]; };

  function change(d) {
    const r = rowsDef[row];
    switch (r) {
      case 'away': case 'home': cycleTeam(r, d); break;
      case 'control': S.control = opt(CONTROL, S.control, d).id; break;
      case 'difficulty': S.difficulty = opt(DIFF, S.difficulty, d).id; break;
      case 'qlen': S.qlen = opt(QLEN, S.qlen, d); break;
      case 'venue': { const list = [{ id: 'auto' }, ...venues]; S.venue = opt(list, S.venue, d).id; break; }
      case 'time': S.time = opt(TIMES, S.time, d).id; break;
      case 'weather': S.weather = opt(WEATHERS, S.weather, d).id; break;
      case 'field': S.field = opt(FIELDS, S.field, d).id; break;
      default: return;
    }
    uiSound('tab');
  }

  function start() {
    save();
    starting = 0;
    uiSound('select');
    const home = getTeam(S.home);
    const params = {
      home: S.home, away: S.away, user: S.control, difficulty: S.difficulty, qlen: S.qlen,
      venue: S.venue === 'auto' ? (home.venue || 'bayside') : S.venue,
      time: S.time === 'auto' ? undefined : S.time,
      weather: S.weather === 'auto' ? undefined : S.weather,
      field: S.field, mode: 'free', returnTo: 'huddle',
    };
    setTimeout(() => go('match', params), 650);
  }

  function valueText(r) {
    const v = venues.find((x) => x.id === S.venue);
    switch (r) {
      case 'control': return CONTROL.find((c) => c.id === S.control)?.label;
      case 'difficulty': return DIFF.find((c) => c.id === S.difficulty)?.label;
      case 'qlen': return `${S.qlen} MIN QUARTERS`;
      case 'venue': return S.venue === 'auto' ? `HOME FIELD (${(venues.find((x) => x.id === getTeam(S.home).venue)?.name || 'HOME').toUpperCase()})` : (v?.name || S.venue).toUpperCase();
      case 'time': return TIMES.find((c) => c.id === S.time)?.label;
      case 'weather': return WEATHERS.find((c) => c.id === S.weather)?.label;
      case 'field': return FIELDS.find((c) => c.id === S.field)?.label;
      default: return '';
    }
  }

  function drawTeamCard(ctx, side, x, y, focused) {
    const team = getTeam(S[side]);
    const col = team.colors.primary;
    const R = teamRatings(team);
    ctx.save();
    if (focused) { ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 16; }
    glossBar(ctx, x, y, 330, 150, shadeHex(col, 0.18), shadeHex(col, -0.45));
    ctx.restore();
    if (focused) { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2.5; ctx.strokeRect(x - 1, y - 1, 332, 152); }
    try { drawLogo(ctx, team, x + 62, y + 72, 100); } catch { /* */ }
    const light = lum(col) > 0.62;
    text(ctx, side === 'home' ? 'HOME' : 'AWAY', x + 124, y + 28, { size: 12, weight: 900, color: light ? '#222' : '#ffd23a', spacing: 3 });
    text(ctx, team.city.toUpperCase(), x + 124, y + 50, { size: 13, weight: 900, color: light ? '#111' : '#e8edf6', spacing: 1 });
    try { drawWordmark(ctx, team, x + 222, y + 86, 30, { maxWidth: 196 }); } catch { vText(ctx, team.name.toUpperCase(), x + 124, y + 88, 24, { color: '#fff' }); }
    text(ctx, `OVR ${R.ovr}   OFF ${R.off}   DEF ${R.def}   SPD ${R.speed}`, x + 124, y + 122, { size: 12, weight: 900, color: light ? '#111' : '#ffffff', spacing: 1 });
    text(ctx, LEAGUES[S.lg[side]].name, x + 124, y + 140, { size: 10, weight: 900, color: light ? '#333' : 'rgba(255,255,255,0.65)', spacing: 2 });
    if (focused) {
      if (usingPad()) { padGlyph(ctx, 'L1', x + 286, y + 18, 8); padGlyph(ctx, 'R1', x + 314, y + 18, 8); } else { keyCap(ctx, 'Q', x + 288, y + 18, 15); keyCap(ctx, 'E', x + 312, y + 18, 15); }
      vText(ctx, '‹', x - 18, y + 86, 34, { color: '#ffd23a', weight: 0.25, skew: 0 });
      vText(ctx, '›', x + 342, y + 86, 34, { color: '#ffd23a', weight: 0.25, skew: 0 });
    }
  }

  return {
    async enter() {
      load();
      await build();
      music.play('hud_free', { fade: 1 });
    },
    exit() {
      try { venue?.dispose?.(); } catch { /* */ }
      for (const s of ['home', 'away']) { try { cap[s]?.model.dispose(); } catch { /* */ } }
      try { ref?.dispose?.(); } catch { /* */ }
    },
    view() { return scene && camera ? { scene, camera } : null; },
    update(dt, busy) {
      if (!ready) return;
      t += dt;
      if (!busy && starting < 0) {
        if (input.pressed('up')) { row = (row - 1 + rowsDef.length) % rowsDef.length; uiSound('move'); }
        if (input.pressed('down')) { row = (row + 1) % rowsDef.length; uiSound('move'); }
        if (input.pressed('left')) change(-1);
        if (input.pressed('right')) change(1);
        const r = rowsDef[row];
        if ((r === 'home' || r === 'away') && input.pressed('tabL')) { cycleLeague(r, -1); uiSound('tab'); }
        if ((r === 'home' || r === 'away') && input.pressed('tabR')) { cycleLeague(r, 1); uiSound('tab'); }
        if (input.pressed('confirm')) { if (r === 'start') start(); else { row = rowsDef.length - 1; uiSound('move'); } }
        if (input.pressed('alt')) { const h = S.home; S.home = S.away; S.away = h; const l = S.lg.home; S.lg.home = S.lg.away; S.lg.away = l; refreshCaptains(); uiSound('tab'); }
        if (input.pressed('back')) { save(); go('huddle'); }
      }
      if (starting >= 0) starting += dt;
      // the captains face each other at the 50, the ref between them
      const cA = cap.away, cH = cap.home;
      const breathe = Math.sin(t * 1.3) * 0.01;
      cA?.model.update(dt, blankA({ x: -1.15, z: 0, heading: Math.PI / 2, base: 'stand', look: { x: 0, y: 1.7, z: 0.4 } }));
      cH?.model.update(dt, blankA({ x: 1.15, z: 0, heading: -Math.PI / 2, base: 'stand', look: { x: 0, y: 1.7, z: 0.4 } }));
      ref?.update(dt, blankA({ x: 0, z: 0.9, heading: Math.PI, base: 'ref', look: { x: 0, y: 1.6, z: -2 } }));
      // a slow drift around the three of them
      const a = -0.32 + Math.sin(t * 0.12) * 0.12;
      camera.position.set(Math.sin(a) * 6.2, 1.55 + breathe, -Math.cos(a) * 6.2);
      camera.lookAt(0, 1.32, 0.2);
      try { venue?.update(dt, { camera, excitement: 0.35, time: t }); } catch { /* */ }
    },
    draw(ctx) {
      if (!ready) return;
      const k = easeOutCubic(clamp(t / 0.5, 0, 1));
      // header
      vText(ctx, 'FREE PLAY', 64, 84, 38, { color: '#ffffff', weight: 0.17, outline: 3, outlineColor: 'rgba(0,0,0,0.75)', shadow: [3, 4, 'rgba(0,0,0,0.6)'] });
      text(ctx, 'MIDFIELD · THE CAPTAINS MEET', 68, 108, { size: 13, weight: 900, color: C.accent, spacing: 4 });
      // the two teams
      drawTeamCard(ctx, 'away', 40 - (1 - k) * 400, 470, rowsDef[row] === 'away');
      drawTeamCard(ctx, 'home', 654 + (1 - k) * 400, 470, rowsDef[row] === 'home');
      vText(ctx, 'VS', 512, 556, 30, { align: 'center', color: '#ffffff', weight: 0.2, outline: 3, outlineColor: 'rgba(0,0,0,0.7)' });
      // the settings list
      const rows = rowsDef.filter((r) => r !== 'home' && r !== 'away');
      const px = 600, py = 128;
      panel(ctx, px, py, 380, 34 + rows.length * 34, { accentLen: 160, alpha: 0.95 });
      const labels = { control: 'CONTROL', difficulty: 'SKILL LEVEL', qlen: 'QUARTERS', venue: 'STADIUM', time: 'KICKOFF TIME', weather: 'WEATHER', field: 'FIELD', start: '' };
      rows.forEach((r, i) => {
        const y = py + 40 + i * 34;
        const on = rowsDef[row] === r;
        if (on) { ctx.fillStyle = 'rgba(255,178,30,0.22)'; ctx.fillRect(px + 8, y - 22, 364, 30); }
        if (r === 'start') {
          vText(ctx, 'KICK IT OFF', px + 190, y + 2, 22, { align: 'center', color: on ? '#ffd23a' : '#ffffff', weight: 0.2 });
          return;
        }
        text(ctx, labels[r], px + 20, y, { size: 12, weight: 900, color: on ? C.accent : C.dim, spacing: 2 });
        text(ctx, valueText(r) || '', px + 362, y, { size: 15, weight: 800, color: on ? '#ffffff' : '#cfd5df', align: 'right' });
      });
      if (starting >= 0) {
        ctx.fillStyle = `rgba(0,0,0,${clamp(starting / 0.6, 0, 0.8)})`;
        ctx.fillRect(0, 0, 1024, 768);
        vText(ctx, 'TO THE COIN TOSS...', 512, 400, 30, { align: 'center', color: '#ffd23a', weight: 0.2 });
      }
      hints(ctx, [['ud', 'MOVE'], ['lr', 'CHANGE'], ['tabL', 'LEAGUE'], ['alt', 'SWAP SIDES'], ['confirm', 'PLAY'], ['back', 'BACK']]);
    },
  };
});
