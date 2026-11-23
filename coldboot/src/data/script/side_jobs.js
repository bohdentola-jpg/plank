// Side content — work. Paid shifts you take by asking around (each one a short
// repeatable mission around m.job(kind)):
//
//   job.store    a shift on Koshkin's till (days 3–4; ask Koshkin — day 2's
//                shift is the story's)
//   job.cannery  the fish line at Zarya Seafoods (ask Ray)
//   job.plow     the snowplough route (ask Hank; needs his old Ford, $300)
// Conversations offer these through JOB_TOPICS (merged into each person's menu
// by side_friends.js).
import { SIDE } from './side_town.js';

export const LINES = {
  // ---- Koshkin: shifts on the till
  'sj.k.offer': { who: 'koshkin', en: "You want hours? I have hours. I don't have money, but I have hours. Ha. Fair wages, and all the tea you can drink." },
  'sj.k.later': { who: 'koshkin', en: "Not today? Fine. The till doesn't run away. It's too old." },
  'sj.k.start': { who: 'koshkin', en: "The till is from nineteen fifty-two. It adds fine, it just takes its time, like me. Customers, you smile. Northstar, you don't smile." },
  'sj.k.end1': { who: 'koshkin', en: 'Good shift. You count money like a Russian. Slowly, twice, and with suspicion.', emo: 'smile' },
  'sj.k.end2': { who: 'koshkin', en: "Mrs. Ivanoff says you're polite. She hasn't said that about anybody since nineteen eighty-four." },
  'sj.k.end3': { who: 'koshkin', en: 'My grandfather opened this store with one barrel of flour and a rifle. You open it with a smile. Is better. Cheaper, too.', emo: 'smile' },
  // ---- Hank: the plough route, the truck
  'sj.h.plow': { who: 'hank', en: "City plough contract's mine, and my back says no. You drive, I pay. Front, Main, Second, Third, then the square. Don't bury the mayor's car." },
  'sj.h.notruck': { who: 'hank', en: "Plough needs a truck under it. I've got an old Ford out back. Three hundred, and she starts most mornings." },
  'sj.h.sold': { who: 'hank', en: "There. Keys. She pulls left and the heater's a rumour. Don't let Northstar's boys sell you one of their electric things. Battery dies at minus twenty." },
  'sj.h.broke': { who: 'hank', en: "Three hundred, friend. I don't do layaway. I did layaway once. I'm still waiting." },
  'sj.h.end1': { who: 'hank', en: "Streets are clear. Folks noticed. Here's your cut. It's what the city pays me, minus what I pay me." },
  'sj.h.end2': { who: 'hank', en: "You missed a mailbox on Second. I mean you didn't miss it. You hit it. It's fine. It was ugly." },
  // ---- Ray: the cannery line
  'sj.r.offer': { who: 'ray', en: "Line's short again. Company laid off six guys in September, now they wonder why the fish pile up. Want a shift? It pays. Not much. It pays." },
  'sj.r.start': { who: 'ray', en: "Gloves on. Keep the salmon, toss the junk, keep your fingers. Lost the tip of my thumb in ninety-nine. Didn't notice till lunch." },
  'sj.r.end1': { who: 'ray', en: "Not bad. Keep up with the line, the guys stop calling you the carpenter. Then they call you the other carpenter. That's progress." },
  'sj.r.end2': { who: 'ray', en: "Good shift. Company'll still say we're losing money. They say that every year, from a boat in Seattle." },
  // ---- the team
  'sj.n.job': { who: 'nadia', ru: 'Работа — лучшая легенда. Чем больше тебя видят за работой, тем меньше к тебе присматриваются.', en: 'Work is the best cover. The more they see you working, the less closely they look at you.' },
  'sj.g.plow': { who: 'grisha', ru: 'Плуг! Вот это техника. Только в гавань не съезжай.', en: "A snowplough! Now that's machinery. Just don't drive it into the harbour.", emo: 'laugh' },
};

// ------------------------------------------------------------------ who offers what
const hasTruck = (c) => c.has('hasTruck') || c.hasItem('truck_key') || c.hasItem('truck');
const today = (c, k) => c.flag(`job.${k}.day`) === c.day;
const between = (c, a, b) => c.hour >= a && c.hour < b;

async function offer(c, who, line, job, yes, no) {
  await c.say(who, line);
  const k = await c.choose([yes, no]);
  if (k !== 0) return false;
  c.flag(`job.${job}.day`, c.day);
  c.start('job.' + job);
  if (c.flag('sj.n.job.heard') !== true) { c.flag('sj.n.job.heard', true); c.G.missions?.ear?.('sj.n.job'); }
  return true;
}

export const JOB_TOPICS = {
  koshkin: [{
    label: 'Got any hours on the till today?',
    when: (c) => c.day >= 3 && c.day <= 4 && between(c, 8, 17) && !today(c, 'store'),
    run: async (c) => { if (!await offer(c, 'koshkin', 'sj.k.offer', 'store', 'Put me on the till.', 'Not today.')) await c.say('koshkin', 'sj.k.later'); },
  }],
  hank: [{
    label: 'Need the plough route done?',
    when: (c) => c.day >= 2 && c.day <= 4 && between(c, 6, 17) && !today(c, 'plow'),
    run: async (c) => {
      if (!hasTruck(c)) {
        await c.say('hank', 'sj.h.notruck');
        const k = await c.choose(['Sold. ($300)', 'Too rich for me.']);
        if (k !== 0) return;
        if (c.state.money < 300) { await c.say('hank', 'sj.h.broke'); return; }
        c.money(-300, 'the old Ford');
        c.give('truck_key');
        c.flag('hasTruck', true);
        c.rel(4);
        await c.say('hank', 'sj.h.sold');
      }
      await offer(c, 'hank', 'sj.h.plow', 'plow', "I'll take the route.", 'Another day.');
    },
  }],
  ray: [{
    label: 'Need another pair of hands on the line?',
    when: (c) => c.day >= 2 && c.day <= 4 && between(c, 6, 15) && !today(c, 'cannery'),
    run: (c) => offer(c, 'ray', 'sj.r.offer', 'cannery', 'Put me on the line.', 'Maybe tomorrow.'),
  }],
};

// ------------------------------------------------------------------ the shift wrapper
/**
 * One paid shift: an objective and a spot at the workplace (gone if the day
 * ends first), an opening line the first time, the job's minigame, wages, and
 * a little friendship / standing.
 */
async function shift(m, from, J) {
  const G = m.G, s = G.state, F = s.flags, day = s.day;
  if (m.cp(1, from)) {
    SIDE.obj(m, J.obj, J.where, J.sub);
    await Promise.race([m.spot('work', SIDE.at(G, J.where), J.prompt, 3), m.until(() => s.day !== day)]);
    G.interact?.remove?.(`${m.id}:work`);
    if (s.day !== day) { G.hud?.toast?.('MISSED SHIFT', J.title); SIDE.finish(m); return; }
  }
  if (m.cp(2, from)) {
    SIDE.clear(m);
    const n = Number(F[J.count]) || 0;
    if (!n && J.first) await SIDE.say(m, J.npc, J.first);
    if (J.ear && SIDE.once(G, J.ear + '.heard')) m.ear(J.ear);
    const earned = await m.job(J.kind, J.opts || {});
    m.money(earned, J.why);
    F[J.count] = n + 1;
    if (J.rel) SIDE.rel(G, J.npc, J.rel);
    if (J.spirit) SIDE.spirit(G, J.spirit);
    if (J.standing) SIDE.standing(G, J.standing);
    if (J.calm) SIDE.calm(G, J.calm);
    G.missions.emit?.('job:' + J.kind);
    await SIDE.say(m, J.npc, J.ends[n % J.ends.length]);
  }
  SIDE.finish(m);
}

export const MISSIONS = {
  'job.store': {
    title: "A Shift at Koshkin's",
    run: (m, from) => shift(m, from, {
      title: "A Shift at Koshkin's", kind: 'store', npc: 'koshkin', where: 'koshkin.counter', obj: "Work the till at Koshkin's", sub: 'Church Square, before closing',
      prompt: 'Start your shift', count: 'job.store.n', first: 'sj.k.start', ends: ['sj.k.end1', 'sj.k.end2', 'sj.k.end3'],
      why: "wages, Koshkin's", rel: 3, calm: 2, opts: { customers: 4 },
    }),
    onDone: SIDE.again('job.store'),
  },
  'job.plow': {
    title: 'The Plough Route',
    run: (m, from) => shift(m, from, {
      title: 'The Plough Route', kind: 'plow', npc: 'hank', where: 'hardware', obj: 'Plough the town streets', sub: "Pick up the blade in Hank's yard",
      prompt: 'Hitch the plough and go', count: 'job.plow.n', ear: 'sj.g.plow', ends: ['sj.h.end1', 'sj.h.end2'],
      why: 'the plough route', rel: 2, spirit: 2, standing: 1,
    }),
    onDone: SIDE.again('job.plow'),
  },
  'job.cannery': {
    title: 'The Cannery Line',
    run: (m, from) => shift(m, from, {
      title: 'The Cannery Line', kind: 'cannery', npc: 'ray', where: 'cannery', obj: 'Clock in at Zarya Seafoods', sub: 'Cannery Road, ask for Ray',
      prompt: 'Take a place on the line', count: 'job.cannery.n', first: 'sj.r.start', ends: ['sj.r.end1', 'sj.r.end2'],
      why: 'Zarya Seafoods', rel: 4, standing: 1,
    }),
    onDone: SIDE.again('job.cannery'),
  },
};

export const DIALOG = {};
export const DIALOG_OVERRIDE = true;
