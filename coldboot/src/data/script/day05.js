// DAY 5 (Friday) — The Winter Gala. The last day: Lyosha's dress rehearsal,
// the third continuity card if it's still missing, Wade's helicopter, a 1962
// suit (or dress) from Koshkin's back room, goodbyes nobody knows are
// goodbyes. Seven o'clock: the mayor drives Rybka up Kettle Hill. The Dome:
// champagne, Halloran in person, his speech, "a cold boot". Slip away through
// the server room, the brass key, the three cards (field hack 'shares'), the
// drive. Alarm. A snowmobile down the hill to the hangar, where Okafor didn't
// see a thing. Then the finale takes over: await m.G.finale?.().
//
// flags: rehearsed, d14.wadeAsked, wadeReady, galaOutfit ('suit' | 'dress'),
//   metHalloran, sharesCombined, hasDrive, alarm, okaforLetGo, toFinale.
import {
  at, local, yawTo, dist, cu, rel, item, release, stage, keepTime, cap, waitFor, hold, meet, hack, idle,
  shareCount, hasShare, takeShare,
} from './kit.js';
import { SIDE } from './side_town.js';

export const DAY = { n: 5, start: ['d5.ready'], mustFinish: ['d5.ready', 'd5.gala'] };

export const LINES = {
  // ---- the last morning
  'd14.n.morning': { who: 'nadia', ru: 'Последний день, Рыбка. Завтра на рассвете «Полынь» проснётся. Или нет. Это зависит от сегодняшней ночи.', en: "The last day, Rybka. At dawn tomorrow, Wormwood wakes up. Or it doesn't. That depends on tonight.", emo: 'serious' },
  'd14.v.morning': { who: 'valya', ru: 'Матрёшку мою держи при себе. Сегодня, может, и пригодится.', en: 'Keep my matryoshka with you. Today it might be needed.', emo: 'smile' },
  'd14.l.morning': { who: 'lyosha', ru: 'Я проверил всё три раза. Потом ещё два. Ключ, карта, код. Всё сходится. Я просто хочу, чтобы мы все снова сели за этот стол. С чаем.', en: 'I checked everything three times. Then twice more. Key, card, code. It all adds up. I just want us all to sit at this table again. With tea.', emo: 'worry' },
  'd14.i.morning': { who: 'ivan', ru: '…Ты там осторожнее.', en: '…Take care of yourself.' },
  'd14.g.morning': { who: 'grisha', ru: 'Сегодня ночью я буду в эфире всё время. Если что — просто зови. Гриша. Громко.', en: "Tonight I'll be on the air the whole time. If anything happens, just call. Grisha. Loud.", emo: 'smile' },
  'd13.l.ready': { who: 'lyosha', ru: 'Десять минут. Справишься. Я это знаю.', en: "Ten minutes. You'll manage. I know it.", emo: 'smile' },
  'd14.n.goodbyes': { who: 'nadia', ru: 'Ты прощаешься. Они не знают. Так и надо.', en: "You're saying goodbye. They don't know it. That's how it should be.", emo: 'worry' },
  // ---- Wade
  'd14.wa.ask': { who: 'wade', en: 'Borrow the Dragonfly? Tonight? Huh.', emo: 'surprise' },
  'd14.wa.yes': { who: 'wade', en: "Keys'll be under the seat cushion. Tank's full. I'll be at Dolly's eating pie in front of a dozen witnesses. Whatever this is, I hope it's worth my only helicopter.", emo: 'serious' },
  'd14.wa.no': { who: 'wade', en: "I don't lend her out. Not to anybody. But I sleep heavy, and that hangar lock is older than I am. I'm just saying things out loud." },
  'd14.g.plan': { who: 'grisha', ru: 'План простой. Берёшь диск, бежишь в ангар к Уэйду и летишь через пролив. Восемьдесят километров. Я буду на связи.', en: "The plan is simple. The drive, Wade's hangar, the helicopter, across the strait. Eighty kilometres. I'll get you home." },
  // ---- the suit
  'd14.k.suit': { who: 'koshkin', en: "The Gala? At the Dome? Then you can't go dressed like a carpenter. Back room. A box from nineteen sixty-two. Wedding stock. Never sold." },
  'd14.k.suit2': { who: 'koshkin', en: 'A black suit and a green velvet dress. One will fit, the other will be sad. Take whichever you like. No charge. Ha. Big charge. Joking.', emo: 'laugh' },
  'd14.n.dress': { who: 'nadia', ru: 'Тебе идёт. Правда. У Хэллорана нет шансов.', en: "It suits you. Really. Halloran doesn't stand a chance.", emo: 'smile' },
  // ---- goodbyes
  'd14.d.bye': { who: 'dolly', en: "You look like somebody leaving on a long trip. Here. Blueberry pie, wrapped. For wherever you're going. Don't tell me. Just eat it.", emo: 'worry' },
  'd14.k.bye': { who: 'koshkin', en: "Sit. Tea with an old man. Yuri's cabin was empty seven months. Then you came. Strange, how a house knows when it is lived in." },
  'd14.k.bye2': { who: 'koshkin', en: 'Beregi sebya. Take care of yourself. My mother said it at the door, every time.', emo: 'smile' },
  'd14.h.bye': { who: 'hank', en: "Here. Good gloves. Don't argue. It's cold where you're going. It's cold everywhere up here." },
  'd14.ry.bye': { who: 'ray', en: 'Whatever happens up that hill tonight, kid, you already did more for this town than eleven years of me voting no.', emo: 'smile' },
  'd14.ni.bye': { who: 'nina', en: "I'm doing a special tonight. Songs for the longest night. Number one is for you. You don't get to know which one. It's a surprise.", emo: 'smile' },
  'd14.t.bye': { who: 'tommy', en: "Gala, huh? Fancy. If you need a fast getaway, my sled's gassed up behind the hardware store. Kidding. Unless.", emo: 'laugh' },
  'd14.lo.bye': { who: 'lou', en: "One on the house. To the longest night. Don't make that face, it's tradition. We drink to it every year, and every year the sun comes back." },
  'd14.e.bye': { who: 'ellen', en: "Doctor's last orders. Whatever you're doing tonight, come back in one piece. I'm not stitching anybody up tonight." },
  'd14.p.bye': { who: 'pearl', en: "If you ever wanted to send somebody a letter, I'd find a way. Anywhere. Even across water.", emo: 'smile' },
  'd14.m.bye': { who: 'marta', en: "I'm on duty at the Dome tonight. Security liaison. Whatever happens up there, I'm going to be very slow on the radio.", emo: 'serious' },
  'd14.m.bye2': { who: 'marta', en: "I'll be at the Dome tonight. Behave yourself. I mean it." },
  'd14.ly.bye': { who: 'lyle', en: "I'm going to the Gala to resign from the Development Board. In person. In front of him. Pray for me.", emo: 'worry' },
  'd14.ly.bye2': { who: 'lyle', en: 'See you at the Dome. Try not to embarrass us both.' },
  'd14.gi.bye': { who: 'gideon', en: 'Tonight, then.' },
  'd14.ev.bye': { who: 'evan', en: 'Big night! Mr. Halloran asked me to personally make sure you get champagne. Personally!', emo: 'smile' },
  // ---- Walt drives you up the hill
  'd14.n.seven': { who: 'nadia', ru: 'Семь часов. Мэр ждёт на площади. Пора.', en: "Seven o'clock. The mayor's waiting on the square. It's time." },
  'd14.w.pickup': { who: 'walt', en: "Look at you. You clean up better than this town deserves. Hop in. The heater works if you hit it. Everybody's heater works if you hit it.", emo: 'smile' },
  'd14.w.exposed': { who: 'walt', en: 'Halloran still wants me up there. To give his toast. After last night. That is how sure he is of himself.', emo: 'frown' },
  'd14.w.key': { who: 'walt', en: "Did you bring what I lent you? Don't answer that. I don't want to lie to anybody tonight. I'll be lying enough in my toast." },
  'd14.w.drive': { who: 'walt', en: 'June loved this drive. Up the hill, the whole town lit up below. She said it looked like somebody spilled a jewellery box.', emo: 'smile' },
  // ---- the Dome
  'd14.m4.door': { who: 'm4', name: 'Doorman', en: 'Good evening. Invitation, please. Thank you. Coats to the left. Enjoy the Winter Gala.' },
  'd14.n.inside': { who: 'nadia', ru: 'Мы тебя слышим. Дыши ровно. Улыбайся. Ты здесь гость, а гостей не обыскивают.', en: "We can hear you. Breathe evenly. Smile. You're a guest here, and nobody searches guests." },
  'd14.ev.champagne': { who: 'evan', en: "Champagne? The first glass is on Northstar. So are all the others! Isn't that wonderful?", emo: 'smile' },
  'd14.gi.welcome': { who: 'gideon', en: 'Welcome to the Dome. Coats to the left, consciences to the right. A joke. Mr. Halloran encourages jokes tonight.' },
  'd14.h.meet': { who: 'halloran', en: "There you are. The carpenter. The one who fixes things. I've wanted to meet you since the bell started ringing again.", emo: 'smile' },
  'd14.h.ledger': { who: 'halloran', en: 'That business with the projector last night. Very theatrical. Lyle wept in my office. I have never seen a grown man cry so efficiently.' },
  'd14.h.invited': { who: 'halloran', en: "I'm so glad you came. Losing gracefully is an underrated skill. Most people never get the practice." },
  'd14.h.councillor': { who: 'halloran', en: 'Congratulations on your seat. Small towns are wonderful. Everyone can see everyone. It makes them so easy to love.' },
  'd14.h.house': { who: 'halloran', en: 'Tell me something, as a craftsman. When a house is rotten all the way through, do you patch it? Or do you pull it down to the ground and start again?' },
  'd14.h.patch': { who: 'halloran', en: "Board by board. While the rot moves faster than your hammer. That's why you'll always be a carpenter. And I'll always be the weather.", emo: 'smile' },
  'd14.h.ask': { who: 'halloran', en: 'Ask them? They will tell you to save the wallpaper. People always want to save the wallpaper.', emo: 'smile' },
  'd14.h.inside': { who: 'halloran', en: 'Ah. Now that is the only question that matters. And the answer, my friend, is everyone. It is always everyone.', emo: 'serious' },
  'd14.h.cold': { who: 'halloran', en: "You look cold. Everyone does, at first. Stay close to the fire tonight. It's going to be a long winter." },
  'd14.o.deal': { who: 'okafor', en: "Consultant. Don't laugh. When he starts his speech, go. I'll keep the room busy." },
  'd14.o.hostile': { who: 'okafor', en: "Evening, candidate. I'm watching you tonight. Everybody in this room is watching somebody." },
  // ---- the speech
  'd14.h.s1': { who: 'halloran', en: "Friends. Neighbours. Thank you for climbing my hill in the dark. I know it's cold. I like the cold. The cold is honest." },
  'd14.h.s2': { who: 'halloran', en: 'Sixty years ago, men sat in this dome and watched the sky for the end of the world. They waited their whole lives. It never came. Do you know what waiting does to people?' },
  'd14.h.s3': { who: 'halloran', en: 'I build machines. And every machine I have ever built, sooner or later, freezes. Too many programs. Too many patches. Too much memory of old mistakes.' },
  'd14.h.s4': { who: 'halloran', en: 'It hangs. The little wheel spins. And you cannot fix it from the inside, because the inside is the problem.' },
  'd14.h.s5': { who: 'halloran', en: 'Engineers have a name for what you do then. You hold down the button. Everything goes dark. And then it starts again, clean. We call it a cold boot.', emo: 'smile' },
  'd14.n.now': { who: 'nadia', ru: 'Сейчас. Пока все смотрят на него.', en: "Now. While everyone's watching him.", emo: 'serious' },
  'd14.gi.wine': { who: 'gideon', en: 'You clumsy— that is a four-hundred-dollar shirt!', emo: 'angry' },
  'd14.o.wine': { who: 'okafor', en: 'My apologies. Let me help. Let me help a lot.', emo: 'smile' },
  'd14.n.grey': { who: 'nadia', ru: 'Это твой агент. Иди!', en: "That's your agent. Go!", emo: 'smile' },
  'd14.h.s6': { who: 'halloran', en: "Look at the world we're running. Eight billion processes fighting over the same memory. Debts nobody can pay. Wars nobody can end. Screens telling us what to want." },
  'd14.h.s7': { who: 'halloran', en: "It's frozen, friends. It stopped responding years ago. We keep clicking. We keep hoping. The little wheel keeps spinning." },
  'd14.h.s8': { who: 'halloran', en: 'People think a winter like this is the end of something. Up here, we know better. Winter is how the land rests. Winter is when the ground remembers what it is.' },
  'd14.h.s9': { who: 'halloran', en: "Port Zarya knows how to live through the dark. You keep a stove lit. You check on your neighbours. You don't need a server in Virginia to tell you when to wake up." },
  'd14.h.s10': { who: 'halloran', en: 'So tonight I raise a glass to the long night. To everyone strong enough to see the morning. And to the morning itself, which will be very, very quiet.' },
  'd14.h.s11': { who: 'halloran', en: 'To the cold boot.', emo: 'smile' },
  'd14.gi.toast': { who: 'gideon', en: 'To the cold boot.' },
  'd14.ly.toast': { who: 'lyle', en: 'To the, um. Cold boot?', emo: 'worry' },
  'd14.ev.toast': { who: 'evan', en: 'To the cold boot! Woo!', emo: 'laugh' },
  'd14.w.toast': { who: 'walt', en: 'And now my toast. To June Hennessey, who wound a music box every night of her life, so the morning would have something to wake up to.', emo: 'serious' },
  // ---- the back rooms and the vault
  'd14.l.door': { who: 'lyosha', ru: 'Служебная дверь с восточной стороны. Замок старый, армейский. Такие ты открываешь с закрытыми глазами.', en: 'The service door on the east side. An old army lock. You open those with your eyes closed by now.' },
  'd14.m2.guard': { who: 'm2', name: 'Security', en: "Excuse me. Guests can't be back here. The party's in the main hall." },
  'd14.m2.rest': { who: 'm2', name: 'Security', en: "Back the way you came, second door on the left. And don't touch the art. Mr. Halloran knows when you touch the art." },
  'd14.l.panel': { who: 'lyosha', ru: 'Охранная панель. Красный к белому, синий никуда. Тихо.', en: 'The security panel. Red to white, blue to nothing. Quietly.' },
  'd14.g.copy': { who: 'grisha', ru: 'Копия работает! Ну, Гриша, ну, молодец.', en: 'The copy works! Well, Grisha, well done, you.', emo: 'laugh' },
  'd14.n.waltkey': { who: 'nadia', ru: 'Ключ мэра. Он бы хотел это видеть.', en: "Walt's key. He'd want to see this.", emo: 'smile' },
  'd13.v.three': { who: 'valya', ru: 'Три. Ну что, рыбка, будем клеить ключ?', en: 'Three. Well, little fish, shall we glue the key together?', emo: 'smile' },
  'd13.l.retry': { who: 'lyosha', ru: 'Порядок, Рыбка. Сначала по номерам, потом склеивать. Ещё раз.', en: 'Order, Rybka. First by the numbers, then glue. Once more.' },
  'd13.v.numbers': { who: 'valya', ru: 'Числа, рыбка, а не буквы. Десять после девяти. Я же говорила.', en: 'Numbers, little fish, not letters. Ten comes after nine. I told you so.', emo: 'smile' },
  'd14.l.welcome': { who: 'lyosha', ru: '«Добро пожаловать, мистер Хэллоран». Ха! Теперь мы — мистер Хэллоран.', en: "'Welcome, Mr. Halloran.' Ha! Now we're Mr. Halloran.", emo: 'laugh' },
  'd14.n.drive': { who: 'nadia', ru: 'Диск. Бери диск.', en: 'The drive. Take the drive.', emo: 'serious' },
  // ---- alarm
  'd14.n.alarm': { who: 'nadia', ru: 'Тревога! Рыбка, беги! Сейчас же!', en: 'Alarm! Rybka, run! Now!', emo: 'worry' },
  'd14.l.radio': { who: 'lyosha', ru: 'Я в их рации. Слушай.', en: "I'm in their radio. Listen." },
  'd14.gi.radio': { who: 'gideon', en: 'Seal the hill. Nobody leaves. Find the carpenter. Alive, if it is convenient.', emo: 'angry' },
  'd14.g.run': { who: 'grisha', ru: 'Вниз по дороге, к аэродрому! Не оглядывайся! Я с тобой!', en: "Down the road, to the airstrip! Don't look back! I'm with you!", emo: 'angry' },
  'd5x.g.sled': { who: 'grisha', ru: 'У ворот снегоход! Бери его — и вниз!', en: "There's a snowmobile by the gate! Take it, and go!", emo: 'angry' },
  'd14.g.road': { who: 'grisha', ru: 'Дорога вниз, километр. Держись обочины — в темноте тебя не видно.', en: "It's a kilometre down the road. Keep to the edge — they can't see you in the dark." },
  'd14.h.pa': { who: 'halloran', en: 'Ladies and gentlemen, a small technical matter. Please, enjoy the music. Nothing is going to happen tonight.', emo: 'smile' },
  'd14.h.call': { who: 'halloran', en: "Carpenter. You've taken something of mine. Keep it. It won't matter. At dawn the world turns off, and you'll be standing in the dark with a little drive in your hand.", emo: 'serious' },
  'd14.h.call2': { who: 'halloran', en: "I liked you, you know. I still do. That's the terrible thing about a cold boot. It doesn't care who you like." },
  'd14.l.lie': { who: 'lyosha', ru: 'Он врёт. С этим диском — не выключит. Беги.', en: "He's lying. With that drive, he can't. Run.", emo: 'angry' },
  // ---- the hangar
  'd14.g.key': { who: 'grisha', ru: 'Ключ под подушкой сиденья. Все пилоты так делают.', en: 'The key is under the seat cushion. Every pilot does that.' },
  'd14.o.go': { who: 'okafor', en: "You're late. Go. She's warm, I checked. Whatever's on that drive, I hope it's everything you said.", emo: 'serious' },
  'd14.o.blind': { who: 'okafor', en: "I didn't see a thing.", emo: 'smile' },
  'd14.o.stop': { who: 'okafor', en: "Hands where I can see them. Whatever's in your pocket, put it on the ground. Slowly.", emo: 'angry' },
  'd14.o.listen': { who: 'okafor', en: "You're telling me the lights go out at dawn. Everywhere. Hospitals. Everything.", emo: 'worry' },
  'd14.o.blind2': { who: 'okafor', en: "Go. I didn't see a thing. And if you're lying, God help us both.", emo: 'serious' },
  'd14.o.lower': { who: 'okafor', en: "Damn it. Damn it. Go. I didn't see a thing.", emo: 'frown' },
  'd14.g.fly': { who: 'grisha', ru: 'Садись. Пристегнись. Левая рука — шаг-газ, правая — ручка. Как учил Уэйд. Поехали!', en: "Sit. Buckle up. Left hand, collective; right hand, cyclic. Like Wade taught you. Let's go!", emo: 'smile' },
  'd14.dm.fly': { who: 'dmitri', ru: 'Мы ждём. Чайник уже на плите.', en: "We're waiting. The kettle's already on.", emo: 'smile' },
  'd14.v.fly': { who: 'valya', ru: 'Лети, рыбка. Лети.', en: 'Fly, little fish. Fly.', emo: 'smile' },
  'd14.n.fly': { who: 'nadia', ru: 'Лети домой, Рыбка.', en: 'Fly home, Rybka.', emo: 'smile' },
};

const SQUARE = { x: 4, z: 6 };
// the Dome, in its own frame (see world/buildings/dome.js): the hall-side and
// server-room side of the door in the partition behind the gala tables
const hallDoor = (G) => local(G, 'dome', -11, -8.5);
const serverSide = (G) => local(G, 'dome', -9, -8.5);
// whoever still holds a card on the last day, and where to find them
const HOLDERS = [
  { id: 'ray', where: 'cannery.door', name: 'Ray (the cannery)' },
  { id: 'dolly', where: 'diner.waitress', name: 'Dolly (the diner)' },
  { id: 'hank', where: 'hardware.door', name: 'Hank (the hardware store)' },
  { id: 'ruth', where: 'post.door', name: 'Ruth (the post office)' },
];
const BYE = ['dolly', 'koshkin', 'hank', 'ray', 'nina', 'tommy', 'lou', 'ellen', 'pearl', 'marta', 'lyle'];

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd5.ready': {
    title: 'The Last Day', main: true, day: 5,
    async run(m, from) {
      const G = m.G, F = G.state.flags, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 8.6);
        // nothing upstream should leave these unset, but the last day must never dead-end
        if (!F.galaInvite) { m.flag('galaInvite', true); if (!F.galaInviteBy) m.flag('galaInviteBy', 'halloran'); }
        if (!F.mayorKey) { m.flag('mayorKey', true); if (!F.mayorKeyCopied) m.flag('mayorKeyGiven', true); item(G, 'municipal_key', 1); }
        if (!F.knowsShares) m.flag('knowsShares', true);
        await m.wait(1.0);
        await m.ear('d14.n.morning');
        await m.ears(['d14.v.morning', 'd14.l.morning', 'd14.i.morning', 'd14.g.morning']);
        m.start('d5.goodbyes');
      }
      if (m.cp(2, from) && !s.lessons.l14) {
        cap(m, 11);
        const text = "Lyosha's dress rehearsal — the laptop in your cabin";
        m.obj(text, 'cabin.laptop', 'Night School · Lesson 5: Dress Rehearsal');
        await hold(m, () => !!s.lessons.l14, text, 'cabin.laptop', 'Night School · Lesson 5: Dress Rehearsal');
        m.flag('rehearsed', true);
        await m.ear('d13.l.ready');
      }
      if (m.cp(3, from) && shareCount(s) < 3) {
        cap(m, 13);
        m.flag('d5.cardHunt', true);
        let shown = '';
        await m.until(() => {
          if (shareCount(s) >= 3) return true;
          const left = HOLDERS.filter((h) => !hasShare(s, h.id));
          for (const h of left) {
            const n = G.npcs?.get?.(h.id);
            if (n && !n.scripted && !n.talking) stage(G, h.id, at(G, h.where));
          }
          const next = left.slice().sort((a, b) => dist(G, a.where) - dist(G, b.where))[0];
          const key = `${next?.id}${shareCount(s)}`;
          if (next && (key !== shown || !G.hud?.objective)) {
            shown = key;
            m.obj(`One more continuity card — ${shareCount(s)} of 3`, next.where, left.map((h) => h.name).join(' · ') + ' — any one of them');
          }
          return false;
        });
        m.flag('d5.cardHunt', false);
        release(G, ...HOLDERS.map((h) => h.id));
      }
      if (m.cp(4, from)) {
        cap(m, 15.5);
        await meet(m, 'wade', 'diner.booth1', 'Ask Wade about tonight', 'The Midnight Sun Diner', () => !!F['d14.wadeAsked']);
        await m.ear('d14.g.plan');
      }
      if (m.cp(5, from)) {
        cap(m, 17.5);
        await meet(m, 'koshkin', 'koshkin.clerk', 'Something to wear tonight — ask Koshkin', "Koshkin's, on the square", () => !!F.galaOutfit);
        await m.ear('d14.n.dress');
      }
      if (m.cp(6, from)) {
        m.done();
        m.start('d5.gala');
      }
    },
  },

  'd5.gala': {
    title: 'The Winter Gala', main: true, day: 5,
    async run(m, from) {
      const G = m.G, F = G.state.flags, s = G.state;
      keepTime(m);
      const pa = (ids) => { for (const id of ids) m.ear(id); };   // the speech goes on, over the Dome's speakers
      if (m.cp(1, from)) {
        await waitFor(m, 19, 'Meet the mayor on Church Square', SQUARE, "Seven o'clock, dressed for the Gala");
        cap(m, 19.3);
        m.ear('d14.n.seven');
        await hold(m, () => dist(G, SQUARE) < 9, 'Meet the mayor on Church Square', SQUARE, "He's driving you up Kettle Hill");
      }
      if (m.cp(2, from)) {
        m.clear();
        cap(m, 19.8);
        G.missions.cancel?.('d5.goodbyes');
        await m.scene(async (d) => {
          const P = G.player.pos;
          const wp = { x: SQUARE.x + 2, z: SQUARE.z + 1.5 };
          await d.bring('walt', { ...wp, rot: yawTo(wp, P) });
          await d.say('walt', 'd14.w.pickup', { cam: cu(d, 'walt') });
          if (F.waltExposed) await d.say('walt', 'd14.w.exposed', { cam: cu(d, 'walt', { side: -1 }) });
          await d.say('walt', F.mayorKeyGiven ? 'd14.w.key' : 'd14.w.drive', { cam: cu(d, 'walt', { dist: 0.7 }) });
        });
        const hall = at(G, 'dome.galaHall');
        await G.fadeTeleport?.({ x: hall.x, z: hall.z, yaw: hall.rot }, 2.4);
      }
      if (m.cp(3, from)) {
        cap(m, 20.2);
        G.npcs?.ensure?.('halloran');
        G.npcs?.ensure?.('okafor');
        await m.scene(async (d) => {
          const me = at(G, 'dome.galaHall');
          const toMe = (p) => ({ ...p, rot: yawTo(p, me) });
          await d.say('m4', 'd14.m4.door');
          await d.say('nadia', 'd14.n.inside', { radio: true });
          await d.bring('evan', toMe(at(G, 'dome.galaHall', 1.6, 1.2)));
          await d.say('evan', 'd14.ev.champagne', { cam: cu(d, 'evan') });
          await d.bring('gideon', toMe(at(G, 'dome.galaHall', -1.8, 1.4)));
          await d.say('gideon', 'd14.gi.welcome', { cam: cu(d, 'gideon') });
          await d.bring('halloran', toMe(at(G, 'dome.galaHall', 0.2, 1.8)));
          await d.say('halloran', 'd14.h.meet', { cam: cu(d, 'halloran') });
          await d.say('halloran', F.ledgerUsed ? 'd14.h.ledger' : F.galaInviteBy === 'halloran' ? 'd14.h.invited' : 'd14.h.councillor', { cam: cu(d, 'halloran', { side: -1 }) });
          await d.say('halloran', 'd14.h.house', { cam: cu(d, 'halloran', { dist: 0.6 }) });
          const k = await d.choose(['You patch it. Board by board.', 'You ask the people who live in it.', "Depends who's still inside."], { prompt: 'CYRUS HALLORAN' });
          await d.say('halloran', ['d14.h.patch', 'd14.h.ask', 'd14.h.inside'][k] || 'd14.h.patch', { cam: cu(d, 'halloran') });
          await d.say('halloran', 'd14.h.cold', { cam: cu(d, 'halloran', { side: -1, dist: 0.55 }) });
          await d.bring('okafor', toMe(at(G, 'dome.galaHall', -3, 0.6)));
          await d.say('okafor', F.okaforDeal ? 'd14.o.deal' : 'd14.o.hostile', { cam: cu(d, 'okafor') });
        });
        m.flag('metHalloran', true);
      }
      if (m.cp(4, from)) {
        cap(m, 20.6);
        await m.scene(async (d) => {
          const pod = at(G, 'dome.podium');
          const me = at(G, 'dome.galaHall');
          await d.bring('player', { ...me, rot: yawTo(me, pod) });
          await d.bring('halloran', { ...pod, rot: yawTo(pod, me) });
          const guest = (side, fwd, id) => { const p = at(G, 'dome.galaHall', side, fwd); return d.bring(id, { ...p, rot: yawTo(p, pod) }); };
          await guest(-1.5, -1.0, 'walt');
          await guest(1.5, -1.4, 'gideon');
          await guest(2.8, -0.4, 'lyle');
          await guest(-3.2, 0.4, 'okafor');
          await d.say('halloran', 'd14.h.s1', { cam: cu(d, 'halloran') });
          await d.say('halloran', 'd14.h.s2', { cam: cu(d, 'halloran', { side: -1, dist: 0.9 }) });
          await d.say('halloran', 'd14.h.s3');
          await d.say('halloran', 'd14.h.s4', { cam: cu(d, 'halloran', { dist: 0.6 }) });
          await d.say('halloran', 'd14.h.s5', { cam: cu(d, 'halloran', { side: -1, dist: 0.5 }) });
          await d.say('nadia', 'd14.n.now', { radio: true });
          if (F.okaforDeal) {
            await d.say('gideon', 'd14.gi.wine', { cam: cu(d, 'gideon') });
            await d.say('okafor', 'd14.o.wine', { cam: cu(d, 'okafor') });
            await d.say('nadia', 'd14.n.grey', { radio: true });
          }
        });
        const D = at(G, 'dome');
        G.attention.zone('d14.dome', D.x, D.z, 70, 9 * (F.okaforDeal ? 0.6 : F.okaforHostile ? 1.4 : 1), 'The Dome');
        pa(['d14.h.s6', 'd14.h.s7']);
      }
      if (m.cp(5, from)) {
        cap(m, 21);
        m.ear('d14.l.door');
        const door = hallDoor(G);
        m.obj('The service door at the back of the hall', door, 'An old army lock — stay low');
        await m.spot('door', door, 'Pick the lock', 2.6);
        let bluff = true;
        await m.scene(async (d) => {
          await d.say('m2', 'd14.m2.guard');
          bluff = (await d.choose(["(Hold up the invitation.) I'm looking for the restroom.", '(Freeze in the shadow until he turns away.)'], { prompt: 'A GUARD' })) === 0;
          if (bluff) await d.say('m2', 'd14.m2.rest');
        });
        if (bluff) G.attention.add(6); else G.attention.act(1.6, 6);
        G.attention.act(1.2, 8);
        if (!(await m.minigame('lock', { title: 'THE SERVICE DOOR' }))) G.attention.add(10);
        const inside = serverSide(G);
        await G.fadeTeleport?.({ x: inside.x, z: inside.z, yaw: yawTo(inside, at(G, 'dome.racks')) }, 0.8);
        pa(['d14.h.s8']);
        m.obj('The security panel', 'dome.racks', 'Inside the server room');
        await m.spot('panel', 'dome.racks', 'Open the security panel', 2.6);
        await m.ear('d14.l.panel');
        G.attention.act(1.2, 8);
        if (!(await m.minigame('wire', { title: 'THE SECURITY PANEL' }))) G.attention.add(10);
        pa(['d14.h.s9']);
      }
      if (m.cp(6, from)) {
        cap(m, 21.4);
        m.obj('The vault door', 'dome.vaultDoor', 'The brass key, then the three cards');
        await m.spot('key', 'dome.vaultDoor', 'Turn the brass key', 2.8);
        await m.ear(F.mayorKeyCopied ? 'd14.g.copy' : 'd14.n.waltkey');
        G.hud?.toast?.('THE VAULT', 'The brass key turns. The terminal asks for three continuity cards.', '#ffd166');
        if (shareCount(s) < 3) for (const h of HOLDERS) if (shareCount(s) < 3 && !hasShare(s, h.id)) takeShare(G, h.id, () => {});
        await m.ear('d13.v.three');
        const toasts = ['d14.h.s10', 'd14.h.s11', 'd14.gi.toast', 'd14.ly.toast', 'd14.ev.toast'];
        if (F.mayorKeyGiven || F.waltExposed || F.musicBoxFixed) toasts.push('d14.w.toast');
        pa(toasts);
        m.obj('Put the three cards together', 'dome.vaultDoor', 'Field hack — the toasts are going on');
        await hack(m, 'shares', 'dome.vaultDoor', 'Put the cards together again', 'd13.l.retry');
        m.flag('sharesCombined', true);
        await m.ear('d13.v.numbers');
        G.sfx?.ui?.('unlock');
        const v = at(G, 'dome.vault');
        await G.fadeTeleport?.({ x: v.x, z: v.z, yaw: v.rot }, 1.0);
        m.ear('d14.l.welcome');
        m.ear('d14.n.drive');
        m.obj('Take the drive', 'dome.drive', 'On the pedestal');
        await m.spot('drive', 'dome.drive', 'Take the drive', 2.8);
        m.flag('hasDrive', true);
        item(G, 'drive', 1);
        G.hud?.toast?.('THE ROOT KEY', 'The drive is in your pocket', '#ffd166');
      }
      if (m.cp(7, from)) {
        cap(m, 21.8);
        G.sfx?.alarm?.();
        G.attention.clearZone('d14.dome');
        G.attention.add(20);
        m.flag('alarm', true);
        await m.ear('d14.n.alarm');
        await m.ears(['d14.l.radio', 'd14.gi.radio', 'd14.g.run']);
        // out through the service corridor; a security snowmobile by the gate
        const road = at(G, 'dome.road');
        await G.fadeTeleport?.({ x: road.x, z: road.z, yaw: yawTo(road, at(G, 'hangar')) }, 0.8);
        if (G.vehicles?.lendSled) { G.vehicles.lendSled(road, yawTo(road, at(G, 'hangar'))); m.ear('d5x.g.sled'); }
        m.ear('d14.g.road');
        m.ear('d14.h.pa');
        const text = "Get to Wade's hangar";
        m.obj(text, 'hangar.apron', 'Down Kettle Hill Road');
        const D = at(G, 'dome');
        await hold(m, () => dist(G, D) > 120, text, 'hangar.apron', 'Down Kettle Hill Road');
        m.ears(['d14.h.call', 'd14.h.call2', 'd14.l.lie']);
        await hold(m, () => dist(G, 'hangar.apron') < 26, text, 'hangar.apron', 'Down Kettle Hill Road');
      }
      if (m.cp(8, from)) {
        cap(m, 22.2);
        G.vehicles?.exit?.();
        if (!F.wadeReady) {
          m.obj('Get into the hangar', 'hangar.hangarDoor', 'The lock is older than Wade');
          await m.spot('hangar', 'hangar.hangarDoor', 'Force the hangar door', 3.2);
          await m.minigame('lock', { title: 'THE HANGAR DOOR' });
          await m.ear('d14.g.key');
        }
        m.clear();
        G.npcs?.ensure?.('okafor');
        await m.scene(async (d) => {
          const P = G.player.pos;
          const op = at(G, 'hangar.apron', -3, 1.5);
          await d.bring('okafor', { ...op, rot: yawTo(op, P) });
          if (F.okaforDeal) {
            await d.say('okafor', 'd14.o.go', { cam: cu(d, 'okafor') });
            await d.say('okafor', 'd14.o.blind', { cam: cu(d, 'okafor', { side: -1, dist: 0.6 }) });
          } else {
            await d.say('okafor', 'd14.o.stop', { cam: cu(d, 'okafor') });
            const k = await d.choose(['(Show him the drive. Tell him everything, fast.)', '(Walk past him to the helicopter.)'], { prompt: 'SPECIAL AGENT OKAFOR' });
            if (k === 0) {
              await d.say('okafor', 'd14.o.listen', { cam: cu(d, 'okafor', { side: -1 }) });
              await d.say('okafor', 'd14.o.blind2', { cam: cu(d, 'okafor', { dist: 0.6 }) });
            } else await d.say('okafor', 'd14.o.lower', { cam: cu(d, 'okafor', { dist: 0.6 }) });
          }
        });
        m.flag('okaforLetGo', true);
      }
      if (m.cp(9, from)) {
        await m.ears(['d14.g.fly', 'd14.dm.fly', 'd14.v.fly', 'd14.n.fly']);
        // No m.done(): the mission stays active at this checkpoint, so a reload
        // during the finale replays the hand-off instead of stranding Rybka in town.
        m.flag('toFinale', true);
        m.clear();
        await m.G.finale?.();
      }
    },
  },

  // optional: goodbyes nobody knows are goodbyes
  'd5.goodbyes': {
    title: 'Goodbyes', day: 5,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        const n = () => BYE.filter((k) => G.state.flags['d14.bye.' + k]).length;
        let last = -1;
        await m.until(() => {
          const k = n();
          if (k !== last) { last = k; SIDE.obj(m, 'Spend a little time with friends', 'diner', `Optional · ${Math.min(k, 4)} of 4 visits`); }
          return k >= 4;
        });
        await m.ear('d14.n.goodbyes');
        SIDE.finish(m);
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const ELSE = { label: 'Something else.', key: 'prev' };
const hunting = (c) => !!c.flag('d5.cardHunt') && shareCount(c.state) < 3;
const ready = { dolly: (c) => c.level >= 2 || !!c.state.repairs?.['r.dolly.sign'], hank: () => true, ray: () => true, ruth: () => true };
const CARD = { dolly: (c) => (ready.dolly(c) ? 'sf.dolly.card' : 'd13.d.card'), hank: () => 'd13.h.card', ray: () => 'sf.ray.card', ruth: () => 'sf.ruth.card' };
/** On the last day anyone still holding a card gives it up when asked (the game can't dead-end). */
async function lastCard(c, id) {
  if (!hunting(c) || hasShare(c.state, id)) return false;
  const k = await c.choose([{ label: 'That laminated card Gideon had you sign. I need it tonight.', key: 'card' }, ELSE], { prompt: 'THE CONTINUITY CARD' });
  if (k !== 'card') return 'prev';
  await c.say(id, CARD[id](c));
  takeShare(c.G, id);
  c.rel(4);
  c.emit('share:' + id);
  return true;
}
/** A farewell nobody knows is one: once per friend, counted by the Goodbyes task. */
const bye = (npc, line, gift) => async (c, prev) => {
  if (c.day !== 5 || c.flag('d14.bye.' + npc)) return prev(c);
  c.flag('d14.bye.' + npc, true);
  for (const l of [].concat(typeof line === 'function' ? line(c) : line)) await c.say(npc, l);
  if (gift) c.give(gift);
  c.rel(4);
};
const withCard = (id, rest) => async (c, prev) => {
  if (c.day !== 5) return prev(c);
  const r = await lastCard(c, id);
  if (r === true) return;
  if (r === 'prev') return prev(c);
  return rest(c, prev);
};

export const DIALOG = {
  koshkin: async (c, prev) => {
    if (c.day !== 5) return prev(c);
    if (c.G.missions.isActive('d5.ready') && !c.flag('galaOutfit')) {
      const k = await c.choose([{ label: 'Sasha, I need something to wear tonight. The Gala.', key: 'suit' }, ELSE]);
      if (k !== 'suit') return prev(c);
      await c.say('koshkin', 'd14.k.suit');
      await c.say('koshkin', 'd14.k.suit2');
      const o = await c.choose(['(The black suit.)', '(The green velvet dress.)']);
      c.give('gala_clothes');
      c.flag('galaOutfit', o === 1 ? 'dress' : 'suit');
      c.rel(4);
      c.emit('outfit');
      if (!c.flag('d14.bye.koshkin')) { c.flag('d14.bye.koshkin', true); await c.say('koshkin', 'd14.k.bye'); await c.say('koshkin', 'd14.k.bye2'); }
      return;
    }
    return bye('koshkin', ['d14.k.bye', 'd14.k.bye2'])(c, prev);
  },
  wade: async (c, prev) => {
    if (c.day !== 5 || c.flag('d14.wadeAsked') || !c.G.missions.isActive('d5.ready')) return prev(c);
    const k = await c.choose([{ label: 'Wade… if I needed to borrow the Dragonfly tonight?', key: 'ask' }, ELSE]);
    if (k !== 'ask') return prev(c);
    await c.say('wade', 'd14.wa.ask');
    const yes = c.level >= 1 || c.flag('rodeWithWade') || c.flag('flight1') || c.flag('flight2') || c.flag('flight3');
    await c.say('wade', yes ? 'd14.wa.yes' : 'd14.wa.no');
    c.flag('wadeReady', !!yes);
    c.flag('d14.wadeAsked', true);
    c.rel(3);
    c.emit('talk:wade');
  },
  dolly: withCard('dolly', bye('dolly', 'd14.d.bye', 'pie')),
  hank: withCard('hank', bye('hank', 'd14.h.bye', 'good_gloves')),
  ray: withCard('ray', bye('ray', 'd14.ry.bye')),
  ruth: withCard('ruth', (c, prev) => prev(c)),
  nina: bye('nina', 'd14.ni.bye'),
  tommy: bye('tommy', 'd14.t.bye'),
  lou: bye('lou', 'd14.lo.bye'),
  ellen: bye('ellen', 'd14.e.bye'),
  pearl: bye('pearl', 'd14.p.bye'),
  marta: bye('marta', (c) => (c.flag('martaTrust') ? 'd14.m.bye' : 'd14.m.bye2')),
  lyle: bye('lyle', (c) => (c.flag('ledgerUsed') ? 'd14.ly.bye' : 'd14.ly.bye2')),
  gideon: async (c, prev) => (c.day === 5 && !c.flag('d14.gi.chatted') ? (c.flag('d14.gi.chatted', true), c.say('gideon', 'd14.gi.bye')) : prev(c)),
  evan: async (c, prev) => (c.day === 5 && !c.flag('d14.ev.chatted') ? (c.flag('d14.ev.chatted', true), c.say('evan', 'd14.ev.bye')) : prev(c)),
};

export const DIALOG_OVERRIDE = true;

void rel; void idle;
