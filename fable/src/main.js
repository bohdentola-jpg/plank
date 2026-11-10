// Boot: wire the engine together, pick the first screen, expose QA hooks.
import { G } from './core/game.js';
import { UI } from './core/ui.js';
import { newSave, loadSave } from './core/save.js';

const params = new URLSearchParams(location.search);

async function boot() {
  G.init(document.getElementById('stage'));
  G.ui = new UI(document.getElementById('ui'));
  G.S = loadSave() || newSave();
  for (const k of ['master', 'music', 'sfx']) G.audio.vol[k] = G.S.settings[k];

  if (G.debug.test) {
    G.debug.manual = true;       // the harness drives frames
    G.debug.fast = true;         // no fades / waits
    G.debug.fastDialog = !params.has('dialog');
  }
  exposeDebug();

  if (params.has('gallery')) {
    const { Gallery } = await import('./dev/gallery.js');
    G.push(new Gallery(), {});
  } else {
    const { startGame } = await import('./game/start.js');
    await startGame(params);
  }
  const b = document.getElementById('boot');
  if (b) b.remove();
  G.start();
}

function exposeDebug() {
  const chan = new MessageChannel();
  let pending = null;
  chan.port1.onmessage = () => { const p = pending; pending = null; if (p) p(); };
  const yieldTask = () => new Promise((r) => { pending = r; chan.port2.postMessage(0); });
  window.__fable = {
    G,
    /** Advance n frames of dt seconds (lets promises settle between frames). */
    async step(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) {
        G.tick(dt);
        await yieldTask();
      }
    },
    render() { const p = G.debug.noRender; G.debug.noRender = false; G.draw(); G.debug.noRender = p; },
    press(a) { G.input.press(a); },
    hold(a, on = true) { G.input.hold(a, on); },
    axis(x, y) { G.input.setAxis(x, y); },
    errors() { return G.debug.log.slice(); },
    mode() { const m = G.top(); return m ? m.name : null; },
  };
}

boot().catch((e) => {
  console.error(e);
  const box = document.getElementById('errbox');
  if (box) { box.style.display = 'block'; box.textContent = `Could not start: ${e && e.stack ? e.stack : e}`; }
});
