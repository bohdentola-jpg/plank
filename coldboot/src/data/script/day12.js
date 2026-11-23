// DAY 12 — Debate Night (Friday). Three days to dawn. Photograph Northstar's
// payment ledger in Lyle's office (or, if you freed Lyle from Gideon's
// blackmail, he hands you his own copy). Seven o'clock, the Parish Hall, KZRY
// live: three questions from Father Gabriel, a closing statement, and the
// choice to put the 'ledger' field hack on the projector — which names Lyle,
// Gideon, and Mayor Walt. Afterwards Gideon Shaw explains what an asset is.
// Side: the hall's PA with Nina; Koshkin flies home from Nome.
export const DAY = { n: 12, start: ['d12.ledger'], mustFinish: ['d12.night'] };

const passed = (r) => r === true || !!(r && r.pass);
const pt = (G, name, fb, dx = 0, dz = 0) => { const q = G.town?.points?.[name]; return q ? { x: q.x + dx, z: q.z + dz } : { x: fb.x + dx, z: fb.z + dz }; };
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });
const STAGE = { x: -40, z: -42 };      // hall.stage fallback
/** Cancel a side task and take its leftover interaction spots out of the world. */
function drop(G, id, spots = []) { for (const sp of spots) G.interact?.remove?.(`${id}:${sp}`); G.missions.cancel?.(id); }
const EVENING = (h) => h >= 18.5 || h < 3;

export const LINES = {
  // ---------------------------------------------------------------- morning
  'd12.n.morning': { who: 'nadia', ru: 'Три дня. Сегодня вечером дебаты. Весь город будет в зале — а кто не придёт, будет слушать радио Нины.', en: "Three days. Tonight, the debate. The whole town will be in the hall — and whoever stays home will be listening to Nina's radio.", emo: 'serious' },
  'd12.l.ledger': { who: 'lyosha', ru: 'Лайл будет клясться, что «Нордстар» не платил ему ни цента. А у Лайла в конторе лежит гроссбух. Бумажный! Они не доверяют компьютерам. Смешно, правда?', en: "Lyle will swear Northstar never paid him a cent. And there's a ledger in Lyle's office. A paper one! They don't trust computers. Funny, isn't it?", emo: 'smile' },
  'd12.n.office': { who: 'nadia', ru: 'Контора «Прюитт Риэлти», Третья авеню. Днём Лайл сидит в мэрии. Сфотографируй страницы — Иван сделает из них таблицу.', en: "Pruitt Realty, Third Avenue. In the daytime Lyle sits at City Hall. Photograph the pages — Ivan will turn them into a table." },
  'd12.n.ask': { who: 'nadia', ru: 'Лайл тебе должен. Сам сказал. Может, не надо ничего взламывать — просто попроси.', en: "Lyle owes you. He said so himself. Maybe we don't need to break in at all. Just ask." },
  'd12.l.yourlock': { who: 'lyosha', ru: 'Ха. Это же твоя работа. Кто замок ставит, тот его и открывает.', en: "Ha. That's your own handiwork. Whoever puts a lock in knows how to get it open.", emo: 'laugh' },
  'd12.i.photos': { who: 'ivan', ru: 'Фотографии чёткие. Через час будет таблица.', en: "The photos are sharp. In an hour you'll have a table." },
  'd12.l.projector': { who: 'lyosha', ru: 'Я подключусь к проектору в зале. Нина ведёт прямой эфир. Если решишь — одно слово, и таблица будет на экране.', en: "I'll hook into the hall's projector. Nina's broadcasting live. If you decide to — one word, and the table goes up on the screen." },
  'd12.dm.choice': { who: 'dmitri', ru: 'Подумай. В этой таблице не только Лайл. Там и мэр.', en: "Think about it. Lyle isn't the only name in that table. The mayor is there too.", emo: 'serious' },
  // ---------------------------------------------------------------- Lyle's copy (if he was freed)
  'd12.ly.copy': { who: 'lyle', en: "The ledger? Gideon keeps the real one in my office, so it's my name on the shelf. But I'm an insurance man. I keep copies of everything.", emo: 'worry' },
  'd12.ly.copy2': { who: 'lyle', en: "Take it. Do whatever you're going to do tonight. I'll be up there pretending I don't know. That part I'm good at." },
  // ---------------------------------------------------------------- the debate
  'd12.g.open': { who: 'gabriel', en: "Friends, neighbours, quiet please. This is the Port Zarya candidates' debate. I am told I am neutral. I have decided to believe it.", emo: 'smile' },
  'd12.g.rules': { who: 'gabriel', en: 'Two candidates for Ray Moody\'s seat. Lyle Pruitt, and our carpenter. Three questions, and no shouting. Nina, are we on the air?' },
  'd12.ni.live': { who: 'nina', en: "We're live! Hi, Mom. Sorry. We're live.", emo: 'laugh' },
  'd12.g.q1': { who: 'gabriel', en: 'First question. Why do you want this seat?' },
  'd12.ly.a1': { who: 'lyle', en: "Because Port Zarya deserves a future. Broadband. Smart lighting. Jobs. Northstar has invested more in this town in one year than the state has in twenty.", emo: 'smile' },
  'd12.ry.cheer': { who: 'ray', en: "That's right!", emo: 'smile' },
  'd12.r.whose': { who: 'ruth', en: 'Mm-hm. Whose future.', emo: 'smile' },
  'd12.d.laugh': { who: 'dolly', en: 'Ha! Somebody write that down!', emo: 'laugh' },
  'd12.g.q2': { who: 'gabriel', en: 'Second question. The smart streetlights. Northstar says they keep us safe. Some of you say they watch us. Candidates?' },
  'd12.ly.a2': { who: 'lyle', en: "Safety. Crime is down forty percent since June. Nobody is watching anybody. The cameras only see what's in front of them." },
  'd12.ly.smoke': { who: 'lyle', en: "That's, um. I'm sure there's an explanation. Home safety. The Smart Safety ordinance. It's very, it's in the ordinance.", emo: 'worry' },
  'd12.m.confirm': { who: 'marta', en: "It's true. I've seen the device. And nobody in my department signed a warrant for it.", emo: 'serious' },
  'd12.lo.broom': { who: 'lou', en: 'None! I stop them. With a broom.', emo: 'laugh' },
  'd12.g.q3': { who: 'gabriel', en: 'Third question. The cannery. Forty-one jobs. Lyle, you voted for the lease.' },
  'd12.ly.a3': { who: 'lyle', en: 'I voted for progress. The data centre will bring high-skill jobs. Not everybody wants to gut fish forever.' },
  'd12.ry.dad': { who: 'ray', en: 'My father gutted fish for forty years, Lyle! The cannery paid for your school shoes!', emo: 'angry' },
  'd12.ly.stumble': { who: 'lyle', en: 'The specifics are proprietary. Northstar will release the details in due course.', emo: 'worry' },
  'd12.h.fair': { who: 'hank', en: "Huh. That's a fair question. Somebody answer it.", emo: 'frown' },
  'd12.t.whoop': { who: 'tommy', en: 'Woo! Go, carpenter!', emo: 'laugh' },
  'd12.g.close': { who: 'gabriel', en: 'Closing statements. Lyle, you first.' },
  'd12.ly.close': { who: 'lyle', en: "Northstar never paid me a cent. Not one. I'm my own man, and I'm Port Zarya's man. That's my closing statement.", emo: 'smile' },
  'd12.ly.free1': { who: 'lyle', en: 'I had a speech. Gideon wrote it. It\'s a very good speech.', emo: 'worry' },
  'd12.ly.free2': { who: 'lyle', en: "Here's the truth instead. Northstar has paid me for three years. Envelopes, for votes. I'm done. Vote for the carpenter.", emo: 'serious' },
  'd12.l.now': { who: 'lyosha', ru: 'Сейчас. Одно слово — и таблица на проекторе.', en: 'Now. One word, and the table goes up on the projector.', emo: 'serious' },
  'd12.g.screen': { who: 'gabriel', en: 'Lord have mercy. Nineteen thousand, five hundred dollars. Lyle Pruitt.', emo: 'surprise' },
  'd12.d.gasp': { who: 'dolly', en: 'Gideon Shaw, four thousand. And, oh. Oh, Walt. Walt, no.', emo: 'worry' },
  'd12.w.exposed': { who: 'walt', en: "It's true. Twenty-five thousand. For June's treatments. I'm not proud of it. I'm not proud of much this year.", emo: 'worry' },
  'd12.ly.caught': { who: 'lyle', en: "That's out of context! Consulting! Land surveys! Legitimate, documented—", emo: 'angry' },
  'd12.ry.sit': { who: 'ray', en: 'Sit down, Lyle.', emo: 'angry' },
  'd12.ly.confirm': { who: 'lyle', en: "And there it is, in black and white. Every word I just said. I'm sorry, Walt.", emo: 'worry' },
  'd12.g.thanks': { who: 'gabriel', en: "Thank you both. The polls open tomorrow at eight. Go home, all of you. Pray, if you're the praying kind. Vote, either way.", emo: 'smile' },
  // ---------------------------------------------------------------- Gideon, afterwards
  'd12.gi.threat1': { who: 'gideon', en: 'A word. No, here is fine. The cameras on this corner are off tonight. But you would know all about that.' },
  'd12.gi.threat2': { who: 'gideon', en: 'You think this is a town. It is an asset. Assets are managed. And when they become liabilities, they are written off.', emo: 'serious' },
  'd12.gi.threat3': { who: 'gideon', en: 'Mr. Halloran admires initiative. He asked me to tell you so. He also asked me to tell you that winter is long, and the sea is very cold.' },
  'd12.gi.threat4': { who: 'gideon', en: "It's a weather report. Good night.", emo: 'smile' },
  'd12.gi.stare': { who: 'gideon', en: "Good. Silence. You're learning how things are done here." },
  'd12.gi.smile': { who: 'gideon', en: 'I will. He will enjoy that. He enjoys very few things.', emo: 'smile' },
  'd12.g.swim': { who: 'grisha', ru: 'Если он тебя хоть пальцем тронет, я переплыву пролив. Зимой. Мне всё равно.', en: "If he lays one finger on you, I'll swim across the strait. In winter. I don't care.", emo: 'angry' },
  'd12.n.okay': { who: 'nadia', ru: 'Гриша. Тише. Рыбка, ты молодец. Сегодня город был на твоей стороне. Слышишь? Весь город.', en: 'Grisha. Hush. Rybka, well done. Tonight the town was on your side. Do you hear me? The whole town.', emo: 'smile' },
  'd12.dm.ledger': { who: 'dmitri', ru: 'Правда на экране, перед всем городом. Сильный ход. И опасный. Теперь они знают, с кем имеют дело.', en: 'The truth on a screen, in front of the whole town. A strong move. And a dangerous one. Now they know who they are dealing with.', emo: 'serious' },
  'd12.dm.words': { who: 'dmitri', ru: 'Без бумажек, одними словами. Иногда это сильнее.', en: 'No papers, only words. Sometimes that is stronger.', emo: 'smile' },
  'd12.v.lesson': { who: 'valya', ru: 'А сегодня урок веду я. Иди домой, рыбка. Чай я уже налила.', en: "And tonight I'm teaching. Go home, little fish. I've already poured the tea.", emo: 'smile' },
  'd12.v.after': { who: 'valya', ru: 'Шифр — это просто вежливый способ сказать «не твоё дело». Спокойной ночи, рыбка.', en: "A cipher is just a polite way of saying 'none of your business'. Good night, little fish.", emo: 'smile' },
  'd12.n.night': { who: 'nadia', ru: 'Завтра выборы. Послезавтра — Гала. А потом рассвет. Спи, Рыбка. Мы рядом.', en: 'Tomorrow, the election. The day after, the Gala. And then the dawn. Sleep, Rybka. We are right here.', emo: 'smile' },
  // ---------------------------------------------------------------- side: sound check
  'd12.ni.pa': { who: 'nina', en: "The hall's PA is from nineteen seventy-nine and it hums like a fridge. If I can't plug into it, nobody at home hears the debate. Help?", emo: 'worry' },
  'd12.ni.pafixed': { who: 'nina', en: "Testing, testing. Oh, that's gorgeous. You're a wizard. A carpenter wizard.", emo: 'laugh' },
  // ---------------------------------------------------------------- side: homecoming
  'd12.k.home': { who: 'koshkin', en: 'Ha! Look who came to meet me. The doctor said rest. I said, I rested for eighty-two years. I\'m going home.', emo: 'laugh' },
  'd12.k.store': { who: 'koshkin', en: 'Wade says you opened my store every day. Every day! Not Sunday? Good. God would have complained.', emo: 'smile' },
  'd12.k.debate': { who: 'koshkin', en: "And tonight you fight Lyle Pruitt in front of the whole town. I'll be in the front row. With a walking stick. For hitting.", emo: 'laugh' },
  'd12.wa.home': { who: 'wade', en: 'One grumpy grandpa, delivered, slightly used. Welcome home, Sasha.', emo: 'smile' },
  'd12.n.home': { who: 'nadia', ru: 'Он дома. Хоть что-то в этом мире правильно.', en: "He's home. At least one thing in this world is right.", emo: 'smile' },
  // ---------------------------------------------------------------- around town, before the debate
  'd12.d.pre': { who: 'dolly', en: "Big night! I'm baking three pies. One for you, one for me, and one to throw at Lyle if he says synergy.", emo: 'laugh' },
  'd12.h.pre': { who: 'hank', en: "I'll be there. Back row. Arms crossed. That's my supportive face." },
  'd12.r.pre': { who: 'ruth', en: 'Remember. When he says the future, you ask him whose.', emo: 'smile' },
  'd12.ry.pre': { who: 'ray', en: "If you've got the pin, wear it on the left. Over the heart. My dad would've liked that." },
  'd12.ly.pre': { who: 'lyle', en: "Nervous? Me? I've debated the Rotary Club. Twice. They have a Rotary Club in Nome. It's very competitive.", emo: 'worry' },
  'd12.gi.pre': { who: 'gideon', en: 'Tonight will be educational. For everyone.' },
  'd12.w.pre': { who: 'walt', en: "I'll be there. I have to be. Mayor. Front row, smiling. I've got a lot of practice smiling." },
  'd12.m.pre': { who: 'marta', en: "I'll be on the door tonight. Anybody throws a chair, it's my chair to throw." },
  'd12.ev.pre': { who: 'evan', en: 'Refreshments are on Northstar tonight! Sparkling water with a hint of community!', emo: 'smile' },
  'd12.g.pre': { who: 'gabriel', en: "I'm moderating tonight. Pray for me. Actually, I'll do that part myself." },
  'd12.lo.pre': { who: 'lou', en: "Odds have moved, by the way. You're even money now. I put twenty on you. Don't make me look stupid." },
  'd12.t.pre': { who: 'tommy', en: "I made a sign. It says carpenter in glitter. Grandma says glitter is undignified. Grandma is wrong.", emo: 'laugh' },
  'd12.e.pre': { who: 'ellen', en: "I'll be in the third row with smelling salts. Last debate, old Mr. Kaplan fainted when the budget came up." },
  'd12.p.pre': { who: 'pearl', en: "Ballots came on the morning plane. Four hundred and twelve, numbered and sealed. Nobody touches them but me. Nobody." },
  // ---------------------------------------------------------------- around town, after
  'd12.d.after': { who: 'dolly', en: "You were magnificent up there! I didn't throw a single pie. I was too busy clapping.", emo: 'laugh' },
  'd12.r.after': { who: 'ruth', en: 'Whose future. You remembered. Joseph would have liked you.', emo: 'smile' },
  'd12.ry.after': { who: 'ray', en: "I haven't heard the hall that loud since the strike. Whatever happens tomorrow, you made them listen." },
  'd12.ly.afterFree': { who: 'lyle', en: "I feel lighter. Terrified. But lighter. Is that what honest feels like? It's awful. I love it.", emo: 'worry' },
  'd12.ly.afterHurt': { who: 'lyle', en: "You ruined me. In front of everybody. And the strange thing is, I slept better already. Don't tell anyone.", emo: 'frown' },
  'd12.ly.after': { who: 'lyle', en: "Good debate. Really. Tomorrow decides. And Northstar's carrying the coffee.", emo: 'smile' },
  'd12.w.hurt': { who: 'walt', en: "You could have warned me. No. You couldn't have. June would have done the same thing, and laughed doing it. Keep the key.", emo: 'worry' },
  'd12.w.afterCopied': { who: 'walt', en: "Everybody knows now. Strange. I thought it would feel like dying. It feels like putting down a suitcase.", emo: 'worry' },
  'd12.w.after': { who: 'walt', en: "Well, the hall's still standing. That's more than I expected. Get some sleep, friend." },
  'd12.k.after': { who: 'koshkin', en: 'Front row! I saw everything! I only hit Lyle with my stick in my mind. Twice.', emo: 'laugh' },
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
const freed = (m) => !!m.flag('lyle.freed') || m.flag('sf.lyle.outcome') === 'freed';

export const MISSIONS = {
  'd12.ledger': {
    title: 'The Ledger', main: true, day: 12,
    async run(m, from) {
      reloop(m);
      const G = m.G;
      if (m.cp(1, from)) {
        await m.wait(1.0);
        await m.ear('d12.n.morning');
        await m.ear('d12.l.ledger');
        m.start('d12.hall');
        if (m.flag('koshkinHospital') && !m.flag('koshkinBack')) m.start('d12.home');
      }
      if (m.cp(2, from)) {
        const ask = freed(m);
        await m.ear(ask ? 'd12.n.ask' : 'd12.n.office');
        const text = ask ? 'Ask Lyle for the ledger — or photograph it at his office' : "Photograph Northstar's ledger at Pruitt Realty";
        const sub = ask ? 'Lyle: City Hall by day, the diner after five' : 'Third Avenue, by City Hall — while Lyle is out';
        m.obj(text, ask ? 'lyle' : 'house22.door', sub);
        (async () => {
          await m.spot('door', 'house22.door', 'Pick the lock', 2.6);
          if (m.flag('ledgerPhotos')) return;
          if (m.flag('sf.lyle.lock')) await m.ear('d12.l.yourlock');
          G.attention.act(1.2, 8);
          const ok = await m.minigame('lock', { title: 'PRUITT REALTY' });
          if (!ok) G.attention.add(8);
          m.obj('Photograph the ledger', 'house22.door', 'The shelf behind the desk');
          await m.spot('ledger', 'house22.door', 'Photograph the ledger', 2.6);
          G.attention.act(0.8, 4);
          G.hud.toast('PHOTOGRAPHED', "Northstar's payment ledger, fourteen pages", '#7fe6ff');
          m.flag('ledgerPhotos', true);
        })();
        await hold(m, () => !!m.flag('ledgerPhotos'), text, ask ? 'lyle' : 'house22.door', sub);
        G.interact?.remove?.(`${m.id}:door`);
        G.interact?.remove?.(`${m.id}:ledger`);
      }
      if (m.cp(3, from)) {
        await m.ear('d12.i.photos');
        await m.ear('d12.l.projector');
        await m.ear('d12.dm.choice');
        m.done();
        m.start('d12.debate');
      }
    },
  },

  'd12.debate': {
    title: 'Debate Night', main: true, day: 12,
    async run(m, from) {
      reloop(m);
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('The debate at the Parish Hall', 'hall', 'Doors at 18:30 · KZRY live at 19:00');
        await hold(m, () => EVENING(G.state.hour), 'The debate at the Parish Hall', 'hall', 'Doors at 18:30 · KZRY live at 19:00');
        await m.reach('hall', 12);
      }
      if (m.cp(2, from)) {
        drop(G, 'd12.hall', ['pa']); drop(G, 'd11.ruth'); drop(G, 'd10.cannery');
        m.clear();
        const S = pt(G, 'hall.stage', STAGE);
        await G.fadeTeleport({ x: S.x + 1.6, z: S.z, yaw: 0 }, 1.4);
        let score = 0, useLedger = false;
        const confessed = freed(m);
        await m.scene(async (d) => {
          await d.bring('gabriel', { x: S.x, z: S.z - 0.9 }, { face: 'player' });
          await d.bring('lyle', { x: S.x - 1.6, z: S.z }, { face: 'gabriel' });
          await d.bring('nina', { x: S.x + 3.4, z: S.z + 2.4 }, { sit: true, face: 'gabriel' });
          await d.bring('ray', { x: S.x - 2.2, z: S.z + 4.2 }, { sit: true, face: 'lyle' });
          await d.bring('ruth', { x: S.x - 0.7, z: S.z + 4.2 }, { sit: true, face: 'player' });
          await d.bring('dolly', { x: S.x + 0.8, z: S.z + 4.2 }, { sit: true, face: 'player' });
          await d.bring('hank', { x: S.x + 2.3, z: S.z + 4.6 }, { sit: true, face: 'lyle' });
          await d.bring('tommy', { x: S.x - 3.4, z: S.z + 5.2 }, { face: 'player' });
          await d.say('gabriel', 'd12.g.open', { cam: d.closeUp('gabriel') });
          await d.say('gabriel', 'd12.g.rules');
          await d.say('nina', 'd12.ni.live', { cam: d.closeUp('nina') });
          // question one
          await d.say('gabriel', 'd12.g.q1', { cam: d.closeUp('gabriel', { side: -1 }) });
          await d.say('lyle', 'd12.ly.a1', { cam: d.closeUp('lyle') });
          const o1 = [
            { t: 'Because Ray Moody gave it to me, and he was the only one who voted no.', v: 2, r: ['ray', 'd12.ry.cheer'] },
            { t: 'Because somebody should ask whose future he means.', v: m.flag('ruthPrep') ? 4 : 2, r: ['ruth', 'd12.r.whose'] },
            { t: "I don't, really. But I'd rather sit in it than watch Lyle sit in it.", v: 1, r: ['dolly', 'd12.d.laugh'] },
          ];
          const a1 = o1[await d.choose(o1.map((o) => o.t), { prompt: 'WHY DO YOU WANT THIS SEAT?' })] || o1[0];
          score += a1.v;
          await d.say(a1.r[0], a1.r[1], { cam: d.closeUp(a1.r[0]) });
          // question two
          await d.say('gabriel', 'd12.g.q2', { cam: d.closeUp('gabriel') });
          await d.say('lyle', 'd12.ly.a2', { cam: d.closeUp('lyle', { side: -1 }) });
          const o2 = [];
          if (m.flag('cabinSwept')) o2.push({ t: 'Then why was there a Northstar camera in my smoke alarm?', v: 4, k: 'smoke' });
          o2.push({ t: "Ruth Aqpik keeps her curtains shut in her own house. That isn't safety.", v: 3, r: ['ruth', 'd12.r.whose'] });
          o2.push({ t: 'Ask Lou how many fights those cameras ever stopped at the Anchor.', v: 2, k: 'lou' });
          const a2 = o2[await d.choose(o2.map((o) => o.t), { prompt: 'THE STREETLIGHTS' })] || o2[0];
          score += a2.v;
          if (a2.k === 'smoke') {
            G.attention.add(6);
            await d.say('lyle', 'd12.ly.smoke', { cam: d.closeUp('lyle') });
            if (m.flag('martaTrust')) {
              await d.bring('marta', { x: S.x + 4.2, z: S.z + 7 }, { face: 'player' });
              await d.say('marta', 'd12.m.confirm', { cam: d.closeUp('marta') });
              score += 2;
            }
          } else if (a2.k === 'lou') {
            await d.bring('lou', { x: S.x + 1.6, z: S.z + 6 }, { face: 'player' });
            await d.say('lou', 'd12.lo.broom', { cam: d.closeUp('lou') });
          } else await d.say(a2.r[0], a2.r[1], { cam: d.closeUp(a2.r[0], { side: -1 }) });
          // question three
          await d.say('gabriel', 'd12.g.q3', { cam: d.closeUp('gabriel', { side: -1 }) });
          await d.say('lyle', 'd12.ly.a3', { cam: d.closeUp('lyle') });
          await d.say('ray', 'd12.ry.dad', { cam: d.closeUp('ray') });
          const o3 = [];
          if (m.flag('unionPin')) o3.push({ t: "(Touch Ray's father's union pin.) Forty-one families, Lyle. Name one high-skill job. Just one.", v: 4, r: ['tommy', 'd12.t.whoop'] });
          o3.push({ t: 'What does a data centre need with a deep-water dock?', v: m.flag('lyleDirt') ? 4 : 3, r: ['hank', 'd12.h.fair'] });
          o3.push({ t: 'Keep the cannery open, and make Northstar pay rent like everybody else.', v: 2, r: ['tommy', 'd12.t.whoop'] });
          const a3 = o3[await d.choose(o3.map((o) => o.t), { prompt: 'THE CANNERY' })] || o3[0];
          score += a3.v;
          await d.say('lyle', 'd12.ly.stumble', { cam: d.closeUp('lyle', { side: -1 }) });
          await d.say(a3.r[0], a3.r[1], { cam: d.closeUp(a3.r[0]) });
          // closing
          await d.say('gabriel', 'd12.g.close', { cam: d.closeUp('gabriel') });
          if (confessed) {
            await d.say('lyle', 'd12.ly.free1', { cam: d.closeUp('lyle') });
            await d.say('lyle', 'd12.ly.free2', { cam: d.closeUp('lyle', { dist: 0.6 }) });
            score += 8;
          } else await d.say('lyle', 'd12.ly.close', { cam: d.closeUp('lyle') });
          if (m.flag('ledgerPhotos')) {
            await d.say('lyosha', 'd12.l.now', { radio: true });
            useLedger = (await d.choose(["(Run the ledger. Put Northstar's payments on the screen.)", '(No. Close with your own words.)'], { prompt: 'THE LEDGER' })) === 0;
          }
        });
        if (confessed) m.flag('lyleConfessed', true);
        if (useLedger) {
          m.obj('Put the ledger on the projector', 'hall.stage', 'Field hack — the whole town is watching');
          await hack(m, 'ledger', 'hall.stage', 'd12.l.now', 'Run the ledger again');
          m.clear();
          m.flag('ledgerUsed', true);
          m.flag('waltExposed', true);
          score += 6;
        }
        await m.scene(async (d) => {
          await d.bring('gabriel', { x: S.x, z: S.z - 0.9 }, { face: 'player' });
          await d.bring('lyle', { x: S.x - 1.6, z: S.z }, { face: 'player' });
          if (useLedger) {
            await d.bring('walt', { x: S.x, z: S.z + 5.6 }, { face: 'player' });
            await d.bring('dolly', { x: S.x + 0.8, z: S.z + 4.2 }, { sit: true, face: 'player' });
            await d.bring('ray', { x: S.x - 2.2, z: S.z + 4.2 }, { sit: true, face: 'lyle' });
            await d.say('gabriel', 'd12.g.screen', { cam: d.closeUp('gabriel') });
            await d.say('dolly', 'd12.d.gasp', { cam: d.closeUp('dolly') });
            await d.say('walt', 'd12.w.exposed', { cam: d.closeUp('walt', { dist: 0.7 }) });
            if (confessed) await d.say('lyle', 'd12.ly.confirm', { cam: d.closeUp('lyle') });
            else {
              await d.say('lyle', 'd12.ly.caught', { cam: d.closeUp('lyle') });
              await d.say('ray', 'd12.ry.sit', { cam: d.closeUp('ray') });
            }
          } else {
            const k = await d.choose([
              "I fix things. This town isn't broken. It's being taken apart. Let me help put it back.",
              "I won't promise you the future. I'll promise to read the budget all the way through. Like Ray did.",
            ], { prompt: 'CLOSING STATEMENT' });
            score += k === 0 ? 3 : 2;
          }
          await d.say('gabriel', 'd12.g.thanks', { cam: d.closeUp('gabriel', { side: -1 }) });
        });
        const won = score >= 10 || confessed || useLedger;
        m.flag('debateScore', score);
        m.flag('debateWon', won);
        m.flag('debateDone', true);
        G.state.standing += score;
        G.hud.toast('STANDING', `+${score}  ${won ? 'Port Zarya thinks you won the debate' : 'A close debate'}`, '#b98cff');
      }
      if (m.cp(3, from)) {
        await G.fadeTeleport(pt(G, 'hall.door', { x: -40, z: -26 }), 1.0);
        await m.scene(async (d) => {
          await d.bring('gideon', pt(G, 'hall.door', { x: -40, z: -26 }, 1.4, 1.2), { face: 'player' });
          await d.say('gideon', 'd12.gi.threat1', { cam: d.closeUp('gideon') });
          await d.say('gideon', 'd12.gi.threat2', { cam: d.closeUp('gideon', { side: -1, dist: 0.6 }) });
          await d.say('gideon', 'd12.gi.threat3', { cam: d.closeUp('gideon', { dist: 0.55 }) });
          const k = await d.choose(['Is that a threat?', '(Say nothing. Hold his stare.)', 'Tell Mr. Halloran I said thank you for the streetlights.'], { prompt: 'GIDEON SHAW' });
          await d.say('gideon', ['d12.gi.threat4', 'd12.gi.stare', 'd12.gi.smile'][k] || 'd12.gi.stare', { cam: d.closeUp('gideon') });
        });
        m.flag('gideonThreat', true);
        G.attention.add(5);
        await m.ear('d12.g.swim');
        await m.ear('d12.n.okay');
        await m.ear(m.flag('ledgerUsed') ? 'd12.dm.ledger' : 'd12.dm.words');
      }
      if (m.cp(4, from)) {
        m.done();
        m.start('d12.night');
      }
    },
  },

  'd12.night': {
    title: "Night School: Baba Valya's Codes", main: true, day: 12,
    async run(m, from) {
      reloop(m);
      if (m.cp(1, from)) {
        await m.ear('d12.v.lesson');
        m.obj("Baba Valya's lesson — the laptop in your cabin", 'cabin.laptop', "Lesson 12: Baba Valya's Codes");
        await hold(m, () => m.G.state.lessons.l12, "Baba Valya's lesson — the laptop in your cabin", 'cabin.laptop', "Lesson 12: Baba Valya's Codes");
      }
      if (m.cp(2, from)) {
        await m.ear('d12.v.after');
        await m.ear('d12.n.night');
        m.done();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd12.hall': {
    title: 'Sound Check', day: 12,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj("Nina needs help with the Parish Hall's PA", 'hall.podium', 'Before the debate');
        await m.spot('pa', 'hall.podium', 'Look at the PA system', 2.6);
      }
      if (m.cp(2, from)) {
        const S = pt(G, 'hall.stage', STAGE);
        await m.scene(async (d) => {
          await d.bring('nina', { x: S.x + 1.2, z: S.z + 1 }, { face: 'player' });
          await d.say('nina', 'd12.ni.pa', { cam: d.closeUp('nina') });
        });
        await m.minigame('wire', { title: 'REWIRE THE PA' });
        await m.scene(async (d) => {
          await d.bring('nina', { x: S.x + 1.2, z: S.z + 1 }, { face: 'player' });
          await d.say('nina', 'd12.ni.pafixed', { cam: d.closeUp('nina', { side: -1 }) });
        });
        G.state.spirit += 3;
        G.state.standing += 1;
        G.state.rel.nina = Math.min(100, (G.state.rel.nina || 0) + 8);
        G.hud.toast('TOWN SPIRIT', '+3  The Parish Hall can hear itself again', '#ffd166');
        m.flag('hallPA', true);
        m.done();
      }
    },
  },

  'd12.home': {
    title: 'Homecoming', day: 12,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Meet Koshkin off the Nome plane', 'terminal', 'The airstrip, from 15:00');
        await hold(m, () => { const h = G.state.hour; return (h >= 14.9 && h < 23) || G.state.day !== 12; }, 'Meet Koshkin off the Nome plane', 'terminal', 'The airstrip, from 15:00');
        await Promise.race([m.reach('terminal', 14), m.until(() => G.state.day !== 12)]);
      }
      if (m.cp(2, from)) {
        if (G.state.day === 12) {
          await m.scene(async (d) => {
            await d.bring('koshkin', { x: 334, z: -24 }, { face: 'player' });
            await d.bring('wade', { x: 336.5, z: -23 }, { face: 'player' });
            await d.say('wade', 'd12.wa.home', { cam: d.closeUp('wade') });
            await d.say('koshkin', 'd12.k.home', { cam: d.closeUp('koshkin') });
            if (m.flag('runStore')) await d.say('koshkin', 'd12.k.store', { cam: d.closeUp('koshkin', { side: -1 }) });
            if (!m.flag('debateDone')) await d.say('koshkin', 'd12.k.debate');
          });
          G.state.rel.koshkin = Math.min(100, (G.state.rel.koshkin || 0) + 10);
          m.flag('koshkinBack', true);
          await m.ear('d12.n.home');
        } else m.flag('koshkinBack', true);
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const once = (npc, key, line, rel = 2, when = () => true) => async (c, prev) => {
  if (c.day !== 12 || c.flag(key) || !when(c)) return prev(c);
  c.flag(key, true);
  await c.say(npc, typeof line === 'function' ? line(c) : line);
  c.rel(rel);
};
/** Before the debate one line, after it another (each once). */
const prePost = (npc, pre, post, rel = 2) => async (c, prev) => {
  if (c.day !== 12) return prev(c);
  const after = !!c.flag('debateDone');
  const line = after ? (typeof post === 'function' ? post(c) : post) : pre;
  if (!line) return prev(c);
  return once(npc, `d12.${npc}.${after ? 'post' : 'pre'}`, line, rel)(c, prev);
};

export const DIALOG = {
  lyle: async (c, prev) => {
    if (c.day !== 12) return prev(c);
    const isFree = c.flag('lyle.freed') || c.flag('sf.lyle.outcome') === 'freed';
    if (c.G.missions.isActive('d12.ledger') && isFree && !c.flag('ledgerPhotos')) {
      await c.you('Lyle. I need the ledger. The Northstar one.');
      await c.say('lyle', 'd12.ly.copy');
      await c.say('lyle', 'd12.ly.copy2');
      c.give('ledger_copy');
      c.flag('ledgerPhotos', true);
      c.flag('lyleAlly', true);
      c.rel(4);
      c.emit('talk:lyle');
      return;
    }
    return prePost('lyle', 'd12.ly.pre', (cc) => (cc.flag('lyleConfessed') ? 'd12.ly.afterFree' : cc.flag('ledgerUsed') ? 'd12.ly.afterHurt' : 'd12.ly.after'), 1)(c, prev);
  },
  walt: prePost('walt', 'd12.w.pre', (c) => (c.flag('ledgerUsed') ? (c.flag('mayorKeyGiven') ? 'd12.w.hurt' : 'd12.w.afterCopied') : 'd12.w.after'), 3),
  dolly: prePost('dolly', 'd12.d.pre', (c) => (c.flag('debateWon') ? 'd12.d.after' : null)),
  ruth: prePost('ruth', 'd12.r.pre', (c) => (c.flag('debateWon') ? 'd12.r.after' : null), 3),
  ray: prePost('ray', 'd12.ry.pre', 'd12.ry.after', 3),
  koshkin: prePost('koshkin', null, (c) => (c.flag('koshkinBack') ? 'd12.k.after' : null), 3),
  hank: once('hank', 'd12.hank.pre', 'd12.h.pre', 2, (c) => !c.flag('debateDone')),
  gideon: once('gideon', 'd12.gideon.pre', 'd12.gi.pre', 0, (c) => !c.flag('debateDone')),
  marta: once('marta', 'd12.marta.pre', 'd12.m.pre', 2, (c) => !c.flag('debateDone')),
  evan: once('evan', 'd12.evan.pre', 'd12.ev.pre', 0, (c) => !c.flag('debateDone')),
  gabriel: once('gabriel', 'd12.gabriel.pre', 'd12.g.pre', 2, (c) => !c.flag('debateDone')),
  lou: once('lou', 'd12.lou.pre', 'd12.lo.pre', 2, (c) => !c.flag('debateDone')),
  tommy: once('tommy', 'd12.tommy.pre', 'd12.t.pre', 2, (c) => !c.flag('debateDone')),
  ellen: once('ellen', 'd12.ellen.pre', 'd12.e.pre', 2, (c) => !c.flag('debateDone')),
  pearl: once('pearl', 'd12.pearl.pre', 'd12.p.pre', 2),
};
export const DIALOG_OVERRIDE = true;
