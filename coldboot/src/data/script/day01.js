export const DAY = { n: 1, start: ['d1.arrival'], mustFinish: ['d1.cabin'] };

// DAY 1 — Hello, Port Zarya. The airstrip, Wade, the town, Koshkin's cabin,
// Father Gabriel's frayed bell rope, and the relay in the bell tower.

export const LINES = {
  // ---- the earpiece (Nadia, Lyosha)
  'd1.n.terminal': { who: 'nadia', ru: 'Видишь сарай с вывеской? Это и есть терминал. Иди туда.', en: 'See the shed with the sign? That is the terminal. Go.' },
  'd1.n.walk': { who: 'nadia', ru: 'Пешком? Хорошо. Три километра — заодно посмотришь город. Дорога одна, не заблудишься.', en: "Walking? Fine. Three kilometres — you'll see the town on the way. There's only one road; you can't get lost." },
  'd1.n.ride': { who: 'nadia', ru: 'Хорошо. Местный пилот — полезное знакомство. Запомни его.', en: 'Good. A local pilot is a useful friend. Remember him.' },
  'd1.n.koshkin': { who: 'nadia', ru: 'Магазин Кошкина — на площади, напротив «Нордстара». Старое деревянное здание. Не перепутай.', en: "Koshkin's store is on the square, across from Northstar. The old wooden building. Don't mix them up." },
  'd1.n.evan': { who: 'nadia', ru: 'Стоп. Откуда он знает твоё имя? В Порт-Заре ты меньше часа.', en: "Stop. How does he know your name? You've been in Port Zarya less than an hour." },
  'd1.n.evan2': { who: 'nadia', ru: 'Улыбайся и уходи. Это их глаза. Мы это запомним.', en: "Smile and leave. Those are their eyes. We'll remember this." },
  'd1.n.cabin': { who: 'nadia', ru: 'Хижина на берегу, западнее. Иди, осмотрись. Нам нужно жильё и тихий угол для ноутбука.', en: 'The cabin is on the shore, to the west. Go and look around. We need a roof and a quiet corner for the laptop.' },
  'd1.n.relay': { who: 'nadia', ru: 'Связь слабая — наушник берёт через пролив еле-еле. Нужен ретранслятор повыше. Самая высокая точка в городе — колокольня.', en: 'The signal is weak — the earpiece barely reaches across the strait. We need a relay up high. The highest point in town is the bell tower.' },
  'd1.l.relay': { who: 'lyosha', ru: 'Ретранслятор у тебя в сумке, маленькая серая коробочка. Просто закрепи его наверху и включи. Всё остальное — моя работа.', en: "The relay's in your bag, the little grey box. Just fix it up top and switch it on. The rest is my job." },
  'd1.n.priest': { who: 'nadia', ru: 'Колокольня — это церковь. Церковь — это священник. Сначала познакомься с ним.', en: 'The bell tower means the church. The church means the priest. Meet him first.' },
  'd1.n.rope': { who: 'nadia', ru: 'Верёвка для колокола. Ты плотник — почини. Лучший пропуск наверх.', en: "A bell rope. You're a carpenter — fix it. Best ticket up there there is." },
  'd1.n.hank': { who: 'nadia', ru: 'Верёвка — в хозяйственном магазине на Фронт-стрит. Брубейкер. Он в совете города.', en: "Rope — at the hardware store on Front Street. Brubaker. He's on the town council." },
  'd1.n.climb': { who: 'nadia', ru: 'Теперь наверх. Тихо. Вокруг площади камеры «Нордстара» — не стой под ними дольше, чем нужно.', en: "Now up. Quietly. Northstar has cameras around the square — don't stand under them longer than you need to." },
  'd1.l.online': { who: 'lyosha', ru: 'Есть! Сигнал чистый, как слеза. Добро пожаловать в Порт-Зарю.', en: "Got it! Signal's clear as a teardrop. Welcome to Port Zarya." },
  'd1.n.lesson': { who: 'nadia', ru: 'Хорошая работа. Возвращайся в хижину. Лёша ждёт тебя на ноутбуке — первый урок.', en: 'Good work. Go back to the cabin. Lyosha is waiting on the laptop — your first lesson.' },
  'd1.n.sleep': { who: 'nadia', ru: 'На сегодня всё. Спи. Завтра — работа у Кошкина и совет города. Спокойной ночи, Рыбка.', en: "That's all for today. Sleep. Tomorrow — work at Koshkin's and the town council. Good night, Rybka." },
  'd1.n.notyet': { who: 'nadia', ru: 'Рано спать. Сначала ретранслятор.', en: 'Too early to sleep. The relay first.' },
  // ---- Koshkin
  'd1.k.hello': { who: 'koshkin', en: "Shut the door, you're letting the cold in. Well? You buying or browsing?" },
  'd1.k.who': { who: 'koshkin', en: "Ah. The carpenter. Pearl at the post office said somebody was coming in on the morning plane. Nothing happens here without Pearl knowing." },
  'd1.k.cabin': { who: 'koshkin', en: "My brother's cabin. Yuri. He passed in the spring. Stove works, roof leaks a little on the north side, the view is the best in town. A hundred fifty a week." },
  'd1.k.deal': { who: 'koshkin', en: "Good. Here's the key. And if you're any good with a hammer, come by in the morning. I've got more broken things than customers these days." },
  'd1.k.haggle': { who: 'koshkin', en: "Hundred and twenty then, and you fix the roof. Ha. You're not from here, but you're not stupid. Here's the key." },
  'd1.k.spasibo': { who: 'koshkin', ru: 'Спасибо? Ха! Давно я не слышал. Мой дед говорил по-русски. В этом городе многие деды говорили.', en: "Spasibo? Ha! Haven't heard that in a long time. My grandfather spoke Russian. Lots of grandfathers in this town did." },
  'd1.k.northstar': { who: 'koshkin', en: "That glass box across the square? Opened in June. Cheaper milk, prettier lights, cameras in every corner. Half my customers walked over there. They'll walk back. Maybe." },
  'd1.k.bye': { who: 'koshkin', en: "Go on. And don't let Evan over there sell you a sandwich. Twelve dollars. Twelve!" },
  'd1.k.again': { who: 'koshkin', en: "Still here? Cabin's the last one on Shore Road, past the bar. Can't miss it — it's the one leaning." },
  // ---- Evan at NORTHSTAR 24
  'd1.e.hello': { who: 'evan', en: "Good evening, and welcome to Northstar Twenty-Four! You must be the new carpenter. We're so glad you've joined our community." },
  'd1.e.name': { who: 'evan', en: "Oh, small town! Everybody knows everybody. Can I interest you in a fresh hot coffee? First one's on Northstar." },
  'd1.e.no': { who: 'evan', en: "No problem at all. We're always open. Always. Have a wonderful night." },
  'd1.e.yes': { who: 'evan', en: "Wonderful! Oat, almond or whole? I'm kidding. It's whole. Enjoy, and remember — Northstar's always here for you." },
  // ---- Father Gabriel
  'd1.g.hello': { who: 'gabriel', en: "Welcome, welcome. Come in out of the snow. You're the new face everyone's talking about. I'm Father Gabriel. This church has stood here since eighteen thirty-one." },
  'd1.g.tower': { who: 'gabriel', en: "The bell tower? Nobody's been up there since the rope gave out at the Easter service. The bell hasn't rung since. Feels like the town's been holding its breath." },
  'd1.g.fix': { who: 'gabriel', en: "You'd do that? Bless you. Hank Brubaker has good hemp rope at the hardware store. If you fix it, ring it once for me. Let the town hear it." },
  'd1.g.thanks': { who: 'gabriel', en: "Listen to that. Lord. Thank you, friend. The tower is yours whenever you like — the view up there is something." },
  'd1.g.again': { who: 'gabriel', en: "Come by on Sunday for the liturgy. We don't have much of a choir, but we have a lot of heart." },
  // ---- Hank
  'd1.h.hello': { who: 'hank', en: "Brubaker Hardware and Fuel. If we don't have it, you don't need it. What do you want?" },
  'd1.h.rope': { who: 'hank', en: "Bell rope, huh. Father's been after somebody to do that since spring. Hemp, inch thick, thirty feet. Twenty-five bucks." },
  'd1.h.sold': { who: 'hank', en: "There you go. You fix that bell, people'll notice. People notice everything here. Remember that." },
  'd1.h.broke': { who: 'hank', en: "No money, no rope. Come back when you've got twenty-five dollars." },
  'd1.h.again': { who: 'hank', en: "Need anything else, I'm here till six. Lumber, paint, nails, glass, wire. Fuel out back." },
  // ---- Dolly
  'd1.d.hello': { who: 'dolly', en: "Well hello, stranger! Sit anywhere, honey, it's not like we're busy. Coffee's hot. First cup's on the house for new faces." },
  'd1.d.gossip': { who: 'dolly', en: "So you're the carpenter Pearl's been talking about. Lord, this town needs one. Half the roofs on Second Avenue are held up by prayer and duct tape." },
  'd1.d.council': { who: 'dolly', en: "Council meets Tuesday nights at City Hall, seven sharp. I'm on it, for my sins. Come watch — it's the best free entertainment in town." },
  'd1.d.bye': { who: 'dolly', en: "Come back for pie. Blueberry. My mother's recipe. It'll fix whatever's wrong with you." },
  // ---- Wade (at the airstrip; the hello/ride lines live in prologue.js)
  'd1.w.walk': { who: 'wade', en: "Suit yourself. Stick to the road. And if a black SUV slows down next to you, just keep walking. They do that." },
  'd1.w.drive': { who: 'wade', en: "Hop in. Heater works if you hit it. So, what brings a carpenter to the edge of the world in November?" },
  'd1.w.drive2': { who: 'wade', en: "Ha. Fair enough. Everybody up here is running from something or towards something. Here we are. Welcome to Port Zarya." },
  'd1.w.again': { who: 'wade', en: "Need a lift somewhere? I only fly to Nome and back. Lessons, maybe. Ever wanted to fly a chopper?" },
};

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd1.arrival': {
    title: 'Port Zarya', main: true, day: 1,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Walk to the terminal', 'terminal');
        await m.wait(1.5);
        await m.ear('a.nadia.ground');
        await m.ear('d1.n.terminal');
        await m.reach('wade', 4);
      }
      if (m.cp(2, from)) {
        m.clear();
        let ride = false;
        await G.dialog.run(G.npcs.get('wade'), async (c) => {
          await c.say('wade', 'a.wade.hello');
          await c.you(`${G.state.name}. I'm a carpenter.`);
          await c.say('wade', 'a.wade.carpenter');
          await c.say('wade', 'a.wade.ride');
          const k = await c.choose(['Thanks — I could use a ride.', "I'll walk. I want to see the place."]);
          ride = k === 0;
          if (ride) { await c.say('wade', 'd1.w.drive'); await c.you('Work. Quiet. That kind of thing.'); await c.say('wade', 'd1.w.drive2'); c.rel(8); }
          else { await c.say('wade', 'd1.w.walk'); c.rel(3); }
          await c.say('wade', 'a.wade.northstar');
        });
        m.flag('rodeWithWade', ride);
        if (ride) {
          await m.ear('d1.n.ride');
          await G.fadeTeleport({ x: 18, z: 30, yaw: Math.PI }, 2.0);
        } else {
          await m.ear('d1.n.walk');
          m.obj('Walk into town', { x: 110, z: 40 }, 'Follow Airport Road west');
          await m.reach({ x: 110, z: 40 }, 30);
        }
      }
      if (m.cp(3, from)) {
        await G.reveal();
        m.done();
        m.start('d1.koshkin');
      }
    },
  },
  'd1.koshkin': {
    title: 'A Roof', main: true, day: 1,
    async run(m, from) {
      if (m.cp(1, from)) {
        m.obj("Find Koshkin's General Store", 'koshkin', 'On the square, across from Northstar');
        m.ear('d1.n.koshkin');
        await m.talk('koshkin');
      }
      if (m.cp(2, from)) {
        m.done();
        m.start('d1.cabin');
      }
    },
  },
  'd1.cabin': {
    title: 'The Relay', main: true, day: 1,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Go to your cabin', 'cabin', 'Shore Road, west of the bar');
        await m.ear('d1.n.cabin');
        await m.reach('cabin', 7);
        G.state.flags.hasCabin = true;
      }
      if (m.cp(2, from)) {
        await m.ear('d1.n.relay');
        await m.ear('d1.l.relay');
        await m.ear('d1.n.priest');
        m.obj('Talk to Father Gabriel at the church', 'gabriel');
        await m.talk('gabriel');
      }
      if (m.cp(3, from)) {
        m.ear('d1.n.rope');
        m.ear('d1.n.hank');
        m.obj('Buy hemp rope at Brubaker Hardware', 'hank', '$25');
        await m.until(() => (G.state.inv.hemp_rope || 0) > 0);
      }
      if (m.cp(4, from)) {
        m.obj('Fix the bell rope', 'church.ladderBottom', 'In the church, under the tower');
        await m.spot('rope', 'church.ladderBottom', 'Fix the bell rope', 2.2);
        const ok = await m.minigame('rope', { title: 'SPLICE THE BELL ROPE' });
        G.state.inv.hemp_rope = 0;
        G.state.spirit += 5;
        G.hud.toast('TOWN SPIRIT', '+5  The bell rope is fixed', '#ffd166');
        m.obj('Ring the bell', 'church.ladderBottom');
        await m.spot('ring', 'church.ladderBottom', 'Ring the bell', 2.2);
        G.sfx?.bell?.();
        G.state.flags.bellFixed = true;
        await m.wait(2.5);
        void ok;
      }
      if (m.cp(5, from)) {
        m.ear('d1.n.climb');
        m.obj('Climb the bell tower and plant the relay', 'church.belfry');
        await m.spot('relay', 'church.belfry', 'Plant the relay', 2.5);
        G.attention.act(0.8, 3);
        await m.minigame('wire', { title: 'WIRE THE RELAY' });
        await m.ear('d1.l.online');
        G.state.flags.relay = true;
      }
      if (m.cp(6, from)) {
        await m.ear('d1.n.lesson');
        m.obj("Lyosha's first lesson — the laptop in your cabin", 'cabin.laptop');
        await m.until(() => G.state.lessons.l01);
        await m.ear('d1.n.sleep');
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
export const DIALOG = {
  koshkin: async (c) => {
    const s = c.state;
    if (!c.flag('koshkinMet')) {
      await c.say('koshkin', 'd1.k.hello');
      await c.you(`I'm ${s.name}. I heard you have a cabin to rent.`);
      await c.say('koshkin', 'd1.k.who');
      await c.say('koshkin', 'd1.k.cabin');
      const k = await c.choose(['Deal. ($150)', 'How about $120 — and I fix that roof?', 'Spasibo. (Thank you, in Russian.)']);
      if (k === 2) {
        await c.say('koshkin', 'd1.k.spasibo');
        c.rel(10);
        c.flag('koshkinRussian', true);
        const k2 = await c.choose(['Deal. ($150)', 'How about $120 — and I fix that roof?']);
        if (k2 === 1) { await c.say('koshkin', 'd1.k.haggle'); c.money(-120, 'cabin, week 1'); c.flag('fixKoshkinRoof', true); }
        else { await c.say('koshkin', 'd1.k.deal'); c.money(-150, 'cabin, week 1'); }
      } else if (k === 1) { await c.say('koshkin', 'd1.k.haggle'); c.money(-120, 'cabin, week 1'); c.flag('fixKoshkinRoof', true); c.rel(4); }
      else { await c.say('koshkin', 'd1.k.deal'); c.money(-150, 'cabin, week 1'); c.rel(6); }
      c.give('cabin_key');
      const k3 = await c.choose(["What's the deal with that store across the square?", "I'll see you in the morning."]);
      if (k3 === 0) await c.say('koshkin', 'd1.k.northstar');
      await c.say('koshkin', 'd1.k.bye');
      c.flag('koshkinMet', true);
      c.emit('talk:koshkin');
      return;
    }
    if (c.day === 1) { await c.say('koshkin', 'd1.k.again'); return; }
    await c.say('koshkin', 'd1.k.again');
  },
  evan: async (c) => {
    if (!c.flag('evanMet')) {
      c.flag('evanMet', true);
      await c.say('evan', 'd1.e.hello');
      await c.you('…Do I know you?');
      await c.say('evan', 'd1.e.name');
      c.G.missions.ear('d1.n.evan');
      const k = await c.choose(['Sure, I’ll take a coffee.', 'No thanks.']);
      if (k === 0) { await c.say('evan', 'd1.e.yes'); c.give('northstar_coffee'); c.attention(4); } else await c.say('evan', 'd1.e.no');
      c.G.missions.ear('d1.n.evan2');
      return;
    }
    await c.say('evan', 'd1.e.no');
  },
  gabriel: async (c) => {
    if (!c.flag('gabrielMet')) {
      c.flag('gabrielMet', true);
      await c.say('gabriel', 'd1.g.hello');
      const k = await c.choose(['Can I see the bell tower?', 'It’s a beautiful church.']);
      if (k === 1) { c.rel(5); await c.you('It’s beautiful. The domes caught my eye from the road.'); }
      await c.say('gabriel', 'd1.g.tower');
      await c.you("I'm a carpenter. I could fix that rope for you.");
      await c.say('gabriel', 'd1.g.fix');
      c.rel(6);
      c.emit('talk:gabriel');
      return;
    }
    if (c.flag('bellFixed') && !c.flag('gabrielThanked')) { c.flag('gabrielThanked', true); await c.say('gabriel', 'd1.g.thanks'); c.rel(10); return; }
    await c.say('gabriel', 'd1.g.again');
  },
  hank: async (c) => {
    await c.say('hank', 'd1.h.hello');
    const opts = [];
    if (c.G.missions.isActive('d1.cabin') && !c.hasItem('hemp_rope') && !c.flag('bellFixed')) opts.push({ label: 'I need bell rope. Hemp. ($25)', key: 'rope' });
    opts.push({ label: 'Just looking.', key: 'bye' });
    const k = await c.choose(opts);
    if (k === 'rope') {
      await c.say('hank', 'd1.h.rope');
      if (c.state.money >= 25) { c.money(-25, 'hemp rope'); c.give('hemp_rope'); await c.say('hank', 'd1.h.sold'); c.rel(4); }
      else await c.say('hank', 'd1.h.broke');
      c.emit('talk:hank');
      return;
    }
    await c.say('hank', 'd1.h.again');
  },
  dolly: async (c) => {
    if (!c.flag('dollyMet')) {
      c.flag('dollyMet', true);
      await c.say('dolly', 'd1.d.hello');
      c.give('diner_coffee');
      c.state.stats.coffees++;
      await c.say('dolly', 'd1.d.gossip');
      const k = await c.choose(['Who runs this town, anyway?', 'Thanks for the coffee.']);
      if (k === 0) { await c.say('dolly', 'd1.d.council'); c.flag('knowsCouncil', true); }
      c.rel(8);
      await c.say('dolly', 'd1.d.bye');
      return;
    }
    await c.say('dolly', 'd1.d.bye');
  },
  wade: async (c) => { await c.say('wade', 'd1.w.again'); },
};
