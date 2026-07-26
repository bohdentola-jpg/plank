// The paperwork side of running a hotel: the job board, the ledger, the build
// menu, and every panel you click through. The 3D scene never touches the DOM;
// this file never touches THREE.
import {
  AMENITIES, ROLES, ROLE_BY_ID, TIERS, SPEEDS, TIER_UPGRADE_COST,
  roomBuildCost, floorCost, trainCost, staffWage, roleCap, MAX_FLOORS, starLabel,
} from './data.js';
import {
  money, sortedTasks, taskTitle, roomNumber, builtRooms, occupancy, coverage,
  dailyWages, dailyUpkeep, aggregate, demandPerDay, starRating, repCeiling, guestById, roomById,
  workerById, offlineCapHours, freeRoomsFor, billedRate,
} from './sim.js';
import { TASK_ICON } from './data.js';
import { NEWS_TICKER, genPartyLabel, pick } from './names.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const pct = (v) => `${Math.round(v * 100)}%`;
// The player names their own hotel and that name reaches the log; everything
// rendered through innerHTML goes through here.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

function clockText(state) {
  const h24 = Math.floor(state.clock / 60) % 24;
  const m = Math.floor(state.clock % 60);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export class HUD {
  constructor(actions) {
    this.a = actions;
    this.tab = 'build';
    this.selectedRoom = null;
    this.selectedStaff = null;
    this._taskSig = '';
    this._panelSig = '';
    this._newsAt = 0;
    this.cache = {};
    this.bind();
  }

  bind() {
    this.elName = $('#hud-name');
    this.elStars = $('#hud-stars');
    this.elCash = $('#hud-cash');
    this.elRate = $('#hud-rate');
    this.elClock = $('#hud-clock');
    this.elDay = $('#hud-day');
    this.elOcc = $('#hud-occ');
    this.elTasks = $('#tasklist');
    this.elTaskCount = $('#task-count');
    this.elPanel = $('#panel-body');
    this.elTabs = $('#panel-tabs');
    this.elToasts = $('#toasts');
    this.elYou = $('#you-bar');
    this.elNews = $('#news-ticker');
    this.elBadge = $('#auto-badge');
    this.elOverlay = $('#overlay');
    this.elInspector = $('#inspector');

    $('#speed-buttons').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.speed) this.a.setSpeed(Number(b.dataset.speed));
      if (b.dataset.pause) this.a.togglePause();
    });
    this.elTabs.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.tab = b.dataset.tab;
      this._panelSig = '';
      this.renderTabs();
    });
    this.elTasks.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-assign]');
      if (chip) {                       // the room chip opens the picker instead of taking the job
        this.assignGuest = chip.dataset.assign;
        this.selectedRoom = null;
        this._inspSig = '';
        return;
      }
      const row = e.target.closest('.task');
      if (row) this.a.claim(row.dataset.id);
    });
    this.elPanel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.a.panelAction(b.dataset.act, b.dataset.id, b);
    });
    this.elPanel.addEventListener('input', (e) => {
      if (e.target.id !== 'rate-slider') return;
      this.a.setRate(Number(e.target.value) / 100);
      // Repaint the readout now rather than on the next HUD tick, so the number
      // tracks the thumb even on a machine that is only managing a few frames.
      if (this._state) this.refreshRates(this._state, aggregate(this._state));
    });
    this.elInspector.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) this.a.panelAction(b.dataset.act, b.dataset.id, b);
      if (e.target.closest('.insp-close')) { this.selectedRoom = null; this.assignGuest = null; }
    });
    this.elYou.addEventListener('click', (e) => {
      if (e.target.closest('#you-auto')) this.a.toggleAuto();
    });
    this.renderTabs();
  }

  renderTabs() {
    for (const b of this.elTabs.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.tab === this.tab);
    }
  }

  // ---------------------------------------------------------------- toasts
  toast(text, kind = 'info', icon = '') {
    const n = el('div', `toast ${kind}`, `${icon ? `<span class="ti">${esc(icon)}</span>` : ''}<span>${esc(text)}</span>`);
    this.elToasts.appendChild(n);
    requestAnimationFrame(() => n.classList.add('in'));
    setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, 3600);
    while (this.elToasts.children.length > 6) this.elToasts.firstChild.remove();
  }

  modal(title, html, buttons = [], { onDismiss = null } = {}) {
    this._onDismiss = onDismiss;
    const card = el('div', 'modal-card');
    card.appendChild(el('h2', null, title));
    card.appendChild(el('div', 'modal-body', html));
    const row = el('div', 'modal-buttons');
    for (const b of buttons) {
      const btn = el('button', b.primary ? 'btn primary' : 'btn', b.label);
      btn.onclick = () => { this._onDismiss = null; this.closeModal(); b.onPick?.(); };
      row.appendChild(btn);
    }
    card.appendChild(row);
    this.elOverlay.innerHTML = '';
    this.elOverlay.appendChild(card);
    this.elOverlay.classList.add('show');
  }
  closeModal() {
    this.elOverlay.classList.remove('show');
    this.elOverlay.innerHTML = '';
    const fn = this._onDismiss;
    this._onDismiss = null;
    fn?.();
  }

  // ---------------------------------------------------------------- frame
  render(state, paused) {
    const agg = aggregate(state);
    this._state = state;
    this.elName.textContent = state.name;
    this.elStars.textContent = starLabel(starRating(state, agg));
    this.elStars.title = `${starRating(state, agg).toFixed(2)} stars`;
    this.elCash.textContent = money(state.cash);
    this.elCash.classList.toggle('broke', state.cash < 0);
    this.elClock.textContent = clockText(state);
    this.elDay.textContent = `DAY ${state.day}`;
    const built = builtRooms(state).length;
    this.elOcc.textContent = `${Math.round(occupancy(state) * built)}/${built} full`;
    this.elRate.textContent = `${money(TIERS[1].rate * state.rateMult * agg.rate)}/night`;

    for (const b of $('#speed-buttons').querySelectorAll('button[data-speed]')) {
      b.classList.toggle('on', !paused && Number(b.dataset.speed) === state.speed);
    }
    $('#btn-pause').classList.toggle('on', paused);

    const cov = coverage(state);
    this.elBadge.className = `badge ${cov.full ? (cov.nightOk ? 'gold' : 'green') : 'grey'}`;
    this.elBadge.textContent = cov.full
      ? (cov.nightOk ? 'AUTOPILOT · 24H' : 'AUTOPILOT · DAYS ONLY')
      : `MANUAL · needs ${cov.missing.map((m) => ROLE_BY_ID[m].name.split(' ').pop().toLowerCase()).join(', ')}`;
    this.elBadge.title = cov.full
      ? `The crew covers every job. You can close the tab for up to ${offlineCapHours(state)}h.`
      : 'Hire one of each core role and the hotel runs itself.';

    this.renderTasks(state);
    this.renderYou(state, agg);
    this.renderPanel(state, agg);
    this.refreshRates(state, agg);
    this.renderInspector(state, agg);
    this.renderNews();
  }

  renderTasks(state) {
    const tasks = sortedTasks(state);
    const sig = tasks.map((t) => `${t.id}:${t.claimedBy || ''}:${Math.round(this.urg(state, t) * 4)}`).join('|');
    this.elTaskCount.textContent = String(tasks.length);
    this.elTaskCount.classList.toggle('hot', tasks.length > 4);
    if (sig === this._taskSig) return;
    this._taskSig = sig;
    this.elTasks.innerHTML = '';
    if (!tasks.length) {
      this.elTasks.appendChild(el('div', 'task-empty', 'Nothing needs doing. Enjoy it.'));
      return;
    }
    for (const t of tasks.slice(0, 12)) {
      const worker = t.claimedBy ? workerById(state, t.claimedBy) : null;
      const row = el('div', `task t-${t.type}${worker ? ' claimed' : ''}${worker && worker.kind === 'you' ? ' mine' : ''}`);
      row.dataset.id = t.id;
      row.innerHTML = `
        <span class="tk-icon">${TASK_ICON[t.type] || '•'}</span>
        <span class="tk-main">
          <span class="tk-title">${esc(taskTitle(state, t))}</span>
          <span class="tk-sub">${worker ? (worker.kind === 'you' ? 'You are on it' : `${esc(worker.name)} is on it`) : esc(this.hint(state, t))}</span>
        </span>
        <span class="tk-go">${worker ? '' : 'TAKE'}</span>`;
      if (t.type === 'checkin') {
        const g = guestById(state, t.guestId);
        const room = g && g.roomId ? roomById(state, g.roomId) : null;
        if (g) {
          const chip = el('span', `tk-room${room && room.tier < g.want ? ' under' : ''}`,
            room ? `🛏 ${roomNumber(room)}` : '🛏 —');
          chip.dataset.assign = g.id;
          chip.title = 'Put them in a different room';
          row.querySelector('.tk-go').before(chip);
        }
      }
      const urg = Math.min(1, this.urg(state, t) / 9);
      row.style.setProperty('--urg', urg.toFixed(2));
      this.elTasks.appendChild(row);
    }
    if (tasks.length > 12) this.elTasks.appendChild(el('div', 'task-empty', `+${tasks.length - 12} more waiting`));
  }

  urg(state, t) {
    const g = t.guestId ? guestById(state, t.guestId) : null;
    let u = t.type === 'checkin' ? 5 : t.type === 'service' ? 4 : t.type === 'checkout' ? 3 : 2;
    if (g) u += (1 - (t.type === 'service' ? g.reqPatience : g.patience)) * 6;
    return u;
  }

  hint(state, t) {
    if (t.type === 'checkin' || t.type === 'checkout') {
      const g = guestById(state, t.guestId);
      if (!g) return '';
      const mood = g.patience < 0.3 ? 'About to walk out' : g.patience < 0.6 ? 'Getting restless' : 'Waiting at the desk';
      if (t.type === 'checkout') return mood;
      return `${genPartyLabel(g.party)} · wants a ${TIERS[g.want].name.toLowerCase()} · ${mood}`;
    }
    if (t.type === 'service') {
      const g = guestById(state, t.guestId);
      return g && g.request ? `${g.request.icon} ${g.request.label}` : '';
    }
    const r = roomById(state, t.roomId);
    if (t.type === 'clean') return r ? `${Math.round(r.dirt * 100)}% turnover · ${TIERS[r.tier].name}` : '';
    if (t.type === 'fix') return 'Room is out of service';
    return '';
  }

  // Built once and then written field by field. Replacing the innerHTML nine
  // times a second destroyed the AUTO button between mousedown and mouseup, so
  // the browser never fired a click on it.
  renderYou(state, agg) {
    if (!this._you) {
      this.elYou.innerHTML = `
        <div class="you-face">🧍</div>
        <div class="you-main">
          <div class="you-doing"></div>
          <div class="you-bar-track"><i></i></div>
        </div>
        <div class="you-linen" title="Clean linen on your cart"></div>
        <button id="you-auto"></button>`;
      this._you = {
        doing: $('.you-doing', this.elYou),
        bar: $('.you-bar-track i', this.elYou),
        linen: $('.you-linen', this.elYou),
        auto: $('#you-auto', this.elYou),
      };
    }
    const you = state.you;
    const job = you.job ? state.tasks.find((t) => t.id === you.job.taskId) : null;
    const doing = job ? taskTitle(state, job) : (state.youAuto ? 'Looking for the next job' : 'Standing at the desk');
    const prog = you.job && you.job.phase === 'work' && you.job.dur
      ? 1 - Math.max(0, you.job.timer) / you.job.dur : 0;
    if (this._you.doing.textContent !== doing) this._you.doing.textContent = doing;
    this._you.bar.style.width = pct(prog);
    const linen = `🧺 ${agg.instantLinen ? '∞' : `${you.linen}/${agg.linenMax}`}`;
    if (this._you.linen.textContent !== linen) this._you.linen.textContent = linen;
    const label = state.youAuto ? 'AUTO: ON' : 'AUTO: OFF';
    if (this._you.auto.textContent !== label) {
      this._you.auto.textContent = label;
      this._you.auto.classList.toggle('on', state.youAuto);
    }
  }

  renderNews() {
    const now = performance.now();
    if (now - this._newsAt < 11000) return;
    this._newsAt = now;
    this.elNews.textContent = pick(NEWS_TICKER);
    this.elNews.classList.remove('slide');
    void this.elNews.offsetWidth;
    this.elNews.classList.add('slide');
  }

  // ---------------------------------------------------------------- panels
  renderPanel(state, agg) {
    const sig = [
      this.tab, Math.round(state.cash), builtRooms(state).length, state.floors,
      Object.keys(state.amenities).length, state.staff.map((s) => s.id + s.level).join(),
      state.reviews.length, state.day, this.selectedStaff,
    ].join('|');
    // rateMult is deliberately absent: it changes while the slider is under the
    // player's thumb, and re-rendering the panel would rip the input out mid-drag.
    if (sig === this._panelSig) return;
    this._panelSig = sig;
    const fn = {
      build: () => this.panelBuild(state, agg),
      staff: () => this.panelStaff(state, agg),
      rates: () => this.panelRates(state, agg),
      book: () => this.panelBook(state, agg),
    }[this.tab] || (() => '');
    this.elPanel.innerHTML = fn();
  }

  // Updated in place every frame so the numbers track the slider without the
  // slider itself being replaced.
  refreshRates(state, agg) {
    if (this.tab !== 'rates') return;
    const pctEl = $('#rate-pct', this.elPanel);
    if (!pctEl) return;
    pctEl.textContent = `${Math.round(state.rateMult * 100)}%`;
    $('#rate-tiers', this.elPanel).textContent = TIERS.slice(1)
      .map((t) => `${t.name} ${money(t.rate * state.rateMult * agg.rate)}`).join(' · ');
    $('#rate-demand', this.elPanel).innerHTML =
      `Expect about <b>${demandPerDay(state, agg).toFixed(1)} arrivals a day</b> at this price with `
      + `${starLabel(starRating(state, agg))}. Push it too high and the cars keep driving.`;
  }

  panelBuild(state, agg) {
    const built = builtRooms(state).length;
    const openSlots = state.rooms.filter((r) => !r.built).length;
    const roomCost = roomBuildCost(built);
    const fCost = floorCost(state.floors);
    let h = `<div class="grp">
      <div class="grp-h">THE BUILDING</div>
      ${this.buyRow('room', '🚪', 'Open another room', openSlots
    ? `${openSlots} shell${openSlots > 1 ? 's' : ''} left on floors 1–${state.floors}`
    : 'Every slot is built — add a floor', roomCost, state.cash >= roomCost && openSlots > 0)}
      ${state.floors < MAX_FLOORS
    ? this.buyRow('floor', '🏗', `Build floor ${state.floors + 1}`, openSlots
      ? `Fill your ${openSlots} empty slot${openSlots > 1 ? 's' : ''} first`
      : 'Six more doors, and a taller sign', fCost, state.cash >= fCost && openSlots === 0)
    : '<div class="row flat"><span class="ri">🏙</span><span class="rm"><b>Five floors</b><i>The zoning board says that is the lot.</i></span></div>'}
    </div>`;

    const tiers = [1, 2, 3, 4].map((t) => AMENITIES.filter((a) => a.tier === t));
    const tierNames = ['STARTER', 'GROWING', 'REAL HOTEL', 'DESTINATION'];
    tiers.forEach((list, i) => {
      const owned = list.filter((a) => state.amenities[a.id]);
      const open = list.filter((a) => !state.amenities[a.id]);
      if (!list.length) return;
      h += `<div class="grp"><div class="grp-h">${tierNames[i]} <span class="grp-n">${owned.length}/${list.length}</span></div>`;
      for (const a of open) {
        h += this.buyRow(`am:${a.id}`, a.icon, a.name, `${a.blurb}${a.upkeep ? ` · ${money(a.upkeep)}/day` : ''}`, a.cost, state.cash >= a.cost);
      }
      for (const a of owned) {
        h += `<div class="row owned"><span class="ri">${a.icon}</span><span class="rm"><b>${a.name}</b><i>${this.effectText(a)}</i></span><span class="rc ok">OWNED</span></div>`;
      }
      h += '</div>';
    });
    return h;
  }

  effectText(a) {
    const bits = [];
    if (a.draw) bits.push(`+${Math.round(a.draw * 100)}% traffic`);
    if (a.mood) bits.push(`+${Math.round(a.mood * 100)} mood`);
    if (a.rate) bits.push(`+${Math.round((a.rate - 1) * 100)}% rate ceiling`);
    if (a.rep) bits.push(`+${a.rep.toFixed(2)}★`);
    if (a.pernight) bits.push(`${money(a.pernight)}/guest-night`);
    if (a.cleanSpeed) bits.push(`cleaning ×${a.cleanSpeed}`);
    if (a.checkinSpeed) bits.push(`front desk ×${a.checkinSpeed}`);
    if (a.linens) bits.push(`+${a.linens} linen`);
    if (a.instantLinen) bits.push('carts refill on the floor');
    if (a.elevator) bits.push('vertical travel ×3');
    if (a.wear) bits.push(`${Math.round((1 - a.wear) * 100)}% fewer breakdowns`);
    if (a.groups) bits.push('tour groups book in');
    return bits.join(' · ') || '—';
  }

  buyRow(act, icon, name, sub, cost, can) {
    return `<div class="row${can ? '' : ' cant'}">
      <span class="ri">${icon}</span>
      <span class="rm"><b>${name}</b><i>${sub}</i></span>
      <button class="rc" data-act="${act}" ${can ? '' : 'disabled'}>${money(cost)}</button>
    </div>`;
  }

  panelStaff(state, agg) {
    const built = builtRooms(state).length;
    const cov = coverage(state);
    let h = `<div class="grp"><div class="grp-h">PAYROLL <span class="grp-n">${money(dailyWages(state))}/day</span></div>`;
    if (!state.staff.length) {
      h += '<div class="note">It is just you. Every bell, every bed, every burnt-out bulb.</div>';
    }
    for (const s of state.staff) {
      const role = ROLE_BY_ID[s.role];
      const tCost = trainCost(s.level);
      h += `<div class="row staff">
        <span class="ri">${role.icon}</span>
        <span class="rm"><b>${esc(s.name)} <em>lv${s.level}</em></b><i>${role.name} · ${money(staffWage(s))}/day${s.offShift ? ' · off shift' : ''}</i></span>
        <span class="rc-group">
          ${s.level < 3 ? `<button class="mini" data-act="train:${s.id}" ${state.cash >= tCost ? '' : 'disabled'}>TRAIN ${money(tCost)}</button>` : '<span class="mini flat">MAXED</span>'}
          <button class="mini danger" data-act="fire:${s.id}">LET GO</button>
        </span>
      </div>`;
    }
    h += '</div><div class="grp"><div class="grp-h">HIRING</div>';
    for (const role of ROLES) {
      const have = state.staff.filter((s) => s.role === role.id).length;
      const cap = roleCap(role.id, built);
      const can = state.cash >= role.hire && have < cap;
      const sub = have >= cap
        ? (role.unique ? 'Already on staff' : `At capacity (${have}/${cap}) — build more rooms`)
        : `${role.blurb} · ${money(role.wage)}/day`;
      h += `<div class="row${can ? '' : ' cant'}${cov.missing.includes(role.id) ? ' wanted' : ''}">
        <span class="ri">${role.icon}</span>
        <span class="rm"><b>${role.name}${have ? ` <em>×${have}</em>` : ''}</b><i>${sub}</i></span>
        <button class="rc" data-act="hire:${role.id}" ${can ? '' : 'disabled'}>${money(role.hire)}</button>
      </div>`;
    }
    h += '</div>';
    h += `<div class="note ${cov.full ? 'good' : ''}">${cov.full
      ? `Every job is covered. Close the tab and the hotel keeps trading for up to ${offlineCapHours(state)} hours.`
      : `Still on you: ${cov.missing.map((m) => ROLE_BY_ID[m].name).join(', ')}.`}</div>`;
    return h;
  }

  panelRates(state, agg) {
    const built = builtRooms(state).length;
    const demand = demandPerDay(state, agg);
    const wages = dailyWages(state);
    const upkeep = dailyUpkeep(state, agg);
    const y = state.yesterday;
    let h = `<div class="grp"><div class="grp-h">WHAT YOU CHARGE</div>
      <div class="rate-wrap">
        <input id="rate-slider" type="range" min="60" max="180" value="${Math.round(state.rateMult * 100)}" />
        <div class="rate-read">
          <b id="rate-pct">${Math.round(state.rateMult * 100)}%</b> of the going rate
          <i id="rate-tiers">${TIERS.slice(1).map((t) => `${t.name} ${money(t.rate * state.rateMult * agg.rate)}`).join(' · ')}</i>
        </div>
      </div>
      <div class="note" id="rate-demand">Expect about <b>${demand.toFixed(1)} arrivals a day</b> at this price with ${starLabel(starRating(state, agg))}. Push it too high and the cars keep driving.</div>
      <div class="note">Guests pay for the tier they <b>booked</b>, not the room they end up in — a
      free upgrade buys goodwill, not money. Better rooms only earn their keep once your standing
      is pulling in travellers who came for one.</div>
    </div>`;

    const ceil = repCeiling(state, agg);
    h += `<div class="grp"><div class="grp-h">STANDING</div>
      ${this.statRow('Right now', `${starRating(state, agg).toFixed(2)}★`)}
      ${this.statRow('This property tops out at', `${ceil.toFixed(2)}★`, 'em')}
      <div class="note">Guests can only rate the building you give them. More rooms,
      better rooms and more amenities raise the ceiling; good service walks you up to it.</div>
    </div>`;

    h += `<div class="grp"><div class="grp-h">TODAY SO FAR</div>
      ${this.statRow('Room revenue', money(state.today.revenue))}
      ${this.statRow('Incidentals', money(state.today.incidentals))}
      ${this.statRow('Tips', money(state.today.tips))}
      ${this.statRow('Nights sold', String(state.today.nights))}
      ${this.statRow('Walkouts', String(state.today.walkouts), state.today.walkouts ? 'bad' : '')}
      ${this.statRow('Rooms flipped', String(state.today.cleaned))}
    </div>`;

    h += `<div class="grp"><div class="grp-h">STANDING COSTS</div>
      ${this.statRow('Wages', `${money(wages)}/day`)}
      ${this.statRow('Upkeep &amp; utilities', `${money(upkeep)}/day`)}
      ${this.statRow('Break-even', `${money(wages + upkeep)}/day`, 'em')}
    </div>`;

    if (y) {
      const net = y.revenue + y.incidentals + y.tips - y.wages - y.upkeep;
      h += `<div class="grp"><div class="grp-h">DAY ${y.day} CLOSED</div>
        ${this.statRow('Took in', money(y.revenue + y.incidentals + y.tips))}
        ${this.statRow('Paid out', money(y.wages + y.upkeep))}
        ${this.statRow('Net', money(net), net >= 0 ? 'good' : 'bad')}
      </div>`;
    }
    h += `<div class="grp"><div class="grp-h">ALL TIME</div>
      ${this.statRow('Guest nights', String(state.totals.nights))}
      ${this.statRow('Earned', money(state.totals.earned))}
      ${this.statRow('Walkouts', String(state.totals.walkouts))}
      ${this.statRow('Rooms', `${built} across ${state.floors} floor${state.floors > 1 ? 's' : ''}`)}
    </div>`;
    return h;
  }

  statRow(k, v, cls = '') {
    return `<div class="stat"><span>${k}</span><b class="${cls}">${v}</b></div>`;
  }

  panelBook(state) {
    let h = '<div class="grp"><div class="grp-h">GUEST BOOK</div>';
    if (!state.reviews.length) h += '<div class="note">Nobody has stayed long enough to have an opinion.</div>';
    for (const r of state.reviews.slice(0, 14)) {
      h += `<div class="review r-${esc(r.band)}">
        <div class="rv-top"><b>${esc(r.name)}</b><span>${'★'.repeat(Math.max(1, Math.round(r.stars)))}<em>day ${r.day | 0}</em></span></div>
        <div class="rv-text">“${esc(r.text)}”</div>
      </div>`;
    }
    h += '</div><div class="grp"><div class="grp-h">THE LOG</div>';
    for (const l of state.log.slice(0, 14)) {
      h += `<div class="logline l-${esc(l.kind)}"><em>D${l.day | 0}</em> ${esc(l.text)}</div>`;
    }
    h += '</div>';
    return h;
  }

  // ---------------------------------------------------------------- room picker
  renderAssign(state, agg) {
    const g = guestById(state, this.assignGuest);
    if (!g || g.state !== 'queue') { this.assignGuest = null; this._inspSig = ''; this.elInspector.classList.remove('show'); return; }
    const free = freeRoomsFor(state, g);
    const sig = `A${g.id}${g.roomId}${free.map((r) => r.id + r.tier).join()}`;
    if (sig === this._inspSig) return;
    this._inspSig = sig;
    this.elInspector.classList.add('show');

    const rows = free.map((r) => {
      const fit = r.tier - g.want;
      const takings = billedRate(state, r, g, agg) * g.nights;
      const note = fit === 0 ? 'exactly what they booked'
        : fit > 0 ? `a free upgrade — they booked a ${TIERS[g.want].name.toLowerCase()} and pay for one`
          : `below what they booked — they will remember it`;
      const cls = r.id === g.roomId ? ' on' : fit < 0 ? ' under' : fit > 0 ? ' over' : '';
      return `<button class="assign-row${cls}" data-act="assign:${g.id}:${r.id}">
        <b>Room ${roomNumber(r)}</b>
        <span>${TIERS[r.tier].name} · ${money(takings)} the stay</span>
        <i>${note}</i>
      </button>`;
    }).join('');

    this.elInspector.innerHTML = `<button class="insp-close">×</button>
      <div class="insp-h">${esc(g.name)}</div>
      <div class="insp-sub">${genPartyLabel(g.party)} · ${g.nights} night${g.nights > 1 ? 's' : ''} · wants a ${TIERS[g.want].name.toLowerCase()}</div>
      <div class="assign-list">${rows || '<div class="note">Nothing is made up. Clean a room first.</div>'}</div>`;
  }

  // ---------------------------------------------------------------- room card
  renderInspector(state, agg) {
    if (this.assignGuest) { this.renderAssign(state, agg); return; }
    const id = this.selectedRoom;
    if (!id) { this.elInspector.classList.remove('show'); this._inspSig = ''; return; }
    const room = roomById(state, id);
    if (!room) { this.selectedRoom = null; return; }
    const guest = room.guestId ? guestById(state, room.guestId) : null;
    const sig = `${room.id}${room.state}${room.tier}${room.built}${guest ? guest.id + Math.round(guest.mood * 20) : ''}${Math.round(state.cash)}`;
    if (sig === this._inspSig) return;
    this._inspSig = sig;
    this.elInspector.classList.add('show');

    if (!room.built) {
      const cost = roomBuildCost(builtRooms(state).length);
      this.elInspector.innerHTML = `<button class="insp-close">×</button>
        <div class="insp-h">EMPTY SHELL · FLOOR ${room.floor}</div>
        <div class="insp-sub">Plywood over the window, and a number waiting to be hung.</div>
        <button class="btn primary wide" data-act="room:${room.id}" ${state.cash >= cost ? '' : 'disabled'}>OPEN THIS ROOM · ${money(cost)}</button>`;
      return;
    }

    const tier = TIERS[room.tier];
    const stateText = {
      empty: 'Made up and ready to sell',
      reserved: 'Held for an arriving guest',
      occupied: 'Occupied',
      dirty: 'Needs turning over',
      broken: `Out of service — ${room.brokenPart || 'something broke'}`,
      shell: 'Shell',
    }[room.state];
    const upCost = room.tier < 3 ? TIER_UPGRADE_COST[room.tier + 1] : 0;
    const canUp = room.tier < 3 && state.cash >= upCost && room.state !== 'occupied' && room.state !== 'reserved';

    this.elInspector.innerHTML = `<button class="insp-close">×</button>
      <div class="insp-h">ROOM ${roomNumber(room)} · ${tier.name.toUpperCase()}</div>
      <div class="insp-sub">${tier.blurb}</div>
      <div class="insp-state s-${room.state}">${stateText}</div>
      <div class="insp-rows">
        <div><span>Rate</span><b>${money(tier.rate * state.rateMult * agg.rate)}/night</b></div>
        <div><span>Condition</span><b>${room.state === 'broken' ? 'Broken' : `${Math.max(0, Math.round((1 - room.wear * 0.2) * 100))}%`}</b></div>
        ${guest ? `<div><span>Guest</span><b>${esc(guest.name)}</b></div>
        <div><span>Mood</span><b class="${guest.mood > 0.7 ? 'good' : guest.mood < 0.4 ? 'bad' : ''}">${Math.round(guest.mood * 100)}%</b></div>
        <div><span>Checking out</span><b>day ${guest.checkoutDay}</b></div>` : ''}
      </div>
      ${room.tier < 3 ? `<button class="btn wide" data-act="upgrade:${room.id}" ${canUp ? '' : 'disabled'}>UPGRADE TO ${TIERS[room.tier + 1].name.toUpperCase()} · ${money(upCost)}</button>` : ''}`;
  }
}
