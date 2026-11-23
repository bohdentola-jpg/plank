// Side content — friendships. Every named character gets a conversation hub
// that sits under the story (days 2–14 wrap it; day01 is under it):
//   a greeting that warms with friendship (Stranger → Family), what they think
//   of something you fixed (side_town REACTIONS), their quest steps, paid work
//   (side_jobs JOB_TOPICS), Pearl's job board (side_town TOWN_TOPICS), rotating
//   small talk per friendship level, a gift, '(Something else…)' → the older
//   conversation, and goodbye.
// Quest lines (missions 'sf.<npc>') run across several days, gated by
// friendship level and day. The five council members end by entrusting you
// their continuity card: flag share.<id> (and state.shares[id]); the honest
// four need knowsShares (day 4) + Close friend; Lyle needs his blackmail gone
// (or a darker trick). Council quests open on q.<id>.open (day 5), or day 6+.
// Wade's three flying lessons set flight1 / flight2 / flight3 for the finale.
import { CAST } from '../cast.js';
import { SIDE, workOrder, reactTo, TOWN_TOPICS } from './side_town.js';
import { JOB_TOPICS } from './side_jobs.js';

// ------------------------------------------------------------------ lines
export const LINES = {
  // ================================================================ Wade
  'sf.wade.g0': { who: 'wade', en: "Well, the carpenter. Still in one piece? Town hasn't eaten you yet." },
  'sf.wade.g1': { who: 'wade', en: "Hey, there's my favourite passenger. Pull up a crate. The coffee's terrible, but it's hot.", emo: 'smile' },
  'sf.wade.g2': { who: 'wade', en: "Hey, partner. Sky's clear over the strait today. Days like this, I remember why I stayed.", emo: 'smile' },
  'sf.wade.t0': { who: 'wade', en: "Mostly cold and loud. Then once a month the aurora comes down to meet you, and you forget every bad landing you ever made." },
  'sf.wade.t1': { who: 'wade', en: "They pay cash to fly their crates up the hill. No questions. I didn't ask any. That's the part that keeps me up at night.", emo: 'serious' },
  'sf.wade.t2': { who: 'wade', en: "Flew medevac in the Gulf. Came home, couldn't sit still. Margie said, pick somewhere quiet. I picked the quietest place on the map." },
  'sf.wade.t3': { who: 'wade', en: "My wife. Gone six years now. She named the chopper Dragonfly. Said it was too pretty a name for a machine that ugly. She was right about most things." },
  'sf.wade.t4': { who: 'wade', en: "Every winter. Then somebody's kid needs a flight to Nome at two in the morning, and I'm the only one with a heater that works. So, no." },
  'sf.wade.gift1': { who: 'wade', en: "Real coffee beans? Not the hangar sludge? You might be the best thing that's landed on this strip in years.", emo: 'laugh' },
  'sf.wade.gift2': { who: 'wade', en: "Well, thank you. That's kind. I'll take it up with me on the Nome run." },
  'sf.wade.gift3': { who: 'wade', en: "Tea? Huh. Margie drank tea. I never got the hang of it. I'll find it a good home." },
  'sf.wade.offer': { who: 'wade', en: "You ever want to learn to fly her? Sixty bucks a lesson covers the fuel. Can't promise you'll be good. Can promise you'll be scared.", emo: 'smile' },
  'sf.wade.again': { who: 'wade', en: "Back for more? Good. Sixty for the fuel and we go up. She's warmed up, and so am I." },
  'sf.wade.broke': { who: 'wade', en: "Sixty for fuel, friend. Dragonfly doesn't run on good intentions." },
  'sf.wade.l1a': { who: 'wade', en: "Right hand's the cyclic, left hand's the collective, feet on the pedals. Everything talks to everything. Small moves. Smaller than that." },
  'sf.wade.l1b': { who: 'wade', en: "Look at that! You held a hover. Most folks spin like a top their first time.", emo: 'laugh' },
  'sf.wade.l1c': { who: 'wade', en: "Well, we're alive and the hangar's still standing. Up here, that counts as a pass." },
  'sf.wade.l2a': { who: 'wade', en: "Today we go somewhere. Nose down a touch, she picks up speed and starts to fly instead of hang. Follow the shoreline. Don't wave at the walrus." },
  'sf.wade.l2b': { who: 'wade', en: "Smooth turns. You've got the feet for it. Most people fly with their hands and forget their feet.", emo: 'smile' },
  'sf.wade.l3a': { who: 'wade', en: "Last lesson. The engine quits. Someday it will. Drop the collective, keep the rotor turning, flare at the bottom. That's autorotation. Falling, with a plan.", emo: 'serious' },
  'sf.wade.l3b': { who: 'wade', en: "That's it. You can fly her. Badly, but you can. If you ever have to do it for real, stay low over the water and watch the horizon, not the gauges.", emo: 'serious' },
  'sf.wade.crate': { who: 'wade', en: "Doc's crate? Right here. Freight bill's paid, I covered it. Don't tell her. She'll try to pay me back and I'll have to argue with a doctor." },
  'sf.g.wade1': { who: 'grisha', ru: 'Вертолёт?! Так, слушай меня. Шаг — плавно. Педали не дёргай. И дыши.', en: "A helicopter?! Right, listen to me. Collective — smoothly. Don't stamp on the pedals. And breathe." },
  'sf.g.wade2': { who: 'grisha', ru: 'Неплохо! Почти как у меня в первый раз. Я тогда, правда, забор снёс.', en: 'Not bad! Almost like my first time. Though I did take out a fence.', emo: 'laugh' },
  'sf.g.wade3': { who: 'grisha', ru: 'Вот теперь я спокоен. Ну, почти. Если придётся — справишься.', en: "Now I'm calm. Well, almost. If it comes to it — you'll manage.", emo: 'smile' },
  'sf.n.wade': { who: 'nadia', ru: 'Уроки пилотирования? Дмитрий сказал: «Пусть учится». У него это высшая похвала.', en: "Flying lessons? Dmitri said, 'Let them learn.' From him, that's the highest praise.", emo: 'smile' },

  // ================================================================ Koshkin
  'sf.koshkin.g0': { who: 'koshkin', en: "Ah, the carpenter. You're letting the cold in. Come, come, close the door." },
  'sf.koshkin.g1': { who: 'koshkin', en: "Golubchik! Come in. Kettle's on. Kettle is always on. It's Alaska.", emo: 'smile' },
  'sf.koshkin.g2': { who: 'koshkin', en: "There you are. I was starting to worry. At my age, worry is a hobby.", emo: 'smile' },
  'sf.koshkin.t0': { who: 'koshkin', en: "Business is like my knees. Bad, but still working. Every day somebody comes back from Northstar. Slowly. Like a cat pretending it never left." },
  'sf.koshkin.t1': { who: 'koshkin', en: "This? This is nothing. Nineteen eighty-nine, minus fifty-two. Spit froze before it hit the ground. Good times.", emo: 'laugh' },
  'sf.koshkin.t2': { who: 'koshkin', en: "Grigory Koshkin. Came from Sitka in nineteen eleven with a barrel of flour and a rifle. Sold the flour. Kept the rifle. Smart man." },
  'sf.koshkin.t3': { who: 'koshkin', en: "My brother? Stubborn. Played the accordion very bad, very loud. Built that cabin with his hands. Now you sleep in it. He would like that. He'd charge you more, but he'd like it." },
  'sf.koshkin.t4': { who: 'koshkin', en: "Retire? And do what, sit? Sitting is how they get you. I retire when the store closes, and the store closes when I do. Nu, that's the plan." },
  'sf.koshkin.gift1': { who: 'koshkin', en: "Russian tea! The real one. You bought it from me, so I made a profit, and now I drink it too. Best customer in Alaska.", emo: 'laugh' },
  'sf.koshkin.gift2': { who: 'koshkin', en: "For me? Spasibo, golubchik. Old men don't get presents. We get advice." },
  'sf.koshkin.gift3': { who: 'koshkin', en: "Whiskey? My heart says no. My doctor says no. Even my grandfather, who said yes to everything, says no." },

  // ================================================================ Dolly
  'sf.dolly.g0': { who: 'dolly', en: "Well, look who it is. Sit anywhere, honey. Coffee's on." },
  'sf.dolly.g1': { who: 'dolly', en: "There's my favourite carpenter! Sit, sit. I saved you the booth by the good heater.", emo: 'smile' },
  'sf.dolly.g2': { who: 'dolly', en: "Get over here, you. I was just telling Pearl you'd come in today. I'm never wrong about these things.", emo: 'laugh' },
  'sf.dolly.t0': { who: 'dolly', en: "Oh, honey, where to start. The Petrov sisters aren't speaking. The mayor's got a new truck. And somebody's been fixing things. Folks are calling you the miracle worker." },
  'sf.dolly.t1': { who: 'dolly', en: "They came in June with a check and a smile. Nobody gives you a check and a smile, honey. One of them's always fake." },
  'sf.dolly.t2': { who: 'dolly', en: "Thirty-one years. Earl and I bought it with his crab money. He cooked, I talked. Turned out the talking was the harder job." },
  'sf.dolly.t3': { who: 'dolly', en: "Big man. Bad jokes. Best fish chowder on the Bering Sea. He's been gone four years, and I still set out two mugs every morning." },
  'sf.dolly.t4': { who: 'dolly', en: "Because when somebody's husband dies, or their boat goes down, they come here. They sit in that booth. Somebody's got to keep the coffee hot." },
  'sf.dolly.gift1': { who: 'dolly', en: "Flowers? In November? Honey, nobody's brought me flowers since Earl. Go on, get out of here before I cry in the gravy.", emo: 'smile' },
  'sf.dolly.gift2': { who: 'dolly', en: "Aren't you sweet. I'm putting this right by the register, so everybody asks me where I got it." },
  'sf.dolly.gift3': { who: 'dolly', en: "You bought my pie, from me, to give back to me? I'm charging you for the plate. I'm kidding. Mostly.", emo: 'laugh' },
  'sf.dolly.q1': { who: 'dolly', en: "Honey, sit. Here's what's eating me. Northstar bought my loan off the bank in Anchorage. They own my debt now. And every week they offer to buy me out. A little nicer each time.", emo: 'worry' },
  'sf.dolly.q2': { who: 'dolly', en: "I'm three months behind. Earl's freezer is dying, and I can't even cook his chowder any more. His recipe box is out in his workshop. I haven't opened that door since the funeral.", emo: 'worry' },
  'sf.dolly.q3': { who: 'dolly', en: "You'd do that? The workshop door's frozen shut, it'll need real work. Lord. Thank you, honey." },
  'sf.dolly.q4': { who: 'dolly', en: "That's it. That's his box. Look at his handwriting. Chowder, for when Dolly's sad. Double the butter. Oh, that man.", emo: 'smile' },
  'sf.dolly.q5': { who: 'dolly', en: "You know what? Chowder Night. Whole town, pay what you can. But not with that freezer wheezing like an old dog. Could you look at it, honey?" },
  'sf.dolly.q6': { who: 'dolly', en: "Listen to that hum. Earl's freezer, purring like a cat. Now tell Pearl, she'll tell everybody. Tell Nina, she'll put it on the radio. And tell Father Gabriel, so it's blessed.", emo: 'smile' },
  'sf.dolly.q7': { who: 'dolly', en: "Everybody! Thank you for coming. Earl made this chowder for thirty years. Tonight it's on all of you. Pay what you can, and eat till you can't.", emo: 'smile' },
  'sf.dolly.q8': { who: 'dolly', en: "Honey, we covered three months. Three! Northstar can wait in line like everybody else. You did this. Don't argue. I'm old and I'm right.", emo: 'laugh' },
  'sf.dolly.card': { who: 'dolly', en: "That card Gideon had us sign? Continuity, he called it. I don't know what you are, honey, and I don't need to. Earl always said, trust the ones who fix things. Here.", emo: 'serious' },
  'sf.hank.chowder': { who: 'hank', en: "Best chowder in Alaska. Don't tell Dolly I said that. Dolly, I said it. Don't make a thing of it." },
  'sf.pearl.chowder': { who: 'pearl', en: "Chowder Night? It'll be all over town before you reach the door. That's not gossip, dear. That's a public service." },
  'sf.nina.chowder': { who: 'nina', en: "Chowder Night at Dolly's? I'll run it every hour. With a jingle. I'm writing the jingle right now. Chowder, chowder. Okay, it needs work.", emo: 'laugh' },
  'sf.gabriel.chowder': { who: 'gabriel', en: "Earl's chowder! I'll announce it after vespers, and I'll be first in line. Gluttony is a sin, but that chowder is practically a sacrament. Don't quote me." },
  'sf.n.dolly': { who: 'nadia', ru: 'Хорошо, что ты ей помогаешь. Не ради дела. Просто хорошо.', en: "It's good that you're helping her. Not for the mission. Just good.", emo: 'smile' },

  // ================================================================ Hank
  'sf.hank.g0': { who: 'hank', en: "Yeah? You buying, or just warming up? Either's fine. Buying's better." },
  'sf.hank.g1': { who: 'hank', en: "Carpenter. Nails are on special. That means they're the same price, but I'm telling you about it." },
  'sf.hank.g2': { who: 'hank', en: "Hey. Good. Grab a coffee from the pot. It's yesterday's. It's fine." },
  'sf.hank.t0': { who: 'hank', en: "Nails, rope, fuel oil and complaints. I sell the first three. The fourth one's free." },
  'sf.hank.t1': { who: 'hank', en: "They undercut my heating oil by forty cents a gallon. Forty cents. You know what that is? That's a company planning to be the only one left.", emo: 'angry' },
  'sf.hank.t2': { who: 'hank', en: "My dad opened it in seventy-four. Pipeline money. He used to say a town needs three things. A church, a bar, and somebody who sells nails." },
  'sf.hank.t3': { who: 'hank', en: "Had a wife. She's in Kenai with a dentist. Had a son. Still have a son. He's in Anchorage. We don't talk. That's the whole story.", emo: 'frown' },
  'sf.hank.t4': { who: 'hank', en: "Nobody else would run. And somebody has to tell the mayor no once in a while. Turns out I'm real good at no." },
  'sf.hank.gift1': { who: 'hank', en: "Coffee beans. Real ones. Huh. Okay. Okay, you're all right. Don't tell anybody I said that." },
  'sf.hank.gift2': { who: 'hank', en: "Didn't have to do that. Thanks. I'll put it somewhere I won't sell it by accident." },
  'sf.hank.gift3': { who: 'hank', en: "Flowers. What am I supposed to do with flowers? Sell them? Fine. They're going by the register." },
  'sf.hank.q1': { who: 'hank', en: "You came. Good. Here's what stinks. Gideon's steering the town's fuel contract to a Northstar outfit bidding half my price. Nobody can haul oil up here that cheap. Unless they plan to own February.", emo: 'angry' },
  'sf.hank.q2': { who: 'hank', en: "I need proof. Their barge unloads at the cannery dock. Ray Moody sees every delivery that comes in. Get me a look at those tickets." },
  'sf.hank.q3': { who: 'hank', en: "Look at that. Northstar pays four-ten a gallon delivered and bids the town three-sixty. They're eating fifty cents a gallon to bury me. Ruth's going to love this at council." },
  'sf.hank.q3b': { who: 'hank', en: "But if my truck can't deliver, Gideon wins anyway. The fuel pump's shot. You any good with pumps? Course you are. You're good with everything." },
  'sf.hank.pump': { who: 'hank', en: "She runs. Listen to that. Forty-six years my family's hauled this town's heat. We're not stopping now.", emo: 'smile' },
  'sf.hank.q4': { who: 'hank', en: "Got a letter. From Danny. My son. Three weeks ago. Haven't opened it. Don't look at me like that. It's on the shelf behind the glue.", emo: 'frown' },
  'sf.hank.q5': { who: 'hank', en: "He's getting married. In Anchorage, in January. He wants me there. He says he's sorry. I'm the one who told him not to come back.", emo: 'worry' },
  'sf.hank.q6': { who: 'hank', en: "And I don't have his number. Six years. I don't have my own son's phone number." },
  'sf.hank.q7': { who: 'hank', en: "Danny? It's your dad. Yeah. I got it. I read it. Yeah. I'll be there. Tell her congratulations. From me. Yeah. Me too, son." },
  'sf.hank.q8': { who: 'hank', en: "He cried. I didn't. Had something in my eye. Sawdust. It's a hardware store. There's sawdust everywhere." },
  'sf.hank.card': { who: 'hank', en: "That card Gideon had us sign. Continuity, he said. I figured it meant keep Hank quiet. You keep it. You're the only one who ever asked me about Danny.", emo: 'serious' },
  'sf.hank.parcel': { who: 'hank', en: "Finally. Band saw blades. Been waiting a month. Pearl send you? Course she did." },
  'sf.ray.ticket': { who: 'ray', en: "Hank wants the Northstar barge tickets? They're pinned up in the harbour shack. I didn't tell you that. I'm a cannery foreman. I don't know anything." },
  'sf.pearl.danny': { who: 'pearl', en: "Danny Brubaker? That boy sends me a Christmas card every year. Six years, and never one to his father. His number's in my book. Here." },
  'sf.n.tickets': { who: 'nadia', ru: 'Снимай быстро и уходи. Спокойно, не беги.', en: "Take the picture quickly and go. Calmly — don't run.", emo: 'serious' },

  // ================================================================ Ruth
  'sf.ruth.g0': { who: 'ruth', en: "Hello. You're the carpenter. I taught half this town to read. The other half, I taught to behave." },
  'sf.ruth.g1': { who: 'ruth', en: "Ah, my best student who never sat in my classroom. Sit down.", emo: 'smile' },
  'sf.ruth.g2': { who: 'ruth', en: "There you are. Come, sit with an old woman. I'll pretend I didn't know you were coming.", emo: 'smile' },
  'sf.ruth.t0': { who: 'ruth', en: "I was born in a sod house on the point, nineteen fifty-five. I've watched this town nearly die four times. It's stubborn. Like its teachers." },
  'sf.ruth.t1': { who: 'ruth', en: "Men in good coats have come to save us since the Russians. Then the Americans, the oil men, now the computer men. We are still here. They are not.", emo: 'serious' },
  'sf.ruth.t2': { who: 'ruth', en: "Every family had a boat and a dog team. The church choir had forty voices. Nobody locked a door. You could hear the school bell from the lighthouse." },
  'sf.ruth.t3': { who: 'ruth', en: "My grandson. His mother went to Anchorage and his father went to the bottle, so he got me. He's fast on a snowmachine and slow at writing letters." },
  'sf.ruth.t4': { who: 'ruth', en: "Every day, dear. Then I sit in that council chamber and look at Lyle Pruitt's hair, and I wake right up. Somebody has to say no out loud.", emo: 'smile' },
  'sf.ruth.gift1': { who: 'ruth', en: "Black tea. Russian tea. My grandmother drank this. Thank you, dear. Sit, I'll make a pot and tell you something you didn't know.", emo: 'smile' },
  'sf.ruth.gift2': { who: 'ruth', en: "How thoughtful. Thank you. You were raised right, wherever it was." },
  'sf.ruth.gift3': { who: 'ruth', en: "No, dear. I buried a brother who loved that more than he loved us. Take it home. Better yet, pour it out.", emo: 'serious' },
  'sf.ruth.q1': { who: 'ruth', en: "My project. An album for the children, our history in pictures. My mother's photographs are in the town archive, in boxes in the school gym. Under the leak." },
  'sf.ruth.q1b': { who: 'ruth', en: "Northstar has offered to digitize the whole archive. They'd carry the boxes up the hill. Over my dead body. Can you fix that roof first?", emo: 'serious' },
  'sf.ruth.q2a': { who: 'ruth', en: "The archive is dry. Thank you, dear. But my best photographs were never in it. I lent them out over fifty years, and people keep things." },
  'sf.ruth.q2': { who: 'ruth', en: "Father Gabriel has one. Lou has one behind her bar. Pearl has one in back. The cannery office has the old fleet. And one's up in the lighthouse, if the sea hasn't taken it." },
  'sf.ruth.q3': { who: 'ruth', en: "Oh. Oh, look at these. The Russian school, nineteen-oh-four. See the bell over the door? That bell rang for the school until nineteen seventeen. Then it vanished.", emo: 'surprise' },
  'sf.ruth.q4': { who: 'ruth', en: "Father Gabriel's people never threw anything away. If that bell is anywhere, it's in the church. Find it, and I'll find a place for it." },
  'sf.ruth.q5': { who: 'ruth', en: "Did you hear it? The children don't know what that sound is. Their great-grandparents did. Thank you. You've put a voice back in this town.", emo: 'smile' },
  'sf.ruth.q6': { who: 'ruth', en: "Tommy's been offered a job up the hill. Northstar's maintenance crew. Good money. He hasn't told me. I know anyway. Talk to him. He won't listen to me.", emo: 'worry' },
  'sf.ruth.q7': { who: 'ruth', en: "He said no. He came home, ate two bowls of soup, and said no. Whatever you told him, thank you.", emo: 'smile' },
  'sf.ruth.card': { who: 'ruth', en: "I taught this town to read. I can read you, too. I don't know your real name. I know what you've done for us. Here. Keep it safer than we did.", emo: 'serious' },
  'sf.ruth.parcel': { who: 'ruth', en: "A parcel? From my sister in Kotzebue. Dried fish and complaints. Thank you, dear." },
  'sf.ruth.tape': { who: 'ruth', en: "Is this thing on? My name is Ruth Aqpik. I was born on the point, in a sod house, the winter the sea froze to Siberia. Let me tell you about this town." },
  'sf.gabriel.bell': { who: 'gabriel', en: "The school bell? There's a bell wrapped in sackcloth under the tower stairs. I always thought it was a spare for the church. Take it, with my blessing." },
  'sf.tommy.dome': { who: 'tommy', en: "Grandma sent you, huh? The money's crazy. Three times what Hank pays. But they made me sign something. Can't talk about the job. Not even to her. That's weird, right?" },
  'sf.tommy.dome2': { who: 'tommy', en: "Yeah. You're right. I'd rather be broke and racing than rich and quiet. Don't tell Grandma you were right. She'll be unbearable.", emo: 'smile' },
  'sf.tommy.dome3': { who: 'tommy', en: "Yeah? Maybe. I'll think about it. Nah. Grandma would never forgive me. Neither would the yellow sled. I'm saying no." },
  'sf.l.photo': { who: 'lyosha', ru: 'Ещё одно фото? Покажи и мне, я сделаю цифровой архив. Бабушка Рут — это сила.', en: "Another photo? Show me too — I'll make a digital archive. Grandma Ruth is a force.", emo: 'smile' },

  // ================================================================ Ray
  'sf.ray.g0': { who: 'ray', en: "Yeah? What. Oh, the carpenter. Pull up a stool, or don't." },
  'sf.ray.g1': { who: 'ray', en: "Hey. You again. Sit down, you're making the bar nervous." },
  'sf.ray.g2': { who: 'ray', en: "Hey, friend. Good to see a face that isn't fish or management.", emo: 'smile' },
  'sf.ray.t0': { who: 'ray', en: "Fish come in, fish go out, and the company in Seattle says it's losing money. They've been losing money on a boat with a hot tub since nineteen ninety-eight." },
  'sf.ray.t1': { who: 'ray', en: "They want the cannery waterfront. Not for fish. For something with cables. Nobody will say what. That's how you know it's bad.", emo: 'frown' },
  'sf.ray.t2': { who: 'ray', en: "Thirty years. Started at seventeen, gutting pinks for six bucks an hour. Foreman now. Means I get to fire my friends." },
  'sf.ray.t3': { who: 'ray', en: "Kayla. Fifteen. Lives with her mom in Fairbanks. Smarter than me. Plays the violin. I've never once heard her play in person. Isn't that something." },
  'sf.ray.t4': { who: 'ray', en: "Because it's quiet in the glass. Out here everybody wants something. Rent, names, answers. The glass doesn't want anything. Until morning.", emo: 'frown' },
  'sf.ray.gift1': { who: 'ray', en: "Coffee. Strong, too. You know what, I'll drink this instead of the other thing tonight. Maybe. Thanks." },
  'sf.ray.gift2': { who: 'ray', en: "Huh. Thanks. Nobody gives a foreman anything but grief." },
  'sf.ray.gift3': { who: 'ray', en: "No. Not that. I'm trying. Take it back, would you? Thanks for thinking of me, though.", emo: 'frown' },
  'sf.ray.q1': { who: 'ray', en: "Remember the names? Forty-two of them, by New Year, on Northstar's say-so. The list is in my coat. The Nanouks. The Delgados. Old Joe's grandson. And I'm the one who signs.", emo: 'frown' },
  'sf.ray.q2': { who: 'ray', en: "And Kayla's coming to visit. First time in a year. Look at me. Look at my house. The porch roof's falling in, and I can't make myself pick up a hammer.", emo: 'worry' },
  'sf.ray.q3': { who: 'ray', en: "You'd fix it? I can't pay much. I can pay in fish. Don't make that face. It's good fish." },
  'sf.ray.q4': { who: 'ray', en: "Porch looks good. Real good. Now the hard part. If you see me in here after six this week, get me out. Darts, a walk, anything. I mean it.", emo: 'serious' },
  'sf.ray.q5': { who: 'ray', en: "Yeah. Yeah, okay. Darts. Not the bottle. Lou, give me a soda. Don't look at me like that, Lou." },
  'sf.lou.ray': { who: 'lou', en: "Ray Moody ordering a soda. Somebody call the Nome paper. Darts are on the house. Both of you.", emo: 'laugh' },
  'sf.ray.q6': { who: 'ray', en: "She stayed three days. She played the violin on my porch, under the new roof. The whole street came out to listen. I'm not crying. It's the cold.", emo: 'smile' },
  'sf.ray.q7': { who: 'ray', en: "And I'm not signing any names. I told them. They want forty-two names, they can come up here and look those people in the eye. Let them fire me first.", emo: 'serious' },
  'sf.ray.card': { who: 'ray', en: "That card Northstar had us sign? Northstar wants it, so I want them not to have it. Simple. Take it, before I trade it for a beer. Kidding. Mostly.", emo: 'smile' },

  // ================================================================ Lyle
  'sf.lyle.g0': { who: 'lyle', en: "Lyle Pruitt, Pruitt Realty and Insurance. If you're thinking of buying, the market's never been better. If you're thinking of selling, also never better.", emo: 'smile' },
  'sf.lyle.g1': { who: 'lyle', en: "Ah, the handyman! Love what you've done around town. Very electable. For you, I mean. Not that you're running. You're not running, are you?", emo: 'smile' },
  'sf.lyle.g2': { who: 'lyle', en: "Hey. Hey, you. Sit down. You're the only person in this town who doesn't want something from me. I think." },
  'sf.lyle.t0': { who: 'lyle', en: "Booming. Northstar's investment has lifted property values eleven percent. That's real growth. Don't let Ruth Aqpik tell you different. She will.", emo: 'smile' },
  'sf.lyle.t1': { who: 'lyle', en: "Visionaries. Partners. The future. I say that a lot. Sometimes I believe it all the way to the end of the sentence." },
  'sf.lyle.t2': { who: 'lyle', en: "Because nobody in this town ever thought I'd be anything. My dad sold bait. I sell futures. Someday they'll hang my picture in City Hall. Next to the good ones." },
  'sf.lyle.t3': { who: 'lyle', en: "Me? I'm great. I'm fantastic. I sleep four hours a night and check my locks twice. That's just ambition. Right?", emo: 'worry' },
  'sf.lyle.t4': { who: 'lyle', en: "Being found out. Doesn't matter for what. Everybody has a what. Mine just came with paperwork.", emo: 'worry' },
  'sf.lyle.gift1': { who: 'lyle', en: "Whiskey? You have taste. Real taste. I knew there was a reason I liked you. Besides your vote. Your potential vote.", emo: 'smile' },
  'sf.lyle.gift2': { who: 'lyle', en: "For me? Well. Thank you. I'll be sure to mention you in my campaign. Positively." },
  'sf.lyle.gift3': { who: 'lyle', en: "It's a fish. Wrapped in paper. On my desk. I sell insurance. I can't smell like a harbour.", emo: 'frown' },
  'sf.lyle.q1': { who: 'lyle', en: "Can I ask a favour? Could you put a real lock on my office door? Somebody's been in my files. Nothing's missing. That's what scares me.", emo: 'worry' },
  'sf.lyle.q2': { who: 'lyle', en: "Fifty dollars, cash, and my eternal gratitude. The gratitude is negotiable. The fifty isn't. The office is on Third, by City Hall." },
  'sf.lyle.deny': { who: 'lyle', en: "That? Junk mail. Political junk mail. Very common this time of year. Excuse me, I have a call. On my phone. Which is ringing.", emo: 'worry' },
  'sf.lyle.q3': { who: 'lyle', en: "Where did you get that? Fine. Twenty nineteen, I sold eight lots on Shore Road. The survey said the permafrost was failing. I buried the survey. Three of those houses are cracking now.", emo: 'worry' },
  'sf.lyle.q4': { who: 'lyle', en: "Gideon found the original. Signed, dated. Every time Northstar needs a vote, an envelope shows up. I vote yes. I'm not a bad man. I'm a scared one. That's probably worse.", emo: 'frown' },
  'sf.lyle.q5': { who: 'lyle', en: "You're giving it to me? Why? Nobody does anything for nothing in this town. Okay. Okay. The families. I'll pay for the foundations. Quietly. I promise.", emo: 'surprise' },
  'sf.lyle.free': { who: 'lyle', en: "I owe you. I don't say that. I never say that. If you ever need anything from me, anything, ask." },
  'sf.lyle.card': { who: 'lyle', en: "That card? Gideon had me sign it first, before the others. I don't know what it opens. Northstar wanted it. That's reason enough for you to have it.", emo: 'serious' },
  'sf.lyle.dark': { who: 'lyle', en: "So that's how it is. Another envelope, another hand. Fine. Take the card. For a minute there, I thought you were different.", emo: 'angry' },
  'sf.n.lyle': { who: 'nadia', ru: 'Это шантаж. Кто-то держит его на крючке. Узнай, на каком.', en: 'That is blackmail. Someone has him on a hook. Find out which one.', emo: 'serious' },
  'sf.n.survey': { who: 'nadia', ru: 'Есть? Теперь уходи. Тихо, через чёрный ход.', en: 'Got it? Now leave. Quietly, out the back.', emo: 'serious' },

  // ================================================================ Father Gabriel
  'sf.gabriel.g0': { who: 'gabriel', en: "Welcome, friend. Come in out of the wind. God and the radiator are both working today.", emo: 'smile' },
  'sf.gabriel.g1': { who: 'gabriel', en: "Ah, my bell-ringer! Come in. I've set up the board, if you have the time and the humility.", emo: 'smile' },
  'sf.gabriel.g2': { who: 'gabriel', en: "There you are. I lit a candle for you this morning. Don't ask me what for. I'm not entirely sure myself." },
  'sf.gabriel.t0': { who: 'gabriel', en: "Eighteen thirty-one. Built by Aleut carpenters and a Russian priest who couldn't swing a hammer. The domes went up in eighteen forty. The heating, sadly, in nineteen seventy." },
  'sf.gabriel.t1': { who: 'gabriel', en: "They offered to put a camera on the bell tower. For safety. I told them God is already watching, and He doesn't need the internet.", emo: 'smile' },
  'sf.gabriel.t2': { who: 'gabriel', en: "I was a radio man in the Navy before I was a priest. Fixed transmitters on Adak. One Easter I heard this town's bell across the water, and that was that." },
  'sf.gabriel.t3': { who: 'gabriel', en: "Every Tuesday. Doubt is just faith checking its pockets. You'd be surprised how often I find my keys.", emo: 'smile' },
  'sf.gabriel.t4': { who: 'gabriel', en: "For the town. For the people who come in at night, sit in the back and say nothing. And lately, for whatever it is you're carrying.", emo: 'serious' },
  'sf.gabriel.gift1': { who: 'gabriel', en: "A candle. People think a candle is a small thing. A candle is a prayer that keeps going after you've left the room. Thank you.", emo: 'smile' },
  'sf.gabriel.gift2': { who: 'gabriel', en: "How kind. I'll share it with the choir. All four of them. Well, three. Mrs. Ivanoff only comes for the singing." },
  'sf.gabriel.chess': { who: 'gabriel', en: "Do you play? Sit. I'll go easy on you. That's a lie. Priests are allowed to lie about chess. It's in a footnote somewhere.", emo: 'smile' },
  'sf.gabriel.win': { who: 'gabriel', en: "Ha! Well played. Well played. Now I'll have to confess that I enjoyed losing. That's a new one.", emo: 'laugh' },
  'sf.gabriel.lose': { who: 'gabriel', en: "Checkmate. Don't look so sad. I've had forty years of practice and nobody to practise on.", emo: 'smile' },
  'sf.gabriel.hymn': { who: 'gabriel', en: "This Slavonic hymnbook came from Valaam in eighteen ninety. Look. The pages of our own chant, the Zarya chant, are torn out. Nobody alive remembers how it went.", emo: 'worry' },
  'sf.gabriel.hymn2': { who: 'gabriel', en: "Where did you get this? This is it. The old Zarya chant! We'll sing it on Sunday. Whoever your friend is, tell them a priest in Alaska is weeping on his hymnbook.", emo: 'surprise' },
  'sf.gabriel.icon': { who: 'gabriel', en: "The icon of the Transfiguration, there, above the royal doors. A hundred years of candle smoke. Christ is up there somewhere. Could you help me find Him?" },
  'sf.gabriel.icon2': { who: 'gabriel', en: "Look at the light on His robes. White as snow, the Gospel says. I'd forgotten. We'd all forgotten. Thank you, my friend.", emo: 'smile' },
  'sf.gabriel.chess2': { who: 'gabriel', en: "One more game. Then I'll say something, and you don't have to answer. Whatever you're carrying, if you ever need a place to set it down, this door is never locked.", emo: 'serious' },
  'sf.gabriel.parcel': { who: 'gabriel', en: "Candles from the monastery in Pennsylvania. Wonderful. They always send too many. I always use them all." },
  'sf.v.hymn1': { who: 'valya', ru: 'Подожди-ка. Покажи страницу поближе. Это же наш старый распев… Бабушка моя его пела. Записывай.', en: "Wait a moment. Hold the page closer. That's our old chant… My grandmother used to sing it. Write this down." },
  'sf.v.hymn2': { who: 'valya', ru: 'Вот так. Ноты Лёша потом нарисует. А батюшке скажи: от старой бабки с того берега.', en: "There. Lyosha can draw the notes later. And tell the father: it's from an old woman on the far shore.", emo: 'smile' },

  // ================================================================ Nina
  'sf.nina.g0': { who: 'nina', en: "Oh, hey. You're the carpenter. My mom has a file on you. Kidding. Probably." },
  'sf.nina.g1': { who: 'nina', en: "Hey! Come in, come in, mind the cables. We're on the air in, like, a while. Ish.", emo: 'smile' },
  'sf.nina.g2': { who: 'nina', en: "You! Sit. I made you a playlist. It's called Songs for People Who Fix Things. It's mostly sad country.", emo: 'laugh' },
  'sf.nina.t0': { who: 'nina', en: "Eighty-eight point nine, reaching the entire town and two confused walruses. The transmitter's from nineteen seventy-nine. So am I, spiritually." },
  'sf.nina.t1': { who: 'nina', en: "They offered to buy the station. They said community radio like it was a disease. I said no. I'm not even allowed to sign things. Ha." },
  'sf.nina.t2': { who: 'nina', en: "Everybody's nice to me and nobody tells me anything. It's like being a ghost with a curfew." },
  'sf.nina.t3': { who: 'nina', en: "I want to go to Seattle and make radio a million people hear. And I want to stay here and make radio my mom hears. Pick one, apparently." },
  'sf.nina.t4': { who: 'nina', en: "She cries at dog food commercials. She'd arrest me for telling you that. She's scared all the time, and she's never once said so." },
  'sf.nina.gift1': { who: 'nina', en: "Chocolate! Oh my God. You have no idea. The vending machine here has been empty since August.", emo: 'laugh' },
  'sf.nina.gift2': { who: 'nina', en: "For the station? We accept all donations. Except polka records. We have enough polka records." },
  'sf.nina.gift3': { who: 'nina', en: "Flowers? Is this a date? Because my mom has a gun. A big one. I'll put them in a cup. A friendly cup.", emo: 'surprise' },
  'sf.nina.q1': { who: 'nina', en: "The transmitter mast is falling apart. If we could reach Nome, the Nome station said they'd take me as an intern next summer. A real one. With a lanyard." },
  'sf.nina.q2': { who: 'nina', en: "You fixed it! Okay. Step two. I need a demo tape. An interview with someone amazing. Grandma Ruth. Could you take my recorder to her? She likes you.", emo: 'smile' },
  'sf.nina.q3': { who: 'nina', en: "She talked for forty minutes. Forty! There's a part where she yells at the mayor. This is the best tape I've ever made.", emo: 'laugh' },
  'sf.nina.q4': { who: 'nina', en: "The letter from Seattle came. It's at the post office. I can't pick it up. If it's a no, I'll die. If it's a yes, I have to tell Mom. Get it for me?", emo: 'worry' },
  'sf.nina.q5': { who: 'nina', en: "It's a yes. It's a yes! Oh no. It's a yes. I have to tell Mom. Tonight. Before I lose my nerve. Wish me luck.", emo: 'surprise' },
  'sf.nina.q6': { who: 'nina', en: "I told her. She didn't say anything for a whole minute. Then she said, pack warm. That's Mom for I'm proud of you. Tonight's last song is for you, carpenter.", emo: 'smile' },
  'sf.pearl.nina': { who: 'pearl', en: "The envelope from Seattle, for Nina? Here. I did not read it. It's an acceptance. Don't tell her I didn't read it." },
  'sf.marta.nina': { who: 'marta', en: "Nina told me you helped her. With the letter. Thank you. Don't make it a thing." },
  'sf.n.nina': { who: 'nadia', ru: 'Осторожно с ней. Её мать — начальник полиции. Хотя девочка хорошая.', en: "Careful with her. Her mother is the police chief. Though she's a good kid." },

  // ================================================================ Tommy
  'sf.tommy.g0': { who: 'tommy', en: "Hey! You're the new carpenter. I'm Tommy. I fix engines, you fix houses. Between us we could fix the whole town.", emo: 'smile' },
  'sf.tommy.g1': { who: 'tommy', en: "Hey, it's you! Want to see what I did to the carburettor? It's illegal in three states.", emo: 'laugh' },
  'sf.tommy.g2': { who: 'tommy', en: "There's my racing partner! Grab a wrench. Kidding. Unless you want to.", emo: 'smile' },
  'sf.tommy.t0': { who: 'tommy', en: "Small engines, outboards, snowmachines, and Hank's truck four times a week. Hank calls me the kid. I'm twenty-four. I'll be the kid till I'm fifty." },
  'sf.tommy.t1': { who: 'tommy', en: "Their security guys ride brand-new sleds. Factory fresh. And they ride them like grocery carts. It physically hurts me to watch." },
  'sf.tommy.t2': { who: 'tommy', en: "Loon Lake, three miles of ice, no rules except don't die. Best feeling in the world. Better than food. Don't tell Grandma I said that either.", emo: 'laugh' },
  'sf.tommy.t3': { who: 'tommy', en: "Mom's in Anchorage, she calls on birthdays. Dad's around. Sort of. Grandma raised me. She says I've got Grandpa's hands and Dad's sense. That's not a compliment." },
  'sf.tommy.t4': { who: 'tommy', en: "Honestly? My own shop. Aqpik Engines, right here on Front Street. A sign with lights, like Dolly's. Fixing stuff for people I know.", emo: 'smile' },
  'sf.tommy.gift1': { who: 'tommy', en: "Pie! Grandma never lets me have pie in training. I'm not in training. I'm never in training. Thank you!", emo: 'laugh' },
  'sf.tommy.gift2': { who: 'tommy', en: "For me? Sweet. I'll eat it out on the ice. Everything tastes better on the ice." },
  'sf.tommy.gift3': { who: 'tommy', en: "Tea? That's Grandma's thing. If I drink tea, I'll start telling people to sit up straight." },
  'sf.tommy.q1': { who: 'tommy', en: "You ever race a snowmachine? Loon Lake, up the Lake Trail. I'll lend you the yellow one. It's slow, but it's honest.", emo: 'smile' },
  'sf.tommy.race1': { who: 'tommy', en: "Three laps, flags on the ice. Stay off the dark patches, that's open water under there. Ready? Go!" },
  'sf.tommy.win': { who: 'tommy', en: "You beat me? On the yellow one? Okay. Okay. I demand a rematch.", emo: 'surprise' },
  'sf.tommy.lose': { who: 'tommy', en: "Not bad for a carpenter! You hit every bump on the lake, but you hit them with style.", emo: 'laugh' },
  'sf.tommy.q2': { who: 'tommy', en: "My race engine blew a gasket on that last lap. I need wire and pipe fittings from Hank's. Help me rebuild it, and next race, we fly." },
  'sf.tommy.fix': { who: 'tommy', en: "Listen to her. Listen! That's the sound of Northstar's security guys losing.", emo: 'laugh' },
  'sf.tommy.race2': { who: 'tommy', en: "Race two. She's got more power now, and so does yours. I tuned it while you weren't looking. Go!" },
  'sf.tommy.q3': { who: 'tommy', en: "The Loon Lake Cup. Tomorrow night. Northstar's guys signed up with six brand-new sleds. Let's beat them with junk.", emo: 'smile' },
  'sf.tommy.race3': { who: 'tommy', en: "This is it. Lights on the ice, half the town on the shore. Grandma's here. She's pretending she isn't. Go, go, go!" },
  'sf.tommy.champ': { who: 'tommy', en: "We won! We beat the shiny sleds with junk and duct tape! This trophy is going on Grandma's mantel, and she can't stop me.", emo: 'laugh' },
  'sf.tommy.lose3': { who: 'tommy', en: "We didn't win. But we beat four of their six, with junk! Next year, the Cup is ours.", emo: 'smile' },
  'sf.g.race': { who: 'grisha', ru: 'Снегоход! Газу, газу! Что ты как на похоронах?', en: 'A snowmobile! Throttle, throttle! What is this, a funeral?', emo: 'laugh' },

  // ================================================================ Lou
  'sf.lou.g0': { who: 'lou', en: "Welcome to the Anchor. Beer's cold, stove's hot, and the darts are mine. What'll it be?" },
  'sf.lou.g1': { who: 'lou', en: "Hey, carpenter. The usual? You don't have a usual yet. I'll give you one.", emo: 'smile' },
  'sf.lou.g2': { who: 'lou', en: "There's my favourite regular who isn't a regular. Sit. First one's on me. Second one's on you.", emo: 'smile' },
  'sf.lou.t0': { who: 'lou', en: "Every night's busy in November. Nothing to do but drink, play darts and tell lies about fish. I allow all three." },
  'sf.lou.t1': { who: 'lou', en: "Their guys come in, order club soda, sit facing the door, and tip exactly fifteen percent. Nobody tips exactly fifteen percent. That's a machine." },
  'sf.lou.t2': { who: 'lou', en: "My dad ran it for thirty years. I was in Anchorage, doing the books for an oil company. He got sick. I came home for a month. That was nineteen years ago." },
  'sf.lou.t3': { who: 'lou', en: "Dad. Every night after closing, a hundred throws. He said if your hands are busy, your heart can't get into trouble. Turns out that's half true." },
  'sf.lou.t4': { who: 'lou', en: "Nobody, and I like it that way. Okay. Dolly brings me soup when I'm sick. Hank fixes my furnace and pretends it's an accident. Don't tell them I noticed.", emo: 'smile' },
  'sf.lou.gift1': { who: 'lou', en: "Smoked salmon? The good stuff? This is going behind the bar for the regulars. Well. Half of it is.", emo: 'smile' },
  'sf.lou.gift2': { who: 'lou', en: "Thanks, hon. You're sweet. Don't let it get around. It's bad for the bar's reputation." },
  'sf.lou.gift3': { who: 'lou', en: "Whiskey. You brought whiskey. To a bar. You know I sell this, right? I'll put it on the shelf and charge you for it.", emo: 'laugh' },
  'sf.lou.q1': { who: 'lou', en: "You throw? House rules. One game. You win, your drinks are on me tonight. You lose, you buy Ray a soda. He needs it." },
  'sf.lou.dwin': { who: 'lou', en: "Well, I'll be. You beat me. Don't let it go to your head. Actually, let it. It's a nice feeling, and you won't get it twice.", emo: 'surprise' },
  'sf.lou.dlose': { who: 'lou', en: "Bullseye. Thank you, thank you. Don't feel bad. Nobody beats me. Dad never did, and he taught me.", emo: 'smile' },
  'sf.lou.trivia': { who: 'lou', en: "Trivia night! Three questions, local knowledge only. Win, and there's fifty bucks in it. Lose, and you clean the dartboard." },
  'sf.lou.tq1': { who: 'lou', en: "Question one. What year did old Grigory Koshkin open his store on the square?" },
  'sf.lou.tq2': { who: 'lou', en: "Question two. What's the name of Wade Tolliver's helicopter?" },
  'sf.lou.tq3': { who: 'lou', en: "Question three. How many buckets were catching drips on the school gym floor?" },
  'sf.lou.right': { who: 'lou', en: "That's right!", emo: 'smile' },
  'sf.lou.wrong': { who: 'lou', en: "Ooh. No." },
  'sf.lou.twin': { who: 'lou', en: "Three for three? Somebody's been listening. Fifty bucks and the trivia crown. It's a cardboard crown. Wear it with pride.", emo: 'laugh' },
  'sf.lou.tmid': { who: 'lou', en: "Not bad for an outsider. A round on the house, and a little respect. The respect's worth more." },
  'sf.lou.q3': { who: 'lou', en: "Once a year, the Anchor Cup. Me against whoever's brave. You're brave. Or dumb. Same thing in here. Tomorrow night, nine o'clock." },
  'sf.lou.cupwin': { who: 'lou', en: "You beat me. For the Cup. Nineteen years. Ray, write it on the board. In pen. Fine. Congratulations. I mean it.", emo: 'surprise' },
  'sf.lou.cuplose': { who: 'lou', en: "The Cup stays with me. But you made me sweat, and nobody's made me sweat since Dad. Same time next year.", emo: 'smile' },

  // ================================================================ Doc Ellen
  'sf.ellen.g0': { who: 'ellen', en: "Hello. You're the carpenter. You look healthy. Keep it that way. I'm busy." },
  'sf.ellen.g1': { who: 'ellen', en: "Ah, my favourite patient who's never been sick. Come in. Tell me about the birds you've seen.", emo: 'smile' },
  'sf.ellen.g2': { who: 'ellen', en: "There you are. I've got coffee, a bad back and twenty minutes. You can have all three.", emo: 'smile' },
  'sf.ellen.t0': { who: 'ellen', en: "One doctor, two nurses, eleven hundred patients. Frostbite, fishhooks and broken hearts. The hearts take the longest." },
  'sf.ellen.t1': { who: 'ellen', en: "Their people at the Dome have their own doctor. A whole clinic, for a dozen people. Nobody needs that much medicine unless they're expecting something.", emo: 'serious' },
  'sf.ellen.t2': { who: 'ellen', en: "Because they come back. Every spring, from Antarctica, from Mexico, they come back here. To this cold rock. I find that very reassuring." },
  'sf.ellen.t3': { who: 'ellen', en: "Boston, thirty years ago. A one-year contract. I came for the money and stayed for the ravens. And the people. Mostly the ravens.", emo: 'smile' },
  'sf.ellen.t4': { who: 'ellen', en: "That I'm sixty and there's nobody to hand this to. When I go, the nearest doctor is a plane ride away. That's not a clinic. That's a prayer.", emo: 'worry' },
  'sf.ellen.gift1': { who: 'ellen', en: "Film! For my old Nikon! Oh, I could kiss you. Medically speaking, I won't. But I could.", emo: 'laugh' },
  'sf.ellen.gift2': { who: 'ellen', en: "That's very kind. I'll prescribe it to myself at once." },
  'sf.ellen.gift3': { who: 'ellen', en: "Whiskey. I'm the town doctor. I've seen what that does to a liver. I've seen it in jars." },
  'sf.ellen.q1': { who: 'ellen', en: "My supply order from Anchorage is sitting at the airstrip. The freight bill got lost. Northstar offered to supply us instead. In exchange for our patient records. No.", emo: 'frown' },
  'sf.ellen.q2': { who: 'ellen', en: "Wade's holding the crate, but I can't leave the clinic. Could you bring it? Insulin, bandages, antibiotics. It's heavy. Lift with your knees." },
  'sf.ellen.q3': { who: 'ellen', en: "Bless you. And bless Wade, I know he paid that bill. I'll pretend I don't. Here, take this first-aid kit. You do dangerous work. Carpentry, I mean.", emo: 'smile' },
  'sf.ellen.q4': { who: 'ellen', en: "An ivory gull's been seen off the harbour. An ivory gull! Meet me at the boardwalk tomorrow at eleven. That's dawn, up here, in November.", emo: 'surprise' },
  'sf.ellen.q5': { who: 'ellen', en: "There. On the ice, by the third piling. White as paper. Don't move. Don't breathe." },
  'sf.ellen.q6': { who: 'ellen', en: "Thirty years. Thirty years I've waited to see one. And I saw it with you. Thank you, my dear.", emo: 'smile' },
  'sf.ellen.q6b': { who: 'ellen', en: "It flew. That's all right. We saw it. Most people never see one at all." },
  'sf.ellen.q7': { who: 'ellen', en: "You rebuilt my blind. Come by any morning. Bring nothing, say nothing. That's the best company there is.", emo: 'smile' },

  // ================================================================ Pearl
  'sf.pearl.g0': { who: 'pearl', en: "Pearl Jessup, postmaster. Stamps, parcels and federal law. I know who you are. Everybody does." },
  'sf.pearl.g1': { who: 'pearl', en: "Oh, it's you! Come in, come in. I've got news. I'm not supposed to have news. I have news.", emo: 'smile' },
  'sf.pearl.g2': { who: 'pearl', en: "My favourite customer. You never mail anything, which makes you a mystery. I love a mystery.", emo: 'smile' },
  'sf.pearl.t0': { who: 'pearl', en: "The Petrov sisters are feuding over a pie dish from nineteen ninety-one. The mayor ordered a hot tub. Don't tell anyone I told you. I tell everyone." },
  'sf.pearl.t1': { who: 'pearl', en: "They don't send postcards. Not one. Everything goes up that hill in sealed crates on Wade's plane. Who doesn't send postcards?" },
  'sf.pearl.t2': { who: 'pearl', en: "Thirty-eight years. I've delivered every birth announcement, divorce paper and love letter in this town. I've read most of them. Federally, I haven't." },
  'sf.pearl.t3': { who: 'pearl', en: "Every week, to my sister in Biloxi. She never writes back. That's fine. Somebody has to send the news south." },
  'sf.pearl.t4': { who: 'pearl', en: "Because nobody looks at the post office lady. You'd be amazed what people say in front of a woman weighing a parcel.", emo: 'smile' },
  'sf.pearl.gift1': { who: 'pearl', en: "Chocolate! The good kind! Oh, you've done it now. I'll tell you something I shouldn't. Later. Maybe.", emo: 'laugh' },
  'sf.pearl.gift2': { who: 'pearl', en: "For me? Aren't you a dear. It's going right on the counter, where Lyle Pruitt can see it and be jealous." },
  'sf.pearl.gift3': { who: 'pearl', en: "Fish? In a federal building? This post office is going to smell like a harbour till Easter.", emo: 'frown' },
  'sf.pearl.q1': { who: 'pearl', en: "My carrier hurt his back on those steps, so I've got three parcels going nowhere. Ruth, Hank and Father Gabriel. Would you? I'll make it worth your while. In information." },
  'sf.pearl.q2': { who: 'pearl', en: "Here's your pay, dear. Gideon Shaw gets a thick letter every Thursday from a post office box in Zug, Switzerland. Who writes letters any more? Rich people and spies." },
  'sf.pearl.q3': { who: 'pearl', en: "Something else. The mayor used to get pink envelopes from a bank in Anchorage. Overdue notices, every month. Then in June they stopped. All at once. Isn't that funny?" },
  'sf.pearl.q4': { who: 'pearl', en: "A man in a grey parka asked me about your mail. Government haircut, government shoes. I told him federal law says I can't discuss anybody's mail. Then I sold him stamps.", emo: 'serious' },
  'sf.pearl.q5': { who: 'pearl', en: "Here. The key to box ninety-nine. It's been empty since nineteen ninety. Whatever mail you get, or don't get, goes in there, and I never saw it." },
  'sf.n.pearl1': { who: 'nadia', ru: 'Цуг? Это Швейцария. Подставные фирмы. Иван проверит. Отличная работа.', en: "Zug? That's Switzerland. Shell companies. Ivan will check. Excellent work." },
  'sf.n.pearl2': { who: 'nadia', ru: 'Июнь. Как раз когда пришёл «Нордстар». Мэр у них в долгу. Запомним.', en: "June. Right when Northstar arrived. The mayor's in their debt. We'll remember that.", emo: 'serious' },
  'sf.n.pearl3': { who: 'nadia', ru: 'Человек в сером. Опять он. Будь осторожнее с почтой.', en: 'The man in grey. Him again. Be careful with your mail.', emo: 'worry' },
  'sf.n.pearl4': { who: 'nadia', ru: 'Свой абонентский ящик? Для тайников лучше не придумаешь.', en: "A post office box of your own? For dead drops, you couldn't ask for better.", emo: 'smile' },

  // ================================================================ Chief Marta
  'sf.marta.g0': { who: 'marta', en: "Carpenter. Staying out of trouble?" },
  'sf.marta.g1': { who: 'marta', en: "Evening. You're still here. That's either good news or a long story." },
  'sf.marta.g2': { who: 'marta', en: "Hey. Sit down a minute. Off the record, I'm glad you're around.", emo: 'smile' },
  'sf.marta.t0': { who: 'marta', en: "Two drunks, one loose dog and a moose in the school parking lot. The moose was the most reasonable of the four." },
  'sf.marta.t1': { who: 'marta', en: "Their cameras don't report to me. Their security doesn't report to me. In my town. You can guess what I think.", emo: 'frown' },
  'sf.marta.t2': { who: 'marta', en: "My dad was a trooper in Bethel. He used to say the badge doesn't make you right. It makes you responsible. Different thing." },
  'sf.marta.t3': { who: 'marta', en: "She's smarter than me, and she broadcasts it to the whole town. Literally. Every night. I listen in the patrol car.", emo: 'smile' },
  'sf.marta.t4': { who: 'marta', en: "I trust that you fix things and you don't lie to old people. That's more than I can say for most of City Hall. The rest, I'm still working on.", emo: 'serious' },
  'sf.marta.gift1': { who: 'marta', en: "Coffee. Good coffee. Is this a bribe? It's a good bribe. Accepted. Don't tell anybody.", emo: 'smile' },
  'sf.marta.gift2': { who: 'marta', en: "That's kind. I'll put it in the break room, so it doesn't look like I'm taking gifts. Which I am." },
  'sf.marta.gift3': { who: 'marta', en: "I can't take that. I'm on duty. I'm always on duty." },
  'sf.marta.q1': { who: 'marta', en: "Our station's radio repeater keeps dropping out. Northstar offered to upgrade it, free. I'd rather talk through two cans and a string. Can you fix it?" },
  'sf.marta.q2': { who: 'marta', en: "It works. Clear as a bell. Huh. You fixed my radio and didn't ask for anything. I'll remember that. I remember everything, by the way." },
  'sf.marta.q3': { who: 'marta', en: "Off the record. Northstar security has no authority in this town. None. If their people stop you at night, don't argue. Call me. Here's my direct line.", emo: 'serious' },
  'sf.marta.q4': { who: 'marta', en: "I ran your name. Anchorage has a record of you. Clean. Very clean. Like someone made it yesterday. I'm not going to do anything about it. Don't make me regret that.", emo: 'serious' },
  'sf.n.marta': { who: 'nadia', ru: 'Она проверяла документы. Иван, слышишь?', en: 'She checked the papers. Ivan, are you hearing this?', emo: 'worry' },
  'sf.i.marta': { who: 'ivan', ru: '…Слышу. Документы хорошие.', en: '…I hear. The papers are good.' },

  // ================================================================ Evan
  'sf.evan.g0': { who: 'evan', en: "Good evening, and welcome back! It's always so nice to see you. Always.", emo: 'smile' },
  'sf.evan.g1': { who: 'evan', en: "Hey, buddy! Your usual? I know your usual. I know everybody's usual. It's my job! Ha.", emo: 'smile' },
  'sf.evan.g2': { who: 'evan', en: "Oh. It's you. Good. I mean, hi! Welcome to Northstar Twenty-Four." },
  'sf.evan.t0': { who: 'evan', en: "Wonderful! Every day, more neighbours discover the Northstar difference. Lower prices. Brighter lights. And we remember your birthday. Not in a weird way.", emo: 'smile' },
  'sf.evan.t1': { who: 'evan', en: "Sleep? Ha. We're open twenty-four hours! Somebody has to be here. And it's me. It's always me. I don't mind. I don't mind.", emo: 'smile' },
  'sf.evan.t2': { who: 'evan', en: "Spokane. I won a regional sales award, and the prize was a promotion. Here. They said it was an honour. I still have the plaque. It's in the stockroom." },
  'sf.evan.t3': { who: 'evan', en: "I love it. Mr. Halloran says we're building the future. He says it in a very calm voice. He's always calm. Have you ever met someone who's always calm? It's a lot.", emo: 'worry' },
  'sf.evan.t4': { who: 'evan', en: "Can I tell you something? The cameras in here record to the Dome. All of them. Except the one in the stockroom. It's broken. I broke it. I like one room where nobody's watching.", emo: 'worry' },
  'sf.evan.gift': { who: 'evan', en: "For me? Oh wow. Nobody gives me things. People take things. From the shelves. And pay. Thank you. I'm going to log this. I mean, love this.", emo: 'smile' },
  'sf.evan.q1': { who: 'evan', en: "Have you joined our loyalty program? Ten percent off everything. And we'll know your favourite snacks before you do! Isn't that nice?", emo: 'smile' },
  'sf.evan.q1a': { who: 'evan', en: "Wonderful! Welcome to the family. The Northstar family. It's a big family. It's very interested in you.", emo: 'smile' },
  'sf.evan.q1b': { who: 'evan', en: "No problem! Totally optional. Everybody signs up eventually. That's not a threat. It's statistics.", emo: 'smile' },
  'sf.evan.q2': { who: 'evan', en: "Do you ever think about leaving? I think about it. I can't. My contract has a clause. Mr. Halloran is very particular about clauses.", emo: 'worry' },
  'sf.evan.q3': { who: 'evan', en: "If something happened up on the hill. Hypothetically. I'd want to be somewhere else. Far away. Do you know anyone with a boat? Forget I asked. Please forget I asked.", emo: 'worry' },
  'sf.n.evan': { who: 'nadia', ru: 'Он боится Хэллорана. Испуганный человек опасен. Но и полезен.', en: "He's afraid of Halloran. A frightened man is dangerous. But useful.", emo: 'serious' },
  'sf.l.evan': { who: 'lyosha', ru: 'Слепая зона в подсобке? Запомни. Пригодится.', en: "A blind spot in the stockroom? Remember that. It'll come in handy." },

  // ================================================================ Mayor Walt, Gideon Shaw, Halloran, Mr. Grey
  'sf.walt.g0': { who: 'walt', en: "Walt Hennessey, mayor. Don't hold it against me. Nobody else wanted the job." },
  'sf.walt.g1': { who: 'walt', en: "Well, if it isn't the fixer. Folks are talking you up. That's dangerous in a small town. Next thing you know, they make you mayor.", emo: 'smile' },
  'sf.walt.t0': { who: 'walt', en: "Ask me in spring. In winter, the answer's always the same. Cold, broke, and still here." },
  'sf.walt.t1': { who: 'walt', en: "Northstar's been good to Port Zarya. That's what I say. I say it a lot. Some days it even sounds true." },
  'sf.walt.t2': { who: 'walt', en: "Because I owe people, friend. A mayor who owes people is just a man with a nice office and no door.", emo: 'frown' },
  'sf.walt.gift1': { who: 'walt', en: "Dolly's pie? You're a good person. I'm going to eat this whole thing in my office with the door closed.", emo: 'laugh' },
  'sf.walt.gift2': { who: 'walt', en: "Well, thank you. I'm not supposed to accept gifts. But I'm also not supposed to be rude." },
  'sf.gideon.g0': { who: 'gideon', en: "Can I help you? I have three minutes." },
  'sf.gideon.g1': { who: 'gideon', en: "You again. You're becoming a fixture. Fixtures can be removed." },
  'sf.gideon.t0': { who: 'gideon', en: "I manage the city. Budgets, permits, contracts. The things people never think about, until someone else has decided them." },
  'sf.gideon.t1': { who: 'gideon', en: "Port Zarya is a fine town with a fine future. Its future simply arrived before it was ready." },
  'sf.gideon.t2': { who: 'gideon', en: "I relax by making sure nothing surprises me. You, for instance, surprised me. I've relaxed less this month." },
  'sf.gideon.gift': { who: 'gideon', en: "I don't accept gifts. Ethics policy. Northstar's, not the city's. Theirs is stricter." },
  'sf.halloran.g0': { who: 'halloran', en: "We haven't been introduced. I know who you are, of course. I make a point of knowing who fixes things." },
  'sf.halloran.t0': { who: 'halloran', en: "Nothing it doesn't already want for itself. Quiet. Warmth. A future. I simply intend to deliver it on schedule." },
  'sf.halloran.t1': { who: 'halloran', en: "I like the cold. It's honest. It tells you exactly how long you'll last." },
  'sf.halloran.gift': { who: 'halloran', en: "Keep it. You'll need everything you have." },
  'sf.okafor.g0': { who: 'okafor', en: "Afternoon. Cold one." },
  'sf.okafor.g1': { who: 'okafor', en: "Agent Okafor. You can still call me Mr. Grey. Everybody else does, behind my back." },
  'sf.okafor.t0': { who: 'okafor', en: "You don't. That's fine. Most people don't." },
  'sf.okafor.t1': { who: 'okafor', en: "Small town. I take walks. We keep walking into each other. You could try being less interesting." },
  'sf.okafor.t2': { who: 'okafor', en: "Slow, careful, and none of your business. Which means it's going fine. Stay out of my way, and I'll stay out of yours. Mostly." },
  'sf.okafor.t3': { who: 'okafor', en: "My wife bought it. Said it made me look approachable. Fourteen years in the Bureau, and nobody has ever approached me." },
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
const SHARE_IDS = ['dolly', 'hank', 'ruth', 'ray', 'lyle'];
const CARD_EARS = ['sf.n.card1', 'sf.n.card2', 'sf.d.card3', 'sf.v.card4', 'sf.l.card5'];
const num = (v) => Number(v) || 0;                       // flags may hold a day number (or just true)
/** Does the player know what the continuity cards are? (day 4 story; a late safety net so nothing dead-ends) */
export const knowsShares = (s) => !!(s.flags || {}).knowsShares || (s.day || 1) >= 8;
const cardReady = (s, id) => knowsShares(s) && SIDE.level(s, id) >= 4;
/** A card counts as yours by flag share.<id> or state.shares[id] (the story may use either). */
const hasShare = (s, id) => !!(s.flags || {})['share.' + id] || !!(s.shares || {})[id];
const opened = (c, id) => c.has(`q.${id}.open`) || c.day >= 6;
const beside = (G, dx = 1.8, dz = 1.2) => ({ x: (G.player?.pos?.x || 0) + dx, z: (G.player?.pos?.z || 0) + dz });
const ear = (c, line) => c.G.missions?.ear?.(line);

async function giveCard(c, id, line) {
  await c.say(id, line);
  c.flag('share.' + id, true);
  (c.state.shares ||= {})[id] = true;
  c.give('continuity_card');
  c.standing(2);
  const n = SHARE_IDS.filter((k) => hasShare(c.state, k)).length;
  c.G.hud?.toast?.('CONTINUITY CARD', `${CAST[id].short}'s card · ${n} of 5`, '#ffd166');
  c.emit('share:' + id);
  ear(c, CARD_EARS[Math.max(0, Math.min(4, n - 1))]);
}

/** Quest topics: QT[npc] = [(c) => false | { label, run(c) }]. */
const QT = {};
const topic = (npc, fn) => { (QT[npc] ||= []).push(fn); };

// Quests whose mission should be running once their first step is taken.
const QUEST_GO = {
  'sf.dolly': 'sf.dolly.go', 'sf.hank': 'sf.hank.go', 'sf.ruth': 'sf.ruth.go', 'sf.ray': 'sf.ray.go', 'sf.lyle': 'sf.lyle.go',
  'sf.gabriel': 'sf.gabriel.chess1', 'sf.nina': 'sf.nina.go', 'sf.tommy': 'sf.tommy.go', 'sf.lou': 'sf.lou.go', 'sf.wade': 'sf.wade.go',
  'sf.ellen': 'sf.ellen.go', 'sf.pearl': 'sf.pearl.go', 'sf.marta': 'sf.marta.go', 'sf.evan': 'sf.evan.s1',
};

// ================================================================== quest topics
// ---- Dolly: the Northstar loan, Earl's recipe box, Chowder Night
topic('dolly', (c) => opened(c, 'dolly') && !c.has('sf.dolly.go') && {
  label: c.has('q.dolly.open') ? "You said you'd tell me the rest." : 'You look worried, Dolly.',
  run: async (c) => {
    await c.say('dolly', 'sf.dolly.q1');
    await c.say('dolly', 'sf.dolly.q2');
    const k = await c.choose(["I'll open Earl's workshop for you.", "I'm sorry, Dolly. That's a lot."]);
    if (k !== 0) { c.rel(2); return; }
    await c.say('dolly', 'sf.dolly.q3');
    c.flag('sf.dolly.go', true);
    c.flag('sf.dolly.shed', true);
    c.rel(5);
    c.start('sf.dolly');
    ear(c, 'sf.n.dolly');
  },
});
topic('dolly', (c) => c.has('sf.dolly.go') && c.hasItem('recipe_box') && !c.has('sf.dolly.gave') && {
  label: "I found Earl's recipe box.",
  run: async (c) => {
    c.take('recipe_box');
    await c.say('dolly', 'sf.dolly.q4');
    await c.say('dolly', 'sf.dolly.q5');
    c.flag('sf.dolly.gave', c.day);
    c.flag('sf.dolly.freezer', true);
    c.rel(10);
  },
});
topic('dolly', (c) => c.has('sf.dolly.gave') && (c.state.repairs || {})['r.dolly.freezer'] && !c.has('sf.dolly.word') && {
  label: "Earl's freezer is running again.",
  run: async (c) => { await c.say('dolly', 'sf.dolly.q6'); c.flag('sf.dolly.word', c.day); c.rel(6); },
});
topic('dolly', (c) => c.has('sf.dolly.feast') && !hasShare(c.state, 'dolly') && cardReady(c.state, 'dolly') && {
  label: 'Dolly… that card Northstar had the council sign.',
  run: (c) => giveCard(c, 'dolly', 'sf.dolly.card'),
});
for (const [who, line] of [['pearl', 'sf.pearl.chowder'], ['nina', 'sf.nina.chowder'], ['gabriel', 'sf.gabriel.chowder']]) {
  topic(who, (c) => c.has('sf.dolly.word') && !c.has('sf.dolly.w.' + who) && {
    label: "Dolly's throwing a Chowder Night.",
    run: async (c) => { await c.say(who, line); c.flag('sf.dolly.w.' + who, true); c.rel(2); },
  });
}

// ---- Hank: the fuel-price fight, Danny in Anchorage
topic('hank', (c) => opened(c, 'hank') && !c.has('sf.hank.go') && {
  label: c.has('q.hank.open') ? "So. What stinks, Hank?" : 'Business looks slow, Hank.',
  run: async (c) => {
    await c.say('hank', 'sf.hank.q1');
    await c.say('hank', 'sf.hank.q2');
    const k = await c.choose(["I'll get you a look at those tickets.", 'Not my fight, Hank.']);
    if (k !== 0) { c.rel(1); return; }
    c.flag('sf.hank.go', true);
    c.rel(5);
    c.start('sf.hank');
  },
});
topic('hank', (c) => c.has('sf.hank.tickets') && !c.has('sf.hank.proof') && {
  label: 'I photographed the barge tickets.',
  run: async (c) => {
    await c.say('hank', 'sf.hank.q3');
    await c.say('hank', 'sf.hank.q3b');
    c.flag('sf.hank.proof', c.day);
    c.flag('sf.hank.pumpAsk', true);
    c.rel(10);
    c.standing(2);
  },
});
topic('hank', (c) => c.has('sf.hank.pumpAsk') && (c.state.repairs || {})['r.hank.pump'] && !c.has('sf.hank.pumped') && {
  label: 'Your truck has a new fuel pump.',
  run: async (c) => { await c.say('hank', 'sf.hank.pump'); c.flag('sf.hank.pumped', c.day); c.rel(8); c.spirit(2); },
});
topic('hank', (c) => c.has('sf.hank.pumped') && !c.has('sf.hank.letter') && c.level >= 2 && c.day > num(c.flag('sf.hank.proof')) && {
  label: 'You seem far away today, Hank.',
  run: async (c) => {
    await c.say('hank', 'sf.hank.q4');
    const k = await c.choose(["Open it, Hank. Now. I'll wait.", 'Want me to read it to you?', 'None of my business.']);
    if (k === 2) { c.rel(1); return; }
    await c.say('hank', 'sf.hank.q5');
    await c.say('hank', 'sf.hank.q6');
    c.flag('sf.hank.letter', c.day);
    c.rel(8);
  },
});
topic('hank', (c) => c.has('sf.hank.number') && !c.has('sf.hank.called') && c.level >= 3 && {
  label: "Here. Danny's number. Call him.",
  run: async (c) => {
    await c.say('hank', 'sf.hank.q7');
    await c.say('hank', 'sf.hank.q8');
    c.flag('sf.hank.called', c.day);
    c.rel(15);
    c.spirit(3);
  },
});
topic('hank', (c) => c.has('sf.hank.called') && !hasShare(c.state, 'hank') && cardReady(c.state, 'hank') && {
  label: 'Hank… that continuity card Gideon had you sign.',
  run: (c) => giveCard(c, 'hank', 'sf.hank.card'),
});
topic('ray', (c) => c.has('sf.hank.go') && !c.has('sf.hank.ray') && !c.has('sf.hank.tickets') && {
  label: 'Hank wants a look at the Northstar barge tickets.',
  run: async (c) => { await c.say('ray', 'sf.ray.ticket'); c.flag('sf.hank.ray', true); },
});
topic('pearl', (c) => c.has('sf.hank.letter') && !c.has('sf.hank.number') && {
  label: 'Do you have a number for Danny Brubaker?',
  run: async (c) => { await c.say('pearl', 'sf.pearl.danny'); c.flag('sf.hank.number', true); c.rel(3); },
});

// ---- Ruth: the history album, the Russian school bell, Tommy
const PHOTOS = [
  { k: 'church', where: 'church.narthex', cap: 'The first liturgy, 1890' },
  { k: 'bar', where: 'bar', cap: 'Opening night at the Anchor, 1952' },
  { k: 'post', where: 'post.door', cap: 'The Russian school, 1904' },
  { k: 'cannery', where: 'cannery', cap: 'The cannery fleet, 1958' },
  { k: 'lighthouse', where: 'lighthouse', cap: 'Zarya Point light, first lit, 1903' },
];
const photosLeft = (f) => PHOTOS.filter((p) => !f['sf.ruth.ph.' + p.k]);
async function ruthAlbum(c) {
  await c.say('ruth', 'sf.ruth.q2a');
  await c.say('ruth', 'sf.ruth.q2');
  c.flag('sf.ruth.album', c.day);
}
topic('ruth', (c) => opened(c, 'ruth') && !c.has('sf.ruth.go') && {
  label: c.has('q.ruth.open') ? 'You said you had a project for me.' : 'What are you working on, Ruth?',
  run: async (c) => {
    await c.say('ruth', 'sf.ruth.q1');
    const dry = !!(c.state.repairs || {})['r.school.gym'];
    if (!dry) await c.say('ruth', 'sf.ruth.q1b');
    const k = await c.choose([dry ? "I'll help with the album." : "I'll fix the gym roof.", 'Maybe another time.']);
    if (k !== 0) { c.rel(1); return; }
    c.flag('sf.ruth.go', true);
    c.rel(5);
    c.start('sf.ruth');
    if (dry) await ruthAlbum(c);
  },
});
topic('ruth', (c) => c.has('sf.ruth.go') && (c.state.repairs || {})['r.school.gym'] && !c.has('sf.ruth.album') && {
  label: 'The gym roof is fixed, Ruth.',
  run: async (c) => { await ruthAlbum(c); c.rel(8); },
});
topic('ruth', (c) => c.has('sf.ruth.album') && !c.has('sf.ruth.photos') && PHOTOS.every((p) => c.has('sf.ruth.ph.' + p.k)) && {
  label: 'I found your photographs.',
  run: async (c) => {
    c.take('old_photo', 5);
    await c.say('ruth', 'sf.ruth.q3');
    await c.say('ruth', 'sf.ruth.q4');
    c.flag('sf.ruth.photos', c.day);
    c.rel(10);
  },
});
topic('ruth', (c) => c.has('sf.ruth.bellHung') && !c.has('sf.ruth.bellThanks') && {
  label: 'The old school bell is ringing again.',
  run: async (c) => { await c.say('ruth', 'sf.ruth.q5'); c.flag('sf.ruth.bellThanks', c.day); c.rel(12); },
});
topic('ruth', (c) => c.has('sf.ruth.bellThanks') && !c.has('sf.ruth.tommyAsk') && c.level >= 3 && c.day > num(c.flag('sf.ruth.bellThanks')) && {
  label: 'How is Tommy doing?',
  run: async (c) => { await c.say('ruth', 'sf.ruth.q6'); c.flag('sf.ruth.tommyAsk', c.day); },
});
topic('ruth', (c) => c.has('sf.ruth.tommy') && !c.has('sf.ruth.tommyDone') && {
  label: 'I talked to Tommy.',
  run: async (c) => { await c.say('ruth', 'sf.ruth.q7'); c.flag('sf.ruth.tommyDone', c.day); c.rel(10); },
});
topic('ruth', (c) => c.has('sf.ruth.tommyDone') && !hasShare(c.state, 'ruth') && cardReady(c.state, 'ruth') && {
  label: 'Ruth… the continuity card. Northstar wants it.',
  run: (c) => giveCard(c, 'ruth', 'sf.ruth.card'),
});
topic('gabriel', (c) => c.has('sf.ruth.photos') && !c.has('sf.ruth.bellok') && {
  label: "Ruth's looking for the old Russian school bell.",
  run: async (c) => { await c.say('gabriel', 'sf.gabriel.bell'); c.flag('sf.ruth.bellok', true); c.rel(3); },
});
topic('tommy', (c) => c.has('sf.ruth.tommyAsk') && !c.has('sf.ruth.tommy') && {
  label: "Your grandmother's worried about the Dome job.",
  run: async (c) => {
    await c.say('tommy', 'sf.tommy.dome');
    const k = await c.choose(['Stay. Race. Open your own shop someday.', "Take the money. It's your life."]);
    await c.say('tommy', k === 0 ? 'sf.tommy.dome2' : 'sf.tommy.dome3');
    c.flag('sf.ruth.tommy', true);
    c.flag('tommy.stays', true);
    c.rel(6);
  },
});

// ---- Ray: the layoffs, the bottle, Kayla
topic('ray', (c) => opened(c, 'ray') && !c.has('sf.ray.go') && {
  label: 'Rough day, Ray?',
  run: async (c) => {
    await c.say('ray', 'sf.ray.q1');
    await c.say('ray', 'sf.ray.q2');
    const k = await c.choose(["I'll fix that porch roof before she comes.", 'Hang in there, Ray.']);
    if (k !== 0) { c.rel(1); return; }
    await c.say('ray', 'sf.ray.q3');
    c.flag('sf.ray.go', true);
    c.rel(5);
    c.start('sf.ray');
  },
});
topic('ray', (c) => c.has('sf.ray.go') && (c.state.repairs || {})['r.house.ray'] && !c.has('sf.ray.ask') && c.level >= 2 && {
  label: 'Your porch roof is fixed, Ray.',
  run: async (c) => { await c.say('ray', 'sf.ray.q4'); c.flag('sf.ray.ask', c.day); c.rel(8); },
});
topic('ray', (c) => c.has('sf.ray.ask') && !c.has('sf.ray.saved') && c.day > num(c.flag('sf.ray.ask')) && c.hour >= 18 && {
  label: 'Ray. Darts. Now. Not the bottle.',
  run: async (c) => {
    await c.say('ray', 'sf.ray.q5');
    await c.say('lou', 'sf.lou.ray');
    c.flag('sf.ray.saved', c.day);
    c.rel(10);
    c.spirit(2);
  },
});
topic('ray', (c) => c.has('sf.ray.saved') && !c.has('sf.ray.kayla') && c.day > num(c.flag('sf.ray.saved')) && {
  label: "How was Kayla's visit?",
  run: async (c) => {
    await c.say('ray', 'sf.ray.q6');
    await c.say('ray', 'sf.ray.q7');
    c.flag('sf.ray.kayla', c.day);
    c.rel(10);
    c.standing(2);
  },
});
topic('ray', (c) => c.has('sf.ray.kayla') && !hasShare(c.state, 'ray') && cardReady(c.state, 'ray') && {
  label: 'Ray, about that card Northstar had you sign.',
  run: (c) => giveCard(c, 'ray', 'sf.ray.card'),
});

// ---- Lyle: the lock, the envelope, the Sinking Lots
topic('lyle', (c) => opened(c, 'lyle') && !c.has('sf.lyle.go') && {
  label: "You look like you haven't slept, Lyle.",
  run: async (c) => {
    await c.say('lyle', 'sf.lyle.q1');
    const k = await c.choose(["I'll put in a proper lock.", 'Not my business, Lyle.']);
    if (k !== 0) { c.rel(1); return; }
    await c.say('lyle', 'sf.lyle.q2');
    c.flag('sf.lyle.go', true);
    c.rel(4);
    c.start('sf.lyle');
  },
});
topic('lyle', (c) => c.has('sf.lyle.envelope') && !c.has('sf.lyle.confessed') && {
  label: 'Someone slipped this under your door, Lyle.',
  run: async (c) => {
    if (c.level < 2) { await c.say('lyle', 'sf.lyle.deny'); return; }
    await c.say('lyle', 'sf.lyle.q3');
    await c.say('lyle', 'sf.lyle.q4');
    c.flag('sf.lyle.confessed', c.day);
    c.rel(6);
  },
});
topic('lyle', (c) => c.has('sf.lyle.report') && !c.has('sf.lyle.outcome') && {
  label: "I took the survey out of Gideon's files.",
  run: async (c) => {
    const k = await c.choose([
      { label: "It's yours. Burn it. And pay for those families' foundations.", key: 'free' },
      { label: "I'll keep it. And you'll give me your continuity card.", key: 'dark', when: () => knowsShares(c.state) && !hasShare(c.state, 'lyle') },
      { label: 'Let me think about it.', key: 'wait' },
    ]);
    if (k === 'free') {
      c.take('survey');
      await c.say('lyle', 'sf.lyle.q5');
      c.flag('sf.lyle.outcome', 'freed');
      c.flag('lyle.freed', true);
      c.rel(30);
      c.standing(2);
      if (knowsShares(c.state) && !hasShare(c.state, 'lyle')) await giveCard(c, 'lyle', 'sf.lyle.card');
      else await c.say('lyle', 'sf.lyle.free');
    } else if (k === 'dark') {
      c.flag('sf.lyle.outcome', 'squeezed');
      c.flag('lyle.squeezed', true);
      c.rel(-40);
      c.state.standing = (c.state.standing || 0) - 2;
      c.G.hud?.toast?.('STANDING', '−2', '#b98cff');
      c.attention(5);
      await giveCard(c, 'lyle', 'sf.lyle.dark');
    }
  },
});
topic('lyle', (c) => c.flag('sf.lyle.outcome') === 'freed' && !hasShare(c.state, 'lyle') && knowsShares(c.state) && {
  label: 'Lyle. That card Gideon had you sign.',
  run: (c) => giveCard(c, 'lyle', 'sf.lyle.card'),
});

// ---- Father Gabriel: chess, the Zarya chant, the icon
const PUZZLES = [
  { prompt: 'WHITE TO MOVE · HIS KING IS BOXED IN BEHIND THREE PAWNS', opts: ['Pawn to h3. Patience.', 'Rook to e8. Checkmate.', 'Queen to d2. Solid.'], right: 1 },
  { prompt: 'WHITE TO MOVE · HIS KING AND ROOK SIT ON THE SAME COLOUR', opts: ['Bishop takes f7, check.', 'Castle and wait.', 'Knight to e6, forking king and rook.'], right: 2 },
];
async function chess(c, n) {
  const P = PUZZLES[n];
  const k = await c.choose(P.opts, { prompt: P.prompt });
  const won = k === P.right;
  await c.say('gabriel', won ? 'sf.gabriel.win' : 'sf.gabriel.lose');
  if (won) c.flag('sf.gabriel.won' + n, true);
  c.rel(won ? 8 : 6);
}
topic('gabriel', (c) => c.level >= 1 && c.day >= 2 && !c.has('sf.gabriel.chess1') && {
  label: 'Fancy a game of chess, Father?',
  run: async (c) => {
    await c.say('gabriel', 'sf.gabriel.chess');
    await chess(c, 0);
    c.flag('sf.gabriel.chess1', c.day);
    c.start('sf.gabriel');
  },
});
topic('gabriel', (c) => c.has('sf.gabriel.chess1') && !c.has('sf.gabriel.hymn') && c.level >= 2 && c.day > num(c.flag('sf.gabriel.chess1')) && {
  label: 'Anything I can help with at the church?',
  run: async (c) => { await c.say('gabriel', 'sf.gabriel.hymn'); c.flag('sf.gabriel.hymn', c.day); },
});
topic('gabriel', (c) => c.has('sf.gabriel.studied') && !c.has('sf.gabriel.hymnGiven') && {
  label: 'A friend of mine remembered your chant.',
  run: async (c) => { await c.say('gabriel', 'sf.gabriel.hymn2'); c.flag('sf.gabriel.hymnGiven', c.day); c.rel(12); c.spirit(3); },
});
topic('gabriel', (c) => c.has('sf.gabriel.hymnGiven') && !c.has('sf.gabriel.icon') && c.level >= 3 && c.day > num(c.flag('sf.gabriel.hymnGiven')) && {
  label: 'Anything else need fixing, Father?',
  run: async (c) => { await c.say('gabriel', 'sf.gabriel.icon'); c.flag('sf.gabriel.icon', c.day); },
});
topic('gabriel', (c) => c.has('sf.gabriel.iconDone') && !c.has('sf.gabriel.iconThanks') && {
  label: 'The icon is clean, Father.',
  run: async (c) => { await c.say('gabriel', 'sf.gabriel.icon2'); c.flag('sf.gabriel.iconThanks', c.day); c.rel(12); },
});
topic('gabriel', (c) => c.has('sf.gabriel.iconThanks') && !c.has('sf.gabriel.chess2') && c.level >= 4 && {
  label: 'One more game, Father?',
  run: async (c) => {
    await c.say('gabriel', 'sf.gabriel.chess2');
    await chess(c, 1);
    c.flag('sf.gabriel.chess2', c.day);
    c.flag('sanctuary', true);
    c.give('church_key');
  },
});

// ---- Nina: the mast, the demo tape, the letter from Seattle
topic('nina', (c) => c.level >= 1 && c.day >= 3 && !c.has('sf.nina.go') && {
  label: "How's the signal these days?",
  run: async (c) => {
    if ((c.state.repairs || {})['r.kzry.mast']) {
      // the mast was already fixed from Pearl's board: straight to step two
      c.flag('sf.nina.go', true);
      c.start('sf.nina');
      await c.say('nina', 'sf.nina.q2');
      c.flag('sf.nina.tapeAsk', c.day);
      c.give('tape_recorder');
      c.rel(6);
      return;
    }
    await c.say('nina', 'sf.nina.q1');
    const k = await c.choose(["I'll fix the mast.", 'Sounds expensive.']);
    if (k !== 0) { c.rel(1); return; }
    c.flag('sf.nina.go', true);
    c.rel(5);
    c.start('sf.nina');
    ear(c, 'sf.n.nina');
  },
});
topic('nina', (c) => c.has('sf.nina.go') && (c.state.repairs || {})['r.kzry.mast'] && !c.has('sf.nina.tapeAsk') && {
  label: 'The mast is fixed.',
  run: async (c) => { await c.say('nina', 'sf.nina.q2'); c.flag('sf.nina.tapeAsk', c.day); c.give('tape_recorder'); c.rel(6); },
});
topic('nina', (c) => c.has('sf.nina.tapeDone') && !c.has('sf.nina.tapeBack') && {
  label: "Here's Ruth's interview.",
  run: async (c) => { c.take('tape_recorder'); await c.say('nina', 'sf.nina.q3'); c.flag('sf.nina.tapeBack', c.day); c.rel(10); },
});
topic('nina', (c) => c.has('sf.nina.tapeBack') && !c.has('sf.nina.letterAsk') && c.level >= 3 && c.day > num(c.flag('sf.nina.tapeBack')) && {
  label: 'Anything new, Nina?',
  run: async (c) => { await c.say('nina', 'sf.nina.q4'); c.flag('sf.nina.letterAsk', c.day); },
});
topic('nina', (c) => c.hasItem('seattle_letter') && !c.has('sf.nina.letterGiven') && {
  label: 'Pearl gave me your letter.',
  run: async (c) => { c.take('seattle_letter'); await c.say('nina', 'sf.nina.q5'); c.flag('sf.nina.letterGiven', c.day); c.rel(12); },
});
topic('nina', (c) => c.has('sf.nina.letterGiven') && !c.has('sf.nina.told') && c.day > num(c.flag('sf.nina.letterGiven')) && {
  label: 'Did you tell your mom?',
  run: async (c) => { await c.say('nina', 'sf.nina.q6'); c.flag('sf.nina.told', c.day); c.rel(10); c.spirit(2); },
});
topic('ruth', (c) => c.has('sf.nina.tapeAsk') && c.hasItem('tape_recorder') && !c.has('sf.nina.tapeDone') && {
  label: 'Nina asked me to record your story.',
  run: async (c) => { await c.say('ruth', 'sf.ruth.tape'); c.flag('sf.nina.tapeDone', true); c.rel(4); },
});
topic('pearl', (c) => c.has('sf.nina.letterAsk') && !c.hasItem('seattle_letter') && !c.has('sf.nina.letterGiven') && {
  label: 'Is there a letter from Seattle for Nina?',
  run: async (c) => { await c.say('pearl', 'sf.pearl.nina'); c.give('seattle_letter'); },
});
topic('marta', (c) => c.has('sf.nina.told') && !c.has('sf.marta.nina') && {
  label: 'Nina told you about Seattle?',
  run: async (c) => { await c.say('marta', 'sf.marta.nina'); c.flag('sf.marta.nina', true); c.rel(6); },
});

// ---- Tommy: Loon Lake
topic('tommy', (c) => c.level >= 1 && c.day >= 3 && !c.has('sf.tommy.go') && {
  label: 'Ever race on Loon Lake?',
  run: async (c) => {
    await c.say('tommy', 'sf.tommy.q1');
    const k = await c.choose(["I'm in.", 'Maybe later.']);
    if (k !== 0) return;
    c.flag('sf.tommy.go', true);
    c.rel(4);
    c.start('sf.tommy');
  },
});
topic('tommy', (c) => c.has('sf.tommy.r1') && !c.has('sf.tommy.eng') && c.level >= 2 && c.day > num(c.flag('sf.tommy.r1')) && {
  label: "How's your race engine?",
  run: async (c) => { await c.say('tommy', 'sf.tommy.q2'); c.flag('sf.tommy.eng', c.day); },
});
topic('tommy', (c) => c.has('sf.tommy.r2') && !c.has('sf.tommy.cup') && c.level >= 3 && c.day > num(c.flag('sf.tommy.r2')) && {
  label: 'Any more races coming up?',
  run: async (c) => { await c.say('tommy', 'sf.tommy.q3'); c.flag('sf.tommy.cup', c.day); },
});

// ---- Lou: darts, trivia night, the Anchor Cup
const TRIVIA = [
  { line: 'sf.lou.tq1', opts: ['Nineteen eleven.', 'Nineteen thirty-one.', 'Eighteen ninety-eight.'], right: 0 },
  { line: 'sf.lou.tq2', opts: ['Margie.', 'The Blue Goose.', 'Dragonfly.'], right: 2 },
  { line: 'sf.lou.tq3', opts: ['Seven.', 'Eleven.', 'Twenty.'], right: 1 },
];
// Wednesdays and Saturdays (day 3's trivia belongs to the day 3 story)
const triviaNight = (c) => (c.day % 7 === 3 || c.day % 7 === 6) && c.day !== 3 && c.hour >= 19;
topic('lou', (c) => c.level >= 1 && !c.has('sf.lou.go') && {
  label: 'Fancy a game of darts?',
  run: async (c) => {
    await c.say('lou', 'sf.lou.q1');
    const k = await c.choose(["You're on.", 'Some other time.']);
    if (k !== 0) return;
    c.flag('sf.lou.go', true);
    c.start('sf.lou');
    return 'end';
  },
});
topic('lou', (c) => c.has('sf.lou.darts') && !c.has('sf.lou.trivia') && triviaNight(c) && {
  label: 'Is it trivia night?',
  run: async (c) => {
    await c.say('lou', 'sf.lou.trivia');
    let score = 0;
    for (const q of TRIVIA) {
      await c.say('lou', q.line);
      const k = await c.choose(q.opts, { prompt: 'TRIVIA NIGHT' });
      const ok = k === q.right;
      if (ok) score++;
      await c.say('lou', ok ? 'sf.lou.right' : 'sf.lou.wrong');
    }
    c.flag('sf.lou.trivia', c.day);
    if (score === 3) { await c.say('lou', 'sf.lou.twin'); c.money(50, 'trivia night'); c.standing(1); c.flag('sf.lou.crown', true); c.rel(8); }
    else { await c.say('lou', 'sf.lou.tmid'); c.rel(5); }
  },
});
topic('lou', (c) => (c.has('sf.lou.trivia') || c.day >= 11) && c.has('sf.lou.darts') && !c.has('sf.lou.cup') && c.level >= 3 && {
  label: "Who's the best darts player in Port Zarya?",
  run: async (c) => { await c.say('lou', 'sf.lou.q3'); c.flag('sf.lou.cup', c.day); },
});

// ---- Wade: three flying lessons in Dragonfly
const nextLesson = (c) => (c.has('flight1') ? (c.has('flight2') ? (c.has('flight3') ? 0 : 3) : 2) : 1);
const lessonReady = (c, n) => n === 1 ? c.level >= 1 && c.day >= 2
  : n === 2 ? c.level >= 2 && c.day > num(c.flag('sf.wade.l1'))
    : n === 3 ? c.level >= 3 && c.day > num(c.flag('sf.wade.l2')) : false;
topic('wade', (c) => {
  const n = nextLesson(c);
  if (!n || num(c.flag('sf.wade.go')) >= n || !lessonReady(c, n) || c.hour < 8 || c.hour >= 16) return false;
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
topic('wade', (c) => c.has('sf.ellen.go') && !c.has('sf.ellen.crate') && {
  label: "Doc Ellen's supply crate?",
  run: async (c) => { await c.say('wade', 'sf.wade.crate'); c.give('clinic_crate'); c.flag('sf.ellen.crate', true); c.rel(2); },
});

// ---- Doc Ellen: clinic supplies, the ivory gull, the bird blind
topic('ellen', (c) => c.level >= 1 && c.day >= 3 && !c.has('sf.ellen.go') && {
  label: 'How are the clinic supplies holding up?',
  run: async (c) => {
    await c.say('ellen', 'sf.ellen.q1');
    await c.say('ellen', 'sf.ellen.q2');
    const k = await c.choose(["I'll fetch the crate.", 'Not right now, Doc.']);
    if (k !== 0) return;
    c.flag('sf.ellen.go', true);
    c.rel(4);
    c.start('sf.ellen');
  },
});
topic('ellen', (c) => c.hasItem('clinic_crate') && !c.has('sf.ellen.delivered') && {
  label: "Here's your supply crate, Doc.",
  run: async (c) => {
    c.take('clinic_crate');
    await c.say('ellen', 'sf.ellen.q3');
    c.give('first_aid_kit');
    c.flag('sf.ellen.delivered', c.day);
    c.rel(12);
    c.spirit(3);
  },
});
topic('ellen', (c) => c.has('sf.ellen.delivered') && !c.has('sf.ellen.birdAsk') && c.level >= 2 && c.day > num(c.flag('sf.ellen.delivered')) && {
  label: 'Seen any good birds lately?',
  run: async (c) => { await c.say('ellen', 'sf.ellen.q4'); c.flag('sf.ellen.birdAsk', c.day); },
});
topic('ellen', (c) => c.has('sf.ellen.bird') && (c.state.repairs || {})['r.house.ellen'] && !c.has('sf.ellen.blindThanks') && {
  label: 'Your bird blind is back up.',
  run: async (c) => { await c.say('ellen', 'sf.ellen.q7'); c.flag('sf.ellen.blindThanks', c.day); c.rel(10); },
});

// ---- Pearl: parcels for information
const PARCELS = [['ruth', 'sf.ruth.parcel', 'Ruth'], ['hank', 'sf.hank.parcel', 'Hank'], ['gabriel', 'sf.gabriel.parcel', 'Father Gabriel']];
topic('pearl', (c) => c.level >= 1 && c.day >= 2 && !c.has('sf.pearl.go') && {
  label: 'Need a hand, Pearl?',
  run: async (c) => {
    await c.say('pearl', 'sf.pearl.q1');
    const k = await c.choose(["I'll deliver them.", 'Not today, Pearl.']);
    if (k !== 0) return;
    c.flag('sf.pearl.go', true);
    c.give('parcel', 3);
    c.rel(3);
    c.start('sf.pearl');
  },
});
for (const [who, line] of PARCELS) {
  topic(who, (c) => c.has('sf.pearl.go') && c.hasItem('parcel') && !c.has('sf.pearl.p.' + who) && {
    label: 'A parcel for you, from Pearl.',
    run: async (c) => { c.take('parcel'); await c.say(who, line); c.flag('sf.pearl.p.' + who, true); c.rel(3); },
  });
}
topic('pearl', (c) => c.has('sf.pearl.go') && PARCELS.every(([who]) => c.has('sf.pearl.p.' + who)) && !c.has('sf.pearl.i1') && {
  label: 'All three parcels delivered.',
  run: async (c) => { await c.say('pearl', 'sf.pearl.q2'); c.money(20, 'Pearl'); c.flag('sf.pearl.i1', c.day); c.flag('intel.zug', true); c.rel(8); ear(c, 'sf.n.pearl1'); },
});
topic('pearl', (c) => c.has('sf.pearl.i1') && !c.has('sf.pearl.i2') && c.level >= 2 && c.day > num(c.flag('sf.pearl.i1')) && {
  label: 'Heard anything interesting, Pearl?',
  run: async (c) => { await c.say('pearl', 'sf.pearl.q3'); c.flag('sf.pearl.i2', c.day); c.flag('intel.mayorDebt', true); c.rel(4); ear(c, 'sf.n.pearl2'); },
});
topic('pearl', (c) => c.has('sf.pearl.i2') && !c.has('sf.pearl.i3') && c.level >= 3 && c.day >= 6 && c.day > num(c.flag('sf.pearl.i2')) && {
  label: 'Anything else I should know?',
  run: async (c) => { await c.say('pearl', 'sf.pearl.q4'); c.flag('sf.pearl.i3', c.day); c.flag('intel.greyMail', true); c.rel(4); ear(c, 'sf.n.pearl3'); },
});
topic('pearl', (c) => c.has('sf.pearl.i3') && !c.has('sf.pearl.box') && c.level >= 4 && {
  label: 'You wanted to see me, Pearl?',
  run: async (c) => { await c.say('pearl', 'sf.pearl.q5'); c.give('po_box_key'); c.flag('sf.pearl.box', c.day); c.flag('poBox', true); c.rel(6); ear(c, 'sf.n.pearl4'); },
});

// ---- Chief Marta: wary respect
topic('marta', (c) => c.level >= 1 && c.day >= 3 && !c.has('sf.marta.go') && {
  label: 'Everything all right, Chief?',
  run: async (c) => {
    await c.say('marta', 'sf.marta.q1');
    const k = await c.choose(["I'll take a look at it.", 'Not my department.']);
    if (k !== 0) return;
    c.flag('sf.marta.go', true);
    c.rel(4);
    c.start('sf.marta');
  },
});
topic('marta', (c) => c.has('sf.marta.fixed') && !c.has('sf.marta.thanked') && {
  label: 'Your radio repeater works again.',
  run: async (c) => { await c.say('marta', 'sf.marta.q2'); c.flag('sf.marta.thanked', c.day); c.rel(12); c.attention(-5); },
});
topic('marta', (c) => c.has('sf.marta.thanked') && !c.has('sf.marta.line') && c.level >= 2 && c.day > num(c.flag('sf.marta.thanked')) && {
  label: 'You wanted to see me, Chief?',
  run: async (c) => { await c.say('marta', 'sf.marta.q3'); c.flag('sf.marta.line', c.day); c.flag('marta.number', true); c.rel(6); },
});
topic('marta', (c) => c.has('sf.marta.line') && !c.has('sf.marta.checked') && c.level >= 3 && c.day >= 6 && c.day > num(c.flag('sf.marta.line')) && {
  label: 'Something on your mind, Chief?',
  run: async (c) => { await c.say('marta', 'sf.marta.q4'); c.flag('sf.marta.checked', c.day); c.rel(6); ear(c, 'sf.n.marta'); ear(c, 'sf.i.marta'); },
});

// ---- Evan: creepy friendliness, and fear
topic('evan', (c) => c.level >= 1 && !c.has('sf.evan.s1') && {
  label: 'Tell me about this loyalty program.',
  run: async (c) => {
    await c.say('evan', 'sf.evan.q1');
    const k = await c.choose(['Sign me up.', 'No thanks.']);
    if (k === 0) { await c.say('evan', 'sf.evan.q1a'); c.give('loyalty_card'); c.flag('loyaltyCard', true); c.attention(4); }
    else await c.say('evan', 'sf.evan.q1b');
    c.flag('sf.evan.s1', c.day);
    c.start('sf.evan');
  },
});
topic('evan', (c) => c.has('sf.evan.s1') && !c.has('sf.evan.s2') && c.level >= 2 && c.day >= 5 && (c.hour >= 22 || c.hour < 5) && {
  label: 'Long night, Evan?',
  run: async (c) => { await c.say('evan', 'sf.evan.q2'); c.flag('sf.evan.s2', c.day); c.rel(6); },
});
topic('evan', (c) => c.has('sf.evan.s2') && !c.has('sf.evan.s3') && c.level >= 3 && c.day >= 8 && {
  label: 'You look pale, Evan.',
  run: async (c) => { await c.say('evan', 'sf.evan.q3'); c.flag('sf.evan.s3', c.day); c.flag('evan.scared', true); c.rel(6); ear(c, 'sf.n.evan'); },
});

// ================================================================== profiles
// greet: [Stranger/Acquaintance, Friendly/Friend, Close friend/Family] (or a function)
// chat: { q (your line), line, min (friendship level), after (line heard first), when, then }
// gift: { love, like, hate, lines: [love, like, hate] } or { decline }
// defer: hand the whole conversation to the older version (day 1 business)
// prev: there's an older conversation worth offering as '(Something else…)'
const T = (q, line, min = 0, extra = {}) => ({ q, line, min, ...extra });
const P = {
  wade: {
    greet: ['sf.wade.g0', 'sf.wade.g1', 'sf.wade.g2'], prev: true,
    chat: [T("What's it like, flying up here?", 'sf.wade.t0'), T('What do you make of Northstar?', 'sf.wade.t1'), T("How'd you end up in Port Zarya?", 'sf.wade.t2', 2), T('Who was Margie?', 'sf.wade.t3', 3, { after: 'sf.wade.t2' }), T('Ever think about leaving?', 'sf.wade.t4', 4)],
    gift: { love: ['coffee'], like: ['pie', 'fish', 'chocolate'], hate: ['tea'], lines: ['sf.wade.gift1', 'sf.wade.gift2', 'sf.wade.gift3'] },
  },
  koshkin: {
    greet: ['sf.koshkin.g0', 'sf.koshkin.g1', 'sf.koshkin.g2'], prev: true,
    defer: (c) => !c.has('koshkinMet') || c.day === 1,
    chat: [T("How's business?", 'sf.koshkin.t0'), T('Cold enough for you?', 'sf.koshkin.t1'), T('Tell me about your grandfather.', 'sf.koshkin.t2', 2), T('What was Yuri like?', 'sf.koshkin.t3', 3), T('Ever think about retiring?', 'sf.koshkin.t4', 4)],
    gift: { love: ['tea'], like: ['fish', 'chocolate', 'candle'], hate: ['whiskey'], lines: ['sf.koshkin.gift1', 'sf.koshkin.gift2', 'sf.koshkin.gift3'] },
  },
  dolly: {
    greet: ['sf.dolly.g0', 'sf.dolly.g1', 'sf.dolly.g2'], prev: true,
    defer: (c) => !c.has('dollyMet'),
    chat: [T("What's new in town?", 'sf.dolly.t0'), T('What do you make of Northstar?', 'sf.dolly.t1'), T('How long have you had the diner?', 'sf.dolly.t2', 2), T('Tell me about Earl.', 'sf.dolly.t3', 3, { after: 'sf.dolly.t2' }), T('Why do you stay, Dolly?', 'sf.dolly.t4', 4)],
    gift: { love: ['flowers'], like: ['chocolate', 'tea', 'fish'], hate: ['pie'], lines: ['sf.dolly.gift1', 'sf.dolly.gift2', 'sf.dolly.gift3'] },
  },
  hank: {
    greet: ['sf.hank.g0', 'sf.hank.g1', 'sf.hank.g2'], prev: true,
    defer: (c) => !!c.G.missions?.isActive?.('d1.cabin') && !c.hasItem('hemp_rope') && !c.has('bellFixed'),
    chat: [T("How's the hardware business?", 'sf.hank.t0'), T("What's your beef with Northstar?", 'sf.hank.t1'), T("How long's the store been here?", 'sf.hank.t2', 2), T('Got any family, Hank?', 'sf.hank.t3', 3), T('Why are you on the council?', 'sf.hank.t4', 4)],
    gift: { love: ['coffee'], like: ['fish', 'whiskey', 'pie'], hate: ['flowers'], lines: ['sf.hank.gift1', 'sf.hank.gift2', 'sf.hank.gift3'] },
  },
  ruth: {
    greet: ['sf.ruth.g0', 'sf.ruth.g1', 'sf.ruth.g2'],
    chat: [T('How long have you lived here?', 'sf.ruth.t0'), T('What do you think of Northstar?', 'sf.ruth.t1'), T('What was the town like when you were young?', 'sf.ruth.t2', 2), T('Tell me about Tommy.', 'sf.ruth.t3', 3), T('Do you ever get tired, Ruth?', 'sf.ruth.t4', 4)],
    gift: { love: ['tea'], like: ['fish', 'pie', 'candle'], hate: ['whiskey'], lines: ['sf.ruth.gift1', 'sf.ruth.gift2', 'sf.ruth.gift3'] },
  },
  ray: {
    greet: ['sf.ray.g0', 'sf.ray.g1', 'sf.ray.g2'],
    chat: [T("How's the cannery?", 'sf.ray.t0'), T('What do you make of Northstar?', 'sf.ray.t1'), T('How long have you worked the line?', 'sf.ray.t2', 2), T('Tell me about your daughter.', 'sf.ray.t3', 3), T('Why do you drink so much, Ray?', 'sf.ray.t4', 4)],
    gift: { love: ['coffee'], like: ['pie', 'chocolate', 'fish'], hate: ['whiskey'], lines: ['sf.ray.gift1', 'sf.ray.gift2', 'sf.ray.gift3'] },
  },
  lyle: {
    greet: ['sf.lyle.g0', 'sf.lyle.g1', 'sf.lyle.g2'],
    chat: [T("How's business?", 'sf.lyle.t0'), T('What do you think of Northstar?', 'sf.lyle.t1'), T('Why do you want to be mayor?', 'sf.lyle.t2', 2), T('Are you all right? You seem nervous.', 'sf.lyle.t3', 3), T('What scares you, Lyle?', 'sf.lyle.t4', 4)],
    gift: { love: ['whiskey'], like: ['chocolate', 'coffee'], hate: ['fish'], lines: ['sf.lyle.gift1', 'sf.lyle.gift2', 'sf.lyle.gift3'] },
  },
  gabriel: {
    greet: ['sf.gabriel.g0', 'sf.gabriel.g1', 'sf.gabriel.g2'], prev: true,
    defer: (c) => !c.has('gabrielMet') || (c.has('bellFixed') && !c.has('gabrielThanked')),
    chat: [T('How old is the church?', 'sf.gabriel.t0'), T('What do you make of Northstar?', 'sf.gabriel.t1'), T('How did you end up here?', 'sf.gabriel.t2', 2), T('Do you ever doubt, Father?', 'sf.gabriel.t3', 3), T('What do you pray for?', 'sf.gabriel.t4', 4)],
    gift: { love: ['candle'], like: ['tea', 'fish', 'pie', 'whiskey'], lines: ['sf.gabriel.gift1', 'sf.gabriel.gift2'] },
  },
  nina: {
    greet: ['sf.nina.g0', 'sf.nina.g1', 'sf.nina.g2'],
    chat: [T("How's the station?", 'sf.nina.t0'), T('What do you think of Northstar?', 'sf.nina.t1'), T("What's it like being the chief's kid?", 'sf.nina.t2', 2), T('Do you want to stay here?', 'sf.nina.t3', 3), T("What's your mom really like?", 'sf.nina.t4', 4)],
    gift: { love: ['chocolate'], like: ['coffee', 'pie'], hate: ['flowers'], lines: ['sf.nina.gift1', 'sf.nina.gift2', 'sf.nina.gift3'] },
  },
  tommy: {
    greet: ['sf.tommy.g0', 'sf.tommy.g1', 'sf.tommy.g2'],
    chat: [T('What do you do at Hank\'s?', 'sf.tommy.t0'), T('What do you think of Northstar?', 'sf.tommy.t1'), T("What's racing like?", 'sf.tommy.t2', 2), T('What about your parents?', 'sf.tommy.t3', 3), T('What do you want, Tommy?', 'sf.tommy.t4', 4)],
    gift: { love: ['pie'], like: ['chocolate', 'coffee', 'fish'], hate: ['tea'], lines: ['sf.tommy.gift1', 'sf.tommy.gift2', 'sf.tommy.gift3'] },
  },
  lou: {
    greet: ['sf.lou.g0', 'sf.lou.g1', 'sf.lou.g2'],
    chat: [T('Busy night?', 'sf.lou.t0'), T('What do you make of the Northstar crowd?', 'sf.lou.t1'), T("How'd you end up with a bar?", 'sf.lou.t2', 2), T("How'd you get so good at darts?", 'sf.lou.t3', 3), T('Who looks after you, Lou?', 'sf.lou.t4', 4)],
    gift: { love: ['fish'], like: ['coffee', 'pie', 'chocolate'], hate: ['whiskey'], lines: ['sf.lou.gift1', 'sf.lou.gift2', 'sf.lou.gift3'] },
  },
  ellen: {
    greet: ['sf.ellen.g0', 'sf.ellen.g1', 'sf.ellen.g2'],
    chat: [T("How's the clinic?", 'sf.ellen.t0'), T('What do you make of Northstar?', 'sf.ellen.t1'), T('Why birds?', 'sf.ellen.t2', 2), T('How did you end up here, Doc?', 'sf.ellen.t3', 3), T('What worries you, Doc?', 'sf.ellen.t4', 4)],
    gift: { love: ['film'], like: ['tea', 'chocolate', 'coffee'], hate: ['whiskey'], lines: ['sf.ellen.gift1', 'sf.ellen.gift2', 'sf.ellen.gift3'] },
  },
  pearl: {
    greet: ['sf.pearl.g0', 'sf.pearl.g1', 'sf.pearl.g2'],
    chat: [T('Any news?', 'sf.pearl.t0'), T('What do you make of Northstar?', 'sf.pearl.t1'), T('How long have you been postmaster?', 'sf.pearl.t2', 2), T('Do you ever write letters, Pearl?', 'sf.pearl.t3', 3), T('How do you know everything, Pearl?', 'sf.pearl.t4', 4)],
    gift: { love: ['chocolate'], like: ['flowers', 'pie', 'tea'], hate: ['fish'], lines: ['sf.pearl.gift1', 'sf.pearl.gift2', 'sf.pearl.gift3'] },
  },
  marta: {
    greet: ['sf.marta.g0', 'sf.marta.g1', 'sf.marta.g2'],
    chat: [T('Quiet day, Chief?', 'sf.marta.t0'), T('What do you think of Northstar?', 'sf.marta.t1'), T('Why did you become a cop?', 'sf.marta.t2', 2), T("How's Nina?", 'sf.marta.t3', 3), T('Do you trust me now?', 'sf.marta.t4', 4)],
    gift: { love: ['coffee'], like: ['pie', 'chocolate'], hate: ['whiskey'], lines: ['sf.marta.gift1', 'sf.marta.gift2', 'sf.marta.gift3'] },
  },
  evan: {
    greet: ['sf.evan.g0', 'sf.evan.g1', 'sf.evan.g2'], prev: true,
    defer: (c) => !c.has('evanMet'),
    chat: [T("How's business?", 'sf.evan.t0'), T("Don't you ever sleep?", 'sf.evan.t1'), T('Where are you from, Evan?', 'sf.evan.t2', 2), T('Do you like working for Northstar?', 'sf.evan.t3', 3),
      T('Evan, are you all right?', 'sf.evan.t4', 4, { then: (c) => { c.flag('intel.evanBlindspot', true); ear(c, 'sf.l.evan'); } })],
    gift: { love: ['chocolate'], like: Object.keys(GIFTS), lines: ['sf.evan.gift', 'sf.evan.gift'] },
  },
  walt: {
    greet: ['sf.walt.g0', 'sf.walt.g1'],
    chat: [T("How's the town doing, Mayor?", 'sf.walt.t0'), T('What do you think of Northstar?', 'sf.walt.t1'), T('Why so tired, Walt?', 'sf.walt.t2', 3)],
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
    greet: (c) => (c.day >= 11 ? 'sf.okafor.g1' : 'sf.okafor.g0'), cold: true,
    defer: (c) => c.day === 10,
    chat: [
      T('Do I know you?', 'sf.okafor.t0', 0, { when: (c) => c.day < 10 }),
      T('Why do I keep seeing you?', 'sf.okafor.t1', 0, { when: (c) => c.day < 10 }),
      T("How's the investigation?", 'sf.okafor.t2', 0, { when: (c) => c.day >= 11 }),
      T('Why the grey parka?', 'sf.okafor.t3', 1, { when: (c) => c.day >= 11 }),
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
  // keep the side missions alive (old saves, or a quest whose mission was never started)
  const M = c.G.missions;
  for (const [mid, fk] of Object.entries(QUEST_GO)) if (c.has(fk) && M?.isActive && !M.isActive(mid) && !M.isDone?.(mid)) c.start(mid);
  if (c.has('runStore') && c.day >= 7 && !c.has('koshkinBack')) c.start('job.shop');
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

// ================================================================== quest missions
const lvl = (m, id) => SIDE.level(m.G.state, id);

/** The last step of a council quest: wait until they trust you enough, then ask. */
async function cardStep(m, id, ready = () => cardReady(m.G.state, id)) {
  const s = m.G.state;
  if (hasShare(s, id)) return;
  await SIDE.gate(m, () => ready() || hasShare(s, id), `Ask ${CAST[id].short} about the card`, id, 'Their continuity card');
  await m.until(() => hasShare(s, id));
}

/** Talk-gated step: show where to go, wait for the flag the conversation sets. */
async function talkStep(m, flag, text, where, sub) {
  if (m.G.state.flags[flag]) return;
  SIDE.obj(m, text, where, sub);
  await m.until(() => !!m.G.state.flags[flag]);
}

/** A list of people to visit, in any order (one flag each). */
async function rounds(m, list, flagOf, text, subOf) {
  const f = m.G.state.flags;
  const left = () => list.filter((x) => !f[flagOf(x)]);
  for (let g = 0; g <= list.length && left().length; g++) {
    const L = left(), n = L.length;
    SIDE.obj(m, text, L[0][0], subOf(L));
    await m.until(() => left().length < n);
  }
}

const LAKE = { x: -282, z: -436 };
async function race(m, n) {
  const G = m.G, f = G.state.flags;
  await SIDE.idle(m);
  await m.scene(async (d) => {
    await d.bring('tommy', beside(G));
    d.cam(d.overShoulder('player', 'tommy'));
    await d.say('tommy', ['sf.tommy.race1', 'sf.tommy.race2', 'sf.tommy.race3'][n - 1]);
    if (n === 1) await d.say('grisha', 'sf.g.race', { radio: true });
  });
  const R = [{ k: 'wire', title: 'LOON LAKE · RACE ONE', len: 6, time: 9 }, { k: 'lock', title: 'LOON LAKE · RACE TWO', len: 7, time: 8 }, { k: 'wire', title: 'THE LOON LAKE CUP', len: 9, time: 9 }][n - 1];
  const won = await m.minigame(R.k, { title: R.title, len: R.len, time: R.time });
  f['sf.tommy.r' + n] = G.state.day;
  if (won) f['sf.tommy.won' + n] = true;
  if (won && n === 3) f['tommy.champ'] = true;
  SIDE.rel(G, 'tommy', won ? 10 : 7);
  await m.scene(async (d) => {
    await d.bring('tommy', beside(G));
    d.cam(d.closeUp('tommy', { side: 1, dist: 1.3 }));
    await d.say('tommy', n < 3 ? (won ? 'sf.tommy.win' : 'sf.tommy.lose') : (won ? 'sf.tommy.champ' : 'sf.tommy.lose3'));
  });
}

async function lesson(m, n) {
  const G = m.G, f = G.state.flags;
  await SIDE.idle(m);
  await m.scene(async (d) => {
    await d.bring('wade', SIDE.mark(G, 'hangar.cockpit', 1.6, 1));
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
    await d.bring('wade', SIDE.mark(G, 'hangar.cockpit', 1.6, 1));
    d.cam(d.closeUp('wade', { side: -1, dist: 1.2 }));
    await d.say('wade', n === 3 ? 'sf.wade.l3b' : ok ? (n === 1 ? 'sf.wade.l1b' : 'sf.wade.l2b') : 'sf.wade.l1c');
    await d.say('grisha', ['sf.g.wade2', 'sf.g.wade2', 'sf.g.wade3'][n - 1], { radio: true });
  });
  if (n === 1) m.ear('sf.n.wade');
  G.missions.emit?.('flight' + n);
}

export const MISSIONS = {
  // ---------------------------------------------------------------- Dolly
  'sf.dolly': {
    title: "Earl's Recipe Box",
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (from <= 12) await workOrder(m, 'r.house.dolly', 10, from);
      if (m.cp(20, from) && !SIDE.has(G, 'recipe_box') && !f['sf.dolly.gave']) {
        SIDE.obj(m, "Search Earl's workshop", 'house32.door', 'Behind the Midnight Sun Diner');
        await m.spot('box', SIDE.at(G, 'house32.door'), "Search Earl's workbench", 3);
        SIDE.give(G, 'recipe_box');
      }
      if (m.cp(30, from)) await talkStep(m, 'sf.dolly.gave', "Bring Earl's recipe box to Dolly", 'dolly', 'Midnight Sun Diner, 6 am to 9 pm');
      if (from <= 42) { f['sf.dolly.freezer'] = true; await workOrder(m, 'r.dolly.freezer', 40, from); }
      if (m.cp(50, from)) await talkStep(m, 'sf.dolly.word', 'Tell Dolly her freezer runs', 'dolly');
      if (m.cp(60, from)) {
        await rounds(m, [['pearl', 'Pearl'], ['nina', 'Nina'], ['gabriel', 'Father Gabriel']], (x) => 'sf.dolly.w.' + x[0], 'Spread the word: Chowder Night', (L) => 'Tell ' + L.map((x) => x[1]).join(', '));
        if (!f['sf.dolly.night']) f['sf.dolly.night'] = s.day + 1;
      }
      if (m.cp(70, from) && !f['sf.dolly.feast']) {
        const night = num(f['sf.dolly.night']) || s.day;
        SIDE.obj(m, 'Chowder Night at the diner', 'diner', `Day ${night}, from 6 pm`);
        await m.until(() => s.day >= night && s.hour >= 18 && s.hour < 23);
        await m.reach(SIDE.at(G, 'diner'), 14);
        await SIDE.idle(m);
        await m.scene(async (d) => {
          await d.bring('dolly', SIDE.mark(G, 'diner.counter', 0, 2.2));
          await d.bring('hank', SIDE.mark(G, 'diner.booth1', -1.8, 1.4));
          await d.bring('pearl', SIDE.mark(G, 'diner.booth2', 1.8, 1.6));
          await d.bring('gabriel', SIDE.mark(G, 'diner.booth3', 2.4, -0.6));
          d.cam(d.closeUp('dolly', { side: -1, dist: 1.4 }));
          await d.say('dolly', 'sf.dolly.q7');
          d.cam(d.closeUp('hank', { side: 1, dist: 1.2 }));
          await d.say('hank', 'sf.hank.chowder');
          d.cam(d.overShoulder('player', 'dolly'));
          await d.say('dolly', 'sf.dolly.q8');
        });
        f['sf.dolly.feast'] = s.day;
        f['dolly.debtPaid'] = true;
        SIDE.rel(G, 'dolly', 15);
        SIDE.spirit(G, 10);
        SIDE.standing(G, 2);
        G.missions.emit?.('chowderNight');
      }
      if (m.cp(80, from)) await cardStep(m, 'dolly');
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Hank
  'sf.hank': {
    title: 'Fuel and Family',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.hank.tickets']) await talkStep(m, 'sf.hank.ray', 'Ask Ray about the Northstar barge', 'ray', 'The cannery by day, the Rusty Anchor at night');
      if (m.cp(20, from) && !f['sf.hank.tickets']) {
        SIDE.obj(m, 'Photograph the barge tickets', 'harbor', "The harbour shack. Don't be seen.");
        await m.spot('tickets', SIDE.at(G, 'harbor'), 'Photograph the delivery tickets', 3);
        G.attention?.act?.(0.8, 4);
        m.ear('sf.n.tickets');
        f['sf.hank.tickets'] = s.day;
        G.hud?.toast?.('PHOTOGRAPHED', 'Northstar barge tickets', '#7fe6ff');
      }
      if (m.cp(30, from)) await talkStep(m, 'sf.hank.proof', 'Show Hank the photographs', 'hank', 'Brubaker Hardware, 7 am to 6 pm');
      if (from <= 42) { f['sf.hank.pumpAsk'] = true; await workOrder(m, 'r.hank.pump', 40, from); }
      if (m.cp(45, from)) await talkStep(m, 'sf.hank.pumped', 'Tell Hank his truck runs', 'hank');
      if (m.cp(48, from) && !f['sf.hank.letter']) {
        await SIDE.gate(m, () => lvl(m, 'hank') >= 2 && s.day > num(f['sf.hank.proof']), 'Check on Hank', 'hank', 'He seemed far away');
        await m.until(() => f['sf.hank.letter']);
      }
      if (m.cp(50, from)) await talkStep(m, 'sf.hank.number', "Ask Pearl for Danny's number", 'pearl', 'The post office, 9 am to 5 pm');
      if (m.cp(60, from) && !f['sf.hank.called']) {
        await SIDE.gate(m, () => lvl(m, 'hank') >= 3, "Give Hank his son's number", 'hank', 'When he trusts you a little more');
        await m.until(() => f['sf.hank.called']);
      }
      if (m.cp(70, from)) await cardStep(m, 'hank');
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Ruth
  'sf.ruth': {
    title: 'The History Album',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (from <= 12) await workOrder(m, 'r.school.gym', 10, from);
      if (m.cp(15, from)) await talkStep(m, 'sf.ruth.album', 'Tell Ruth the archive is dry', 'ruth', 'Post office mornings, the diner at noon, the hall after');
      if (m.cp(18, from) && !f['sf.ruth.photos']) {
        for (const p of photosLeft(f)) {
          m.spot('ph.' + p.k, SIDE.at(G, p.where), "Look for Ruth's photograph", 3).then(() => {
            if (f['sf.ruth.ph.' + p.k]) return;
            f['sf.ruth.ph.' + p.k] = true;
            SIDE.give(G, 'old_photo');
            G.hud?.toast?.('PHOTOGRAPH', p.cap, '#ffd166');
            if (SIDE.once(G, 'sf.l.photo.heard')) m.ear('sf.l.photo');
          });
        }
        for (let g = 0; g < 6 && photosLeft(f).length; g++) {
          const L = photosLeft(f), n = L.length;
          SIDE.obj(m, `Ruth's photographs: ${5 - n} of 5`, L[0].where, 'The church, the Anchor, the post office, the cannery, the lighthouse');
          await m.until(() => photosLeft(f).length < n);
        }
      }
      if (m.cp(20, from)) await talkStep(m, 'sf.ruth.photos', 'Bring the photographs to Ruth', 'ruth', 'Post office mornings, the diner at noon, the hall after');
      if (m.cp(30, from) && !f['sf.ruth.bell']) await talkStep(m, 'sf.ruth.bellok', 'Ask Father Gabriel about the bell', 'gabriel', 'Holy Transfiguration');
      if (m.cp(40, from) && !f['sf.ruth.bell']) {
        SIDE.obj(m, 'Find the old school bell', 'church.ladderBottom', 'Under the bell tower stairs');
        await m.spot('bell', SIDE.at(G, 'church.ladderBottom'), 'Unwrap the old bell', 2.5);
        SIDE.give(G, 'school_bell');
        f['sf.ruth.bell'] = s.day;
      }
      if (m.cp(50, from) && !f['sf.ruth.bellHung']) {
        SIDE.obj(m, 'Hang the bell at the school', 'school.flag', 'Port Zarya School, Main St');
        await m.spot('hang', SIDE.at(G, 'school.flag'), 'Hang the old school bell', 3);
        await m.minigame('rope', { title: 'HANG THE SCHOOL BELL' });
        SIDE.take(G, 'school_bell');
        G.sfx?.bell?.();
        f['sf.ruth.bellHung'] = s.day;
        SIDE.spirit(G, 8);
      }
      if (m.cp(60, from)) await talkStep(m, 'sf.ruth.bellThanks', 'Tell Ruth about the bell', 'ruth');
      if (m.cp(70, from) && !f['sf.ruth.tommyAsk']) {
        await SIDE.gate(m, () => lvl(m, 'ruth') >= 3 && s.day > num(f['sf.ruth.bellThanks']), 'Ruth wants a word', 'ruth', 'Something about Tommy');
        await m.until(() => f['sf.ruth.tommyAsk']);
      }
      if (m.cp(80, from)) await talkStep(m, 'sf.ruth.tommy', 'Talk to Tommy about the Dome job', 'tommy', 'Brubaker Hardware by day, the Anchor at night');
      if (m.cp(90, from)) await talkStep(m, 'sf.ruth.tommyDone', 'Tell Ruth what Tommy decided', 'ruth');
      if (m.cp(100, from)) await cardStep(m, 'ruth');
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Ray
  'sf.ray': {
    title: 'Last Shift',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (from <= 12) await workOrder(m, 'r.house.ray', 10, from);
      if (m.cp(20, from) && !f['sf.ray.ask']) {
        await SIDE.gate(m, () => lvl(m, 'ray') >= 2, 'Tell Ray his porch is fixed', 'ray');
        await m.until(() => f['sf.ray.ask']);
      }
      if (m.cp(30, from) && !f['sf.ray.saved']) {
        await SIDE.gate(m, () => s.day > num(f['sf.ray.ask']), 'Keep Ray off the bottle', 'bar', 'The Rusty Anchor, after 6 pm');
        await m.until(() => f['sf.ray.saved']);
      }
      if (m.cp(40, from) && !f['sf.ray.kayla']) {
        await SIDE.gate(m, () => s.day > num(f['sf.ray.saved']), "Ask Ray about Kayla's visit", 'ray');
        await m.until(() => f['sf.ray.kayla']);
      }
      if (m.cp(50, from)) await cardStep(m, 'ray');
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Lyle
  'sf.lyle': {
    title: 'Sinking Lots',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.lyle.lock']) {
        SIDE.obj(m, 'Put a lock on Pruitt Realty', 'house22.door', "Lyle's office, Third Ave by City Hall");
        await m.spot('lock', SIDE.at(G, 'house22.door'), 'Install the deadbolt', 3);
        await m.minigame('hammer', { title: 'INSTALL THE DEADBOLT' });
        m.money(50, 'Lyle Pruitt');
        f['sf.lyle.lock'] = s.day;
      }
      if (m.cp(20, from) && !f['sf.lyle.envelope']) {
        SIDE.obj(m, 'Something under the door', 'house22.door', 'An envelope');
        await m.spot('env', SIDE.at(G, 'house22.door'), 'Pick up the envelope', 3);
        SIDE.give(G, 'envelope');
        f['sf.lyle.envelope'] = s.day;
        m.ear('sf.n.lyle');
      }
      if (m.cp(30, from)) await talkStep(m, 'sf.lyle.confessed', 'Ask Lyle about the envelope', 'lyle', 'City Hall by day, the diner after five');
      if (m.cp(40, from) && !f['sf.lyle.report']) {
        SIDE.obj(m, "Get the survey from Gideon's files", 'cityhall', 'City Hall, after 8 pm. Quietly.');
        await m.until(() => s.hour >= 20 || s.hour < 5);
        await m.spot('files', SIDE.at(G, 'cityhall.clerk'), "Search Gideon Shaw's files", 2.5);
        G.attention?.act?.(1, 6);
        await m.minigame('lock', { title: "GIDEON'S FILE CABINET" });
        SIDE.give(G, 'survey');
        f['sf.lyle.report'] = s.day;
        m.ear('sf.n.survey');
      }
      if (m.cp(50, from)) await talkStep(m, 'sf.lyle.outcome', 'Bring the survey to Lyle', 'lyle');
      if (m.cp(60, from)) await cardStep(m, 'lyle', () => knowsShares(s) && f['sf.lyle.outcome'] === 'freed');
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Father Gabriel
  'sf.gabriel': {
    title: 'Chess and Chant',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.gabriel.hymn']) {
        await SIDE.gate(m, () => lvl(m, 'gabriel') >= 2 && s.day > num(f['sf.gabriel.chess1']), 'Visit Father Gabriel', 'gabriel', 'Holy Transfiguration');
        await m.until(() => f['sf.gabriel.hymn']);
      }
      if (m.cp(20, from) && !f['sf.gabriel.studied']) {
        SIDE.obj(m, 'Study the torn hymnbook', 'church.kliros', 'By the choir stand, inside the church');
        await m.spot('book', SIDE.at(G, 'church.kliros'), 'Look at the torn pages', 2.5);
        await m.ears(['sf.v.hymn1', 'sf.v.hymn2']);
        f['sf.gabriel.studied'] = s.day;
      }
      if (m.cp(30, from)) await talkStep(m, 'sf.gabriel.hymnGiven', 'Bring the chant to Father Gabriel', 'gabriel');
      if (m.cp(40, from) && !f['sf.gabriel.icon']) {
        await SIDE.gate(m, () => lvl(m, 'gabriel') >= 3 && s.day > num(f['sf.gabriel.hymnGiven']), 'Father Gabriel wants a word', 'gabriel');
        await m.until(() => f['sf.gabriel.icon']);
      }
      if (m.cp(50, from) && !f['sf.gabriel.iconDone']) {
        if (!SIDE.has(G, 'paint')) {
          SIDE.obj(m, 'Buy paint for the icon', 'hardware', 'Brubaker Hardware: paint ×1');
          await m.until(() => SIDE.has(G, 'paint'));
        }
        SIDE.obj(m, 'Restore the icon', 'church.iconostasis', 'Above the royal doors');
        await m.spot('icon', SIDE.at(G, 'church.iconostasis'), 'Clean the icon', 2.5);
        await m.minigame('paint', { title: 'LIFT A CENTURY OF SMOKE' });
        await m.minigame('paint', { title: 'RETOUCH THE ROBES' });
        SIDE.take(G, 'paint');
        f['sf.gabriel.iconDone'] = s.day;
        SIDE.spirit(G, 8);
      }
      if (m.cp(60, from)) await talkStep(m, 'sf.gabriel.iconThanks', 'Tell Father Gabriel', 'gabriel');
      if (m.cp(70, from) && !f['sf.gabriel.chess2']) {
        await SIDE.gate(m, () => lvl(m, 'gabriel') >= 4, 'One more game with Father Gabriel', 'gabriel');
        await m.until(() => f['sf.gabriel.chess2']);
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Nina
  'sf.nina': {
    title: 'Signal',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (from <= 12) await workOrder(m, 'r.kzry.mast', 10, from);
      if (m.cp(20, from)) await talkStep(m, 'sf.nina.tapeAsk', 'Tell Nina the mast is fixed', 'nina', 'The radio station, 3 to 9 pm');
      if (m.cp(30, from)) await talkStep(m, 'sf.nina.tapeDone', "Record Ruth's story for Nina", 'ruth');
      if (m.cp(40, from)) await talkStep(m, 'sf.nina.tapeBack', 'Bring the tape to Nina', 'nina');
      if (m.cp(50, from) && !f['sf.nina.letterAsk']) {
        await SIDE.gate(m, () => lvl(m, 'nina') >= 3 && s.day > num(f['sf.nina.tapeBack']), 'Nina has news', 'nina');
        await m.until(() => f['sf.nina.letterAsk']);
      }
      if (m.cp(60, from) && !f['sf.nina.letterGiven'] && !SIDE.has(G, 'seattle_letter')) {
        SIDE.obj(m, "Pick up Nina's letter", 'pearl', 'The post office, 9 am to 5 pm');
        await m.until(() => SIDE.has(G, 'seattle_letter') || f['sf.nina.letterGiven']);
      }
      if (m.cp(70, from)) await talkStep(m, 'sf.nina.letterGiven', 'Give Nina her letter', 'nina');
      if (m.cp(80, from) && !f['sf.nina.told']) {
        await SIDE.gate(m, () => s.day > num(f['sf.nina.letterGiven']), 'Check on Nina', 'nina', 'Did she tell her mother?');
        await m.until(() => f['sf.nina.told']);
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Tommy
  'sf.tommy': {
    title: 'Loon Lake',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.tommy.r1']) {
        SIDE.obj(m, 'Meet Tommy at Loon Lake', LAKE, 'Up the Lake Trail, north-west of town');
        await m.reach(LAKE, 18);
        await race(m, 1);
      }
      if (m.cp(20, from) && !f['sf.tommy.eng']) {
        await SIDE.gate(m, () => lvl(m, 'tommy') >= 2 && s.day > num(f['sf.tommy.r1']), 'Tommy needs a hand', 'tommy', 'Brubaker Hardware, 9 am to 5 pm');
        await m.until(() => f['sf.tommy.eng']);
      }
      if (m.cp(30, from) && !f['sf.tommy.fixed']) {
        if (!(SIDE.has(G, 'wire', 2) && SIDE.has(G, 'pipe', 1))) {
          SIDE.obj(m, "Parts for Tommy's engine", 'hardware', 'Brubaker Hardware: wire ×2, pipe ×1');
          await m.until(() => SIDE.has(G, 'wire', 2) && SIDE.has(G, 'pipe', 1));
        }
        SIDE.obj(m, "Rebuild Tommy's race engine", 'hardware', "In Hank's back shop");
        await m.spot('engine', SIDE.at(G, 'hardware'), "Rebuild Tommy's engine", 3);
        await m.minigame('wire', { title: 'REWIRE THE IGNITION' });
        await m.minigame('hammer', { title: 'SEAT THE NEW GASKET' });
        SIDE.take(G, 'wire', 2);
        SIDE.take(G, 'pipe', 1);
        f['sf.tommy.fixed'] = s.day;
        SIDE.rel(G, 'tommy', 8);
        await SIDE.say(m, 'tommy', 'sf.tommy.fix');
      }
      if (m.cp(40, from) && !f['sf.tommy.r2']) {
        SIDE.obj(m, 'Race two at Loon Lake', LAKE, 'Tommy is waiting on the ice');
        await m.reach(LAKE, 18);
        await race(m, 2);
      }
      if (m.cp(50, from) && !f['sf.tommy.cup']) {
        await SIDE.gate(m, () => lvl(m, 'tommy') >= 3 && s.day > num(f['sf.tommy.r2']), 'Tommy has a plan', 'tommy');
        await m.until(() => f['sf.tommy.cup']);
      }
      if (m.cp(60, from) && !f['sf.tommy.r3']) {
        const day = num(f['sf.tommy.cup']) + 1;
        SIDE.obj(m, 'The Loon Lake Cup', LAKE, `Day ${day}, after 6 pm`);
        await m.until(() => s.day >= day && s.hour >= 18);
        await m.reach(LAKE, 18);
        await race(m, 3);
        SIDE.spirit(G, 5);
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Lou
  'sf.lou': {
    title: 'Darts and Trivia',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.lou.darts']) {
        await SIDE.idle(m);
        const ok = await m.minigame('hammer', { title: 'DARTS · HIT THE BULL', hits: 5, misses: 3 });
        f['sf.lou.darts'] = s.day;
        if (ok) f['sf.lou.dwin'] = true;
        SIDE.rel(G, 'lou', ok ? 8 : 5);
        await SIDE.say(m, 'lou', ok ? 'sf.lou.dwin' : 'sf.lou.dlose');
      }
      if (m.cp(20, from) && !f['sf.lou.trivia'] && !f['sf.lou.cup'] && s.day <= 13) {
        SIDE.obj(m, 'Trivia night at the Rusty Anchor', 'bar', 'Wednesdays and Saturdays, from 7 pm');
        await m.until(() => f['sf.lou.trivia'] || f['sf.lou.cup'] || s.day > 13);
      }
      if (m.cp(30, from) && !f['sf.lou.cup']) {
        await SIDE.gate(m, () => lvl(m, 'lou') >= 3, 'Lou has a challenge', 'lou', 'The Rusty Anchor, from 3 pm');
        await m.until(() => f['sf.lou.cup']);
      }
      if (m.cp(40, from) && !f['sf.lou.cupDone']) {
        const day = num(f['sf.lou.cup']) + 1;
        SIDE.obj(m, 'The Anchor Cup', 'bar', `Day ${day}, 9 pm`);
        await m.until(() => s.day >= day && s.hour >= 21);
        await m.reach(SIDE.at(G, 'bar'), 12);
        await SIDE.idle(m);
        const ok = await m.minigame('hammer', { title: 'THE ANCHOR CUP', hits: 6, misses: 2, speed: 1.7 });
        f['sf.lou.cupDone'] = s.day;
        if (ok) { f['lou.champ'] = true; SIDE.standing(G, 1); }
        SIDE.rel(G, 'lou', 12);
        await SIDE.say(m, 'lou', ok ? 'sf.lou.cupwin' : 'sf.lou.cuplose');
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Wade
  'sf.wade': {
    title: 'Flying Lessons',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      for (let n = 1; n <= 3; n++) {
        if (f['flight' + n]) continue;
        if (m.cp(n * 10 + 1, from) && num(f['sf.wade.go']) < n) {
          const ready = () => (n === 1 || (lvl(m, 'wade') >= n && s.day > num(f['sf.wade.l' + (n - 1)])));
          await SIDE.gate(m, ready, `Flying lesson ${n} with Wade`, 'wade', 'Tolliver Air hangar, 8 am to 4 pm, $60');
          await m.until(() => num(f['sf.wade.go']) >= n);
        }
        if (m.cp(n * 10 + 2, from)) {
          SIDE.clear(m);
          await lesson(m, n);
        }
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Doc Ellen
  'sf.ellen': {
    title: 'Birds and Bandages',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.ellen.delivered'] && !SIDE.has(G, 'clinic_crate')) await talkStep(m, 'sf.ellen.crate', "Pick up the clinic's crate from Wade", 'wade', 'Tolliver Air hangar, 8 am to 4 pm');
      if (m.cp(20, from)) await talkStep(m, 'sf.ellen.delivered', 'Bring the crate to Doc Ellen', 'ellen', 'The clinic, 8 am to 5 pm');
      if (m.cp(30, from) && !f['sf.ellen.birdAsk']) {
        await SIDE.gate(m, () => lvl(m, 'ellen') >= 2 && s.day > num(f['sf.ellen.delivered']), 'Doc Ellen has news', 'ellen');
        await m.until(() => f['sf.ellen.birdAsk']);
      }
      if (m.cp(40, from) && !f['sf.ellen.bird']) {
        const day = num(f['sf.ellen.birdAsk']) + 1;
        SIDE.obj(m, 'Birdwatching with Doc Ellen', 'harbor', `The harbour boardwalk, day ${day}, 11 am`);
        await m.until(() => s.day >= day && s.hour >= 10.5 && s.hour < 14);
        await m.reach(SIDE.at(G, 'harbor'), 16);
        await SIDE.idle(m);
        await m.scene(async (d) => {
          await d.bring('ellen', beside(G, 1.4, 0.8));
          d.cam(d.overShoulder('player', 'ellen'));
          await d.say('ellen', 'sf.ellen.q5');
        });
        const ok = await m.minigame('glass', { title: 'SPOT THE IVORY GULL' });
        await m.scene(async (d) => {
          await d.bring('ellen', beside(G, 1.4, 0.8));
          d.cam(d.closeUp('ellen', { side: 1, dist: 1.2 }));
          await d.say('ellen', ok ? 'sf.ellen.q6' : 'sf.ellen.q6b');
        });
        f['sf.ellen.bird'] = s.day;
        if (ok) f['sf.ellen.gull'] = true;
        SIDE.rel(G, 'ellen', 12);
      }
      if (m.cp(50, from) && !s.repairs['r.house.ellen']) await SIDE.gate(m, () => lvl(m, 'ellen') >= 3, "Doc Ellen's bird blind", 'ellen', 'It blew down in the storm');
      if (from <= 52) await workOrder(m, 'r.house.ellen', 50, from);
      if (m.cp(60, from)) await talkStep(m, 'sf.ellen.blindThanks', 'Tell Doc Ellen', 'ellen');
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Pearl
  'sf.pearl': {
    title: 'Return to Sender',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from)) await rounds(m, PARCELS, (x) => 'sf.pearl.p.' + x[0], "Deliver Pearl's parcels", (L) => 'For ' + L.map((x) => x[2]).join(', '));
      if (m.cp(20, from)) await talkStep(m, 'sf.pearl.i1', 'Collect from Pearl', 'pearl', 'Payment in information');
      if (m.cp(30, from) && !f['sf.pearl.i2']) {
        await SIDE.gate(m, () => lvl(m, 'pearl') >= 2 && s.day > num(f['sf.pearl.i1']), 'Pearl has news', 'pearl');
        await m.until(() => f['sf.pearl.i2']);
      }
      if (m.cp(40, from) && !f['sf.pearl.i3']) {
        await SIDE.gate(m, () => lvl(m, 'pearl') >= 3 && s.day >= 6 && s.day > num(f['sf.pearl.i2']), 'Pearl has more news', 'pearl');
        await m.until(() => f['sf.pearl.i3']);
      }
      if (m.cp(50, from) && !f['sf.pearl.box']) {
        await SIDE.gate(m, () => lvl(m, 'pearl') >= 4, 'Pearl wants to see you', 'pearl');
        await m.until(() => f['sf.pearl.box']);
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Chief Marta
  'sf.marta': {
    title: 'Wary Respect',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      if (m.cp(10, from) && !f['sf.marta.fixed']) {
        if (!SIDE.has(G, 'wire', 2)) {
          SIDE.obj(m, 'Wire for the police repeater', 'hardware', 'Brubaker Hardware: wire ×2');
          await m.until(() => SIDE.has(G, 'wire', 2));
        }
        SIDE.obj(m, 'Fix the police radio repeater', 'police.radio', 'Police station, Main St');
        await m.spot('radio', SIDE.at(G, 'police.radio'), 'Fix the radio repeater', 2.5);
        await m.minigame('wire', { title: 'REWIRE THE REPEATER' });
        SIDE.take(G, 'wire', 2);
        f['sf.marta.fixed'] = s.day;
        SIDE.spirit(G, 3);
      }
      if (m.cp(20, from)) await talkStep(m, 'sf.marta.thanked', 'Tell the Chief', 'marta', 'Police station, 8 am to 6 pm');
      if (m.cp(30, from) && !f['sf.marta.line']) {
        await SIDE.gate(m, () => lvl(m, 'marta') >= 2 && s.day > num(f['sf.marta.thanked']), 'The Chief wants a word', 'marta');
        await m.until(() => f['sf.marta.line']);
      }
      if (m.cp(40, from) && !f['sf.marta.checked']) {
        await SIDE.gate(m, () => lvl(m, 'marta') >= 3 && s.day >= 6 && s.day > num(f['sf.marta.line']), 'The Chief wants a word', 'marta');
        await m.until(() => f['sf.marta.checked']);
      }
      SIDE.finish(m);
    },
  },

  // ---------------------------------------------------------------- Evan
  'sf.evan': {
    title: 'Loyalty Program',
    async run(m, from) {
      const G = m.G, s = G.state, f = s.flags;
      void G;
      if (m.cp(10, from) && !f['sf.evan.s2']) {
        await SIDE.gate(m, () => lvl(m, 'evan') >= 2 && s.day >= 5, 'Visit Evan late at night', 'evan', 'NORTHSTAR 24, after 10 pm');
        await m.until(() => f['sf.evan.s2']);
      }
      if (m.cp(20, from) && !f['sf.evan.s3']) {
        await SIDE.gate(m, () => lvl(m, 'evan') >= 3 && s.day >= 8, 'Check on Evan', 'evan');
        await m.until(() => f['sf.evan.s3']);
      }
      SIDE.finish(m);
    },
  },
};
