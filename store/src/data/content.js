// Daily content: Signal's jobs, the punch-in streak, capsule odds, vault
// passwords and news headlines. Tune the numbers here.

// Odds are percentages by rarity. Pity guarantees `min` rarity or better by the
// `at`-th pull in a row without one.
export const CAPSULES = {
  basic: {
    name: 'BASIC CAPSULE', cost: 250, color: '#3ec7b0',
    odds: { common: 58, uncommon: 27, rare: 11, epic: 3.2, legendary: 0.7, mythic: 0.1 },
    pity: { at: 40, min: 'epic' },
  },
  deluxe: {
    name: 'DELUXE CAPSULE', cost: 1200, color: '#ff4f9a',
    odds: { rare: 62, epic: 28, legendary: 8.5, mythic: 1.5 },
    pity: { at: 25, min: 'legendary' },
  },
};

// Tickets are free pulls. `basic` = a basic capsule; the others guarantee a tier.
export const TICKETS = {
  basic: { name: 'CAPSULE TICKET', odds: CAPSULES.basic.odds },
  epic: { name: 'EPIC TICKET', odds: { epic: 85, legendary: 13, mythic: 2 } },
  legendary: { name: 'LEGENDARY TICKET', odds: { legendary: 90, mythic: 10 } },
};

export const PRISMATIC_CHANCE = 1 / 200;   // any capsule pull
export const SHOP_PRISMATIC_CHANCE = 1 / 500; // any shop purchase
export const FREEZE_COST = 300;
export const DROP_DISCOUNT = 25;

// The 7-day punch-in cycle. It repeats; the streak count keeps climbing.
export const STREAK = [
  { tokens: 30 },
  { tokens: 40 },
  { tokens: 50, ticket: 'basic' },
  { tokens: 60 },
  { tokens: 70 },
  { tokens: 80 },
  { tokens: 150, ticket: 'epic' },
];

// Extra rewards on these streak days.
export const MILESTONES = {
  14: { ticket: 'epic' },
  30: { item: 'ms-30' },
  60: { ticket: 'legendary' },
  100: { item: 'ms-100' },
  365: { item: 'ms-365' },
};

// Signal's daily jobs. `event` names match econ.track() calls.
export const JOBS = [
  { id: 'tryon', text: 'Try on 3 different items in the shops', goal: 3, event: 'tryon', unique: true, reward: 40 },
  { id: 'buy', text: 'Buy something with tokens', goal: 1, event: 'buy', reward: 60 },
  { id: 'capsule', text: 'Pull a capsule (the free one counts)', goal: 1, event: 'capsule', reward: 40 },
  { id: 'fit', text: 'Change your fit: put on 2 different items', goal: 2, event: 'equip', unique: true, reward: 40 },
  { id: 'cars', text: 'Walk through 5 different cars', goal: 5, event: 'car', unique: true, reward: 40 },
  { id: 'change', text: 'Find 3 loose tokens around the train', goal: 3, event: 'pickup', reward: 40 },
  { id: 'tag', text: 'Paint a piece on the Tag Wall', goal: 1, event: 'game:tag', reward: 40 },
  { id: 'tagB', text: 'Get a B or better on the Tag Wall', goal: 1, event: 'grade:tag', min: 'B', reward: 60 },
  { id: 'run', text: 'Run 400m in Tunnel Run', goal: 400, event: 'score:runner', mode: 'max', reward: 50 },
  { id: 'shell', text: 'Beat Eight’s shell game once', goal: 1, event: 'win:cups', reward: 50 },
  { id: 'claw', text: 'Win a prize from The Grabber', goal: 1, event: 'win:claw', reward: 50 },
  { id: 'talk', text: 'Talk to 3 different shopkeepers', goal: 3, event: 'talk', unique: true, reward: 30 },
  { id: 'drops', text: 'Check today’s drops on the job board', goal: 1, event: 'drops', reward: 20 },
];
export const JOBS_BONUS = 100;

export const PASSWORDS = [
  { word: 'STAND CLEAR', riddle: '“____ ____ of the closing doors.” Two words.' },
  { word: 'MIND THE GAP', riddle: 'What some platforms say about the space by the train. Three words.' },
  { word: 'NEXT STOP', riddle: 'What the speaker says right before a station name. Two words.' },
  { word: 'EXPRESS', riddle: 'The train that skips your stop on purpose. One word.' },
  { word: 'LAST STOP', riddle: 'The end of the line. Two words.' },
  { word: 'NIGHT OWL', riddle: 'Who rides this train at 3 a.m. Two words.' },
  { word: 'FRESH PAINT', riddle: 'What the sign on a wet wall says. Two words.' },
  { word: 'FIT CHECK', riddle: 'What you yell right before showing off your outfit. Two words.' },
];

export const HEADLINES = [
  'Drippy spills an entire bucket in Car 2, calls it “the new collection”',
  'Rider spotted in a full mythic fit; whole car goes silent',
  'Signal reminds everyone the doors close whether you’re ready or not',
  'Lace buys six more pairs of sneakers, calls it “a light week”',
  'Mira declares Car 5 “too sparkly,” adds more sparkle',
  'Ghost car seen coupled to the back of the train again. Signal: “what ghost car”',
  'Plug denies the vault exists, from inside the vault',
  'Eight insists the shell game is fair. Nobody believes Eight',
  'Cone directs traffic in the aisle. There is no traffic',
  'Joy sets a new Tunnel Run record, refuses to share the secret',
  'Prismatic sighting: rider pulls a shimmering item from the basic machine. Witnesses weep',
  'Rumor: someone has ridden the Drip Line 100 days straight. Halo confirmed',
  'The Grabber’s grip is “emotionally weak,” says The Grabber',
  'Weather report: 74 degrees in every car, forever',
  'Train has not stopped at a station since 1999. Riders: “we’re good”',
];
