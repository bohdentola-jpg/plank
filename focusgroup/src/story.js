// FOCUS GROUP — six mornings, as data.
//
// Everything the game says lives in this file: the commercials, the checklists,
// the survey card, the notes people push under your door, and the shooting
// script you are handed on the last morning. main.js is the projector; this is
// the reel.
//
// A day is:
//   dress    what the set looks like today (props.js + apartment.js read this)
//   lenses   which hidden cameras exist — every cut comes from one of these,
//            so every cut is from a camera you could have found
//   steps    the checklist, in the order it prints
//   beats    scripted moments, fired by `on:` and read by runBeat() in main.js
//   ad       what is on the television this morning

// ---------------------------------------------------------------- the brand

export const BRAND = {
  name: 'VALCO',
  legal: 'VALCO HOME PRODUCTS · A FAMILY OF BRANDS · EST. 1954',
  mascot: 'VAL',
  // the tagline is the whole story in five lines
  tagline: [
    "WE'RE PART OF YOUR MORNING",   // day 1
    "WE'RE PART OF YOUR MORNING",   // day 2
    "WE'RE PART OF YOUR HOME",      // day 3
    "WE'RE PART OF YOUR HOME",      // day 4
    "WE'RE PART OF THE FAMILY",     // day 5
    "YOU'RE PART OF VALCO",         // day 6
  ],
};

// The line they want, on the last morning. Nothing about it is frightening,
// which is the point.
export const THE_LINE = "I don't know what we'd do without them.";

// ---------------------------------------------------------------- lenses
//
// id       → the prop it hides in and what it can see. `room` gates the cut:
//            a camera only takes the shot if you are in its room.
// hint     → what you catch out of the corner of your eye before you press Q
// found    → the line in the journal once you have noticed it

export const LENSES = {
  smoke: {
    host: 'smoke detector', room: 'hall', cam: 3,
    hint: 'the little test light has two reflections in it',
    found: 'SMOKE DETECTOR, HALL — the test light is a lens. It does not blink.',
  },
  clock: {
    host: 'clock radio', room: 'bedroom', cam: 1,
    hint: 'something behind the display glass is not a number',
    found: 'CLOCK RADIO, BEDROOM — behind the 6 in the display. Valco Chrono 400.',
  },
  tv: {
    host: 'television', room: 'living', cam: 4,
    hint: 'a dark circle above the channel dial, where no dial is',
    found: 'TELEVISION, LIVING ROOM — above the channel dial. It is on when the set is off.',
  },
  kettle: {
    host: 'coffee maker', room: 'kitchen', cam: 5,
    hint: 'the chrome badge is convex in the wrong direction',
    found: 'COFFEE MAKER, KITCHEN — the badge. Convex. Facing the room, not the wall.',
  },
  mirror: {
    host: 'cabinet mirror', room: 'bathroom', cam: 7,
    hint: 'a fleck in the silvering that you can see round the back of',
    found: 'BATHROOM CABINET — the flaw in the mirror goes all the way through.',
  },
  vent: {
    host: 'extractor vent', room: 'kitchen', cam: 6,
    hint: 'one slat of the grille does not line up with the others',
    found: 'EXTRACTOR VENT, KITCHEN — third slat from the left is glass.',
  },
  blinds: {
    host: 'blind cord', room: 'living', cam: 2,
    hint: 'the pull-toggle has a seam that goes all the way round',
    found: 'BLIND CORD, LIVING ROOM — the toggle unscrews. There is a wire in the cord.',
  },
  peephole: {
    host: 'front door', room: 'hall', cam: 8,
    hint: 'the peephole is bright, and you are on the dark side of it',
    found: 'FRONT DOOR — the peephole is fitted backwards. It has always been backwards.',
  },
  mug: {
    host: 'the mug', room: 'gift', cam: 9, gift: true,
    hint: 'the smile on the mug has a pupil in it',
    found: "GIFT — MUG. VAL's left eye is glass and it is warm.",
  },
  lamp: {
    host: 'the lamp', room: 'gift', cam: 10, gift: true,
    hint: 'there is a second, smaller bulb behind the shade, and it is dark',
    found: 'GIFT — LAMP. The dark bulb behind the shade is not a bulb.',
  },
  figurine: {
    host: 'the figurine', room: 'gift', cam: 11, gift: true,
    hint: 'the little painted eyes are the only part that is not dusty',
    found: 'GIFT — VAL FIGURINE. Both eyes. It has been dusted. Not by you.',
  },
  alarm: {
    host: 'the new alarm', room: 'gift', cam: 12, gift: true,
    hint: 'it has no battery door',
    found: 'GIFT — SMOKE ALARM. No battery door. No battery. It is powered by something.',
  },
};

// The one on the soundstage that nobody mentions, because it is not pointed
// at you. Only reachable if you found all twelve.
export const LAST_LENS = {
  host: 'the thirteenth camera', room: 'studio', cam: 0,
  hint: 'a camera on the far side of the seats, and it is turned around',
  found: 'CAM 00 — pointed at the audience. Somebody is getting this too.',
};

// ---------------------------------------------------------------- the ads
//
// A shot is [caption, seconds, shotName]. shotName is a camera set-up in the
// commercial diorama (ad.js). `grab: n` swaps the diorama for one of the
// frames the hidden cameras took of you, which is how you end up in your own
// advertisement without anybody asking.

export const COLD_OPEN = {
  id: 'cold',
  title: 'VALCO PRESENTS',
  music: 'jingle',
  shots: [
    ['', 2.2, 'starburst'],
    ["Morning.", 2.0, 'kitchen-wide'],
    ["It's the most important part of your day.", 2.6, 'family-table'],
    ["That's why Valco has been part of it since nineteen fifty-four.", 3.4, 'pot-close'],
    ["The coffee.", 1.5, 'pot-close'],
    ["The soap.", 1.4, 'bathroom-close'],
    ["The clock that wakes you.", 1.9, 'clock-close'],
    ["The set you're watching this on.", 2.6, 'living-wide'],
    ["Hello! I'm Val.", 2.4, 'val-wave'],
    ["One family, making things for yours.", 2.8, 'family-wave'],
    ['', 2.6, 'logo'],
    ['', 1.8, 'smallprint'],
    // one frame of a room with nobody in it. You will not be sure you saw it.
    ['', 0.04, 'thehouse'],
  ],
};

export const ADS = {
  // day 1 — the same spot, cut down for the morning slot
  1: {
    id: 'ad1', music: 'jingle',
    shots: [
      ['', 1.4, 'starburst'],
      ["Morning. It's the most important part of your day.", 2.6, 'family-table'],
      ["Valco. Part of it since nineteen fifty-four.", 2.6, 'pot-close'],
      ['', 2.0, 'logo'],
    ],
  },
  // day 2 — the kitchen in the advertisement has your blinds in it
  2: {
    id: 'ad2', music: 'jingle',
    shots: [
      ['', 1.2, 'starburst'],
      ["Valco would like to thank the families taking part in this year's study.", 3.4, 'family-table'],
      ["Some of you have already been selected.", 2.6, 'kitchen-wide'],
      ["You'll know.", 2.0, 'val-wave'],
      ['', 2.0, 'logo'],
    ],
  },
  // day 3 — the mug on the ad table is the mug they gave you
  3: {
    id: 'ad3', music: 'jingle-slow',
    shots: [
      ['', 1.2, 'starburst'],
      ["A Valco home is a home that's been thought about.", 3.2, 'living-wide'],
      ["Every room. Every corner of every room.", 3.0, 'kitchen-wide'],
      ["Thank you for making space for us.", 2.8, 'val-wave'],
      ['', 2.0, 'logo'],
    ],
  },
  // day 4 — and here is your kitchen, filmed yesterday, on the television
  4: {
    id: 'ad4', music: 'jingle-slow',
    shots: [
      ['', 1.0, 'starburst'],
      ["Real homes.", 2.2, 'grab', { grab: 0 }],
      ["Real mornings.", 2.4, 'grab', { grab: 1 }],
      ["You've been wonderful.", 3.0, 'grab', { grab: 2 }],
      ['', 2.2, 'logo'],
    ],
  },
  // day 5 — your own week, and the announcer has read your survey
  5: {
    id: 'ad5', music: 'jingle-minor',
    shots: [
      ['', 1.0, 'starburst'],
      ['@survey', 3.6, 'grab', { grab: 0 }],
      ["We think you'll like what we've done with that.", 3.2, 'grab', { grab: 1 }],
      ["Almost there.", 2.4, 'grab', { grab: 2 }],
      ["Sunday.", 2.2, 'grab', { grab: 3 }],
      ['', 2.4, 'logo'],
    ],
  },
};

// the finished commercial, over the credits, starring whoever you turned out
// to be. Every frame of it is a frame of your week.
export const FINAL_AD = {
  id: 'final', music: 'jingle-final',
  shots: [
    ['', 2.0, 'starburst'],
    ["Morning.", 2.0, 'grab', { grab: 0 }],
    ["It's the most important part of your day.", 2.8, 'grab', { grab: 1 }],
    ["And you're never really having it alone.", 3.2, 'grab', { grab: 2 }],
    ["Valco.", 2.0, 'grab', { grab: 3 }],
    ['@line', 3.4, 'grab', { grab: 4 }],
    ['', 2.6, 'logo'],
    ['', 3.0, 'nextsubject'],
  ],
};

// ---------------------------------------------------------------- the survey
//
// Four questions on a reply-paid card. The answers come back at you on day 5
// in a voice that is being friendly about it.

export const SURVEY = {
  head: 'VALCO HOME PRODUCTS — HOUSEHOLD PANEL · FORM 4B',
  intro: `Congratulations. Your household has been provisionally selected for the
    1974 Valco Viewer Panel. Please complete this card in pen and leave it where
    you found it. No stamp is required. No collection is necessary.`,
  questions: [
    {
      q: '1.  How many people live in your home?',
      a: ['Just me', 'Two', 'Three or more', "I'd rather not say"],
      // what the announcer says back to you on day 5
      echo: [
        'You told us you live alone. So do we.',
        'You told us there were two of you. We only ever see the one.',
        'You told us three or more. We have looked.',
        "You'd rather not say. That's alright. We counted.",
      ],
    },
    {
      q: '2.  When you are alone in your home, do you talk out loud?',
      a: ['Never', 'Sometimes', 'Often', "I don't know"],
      echo: [
        'You said you never talk to yourself. You do, though.',
        'You said sometimes. Tuesday, mostly. We have it.',
        'You said often, and you were being honest, and we appreciate honesty.',
        "You didn't know. We did.",
      ],
    },
    {
      q: '3.  Which do you prefer?',
      a: ['Being alone', 'Being with others'],
      echo: [
        "You told us you prefer to be alone. We think you'll like what we've done with that.",
        "You told us you prefer company. You're going to be thrilled.",
      ],
    },
    {
      q: '4.  Would you say you are being watched?',
      // the fourth box has nothing printed next to it
      a: ['No', 'Sometimes', 'Yes', ''],
      echo: [
        'You said no. Good.',
        'You said sometimes. Sometimes is right.',
        'You said yes, and you went on with your morning anyway, and that is the finding.',
        'You ticked the empty box. Nobody has ever ticked the empty box.',
      ],
    },
  ],
  thanks: "Thank you. That's everything we didn't already have.",
};

// ---------------------------------------------------------------- notes

export const NOTES = {
  gift: {
    head: 'VALCO HOME PRODUCTS — VIEWER SERVICES',
    body: `DEAR VALUED PARTICIPANT,

Enclosed please find your complimentary Valco Home Selection, chosen for
you on the basis of your card.

There is nothing you need to do with these items. Simply put them
somewhere you would naturally put them, and then live as you normally
would.

Please do not put them away.`,
    sign: '— VIEWER SERVICES',
  },
  missed: {
    head: 'SORRY WE MISSED YOU',
    body: `VALCO SERVICE CALL — SATURDAY, 06:40

  ☐  We called and you were out.
  ☑  We let ourselves in.

Nothing needed doing. We did it anyway. Your floor has been marked
for you — please stand on the marks when it feels natural to.

You do not need to be at home for the next visit.`,
    sign: '— VALCO SERVICE',
  },
  plaque: {
    head: 'VALCO — VIEWER SERVICES',
    body: `SUB-LEVEL 1 · AUTHORISED PERSONNEL

RING FOR ATTENTION`,
    sign: '',
  },
  monitors: {
    head: 'FROM A CLIPBOARD ON THE DESK',
    body: `PANEL 74-C — SUBJECT SUMMARY

  DAY 1   baseline. subject unremarkable. good.
  DAY 2   card returned. subject answered all four. rare.
  DAY 3   subject placed the items without being asked twice.
  DAY 4   subject saw itself on the television and made coffee.
  DAY 5   subject came down here on its own.
  DAY 6   —

RECOMMEND: PROMOTE TO TALENT.`,
    sign: '',
  },
};

// ---------------------------------------------------------------- the days

export const DAYS = [
  // ============================================================= DAY 1
  {
    n: 1,
    weekday: 'TUESDAY',
    date: '5 MARCH',
    clock: '06:41',
    title: 'A NORMAL MORNING',
    card: 'Nothing happens today. That is what today is for.',
    listHead: 'YOUR MORNING',
    lenses: ['smoke', 'clock', 'kettle'],
    dress: { gifts: false, marks: false, tape: 0 },
    light: 0,             // 0 = a room. 1 = a room lit for television.
    cutBudget: { count: 1, min: 0.7, max: 0.7 },
    steps: [
      { id: 'alarm', text: 'turn off the clock radio' },
      { id: 'blinds', text: 'open the blinds' },
      { id: 'coffee', text: 'put the coffee on' },
      { id: 'tv', text: 'watch the news' },
      { id: 'leave', text: 'leave for work', last: true },
    ],
    beats: [
      { on: 'step:alarm', say: "Tuesday. The radio was already on the station you leave it on." },
      { on: 'step:coffee', cut: { lens: 'kettle', secs: 0.7 } },
      { on: 'step:tv', ad: 1 },
      { on: 'step:blinds', say: 'Sodium orange. The block opposite is mostly dark.' },
      { on: 'notice:first', toast: 'NOTED' },
    ],
    outro: `You pull the door to. Somewhere behind it the flat goes on being your flat
      with nobody in it, and the radio, which you turned off, is warm.`,
  },

  // ============================================================= DAY 2
  {
    n: 2,
    weekday: 'WEDNESDAY',
    date: '6 MARCH',
    clock: '06:41',
    title: 'YOU MAY ALREADY BE SELECTED',
    card: 'There is something on the mat.',
    listHead: 'YOUR MORNING',
    lenses: ['smoke', 'clock', 'kettle', 'tv', 'blinds'],
    dress: { gifts: false, marks: false, tape: 0, post: true },
    light: 0.12,
    cutBudget: { count: 3, min: 1.2, max: 2.5 },
    steps: [
      { id: 'alarm', text: 'turn off the clock radio' },
      { id: 'post', text: 'get the post' },
      { id: 'coffee', text: 'put the coffee on' },
      { id: 'survey', text: 'fill in the survey card' },
      { id: 'tv', text: 'watch the news' },
      { id: 'leave', text: 'leave for work', last: true },
    ],
    beats: [
      { on: 'step:post', say: 'One card. No stamp on it. No address on it either.' },
      { on: 'step:survey', survey: true },
      { on: 'after:survey', cut: { lens: 'smoke', secs: 2.5, hold: true } },
      { on: 'step:tv', ad: 2 },
      { on: 'enter:kitchen', once: true, cut: { lens: 'kettle', secs: 1.2 } },
      { on: 'fumble', sfx: 'titter' },
    ],
    outro: `The card is not where you left it, but you are late, and there is a version
      of this morning where you did move it, and that is the version you take to work.`,
  },

  // ============================================================= DAY 3
  {
    n: 3,
    weekday: 'THURSDAY',
    date: '7 MARCH',
    clock: '06:41',
    title: 'A GIFT FROM US',
    card: 'There is a box outside the door. It has your name on it, spelled right.',
    listHead: 'YOUR MORNING',
    lenses: ['smoke', 'clock', 'kettle', 'tv', 'blinds', 'mirror', 'vent'],
    dress: { gifts: true, marks: false, tape: 0, box: true },
    light: 0.28,
    cutBudget: { count: 5, min: 1.6, max: 6 },
    steps: [
      { id: 'alarm', text: 'turn off the clock radio' },
      { id: 'box', text: 'bring the parcel in' },
      { id: 'gifts', text: 'find a home for your gifts', count: 4 },
      { id: 'coffee', text: 'put the coffee on' },
      { id: 'tv', text: 'watch the news' },
      { id: 'leave', text: 'leave for work', last: true },
    ],
    beats: [
      { on: 'step:box', note: 'gift' },
      { on: 'gift:1', say: 'It looks better there than the thing that was there.' },
      { on: 'gift:4', cut: { lens: 'figurine', secs: 3.0 } },
      { on: 'enter:bathroom', once: true, cut: { lens: 'mirror', secs: 6.0, hold: true },
        say: '' },
      { on: 'step:tv', ad: 3 },
    ],
    outro: `You take the stairs instead of the lift, for no reason you would give if asked.`,
  },

  // ============================================================= DAY 4
  {
    n: 4,
    weekday: 'FRIDAY',
    date: '8 MARCH',
    clock: '06:41',
    title: 'AS SEEN ON TELEVISION',
    card: 'The news is not on yet. Something else is.',
    listHead: 'YOUR MORNING',
    lenses: ['smoke', 'clock', 'kettle', 'tv', 'blinds', 'mirror', 'vent', 'peephole',
      'mug', 'lamp', 'figurine', 'alarm'],
    dress: { gifts: true, marks: false, tape: 0, sync: true },
    light: 0.5,
    cutBudget: { count: 7, min: 2, max: 30 },
    steps: [
      { id: 'alarm', text: 'turn off the clock radio' },
      { id: 'coffee', text: 'put the coffee on' },
      { id: 'tv', text: 'watch the news' },
      // nobody wrote these two down. They are in your handwriting.
      { id: 'smile', text: 'smile at the mirror', unclaimed: true },
      { id: 'say', text: 'say something about the coffee', unclaimed: true },
      { id: 'leave', text: 'leave for work', last: true },
    ],
    beats: [
      { on: 'step:tv', ad: 4 },
      { on: 'after:tv', say: 'That is your kitchen. That was yesterday.' },
      { on: 'step:smile', sfx: 'applause-small',
        say: 'Your face does it before you decide to.' },
      { on: 'step:say', say: '"Not bad." You said it out loud, to the kitchen.' },
      { on: 'look:window', once: true,
        say: 'Every window in the block opposite is blue, and they are all flickering together.' },
      { on: 'fumble', sfx: 'laugh' },
      { on: 'step:coffee', cut: { lens: 'vent', secs: 30, hold: true, sticky: true } },
    ],
    outro: `Friday. You do not remember the walk to the lift, but you remember being
      pleased with how the morning went, which is not a thing you have ever been.`,
  },

  // ============================================================= DAY 5
  {
    n: 5,
    weekday: 'SATURDAY',
    date: '9 MARCH',
    clock: '09:12',
    title: 'MAINTENANCE',
    card: 'No work today.',
    listHead: 'YOUR SATURDAY',
    lenses: ['smoke', 'clock', 'kettle', 'tv', 'blinds', 'mirror', 'vent', 'peephole',
      'mug', 'lamp', 'figurine', 'alarm'],
    dress: { gifts: true, marks: true, tape: 1, sync: true, val: true },
    light: 0.75,
    cutBudget: { count: 12, min: 4, max: 45 },
    steps: [
      { id: 'relax', text: 'relax' },
      { id: 'door', text: 'answer the door', hidden: true },
      { id: 'marks', text: 'stand on the marks', count: 3, hidden: true },
      { id: 'lift', text: 'take the lift down', hidden: true },
      { id: 'services', text: 'VIEWER SERVICES', hidden: true, last: true },
    ],
    beats: [
      { on: 'day:start', say: 'There are three strips of tape on your floor. White. Crossed.' },
      { on: 'step:relax', ad: 5, say: 'The set comes on. You did not put it on.' },
      { on: 'step:relax', delay: 4, unlock: 'door', sfx: 'knock' },
      { on: 'step:door', note: 'missed', say: 'Nobody in the corridor. The lift is on your floor.' },
      { on: 'after:door', unlock: 'marks' },
      { on: 'mark:1', cut: { lens: 'tv', secs: 8, hold: true },
        say: 'A light you cannot find comes up on the side of your face.' },
      { on: 'mark:3', unlock: 'lift',
        say: 'That was the last one. Something in the room relaxes.' },
      { on: 'val:seen', sfx: 'sting-soft',
        say: 'At the end of the hall. Hat. Painted smile. Not moving.' },
      { on: 'val:closer', say: 'Closer. You did not hear it and it is closer.' },
      { on: 'step:lift', unlock: 'services' },
      { on: 'enter:basement', once: true,
        say: 'Cable. Far more cable than a block this size has any use for.' },
      { on: 'look:plaque', once: true, note: 'plaque' },
      { on: 'bell', say: 'You ring it. It opens. Nobody opened it.' },
    ],
    outro: `The door closes behind you with the particular softness of a door that
      has been maintained.`,
  },

  // ============================================================= DAY 6
  {
    n: 6,
    weekday: 'SUNDAY',
    date: '10 MARCH',
    clock: '—',
    title: 'THE FOCUS GROUP',
    card: 'You are already awake, and this is not your ceiling.',
    listHead: 'SHOOTING SCRIPT — DAY 6, SC. 1',
    lenses: [],                 // there are forty. Nobody is hiding them.
    dress: { studio: true },
    light: 1,
    cutBudget: { count: 0, min: 0, max: 0 },   // there is nothing left to cut away from
    script: true,
    // the script is also the signposting: each line says where to go next,
    // because a shooting script is a set of instructions and always was
    steps: [
      { id: 'wake', text: 'SUBJECT wakes. Reacts.' },
      { id: 'window', text: 'SUBJECT crosses to the window.', note: '(There is no window.)' },
      { id: 'monitors', text: 'SUBJECT finds the monitors.', note: '(STAGE LEFT, PAST THE CAMERAS)' },
      { id: 'val', text: 'VAL enters. SUBJECT does not scream.' },
      { id: 'mark', text: 'SUBJECT hits the mark.', note: '(THE TAPED CROSS, BY THE WINDOW)' },
      { id: 'line', text: 'SUBJECT says the line.', last: true },
    ],
    beats: [
      { on: 'day:start', say: 'Three walls. Where the fourth was, there are seats, and the seats are full.' },
      { on: 'after:wake', say: 'The list in the corner is not a list this morning. Work down it anyway.' },
      { on: 'step:window', say: 'Flat. Painted. There is a view painted on it and it is your view.' },
      { on: 'after:window',
        say: 'Off to your left, past the cameras, something is lit. It is the only thing in here with a picture on it.' },
      { on: 'step:monitors', note: 'monitors',
        say: 'Forty screens of your week. Eleven of them are somebody else.' },
      { on: 'after:monitors', sfx: 'sting-soft',
        say: 'The grid comes up to a quarter. Somebody is in the wings and he has been there a while.' },
      { on: 'step:val', sfx: 'applause',
        say: 'He is exactly as tall as the ads make him and he does not smell of anything.' },
      { on: 'after:val',
        say: 'There is a taped cross on the floor by the window. You have been standing near it all morning.' },
      { on: 'step:mark', sfx: 'lights-up',
        say: 'The lighting grid finds you in one move. It has done this before.' },
      { on: 'after:mark', say: 'They are waiting. There is one line and it is on the list.' },
    ],
    outro: '',
  },
];

// ---------------------------------------------------------------- endings

export const ENDINGS = {
  said: {
    id: 'said',
    head: 'TAKE ONE. PRINT IT.',
    body: `You say it the way it is written, warmly, to camera, and the room comes apart
      into applause. Somebody is already unclipping the microphone. Somebody else is
      already dressing the set for a flat that is not yours, in a block that is not
      yours, for a morning that is not until Tuesday.

      You were very good. Everyone says so, on the way past.`,
    kicker: 'VALCO — YOU\'RE PART OF VALCO',
    plays: 'final-ad',
  },
  declined: {
    id: 'declined',
    head: 'SUBJECT DECLINED',
    body: `You do not say it.

      Nobody is annoyed. The audience waits the way an audience waits, and then stops
      waiting, and the lighting grid goes out one bank at a time, unhurried, the way
      a shop closes.

      THANK YOU FOR YOUR PARTICIPATION.`,
    kicker: 'THE PANEL CONTINUES',
    plays: 'held-frame',
  },
  last: {
    id: 'last',
    head: 'CAM 00',
    body: `There is a thirteenth camera on the far side of the seats and it is turned
      around, and what it is looking at is the audience.

      On the monitor it feeds, there is a room with rows of seats in it, and the seats
      are full, and at the front of that room there is a set with three walls, and on
      the set there is somebody standing on a mark, being lit.

      It is not you. It has never only been you.`,
    kicker: 'WHO IS THE FOCUS GROUP FOR?',
    plays: 'held-frame',
  },
};

// ---------------------------------------------------------------- misc copy

// what the announcer's babble is "saying" during the ads, in period caption
// style, when there is no line of its own
export const FILLER_CAPTIONS = [
  'AVAILABLE AT ALL GOOD STOCKISTS',
  'A VALCO HOME IS A HAPPY HOME',
  'ASK FOR IT BY NAME',
  'PART OF THE VALCO FAMILY OF BRANDS',
];

export const ENGAGEMENT_PRAISE = [
  'ENGAGEMENT UP — thank you',
  "ENGAGEMENT UP — you're doing wonderfully",
  'ENGAGEMENT UP — the panel is delighted',
  'ENGAGEMENT UP — keep going',
  'ENGAGEMENT UP — very natural',
];

export function dayByNumber(n) {
  return DAYS.find((d) => d.n === n) || DAYS[0];
}
