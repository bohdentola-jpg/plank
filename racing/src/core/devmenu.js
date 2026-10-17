// DEV MENU: the live driving tunables (core/tune.js) on a panel over
// whatever screen is up, and the telemetry readout. Shift + ~ or
// Ctrl + Alt + D on the keyboard, hold L1 + R1 and press OPTIONS on a pad, or
// Options › Game › DEV MENU. While it's open the screen underneath holds
// still (main.js skips its update), so the keys work the menu and not the
// car; close it and the new numbers are already in.
//   L1/R1 or Q/E: page   ↑ ↓: pick   ← →: adjust (hold to speed up)
//   ✕ / Enter: flip a switch, run an action   □ / X / Tab: back to default
//   ◯ / Esc / OPTIONS: close
import { input } from './input.js';
import { C, text, vText, panel, hints, hit, measure, roundRect, MONO_FONT } from './ui.js';
import { uiSound } from './menu.js';
import { settings } from './settings.js';
import { clamp } from './util.js';
import { TUNE, TUNE_DEFS, TUNE_GROUPS, tuneSet, tuneReset, tuneGroupReset, tuneDiff, tuneFormat, tuneIsDefault } from './tune.js';
import { audio } from '../audio/audio.js';

const X = 112, Y = 92, PW = 800, PH = 604; // the panel
const ROW = 27;
const MODIFIERS = ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'];

// every page ends with the same three actions
const ACTIONS = [
  { act: 'group', label: 'RESET GROUP', desc: 'Every value on this page back to its default.' },
  { act: 'all', label: 'RESET ALL', desc: 'Every value on every page back to its default (press twice).' },
  { act: 'copy', label: 'COPY CHANGES', desc: 'The values that differ from default, as JSON, to the clipboard (and the console).' },
];
const PAGES = TUNE_GROUPS.map((g) => [...TUNE_DEFS.filter((d) => d.group === g), ...ACTIONS]);
const isSwitch = (d) => typeof d.def === 'boolean';

export const devMenu = {
  open: false,
  tab: 0,
  sel: PAGES.map(() => 0),  // the row picked on each page
  t: 0,
  flash: null,              // { text, color, t }: what the last action did
  armAll: 0,                // RESET ALL waits this long for its second press
  streak: 0,                // auto-repeats of ← → in a row (holding speeds the steps up)
  want: false,              // a key combo asked to open / close (taken next frame)
  fps: 0,
  TUNE,                     // (QA: window.__devMenu.TUNE)

  show() {
    if (this.open) return;
    this.open = true;
    this.t = 0;
    this.flash = null;
    this.armAll = 0;
    // like the pause menus: the game's sound goes behind a curtain
    try { audio.duck(1); } catch { /* */ }
    uiSound('select');
  },

  hide(game) {
    if (!this.open) return;
    this.open = false;
    // (unless the screen underneath has its own pause up)
    try { audio.duck(game?.screen?.session?.paused ? 1 : 0); } catch { /* */ }
    uiSound('back');
  },

  /**
   * Once a frame, before the screen's update. True while the menu has the
   * controls: the screen underneath then skips its update.
   */
  update(dt, game) {
    // the pad's way in (and out): hold L1 + R1 and press OPTIONS
    if (input.pressed('pause') && input.btn[4] && input.btn[5]) this.want = true;
    if (this.want) {
      this.want = false;
      if (this.open) this.hide(game); else this.show();
      // the combo's own buttons stay out of the game: no edges this frame,
      // and a Shift still down from Shift + ~ isn't the nitrous
      input.clearEdges();
      for (const k of MODIFIERS) input.keys.delete(k);
      return true;
    }
    if (!this.open) return false;
    this.t += dt;
    if (this.flash && (this.flash.t += dt) > 2.5) this.flash = null;
    if (this.armAll > 0) this.armAll -= dt;

    // pages: L1 / R1, Q / E, or a click on a tab
    if (input.pressed('tabR')) this.page(this.tab + 1);
    if (input.pressed('tabL')) this.page(this.tab - 1);
    const click = input.takeClick() ? hit.hover || '' : '';
    if (click.startsWith('dev:tab:')) this.page(+click.slice(8));

    // rows: ↑ ↓, or the mouse over one
    const rows = PAGES[this.tab];
    let sel = this.sel[this.tab];
    if (input.pressed('up')) { sel = (sel - 1 + rows.length) % rows.length; uiSound('move'); }
    if (input.pressed('down')) { sel = (sel + 1) % rows.length; uiSound('move'); }
    if (input.device === 'mouse' && hit.hover?.startsWith('dev:row:')) {
      const k = +hit.hover.slice(8);
      if (k !== sel && k < rows.length) { sel = k; uiSound('move'); }
    }
    this.sel[this.tab] = sel;
    const row = rows[sel];

    // ← → (or the arrows by the value) adjust; held, it repeats, and the
    // longer it's held the bigger the steps
    let dir = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
    const rep = dir !== 0 && input.pressed(dir > 0 ? 'rightRepeat' : 'leftRepeat');
    if (dir) this.streak = rep ? this.streak + 1 : 0;
    if (click.startsWith('dev:inc:')) dir = 1;
    if (click.startsWith('dev:dec:')) dir = -1;
    if (dir && row.key) this.nudge(row, dir, this.streak > 30 ? 10 : this.streak > 14 ? 4 : this.streak > 5 ? 2 : 1, rep);

    // ✕ / Enter (or a click on the row) flips a switch or runs an action
    if (input.pressed('confirm') || click.startsWith('dev:row:')) {
      if (row.act) this.act(row.act);
      else if (isSwitch(row)) { tuneSet(row.key, !TUNE[row.key]); uiSound('tab'); }
    }
    // □ / X / Tab: back to its default
    if (input.pressed('extra') && row.key && !tuneIsDefault(row.key)) {
      tuneReset(row.key);
      uiSound('back');
      this.say(`${row.label}: DEFAULT ${tuneFormat(row)}`, C.cyan);
    }
    if (input.pressed('back') || input.pressed('pause')) {
      this.hide(game);
      input.clearEdges();
    }
    return true;
  },

  page(k) {
    const n = TUNE_GROUPS.length;
    const next = ((k % n) + n) % n;
    if (next === this.tab) return;
    this.tab = next;
    this.armAll = 0;
    uiSound('tab');
  },

  /** Step a value. The steps sit on a grid from the default, so stepping back
   *  lands on it exactly, and the default holds for a step on the way past. */
  nudge(d, dir, mult, rep) {
    if (isSwitch(d)) {
      if (!rep) { tuneSet(d.key, !TUNE[d.key]); uiSound('tab'); }
      return;
    }
    const v = TUNE[d.key];
    const n0 = Math.round((v - d.def) / d.step);
    let n = n0 + dir * mult;
    if (n0 * n < 0) n = 0;
    const next = clamp(n === 0 ? d.def : d.def + n * d.step, d.min, d.max);
    if (next === v) { if (!rep) uiSound('error'); return; }
    tuneSet(d.key, next);
    uiSound('tab');
  },

  act(a) {
    const group = TUNE_GROUPS[this.tab];
    if (a === 'group') {
      tuneGroupReset(group);
      uiSound('select');
      this.say(`${group}: ALL DEFAULT`);
    } else if (a === 'all') {
      if (this.armAll > 0) {
        tuneReset();
        this.armAll = 0;
        uiSound('select');
        this.say('EVERYTHING BACK TO DEFAULT');
      } else {
        this.armAll = 2.5;
        uiSound('tab');
        this.say('PRESS AGAIN TO RESET EVERY PAGE', C.red);
      }
    } else if (a === 'copy') this.copy();
  },

  /** The changed values as JSON: to the clipboard if the browser lets us, and the console. */
  copy() {
    const diff = tuneDiff();
    const n = Object.keys(diff).length;
    const json = JSON.stringify(diff, null, 2);
    console.log(`[dev menu] ${n} tunable${n === 1 ? '' : 's'} changed from default:\n${json}`);
    if (!n) { uiSound('error'); this.say('NOTHING TO COPY: ALL STOCK', C.dim); return; }
    const done = () => { uiSound('select'); this.say(`COPIED ${n} VALUE${n === 1 ? '' : 'S'} AS JSON`); };
    const failed = () => { uiSound('error'); this.say('NO CLIPBOARD: SEE THE CONSOLE', C.red); };
    try { navigator.clipboard.writeText(json).then(done, failed); } catch { failed(); }
  },

  say(str, color = C.green) { this.flash = { text: str, color, t: 0 }; },

  /** After the screen's draw: the telemetry (if it's on), then the menu (if it's open). */
  draw(ctx, dt, game) {
    if (TUNE.telemetry) this.drawTelemetry(ctx, dt, game);
    if (!this.open) return;
    const rows = PAGES[this.tab];
    const sel = this.sel[this.tab];

    // the screen underneath, dimmed (and the mouse kept off it)
    ctx.fillStyle = 'rgba(0,6,20,0.55)';
    ctx.fillRect(0, 0, 1024, 768);
    hit.add('dev:bg', 0, 0, 1024, 768);
    panel(ctx, X, Y, PW, PH, { accent: C.cyan, accentLen: 240 });
    vText(ctx, 'DEV MENU', X + 44, Y + 48, 30, { color: '#fff' });
    text(ctx, 'LIVE DRIVING TUNABLES  ·  SAVED IN THIS BROWSER', X + 46, Y + 70, { size: 12, color: C.cyan, weight: 900, spacing: 2 });
    const changed = Object.keys(tuneDiff()).length;
    text(ctx, changed ? `${changed} CHANGED` : 'ALL STOCK', X + PW - 44, Y + 48, { size: 15, color: changed ? C.accent : C.dim, weight: 900, spacing: 2, align: 'right' });
    if (this.flash) text(ctx, this.flash.text, X + PW - 44, Y + 70, { size: 12, color: this.flash.color, weight: 900, spacing: 1.5, align: 'right', alpha: clamp((2.5 - this.flash.t) * 2, 0, 1) });

    // tabs (a dot on any page with a changed value)
    let tx = X + 44;
    const ty = Y + 94;
    TUNE_GROUPS.forEach((g, k) => {
      const tw = measure(ctx, g, { size: 13, weight: 900, spacing: 1.5 }) + 30;
      const on = k === this.tab;
      hit.add(`dev:tab:${k}`, tx, ty, tw, 28);
      ctx.beginPath();
      ctx.moveTo(tx + 8, ty); ctx.lineTo(tx + tw, ty); ctx.lineTo(tx + tw - 8, ty + 28); ctx.lineTo(tx, ty + 28);
      ctx.closePath();
      ctx.fillStyle = on ? C.accent : 'rgba(255,255,255,0.07)';
      ctx.fill();
      text(ctx, g, tx + tw / 2, ty + 19, { size: 13, weight: 900, spacing: 1.5, align: 'center', color: on ? '#16110a' : C.text, shadow: !on });
      if (TUNE_DEFS.some((d) => d.group === g && !tuneIsDefault(d.key))) {
        ctx.fillStyle = on ? '#16110a' : C.accent;
        ctx.beginPath(); ctx.arc(tx + tw - 9, ty + 7, 3, 0, Math.PI * 2); ctx.fill();
      }
      tx += tw + 8;
    });

    // the rows: label, range bar (with the default's tick) or switch, value
    const y0 = Y + 162;
    const lx = X + 66, bx = X + 380, bw = 170, vx = X + PW - 70;
    rows.forEach((d, k) => {
      const y = y0 + k * ROW;
      const on = k === sel;
      hit.add(`dev:row:${k}`, X + 30, y - 19, PW - 70, ROW);
      if (d.act && !rows[k - 1]?.act) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(lx - 20, y - 21, vx - lx + 40, 1);
      }
      if (on) {
        // the menus' selection band and bobbing chevron
        const g = ctx.createLinearGradient(lx - 20, 0, vx + 30, 0);
        g.addColorStop(0, 'rgba(255,178,30,0.5)');
        g.addColorStop(0.7, 'rgba(255,178,30,0.12)');
        g.addColorStop(1, 'rgba(255,178,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(lx - 12, y - 18); ctx.lineTo(vx + 30, y - 18); ctx.lineTo(vx + 24, y + 6); ctx.lineTo(lx - 18, y + 6);
        ctx.closePath();
        ctx.fill();
        const bob = Math.sin(this.t * 6) * 3;
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.moveTo(lx - 32 + bob, y - 13); ctx.lineTo(lx - 23 + bob, y - 7); ctx.lineTo(lx - 32 + bob, y - 1);
        ctx.fill();
      }
      if (d.act) {
        text(ctx, d.label, lx, y, { size: 14, weight: 900, spacing: 2, color: on ? '#fff' : C.cyan });
        if (d.act === 'all' && this.armAll > 0) text(ctx, 'PRESS AGAIN', vx, y, { size: 13, weight: 900, spacing: 2, color: C.red, align: 'right' });
        return;
      }
      const moved = !tuneIsDefault(d.key);
      if (moved) {
        // the changed-from-default marker
        ctx.fillStyle = C.accent;
        ctx.beginPath(); ctx.moveTo(lx - 8, y - 11); ctx.lineTo(lx - 4, y - 6); ctx.lineTo(lx - 8, y - 1); ctx.lineTo(lx - 12, y - 6); ctx.closePath(); ctx.fill();
      }
      text(ctx, d.label, lx, y, { size: 15, weight: 800, spacing: 1, color: on ? '#fff' : '#c9d1de' });
      const v = TUNE[d.key];
      if (isSwitch(d)) {
        ctx.fillStyle = v ? 'rgba(77,255,139,0.55)' : 'rgba(255,255,255,0.12)';
        roundRect(ctx, bx, y - 14, 34, 14, 7);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(v ? bx + 27 : bx + 7, y - 7, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        const f = clamp((v - d.min) / (d.max - d.min), 0, 1);
        const fd = clamp((d.def - d.min) / (d.max - d.min), 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bx, y - 9, bw, 5);
        ctx.fillStyle = on ? C.accent : moved ? C.accentDim : 'rgba(200,214,236,0.4)';
        ctx.fillRect(bx, y - 9, bw * f, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(bx + bw * fd - 1, y - 12, 2, 11);
      }
      const str = tuneFormat(d);
      text(ctx, str, vx, y, { size: 15, weight: 700, font: MONO_FONT, align: 'right', color: moved ? C.accent : on ? '#fff' : C.text });
      if (on) {
        const sw = measure(ctx, str, { size: 15, weight: 700, font: MONO_FONT });
        text(ctx, '◄', vx - sw - 8, y - 1, { size: 13, color: C.accent, align: 'right' });
        text(ctx, '►', vx + 8, y - 1, { size: 13, color: C.accent });
        hit.add(`dev:dec:${k}`, vx - sw - 26, y - 19, 22, ROW);
        hit.add(`dev:inc:${k}`, vx + 4, y - 19, 22, ROW);
      }
    });

    // the picked row, explained
    const cur = rows[sel];
    const dy = Y + PH - 58;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(X + 40, dy - 28, PW - 96, 1);
    text(ctx, cur.desc, X + 46, dy, { size: 14, color: '#d8dee8', weight: 600 });
    if (cur.key) {
      const info = isSwitch(cur)
        ? `DEFAULT ${cur.def ? 'ON' : 'OFF'}`
        : `DEFAULT ${tuneFormat(cur, cur.def)}   ·   RANGE ${tuneFormat(cur, cur.min)} TO ${tuneFormat(cur, cur.max)}`;
      text(ctx, info, X + 46, dy + 22, { size: 12, color: C.dim, weight: 800, spacing: 1.5 });
    }
    hints(ctx, [['tabR', 'PAGE'], ['lr', 'ADJUST'], ['extra', 'DEFAULT'], ['confirm', 'SWITCH'], ['back', 'CLOSE']]);
  },

  /** A live readout over a race or free roam: your car, as the physics sees it. */
  drawTelemetry(ctx, dt, game) {
    const fps = 1 / Math.max(dt, 1e-3);
    this.fps = this.fps ? this.fps + (fps - this.fps) * Math.min(1, dt * 3) : fps;
    const ses = game?.screen?.session;
    // (a replay plays a tape, not the car)
    if (!ses || ses.state === 'loading' || ses.phase === 'loading' || ses.replay) return;
    const v = ses.player?.vehicle;
    if (!v || !Number.isFinite(v.speed)) return;
    const kmh = settings.get('units') === 'kmh';
    const deg = 180 / Math.PI;
    const ang = (v.driftAngle || 0) * deg;
    const [state, col] = v.airborne ? ['AIR', C.cyan]
      : v.driftState === 1 ? [v.driftHeld ? 'DRIFT' : 'DRIFT OUT', C.accent]
        : v.driftState === 2 ? ['SPIN', C.red] : ['GRIP', '#8affb0'];
    const gear = v.gear < 0 ? 'R' : v.gear === 0 ? 'N' : String(v.gear);
    const x0 = 262, y0 = 8;
    const mono = (s, x, y, color = C.text, align = 'left') => text(ctx, s, x, y, { size: 14, weight: 700, font: MONO_FONT, color, align });
    panel(ctx, x0, y0, 500, 60, { accent: C.cyan, accentLen: 110, alpha: 0.9 });
    mono(`${Math.round(v.speed * (kmh ? 3.6 : 2.23694))} ${kmh ? 'KM/H' : 'MPH'}`, x0 + 26, y0 + 25, '#fff');
    mono(`ANGLE ${ang >= 0 ? '+' : '-'}${Math.abs(ang).toFixed(1)}°`, x0 + 120, y0 + 25);
    mono(state, x0 + 262, y0 + 25, col);
    mono(`LAT ${(Math.abs(v.ayL || 0) / 9.81).toFixed(2)} G`, x0 + 476, y0 + 25, C.text, 'right');
    mono(`SLIP F ${((v.slipF || 0) * deg).toFixed(1)}° R ${((v.slipR || 0) * deg).toFixed(1)}°`, x0 + 26, y0 + 47, C.dim);
    mono(`GEAR ${gear}  ${Math.round(v.rpm || 0)} RPM`, x0 + 230, y0 + 47, C.dim);
    mono(`${Math.round(this.fps)} FPS${TUNE.timeScale !== 1 ? ` ×${TUNE.timeScale.toFixed(2)}` : ''}`, x0 + 476, y0 + 47, C.dim, 'right');
  },
};

// the keyboard's way in (and out): Shift + ~ or Ctrl + Alt + D, caught on
// the way down before input.js sees them, so they never reach the game
// (D would steer)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!((e.code === 'Backquote' && e.shiftKey) || (e.code === 'KeyD' && e.ctrlKey && e.altKey))) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) devMenu.want = true;
  }, { capture: true });
  window.__devMenu = devMenu;
}
