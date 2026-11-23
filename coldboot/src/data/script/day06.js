// DAY 6 — Open for Business (Saturday). Koshkin is stable in Nome; Rybka
// opens his store at nine, as promised. Across the square NORTHSTAR 24 sells
// milk at a loss. Ruth Aqpik is the first customer on purpose. A day at the
// till (m.job('shop')), a call from Koshkin's hospital bed, and Evan Pike
// dropping by with coffee, an offer for the building, and a smiling threat.
// Optional: the Saturday Shootout on Loon Lake — once around the flags against
// Tommy Aqpik, Nina calling it live on KZRY. At night Nadia and Ivan lay out how
// Northstar's money reaches the council. Night School lesson 6.
//
// ---------------------------------------------------------------- repairs used
//   none today.
//
// ---------------------------------------------------------------- flags set
//   d6.opened        Rybka opened Koshkin's on day 6 (the promise kept)
//   d6.evanOffer     'no' | 'pass' | 'out' — Rybka's answer to Northstar's offer for the building
//   d6.race          'won' | 'lost' | 'missed' — the Saturday Shootout (optional)
//   knowsNorthstarMoney  Nadia's briefing: Pruitt "consulting", the mayor's campaign ($25k via
//                    "Friends of Port Zarya"), Shaw "adviser"; Hank, Ruth, Ray take nothing (sets up day 12's ledger)
//   d6.g.bells       Father Gabriel asked Rybka to ring the bells before Sunday's liturgy
import {
  at, yawTo, dist, cu, shot, rel, standing, place, warp, release, hold, passTime, idle,
} from './day02.js';

export const DAY = { n: 6, start: ['d6.open'], mustFinish: ['d6.open', 'd6.money'] };

export const LINES = {
  // ---- the earpiece
  'd6.n.morning': { who: 'nadia', ru: 'Уэйд позвонил Пёрл, а Пёрл — всему городу: Кошкин в больнице в Номе, состояние стабильное.', en: "Wade called Pearl, and Pearl called the whole town: Koshkin's in the hospital in Nome. Stable." },
  'd6.n.open': { who: 'nadia', ru: 'Девять часов. Открывай магазин. Обещание есть обещание.', en: "Nine o'clock. Open the store. A promise is a promise." },
  'd6.l.prices': { who: 'lyosha', ru: 'Смотри, напротив. «Молоко — доллар девяносто девять». Вчера было четыре пятьдесят. Они торгуют себе в убыток. Специально.', en: "Look across the square. 'Milk, one ninety-nine.' Yesterday it was four fifty. They're selling at a loss. On purpose." },
  'd6.l.math': { who: 'lyosha', ru: 'Я посчитал: если «Нордстар» снижает цены, надо продавать больше, а не дешевле. Или дешевле. Я программист, а не торговец.', en: "I ran the numbers: when Northstar cuts prices, we need to sell more, not cheaper. Or cheaper. I'm a programmer, not a shopkeeper." },
  'd6.n.ruth': { who: 'nadia', ru: 'Видишь? Город на нашей стороне. Не весь — но лучшая его часть.', en: "See? The town is on our side. Not all of it — but the best part.", emo: 'smile' },
  'd6.n.shop': { who: 'nadia', ru: 'Не задирай цены — уйдут к Эвану. Но и в убыток не торгуй. Кошкин семьдесят лет держал середину.', en: "Don't jack up the prices, or they'll walk over to Evan. But don't sell at a loss either. Koshkin held the middle for seventy years." },
  'd6.v.shop': { who: 'valya', ru: 'Главное в торговле — улыбка и честные весы. Улыбка у тебя есть. Весы проверь.', en: 'The main things in trade are a smile and honest scales. You have the smile. Check the scales.', emo: 'smile' },
  'd6.l.till': { who: 'lyosha', ru: 'Касса пятьдесят второго года. Она старше интернета. И надёжнее.', en: "That till is from nineteen fifty-two. It's older than the internet. And more reliable." },
  'd6.l.money': { who: 'lyosha', ru: 'Двадцать пять тысяч на выборы в городе, где тысяча с небольшим человек. Это двадцать два доллара на избирателя. Я посчитал.', en: "Twenty-five thousand on an election in a town of just over a thousand people. That's twenty-two dollars a voter. I did the math." },
  'd6.n.shopDone': { who: 'nadia', ru: 'Неплохо для первого дня. Касса цела, покупатели живы.', en: 'Not bad for a first day. The till survived, and so did the customers.', emo: 'smile' },
  'd6.n.threat': { who: 'nadia', ru: 'Это была угроза. Вежливая. Самые неприятные угрозы — вежливые.', en: 'That was a threat. A polite one. The nastiest threats are the polite ones.', emo: 'serious' },
  'd6.n.race': { who: 'nadia', ru: 'Гонка? Ну что ж. Люди любят тех, кто приходит на их праздники.', en: 'A race? All right. People love the ones who show up for their celebrations.', emo: 'smile' },
  'd6.gr.race': { who: 'grisha', ru: 'Давай, Рыбка! Обгоняй! У нас тут тотализатор, я на тебя поставил!', en: "Go, Rybka! Overtake him! We've got a sweepstake going here — my money's on you!", emo: 'laugh' },
  'd6.v.race': { who: 'valya', ru: 'Гриша, а на что ты спорил? Уж не на мои ли носки?', en: 'Grisha, what exactly did you bet? Not my socks, I hope?', emo: 'smile' },
  'd6.n.close': { who: 'nadia', ru: 'Шесть часов. Закрывай магазин и иди домой. Есть новости — не по радио.', en: "Six o'clock. Lock up the store and go home. There's news — not for the radio." },
  'd6.n.b0': { who: 'nadia', ru: 'Иван всю неделю читал, что «Нордстар» публикует. И чего не публикует.', en: "All week Ivan has been reading what Northstar publishes. And what it doesn't." },
  'd6.n.b1': { who: 'nadia', ru: 'Деньги «Нордстара» идут в совет. Не напрямую — через фонды, консалтинг, пожертвования.', en: "Northstar's money flows into the council. Not directly: through foundations, consulting, donations.", emo: 'serious' },
  'd6.i.b1': { who: 'ivan', ru: 'Пруитт. «Консультации». Каждый месяц.', en: "Pruitt. 'Consulting.' Every month." },
  'd6.n.b2': { who: 'nadia', ru: 'Кампания мэра — двадцать пять тысяч. От «Друзей Порт-Зари». «Друзья» зарегистрированы в Делавэре, по адресу «Нордстара».', en: "The mayor's campaign: twenty-five thousand. From 'Friends of Port Zarya'. The friends are registered in Delaware, at Northstar's address." },
  'd6.i.b2': { who: 'ivan', ru: 'Шоу — «советник». Тоже на зарплате.', en: "Shaw: 'adviser'. Also on the payroll." },
  'd6.n.b3': { who: 'nadia', ru: 'Но это тени, а не доказательства. Нужен сам реестр платежей. Он где-то в мэрии — или на холме.', en: "But these are shadows, not proof. We need the payment ledger itself. It's somewhere in City Hall — or up on the hill." },
  'd6.dm.b': { who: 'dmitri', ru: 'Деньги — как верёвка. Кто платит, тот и тянет. Найдём верёвку — поймём, за что тянуть нам.', en: "Money is like a rope. Whoever pays, pulls. Find the rope, and we'll know where to pull ourselves.", emo: 'serious' },
  'd6.n.b4': { who: 'nadia', ru: 'И главное. Хэнк, Рут и Рэй денег не берут. Долли — не знаю, но вряд ли. Если повезёт, вот наши трое.', en: "And the main thing. Hank, Ruth and Ray don't take the money. Dolly — I don't know, but I doubt it. If we're lucky, those are our three." },
  'd6.v.b': { who: 'valya', ru: 'Трое честных на пятерых. Для маленького города — неплохо. В Москве и одного бы не нашли.', en: "Three honest people out of five. Not bad for a small town. In Moscow you wouldn't find one.", emo: 'smile' },
  'd6.l.lesson': { who: 'lyosha', ru: 'Списки! Полка в магазине Кошкина — это список. Теперь эта полка твоя, так что тебе и карты в руки.', en: "Lists! A shelf in Koshkin's store is a list. That shelf is yours now, so you're the expert.", emo: 'smile' },
  'd6.n.night': { who: 'nadia', ru: 'Магазин открыт, город с нами, деньги нашлись. Хороший день, Рыбка. Спи.', en: 'The store is open, the town is with us, and we found the money. A good day, Rybka. Sleep.', emo: 'smile' },

  // ---- the store: Ruth, Koshkin on the phone, Evan
  'd6.r.first': { who: 'ruth', en: 'Good morning. I have bought my tea in this store for fifty years. I am not about to buy it from a machine with a smile. Black tea, please. The Russian one.' },
  'd6.r.sasha': { who: 'ruth', en: "And when Sasha calls, tell him Ruth Aqpik was the first customer. He'll pretend not to care. He'll care.", emo: 'smile' },
  'd6.f.card': { who: 'f2', name: 'A regular', en: "Is it true about Sasha? Give him this card when he's back. And I need batteries, while I'm here." },
  'd6.f.loyal': { who: 'm5', name: 'A customer', en: "Northstar's milk is cheaper. I don't care. My dad bought his milk here. I'll take two." },
  'd6.k.call1': { who: 'koshkin', en: 'Golubchik? It is me. They have me in a bed with wheels and a television I cannot turn off. Is the store open? Good. Good.' },
  'd6.k.call2': { who: 'koshkin', en: 'The heart doctor here is twelve years old. He says, Mr. Koshkin, no salt. I say, young man, I am made of herring.', emo: 'laugh' },
  'd6.k.call3': { who: 'koshkin', en: "Did Evan come? Of course he came. The vultures come on the first day. Don't sell him anything. Not even matches." },
  'd6.e.hello': { who: 'evan', en: "Knock knock! Hi! I brought you a coffee. Northstar blend. Peace offering. Wow, this place is so authentic. Is that a real wood stove?", emo: 'smile' },
  'd6.e.koshkin': { who: 'evan', en: "How's Mr. Koshkin? We're all just devastated. Northstar sent flowers to Nome. Big ones." },
  'd6.e.offer': { who: 'evan', en: 'Listen. Northstar would love to buy the building. Very generous offer. Mr. Koshkin could retire somewhere warm. And you could come work for us. Benefits, dental, the works.', emo: 'smile' },
  'd6.e.notsale': { who: 'evan', en: "Of course! Totally understand. Just know the offer's there. Offers don't last forever. Neither do stores, honestly.", emo: 'smile' },
  'd6.e.pass': { who: 'evan', en: "Wonderful! I knew you'd be reasonable. Everybody's reasonable eventually.", emo: 'smile' },
  'd6.e.out': { who: 'evan', en: "Wow. Okay! No problem. I'll go. I'm going." },
  'd6.e.threat': { who: 'evan', en: "Oh, one more thing. Small town, right? Everybody knows everybody. I know where you live! I mean, everybody does. Shore Road. Have a great Saturday!", emo: 'smile' },
  'd6.e.later': { who: 'evan', en: 'Thought any more about our offer? No pressure! Lots of pressure. Kidding!', emo: 'smile' },

  // ---- the Saturday Shootout
  'd6.t.invite': { who: 'tommy', en: "Saturday Shootout! Three o'clock, Loon Lake. Once around the flags, anybody who shows up. I've got a spare sled. It's ugly, but it's fast.", emo: 'smile' },
  'd6.t.in': { who: 'tommy', en: "Yes! Three o'clock, up the Lake Trail. Don't be late. Grandma's bringing thermoses.", emo: 'laugh' },
  'd6.t.out': { who: 'tommy', en: 'The store first, huh? Koshkin would be proud. Grumpy, but proud.' },
  'd6.t.early': { who: 'tommy', en: "Three o'clock, I said! I'm still warming up the sleds. Go throw a snowball at something." },
  'd6.t.rules': { who: 'tommy', en: 'Okay. Five flags around the lake, then back here. Stay off the middle, the ice is thin by the inlet. Loser buys the hot chocolate.' },
  'd6.ni.race': { who: 'nina', en: "This is KZRY, live from Loon Lake, where Tommy Aqpik is about to embarrass a newcomer. Stay tuned." },
  'd6.r.race': { who: 'ruth', en: 'Thomas. If you put this person through the ice, you will answer to me.', emo: 'serious' },
  'd6.t.go': { who: 'tommy', en: 'Three. Two. One. Go!', emo: 'laugh' },
  'd6.t.lost': { who: 'tommy', en: "No way. No way! Okay. Okay, that was real. You're still buying the hot chocolate. That's how it works now.", emo: 'surprise' },
  'd6.t.won': { who: 'tommy', en: 'Ha! Not bad for a carpenter. Next Saturday. Bring a faster sled. Or longer legs.', emo: 'laugh' },
  'd6.ni.win': { who: 'nina', en: 'And the newcomer takes it! Tommy Aqpik, would you like to comment? He would not.', emo: 'laugh' },
  'd6.ni.lose': { who: 'nina', en: 'Tommy Aqpik wins again. In other news, the sky is up.' },
  'd6.t.missed': { who: 'tommy', en: "You missed the Shootout! I waited. Well, I raced my cousin. But I thought about waiting." },
  'd6.t.after': { who: 'tommy', en: "Next Saturday, same time. I'm already training. By which I mean eating." },

  // ---- around town
  'd6.d.pie': { who: 'dolly', en: "Sasha's going to be fine. I called the hospital twice. Here's a pie for the counter. Sell it by the slice. Don't tell anybody it's mine.", emo: 'smile' },
  'd6.d.idle': { who: 'dolly', en: 'Saturday, everybody sleeps in and then wants breakfast at once. Lord, my feet.' },
  'd6.h.stock': { who: 'hank', en: "Heard Evan made you an offer. Don't take it. Run short on anything, I'll float you stock till Sasha's back. Don't tell anybody I'm nice." },
  'd6.ra.hello': { who: 'ray', en: "Saturday. No cannery. Lou's got darts tonight. You any good? Don't answer. Everybody says yes." },
  'd6.ly.store': { who: 'lyle', en: "How's the store? Busy? Good, good. Northstar's not happy about it. Just so you know. I'm not either. Officially." },
  'd6.wt.coffee': { who: 'walt', en: "The mayor's office sends its best wishes to Sasha. And between you and me, I'll buy my coffee from you this week. Don't tell Gideon.", emo: 'smile' },
  'd6.gi.offer': { who: 'gideon', en: 'I am sorry about Mr. Koshkin. Truly. Evan mentioned the offer? Northstar can be very generous with people who are reasonable.', emo: 'smile' },
  'd6.p.news': { who: 'pearl', en: "Wade called from Nome. Sasha's stable. Grumpy, so he's fine. I told the whole town. Well, they asked. Well, I told them before they asked." },
  'd6.el.nome': { who: 'ellen', en: 'I flew back at dawn with Wade. Sasha is stable. He asked about the store before he asked about his heart. Typical.' },
  'd6.wd.check': { who: 'wade', en: "Flew Doc back this morning. Haven't slept. Sasha made me promise to check the store's furnace. So. I'm checking. It's fine. Bye." },
  'd6.g.bells': { who: 'gabriel', en: "We will pray for Sasha tomorrow at the liturgy. Would you ring the bells for us before we start? Ten o'clock. It would mean a great deal." },
  'd6.g.idle': { who: 'gabriel', en: 'Ten tomorrow morning. The bells, if you can. And bring a candle for Sasha.' },
  'd6.m.store': { who: 'marta', en: "Heard about Koshkin. I'm sorry. Running his store yourself, huh? That's either very kind or very convenient." },
  'd6.ni.race2': { who: 'nina', en: "Race at three! I'm doing play-by-play. It's going to be mostly me saying, and they're still going." },
  'd6.lo.round': { who: 'lou', en: "A drink on the house for anybody keeping Koshkin's open. One drink. I'm not a charity." },
};

// Loon Lake (frozen): the start by the Lake Trail, five flags around the shore, back to the start.
const START = { x: -283, z: -404 };
const FLAGS = [{ x: -215, z: -450 }, { x: -250, z: -525 }, { x: -330, z: -535 }, { x: -385, z: -470 }, { x: -340, z: -415 }];
const COURSE = [START, ...FLAGS, START];
const TOMMY = 3.3; // m/s — beatable if Rybka goes flat out the whole way
const LEN = COURSE.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - COURSE[i].x, p.z - COURSE[i].z), 0);
function along(d) {
  for (let i = 1; i < COURSE.length; i++) {
    const a = COURSE[i - 1], b = COURSE[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= l) return { x: a.x + (b.x - a.x) * (d / l), z: a.z + (b.z - a.z) * (d / l) };
    d -= l;
  }
  return START;
}

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd6.open': {
    title: 'Open for Business', main: true, day: 6,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = "Open Koshkin's";
        m.obj(text, 'koshkin.door', "His keys are in your pocket — nine o'clock");
        m.ears(['d6.n.morning', 'd6.n.open']);
        await m.spot('unlock', 'koshkin.door', "Unlock Koshkin's", 2.6);
        G.sfx?.ui?.('unlock');
        m.flag('d6.opened', true);
        G.attention.add(-3);
        await m.ears(['d6.l.prices', 'd6.l.math']);
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.bring('player', at(G, 'koshkin.clerk'));
          await d.bring('ruth', at(G, 'koshkin.counter'));
          await d.say('ruth', 'd6.r.first', { cam: cu(d, 'ruth') });
          await d.say('ruth', 'd6.r.sasha', { cam: cu(d, 'ruth', { side: -1 }) });
          await d.say('f2', 'd6.f.card', { cam: cu(d, 'player') });
          await d.say('m5', 'd6.f.loyal');
        });
        rel(G, 'ruth', 6);
        await m.ear('d6.n.ruth');
        m.ears(['d6.n.shop', 'd6.v.shop', 'd6.l.till']);
        const t0 = s.hour;
        const profit = await m.job('shop', { customers: 7 });
        m.money(profit, "Koshkin's till, Saturday");
        await passTime(m, t0, 4, 'Four hours behind the counter');
        await m.ear('d6.n.shopDone');
      }
      if (m.cp(3, from)) {
        G.sfx?.phone?.();
        await m.wait(1.2);
        await m.ears(['d6.k.call1', 'd6.k.call2', 'd6.k.call3']);
        rel(G, 'koshkin', 4);
      }
      if (m.cp(4, from)) {
        const text = 'Mind the store';
        m.obj(text, 'koshkin.counter', 'Somebody is coming in');
        await hold(m, () => dist(G, 'koshkin.counter') < 7, text, 'koshkin.counter');
        m.clear();
        await m.scene(async (d) => {
          await d.bring('player', at(G, 'koshkin.clerk'));
          await d.bring('evan', at(G, 'koshkin.counter'));
          await d.say('evan', 'd6.e.hello', { cam: cu(d, 'evan') });
          await d.say('evan', 'd6.e.koshkin');
          await d.say('evan', 'd6.e.offer', { cam: cu(d, 'evan', { side: -1 }) });
          const k = await d.choose(["The store's not for sale.", "I'll pass it on to Sasha.", 'Get out of my store, Evan.']);
          if (k === 0) { await d.say('evan', 'd6.e.notsale', { cam: cu(d, 'evan') }); m.flag('d6.evanOffer', 'no'); standing(G, 1); }
          else if (k === 1) { await d.say('evan', 'd6.e.pass', { cam: cu(d, 'evan') }); m.flag('d6.evanOffer', 'pass'); G.attention.add(-3); }
          else { await d.say('evan', 'd6.e.out', { cam: cu(d, 'evan') }); m.flag('d6.evanOffer', 'out'); G.attention.add(4); standing(G, 2); }
          await d.say('evan', 'd6.e.threat', { cam: cu(d, 'evan', { dist: 0.6 }) });
          await d.say('nadia', 'd6.n.threat', { radio: true });
        });
        s.inv.northstar_coffee = (s.inv.northstar_coffee || 0) + 1;
        m.done();
        m.start('d6.money');
      }
    },
  },

  'd6.money': {
    title: 'Follow the Money', main: true, day: 6,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = "Lock up Koshkin's at six";
        m.obj(text, 'koshkin.door', 'Until then, the town is yours');
        await hold(m, () => s.hour >= 17.5 || s.hour < 4, text, 'koshkin.door');
        m.ear('d6.n.close');
        m.obj(text, 'koshkin.door');
        await m.spot('lock', 'koshkin.door', "Lock up Koshkin's", 2.6);
        G.sfx?.ui?.('select');
      }
      if (m.cp(2, from)) {
        const text = 'Home — Nadia has news';
        m.obj(text, 'cabin.desk');
        await hold(m, () => dist(G, 'cabin.desk') < 2.2, text, 'cabin.desk');
        await m.scene(async (d) => {
          await d.bring('player', 'cabin.desk', { sit: true });
          d.cam(shot(G, at(G, 'cabin.desk', 0.3, -1.1), 1.55, at(G, 'cabin.laptop'), 0.15, 40));
          await d.say('nadia', 'd6.n.b0', { radio: true });
          await d.say('nadia', 'd6.n.b1', { radio: true });
          await d.say('ivan', 'd6.i.b1', { radio: true });
          await d.say('nadia', 'd6.n.b2', { radio: true, cam: cu(d, 'player', { side: -1 }) });
          await d.say('lyosha', 'd6.l.money', { radio: true });
          await d.say('ivan', 'd6.i.b2', { radio: true });
          await d.say('nadia', 'd6.n.b3', { radio: true });
          await d.say('dmitri', 'd6.dm.b', { radio: true });
          await d.say('nadia', 'd6.n.b4', { radio: true });
          await d.say('valya', 'd6.v.b', { radio: true });
        });
        m.flag('knowsNorthstarMoney', true);
      }
      if (m.cp(3, from)) {
        m.ear('d6.l.lesson');
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop');
        await hold(m, () => !!s.lessons.l06, text, 'cabin.laptop');
        await m.ear('d6.n.night');
        m.done();
      }
    },
  },

  // optional: the Saturday Shootout (from Tommy's conversation)
  'd6.race': {
    title: 'The Saturday Shootout', day: 6,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        m.ear('d6.n.race');
        const text = 'The Saturday Shootout — Loon Lake, 3 pm';
        m.obj(text, START, 'Up the Lake Trail, north-west of town');
        await m.until(() => {
          if (s.hour >= 14 && s.hour < 18.5) {
            const t = G.npcs?.get?.('tommy');
            if (t && !t.scripted) warp(G, 'tommy', { ...START, rot: yawTo(START, FLAGS[0]) });
          }
          const near = dist(G, START) < 25;
          return (near && s.hour >= 14.5) || s.hour >= 18.5 || s.hour < 4 || s.day > 6;
        });
        if (!(s.hour >= 14.5 && s.hour < 18.5 && s.day === 6)) {
          m.flag('d6.race', 'missed');
          release(G, 'tommy');
          m.done();
          return;
        }
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.bring('player', { ...START, rot: yawTo(START, FLAGS[0]) });
          await d.bring('tommy', { x: START.x + 2.5, z: START.z + 1, rot: yawTo(START, FLAGS[0]) });
          await d.bring('ruth', { x: START.x - 4, z: START.z + 5, rot: yawTo(START, { x: START.x + 2, z: START.z }) });
          await d.bring('nina', { x: START.x - 1.5, z: START.z + 6, rot: yawTo(START, { x: START.x + 2, z: START.z }) });
          await d.say('tommy', 'd6.t.rules', { cam: cu(d, 'tommy') });
          await d.say('ruth', 'd6.r.race', { cam: cu(d, 'ruth') });
          await d.say('nina', 'd6.ni.race', { cam: cu(d, 'nina') });
          await d.say('tommy', 'd6.t.go', { cam: cu(d, 'tommy', { side: -1 }) });
        });
        G.sfx?.engineStart?.();
        place(G, 'ruth', { x: START.x - 4, z: START.z + 5 });
        place(G, 'nina', { x: START.x - 1.5, z: START.z + 6 });
        const won = await shootout(m);
        m.flag('d6.race', won ? 'won' : 'lost');
        m.ear('d6.v.race');
        await m.scene(async (d) => {
          await d.bring('tommy', { x: START.x + 2.5, z: START.z + 1 });
          await d.bring('nina', { x: START.x - 1.5, z: START.z + 6 });
          await d.say('tommy', won ? 'd6.t.lost' : 'd6.t.won', { cam: cu(d, 'tommy') });
          await d.say('nina', won ? 'd6.ni.win' : 'd6.ni.lose', { cam: cu(d, 'nina') });
        });
        if (won) { m.money(50, 'the Shootout pot'); rel(G, 'tommy', 12); standing(G, 2); } else rel(G, 'tommy', 7);
        rel(G, 'ruth', 3);
        release(G, 'tommy', 'ruth', 'nina');
        m.done();
      }
    },
  },
};

// Once around the five flags. Tommy runs the course at a steady pace; beat his time.
async function shootout(m) {
  const G = m.G, s = G.state;
  const t0 = s.stats.playSeconds;
  // on sleds when there are sleds: yours, and Tommy's blue one
  const sled = G.vehicles?.lendSled?.(START, yawTo(START, FLAGS[0]));
  const pace = sled ? 12.5 : TOMMY;
  if (sled) G.vehicles.npcRide?.('tommy', true);
  const tommyTime = LEN / pace;
  let leg = 0, cheer = false, lastObj = -9;
  const next = () => (leg < FLAGS.length ? FLAGS[leg] : START);
  await m.until(() => {
    const t = s.stats.playSeconds - t0;
    // Tommy, on his sled
    const n = G.npcs?.get?.('tommy');
    if (n?.pos) {
      const v = along(Math.min(LEN, t * pace));
      const ahead = along(Math.min(LEN, t * pace + 4));
      n.scripted = true; n.hidden = false; n.run = t * pace < LEN;
      if (sled) {
        // he rides the line exactly
        n.goal = null;
        n.pos.x = v.x; n.pos.z = v.z;
        if (Math.hypot(ahead.x - v.x, ahead.z - v.z) > 0.5) n.yaw = Math.atan2(ahead.x - v.x, ahead.z - v.z);
      } else {
        n.goal = { x: ahead.x, z: ahead.z, activity: 'stand' };
        if (Math.hypot(n.pos.x - v.x, n.pos.z - v.z) > 18) { n.pos.x = v.x; n.pos.z = v.z; }
      }
    }
    if (!cheer && t > 25) { cheer = true; m.ear('d6.gr.race'); }
    const g = next();
    if (t - lastObj > 1 || dist(G, g) < 10) {
      lastObj = t;
      m.obj(leg < FLAGS.length ? `Flag ${leg + 1} of ${FLAGS.length}` : 'Back to the start!', g, `Tommy's pace: ${Math.round(tommyTime)} s · you: ${Math.round(t)} s`);
    }
    if (dist(G, g) < 10) {
      if (leg >= FLAGS.length) return true;
      leg++;
      G.sfx?.ui?.('select');
    }
    return false;
  });
  if (sled) G.vehicles.npcRide?.('tommy', false);
  return s.stats.playSeconds - t0 < tommyTime;
}

// ---------------------------------------------------------------- conversations
export const DIALOG = {
  tommy: async (c, prev) => {
    if (c.day !== 6) return prev(c);
    const raced = c.flag('d6.race');
    if (raced === 'missed' && !c.flag('d6.t.missedSaid')) { c.flag('d6.t.missedSaid', true); await c.say('tommy', 'd6.t.missed'); return; }
    if (raced) return idle(c, prev, 'tommy', 'd6.t.after');
    if (c.G.missions?.isActive?.('d6.race')) {
      if (c.hour < 14.5 && c.hour > 6) { await c.say('tommy', 'd6.t.early'); return; }
      return idle(c, prev, 'tommy', 'd6.t.in');
    }
    if (c.hour < 17 && c.hour > 6) {
      await c.say('tommy', 'd6.t.invite');
      const k = await c.choose(["I'm in.", "Not today — I'm minding the store."]);
      if (k === 0) { await c.say('tommy', 'd6.t.in'); c.start('d6.race'); c.rel(4); } else { await c.say('tommy', 'd6.t.out'); c.rel(2); }
      return;
    }
    return idle(c, prev, 'tommy', 'd6.t.after');
  },

  evan: async (c, prev) => (c.day === 6 && c.flag('d6.evanOffer') ? idle(c, prev, 'evan', 'd6.e.later') : prev(c)),

  dolly: async (c, prev) => {
    if (c.day !== 6) return prev(c);
    if (!c.flag('d6.d.pie')) { c.flag('d6.d.pie', true); await c.say('dolly', 'd6.d.pie'); c.give('pie'); c.rel(4); return; }
    return idle(c, prev, 'dolly', 'd6.d.idle');
  },

  hank: async (c, prev) => {
    if (c.day !== 6) return prev(c);
    if (c.flag('d6.evanOffer') && !c.flag('d6.h.stock')) { c.flag('d6.h.stock', true); await c.say('hank', 'd6.h.stock'); c.rel(5); return; }
    return prev(c);
  },

  gabriel: async (c, prev) => {
    if (c.day !== 6) return prev(c);
    if (!c.flag('d6.g.bells')) { c.flag('d6.g.bells', true); await c.say('gabriel', 'd6.g.bells'); c.rel(3); return; }
    return idle(c, prev, 'gabriel', 'd6.g.idle');
  },

  nina: async (c, prev) => (c.day === 6 && !c.flag('d6.race') ? idle(c, prev, 'nina', 'd6.ni.race2') : prev(c)),
  ray: async (c, prev) => (c.day === 6 ? idle(c, prev, 'ray', 'd6.ra.hello') : prev(c)),
  lyle: async (c, prev) => (c.day === 6 ? idle(c, prev, 'lyle', 'd6.ly.store') : prev(c)),
  walt: async (c, prev) => (c.day === 6 ? idle(c, prev, 'walt', 'd6.wt.coffee') : prev(c)),
  gideon: async (c, prev) => (c.day === 6 ? idle(c, prev, 'gideon', 'd6.gi.offer') : prev(c)),
  pearl: async (c, prev) => (c.day === 6 ? idle(c, prev, 'pearl', 'd6.p.news') : prev(c)),
  ellen: async (c, prev) => (c.day === 6 ? idle(c, prev, 'ellen', 'd6.el.nome') : prev(c)),
  wade: async (c, prev) => (c.day === 6 ? idle(c, prev, 'wade', 'd6.wd.check') : prev(c)),
  marta: async (c, prev) => (c.day === 6 ? idle(c, prev, 'marta', 'd6.m.store') : prev(c)),
  lou: async (c, prev) => (c.day === 6 ? idle(c, prev, 'lou', 'd6.lo.round') : prev(c)),
};

export const DIALOG_OVERRIDE = true;
