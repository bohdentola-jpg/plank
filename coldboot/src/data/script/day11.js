// DAY 11 — The Mayor's Ear (Thursday). Four days to dawn. The vault needs the
// mayor's municipal key: a brass civil-defence key Walt never takes off. Walt
// broke his late wife June's music box; fix it (a donor box and a candle from
// Father Gabriel, glue from Hank), bring it back, and listen. Earn the key
// (mayorKeyGiven) or press it into candle wax and cut a copy (mayorKeyCopied).
// Walt tells you about Halloran's Winter Gala at the Dome on Sunday.
// Side: debate prep with Ruth; Lyle and Gideon overheard at lunch behind Northstar.
export const DAY = { n: 11, start: ['d11.key'], mustFinish: ['d11.night'] };

const pt = (G, name, fb, dx = 0, dz = 0) => { const q = G.town?.points?.[name]; return q ? { x: q.x + dx, z: q.z + dz } : { x: fb.x + dx, z: fb.z + dz }; };
const MAYOR = { x: 22, z: -64 };       // fallback for cityhall.mayorOffice
const LOT = { x: -46, z: 9 };          // behind NORTHSTAR 24, by the dumpsters
const hold = (m, test, text, where, sub) => m.until(() => { if (text && !m.G.hud?.objective) m.obj(text, where, sub); return test(); });
const lvl = (G, id) => Math.min(5, Math.floor((G.state.rel[id] || 0) / 20));

export const LINES = {
  // ---------------------------------------------------------------- morning
  'd11.h.ad': { who: 'halloran', en: 'This is Cyrus Halloran. Some towns forget how to live through the dark. Port Zarya never did. That is why I chose you. Northstar Dynamics. Keeping the lights on.' },
  'd11.l.ad': { who: 'lyosha', ru: '«Поддерживаем свет». Ага. Ещё четыре дня.', en: "'Keeping the lights on.' Sure. For four more days.", emo: 'frown' },
  'd11.n.morning': { who: 'nadia', ru: 'Четыре дня, Рыбка. Сегодня — мэр.', en: 'Four days, Rybka. Today: the mayor.', emo: 'serious' },
  'd11.l.key': { who: 'lyosha', ru: 'Хранилище открывается двумя вещами. Три карточки совета — это код. Но код без замка — просто цифры. А замок открывает муниципальный ключ.', en: "The vault opens with two things. Three council cards: that's the code. But a code without a lock is just numbers. The lock takes the municipal key." },
  'd11.v.key': { who: 'valya', ru: 'Старый латунный ключ, рыбка. От бомбоубежища, с пятидесятых. Мэр носит его на связке, как талисман.', en: 'An old brass key, little fish. To the fallout shelter, from the fifties. The mayor wears it on his key ring like a charm.' },
  'd11.dm.key': { who: 'dmitri', ru: 'Хэллоран любит символы. Ключ от города открывает его сейф. Ему это кажется остроумным.', en: 'Halloran loves symbols. The key to the town opens his safe. He thinks that is witty.', emo: 'serious' },
  'd11.n.debt': { who: 'nadia', ru: 'Про его долг «Нордстару» мы уже знаем. Не дави на это. Он и так раздавлен.', en: "We already know about his debt to Northstar. Don't press on it. He's crushed enough as it is.", emo: 'serious' },
  'd11.n.ways': { who: 'nadia', ru: 'Есть два пути. Мэр может отдать ключ сам — если поверит тебе. Или мы снимем слепок. Первый путь лучше. Второй быстрее.', en: 'There are two ways. The mayor can give you the key himself, if he trusts you. Or we take an impression. The first way is better. The second is faster.' },
  // ---------------------------------------------------------------- Walt and June's music box
  'd11.w.box': { who: 'walt', en: "Oh. It's you. Sorry. Sit, sit. Don't mind me. I knocked June's music box off the shelf last night. Thirty-eight years, it never had a scratch.", emo: 'worry' },
  'd11.w.june': { who: 'walt', en: 'My wife. June. She wound it every night before bed. Some old Russian waltz her grandmother brought from Sitka. Now it just clicks.' },
  'd11.w.fix': { who: 'walt', en: "Would you? Lord. Yes. Careful with it. The lid's cracked and something rattles inside. Hank won't touch it. Says it's jewellery, not hardware." },
  'd11.w.sorry': { who: 'walt', en: "So am I. Every day. You're a carpenter, aren't you? Could you look at it? I can't bear to throw it out.", emo: 'worry' },
  'd11.w.chat': { who: 'walt', en: "Any luck with June's box? No rush. It's waited since last night. I've waited since March." },
  'd11.l.box': { who: 'lyosha', ru: 'Механизм простой. Сломан зубец гребёнки и треснула крышка. Нужна гребёнка от другой шкатулки — и клей.', en: 'Simple movement. One tooth of the comb is broken and the lid is cracked. We need a comb from another music box — and glue.' },
  'd11.g.box': { who: 'grisha', ru: 'Я в молодости чинил такие на рынке в Анадыре. Гребёнку не паяй — только меняй целиком. Ищи старую шкатулку.', en: "When I was young I fixed these at the market in Anadyr. Don't solder the comb — swap the whole thing. Find an old music box." },
  'd11.n.candle': { who: 'nadia', ru: 'И попроси у отца Гавриила свечной огарок. На всякий случай.', en: 'And ask Father Gabriel for a candle stub. Just in case.' },
  'd11.g.june': { who: 'gabriel', en: "June Hennessey's music box? She brought it to every Christmas social and played it for the children. Hold on. I have something." },
  'd11.g.donor': { who: 'gabriel', en: 'A broken one, from the rummage table. Same maker, I think. Take its insides with my blessing. Walt has not sat in a pew since the funeral.' },
  'd11.g.candle': { who: 'gabriel', en: "A candle? Take two. Light one for June, if you think of it. And one for whatever it is you're carrying around in your face." },
  'd11.h.glue': { who: 'hank', en: "Hide glue? For a music box? Walt's? Huh. Here. No charge. Don't tell anybody I'm soft." },
  'd11.v.waltz': { who: 'valya', ru: 'Ох… «На сопках Маньчжурии». Мой отец под неё танцевал. Надо же — на Аляске.', en: "Oh… 'On the Hills of Manchuria.' My father used to dance to that. Imagine — in Alaska.", emo: 'smile' },
  'd11.w.plays': { who: 'walt', en: 'Listen. Listen to that. She used to hum along, always half a beat behind. Drove me crazy for thirty-eight years.', emo: 'smile' },
  'd11.w.debt': { who: 'walt', en: 'You know what I did? When June got sick, the treatments in Anchorage cost more than this house. More than this town pays me in ten years.', emo: 'worry' },
  'd11.w.debt2': { who: 'walt', en: "Halloran's people came with a cheque. Campaign support, they called it. Twenty-five thousand. I took it. She died anyway, in March. And now they own me.", emo: 'worry' },
  'd11.w.anybody': { who: 'walt', en: "Anybody would. That's what I tell myself at three in the morning. It doesn't help as much as you'd think." },
  'd11.w.stop': { who: 'walt', en: "Stop? Friend, you don't stop Cyrus Halloran. You smile at his gala and say thank you for the streetlights.", emo: 'frown' },
  'd11.w.quiet': { who: 'walt', en: 'Thank you. Nobody lets me talk about her. They all change the subject to the weather.', emo: 'smile' },
  'd11.w.gala': { who: 'walt', en: 'Sunday night he throws his Winter Gala up at the Dome. The Development Board, the council, the mayor. I have to give a toast. To him. God help me.' },
  'd11.w.key': { who: 'walt', en: "See this? Brass. Key to the old civil defence shelter on Kettle Hill. Every mayor since fifty-eight has carried it. Halloran made me promise never to take it off. Funny thing to ask a man." },
  'd11.w.give': { who: 'walt', en: "For good. You mean that. You've got the look June had when she'd made up her mind about something.", emo: 'serious' },
  'd11.w.give2': { who: 'walt', en: "Take it. If anybody asks, I lost it fishing. Mayors lose things. Bring it back if you can. And if you can't, make it count.", emo: 'serious' },
  'd11.w.cant': { who: 'walt', en: "Nobody gets Halloran out of anything. I'm sorry, friend. I can't. He'd know in an hour, and then he'd own you too.", emo: 'worry' },
  'd11.w.thanks': { who: 'walt', en: "Go on, now. And thank you. You gave me back her waltz. I don't know what that's worth. More than twenty-five thousand." },
  // ---------------------------------------------------------------- the key: given or copied
  'd11.n.given': { who: 'nadia', ru: 'Он отдал его сам. Рыбка… он тебе поверил. Не подведи его.', en: "He gave it to you himself. Rybka… he believed you. Don't let him down.", emo: 'smile' },
  'd11.i.given': { who: 'ivan', ru: 'Хороший ключ. Береги его.', en: 'A good key. Look after it.' },
  'd11.dm.given': { who: 'dmitri', ru: 'Человек отдал тебе ключ от своего города. Это доверие. Доверие не скопируешь.', en: "A man gave you the key to his own town. That is trust. Trust can't be copied.", emo: 'serious' },
  'd11.i.copied': { who: 'ivan', ru: 'Копия хорошая. Я бы не отличил.', en: "A good copy. I couldn't tell the difference." },
  'd11.dm.copied': { who: 'dmitri', ru: 'Мы взяли то, что нам не давали. Иногда так надо. Но не привыкай.', en: "We took what wasn't given to us. Sometimes it has to be done. But don't get used to it.", emo: 'serious' },
  'd11.w.after': { who: 'walt', en: 'Lost my keys fishing today. Can you believe it? Fishing. In November. Ellen says I should get my head looked at.', emo: 'smile' },
  'd11.w.afterCopy': { who: 'walt', en: "Thanks again for June's box. I wound it twice tonight. Don't tell anybody. They'll think I've gone soft.", emo: 'smile' },
  'd11.n.wax': { who: 'nadia', ru: 'Значит, слепок. Смотри: он снова заводит шкатулку, а ключи положил на стол. Воск у тебя есть.', en: "Then an impression. Look: he's winding the box again, and he's put his keys down on the desk. You have the wax.", emo: 'serious' },
  'd11.n.window': { who: 'nadia', ru: 'Он у окна. Слушает. Сейчас. Тихо.', en: "He's at the window. Listening. Now. Quietly.", emo: 'serious' },
  'd11.g.smudge': { who: 'grisha', ru: 'Смазано… но жить можно. Я и не с таким работал.', en: "Smudged… but we can live with it. I've worked from worse." },
  'd11.g.blank': { who: 'grisha', ru: 'Теперь заготовка. У Хэнка есть болванки. Напильник, терпение — и никакой спешки.', en: 'Now a blank. Hank has key blanks. A file, patience — and no rushing.' },
  'd11.h.blank': { who: 'hank', en: 'Key blank? Brass, the old kind? I\'ve got a drawer full. Two bucks. Whatever you\'re locking, I hope it stays locked.' },
  'd11.g.copied': { who: 'grisha', ru: 'Хорошая копия. Замок не отличит. А мэр так и не узнает.', en: "A good copy. The lock won't know the difference. And the mayor will never find out." },
  'd11.n.copied': { who: 'nadia', ru: 'Мне это не нравится. Но конец света мне нравится ещё меньше.', en: "I don't like it. But I like the end of the world even less.", emo: 'frown' },
  'd11.n.gala': { who: 'nadia', ru: 'Гала у Хэллорана, в воскресенье, в Куполе. Это наша дверь. Теперь нам нужно приглашение.', en: "Halloran's gala, on Sunday, at the Dome. That's our door. Now we need an invitation." },
  'd11.n.lesson': { who: 'nadia', ru: 'Домой, Рыбка. Лёша ждёт.', en: "Home, Rybka. Lyosha's waiting." },
  'd11.l.after': { who: 'lyosha', ru: 'Список в словаре, словарь в списке. Как матрёшка. Баба Валя тебе, кстати, одну дала — не открывай пока.', en: "A list in a dictionary, a dictionary in a list. Like a matryoshka. Baba Valya gave you one, by the way — don't open it yet.", emo: 'smile' },
  'd11.n.night': { who: 'nadia', ru: 'Мы так высоко забрались, Рыбка. Осталось чуть-чуть. Спи. Завтра — три дня.', en: "We've climbed so high, Rybka. Just a little further. Sleep. Tomorrow: three days.", emo: 'smile' },
  // ---------------------------------------------------------------- side: debate prep
  'd11.r.prep': { who: 'ruth', en: 'Sit. Lyle will talk about broadband and jobs and the future. He always talks about the future. People who own the future never have to explain the present.' },
  'd11.r.prep2': { who: 'ruth', en: 'When he says jobs, you say the cannery. When he says safety, you say cameras. When he says the future, you ask him whose.' },
  'd11.r.prep3': { who: 'ruth', en: "And don't get angry. Angry looks like losing. Smile like you know where the bodies are buried. In this town, you probably do.", emo: 'smile' },
  // ---------------------------------------------------------------- side: Lyle and Gideon at lunch
  'd11.ly.over1': { who: 'lyle', en: 'The count is handled, Gideon. Pearl counts, but our people carry the boxes. Nobody watches the boxes.', emo: 'smile' },
  'd11.gi.over1': { who: 'gideon', en: 'Nothing is handled until Saturday night. Mr. Halloran wants the seat. He wants a quiet council for the gala. Quiet, Lyle.', emo: 'serious' },
  'd11.ly.over2': { who: 'lyle', en: 'And the dock? After Sunday, does it even matter what the council thinks?' },
  'd11.gi.over2': { who: 'gideon', en: 'After Sunday, nothing will matter at all. Finish your sandwich.' },
  'd11.n.over': { who: 'nadia', ru: '«После воскресенья ничего не будет иметь значения». Рыбка, они знают. Они все знают, что будет.', en: "'After Sunday, nothing will matter at all.' Rybka, they know. They all know what's coming.", emo: 'worry' },
  'd11.l.boxes': { who: 'lyosha', ru: 'И урны. «Наши люди носят урны». Значит, в субботу смотрим не на подсчёт, а на урны.', en: "And the ballot boxes. 'Our people carry the boxes.' So on Saturday we don't watch the count. We watch the boxes." },
  // ---------------------------------------------------------------- around town
  'd11.d.chat': { who: 'dolly', en: "June Hennessey made the best rhubarb pie in the county, and I'll only say that once, because I make the second best. Walt hasn't eaten a proper meal since March.", emo: 'worry' },
  'd11.ry.chat': { who: 'ray', en: 'Debate\'s tomorrow night. Wear the pin if you\'ve got it. And when Lyle says jobs, look straight at me.' },
  'd11.ly.chat': { who: 'lyle', en: 'Tomorrow night, handyman. The Parish Hall. Bring a hard hat.', emo: 'smile' },
  'd11.gi.chat': { who: 'gideon', en: 'The mayor tells me you\'ve been visiting. The mayor tells me everything. Eventually.' },
  'd11.m.deal': { who: 'marta', en: "Okafor says the gala guest list is longer this year. Says he's on it. Consultant. He didn't say for whom." },
  'd11.m.hostile': { who: 'marta', en: 'Okafor asked me for your cabin\'s address. I told him to look it up. He already had.', emo: 'frown' },
  'd11.ev.chat': { who: 'evan', en: 'Big debate tomorrow! Northstar is proudly sponsoring the refreshments. Hydration is democracy!', emo: 'smile' },
  'd11.ni.chat': { who: 'nina', en: "Debate's tomorrow and I'm broadcasting it live! Please don't say anything I'll get fined for. Or do. Ratings.", emo: 'laugh' },
  'd11.lo.chat': { who: 'lou', en: "Half the Anchor's going to the debate tomorrow. The other half is betting on it. Lyle's favoured. Don't tell him I said so." },
  'd11.t.chat': { who: 'tommy', en: "Grandma's been practising Lyle's voice all week so she can boo it accurately. It's terrifying.", emo: 'laugh' },
  'd11.e.chat': { who: 'ellen', en: "Walt hasn't been in for his blood pressure since March. If you see him, tell him the doctor said so. He listens to everybody but me." },
  'd11.wa.chat': { who: 'wade', en: "Clear skies, finally. If you've been meaning to take a flying lesson, today's the day. The Dragonfly's in a good mood.", emo: 'smile' },
  'd11.wa.flown': { who: 'wade', en: "Look at you, walking around like a pilot. Careful. Next thing you know, you'll be talking about crosswinds at parties.", emo: 'laugh' },
  'd11.k.chat': { who: 'koshkin', en: "Home! The jars survived. My pickles survived. The carpenter survived. Nome did not deserve me.", emo: 'laugh' },
  'd11.p.chat': { who: 'pearl', en: "Gala invitations went out this morning. Thick cream envelopes, gold edges. None for you, hon. Yet.", emo: 'smile' },
};

/** The square's looped cameras stay looped after a reload (the loop lives in Lyosha's tap, not in the save). */
const reloop = (m) => { const A = m.G.attention; if (!m.flag('camsLooped') || !A) return; (A.watchers || []).forEach((w, i) => { if (w.owner === 'smartlight' && Math.hypot(w.x, w.z) < 80) A.looped?.add(i); }); };

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd11.key': {
    title: "The Mayor's Ear", main: true, day: 11,
    async run(m, from) {
      reloop(m);
      const G = m.G, inv = G.state.inv;
      if (m.cp(1, from)) {
        await m.wait(1.0);
        await m.ear('d11.h.ad');
        await m.ear('d11.l.ad');
        await m.ear('d11.n.morning');
        await m.ears(['d11.l.key', 'd11.v.key', 'd11.dm.key', 'd11.n.ways']);
        if (m.flag('intel.mayorDebt')) await m.ear('d11.n.debt');
        m.start('d11.ruth');
        m.start('d11.lyle');
      }
      if (m.cp(2, from)) {
        m.obj('Visit Mayor Walt', 'walt', 'City Hall, 9:00–17:00 · the diner at noon');
        await hold(m, () => m.flag('d11.walt.met'), 'Visit Mayor Walt', 'walt', 'City Hall, 9:00–17:00 · the diner at noon');
      }
      if (m.cp(3, from)) {
        await m.ear('d11.l.box');
        await m.ear('d11.g.box');
        m.ear('d11.n.candle');
        let last = '';
        await m.until(() => {
          const donor = (inv.donor_box || 0) > 0, glue = (inv.hide_glue || 0) > 0;
          const s = `${donor ? 1 : 0}${glue ? 1 : 0}`;
          if (s !== last || !G.hud?.objective) {
            last = s;
            if (!donor) m.obj('Find a donor music box', 'gabriel', glue ? 'Father Gabriel, Holy Transfiguration' : 'Father Gabriel — and glue from Hank');
            else m.obj('Get glue for the lid', 'hank', 'Brubaker Hardware');
          }
          return donor && glue;
        });
      }
      if (m.cp(4, from)) {
        m.obj("Repair June's music box", 'cabin.workbench', 'Your cabin workbench');
        await m.spot('box', 'cabin.workbench', 'Repair the music box', 2.4);
        await m.minigame('glass', { title: 'SET THE NEW COMB' });
        await m.minigame('paint', { title: 'GLUE AND CLAMP THE LID' });
        inv.donor_box = 0; inv.hide_glue = 0;
        m.flag('musicBoxFixed', true);
        G.sfx?.musicBox?.();
        G.hud.toast('REPAIRED', "June's music box plays again", '#9fe8b0');
        await m.ear('d11.v.waltz');
      }
      if (m.cp(5, from)) {
        m.obj("Bring June's music box back to Walt", 'cityhall.mayorOffice', 'City Hall — he works late this week');
        await m.reach('cityhall.mayorOffice', 5);
      }
      if (m.cp(6, from)) {
        m.clear();
        let trust = 0, given = false;
        await m.scene(async (d) => {
          await d.bring('walt', 'cityhall.mayorDesk', { face: 'player' });
          await d.say('walt', 'd11.w.plays', { cam: d.closeUp('walt') });
          await d.say('walt', 'd11.w.debt', { cam: d.closeUp('walt', { side: -1 }) });
          await d.say('walt', 'd11.w.debt2');
          const k = await d.choose(['You did it for her. Anybody would have.', 'Then stop letting them.', '(Say nothing. Let him talk.)'], { prompt: 'WALT' });
          await d.say('walt', ['d11.w.anybody', 'd11.w.stop', 'd11.w.quiet'][k] || 'd11.w.quiet', { cam: d.closeUp('walt') });
          if (k !== 1) trust++;
          await d.say('walt', 'd11.w.gala', { cam: d.closeUp('walt', { side: -1, dist: 0.9 }) });
          await d.say('walt', 'd11.w.key', { cam: d.closeUp('walt', { dist: 0.6 }) });
          const k2 = await d.choose(['Walt, what if someone could get Halloran out of this town for good?', '(Say nothing about the key.)'], { prompt: 'THE BRASS KEY' });
          if (k2 === 0) {
            const score = trust + (G.state.standing >= 10 ? 1 : 0) + (lvl(G, 'walt') >= 1 ? 1 : 0) + (m.flag('radioDone') ? 1 : 0) + (m.flag('okaforDeal') ? 1 : 0);
            if (score >= 2) {
              given = true;
              await d.say('walt', 'd11.w.give', { cam: d.closeUp('walt') });
              await d.say('walt', 'd11.w.give2', { cam: d.closeUp('walt', { side: -1, dist: 0.6 }) });
            } else await d.say('walt', 'd11.w.cant', { cam: d.closeUp('walt') });
          }
          await d.say('walt', 'd11.w.thanks', { cam: d.overShoulder('player', 'walt') });
        });
        m.flag('knowsGala', true);
        inv.music_box = 0;
        G.state.rel.walt = Math.min(100, (G.state.rel.walt || 0) + 15 + trust * 5);
        if (given) {
          m.flag('mayorKey', true);
          m.flag('mayorKeyGiven', true);
          inv.municipal_key = 1;
          G.hud.toast('ITEM', "The mayor's brass key", '#ffd166');
          await m.ear('d11.n.given');
          await m.ear('d11.i.given');
          await m.ear('d11.dm.given');
        }
      }
      if (m.cp(7, from)) {
        if (!m.flag('mayorKeyGiven')) {
          await m.ear('d11.n.wax');
          m.obj('Take a wax impression of the brass key', 'cityhall.mayorDesk', 'His keys are on the desk — while the waltz plays');
          await m.spot('wax', 'cityhall.mayorDesk', 'Press the key into the wax', 2.4);
          const p = pt(G, 'cityhall.mayorDesk', MAYOR);
          await m.ear('d11.n.window');
          G.attention.zone('d11.mayor', p.x, p.z, 6, 8, 'City Hall');
          G.attention.act(1.4, 8);
          const ok = await m.minigame('lock', { title: 'WAX IMPRESSION' });
          G.attention.clearZone('d11.mayor');
          if (!ok) { G.attention.add(12); await m.ear('d11.g.smudge'); }
          inv.candle = Math.max(0, (inv.candle || 1) - 1);
          inv.wax_impression = 1;
          m.flag('d11.needBlank', true);
          await m.ear('d11.g.blank');
        }
      }
      if (m.cp(8, from)) {
        if (!m.flag('mayorKeyGiven')) {
          m.obj('Get a brass key blank', 'hank', "Brubaker Hardware, $2 — or the key drawer in Koshkin's back room");
          m.spot('drawer', 'koshkin.backroom', "Search Koshkin's key drawer", 2.4).then(() => { if (!(inv.key_blank > 0) && !m.flag('mayorKey')) { inv.key_blank = 1; G.hud.toast('ITEM', 'An old brass key blank'); } });
          await hold(m, () => (inv.key_blank || 0) > 0, 'Get a brass key blank', 'hank', "Brubaker Hardware, $2 — or the key drawer in Koshkin's back room");
          G.interact?.remove?.(`${m.id}:drawer`);
        }
      }
      if (m.cp(9, from)) {
        if (!m.flag('mayorKeyGiven')) {
          m.obj('File the copy at your workbench', 'cabin.workbench');
          await m.spot('file', 'cabin.workbench', 'File the key', 2.4);
          await m.minigame('saw', { title: 'FILE THE KEY' });
          inv.key_blank = 0; inv.wax_impression = 0;
          inv.municipal_key = 1;
          m.flag('mayorKey', true);
          m.flag('mayorKeyCopied', true);
          G.hud.toast('ITEM', 'A copy of the brass key', '#ffd166');
          await m.ear('d11.g.copied');
          await m.ear('d11.n.copied');
          await m.ear('d11.i.copied');
          await m.ear('d11.dm.copied');
        }
      }
      if (m.cp(10, from)) {
        await m.ear('d11.n.gala');
        m.done();
        m.start('d11.night');
      }
    },
  },

  'd11.night': {
    title: 'Night School: Matryoshka Data', main: true, day: 11,
    async run(m, from) {
      reloop(m);
      if (m.cp(1, from)) {
        await m.ear('d11.n.lesson');
        m.obj("Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 11: Matryoshka Data');
        await hold(m, () => m.G.state.lessons.l11, "Lyosha's lesson — the laptop in your cabin", 'cabin.laptop', 'Lesson 11: Matryoshka Data');
      }
      if (m.cp(2, from)) {
        await m.ear('d11.l.after');
        await m.ear('d11.n.night');
        m.done();
      }
    },
  },

  // ---------------------------------------------------------------- side
  'd11.ruth': {
    title: 'Debate Prep', day: 11,
    async run(m, from) {
      if (m.cp(1, from)) {
        m.obj('Ruth offered to prepare you for the debate', 'ruth', 'Post office mornings · the Parish Hall afternoons');
        await m.until(() => m.flag('ruthPrep'));
        m.done();
      }
    },
  },

  'd11.lyle': {
    title: 'Lunch at Northstar', day: 11,
    async run(m, from) {
      const G = m.G;
      if (m.cp(1, from)) {
        m.obj('Overhear Lyle at lunch', LOT, 'Behind NORTHSTAR 24, 12:00–13:00 — stay out of sight');
        await m.until(() => { const h = G.state.hour; return h >= 11.9 && h < 13.2; });
        await m.spot('listen', LOT, 'Listen from behind the dumpsters', 3);
      }
      if (m.cp(2, from)) {
        G.attention.zone('d11.lot', LOT.x, LOT.z, 7, 5, 'Northstar lot');
        G.attention.act(0.8, 12);
        await m.scene(async (d) => {
          await d.bring('lyle', { x: -45, z: 2 }, { face: 'gideon' });
          await d.bring('gideon', { x: -44.5, z: 0 }, { face: 'lyle' });
          await d.say('lyle', 'd11.ly.over1', { cam: d.closeUp('lyle') });
          await d.say('gideon', 'd11.gi.over1', { cam: d.closeUp('gideon') });
          await d.say('lyle', 'd11.ly.over2', { cam: d.closeUp('lyle', { side: -1 }) });
          await d.say('gideon', 'd11.gi.over2', { cam: d.closeUp('gideon', { dist: 0.6 }) });
        });
        G.attention.clearZone('d11.lot');
        m.flag('lyleDirt', true);
        m.flag('watchBoxes', true);
        await m.ear('d11.n.over');
        await m.ear('d11.l.boxes');
        m.done();
      }
    },
  },
};

// ---------------------------------------------------------------- conversations
const once = (npc, key, line, rel = 2, when = () => true) => async (c, prev) => {
  if (c.day !== 11 || c.flag(key) || !when(c)) return prev(c);
  c.flag(key, true);
  await c.say(npc, typeof line === 'function' ? line(c) : line);
  c.rel(rel);
};
const boxQuest = (c) => c.G.missions.isActive('d11.key') && c.flag('d11.walt.met') && !c.flag('musicBoxFixed');

export const DIALOG = {
  walt: async (c, prev) => {
    if (c.day !== 11) return prev(c);
    if (c.G.missions.isActive('d11.key') && !c.flag('d11.walt.met')) {
      await c.say('walt', 'd11.w.box');
      await c.say('walt', 'd11.w.june');
      const k = await c.choose(['Let me take a look. I fix things.', "I'm sorry, Walt."]);
      await c.say('walt', k === 0 ? 'd11.w.fix' : 'd11.w.sorry');
      c.give('music_box');
      c.flag('d11.walt.met', true);
      c.rel(5);
      c.emit('talk:walt');
      return;
    }
    if (boxQuest(c)) { await c.say('walt', 'd11.w.chat'); return; }
    if (c.flag('knowsGala') && !c.flag('d11.w.afterChat')) {
      c.flag('d11.w.afterChat', true);
      await c.say('walt', c.flag('mayorKeyGiven') ? 'd11.w.after' : 'd11.w.afterCopy');
      c.rel(2);
      return;
    }
    return prev(c);
  },
  gabriel: async (c, prev) => {
    if (c.day !== 11 || !boxQuest(c) || c.hasItem('donor_box')) return prev(c);
    const k = await c.choose([{ label: 'Father, do you have an old music box? It\'s for Walt.', key: 'box' }, { label: 'Something else.', key: 'prev' }]);
    if (k !== 'box') return prev(c);
    await c.say('gabriel', 'd11.g.june');
    await c.say('gabriel', 'd11.g.donor');
    c.give('donor_box');
    await c.say('gabriel', 'd11.g.candle');
    c.give('candle', 2);
    c.rel(5);
    c.emit('talk:gabriel');
  },
  hank: async (c, prev) => {
    if (c.day !== 11) return prev(c);
    const opts = [];
    if (boxQuest(c) && !c.hasItem('hide_glue')) opts.push({ label: 'I need glue for a music box. Walt\'s.', key: 'glue' });
    if (c.G.missions.isActive('d11.key') && c.flag('d11.needBlank') && !c.hasItem('key_blank') && !c.flag('mayorKey')) opts.push({ label: 'A brass key blank, the old kind. ($2)', key: 'blank' });
    if (!opts.length) return prev(c);
    opts.push({ label: 'Something else.', key: 'prev' });
    const k = await c.choose(opts);
    if (k === 'glue') { await c.say('hank', 'd11.h.glue'); c.give('hide_glue'); c.rel(4); c.emit('talk:hank'); return; }
    if (k === 'blank') { await c.say('hank', 'd11.h.blank'); if (c.state.money >= 2) { c.money(-2, 'key blank'); c.give('key_blank'); } c.emit('talk:hank'); return; }
    return prev(c);
  },
  ruth: async (c, prev) => {
    if (!c.G.missions.isActive('d11.ruth') || c.flag('ruthPrep')) return prev(c);
    await c.say('ruth', 'd11.r.prep');
    await c.say('ruth', 'd11.r.prep2');
    await c.say('ruth', 'd11.r.prep3');
    c.flag('ruthPrep', true);
    c.standing(2);
    c.rel(5);
    c.emit('talk:ruth');
  },
  marta: once('marta', 'd11.m.chatted', (c) => (c.flag('okaforDeal') ? 'd11.m.deal' : 'd11.m.hostile'), 2, (c) => c.flag('okaforDeal') || c.flag('okaforHostile')),
  dolly: once('dolly', 'd11.d.chatted', 'd11.d.chat'),
  ray: once('ray', 'd11.ry.chatted', 'd11.ry.chat'),
  lyle: once('lyle', 'd11.ly.chatted', 'd11.ly.chat', 0),
  gideon: once('gideon', 'd11.gi.chatted', 'd11.gi.chat', 0, (c) => c.flag('d11.walt.met')),
  evan: once('evan', 'd11.ev.chatted', 'd11.ev.chat', 0),
  nina: once('nina', 'd11.ni.chatted', 'd11.ni.chat'),
  lou: once('lou', 'd11.lo.chatted', 'd11.lo.chat'),
  tommy: once('tommy', 'd11.t.chatted', 'd11.t.chat'),
  ellen: once('ellen', 'd11.e.chatted', 'd11.e.chat'),
  pearl: once('pearl', 'd11.p.chatted', 'd11.p.chat'),
  wade: once('wade', 'd11.wa.chatted', (c) => (c.flag('flight1') ? 'd11.wa.flown' : 'd11.wa.chat')),
  koshkin: once('koshkin', 'd11.k.chatted', 'd11.k.chat', 3, (c) => !c.flag('koshkinHospital') || c.flag('koshkinBack')),
};
export const DIALOG_OVERRIDE = true;
