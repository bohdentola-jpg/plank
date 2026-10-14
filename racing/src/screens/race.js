// The race screen: loads a RaceSession behind a "please stand by" card, then
// runs it and draws the HUD.  Dev: ?screen=race&track=downtown&car=lancet
import { registerScreen, game } from '../main.js';
import { RaceSession } from '../race/session.js';
import { TRACK_BY_ID, TRACKS } from '../track/tracks.js';
import { CAR_BY_ID, CARS } from '../car/cars.js';
import { C, vText, text } from '../core/ui.js';
import { settings } from '../core/settings.js';

registerScreen('race', () => {
  let session = null;
  let loading = { f: 0, label: 'PLEASE STAND BY' };
  const scr = {
    async enter(params = {}) {
      const def = params.trackDef || TRACK_BY_ID[params.track] || TRACKS[0];
      const spec = params.spec || CAR_BY_ID[params.car] || CAR_BY_ID.lancet;
      const oppIds = params.opponents ?? [];
      session = new RaceSession({
        track: def,
        type: params.type || def.type,
        laps: params.laps ? Number(params.laps) : def.laps,
        player: { spec, look: params.look || {}, upgrades: params.upgrades || {}, name: 'YOU' },
        opponents: oppIds.map((o) => (typeof o === 'string' ? { spec: CAR_BY_ID[o] } : o)),
      });
      session.renderer = game.renderer.gl;
      await session.load((f, label) => { loading = { f, label }; });
      game.renderer.setPost(session.world.at.post || {});
      scr.session = session;
    },
    exit() { session?.dispose(); session = null; },
    update(dt) { if (session && session.state !== 'loading') session.update(dt); },
    view() { return session && session.state !== 'loading' ? session.view() : null; },
    draw(ctx) {
      if (!session || session.state === 'loading') {
        vText(ctx, 'PLEASE STAND BY', 512, 380, 34, { align: 'center', color: C.text });
        text(ctx, loading.label, 512, 420, { size: 16, align: 'center', color: C.dim });
        return;
      }
      const v = session.player.vehicle;
      const mph = settings.get('units') === 'kmh' ? v.speed * 3.6 : v.speed * 2.23694;
      vText(ctx, String(Math.round(mph)), 900, 700, 48, { align: 'right', color: C.text, outline: 3 });
      text(ctx, `GEAR ${v.gear < 0 ? 'R' : v.gear}  RPM ${Math.round(v.rpm)}  ${session.state.toUpperCase()}  ${v.surface}`, 40, 740, { size: 14, color: C.dim });
      if (session.state === 'countdown') vText(ctx, String(Math.ceil(session.countdown)), 512, 300, 90, { align: 'center', color: C.accent, outline: 4 });
    },
  };
  return scr;
});
