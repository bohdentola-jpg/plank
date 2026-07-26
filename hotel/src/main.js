// Boot, title, and the loop that keeps the hotel running — including when you
// are not looking at it. The simulation is driven from a timer off the wall
// clock, so a background tab still trades; rendering only happens when visible.
import { World } from './world.js';
import { HUD } from './hud.js';
import { sfx } from './audio.js';
import { genHotelName, ARRIVAL_QUIPS, WALKOUT_QUIPS, pick } from './names.js';
import {
  newHotel, stepSim, serialize, deserialize, offlineCatchUp, claimTask, releaseJob,
  sortedTasks, roomById, money, buildRoom, addFloor, upgradeRoom, buyAmenity, hire, fire,
  train, setRate, coverage, builtRooms, aggregate, starRating, isAutomated, offlineCapHours,
  logLine, roomNumber,
} from './sim.js';
import { SPEEDS, MILESTONES, AMENITY_BY_ID, ROLE_BY_ID, starLabel } from './data.js';

const SAVE_KEY = 'novacancy_save_v1';
const params = new URLSearchParams(location.search);
const FRESH = params.has('fresh');
const DEV = params.has('dev');
const SHOWCASE = params.has('showcase');
const HQ = params.has('hq');   // pin render quality — screenshots, not gameplay

const INKS = ['#8f2d3c', '#1d3557', '#2f5d3a', '#5c3a6e', '#8a4a1e', '#2b4c52', '#7a2f5e', '#3d3b39'];
const ACCENTS = ['#e0a92b', '#e8e2d2', '#5fb0c9', '#d9603f', '#8fbf5a', '#c98fb5', '#f0d98a', '#9aa7b5'];

const $ = (s) => document.querySelector(s);
const screens = ['title', 'game'];
function showScreen(id) {
  for (const s of screens) $(`#scr-${s}`).classList.toggle('active', s === id);
}

function loadSave() {
  if (FRESH) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// A furnished hotel that runs itself: behind the title card, and behind
// ?showcase, which is how the screenshots of a grown-up hotel get taken.
function grownHotel(opts, floors, staff, extras) {
  const s = newHotel(opts);
  s.cash = 1e9;
  const buildAll = () => { for (const r of s.rooms) { if (!r.built) { r.built = true; r.state = 'empty'; } } };
  buildAll();
  for (let f = 1; f < floors; f++) { addFloor(s); buildAll(); }
  for (const id of extras) buyAmenity(s, id);
  for (const r of staff) hire(s, r);
  s.log.length = 0;
  return s;
}

function demoState() {
  const s = grownHotel(
    { name: 'The Wayside Inn', facade: 'stucco', ink: '#8f2d3c', accent: '#e0a92b' }, 3,
    ['clerk', 'housekeeper', 'bellhop', 'maintenance'],
    ['signneon', 'vending', 'coffee', 'pool', 'chandelier', 'breakfast', 'elevator', 'valet', 'wifi'],
  );
  s.rooms[7].tier = 2; s.rooms[8].tier = 2; s.rooms[13].tier = 3;
  s.cash = 14200;
  s.rep = 3.7;
  s.clock = 16.4 * 60;
  return s;
}

function showcaseState() {
  const s = grownHotel(
    { name: 'The Cardinal Arms', facade: 'brick', ink: '#1d3557', accent: '#e0a92b' }, 4,
    ['clerk', 'clerk', 'housekeeper', 'housekeeper', 'bellhop', 'maintenance', 'laundry', 'auditor'],
    ['wifi', 'vending', 'carts', 'coffee', 'signneon', 'laundryroom', 'pms', 'chandelier',
      'breakfast', 'giftshop', 'securitycam', 'elevator', 'gym', 'valet', 'pool', 'bar'],
  );
  for (const r of s.rooms) r.tier = r.floor >= 3 ? 3 : r.floor === 2 ? 2 : 1;
  s.cash = 38600;
  s.rep = 4.1;
  s.rateMult = 1.2;
  s.day = 63;
  s.clock = 15.2 * 60;
  s.youAuto = true;
  return s;
}

class App {
  constructor() {
    this.paused = false;
    this.state = null;
    this.world = null;
    this.hud = null;
    this.muted = false;
    this.tipTimer = null;
    this.pending = loadSave();
    this.setup = { name: genHotelName(), facade: 'stucco', ink: INKS[0], accent: ACCENTS[0] };
    this.bindBoot();
  }

  // ---------------------------------------------------------------- boot
  bindBoot() {
    const boot = $('#boot');
    const go = () => {
      boot.removeEventListener('click', go);
      window.removeEventListener('keydown', go);
      boot.classList.add('gone');
      sfx.ensure();
      sfx.bell();
      this.openTitle();
    };
    boot.addEventListener('click', go);
    window.addEventListener('keydown', go);
    window.addEventListener('resize', () => { this.world?.resize(); });
  }

  openTitle() {
    showScreen('title');
    this.titleState = demoState();
    this.titleWorld = new World($('#title-3d'), this.titleState, { pinQuality: HQ });
    this.titleWorld.orbit.target.set(9, 7.2, -2);
    this.titleWorld.orbit.dist = 44;
    this.titleWorld.orbit.pitch = 0.24;
    this.titleWorld.orbit.yaw = -0.36;
    this.titleWorld.resize();
    this.bindTitle();
    this.titleLoop();
    sfx.muzak(true);
  }

  bindTitle() {
    const cont = $('#t-continue');
    if (this.pending) {
      cont.classList.remove('hidden');
      $('#t-continue-sub').textContent = `${this.pending.name} · day ${this.pending.day} · ${money(this.pending.cash)}`;
      cont.onclick = () => this.start(deserialize(this.pending), this.pending);
    }
    if (SHOWCASE) { setTimeout(() => this.start(showcaseState()), 60); return; }
    $('#t-new').onclick = () => { sfx.chime(); this.openSetup(); };
    $('#t-how').onclick = () => { sfx.chime(); this.howToPlay(true); };

    const inks = $('#s-ink'), accents = $('#s-accent');
    inks.innerHTML = INKS.map((c, i) => `<button data-v="${c}" style="background:${c}" class="${i === 0 ? 'on' : ''}"></button>`).join('');
    accents.innerHTML = ACCENTS.map((c, i) => `<button data-v="${c}" style="background:${c}" class="${i === 0 ? 'on' : ''}"></button>`).join('');
    const wire = (holder, key) => {
      holder.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        for (const x of holder.querySelectorAll('button')) x.classList.toggle('on', x === b);
        this.setup[key] = b.dataset.v;
        this.applySetup();
        sfx.click();
      });
    };
    wire($('#s-facade'), 'facade');
    wire(inks, 'ink');
    wire(accents, 'accent');
    $('#s-name').addEventListener('input', (e) => { this.setup.name = e.target.value; this.applySetup(); });
    $('#s-random').onclick = () => {
      sfx.chime();
      this.setup.name = genHotelName();
      this.setup.ink = pick(INKS);
      this.setup.accent = pick(ACCENTS);
      this.setup.facade = pick(['stucco', 'brick', 'modern']);
      $('#s-name').value = this.setup.name;
      for (const [holder, key] of [[$('#s-facade'), 'facade'], [inks, 'ink'], [accents, 'accent']]) {
        for (const x of holder.querySelectorAll('button')) x.classList.toggle('on', x.dataset.v === this.setup[key]);
      }
      this.applySetup();
    };
    $('#s-back').onclick = () => { sfx.click(); $('#setup-menu').classList.add('hidden'); $('#title-menu').classList.remove('hidden'); };
    $('#s-start').onclick = () => {
      sfx.bell();
      this.start(newHotel({ ...this.setup, name: this.setup.name.trim() || 'The Wayside Inn' }));
    };
  }

  openSetup() {
    $('#title-menu').classList.add('hidden');
    $('#setup-menu').classList.remove('hidden');
    $('#s-name').value = this.setup.name;
    this.applySetup();
    this.titleWorld.orbit.dist = 40;
    this.titleWorld.orbit.target.set(4, 6.5, 2);
  }

  applySetup() {
    Object.assign(this.titleState, {
      name: this.setup.name || 'The Wayside Inn',
      facade: this.setup.facade, ink: this.setup.ink, accent: this.setup.accent,
    });
  }

  titleLoop() {
    let last = performance.now();
    const frame = () => {
      if (!this.titleWorld) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepSim(this.titleState, dt * 1.4, () => {});
      this.titleWorld.orbit.yaw += dt * 0.035;
      this.titleWorld.update(dt, this.titleState);
      this.titleRAF = requestAnimationFrame(frame);
    };
    frame();
  }

  // ---------------------------------------------------------------- start
  start(state, saved) {
    if (!state) state = newHotel(this.setup);
    if (this.titleRAF) cancelAnimationFrame(this.titleRAF);
    this.titleWorld?.dispose();
    this.titleWorld = null;
    this.titleState = null;
    sfx.muzak(false);

    if (DEV) state.cash = 99999;
    this.state = state;
    showScreen('game');

    this.world = new World($('#game-holder'), state, { pinQuality: HQ });
    this.world.frameAll();
    this.world.resize();
    this.world.onPick = (hit) => this.onPick(hit);

    this.hud = new HUD({
      claim: (id) => this.claim(id),
      setSpeed: (n) => { this.state.speed = n; this.paused = false; sfx.click(); },
      togglePause: () => { this.paused = !this.paused; sfx.click(); },
      toggleAuto: () => {
        this.state.youAuto = !this.state.youAuto;
        if (!this.state.youAuto) releaseJob(this.state, this.state.you);
        sfx.click();
      },
      setRate: (v) => setRate(this.state, v),
      panelAction: (act, id, btn) => this.panelAction(act, btn),
    });

    $('#btn-menu').onclick = () => this.pauseMenu();
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
      else this.catchUp();
    });
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('beforeunload', () => this.save());

    // Anything owed by guests who were mid-stay when you last closed the tab.
    if (saved && saved.escrow > 0) state.cash += Math.round(saved.escrow);

    const away = saved ? (Date.now() - (saved.lastSeen || Date.now())) / 1000 : 0;
    if (away > 90) {
      const report = offlineCatchUp(state, away);
      report.escrow = saved.escrow || 0;
      this.awayReport(report);
    } else if (!saved && !SHOWCASE) {
      setTimeout(() => this.howToPlay(false), 700);
    }

    this.lastReal = performance.now();
    this.simTimer = setInterval(() => this.catchUp(), 60);
    this.saveTimer = setInterval(() => this.save(), 5000);
    this.renderLoop();
    sfx.muzak(true);
  }

  // ---------------------------------------------------------------- loop
  catchUp() {
    const now = performance.now();
    let real = (now - this.lastReal) / 1000;
    this.lastReal = now;
    if (this.paused || !this.state) return;
    if (real <= 0) return;

    // A long gap means the machine slept or the tab froze: model it, do not step it.
    if (real > 90) {
      const report = offlineCatchUp(this.state, real);
      this.awayReport(report);
      return;
    }
    let left = real * this.state.speed;
    let guard = 0;
    const ev = (kind, data) => this.onEvent(kind, data);
    while (left > 0.0001 && guard++ < 5000) {
      const d = Math.min(0.1, left);
      stepSim(this.state, d, ev);
      left -= d;
    }
    this.checkTips();
  }

  renderLoop() {
    let last = performance.now();
    let hudAt = 0;
    const frame = () => {
      this.rafId = requestAnimationFrame(frame);
      if (!this.world || document.hidden) return;
      const now = performance.now();
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      this.world.update(this.paused ? 0.0001 : dt, this.state);
      if (now - hudAt > 110) { hudAt = now; this.hud.render(this.state, this.paused); }
    };
    frame();
  }

  // ---------------------------------------------------------------- events
  onEvent(kind, data) {
    const s = this.state;
    switch (kind) {
      case 'arrive':
        sfx.door();
        if (s.tasks.length < 3) this.hud.toast(`${data.guest.name}: “${pick(ARRIVAL_QUIPS)}”`, 'info', '🚶');
        break;
      case 'checkin': sfx.keycard(); break;
      case 'pay':
        sfx.cash();
        this.hud.toast(`${data.guest.name} settles up — ${money(data.total)}`, 'money', '💵');
        break;
      case 'walkout':
        sfx.nope();
        this.hud.toast(`${data.guest.name} walked out: “${pick(WALKOUT_QUIPS)}”`, 'bad', '🚪');
        break;
      case 'cleaned': sfx.spray(); break;
      case 'fixed': sfx.hammer(); break;
      case 'served': sfx.coin(); break;
      case 'request': sfx.phone(); break;
      case 'restock': break;
      case 'broke':
        sfx.nope();
        this.hud.toast(`Room ${roomNumber(data.room)}: ${data.room.brokenPart} just gave out.`, 'bad', '🔧');
        break;
      case 'ignored':
        this.hud.toast(`${data.guest.name} gave up waiting on that request.`, 'bad', '😠');
        break;
      case 'layoff':
        this.hud.toast(`${data.staff.name} quit — payroll bounced.`, 'bad', '💸');
        break;
      case 'day': this.onDayEnd(data.report); break;
      default: break;
    }
  }

  onDayEnd(report) {
    const s = this.state;
    const net = report.revenue + report.incidentals + report.tips - report.wages - report.upkeep;
    logLine(s, `Day ${report.day} closed ${net >= 0 ? 'up' : 'down'} ${money(Math.abs(net))} on ${report.nights} night${report.nights === 1 ? '' : 's'}.`, net >= 0 ? 'good' : 'bad');
    this.hud.toast(`DAY ${report.day} · ${net >= 0 ? '+' : ''}${money(net)} · ${report.nights} nights sold`, net >= 0 ? 'good' : 'bad', '📅');

    const stars = Math.floor(starRating(s));
    if (stars > (s.milestones.stars || 0)) {
      s.milestones.stars = stars;
      if (stars >= 2) { sfx.fanfare(); this.hud.toast(`${starLabel(starRating(s))} — word is getting around.`, 'good', '★'); }
    }
    const rooms = builtRooms(s).length;
    for (const m of MILESTONES) {
      if (rooms >= m.rooms && !s.milestones[m.id] && m.rooms > 0) {
        s.milestones[m.id] = true;
        sfx.fanfare();
        this.hud.toast(m.text, 'good', '🏨');
      }
    }
  }

  // ---------------------------------------------------------------- input
  claim(taskId) {
    const t = this.state.tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (t.claimedBy === this.state.you.id) { releaseJob(this.state, this.state.you); sfx.click(); return; }
    if (t.claimedBy) { sfx.nope(); return; }
    if (claimTask(this.state, this.state.you, taskId)) sfx.click();
  }

  onPick(hit) {
    if (!hit) { this.hud.selectedRoom = null; return; }
    sfx.click();
    if (hit.kind === 'room' || hit.kind === 'slot') {
      this.hud.selectedRoom = hit.id;
      this.hud._inspSig = '';
      const room = roomById(this.state, hit.id);
      // Clicking a room that needs work is the fastest way to take the job.
      const task = this.state.tasks.find((t) => t.roomId === hit.id && !t.claimedBy);
      if (task && room && room.built) this.claim(task.id);
    } else if (hit.kind === 'desk') {
      const task = sortedTasks(this.state).find((t) => (t.type === 'checkin' || t.type === 'checkout') && !t.claimedBy);
      if (task) this.claim(task.id);
    }
  }

  panelAction(act, btn) {
    const s = this.state;
    const [kind, id] = act.split(':');
    let res;
    if (kind === 'room') res = buildRoom(s);
    else if (kind === 'floor') res = addFloor(s);
    else if (kind === 'am') res = buyAmenity(s, id);
    else if (kind === 'hire') res = hire(s, id);
    else if (kind === 'fire') res = fire(s, id);
    else if (kind === 'train') res = train(s, id);
    else if (kind === 'upgrade') res = upgradeRoom(s, id);
    if (!res) return;
    if (res.ok) {
      sfx.cash();
      this.hud._panelSig = '';
      this.hud._inspSig = '';
      if (kind === 'am' && AMENITY_BY_ID[id]) this.hud.toast(`${AMENITY_BY_ID[id].name} is in.`, 'good', AMENITY_BY_ID[id].icon);
      if (kind === 'hire' && res.staff) this.hud.toast(`${res.staff.name} joins as ${ROLE_BY_ID[id].name.toLowerCase()}.`, 'good', ROLE_BY_ID[id].icon);
    } else {
      sfx.nope();
      this.hud.toast(res.why, 'bad', '✋');
    }
  }

  onKey(e) {
    if (!this.state || $('#overlay').classList.contains('show')) {
      if (e.key === 'Escape') this.hud.closeModal();
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    const tasks = sortedTasks(this.state).filter((t) => !t.claimedBy);
    if (e.key >= '1' && e.key <= '9') {
      const t = tasks[Number(e.key) - 1];
      if (t) this.claim(t.id);
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (tasks[0]) this.claim(tasks[0].id);
      e.preventDefault();
    } else if (e.key === 'p' || e.key === 'P') {
      this.paused = !this.paused;
    } else if (e.key === 'm' || e.key === 'M') {
      this.muted = !this.muted;
      sfx.setMuted(this.muted);
      this.hud.toast(this.muted ? 'Sound off' : 'Sound on', 'info', this.muted ? '🔇' : '🔊');
    } else if (e.key === 'Escape') {
      this.pauseMenu();
    } else if (e.key === '+' || e.key === '=') {
      const i = SPEEDS.indexOf(this.state.speed);
      this.state.speed = SPEEDS[Math.min(SPEEDS.length - 1, i + 1)];
    } else if (e.key === '-') {
      const i = SPEEDS.indexOf(this.state.speed);
      this.state.speed = SPEEDS[Math.max(0, i - 1)];
    } else if (e.key === 'a' || e.key === 'A') {
      this.state.youAuto = !this.state.youAuto;
    }
  }

  // ---------------------------------------------------------------- modals
  howToPlay(fromTitle) {
    const body = `
      <p>You bought a roadside motel with three rooms and no staff. Everything that happens
      in this building is currently your job.</p>
      <p><b>The board on the left</b> is every job waiting on you. Click one — or press its
      number — and you walk over and do it. Check people in before they lose patience, flip
      the dirty rooms so you have something to sell, and fix what breaks.</p>
      <p><b>Money buys rooms, rooms buy staff.</b> Hire a front desk clerk, a housekeeper, a
      maintenance tech and a bellhop and the hotel starts running itself.</p>
      <p><b>Then leave.</b> With the crew covered you can close the tab and come back to a
      day's takings. A <b>Night Auditor</b> keeps the doors open overnight and stretches that
      to twelve hours; a <b>General Manager</b> makes it a full day.</p>
      <div class="keys">
        <b>click / 1–9</b><span>take a job off the board</span>
        <b>space</b><span>take the most urgent job</span>
        <b>drag / wheel</b><span>orbit and zoom the hotel</span>
        <b>click a room</b><span>inspect it, upgrade it, clean it</span>
        <b>A</b><span>put yourself on auto</span>
        <b>P · M · Esc</b><span>pause · mute · menu</span>
      </div>`;
    if (fromTitle) {
      this.titleModal('HOW IT WORKS', body);
    } else {
      this.hud.modal('HOW IT WORKS', body, [{ label: 'GOT IT', primary: true }]);
    }
  }

  titleModal(title, html) {
    const wrap = document.createElement('div');
    wrap.id = 'title-overlay-modal';
    wrap.style.cssText = 'position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(6,5,4,0.8)';
    wrap.innerHTML = `<div class="modal-card"><h2>${title}</h2><div class="modal-body">${html}</div>
      <div class="modal-buttons"><button class="btn primary">CLOSE</button></div></div>`;
    wrap.querySelector('button').onclick = () => wrap.remove();
    $('#scr-title').appendChild(wrap);
  }

  awayReport(r) {
    const net = r.net + (r.escrow || 0) + (r.settled || 0);
    const hrs = r.hours < 1 ? `${Math.round(r.hours * 60)} minutes` : `${r.hours.toFixed(1)} hours`;
    const body = `
      <p>You were gone <b>${hrs}</b>${r.capped ? ` — the crew traded for ${r.cappedHours.toFixed(1)} of them` : ''}.</p>
      <div class="kv"><span>Nights sold</span><b>${r.nights}</b></div>
      <div class="kv"><span>Taken in</span><b>${money(r.revenue + (r.escrow || 0))}</b></div>
      <div class="kv"><span>Wages</span><b class="neg">-${money(r.wages)}</b></div>
      <div class="kv"><span>Upkeep</span><b class="neg">-${money(r.upkeep)}</b></div>
      ${r.walkouts ? `<div class="kv"><span>Turned away</span><b class="neg">${r.walkouts}</b></div>` : ''}
      <div class="kv"><span>Standing</span><b>${starLabel(r.repFrom)} → ${starLabel(r.repTo)}</b></div>
      <p style="margin-top:14px"><span class="big ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${money(net)}</span></p>
      <p>${r.note}</p>`;
    this.hud.modal('WHILE YOU WERE OUT', body, [{ label: 'BACK TO WORK', primary: true }]);
    sfx.cash();
  }

  pauseMenu() {
    const s = this.state;
    const cov = coverage(s);
    const body = `
      <div class="kv"><span>Day</span><b>${s.day}</b></div>
      <div class="kv"><span>Rooms</span><b>${builtRooms(s).length} on ${s.floors} floor${s.floors > 1 ? 's' : ''}</b></div>
      <div class="kv"><span>Standing</span><b>${starLabel(starRating(s))}</b></div>
      <div class="kv"><span>Guest nights sold</span><b>${s.totals.nights}</b></div>
      <div class="kv"><span>Crew</span><b>${s.staff.length ? `${s.staff.length} on payroll` : 'just you'}</b></div>
      <p style="margin-top:12px">${cov.full
    ? `Every job is covered — you can close this tab and the hotel keeps trading for ${offlineCapHours(s)} hours.`
    : `Uncovered: ${cov.missing.map((m) => ROLE_BY_ID[m].name).join(', ')}.`}</p>`;
    const wasPaused = this.paused;
    this.paused = true;
    this.hud.modal('THE OFFICE', body, [
      { label: 'HOW IT WORKS', onPick: () => this.howToPlay(false) },
      { label: this.muted ? 'SOUND ON' : 'SOUND OFF', onPick: () => { this.muted = !this.muted; sfx.setMuted(this.muted); this.paused = wasPaused; } },
      { label: 'SELL UP & START OVER', onPick: () => this.confirmReset() },
      { label: 'BACK TO WORK', primary: true, onPick: () => { this.paused = wasPaused; } },
    ]);
  }

  confirmReset() {
    this.paused = true;
    this.hud.modal('SELL THE PLACE?', '<p>This wipes the save and hands you the keys to a different three-room motel. There is no undo.</p>', [
      { label: 'KEEP MY HOTEL', primary: true, onPick: () => { this.paused = false; } },
      {
        label: 'SELL UP',
        onPick: () => {
          try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
          location.reload();
        },
      },
    ]);
  }

  // ---------------------------------------------------------------- tips
  checkTips() {
    const s = this.state;
    const tip = (id, text) => {
      if (s.tips[id]) return false;
      s.tips[id] = true;
      this.showTip(text);
      return true;
    };
    if (s.tasks.length && !s.tips.first) { tip('first', 'Click a job on the board — you walk over and do it yourself.'); return; }
    if (s.rooms.some((r) => r.state === 'dirty')) tip('dirty', 'A dirty room cannot be sold. Nobody will clean it but you.');
    if (s.cash >= 340 && !s.staff.length) tip('hire', 'You can afford help. Open STAFF and hire a housekeeper.');
    if (s.staff.length === 1) tip('auto', 'Press A — or hit AUTO — and you will pick up jobs on your own too.');
    if (coverage(s).full && !s.tips.idle) tip('idle', 'Every job is covered. You can close this tab now; the hotel keeps trading.');
    if (s.you.linen <= 0 && !aggregate(s).instantLinen) tip('linen', 'Out of clean linen — your next cleaning job detours to the linen room.');
  }

  showTip(text) {
    const el = $('#tip');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => el.classList.remove('show'), 7000);
  }

  // ---------------------------------------------------------------- save
  save() {
    if (!this.state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(this.state)));
    } catch { /* private mode or full quota */ }
  }
}

function boot() { if (!window.game) window.game = new App(); }
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();
