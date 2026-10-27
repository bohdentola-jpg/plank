// ROAD TO GLORY — the screens around your career: making your player under
// the Friday-night lights, then the hub: your room (a high-school bedroom, a
// dorm, a downtown apartment) and your flip phone, where the schedule, the
// texts, the headlines, training and every big moment of the road arrive —
// signing day, the draft, the Glory Bowl, the Hall of Fame.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { C, vText, vWidth, text, hints, panel, padGlyph, usingPad, keyCap, paragraph, roundRect, statBar } from '../core/ui.js';
import { uiSound } from '../core/menu.js';
import { clamp, easeOutCubic, easeOutBack, makeRng, hashString } from '../core/util.js';
import { getTeam, HS_RIVALS, COLLEGES } from '../data/teams.js';
import { teamRatings } from '../data/roster.js';
import { playerName, HOMETOWNS } from '../data/names.js';
import { drawLogo, drawWordmark } from '../gfx/logos.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { addTrophy, enshrine } from '../data/records.js';
import * as CR from '../career/career.js';
import { glossBar, shadeHex, lum } from '../match/hud.js';

// the creator's build and pad choices → look.muscle / look.pads
const BUILDS = [['LEAN', 0.15], ['ATHLETIC', 0.45], ['BUILT', 0.72], ['JACKED', 0.95]];
const PADS = [['SLIM', 0.1], ['STANDARD', 0.5], ['BIG', 0.9]];
const SKINS = ['#f1d3bd', '#e5b896', '#d4a07a', '#c08a63', '#a8714b', '#8d5a3a', '#73452b', '#5c3521', '#4a2a1a', '#3a2015'];
const HAIRS = ['buzz', 'fade', 'short', 'twists', 'dreads', 'braids', 'afro', 'mohawk', 'bald', 'curly', 'long', 'flat'];
const STAGE_NAME = { hs: 'HIGH SCHOOL', college: 'COLLEGE', pro: 'THE SEVENS LEAGUE', retired: 'RETIRED' };
const YEAR_NAME = { 1: 'FRESHMAN', 2: 'SOPHOMORE', 3: 'JUNIOR', 4: 'SENIOR' };

function stageLine(c) {
  if (c.stage === 'hs') return 'HIGH SCHOOL SENIOR';
  if (c.stage === 'college') return `COLLEGE ${YEAR_NAME[c.year] || `YEAR ${c.year}`}`;
  if (c.stage === 'pro') return `PRO · YEAR ${c.year}`;
  return 'RETIRED';
}

// ================================================================== the room behind the phone
const roomCache = new Map();
function roomCanvas(c) {
  const key = `${c.stage}:${c.team}`;
  if (roomCache.has(key)) return roomCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 768;
  const x = cv.getContext('2d');
  const team = getTeam(c.team);
  const rng = makeRng(hashString(key));
  if (c.stage === 'pro') {
    // downtown: a wall of glass and the city at night
    const g = x.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#141a2a');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 768);
    const sky = x.createLinearGradient(0, 40, 0, 560);
    sky.addColorStop(0, '#0a1430'); sky.addColorStop(0.7, '#2a2350'); sky.addColorStop(1, '#5a3a4a');
    x.fillStyle = sky; x.fillRect(40, 40, 944, 520);
    for (let i = 0; i < 46; i++) {
      const bw = 18 + rng() * 50, bh = 80 + rng() * 360, bx = 40 + rng() * 940;
      x.fillStyle = `rgb(${12 + rng() * 14},${14 + rng() * 14},${26 + rng() * 20})`;
      x.fillRect(bx, 560 - bh, bw, bh);
      for (let k = 0; k < bh / 9; k++) for (let j = 0; j < bw / 7; j++) if (rng() < 0.32) { x.fillStyle = rng() < 0.85 ? 'rgba(255,214,140,0.85)' : 'rgba(170,210,255,0.8)'; x.fillRect(bx + 2 + j * 7, 560 - bh + 4 + k * 9, 3, 4); }
    }
    x.fillStyle = 'rgba(10,12,20,0.9)';
    for (const fx of [40, 354, 668, 982]) x.fillRect(fx - 4, 40, 8, 520);
    x.fillRect(40, 300, 944, 6);
    // the floor and a framed jersey
    x.fillStyle = '#1b1712'; x.fillRect(0, 560, 1024, 208);
    x.fillStyle = '#0d0f14'; x.fillRect(70, 470, 260, 140);
    const k = team.uniform?.home || {};
    x.fillStyle = k.jersey || team.colors.primary; x.fillRect(110, 488, 180, 104);
    x.fillStyle = k.numbers || '#fff'; x.font = '900 60px Arial'; x.textAlign = 'center'; x.fillText(String(c.player.number), 200, 568);
  } else if (c.stage === 'college') {
    // the dorm: painted cinder block, a pennant, string lights
    x.fillStyle = '#c9c4b6'; x.fillRect(0, 0, 1024, 768);
    for (let row = 0; row < 26; row++) for (let col = 0; col < 12; col++) {
      x.strokeStyle = 'rgba(80,72,60,0.25)'; x.lineWidth = 2;
      x.strokeRect(col * 90 + (row % 2) * 45, row * 30, 90, 30);
    }
    const sh = x.createRadialGradient(780, 260, 40, 600, 380, 700);
    sh.addColorStop(0, 'rgba(255,230,180,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)');
    x.fillStyle = sh; x.fillRect(0, 0, 1024, 768);
    // pennant
    x.fillStyle = team.colors.primary;
    x.beginPath(); x.moveTo(80, 90); x.lineTo(470, 150); x.lineTo(80, 210); x.closePath(); x.fill();
    x.fillStyle = team.colors.secondary; x.font = 'italic 900 34px Arial'; x.textAlign = 'left'; x.fillText(team.name.toUpperCase(), 110, 162);
    // string lights
    for (let i = 0; i < 24; i++) { const lx = 30 + i * 42, ly = 40 + Math.sin(i * 0.6) * 12; x.fillStyle = ['#ffd27a', '#ff8a8a', '#8ad0ff'][i % 3]; x.beginPath(); x.arc(lx, ly, 5, 0, Math.PI * 2); x.fill(); }
    // bunk bed rails
    x.fillStyle = '#5a5e66'; x.fillRect(0, 430, 400, 14); x.fillRect(0, 600, 400, 14); x.fillRect(380, 300, 16, 468);
    x.fillStyle = team.colors.primary; x.fillRect(0, 444, 380, 40);
  } else {
    // the high-school bedroom: posters, a trophy shelf, the window, a lamp
    const g = x.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, '#3b4a6a'); g.addColorStop(1, '#232a3c');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 768);
    // window
    x.fillStyle = '#0a1024'; x.fillRect(70, 70, 260, 220);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + rng() * 0.6})`; x.fillRect(70 + rng() * 260, 70 + rng() * 150, 2, 2); }
    x.fillStyle = '#e8e4d0'; x.beginPath(); x.arc(270, 120, 18, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#d9d2bd'; x.lineWidth = 8; x.strokeRect(70, 70, 260, 220); x.beginPath(); x.moveTo(200, 70); x.lineTo(200, 290); x.stroke();
    // posters
    x.save(); x.translate(400, 60); x.rotate(-0.04);
    x.fillStyle = team.colors.primary; x.fillRect(0, 0, 170, 230);
    try { drawLogo(x, team, 85, 100, 120); } catch { /* */ }
    x.fillStyle = team.colors.secondary; x.font = '900 22px Arial'; x.textAlign = 'center'; x.fillText(team.name.toUpperCase(), 85, 205);
    x.restore();
    const idol = getTeam('pht');
    x.save(); x.translate(600, 90); x.rotate(0.05);
    x.fillStyle = '#111'; x.fillRect(0, 0, 150, 200);
    try { drawLogo(x, idol, 75, 80, 100); } catch { /* */ }
    x.fillStyle = '#ffd23a'; x.font = '900 15px Arial'; x.textAlign = 'center'; x.fillText('GLORY BOWL', 75, 170);
    x.restore();
    // shelf + trophies
    x.fillStyle = '#5a3a20'; x.fillRect(60, 360, 300, 14);
    for (let i = 0; i < 4; i++) { x.fillStyle = '#d9a63a'; x.fillRect(84 + i * 70, 318, 22, 34); x.beginPath(); x.arc(95 + i * 70, 316, 16, Math.PI, 0); x.fill(); x.fillRect(80 + i * 70, 350, 30, 10); }
    // lamp glow
    const lg = x.createRadialGradient(900, 420, 20, 900, 420, 520);
    lg.addColorStop(0, 'rgba(255,214,150,0.45)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = lg; x.fillRect(0, 0, 1024, 768);
    // bed
    x.fillStyle = team.colors.primary; x.fillRect(0, 560, 460, 208);
    x.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 6; i++) x.fillRect(0, 580 + i * 30, 460, 10);
  }
  // grain + vignette
  const v = x.createRadialGradient(512, 384, 200, 512, 384, 700);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = v; x.fillRect(0, 0, 1024, 768);
  roomCache.set(key, cv);
  return cv;
}

// ================================================================== the flip phone
const LCD = { bg0: '#0c2c62', bg1: '#1d58a8', ink: '#e8f4ff', dim: '#8fb8e8', hi: '#ffd23a', sel: 'rgba(255,255,255,0.18)' };
const PF = '"Consolas", "Lucida Console", "DejaVu Sans Mono", monospace';

function phoneBody(ctx, x, y, w, h, t) {
  ctx.save();
  // the hand under it
  ctx.fillStyle = '#8d5a3a';
  ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h + 40, w * 0.62, 120, 0, 0, Math.PI * 2); ctx.fill();
  // lower half (keypad)
  const mid = y + h * 0.52;
  roundRect(ctx, x, mid, w, h - (mid - y), 28);
  let g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#3a3e46'); g.addColorStop(0.5, '#9aa2ae'); g.addColorStop(1, '#2e3138');
  ctx.fillStyle = g; ctx.fill();
  // upper half (screen)
  roundRect(ctx, x + 4, y, w - 8, h * 0.52 + 6, 30);
  g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#2a2d33'); g.addColorStop(0.45, '#a8b0bc'); g.addColorStop(0.55, '#c9d0da'); g.addColorStop(1, '#25282e');
  ctx.fillStyle = g; ctx.fill();
  // hinge
  ctx.fillStyle = '#1a1c21'; ctx.fillRect(x + 12, mid - 6, w - 24, 14);
  // speaker slot
  ctx.fillStyle = '#1a1c21'; roundRect(ctx, x + w / 2 - 34, y + 16, 68, 7, 3); ctx.fill();
  // keypad
  const kx = x + 28, ky = mid + 70, kw = (w - 56) / 3, kh = 34;
  const keys = ['1', '2 ABC', '3 DEF', '4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ', '*', '0', '#'];
  keys.forEach((k, i) => {
    const bx = kx + (i % 3) * kw, by = ky + Math.floor(i / 3) * (kh + 8);
    roundRect(ctx, bx + 4, by, kw - 8, kh, 10);
    ctx.fillStyle = '#d8dde6'; ctx.fill();
    ctx.fillStyle = '#20242c'; ctx.font = `800 15px ${PF}`; ctx.textAlign = 'center'; ctx.fillText(k.split(' ')[0], bx + kw / 2, by + 20);
    if (k.includes(' ')) { ctx.font = `700 8px ${PF}`; ctx.fillText(k.split(' ')[1], bx + kw / 2, by + 30); }
  });
  // the nav ring
  const nx = x + w / 2, ny = mid + 36;
  ctx.beginPath(); ctx.ellipse(nx, ny, 40, 24, 0, 0, Math.PI * 2); ctx.fillStyle = '#c7cdd8'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(nx, ny, 16, 10, 0, 0, Math.PI * 2); ctx.fillStyle = '#eef1f6'; ctx.fill();
  // soft keys
  ctx.fillStyle = '#c7cdd8'; roundRect(ctx, x + 20, mid + 24, 50, 22, 8); ctx.fill(); roundRect(ctx, x + w - 70, mid + 24, 50, 22, 8); ctx.fill();
  ctx.restore();
  void t;
}

function lcd(ctx, x, y, w, h, title, t) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, LCD.bg1); g.addColorStop(1, LCD.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // status bar
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y, w, 18);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = LCD.ink; ctx.fillRect(x + 6 + i * 5, y + 13 - i * 3, 3, 3 + i * 3); }
  ctx.font = `700 11px ${PF}`; ctx.fillStyle = LCD.ink; ctx.textAlign = 'left'; ctx.fillText('HARDCELL', x + 30, y + 13);
  const d = new Date();
  ctx.textAlign = 'right'; ctx.fillText(`${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}`, x + w - 30, y + 13);
  ctx.strokeStyle = LCD.ink; ctx.strokeRect(x + w - 24, y + 5, 16, 8); ctx.fillStyle = LCD.ink; ctx.fillRect(x + w - 22, y + 7, 10, 4);
  // title bar
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y + 18, w, 22);
  ctx.font = `800 13px ${PF}`; ctx.textAlign = 'center'; ctx.fillStyle = LCD.hi; ctx.fillText(title, x + w / 2, y + 34);
  ctx.restore();
  void t;
}

function lcdText(ctx, s, x, y, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 700} ${opts.size || 12}px ${PF}`;
  ctx.textAlign = opts.align || 'left';
  ctx.fillStyle = opts.color || LCD.ink;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function wrapLines(ctx, s, maxW, size = 12) {
  ctx.save();
  ctx.font = `700 ${size}px ${PF}`;
  const out = [];
  let line = '';
  for (const w of String(s).split(/\s+/)) {
    const tst = line ? `${line} ${w}` : w;
    if (ctx.measureText(tst).width > maxW && line) { out.push(line); line = w; } else line = tst;
  }
  if (line) out.push(line);
  ctx.restore();
  return out;
}

// ================================================================== the screen
registerScreen('career', () => {
  let c = null, mode = 'hub', t = 0, modeT = 0;
  // phone state
  let app = 'home', sel = 0, scroll = 0, detail = null, ev = null, evSel = 0, overlay = null;
  // creation state
  let cr = null, scene = null, camera = null, venue = null, model = null, pmod = null;

  function setMode(m) { mode = m; modeT = 0; }

  // ---------------------------------------------------------------- creation
  function startCreate() {
    const rng = makeRng(Date.now() & 0xffffff);
    const nm = playerName(rng);
    cr = {
      row: 0, pos: 'WR', arche: 0, first: nm.first, last: nm.last, number: 11, skin: 5, hair: 1, build: 1, pads: 0,
      school: HS_RIVALS[Math.floor(rng() * HS_RIVALS.length)].id, rng, seed: Math.floor(rng() * 1e9),
      hometown: HOMETOWNS[Math.floor(rng() * HOMETOWNS.length)],
    };
    rebuildDraft();
  }

  function rebuildDraft() {
    const a = CR.ARCHETYPES[cr.pos][cr.arche % CR.ARCHETYPES[cr.pos].length];
    cr.p = CR.draftPlayer({ first: cr.first, last: cr.last, pos: cr.pos, arche: a.id, number: cr.number, hometown: cr.hometown, seed: cr.seed, look: { skin: cr.skin / 9, skinHex: SKINS[cr.skin], hair: HAIRS[cr.hair], muscle: BUILDS[cr.build][1], pads: PADS[cr.pads][1] } });
    if (model) {
      try { model.setKit(getTeam(cr.school), 'home'); model.setPlayer(cr.p); } catch (e) { console.warn(e); }
    }
  }

  async function buildCreateScene() {
    try { pmod = await import('../gfx/player/index.js'); } catch { /* */ }
    let mod = null;
    try { mod = await import('../gfx/stadium/index.js'); } catch { /* */ }
    const school = getTeam(cr.school);
    if (mod?.buildVenue) {
      try {
        venue = await mod.buildVenue(game.renderer.gl, { venue: 'friday', home: school, away: getTeam(HS_RIVALS.find((h) => h.id !== cr.school).id), time: 'night', weather: 'clear', crowd: 0.2, quality: 'low' });
        scene = venue.scene;
        game.renderer.setPost({ ...(venue.post || {}), vignette: 0.8 }, true);
      } catch (e) { console.warn(e); }
    }
    if (!scene) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#05070d');
      scene.add(new THREE.HemisphereLight('#8aa0ff', '#1a2a12', 1.2));
      const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(8, 20, 10); scene.add(key);
    }
    camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 1200);
    try { model = pmod.createPlayerModel({ team: school, kit: 'home', player: cr.p, lod: 'high' }); scene.add(model.group); } catch (e) { console.warn(e); model = null; }
  }

  const CREATE_ROWS = ['pos', 'arche', 'first', 'last', 'number', 'skin', 'hair', 'build', 'pads', 'school', 'go'];

  function updateCreate(dt) {
    const r = CREATE_ROWS[cr.row];
    if (input.pressed('up')) { cr.row = (cr.row - 1 + CREATE_ROWS.length) % CREATE_ROWS.length; uiSound('move'); }
    if (input.pressed('down')) { cr.row = (cr.row + 1) % CREATE_ROWS.length; uiSound('move'); }
    const d = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
    if (d) {
      uiSound('tab');
      switch (r) {
        case 'pos': { const i = CR.POSITIONS.indexOf(cr.pos); cr.pos = CR.POSITIONS[(i + d + CR.POSITIONS.length) % CR.POSITIONS.length]; cr.arche = 0; cr.number = { QB: 7, RB: 22, WR: 11, TE: 85, LB: 54, CB: 24, S: 31 }[cr.pos]; cr.pads = { QB: 0, RB: 1, WR: 0, TE: 1, LB: 2, CB: 0, S: 1 }[cr.pos] ?? 1; break; }
        case 'arche': cr.arche = (cr.arche + d + 2) % 2; break;
        case 'first': case 'last': { const nm = playerName(cr.rng); cr[r] = nm[r]; break; }
        case 'number': cr.number = clamp(cr.number + d, 1, 99); break;
        case 'skin': cr.skin = (cr.skin + d + SKINS.length) % SKINS.length; break;
        case 'hair': cr.hair = (cr.hair + d + HAIRS.length) % HAIRS.length; break;
        case 'build': cr.build = clamp(cr.build + d, 0, BUILDS.length - 1); break;
        case 'pads': cr.pads = clamp(cr.pads + d, 0, PADS.length - 1); break;
        case 'school': { const i = HS_RIVALS.findIndex((h) => h.id === cr.school); cr.school = HS_RIVALS[(i + d + HS_RIVALS.length) % HS_RIVALS.length].id; break; }
        default: break;
      }
      rebuildDraft();
    }
    if (input.pressed('confirm')) {
      if (r === 'go') {
        c = CR.newCareer({ player: cr.p, school: cr.school });
        uiSound('select');
        disposeScene();
        setMode('hub');
        app = 'home'; sel = 0;
        overlay = { kind: 'welcome', t: 0 };
        music.play('career_hub', { fade: 1.5 });
        return;
      }
      cr.row = CREATE_ROWS.length - 1; uiSound('move');
    }
    if (input.pressed('back')) { disposeScene(); go('huddle'); return; }
    model?.update(dt, { x: 0, z: 0, heading: Math.PI + Math.sin(t * 0.35) * 0.9, speed: 0, moveAngle: 0, accel: 0, turnRate: 0, effort: 0, base: 'stand', action: null, carry: null, look: null, reach: null, engage: null, dirt: 0 });
    if (camera) {
      camera.position.set(0.2, 1.3, -4.9);
      camera.lookAt(-0.95, 1.05, 0);   // him on the left, the cards on the right
    }
    try { venue?.update(dt, { camera, excitement: 0.15, time: t }); } catch { /* */ }
  }

  function disposeScene() {
    try { venue?.dispose?.(); } catch { /* */ }
    try { model?.dispose?.(); } catch { /* */ }
    venue = null; model = null; scene = null; camera = null;
  }

  function drawCreate(ctx) {
    const p = cr.p;
    vText(ctx, 'ROAD TO GLORY', 64, 84, 38, { color: '#ffffff', weight: 0.17, outline: 3, outlineColor: 'rgba(0,0,0,0.75)', shadow: [3, 4, 'rgba(0,0,0,0.6)'] });
    text(ctx, 'FRIDAY NIGHT · WHO ARE YOU?', 68, 108, { size: 13, weight: 900, color: C.accent, spacing: 4 });
    // the panel
    const px = 560, py = 118, pw = 420;
    panel(ctx, px, py, pw, 376, { accentLen: 200, alpha: 0.95 });
    const a = CR.ARCHETYPES[cr.pos][cr.arche % 2];
    const rows = {
      pos: ['POSITION', CR.POS_NAMES[cr.pos]], arche: ['STYLE', a.name], first: ['FIRST NAME', cr.first.toUpperCase()], last: ['LAST NAME', cr.last.toUpperCase()],
      number: ['NUMBER', `#${cr.number}`], skin: ['SKIN TONE', ''], hair: ['HAIR', HAIRS[cr.hair].toUpperCase()],
      build: ['BUILD', BUILDS[cr.build][0]], pads: ['SHOULDER PADS', PADS[cr.pads][0]],
      school: ['HIGH SCHOOL', `${getTeam(cr.school).city} ${getTeam(cr.school).name}`.toUpperCase()], go: ['', ''],
    };
    CREATE_ROWS.forEach((r, i) => {
      const y = py + 38 + i * 31.5;
      const on = i === cr.row;
      if (on) { ctx.fillStyle = 'rgba(255,58,44,0.22)'; ctx.fillRect(px + 10, y - 22, pw - 20, 29); }
      if (r === 'go') { vText(ctx, 'START YOUR CAREER', px + pw / 2, y + 2, 22, { align: 'center', color: on ? '#ffd23a' : '#ffffff', weight: 0.2 }); return; }
      text(ctx, rows[r][0], px + 24, y - 6, { size: 10, weight: 900, color: on ? C.accent : C.dim, spacing: 2 });
      if (r === 'skin') {
        SKINS.forEach((s, k) => { ctx.fillStyle = s; ctx.fillRect(px + 170 + k * 22, y - 18, 18, 18); if (k === cr.skin) { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2; ctx.strokeRect(px + 169 + k * 22, y - 19, 20, 20); } });
      } else text(ctx, rows[r][1], px + pw - 24, y + 6, { size: 15, weight: 800, color: on ? '#ffffff' : '#cfd5df', align: 'right' });
    });
    // the ratings that matter for the position
    const keys = CR.KEY_RATINGS[cr.pos].slice(0, 6);
    const bx = 560, by = 504;
    glossBar(ctx, bx, by, 420, 172, '#232b3c', '#06080d');
    vText(ctx, `OVR ${p.ovr}`, bx + 18, by + 32, 24, { color: '#ffd23a', weight: 0.2 });
    text(ctx, `${CR.POS_NAMES[cr.pos]} · ${a.name}`, bx + 140, by + 28, { size: 12, weight: 800, color: '#dfe6f2', spacing: 1 });
    keys.forEach((k, i) => {
      const y = by + 48 + i * 20;
      text(ctx, CR.RATING_NAMES[k] || k.toUpperCase(), bx + 18, y + 9, { size: 10, weight: 800, color: C.dim, spacing: 1 });
      statBar(ctx, bx + 170, y, 200, 10, p.r[k] / 99, { segments: 20, color: p.r[k] >= 80 ? C.green : p.r[k] >= 65 ? C.accent : '#ff8a5a' });
      text(ctx, String(p.r[k]), bx + 384, y + 9, { size: 12, weight: 900, color: '#ffffff' });
    });
    hints(ctx, [['ud', 'MOVE'], ['lr', 'CHANGE'], ['confirm', 'NEXT'], ['back', 'BACK']]);
  }

  // ---------------------------------------------------------------- the hub
  function homeItems() {
    const g = CR.nextGame(c);
    const unread = c.messages.filter((m) => !m.read).length;
    const items = [];
    if (c.season.done) items.push({ id: 'season', label: 'SEASON COMPLETE ▶' });
    else if (g) items.push({ id: 'next', label: `NEXT: ${g.home ? 'vs' : '@'} ${getTeam(g.opp).abbr}` });
    items.push({ id: 'schedule', label: 'SCHEDULE' });
    items.push({ id: 'texts', label: `TEXTS${unread ? ` (${unread})` : ''}` });
    items.push({ id: 'player', label: `MY PLAYER · ${c.xp} XP` });
    items.push({ id: 'standings', label: 'STANDINGS' });
    items.push({ id: 'news', label: 'HEADLINES' });
    items.push({ id: 'settings', label: 'GAME SETTINGS' });
    items.push({ id: 'quit', label: 'SAVE & QUIT' });
    return items;
  }

  function openApp(id) {
    uiSound('select');
    if (id === 'next') { app = 'next'; return; }
    if (id === 'season') { beginEvent(CR.endSeason(c)); CR.saveCareer(c); return; }
    if (id === 'quit') { CR.saveCareer(c); go('huddle'); return; }
    app = id; sel = 0; scroll = 0; detail = null;
  }

  function playGame() {
    const p = CR.matchParams(c);
    if (!p) return;
    CR.saveCareer(c);
    uiSound('select');
    go('match', { ...p, returnTo: 'career', onDone: (result) => go('career', { result }) });
  }

  function beginEvent(e) {
    ev = { ...e, t: 0 };
    evSel = 0;
    try { sfx.phone(); } catch { /* */ }
    if (e.kind === 'signing') music.play('draft', { fade: 1 });
    if (e.kind === 'declare') music.play('draft', { fade: 1 });
  }

  function updateHub(dt) {
    if (overlay) {
      overlay.t += dt;
      if (overlay.t > 0.6 && (input.pressed('confirm') || input.pressed('back'))) { overlay = null; uiSound('back'); }
      return;
    }
    if (ev) { updateEvent(dt); return; }
    if (app === 'home') {
      const items = homeItems();
      if (input.pressed('up')) { sel = (sel - 1 + items.length) % items.length; uiSound('move'); }
      if (input.pressed('down')) { sel = (sel + 1) % items.length; uiSound('move'); }
      if (input.pressed('confirm')) openApp(items[sel].id);
      if (input.pressed('back')) { CR.saveCareer(c); go('huddle'); }
      return;
    }
    if (input.pressed('back')) { if (detail) detail = null; else { app = 'home'; sel = 0; } uiSound('back'); return; }
    switch (app) {
      case 'next':
        if (input.pressed('confirm')) playGame();
        break;
      case 'texts': {
        const n = c.messages.length;
        if (input.pressed('up')) sel = Math.max(0, sel - 1);
        if (input.pressed('down')) sel = Math.min(n - 1, sel + 1);
        if (input.pressed('confirm') && c.messages[sel]) { detail = c.messages[sel]; detail.read = true; CR.saveCareer(c); }
        break;
      }
      case 'player': {
        const keys = CR.KEY_RATINGS[c.player.pos];
        if (input.pressed('up')) sel = Math.max(0, sel - 1);
        if (input.pressed('down')) sel = Math.min(keys.length - 1, sel + 1);
        if (input.pressed('confirm')) { if (CR.train(c, keys[sel])) uiSound('buy'); else uiSound('error'); }
        break;
      }
      case 'settings': {
        const S = c.settings || (c.settings = { qlen: 3, difficulty: 'pro' });
        if (input.pressed('up') || input.pressed('down')) sel = 1 - sel;
        const d = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
        if (d && sel === 0) { const L = [2, 3, 4, 5]; S.qlen = L[(L.indexOf(S.qlen) + d + L.length) % L.length]; uiSound('tab'); CR.saveCareer(c); }
        if (d && sel === 1) { const L = ['rookie', 'pro', 'allpro', 'allglory']; S.difficulty = L[(L.indexOf(S.difficulty) + d + L.length) % L.length]; uiSound('tab'); CR.saveCareer(c); }
        break;
      }
      default:
        if (input.pressed('up')) scroll = Math.max(0, scroll - 1);
        if (input.pressed('down')) scroll++;
    }
  }

  function updateEvent(dt) {
    ev.t += dt;
    if (ev.t < 0.6) return;
    switch (ev.kind) {
      case 'signing': {
        const n = ev.offers.length;
        if (input.pressed('up')) { evSel = (evSel - 1 + n) % n; uiSound('move'); }
        if (input.pressed('down')) { evSel = (evSel + 1) % n; uiSound('move'); }
        if (input.pressed('confirm')) {
          const id = ev.offers[evSel];
          CR.signWith(c, id);
          ev = { kind: 'committed', team: id, t: 0 };
          music.stinger?.('win');
        }
        break;
      }
      case 'committed': case 'drafted': case 'newSeason':
        if (input.pressed('confirm')) { ev = null; app = 'home'; sel = 0; music.play('career_hub', { fade: 1.5 }); }
        break;
      case 'declare':
        if (input.pressed('up') || input.pressed('down')) evSel = ev.canStay ? 1 - evSel : 0;
        if (input.pressed('confirm')) {
          if (evSel === 1 && ev.canStay) { CR.stayInSchool(c); ev = { kind: 'newSeason', t: 0 }; } else { const d = CR.runDraft(c); ev = { kind: 'draft', d, t: 0 }; }
        }
        break;
      case 'draft':
        if (ev.t > 6.5 || (ev.t > 1 && input.pressed('confirm'))) { CR.goPro(c, ev.d); ev = { kind: 'drafted', d: ev.d, t: 0 }; }
        break;
      case 'nextSeason': ev = { kind: 'newSeason', t: 0 }; break;
      case 'retireOption':
        if (input.pressed('up') || input.pressed('down')) evSel = 1 - evSel;
        if (input.pressed('confirm')) { if (evSel === 0) { CR.nextProSeason(c); ev = { kind: 'newSeason', t: 0 }; } else ev = { kind: 'retired', t: 0 }; }
        break;
      case 'retired':
        if (!ev.plaque) {
          ev.plaque = CR.retire(c);
          try { enshrine(ev.plaque); for (const a of c.awards) if (/CHAMPIONS|TROPHY|MVP/.test(a.name)) addTrophy({ name: a.name, season: a.year, team: a.team || ev.plaque.name }); } catch { /* */ }
          music.play('hud_hof', { fade: 2 });
        }
        if (ev.t > 2 && input.pressed('confirm')) go('records');
        break;
      default: ev = null;
    }
  }

  function drawStatusCard(ctx) {
    const team = getTeam(c.team);
    const col = team.colors.primary;
    glossBar(ctx, 40, 40, 400, 132, shadeHex(col, 0.15), shadeHex(col, -0.45));
    try { drawLogo(ctx, team, 92, 106, 90); } catch { /* */ }
    const light = lum(col) > 0.62;
    vText(ctx, `#${c.player.number} ${c.player.first} ${c.player.last}`.toUpperCase(), 148, 82, 19, { color: light ? '#111' : '#fff', weight: 0.2 });
    text(ctx, `${CR.POS_NAMES[c.player.pos]} · ${c.player.archeName || ''}`, 150, 104, { size: 12, weight: 900, color: light ? '#222' : '#ffd23a', spacing: 1 });
    text(ctx, `${stageLine(c)} · ${team.city.toUpperCase()} ${team.name.toUpperCase()}`, 150, 124, { size: 12, weight: 800, color: light ? '#222' : '#e6ebf5', spacing: 1 });
    const r = c.season.table[c.team] || { w: 0, l: 0 };
    text(ctx, `OVR ${c.player.ovr} · ${c.depth === 'starter' ? 'STARTER' : 'BACKUP'} · ${r.w}-${r.l}${c.stage === 'hs' ? ` · ${'★'.repeat(c.stars || 1)}` : ''}${c.rings ? ` · ${c.rings} RING${c.rings > 1 ? 'S' : ''}` : ''}`, 150, 152, { size: 13, weight: 900, color: light ? '#111' : '#ffffff', spacing: 1 });
  }

  function drawPhone(ctx) {
    const x = 590, y = 70, w = 330, h = 700;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-0.04);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    phoneBody(ctx, x, y, w, h, t);
    const sx = x + 26, sy = y + 34, sw = w - 52, sh = 300;
    drawApp(ctx, sx, sy, sw, sh);
    // a little screen glare
    const gl = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    gl.addColorStop(0, 'rgba(255,255,255,0.12)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
  }

  function drawApp(ctx, x, y, w, h) {
    if (ev) return drawEventApp(ctx, x, y, w, h);
    const titles = { home: getTeam(c.team).abbr + ' · HOME', next: 'NEXT GAME', schedule: 'SCHEDULE', texts: 'TEXTS', player: 'MY PLAYER', standings: 'STANDINGS', news: 'HEADLINES', settings: 'SETTINGS' };
    lcd(ctx, x, y, w, h, titles[app] || '', t);
    const top = y + 48;
    if (app === 'home') {
      homeItems().forEach((it, i) => {
        const yy = top + 8 + i * 28;
        if (i === sel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 16, w - 8, 24); }
        lcdText(ctx, `${i === sel ? '▶ ' : '  '}${it.label}`, x + 10, yy, { size: 13, weight: 800, color: i === sel ? '#ffffff' : LCD.ink });
      });
      return;
    }
    if (app === 'next') {
      const g = CR.nextGame(c);
      if (!g) { lcdText(ctx, 'NO GAMES LEFT', x + w / 2, top + 40, { align: 'center' }); return; }
      const opp = getTeam(g.opp);
      try { drawLogo(ctx, opp, x + w / 2, top + 50, 70); } catch { /* */ }
      lcdText(ctx, `${g.home ? 'vs' : '@'} ${opp.city} ${opp.name}`.toUpperCase(), x + w / 2, top + 108, { align: 'center', size: 12, weight: 900 });
      const r = c.season.table[g.opp] || { w: 0, l: 0 };
      lcdText(ctx, `${CR.gameLabel(c, g)} · THEY'RE ${r.w}-${r.l}`, x + w / 2, top + 128, { align: 'center', size: 11, color: LCD.dim });
      lcdText(ctx, `YOU: ${c.depth === 'starter' ? 'STARTING' : 'OFF THE BENCH'}`, x + w / 2, top + 150, { align: 'center', size: 12, color: LCD.hi });
      const R = teamRatings(opp);
      lcdText(ctx, `THEIR OVR ${R.ovr} · OFF ${R.off} · DEF ${R.def}`, x + w / 2, top + 170, { align: 'center', size: 11, color: LCD.dim });
      lcdText(ctx, '[OK] PLAY      [BACK] HOME', x + w / 2, top + 236, { align: 'center', size: 12, color: '#ffffff', weight: 900 });
      return;
    }
    if (app === 'schedule') {
      const gs = c.season.games;
      gs.slice(scroll, scroll + 9).forEach((g, i) => {
        const yy = top + 10 + i * 26;
        const opp = getTeam(g.opp);
        const res = g.result ? `${g.result.won ? 'W' : 'L'} ${g.result.us}-${g.result.them} ${g.result.grade}` : '—';
        lcdText(ctx, `${g.kind === 'regular' ? String(g.week).padStart(2, ' ') : '★ '} ${g.home ? 'vs' : '@ '} ${opp.abbr}`, x + 10, yy, { size: 12 });
        lcdText(ctx, res, x + w - 10, yy, { size: 12, align: 'right', color: g.result ? (g.result.won ? '#9dffb0' : '#ffb0a8') : LCD.dim });
      });
      return;
    }
    if (app === 'texts') {
      if (detail) {
        lcdText(ctx, detail.from, x + 10, top + 10, { size: 12, color: LCD.hi, weight: 900 });
        wrapLines(ctx, detail.body, w - 20, 12).slice(0, 10).forEach((l, i) => lcdText(ctx, l, x + 10, top + 34 + i * 18, { size: 12 }));
        return;
      }
      c.messages.slice(Math.max(0, sel - 7), Math.max(0, sel - 7) + 8).forEach((msg, k) => {
        const i = Math.max(0, sel - 7) + k;
        const yy = top + 10 + k * 30;
        if (i === sel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 14, w - 8, 28); }
        lcdText(ctx, `${msg.read ? ' ' : '●'} ${msg.from}`, x + 8, yy, { size: 11, weight: 900, color: msg.read ? LCD.dim : LCD.hi });
        lcdText(ctx, msg.body.slice(0, 30) + (msg.body.length > 30 ? '…' : ''), x + 18, yy + 12, { size: 10, color: LCD.ink });
      });
      return;
    }
    if (app === 'player') {
      const keys = CR.KEY_RATINGS[c.player.pos];
      lcdText(ctx, `OVR ${c.player.ovr}  ·  ${c.xp} XP`, x + w / 2, top + 6, { align: 'center', size: 13, weight: 900, color: LCD.hi });
      keys.forEach((k, i) => {
        const yy = top + 30 + i * 25;
        const v = c.player.r[k];
        if (i === sel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 15, w - 8, 22); }
        lcdText(ctx, (CR.RATING_NAMES[k] || k).slice(0, 14), x + 8, yy, { size: 11 });
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 130, yy - 9, 70, 7);
        ctx.fillStyle = v >= 85 ? '#9dffb0' : v >= 70 ? LCD.hi : '#ffb0a8'; ctx.fillRect(x + 130, yy - 9, 70 * v / 99, 7);
        lcdText(ctx, String(v), x + 210, yy, { size: 11, weight: 900 });
        lcdText(ctx, `${CR.trainCost(v)}`, x + w - 8, yy, { size: 10, align: 'right', color: c.xp >= CR.trainCost(v) ? '#9dffb0' : LCD.dim });
      });
      lcdText(ctx, '[OK] TRAIN +1 (COST IN XP)', x + w / 2, y + h - 10, { align: 'center', size: 10, color: LCD.dim });
      return;
    }
    if (app === 'standings') {
      const filt = c.stage === 'pro' ? (tm) => tm.conference === getTeam(c.team).conference : c.stage === 'college' ? (tm) => tm.conference === getTeam(c.team).conference : null;
      CR.standings(c, filt).slice(0, 10).forEach((r, i) => {
        const yy = top + 10 + i * 24;
        const me = r.team.id === c.team;
        lcdText(ctx, `${String(i + 1).padStart(2, ' ')}. ${r.team.abbr}`, x + 10, yy, { size: 12, weight: me ? 900 : 700, color: me ? LCD.hi : LCD.ink });
        lcdText(ctx, `${r.w}-${r.l}`, x + w - 60, yy, { size: 12, align: 'right', color: me ? LCD.hi : LCD.ink });
        lcdText(ctx, `${r.pf - r.pa >= 0 ? '+' : ''}${r.pf - r.pa}`, x + w - 10, yy, { size: 11, align: 'right', color: LCD.dim });
      });
      return;
    }
    if (app === 'news') {
      let yy = top + 8;
      for (const n of c.news.slice(scroll, scroll + 6)) {
        for (const l of wrapLines(ctx, n.h, w - 20, 11).slice(0, 3)) { lcdText(ctx, l, x + 10, yy, { size: 11 }); yy += 15; }
        yy += 8;
      }
      return;
    }
    if (app === 'settings') {
      const S = c.settings || { qlen: 3, difficulty: 'pro' };
      [['QUARTERS', `${S.qlen} MIN`], ['SKILL LEVEL', S.difficulty.toUpperCase()]].forEach(([k, v], i) => {
        const yy = top + 20 + i * 36;
        if (i === sel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 16, w - 8, 26); }
        lcdText(ctx, k, x + 10, yy, { size: 12 });
        lcdText(ctx, `◀ ${v} ▶`, x + w - 10, yy, { size: 12, align: 'right', color: LCD.hi });
      });
    }
  }

  function drawEventApp(ctx, x, y, w, h) {
    const k = ev.kind;
    if (k === 'signing') {
      lcd(ctx, x, y, w, h, `SIGNING DAY · ${'★'.repeat(ev.stars)}`, t);
      lcdText(ctx, 'THEY WANT YOU. PICK ONE.', x + w / 2, y + 62, { align: 'center', size: 12, color: LCD.hi, weight: 900 });
      ev.offers.forEach((id, i) => {
        const tm = getTeam(id);
        const yy = y + 92 + i * 34;
        if (i === evSel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 18, w - 8, 30); }
        try { drawLogo(ctx, tm, x + 22, yy - 4, 26); } catch { /* */ }
        lcdText(ctx, `${tm.city}`.toUpperCase().slice(0, 18), x + 42, yy - 4, { size: 11, weight: 900 });
        lcdText(ctx, `${(tm.conference || '').toUpperCase()} · OVR ${teamRatings(tm).ovr}`, x + 42, yy + 8, { size: 9, color: LCD.dim });
      });
      return;
    }
    if (k === 'declare') {
      lcd(ctx, x, y, w, h, 'DECISION', t);
      wrapLines(ctx, 'The scouts say you\'re ready. The Sevens League draft is in April.', w - 20, 12).forEach((l, i) => lcdText(ctx, l, x + 10, y + 70 + i * 17, { size: 12 }));
      ['DECLARE FOR THE DRAFT', ...(ev.canStay ? ['STAY FOR SENIOR YEAR'] : [])].forEach((l, i) => {
        const yy = y + 170 + i * 34;
        if (i === evSel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 18, w - 8, 28); }
        lcdText(ctx, `${i === evSel ? '▶ ' : '  '}${l}`, x + 12, yy, { size: 13, weight: 900 });
      });
      return;
    }
    if (k === 'retireOption') {
      lcd(ctx, x, y, w, h, 'ANOTHER YEAR?', t);
      wrapLines(ctx, `Age ${c.age}. ${c.rings ? `${c.rings} ring${c.rings > 1 ? 's' : ''}.` : 'No rings yet.'} The body says one thing; the heart says another.`, w - 20, 12).forEach((l, i) => lcdText(ctx, l, x + 10, y + 70 + i * 17, { size: 12 }));
      ['PLAY ANOTHER SEASON', 'RETIRE'].forEach((l, i) => {
        const yy = y + 170 + i * 34;
        if (i === evSel) { ctx.fillStyle = LCD.sel; ctx.fillRect(x + 4, yy - 18, w - 8, 28); }
        lcdText(ctx, `${i === evSel ? '▶ ' : '  '}${l}`, x + 12, yy, { size: 13, weight: 900 });
      });
      return;
    }
    lcd(ctx, x, y, w, h, 'NEW MESSAGE', t);
    lcdText(ctx, 'SEE THE TV', x + w / 2, y + 120, { align: 'center', size: 13 });
  }

  /** The big moments get the whole screen. */
  function drawEventBig(ctx) {
    if (!ev) return;
    const k = ev.kind;
    const a = easeOutCubic(clamp(ev.t / 0.5, 0, 1));
    if (k === 'committed') {
      const tm = getTeam(ev.team);
      ctx.fillStyle = `rgba(0,0,0,${0.7 * a})`; ctx.fillRect(0, 0, 1024, 768);
      try { drawLogo(ctx, tm, 512, 300, 220 * easeOutBack(clamp(ev.t / 0.6, 0, 1))); } catch { /* */ }
      vText(ctx, 'COMMITTED!', 512, 470, 50, { align: 'center', color: '#ffd23a', weight: 0.2, outline: 3, outlineColor: 'rgba(0,0,0,0.7)' });
      text(ctx, `${c.player.first} ${c.player.last} · ${tm.city} ${tm.name}`.toUpperCase(), 512, 510, { size: 18, weight: 900, color: '#ffffff', align: 'center', spacing: 2 });
      if (ev.t > 1) hints(ctx, [['confirm', 'CONTINUE']]);
    } else if (k === 'draft' || k === 'drafted') {
      // the draft on TV: the podium, the ticker, the pick
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, 1024, 768);
      const sp = ctx.createRadialGradient(512, 200, 20, 512, 300, 600);
      sp.addColorStop(0, 'rgba(70,110,200,0.45)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sp; ctx.fillRect(0, 0, 1024, 768);
      vText(ctx, 'THE SEVENS LEAGUE DRAFT', 512, 100, 34, { align: 'center', color: '#ffffff', weight: 0.18, outline: 3, outlineColor: 'rgba(0,0,0,0.6)' });
      if (Math.floor(ev.t * 2) % 2 === 0) text(ctx, '● LIVE', 900, 80, { size: 14, weight: 900, color: '#ff3d52' });
      const d = ev.d;
      const tm = getTeam(d.team);
      const reveal = !(k === 'draft' && ev.t < 3.2);
      // the board: the picks just before yours, then yours when it's in
      const board = ev.board || (ev.board = CR.draftBoard(c, d));
      glossBar(ctx, 52, 150, 300, 30, '#ffd23a', '#c99a14');
      vText(ctx, d.undrafted ? 'ROUND 3 · THE LAST PICKS' : `ROUND ${d.round} · THE BOARD`, 66, 172, 16, { color: '#1a1400', weight: 0.2 });
      const since = k === 'draft' ? ev.t - 3.2 : 9;
      let shown = 0;
      board.forEach((row, i) => {
        // the picks after yours come in once your name is called
        if (row.after && (!reveal || since < 1 + shown++ * 0.6)) return;
        const y = 180 + i * 50;
        const t2 = getTeam(row.team);
        const mine = row.me && reveal;
        glossBar(ctx, 52, y, 300, 48, mine ? '#3a3410' : '#1b2232', mine ? '#14120a' : '#070a12', false);
        text(ctx, String(row.n), 74, y + 30, { size: 15, weight: 900, color: mine ? '#ffd23a' : '#8a93a6', align: 'center' });
        try { drawLogo(ctx, t2, 112, y + 24, 34); } catch { /* */ }
        if (row.me) {
          text(ctx, reveal ? `${c.player.first[0]}. ${c.player.last}`.toUpperCase() : 'ON THE CLOCK', 138, y + 22, { size: 14, weight: 900, color: reveal ? '#ffd23a' : '#ff6b6b', spacing: 1 });
          text(ctx, reveal ? `${c.player.pos} · ${getTeam(c.history.filter((h) => h.stage === 'college').pop()?.team || c.team).name.toUpperCase()}` : t2.name.toUpperCase(), 138, y + 39, { size: 10, weight: 800, color: '#cfd5df', spacing: 1 });
        } else {
          const nm = playerName(makeRng(row.seed));
          text(ctx, `${nm.first[0]}. ${nm.last}`.toUpperCase(), 138, y + 22, { size: 14, weight: 800, color: '#ffffff', spacing: 1 });
          text(ctx, `${row.pos} · ${getTeam(row.school).name.toUpperCase()}`, 138, y + 39, { size: 10, weight: 800, color: '#9aa3b4', spacing: 1 });
        }
      });
      const cx = 690;
      if (!reveal) {
        // on the clock: the team's card, the clock running down
        try { drawLogo(ctx, tm, cx, 290, 150); } catch { /* */ }
        text(ctx, d.undrafted ? 'THE PHONE ISN\'T RINGING...' : `${tm.city.toUpperCase()} ${tm.name.toUpperCase()} ARE ON THE CLOCK`, cx, 420, { size: 17, weight: 900, color: '#ffffff', align: 'center', spacing: 2 });
        if (!d.undrafted) vText(ctx, `0:${String(Math.max(0, 9 - Math.floor(ev.t * 2.5))).padStart(2, '0')}`, cx, 480, 40, { align: 'center', color: '#ff5a4a', weight: 0.2 });
        if (ev.t > 2.2) text(ctx, 'THE PICK IS IN', cx, 530, { size: 22, weight: 900, color: '#ffd23a', align: 'center', spacing: 3 });
      } else {
        try { drawLogo(ctx, tm, cx, 280, 190 * easeOutBack(clamp((ev.t - (k === 'draft' ? 3.2 : 0)) / 0.6, 0, 1))); } catch { /* */ }
        const line = d.undrafted ? `${tm.city.toUpperCase()} SIGNS YOU AS AN UNDRAFTED FREE AGENT` : `WITH PICK #${d.pick}, THE ${tm.city.toUpperCase()} ${tm.name.toUpperCase()} SELECT`;
        text(ctx, line, cx, 430, { size: 15, weight: 900, color: '#ffffff', align: 'center', spacing: 1 });
        vText(ctx, `${c.player.first} ${c.player.last}`.toUpperCase(), cx, 490, 42, { align: 'center', color: '#ffd23a', weight: 0.2, outline: 3, outlineColor: 'rgba(0,0,0,0.6)' });
        text(ctx, `${CR.POS_NAMES[c.player.pos]} · OVR ${c.player.ovr}`, cx, 528, { size: 15, weight: 900, color: '#cfd5df', align: 'center', spacing: 2 });
      }
      // the ticker (above the button prompt)
      glossBar(ctx, 0, 650, 1024, 32, '#38383e', '#0c0c0f', false);
      text(ctx, 'HCN DRAFT CENTER · LIVE FROM PORT HALCYON · TRADES · MEDICALS · COMBINE NUMBERS · ', 1024 - ((ev.t * 120) % 1600), 672, { size: 14, weight: 800, color: '#ffd23a', spacing: 2 });
      if (k === 'drafted') hints(ctx, [['confirm', 'CONTINUE']]);
    } else if (k === 'newSeason') {
      ctx.fillStyle = `rgba(0,0,0,${0.7 * a})`; ctx.fillRect(0, 0, 1024, 768);
      const tm = getTeam(c.team);
      try { drawLogo(ctx, tm, 512, 300, 180); } catch { /* */ }
      vText(ctx, `${STAGE_NAME[c.stage]} · ${stageLine(c)}`, 512, 450, 30, { align: 'center', color: '#ffffff', weight: 0.2 });
      text(ctx, `${tm.city} ${tm.name} · ${c.depth === 'starter' ? 'YOU START' : 'YOU\'RE THE BACKUP — EARN IT'}`.toUpperCase(), 512, 490, { size: 17, weight: 900, color: '#ffd23a', align: 'center', spacing: 2 });
      if (ev.t > 0.8) hints(ctx, [['confirm', 'CONTINUE']]);
    } else if (k === 'retired') {
      ctx.fillStyle = '#1a0f07'; ctx.fillRect(0, 0, 1024, 768);
      const p = ev.plaque;
      vText(ctx, 'HALL OF FAME', 512, 120, 46, { align: 'center', color: '#f1d58a', weight: 0.18 });
      if (p) {
        const g = ctx.createLinearGradient(262, 180, 762, 560);
        g.addColorStop(0, '#f1d58a'); g.addColorStop(0.5, '#b88a35'); g.addColorStop(1, '#e2bd63');
        ctx.fillStyle = g; ctx.fillRect(262, 180, 500, 380);
        ctx.strokeStyle = '#5a3c10'; ctx.lineWidth = 3; ctx.strokeRect(272, 190, 480, 360);
        text(ctx, p.name.toUpperCase(), 512, 250, { size: 30, weight: 900, color: '#3a2508', align: 'center', shadow: false });
        text(ctx, `${p.pos} · ${p.years}`, 512, 284, { size: 16, weight: 900, color: '#3a2508', align: 'center', shadow: false });
        text(ctx, p.teams.toUpperCase(), 512, 316, { size: 13, weight: 800, color: '#3a2508', align: 'center', shadow: false });
        text(ctx, p.line, 512, 360, { size: 15, weight: 800, color: '#3a2508', align: 'center', shadow: false });
        text(ctx, p.rings ? `${p.rings} GLORY BOWL RING${p.rings > 1 ? 'S' : ''}` : 'A CAREER TO REMEMBER', 512, 400, { size: 18, weight: 900, color: '#3a2508', align: 'center', shadow: false });
        CR.groupAwards(p.awards || []).filter((x) => /TROPHY|MVP|ALL-/.test(x)).slice(0, 4).forEach((aw, i) => text(ctx, aw, 512, 440 + i * 22, { size: 12, weight: 900, color: '#3a2508', align: 'center', shadow: false }));
      }
      if (ev.t > 2) hints(ctx, [['confirm', 'THE HALL']]);
    }
  }

  function drawOverlay(ctx) {
    if (!overlay) return;
    const a = easeOutCubic(clamp(overlay.t / 0.4, 0, 1));
    ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`; ctx.fillRect(0, 0, 1024, 768);
    if (overlay.kind === 'welcome') {
      panel(ctx, 200, 230, 624, 260, { accentLen: 260 });
      vText(ctx, 'ROAD TO GLORY', 512, 290, 34, { align: 'center', color: '#ffd23a', weight: 0.18 });
      paragraph(ctx, `${c.player.first}, it's your senior year at ${getTeam(c.team).city}. Play well and the colleges will call. Everything lands on your phone: the schedule, your texts, the headlines, and the training you buy with XP.`, 232, 330, 560, { size: 16, color: '#dfe6f2' });
      if (overlay.t > 0.6) hints(ctx, [['confirm', 'LET\'S GO']]);
    } else if (overlay.kind === 'postgame') {
      const s = overlay.s;
      panel(ctx, 212, 170, 600, 400, { accentLen: 260, accent: s.won ? C.green : C.red });
      vText(ctx, s.won ? 'WIN' : 'LOSS', 250, 236, 44, { color: s.won ? '#7dffa8' : '#ff8a8a', weight: 0.2 });
      vText(ctx, `${s.us}-${s.them}`, 786, 236, 44, { align: 'right', color: '#ffffff', weight: 0.2 });
      text(ctx, 'YOUR GAME', 252, 292, { size: 12, weight: 900, color: C.dim, spacing: 3 });
      text(ctx, s.line || '', 252, 318, { size: 17, weight: 800, color: '#ffffff' });
      text(ctx, 'GRADE', 252, 372, { size: 12, weight: 900, color: C.dim, spacing: 3 });
      vText(ctx, s.grade, 330, 420, 64, { color: s.grade.startsWith('A') ? '#7dffa8' : s.grade.startsWith('B') ? '#ffd23a' : '#ff8a8a', weight: 0.22 });
      text(ctx, `+${s.xp} XP`, 470, 404, { size: 22, weight: 900, color: '#ffd23a' });
      if (c.news[0]) paragraph(ctx, c.news[0].h, 252, 470, 520, { size: 13, color: '#aeb8cc', weight: 800 });
      if (overlay.t > 0.6) hints(ctx, [['confirm', 'CONTINUE']]);
    }
  }

  return {
    async enter(params = {}) {
      c = CR.loadCareer();
      t = 0;
      if (params.result && c) {
        const s = CR.applyGame(c, params.result);
        overlay = s ? { kind: 'postgame', s, t: 0 } : null;
      }
      if (!c || c.stage === 'retired') {
        startCreate();
        setMode('create');
        await buildCreateScene();
        music.play('hud_glory', { fade: 1 });
      } else {
        setMode('hub');
        app = 'home'; sel = 0;
        music.play('career_hub', { fade: 1.5 });
      }
    },
    exit() { disposeScene(); },
    view() { return mode === 'create' && scene && camera ? { scene, camera } : null; },
    update(dt, busy) {
      t += dt; modeT += dt;
      if (busy) return;
      if (mode === 'create') updateCreate(dt);
      else updateHub(dt);
    },
    draw(ctx) {
      if (mode === 'create') { drawCreate(ctx); return; }
      if (!c) return;
      ctx.drawImage(roomCanvas(c), 0, 0, 1024, 768);
      drawStatusCard(ctx);
      // the last headline, like a ticker on the desk TV
      if (c.news[0]) { glossBar(ctx, 40, 186, 520, 30, '#38383e', '#0c0c0f', false); text(ctx, c.news[0].h.slice(0, 64), 52, 207, { size: 12, weight: 800, color: '#ffd23a', spacing: 1 }); }
      drawPhone(ctx);
      if (!ev && !overlay) hints(ctx, [['ud', 'SCROLL'], ['confirm', 'OPEN'], ['back', app === 'home' ? 'MAIN MENU' : 'BACK']]);
      drawEventBig(ctx);
      drawOverlay(ctx);
    },
  };
});
