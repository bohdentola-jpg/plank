// Headless checks for NO VACANCY: every module imports under a DOM stub, the
// rigs and textures build, a save survives a round trip, and — with --days N —
// a greedy auto-player runs the economy so the balance curve is visible.
const stubCtx = () => new Proxy({}, {
  get(t, prop) {
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (prop === 'createPattern') return () => null;
    if (prop === 'canvas') return { width: 256, height: 256 };
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
const stubCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => stubCtx(), appendChild() {} });
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? stubCanvas() : { style: {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } }),
  createElementNS: () => stubCanvas(),
  getElementById: () => null,
  querySelector: () => null,
  addEventListener() {},
};
globalThis.window = globalThis;
try { globalThis.navigator ??= { userAgent: 'node' }; } catch { /* node 21+ has a getter */ }
globalThis.self = globalThis;
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance ??= { now: () => Date.now() };
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
    console.error(String(e.stack).split('\n').slice(1, 5).join('\n'));
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

const H = '../hotel/src';
const data = await import(`${H}/data.js`);
const names = await import(`${H}/names.js`);
const nav = await import(`${H}/nav.js`);
const sim = await import(`${H}/sim.js`);

await step('names + flavour pools', async () => {
  must(names.genGuestName().split(' ').length >= 2, 'guest name');
  must(names.genHotelName().length > 3, 'hotel name');
  must(names.REQUESTS.length >= 10, 'requests');
  for (const band of ['great', 'good', 'meh', 'bad', 'awful']) {
    must((names.REVIEW_LINES[band] || []).length >= 8, `reviews.${band}`);
  }
  must(names.NEWS_TICKER.length >= 14, 'ticker');
  must(names.WALKOUT_QUIPS.length >= 8 && names.ARRIVAL_QUIPS.length >= 10, 'quips');
});

await step('textures render', async () => {
  const t = await import(`${H}/textures.js`);
  t.carpetCanvas('#6d5f52', '#8f2d3c');
  t.roomCarpetCanvas('#6d5f52');
  t.wallpaperCanvas('#e3d9c4', '#8f2d3c');
  t.stuccoCanvas('#d8c9a8');
  t.brickCanvas('#9a4a32');
  t.tileCanvas('#eee', '#ccc');
  t.asphaltCanvas('#3c3d43');
  t.grassCanvas('#4e6b3c');
  t.bedCanvas('#c8b8a0', '#e0a92b');
  t.artCanvas(12345);
  t.tvCanvas(true); t.tvCanvas(false);
  t.signCanvas('The Cardinal Arms Extended Stay', { face: '#f3e7cf', ink: '#8f2d3c' });
  t.vacancyCanvas(true, false);
  t.doorPlateCanvas('204', 2);
  for (let h = 0; h < 24; h += 3) t.skyCanvas(h);
  t.posterCanvas('POOL', '#1d3557');
  t.woodCanvas('#6b4426');
  t.marbleCanvas('#cdc7bb', '#9b958a');
  t.poolWaterCanvas(0.3);
  must(t.contrastText('#ffffff') === '#16181d', 'contrast');
  must(t.shade('#000000', 16) === '#101010', `shade got ${t.shade('#000000', 16)}`);
  must(t.mix('#000000', '#ffffff', 0.5).length === 7, 'mix');
});

await step('people rigs + poses', async () => {
  const p = await import(`${H}/people.js`);
  const rand = () => 0.42;
  const looks = [p.randomLook(), p.randomLook(rand)];
  for (const role of ['you', 'clerk', 'housekeeper', 'maintenance', 'bellhop', 'laundry', 'auditor', 'manager']) {
    looks.push(p.staffLook(role));
  }
  for (const look of looks) {
    const rig = p.buildPerson(look);
    for (const j of ['root', 'hips', 'torso', 'head', 'armL', 'armR', 'legL', 'legR', 'carry']) {
      must(rig.j[j], `rig missing joint ${j}`);
    }
    for (const action of ['idle', 'walk', 'carry', 'clean', 'fix', 'desk', 'sit', 'sleep', 'wave', 'wait']) {
      for (let i = 0; i < 20; i++) p.posePerson(rig, 0.05, { action, speed: 2.4 });
      must(Number.isFinite(rig.j.torso.rotation.x), `NaN pose in ${action}`);
    }
    p.setPersonMood(rig, 0.2);
    p.setPersonMood(rig, 0.95);
    p.disposePerson(rig);
  }
});

await step('nav paths', async () => {
  const s = sim.newHotel();
  sim.addFloor(s);
  const room = s.rooms[s.rooms.length - 1];
  const from = nav.deskStaff();
  const pts = nav.pathTo(s, { ...from, y: 0 }, nav.roomInside(room));
  must(pts.length >= 3, 'expected a multi-leg path');
  must(pts.some((p) => p.vert), 'no vertical leg to another floor');
  const secs = nav.travelSecs(s, from, nav.roomInside(room), 3.2);
  must(secs > 1 && secs < 90, `odd travel time ${secs}`);
  const actor = { ...from, path: nav.pathTo(s, from, nav.roomInside(room)) };
  let guard = 0;
  while (!nav.advance(s, actor, 3.2, 0.1) && guard++ < 4000);
  must(guard < 4000, 'actor never arrived');
});

await step('a hotel opens, fills and gets paid', async () => {
  const s = sim.newHotel({ name: 'Testville Motor Lodge' });
  s.youAuto = true;
  const seen = new Set();
  for (let i = 0; i < 30000; i++) sim.stepSim(s, 0.1, (k) => seen.add(k));
  must(seen.has('arrive'), 'nobody ever showed up');
  must(seen.has('checkin'), 'nobody ever checked in');
  must(seen.has('pay'), 'nobody ever paid');
  must(seen.has('cleaned'), 'no room was ever cleaned');
  must(s.day > 8, `clock barely moved: day ${s.day}`);
  must(s.totals.nights > 5, `only ${s.totals.nights} nights sold in ${s.day} days`);
  must(s.guests.every((g) => Number.isFinite(g.x) && Number.isFinite(g.mood)), 'guest went NaN');
  must(!s.tasks.some((t) => t.claimedBy && !sim.workerById(s, t.claimedBy)), 'task claimed by a ghost');
});

await step('staff take over', async () => {
  const s = sim.newHotel();
  s.cash = 40000;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const role of ['clerk', 'housekeeper', 'maintenance', 'bellhop']) {
    const res = sim.hire(s, role);
    must(res.ok, `hire ${role}: ${res.why}`);
  }
  must(sim.isAutomated(s), 'four core roles should mean autopilot');
  s.youAuto = false;
  const before = s.totals.nights;
  for (let i = 0; i < 12000; i++) sim.stepSim(s, 0.1, () => {});
  must(s.totals.nights > before + 4, `staff sold only ${s.totals.nights - before} nights on their own`);
  must(s.you.job === null, 'you should be idle with AUTO off');
});

await step('save round trip', async () => {
  const s = sim.newHotel({ name: 'The Blue Heron' });
  s.cash = 9000;
  sim.buildRoom(s);
  sim.buyAmenity(s, 'wifi');
  sim.hire(s, 'housekeeper');
  for (let i = 0; i < 4000; i++) sim.stepSim(s, 0.1, () => {});
  const blob = JSON.parse(JSON.stringify(sim.serialize(s)));
  const back = sim.deserialize(blob);
  must(back, 'deserialize returned null');
  must(back.name === 'The Blue Heron', 'name lost');
  must(back.staff.length === 1 && back.staff[0].role === 'housekeeper', 'staff lost');
  must(back.amenities.wifi, 'amenities lost');
  must(sim.builtRooms(back).length === sim.builtRooms(s).length, 'rooms lost');
  must(back.rooms.every((r) => r.state !== 'occupied'), 'occupied rooms should reset on load');
  must(blob.escrow >= 0, 'escrow missing');
  for (let i = 0; i < 2000; i++) sim.stepSim(back, 0.1, () => {});
  must(Number.isFinite(back.cash), 'cash went NaN after reload');
});

await step('offline catch-up pays a staffed hotel and not an empty one', async () => {
  const bare = sim.newHotel();
  const r1 = sim.offlineCatchUp(bare, 4 * 3600);
  must(r1.net <= 0, `an unstaffed hotel should not earn offline (got ${r1.net})`);

  const run = sim.newHotel();
  run.cash = 60000;
  for (const r of run.rooms) { r.built = true; r.state = 'empty'; }
  sim.addFloor(run);
  for (const r of run.rooms) { r.built = true; r.state = 'empty'; }
  run.rep = 3.4;
  for (const role of ['clerk', 'housekeeper', 'housekeeper', 'maintenance', 'bellhop', 'auditor']) sim.hire(run, role);
  const cash0 = run.cash;
  const r2 = sim.offlineCatchUp(run, 6 * 3600);
  must(r2.net > 0, `a staffed hotel should earn offline (got ${r2.net})`);
  must(run.cash > cash0, 'cash did not move');
  must(sim.offlineCapHours(run) === data.OFFLINE_CAP_HOURS.auditor, 'night auditor should extend the offline cap');
  const r3 = sim.offlineCatchUp(run, 40 * 3600);
  must(r3.capped, '40h away should be capped');
  must(Number.isFinite(run.cash) && Number.isFinite(run.rep), 'offline produced NaN');
});

await step('a covered crew holds its standing while you are away', async () => {
  // Regression: unmet demand used to be booked as walkouts, and the raw count
  // then drove reputation, so any long absence bottomed out the stars.
  const s = sim.newHotel();
  s.cash = 90000;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  sim.addFloor(s);
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const id of ['wifi', 'coffee', 'breakfast', 'pool', 'chandelier', 'signneon']) sim.buyAmenity(s, id);
  for (const role of ['clerk', 'housekeeper', 'housekeeper', 'maintenance', 'bellhop', 'auditor']) sim.hire(s, role);
  s.rep = Math.min(4.2, sim.repCeiling(s));
  const before = sim.starRating(s);
  const rep = sim.offlineCatchUp(s, 6 * 3600);
  must(rep.repTo > before - 0.6, `a covered crew should hold its stars: ${before.toFixed(2)} -> ${rep.repTo.toFixed(2)}`);
  must(rep.walkouts < rep.nights * 0.5, `too many turn-aways for a covered crew: ${rep.walkouts} vs ${rep.nights} nights`);
  must(rep.net > 0, 'a covered crew should turn a profit while away');

  const bare = sim.newHotel();
  bare.rep = 3.5;
  const bareRep = sim.offlineCatchUp(bare, 6 * 3600);
  must(bareRep.repTo < 3.4, 'leaving an unstaffed hotel for six hours should cost you standing');
});

await step('a live gap does not pay mid-stay guests twice', async () => {
  // Regression: settleBill() banks the cash itself, so folding those bills into
  // report.revenue and then adding report.net banked them a second time.
  const s = sim.newHotel();
  s.cash = 30000;
  s.youAuto = true;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const role of ['clerk', 'housekeeper', 'maintenance', 'bellhop']) sim.hire(s, role);
  for (let i = 0; i < 6000; i++) sim.stepSim(s, 0.1, () => {});
  const inHouse = s.guests.filter((g) => ['inroom', 'toroom', 'checkout', 'tocheckout'].includes(g.state));
  must(inHouse.length > 0, 'wanted at least one guest mid-stay for this check');
  const cash0 = s.cash;
  const r = sim.offlineCatchUp(s, 40 * 60);
  const delta = s.cash - cash0;
  const expected = r.net + (r.settled || 0);
  must(Math.abs(delta - expected) <= 2, `cash moved ${delta} but the report says ${expected}`);
});

await step('a layoff hands back the job it was holding', async () => {
  // Regression: a worker popped for missed payroll left task.claimedBy pointing
  // at nobody, which no worker could ever pick up — a permanently dirty room.
  const s = sim.newHotel();
  s.cash = 4000;
  s.youAuto = true;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const role of ['clerk', 'housekeeper', 'maintenance', 'bellhop']) sim.hire(s, role);
  s.cash = -1500;                       // next rollover cannot make payroll
  for (let i = 0; i < 40000; i++) {
    sim.stepSim(s, 0.1, () => {});
    if (s.staff.length < 4) break;
  }
  must(s.staff.length < 4, 'expected somebody to quit over the bounced payroll');
  const ghosts = s.tasks.filter((t) => t.claimedBy && !sim.workerById(s, t.claimedBy));
  must(!ghosts.length, `${ghosts.length} task(s) still claimed by a worker who left`);
});

await step('a guest who asked for towels can still check out', async () => {
  // Regression: taskFor() matched any task carrying the guest's id, so an open
  // room-service request blocked the check-out task from ever being created.
  // The guest then timed out at the desk and was force-settled at 70%.
  const s = sim.newHotel();
  s.cash = 60000;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  sim.addFloor(s);
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const role of ['clerk', 'clerk', 'housekeeper', 'housekeeper', 'maintenance', 'bellhop', 'auditor']) sim.hire(s, role);
  let partial = 0;
  let paid = 0;
  let requests = 0;
  for (let i = 0; i < 60000; i++) {
    sim.stepSim(s, 0.1, (kind, d) => {
      if (kind === 'request') requests++;
      if (kind === 'pay') { paid++; if (d.factor < 1) partial++; }
    });
  }
  must(requests > 3, `expected some room-service requests, saw ${requests}`);
  must(paid > 20, `expected plenty of checkouts, saw ${paid}`);
  must(partial === 0, `${partial} of ${paid} guests gave up at the desk with a full crew on duty`);
  const stale = s.tasks.filter((t) => {
    const g = t.guestId ? sim.guestById(s, t.guestId) : null;
    return t.guestId && !g;
  });
  must(!stale.length, `${stale.length} task(s) point at a guest who has left`);
});

await step('the laundry attendant does the job they were hired for', async () => {
  const s = sim.newHotel();
  s.cash = 5000;
  must(!sim.aggregate(s).instantLinen, 'carts should not self-refill to begin with');
  must(sim.hire(s, 'laundry').ok, 'could not hire a laundry attendant');
  must(sim.aggregate(s).instantLinen, 'a laundry attendant should keep the carts stocked');
});

await step('escrow only covers nights actually slept', async () => {
  // Regression: the save banked the whole booking, so reloading a full hotel
  // collected three nights of every stay in one second, over and over.
  const s = sim.newHotel();
  s.cash = 20000;
  s.youAuto = true;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  sim.hire(s, 'clerk');
  const inHouseNow = () => s.guests.filter((g) => ['inroom', 'toroom', 'checkout', 'tocheckout'].includes(g.state));
  let multi = [];
  for (let i = 0; i < 40000; i++) {
    sim.stepSim(s, 0.1, () => {});
    multi = inHouseNow().filter((g) => g.nights > 1 && g.checkoutDay > s.day);
    if (multi.length) break;
  }
  must(multi.length, 'wanted a multi-night guest partway through their stay');
  const blob = sim.serialize(s);
  const inHouse = inHouseNow();
  const wholeBooking = inHouse.reduce((n, g) => {
    const room = g.roomId ? sim.roomById(s, g.roomId) : null;
    return n + (room ? sim.roomRate(s, room) : 0) * g.nights;
  }, 0);
  must(blob.escrow > 0, 'a hotel with guests in it should escrow something');
  must(blob.escrow < wholeBooking, `escrow ${blob.escrow} should be under the full bookings ${wholeBooking}`);
  must(blob.escrowNights < inHouse.reduce((n, g) => n + g.nights, 0),
    `escrowed every booked night (${blob.escrowNights}) instead of only the slept ones`);
});

await step('the day-so-far ledger survives a reload', async () => {
  const s = sim.newHotel();
  s.cash = 9000;
  s.youAuto = true;
  for (let i = 0; i < 6000; i++) sim.stepSim(s, 0.1, () => {});
  const back = sim.deserialize(JSON.parse(JSON.stringify(sim.serialize(s))));
  must(back.today.revenue === s.today.revenue, `today's revenue lost: ${s.today.revenue} -> ${back.today.revenue}`);
  must(back.today.cleaned === s.today.cleaned, "today's cleaning count lost");
});

await step('you can put a guest in the room you choose', async () => {
  const s = sim.newHotel();
  s.cash = 40000;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  s.rooms[4].tier = 3;
  let g = null;
  for (let i = 0; i < 20000 && !g; i++) {
    sim.stepSim(s, 0.1, () => {});
    g = s.guests.find((x) => x.state === 'queue');
  }
  must(g, 'nobody ever queued at the desk');
  const free = sim.freeRoomsFor(s, g);
  must(free.length > 1, `expected a choice of rooms, got ${free.length}`);
  must(free.some((r) => r.id === g.roomId), 'their provisional room should be in the list');
  const suite = s.rooms[4];
  const moved = sim.assignRoom(s, g.id, suite.id);
  must(moved.ok, `could not move them: ${moved.why}`);
  must(g.roomId === suite.id, 'guest was not moved');
  must(suite.state === 'reserved' && suite.guestId === g.id, 'suite was not held for them');
  const others = s.rooms.filter((r) => r.id !== suite.id && r.guestId === g.id);
  must(!others.length, 'the old room is still held for them too');

  // and you cannot park two guests in the same room, or move somebody already in
  const other = s.guests.find((x) => x.state === 'queue' && x.id !== g.id);
  if (other) must(!sim.assignRoom(s, other.id, suite.id).ok, 'double-booked a room');
  g.state = 'inroom';
  must(!sim.assignRoom(s, g.id, s.rooms[0].id).ok, 'moved a guest who was already checked in');
});

await step('guests use the furniture and the front door', async () => {
  // Regression: sleep/sit were struck wherever the guest happened to be, so
  // they lay flat in the middle of the carpet; and arrivals walked a dogleg
  // straight through the lobby's plate glass.
  const s = sim.newHotel();
  s.cash = 30000;
  s.youAuto = true;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const r of s.rooms) r.tier = 2;         // every room has a chair to sit in
  sim.hire(s, 'clerk');
  sim.hire(s, 'housekeeper');
  // Snapshot the distance at the moment we see the pose — the guest carries on
  // living afterwards, so holding the reference and measuring later is useless.
  let sleptAt = null;
  let satAt = null;
  for (let i = 0; i < 90000 && !(sleptAt !== null && satAt !== null); i++) {
    sim.stepSim(s, 0.1, () => {});
    for (const g of s.guests) {
      if (g.path || !g.roomId) continue;
      const room = sim.roomById(s, g.roomId);
      if (!room) continue;
      if (g.action === 'sleep' && sleptAt === null) sleptAt = nav.dist3(g, nav.roomBed(room));
      if (g.action === 'sit' && satAt === null) satAt = nav.dist3(g, nav.roomChair(room));
    }
  }
  must(sleptAt !== null, 'nobody ever went to bed');
  must(sleptAt < 0.4, `asleep ${sleptAt.toFixed(2)} units from the bed`);
  must(satAt === null || satAt < 0.4, `sitting ${(satAt || 0).toFixed(2)} units from the chair`);

  const walker = { ...nav.street(0) };
  nav.goToVia(s, walker, [nav.entrance(), nav.queueSpot(0)]);
  must(walker.path.some((p) => Math.abs(p.x - nav.DOOR_X) < 0.7 && p.z > 1.4),
    'arrivals never pass through the doorway');
  const solid = walker.path.filter((p) => p.z > -5 && p.z < 2.6 && Math.abs(p.x - nav.DOOR_X) > 2.4 && p.z > 1.0);
  must(!solid.length, `path crosses the shopfront at ${JSON.stringify(solid[0])}`);
});

await step('a frozen tab does not cash out unfinished stays in full', async () => {
  // Regression: offlineCatchUp settled mid-stay guests for their whole booking,
  // so a two-minute stall paid every night in the building and freed the rooms.
  const s = sim.newHotel();
  s.cash = 30000;
  s.youAuto = true;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  sim.hire(s, 'clerk');
  sim.hire(s, 'housekeeper');
  let multi = [];
  for (let i = 0; i < 40000; i++) {
    sim.stepSim(s, 0.1, () => {});
    multi = s.guests.filter((g) => g.state === 'inroom' && g.nights > 1 && g.checkoutDay > s.day);
    if (multi.length) break;
  }
  must(multi.length, 'wanted a guest partway through a multi-night stay');
  must(sim.nightsSlept(s, multi[0]) < multi[0].nights, 'a guest mid-stay has not slept every night');
  const inHouse = s.guests.filter((x) => ['inroom', 'toroom', 'checkout', 'tocheckout'].includes(x.state));
  const everyBookedNight = inHouse.reduce((n, x) => {
    const room = x.roomId ? sim.roomById(s, x.roomId) : null;
    return n + (room ? sim.roomRate(s, room) : 0) * x.nights;
  }, 0);
  const sleptNights = inHouse.reduce((n, x) => n + sim.nightsSlept(s, x), 0);
  const bookedNights = inHouse.reduce((n, x) => n + x.nights, 0);
  must(sleptNights < bookedNights, 'expected somebody to be partway through their stay');
  const r = sim.offlineCatchUp(s, 120);
  must(r.settled > 0, 'nobody was settled');
  must(r.settled < everyBookedNight,
    `settled ${r.settled} against ${everyBookedNight} of booked nights for ${inHouse.length} guests`);
});

await step('a catch-up rolls the day over when it crosses midnight', async () => {
  // Regression: whole days were added first and the remainder modulo'd, which
  // threw away any midnight the fractional part crossed.
  const s = sim.newHotel();
  s.cash = 60000;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  for (const role of ['clerk', 'housekeeper', 'maintenance', 'bellhop']) sim.hire(s, role);
  s.clock = 23 * 60;
  const day0 = s.day;
  sim.offlineCatchUp(s, data.DAY_SECONDS * 0.5);      // half a day, from 11pm
  must(s.day === day0 + 1, `day did not roll: ${day0} -> ${s.day} at ${(s.clock / 60).toFixed(1)}h`);
  must(s.clock >= 0 && s.clock < 1440, `clock out of range: ${s.clock}`);

  const s2 = sim.newHotel();
  s2.clock = 60;
  const d2 = s2.day;
  sim.offlineCatchUp(s2, data.DAY_SECONDS * 0.2);     // early morning, no midnight
  must(s2.day === d2, `day rolled when it should not have: ${d2} -> ${s2.day}`);
});

await step('commands refuse what you cannot afford', async () => {
  const s = sim.newHotel();
  s.cash = 0;
  must(!sim.buildRoom(s).ok, 'built a room with no money');
  must(!sim.hire(s, 'clerk').ok, 'hired with no money');
  must(!sim.buyAmenity(s, 'pool').ok, 'bought a pool with no money');
  must(!sim.addFloor(s).ok, 'added a floor with unbuilt slots');
  s.cash = 999999;
  for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
  must(sim.addFloor(s).ok, 'could not add a floor with everything built');
  for (let i = 0; i < data.MAX_FLOORS + 2; i++) {
    for (const r of s.rooms) { r.built = true; r.state = 'empty'; }
    sim.addFloor(s);
  }
  must(s.floors === data.MAX_FLOORS, `floors ran past the cap: ${s.floors}`);
  must(sim.builtRooms(s).length <= data.MAX_ROOMS, 'too many rooms');
});

// ------------------------------------------------------------------ balance
const daysArg = process.argv.indexOf('--days');
if (daysArg > 0) {
  const days = Number(process.argv[daysArg + 1] || 30);
  console.log(`\n--- greedy auto-player, ${days} days ---`);
  console.log('day   cash   rooms staff  stars  occ   revenue  walkouts  note');
  const s = sim.newHotel({ name: 'Balance Test Motel' });
  s.youAuto = true;
  let lastDay = 1;
  let note = '';
  const CORE = ['housekeeper', 'clerk', 'bellhop', 'maintenance'];
  for (let i = 0; i < days * data.DAY_SECONDS * 10 + 10; i++) {
    sim.stepSim(s, 0.1, () => {});
    if (s.day !== lastDay) {
      const y = s.yesterday || {};
      const rev = (y.revenue || 0) + (y.incidentals || 0) + (y.tips || 0);
      console.log(
        `${String(lastDay).padStart(3)} ${sim.money(s.cash).padStart(8)} ${String(sim.builtRooms(s).length).padStart(5)} ${String(s.staff.length).padStart(5)}  ${sim.starRating(s).toFixed(2)}  ${(sim.occupancy(s) * 100).toFixed(0).padStart(3)}% ${sim.money(rev).padStart(8)} ${String(y.walkouts || 0).padStart(8)}  ${note}`,
      );
      note = '';
      lastDay = s.day;

      // Rooms first — they are what everything else multiplies — then the crew,
      // then whatever amenity is cheapest, keeping a few days of payroll in hand.
      const rooms = sim.builtRooms(s).length;
      const reserve = sim.dailyWages(s) * 4 + 350;
      const roomCost = data.roomBuildCost(rooms);
      const missing = CORE.find((r) => !s.staff.some((x) => x.role === r));
      const build = () => {
        if (s.rooms.some((r) => !r.built)) {
          if (s.cash - roomCost > reserve && sim.buildRoom(s).ok) { note = 'built a room'; return true; }
          return false;
        }
        if (s.cash - data.floorCost(s.floors) > reserve && sim.addFloor(s).ok) { note = 'added a floor'; return true; }
        return false;
      };
      const staffUp = () => {
        if (rooms < 8) return false;
        const want = missing || data.ROLES.map((r) => r.id).find((id) => {
          const have = s.staff.filter((x) => x.role === id).length;
          return have < data.roleCap(id, rooms) && (id !== 'manager' || rooms >= 20);
        });
        if (!want) return false;
        if (s.cash - data.ROLE_BY_ID[want].hire < reserve * 2) return false;
        if (sim.hire(s, want).ok) { note = `hired ${want}`; return true; }
        return false;
      };
      const buy = () => {
        // Do not fritter the float away when a whole floor is nearly in reach.
        const savingForFloor = !s.rooms.some((r) => !r.built) && s.floors < data.MAX_FLOORS
          && s.cash > data.floorCost(s.floors) * 0.45;
        if (savingForFloor) return false;
        const am = data.AMENITIES.filter((a) => !s.amenities[a.id]).sort((a, b) => a.cost - b.cost)[0];
        if (am && s.cash - am.cost > reserve * 2) { sim.buyAmenity(s, am.id); note = `bought ${am.id}`; return true; }
        return false;
      };
      build() || staffUp() || buy();
      if (s.day > days) break;
    }
  }
  const cov = sim.coverage(s);
  console.log(`\nend: ${sim.money(s.cash)} · ${sim.builtRooms(s).length} rooms · ${s.staff.length} staff · ${sim.starRating(s).toFixed(2)}★ · autopilot: ${cov.full}`);
  console.log(`totals: ${s.totals.nights} nights, ${sim.money(s.totals.earned)} earned, ${s.totals.walkouts} walkouts`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall hotel checks passed');
process.exit(failures ? 1 : 0);
