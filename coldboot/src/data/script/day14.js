// DAY 14 — The Winter Gala (Sunday). Dawn tomorrow. Liturgy and goodbyes that
// can't be said out loud; a 1962 suit (or dress) from Koshkin's back room;
// Wade's helicopter. Seven o'clock: the Mayor drives you up Kettle Hill. The
// Dome: champagne, Halloran in person, and his speech — "a cold boot". Slip
// away during it (the guard change at two past, Ruth's tunnel, Okafor's
// spilled wine), the brass key, the card, the 'vault' field hack, the drive.
// Alarm. Down the hill to the hangar, where Okafor didn't see a thing. Then
// the finale takes over: await m.G.finale?.().
export const DAY = { n: 14, start: ['d14.morning'], mustFinish: [] };

const passed = (r) => r === true || !!(r && r.pass);
const pt = (G, name, fb, dx = 0, dz = 0) => { const q = G.town?.points?.[name]; return q ? { x: q.x + dx, z: q.z + dz } : { x: fb.x + dx, z: fb.z + dz }; };
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });
const lvl = (G, id) => Math.min(5, Math.floor((G.state.rel[id] || 0) / 20));
function ensureNpc(G, id, name = id) {
  const list = G.npcs?.list;
  if (!list?.get || list.has(id)) return;
  const proto = list.get('evan') || [...list.values()].find((n) => !n.def?.folk);
  try { if (proto) list.set(id, new proto.constructor(id, { name })); } catch { /* none to borrow */ }
}
// The Dome on Kettle Hill, in its own frame (front door faces down the hill).
const D = { x: 500, z: -710 }, ROT = Math.PI * 0.25;
const L = (lx, lz) => ({ x: D.x + lx * Math.cos(ROT) + lz * Math.sin(ROT), z: D.z - lx * Math.sin(ROT) + lz * Math.cos(ROT) });
const FRONT = L(0, 25), HALL = L(-3, 23), SIDE_DOOR = L(22, -2), PANEL = L(22, -14), SHED = L(10, -34), VAULT = L(-6, -25);
const SQUARE = { x: 4, z: 6 };

export const LINES = {
  // ---------------------------------------------------------------- the last morning
  'd14.n.morning': { who: 'nadia', ru: 'Последний день, Рыбка. Завтра на рассвете «Полынь» проснётся. Или нет. Это зависит от сегодняшней ночи.', en: "The last day, Rybka. At dawn tomorrow, Wormwood wakes up. Or it doesn't. That depends on tonight.", emo: 'serious' },
  'd14.dm.morning': { who: 'dmitri', ru: 'Две недели назад мы посадили тебя в самолёт. Я тогда не спал всю ночь. Сегодня тоже не буду. Это нормально.', en: "Two weeks ago we put you on a plane. I didn't sleep that whole night. I won't sleep tonight either. That's normal.", emo: 'smile' },
  'd14.v.morning': { who: 'valya', ru: 'Матрёшку мою держи при себе. Сегодня, может, и пригодится.', en: 'Keep my matryoshka with you. Today it might be needed.', emo: 'smile' },
  'd14.l.morning': { who: 'lyosha', ru: 'Я проверил всё три раза. Потом ещё два. Ключ, карта, код. Всё сходится. Я просто хочу, чтобы мы все снова сели за этот стол. С чаем.', en: 'I checked everything three times. Then twice more. Key, card, code. It all adds up. I just want us all to sit at this table again. With tea.', emo: 'worry' },
  'd14.i.morning': { who: 'ivan', ru: '…Ты там осторожнее.', en: '…Take care of yourself.' },
  'd14.g.morning': { who: 'grisha', ru: 'Сегодня ночью я буду в эфире всё время. Если что — просто зови. Гриша. Громко.', en: "Tonight I'll be on the air the whole time. If anything happens, just call. Grisha. Loud.", emo: 'smile' },
  'd14.n.dress': { who: 'nadia', ru: 'Тебе идёт. Правда. У Хэллорана нет шансов.', en: "It suits you. Really. Halloran doesn't stand a chance.", emo: 'smile' },
  'd14.g.plan': { who: 'grisha', ru: 'План простой. Берёшь диск, бежишь в ангар к Уэйду и летишь через пролив. Восемьдесят километров. Я буду на связи.', en: "The plan is simple. The drive, Wade's hangar, the helicopter, across the strait. Eighty kilometres. I'll get you home." },
  'd14.n.goodbyes': { who: 'nadia', ru: 'Ты прощаешься. Они не знают. Так и надо.', en: "You're saying goodbye. They don't know it. That's how it should be.", emo: 'worry' },
  'd14.n.seven': { who: 'nadia', ru: 'Семь часов. Мэр ждёт на площади. Пора.', en: "Seven o'clock. The mayor's waiting on the square. It's time." },
  // ---------------------------------------------------------------- the suit
  'd14.k.suit': { who: 'koshkin', en: "The Gala? At the Dome? Then you can't go dressed like a carpenter. Back room. A box from nineteen sixty-two. Wedding stock. Never sold." },
  'd14.k.suit2': { who: 'koshkin', en: 'A black suit and a green velvet dress. One will fit, the other will be sad. Take whichever you like. No charge. Ha. Big charge. Joking.', emo: 'laugh' },
  'd14.d.suit': { who: 'dolly', en: "The Gala? In those boots? Oh, honey, no. I've got my late husband's tuxedo and my daughter's green dress from ninety-one. Take your pick. Bring it back with a story.", emo: 'smile' },
  // ---------------------------------------------------------------- Wade
  'd14.wa.ask': { who: 'wade', en: 'Borrow the Dragonfly? Tonight? Huh.', emo: 'surprise' },
  'd14.wa.yes': { who: 'wade', en: "Keys'll be under the seat cushion. Tank's full. I'll be at Dolly's eating pie in front of a dozen witnesses. Whatever this is, I hope it's worth my only helicopter.", emo: 'serious' },
  'd14.wa.no': { who: 'wade', en: "I don't lend her out. Not to anybody. But I sleep heavy on Sundays, and that hangar lock is older than I am. I'm just saying things out loud." },
  // ---------------------------------------------------------------- side: liturgy
  'd14.g.bless': { who: 'gabriel', en: "Stay a moment. I don't know where you're going tonight, but I can see you're going somewhere. Bow your head. There. God goes with travellers. Even the quiet ones.", emo: 'smile' },
  'd14.r.church': { who: 'ruth', en: 'Sunday. Joseph and I sat in this pew for forty years. Sit with me a minute. Just a minute.', emo: 'smile' },
  // ---------------------------------------------------------------- side: goodbyes
  'd14.d.bye': { who: 'dolly', en: "You look like somebody leaving on a long trip. Here. Blueberry pie, wrapped. For wherever you're going. Don't tell me. Just eat it.", emo: 'worry' },
  'd14.k.bye': { who: 'koshkin', en: "Sit. Tea with an old man. Yuri's cabin was empty seven months. Then you came. Strange, how a house knows when it is lived in." },
  'd14.k.bye2': { who: 'koshkin', en: 'Beregi sebya. Take care of yourself. My mother said it at the door, every time.', emo: 'smile' },
  'd14.h.bye': { who: 'hank', en: "Store's closed Sundays, but you knocked, so. Here. Good gloves. Don't argue. It's cold where you're going. It's cold everywhere up here." },
  'd14.ry.bye': { who: 'ray', en: 'Whatever happens up that hill tonight, kid, you already did more for this town than eleven years of me voting no.', emo: 'smile' },
  'd14.ni.bye': { who: 'nina', en: "I'm doing a special tonight. Songs for the longest night. Number one is for you. You don't get to know which one. It's a surprise.", emo: 'smile' },
  'd14.t.bye': { who: 'tommy', en: "Gala, huh? Fancy. If you need a fast getaway, my sled's gassed up behind the hardware store. Kidding. Unless.", emo: 'laugh' },
  'd14.lo.bye': { who: 'lou', en: "One on the house. To the longest night. Don't make that face, it's tradition. We drink to it every year, and every year the sun comes back." },
  'd14.e.bye': { who: 'ellen', en: "Doctor's last orders. Whatever you're doing tonight, come back in one piece. I'm not stitching anybody up on a Sunday." },
  'd14.p.bye': { who: 'pearl', en: "Post office is closed Sundays. But if you ever wanted to send somebody a letter, I'd find a way. Anywhere. Even across water.", emo: 'smile' },
  'd14.m.bye': { who: 'marta', en: "I'm on duty at the Dome tonight. Security liaison. Whatever happens up there, I'm going to be very slow on the radio.", emo: 'serious' },
  'd14.m.bye2': { who: 'marta', en: "I'll be at the Dome tonight. Behave yourself. I mean it." },
  'd14.ly.bye': { who: 'lyle', en: "I'm going to the Gala to resign from the Development Board. In person. In front of him. Pray for me.", emo: 'worry' },
  'd14.ly.bye2': { who: 'lyle', en: 'See you at the Dome. Try not to embarrass us both.' },
  'd14.gi.bye': { who: 'gideon', en: 'Tonight, then.' },
  'd14.ev.bye': { who: 'evan', en: 'Big night! Mr. Halloran asked me to personally make sure you get champagne. Personally!', emo: 'smile' },
  // ---------------------------------------------------------------- Walt drives you up the hill
  'd14.w.pickup': { who: 'walt', en: "Look at you. You clean up better than this town deserves. Hop in. The heater works if you hit it. Everybody's heater works if you hit it.", emo: 'smile' },
  'd14.w.exposed': { who: 'walt', en: 'Halloran still wants me up there. To give his toast. After Friday. That is how sure he is of himself.', emo: 'frown' },
  'd14.w.key': { who: 'walt', en: "Did you bring what I lent you? Don't answer that. I don't want to lie to anybody tonight. I'll be lying enough in my toast." },
  'd14.w.drive': { who: 'walt', en: 'June loved this drive. Up the hill, the whole town lit up below. She said it looked like somebody spilled a jewellery box.', emo: 'smile' },
  // ---------------------------------------------------------------- the Dome
  'd14.m4.door': { who: 'm4', name: 'Doorman', en: 'Good evening. Invitation, please. Thank you. Coats to the left. Enjoy the Winter Gala.' },
  'd14.n.inside': { who: 'nadia', ru: 'Мы тебя слышим. Дыши ровно. Улыбайся. Ты здесь гость, а гостей не обыскивают.', en: "We can hear you. Breathe evenly. Smile. You're a guest here, and nobody searches guests." },
  'd14.ev.champagne': { who: 'evan', en: "Champagne? The first glass is on Northstar. So are all the others! Isn't that wonderful?", emo: 'smile' },
  'd14.gi.welcome': { who: 'gideon', en: 'Welcome to the Dome. Coats to the left, consciences to the right. A joke. Mr. Halloran encourages jokes tonight.' },
  'd14.h.meet': { who: 'halloran', en: "There you are. The carpenter. The one who fixes things. I've wanted to meet you since the bell started ringing again.", emo: 'smile' },
  'd14.h.ledger': { who: 'halloran', en: 'That business with the projector on Friday. Very theatrical. Lyle wept in my office. I have never seen a grown man cry so efficiently.' },
  'd14.h.invited': { who: 'halloran', en: "I'm so glad you came. Losing gracefully is an underrated skill. Most people never get the practice." },
  'd14.h.councillor': { who: 'halloran', en: 'Congratulations on your seat. Small towns are wonderful. Everyone can see everyone. It makes them so easy to love.' },
  'd14.h.house': { who: 'halloran', en: 'Tell me something, as a craftsman. When a house is rotten all the way through, do you patch it? Or do you pull it down to the ground and start again?' },
  'd14.h.patch': { who: 'halloran', en: "Board by board. While the rot moves faster than your hammer. That's why you'll always be a carpenter. And I'll always be the weather.", emo: 'smile' },
  'd14.h.ask': { who: 'halloran', en: 'Ask them? They will tell you to save the wallpaper. People always want to save the wallpaper.', emo: 'smile' },
  'd14.h.inside': { who: 'halloran', en: 'Ah. Now that is the only question that matters. And the answer, my friend, is everyone. It is always everyone.', emo: 'serious' },
  'd14.h.cold': { who: 'halloran', en: "You look cold. Everyone does, at first. Stay close to the fire tonight. It's going to be a long winter." },
  'd14.o.deal': { who: 'okafor', en: "Consultant. Don't laugh. When he starts his speech, go. I'll keep the room busy." },
  'd14.o.hostile': { who: 'okafor', en: "Evening, candidate. I'm watching you tonight. Everybody in this room is watching somebody." },
  // ---------------------------------------------------------------- the speech
  'd14.h.s1': { who: 'halloran', en: "Friends. Neighbours. Thank you for climbing my hill in the dark. I know it's cold. I like the cold. The cold is honest." },
  'd14.h.s2': { who: 'halloran', en: 'Sixty years ago, men sat in this dome and watched the sky for the end of the world. They waited their whole lives. It never came. Do you know what waiting does to people?' },
  'd14.h.s3': { who: 'halloran', en: "I build machines. And every machine I have ever built, sooner or later, freezes. Too many programs. Too many patches. Too much memory of old mistakes." },
  'd14.h.s4': { who: 'halloran', en: 'It hangs. The little wheel spins. And you cannot fix it from the inside, because the inside is the problem.' },
  'd14.h.s5': { who: 'halloran', en: 'Engineers have a name for what you do then. You hold down the button. Everything goes dark. And then it starts again, clean. We call it a cold boot.', emo: 'smile' },
  'd14.n.now': { who: 'nadia', ru: 'Сейчас. Пока все смотрят на него.', en: "Now. While everyone's watching him.", emo: 'serious' },
  'd14.gi.wine': { who: 'gideon', en: "You clumsy— that is a four-hundred-dollar shirt!", emo: 'angry' },
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
  'd14.w.toast': { who: 'walt', en: "And now my toast. To June Hennessey, who wound a music box every night of her life, so the morning would have something to wake up to.", emo: 'serious' },
  // ---------------------------------------------------------------- the back corridors
  'd14.l.shifts': { who: 'lyosha', ru: 'Две минуты девятого. Смена караула. Коридоры пустые — у тебя окно.', en: 'Two minutes past eight. The guard change. The corridors are empty — you have a window.' },
  'd14.l.tunnel': { who: 'lyosha', ru: 'По чертежам Рут: генераторная, люк, туннель. Прямо к хранилищу.', en: "By Ruth's blueprints: the generator shed, a hatch, a tunnel. Straight to the vault." },
  'd14.l.door': { who: 'lyosha', ru: 'Служебная дверь с восточной стороны. Замок старый, армейский. Такие ты открываешь с закрытыми глазами.', en: 'The service door on the east side. An old army lock. You open those with your eyes closed by now.' },
  'd14.m2.guard': { who: 'm2', name: 'Security', en: "Excuse me. Guests can't be back here. The party's in the main hall." },
  'd14.m2.rest': { who: 'm2', name: 'Security', en: "Back the way you came, second door on the left. And don't touch the art. Mr. Halloran knows when you touch the art." },
  'd14.l.panel': { who: 'lyosha', ru: 'Охранная панель. Красный к белому, синий никуда. Тихо.', en: 'The security panel. Red to white, blue to nothing. Quietly.' },
  'd14.g.copy': { who: 'grisha', ru: 'Копия работает! Ну, Гриша, ну, молодец.', en: 'The copy works! Well, Grisha, well done, you.', emo: 'laugh' },
  'd14.n.waltkey': { who: 'nadia', ru: 'Ключ мэра. Он бы хотел это видеть.', en: "Walt's key. He'd want to see this.", emo: 'smile' },
  'd14.v.vault': { who: 'valya', ru: 'Он шифрует ксором с числом двадцать три. Двадцать три, рыбка! Мой домашний телефон в Анадыре был сложнее.', en: 'He encrypts with XOR and the number twenty-three. Twenty-three, little fish! My home phone number in Anadyr was harder.', emo: 'smile' },
  'd14.l.retry': { who: 'lyosha', ru: 'Не успели… Ничего. Экран ждёт. Ещё раз, быстро.', en: "Not in time… It's fine. The screen is waiting. Again, quickly.", emo: 'worry' },
  'd14.l.welcome': { who: 'lyosha', ru: '«Добро пожаловать, мистер Хэллоран». Ха! Теперь мы — мистер Хэллоран.', en: "'Welcome, Mr. Halloran.' Ha! Now we're Mr. Halloran.", emo: 'laugh' },
  'd14.n.drive': { who: 'nadia', ru: 'Диск. Бери диск.', en: 'The drive. Take the drive.', emo: 'serious' },
  // ---------------------------------------------------------------- alarm
  'd14.n.alarm': { who: 'nadia', ru: 'Тревога! Рыбка, беги! Сейчас же!', en: 'Alarm! Rybka, run! Now!', emo: 'worry' },
  'd14.l.radio': { who: 'lyosha', ru: 'Я в их рации. Слушай.', en: "I'm in their radio. Listen." },
  'd14.gi.radio': { who: 'gideon', en: 'Seal the hill. Nobody leaves. Find the carpenter. Alive, if it is convenient.', emo: 'angry' },
  'd14.g.run': { who: 'grisha', ru: 'Вниз по дороге, к аэродрому! Не оглядывайся! Я с тобой!', en: "Down the road, to the airstrip! Don't look back! I'm with you!", emo: 'angry' },
  'd14.g.road': { who: 'grisha', ru: 'Дорога вниз, километр. Держись обочины — в темноте тебя не видно.', en: "It's a kilometre down the road. Keep to the edge — they can't see you in the dark." },
  'd14.h.pa': { who: 'halloran', en: 'Ladies and gentlemen, a small technical matter. Please, enjoy the music. Nothing is going to happen tonight.', emo: 'smile' },
  'd14.h.call': { who: 'halloran', en: "Carpenter. You've taken something of mine. Keep it. It won't matter. At dawn the world turns off, and you'll be standing in the dark with a little drive in your hand.", emo: 'serious' },
  'd14.h.call2': { who: 'halloran', en: "I liked you, you know. I still do. That's the terrible thing about a cold boot. It doesn't care who you like." },
  'd14.l.lie': { who: 'lyosha', ru: 'Он врёт. С этим диском — не выключит. Беги.', en: "He's lying. With that drive, he can't. Run.", emo: 'angry' },
  // ---------------------------------------------------------------- the hangar
  'd14.g.key': { who: 'grisha', ru: 'Ключ под подушкой сиденья. Все пилоты так делают.', en: 'The key is under the seat cushion. Every pilot does that.' },
  'd14.o.go': { who: 'okafor', en: "You're late. Go. She's warm, I checked. Whatever's on that drive, I hope it's everything you said.", emo: 'serious' },
  'd14.o.blind': { who: 'okafor', en: "I didn't see a thing.", emo: 'smile' },
  'd14.o.stop': { who: 'okafor', en: "Hands where I can see them. Whatever's in your pocket, put it on the ground. Slowly.", emo: 'angry' },
  'd14.o.listen': { who: 'okafor', en: "You're telling me the lights go out at dawn. Everywhere. Hospitals. Everything.", emo: 'worry' },
  'd14.o.blind2': { who: 'okafor', en: "Go. I didn't see a thing. And if you're lying, God help us both.", emo: 'serious' },
  'd14.o.lower': { who: 'okafor', en: "Damn it. Damn it. Go. I didn't see a thing.", emo: 'frown' },
  'd14.g.fly': { who: 'grisha', ru: 'Садись. Пристегнись. Левая рука — шаг-газ, правая — ручка. Как учил Уэйд. Поехали!', en: 'Sit. Buckle up. Left hand, collective; right hand, cyclic. Like Wade taught you. Let\'s go!', emo: 'smile' },
  'd14.dm.fly': { who: 'dmitri', ru: 'Мы ждём. Чайник уже на плите.', en: "We're waiting. The kettle's already on.", emo: 'smile' },
  'd14.v.fly': { who: 'valya', ru: 'Лети, рыбка. Лети.', en: 'Fly, little fish. Fly.', emo: 'smile' },
  'd14.n.fly': { who: 'nadia', ru: 'Лети домой, Рыбка.', en: 'Fly home, Rybka.', emo: 'smile' },
};

/** The square's looped cameras stay looped after a reload (the loop lives in Lyosha's tap, not in the save). */
const reloop = (m) => { const A = m.G.attention; if (!m.flag('camsLooped') || !A) return; (A.watchers || []).forEach((w, i) => { if (w.owner === 'smartlight' && Math.hypot(w.x, w.z) < 80) A.looped?.add(i); }); };

// ---------------------------------------------------------------- missions
async function hack(m, id, where, retryLine, retryText) {
  for (;;) {
    if (passed(await m.code(id))) return true;
    await m.ear(retryLine);
    m.obj(retryText, where);
    await m.spot('retry.' + id, where, retryText, 3);
  }
}
const koshkinHere = (F) => !F.koshkinHospital || !!F.koshkinBack;
const BYE = ['dolly', 'koshkin', 'hank', 'ray', 'nina', 'tommy', 'lou', 'ellen', 'pearl', 'marta', 'lyle'];

export const MISSIONS = {
  'd14.morning': {
    title: 'The Last Day', main: true, day: 14,
    async run(m, from) {
      reloop(m);
      const G = m.G, F = G.state.flags, inv = G.state.inv;
      if (m.cp(1, from)) {
        // nothing upstream should leave these unset, but the last day must never dead-end
        if (!F.galaInvite) m.flag('galaInvite', true);
        if (!F.mayorKey) { m.flag('mayorKey', true); if (!F.mayorKeyCopied) m.flag('mayorKeyGiven', true); }
        if (!F.sharesCombined) m.flag('sharesCombined', true);
        await m.wait(1.0);
        await m.ear('d14.n.morning');
        await m.ears(['d14.dm.morning', 'd14.v.morning', 'd14.l.morning', 'd14.i.morning', 'd14.g.morning']);
        m.start('d14.liturgy');
        m.start('d14.goodbyes');
      }
      if (m.cp(2, from)) {
        const who = koshkinHere(F) ? 'koshkin' : 'dolly';
        const text = who === 'koshkin' ? "Ask Koshkin for something to wear tonight" : 'Ask Dolly for something to wear tonight';
        const sub = who === 'koshkin' ? "Koshkin's store" : 'The Midnight Sun Diner';
        m.obj(text, who, sub);
        const late = () => G.state.hour >= 18.5 || G.state.hour < 6;
        await hold(m, () => (inv.gala_clothes || 0) > 0 || !!F.galaOutfit || late(), text, who, sub);
        if (!F.galaOutfit && !((inv.gala_clothes || 0) > 0)) { m.flag('galaOutfit', 'own'); G.hud.toast('NO TIME', 'Your own clothes, brushed clean. They will have to do.', '#ffb21e'); }
      }
      if (m.cp(3, from)) {
        m.obj('Dress for the Gala', 'cabin.wardrobe', 'Your cabin');
        await m.spot('dress', 'cabin.wardrobe', 'Dress for the Gala', 2.4);
        m.flag('dressed', true);
        G.hud.toast('DRESSED', F.galaOutfit === 'dress' ? 'Green velvet, 1962' : F.galaOutfit === 'own' ? 'Clean boots, best sweater' : 'Black suit, 1962', '#ffd166');
        await m.ear('d14.n.dress');
      }
      if (m.cp(4, from)) {
        m.obj('Talk to Wade about tonight', 'wade', 'The hangar until 16:00 · the diner after');
        await hold(m, () => !!F['d14.wadeAsked'] || G.state.hour >= 18.5 || G.state.hour < 6, 'Talk to Wade about tonight', 'wade', 'The hangar until 16:00 · the diner after');
        await m.ear('d14.g.plan');
      }
      if (m.cp(5, from)) {
        m.done();
        m.start('d14.gala');
      }
    },
  },

  'd14.gala': {
    title: 'The Winter Gala', main: true, day: 14,
    async run(m, from) {
      reloop(m);
      const G = m.G, F = G.state.flags, inv = G.state.inv;
      const pa = (ids) => { for (const id of ids) m.ear(id); };   // the speech goes on, over the Dome's speakers
      if (m.cp(1, from)) {
        m.obj('Meet the Mayor on Church Square', SQUARE, 'Seven o\'clock, dressed for the Gala');
        await hold(m, () => { const h = G.state.hour; return h >= 18.9 || h < 4; }, 'Meet the Mayor on Church Square', SQUARE, "Seven o'clock, dressed for the Gala");
        m.ear('d14.n.seven');
        await m.reach(SQUARE, 9);
      }
      if (m.cp(2, from)) {
        m.clear();
        G.missions.cancel?.('d14.goodbyes');
        G.missions.cancel?.('d14.liturgy');
        G.missions.cancel?.('d13.rehearsal');
        await m.scene(async (d) => {
          await d.bring('walt', { x: SQUARE.x + 2, z: SQUARE.z + 1.5 }, { face: 'player' });
          await d.say('walt', 'd14.w.pickup', { cam: d.closeUp('walt') });
          if (F.waltExposed) await d.say('walt', 'd14.w.exposed', { cam: d.closeUp('walt', { side: -1 }) });
          await d.say('walt', F.mayorKeyGiven ? 'd14.w.key' : 'd14.w.drive', { cam: d.closeUp('walt', { dist: 0.7 }) });
        });
        await G.fadeTeleport({ ...FRONT, yaw: ROT + Math.PI }, 2.4);
      }
      if (m.cp(3, from)) {
        ensureNpc(G, 'halloran', 'Cyrus Halloran');
        ensureNpc(G, 'okafor', 'Special Agent Okafor');
        await m.scene(async (d) => {
          await d.say('m4', 'd14.m4.door');
          await d.say('nadia', 'd14.n.inside', { radio: true });
          await d.bring('evan', L(2, 23), { face: 'player' });
          await d.say('evan', 'd14.ev.champagne', { cam: d.closeUp('evan') });
          await d.bring('gideon', L(-2, 23.5), { face: 'player' });
          await d.say('gideon', 'd14.gi.welcome', { cam: d.closeUp('gideon') });
          await d.bring('halloran', L(0.5, 22.5), { face: 'player' });
          await d.say('halloran', 'd14.h.meet', { cam: d.closeUp('halloran') });
          const by = F.galaInviteBy;
          await d.say('halloran', F.ledgerUsed ? 'd14.h.ledger' : by === 'halloran' ? 'd14.h.invited' : 'd14.h.councillor', { cam: d.closeUp('halloran', { side: -1 }) });
          await d.say('halloran', 'd14.h.house', { cam: d.closeUp('halloran', { dist: 0.6 }) });
          const k = await d.choose(['You patch it. Board by board.', 'You ask the people who live in it.', "Depends who's still inside."], { prompt: 'CYRUS HALLORAN' });
          await d.say('halloran', ['d14.h.patch', 'd14.h.ask', 'd14.h.inside'][k] || 'd14.h.patch', { cam: d.closeUp('halloran') });
          await d.say('halloran', 'd14.h.cold', { cam: d.closeUp('halloran', { side: -1, dist: 0.55 }) });
          await d.bring('okafor', L(-3.5, 22), { face: 'player' });
          await d.say('okafor', F.okaforDeal ? 'd14.o.deal' : 'd14.o.hostile', { cam: d.closeUp('okafor') });
        });
        m.flag('metHalloran', true);
      }
      if (m.cp(4, from)) {
        await m.scene(async (d) => {
          await d.bring('halloran', HALL, { face: 'player' });
          await d.bring('walt', L(-1.5, 26.5), { face: 'halloran' });
          await d.bring('gideon', L(1.5, 26), { face: 'halloran' });
          await d.bring('lyle', L(3, 27), { face: 'halloran' });
          await d.bring('okafor', L(-3.5, 27.5), { face: 'halloran' });
          await d.say('halloran', 'd14.h.s1', { cam: d.closeUp('halloran') });
          await d.say('halloran', 'd14.h.s2', { cam: d.closeUp('halloran', { side: -1, dist: 0.9 }) });
          await d.say('halloran', 'd14.h.s3');
          await d.say('halloran', 'd14.h.s4', { cam: d.closeUp('halloran', { dist: 0.6 }) });
          await d.say('halloran', 'd14.h.s5', { cam: d.closeUp('halloran', { side: -1, dist: 0.5 }) });
          await d.say('nadia', 'd14.n.now', { radio: true });
          if (F.okaforDeal) {
            await d.say('gideon', 'd14.gi.wine', { cam: d.closeUp('gideon') });
            await d.say('okafor', 'd14.o.wine', { cam: d.closeUp('okafor') });
            await d.say('nadia', 'd14.n.grey', { radio: true });
          }
        });
        const rate = 9 * (F.domeShifts ? 0.5 : 1) * (F.okaforDeal ? 0.6 : F.okaforHostile ? 1.4 : 1);
        G.attention.zone('d14.dome', D.x, D.z, 70, rate, 'The Dome');
        pa(['d14.h.s6', 'd14.h.s7']);
      }
      if (m.cp(5, from)) {
        if (F.domePlans) {
          m.ear('d14.l.tunnel');
          m.obj('Find the hatch in the generator shed', SHED, "Ruth's blueprints: the old tunnel");
          await m.spot('hatch', SHED, 'Clear the hatch', 2.8);
          G.attention.act(0.8, 6);
          await m.minigame('shovel', { title: 'DIG OUT THE HATCH' });
          pa(['d14.h.s8', 'd14.h.s9']);
          await G.fadeTeleport({ ...VAULT, yaw: ROT }, 1.6);
        } else {
          if (F.domeShifts) m.ear('d14.l.shifts');
          m.ear('d14.l.door');
          m.obj('The service door', SIDE_DOOR, 'East side of the Dome — stay low');
          await m.spot('door', SIDE_DOOR, 'Pick the lock', 2.6);
          if (!F.domeShifts) {
            let bluff = true;
            await m.scene(async (d) => {
              await d.say('m2', 'd14.m2.guard');
              bluff = (await d.choose(["(Hold up the invitation.) I'm looking for the restroom.", '(Freeze in the shadow until he turns away.)'], { prompt: 'A GUARD' })) === 0;
              if (bluff) await d.say('m2', 'd14.m2.rest');
            });
            if (bluff) G.attention.add(6); else G.attention.act(1.6, 6);
          }
          G.attention.act(1.2, 8);
          if (!(await m.minigame('lock', { title: 'THE SERVICE DOOR' }))) G.attention.add(10);
          pa(['d14.h.s8']);
          m.obj('The security panel', PANEL, 'Inside the service corridor');
          await m.spot('panel', PANEL, 'Open the security panel', 2.6);
          await m.ear('d14.l.panel');
          G.attention.act(1.2, 8);
          if (!(await m.minigame('wire', { title: 'THE SECURITY PANEL' }))) G.attention.add(10);
          pa(['d14.h.s9']);
        }
      }
      if (m.cp(6, from)) {
        m.obj('The vault', VAULT, 'The brass key, the card, the terminal');
        await m.spot('key', VAULT, 'Turn the brass key', 2.8);
        await m.ear(F.mayorKeyCopied ? 'd14.g.copy' : 'd14.n.waltkey');
        G.hud.toast('THE VAULT', 'The brass key turns. The card slides home.', '#ffd166');
        await m.ear('d14.v.vault');
        const toasts = ['d14.h.s10', 'd14.h.s11', 'd14.gi.toast', 'd14.ly.toast', 'd14.ev.toast'];
        if (F.mayorKeyGiven || F.waltExposed || F.musicBoxFixed) toasts.push('d14.w.toast');
        pa(toasts);
        m.obj('Decode the vault terminal', VAULT, 'Field hack — six minutes, while the toasts go on');
        await hack(m, 'vault', VAULT, 'd14.l.retry', 'Decode the vault terminal again');
        m.ear('d14.l.welcome');
        m.ear('d14.n.drive');
        m.obj('Take the drive', VAULT);
        await m.spot('drive', VAULT, 'Take the drive', 2.8);
        m.flag('hasDrive', true);
        inv.drive = 1;
        G.hud.toast('THE ROOT KEY', 'The drive is in your pocket', '#ffd166');
      }
      if (m.cp(7, from)) {
        G.sfx?.alarm?.();
        G.attention.clearZone('d14.dome');
        G.attention.add(20);
        m.flag('alarm', true);
        await m.ear('d14.n.alarm');
        await m.ear('d14.l.radio');
        await m.ear('d14.gi.radio');
        m.ear('d14.g.run');
        m.ear('d14.g.road');
        m.ear('d14.h.pa');
        m.obj("Get to Wade's hangar", 'hangar', 'Down Kettle Hill Road — run');
        await m.until(() => Math.hypot((G.player?.pos?.x ?? D.x + 200) - D.x, (G.player?.pos?.z ?? D.z) - D.z) > 120);
        await m.ears(['d14.h.call', 'd14.h.call2', 'd14.l.lie']);
        await hold(m, () => { const p = G.player?.pos; const h = G.town?.buildings?.hangar; return !p || !h || Math.hypot(p.x - h.x, p.z - h.z) < 26; }, "Get to Wade's hangar", 'hangar', 'Down Kettle Hill Road — run');
      }
      if (m.cp(8, from)) {
        if (!F.wadeReady) {
          m.obj('Get into the hangar', 'hangar', 'The lock is older than Wade');
          await m.spot('hangar', 'hangar', 'Force the hangar door', 3.2);
          await m.minigame('lock', { title: 'THE HANGAR DOOR' });
          await m.ear('d14.g.key');
        }
        m.clear();
        ensureNpc(G, 'okafor', 'Special Agent Okafor');
        await m.scene(async (d) => {
          await d.bring('okafor', { x: 374, z: -22 }, { face: 'player' });
          if (F.okaforDeal) {
            await d.say('okafor', 'd14.o.go', { cam: d.closeUp('okafor') });
            await d.say('okafor', 'd14.o.blind', { cam: d.closeUp('okafor', { side: -1, dist: 0.6 }) });
          } else {
            await d.say('okafor', 'd14.o.stop', { cam: d.closeUp('okafor') });
            const k = await d.choose(['(Show him the drive. Tell him everything, fast.)', '(Walk past him to the helicopter.)'], { prompt: 'SPECIAL AGENT OKAFOR' });
            if (k === 0) {
              await d.say('okafor', 'd14.o.listen', { cam: d.closeUp('okafor', { side: -1 }) });
              await d.say('okafor', 'd14.o.blind2', { cam: d.closeUp('okafor', { dist: 0.6 }) });
            } else await d.say('okafor', 'd14.o.lower', { cam: d.closeUp('okafor', { dist: 0.6 }) });
          }
        });
        m.flag('okaforLetGo', true);
      }
      if (m.cp(9, from)) {
        await m.ear('d14.g.fly');
        await m.ear('d14.dm.fly');
        await m.ear('d14.v.fly');
        await m.ear('d14.n.fly');
        // No m.done(): the mission stays active at this checkpoint, so a reload
        // during the finale replays the hand-off instead of stranding Rybka in town.
        m.flag('toFinale', true);
        m.clear();
        await m.G.finale?.();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd14.liturgy': {
    title: 'Sunday Liturgy', day: 14,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Sunday liturgy at Holy Transfiguration', 'church.narthex', 'Optional — the bells ring at nine');
        await m.reach('church.narthex', 4);
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.bring('ruth', pt(G, 'church.narthex', { x: 0, z: -26 }, -1.2, -1.5), { sit: true, face: 'player' });
          await d.say('ruth', 'd14.r.church', { cam: d.closeUp('ruth') });
          await d.bring('gabriel', pt(G, 'church.narthex', { x: 0, z: -26 }, 0.8, -2.2), { face: 'player' });
          await d.say('gabriel', 'd14.g.bless', { cam: d.closeUp('gabriel') });
        });
        G.attention.add(-20);
        G.hud.toast('BLESSED', 'Northstar looks away a little', '#9fe8b0');
        m.flag('blessed', true);
        m.done();
      }
    },
  },

  'd14.goodbyes': {
    title: 'Goodbyes', day: 14,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        const n = () => BYE.filter((k) => G.state.flags['d14.bye.' + k]).length;
        let last = -1;
        await m.until(() => {
          const k = n();
          if (k !== last || !G.hud?.objective) { last = k; m.obj('Spend some time with friends', BYE.find((b) => !G.state.flags['d14.bye.' + b]) || 'diner', `Optional · ${Math.min(k, 4)} / 4 visits`); }
          return k >= 4;
        });
        await m.ear('d14.n.goodbyes');
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const ELSE = { label: 'Something else.', key: 'prev' };
const outfitNow = (c) => c.G.missions.isActive('d14.morning') && !c.hasItem('gala_clothes') && !c.flag('galaOutfit');
async function pickOutfit(c) {
  const k = await c.choose(['(The black suit.)', '(The green velvet dress.)']);
  c.flag('galaOutfit', k === 1 ? 'dress' : 'suit');
  c.give('gala_clothes');
  c.emit('outfit');
}
/** A farewell nobody knows is one: once per friend, counted by the Goodbyes task. */
const bye = (npc, line, gift) => async (c, prev) => {
  if (c.day !== 14 || c.flag('d14.bye.' + npc)) return prev(c);
  c.flag('d14.bye.' + npc, true);
  for (const l of [].concat(typeof line === 'function' ? line(c) : line)) await c.say(npc, l);
  if (gift) c.give(gift);
  c.rel(4);
};
const once = (npc, key, line) => async (c, prev) => {
  if (c.day !== 14 || c.flag(key)) return prev(c);
  c.flag(key, true);
  await c.say(npc, line);
};

export const DIALOG = {
  koshkin: async (c, prev) => {
    if (c.day !== 14) return prev(c);
    if (outfitNow(c) && koshkinHere(c.state.flags)) {
      const k = await c.choose([{ label: 'Sasha, I need something to wear to the Gala.', key: 'suit' }, ELSE]);
      if (k === 'suit') { await c.say('koshkin', 'd14.k.suit'); await c.say('koshkin', 'd14.k.suit2'); await pickOutfit(c); c.rel(4); return; }
      return prev(c);
    }
    return bye('koshkin', ['d14.k.bye', 'd14.k.bye2'])(c, prev);
  },
  dolly: async (c, prev) => {
    if (c.day !== 14) return prev(c);
    if (outfitNow(c) && !koshkinHere(c.state.flags)) {
      const k = await c.choose([{ label: 'Dolly, I need something to wear to the Gala.', key: 'suit' }, ELSE]);
      if (k === 'suit') { await c.say('dolly', 'd14.d.suit'); await pickOutfit(c); c.rel(4); return; }
      return prev(c);
    }
    return bye('dolly', 'd14.d.bye', 'pie')(c, prev);
  },
  wade: async (c, prev) => {
    if (c.day !== 14 || c.flag('d14.wadeAsked') || !c.G.missions.isActive('d14.morning')) return prev(c);
    const k = await c.choose([{ label: 'Wade… if I needed to borrow the Dragonfly tonight?', key: 'ask' }, ELSE]);
    if (k !== 'ask') return prev(c);
    await c.say('wade', 'd14.wa.ask');
    const yes = c.level >= 2 || c.flag('flight1') || c.flag('flight2') || c.flag('flight3');
    await c.say('wade', yes ? 'd14.wa.yes' : 'd14.wa.no');
    c.flag('wadeReady', !!yes);
    c.flag('d14.wadeAsked', true);
    c.rel(3);
    c.emit('talk:wade');
  },
  hank: bye('hank', 'd14.h.bye', 'good_gloves'),
  ray: bye('ray', 'd14.ry.bye'),
  nina: bye('nina', 'd14.ni.bye'),
  tommy: bye('tommy', 'd14.t.bye'),
  lou: bye('lou', 'd14.lo.bye'),
  ellen: bye('ellen', 'd14.e.bye'),
  pearl: bye('pearl', 'd14.p.bye'),
  marta: bye('marta', (c) => (c.flag('martaTrust') ? 'd14.m.bye' : 'd14.m.bye2')),
  lyle: bye('lyle', (c) => (c.flag('lyleConfessed') || c.flag('lyleAlly') ? 'd14.ly.bye' : 'd14.ly.bye2')),
  gideon: once('gideon', 'd14.gi.chatted', 'd14.gi.bye'),
  evan: once('evan', 'd14.ev.chatted', 'd14.ev.bye'),
};
export const DIALOG_OVERRIDE = true;
