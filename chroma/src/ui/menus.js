// All overlay menus (DOM). Each takes callbacks; the app owns game state.
import { WEAPONS, WEAPON_IDS, SPECIALS, SUBS } from '../actors/weapons.js';
import { currentRotation } from '../world/rotation.js';
import { MODES } from '../net/room.js';
import { SKIN_TONES, EYE_COLORS, CRESTS, PATTERNS, PATTERN_COLORS, BOTTOMS, CREST_LABEL, PATTERN_LABEL, HATS, CLOTHES, SHOES, ABILITIES } from '../actors/gear.js';
import { COLOR_PAIRS, hexToCss } from '../util.js';
import { STAGE_IDS, stageInfo } from '../world/stage.js';

const SPLAT = 'M50 4c8 0 9 13 17 14s15-9 21-2-5 15 0 22 16 6 12 16-16 3-20 9 1 19-8 21-11-10-19-8-10 15-19 11 1-15-6-20-19 2-20-8 11-11 10-19-13-8-11-17 14-5 20-11-2-22 6-25 8 8 15 6 3-7 9-7z';
const INK_CHOICES = [...new Set(COLOR_PAIRS.flatMap((c) => [c.a, c.b]))];

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
    return () => {
      node.style.pointerEvents = 'none'; // no double-clicks during the fade-out
      node.dataset.closed = '1';
      node.classList.remove('on');
      setTimeout(() => node.remove(), 260);
    };
  }

  // ------------------------------------------------------------ loading
  loading(on, text = 'Loading...') {
    const L = document.getElementById('loading');
    L.querySelector('.ld-text').textContent = text;
    L.classList.toggle('on', on);
  }

  // ------------------------------------------------------------ title
  title({ onPlaza, onQuick, onOnline, onSettings, firstTime }) {
    const node = el(`
      <div class="overlay title-screen">
        <div class="logo">
          <svg class="logo-splat" viewBox="0 0 100 100"><path d="${SPLAT}"/></svg>
          <div class="logo-text">${'CHROMA'.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}<br>${'CLASH'.split('').map((c, i) => `<span style="--i:${i + 6}">${c}</span>`).join('')}</div>
          <div class="logo-sub">INK · SWIM · PAINT THE TOWN</div>
        </div>
        <div class="press">PRESS ANY BUTTON</div>
        <div class="title-menu">
          <button class="btn big" data-a="plaza">${firstTime ? '✦ CREATE YOUR CHROMELEON' : '▶ ENTER PRISM PLAZA'}</button>
          <button class="btn online-btn" data-a="online">🌐 PLAY ONLINE</button>
          <button class="btn" data-a="quick">⚡ QUICK CPU BATTLE</button>
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
    clearInterval(this._titlePad);
    this._titlePad = setInterval(() => { if (!armed && this.app.input.pad && this.app.input.padButtons.some((b) => b)) arm(); }, 100);
    const done = () => { removeEventListener('keydown', onKey); clearInterval(this._titlePad); close(); };
    node.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armed) { arm(); return; }
      const a = b.dataset.a;
      this.sfx('ui_select');
      if (a === 'plaza') { done(); onPlaza(); }
      if (a === 'quick') { done(); onQuick(); }
      if (a === 'online') { done(); if (firstTime) onPlaza(); else onOnline(); }
      if (a === 'settings') onSettings();
    }));
    this.padNav(node, () => armed);
    return done;
  }

  // gamepad / arrow navigation over a node's buttons
  padNav(node, enabled = () => true) {
    let idx = 0;
    let prev = [];
    const iv = setInterval(() => {
      if (!node.isConnected) { clearInterval(iv); return; }
      const raw = this.app.input.padButtons || [];
      const inp = { padPressed: (i) => !!raw[i] && !prev[i] };
      const top = [...this.root.children].filter((c) => !c.dataset.closed).pop();
      const active = enabled() && top === node && !node.dataset.closed;
      if (!active) { prev = raw.slice(); return; }
      const btns = [...node.querySelectorAll('button:not([disabled]), .swatch, .chip')].filter((b) => b.offsetParent);
      if (!btns.length) return;
      let moved = false;
      if (inp.padPressed(13) || inp.padPressed(15)) { idx = (idx + 1) % btns.length; moved = true; }
      if (inp.padPressed(12) || inp.padPressed(14)) { idx = (idx - 1 + btns.length) % btns.length; moved = true; }
      if (moved) { btns.forEach((b) => b.classList.remove('focus')); btns[idx].classList.add('focus'); btns[idx].scrollIntoView({ block: 'nearest' }); this.sfx('ui_move'); }
      if (inp.padPressed(0)) btns[idx]?.click();
      if (inp.padPressed(1)) node.querySelector('[data-back]')?.click();
      prev = raw.slice();
    }, 30);
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
    if (!on) {
      this._pauseClose?.(); this._pauseClose = null;
      if (this._pauseEsc) { removeEventListener('keydown', this._pauseEsc, true); this._pauseEsc = null; }
      return;
    }
    if (this._pauseClose) return;
    const node = el(`<div class="overlay dim pause"><div class="panel narrow">
      <h2>PAUSED</h2>
      <button class="btn big" data-a="resume" data-back>RESUME</button>
      ${this.settingsHTML()}
      <div class="keys">WASD move · Mouse aim · LMB fire · SHIFT swim · SPACE jump · RMB bomb · Q special · TAB map · E interact</div>
      <button class="btn ghost" data-a="quit">${opts.quitLabel || 'QUIT'}</button>
    </div></div>`);
    this._pauseClose = this.open(node);
    this.bindSettings(node);
    node.querySelector('[data-a="resume"]').onclick = () => { this.sfx('ui_select'); this.pause(false); opts.onResume?.(); };
    node.querySelector('[data-a="quit"]').onclick = () => { this.sfx('ui_back'); this.pause(false); opts.onQuit?.(); };
    const esc = (e) => {
      if (!node.isConnected || node.dataset.closed) { removeEventListener('keydown', esc, true); return; }
      if (e.code !== 'Escape') return;
      e.stopPropagation();
      setTimeout(() => { if (this._pauseClose) { this.pause(false); opts.onResume?.(); } }, 0);
    };
    if (this._pauseEsc) removeEventListener('keydown', this._pauseEsc, true);
    this._pauseEsc = esc;
    setTimeout(() => { if (this._pauseEsc === esc) addEventListener('keydown', esc, true); }, 50);
    this.padNav(node);
  }

  // ------------------------------------------------------------ tower: pick how to play
  towerMenu({ onCPU, onOnline, onPrivate, onClose }) {
    const node = el(`<div class="overlay dim tower"><div class="panel wide">
      <div class="lobby-head"><h2>CLASH TOWER</h2><div class="mode-pill">TURF RUSH</div></div>
      <div class="tower-cards">
        <button class="tcard online" data-a="online"><div class="tc-ico">🌐</div><b>ONLINE MATCH</b><span>Jump into the queue — we'll keep looking for players until a match fills. CPUs fill any empty seats.</span></button>
        <button class="tcard private" data-a="private"><div class="tc-ico">🔒</div><b>PRIVATE MATCH</b><span>Make a room, share the 4-letter code with friends, and set the stage, time, teams and CPUs.</span></button>
        <button class="tcard cpu" data-a="cpu"><div class="tc-ico">🤖</div><b>CPU MATCH</b><span>Play offline against bots right now. Pick your stage and difficulty.</span></button>
      </div>
      <div class="lobby-actions"><button class="btn ghost" data-back>LEAVE</button><span class="hint">Online play connects players directly — everyone needs this same game version.</span></div>
    </div></div>`);
    const close = this.open(node);
    node.querySelector('[data-a="online"]').onclick = () => { this.sfx('ui_select'); close(); onOnline(); };
    node.querySelector('[data-a="private"]').onclick = () => { this.sfx('ui_select'); close(); onPrivate(); };
    node.querySelector('[data-a="cpu"]').onclick = () => { this.sfx('ui_select'); close(); onCPU(); };
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onClose(); };
    this.padNav(node);
  }

  searching({ onCancel }) {
    const node = el(`<div class="overlay dim searching-ui"><div class="panel narrow">
      <h2>ONLINE MATCH</h2>
      <div class="search-anim"><i></i><i></i><i></i></div>
      <div class="search-status">Connecting…</div>
      <button class="btn ghost" data-back>CANCEL</button>
    </div></div>`);
    const close = this.open(node);
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onCancel(); };
    return {
      status: (t) => { node.querySelector('.search-status').textContent = t; },
      error: (t) => { node.querySelector('.search-status').innerHTML = `<span class="err">${t}</span>`; node.querySelector('.search-anim').style.display = 'none'; },
      close,
    };
  }

  privateMenu({ onCreate, onJoin, onClose }) {
    const node = el(`<div class="overlay dim privmenu"><div class="panel narrow">
      <h2>PRIVATE MATCH</h2>
      <button class="btn big" data-a="create">CREATE A ROOM</button>
      <div class="or">— or join a friend —</div>
      <label class="field">Room code <input class="code-in" maxlength="4" placeholder="ABCD" spellcheck="false" autocomplete="off"></label>
      <button class="btn" data-a="join">JOIN ROOM</button>
      <div class="priv-status"></div>
      <button class="btn ghost" data-back>BACK</button>
    </div></div>`);
    const close = this.open(node);
    const st = node.querySelector('.priv-status');
    const inp = node.querySelector('.code-in');
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') node.querySelector('[data-a="join"]').click(); });
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    const busy = (t) => { st.innerHTML = t; node.querySelectorAll('button').forEach((b) => { if (!b.dataset.back) b.disabled = true; }); };
    const fail = (t) => { st.innerHTML = `<span class="err">${t}</span>`; node.querySelectorAll('button').forEach((b) => { b.disabled = false; }); };
    node.querySelector('[data-a="create"]').onclick = () => { this.sfx('ui_select'); busy('Creating your room…'); onCreate().then(() => close()).catch((e) => fail(e.message || String(e))); };
    node.querySelector('[data-a="join"]').onclick = () => { this.sfx('ui_select'); busy(`Looking for room ${inp.value}…`); onJoin(inp.value).then(() => close()).catch((e) => fail(e.message || String(e))); };
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onClose(); };
    setTimeout(() => inp.focus(), 250);
  }

  // The room screen (quick-match waiting room or private room)
  netRoom(room, { onLeave, onStart }) {
    const app = this.app, p = app.profile;
    const priv = room.kind === 'private';
    const node = el(`<div class="overlay dim netroom"><div class="panel wide">
      <div class="lobby-head"><h2>${priv ? 'PRIVATE ROOM' : 'ONLINE MATCH'}</h2>${priv ? `<div class="room-code" title="Click to copy">CODE <b>${room.code}</b></div>` : '<div class="mode-pill live">● LOOKING FOR PLAYERS</div>'}</div>
      <div class="room-status"></div>
      <div class="room-teams"><div class="rteam" data-team="1"><h3>ALPHA</h3><div class="rlist"></div></div><div class="rteam" data-team="2"><h3>BRAVO</h3><div class="rlist"></div></div></div>
      <div class="room-cols">
        <div><h3>Your weapon</h3><div class="wpick"></div></div>
        <div class="room-settings"></div>
      </div>
      <div class="lobby-actions"><button class="btn ghost" data-back>LEAVE ROOM</button><div class="room-start"></div></div>
    </div></div>`);
    const close = this.open(node);
    this._netRoomClose = () => { off(); close(); this._netRoomClose = null; };
    const stages = [['random', 'Random'], ['rotation', 'Rotation pick'], ...STAGE_IDS.map((id) => [id, stageInfo(id).name])];
    // only touch the DOM when a part really changed, so the countdown ticking
    // doesn't rebuild buttons under the cursor or close an open dropdown
    const put = (target, html) => { const e = typeof target === 'string' ? node.querySelector(target) : target; if (e && e._h !== html) { e._h = html; e.innerHTML = html; } };
    const render = () => {
      if (!node.isConnected) return;
      const s = room.settings;
      const me = room.me;
      const host = room.isHost;
      const humans = room.members.length;
      // status
      let status;
      if (room.phase === 'match') status = 'Match in progress…';
      else if (!priv) status = room.countdown != null ? `Match starts in <b>${room.countdown}</b> — more players can still join!` : humans < 2 ? `Waiting for players to join… <b>${humans}/8</b>` : 'Get ready…';
      else status = host ? `Share the code <b>${room.code}</b> with your friends, then press START.` : 'Waiting for the host to start…';
      put('.room-status', status);
      // teams
      for (const t of [1, 2]) {
        const list = room.members.filter((m) => m.team === t);
        const slots = [];
        for (let i = 0; i < 4; i++) {
          const m = list[i];
          if (m) slots.push(`<div class="rslot ${m.id === room.myId ? 'me' : ''}" style="--c:${m.ink || '#fff'}"><i></i><b>${m.name}</b><small>${WEAPONS[m.weapon]?.name || ''}${m.host ? ' · HOST' : ''}</small>${host && priv && m.id !== room.myId ? `<button class="mini" data-swap="${m.id}">⇄</button>` : ''}</div>`);
          else slots.push(`<div class="rslot empty">${s.bots ? 'CPU' : 'open'}</div>`);
        }
        put(`.rteam[data-team="${t}"] .rlist`, slots.join(''));
      }
      if (priv && me && !s.teamLock) {
        for (const t of [1, 2]) {
          put(`.rteam[data-team="${t}"] h3`, `${t === 1 ? 'ALPHA' : 'BRAVO'}${me.team !== t ? ' <button class="mini" data-join-team="' + t + '">JOIN</button>' : ''}`);
        }
      }
      // weapon picker (own)
      put('.wpick', p.owned.map((id) => `<button class="chip ${me?.weapon === id ? 'sel' : ''}" data-w="${id}"><b>${WEAPONS[id].name}</b><small>${WEAPONS[id].cls}</small></button>`).join(''));
      // settings
      const set = node.querySelector('.room-settings');
      if (priv && host) {
        put(set, `<h3>Match settings</h3>
          <label class="field-row">Mode <select data-set="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${s.mode === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
          <label class="field-row">Stage <select data-set="stage">${stages.map(([k, v]) => `<option value="${k}" ${s.stage === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field-row">Time <select data-set="time">${[60, 120, 180, 240, 300].map((t) => `<option value="${t}" ${s.time === t ? 'selected' : ''}>${t / 60} min</option>`).join('')}</select></label>
          <label class="field-row">CPU players <select data-set="bots"><option value="1" ${s.bots ? 'selected' : ''}>Fill empty seats</option><option value="0" ${!s.bots ? 'selected' : ''}>None</option></select></label>
          <label class="field-row">CPU skill <select data-set="skill">${['easy', 'normal', 'hard'].map((k) => `<option ${s.skill === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="field-row">Teams <select data-set="teamLock"><option value="0" ${!s.teamLock ? 'selected' : ''}>Players choose</option><option value="1" ${s.teamLock ? 'selected' : ''}>Host decides</option></select></label>
          <button class="btn small ghost" data-a="shuffle">SHUFFLE TEAMS</button>`);
      } else {
        const stName = s.stage === 'random' ? 'Random' : s.stage === 'rotation' ? 'Rotation pick' : stageInfo(s.stage)?.name;
        put(set, `<h3>Match</h3><div class="set-ro">${MODES[s.mode]?.name || 'Turf Rush'} · ${stName} · ${s.time / 60} min · CPUs ${s.bots ? 'on' : 'off'} (${s.skill})</div>`);
      }
      // start button
      const startEl = node.querySelector('.room-start');
      if (host && room.phase === 'lobby') {
        const ok = priv ? (s.bots || (room.members.some((m) => m.team === 1) && room.members.some((m) => m.team === 2))) : true;
        put(startEl, `<button class="btn big go" data-a="start" ${ok ? '' : 'disabled'}>${priv ? 'START MATCH' : humans < 2 ? 'START NOW WITH CPUs' : 'START NOW'}</button>`);
      } else put(startEl, '');
      bind();
    };
    const bind = () => {
      node.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { this.sfx('ui_select'); p.weapon = b.dataset.w; app.save(); room.updateMe({ weapon: b.dataset.w }); if (!room.isHost) { room.me && (room.me.weapon = b.dataset.w); render(); } });
      node.querySelectorAll('[data-swap]').forEach((b) => b.onclick = () => { const m = room.members.find((x) => x.id === b.dataset.swap); if (m) room.setTeam(m.id, m.team === 1 ? 2 : 1); this.sfx('ui_move'); });
      node.querySelectorAll('[data-join-team]').forEach((b) => b.onclick = () => { const t = +b.dataset.joinTeam; this.sfx('ui_move'); if (room.isHost) room.setTeam(room.myId, t); else room.updateMe({ team: t }); });
      node.querySelectorAll('[data-set]').forEach((sel) => sel.onchange = () => {
        const k = sel.dataset.set;
        let v = sel.value;
        if (k === 'time') v = +v;
        if (k === 'bots' || k === 'teamLock') v = v === '1';
        room.setSettings({ [k]: v });
        this.sfx('ui_select');
      });
      const sh = node.querySelector('[data-a="shuffle"]'); if (sh) sh.onclick = () => { room.shuffleTeams(); this.sfx('ui_select'); };
      const go = node.querySelector('[data-a="start"]'); if (go) go.onclick = () => { this.sfx('special_ready'); onStart(); };
    };
    const off = room.on('lobby', render);
    node.querySelector('.room-code')?.addEventListener('click', () => { navigator.clipboard?.writeText(room.code).catch(() => {}); app.toast(`Copied room code <b>${room.code}</b>`); });
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); this._netRoomClose?.(); onLeave(); };
    render();
    return { close: () => this._netRoomClose?.(), render };
  }

  closeNetRoom() { this._netRoomClose?.(); }

  // ------------------------------------------------------------ lobby
  lobby({ onStart, onClose }) {
    const p = this.app.profile;
    const rot = currentRotation();
    let weapon = p.weapon, skill = p.lastSkill || 'normal', stage = ['random', ...rot.ids].includes(p.lastStage) ? p.lastStage : 'rotation';
    const node = el(`<div class="overlay dim lobby"><div class="panel wide">
      <div class="lobby-head"><h2>CLASH TOWER</h2><div class="mode-pill">TURF RUSH · 4v4 · 3:00</div></div>
      <div class="lobby-grid">
        <div>
          <h3>Your weapon</h3>
          <div class="wpick">${p.owned.map((id) => `<button class="chip ${id === weapon ? 'sel' : ''}" data-w="${id}"><b>${WEAPONS[id].name}</b><small>${WEAPONS[id].cls}</small></button>`).join('')}</div>
          <p class="hint">Buy more at <b>Blastworks</b> in the plaza.</p>
        </div>
        <div>
          <h3>Opponents</h3>
          <div class="skill">${['easy', 'normal', 'hard'].map((s) => `<button class="chip ${s === skill ? 'sel' : ''}" data-k="${s}">${s.toUpperCase()}</button>`).join('')}</div>
          <h3>Stage</h3>
          <div class="stages">${['rotation', ...rot.ids, 'random'].map((id) => `<button class="chip ${id === stage ? 'sel' : ''}" data-st="${id}">${id === 'random' ? 'Any stage' : id === 'rotation' ? 'Rotation pick' : stageInfo(id).name}</button>`).join('')}</div>
          <p class="hint">Live rotation changes in <b>${rot.minutesLeft} min</b>.</p>
        </div>
      </div>
      <div class="lobby-slots"></div>
      <div class="lobby-actions">
        <button class="btn ghost" data-back>LEAVE</button>
        <button class="btn big go" data-a="go">FIND MATCH</button>
      </div>
    </div></div>`);
    const close = this.open(node);
    const sel = (attr, v) => node.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('sel', b.dataset[attr] === v));
    node.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => { stage = b.dataset.st; sel('st', stage); this.sfx('ui_select'); });
    node.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { weapon = b.dataset.w; sel('w', weapon); this.sfx('ui_select'); });
    node.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { skill = b.dataset.k; sel('k', skill); this.sfx('ui_select'); });
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onClose(); };
    node.querySelector('[data-a="go"]').onclick = () => {
      this.sfx('ui_select');
      p.weapon = weapon; p.lastSkill = skill; p.lastStage = stage; this.app.save();
      const chosen = stage === 'random' ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : stage === 'rotation' ? rot.ids[Math.floor(Math.random() * rot.ids.length)] : stage;
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
          setTimeout(() => { close(); onStart({ weapon, skill, stage: chosen }); }, 900);
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

  // ------------------------------------------------------------ weapon shop (Blastworks)
  weaponShop({ onPreview, onEquip, onTry, onClose }) {
    const app = this.app, p = app.profile;
    let sel = p.weapon;
    const node = el(`<div class="overlay side-right wshop"><div class="panel shopwide">
      <div class="shop-head"><h2>BLASTWORKS</h2><div class="coins"><span class="coin">◉</span> <b class="cv"></b></div></div>
      <div class="shop-cols"><div class="shop-list"></div><div class="shop-detail"></div></div>
      <button class="btn ghost" data-back>LEAVE COUNTER</button>
    </div></div>`);
    const close = this.open(node);
    const list = node.querySelector('.shop-list'), det = node.querySelector('.shop-detail');
    const render = () => {
      node.querySelector('.cv').textContent = p.coins.toLocaleString();
      list.innerHTML = WEAPON_IDS.map((id) => {
        const w = WEAPONS[id];
        const own = p.owned.includes(id), locked = p.level < w.level;
        return `<button class="witem ${id === sel ? 'sel' : ''} ${own ? 'own' : ''} ${locked ? 'locked' : ''}" data-id="${id}">
          <b>${w.name}</b><small>${w.cls}${own ? ' · OWNED' : locked ? ` · LV ${w.level}` : ` · ◉ ${w.price}`}</small>${p.weapon === id ? '<i>★</i>' : ''}</button>`;
      }).join('');
      const w = WEAPONS[sel];
      const own = p.owned.includes(sel), eq = p.weapon === sel, locked = p.level < w.level;
      const bars = Object.entries(w.stats).map(([k, v]) => `<div class="stat"><span>${k}</span><i><b style="width:${v * 100}%"></b></i></div>`).join('');
      let action;
      if (eq) action = '<div class="tag eq">EQUIPPED</div>';
      else if (own) action = `<button class="btn" data-eq>EQUIP</button>`;
      else if (locked) action = `<div class="tag lock">REACH LV ${w.level}</div>`;
      else action = `<button class="btn buy" data-buy ${p.coins < w.price ? 'disabled' : ''}><span class="coin">◉</span> ${w.price.toLocaleString()}</button>`;
      det.innerHTML = `
        <div class="wd-cls">${w.cls.toUpperCase()}</div>
        <div class="wd-name">${w.name}</div>
        <div class="wc-desc">${w.desc}</div>
        <div class="kit"><div><small>SUB</small><b>${SUBS[w.sub].name}</b><span>${SUBS[w.sub].desc}</span></div><div><small>SPECIAL</small><b>${SPECIALS[w.special].name}</b><span>${SPECIALS[w.special].desc}</span></div></div>
        <div class="stats">${bars}</div>
        <div class="wd-actions">${action}${eq ? '' : '<button class="btn ghost small" data-try>TRY IT</button>'}</div>`;
      list.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { sel = b.dataset.id; this.sfx('ui_move'); onPreview(sel); render(); });
      det.querySelector('[data-eq]')?.addEventListener('click', () => { p.weapon = sel; app.save(); onEquip(sel); this.sfx('ui_select'); render(); });
      det.querySelector('[data-try]')?.addEventListener('click', () => { onTry(sel); this.sfx('ui_select'); app.menus.flash(`Trying the <b>${w.name}</b> — head to the Practice Yard!`); });
      det.querySelector('[data-buy]')?.addEventListener('click', () => {
        if (p.coins < w.price) { this.sfx('ui_error'); return; }
        p.coins -= w.price; p.owned.push(w.id); p.weapon = w.id; app.save();
        this.sfx('buy'); onEquip(w.id); render();
      });
    };
    onPreview(sel);
    render();
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onClose(); };
    this.padNav(node);
  }

  // ------------------------------------------------------------ gear shop (Scale & Thread)
  gearShop({ onPreview, onEquip, onClose }) {
    const app = this.app, p = app.profile;
    let tab = 'hat';
    const slots = { hat: HATS, clothes: CLOTHES, shoes: SHOES };
    let sel = p.look[tab];
    const node = el(`<div class="overlay side-right gshop"><div class="panel shopwide">
      <div class="shop-head"><h2>SCALE &amp; THREAD</h2><div class="coins"><span class="coin">◉</span> <b class="cv"></b></div></div>
      <div class="tabs">${Object.keys(slots).map((k) => `<button class="chip" data-tab="${k}">${{ hat: 'HEADGEAR', clothes: 'CLOTHING', shoes: 'SHOES' }[k]}</button>`).join('')}</div>
      <div class="shop-cols"><div class="shop-list"></div><div class="shop-detail"></div></div>
      <button class="btn ghost" data-back>LEAVE COUNTER</button>
    </div></div>`);
    const close = this.open(node);
    const list = node.querySelector('.shop-list'), det = node.querySelector('.shop-detail');
    const preview = () => onPreview({ ...p.look, [tab]: sel });
    const render = () => {
      node.querySelector('.cv').textContent = p.coins.toLocaleString();
      node.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
      list.innerHTML = slots[tab].map((g) => {
        const own = p.gear.includes(g.id);
        return `<button class="witem ${g.id === sel ? 'sel' : ''} ${own ? 'own' : ''}" data-id="${g.id}">
          <b><span class="swatchdot" style="--c:${g.c1 || '#888'}"></span>${g.name}</b><small>${g.ability ? ABILITIES[g.ability].glyph + ' ' + ABILITIES[g.ability].short : '—'}${own ? ' · OWNED' : ` · ◉ ${g.price}`}</small>${p.look[tab] === g.id ? '<i>★</i>' : ''}</button>`;
      }).join('');
      const g = slots[tab].find((x) => x.id === sel) || slots[tab][0];
      const own = p.gear.includes(g.id), eq = p.look[tab] === g.id;
      const ab = g.ability ? ABILITIES[g.ability] : null;
      let action;
      if (eq) action = '<div class="tag eq">WEARING</div>';
      else if (own) action = `<button class="btn" data-eq>WEAR</button>`;
      else action = `<button class="btn buy" data-buy ${p.coins < g.price ? 'disabled' : ''}><span class="coin">◉</span> ${g.price.toLocaleString()}</button>`;
      det.innerHTML = `
        <div class="wd-cls">${g.brand}</div>
        <div class="wd-name">${g.name}</div>
        ${ab ? `<div class="ability"><span class="ab-glyph">${ab.glyph}</span><div><b>${ab.name}</b><span>${ab.desc}</span></div></div>` : '<div class="wc-desc">No ability — just vibes.</div>'}
        <div class="wd-actions">${action}</div>
        <p class="hint">Your three gear abilities stack. Try on anything — it only changes when you wear it.</p>`;
      node.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; sel = p.look[tab]; this.sfx('ui_move'); preview(); render(); });
      list.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { sel = b.dataset.id; this.sfx('ui_move'); preview(); render(); });
      det.querySelector('[data-eq]')?.addEventListener('click', () => { p.look = { ...p.look, [tab]: sel }; app.save(); onEquip(p.look); this.sfx('ui_select'); render(); });
      det.querySelector('[data-buy]')?.addEventListener('click', () => {
        if (p.coins < g.price) { this.sfx('ui_error'); return; }
        p.coins -= g.price; p.gear.push(g.id); p.look = { ...p.look, [tab]: g.id }; app.save();
        this.sfx('buy'); onEquip(p.look); render();
      });
    };
    render();
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onPreview(p.look); onClose(); };
    this.padNav(node);
  }

  // ------------------------------------------------------------ salon / character creator
  salon({ onChange, onEmote, onClose, create = false }) {
    const app = this.app, p = app.profile;
    const look = { ...p.look };
    let ink = p.ink;
    const sw = (key, arr, cur) => `<div class="swatches" data-key="${key}">${arr.map((c) => `<button class="swatch ${c === cur ? 'sel' : ''}" data-v="${c}" style="--c:${c}"></button>`).join('')}</div>`;
    const chips = (key, arr, labels, cur) => `<div class="chips" data-key="${key}">${arr.map((h) => `<button class="chip ${h === cur ? 'sel' : ''}" data-v="${h}">${labels[h]}</button>`).join('')}</div>`;
    const node = el(`<div class="overlay side-left locker"><div class="panel tall">
      <h2>${create ? 'CREATE YOUR CHROMELEON' : 'THE SALON'}</h2>
      <div class="lk-scroll">
        <label class="field">Name <input class="name-in" maxlength="12" value="${p.name}" spellcheck="false"></label>
        <h3>Ink color</h3>${sw('ink', INK_CHOICES, ink)}
        <h3>Crest</h3>${chips('crest', CRESTS, CREST_LABEL, look.crest)}
        <h3>Scales</h3>${sw('skin', SKIN_TONES, look.skin)}
        <h3>Pattern</h3>${chips('pattern', PATTERNS, PATTERN_LABEL, look.pattern)}
        ${sw('patternColor', PATTERN_COLORS, look.patternColor)}
        <h3>Eyes</h3>${sw('eyes', EYE_COLORS, look.eyes)}
        <h3>Shorts</h3>${sw('bottom', BOTTOMS, look.bottom)}
        <h3>Emotes</h3><div class="chips emotes">${['wave', 'dance', 'cheer', 'pose', 'tongue', 'think'].map((e) => `<button class="chip" data-emote="${e}">${e}</button>`).join('')}</div>
        ${create ? '<p class="hint">Hats, clothes and shoes are sold at <b>Scale &amp; Thread</b> in the plaza.</p>' : ''}
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
    node.querySelectorAll('[data-emote]').forEach((b) => b.onclick = () => { onEmote(b.dataset.emote); this.sfx(b.dataset.emote === 'tongue' ? 'tongue' : 'ui_select'); });
    const nameIn = node.querySelector('.name-in');
    nameIn.addEventListener('keydown', (e) => e.stopPropagation());
    node.querySelector('[data-back]').onclick = () => {
      const nm = nameIn.value.trim().replace(/[<>&"'`]/g, '').slice(0, 12);
      if (!nm) { nameIn.focus(); this.sfx('ui_error'); return; }
      p.name = nm; p.look = { ...p.look, ...look }; p.ink = ink; p.created = true;
      app.save();
      this.sfx('ui_select');
      close();
      onClose();
    };
    if (create) setTimeout(() => nameIn.select(), 300);
    this.padNav(node);
  }

  flash(html) { this.app.toast?.(html); }

  // ------------------------------------------------------------ confirm
  confirm({ title, text, yes = 'YES', no = 'NO', onYes, onNo }) {
    const node = el(`<div class="overlay dim confirm"><div class="panel narrow"><h2>${title}</h2><p class="confirm-text">${text}</p>
      <div class="rs-actions"><button class="btn ghost" data-back>${no}</button><button class="btn big" data-a="yes">${yes}</button></div></div></div>`);
    const close = this.open(node);
    node.querySelector('[data-a="yes"]').onclick = () => { this.sfx('ui_select'); close(); onYes?.(); };
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); close(); onNo?.(); };
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
          <button class="btn ghost" data-a="plaza">${s.plazaLabel || 'BACK TO PLAZA'}</button>
          <button class="btn big" data-a="again">${s.againLabel || 'PLAY AGAIN'}</button>
        </div>
      </div>
    </div>`);
    const close = this.open(node);
    node.querySelector('[data-a="plaza"]').onclick = () => { this.sfx('ui_select'); close(); onPlaza(); };
    node.querySelector('[data-a="again"]').onclick = () => { this.sfx('ui_select'); close(); onAgain(); };
    this.padNav(node);
  }
}
