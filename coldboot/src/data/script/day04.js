// DAY 4 — Ears Everywhere (Thursday). Grisha's "fish crate" comes in on Wade's
// mail plane: smoked sockeye on top, Lyosha's bugs underneath. Dolly knows City
// Hall lost its cleaner; Walt hires Rybka for the afternoon. Mop, sweep — and
// plant a keypad logger by the stairs and bugs under the council table and in
// the mayor's office, while Gideon Shaw minds the front desk. At eight, the
// mayor's office bug catches Shaw asking Walt about the council's sealed
// "continuity cards": the mayor's key plus any three cards. Baba Valya knows
// that trick: Shamir. Field hack 'keypad'. Optional encounters: smoked salmon
// for Dolly and Koshkin, Pearl's questions about the crate. Night School lesson 4.
//
// ---------------------------------------------------------------- repairs used
//   none today.
//
// ---------------------------------------------------------------- flags set
//   d4.crateOpened  the crate is open: inv fish ×3, bug ×3, keypad_logger ×1
//   cityhallJanitor Walt hired Rybka to clean City Hall (Thursdays, if anyone needs a reason to be inside)
//   bug.keypad / bug.chamber / bug.mayor   what is planted in City Hall (Lyosha hears the chamber and the mayor's office)
//   knowsContinuityCards / knowsShares  the team knows: the mayor's key + any 3 of the 5 council
//                   continuity cards (Shamir shares) open Halloran's vault
//   doorCode        '4471' — the City Hall upstairs keypad code (from the 'keypad' hack)
//   d4.paintingHint Walt said the painting behind his desk is "crooked on purpose" (the wall safe)
//   d4.fish.<id>    Rybka gave Grisha's smoked salmon to dolly / koshkin / pearl / ruth (side task 'd4.fish')
//   (Wade only shows off the Dragonfly today; his lessons are side_friends.js: flight1..3.)
//   inv after today: bug ×1 spare (three came in the crate, two are planted), mop.
import {
  at, yawTo, dist, cu, spirit, place, warp, release, hold, hack, idle,
} from './day02.js';

export const DAY = { n: 4, start: ['d4.crate'], mustFinish: ['d4.crate', 'd4.cityhall', 'd4.ears'] };

export const LINES = {
  // ---- the earpiece: the crate
  'd4.n.morning': { who: 'nadia', ru: 'Гриша прислал посылку. Ящик рыбы, почтовым самолётом из Нома. Уэйд прилетает около десяти.', en: 'Grisha sent a parcel. A crate of fish, on the mail plane from Nome. Wade lands around ten.' },
  'd4.gr.hello': { who: 'grisha', ru: 'Рыбка! Это я! Рыбу — съешь. А то, что под рыбой, — не ешь!', en: "Rybka! It's me! The fish — eat it. What's under the fish — don't eat that!", emo: 'laugh' },
  'd4.n.grisha': { who: 'nadia', ru: 'Гриша. Канал.', en: 'Grisha. The channel.', emo: 'frown' },
  'd4.gr.sorry': { who: 'grisha', ru: 'Молчу, молчу.', en: "I'm quiet. I'm quiet." },
  'd4.n.home': { who: 'nadia', ru: 'Не открывай на людях. Только дома.', en: "Don't open it in public. Only at home." },
  'd4.gr.fish': { who: 'grisha', ru: 'Ну как? Копчёная нерка от моего шурина. Лучшая на всей Чукотке!', en: 'Well? Smoked sockeye from my brother-in-law. The best in all Chukotka!', emo: 'smile' },
  'd4.l.bugs': { who: 'lyosha', ru: 'Под рыбой — три жучка и логгер для кодового замка. Я их сам паял. Только не урони в рыбу.', en: "Under the fish: three bugs and a logger for a keypad. I soldered them myself. Just don't drop them in the fish." },
  'd4.n.reason': { who: 'nadia', ru: 'Теперь нам нужен повод войти в мэрию. Надолго и без лишних вопросов.', en: 'Now we need a reason to be inside City Hall. For a long time, with no questions asked.' },
  'd4.n.dolly': { who: 'nadia', ru: 'Спроси у Долли. Долли знает всё и про всех.', en: 'Ask Dolly. Dolly knows everything about everyone.' },
  'd4.gr.share': { who: 'grisha', ru: 'И рыбу людям раздай. Кто ел твою рыбу — тот тебе друг. Это закон.', en: "And share the fish around. Whoever has eaten your fish is your friend. That's the law.", emo: 'smile' },
  'd4.gr.door': { who: 'grisha', ru: 'Правильно! Рыба открывает любые двери!', en: 'That\'s it! Fish opens every door!', emo: 'laugh' },

  // ---- the earpiece: City Hall
  'd4.n.hired': { who: 'nadia', ru: 'Отлично. Второй этаж с кодовым замком — значит, всё интересное там. Логгер — на клавиатуру у лестницы.', en: 'Excellent. A second floor with a keypad means the interesting things are up there. The logger goes on the keypad by the stairs.' },
  'd4.n.shaw': { who: 'nadia', ru: 'Шоу у стойки. Он то смотрит на лестницу, то отворачивается. Лови момент. Глаз на экране подскажет.', en: "Shaw's at the front desk. He keeps glancing at the stairs, then looking away. Pick your moment. The eye on your screen will tell you.", emo: 'serious' },
  'd4.n.clean': { who: 'nadia', ru: 'И мой по-настоящему. Уборщик, который не убирает, — подозрительный уборщик.', en: "And mop for real. A janitor who doesn't clean is a suspicious janitor." },
  'd4.l.keypad': { who: 'lyosha', ru: 'Логгер стоит. Каждый, кто наберёт код, теперь наш.', en: 'The logger is in. Everyone who types the code is ours now.', emo: 'smile' },
  'd4.l.chamber': { who: 'lyosha', ru: 'Под столом совета тихо, и там никто никогда не убирает. Кроме тебя.', en: 'Under the council table. Nice and quiet, and nobody ever cleans there. Except you.' },
  'd4.n.office': { who: 'nadia', ru: 'Мэр ушёл. Кабинет заперт. У тебя минуты две, не больше.', en: "The mayor's gone. The office is locked. You have two minutes, no more.", emo: 'serious' },
  'd4.n.office2': { who: 'nadia', ru: 'Снова ушёл. Второй шанс. Не трать его.', en: "He's out again. Second chance. Don't waste it." },
  'd4.n.back': { who: 'nadia', ru: 'Мэр возвращается! Уходи из кабинета!', en: "The mayor's coming back! Get out of the office!", emo: 'worry' },
  'd4.n.missed': { who: 'nadia', ru: 'Не успели. Ничего. Подождём, пока он снова уйдёт. Помой пока что-нибудь.', en: "Didn't make it. Never mind. We'll wait for him to leave again. Mop something in the meantime." },
  'd4.n.caught': { who: 'nadia', ru: 'Спокойно. Ты уборщик. Уборщики заходят куда угодно.', en: "Easy. You're the janitor. Janitors go anywhere." },
  'd4.l.mayor': { who: 'lyosha', ru: 'Есть. Слышу, как тикают его часы. Очень громкие часы.', en: 'Got it. I can hear his clock ticking. A very loud clock.' },
  'd4.n.done': { who: 'nadia', ru: 'Три уха в мэрии. Хорошая работа, Рыбка. Теперь забирай деньги — и домой, как ни в чём не бывало.', en: 'Three ears in City Hall. Good work, Rybka. Now collect your pay and go home as if nothing happened.', emo: 'smile' },

  // ---- the earpiece: the evening
  'd4.n.wait': { who: 'nadia', ru: 'Жучки работают. Лёша пишет всё. Теперь ждём. Люди любят поговорить, когда думают, что они одни.', en: "The bugs are working. Lyosha's recording everything. Now we wait. People love to talk when they think they're alone." },
  'd4.l.live': { who: 'lyosha', ru: 'Кто-то в кабинете мэра. Восемь вечера. Вывожу тебе в ухо.', en: "Someone's in the mayor's office. Eight in the evening. Patching it through to your ear.", emo: 'serious' },
  'd4.l.cards': { who: 'lyosha', ru: 'Слышишь? Ключ мэра и любые три карточки из пяти. Это же…', en: "You hear that? The mayor's key and any three cards of five. That's…", emo: 'surprise' },
  'd4.v.shamir': { who: 'valya', ru: 'Шамир. Разделение секрета. Пять кусочков: любые три открывают дверь, а два ничего не значат. Красиво. Я такое делала в семьдесят четвёртом, только на бумаге.', en: 'Shamir. Secret sharing. Five pieces: any three open the door, and two mean nothing at all. Beautiful. I did this in seventy-four, only on paper.', emo: 'smile' },
  'd4.n.cards': { who: 'nadia', ru: 'Значит, ключ от хранилища Хэллоран разделил между членами совета. А они даже не знают, что хранят.', en: "So Halloran split the vault key between the council members. And they don't even know what they're keeping.", emo: 'serious' },
  'd4.dm.ladder': { who: 'dmitri', ru: 'Вот и лестница. Мэр — и трое из пяти. Тихо, Рыбка. Ступенька за ступенькой.', en: 'There is our ladder. The mayor, and three of five. Quietly, Rybka. One step at a time.', emo: 'serious' },
  'd4.v.eat': { who: 'valya', ru: 'А теперь иди поешь. Гриша же рыбу прислал.', en: "And now go and eat something. Grisha sent fish, didn't he?", emo: 'smile' },
  'd4.gr.fish2': { who: 'grisha', ru: 'Вот! Хоть кто-то про рыбу помнит!', en: 'There! At least somebody remembers the fish!', emo: 'laugh' },
  'd4.l.logger': { who: 'lyosha', ru: 'И ещё логгер. Он записал все коды, что сегодня набирали у лестницы. Люди промахиваются, шума много. Нужен самый частый код.', en: 'And the logger. It recorded every code typed by the stairs today. People fat-finger it, so it is noisy. We want the most common code.' },
  'd4.l.retry': { who: 'lyosha', ru: 'Не горит. Лог подождёт. Ноутбук — дома, на столе.', en: 'No rush. The log will keep. The laptop is at home, on the table.' },
  'd4.l.code': { who: 'lyosha', ru: 'Четыре-четыре-семь-один. Запомни. Такие люди меняют коды раз в десять лет.', en: 'Four, four, seven, one. Remember it. People like that change their codes once a decade.', emo: 'smile' },
  'd4.v.code': { who: 'valya', ru: 'А один-восемь-два-два кто набирал? Год основания города. Сентиментальный кто-то.', en: 'And who typed one, eight, two, two? The year the town was founded. Somebody is sentimental.', emo: 'smile' },
  'd4.n.lesson': { who: 'nadia', ru: 'А теперь урок. Лёша сегодня особенно доволен собой.', en: 'And now, the lesson. Lyosha is especially pleased with himself tonight.' },
  'd4.l.lesson': { who: 'lyosha', ru: 'Сегодня — условия. «Если камера смотрит — молчим». Ты весь день так и делаешь, так что будет легко.', en: "Tonight: conditions. 'If the camera's watching, keep quiet.' You've been doing exactly that all day, so it'll be easy.", emo: 'smile' },
  'd4.n.night': { who: 'nadia', ru: 'У нас появились уши. Завтра — рыбный вечер. Спокойной ночи, Рыбка.', en: 'We have ears now. Tomorrow, the fish fry. Good night, Rybka.', emo: 'smile' },

  // ---- the mayor's office, eight o'clock (the bug)
  'd4.bug.w1': { who: 'walt', en: "Gideon, it's eight o'clock. My wife thinks I'm having an affair with this building." },
  'd4.bug.g1': { who: 'gideon', en: "This won't take long. Mr. Halloran asked me to confirm the continuity cards. All five. Sealed, unopened, in each member's possession." },
  'd4.bug.w2': { who: 'walt', en: "Those envelopes? Lord. Dolly keeps hers in the pie safe. Hank's is probably in a coffee can with the bolts." },
  'd4.bug.g2': { who: 'gideon', en: "Then remind them. Municipal emergency protocol. Your key and any three of the cards. That's what it takes." },
  'd4.bug.w3': { who: 'walt', en: "Takes to do what, Gideon? Every time I ask what's in that vault up on the hill, you tell me 'continuity'." },
  'd4.bug.g3': { who: 'gideon', en: "Because that's what it is, Walt. Continuity. Sign here. And here. Thank you. Good night, Mr. Mayor." },
  'd4.bug.w4': { who: 'walt', en: 'Yeah. Good night.', emo: 'worry' },

  // ---- Wade and the crate; the first lesson
  'd4.wd.crate1': { who: 'wade', en: 'Morning! Got a crate with your name on it. Came in on the Nome run. Bering Smokehouse. Smells like a fish died happy in there.', emo: 'smile' },
  'd4.wd.crate2': { who: 'wade', en: "Customs in Nome didn't open it. I think they were scared to. Here. Sign nothing, I don't do paperwork." },
  'd4.wd.helo': { who: 'wade', en: "That's the Dragonfly in there, by the way. Prettiest ugly helicopter in Alaska. Ask me about lessons sometime. Bring a stomach.", emo: 'smile' },
  'd4.wd.idle': { who: 'wade', en: "Plane's back at two. Got a sack of mail and a moose head for the Petrovs. Don't ask." },

  // ---- Dolly, Walt, Gideon: the cleaning job
  'd4.d.job1': { who: 'dolly', en: 'City Hall? Funny you ask. Bev Kaplan cleaned that place for thirty years. Her daughter had twins in Fairbanks, and off she went.' },
  'd4.d.job2': { who: 'dolly', en: "Walt's been emptying his own trash for two weeks. You should see his office. Actually, no, you shouldn't. Go see him. Tell him Dolly sent you." },
  'd4.d.fish': { who: 'dolly', en: "Smoked sockeye? Oh, honey. That's the real stuff. You've got good friends. Bring them by sometime, I'll feed them.", emo: 'smile' },
  'd4.d.idle': { who: 'dolly', en: "Thursday. Pot roast. Walt comes in at noon on the dot. You could set a clock by that man's stomach." },
  'd4.wt.hire1': { who: 'walt', en: 'Dolly sent you? Bless that woman. Look at this place. I found a sandwich in the council chamber from the Fourth of July.' },
  'd4.wt.hire2': { who: 'walt', en: "Fifteen an hour, cash. Mop, trash, the chamber. And stay off the second floor. Gideon's particular about upstairs. Keypad and everything." },
  'd4.wt.twenty': { who: 'walt', en: "Twenty? Ha! Okay, okay. Seventeen. Don't tell Lyle, he'll want a raise, and he doesn't even work here.", emo: 'laugh' },
  'd4.wt.pie': { who: 'walt', en: "I'm off to Dolly's for a slice. Office locks itself, so don't bother with it. It's clean enough. It isn't. But it's enough." },
  'd4.wt.pie2': { who: 'walt', en: "Lyle wants me at the diner. Again. If anybody calls, I'm in a meeting. The meeting is pie." },
  'd4.wt.caught': { who: 'walt', en: "Oh! You're in here. The door was locked, wasn't it? Hm. Must not have caught. That lock's older than I am.", emo: 'surprise' },
  'd4.wt.dust': { who: 'walt', en: 'Ha! Don\'t I know it. My wife says the same about the garage.', emo: 'laugh' },
  'd4.wt.sorry': { who: 'walt', en: 'No harm done. Just don\'t touch the painting behind my desk. It\'s crooked on purpose. Don\'t ask.' },
  'd4.wt.pay': { who: 'walt', en: "Look at this place. You can see the harbour through the chamber windows again. Here's your money. Cash. Come back next Thursday, if you like." },
  'd4.wt.painting': { who: 'walt', en: "Oh, and if you ever do my office, don't straighten the painting behind my desk. It's crooked on purpose. Don't ask." },
  'd4.wt.idle': { who: 'walt', en: 'Long day. They all are. Go home, have a hot supper.' },
  'd4.gi.janitor': { who: 'gideon', en: "Oh. The janitor. Of course. Walt mentioned. Please don't touch anything upstairs. Or on my desk. Or near my desk.", emo: 'smile' },
  'd4.gi.idle': { who: 'gideon', en: "You missed a spot. I'm joking. Mostly.", emo: 'smile' },
  'd4.gi.later': { who: 'gideon', en: 'Thank you for the windows. I can see the Dome from my office now. Beautiful, isn\'t it?', emo: 'smile' },

  // ---- around town
  'd4.k.fish': { who: 'koshkin', en: 'Kopchyonaya nerka? Where did you get this? Smoked sockeye, with alder. My grandmother made it like this. You have good friends, kid.', emo: 'smile' },
  'd4.k.idle': { who: 'koshkin', en: 'Thursday. Delivery day. The truck from Nome is late. The truck from Nome is always late.' },
  'd4.h.janitor': { who: 'hank', en: "Heard you're mopping City Hall now. Handyman, shopkeeper, janitor. You collecting jobs like stamps?" },
  'd4.h.idle': { who: 'hank', en: "Thursday's when the fuel barge would come, back when the barge came. Now it's trucks and Northstar paperwork." },
  'd4.r.gideon': { who: 'ruth', en: "Gideon came by my house last night with papers to sign. Something about a card I keep for emergencies. I told him I'd read them first. He didn't like that.", emo: 'frown' },
  'd4.r.idle': { who: 'ruth', en: 'Teachers never retire. We just stop getting paid.' },
  'd4.ra.hello': { who: 'ray', en: 'Thursday. Payday. Company paid us six hours short. A glitch, they said. Funny how the glitch never pays us extra.', emo: 'frown' },
  'd4.ly.glasses': { who: 'lyle', en: "City Hall's new janitor! Wonderful. If you find my reading glasses, they're in the chamber somewhere. I take them off when I'm pretending to listen.", emo: 'smile' },
  'd4.e.hello': { who: 'evan', en: "Love the new job! City Hall cleaning crew. We carry an amazing line of cleaning supplies, by the way. Very discreet.", emo: 'smile' },
  'd4.m.hello': { who: 'marta', en: 'Saw you going into City Hall with a bucket. Times are hard, huh? Or you just like being inside government buildings.' },
  'd4.p.crate': { who: 'pearl', en: 'A crate of fish from Nome for you. Wade told me. Wade tells me everything. So who is your fish friend?' },
  'd4.p.ship': { who: 'pearl', en: "Shipmates. The best kind. They've seen you at your worst, and they still send fish.", emo: 'smile' },
  'd4.p.admirer': { who: 'pearl', en: 'Ooh. Fish is serious up here, sugar. Fish means somebody is thinking about you.', emo: 'laugh' },
  'd4.p.fish': { who: 'pearl', en: 'For me? Oh, sugar. Smoked sockeye. Now I have to like you. Those are the rules.', emo: 'laugh' },
  'd4.r.fish': { who: 'ruth', en: "Alder-smoked. My mother smoked fish like this out on the point. I haven't tasted it since nineteen seventy. Thank you, dear.", emo: 'smile' },
  'd4.lo.won': { who: 'lou', en: "You took the trivia pot last night! Ray hasn't stopped sulking. Best night of my week.", emo: 'laugh' },
  'd4.p.idle': { who: 'pearl', en: 'Thursday. The Nome plane brings the mail, and I bring the news. Somebody has to.' },
  'd4.g.hello': { who: 'gabriel', en: "Thursday I visit the sick. Today it's Mrs. Ivanoff's knees and Sasha Koshkin's pride. The knees are getting better." },
  'd4.el.koshkin': { who: 'ellen', en: "Sasha came in this morning. Finally. His heart sounds like a washing machine full of shoes. He laughed. I didn't.", emo: 'worry' },
  'd4.ni.hello': { who: 'nina', en: "Thursday's request night. Somebody requested the Northstar jingle. I said no. I have principles. Six of them." },
  'd4.t.hello': { who: 'tommy', en: 'Two days till the race. I tuned my sled last night. It sounds like an angry bee now. Perfect.', emo: 'smile' },
  'd4.lo.hello': { who: 'lou', en: "Thursday. Quiet night. Ray's sulking about trivia, Hank's gloating. Same as every Thursday, really." },
};

// ---------------------------------------------------------------- City Hall
const CLEAN = [
  { key: 'mop', flag: 'd4.t.mop', where: 'cityhall.chamber', prompt: 'Mop the council chamber', short: 'mop the chamber', game: 'paint', title: 'MOP THE COUNCIL CHAMBER', verb: 'MOP' },
  { key: 'sweep', flag: 'd4.t.sweep', where: 'cityhall.clerk', prompt: 'Empty the bins and sweep the lobby', short: 'sweep the lobby', game: 'shovel', title: 'SWEEP THE LOBBY', verb: 'SWEEP' },
  { key: 'keypad', flag: 'bug.keypad', where: 'cityhall.stairs', prompt: 'Wipe the keypad (fit the logger)', short: 'the keypad by the stairs', game: 'wire', title: 'FIT THE KEYPAD LOGGER', act: 0.6, item: 'keypad_logger', line: 'd4.l.keypad' },
  { key: 'chamber', flag: 'bug.chamber', where: 'cityhall.councilTable', prompt: 'Dust under the council table (plant a bug)', short: 'under the council table', game: 'wire', title: 'PLANT THE BUG', act: 0.5, item: 'bug', line: 'd4.l.chamber' },
];

/** Run tasks at their spots, in any order the player likes. */
async function anyOrder(m, tasks, label, doTask) {
  const G = m.G;
  const open = {};
  for (let guard = 0; guard < 40; guard++) {
    const todo = tasks.filter((t) => !m.flag(t.flag));
    if (!todo.length) break;
    const near = todo.slice().sort((a, b) => dist(G, a.where) - dist(G, b.where))[0];
    m.obj(label(todo.length), near.where, todo.map((t) => t.short).join(' · '));
    for (const t of todo) if (!open[t.key]) open[t.key] = m.spot(t.key, t.where, t.prompt, 2.4).then(() => t);
    const t = await Promise.race(todo.map((x) => open[x.key]));
    delete open[t.key];
    await doTask(t);
    m.flag(t.flag, true);
  }
}

/** Gideon at the front desk: watches the stairs for a few seconds, then looks back into the building. */
function shawAtTheDesk(m, isOn) {
  const G = m.G, s = G.state;
  const desk = at(G, 'cityhall.reception');
  const toStairs = yawTo(desk, at(G, 'cityhall.stairs'));
  warp(G, 'gideon', desk);
  return m.until(() => {
    if (!isOn()) return true;
    const n = G.npcs?.get?.('gideon');
    if (n?.goal) n.goal.yaw = s.stats.playSeconds % 13 < 5.5 ? toStairs : desk.rot;
    return false;
  });
}

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd4.crate': {
    title: 'Special Delivery', main: true, day: 4,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Meet the mail plane at the airstrip';
        m.obj(text, 'hangar', 'Tolliver Air — Wade lands around ten');
        m.ears(['d4.n.morning', 'd4.gr.hello', 'd4.n.grisha', 'd4.gr.sorry']);
        await hold(m, () => {
          const w = G.npcs?.get?.('wade'), apron = at(G, 'hangar.apron');
          if (w?.pos && !w.scripted && dist(G, 'hangar') < 60 && (w.hidden || Math.hypot(w.pos.x - apron.x, w.pos.z - apron.z) > 30)) warp(G, 'wade', apron);
          return !!m.flag('d4.w.crate');
        }, text, 'hangar');
        release(G, 'wade');
        m.ear('d4.n.home');
      }
      if (m.cp(2, from)) {
        const text = 'Open the crate at home';
        m.obj(text, 'cabin.table', 'Not in public');
        await m.spot('crate', 'cabin.table', 'Open the fish crate', 2.2);
        await m.minigame('saw', { title: 'PRY OPEN THE CRATE', verb: 'PRY' });
        s.inv.fish_crate = 0;
        s.inv.fish = (s.inv.fish || 0) + 3;
        s.inv.bug = (s.inv.bug || 0) + 3;
        s.inv.keypad_logger = (s.inv.keypad_logger || 0) + 1;
        G.hud?.toast?.('ITEM', 'Smoked salmon ×3 — and, under it, three bugs and a keypad logger');
        m.flag('d4.crateOpened', true);
        await m.ears(['d4.gr.fish', 'd4.l.bugs', 'd4.n.reason', 'd4.n.dolly']);
        m.done();
        m.start('d4.fish');
        m.start('d4.cityhall');
      }
    },
  },

  'd4.cityhall': {
    title: 'Clean Sweep', main: true, day: 4,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Ask Dolly about work at City Hall';
        m.obj(text, 'diner.counter', 'The Midnight Sun Diner');
        await hold(m, () => !!m.flag('d4.d.job'), text, 'diner.counter');
      }
      if (m.cp(2, from)) {
        const text = 'Talk to Mayor Hennessey at City Hall';
        place(G, 'walt', at(G, 'cityhall.mayorDesk'));
        m.obj(text, 'cityhall.mayorOffice', 'His office, behind the lobby');
        await hold(m, () => !!m.flag('cityhallJanitor'), text, 'cityhall.mayorOffice');
        await m.ear('d4.n.hired');
      }
      if (m.cp(3, from)) {
        let on = true;
        const gaze = shawAtTheDesk(m, () => on);
        m.ears(['d4.n.shaw', 'd4.n.clean']);
        await anyOrder(m, CLEAN, (n) => `Clean City Hall — ${n} to go`, async (t) => {
          if (t.act) G.attention.act(t.act, 7);
          await m.minigame(t.game, { title: t.title, verb: t.verb });
          if (t.item) s.inv[t.item] = Math.max(0, (s.inv[t.item] || 1) - 1);
          else G.attention.add(-2); // honest work
          if (t.line) m.ear(t.line);
        });
        await theMayorsOffice(m);
        on = false;
        await gaze;
        release(G, 'gideon');
        await m.ear('d4.n.done');
      }
      if (m.cp(4, from)) {
        place(G, 'walt', at(G, 'cityhall.mayorDesk'));
        const text = 'Collect your pay from the mayor';
        m.obj(text, 'cityhall.mayorOffice');
        await hold(m, () => !!m.flag('d4.paid'), text, 'cityhall.mayorOffice');
        release(G, 'walt');
        m.done();
        m.start('d4.ears');
      }
    },
  },

  'd4.ears': {
    title: 'Ears Everywhere', main: true, day: 4,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Go home and wait for the evening';
        m.obj(text, 'cabin', 'The bugs are listening');
        m.ear('d4.n.wait');
        await hold(m, () => s.hour >= 19.9 || s.hour < 4, text, 'cabin');
        m.clear();
        await m.ear('d4.l.live');
        G.sfx?.staticBurst?.(0.4);
        await m.ears(['d4.bug.w1', 'd4.bug.g1', 'd4.bug.w2', 'd4.bug.g2', 'd4.bug.w3', 'd4.bug.g3', 'd4.bug.w4']);
        G.sfx?.staticBurst?.(0.25);
      }
      if (m.cp(2, from)) {
        await m.ears(['d4.l.cards', 'd4.v.shamir', 'd4.n.cards', 'd4.dm.ladder', 'd4.v.eat', 'd4.gr.fish2']);
        m.flag('knowsContinuityCards', true);
        m.flag('knowsShares', true); // days 8–9 read this one
      }
      if (m.cp(3, from)) {
        await m.ear('d4.l.logger');
        await hack(m, 'keypad', 'cabin.table', 'Open the keypad log', 'd4.l.retry');
        m.flag('doorCode', '4471');
        await m.ears(['d4.l.code', 'd4.v.code']);
      }
      if (m.cp(4, from)) {
        m.ears(['d4.n.lesson', 'd4.l.lesson']);
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop');
        await hold(m, () => !!s.lessons.l04, text, 'cabin.laptop');
        await m.ear('d4.n.night');
        m.done();
      }
    },
  },

  // optional: share Grisha's three smoked sockeye (Dolly, Koshkin, Pearl, Ruth — offered in conversation)
  'd4.fish': {
    title: "Grisha's Fish", day: 4,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        await m.wait(6);
        m.ear('d4.gr.share');
        const given = () => ['dolly', 'koshkin', 'pearl', 'ruth'].filter((id) => m.flag('d4.fish.' + id)).length;
        await m.until(() => given() >= 3 || !(s.inv.fish > 0) || s.day > 4);
        if (given() >= 2) {
          m.ear('d4.gr.door');
          spirit(G, 3, "Grisha's fish");
        }
        m.done();
      }
    },
  },
};

// The mayor steps out (for pie). His office locks; the bug goes under his desk
// before he's back. Missed? He goes out again later.
async function theMayorsOffice(m) {
  const G = m.G, s = G.state;
  const office = at(G, 'cityhall.mayorOffice');
  const desk = at(G, 'cityhall.mayorDesk');
  for (let w = 0; w < 6 && !m.flag('bug.mayor'); w++) {
    // Walt goes out
    await m.scene(async (d) => {
      await d.bring('walt', office);
      await d.say('walt', w ? 'd4.wt.pie2' : 'd4.wt.pie', { cam: cu(d, 'walt') });
    });
    place(G, 'walt', at(G, 'diner.door'));
    m.ear(w ? 'd4.n.office2' : 'd4.n.office');
    const deadline = s.stats.playSeconds + (w ? 150 : 115);
    let open = true;
    const work = (async () => {
      m.obj("Pick the lock of the mayor's office", 'cityhall.mayorOffice', "Plant a bug before he's back");
      await m.spot('lock', 'cityhall.mayorOffice', 'Pick the lock', 2);
      if (!open) return false;
      G.attention.act(0.5, 6);
      await m.minigame('lock', { title: "THE MAYOR'S DOOR" });
      if (!open) return false;
      m.obj('Plant a bug under the desk', 'cityhall.mayorDesk', "Quick — he's at Dolly's");
      await m.spot('desk', 'cityhall.mayorDesk', 'Plant a bug under the desk', 2);
      if (!open) return false;
      G.attention.act(0.4, 6);
      await m.minigame('wire', { title: 'PLANT THE BUG' });
      s.inv.bug = Math.max(0, (s.inv.bug || 1) - 1);
      m.flag('bug.mayor', true);
      m.ear('d4.l.mayor');
      m.obj('Get out of the office', 'cityhall.reception');
      await m.until(() => dist(G, desk) > 4.5);
      return true;
    })();
    const res = await Promise.race([work, m.until(() => s.stats.playSeconds > deadline).then(() => 'late')]);
    if (res !== 'late') continue; // planted and out: done
    open = false;
    G.interact?.remove?.(`${m.id}:lock`);
    G.interact?.remove?.(`${m.id}:desk`);
    warp(G, 'walt', at(G, 'cityhall.door_in'));
    place(G, 'walt', desk);
    m.ear('d4.n.back');
    if (dist(G, desk) < 4.5) {
      // caught in his office
      G.attention.add(4);
      await m.scene(async (d) => {
        await d.bring('walt', office);
        await d.say('walt', 'd4.wt.caught', { cam: cu(d, 'walt') });
        const k = await d.choose(['"Dusting. Your shelves are a disgrace, Mr. Mayor."', '"The door was open. I\'m sorry."']);
        await d.say('walt', k === 0 ? 'd4.wt.dust' : 'd4.wt.sorry', { cam: cu(d, 'walt', { side: -1 }) });
        if (k === 1) m.flag('d4.paintingHint', true);
        await d.say('nadia', 'd4.n.caught', { radio: true });
      });
    } else await m.ear('d4.n.missed');
    if (m.flag('bug.mayor')) break;
    m.obj('Look busy until the mayor goes out again', 'cityhall.chamber');
    const until = s.stats.playSeconds + 45;
    await m.until(() => s.stats.playSeconds > until);
  }
  release(G, 'walt');
}

// ---------------------------------------------------------------- conversations
export const DIALOG = {
  wade: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (!c.flag('d4.w.crate')) {
      await c.say('wade', 'd4.wd.crate1');
      await c.say('wade', 'd4.wd.crate2');
      c.give('fish_crate');
      c.rel(3);
      c.flag('d4.w.crate', true);
      c.emit('talk:wade');
      await c.say('wade', 'd4.wd.helo');
      return;
    }
    return idle(c, prev, 'wade', 'd4.wd.idle');
  },

  dolly: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.flag('d4.crateOpened') && !c.flag('d4.d.job')) {
      await c.say('dolly', 'd4.d.job1');
      await c.say('dolly', 'd4.d.job2');
      await offerFish(c, 'dolly', 'd4.d.fish');
      c.flag('d4.d.job', true);
      c.emit('talk:dolly');
      return;
    }
    return idle(c, prev, 'dolly', 'd4.d.idle');
  },

  walt: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.flag('d4.d.job') && !c.flag('cityhallJanitor')) {
      await c.say('walt', 'd4.wt.hire1');
      await c.say('walt', 'd4.wt.hire2');
      const k = await c.choose(['Deal.', 'Make it twenty.']);
      if (k === 1) { await c.say('walt', 'd4.wt.twenty'); c.flag('d4.wage', 17); } else { c.flag('d4.wage', 15); c.rel(3); }
      c.give('mop');
      c.flag('cityhallJanitor', true);
      c.emit('talk:walt');
      return;
    }
    if (c.flag('bug.mayor') && !c.flag('d4.paid')) {
      await c.say('walt', 'd4.wt.pay');
      c.money((c.flag('d4.wage') === 17 ? 17 : 15) * 4, 'cleaning City Hall');
      if (!c.flag('d4.paintingHint')) { await c.say('walt', 'd4.wt.painting'); c.flag('d4.paintingHint', true); }
      c.rel(5);
      c.flag('d4.paid', true);
      c.emit('talk:walt');
      return;
    }
    return idle(c, prev, 'walt', 'd4.wt.idle');
  },

  gideon: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.flag('cityhallJanitor') && !c.flag('d4.gi.hi')) { c.flag('d4.gi.hi', true); await c.say('gideon', 'd4.gi.janitor'); c.attention(2); return; }
    if (c.flag('d4.paid')) return idle(c, prev, 'gideon', 'd4.gi.later');
    return idle(c, prev, 'gideon', 'd4.gi.idle');
  },

  koshkin: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (await offerFish(c, 'koshkin', 'd4.k.fish')) return;
    return idle(c, prev, 'koshkin', 'd4.k.idle');
  },

  pearl: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.flag('d4.w.crate') && !c.flag('d4.p.crate')) {
      c.flag('d4.p.crate', true);
      await c.say('pearl', 'd4.p.crate');
      const k = await c.choose(['An old shipmate.', 'A secret admirer.']);
      await c.say('pearl', k === 0 ? 'd4.p.ship' : 'd4.p.admirer');
      c.rel(3);
      await offerFish(c, 'pearl', 'd4.p.fish');
      return;
    }
    if (await offerFish(c, 'pearl', 'd4.p.fish')) return;
    return idle(c, prev, 'pearl', 'd4.p.idle');
  },

  hank: async (c, prev) => (c.day === 4 ? idle(c, prev, 'hank', c.flag('cityhallJanitor') ? 'd4.h.janitor' : 'd4.h.idle') : prev(c)),
  ruth: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (!c.flag('d4.r.hi')) { c.flag('d4.r.hi', true); await c.say('ruth', 'd4.r.gideon'); c.rel(2); await offerFish(c, 'ruth', 'd4.r.fish'); return; }
    if (await offerFish(c, 'ruth', 'd4.r.fish')) return;
    return idle(c, prev, 'ruth', 'd4.r.idle');
  },
  ray: async (c, prev) => (c.day === 4 ? idle(c, prev, 'ray', 'd4.ra.hello') : prev(c)),
  lyle: async (c, prev) => (c.day === 4 ? idle(c, prev, 'lyle', 'd4.ly.glasses') : prev(c)),
  evan: async (c, prev) => (c.day === 4 ? idle(c, prev, 'evan', 'd4.e.hello') : prev(c)),
  marta: async (c, prev) => (c.day === 4 ? idle(c, prev, 'marta', 'd4.m.hello') : prev(c)),
  gabriel: async (c, prev) => (c.day === 4 ? idle(c, prev, 'gabriel', 'd4.g.hello') : prev(c)),
  ellen: async (c, prev) => (c.day === 4 ? idle(c, prev, 'ellen', 'd4.el.koshkin') : prev(c)),
  nina: async (c, prev) => (c.day === 4 ? idle(c, prev, 'nina', 'd4.ni.hello') : prev(c)),
  tommy: async (c, prev) => (c.day === 4 ? idle(c, prev, 'tommy', 'd4.t.hello') : prev(c)),
  lou: async (c, prev) => (c.day === 4 ? idle(c, prev, 'lou', c.flag('d3.trivia') === 'won' ? 'd4.lo.won' : 'd4.lo.hello') : prev(c)),
};

// Grisha's smoked sockeye: offered once to each of Dolly, Koshkin, Pearl and Ruth (three to go round).
async function offerFish(c, id, line) {
  if (!c.hasItem('fish') || c.flag('d4.fish.' + id) || c.flag('d4.fishAsked.' + id)) return false;
  c.flag('d4.fishAsked.' + id, true);
  const k = await c.choose(['Have some smoked salmon. From a friend.', 'Not now.']);
  if (k !== 0 || !c.take('fish')) return false;
  await c.say(id, line);
  c.rel(8);
  c.flag('d4.fish.' + id, true);
  c.emit('fish:' + id);
  return true;
}

export const DIALOG_OVERRIDE = true;
