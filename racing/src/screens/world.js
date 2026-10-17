// PORT HALCYON free roam: the whole city, streaming round you as you drive.
// Params: { car, spec, look, upgrades, time, x, z, heading, quitLabel, onExit, station }
// Dev: ?screen=world&car=silvio&x=700&z=790&heading=3.14
import { registerScreen, game, go } from '../main.js';
import { WorldSession } from '../world/session.js';
import { WorldHUD } from '../world/hud.js';
import { CAR_BY_ID } from '../car/cars.js';
import { C, panel, text, vText } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { audio } from '../audio/audio.js';

registerScreen('world', () => {
  let session = null;
  let hud = null;
  let params = {};
  let pauseMenu = null;
  let loading = { f: 0, label: 'TUNING IN' };

  const makePause = () => new Menu([
    { label: 'RESUME', id: 'resume' },
    { label: 'BACK ON THE ROAD', id: 'reset' },
    {
      label: 'CAMERA', type: 'choice', options: [{ value: 0, label: 'CHASE FAR' }, { value: 1, label: 'CHASE' }, { value: 2, label: 'BUMPER' }, { value: 3, label: 'HOOD' }],
      get: () => session?.camera.mode ?? 1, set: (v) => { session?.camera.setMode(v); settings.set('camera', v); },
    },
    {
      label: 'MUSIC', type: 'slider', step: 0.1, min: 0, max: 1,
      get: () => settings.get('volMusic'), set: (v) => { settings.set('volMusic', v); audio.setVolumes({ music: v }); },
    },
    { label: params.quitLabel || 'QUIT TO MENU', id: 'quit' },
  ], { id: 'worldpause' });

  const leave = () => {
    if (params.onExit) { params.onExit(); return; }
    go('radio', { station: params.station || 'cruise' });
  };

  const scr = {
    async enter(p = {}) {
      params = p;
      const spec = p.spec || CAR_BY_ID[p.car] || CAR_BY_ID.silvio || Object.values(CAR_BY_ID)[0];
      const start = p.x !== undefined ? { x: Number(p.x), z: Number(p.z), heading: Number(p.heading ?? 0) } : null;
      session = new WorldSession({
        player: { spec, look: p.look || {}, upgrades: p.upgrades || {}, name: 'YOU' },
        time: p.time || 'night', start, budget: p.budget ? Number(p.budget) : undefined,
      });
      await session.load(game.renderer.gl, (f, l) => { loading = { f, label: l }; });
      game.renderer.setPost(session.world.at.post || {}, true);
      hud = new WorldHUD(session);
      scr.session = session;
      window.__world = session;
      window.__race = session;
    },
    exit() {
      session?.dispose();
      session = null;
      game.fx.radialBlur = 0;
      try { audio.duck(0); } catch { /* */ }
    },
    update(dt) {
      if (!session || session.state === 'loading') return;
      if (pauseMenu) {
        const it = pauseMenu.update(dt);
        if (input.pressed('pause') || input.pressed('back') || it?.id === 'resume') { pauseMenu = null; session.pause(false); uiSound('back'); return; }
        if (it?.id === 'reset') { session.sim.resetRacer(session.player); pauseMenu = null; session.pause(false); }
        if (it?.id === 'quit') leave();
        return;
      }
      if (input.pressed('pause') || input.padEvent === 'lost') {
        pauseMenu = makePause();
        session.pause(true);
        uiSound('select');
        return;
      }
      const reps = Number(game.query.get('sim') || 1);
      for (let k = 0; k < reps; k++) session.update(dt);
      Object.assign(game.fx, session.fx || {});
    },
    view() { return session && session.state !== 'loading' ? session.view() : null; },
    draw(ctx, dt) {
      if (!session || session.state === 'loading') {
        ctx.fillStyle = '#030406';
        ctx.fillRect(0, 0, 1024, 768);
        vText(ctx, 'PORT HALCYON', 512, 360, 52, { align: 'center', color: '#fff', outline: 3, outlineColor: '#000' });
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(362, 420, 300, 4);
        ctx.fillStyle = C.accent;
        ctx.fillRect(362, 420, 300 * Math.min(1, loading.f || 0), 4);
        text(ctx, loading.label || '', 512, 450, { size: 12, color: C.dim, weight: 800, spacing: 3, align: 'center' });
        return;
      }
      hud.draw(ctx, dt);
      if (pauseMenu) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, 1024, 768);
        vText(ctx, 'PAUSE', 66, 118, 40, { color: '#fff' });
        panel(ctx, 300, 200, 424, 300, { accent: C.accent, accentLen: 140 });
        pauseMenu.draw(ctx, 320, 230, 384);
      }
    },
  };
  return scr;
});
