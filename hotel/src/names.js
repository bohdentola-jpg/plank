// Who walks through the door, what they want, and what they say about you
// afterwards. Pure data and a couple of dice rolls — no imports, no state.

// ------------------------------------------------------------------ people
// Broad on purpose: the people who stop at a roadside hotel come from everywhere.
const FIRST = [
  'Dolores','Marcus','Eleanor','Harold','Beverly','Vernon','Gladys','Marlene','Otis','Pearl',
  'Ruth','Dennis','Wanda','Curtis','Lorraine','Roy','Bernice','Stanley','Grace','Cliff',
  'Priya','Anil','Rohan','Meera','Ravi','Nadia','Farida','Yusuf','Hassan','Amina',
  'Tariq','Layla','Omar','Karim','Yara','Samira','Nour','Elif','Emre','Dilara',
  'Chidi','Ngozi','Kwame','Adaeze','Femi','Zainab','Kofi','Abena','Tunde','Chinedu',
  'Mei','Wei','Jian','Xiulan','Haruto','Yumi','Kenji','Sakura','Minjun','Jiwoo',
  'Linh','Thanh','Bayu','Siti','Arun','Kalinda','Rina','Dewi',
  'Sofia','Mateo','Camila','Diego','Lucia','Javier','Rosa','Esteban','Ines','Rafael',
  'Kasia','Piotr','Ivan','Natalia','Milena','Zoran','Ana','Tomas',
  'Freya','Lars','Ingrid','Sven','Annika','Jonas','Sanna','Mikkel',
  'Tavita','Sione','Malia','Keanu','Aroha','Nikau',
];

const LAST = [
  'Whitaker','Ashcroft','Pemberton','Hargrove','Dunlop','Faircloth','Ainsley','Bramble','Cobb','Vickery',
  'Sowerby','Yardley','Wexler','Halloran','Doherty','Kearney','MacAllister','Sullivan','Radcliffe','Trent',
  'Oyelaran','Adeyemi','Okonkwo','Balogun','Nwosu','Danso','Mensah','Kimani','Wanjiru','Abara',
  'Diallo','Traore','Camara','Bekele','Tesfaye','Njoroge',
  'Ramirez','Delacruz','Montoya','Quintero','Salgado','Bustos','Peralta','Villalobos','Cardenas','Reyes',
  'Ferreira','Almeida','Barbosa','Azevedo','Rossi','Marchetti','Katsaros','Papadakis',
  'Chatterjee','Iyer','Bhandari','Kulkarni','Sandhu','Rahman','Pillai','Raghunathan',
  'Nakamura','Watanabe','Fujimoto','Zhang','Zhao','Cheung','Song','Bae','Lim','Han',
  'Nguyen','Tran','Phan','Wibowo','Santos','Alcantara',
  'Kowalczyk','Nowak','Zielinski','Novotny','Petrovic','Vukovic','Sokolov','Marek',
  'Vandermeer','DeGroot','Hollstein','Kessler','Schuster','Haas',
  'Lindqvist','Halvorsen','Aaltonen','Bjornstad',
  'Haddad','Najjar','Karimi','Shirazi','Mansour','Bakhtiari',
  'Kealoha','Faleolo','Tuilagi','Ngata',
];

// Motel crews collect nicknames. A few of them never get called anything else.
const NICKS = ['Sunny','Bo','Chip','Dot','Junie','Red','Mack','Sal','Pip','Ace','Duke','Birdie','Skip','Tally'];

const MIDDLE_INITIALS = 'ABCDEHJKLMNPRSTVW';
const SUFFIXES = ['Jr.', 'Sr.', 'III'];

// ------------------------------------------------------------------ hotels
const HOTEL_ADJ = [
  'Cardinal','Golden','Silver','Crimson','Copper','Amber','Blue','Emerald','Quiet','Lonesome',
  'Weary','Grand','Little','Old','Twin','Sleepy','Painted','Wandering','Western','Northern',
  'Lucky','Rusty','Hidden','Wayside','Evening','Midnight','Starlit','Dusty','Royal','Merry',
  'Restful','Halfway','Lazy','Happy','Gilded','Roadside','Faithful','Humble',
];

const HOTEL_NOUN = [
  'Heron','Magpie','Elk','Pines','Cedar','Willow','Juniper','Sagebrush','Antler','Lantern',
  'Anchor','Compass','Bell','Wheel','Kettle','Spur','Saddle','Mesa','Canyon','Bluff',
  'Creek','Ridge','Hollow','Meadow','Harbour','Lighthouse','Windmill','Depot','Junction','Crossing',
  'Mill','Orchard','Palm','Aspen','Birch','Fox','Owl','Stag','Swan','Sparrow',
  'Coyote','Buffalo','Prospector','Traveller','Drifter','Pilgrim','Wayfarer','Comet','Rocket','Sundial',
];

const HOTEL_SUFFIX = [
  'Arms','Inn','Lodge','Motel','Motor Lodge','Motor Court','Motor Inn','House','Rest','Court',
  'Cabins','Rooms','Manor','Hotel','Retreat','Bungalows','Stop','Halt','Guest House','Roadhouse',
];

// Deliberately misspelled, because the neon sign charges by the letter.
const HOTEL_NEON = ['Starlite','Nite Owl','Sleep-E-Z','Kozy','Wagon Wheel','Blu-Vue','Sun-N-Sand','Dew Drop', 'Hi-Way', 'Klean Kourt'];

const NAME_PRE = ['Ridge','Fair','Cedar','Rose','Sun','Pine','Wind','Stone','Brook','Elm','Bay','Glen','Oak','Lark','Hill','Ash'];
const NAME_POST = ['wood','view','crest','field','haven','mont','dale','gate','side','ridge','brook','stead','bourne','mere'];

// ------------------------------------------------------------------ plates
const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'; // no I, O, Q — nobody can read them
const PLATE_VANITY = ['NO VCNCY','ICE MKR','GR8 ESC','2 TIRED','MOTL LYF','BAG BOY','NITE OWL','RM SRVC','CHEK IN','LOBBY'];

// ------------------------------------------------------------------ requests
// What a guest picks up the phone about. secs = work at base speed;
// mood = how far their happiness (0..1) slides for every in-game hour ignored.
export const REQUESTS = [
  { id: 'towels',   label: 'extra towels',            icon: '🧻', secs: 6.0,  mood: 0.05 },
  { id: 'ice',      label: 'an ice bucket',           icon: '🧊', secs: 5.0,  mood: 0.04 },
  { id: 'wakeup',   label: 'a wake-up call',          icon: '⏰', secs: 4.0,  mood: 0.09 },
  { id: 'remote',   label: 'the TV remote',           icon: '📺', secs: 5.0,  mood: 0.06 },
  { id: 'wifi',     label: 'the wi-fi password',      icon: '📶', secs: 4.5,  mood: 0.08 },
  { id: 'service',  label: 'room service',            icon: '🍽', secs: 12.0, mood: 0.07 },
  { id: 'crib',     label: 'a crib for the baby',     icon: '🍼', secs: 11.0, mood: 0.13 },
  { id: 'pillows',  label: 'more pillows',            icon: '🛏', secs: 6.5,  mood: 0.05 },
  { id: 'bags',     label: 'a hand with the bags',    icon: '🧳', secs: 9.0,  mood: 0.06 },
  { id: 'thermo',   label: 'the thermostat looked at',icon: '🌡', secs: 10.0, mood: 0.12 },
  { id: 'coffee',   label: 'a pot of coffee',         icon: '☕', secs: 7.0,  mood: 0.05 },
  { id: 'iron',     label: 'an iron and board',       icon: '👔', secs: 6.0,  mood: 0.04 },
  { id: 'kit',      label: 'a toothbrush from the desk', icon: '🪥', secs: 5.0, mood: 0.06 },
  { id: 'key',      label: 'a new room key',          icon: '🔑', secs: 4.0,  mood: 0.10 },
  { id: 'noise',    label: 'the noise upstairs handled', icon: '🔊', secs: 8.0, mood: 0.11 },
  { id: 'map',      label: 'directions to the interstate', icon: '🗺', secs: 4.0, mood: 0.03 },
];

// ------------------------------------------------------------------ reviews
export const REVIEW_LINES = {
  great: [
    'Rolled in at 1am on fumes. Somebody was awake. Somebody cared.',
    'The bed was so good I was annoyed I had to leave it.',
    'Front desk used my name on day two. Nobody does that anymore.',
    'Asked for towels. Towels arrived before I hung up the phone.',
    'Cleanest bathroom I have seen on this highway in twenty years.',
    'I have paid triple for half of this. Booked again for the way home.',
    'Left my sunglasses behind. They mailed them to me. Mailed them.',
    'My kid called it a castle and I am not going to correct him.',
    'Ice machine worked. AC worked. Everything worked. Bless this place.',
    'Woke up to coffee that was actually hot. Five stars for that alone.',
    'Every light had a bulb in it. You would be amazed how rare that is.',
    'Stayed one night on the way out, two on the way back. That is the review.',
  ],
  good: [
    'Solid, clean, quiet. Exactly what the sign promised.',
    'No complaints worth typing. Would stop again.',
    'Firm bed, hot shower, nobody bothered me. Good night.',
    'Small place, big effort. You can tell.',
    'Check-in took a minute, but the room was worth the minute.',
    'The pillows were better than mine at home, which is a little sad.',
    'Good value for a highway stop, and the lot felt safe.',
    'Friendly desk, decent coffee, everything where you expect it.',
    'Nothing fancy. Nothing wrong, either.',
    'Slept through until the alarm. That is all I ask of a building.',
  ],
  meh: [
    'It was a room. It had a bed. That is the review.',
    'Fine for one night. Would not plan a trip around it.',
    'Clean enough, provided you do not look at the corners.',
    'The AC had two settings: off, and jet engine.',
    'Waited a while at the desk. Got there eventually.',
    'Walls are thin. I know a great deal about the man in 14 now.',
    'The lot light shines straight through the curtain. Bring a hat.',
    'Nobody did anything wrong. Nobody did much of anything.',
    'Towels were rationed like wartime.',
    'Average in every direction. Almost impressive.',
  ],
  bad: [
    'Front desk was a rumour.',
    'Rang the bell eleven times. I counted.',
    'Asked for a crib at nine. Slept with the baby on my chest.',
    'The room was cleaned by somebody thinking about something else.',
    'The hot water is a legend the staff keep alive.',
    'Waited so long to check in I learned the carpet by heart.',
    'Paid suite money. Got a closet with ambition.',
    'I have stayed in quieter engine rooms.',
    'The wake-up call woke somebody. Not me.',
    'The lobby smells like a decision made a long time ago.',
    'Two of us at the desk, nobody behind it, and a bell going off like a fire drill.',
    'Whoever runs this place has never had to sleep in it.',
  ],
  awful: [
    'Left at 2am and slept in the car. Slept better.',
    'Do not stay here. I mean that kindly.',
    'The only thing running in that room was a tap I could not stop.',
    'Booked two nights. Made it to a breakfast that did not exist.',
    'I would like back the twenty minutes I spent at that desk.',
    'Nobody came. Not for the towels, not for the flood, not at all.',
    'The room was dirty in a way that felt personal.',
    'The bed and I both gave up around three.',
    'Ask them how many rooms are actually clean. Watch the face.',
    'I have seen a hotel this bad exactly once, and I am reviewing it.',
  ],
};

// ------------------------------------------------------------------ mouths
export const ARRIVAL_QUIPS = [
  'Long drive. Any room with a door.',
  'Saw the sign from the off-ramp.',
  'Please tell me you have a bed left.',
  'Just the one night. Maybe two.',
  'Nine hours in that car. Nine.',
  'Anything on the ground floor?',
  'Do you take cash?',
  'My back is a wanted poster.',
  'Smells like coffee in here. Good sign.',
  'Last place said no vacancy. Their loss.',
  'Anything quiet? Away from the road?',
  'I am not picky. I am just done.',
  'Checking in, and then sleeping for a year.',
  'Is that ice machine on this floor?',
  'The kids are asleep in the car. Be quick and I will love you forever.',
  'Rain the whole way. Every mile of it.',
];

export const WALKOUT_QUIPS = [
  'Forget it. There is a place down the road.',
  'Ten minutes. I have been standing here ten minutes.',
  'Nobody works here. Fine. Nobody gets my money.',
  'I will take my chances at the truck stop.',
  'You had one job, and it was the desk.',
  'Enjoy the empty room.',
  'Ring the bell yourself sometime.',
  'That is a no from me.',
  'I am tired, not desperate.',
  'Tell whoever runs this place I said goodnight.',
  'I am going to write about this.',
  'Back in the car. Wonderful.',
];

// ------------------------------------------------------------------ ticker
// The lobby radio, permanently tuned to whatever the tallest antenna in the
// county is putting out.
export const NEWS_TICKER = [
  'KRDO 92.7 — all night, all highway.',
  'County fair opens Saturday. Pie judging at noon, no exceptions.',
  'Highway 14 resurfacing wraps Thursday. Flag crews thank you for your patience.',
  'Lost dog answering to Biscuit, last seen near the water tower.',
  'The diner off exit 9 is now open around the clock. Coffee still a dollar.',
  'Weather: clear, warm, and the kind of quiet that makes dogs nervous.',
  'Little league final goes to the Hornets, 4 to 3, on an error.',
  'Reminder: the drive-in closes for the season after the long weekend.',
  'Truckers report a long line at the scales past mile marker 60.',
  'Library book sale Sunday. Everything a quarter. Bring a box.',
  'Fireworks over the reservoir Friday, weather permitting, which it will not.',
  'Motorists advised the deer are back on the county road at dusk.',
  'Grange hall dance Saturday. Live band. Bring a covered dish.',
  'Somebody left a boat trailer at the post office. Come get your boat trailer.',
  'Gas down two cents at the pumps. Celebrate responsibly.',
  'The marching band needs a tuba player and is no longer being picky.',
  'Overnight low of 54. Roll the window up on that pickup, Earl.',
  'Traffic report: there is one truck, and it is doing fine.',
  'Bake sale proceeds go toward the new scoreboard. They are close.',
  'Found: one very good hat, corner of Third and Main. Describe it and it is yours.',
  'The swap meet has been moved indoors on account of the wind.',
  'Cattle on the road at the Willow Creek bridge. Again.',
];

// ------------------------------------------------------------------ dice
export function pick(arr) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Integer hash, so seededPick(list, 7) and seededPick(list, 8) are unrelated.
function hash32(n) {
  let h = (Math.floor(n) | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h ^= h >>> 15;
  return h >>> 0;
}

// Same integer, same answer, forever — for anything that must survive a reload.
export function seededPick(arr, n) {
  if (!arr || !arr.length) return undefined;
  return arr[hash32(n) % arr.length];
}

const chance = (p) => Math.random() < p;
const letter = () => PLATE_LETTERS[Math.floor(Math.random() * PLATE_LETTERS.length)];
const digit = () => String(Math.floor(Math.random() * 10));
const rep = (fn, n) => { let s = ''; for (let i = 0; i < n; i++) s += fn(); return s; };

// ------------------------------------------------------------------ makers
export function genGuestName() {
  const first = pick(FIRST);
  const last = pick(LAST);
  if (chance(0.06)) return `${first} ${pick(MIDDLE_INITIALS.split(''))}. ${last}`;
  if (chance(0.03)) return `${first} ${last} ${pick(SUFFIXES)}`;
  return `${first} ${last}`;
}

export function genStaffName() {
  const first = chance(0.12) ? pick(NICKS) : pick(FIRST);
  return `${first} ${pick(LAST)}`;
}

function compoundPlace() {
  const pre = pick(NAME_PRE);
  let post = pick(NAME_POST);
  // 'Ridge' + 'ridge' reads as a stutter, not a place. Roll the tail again.
  for (let i = 0; i < 8 && post === pre.toLowerCase(); i++) post = pick(NAME_POST);
  return pre + post;
}

export function genHotelName() {
  for (let i = 0; i < 12; i++) {
    const name = buildHotelName();
    // A name that says the same word twice reads like a typo on the sign.
    const words = name.toLowerCase().replace(/^the /, '').split(' ');
    if (new Set(words).size === words.length) return name;
  }
  return `The ${pick(HOTEL_ADJ)} ${pick(HOTEL_SUFFIX)}`;
}

function buildHotelName() {
  switch (Math.floor(Math.random() * 8)) {
    case 0: return `The ${pick(HOTEL_ADJ)} ${pick(HOTEL_SUFFIX)}`;
    case 1: return `The ${pick(HOTEL_ADJ)} ${pick(HOTEL_NOUN)}`;
    case 2: return `The ${pick(HOTEL_ADJ)} ${pick(HOTEL_NOUN)} ${pick(HOTEL_SUFFIX)}`;
    case 3: return `${compoundPlace()} ${pick(HOTEL_SUFFIX)}`;
    case 4: return `${pick(HOTEL_NOUN)} ${pick(HOTEL_SUFFIX)}`;
    case 5: return `The ${pick(HOTEL_NEON)} ${pick(HOTEL_SUFFIX)}`;
    case 6: return `The ${pick(HOTEL_NOUN)} & ${pick(HOTEL_NOUN)}`;
    default: return `${pick(HOTEL_ADJ)} ${pick(HOTEL_NOUN)} ${pick(HOTEL_SUFFIX)}`;
  }
}

export function genPartyLabel(size) {
  const n = Math.max(1, Math.round(Number(size) || 1));
  if (n === 1) return 'solo traveller';
  if (n === 2) return 'couple';
  if (n <= 5) return `family of ${n}`;
  return `tour group (${n})`;
}

export function genPlate() {
  if (chance(0.05)) return pick(PLATE_VANITY);
  switch (Math.floor(Math.random() * 4)) {
    case 0: return `${rep(letter, 3)}-${rep(digit, 4)}`;
    case 1: return `${rep(digit, 3)}-${rep(letter, 3)}`;
    case 2: return `${rep(letter, 2)}${digit()} ${rep(digit, 3)}`;
    default: return `${rep(letter, 3)} ${rep(digit, 3)}`;
  }
}
