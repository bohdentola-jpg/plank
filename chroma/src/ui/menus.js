// All overlay menus (DOM). Each takes callbacks; the app owns game state.
import { WEAPONS, WEAPON_IDS, SPECIALS } from '../actors/weapons.js';
import { SKIN_TONES, EYE_COLORS, HAIR_STYLES, OUTFIT_COLORS } from '../actors/character.js';
import { COLOR_PAIRS, hexToCss } from '../util.js';
import { STAGE_IDS, stageInfo } from '../world/stage.js';

const SPLAT = 'M50 4c8 0 9 13 17 14s15-9 21-2-5 15 0 22 16 6 12 16-16 3-20 9 1 19-8 21-11-10-19-8-10 15-19 11 1-15-6-20-19 2-20-8 11-11 10-19-13-8-11-17 14-5 20-11-2-22 6-25 8 8 15 6 3-7 9-7z';
const INK_CHOICES = [...new Set(COLOR_PAIRS.flatMap((c) => [c.a, c.b]))];
const HAIR_LABEL = { drop: 'Droplet', twin: 'Twin Drips', mohawk: 'Splash Hawk', bob: 'Drip Bob' };
const STYLE_LABEL = { hoodie: 'Hoodie', jacket: 'Track Jacket', tee: 'Tee' };
const BOTTOMS = ['#23263a', '#3d405b', '#5a4a3a', '#2f5d62', '#1d3557', '#6d597a', '#f4f1ea', '#c8553d'];
const SHOES = ['#ffffff', '#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#f4f1ea', '#1b1530', '#ff7a00'];

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export class Menus {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('menus');
  }

  sfx(n) { this.app.audio?.sfx(n); }

  open(node) {
    this.root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('on'));
    node.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.sfx('ui_move')));
    return () => { node.classList.remove('on'); setTimeout(() => node.remove(), 260); };
  }

  // ------------------------------------------------------------ loading
  loading(on, text = 'Loading...') {
    const L = document.getElementById('loading');
    L.querySelector('.ld-text').textContent = text;
    L.classList.toggle('on', on);
  }

  // ------------------------------------------------------------ title
  title({ onPlaza, onQuick, onSettings, firstTime }) {
    const node = el(`
      <div class="overlay title-screen">
        <div class="logo">
          <svg class="logo-splat" viewBox="0 0 100 100"><path d="${SPLAT}"/></svg>
          <div class="logo-text">${'CHROMA'.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}<br>${'CLASH'.split('').map((c, i) => `<span style="--i:${i + 6}">${c}</span>`).join('')}</div>
          <div class="logo-sub">INK · SWIM · PAINT THE TOWN</div>
        </div>
        <div class="press">PRESS ANY BUTTON</div>
        <div class="title-menu">
          <button class="btn big" data-a="plaza">${firstTime ? '✦ CREATE YOUR DRIPKIN' : '▶ ENTER PRISM PLAZA'}</button>
          <button class="btn" data-a="quick">⚡ QUICK BATTLE</button>
          <button class="btn ghost" data-a="settings">⚙ SETTINGS</button>
        </div>
        <div class="title-foot">An original game · Built with Three.js · Mouse + keyboard or controller</div>
      </div>`);
    const close = this.open(node);
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      this.app.audio?.init();
      this.sfx('ui_select');
      node.classList.add('armed');
      this.app.audio?.music('title');
    };
    const onKey = (e) => { if (!armed) { e.preventDefault(); arm(); } };
    addEventListener('keydown', onKey);
    node.addEventListener('pointerdown', arm);
    this._titlePad = setInterval(() => { if (!armed && this.app.input.pad && this.app.input.padButtons.some((b) => b)) arm(); }, 100);
    const done = () => { removeEventListener('keydown', onKey); clearInterval(this._titlePad); close(); };
    node.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armed) { arm(); return; }
      const a = b.dataset.a;
      this.sfx('ui_select');
      if (a === 'plaza') { done(); onPlaza(); }
      if (a === 'quick') { done(); onQuick(); }
      if (a === 'settings') onSettings();
    }));
    this.padNav(node, () => armed);
    return done;
  }

  // gamepad / arrow navigation over a node's buttons
  padNav(node, enabled = () => true) {
    let idx = 0;
    const iv = setInterval(() => {
      if (!node.isConnected) { clearInterval(iv); return; }
      if (!enabled()) return;
      const inp = this.app.input;
      const btns = [...node.querySelectorAll('button:not([disabled]), .swatch, .chip')].filter((b) => b.offsetParent);
      if (!btns.length) return;
      let moved = false;
      if (inp.padPressed(13) || inp.padPressed(15)) { idx = (idx + 1) % btns.length; moved = true; }
      if (inp.padPressed(12) || inp.padPressed(14)) { idx = (idx - 1 + btns.length) % btns.length; moved = true; }
      if (moved) { btns.forEach((b) => b.classList.remove('focus')); btns[idx].classList.add('focus'); btns[idx].scrollIntoView({ block: 'nearest' }); this.sfx('ui_move'); }
      if (inp.padPressed(0)) btns[idx]?.click();
      if (inp.padPressed(1)) node.querySelector('[data-back]')?.click();
    }, 50);
  }

  // ------------------------------------------------------------ settings / pause
  settingsHTML() {
    const s = this.app.profile.settings;
    return `
      <div class="settings">
        <label>Mouse / stick sensitivity <input type="range" min="0.3" max="2.5" step="0.05" data-s="sens" value="${s.sens}"></label>
        <label>Music volume <input type="range" min="0" max="1" step="0.05" data-s="music" value="${s.music}"></label>
        <label>Effects volume <input type="range" min="0" max="1" step="0.05" data-s="sfx" value="${s.sfx}"></label>
        <label class="row">Invert Y <input type="checkbox" data-s="invertY" ${s.invertY ? 'checked' : ''}></label>
        <label class="row">Graphics
          <select data-s="quality">${['auto', 'high', 'medium', 'low'].map((q) => `<option ${s.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select>
        </label>
      </div>`;
  }

  bindSettings(node) {
    node.querySelectorAll('[data-s]').forEach((inp) => inp.addEventListener('input', () => {
      const s = this.app.profile.settings;
      const k = inp.dataset.s;
      s[k] = inp.type === 'checkbox' ? inp.checked : inp.tagName === 'SELECT' ? inp.value : parseFloat(inp.value);
      this.app.applySettings();
      this.app.save();
    }));
  }

  settings() {
    const node = el(`<div class="overlay dim"><div class="panel narrow"><h2>SETTINGS</h2>${this.settingsHTML()}<button class="btn" data-back>DONE</button></div></div>`);
    const close = this.open(node);
    this.bindSettings(node);
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); };
    this.padNav(node);
  }

  pause(on, opts = {}) {
    if (!on) { this._pauseClose?.(); this._pauseClose = null; return; }
    if (this._pauseClose) return;
    const node = el(`<div class="overlay dim pause"><div class="panel narrow">
      <h2>PAUSED</h2>
      <button class="btn big" data-a="resume">RESUME</button>
      ${this.settingsHTML()}
      <div class="keys">WASD move · Mouse aim · LMB fire · SHIFT swim · SPACE jump · RMB bomb · Q special · TAB map · E interact</div>
      <button class="btn ghost" data-a="quit">${opts.quitLabel || 'QUIT'}</button>
    </div></div>`);
    this._pauseClose = this.open(node);
    this.bindSettings(node);
    node.querySelector('[data-a="resume"]').onclick = () => { this.sfx('ui_select'); this.pause(false); opts.onResume?.(); };
    node.querySelector('[data-a="quit"]').onclick = () => { this.sfx('ui_back'); this.pause(false); opts.onQuit?.(); };
    const esc = (e) => { if (e.code === 'Escape' && node.isConnected) { e.stopPropagation(); setTimeout(() => { if (this._pauseClose) { this.pause(false); opts.onResume?.(); } }, 0); removeEventListener('keydown', esc, true); } };
    setTimeout(() => addEventListener('keydown', esc, true), 50);
    this.padNav(node);
  }

  // ------------------------------------------------------------ lobby
  lobby({ onStart, onClose }) {
    const p = this.app.profile;
    let weapon = p.weapon, skill = p.lastSkill || 'normal', stage = STAGE_IDS[0];
    const node = el(`<div class="overlay dim lobby"><div class="panel wide">
      <div class="lobby-head"><h2>CLASH TOWER</h2><div class="mode-pill">TURF RUSH · 4v4 · 3:00</div></div>
      <div class="lobby-grid">
        <div>
          <h3>Your weapon</h3>
          <div class="wpick">${p.owned.map((id) => `<button class="chip ${id === weapon ? 'sel' : ''}" data-w="${id}"><b>${WEAPONS[id].name}</b><small>${WEAPONS[id].type}</small></button>`).join('')}</div>
          <p class="hint">Buy more at <b>Blastworks</b> in the plaza.</p>
        </div>
        <div>
          <h3>Opponents</h3>
          <div class="skill">${['easy', 'normal', 'hard'].map((s) => `<button class="chip ${s === skill ? 'sel' : ''}" data-k="${s}">${s.toUpperCase()}</button>`).join('')}</div>
          <h3>Stage</h3>
          <div class="stages">${STAGE_IDS.map((id) => `<button class="chip sel" data-st="${id}">${stageInfo(id).name}</button>`).join('')}</div>
        </div>
      </div>
      <div class="lobby-slots"></div>
      <div class="lobby-actions">
        <button class="btn ghost" data-back>LEAVE</button>
        <button class="btn big go" data-a="go">FIND MATCH</button>
      </div>
    </div></div>`);
    const close = this.open(node);
    const sel = (attr, v) => node.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('sel', b.dataset[attr === 'w' ? 'w' : attr === 'k' ? 'k' : 'st'] === v));
    node.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { weapon = b.dataset.w; sel('w', weapon); this.sfx('ui_select'); });
    node.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { skill = b.dataset.k; sel('k', skill); this.sfx('ui_select'); });
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onClose(); };
    node.querySelector('[data-a="go"]').onclick = () => {
      this.sfx('ui_select');
      p.weapon = weapon; p.lastSkill = skill; this.app.save();
      node.querySelector('.lobby-actions').innerHTML = '<div class="searching">Finding players<span>.</span><span>.</span><span>.</span></div>';
      const slots = node.querySelector('.lobby-slots');
      slots.innerHTML = Array.from({ length: 8 }, (_, i) => `<div class="slot ${i === 0 ? 'me filled' : ''}"><svg viewBox="0 0 100 100"><path d="${SPLAT}"/></svg><span>${i === 0 ? p.name : ''}</span></div>`).join('');
      this.app.audio?.music('lobby');
      const names = ['Blip', 'Mochi', 'Tidal', 'Zest', 'Pip', 'Drizzle', 'Kiki', 'Juno', 'Bix', 'Sprout', 'Glim', 'Rio'].sort(() => Math.random() - 0.5);
      let k = 1;
      const iv = setInterval(() => {
        if (k >= 8) {
          clearInterval(iv);
          node.querySelector('.searching').textContent = 'MATCH FOUND!';
          this.sfx('special_ready');
          setTimeout(() => { close(); onStart({ weapon, skill, stage }); }, 900);
          return;
        }
        const s = slots.children[k];
        s.classList.add('filled');
        s.querySelector('span').textContent = names[k];
        this.sfx('ui_move');
        k++;
      }, 260 + Math.random() * 200);
    };
    this.padNav(node);
  }

  // ------------------------------------------------------------ shop
  shop({ onEquip, onClose }) {
    const app = this.app, p = app.profile;
    const node = el(`<div class="overlay side-right shop"><div class="panel tall">
      <div class="shop-head"><h2>BLASTWORKS</h2><div class="coins"><span class="coin">◉</span> <b class="cv">${p.coins.toLocaleString()}</b></div></div>
      <div class="shop-list"></div>
      <button class="btn ghost" data-back>DONE</button>
    </div></div>`);
    const close = this.open(node);
    const list = node.querySelector('.shop-list');
    const render = () => {
      node.querySelector('.cv').textContent = p.coins.toLocaleString();
      list.innerHTML = WEAPON_IDS.map((id) => {
        const w = WEAPONS[id];
        const own = p.owned.includes(id), eq = p.weapon === id;
        const locked = p.level < w.level;
        const bars = Object.entries(w.stats).map(([k, v]) => `<div class="stat"><span>${k}</span><i><b style="width:${v * 100}%"></b></i></div>`).join('');
        let action;
        if (eq) action = '<div class="tag eq">EQUIPPED</div>';
        else if (own) action = `<button class="btn small" data-eq="${id}">EQUIP</button>`;
        else if (locked) action = `<div class="tag lock">LV ${w.level} REQUIRED</div>`;
        else action = `<button class="btn small buy" data-buy="${id}" ${p.coins < w.price ? 'disabled' : ''}><span class="coin">◉</span> ${w.price.toLocaleString()}</button>`;
        return `<div class="wcard ${eq ? 'eq' : ''}">
          <div class="wc-top"><div><div class="wc-name">${w.name}</div><div class="wc-type">${w.type} · Splash Bomb · ${SPECIALS[w.special].name}</div></div>${action}</div>
          <div class="wc-desc">${w.desc}</div>
          <div class="stats">${bars}</div>
        </div>`;
      }).join('');
      list.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => { p.weapon = b.dataset.eq; app.save(); onEquip(p.weapon); this.sfx('ui_select'); render(); });
      list.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
        const w = WEAPONS[b.dataset.buy];
        if (p.coins < w.price) { this.sfx('ui_error'); return; }
        p.coins -= w.price; p.owned.push(w.id); p.weapon = w.id; app.save();
        this.sfx('buy'); onEquip(w.id); render();
      });
    };
    render();
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onClose(); };
    this.padNav(node);
  }

  // ------------------------------------------------------------ locker / creator
  locker({ onChange, onEmote, onClose, create = false }) {
    const app = this.app, p = app.profile;
    const look = { ...p.look };
    let ink = p.ink;
    const sw = (key, arr, cur) => `<div class="swatches" data-key="${key}">${arr.map((c) => `<button class="swatch ${c === cur ? 'sel' : ''}" data-v="${c}" style="--c:${c}"></button>`).join('')}</div>`;
    const node = el(`<div class="overlay side-left locker"><div class="panel tall">
      <h2>${create ? 'CREATE YOUR DRIPKIN' : 'STYLE LAB'}</h2>
      <div class="lk-scroll">
        <label class="field">Name <input class="name-in" maxlength="12" value="${p.name}" spellcheck="false"></label>
        <h3>Ink color</h3>${sw('ink', INK_CHOICES, ink)}
        <h3>Drip style</h3><div class="chips" data-key="hair">${HAIR_STYLES.map((h) => `<button class="chip ${h === look.hair ? 'sel' : ''}" data-v="${h}">${HAIR_LABEL[h]}</button>`).join('')}</div>
        <h3>Skin</h3>${sw('skin', SKIN_TONES, look.skin)}
        <h3>Eyes</h3>${sw('eyes', EYE_COLORS, look.eyes)}
        <h3>Top</h3><div class="chips" data-key="topStyle">${Object.keys(STYLE_LABEL).map((h) => `<button class="chip ${h === look.topStyle ? 'sel' : ''}" data-v="${h}">${STYLE_LABEL[h]}</button>`).join('')}</div>
        ${sw('top', OUTFIT_COLORS, look.top)}
        <h3>Bottoms</h3>${sw('bottom', BOTTOMS, look.bottom)}
        <h3>Kicks</h3>${sw('shoes', SHOES, look.shoes)}
        <h3>Emotes</h3><div class="chips emotes">${['wave', 'dance', 'cheer', 'think'].map((e) => `<button class="chip" data-emote="${e}">${e}</button>`).join('')}</div>
      </div>
      <button class="btn big" data-back>${create ? "LET'S GO!" : 'DONE'}</button>
    </div></div>`);
    const close = this.open(node);
    const apply = () => onChange({ ...look }, ink);
    node.querySelectorAll('[data-key]').forEach((grp) => {
      grp.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => {
        const k = grp.dataset.key, v = b.dataset.v;
        if (k === 'ink') ink = v; else look[k] = v;
        grp.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('sel', x === b));
        this.sfx('ui_select');
        apply();
      });
    });
    node.querySelectorAll('[data-emote]').forEach((b) => b.onclick = () => { onEmote(b.dataset.emote); this.sfx('ui_select'); });
    const nameIn = node.querySelector('.name-in');
    nameIn.addEventListener('keydown', (e) => e.stopPropagation());
    node.querySelector('[data-back]').onclick = () => {
      const nm = nameIn.value.trim().replace(/[<>&"]/g, '').slice(0, 12);
      if (!nm) { nameIn.focus(); this.sfx('ui_error'); return; }
      p.name = nm; p.look = look; p.ink = ink; p.created = true;
      app.save();
      this.sfx('ui_select');
      close();
      onClose();
    };
    if (create) setTimeout(() => nameIn.select(), 300);
    this.padNav(node);
  }

  // ------------------------------------------------------------ judge
  judge(r, colors, myTeam, done) {
    const ca = hexToCss(colors[1]), cb = hexToCss(colors[2]);
    const node = el(`<div class="overlay judge" style="--a:${ca};--b:${cb}">
      <div class="jd-title">JUDGING…</div>
      <div class="jd-bar"><div class="jd-a"></div><div class="jd-b"></div></div>
      <div class="jd-nums"><div class="na">0.0%</div><div class="nb">0.0%</div></div>
      <div class="jd-win"></div>
    </div>`);
    const close = this.open(node);
    const total = Math.max(1, r.a + r.b);
    let t = 0;
    const iv = setInterval(() => {
      t += 0.05;
      const k = Math.min(1, Math.max(0, (t - 1.2) / 1.6));
      const e = 1 - Math.pow(1 - k, 3);
      node.querySelector('.jd-a').style.width = `${(r.a / total) * 100 * e}%`;
      node.querySelector('.jd-b').style.width = `${(r.b / total) * 100 * e}%`;
      node.querySelector('.na').textContent = `${(r.a * e).toFixed(1)}%`;
      node.querySelector('.nb').textContent = `${(r.b * e).toFixed(1)}%`;
      if (k >= 1 && !node.classList.contains('done')) {
        node.classList.add('done');
        const won = r.winner === myTeam;
        node.querySelector('.jd-title').textContent = 'FINAL TURF';
        node.querySelector('.jd-win').innerHTML = `<span style="color:${r.winner === 1 ? ca : cb}">${won ? 'YOUR TEAM WINS!' : 'YOUR TEAM LOST…'}</span>`;
        node.classList.add(won ? 'won' : 'lost');
      }
      if (t > 5.4) { clearInterval(iv); close(); done(); }
    }, 50);
  }

  // ------------------------------------------------------------ results
  results(s, { onPlaza, onAgain }) {
    const c = (t) => hexToCss(s.colors[t]);
    const row = (r) => `<tr class="${r.me ? 'me' : ''}" style="--c:${c(r.team)}"><td><i></i>${r.name}</td><td>${r.weapon}</td><td>${r.turf}p</td><td>${r.kills}<small>+${r.assists}</small></td><td>${r.deaths}</td></tr>`;
    const team = (t) => s.rows.filter((r) => r.team === t).sort((a, b) => b.turf - a.turf).map(row).join('');
    const my = s.myTeam, op = 3 - my;
    const pg = s.prog;
    const node = el(`<div class="overlay results ${s.won ? 'won' : 'lost'}">
      <div class="panel wide">
        <div class="rs-head"><h2>${s.won ? 'VICTORY!' : 'DEFEAT'}</h2><div class="rs-pct"><b style="color:${c(1)}">${s.result.a.toFixed(1)}%</b> vs <b style="color:${c(2)}">${s.result.b.toFixed(1)}%</b></div></div>
        <table class="rs-table">
          <thead><tr><th>Your team</th><th>Weapon</th><th>Turf</th><th>Splashes</th><th>Splashed</th></tr></thead>
          <tbody>${team(my)}</tbody>
          <thead><tr><th>Opponents</th><th></th><th></th><th></th><th></th></tr></thead>
          <tbody>${team(op)}</tbody>
        </table>
        <div class="rewards">
          <div class="rw"><span class="coin">◉</span> +${s.coins.toLocaleString()} <small>coins</small></div>
          <div class="rw">+${s.xp} <small>XP</small></div>
          <div class="lvl">LV <b>${pg.level}</b><div class="xpbar"><i style="width:${pg.pct}%"></i></div>${pg.levelUp ? '<span class="lvup">LEVEL UP!</span>' : ''}</div>
        </div>
        <div class="rs-actions">
          <button class="btn ghost" data-a="plaza">BACK TO PLAZA</button>
          <button class="btn big" data-a="again">PLAY AGAIN</button>
        </div>
      </div>
    </div>`);
    const close = this.open(node);
    node.querySelector('[data-a="plaza"]').onclick = () => { this.sfx('ui_select'); close(); onPlaza(); };
    node.querySelector('[data-a="again"]').onclick = () => { this.sfx('ui_select'); close(); onAgain(); };
    this.padNav(node);
  }
}
