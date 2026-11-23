// DAY 3 (Wednesday) — Ears and Eyes. A video call home over breakfast. Dolly
// knows City Hall lost its cleaner; Walt hires Rybka for the morning: mop,
// sweep, a bug under the council table and one in the mayor's office while
// Gideon Shaw minds the front desk. Home: the door is unlocked, three wrong
// passwords on the laptop, a lens in the smoke alarm. Sweep the cabin; after
// dark, loop the square's streetlight cameras (field hack 'camloop'). At eight
// the mayor's office bug catches Shaw asking Walt about the council's sealed
// "continuity cards": the mayor's key plus any three of five. Outside the
// diner, the man in the grey parka: Special Agent Daniel Okafor, FBI. Three
// questions at the police station: a deal, or not. Night School lesson 3.
//
// flags: cityhallJanitor, bug.chamber, bug.mayor, d4.paid, cabinSearched,
//   cameraInSmokeAlarm, alarmCamKept, trackerKept | trackerOnDog, cabinSwept,
//   camsLooped, knowsContinuityCards, knowsShares, greyWarned,
//   okaforTrust (number), okaforDeal | okaforHostile, martaTrust.
import {
  at, yawTo, dist, cu, shot, rel, standing, place, warp, release, keepTime, cap, clockTo, waitFor, hold, meet, hack, idle,
} from './kit.js';

export const DAY = { n: 3, start: ['d3.ears'], mustFinish: ['d3.ears', 'd3.sweep', 'd3.loop', 'd3.grey'] };

export const LINES = {
  // ---- breakfast: a video call home
  'd7.v.hello': { who: 'valya', ru: 'Рыбка! Ну-ка, покажись. Кожа да кости! Я так и знала. Ты там ешь что-нибудь?', en: 'Rybka! Come on, let me see you. Skin and bones! I knew it. Are you eating anything over there?', emo: 'worry' },
  'd7.l.hello': { who: 'lyosha', ru: 'Привет! Я поставил на экран Порт-Зарю со спутника. Вон, видишь точку у воды? Это твоя хижина.', en: "Hi! I've put Port Zarya from the satellite on my screen. See the dot by the water? That's your cabin.", emo: 'smile' },
  'd7.dm.hello': { who: 'dmitri', ru: 'Здравствуй, Рыбка. Хорошо выглядишь. Устало, но хорошо.', en: 'Hello, Rybka. You look good. Tired, but good.', emo: 'smile' },
  'd7.v.socks': { who: 'valya', ru: 'Я тебе носки вяжу. Шерстяные. Гриша привезёт, когда всё кончится. Размер помню.', en: "I'm knitting you socks. Wool. Grisha will bring them when this is all over. I remember your size.", emo: 'smile' },
  'd7.gr.socks': { who: 'grisha', ru: 'Она и мне вяжет. Уже третий месяц. Один носок.', en: "She's knitting me some too. Third month now. One sock." },
  'd7.v.bear': { who: 'valya', ru: 'У тебя нога как у медведя, Гриша. На тебя шерсти во всей Чукотке не хватит.', en: "You've got feet like a bear, Grisha. There isn't enough wool in all Chukotka for you.", emo: 'laugh' },
  'd7.gr.sandwich': { who: 'grisha', ru: 'Правда, что у вас там бутерброд — двенадцать долларов? Да я за такие деньги корову куплю!', en: "Is it true a sandwich costs twelve dollars over there? For twelve dollars I'd buy a cow!", emo: 'laugh' },
  'd7.v.miss': { who: 'valya', ru: 'И мы скучаем. Даже Иван. Иван, скажи.', en: 'And we miss you. Even Ivan. Ivan, say something.', emo: 'smile' },
  'd7.i.miss': { who: 'ivan', ru: '…Скучаем.', en: '…We miss you.' },
  'd7.l.weather': { who: 'lyosha', ru: 'Минус тридцать два, ветер, Гриша опять чинит генератор голыми руками. Всё как обычно.', en: "Minus thirty-two, wind, and Grisha's fixing the generator with his bare hands again. Business as usual.", emo: 'laugh' },
  'd7.n.call': { who: 'nadia', ru: 'Всё, хватит. Канал открыт слишком долго. Рыбка… мы тобой гордимся. Очень.', en: "That's enough. The channel's been open too long. Rybka… we're proud of you. Very.", emo: 'smile' },
  'd7.v.bye': { who: 'valya', ru: 'Ешь суп! Слышишь? Суп!', en: 'Eat soup! You hear me? Soup!', emo: 'smile' },
  'd7.gr.bye': { who: 'grisha', ru: 'Пока, Рыбка! Обнимаю! Крепко!', en: 'Bye, Rybka! Big hug! A tight one!', emo: 'laugh' },
  'd7.l.bye': { who: 'lyosha', ru: 'Урок вечером, не забудь! Цикл for! Лучшее, что есть на свете!', en: "Lesson tonight, don't forget! The for loop! The best thing in the world!", emo: 'smile' },
  'd7.dm.bye': { who: 'dmitri', ru: 'Тихо, Рыбка.', en: 'Quietly, Rybka.', emo: 'smile' },

  // ---- the earpiece: City Hall
  'd3x.l.bugs': { who: 'lyosha', ru: 'Жучки — в банке из-под чая, у тебя в сумке. Три штуки. Я их сам паял.', en: 'The bugs are in the tea tin in your bag. Three of them. I soldered them myself.' },
  'd4.n.reason': { who: 'nadia', ru: 'Теперь нам нужен повод войти в мэрию. Надолго и без лишних вопросов.', en: 'Now we need a reason to be inside City Hall. For a long time, with no questions asked.' },
  'd4.n.dolly': { who: 'nadia', ru: 'Спроси у Долли. Долли знает всё и про всех.', en: 'Ask Dolly. Dolly knows everything about everyone.' },
  'd4.n.shaw': { who: 'nadia', ru: 'Шоу у стойки. Он то смотрит на лестницу, то отворачивается. Лови момент. Глаз на экране подскажет.', en: "Shaw's at the front desk. He keeps glancing at the stairs, then looking away. Pick your moment. The eye on your screen will tell you.", emo: 'serious' },
  'd4.n.clean': { who: 'nadia', ru: 'И мой по-настоящему. Уборщик, который не убирает, — подозрительный уборщик.', en: "And mop for real. A janitor who doesn't clean is a suspicious janitor." },
  'd4.l.chamber': { who: 'lyosha', ru: 'Под столом совета тихо, и там никто никогда не убирает. Кроме тебя.', en: 'Under the council table. Nice and quiet, and nobody ever cleans there. Except you.' },
  'd4.n.office': { who: 'nadia', ru: 'Мэр ушёл. Кабинет заперт. У тебя минуты две, не больше.', en: "The mayor's gone. The office is locked. You have two minutes, no more.", emo: 'serious' },
  'd4.n.office2': { who: 'nadia', ru: 'Снова ушёл. Второй шанс. Не трать его.', en: "He's out again. Second chance. Don't waste it." },
  'd4.n.back': { who: 'nadia', ru: 'Мэр возвращается! Уходи из кабинета!', en: "The mayor's coming back! Get out of the office!", emo: 'worry' },
  'd4.n.missed': { who: 'nadia', ru: 'Не успели. Ничего. Подождём, пока он снова уйдёт. Помой пока что-нибудь.', en: "Didn't make it. Never mind. We'll wait for him to leave again. Mop something in the meantime." },
  'd4.n.caught': { who: 'nadia', ru: 'Спокойно. Ты уборщик. Уборщики заходят куда угодно.', en: "Easy. You're the janitor. Janitors go anywhere." },
  'd4.l.mayor': { who: 'lyosha', ru: 'Есть. Слышу, как тикают его часы. Очень громкие часы.', en: 'Got it. I can hear his clock ticking. A very loud clock.' },
  'd4.n.wait': { who: 'nadia', ru: 'Жучки работают. Лёша пишет всё. Теперь ждём. Люди любят поговорить, когда думают, что они одни.', en: "The bugs are working. Lyosha's recording everything. Now we wait. People love to talk when they think they're alone." },

  // ---- Dolly, Walt, Gideon: the cleaning job
  'd4.d.job1': { who: 'dolly', en: 'City Hall? Funny you ask. Bev Kaplan cleaned that place for thirty years. Her daughter had twins in Fairbanks, and off she went.' },
  'd4.d.job2': { who: 'dolly', en: "Walt's been emptying his own trash for two weeks. You should see his office. Actually, no, you shouldn't. Go see him. Tell him Dolly sent you." },
  'd4.wt.hire1': { who: 'walt', en: 'Dolly sent you? Bless that woman. Look at this place. I found a sandwich in the council chamber from the Fourth of July.' },
  'd4.wt.hire2': { who: 'walt', en: "Fifteen an hour, cash. Mop, trash, the chamber. And stay off the second floor. Gideon's particular about upstairs. Keypad and everything." },
  'd4.wt.twenty': { who: 'walt', en: "Twenty? Ha! Okay, okay. Seventeen. Don't tell Lyle, he'll want a raise, and he doesn't even work here.", emo: 'laugh' },
  'd4.wt.pie': { who: 'walt', en: "I'm off to Dolly's for a slice. Office locks itself, so don't bother with it. It's clean enough. It isn't. But it's enough." },
  'd4.wt.pie2': { who: 'walt', en: "Lyle wants me at the diner. Again. If anybody calls, I'm in a meeting. The meeting is pie." },
  'd4.wt.caught': { who: 'walt', en: "Oh! You're in here. The door was locked, wasn't it? Hm. Must not have caught. That lock's older than I am.", emo: 'surprise' },
  'd4.wt.sorry': { who: 'walt', en: "No harm done. Just don't touch the painting behind my desk. It's crooked on purpose. Don't ask." },
  'd4.wt.pay': { who: 'walt', en: "Look at this place. You can see the harbour through the chamber windows again. Here's your money. Cash. Come back next Thursday, if you like." },
  'd4.gi.janitor': { who: 'gideon', en: "Oh. The janitor. Of course. Walt mentioned. Please don't touch anything upstairs. Or on my desk. Or near my desk.", emo: 'smile' },
  'd4.gi.idle': { who: 'gideon', en: "You missed a spot. I'm joking. Mostly.", emo: 'smile' },
  'd4.gi.later': { who: 'gideon', en: "Thank you for the windows. I can see the Dome from my office now. Beautiful, isn't it?", emo: 'smile' },

  // ---- home: someone was here
  'd7.n.door': { who: 'nadia', ru: 'Стоп. Дверь не заперта. А мы запирали, когда уходили.', en: 'Stop. The door is unlocked. We locked it when we left.', emo: 'worry' },
  'd7.n.slow': { who: 'nadia', ru: 'Заходи. Медленно. Ничего не трогай. Просто смотри.', en: "Go in. Slowly. Don't touch anything. Just look.", emo: 'serious' },
  'd7.n.bag': { who: 'nadia', ru: 'Сумка стояла не так. И молния застёгнута до конца — ты так никогда не делаешь.', en: "Your bag wasn't like that. And it's zipped all the way — you never do that.", emo: 'worry' },
  'd7.l.laptop': { who: 'lyosha', ru: 'Три неправильных пароля. Час назад. Ничего они не получили — диск зашифрован.', en: 'Three wrong passwords. An hour ago. They got nothing — the disk is encrypted.', emo: 'serious' },
  'd7.n.up': { who: 'nadia', ru: 'Не поднимай голову. Датчик дыма над столом. Огонёк синий. Утром был красный.', en: "Don't lift your head. The smoke alarm over the table. Its light is blue. This morning it was red.", emo: 'worry' },
  'd7.l.lens': { who: 'lyosha', ru: 'Увеличиваю… Там объектив. Камера. Смотрит на стол и на дверь.', en: "Zooming in… There's a lens. A camera. It's watching the table and the door.", emo: 'worry' },
  'd7.n.dont': { who: 'nadia', ru: 'Нет! Снимешь — они поймут, что мы знаем. Оставь. Пожалуйста.', en: "No! Take it down and they'll know that we know. Leave it. Please.", emo: 'angry' },
  'd7.n.good': { who: 'nadia', ru: 'Правильно. Пусть смотрят.', en: 'Right. Let them watch.' },
  'd3x.l.three': { who: 'lyosha', ru: 'Камера там наверняка не одна. Где одна, там и три.', en: "That camera won't be alone. Where there's one, there are three." },
  'd8.l.app': { who: 'lyosha', ru: 'Я поставил тебе на телефон сканер. Иди медленно, держи телефон перед собой. Запищит — ищи.', en: "I've put a scanner on your phone. Walk slowly, hold it out in front of you. When it beeps, search." },
  'd8.n.quiet': { who: 'nadia', ru: 'И ни слова вслух. Пока мы не знаем, что они слышат, ты просто плотник, который прибирается дома.', en: "And not a word out loud. Until we know what they can hear, you're just a carpenter tidying up at home." },
  'd8.l.radio': { who: 'lyosha', ru: 'Микрофон в старом приёмнике Юрия. Режь только жёлтый провод. Питание не трогай — пусть думают, что он живой.', en: "A microphone in Yuri's old radio. Cut only the yellow wire. Leave the power alone — let them think it's still alive." },
  'd8.l.radio2': { who: 'lyosha', ru: 'Тишина. Теперь он слышит только, как трещит печка.', en: 'Silence. Now all it hears is the stove crackling.', emo: 'smile' },
  'd8.g.tracker': { who: 'grisha', ru: 'Ага, вот он, под сиденьем. Маячок на магните. Знакомая игрушка.', en: 'Aha, there it is, under the seat. A tracker on a magnet. I know this toy.' },
  'd8.g.keep': { who: 'grisha', ru: 'Правильно, верни на место. Пусть думают, что мы слепые.', en: "Right, put it back. Let them think we're blind." },
  'd8.g.dog': { who: 'grisha', ru: 'Ха! На соседскую лайку? Пусть теперь «Нордстар» гоняется за собакой по всему городу!', en: "Ha! On the neighbour's husky? Now Northstar can chase a dog all over town!", emo: 'laugh' },
  'd8.l.three': { who: 'lyosha', ru: 'Три из трёх. Хижина чистая. Ну, настолько чистая, насколько нам нужно.', en: "Three for three. The cabin's clean. Well — as clean as we need it to be.", emo: 'smile' },
  'd7.l.decoy': { who: 'lyosha', ru: 'Я поставил на ноутбук обманку. Если смотрят — увидят, как плотник учит Python по бесплатному курсу. Скукотища. Идеально.', en: "I've put a decoy on the laptop. If they're watching, they'll see a carpenter learning Python from a free course. Dull as dishwater. Perfect." },
  'd7.dm.fear': { who: 'dmitri', ru: 'Страшно — это нормально, Рыбка. Главное, чтобы этого не было видно.', en: "Being afraid is normal, Rybka. What matters is that it doesn't show.", emo: 'serious' },

  // ---- the streetlights
  'd8.l.lights': { who: 'lyosha', ru: 'Теперь фонари. Новые фонари «Нордстара» вокруг площади — это не фонари. Это камеры с лампочкой сверху.', en: "Now the streetlights. Northstar's new lights around the square aren't streetlights. They're cameras with a bulb on top." },
  'd8.l.lights2': { who: 'lyosha', ru: 'Выключить их нельзя — заметят. Но можно подсунуть им петлю: пустую улицу вместо живой. Для этого мне нужен их щиток.', en: "We can't switch them off — they'd notice. But we can feed them a loop: an empty street instead of a live one. For that I need their junction box." },
  'd8.n.box': { who: 'nadia', ru: 'Щиток на столбе на Фронт-стрит, у закусочной. Старожилы зовут её Беринговой улицей. Только после темноты. И пригнись: этот столб смотрит на площадь.', en: 'The box is on the pole on Front Street, by the diner. The old-timers call it Bering Street. Only after dark. And keep low: that pole watches the square.' },
  'd8.n.dark': { who: 'nadia', ru: 'Стемнело. Пора. Фронт-стрит, столб у закусочной.', en: "It's dark. Time to go. Front Street, the pole by the diner." },
  'd8.l.tap': { who: 'lyosha', ru: 'Я внутри. Вижу всё, что видят они. Боже, сколько тут камер. Теперь твоя очередь — код на телефоне.', en: "I'm in. I can see everything they see. God, so many cameras. Now it's your turn — the code's on your phone." },
  'd8.l.retry': { who: 'lyosha', ru: 'Ничего страшного. Давай ещё раз, я подожду.', en: "No big deal. Let's go again — I'll wait." },
  'd8.l.done': { who: 'lyosha', ru: 'Есть! Площадь видит пустую улицу, снег и одну собаку. Собаку я оставил для правдоподобия.', en: 'Got it! The square sees an empty street, snow and one dog. I left the dog in for realism.', emo: 'laugh' },
  'd8.l.loopalarm': { who: 'lyosha', ru: 'И датчик дыма тоже на петле. Ты спишь. Всю ночь. Каждую ночь.', en: "And the smoke alarm's on the loop too. You're asleep. All night. Every night.", emo: 'smile' },

  // ---- eight o'clock: the mayor's office bug
  'd4.l.live': { who: 'lyosha', ru: 'Кто-то в кабинете мэра. Восемь вечера. Вывожу тебе в ухо.', en: "Someone's in the mayor's office. Eight in the evening. Patching it through to your ear.", emo: 'serious' },
  'd4.bug.g1': { who: 'gideon', en: "This won't take long. Mr. Halloran asked me to confirm the continuity cards. All five. Sealed, unopened, in each member's possession." },
  'd4.bug.w2': { who: 'walt', en: "Those envelopes? Lord. Dolly keeps hers in the pie safe. Hank's is probably in a coffee can with the bolts." },
  'd4.bug.g2': { who: 'gideon', en: "Then remind them. Municipal emergency protocol. Your key and any three of the cards. That's what it takes." },
  'd4.bug.w3': { who: 'walt', en: "Takes to do what, Gideon? Every time I ask what's in that vault up on the hill, you tell me 'continuity'." },
  'd4.bug.g3': { who: 'gideon', en: "Because that's what it is, Walt. Continuity. Sign here. And here. Thank you. Good night, Mr. Mayor." },
  'd4.bug.w4': { who: 'walt', en: 'Yeah. Good night.', emo: 'worry' },
  'd4.l.cards': { who: 'lyosha', ru: 'Слышишь? Ключ мэра и любые три карточки из пяти. Это же…', en: "You hear that? The mayor's key and any three cards of five. That's…", emo: 'surprise' },
  'd4.v.shamir': { who: 'valya', ru: 'Шамир. Разделение секрета. Пять кусочков: любые три открывают дверь, а два ничего не значат. Красиво. Я такое делала в семьдесят четвёртом, только на бумаге.', en: 'Shamir. Secret sharing. Five pieces: any three open the door, and two mean nothing at all. Beautiful. I did this in seventy-four, only on paper.', emo: 'smile' },
  'd4.n.cards': { who: 'nadia', ru: 'Значит, ключ от хранилища Хэллоран разделил между членами совета. А они даже не знают, что хранят.', en: "So Halloran split the vault key between the council members. And they don't even know what they're keeping.", emo: 'serious' },
  'd4.dm.ladder': { who: 'dmitri', ru: 'Вот и лестница. Мэр — и трое из пяти. Тихо, Рыбка. Ступенька за ступенькой.', en: 'There is our ladder. The mayor, and three of five. Quietly, Rybka. One step at a time.', emo: 'serious' },

  // ---- Mr. Grey outside the diner
  'd8.n.diner': { who: 'nadia', ru: 'Хорошо. А теперь иди к Долли и поешь. Обычные люди вечером ужинают, а не лазают по столбам.', en: "Good. Now go to Dolly's and eat. Normal people have dinner in the evening; they don't climb poles." },
  'd8.o.hello': { who: 'okafor', en: "Evening. Cold enough for you? Two weeks in Port Zarya and I still can't feel my face." },
  'd8.o.know': { who: 'okafor', en: "No. But you've been learning a lot about this town lately. So have I. We're reading the same book, you and me." },
  'd8.o.walk': { who: 'okafor', en: "Don't go. I'll be quick. It's too cold for a long conversation, and too many people listen to the short ones." },
  'd8.o.plane': { who: 'okafor', en: 'Good memory. I took your picture. Bad habit. I photograph everyone who flies in. Hardly anybody flies in.', emo: 'smile' },
  'd8.o.lights': { who: 'okafor', en: 'Funny thing, tonight. Every camera on that square fell asleep at the same moment. Nineteen of them. Like somebody sang them a lullaby.' },
  'd8.o.wouldnt': { who: 'okafor', en: 'No. Of course not. You fix roofs.', emo: 'smile' },
  'd8.o.who': { who: 'okafor', en: 'Somebody who notices things. Like you do.' },
  'd8.o.tired': { who: 'okafor', en: "Maybe. Everybody's tired up here. It's the dark." },
  'd3x.o.station': { who: 'okafor', en: "Walk with me. The police station's warm, and the Chief wants to hear this too." },

  // ---- the back room at the police station
  'd10.o.intro': { who: 'okafor', en: "Sit down. The coffee's terrible, I made it myself. Special Agent Daniel Okafor, FBI, Anchorage field office. I'm guessing you had a name for me. Something about the coat.", emo: 'smile' },
  'd10.o.file': { who: 'okafor', en: "Here's what I know. You flew in from Anchorage with a carpenter's licence so clean it squeaks. Nobody in Anchorage remembers hiring you. Nobody." },
  'd10.o.file2': { who: 'okafor', en: 'Day one, you climb a bell tower with a radio relay in your bag. Tonight, nineteen Northstar cameras fall asleep at once. Busy three days for a handyman.' },
  'd10.o.q1': { who: 'okafor', en: "So. First question, and it's the only one that matters. Who are you working for?", emo: 'serious' },
  'd10.o.lie1': { who: 'okafor', en: "Nobody fixes roofs in November. Try again, or don't. Either way I'm writing down that you lied to me.", emo: 'frown' },
  'd10.o.partial1': { who: 'okafor', en: "Friends. Everybody's got friends. Mine are in Anchorage, and they think I'm crazy. Go on." },
  'd10.o.bugs': { who: 'okafor', en: "Consumer hardware. Northstar's own brand, serial numbers filed off. Somebody wanted to know you very well.", emo: 'serious' },
  'd10.m.warrant': { who: 'marta', en: 'Nobody bugs a house in my town without a warrant. And I signed no warrant.', emo: 'angry' },
  'd10.o.q2': { who: 'okafor', en: 'Second question. What do you know about the Dome?' },
  'd10.o.lie2': { who: 'okafor', en: "That's what the brochure says too.", emo: 'frown' },
  'd10.o.partial2': { who: 'okafor', en: "They do. I've had two visits. They brought muffins. It was the most frightening thing that's ever happened to me.", emo: 'smile' },
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
  'd10.i.no': { who: 'ivan', ru: '…Нет. Так нельзя.', en: "…You can't.", emo: 'smile' },
  'd10.dm.hostile': { who: 'dmitri', ru: 'Значит, теперь за нами смотрят двое. Значит, идём быстрее.', en: 'So now two of them are watching us. So we go faster.', emo: 'serious' },
  'd10.l.hostile': { who: 'lyosha', ru: 'Я буду следить за его запросами. Полезет в базу ещё раз — узнаем первыми.', en: "I'll watch his queries. If he digs in the database again, we'll know first." },

  // ---- the night
  'd7.l.lesson': { who: 'lyosha', ru: 'Урок всё равно будет. Сегодня — цикл for. И пусть смотрят: скучнее зрелища не придумаешь.', en: "The lesson's still on. Tonight: the for loop. And let them watch — they couldn't find a duller show." },
  'd7.n.night': { who: 'nadia', ru: 'Спи. Я здесь. Я не сплю.', en: "Sleep. I'm here. I'm not sleeping.", emo: 'smile' },

  // ---- around town on Wednesday
  'd3.k.cams': { who: 'koshkin', en: 'You asked Gideon about the cameras? In front of everybody? Ha! My grandfather would have bought you a drink.', emo: 'laugh' },
  'd3.k.fix': { who: 'koshkin', en: 'Hank says you stood up and talked sense. Hank never says anybody talks sense. I am worried about him.', emo: 'smile' },
  'd3.k.yes': { who: 'koshkin', en: "'Sounds great,' you said? Hm. Well. Young people like free things. I was young once. Around nineteen sixty." },
  'd3.k.none': { who: 'koshkin', en: 'Pearl says you sat in the back like a mouse. Good. Smart mice live longer.' },
  'd3.k.idle': { who: 'koshkin', en: "Pearl's board, eh? Good. Fix the town and the town feeds you. That's how it worked when I was a boy." },
  'd3.d.idle': { who: 'dolly', en: "Wednesday's meatloaf day. Nobody knows why. It's always been meatloaf day." },
  'd8.d.ray': { who: 'dolly', en: "Ray Moody sat right there last night and swore if the council leases the cannery dock to Northstar, he's done. I've never seen him like that.", emo: 'worry' },
  'd3.h.fix': { who: 'hank', en: "That thing you said last night. Free things break. I've been saying that for twenty years and nobody listened. Here. Box of nails. Don't get used to it." },
  'd3.h.jobs': { who: 'hank', en: "Pearl's board, huh? Lumber's twelve, nails four, wire eight. I don't haggle and I don't gift-wrap." },
  'd3.h.idle': { who: 'hank', en: 'Measure twice, cut once, and buy your nails from me.' },
  'd4.h.janitor': { who: 'hank', en: "Heard you're mopping City Hall now. Handyman, shopkeeper, janitor. You collecting jobs like stamps?" },
  'd3.r.cams': { who: 'ruth', en: 'You asked about the cameras. Good. Somebody had to, and I was tired of being the only one.', emo: 'smile' },
  'd3.r.yes': { who: 'ruth', en: "'Sounds great.' Hm. I've heard that before. From people who left when it stopped sounding great.", emo: 'frown' },
  'd3.r.hello': { who: 'ruth', en: 'Did you notice, at the meeting? Gideon never once said who owns the data. Not once in forty pages.' },
  'd4.r.gideon': { who: 'ruth', en: "Gideon came by my house last night with papers to sign. Something about a card I keep for emergencies. I told him I'd read them first. He didn't like that.", emo: 'frown' },
  'd3.ra.hello': { who: 'ray', en: "Back again? You're either lonely or you're a cop. Either way, the beer's the same." },
  'd3.ra.again': { who: 'ray', en: "Thanks for listening last night. Don't spread it around. A guy's allowed to grumble." },
  'd8.ry.chat': { who: 'ray', en: "Emergency session tonight. They want to lease the cannery dock to Northstar. Forty-one jobs. I'm the only no, and I'm sick of being the only no.", emo: 'angry' },
  'd3.ly.yes': { who: 'lyle', en: "My favourite new resident! 'Sounds great.' I've been quoting you all morning.", emo: 'smile' },
  'd3.ly.cold': { who: 'lyle', en: "Lovely meeting. Shame about the tabling. Some people are afraid of progress. You're not one of those, are you?" },
  'd4.ly.glasses': { who: 'lyle', en: "City Hall's new janitor! Wonderful. If you find my reading glasses, they're in the chamber somewhere. I take them off when I'm pretending to listen.", emo: 'smile' },
  'd3.wt.hello': { who: 'walt', en: "Long night last night. Gideon wasn't happy. When Gideon isn't happy, nobody upstairs is happy. And I don't even know who's upstairs.", emo: 'worry' },
  'd3.gi.hello': { who: 'gideon', en: "I hear you're good with your hands. Pearl's board, Dolly's sign. Very civic. Northstar always needs good hands.", emo: 'smile' },
  'd3.gi.cams': { who: 'gideon', en: "I owe you a copy of our privacy policy. I'll have it sent to the cabin. Shore Road, isn't it?", emo: 'smile' },
  'd4.e.hello': { who: 'evan', en: 'Love the new job! City Hall cleaning crew. We carry an amazing line of cleaning supplies, by the way. Very discreet.', emo: 'smile' },
  'd4.m.hello': { who: 'marta', en: 'Saw you going into City Hall with a bucket. Times are hard, huh? Or you just like being inside government buildings.' },
  'd11.p.chat': { who: 'pearl', en: 'Gala invitations went out this morning. Thick cream envelopes, gold edges. None for you, hon. Yet.', emo: 'smile' },
  'd3.g.hello': { who: 'gabriel', en: 'Vespers at six, if you need some quiet. Or chess on Sunday, if you need some humility.', emo: 'smile' },
  'd3.el.koshkin': { who: 'ellen', en: "Did you tell Sasha about his checkup? He sent me a jar of pickled herring instead. That's not a checkup, that's a bribe.", emo: 'smile' },
  'd3.ni.cams': { who: 'nina', en: "You're famous. I played your question on the morning show. Gideon's face when you asked it. Oh my God. Radio can't show faces. Tragic.", emo: 'laugh' },
  'd3.ni.fix': { who: 'nina', en: 'I played your bit about free things breaking. Hank called in to agree. Hank has never called in. Ever.', emo: 'smile' },
  'd3.ni.other': { who: 'nina', en: 'Did you catch the broadcast? Six listeners. Seven, if you count my mom twice.' },
  'd3.t.hello': { who: 'tommy', en: "Saturday. Loon Lake. Three o'clock. I'm telling everybody, so when I win there are witnesses.", emo: 'smile' },
  'd3.wd.hello': { who: 'wade', en: "Nome run tomorrow. Need anything flown in? I don't ask what's in the box. That's my whole business model.", emo: 'smile' },
  'd8.lo.chat': { who: 'lou', en: "What'll it be? Ray's in a mood. Council votes on the cannery tonight. If you want a quiet drink, sit far away from him." },
};

// ---------------------------------------------------------------- City Hall
const CLEAN = [
  { key: 'mop', flag: 'd4.t.mop', where: 'cityhall.chamber', prompt: 'Mop the council chamber', short: 'mop the chamber', game: 'paint', title: 'MOP THE COUNCIL CHAMBER', verb: 'MOP' },
  { key: 'sweep', flag: 'd4.t.sweep', where: 'cityhall.clerk', prompt: 'Empty the bins and sweep the lobby', short: 'sweep the lobby', game: 'shovel', title: 'SWEEP THE LOBBY', verb: 'SWEEP' },
  { key: 'chamber', flag: 'bug.chamber', where: 'cityhall.councilTable', prompt: 'Dust under the council table (plant a bug)', short: 'a bug under the council table', game: 'wire', title: 'PLANT THE BUG', act: 0.5, line: 'd4.l.chamber' },
];

/** Run tasks at their spots, in any order the player likes. */
async function anyOrder(m, tasks, label, doTask) {
  const open = {};
  for (let guard = 0; guard < 12; guard++) {
    const todo = tasks.filter((t) => !m.flag(t.flag));
    if (!todo.length) break;
    const near = todo.slice().sort((a, b) => dist(m.G, a.where) - dist(m.G, b.where))[0];
    m.obj(label(todo.length), near.where, todo.map((t) => t.short).join(' · '));
    for (const t of todo) if (!open[t.key]) open[t.key] = m.spot(t.key, t.where, t.prompt, 2.4).then(() => t);
    const t = await Promise.race(todo.map((x) => open[x.key]));
    delete open[t.key];
    await doTask(t);
    m.flag(t.flag, true);
  }
}

/** Gideon at the front desk: watches the stairs for a few seconds, then looks back into the building. */
function shawAtTheDesk(m, isOn) {
  const G = m.G, s = G.state;
  const desk = at(G, 'cityhall.reception');
  const toStairs = yawTo(desk, at(G, 'cityhall.stairs'));
  warp(G, 'gideon', desk);
  return m.until(() => {
    if (!isOn()) return true;
    const n = G.npcs?.get?.('gideon');
    if (n && !n.scripted) warp(G, 'gideon', desk);
    if (n?.goal) n.goal.yaw = s.stats.playSeconds % 13 < 5.5 ? toStairs : desk.rot;
    return false;
  });
}

// The mayor steps out (for pie). His office locks; the bug goes under his desk
// before he's back. Missed? He goes out again a little later.
async function theMayorsOffice(m) {
  const G = m.G, s = G.state;
  const office = at(G, 'cityhall.mayorOffice');
  const desk = at(G, 'cityhall.mayorDesk');
  for (let w = 0; w < 6 && !m.flag('bug.mayor'); w++) {
    await m.scene(async (d) => {
      await d.bring('walt', office);
      await d.say('walt', w ? 'd4.wt.pie2' : 'd4.wt.pie', { cam: cu(d, 'walt') });
    });
    place(G, 'walt', at(G, 'diner.door'));
    m.ear(w ? 'd4.n.office2' : 'd4.n.office');
    const deadline = s.stats.playSeconds + (w ? 150 : 115);
    let open = true;
    const work = (async () => {
      m.obj("Pick the lock of the mayor's office", 'cityhall.mayorOffice', "Plant a bug before he's back");
      await m.spot('lock' + w, 'cityhall.mayorOffice', 'Pick the lock', 2);
      if (!open) return false;
      G.attention.act(0.5, 6);
      await m.minigame('lock', { title: "THE MAYOR'S DOOR" });
      if (!open) return false;
      m.obj('Plant a bug under the desk', 'cityhall.mayorDesk', "Quick — he's at Dolly's");
      await m.spot('desk' + w, 'cityhall.mayorDesk', 'Plant a bug under the desk', 2);
      if (!open) return false;
      G.attention.act(0.4, 6);
      await m.minigame('wire', { title: 'PLANT THE BUG' });
      s.inv.bug = Math.max(0, (s.inv.bug || 1) - 1);
      m.flag('bug.mayor', true);
      m.ear('d4.l.mayor');
      m.obj('Get out of the office', 'cityhall.reception');
      await m.until(() => dist(G, desk) > 4.5);
      return true;
    })();
    const res = await Promise.race([work, m.until(() => s.stats.playSeconds > deadline).then(() => 'late')]);
    if (res !== 'late') continue; // planted and out
    open = false;
    G.interact?.remove?.(`${m.id}:lock${w}`);
    G.interact?.remove?.(`${m.id}:desk${w}`);
    warp(G, 'walt', at(G, 'cityhall.door_in'));
    place(G, 'walt', desk);
    m.ear('d4.n.back');
    if (dist(G, desk) < 4.5) {
      // caught in his office
      G.attention.add(4);
      await m.scene(async (d) => {
        await d.bring('walt', office);
        await d.say('walt', 'd4.wt.caught', { cam: cu(d, 'walt') });
        await d.choose(['"Dusting. Your shelves are a disgrace, Mr. Mayor."', '"The door was open. I\'m sorry."'], { prompt: 'THE MAYOR' });
        await d.say('walt', 'd4.wt.sorry', { cam: cu(d, 'walt', { side: -1 }) });
        await d.say('nadia', 'd4.n.caught', { radio: true });
      });
    } else await m.ear('d4.n.missed');
    if (m.flag('bug.mayor')) break;
    m.obj('Look busy until the mayor goes out again', 'cityhall.chamber');
    const until = s.stats.playSeconds + 45;
    await m.until(() => s.stats.playSeconds > until);
  }
  if (!m.flag('bug.mayor')) m.flag('bug.mayor', true); // (six tries: the bug goes in anyway)
  release(G, 'walt');
}

// ---------------------------------------------------------------- missions
export const MISSIONS = {
  'd3.ears': {
    title: 'Clean Sweep', main: true, day: 3,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 8.6);
        await m.scene((d) => callHome(m, d));
      }
      if (m.cp(2, from)) {
        cap(m, 10);
        m.ears(['d3x.l.bugs', 'd4.n.reason', 'd4.n.dolly']);
        s.inv.bug = Math.max(s.inv.bug || 0, 3);
        await meet(m, 'dolly', 'diner.waitress', 'Ask Dolly about work at City Hall', 'The Midnight Sun Diner, Front Street', () => !!m.flag('d4.d.job'));
      }
      if (m.cp(3, from)) {
        cap(m, 11);
        await meet(m, 'walt', 'cityhall.mayorDesk', 'Talk to Mayor Hennessey at City Hall', 'His office, behind the lobby', () => !!m.flag('cityhallJanitor'));
      }
      if (m.cp(4, from)) {
        cap(m, 15);
        let on = true;
        const gaze = shawAtTheDesk(m, () => on);
        m.ears(['d4.n.shaw', 'd4.n.clean']);
        await anyOrder(m, CLEAN, (n) => `Clean City Hall — ${n} to go`, async (t) => {
          if (t.act) G.attention.act(t.act, 7);
          await m.minigame(t.game, { title: t.title, verb: t.verb });
          if (t.key === 'chamber') s.inv.bug = Math.max(0, (s.inv.bug || 1) - 1);
          else G.attention.add(-2); // honest work
          if (t.line) m.ear(t.line);
        });
        await theMayorsOffice(m);
        on = false;
        await gaze;
        release(G, 'gideon');
      }
      if (m.cp(5, from)) {
        cap(m, 15.5);
        await meet(m, 'walt', 'cityhall.mayorDesk', 'Collect your pay from the mayor', 'His office', () => !!m.flag('d4.paid'));
        m.ear('d4.n.wait');
        m.done();
        m.start('d3.sweep');
      }
    },
  },

  'd3.sweep': {
    title: 'Uninvited', main: true, day: 3,
    async run(m, from) {
      const G = m.G;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 16.5);
        const text = 'Go home — like any other day';
        m.obj(text, 'cabin.door', 'Shore Road');
        await hold(m, () => dist(G, 'cabin.door') < 3, text, 'cabin.door', 'Shore Road');
        m.flag('cabinSearched', true);
        await m.ear('d7.n.door');
        m.ear('d7.n.slow');
        m.obj('Look around. Touch nothing.', 'cabin.wardrobe', 'Your bag');
        await m.spot('bag', 'cabin.wardrobe', 'Your bag', 2.2);
        await m.ear('d7.n.bag');
        m.obj('Look around. Touch nothing.', 'cabin.desk', 'The laptop');
        await m.spot('laptop', 'cabin.desk', 'The laptop — the lid is open', 2.2);
        await m.ear('d7.l.laptop');
      }
      if (m.cp(2, from)) {
        cap(m, 17);
        await m.scene(async (d) => {
          await d.bring('player', 'cabin.table');
          d.cam(shot(G, at(G, 'cabin.table', 0.5, 0.6), 1.15, at(G, 'cabin.smokeAlarm'), 0, 46));
          await d.say('nadia', 'd7.n.up', { radio: true });
          await d.wait(0.8);
          await d.say('lyosha', 'd7.l.lens', { radio: true });
          const k = await d.choose(['Rip it out.', 'Leave it. Act normal.'], { prompt: 'THE SMOKE ALARM' });
          if (k === 0) { m.flag('d7.wantedRipOut', true); await d.say('nadia', 'd7.n.dont', { radio: true }); }
          else await d.say('nadia', 'd7.n.good', { radio: true });
        });
        m.flag('cameraInSmokeAlarm', true);
        m.flag('alarmCamKept', true);
      }
      if (m.cp(3, from)) {
        cap(m, 17.4);
        await m.ears(['d3x.l.three', 'd8.l.app']);
        m.ear('d8.n.quiet');
        m.obj("Sweep the cabin: Yuri's old radio", 'cabin.radio', 'Phone scanner: 1 of 3 found');
        await m.spot('radio', 'cabin.radio', 'Open the old radio', 2.4);
        await m.ear('d8.l.radio');
        await m.minigame('wire', { title: 'CUT THE MIC, KEEP THE POWER' });
        await m.ear('d8.l.radio2');
        m.obj('Sweep the cabin: the snowmobile outside', 'cabin.snowmobile', 'Phone scanner: 2 of 3 found');
        await m.spot('tracker', 'cabin.snowmobile', 'Check under the seat', 2.6);
        await m.scene(async (d) => {
          await d.say('grisha', 'd8.g.tracker', { radio: true });
          const k = await d.choose(['(Put it back. Let them think I never noticed.)', '(Stick it on the husky next door.)'], { prompt: 'THE TRACKER' });
          if (k === 0) { m.flag('trackerKept', true); await d.say('grisha', 'd8.g.keep', { radio: true }); }
          else { m.flag('trackerOnDog', true); await d.say('grisha', 'd8.g.dog', { radio: true }); }
        });
        m.flag('cabinSwept', true);
        G.hud?.toast?.('CABIN SWEPT', '3 of 3 devices found', '#9fe8b0');
        await m.ears(['d8.l.three', 'd7.l.decoy', 'd7.dm.fear']);
        m.done();
        m.start('d3.loop');
      }
    },
  },

  'd3.loop': {
    title: 'Eyes on the Square', main: true, day: 3,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 17.5);
        await m.ears(['d8.l.lights', 'd8.l.lights2']);
        m.ear('d8.n.box');
        const waited = s.hour < 17.5;
        await waitFor(m, 17.5, 'Open the junction box on Front Street', BOX, 'After dark · the pole by the diner');
        if (waited) m.ear('d8.n.dark');
      }
      if (m.cp(2, from)) {
        cap(m, 19.6);
        m.obj('Open the junction box on Front Street', BOX, 'Crouch: the pole watches the square');
        await m.spot('box', BOX, 'Open the junction box', 2.4);
        G.attention.act(1.2, 8);
        await m.minigame('wire', { title: 'TAP THE CAMERA LINE' });
        await m.ear('d8.l.tap');
        m.obj('Loop the streetlight cameras', BOX, 'Field hack on your phone');
        await hack(m, 'camloop', BOX, 'Run the camera loop again', 'd8.l.retry');
        m.flag('camsLooped', true);
        const A = G.attention;
        (A?.watchers || []).forEach((w, i) => { if (w.owner === 'smartlight' && Math.hypot(w.x, w.z) < 80) A.looped?.add(i); });
        G.hud?.toast?.('CAMERAS LOOPED', 'The square sees an empty street', '#7fe6ff');
        await m.ears(['d8.l.done', 'd8.l.loopalarm']);
      }
      if (m.cp(3, from)) {
        clockTo(m, 20);
        await m.ear('d4.l.live');
        G.sfx?.staticBurst?.(0.4);
        await m.ears(['d4.bug.g1', 'd4.bug.w2', 'd4.bug.g2', 'd4.bug.w3', 'd4.bug.g3', 'd4.bug.w4']);
        G.sfx?.staticBurst?.(0.25);
        await m.ears(['d4.l.cards', 'd4.v.shamir', 'd4.n.cards', 'd4.dm.ladder']);
        m.flag('knowsContinuityCards', true);
        m.flag('knowsShares', true);
        G.hud?.toast?.('THE VAULT', "The mayor's key + any three of the five council cards", '#ffd166');
        m.done();
        m.start('d3.grey');
      }
    },
  },

  'd3.grey': {
    title: 'Mr. Grey', main: true, day: 3,
    async run(m, from) {
      const G = m.G, s = G.state;
      keepTime(m);
      if (m.cp(1, from)) {
        cap(m, 20.4);
        m.ear('d8.n.diner');
        const text = 'Get dinner at the Midnight Sun Diner';
        m.obj(text, 'diner.door', 'Be seen being normal');
        await hold(m, () => dist(G, 'diner.door') < 9, text, 'diner.door', 'Be seen being normal');
      }
      if (m.cp(2, from)) {
        m.clear();
        cap(m, 20.8);
        G.npcs?.ensure?.('okafor');
        const door = at(G, 'diner.door');
        await m.scene(async (d) => {
          const P = G.player.pos;
          const spot = { x: door.x - 2.2, z: door.z - 1.6 };
          await d.bring('okafor', { ...spot, rot: yawTo(spot, P) });
          await d.bring('player', { x: P.x, z: P.z, rot: yawTo(P, spot) });
          await d.say('okafor', 'd8.o.hello', { cam: cu(d, 'okafor') });
          const k = await d.choose(['Do I know you?', '(Say nothing. Keep walking.)', 'You were on my plane.'], { prompt: 'MR. GREY' });
          await d.say('okafor', ['d8.o.know', 'd8.o.walk', 'd8.o.plane'][k] || 'd8.o.know', { cam: cu(d, 'okafor', { side: -1 }) });
          await d.say('okafor', 'd8.o.lights', { cam: d.actors?.okafor ? d.overShoulder('player', 'okafor') : undefined });
          const k2 = await d.choose(["I wouldn't know anything about cameras.", 'Who are you?', 'Maybe they were tired.'], { prompt: 'MR. GREY' });
          await d.say('okafor', ['d8.o.wouldnt', 'd8.o.who', 'd8.o.tired'][k2] || 'd8.o.who', { cam: cu(d, 'okafor') });
          await d.say('okafor', 'd3x.o.station', { cam: cu(d, 'okafor', { dist: 0.7 }) });
        });
        m.flag('greyWarned', true);
      }
      if (m.cp(3, from)) {
        cap(m, 21.4);
        const office = at(G, 'police.chiefOffice');
        await G.fadeTeleport?.({ x: office.x, z: office.z, yaw: office.rot }, 1.6);
        G.npcs?.ensure?.('okafor');
        let trust = 0, marta = false;
        await m.scene(async (d) => {
          const desk = at(G, 'police.chiefDesk');
          const me = at(G, 'police.chiefOffice');
          await d.bring('player', { ...me, rot: yawTo(me, desk) });
          await d.bring('okafor', { ...desk, rot: yawTo(desk, me) }, { sit: true });
          const mp = at(G, 'police.chiefOffice', 1.3, 0.6);
          await d.bring('marta', { ...mp, rot: yawTo(mp, me) });
          await d.say('okafor', 'd10.o.intro', { cam: cu(d, 'okafor') });
          await d.say('okafor', 'd10.o.file');
          await d.say('okafor', 'd10.o.file2', { cam: cu(d, 'okafor', { side: -1 }) });
          await d.say('okafor', 'd10.o.q1', { cam: cu(d, 'okafor', { dist: 0.6 }) });
          // round one: who are you working for?
          const o1 = [{ t: 'Nobody. I fix roofs.', v: -1, r: 'd10.o.lie1' }, { t: 'Friends. People who want Northstar stopped.', v: 1, r: 'd10.o.partial1' }];
          if (m.flag('cabinSwept')) o1.push({ t: '(Put the bugs from your cabin on the table.)', v: 2, r: 'd10.o.bugs', m: 'd10.m.warrant' });
          const a1 = o1[await d.choose(o1.map((o) => o.t), { prompt: 'WHO ARE YOU WORKING FOR?' })] || o1[0];
          trust += a1.v;
          await d.say('okafor', a1.r, { cam: cu(d, 'okafor') });
          if (a1.m) { await d.say('marta', a1.m, { cam: cu(d, 'marta', { side: -1 }) }); marta = true; }
          // round two: the Dome
          await d.say('okafor', 'd10.o.q2', { cam: d.actors?.okafor ? d.overShoulder('player', 'okafor') : undefined });
          const o2 = [{ t: "It's an old radar station. That's all I know.", v: -1, r: 'd10.o.lie2' }, { t: 'Halloran lives up there. People who look too long get visits.', v: 1, r: 'd10.o.partial2' }];
          if (m.flag('knowsShares')) o2.push({ t: "The council's continuity cards aren't for emergencies. They're keys to his vault.", v: 2, r: 'd10.o.cards' });
          const a2 = o2[await d.choose(o2.map((o) => o.t), { prompt: 'WHAT DO YOU KNOW ABOUT THE DOME?' })] || o2[0];
          trust += a2.v;
          await d.say('okafor', a2.r, { cam: cu(d, 'okafor', { side: -1 }) });
          // his cards on the table
          await d.say('okafor', 'd10.o.mine', { cam: cu(d, 'okafor', { dist: 0.9 }) });
          await d.say('okafor', 'd10.o.mine2');
          await d.say('okafor', 'd10.o.mine3', { cam: cu(d, 'okafor', { dist: 0.6 }) });
          const o3 = [
            { t: 'Nothing. Let me go.', v: -1, r: 'd10.o.lie3' },
            { t: 'Proof. Of what Northstar is really building.', v: 1, r: 'd10.o.proof' },
            { t: "There's a drive in Halloran's vault. It stops what he's planning. Before it switches off the world.", v: 3, r: 'd10.o.truth' },
          ];
          const a3 = o3[await d.choose(o3.map((o) => o.t), { prompt: 'WHAT ARE YOU REALLY AFTER?' })] || o3[0];
          trust += a3.v;
          await d.say('okafor', a3.r, { cam: cu(d, 'okafor') });
          if (trust >= 3) {
            await d.say('okafor', 'd10.o.deal', { cam: cu(d, 'okafor', { side: -1 }) });
            await d.say('okafor', 'd10.o.deal2');
            await d.say('marta', 'd10.m.deal', { cam: cu(d, 'marta') });
            marta = true;
          } else {
            await d.say('okafor', 'd10.o.hostile', { cam: cu(d, 'okafor', { dist: 0.6 }) });
            await d.say('marta', 'd10.m.hostile', { cam: cu(d, 'marta', { side: -1 }) });
          }
        });
        const deal = trust >= 3;
        m.flag('okaforTrust', trust);
        m.flag('okaforDeal', deal);
        m.flag('okaforHostile', !deal);
        if (marta) m.flag('martaTrust', true);
        G.attention.add(deal ? -10 : 12);
        if (deal) rel(G, 'okafor', 20);
        rel(G, 'marta', marta ? 10 : 2);
        G.hud?.toast?.(deal ? 'AN UNOFFICIAL FRIEND' : 'THE FBI IS WATCHING', deal ? 'Okafor gave you a number with no name' : "Okafor doesn't believe you", deal ? '#9fe8b0' : '#ff8a5a');
        const out = at(G, 'police.door');
        await G.fadeTeleport?.({ x: out.x, z: out.z, yaw: out.rot }, 1.2);
      }
      if (m.cp(4, from)) {
        await m.ear('d10.n.breathe');
        if (m.flag('okaforDeal')) await m.ears(['d10.dm.deal', 'd10.g.deal', 'd10.i.no']);
        else await m.ears(['d10.dm.hostile', 'd10.l.hostile']);
      }
      if (m.cp(5, from)) {
        cap(m, 23.5);
        m.ear('d7.l.lesson');
        const text = "Lyosha's lesson — the laptop in your cabin";
        m.obj(text, 'cabin.laptop', 'Night School · Lesson 3: One Loop, Every Item');
        await hold(m, () => !!s.lessons.l07, text, 'cabin.laptop', 'Night School · Lesson 3: One Loop, Every Item');
        await m.ear('d7.n.night');
        m.done();
      }
    },
  },
};

// the smart-light pole's junction box on Front Street, by the diner
const BOX = { x: 14, z: 56 };

// Breakfast: the team on the laptop screen.
async function callHome(m, d) {
  const G = m.G;
  await d.bring('player', 'cabin.desk', { sit: true });
  d.cam(shot(G, at(G, 'cabin.desk', 0.35, -1.1), 1.55, at(G, 'cabin.laptop'), 0.15, 38));
  G.sfx?.phone?.();
  d.call?.(['valya', 'dmitri', 'lyosha', 'grisha', 'ivan']);
  await d.say('valya', 'd7.v.hello');
  await d.say('lyosha', 'd7.l.hello');
  await d.say('dmitri', 'd7.dm.hello', { cam: cu(d, 'player', { side: -1 }) });
  await d.say('valya', 'd7.v.socks');
  await d.say('grisha', 'd7.gr.socks');
  await d.say('valya', 'd7.v.bear');
  await d.say('grisha', 'd7.gr.sandwich');
  const k = await d.choose(['Tell them you miss them.', "Ask what the weather's like at home."], { prompt: 'THE CALL HOME' });
  if (k === 0) {
    await d.you('I miss you. All of you. Even the tea.');
    await d.say('valya', 'd7.v.miss');
    await d.say('ivan', 'd7.i.miss');
  } else {
    await d.you("What's the weather like at home?");
    await d.say('lyosha', 'd7.l.weather');
  }
  m.flag('d3.call', k === 0 ? 'miss' : 'weather');
  await d.say('nadia', 'd7.n.call', { radio: true, cam: cu(d, 'player', { dist: 0.7 }) });
  await d.say('valya', 'd7.v.bye');
  await d.say('grisha', 'd7.gr.bye');
  await d.say('lyosha', 'd7.l.bye');
  await d.say('dmitri', 'd7.dm.bye');
  d.hangUp?.();
  await d.wait(0.8);
}

// ---------------------------------------------------------------- conversations
const comment = (c) => { const k = c.flag('d2.comment'); return typeof k === 'string' ? k : 'none'; };
const hired = (c) => !!c.flag('cityhallJanitor');

export const DIALOG = {
  dolly: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (c.G.missions.isActive('d3.ears') && !c.flag('d4.d.job')) {
      await c.you('I hear City Hall could use a hand. Know anything?');
      await c.say('dolly', 'd4.d.job1');
      await c.say('dolly', 'd4.d.job2');
      c.rel(2);
      c.flag('d4.d.job', true);
      c.emit('talk:dolly');
      return;
    }
    return idle(c, prev, 'dolly', c.flag('d4.d.job') ? 'd8.d.ray' : 'd3.d.idle');
  },

  walt: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (c.flag('d4.d.job') && !hired(c)) {
      await c.you('Dolly says you need someone to clean.');
      await c.say('walt', 'd4.wt.hire1');
      await c.say('walt', 'd4.wt.hire2');
      const k = await c.choose(['Deal.', 'Make it twenty.']);
      if (k === 1) { await c.say('walt', 'd4.wt.twenty'); c.flag('d4.wage', 17); } else { c.flag('d4.wage', 15); c.rel(3); }
      c.give('mop');
      c.flag('cityhallJanitor', true);
      c.emit('talk:walt');
      return;
    }
    if (c.flag('bug.mayor') && !c.flag('d4.paid')) {
      await c.say('walt', 'd4.wt.pay');
      c.money((c.flag('d4.wage') === 17 ? 17 : 15) * 4, 'cleaning City Hall');
      c.rel(5);
      c.flag('d4.paid', true);
      c.emit('talk:walt');
      return;
    }
    return idle(c, prev, 'walt', 'd3.wt.hello');
  },

  gideon: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (hired(c) && !c.flag('d4.gi.hi')) { c.flag('d4.gi.hi', true); await c.say('gideon', 'd4.gi.janitor'); c.attention(2); return; }
    if (c.flag('d4.paid')) return idle(c, prev, 'gideon', 'd4.gi.later');
    if (hired(c)) return idle(c, prev, 'gideon', 'd4.gi.idle');
    return idle(c, prev, 'gideon', comment(c) === 'cams' ? 'd3.gi.cams' : 'd3.gi.hello');
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
      if (comment(c) === 'fix') { await c.say('hank', 'd3.h.fix'); c.give('nails'); c.rel(5); return; }
    }
    return idle(c, prev, 'hank', hired(c) ? 'd4.h.janitor' : 'd3.h.jobs');
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
    return idle(c, prev, 'ruth', 'd4.r.gideon');
  },

  ray: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.ra.hi')) { c.flag('d3.ra.hi', true); await c.say('ray', c.flag('d2.rayHeard') ? 'd3.ra.again' : 'd3.ra.hello'); c.rel(2); return; }
    return idle(c, prev, 'ray', 'd8.ry.chat');
  },

  lyle: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    if (!c.flag('d3.ly.hi')) { c.flag('d3.ly.hi', true); await c.say('lyle', comment(c) === 'yes' ? 'd3.ly.yes' : 'd3.ly.cold'); return; }
    return idle(c, prev, 'lyle', hired(c) ? 'd4.ly.glasses' : null);
  },

  evan: async (c, prev) => (c.day === 3 && hired(c) ? idle(c, prev, 'evan', 'd4.e.hello') : prev(c)),
  marta: async (c, prev) => (c.day === 3 && hired(c) && !c.flag('martaTrust') ? idle(c, prev, 'marta', 'd4.m.hello') : prev(c)),
  pearl: async (c, prev) => (c.day === 3 ? idle(c, prev, 'pearl', 'd11.p.chat') : prev(c)),
  gabriel: async (c, prev) => (c.day === 3 ? idle(c, prev, 'gabriel', 'd3.g.hello') : prev(c)),
  ellen: async (c, prev) => (c.day === 3 ? idle(c, prev, 'ellen', 'd3.el.koshkin') : prev(c)),
  nina: async (c, prev) => {
    if (c.day !== 3) return prev(c);
    const k = comment(c);
    return idle(c, prev, 'nina', k === 'cams' ? 'd3.ni.cams' : k === 'fix' ? 'd3.ni.fix' : 'd3.ni.other');
  },
  tommy: async (c, prev) => (c.day === 3 ? idle(c, prev, 'tommy', 'd3.t.hello') : prev(c)),
  wade: async (c, prev) => (c.day === 3 ? idle(c, prev, 'wade', 'd3.wd.hello') : prev(c)),
  lou: async (c, prev) => (c.day === 3 ? idle(c, prev, 'lou', 'd8.lo.chat') : prev(c)),
};

export const DIALOG_OVERRIDE = true;

void standing; void meet;
