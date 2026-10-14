// Headless AI race: node racing/tools/simrace.mjs <trackId> [n=6] [carId|mixed] [laps]
// Runs the full race simulation (AI drives every car) and prints a report.
import { TRACK_BY_ID } from '../src/track/tracks.js';
import { Track } from '../src/track/track.js';
import { RaceSim } from '../src/race/sim.js';
import { CARS, CAR_BY_ID } from '../src/car/cars.js';
import { fmtTime } from '../src/core/util.js';

const [id = 'downtown', nRaw = '6', carArg = 'mixed', lapsRaw] = process.argv.slice(2);
const def = TRACK_BY_ID[id];
if (!def) { console.log('no track', id); process.exit(1); }
const T = new Track(def);
T.computeRacingLine(1.12);
const n = parseInt(nRaw, 10);
const pool = carArg === 'mixed' ? CARS.filter((c) => c.cls === 'B' || c.cls === 'A') : [CAR_BY_ID[carArg]];
const racers = [];
for (let k = 0; k < n; k++) racers.push({ spec: pool[k % pool.length], name: `AI${k}`, skill: 0.6 + 0.4 * (k / Math.max(1, n - 1)) });
const sim = new RaceSim(T, { type: def.type, laps: lapsRaw ? parseInt(lapsRaw, 10) : (def.laps || 3), racers, afterFinish: 60 });
sim.startCountdown(3);
const counts = { carhit: 0, wallhit: 0, reset: 0, landing: 0 };
let t = 0;
const t0 = Date.now();
while (sim.state !== 'done' && t < 900) {
  sim.events.length = 0;
  sim.step(1 / 60);
  for (const e of sim.events) if (counts[e.type] !== undefined) counts[e.type]++;
  t += 1 / 60;
}
console.log(`${def.name}: length ${Math.round(T.length)}m, laps ${sim.laps}, sim ${t.toFixed(0)}s in ${Date.now() - t0}ms`);
for (const r of sim.finishOrder) {
  console.log(`${String(r.place).padStart(2)}. ${r.name.padEnd(5)} ${r.spec.id.padEnd(12)} skill ${r.skill.toFixed(2)}  time ${fmtTime(r.finishTime)}${r.estimated ? '*' : ' '}  best ${fmtTime(r.bestLap)}  laps ${r.lapTimes.map((x) => fmtTime(x)).join(' ')}`);
}
console.log('events', JSON.stringify(counts));
