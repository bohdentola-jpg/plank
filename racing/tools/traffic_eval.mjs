// AI vs traffic: solo laps per car × traffic seeds, traffic on vs off.
//   node racing/tools/traffic_eval.mjs [trackId=skyline] [seeds=4]
import { TRACK_BY_ID } from '../src/track/tracks.js';
import { Track } from '../src/track/track.js';
import { RaceSim } from '../src/race/sim.js';
import { CAR_BY_ID } from '../src/car/cars.js';
const [id = 'skyline', seedsRaw = '4'] = process.argv.slice(2);
const def = TRACK_BY_ID[id];
const T = new Track(def); T.computeRacingLine(1.12);
const cars = ['skyhawk', 'm3', 'stallion', 'lancet', 'civica', 'venom'];
function run(car, traffic, seed) {
  const sim = new RaceSim(T, { type: def.type, laps: 1, racers: [{ spec: CAR_BY_ID[car], name: 'AI0', skill: 0.75 }], afterFinish: 30, traffic, seed: String(seed) });
  sim.startCountdown(3);
  let t = 0, hits = 0, resets = 0, last = -9;
  while (sim.state !== 'done' && t < 600) {
    sim.events.length = 0; sim.step(1 / 60); t += 1 / 60;
    for (const e of sim.events) { if (e.type === 'carhit' && t - last > 0.8) { hits++; last = t; } if (e.type === 'reset') resets++; }
  }
  return { time: sim.racers[0].finishTime ?? 999, hits, resets };
}
let sumD = 0, sumH = 0, sumR = 0, n = 0, worst = 0;
for (const car of cars) {
  const base = run(car, false, 0).time;
  const row = [];
  for (let k = 0; k < +seedsRaw; k++) {
    const r = run(car, true, k + 1);
    const d = r.time - base;
    sumD += d; sumH += r.hits; sumR += r.resets; n++; worst = Math.max(worst, d);
    row.push(`${d >= 0 ? '+' : ''}${d.toFixed(1)}s/${r.hits}h${r.resets ? '/' + r.resets + 'R' : ''}`);
  }
  console.log(car.padEnd(9), base.toFixed(1), row.join('  '));
}
console.log(`${id}: mean +${(sumD / n).toFixed(1)}s, worst +${worst.toFixed(1)}s, incidents/lap ${(sumH / n).toFixed(1)}, resets ${sumR}`);
