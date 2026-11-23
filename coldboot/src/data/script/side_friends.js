// Side content — friendships. Every named character gets a conversation hub
// that sits under the story (days 2–5 wrap it; day01 is under it): a greeting
// that warms with friendship (Stranger → Family), what they think of
// something you fixed (side_town REACTIONS), topics, paid work (side_jobs
// JOB_TOPICS), Pearl's job board (side_town TOWN_TOPICS), small talk that
// opens up with friendship, a gift, '(Something else…)' → the older
// conversation, and goodbye.
//
// What friendship is for:
//   • the council's continuity cards: once you know what they are (day 3),
//     Dolly and Hank hand theirs over when they're friends (Friendly, or
//     you fixed the diner sign / Hank's fence); Ray and Ruth once you run for
//     Ray's seat. Flag share.<id> (and state.shares[id]).
//   • Wade's three flying lessons (flight1 / flight2 / flight3) make the
//     finale's flight easier.
//   • Tommy's race on Loon Lake, and everybody's small talk, for the town.
import { CAST } from '../cast.js';
import { SIDE, reactTo, TOWN_TOPICS } from './side_town.js';
import { JOB_TOPICS } from './side_jobs.js';
import { hasShare, takeShare } from './kit.js';

// ------------------------------------------------------------------ lines
export const LINES = {
  // ================================================================ Wade
  'sf.wade.g0': { who: 'wade', en: "Well, the carpenter. Still in one piece? Town hasn't eaten you yet." },
  'sf.wade.g1': { who: 'wade', en: "Hey, there's my favourite passenger. Pull up a crate. The coffee's terrible, but it's hot.", emo: 'smile' },
  'sf.wade.g2': { who: 'wade', en: "Hey, partner. Sky's clear over the strait today. Days like this, I remember why I stayed.", emo: 'smile' },
  'sf.wade.t0': { who: 'wade', en: 'Mostly cold and loud. Then once a month the aurora comes down to meet you, and you forget every bad landing you ever made.' },
  'sf.wade.t1': { who: 'wade', en: "They pay cash to fly their crates up the hill. No questions. I didn't ask any. That's the part that keeps me up at night.", emo: 'serious' },
  'sf.wade.t2': { who: 'wade', en: "Flew medevac in the Gulf. Came home, couldn't sit still. Margie said, pick somewhere quiet. I picked the quietest place on the map." },
  'sf.wade.t3': { who: 'wade', en: 'My wife. Gone six years now. She named the chopper Dragonfly. Said it was too pretty a name for a machine that ugly. She was right about most things.' },
  'sf.wade.t4': { who: 'wade', en: "Every winter. Then somebody's kid needs a flight to Nome at two in the morning, and I'm the only one with a heater that works. So, no." },
  'sf.wade.gift1': { who: 'wade', en: "Real coffee beans? Not the hangar sludge? You might be the best thing that's landed on this strip in years.", emo: 'laugh' },
  'sf.wade.gift2': { who: 'wade', en: "Well, thank you. That's kind. I'll take it up with me on the Nome run." },
  'sf.wade.gift3': { who: 'wade', en: "Tea? Huh. Margie drank tea. I never got the hang of it. I'll find it a good home." },
  'sf.wade.offer': { who: 'wade', en: "You ever want to learn to fly her? Sixty bucks a lesson covers the fuel. Can't promise you'll be good. Can promise you'll be scared.", emo: 'smile' },
  'sf.wade.again': { who: 'wade', en: "Back for more? Good. Sixty for the fuel and we go up. She's warmed up, and so am I." },
  'sf.wade.broke': { who: 'wade', en: "Sixty for fuel, friend. Dragonfly doesn't run on good intentions." },
  'sf.wade.l1a': { who: 'wade', en: "Right hand's the cyclic, left hand's the collective, feet on the pedals. Everything talks to everything. Small moves. Smaller than that." },
  'sf.wade.l1b': { who: 'wade', en: 'Look at that! You held a hover. Most folks spin like a top their first time.', emo: 'laugh' },
  'sf.wade.l1c': { who: 'wade', en: "Well, we're alive and the hangar's still standing. Up here, that counts as a pass." },
  'sf.wade.l2a': { who: 'wade', en: "Today we go somewhere. Nose down a touch, she picks up speed and starts to fly instead of hang. Follow the shoreline. Don't wave at the walrus." },
  'sf.wade.l2b': { who: 'wade', en: "Smooth turns. You've got the feet for it. Most people fly with their hands and forget their feet.", emo: 'smile' },
  'sf.wade.l3a': { who: 'wade', en: "Last lesson. The engine quits. Someday it will. Drop the collective, keep the rotor turning, flare at the bottom. That's autorotation. Falling, with a plan.", emo: 'serious' },
  'sf.wade.l3b': { who: 'wade', en: "That's it. You can fly her. Badly, but you can. If you ever have to do it for real, stay low over the water and watch the horizon, not the gauges.", emo: 'serious' },
  'sf.g.wade1': { who: 'grisha', ru: 'Вертолёт?! Так, слушай меня. Шаг — плавно. Педали не дёргай. И дыши.', en: "A helicopter?! Right, listen to me. Collective — smoothly. Don't stamp on the pedals. And breathe." },
  'sf.g.wade2': { who: 'grisha', ru: 'Неплохо! Почти как у меня в первый раз. Я тогда, правда, забор снёс.', en: 'Not bad! Almost like my first time. Though I did take out a fence.', emo: 'laugh' },
  'sf.g.wade3': { who: 'grisha', ru: 'Вот теперь я спокоен. Ну, почти. Если придётся — справишься.', en: "Now I'm calm. Well, almost. If it comes to it — you'll manage.", emo: 'smile' },
  'sf.n.wade': { who: 'nadia', ru: 'Уроки пилотирования? Дмитрий сказал: «Пусть учится». У него это высшая похвала.', en: "Flying lessons? Dmitri said, 'Let them learn.' From him, that's the highest praise.", emo: 'smile' },

  // ================================================================ Koshkin
  'sf.koshkin.g0': { who: 'koshkin', en: "Ah, the carpenter. You're letting the cold in. Come, come, close the door." },
  'sf.koshkin.g1': { who: 'koshkin', en: "Golubchik! Come in. Kettle's on. Kettle is always on. It's Alaska.", emo: 'smile' },
  'sf.koshkin.g2': { who: 'koshkin', en: 'There you are. I was starting to worry. At my age, worry is a hobby.', emo: 'smile' },
  'sf.koshkin.t0': { who: 'koshkin', en: 'Business is like my knees. Bad, but still working. Every day somebody comes back from Northstar. Slowly. Like a cat pretending it never left.' },
  'sf.koshkin.t1': { who: 'koshkin', en: 'This? This is nothing. Nineteen eighty-nine, minus fifty-two. Spit froze before it hit the ground. Good times.', emo: 'laugh' },
  'sf.koshkin.t2': { who: 'koshkin', en: 'Grigory Koshkin. Came from Sitka in nineteen eleven with a barrel of flour and a rifle. Sold the flour. Kept the rifle. Smart man.' },
  'sf.koshkin.t3': { who: 'koshkin', en: "My brother? Stubborn. Played the accordion very bad, very loud. Built that cabin with his hands. Now you sleep in it. He would like that. He'd charge you more, but he'd like it." },
  'sf.koshkin.t4': { who: 'koshkin', en: "Retire? And do what, sit? Sitting is how they get you. I retire when the store closes, and the store closes when I do. Nu, that's the plan." },
  'sf.koshkin.gift1': { who: 'koshkin', en: 'Russian tea! The real one. You bought it from me, so I made a profit, and now I drink it too. Best customer in Alaska.', emo: 'laugh' },
  'sf.koshkin.gift2': { who: 'koshkin', en: "For me? Spasibo, golubchik. Old men don't get presents. We get advice." },
  'sf.koshkin.gift3': { who: 'koshkin', en: 'Whiskey? My heart says no. My doctor says no. Even my grandfather, who said yes to everything, says no.' },

  // ================================================================ Dolly
  'sf.dolly.g0': { who: 'dolly', en: "Well, look who it is. Sit anywhere, honey. Coffee's on." },
  'sf.dolly.g1': { who: 'dolly', en: "There's my favourite carpenter! Sit, sit. I saved you the booth by the good heater.", emo: 'smile' },
  'sf.dolly.g2': { who: 'dolly', en: "Get over here, you. I was just telling Pearl you'd come in today. I'm never wrong about these things.", emo: 'laugh' },
  'sf.dolly.t0': { who: 'dolly', en: "Oh, honey, where to start. The Petrov sisters aren't speaking. The mayor's got a new truck. And somebody's been fixing things. Folks are calling you the miracle worker." },
  'sf.dolly.t1': { who: 'dolly', en: "They came in June with a check and a smile. Nobody gives you a check and a smile, honey. One of them's always fake." },
  'sf.dolly.t2': { who: 'dolly', en: 'Thirty-one years. Earl and I bought it with his crab money. He cooked, I talked. Turned out the talking was the harder job.' },
  'sf.dolly.t3': { who: 'dolly', en: "Big man. Bad jokes. Best fish chowder on the Bering Sea. He's been gone four years, and I still set out two mugs every morning." },
  'sf.dolly.t4': { who: 'dolly', en: "Because when somebody's husband dies, or their boat goes down, they come here. They sit in that booth. Somebody's got to keep the coffee hot." },
  'sf.dolly.gift1': { who: 'dolly', en: "Flowers? In November? Honey, nobody's brought me flowers since Earl. Go on, get out of here before I cry in the gravy.", emo: 'smile' },
  'sf.dolly.gift2': { who: 'dolly', en: "Aren't you sweet. I'm putting this right by the register, so everybody asks me where I got it." },
  'sf.dolly.gift3': { who: 'dolly', en: "You bought my pie, from me, to give back to me? I'm charging you for the plate. I'm kidding. Mostly.", emo: 'laugh' },
  'sf.dolly.q1': { who: 'dolly', en: "Honey, sit. Here's what's eating me. Northstar bought my loan off the bank in Anchorage. They own my debt now. And every week they offer to buy me out. A little nicer each time.", emo: 'worry' },
  'd5.d.help': { who: 'dolly', en: "Bless you. Come when it's quiet. I'll feed you till you can't move.", emo: 'smile' },
  'd5.d.never': { who: 'dolly', en: "Earl proposed to me in booth three. I'd sooner sell my own teeth. But teeth don't pay the bank." },
  'sf.dolly.card': { who: 'dolly', en: "That card Gideon had us sign? Continuity, he called it. I don't know what you are, honey, and I don't need to. Earl always said, trust the ones who fix things. Here.", emo: 'serious' },
  'd13.d.card': { who: 'dolly', en: "This old thing? It's been holding my recipe box shut. Take it, honey. If it matters to Northstar, it matters more to you." },

  // ================================================================ Hank
  'sf.hank.g0': { who: 'hank', en: "Yeah? You buying, or just warming up? Either's fine. Buying's better." },
  'sf.hank.g1': { who: 'hank', en: "Carpenter. Nails are on special. That means they're the same price, but I'm telling you about it." },
  'sf.hank.g2': { who: 'hank', en: "Hey. Good. Grab a coffee from the pot. It's yesterday's. It's fine." },
  'sf.hank.t0': { who: 'hank', en: "Nails, rope, fuel oil and complaints. I sell the first three. The fourth one's free." },
  'sf.hank.t1': { who: 'hank', en: "They undercut my heating oil by forty cents a gallon. Forty cents. You know what that is? That's a company planning to be the only one left.", emo: 'angry' },
  'sf.hank.t2': { who: 'hank', en: 'My dad opened it in seventy-four. Pipeline money. He used to say a town needs three things. A church, a bar, and somebody who sells nails.' },
  'sf.hank.t3': { who: 'hank', en: "Had a wife. She's in Kenai with a dentist. Had a son. Still have a son. He's in Anchorage. We don't talk. That's the whole story.", emo: 'frown' },
  'sf.hank.t4': { who: 'hank', en: "Nobody else would run. And somebody has to tell the mayor no once in a while. Turns out I'm real good at no." },
  'sf.hank.gift1': { who: 'hank', en: "Coffee beans. Real ones. Huh. Okay. Okay, you're all right. Don't tell anybody I said that." },
  'sf.hank.gift2': { who: 'hank', en: "Didn't have to do that. Thanks. I'll put it somewhere I won't sell it by accident." },
  'sf.hank.gift3': { who: 'hank', en: "Flowers. What am I supposed to do with flowers? Sell them? Fine. They're going by the register." },
  'd13.h.card': { who: 'hank', en: "That card? Gideon said it was for emergencies. You look like an emergency. Twenty bucks. I'm kidding. Take it." },

  // ================================================================ Ruth
  'sf.ruth.g0': { who: 'ruth', en: "Hello. You're the carpenter. I taught half this town to read. The other half, I taught to behave." },
  'sf.ruth.g1': { who: 'ruth', en: 'Ah, my best student who never sat in my classroom. Sit down.', emo: 'smile' },
  'sf.ruth.g2': { who: 'ruth', en: "There you are. Come, sit with an old woman. I'll pretend I didn't know you were coming.", emo: 'smile' },
  'sf.ruth.t0': { who: 'ruth', en: "I was born in a sod house on the point, nineteen fifty-five. I've watched this town nearly die four times. It's stubborn. Like its teachers." },
  'sf.ruth.t1': { who: 'ruth', en: 'Men in good coats have come to save us since the Russians. Then the Americans, the oil men, now the computer men. We are still here. They are not.', emo: 'serious' },
  'sf.ruth.t2': { who: 'ruth', en: 'Every family had a boat and a dog team. The church choir had forty voices. Nobody locked a door. You could hear the school bell from the lighthouse.' },
  'sf.ruth.t3': { who: 'ruth', en: "My grandson. His mother went to Anchorage and his father went to the bottle, so he got me. He's fast on a snowmachine and slow at writing letters." },
  'sf.ruth.t4': { who: 'ruth', en: "Every day, dear. Then I sit in that council chamber and look at Lyle Pruitt's hair, and I wake right up. Somebody has to say no out loud.", emo: 'smile' },
  'sf.ruth.gift1': { who: 'ruth', en: "Black tea. Russian tea. My grandmother drank this. Thank you, dear. Sit, I'll make a pot and tell you something you didn't know.", emo: 'smile' },
  'sf.ruth.gift2': { who: 'ruth', en: 'How thoughtful. Thank you. You were raised right, wherever it was.' },
  'sf.ruth.gift3': { who: 'ruth', en: 'No, dear. I buried a brother who loved that more than he loved us. Take it home. Better yet, pour it out.', emo: 'serious' },
  'sf.ruth.card': { who: 'ruth', en: "I taught this town to read. I can read you, too. I don't know your real name. I know what you've done for us. Here. Keep it safer than we did.", emo: 'serious' },
  // the town's history, as Ruth tells it
  'd7.r.h2': { who: 'ruth', en: 'Eighteen twenty-two. The Russian-American Company built a trading post on this beach. Furs, mostly sea otter. They called it Zarya. The dawn.' },
  'd7.r.h3': { who: 'ruth', en: "My people were here long before that. We traded with them, married them, buried them. That's why half this town has a Russian grandfather and an Inupiaq grandmother." },
  'd7.r.h4': { who: 'ruth', en: 'Eighteen sixty-seven. In Sitka, a man lowered one flag and raised another. Nobody asked us. The Russians sailed home. The priests stayed, and so did the church.' },
  'd7.r.h5': { who: 'ruth', en: "Then the gold rush. The cannery. The oil men. The Air Force put a radar on Kettle Hill to watch the Russians. Now Northstar sits in it. Every one of them thought they'd bought us." },
  'd7.r.h6': { who: 'ruth', en: 'Nobody buys a town. You can buy the land and the lights. The people, you have to earn. Northstar never learned that. You seem to know it already.', emo: 'smile' },
  'd7.r.h7': { who: 'ruth', en: "Because somebody has to remember out loud. Most days that's all I do. Remember out loud, and vote no." },
  'd7.r.h8': { who: 'ruth', en: "Come by the school sometime. I'll show you the church books from eighteen thirty-one. Your name isn't in them. Maybe someday it should be.", emo: 'smile' },

  // ================================================================ Ray
  'sf.ray.g0': { who: 'ray', en: "Yeah? What. Oh, the carpenter. Pull up a stool, or don't." },
  'sf.ray.g1': { who: 'ray', en: "Hey. You again. Sit down, you're making the bar nervous." },
  'sf.ray.g2': { who: 'ray', en: "Hey, friend. Good to see a face that isn't fish or management.", emo: 'smile' },
  'sf.ray.t0': { who: 'ray', en: "Fish come in, fish go out, and the company in Seattle says it's losing money. They've been losing money on a boat with a hot tub since nineteen ninety-eight." },
  'sf.ray.t1': { who: 'ray', en: "They want the cannery waterfront. Not for fish. For something with cables. Nobody will say what. That's how you know it's bad.", emo: 'frown' },
  'sf.ray.t2': { who: 'ray', en: 'Thirty years. Started at seventeen, gutting pinks for six bucks an hour. Foreman now. Means I get to fire my friends.' },
  'sf.ray.t3': { who: 'ray', en: "Kayla. Fifteen. Lives with her mom in Fairbanks. Smarter than me. Plays the violin. I've never once heard her play in person. Isn't that something." },
  'sf.ray.t4': { who: 'ray', en: "Because it's quiet in the glass. Out here everybody wants something. Rent, names, answers. The glass doesn't want anything. Until morning.", emo: 'frown' },
  'sf.ray.gift1': { who: 'ray', en: "Coffee. Strong, too. You know what, I'll drink this instead of the other thing tonight. Maybe. Thanks." },
  'sf.ray.gift2': { who: 'ray', en: 'Huh. Thanks. Nobody gives a foreman anything but grief.' },
  'sf.ray.gift3': { who: 'ray', en: "No. Not that. I'm trying. Take it back, would you? Thanks for thinking of me, though.", emo: 'frown' },
  'd5.ra.t1': { who: 'ray', en: "Trouble? Northstar's buying into the cannery. Officially it's a partnership. And the company in Seattle wants names. People I've known since they were kids.", emo: 'frown' },
  'd5.ra.t2': { who: 'ray', en: "And they want me smiling on that council, voting for cameras. I'm about done, I'll tell you that." },
  'd5.ra.stay': { who: 'ray', en: 'The town needs a lot of things. Mostly a new cannery manager and a decent darts partner.' },
  'd5.ra.what': { who: 'ray', en: "Some sign that somebody up here still gives a damn. You find me that, and I'll stay." },
  'd5.n.ray': { who: 'nadia', ru: 'Моуди может уйти из совета. Тогда освободится место. Запомни это.', en: 'Moody might leave the council. Then a seat opens up. Remember that.', emo: 'serious' },
  'sf.ray.card': { who: 'ray', en: 'That card Northstar had us sign? Northstar wants it, so I want them not to have it. Simple. Take it, before I trade it for a beer. Kidding. Mostly.', emo: 'smile' },

  // ================================================================ Lyle
  'sf.lyle.g0': { who: 'lyle', en: "Lyle Pruitt, Pruitt Realty and Insurance. If you're thinking of buying, the market's never been better. If you're thinking of selling, also never better.", emo: 'smile' },
  'sf.lyle.g1': { who: 'lyle', en: "Ah, the handyman! Love what you've done around town. Very electable. For you, I mean. Not that you're running. You're not running, are you?", emo: 'smile' },
  'sf.lyle.g2': { who: 'lyle', en: "Hey. Hey, you. Sit down. You're the only person in this town who doesn't want something from me. I think." },
  'sf.lyle.t0': { who: 'lyle', en: "Booming. Northstar's investment has lifted property values eleven percent. That's real growth. Don't let Ruth Aqpik tell you different. She will.", emo: 'smile' },
  'sf.lyle.t1': { who: 'lyle', en: 'Visionaries. Partners. The future. I say that a lot. Sometimes I believe it all the way to the end of the sentence.' },
  'sf.lyle.t2': { who: 'lyle', en: "Because nobody in this town ever thought I'd be anything. My dad sold bait. I sell futures. Someday they'll hang my picture in City Hall. Next to the good ones." },
  'sf.lyle.t3': { who: 'lyle', en: "Me? I'm great. I'm fantastic. I sleep four hours a night and check my locks twice. That's just ambition. Right?", emo: 'worry' },
  'sf.lyle.t4': { who: 'lyle', en: "Being found out. Doesn't matter for what. Everybody has a what. Mine just came with paperwork.", emo: 'worry' },
  'sf.lyle.gift1': { who: 'lyle', en: 'Whiskey? You have taste. Real taste. I knew there was a reason I liked you. Besides your vote. Your potential vote.', emo: 'smile' },
  'sf.lyle.gift2': { who: 'lyle', en: "For me? Well. Thank you. I'll be sure to mention you in my campaign. Positively." },
  'sf.lyle.gift3': { who: 'lyle', en: "It's a fish. Wrapped in paper. On my desk. I sell insurance. I can't smell like a harbour.", emo: 'frown' },
  'd5.ly.t1': { who: 'lyle', en: "Can I be honest? Don't tell anyone. Northstar's going to give away home insurance with the smart meters. Free. I sell home insurance. Do the math.", emo: 'worry' },
  'd5.ly.t2': { who: 'lyle', en: "They pay me to support them, and they're putting me out of business. Everybody thinks I'm their guy. I'm their mark." },
  'd5.ly.stop': { who: 'lyle', en: "Stop? Ha. You don't stop. You smile and you wait to be mayor, and then maybe you get to say no to somebody." },
  'd5.ly.why': { who: 'lyle', en: "Because you're new. You don't count yet. No offence. It's nice to say it out loud to somebody who doesn't count." },
  'd5.n.lyle': { who: 'nadia', ru: 'Пруитт — их человек, который их же и боится. Интересно.', en: "Pruitt is their man, and he's afraid of them. Interesting." },

  // ================================================================ Father Gabriel
  'sf.gabriel.g0': { who: 'gabriel', en: 'Welcome, friend. Come in out of the wind. God and the radiator are both working today.', emo: 'smile' },
  'sf.gabriel.g1': { who: 'gabriel', en: "Ah, my bell-ringer! Come in. I've set up the board, if you have the time and the humility.", emo: 'smile' },
  'sf.gabriel.g2': { who: 'gabriel', en: "There you are. I lit a candle for you this morning. Don't ask me what for. I'm not entirely sure myself." },
  'sf.gabriel.t0': { who: 'gabriel', en: "Eighteen thirty-one. Built by Aleut carpenters and a Russian priest who couldn't swing a hammer. The domes went up in eighteen forty. The heating, sadly, in nineteen seventy." },
  'sf.gabriel.t1': { who: 'gabriel', en: "They offered to put a camera on the bell tower. For safety. I told them God is already watching, and He doesn't need the internet.", emo: 'smile' },
  'sf.gabriel.t2': { who: 'gabriel', en: "I was a radio man in the Navy before I was a priest. Fixed transmitters on Adak. One Easter I heard this town's bell across the water, and that was that." },
  'sf.gabriel.t3': { who: 'gabriel', en: "Every Tuesday. Doubt is just faith checking its pockets. You'd be surprised how often I find my keys.", emo: 'smile' },
  'sf.gabriel.t4': { who: 'gabriel', en: "For the town. For the people who come in at night, sit in the back and say nothing. And lately, for whatever it is you're carrying.", emo: 'serious' },
  'sf.gabriel.gift1': { who: 'gabriel', en: "A candle. People think a candle is a small thing. A candle is a prayer that keeps going after you've left the room. Thank you.", emo: 'smile' },
  'sf.gabriel.gift2': { who: 'gabriel', en: "How kind. I'll share it with the choir. All four of them. Well, three. Mrs. Ivanoff only comes for the singing." },

  // ================================================================ Nina
  'sf.nina.g0': { who: 'nina', en: "Oh, hey. You're the carpenter. My mom has a file on you. Kidding. Probably." },
  'sf.nina.g1': { who: 'nina', en: "Hey! Come in, come in, mind the cables. We're on the air in, like, a while. Ish.", emo: 'smile' },
  'sf.nina.g2': { who: 'nina', en: "You! Sit. I made you a playlist. It's called Songs for People Who Fix Things. It's mostly sad country.", emo: 'laugh' },
  'sf.nina.t0': { who: 'nina', en: "Eighty-eight point nine, reaching the entire town and two confused walruses. The transmitter's from nineteen seventy-nine. So am I, spiritually." },
  'sf.nina.t1': { who: 'nina', en: "They offered to buy the station. They said community radio like it was a disease. I said no. I'm not even allowed to sign things. Ha." },
  'sf.nina.t2': { who: 'nina', en: "Everybody's nice to me and nobody tells me anything. It's like being a ghost with a curfew." },
  'sf.nina.t3': { who: 'nina', en: 'I want to go to Seattle and make radio a million people hear. And I want to stay here and make radio my mom hears. Pick one, apparently.' },
  'sf.nina.t4': { who: 'nina', en: "She cries at dog food commercials. She'd arrest me for telling you that. She's scared all the time, and she's never once said so." },
  'sf.nina.gift1': { who: 'nina', en: 'Chocolate! Oh my God. You have no idea. The vending machine here has been empty since August.', emo: 'laugh' },
  'sf.nina.gift2': { who: 'nina', en: 'For the station? We accept all donations. Except polka records. We have enough polka records.' },
  'sf.nina.gift3': { who: 'nina', en: "Flowers? Is this a date? Because my mom has a gun. A big one. I'll put them in a cup. A friendly cup.", emo: 'surprise' },

  // ================================================================ Tommy
  'sf.tommy.g0': { who: 'tommy', en: "Hey! You're the new carpenter. I'm Tommy. I fix engines, you fix houses. Between us we could fix the whole town.", emo: 'smile' },
  'sf.tommy.g1': { who: 'tommy', en: "Hey, it's you! Want to see what I did to the carburettor? It's illegal in three states.", emo: 'laugh' },
  'sf.tommy.g2': { who: 'tommy', en: "There's my racing partner! Grab a wrench. Kidding. Unless you want to.", emo: 'smile' },
  'sf.tommy.t0': { who: 'tommy', en: "Small engines, outboards, snowmachines, and Hank's truck four times a week. Hank calls me the kid. I'm twenty-four. I'll be the kid till I'm fifty." },
  'sf.tommy.t1': { who: 'tommy', en: 'Their security guys ride brand-new sleds. Factory fresh. And they ride them like grocery carts. It physically hurts me to watch.' },
  'sf.tommy.t2': { who: 'tommy', en: "Loon Lake, three miles of ice, no rules except don't die. Best feeling in the world. Better than food. Don't tell Grandma I said that either.", emo: 'laugh' },
  'sf.tommy.t3': { who: 'tommy', en: "Mom's in Anchorage, she calls on birthdays. Dad's around. Sort of. Grandma raised me. She says I've got Grandpa's hands and Dad's sense. That's not a compliment." },
  'sf.tommy.t4': { who: 'tommy', en: "Honestly? My own shop. Aqpik Engines, right here on Front Street. A sign with lights, like Dolly's. Fixing stuff for people I know.", emo: 'smile' },
  'sf.tommy.gift1': { who: 'tommy', en: "Pie! Grandma never lets me have pie in training. I'm not in training. I'm never in training. Thank you!", emo: 'laugh' },
  'sf.tommy.gift2': { who: 'tommy', en: "For me? Sweet. I'll eat it out on the ice. Everything tastes better on the ice." },
  'sf.tommy.gift3': { who: 'tommy', en: "Tea? That's Grandma's thing. If I drink tea, I'll start telling people to sit up straight." },
  'sf.tommy.q1': { who: 'tommy', en: "You ever race a snowmachine? Loon Lake, up the Lake Trail. I'll lend you the yellow one. It's slow, but it's honest.", emo: 'smile' },
  'sf.tommy.race1': { who: 'tommy', en: "Three laps, flags on the ice. Stay off the dark patches, that's open water under there. Ready? Go!" },
  'sf.tommy.win': { who: 'tommy', en: 'You beat me? On the yellow one? Okay. Okay. I demand a rematch.', emo: 'surprise' },
  'sf.tommy.lose': { who: 'tommy', en: 'Not bad for a carpenter! You hit every bump on the lake, but you hit them with style.', emo: 'laugh' },
  'sf.g.race': { who: 'grisha', ru: 'Снегоход! Газу, газу! Что ты как на похоронах?', en: 'A snowmobile! Throttle, throttle! What is this, a funeral?', emo: 'laugh' },

  // ================================================================ Lou
  'sf.lou.g0': { who: 'lou', en: "Welcome to the Anchor. Beer's cold, stove's hot, and the darts are mine. What'll it be?" },
  'sf.lou.g1': { who: 'lou', en: "Hey, carpenter. The usual? You don't have a usual yet. I'll give you one.", emo: 'smile' },
  'sf.lou.g2': { who: 'lou', en: "There's my favourite regular who isn't a regular. Sit. First one's on me. Second one's on you.", emo: 'smile' },
  'sf.lou.t0': { who: 'lou', en: "Every night's busy in November. Nothing to do but drink, play darts and tell lies about fish. I allow all three." },
  'sf.lou.t1': { who: 'lou', en: "Their guys come in, order club soda, sit facing the door, and tip exactly fifteen percent. Nobody tips exactly fifteen percent. That's a machine." },
  'sf.lou.t2': { who: 'lou', en: 'My dad ran it for thirty years. I was in Anchorage, doing the books for an oil company. He got sick. I came home for a month. That was nineteen years ago.' },
  'sf.lou.t3': { who: 'lou', en: "Dad. Every night after closing, a hundred throws. He said if your hands are busy, your heart can't get into trouble. Turns out that's half true." },
  'sf.lou.t4': { who: 'lou', en: "Nobody, and I like it that way. Okay. Dolly brings me soup when I'm sick. Hank fixes my furnace and pretends it's an accident. Don't tell them I noticed.", emo: 'smile' },
  'sf.lou.gift1': { who: 'lou', en: 'Smoked salmon? The good stuff? This is going behind the bar for the regulars. Well. Half of it is.', emo: 'smile' },
  'sf.lou.gift2': { who: 'lou', en: "Thanks, hon. You're sweet. Don't let it get around. It's bad for the bar's reputation." },
  'sf.lou.gift3': { who: 'lou', en: "Whiskey. You brought whiskey. To a bar. You know I sell this, right? I'll put it on the shelf and charge you for it.", emo: 'laugh' },

  // ================================================================ Doc Ellen
  'sf.ellen.g0': { who: 'ellen', en: "Hello. You're the carpenter. You look healthy. Keep it that way. I'm busy." },
  'sf.ellen.g1': { who: 'ellen', en: "Ah, my favourite patient who's never been sick. Come in. Tell me about the birds you've seen.", emo: 'smile' },
  'sf.ellen.g2': { who: 'ellen', en: "There you are. I've got coffee, a bad back and twenty minutes. You can have all three.", emo: 'smile' },
  'sf.ellen.t0': { who: 'ellen', en: 'One doctor, two nurses, eleven hundred patients. Frostbite, fishhooks and broken hearts. The hearts take the longest.' },
  'sf.ellen.t1': { who: 'ellen', en: "Their people at the Dome have their own doctor. A whole clinic, for a dozen people. Nobody needs that much medicine unless they're expecting something.", emo: 'serious' },
  'sf.ellen.t2': { who: 'ellen', en: 'Because they come back. Every spring, from Antarctica, from Mexico, they come back here. To this cold rock. I find that very reassuring.' },
  'sf.ellen.t3': { who: 'ellen', en: 'Boston, thirty years ago. A one-year contract. I came for the money and stayed for the ravens. And the people. Mostly the ravens.', emo: 'smile' },
  'sf.ellen.t4': { who: 'ellen', en: "That I'm sixty and there's nobody to hand this to. When I go, the nearest doctor is a plane ride away. That's not a clinic. That's a prayer.", emo: 'worry' },
  'sf.ellen.gift1': { who: 'ellen', en: "Film! For my old Nikon! Oh, I could kiss you. Medically speaking, I won't. But I could.", emo: 'laugh' },
  'sf.ellen.gift2': { who: 'ellen', en: "That's very kind. I'll prescribe it to myself at once." },
  'sf.ellen.gift3': { who: 'ellen', en: "Whiskey. I'm the town doctor. I've seen what that does to a liver. I've seen it in jars." },

  // ================================================================ Pearl
  'sf.pearl.g0': { who: 'pearl', en: 'Pearl Jessup, postmaster. Stamps, parcels and federal law. I know who you are. Everybody does.' },
  'sf.pearl.g1': { who: 'pearl', en: "Oh, it's you! Come in, come in. I've got news. I'm not supposed to have news. I have news.", emo: 'smile' },
  'sf.pearl.g2': { who: 'pearl', en: 'My favourite customer. You never mail anything, which makes you a mystery. I love a mystery.', emo: 'smile' },
  'sf.pearl.t0': { who: 'pearl', en: "The Petrov sisters are feuding over a pie dish from nineteen ninety-one. The mayor ordered a hot tub. Don't tell anyone I told you. I tell everyone." },
  'sf.pearl.t1': { who: 'pearl', en: "They don't send postcards. Not one. Everything goes up that hill in sealed crates on Wade's plane. Who doesn't send postcards?" },
  'sf.pearl.t2': { who: 'pearl', en: "Thirty-eight years. I've delivered every birth announcement, divorce paper and love letter in this town. I've read most of them. Federally, I haven't." },
  'sf.pearl.t3': { who: 'pearl', en: "Every week, to my sister in Biloxi. She never writes back. That's fine. Somebody has to send the news south." },
  'sf.pearl.t4': { who: 'pearl', en: "Because nobody looks at the post office lady. You'd be amazed what people say in front of a woman weighing a parcel.", emo: 'smile' },
  'sf.pearl.gift1': { who: 'pearl', en: "Chocolate! The good kind! Oh, you've done it now. I'll tell you something I shouldn't. Later. Maybe.", emo: 'laugh' },
  'sf.pearl.gift2': { who: 'pearl', en: "For me? Aren't you a dear. It's going right on the counter, where Lyle Pruitt can see it and be jealous." },
  'sf.pearl.gift3': { who: 'pearl', en: 'Fish? In a federal building? This post office is going to smell like a harbour till Easter.', emo: 'frown' },

  // ================================================================ Chief Marta
  'sf.marta.g0': { who: 'marta', en: 'Carpenter. Staying out of trouble?' },
  'sf.marta.g1': { who: 'marta', en: "Evening. You're still here. That's either good news or a long story." },
  'sf.marta.g2': { who: 'marta', en: "Hey. Sit down a minute. Off the record, I'm glad you're around.", emo: 'smile' },
  'sf.marta.t0': { who: 'marta', en: 'Two drunks, one loose dog and a moose in the school parking lot. The moose was the most reasonable of the four.' },
  'sf.marta.t1': { who: 'marta', en: "Their cameras don't report to me. Their security doesn't report to me. In my town. You can guess what I think.", emo: 'frown' },
  'sf.marta.t2': { who: 'marta', en: "My dad was a trooper in Bethel. He used to say the badge doesn't make you right. It makes you responsible. Different thing." },
  'sf.marta.t3': { who: 'marta', en: "She's smarter than me, and she broadcasts it to the whole town. Literally. Every night. I listen in the patrol car.", emo: 'smile' },
  'sf.marta.t4': { who: 'marta', en: "I trust that you fix things and you don't lie to old people. That's more than I can say for most of City Hall. The rest, I'm still working on.", emo: 'serious' },
  'sf.marta.gift1': { who: 'marta', en: "Coffee. Good coffee. Is this a bribe? It's a good bribe. Accepted. Don't tell anybody.", emo: 'smile' },
  'sf.marta.gift2': { who: 'marta', en: "That's kind. I'll put it in the break room, so it doesn't look like I'm taking gifts. Which I am." },
  'sf.marta.gift3': { who: 'marta', en: "I can't take that. I'm on duty. I'm always on duty." },

  // ================================================================ Evan
  'sf.evan.g0': { who: 'evan', en: "Good evening, and welcome back! It's always so nice to see you. Always.", emo: 'smile' },
  'sf.evan.g1': { who: 'evan', en: "Hey, buddy! Your usual? I know your usual. I know everybody's usual. It's my job! Ha.", emo: 'smile' },
  'sf.evan.g2': { who: 'evan', en: "Oh. It's you. Good. I mean, hi! Welcome to Northstar Twenty-Four." },
  'sf.evan.t0': { who: 'evan', en: 'Wonderful! Every day, more neighbours discover the Northstar difference. Lower prices. Brighter lights. And we remember your birthday. Not in a weird way.', emo: 'smile' },
  'sf.evan.t1': { who: 'evan', en: "Sleep? Ha. We're open twenty-four hours! Somebody has to be here. And it's me. It's always me. I don't mind. I don't mind.", emo: 'smile' },
  'sf.evan.t2': { who: 'evan', en: "Spokane. I won a regional sales award, and the prize was a promotion. Here. They said it was an honour. I still have the plaque. It's in the stockroom." },
  'sf.evan.t3': { who: 'evan', en: "I love it. Mr. Halloran says we're building the future. He says it in a very calm voice. He's always calm. Have you ever met someone who's always calm? It's a lot.", emo: 'worry' },
  'sf.evan.t4': { who: 'evan', en: "Can I tell you something? The cameras in here record to the Dome. All of them. Except the one in the stockroom. It's broken. I broke it. I like one room where nobody's watching.", emo: 'worry' },
  'sf.evan.gift': { who: 'evan', en: "For me? Oh wow. Nobody gives me things. People take things. From the shelves. And pay. Thank you. I'm going to log this. I mean, love this.", emo: 'smile' },
  'sf.l.evan': { who: 'lyosha', ru: 'Слепая зона в подсобке? Запомни. Пригодится.', en: "A blind spot in the stockroom? Remember that. It'll come in handy." },

  // ================================================================ Mayor Walt, Gideon Shaw, Halloran, Mr. Grey
  'sf.walt.g0': { who: 'walt', en: "Walt Hennessey, mayor. Don't hold it against me. Nobody else wanted the job." },
  'sf.walt.g1': { who: 'walt', en: "Well, if it isn't the fixer. Folks are talking you up. That's dangerous in a small town. Next thing you know, they make you mayor.", emo: 'smile' },
  'sf.walt.t0': { who: 'walt', en: "Ask me in spring. In winter, the answer's always the same. Cold, broke, and still here." },
  'sf.walt.t1': { who: 'walt', en: "Northstar's been good to Port Zarya. That's what I say. I say it a lot. Some days it even sounds true." },
  'sf.walt.t2': { who: 'walt', en: 'Because I owe people, friend. A mayor who owes people is just a man with a nice office and no door.', emo: 'frown' },
  'sf.walt.gift1': { who: 'walt', en: "Dolly's pie? You're a good person. I'm going to eat this whole thing in my office with the door closed.", emo: 'laugh' },
  'sf.walt.gift2': { who: 'walt', en: "Well, thank you. I'm not supposed to accept gifts. But I'm also not supposed to be rude." },
  'sf.gideon.g0': { who: 'gideon', en: 'Can I help you? I have three minutes.' },
  'sf.gideon.g1': { who: 'gideon', en: "You again. You're becoming a fixture. Fixtures can be removed." },
  'sf.gideon.t0': { who: 'gideon', en: 'I manage the city. Budgets, permits, contracts. The things people never think about, until someone else has decided them.' },
  'sf.gideon.t1': { who: 'gideon', en: 'Port Zarya is a fine town with a fine future. Its future simply arrived before it was ready.' },
  'sf.gideon.t2': { who: 'gideon', en: "I relax by making sure nothing surprises me. You, for instance, surprised me. I've relaxed less this month." },
  'sf.gideon.gift': { who: 'gideon', en: "I don't accept gifts. Ethics policy. Northstar's, not the city's. Theirs is stricter." },
  'sf.halloran.g0': { who: 'halloran', en: "We haven't been introduced. I know who you are, of course. I make a point of knowing who fixes things." },
  'sf.halloran.t0': { who: 'halloran', en: "Nothing it doesn't already want for itself. Quiet. Warmth. A future. I simply intend to deliver it on schedule." },
  'sf.halloran.t1': { who: 'halloran', en: "I like the cold. It's honest. It tells you exactly how long you'll last." },
  'sf.halloran.gift': { who: 'halloran', en: "Keep it. You'll need everything you have." },
  'sf.okafor.g0': { who: 'okafor', en: 'Afternoon. Cold one.' },
  'sf.okafor.g1': { who: 'okafor', en: 'Agent Okafor. You can still call me Mr. Grey. Everybody else does, behind my back.' },
  'sf.okafor.t0': { who: 'okafor', en: "You don't. That's fine. Most people don't." },
  'sf.okafor.t1': { who: 'okafor', en: 'Small town. I take walks. We keep walking into each other. You could try being less interesting.' },
  'sf.okafor.t2': { who: 'okafor', en: "Slow, careful, and none of your business. Which means it's going fine. Stay out of my way, and I'll stay out of yours. Mostly." },
  'sf.okafor.t3': { who: 'okafor', en: 'My wife bought it. Said it made me look approachable. Fourteen years in the Bureau, and nobody has ever approached me.' },
  'sf.okafor.gift': { who: 'okafor', en: "I can't take that. Rules. Is that coffee? Rules, I said." },

  // ================================================================ the cards
  'sf.n.card1': { who: 'nadia', ru: 'Первая карта. Хорошо. Нужно ещё две — и ключ мэра.', en: "The first card. Good. Two more — and the mayor's key.", emo: 'serious' },
  'sf.n.card2': { who: 'nadia', ru: 'Вторая. Осталась одна. Не торопись, но и не медли.', en: "The second. One to go. Don't rush — but don't dawdle." },
  'sf.d.card3': { who: 'dmitri', ru: 'Три карты. Этого хватит, чтобы открыть хранилище. Молодец, Рыбка.', en: 'Three cards. Enough to open the vault. Well done, Rybka.', emo: 'smile' },
  'sf.v.card4': { who: 'valya', ru: 'Четвёртая? Запас карман не тянет. Так моя мама говорила.', en: 'A fourth? A spare never weighs down a pocket. My mother used to say that.', emo: 'smile' },
  'sf.l.card5': { who: 'lyosha', ru: 'Все пять! Полный комплект! Хэллоран бы заплакал.', en: 'All five! The full set! Halloran would cry.', emo: 'laugh' },
};

// ------------------------------------------------------------------ shared bits
const GIFTS = { coffee: 'Coffee beans', tea: 'Russian black tea', pie: 'Blueberry pie', flowers: 'Dried flowers', whiskey: 'Whiskey', fish: 'Smoked salmon', chocolate: 'A chocolate bar', candle: 'A church candle', film: 'Camera film' };
const num = (v) => Number(v) || 0;                       // flags may hold a day number (or just true)
/** Does the player know what the continuity cards are? (the day 3 story; a late safety net so nothing dead-ends) */
export const knowsShares = (s) => !!(s.flags || {}).knowsShares || (s.day || 1) >= 5;
const beside = (G, dx = 1.8, dz = 1.2) => ({ x: (G.player?.pos?.x || 0) + dx, z: (G.player?.pos?.z || 0) + dz });
const ear = (c, line) => c.G.missions?.ear?.(line);
const fixed = (c, id) => !!(c.state.repairs || {})[id];

/** Who parts with their card, and when. */
const CARD = {
  dolly: { ready: (c) => c.level >= 2 || fixed(c, 'r.dolly.sign'), line: 'sf.dolly.card', label: 'Dolly… that card Northstar had the council sign.' },
  hank: { ready: (c) => c.level >= 2 || fixed(c, 'r.hank.fence'), line: 'd13.h.card', label: 'Hank… that continuity card Gideon had you sign.' },
  ray: { ready: (c) => c.has('running') || c.level >= 2, line: 'sf.ray.card', label: 'Ray, about that card Northstar had you sign.' },
  ruth: { ready: (c) => c.has('running') || c.level >= 2, line: 'sf.ruth.card', label: 'Ruth… the continuity card. Northstar wants it.' },
};

/** Topics: QT[npc] = [(c) => false | { label, run(c) }]. */
const QT = {};
const topic = (npc, fn) => { (QT[npc] ||= []).push(fn); };
const QUEST_GO = { 'sf.tommy': 'sf.tommy.go' };   // (Wade's lessons are started when booked)

// ================================================================== the council's cards
for (const [id, k] of Object.entries(CARD)) {
  topic(id, (c) => knowsShares(c.state) && !hasShare(c.state, id) && k.ready(c) && !c.flag('d5.cardHunt') && {
    label: k.label,
    run: async (c) => { await c.say(id, k.line); takeShare(c.G, id); c.standing(2); c.rel(4); },
  });
}

// ================================================================== troubles (what keeps them up at night)
topic('dolly', (c) => c.day >= 2 && !c.has('t.dolly') && {
  label: 'You look worried, Dolly.',
  run: async (c) => {
    await c.say('dolly', 'sf.dolly.q1');
    const k = await c.choose(["Then let's give people a reason to come back. Starting with that sign of yours.", "You'd never sell, would you?"]);
    await c.say('dolly', k === 0 ? 'd5.d.help' : 'd5.d.never');
    c.flag('t.dolly', c.day);
    c.rel(k === 0 ? 8 : 6);
  },
});
topic('ray', (c) => c.day >= 2 && c.day <= 3 && !c.has('t.ray') && {
  label: 'Rough day, Ray?',
  run: async (c) => {
    await c.say('ray', 'd5.ra.t1');
    await c.say('ray', 'd5.ra.t2');
    const k = await c.choose(["Don't quit. The town needs you.", 'What would make you stay?']);
    await c.say('ray', k === 0 ? 'd5.ra.stay' : 'd5.ra.what');
    c.flag('t.ray', c.day);
    c.rel(8);
    ear(c, 'd5.n.ray');
  },
});
topic('lyle', (c) => c.day >= 2 && !c.has('t.lyle') && {
  label: "You look like you haven't slept, Lyle.",
  run: async (c) => {
    await c.say('lyle', 'd5.ly.t1');
    await c.say('lyle', 'd5.ly.t2');
    const k = await c.choose(['Then stop supporting them.', 'Why are you telling me this?']);
    await c.say('lyle', k === 0 ? 'd5.ly.stop' : 'd5.ly.why');
    c.flag('t.lyle', c.day);
    c.rel(6);
    ear(c, 'd5.n.lyle');
  },
});
topic('ruth', (c) => c.day >= 2 && !c.has('t.ruth') && {
  label: 'Tell me about this town, Ruth.',
  run: async (c) => {
    await c.say('ruth', 'd7.r.h2');
    await c.say('ruth', 'd7.r.h3');
    await c.say('ruth', 'd7.r.h4');
    await c.say('ruth', 'd7.r.h5');
    const k = await c.choose(['And did they?', 'Why do you stay on the council?']);
    await c.say('ruth', k === 0 ? 'd7.r.h6' : 'd7.r.h7');
    await c.say('ruth', 'd7.r.h8');
    c.flag('t.ruth', c.day);
    c.rel(8);
  },
});

// ================================================================== Tommy: Loon Lake
topic('tommy', (c) => c.day >= 2 && c.day <= 4 && !c.has('sf.tommy.go') && c.hour >= 8 && c.hour < 18 && {
  label: 'Ever race on Loon Lake?',
  run: async (c) => {
    await c.say('tommy', 'sf.tommy.q1');
    const k = await c.choose(["I'm in.", 'Maybe later.']);
    if (k !== 0) return;
    c.flag('sf.tommy.go', true);
    c.rel(4);
    c.start('sf.tommy');
    return 'end';
  },
});

// ================================================================== Wade: three flying lessons in Dragonfly
const nextLesson = (c) => (c.has('flight1') ? (c.has('flight2') ? (c.has('flight3') ? 0 : 3) : 2) : 1);
topic('wade', (c) => {
  const n = nextLesson(c);
  if (!n || c.day < 2 || num(c.flag('sf.wade.go')) >= n || c.hour < 8 || c.hour >= 18) return false;
  return {
    label: n === 1 ? 'About those flying lessons…' : `Ready for lesson ${n === 2 ? 'two' : 'three'}?`,
    run: async (c) => {
      await c.say('wade', n === 1 ? 'sf.wade.offer' : 'sf.wade.again');
      const k = await c.choose(["Let's fly. ($60)", 'Not today.']);
      if (k !== 0) return;
      if (c.state.money < 60) { await c.say('wade', 'sf.wade.broke'); return; }
      c.money(-60, 'flying lesson');
      c.flag('sf.wade.go', n);
      c.start('sf.wade');
      return 'end';
    },
  };
});

// ================================================================== profiles
// greet: [Stranger/Acquaintance, Friendly/Friend, Close friend/Family] (or a function)
// chat: { q (your line), line, min (friendship level), after (line heard first), when, then }
// gift: { love, like, hate, lines: [love, like, hate] } or { decline }
// defer: hand the whole conversation to the older version (day 1 business)
// prev: there's an older conversation worth offering as '(Something else…)'
const T = (q, line, min = 0, extra = {}) => ({ q, line, min, ...extra });
const revealed = (c) => c.has('okaforDeal') || c.has('okaforHostile');
const P = {
  wade: {
    greet: ['sf.wade.g0', 'sf.wade.g1', 'sf.wade.g2'], prev: true,
    chat: [T("What's it like, flying up here?", 'sf.wade.t0'), T('What do you make of Northstar?', 'sf.wade.t1'), T("How'd you end up in Port Zarya?", 'sf.wade.t2', 1), T('Who was Margie?', 'sf.wade.t3', 2, { after: 'sf.wade.t2' }), T('Ever think about leaving?', 'sf.wade.t4', 3)],
    gift: { love: ['coffee'], like: ['pie', 'fish', 'chocolate'], hate: ['tea'], lines: ['sf.wade.gift1', 'sf.wade.gift2', 'sf.wade.gift3'] },
  },
  koshkin: {
    greet: ['sf.koshkin.g0', 'sf.koshkin.g1', 'sf.koshkin.g2'], prev: true,
    defer: (c) => !c.has('koshkinMet') || c.day === 1,
    chat: [T("How's business?", 'sf.koshkin.t0'), T('Cold enough for you?', 'sf.koshkin.t1'), T('Tell me about your grandfather.', 'sf.koshkin.t2', 1), T('What was Yuri like?', 'sf.koshkin.t3', 2), T('Ever think about retiring?', 'sf.koshkin.t4', 3)],
    gift: { love: ['tea'], like: ['fish', 'chocolate', 'candle'], hate: ['whiskey'], lines: ['sf.koshkin.gift1', 'sf.koshkin.gift2', 'sf.koshkin.gift3'] },
  },
  dolly: {
    greet: ['sf.dolly.g0', 'sf.dolly.g1', 'sf.dolly.g2'], prev: true,
    defer: (c) => !c.has('dollyMet'),
    chat: [T("What's new in town?", 'sf.dolly.t0'), T('What do you make of Northstar?', 'sf.dolly.t1'), T('How long have you had the diner?', 'sf.dolly.t2', 1), T('Tell me about Earl.', 'sf.dolly.t3', 2, { after: 'sf.dolly.t2' }), T('Why do you stay, Dolly?', 'sf.dolly.t4', 3)],
    gift: { love: ['flowers'], like: ['chocolate', 'tea', 'fish'], hate: ['pie'], lines: ['sf.dolly.gift1', 'sf.dolly.gift2', 'sf.dolly.gift3'] },
  },
  hank: {
    greet: ['sf.hank.g0', 'sf.hank.g1', 'sf.hank.g2'], prev: true,
    defer: (c) => !!c.G.missions?.isActive?.('d1.cabin') && !c.hasItem('hemp_rope') && !c.has('bellFixed'),
    chat: [T("How's the hardware business?", 'sf.hank.t0'), T("What's your beef with Northstar?", 'sf.hank.t1'), T("How long's the store been here?", 'sf.hank.t2', 1), T('Got any family, Hank?', 'sf.hank.t3', 2), T('Why are you on the council?', 'sf.hank.t4', 3)],
    gift: { love: ['coffee'], like: ['fish', 'whiskey', 'pie'], hate: ['flowers'], lines: ['sf.hank.gift1', 'sf.hank.gift2', 'sf.hank.gift3'] },
  },
  ruth: {
    greet: ['sf.ruth.g0', 'sf.ruth.g1', 'sf.ruth.g2'],
    chat: [T('How long have you lived here?', 'sf.ruth.t0'), T('What do you think of Northstar?', 'sf.ruth.t1'), T('What was the town like when you were young?', 'sf.ruth.t2', 1), T('Tell me about Tommy.', 'sf.ruth.t3', 2), T('Do you ever get tired, Ruth?', 'sf.ruth.t4', 3)],
    gift: { love: ['tea'], like: ['fish', 'pie', 'candle'], hate: ['whiskey'], lines: ['sf.ruth.gift1', 'sf.ruth.gift2', 'sf.ruth.gift3'] },
  },
  ray: {
    greet: ['sf.ray.g0', 'sf.ray.g1', 'sf.ray.g2'],
    chat: [T("How's the cannery?", 'sf.ray.t0'), T('What do you make of Northstar?', 'sf.ray.t1'), T('How long have you worked the line?', 'sf.ray.t2', 1), T('Tell me about your daughter.', 'sf.ray.t3', 2), T('Why do you drink so much, Ray?', 'sf.ray.t4', 3)],
    gift: { love: ['coffee'], like: ['pie', 'chocolate', 'fish'], hate: ['whiskey'], lines: ['sf.ray.gift1', 'sf.ray.gift2', 'sf.ray.gift3'] },
  },
  lyle: {
    greet: ['sf.lyle.g0', 'sf.lyle.g1', 'sf.lyle.g2'],
    chat: [T("How's business?", 'sf.lyle.t0'), T('What do you think of Northstar?', 'sf.lyle.t1'), T('Why do you want to be mayor?', 'sf.lyle.t2', 1), T('Are you all right? You seem nervous.', 'sf.lyle.t3', 2), T('What scares you, Lyle?', 'sf.lyle.t4', 3)],
    gift: { love: ['whiskey'], like: ['chocolate', 'coffee'], hate: ['fish'], lines: ['sf.lyle.gift1', 'sf.lyle.gift2', 'sf.lyle.gift3'] },
  },
  gabriel: {
    greet: ['sf.gabriel.g0', 'sf.gabriel.g1', 'sf.gabriel.g2'], prev: true,
    defer: (c) => !c.has('gabrielMet') || (c.has('bellFixed') && !c.has('gabrielThanked')),
    chat: [T('How old is the church?', 'sf.gabriel.t0'), T('What do you make of Northstar?', 'sf.gabriel.t1'), T('How did you end up here?', 'sf.gabriel.t2', 1), T('Do you ever doubt, Father?', 'sf.gabriel.t3', 2), T('What do you pray for?', 'sf.gabriel.t4', 3)],
    gift: { love: ['candle'], like: ['tea', 'fish', 'pie', 'whiskey'], lines: ['sf.gabriel.gift1', 'sf.gabriel.gift2'] },
  },
  nina: {
    greet: ['sf.nina.g0', 'sf.nina.g1', 'sf.nina.g2'],
    chat: [T("How's the station?", 'sf.nina.t0'), T('What do you think of Northstar?', 'sf.nina.t1'), T("What's it like being the chief's kid?", 'sf.nina.t2', 1), T('Do you want to stay here?', 'sf.nina.t3', 2), T("What's your mom really like?", 'sf.nina.t4', 3)],
    gift: { love: ['chocolate'], like: ['coffee', 'pie'], hate: ['flowers'], lines: ['sf.nina.gift1', 'sf.nina.gift2', 'sf.nina.gift3'] },
  },
  tommy: {
    greet: ['sf.tommy.g0', 'sf.tommy.g1', 'sf.tommy.g2'],
    chat: [T('What do you do at Hank\'s?', 'sf.tommy.t0'), T('What do you think of Northstar?', 'sf.tommy.t1'), T("What's racing like?", 'sf.tommy.t2', 1), T('What about your parents?', 'sf.tommy.t3', 2), T('What do you want, Tommy?', 'sf.tommy.t4', 3)],
    gift: { love: ['pie'], like: ['chocolate', 'coffee', 'fish'], hate: ['tea'], lines: ['sf.tommy.gift1', 'sf.tommy.gift2', 'sf.tommy.gift3'] },
  },
  lou: {
    greet: ['sf.lou.g0', 'sf.lou.g1', 'sf.lou.g2'],
    chat: [T('Busy night?', 'sf.lou.t0'), T('What do you make of the Northstar crowd?', 'sf.lou.t1'), T("How'd you end up with a bar?", 'sf.lou.t2', 1), T("How'd you get so good at darts?", 'sf.lou.t3', 2), T('Who looks after you, Lou?', 'sf.lou.t4', 3)],
    gift: { love: ['fish'], like: ['coffee', 'pie', 'chocolate'], hate: ['whiskey'], lines: ['sf.lou.gift1', 'sf.lou.gift2', 'sf.lou.gift3'] },
  },
  ellen: {
    greet: ['sf.ellen.g0', 'sf.ellen.g1', 'sf.ellen.g2'],
    chat: [T("How's the clinic?", 'sf.ellen.t0'), T('What do you make of Northstar?', 'sf.ellen.t1'), T('Why birds?', 'sf.ellen.t2', 1), T('How did you end up here, Doc?', 'sf.ellen.t3', 2), T('What worries you, Doc?', 'sf.ellen.t4', 3)],
    gift: { love: ['film'], like: ['tea', 'chocolate', 'coffee'], hate: ['whiskey'], lines: ['sf.ellen.gift1', 'sf.ellen.gift2', 'sf.ellen.gift3'] },
  },
  pearl: {
    greet: ['sf.pearl.g0', 'sf.pearl.g1', 'sf.pearl.g2'],
    chat: [T('Any news?', 'sf.pearl.t0'), T('What do you make of Northstar?', 'sf.pearl.t1'), T('How long have you been postmaster?', 'sf.pearl.t2', 1), T('Do you ever write letters, Pearl?', 'sf.pearl.t3', 2), T('How do you know everything, Pearl?', 'sf.pearl.t4', 3)],
    gift: { love: ['chocolate'], like: ['flowers', 'pie', 'tea'], hate: ['fish'], lines: ['sf.pearl.gift1', 'sf.pearl.gift2', 'sf.pearl.gift3'] },
  },
  marta: {
    greet: ['sf.marta.g0', 'sf.marta.g1', 'sf.marta.g2'],
    chat: [T('Quiet day, Chief?', 'sf.marta.t0'), T('What do you think of Northstar?', 'sf.marta.t1'), T('Why did you become a cop?', 'sf.marta.t2', 1), T("How's Nina?", 'sf.marta.t3', 2), T('Do you trust me now?', 'sf.marta.t4', 3)],
    gift: { love: ['coffee'], like: ['pie', 'chocolate'], hate: ['whiskey'], lines: ['sf.marta.gift1', 'sf.marta.gift2', 'sf.marta.gift3'] },
  },
  evan: {
    greet: ['sf.evan.g0', 'sf.evan.g1', 'sf.evan.g2'], prev: true,
    defer: (c) => !c.has('evanMet'),
    chat: [T("How's business?", 'sf.evan.t0'), T("Don't you ever sleep?", 'sf.evan.t1'), T('Where are you from, Evan?', 'sf.evan.t2', 1), T('Do you like working for Northstar?', 'sf.evan.t3', 2),
      T('Evan, are you all right?', 'sf.evan.t4', 3, { then: (c) => { c.flag('intel.evanBlindspot', true); ear(c, 'sf.l.evan'); } })],
    gift: { love: ['chocolate'], like: Object.keys(GIFTS), lines: ['sf.evan.gift', 'sf.evan.gift'] },
  },
  walt: {
    greet: ['sf.walt.g0', 'sf.walt.g1'],
    chat: [T("How's the town doing, Mayor?", 'sf.walt.t0'), T('What do you think of Northstar?', 'sf.walt.t1'), T('Why so tired, Walt?', 'sf.walt.t2', 1)],
    gift: { love: ['pie'], like: ['coffee', 'whiskey', 'fish'], lines: ['sf.walt.gift1', 'sf.walt.gift2'] },
  },
  gideon: {
    greet: ['sf.gideon.g0', 'sf.gideon.g1'], cold: true,
    chat: [T('What does a city manager do?', 'sf.gideon.t0'), T('What do you think of Port Zarya?', 'sf.gideon.t1'), T('Do you ever relax?', 'sf.gideon.t2', 1)],
    gift: { decline: 'sf.gideon.gift' },
  },
  halloran: {
    greet: ['sf.halloran.g0'], cold: true,
    chat: [T('What do you want with Port Zarya?', 'sf.halloran.t0'), T('Do you like it here?', 'sf.halloran.t1')],
    gift: { decline: 'sf.halloran.gift' },
  },
  okafor: {
    greet: (c) => (revealed(c) ? 'sf.okafor.g1' : 'sf.okafor.g0'), cold: true,
    chat: [
      T('Do I know you?', 'sf.okafor.t0', 0, { when: (c) => !revealed(c) }),
      T('Why do I keep seeing you?', 'sf.okafor.t1', 0, { when: (c) => !revealed(c) }),
      T("How's the investigation?", 'sf.okafor.t2', 0, { when: revealed }),
      T('Why the grey parka?', 'sf.okafor.t3', 0, { when: revealed }),
    ],
    gift: { decline: 'sf.okafor.gift' },
  },
};

// ================================================================== the hub
async function chat(c, id, p, t) {
  c.flag('heard.' + t.line, true);
  await c.say(id, t.line);
  t.then?.(c);
  if (!p.cold && c.flag(`chat.${id}.day`) !== c.day) { c.flag(`chat.${id}.day`, c.day); c.rel(3); }
}

async function gift(c, id, p) {
  const held = Object.keys(GIFTS).filter((g) => c.hasItem(g)).slice(0, 5);
  const opts = held.map((g) => ({ label: GIFTS[g], key: g }));
  opts.push({ label: 'Never mind.', key: 'no' });
  const k = await c.choose(opts, { prompt: 'GIVE' });
  if (!GIFTS[k]) return;
  const g = p.gift;
  if (g.decline) { await c.say(id, g.decline); return; }
  c.take(k);
  c.flag(`gift.${id}.day`, c.day);
  if (g.love.includes(k)) { await c.say(id, g.lines[0]); c.rel(12); }
  else if ((g.hate || []).includes(k)) { await c.say(id, g.lines[2] || g.lines[1]); c.rel(-4); }
  else { await c.say(id, g.lines[1]); c.rel(g.like.includes(k) ? 6 : 3); }
  c.emit('gift:' + id);
}

function menu(c, id, p) {
  const o = [];
  const add = (label, run) => o.push({ label, key: 'o' + o.length, run });
  for (const fn of QT[id] || []) { const t = fn(c); if (t) add(t.label, t.run); }
  for (const t of [...(JOB_TOPICS[id] || []), ...(TOWN_TOPICS[id] || [])]) if (t.when(c)) add(t.label, t.run);
  const fresh = (p.chat || []).filter((t) => c.level >= t.min && (!t.when || t.when(c)) && (!t.after || c.flag('heard.' + t.after) === true) && c.flag('heard.' + t.line) !== true);
  for (const t of fresh.slice(0, 2)) add(t.q, (cc) => chat(cc, id, p, t));
  if (c.flag(`gift.${id}.day`) !== c.day && Object.keys(GIFTS).some((g) => c.hasItem(g))) add('I brought you something.', (cc) => gift(cc, id, p));
  if (p.prev) o.push({ label: '(Something else…)', key: 'prev' });
  o.push({ label: 'Goodbye.', key: 'bye' });
  return o;
}

async function hub(c, prev, id) {
  const p = P[id];
  if (p.defer && p.defer(c)) return prev(c);
  // keep the side missions alive (a quest whose mission was never started)
  const M = c.G.missions;
  for (const [mid, fk] of Object.entries(QUEST_GO)) if (c.has(fk) && M?.isActive && !M.isActive(mid) && !M.isDone?.(mid)) c.start(mid);
  // hello — once a day, warmer as you get to know each other
  const g = typeof p.greet === 'function' ? p.greet(c) : p.greet[Math.min(p.greet.length - 1, Math.floor(c.level / 2))];
  const greeted = c.flag('hi.' + id) === c.day;
  if (!greeted) {
    c.flag('hi.' + id, c.day);
    await c.say(id, g);
    if (!p.cold && c.flag('met.' + id) !== true) { c.flag('met.' + id, true); c.rel(2); }
  }
  const reacted = await reactTo(c, id);
  // nothing new to talk about? say something anyway (the older conversation, or hello again)
  if (greeted && !reacted && !menu(c, id, p).some((o) => o.run)) { if (p.prev) return prev(c); await c.say(id, g); return; }
  for (let round = 0; round < 3; round++) {
    const opts = menu(c, id, p);
    const k = await c.choose(opts);
    if (k === 'prev') return prev(c);
    const pick = opts.find((x) => x.key === k);
    if (!pick || !pick.run) { await c.you(round ? 'Thanks. See you around.' : 'See you around.'); return; }
    if ((await pick.run(c)) === 'end') return;
  }
}

export const DIALOG = Object.fromEntries(Object.keys(P).map((id) => [id, (c, prev) => hub(c, prev, id)]));
export const DIALOG_OVERRIDE = true;

// ================================================================== side missions
const LAKE = { x: -282, z: -436 };
async function race(m) {
  const G = m.G, f = G.state.flags;
  await SIDE.idle(m);
  await m.scene(async (d) => {
    await d.bring('tommy', beside(G));
    d.cam(d.overShoulder('player', 'tommy'));
    await d.say('tommy', 'sf.tommy.race1');
    await d.say('grisha', 'sf.g.race', { radio: true });
  });
  // a real race on the ice when there are snowmobiles; a minigame otherwise
  const loop = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return { x: LAKE.x + Math.cos(a) * 44, z: LAKE.z + Math.sin(a) * 36 }; });
  const won = G.vehicles?.sledRace
    ? await G.vehicles.sledRace({ course: loop, laps: 3, rival: 'tommy', pace: 10.5, title: 'LOON LAKE' })
    : await m.minigame('wire', { title: 'LOON LAKE', len: 6, time: 9 });
  G.vehicles?.exit?.();
  f['sf.tommy.r1'] = G.state.day;
  if (won) f['sf.tommy.won1'] = true;
  SIDE.rel(G, 'tommy', won ? 12 : 8);
  SIDE.rel(G, 'ruth', 3);
  if (won) { G.state.money += 50; G.hud?.toast?.('PAID', '+$50  the Loon Lake pot', '#9fe8b0'); SIDE.standing(G, 1); }
  await m.scene(async (d) => {
    await d.bring('tommy', beside(G));
    d.cam(d.closeUp('tommy', { side: 1, dist: 1.3 }));
    await d.say('tommy', won ? 'sf.tommy.win' : 'sf.tommy.lose');
  });
}

async function lesson(m, n) {
  const G = m.G, f = G.state.flags;
  await SIDE.idle(m);
  await m.scene(async (d) => {
    await d.bring('wade', SIDE.mark(G, 'hangar.helicopter', 1.6, 1));
    d.cam(d.overShoulder('player', 'wade'));
    await d.say('wade', ['sf.wade.l1a', 'sf.wade.l2a', 'sf.wade.l3a'][n - 1]);
    if (n === 1) await d.say('grisha', 'sf.g.wade1', { radio: true });
  });
  let ok;
  if (n === 1) ok = await m.minigame('glass', { title: 'LESSON ONE · HOLD THE HOVER' });
  else if (n === 2) ok = await m.minigame('wire', { title: 'LESSON TWO · FOLLOW THE SHORELINE', len: 6, time: 9 });
  else ok = (await m.minigame('hammer', { title: 'LESSON THREE · AUTOROTATION', hits: 4 })) && (await m.minigame('glass', { title: 'FLARE AND LAND' }));
  f['flight' + n] = true;
  f['sf.wade.l' + n] = G.state.day;
  if (ok) f['sf.wade.ace' + n] = true;
  SIDE.rel(G, 'wade', 8);
  G.hud?.toast?.('FLIGHT TRAINING', `Lesson ${n} of 3 complete`, '#ffd166');
  await m.scene(async (d) => {
    await d.bring('wade', SIDE.mark(G, 'hangar.helicopter', 1.6, 1));
    d.cam(d.closeUp('wade', { side: -1, dist: 1.2 }));
    await d.say('wade', n === 3 ? 'sf.wade.l3b' : ok ? (n === 1 ? 'sf.wade.l1b' : 'sf.wade.l2b') : 'sf.wade.l1c');
    await d.say('grisha', ['sf.g.wade2', 'sf.g.wade2', 'sf.g.wade3'][n - 1], { radio: true });
  });
  if (n === 1) m.ear('sf.n.wade');
  G.missions.emit?.('flight' + n);
}

export const MISSIONS = {
  // ---------------------------------------------------------------- Tommy
  'sf.tommy': {
    title: 'Loon Lake',
    async run(m, from) {
      const G = m.G, f = G.state.flags;
      if (m.cp(10, from) && !f['sf.tommy.r1']) {
        SIDE.obj(m, 'Meet Tommy at Loon Lake', LAKE, 'Up the Lake Trail, north-west of town');
        await m.reach(LAKE, 18);
        SIDE.clear(m);
        await race(m);
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Wade
  'sf.wade': {
    title: 'Flying Lessons',
    async run(m, from) {
      const G = m.G, f = G.state.flags;
      for (let n = 1; n <= 3; n++) {
        if (f['flight' + n]) continue;
        if (num(f['sf.wade.go']) < n) break;   // the next one is booked in conversation
        if (m.cp(n * 10 + 2, from)) {
          SIDE.clear(m);
          await lesson(m, n);
        }
      }
      SIDE.finish(m);
    },
    onDone: SIDE.again('sf.wade'),
  },
};

void CAST;
