// In-game HUD: scorebug, down & distance, receiver icons, lateral prompt, kick meter, results, control hints.
import { el, fmtClock } from '../util.js';
import { input, FACE_ORDER, GLYPH } from '../input.js';

export class HUD {
  constructor(app, sim, cam) {
    this.app = app; this.sim = sim; this.cam = cam; this.root = app.hud; this.icons = []; this.resultT = 0;
    this.bug = el('div', { class: 'scorebug' }); this.down = el('div', { class: 'downbox' }); this.hint = el('div', { class: 'game-hint' });
    this.result = el('div', { class: 'playresult' }); this.result.style.display = 'none';
    this.meter = el('div', { class: 'meter' }, el('i'), el('b')); this.meter.style.display = 'none'; this.meterLabel = el('div', { class: 'meter-label' }); this.meterLabel.style.display = 'none';
    this.stamina = el('div', { class: 'stamina' }, el('i')); this.stamina.style.display = 'none';
    this.iconLayer = el('div', { style: { position: 'fixed', inset: '0', pointerEvents: 'none' } });
    this.lateral = el('div', { class: 'recv-icon', style: { '--gc': '#e8e8ff', width: '34px', height: '34px', fontSize: '13px' } }, 'L1'); this.lateral.style.display = 'none';
    this.root.append(this.bug, this.down, this.hint, this.result, this.meter, this.meterLabel, this.stamina, this.iconLayer, this.lateral);
    this.lastBug = ''; this.lastDown = ''; this.lastHint = '';
  }
  refreshBug() {
    const s = this.sim; const h = s.home, a = s.away; const q = s.quarter === 'OT' ? 'OT' : `Q${s.quarter}`;
    const key = `${s.score.home}|${s.score.away}|${Math.ceil(s.clock)}|${q}|${s.possession}`;
    if (key === this.lastBug) return; this.lastBug = key;
    const clockTxt = s.mode === 'game' ? fmtClock(s.clock) : s.mode === 'practice' ? 'PRACTICE' : 'DRILL';
    this.bug.innerHTML = `<div class="tm ${s.possession === 'home' ? 'poss' : ''}" style="background:${h.colors[0]}22;border-right:3px solid ${h.colors[0]}"><span style="color:${h.colors[0]};filter:brightness(1.6)">●</span> ${h.short}<span class="sc">${s.score.home}</span></div><div class="mid"><span class="clk">${clockTxt}</span><span class="q">${q}</span></div><div class="tm ${s.possession === 'away' ? 'poss' : ''}" style="background:${a.colors[0]}22;border-left:3px solid ${a.colors[0]}"><span style="color:${a.colors[0]};filter:brightness(1.6)">●</span> ${a.short}<span class="sc">${s.score.away}</span></div>`;
  }
  refreshDown() {
    const s = this.sim; let txt;
    if (s.phase === 'pat') txt = 'EXTRA POINT';
    else if (s.pendingTwo) txt = 'TWO-POINT TRY';
    else if (s.pendingKick === 'pat') txt = 'EXTRA POINT KICK';
    else txt = `<span>${s.downText()}</span> · BALL ON ${s.spotText().toUpperCase()}`;
    if (txt === this.lastDown) return; this.lastDown = txt; this.down.innerHTML = txt;
  }
  setHint(html) { if (html === this.lastHint) return; this.lastHint = html; this.hint.innerHTML = html; }
  showResult(text, cls = '', sub = '') { this.result.className = 'playresult ' + cls; this.result.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; this.result.style.display = 'block'; this.resultT = 2.2; }
  showMeter(val, label) { this.meter.style.display = 'block'; this.meterLabel.style.display = 'block'; this.meter.querySelector('i').style.width = `${val * 100}%`; this.meter.querySelector('b').style.left = `${val * 100}%`; this.meterLabel.textContent = label; }
  hideMeter() { this.meter.style.display = 'none'; this.meterLabel.style.display = 'none'; }
  update(dt) {
    const s = this.sim; this.refreshBug(); this.refreshDown();
    if (this.resultT > 0) { this.resultT -= dt; if (this.resultT <= 0) this.result.style.display = 'none'; }
    // receiver icons
    const w = this.app.vw, h = this.app.vh; const c = s.ball.carrier; const userPassing = s.phase === 'live' && c && c.isUser && (c.state === 'qb' || c.state === 'carrier') && !s.forwardPassUsed && (c.z - s.los) * s.dir <= 0.3 && s.ball.state === 'held';
    const showIcons = (s.phase === 'presnap' && s.userOnOffense() && !s.auto) || userPassing;
    const elig = showIcons ? s.eligibles.filter(e => e !== c && e.state !== 'block' && !e.isBlocker) : [];
    while (this.icons.length < elig.length) { const d = el('div', { class: 'recv-icon' }, el('span'), el('div', { class: 'name' })); this.iconLayer.appendChild(d); this.icons.push(d); }
    this.icons.forEach((d, i) => {
      const e = elig[i]; if (!e) { d.style.display = 'none'; return; }
      const p = this.cam.project(e.x, 2.9, e.z, w, h); if (!p.visible) { d.style.display = 'none'; return; }
      const fl = input.faceLabel(e.glyph); d.style.display = 'flex'; d.style.left = `${p.x}px`; d.style.top = `${p.y}px`; d.style.setProperty('--gc', fl.color);
      d.firstChild.textContent = fl.text; d.lastChild.textContent = e.p.nick;
      let sep = 99; for (const x of s.roster[s.defense]) if (x.active) sep = Math.min(sep, Math.hypot(x.x - e.x, x.z - e.z));
      d.classList.toggle('open', s.phase === 'live' && sep > 3.2); d.style.opacity = s.phase === 'live' && sep < 1.5 ? 0.55 : 1;
    });
    // lateral prompt
    const lt = s.phase === 'live' && c && c.isUser && c.state === 'carrier' ? s.lateralTarget(c) : null;
    if (lt) { const p = this.cam.project(lt.x, 2.7, lt.z, w, h); this.lateral.style.display = p.visible ? 'flex' : 'none'; this.lateral.style.left = `${p.x}px`; this.lateral.style.top = `${p.y}px`; this.lateral.textContent = input.usingPad() ? 'L1' : 'F'; } else this.lateral.style.display = 'none';
    // stamina
    const u = s.userEnt; if (u && s.phase === 'live') { this.stamina.style.display = 'block'; this.stamina.firstChild.style.width = `${u.stamina * 100}%`; this.stamina.firstChild.style.background = u.stamina < 0.3 ? '#ff6b7a' : '#7fe3a6'; } else this.stamina.style.display = 'none';
    // hints
    const g = (a, l) => input.glyphHTML(a, l);
    let hint = '';
    if (s.phase === 'presnap') hint = s.userOnOffense() ? `${g('cross', 'Snap')}${g('circle', 'Change play')}` : `${g('r1', 'Switch player')}${g('cross', 'Ready')}`;
    else if (s.phase === 'kickmeter') hint = `${g('cross', 'Kick! (aim for the middle)')}`;
    else if (s.phase === 'pat') hint = `${g('cross', 'Kick extra point')}${g('triangle', 'Go for two')}`;
    else if (s.phase === 'live') {
      if (userPassing) hint = `<span class="gl">Throw:</span> ${g('square', input.usingPad() ? '' : '1')}${g('cross', input.usingPad() ? '' : '2')}${g('circle', input.usingPad() ? '' : '3')}${g('triangle', input.usingPad() ? '' : '4')} <span class="gl">tap = lob · hold = bullet</span>${g('r2', 'Sprint')}`;
      else if (c && c.isUser) hint = `${g('square', 'Juke')}${g('circle', 'Spin')}${g('cross', 'Dive')}${g('l1', 'Lateral')}${g('r2', 'Sprint')}`;
      else if (u && !s.userOnOffense()) hint = `${g('cross', 'Dive tackle')}${g('square', 'Swat / jump')}${g('r1', 'Switch')}${g('r2', 'Sprint')}`;
      else hint = s.ball.state === 'air' ? '<span class="gl">Ball in the air…</span>' : '';
    }
    else if (s.phase === 'playcall') hint = '';
    this.setHint(hint);
  }
  destroy() { this.root.innerHTML = ''; }
}
