// DAY 10 — Mr. Grey (Wednesday). Five days to dawn. Someone ran Rybka's face
// through an FBI database. Chief Kowalczyk walks you to the station, where
// Special Agent Daniel Okafor is waiting in the back room: three questions,
// and every answer can be a lie, a half-truth, or the evidence on the table.
// Outcome: okaforDeal (he quietly helps later) or okaforHostile. Then the
// campaign goes on air at KZRY. Side: tea and the Dome's blueprints at Ruth's,
// Ray's last shift at the cannery.
export const DAY = { n: 10, start: ['d10.grey'], mustFinish: ['d10.night'] };

const passed = (r) => r === true || !!(r && r.pass);
/** A town point as {x, z} (offset by dx, dz), or a fallback position. */
const pt = (G, name, fb, dx = 0, dz = 0) => { const q = G.town?.points?.[name]; return q ? { x: q.x + dx, z: q.z + dz } : { x: fb.x + dx, z: fb.z + dz }; };
const OFFICE = { x: 31, z: -93 };    // police.chiefOffice, if the building has no such point
function ensureNpc(G, id, name = id) {
  const list = G.npcs?.list;
  if (!list?.get || list.has(id)) return;
  const proto = list.get('evan') || [...list.values()].find((n) => !n.def?.folk);
  try { if (proto) list.set(id, new proto.constructor(id, { name })); } catch { /* none to borrow */ }
}
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });

export const LINES = {
  // ---------------------------------------------------------------- morning
  'd10.n.morning': { who: 'nadia', ru: 'Пять дней. Рыбка, у нас новости, и они мне не нравятся.', en: "Five days. Rybka, we have news, and I don't like it.", emo: 'worry' },
  'd10.l.query': { who: 'lyosha', ru: 'Ночью кто-то прогнал твоё лицо через федеральную базу. Запрос из Анкориджа. Это ФБР.', en: 'Overnight somebody ran your face through a federal database. The query came from Anchorage. It\'s the FBI.', emo: 'worry' },
  'd10.dm.calm': { who: 'dmitri', ru: 'Без паники. Ведём себя как обычно. Если спросят — говори мало. И лучше правду: ложь в маленьком городе живёт недолго.', en: "No panic. We behave as usual. If they ask, say little. And better the truth: in a small town a lie doesn't live long.", emo: 'serious' },
  'd10.i.papers': { who: 'ivan', ru: 'Документы выдержат. Ручаюсь.', en: 'The papers will hold. I vouch for them.' },
  'd10.n.work': { who: 'nadia', ru: 'Иди на работу. Открой магазин. Пусть видят, что тебе нечего скрывать.', en: 'Go to work. Open the store. Let them see you have nothing to hide.' },
  'd10.n.marta': { who: 'nadia', ru: 'Спокойно. Это шеф полиции. Иди с ней. Мы слушаем.', en: "Easy. That's the police chief. Go with her. We're listening.", emo: 'serious' },
  'd10.m.come': { who: 'marta', en: "Morning. Flip the sign to closed. You're coming with me to the station.", emo: 'serious' },
  'd10.m.arrest': { who: 'marta', en: "Not yet. Somebody wants to talk to you, and I want to hear what you say. Let's go." },
  'd10.m.coffee': { who: 'marta', en: "Bring it. It's a short walk and a long morning." },
  'd10.m.good': { who: 'marta', en: 'Good. No fuss. I like that.' },
  // ---------------------------------------------------------------- the back room
  'd10.o.intro': { who: 'okafor', en: "Sit down. The coffee's terrible, I made it myself. Special Agent Daniel Okafor, FBI, Anchorage field office. I'm guessing you had a name for me. Something about the coat.", emo: 'smile' },
  'd10.o.file': { who: 'okafor', en: 'Here\'s what I know. You flew in from Anchorage with a carpenter\'s licence so clean it squeaks. Nobody in Anchorage remembers hiring you. Nobody.' },
  'd10.o.file2': { who: 'okafor', en: "Day one, you climb a bell tower with a radio relay in your bag. Monday night, nineteen Northstar cameras fall asleep. Tuesday, you're running for council. Busy two weeks for a handyman." },
  'd10.m.told': { who: 'marta', en: "And you told me somebody broke into your cabin. That's the only reason you're sitting in a chair and not a cell.", emo: 'serious' },
  'd10.m.nottold': { who: 'marta', en: "And somebody parked a black SUV by your cabin all Sunday, and you never said a word to me. I'm still deciding what I think of you.", emo: 'frown' },
  'd10.o.q1': { who: 'okafor', en: "So. First question, and it's the only one that matters. Who are you working for?", emo: 'serious' },
  'd10.o.lie1': { who: 'okafor', en: "Nobody fixes roofs in November. Try again, or don't. Either way I'm writing down that you lied to me.", emo: 'frown' },
  'd10.o.partial1': { who: 'okafor', en: "Friends. Everybody's got friends. Mine are in Anchorage, and they think I'm crazy. Go on." },
  'd10.o.bugs': { who: 'okafor', en: "Consumer hardware. Northstar's own brand, serial numbers filed off. Somebody wanted to know you very well.", emo: 'serious' },
  'd10.m.warrant': { who: 'marta', en: 'Nobody bugs a house in my town without a warrant. And I signed no warrant.', emo: 'angry' },
  'd10.o.q2': { who: 'okafor', en: 'Second question. What do you know about the Dome?' },
  'd10.o.lie2': { who: 'okafor', en: 'That\'s what the brochure says too.', emo: 'frown' },
  'd10.o.partial2': { who: 'okafor', en: "They do. I've had two visits. They brought muffins. It was the most frightening thing that's ever happened to me.", emo: 'smile' },
  'd10.o.shifts': { who: 'okafor', en: "On shortwave? In plain numbers? A billion-dollar company runs its security like a church bingo night?", emo: 'surprise' },
  'd10.m.bingo': { who: 'marta', en: "Don't knock bingo.", emo: 'smile' },
  'd10.o.cards': { who: 'okafor', en: "Keys. Five laminated cards and a mayor. I've stared at that council for a month and never once asked what they signed.", emo: 'surprise' },
  'd10.o.mine': { who: 'okafor', en: 'Let me tell you mine. Eleven months on Northstar. Money moving through shell companies. An engineer in Fairbanks who drove off a bridge in July.' },
  'd10.o.mine2': { who: 'okafor', en: "And a grid controller that phones home to a radar dome in Alaska. I can't get a warrant for that hill. Halloran owns two senators and a judge.", emo: 'serious' },
  'd10.o.mine3': { who: 'okafor', en: 'So I watch. And lately, what I watch is you. Last question. What are you really after?' },
  'd10.o.lie3': { who: 'okafor', en: 'Nothing. Okay.', emo: 'frown' },
  'd10.o.proof': { who: 'okafor', en: "Proof. We'd make good partners, you and me. If I trusted you." },
  'd10.o.truth': { who: 'okafor', en: "You're either crazy or the most important person in Alaska. I've met a lot of crazy people. They don't usually fix church bells.", emo: 'surprise' },
  'd10.o.deal': { who: 'okafor', en: "Here's my card. No name, just a number. I can't help you. Officially, I never met you.", emo: 'serious' },
  'd10.o.deal2': { who: 'okafor', en: 'Unofficially, if you need a door to stay open, or a man to look the wrong way at the right moment, call it.' },
  'd10.m.deal': { who: 'marta', en: "And I didn't hear a word of this. Go on. Get out of my office, candidate.", emo: 'smile' },
  'd10.o.hostile': { who: 'okafor', en: "Then we're done. You can go. Don't leave town. I'll be watching, and this time I won't be subtle.", emo: 'angry' },
  'd10.m.hostile': { who: 'marta', en: "You heard the man. And whatever it is you're doing, don't do it in my town.", emo: 'frown' },
  'd10.n.breathe': { who: 'nadia', ru: 'Рыбка… мы всё слышали. Всё хорошо? Дыши.', en: 'Rybka… we heard everything. Are you alright? Breathe.', emo: 'worry' },
  'd10.dm.deal': { who: 'dmitri', ru: 'Американский полицейский, который слушает. Я прожил шестьдесят два года и видел таких двоих.', en: "An American policeman who listens. I've lived sixty-two years and seen two of those.", emo: 'smile' },
  'd10.g.deal': { who: 'grisha', ru: 'Ну всё, теперь у нас свой человек в ФБР! Ивана можно увольнять.', en: "That's it — now we've got our own man in the FBI! We can fire Ivan.", emo: 'laugh' },
  'd10.i.no': { who: 'ivan', ru: '…Нельзя.', en: "…You can't.", emo: 'smile' },
  'd10.dm.hostile': { who: 'dmitri', ru: 'Значит, теперь за нами смотрят двое. Значит, идём быстрее.', en: 'So now two of them are watching us. So we go faster.', emo: 'serious' },
  'd10.l.hostile': { who: 'lyosha', ru: 'Я буду следить за его запросами. Полезет в базу ещё раз — узнаем первыми.', en: "I'll watch his queries. If he digs in the database again, we'll know first." },
  'd10.n.tea': { who: 'nadia', ru: 'Рут Акпик звонила в магазин. Зовёт тебя вечером на чай. Сходи — она не из тех, кто зовёт просто так.', en: "Ruth Aqpik called the store. She's inviting you for tea this evening. Go — she isn't one to invite people for nothing." },
  'd10.n.radio': { who: 'nadia', ru: 'И ещё: Нина зовёт тебя в эфир, вечером. Лайл выступал у неё утром. Пора ответить.', en: 'And one more thing: Nina wants you on the air this evening. Lyle was on her show this morning. Time to answer.' },
  // ---------------------------------------------------------------- KZRY: on the air
  'd10.ni.onair': { who: 'nina', en: "You're listening to KZRY, eighty-eight point nine, and I've got the other candidate for Ray Moody's seat right here. Say hi to Port Zarya.", emo: 'smile' },
  'd10.ni.q1': { who: 'nina', en: "This morning Lyle Pruitt told my listeners you're an outsider who doesn't know this town. What do you say to that?" },
  'd10.ni.roofs': { who: 'nina', en: "Ooh. My mom just choked on her coffee. That's a yes from the Kowalczyk household.", emo: 'laugh' },
  'd10.ni.payroll': { who: 'nina', en: "Okay, we're going to get letters. I love it.", emo: 'laugh' },
  'd10.ni.history': { who: 'nina', en: 'History nerd! Ruth Aqpik just called the station to say she approves.', emo: 'smile' },
  'd10.ni.q2': { who: 'nina', en: 'Next question, from a listener. What would you do about the cannery?' },
  'd10.ni.jobs': { who: 'nina', en: "That's going to play well at the Anchor tonight.", emo: 'smile' },
  'd10.ni.really': { who: 'nina', en: "Huh. That's a really good question. Northstar, if you're listening, and you always are, call in.", emo: 'surprise' },
  'd10.ni.honest': { who: 'nina', en: "A politician who says I don't know. On my show. I need to sit down. I'm already sitting down.", emo: 'laugh' },
  'd10.ni.q3': { who: 'nina', en: 'Last one. Lightning round. Northstar Twenty-Four or Koshkin\'s?' },
  'd10.ni.koshkin': { who: 'nina', en: "Koshkin's, obviously. Twelve-dollar sandwiches are a crime against the Bering Sea.", emo: 'laugh' },
  'd10.ni.both': { who: 'nina', en: "Diplomatic. Boring, but diplomatic.", emo: 'smile' },
  'd10.ni.end': { who: 'nina', en: "That's all the time we have. Election's Saturday at the Parish Hall, polls open eight to eight. Now, a song that isn't one of my twenty." },
  'd10.v.radio': { who: 'valya', ru: 'Хорошо говоришь, рыбка. Коротко и по делу. Как телеграмма.', en: 'You speak well, little fish. Short and to the point. Like a telegram.', emo: 'smile' },
  'd10.n.lesson': { who: 'nadia', ru: 'Домой. Сегодня словари. Лёша говорит, тебе понравится.', en: "Home. Tonight: dictionaries. Lyosha says you'll like it." },
  'd10.l.after': { who: 'lyosha', ru: 'Словарь отвечает на вопрос «чьё это?». Скоро мы спросим у «Нордстара», чьи это деньги.', en: "A dictionary answers 'whose is this?'. Soon we'll ask Northstar whose money this is.", emo: 'smile' },
  'd10.n.night': { who: 'nadia', ru: 'Тяжёлый был день. Ты держишься лучше, чем мы все. Спи. Завтра — четыре дня.', en: "It was a hard day. You're holding up better than all of us. Sleep. Tomorrow: four days.", emo: 'smile' },
  // ---------------------------------------------------------------- side: tea at Ruth's
  'd10.r.tea': { who: 'ruth', en: "Come in, come in. Shoes off, the floor was my mother's. Sit. It's Labrador tea, from the tundra. Tastes like a hillside.", emo: 'smile' },
  'd10.r.husband': { who: 'ruth', en: 'My Joseph worked in the Dome in sixty-four, when it was the Air Force\'s. Radar technician. He used to say the hill had more rooms under it than above it.' },
  'd10.r.plans': { who: 'ruth', en: 'He kept these. Blueprints. The Air Force forgot to ask for them back. The lower level. The old battery room, the shelter, the tunnel to the generator shed.' },
  'd10.r.why': { who: 'ruth', en: 'Because a man with a dome on a hill bought our town, and nobody asked what\'s under it. You look like somebody who asks.', emo: 'serious' },
  'd10.r.welcome': { who: 'ruth', en: "Don't thank me. Just don't get caught with them. Joseph would never forgive me, and he's been gone twelve years.", emo: 'smile' },
  'd10.l.plans': { who: 'lyosha', ru: 'Туннель к генераторной! Рыбка, это же чёрный ход к хранилищу.', en: "A tunnel to the generator shed! Rybka, that's a back door to the vault.", emo: 'surprise' },
  // ---------------------------------------------------------------- side: Ray's last shift
  'd10.ry.locker': { who: 'ray', en: "Last week on the line. Forty-one people, one rusty locker each. Mine's stuck. Course it is. Grab the other end of this crowbar." },
  'd10.ry.pin': { who: 'ray', en: "My dad's union pin. The strike of seventy-one. Wear it Friday at the debate. The cannery crowd will know what it means.", emo: 'serious' },
  'd10.ry.shift': { who: 'ray', en: "And if you've got two hours, the line's short-handed. Fish don't care who's quitting." },
  'd10.ry.thanks': { who: 'ray', en: 'You gut fish like a carpenter. Ha. Thanks. I mean it.', emo: 'smile' },
  // ---------------------------------------------------------------- around town
  'd10.d.chat': { who: 'dolly', en: "Honey! Marta walked you down Main Street this morning and the whole diner pressed their noses to the glass. Are you in trouble? Don't tell me. Tell me.", emo: 'worry' },
  'd10.h.chat': { who: 'hank', en: "Saw the Chief walk you to the station. Whatever it was, you're walking around now. In this town, that counts as being found innocent." },
  'd10.ly.chat': { who: 'lyle', en: "Heard you had a little chat with the police. Funny how it's always the outsiders.", emo: 'smile' },
  'd10.gi.chat': { who: 'gideon', en: 'The FBI is in Port Zarya. Did you know? They take an interest in irregularities. So do I.', emo: 'serious' },
  'd10.w.chat': { who: 'walt', en: "Marta picked you up? Lord. Whatever it is, I don't want to know. Do I? No. I don't.", emo: 'worry' },
  'd10.ev.chat': { who: 'evan', en: "You were at the police station! Is everything okay? We care so much about our community. All of it. Every single day.", emo: 'smile' },
  'd10.g.chat': { who: 'gabriel', en: 'If you ever need sanctuary, the church has very thick walls. And the Chief is afraid of my housekeeper.', emo: 'smile' },
  'd10.ni.chat': { who: 'nina', en: "Hey! You're still coming on the show tonight, right? Lyle was on this morning. He used the word synergy four times.", emo: 'laugh' },
  'd10.ni.after': { who: 'nina', en: 'You were great on the air! The phones lit up. Well, three phones. That\'s a lot for us.', emo: 'smile' },
  'd10.lo.chat': { who: 'lou', en: "Rumour is you got hauled in by the FBI. Rumour also says you were back by lunch. First drink's on me for that." },
  'd10.t.chat': { who: 'tommy', en: "Grandma says you're coming to tea. Wear clean socks. She checks.", emo: 'laugh' },
  'd10.e.chat': { who: 'ellen', en: "You look pale. Pale for up here, which is saying something. Eat something green. Not Northstar's salad. It's mostly lettuce water." },
  'd10.p.chat': { who: 'pearl', en: "Your petition's filed, hon. Every name checked. Gideon came by twice to look. I made him wait in line." , emo: 'smile' },
  'd10.wa.chat': { who: 'wade', en: 'Tomorrow the weather clears. Come by the hangar in the morning and I\'ll show you how to hover. It\'s like standing on a beach ball.' },
  'd10.m.dealchat': { who: 'marta', en: 'Not a word, candidate. Not to me, not to anyone. Go win your election.' },
  'd10.m.hostilechat': { who: 'marta', en: "Don't make me regret letting you walk out of that room." , emo: 'frown' },
  'd10.ry.chat': { who: 'ray', en: "My last week at the cannery. Come by if you want to see what forty-one jobs look like before they're gone." },
};

// ---------------------------------------------------------------- missions
const NIGHT = (h) => h >= 17 || h < 3;

export const MISSIONS = {
  'd10.grey': {
    title: 'Mr. Grey', main: true, day: 10,
    async run(m, from) {
      const G = m.G;
      const store = !!m.flag('runStore');
      if (m.cp(1, from)) {
        await m.wait(1.0);
        await m.ear('d10.n.morning');
        await m.ear('d10.l.query');
        await m.ear('d10.dm.calm');
        await m.ear('d10.i.papers');
        m.ear('d10.n.work');
      }
      if (m.cp(2, from)) {
        if (store) {
          m.obj("Go to Koshkin's as usual", 'koshkin.counter');
          await m.reach('koshkin.counter', 3);
        } else {
          m.obj('Breakfast at the diner, like any other day', 'diner');
          await m.reach('diner', 9);
        }
        m.clear();
        await m.scene(async (d) => {
          await d.bring('marta', store ? pt(G, 'koshkin.counter', { x: 30, z: -2 }, -1.6, 0.4) : { x: 28, z: 43 }, { face: 'player' });
          await d.say('marta', 'd10.m.come', { cam: d.closeUp('marta') });
          await d.say('nadia', 'd10.n.marta', { radio: true });
          const k = await d.choose(['Am I under arrest?', 'Can I finish my coffee?', store ? '(Flip the sign to closed.)' : '(Leave a tip and stand up.)'], { prompt: 'CHIEF KOWALCZYK' });
          await d.say('marta', ['d10.m.arrest', 'd10.m.coffee', 'd10.m.good'][k] || 'd10.m.good', { cam: d.closeUp('marta', { side: -1 }) });
        });
        m.flag('d10.pickedUp', true);
      }
      if (m.cp(3, from)) {
        await G.fadeTeleport(pt(G, 'police.chiefOffice', OFFICE), 1.6);
        ensureNpc(G, 'okafor', 'Special Agent Okafor');
        let trust = 0, marta = !!m.flag('martaToldBreakIn');
        await m.scene(async (d) => {
          await d.bring('okafor', pt(G, 'police.chiefDesk', OFFICE, 0.4, 1.0), { sit: true, face: 'player' });
          await d.bring('marta', pt(G, 'police.chiefOffice', OFFICE, 1.3, 0.6), { face: 'player' });
          await d.say('okafor', 'd10.o.intro', { cam: d.closeUp('okafor') });
          await d.say('okafor', 'd10.o.file');
          await d.say('okafor', 'd10.o.file2', { cam: d.closeUp('okafor', { side: -1 }) });
          await d.say('marta', m.flag('martaToldBreakIn') ? 'd10.m.told' : 'd10.m.nottold', { cam: d.closeUp('marta') });
          await d.say('okafor', 'd10.o.q1', { cam: d.closeUp('okafor', { dist: 0.6 }) });
          // round one: who are you working for?
          const o1 = [{ t: 'Nobody. I fix roofs.', v: -1, r: 'd10.o.lie1' }, { t: 'Friends. People who want Northstar stopped.', v: 1, r: 'd10.o.partial1' }];
          if (m.flag('cabinSwept')) o1.push({ t: '(Put the bugs from your cabin on the table.)', v: 2, r: 'd10.o.bugs', m: 'd10.m.warrant' });
          const a1 = o1[await d.choose(o1.map((o) => o.t), { prompt: 'WHO ARE YOU WORKING FOR?' })] || o1[0];
          trust += a1.v;
          await d.say('okafor', a1.r, { cam: d.closeUp('okafor') });
          if (a1.m) { await d.say('marta', a1.m, { cam: d.closeUp('marta', { side: -1 }) }); marta = true; }
          // round two: the Dome
          await d.say('okafor', 'd10.o.q2', { cam: d.overShoulder('player', 'okafor') });
          const o2 = [{ t: "It's an old radar station. That's all I know.", v: -1, r: 'd10.o.lie2' }, { t: 'Halloran lives up there. People who look too long get visits.', v: 1, r: 'd10.o.partial2' }];
          if (m.flag('domeShifts')) o2.push({ t: 'The guards change every four hours, at two past. They read it out on shortwave.', v: 2, r: 'd10.o.shifts', m: 'd10.m.bingo' });
          if (m.flag('knowsShares')) o2.push({ t: "The council's continuity cards aren't for emergencies. They're keys to his vault.", v: 2, r: 'd10.o.cards' });
          const a2 = o2[await d.choose(o2.map((o) => o.t), { prompt: 'WHAT DO YOU KNOW ABOUT THE DOME?' })] || o2[0];
          trust += a2.v;
          await d.say('okafor', a2.r, { cam: d.closeUp('okafor', { side: -1 }) });
          if (a2.m) await d.say('marta', a2.m, { cam: d.closeUp('marta') });
          // his cards on the table
          await d.say('okafor', 'd10.o.mine', { cam: d.closeUp('okafor', { dist: 0.9 }) });
          await d.say('okafor', 'd10.o.mine2');
          await d.say('okafor', 'd10.o.mine3', { cam: d.closeUp('okafor', { dist: 0.6 }) });
          const o3 = [
            { t: 'Nothing. Let me go.', v: -1, r: 'd10.o.lie3' },
            { t: 'Proof. Of what Northstar is really building.', v: 1, r: 'd10.o.proof' },
            { t: "There's a drive in Halloran's vault. It stops what he's planning. Before it switches off the world.", v: 3, r: 'd10.o.truth' },
          ];
          const a3 = o3[await d.choose(o3.map((o) => o.t), { prompt: 'WHAT ARE YOU REALLY AFTER?' })] || o3[0];
          trust += a3.v;
          await d.say('okafor', a3.r, { cam: d.closeUp('okafor') });
          if (trust >= 3) {
            await d.say('okafor', 'd10.o.deal', { cam: d.closeUp('okafor', { side: -1 }) });
            await d.say('okafor', 'd10.o.deal2');
            await d.say('marta', 'd10.m.deal', { cam: d.closeUp('marta') });
            marta = true;
          } else {
            await d.say('okafor', 'd10.o.hostile', { cam: d.closeUp('okafor', { dist: 0.6 }) });
            await d.say('marta', 'd10.m.hostile', { cam: d.closeUp('marta', { side: -1 }) });
          }
        });
        const deal = trust >= 3;
        m.flag('okaforTrust', trust);
        m.flag('okaforDeal', deal);
        m.flag('okaforHostile', !deal);
        if (marta) m.flag('martaTrust', true);
        G.attention.add(deal ? -10 : 12);
        G.hud.toast(deal ? 'AN UNOFFICIAL FRIEND' : 'THE FBI IS WATCHING', deal ? 'Okafor gave you a number with no name' : "Okafor doesn't believe you", deal ? '#9fe8b0' : '#ff8a5a');
        await G.fadeTeleport(pt(G, 'police.door', { x: 20, z: -96 }), 1.2);
      }
      if (m.cp(4, from)) {
        await m.ear('d10.n.breathe');
        if (m.flag('okaforDeal')) await m.ears(['d10.dm.deal', 'd10.g.deal', 'd10.i.no']);
        else await m.ears(['d10.dm.hostile', 'd10.l.hostile']);
        await m.ear('d10.n.tea');
        await m.ear('d10.n.radio');
        m.start('d10.tea');
        m.start('d10.cannery');
        m.done();
        m.start('d10.radio');
      }
    },
  },

  'd10.radio': {
    title: 'On the Air', main: true, day: 10,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Go on the air at KZRY', 'radio.mic', 'Nina — from 17:00');
        await hold(m, () => NIGHT(G.state.hour), 'Go on the air at KZRY', 'radio.mic', 'Nina — from 17:00');
        await m.spot('mic', 'radio.mic', 'Sit down at the microphone', 2.6);
      }
      if (m.cp(2, from)) {
        let gain = 0, heat = 0;
        await m.scene(async (d) => {
          await d.bring('nina', 'radio.console', { sit: true, face: 'player' });
          await d.say('nina', 'd10.ni.onair', { cam: d.closeUp('nina') });
          await d.choose(['Hi, Port Zarya.', "Hello, everybody. I'm the one who fixed the bell."], { prompt: 'ON THE AIR' });
          await d.say('nina', 'd10.ni.q1', { cam: d.closeUp('nina', { side: -1 }) });
          const k1 = await d.choose([
            "I've been here ten days and I've fixed more roofs than Northstar has.",
            "I don't know this town like Lyle does. I'm not on Northstar's payroll yet.",
            'Outsiders built this town. Russian ones, in eighteen twenty-two.',
          ], { prompt: 'ON THE AIR' });
          await d.say('nina', ['d10.ni.roofs', 'd10.ni.payroll', 'd10.ni.history'][k1] || 'd10.ni.roofs');
          gain += [3, 4, 3][k1] ?? 3; heat += k1 === 1 ? 4 : 0;
          await d.say('nina', 'd10.ni.q2', { cam: d.closeUp('nina') });
          const k2 = await d.choose([
            "Fight the dock lease. Forty-one jobs aren't a data centre.",
            'Ask Northstar what that dock is really for.',
            "I don't know yet. I'll ask the people who work there.",
          ], { prompt: 'ON THE AIR' });
          await d.say('nina', ['d10.ni.jobs', 'd10.ni.really', 'd10.ni.honest'][k2] || 'd10.ni.jobs');
          gain += [3, 3, 2][k2] ?? 3; heat += k2 === 1 ? 3 : 0;
          if (k2 === 2) G.state.rel.ray = Math.min(100, (G.state.rel.ray || 0) + 5);
          await d.say('nina', 'd10.ni.q3', { cam: d.closeUp('nina', { side: -1 }) });
          const k3 = await d.choose(["Koshkin's.", "Both stores are part of this town."], { prompt: 'LIGHTNING ROUND' });
          await d.say('nina', k3 === 0 ? 'd10.ni.koshkin' : 'd10.ni.both');
          gain += k3 === 0 ? 2 : 1;
          await d.say('nina', 'd10.ni.end', { cam: d.closeUp('nina') });
        });
        G.state.standing += gain;
        if (heat) G.attention.add(heat);
        G.hud.toast('STANDING', `+${gain}  Port Zarya heard you on KZRY`, '#b98cff');
        m.flag('radioDone', true);
        await m.ear('d10.v.radio');
      }
      if (m.cp(3, from)) {
        m.done();
        m.start('d10.night');
      }
    },
  },

  'd10.night': {
    title: 'Night School: Dictionaries', main: true, day: 10,
    async run(m, from) {
      if (m.cp(1, from)) {
        await m.ear('d10.n.lesson');
        m.obj("Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 10: Whose Is This?');
        await hold(m, () => m.G.state.lessons.l10, "Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 10: Whose Is This?');
      }
      if (m.cp(2, from)) {
        await m.ear('d10.l.after');
        await m.ear('d10.n.night');
        m.done();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd10.tea': {
    title: "Tea at Ruth's", day: 10,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj("Tea at Ruth's house", 'house1.door', 'Second Avenue, west — after 17:00');
        await m.until(() => NIGHT(G.state.hour));
        await m.spot('knock', 'house1.door', "Knock on Ruth's door", 2.6);
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.bring('ruth', pt(G, 'house1.door', { x: -80, z: 22 }, 0, 1.2), { face: 'player' });
          await d.say('ruth', 'd10.r.tea', { cam: d.closeUp('ruth') });
          await d.say('ruth', 'd10.r.husband');
          await d.say('ruth', 'd10.r.plans', { cam: d.closeUp('ruth', { side: -1 }) });
          const k = await d.choose(['Why are you giving me these?', 'Thank you, Ruth.'], { prompt: 'RUTH' });
          await d.say('ruth', k === 0 ? 'd10.r.why' : 'd10.r.welcome', { cam: d.closeUp('ruth', { dist: 0.65 }) });
        });
        m.flag('domePlans', true);
        G.state.inv.dome_blueprints = 1;
        G.state.rel.ruth = Math.min(100, (G.state.rel.ruth || 0) + 10);
        G.hud.toast('ITEM', 'Blueprints of the Dome, 1964');
        await m.ear('d10.l.plans');
        m.done();
      }
    },
  },

  'd10.cannery': {
    title: "Ray's Last Shift", day: 10,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Help Ray clear his locker at the cannery', 'cannery', 'Zarya Seafoods');
        await m.reach('cannery', 18);
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.bring('ray', { x: 170, z: 92 }, { face: 'player' });
          await d.say('ray', 'd10.ry.locker', { cam: d.closeUp('ray') });
        });
        await m.minigame('hammer', { title: 'PRY THE LOCKER' });
        let shift = false;
        await m.scene(async (d) => {
          await d.bring('ray', { x: 170, z: 92 }, { face: 'player' });
          await d.say('ray', 'd10.ry.pin', { cam: d.closeUp('ray', { side: -1 }) });
          await d.say('ray', 'd10.ry.shift');
          shift = (await d.choose(["I've got two hours.", 'Not today, Ray.'], { prompt: 'RAY' })) === 0;
        });
        m.flag('unionPin', true);
        G.state.inv.union_pin = 1;
        G.hud.toast('ITEM', "Ray's father's union pin");
        if (shift) {
          const earned = await m.job('cannery', { hours: 2 });
          if (earned) m.money(earned, 'cannery shift');
          await m.scene(async (d) => {
            await d.bring('ray', { x: 170, z: 92 }, { face: 'player' });
            await d.say('ray', 'd10.ry.thanks', { cam: d.closeUp('ray') });
          });
          G.state.standing += 2;
          G.hud.toast('STANDING', '+2  The cannery crowd saw you on the line', '#b98cff');
        }
        G.state.rel.ray = Math.min(100, (G.state.rel.ray || 0) + (shift ? 12 : 6));
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const once = (npc, key, line, rel = 2, when = () => true) => async (c, prev) => {
  if (c.day !== 10 || c.flag(key) || !when(c)) return prev(c);
  c.flag(key, true);
  await c.say(npc, typeof line === 'function' ? line(c) : line);
  c.rel(rel);
};
const picked = (c) => c.flag('d10.pickedUp');
const questioned = (c) => c.flag('okaforDeal') || c.flag('okaforHostile');

export const DIALOG = {
  marta: once('marta', 'd10.m.chatted', (c) => (c.flag('okaforDeal') ? 'd10.m.dealchat' : 'd10.m.hostilechat'), 2, questioned),
  dolly: once('dolly', 'd10.d.chatted', 'd10.d.chat', 2, picked),
  hank: once('hank', 'd10.h.chatted', 'd10.h.chat', 2, picked),
  lou: once('lou', 'd10.lo.chatted', 'd10.lo.chat', 3, picked),
  lyle: once('lyle', 'd10.ly.chatted', 'd10.ly.chat', 0, picked),
  gideon: once('gideon', 'd10.gi.chatted', 'd10.gi.chat', 0),
  walt: once('walt', 'd10.w.chatted', 'd10.w.chat', 2, picked),
  evan: once('evan', 'd10.ev.chatted', 'd10.ev.chat', 0, picked),
  gabriel: once('gabriel', 'd10.g.chatted', 'd10.g.chat', 2),
  tommy: once('tommy', 'd10.t.chatted', 'd10.t.chat', 2, (c) => c.G.missions.isActive('d10.tea')),
  ellen: once('ellen', 'd10.e.chatted', 'd10.e.chat', 2),
  pearl: once('pearl', 'd10.p.chatted', 'd10.p.chat', 2, (c) => c.flag('petitionFiled')),
  wade: once('wade', 'd10.wa.chatted', 'd10.wa.chat', 2),
  ray: once('ray', 'd10.ry.chatted', 'd10.ry.chat', 2, (c) => !c.G.missions.isDone('d10.cannery')),
  nina: async (c, prev) => {
    if (c.day !== 10) return prev(c);
    const key = c.flag('radioDone') ? 'd10.ni.chatted2' : 'd10.ni.chatted';
    if (c.flag(key)) return prev(c);
    c.flag(key, true);
    await c.say('nina', c.flag('radioDone') ? 'd10.ni.after' : 'd10.ni.chat');
    c.rel(3);
  },
};
export const DIALOG_OVERRIDE = true;
