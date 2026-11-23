// U.S. Post Office, Port Zarya AK 99790: a small T1-11 building with a flag,
// an entry canopy with steps and a ramp, a blue collection box and cluster boxes.
import { makeCtx, finish, sign, flagpole, weather, LIGHT, PI, HALF_PI } from './common.js';
import { civic } from './civic.js';
import { addProp } from '../props.js';

export function build(opts = {}) {
  const ctx = makeCtx('postOffice', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 11, D = 9, fy = 0.5;
  ctx.footprint = { w: W + 6, d: D + 5 };
  const blue = '#23457a';
  const res = civic(ctx, {
    W, D, fy, storeys: 1, sH: 3.3, key: wear > 0.6 ? 'siding_peel' : 'siding_panel', color: weather('#d8ccb0', wear * 0.6), trim: weather('#f0ece2', wear * 0.4),
    roof: { type: 'gable', axis: 'x', pitch: 0.33, key: 'metal_corr_paint', color: weather('#4a5258', wear * 0.5), icicles: 0.4 },
    win: { w: 1.2, h: 1.2, per: 3.0, style: 'slider', cell: 7, lit: () => (st > 0.2 ? LIGHT.office : LIGHT.off), sides: [true, true, false, true] },
    doors: [{ side: 0, u: W * 0.36, w: 1.0, h: 2.1, style: 'glass', frame: '#9aa0a4', id: 'front', main: true, light: st > 0.2 ? LIGHT.office : LIGHT.off, cell: 7 }, { side: 2, u: W * 0.7, w: 0.95, style: 'steel', color: '#7a7e80', id: 'back' }],
    entry: { type: 'canopy', w: 3.4, d: 2.2, h: 2.75, roofKey: 'sheet_metal', roofColor: '#e8e8e4' },
    access: 'both',
  });
  // fascia sign over the canopy
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'usps_sign', W * 0.36, fy + 3.25, 2.25, 3.4, 0.5, {
    kind: 'paint', ppm: 150, bg: '#f2f2f0',
    lines: [{ text: 'UNITED STATES POST OFFICE', size: 0.36, y: 0.36, color: '#1a1a1a', font: 'Arial, Helvetica, sans-serif', weight: 'bold' },
      { text: 'PORT ZARYA, ALASKA 99790', size: 0.28, y: 0.74, color: blue, font: 'Arial, Helvetica, sans-serif', weight: 'bold' }],
  });
  b.pop();
  flagpole(ctx, W / 2 + 3.0, D / 2 + 2.5, 8.5);
  // blue collection box + cluster mailboxes
  b.at(-W / 2 - 0.8, 0, D / 2 + 1.6, 0.2);
  b.box('sheet_metal', 0, 0.0, 0, 0.5, 0.15, 0.5, { color: '#2a2a2a' });
  b.box('sheet_metal', 0, 0.15, 0, 0.52, 0.95, 0.55, { color: blue });
  b.cyl('sheet_metal', 0, 1.1, -0.275, 0.26, 0.55, { segs: 10, thetaStart: -HALF_PI, thetaLen: PI, color: blue, caps: '' });
  b.box('sheet_metal', 0, 0.85, 0.28, 0.32, 0.06, 0.02, { color: '#1a1a1a' });
  b.pop();
  ctx.point('collectionBox', -W / 2 - 0.8, 0, D / 2 + 2.3, PI);
  b.at(-W / 2 - 1.8, 0, D / 2 + 0.6, 0.0);
  addProp(b, 'mailboxes', {}, r);
  b.pop();
  ctx.point('mailboxes', -W / 2 - 1.8, 0, D / 2 + 1.4, PI);
  ctx.doors.push({ id: 'front', x: -W / 2 + W * 0.36, z: D / 2 + 0.1, rot: 0, w: 1.0, leadsTo: 'exterior' });
  ctx.point('door', -W / 2 + W * 0.36, 0, D / 2 + 3.4, PI);
  ctx.point('flag', W / 2 + 3.0, 0, D / 2 + 3.2, PI);
  void res;
  return finish(ctx);
}
