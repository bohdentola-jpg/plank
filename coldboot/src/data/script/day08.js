// DAY 8 — Counter-Surveillance (Monday). Seven days to dawn. Sweep the cabin
// for bugs, loop Northstar's smart streetlights around the square with code,
// and meet Mr. Grey outside the diner: "You're not the only one watching them."
// Side: who had a key (Ellen, Pearl, a new deadbolt from Hank); the numbers
// on Father Gabriel's shortwave (the Dome's guard roster).
export const DAY = { n: 8, start: ['d8.sweep'], mustFinish: ['d8.night'] };

const NIGHT = (h) => h >= 17 || h < 6;
const passed = (r) => r === true || !!(r && r.pass);
const BOX = { x: 14, z: 56 };   // the smart-light pole's junction box on Front St, by the diner
/** Characters with no town schedule (Okafor) get an NPC record so a scene can bring them. */
function ensureNpc(G, id, name = id) {
  const list = G.npcs?.list;
  if (!list?.get || list.has(id)) return;
  const proto = list.get('evan') || [...list.values()].find((n) => !n.def?.folk);
  try { if (proto) list.set(id, new proto.constructor(id, { name })); } catch { /* none to borrow */ }
}
/** m.until() that puts this mission's objective back if a side task cleared it. */
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });

export const LINES = {
  // ---------------------------------------------------------------- the earpiece: morning sweep
  'd8.n.morning': { who: 'nadia', ru: 'Доброе утро, Рыбка. Семь дней. Через неделю «Полынь» проснётся. Сегодня начнём с твоего дома.', en: 'Good morning, Rybka. Seven days. In a week, Wormwood wakes up. Today we start with your own home.', emo: 'serious' },
  'd8.l.camera': { who: 'lyosha', ru: 'Вчерашняя камера в датчике дыма — она не одна. Где одна, там и три. Так всегда бывает.', en: "Yesterday's camera in the smoke alarm isn't alone. Where there's one, there are three. It's always that way." },
  'd8.l.wifi': { who: 'lyosha', ru: 'Ночью ноутбук заметил в сети хижины чужое устройство. Кто-то у тебя дома подслушивает.', en: "Overnight the laptop spotted a stranger's device on the cabin's network. Someone in your home is listening.", emo: 'worry' },
  'd8.l.app': { who: 'lyosha', ru: 'Я поставил тебе на телефон сканер. Иди медленно, держи телефон перед собой. Запищит — ищи.', en: "I've put a scanner on your phone. Walk slowly, hold it out in front of you. When it beeps, search." },
  'd8.n.quiet': { who: 'nadia', ru: 'И ни слова вслух. Пока мы не знаем, что они слышат, ты просто плотник, который прибирается дома.', en: "And not a word out loud. Until we know what they can hear, you're just a carpenter tidying up at home." },
  'd8.l.alarm': { who: 'lyosha', ru: 'Вот она. Объектив размером с булавочную головку. Можно вырвать — но тогда они поймут, что мы всё поняли.', en: "There it is. A lens the size of a pinhead. You can rip it out — but then they'll know that we know." },
  'd8.n.alarm': { who: 'nadia', ru: 'Или оставить. Пусть смотрят, как ты спишь, ешь и чинишь табуретки. Самое скучное кино на Аляске.', en: 'Or leave it. Let them watch you sleep, eat and fix stools. The most boring film in Alaska.', emo: 'smile' },
  'd8.l.keep': { who: 'lyosha', ru: 'Правильно. Вечером я подсуну ей петлю: восемь часов твоего сна, по кругу.', en: "Good call. Tonight I'll slip it a loop: eight hours of you sleeping, round and round.", emo: 'smile' },
  'd8.n.pull': { who: 'nadia', ru: 'Ладно. Но теперь где-то у них мигает красная лампочка. Жди гостей.', en: 'Fine. But somewhere on their board a red light is blinking now. Expect visitors.', emo: 'worry' },
  'd8.l.radio': { who: 'lyosha', ru: 'Микрофон в старом приёмнике Юрия. Режь только жёлтый провод. Питание не трогай — пусть думают, что он живой.', en: "A microphone in Yuri's old radio. Cut only the yellow wire. Leave the power alone — let them think it's still alive." },
  'd8.l.radio2': { who: 'lyosha', ru: 'Тишина. Теперь он слышит только, как трещит печка.', en: 'Silence. Now all it hears is the stove crackling.', emo: 'smile' },
  'd8.g.tracker': { who: 'grisha', ru: 'Ага, вот он, под сиденьем. Маячок на магните. Знакомая игрушка.', en: 'Aha, there it is, under the seat. A tracker on a magnet. I know this toy.' },
  'd8.g.keep': { who: 'grisha', ru: 'Правильно, верни на место. Пусть думают, что мы слепые.', en: "Right, put it back. Let them think we're blind." },
  'd8.g.dog': { who: 'grisha', ru: 'Ха! На соседскую лайку? Пусть теперь «Нордстар» гоняется за собакой по всему городу!', en: "Ha! On the neighbour's husky? Now Northstar can chase a dog all over town!", emo: 'laugh' },
  'd8.l.three': { who: 'lyosha', ru: 'Три из трёх. Хижина чистая. Ну, настолько чистая, насколько нам нужно.', en: "Three for three. The cabin's clean. Well — as clean as we need it to be.", emo: 'smile' },
  'd8.n.key': { who: 'nadia', ru: 'Замок цел. Значит, сюда вошли с ключом. У кого ещё может быть ключ от хижины Юрия?', en: "The lock isn't damaged. So someone came in with a key. Who else could have a key to Yuri's cabin?", emo: 'serious' },
  // ---------------------------------------------------------------- the earpiece: the streetlights
  'd8.l.lights': { who: 'lyosha', ru: 'Теперь фонари. Новые фонари «Нордстара» вокруг площади — это не фонари. Это камеры с лампочкой сверху.', en: "Now the streetlights. Northstar's new lights around the square aren't streetlights. They're cameras with a bulb on top." },
  'd8.l.lights2': { who: 'lyosha', ru: 'Выключить их нельзя — заметят. Но можно подсунуть им петлю: пустую улицу вместо живой. Для этого мне нужен их щиток.', en: "We can't switch them off — they'd notice. But we can feed them a loop: an empty street instead of a live one. For that I need their junction box." },
  'd8.n.box': { who: 'nadia', ru: 'Щиток на столбе на Фронт-стрит, у закусочной. Старожилы зовут её Беринговой улицей. Только после темноты. И пригнись: этот столб смотрит на площадь.', en: 'The box is on the pole on Front Street, by the diner. The old-timers call it Bering Street. Only after dark. And keep low: that pole watches the square.' },
  'd8.n.day': { who: 'nadia', ru: 'Пока светло — живи обычной жизнью. Открой магазин, выпей кофе у Долли. Пусть видят плотника.', en: "While it's light, live a normal life. Open the store, have coffee at Dolly's. Let them see a carpenter." },
  'd8.n.dark': { who: 'nadia', ru: 'Стемнело. Пора. Фронт-стрит, столб у закусочной.', en: "It's dark. Time to go. Front Street, the pole by the diner." },
  'd8.l.tap': { who: 'lyosha', ru: 'Я внутри. Вижу всё, что видят они. Боже, сколько тут камер. Теперь твоя очередь — код на телефоне.', en: "I'm in. I can see everything they see. God, so many cameras. Now it's your turn — the code's on your phone." },
  'd8.l.retry': { who: 'lyosha', ru: 'Ничего страшного. Давай ещё раз, я подожду.', en: "No big deal. Let's go again — I'll wait." },
  'd8.l.done': { who: 'lyosha', ru: 'Есть! Площадь видит пустую улицу, снег и одну собаку. Собаку я оставил для правдоподобия.', en: 'Got it! The square sees an empty street, snow and one dog. I left the dog in for realism.', emo: 'laugh' },
  'd8.l.loopalarm': { who: 'lyosha', ru: 'И датчик дыма тоже на петле. Ты спишь. Всю ночь. Каждую ночь.', en: "And the smoke alarm's on the loop too. You're asleep. All night. Every night.", emo: 'smile' },
  'd8.n.diner': { who: 'nadia', ru: 'Хорошо. А теперь иди к Долли и поешь. Обычные люди вечером ужинают, а не лазают по столбам.', en: "Good. Now go to Dolly's and eat. Normal people have dinner in the evening; they don't climb poles." },
  // ---------------------------------------------------------------- Mr. Grey outside the diner
  'd8.o.hello': { who: 'okafor', en: "Evening. Cold enough for you? Two weeks in Port Zarya and I still can't feel my face." },
  'd8.o.know': { who: 'okafor', en: "No. But you've been learning a lot about this town lately. So have I. We're reading the same book, you and me." },
  'd8.o.walk': { who: 'okafor', en: "Don't go. I'll be quick. It's too cold for a long conversation, and too many people listen to the short ones." },
  'd8.o.plane': { who: 'okafor', en: 'Good memory. I took your picture. Bad habit. I photograph everyone who flies in. Hardly anybody flies in.', emo: 'smile' },
  'd8.o.lights': { who: 'okafor', en: 'Funny thing, tonight. Every camera on that square fell asleep at the same moment. Nineteen of them. Like somebody sang them a lullaby.' },
  'd8.o.wouldnt': { who: 'okafor', en: 'No. Of course not. You fix roofs.', emo: 'smile' },
  'd8.o.who': { who: 'okafor', en: 'Somebody who notices things. Like you do.' },
  'd8.o.tired': { who: 'okafor', en: "Maybe. Everybody's tired up here. It's the dark." },
  'd8.o.warn': { who: 'okafor', en: "So here's some free advice, from one tired person to another. You're not the only one watching them.", emo: 'serious' },
  'd8.o.warn2': { who: 'okafor', en: "And they're not the only ones watching you. Good night. Try the blueberry pie." },
  'd8.n.grey': { who: 'nadia', ru: 'Это он. Человек с самолёта. Серый. Рыбка, он знает про камеры. Откуда?', en: 'That was him. The man from the plane. Mr. Grey. Rybka, he knows about the cameras. How?', emo: 'worry' },
  'd8.dm.grey': { who: 'dmitri', ru: 'Не паникуем. Он не арестовал. Он предупредил. Значит, ему что-то от нас нужно.', en: "We don't panic. He didn't arrest anyone. He warned. That means he wants something from us.", emo: 'serious' },
  'd8.l.grey': { who: 'lyosha', ru: 'Девятнадцать камер. Он назвал точное число. Это число знаем только мы… и «Нордстар».', en: 'Nineteen cameras. He gave the exact number. Only we know that number… and Northstar.', emo: 'worry' },
  // ---------------------------------------------------------------- the night
  'd8.n.lesson': { who: 'nadia', ru: 'Иди домой, Рыбка. Лёша ждёт тебя на ноутбуке. Сегодня — строки.', en: "Go home, Rybka. Lyosha's waiting on the laptop. Tonight: strings." },
  'd8.l.after': { who: 'lyosha', ru: 'Хорошо режешь строки. Почти как Баба Валя колбасу.', en: 'You slice strings well. Almost as well as Baba Valya slices sausage.', emo: 'smile' },
  'd8.v.sausage': { who: 'valya', ru: 'Я всё слышу, Алексей. Колбасы тебе завтра не будет.', en: 'I hear everything, Alexei. No sausage for you tomorrow.', emo: 'smile' },
  'd8.n.night': { who: 'nadia', ru: 'Спи, Рыбка. Сегодня за тобой никто не подглядывает — я проверила. Завтра — шесть дней.', en: "Sleep, Rybka. Tonight nobody's watching you — I checked. Tomorrow: six days.", emo: 'smile' },
  // ---------------------------------------------------------------- side: who has a key
  'd8.e.koshkin': { who: 'ellen', en: "Oh, good, it's you. I took Sasha his pills on Saturday's plane to Nome. He's grumpy, which means he's mending.", emo: 'smile' },
  'd8.e.key': { who: 'ellen', en: 'He gave me a message for you. A spare key to Yuri\'s cabin hangs on a nail under his register. Keep it safe, he said. He was very particular.' },
  'd8.e.chat': { who: 'ellen', en: 'Sasha is stable. Grumpy, demanding pickled herring, but stable. He asks about the store every single day.' },
  'd8.n.nail': { who: 'nadia', ru: 'Гвоздь на месте. Ключа нет. Кто-то побывал в магазине, пока Кошкин в больнице.', en: "The nail's there. The key isn't. Someone's been in this store while Koshkin's in hospital.", emo: 'serious' },
  'd8.p.suv': { who: 'pearl', en: "A black SUV? Hon, one sat at the end of Shore Road all through Sunday liturgy. I noticed because I was late, and I'm never late." },
  'd8.p.evan': { who: 'pearl', en: 'And when Sasha collapsed at the fish fry, Evan Pike was so helpful. Locked up the store for everybody. Wasn\'t that nice of him.' },
  'd8.p.chat': { who: 'pearl', en: 'Nothing for you today, hon. Well. Nothing official.', emo: 'smile' },
  'd8.n.evan': { who: 'nadia', ru: 'Эван. Конечно, Эван. Улыбается и запирает чужие двери.', en: 'Evan. Of course it was Evan. He smiles and locks other people\'s doors.', emo: 'frown' },
  'd8.h.lock': { who: 'hank', en: 'A deadbolt, huh? Somebody bothering you out on Shore Road?' },
  'd8.h.lock2': { who: 'hank', en: "Thirty-five. The good one. Solid brass. Nobody gets through that without a saw and a reason." },
  'd8.h.broke': { who: 'hank', en: "Thirty-five dollars, friend. I don't do credit. Not even for nice people." },
  'd8.n.lock': { who: 'nadia', ru: 'Новый замок, и ключ только у тебя. Хоть одна дверь в этом городе — наша.', en: 'A new lock, and only you have the key. At least one door in this town is ours.', emo: 'smile' },
  // ---------------------------------------------------------------- side: numbers in the night
  'd8.g.radio': { who: 'gabriel', en: 'Ah, my carpenter. Do you know anything about radios? Every night at nine my old shortwave picks up a woman reading numbers. Only numbers.' },
  'd8.g.radio2': { who: 'gabriel', en: "Come and listen tonight, at nine, in the narthex. Maybe you'll hear what it means. All I hear is that it frightens me." },
  'd8.g.listen': { who: 'gabriel', en: 'There. Every night, the same woman. My grandmother used to say the dead read numbers to the living.' },
  'd8.f.num': { who: 'f6', en: 'Kettle, Kettle. Zero. Four. Eight. Twelve. Sixteen. Twenty. And two. Kettle, Kettle.' },
  'd8.v.num': { who: 'valya', ru: 'Ох, как просто. Это не шпионы, это сторожа. Ноль, четыре, восемь — смена караула каждые четыре часа. А «два» в конце — две минуты после часа.', en: "Oh, how simple. These aren't spies, they're watchmen. Zero, four, eight: the guard changes every four hours. And the 'two' at the end is two minutes past the hour.", emo: 'smile' },
  'd8.v.num2': { who: 'valya', ru: 'В семьдесят третьем мы шифровали получше. Американцы.', en: 'In seventy-three we encrypted things better than this. Americans.', emo: 'smile' },
  'd8.g.after': { who: 'gabriel', en: "You've gone quiet. You understand it? No, don't tell me. A priest hears enough secrets." },
  'd8.n.numbers': { who: 'nadia', ru: 'Запомни: на Куполе смена караула в две минуты после каждого четвёртого часа. Это нам пригодится.', en: 'Remember: at the Dome the guard changes at two minutes past every fourth hour. We will need that.' },
  'd8.g.chat': { who: 'gabriel', en: 'God\'s peace. You look troubled. The church is open, if you need somewhere quiet to sit.' },
  // ---------------------------------------------------------------- Evan knows things
  'd8.ev.alarm': { who: 'evan', en: 'Oh, hi! Quick heads-up: our Northstar Home Safety network says your smoke detector went offline this morning. Want me to send a technician? It\'s free!', emo: 'smile' },
  'd8.ev.self': { who: 'evan', en: 'Of course you will! Just remember, a home without a working detector is a home nobody can see into. Look after, I mean. Ha!', emo: 'laugh' },
  'd8.ev.since': { who: 'evan', en: "Since the city passed the Smart Safety ordinance in August! Every home in Port Zarya is protected now. Mr. Shaw's idea. Isn't it great?", emo: 'smile' },
  'd8.ev.sleep': { who: 'evan', en: "Good morning! You look rested. Eight hours, I'd guess. Sleep is so important, isn't it?", emo: 'smile' },
  'd8.ev.hi': { who: 'evan', en: "Morning! Another beautiful day in Port Zarya. Northstar's always here for you!", emo: 'smile' },
  'd8.n.evan2': { who: 'nadia', ru: 'Он смотрит запись из твоей хижины. Пусть. Скоро он будет смотреть одну и ту же ночь по кругу.', en: "He's watching the feed from your cabin. Let him. Soon he'll be watching the same night on repeat.", emo: 'frown' },
  // ---------------------------------------------------------------- around town
  'd8.d.chat': { who: 'dolly', en: "Morning, honey. You look like you slept with one eye open. Coffee? Lord knows I'm on my fourth." },
  'd8.d.ray': { who: 'dolly', en: "Ray Moody sat right there last night and swore if the council leases the cannery dock to Northstar, he's done. I've never seen him like that.", emo: 'worry' },
  'd8.h.chat': { who: 'hank', en: "Heard you've been minding Sasha's place. Keeping the lights on over there. People notice that." },
  'd8.h.chat2': { who: 'hank', en: "Slow Monday. Need anything? I've got everything except customers." },
  'd8.r.chat': { who: 'ruth', en: 'Sit with me a moment. They put one of those new streetlights right outside my window. I keep my curtains shut now. In my own house.', emo: 'frown' },
  'd8.r.cards': { who: 'ruth', en: "That laminated card Gideon had us sign. I keep thinking about it. Nobody gives an old woman a card like that for no reason." },
  'd8.ry.chat': { who: 'ray', en: "Emergency session tonight. They want to lease the cannery dock to Northstar. Forty-one jobs. I'm the only no, and I'm sick of being the only no.", emo: 'angry' },
  'd8.ly.chat': { who: 'lyle', en: "Ah, our handyman. You know, Northstar will need plenty of contractors once the dock project starts. Play your cards right.", emo: 'smile' },
  'd8.m.chat': { who: 'marta', en: 'You. Somebody called in a prowler at the end of Shore Road on Sunday. Your cabin. Know anything about that?', emo: 'serious' },
  'd8.m.truth': { who: 'marta', en: "Inside, huh. Anything taken? No? Then it wasn't a burglar. If it happens again, you call me. You don't handle it yourself.", emo: 'serious' },
  'd8.m.lie': { who: 'marta', en: 'Uh huh. Lock your door, then.', emo: 'frown' },
  'd8.gi.chat': { who: 'gideon', en: "Koshkin's caretaker. I trust the store is in order. The city takes an interest in that building's future." },
  'd8.w.chat': { who: 'walt', en: "Morning, friend. Long night ahead of me. Emergency session. Never run for anything. That's my advice to you." },
  'd8.ni.chat': { who: 'nina', en: "Hey, it's the carpenter! You're kind of famous on my show. Mystery handyman fixes the bell. Want to request a song? I have about twenty.", emo: 'smile' },
  'd8.lo.chat': { who: 'lou', en: "What'll it be? Ray's in a mood. Council votes on the cannery tonight. If you want a quiet drink, sit far away from him." },
  'd8.t.chat': { who: 'tommy', en: "Yo! If you ever want to try the lake track, I'll lend you my backup sled. Grandma says you're alright. That's basically a medal.", emo: 'laugh' },
  'd8.wa.chat': { who: 'wade', en: "Hey there. Weather's clearing Thursday. If you still want that flying lesson, come by the hangar." },
};

// ---------------------------------------------------------------- missions
/** A field hack that can be retried at a spot instead of trapping the player in the laptop. */
async function hack(m, id, where, retryLine, retryText) {
  for (;;) {
    if (passed(await m.code(id))) return true;
    await m.ear(retryLine);
    m.obj(retryText, where);
    await m.spot('retry.' + id, where, retryText, 3);
  }
}

export const MISSIONS = {
  'd8.sweep': {
    title: 'Counter-Surveillance', main: true, day: 8,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        await m.wait(1.0);
        await m.ear('d8.n.morning');
        await m.ear(m.flag('cabinSearched') ? 'd8.l.camera' : 'd8.l.wifi');
        await m.ear('d8.l.app');
        m.ear('d8.n.quiet');
      }
      if (m.cp(2, from)) {
        m.obj('Sweep the cabin: the smoke alarm', 'cabin.smokeAlarm', 'Phone scanner: 0 / 3 found');
        await m.spot('alarm', 'cabin.smokeAlarm', 'Check the smoke alarm', 2.8);
        let keep = true;
        await m.scene(async (d) => {
          await d.say('lyosha', 'd8.l.alarm', { radio: true });
          await d.say('nadia', 'd8.n.alarm', { radio: true });
          keep = (await d.choose(['(Leave it. Let them watch a boring life.)', '(Pull it out. Nobody watches me sleep.)'], { prompt: 'THE SMOKE ALARM' })) === 0;
          if (keep) await d.say('lyosha', 'd8.l.keep', { radio: true });
        });
        if (!keep) {
          G.attention.act(0.6, 3);
          await m.minigame('wire', { title: 'DISCONNECT THE CAMERA' });
          G.attention.add(6);
          await m.ear('d8.n.pull');
        }
        m.flag('alarmCamKept', keep);
        m.flag('d8.bug.alarm', true);
      }
      if (m.cp(3, from)) {
        m.obj("Sweep the cabin: Yuri's old radio", 'cabin.radio', 'Phone scanner: 1 / 3 found');
        await m.spot('radio', 'cabin.radio', 'Open the old radio', 2.4);
        await m.ear('d8.l.radio');
        await m.minigame('wire', { title: 'CUT THE MIC, KEEP THE POWER' });
        await m.ear('d8.l.radio2');
        m.flag('d8.bug.radio', true);
      }
      if (m.cp(4, from)) {
        m.obj('Sweep the cabin: the snowmobile outside', 'cabin.snowmobile', 'Phone scanner: 2 / 3 found');
        await m.spot('tracker', 'cabin.snowmobile', 'Check under the seat', 2.6);
        await m.scene(async (d) => {
          await d.say('grisha', 'd8.g.tracker', { radio: true });
          const k = await d.choose(['(Put it back. Let them think I never noticed.)', '(Stick it on the husky next door.)'], { prompt: 'THE TRACKER' });
          if (k === 0) { m.flag('trackerKept', true); await d.say('grisha', 'd8.g.keep', { radio: true }); }
          else { m.flag('trackerOnDog', true); await d.say('grisha', 'd8.g.dog', { radio: true, emo: 'laugh' }); }
        });
        m.flag('d8.bug.tracker', true);
      }
      if (m.cp(5, from)) {
        m.flag('cabinSwept', true);
        G.hud.toast('CABIN SWEPT', '3 / 3 devices found', '#9fe8b0');
        await m.ear('d8.l.three');
        await m.ear('d8.n.key');
        m.done();
        m.start('d8.loop');
        m.start('d8.key');
      }
    },
  },

  'd8.loop': {
    title: 'Eyes on the Square', main: true, day: 8,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        await m.ear('d8.l.lights');
        await m.ear('d8.l.lights2');
        await m.ear('d8.n.box');
        m.start('d8.numbers');
      }
      if (m.cp(2, from)) {
        if (!NIGHT(G.state.hour)) {
          m.ear('d8.n.day');
          m.obj('Live a normal day until dark', 'koshkin', 'The junction box after 17:00');
          await hold(m, () => NIGHT(G.state.hour), 'Live a normal day until dark', 'koshkin', 'The junction box after 17:00');
          await m.ear('d8.n.dark');
        }
      }
      if (m.cp(3, from)) {
        m.obj('Open the junction box on Front Street', BOX, 'Crouch: the pole watches the square');
        await m.spot('box', BOX, 'Open the junction box', 2.4);
        G.attention.act(1.2, 8);
        await m.minigame('wire', { title: 'TAP THE CAMERA LINE' });
        await m.ear('d8.l.tap');
      }
      if (m.cp(4, from)) {
        m.obj('Loop the streetlight cameras', BOX, 'Field hack on your phone');
        await hack(m, 'camloop', BOX, 'd8.l.retry', 'Run the camera loop again');
        m.flag('camsLooped', true);
        const A = G.attention;
        (A.watchers || []).forEach((w, i) => { if (w.owner === 'smartlight' && Math.hypot(w.x, w.z) < 80) A.looped?.add(i); });
        G.hud.toast('CAMERAS LOOPED', 'The square sees an empty street', '#7fe6ff');
        await m.ear('d8.l.done');
        if (m.flag('alarmCamKept')) await m.ear('d8.l.loopalarm');
      }
      if (m.cp(5, from)) {
        m.ear('d8.n.diner');
        m.obj('Get dinner at the Midnight Sun Diner', 'diner', 'Be seen being normal');
        await m.reach('diner', 9);
      }
      if (m.cp(6, from)) {
        m.clear();
        ensureNpc(G, 'okafor', 'Mr. Grey');
        await m.scene(async (d) => {
          await d.bring('okafor', { x: 27, z: 42 }, { face: 'player' });
          await d.say('okafor', 'd8.o.hello', { cam: d.closeUp('okafor') });
          const k = await d.choose(['Do I know you?', '(Say nothing. Keep walking.)', 'You were on my plane.'], { prompt: 'MR. GREY' });
          await d.say('okafor', ['d8.o.know', 'd8.o.walk', 'd8.o.plane'][k] || 'd8.o.know', { cam: d.closeUp('okafor', { side: -1 }) });
          await d.say('okafor', 'd8.o.lights', { cam: d.overShoulder('player', 'okafor') });
          const k2 = await d.choose(["I wouldn't know anything about cameras.", 'Who are you?', 'Maybe they were tired.'], { prompt: 'MR. GREY' });
          await d.say('okafor', ['d8.o.wouldnt', 'd8.o.who', 'd8.o.tired'][k2] || 'd8.o.who');
          await d.say('okafor', 'd8.o.warn', { cam: d.closeUp('okafor', { dist: 0.6 }) });
          await d.say('okafor', 'd8.o.warn2');
        });
        m.flag('greyWarned', true);
        await m.ear('d8.n.grey');
        await m.ear('d8.dm.grey');
        await m.ear('d8.l.grey');
      }
      if (m.cp(7, from)) {
        m.done();
        m.start('d8.night');
      }
    },
  },

  'd8.night': {
    title: 'Night School: Strings', main: true, day: 8,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        await m.ear('d8.n.lesson');
        m.obj("Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 8: Cutting Strings');
        await hold(m, () => G.state.lessons.l08, "Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 8: Cutting Strings');
      }
      if (m.cp(2, from)) {
        await m.ear('d8.l.after');
        await m.ear('d8.v.sausage');
        await m.ear('d8.n.night');
        m.done();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd8.key': {
    title: 'Who Has a Key', day: 8,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Ask Doc Haverford how Koshkin is', 'ellen', 'The clinic, 8:00–17:00');
        await m.until(() => m.flag('d8.key.ellen'));
      }
      if (m.cp(2, from)) {
        m.obj("Check the nail under Koshkin's register", 'koshkin.register');
        await m.spot('nail', 'koshkin.register', 'Look for the spare key', 2.2);
        m.flag('d8.key.nail', true);
        await m.ear('d8.n.nail');
      }
      if (m.cp(3, from)) {
        m.obj('Ask Pearl who has been around', 'pearl', 'The post office, 9:00–17:00');
        await m.until(() => m.flag('d8.key.pearl'));
        await m.ear('d8.n.evan');
      }
      if (m.cp(4, from)) {
        m.obj('Buy a deadbolt at Brubaker Hardware', 'hank', '$35');
        await m.until(() => (G.state.inv.deadbolt || 0) > 0);
      }
      if (m.cp(5, from)) {
        m.obj('Fit the new lock on your cabin door', 'cabin.door');
        await m.spot('bolt', 'cabin.door', 'Fit the deadbolt', 2.6);
        await m.minigame('hammer', { title: 'FIT THE DEADBOLT' });
        G.state.inv.deadbolt = 0;
        m.flag('newLock', true);
        await m.ear('d8.n.lock');
        m.done();
      }
    },
  },

  'd8.numbers': {
    title: 'Numbers in the Night', day: 8,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Father Gabriel wants to show you something', 'gabriel', 'Holy Transfiguration, until 21:00');
        await m.until(() => m.flag('d8.num.asked'));
      }
      if (m.cp(2, from)) {
        m.obj("Listen to Father Gabriel's radio at nine", 'church.narthex', 'Tonight, from 21:00');
        await m.until(() => { const h = G.state.hour; return h >= 20.9 || h < 4; });
        await m.spot('radio', 'church.narthex', 'Listen to the shortwave', 2.6);
      }
      if (m.cp(3, from)) {
        await m.scene(async (d) => {
          await d.bring('gabriel', 'church.narthex', { face: 'player' });
          await d.say('gabriel', 'd8.g.listen', { cam: d.closeUp('gabriel') });
          await d.say('f6', 'd8.f.num', { radio: true });
          await d.say('valya', 'd8.v.num', { radio: true });
          await d.say('valya', 'd8.v.num2', { radio: true });
          await d.say('gabriel', 'd8.g.after', { cam: d.closeUp('gabriel', { side: -1 }) });
        });
        m.flag('domeShifts', true);
        G.hud.toast('NOTED', 'Dome guards change at :02 past every fourth hour', '#7fe6ff');
        await m.ear('d8.n.numbers');
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
/** A once-a-day chat: plays the lines the first time, then hands over to earlier content. */
const chat = (npc, key, lines, rel = 2) => async (c, prev) => {
  if (c.day !== 8 || c.flag(key)) return prev(c);
  c.flag(key, true);
  for (const l of (typeof lines === 'function' ? lines(c) : lines)) if (l) await c.say(npc, l);
  c.rel(rel);
};

export const DIALOG = {
  ellen: async (c, prev) => {
    if (c.day !== 8) return prev(c);
    if (c.G.missions.isActive('d8.key') && !c.flag('d8.key.ellen')) {
      await c.say('ellen', 'd8.e.koshkin');
      await c.say('ellen', 'd8.e.key');
      c.flag('d8.key.ellen', true);
      c.rel(3);
      c.emit('talk:ellen');
      return;
    }
    return chat('ellen', 'd8.e.chatted', ['d8.e.chat'])(c, prev);
  },
  pearl: async (c, prev) => {
    if (c.day !== 8) return prev(c);
    if (c.G.missions.isActive('d8.key') && c.flag('d8.key.nail') && !c.flag('d8.key.pearl')) {
      await c.you('Has anyone been hanging around Shore Road? Or the store?');
      await c.say('pearl', 'd8.p.suv');
      await c.say('pearl', 'd8.p.evan');
      c.flag('d8.key.pearl', true);
      c.rel(3);
      c.emit('talk:pearl');
      return;
    }
    return chat('pearl', 'd8.p.chatted', ['d8.p.chat'])(c, prev);
  },
  hank: async (c, prev) => {
    if (c.day !== 8) return prev(c);
    const opts = [];
    if (c.G.missions.isActive('d8.key') && c.flag('d8.key.pearl') && !c.hasItem('deadbolt') && !c.flag('newLock')) opts.push({ label: 'A deadbolt. The good kind. ($35)', key: 'bolt' });
    if (!c.flag('d8.h.chatted')) opts.push({ label: "How's business?", key: 'chat' });
    if (!opts.length) return prev(c);
    opts.push({ label: 'Something else.', key: 'prev' });
    const k = await c.choose(opts);
    if (k === 'bolt') {
      await c.say('hank', 'd8.h.lock');
      await c.you('Let\'s just say I like my privacy.');
      if (c.state.money >= 35) { c.money(-35, 'deadbolt'); c.give('deadbolt'); await c.say('hank', 'd8.h.lock2'); c.rel(3); }
      else await c.say('hank', 'd8.h.broke');
      c.emit('talk:hank');
      return;
    }
    if (k === 'chat') {
      c.flag('d8.h.chatted', true);
      await c.say('hank', c.flag('runStore') ? 'd8.h.chat' : 'd8.h.chat2');
      c.rel(2);
      return;
    }
    return prev(c);
  },
  gabriel: async (c, prev) => {
    if (c.day !== 8) return prev(c);
    if (c.G.missions.isActive('d8.numbers') && !c.flag('d8.num.asked')) {
      await c.say('gabriel', 'd8.g.radio');
      const k = await c.choose(["I'd like to hear that.", 'Numbers? Probably a fishing fleet.']);
      if (k === 1) await c.you('…But I could take a listen.');
      await c.say('gabriel', 'd8.g.radio2');
      c.flag('d8.num.asked', true);
      c.rel(3);
      c.emit('talk:gabriel');
      return;
    }
    return chat('gabriel', 'd8.g.chatted', ['d8.g.chat'])(c, prev);
  },
  evan: async (c, prev) => {
    if (c.day !== 8 || c.flag('d8.ev.chatted')) return prev(c);
    c.flag('d8.ev.chatted', true);
    if (!c.flag('cabinSwept')) { await c.say('evan', 'd8.ev.hi'); return; }
    if (c.flag('alarmCamKept')) {
      await c.say('evan', 'd8.ev.sleep');
      c.G.missions.ear('d8.n.evan2');
      return;
    }
    await c.say('evan', 'd8.ev.alarm');
    const k = await c.choose(["I'll fix it myself. I'm a carpenter.", 'Since when does Northstar watch my smoke alarm?']);
    if (k === 0) await c.say('evan', 'd8.ev.self');
    else { await c.say('evan', 'd8.ev.since'); c.attention(4); }
  },
  marta: async (c, prev) => {
    if (c.day !== 8 || c.flag('d8.m.chatted')) return prev(c);
    c.flag('d8.m.chatted', true);
    await c.say('marta', 'd8.m.chat');
    const k = await c.choose(['Someone was inside my cabin.', 'No idea, Chief.']);
    if (k === 0) { await c.say('marta', 'd8.m.truth'); c.rel(6); c.flag('martaToldBreakIn', true); }
    else { await c.say('marta', 'd8.m.lie'); c.rel(-2); }
  },
  ruth: chat('ruth', 'd8.r.chatted', (c) => ['d8.r.chat', c.flag('knowsShares') && 'd8.r.cards'], 3),
  dolly: chat('dolly', 'd8.d.chatted', ['d8.d.chat', 'd8.d.ray']),
  ray: chat('ray', 'd8.ry.chatted', ['d8.ry.chat']),
  lyle: chat('lyle', 'd8.ly.chatted', ['d8.ly.chat'], 1),
  gideon: chat('gideon', 'd8.gi.chatted', ['d8.gi.chat'], 0),
  walt: chat('walt', 'd8.w.chatted', ['d8.w.chat']),
  nina: chat('nina', 'd8.ni.chatted', ['d8.ni.chat']),
  lou: chat('lou', 'd8.lo.chatted', ['d8.lo.chat']),
  tommy: chat('tommy', 'd8.t.chatted', ['d8.t.chat']),
  wade: chat('wade', 'd8.wa.chatted', ['d8.wa.chat']),
};
export const DIALOG_OVERRIDE = true;
