// The campaign. Seven levels, one Griffin each, played in order like the game
// this is all a tribute to: story jobs unlock the next level, a bonus job and
// a set of collectibles sit alongside them, and every level opens and closes
// with a cutscene.
//
// The plot: Pawtucket Patriot ULTRA turns up in Quahog, everybody who drinks it
// starts clucking, and the trail runs through the brewery, the news, the estate
// and a very large chicken.

const at = (spot, dx = 0, dz = 0) => ({ spot, dx, dz });

/** The cold open: the family, the couch, and an advert. */
export const OPENING = [
  { who: 'peter', line: "Everybody shut up, the game's on. Lois! Beer!", shot: 'wide', dur: 2.6 },
  { who: 'lois', line: "Get your own beer, Peter. I'm not a vending machine.", shot: 'two' },
  { who: 'peter', line: "You are TOO a vending machine. You're just out of order a lot.", shot: 'closeup' },
  { who: 'brian', line: "Hey — turn it up. Look at this.", shot: 'over' },
  { who: 'tucker', line: "NEW from Pawtucket Patriot: ULTRA. Bolder. Smoother. Now with natural flavours.", shot: 'closeup', dur: 3.6 },
  { who: 'stewie', line: "'Natural flavours.' In brackets. That is not a boast, that is a plea deal.", shot: 'closeup' },
  { who: 'peter', line: "Free samples on Spooner Street! Nobody move, I'll get the wagon!", shot: 'wide' },
  { who: 'lois', line: "…This is going to be one of those weeks, isn't it.", shot: 'closeup' },
];

// road-following routes for the driving jobs
const R = {
  spoonerRun: [[-150, -38], [-96, -44], [0, -48], [62, 2], [124, 52]],
  downtown: [[0, -48], [2, 10], [6, 110], [-60, 100], [-150, -38]],
  seafront: [[252, -110], [266, -24], [258, 60], [238, 150], [186, 96]],
  schoolRun: [[-150, -146], [-40, -150], [60, -146], [118, -146], [110, -40]],
  northLoop: [[-150, -264], [-20, -258], [120, -264], [118, -146], [-40, -150], [-150, -146]],
  millRun: [[-152, 176], [-40, 182], [80, 176], [190, 172], [214, 150]],
  airportRun: [[80, 176], [84, 214], [150, 218], [190, 172], [124, 52]],
  salvage: [[190, 172], [214, 150], [238, 150], [214, 240], [120, 250]],
};

export const LEVELS = [
  // ============================================================ LEVEL 1
  {
    id: 1, char: 'peter', name: 'SOMETHING IN THE BEER',
    area: 'Spooner Street', card: 'LEVEL ONE · PETER',
    intro: [
      { who: 'peter', line: "Lois! The good beer's gone and they replaced it with something called ULTRA.", shot: 'wide' },
      { who: 'lois', line: "Peter, it's the same brewery. It's probably fine.", shot: 'two' },
      { who: 'peter', line: "It tastes like a dare. Watch this.", shot: 'closeup' },
      { who: 'peter', line: "…Bawk. BAWK. Why did I say that. Lois, why did my mouth do that.", shot: 'closeup' },
      { who: 'brian', line: "That's the third person on this street today. Something's in that beer.", shot: 'over' },
    ],
    outro: [
      { who: 'brian', line: "Half of Spooner Street is clucking, Peter. Half.", shot: 'two' },
      { who: 'peter', line: "So what do we do, Brian? Because my plan was more beer.", shot: 'closeup' },
      { who: 'brian', line: "We follow it. I'll take downtown — somebody's shipping this stuff in by the pallet.", shot: 'closeup' },
    ],
    collectible: { name: 'Clam Coasters', n: 7, around: at('spooner'), radius: 74 },
    missions: [
      {
        id: 'l1m1', title: 'THE SIX-PACK PROBLEM', episode: 'STORY',
        start: at('griffin', 6, 12), reward: 300,
        desc: 'Round up every can of ULTRA on Spooner Street before the neighbours drink it.',
        brief: [
          { who: 'lois', line: "Peter, Quagmire's got a case of it, Cleveland's got a case of it—", shot: 'two' },
          { who: 'peter', line: "And I've got a wagon and a complete disregard for property lines.", shot: 'closeup' },
        ],
        objectives: [
          { type: 'collect', n: 7, around: at('spooner'), radius: 60, label: 'Collect the cans of ULTRA', item: 'crate' },
          { type: 'goto', to: at('griffin', 6, 14), label: 'Dump them at the house', r: 6 },
        ],
        outro: [{ who: 'peter', line: "Seven cases. I only drank two of them on the way. That's growth.", shot: 'closeup' }],
      },
      {
        id: 'l1m2', title: 'A WORD WITH THE NEIGHBOURS', episode: 'STORY',
        start: at('quagmire', 2, 12), reward: 360, requires: ['l1m1'],
        desc: 'Quagmire wants his case back. Loudly. So does everyone else on the street.',
        brief: [
          { who: 'quagmire', line: "Peter, you took beer out of my fridge. That's a giggity violation.", shot: 'two' },
          { who: 'peter', line: "Glenn, that beer is making people cluck. You clucked at a mailbox.", shot: 'closeup' },
          { who: 'quagmire', line: "…The mailbox clucked first.", shot: 'over' },
        ],
        objectives: [{ type: 'brawl', n: 6, label: 'Settle it in the street' }],
        outro: [{ who: 'quagmire', line: "Alright, alright. But I'm keeping the empties. Giggity.", shot: 'closeup' }],
      },
      {
        id: 'l1m3', title: 'THE DELIVERY TRUCK', episode: 'STORY',
        start: at('clam', 4, 12), reward: 420, requires: ['l1m2'],
        desc: 'A truck drops ULTRA at the Clam every afternoon. Follow the route it takes.',
        brief: [
          { who: 'jerome', line: "Truck comes at four, drops twenty cases, driver never says a word.", shot: 'two' },
          { who: 'peter', line: "Twenty cases! …I mean, that's terrible. That's a terrible amount of free beer.", shot: 'closeup' },
        ],
        objectives: [{ type: 'race', route: R.spoonerRun, time: 115, label: 'Tail the delivery route', drive: true }],
        outro: [{ who: 'peter', line: "It came from the brewery. Which I know, because I work there. Huh.", shot: 'closeup' }],
      },
      {
        id: 'l1m4', title: 'BAWK TO THE FUTURE', episode: 'STORY', boss: 1,
        start: at('clam', -8, 12), reward: 620, requires: ['l1m3'],
        desc: 'Ernie is guarding the Clam. Ernie has opinions about people asking questions.',
        brief: [
          { who: 'chicken', line: "BAWK.", shot: 'low' },
          { who: 'peter', line: "Oh come ON. Not you. Not today. I am investigating a beer.", shot: 'closeup' },
          { who: 'chicken', line: "BAAAAWK!", shot: 'wide' },
        ],
        objectives: [{ type: 'boss', hits: 6, label: 'Fight Ernie the Giant Chicken' }],
        outro: [{ who: 'peter', line: "He had a shipping manifest in his feathers. Who does that.", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l1b', title: 'THE LAWNMOWER MAN', episode: 'BONUS',
      start: at('swanson', 4, 12), reward: 260,
      desc: "Joe's borrowed mower is somewhere on the street. Smash the place up until it turns up.",
      brief: [
        { who: 'joe', line: "Somebody hid my mower, Peter. I've been round this block four times.", shot: 'two' },
        { who: 'peter', line: "Say no more, Joe. I'll find it. I'll find it so hard.", shot: 'closeup' },
      ],
      objectives: [{ type: 'smash', n: 9, label: 'Turn the neighbourhood over', time: 110 }],
      outro: [{ who: 'joe', line: "It was in my shed. …Thanks, though. Genuinely.", shot: 'closeup' }],
    },
  },

  // ============================================================ LEVEL 2
  {
    id: 2, char: 'brian', name: 'FOLLOW THE MONEY, THE DOG SAID',
    area: 'Downtown Quahog', card: 'LEVEL TWO · BRIAN',
    intro: [
      { who: 'brian', line: "Nobody in this town reads a label. I read the label.", shot: 'closeup' },
      { who: 'brian', line: "'Natural flavours.' In brackets. In four point type. That is a confession.", shot: 'closeup' },
      { who: 'stewie', line: "Are you narrating again? You're narrating. To yourself. In a car.", shot: 'two' },
      { who: 'brian', line: "It's called an internal monologue, Stewie. Get in.", shot: 'over' },
    ],
    outro: [
      { who: 'brian', line: "The distributor's paperwork all points at one account. A Pewterschmidt account.", shot: 'closeup' },
      { who: 'lois', line: "…Daddy. Of course it's Daddy.", shot: 'two' },
      { who: 'brian', line: "You're going to want to talk to him yourself, Lois. He hangs up on dogs.", shot: 'over' },
    ],
    collectible: { name: 'Pawtucket Coasters', n: 7, around: at('clam'), radius: 96 },
    missions: [
      {
        id: 'l2m1', title: 'PAPER TRAIL', episode: 'STORY',
        start: at('clam', 8, 12), reward: 330,
        desc: 'The manifest blew apart in the wind. Ten pages, all over downtown.',
        brief: [
          { who: 'brian', line: "Ten pages of shipping records, and Peter opened the car window.", shot: 'two' },
          { who: 'peter', line: "It was stuffy! Paper likes fresh air!", shot: 'closeup' },
        ],
        objectives: [
          { type: 'collect', n: 10, around: at('clam'), radius: 78, label: 'Chase down the manifest', item: 'page', time: 175 },
        ],
        outro: [{ who: 'brian', line: "Nine pages and a receipt for a hat. I'll take it.", shot: 'closeup' }],
      },
      {
        id: 'l2m2', title: 'THE FIVE OCLOCK EDITION', episode: 'STORY',
        start: at('channel5', 6, 14), reward: 400, requires: ['l2m1'],
        desc: 'Get the story to Channel 5 before the evening bulletin goes out.',
        brief: [
          { who: 'tucker', line: "Tom Tucker. I have ninety seconds and a hair appointment.", shot: 'two' },
          { who: 'brian', line: "The town's biggest employer is poisoning the town. That's your lead.", shot: 'closeup' },
          { who: 'tucker', line: "That's our biggest advertiser. …Bring me proof and I'll think about it.", shot: 'over' },
        ],
        objectives: [{ type: 'race', route: R.downtown, time: 105, label: 'Beat the bulletin across town', drive: true }],
        outro: [{ who: 'tucker', line: "We'll run it at two in the morning. Between the ads for ULTRA.", shot: 'closeup' }],
      },
      {
        id: 'l2m3', title: 'THE NOSE KNOWS', episode: 'STORY',
        start: at('docks', 0, 16), reward: 460, requires: ['l2m2'],
        desc: 'Crates are coming off a boat at the docks. Sniff out the ones that matter.',
        brief: [
          { who: 'seamus', line: "Arr, they unload at night and they don't sign for it.", shot: 'two' },
          { who: 'brian', line: "Right. Do not tell anyone I did this with my nose.", shot: 'closeup' },
        ],
        objectives: [
          { type: 'collect', n: 8, around: at('docks'), radius: 62, label: 'Sniff out the marked crates', item: 'crate', time: 150 },
        ],
        outro: [{ who: 'brian', line: "Same account paying for all of it. Old money. Very old money.", shot: 'closeup' }],
      },
      {
        id: 'l2m4', title: 'IMPOUNDED', episode: 'STORY',
        start: at('police', 0, 16), reward: 540, requires: ['l2m3'],
        desc: 'The QPD took the evidence. Take it back and lose them.',
        brief: [
          { who: 'joe', line: "Sorry, Brian. Someone made a call. The crates are evidence now.", shot: 'two' },
          { who: 'brian', line: "Someone made a call. Joe, listen to yourself.", shot: 'closeup' },
          { who: 'joe', line: "…Lot's round the back. I'm going to go be deaf for four minutes.", shot: 'over' },
        ],
        objectives: [
          { type: 'goto', to: at('police', 8, 18), label: 'Get to the impound lot', r: 6 },
          { type: 'evade', time: 65, wanted: 2, label: 'Lose the ones who did hear it' },
        ],
        outro: [{ who: 'brian', line: "I have the crates, the paperwork and a strong urge to lie down.", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l2b', title: 'BOOK TOUR', episode: 'BONUS',
      start: at('diner', 6, 12), reward: 300,
      desc: "Brian's novel is being remaindered across town. Collect them before anyone reads one.",
      brief: [{ who: 'brian', line: "They're in the bargain bin. Under a sign that says 'FREE'.", shot: 'closeup' }],
      objectives: [{ type: 'collect', n: 8, around: at('mall'), radius: 70, label: 'Buy back your own novel', item: 'page', time: 140 }],
      outro: [{ who: 'brian', line: "Eight copies. That's eight people who won't have to.", shot: 'closeup' }],
    },
  },

  // ============================================================ LEVEL 3
  {
    id: 3, char: 'lois', name: 'DADDY, WHAT DID YOU DO',
    area: 'Civic Center', card: 'LEVEL THREE · LOIS',
    intro: [
      { who: 'lois', line: "Daddy. Look at me. Did you buy the brewery?", shot: 'two' },
      { who: 'carter', line: "I buy a lot of things, Lois. I bought a mountain last week.", shot: 'closeup' },
      { who: 'lois', line: "Did you buy the brewery.", shot: 'closeup' },
      { who: 'carter', line: "…I bought the recipe. The bird came with it.", shot: 'over' },
      { who: 'lois', line: "The BIRD came with it?!", shot: 'closeup' },
    ],
    outro: [
      { who: 'carter', line: "Fine. FINE. The formula's in the safe at the plant and I want no part of it.", shot: 'two' },
      { who: 'lois', line: "You are going to fix this, Daddy.", shot: 'closeup' },
      { who: 'carter', line: "I'm going to do something better. I'm going to leave town.", shot: 'over' },
    ],
    collectible: { name: 'Parking Tickets', n: 7, around: at('cityhall'), radius: 90 },
    missions: [
      {
        id: 'l3m1', title: 'CITY HALL RUN-AROUND', episode: 'STORY',
        start: at('cityhall', 0, 20), reward: 350,
        desc: 'Get the recall order signed. Mayor West has notes.',
        brief: [
          { who: 'west', line: "You want me to ban a beer. Do you know what happened last time I banned a liquid?", shot: 'two' },
          { who: 'lois', line: "Mayor West, people are clucking in the street.", shot: 'closeup' },
          { who: 'west', line: "People cluck. That's a people thing. …But I'll sign it if you find my pen.", shot: 'over' },
        ],
        objectives: [
          { type: 'collect', n: 6, around: at('cityhall'), radius: 55, label: "Find the Mayor's pens", item: 'part' },
          { type: 'goto', to: at('cityhall', 0, 20), label: 'Back to the Mayor', r: 6 },
        ],
        outro: [{ who: 'west', line: "Six pens. One of them is a straw. I'll allow it. Signed.", shot: 'closeup' }],
      },
      {
        id: 'l3m2', title: 'THE HOSPITAL RUN', episode: 'STORY',
        start: at('hospital', 0, 18), reward: 430, requires: ['l3m1'],
        desc: 'Dr. Hartman needs samples from four bars. Gently — they are in glass.',
        brief: [
          { who: 'hartman', line: "Bring me samples and try not to shake them. Or drink them. Mostly the second one.", shot: 'two' },
          { who: 'lois', line: "I am not going to drink the clucking beer, doctor.", shot: 'closeup' },
        ],
        objectives: [
          { type: 'goto', to: at('clam', 0, 14), label: 'Sample from the Clam', r: 6 },
          { type: 'goto', to: at('hospital', 0, 18), label: 'Get it to the lab intact', r: 7, time: 105, maxCrashes: 3, cargo: 'samples' },
        ],
        outro: [{ who: 'hartman', line: "There's a compound in here I last saw in a poultry feed catalogue.", shot: 'closeup' }],
      },
      {
        id: 'l3m3', title: 'MODEL CITIZEN', episode: 'STORY',
        start: at('channel5', -8, 14), reward: 480, requires: ['l3m2'],
        desc: 'Channel 5 will run the story — if Lois fronts it. On camera. Around town.',
        brief: [
          { who: 'tucker', line: "Viewers trust a mother of three. Viewers do not trust a dog.", shot: 'two' },
          { who: 'lois', line: "Tom, if this gets it on air, I'll wear the hat.", shot: 'closeup' },
        ],
        objectives: [{ type: 'race', route: R.seafront, time: 110, label: 'Hit every location before the light goes', drive: true }],
        outro: [{ who: 'lois', line: "Six o'clock news. Front and centre. Peter is going to be unbearable.", shot: 'closeup' }],
      },
      {
        id: 'l3m4', title: 'THE CLUB', episode: 'STORY',
        start: at('cabana', 0, 16), reward: 560, requires: ['l3m3'],
        desc: 'Carter is hiding at the Cabana Club behind a wall of very polite security.',
        brief: [
          { who: 'barbara', line: "Your father is by the pool, dear. He has asked not to be shouted at.", shot: 'two' },
          { who: 'lois', line: "Then he shouldn't have bought a chicken, Mother.", shot: 'closeup' },
        ],
        objectives: [{ type: 'brawl', n: 7, label: 'Get past the club staff' }],
        outro: [{ who: 'carter', line: "You have your mother's eyes and your father's left hook.", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l3b', title: 'SCHOOL RUN', episode: 'BONUS',
      start: at('school', 0, 18), reward: 300,
      desc: 'Both kids, both ends of town, one school bell.',
      brief: [{ who: 'lois', line: "Chris is at the mall and Meg is at the diner and the bell is in four minutes.", shot: 'closeup' }],
      objectives: [{ type: 'race', route: R.schoolRun, time: 95, label: 'Get everyone to school', drive: true }],
      outro: [{ who: 'lois', line: "Made it. Nobody thank me. Nobody ever thanks me.", shot: 'closeup' }],
    },
  },

  // ============================================================ LEVEL 4
  {
    id: 4, char: 'stewie', name: 'THE FORMULA',
    area: 'Quahog Park', card: 'LEVEL FOUR · STEWIE',
    intro: [
      { who: 'stewie', line: "Right. The adults have had their turn and the town is still clucking.", shot: 'closeup' },
      { who: 'stewie', line: "I've isolated the compound. It's a behavioural agent. Rather good one, actually.", shot: 'closeup' },
      { who: 'brian', line: "You sound impressed.", shot: 'two' },
      { who: 'stewie', line: "I'm FURIOUS. Somebody did mind control in my town without inviting me.", shot: 'over' },
    ],
    outro: [
      { who: 'stewie', line: "The antidote works. I tested it on the dog. The dog is fine. Mostly.", shot: 'two' },
      { who: 'brian', line: "I can taste colours, Stewie.", shot: 'closeup' },
      { who: 'stewie', line: "Yes. Mostly. Now we need the plant's distribution list.", shot: 'closeup' },
    ],
    collectible: { name: 'Ray Gun Cells', n: 7, around: at('park'), radius: 80 },
    missions: [
      {
        id: 'l4m1', title: 'PARTS IS PARTS', episode: 'STORY',
        start: at('griffin', -8, 12), reward: 340,
        desc: 'The antidote needs components. The nursery does not stock plutonium.',
        brief: [
          { who: 'stewie', line: "Ten components. Most of them are in bins. Do not ask which bins.", shot: 'closeup' },
        ],
        objectives: [
          { type: 'collect', n: 10, around: at('spooner'), radius: 78, label: 'Scavenge components', item: 'part' },
        ],
        outro: [{ who: 'stewie', line: "Victory. And a tetanus risk. Mostly victory.", shot: 'closeup' }],
      },
      {
        id: 'l4m2', title: 'FIELD TEST', episode: 'STORY',
        start: at('park', 0, 16), reward: 420, requires: ['l4m1'],
        desc: 'Twelve clucking locals in the park. Dose them all.',
        brief: [
          { who: 'stewie', line: "This will either cure them or turn them inside out. Science is a spectrum.", shot: 'low' },
        ],
        objectives: [{ type: 'zap', n: 12, label: 'Dose the afflicted', time: 135 }],
        outro: [{ who: 'stewie', line: "Twelve for twelve, nobody inside out. I'm as surprised as you are.", shot: 'closeup' }],
      },
      {
        id: 'l4m3', title: 'BIG WHEEL, BIG PROBLEM', episode: 'STORY',
        start: at('clam', 8, 12), reward: 500, requires: ['l4m2'],
        desc: 'Brian bet the dog-track money that a tricycle cannot beat a hybrid across town.',
        brief: [
          { who: 'brian', line: "You. Me. Across Quahog. If I win you stop calling me 'the help'.", shot: 'two' },
          { who: 'stewie', line: "And when I win, you fetch. Properly. With the mouth.", shot: 'closeup' },
        ],
        objectives: [{ type: 'race', route: R.northLoop, time: 150, label: 'Beat Brian across town', drive: true, rival: 'brian' }],
        outro: [{ who: 'stewie', line: "Good dog. GOOD DOG. Say it with me.", shot: 'closeup' }],
      },
      {
        id: 'l4m4', title: 'THE BIRD AGAIN', episode: 'STORY', boss: 2,
        start: at('park', -18, 12), reward: 700, requires: ['l4m3'],
        desc: 'Ernie found the baby with the antidote. Ernie is not pleased.',
        brief: [
          { who: 'chicken', line: "BAWK BAWK.", shot: 'low' },
          { who: 'stewie', line: "Oh, you have picked the WRONG infant, poultry.", shot: 'closeup' },
        ],
        objectives: [{ type: 'boss', hits: 7, label: 'Put the bird down' }],
        outro: [{ who: 'stewie', line: "He dropped a keycard. A brewery keycard. How convenient. How suspicious.", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l4b', title: 'NAPTIME IS A CONSTRUCT', episode: 'BONUS',
      start: at('mall', 0, 26), reward: 320,
      desc: 'Stewie has four minutes before Lois notices the pram is empty.',
      brief: [{ who: 'stewie', line: "The window is open, the pram is decoy-weighted, and the mall has an arcade.", shot: 'closeup' }],
      objectives: [{ type: 'race', route: R.downtown, time: 92, label: 'Get back before you are missed', drive: true }],
      outro: [{ who: 'stewie', line: "Back in the pram, eyes glazed, drooling on cue. Nobody suspects the baby.", shot: 'closeup' }],
    },
  },

  // ============================================================ LEVEL 5
  {
    id: 5, char: 'chris', name: 'THE SCHOOL SHIPMENT',
    area: 'James Woods High', card: 'LEVEL FIVE · CHRIS',
    intro: [
      { who: 'chris', line: "So there's like a hundred crates in the gym and Coach says don't look in them.", shot: 'two' },
      { who: 'lois', line: "Sweetie, what was in the crates?", shot: 'closeup' },
      { who: 'chris', line: "Beer. And a chicken feather. And a note that said 'do not tell the dog'.", shot: 'closeup' },
      { who: 'brian', line: "…They know about me.", shot: 'over' },
    ],
    outro: [
      { who: 'chris', line: "I got the whole shipping list! It's going out through the airport tonight!", shot: 'two' },
      { who: 'meg', line: "Chris, that's actually really good work.", shot: 'closeup' },
      { who: 'chris', line: "I know! I'm as freaked out as you are!", shot: 'closeup' },
    ],
    collectible: { name: 'Detention Slips', n: 7, around: at('school'), radius: 78 },
    missions: [
      {
        id: 'l5m1', title: 'PAPER ROUTE', episode: 'STORY',
        start: at('griffin', 10, 12), reward: 320,
        desc: 'Eight houses, one bike, and a front page nobody is supposed to read.',
        brief: [
          { who: 'chris', line: "The paper ran Mom's story! I'm gonna put one on every porch on the street!", shot: 'closeup' },
        ],
        objectives: [
          { type: 'collect', n: 8, around: at('spooner'), radius: 66, label: 'Deliver the papers', item: 'paper', time: 145 },
        ],
        outro: [{ who: 'chris', line: "One went through a window. That one was on purpose. No it wasn't.", shot: 'closeup' }],
      },
      {
        id: 'l5m2', title: 'GYM CLASS HEROES', episode: 'STORY',
        start: at('school', 0, 18), reward: 420, requires: ['l5m1'],
        desc: 'Everyone in the yard has been on the ULTRA. Everyone in the yard wants a piece of Chris.',
        brief: [
          { who: 'shepherd', line: "Griffin! Whatever this is, do it outside and I'll pretend I was in a meeting.", shot: 'two' },
          { who: 'chris', line: "I'm gonna do the thing where I flail and everyone gets hurt!", shot: 'closeup' },
        ],
        objectives: [{ type: 'brawl', n: 8, label: 'Clear the yard' }],
        outro: [{ who: 'chris', line: "Nobody's calling me Bonus Round anymore. Probably.", shot: 'closeup' }],
      },
      {
        id: 'l5m3', title: 'THE GYM CRATES', episode: 'STORY',
        start: at('school', 14, 18), reward: 480, requires: ['l5m2'],
        desc: 'Break open every crate in the yard and find the shipping list.',
        brief: [
          { who: 'neil', line: "Chris, statistically one of those crates has the manifest in it.", shot: 'two' },
          { who: 'chris', line: "Neil, statistically I'm gonna hit all of them anyway.", shot: 'closeup' },
        ],
        objectives: [{ type: 'smash', n: 10, label: 'Crack the crates open', time: 130 }],
        outro: [{ who: 'chris', line: "Found it! It's a list! With words on it and everything!", shot: 'closeup' }],
      },
      {
        id: 'l5m4', title: 'LAST FLIGHT OUT', episode: 'STORY',
        start: at('airport', 0, 20), reward: 580, requires: ['l5m3'],
        desc: 'The shipment leaves from the airport tonight. Get there before the wheels go up.',
        brief: [
          { who: 'quagmire', line: "Chris, I'm flying a cargo run tonight and the manifest is all beer.", shot: 'two' },
          { who: 'chris', line: "Mr. Quagmire, don't take off! My dad's job is at stake! And also the town!", shot: 'closeup' },
          { who: 'quagmire', line: "…Alright. But you drive, because I've had four coffees. Giggity.", shot: 'over' },
        ],
        objectives: [{ type: 'race', route: R.airportRun, time: 118, label: 'Beat the cargo flight', drive: true }],
        outro: [{ who: 'chris', line: "We stopped a PLANE. With a VAN. I'm gonna be so grounded.", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l5b', title: 'THE EVIL MONKEY', episode: 'BONUS',
      start: at('junkyard', -12, -10), reward: 340,
      desc: 'The monkey from the closet was seen at the salvage yard. Pointing.',
      brief: [{ who: 'chris', line: "He's out here somewhere. He points. That's his whole thing. He POINTS.", shot: 'low' }],
      objectives: [{ type: 'race', route: R.salvage, time: 105, label: 'Chase him through the yard', drive: true }],
      outro: [{ who: 'chris', line: "Okay so he's not here. Which means he's at home. In my closet.", shot: 'closeup' }],
    },
  },

  // ============================================================ LEVEL 6
  {
    id: 6, char: 'meg', name: 'NOBODY NOTICES MEG',
    area: 'The Waterfront', card: 'LEVEL SIX · MEG',
    intro: [
      { who: 'brian', line: "They've got the plant locked down. Cameras, guards, the bird on the gate.", shot: 'wide' },
      { who: 'peter', line: "So we need someone nobody looks at. Someone forgettable. Someone—", shot: 'two' },
      { who: 'peter', line: "…Meg. Meg! Get in here! You're the plan!", shot: 'closeup' },
      { who: 'meg', line: "I've been standing here the whole time.", shot: 'closeup' },
      { who: 'lois', line: "See? Perfect.", shot: 'over' },
    ],
    outro: [
      { who: 'meg', line: "I walked in the front door. Nobody stopped me. Nobody said one word.", shot: 'closeup' },
      { who: 'meg', line: "I have the formula, the ledger and a staff badge with somebody else's face.", shot: 'closeup' },
      { who: 'peter', line: "That's my daughter! …That IS my daughter, right? Lois?", shot: 'two' },
    ],
    collectible: { name: 'Ferry Tokens', n: 7, around: at('docks'), radius: 90 },
    missions: [
      {
        id: 'l6m1', title: 'THE QUIET WAY IN', episode: 'STORY',
        start: at('docks', -14, 14), reward: 380,
        desc: 'Get onto the docks without a single person registering that you exist.',
        brief: [
          { who: 'meg', line: "Sixteen years of being invisible. Finally, a use case.", shot: 'closeup' },
        ],
        objectives: [
          { type: 'goto', to: at('docks', 6, 16), label: 'Walk in like you work there', r: 6 },
          { type: 'collect', n: 7, around: at('docks'), radius: 58, label: 'Lift the shipping tags', item: 'bag' },
        ],
        outro: [{ who: 'meg', line: "A guy held the gate open for me. He's going to be in so much trouble.", shot: 'closeup' }],
      },
      {
        id: 'l6m2', title: 'DELIVERY GIRL', episode: 'STORY',
        start: at('diner', 8, 14), reward: 430, requires: ['l6m1'],
        desc: 'The plant orders lunch from the diner every day. Meg is now the delivery girl.',
        brief: [
          { who: 'bruce', line: "Ohh nooo, the plant order is late and the moped has one gear.", shot: 'two' },
          { who: 'meg', line: "I'm going, Bruce. I'm literally already going.", shot: 'closeup' },
        ],
        objectives: [{ type: 'race', route: R.millRun, time: 100, label: 'Run the lunch order', drive: true }],
        outro: [{ who: 'meg', line: "Tips: four dollars. And a security badge nobody will miss.", shot: 'closeup' }],
      },
      {
        id: 'l6m3', title: 'HEAT', episode: 'STORY',
        start: at('brewery', 0, 26), reward: 520, requires: ['l6m2'],
        desc: 'Somebody finally noticed. Lose the whole department.',
        brief: [
          { who: 'joe', line: "Megan Griffin! Pull over! …Wait, who am I yelling at?", shot: 'wide' },
          { who: 'meg', line: "And there it is. They only see me when I've got something.", shot: 'closeup' },
        ],
        objectives: [{ type: 'evade', time: 70, wanted: 3, label: 'Disappear, like always' }],
        outro: [{ who: 'meg', line: "They gave up after four minutes. That's a personal best.", shot: 'closeup' }],
      },
      {
        id: 'l6m4', title: 'THE FEUD ENDS HERE', episode: 'STORY', boss: 3,
        start: at('docks', -8, 18), reward: 780, requires: ['l6m3'],
        desc: 'Ernie is on the dock between Meg and the last crate. Nobody else is coming.',
        brief: [
          { who: 'chicken', line: "BAWK?", shot: 'low' },
          { who: 'meg', line: "Yeah. Me. The one nobody notices. Big mistake, chicken.", shot: 'closeup' },
        ],
        objectives: [{ type: 'boss', hits: 8, label: 'End the feud' }],
        outro: [{ who: 'meg', line: "Somebody get a photo. Nobody is going to believe me.", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l6b', title: 'PROM NIGHT, EVENTUALLY', episode: 'BONUS',
      start: at('goldman', 0, 12), reward: 320,
      desc: 'Neil booked the prom limo. The limo is a moped.',
      brief: [
        { who: 'neil', line: "Meg! I secured us transportation! It has two wheels and a basket!", shot: 'two' },
        { who: 'meg', line: "Neil, I said no. In writing. Twice. …Fine. Get on.", shot: 'closeup' },
      ],
      objectives: [{ type: 'race', route: R.schoolRun, time: 92, label: 'Get to the dance', drive: true }],
      outro: [{ who: 'meg', line: "We came third in the dance contest. Out of three.", shot: 'closeup' }],
    },
  },

  // ============================================================ LEVEL 7
  {
    id: 7, char: 'peter', name: 'LAST CALL AT THE BREWERY',
    area: 'Pawtucket Works', card: 'LEVEL SEVEN · PETER',
    intro: [
      { who: 'lois', line: "The whole batch ships at midnight. Every bar in New England.", shot: 'wide' },
      { who: 'peter', line: "Then we go to the plant. I know the plant. I've been fired from the plant.", shot: 'two' },
      { who: 'brian', line: "Twice.", shot: 'closeup' },
      { who: 'peter', line: "Twice! Which means I know two ways in!", shot: 'closeup' },
      { who: 'stewie', line: "That is not how being fired works, but I admire the confidence.", shot: 'over' },
    ],
    outro: [
      { who: 'peter', line: "It's over. The vats are drained, the bird's in a crate, and the beer's just beer.", shot: 'wide' },
      { who: 'lois', line: "You actually did it, Peter.", shot: 'two' },
      { who: 'peter', line: "WE did it, Lois. Me, you, the kids, the dog, and the one nobody notices.", shot: 'closeup' },
      { who: 'meg', line: "Meg. My name is Meg.", shot: 'closeup' },
      { who: 'peter', line: "Right! Her! Freakin' sweet. Who wants a beer.", shot: 'wide' },
    ],
    collectible: { name: 'Golden Kegs', n: 7, around: at('brewery'), radius: 88 },
    missions: [
      {
        id: 'l7m1', title: 'BACK ON THE PAYROLL', episode: 'STORY',
        start: at('brewery', 0, 26), reward: 400,
        desc: 'Angela will badge Peter in — after he does one honest shift.',
        brief: [
          { who: 'angela', line: "One shift, Peter. Move the kegs, do not drink the kegs.", shot: 'two' },
          { who: 'peter', line: "Angela, that is the hardest thing anyone has ever asked me to do.", shot: 'closeup' },
        ],
        objectives: [
          { type: 'collect', n: 9, around: at('brewery'), radius: 62, label: 'Shift the kegs', item: 'crate', time: 160 },
        ],
        outro: [{ who: 'angela', line: "Nine kegs, none opened. I'm putting this in your file as a fluke.", shot: 'closeup' }],
      },
      {
        id: 'l7m2', title: 'THE VATS', episode: 'STORY',
        start: at('brewery', 16, 22), reward: 480, requires: ['l7m1'],
        desc: 'Drain the ULTRA before the trucks load. Smash every valve in the yard.',
        brief: [
          { who: 'stewie', line: "Every valve, you enormous man. Every single one.", shot: 'two' },
          { who: 'peter', line: "Smashing things I understand. Finally, a job for Peter.", shot: 'closeup' },
        ],
        objectives: [{ type: 'smash', n: 12, label: 'Drain the vats', time: 150 }],
        outro: [{ who: 'peter', line: "That's four thousand gallons of beer in a storm drain. I need a minute.", shot: 'closeup' }],
      },
      {
        id: 'l7m3', title: 'THE MIDNIGHT CONVOY', episode: 'STORY',
        start: at('brewery', -18, 24), reward: 620, requires: ['l7m2'],
        desc: 'Three trucks already left. Run them down before they reach the highway.',
        brief: [
          { who: 'brian', line: "Three trucks, one wagon, and the highway's twelve minutes away.", shot: 'two' },
          { who: 'peter', line: "Buckle up, Brian. And by that I mean hold on, the belt's been broken since 2004.", shot: 'closeup' },
        ],
        objectives: [{ type: 'race', route: R.millRun, time: 112, label: 'Run down the convoy', drive: true }],
        outro: [{ who: 'peter', line: "Three for three. One of them's in a pond. That counts.", shot: 'closeup' }],
      },
      {
        id: 'l7m4', title: 'BAWK AND ROLL', episode: 'STORY', boss: 4,
        start: at('brewery', 8, 28), reward: 1000, requires: ['l7m3'],
        desc: 'Ernie. The brewery floor. No coupon this time. Just the two of them.',
        brief: [
          { who: 'chicken', line: "BAAAAAWK.", shot: 'low' },
          { who: 'peter', line: "Yeah. I know. Same as always, buddy.", shot: 'closeup' },
          { who: 'peter', line: "Y'know what? Loser buys. Winner also buys, because I want a beer either way.", shot: 'wide' },
        ],
        objectives: [{ type: 'boss', hits: 10, label: 'Finish it' }],
        outro: [{ who: 'peter', line: "Good fight. Same time next season?", shot: 'closeup' }],
      },
    ],
    bonus: {
      id: 'l7b', title: 'THE VICTORY LAP', episode: 'BONUS',
      start: at('clam', 4, 14), reward: 500,
      desc: 'The Clam is buying. Get everybody there before the round goes cold.',
      brief: [{ who: 'jerome', line: "Free round for the man who drained a brewery. You have ten minutes.", shot: 'two' }],
      objectives: [{ type: 'race', route: R.downtown, time: 100, label: 'Round everyone up', drive: true }],
      outro: [{ who: 'peter', line: "To Quahog. Terrible town. Wouldn't live anywhere else.", shot: 'closeup' }],
    },
  },
];

// -------------------------------------------------------------- accessors
export const MISSIONS = LEVELS.flatMap((l) => [
  ...l.missions.map((m) => ({ ...m, level: l.id, char: l.char, story: true })),
  { ...l.bonus, level: l.id, char: l.char, story: false },
]);

export function missionById(id) { return MISSIONS.find((m) => m.id === id); }
export function levelById(id) { return LEVELS.find((l) => l.id === id); }
export function missionsForLevel(id) { return MISSIONS.filter((m) => m.level === id); }

/** Available right now: this level's jobs, in order, plus its bonus. */
export function availableIn(levelId, save) {
  return missionsForLevel(levelId).filter((m) => {
    if (save.done.includes(m.id)) return false;
    if (m.requires && !m.requires.every((r) => save.done.includes(r))) return false;
    return true;
  });
}

export function levelComplete(levelId, save) {
  const lvl = levelById(levelId);
  return !!lvl && lvl.missions.every((m) => save.done.includes(m.id));
}

export function storyProgress(save) {
  const total = LEVELS.reduce((n, l) => n + l.missions.length, 0);
  const done = LEVELS.reduce((n, l) => n + l.missions.filter((m) => save.done.includes(m.id)).length, 0);
  return { done, total };
}
