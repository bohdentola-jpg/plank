// Cutaway gags. Eighteen of them, scattered across town on little TV markers.
// Walk up, press the button, and the game stops dead for a joke — which is,
// structurally speaking, the entire show.
export const GAGS = [
  {
    id: 'g_clam_fight', at: { spot: 'clam', dx: 10, dz: 13 }, reward: 120,
    title: 'THIS IS WORSE THAN THE TIME…',
    cast: [{ who: 'peter', dx: -1.2, dz: 0 }, { who: 'chicken', dx: 2.2, dz: 0.6, face: Math.PI }],
    beats: [
      { who: 'peter', line: "This is worse than the time I got in a fight with that giant chicken.", shot: 'closeup' },
      { who: 'chicken', line: "BAWK.", shot: 'low' },
      { who: 'peter', line: "…We were at it for eleven minutes. Eleven! In a warehouse! Twice!", shot: 'two' },
    ],
  },
  {
    id: 'g_spooner_road', at: { spot: 'griffin', dx: -12, dz: 16 }, reward: 120,
    title: 'ROAD TO THE MULTIVERSE',
    cast: [{ who: 'brian', dx: -1, dz: 0 }, { who: 'stewie', dx: 1.4, dz: 0.2, face: Math.PI }],
    beats: [
      { who: 'stewie', line: "I've built a device that opens a portal to a parallel universe.", shot: 'closeup' },
      { who: 'brian', line: "Is it the one where everyone's a dog and I'm a person?", shot: 'over' },
      { who: 'stewie', line: "It is now. Don't lick anything.", shot: 'two' },
    ],
  },
  {
    id: 'g_west_water', at: { spot: 'cityhall', dx: 12, dz: 20 }, reward: 140,
    title: 'MAYOR WEST HAS A PLAN',
    cast: [{ who: 'west', dx: 0, dz: 0 }, { who: 'lois', dx: 2.2, dz: 0.4, face: Math.PI }],
    beats: [
      { who: 'west', line: "The water supply is being stolen. Someone is stealing our water.", shot: 'closeup' },
      { who: 'lois', line: "Mayor West, it's raining. That's where the water goes.", shot: 'over' },
      { who: 'west', line: "So the SKY is in on it. …I'll need a bigger hat.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_tucker_news', at: { spot: 'channel5', dx: -10, dz: 14 }, reward: 130,
    title: 'CHANNEL 5 ACTION NEWS',
    cast: [{ who: 'tucker', dx: -1.2, dz: 0 }, { who: 'jerome', dx: 1.6, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'tucker', line: "Top story tonight: a Quahog man has done a thing. Details at eleven.", shot: 'closeup' },
      { who: 'jerome', line: "That's it? That's the whole story?", shot: 'over' },
      { who: 'tucker', line: "We have twenty-two minutes and one thing. Yes. That's it.", shot: 'two' },
    ],
  },
  {
    id: 'g_herbert', at: { spot: 'herbert', dx: 6, dz: 14 }, reward: 130,
    title: 'THE NEIGHBOUR',
    cast: [{ who: 'herbert', dx: 0, dz: 0 }, { who: 'chris', dx: 2.4, dz: 0.4, face: Math.PI }],
    beats: [
      { who: 'herbert', line: "Well hello there, Chris. Come to help an old man with his… lawn?", shot: 'closeup' },
      { who: 'chris', line: "Nope! Nope nope nope. Going. Bye. Going now.", shot: 'over' },
      { who: 'herbert', line: "Ssssuit yourself.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_mort', at: { spot: 'pharmacy', dx: 8, dz: 12 }, reward: 120,
    title: "GOLDMAN'S PHARMACY",
    cast: [{ who: 'mort', dx: -1, dz: 0 }, { who: 'peter', dx: 1.8, dz: 0.2, face: Math.PI }],
    beats: [
      { who: 'peter', line: "Mort, I need something for a rash I got from a bar stool.", shot: 'two' },
      { who: 'mort', line: "Oh boy. Which bar stool? Because I have three creams and a lawyer.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_consuela', at: { spot: 'griffin', dx: 10, dz: 14 }, reward: 120,
    title: 'NO. NO NO NO.',
    cast: [{ who: 'consuela', dx: 0, dz: 0 }, { who: 'lois', dx: 2.2, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'lois', line: "Consuela, could you get the upstairs bathroom today?", shot: 'two' },
      { who: 'consuela', line: "No. No, I need lemon Pledge.", shot: 'closeup' },
      { who: 'lois', line: "We have lemon Pledge.", shot: 'over' },
      { who: 'consuela', line: "No.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_quagmire', at: { spot: 'quagmire', dx: 8, dz: 14 }, reward: 120,
    title: 'GIGGITY',
    cast: [{ who: 'quagmire', dx: -1, dz: 0 }, { who: 'brian', dx: 1.8, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'quagmire', line: "Brian. Brian. I have a hot tub, a plane ticket and no follow-up questions.", shot: 'closeup' },
      { who: 'brian', line: "It's nine in the morning, Glenn.", shot: 'over' },
      { who: 'quagmire', line: "Giggity giggity. Alllright.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_joe', at: { spot: 'swanson', dx: 8, dz: 14 }, reward: 130,
    title: 'THE SWANSON DRIVEWAY',
    cast: [{ who: 'joe', dx: -1.2, dz: 0 }, { who: 'peter', dx: 1.8, dz: 0.2, face: Math.PI }],
    beats: [
      { who: 'joe', line: "Peter, I've been in this chair for years and you still park across my ramp.", shot: 'two' },
      { who: 'peter', line: "In my defence, Joe, I don't think about you at all.", shot: 'closeup' },
      { who: 'joe', line: "…That's honestly the nicest thing you've said to me.", shot: 'over' },
    ],
  },
  {
    id: 'g_cleveland_tub', at: { spot: 'brown', dx: 8, dz: -14 }, reward: 150,
    title: 'NO NO NO NO — NO!',
    cast: [{ who: 'cleveland', dx: 0, dz: 0 }],
    beats: [
      { who: 'cleveland', line: "All I wanted was a quiet bath. Is that so much to ask.", shot: 'closeup' },
      { who: 'cleveland', line: "No. No no no. NO! …Oh, that's my wall.", shot: 'wide' },
    ],
  },
  {
    id: 'g_seamus', at: { spot: 'docks', dx: 12, dz: 12 }, reward: 130,
    title: 'THE OLD SALT',
    cast: [{ who: 'seamus', dx: -1, dz: 0 }, { who: 'meg', dx: 1.8, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'seamus', line: "Arr, I lost these hands to the sea, girl. And these feet. And a cousin.", shot: 'closeup' },
      { who: 'meg', line: "How do you steer the boat?", shot: 'over' },
      { who: 'seamus', line: "Spite, mostly.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_carter', at: { spot: 'pewterschmidt', dx: 14, dz: 24 }, reward: 140,
    title: 'OLD MONEY',
    cast: [{ who: 'carter', dx: -1.2, dz: 0 }, { who: 'peter', dx: 1.8, dz: 0.2, face: Math.PI }],
    beats: [
      { who: 'peter', line: "Mr. Pewterschmidt, sir, I was hoping to borrow a small amount of money.", shot: 'two' },
      { who: 'carter', line: "Absolutely. How does 'no' sound, and then a dog chases you to the gate?", shot: 'closeup' },
      { who: 'peter', line: "That's the same as last time but with a dog.", shot: 'over' },
    ],
  },
  {
    id: 'g_bruce', at: { spot: 'harrington', dx: 0, dz: 14 }, reward: 120,
    title: 'OH NOOO',
    cast: [{ who: 'bruce', dx: 0, dz: 0 }, { who: 'chris', dx: 2.2, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'bruce', line: "Ohh nooo. Somebody let all the inflatable tube men go at once.", shot: 'closeup' },
      { who: 'chris', line: "They're going down the highway. They look so happy.", shot: 'wide' },
      { who: 'bruce', line: "They do look happy. Ohh nooo.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_death', at: { spot: 'church', dx: 8, dz: 16 }, reward: 160,
    title: 'DEATH TAKES A HALF DAY',
    cast: [{ who: 'death', dx: -1, dz: 0 }, { who: 'peter', dx: 1.9, dz: 0.2, face: Math.PI }],
    beats: [
      { who: 'death', line: "Relax, I'm not here for you. I'm here for a guy in the third pew.", shot: 'closeup' },
      { who: 'peter', line: "Cool cool cool. Hey, while you're here — is the light thing real?", shot: 'over' },
      { who: 'death', line: "It's a hallway. There's a vending machine. It only takes exact change.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_hartman', at: { spot: 'hospital', dx: 12, dz: 16 }, reward: 130,
    title: 'A SECOND OPINION',
    cast: [{ who: 'hartman', dx: -1.2, dz: 0 }, { who: 'lois', dx: 1.8, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'hartman', line: "Mrs. Griffin, I have your test results, and also somebody else's lunch order.", shot: 'two' },
      { who: 'lois', line: "Which one are you reading right now?", shot: 'over' },
      { who: 'hartman', line: "…You're going to want the soup.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_school', at: { spot: 'school', dx: 16, dz: 20 }, reward: 130,
    title: 'JAMES WOODS REGIONAL',
    cast: [{ who: 'shepherd', dx: -1.2, dz: 0 }, { who: 'meg', dx: 1.8, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'shepherd', line: "Meg Griffin, the yearbook committee has voted you 'most likely to be there'.", shot: 'two' },
      { who: 'meg', line: "That's not a category.", shot: 'over' },
      { who: 'shepherd', line: "We made it for you. That's how much we care.", shot: 'closeup' },
    ],
  },
  {
    id: 'g_brewery', at: { spot: 'brewery', dx: 18, dz: 22 }, reward: 140,
    title: 'EMPLOYEE OF THE MONTH',
    cast: [{ who: 'angela', dx: -1.2, dz: 0 }, { who: 'peter', dx: 1.9, dz: 0.2, face: Math.PI }],
    beats: [
      { who: 'angela', line: "Peter, you shipped forty crates of ale to a preschool.", shot: 'two' },
      { who: 'peter', line: "And they signed for it, Angela. That's on them.", shot: 'closeup' },
      { who: 'angela', line: "…Fine. But you're driving over there to explain it.", shot: 'over' },
    ],
  },
  {
    id: 'g_mall', at: { spot: 'mall', dx: 22, dz: 28 }, reward: 130,
    title: 'THE FOOD COURT',
    cast: [{ who: 'chris', dx: -1.2, dz: 0 }, { who: 'neil', dx: 1.7, dz: 0.3, face: Math.PI }],
    beats: [
      { who: 'neil', line: "Chris, I have deduced from the smell that today is meatloaf day.", shot: 'two' },
      { who: 'chris', line: "Neil, it's a mall. There is no meatloaf day.", shot: 'over' },
      { who: 'neil', line: "Then what IS that smell? …It's me. It's been me this whole time.", shot: 'closeup' },
    ],
  },
];

export function gagById(id) { return GAGS.find((g) => g.id === id); }
