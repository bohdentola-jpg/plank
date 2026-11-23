// DAY 7 — Sunday. Rybka rings the bells (the rope fixed on day 1) for the
// liturgy at Holy Transfiguration, where Father Gabriel prays for Sasha
// Koshkin. At the coffee hour Ruth tells the town's history: 1822, the
// Russian-American Company, 1867, the radar on Kettle Hill. At three, a video
// call home: Valya, Dmitri, Lyosha, Grisha (and one word from Ivan). Sunday
// supper at Dolly's: Pearl saw a grey parka counting houses on Shore Road, and
// Father Gabriel's old radio caught a calm woman's voice in Russian saying
// "good night, little fish". Back home, the door is unlocked: someone has been
// inside (with a key — nothing is forced), the laptop has three wrong
// passwords, and the smoke alarm's light has turned blue. A lens. Nadia: stay
// calm, act normal. Night School lesson 7, in front of the camera.
//
// ---------------------------------------------------------------- repairs used
//   none today.
//
// ---------------------------------------------------------------- flags set
//   d7.bells          Rybka rang the bells for the liturgy
//   d7.candles        'one' | 'two' (a second candle "for friends far away")
//   d7.ruthHistory    Ruth told the town's history
//   d7.call           the video call home happened ('koshkin' | 'miss' | 'weather': what Rybka talked about)
//   d7.greyOnShore    Pearl saw Mr. Grey walking Shore Road "counting the houses"
//   relayLeak         Father Gabriel's tube radio picks up the relay (Lyosha closes it overnight)
//   cabinSearched     true — someone entered the cabin with a key while Rybka was at supper (day 8 reads it)
//   cameraInSmokeAlarm  true — a pinhole camera in the smoke alarm, left in place; it sees the table and the door
//   d7.wantedRipOut   Rybka wanted to rip the camera out (Nadia stopped it)
import {
  at, dist, cu, shot, rel, standing, spirit, place, release, hold, idle,
} from './day02.js';

export const DAY = { n: 7, start: ['d7.sunday'], mustFinish: ['d7.sunday', 'd7.call', 'd7.home'] };

export const LINES = {
  // ---- morning: the bells
  'd7.n.morning': { who: 'nadia', ru: 'Воскресенье. Сегодня отдыхаем. Почти. Отец Гавриил просил позвонить в колокола перед литургией — в десять.', en: 'Sunday. Today we rest. Almost. Father Gabriel asked you to ring the bells before the liturgy — at ten.' },
  'd7.v.candle': { who: 'valya', ru: 'Сходи в храм, рыбка. Поставь свечку за Кошкина. И за нас заодно.', en: "Go to church, little fish. Light a candle for Koshkin. And one for us while you're at it.", emo: 'smile' },
  'd7.n.early': { who: 'nadia', ru: 'Ещё рано. Колокола — в десять.', en: 'Still early. The bells are at ten.' },
  'd7.n.bells': { who: 'nadia', ru: 'Слышишь? Весь город слышит. Это твой звон, Рыбка.', en: 'Hear that? The whole town hears it. That is your ringing, Rybka.', emo: 'smile' },

  // ---- the liturgy
  'd7.g.peace': { who: 'gabriel', en: 'In peace, let us pray to the Lord.' },
  'd7.f.mercy': { who: 'f2', en: 'Lord, have mercy.' },
  'd7.g.sasha': { who: 'gabriel', en: 'For the servant of God Alexander, who lies ill in Nome, and for all who care for him, let us pray to the Lord.' },
  'd7.n.choir': { who: 'nadia', ru: 'Красиво поют. Валентина Петровна сейчас плачет. Только ей не говори, что я сказала.', en: "They sing beautifully. Valentina Petrovna is crying right now. Just don't tell her I said so.", emo: 'smile' },
  'd7.v.hear': { who: 'valya', ru: 'Я всё слышу, Надя.', en: 'I can hear everything, Nadia.', emo: 'smile' },
  'd7.v.thanks': { who: 'valya', ru: 'Спасибо, рыбка. А мы тут за тебя свечку поставили.', en: 'Thank you, little fish. And we lit a candle for you over here.', emo: 'smile' },
  'd7.g.sermon': { who: 'gabriel', en: "Today's Gospel is the Good Samaritan. A stranger on the road, and the one who stops. This week, a stranger in our town stopped. Opened a store. Rang our bells." },
  'd7.g.end': { who: 'gabriel', en: 'Go in peace. And Dolly says there are cinnamon rolls at the coffee hour, so go in peace quickly.', emo: 'smile' },

  // ---- Ruth: the town's history
  'd7.r.h1': { who: 'ruth', en: "You've been here a week, and you already know more people than the Northstar boys have met in two years. Sit. Let an old teacher tell you about this town.", emo: 'smile' },
  'd7.r.h2': { who: 'ruth', en: 'Eighteen twenty-two. The Russian-American Company built a trading post on this beach. Furs, mostly sea otter. They called it Zarya. The dawn.' },
  'd7.r.h3': { who: 'ruth', en: "My people were here long before that. We traded with them, married them, buried them. That's why half this town has a Russian grandfather and an Inupiaq grandmother." },
  'd7.r.h4': { who: 'ruth', en: 'Eighteen sixty-seven. In Sitka, a man lowered one flag and raised another. Nobody asked us. The Russians sailed home. The priests stayed, and so did the church.' },
  'd7.r.h5': { who: 'ruth', en: "Then the gold rush. The cannery. The oil men. The Air Force put a radar on Kettle Hill to watch the Russians. Now Northstar sits in it. Every one of them thought they'd bought us." },
  'd7.r.h6': { who: 'ruth', en: 'Nobody buys a town. You can buy the land and the lights. The people, you have to earn. Northstar never learned that. You seem to know it already.', emo: 'smile' },
  'd7.r.h7': { who: 'ruth', en: "Because somebody has to remember out loud. Most days that's all I do. Remember out loud, and vote no." },
  'd7.r.h8': { who: 'ruth', en: "Come by the school sometime. I'll show you the church books from eighteen thirty-one. Your name isn't in them. Maybe someday it should be.", emo: 'smile' },
  'd7.r.idle': { who: 'ruth', en: 'Go and rest. Even God took a day off.' },

  // ---- the video call home
  'd7.n.call0': { who: 'nadia', ru: 'В три часа — видеозвонок. Вся команда. Валентина Петровна настояла. Иди домой, к ноутбуку.', en: 'At three, a video call. The whole team. Valentina Petrovna insisted. Go home to the laptop.' },
  'd7.n.early2': { who: 'nadia', ru: 'Рано. Валентина Петровна ещё платок выбирает.', en: 'Too early. Valentina Petrovna is still choosing a headscarf.', emo: 'smile' },
  'd7.n.call1': { who: 'nadia', ru: 'Три часа. Все в сборе. Включай.', en: "Three o'clock. Everyone's here. Switch it on." },
  'd7.v.hello': { who: 'valya', ru: 'Рыбка! Ну-ка, покажись. Кожа да кости! Я так и знала. Ты там ешь что-нибудь?', en: 'Rybka! Come on, let me see you. Skin and bones! I knew it. Are you eating anything over there?', emo: 'worry' },
  'd7.gr.hello': { who: 'grisha', ru: 'Рыбка! Рыба дошла? Целая? Шурин три дня коптил!', en: 'Rybka! Did the fish arrive? In one piece? My brother-in-law smoked it for three days!', emo: 'laugh' },
  'd7.l.hello': { who: 'lyosha', ru: 'Привет! Я поставил на экран Порт-Зарю со спутника. Вон, видишь точку у воды? Это твоя хижина.', en: "Hi! I've put Port Zarya from the satellite on my screen. See the dot by the water? That's your cabin.", emo: 'smile' },
  'd7.dm.hello': { who: 'dmitri', ru: 'Здравствуй, Рыбка. Хорошо выглядишь. Устало, но хорошо.', en: 'Hello, Rybka. You look good. Tired, but good.', emo: 'smile' },
  'd7.v.socks': { who: 'valya', ru: 'Я тебе носки вяжу. Шерстяные. Гриша привезёт, когда всё кончится. Размер помню.', en: "I'm knitting you socks. Wool. Grisha will bring them when this is all over. I remember your size.", emo: 'smile' },
  'd7.gr.socks': { who: 'grisha', ru: 'Она и мне вяжет. Уже третий месяц. Один носок.', en: "She's knitting me some too. Third month now. One sock." },
  'd7.v.bear': { who: 'valya', ru: 'У тебя нога как у медведя, Гриша. На тебя шерсти во всей Чукотке не хватит.', en: "You've got feet like a bear, Grisha. There isn't enough wool in all Chukotka for you.", emo: 'laugh' },
  'd7.gr.sandwich': { who: 'grisha', ru: 'А правда, что у вас там бутерброд стоит двенадцать долларов? Я за двенадцать долларов корову куплю!', en: "Is it true a sandwich costs twelve dollars over there? For twelve dollars I'd buy a cow!", emo: 'laugh' },
  'd7.dm.koshkin': { who: 'dmitri', ru: 'Знаю. Надя рассказала. Хороший старик. Держи его магазин, как свой. Теперь это и твой дом.', en: "I know. Nadia told me. A good old man. Keep his store like your own. It's your home now too.", emo: 'serious' },
  'd7.v.miss': { who: 'valya', ru: 'И мы скучаем. Даже Иван. Иван, скажи.', en: 'And we miss you. Even Ivan. Ivan, say something.', emo: 'smile' },
  'd7.i.miss': { who: 'ivan', ru: '…Скучаем.', en: '…We miss you.' },
  'd7.l.weather': { who: 'lyosha', ru: 'Минус тридцать два, ветер, Гриша опять чинит генератор голыми руками. Всё как обычно.', en: "Minus thirty-two, wind, and Grisha's fixing the generator with his bare hands again. Business as usual.", emo: 'laugh' },
  'd7.n.call': { who: 'nadia', ru: 'Всё, хватит. Канал открыт слишком долго. Рыбка… мы тобой гордимся. Очень.', en: "That's enough. The channel's been open too long. Rybka… we're proud of you. Very.", emo: 'smile' },
  'd7.v.bye': { who: 'valya', ru: 'Ешь суп! Слышишь? Суп!', en: 'Eat soup! You hear me? Soup!', emo: 'smile' },
  'd7.gr.bye': { who: 'grisha', ru: 'Пока, Рыбка! Обнимаю! Крепко!', en: 'Bye, Rybka! Big hug! A tight one!', emo: 'laugh' },
  'd7.l.bye': { who: 'lyosha', ru: 'Урок вечером, не забудь! Цикл for! Лучшее, что есть на свете!', en: "Lesson tonight, don't forget! The for loop! The best thing in the world!", emo: 'smile' },
  'd7.dm.bye': { who: 'dmitri', ru: 'Тихо, Рыбка.', en: 'Quietly, Rybka.', emo: 'smile' },
  'd7.n.supper': { who: 'nadia', ru: 'Вечером Долли кормит всех воскресным ужином. Сходи. Обычное воскресенье — лучшее прикрытие.', en: "Tonight Dolly feeds everyone Sunday supper. Go. An ordinary Sunday is the best cover." },

  // ---- Sunday supper at the Midnight Sun
  'd7.d.supper': { who: 'dolly', en: "Sunday supper! Sit, sit. It's on the house for anybody keeping Sasha's store open. That's one person. That's you.", emo: 'laugh' },
  'd7.h.supper': { who: 'hank', en: "Dolly's pot roast. The only reason I go to church is it ends near pot roast." },
  'd7.p.grey': { who: 'pearl', en: 'Funny thing. There was a man in a grey parka walking down Shore Road this afternoon. Slow. Like he was counting the houses. Friend of yours?' },
  'd7.p.grey2': { who: 'pearl', en: 'Hm. Well, I wrote down his plate. Out of state. I write down everything. It is a sickness.' },
  'd7.p.grey3': { who: 'pearl', en: "Everybody's seen him. Nobody knows him. In this town, that's practically a crime." },
  'd7.g.radio': { who: 'gabriel', en: "Can I tell you something strange? My old radio in the rectory picked up a woman's voice last week. Speaking Russian. Very calm. Saying good night to someone." },
  'd7.n.radio': { who: 'nadia', ru: 'Что? Это была я. Лёша!', en: 'What? That was me. Lyosha!', emo: 'surprise' },
  'd7.l.radio': { who: 'lyosha', ru: 'Вижу. Гармоника ретранслятора, ловится на старый ламповый приёмник. Закрою к утру. Ну батюшка!', en: "I see it. A harmonic off the relay that an old tube receiver can catch. I'll close it by morning. What a priest!" },
  'd7.g.radio2': { who: 'gabriel', en: "That's what I told myself. Fishermen from Chukotka, saying good night to their wives across the water. It's sweet, really.", emo: 'smile' },
  'd7.g.radio3': { who: 'gabriel', en: "Good night, little fish. Isn't that lovely? Some fisherman's wife, I suppose. I said good night back. Nobody answered.", emo: 'smile' },
  'd7.n.radio2': { who: 'nadia', ru: 'Спокойно. Он ничего не понял. Но больше никаких «спокойной ночи» по открытому каналу.', en: "Easy. He didn't understand a thing. But no more 'good nights' on an open channel." },
  'd7.wd.toast': { who: 'wade', en: "To Sasha. And to whoever keeps that stove going till he's back.", emo: 'smile' },
  'd7.d.night': { who: 'dolly', en: "Go home, honey. Get some sleep. You've had a week.", emo: 'smile' },

  // ---- home: someone was here
  'd7.n.door': { who: 'nadia', ru: 'Стоп. Дверь не заперта. А мы запирали, когда уходили.', en: 'Stop. The door is unlocked. We locked it when we left.', emo: 'worry' },
  'd7.n.slow': { who: 'nadia', ru: 'Заходи. Медленно. Ничего не трогай. Просто смотри.', en: "Go in. Slowly. Don't touch anything. Just look.", emo: 'serious' },
  'd7.n.bag': { who: 'nadia', ru: 'Сумка стояла не так. И молния застёгнута до конца — ты так никогда не делаешь.', en: "Your bag wasn't like that. And it's zipped all the way — you never do that.", emo: 'worry' },
  'd7.l.laptop': { who: 'lyosha', ru: 'Три неправильных пароля. Час назад. Ничего они не получили — диск зашифрован.', en: 'Three wrong passwords. An hour ago. They got nothing — the disk is encrypted.', emo: 'serious' },
  'd7.n.someone': { who: 'nadia', ru: 'Значит, здесь кто-то был. Пока весь город ел пирог у Долли.', en: "So someone was here. While the whole town was eating pie at Dolly's.", emo: 'serious' },
  'd7.n.up': { who: 'nadia', ru: 'Не поднимай голову. Датчик дыма над столом. Огонёк синий. Утром был красный.', en: "Don't lift your head. The smoke alarm over the table. Its light is blue. This morning it was red.", emo: 'worry' },
  'd7.l.lens': { who: 'lyosha', ru: 'Увеличиваю… Там объектив. Камера. Смотрит на стол и на дверь.', en: "Zooming in… There's a lens. A camera. It's watching the table and the door.", emo: 'worry' },
  'd7.n.dont': { who: 'nadia', ru: 'Нет! Снимешь — они поймут, что мы знаем. Оставь. Пожалуйста.', en: "No! Take it down and they'll know that we know. Leave it. Please.", emo: 'angry' },
  'd7.n.good': { who: 'nadia', ru: 'Правильно. Пусть смотрят.', en: 'Right. Let them watch.' },
  'd7.n.normal1': { who: 'nadia', ru: 'Дыши. Поставь чайник. Ты дома. Длинный день, обычный вечер.', en: "Breathe. Put the kettle on. You're home. A long day, an ordinary evening." },
  'd7.n.normal2': { who: 'nadia', ru: 'Звука там, скорее всего, нет. Но говорить с нами — только на улице.', en: "There's probably no sound. But talk to us only outside." },
  'd7.l.decoy': { who: 'lyosha', ru: 'Я поставил на ноутбук обманку. Если смотрят — увидят, как плотник учит Python по бесплатному курсу. Скукотища. Идеально.', en: "I've put a decoy on the laptop. If they're watching, they'll see a carpenter learning Python from a free course. Dull as dishwater. Perfect." },
  'd7.n.who': { who: 'nadia', ru: 'Кто это — «Нордстар» или человек в сером? Не знаю. Завтра узнаем. А сегодня ты просто здесь живёшь.', en: "Who was it — Northstar, or the man in grey? I don't know. Tomorrow we find out. Tonight, you just live here.", emo: 'serious' },
  'd7.dm.fear': { who: 'dmitri', ru: 'Страшно — это нормально, Рыбка. Главное, чтобы этого не было видно.', en: "Being afraid is normal, Rybka. What matters is that it doesn't show.", emo: 'serious' },
  'd7.l.lesson': { who: 'lyosha', ru: 'Урок всё равно будет. Сегодня — цикл for. И пусть смотрят: скучнее зрелища не придумаешь.', en: "The lesson's still on. Tonight: the for loop. And let them watch — they couldn't find a duller show." },
  'd7.n.night': { who: 'nadia', ru: 'Спи. Я здесь. Я не сплю.', en: "Sleep. I'm here. I'm not sleeping.", emo: 'smile' },

  // ---- around town on Sunday
  'd7.g.thanks': { who: 'gabriel', en: 'Thank you for the bells. When they ring, the old ones cross themselves and the young ones look up from their phones. Both are prayers, I think.', emo: 'smile' },
  'd7.g.idle': { who: 'gabriel', en: "Sunday afternoons I listen to the radio and lose to myself at chess. Don't tell anyone. It ruins the mystery." },
  'd7.m.car': { who: 'marta', en: 'Somebody reported a car parked on Shore Road last night. Grey sedan, out-of-state plates. You see it?', emo: 'serious' },
  'd7.m.no': { who: 'marta', en: 'Huh. Keep your door locked, then.' },
  'd7.m.parka': { who: 'marta', en: "Grey parka. Half the state wears a grey parka. But thanks. I'll take a look." },
  'd7.m.idle': { who: 'marta', en: 'Quiet Sunday. I hate quiet Sundays. Something always comes after.' },
  'd7.d.rolls': { who: 'dolly', en: 'Cinnamon rolls at the coffee hour, honey. Father Gabriel blesses them, I bake them. Between us, mine is the harder job.', emo: 'laugh' },
  'd7.h.sunday': { who: 'hank', en: "I'm Lutheran. I come for Dolly's rolls and Father Gabriel's sermons. In that order." },
  'd7.ra.sunday': { who: 'ray', en: "Sunday. I don't do church. I do the crossword at the Anchor and argue with God about seven down." },
  'd7.ly.sunday': { who: 'lyle', en: 'Lovely service. I come for the community. And the networking. Mostly the community.', emo: 'smile' },
  'd7.wt.sunday': { who: 'walt', en: 'My wife makes me come. I sleep through the long prayers. Father knows. He prays louder.', emo: 'laugh' },
  'd7.gi.sunday': { who: 'gideon', en: 'Sunday? I work. Northstar never closes, and neither do I. Enjoy your day of rest.', emo: 'smile' },
  'd7.e.sunday': { who: 'evan', en: "Happy Sunday! Northstar's doing a free brunch. Oh, you're church people? So wholesome. Love that for you.", emo: 'smile' },
  'd7.p.sunday': { who: 'pearl', en: 'Sasha called me this morning from Nome. He said, and I quote, tell the kid the cooler is humming wrong.', emo: 'laugh' },
  'd7.el.sunday': { who: 'ellen', en: 'Sunday is my day off. Which means I only see half the patients.' },
  'd7.wd.sunday': { who: 'wade', en: 'Sunday. No mail. Just me, the Dragonfly and a thermos. Best day of the week.' },
  'd7.t.won': { who: 'tommy', en: "Rematch next Saturday. I've been practising. Okay, I've been sulking. Same thing." },
  'd7.t.lost': { who: 'tommy', en: 'Still the champ. Still humble. Mostly still the champ.', emo: 'smile' },
  'd7.t.none': { who: 'tommy', en: 'You missed a good race yesterday. I won. Obviously.' },
  'd7.ni.sunday': { who: 'nina', en: "Sunday Gospel Hour on KZRY. Father Gabriel picks the music. It's a lot of bells this week. I wonder why." },
  'd7.lo.sunday': { who: 'lou', en: "Sunday. Ray's on the crossword. He's been stuck on seven down since October." },
};

// Where people stand in Holy Transfiguration (facing the iconostasis, to the north).
const NAVE = [['ruth', -1.2, 0.6], ['pearl', -1.9, 1.7], ['dolly', 1.8, 0.4], ['tommy', 2.2, 2.0], ['ellen', -0.5, 2.6], ['walt', 0.9, 2.9]];
const inNave = (G, side, fwd) => { const p = at(G, 'church.chandelier', side, fwd); return { ...p, rot: p.rot + Math.PI }; };

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd7.sunday': {
    title: 'Sunday', main: true, day: 7,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Ring the bells for the liturgy';
        m.obj(text, 'church.narthex', "Holy Transfiguration, ten o'clock — the rope hangs under the tower");
        m.ears(['d7.n.morning', 'd7.v.candle']);
        let early = false;
        await hold(m, () => {
          const there = dist(G, 'church.narthex') < 6;
          if (there && !early && s.hour < 9.5 && s.hour > 5) { early = true; m.ear('d7.n.early'); }
          return there && (s.hour >= 9.5 || s.hour < 5);
        }, text, 'church.narthex');
        m.obj(text, 'church.narthex');
        await m.spot('bells', 'church.narthex', 'Ring the bells', 2.4);
        await m.minigame('rope', { title: 'RING FOR THE LITURGY', verb: 'PULL' });
        G.sfx?.bell?.();
        m.flag('d7.bells', true);
        spirit(G, 3, 'the Sunday bells');
        G.attention.add(-5);
        await m.ear('d7.n.bells');
      }
      if (m.cp(2, from)) {
        await m.scene((d) => liturgy(m, d));
        G.attention.add(-8);
        standing(G, 1);
        rel(G, 'gabriel', 6);
      }
      if (m.cp(3, from)) {
        const text = 'Coffee hour — Ruth wants a word';
        place(G, 'ruth', inNave(G, -1.2, 0.6));
        m.obj(text, 'church.chandelier', 'In the church');
        await hold(m, () => !!m.flag('d7.ruthHistory'), text, 'church.chandelier');
        release(G, 'ruth');
        m.done();
        m.start('d7.call');
      }
    },
  },

  'd7.call': {
    title: 'Home', main: true, day: 7,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Video call home — the cabin laptop, 3 pm';
        m.obj(text, 'cabin.desk', 'Shore Road');
        m.ear('d7.n.call0');
        let early = false;
        await hold(m, () => {
          const there = dist(G, 'cabin.desk') < 2.4;
          if (there && !early && s.hour < 14.75 && s.hour > 5) { early = true; m.ear('d7.n.early2'); }
          return there && (s.hour >= 14.75 || s.hour < 5);
        }, text, 'cabin.desk');
      }
      if (m.cp(2, from)) {
        await m.scene((d) => callHome(m, d));
        m.ear('d7.n.supper');
        m.done();
        m.start('d7.home');
      }
    },
  },

  'd7.home': {
    title: 'Uninvited', main: true, day: 7,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Sunday supper at the Midnight Sun — 6 pm';
        m.obj(text, 'diner.door', 'Front Street');
        await hold(m, () => dist(G, 'diner.door') < 9 && (s.hour >= 17.75 || s.hour < 5), text, 'diner.door');
        await m.scene((d) => supper(m, d));
      }
      if (m.cp(2, from)) {
        const text = 'Go home';
        m.obj(text, 'cabin.door', 'Shore Road');
        await hold(m, () => dist(G, 'cabin.door') < 3, text, 'cabin.door');
        m.flag('cabinSearched', true);
        await m.ear('d7.n.door');
        m.ear('d7.n.slow');
        m.obj('Look around. Touch nothing.', 'cabin.table');
        await m.spot('bag', 'cabin.wardrobe', 'Your bag', 2.2);
        await m.ear('d7.n.bag');
        m.obj('Look around. Touch nothing.', 'cabin.desk');
        await m.spot('laptop', 'cabin.desk', 'The laptop — the lid is open', 2.2);
        await m.ears(['d7.l.laptop', 'd7.n.someone']);
      }
      if (m.cp(3, from)) {
        await m.scene(async (d) => {
          await d.bring('player', 'cabin.table');
          d.cam(shot(G, at(G, 'cabin.table', 0.5, 0.6), 1.15, at(G, 'cabin.smokeAlarm'), 0, 46));
          await d.say('nadia', 'd7.n.up', { radio: true });
          await d.wait(0.8);
          await d.say('lyosha', 'd7.l.lens', { radio: true });
          const k = await d.choose(['Rip it out.', 'Leave it. Act normal.']);
          if (k === 0) { m.flag('d7.wantedRipOut', true); await d.say('nadia', 'd7.n.dont', { radio: true }); }
          else await d.say('nadia', 'd7.n.good', { radio: true });
          await d.say('nadia', 'd7.n.normal1', { radio: true, cam: cu(d, 'player', { dist: 0.9 }) });
        });
        m.flag('cameraInSmokeAlarm', true);
        m.obj('Act normal: put the kettle on', 'cabin.stove');
        await m.spot('kettle', 'cabin.stove', 'Put the kettle on', 2.2);
        await m.ears(['d7.n.normal2', 'd7.l.decoy', 'd7.n.who', 'd7.dm.fear']);
      }
      if (m.cp(4, from)) {
        m.ear('d7.l.lesson');
        const text = "Lyosha's lesson — act normal";
        m.obj(text, 'cabin.laptop', 'The decoy screen is up');
        await hold(m, () => !!s.lessons.l07, text, 'cabin.laptop');
        await m.ear('d7.n.night');
        m.done();
      }
    },
  },
};

// The Sunday liturgy at Holy Transfiguration.
async function liturgy(m, d) {
  const G = m.G;
  const doors = at(G, 'church.royalDoors');
  d.cam(shot(G, at(G, 'church.chandelier', 0, 5.5), 2.4, doors, 1.8, 50));
  await d.bring('player', inNave(G, 0.7, 1.3));
  await d.bring('gabriel', { ...doors, rot: doors.rot + Math.PI });
  for (const [id, side, fwd] of NAVE) await d.bring(id, inNave(G, side, fwd));
  await d.wait(1.2);
  await d.say('gabriel', 'd7.g.peace', { cam: cu(d, 'gabriel') });
  await d.say('f2', 'd7.f.mercy');
  await d.say('gabriel', 'd7.g.sasha', { cam: cu(d, 'gabriel', { side: -1 }) });
  await d.say('f2', 'd7.f.mercy', { cam: cu(d, 'ruth') });
  await d.say('nadia', 'd7.n.choir', { radio: true });
  await d.say('valya', 'd7.v.hear', { radio: true });
  const k = await d.choose(['Light a candle for Sasha.', 'Light two: one for Sasha, one for friends far away.']);
  m.flag('d7.candles', k === 0 ? 'one' : 'two');
  const candle = cu(d, 'player', { dist: 0.8 });
  if (candle) d.cam(candle);
  await d.wait(1.0);
  if (k === 1) await d.say('valya', 'd7.v.thanks', { radio: true });
  await d.say('gabriel', 'd7.g.sermon', { cam: cu(d, 'gabriel') });
  await d.say('gabriel', 'd7.g.end');
}

// Sunday, three o'clock: the team on the laptop screen.
async function callHome(m, d) {
  const G = m.G;
  await d.bring('player', 'cabin.desk', { sit: true });
  d.cam(shot(G, at(G, 'cabin.desk', 0.35, -1.1), 1.55, at(G, 'cabin.laptop'), 0.15, 38));
  G.sfx?.phone?.();
  // A screen-share for the faces in Bely Mys, if the engine offers one (it is a no-op otherwise).
  d.call?.(['valya', 'dmitri', 'lyosha', 'grisha', 'ivan']);
  await d.say('nadia', 'd7.n.call1', { radio: true });
  await d.say('valya', 'd7.v.hello');
  await d.say('grisha', 'd7.gr.hello');
  await d.say('lyosha', 'd7.l.hello');
  await d.say('dmitri', 'd7.dm.hello', { cam: cu(d, 'player', { side: -1 }) });
  await d.say('valya', 'd7.v.socks');
  await d.say('grisha', 'd7.gr.socks');
  await d.say('valya', 'd7.v.bear');
  await d.say('grisha', 'd7.gr.sandwich');
  const k = await d.choose(['Tell them about Koshkin.', 'Tell them you miss them.', "Ask what the weather's like at home."]);
  if (k === 0) {
    await d.you("Koshkin's heart gave out. I'm running his store now.");
    await d.say('dmitri', 'd7.dm.koshkin');
  } else if (k === 1) {
    await d.you('I miss you. All of you. Even the tea.');
    await d.say('valya', 'd7.v.miss');
    await d.say('ivan', 'd7.i.miss');
  } else {
    await d.you("What's the weather like at home?");
    await d.say('lyosha', 'd7.l.weather');
  }
  m.flag('d7.call', ['koshkin', 'miss', 'weather'][k] || 'koshkin');
  await d.say('nadia', 'd7.n.call', { radio: true, cam: cu(d, 'player', { dist: 0.7 }) });
  await d.say('valya', 'd7.v.bye');
  await d.say('grisha', 'd7.gr.bye');
  await d.say('lyosha', 'd7.l.bye');
  await d.say('dmitri', 'd7.dm.bye');
  d.hangUp?.();
  await d.wait(1.0);
}

// Sunday supper at Dolly's.
async function supper(m, d) {
  const G = m.G;
  await d.bring('player', 'diner.booth3', { sit: true });
  await d.bring('pearl', 'diner.booth2', { sit: true });
  await d.bring('gabriel', 'diner.booth4', { sit: true });
  await d.bring('wade', 'diner.booth1', { sit: true });
  await d.bring('hank', 'diner.stool2', { sit: true });
  await d.bring('dolly', 'diner.counter');
  G.sfx?.crowd?.(0.2);
  await d.say('dolly', 'd7.d.supper', { cam: cu(d, 'dolly') });
  await d.say('hank', 'd7.h.supper', { cam: cu(d, 'hank') });
  await d.say('pearl', 'd7.p.grey', { cam: cu(d, 'pearl') });
  const k = await d.choose(['No idea who that is.', "Grey parka? I've seen him around."]);
  await d.say('pearl', k === 0 ? 'd7.p.grey2' : 'd7.p.grey3', { cam: cu(d, 'pearl', { side: -1 }) });
  m.flag('d7.greyOnShore', true);
  await d.say('gabriel', 'd7.g.radio', { cam: cu(d, 'gabriel') });
  await d.say('nadia', 'd7.n.radio', { radio: true });
  await d.say('lyosha', 'd7.l.radio', { radio: true });
  const q = await d.choose(['Russian? Out here? Fishermen, probably.', 'What did she say?']);
  await d.say('gabriel', q === 0 ? 'd7.g.radio2' : 'd7.g.radio3', { cam: cu(d, 'gabriel', { side: -1 }) });
  await d.say('nadia', 'd7.n.radio2', { radio: true });
  m.flag('relayLeak', true);
  await d.say('wade', 'd7.wd.toast', { cam: cu(d, 'wade') });
  await d.say('dolly', 'd7.d.night', { cam: cu(d, 'dolly') });
  G.sfx?.crowd?.(0);
  rel(G, 'dolly', 4); rel(G, 'pearl', 3); rel(G, 'gabriel', 3);
}

// ---------------------------------------------------------------- conversations
export const DIALOG = {
  ruth: async (c, prev) => {
    if (c.day !== 7) return prev(c);
    if (c.flag('d7.bells') && !c.flag('d7.ruthHistory')) {
      await c.say('ruth', 'd7.r.h1');
      await c.say('ruth', 'd7.r.h2');
      await c.say('ruth', 'd7.r.h3');
      await c.say('ruth', 'd7.r.h4');
      await c.say('ruth', 'd7.r.h5');
      const k = await c.choose(['And did they?', 'Why do you stay on the council?']);
      await c.say('ruth', k === 0 ? 'd7.r.h6' : 'd7.r.h7');
      await c.say('ruth', 'd7.r.h8');
      c.rel(8);
      c.flag('d7.ruthHistory', true);
      c.emit('talk:ruth');
      return;
    }
    return idle(c, prev, 'ruth', 'd7.r.idle');
  },

  gabriel: async (c, prev) => {
    if (c.day !== 7) return prev(c);
    if (c.flag('d7.bells') && !c.flag('d7.g.thanked')) { c.flag('d7.g.thanked', true); await c.say('gabriel', 'd7.g.thanks'); c.rel(4); return; }
    return idle(c, prev, 'gabriel', 'd7.g.idle');
  },

  marta: async (c, prev) => {
    if (c.day !== 7) return prev(c);
    if (!c.flag('d7.m.asked')) {
      c.flag('d7.m.asked', true);
      await c.say('marta', 'd7.m.car');
      const k = await c.choose(['No.', "I've seen a man in a grey parka around."]);
      if (k === 1) { await c.say('marta', 'd7.m.parka'); c.flag('d7.toldMartaGrey', true); c.rel(4); } else await c.say('marta', 'd7.m.no');
      return;
    }
    return idle(c, prev, 'marta', 'd7.m.idle');
  },

  tommy: async (c, prev) => {
    if (c.day !== 7) return prev(c);
    const r = c.flag('d6.race');
    return idle(c, prev, 'tommy', r === 'won' ? 'd7.t.won' : r === 'lost' ? 'd7.t.lost' : 'd7.t.none');
  },

  dolly: async (c, prev) => (c.day === 7 ? idle(c, prev, 'dolly', 'd7.d.rolls') : prev(c)),
  hank: async (c, prev) => (c.day === 7 ? idle(c, prev, 'hank', 'd7.h.sunday') : prev(c)),
  ray: async (c, prev) => (c.day === 7 ? idle(c, prev, 'ray', 'd7.ra.sunday') : prev(c)),
  lyle: async (c, prev) => (c.day === 7 ? idle(c, prev, 'lyle', 'd7.ly.sunday') : prev(c)),
  walt: async (c, prev) => (c.day === 7 ? idle(c, prev, 'walt', 'd7.wt.sunday') : prev(c)),
  gideon: async (c, prev) => (c.day === 7 ? idle(c, prev, 'gideon', 'd7.gi.sunday') : prev(c)),
  evan: async (c, prev) => (c.day === 7 ? idle(c, prev, 'evan', 'd7.e.sunday') : prev(c)),
  pearl: async (c, prev) => (c.day === 7 ? idle(c, prev, 'pearl', 'd7.p.sunday') : prev(c)),
  ellen: async (c, prev) => (c.day === 7 ? idle(c, prev, 'ellen', 'd7.el.sunday') : prev(c)),
  wade: async (c, prev) => (c.day === 7 ? idle(c, prev, 'wade', 'd7.wd.sunday') : prev(c)),
  nina: async (c, prev) => (c.day === 7 ? idle(c, prev, 'nina', 'd7.ni.sunday') : prev(c)),
  lou: async (c, prev) => (c.day === 7 ? idle(c, prev, 'lou', 'd7.lo.sunday') : prev(c)),
};

export const DIALOG_OVERRIDE = true;
