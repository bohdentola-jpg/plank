// Plug's capsule machines: pick a machine (or a free pull / ticket), watch it
// crank, and crack the capsule open. Odds and pity are shown up front.
import { el, openOverlay, xButton } from './dom.js';
import { drawProduct } from '../art/products.js';
import { drawNpcPortrait } from '../art/figure.js';
import { RARITIES, RARITY_ORDER } from '../data/items.js';
import { CAPSULES, TICKETS, PRISMATIC_CHANCE } from '../data/content.js';
import { ellipse, rrect, dot, text, FONTS, INK, rgba, shade, mulberry32 } from '../ink.js';
import * as E from '../systems/econ.js';
import * as audio from '../audio.js';
import { toast } from './hud.js';
import { rarityChip, fmt } from './shop.js';

let api = { wear: () => {} };
export function initCapsules(a) { api = { ...api, ...a }; }

const MACHINE_COLOR = { basic: '#3ec7b0', deluxe: '#ff4f9a', ticket: '#ffc93d' };
const CAP_COLORS = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff', '#ff8a3d', '#5aa0ff', '#6dff9a', '#f4efe6'];

function oddsTable(odds) {
  const box = el('div', { class: 'odds' });
  for (const r of RARITY_ORDER) {
    if (!odds[r]) continue;
    box.append(el('div', { class: `odds-row r-${r}` }, el('span', {}, RARITIES[r].name), el('b', {}, `${odds[r] < 1 ? odds[r].toFixed(1) : odds[r]}%`)));
  }
  return box;
}

export function openCapsules(machine = 'basic') {
  openOverlay('capsules', (panel, close) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const face = el('canvas', { class: 'panel-portrait', width: Math.round(96 * dpr), height: Math.round(96 * dpr), 'aria-hidden': 'true' });
    face.style.background = '#e8456b';
    const speech = el('div', { class: 'speech' }, 'Every capsule could be the one. Most aren’t. That’s the fun.');
    panel.append(el('div', { class: 'panel-head' }, face, el('div', { style: { minWidth: '0' } }, el('h2', { class: 'panel-title', style: { color: '#e8456b' } }, 'CAPSULES'), speech)));
    const stage = el('div', { class: 'cap-stage' });
    const canvas = el('canvas', { class: 'cap-canvas', 'aria-label': 'Capsule machine' });
    const reveal = el('div', { class: 'cap-reveal', hidden: true });
    stage.append(canvas, reveal);
    const controls = el('div', { class: 'cap-controls' });
    const body = el('div', { class: 'panel-body cap-body' }, stage, controls);
    panel.append(body, xButton(close));

    const g = canvas.getContext('2d');
    let mode = machine; // basic | deluxe
    let anim = null; // { how, t, res }
    let talkUntil = 0;
    const say = (line) => { speech.textContent = line; talkUntil = performance.now() + 1800; };

    const size = () => {
      const r = stage.getBoundingClientRect();
      canvas.width = Math.max(10, Math.round(r.width * dpr));
      canvas.height = Math.max(10, Math.round(r.height * dpr));
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null;
    if (ro) ro.observe(stage);

    const renderControls = () => {
      controls.innerHTML = '';
      const tabs = el('div', { class: 'chips', role: 'group', 'aria-label': 'Machine' });
      for (const m of ['basic', 'deluxe']) {
        const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': mode === m ? 'true' : 'false' }, CAPSULES[m].name);
        b.addEventListener('click', () => { if (anim) return; mode = m; audio.click(); renderControls(); });
        tabs.append(b);
      }
      const cap = CAPSULES[mode];
      const pulls = el('div', { class: 'row' });
      if (mode === 'basic' && E.freePullReady()) {
        pulls.append(el('button', { type: 'button', class: 'btn btn-go big', onclick: () => go('free') }, 'FREE DAILY PULL'));
      }
      pulls.append(el('button', { type: 'button', class: 'btn btn-hot', disabled: E.S.tokens < cap.cost, onclick: () => go(mode) }, el('span', { class: 'tok-ico' }), `PULL · ${fmt(cap.cost)}`));
      const tix = el('div', { class: 'row' });
      for (const k of ['basic', 'epic', 'legendary']) {
        if (!E.S.tickets[k]) continue;
        tix.append(el('button', { type: 'button', class: `btn btn-sm ticket t-${k}`, onclick: () => go(`ticket:${k}`) }, `USE ${TICKETS[k].name} (${E.S.tickets[k]})`));
      }
      const pity = cap.pity;
      controls.append(...[tabs, pulls, tix.childElementCount ? tix : null,
        el('p', { class: 'note' }, `${RARITIES[pity.min].name} or better guaranteed within ${E.pityLeft(mode)} pull${E.pityLeft(mode) === 1 ? '' : 's'}. Any pull has a 1 in ${Math.round(1 / PRISMATIC_CHANCE)} chance to come out PRISMATIC. Duplicates turn into tokens.`),
        el('details', { class: 'odds-box' }, el('summary', {}, 'SEE THE ODDS'), oddsTable(cap.odds))].filter(Boolean));
    };

    const go = (how) => {
      if (anim) return;
      const res = E.pull(how);
      if (res.err) {
        audio.beepBad();
        toast(res.err, 'hot');
        return;
      }
      reveal.hidden = true;
      anim = { how, t: 0, res, machine: how.startsWith('ticket:') && how !== 'ticket:basic' ? 'ticket' : how === 'deluxe' ? 'deluxe' : 'basic', cracked: false, ticks: 0 };
      say(['Crank it...', 'Here we go...', 'Feelin’ lucky?'][Math.floor(Math.random() * 3)]);
      controls.classList.add('busy');
    };

    const showReveal = () => {
      const { res } = anim;
      const it = res.item;
      const r = RARITIES[it.rarity];
      reveal.innerHTML = '';
      reveal.hidden = false;
      reveal.className = `cap-reveal r-${it.rarity}${res.prismatic ? ' prism' : ''}`;
      const status = res.isNew ? 'NEW!' : res.upgraded ? 'PRISMATIC UPGRADE!' : `DUPLICATE · +${fmt(res.scrap)} TOKENS`;
      reveal.append(
        rarityChip(it.rarity, res.prismatic),
        el('h3', {}, it.name),
        el('p', { class: 'cap-status' }, status),
        el('div', { class: 'row', style: { justifyContent: 'center' } },
          res.isNew || res.upgraded ? el('button', { type: 'button', class: 'btn btn-go', onclick: () => { E.equip(it.slot, it.id); audio.pop(); close(); api.wear(it); } }, 'WEAR IT') : null,
          el('button', { type: 'button', class: 'btn btn-sun', onclick: () => { reveal.hidden = true; anim = null; controls.classList.remove('busy'); renderControls(); } }, 'AGAIN'),
          el('button', { type: 'button', class: 'btn btn-ghost', onclick: close }, 'DONE')));
      say(r.rank >= 5 ? '...I need to sit down. That’s a MYTHIC.' : r.rank >= 4 ? 'LEGENDARY! The whole car heard that.' : r.rank >= 3 ? 'Ooh, an epic. Not bad, not bad.' : res.isNew ? 'A new one for the closet.' : 'Seen it before? Tokens back, no hard feelings.');
      renderControls();
      controls.classList.add('busy');
    };

    // ------------------------------------------------ drawing
    const caps = Array.from({ length: 26 }, (_, i) => {
      const r = mulberry32(i * 77 + 3);
      return { x: (r() - 0.5) * 150, y: (r() - 0.5) * 120 + 20, c: CAP_COLORS[i % CAP_COLORS.length], rot: r() * 6 };
    });

    const drawMachine = (t, col, crank, jiggle) => {
      // globe
      ellipse(g, 200, 170, 118, 112, { fill: rgba('#dff6ff', 0.55), lw: 5, seed: 3 });
      g.save();
      g.beginPath();
      g.arc(200, 170, 110, 0, Math.PI * 2);
      g.clip();
      for (const c of caps) {
        const jx = jiggle ? Math.sin(t * 30 + c.rot) * 3 : 0;
        const cx = 200 + c.x + jx, cy = 170 + c.y + (jiggle ? Math.cos(t * 26 + c.rot) * 3 : 0);
        g.save();
        g.translate(cx, cy);
        g.rotate(c.rot);
        g.fillStyle = c.c;
        g.beginPath(); g.arc(0, 0, 17, Math.PI, 0); g.fill();
        g.fillStyle = '#fffaf0';
        g.beginPath(); g.arc(0, 0, 17, 0, Math.PI); g.fill();
        g.strokeStyle = INK; g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      g.restore();
      g.fillStyle = rgba('#ffffff', 0.5);
      g.beginPath(); g.ellipse(160, 115, 26, 46, -0.5, 0, Math.PI * 2); g.fill();
      // body
      rrect(g, 108, 262, 184, 30, 10, { fill: shade(col, 0.1), lw: 5, seed: 4 });
      rrect(g, 96, 288, 208, 160, 18, { fill: col, shade: shade(col, 0.25), sdx: 0, sdy: 8, lw: 5, seed: 5 });
      // coin slot + crank
      rrect(g, 128, 312, 50, 34, 6, { fill: '#2a2238', lw: 4, seed: 6 });
      rrect(g, 148, 318, 10, 22, 3, { fill: '#7a7290', lw: 0, seed: 7 });
      ellipse(g, 248, 330, 26, 26, { fill: '#e8ecf4', lw: 4, seed: 8 });
      g.save();
      g.translate(248, 330);
      g.rotate(crank);
      rrect(g, -6, -38, 12, 40, 5, { fill: '#c8ccdc', lw: 3.4, seed: 9 });
      ellipse(g, 0, -40, 10, 10, { fill: '#ff4f4f', lw: 3.4, seed: 10 });
      g.restore();
      // tray
      rrect(g, 150, 372, 100, 58, 14, { fill: '#2a2238', lw: 4, seed: 11 });
      text(g, mode === 'deluxe' ? 'DELUXE' : 'BASIC', 200, 470, { size: 22, font: FONTS.sign, fill: '#fffaf0', lw: 5 });
    };

    const drawCapsule = (x, y, s, rot, col, open, glowCol, t) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(s, s);
      // the halves fly apart and fade so the prize takes the stage
      g.globalAlpha *= Math.max(0, 1 - open * 1.1);
      if (glowCol) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gl = g.createRadialGradient(0, 0, 4, 0, 0, 70);
        gl.addColorStop(0, rgba(glowCol, 0.6));
        gl.addColorStop(1, rgba(glowCol, 0));
        g.fillStyle = gl;
        g.fillRect(-80, -80, 160, 160);
        g.restore();
      }
      const off = open * 90;
      g.save();
      g.translate(0, -off);
      g.rotate(-open * 0.8);
      g.fillStyle = col;
      g.beginPath(); g.arc(0, 0, 30, Math.PI, 0); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
      g.fillStyle = rgba('#ffffff', 0.4);
      g.beginPath(); g.ellipse(-10, -16, 9, 5, -0.5, 0, Math.PI * 2); g.fill();
      g.restore();
      g.save();
      g.translate(0, off);
      g.rotate(open * 0.6);
      g.fillStyle = '#fffaf0';
      g.beginPath(); g.arc(0, 0, 30, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
      g.restore();
      g.restore();
    };

    let shake = 0, lastMs = 0;
    const loop = (ms) => {
      raf = requestAnimationFrame(loop);
      const t = ms / 1000;
      const dt = Math.min(0.1, lastMs ? (ms - lastMs) / 1000 : 1 / 60);
      lastMs = ms;
      drawNpcPortrait(face, 'plug', { t, talk: ms < talkUntil, blink: (t % 3.3) < 0.12 ? 1 : 0, boil: 11 + (Math.floor(t * 7) % 3) * 101 });
      const W = canvas.width, H = canvas.height;
      if (W < 20) { size(); return; }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      const k = Math.min(W / 400, H / 500);
      g.setTransform(k, 0, 0, k, (W - 400 * k) / 2 + (shake ? (Math.random() - 0.5) * shake * k : 0), (H - 500 * k) / 2);
      shake = Math.max(0, shake - 0.6);
      const col = MACHINE_COLOR[anim ? anim.machine : mode];
      if (!anim) {
        drawMachine(t, col, Math.sin(t * 1.5) * 0.08, false);
        return;
      }
      anim.t += dt;
      const a = anim.t;
      const rar = anim.res.item.rarity;
      const rc = RARITIES[rar];
      const capCol = rc.rank >= 5 ? '#ff4f9a' : CAP_COLORS[(anim.res.item.seed || 0) % CAP_COLORS.length];
      // crank 0..0.9
      const crank = a < 0.9 ? (a / 0.9) * Math.PI * 2 : Math.PI * 2;
      if (a < 0.9 && Math.floor(a * 8) !== anim.ticks) { anim.ticks = Math.floor(a * 8); audio.shuffleTick(); }
      drawMachine(t, col, crank, a < 0.9);
      if (a >= 0.9) {
        // drop + bounce into the tray, then wobble, then crack
        const d = Math.min(1, (a - 0.9) / 0.5);
        const y = 300 + d * d * 100 - (d >= 1 ? Math.abs(Math.sin((a - 1.4) * 9)) * 18 * Math.max(0, 1 - (a - 1.4) * 2) : 0);
        const wob = a > 1.5 ? Math.sin(a * (18 + rc.rank * 4)) * 0.12 * (1 + rc.rank * 0.25) : 0;
        if (a < 2.3) {
          const lift = a > 1.6 ? Math.min(1, (a - 1.6) / 0.6) : 0;
          drawCapsule(200, y - lift * 190, 1 + lift * 1.6, wob, capCol, 0, a > 1.8 && rc.rank >= 3 ? rc.color : null, t);
        } else {
          if (!anim.cracked) {
            anim.cracked = true;
            audio.pop();
            if (rc.rank >= 4) { audio.fanfare(); shake = rc.rank >= 5 ? 16 : 8; }
            else if (rc.rank >= 2) audio.coin(true);
            else audio.coin(false);
          }
          const o = Math.min(1, (a - 2.3) / 0.35);
          // light burst
          g.save();
          g.globalCompositeOperation = 'lighter';
          const rays = 14;
          for (let i = 0; i < rays; i++) {
            const ang = (i / rays) * Math.PI * 2 + t * 0.6;
            g.fillStyle = rc.rank >= 5 ? `hsla(${(i * 26 + t * 120) % 360},90%,65%,0.22)` : rgba(rc.color, 0.18);
            g.beginPath();
            g.moveTo(200, 120);
            g.lineTo(200 + Math.cos(ang - 0.08) * 400, 120 + Math.sin(ang - 0.08) * 400);
            g.lineTo(200 + Math.cos(ang + 0.08) * 400, 120 + Math.sin(ang + 0.08) * 400);
            g.fill();
          }
          g.restore();
          drawCapsule(200, 110, 2.6, 0, capCol, o, null, t);
          // the item, on a spotlight disc so it stands out from the gumballs
          const pop = Math.min(1, o * 1.3);
          const s = 1.8 * (0.4 + 0.6 * pop);
          g.save();
          g.globalAlpha *= pop;
          const disc = g.createRadialGradient(200, 128, 10, 200, 128, 104);
          disc.addColorStop(0, 'rgba(255,250,240,1)');
          disc.addColorStop(0.75, 'rgba(255,250,240,0.95)');
          disc.addColorStop(1, 'rgba(255,250,240,0)');
          g.fillStyle = disc;
          g.beginPath();
          g.arc(200, 128, 104, 0, Math.PI * 2);
          g.fill();
          g.lineWidth = 6;
          g.strokeStyle = rc.rank >= 5 ? `hsl(${(t * 120) % 360},90%,60%)` : rc.color;
          g.beginPath();
          g.arc(200, 128, 86, 0, Math.PI * 2);
          g.stroke();
          g.restore();
          drawProduct(g, anim.res.prismatic ? { ...anim.res.item.art, prismatic: true } : anim.res.item.art, 200, 128, s, anim.res.item.seed);
          if (anim.res.prismatic || rc.rank >= 5) {
            for (let i = 0; i < 10; i++) {
              const ang = t * 1.5 + i * 0.63;
              const rr = 104 + Math.sin(t * 3 + i) * 12;
              dot(g, 200 + Math.cos(ang) * rr, 128 + Math.sin(ang) * rr * 0.8, 3 + (i % 3), `hsl(${(i * 40 + t * 200) % 360},95%,70%)`);
            }
          }
          if (o >= 1 && reveal.hidden) showReveal();
        }
      }
    };
    let raf = requestAnimationFrame((ms) => { size(); loop(ms); });
    stage.addEventListener('click', () => {
      if (anim && !anim.cracked) anim.t = Math.max(anim.t, 2.29);
    });
    renderControls();
    return { onClose: () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); } };
  }, { label: 'Capsule machines', panelClass: 'cap-panel' });
}
