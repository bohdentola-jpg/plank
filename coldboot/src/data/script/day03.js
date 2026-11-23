// DAY 3 — The Fixer (Wednesday). Pearl's job board at the post office: three
// small paid repairs around town (any two finish the day's work). At night,
// Rybka tails Gideon Shaw from City Hall up the Kettle Hill road to a Northstar
// turnout and overhears him ask who sent "the carpenter". On the way back, a
// man in a grey parka is watching from a parked car: Mr. Grey. Optional:
// Wednesday trivia at the Rusty Anchor. Night School lesson 3.
//
// ---------------------------------------------------------------- repairs used
// (REPAIRS are defined in side_town.js; suggested specs below. The CLIENT pays
//  the fee in this script, so leave `pay` out — or the script tops it up only.)
//   r.post.steps  — Pearl's post office front steps: a rotten tread, a loose rail.
//                   building 'post', materials { lumber: 1, nails: 1 }, minigames ['saw', 'hammer'], spirit 4. Fee $40 (Pearl).
//   r.dolly.sign  — the MIDNIGHT SUN DINER sign, hanging by one bolt, half its neon dark.
//                   building 'diner', materials { wire: 1, nails: 1 }, minigames ['wire', 'hammer'], spirit 4. Fee $50 (Dolly).
//   r.clinic.door — Doc Ellen's clinic door: a broken closer and no weatherstrip; it slams.
//                   building 'clinic', materials { nails: 1 }, minigames ['hammer'], spirit 3. Fee $35 (Ellen).
//
// ---------------------------------------------------------------- flags set
//   d3.fixed.steps / d3.fixed.sign / d3.fixed.door   which job-board repairs are done
//   d3.overheard   Rybka heard Shaw order Northstar security to look into "the carpenter"
//   seenGrey       Rybka has seen Mr. Grey in town (his car at the Kettle Hill junction)
//   d3.trivia      'won' | 'lost' (Wednesday trivia at the Rusty Anchor)
import {
  at, flat, yawTo, dist, shot, cu, rel, standing, place, warp, release, ensureNpc, hold, hack, doRepair,
  repairJob, payFee, materials, idle,
} from './day02.js';

export const DAY = { n: 3, start: ['d3.board'], mustFinish: ['d3.board', 'd3.tail'] };

export const LINES = {
  // ---- the earpiece
  'd3.n.morning': { who: 'nadia', ru: 'Сегодня — работа. Настоящая. На почте висит доска объявлений: кому что починить. Чем больше ты чинишь, тем больше дверей перед тобой открывается.', en: 'Today, work. Real work. There is a notice board at the post office: who needs what fixed. The more you fix, the more doors open for you.' },
  'd3.l.morning': { who: 'lyosha', ru: 'А вечером — Гидеон Шоу. Иван говорит, по средам он после работы поднимается на холм. Сегодня как раз среда.', en: 'And tonight, Gideon Shaw. Ivan says on Wednesdays he goes up the hill after work. And today is Wednesday.' },
  'd3.n.mats': { who: 'nadia', ru: 'Не хватает материалов. Список на экране. Всё это есть у Хэнка.', en: "You're short on materials. The list is on your screen. Hank has all of it." },
  'd3.n.job1': { who: 'nadia', ru: 'Один готов. Видишь, как на тебя теперь смотрят? Как на своего.', en: 'That is one. See how people look at you now? Like one of their own.', emo: 'smile' },
  'd3.n.jobs': { who: 'nadia', ru: 'Два заказа — и о тебе уже говорят: «тот плотник, что всё чинит». Лучшего прикрытия не бывает.', en: "Two jobs, and they're already talking about you: 'that carpenter who fixes everything.' There's no better cover.", emo: 'smile' },
  'd3.n.tail1': { who: 'nadia', ru: 'Шоу сегодня засиделся в мэрии. К половине восьмого будь рядом. Только не у самой двери — там камера.', en: "Shaw is working late at City Hall tonight. Be close by half past seven. Just not right by the door — there's a camera." },
  'd3.l.early': { who: 'lyosha', ru: 'Рано. Шоу ещё сидит наверху. Купи себе чаю. Только не у Эвана.', en: "Too early. Shaw's still upstairs. Get yourself some tea. Just not from Evan." },
  'd3.n.tail2': { who: 'nadia', ru: 'Вот он. Выходит. Держись метрах в тридцати. Ближе — заметит, дальше — потеряешь.', en: "There he is. Coming out. Stay about thirty metres back. Closer, he'll notice. Farther, you'll lose him.", emo: 'serious' },
  'd3.l.crouch': { who: 'lyosha', ru: 'И пригнись, если он обернётся. Человек на корточках — это просто человек, который завязывает шнурки.', en: "And crouch if he turns around. Someone crouching is just someone tying their shoelaces." },
  'd3.n.close': { who: 'nadia', ru: 'Слишком близко! Отстань немного.', en: 'Too close! Drop back a little.', emo: 'worry' },
  'd3.n.far': { who: 'nadia', ru: 'Ты его теряешь. Ближе.', en: "You're losing him. Closer." },
  'd3.n.glance': { who: 'nadia', ru: 'Он оборачивается! Пригнись!', en: "He's turning around! Get down!", emo: 'worry' },
  'd3.n.lost': { who: 'nadia', ru: 'Потеряли. Хотя нет — он остановился у дороги, говорит по телефону. Догоняй. Тихо.', en: "We've lost him. No, wait — he's stopped by the road, on his phone. Catch up. Quietly." },
  'd3.n.turnout': { who: 'nadia', ru: 'Он остановился у поворота. Там его кто-то ждёт. Подберись поближе — только не по дороге.', en: "He's stopped at the turnout. Someone's waiting for him. Get closer — but stay off the road.", emo: 'serious' },
  'd3.n.crouch': { who: 'nadia', ru: 'Пригнись. Тебя видно на фоне неба.', en: 'Get down. You stand out against the sky.' },
  'd3.l.mic': { who: 'lyosha', ru: 'Включаю микрофон. Направленный, из моих запасов. Слушай.', en: 'Switching on the mic. Directional, from my private stash. Listen.' },
  'd3.n.heard': { who: 'nadia', ru: 'Слышишь? Это про тебя. Ничего. Новичков всегда проверяют. Просто не давай им повода.', en: "Hear that? That's about you. It's all right. Newcomers always get checked. Just don't give them a reason.", emo: 'serious' },
  'd3.n.stop': { who: 'nadia', ru: 'Дальше не ходи. Там камеры и охрана. На сегодня хватит — возвращайся в город.', en: "Don't go any farther. Cameras and guards up there. That's enough for tonight. Head back to town." },
  'd3.n.grey1': { who: 'nadia', ru: 'Стоп. Не оборачивайся. Впереди, у перекрёстка, машина. Фары выключены, мотор работает.', en: 'Stop. Don’t turn around. Up ahead, by the junction, a car. Lights off, engine running.', emo: 'worry' },
  'd3.n.grey2': { who: 'nadia', ru: 'Серая парка. Это он. Человек из самолёта. Тот, что тебя сфотографировал.', en: "Grey parka. It's him. The man from the plane. The one who took your picture.", emo: 'serious' },
  'd3.l.grey': { who: 'lyosha', ru: 'Номер не читается — весь в снегу. Случайно, конечно. Ага.', en: "Can't read the plate. Caked with snow. By accident, of course. Sure." },
  'd3.n.look': { who: 'nadia', ru: 'Я же сказала — не смотри! Теперь он знает, что ты его видишь.', en: "I said don't look! Now he knows that you see him.", emo: 'angry' },
  'd3.n.grey3': { who: 'nadia', ru: 'Иди мимо. Спокойно. Ты возвращаешься с прогулки. Ничего не замечаешь.', en: "Walk past. Easy. You're coming back from a walk. You notice nothing." },
  'd3.n.grey4': { who: 'nadia', ru: 'Уехал. Он следил за Шоу — или за тобой? Не знаю, что хуже.', en: "He's gone. Was he watching Shaw — or you? I don't know which is worse.", emo: 'worry' },
  'd3.n.lesson': { who: 'nadia', ru: 'Домой, Рыбка. Тебе нужно согреться, а Лёше — поучить.', en: 'Home, Rybka. You need to warm up, and Lyosha needs to teach.' },
  'd3.l.lesson': { who: 'lyosha', ru: 'Сегодня — числа и текст. И f-строки. Звучит страшно, а на деле — как подписать банку с вареньем.', en: "Tonight: numbers and text. And f-strings. Sounds scary; really, it's like labelling a jar of jam.", emo: 'smile' },
  'd3.n.night': { who: 'nadia', ru: 'Сегодня — на совесть. И в городе, и на холме. Спи, Рыбка.', en: 'Solid work today. In town and on the hill. Sleep, Rybka.', emo: 'smile' },
  'd3.n.trivia': { who: 'nadia', ru: 'Викторина? Ну конечно. Только не умничай слишком — плотникам не положено знать всё на свете.', en: "Trivia? Of course. Just don't be too clever — carpenters aren't supposed to know everything." },

  // ---- the turnout (heard through Lyosha's directional microphone)
  'd3.sec.1': { who: 'm2', en: 'Evening, Mr. Shaw. Cold one.' },
  'd3.gi.gate1': { who: 'gideon', en: 'Tell Mr. Halloran the council tabled Phase Two. Aqpik and Moody, as expected. Finch went with them.' },
  'd3.sec.2': { who: 'm2', en: "He won't like that. He wanted it signed before the Gala." },
  'd3.gi.gate2': { who: 'gideon', en: 'It will be. Votes are like ice. You wait for the right temperature.' },
  'd3.gi.gate3': { who: 'gideon', en: "And the carpenter. Koshkin's tenant. Find out who sends a carpenter to the edge of the world in November." },
  'd3.sec.3': { who: 'm2', en: 'Want us to take a look at the cabin?' },
  'd3.gi.gate4': { who: 'gideon', en: 'Not yet. Watch first. People like that always make a mistake, if you give them time.' },

  // ---- Pearl's job board
  'd3.p.board1': { who: 'pearl', en: "Morning, sugar. You want the board? Here's the board. Folks pin up what needs fixing, and I pretend not to read it." },
  'd3.p.board2': { who: 'pearl', en: "My own front steps, for one. Somebody's going to break a hip. Dolly's sign has hung by one bolt since October. And Doc Ellen's door slams like a gunshot." },
  'd3.p.board3': { who: 'pearl', en: 'Forty from me, fifty from Dolly, thirty-five from Doc. Cash. Nobody up here trusts the bank. Well, except Lyle.' },
  'd3.p.mats': { who: 'pearl', en: "Hank's, where else. Tell him Pearl sent you, and he'll charge you the same as everybody else. Hank doesn't do favours. That's his favour." },
  'd3.p.go': { who: 'pearl', en: 'Go on. And knock the snow off your boots before you come back in here.', emo: 'smile' },
  'd3.p.thanks': { who: 'pearl', en: 'Look at those steps. I could dance on them. I won’t. But I could.', emo: 'laugh' },
  'd3.p.idle': { who: 'pearl', en: 'The board always has more. This town is held together with string and good intentions.' },

  // ---- the clients
  'd3.d.hello': { who: 'dolly', en: "My sign! Pearl says you're on it. Bless you. Every time the wind blows, I hear it swinging, and I think, there goes the neighbourhood." },
  'd3.d.thanks': { who: 'dolly', en: "Look at that! Straight as a church pew and lit up like Christmas. That's your money, and here's a slice. Don't argue.", emo: 'laugh' },
  'd3.d.vote': { who: 'dolly', en: 'You know why I voted to table it, honey? Because Ruth looked at me. Forty years she has been looking at me like that.' },
  'd3.d.idle': { who: 'dolly', en: "Wednesday's meatloaf day. Nobody knows why. It's always been meatloaf day." },
  'd3.el.door': { who: 'ellen', en: 'Pearl sent you? Thank God. That door slams so hard my patients think it is their heart.' },
  'd3.el.thanks': { who: 'ellen', en: 'Silence. Beautiful silence. And if you see Sasha Koshkin, tell him pills don’t work from inside the bottle.', emo: 'smile' },
  'd3.el.idle': { who: 'ellen', en: "Half my patients this week are bruised tailbones. Ice. It's always the ice." },

  // ---- Koshkin heard about the meeting
  'd3.k.cams': { who: 'koshkin', en: 'You asked Gideon about the cameras? In front of everybody? Ha! My grandfather would have bought you a drink.', emo: 'laugh' },
  'd3.k.fix': { who: 'koshkin', en: 'Hank says you stood up and talked sense. Hank never says anybody talks sense. I am worried about him.', emo: 'smile' },
  'd3.k.yes': { who: 'koshkin', en: "'Sounds great,' you said? Hm. Well. Young people like free things. I was young once. Around nineteen sixty." },
  'd3.k.none': { who: 'koshkin', en: 'Pearl says you sat in the back like a mouse. Good. Smart mice live longer.' },
  'd3.k.idle': { who: 'koshkin', en: "Pearl's board, eh? Good. Fix the town and the town feeds you. That's how it worked when I was a boy." },

  // ---- around town
  'd3.h.fix': { who: 'hank', en: "That thing you said last night. Free things break. I've been saying that for twenty years and nobody listened. Here. Box of nails. Don't get used to it." },
  'd3.h.jobs': { who: 'hank', en: "Pearl's board, huh? Lumber's twelve, nails four, wire eight. I don't haggle and I don't gift-wrap." },
  'd3.h.idle': { who: 'hank', en: 'Measure twice, cut once, and buy your nails from me.' },
  'd3.r.cams': { who: 'ruth', en: 'You asked about the cameras. Good. Somebody had to, and I was tired of being the only one.', emo: 'smile' },
  'd3.r.yes': { who: 'ruth', en: "'Sounds great.' Hm. I've heard that before. From people who left when it stopped sounding great.", emo: 'frown' },
  'd3.r.hello': { who: 'ruth', en: 'Did you notice, at the meeting? Gideon never once said who owns the data. Not once in forty pages.' },
  'd3.r.idle': { who: 'ruth', en: 'Fix things for people and they tell you their stories. Listen to the stories. That is the real pay.' },
  'd3.ra.hello': { who: 'ray', en: "Back again? You're either lonely or you're a cop. Either way, the beer's the same." },
  'd3.ra.again': { who: 'ray', en: "Thanks for listening last night. Don't spread it around. A guy's allowed to grumble." },
  'd3.ly.yes': { who: 'lyle', en: "My favourite new resident! 'Sounds great.' I've been quoting you all morning.", emo: 'smile' },
  'd3.ly.cold': { who: 'lyle', en: "Lovely meeting. Shame about the tabling. Some people are afraid of progress. You're not one of those, are you?" },
  'd3.ly.idle': { who: 'lyle', en: 'Lunch at the Northstar café sometime? My treat. Well, their treat, technically. Northstar validates.', emo: 'smile' },
  'd3.wt.hello': { who: 'walt', en: "Long night last night. Gideon wasn't happy. When Gideon isn't happy, nobody upstairs is happy. And I don't even know who's upstairs.", emo: 'worry' },
  'd3.gi.hello': { who: 'gideon', en: "I hear you're good with your hands. Pearl's board, Dolly's sign. Very civic. Northstar always needs good hands.", emo: 'smile' },
  'd3.gi.cams': { who: 'gideon', en: 'I owe you a copy of our privacy policy. I’ll have it sent to the cabin. Shore Road, isn’t it?', emo: 'smile' },
  'd3.e.hello': { who: 'evan', en: 'Hey, it’s the town fixer! I saw you up a ladder at the diner. Everybody saw. Our cameras love an action shot!', emo: 'smile' },
  'd3.m.hello': { who: 'marta', en: 'Working the job board? Good. Idle hands make me nervous. Busy ones too, honestly.' },
  'd3.ni.cams': { who: 'nina', en: "You're famous. I played your question on the morning show. Gideon's face when you asked it. Oh my God. Radio can't show faces. Tragic.", emo: 'laugh' },
  'd3.ni.fix': { who: 'nina', en: 'I played your bit about free things breaking. Hank called in to agree. Hank has never called in. Ever.', emo: 'smile' },
  'd3.ni.other': { who: 'nina', en: 'Did you catch the broadcast? Six listeners. Seven, if you count my mom twice.' },
  'd3.t.hello': { who: 'tommy', en: "Saturday. Loon Lake. Three o'clock. I'm telling everybody, so when I win there are witnesses.", emo: 'smile' },
  'd3.wd.hello': { who: 'wade', en: "Nome run tomorrow. Need anything flown in? I don't ask what's in the box. That's my whole business model.", emo: 'smile' },
  'd3.g.hello': { who: 'gabriel', en: 'Vespers at six, if you need some quiet. Or chess on Sunday, if you need some humility.', emo: 'smile' },

  // ---- Wednesday trivia at the Rusty Anchor
  'd3.lo.trivia': { who: 'lou', en: "Trivia's tonight at nine. Five bucks to play, winner takes the pot. Ray's been losing since nineteen ninety-eight. You in?" },
  'd3.lo.lastcall': { who: 'lou', en: 'Last call for trivia. Five bucks. Ray needs somebody to beat.' },
  'd3.lo.early': { who: 'lou', en: "Not yet. Nine o'clock. Grab a stool and try to look smart." },
  'd3.lo.q0': { who: 'lou', en: 'Okay, quiet, you animals. Trivia night. Four questions. The newcomer is playing, so be nice. Ray, that means you.' },
  'd3.lo.q1': { who: 'lou', en: 'Question one. What year was Port Zarya founded?' },
  'd3.lo.q2': { who: 'lou', en: "Question two. What year did old Koshkin's grandfather open the store?" },
  'd3.lo.q3': { who: 'lou', en: 'Question three. What frequency is KZRY? Nina will know if you get it wrong.' },
  'd3.lo.q4': { who: 'lou', en: 'Last one. How many people live in Port Zarya, give or take a moose?' },
  'd3.lo.right': { who: 'lou', en: 'Correct. Somebody give this one a cookie.' },
  'd3.lo.wrong': { who: 'lou', en: 'Wrong! Ray, stop laughing, you got it wrong too.' },
  'd3.ra.heckle': { who: 'ray', en: 'Ask how many people still work at the cannery. Nobody knows that. Not even the cannery.' },
  'd3.lo.win': { who: 'lou', en: 'The newcomer takes the pot! Ray, close your mouth, you’ll catch flies.', emo: 'laugh' },
  'd3.lo.ok': { who: 'lou', en: "Not bad for a first night. Ray wins, somehow. Don't ask me how." },
  'd3.ra.won': { who: 'ray', en: 'Ha! Twelve years I have been losing to Hank. He goes home early one time, and look at that.', emo: 'laugh' },
  'd3.lo.over': { who: 'lou', en: 'Trivia’s done for tonight, friend. Next Wednesday. Bring a brain.' },
  'd3.lo.idle': { who: 'lou', en: 'Wednesday. Trivia night. The only night Ray smiles, and only when he wins.' },
};

// The three jobs on Pearl's board.
const JOBS = [
  { key: 'steps', id: 'r.post.steps', where: 'post.door', prompt: 'Fix the post office steps', short: 'the post office steps', title: 'NEW TREAD FOR THE POST OFFICE STEPS', games: ['saw', 'hammer'], fee: 40, who: 'Pearl', client: 'pearl' },
  { key: 'sign', id: 'r.dolly.sign', where: 'diner.door', prompt: "Rehang the diner's sign", short: "Dolly's sign", title: 'REHANG THE MIDNIGHT SUN SIGN', games: ['wire', 'hammer'], fee: 50, who: 'Dolly', client: 'dolly' },
  { key: 'door', id: 'r.clinic.door', where: 'clinic.door', prompt: 'Fix the clinic door', short: "Doc Ellen's door", title: 'A NEW CLOSER FOR THE CLINIC DOOR', games: ['hammer'], fee: 35, who: 'Doc Ellen', client: 'ellen' },
];
const isFixed = (m, j) => !!m.flag('d3.fixed.' + j.key);

// Shaw's walk from City Hall to the Northstar turnout on the Kettle Hill road.
const ROUTE = [{ x: 20, z: -61 }, { x: 60, z: -60 }, { x: 110, z: -58 }, { x: 165, z: -129 }, { x: 220, z: -200 }, { x: 226, z: -206 }];
const TURNOUT = { x: 226, z: -206 };
const SNOWBANK = { x: 212, z: -178 };
const JUNCTION = { x: 110, z: -58 };
const UPHILL = { x: 300, z: -320 };

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd3.board': {
    title: 'The Fixer', main: true, day: 3,
    async run(m, from) {
      if (m.cp(1, from)) {
        const text = 'Check the job board at the post office';
        m.obj(text, 'post.door', 'Pearl runs it');
        m.ears(['d3.n.morning', 'd3.l.morning']);
        await hold(m, () => !!m.flag('d3.board.seen'), text, 'post.door');
      }
      if (m.cp(2, from)) {
        await jobBoard(m, 2);
        await m.ear('d3.n.jobs');
      }
      if (m.cp(3, from)) {
        m.done();
        if (JOBS.some((j) => !isFixed(m, j))) m.start('d3.extra');
        m.start('d3.tail');
      }
    },
  },

  'd3.extra': {
    title: 'One More Job', day: 3,
    async run(m, from) {
      if (m.cp(1, from)) {
        const j = JOBS.find((x) => !isFixed(m, x));
        if (j) {
          const got = await repairJob(m, { id: j.id, where: j.where, prompt: j.prompt, obj: `Optional: ${j.prompt.toLowerCase()}`, sub: `${j.who} pays $${j.fee}`, title: j.title, games: j.games });
          m.flag('d3.fixed.' + j.key, true);
          payFee(m, got, j.fee, `${j.who}: ${j.short}`);
          rel(m.G, j.client, 6);
        }
        m.done();
      }
    },
  },

  'd3.tail': {
    title: 'Up the Hill', main: true, day: 3,
    async run(m, from) {
      const G = m.G, s = G.state;
      if (m.cp(1, from)) {
        const text = 'Be near City Hall by 7:30 pm';
        m.obj(text, 'cityhall', 'Shaw works late on Wednesdays — keep clear of the door camera');
        m.ear('d3.n.tail1');
        let early = false;
        await hold(m, () => {
          const d = dist(G, 'cityhall.door');
          const time = s.hour >= 19.3 || s.hour < 4;
          if (!time && !early && d < 40) { early = true; m.ear('d3.l.early'); }
          return time && d < 45;
        }, text, 'cityhall');
      }
      if (m.cp(2, from)) {
        warp(G, 'gideon', at(G, 'cityhall.door'));
        m.ears(['d3.n.tail2', 'd3.l.crouch']);
        await tailShaw(m);
      }
      if (m.cp(3, from)) {
        place(G, 'gideon', { ...TURNOUT, rot: yawTo(TURNOUT, UPHILL) });
        m.ear('d3.n.turnout');
        m.obj('Get within earshot — crouch behind the snowbank', SNOWBANK, 'Off the road, east side');
        let nag = false;
        await m.until(() => {
          const near = dist(G, SNOWBANK) < 7;
          if (near && !G.player.crouch && !nag) { nag = true; m.ear('d3.n.crouch'); }
          if (dist(G, 'gideon') < 15) G.attention.act(0.8, 0.3);
          return near && !!G.player.crouch;
        });
        m.clear();
        let listening = true;
        const watch = m.until(() => {
          if (!listening) return true;
          if (dist(G, 'gideon') < 15 || (dist(G, SNOWBANK) < 10 && !G.player.crouch)) G.attention.act(0.8, 0.3);
          return false;
        });
        await m.ears(['d3.l.mic', 'd3.sec.1', 'd3.gi.gate1', 'd3.sec.2', 'd3.gi.gate2', 'd3.gi.gate3', 'd3.sec.3', 'd3.gi.gate4']);
        listening = false;
        await watch;
        m.flag('d3.overheard', true);
        await m.ear('d3.n.heard');
      }
      if (m.cp(4, from)) {
        place(G, 'gideon', UPHILL);
        G.attention.zone('d3.hill', 330, -380, 90, 8, 'Northstar property');
        m.ear('d3.n.stop');
        m.obj('Head back to town', JUNCTION, 'Stay off the hill');
        await m.until(() => {
          const n = G.npcs?.get?.('gideon');
          if (n?.scripted && n.pos && (Math.hypot(n.pos.x - UPHILL.x, n.pos.z - UPHILL.z) < 3 || dist(G, 'gideon') > 70)) release(G, 'gideon');
          return dist(G, JUNCTION) < 34 || Math.hypot(G.player.pos.x, G.player.pos.z) < 170;
        });
        release(G, 'gideon');
        G.attention.clearZone('d3.hill');
        await m.scene((d) => mrGrey(m, d));
        m.flag('seenGrey', true);
        m.flag('d3.tailed', true);
      }
      if (m.cp(5, from)) {
        m.ears(['d3.n.lesson', 'd3.l.lesson']);
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop');
        await hold(m, () => !!s.lessons.l03, text, 'cabin.laptop');
        await m.ear('d3.n.night');
        m.done();
      }
    },
  },

  // optional: Wednesday trivia, from Lou's conversation
  'd3.trivia': {
    title: 'Trivia Night', day: 3,
    async run(m, from) {
      const s = m.G.state;
      if (m.cp(1, from)) {
        // the tail comes first; the quiz is at nine (Lou runs it when you talk to her)
        await m.until(() => !!m.flag('d3.tailed') || !!m.flag('d3.trivia.done') || s.day > 3);
        if (!m.flag('d3.trivia.done') && s.day === 3 && s.hour > 12) {
          m.obj('Trivia night at the Rusty Anchor', 'bar.barCounter', 'Talk to Lou — until half past eleven');
          await m.until(() => !!m.flag('d3.trivia.done') || s.day > 3 || (s.hour >= 23.5 || s.hour < 6));
        }
        m.done();
      }
    },
  },
};

// Pearl's board: three spots at once; any `need` of them finish the main task.
async function jobBoard(m, need) {
  const G = m.G, s = G.state;
  const open = {};
  let shoppingFrom = null; // materials count when a job came up short
  for (let guard = 0; guard < 80; guard++) {
    const done = JOBS.filter((j) => isFixed(m, j)).length;
    if (done >= need) break;
    const todo = JOBS.filter((j) => !isFixed(m, j));
    const shopping = shoppingFrom !== null && materials(s) <= shoppingFrom;
    if (shopping) m.obj('Buy the materials at Brubaker Hardware', 'hardware', 'Then back to the job board');
    else {
      shoppingFrom = null;
      const near = todo.slice().sort((a, b) => dist(G, a.where) - dist(G, b.where))[0];
      m.obj(`Job board: fix ${need - done} more`, near.where, todo.map((j) => j.short).join(' · '));
    }
    for (const j of todo) if (!open[j.key]) open[j.key] = m.spot('job.' + j.key, j.where, j.prompt, 2.8).then(() => j);
    const wake = todo.map((j) => open[j.key]);
    if (shopping) wake.push(m.until(() => materials(s) > shoppingFrom).then(() => null, () => null));
    const j = await Promise.race(wake);
    if (!j) continue;
    delete open[j.key];
    const before = s.money;
    if (await doRepair(m, j.id, j.title, j.games)) {
      m.flag('d3.fixed.' + j.key, true);
      payFee(m, Math.max(0, s.money - before), j.fee, `${j.who}: ${j.short}`);
      rel(G, j.client, 6);
      standing(G, 1);
      if (JOBS.filter((x) => isFixed(m, x)).length === 1) m.ear('d3.n.job1');
    } else {
      shoppingFrom = materials(s);
      m.ear('d3.n.mats');
    }
  }
  for (const k of Object.keys(open)) G.interact?.remove?.(`${m.id}:job.${k}`);
}

// Follow Shaw up the hill: not closer than ~10 m, not farther than ~110 m.
// He looks back twice on the way (and whenever you crowd him).
function tailShaw(m) {
  const G = m.G, s = G.state;
  let i = 0, glanceUntil = 0, closeSince = null, farSince = null, waiting = false, lastObj = -9, warnedFar = false;
  const looked = new Set();
  return m.until(() => {
    const n = G.npcs?.get?.('gideon');
    const P = G.player?.pos;
    if (!n?.pos || !P) return true;
    const t = s.stats.playSeconds;
    const d = Math.hypot(P.x - n.pos.x, P.z - n.pos.z);
    if (t - lastObj > 1) { lastObj = t; m.obj('Follow Gideon Shaw', flat(n.pos), 'Twenty to sixty metres back'); }
    if (waiting) {
      if (d > 45) return false;
      waiting = false;
    }
    if (t < glanceUntil) {
      n.goal = { x: n.pos.x, z: n.pos.z, yaw: yawTo(n.pos, P), activity: 'stand' };
      G.attention.act(0.9, 0.3);
      return false;
    }
    const wp = ROUTE[i];
    if (Math.hypot(n.pos.x - wp.x, n.pos.z - wp.z) < 1.6) {
      i++;
      if (i >= ROUTE.length) return true;
      if ((i === 2 || i === 4) && !looked.has(i)) { looked.add(i); glanceUntil = t + 3.2; m.ear('d3.n.glance'); return false; }
    }
    const g = ROUTE[i];
    n.goal = { x: g.x, z: g.z, activity: 'walk' };
    if (d < 14) G.attention.act(0.6, 0.25);
    if (d < 9) {
      closeSince ??= t;
      if (t - closeSince > 1.8) { closeSince = null; glanceUntil = t + 2.5; m.ear('d3.n.close'); }
    } else closeSince = null;
    if (d > 75 && !warnedFar) { warnedFar = true; m.ear('d3.n.far'); }
    if (d < 60) warnedFar = false;
    if (d > 115) {
      farSince ??= t;
      if (t - farSince > 4) { farSince = null; waiting = true; n.goal = { x: n.pos.x, z: n.pos.z, activity: 'stand' }; m.ear('d3.n.lost'); }
    } else farSince = null;
    return false;
  });
}

// Mr. Grey, parked by the road into town, watching.
async function mrGrey(m, d) {
  const G = m.G, P = G.player.pos;
  ensureNpc(G, 'okafor', 'Mr. Grey');
  const tx = -10 - P.x, tz = -30 - P.z, L = Math.hypot(tx, tz) || 1;
  const fx = tx / L, fz = tz / L;
  const spot = { x: P.x + fx * 18 + fz * 7, z: P.z + fz * 18 - fx * 7 };
  await d.bring('okafor', { ...spot, rot: yawTo(spot, P) });
  await d.bring('player', { x: P.x, z: P.z, rot: yawTo(P, { x: P.x + fx, z: P.z + fz }) });
  const over = d.actors?.okafor ? d.overShoulder('player', 'okafor', { fov: 30 }) : undefined;
  await d.say('nadia', 'd3.n.grey1', { radio: true, cam: over });
  await d.say('nadia', 'd3.n.grey2', { radio: true, cam: cu(d, 'okafor', { dist: 1.1 }) });
  await d.say('lyosha', 'd3.l.grey', { radio: true });
  const k = await d.choose(['Keep walking. Eyes front.', 'Look straight at him.']);
  if (k === 1) {
    const stare = cu(d, 'okafor', { dist: 0.8 });
    if (stare) d.cam(stare);
    await d.wait(1.4);
    G.attention.add(5);
    m.flag('d3.lookedAtGrey', true);
    await d.say('nadia', 'd3.n.look', { radio: true });
  } else {
    await d.say('nadia', 'd3.n.grey3', { radio: true, cam: cu(d, 'player', { side: -1 }) });
  }
  G.sfx?.engineStart?.();
  await d.wait(1.2);
  await d.say('nadia', 'd3.n.grey4', { radio: true });
}

// ---------------------------------------------------------------- conversations
const comment = (c) => c.flag('d2.comment') || 'none';

export const DIALOG = {
  pearl: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.board.seen')) {
      await c.say('pearl', 'd3.p.board1');
      await c.say('pearl', 'd3.p.board2');
      await c.say('pearl', 'd3.p.board3');
      const k = await c.choose(["I'll take all three.", 'Where do I get materials?']);
      if (k === 1) await c.say('pearl', 'd3.p.mats');
      await c.say('pearl', 'd3.p.go');
      c.rel(4);
      c.flag('d3.board.seen', true);
      c.emit('talk:pearl');
      return;
    }
    if (c.flag('d3.fixed.steps') && !c.flag('d3.thanked.steps')) { c.flag('d3.thanked.steps', true); await c.say('pearl', 'd3.p.thanks'); c.rel(4); return; }
    return idle(c, prev, 'pearl', 'd3.p.idle');
  },

  dolly: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (c.flag('d3.fixed.sign') && !c.flag('d3.thanked.sign')) { c.flag('d3.thanked.sign', true); await c.say('dolly', 'd3.d.thanks'); c.give('pie'); c.rel(5); return; }
    if (!c.flag('d3.d.hi')) {
      c.flag('d3.d.hi', true);
      if (c.flag('d3.board.seen') && !c.flag('d3.fixed.sign')) await c.say('dolly', 'd3.d.hello');
      await c.say('dolly', 'd3.d.vote');
      c.rel(2);
      return;
    }
    return idle(c, prev, 'dolly', 'd3.d.idle');
  },

  ellen: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (c.flag('d3.fixed.door') && !c.flag('d3.thanked.door')) { c.flag('d3.thanked.door', true); await c.say('ellen', 'd3.el.thanks'); c.rel(5); return; }
    if (c.flag('d3.board.seen') && !c.flag('d3.fixed.door') && !c.flag('d3.el.hi')) { c.flag('d3.el.hi', true); await c.say('ellen', 'd3.el.door'); return; }
    return idle(c, prev, 'ellen', 'd3.el.idle');
  },

  koshkin: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.k.hi')) {
      c.flag('d3.k.hi', true);
      await c.say('koshkin', { cams: 'd3.k.cams', fix: 'd3.k.fix', yes: 'd3.k.yes' }[comment(c)] || 'd3.k.none');
      c.rel(3);
      return;
    }
    return idle(c, prev, 'koshkin', 'd3.k.idle');
  },

  hank: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.h.hi')) {
      c.flag('d3.h.hi', true);
      if (comment(c) === 'fix') { await c.say('hank', 'd3.h.fix'); c.give('nails'); c.rel(5); }
      else await c.say('hank', 'd3.h.jobs');
      return;
    }
    return idle(c, prev, 'hank', 'd3.h.idle');
  },

  ruth: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.r.hi')) {
      c.flag('d3.r.hi', true);
      const k = comment(c);
      await c.say('ruth', k === 'cams' ? 'd3.r.cams' : k === 'yes' ? 'd3.r.yes' : 'd3.r.hello');
      c.rel(k === 'yes' ? 0 : 3);
      return;
    }
    return idle(c, prev, 'ruth', 'd3.r.idle');
  },

  ray: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.ra.hi')) { c.flag('d3.ra.hi', true); await c.say('ray', c.flag('d2.rayHeard') ? 'd3.ra.again' : 'd3.ra.hello'); c.rel(2); return; }
    return idle(c, prev, 'ray', 'd3.ra.hello');
  },

  lyle: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.ly.hi')) { c.flag('d3.ly.hi', true); await c.say('lyle', comment(c) === 'yes' ? 'd3.ly.yes' : 'd3.ly.cold'); return; }
    return idle(c, prev, 'lyle', 'd3.ly.idle');
  },

  walt: async (c, prev) => (c.day === 3 ? idle(c, prev, 'walt', 'd3.wt.hello') : prev(c)),

  gideon: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.gi.hi')) {
      c.flag('d3.gi.hi', true);
      await c.say('gideon', comment(c) === 'cams' ? 'd3.gi.cams' : 'd3.gi.hello');
      c.attention(2);
      return;
    }
    return idle(c, prev, 'gideon', 'd3.gi.hello');
  },

  evan: async (c, prev) => (c.day === 3 ? idle(c, prev, 'evan', 'd3.e.hello') : prev(c)),
  marta: async (c, prev) => (c.day === 3 ? idle(c, prev, 'marta', 'd3.m.hello') : prev(c)),

  nina: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    const k = comment(c);
    return idle(c, prev, 'nina', k === 'cams' ? 'd3.ni.cams' : k === 'fix' ? 'd3.ni.fix' : 'd3.ni.other');
  },

  tommy: async (c, prev) => (c.day === 3 ? idle(c, prev, 'tommy', 'd3.t.hello') : prev(c)),
  wade: async (c, prev) => (c.day === 3 ? idle(c, prev, 'wade', 'd3.wd.hello') : prev(c)),
  gabriel: async (c, prev) => (c.day === 3 ? idle(c, prev, 'gabriel', 'd3.g.hello') : prev(c)),

  lou: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    const late = c.hour >= 23.5 || c.hour < 6;
    const nine = c.hour >= 20.75 || c.hour < 6;
    if (c.flag('d3.trivia.in') && !c.flag('d3.trivia.done')) {
      if (late) { await c.say('lou', 'd3.lo.over'); c.flag('d3.trivia.done', true); return; }
      if (!nine) { await c.say('lou', 'd3.lo.early'); return; }
      await triviaNight(c);
      return;
    }
    if (!c.flag('d3.trivia.in') && !c.flag('d3.trivia.done') && !late && (!c.flag('d3.lo.asked') || (nine && !c.flag('d3.lo.lastcall')))) {
      if (!c.flag('d3.lo.asked')) { c.flag('d3.lo.asked', true); await c.say('lou', 'd3.lo.trivia'); }
      else { c.flag('d3.lo.lastcall', true); await c.say('lou', 'd3.lo.lastcall'); }
      const k = await c.choose(['Count me in. ($5)', 'Not tonight.']);
      if (k === 0 && c.state.money >= 5) {
        c.money(-5, 'trivia entry');
        c.flag('d3.trivia.in', true);
        c.start('d3.trivia');
        c.G.missions.ear('d3.n.trivia');
        if (nine) await triviaNight(c);
      }
      return;
    }
    return idle(c, prev, 'lou', 'd3.lo.idle');
  },
};

async function triviaNight(c) {
  await c.say('lou', 'd3.lo.q0');
  const Q = [
    ['d3.lo.q1', ['1822', '1867', '1911'], 0],
    ['d3.lo.q2', ['1898', '1911', '1946'], 1],
    ['d3.lo.q3', ['101.5', '92.3', '88.9'], 2],
    ['d3.lo.q4', ['860', '1,140', '2,300'], 1],
  ];
  let score = 0;
  for (const [line, opts, right] of Q) {
    await c.say('lou', line);
    const k = await c.choose(opts);
    if (k === right) { score++; await c.say('lou', 'd3.lo.right'); } else await c.say('lou', 'd3.lo.wrong');
    if (line === 'd3.lo.q3') await c.say('ray', 'd3.ra.heckle');
  }
  if (score >= 3) { await c.say('lou', 'd3.lo.win'); c.money(35, 'the trivia pot'); c.rel(10); c.standing(1); c.flag('d3.trivia', 'won'); }
  else { await c.say('lou', 'd3.lo.ok'); await c.say('ray', 'd3.ra.won'); c.rel(5); c.flag('d3.trivia', 'lost'); }
  c.flag('d3.trivia.done', true);
  c.emit('talk:lou');
}

export const DIALOG_OVERRIDE = true;
