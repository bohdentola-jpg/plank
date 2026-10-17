// Your garage in free roam: which car is in the bay, and how every car
// you've had in it is fitted out (parts and paint are free here, and kept
// per car), and the time of day you like to drive out into. Kept in the
// browser apart from the story save.
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { BASE_LOOK, upgradesFor } from '../story/data.js';

const KEY = 'mf_roam_garage';
const TIMES = ['night', 'dusk', 'day'];

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

export const roamGarage = {
  s: null,
  get() {
    if (!this.s) {
      const s = read();
      this.s = {
        car: CAR_BY_ID[s.car] ? s.car : 'silvio',
        cars: s.cars && typeof s.cars === 'object' ? s.cars : {},
        time: TIMES.includes(s.time) ? s.time : 'night',
      };
    }
    return this.s;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.get())); } catch { /* private mode */ }
  },
  /** { look, levels } for a car (its stock look the first time). */
  carState(id) {
    const s = this.get();
    let c = s.cars[id];
    if (!c || typeof c !== 'object') {
      const sp = CAR_BY_ID[id];
      c = { look: { ...BASE_LOOK, ...(sp?.stockLook || {}) }, levels: {} };
      s.cars[id] = c;
    }
    c.look = c.look && typeof c.look === 'object' ? c.look : {};
    c.levels = c.levels && typeof c.levels === 'object' ? c.levels : {};
    return c;
  },
  /** What the session needs for the car in the bay: { spec, look, upgrades }. */
  player(id = this.get().car) {
    const spec = CAR_BY_ID[id] || CARS[0];
    const c = this.carState(spec.id);
    return { spec, look: { ...c.look }, upgrades: upgradesFor(c.levels, spec), levels: { ...c.levels } };
  },
  setCar(id) { this.get().car = id; this.save(); },
  setLook(id, look) { this.carState(id).look = { ...look }; this.save(); },
  setLevel(id, part, tier) { this.carState(id).levels[part] = tier; this.save(); },
  setTime(t) { if (TIMES.includes(t)) { this.get().time = t; this.save(); } },
  TIMES,
};
