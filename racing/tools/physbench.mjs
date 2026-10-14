// Headless physics bench: 0-60 mph, 0-100 mph, quarter mile, top speed, 60-0 braking, skidpad g.
import { CARS } from '../src/car/cars.js';
import { Vehicle, PHYS_DT } from '../src/car/physics.js';

const flat = () => ({ h: 0, n: [0, 1, 0], surface: 'road' });
const env = { ground: flat, auto: true, assists: 1 };
const only = process.argv[2];
const rows = [];
for (const spec of CARS) {
  if (only && spec.id !== only) continue;
  const v = new Vehicle(spec);
  v.reset(0, 0, 0, 0);
  let t = 0, t60 = null, t100 = null, tq = null, vmax = 0, dist = 0;
  const shifts = [];
  let lastGear = 1;
  while (t < 70) {
    v.step(PHYS_DT, { throttle: 1, brake: 0, steer: 0 }, env);
    t += PHYS_DT;
    const mph = v.speed * 2.23694;
    dist += v.speed * PHYS_DT;
    if (t60 === null && mph >= 60) t60 = t;
    if (t100 === null && mph >= 100) t100 = t;
    if (tq === null && dist >= 402.3) tq = [t, mph];
    vmax = Math.max(vmax, mph);
    if (v.gear !== lastGear) { shifts.push(`${lastGear}>${v.gear}@${mph.toFixed(0)}`); lastGear = v.gear; }
  }
  // braking 60-0
  const b = new Vehicle(spec);
  b.reset(0, 0, 0, 0);
  b.vz = 60 / 2.23694;
  b.speed = b.vz;
  b.gear = 3;
  let bd = 0, bt = 0;
  while (b.speed > 0.2 && bt < 10) { b.step(PHYS_DT, { throttle: 0, brake: 1, steer: 0 }, env); bd += b.speed * PHYS_DT; bt += PHYS_DT; }
  // skidpad: constant speed circle via steering, measure lateral g at ~25 m/s
  const s = new Vehicle(spec);
  s.reset(0, 0, 0, 0);
  s.vz = 22;
  let maxLat = 0;
  for (let i = 0; i < 1200; i++) {
    const thr = s.speed < 22 ? 0.6 : 0.25;
    s.step(PHYS_DT, { throttle: thr, brake: 0, steer: 1 }, env);
    if (i > 400) maxLat = Math.max(maxLat, Math.abs(s.ayL) / 9.81);
  }
  rows.push({ id: spec.id, cls: spec.cls, '0-60': t60?.toFixed(2), '0-100': t100?.toFixed(2), qm: tq ? `${tq[0].toFixed(1)}s@${tq[1].toFixed(0)}` : '-', vmax: vmax.toFixed(0), '60-0 ft': (bd * 3.281).toFixed(0), latG: maxLat.toFixed(2), shifts: shifts.slice(0, 6).join(' ') });
}
console.table(rows);
