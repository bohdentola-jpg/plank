// Rules check for DRIP LINE, no browser needed:  node store/tools/smoke.mjs
// Runs the daily loop (streaks, milestones, freezes, jobs, shop rotation,
// buying, capsules, pity, claw, caps) against an in-memory localStorage.
const mem = {};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.location = { search: '', hostname: '' };
globalThis.document = { createElement: () => ({ getContext: () => null }) };

const root = new URL('..', import.meta.url);
const E = await import(new URL('src/systems/econ.js', root));
const D = await import(new URL('src/systems/daily.js', root));
const { ITEMS, itemById, RARITIES, SLOTS, SHOPS, STARTERS } = await import(new URL('src/data/items.js', root));
const { JOBS, CAPSULES } = await import(new URL('src/data/content.js', root));

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

// ---- catalog
check('item ids are unique', new Set(ITEMS.map((i) => i.id)).size === ITEMS.length);
check('every item has a known slot and rarity', ITEMS.every((i) => SLOTS.includes(i.slot) && RARITIES[i.rarity]));
check('every shop item has a price and a known shop', ITEMS.filter((i) => i.shop).every((i) => i.price > 0 && SHOPS[i.shop]));
check('every item has an art type', ITEMS.every((i) => i.art && typeof i.art.type === 'string'));
check('shop cars only sell their slots', ITEMS.filter((i) => i.shop).every((i) => SHOPS[i.shop].slots.includes(i.slot)));
check('every capsule rarity has items', Object.keys(CAPSULES.deluxe.odds).every((r) => ITEMS.some((i) => i.capsule && i.rarity === r)));
check('vault and ghost items are priced', ITEMS.filter((i) => i.vault || i.ghost).every((i) => i.price > 0));
check('there are mythics', ITEMS.filter((i) => i.rarity === 'mythic').length >= 8);

// ---- profile + starters
E.setProfile({ name: 'QA', body: { skin: 'cream', head: 'round', face: 'dots' } });
check('starter items are owned and worn', STARTERS.every((id) => E.owns(id) && E.S.equipped[itemById[id].slot] === id));

// ---- day + jobs
E.ensureDay();
check('three jobs a day', E.jobs().length === 3 && E.jobs().every((j) => JOBS.find((d) => d.id === j.id)));

// ---- streak
const first = E.checkIn(true);
check('day 1 pays 30 + 10 perfect', first.count === 1 && first.tokens === 40, JSON.stringify(first));
check('cannot punch in twice', E.checkIn() === null && !E.canCheckIn());
let r;
for (let i = 2; i <= 7; i++) { D.shiftDays(1); E.ensureDay(); r = E.checkIn(); }
check('day 7 pays 150, an epic ticket and the cab key', r.count === 7 && r.tokens === 150 && r.tickets.includes('epic') && E.S.keys.cab, JSON.stringify(r));
check('day 3 gave a capsule ticket', E.S.tickets.basic >= 1);
for (let i = 8; i <= 30; i++) { D.shiftDays(1); E.ensureDay(); r = E.checkIn(); }
check('day 30 awards the Rush Hour Visor', r.count === 30 && E.owns('ms-30') && r.items.includes('ms-30'), JSON.stringify(r));
for (let i = 31; i <= 100; i++) { D.shiftDays(1); E.ensureDay(); r = E.checkIn(); }
check('day 100 awards the mythic Hundred Halo', r.count === 100 && E.owns('ms-100'));
D.shiftDays(3); E.ensureDay();
check('a 2-day gap breaks the streak', E.checkIn().count === 1);
E.S.streak.freezes = 2;
D.shiftDays(2); E.ensureDay();
const fr = E.checkIn();
check('a freeze covers one missed day', fr.count === 2 && fr.usedFreezes === 1 && E.S.streak.freezes === 1, JSON.stringify(fr));

// ---- shop rotation
for (const sid of E.SHOP_CARS) {
  const st = E.stock(sid);
  check(`${sid} stocks 6 different items`, st.length === 6 && new Set(st.map((s) => s.item.id)).size === 6, String(st.length));
  check(`${sid} has one featured slot`, st.filter((s) => s.featured).length === 1);
}
const drop = E.dropOfDay();
const dropRow = E.stock(drop.shop).find((s) => s.drop);
check('the drop of the day is discounted 25%', dropRow && dropRow.price === Math.round(dropRow.item.price * 0.75));
check('stock is stable within a day', JSON.stringify(E.stock('kicks').map((s) => s.item.id)) === JSON.stringify(E.stock('kicks').map((s) => s.item.id)));

// ---- buying
E.addTokens(100000, 'test');
const row = E.stock('lids').find((s) => !E.owns(s.item.id));
const before = E.S.tokens;
const b = E.buy(row.item.id, row.price);
check('buying spends tokens and grants the item', b.ok && E.owns(row.item.id) && E.S.tokens === before - row.price, JSON.stringify(b.err));
check('cannot buy the same item twice', !!E.buy(row.item.id, row.price).err);
check('equip works for owned items', E.equip(row.item.slot, row.item.id) && E.S.equipped[row.item.slot] === row.item.id);
check('cannot equip unowned items', !E.equip('aura', 'v-rain'));
check('drip score counts rarity', E.dripScore() > 0);

// ---- capsules
const free = E.pull('free');
check('one free pull a day', free.ok && !!E.pull('free').err);
const counts = {};
E.addTokens(3000 * 1200, 'test');
for (let i = 0; i < 3000; i++) {
  const p = E.pull('deluxe');
  counts[p.rarity] = (counts[p.rarity] || 0) + 1;
}
check('deluxe never drops commons', !counts.common && !counts.uncommon, JSON.stringify(counts));
check('deluxe drops legendaries sometimes (pity + odds)', (counts.legendary || 0) > 150, JSON.stringify(counts));
check('pity counter stays under its threshold', E.pityLeft('deluxe') >= 1 && E.pityLeft('deluxe') <= 25);
const t0 = E.S.tickets.epic;
if (t0 > 0) {
  const tp = E.pull('ticket:epic');
  check('epic ticket guarantees epic or better', tp.ok && RARITIES[tp.rarity].rank >= RARITIES.epic.rank);
}
// duplicates turn into tokens
const id = 't-blank';
const tk = E.S.tokens;
const dup = E.grant(id);
check('a duplicate becomes scrap tokens', dup.scrap === RARITIES.common.scrap && E.S.tokens === tk + dup.scrap);
const up = E.grant(id, { prismatic: true });
check('a prismatic duplicate upgrades the owned item', up.upgraded && E.isPrismatic(id));

// ---- claw
const prizes = E.clawPrizes();
const won = E.clawWin(prizes[0].i);
check('claw win removes that capsule', won && !E.clawPrizes().some((p) => p.i === prizes[0].i));

// ---- caps, secrets, lockbox
let paid = 0;
for (let i = 0; i < 5; i++) paid += E.gameReward('tag', 10);
check('minigame rewards cap at 3 per day', paid === 30);
check('password check ignores case and spaces', E.checkPassword(E.weekPassword().word.toLowerCase().replace(/ /g, '  ')));
check('wrong password fails', !E.checkPassword('definitely not it'));
const lb = E.openLockbox();
check('lockbox pays once a day and gives the driver cap first', lb && lb.tokens >= 60 && E.owns('sx-driver') && E.openLockbox() === null);
check('ghost car state is a boolean', typeof E.ghostOpen() === 'boolean');
check('achievement grants its item once', E.achieve('tagS') && E.owns('sx-goldcan') && E.achieve('tagS') === null);
check('headlines exist', E.headlines().length >= 5);

E.commit(true);
check('state saved to storage', (mem['dripline.save.v1'] || '').length > 100);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\nall store checks passed (${ITEMS.length} items)`);
