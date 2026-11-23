// Side content — work. Paid shifts you take by asking around (each one a short
// repeatable mission around m.job(kind)), and from the day Koshkin goes to the
// hospital in Nome: running his store yourself, one day at a time, with his
// phone calls, the regulars, and Evan Pike dropping by to "help".
//
//   job.store    a shift on Koshkin's till (days 2–4; ask Koshkin)
//   job.plow     the snowplough route (ask Hank; needs the truck)
//   job.cannery  the fish line at Zarya Seafoods (ask Ray)
//   job.radio    the evening show on KZRY (ask Nina)
//   job.shop     Koshkin's, open: a daily spot at the counter once the story
//                sets flag runStore (from day 7; the story runs day 6 itself)
// Conversations offer these through JOB_TOPICS (merged into each person's menu
// by side_friends.js).
import { SIDE } from './side_town.js';

export const LINES = {
  // ---- Koshkin: shifts on the till (days 2–4)
  'sj.k.offer': { who: 'koshkin', en: "You want hours? I have hours. I don't have money, but I have hours. Ha. Fair wages, and all the tea you can drink." },
  'sj.k.later': { who: 'koshkin', en: "Not today? Fine. The till doesn't run away. It's too old." },
  'sj.k.start': { who: 'koshkin', en: "The till is from nineteen fifty-two. It adds fine, it just takes its time, like me. Customers, you smile. Northstar, you don't smile." },
  'sj.k.end1': { who: 'koshkin', en: "Good shift. You count money like a Russian. Slowly, twice, and with suspicion.", emo: 'smile' },
  'sj.k.end2': { who: 'koshkin', en: "Mrs. Ivanoff says you're polite. She hasn't said that about anybody since nineteen eighty-four." },
  'sj.k.end3': { who: 'koshkin', en: "My grandfather opened this store with one barrel of flour and a rifle. You open it with a smile. Is better. Cheaper, too.", emo: 'smile' },
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
  // ---- Nina: the evening show
  'sj.n.offer': { who: 'nina', en: "Can you cover the evening show? I have a calculus test. I mean, I have a nap. The nap is for the calculus." },
  'sj.n.start': { who: 'nina', en: "Mic's live when the red light's on. Callers want songs, give them songs. Do not, under any circumstances, play polka for Father Gabriel." },
  'sj.n.end1': { who: 'nina', en: "Hey, it's me, calling in! Hank phoned the station to say you were not terrible. That's a five-star review from Hank.", emo: 'laugh' },
  'sj.n.end2': { who: 'nina', en: "It's me again. My mom listened to your whole show in the patrol car. She said, who is that, in the suspicious voice. So, congratulations." },
  // ---- the team
  'sj.n.job': { who: 'nadia', ru: 'Работа — лучшая легенда. Чем больше тебя видят за работой, тем меньше к тебе присматриваются.', en: 'Work is the best cover. The more they see you working, the less closely they look at you.' },
  'sj.l.radio': { who: 'lyosha', ru: 'Ты в эфире? Я слушаю через ретранслятор! Поставь что-нибудь нормальное, а?', en: "You're on the air? I'm listening through the relay! Put on something decent, would you?", emo: 'laugh' },
  'sj.g.plow': { who: 'grisha', ru: 'Снегоочиститель! Вот это техника. Только в гавань не съезжай.', en: "A snowplough! Now that's machinery. Just don't drive it into the harbour.", emo: 'laugh' },
  'sj.v.shop': { who: 'valya', ru: 'Магазин теперь на тебе? Главное правило: в долг не давай тем, кто слишком широко улыбается.', en: 'The store is on you now? Rule number one: never give credit to anyone who smiles too wide.', emo: 'smile' },
  'sj.n.evan': { who: 'nadia', ru: 'Он проверяет тебя. Не злись. Злость — это для него информация.', en: "He's testing you. Don't get angry. To him, anger is information.", emo: 'serious' },

  // ---- Koshkin's, open: Koshkin on the phone from the hospital in Nome
  'sj.k.call0a': { who: 'koshkin', en: "Hello? Is this my store? Good. The nurses took my shoes so I cannot escape. Who is at the till? You? Good. Don't sell the good tea to Evan." },
  'sj.k.call0b': { who: 'koshkin', en: "And the cash drawer sticks. You kick it, left side, low. Like a mule. Gently. It's an old mule." },
  'sj.k.call1': { who: 'koshkin', en: "They feed me Jell-O. Green. Like a traffic light. My mother made kisel. Real food. The doctor says, that's nice, Mr. Koshkin. Bah." },
  'sj.k.call2a': { who: 'koshkin', en: "Golubchik! Evan came to visit me. Here. In Nome. With flowers from his store. I gave them to the nurse. The nurse gave them to the cat." },
  'sj.k.call2b': { who: 'koshkin', en: "Even the cat said nyet. And who was minding his store while he was here? Nobody? A robot? I think a robot.", emo: 'laugh' },
  'sj.k.call3': { who: 'koshkin', en: "Listen. If Mrs. Nanouk asks for the tab, the tab is yes. Always yes. Jimmy lost his job. That is not business. That is Port Zarya." },
  'sj.k.call4': { who: 'koshkin', en: "Golubchik, lying here, you think. More than a hundred years, Koshkin's. Grandfather, father, me. Now you. Is strange. Is good strange." },
  'sj.k.call5': { who: 'koshkin', en: "Doctor says I go home soon. Maybe. Maybe is doctor for no. Don't let the stove go out. The stove is older than me and in better health." },
  'sj.k.call6': { who: 'koshkin', en: "Pearl calls me every day with the news. Pearl knows more about you than you do. Be careful, golubchik. Come home safe every night. That's all." },
  // ---- the regulars
  'sj.c.ivanoff1': { who: 'f6', en: "Two white candles, dear. For my Pavel. He would be ninety-four today. He would have hated it." },
  'sj.c.ivanoff2': { who: 'f6', en: "Koshkin always gives me my change in a little paper bag. You don't have a little bag? I'll bring one next time." },
  'sj.c.mike': { who: 'm4', en: "Coffee and batteries. Went to Northstar yesterday. Their coffee tastes like a phone. I don't know how. It just does." },
  'sj.c.ruth': { who: 'ruth', en: "Black tea, the Russian kind. Sasha's grandfather sold my grandmother this same tea in nineteen twenty. Same tin, too, I'd wager.", emo: 'smile' },
  'sj.c.nanouk1': { who: 'f5', en: "Milk, bread and the cheap coffee. Could you put it on the tab? Koshkin always does. Jimmy's still looking for work." },
  'sj.c.nanouk2': { who: 'f5', en: "Thank you. Really. Tell Sasha we'll settle up the minute Jimmy's working. He knows we're good for it." },
  'sj.c.nanouk3': { who: 'f5', en: "No, no, I understand. It's not your store. I'll manage. We always manage." },
  'sj.c.tommy': { who: 'tommy', en: "Batteries, four, and a chocolate bar. And you didn't see me buy the chocolate bar. Grandma thinks I'm in training.", emo: 'laugh' },
  'sj.c.pearl': { who: 'pearl', en: "A postcard came for the store. From Sasha, in Nome. It says, and I quote, tell the carpenter, the stove. That's the whole postcard. I didn't read it." },
  'sj.c.ivanoff3': { who: 'f6', en: "I brought you pirozhki. Cabbage. Sasha says you're too thin. I say you're just young. Eat them warm." },
  // ---- Evan undercutting you
  'sj.e.flyer': { who: 'evan', en: "Hi, neighbour! Just dropping off a flyer. Milk, a dollar ninety-nine, all week. Isn't that crazy? I think it's crazy.", emo: 'smile' },
  'sj.e.offer': { who: 'evan', en: "Northstar would love to make an offer on this building. Very generous. Mr. Koshkin would never have to worry about anything again. Ever.", emo: 'smile' },
  'sj.e.offer2': { who: 'evan', en: "That's not a threat! It's economics. Everything's for sale. Have a wonderful day." },
  'sj.e.cards': { who: 'evan', en: "Funny thing. Your customers all have Northstar loyalty cards. Every single one. We just want what's best for them. Same as you!", emo: 'smile' },
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
    when: (c) => c.day >= 2 && c.day <= 4 && !c.has('koshkinHospital') && between(c, 8, 17) && (c.day > 2 || c.hour >= 12) && !today(c, 'store'),
    run: async (c) => { if (!await offer(c, 'koshkin', 'sj.k.offer', 'store', "Put me on the till.", 'Not today.')) await c.say('koshkin', 'sj.k.later'); },
  }],
  hank: [{
    label: 'Need the plough route done?',
    when: (c) => c.day >= 2 && between(c, 6, 17) && !today(c, 'plow'),
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
    when: (c) => c.day >= 2 && between(c, 6, 15) && !today(c, 'cannery'),
    run: (c) => offer(c, 'ray', 'sj.r.offer', 'cannery', 'Put me on the line.', 'Maybe tomorrow.'),
  }],
  nina: [{
    label: 'Want me to cover the evening show?',
    when: (c) => c.day >= 2 && between(c, 15, 20) && !today(c, 'radio'),
    run: (c) => offer(c, 'nina', 'sj.n.offer', 'radio', "Go. I've got the mic.", 'Not tonight.'),
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
    await SIDE.say(m, J.npc, J.ends[n % J.ends.length], { phone: J.phoneEnd });
  }
  SIDE.finish(m);
}

// ------------------------------------------------------------------ Koshkin's, open
const CALLS = [['sj.k.call0a', 'sj.k.call0b'], ['sj.k.call1'], ['sj.k.call2a', 'sj.k.call2b'], ['sj.k.call3'], ['sj.k.call4'], ['sj.k.call5'], ['sj.k.call6']];
const REGULARS = [
  { who: 'f6', lines: ['sj.c.ivanoff1', 'sj.c.ivanoff2'] },
  { who: 'm4', lines: ['sj.c.mike'] },
  { who: 'ruth', lines: ['sj.c.ruth'], cast: true },
  { who: 'f5', lines: ['sj.c.nanouk1'], tab: true },
  { who: 'tommy', lines: ['sj.c.tommy'], cast: true },
  { who: 'pearl', lines: ['sj.c.pearl'], cast: true },
  { who: 'f6', lines: ['sj.c.ivanoff3'], gift: true },
];
const EVAN = { 1: ['sj.e.flyer'], 3: ['sj.e.offer', 'sj.e.offer2'], 5: ['sj.e.cards'] };

async function storeDay(m, n) {
  const G = m.G;
  await m.scene(async (d) => {
    await d.bring('player', 'koshkin.clerk');
    d.cam(d.closeUp('player', { side: 1, dist: 1.2 }));
    await d.wait(0.5);
    for (const l of CALLS[n % CALLS.length]) await d.say('koshkin', l, { radio: true });
    const R = REGULARS[n % REGULARS.length];
    if (R.cast) { await d.bring(R.who, SIDE.mark(G, 'koshkin.counter')); d.cam(d.overShoulder('player', R.who)); }
    for (const l of R.lines) await d.say(R.who, l);
    if (R.tab) {
      const k = await d.choose(["Put it on Koshkin's tab.", "Sorry. Cash only while he's away."]);
      if (k === 0) { await d.say('f5', 'sj.c.nanouk2'); G.state.flags['shop.tab'] = (Number(G.state.flags['shop.tab']) || 0) + 12; SIDE.spirit(G, 2); }
      else await d.say('f5', 'sj.c.nanouk3');
    }
    if (R.gift) SIDE.rel(G, 'koshkin', 2);
    const ev = EVAN[n];
    if (ev) {
      await d.bring('evan', SIDE.mark(G, 'koshkin.door_in', -1.5, 2));
      d.cam(d.overShoulder('player', 'evan'));
      for (const l of ev) await d.say('evan', l);
      if (SIDE.once(G, 'sj.n.evan.heard')) await d.say('nadia', 'sj.n.evan', { radio: true });
    }
  });
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
      title: 'The Cannery Line', kind: 'cannery', npc: 'ray', where: 'cannery', obj: 'Clock in at Zarya Seafoods', sub: 'Cannery Rd, ask for Ray',
      prompt: 'Take a place on the line', count: 'job.cannery.n', first: 'sj.r.start', ends: ['sj.r.end1', 'sj.r.end2'],
      why: 'Zarya Seafoods', rel: 3, standing: 1,
    }),
    onDone: SIDE.again('job.cannery'),
  },
  'job.radio': {
    title: 'KZRY After Dark',
    run: (m, from) => shift(m, from, {
      title: 'KZRY After Dark', kind: 'radio', npc: 'nina', where: 'radio.console', obj: 'Cover the evening show', sub: 'KZRY 88.9, the studio',
      prompt: 'Go on the air', count: 'job.radio.n', first: 'sj.n.start', ear: 'sj.l.radio', ends: ['sj.n.end1', 'sj.n.end2'], phoneEnd: true,
      why: 'KZRY community radio', rel: 3, spirit: 2, calm: 1,
    }),
    onDone: SIDE.again('job.radio'),
  },
  // Started by side_friends.js conversations once runStore is set (day 7+).
  'job.shop': {
    title: 'Minding the Store',
    async run(m, from) {
      const G = m.G, s = G.state, F = s.flags;
      for (let guard = 0; guard < 16; guard++) {
        if (F.koshkinBack || s.day > 14) break;
        const day = s.day, base = 100 + day * 10;
        if (m.cp(base + 1, from) && F['shop.day'] !== day) {
          await Promise.race([m.spot('open', SIDE.at(G, 'koshkin.counter'), "Open Koshkin's for the day", 3), m.until(() => s.day !== day || F.koshkinBack)]);
          G.interact?.remove?.(`${m.id}:open`);
        }
        if (s.day === day && F['shop.day'] !== day && !F.koshkinBack && m.cp(base + 2, from)) {
          const n = Number(F['shop.n']) || 0;
          if (SIDE.once(G, 'sj.v.shop.heard')) m.ear('sj.v.shop');
          await storeDay(m, n);
          const earned = await m.job('shop');
          m.money(earned, "Koshkin's takings");
          F['shop.day'] = day;
          F['shop.n'] = n + 1;
          SIDE.rel(G, 'koshkin', 2);
          SIDE.spirit(G, 1);
          SIDE.calm(G, 3);
          if (n % 2 === 1) SIDE.standing(G, 1);
          G.missions.emit?.('job:shop');
        }
        if (m.cp(base + 3, from)) await m.until(() => s.day !== day || F.koshkinBack);
      }
      SIDE.finish(m);
    },
  },
};

export const DIALOG = {};
export const DIALOG_OVERRIDE = true;
