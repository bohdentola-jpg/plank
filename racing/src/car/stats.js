// Spec-sheet numbers for the menus — measured, not guessed: a few seconds of
// the real physics on a flat test pad (0-60, 0-100, 60-0, skidpad g) plus an
// analytic top speed from the torque curve, gearing and drag. Memoized per
// car + upgrade set.
import { Vehicle, PHYS_DT, derivePerf } from './physics.js';

const cache = new Map();
const pad = () => ({ h: 0, n: [0, 1, 0], surface: 'road' });
const ENV = { ground: pad, auto: true, assists: 1 };
const MPH = 2.23694;

function topSpeed(P) {
  const G = 9.81;
  let best = 0;
  for (let v = 20; v < 120; v += 0.25) {
    const wheelRpm = v / P.wheelR * 60 / (2 * Math.PI);
    const resist = 0.5 * 1.225 * P.cdA * v * v + 0.013 * P.mass * G;
    let ok = false;
    for (const g of P.gears) {
      const rpm = wheelRpm * g * P.final;
      if (rpm > P.redline || rpm < P.idle) continue;
      const F = P.torque(rpm) * g * P.final * 0.83 / P.wheelR;
      if (F >= resist) { ok = true; break; }
    }
    if (ok) best = v;
    else if (best) break;
  }
  return best;
}

export function carStats(spec, up = {}) {
  const key = spec.id + JSON.stringify(up);
  if (cache.has(key)) return cache.get(key);
  const P = derivePerf(spec, up);

  // standing start
  const v = new Vehicle(spec, up);
  v.reset(0, 0, 0, 0);
  let t = 0, t60 = null, t100 = null, dist = 0, tq = null;
  while (t < 25 && (t100 === null || tq === null)) {
    v.step(PHYS_DT, { throttle: 1, brake: 0, steer: 0 }, ENV);
    t += PHYS_DT;
    dist += v.speed * PHYS_DT;
    const mph = v.speed * MPH;
    if (t60 === null && mph >= 60) t60 = t;
    if (t100 === null && mph >= 100) t100 = t;
    if (tq === null && dist >= 402.3) tq = t;
  }

  // 60-0
  const b = new Vehicle(spec, up);
  b.reset(0, 0, 0, 0);
  b.vz = 60 / MPH;
  b.speed = b.vz;
  b.gear = 3;
  let bd = 0, bt = 0;
  while (b.speed > 0.2 && bt < 10) {
    b.step(PHYS_DT, { throttle: 0, brake: 1, steer: 0 }, ENV);
    bd += b.speed * PHYS_DT;
    bt += PHYS_DT;
  }

  // skidpad: hold ~80 km/h and wind the wheel in slowly; keep the best
  // lateral g the car actually sustains before it lets go
  const s = new Vehicle(spec, up);
  s.reset(0, 0, 0, 0);
  s.vz = 22;
  let lat = 0;
  for (let i = 0; i < 960; i++) {
    const steer = Math.min(1, i / 900);
    s.step(PHYS_DT, { throttle: s.speed < 22 ? 0.9 : 0.15, brake: 0, steer }, ENV);
    if (i > 120 && Math.abs(s.driftAngle || 0) < 0.12) lat = Math.max(lat, Math.abs(s.ayL) / 9.81);
  }

  const vmax = topSpeed(P);
  const r = {
    hp: Math.round(P.hp),
    torque: Math.round(P.tScale * 0.7376 * (1 + (up.torqueLow || 0) * 0.3)), // lb-ft-ish at the peak of the shape
    weight: Math.round(P.mass - 75),
    t60: t60 ?? 99,
    t100,
    quarter: tq,
    vmax,
    brake60: bd * 3.281,
    latG: lat,
    drive: P.drive,
  };
  const n = (x, a, b2) => Math.max(0.04, Math.min(1, (x - a) / (b2 - a)));
  r.bars = {
    speed: n(vmax * MPH, 95, 215),
    accel: n(11 - r.t60, 0, 8.4),
    handling: n(lat, 0.72, 1.32),
    braking: n(150 - r.brake60, 0, 70),
  };
  r.rating = (r.bars.speed + r.bars.accel * 1.3 + r.bars.handling + r.bars.braking * 0.7) / 4;
  cache.set(key, r);
  return r;
}

export const fmtSpeed = (ms, units = 'mph') => (units === 'kmh' ? `${Math.round(ms * 3.6)} KM/H` : `${Math.round(ms * MPH)} MPH`);
