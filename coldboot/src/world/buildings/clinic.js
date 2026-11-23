// Port Zarya Clinic: a pale-yellow single-storey clinic with an entry canopy,
// a wheelchair ramp, an ambulance bay and a backup generator.
import { makeCtx, finish, sign, sideFrame, weather, LIGHT, PI, HALF_PI } from './common.js';
import { civic, monumentSign } from './civic.js';
import { addProp } from '../props.js';

export function build(opts = {}) {
  const ctx = makeCtx('clinic', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 16, D = 11, fy = 0.55;
  ctx.footprint = { w: W + 8, d: D + 7 };
  const trim = weather('#f2f0ea', wear * 0.4);
  civic(ctx, {
    W, D, fy, storeys: 1, sH: 3.2, key: 'siding_lap', color: weather('#ded28e', wear * 0.6), trim,
    roof: { type: 'gable', axis: 'x', pitch: 0.36, key: 'metal_corr_paint', color: weather('#3f5a46', wear * 0.5), icicles: 0.3, gutters: true },
    win: { w: 1.2, h: 1.25, per: 2.8, style: 'slider', cell: 7, lit: (s, k, i) => (st > 0.15 && (i + s) % 3 !== 0 ? LIGHT.office : LIGHT.off) },
    doors: [{ side: 0, u: W * 0.42, w: 1.8, h: 2.2, style: 'store2', frame: '#a8aeb0', id: 'front', main: true, light: st > 0.15 ? LIGHT.office : LIGHT.off, cell: 7 },
      { side: 1, u: D * 0.5, w: 3.0, h: 2.8, style: 'steel', color: '#d8d8d4', id: 'ambulance' }],
    entry: { type: 'canopy', w: 4.2, d: 3.0, h: 2.8, roofKey: 'sheet_metal', roofColor: '#ecebe6' },
    access: 'both',
  });
  // fascia sign with a green medical cross
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'clinic_sign', W * 0.42, fy + 3.35, 3.05, 4.2, 0.55, {
    kind: 'lightbox', ppm: 150, bg: '#ffffff', dayEmissive: 0.2, nightEmissive: st > 0.15 ? 1.4 : 0.05,
    draw: (g, Wc, Hc) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, Wc, Hc);
      g.fillStyle = '#1e8a4a';
      const s = Hc * 0.7, cx = Hc * 0.6, cy = Hc / 2;
      g.fillRect(cx - s / 6, cy - s / 2, s / 3, s); g.fillRect(cx - s / 2, cy - s / 6, s, s / 3);
      g.fillStyle = '#1a2a3a'; g.font = `bold ${Hc * 0.5}px Arial, Helvetica, sans-serif`; g.textBaseline = 'middle';
      g.fillText((ctx.name || 'Port Zarya Clinic').toUpperCase(), Hc * 1.2, cy + Hc * 0.03);
    },
  });
  b.pop();
  // ambulance bay apron + emergency light on the right side
  sideFrame(b, 1, W, D);
  b.box('neon', D * 0.5, fy + 3.05, 0.1, 0.5, 0.15, 0.05, { color: st > 0.15 ? [6, 0.5, 0.3] : [0.05, 0.02, 0.02] });
  b.box('concrete', D * 0.5, -0.02, 3.0, 4.0, 0.06, 6.0, { color: '#9a9a96' });
  b.pop();
  ctx.point('ambulanceBay', W / 2 + 3.0, 0, 0, -HALF_PI);
  // generator box + propane
  b.at(-W / 2 - 1.5, 0, -2.0, HALF_PI);
  b.box('sheet_metal', 0, 0, 0, 2.4, 1.4, 1.1, { color: '#c8c8c0' });
  for (let i = 0; i < 6; i++) b.box('metal', -0.9 + i * 0.36, 0.5, 0.56, 0.2, 0.6, 0.01, { color: '#7a7a76' });
  b.cyl('metal', 0.8, 1.4, 0, 0.07, 0.5, { segs: 8, color: '#5a5a5a' });
  b.pop();
  b.at(-W / 2 - 1.2, 0, 1.5, HALF_PI);
  addProp(b, 'propane', { count: 2 }, r);
  b.pop();
  monumentSign(ctx, 'clinic_monument', W / 2 + 2.5, D / 2 + 3.5, 2.4, 0.7, {
    kind: 'paint', ppm: 120, bg: '#1e3a5a', lines: [{ text: 'CLINIC', size: 0.45, y: 0.36, color: '#ffffff', font: 'Arial, sans-serif' }, { text: 'Open 8–5 · After hours call 911', size: 0.2, y: 0.78, color: '#d8e8f0', font: 'Arial, sans-serif' }],
  }, { rot: -0.4, board: '#1e3a5a' });
  ctx.doors.push({ id: 'front', x: -W / 2 + W * 0.42, z: D / 2 + 0.1, rot: 0, w: 1.8, leadsTo: 'exterior' });
  ctx.point('door', -W / 2 + W * 0.42, 0, D / 2 + 4.0, PI);
  return finish(ctx);
}
