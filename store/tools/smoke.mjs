// Rules check for the store, no browser needed:  node store/tools/smoke.mjs
// Runs the daily loop (streaks, freezes, missions, deals, claw, coupons,
// checkout math) against an in-memory localStorage and fails loudly.
const mem = {};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.location = { search: '' };
globalThis.document = { createElement: () => ({ getContext: () => null }) };

const root = new URL('..', import.meta.url);
const E = await import(new URL('src/systems/econ.js', root));
const D = await import(new URL('src/systems/daily.js', root));
const { PRODUCTS, SHOPS } = await import(new URL('src/data/catalog.js', root));
const { STICKERS, MISSIONS } = await import(new URL('src/data/content.js', root));

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

// catalog sanity
check('every product has a known shop', PRODUCTS.every((p) => SHOPS[p.shop]));
check('product ids are unique', new Set(PRODUCTS.map((p) => p.id)).size === PRODUCTS.length);
check('prices are positive', PRODUCTS.every((p) => p.price > 0));
check('sticker ids are unique', new Set(STICKERS.map((s) => s.id)).size === STICKERS.length);

// day + missions
E.ensureDay();
check('three missions per day', E.missions().length === 3);
check('missions are known', E.missions().every((m) => MISSIONS.find((d) => d.id === m.id)));

// streak cycle
const first = E.checkIn(true);
check('first check-in gives day 1 + perfect bonus', first.count === 1 && first.tokens === 15, JSON.stringify(first));
check('first check-in grants the Shelly sticker', first.stickers.includes('shelly'));
check('cannot check in twice', E.checkIn() === null && !E.canCheckIn());
let r;
for (let i = 2; i <= 7; i++) {
  D.shiftDays(1);
  E.ensureDay();
  r = E.checkIn();
}
check('day 7 pays 100 and the maintenance key', r.count === 7 && r.tokens === 100 && r.key && E.S.keys.maint, JSON.stringify(r));
check('7-day streak grants the gold token sticker', !!E.S.stickers.goldtoken);

// missed days without freezes reset the streak
D.shiftDays(3);
E.ensureDay();
check('a 2-day gap breaks the streak', E.checkIn().count === 1);

// freezes bridge gaps
E.S.streak.freezes = 2;
D.shiftDays(2);
E.ensureDay();
const fr = E.checkIn();
check('a freeze covers one missed day', fr.count === 2 && fr.usedFreezes === 1 && E.S.streak.freezes === 1, JSON.stringify(fr));

// deals are deterministic per day and in range
const d1 = E.deals();
check('deal of the day is 40% off', d1.dotd.pct === 40);
check('no secret item is the deal of the day', !SHOPS[d1.dotd.product.shop].secret);
check('discounted price matches the deal', E.priceOf(d1.dotd.product).price === Math.round(d1.dotd.product.price * 60) / 100);

// tokens + exchange + coupons
E.addTokens(1000, 'test');
const before = E.S.tokens;
const ex = E.exchange('pct10');
check('exchange spends tokens and adds a coupon', ex.ok && E.S.tokens === before - 500 && E.S.coupons.length === 1);
check('exchange refuses when short', E.exchange('pct20').err || E.S.tokens >= 900);

// bag math
E.S.bag = [];
const p1 = PRODUCTS.find((p) => p.id === 't-hoodie-bolt');
E.addToBag(p1.id, 'M', 2);
const c = E.S.coupons[0];
const t = E.totals(c.id);
const sub = E.priceOf(p1).price * 2;
check('subtotal = price × qty', t.subtotal === Math.round(sub * 100) / 100, `${t.subtotal} vs ${sub}`);
check('10% coupon applies', Math.abs(t.discount - Math.round(sub * 10) / 100) < 0.011, `${t.discount}`);
check('free shipping over threshold', t.ship === 0);
const order = E.placeOrder(c.id);
check('placing an order empties the bag and uses the coupon', order && E.bagCount() === 0 && E.S.coupons.length === 0);
check('order total is recorded', order.order.total === t.total);

// claw
const prizes = E.clawPrizes();
check('claw pit has prizes', prizes.length > 0);
const won = E.clawWin(prizes[0].i);
check('claw win removes that capsule', won && !E.clawPrizes().some((p) => p.i === prizes[0].i));

// game reward cap
let paid = 0;
for (let i = 0; i < 5; i++) paid += E.gameReward('tag', 10);
check('minigame rewards cap at 3 per day', paid === 30);

// passwords
check('password check ignores case and spaces', E.checkPassword(E.weekPassword().word.toLowerCase().replace(/ /g, '  ')));
check('wrong password fails', !E.checkPassword('definitely not it'));

// persistence
E.commit(true);
check('state saved to storage', (mem['3rdrail.save.v1'] || '').length > 100);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall store checks passed');
