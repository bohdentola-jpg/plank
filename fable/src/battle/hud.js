// Battle HUD: scorebug + field strip, the squad bar (stamina / statuses /
// armed abilities), the huddle (play cards with drawn play art, ability chips,
// squad swap, snacks, kick options), throw-target bubbles, and the timing
// meters for the snap and kicks.
import { G } from '../core/game.js';
import { el, clamp, ordinal } from '../core/util.js';
import { ABILITIES, displayName, CAST } from '../data/cast.js';
import { OFF_FORM, DEF_FORM } from '../data/plays.js';
import { ITEMS } from '../data/items.js';

export const STATUS = {
  hyped: { icon: '🔥', name: 'Hyped', good: true, desc: 'Faster, surer hands.' },
  soggy: { icon: '💧', name: 'Soggy', desc: 'Slower, and can\'t juke.' },
  syrup: { icon: '🥞', name: 'Syrupy', desc: 'Stuck in syrup.' },
  spook: { icon: '👻', name: 'Spooked', desc: 'Too rattled to use their ability.' },
  dizzy: { icon: '💫', name: 'Dizzy', desc: 'Steering wobbles.' },
  butter: { icon: '🧈', name: 'Butterfingers', desc: 'Narrower catch timing.' },
  freeze: { icon: '🧊', name: 'Brain Freeze', desc: 'Slides around like it\'s on ice.' },
  glitch: { icon: '📺', name: 'Glitched', desc: 'Throw buttons scrambled, reads hidden.' },
  sticky: { icon: '🍬', name: 'Sticky', good: true, desc: 'Wider catch timing.' },
};

let cssDone = false;
function css() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.id = 'battle-css';
  s.textContent = `
.bug { position:absolute; left:0.8em; top:0.8em; background:rgba(27,16,36,0.92); color:var(--cream); border:0.2em solid var(--gold); border-radius:1em; padding:0.35em 0.8em 0.5em; min-width:17em; box-shadow:0 0.25em 0 rgba(27,16,36,0.5); }
.bug .teams { display:flex; align-items:center; gap:0.6em; font-weight:900; font-size:1.15em; }
.bug .t { display:flex; align-items:center; gap:0.35em; }
.bug .dot { width:0.8em; height:0.8em; border-radius:50%; border:0.12em solid var(--cream); }
.bug .sc { font-size:1.25em; min-width:1.2em; text-align:center; }
.bug .poss { color:var(--gold); font-size:0.8em; }
.bug .dd { font-weight:900; color:var(--gold); letter-spacing:.04em; margin-top:0.1em; }
.bug .sub { font-weight:700; font-size:0.82em; opacity:0.85; }
.strip { position:relative; height:0.9em; margin-top:0.4em; border-radius:0.3em; background:linear-gradient(90deg,#f08a24 0 10.7%,#5f9a4a 10.7% 89.3%,#3f6fb5 89.3%); overflow:hidden; border:0.1em solid var(--cream); }
.strip .los { position:absolute; top:0; bottom:0; width:0.18em; background:#fff; }
.strip .ltg { position:absolute; top:0; bottom:0; width:0.18em; background:var(--gold); }
.strip .bl { position:absolute; top:50%; width:0.6em; height:0.6em; margin:-0.3em 0 0 -0.3em; border-radius:50%; background:#8a4a26; border:0.1em solid #fff; }
.squadbar { position:absolute; left:50%; bottom:0.6em; transform:translateX(-50%); display:flex; gap:0.45em; }
.sq { position:relative; width:5.4em; background:rgba(255,244,220,0.95); border:0.18em solid var(--ink); border-radius:0.9em; padding:0.25em 0.3em 0.3em; text-align:center; box-shadow:0 0.2em 0 rgba(27,16,36,0.45); }
.sq img { width:3.1em; height:3.1em; border-radius:50%; background:var(--gold); border:0.14em solid var(--ink); display:block; margin:0 auto 0.1em; }
.sq .nm { font-weight:900; font-size:0.72em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sq .ro { position:absolute; left:-0.3em; top:-0.5em; background:var(--ink); color:var(--cream); font-size:0.62em; font-weight:900; padding:0.05em 0.45em; border-radius:0.6em; }
.sq .stt { position:absolute; right:-0.3em; top:-0.6em; font-size:0.85em; white-space:nowrap; }
.sq.armed { border-color:var(--maple); box-shadow:0 0 0 0.2em var(--gold), 0 0.2em 0 rgba(27,16,36,0.45); }
.sq.tired { background:#e9dccb; }
.sq.tired img { filter:grayscale(0.7); }
.sq.user { border-color:var(--teal); }
.sq .ab { font-size:0.62em; font-weight:800; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.huddle { position:absolute; left:50%; top:50%; transform:translate(-50%,-52%); width:min(60em,96vw); background:var(--cream); border:0.28em solid var(--ink); border-radius:1.4em; padding:0.9em 1.1em 1em; box-shadow:0 0.5em 0 rgba(27,16,36,0.6); pointer-events:auto; animation:panelin .22s cubic-bezier(.2,1.5,.4,1); }
.huddle h2 { margin:-1.7em 0 0.4em -0.2em; display:inline-block; background:var(--maple); color:var(--cream); border:0.2em solid var(--ink); border-radius:0.8em; padding:0.05em 0.9em; font-size:1.25em; transform:rotate(-1.5deg); }
.huddle .sit { float:right; font-weight:900; color:var(--maple); margin-top:-0.2em; }
.plays { display:grid; grid-template-columns:repeat(auto-fill,minmax(10.4em,1fr)); gap:0.5em; clear:both; max-height:46vh; overflow-y:auto; padding:0.2em; }
.play { display:flex; flex-direction:column; align-items:stretch; text-align:left; padding:0.3em 0.4em 0.35em; cursor:pointer; }
.play canvas { width:100%; border-radius:0.5em; background:#5f9a4a; display:block; }
.play .pn { font-weight:900; font-size:0.95em; margin-top:0.15em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.play .pk { position:absolute; margin:0.2em; }
.play .tagc { font-size:0.62em; font-weight:900; color:var(--maple); letter-spacing:.06em; }
.hud-desc { min-height:2.5em; font-weight:700; margin:0.4em 0.2em 0.3em; line-height:1.25; }
.abrow { display:flex; gap:0.4em; flex-wrap:wrap; margin:0.2em 0; }
.abchip { display:flex; align-items:center; gap:0.35em; padding:0.2em 0.6em; font-weight:800; font-size:0.86em; cursor:pointer; }
.abchip .cost { background:var(--ink); color:var(--cream); border-radius:0.6em; padding:0 0.4em; font-size:0.85em; }
.abchip.on { background:#ffe08a; border-color:var(--maple); }
.hrow { display:flex; gap:0.5em; flex-wrap:wrap; align-items:center; margin-top:0.5em; }
.tgt { position:absolute; transform:translate(-50%,-100%); min-width:1.9em; height:1.9em; line-height:1.7em; text-align:center; border-radius:50%; border:0.16em solid var(--ink); font-weight:900; font-size:1.15em; color:var(--ink); background:#b6f08a; box-shadow:0 0.15em 0 rgba(27,16,36,0.5); transition:background .12s; }
.tgt.mid { background:#ffd45a; } .tgt.bad { background:#ff8f7a; } .tgt.unk { background:#c9c2d6; }
.tgt small { display:block; position:absolute; left:50%; top:105%; transform:translateX(-50%); font-size:0.5em; line-height:1; color:var(--cream); text-shadow:0 0.1em 0 var(--ink); white-space:nowrap; }
.snapm { position:absolute; left:50%; top:26%; transform:translateX(-50%); text-align:center; }
.snapm .pips { display:flex; gap:0.7em; justify-content:center; }
.snapm .pip { width:4.6em; padding:0.25em 0; border-radius:0.9em; border:0.2em solid var(--ink); background:rgba(255,244,220,0.5); font-weight:900; color:var(--ink); opacity:0.55; transition:transform .08s; }
.snapm .pip.on { background:var(--gold); opacity:1; transform:scale(1.15); }
.snapm .pip.hike.on { background:var(--maple); color:var(--cream); }
.snapm .ringw { position:relative; width:7em; height:7em; margin:0.6em auto 0; }
.snapm .core { position:absolute; inset:2.4em; border-radius:50%; background:var(--gold); border:0.2em solid var(--ink); }
.snapm .ringo { position:absolute; left:50%; top:50%; border-radius:50%; border:0.3em solid var(--cream); box-shadow:0 0 0 0.12em var(--ink), inset 0 0 0 0.12em var(--ink); transform:translate(-50%,-50%); }
.snapm .tip { margin-top:0.3em; font-weight:900; color:var(--cream); text-shadow:0 0.1em 0 var(--ink); }
.kickm { position:absolute; left:50%; top:30%; transform:translateX(-50%); width:min(30em,80vw); text-align:center; }
.kickm .lab { font-weight:900; color:var(--cream); text-shadow:0 0.1em 0 var(--ink); margin-bottom:0.3em; font-size:1.1em; }
.kickm .meter { height:1.8em; }
.hintline { position:absolute; left:0; right:0; bottom:8.2em; text-align:center; font-weight:900; color:var(--cream); text-shadow:0 0.1em 0 var(--ink), 0 0 0.5em rgba(27,16,36,0.9); font-size:1em; }
.hintline .key { background:var(--gold); color:var(--ink); }
.darkness { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 50%, rgba(10,6,30,0.25), rgba(10,6,30,0.86)); opacity:0; transition:opacity .35s; pointer-events:none; }
.xprow { display:flex; align-items:center; gap:0.6em; margin:0.25em 0; font-weight:800; }
.xprow img { width:2.4em; height:2.4em; border-radius:50%; background:var(--gold); border:0.14em solid var(--ink); }
.xprow .bar { flex:1; }
.xprow .lv { min-width:3.2em; }
.final { text-align:center; font-weight:900; font-size:2.4em; color:var(--maple); line-height:1.1; }
.final small { display:block; font-size:0.45em; color:var(--ink); }
.statline { display:flex; flex-wrap:wrap; gap:0.3em 1em; justify-content:center; font-weight:800; margin:0.3em 0 0.6em; }
`;
  document.head.appendChild(s);
}

/** Draw a play diagram onto a small canvas. */
export function playArt(play, side = 'off', keys = null) {
  const c = document.createElement('canvas');
  c.width = 208; c.height = 120;
  const g = c.getContext('2d');
  g.fillStyle = '#5f9a4a'; g.fillRect(0, 0, 208, 120);
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 6; i++) if (i % 2) g.fillRect(i * 35, 0, 35, 120);
  const X = (x) => 44 + x * 7.2, Z = (z) => 60 + z * 5.6;
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(X(0), 4); g.lineTo(X(0), 116); g.stroke();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (side === 'off') {
    for (const [role, [fx, fz]] of Object.entries(OFF_FORM)) {
      const route = play.routes && play.routes[role];
      const isCarrier = play.type === 'run' && play.carrier === role;
      if (route) {
        g.strokeStyle = isCarrier ? '#ffd45a' : '#fff4dc'; g.lineWidth = isCarrier ? 4 : 3;
        g.beginPath(); g.moveTo(X(fx), Z(fz));
        let px = fx, pz = fz, lx = fx, lz = fz;
        for (const [dx, dz] of route) { lx = px; lz = pz; px = fx + dx; pz = fz + dz; g.lineTo(X(px), Z(pz)); }
        g.stroke();
        const a = Math.atan2(Z(pz) - Z(lz), X(px) - X(lx));
        g.fillStyle = g.strokeStyle;
        g.beginPath(); g.moveTo(X(px) + Math.cos(a) * 7, Z(pz) + Math.sin(a) * 7); g.lineTo(X(px) + Math.cos(a + 2.5) * 6, Z(pz) + Math.sin(a + 2.5) * 6); g.lineTo(X(px) + Math.cos(a - 2.5) * 6, Z(pz) + Math.sin(a - 2.5) * 6); g.fill();
      }
      g.fillStyle = role === 'QB' ? '#ffd45a' : role === 'LINE' ? '#d4502f' : '#fff4dc';
      g.strokeStyle = '#2b1a33'; g.lineWidth = 2;
      g.beginPath();
      if (role === 'LINE') g.rect(X(fx) - 6, Z(fz) - 6, 12, 12); else g.arc(X(fx), Z(fz), 6.5, 0, 6.3);
      g.fill(); g.stroke();
      const ki = (keys || play.keys || []).indexOf(role);
      if (ki >= 0) { g.fillStyle = '#2b1a33'; g.font = '900 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(ki + 1), X(fx), Z(fz) + 0.5); }
    }
  } else {
    // defence: show who rushes, who covers whom, and zones
    for (const [role, [fx, fz]] of Object.entries(OFF_FORM)) { g.fillStyle = 'rgba(255,244,220,0.45)'; g.beginPath(); g.arc(X(fx), Z(fz), 5, 0, 6.3); g.fill(); }
    for (const [role, [fx, fz]] of Object.entries(DEF_FORM)) {
      let col = '#9be8ff';
      if (play.rush.includes(role)) {
        col = '#ff8f7a';
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(X(fx), Z(fz)); g.lineTo(X(-3), Z(0)); g.stroke();
      } else if (play.man && play.man[role]) {
        const t = OFF_FORM[play.man[role]];
        g.strokeStyle = '#fff4dc'; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(X(fx), Z(fz)); g.lineTo(X(t[0]), Z(t[1])); g.stroke(); g.setLineDash([]);
      } else if (play.zones && play.zones[role]) {
        const [zx, zz] = play.zones[role];
        g.fillStyle = 'rgba(155,232,255,0.3)'; g.beginPath(); g.ellipse(X(zx), Z(zz), 26, 22, 0, 0, 6.3); g.fill();
      } else if (role === 'S') {
        g.fillStyle = 'rgba(255,212,90,0.3)'; g.beginPath(); g.ellipse(X(play.S === 'robber' ? 5 : 12), Z(0), 30, 36, 0, 0, 6.3); g.fill();
        col = '#ffd45a';
      }
      g.fillStyle = col; g.strokeStyle = '#2b1a33'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(fx), Z(fz) - 7); g.lineTo(X(fx) + 7, Z(fz) + 6); g.lineTo(X(fx) - 7, Z(fz) + 6); g.closePath(); g.fill(); g.stroke();
    }
  }
  return c;
}

export class BattleHud {
  constructor(root, battle) {
    css();
    this.b = battle;
    this.root = root;
    this.bug = el('div.bug');
    this.squad = el('div.squadbar');
    this.hint = el('div.hintline');
    this.dark = el('div.darkness');
    this.tg = el('div');
    root.append(this.dark, this.tg, this.bug, this.squad, this.hint);
    this.tgEls = [];
    this.snapEl = null;
    this._bugSig = '';
    this._sqSig = '';
  }

  setHint(html) { if (this._hint !== html) { this._hint = html; this.hint.innerHTML = html || ''; } }
  setDark(a) { this.dark.style.opacity = String(a); }

  scorebug(o) {
    const sig = JSON.stringify(o);
    if (sig === this._bugSig) return;
    this._bugSig = sig;
    const L = o.L, tot = L + o.EZ * 2;
    const pct = (x) => `${clamp(((x + o.EZ) / tot) * 100, 0, 100)}%`;
    this.bug.innerHTML = `
      <div class="teams">
        <div class="t"><span class="dot" style="background:${o.youColor}"></span>${o.youName} <span class="sc">${o.you}</span>${o.poss === 0 ? '<span class="poss">🏈</span>' : ''}</div>
        <span style="opacity:.5">·</span>
        <div class="t"><span class="dot" style="background:${o.themColor}"></span>${o.themName} <span class="sc">${o.them}</span>${o.poss === 1 ? '<span class="poss">🏈</span>' : ''}</div>
      </div>
      <div class="dd">${o.dd}</div>
      <div class="sub">${o.sub}</div>
      <div class="strip"><div class="los" style="left:${pct(o.losW)}"></div>${o.ltgW !== null ? `<div class="ltg" style="left:${pct(o.ltgW)}"></div>` : ''}<div class="bl" style="left:${pct(o.ballW)}"></div></div>`;
  }

  /** list: [{ id, name, portrait, role, st, max, statuses:[], armed, tired, user, ability }] */
  squadBar(list) {
    const sig = JSON.stringify(list.map((m) => [m.id, m.role, Math.round(m.st), m.statuses, m.armed, m.tired, m.user]));
    if (sig === this._sqSig) return;
    this._sqSig = sig;
    this.squad.innerHTML = '';
    for (const m of list) {
      const pct = clamp(m.st / m.max, 0, 1);
      this.squad.appendChild(el(`div.sq${m.armed ? '.armed' : ''}${m.tired ? '.tired' : ''}${m.user ? '.user' : ''}`,
        el('div.ro', m.role),
        el('div.stt', m.statuses.map((s) => (STATUS[s] ? STATUS[s].icon : '')).join('') + (m.tired ? '😮‍💨' : '')),
        el('img', { src: m.portrait }),
        el('div.nm', m.name),
        el(`div.bar${pct < 0.2 ? '.low' : pct < 0.5 ? '.mid' : ''}`, el('i', { style: { width: `${pct * 100}%` } })),
        m.armed ? el('div.ab', `${ABILITIES[m.ability].icon} armed`) : null));
    }
  }

  /** World-anchored throw bubbles. list: [{ pos:{x,y,z}, label, cls, sub }] */
  targets(list, camera) {
    while (this.tgEls.length < list.length) { const n = el('div.tgt'); this.tg.appendChild(n); this.tgEls.push(n); }
    this.tgEls.forEach((n, i) => {
      const t = list[i];
      if (!t) { n.style.display = 'none'; return; }
      n.style.display = '';
      const s = G.ui.project(t.pos, camera);
      n.style.left = `${s.x}px`; n.style.top = `${s.y}px`;
      const html = t.label + (t.sub ? `<small>${t.sub}</small>` : '');
      if (n._h !== html) { n._h = html; n.innerHTML = html; }
      const cls = `tgt ${t.cls || ''}`;
      if (n.className !== cls) n.className = cls;
    });
  }
  clearTargets() { for (const n of this.tgEls) n.style.display = 'none'; }

  // ---------------------------------------------------------------- snap meter
  showSnap(tip) {
    this.hideSnap();
    this.pips = [el('div.pip', 'HUT'), el('div.pip', 'HUT'), el('div.pip.hike', 'HIKE!')];
    this.ringO = el('div.ringo');
    this.snapEl = el('div.snapm', el('div.pips', this.pips), el('div.ringw', el('div.core'), this.ringO), el('div.tip', { html: tip }));
    this.root.appendChild(this.snapEl);
  }
  /** beat: 0..3 (float, 3 = the hike). */
  updateSnap(beat) {
    if (!this.snapEl) return;
    this.pips.forEach((p, i) => p.classList.toggle('on', beat >= i + 1 - 0.08 && beat < i + 1 + 0.5));
    const k = clamp(3 - beat, 0, 2.2);                 // beats until the hike
    const size = 2.2 + k * 3.2;                        // em: shrinks onto the core
    this.ringO.style.width = this.ringO.style.height = `${size}em`;
    this.ringO.style.opacity = beat > 3.4 ? '0' : '1';
  }
  hideSnap() { if (this.snapEl) { this.snapEl.remove(); this.snapEl = null; } }

  // ---------------------------------------------------------------- kick meter
  showKick(label, zone) {
    this.hideKick();
    this.kNeedle = el('b');
    this.kZone = el('em', { style: { left: `${(zone.c - zone.w / 2) * 100}%`, width: `${zone.w * 100}%` } });
    this.kickEl = el('div.kickm', el('div.lab', { html: label }), el('div.meter', this.kZone, this.kNeedle));
    this.root.appendChild(this.kickEl);
  }
  updateKick(p) { if (this.kNeedle) this.kNeedle.style.left = `calc(${p * 100}% - 0.15em)`; }
  hideKick() { if (this.kickEl) { this.kickEl.remove(); this.kickEl = null; } }

  // ---------------------------------------------------------------- the huddle
  /**
   * o: { title, sit, side, plays:[{id, play, tag?}], abilities:[{id, charId, name, ab, can, why, on}],
   *      extras:[{label, value, cls, disabled}], defaultId }
   * Resolves { play: id } or { extra: value }. Ability toggles call o.onToggle(charId).
   */
  huddle(o) {
    return new Promise((resolve) => {
      const desc = el('div.hud-desc');
      const setDesc = (html) => { desc.innerHTML = html; };
      const grid = el('div.plays');
      let layer = null;
      const done = (v) => { if (layer) layer.close(); resolve(v); };
      o.plays.forEach((p, i) => {
        const card = el(`button.card.play.focusable${p.id === o.defaultId ? '.first' : ''}`, { onclick: () => done({ play: p.id }) },
          playArt(p.play, o.side),
          el('div.pn', `${p.play.icon || ''} ${p.play.name}`),
          el('div.tagc', `${i < 9 ? `[${i + 1}] ` : ''}${p.tag || (o.side === 'def' ? 'COVERAGE' : p.play.type === 'run' ? 'RUN' : p.play.trick ? 'TRICK' : p.play.combo ? 'COMBO' : 'PASS')}`));
        card.addEventListener('focused', () => setDesc(p.play.desc || ''));
        card.addEventListener('pointerenter', () => setDesc(p.play.desc || ''));
        grid.appendChild(card);
      });
      const abRow = el('div.abrow');
      const renderAb = () => {
        abRow.innerHTML = '';
        for (const a of o.abilities) {
          const chip = el(`button.card.abchip.focusable${a.on ? '.on' : ''}${a.can ? '' : '.disabled'}`, {
            onclick: () => {
              if (!a.can) { G.audio.sfx('deny'); setDesc(a.why || 'Not available right now.'); return; }
              a.on = !a.on; o.onToggle(a.charId, a.on);
              chip.classList.toggle('on', a.on);
              G.audio.sfx(a.on ? 'ok' : 'back');
            },
          }, `${a.ab.icon} ${a.name}: ${a.ab.name}`, el('span.cost', `${a.ab.cost}`));
          const d = `<b>${a.ab.name}</b> (${a.ab.cost} stamina) — ${a.ab.desc}${a.can ? '' : ` <i>${a.why || ''}</i>`}`;
          chip.addEventListener('focused', () => setDesc(d));
          chip.addEventListener('pointerenter', () => setDesc(d));
          abRow.appendChild(chip);
        }
      };
      renderAb();
      const extras = el('div.hrow', (o.extras || []).map((x) => {
        const b = el(`button.btn.small.focusable${x.cls ? '.' + x.cls : '.alt'}${x.disabled ? '.disabled' : ''}`, { html: x.label, onclick: () => { if (x.disabled) { G.audio.sfx('deny'); return; } done({ extra: x.value }); } });
        if (x.desc) { b.addEventListener('focused', () => setDesc(x.desc)); b.addEventListener('pointerenter', () => setDesc(x.desc)); }
        return b;
      }));
      const box = el('div.huddle', el('h2', o.title), el('div.sit', { html: o.sit }), grid,
        o.abilities.length ? el('div.lbl', o.side === 'def' ? 'Arm abilities (stamina) — optional' : 'Arm abilities (stamina) — optional') : null,
        abRow, desc, extras);
      layer = G.ui.pushLayer({ el: box, blocking: true, focus: '.first', onUpdate: () => {
        for (let i = 0; i < Math.min(6, o.plays.length); i++) if (G.input.hit(`t${i + 1}`)) { G.audio.sfx('ok'); done({ play: o.plays[i].id }); return; }
      } });
      const first = box.querySelector('.play.first') || box.querySelector('.play');
      if (first) { layer.refocus(first); const p = o.plays.find((x) => x.id === o.defaultId) || o.plays[0]; setDesc(p.play.desc || ''); }
      this._huddleLayer = layer;
    });
  }

  dispose() { this.hideSnap(); this.hideKick(); }
}

export { displayName, CAST, ITEMS, ordinal };
