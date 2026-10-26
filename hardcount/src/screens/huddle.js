// MAIN MENU — you're the quarterback, in the huddle under the lights, and
// the modes are the plays on your wristband. Each line has its own music on
// the stadium PA. Call one and the huddle breaks.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { C, vText, vWidth, text, hints, panel, padGlyph, usingPad, keyCap, paragraph } from '../core/ui.js';
import { uiSound } from '../core/menu.js';
import { clamp, easeOutBack, easeOutCubic } from '../core/util.js';
import { getTeam, TEAMS } from '../data/teams.js';
import { buildRoster } from '../data/roster.js';
import { music } from '../audio/music.js';
import { crowd } from '../audio/crowd.js';
import { sfx } from '../audio/sfx.js';
import { drawLogo } from '../gfx/logos.js';
import { drawForearm } from '../match/wristband.js';

const MODES = [
  { id: 'glory', no: 1, name: 'ROAD TO GLORY', call: 'TRIPS RIGHT · GLORY', theme: 'hud_glory', screen: 'career',
    desc: 'Your career, one snap at a time. A high-school senior with a scholarship to earn, a college program to carry, the draft, the pros — and the Glory Bowl at the end of the road.' },
  { id: 'free', no: 2, name: 'FREE PLAY', call: 'GUN SPREAD · FREE', theme: 'hud_free', screen: 'cointoss',
    desc: 'Any two teams, any stadium, any weather. Play the CPU, a friend on a second controller, or sit back and watch.' },
  { id: 'practice', no: 3, name: 'PRACTICE', call: 'I-FORM · DRILL', theme: 'hud_practice', screen: 'practice',
    desc: 'Run your plays against any defense with nobody keeping score. Plus the drills: the pocket, the open field, the two-minute drill and the kicking net.' },
  { id: 'book', no: 4, name: 'PLAYBOOK', call: 'PRO SET · BOOK', theme: 'hud_book', screen: 'playbook',
    desc: 'Every play in the book, drawn the way the coaches draw it — formations, routes, reads, the option keys and the trick plays — run on the field in front of you.' },
  { id: 'hof', no: 5, name: 'HALL OF FAME', call: 'VICTORY · HOF', theme: 'hud_hof', screen: 'records',
    desc: 'Records, trophies and the careers that made them. Your best games, your longest plays, and every champion of the Sevens League.' },
  { id: 'options', no: 6, name: 'OPTIONS', call: 'MENU · TV', theme: 'hud_options', screen: 'options',
    desc: 'The picture, the sound, the rules of the game and the controller — straight from the television\'s own menu.' },
];

function blankA(over = {}) {
  return { x: 0, z: 0, heading: 0, speed: 0, moveAngle: 0, accel: 0, turnRate: 0, effort: 0.3, base: 'huddle', action: null, carry: null, look: null, reach: null, engage: null, dirt: 0, ...over };
}

registerScreen('huddle', () => {
  let scene = null, camera = null, venue = null;
  const players = [];
  let t = 0, sel = 0, selT = 0, breakT = -1, target = null, intro = 0;
  let team = null;
  let ready = false;
  const eye = 1.92;
  const H = { x: 0, z: -9 };                 // the huddle on the field (the QB stands here)
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

  async function build() {
    const fav = store.load('lastSetup')?.home || settings.get('favTeam') || 'pht';
    team = getTeam(fav) || TEAMS[0];
    let mod = null, pmod = null;
    try { mod = await import('../gfx/stadium/index.js'); } catch { /* */ }
    try { pmod = await import('../gfx/player/index.js'); } catch { /* */ }
    if (mod?.buildVenue) {
      try {
        venue = await mod.buildVenue(game.renderer.gl, { venue: team.venue || 'bayside', home: team, time: 'night', weather: 'clear', crowd: 0.55, quality: game.renderer.internalLines <= 480 ? 'low' : 'high' });
        scene = venue.scene;
        game.renderer.setPost({ ...(venue.post || {}), vignette: 0.75 }, true);
      } catch (e) { console.warn('huddle venue', e); }
    }
    if (!scene) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#05070d');
      scene.add(new THREE.HemisphereLight('#8aa0ff', '#1a2a12', 1.2));
      const key = new THREE.DirectionalLight('#ffffff', 2.4);
      key.position.set(8, 20, 10);
      scene.add(key);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#2d5a22', roughness: 0.95 }));
      g.rotation.x = -Math.PI / 2;
      scene.add(g);
    }
    camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.05, 1200);
    // six men around you: the line in the middle, the skill players on the ends
    const r = buildRoster(team);
    const cast = [r.depth.G[0], r.depth.C[0], r.depth.G[1], r.depth.WR[0], r.depth.RB[0], r.depth.TE[0]];
    const order = [cast[3], cast[0], cast[1], cast[2], cast[5], cast[4]];
    const n = order.length;
    order.forEach((p, i) => {
      const a = (-64 + (128 * i) / (n - 1)) * Math.PI / 180;
      const rr = 1.45 + (Math.abs(i - (n - 1) / 2) < 1 ? 0.12 : 0);
      const x = H.x + Math.sin(a) * rr, z = H.z + Math.cos(a) * rr;
      let model = null;
      try { model = pmod?.createPlayerModel ? pmod.createPlayerModel({ team, kit: 'home', player: p, lod: 'high' }) : null; } catch (e) { console.warn(e); }
      if (!model) return;
      scene.add(model.group);
      players.push({ model, A: blankA({ x, z, heading: Math.atan2(H.x - x, H.z - z), look: { x: H.x, y: eye, z: H.z } }), phase: i * 0.7 });
    });
    ready = true;
  }

  function choose(i) {
    if (breakT >= 0) return;
    target = MODES[i];
    breakT = 0;
    uiSound('select');
    try { sfx.cadence('set'); } catch { /* */ }
  }

  return {
    async enter(params = {}) {
      intro = params.intro ? 1 : 0;
      const last = store.load('menuSel');
      sel = clamp(last ?? 1, 0, MODES.length - 1);
      await build();
      music.play(MODES[sel].theme, { fade: 1.2 });
      try { crowd.update(0.016, { excitement: 0.25, size: 0.6, home: 0.85 }); } catch { /* */ }
    },
    exit() {
      try { venue?.dispose?.(); } catch { /* */ }
      for (const p of players) { try { p.model.dispose(); } catch { /* */ } }
      players.length = 0;
      try { crowd.stop(0.8); } catch { /* */ }
    },
    view() { return scene && camera ? { scene, camera } : null; },
    update(dt, busy) {
      if (!ready) return;
      t += dt; selT += dt;
      if (!busy && breakT < 0) {
        let moved = 0;
        if (input.pressed('up')) moved = -1;
        if (input.pressed('down')) moved = 1;
        if (moved) {
          sel = (sel + moved + MODES.length) % MODES.length;
          selT = 0;
          uiSound('move');
          music.play(MODES[sel].theme, { fade: 0.9 });
          store.save('menuSel', sel);
        }
        if (input.pressed('confirm')) choose(sel);
        if (input.takeClick()) {
          // a click on a wristband line
          const mx = input.mouse.x, my = input.mouse.y;
          for (let i = 0; i < MODES.length; i++) {
            const y = 172 + 18 + 28 + i * 58.6 + 30;
            if (mx > 70 && mx < 470 && my > y - 30 && my < y + 26) { if (i === sel) choose(i); else { sel = i; selT = 0; uiSound('move'); music.play(MODES[sel].theme, { fade: 0.9 }); } }
          }
        }
      }
      if (breakT >= 0) {
        breakT += dt;
        if (breakT > 1.25 && target) {
          const tg = target;
          target = null;
          go(tg.screen, { from: 'huddle' });
        }
      }
      // the huddle breathes; on the break, everybody claps
      for (const p of players) {
        const A = p.A;
        A.action = breakT > 0.55 && breakT < 1.15 ? { name: 'huddle_clap', t: breakT - 0.55, side: null, power: 1 } : null;
        p.model.update(dt, A);
      }
      // first person: a little sway, eyes down to the men on the break
      const sway = Math.sin(t * 0.9) * 0.025, bob = Math.sin(t * 1.7) * 0.012;
      camPos.set(H.x + sway, eye + bob, H.z - 0.15);
      const look = breakT > 0 ? clamp(breakT / 0.6, 0, 1) : 0;
      camLook.set(H.x + sway * 2, 1.15 - look * 0.25, H.z + 2.4);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.fov = 62;
      camera.updateProjectionMatrix();
      try { venue?.update(dt, { camera, excitement: 0.3, time: t }); } catch { /* */ }
      try { crowd.update(dt, { excitement: 0.22, size: 0.6, home: 0.85 }); } catch { /* */ }
    },
    draw(ctx) {
      if (!ready) return;
      const k = easeOutBack(clamp((t - 0.2) / 0.5, 0, 1));
      const out = breakT >= 0 ? easeOutCubic(clamp(breakT / 0.5, 0, 1)) : 0;
      // the title
      ctx.save();
      ctx.globalAlpha = 1 - out;
      vText(ctx, 'HARD COUNT', 64, 92, 46, { color: '#ffffff', weight: 0.17, outline: 4, outlineColor: 'rgba(0,0,0,0.75)', shadow: [3, 4, 'rgba(0,0,0,0.6)'] });
      text(ctx, '7-ON-7 FOOTBALL', 68, 118, { size: 15, weight: 900, color: C.accent, spacing: 6 });
      ctx.restore();
      // the arm and the band, raised into view
      const ax = 52, ay = 168 + (1 - k) * 520 + out * 520;
      ctx.save();
      ctx.translate(0, ay - 150);
      const kit = team.uniform?.home || {};
      drawForearm(ctx, ax + 2, 150, 432, 420, { skin: buildRoster(team).depth.QB[0].look?.skinHex || '#8d5a3a', sleeve: kit.jersey || team.colors.primary, trim: kit.numbers || team.colors.secondary });
      // band
      ctx.fillStyle = '#0d0e11';
      ctx.fillRect(ax + 2, 150, 432, 420);
      ctx.strokeStyle = 'rgba(200,200,200,0.3)';
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(ax + 10, 158, 416, 404);
      ctx.setLineDash([]);
      try { drawLogo(ctx, team, ax + 412, 176, 24, { flat: true }); } catch { /* */ }
      // the card
      const cx = ax + 22, cy = 172, cw = 392, ch = 380;
      ctx.fillStyle = '#efe9d8';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = '#16181d';
      ctx.fillRect(cx, cy, cw, 28);
      text(ctx, `${team.abbr} · CALL IT`, cx + 10, cy + 19, { size: 13, weight: 900, color: '#ffd23a', spacing: 2, shadow: false });
      text(ctx, 'MAIN MENU', cx + cw - 10, cy + 19, { size: 12, weight: 900, color: '#cfd5df', spacing: 2, align: 'right', shadow: false });
      MODES.forEach((md, i) => {
        const y = cy + 28 + i * 58.6;
        const on = i === sel;
        if (on) {
          ctx.fillStyle = `rgba(255,228,60,${0.62 + Math.sin(selT * 6) * 0.1})`;
          ctx.fillRect(cx + 3, y + 3, cw - 6, 52);
        }
        ctx.strokeStyle = 'rgba(30,30,30,0.3)';
        ctx.strokeRect(cx + 0.5, y + 0.5, cw - 1, 58);
        ctx.fillStyle = '#16181d';
        ctx.fillRect(cx + 8, y + 10, 34, 36);
        vText(ctx, String(md.no), cx + 25, y + 38, 24, { align: 'center', color: '#ffffff', weight: 0.2, skew: -0.1 });
        vText(ctx, md.name, cx + 54, y + 32, 21, { color: '#111111', weight: 0.2 });
        text(ctx, md.call, cx + 55, y + 50, { size: 11, weight: 800, color: '#55504a', spacing: 2, shadow: false });
        if (on) {
          ctx.strokeStyle = '#c4101f';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.ellipse(cx + 25, y + 28, 24, 22, -0.15, 0.25, Math.PI * 2.08);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      });
      // vinyl sheen
      const sh = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
      sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.4, 'rgba(255,255,255,0.02)'); sh.addColorStop(0.62, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.7, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(cx, cy, cw, ch);
      ctx.restore();
      // the description, on the right
      const md = MODES[sel];
      const dk = easeOutCubic(clamp(selT / 0.3, 0, 1));
      ctx.save();
      ctx.globalAlpha = (1 - out) * dk;
      panel(ctx, 560 + (1 - dk) * 30, 430, 410, 190, { accentLen: 180 });
      vText(ctx, md.name, 584 + (1 - dk) * 30, 474, 26, { color: '#ffffff', weight: 0.18 });
      paragraph(ctx, md.desc, 586 + (1 - dk) * 30, 504, 360, { size: 15, color: '#cfd5df', lineH: 21 });
      ctx.restore();
      // the call on the break
      if (breakT >= 0 && target) {
        const s = breakT < 0.55 ? `${target.name}, ON TWO... READY...` : 'BREAK!';
        vText(ctx, s, 512, 700, breakT < 0.55 ? 22 : 40, { align: 'center', color: '#ffd23a', weight: 0.2, outline: 3, outlineColor: 'rgba(0,0,0,0.7)' });
      }
      if (breakT < 0) hints(ctx, [['ud', 'CHOOSE'], ['confirm', 'CALL IT']]);
    },
  };
});

export { MODES };
