// Story dialog. Speakers: kids by id (dex, tony, zippy, marcus, priya, kevin, sam, jade, ray, maya) or 'captain' (the planet's team captain) or 'keeper'.
export const INTRO = [
  { who: 'dex', text: 'Okay, okay. Saturday. Maple Street. Undefeated season on the line. Which is one game. This game.' },
  { who: 'zippy', text: 'Can we PLEASE hurry up, my mom said dinner is at six and it is, like, four.' },
  { who: 'tony', text: 'I brought snacks. Halftime snacks. Also pre-game snacks. Those are gone.' },
  { who: 'kevin', text: 'My dad says if we scuff the lawn again he\'s going to "deploy countermeasures." I don\'t know what that means.' },
  { who: 'dex', text: 'Offense versus defense. Five on five. Laterals are legal. Complaining is not.' },
  { who: 'maya', text: 'You guys are going down. I can see the whole field from back here. It\'s mostly Tony.' },
  { who: 'dex', text: 'Let\'s run some plays. I drew up a whole notebook. Follow my lead.' },
];
export const TUTORIAL = {
  step1: ['Pick a play with ◀ ▶ then confirm. Start with a quick pass: SLANTS.', 'Snap the ball. Then throw to a receiver using the button shown over their head.'],
  step2: ['Now a run. Pick DIVE. After the handoff, steer with the left stick, sprint with R2, dive with ✕.', 'Runs are about finding the hole. Or making one.'],
  step3: ['Last one. The LONG BOMB. Pick VERTS and throw deep to Hands. Tap = lob, hold = bullet.', 'Just... trust the throw.'],
};
export const ABDUCTION = [
  { who: 'marcus', text: 'I got it, I got it, I got it, I got— where\'s the ball.' },
  { who: 'priya', text: 'Did that... did a UFO just take our football?' },
  { who: 'zippy', text: 'That is SO illegal. That has to be, like, a fifteen-yard penalty.' },
  { who: 'tony', text: 'It was signed by nobody. It was a Walmart ball. But it was OUR Walmart ball.' },
  { who: 'kevin', text: 'Guys. Guys. My dad works for GOOBER.' },
  { who: 'dex', text: 'The... snack company?' },
  { who: 'kevin', text: 'The Galactic Operations and Orbital Bureau for Exploration and Research. He has a rocket in the garage. He\'s "still working on it." It has cupholders.' },
  { who: 'maya', text: 'How many seats?' },
  { who: 'kevin', text: 'Ten. Which is weird, honestly. Almost like it\'s a plot device.' },
  { who: 'dex', text: 'All ten of us. Offense AND defense. We\'re getting that ball back.' },
];
export const LAUNCH = [
  { who: 'kevin', text: 'Okay. Big red button says "DO NOT PRESS." So that\'s the go button.' },
  { who: 'sam', text: 'I call shotgun. Wait. Is there a shotgun on a rocket? I call the front.' },
  { who: 'jade', text: 'If we die I\'m telling everyone this was Dex\'s play call.' },
  { who: 'dex', text: 'Seatbelts. Helmets. Ten. Nine. Eight. Skip to one.' },
];
export const TRAVEL = [
  ['zippy', 'Are we there yet?', 'kevin', 'We left eleven seconds ago.'],
  ['tony', 'Does this rocket have a fridge? Asking for a friend. The friend is me.', 'maya', 'It has a glove box with one glove in it.'],
  ['ray', 'I can see my house from here. No wait, that\'s a nebula.', 'priya', 'Same energy, honestly.'],
  ['sam', 'If the next planet has ice, I\'m calling a slide tackle.', 'dex', 'Please do not slide tackle an alien.'],
  ['marcus', 'I\'ve caught balls in the rain, the snow, and the dark. Space is just a new weather.', 'jade', 'Space is not weather.'],
  ['kevin', 'The nav computer says "recalculating." It has said that since Earth.', 'dex', 'That\'s fine. We follow the ball.'],
  ['zippy', 'New rule: whoever fumbles on an alien planet buys pizza.', 'tony', 'Pizza planet is real. I checked the star atlas.'],
  ['maya', 'Every team we beat gets stronger. So do we. That\'s how it works, right?', 'priya', 'That\'s how montages work.'],
];
// per-planet: arrive (captain intro + reaction), win (part handover), lose
export const PLANET_LINES = {
  luna: { arrive: [['captain', 'Welcome to Luna, Earthlings. We\'re the Loafers. We don\'t move much. We don\'t have to. Low gravity does the work.'], ['zippy', 'Everything here bounces. I love it here. I\'m never leaving.']], win: [['captain', 'Fine. FINE. Take the Stage-2 Booster. It\'s under the couch. Everything is under the couch.'], ['kevin', 'This booster is filthy. It\'s perfect.']], lose: [['captain', 'Gravity isn\'t the only thing that\'s low around here. Try again after a nap.']] },
  mars: { arrive: [['captain', 'Sergeant Curiosity, Rover Rangers. State your mission, organics.'], ['dex', 'A UFO took our football. We\'re getting it back one planet at a time.'], ['captain', 'A noble mission. We will crush it anyway.']], win: [['captain', 'Mission log: defeated by children. Take the Dust Filter. Do not get dust on it. You will get dust on it.']], lose: [['captain', 'Analysis complete: you lost. Recommendation: run the ball less into me.']] },
  venusia: { arrive: [['captain', 'Nimbus here! Welcome to Cloud Nine! Mind the drop. It\'s about forty miles.'], ['tony', 'I\'m not looking down. I\'m looking at snacks. The snacks are also floating.']], win: [['captain', 'You out-threw a bird. Take the Heat Shield. Venus is spicy.']], lose: [['captain', 'The wind giveth and the wind taketh away. Mostly taketh.']] },
  glacius: { arrive: [['captain', 'Waddles McGee. Frostbite Penguins. It\'s cold. That\'s the intro.'], ['sam', 'SLIDE TACKLE TIME.'], ['dex', 'Sam, no.']], win: [['captain', 'Cryo Coolant, yours. Keep it cold. That\'s not a joke, it explodes warm.']], lose: [['captain', 'You slipped. We slid. Different things.']] },
  pyros: { arrive: [['captain', 'BLAZE KOWALSKI. MAGMA SALAMANDERS. WE ONLY THROW DEEP.'], ['priya', 'Why is he yelling?'], ['captain', 'THE LAVA IS LOUD.']], win: [['captain', 'A THERMAL GASKET. FORGED IN FIRE. YOU EARNED IT. INDOOR VOICE: nice game.']], lose: [['captain', 'YOU GOT BURNED. LITERALLY, PROBABLY. GET SOME ALOE.']] },
  fungaria: { arrive: [['captain', 'Portobello Pete. Sporesmen. Everything you touch here will be a little sticky. Including the ball.'], ['marcus', 'Sticky is good. Sticky is my whole brand.']], win: [['captain', 'The Spore Scrubber is yours. Your rocket will smell like a forest. A forest, not a gym.']], lose: [['captain', 'The ball stuck to us. That\'s how catching works here. Try harder.']] },
  aquaria: { arrive: [['captain', 'Finnegan, Reef Riptides. The dome keeps the ocean out and the football in.'], ['ray', 'Why are the fish wearing helmets?'], ['captain', 'Why are YOU wearing helmets?']], win: [['captain', 'Ballast Pump for the winners. Your rocket has been listing to the left, by the way. Everyone noticed.']], lose: [['captain', 'You swam like Earthlings. Which is to say: poorly.']] },
  dunetopia: { arrive: [['captain', 'Sheik Stinger welcomes you to the Bazaar. Everything is for sale. Except the win.'], ['jade', 'Sand in my cleats already. This planet is a personal attack.']], win: [['captain', 'Sand Bearings. Glass, hand-rolled. Cheaper than steel and twice as sandy.']], lose: [['captain', 'The storm ate your pass. The storm eats everyone\'s pass.']] },
  sugarshock: { arrive: [['captain', 'GUMMY GUS! GUMDROP GOBBLERS! WELCOME TO SUGARSHOCK, WHERE EVERYTHING IS DELICIOUS!'], ['tony', 'I have found my people.']], win: [['captain', 'A Sugar Glass Window for your rocket! Do not lick it in flight. Or do. It\'s your window.']], lose: [['captain', 'Sugar crash! Better luck next time, sweetie!']] },
  prismara: { arrive: [['captain', 'Quartz. Prism Facets. We have seen every route you have ever run. Refracted, but seen.'], ['dex', 'Then you know what\'s coming.'], ['captain', 'Yes. Sluggo Bomb. Left.']], win: [['captain', 'A Crystal Oscillator. It keeps time perfectly. Unlike your offense, apparently.']], lose: [['captain', 'Predicted. Refracted. Rejected.']] },
  neonprime: { arrive: [['captain', 'glitch@bandits:~$ welcome earthlings. we\'ve read your playbook. we\'ve read your diary.'], ['maya', 'Dex, you have a DIARY?'], ['dex', 'It\'s a PLAYBOOK with FEELINGS.']], win: [['captain', 'nav computer installed. it will stop saying "recalculating." probably.']], lose: [['captain', '404: touchdown not found.']] },
  scrapheap: { arrive: [['captain', 'Rusty Rex. Junkyard Dawgs. Everything on this planet is broken. Especially the tackling. Broken the OTHER way.'], ['sam', 'Finally. A team that hits.']], win: [['captain', 'Salvaged Thrusters. Two different rockets. They work great together. Mostly.']], lose: [['captain', 'You got crunched. Welcome to the heap.']] },
  hivea: { arrive: [['captain', 'Queen Beatrix. Buzzsaw Bees. All decisions here are made by committee, in about four seconds, loudly.'], ['zippy', 'They\'re so FAST.']], win: [['captain', 'Honeycomb Insulation. Your cabin will be warm and smell like breakfast for eternity.']], lose: [['captain', 'The swarm cometh. The swarm tackleth. Bye.']] },
  spectra: { arrive: [['captain', 'BOOooo. It\'s Casper Jr. Boo Crew. Nobody\'s ever tackled us. Nobody can.'], ['ray', 'Is this planet haunted?'], ['captain', 'We literally are the haunting.']], win: [['captain', 'Ectoplasm Battery. Charged with spooky. Never dies. Like us.']], lose: [['captain', 'You tackled air. Air won.']] },
  jurassica: { arrive: [['captain', 'REX RUTHLESS. Thunder Lizards. We run the ball. We run it at you. We run it through you.'], ['tony', 'I like this guy.']], win: [['captain', 'Fossil Fuel Cell. Made from my great-grandfather. He\'d be honored. Probably.']], lose: [['captain', 'STAMPEDE. That\'s the recap.']] },
  gorgonzola: { arrive: [['captain', 'Brie Larson. Cheddar Chompers. Yes, that Brie. No, not that one.'], ['priya', 'This whole planet smells like a lunchbox.']], win: [['captain', 'Cheese Wax Sealant. Seals anything. Attracts everyone.']], lose: [['captain', 'You found the hole. Then you fell in it.']] },
  skullrock: { arrive: [['captain', 'ARRR. Captain Squawkbeard. Buccaneer Parrots. Your ball is treasure and we steal treasure.'], ['marcus', 'You WISH you could steal my treasure. Also I don\'t have the ball. That\'s the whole problem.']], win: [['captain', 'A Plundered Plasma Coil. Found it. Fair and square. In someone else\'s ship.']], lose: [['captain', 'Walk the plank, landlubbers. It\'s just a practice field. Still.']] },
  vegavegas: { arrive: [['captain', 'Ace Whiskers. High Rollers. House rules: the house wins.'], ['dex', 'We\'re not the house.'], ['captain', 'Exactly.']], win: [['captain', 'Lucky Dice Gyroscope. Sevens all the way up. Rocket stays level, wallet stays empty.']], lose: [['captain', 'Better luck next time. There is no next time. Kidding! There is.']] },
  verdantia: { arrive: [['captain', 'Fern Gully, Garden Guardians. Please don\'t step on the flowers. They\'re my cousins.'], ['jade', 'The flowers are... looking at me.']], win: [['captain', 'A Photosynthesis Panel. Park in the sun. Water once a week.']], lose: [['captain', 'You got tangled. Vines do that.']] },
  cogsworth: { arrive: [['captain', 'Foreman Flywheel. Cog Crushers. Shift starts now. Shift ends when you lose.'], ['kevin', 'Everything here weighs a ton. Including me.']], win: [['captain', 'Precision Gearbox. Zero rattle. Your rocket will finally stop sounding like a dryer.']], lose: [['captain', 'Crushed. Efficiently.']] },
  stratos: { arrive: [['captain', 'Blimpy! Zephyrs! Welcome to the sky! Don\'t drop anything. It\'s a long way down and it never lands.'], ['sam', 'What if I drop a TACKLE though.']], win: [['captain', 'Helium Regulator. Your rocket voice will go back to normal.'], ['zippy', 'Aw.']], lose: [['captain', 'Everything floats here. Except your chances.']] },
  bubblonia: { arrive: [['captain', 'Bubbles O\'Brien! Poppers! Tackle us and we just re-form a yard downfield. It\'s very annoying. For you.'], ['maya', 'That IS annoying.']], win: [['captain', 'Iridescent Coating. Rainbow rocket. Deflects micro-meteors and compliments.']], lose: [['captain', 'POP. Reform. POP. Reform. Touchdown.']] },
  groovetron: { arrive: [['captain', 'DISCO STU! FUNKY FLAMINGOS! Every play has a rhythm, baby!'], ['ray', 'I have no rhythm.'], ['captain', 'Then you have no chance, baby!']], win: [['captain', 'Groove Stabilizer. Your rocket bobs to the beat now. There\'s no off switch.']], lose: [['captain', 'You got out-boogied. Happens to the best.']] },
  bibliotheca: { arrive: [['captain', '*whispers* Professor Hootenanny. Dewey Decimals. We\'ve read your playbook. Twice. Please keep your voice down.'], ['tony', 'SORRY.'], ['captain', '*glares*']], win: [['captain', '*whispers* The Star Atlas. It shows the deep galaxy. Return it in 4,000 years or pay the fee.']], lose: [['captain', '*whispers* Overdue. Try again.']] },
  slimeworld: { arrive: [['captain', 'Ooze Ozzy. Goo Crew. Everything drips. Mind the puddles. The puddles are also us.'], ['priya', 'I stepped on someone. Sorry!']], win: [['captain', 'Goo Lubricant. Silences squeaks. Adds squelches. Net zero noise.']], lose: [['captain', 'Slipped right through you. Literally.']] },
  pepperoni: { arrive: [['captain', 'Sal Monella, Crust Crusaders. Best slice in the galaxy and the best deep dish defense.'], ['tony', 'I would like to live here. Is there a form.']], win: [['captain', 'Pizza Oven Reactor. Runs hot, smells amazing, cooks three pies per light-year. Extra cheese.']], lose: [['captain', 'You got sauced. Try the garlic knots.']] },
  halo: { arrive: [['captain', 'Unit Prime. Halo Sentinels. We have simulated this game four million times. You win 3%.'], ['dex', 'Then this is one of the three.']], win: [['captain', 'Anomaly detected. Ring Drive Coupler transferred. Recalibrating pride.']], lose: [['captain', 'As simulated.']] },
  eventhorizon: { arrive: [['captain', 'Vex. Singularity Slingers. Time is weird here. Your loss already happened.'], ['kevin', 'The rocket\'s clock says it\'s Tuesday. It\'s not Tuesday.']], win: [['captain', 'The Gravity Anchor. It keeps you from falling into anything. The mothership is next. It\'s past the horizon. Everything is.']], lose: [['captain', 'Told you. Already happened.']] },
  chronos: { arrive: [['captain', 'Big Ben. Second Hands. You are 0.4 seconds late. To everything.'], ['zippy', 'Not to THIS. I\'m fast.'], ['captain', 'You were 0.4 seconds late saying that.']], win: [['captain', 'The Chrono Synchronizer. The last part. Your rocket can reach the Mothership. Tick. Tock.'], ['dex', 'The ball. Finally.']], lose: [['captain', 'Time\'s up. Reset the clock.']] },
  mothership: { arrive: [['captain', 'Greetings, specimens. I am Zorp. You have come a long way for a ball with a Walmart logo.'], ['marcus', 'It\'s OUR Walmart logo.'], ['captain', 'We have studied your football. We have built a stadium. We will beat you with your own game. Then we keep the ball.'], ['dex', 'One game. Winner takes the ball. And you never come to Maple Street again.'], ['captain', 'Agreed. Probe Squad, suit up.']], win: [['captain', 'Impossible. We watched every game ever played. Through your windows.'], ['dex', 'You never watched us play together.'], ['captain', 'Take the ball. Go home. We\'ll find another hobby. Bowling, perhaps.']], lose: [['captain', 'The ball remains ours. Come back when you\'ve grown. You won\'t. You\'re specimens.']] },
};
export const ENDING = [
  { who: 'dex', text: 'Home. Maple Street. The same lawn. Kevin\'s dad is going to lose it.' },
  { who: 'kevin', text: 'The rocket is technically improved. It has a pizza oven now.' },
  { who: 'marcus', text: 'Never throwing it again. Never. We RUN the ball. Forever. Ball never leaves the ground.' },
  { who: 'zippy', text: 'Give it to me. I got this. What could possibly happen.' },
];
export const ENDING2 = [
  { who: 'zippy', text: '...' },
  { who: 'tony', text: 'That was a fumble. That was a fumble AND an abduction.' },
  { who: 'kevin', text: 'The rocket has fuel. Half a tank. Pizza oven\'s hot.' },
  { who: 'dex', text: 'No. No no no. Everyone inside.' },
  { who: 'dex', text: 'Let\'s just go play Madden.' },
];
export const CREDITS = ['GRIDIRON GALAXY', 'THE LONG BOMB', '', 'STARRING', 'The Cul-de-Sac Comets', 'Dex · Big Tony · Zippy · Hands · Priya', 'Kevin · The Wall · Jade · Lil\' Ray · Maya', '', 'FEATURING', 'Twenty-nine planets of very sore losers', 'and one Probe Squad', '', 'GOOBER', 'Galactic Operations & Orbital Bureau for Exploration & Research', '"Still working on it."', '', 'Thanks for playing.', 'Now go play Madden.'];
