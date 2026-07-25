// THE LIFT SHOP — the only place anybody sells you anything down here.
//
// A run is a descent: floor, lift, floor, lift. Inside the lift somebody has set
// up a stall against the back wall, and it takes FOOTAGE — which you earn by
// getting off a floor alive and, mostly, by filming the thing that lives on it.
// Everything you buy lasts the rest of the run and nothing carries over, which is
// the whole reason to go again.

export const CATALOG = {
  shoes: {
    name: 'BETTER SHOES',
    blurb: 'Move faster. Every level of it is another 9%.',
    stall: 'A pair of trainers, laces knotted, roughly your size.',
    price: 55, step: 30, max: 4,
    apply: (m, n) => { m.speed *= 1 + 0.09 * n; },
  },
  lens: {
    name: 'WIDE LENS',
    blurb: 'See more of the room. Wider frame, and the edges stop lying to you.',
    stall: 'A screw-on wide-angle, scratched but true.',
    price: 60, step: 40, max: 3,
    apply: (m, n) => { m.fov += 5 * n; },
  },
  ccd: {
    name: 'LOW-LIGHT CCD',
    blurb: 'The torch reaches further and the dark grades cleaner.',
    stall: 'A camera board with somebody else\'s serial filed off.',
    price: 70, step: 45, max: 3,
    apply: (m, n) => { m.lampRange *= 1 + 0.22 * n; m.lampPower *= 1 + 0.18 * n; },
  },
  soles: {
    name: 'SOFT SOLES',
    blurb: 'It hears less of you. Running is still running.',
    stall: 'Sorbothane pads, cut to shape with a knife.',
    price: 65, step: 40, max: 3,
    apply: (m, n) => { m.noise *= 1 - 0.22 * n; },
  },
  tracker: {
    name: 'TRACKING',
    blurb: 'A pip on the tape edge that points at it. Distance, not direction, when it is close.',
    stall: 'A handheld field-strength meter wired to the camera shoe.',
    price: 110, step: 70, max: 2,
    apply: (m, n) => { m.tracker = Math.max(m.tracker, n); },
  },
  cells: {
    name: 'FRESH CELLS',
    blurb: 'The battery lasts. Nightshot costs less of it.',
    stall: 'Four D-cells still in the shrink-wrap.',
    price: 50, step: 30, max: 3,
    apply: (m, n) => { m.batteryDrain *= 1 - 0.25 * n; },
  },
  lungs: {
    name: 'BIG LUNGS',
    blurb: 'Hold your breath longer — under water, and while it walks past.',
    stall: 'A spirometer with a personal best written on the tube.',
    price: 60, step: 35, max: 3,
    apply: (m, n) => { m.breath *= 1 + 0.3 * n; },
  },
  quickhands: {
    name: 'QUICK HANDS',
    blurb: 'Get into cover instantly, and it gives up on your hiding place sooner.',
    stall: 'Fingerless gloves. Somebody bit through the left one.',
    price: 80, step: 50, max: 2,
    apply: (m, n) => { m.hideSpeed *= 1 + 0.6 * n; m.hideSafety += 0.2 * n; },
  },
  chalk: {
    name: 'SOMEBODY\'S CHALK',
    blurb: 'More arrows on the way to the lift, and they read from further off.',
    stall: 'A tin of chalk stubs and a hand-drawn key to the marks.',
    price: 45, step: 30, max: 3,
    apply: (m, n) => { m.arrows += n; },
  },
  gaffer: {
    name: 'GAFFER TAPE',
    blurb: 'One death, spliced out. The tape jumps and you are somewhere else.',
    stall: 'A roll of two-inch tape with a lot of it already used.',
    price: 180, step: 220, max: 2,
    apply: (m, n) => { m.lives += n; },
  },
  adrenaline: {
    name: 'ADRENALINE',
    blurb: 'Sprint for much longer, and the first second of a chase runs slow.',
    stall: 'Two auto-injectors in a sandwich box.',
    price: 90, step: 60, max: 2,
    apply: (m, n) => { m.stamina *= 1 + 0.45 * n; m.reflex += 0.35 * n; },
  },
  map: {
    name: 'FLOOR PLAN',
    blurb: 'You start each floor knowing which way the lift is.',
    stall: 'A photocopy of a photocopy, with one corridor circled.',
    price: 100, step: 80, max: 1,
    apply: (m, n) => { m.compass = true; },
  },
};

export const KEYS = Object.keys(CATALOG);

// A fresh run's modifiers. Everything the rest of the game reads comes from here.
export function baseMods() {
  return {
    speed: 1,
    fov: 78,
    lampRange: 1,
    lampPower: 1,
    noise: 1,
    tracker: 0,
    batteryDrain: 1,
    breath: 1,
    hideSpeed: 1,
    hideSafety: 0,
    arrows: 0,
    lives: 0,
    stamina: 1,
    reflex: 0,
    compass: false,
  };
}

// owned = { shoes: 2, lens: 1, … }
export function applyOwned(owned) {
  const m = baseMods();
  for (const [k, n] of Object.entries(owned || {})) {
    const def = CATALOG[k];
    if (def && n > 0) def.apply(m, Math.min(n, def.max));
  }
  return m;
}

export function priceOf(key, owned) {
  const def = CATALOG[key];
  if (!def) return Infinity;
  const have = owned?.[key] || 0;
  return def.price + def.step * have;
}

export function soldOut(key, owned) {
  const def = CATALOG[key];
  return !def || (owned?.[key] || 0) >= def.max;
}

// Three offers per lift, seeded so the same run offers the same stock at the same
// floor — reloading the lift is not a re-roll.
export function offersFor(floorIndex, owned, rand) {
  const pool = KEYS.filter((k) => !soldOut(k, owned));
  const out = [];
  const take = Math.min(3, pool.length);
  while (out.length < take) {
    const k = pool[Math.floor(rand() * pool.length)];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

// What a floor pays out. Filming the thing is most of it, which is the point of
// carrying a camera in the first place.
export function footageFor({ floorIndex, filmSeconds, neverChased, seconds, hides }) {
  const base = 35 + floorIndex * 12;
  const film = Math.floor(filmSeconds) * 9;
  const clean = neverChased ? 40 : 0;
  const brisk = seconds < 240 ? 25 : 0;
  const cover = Math.min(3, hides) * 5;
  return {
    base, film, clean, brisk, cover,
    total: base + film + clean + brisk + cover,
  };
}
