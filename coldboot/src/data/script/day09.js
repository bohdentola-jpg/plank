// DAY 9 — The Vacant Seat (Tuesday). Six days to dawn. The council leased the
// cannery dock to Northstar last night; Ray Moody quits at the Rusty Anchor and
// hands you his resignation. A special election on Saturday (day 13). Ruth
// sponsors you; twenty-five clean signatures by morning (eight from people who
// know you), posters, and the 'petition' field hack. Side: posters with Nina,
// a fax from Koshkin in Nome, darts with Lou.
export const DAY = { n: 9, start: ['d9.seat'], mustFinish: ['d9.night'] };

const passed = (r) => r === true || !!(r && r.pass);
const BAR = { x: -62, z: 46 };
/** A named point nudged by (dx, dz), or the point itself if the town doesn't know it yet. */
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });
const near = (G, p, dx, dz) => { const q = G.town?.points?.[p]; return q ? { x: q.x + dx, z: q.z + dz } : p; };
const SIGNERS = ['ruth', 'ray', 'lou', 'dolly', 'hank', 'tommy', 'nina', 'gabriel', 'ellen', 'pearl', 'wade', 'koshkin'];
const CLIPS = [
  { k: 'diner', where: 'diner', label: "Leave a clipboard on Dolly's counter", who: "Dolly's regulars" },
  { k: 'church', where: 'church.narthex', label: 'Leave a clipboard in the church porch', who: 'the parish' },
  { k: 'bar', where: BAR, label: 'Leave a clipboard at the Rusty Anchor', who: 'the Anchor crowd' },
  { k: 'hardware', where: 'hardware', label: "Leave a clipboard at Hank's counter", who: "Hank's customers" },
];

export const LINES = {
  // ---------------------------------------------------------------- morning: the news
  'd9.n.morning': { who: 'nadia', ru: 'Шесть дней, Рыбка. Включи радио — Нина как раз читает новости.', en: "Six days, Rybka. Turn on the radio — Nina's reading the news." },
  'd9.ni.news1': { who: 'nina', en: "Good morning, Port Zarya. This is KZRY, eighty-eight point nine, and it's minus twenty-two. Big news from last night's emergency session." },
  'd9.ni.news2': { who: 'nina', en: 'The council voted four to one to lease the cannery dock to Northstar Dynamics. Zarya Seafoods closes at the end of the month. Forty-one jobs. Ray Moody was the one no.' },
  'd9.ni.news3': { who: 'nina', en: 'Northstar says the dock will host a data centre. My mom says a data centre is a warehouse for nobody. Okay. Back to the music.' },
  'd9.l.dock': { who: 'lyosha', ru: 'Центр обработки данных? На краю света, на одном кабеле? Дело не в данных. Им нужен причал.', en: "A data centre? At the edge of the world, on one cable? It isn't about data. They need the dock." },
  'd9.dm.dock': { who: 'dmitri', ru: 'Причал у самого пролива. Чтобы уйти по воде, когда погаснет свет.', en: 'A dock right on the strait. So they can leave by water when the lights go out.', emo: 'serious' },
  'd9.lo.call': { who: 'lou', en: "Hey, carpenter. It's Lou, at the Anchor. Ray's been here since closing time. He's asking for you. Don't ask me why. Come round the back." },
  'd9.n.go': { who: 'nadia', ru: 'Иди. Человек, который голосует против «Нордстара», зовёт тебя. Такое не пропускают.', en: "Go. A man who votes against Northstar is asking for you. You don't pass that up." },
  // ---------------------------------------------------------------- the Rusty Anchor: Ray quits
  'd9.lo.back': { who: 'lou', en: "There you are. He won't go home, he won't eat, and he won't stop writing on my napkins. Talk to him. I'll get coffee." },
  'd9.ry.hello': { who: 'ray', en: "The handyman. Sit down. You're the only person in this town who fixes things instead of selling them.", emo: 'frown' },
  'd9.ry.vote': { who: 'ray', en: 'Four to one. Forty-one families. Lyle Pruitt read his speech off Northstar letterhead. He didn\'t even cut the logo off.', emo: 'angry' },
  'd9.ry.letter': { who: 'ray', en: "My resignation. Third draft. The first two had words in them your mother wouldn't like." },
  'd9.ry.right': { who: 'ray', en: 'The right thing. Sure. The right thing and a dollar gets you half a coffee at Northstar.', emo: 'frown' },
  'd9.lo.sit': { who: 'lou', en: "That's the most sense anybody's talked in here all night.", emo: 'smile' },
  'd9.ry.done': { who: 'ray', en: "Eleven years on that council. I'm done being the only no. Let them have their dock. Let them have the whole damn town.", emo: 'angry' },
  'd9.ry.chair': { who: 'ray', en: "You think I don't know that? Lyle's had his eye on my chair since the day I sat in it." },
  'd9.ry.who': { who: 'ray', en: 'Who? Nobody. Unless somebody honest walks in off the street. Somebody nobody owns yet.' },
  'd9.ry.call': { who: 'ray', en: 'My call. Yeah. Funny how nobody else ever wants to make it.' },
  'd9.lo.idea': { who: 'lou', en: "You know what Ruth would say. The seat goes to a special election. Anybody can run. Anybody." },
  'd9.ry.why': { who: 'ray', en: 'Anybody. Huh. You fixed the bell. You keep Sasha\'s store open. People like you, God knows why. Why not you?' },
  'd9.n.yes': { who: 'nadia', ru: 'Рыбка. Это и есть лестница. Скажи «да».', en: 'Rybka. This is the ladder. Say yes.', emo: 'serious' },
  'd9.ry.best': { who: 'ray', en: 'Best kind. Politicians break things. Carpenters fix them.', emo: 'smile' },
  'd9.ry.good': { who: 'ray', en: "Ha! Good. Then I'm signing this, and you're running, and Lyle Pruitt is going to choke on his coffee.", emo: 'laugh' },
  'd9.ry.sign': { who: 'ray', en: 'Take this to the mayor. My resignation. And tell Walt I said he used to be a better man.' },
  'd9.ry.card': { who: 'ray', en: "And that laminated card they gave us. Gideon wants it back when I quit. He can come and dig it out of my sock drawer himself.", emo: 'frown' },
  'd9.n.card': { who: 'nadia', ru: 'Карточка Рэя остаётся у Рэя. Запомним.', en: "Ray's card stays with Ray. We'll remember that." },
  'd9.lo.first': { who: 'lou', en: "I'll be your first signature, by the way. Lou Amarok. Owner, bartender, darts champion three years running.", emo: 'smile' },
  // ---------------------------------------------------------------- City Hall
  'd9.w.read': { who: 'walt', en: 'Ray. Lord. Eleven years. He was the only one who ever read the budget all the way through.', emo: 'worry' },
  'd9.w.law': { who: 'walt', en: 'Well. The charter says a vacant seat goes to a special election within five days. That makes it Saturday.' },
  'd9.gi.filed': { who: 'gideon', en: 'Lyle Pruitt has already filed his petition. This morning. Twenty-five signatures, all in order.' },
  'd9.r.fast': { who: 'ruth', en: 'This morning. Before Ray resigned. My, my, Gideon. Lyle must be psychic.', emo: 'smile' },
  'd9.gi.prep': { who: 'gideon', en: 'Lyle is prepared. Preparation is not a crime, Mrs. Aqpik.' },
  'd9.r.nominate': { who: 'ruth', en: "Then I'll say it. I'm nominating the carpenter. Somebody in this room should hear a name that isn't Lyle's." },
  'd9.gi.resident': { who: 'gideon', en: 'This one? Nine days in town. The charter requires residence.', emo: 'frown' },
  'd9.r.charter': { who: 'ruth', en: 'Section four. Any resident who has slept seven nights in Port Zarya may stand. Written in nineteen fifty-nine so fishermen could run. I typed it myself.', emo: 'smile' },
  'd9.w.ok': { who: 'walt', en: "She did. I was there. Fine. Twenty-five valid signatures, filed with Pearl by nine tomorrow morning. Good luck, friend. You'll need it." },
  'd9.gi.warn': { who: 'gideon', en: 'Valid signatures. Pearl will check every one. So will I.', emo: 'serious' },
  'd9.r.sponsor': { who: 'ruth', en: "I'll sign first. I've signed for three candidates in fifty years. Two of them won. Don't make me look bad.", emo: 'smile' },
  'd9.r.clips': { who: 'ruth', en: 'Here. Petition sheets, four clipboards. Leave them where people sit and talk. Dolly\'s, the church porch, the Anchor, Hank\'s. People sign what\'s in front of them.' },
  'd9.l.who': { who: 'lyosha', ru: 'Лайл подал петицию раньше, чем Рэй ушёл в отставку. Значит, они знали заранее. Значит, этой отставки ждали.', en: "Lyle filed his petition before Ray resigned. So they knew in advance. So somebody was waiting for Ray to quit.", emo: 'serious' },
  'd9.n.petition': { who: 'nadia', ru: 'Двадцать пять подписей до утра. Хотя бы восемь — от людей, которые тебя знают. Остальное соберут листы.', en: 'Twenty-five signatures by morning. At least eight from people who know you. The clipboards can catch the rest.' },
  // ---------------------------------------------------------------- petition: the team
  'd9.n.enough': { who: 'nadia', ru: 'Двадцать пять! Даже больше. Теперь их надо почистить — половина города расписалась дважды.', en: 'Twenty-five! More, even. Now we clean it up — half the town signed twice.', emo: 'smile' },
  'd9.l.clean': { who: 'lyosha', ru: 'Чисто. Ни одного дубликата, всё по алфавиту. Перл будет довольна.', en: 'Clean. Not one duplicate, all in alphabetical order. Pearl will be pleased.', emo: 'smile' },
  'd9.l.retry': { who: 'lyosha', ru: 'Почти. Перл такое не примет. Ещё разок.', en: "Almost. Pearl won't take it like that. Once more." },
  'd9.n.filed': { who: 'nadia', ru: 'Готово. С утра ты кандидат. Рыбка в городском совете — кто бы мог подумать.', en: "Done. As of morning, you're a candidate. Rybka on the town council — who would have thought.", emo: 'smile' },
  'd9.g.minister': { who: 'grisha', ru: 'А я всегда говорил: у нас не плотник, а целый министр!', en: "I always said it: we don't have a carpenter, we have a minister!", emo: 'laugh' },
  'd9.v.knit': { who: 'valya', ru: 'Политика, рыбка, — как вязание. Одна петля не так — и всё распускается.', en: 'Politics, little fish, is like knitting. One wrong loop and the whole thing unravels.', emo: 'smile' },
  'd9.n.posters': { who: 'nadia', ru: 'Твоё лицо на каждом углу. Для шпиона — кошмар. Для кандидата — то, что нужно.', en: 'Your face on every corner. For a spy, a nightmare. For a candidate, exactly right.', emo: 'smile' },
  'd9.n.lesson': { who: 'nadia', ru: 'Домой, Рыбка. Сегодня Лёша учит функциям.', en: 'Home, Rybka. Tonight Lyosha teaches functions.' },
  'd9.l.after': { who: 'lyosha', ru: 'Функция — как хороший плотник: делает одну работу и делает её хорошо. Ну, ты понимаешь.', en: 'A function is like a good carpenter: it does one job, and does it well. Well — you know.', emo: 'smile' },
  'd9.dm.night': { who: 'dmitri', ru: 'Сорок лет я строил станции. Ни одна не держалась на одном человеке. Эта держится. Спи, Рыбка. Завтра — пять дней.', en: 'Forty years I built stations. Not one of them stood on one person. This one does. Sleep, Rybka. Tomorrow, five days.', emo: 'serious' },
  // ---------------------------------------------------------------- signatures
  'd9.d.sign': { who: 'dolly', en: "Honey, I'd sign anything that makes Lyle Pruitt spill his coffee. Give me that pen. Dolly Finch, in my best handwriting.", emo: 'laugh' },
  'd9.d.dog': { who: 'dolly', en: "And did you see? A black SUV followed Pearl's husky all morning. Main Street, Second Avenue, round the church. Poor Biscuit thinks he's famous.", emo: 'laugh' },
  'd9.h.sign': { who: 'hank', en: "A petition. Huh. Ray quits and you jump in. Alright. You fixed half of Front Street with my lumber. I'll sign." },
  'd9.h.nails': { who: 'hank', en: "I don't sign for strangers. I sell to them. Buy a box of nails, five bucks, and we'll call it a relationship." },
  'd9.h.nails2': { who: 'hank', en: "Pleasure doing business. There. Hank Brubaker. Don't make me regret it." },
  'd9.t.sign': { who: 'tommy', en: "Grandma's sponsoring you? Then I'm in. I'll sign it twice. For luck.", emo: 'laugh' },
  'd9.ni.sign': { who: 'nina', en: "I turned eighteen in October, so it counts! First thing I've ever signed that isn't a noise complaint.", emo: 'smile' },
  'd9.g.sign': { who: 'gabriel', en: 'For the one who gave the bell its voice back? Gladly. A priest should keep out of politics, but God votes by other means.', emo: 'smile' },
  'd9.g.plain': { who: 'gabriel', en: "A priest ought to keep out of politics. But Ray's seat shouldn't go to whoever Northstar points at. Give it here." },
  'd9.e.sign': { who: 'ellen', en: 'Give it here. Anybody willing to sit through those council meetings deserves a signature and a medical exemption.', emo: 'smile' },
  'd9.e.checkup': { who: 'ellen', en: "I don't sign for strangers. Doctor's rule. Sit. Breathe in. Hmm. Nervous heart, honest eyes. Fine. Here's your signature.", emo: 'smile' },
  'd9.p.sign': { who: 'pearl', en: "I'm the one who files it, hon, so I shouldn't. Oh, who am I kidding. Pearl Jessup. With a flourish.", emo: 'laugh' },
  'd9.p.stamps': { who: 'pearl', en: "I sign for customers. Buy a book of stamps, ten dollars, and you're a customer." },
  'd9.wa.sign': { who: 'wade', en: "Sure thing. Anybody who gets up Lyle's nose gets my name. Wade Tolliver. Spelled like it sounds." },
  'd9.wa.push': { who: 'wade', en: "I don't sign stuff for folks I barely know. Tell you what. Help me push the Cessna into the hangar, and we're acquainted." },
  'd9.wa.thanks': { who: 'wade', en: 'Ha! Strong back. Alright, acquaintance. Gimme that pen.', emo: 'laugh' },
  'd9.k.sign': { who: 'koshkin', en: 'My signature? For you? Give me the pen. Koshkin, with a K, like my grandfather wrote it in nineteen eleven.', emo: 'smile' },
  'd9.m.sign': { who: 'marta', en: "I don't sign petitions. A police chief signs warrants. Different pen." },
  'd9.m.luck': { who: 'marta', en: 'But. Good luck. Somebody ought to make Lyle sweat.', emo: 'smile' },
  'd9.w.neutral': { who: 'walt', en: 'The mayor stays neutral, friend. Officially. Unofficially, Ray was right about the dock.' },
  'd9.ly.cute': { who: 'lyle', en: "So it's true. The handyman's running. Cute. You know who sponsors the coffee at the count? Northstar. The chairs? Northstar. The count? Guess.", emo: 'smile' },
  'd9.gi.chat': { who: 'gideon', en: 'Nine days in Port Zarya and you want a seat on its council. Ambitious. Ambition is expensive here.' },
  'd9.ev.dog': { who: 'evan', en: "Weird morning! Our security team spent two hours following Pearl's husky. Don't tell anyone I told you. Ha!", emo: 'laugh' },
  'd9.ev.sign': { who: 'evan', en: "A petition? Oh, I'd love to, but company policy says Northstar team members stay neutral. Neutral! Like Switzerland. Have a great day!", emo: 'smile' },
  'd9.r.chat': { who: 'ruth', en: "Clipboards where people sit. Names from people who know you. And smile, even when Lyle's looking. Especially then.", emo: 'smile' },
  'd9.ry.after': { who: 'ray', en: "Don't look at me like that. I signed. Now go get the rest. And don't let Gideon count them." },
  // ---------------------------------------------------------------- side: posters, the fax, darts
  'd9.ni.posters': { who: 'nina', en: "Posters? I've got the station's printer and way too much toner. Give me ten minutes. I'll make you look trustworthy. Ish.", emo: 'smile' },
  'd9.p.copy': { who: 'pearl', en: "Copies are fifty cents, hon. Thirty posters, fifteen dollars. I'll throw in the staples for free." },
  'd9.k.phone': { who: 'koshkin', en: 'Who is it? Ah! My carpenter. They feed me green jelly here. Green! Like a frog\'s breakfast. How is my store?' },
  'd9.k.run': { who: 'koshkin', en: "Running? For the council? Ha! Molodets. You need my name, yes? Tell Pearl to switch on her fax machine. I sign it in front of the nurse.", emo: 'laugh' },
  'd9.k.fine': { who: 'koshkin', en: 'Me? Old. The heart is a bad pump, the doctor says. I told him, so is the one at the cannery, and it runs sixty years.', emo: 'smile' },
  'd9.k.bye': { who: 'koshkin', en: 'And keep the stove lit in my store. The jars freeze, and then my pickles taste like sadness. Do svidaniya.' },
  'd9.p.fax': { who: 'pearl', en: 'Fax for you, from Nome. Somebody signed this so hard he tore the paper. Sasha Koshkin, capital letters, underlined twice.', emo: 'laugh' },
  'd9.lo.darts': { who: 'lou', en: "Want your poster behind my bar? Beat me at darts. Three in the bull. Nobody's done it since nineteen ninety-eight." },
  'd9.lo.win': { who: 'lou', en: "Well, I'll be damned. Three in the bull. Your poster goes up behind the bar, right next to my trophies.", emo: 'surprise' },
  'd9.lo.lose': { who: 'lou', en: "Close. Not close enough. Poster goes up anyway. Nobody in here can read after nine o'clock.", emo: 'laugh' },
};

// ---------------------------------------------------------------- missions
async function hack(m, id, where, retryLine, retryText) {
  for (;;) {
    if (passed(await m.code(id))) return true;
    await m.ear(retryLine);
    m.obj(retryText, where);
    await m.spot('retry.' + id, where, retryText, 3);
  }
}
const named = (m) => SIGNERS.filter((k) => m.flag('d9.sig.' + k)).length;
const folkSigs = (m) => Number(m.flag('d9.folkSigs')) || 0;

export const MISSIONS = {
  'd9.seat': {
    title: 'The Vacant Seat', main: true, day: 9,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        await m.wait(1.0);
        await m.ear('d9.n.morning');
        await m.ears(['d9.ni.news1', 'd9.ni.news2', 'd9.ni.news3']);
        await m.ear('d9.l.dock');
        await m.ear('d9.dm.dock');
      }
      if (m.cp(2, from)) {
        await m.ear('d9.lo.call');
        m.ear('d9.n.go');
        m.obj('Go to the Rusty Anchor', BAR, 'Lou: round the back');
        await m.reach(BAR, 8);
      }
      if (m.cp(3, from)) {
        m.clear();
        await m.scene(async (d) => {
          await d.bring('lou', { x: -65, z: 46 }, { face: 'player' });
          await d.bring('ray', { x: -60, z: 46 }, { sit: true, face: 'player' });
          await d.say('lou', 'd9.lo.back', { cam: d.closeUp('lou') });
          await d.say('ray', 'd9.ry.hello', { cam: d.closeUp('ray') });
          await d.say('ray', 'd9.ry.vote');
          const k = await d.choose(['Ray, what are you writing?', 'You did the right thing last night.', '(Just sit with him.)'], { prompt: 'RAY' });
          if (k === 1) await d.say('ray', 'd9.ry.right');
          if (k === 2) await d.say('lou', 'd9.lo.sit', { cam: d.closeUp('lou', { side: -1 }) });
          await d.say('ray', 'd9.ry.letter', { cam: d.closeUp('ray', { side: -1 }) });
          await d.say('ray', 'd9.ry.done');
          const k2 = await d.choose(['Quit, and the next one in your chair votes yes.', 'Then who stops them?', "It's your call, Ray."], { prompt: 'RAY' });
          await d.say('ray', ['d9.ry.chair', 'd9.ry.who', 'd9.ry.call'][k2] || 'd9.ry.who');
          await d.say('lou', 'd9.lo.idea', { cam: d.closeUp('lou') });
          await d.say('ray', 'd9.ry.why', { cam: d.closeUp('ray', { dist: 0.65 }) });
          await d.say('nadia', 'd9.n.yes', { radio: true });
          const k3 = await d.choose(["I'll run.", "I'm a carpenter, not a politician."], { prompt: 'RAY' });
          if (k3 === 1) await d.say('ray', 'd9.ry.best');
          await d.say('ray', 'd9.ry.good', { cam: d.closeUp('ray') });
          await d.say('ray', 'd9.ry.sign');
          if (!m.flag('share.ray')) {
            await d.say('ray', 'd9.ry.card');
            m.flag('rayKeepsCard', true);
            if (m.flag('knowsShares')) await d.say('nadia', 'd9.n.card', { radio: true });
          }
          await d.say('lou', 'd9.lo.first', { cam: d.closeUp('lou', { side: -1 }) });
        });
        m.flag('running', true);
        m.flag('d9.sig.ray', true);
        m.flag('d9.sig.lou', true);
        G.state.inv.resignation_letter = 1;
        G.hud.toast('ITEM', "Ray's resignation letter");
        const ray = G.npcs.get('ray');
        if (ray) { ray.scripted = true; ray.goal = { x: -60, z: 46, activity: 'sit' }; }
      }
      if (m.cp(4, from)) {
        m.obj("Take Ray's resignation to the mayor", 'cityhall.mayorOffice', 'City Hall');
        await m.reach('cityhall.mayorOffice', 5);
      }
      if (m.cp(5, from)) {
        m.clear();
        await m.scene(async (d) => {
          await d.bring('walt', 'cityhall.mayorDesk', { face: 'player' });
          await d.bring('gideon', near(G, 'cityhall.mayorOffice', 1.4, -0.6), { face: 'player' });
          await d.bring('ruth', near(G, 'cityhall.mayorOffice', -1.4, -0.4), { face: 'walt' });
          await d.say('walt', 'd9.w.read', { cam: d.closeUp('walt') });
          await d.say('walt', 'd9.w.law');
          await d.say('gideon', 'd9.gi.filed', { cam: d.closeUp('gideon') });
          await d.say('ruth', 'd9.r.fast', { cam: d.closeUp('ruth') });
          await d.say('gideon', 'd9.gi.prep', { cam: d.closeUp('gideon', { side: -1 }) });
          const k = await d.choose(["I want to run for Ray's seat.", '(Let Ruth speak.)'], { prompt: 'CITY HALL' });
          if (k === 1) await d.say('ruth', 'd9.r.nominate', { cam: d.closeUp('ruth', { side: -1 }) });
          await d.say('gideon', 'd9.gi.resident', { cam: d.closeUp('gideon') });
          await d.say('ruth', 'd9.r.charter', { cam: d.closeUp('ruth') });
          await d.say('walt', 'd9.w.ok', { cam: d.closeUp('walt', { side: -1 }) });
          await d.say('gideon', 'd9.gi.warn', { cam: d.closeUp('gideon', { dist: 0.6 }) });
          await d.say('ruth', 'd9.r.sponsor', { cam: d.closeUp('ruth') });
          await d.say('ruth', 'd9.r.clips');
        });
        G.state.inv.resignation_letter = 0;
        m.flag('d9.sig.ruth', true);
        await m.ear('d9.l.who');
        await m.ear('d9.n.petition');
      }
      if (m.cp(6, from)) {
        m.done();
        m.start('d9.petition');
        m.start('d9.posters');
        if (m.flag('koshkinHospital') && !m.flag('koshkinBack')) m.start('d9.fax');
      }
    },
  },

  'd9.petition': {
    title: 'Twenty-Five Names', main: true, day: 9,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        const total = () => named(m) + folkSigs(m);
        for (const cl of CLIPS) {
          if (m.flag('d9.clip.' + cl.k)) continue;
          m.spot('clip.' + cl.k, cl.where, cl.label, 2.8).then(() => {
            const n = 5 + Math.min(4, Math.floor((G.state.spirit || 0) / 6));
            m.flag('d9.clip.' + cl.k, true);
            m.flag('d9.folkSigs', folkSigs(m) + n);
            G.hud.toast('PETITION', `+${n} signatures from ${cl.who}`, '#b98cff');
          });
        }
        let last = '';
        await m.until(() => {
          const s = `Signatures ${total()} / 25 · people who know you ${named(m)} / 8`;
          if (s !== last || !G.hud?.objective) {
            last = s;
            const clip = CLIPS.find((cl) => !m.flag('d9.clip.' + cl.k));
            const who = SIGNERS.find((k) => !m.flag('d9.sig.' + k) && k !== 'koshkin');
            m.obj('Collect petition signatures', clip ? clip.where : who || 'post', s);
          }
          return named(m) >= 8 && total() >= 25;
        });
        G.hud.toast('PETITION', 'Enough names to file', '#b98cff');
        await m.ear('d9.n.enough');
      }
      if (m.cp(2, from)) {
        m.obj('Clean up the petition before filing', 'post', 'Field hack: one name each, alphabetical');
        await m.reach('post', 16);
        await hack(m, 'petition', 'post', 'd9.l.retry', 'Clean the petition again');
        await m.ear('d9.l.clean');
      }
      if (m.cp(3, from)) {
        m.obj('Drop the petition in the post office box', 'post.collectionBox', 'Pearl opens it at nine');
        await m.spot('file', 'post.collectionBox', 'File the petition', 2.4);
        m.flag('petitionFiled', true);
        G.state.standing += 5;
        G.hud.toast('STANDING', '+5  Your name is on the ballot', '#b98cff');
        await m.ear('d9.n.filed');
        await m.ear('d9.g.minister');
        await m.ear('d9.v.knit');
      }
      if (m.cp(4, from)) {
        m.done();
        m.start('d9.night');
      }
    },
  },

  'd9.night': {
    title: 'Night School: Recipes', main: true, day: 9,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        await m.ear('d9.n.lesson');
        m.obj("Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 9: Recipes');
        await hold(m, () => G.state.lessons.l09, "Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 9: Recipes');
      }
      if (m.cp(2, from)) {
        const ray = G.npcs.get('ray');
        if (ray) ray.scripted = false;
        await m.ear('d9.l.after');
        await m.ear('d9.dm.night');
        m.done();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd9.posters': {
    title: 'Paper the Town', day: 9,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Get campaign posters printed', 'nina', "Nina at KZRY, 15:00–21:00 — or Pearl's copier, $15");
        await m.until(() => (G.state.inv.poster || 0) > 0 || m.flag('d9.posters.got'));
      }
      const SPOTS = [['store', 'koshkin.noticeBoard', "Koshkin's notice board"], ['hall', 'hall.bulletinBoard', 'the Parish Hall board'], ['diner', 'diner', 'the diner door']];
      for (let i = 0; i < SPOTS.length; i++) {
        const [k, where, name] = SPOTS[i];
        if (m.cp(2 + i, from)) {
          m.obj(`Put up a poster: ${name}`, where, `${i} / 3 posters up`);
          await m.spot('poster.' + k, where, 'Put up a poster', 2.6);
          await m.minigame('hammer', { title: 'STAPLE THE POSTER', hits: 3 });
          G.state.inv.poster = Math.max(0, (G.state.inv.poster || 0) - 1);
        }
      }
      if (m.cp(5, from)) {
        m.flag('postersUp', true);
        G.state.standing += 3;
        G.hud.toast('STANDING', '+3  Posters up', '#b98cff');
        await m.ear('d9.n.posters');
        m.done();
      }
    },
  },

  'd9.fax': {
    title: 'A Fax from Nome', day: 9,
    async run(m, from) {
      if (m.cp(1, from)) {
        m.obj('Call Koshkin at the hospital in Nome', 'koshkin.counter', "The store's phone");
        await m.spot('phone', 'koshkin.counter', 'Call the hospital in Nome', 2.4);
      }
      if (m.cp(2, from)) {
        await m.scene(async (d) => {
          await d.say('koshkin', 'd9.k.phone', { radio: true });
          const k = await d.choose(["The store's fine. I'm running for Ray's seat.", "The store's fine. How are you, Sasha?"], { prompt: 'KOSHKIN, ON THE PHONE' });
          if (k === 1) await d.say('koshkin', 'd9.k.fine', { radio: true });
          await d.say('koshkin', 'd9.k.run', { radio: true });
          await d.say('koshkin', 'd9.k.bye', { radio: true });
        });
        m.flag('d9.fax.called', true);
      }
      if (m.cp(3, from)) {
        m.obj("Pick up Koshkin's fax at the post office", 'pearl', 'Pearl, 9:00–17:00');
        await m.until(() => m.flag('d9.sig.koshkin'));
        m.done();
      }
    },
  },

  'd9.darts': {
    title: 'Three in the Bull', day: 9,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Darts with Lou', BAR, 'The Rusty Anchor');
        await m.spot('darts', BAR, 'Throw darts', 3);
      }
      if (m.cp(2, from)) {
        const won = await m.minigame('glass', { title: 'DARTS: THREE IN THE BULL', hits: 3, misses: 3 });
        await m.scene(async (d) => {
          await d.bring('lou', { x: -65, z: 46 }, { face: 'player' });
          await d.say('lou', won ? 'd9.lo.win' : 'd9.lo.lose', { cam: d.closeUp('lou') });
        });
        if (won) { G.state.standing += 2; G.hud.toast('STANDING', '+2  The Anchor talks about you', '#b98cff'); m.flag('d9.dartsWon', true); }
        G.state.rel.lou = Math.min(100, (G.state.rel.lou || 0) + (won ? 8 : 4));
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const canSign = (c, k) => c.G.missions.isActive('d9.petition') && !c.flag('d9.sig.' + k);
function sign(c, k, name) {
  c.flag('d9.sig.' + k, true);
  c.G.hud?.toast?.('PETITION', `${name} signed`, '#b98cff');
  c.emit('talk:' + k);
}
const ASK = { label: 'Will you sign my petition?', key: 'sign' };
const ELSE = { label: 'Something else.', key: 'prev' };
const once = (npc, key, line, rel = 2, when = () => true) => async (c, prev) => {
  if (c.day !== 9 || c.flag(key) || !when(c)) return prev(c);
  c.flag(key, true);
  await c.say(npc, line);
  c.rel(rel);
};

export const DIALOG = {
  dolly: async (c, prev) => {
    if (c.day !== 9) return prev(c);
    if (canSign(c, 'dolly')) {
      if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
      await c.say('dolly', 'd9.d.sign');
      sign(c, 'dolly', 'Dolly Finch');
      c.rel(3);
      if (c.flag('trackerOnDog') && !c.flag('d9.d.chatted')) { c.flag('d9.d.chatted', true); await c.say('dolly', 'd9.d.dog'); }
      return;
    }
    return once('dolly', 'd9.d.chatted', 'd9.d.dog', 1, (cc) => cc.flag('trackerOnDog'))(c, prev);
  },
  hank: async (c, prev) => {
    if (c.day !== 9 || !canSign(c, 'hank')) return prev(c);
    if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
    if (c.level >= 1) { await c.say('hank', 'd9.h.sign'); sign(c, 'hank', 'Hank Brubaker'); c.rel(2); return; }
    await c.say('hank', 'd9.h.nails');
    const k = await c.choose(['Buy the nails. ($5)', 'Maybe later.']);
    if (k === 0 && c.state.money >= 5) {
      c.money(-5, 'box of nails');
      c.give('nails');
      await c.say('hank', 'd9.h.nails2');
      sign(c, 'hank', 'Hank Brubaker');
      c.rel(4);
    }
  },
  tommy: async (c, prev) => {
    if (c.day !== 9 || !canSign(c, 'tommy')) return prev(c);
    if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
    await c.say('tommy', 'd9.t.sign');
    sign(c, 'tommy', 'Tommy Aqpik');
    c.rel(3);
  },
  nina: async (c, prev) => {
    if (c.day !== 9) return prev(c);
    const posters = c.G.missions.isActive('d9.posters') && !c.flag('d9.posters.got') && !c.hasItem('poster');
    const opts = [];
    if (canSign(c, 'nina')) opts.push(ASK);
    if (posters) opts.push({ label: 'Could you print me some posters?', key: 'posters' });
    if (!opts.length) return prev(c);
    opts.push(ELSE);
    const k = await c.choose(opts);
    if (k === 'sign') { await c.say('nina', 'd9.ni.sign'); sign(c, 'nina', 'Nina Kowalczyk'); c.rel(3); return; }
    if (k === 'posters') { await c.say('nina', 'd9.ni.posters'); c.give('poster', 3); c.flag('d9.posters.got', true); c.rel(3); c.emit('talk:nina'); return; }
    return prev(c);
  },
  gabriel: async (c, prev) => {
    if (c.day !== 9 || !canSign(c, 'gabriel')) return prev(c);
    if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
    await c.say('gabriel', c.level >= 1 || c.flag('bellFixed') ? 'd9.g.sign' : 'd9.g.plain');
    sign(c, 'gabriel', 'Father Gabriel');
    c.rel(2);
  },
  ellen: async (c, prev) => {
    if (c.day !== 9 || !canSign(c, 'ellen')) return prev(c);
    if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
    await c.say('ellen', c.level >= 1 ? 'd9.e.sign' : 'd9.e.checkup');
    sign(c, 'ellen', 'Doc Haverford');
    c.rel(3);
  },
  pearl: async (c, prev) => {
    if (c.day !== 9) return prev(c);
    const opts = [];
    if (c.G.missions.isActive('d9.fax') && c.flag('d9.fax.called') && !c.flag('d9.sig.koshkin')) opts.push({ label: 'Did a fax come in from Nome?', key: 'fax' });
    if (canSign(c, 'pearl')) opts.push(ASK);
    if (c.G.missions.isActive('d9.posters') && !c.flag('d9.posters.got') && !c.hasItem('poster')) opts.push({ label: 'Can I use your copier for posters? ($15)', key: 'copy' });
    if (!opts.length) return prev(c);
    opts.push(ELSE);
    const k = await c.choose(opts);
    if (k === 'fax') { await c.say('pearl', 'd9.p.fax'); sign(c, 'koshkin', 'Sasha Koshkin'); c.rel(2); return; }
    if (k === 'copy') {
      await c.say('pearl', 'd9.p.copy');
      if (c.state.money >= 15) { c.money(-15, 'posters'); c.give('poster', 3); c.flag('d9.posters.got', true); c.emit('talk:pearl'); }
      return;
    }
    if (k === 'sign') {
      if (c.level >= 1) { await c.say('pearl', 'd9.p.sign'); sign(c, 'pearl', 'Pearl Jessup'); c.rel(2); return; }
      await c.say('pearl', 'd9.p.stamps');
      const k2 = await c.choose(['A book of stamps, then. ($10)', 'Another time.']);
      if (k2 === 0 && c.state.money >= 10) { c.money(-10, 'stamps'); c.give('stamps'); await c.say('pearl', 'd9.p.sign'); sign(c, 'pearl', 'Pearl Jessup'); c.rel(4); }
      return;
    }
    return prev(c);
  },
  wade: async (c, prev) => {
    if (c.day !== 9 || !canSign(c, 'wade')) return prev(c);
    if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
    if (c.level >= 1 || c.flag('rodeWithWade')) { await c.say('wade', 'd9.wa.sign'); sign(c, 'wade', 'Wade Tolliver'); c.rel(2); return; }
    await c.say('wade', 'd9.wa.push');
    if ((await c.choose(['(Help push the plane.)', 'Never mind.'])) === 0) {
      await c.say('wade', 'd9.wa.thanks');
      await c.say('wade', 'd9.wa.sign');
      sign(c, 'wade', 'Wade Tolliver');
      c.rel(6);
    }
  },
  koshkin: async (c, prev) => {
    if (c.day !== 9 || !canSign(c, 'koshkin') || (c.flag('koshkinHospital') && !c.flag('koshkinBack'))) return prev(c);
    if ((await c.choose([ASK, ELSE])) !== 'sign') return prev(c);
    await c.say('koshkin', 'd9.k.sign');
    sign(c, 'koshkin', 'Sasha Koshkin');
    c.rel(3);
  },
  lou: async (c, prev) => {
    if (c.day !== 9 || !c.flag('running') || c.flag('d9.lo.offered')) return prev(c);
    const k = await c.choose([{ label: 'Up for a game of darts?', key: 'darts' }, ELSE]);
    if (k !== 'darts') return prev(c);
    c.flag('d9.lo.offered', true);
    await c.say('lou', 'd9.lo.darts');
    c.start('d9.darts');
  },
  marta: async (c, prev) => {
    if (c.day !== 9 || c.flag('d9.m.chatted') || !c.flag('running')) return prev(c);
    c.flag('d9.m.chatted', true);
    await c.you("Chief, I'm collecting signatures for Ray's seat.");
    await c.say('marta', 'd9.m.sign');
    if (c.flag('martaToldBreakIn') || c.level >= 2) { await c.say('marta', 'd9.m.luck'); c.rel(3); }
  },
  evan: async (c, prev) => {
    if (c.day !== 9 || c.flag('d9.ev.chatted')) return prev(c);
    if (!c.flag('trackerOnDog') && !c.flag('running')) return prev(c);
    c.flag('d9.ev.chatted', true);
    await c.say('evan', c.flag('trackerOnDog') ? 'd9.ev.dog' : 'd9.ev.sign');
  },
  ruth: once('ruth', 'd9.r.chatted', 'd9.r.chat', 3, (c) => c.flag('running')),
  ray: once('ray', 'd9.ry.chatted', 'd9.ry.after', 2, (c) => c.flag('running')),
  walt: once('walt', 'd9.w.chatted', 'd9.w.neutral', 2, (c) => c.flag('running')),
  lyle: once('lyle', 'd9.ly.chatted', 'd9.ly.cute', 0, (c) => c.flag('running')),
  gideon: once('gideon', 'd9.gi.chatted', 'd9.gi.chat', 0, (c) => c.flag('running')),
};
export const DIALOG_OVERRIDE = true;
