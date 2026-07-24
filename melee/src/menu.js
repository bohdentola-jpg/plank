// Every screen outside the fight: boot, title, versus setup, character select,
// stage select, results, options, how-to-play, the gauntlet board and the pause
// card. Each screen is an async call that resolves with what the player chose, so
// main.js reads like the flow of the game itself.
//
// Navigation is device-agnostic: main.js pumps tick(hub) once per frame and the
// active screen consumes menu edges. Character select is the one screen that cares
// *which* player pressed what, so it reads hub.menuEvents().
import { ROSTER, isUnlocked } from './roster.js';
import { STAGES } from './stages.js';
import { emblemCanvas, nameplateCanvas } from './portraits.js';
import { CONTROL_SHEET } from './input.js';
import { GAUNTLET, gauntletLevel } from './modes.js';
import { sfx, music } from './sound.js';
import { mkCanvas } from './paint.js';

// ---------------------------------------------------------------- the wordmark
export function logoCanvas(w = 900, h = 300) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  const word = (text, y, size, fill, shadow) => {
    ctx.font = `700 ${size}px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // chunky extruded drop, one hard step at a time
    for (let d = 10; d > 0; d--) {
      ctx.fillStyle = shadow;
      ctx.fillText(text, w / 2 + d * 0.6, y + d);
    }
    ctx.strokeStyle = '#12141c';
    ctx.lineWidth = size * 0.14;
    ctx.strokeText(text, w / 2, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, w / 2, y);
  };
  ctx.save();
  ctx.translate(0, 8);
  ctx.rotate(-0.02);
  word('MASCOT', h * 0.3, h * 0.34, '#ffd23a', '#8a4a12');
  word('MELEE', h * 0.66, h * 0.4, '#f6f6f0', '#2a4a9a');
  ctx.restore();
  // the 64 badge
  ctx.save();
  ctx.translate(w * 0.84, h * 0.74);
  ctx.rotate(0.14);
  ctx.fillStyle = '#e8433f';
  ctx.fillRect(-52, -34, 104, 68);
  ctx.fillStyle = '#12141c';
  ctx.fillRect(-52, 22, 104, 12);
  ctx.font = "700 62px Impact, 'Arial Black', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f6f6f0';
  ctx.fillText('64', 0, -2);
  ctx.restore();
  return cv;
}

function el(tag, cls, parent, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  if (parent) parent.appendChild(n);
  return n;
}

const STOCK_OPTIONS = [1, 2, 3, 4, 5, 6, 9];
const TIME_OPTIONS = [0, 60, 120, 180, 300];
const RATIO_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export class Menus {
  constructor(root, state) {
    this.root = root;
    this.state = state;
    this.handler = null;
    this.cells = [];
    this.sel = 0;
    this.preview = null;
    this._resolve = null;
  }

  // ------------------------------------------------------------- plumbing
  clear() {
    this.handler?.dispose?.();
    this.handler = null;
    this.cells = [];
    this.root.innerHTML = '';
    this.root.classList.remove('show');
  }

  _screen(cls, build) {
    return new Promise((resolve) => {
      this.clear();
      this.root.classList.add('show');
      const wrap = el('div', `mscreen ${cls}`, this.root);
      this._resolve = (v) => {
        const done = this._resolve;
        if (!done) return;
        this._resolve = null;
        resolve(v);
      };
      this.handler = build(wrap, this._resolve) || {};
      this.cells = [...wrap.querySelectorAll('[data-cell]')].filter((c) => !c.classList.contains('locked-out'));
      this.sel = this.cells.findIndex((c) => c.dataset.default === '1');
      if (this.sel < 0) this.sel = 0;
      this._paint();
    });
  }

  _paint() {
    this.cells.forEach((c, i) => c.classList.toggle('sel', i === this.sel));
    this.cells[this.sel]?.scrollIntoView?.({ block: 'nearest' });
  }

  /** Spatial focus move, like the football game's pad UI. */
  _move(dir) {
    if (!this.cells.length) return;
    const cur = this.cells[this.sel];
    if (!cur) { this.sel = 0; this._paint(); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = -1, bs = Infinity;
    this.cells.forEach((c, i) => {
      if (i === this.sel) return;
      const r = c.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      let primary, cross;
      if (dir === 'up') { primary = -dy; cross = Math.abs(dx); }
      else if (dir === 'down') { primary = dy; cross = Math.abs(dx); }
      else if (dir === 'left') { primary = -dx; cross = Math.abs(dy); }
      else { primary = dx; cross = Math.abs(dy); }
      if (primary < 4) return;
      const score = primary + cross * 2.6;
      if (score < bs) { bs = score; best = i; }
    });
    if (best >= 0) {
      this.sel = best;
      sfx.ui('move');
      this._paint();
    }
  }

  /** Pump one frame of input into the active screen. */
  tick(hub) {
    const h = this.handler;
    if (!h) return;
    const m = hub.menu();
    if (h.onEvents) h.onEvents(hub.menuEvents(), m, hub);
    if (h.raw) { h.raw(m, hub); return; }
    const cell = this.cells[this.sel];
    if (m.left || m.right) {
      const dir = m.left ? 'left' : 'right';
      if (h.onAdjust && cell?.dataset.opt) {
        h.onAdjust(cell, dir === 'right' ? 1 : -1);
        sfx.ui('move');
      } else this._move(dir);
    }
    if (m.up) this._move('up');
    if (m.down) this._move('down');
    if (m.confirm && cell) {
      sfx.ui('confirm');
      h.onConfirm?.(cell);
    }
    if (m.back) {
      sfx.ui('back');
      h.onBack?.();
    }
    if (m.start) h.onStart?.();
  }

  // ------------------------------------------------------------------ boot
  boot() {
    return this._screen('mboot', (wrap, done) => {
      const logo = logoCanvas();
      const img = el('img', 'boot-logo', wrap);
      img.src = logo.toDataURL();
      el('div', 'boot-pub', wrap, 'EB INTERACTIVE · 1999');
      el('div', 'boot-press', wrap, 'PRESS START');
      el('div', 'boot-note', wrap, 'PLUG IN UP TO TWO CONTROLLERS · OR SHARE A KEYBOARD');
      return {
        raw: (m) => { if (m.any) { sfx.ensure(); sfx.resume(); sfx.ui('ready'); done('start'); } },
      };
    });
  }

  // ----------------------------------------------------------------- title
  title(previewHolderCb) {
    return this._screen('mtitle', (wrap, done) => {
      const logo = el('img', 'title-logo', wrap);
      logo.src = logoCanvas().toDataURL();
      const stage3d = el('div', 'title-3d', wrap);
      previewHolderCb?.(stage3d);
      const menu = el('div', 'title-menu', wrap);
      const items = [
        ['smash', 'SMASH', '1-4 fighters, your rules'],
        ['gauntlet', 'GAUNTLET', 'Six rounds. One stock of pride.'],
        ['training', 'TRAINING', 'A dummy and all the time in the world'],
        ['howto', 'HOW TO PLAY', 'Controls and the finer points'],
        ['options', 'OPTIONS', 'Picture, sound, records'],
        ['library', 'EXIT TO EB GAMES', 'Back to the shelf'],
      ];
      for (const [id, label, sub] of items) {
        const b = el('button', 'mbtn', menu);
        b.dataset.cell = '1';
        b.dataset.action = id;
        if (id === 'smash') b.dataset.default = '1';
        el('span', 'mbtn-label', b, label);
        el('span', 'mbtn-sub', b, sub);
        b.onclick = () => { sfx.ui('confirm'); done(id); };
      }
      const rec = this.state.records;
      el('div', 'title-foot', wrap,
        `BUILD 1 · ${rec.matches} MATCHES · ${rec.kos} KOs · ${Object.keys(this.state.unlocks).length ? 'UNLOCKS FOUND' : 'NO UNLOCKS YET'}`);
      return { onConfirm: (cell) => done(cell.dataset.action) };
    });
  }

  // ------------------------------------------------------------- vs setup
  vsSetup(setup, hub) {
    return this._screen('msetup', (wrap, done) => {
      el('div', 'mtitle-bar', wrap, '<span>SMASH</span> WHO IS PLAYING?');
      const slots = el('div', 'setup-slots', wrap);
      const rules = el('div', 'setup-rules', wrap);
      const foot = el('div', 'mfoot', wrap);

      const render = () => {
        slots.innerHTML = '';
        setup.slots.forEach((s, i) => {
          const card = el('div', `slot-card ${s.type === 'off' ? 'off' : ''}`, slots);
          card.dataset.cell = '1';
          card.dataset.opt = `slot${i}`;
          card.style.setProperty('--pc', ['#e8433f', '#3f7ce8', '#f2c14a', '#3fbf6a'][i]);
          el('div', 'slot-tag', card, `PLAYER ${i + 1}`);
          const t = el('div', 'slot-type', card);
          t.textContent = s.type === 'human' ? 'HUMAN' : s.type === 'cpu' ? `CPU  LV ${s.level}` : 'OFF';
          el('div', 'slot-dev', card, s.type === 'human' ? hub.deviceLabel(hub.assign[i]) : s.type === 'cpu' ? 'COMPUTER' : '—');
          el('div', 'slot-hint', card, '◀ ▶ CHANGE');
        });
        // rules
        rules.innerHTML = '';
        const row = (key, label, value, hint) => {
          const r = el('div', 'rule-row', rules);
          r.dataset.cell = '1';
          r.dataset.opt = key;
          el('div', 'rule-label', r, label);
          el('div', 'rule-value', r, value);
          el('div', 'rule-hint', r, hint);
        };
        row('mode', 'MODE', setup.rules.mode === 'stock' ? 'STOCK' : 'TIME', 'stock = last one standing');
        row('stocks', 'STOCKS', String(setup.rules.stocks), 'lives each');
        row('time', 'TIME', setup.rules.timeLimit ? `${setup.rules.timeLimit / 60}:00` : 'OFF', 'match clock');
        row('items', 'ITEMS', setup.rules.items ? 'ON' : 'OFF', 'turkey, star, cap, orb, crates');
        row('ratio', 'DAMAGE', `${setup.rules.damageRatio}×`, 'how hard everything hits');
        const go = el('button', 'mbtn go', rules);
        go.dataset.cell = '1';
        go.dataset.action = 'go';
        go.dataset.default = '1';
        el('span', 'mbtn-label', go, 'CHOOSE FIGHTERS');
        el('span', 'mbtn-sub', go, 'then pick a stage');
        go.onclick = () => done(setup);
        this.cells = [...wrap.querySelectorAll('[data-cell]')];
        this._paint();
      };

      foot.innerHTML = '◀ ▶ ADJUST · ✕ / J CONFIRM · ◯ / K BACK';
      render();

      return {
        onAdjust: (cell, dir) => {
          const opt = cell.dataset.opt;
          if (opt?.startsWith('slot')) {
            const i = +opt.slice(4);
            const s = setup.slots[i];
            const order = ['human', 'cpu', 'off'];
            if (s.type === 'cpu' && ((dir > 0 && s.level < 9) || (dir < 0 && s.level > 1))) {
              s.level += dir;
            } else {
              const idx = order.indexOf(s.type);
              const next = order[(idx + (dir > 0 ? 1 : -1) + 3) % 3];
              s.type = next;
              if (next === 'cpu') s.level = dir > 0 ? 1 : 9;
            }
            if (i === 0) setup.slots[0].type = setup.slots[0].type === 'off' ? 'human' : setup.slots[0].type;
          } else if (opt === 'mode') {
            setup.rules.mode = setup.rules.mode === 'stock' ? 'time' : 'stock';
            if (setup.rules.mode === 'time' && !setup.rules.timeLimit) setup.rules.timeLimit = 120;
          } else if (opt === 'stocks') {
            const i = STOCK_OPTIONS.indexOf(setup.rules.stocks);
            setup.rules.stocks = STOCK_OPTIONS[Math.max(0, Math.min(STOCK_OPTIONS.length - 1, i + dir))];
          } else if (opt === 'time') {
            const i = TIME_OPTIONS.indexOf(setup.rules.timeLimit);
            setup.rules.timeLimit = TIME_OPTIONS[Math.max(0, Math.min(TIME_OPTIONS.length - 1, i + dir))];
          } else if (opt === 'items') {
            setup.rules.items = !setup.rules.items;
          } else if (opt === 'ratio') {
            const i = RATIO_OPTIONS.indexOf(setup.rules.damageRatio);
            setup.rules.damageRatio = RATIO_OPTIONS[Math.max(0, Math.min(RATIO_OPTIONS.length - 1, i + dir))];
          }
          const keep = this.sel;
          render();
          this.sel = Math.min(this.cells.length - 1, keep);
          this._paint();
        },
        onConfirm: (cell) => { if (cell.dataset.action === 'go') done(setup); },
        onBack: () => done(null),
      };
    });
  }

  // -------------------------------------------------------- character select
  /**
   * Every device works through a queue of slots: its own fighter first, then any
   * CPU slots it owns (P1 picks for the computer). Resolves with picks per slot.
   */
  charSelect(setup, hub, onHoverPreview) {
    return this._screen('mchars', (wrap, done) => {
      el('div', 'mtitle-bar', wrap, '<span>CHOOSE</span> YOUR MASCOT');
      const body = el('div', 'cs-body', wrap);
      const grid = el('div', 'cs-grid', body);
      const side = el('div', 'cs-side', body);
      const prevHolder = el('div', 'cs-preview', side);
      const plate = el('img', 'cs-plate', side);
      const bio = el('div', 'cs-bio', side);
      const stats = el('div', 'cs-stats', side);
      const slotRow = el('div', 'cs-slots', wrap);
      const foot = el('div', 'mfoot', wrap,
        '✕ / J LOCK IN · ◯ / K BACK · START SWAPS COLOUR · ALL LOCKED = STAGE SELECT');
      onHoverPreview?.(prevHolder);

      const unlocks = this.state.unlocks;
      const cells = [];
      ROSTER.forEach((def, i) => {
        const locked = !isUnlocked(def, unlocks);
        const c = el('div', `cs-cell${locked ? ' locked' : ''}`, grid);
        c.dataset.index = String(i);
        const cv = emblemCanvas(def, 128);
        cv.className = 'cs-emblem';
        c.appendChild(cv);
        el('div', 'cs-name', c, locked ? '?????' : def.name);
        if (locked) el('div', 'cs-lock', c, def.unlock.how);
        cells.push({ el: c, def, locked });
      });

      // build the picking queues
      const queues = [];
      setup.slots.forEach((s, i) => {
        if (s.type === 'human') queues.push({ device: i, slot: i });
      });
      setup.slots.forEach((s, i) => {
        if (s.type === 'cpu') queues.push({ device: 0, slot: i });
      });
      const byDevice = new Map();
      for (const q of queues) {
        if (!byDevice.has(q.device)) byDevice.set(q.device, []);
        byDevice.get(q.device).push(q.slot);
      }

      const cursors = [];
      for (const [device, slotList] of byDevice) {
        const startIdx = Math.min(ROSTER.length - 1, device * 3);
        cursors.push({
          device, slotList, qi: 0, idx: startIdx, locked: false,
          token: el('div', `cs-token p${device + 1}`, grid),
          picks: {},
        });
      }
      const picks = {};

      const statBar = (label, v) => `<div class="sb"><span>${label}</span><i><b style="width:${v * 20}%"></b></i></div>`;

      const showDef = (def) => {
        plate.src = nameplateCanvas(def).toDataURL();
        bio.textContent = def.bio;
        stats.innerHTML = statBar('POWER', def.tier.power) + statBar('SPEED', def.tier.speed)
          + statBar('RANGE', def.tier.range) + statBar('RECOVERY', def.tier.recovery) + statBar('WEIGHT', def.tier.weight);
        onHoverPreview?.(prevHolder, def);
      };

      const paintCursors = () => {
        for (const c of cells) c.el.classList.remove('hover');
        for (const cur of cursors) {
          const cell = cells[cur.idx];
          const r = cell.el.getBoundingClientRect();
          const g = grid.getBoundingClientRect();
          cur.token.style.left = `${r.left - g.left + r.width - 26}px`;
          cur.token.style.top = `${r.top - g.top + 4}px`;
          const slot = cur.slotList[cur.qi];
          cur.token.textContent = slot == null ? '✓' : (setup.slots[slot].type === 'cpu' ? `C${slot + 1}` : `P${slot + 1}`);
          cur.token.classList.toggle('done', slot == null);
          cell.el.classList.add('hover');
        }
        slotRow.innerHTML = '';
        setup.slots.forEach((s, i) => {
          if (s.type === 'off') return;
          const chip = el('div', 'cs-chip', slotRow);
          chip.style.setProperty('--pc', ['#e8433f', '#3f7ce8', '#f2c14a', '#3fbf6a'][i]);
          const def = picks[i]?.def;
          el('span', 'chip-tag', chip, s.type === 'cpu' ? `CPU${s.level}` : `P${i + 1}`);
          el('span', 'chip-name', chip, def ? def.name : '—');
          if (picks[i]) chip.classList.add('ready');
          if (picks[i]?.alt) el('span', 'chip-alt', chip, `ALT ${picks[i].alt}`);
        });
      };

      const allDone = () => queues.every((q) => picks[q.slot]);

      const finish = () => {
        if (!allDone()) return;
        sfx.ui('ready');
        done(picks);
      };

      showDef(ROSTER[0]);
      requestAnimationFrame(paintCursors);

      return {
        onEvents: (events, m) => {
          for (const ev of events) {
            const cur = cursors.find((c) => c.device === ev.player) || cursors[0];
            if (!cur) continue;
            const slot = cur.slotList[cur.qi];
            if (slot == null) continue;
            if (['up', 'down', 'left', 'right'].includes(ev.dir)) {
              const cols = 6;
              let idx = cur.idx;
              if (ev.dir === 'left') idx -= 1;
              if (ev.dir === 'right') idx += 1;
              if (ev.dir === 'up') idx -= cols;
              if (ev.dir === 'down') idx += cols;
              if (idx < 0) idx += ROSTER.length;
              if (idx >= ROSTER.length) idx -= ROSTER.length;
              cur.idx = idx;
              sfx.ui('move');
              showDef(ROSTER[cur.idx]);
              paintCursors();
            } else if (ev.dir === 'confirm') {
              const cell = cells[cur.idx];
              if (cell.locked) { sfx.ui('deny'); continue; }
              picks[slot] = { def: cell.def, alt: picks[slot]?.alt || 0 };
              sfx.ui('lock');
              cur.qi++;
              // park the cursor on somebody else for the next slot: mashing
              // confirm shouldn't quietly hand you a mirror match
              if (cur.qi < cur.slotList.length) {
                for (let step = 1; step <= ROSTER.length; step++) {
                  const next = (cur.idx + step * 5) % ROSTER.length;
                  if (!cells[next].locked) { cur.idx = next; break; }
                }
                showDef(ROSTER[cur.idx]);
              }
              paintCursors();
              if (allDone()) finish();
            } else if (ev.dir === 'back') {
              if (cur.qi > 0) {
                cur.qi--;
                delete picks[cur.slotList[cur.qi]];
                sfx.ui('back');
                paintCursors();
              } else {
                done(null);
                return;
              }
            } else if (ev.dir === 'start') {
              // colour swap for the slot they are hovering / just locked
              const target = cur.slotList[Math.max(0, cur.qi - (cur.qi >= cur.slotList.length ? 1 : 0))];
              const p = picks[target];
              if (p) {
                p.alt = (p.alt + 1) % 5;
                sfx.ui('page');
                paintCursors();
              }
            }
          }
          if (m.start && allDone()) finish();
        },
        dispose: () => onHoverPreview?.(null),
      };
    });
  }

  // ---------------------------------------------------------- stage select
  stageSelect() {
    return this._screen('mstages', (wrap, done) => {
      el('div', 'mtitle-bar', wrap, '<span>SELECT</span> THE ARENA');
      const grid = el('div', 'st-grid', wrap);
      const blurb = el('div', 'st-blurb', wrap);
      const add = (stage, label, id) => {
        const c = el('div', 'st-cell', grid);
        c.dataset.cell = '1';
        c.dataset.stage = id;
        const cv = mkCanvas(288, 162);
        if (stage) stage.thumb(cv.getContext('2d'), 288, 162);
        else {
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#1a1c2c';
          ctx.fillRect(0, 0, 288, 162);
          ctx.font = "700 84px Impact, 'Arial Black', sans-serif";
          ctx.fillStyle = '#f2c14a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', 144, 84);
        }
        cv.className = 'st-thumb';
        c.appendChild(cv);
        el('div', 'st-name', c, label);
        c.onmouseenter = () => { blurb.textContent = stage ? stage.blurb : 'Let the machine decide.'; };
        c.onclick = () => done(id);
      };
      for (const s of STAGES) add(s, s.name, s.id);
      add(null, 'RANDOM', 'random');
      grid.firstChild.dataset.default = '1';
      blurb.textContent = STAGES[0].blurb;
      el('div', 'mfoot', wrap, '✕ / J FIGHT · ◯ / K BACK');
      return {
        onConfirm: (cell) => done(cell.dataset.stage),
        onBack: () => done(null),
        onEvents: () => {
          const cell = this.cells[this.sel];
          const s = STAGES.find((x) => x.id === cell?.dataset.stage);
          blurb.textContent = s ? s.blurb : 'Let the machine decide.';
        },
      };
    });
  }

  // ---------------------------------------------------------------- results
  results(match, { rematchLabel = 'REMATCH' } = {}) {
    return this._screen('mresults', (wrap, done) => {
      const r = match.result;
      el('div', 'mtitle-bar', wrap, `<span>${match.suddenDeath ? 'SUDDEN DEATH' : 'GAME SET'}</span> RESULTS`);
      const board = el('div', 'res-board', wrap);
      r.order.forEach((row, i) => {
        const line = el('div', `res-row${i === 0 ? ' winner' : ''}`, board);
        line.style.setProperty('--pc', row.color);
        el('div', 'res-place', line, ['1ST', '2ND', '3RD', '4TH'][i] || `${i + 1}TH`);
        const cv = emblemCanvas(row.def, 96);
        cv.className = 'res-emblem';
        line.appendChild(cv);
        const col = el('div', 'res-col', line);
        el('div', 'res-name', col, `${row.def.name}  <small>${row.isCpu ? 'CPU' : `P${row.index + 1}`}</small>`);
        el('div', 'res-stats', col,
          `KOs <b>${row.kos}</b> · FALLS <b>${row.falls}</b> · SELF <b>${row.sd}</b> · DAMAGE DEALT <b>${row.damage}%</b>`);
        if (i === 0) el('div', 'res-crown', line, '★');
      });
      const btns = el('div', 'res-btns', wrap);
      for (const [id, label] of [['rematch', rematchLabel], ['chars', 'CHANGE FIGHTERS'], ['title', 'QUIT TO TITLE']]) {
        const b = el('button', 'mbtn', btns);
        b.dataset.cell = '1';
        b.dataset.action = id;
        if (id === 'rematch') b.dataset.default = '1';
        el('span', 'mbtn-label', b, label);
        b.onclick = () => done(id);
      }
      return { onConfirm: (cell) => done(cell.dataset.action), onBack: () => done('title') };
    });
  }

  // ------------------------------------------------------------ how to play
  howto() {
    return this._screen('mhowto', (wrap, done) => {
      el('div', 'mtitle-bar', wrap, '<span>HOW</span> TO PLAY');
      const cols = el('div', 'howto-cols', wrap);
      const sheet = (title, rows) => {
        const c = el('div', 'howto-col', cols);
        el('div', 'howto-head', c, title);
        for (const [k, v] of rows) {
          const row = el('div', 'howto-row', c);
          el('b', null, row, k);
          el('span', null, row, v);
        }
      };
      sheet('CONTROLLER', CONTROL_SHEET.pad);
      sheet('KEYBOARD · PLAYER 1', CONTROL_SHEET.kb1);
      sheet('KEYBOARD · PLAYER 2', CONTROL_SHEET.kb2);
      const notes = el('div', 'howto-notes', wrap);
      el('div', 'howto-head', notes, 'THE RULES OF A MELEE');
      el('p', null, notes, 'There is no health bar. The number under your mascot is <b>damage</b> — the higher it climbs, the further you fly. Knock everyone off the screen to win.');
      el('p', null, notes, 'Every fighter has four <b>specials</b> (neutral, side, up, down). <b>Up special</b> is your recovery — save it for the trip home. Grab a <b>ledge</b> by drifting into it as you fall.');
      el('p', null, notes, '<b>Shield</b> blocks anything from the front but shrinks while you hold it; roll and dodge out of it. A <b>flicked</b> stick plus attack is a <b>smash attack</b> — hold it to charge.');
      el('p', null, notes, 'Pick up a <b>MELEE ORB</b> and your neutral special becomes a screen-clearing <b>finisher</b>.');
      const b = el('button', 'mbtn', wrap);
      b.dataset.cell = '1';
      b.dataset.default = '1';
      el('span', 'mbtn-label', b, 'BACK');
      b.onclick = () => done('back');
      return { onConfirm: () => done('back'), onBack: () => done('back') };
    });
  }

  // ---------------------------------------------------------------- options
  options(view) {
    return this._screen('moptions', (wrap, done) => {
      el('div', 'mtitle-bar', wrap, '<span>OPTIONS</span> PICTURE & SOUND');
      const list = el('div', 'opt-list', wrap);
      const o = this.state.options;
      const render = () => {
        list.innerHTML = '';
        const row = (key, label, value, hint) => {
          const r = el('div', 'rule-row', list);
          r.dataset.cell = '1';
          r.dataset.opt = key;
          el('div', 'rule-label', r, label);
          el('div', 'rule-value', r, value);
          el('div', 'rule-hint', r, hint);
        };
        row('res', 'RESOLUTION', { n64: '64-BIT CHUNKY', crisp: 'MIDDLE', sharp: 'MODERN' }[o.res], 'how blocky the pixels are');
        row('crt', 'CRT FILTER', o.crt ? 'ON' : 'OFF', 'scanlines and a soft vignette');
        row('music', 'MUSIC', `${Math.round(o.music * 100)}%`, 'the chiptune band');
        row('sound', 'SOUND', `${Math.round(o.sound * 100)}%`, 'hits, whistles, menu chirps');
        row('announcer', 'ANNOUNCER', o.announcer ? 'ON' : 'OFF', 'the voice that shouts K.O.');
        row('tapjump', 'TAP JUMP', o.tapJump ? 'ON' : 'OFF', 'jump by flicking the stick up');
        const reset = el('button', 'mbtn danger', list);
        reset.dataset.cell = '1';
        reset.dataset.action = 'reset';
        el('span', 'mbtn-label', reset, 'ERASE RECORDS AND UNLOCKS');
        const back = el('button', 'mbtn', list);
        back.dataset.cell = '1';
        back.dataset.action = 'back';
        back.dataset.default = '1';
        el('span', 'mbtn-label', back, 'BACK');
        this.cells = [...wrap.querySelectorAll('[data-cell]')];
        this._paint();
      };
      render();
      const apply = () => {
        sfx.setVolume(o.sound);
        sfx.voiceOff = !o.announcer;
        music.setMuted(o.music <= 0);
        music.setVolume(o.music);
        view?.setRes?.(o.res);
        view?.setCrt?.(o.crt);
      };
      return {
        onAdjust: (cell, dir) => {
          const k = cell.dataset.opt;
          if (k === 'res') {
            const order = ['n64', 'crisp', 'sharp'];
            o.res = order[(order.indexOf(o.res) + dir + 3) % 3];
          } else if (k === 'crt') o.crt = !o.crt;
          else if (k === 'music') o.music = Math.max(0, Math.min(1, +(o.music + dir * 0.1).toFixed(2)));
          else if (k === 'sound') o.sound = Math.max(0, Math.min(1, +(o.sound + dir * 0.1).toFixed(2)));
          else if (k === 'announcer') o.announcer = !o.announcer;
          else if (k === 'tapjump') o.tapJump = !o.tapJump;
          const keep = this.sel;
          render();
          this.sel = Math.min(this.cells.length - 1, keep);
          this._paint();
          apply();
        },
        onConfirm: (cell) => {
          if (cell.dataset.action === 'back') done('back');
          else if (cell.dataset.action === 'reset') {
            this.state.unlocks = {};
            this.state.records = { matches: 0, kos: 0, falls: 0, wins: {}, gauntlet: null };
            sfx.ui('deny');
            done('reset');
          }
        },
        onBack: () => done('back'),
      };
    });
  }

  // -------------------------------------------------------- gauntlet board
  gauntletBoard(progress) {
    return this._screen('mgauntlet', (wrap, done) => {
      el('div', 'mtitle-bar', wrap, '<span>GAUNTLET</span> SIX ROUNDS');
      const ladder = el('div', 'gt-ladder', wrap);
      GAUNTLET.forEach((r, i) => {
        const row = el('div', `gt-row${i === progress.round ? ' now' : ''}${i < progress.round ? ' done' : ''}`, ladder);
        el('div', 'gt-label', row, r.label);
        el('div', 'gt-stage', row, r.stage.toUpperCase().replace('HOMEFIELD', 'HOMETOWN FIELD'));
        el('div', 'gt-foes', row, r.foes.map((f) => f.id.toUpperCase()).join(' + '));
        el('div', 'gt-lv', row, `LV ${gauntletLevel(progress.difficulty, r.round)}`);
        el('div', 'gt-blurb', row, r.blurb);
      });
      const btns = el('div', 'gt-btns', wrap);
      const diff = el('div', 'rule-row', btns);
      diff.dataset.cell = '1';
      diff.dataset.opt = 'difficulty';
      el('div', 'rule-label', diff, 'DIFFICULTY');
      const diffVal = el('div', 'rule-value', diff, progress.difficulty.toUpperCase());
      el('div', 'rule-hint', diff, 'sets how mean the computer plays');
      const go = el('button', 'mbtn go', btns);
      go.dataset.cell = '1';
      go.dataset.action = 'go';
      go.dataset.default = '1';
      el('span', 'mbtn-label', go, progress.round > 0 ? `CONTINUE — ${GAUNTLET[progress.round].label}` : 'START THE GAUNTLET');
      const quit = el('button', 'mbtn', btns);
      quit.dataset.cell = '1';
      quit.dataset.action = 'back';
      el('span', 'mbtn-label', quit, 'BACK TO TITLE');
      return {
        onAdjust: (cell, dir) => {
          if (cell.dataset.opt !== 'difficulty') return;
          const order = ['easy', 'normal', 'hard'];
          progress.difficulty = order[(order.indexOf(progress.difficulty) + dir + 3) % 3];
          diffVal.textContent = progress.difficulty.toUpperCase();
          ladder.querySelectorAll('.gt-lv').forEach((n, i) => {
            n.textContent = `LV ${gauntletLevel(progress.difficulty, GAUNTLET[i].round)}`;
          });
        },
        onConfirm: (cell) => { if (cell.dataset.action) done(cell.dataset.action); },
        onBack: () => done('back'),
      };
    });
  }

  /** A between-rounds card for the gauntlet. */
  interstitial(title, sub, buttonLabel = 'CONTINUE') {
    return this._screen('minter', (wrap, done) => {
      el('div', 'inter-title', wrap, title);
      el('div', 'inter-sub', wrap, sub);
      const b = el('button', 'mbtn go', wrap);
      b.dataset.cell = '1';
      b.dataset.default = '1';
      el('span', 'mbtn-label', b, buttonLabel);
      b.onclick = () => done('ok');
      return { onConfirm: () => done('ok'), onBack: () => done('ok') };
    });
  }
}
