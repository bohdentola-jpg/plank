// Townsfolk in passing. Each line belongs to one of the generic voices
// (m1–m6, f1–f6); a folk NPC only says lines in their own voice.
const B = [
  ['m1', "Cold one tonight. They say minus thirty by Thursday."],
  ['m1', "You're the carpenter, right? My porch steps are about to kill somebody."],
  ['m1', "Stay off the Dome road after dark. Northstar's got guards up there now."],
  ['m2', "Evening. Lights are out on Third again. Every time it blows."],
  ['m2', "Ten years I've lived here. Never seen so many cameras as this year."],
  ['m2', "Cannery's laying people off again. Fish don't care about Northstar's money."],
  ['m3', "Northern lights are going crazy this week. My grandmother says that means change."],
  ['m3', "You want good coffee, go to Dolly's. Don't let anybody tell you different."],
  ['m3', "Bell rang today. First time since Easter. Gave me goosebumps."],
  ['m4', "Hey. Watch the ice by the harbour. It looks solid. It isn't."],
  ['m4', "Mayor's got a new truck. Funny how that works."],
  ['m4', "My kid wants a job at the Northstar store. I told him over my dead body."],
  ['m5', "Morning. Or evening. Hard to tell this time of year, eh?"],
  ['m5', "Tommy Aqpik's racing snowmachines on the lake Saturday. You should come."],
  ['m5', "Saw a black SUV parked outside the post office for three hours. Just sitting there."],
  ['m6', "Koshkin's been here longer than the church, I swear. Good man. Grumpy man."],
  ['m6', "If you're fixing roofs, start with the school. That gym leaks like a sieve."],
  ['m6', "Don't stare at the dome on the hill. People who stare get visits."],
  ['f1', "Hi there! You must be new. It's a small town — everybody notices new."],
  ['f1', "The fish fry at the parish hall is Friday. Bring a dish, or bring an appetite."],
  ['f1', "My husband says the Northstar money is good for the town. I'm not so sure."],
  ['f2', "Brr! I'll never get used to these dark afternoons, and I was born here."],
  ['f2', "Ruth Aqpik taught me to read. Taught half this town. You should meet her."],
  ['f2', "Somebody's been fixing things around town. Was that you? Thank you!"],
  ['f3', "The radio station's been playing the same twenty songs since summer. Nina needs a new transmitter."],
  ['f3', "Did you hear? A council seat might open up. Ray Moody's had enough, they say."],
  ['f3', "Pearl at the post office knows everything. Everything. Be careful what you mail."],
  ['f4', "Evening! Watch your step — the boardwalk's got rotten planks by the harbour."],
  ['f4', "I don't trust that Evan kid. Nobody smiles that much in November."],
  ['f4', "The aurora's out! Look up, look up!"],
  ['f5', "Hey. Mind the dogs on Second Avenue. They bark, they don't bite. Mostly."],
  ['f5', "My mother says there used to be a Russian school here, a hundred years ago."],
  ['f5', "That new store's got cameras pointed at the church. Who points cameras at a church?"],
  ['f6', "Lou's got trivia night on Wednesdays at the Anchor. Loser buys a round."],
  ['f6', "Doc Haverford says half the town's got vitamin D problems. No kidding, Doc."],
  ['f6', "Have a good one. Stay warm. Wear a hat — you're not in Anchorage anymore."],
];

export const LINES = {};
export const FOLK = {};
B.forEach(([voice, en], i) => {
  const id = `folk.${voice}.${i}`;
  LINES[id] = { who: voice, en };
  (FOLK[voice] ||= []).push({ id });
});
