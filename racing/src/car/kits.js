// Look defaults + body kits. Kits reshape the hull parameters themselves
// (lower lips/skirts, flared arches), so the generator builds a real new shape.

export const DEFAULT_LOOK = {
  paint: '#c0c4ca',
  finish: 'metallic',
  paint2: '#111111',
  paint3: '#ffcc33',
  vinyl: 'none',
  number: 7,
  rims: 'five',
  rimColor: 'silver',
  rimSize: 0,       // extra inches over stock (0..3)
  tint: 1,          // 0 light .. 3 limo
  neon: null,       // '#rrggbb' or null
  kit: 'stock',     // stock | street | race | wide
  spoiler: 'stock', // stock | none | lip | ducktail | roof | gt | big | hoop | evo
  hood: 'stock',    // stock | vented | carbon | scoop
  plate: 'MIDNITE',
  caliper: '#b8141c',
  ride: 0,          // 0..1 lowering
  exhaust: null,    // override layout
  bigExhaust: false,
  banner: null,
  wingCarbon: false,
};

export const KITS = ['stock', 'street', 'race', 'wide'];
export const SPOILERS = ['stock', 'none', 'lip', 'ducktail', 'roof', 'gt', 'evo', 'big', 'hoop'];
export const HOODS = ['stock', 'vented', 'carbon', 'scoop'];
export const VINYLS = ['none', 'stripes', 'side', 'twotone', 'flames', 'tribal', 'number', 'checker', 'sponsor', 'splash', 'kanji'];

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export function applyLook(spec, look = {}) {
  const L = { ...DEFAULT_LOOK, ...(spec.stockLook || {}), ...look };
  const b = clone(spec.body);
  const drop = (amt, frontAmt = amt, rearAmt = amt) => {
    const n = b.bot.length;
    b.bot = b.bot.map(([u, y], i) => {
      const a = i === 0 ? frontAmt : i === n - 1 ? rearAmt : amt;
      return [u, Math.max(0.07, y - a)];
    });
  };
  if (L.kit === 'street') drop(0.025, 0.04, 0.025);
  if (L.kit === 'race') drop(0.035, 0.07, 0.04);
  if (L.kit === 'wide') {
    drop(0.03, 0.05, 0.03);
    b.plan = { ...(b.plan || {}), flare: ((b.plan && b.plan.flare) || 0.025) + 0.05 };
    b.W += 0.1;
  }
  return { body: b, look: L };
}
