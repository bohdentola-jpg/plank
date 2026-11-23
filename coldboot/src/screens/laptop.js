// Lyosha's Night School — the laptop in the cabin. Pick a lesson, read the
// pages (examples run in place), then solve the exercises in a real Python
// editor. Also hosts field hacks (challenges) with an optional countdown.
import { input } from '../core/input.js';
import { C, W, H, text, panel, vText, roundRect, MONO_FONT, measure, hit } from '../core/ui.js';
import { LESSONS } from '../code/lessons.js';
import { CHALLENGES, NATIVES } from '../code/challenges.js';
import { checkExercise } from '../code/check.js';
import { PyVM } from '../code/python.js';
import { CodeEditor } from '../code/editor.js';
import { voice } from '../audio/voice.js';
import { saveGame } from '../game/state.js';

function wrapLines(ctx, str, maxW, size, weight = 500) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (measure(ctx, t, { size, weight }) > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

function button(ctx, id, x, y, w, label, on, color = C.accent) {
  hit.add(id, x, y, w, 34);
  const hov = hit.hover === id;
  ctx.fillStyle = hov ? 'rgba(127,230,255,0.25)' : on ? 'rgba(93,255,176,0.16)' : 'rgba(255,255,255,0.06)';
  roundRect(ctx, x, y, w, 34, 5);
  ctx.fill();
  ctx.strokeStyle = hov ? color : 'rgba(255,255,255,0.15)';
  ctx.stroke();
  text(ctx, label, x + w / 2, y + 22, { size: 13, weight: 800, color: '#fff', align: 'center', spacing: 1 });
}

/**
 * Open the laptop over the game. Resolves when closed.
 * opts.challenge: a challenge id to open straight into (field hack).
 */
export function openLaptop(G, opts = {}) {
  return new Promise((resolve) => {
    const s = G.state;
    const ed = new CodeEditor();
    const ui = {
      mode: opts.challenge ? 'ex' : 'menu', sel: 0, lesson: null, page: 0, ex: 0,
      out: [], err: null, passed: false, hints: 0, t: 0, timer: null, challenge: null, msg: '',
    };
    const unlocked = () => LESSONS.filter((l) => l.day <= s.day || s.lessons[l.id] || (LESSONS.indexOf(l) > 0 && s.lessons[LESSONS[LESSONS.indexOf(l) - 1].id]));

    const startLesson = (L) => {
      ui.lesson = L; ui.mode = 'pages'; ui.page = 0; ui.ex = 0; ui.out = []; ui.err = null;
      const id = 'lesson.' + L.id;
      if (voice.line(id)) voice.play(id, { radio: false });
    };
    const startExercise = (k) => {
      const ex = currentEx(k);
      ui.ex = k; ui.mode = 'ex'; ui.passed = false; ui.hints = 0; ui.out = []; ui.err = null; ui.msg = '';
      ed.value = ex.starter || '';
      ed.focus();
    };
    const currentEx = (k = ui.ex) => (ui.challenge ? ui.challenge : ui.lesson.exercises[k]);
    if (opts.challenge) {
      ui.challenge = CHALLENGES[opts.challenge];
      ui.timer = ui.challenge?.timeLimit || null;
      startExercise(0);
    }

    const run = () => {
      const vm = new PyVM({ maxSteps: 400000 });
      const ex = ui.mode === 'ex' ? currentEx() : null;
      if (ex?.natives) for (const n of ex.natives) if (NATIVES[n]) vm.defineNative(n, NATIVES[n].fn || NATIVES[n]);
      const r = vm.load(ed.value);
      ui.out = (r.output || []).slice(-14);
      ui.err = r.error || null;
      G.sfx?.ui?.('move');
    };
    const check = () => {
      const ex = currentEx();
      const natives = {};
      for (const n of ex.natives || []) if (NATIVES[n]) natives[n] = NATIVES[n].fn || NATIVES[n];
      const res = checkExercise(ex, ed.value, { natives });
      ui.out = (res.output || []).slice(-14);
      ui.err = res.error || null;
      ui.msg = res.message || (res.pass ? 'All tests pass.' : 'Not quite yet.');
      ui.passed = !!res.pass;
      if (res.pass) {
        G.sfx?.ui?.('select');
        if (ui.challenge) {
          s.challenges[opts.challenge] = true;
          saveGame();
        }
      }
    };

    const close = (result) => {
      ed.dispose();
      voice.stopAll();
      G.overlay = null;
      G.player.locked = false;
      resolve(result);
    };

    G.player.locked = true;
    G.overlay = {
      update(dt) {
        ui.t += dt;
        const click = input.takeClick();
        if (click && ui.mode === 'ex') ed.click(input.mouse.x, input.mouse.y);
        // keyboard shortcuts work even while typing
        const ctrl = input.keys.has('ControlLeft') || input.keys.has('ControlRight');
        if (ui.timer !== null && ui.mode === 'ex' && !ui.passed) {
          ui.timer -= dt;
          if (ui.timer <= 0) { ui.timer = 0; close({ pass: false, timeout: true }); return; }
        }
        if (ed.focused) {
          if (ctrl && input.keys.has('Enter')) { if (!ui._runLatch) { ui._runLatch = true; run(); } } else ui._runLatch = false;
          return;
        }
        const h = hit.hover || '';
        const act = (id) => click && h === id;
        if (ui.mode === 'menu') {
          const list = unlocked();
          const n = list.length + 1;
          if (input.pressed('up')) ui.sel = (ui.sel + n - 1) % n;
          if (input.pressed('down')) ui.sel = (ui.sel + 1) % n;
          if (h.startsWith('lesson:')) ui.sel = +h.slice(7);
          if (input.pressed('confirm') || (click && h.startsWith('lesson:'))) { if (ui.sel < list.length) startLesson(list[ui.sel]); else close({}); }
          if (act('exit') || input.pressed('back')) close({});
        } else if (ui.mode === 'pages') {
          const L = ui.lesson;
          if (input.pressed('right') || act('next')) { if (ui.page < L.pages.length - 1) ui.page++; else startExercise(0); }
          if (input.pressed('left') || act('prev')) ui.page = Math.max(0, ui.page - 1);
          if (act('try')) { ed.value = L.pages[ui.page].code || ''; run(); }
          if (input.pressed('back') || act('back')) ui.mode = 'menu';
        } else if (ui.mode === 'ex') {
          const ex = currentEx();
          if (act('run')) run();
          if (act('check')) check();
          if (act('hint')) ui.hints = Math.min((ex.hints || []).length, ui.hints + 1);
          if (act('reset')) { ed.value = ex.starter || ''; ui.out = []; ui.err = null; }
          if (act('answer')) { ed.value = ex.solution || ''; ui.msg = 'Lyosha typed it for you. Read it, then CHECK.'; }
          if (act('edit')) ed.focus();
          if ((act('nextex') || input.pressed('confirm')) && ui.passed) {
            if (ui.challenge) { close({ pass: true }); return; }
            const L = ui.lesson;
            if (ui.ex < L.exercises.length - 1) startExercise(ui.ex + 1);
            else {
              s.lessons[L.id] = true;
              G.hud.toast('LESSON COMPLETE', L.title, '#5dffb0');
              saveGame();
              ui.mode = 'menu';
            }
          }
          if (input.pressed('back') || act('back')) { if (ui.challenge) close({ pass: false }); else ui.mode = 'pages'; }
        }
      },
      draw(ctx, dt) {
        // the laptop: a dark screen inside a bezel
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#0b0d0f';
        roundRect(ctx, 40, 30, W - 80, H - 60, 14);
        ctx.fill();
        ctx.fillStyle = '#020806';
        roundRect(ctx, 56, 46, W - 112, H - 92, 6);
        ctx.fill();
        const title = ui.challenge ? `FIELD HACK · ${ui.challenge.title || ''}` : ui.lesson ? `NIGHT SCHOOL · ${LESSONS.indexOf(ui.lesson) + 1}. ${ui.lesson.title}` : "LYOSHA'S NIGHT SCHOOL";
        text(ctx, title.toUpperCase(), 80, 80, { size: 16, weight: 800, color: '#5dffb0', spacing: 2, font: MONO_FONT });
        if (ui.timer !== null) {
          const m = Math.floor(ui.timer / 60), sec = Math.floor(ui.timer % 60);
          vText(ctx, `${m}:${String(sec).padStart(2, '0')}`, W - 90, 84, 26, { align: 'right', color: ui.timer < 60 ? C.red : '#ffd166', weight: 0.17, glow: 10, glowColor: 'rgba(255,80,60,0.5)' });
        }
        if (ui.mode === 'menu') {
          const list = unlocked();
          text(ctx, 'Pick a lesson. One a night is plenty; two if you have tea.', 80, 116, { size: 15, color: C.dim });
          list.forEach((L, i) => {
            const y = 150 + i * 36;
            const on = i === ui.sel;
            hit.add('lesson:' + i, 80, y - 22, 700, 32);
            if (on) { ctx.fillStyle = 'rgba(93,255,176,0.12)'; ctx.fillRect(78, y - 22, 700, 32); }
            text(ctx, `${s.lessons[L.id] ? '✓' : '·'}  ${String(i + 1).padStart(2, '0')}  ${L.title}`, 92, y, { size: 17, weight: 700, color: s.lessons[L.id] ? '#5dffb0' : '#e8f0e8', font: MONO_FONT });
          });
          const y = 150 + list.length * 36;
          hit.add('lesson:' + list.length, 80, y - 22, 700, 32);
          if (ui.sel === list.length) { ctx.fillStyle = 'rgba(93,255,176,0.12)'; ctx.fillRect(78, y - 22, 700, 32); }
          text(ctx, '   ×  close the laptop', 92, y, { size: 17, weight: 700, color: C.dim, font: MONO_FONT });
          button(ctx, 'exit', W - 220, H - 110, 140, 'CLOSE');
          return;
        }
        if (ui.mode === 'pages') {
          const L = ui.lesson, P = L.pages[ui.page];
          const lines = wrapLines(ctx, P.text, 620, 17);
          lines.forEach((ln, i) => text(ctx, ln, 80, 130 + i * 26, { size: 17, weight: 500, color: '#e8f0e8' }));
          if (P.code) {
            const y0 = 140 + lines.length * 26;
            ctx.fillStyle = '#05140e';
            ctx.fillRect(80, y0, 620, P.code.split('\n').length * 21 + 18);
            P.code.split('\n').forEach((ln, i) => text(ctx, ln, 96, y0 + 24 + i * 21, { size: 15, weight: 500, color: '#c3e88d', font: MONO_FONT }));
            button(ctx, 'try', 80, y0 + P.code.split('\n').length * 21 + 30, 160, 'RUN EXAMPLE');
          }
          // console
          ctx.fillStyle = '#000';
          ctx.fillRect(740, 120, 460, 420);
          text(ctx, 'OUTPUT', 756, 144, { size: 12, weight: 800, color: C.dim, spacing: 2 });
          ui.out.forEach((o, i) => text(ctx, String(o), 756, 172 + i * 22, { size: 15, weight: 500, color: '#e8f0e8', font: MONO_FONT }));
          if (ui.err) text(ctx, `${ui.err.type}: ${ui.err.message}`, 756, 172 + ui.out.length * 22, { size: 14, weight: 600, color: C.red, font: MONO_FONT });
          text(ctx, `page ${ui.page + 1} / ${L.pages.length}`, 80, H - 88, { size: 14, color: C.dim, font: MONO_FONT });
          button(ctx, 'prev', 740, H - 112, 120, '◀ BACK');
          button(ctx, 'next', 880, H - 112, 200, ui.page < L.pages.length - 1 ? 'NEXT ▶' : 'EXERCISES ▶');
          return;
        }
        // exercise
        const ex = currentEx();
        const lines = wrapLines(ctx, ex.prompt || ex.briefing || '', 400, 15);
        lines.slice(0, 16).forEach((ln, i) => text(ctx, ln, 80, 118 + i * 22, { size: 15, weight: 500, color: '#e8f0e8' }));
        let hy = 130 + Math.min(16, lines.length) * 22;
        for (let i = 0; i < ui.hints; i++) {
          const hl = wrapLines(ctx, '💡 ' + ex.hints[i], 400, 14);
          hl.forEach((ln) => { text(ctx, ln, 80, hy, { size: 14, weight: 600, color: '#ffd166' }); hy += 20; });
          hy += 6;
        }
        if (!ui.challenge) text(ctx, `exercise ${ui.ex + 1} / ${ui.lesson.exercises.length}`, 80, H - 120, { size: 13, color: C.dim, font: MONO_FONT });
        hit.add('edit', 500, 100, 700, 330);
        ed.draw(ctx, 500, 100, 700, 330, dt, { errorLine: ui.err?.line });
        ctx.fillStyle = '#000';
        ctx.fillRect(500, 440, 700, 150);
        ui.out.slice(-5).forEach((o, i) => text(ctx, String(o), 514, 464 + i * 20, { size: 14, weight: 500, color: '#e8f0e8', font: MONO_FONT }));
        let ey = 464 + Math.min(5, ui.out.length) * 20;
        if (ui.err) {
          text(ctx, `${ui.err.type}${ui.err.line ? ' (line ' + ui.err.line + ')' : ''}: ${ui.err.message}`, 514, ey, { size: 14, weight: 600, color: C.red, font: MONO_FONT });
          if (ui.err.hint) text(ctx, 'Lyosha: ' + ui.err.hint, 514, ey + 20, { size: 13, weight: 600, color: '#ffd166' });
          ey += 40;
        }
        if (ui.msg) text(ctx, ui.msg, 514, Math.min(580, ey + 4), { size: 14, weight: 700, color: ui.passed ? C.green : '#ffb21e' });
        const by = H - 116;
        button(ctx, 'run', 500, by, 100, 'RUN');
        button(ctx, 'check', 610, by, 110, 'CHECK', ui.passed);
        button(ctx, 'hint', 730, by, 90, 'HINT');
        button(ctx, 'reset', 830, by, 90, 'RESET');
        if (ui.hints >= (ex.hints || []).length && ex.solution) button(ctx, 'answer', 930, by, 130, 'SHOW ME');
        if (ui.passed) button(ctx, 'nextex', 1070, by, 130, ui.challenge ? 'DONE ▶' : 'NEXT ▶', true, C.green);
        text(ctx, ed.focused ? 'typing · CTRL+ENTER runs · ESC stops typing' : 'click the code to type', 500, by + 54, { size: 12, color: C.dim });
      },
    };
  });
}
