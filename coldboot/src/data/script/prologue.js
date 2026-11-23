// Prologue — Bely Mys, the plane, the airstrip.
// Lines: { who, ru (spoken Russian) + en (subtitle) | en (spoken English), emo? }
// Lines spoken TO the player avoid Russian past-tense/adjective gender forms
// (the player can be anyone), so one recording fits every Rybka.

export const LINES = {
  // ---------------------------------------------------------------- the table
  'w.valya.tea': { who: 'valya', ru: 'Чай остынет. Пейте, пока горячий.', en: "The tea's going cold. Drink it while it's hot.", emo: 'smile' },
  'w.grisha.tea': { who: 'grisha', ru: 'Баба Валя, мы тут мир спасать собрались, а вы — про чай.', en: "Baba Valya, we're here to save the world, and you're on about tea.", emo: 'smile' },
  'w.valya.tea2': { who: 'valya', ru: 'Голодным ещё никто мир не спас, Гриша. Пей.', en: 'Nobody ever saved the world hungry, Grisha. Drink.', emo: 'smile' },
  'w.dmitri.enough': { who: 'dmitri', ru: 'Хватит. Лёша, покажи им.', en: 'Enough. Lyosha — show them.', emo: 'serious' },
  'w.lyosha.aurora1': { who: 'lyosha', ru: 'Так. Вот это — «Аврора». Её продаёт американская компания «Нордстар». Она стоит в энергосетях по всему миру.', en: "Okay. This is AURORA. An American company, Northstar, sells it. It's inside power grids all over the world." },
  'w.lyosha.aurora2': { who: 'lyosha', ru: 'Москва, Лондон, Токио, Чикаго… везде. Управляет сетью, балансирует нагрузку. Умная. Слишком умная.', en: 'Moscow, London, Tokyo, Chicago… everywhere. It runs the grid, balances the load. Smart. Too smart.' },
  'w.nadia.worm': { who: 'nadia', ru: 'Покажи червя.', en: 'Show them the worm.', emo: 'serious' },
  'w.lyosha.worm': { who: 'lyosha', ru: 'Внутри «Авроры» спит вот это. Мы назвали его «Полынь». Через четырнадцать дней, на рассвете, он проснётся — и выключит свет. Везде. Сразу.', en: "Inside AURORA, this is sleeping. We named it Wormwood. In fourteen days, at dawn, it wakes up — and turns off the lights. Everywhere. All at once.", emo: 'worry' },
  'w.grisha.hosp': { who: 'grisha', ru: 'Больницы. Насосы. Отопление. Зимой.', en: 'Hospitals. Water pumps. Heating. In winter.', emo: 'frown' },
  'w.dmitri.war': { who: 'dmitri', ru: 'Погибнет больше людей, чем в любой войне.', en: 'More people will die than in any war.', emo: 'serious' },
  // player choice 1
  'w.nadia.who': { who: 'nadia', ru: 'Один человек. Сайрус Хэллоран, основатель «Нордстара». Он считает, что миру нужна перезагрузка. Холодная перезагрузка.', en: "One man. Cyrus Halloran, Northstar's founder. He thinks the world needs a restart. A cold boot.", emo: 'serious' },
  'w.dmitri.tell': { who: 'dmitri', ru: 'Кому? Нас шестеро, на рыбном складе, на краю света. Нам не поверят. А если поверят — Хэллоран узнает первым и разбудит его раньше.', en: "Tell whom? There are six of us, in a fish warehouse, at the edge of the world. Nobody will believe us. And if they do — Halloran hears first, and wakes it early.", emo: 'serious' },
  'w.valya.listen': { who: 'valya', ru: 'Сначала послушай, рыбка. Потом спросишь.', en: 'Listen first, little fish. Ask later.', emo: 'smile' },
  'w.lyosha.key': { who: 'lyosha', ru: 'Есть код отмены. Корневой ключ. Без него червя не остановить — я пробовал. Сорок дней пробовал.', en: "There's an abort code. The root key. Without it you can't stop the worm — I tried. Forty days I tried.", emo: 'worry' },
  'w.nadia.where': { who: 'nadia', ru: 'Ключ хранится здесь. Порт-Заря, Аляска. Тысяча сто сорок жителей. Восемьдесят километров через пролив.', en: "The key is kept here. Port Zarya, Alaska. Eleven hundred and forty people. Eighty kilometres across the strait." },
  'w.dmitri.bought': { who: 'dmitri', ru: 'Хэллоран купил этот город. Магазин, фонари, интернет, мэра. Ключ лежит в его хранилище, на холме. Открыть его могут только люди с самого верха.', en: 'Halloran bought that town. The store, the streetlights, the internet, the mayor. The key is in his vault on the hill. Only people at the very top can open it.' },
  'w.grisha.top': { who: 'grisha', ru: 'А наверх, понятно, просто так не пускают.', en: "And naturally, they don't just let anyone up to the top.", emo: 'smile' },
  'w.dmitri.climb': { who: 'dmitri', ru: 'Значит, поднимемся по лестнице. Ступенька за ступенькой. Тихо.', en: 'Then we climb the ladder. One step at a time. Quietly.', emo: 'serious' },
  'w.nadia.inside': { who: 'nadia', ru: 'Нам нужен человек внутри. Человек, которого никто не знает. Который говорит как они. Который умеет чинить вещи. Людям нравятся те, кто чинит вещи.', en: 'We need someone on the inside. Someone nobody knows. Who talks like them. Who can fix things. People like the ones who fix things.' },
  // player choice 2
  'w.grisha.who': { who: 'grisha', ru: 'А кто ещё? У нас у всех акцент, а у тебя — нет!', en: "Who else? We've all got accents — you don't!", emo: 'smile' },
  'w.dmitri.debt': { who: 'dmitri', ru: 'Четырнадцать месяцев назад мы вытащили тебя из Берингова моря. Мы не просим вернуть долг. Мы просим помочь.', en: "Fourteen months ago we pulled you out of the Bering Sea. We're not asking you to repay a debt. We're asking for help.", emo: 'serious' },
  'w.valya.silence': { who: 'valya', ru: 'Молчание — знак согласия.', en: 'Silence means yes.', emo: 'smile' },
  'w.nadia.ear': { who: 'nadia', ru: 'Я буду у тебя в ухе. Всё время. Каждый день — задание. Каждую ночь — отчёт.', en: "I'll be in your ear. The whole time. Every day, a task. Every night, a report." },
  'w.lyosha.teach': { who: 'lyosha', ru: 'А по ночам я буду учить тебя программировать. Не спорь. Если что-то пойдёт не так — код придётся писать тебе.', en: "And at night I'll teach you to code. Don't argue. If something goes wrong, you're the one who'll have to write the code.", emo: 'smile' },
  'w.grisha.fly': { who: 'grisha', ru: 'А если совсем не так пойдёт — я рядом. Вертолёт заведу хоть на дне моря.', en: "And if it goes really wrong — I'm close. I could start a helicopter at the bottom of the sea.", emo: 'smile' },
  'w.ivan.papers': { who: 'ivan', ru: 'Вот паспорт. Права. Рекомендации. Ты плотник из Анкориджа.', en: "Passport. Licence. References. You're a carpenter. From Anchorage." },
  'w.ivan.lose': { who: 'ivan', ru: '…Не потеряй.', en: "…Don't lose it." },
  'w.valya.doll': { who: 'valya', ru: 'А это от меня. На удачу. Не открывай, пока не понадобится.', en: "And this is from me. For luck. Don't open it until you need it.", emo: 'smile' },
  'w.dmitri.plane': { who: 'dmitri', ru: 'Самолёт в шесть утра. Гриша отвезёт тебя в Анадырь, оттуда — чартер.', en: "The plane's at six in the morning. Grisha drives you to Anadyr; from there, a charter." },
  'w.dmitri.heroes': { who: 'dmitri', ru: 'И помни. Мы не герои. Нас никто не знает и не узнает. Мы делаем это тихо.', en: "And remember. We're not heroes. Nobody knows us, and nobody will. We do this quietly.", emo: 'serious' },
  'w.nadia.quiet': { who: 'nadia', ru: 'Тихо.', en: 'Quietly.', emo: 'smile' },
  'w.valya.end': { who: 'valya', ru: 'А теперь — чай.', en: 'And now — tea.', emo: 'smile' },

  // ---------------------------------------------------------------- the plane
  'p.pilot.welcome': { who: 'pilot', en: "Morning, folks. Beringia Air flight two-eleven to Port Zarya. About ninety minutes. It's minus eighteen on the ground and snowing, so keep your hats handy." },
  'p.nadia.check': { who: 'nadia', ru: 'Проверка связи. Рыбка, слышишь меня? Если да — коснись наушника два раза.', en: 'Comms check. Rybka, can you hear me? If yes — tap the earpiece twice.' },
  'p.nadia.good': { who: 'nadia', ru: 'Хорошо. Чистый сигнал.', en: 'Good. Clean signal.', emo: 'smile' },
  'p.lyosha.hi': { who: 'lyosha', ru: 'Привет из Белого Мыса! Я тебе плейлист на дорогу сделал, там—', en: "Hello from Bely Mys! I made you a playlist for the trip, it's got—", emo: 'smile' },
  'p.nadia.lyosha': { who: 'nadia', ru: 'Лёша. Канал не для этого.', en: "Lyosha. That's not what the channel is for.", emo: 'frown' },
  'p.nadia.rules': { who: 'nadia', ru: 'Слушай внимательно. В Порт-Заре никому не говори настоящего имени. Ты — плотник. Ищешь работу и тишину. Всё.', en: "Listen carefully. In Port Zarya, you tell no one your real name. You're a carpenter. You want work and some peace and quiet. That's all." },
  'p.nadia.koshkin': { who: 'nadia', ru: 'Первая цель — жильё. Старик Кошкин сдаёт хижину брата. Его магазин — на площади, у церкви.', en: "First objective: a place to sleep. Old man Koshkin rents out his late brother's cabin. His store is on the square, by the church." },
  'p.nadia.flash': { who: 'nadia', ru: 'Что это было? Вспышка? Тебя кто-то сфотографировал?', en: 'What was that? A flash? Did someone just take your picture?', emo: 'worry' },
  'p.nadia.calm': { who: 'nadia', ru: 'Спокойно. Не смотри на него. Запомни лицо.', en: "Easy. Don't look at him. Remember the face.", emo: 'serious' },
  'p.grisha.wind': { who: 'grisha', ru: 'Это просто ветер над проливом. Держись.', en: "That's just the wind over the strait. Hang on." },
  'p.nadia.land': { who: 'nadia', ru: 'Посадка через двадцать минут. С этой минуты — тихо. Я рядом.', en: "Landing in twenty minutes. From now on — quiet. I'm right here." },
  'p.pilot.descent': { who: 'pilot', en: "Folks, we're starting our descent into Port Zarya. Welcome to the edge of the world." },

  // ---------------------------------------------------------------- the airstrip
  'a.nadia.ground': { who: 'nadia', ru: 'Ты на земле. Иди к терминалу.', en: "You're on the ground. Head for the terminal." },
  'a.wade.hello': { who: 'wade', en: "Well, look at that. A new face. Don't get many of those out here. Name's Wade. I fly the mail and anything else that needs flying." },
  'a.wade.ride': { who: 'wade', en: "Town's two miles that way. You want a ride? Truck's out front. Or you can walk, if you're not attached to your toes." },
  'a.wade.carpenter': { who: 'wade', en: "A carpenter, huh? Ha. Half the roofs in town need you. The other half are past saving." },
  'a.wade.northstar': { who: 'wade', en: "Grab a coffee at the diner, not that glowing thing on the square. Twelve bucks for a sandwich. Nobody asked for it." },
  'a.nadia.reveal': { who: 'nadia', ru: 'Вот он. Порт-Заря. Дома, церковь, старый магазин Кошкина… А вот это — «Нордстар». Видишь? Слишком новый для этого города. Слишком яркий. Там — их глаза.', en: "There it is. Port Zarya. The houses, the church, Koshkin's old store… And that — Northstar. See it? Too new for this town. Too bright. That's where their eyes are." },
};
