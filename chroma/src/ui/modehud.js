// Extra HUD for Zone Clash and Hue Hoops: scoreboards / counters under the
// timer, a status line, world markers with off-screen arrows and a throw-power
// ring. Styles are injected here so the shared stylesheet stays untouched.
import * as THREE from 'three';
import { clamp } from '../util.js';

const CSS = `
#hud:not(.play) .mhud, #hud:not(.play) .mh-status, #hud:not(.play) .mh-mark, #hud:not(.play) .mh-power { opacity: 0 !important; }
#hud.mapon .mh-mark, #hud.mapon .mh-power { opacity: 0 !important; }
.mhud { top: 70px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 5px; transition: opacity .3s; }
.mh-board { display: flex; align-items: center; gap: 10px; }
.mh-side { position: relative; min-width: 76px; padding: 2px 14px 4px; border-radius: 14px; background: var(--c); box-shadow: 0 0 0 3px var(--ink), 0 6px 14px rgba(0,0,0,.35); text-align: center; transition: transform .2s, box-shadow .2s; }
.mh-side.a { --c: var(--teamA); transform: rotate(-2deg); } .mh-side.b { --c: var(--teamB); transform: rotate(2deg); }
.mh-side.hold { box-shadow: 0 0 0 3px #fff, 0 0 22px 6px var(--c); }
.mh-side.pop { animation: mhpop .5s cubic-bezier(.2,1.8,.4,1); }
@keyframes mhpop { 0% { transform: scale(1.5); } 100% { transform: scale(1); } }
.mh-num { font-size: 34px; line-height: 1.05; color: #fff; -webkit-text-stroke: 5px var(--ink); paint-order: stroke fill; }
.mh-cap { font-family: var(--bfont); font-weight: 900; font-size: 10px; letter-spacing: 1px; color: rgba(255,255,255,.9); text-shadow: 0 1px 0 var(--ink); margin-top: -3px; }
.mh-pen { position: absolute; top: -10px; right: -16px; background: #ff4d4d; color: #fff; font-size: 15px; padding: 1px 7px; border-radius: 999px; box-shadow: 0 0 0 2px var(--ink); opacity: 0; transform: scale(.6); transition: all .2s; }
.mh-pen.on { opacity: 1; transform: none; }
.mh-mid { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 62px; }
.mh-icon { width: 34px; height: 34px; transform: rotate(45deg); border-radius: 7px; background: var(--mc, #fff); box-shadow: 0 0 0 3px var(--ink), 0 4px 10px rgba(0,0,0,.35); transition: background .3s; }
.mh-icon.live { animation: mhglow .6s ease-in-out infinite alternate; }
@keyframes mhglow { to { box-shadow: 0 0 0 3px #fff, 0 0 20px 6px var(--mc); } }
.mh-icon.ball { transform: none; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, var(--mc, #ffe27a) 60%); }
.mh-lbl { font-family: var(--bfont); font-weight: 900; font-size: 11px; letter-spacing: 1px; text-shadow: 0 1px 0 var(--ink), 0 0 4px var(--ink); white-space: nowrap; }
.mh-meter { position: relative; width: 340px; height: 14px; border-radius: 999px; background: rgba(27,21,48,.85); box-shadow: 0 0 0 3px var(--ink); overflow: hidden; }
.mh-meter i { position: absolute; top: 0; bottom: 0; }
.mh-meter .fa { right: 50%; background: var(--teamA); transition: width .15s; }
.mh-meter .fb { left: 50%; background: var(--teamB); transition: width .15s; }
.mh-meter .tk { width: 3px; background: #fff; box-shadow: 0 0 4px #fff; }
.mh-meter .mid { left: 50%; width: 2px; margin-left: -1px; background: rgba(255,255,255,.35); }
.mh-meterlbl { display: flex; justify-content: space-between; width: 340px; font-family: var(--bfont); font-weight: 900; font-size: 11px; text-shadow: 0 1px 0 var(--ink), 0 0 4px var(--ink); margin-top: -2px; }
.mh-chips { display: flex; gap: 70px; }
.mh-chip { display: flex; align-items: center; gap: 6px; background: rgba(27,21,48,.85); border-radius: 999px; padding: 3px 10px 3px 6px; box-shadow: 0 0 0 2px var(--ink); font-family: var(--bfont); font-weight: 900; font-size: 11px; letter-spacing: .5px; }
.mh-chip b { font-family: var(--hfont); font-weight: 400; font-size: 13px; letter-spacing: .5px; }
.mh-chip .lk { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; background: var(--dc); color: #fff; }
.mh-chip.open .lk { background: var(--ac); animation: mhglow .45s ease-in-out infinite alternate; --mc: var(--ac); }
.mh-chip .bar { position: relative; width: 64px; height: 7px; border-radius: 9px; background: rgba(255,255,255,.15); overflow: hidden; }
.mh-chip .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ac); }
.mh-chip .bar s { position: absolute; top: -1px; bottom: -1px; width: 2px; background: #fff; }
.mh-ot { font-size: 22px; color: var(--sun); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; animation: pulse .5s ease-in-out infinite alternate; display: none; }
.mh-ot.on { display: block; }
.mh-status { left: 50%; bottom: 74px; transform: translateX(-50%); padding: 7px 18px; border-radius: 999px; background: rgba(27,21,48,.85); font-family: var(--bfont); font-weight: 900; font-size: 15px; white-space: nowrap; opacity: 0; transition: opacity .25s; box-shadow: 0 0 0 2px var(--c, transparent); }
.mh-status.on { opacity: 1; }
.mh-status b { font-family: var(--hfont); font-weight: 400; color: var(--c, var(--sun)); letter-spacing: .5px; }
.mh-status.alert { animation: mhshake .4s ease-in-out infinite alternate; }
@keyframes mhshake { to { transform: translateX(-50%) scale(1.06); } }
.mh-mark { left: 0; top: 0; width: 0; height: 0; display: none; }
.mh-mark.on { display: block; }
.mh-mark .pin { position: absolute; left: -16px; top: -16px; width: 32px; height: 32px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, var(--c) 62%); box-shadow: 0 0 0 3px var(--ink), 0 0 14px 3px var(--c); }
.mh-mark .pin.hoop { border-radius: 8px; background: var(--c); }
.mh-mark .arw { position: absolute; left: -12px; top: -12px; width: 24px; height: 24px; display: none; }
.mh-mark.edge .arw { display: block; }
.mh-mark .arw::before { content: ''; position: absolute; left: 20px; top: 2px; border-left: 16px solid var(--c); border-top: 10px solid transparent; border-bottom: 10px solid transparent; filter: drop-shadow(0 0 2px var(--ink)) drop-shadow(0 0 2px var(--ink)); }
.mh-mark .tx { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); font-size: 13px; white-space: nowrap; -webkit-text-stroke: 3.5px var(--ink); paint-order: stroke fill; }
.mh-mark.edge .tx { top: 20px; }
.mh-power { left: 50%; top: 50%; width: 0; height: 0; opacity: 0; transition: opacity .12s; }
.mh-power.on { opacity: 1; }
.mh-power svg { position: absolute; left: -46px; top: -46px; overflow: visible; }
.mh-power .bg { stroke: rgba(0,0,0,.45); } .mh-power .fg { stroke: var(--team); filter: drop-shadow(0 0 4px var(--team)); }
.mh-power .tx { position: absolute; left: 0; top: 48px; transform: translateX(-50%); font-size: 14px; white-space: nowrap; -webkit-text-stroke: 3.5px var(--ink); paint-order: stroke fill; color: #fff; }
.hud-team .ico.ball::before { content: ''; position: absolute; right: -5px; top: -5px; width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #ffd21a 65%); box-shadow: 0 0 0 2px var(--ink), 0 0 8px 2px #ffd21a; }
.hud-banner.mbig .b-main { font-size: 112px; }
.hud-banner.mmid .b-main { font-size: 70px; }
.hud-banner.mbig .b-sub, .hud-banner.mmid .b-sub { font-size: 28px; }
@media (max-width: 760px) { .mh-meter, .mh-meterlbl { width: 220px; } .mh-chips { gap: 20px; } .mh-num { font-size: 24px; } }
`;

function injectCSS() {
  if (document.getElementById('mode-hud-css')) return;
  const s = document.createElement('style');
  s.id = 'mode-hud-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const _v = new THREE.Vector3();

export class ModeHUD {
  constructor(root, kind, myTeam) {
    injectCSS();
    this.root = root;
    this.kind = kind;
    this.myTeam = myTeam;
    const el = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; root.appendChild(d); return d; };
    if (kind === 'zones') {
      this.board = el('mhud mhud-zones', `
        <div class="mh-board">
          <div class="mh-side a"><div class="mh-num">100</div><div class="mh-cap">COUNT</div><div class="mh-pen"></div></div>
          <div class="mh-mid"><div class="mh-icon"></div><div class="mh-lbl">NEUTRAL</div></div>
          <div class="mh-side b"><div class="mh-num">100</div><div class="mh-cap">COUNT</div><div class="mh-pen"></div></div>
        </div>
        <div class="mh-meter"><i class="fa"></i><i class="fb"></i><i class="mid"></i><i class="tk ta"></i><i class="tk tb"></i></div>
        <div class="mh-meterlbl"><span class="la"></span><span class="lb"></span></div>
        <div class="mh-ot">OVERTIME!</div>`);
    } else {
      this.board = el('mhud mhud-hoops', `
        <div class="mh-board">
          <div class="mh-side a"><div class="mh-num">0</div><div class="mh-cap">PTS</div></div>
          <div class="mh-mid"><div class="mh-icon ball"></div><div class="mh-lbl"></div></div>
          <div class="mh-side b"><div class="mh-num">0</div><div class="mh-cap">PTS</div></div>
        </div>
        <div class="mh-chips"><div class="mh-chip" data-h="1"><span class="lk">🔒</span><b></b><span class="bar"><i></i><s></s></span></div><div class="mh-chip" data-h="2"><span class="lk">🔒</span><b></b><span class="bar"><i></i><s></s></span></div></div>
        <div class="mh-ot">OVERTIME — NEXT SCORE WINS!</div>`);
    }
    this.$ = (s) => this.board.querySelector(s);
    this.sides = { 1: this.$('.mh-side.a'), 2: this.$('.mh-side.b') };
    this.statusEl = el('mh-status');
    this.marks = [];
    this.powerEl = el('mh-power', `<svg width="92" height="92" viewBox="-46 -46 92 92"><circle class="bg" r="38" fill="none" stroke-width="6"/><circle class="fg" r="38" fill="none" stroke-width="6" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90)"/></svg><div class="tx"></div>`);
    this.cache = {};
  }

  put(key, el, html) { if (this.cache[key] !== html) { this.cache[key] = html; el.innerHTML = html; } }
  text(key, el, t) { if (this.cache[key] !== t) { this.cache[key] = t; el.textContent = t; } }
  pop(team) { const s = this.sides[team]; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }

  // ---- Zone Clash
  setZones({ ctrl, count, pen, cov, cap, ot, colors }) {
    for (const t of [1, 2]) {
      const s = this.sides[t];
      this.text('n' + t, s.querySelector('.mh-num'), String(Math.ceil(count[t] - 1e-6)));
      const pe = s.querySelector('.mh-pen');
      const p = Math.ceil(pen[t] - 1e-6);
      pe.classList.toggle('on', p > 0);
      if (p > 0) this.text('p' + t, pe, '+' + p);
      s.classList.toggle('hold', ctrl === t);
    }
    const icon = this.$('.mh-icon');
    icon.style.setProperty('--mc', ctrl ? colors[ctrl] : '#ffffff');
    icon.classList.toggle('live', !!ctrl);
    this.text('lbl', this.$('.mh-lbl'), ctrl ? (ctrl === this.myTeam ? 'YOUR ZONE' : 'ENEMY ZONE') : 'NEUTRAL');
    this.$('.fa').style.width = `${clamp(cov[1], 0, 1) * 50}%`;
    this.$('.fb').style.width = `${clamp(cov[2], 0, 1) * 50}%`;
    this.$('.ta').style.left = `${50 - cap * 50}%`;
    this.$('.tb').style.left = `${50 + cap * 50}%`;
    this.text('la', this.$('.la'), `${Math.round(cov[1] * 100)}%`);
    this.text('lb', this.$('.lb'), `${Math.round(cov[2] * 100)}%`);
    this.$('.mh-ot').classList.toggle('on', !!ot);
  }

  // ---- Hue Hoops
  setHoops({ score, target, carrierTeam, open, prog, need, ot, colors, label }) {
    for (const t of [1, 2]) this.text('n' + t, this.sides[t].querySelector('.mh-num'), String(score[t]));
    const icon = this.$('.mh-icon');
    icon.style.setProperty('--mc', carrierTeam ? colors[carrierTeam] : '#ffe27a');
    icon.classList.toggle('live', !!carrierTeam);
    this.text('lbl', this.$('.mh-lbl'), label || `FIRST TO ${target}`);
    for (const h of [1, 2]) {
      const chip = this.$(`.mh-chip[data-h="${h}"]`);
      const att = 3 - h;
      chip.style.setProperty('--dc', colors[h]);
      chip.style.setProperty('--ac', colors[att]);
      chip.classList.toggle('open', !!open[h]);
      this.text('lk' + h, chip.querySelector('.lk'), open[h] ? '!' : '🔒');
      this.text('cb' + h, chip.querySelector('b'), `${h === this.myTeam ? 'YOUR' : 'ENEMY'} HOOP ${open[h] ? 'OPEN' : 'SHIELDED'}`);
      chip.querySelector('.bar i').style.width = `${clamp(prog[h], 0, 1) * 100}%`;
      chip.querySelector('.bar s').style.left = `${need * 100}%`;
    }
    this.$('.mh-ot').classList.toggle('on', !!ot);
  }

  status(html, color = null, alert = false) {
    const e = this.statusEl;
    e.classList.toggle('on', !!html);
    e.classList.toggle('alert', !!alert);
    if (html) { this.put('st', e, html); e.style.setProperty('--c', color || 'var(--sun)'); }
  }

  power(p, label = '') {
    this.powerEl.classList.toggle('on', p != null);
    if (p == null) return;
    this.powerEl.querySelector('.fg').setAttribute('stroke-dasharray', `${clamp(p, 0, 1) * 100} 100`);
    this.text('pw', this.powerEl.querySelector('.tx'), label);
  }

  // A world-space marker; off screen it sticks to the edge with an arrow.
  marker(i, pos, camera, { color = '#ffd21a', label = '', hoop = false, show = true } = {}) {
    let m = this.marks[i];
    if (!m) {
      m = this.marks[i] = document.createElement('div');
      m.className = 'mh-mark';
      m.innerHTML = '<div class="arw"></div><div class="pin"></div><div class="tx"></div>';
      this.root.appendChild(m);
    }
    m.classList.toggle('on', !!(show && pos));
    if (!show || !pos) return;
    m.style.setProperty('--c', color);
    m.querySelector('.pin').classList.toggle('hoop', hoop);
    this.text('mk' + i, m.querySelector('.tx'), label);
    const W = innerWidth, H = innerHeight;
    _v.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    const behind = _v.z > -0.1;
    let x, y, edge = false, ang = 0;
    if (!behind) {
      _v.copy(pos).project(camera);
      x = _v.x; y = _v.y;
    }
    if (behind || Math.abs(x) > 0.9 || Math.abs(y) > 0.82) {
      // direction in camera space -> stick to an inset ellipse
      _v.copy(pos).applyMatrix4(camera.matrixWorldInverse);
      let dx = _v.x, dy = _v.y;
      if (behind && Math.hypot(dx, dy) < 1e-3) { dx = 0; dy = -1; }
      ang = Math.atan2(dy, dx);
      x = Math.cos(ang) * 0.88; y = Math.sin(ang) * 0.8;
      edge = true;
    }
    m.classList.toggle('edge', edge);
    const sx = (x * 0.5 + 0.5) * W, sy = (-y * 0.5 + 0.5) * H;
    m.style.transform = `translate(${sx}px, ${sy}px)`;
    if (edge) m.querySelector('.arw').style.transform = `rotate(${-ang}rad)`;
  }

  dispose() {
    for (const e of [this.board, this.statusEl, this.powerEl, ...this.marks]) e?.remove();
  }
}
