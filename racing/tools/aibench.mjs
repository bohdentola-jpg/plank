// AI driving benchmark: solo laps (no traffic) for a spread of cars × seeds on
// a set of tracks. Reports mean lap time, wall-contact incidents and resets
// per track, so AI changes can be judged on more than one lucky run.
//   node racing/tools/aibench.mjs [tracks=skyline,kaido,...|all] [seeds=3] [skill=0.75]
import { TRACK_BY_ID, TRACKS } from '../src/track/tracks.js';
import { Track } from '../src/track/track.js';
import { RaceSim } from '../src/race/sim.js';
import { CAR_BY_ID } from '../src/car/cars.js';

const [tracksArg = 'skyline,kaido,summit,redwood,downtown,route99', seedsRaw = '3', skillRaw = '0.75'] = process.argv.slice(2);
const ids = tracksArg === 'all' ? TRACKS.filter((t) => t.type !== 'drag').map((t) => t.id) : tracksArg.split(',');
const cars = ['civica', 'trueno', 'silvio', 'kaze', 'm3', 'stallion', 'skyhawk', 'venom'];
const seeds = +seedsRaw, skill = +skillRaw;
let gT = 0, gH = 0, gR = 0, gN = 0;
for (const id of ids) {
  const def = TRACK_BY_ID[id];
  const T = new Track(def);
  T.computeRacingLine(1.12);
  let sumT = 0, hits = 0, resets = 0, n = 0, worst = 0, worstCar = '';
  const perCar = [];
  for (const car of cars) {
    let ct = 0;
    for (let k = 0; k < seeds; k++) {
      const sim = new RaceSim(T, { type: def.type === 'drag' ? 'sprint' : def.type, laps: 1, racers: [{ spec: CAR_BY_ID[car], name: 'AI0', skill }], afterFinish: 5, traffic: false, seed: 'b' + k });
      sim.startCountdown(3);
      let t = 0, last = -9;
      while (sim.state !== 'done' && t < 900) {
        sim.events.length = 0;
        sim.step(1 / 60);
        t += 1 / 60;
        for (const e of sim.events) {
          if (e.type === 'wallhit' && t - last > 1) { hits++; last = t; }
          if (e.type === 'reset') resets++;
        }
      }
      const ft = sim.racers[0].finishTime ?? 900;
      ct += ft;
      if (ft > worst) { worst = ft; worstCar = car; }
    }
    perCar.push(`${car} ${(ct / seeds).toFixed(1)}`);
    sumT += ct; n += seeds;
  }
  console.log(`${id.padEnd(11)} mean ${(sumT / n).toFixed(1)}s  walls/lap ${(hits / n).toFixed(2)}  resets ${resets}  worst ${worst.toFixed(1)} (${worstCar})  | ${perCar.join(', ')}`);
  gT += sumT / n; gH += hits / n; gR += resets; gN++;
}
console.log(`ALL: mean lap ${(gT / gN).toFixed(1)}s  walls/lap ${(gH / gN).toFixed(2)}  resets ${gR}`);
