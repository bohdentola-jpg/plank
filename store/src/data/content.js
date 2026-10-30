// Daily content pools: stickers, the Operator's jobs, news headlines,
// passwords, streak rewards, token exchange.

export const STICKER_PAGES = [
  { id: 'street', name: 'STREET', reward: { kind: 'pct', value: 15, label: '15% OFF' } },
  { id: 'under', name: 'UNDERGROUND', reward: { kind: 'off', value: 10, label: '$10 OFF' } },
  { id: 'legend', name: 'LEGENDS', reward: { kind: 'golden', value: 10, label: 'GOLDEN FARE CARD' } },
];

// art: an emblem kind (src/art/products.js) or a custom sticker drawing
export const STICKERS = [
  { id: 'bolt', name: 'Bolt', page: 'street', art: 'bolt', color: '#ffd23f', bg: '#2a2238' },
  { id: 'token', name: 'Token', page: 'street', art: 'token', color: '#ffd23f', bg: '#3ec7b0' },
  { id: 'rat', name: 'Rat Face', page: 'street', art: 'rat', color: '#b8b0d8', bg: '#ff4f9a' },
  { id: 'pizza', name: 'Pizza Slice', page: 'street', art: 'pizza', color: '#ffcf5a', bg: '#5aa0ff' },
  { id: 'spray', name: 'Spray Can', page: 'street', art: 'spray', color: '#ff4f9a', bg: '#7ed957' },
  { id: 'cheese', name: 'Cheese', page: 'street', art: 'cheese', color: '#ffd23f', bg: '#7b5cff' },
  { id: 'pigeon', name: 'Pigeon', page: 'street', art: 'pigeon', color: '#8d9bc0', bg: '#ffd23f' },
  { id: 'roach', name: 'Roach', page: 'street', art: 'roach', color: '#8a4b2a', bg: '#ff8a3d' },
  { id: 'train', name: 'The 3', page: 'under', art: 'train', color: '#d4473f', bg: '#2a2238' },
  { id: 'turnstile', name: 'Turnstile', page: 'under', art: 'turnstile', color: '#c8ccdc', bg: '#e8456b' },
  { id: 'phone', name: 'Phone Booth', page: 'under', art: 'phone', color: '#a49ad6', bg: '#ff8a3d' },
  { id: 'manhole', name: 'Manhole', page: 'under', art: 'manhole', color: '#5a5676', bg: '#7ed957' },
  { id: 'boombox', name: 'Boombox', page: 'under', art: 'boombox', color: '#d4473f', bg: '#3ec7b0' },
  { id: 'sneaker', name: 'Kicks', page: 'under', art: 'sneaker', color: '#f4efe6', bg: '#7b5cff' },
  { id: 'crown', name: 'Crown', page: 'under', art: 'crown', color: '#ffd23f', bg: '#e8456b' },
  { id: 'star', name: 'Star', page: 'under', art: 'star', color: '#ffd23f', bg: '#5aa0ff' },
  { id: 'gator', name: 'Big Al', page: 'legend', art: 'gator', color: '#4f9a4a', bg: '#140f26', hint: 'Find the sewer market.' },
  { id: 'ghost', name: 'The Conductor', page: 'legend', art: 'ghost', color: '#bff8ec', bg: '#2a5a5e', hint: 'Visit Old Hall.' },
  { id: 'ghosttrain', name: 'Ghost Train', page: 'legend', art: 'ghosttrain', color: '#9ad8c8', bg: '#140f26', hint: 'Ride the last train.' },
  { id: 'goldtoken', name: 'Gold Token', page: 'legend', art: 'goldtoken', color: '#ffd23f', bg: '#2a2238', hint: 'Keep a 7-day streak.' },
  { id: 'eye', name: 'Third Eye', page: 'legend', art: 'eye', color: '#b48cff', bg: '#2a1a4a', hint: 'Get into the Back Room.' },
  { id: 'shelly', name: 'Shelly', page: 'legend', art: 'shelly', color: '#9cbf6e', bg: '#ff9a3c', hint: 'Swipe in for the first time.' },
  { id: 'whiskers', name: 'Mr. Whiskers', page: 'legend', art: 'whiskers', color: '#f0a050', bg: '#e8456b', hint: 'Pet the bodega cat.' },
  { id: 'cups', name: 'Three Cups', page: 'legend', art: 'cups', color: '#d4473f', bg: '#c89a62', hint: 'Win 3 rounds of 3-Cup in one day.' },
];

export const stickerById = Object.fromEntries(STICKERS.map((s) => [s.id, s]));

// The Operator's daily jobs. `event` names match econ.track() calls.
export const MISSIONS = [
  { id: 'tag', text: 'Paint a piece on the Drip St Legal Wall', goal: 1, event: 'game:tag', reward: 30 },
  { id: 'tagB', text: 'Get a B or better on the Legal Wall', goal: 1, event: 'grade:tag', min: 'B', reward: 45 },
  { id: 'race', text: 'Run 400m in Rat Race', goal: 400, event: 'score:runner', mode: 'max', reward: 40 },
  { id: 'cups', text: 'Beat Three-Cup Charlie once', goal: 1, event: 'win:cups', reward: 35 },
  { id: 'claw', text: 'Win a prize from The Grabber', goal: 1, event: 'win:claw', reward: 40 },
  { id: 'ride', text: 'Ride the 3 to another station', goal: 1, event: 'ride', reward: 25 },
  { id: 'shops', text: 'Visit 4 different shops', goal: 4, event: 'visit', unique: true, reward: 30 },
  { id: 'floor', text: 'Pick up 5 tokens off the floor', goal: 5, event: 'pickup', reward: 30 },
  { id: 'bag', text: 'Put something in your bag', goal: 1, event: 'bag', reward: 20 },
  { id: 'talk', text: 'Talk to 3 strangers', goal: 3, event: 'talk', unique: true, reward: 25 },
  { id: 'wanted', text: 'Check out the WANTED poster', goal: 1, event: 'wanted', reward: 15 },
  { id: 'pet', text: 'Pet the bodega cat', goal: 1, event: 'pet', reward: 20 },
  { id: 'tip', text: 'Tip the busker on Drip St', goal: 1, event: 'tip', reward: 20 },
];

export const STREAK_REWARDS = [
  { tokens: 10 },
  { tokens: 15 },
  { tokens: 20, sticker: 'street' },
  { tokens: 25 },
  { tokens: 30 },
  { tokens: 40 },
  { tokens: 100, sticker: 'under', key: true },
];

export const EXCHANGE = [
  { id: 'ship', label: 'Free shipping coupon', cost: 150, coupon: { kind: 'ship', value: 0, label: 'FREE SHIPPING' } },
  { id: 'off5', label: '$5 off coupon', cost: 250, coupon: { kind: 'off', value: 5, label: '$5 OFF' } },
  { id: 'pct10', label: '10% off coupon', cost: 500, coupon: { kind: 'pct', value: 10, label: '10% OFF' } },
  { id: 'pct20', label: '20% off coupon', cost: 900, coupon: { kind: 'pct', value: 20, label: '20% OFF' } },
  { id: 'freeze', label: 'Streak freeze (keeps your streak if you miss a day)', cost: 200, freeze: true },
];

export const PASSWORDS = [
  { word: 'STAND CLEAR', riddle: '"Stand ____ of the closing doors." Two words, the whole phrase.' },
  { word: 'CHOPPED CHEESE', riddle: "The bodega's finest sandwich. Two words." },
  { word: 'SHOWTIME', riddle: 'What the dancers yell right before the pole tricks start. One word.' },
  { word: 'MIND THE GAP', riddle: 'London says it on every platform. Three words.' },
  { word: 'NEXT STOP', riddle: 'What the conductor says right before the station name. Two words.' },
  { word: 'EXPRESS', riddle: 'The train that skips your stop on purpose. One word.' },
  { word: 'LAST STOP', riddle: 'The end of the line. Two words.' },
  { word: 'NIGHT OWL', riddle: 'Who rides the train at 3am. Two words.' },
];

export const HEADLINES = [
  'Local pigeon refuses to move for oncoming train; train moves instead',
  'Rat seen carrying an entire pizza down the 1st Ave stairs, crowd applauds',
  "Transit authority blames delays on 'general vibes'",
  "Bodega cat Mr. Whiskers wins 'Least Bothered' award for ninth straight year",
  'Third rail reminds everyone that it is still electric',
  "Phone booth at Token Sq rings again. Nobody knows who's calling",
  'Scientists confirm the chopped cheese is a food group',
  'Commuter claims he saw an alligator in the sewer. Alligator declines to comment',
  'Ghost spotted on a platform at midnight, asks for a transfer',
  "Rascal's new piece on the Drip St legal wall is 'really something,' says Rascal",
  "Roachie buys six more pairs of sneakers, calls it 'a light week'",
  'DJ Echo can hear your playlist from three stations away. He has notes',
  "Big Cheese denies his chain is only 'medium heavy'",
  'Weather underground: 74 degrees and slightly damp, forever',
  'Commuter finds a seat on the 3 at rush hour. Experts call it a miracle',
  "Three-Cup Charlie insists the game is fair. Nobody believes Charlie",
  'The Grabber claw machine accused of having a weak grip; claw says it is sore',
];
