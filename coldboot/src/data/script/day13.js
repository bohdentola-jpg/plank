// DAY 13 — Election Day (Saturday). Two days to dawn. Polls at the Parish Hall
// from eight to eight. Collect the last continuity cards (any council member
// still holding one will hand it over today, so the game can't dead-end),
// assemble the vault key with the 'shares' field hack, and stand in the hall
// for the count. Win the seat, or Walt appoints you to the Development Board
// (if he gave you his key), or Halloran simply invites his opponent: either
// way, galaInvite. Side: drive the old folks to the polls; watch the boxes.
export const DAY = { n: 13, start: ['d13.vote'], mustFinish: ['d13.night'] };

const passed = (r) => r === true || !!(r && r.pass);
const pt = (G, name, fb, dx = 0, dz = 0) => { const q = G.town?.points?.[name]; return q ? { x: q.x + dx, z: q.z + dz } : { x: fb.x + dx, z: fb.z + dz }; };
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });
const SHARE_IDS = ['dolly', 'hank', 'ruth', 'ray', 'lyle'];
const shareCount = (s) => SHARE_IDS.filter((k) => s.flags['share.' + k] === true || (s.shares || {})[k]).length;
const STAGE = { x: -40, z: -42 };
/** Cancel a side task and take its leftover interaction spots out of the world. */
function drop(G, id, spots = []) { for (const sp of spots) G.interact?.remove?.(`${id}:${sp}`); G.missions.cancel?.(id); }
const lvl = (G, id) => Math.min(5, Math.floor((G.state.rel[id] || 0) / 20));
const FRIENDS = ['koshkin', 'dolly', 'hank', 'ruth', 'ray', 'marta', 'walt', 'gabriel', 'nina', 'lou', 'tommy', 'ellen', 'pearl', 'wade'];

export const LINES = {
  // ---------------------------------------------------------------- morning
  'd13.n.morning': { who: 'nadia', ru: 'Два дня, Рыбка. Сегодня выборы. Участок в приходском зале, с восьми до восьми.', en: "Two days, Rybka. Today's the election. The polling station is in the Parish Hall, eight to eight." },
  'd13.dm.vote': { who: 'dmitri', ru: 'Знаешь, Рыбка… сорок лет я голосовал там, где всё решено заранее. А сегодня волнуюсь за выборы в американском городке. Смешно.', en: "You know, Rybka… for forty years I voted where everything was decided in advance. And today I'm nervous about an election in a little American town. Funny.", emo: 'smile' },
  'd13.l.cards': { who: 'lyosha', ru: 'Пока город голосует, мы считаем карточки. Нужно три из пяти.', en: 'While the town votes, we count cards. We need three out of five.' },
  'd13.l.enough': { who: 'lyosha', ru: 'А у нас уже три. Даже больше, может быть. Баба Валя довольна.', en: "And we already have three. Maybe more. Baba Valya is pleased.", emo: 'smile' },
  'd13.n.short': { who: 'nadia', ru: 'Карточек меньше трёх. Сегодня последний шанс. Совет весь день в городе — спрашивай прямо.', en: "We have fewer than three cards. Today is the last chance. The whole council is in town all day — ask them straight." , emo: 'worry' },
  'd13.n.boxes': { who: 'nadia', ru: 'И помни, что сказал Лайл: урны носят их люди. Вечером, когда урны понесут, будь рядом.', en: "And remember what Lyle said: their people carry the boxes. This evening, when they move the boxes, be close by." },
  // ---------------------------------------------------------------- voting
  'd13.p.ballot': { who: 'pearl', en: "Name? Oh, I know your name, hon. Everybody does today. Booth's on the left. The pencil's on a string. Don't steal the pencil.", emo: 'smile' },
  'd13.p.self': { who: 'pearl', en: "Folded twice, very proper. In it goes. Don't look at me like that, I can't see through paper. Mostly.", emo: 'laugh' },
  'd13.p.lyle': { who: 'pearl', en: "You did not. Oh, you did. Lord. I'm going to pretend I didn't see that, and so are you.", emo: 'surprise' },
  // ---------------------------------------------------------------- the cards
  'd13.ry.card': { who: 'ray', en: "Ha. I wondered when you'd ask. Here. It belongs to the seat, and the seat goes to somebody honest today, one way or another.", emo: 'smile' },
  'd13.r.card': { who: 'ruth', en: "I knew it. Joseph always said, Ruthie, when they hand you something laminated, read the back. Take it. And go carefully.", emo: 'serious' },
  'd13.d.card': { who: 'dolly', en: "This old thing? It's been holding my recipe box shut. Take it, honey. If it matters to Northstar, it matters more to you." },
  'd13.h.card': { who: 'hank', en: "That card? Gideon said it was for emergencies. You look like an emergency. Twenty bucks. I'm kidding. Take it." },
  'd13.ly.card': { who: 'lyle', en: "Take it. I signed it first, before anybody else. Seems right that I'm the first to hand it over.", emo: 'serious' },
  'd13.ly.nocard': { who: 'lyle', en: "My card? After last night? Not a chance. A man has to keep something.", emo: 'frown' },
  'd13.v.three': { who: 'valya', ru: 'Три. Ну что, рыбка, будем клеить ключ?', en: 'Three. Well, little fish, shall we glue the key together?', emo: 'smile' },
  'd13.l.card': { who: 'lyosha', ru: 'Твой код записывает ключ на пустую карту. Завтра хранилище примет её за свою.', en: 'Your code writes the key onto a blank card. Tomorrow the vault will take it for one of its own.' },
  'd13.l.retry': { who: 'lyosha', ru: 'Порядок, Рыбка. Сначала по номерам, потом склеивать. Ещё раз.', en: "Order, Rybka. First by the numbers, then glue. Once more." },
  'd13.v.numbers': { who: 'valya', ru: 'Числа, рыбка, а не буквы. Десять после девяти. Я же говорила.', en: 'Numbers, little fish, not letters. Ten comes after nine. I told you so.', emo: 'smile' },
  // ---------------------------------------------------------------- the count
  'd13.p.count': { who: 'pearl', en: 'Four hundred and twelve ballots issued. Three hundred and seventy-six cast. Two spoiled. One of them is a drawing of a moose. It\'s a good moose.', emo: 'smile' },
  'd13.gi.recount': { who: 'gideon', en: "The City Manager's office requests that the east box be counted again. Carefully." },
  'd13.r.denied': { who: 'ruth', en: 'Request denied, Gideon. I watched that box all day. So did half the town.', emo: 'smile' },
  'd13.m.denied': { who: 'marta', en: "Denied. That box hasn't left my sight since eight this morning. Sit down, Gideon.", emo: 'serious' },
  'd13.w.read': { who: 'walt', en: "Alright. Quiet, everybody. I promised June I'd always read them out loud, so here it is." },
  'd13.w.win': { who: 'walt', en: 'For the vacant council seat. A fine showing from Lyle Pruitt. And the winner, by the votes of this town, is our carpenter. Port Zarya has a new council member.', emo: 'smile' },
  'd13.w.lose': { who: 'walt', en: "For the vacant council seat. It was close, folks. Closer than anybody guessed. The winner is Lyle Pruitt." },
  'd13.d.cheer': { who: 'dolly', en: 'Yes! Oh, yes! Somebody hold my coffee!', emo: 'laugh' },
  'd13.ry.seat': { who: 'ray', en: "It's your chair now. Sit in it like you mean it.", emo: 'smile' },
  'd13.ly.lose': { who: 'lyle', en: 'Congratulations. Really. Enjoy the view from up there. It gets cold.', emo: 'frown' },
  'd13.ly.loseFree': { who: 'lyle', en: "Congratulations. I voted for you, by the way. First honest vote I've cast in three years.", emo: 'smile' },
  'd13.gi.smirk': { who: 'gideon', en: 'Democracy. Isn\'t it reassuring.', emo: 'smile' },
  'd13.r.close': { who: 'ruth', en: 'Close is not nothing. Close means half this town stood up.', emo: 'serious' },
  'd13.gi.invite': { who: 'gideon', en: "Congratulations, councillor. Mr. Halloran's compliments. Every council member attends the Winter Gala. Tomorrow, eight o'clock, at the Dome. Black tie." },
  'd13.w.appoint': { who: 'walt', en: "Hold on. One more thing. The Development Board has had a town seat empty since spring. The mayor fills it. I'm appointing our carpenter. Effective now.", emo: 'serious' },
  'd13.gi.objects': { who: 'gideon', en: 'Mr. Mayor, that seat is not—' },
  'd13.w.charter': { who: 'walt', en: "Mine to fill, Gideon. Read the charter. Ruth typed it.", emo: 'smile' },
  'd13.gi.invite2': { who: 'gideon', en: "Then you will need this. The Winter Gala. Board members attend. Eight o'clock, the Dome. Black tie.", emo: 'frown' },
  'd13.gi.halloran': { who: 'gideon', en: "Don't look so sad. Mr. Halloran listened to the debate. He'd like to meet you. Personally. Tomorrow, at the Gala. He likes to know his opponents.", emo: 'smile' },
  // ---------------------------------------------------------------- the team, after
  'd13.g.win': { who: 'grisha', ru: 'Советник! Наша Рыбка — советник! Валя, наливай!', en: "A councillor! Our Rybka's a councillor! Valya, pour!", emo: 'laugh' },
  'd13.v.win': { who: 'valya', ru: 'Уже налила, Гриша. Уже налила.', en: 'Already poured, Grisha. Already poured.', emo: 'smile' },
  'd13.n.win': { who: 'nadia', ru: 'Две недели назад — плотник с самолёта. Сегодня — член городского совета. Я горжусь тобой, Рыбка.', en: "Two weeks ago, a carpenter off a plane. Today, a member of the town council. I'm proud of you, Rybka.", emo: 'smile' },
  'd13.n.appointed': { who: 'nadia', ru: 'Не совет — так правление. Мэр поставил на тебя всё, что у него осталось. Не забывай этого.', en: "Not the council — the Board, then. The mayor bet everything he had left on you. Don't forget that.", emo: 'serious' },
  'd13.dm.halloran': { who: 'dmitri', ru: 'Он зовёт тебя сам. Значит, боится. Или ему скучно. Не знаю, что хуже.', en: "He invites you himself. So he's afraid. Or bored. I don't know which is worse.", emo: 'serious' },
  'd13.n.halloran': { who: 'nadia', ru: 'Он хочет посмотреть на тебя вблизи. Хорошо. Мы на него тоже.', en: 'He wants a close look at you. Good. We want one at him.', emo: 'serious' },
  'd13.l.gala': { who: 'lyosha', ru: 'Приглашение есть. Карточки есть. Ключ есть. Остался Купол.', en: "We have the invitation. The cards. The key. Only the Dome is left." },
  'd13.l.wait': { who: 'lyosha', ru: 'Только сначала ключ из карточек. Без него завтра хранилище не откроется.', en: "Just assemble the key from the cards first. Without it, the vault won't open tomorrow." },
  'd13.n.lesson': { who: 'nadia', ru: 'Иди домой, Рыбка. Сегодня Лёша учит читать ошибки. Завтра это может спасти мир.', en: 'Go home, Rybka. Tonight Lyosha teaches you to read errors. Tomorrow that might save the world.' },
  'd13.l.after': { who: 'lyosha', ru: 'Ошибка — это записка: «Ищи здесь». Только не паникуй, когда её видишь. Обещаешь?', en: "An error is a note that says 'look here'. Just don't panic when you see one. Promise?", emo: 'smile' },
  'd13.l.rehearsal': { who: 'lyosha', ru: 'Есть ещё один урок. Репетиция. Если хватит сил — сегодня. Если нет — завтра утром.', en: "There's one more lesson. A rehearsal. If you have the strength, tonight. If not, tomorrow morning." },
  'd13.l.ready': { who: 'lyosha', ru: 'Десять минут. Справишься. Я это знаю.', en: "Ten minutes. You'll manage. I know it.", emo: 'smile' },
  'd13.n.night': { who: 'nadia', ru: 'Завтра последний день. Последняя ночь перед рассветом. Спи, Рыбка. Хоть немного.', en: 'Tomorrow is the last day. The last night before the dawn. Sleep, Rybka. Even a little.', emo: 'worry' },
  'd13.g.night': { who: 'grisha', ru: 'Спокойной ночи, советник! Завтра летаем.', en: 'Good night, councillor! Tomorrow, we fly.', emo: 'smile' },
  // ---------------------------------------------------------------- side: get out the vote
  'd13.r.gotv': { who: 'ruth', en: 'Election day rule. The old folks vote, but only if somebody drives them. Mrs. Ivanoff, Old Kaplan, the Petrov sisters. Their children are all in Anchorage.' },
  'd13.f.ivanoff': { who: 'f5', en: 'Oh! A ride? Let me get my good hat. I always wear my good hat to vote.' },
  'd13.m.kaplan': { who: 'm6', en: "About time somebody asked. I've voted in every election since Eisenhower. Help me with these boots." },
  'd13.f.petrov': { who: 'f3', en: "We'll come, dear. Both of us. We always vote the same way, and we never tell each other." },
  'd13.r.gotvDone': { who: 'ruth', en: 'Four more votes, and four people who will tell everyone at church who drove them. That is how elections are won up here.', emo: 'smile' },
  // ---------------------------------------------------------------- side: watch the boxes
  'd13.ev.boxes': { who: 'evan', en: 'Hi! Northstar volunteers are here to help carry the ballot boxes! We have a van! It\'s heated!', emo: 'smile' },
  'd13.r.sit': { who: 'ruth', en: "Evan, honey, I've been sitting next to ballot boxes since nineteen seventy-six. Go away.", emo: 'smile' },
  'd13.m.boxes': { who: 'marta', en: 'Thanks, Evan. The boxes stay where I can see them. Run along.', emo: 'serious' },
  'd13.ev.boxes2': { who: 'evan', en: 'No problem at all! Northstar respects the democratic process! Have a great day!', emo: 'smile' },
  // ---------------------------------------------------------------- around town
  'd13.d.chat': { who: 'dolly', en: "Voted at eight sharp. I won't tell you who for. It was you.", emo: 'laugh' },
  'd13.d.after': { who: 'dolly', en: "Councillor! Lord. I'm naming a pie after you. Something with blueberries. Something stubborn.", emo: 'laugh' },
  'd13.h.chat': { who: 'hank', en: "Voted. Don't ask. You. Obviously. Don't let it go to your head." },
  'd13.k.chat': { who: 'koshkin', en: 'I voted! First time since nineteen eighty-four. The pencil is on a string. Very insulting. I am eighty-two, not a thief.', emo: 'laugh' },
  'd13.k.after': { who: 'koshkin', en: 'A Koshkin employee on the council! My grandfather would have bought a round for the whole town. I will buy you a pickle.', emo: 'laugh' },
  'd13.g.chat': { who: 'gabriel', en: "I don't vote for anyone. I pray for everyone. I also vote." , emo: 'smile' },
  'd13.ni.chat': { who: 'nina', en: "Exit polls! By which I mean I asked people at the door. It's close! Also my mom says hi. She doesn't. But she should.", emo: 'laugh' },
  'd13.lo.chat': { who: 'lou', en: "Bar's closed till the count. Civic duty. Also, everybody's at the hall." },
  'd13.t.chat': { who: 'tommy', en: 'I voted twice! Kidding. Grandma watched me the whole time like a hawk with glasses.', emo: 'laugh' },
  'd13.e.chat': { who: 'ellen', en: "Doctor's orders: whatever happens tonight, eat a proper dinner first." },
  'd13.p.chat': { who: 'pearl', en: "Can't talk, hon. I'm the government today." },
  'd13.wa.chat': { who: 'wade', en: "Flew the ballots in Thursday. I'll fly the results to Juneau on Monday. Middleman of democracy, that's me." },
  'd13.ev.chat': { who: 'evan', en: 'Happy election day! Northstar is providing complimentary voting pencils. On strings!', emo: 'smile' },
  'd13.ly.chat': { who: 'lyle', en: 'May the best candidate win. That was supposed to sound confident. Let me try again later.', emo: 'worry' },
  'd13.ly.chatFree': { who: 'lyle', en: 'Strange day. I voted for my opponent. Pearl dropped her stamp.', emo: 'smile' },
  'd13.gi.chat': { who: 'gideon', en: 'Today is a formality. Tomorrow is what matters.' },
  'd13.w.chat': { who: 'walt', en: "I'll read the result tonight, whatever it is. June made me promise I'd always read them out loud." },
  'd13.m.chat': { who: 'marta', en: 'The ballot boxes are under my eye all day. Nobody touches them. Not Evan, not anybody.' },
  'd13.ry.chat': { who: 'ray', en: "Never thought I'd be nervous about somebody else's election. Go shake hands. Even the cold ones." },
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
/** Who still holds a card today, in the order we suggest asking. */
const CARD_ASK = ['ray', 'ruth', 'dolly', 'hank'];

export const MISSIONS = {
  'd13.vote': {
    title: 'Election Day', main: true, day: 13,
    async run(m, from) {
      reloop(m);
      const G = m.G;
      if (m.cp(1, from)) {
        await m.wait(1.0);
        await m.ear('d13.n.morning');
        await m.ear('d13.dm.vote');
        await m.ear('d13.l.cards');
        await m.ear(shareCount(G.state) >= 3 ? 'd13.l.enough' : 'd13.n.short');
        if (m.flag('watchBoxes')) await m.ear('d13.n.boxes');
        m.start('d13.shares');
        m.start('d13.gotv');
        if (m.flag('watchBoxes')) m.start('d13.boxes');
      }
      if (m.cp(2, from)) {
        m.obj('Vote at the Parish Hall', 'hall', 'Polls open 8:00–20:00');
        await m.reach('hall', 12);
        await m.spot('ballot', 'hall.tables', 'Cast your ballot', 3);
        const S = pt(G, 'hall.tables', STAGE);
        let lyle = false;
        await m.scene(async (d) => {
          await d.bring('pearl', { x: S.x + 1.2, z: S.z - 0.6 }, { face: 'player' });
          await d.say('pearl', 'd13.p.ballot', { cam: d.closeUp('pearl') });
          lyle = (await d.choose(['(Vote for yourself.)', "(Vote for Lyle Pruitt. Just to see Pearl's face.)"], { prompt: 'YOUR BALLOT' })) === 1;
          await d.say('pearl', lyle ? 'd13.p.lyle' : 'd13.p.self', { cam: d.closeUp('pearl', { side: -1 }) });
        });
        m.flag('voted', true);
        m.flag('votedLyle', lyle);
      }
      if (m.cp(3, from)) {
        m.done();
        m.start('d13.count');
      }
    },
  },

  'd13.shares': {
    title: 'Continuity Cards', main: true, day: 13,
    async run(m, from) {
      reloop(m);
      const G = m.G;
      if (m.cp(1, from)) {
        const text = () => `Continuity cards: ${shareCount(G.state)} / 3`;
        let last = '';
        await m.until(() => {
          const n = shareCount(G.state);
          if (n >= 3) return true;
          const t = text();
          if (t !== last || !G.hud?.objective) {
            last = t;
            const who = CARD_ASK.find((k) => !(G.state.flags['share.' + k] === true || (G.state.shares || {})[k]));
            m.obj('Collect the last continuity cards', who || 'hall', t + ' · ask the council members');
          }
          return false;
        });
        await m.ear('d13.v.three');
      }
      if (m.cp(2, from)) {
        m.obj('Assemble the vault key from the cards', 'cabin.table', 'Spread the cards on your cabin table');
        await m.spot('cards', 'cabin.table', 'Lay out the continuity cards', 2.4);
        await m.ear('d13.l.card');
        await hack(m, 'shares', 'cabin.table', 'd13.l.retry', 'Assemble the key again');
        m.flag('sharesCombined', true);
        G.state.inv.vault_card = 1;
        G.hud.toast('VAULT KEY', 'Three shares, one key, one blank card', '#ffd166');
        await m.ear('d13.v.numbers');
        m.done();
      }
    },
  },

  'd13.count': {
    title: 'The Count', main: true, day: 13,
    async run(m, from) {
      reloop(m);
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        m.obj('The count at the Parish Hall', 'hall', 'Polls close at 20:00');
        await hold(m, () => { const h = s.hour; return h >= 19.9 || h < 3; }, 'The count at the Parish Hall', 'hall', 'Polls close at 20:00');
        await m.reach('hall', 12);
      }
      if (m.cp(2, from)) {
        m.clear();
        drop(G, 'd9.posters', ['poster.store', 'poster.hall', 'poster.diner']); drop(G, 'd9.fax', ['phone']); drop(G, 'd9.darts', ['darts']);
        drop(G, 'd11.lyle', ['listen']); drop(G, 'd13.gotv', ['ride.ivanoff', 'ride.kaplan', 'ride.petrov']); drop(G, 'd13.boxes', ['boxes']);
        const F = s.flags;
        const friends = FRIENDS.filter((id) => lvl(G, id) >= 2).length;
        let net = (s.standing || 0) + Math.floor((s.spirit || 0) / 2) + friends * 2
          + (F.debateWon ? 10 : 0) + (F.ledgerUsed ? 6 : 0) + (F.lyleConfessed ? 30 : 0)
          + (F.postersUp ? 3 : 0) + (F.radioDone ? 3 : 0) + (F.hallPA ? 2 : 0) + (F['d13.gotvDone'] ? 6 : 0) + (F.votedLyle ? -1 : 1);
        const safe = !!(F['d13.boxesSafe'] || F.martaTrust);
        if (!safe) net -= 15;
        const won = net >= 50;
        const you = won ? 188 + Math.min(98, net - 50) : 186 - Math.min(90, 50 - net);
        const given = !!F.mayorKeyGiven;
        const S = pt(G, 'hall.stage', STAGE);
        await G.fadeTeleport({ x: S.x + 1.5, z: S.z + 3.5, yaw: Math.PI }, 1.2);
        await m.scene(async (d) => {
          await d.bring('walt', { x: S.x, z: S.z - 0.4 }, { face: 'player' });
          await d.bring('pearl', { x: S.x + 1.3, z: S.z + 0.4 }, { face: 'player' });
          await d.bring('gideon', { x: S.x - 2.2, z: S.z + 1.2 }, { face: 'walt' });
          await d.bring('ruth', { x: S.x + 2.4, z: S.z + 1.2 }, { face: 'walt' });
          await d.bring('lyle', { x: S.x - 1.2, z: S.z + 0.6 }, { face: 'walt' });
          await d.bring('dolly', { x: S.x + 0.4, z: S.z + 4.4 }, { face: 'walt' });
          await d.bring('ray', { x: S.x - 0.9, z: S.z + 4.6 }, { face: 'walt' });
          if (F.martaTrust) await d.bring('marta', { x: S.x + 3.6, z: S.z + 3 }, { face: 'gideon' });
          await d.say('pearl', 'd13.p.count', { cam: d.closeUp('pearl') });
          await d.say('gideon', 'd13.gi.recount', { cam: d.closeUp('gideon') });
          if (F.martaTrust) await d.say('marta', 'd13.m.denied', { cam: d.closeUp('marta') });
          else await d.say('ruth', 'd13.r.denied', { cam: d.closeUp('ruth') });
          await d.say('walt', 'd13.w.read', { cam: d.closeUp('walt') });
          if (won) {
            await d.say('walt', 'd13.w.win', { cam: d.closeUp('walt', { side: -1, dist: 0.7 }) });
            await d.say('dolly', 'd13.d.cheer', { cam: d.closeUp('dolly') });
            await d.say('ray', 'd13.ry.seat', { cam: d.closeUp('ray') });
            await d.say('lyle', F.lyleConfessed ? 'd13.ly.loseFree' : 'd13.ly.lose', { cam: d.closeUp('lyle') });
            await d.say('gideon', 'd13.gi.invite', { cam: d.closeUp('gideon', { dist: 0.65 }) });
          } else {
            await d.say('walt', 'd13.w.lose', { cam: d.closeUp('walt', { side: -1 }) });
            await d.say('gideon', 'd13.gi.smirk', { cam: d.closeUp('gideon') });
            await d.say('ruth', 'd13.r.close', { cam: d.closeUp('ruth') });
            if (given) {
              await d.say('walt', 'd13.w.appoint', { cam: d.closeUp('walt', { dist: 0.7 }) });
              await d.say('gideon', 'd13.gi.objects', { cam: d.closeUp('gideon') });
              await d.say('walt', 'd13.w.charter', { cam: d.closeUp('walt', { side: -1 }) });
              await d.say('gideon', 'd13.gi.invite2', { cam: d.closeUp('gideon', { dist: 0.65 }) });
            } else await d.say('gideon', 'd13.gi.halloran', { cam: d.closeUp('gideon', { dist: 0.6 }) });
          }
        });
        m.flag('votesYou', you);
        m.flag('votesLyle', 374 - you);
        m.flag('wonSeat', won);
        if (!won && given) m.flag('appointed', true);
        m.flag('galaInviteBy', won ? 'council' : given ? 'board' : 'halloran');
        m.flag('galaInvite', true);
        s.standing += won ? 10 : 4;
        G.state.inv.gala_invitation = 1;
        G.hud.toast('THE COUNT', `You ${you} · Lyle Pruitt ${374 - you}`, won ? '#9fe8b0' : '#ffb21e');
        G.hud.toast('ITEM', 'Gala invitation — the Dome, Sunday, 20:00', '#ffd166');
      }
      if (m.cp(3, from)) {
        const by = m.flag('galaInviteBy');
        if (by === 'council') await m.ears(['d13.g.win', 'd13.v.win', 'd13.n.win']);
        else if (by === 'board') await m.ear('d13.n.appointed');
        else await m.ears(['d13.dm.halloran', 'd13.n.halloran']);
      }
      if (m.cp(4, from)) {
        if (!G.missions.isDone('d13.shares')) {
          await m.ear('d13.l.wait');
          await hold(m, () => G.missions.isDone('d13.shares'), 'Assemble the vault key first', 'cabin.table', 'Continuity cards: three are needed');
        }
        await m.ear('d13.l.gala');
        m.done();
        m.start('d13.night');
      }
    },
  },

  'd13.night': {
    title: 'Night School: Reading Errors', main: true, day: 13,
    async run(m, from) {
      reloop(m);
      if (m.cp(1, from)) {
        await m.ear('d13.n.lesson');
        m.obj("Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 13: Reading Errors');
        await hold(m, () => m.G.state.lessons.l13, "Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 13: Reading Errors');
      }
      if (m.cp(2, from)) {
        await m.ear('d13.l.after');
        await m.ear('d13.l.rehearsal');
        m.start('d13.rehearsal');
        await m.ear('d13.n.night');
        await m.ear('d13.g.night');
        m.done();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd13.rehearsal': {
    title: 'Dress Rehearsal', day: 13,
    async run(m, from) {
      if (m.cp(1, from)) {
        m.obj("Lyosha's practice exam (optional)", 'cabin.laptop', 'Lesson 14 — tonight or tomorrow morning');
        await hold(m, () => m.G.state.lessons.l14, "Lyosha's practice exam (optional)", 'cabin.laptop', 'Lesson 14 — tonight or tomorrow morning');
        m.flag('rehearsed', true);
        await m.ear('d13.l.ready');
        m.done();
      }
    },
  },

  'd13.gotv': {
    title: 'Get Out the Vote', day: 13,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Ruth wants a word', 'ruth', 'Election day — the Parish Hall');
        await hold(m, () => m.flag('d13.gotv.asked') || G.missions.isDone('d13.count'), 'Ruth wants a word', 'ruth', 'Election day — the Parish Hall');
      }
      const STOPS = [['ivanoff', 'house0.door', "Mrs. Ivanoff's house", 'f5', 'd13.f.ivanoff'], ['kaplan', 'house2.door', "Old Kaplan's house", 'm6', 'd13.m.kaplan'], ['petrov', 'house7.door', "The Petrov sisters' house", 'f3', 'd13.f.petrov']];
      for (let i = 0; i < STOPS.length; i++) {
        const [k, where, name, voice, line] = STOPS[i];
        if (m.cp(2 + i, from) && !G.missions.isDone('d13.count')) {
          m.obj(`Offer a ride to the polls: ${name}`, where, `${i} / 3 voters`);
          await Promise.race([m.spot('ride.' + k, where, 'Offer a ride to the polls', 2.8), m.until(() => G.missions.isDone('d13.count'))]);
          G.interact?.remove?.(`${m.id}:ride.${k}`);
          if (!G.missions.isDone('d13.count')) await m.scene(async (d) => { await d.say(voice, line); });
        }
      }
      if (m.cp(5, from)) {
        if (!G.missions.isDone('d13.count')) {
          m.obj('Bring them to the Parish Hall', 'hall', 'Before 20:00');
          await Promise.race([m.reach('hall', 12), m.until(() => G.missions.isDone('d13.count'))]);
        }
        if (!G.missions.isDone('d13.count')) {
          await m.scene(async (d) => {
            await d.bring('ruth', pt(G, 'hall.door', { x: -40, z: -26 }, 1.2, 0.8), { face: 'player' });
            await d.say('ruth', 'd13.r.gotvDone', { cam: d.closeUp('ruth') });
          });
          m.flag('d13.gotvDone', true);
          G.state.standing += 3;
          G.hud.toast('STANDING', '+3  Four more votes, and four storytellers', '#b98cff');
        }
        m.done();
      }
    },
  },

  'd13.boxes': {
    title: 'Watch the Boxes', day: 13,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Watch the ballot boxes', 'hall', 'The Parish Hall, from 17:00');
        await hold(m, () => { const h = G.state.hour; return h >= 17 || h < 3 || G.missions.isDone('d13.count'); }, 'Watch the ballot boxes', 'hall', 'The Parish Hall, from 17:00');
        if (!G.missions.isDone('d13.count')) await Promise.race([m.spot('boxes', 'hall.tables', 'Keep an eye on the boxes', 3), m.until(() => G.missions.isDone('d13.count'))]);
        G.interact?.remove?.(`${m.id}:boxes`);
      }
      if (m.cp(2, from)) {
        if (!G.missions.isDone('d13.count')) {
          const S = pt(G, 'hall.tables', STAGE);
          const chief = !!(m.flag('martaTrust') || m.flag('marta.number'));
          await m.scene(async (d) => {
            await d.bring('evan', { x: S.x - 1.4, z: S.z + 1 }, { face: 'player' });
            await d.say('evan', 'd13.ev.boxes', { cam: d.closeUp('evan') });
            const opts = ['(Ask Ruth to sit with the boxes.)'];
            if (chief) opts.unshift('(Wave Chief Kowalczyk over.)');
            const k = await d.choose(opts, { prompt: 'THE BALLOT BOXES' });
            if (chief && k === 0) {
              await d.bring('marta', { x: S.x + 1.6, z: S.z + 1.2 }, { face: 'evan' });
              await d.say('marta', 'd13.m.boxes', { cam: d.closeUp('marta') });
            } else {
              await d.bring('ruth', { x: S.x + 1.6, z: S.z + 0.8 }, { face: 'evan' });
              await d.say('ruth', 'd13.r.sit', { cam: d.closeUp('ruth') });
            }
            await d.say('evan', 'd13.ev.boxes2', { cam: d.closeUp('evan', { side: -1 }) });
          });
          m.flag('d13.boxesSafe', true);
        }
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const NAMES = { dolly: 'Dolly', hank: 'Hank', ruth: 'Ruth', ray: 'Ray', lyle: 'Lyle' };
const holds = (c, id) => c.flag('share.' + id) === true || !!(c.state.shares || {})[id];
const needCard = (c, id) => c.G.missions.isActive('d13.shares') && shareCount(c.state) < 3 && !holds(c, id);
async function giveCard(c, id, line) {
  await c.say(id, line);
  c.flag('share.' + id, true);
  (c.state.shares ||= {})[id] = true;
  c.give('continuity_card');
  c.G.hud?.toast?.('CONTINUITY CARD', `${NAMES[id]}'s card · ${shareCount(c.state)} of 5`, '#ffd166');
  c.emit('share:' + id);
}
const once = (npc, key, line, rel = 2, when = () => true) => async (c, prev) => {
  if (c.day !== 13 || c.flag(key) || !when(c)) return prev(c);
  c.flag(key, true);
  await c.say(npc, typeof line === 'function' ? line(c) : line);
  c.rel(rel);
};
const ELSE = { label: 'Something else.', key: 'prev' };
/** A council member who will hand over the card today if asked, else their election-day chat. */
const council = (id, label, cardLine, chatKey, chatLine) => async (c, prev) => {
  if (c.day !== 13) return prev(c);
  if (needCard(c, id)) {
    const k = await c.choose([{ label, key: 'card' }, ELSE]);
    if (k === 'card') { await giveCard(c, id, cardLine); c.rel(4); return; }
    return prev(c);
  }
  return once(id, chatKey, chatLine)(c, prev);
};
const counted = (c) => c.G.missions.isDone('d13.count') || c.flag('galaInvite');

export const DIALOG = {
  ray: council('ray', 'Ray, that card in your sock drawer. I need it.', 'd13.ry.card', 'd13.ry.chatted', 'd13.ry.chat'),
  dolly: council('dolly', 'Dolly, do you still have that laminated card from Gideon?', 'd13.d.card', 'd13.d.chatted', (c) => (counted(c) && c.flag('wonSeat') ? 'd13.d.after' : 'd13.d.chat')),
  hank: council('hank', "Hank, I need your continuity card. Don't ask why.", 'd13.h.card', 'd13.h.chatted', 'd13.h.chat'),
  ruth: async (c, prev) => {
    if (c.day !== 13) return prev(c);
    const opts = [];
    if (c.G.missions.isActive('d13.gotv') && !c.flag('d13.gotv.asked')) opts.push({ label: 'You wanted a word, Ruth?', key: 'gotv' });
    if (needCard(c, 'ruth')) opts.push({ label: "Ruth, those laminated cards are keys to Halloran's vault. I need yours.", key: 'card' });
    if (!opts.length) return prev(c);
    opts.push(ELSE);
    const k = await c.choose(opts);
    if (k === 'gotv') { await c.say('ruth', 'd13.r.gotv'); c.flag('d13.gotv.asked', true); c.emit('talk:ruth'); return; }
    if (k === 'card') { await giveCard(c, 'ruth', 'd13.r.card'); c.rel(5); return; }
    return prev(c);
  },
  lyle: async (c, prev) => {
    if (c.day !== 13) return prev(c);
    if (needCard(c, 'lyle')) {
      const k = await c.choose([{ label: 'Lyle. Your continuity card.', key: 'card' }, ELSE]);
      if (k === 'card') {
        if (c.flag('lyleAlly') || c.flag('lyleConfessed') || c.flag('lyle.freed')) { await giveCard(c, 'lyle', 'd13.ly.card'); c.rel(3); }
        else await c.say('lyle', 'd13.ly.nocard');
        return;
      }
      return prev(c);
    }
    return once('lyle', 'd13.ly.chatted', (cc) => (cc.flag('lyleConfessed') ? 'd13.ly.chatFree' : 'd13.ly.chat'), 1)(c, prev);
  },
  koshkin: async (c, prev) => {
    if (c.day !== 13 || (c.flag('koshkinHospital') && !c.flag('koshkinBack'))) return prev(c);
    if (counted(c) && c.flag('wonSeat')) return once('koshkin', 'd13.k.after2', 'd13.k.after', 3)(c, prev);
    return once('koshkin', 'd13.k.chatted', 'd13.k.chat', 3)(c, prev);
  },
  gabriel: once('gabriel', 'd13.g.chatted', 'd13.g.chat'),
  nina: once('nina', 'd13.ni.chatted', 'd13.ni.chat'),
  lou: once('lou', 'd13.lo.chatted', 'd13.lo.chat'),
  tommy: once('tommy', 'd13.t.chatted', 'd13.t.chat'),
  ellen: once('ellen', 'd13.e.chatted', 'd13.e.chat'),
  pearl: once('pearl', 'd13.p.chatted', 'd13.p.chat', 1),
  wade: once('wade', 'd13.wa.chatted', 'd13.wa.chat'),
  evan: once('evan', 'd13.ev.chatted', 'd13.ev.chat', 0),
  gideon: once('gideon', 'd13.gi.chatted', 'd13.gi.chat', 0),
  walt: once('walt', 'd13.w.chatted', 'd13.w.chat', 2, (c) => !counted(c)),
  marta: once('marta', 'd13.m.chatted', 'd13.m.chat', 2, (c) => c.flag('martaTrust')),
};
export const DIALOG_OVERRIDE = true;
