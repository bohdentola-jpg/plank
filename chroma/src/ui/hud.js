// DOM heads-up display for battles.
import * as THREE from 'three';
import { formatTime, hexToCss, clamp } from '../util.js';

const WEAPON_GLYPH = { spritzer: '✦', roller: '▬', longshot: '➶', popper: '●' };
const SPLAT_PATH = 'M50 6c9 0 10 14 18 15s16-9 21-1-6 16-1 23 17 6 13 16-17 3-21 9 1 20-8 22-12-11-20-9-11 15-20 11 2-16-5-21-20 2-21-8 12-12 11-20-14-8-12-18 15-5 21-11-2-23 6-26 9 9 16 6 3-7 9-7z';

export class BattleHUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top">
        <div class="hud-team" data-team="1"></div>
        <div class="hud-timer"><span class="t">3:00</span></div>
        <div class="hud-team" data-team="2"></div>
      </div>
      <div class="hud-reticle">
        <svg viewBox="-60 -60 120 120" width="120" height="120">
          <circle class="ret-ring" r="13" fill="none" stroke-width="2.5"/>
          <circle class="ret-dot" r="2.6"/>
          <path class="ret-ink-bg" d="M 26 -22 A 34 34 0 0 1 26 22" fill="none" stroke-width="5" stroke-linecap="round"/>
          <path class="ret-ink" d="M 26 22 A 34 34 0 0 0 26 -22" fill="none" stroke-width="5" stroke-linecap="round" pathLength="100"/>
          <circle class="ret-charge" r="20" fill="none" stroke-width="3.5" pathLength="100" transform="rotate(-90)"/>
          <g class="ret-hit"><path d="M-14 -14 L-7 -7 M14 -14 L7 -7 M-14 14 L-7 7 M14 14 L7 7" stroke-width="3.2" stroke-linecap="round"/></g>
        </svg>
        <div class="ret-lowink">LOW INK!</div>
      </div>
      <div class="hud-special">
        <div class="sp-ring"><div class="sp-fill"></div><div class="sp-icon">★</div></div>
        <div class="sp-label"></div>
      </div>
      <div class="hud-weapon">
        <div class="w-name"></div>
        <div class="w-sub"><span class="w-ico">●</span> Splash Bomb <small>RMB</small></div>
      </div>
      <div class="hud-feed"></div>
      <div class="hud-banner"><div class="b-main"></div><div class="b-sub"></div></div>
      <div class="hud-splatted"><div class="s-title">SPLASHED!</div><div class="s-by"></div><div class="s-count"></div></div>
      <div class="hud-hurt"></div>
      <div class="hud-plates"></div>
      <div class="hud-map"><div class="map-title">TURF MAP</div><div class="map-dots"></div></div>
      <div class="hud-hint"></div>
      <div class="hud-cover"></div>
    `;
    this.$ = (s) => root.querySelector(s);
    this.timer = this.$('.hud-timer .t');
    this.teams = { 1: this.$('.hud-team[data-team="1"]'), 2: this.$('.hud-team[data-team="2"]') };
    this.ret = this.$('.hud-reticle');
    this.inkArc = this.$('.ret-ink');
    this.chargeRing = this.$('.ret-charge');
    this.hit = this.$('.ret-hit');
    this.lowInk = this.$('.ret-lowink');
    this.spFill = this.$('.sp-fill');
    this.spLabel = this.$('.sp-label');
    this.spWrap = this.$('.hud-special');
    this.feed = this.$('.hud-feed');
    this.banner = this.$('.hud-banner');
    this.splat = this.$('.hud-splatted');
    this.hurtEl = this.$('.hud-hurt');
    this.plates = this.$('.hud-plates');
    this.map = this.$('.hud-map');
    this.mapDots = this.$('.map-dots');
    this.hint = this.$('.hud-hint');
    this.hitT = 0; this.lowT = 0; this.bannerT = 0;
    this.plateEls = new Map();
    this._v = new THREE.Vector3();
  }

  setup(fighters, player, colors) {
    this.player = player;
    this.fighters = fighters;
    this.colors = colors;
    const css = (t) => hexToCss(colors[t]);
    this.root.style.setProperty('--team', css(player.team));
    this.root.style.setProperty('--enemy', css(3 - player.team));
    this.root.style.setProperty('--teamA', css(1));
    this.root.style.setProperty('--teamB', css(2));
    for (const t of [1, 2]) {
      const list = fighters.filter((f) => f.team === t);
      this.teams[t].innerHTML = list.map((f, i) => `<div class="ico ${f === player ? 'me' : ''}" data-i="${i}" style="--c:${css(t)}"><span>${WEAPON_GLYPH[f.weapon.id] || '●'}</span></div>`).join('');
      list.forEach((f, i) => { f._icon = this.teams[t].children[i]; });
    }
    this.$('.w-name').textContent = player.weapon.name;
    const sp = { barrage: 'Paint Barrage', nova: 'Ink Nova' }[player.weapon.special];
    this.spName = sp;
    this.chargeRing.style.display = player.weapon.type === 'charger' ? '' : 'none';
    // nameplates
    this.plates.innerHTML = '';
    this.plateEls.clear();
    for (const f of fighters) {
      if (f === player) continue;
      const el = document.createElement('div');
      el.className = 'plate ' + (f.team === player.team ? 'ally' : 'foe');
      el.innerHTML = `<span class="pn">${f.name}</span><i></i>`;
      el.style.setProperty('--c', css(f.team));
      this.plates.appendChild(el);
      this.plateEls.set(f, el);
    }
  }

  setTime(t) {
    this.timer.textContent = formatTime(t);
    this.timer.parentElement.classList.toggle('low', t <= 60 && t > 0);
    this.timer.parentElement.classList.toggle('crit', t <= 10 && t > 0);
  }

  show(on) { this.root.classList.toggle('on', on); }
  showPlayUI(on) { this.root.classList.toggle('play', on); }

  update(dt, camera, opts = {}) {
    const p = this.player;
    // ink arc
    this.inkArc.style.strokeDasharray = `${clamp(p.ink, 0, 1) * 100} 100`;
    this.ret.classList.toggle('low', p.ink < 0.18);
    this.ret.classList.toggle('goo', p.form === 'goo');
    this.ret.classList.toggle('target', !!opts.aimTarget && opts.aimTarget.team !== p.team);
    if (p.weapon.type === 'charger') {
      this.chargeRing.style.strokeDasharray = `${p.charge * 100} 100`;
      this.chargeRing.classList.toggle('full', p.charge >= 0.999);
    }
    this.hitT -= dt;
    this.hit.style.opacity = this.hitT > 0 ? Math.min(1, this.hitT * 6) : 0;
    this.lowT -= dt;
    this.lowInk.style.opacity = this.lowT > 0 ? 1 : 0;
    // special gauge
    const sf = p.specialReady ? 1 : clamp(p.special / p.weapon.specialCost, 0, 1);
    this.spFill.style.setProperty('--p', `${sf * 100}%`);
    this.spWrap.classList.toggle('ready', p.specialReady);
    this.spLabel.innerHTML = p.specialReady ? `${this.spName}<b>PRESS Q</b>` : this.spName;
    // team icons
    for (const f of this.fighters) {
      if (!f._icon) continue;
      f._icon.classList.toggle('dead', !f.alive);
      f._icon.classList.toggle('sp', f.specialReady && f.alive);
    }
    // nameplates
    const v = this._v;
    const W = innerWidth, H = innerHeight;
    for (const [f, el] of this.plateEls) {
      let show = f.alive;
      const ally = f.team === p.team;
      if (show && !ally) show = opts.aimTarget === f || (f.lastAttacker === p && f.time - f.lastAttackT < 2.5);
      if (show && f.submerged && !ally) show = false;
      if (show) {
        v.set(f.pos.x, f.pos.y + (f.form === 'goo' ? 0.9 : 1.85), f.pos.z).project(camera);
        if (v.z > 1 || v.z < -1) show = false;
        else {
          const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
          const off = x < 0 || x > W || y < 0 || y > H;
          if (off && !ally) show = false;
          el.style.transform = `translate(${clamp(x, 30, W - 30)}px, ${clamp(y, 40, H - 30)}px)`;
          el.classList.toggle('edge', off);
        }
      }
      el.style.display = show ? '' : 'none';
    }
    // splatted countdown
    if (!p.alive) this.splat.querySelector('.s-count').textContent = `Respawning in ${Math.max(0, Math.ceil(p.respawnT))}`;
    this.splat.classList.toggle('on', !p.alive);
  }

  hitMarker(kill) {
    this.hitT = kill ? 0.5 : 0.22;
    this.hit.classList.toggle('kill', !!kill);
  }

  lowInkWarn() { this.lowT = 0.9; }

  hurt(color) {
    const el = document.createElement('div');
    el.className = 'hurt-splat';
    const x = Math.random() < 0.5 ? Math.random() * 30 : 70 + Math.random() * 30;
    const y = Math.random() * 100;
    el.style.left = x + '%'; el.style.top = y + '%';
    el.style.setProperty('--s', (0.6 + Math.random() * 0.9).toFixed(2));
    el.style.setProperty('--r', Math.floor(Math.random() * 360) + 'deg');
    el.innerHTML = `<svg viewBox="0 0 100 100"><path d="${SPLAT_PATH}" fill="${hexToCss(color)}"/></svg>`;
    this.hurtEl.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  splattedBy(name, color) {
    const by = this.splat.querySelector('.s-by');
    by.innerHTML = name ? `by <b style="color:${hexToCss(color)}">${name}</b>` : 'You fell in the water!';
  }

  feedMsg(html) {
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = html;
    this.feed.prepend(el);
    while (this.feed.children.length > 5) this.feed.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 4000);
    setTimeout(() => el.remove(), 4600);
  }

  showBanner(main, sub = '', cls = '', dur = 1.6) {
    this.banner.className = 'hud-banner on ' + cls;
    this.banner.querySelector('.b-main').innerHTML = main;
    this.banner.querySelector('.b-sub').innerHTML = sub;
    clearTimeout(this.bannerTO);
    if (dur > 0) this.bannerTO = setTimeout(() => this.banner.classList.remove('on'), dur * 1000);
  }
  hideBanner() { this.banner.classList.remove('on'); }

  showHint(html, dur = 7) {
    this.hint.innerHTML = html;
    this.hint.classList.add('on');
    clearTimeout(this.hintTO);
    this.hintTO = setTimeout(() => this.hint.classList.remove('on'), dur * 1000);
  }

  mapOverlay(on, cam, rect) {
    this.map.classList.toggle('on', on);
    if (!on) return;
    this.map.style.left = rect.x + 'px'; this.map.style.top = rect.y + 'px';
    this.map.style.width = rect.w + 'px'; this.map.style.height = rect.h + 'px';
    const v = this._v;
    let html = '';
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.team !== this.player.team && f !== this.player) continue;
      v.copy(f.pos).project(cam);
      const x = (v.x * 0.5 + 0.5) * rect.w, y = (-v.y * 0.5 + 0.5) * rect.h;
      html += `<div class="mdot ${f === this.player ? 'me' : ''}" style="left:${x}px;top:${y}px;--c:${hexToCss(this.colors[f.team])}"></div>`;
    }
    this.mapDots.innerHTML = html;
  }

  cover(on) { this.$('.hud-cover').classList.toggle('on', on); }
}
