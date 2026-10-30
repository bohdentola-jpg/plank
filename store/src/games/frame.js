// Shared minigame cabinet: an overlay with a fixed-resolution canvas, an intro
// card, a results card (grade stamp + token payout), input plumbing and a
// RAF loop. Games implement create(api) → { start, update, draw, pointer?, key? }.
//
//   api.W, api.H        logical canvas size (game draws in these units)
//   api.g               2d context already scaled to logical units
//   api.setHud(l, r)    text under the canvas
//   api.finish(result)  end a round → results card
//       result: { title, grade?, score?, scoreLabel?, tokens?, lines?: [string], again?: bool }
//   api.audio, api.econ, api.ctx (look, name, onTagImage, ...)
//   api.time            seconds since this round started
import { el, openOverlay, xButton } from '../ui/dom.js';

export function openArcade(spec, ctx) {
  return new Promise((resolve) => {
    let lastResult = null;
    openOverlay('game', (panel, close) => {
      const [W, H] = spec.logical || [800, 450];
      const head = el('div', { class: 'panel-head' },
        el('div', { style: { minWidth: '0' } },
          el('h2', { class: 'panel-title', style: { color: spec.color || 'var(--sun)' } }, spec.title),
          el('p', { class: 'panel-sub' }, spec.blurb || '')));
      const stage = el('div', { class: 'game-stage', style: { aspectRatio: `${W} / ${H}`, background: spec.stageBg || null } });
      const canvas = el('canvas', { 'aria-label': spec.title });
      stage.append(canvas);
      const hudL = el('span', { class: 'gh-l' });
      const hudR = el('span', { class: 'gh-r' });
      const foot = el('div', { class: 'panel-foot game-hud' }, hudL, hudR);
      const body = el('div', { class: 'panel-body game-body', style: { padding: '0' } }, stage);
      panel.append(head, body, foot, xButton(close));

      const g = canvas.getContext('2d');
      let dpr = 1, scale = 1, raf = 0, last = 0, game = null, running = false, t0 = 0;
      const api = {
        W, H, g, canvas, audio: ctx.audio, econ: ctx.econ, ctx,
        time: 0,
        setHud(l, r) {
          if (l != null) hudL.textContent = l;
          if (r != null) hudR.textContent = r;
        },
        finish(result) {
          running = false;
          lastResult = result;
          showResult(result);
        },
      };
      // The canvas keeps the game's aspect ratio and is centered in the stage.
      // On phones the stage grows to fill the screen, so intro/result cards
      // get the whole area even when the canvas itself is short.
      const size = () => {
        const r = stage.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        let cw = r.width, ch = (r.width * H) / W;
        if (ch > r.height && r.height > 0) { ch = r.height; cw = (ch * W) / H; }
        canvas.style.width = `${Math.round(cw)}px`;
        canvas.style.height = `${Math.round(ch)}px`;
        canvas.width = Math.max(1, Math.round(cw * dpr));
        canvas.height = Math.max(1, Math.round(ch * dpr));
        scale = canvas.width / W;
      };
      const ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null;
      if (ro) ro.observe(stage);
      size();

      const toLogical = (e) => {
        const r = canvas.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
      };
      // listen on the whole stage (the canvas may be letterboxed inside it);
      // coordinates are still canvas-relative and can fall outside 0..W/H
      const onPtr = (type) => (e) => {
        if (!running || !game || !game.pointer) return;
        if (e.target.closest && e.target.closest('.game-cover')) return;
        if (type === 'down') {
          stage.setPointerCapture?.(e.pointerId);
          e.preventDefault();
        }
        const [x, y] = toLogical(e);
        game.pointer(type, x, y, e);
      };
      stage.addEventListener('pointerdown', onPtr('down'));
      stage.addEventListener('pointermove', onPtr('move'));
      stage.addEventListener('pointerup', onPtr('up'));
      stage.addEventListener('pointercancel', onPtr('up'));
      const onKey = (type) => (e) => {
        if (!running || !game || !game.key) return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter'].includes(e.code)) e.preventDefault();
        game.key(type, e.code, e);
      };
      const kd = onKey('down'), ku = onKey('up');
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      const loop = (ms) => {
        raf = requestAnimationFrame(loop);
        const now = ms / 1000;
        let dt = Math.min(0.05, now - (last || now));
        last = now;
        if (!game) return;
        if (running) {
          api.time = now - t0;
          game.update(dt, api.time);
        }
        g.setTransform(scale, 0, 0, scale, 0, 0);
        game.draw(g, running ? api.time : now);
      };

      let cover = null;
      const clearCover = () => { if (cover) { cover.remove(); cover = null; } };
      const showCover = (...kids) => {
        clearCover();
        cover = el('div', { class: 'game-cover' }, ...kids);
        stage.append(cover);
        const b = cover.querySelector('button');
        if (b) b.focus({ preventScroll: true });
      };

      const begin = async () => {
        if (spec.beforePlay) {
          const ok = await spec.beforePlay(api);
          if (!ok) return;
        }
        clearCover();
        game = spec.create(api);
        running = true;
        last = 0;
        t0 = performance.now() / 1000;
        api.time = 0;
        if (game.start) game.start();
      };

      const showIntro = () => {
        game = spec.create(api);
        running = false;
        const intro = spec.intro || {};
        showCover(
          el('h3', {}, intro.title || spec.title),
          el('p', {}, intro.text || ''),
          intro.note ? el('p', { style: { fontSize: '17px', color: 'var(--muted)' } }, intro.note) : null,
          el('button', { type: 'button', class: 'btn btn-go big', onclick: begin }, intro.button || 'START'));
        if (spec.hud) spec.hud(api);
      };

      const showResult = (r) => {
        const kids = [];
        if (r.title) kids.push(el('h3', {}, r.title));
        if (r.grade) kids.push(el('div', { class: 'grade' }, r.grade));
        if (r.score != null) kids.push(el('p', {}, `${r.scoreLabel || 'SCORE'}: ${r.score}`));
        for (const ln of r.lines || []) kids.push(el('p', {}, ln));
        if (r.tokens) kids.push(el('div', { class: 'reward-line' }, `+${r.tokens} TOKENS`));
        const row = el('div', { class: 'row', style: { justifyContent: 'center' } });
        if (r.again !== false) row.append(el('button', { type: 'button', class: 'btn btn-sun', onclick: () => begin() }, r.againLabel || 'PLAY AGAIN'));
        row.append(el('button', { type: 'button', class: 'btn btn-ghost', onclick: close }, 'DONE'));
        kids.push(row);
        showCover(...kids);
        if (spec.hud) spec.hud(api);
      };

      raf = requestAnimationFrame(loop);
      if (spec.skipIntro) begin();
      else showIntro();
      return {
        onClose: () => {
          running = false;
          cancelAnimationFrame(raf);
          window.removeEventListener('keydown', kd);
          window.removeEventListener('keyup', ku);
          if (ro) ro.disconnect();
          if (game && game.destroy) game.destroy();
          ctx.audio.spray?.(false);
          ctx.audio.motor?.(false);
          resolve(lastResult);
        },
      };
    }, { label: spec.title, panelClass: 'game-panel', dismissable: false });
  });
}
