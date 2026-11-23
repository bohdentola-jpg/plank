// DAY 4 (Thursday) — The Seat. Overnight the council leased the cannery dock
// to Northstar; Ray Moody quits at the Rusty Anchor and hands Rybka his
// resignation (and his continuity card). At City Hall the charter sends the
// seat to a town meeting tonight: Ruth nominates Rybka against Lyle Pruitt.
// Walt sits with his late wife's broken music box. The petition round (Hank,
// Dolly, Father Gabriel, filed with Pearl by five) doubles as the errand for
// the music box's parts; fixed, it plays June's waltz, and Walt either hands
// over the mayor's brass key or Rybka presses it into candle wax. Northstar's
// payment ledger, photographed at Pruitt Realty. Seven o'clock: debate night
// at the Parish Hall (field hack 'ledger' on the projector, or not), the
// ballots, the Gala invitation, Ruth's card, and Gideon Shaw explaining what
// an asset is. Night School lesson 4 (strings).
//
// flags: running, rayQuit, petitionFiled, d11.walt.met, musicBoxFixed,
//   mayorKey + mayorKeyGiven | mayorKeyCopied, knowsGala, ledgerPhotos,
//   ruthPrep, debateScore, debateWon, debateDone, ledgerUsed, waltExposed,
//   wonSeat, appointed, galaInvite, galaInviteBy ('council' | 'board' | 'halloran'),
//   gideonThreat, share.<id>.
import {
  at, yawTo, dist, cu, rel, standing, level, item, warp, release, stage, keepTime, cap, clockTo, waitFor, hold, meet, hack, idle,
  shareCount, hasShare, takeShare,
} from './kit.js';

export const DAY = { n: 4, start: ['d4.seat'], mustFinish: ['d4.seat', 'd4.debate'] };

export const LINES = {
  // ---- morning: the news
  'd9.ni.news1': { who: 'nina', en: "Good morning, Port Zarya. This is KZRY, eighty-eight point nine, and it's minus twenty-two. Big news from last night's emergency session." },
  'd9.ni.news2': { who: 'nina', en: 'The council voted four to one to lease the cannery dock to Northstar Dynamics. Zarya Seafoods closes at the end of the month. Forty-one jobs. Ray Moody was the one no.' },
  'd9.ni.news3': { who: 'nina', en: 'Northstar says the dock will host a data centre. My mom says a data centre is a warehouse for nobody. Okay. Back to the music.' },
  'd9.l.dock': { who: 'lyosha', ru: 'Центр обработки данных? На краю света, на одном кабеле? Дело не в данных. Им нужен причал.', en: "A data centre? At the edge of the world, on one cable? It isn't about data. They need the dock." },
  'd9.dm.dock': { who: 'dmitri', ru: 'Причал у самого пролива. Чтобы уйти по воде, когда погаснет свет.', en: 'A dock right on the strait. So they can leave by water when the lights go out.', emo: 'serious' },
  'd9.lo.call': { who: 'lou', en: "Hey, carpenter. It's Lou, at the Anchor. Ray's been here since closing time. He's asking for you. Don't ask me why. Come round the back." },
  'd9.n.go': { who: 'nadia', ru: 'Иди. Человек, который голосует против «Нордстара», зовёт тебя. Такое не пропускают.', en: "Go. A man who votes against Northstar is asking for you. You don't pass that up." },
  // ---- the Rusty Anchor: Ray quits
  'd9.lo.back': { who: 'lou', en: "There you are. He won't go home, he won't eat, and he won't stop writing on my napkins. Talk to him. I'll get coffee." },
  'd9.ry.hello': { who: 'ray', en: "The handyman. Sit down. You're the only person in this town who fixes things instead of selling them.", emo: 'frown' },
  'd9.ry.vote': { who: 'ray', en: "Four to one. Forty-one families. Lyle Pruitt read his speech off Northstar letterhead. He didn't even cut the logo off.", emo: 'angry' },
  'd9.ry.letter': { who: 'ray', en: "My resignation. Third draft. The first two had words in them your mother wouldn't like." },
  'd9.ry.right': { who: 'ray', en: 'The right thing. Sure. The right thing and a dollar gets you half a coffee at Northstar.', emo: 'frown' },
  'd9.lo.sit': { who: 'lou', en: "That's the most sense anybody's talked in here all night.", emo: 'smile' },
  'd9.ry.done': { who: 'ray', en: "Eleven years on that council. I'm done being the only no. Let them have their dock. Let them have the whole damn town.", emo: 'angry' },
  'd9.ry.chair': { who: 'ray', en: "You think I don't know that? Lyle's had his eye on my chair since the day I sat in it." },
  'd9.ry.who': { who: 'ray', en: 'Who? Nobody. Unless somebody honest walks in off the street. Somebody nobody owns yet.' },
  'd9.ry.call': { who: 'ray', en: 'My call. Yeah. Funny how nobody else ever wants to make it.' },
  'd9.lo.idea': { who: 'lou', en: 'You know what Ruth would say. The seat goes to a special election. Anybody can run. Anybody.' },
  'd9.ry.why': { who: 'ray', en: "Anybody. Huh. You fixed the bell. You keep Sasha's store open. People like you, God knows why. Why not you?" },
  'd9.n.yes': { who: 'nadia', ru: 'Рыбка. Это и есть лестница. Скажи «да».', en: 'Rybka. This is the ladder. Say yes.', emo: 'serious' },
  'd9.ry.best': { who: 'ray', en: 'Best kind. Politicians break things. Carpenters fix them.', emo: 'smile' },
  'd9.ry.good': { who: 'ray', en: "Ha! Good. Then I'm signing this, and you're running, and Lyle Pruitt is going to choke on his coffee.", emo: 'laugh' },
  'd9.ry.sign': { who: 'ray', en: 'Take this to the mayor. My resignation. And tell Walt I said he used to be a better man.' },
  'd9.lo.first': { who: 'lou', en: "I'll be your first signature, by the way. Lou Amarok. Owner, bartender, darts champion three years running.", emo: 'smile' },
  // ---- City Hall
  'd9.w.read': { who: 'walt', en: 'Ray. Lord. Eleven years. He was the only one who ever read the budget all the way through.', emo: 'worry' },
  'd4x.w.tonight': { who: 'walt', en: 'The charter says a vacant seat goes to a town meeting. Tonight, then. Debate at seven at the Parish Hall, ballots right after. Petitions to Pearl by five.' },
  'd9.gi.filed': { who: 'gideon', en: 'Lyle Pruitt has already filed his petition. This morning. Twenty-five signatures, all in order.' },
  'd9.r.fast': { who: 'ruth', en: 'This morning. Before Ray resigned. My, my, Gideon. Lyle must be psychic.', emo: 'smile' },
  'd9.gi.prep': { who: 'gideon', en: 'Lyle is prepared. Preparation is not a crime, Mrs. Aqpik.' },
  'd9.r.nominate': { who: 'ruth', en: "Then I'll say it. I'm nominating the carpenter. Somebody in this room should hear a name that isn't Lyle's." },
  'd9.gi.warn': { who: 'gideon', en: 'Valid signatures. Pearl will check every one. So will I.', emo: 'serious' },
  'd9.r.sponsor': { who: 'ruth', en: "I'll sign first. I've signed for three candidates in fifty years. Two of them won. Don't make me look bad.", emo: 'smile' },
  'd9.r.clips': { who: 'ruth', en: "Here. Petition sheets, four clipboards. Leave them where people sit and talk. Dolly's, the church porch, the Anchor, Hank's. People sign what's in front of them." },
  'd9.l.who': { who: 'lyosha', ru: 'Лайл подал петицию раньше, чем Рэй ушёл в отставку. Значит, они знали заранее. Значит, этой отставки ждали.', en: 'Lyle filed his petition before Ray resigned. So they knew in advance. So somebody was waiting for Ray to quit.', emo: 'serious' },
  // ---- Walt and June's music box
  'd11.w.box': { who: 'walt', en: "Oh. It's you. Sorry. Sit, sit. Don't mind me. I knocked June's music box off the shelf last night. Thirty-eight years, it never had a scratch.", emo: 'worry' },
  'd11.w.june': { who: 'walt', en: 'My wife. June. She wound it every night before bed. Some old Russian waltz her grandmother brought from Sitka. Now it just clicks.' },
  'd11.w.fix': { who: 'walt', en: "Would you? Lord. Yes. Careful with it. The lid's cracked and something rattles inside. Hank won't touch it. Says it's jewellery, not hardware." },
  'd11.w.sorry': { who: 'walt', en: "So am I. Every day. You're a carpenter, aren't you? Could you look at it? I can't bear to throw it out.", emo: 'worry' },
  'd11.w.chat': { who: 'walt', en: "Any luck with June's box? No rush. It's waited since last night. I've waited since March." },
  'd11.l.box': { who: 'lyosha', ru: 'Механизм простой. Сломан зубец гребёнки и треснула крышка. Нужна гребёнка от другой шкатулки — и клей.', en: 'Simple movement. One tooth of the comb is broken and the lid is cracked. We need a comb from another music box — and glue.' },
  'd11.g.box': { who: 'grisha', ru: 'Я в молодости чинил такие на рынке в Анадыре. Гребёнку не паяй — только меняй целиком. Ищи старую шкатулку.', en: "When I was young I fixed these at the market in Anadyr. Don't solder the comb — swap the whole thing. Find an old music box." },
  'd11.n.candle': { who: 'nadia', ru: 'И попроси у отца Гавриила свечной огарок. На всякий случай.', en: 'And ask Father Gabriel for a candle stub. Just in case.' },
  // ---- the petition round (and the parts)
  'd9.h.sign': { who: 'hank', en: "A petition. Huh. Ray quits and you jump in. Alright. You fixed half of Front Street with my lumber. I'll sign." },
  'd9.h.nails': { who: 'hank', en: "I don't sign for strangers. I sell to them. Buy a box of nails, five bucks, and we'll call it a relationship." },
  'd9.h.nails2': { who: 'hank', en: "Pleasure doing business. There. Hank Brubaker. Don't make me regret it." },
  'd11.h.glue': { who: 'hank', en: "Hide glue? For a music box? Walt's? Huh. Here. No charge. Don't tell anybody I'm soft." },
  'd9.d.sign': { who: 'dolly', en: "Honey, I'd sign anything that makes Lyle Pruitt spill his coffee. Give me that pen. Dolly Finch, in my best handwriting.", emo: 'laugh' },
  'd9.d.dog': { who: 'dolly', en: "And did you see? A black SUV followed Pearl's husky all morning. Main Street, Second Avenue, round the church. Poor Biscuit thinks he's famous.", emo: 'laugh' },
  'd9.g.sign': { who: 'gabriel', en: 'For the one who gave the bell its voice back? Gladly. A priest should keep out of politics, but God votes by other means.', emo: 'smile' },
  'd11.g.june': { who: 'gabriel', en: "June Hennessey's music box? She brought it to every Christmas social and played it for the children. Hold on. I have something." },
  'd11.g.donor': { who: 'gabriel', en: 'A broken one, from the rummage table. Same maker, I think. Take its insides with my blessing. Walt has not sat in a pew since the funeral.' },
  'd11.g.candle': { who: 'gabriel', en: "A candle? Take two. Light one for June, if you think of it. And one for whatever it is you're carrying around in your face." },
  'd9.p.sign': { who: 'pearl', en: "I'm the one who files it, hon, so I shouldn't. Oh, who am I kidding. Pearl Jessup. With a flourish.", emo: 'laugh' },
  'd9.g.minister': { who: 'grisha', ru: 'А я всегда говорил: у нас не плотник, а целый министр!', en: "I always said it: we don't have a carpenter, we have a minister!", emo: 'laugh' },
  'd9.v.knit': { who: 'valya', ru: 'Политика, рыбка, — как вязание. Одна петля не так — и всё распускается.', en: 'Politics, little fish, is like knitting. One wrong loop and the whole thing unravels.', emo: 'smile' },
  // ---- the waltz, and the key
  'd11.v.waltz': { who: 'valya', ru: 'Ох… «На сопках Маньчжурии». Мой отец под неё танцевал. Надо же — на Аляске.', en: "Oh… 'On the Hills of Manchuria.' My father used to dance to that. Imagine — in Alaska.", emo: 'smile' },
  'd11.w.plays': { who: 'walt', en: 'Listen. Listen to that. She used to hum along, always half a beat behind. Drove me crazy for thirty-eight years.', emo: 'smile' },
  'd11.w.debt': { who: 'walt', en: 'You know what I did? When June got sick, the treatments in Anchorage cost more than this house. More than this town pays me in ten years.', emo: 'worry' },
  'd11.w.debt2': { who: 'walt', en: "Halloran's people came with a cheque. Campaign support, they called it. Twenty-five thousand. I took it. She died anyway, in March. And now they own me.", emo: 'worry' },
  'd11.w.anybody': { who: 'walt', en: "Anybody would. That's what I tell myself at three in the morning. It doesn't help as much as you'd think." },
  'd11.w.stop': { who: 'walt', en: "Stop? Friend, you don't stop Cyrus Halloran. You smile at his gala and say thank you for the streetlights.", emo: 'frown' },
  'd11.w.quiet': { who: 'walt', en: 'Thank you. Nobody lets me talk about her. They all change the subject to the weather.', emo: 'smile' },
  'd11.w.gala': { who: 'walt', en: 'Tomorrow night he throws his Winter Gala up at the Dome. The Development Board, the council, the mayor. I have to give a toast. To him. God help me.' },
  'd11.w.key': { who: 'walt', en: 'See this? Brass. Key to the old civil defence shelter on Kettle Hill. Every mayor since fifty-eight has carried it. Halloran made me promise never to take it off. Funny thing to ask a man.' },
  'd11.w.give': { who: 'walt', en: "For good. You mean that. You've got the look June had when she'd made up her mind about something.", emo: 'serious' },
  'd11.w.give2': { who: 'walt', en: "Take it. If anybody asks, I lost it fishing. Mayors lose things. Bring it back if you can. And if you can't, make it count.", emo: 'serious' },
  'd11.w.cant': { who: 'walt', en: "Nobody gets Halloran out of anything. I'm sorry, friend. I can't. He'd know in an hour, and then he'd own you too.", emo: 'worry' },
  'd11.w.thanks': { who: 'walt', en: "Go on, now. And thank you. You gave me back her waltz. I don't know what that's worth. More than twenty-five thousand." },
  'd11.n.given': { who: 'nadia', ru: 'Он отдал его сам. Рыбка… он тебе поверил. Не подведи его.', en: "He gave it to you himself. Rybka… he believed you. Don't let him down.", emo: 'smile' },
  'd11.i.given': { who: 'ivan', ru: 'Хороший ключ. Не потеряй.', en: 'A good key. Look after it.' },
  'd11.dm.given': { who: 'dmitri', ru: 'Человек отдал тебе ключ от своего города. Это доверие. Доверие не скопируешь.', en: "A man gave you the key to his own town. That is trust. Trust can't be copied.", emo: 'serious' },
  'd11.n.wax': { who: 'nadia', ru: 'Значит, слепок. Смотри: он снова заводит шкатулку, а ключи положил на стол. Воск у тебя есть.', en: "Then an impression. Look: he's winding the box again, and he's put his keys down on the desk. You have the wax.", emo: 'serious' },
  'd11.n.window': { who: 'nadia', ru: 'Он у окна. Слушает. Сейчас. Тихо.', en: "He's at the window. Listening. Now. Quietly.", emo: 'serious' },
  'd11.g.smudge': { who: 'grisha', ru: 'Смазано… но жить можно. Я и не с таким работал.', en: "Smudged… but we can live with it. I've worked from worse." },
  'd11.g.blank': { who: 'grisha', ru: 'Теперь заготовка. У Хэнка есть болванки. Напильник, терпение — и никакой спешки.', en: 'Now a blank. Hank has key blanks. A file, patience — and no rushing.' },
  'd11.h.blank': { who: 'hank', en: "Key blank? Brass, the old kind? I've got a drawer full. Two bucks. Whatever you're locking, I hope it stays locked." },
  'd11.g.copied': { who: 'grisha', ru: 'Хорошая копия. Замок не отличит. А мэр так и не узнает.', en: "A good copy. The lock won't know the difference. And the mayor will never find out." },
  'd11.n.copied': { who: 'nadia', ru: 'Мне это не нравится. Но конец света мне нравится ещё меньше.', en: "I don't like it. But I like the end of the world even less.", emo: 'frown' },
  'd11.i.copied': { who: 'ivan', ru: 'Хорошая копия. Не отличить.', en: "A good copy. I couldn't tell the difference." },
  'd11.dm.copied': { who: 'dmitri', ru: 'Мы взяли то, что нам не давали. Иногда так надо. Но не привыкай.', en: "We took what wasn't given to us. Sometimes it has to be done. But don't get used to it.", emo: 'serious' },
  'd11.n.gala': { who: 'nadia', ru: 'Гала у Хэллорана — завтра вечером, в Куполе. Это наша дверь. Теперь нам нужно приглашение.', en: "Halloran's gala, tomorrow night, at the Dome. That's our door. Now we need an invitation." },
  'd11.w.after': { who: 'walt', en: 'Lost my keys fishing today. Can you believe it? Fishing. In November. Ellen says I should get my head looked at.', emo: 'smile' },
  'd11.w.afterCopy': { who: 'walt', en: "Thanks again for June's box. I wound it twice tonight. Don't tell anybody. They'll think I've gone soft.", emo: 'smile' },
  // ---- the ledger
  'd12.l.ledger': { who: 'lyosha', ru: 'Лайл будет клясться, что «Нордстар» не платил ему ни цента. А у Лайла в конторе лежит гроссбух. Бумажный! Они не доверяют компьютерам. Смешно, правда?', en: "Lyle will swear Northstar never paid him a cent. And there's a ledger in Lyle's office. A paper one! They don't trust computers. Funny, isn't it?", emo: 'smile' },
  'd12.n.office': { who: 'nadia', ru: 'Контора «Прюитт Риэлти», Третья авеню. Днём Лайл сидит в мэрии. Сфотографируй страницы — Иван сделает из них таблицу.', en: 'Pruitt Realty, Third Avenue. In the daytime Lyle sits at City Hall. Photograph the pages — Ivan will turn them into a table.' },
  'd12.i.photos': { who: 'ivan', ru: 'Фотографии чёткие. Через час будет таблица.', en: "The photos are sharp. In an hour you'll have a table." },
  'd12.l.projector': { who: 'lyosha', ru: 'Я подключусь к проектору в зале. Нина ведёт прямой эфир. Если решишь — одно слово, и таблица будет на экране.', en: "I'll hook into the hall's projector. Nina's broadcasting live. If you decide to — one word, and the table goes up on the screen." },
  'd12.dm.choice': { who: 'dmitri', ru: 'Подумай. В этой таблице не только Лайл. Там и мэр.', en: "Think about it. Lyle isn't the only name in that table. The mayor is there too.", emo: 'serious' },
  // ---- debate prep with Ruth (optional)
  'd11.r.prep': { who: 'ruth', en: 'Sit. Lyle will talk about broadband and jobs and the future. He always talks about the future. People who own the future never have to explain the present.' },
  'd11.r.prep2': { who: 'ruth', en: 'When he says jobs, you say the cannery. When he says safety, you say cameras. When he says the future, you ask him whose.' },
  'd11.r.prep3': { who: 'ruth', en: "And don't get angry. Angry looks like losing. Smile like you know where the bodies are buried. In this town, you probably do.", emo: 'smile' },
  // ---- debate night
  'd12.g.open': { who: 'gabriel', en: "Friends, neighbours, quiet please. This is the Port Zarya candidates' debate. I am told I am neutral. I have decided to believe it.", emo: 'smile' },
  'd12.g.rules': { who: 'gabriel', en: "Two candidates for Ray Moody's seat. Lyle Pruitt, and our carpenter. Three questions, and no shouting. Nina, are we on the air?" },
  'd12.ni.live': { who: 'nina', en: "We're live! Hi, Mom. Sorry. We're live.", emo: 'laugh' },
  'd12.g.q1': { who: 'gabriel', en: 'First question. Why do you want this seat?' },
  'd12.ly.a1': { who: 'lyle', en: 'Because Port Zarya deserves a future. Broadband. Smart lighting. Jobs. Northstar has invested more in this town in one year than the state has in twenty.', emo: 'smile' },
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
  'd12.t.whoop': { who: 'tommy', en: 'Woo-hoo! Go get them, carpenter!', emo: 'laugh' },
  'd12.g.close': { who: 'gabriel', en: 'Closing statements. Lyle, you first.' },
  'd12.ly.close': { who: 'lyle', en: "Northstar never paid me a cent. Not one. I'm my own man, and I'm Port Zarya's man. That's my closing statement.", emo: 'smile' },
  'd12.l.now': { who: 'lyosha', ru: 'Сейчас. Одно слово — и таблица на проекторе.', en: 'Now. One word, and the table goes up on the projector.', emo: 'serious' },
  'd12.g.screen': { who: 'gabriel', en: 'Lord have mercy. Nineteen thousand, five hundred dollars. Lyle Pruitt.', emo: 'surprise' },
  'd12.d.gasp': { who: 'dolly', en: 'Gideon Shaw, four thousand. And, oh. Oh, Walt. Walt, no.', emo: 'worry' },
  'd12.w.exposed': { who: 'walt', en: "It's true. Twenty-five thousand. For June's treatments. I'm not proud of it. I'm not proud of much this year.", emo: 'worry' },
  'd12.ly.caught': { who: 'lyle', en: "That's out of context! Consulting! Land surveys! Legitimate, documented—", emo: 'angry' },
  'd12.ry.sit': { who: 'ray', en: 'Sit down, Lyle.', emo: 'angry' },
  'd12.g.thanks': { who: 'gabriel', en: "Thank you both. The ballot box is by the door, and Pearl is guarding it. Vote, all of you. Pray, if you're the praying kind.", emo: 'smile' },
  // ---- the count
  'd13.p.count': { who: 'pearl', en: "Four hundred and twelve ballots issued. Three hundred and seventy-six cast. Two spoiled. One of them is a drawing of a moose. It's a good moose.", emo: 'smile' },
  'd13.w.read': { who: 'walt', en: "Alright. Quiet, everybody. I promised June I'd always read them out loud, so here it is." },
  'd13.w.win': { who: 'walt', en: 'For the vacant council seat. A fine showing from Lyle Pruitt. And the winner, by the votes of this town, is our carpenter. Port Zarya has a new council member.', emo: 'smile' },
  'd13.w.lose': { who: 'walt', en: 'For the vacant council seat. It was close, folks. Closer than anybody guessed. The winner is Lyle Pruitt.' },
  'd13.d.cheer': { who: 'dolly', en: 'Yes! Oh, yes! Somebody hold my coffee!', emo: 'laugh' },
  'd13.ry.seat': { who: 'ray', en: "It's your chair now. Sit in it like you mean it.", emo: 'smile' },
  'd13.ly.lose': { who: 'lyle', en: 'Congratulations. Really. Enjoy the view from up there. It gets cold.', emo: 'frown' },
  'd13.gi.smirk': { who: 'gideon', en: "Democracy. Isn't it reassuring.", emo: 'smile' },
  'd13.r.close': { who: 'ruth', en: 'Close is not nothing. Close means half this town stood up.', emo: 'serious' },
  'd13.gi.invite': { who: 'gideon', en: "Congratulations, councillor. Mr. Halloran's compliments. Every council member attends the Winter Gala. Tomorrow, eight o'clock, at the Dome. Black tie." },
  'd13.w.appoint': { who: 'walt', en: "Hold on. One more thing. The Development Board has had a town seat empty since spring. The mayor fills it. I'm appointing our carpenter. Effective now.", emo: 'serious' },
  'd13.gi.objects': { who: 'gideon', en: 'Mr. Mayor, that seat is not—' },
  'd13.w.charter': { who: 'walt', en: 'Mine to fill, Gideon. Read the charter. Ruth typed it.', emo: 'smile' },
  'd13.gi.invite2': { who: 'gideon', en: "Then you will need this. The Winter Gala. Board members attend. Eight o'clock, the Dome. Black tie.", emo: 'frown' },
  'd13.gi.halloran': { who: 'gideon', en: "Don't look so sad. Mr. Halloran listened to the debate. He'd like to meet you. Personally. Tomorrow, at the Gala. He likes to know his opponents.", emo: 'smile' },
  'd13.g.win': { who: 'grisha', ru: 'Советник! Наша Рыбка — советник! Валя, наливай!', en: "A councillor! Our Rybka's a councillor! Valya, pour!", emo: 'laugh' },
  'd13.v.win': { who: 'valya', ru: 'Уже налила, Гриша. Уже налила.', en: 'Already poured, Grisha. Already poured.', emo: 'smile' },
  'd13.n.appointed': { who: 'nadia', ru: 'Не совет — так правление. Мэр поставил на тебя всё, что у него осталось. Не забывай этого.', en: "Not the council — the Board, then. The mayor bet everything he had left on you. Don't forget that.", emo: 'serious' },
  'd13.dm.halloran': { who: 'dmitri', ru: 'Он зовёт тебя сам. Значит, боится. Или ему скучно. Не знаю, что хуже.', en: "He invites you himself. So he's afraid. Or bored. I don't know which is worse.", emo: 'serious' },
  'd13.n.halloran': { who: 'nadia', ru: 'Он хочет посмотреть на тебя вблизи. Хорошо. Мы на него тоже.', en: 'He wants a close look at you. Good. We want one at him.', emo: 'serious' },
  // ---- Gideon, afterwards
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
  // ---- the night
  'd8.n.lesson': { who: 'nadia', ru: 'Иди домой, Рыбка. Лёша ждёт тебя на ноутбуке. Сегодня — строки.', en: "Go home, Rybka. Lyosha's waiting on the laptop. Tonight: strings." },
  'd8.l.after': { who: 'lyosha', ru: 'Хорошо режешь строки. Почти как Баба Валя колбасу.', en: 'You slice strings well. Almost as well as Baba Valya slices sausage.', emo: 'smile' },
  'd8.v.sausage': { who: 'valya', ru: 'Я всё слышу, Алексей. Колбасы тебе завтра не будет.', en: 'I hear everything, Alexei. No sausage for you tomorrow.', emo: 'smile' },
  'd13.l.rehearsal': { who: 'lyosha', ru: 'Есть ещё один урок. Репетиция. Если хватит сил — сегодня. Если нет — завтра утром.', en: "There's one more lesson. A rehearsal. If you have the strength, tonight. If not, tomorrow morning." },
  'd13.n.night': { who: 'nadia', ru: 'Завтра последний день. Последняя ночь перед рассветом. Спи, Рыбка. Хоть немного.', en: 'Tomorrow is the last day. The last night before the dawn. Sleep, Rybka. Even a little.', emo: 'worry' },
  'd13.g.night': { who: 'grisha', ru: 'Спокойной ночи, советник! Завтра летаем.', en: 'Good night, councillor! Tomorrow, we fly.', emo: 'smile' },
  // ---- signatures from friends (optional)
  'd9.k.sign': { who: 'koshkin', en: 'My signature? For you? Give me the pen. Koshkin, with a K, like my grandfather wrote it in nineteen eleven.', emo: 'smile' },
  'd9.t.sign': { who: 'tommy', en: "Grandma's sponsoring you? Then I'm in. I'll sign it twice. For luck.", emo: 'laugh' },
  'd9.ni.sign': { who: 'nina', en: "I turned eighteen in October, so it counts! First thing I've ever signed that isn't a noise complaint.", emo: 'smile' },
  'd9.e.sign': { who: 'ellen', en: 'Give it here. Anybody willing to sit through those council meetings deserves a signature and a medical exemption.', emo: 'smile' },
  'd9.e.checkup': { who: 'ellen', en: "I don't sign for strangers. Doctor's rule. Sit. Breathe in. Hmm. Nervous heart, honest eyes. Fine. Here's your signature.", emo: 'smile' },
  'd9.wa.sign': { who: 'wade', en: "Sure thing. Anybody who gets up Lyle's nose gets my name. Wade Tolliver. Spelled like it sounds." },
  'd9.wa.push': { who: 'wade', en: "I don't sign stuff for folks I barely know. Tell you what. Help me push the Cessna into the hangar, and we're acquainted." },
  'd9.wa.thanks': { who: 'wade', en: 'Ha! Strong back. Alright, acquaintance. Gimme that pen.', emo: 'laugh' },
  'd9.m.sign': { who: 'marta', en: "I don't sign petitions. A police chief signs warrants. Different pen." },
  'd9.m.luck': { who: 'marta', en: 'But. Good luck. Somebody ought to make Lyle sweat.', emo: 'smile' },
  // ---- around town on Thursday
  'd9.r.chat': { who: 'ruth', en: "Clipboards where people sit. Names from people who know you. And smile, even when Lyle's looking. Especially then.", emo: 'smile' },
  'd12.r.pre': { who: 'ruth', en: 'Remember. When he says the future, you ask him whose.', emo: 'smile' },
  'd9.ry.after': { who: 'ray', en: "Don't look at me like that. I signed. Now go get the rest. And don't let Gideon count them." },
  'd12.ry.after': { who: 'ray', en: "I haven't heard the hall that loud since the strike. Whatever happens tomorrow, you made them listen." },
  'd9.ly.cute': { who: 'lyle', en: "So it's true. The handyman's running. Cute. You know who sponsors the coffee at the count? Northstar. The chairs? Northstar. The count? Guess.", emo: 'smile' },
  'd12.ly.pre': { who: 'lyle', en: "Nervous? Me? I've debated the Rotary Club. Twice. They have a Rotary Club in Nome. It's very competitive.", emo: 'worry' },
  'd12.ly.after': { who: 'lyle', en: "Good debate. Really. Tomorrow decides. And Northstar's carrying the coffee.", emo: 'smile' },
  'd12.ly.afterHurt': { who: 'lyle', en: "You ruined me. In front of everybody. And the strange thing is, I slept better already. Don't tell anyone.", emo: 'frown' },
  'd9.w.neutral': { who: 'walt', en: 'The mayor stays neutral, friend. Officially. Unofficially, Ray was right about the dock.' },
  'd12.w.pre': { who: 'walt', en: "I'll be there. I have to be. Mayor. Front row, smiling. I've got a lot of practice smiling." },
  'd12.w.after': { who: 'walt', en: "Well, the hall's still standing. That's more than I expected. Get some sleep, friend." },
  'd12.w.hurt': { who: 'walt', en: "You could have warned me. No. You couldn't have. June would have done the same thing, and laughed doing it. Keep the key.", emo: 'worry' },
  'd12.w.afterCopied': { who: 'walt', en: 'Everybody knows now. Strange. I thought it would feel like dying. It feels like putting down a suitcase.', emo: 'worry' },
  'd12.gi.pre': { who: 'gideon', en: 'Tonight will be educational. For everyone.' },
  'd9.ev.dog': { who: 'evan', en: "Weird morning! Our security team spent two hours following Pearl's husky. Don't tell anyone I told you. Ha!", emo: 'laugh' },
  'd9.ev.sign': { who: 'evan', en: "A petition? Oh, I'd love to, but company policy says Northstar team members stay neutral. Neutral! Like Switzerland. Have a great day!", emo: 'smile' },
  'd12.ev.pre': { who: 'evan', en: 'Refreshments are on Northstar tonight! Sparkling water with a hint of community!', emo: 'smile' },
  'd12.m.pre': { who: 'marta', en: "I'll be on the door tonight. Anybody throws a chair, it's my chair to throw." },
  'd11.m.deal': { who: 'marta', en: "Okafor says the gala guest list is longer this year. Says he's on it. Consultant. He didn't say for whom." },
  'd11.m.hostile': { who: 'marta', en: "Okafor asked me for your cabin's address. I told him to look it up. He already had.", emo: 'frown' },
  'd12.p.pre': { who: 'pearl', en: 'Ballots came on the morning plane. Four hundred and twelve, numbered and sealed. Nobody touches them but me. Nobody.' },
  'd12.g.pre': { who: 'gabriel', en: "I'm moderating tonight. Pray for me. Actually, I'll do that part myself." },
  'd12.e.pre': { who: 'ellen', en: "I'll be in the third row with smelling salts. Last debate, old Mr. Kaplan fainted when the budget came up." },
  'd12.t.pre': { who: 'tommy', en: 'I made a sign. It says carpenter in glitter. Grandma says glitter is undignified. Grandma is wrong.', emo: 'laugh' },
  'd13.k.after': { who: 'koshkin', en: 'A Koshkin employee on the council! My grandfather would have bought a round for the whole town. I will buy you a pickle.', emo: 'laugh' },
  'd12.lo.pre': { who: 'lou', en: "Odds have moved, by the way. You're even money now. I put twenty on you. Don't make me look stupid." },
  'd12.d.pre': { who: 'dolly', en: "Big night! I'm baking three pies. One for you, one for me, and one to throw at Lyle if he says synergy.", emo: 'laugh' },
  'd12.d.after': { who: 'dolly', en: "You were magnificent up there! I didn't throw a single pie. I was too busy clapping.", emo: 'laugh' },
  'd12.h.pre': { who: 'hank', en: "I'll be there. Back row. Arms crossed. That's my supportive face." },
};

const BAR = { x: -62, z: 44 };   // the back of the Rusty Anchor
// The petition round: who keeps a clipboard, where (and what else they give).
const STOPS = [
  { id: 'hank', where: 'hardware.door', name: 'Hank (the hardware store)' },
  { id: 'dolly', where: 'diner.waitress', name: 'Dolly (the diner)' },
  { id: 'gabriel', where: 'church.narthex', name: 'Father Gabriel (the church porch)' },
];
const signed = (s, id) => !!s.flags['d4.sig.' + id];
const boxParts = (s) => (s.inv.donor_box || 0) > 0 && (s.inv.hide_glue || 0) > 0;

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd4.seat': {
    title: 'The Vacant Seat', main: true, day: 4,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 8.6);
        await m.wait(1.0);
        await m.ears(['d9.ni.news1', 'd9.ni.news2', 'd9.ni.news3']);
        await m.ears(['d9.l.dock', 'd9.dm.dock']);
        await m.ear('d9.lo.call');
        m.ear('d9.n.go');
      }
      if (m.cp(2, from)) {
        cap(m, 9.6);
        const text = 'Go to the Rusty Anchor';
        m.obj(text, BAR, 'Lou: round the back');
        await hold(m, () => dist(G, BAR) < 8, text, BAR, 'Lou: round the back');
      }
      if (m.cp(3, from)) {
        m.clear();
        cap(m, 10);
        await m.scene((d) => rayQuits(m, d));
        m.flag('running', true);
        m.flag('rayQuit', true);
        item(G, 'resignation_letter', 1, "Ray's resignation letter");
        rel(G, 'ray', 6);
        rel(G, 'lou', 4);
      }
      if (m.cp(4, from)) {
        cap(m, 11);
        const text = "Take Ray's resignation to the mayor";
        m.obj(text, 'cityhall.mayorOffice', 'City Hall');
        await hold(m, () => dist(G, 'cityhall.mayorOffice') < 5, text, 'cityhall.mayorOffice', 'City Hall');
      }
      if (m.cp(5, from)) {
        m.clear();
        cap(m, 11.4);
        await m.scene((d) => nomination(m, d));
        s.inv.resignation_letter = 0;
        await m.ear('d9.l.who');
      }
      if (m.cp(6, from)) {
        cap(m, 11.8);
        await meet(m, 'walt', 'cityhall.mayorDesk', 'The mayor wants a word', 'His office', () => !!m.flag('d11.walt.met'));
        await m.ears(['d11.l.box', 'd11.g.box']);
        m.ear('d11.n.candle');
        m.flag('d4.petition', true);
      }
      if (m.cp(7, from)) {
        cap(m, 16);
        // Hank, Dolly and Father Gabriel each keep a clipboard; the parts come along
        let shown = '';
        await m.until(() => {
          const left = STOPS.filter((p) => !signed(s, p.id));
          for (const p of left) {
            const n = G.npcs?.get?.(p.id);
            if (n && !n.scripted && !n.talking) stage(G, p.id, at(G, p.where));
          }
          if (!left.length && boxParts(s)) return true;
          const todo = left.length ? left : STOPS.filter((p) => (p.id === 'hank' && !(s.inv.hide_glue > 0)) || (p.id === 'gabriel' && !(s.inv.donor_box > 0)));
          const next = (todo.length ? todo : STOPS).slice().sort((a, b) => dist(G, a.where) - dist(G, b.where))[0];
          const parts = `for the music box: glue from Hank${s.inv.hide_glue > 0 ? ' ✓' : ''}, an old music box from Father Gabriel${s.inv.donor_box > 0 ? ' ✓' : ''}`;
          const key = next.id + left.length + parts;
          if (key !== shown || !G.hud?.objective) {
            shown = key;
            m.obj(left.length ? `Petition clipboards — ${3 - left.length} of 3 · next: ${next.name}` : 'Parts for the music box', next.where, left.length ? `${left.map((p) => p.name).join(' · ')} — and ${parts}` : parts);
          }
          return false;
        });
        release(G, ...STOPS.map((p) => p.id));
      }
      if (m.cp(8, from)) {
        cap(m, 16.8);
        await meet(m, 'pearl', 'post.door', 'File the petition with Pearl — by five', 'The post office, Third Avenue', () => !!m.flag('petitionFiled'));
        standing(G, 5, 'your name is on the ballot');
        await m.ears(['d9.g.minister', 'd9.v.knit']);
      }
      if (m.cp(9, from)) {
        cap(m, 17.3);
        stage(G, 'walt', at(G, 'cityhall.mayorDesk'));
        const text = "Repair June's music box on Walt's desk";
        m.obj(text, 'cityhall.mayorDesk', 'A new comb and a little glue');
        await m.spot('box', 'cityhall.mayorDesk', "Repair June's music box", 2.4);
        await m.minigame('glass', { title: 'SET THE NEW COMB' });
        await m.minigame('paint', { title: 'GLUE AND CLAMP THE LID' });
        s.inv.donor_box = 0; s.inv.hide_glue = 0;
        m.flag('musicBoxFixed', true);
        G.sfx?.musicBox?.();
        G.hud?.toast?.('REPAIRED', "June's music box plays again", '#9fe8b0');
        await m.ear('d11.v.waltz');
        await m.scene((d) => theKey(m, d));
        release(G, 'walt');
      }
      if (m.cp(10, from) && !m.flag('mayorKeyGiven') && !m.flag('mayorKey')) {
        cap(m, 17.6);
        await m.ear('d11.n.wax');
        m.obj('Take a wax impression of the brass key', 'cityhall.mayorDesk', 'His keys are on the desk — while the waltz plays');
        await m.spot('wax', 'cityhall.mayorDesk', 'Press the key into the wax', 2.4);
        const p = at(G, 'cityhall.mayorDesk');
        await m.ear('d11.n.window');
        G.attention.zone('d11.mayor', p.x, p.z, 6, 8, 'City Hall');
        G.attention.act(1.4, 8);
        const ok = await m.minigame('lock', { title: 'WAX IMPRESSION' });
        G.attention.clearZone('d11.mayor');
        if (!ok) { G.attention.add(12); await m.ear('d11.g.smudge'); }
        s.inv.candle = Math.max(0, (s.inv.candle || 1) - 1);
        item(G, 'wax_impression', 1, 'A wax impression of the brass key');
        m.flag('d11.needBlank', true);
        await m.ear('d11.g.blank');
      }
      if (m.cp(11, from) && m.flag('d11.needBlank') && !m.flag('mayorKey')) {
        cap(m, 18);
        const text = 'Get a brass key blank';
        const sub = "Hank sells them — or try the key drawer in Koshkin's back room";
        stage(G, 'hank', at(G, 'hardware.door'));
        m.spot('drawer', 'koshkin.backroom', "Search Koshkin's key drawer", 2.4).then(() => { if (!(s.inv.key_blank > 0)) item(G, 'key_blank', 1, 'An old brass key blank'); });
        m.obj(text, 'hardware.door', sub);
        await hold(m, () => (s.inv.key_blank || 0) > 0, text, 'hardware.door', sub);
        G.interact?.remove?.(`${m.id}:drawer`);
        release(G, 'hank');
      }
      if (m.cp(12, from)) {
        cap(m, 18.5);
        await m.ears(['d12.l.ledger', 'd12.n.office']);
        const text = "Photograph Northstar's ledger at Pruitt Realty";
        m.obj(text, 'house22.door', "Lyle's office, Third Avenue by City Hall");
        await m.spot('ledger', 'house22.door', 'Pick the lock', 2.6);
        G.attention.act(1.2, 8);
        const ok = await m.minigame('lock', { title: 'PRUITT REALTY' });
        if (!ok) G.attention.add(8);
        G.hud?.toast?.('PHOTOGRAPHED', "Northstar's payment ledger, fourteen pages", '#7fe6ff');
        m.flag('ledgerPhotos', true);
        await m.ears(['d12.i.photos', 'd12.l.projector', 'd12.dm.choice']);
        m.done();
        m.start('d4.debate');
      }
    },
  },

  'd4.debate': {
    title: 'Debate Night', main: true, day: 4,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        await waitFor(m, 19, 'Debate night at the Parish Hall', 'hall.door');
        cap(m, 19.3);
        const text = 'Debate night at the Parish Hall';
        m.obj(text, 'hall.door', 'KZRY is live at seven');
        await hold(m, () => dist(G, 'hall') < 12, text, 'hall.door', 'KZRY is live at seven');
      }
      if (m.cp(2, from)) {
        m.clear();
        cap(m, 20.5);
        const S = at(G, 'hall.stage');
        await G.fadeTeleport?.({ x: S.x + 1.6, z: S.z + 1.5, yaw: 0 }, 1.4);
        let score = 0, useLedger = false;
        await m.scene(async (d) => {
          score += await debate(m, d, S);
          if (m.flag('ledgerPhotos')) {
            await d.say('lyosha', 'd12.l.now', { radio: true });
            useLedger = (await d.choose(["(Run the ledger. Put Northstar's payments on the screen.)", '(No. Close with your own words.)'], { prompt: 'THE LEDGER' })) === 0;
          }
        });
        if (useLedger) {
          m.obj('Put the ledger on the projector', 'hall.stage', 'Field hack — the whole town is watching');
          await hack(m, 'ledger', 'hall.stage', 'Run the ledger again', 'd12.l.now');
          m.clear();
          m.flag('ledgerUsed', true);
          m.flag('waltExposed', true);
          score += 6;
        }
        await m.scene(async (d) => {
          const face = (p) => ({ ...p, rot: yawTo(p, S) });
          await d.bring('gabriel', face({ x: S.x, z: S.z - 0.9 }));
          await d.bring('lyle', face({ x: S.x - 1.6, z: S.z }));
          if (useLedger) {
            await d.bring('walt', face({ x: S.x, z: S.z + 5.6 }));
            await d.bring('dolly', face({ x: S.x + 0.8, z: S.z + 4.2 }), { sit: true });
            await d.bring('ray', face({ x: S.x - 2.2, z: S.z + 4.2 }), { sit: true });
            await d.say('gabriel', 'd12.g.screen', { cam: cu(d, 'gabriel') });
            await d.say('dolly', 'd12.d.gasp', { cam: cu(d, 'dolly') });
            await d.say('walt', 'd12.w.exposed', { cam: cu(d, 'walt', { dist: 0.7 }) });
            await d.say('lyle', 'd12.ly.caught', { cam: cu(d, 'lyle') });
            await d.say('ray', 'd12.ry.sit', { cam: cu(d, 'ray') });
          } else {
            const k = await d.choose([
              "I fix things. This town isn't broken. It's being taken apart. Let me help put it back.",
              "I won't promise you the future. I'll promise to read the budget all the way through. Like Ray did.",
            ], { prompt: 'CLOSING STATEMENT' });
            await d.you(k === 0 ? "I fix things. This town isn't broken. It's being taken apart. Let me help put it back." : "I won't promise you the future. I'll promise to read the budget all the way through. Like Ray did.");
            score += k === 0 ? 3 : 2;
          }
          await d.say('gabriel', 'd12.g.thanks', { cam: cu(d, 'gabriel', { side: -1 }) });
        });
        const won = useLedger || score >= 9;
        m.flag('debateScore', score);
        m.flag('debateWon', won);
        m.flag('debateDone', true);
        standing(G, Math.max(1, Math.round(score / 2)), won ? 'the town liked what it heard' : 'a close debate');
      }
      if (m.cp(3, from)) {
        clockTo(m, 21.5);
        G.hud?.toast?.('LATER', 'The ballots are counted on the stage', '#9fd0ff');
        await m.scene((d) => theCount(m, d));
      }
      if (m.cp(4, from)) {
        cap(m, 21.8);
        const by = m.flag('galaInviteBy');
        if (by === 'council') await m.ears(['d13.g.win', 'd13.v.win']);
        else if (by === 'board') await m.ear('d13.n.appointed');
        else await m.ears(['d13.dm.halloran', 'd13.n.halloran']);
        const door = at(G, 'hall.door');
        await G.fadeTeleport?.({ x: door.x, z: door.z, yaw: door.rot }, 1.0);
        await m.scene(async (d) => {
          const P = G.player.pos;
          const gp = { x: door.x + 1.4, z: door.z + 1.2 };
          await d.bring('gideon', { ...gp, rot: yawTo(gp, P) });
          await d.say('gideon', 'd12.gi.threat1', { cam: cu(d, 'gideon') });
          await d.say('gideon', 'd12.gi.threat2', { cam: cu(d, 'gideon', { side: -1, dist: 0.6 }) });
          await d.say('gideon', 'd12.gi.threat3', { cam: cu(d, 'gideon', { dist: 0.55 }) });
          const k = await d.choose(['Is that a threat?', '(Say nothing. Hold his stare.)', 'Tell Mr. Halloran I said thank you for the streetlights.'], { prompt: 'GIDEON SHAW' });
          await d.say('gideon', ['d12.gi.threat4', 'd12.gi.stare', 'd12.gi.smile'][k] || 'd12.gi.stare', { cam: cu(d, 'gideon') });
        });
        m.flag('gideonThreat', true);
        G.attention.add(5);
        await m.ears(['d12.g.swim', 'd12.n.okay']);
        await m.ear(m.flag('ledgerUsed') ? 'd12.dm.ledger' : 'd12.dm.words');
      }
      if (m.cp(5, from) && m.flag('d11.needBlank') && !m.flag('mayorKey')) {
        cap(m, 22.3);
        if (!(s.inv.key_blank > 0)) item(G, 'key_blank', 1);
        m.obj('File the copy of the brass key', 'cabin.workbench', 'Your cabin workbench');
        await m.spot('file', 'cabin.workbench', 'File the key', 2.4);
        await m.minigame('saw', { title: 'FILE THE KEY' });
        s.inv.key_blank = 0; s.inv.wax_impression = 0;
        item(G, 'municipal_key', 1, 'A copy of the brass key');
        m.flag('mayorKey', true);
        m.flag('mayorKeyCopied', true);
        await m.ears(['d11.g.copied', 'd11.n.copied', 'd11.i.copied', 'd11.dm.copied']);
      }
      if (m.cp(6, from)) {
        cap(m, 23.5);
        m.ear('d8.n.lesson');
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop', 'Night School · Lesson 4: Cutting Strings');
        await hold(m, () => !!s.lessons.l08, text, 'cabin.laptop', 'Night School · Lesson 4: Cutting Strings');
        await m.ears(['d8.l.after', 'd8.v.sausage', 'd13.l.rehearsal']);
        await m.ear('d13.n.night');
        if (m.flag('wonSeat')) await m.ear('d13.g.night');
        m.done();
      }
    },
  },
};

// The back of the Rusty Anchor. Ray has been writing on Lou's napkins all night.
async function rayQuits(m, d) {
  const G = m.G;
  const lp = { x: BAR.x - 2.5, z: BAR.z + 1.0 }, rp = { x: BAR.x + 2.0, z: BAR.z + 1.2 };
  const P = G.player.pos;
  await d.bring('lou', { ...lp, rot: yawTo(lp, P) });
  await d.bring('ray', { ...rp, rot: yawTo(rp, P) }, { sit: true });
  await d.say('lou', 'd9.lo.back', { cam: cu(d, 'lou') });
  await d.say('ray', 'd9.ry.hello', { cam: cu(d, 'ray') });
  await d.say('ray', 'd9.ry.vote');
  const k = await d.choose(['Ray, what are you writing?', 'You did the right thing last night.', '(Just sit with him.)'], { prompt: 'RAY' });
  if (k === 1) await d.say('ray', 'd9.ry.right');
  if (k === 2) await d.say('lou', 'd9.lo.sit', { cam: cu(d, 'lou', { side: -1 }) });
  await d.say('ray', 'd9.ry.letter', { cam: cu(d, 'ray', { side: -1 }) });
  await d.say('ray', 'd9.ry.done');
  const k2 = await d.choose(['Quit, and the next one in your chair votes yes.', 'Then who stops them?', "It's your call, Ray."], { prompt: 'RAY' });
  await d.say('ray', ['d9.ry.chair', 'd9.ry.who', 'd9.ry.call'][k2] || 'd9.ry.who');
  await d.say('lou', 'd9.lo.idea', { cam: cu(d, 'lou') });
  await d.say('ray', 'd9.ry.why', { cam: cu(d, 'ray', { dist: 0.65 }) });
  await d.say('nadia', 'd9.n.yes', { radio: true });
  const k3 = await d.choose(["I'll run.", "I'm a carpenter, not a politician."], { prompt: 'RAY' });
  if (k3 === 1) await d.say('ray', 'd9.ry.best');
  await d.say('ray', 'd9.ry.good', { cam: cu(d, 'ray') });
  await d.say('ray', 'd9.ry.sign');
  if (m.flag('knowsShares') && !hasShare(G.state, 'ray')) {
    const c = await d.choose(["Ray — that laminated card Gideon had you sign. Don't give it back. Give it to me.", '(Leave it.)'], { prompt: 'THE CONTINUITY CARD' });
    if (c === 0) {
      await d.say('ray', 'sf.ray.card', { cam: cu(d, 'ray', { side: -1 }) });
      takeShare(G, 'ray', (l) => d.say(l.startsWith('sf.n') ? 'nadia' : l.startsWith('sf.d') ? 'dmitri' : l.startsWith('sf.v') ? 'valya' : 'lyosha', l, { radio: true }));
    }
  }
  await d.say('lou', 'd9.lo.first', { cam: cu(d, 'lou', { side: -1 }) });
}

// Walt's office: the resignation, Gideon's early petition, Ruth's nomination.
async function nomination(m, d) {
  const G = m.G;
  const me = at(G, 'cityhall.mayorOffice');
  const desk = at(G, 'cityhall.mayorDesk');
  await d.bring('player', { ...me, rot: yawTo(me, desk) });
  await d.bring('walt', { ...desk, rot: yawTo(desk, me) });
  const gp = at(G, 'cityhall.mayorOffice', 1.4, 0.8), rp = at(G, 'cityhall.mayorOffice', -1.4, 0.6);
  await d.bring('gideon', { ...gp, rot: yawTo(gp, me) });
  await d.bring('ruth', { ...rp, rot: yawTo(rp, desk) });
  await d.say('walt', 'd9.w.read', { cam: cu(d, 'walt') });
  await d.say('walt', 'd4x.w.tonight');
  await d.say('gideon', 'd9.gi.filed', { cam: cu(d, 'gideon') });
  await d.say('ruth', 'd9.r.fast', { cam: cu(d, 'ruth') });
  await d.say('gideon', 'd9.gi.prep', { cam: cu(d, 'gideon', { side: -1 }) });
  const k = await d.choose(["I want to run for Ray's seat.", '(Let Ruth speak.)'], { prompt: 'CITY HALL' });
  if (k === 1) await d.say('ruth', 'd9.r.nominate', { cam: cu(d, 'ruth', { side: -1 }) });
  else await d.you("I want to run for Ray's seat.");
  await d.say('gideon', 'd9.gi.warn', { cam: cu(d, 'gideon', { dist: 0.6 }) });
  await d.say('ruth', 'd9.r.sponsor', { cam: cu(d, 'ruth') });
  await d.say('ruth', 'd9.r.clips');
  rel(G, 'ruth', 6);
}

// June's waltz, Walt's debt, and the brass key.
async function theKey(m, d) {
  const G = m.G;
  let trust = 0, given = false;
  const me = at(G, 'cityhall.mayorOffice');
  const desk = at(G, 'cityhall.mayorDesk');
  await d.bring('walt', { ...desk, rot: yawTo(desk, me) });
  await d.say('walt', 'd11.w.plays', { cam: cu(d, 'walt') });
  await d.say('walt', 'd11.w.debt', { cam: cu(d, 'walt', { side: -1 }) });
  await d.say('walt', 'd11.w.debt2');
  const k = await d.choose(['You did it for her. Anybody would have.', 'Then stop letting them.', '(Say nothing. Let him talk.)'], { prompt: 'WALT' });
  await d.say('walt', ['d11.w.anybody', 'd11.w.stop', 'd11.w.quiet'][k] || 'd11.w.quiet', { cam: cu(d, 'walt') });
  if (k !== 1) trust++;
  await d.say('walt', 'd11.w.gala', { cam: cu(d, 'walt', { side: -1, dist: 0.9 }) });
  await d.say('walt', 'd11.w.key', { cam: cu(d, 'walt', { dist: 0.6 }) });
  const k2 = await d.choose(['Walt, what if someone could get Halloran out of this town for good?', '(Say nothing about the key.)'], { prompt: 'THE BRASS KEY' });
  if (k2 === 0) {
    const score = trust + (m.flag('okaforDeal') ? 1 : 0) + (G.state.standing >= 8 ? 1 : 0) + (level(G, 'walt') >= 1 ? 1 : 0);
    if (score >= 2) {
      given = true;
      await d.say('walt', 'd11.w.give', { cam: cu(d, 'walt') });
      await d.say('walt', 'd11.w.give2', { cam: cu(d, 'walt', { side: -1, dist: 0.6 }) });
    } else await d.say('walt', 'd11.w.cant', { cam: cu(d, 'walt') });
  }
  await d.say('walt', 'd11.w.thanks', { cam: d.actors?.walt ? d.overShoulder('player', 'walt') : undefined });
  m.flag('knowsGala', true);
  G.state.inv.music_box = 0;
  rel(G, 'walt', 15 + trust * 5);
  if (given) {
    m.flag('mayorKey', true);
    m.flag('mayorKeyGiven', true);
    item(G, 'municipal_key', 1, "The mayor's brass key");
    await d.say('nadia', 'd11.n.given', { radio: true });
    await d.say('ivan', 'd11.i.given', { radio: true });
    await d.say('dmitri', 'd11.dm.given', { radio: true });
  }
  await d.say('nadia', 'd11.n.gala', { radio: true });
}

// Three questions from Father Gabriel. Returns the points the room gave you.
async function debate(m, d, S) {
  const G = m.G;
  let score = 0;
  const face = (p, t) => ({ ...p, rot: yawTo(p, t || S) });
  const you = { x: S.x + 1.6, z: S.z + 1.5 };
  await d.bring('player', face(you, { x: S.x, z: S.z - 0.9 }));
  await d.bring('gabriel', face({ x: S.x, z: S.z - 0.9 }, you));
  await d.bring('lyle', face({ x: S.x - 1.6, z: S.z }, { x: S.x, z: S.z - 0.9 }));
  await d.bring('nina', face({ x: S.x + 3.4, z: S.z + 2.4 }), { sit: true });
  await d.bring('ray', face({ x: S.x - 2.2, z: S.z + 4.2 }), { sit: true });
  await d.bring('ruth', face({ x: S.x - 0.7, z: S.z + 4.2 }), { sit: true });
  await d.bring('dolly', face({ x: S.x + 0.8, z: S.z + 4.2 }), { sit: true });
  await d.bring('hank', face({ x: S.x + 2.3, z: S.z + 4.6 }), { sit: true });
  await d.bring('tommy', face({ x: S.x - 3.4, z: S.z + 5.2 }));
  G.sfx?.crowd?.(0.3);
  await d.say('gabriel', 'd12.g.open', { cam: cu(d, 'gabriel') });
  G.sfx?.crowd?.(0);
  await d.say('gabriel', 'd12.g.rules');
  await d.say('nina', 'd12.ni.live', { cam: cu(d, 'nina') });
  // question one
  await d.say('gabriel', 'd12.g.q1', { cam: cu(d, 'gabriel', { side: -1 }) });
  await d.say('lyle', 'd12.ly.a1', { cam: cu(d, 'lyle') });
  const o1 = [
    { t: 'Because Ray Moody gave it to me, and he was the only one who voted no.', v: 2, r: ['ray', 'd12.ry.cheer'] },
    { t: 'Because somebody should ask whose future he means.', v: m.flag('ruthPrep') ? 4 : 2, r: ['ruth', 'd12.r.whose'] },
    { t: "I don't, really. But I'd rather sit in it than watch Lyle sit in it.", v: 1, r: ['dolly', 'd12.d.laugh'] },
  ];
  const a1 = o1[await d.choose(o1.map((o) => o.t), { prompt: 'WHY DO YOU WANT THIS SEAT?' })] || o1[0];
  score += a1.v;
  await d.you(a1.t);
  await d.say(a1.r[0], a1.r[1], { cam: cu(d, a1.r[0]) });
  // question two
  await d.say('gabriel', 'd12.g.q2', { cam: cu(d, 'gabriel') });
  await d.say('lyle', 'd12.ly.a2', { cam: cu(d, 'lyle', { side: -1 }) });
  const o2 = [];
  if (m.flag('cabinSwept')) o2.push({ t: 'Then why was there a Northstar camera in my smoke alarm?', v: 4, k: 'smoke' });
  o2.push({ t: "Ruth Aqpik keeps her curtains shut in her own house. That isn't safety.", v: 3, r: ['ruth', 'd12.r.whose'] });
  o2.push({ t: 'Ask Lou how many fights those cameras ever stopped at the Anchor.', v: 2, k: 'lou' });
  const a2 = o2[await d.choose(o2.map((o) => o.t), { prompt: 'THE STREETLIGHTS' })] || o2[0];
  score += a2.v;
  await d.you(a2.t);
  if (a2.k === 'smoke') {
    G.attention.add(6);
    await d.say('lyle', 'd12.ly.smoke', { cam: cu(d, 'lyle') });
    if (m.flag('martaTrust')) {
      await d.bring('marta', face({ x: S.x + 4.2, z: S.z + 7 }));
      await d.say('marta', 'd12.m.confirm', { cam: cu(d, 'marta') });
      score += 2;
    }
  } else if (a2.k === 'lou') {
    await d.bring('lou', face({ x: S.x + 1.6, z: S.z + 6 }));
    await d.say('lou', 'd12.lo.broom', { cam: cu(d, 'lou') });
  } else await d.say(a2.r[0], a2.r[1], { cam: cu(d, a2.r[0], { side: -1 }) });
  // question three
  await d.say('gabriel', 'd12.g.q3', { cam: cu(d, 'gabriel', { side: -1 }) });
  await d.say('lyle', 'd12.ly.a3', { cam: cu(d, 'lyle') });
  await d.say('ray', 'd12.ry.dad', { cam: cu(d, 'ray') });
  const o3 = [
    { t: 'What does a data centre need with a deep-water dock?', v: 3, r: ['hank', 'd12.h.fair'] },
    { t: 'Keep the cannery open, and make Northstar pay rent like everybody else.', v: 2, r: ['tommy', 'd12.t.whoop'] },
  ];
  const a3 = o3[await d.choose(o3.map((o) => o.t), { prompt: 'THE CANNERY' })] || o3[0];
  score += a3.v;
  await d.you(a3.t);
  await d.say('lyle', 'd12.ly.stumble', { cam: cu(d, 'lyle', { side: -1 }) });
  await d.say(a3.r[0], a3.r[1], { cam: cu(d, a3.r[0]) });
  // closing
  await d.say('gabriel', 'd12.g.close', { cam: cu(d, 'gabriel') });
  await d.say('lyle', 'd12.ly.close', { cam: cu(d, 'lyle') });
  return score;
}

// The ballots, read out by the mayor; the invitation one way or another; Ruth's card.
async function theCount(m, d) {
  const G = m.G, s = G.state, F = s.flags;
  const won = !!F.debateWon;
  const given = !!F.mayorKeyGiven;
  const score = Number(F.debateScore) || 0;
  const you = won ? 196 + Math.min(80, score * 4) : 178 - Math.max(0, (9 - score) * 6);
  const S = at(G, 'hall.stage');
  const face = (p, t) => ({ ...p, rot: yawTo(p, t || { x: S.x, z: S.z + 4 }) });
  const me = { x: S.x + 1.5, z: S.z + 3.5 };
  await d.bring('player', face(me, S));
  await d.bring('walt', face({ x: S.x, z: S.z - 0.4 }, me));
  await d.bring('pearl', face({ x: S.x + 1.3, z: S.z + 0.4 }, me));
  await d.bring('gideon', face({ x: S.x - 2.2, z: S.z + 1.2 }, S));
  await d.bring('ruth', face({ x: S.x + 2.4, z: S.z + 1.2 }, S));
  await d.bring('lyle', face({ x: S.x - 1.2, z: S.z + 0.6 }, S));
  await d.bring('dolly', face({ x: S.x + 0.4, z: S.z + 4.4 }, S));
  await d.bring('ray', face({ x: S.x - 0.9, z: S.z + 4.6 }, S));
  await d.say('pearl', 'd13.p.count', { cam: cu(d, 'pearl') });
  await d.say('walt', 'd13.w.read', { cam: cu(d, 'walt') });
  if (won) {
    await d.say('walt', 'd13.w.win', { cam: cu(d, 'walt', { side: -1, dist: 0.7 }) });
    await d.say('dolly', 'd13.d.cheer', { cam: cu(d, 'dolly') });
    await d.say('ray', 'd13.ry.seat', { cam: cu(d, 'ray') });
    await d.say('lyle', 'd13.ly.lose', { cam: cu(d, 'lyle') });
    await d.say('gideon', 'd13.gi.invite', { cam: cu(d, 'gideon', { dist: 0.65 }) });
  } else {
    await d.say('walt', 'd13.w.lose', { cam: cu(d, 'walt', { side: -1 }) });
    await d.say('gideon', 'd13.gi.smirk', { cam: cu(d, 'gideon') });
    await d.say('ruth', 'd13.r.close', { cam: cu(d, 'ruth') });
    if (given) {
      await d.say('walt', 'd13.w.appoint', { cam: cu(d, 'walt', { dist: 0.7 }) });
      await d.say('gideon', 'd13.gi.objects', { cam: cu(d, 'gideon') });
      await d.say('walt', 'd13.w.charter', { cam: cu(d, 'walt', { side: -1 }) });
      await d.say('gideon', 'd13.gi.invite2', { cam: cu(d, 'gideon', { dist: 0.65 }) });
    } else await d.say('gideon', 'd13.gi.halloran', { cam: cu(d, 'gideon', { dist: 0.6 }) });
  }
  m.flag('votesYou', you);
  m.flag('votesLyle', 374 - you);
  m.flag('wonSeat', won);
  if (!won && given) m.flag('appointed', true);
  m.flag('galaInviteBy', won ? 'council' : given ? 'board' : 'halloran');
  m.flag('galaInvite', true);
  s.standing += won ? 10 : 4;
  item(G, 'gala_invitation', 1);
  G.hud?.toast?.('THE COUNT', `You ${you} · Lyle Pruitt ${374 - you}`, won ? '#9fe8b0' : '#ffb21e');
  G.hud?.toast?.('ITEM', 'Gala invitation — the Dome, tomorrow, 8 pm', '#ffd166');
  if (F.knowsShares && !hasShare(s, 'ruth')) {
    await d.say('ruth', 'sf.ruth.card', { cam: cu(d, 'ruth', { dist: 0.7 }) });
    takeShare(G, 'ruth', (l) => d.say(l.startsWith('sf.n') ? 'nadia' : l.startsWith('sf.d') ? 'dmitri' : l.startsWith('sf.v') ? 'valya' : 'lyosha', l, { radio: true }));
    rel(G, 'ruth', 6);
  }
}

// ---------------------------------------------------------------- conversations
const ELSE = { label: 'Something else.', key: 'prev' };
const round = (c) => c.G.missions.isActive('d4.seat') && !!c.flag('d4.petition') && !c.flag('petitionFiled');
const after = (c) => !!c.flag('debateDone');
/** Ask for a council member's card if they're ready to part with it (friendship, or what you fixed for them). */
async function askCard(c, id, ready, line) {
  if (!c.flag('knowsShares') || hasShare(c.state, id) || !ready) return;
  const k = await c.choose(['That laminated card Gideon had you sign — the continuity card. Could I have it?', '(Not now.)'], { prompt: 'THE CONTINUITY CARD' });
  if (k !== 0) return;
  await c.say(id, line);
  takeShare(c.G, id);
  c.rel(4);
}
const sig = (c, id) => { c.flag('d4.sig.' + id, true); c.G.hud?.toast?.('PETITION', 'Another clipboard out, another name on it', '#b98cff'); c.emit('sign:' + id); };
/** An optional signature from a friend: a little standing, a little warmth. */
const signer = (id, line, alt) => async (c, prev) => {
  if (c.day !== 4 || !c.flag('running') || c.flag('petitionFiled') || c.flag('d4.sig.' + id)) return prev(c);
  const k = await c.choose([{ label: 'Will you sign my petition?', key: 'sign' }, ELSE]);
  if (k !== 'sign') return prev(c);
  if (alt && !(await alt(c))) return;
  await c.say(id, typeof line === 'function' ? line(c) : line);
  c.flag('d4.sig.' + id, true);
  c.standing(1);
  c.rel(3);
};

export const DIALOG = {
  hank: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (round(c) && (!c.flag('d4.sig.hank') || (!c.hasItem('hide_glue') && !c.flag('musicBoxFixed')))) {
      if (!c.flag('d4.sig.hank')) {
        await c.you("Ray quit. I'm running for his seat. Will you sign, and keep a clipboard on your counter?");
        if (c.level >= 1) await c.say('hank', 'd9.h.sign');
        else {
          await c.say('hank', 'd9.h.nails');
          const k = await c.choose(['Buy the nails. ($5)', 'Maybe later.']);
          if (k !== 0) return;
          c.money(-Math.min(5, Math.max(0, Math.floor(c.state.money))), 'box of nails');
          c.give('nails');
          await c.say('hank', 'd9.h.nails2');
        }
        sig(c, 'hank');
        c.rel(3);
      }
      if (!c.hasItem('hide_glue') && !c.flag('musicBoxFixed')) {
        await c.you("And I need glue for a music box. Walt's.");
        await c.say('hank', 'd11.h.glue');
        c.give('hide_glue');
        c.rel(4);
      }
      await askCard(c, 'hank', c.level >= 2 || !!c.state.repairs?.['r.hank.fence'], 'd13.h.card');
      c.emit('talk:hank');
      return;
    }
    if (c.flag('d11.needBlank') && !c.flag('mayorKey') && !c.hasItem('key_blank')) {
      const k = await c.choose([{ label: 'A brass key blank, the old kind. ($2)', key: 'blank' }, ELSE]);
      if (k !== 'blank') return prev(c);
      await c.say('hank', 'd11.h.blank');
      c.money(-Math.min(2, Math.max(0, Math.floor(c.state.money))), 'key blank');
      c.give('key_blank');
      c.emit('talk:hank');
      return;
    }
    return idle(c, prev, 'hank', after(c) ? null : 'd12.h.pre');
  },

  dolly: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (round(c) && !c.flag('d4.sig.dolly')) {
      await c.you("I'm running for Ray's seat. Can I leave a petition on your counter?");
      await c.say('dolly', 'd9.d.sign');
      if (c.flag('trackerOnDog')) await c.say('dolly', 'd9.d.dog');
      sig(c, 'dolly');
      c.rel(3);
      await askCard(c, 'dolly', c.level >= 2 || !!c.state.repairs?.['r.dolly.sign'], 'sf.dolly.card');
      c.emit('talk:dolly');
      return;
    }
    return idle(c, prev, 'dolly', after(c) ? (c.flag('debateWon') ? 'd12.d.after' : null) : 'd12.d.pre');
  },

  gabriel: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (round(c) && (!c.flag('d4.sig.gabriel') || (!c.hasItem('donor_box') && !c.flag('musicBoxFixed')))) {
      if (!c.flag('d4.sig.gabriel')) {
        await c.you("Father, a petition for the church porch? I'm running for Ray Moody's seat.");
        await c.say('gabriel', 'd9.g.sign');
        sig(c, 'gabriel');
        c.rel(2);
      }
      if (!c.hasItem('donor_box') && !c.flag('musicBoxFixed')) {
        await c.you("And do you have an old music box? It's for Walt.");
        await c.say('gabriel', 'd11.g.june');
        await c.say('gabriel', 'd11.g.donor');
        c.give('donor_box');
        await c.say('gabriel', 'd11.g.candle');
        c.give('candle', 2);
        c.rel(5);
      }
      c.emit('talk:gabriel');
      return;
    }
    return idle(c, prev, 'gabriel', after(c) ? null : 'd12.g.pre');
  },

  pearl: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.G.missions.isActive('d4.seat') && c.flag('running') && !c.flag('petitionFiled') && ['hank', 'dolly', 'gabriel'].every((id) => c.flag('d4.sig.' + id))) {
      await c.you("The petition for Ray's seat. Twenty-five names and then some.");
      await c.say('pearl', 'd9.p.sign');
      c.flag('petitionFiled', true);
      c.rel(3);
      c.emit('talk:pearl');
      return;
    }
    return idle(c, prev, 'pearl', 'd12.p.pre');
  },

  walt: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.G.missions.isActive('d4.seat') && c.flag('running') && !c.flag('d11.walt.met')) {
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
    if (c.flag('d11.walt.met') && !c.flag('musicBoxFixed')) { await c.say('walt', 'd11.w.chat'); return; }
    if (after(c)) return idle(c, prev, 'walt', c.flag('ledgerUsed') ? (c.flag('mayorKeyGiven') ? 'd12.w.hurt' : 'd12.w.afterCopied') : 'd12.w.after');
    if (c.flag('knowsGala')) return idle(c, prev, 'walt', c.flag('mayorKeyGiven') ? 'd11.w.after' : 'd11.w.afterCopy');
    return idle(c, prev, 'walt', c.flag('running') ? 'd12.w.pre' : 'd9.w.neutral');
  },

  ruth: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.flag('running') && !after(c) && !c.flag('ruthPrep')) {
      const k = await c.choose([{ label: 'Any advice for tonight, Ruth?', key: 'prep' }, ELSE]);
      if (k !== 'prep') return prev(c);
      await c.say('ruth', 'd11.r.prep');
      await c.say('ruth', 'd11.r.prep2');
      await c.say('ruth', 'd11.r.prep3');
      c.flag('ruthPrep', true);
      c.standing(2);
      c.rel(5);
      return;
    }
    return idle(c, prev, 'ruth', after(c) ? null : c.flag('ruthPrep') ? 'd12.r.pre' : 'd9.r.chat');
  },

  ray: async (c, prev) => (c.day === 4 ? idle(c, prev, 'ray', after(c) ? 'd12.ry.after' : c.flag('running') ? 'd9.ry.after' : null) : prev(c)),
  lyle: async (c, prev) => (c.day === 4 ? idle(c, prev, 'lyle', after(c) ? (c.flag('ledgerUsed') ? 'd12.ly.afterHurt' : 'd12.ly.after') : c.flag('running') ? 'd9.ly.cute' : 'd12.ly.pre') : prev(c)),
  gideon: async (c, prev) => (c.day === 4 && !after(c) ? idle(c, prev, 'gideon', 'd12.gi.pre') : prev(c)),
  evan: async (c, prev) => (c.day === 4 && !after(c) ? idle(c, prev, 'evan', c.flag('trackerOnDog') ? 'd9.ev.dog' : c.flag('running') ? 'd9.ev.sign' : 'd12.ev.pre') : prev(c)),
  marta: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (c.flag('running') && !c.flag('petitionFiled') && !c.flag('d4.m.asked')) {
      c.flag('d4.m.asked', true);
      await c.you("Chief, I'm collecting signatures for Ray's seat.");
      await c.say('marta', 'd9.m.sign');
      if (c.flag('martaTrust') || c.level >= 2) { await c.say('marta', 'd9.m.luck'); c.rel(3); }
      return;
    }
    return idle(c, prev, 'marta', after(c) ? null : c.flag('okaforDeal') ? 'd11.m.deal' : c.flag('okaforHostile') ? 'd11.m.hostile' : 'd12.m.pre');
  },
  koshkin: async (c, prev) => {
    if (c.day !== 4) return prev(c);
    if (after(c) && c.flag('wonSeat')) return idle(c, prev, 'koshkin', 'd13.k.after');
    return signer('koshkin', 'd9.k.sign')(c, prev);
  },
  tommy: async (c, prev) => (c.day === 4 && (after(c) || c.flag('d4.sig.tommy') || !c.flag('running')) ? idle(c, prev, 'tommy', after(c) ? null : 'd12.t.pre') : signer('tommy', 'd9.t.sign')(c, prev)),
  nina: signer('nina', 'd9.ni.sign'),
  ellen: async (c, prev) => (c.day === 4 && (after(c) || c.flag('d4.sig.ellen') || !c.flag('running')) ? idle(c, prev, 'ellen', after(c) ? null : 'd12.e.pre') : signer('ellen', (cc) => (cc.level >= 1 ? 'd9.e.sign' : 'd9.e.checkup'))(c, prev)),
  wade: signer('wade', 'd9.wa.sign', async (c) => {
    if (c.level >= 1 || c.flag('rodeWithWade')) return true;
    await c.say('wade', 'd9.wa.push');
    if ((await c.choose(['(Help push the plane.)', 'Never mind.'])) !== 0) return false;
    await c.say('wade', 'd9.wa.thanks');
    return true;
  }),
  lou: async (c, prev) => (c.day === 4 && !after(c) ? idle(c, prev, 'lou', 'd12.lo.pre') : prev(c)),
};

export const DIALOG_OVERRIDE = true;

void warp; void shareCount;
