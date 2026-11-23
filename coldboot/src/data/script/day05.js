// DAY 5 — Fish Fry (Friday). Rybka carries Koshkin's famous (too salty)
// pickled herring to the Friday fish fry at the Parish Hall. The whole town is
// there, and over fried halibut each of the five council members tells Rybka
// their trouble — the doors to their personal quests (side_friends.js). Koshkin
// never comes. At closing time his heart gives out at the counter: Doc Ellen,
// Wade's plane to Nome, and the store keys pressed into Rybka's hand: "Keep it
// open. Don't let that glass box win." Night School lesson 5.
//
// ---------------------------------------------------------------- repairs used
//   none today.
//
// ---------------------------------------------------------------- flags set
// The fish-fry talks are teasers that open side_friends.js's council quests
// (which then tell the rest) without stealing their first beats:
//   q.dolly.open  Dolly: the diner's failing since NORTHSTAR 24 opened, and "Northstar has its
//                 hooks in me somewhere" (side_friends: they bought her loan; Earl's recipe box).
//   q.hank.open   Hank: Northstar sells heating oil impossibly cheap, "something stinks"
//                 (side_friends: below-cost oil, Ray's delivery tickets; his son Danny).
//   q.ruth.open   Ruth: the children don't know their own history; she has "a project" and
//                 needs someone to climb into attics (side_friends: the photo album, the school bell).
//   q.ray.open    Ray: Northstar's buying into the cannery, Seattle wants names, he's "about
//                 done" with the council (side_friends: twelve names, Kayla; sets up day 9's vacancy).
//   q.lyle.open   Lyle: Northstar pays him to back them while planning free home insurance with
//                 the smart meters. "I'm not their guy, I'm their mark." (side_friends: his files.)
//   q.<id>.how    the choice Rybka made in that talk ('help' | 'ask')
//   koshkinHospital  true — Koshkin is in hospital in Nome (schedules.js hides him)
//   runStore      true — Rybka runs Koshkin's (side_jobs.js 'job.shop' from day 7; day 6 runs it itself)
//   koshkinPromise  Rybka promised to keep the store open        inv: store_keys
import {
  at, local, dist, cu, shot, rel, place, warp, release, hold, idle,
} from './day02.js';

export const DAY = { n: 5, start: ['d5.morning'], mustFinish: ['d5.morning', 'd5.fry', 'd5.closing'] };

export const LINES = {
  // ---- the earpiece
  'd5.n.morning': { who: 'nadia', ru: 'Сегодня рыбный вечер в приходском зале. Весь город, весь совет. За жареной рыбой люди говорят то, чего никогда не скажут в мэрии.', en: "Today, the fish fry at the parish hall. The whole town, the whole council. Over fried fish, people say things they'd never say at City Hall." },
  'd5.l.morning': { who: 'lyosha', ru: 'У каждого из пятерых — карточка. Нам нужны три. А значит, нужно знать, чем они живут.', en: 'Each of the five has a card. We need three. Which means we need to know what they live for.' },
  'd5.n.early': { who: 'nadia', ru: 'Рано. Начнут в полдень. Отец Гавриил ещё расставляет столы.', en: 'Too early. They start at noon. Father Gabriel is still setting out the tables.' },
  'd5.n.fry': { who: 'nadia', ru: 'Слушай их, Рыбка. Просто слушай. Пусть рассказывают.', en: 'Listen to them, Rybka. Just listen. Let them talk.' },
  'd5.n.ray': { who: 'nadia', ru: 'Моуди может уйти из совета. Тогда освободится место. Запомни это.', en: 'Moody might leave the council. Then a seat opens up. Remember that.', emo: 'serious' },
  'd5.n.lyle': { who: 'nadia', ru: 'Пруитт — их человек, который их же и боится. Интересно.', en: "Pruitt is their man, and he's afraid of them. Interesting." },
  'd5.n.five': { who: 'nadia', ru: 'Пятеро — пять историй. Каждому что-то нужно. Мы можем помочь. По-настоящему помочь.', en: 'Five people, five stories. Each one needs something. We can help. Really help.' },
  'd5.dm.honest': { who: 'dmitri', ru: 'Помогай честно, Рыбка. Мы пришли не обманывать этих людей. Мы пришли сохранить им свет.', en: "Help them honestly, Rybka. We didn't come to cheat these people. We came to keep their lights on.", emo: 'serious' },
  'd5.n.run': { who: 'nadia', ru: 'Беги! Клиника — через площадь. Быстрее!', en: "Run! The clinic is across the square. Hurry!", emo: 'worry' },
  'd5.n.wade': { who: 'nadia', ru: 'Уэйд — в закусочной. Беги!', en: "Wade's at the diner. Run!", emo: 'worry' },
  'd5.n.sorry': { who: 'nadia', ru: 'Мне очень жаль, Рыбка. Он крепкий старик. Он выкарабкается.', en: "I'm so sorry, Rybka. He's a tough old man. He'll pull through.", emo: 'worry' },
  'd5.dm.store': { who: 'dmitri', ru: 'Магазин теперь на тебе. Это тяжело. Но хозяин лавки на площади видит всех и слышит всё.', en: 'The store is on you now. It is a heavy load. But the shopkeeper on the square sees everyone and hears everything.', emo: 'serious' },
  'd5.v.promise': { who: 'valya', ru: 'Обещание старику — это святое. Держи слово, рыбка.', en: 'A promise to an old man is sacred. Keep your word, little fish.' },
  'd5.l.lesson': { who: 'lyosha', ru: 'Сегодня — циклы. Тяжёлый день, я знаю. Давай сделаем что-нибудь простое и честное.', en: "Tonight: loops. A hard day, I know. Let's do something simple and honest." },
  'd5.n.night': { who: 'nadia', ru: 'Спокойной ночи, Рыбка. Завтра открываемся в девять.', en: 'Good night, Rybka. Tomorrow we open at nine.', emo: 'smile' },

  // ---- Koshkin's herring
  'd5.k.morning': { who: 'koshkin', en: 'Every year I bring the pickled herring. Every year Dolly says it is too salty. Every year it is gone by seven o\'clock.', emo: 'smile' },
  'd5.k.breath': { who: 'koshkin', en: "Carry the jars for me. My knees don't like the hill today. And my chest. Never mind my chest." },
  'd5.k.fine': { who: 'koshkin', en: "I'm eighty-two. I'm never all right. I'm just still here. Go, go, before the halibut is gone." },
  'd5.k.go': { who: 'koshkin', en: "Tell Dolly it's not too salty. Tell her I said so. She'll laugh. It's a tradition.", emo: 'smile' },
  'd5.k.hurt': { who: 'koshkin', en: "Go. Get Ellen. I'm not going anywhere. That's the problem.", emo: 'worry' },
  'd5.k.idle': { who: 'koshkin', en: "Go on, go to the fry. I'll come later. Maybe. Somebody has to mind the store." },

  // ---- the fish fry
  'd5.g.grace': { who: 'gabriel', en: "Friends! Before Hank burns anything else, let us give thanks. For the fish, for the hands that caught it, and for the hands that fried it. Mostly Dolly's. Amen.", emo: 'smile' },
  'd5.f.amen': { who: 'm3', name: 'A fisherman', en: 'Amen! Pass the tartar sauce!' },
  'd5.wt.toast': { who: 'walt', en: "And thanks to Northstar for the new fryer! Gideon couldn't make it, but he sends his regards." },
  'd5.ra.heckle': { who: 'ray', en: 'Tell Gideon his regards are a little greasy.', emo: 'smile' },
  'd5.f.laugh': { who: 'f1', name: 'A neighbour', en: 'Oh, Ray!' },
  'd5.d.serve': { who: 'dolly', en: "Fish is up! Halibut on the left, cod on the right, and Sasha's herring is too salty, as usual!", emo: 'laugh' },
  'd5.d.where': { who: 'dolly', en: 'Where is Sasha, anyway? Thirty years he has carried those jars in here himself.', emo: 'worry' },

  // ---- the council's troubles
  'd5.d.pre': { who: 'dolly', en: "Fish fry at noon! I've been battering halibut since five this morning. My arms are going to fall off. Come hungry." },
  'd5.d.t0': { who: 'dolly', en: 'Grab a plate, honey, before Hank eats it all. Can I tell you something? Come here.' },
  'd5.d.t1': { who: 'dolly', en: 'The diner is in trouble. Since that glass box opened, half my morning crowd gets free coffee over there instead.', emo: 'worry' },
  'd5.d.t2': { who: 'dolly', en: "And it's worse than coffee. Northstar has its hooks in me somewhere I can't pull them out. Come by some quiet morning, and I'll tell you the rest.", emo: 'worry' },
  'd5.d.help': { who: 'dolly', en: "Bless you. Come when it's quiet. I'll feed you till you can't move.", emo: 'smile' },
  'd5.d.never': { who: 'dolly', en: "Earl proposed to me in booth three. I'd sooner sell my own teeth. But teeth don't pay the bank." },
  'd5.h.pre': { who: 'hank', en: "I'm on fryer duty at noon. Every year. Nobody asks. They just hand me the apron." },
  'd5.h.t0': { who: 'hank', en: "Don't touch the fryer. It's older than both of us and meaner. You want to know my trouble? Fine." },
  'd5.h.t1': { who: 'hank', en: "Heating oil. Northstar's selling it so cheap I can't figure how they even get it up here. Something stinks, and it isn't the fryer.", emo: 'frown' },
  'd5.h.t2': { who: 'hank', en: "When the school boiler quits at three in the morning, who do they call? Me. Not a call centre in Seattle. Ask me again when I'm not holding a fry basket." },
  'd5.h.prove': { who: 'hank', en: "Ha. You sound like Ruth. Fine. Come by the store sometime. Bring your nose.", emo: 'smile' },
  'd5.h.match': { who: 'hank', en: "Match a company that prints its own money? No. But Northstar can't be at the school at three in the morning. I can." },
  'd5.r.pre': { who: 'ruth', en: 'Noon, at the parish hall. Sit with me. The young people talk too loud.' },
  'd5.r.t0': { who: 'ruth', en: 'Sit with me a minute. My knees and I have opinions about standing.', emo: 'smile' },
  'd5.r.t1': { who: 'ruth', en: "The children in this town know Northstar's app better than they know their own great-grandparents. That is my trouble.", emo: 'serious' },
  'd5.r.t2': { who: 'ruth', en: "I have a project for them. But I'm too old to climb into other people's attics. Come and see me some afternoon. I'll put you to work." },
  'd5.r.fix': { who: 'ruth', en: "Good. I'll hold you to it. I hold everybody to things. It's the teacher in me.", emo: 'smile' },
  'd5.r.matter': { who: 'ruth', en: "History, dear. The kind you can hold in your hands. Come and see me, and I'll show you." },
  'd5.ra.pre': { who: 'ray', en: 'Fish fry tonight. My one night off from fish. Ha. Ha.' },
  'd5.ra.t0': { who: 'ray', en: "Free beer, cold fish, and the whole town pretending they like each other. My favourite night of the year. I'm not even being sarcastic." },
  'd5.ra.t1': { who: 'ray', en: "Trouble? Northstar's buying into the cannery. Officially it's a partnership. And the company in Seattle wants names. People I've known since they were kids.", emo: 'frown' },
  'd5.ra.t2': { who: 'ray', en: "And they want me smiling on that council, voting for cameras. I'm about done, I'll tell you that." },
  'd5.ra.stay': { who: 'ray', en: 'The town needs a lot of things. Mostly a new cannery manager and a decent darts partner.' },
  'd5.ra.what': { who: 'ray', en: "Some sign that somebody up here still gives a damn. You find me that, and I'll stay." },
  'd5.ly.pre': { who: 'lyle', en: "See you at the fry! I'll be the one shaking hands. I'm always the one shaking hands.", emo: 'smile' },
  'd5.ly.t0': { who: 'lyle', en: "Our handyman! Great fish. Terrible fryer. Northstar donated it, so I'm obliged to say it's wonderful. Ha. Kidding.", emo: 'smile' },
  'd5.ly.t1': { who: 'lyle', en: "Can I be honest? Don't tell anyone. Northstar's going to give away home insurance with the smart meters. Free. I sell home insurance. Do the math.", emo: 'worry' },
  'd5.ly.t2': { who: 'lyle', en: "They pay me to support them, and they're putting me out of business. Everybody thinks I'm their guy. I'm their mark." },
  'd5.ly.stop': { who: 'lyle', en: "Stop? Ha. You don't stop. You smile and you wait to be mayor, and then maybe you get to say no to somebody." },
  'd5.d.post': { who: 'dolly', en: "Eat, honey. You look like a strong wind would carry you off." },
  'd5.h.post': { who: 'hank', en: 'I said what I said. Now let me fry.' },
  'd5.r.post': { who: 'ruth', en: 'Go on, mingle. Old women are for the end of the evening.', emo: 'smile' },
  'd5.ra.post': { who: 'ray', en: 'Go win me a raffle ticket or something.' },
  'd5.ly.post': { who: 'lyle', en: "Forget what I said. Or don't. Have some cod." },
  'd5.ly.why': { who: 'lyle', en: "Because you're new. You don't count yet. No offence. It's nice to say it out loud to somebody who doesn't count." },

  // ---- also at the fry
  'd5.p.fry': { who: 'pearl', en: "Gideon's car went up the hill at two in the morning. Again. I know because Mrs. Ivanoff can't sleep, and when she can't sleep, I can't sleep." },
  'd5.wt.fry': { who: 'walt', en: "Gideon wants me to remind everybody about their emergency envelopes. Dolly says hers is in the pie safe. I said, Dolly, that's not a safe, it's a cupboard.", emo: 'laugh' },
  'd5.wd.fry': { who: 'wade', en: "Dolly's halibut. Worth flying four hundred miles for. I would know. I've done it.", emo: 'smile' },
  'd5.t.fry': { who: 'tommy', en: "Tomorrow. Three o'clock. Loon Lake. You're coming, right? I need somebody to beat who isn't my cousin.", emo: 'smile' },
  'd5.ni.fry': { who: 'nina', en: "I'm recording the fry for the Saturday show. So far I've got forty minutes of chewing and one argument about tartar sauce. Riveting radio." },
  'd5.el.fry': { who: 'ellen', en: "Mrs. Ivanoff ate four pieces of halibut and then asked me about her cholesterol. I said, Agnes, it's Friday.", emo: 'smile' },
  'd5.g.fry': { who: 'gabriel', en: 'Eat, eat. Hunger is the only sin I can forgive with a fork.', emo: 'smile' },
  'd5.lo.fry': { who: 'lou', en: "I closed the Anchor for the fry. Best part is I don't have to listen to Ray. Oh, wait. He's here." },
  'd5.m.fry': { who: 'marta', en: 'Fish fry. The whole town in one room. My nightmare and my favourite night, both.' },
  'd5.e.hello': { who: 'evan', en: 'Fish fry at the parish hall! So charming. Northstar donated the fryer, you know. We just love community.', emo: 'smile' },
  'd5.gi.hello': { who: 'gideon', en: 'Not at the fish fry? I avoid fried food. And community events. I support them, of course. From a distance.', emo: 'smile' },

  // ---- closing time
  'd5.el.sasha': { who: 'ellen', en: "Have you seen Sasha? He didn't come. Thirty years he's never missed a fry. Would you check on him? I have to see to Mrs. Ivanoff's blood pressure.", emo: 'worry' },
  'd5.k.there': { who: 'koshkin', en: 'There you are. Help me with this box. Somebody ordered forty pounds of flour and then moved to Anchorage. Same as dying, Anchorage.' },
  'd5.k.pain': { who: 'koshkin', en: "Wait. Wait a moment. My arm. Funny. It's very heavy, this arm.", emo: 'worry' },
  'd5.k.pills': { who: 'koshkin', en: "Under the register. The orange bottle. One under the tongue, Ellen says. Don't look at me like that. Go. Go!", emo: 'worry' },
  'd5.k.sit': { who: 'koshkin', en: "Ellen. Yes. Go. I'll sit. I'm very good at sitting." },
  'd5.el.what': { who: 'ellen', en: "What is it? Sasha? Oh, God. Go, go, I'm right behind you. Keep him sitting up!", emo: 'worry' },
  'd5.el.check': { who: 'ellen', en: 'Sasha. Sasha, look at me. Good. Squeeze my hand. Good. You stubborn old goat, I told you.', emo: 'worry' },
  'd5.el.nome': { who: 'ellen', en: 'It is his heart. I can keep him stable, but he needs a hospital tonight. Nome. Somebody get Wade. Now.', emo: 'serious' },
  'd5.wd.go': { who: 'wade', en: "Koshkin? I'm on it. Plane's fuelled. Bring him to the strip, I'll have her warm. Go, go!", emo: 'serious' },
  'd5.k.keys': { who: 'koshkin', en: 'Come here. Take these. The store keys. The back door sticks. You kick it low, on the left.' },
  'd5.k.open': { who: 'koshkin', en: "Keep it open. Don't let that glass box win. You hear me? Not one day closed.", emo: 'serious' },
  'd5.k.wait': { who: 'koshkin', en: 'Nothing waits. Not in this town. Promise me.' },
  'd5.k.promise': { who: 'koshkin', en: "Good. Good. My grandfather would have liked you. He didn't like anybody.", emo: 'smile' },
  'd5.el.carry': { who: 'ellen', en: "All right, Sasha, we're going for a ride. Easy now. On three." },

  // ---- the evening after
  'd5.d.after': { who: 'dolly', en: "Poor Sasha. I've got soup on for when he's back. And for you. Eat something, honey.", emo: 'worry' },
  'd5.h.after': { who: 'hank', en: 'Heard about Koshkin. Hell of a thing. You need anything for that store, you come to me. Wholesale.' },
  'd5.ra.after': { who: 'ray', en: "Koshkin. Damn. He gave my dad credit for a whole winter in eighty-two. Here's to him." },
  'd5.ly.after': { who: 'lyle', en: "Terrible about Mr. Koshkin. Just terrible. If the family ever needs help with the property, you'll let me know, won't you?" },
  'd5.lo.after': { who: 'lou', en: 'Next round is for Sasha Koshkin. Nobody argue.' },
  'd5.wd.after': { who: 'wade', en: "He held my hand the whole flight and told me I fly like a drunk goose. He's going to be fine." },
};

// Who stands where at the fry (Parish Hall, its own frame: stage to the north, door to the south).
const FRY = [
  ['gabriel', 'hall.podium'], ['dolly', 'hall.kitchenPass'], ['hank', 'hall.kitchen'], ['lyle', 'hall.coffee'],
  ['ruth', [-3.4, 1.6]], ['ray', [3.9, 4.0]], ['walt', [0.4, 0.3]], ['pearl', [-3.6, 4.4]],
  ['wade', 'hall.bulletinBoard'], ['tommy', [1.6, 6.2]], ['nina', [-1.2, 6.6]], ['ellen', [0.4, 3.0]],
];
const COUNCIL = ['dolly', 'hank', 'ruth', 'ray', 'lyle'];
const fryAt = (G, w) => (typeof w === 'string' ? at(G, w) : local(G, 'hall', w[0], w[1], Math.PI));
const talked = (m) => COUNCIL.filter((id) => m.flag('d5.t.' + id)).length;

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd5.morning': {
    title: 'Friday', main: true, day: 5,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Help Koshkin with his fish fry herring';
        m.obj(text, 'koshkin.counter', "Koshkin's, on the square");
        m.ears(['d5.n.morning', 'd5.l.morning']);
        await hold(m, () => !!m.flag('d5.k.herring'), text, 'koshkin.counter');
      }
      if (m.cp(2, from)) {
        const text = "Carry Koshkin's herring to the Parish Hall";
        m.obj(text, 'hall.door', 'The fish fry starts at noon');
        let early = false;
        await hold(m, () => {
          const there = dist(G, 'hall') < 16;
          if (there && !early && s.hour < 11.5 && s.hour > 5) { early = true; m.ear('d5.n.early'); }
          return there && (s.hour >= 11.5 || s.hour < 5);
        }, text, 'hall.door');
        m.done();
        m.start('d5.fry');
      }
    },
  },

  'd5.fry': {
    title: 'Fish Fry', main: true, day: 5,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        m.obj('Go in — the fish fry', 'hall.door_in');
        await m.until(() => dist(G, 'hall.tables') < 9);
        s.inv.herring = 0;
        await m.scene(async (d) => {
          d.cam(shot(G, local(G, 'hall', 0.4, 8.2), 2.6, local(G, 'hall', 0.4, -6.5), 1.6, 52)); // from the door, toward the stage
          await d.bring('player', local(G, 'hall', 0.4, 5.2, Math.PI));
          for (const [id, w] of FRY) await d.bring(id, fryAt(G, w));
          G.sfx?.crowd?.(0.4);
          await d.wait(1.4);
          G.sfx?.crowd?.(0.12);
          await d.say('gabriel', 'd5.g.grace', { cam: cu(d, 'gabriel') });
          await d.say('m3', 'd5.f.amen');
          await d.say('walt', 'd5.wt.toast', { cam: cu(d, 'walt') });
          await d.say('ray', 'd5.ra.heckle', { cam: cu(d, 'ray') });
          await d.say('f1', 'd5.f.laugh');
          await d.say('dolly', 'd5.d.serve', { cam: cu(d, 'dolly') });
          await d.say('dolly', 'd5.d.where', { cam: cu(d, 'dolly', { side: -1 }) });
          await d.you("He said he'd come later. He didn't look well.");
        });
        G.sfx?.crowd?.(0.3);
        m.flag('d5.fry.on', true);
      }
      if (m.cp(2, from)) {
        for (const [id, w] of FRY) place(G, id, fryAt(G, w));
        m.flag('d5.fry.on', true);
        m.ear('d5.n.fry');
        let shown = -1;
        await m.until(() => {
          const n = talked(m);
          if (n >= 5) return true;
          if (n !== shown || !G.hud?.objective) {
            shown = n;
            const next = COUNCIL.filter((id) => !m.flag('d5.t.' + id)).sort((a, b) => dist(G, a) - dist(G, b))[0];
            const npc = G.npcs?.get?.(next);
            m.obj(`Hear out the council — ${n} of 5`, npc?.pos ? { x: npc.pos.x, z: npc.pos.z } : 'hall.tables', 'Dolly, Hank, Ruth, Ray, Lyle');
          }
          return false;
        });
        m.flag('d5.fry.on', false);
        G.sfx?.crowd?.(0);
        await m.ears(['d5.n.five', 'd5.dm.honest']);
      }
      if (m.cp(3, from)) {
        // Ellen, worried about Sasha
        await m.scene(async (d) => {
          await d.bring('ellen', at(G, 'hall.tables', 0.4, 1.0));
          await d.say('ellen', 'd5.el.sasha', { cam: cu(d, 'ellen') });
        });
        release(G, ...FRY.map(([id]) => id));
        m.done();
        m.start('d5.closing');
      }
    },
  },

  'd5.closing': {
    title: 'Closing Time', main: true, day: 5,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        warp(G, 'koshkin', at(G, 'koshkin.clerk'));
        const text = 'Check on Koshkin at the store';
        m.obj(text, 'koshkin.door', 'Church Square');
        await hold(m, () => dist(G, 'koshkin.counter') < 3.5, text, 'koshkin.door');
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.bring('player', at(G, 'koshkin.counter'));
          await d.bring('koshkin', at(G, 'koshkin.clerk'));
          await d.say('koshkin', 'd5.k.there', { cam: cu(d, 'koshkin') });
          await d.wait(0.6);
          await d.say('koshkin', 'd5.k.pain', { cam: cu(d, 'koshkin', { dist: 0.6 }) });
          await d.bring('koshkin', at(G, 'koshkin.stove'), { sit: true });
          const k = await d.choose(["Sasha! Sit down — I'll get Doc Ellen!", 'Where are your pills?']);
          await d.say('koshkin', k === 1 ? 'd5.k.pills' : 'd5.k.sit', { cam: cu(d, 'koshkin') });
          await d.say('nadia', 'd5.n.run', { radio: true });
        });
        warp(G, 'koshkin', at(G, 'koshkin.stove'), 'sit');
        m.flag('d5.collapse', true);
      }
      if (m.cp(3, from)) {
        warp(G, 'ellen', at(G, 'clinic.door'));
        const text = 'Get Doc Ellen — the clinic!';
        m.obj(text, 'clinic.door', 'Run');
        await hold(m, () => !!m.flag('d5.ellenComing'), text, 'clinic.door');
        const e = place(G, 'ellen', at(G, 'koshkin.counter', 0.8, 0));
        if (e) e.run = true;
        m.obj('Back to the store', 'koshkin.counter');
        await m.until(() => dist(G, 'koshkin.counter') < 4);
      }
      if (m.cp(4, from)) {
        await m.scene(async (d) => {
          await d.bring('koshkin', at(G, 'koshkin.stove'), { sit: true });
          await d.bring('ellen', at(G, 'koshkin.stove', 0, 0.9));
          await d.bring('player', at(G, 'koshkin.counter'));
          await d.say('ellen', 'd5.el.check', { cam: cu(d, 'ellen') });
          await d.say('ellen', 'd5.el.nome', { cam: cu(d, 'ellen', { side: -1 }) });
          await d.say('nadia', 'd5.n.wade', { radio: true });
        });
        warp(G, 'koshkin', at(G, 'koshkin.stove'), 'sit');
        warp(G, 'ellen', at(G, 'koshkin.stove', 0, 0.9));
        warp(G, 'wade', at(G, 'diner.door'));
        m.flag('d5.needWade', true);
        const text = 'Find Wade — the diner';
        m.obj(text, 'diner.door', 'Front Street');
        await hold(m, () => !!m.flag('d5.wadeGo'), text, 'diner.door');
        place(G, 'wade', at(G, 'koshkin.door'));
        m.obj('Back to Koshkin', 'koshkin.counter');
        await m.until(() => dist(G, 'koshkin.counter') < 4);
      }
      if (m.cp(5, from)) {
        await m.scene(async (d) => {
          await d.bring('koshkin', at(G, 'koshkin.stove'), { sit: true });
          await d.bring('ellen', at(G, 'koshkin.stove', 0, 0.9));
          await d.bring('wade', at(G, 'koshkin.door_in'));
          await d.bring('player', at(G, 'koshkin.stove', 0.9, 0.5));
          await d.say('koshkin', 'd5.k.keys', { cam: cu(d, 'koshkin', { dist: 0.65 }) });
          await d.say('koshkin', 'd5.k.open');
          const k = await d.choose(["I'll keep it open. I promise.", 'Sasha, the store can wait.']);
          if (k === 1) {
            await d.say('koshkin', 'd5.k.wait', { cam: cu(d, 'koshkin') });
            await d.you('All right. I promise.');
          }
          await d.say('koshkin', 'd5.k.promise', { cam: cu(d, 'koshkin', { side: -1 }) });
          await d.say('ellen', 'd5.el.carry', { cam: cu(d, 'ellen') });
        });
        s.inv.store_keys = 1;
        G.hud?.toast?.('ITEM', "Koshkin's store keys");
        m.flag('koshkinPromise', true);
        m.flag('koshkinHospital', true);
        m.flag('runStore', true);
        release(G, 'koshkin', 'ellen', 'wade');
        const f = G.fadeTeleport?.({ x: G.player.pos.x, z: G.player.pos.z, yaw: G.player.yaw }, 2.4);
        G.sfx?.engineStart?.();
        await f;
        G.hud?.toast?.('NOME', "Wade's plane lifts off over the strait with Koshkin and Doc Ellen aboard.", '#9fd0ff');
        rel(G, 'koshkin', 10);
      }
      if (m.cp(6, from)) {
        await m.ears(['d5.n.sorry', 'd5.dm.store', 'd5.v.promise']);
        m.ear('d5.l.lesson');
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop');
        await hold(m, () => !!s.lessons.l05, text, 'cabin.laptop');
        await m.ear('d5.n.night');
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
// One council member's trouble at the fry: opener, the trouble, a choice, a reply.
function trouble(id, lines, afterLine) {
  return async (c, prev) => {
    if (c.day !== 5) return prev(c);
    if (c.flag('d5.fry.on') && !c.flag('d5.t.' + id)) {
      await c.say(id, lines.t0);
      await c.say(id, lines.t1);
      await c.say(id, lines.t2);
      const k = await c.choose(lines.choices);
      await c.say(id, k === 0 ? lines.a : lines.b);
      c.rel(k === 0 ? 8 : 6);
      c.flag(`q.${id}.open`, true);
      c.flag(`q.${id}.how`, k === 0 ? 'help' : 'ask');
      c.flag('d5.t.' + id, true);
      if (lines.ear) c.G.missions.ear(lines.ear);
      c.emit('talk:' + id);
      return;
    }
    if (c.flag('koshkinHospital') && afterLine && !c.flag(`d5.${id}.after`)) { c.flag(`d5.${id}.after`, true); await c.say(id, afterLine); return; }
    if (!c.flag('d5.t.' + id) && !c.flag(`d5.${id}.pre`)) { c.flag(`d5.${id}.pre`, true); await c.say(id, lines.pre); return; }
    const talkedToday = c.flag('d5.t.' + id);
    return idle(c, prev, id, afterLine && c.flag('koshkinHospital') ? afterLine : talkedToday ? lines.post : lines.pre);
  };
}

export const DIALOG = {
  dolly: trouble('dolly', {
    pre: 'd5.d.pre', post: 'd5.d.post', t0: 'd5.d.t0', t1: 'd5.d.t1', t2: 'd5.d.t2',
    choices: ["I'll come by. Whatever it is, we'll figure it out.", "You'd never sell, would you?"], a: 'd5.d.help', b: 'd5.d.never',
  }, 'd5.d.after'),
  hank: trouble('hank', {
    pre: 'd5.h.pre', post: 'd5.h.post', t0: 'd5.h.t0', t1: 'd5.h.t1', t2: 'd5.h.t2',
    choices: ["Then let's find out what stinks.", "Can't you just match their price?"], a: 'd5.h.prove', b: 'd5.h.match',
  }, 'd5.h.after'),
  ruth: trouble('ruth', {
    pre: 'd5.r.pre', post: 'd5.r.post', t0: 'd5.r.t0', t1: 'd5.r.t1', t2: 'd5.r.t2',
    choices: ["I'd be glad to help.", 'What kind of project?'], a: 'd5.r.fix', b: 'd5.r.matter',
  }, null),
  ray: trouble('ray', {
    pre: 'd5.ra.pre', post: 'd5.ra.post', t0: 'd5.ra.t0', t1: 'd5.ra.t1', t2: 'd5.ra.t2',
    choices: ["Don't quit. The town needs you.", 'What would make you stay?'], a: 'd5.ra.stay', b: 'd5.ra.what', ear: 'd5.n.ray',
  }, 'd5.ra.after'),
  lyle: trouble('lyle', {
    pre: 'd5.ly.pre', post: 'd5.ly.post', t0: 'd5.ly.t0', t1: 'd5.ly.t1', t2: 'd5.ly.t2',
    choices: ['Then stop supporting them.', 'Why are you telling me this?'], a: 'd5.ly.stop', b: 'd5.ly.why', ear: 'd5.n.lyle',
  }, 'd5.ly.after'),

  koshkin: async (c, prev) => {
    if (c.day !== 5) return prev(c);
    if (!c.flag('d5.k.herring')) {
      await c.say('koshkin', 'd5.k.morning');
      await c.say('koshkin', 'd5.k.breath');
      const k = await c.choose(['Sasha, are you all right?', "Of course. I'll take them."]);
      if (k === 0) { await c.say('koshkin', 'd5.k.fine'); c.rel(4); }
      await c.say('koshkin', 'd5.k.go');
      c.give('herring');
      c.flag('d5.k.herring', true);
      c.emit('talk:koshkin');
      return;
    }
    if (c.flag('d5.collapse') && !c.flag('koshkinHospital')) { await c.say('koshkin', 'd5.k.hurt'); return; }
    return idle(c, prev, 'koshkin', 'd5.k.idle');
  },

  ellen: async (c, prev) => {
    if (c.day !== 5) return prev(c);
    if (c.flag('d5.collapse') && !c.flag('d5.ellenComing')) {
      await c.say('ellen', 'd5.el.what');
      c.flag('d5.ellenComing', true);
      c.emit('talk:ellen');
      return;
    }
    if (c.flag('d5.fry.on') && !c.flag('d5.el.fried')) { c.flag('d5.el.fried', true); await c.say('ellen', 'd5.el.fry'); return; }
    return idle(c, prev, 'ellen', 'd5.el.fry');
  },

  wade: async (c, prev) => {
    if (c.day !== 5) return prev(c);
    if (c.flag('d5.needWade') && !c.flag('d5.wadeGo')) {
      await c.say('wade', 'd5.wd.go');
      c.rel(6);
      c.flag('d5.wadeGo', true);
      c.emit('talk:wade');
      return;
    }
    return idle(c, prev, 'wade', c.flag('koshkinHospital') ? 'd5.wd.after' : 'd5.wd.fry');
  },

  pearl: async (c, prev) => (c.day === 5 ? idle(c, prev, 'pearl', 'd5.p.fry') : prev(c)),
  walt: async (c, prev) => (c.day === 5 ? idle(c, prev, 'walt', 'd5.wt.fry') : prev(c)),
  tommy: async (c, prev) => (c.day === 5 ? idle(c, prev, 'tommy', 'd5.t.fry') : prev(c)),
  nina: async (c, prev) => (c.day === 5 ? idle(c, prev, 'nina', 'd5.ni.fry') : prev(c)),
  gabriel: async (c, prev) => (c.day === 5 ? idle(c, prev, 'gabriel', 'd5.g.fry') : prev(c)),
  lou: async (c, prev) => (c.day === 5 ? idle(c, prev, 'lou', c.flag('koshkinHospital') ? 'd5.lo.after' : 'd5.lo.fry') : prev(c)),
  marta: async (c, prev) => (c.day === 5 ? idle(c, prev, 'marta', 'd5.m.fry') : prev(c)),
  evan: async (c, prev) => (c.day === 5 ? idle(c, prev, 'evan', 'd5.e.hello') : prev(c)),
  gideon: async (c, prev) => (c.day === 5 ? idle(c, prev, 'gideon', 'd5.gi.hello') : prev(c)),
};

export const DIALOG_OVERRIDE = true;
