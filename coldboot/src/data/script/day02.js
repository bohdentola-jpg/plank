// DAY 2 (Tuesday) — Cover. A shift on Koshkin's till; meet the council before
// tonight (Dolly at the diner, Ruth at the post office, Lyle at City Hall);
// the seven o'clock council meeting, where Gideon Shaw pitches Northstar's
// "Phase Two" and Rybka photographs the dais; Chief Kowalczyk at the door; a
// grey car with its lights off on the way home (Mr. Grey); Lyosha's face
// matcher (field hack 'faces'); Night School lesson 2 (conditions).
//
// flags: d2.comment ('cams' | 'fix' | 'yes' | 'none'), phaseTwoTabled,
//   d2.faces, d3.lookedAtGrey (stared at Mr. Grey), d2.rayHeard (Ray at the
//   Anchor: "one of these days I'm just going to quit"), cabinRoofFixed.
import {
  at, yawTo, dist, cu, shot, rel, standing, warp, release, stage, keepTime, cap, waitFor, hold, meet, passTime, hack, idle,
} from './kit.js';
import { workOrder, SIDE } from './side_town.js';

export const DAY = { n: 2, start: ['d2.shift'], mustFinish: ['d2.shift', 'd2.council'] };

export const LINES = {
  // ---- the earpiece
  'd2.n.morning': { who: 'nadia', ru: 'Доброе утро, Рыбка. Сегодня — первая смена у Кошкина. Плотник, который стоит за прилавком, — прикрытие, которому верят.', en: "Morning, Rybka. Today, your first shift at Koshkin's. A carpenter who works the counter — that's a cover people believe." },
  'd2.l.morning': { who: 'lyosha', ru: 'А вечером — совет города. Я поставил тебе на телефон распознавание лиц. Главное — держи камеру ровно.', en: 'And tonight, the town council. I put face recognition on your phone. Just hold the camera steady.' },
  'd2.n.late': { who: 'nadia', ru: 'Уже десятый час. Кошкин давно открылся. Опаздывать в первый день — плохая примета.', en: "It's past nine. Koshkin opened ages ago. Being late on your first day is bad luck." },
  'd2.n.shift': { who: 'nadia', ru: 'Неплохо для первого дня. Старик к тебе теплеет. Это хорошо — и для прикрытия, и просто так.', en: "Not bad for a first day. The old man's warming to you. That's good — for the cover, and just in general.", emo: 'smile' },
  'd2.n.council': { who: 'nadia', ru: 'Совет — в семь, в мэрии. До тех пор погуляй по городу. Долли, Хэнк, Рут, Рэй, Лайл — запомни лица заранее.', en: 'Council is at seven, at City Hall. Until then, walk around town. Dolly, Hank, Ruth, Ray, Lyle — learn their faces in advance.' },
  'd2.l.photo': { who: 'lyosha', ru: 'Есть. Лица пошли. Держи ровно… ещё секунду… Всё, снято.', en: "Got it. Faces coming in. Hold it steady… one more second… That's it, done." },
  'd2.n.seen': { who: 'nadia', ru: 'Шоу посмотрел в твою сторону. Опусти телефон. Медленно.', en: 'Shaw just looked your way. Lower the phone. Slowly.', emo: 'worry' },
  'd2.n.wait': { who: 'nadia', ru: 'Правильно. Подожди, пока все будут смотреть на кого-нибудь другого.', en: 'Good call. Wait until everyone is looking at someone else.' },
  'd2.n.nowphoto': { who: 'nadia', ru: 'Вот сейчас. Все смотрят на Рут. Поднимай телефон.', en: "Now. Everyone's watching Ruth. Raise the phone." },
  'd2.n.speech.cams': { who: 'nadia', ru: 'Хороший вопрос. Только теперь Шоу запомнил твоё лицо. Больше так не высовывайся.', en: "Good question. Only now Shaw remembers your face. Don't stick your neck out like that again.", emo: 'serious' },
  'd2.n.speech.fix': { who: 'nadia', ru: 'Вот это по-нашему. Этот город любит тех, кто чинит.', en: 'Now that is our way. This town loves the people who fix things.', emo: 'smile' },
  'd2.n.speech.yes': { who: 'nadia', ru: 'Хитро. Пусть думают, что ты на их стороне.', en: "Clever. Let them think you're on their side." },
  'd2.n.marta': { who: 'nadia', ru: 'Начальница полиции. Говорят, честная. Честные — самые опасные.', en: 'The police chief. Honest, they say. The honest ones are the most dangerous.' },
  'd2.l.walk': { who: 'lyosha', ru: 'Только не здесь — над дверью камера «Нордстара». Отойди подальше, тогда запускай.', en: "Not here — there's a Northstar camera over the door. Walk away first, then run it." },
  'd2.l.hack': { who: 'lyosha', ru: 'Фотографии загрузились. Мой распознаватель сделал всё, кроме одной строчки. Она твоя.', en: 'The photos are up. My matcher did everything except one line. That one is yours.' },
  'd2.l.retry': { who: 'lyosha', ru: 'Ничего страшного. Вернёмся к этому, когда захочешь. Ноутбук дома, на столе.', en: "No big deal. We'll come back to it whenever you like. The laptop's at home, on the table." },
  'd2.l.four': { who: 'lyosha', ru: 'Четыре! Четыре из пяти. Пятый, Моуди, пришёл уже после снимков.', en: 'Four! Four out of five. The fifth, Moody, walked in after the photos.', emo: 'smile' },
  'd2.n.four': { who: 'nadia', ru: 'Пять имён, пять лиц. Это нижняя ступенька лестницы, Рыбка.', en: "Five names, five faces. That's the bottom rung of the ladder, Rybka." },
  'd4.n.lesson': { who: 'nadia', ru: 'А теперь урок. Лёша сегодня особенно доволен собой.', en: 'And now, the lesson. Lyosha is especially pleased with himself tonight.' },
  'd4.l.lesson': { who: 'lyosha', ru: 'Сегодня — условия. «Если камера смотрит — молчим». Ты весь день так и делаешь, так что будет легко.', en: "Tonight: conditions. 'If the camera's watching, keep quiet.' You've been doing exactly that all day, so it'll be easy.", emo: 'smile' },
  'd2.n.night': { who: 'nadia', ru: 'Хороший день. Спокойной ночи, Рыбка.', en: 'A good day. Good night, Rybka.', emo: 'smile' },
  'd2.n.gideon': { who: 'nadia', ru: 'Он знает, что ты платишь наличными. Кошкин ему не докладывает. Значит, докладывает кто-то другой.', en: "He knows you pay cash. Koshkin doesn't report to him. So someone else does.", emo: 'serious' },
  'd2.n.evan': { who: 'nadia', ru: 'Лицо уже «в системе». Конечно. Камеры над дверью. Улыбнись и уходи.', en: "Face already 'in the system'. Of course. Cameras over the door. Smile and walk away." },
  'd2.n.roof': { who: 'nadia', ru: 'Крыша — это хорошо. Хозяин, у которого сухо, — довольный хозяин.', en: 'The roof is a good idea. A landlord who stays dry is a happy landlord.' },
  'd2.n.ray': { who: 'nadia', ru: 'Моуди сейчас в «Ржавом якоре». Злой и усталый. Такие часто говорят правду.', en: "Moody's at the Rusty Anchor now. Angry and tired. People like that often tell the truth." },
  // ---- the grey car on the way home
  'd3.n.grey1': { who: 'nadia', ru: 'Стоп. Не оборачивайся. Впереди, у перекрёстка, машина. Фары выключены, мотор работает.', en: "Stop. Don't turn around. Up ahead, by the junction, a car. Lights off, engine running.", emo: 'worry' },
  'd3.n.grey2': { who: 'nadia', ru: 'Серая парка. Это он. Человек из самолёта. Тот, что тебя сфотографировал.', en: "Grey parka. It's him. The man from the plane. The one who took your picture.", emo: 'serious' },
  'd3.l.grey': { who: 'lyosha', ru: 'Номер не читается — весь в снегу. Случайно, конечно. Ага.', en: "Can't read the plate. Caked with snow. By accident, of course. Sure." },
  'd3.n.look': { who: 'nadia', ru: 'Я же сказала — не смотри! Теперь он знает, что ты его видишь.', en: "I said don't look! Now he knows that you see him.", emo: 'angry' },
  'd3.n.grey3': { who: 'nadia', ru: 'Иди мимо. Спокойно. Ты возвращаешься с прогулки. Ничего не замечаешь.', en: "Walk past. Easy. You're coming back from a walk. You notice nothing." },
  'd3.n.grey4': { who: 'nadia', ru: 'Уехал. Он следил за Шоу — или за тобой? Не знаю, что хуже.', en: "He's gone. Was he watching Shaw — or you? I don't know which is worse.", emo: 'worry' },

  // ---- Koshkin
  'd2.k.morning': { who: 'koshkin', en: "You came. And on time. My brother Yuri was never on time in his life. Apron's on the hook. Try not to scare the customers." },
  'd2.k.store': { who: 'koshkin', en: 'Established nineteen eleven. My grandfather built this counter with his own two hands. He sold flour to gold miners. I sell batteries to fishermen. Progress.' },
  'd2.k.till': { who: 'koshkin', en: "Behind the till. Count the change twice, smile once. People here pay cash, and they'll tell you the second you're wrong." },
  'd2.k.grandpa': { who: 'koshkin', en: "Born in Sitka. His father came on a Russian ship and stayed. When the flag changed in sixty-seven, he didn't. Stubborn. It runs in the family.", emo: 'smile' },
  'd2.k.after': { who: 'koshkin', en: "Not bad. You didn't short anybody, and you didn't steal anything. That's better than the last boy I hired." },
  'd2.k.heart': { who: 'koshkin', en: "Don't mind me. Old heart, old knees. Doc Ellen says rest. I say, who'll watch the store? The cat? I don't have a cat." },
  'd2.k.doc': { who: 'koshkin', en: "Ellen sent you to nag me? Ha. Tell her I'm too busy to be sick. Tell her I'll come Friday. Maybe.", emo: 'laugh' },
  'd2.k.yuri': { who: 'koshkin', en: "Yuri used to sit right there by the stove and argue with the radio. He'd have liked you. He liked anybody who showed up on time." },
  'd2.k.hat': { who: 'koshkin', en: "Here. His hat. Ushanka. Don't look at me like that. It's minus twenty, and he doesn't need it anymore." },
  'd2.k.roof': { who: 'koshkin', en: "And the roof. North side. You promised. Hank has shingles. I don't need it pretty, I need it dry." },
  'd2.k.roofOffer': { who: 'koshkin', en: "If you get bored, the cabin roof leaks on the north side. Fix it, and I'll take forty dollars off next week. Fair?" },
  'd2.k.idle': { who: 'koshkin', en: 'Go on, go and see the town. Council is at seven. Sit in the back. The front row gets asked questions.' },
  'd2.k.night': { who: 'koshkin', en: "I heard all about it already. Pearl called. Pearl always calls. Go home and sleep, it's late." },

  // ---- the council meeting
  'd2.c.open': { who: 'walt', en: "All right, folks, let's get going. Tuesday council is in session. The pledge is taken as read, and the coffee is terrible as usual." },
  'd2.c.ray': { who: 'walt', en: "Ray's not here. Again. Dolly, mark him late." },
  'd2.c.ray2': { who: 'dolly', en: "I mark him late every week, Walt. I'm running out of ink.", emo: 'smile' },
  'd2.c.nina': { who: 'nina', en: 'This is KZRY, live from City Hall. The coffee is, quote, terrible. Back to the action.' },
  'd2.c.pitch1': { who: 'gideon', en: 'Thank you, Mayor. Northstar is proud of what we have built here together. Free broadband. Brighter, safer streets. A store that never closes.', emo: 'smile' },
  'd2.c.pitch2': { who: 'gideon', en: "Phase Two is simple. A smart meter in every home. A camera on every streetlight, not just the square. The town's systems, managed from one secure place." },
  'd2.c.pitch3': { who: 'gideon', en: 'Lower heating bills. Faster emergency response. And it costs Port Zarya nothing. Northstar pays for all of it.', emo: 'smile' },
  'd2.c.hank': { who: 'hank', en: "Nothing's free, Gideon. What does Northstar get out of it?", emo: 'frown' },
  'd2.c.hank2': { who: 'gideon', en: "Data, Mr. Brubaker. Anonymous, aggregated data. It makes the grid smarter. That's all." },
  'd2.c.lyle': { who: 'lyle', en: "I think it's a tremendous opportunity, and frankly we'd be crazy to say no. I move we approve Phase Two tonight.", emo: 'smile' },
  'd2.c.ruth1': { who: 'ruth', en: 'I read the contract, Walter. Forty pages. The town systems, managed from where, exactly? That radar dome on Kettle Hill?', emo: 'serious' },
  'd2.c.ruth2': { who: 'gideon', en: 'From a secure facility, Mrs. Aqpik. Some of the finest engineers in the world work there.' },
  'd2.c.ruth3': { who: 'ruth', en: 'My grandmother watched the Russians leave and the Americans come. Every company that bought this town promised it would cost us nothing. It always cost us something.', emo: 'serious' },
  'd2.c.dolly': { who: 'dolly', en: "Ruth, honey, the internet is good. My granddaughter video-calls me from Fairbanks now. I don't know. I just don't know.", emo: 'worry' },
  'd2.c.public': { who: 'walt', en: "All right. Public comment. Anybody from the floor? Don't all rush at once." },
  'd2.c.r.cams': { who: 'gideon', en: "Excellent question. Only authorized Northstar staff, under a very strict privacy policy. I'd be happy to send you a copy. I'll find your address.", emo: 'smile' },
  'd2.c.r.fix': { who: 'hank', en: "Ha. First sensible thing anybody's said tonight. Who's on call when a smart meter freezes at forty below? Not Northstar.", emo: 'laugh' },
  'd2.c.r.fix2': { who: 'gideon', en: 'Northstar provides full remote support, of course.' },
  'd2.c.r.fix3': { who: 'hank', en: 'Remote. Right. Remote from here.' },
  'd2.c.r.yes': { who: 'lyle', en: "See? Even the new folks get it. Thank you, friend. That's the spirit of Port Zarya!", emo: 'smile' },
  'd2.c.r.none': { who: 'walt', en: 'Nobody? Good. Saves time.' },
  'd2.c.ray3': { who: 'ray', en: "Sorry I'm late. Some of us still work for a living. Freezer on line two died again. What'd I miss? Let me guess. Northstar wants something.", emo: 'frown' },
  'd2.c.table': { who: 'ruth', en: "Walter, a vote this big shouldn't happen while a man is still taking his coat off. I move we table it until everyone has read the contract." },
  'd2.c.second': { who: 'ray', en: 'Second. Whatever she said. Second.' },
  'd2.c.vote': { who: 'walt', en: "All in favour of tabling? Ruth. Ray. Dolly? Dolly's hand is up. That's three. Motion's tabled until after the Gala. Sorry, Gideon." },
  'd2.c.patient': { who: 'gideon', en: "Of course, Mayor. Northstar is patient. We'll be right here.", emo: 'smile' },
  'd2.c.close': { who: 'walt', en: 'Meeting adjourned. Somebody unplug the coffee machine before it burns the place down.' },

  // ---- Chief Kowalczyk
  'd2.m.desk': { who: 'marta', en: "Something I can help you with? No? Then I'll get back to my coffee. It's the only thing in this building that doesn't lie to me." },
  'd2.m.stop': { who: 'marta', en: "Hold on a second. Chief Kowalczyk. You're Koshkin's tenant. The carpenter." },
  'd2.m.phone': { who: 'marta', en: 'You had your phone up during the meeting. Taking pictures of the council?', emo: 'serious' },
  'd2.m.notes': { who: 'marta', en: "Huh. Smart. Most people don't care who's who until it's too late." },
  'd2.m.public': { who: 'marta', en: 'It is. And this is a small town. People notice who points cameras at them. Even the folks who point cameras at everybody else.' },
  'd2.m.mother': { who: 'marta', en: "Your mother. Sure. Tell her it's minus twenty and the mayor needs a haircut.", emo: 'smile' },
  'd2.m.bye': { who: 'marta', en: "I'll be seeing you around. That's not a threat. It's a small town." },
  'd2.m.idle': { who: 'marta', en: 'Evening. Get home safe. The ice on Shore Road is worse than it looks.' },

  // ---- Ray & Lou at the Rusty Anchor
  'd2.ra.cannery': { who: 'ray', en: "I've got forty crates going warm and a freezer older than you. Talk later." },
  'd2.ra.hello': { who: 'ray', en: "You were at the meeting. The new one in the back. Sit if you want. Don't if you don't." },
  'd2.ra.late': { who: 'ray', en: 'Freezer on line two died. Again. Northstar sent an efficiency consultant to watch us fix it. He timed my guys going to the bathroom.', emo: 'angry' },
  'd2.ra.drink': { who: 'ray', en: "Ha. Nobody's bought me a drink since the union picnic. Lou, put it on the carpenter's tab.", emo: 'smile' },
  'd2.ra.quit': { who: 'ray', en: "Twelve years on that council. Every year Northstar gets a little more and we get a little less. One of these days I'm just going to quit." },
  'd2.ra.idle': { who: 'ray', en: 'Leave me to my beer, carpenter. Me and the beer have an understanding.' },
  'd2.lo.hello': { who: 'lou', en: "Welcome to the Anchor. Darts on the left, regrets on the right. What'll it be?" },
  'd2.lo.idle': { who: 'lou', en: "Ray's had a day. Be nice to him. Or don't, he won't notice." },

  // ---- around town
  'd2.d.hello': { who: 'dolly', en: "There's my favourite carpenter! You coming tonight? Bring popcorn. Gideon's got a slideshow. Lord help us, he's got a slideshow.", emo: 'laugh' },
  'd2.d.gideon': { who: 'dolly', en: "Gideon? Polite as a funeral director and about as warm. Moved up here two years ago. Never once ordered pie. I don't trust a man who doesn't eat pie." },
  'd2.d.agenda': { who: 'dolly', en: "Phase Two, they call it. More cameras, more gadgets. Half the town wants the free internet, the other half wants to be left alone. I'm in both halves." },
  'd2.d.after': { who: 'dolly', en: "Well! Ray blowing in like a storm, Ruth tabling the whole thing. Best show we've had since the Fourth of July.", emo: 'laugh' },
  'd2.d.idle': { who: 'dolly', en: "Coffee's on. Pie's on. Gossip is free. Sit down, honey." },
  'd2.h.hello': { who: 'hank', en: 'You again. Council is at seven, if you care. Bring a cushion. Those chairs were bought used in nineteen seventy-one.' },
  'd2.h.idle': { who: 'hank', en: "Shingles, nails, rope, fuel. I'm open till six. Don't make me say it twice." },
  'd2.r.hello': { who: 'ruth', en: "You must be Sasha Koshkin's new tenant. Ruth Aqpik. I taught school here for forty-one years. I know every face in town, and yours is new." },
  'd2.r.manners': { who: 'ruth', en: 'Manners. Somebody raised you right. Come to the meeting tonight. Somebody in that room ought to be listening.', emo: 'smile' },
  'd2.r.northstar': { who: 'ruth', en: 'I think a company that names itself after a star wants you looking up, not at what it is doing. Come to the meeting tonight. Listen.' },
  'd2.r.idle': { who: 'ruth', en: "Seven o'clock. Sit where you can see Gideon's hands. He talks with them when he's lying." },
  'd2.ly.hello': { who: 'lyle', en: "Lyle Pruitt, Pruitt Insurance and Realty. Welcome to Port Zarya! Renting the Koshkin cabin? You'll want renter's insurance. Those old cabins go up like kindling.", emo: 'smile' },
  'd2.ly.card': { who: 'lyle', en: "Here's my card. Insurance, real estate, notary public. I'm also on the council. And between you and me, I won't be on the council forever." },
  'd2.ly.idle': { who: 'lyle', en: 'Think about that insurance. Fire, flood, bears. Mostly bears.' },
  'd2.wt.hello': { who: 'walt', en: 'Walt Hennessey. Mayor, for my sins. Welcome, welcome! Gideon handles the paperwork, I handle the handshakes. Firm grip. Good.', emo: 'smile' },
  'd2.wt.idle': { who: 'walt', en: 'See you at seven. Sit in the back. The front row gets asked to volunteer.' },
  'd2.gi.hello': { who: 'gideon', en: "We haven't been introduced. Gideon Shaw, City Manager. You're renting the Koshkin cabin. Paid cash, I'm told. Welcome to Port Zarya.", emo: 'smile' },
  'd2.gi.idle': { who: 'gideon', en: "Seven o'clock. I'm presenting. I'd love a friendly face in the audience." },
  'd2.e.hello': { who: 'evan', en: "Good morning! Have you tried the Northstar Rewards app? You scan your face at the door, and every tenth coffee is free. Your face is already in the system, so it's super easy!", emo: 'smile' },
  'd2.e.how': { who: 'evan', en: "Oh! The doorway cameras. Totally standard. It's all for your convenience. Have a wonderful day!", emo: 'smile' },
  'd2.e.idle': { who: 'evan', en: 'Back again! We love to see it. Coffee?', emo: 'smile' },
  'd2.p.hello': { who: 'pearl', en: 'Morning, sugar. No mail for you yet. Nobody writes to the new folks the first week. The second week they write. The third week they visit.' },
  'd2.p.tonight': { who: 'pearl', en: 'You going tonight? I always go. Somebody has to keep the minutes honest. Not on paper. In my head.' },
  'd2.g.hello': { who: 'gabriel', en: "My bell-ringer! The whole town's talking. Old Mrs. Ivanoff swears she heard her late husband's voice in it. I didn't argue.", emo: 'smile' },
  'd2.g.chess': { who: 'gabriel', en: 'Do you play chess? Sunday evenings I play with whoever is brave enough. Mostly nobody.' },
  'd2.el.hello': { who: 'ellen', en: "You work for Sasha Koshkin? Then do me a favour. Tell him he's missed his checkup. Twice. He won't listen to me. Maybe he'll listen to you.", emo: 'worry' },
  'd2.el.idle': { who: 'ellen', en: 'Wear a hat. Half this town walks around with frostbitten ears and is proud of it.' },
  'd2.ni.hello': { who: 'nina', en: "Hey. KZRY, eighty-eight point nine. I'm broadcasting the meeting live tonight. All six of our listeners will be thrilled." },
  'd2.t.hello': { who: 'tommy', en: "You're the new handyman? Cool. I race snowmachines. Saturday, Loon Lake. Come watch me win.", emo: 'smile' },
  'd2.wd.hello': { who: 'wade', en: "Hey, carpenter! Settling in? If you ever get bored, I give flying lessons. The first one's half price, because the first one is mostly screaming.", emo: 'laugh' },
};

// Who to meet before the meeting, and where they wait.
const COUNCIL = [
  { id: 'dolly', flag: 'd2.d.hi', where: 'diner.waitress', name: 'Dolly (the diner)' },
  { id: 'ruth', flag: 'd2.r.hi', where: 'post.door', name: 'Ruth (the post office)' },
  { id: 'lyle', flag: 'd2.ly.hi', where: 'cityhall.door', name: 'Lyle (City Hall)' },
];

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd2.shift': {
    title: 'Work Ethic', main: true, day: 2,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 9.3);
        m.ears(['d2.n.morning', 'd2.l.morning']);
        let nag = false;
        await meet(m, 'koshkin', 'koshkin.clerk', 'Open the store with Koshkin', "Koshkin's General Mdse., on the square — 9 am", () => {
          if (!nag && s.hour >= 9.25) { nag = true; m.ear('d2.n.late'); }
          return !!m.flag('d2.k.morning');
        });
      }
      if (m.cp(2, from)) {
        m.clear();
        cap(m, 12.3);
        const t0 = s.hour;
        const earned = await m.job('store', { hours: 3, customers: 5 });
        m.money(earned, 'wages, first shift');
        await passTime(m, t0, 3, 'Three hours behind the till');
        m.flag('d2.shiftDone', true);
      }
      if (m.cp(3, from)) {
        cap(m, 12.8);
        await meet(m, 'koshkin', 'koshkin.clerk', 'Talk to Koshkin', 'He wants a word after the shift', () => !!m.flag('d2.k.after'));
        await m.ear('d2.n.shift');
        m.done();
        m.start('d2.council');
        m.start('jobs.board');
      }
    },
  },

  'd2.council': {
    title: 'The Council', main: true, day: 2,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 17);
        m.ear('d2.n.council');
        const left = () => COUNCIL.filter((p) => !m.flag(p.flag));
        let shown = '';
        await m.until(() => {
          const L = left();
          for (const p of L) {
            const n = G.npcs?.get?.(p.id);
            if (n && !n.scripted && !n.talking) stage(G, p.id, at(G, p.where));
          }
          if (!L.length) return true;
          const next = L.slice().sort((a, b) => dist(G, a.where) - dist(G, b.where))[0];
          const key = next.id + L.length;
          if (key !== shown || !G.hud?.objective) {
            shown = key;
            m.obj(`Meet the council before seven — ${3 - L.length} of 3`, next.where, L.map((p) => p.name).join(' · '));
          }
          return false;
        });
        release(G, ...COUNCIL.map((p) => p.id));
      }
      if (m.cp(2, from)) {
        await waitFor(m, 19, 'Town council — City Hall, 7 pm', 'cityhall.door');
        cap(m, 19.3);
        const text = 'Take a seat in the public gallery';
        m.obj(text, 'cityhall.publicSeats', 'The council chamber, inside City Hall');
        await m.spot('seat', 'cityhall.publicSeats', 'Take a seat', 3);
      }
      if (m.cp(3, from)) {
        m.clear();
        cap(m, 20.5);
        await m.scene((d) => councilMeeting(m, d));
        m.flag('phaseTwoTabled', true);
        m.flag('d2.council.over', true);
        if (!m.flag('d2.comment')) m.flag('d2.comment', 'none');
      }
      if (m.cp(4, from)) {
        cap(m, 21);
        await meet(m, 'marta', at(G, 'cityhall.door', 1.5, 0), 'Chief Kowalczyk wants a word', 'By the City Hall door', () => !!m.flag('d2.m.talked'));
        await m.ear('d2.n.marta');
        m.start('d2.anchor');
      }
      if (m.cp(5, from)) {
        cap(m, 21.5);
        m.ear('d2.l.walk');
        const text = 'Head home — away from the City Hall cameras';
        m.obj(text, 'cabin.door', "Then run Lyosha's face matcher");
        await hold(m, () => dist(G, 'cityhall') > 45, text, 'cabin.door', "Then run Lyosha's face matcher");
        await m.scene((d) => greyCar(m, d));
        m.flag('seenGrey', true);
      }
      if (m.cp(6, from)) {
        await m.ear('d2.l.hack');
        await hack(m, 'faces', 'cabin.table', "Run Lyosha's face matcher", 'd2.l.retry');
        await m.ear('d2.l.four');
        m.ear('d2.n.four');
        m.flag('d2.faces', true);
      }
      if (m.cp(7, from)) {
        cap(m, 23.5);
        m.ears(['d4.n.lesson', 'd4.l.lesson']);
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop', 'Night School · Lesson 2: If the Camera Is Watching');
        await hold(m, () => !!s.lessons.l04, text, 'cabin.laptop', 'Night School · Lesson 2: If the Camera Is Watching');
        await m.ear('d2.n.night');
        m.done();
      }
    },
  },

  // optional: the cabin roof (the rent deal from day 1, or forty dollars off)
  'd2.roof': {
    title: 'The North Side', day: 2,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) m.ear('d2.n.roof');
      await workOrder(m, 'r.koshkin.roof', 10, from);
      if (m.cp(20, from)) {
        m.flag('cabinRoofFixed', true);
        if (!m.flag('fixKoshkinRoof')) m.money(40, "Koshkin: forty off next week's rent");
        rel(G, 'koshkin', 6);
        SIDE.finish(m);
      }
    },
  },

  // optional: Ray Moody nursing a beer after the meeting
  'd2.anchor': {
    title: 'Last Orders', day: 2,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.ear('d2.n.ray');
        if (G.state.day === 2) warp(G, 'ray', at(G, 'bar.stool3'), 'sit');
        SIDE.obj(m, 'Ray Moody is at the Rusty Anchor', 'bar.stool3', 'Optional · Front Street, west');
        await m.until(() => !!m.flag('d2.rayHeard') || G.state.day > 2);
        release(G, 'ray');
        SIDE.finish(m);
      }
    },
  },
};

// The Tuesday council meeting. Ray is late on purpose: the faces hack's photos
// (challenges.js) show four of five council members.
async function councilMeeting(m, d) {
  const G = m.G;
  const seat = (side, fwd) => at(G, 'cityhall.publicSeats', side, fwd);
  d.cam(shot(G, seat(0, -3.2), 2.4, at(G, 'cityhall.councilTable'), 1.2, 50));
  await d.bring('player', seat(0.9, 0.45), { sit: true });
  await d.bring('walt', 'cityhall.councilSeat1', { sit: true });
  await d.bring('dolly', 'cityhall.councilSeat2', { sit: true });
  await d.bring('hank', 'cityhall.councilSeat3', { sit: true });
  await d.bring('ruth', 'cityhall.councilSeat4', { sit: true });
  await d.bring('lyle', 'cityhall.councilSeat6', { sit: true });
  await d.bring('gideon', 'cityhall.podium');
  await d.bring('pearl', seat(-0.9, 1.4), { sit: true });
  await d.bring('gabriel', seat(-1.9, 0.45), { sit: true });
  await d.bring('lou', seat(1.9, 0.45), { sit: true });
  await d.bring('nina', seat(-2.9, -0.5), { sit: true });
  G.sfx?.crowd?.(0.35);
  await d.wait(1.6);
  G.sfx?.crowd?.(0);
  await d.say('walt', 'd2.c.open', { cam: cu(d, 'walt') });
  await d.say('walt', 'd2.c.ray');
  await d.say('dolly', 'd2.c.ray2', { cam: cu(d, 'dolly') });
  await d.say('nina', 'd2.c.nina', { cam: cu(d, 'nina', { side: -1 }) });
  await d.say('gideon', 'd2.c.pitch1', { cam: cu(d, 'gideon') });
  await d.say('gideon', 'd2.c.pitch2');
  // the photos: now, under Shaw's nose, or later while the room watches Ruth
  let photos = false;
  const p = await d.choose(["Raise the phone. Let Lyosha's app see the dais.", 'Wait for a better moment.'], { prompt: 'THE PHOTOS' });
  if (p === 0) {
    photos = true;
    await d.say('lyosha', 'd2.l.photo', { radio: true });
    G.attention.add(5);
    await d.say('nadia', 'd2.n.seen', { radio: true });
  } else await d.say('nadia', 'd2.n.wait', { radio: true });
  await d.say('gideon', 'd2.c.pitch3', { cam: cu(d, 'gideon') });
  await d.say('hank', 'd2.c.hank', { cam: cu(d, 'hank') });
  await d.say('gideon', 'd2.c.hank2', { cam: cu(d, 'gideon', { side: -1 }) });
  await d.say('lyle', 'd2.c.lyle', { cam: cu(d, 'lyle') });
  await d.say('ruth', 'd2.c.ruth1', { cam: cu(d, 'ruth') });
  if (!photos) {
    await d.say('nadia', 'd2.n.nowphoto', { radio: true });
    await d.say('lyosha', 'd2.l.photo', { radio: true });
  }
  await d.say('gideon', 'd2.c.ruth2', { cam: cu(d, 'gideon') });
  await d.say('ruth', 'd2.c.ruth3', { cam: cu(d, 'ruth', { side: -1 }) });
  await d.say('dolly', 'd2.c.dolly', { cam: cu(d, 'dolly') });
  await d.say('walt', 'd2.c.public', { cam: cu(d, 'walt') });
  // public comment
  const k = await d.choose([
    "Stand up: \"Who gets to see what those cameras record?\"",
    "Stand up: \"I fix things for a living. When free things break, who fixes them?\"",
    "Stand up: \"Lower bills? Sounds great to me.\"",
    'Stay in your seat.',
  ], { prompt: 'PUBLIC COMMENT' });
  if (k === 0) {
    await d.you('Who gets to see what those cameras record?');
    await d.say('gideon', 'd2.c.r.cams', { cam: cu(d, 'gideon') });
    standing(G, 3); G.attention.add(6); rel(G, 'ruth', 6);
    m.flag('d2.comment', 'cams');
    await d.say('nadia', 'd2.n.speech.cams', { radio: true });
  } else if (k === 1) {
    await d.you('I fix things for a living. When free things break, who fixes them?');
    await d.say('hank', 'd2.c.r.fix', { cam: cu(d, 'hank') });
    await d.say('gideon', 'd2.c.r.fix2', { cam: cu(d, 'gideon') });
    await d.say('hank', 'd2.c.r.fix3', { cam: cu(d, 'hank', { side: -1 }) });
    standing(G, 5); rel(G, 'hank', 8); rel(G, 'dolly', 3);
    m.flag('d2.comment', 'fix');
    await d.say('nadia', 'd2.n.speech.fix', { radio: true });
  } else if (k === 2) {
    await d.you('Lower bills? Sounds great to me.');
    await d.say('lyle', 'd2.c.r.yes', { cam: cu(d, 'lyle') });
    standing(G, 1); rel(G, 'lyle', 8); rel(G, 'ruth', -4); G.attention.add(-4);
    m.flag('d2.comment', 'yes');
    await d.say('nadia', 'd2.n.speech.yes', { radio: true });
  } else {
    await d.say('walt', 'd2.c.r.none', { cam: cu(d, 'walt') });
    m.flag('d2.comment', 'none');
  }
  // Ray, at last
  await d.bring('ray', 'cityhall.door_in');
  await d.say('ray', 'd2.c.ray3', { cam: cu(d, 'ray') });
  await d.bring('ray', 'cityhall.councilSeat5', { sit: true });
  await d.say('ruth', 'd2.c.table', { cam: cu(d, 'ruth') });
  await d.say('ray', 'd2.c.second', { cam: cu(d, 'ray') });
  await d.say('walt', 'd2.c.vote', { cam: cu(d, 'walt') });
  await d.say('gideon', 'd2.c.patient', { cam: cu(d, 'gideon') });
  await d.say('walt', 'd2.c.close', { cam: shot(G, seat(0, -3.2), 2.4, at(G, 'cityhall.councilTable'), 1.2, 50) });
  await d.wait(0.6);
}

// Mr. Grey, parked by the road home with his lights off, watching.
async function greyCar(m, d) {
  const G = m.G, P = G.player.pos;
  G.npcs?.ensure?.('okafor');
  const home = at(G, 'cabin');
  const tx = home.x - P.x, tz = home.z - P.z, L = Math.hypot(tx, tz) || 1;
  const fx = tx / L, fz = tz / L;
  const spot = { x: P.x + fx * 18 + fz * 6, z: P.z + fz * 18 - fx * 6 };
  const look = yawTo(spot, P);
  d.prop?.('car', { x: spot.x + Math.cos(look) * 2.2, z: spot.z - Math.sin(look) * 2.2 }, { yaw: look + Math.PI / 2 });
  await d.bring('okafor', { ...spot, rot: look });
  await d.bring('player', { x: P.x, z: P.z, rot: yawTo(P, spot) });
  const over = d.actors?.okafor ? d.overShoulder('player', 'okafor', { fov: 30 }) : undefined;
  await d.say('nadia', 'd3.n.grey1', { radio: true, cam: over });
  await d.say('nadia', 'd3.n.grey2', { radio: true, cam: cu(d, 'okafor', { dist: 1.1 }) });
  await d.say('lyosha', 'd3.l.grey', { radio: true });
  const k = await d.choose(['Keep walking. Eyes front.', 'Look straight at him.'], { prompt: 'THE GREY CAR' });
  if (k === 1) {
    const stare = cu(d, 'okafor', { dist: 0.8 });
    if (stare) d.cam(stare);
    await d.wait(1.4);
    G.attention.add(5);
    m.flag('d3.lookedAtGrey', true);
    await d.say('nadia', 'd3.n.look', { radio: true });
  } else {
    await d.say('nadia', 'd3.n.grey3', { radio: true, cam: cu(d, 'player', { side: -1 }) });
  }
  G.sfx?.engineStart?.();
  await d.wait(1.2);
  await d.say('nadia', 'd3.n.grey4', { radio: true });
}

// ---------------------------------------------------------------- conversations
export const DIALOG = {
  koshkin: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.k.morning')) {
      await c.say('koshkin', 'd2.k.morning');
      await c.say('koshkin', 'd2.k.store');
      const k = await c.choose(['Where do you want me?', 'Your grandfather — was he Russian?']);
      if (k === 1) { await c.say('koshkin', 'd2.k.grandpa'); c.rel(5); }
      await c.say('koshkin', 'd2.k.till');
      c.flag('d2.k.morning', true);
      c.emit('talk:koshkin');
      return;
    }
    if (c.flag('d2.shiftDone') && !c.flag('d2.k.after')) {
      await c.say('koshkin', 'd2.k.after');
      await c.say('koshkin', c.flag('ellenAskedKoshkin') ? 'd2.k.doc' : 'd2.k.heart');
      await c.say('koshkin', 'd2.k.yuri');
      await c.say('koshkin', 'd2.k.hat');
      c.give('ushanka');
      c.rel(6);
      await c.say('koshkin', c.flag('fixKoshkinRoof') ? 'd2.k.roof' : 'd2.k.roofOffer');
      const k = await c.choose(["I'll get on it today.", 'Later this week.']);
      if (k === 0) c.start('d2.roof'); else c.flag('d2.roofLater', true);
      c.flag('d2.k.after', true);
      c.emit('talk:koshkin');
      return;
    }
    if (c.flag('d2.roofLater') && !c.state.repairs?.['r.koshkin.roof'] && !c.G.missions.isActive('d2.roof')) {
      await c.say('koshkin', c.flag('fixKoshkinRoof') ? 'd2.k.roof' : 'd2.k.roofOffer');
      const k = await c.choose(["All right. I'll do it now.", 'Not today.']);
      if (k === 0) { c.flag('d2.roofLater', false); c.start('d2.roof'); }
      return;
    }
    if (c.flag('d2.council.over')) return idle(c, prev, 'koshkin', 'd2.k.night');
    return idle(c, prev, 'koshkin', 'd2.k.idle');
  },

  marta: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (c.flag('d2.council.over') && !c.flag('d2.m.talked')) {
      await c.say('marta', 'd2.m.stop');
      await c.say('marta', 'd2.m.phone');
      const k = await c.choose(["Notes. I'm new here. I want to know who's who.", "It's a public meeting, Chief.", 'My mother wants to see the town.']);
      if (k === 0) { await c.say('marta', 'd2.m.notes'); c.rel(4); await c.say('marta', 'd2.m.bye'); }
      else if (k === 1) { await c.say('marta', 'd2.m.public'); c.rel(2); c.attention(2); await c.say('marta', 'd2.m.bye'); }
      else { await c.say('marta', 'd2.m.mother'); c.rel(5); }
      c.flag('d2.m.talked', true);
      c.emit('talk:marta');
      return;
    }
    if (!c.flag('d2.m.hi')) { c.flag('d2.m.hi', true); await c.say('marta', 'd2.m.desk'); return; }
    return idle(c, prev, 'marta', 'd2.m.idle');
  },

  ray: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (c.flag('d2.council.over') && !c.flag('d2.rayHeard')) {
      await c.say('ray', 'd2.ra.hello');
      const k = await c.choose(['Why were you late?', 'Buy you a drink? ($6)']);
      if (k === 1 && c.state.money >= 6) { c.money(-6, "Ray's beer"); await c.say('ray', 'd2.ra.drink'); c.rel(8); }
      await c.say('ray', 'd2.ra.late');
      await c.say('ray', 'd2.ra.quit');
      c.rel(4);
      c.flag('d2.rayHeard', true);
      c.emit('talk:ray');
      return;
    }
    if (!c.flag('d2.council.over')) return idle(c, prev, 'ray', 'd2.ra.cannery');
    return idle(c, prev, 'ray', 'd2.ra.idle');
  },

  lou: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.lo.hi')) { c.flag('d2.lo.hi', true); await c.say('lou', 'd2.lo.hello'); return; }
    return idle(c, prev, 'lou', 'd2.lo.idle');
  },

  dolly: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (c.flag('d2.council.over') && !c.flag('d2.d.after')) { c.flag('d2.d.after', true); await c.say('dolly', 'd2.d.after'); c.rel(3); return; }
    if (!c.flag('d2.d.hi') && !c.flag('d2.council.over')) {
      await c.say('dolly', 'd2.d.hello');
      const k = await c.choose(["What's Gideon like?", "What's on the agenda?"]);
      await c.say('dolly', k === 0 ? 'd2.d.gideon' : 'd2.d.agenda');
      c.rel(3);
      c.flag('d2.d.hi', true);
      c.emit('talk:dolly');
      return;
    }
    return idle(c, prev, 'dolly', 'd2.d.idle');
  },

  hank: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.h.hi') && !c.flag('d2.council.over')) { c.flag('d2.h.hi', true); await c.say('hank', 'd2.h.hello'); }
    return idle(c, prev, 'hank', 'd2.h.idle');
  },

  ruth: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.r.hi')) {
      await c.say('ruth', 'd2.r.hello');
      const k = await c.choose(['Nice to meet you, Mrs. Aqpik.', 'What do you think of Northstar?']);
      if (k === 0) { await c.say('ruth', 'd2.r.manners'); c.rel(6); } else { await c.say('ruth', 'd2.r.northstar'); c.rel(3); }
      c.flag('d2.r.hi', true);
      c.emit('talk:ruth');
      return;
    }
    return idle(c, prev, 'ruth', 'd2.r.idle');
  },

  lyle: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.ly.hi')) {
      await c.say('lyle', 'd2.ly.hello');
      const k = await c.choose(["I'll think about it.", 'Are you on the council?']);
      if (k === 1) await c.say('lyle', 'd2.ly.card');
      c.give('lyle_card');
      c.rel(2);
      c.flag('d2.ly.hi', true);
      c.emit('talk:lyle');
      return;
    }
    return idle(c, prev, 'lyle', 'd2.ly.idle');
  },

  walt: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.wt.hi')) { c.flag('d2.wt.hi', true); await c.say('walt', 'd2.wt.hello'); c.rel(4); return; }
    return idle(c, prev, 'walt', 'd2.wt.idle');
  },

  gideon: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.gi.hi')) {
      c.flag('d2.gi.hi', true);
      await c.say('gideon', 'd2.gi.hello');
      c.G.missions.ear('d2.n.gideon');
      c.attention(2);
      return;
    }
    return idle(c, prev, 'gideon', 'd2.gi.idle');
  },

  evan: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.e.hi')) {
      c.flag('d2.e.hi', true);
      await c.say('evan', 'd2.e.hello');
      const k = await c.choose(['Maybe later.', 'How is my face already in your system?']);
      if (k === 1) { await c.say('evan', 'd2.e.how'); c.attention(2); }
      c.G.missions.ear('d2.n.evan');
      return;
    }
    return idle(c, prev, 'evan', 'd2.e.idle');
  },

  pearl: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.p.hi')) { c.flag('d2.p.hi', true); await c.say('pearl', 'd2.p.hello'); c.rel(3); return; }
    return idle(c, prev, 'pearl', 'd2.p.tonight');
  },

  gabriel: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('d2.g.hi')) {
      c.flag('d2.g.hi', true);
      if (c.flag('bellFixed')) await c.say('gabriel', 'd2.g.hello');
      await c.say('gabriel', 'd2.g.chess');
      c.rel(3);
      return;
    }
    return idle(c, prev, 'gabriel', 'd2.g.chess');
  },

  ellen: async (c, prev) => {
    if (c.day !== 2) return prev(c);
    if (!c.flag('ellenAskedKoshkin')) { c.flag('ellenAskedKoshkin', true); await c.say('ellen', 'd2.el.hello'); c.rel(4); return; }
    return idle(c, prev, 'ellen', 'd2.el.idle');
  },

  nina: async (c, prev) => (c.day === 2 ? idle(c, prev, 'nina', 'd2.ni.hello') : prev(c)),
  tommy: async (c, prev) => (c.day === 2 ? idle(c, prev, 'tommy', 'd2.t.hello') : prev(c)),
  wade: async (c, prev) => (c.day === 2 ? idle(c, prev, 'wade', 'd2.wd.hello') : prev(c)),
};

export const DIALOG_OVERRIDE = true;

void warp; void hold;
