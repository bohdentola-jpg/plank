// STORY — "WHO RUNS PORT HALCYON?"  Data only: chapters, crews, events,
// parts catalog, body-shop options, starter cars, and the text messages that
// carry the plot (script.js). The people live in crews.js, reputation in rep.js.
import { VINYLS, KITS, SPOILERS, HOODS } from '../car/kits.js';
import { RIM_NAMES, RIM_COLOR_NAMES } from '../car/model.js';
import { RIVALS } from './crews.js';
import { MESSAGES } from './script.js';

export { RIVALS, MESSAGES };
export const SAVE_VERSION = 2;
export const START_CASH = 8000;
export const GARAGE_SLOTS = 6;

// ------------------------------------------------------------------ chapters + crews
// boss: the boss rival (crews.js) plus the rating their car is tuned to for
// the boss race (and the pink slip) and their skill. skill: the crew's base
// skill. bossWins / bossRep: wins in the chapter and street REP before the
// boss calls you out. drift: scale on the crew's posted drift scores.

const boss = (id, pr, skill) => ({ ...RIVALS[id], pr, skill });

export const CHAPTERS = [
  {
    id: 'main', name: 'DOWNTOWN', crew: 'KINGS OF MAIN', color: '#ff3d6e', district: 'downtown',
    blurb: 'Four-lane boulevards, wet asphalt, neon. The Kings run every light on Main Street.',
    intro: 'Nobody in Port Halcyon knows your name yet. The Kings of Main run every light on the boulevard, and Dez runs the Kings.',
    outro: 'Dez threw his keys on the hood and walked home in the rain. Main Street knows your name now, and somebody on the radio said it too.',
    members: ['lilmo', 'sparky', 'tina', 'jayr', 'boogie', 'nico'],
    boss: boss('dez', 590, 0.74), skill: 0.55, bossWins: 4, bossRep: 500, drift: 1,
  },
  {
    id: 'china', name: 'CHINATOWN', crew: 'NIGHT MARKET', color: '#2fd68a', district: 'chinatown',
    blurb: 'Lantern-lit alleys, fish tanks and a neon main street. When the stalls shut at two, the Night Market races until the delivery vans come back.',
    intro: 'Jade\'s grandmother has sold noodles on the same corner for forty years. Jade has never lost a race that started in front of it.',
    outro: 'Jade bowed, handed over her keys and went back to help close the shop. "Manny Santos would have liked you," she said. Rosa never told you her father\'s name.',
    members: ['pearl', 'taxi', 'firework', 'koi', 'lucky', 'domino'],
    boss: boss('jade', 630, 0.78), skill: 0.6, bossWins: 5, bossRep: 1700, drift: 1.1,
  },
  {
    id: 'docks', name: 'THE DOCKS', crew: 'HARBOR RATS', color: '#ffb21e', district: 'docks',
    blurb: 'Container canyons and gantry cranes. Sodium light, diesel, salt, and no rules.',
    intro: 'The Rats work the night shift on the container terminal, moving boxes nobody signs for. Tank doesn\'t race to win. He races to hurt.',
    outro: 'Tank\'s Stallion is yours, and Tank is on the dock, talking. Not about cars. About a man called Vex, and whose boxes he moves.',
    members: ['rust', 'bilge', 'marlow', 'keel', 'skiff', 'gaff'],
    boss: boss('tank', 686, 0.8), skill: 0.64, bossWins: 5, bossRep: 3300, drift: 1.2,
  },
  {
    id: 'pass', name: 'THE PASS', crew: 'KAIDO GHOSTS', color: '#46e8ff', district: 'pass',
    blurb: 'Guardrail on one side, rock on the other. The Ghosts only race the mountain, and only at night.',
    intro: 'Kaito\'s Trueno is older than some of his rivals. Its engine was built by a tuner from the city who, they say, drove the bridge better than anyone.',
    outro: 'At the top of the pass Kaito told you about Manny Santos: the best tuner in Halcyon, a race on the Bayshore bridge, and a car they pulled out of the bay. Empty.',
    members: ['hayate', 'sora', 'rin', 'tetsu', 'mika', 'yuki'],
    boss: boss('kaito', 686, 0.93), skill: 0.68, bossWins: 5, bossRep: 5200, drift: 1.3,
  },
  {
    id: 'bay', name: 'BAYSHORE', crew: 'THE 200 CLUB', color: '#4d7cff', district: 'bayshore',
    blurb: 'The elevated expressway along the bay: the long bridge, the tunnel, the towers. Nobody in the Club has done less than two hundred on it.',
    intro: 'Ten years ago Manny Santos went over the bridge rail racing Bishop. Rosa was fifteen. She wants to know why. So do you.',
    outro: 'Bishop told you everything: Vex paid him to box Manny in. That same night somebody broke into the shop and left a note on the lift. THE SANTOS DEBT IS DUE.',
    members: ['milemarker', 'tollbooth', 'weave', 'nightowl', 'overpass', 'siren'],
    boss: boss('bishop', 775, 0.86), skill: 0.72, bossWins: 5, bossRep: 8000, drift: 1.4,
  },
  {
    id: 'track', name: 'THE RACEWAY', crew: 'PADDOCK CLUB', color: '#d6f03c', district: 'raceway',
    blurb: 'Redwood, Crestwood and the new Ironwood circuit in the old parkland. Rich kids rent the tracks after hours and hire washed-up pros to beat.',
    intro: 'Vex doesn\'t race nobodies. Sterling\'s money is behind his games, and Sterling plays at the raceway with his Paddock Club. Make him notice you.',
    outro: 'Sterling signed his 996 over like a bar tab. "Vex keeps your little shop\'s marker in his glovebox," he said. "He\'ll race you for it. He can\'t help himself."',
    members: ['dutch', 'valentina', 'chip', 'bunny', 'preston', 'millie'],
    boss: boss('sterling', 822, 0.88), skill: 0.76, bossWins: 5, bossRep: 11500, drift: 1.5,
  },
  {
    id: 'desert', name: 'ROUTE 99', crew: 'ROUTE 99 SYNDICATE', color: '#ff7a2a', district: 'desert',
    blurb: 'Two-lane blacktop through the heat shimmer, a dead mining town and a salt flat. The Syndicate races for money. Big money.',
    intro: 'Manny\'s marker is in the glovebox of a Venom. Win it back and Santos Auto Body is Rosa\'s for good. Lose, and Vex takes the shop.',
    outro: 'The marker burned on the hood of the Venom. Vex only laughed: "Tell your ghost on the radio we\'re square." Then the radio started saying your name.',
    members: ['dune', 'rattler', 'mesa', 'colt', 'sidewinder', 'scorpion'],
    boss: boss('vex', 866, 0.9), skill: 0.8, bossWins: 5, bossRep: 15500, drift: 1.6,
  },
  {
    id: 'freq', name: 'THE FREQUENCY', crew: 'THE FREQUENCY', color: '#a45cf0', district: 'freq', citywide: true,
    blurb: 'A pirate signal on 92.7 after midnight: race locations in code, all over the city. Nobody knows who runs it.',
    intro: 'Every crew in the city answers to you now, except one. The Frequency reads out the races at midnight, all over Port Halcyon, and ZERO is listening.',
    outro: 'On the bridge where it all started, ZERO took off the helmet. Rosa dropped her coffee. Manny Santos had been on the radio the whole time.',
    members: ['static', 'echo', 'cipher', 'nul', 'halo', 'reverb'],
    boss: boss('zero', 915, 0.94), skill: 0.84, bossWins: 5, bossRep: 20000, drift: 1.7,
  },
];

export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map((c, i) => [c.id, i]));

// ------------------------------------------------------------------ events
// type: circuit | sprint | knockout | drag | drift | timeattack (vs the clock: tt = target factor
// on a pro's lap in your own car — 1.0 means "as fast as a pro").
// kind: race (default) | duel (one on one vs `vs`) | cup (three rounds, points) | boss.
// pr: the rivals' performance rating. prize: cash for 1st (2nd 45%, 3rd 20%).
// with: crew members who are always on the grid (drift: whose scores are posted).
// guests: beaten bosses who come back for the race. need: {wins} in this chapter, or {rep}.

const E = (ch, id, name, track, type, o, flavor) => ({ id, ch, name, track, type, kind: 'race', ...o, flavor });
const DUEL = (ch, id, vs, name, track, type, o, flavor) => ({ id, ch, name, track, type, kind: 'duel', vs, rivals: 1, ...o, flavor });
const CUP = (ch, id, name, rounds, o, flavor) => ({ id, ch, name, kind: 'cup', track: rounds[0].track, type: rounds[0].type, rounds, ...o, flavor });
const BOSS = (ch, id, name, track, type, o, flavor) => ({ id, ch, name, track, type, kind: 'boss', boss: true, rivals: 1, pr: 0, ...o, flavor });
const r = (track, type, laps) => (laps ? { track, type, laps } : { track, type });

export const EVENTS = [
  // ch 1 — DOWNTOWN · KINGS OF MAIN
  E(0, 'dt1', 'FRIDAY NIGHT LIGHTS', 'downtown', 'circuit', { laps: 1, rivals: 3, pr: 495, prize: 1500, with: ['sparky'] }, 'Easy money. Four cars, one lap, the whole boulevard watching.'),
  E(0, 'dt2', 'UPTOWN RUN', 'uptown', 'sprint', { rivals: 3, pr: 505, prize: 1800, traffic: true }, 'Bridge to the hill, every light red, cabs in both directions. Nobody brakes first.'),
  E(0, 'dt3', 'LAST ONE OUT', 'oldtown', 'knockout', { rivals: 3, pr: 512, prize: 2200 }, 'Old Town is tight and the Kings play rough. Last car each lap goes home.'),
  E(0, 'dt4', 'RAIN CHECK', 'uptown', 'timeattack', { tt: 1.06, prize: 1600 }, 'Tina set the Uptown record in the rain. Beat her number.'),
  E(0, 'dt5', 'SUNDAY SERVICE', 'downtown_r', 'circuit', { laps: 2, rivals: 4, pr: 520, prize: 2000, with: ['nico'] }, 'The Kings run the loop backwards on Sundays, just to confuse the cops. The long boulevard comes last.'),
  DUEL(0, 'dt6', 'tina', 'RAIN DANCE', 'uptown', 'sprint', { pr: 528, prize: 2400, need: { wins: 2 } }, 'Tina wants her record back. One on one, Uptown, in the rain. Loser buys the coffee.'),
  E(0, 'dt7', 'BLOCK PARTY', 'oldtown_r', 'drift', { laps: 1, prize: 1800, with: ['jayr', 'boogie', 'lilmo'] }, 'Old Town backwards in the rain. The Kings score every slide from the fire escapes, and Jay-R\'s is the score to beat.'),
  E(0, 'dt8', 'MAIN EVENT', 'oldtown', 'circuit', { laps: 2, rivals: 5, pr: 540, prize: 2600 }, 'Full grid on the narrow streets. Win this and Dez has to answer.'),
  BOSS(0, 'dt_boss', 'DEZ: KING OF MAIN', 'downtown', 'circuit', { laps: 2, prize: 5000 }, 'One on one with the King. His S15 has never lost on Main. Beat him and the car is yours.'),

  // ch 2 — CHINATOWN · NIGHT MARKET
  E(1, 'ct1', 'LANTERN ALLEY', 'chinatown', 'circuit', { laps: 2, rivals: 3, pr: 550, prize: 2600 }, 'The stalls are shut and the lanterns are still lit. Two laps of the old quarter, market S-bends and all.'),
  E(1, 'ct2', 'KINGS VS MARKET', 'oldtown', 'circuit', { laps: 2, rivals: 4, pr: 555, prize: 2800, guests: ['lilmo', 'nico'] }, 'The Kings drove over to see what the fuss was about. Old Town, two laps, Main Street against the Market.'),
  DUEL(1, 'ct3', 'pearl', 'SPECIAL DELIVERY', 'uptown', 'sprint', { pr: 562, prize: 3000, need: { wins: 2 } }, 'Pearl does the uptown delivery run with the soup still hot. She\'ll race you there for the tip.'),
  E(1, 'ct4', 'FIRECRACKER', 'chinatown', 'knockout', { rivals: 4, pr: 568, prize: 3200, with: ['firework'] }, 'Firework lights a string at the start. Every lap the last car home is out, and nobody can tell the bangs from the backfires.'),
  E(1, 'ct5', 'MOON LAP', 'chinatown', 'timeattack', { tt: 1.05, prize: 2600 }, 'Koi\'s lap is chalked on the noodle shop door. Beat it and you get to rub it out.'),
  E(1, 'ct6', 'NEON DRIFT', 'chinatown', 'drift', { laps: 1, prize: 2800, with: ['koi', 'lucky', 'taxi'] }, 'Main street neon on wet tiles and a crowd on every balcony. The Night Market scores style, and Koi scores highest.'),
  CUP(1, 'ct7', 'LANTERN CUP', [r('chinatown', 'circuit', 1), r('oldtown_r', 'circuit', 1), r('uptown', 'sprint')], { rivals: 4, pr: 578, prize: 7000, need: { rep: 1100 } }, 'Invitation only. Three races in one night, points for every place. Jade keeps score in a ledger behind the counter.'),
  E(1, 'ct8', 'LAST ORDERS', 'oldtown_r', 'circuit', { laps: 2, rivals: 5, pr: 588, prize: 3600 }, 'Last orders at the noodle shop, then a full grid round Old Town backwards in the rain. Bring a towel.'),
  DUEL(1, 'ct9', 'koi', 'THE RIVER', 'chinatown', 'circuit', { laps: 2, pr: 595, prize: 4000, need: { wins: 5 } }, 'Koi only races when the moon is out, and tonight it\'s full. One on one, two laps of Lantern Street.'),
  BOSS(1, 'ct_boss', 'JADE: THE NIGHT MARKET', 'chinatown', 'circuit', { laps: 2, prize: 8000 }, 'Jade\'s Miyako weighs less than your conscience. Two laps of her streets, from her grandmother\'s corner. Win and it\'s yours.'),

  // ch 3 — THE DOCKS · HARBOR RATS
  E(2, 'dk1', 'CONTAINER CANYON', 'harbor', 'circuit', { laps: 2, rivals: 4, pr: 600, prize: 3800 }, 'Steel walls both sides, puddles deep enough to swim in.'),
  E(2, 'dk2', 'END OF THE PIER', 'pier9', 'circuit', { laps: 2, rivals: 3, pr: 605, prize: 4000 }, 'Square corners and a hairpin over the water. Brake late or go swimming.'),
  E(2, 'dk3', 'SLIPWAY', 'shipyard', 'sprint', { rivals: 4, pr: 612, prize: 4400, traffic: true }, 'From the container terminal past the dry docks and out through the old shipyard gates. The night shift doesn\'t stop for anybody.'),
  E(2, 'dk4', 'RAT RACE', 'harbor', 'knockout', { rivals: 4, pr: 618, prize: 4800 }, 'Five Rats, one survivor. They will trade paint.'),
  E(2, 'dk5', 'NIGHT SHIFT', 'pier9', 'drift', { laps: 1, prize: 4000, with: ['keel', 'skiff', 'gaff'] }, 'The crane crews score every slide from the cab. Square corners, wet concrete: beat the Rats\' posted scores.'),
  DUEL(2, 'dk6', 'marlow', 'THE HEIST', 'pier9', 'circuit', { laps: 2, pr: 625, prize: 5000, need: { wins: 2 } }, 'Marlow has studied every race you\'ve run. Pier 9, one on one, and he swears he knows exactly where you lose.'),
  E(2, 'dk7', 'DRY DOCK', 'shipyard', 'timeattack', { tt: 1.045, prize: 4200 }, 'The yard foreman timed the fastest run to the gates back in \'89. The number is still painted on the slipway.'),
  E(2, 'dk8', 'DOWNTOWN DELIVERY', 'downtown', 'circuit', { laps: 2, rivals: 5, pr: 635, prize: 5500, traffic: true, guests: ['dez'] }, 'The Rats come uptown to settle a debt with the Kings, and Dez rides along in a fresh S15. Six cars, wet streets, rush-hour traffic.'),
  CUP(2, 'dk9', 'CONTAINER CUP', [r('harbor', 'circuit', 1), r('shipyard', 'sprint'), r('pier9', 'circuit', 1)], { rivals: 4, pr: 642, prize: 12000, need: { rep: 2700 } }, 'Invitation only. Three races round the port, points for every place. The winner gets the gate key and the Rats\' respect, whichever is worth more.'),
  BOSS(2, 'dk_boss', 'TANK: HARBOR MASTER', 'harbor', 'circuit', { laps: 2, prize: 12000 }, 'Tank\'s Stallion weighs as much as a forklift and drives like one. A fast one. Win and it\'s yours.'),

  // ch 4 — THE PASS · KAIDO GHOSTS
  E(3, 'ps1', 'DOWNHILL', 'kaido', 'sprint', { rivals: 3, pr: 650, prize: 5100 }, 'Pass road from the ridge to the valley, hairpins stacked down the face. Respect the guardrail.'),
  E(3, 'ps2', 'FOG LINE', 'summit', 'circuit', { laps: 1, rivals: 4, pr: 655, prize: 5400 }, 'Switchbacks up, a plunge down, fog everywhere in between.'),
  E(3, 'ps3', 'HILL CLIMB', 'ridgeline', 'sprint', { rivals: 4, pr: 662, prize: 5800 }, 'Valley floor to the ridge, switchback after switchback. Going up, the engine finally matters.'),
  E(3, 'ps4', 'GHOST LAP', 'kaido', 'timeattack', { tt: 1.035, prize: 4950 }, 'The Ghosts keep a time carved into the summit sign. Beat it.'),
  E(3, 'ps5', 'SUMMIT KNOCKOUT', 'summit', 'knockout', { rivals: 4, pr: 670, prize: 6300 }, 'Two laps of the peak. Every time past the shrine, the back of the pack goes home.'),
  DUEL(3, 'ps6', 'rin', 'SHRINE GATE', 'summit', 'circuit', { laps: 1, pr: 675, prize: 6400, need: { wins: 2 } }, 'Rin says your lines are lazy. One on one round the summit, through the shrine gate and down.'),
  E(3, 'ps7', 'FALLING LEAVES', 'summit', 'drift', { laps: 1, prize: 5500, with: ['rin', 'mika', 'sora'] }, 'The Ghosts score every slide past the shrine. Rin\'s posted score has stood all autumn.'),
  E(3, 'ps8', 'GOLDEN HOUR', 'crestwood', 'circuit', { laps: 2, rivals: 5, pr: 685, prize: 6800 }, 'The Ghosts borrow the old hill circuit at sundown. Blind crest, corkscrew, carousel.'),
  DUEL(3, 'ps9', 'yuki', 'THE STUDENT', 'ridgeline', 'sprint', { pr: 692, prize: 7600, need: { wins: 5 } }, 'Kaito won\'t race you until you beat his student. Uphill to the ridge, and Yuki has never lost going up.'),
  BOSS(3, 'ps_boss', 'KAITO: THE GHOST', 'kaido', 'sprint', { prize: 15000 }, 'A twenty-year-old Trueno that nobody has beaten downhill. Ever. Win and it\'s yours.'),

  // ch 5 — BAYSHORE · THE 200 CLUB
  E(4, 'bs1', 'THE LONG BRIDGE', 'bayshore', 'sprint', { rivals: 4, pr: 700, prize: 6800, traffic: true, guests: ['tank'] }, 'The expressway along the bay at night: the long bridge, the tunnel, the towers. Tank followed you up from the docks for a rematch.'),
  E(4, 'bs2', 'INTERSTATE 9', 'interstate', 'sprint', { rivals: 4, pr: 705, prize: 7100 }, 'Flat out through traffic on the interstate. Two hundred or nothing.'),
  E(4, 'bs3', 'SKYLINE', 'skyline', 'circuit', { laps: 3, rivals: 5, pr: 712, prize: 7500 }, 'Elevated expressway loop above the city lights.'),
  E(4, 'bs4', 'TUNNEL VISION', 'bayshore', 'timeattack', { tt: 1.03, prize: 6400 }, 'The Club keeps a Bayshore time on a napkin pinned up in the all-night diner. Nobody has touched it since \'96.'),
  DUEL(4, 'bs5', 'siren', 'PULL OVER', 'interstate', 'sprint', { pr: 720, prize: 7900, need: { wins: 2 } }, 'Siren used to teach cops how to chase. Now she wants to see if you can run.'),
  E(4, 'bs6', 'EXIT ONLY', 'skyline', 'knockout', { rivals: 5, pr: 725, prize: 8200 }, 'Every time under the overpass, the last car takes the exit and goes home.'),
  CUP(4, 'bs7', '200 CLUB CUP', [r('bayshore', 'sprint'), r('skyline', 'circuit', 2), r('interstate', 'sprint')], { rivals: 4, pr: 732, prize: 18000, need: { rep: 6400 } }, 'Invitation only. Three runs in one night, points for every place. Win it and you\'re in the Club.'),
  E(4, 'bs8', 'GRAVEYARD SHIFT', 'bayshore', 'sprint', { rivals: 5, pr: 740, prize: 9000, traffic: true }, 'Three in the morning, trucks in every lane, the whole Club on the bridge.'),
  DUEL(4, 'bs9', 'milemarker', 'HARD SHOULDER', 'bayshore', 'sprint', { pr: 745, prize: 9800, need: { wins: 5 } }, 'Mile Marker has been waiting on the hard shoulder all night. He wants the bridge, and he wants it at two hundred.'),
  BOSS(4, 'bs_boss', 'BISHOP: THE BRIDGE', 'bayshore', 'sprint', { prize: 20000 }, 'Bishop hasn\'t raced the bridge in ten years. Tonight he will. Just you, him and the rail. Win and his Suprano is yours.'),

  // ch 6 — THE RACEWAY · PADDOCK CLUB
  E(5, 'rw1', 'TRACK DAY', 'redwood', 'circuit', { laps: 2, rivals: 4, pr: 750, prize: 9100 }, 'Helmet, wristband, a waiver nobody reads. Track day at Redwood is the Paddock Club\'s idea of a street race.'),
  E(5, 'rw2', 'PARKLAND', 'ironwood', 'circuit', { laps: 2, rivals: 5, pr: 755, prize: 9400 }, 'Overcast and wet. Fast curves through the old parkland, then into a stadium where nobody is cheering for you.'),
  DUEL(5, 'rw3', 'chip', 'ALLOWANCE', 'crestwood', 'circuit', { laps: 2, pr: 760, prize: 9800, need: { wins: 2 } }, 'Chip bet his allowance you\'d crash at the corkscrew. His allowance is bigger than your garage. Make him pay.'),
  E(5, 'rw4', 'AFTER HOURS', 'redwood', 'circuit', { laps: 2, rivals: 5, pr: 768, prize: 10200, guests: ['bishop'] }, 'Someone cut the lock on the raceway gate. Grand-prix rules, no marshals. Bishop came to watch and stayed to race.'),
  E(5, 'rw5', 'PIT WALL', 'ironwood', 'timeattack', { tt: 1.03, prize: 8800 }, 'Dutch\'s lap record from 1991 is still on the board in the timing tower. He would like it to stay there.'),
  E(5, 'rw6', 'GRAVEL TRAP', 'crestwood', 'knockout', { rivals: 4, pr: 775, prize: 10800 }, 'Five cars, two laps of the hills. The Paddock bets on who goes in the gravel first.'),
  E(5, 'rw7', 'STADIUM SECTION', 'ironwood', 'drift', { laps: 1, prize: 9400, with: ['bunny', 'valentina', 'preston'] }, 'Sideways through the stadium on wet tarmac, empty stands all round. Bunny\'s posted scores are mostly legit.'),
  CUP(5, 'rw8', 'PADDOCK CUP', [r('redwood', 'circuit', 1), r('ironwood', 'circuit', 1), r('crestwood', 'circuit', 1)], { rivals: 5, pr: 785, prize: 22400, need: { rep: 10000 } }, 'Members only. Three circuits, championship points and a trophy nobody will polish. The Paddock Club\'s idea of slumming it.'),
  DUEL(5, 'rw9', 'dutch', 'HOME TRACK', 'redwood', 'circuit', { laps: 2, pr: 795, prize: 11900, need: { wins: 5 } }, 'Dutch hasn\'t lost at Redwood since the year you were born. He says it will take more than a fast car.'),
  BOSS(5, 'rw_boss', 'STERLING: OLD MONEY', 'ironwood', 'circuit', { laps: 2, prize: 25000 }, 'Sterling has rented the whole circuit for the night: his 996 Turbo, your car, and his father\'s lawyers in the grandstand. Win and the Turbo is yours.'),

  // ch 7 — ROUTE 99 · ROUTE 99 SYNDICATE
  E(6, 'r9_1', 'HEAT SHIMMER', 'route99', 'sprint', { rivals: 4, pr: 800, prize: 11700 }, 'Two-lane blacktop through the Mojave, past the truck stop and into the slot canyon. Watch the whoops.'),
  E(6, 'r9_2', 'QUARTER MILE', 'drylake', 'drag', { rivals: 1, pr: 805, prize: 11000 }, 'Salt flat, chalk lines, a tree of lights. Launch and shift. That\'s it.'),
  E(6, 'r9_3', 'RED ROCK', 'redrock', 'circuit', { laps: 2, rivals: 5, pr: 810, prize: 12400, guests: ['sterling'] }, 'Sunset loop between the buttes. Sterling put money on the table and himself on the grid.'),
  E(6, 'r9_4', 'GHOST TOWN', 'ghosttown', 'circuit', { laps: 2, rivals: 4, pr: 815, prize: 12700 }, 'Out of the old mining town, across the wash, through the canyon and back past the saloon. Nobody has lived here since 1931. Somebody keeps the lights on.'),
  DUEL(6, 'r9_5', 'colt', 'HIGH NOON', 'drylake', 'drag', { pr: 820, prize: 13000, need: { wins: 2 } }, 'Colt wants a quarter mile at sundown, one on one, a silver dollar on the line. Shift on the lights.'),
  E(6, 'r9_6', 'BAKED', 'redrock', 'knockout', { rivals: 4, pr: 825, prize: 13600 }, 'Two laps of heat. The Syndicate bets on who drops first.'),
  E(6, 'r9_7', 'SALOON DOORS', 'ghosttown', 'drift', { laps: 1, prize: 11700, with: ['sidewinder', 'scorpion', 'dune'] }, 'Sideways down main street past the saloon. The Syndicate scores it from the hotel balcony with a bottle of mezcal.'),
  E(6, 'r9_8', 'BIG MONEY DRAG', 'drylake', 'drag', { rivals: 3, pr: 835, prize: 15000 }, 'Four lanes, four cars, one envelope of cash on the hood.'),
  CUP(6, 'r9_9', 'BLOOD MONEY CUP', [r('route99', 'sprint'), r('ghosttown', 'circuit', 1), r('redrock', 'circuit', 1)], { rivals: 4, pr: 842, prize: 29200, need: { rep: 14000 } }, 'Invitation only. Three races, one betting book, and Mesa keeps it. The odds on you are improving.'),
  BOSS(6, 'r9_boss', 'VEX: THE SYNDICATE', 'route99', 'sprint', { prize: 30000 }, 'Vex puts the Santos marker on the hood of his Venom. Win and the shop is Rosa\'s for good, and the Venom is yours.'),

  // ch 8 — THE FREQUENCY (all over the city)
  E(7, 'fq1', 'WAVELENGTH', 'chinatown', 'circuit', { laps: 2, rivals: 4, pr: 850, prize: 14400 }, 'Midnight on 92.7: the first race is in Chinatown. The Night Market shut early to watch.'),
  E(7, 'fq2', 'OPEN WATER', 'shipyard', 'sprint', { rivals: 4, pr: 855, prize: 14400 }, 'The shipyard at dusk, the cranes lit up purple. Somebody on the radio is counting down.'),
  E(7, 'fq3', 'CARRIER WAVE', 'bayshore', 'sprint', { rivals: 5, pr: 860, prize: 15600, traffic: true }, 'The bridge again. The Frequency wants to see what you do where Manny went over.'),
  E(7, 'fq4', 'DEAD AIR', 'skyline', 'timeattack', { tt: 1.02, prize: 13200 }, 'One lap of the skyline. They want a pro\'s time. Exactly a pro\'s time.'),
  DUEL(7, 'fq5', 'halo', 'DON\'T BLINK', 'ridgeline', 'sprint', { pr: 868, prize: 16800, need: { wins: 2 } }, 'Halo\'s white Pipistrello is idling at the bottom of the ridge. First one to the top.'),
  E(7, 'fq6', 'SIGNAL LOSS', 'ghosttown', 'knockout', { rivals: 5, pr: 870, prize: 16800 }, 'Six cars, two laps of a dead town. The Frequency wants to see who breaks.'),
  E(7, 'fq7', 'LAST CALL', 'downtown', 'circuit', { laps: 2, rivals: 5, pr: 862, prize: 19200, guests: ['vex', 'sterling', 'bishop'] }, 'Every crew you beat closed Main Street for one last run. Vex brought a new Venom. Bishop brought his nerve back.'),
  CUP(7, 'fq8', 'FREQUENCY CUP', [r('ironwood', 'circuit', 1), r('interstate', 'sprint'), r('ridgeline', 'sprint')], { rivals: 5, pr: 882, prize: 39000, need: { rep: 18500 } }, 'Invitation only. Three races across the city in one night, the points read out live on 92.7.'),
  DUEL(7, 'fq9', 'cipher', 'ZERO HOUR', 'interstate', 'sprint', { pr: 890, prize: 21000, need: { wins: 5 } }, 'Cipher is ZERO\'s last line. The interstate at two in the morning, one on one. Then the radio goes quiet.'),
  BOSS(7, 'fq_boss', 'ZERO', 'bayshore', 'sprint', { prize: 50000 }, 'The bridge. Midnight. Where it started. Win and the Pipistrello is yours, and so is the Frequency.'),
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Wins needed in a chapter before its boss calls you out (when a chapter doesn't say). */
export const BOSS_UNLOCK_WINS = 5;
/** Championship points per finishing place in a cup round. */
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

/** The v1 story's events and chapters, for moving old saves over (v1 id → v2 id). */
export const V1_EVENTS = {
  c1e1: 'dt1', c1e2: 'dt2', c1e3: 'dt3', c1e4: 'dt4', c1e5: 'dt8', c1b: 'dt_boss',
  c2e1: 'dk1', c2e2: 'dk2', c2e3: 'dk4', c2e4: 'dk5', c2e5: 'dk8', c2b: 'dk_boss',
  c3e1: 'ps1', c3e2: 'ps2', c3e3: 'ps4', c3e4: 'ps5', c3e5: 'ps8', c3b: 'ps_boss',
  c4e1: 'r9_1', c4e2: 'r9_2', c4e3: 'r9_3', c4e4: 'r9_6', c4e5: 'r9_8', c4b: 'r9_boss',
  c5e1: 'bs2', c5e2: 'bs3', c5e3: 'rw4', c5e4: 'rw6', c5e5: 'fq4',
};
/** v1 chapter index → v2 chapter index (v1: downtown, docks, pass, desert, frequency). */
export const V1_CHAPTERS = [0, 2, 3, 6, 7];

// ------------------------------------------------------------------ performance parts

export const TIER_NAMES = ['STOCK', 'STREET', 'PRO', 'RACE'];
/** Chapter (0-based) at which each tier goes on sale. */
export const TIER_UNLOCK = [0, 0, 1, 3];
export const CLASS_PRICE = { D: 1.0, C: 1.25, B: 1.5, A: 1.85, S: 2.3 };

export const PERF_PARTS = [
  { id: 'engine', name: 'ENGINE', desc: 'Cams, pistons, ported head, balanced bottom end.', price: [1500, 4500, 11000],
    tiers: [{ power: 0.06 }, { power: 0.12, redline: 250 }, { power: 0.2, redline: 500 }] },
  { id: 'turbo', name: 'FORCED INDUCTION', desc: 'Turbo kit — or a bigger turbo, or a supercharger on the big engines.', price: [2500, 6000, 14000],
    tiers: [{ power: 0.07, turbo: 0.55 }, { power: 0.14, turbo: 0.8 }, { power: 0.22, turbo: 1.0 }] },
  { id: 'exhaust', name: 'INTAKE + EXHAUST', desc: 'Cold-air intake, headers, straight-through exhaust. Louder pops.', price: [600, 1500, 3500],
    tiers: [{ power: 0.03, exhaustSound: 0.15 }, { power: 0.05, exhaustSound: 0.3 }, { power: 0.08, exhaustSound: 0.45 }] },
  { id: 'ecu', name: 'ECU', desc: 'Remapped fuel and ignition. More midrange, more top.', price: [500, 1500, 3500],
    tiers: [{ power: 0.02, torqueLow: 0.05 }, { power: 0.04, torqueLow: 0.1 }, { power: 0.06, torqueLow: 0.16, redline: 250 }] },
  { id: 'trans', name: 'TRANSMISSION', desc: 'Short-shift kit, lighter flywheel, dog-box on the race tier.', price: [900, 2500, 6000],
    tiers: [{ shift: 0.2 }, { shift: 0.35 }, { shift: 0.5 }] },
  { id: 'susp', name: 'SUSPENSION', desc: 'Coilovers, sway bars, bushings. Lower and sharper.', price: [800, 2200, 5500],
    tiers: [{ handling: 0.1, lower: 0.3 }, { handling: 0.2, lower: 0.6 }, { handling: 0.32, lower: 1.0 }] },
  { id: 'tires', name: 'TIRES', desc: 'Stickier compounds and wider footprints.', price: [600, 1600, 4000],
    tiers: [{ grip: 0.03 }, { grip: 0.06 }, { grip: 0.1 }] },
  { id: 'brakes', name: 'BRAKES', desc: 'Pads, lines, big multi-piston calipers on the race tier.', price: [700, 1800, 4500],
    tiers: [{ brake: 0.08 }, { brake: 0.16 }, { brake: 0.26 }] },
  { id: 'weight', name: 'WEIGHT REDUCTION', desc: 'Seats, sound deadening, spare tire, AC. Then carbon panels.', price: [1000, 3000, 8000],
    tiers: [{ weight: 0.04 }, { weight: 0.08 }, { weight: 0.12 }] },
  { id: 'nitrous', name: 'NITROUS', desc: 'Bigger bottles, wetter shots. More boost for longer.', price: [700, 2000, 5000],
    tiers: [{ nitro: 0.8 }, { nitro: 1.0 }, { nitro: 1.3 }] },
  { id: 'aero', name: 'AERO', desc: 'Splitter, diffuser, undertray. Grip that grows with speed.', price: [900, 2500, 6000],
    tiers: [{ aero: 0.3 }, { aero: 0.6 }, { aero: 1.0 }] },
];

const SUM = ['power', 'torqueLow', 'redline', 'shift', 'handling', 'lower', 'grip', 'brake', 'weight', 'aero'];
const MAX = ['turbo', 'nitro', 'exhaustSound'];

/** Part levels {engine: 2, ...} → physics upgrades for derivePerf/Vehicle. */
export function upgradesFor(levels = {}, spec = null) {
  const up = {};
  for (const part of PERF_PARTS) {
    const lv = levels[part.id] || 0;
    if (!lv) continue;
    const t = part.tiers[lv - 1];
    for (const [k, v] of Object.entries(t)) {
      if (SUM.includes(k)) up[k] = (up[k] || 0) + v;
      else if (MAX.includes(k)) up[k] = Math.max(up[k] || 0, v);
    }
  }
  // the big engines get a supercharger instead of a turbo (no lag, all whine)
  if (spec && up.turbo && ['v8', 'v10', 'v12'].includes(spec.sound.layout)) {
    delete up.turbo;
    up.supercharger = true;
  }
  if (up.turbo) up.turboSound = up.turbo;
  return up;
}

export const uniformLevels = (tier) => Object.fromEntries(PERF_PARTS.map((p) => [p.id, tier]));

export function partPrice(part, tier, spec) {
  return Math.round(part.price[tier - 1] * (CLASS_PRICE[spec.cls] || 1) / 50) * 50;
}

/** How much each part moves the performance rating (rough shares, for
 *  tuning a rival's car between two tiers to land on a rating). */
export const PART_PR_WEIGHT = { tires: 6, engine: 5, turbo: 5, exhaust: 2, weight: 2, ecu: 2, aero: 1, trans: 1, susp: 0.02, brakes: 0.02, nitrous: 0.02 };

// ------------------------------------------------------------------ body shop

export const PAINTS = [
  '#c8102e', '#f2f1ec', '#0e0f12', '#a9aeb5', '#1d3f8f', '#e3b52a', '#f26a1b', '#2b7a3a',
  '#5b2a86', '#36a8c9', '#7a1020', '#555b63', '#ff2a6d', '#9bff00', '#00c2ff', '#ffd400',
  '#3b2414', '#c9c2a6', '#6a8fb3', '#0b3d2e', '#d4547a', '#ff5ac8', '#e8e8e8', '#2a2d33',
];
export const FINISH_LIST = [['gloss', 'GLOSS', 0], ['metallic', 'METALLIC', 300], ['pearl', 'PEARL', 600], ['candy', 'CANDY', 900], ['matte', 'MATTE', 500], ['chrome', 'CHROME', 2500]];
export const NEONS = [null, '#ff2a6d', '#00e5ff', '#7a2cff', '#39ff6a', '#ffffff', '#ff8a00', '#ff2020'];

/** Body-shop categories: key in the look, the option list, label, price per change. */
export const BODY_PARTS = [
  { id: 'paint', name: 'PAINT', key: 'paint', options: PAINTS, label: () => '', price: 350, swatch: true },
  { id: 'finish', name: 'FINISH', key: 'finish', options: FINISH_LIST.map((f) => f[0]), label: (v) => FINISH_LIST.find((f) => f[0] === v)?.[1] || v, price: (v) => 200 + (FINISH_LIST.find((f) => f[0] === v)?.[2] || 0) },
  { id: 'vinyl', name: 'VINYL', key: 'vinyl', options: VINYLS, label: (v) => v.toUpperCase(), price: 500 },
  { id: 'paint2', name: 'VINYL COLOR', key: 'paint2', options: PAINTS, label: () => '', price: 250, swatch: true },
  { id: 'rims', name: 'RIMS', key: 'rims', options: RIM_NAMES, label: (v) => v.toUpperCase(), price: 1200 },
  { id: 'rimColor', name: 'RIM FINISH', key: 'rimColor', options: RIM_COLOR_NAMES, label: (v) => v.toUpperCase(), price: 300 },
  { id: 'rimSize', name: 'RIM SIZE', key: 'rimSize', options: [0, 1, 2, 3], label: (v) => (v ? `+${v} IN` : 'STOCK'), price: (v) => 300 + v * 350 },
  { id: 'kit', name: 'BODY KIT', key: 'kit', options: KITS, label: (v) => v.toUpperCase(), price: (v) => ({ stock: 300, street: 1800, race: 3200, wide: 5500 }[v] || 1000) },
  { id: 'spoiler', name: 'SPOILER', key: 'spoiler', options: SPOILERS, label: (v) => v.toUpperCase(), price: (v) => ({ none: 100, stock: 200, lip: 400, ducktail: 600, roof: 600, gt: 1200, evo: 1100, big: 1500, hoop: 900 }[v] || 600) },
  { id: 'hood', name: 'HOOD', key: 'hood', options: HOODS, label: (v) => v.toUpperCase(), price: (v) => ({ stock: 200, vented: 700, carbon: 1200, scoop: 900 }[v] || 600) },
  { id: 'tint', name: 'WINDOW TINT', key: 'tint', options: [0, 1, 2, 3], label: (v) => ['CLEAR', 'LIGHT', 'DARK', 'LIMO'][v], price: 150 },
  { id: 'neon', name: 'UNDERGLOW', key: 'neon', options: NEONS, label: (v) => (v ? '' : 'NONE'), price: 600, swatch: true },
  { id: 'ride', name: 'RIDE HEIGHT', key: 'ride', options: [0, 0.35, 0.7, 1], label: (v) => ['STOCK', 'LOWERED', 'SLAMMED', 'ON THE DECK'][[0, 0.35, 0.7, 1].indexOf(v)] || 'STOCK', price: 250 },
  { id: 'caliper', name: 'CALIPERS', key: 'caliper', options: ['#b8141c', '#e3b52a', '#1d3f8f', '#2b7a3a', '#0e0f12', '#f2f1ec', '#f26a1b'], label: () => '', price: 200, swatch: true },
];

// ------------------------------------------------------------------ cars

/** The classifieds on the bench: used starter cars. */
export const STARTERS = [
  { id: 'trueno', price: 5500, ad: '\'86 TRUENO. White/black, runs great. Smells like tofu. 210k miles. Cash only.', look: { paint: '#f2f1ec', vinyl: 'twotone', paint2: '#141416' } },
  { id: 'miyako', price: 6000, ad: '\'01 MIYAKO MX. Yellow, soft top leaks a little. Fun fun fun. No lowballers.', look: { paint: '#e3b52a' } },
  { id: 'civica', price: 6500, ad: '\'99 CIVICA SiR. Red, B-series screams to 8,600. Clean title. Must sell.', look: { paint: '#c8102e' } },
  { id: 'golfo', price: 7000, ad: '\'02 GOLFO 1.8T. Black, chipped, sleeper. Moving overseas, everything goes.', look: { paint: '#22252b' } },
];

/** Dealer: which classes are on sale from which chapter. */
export const DEALER_CLASS_UNLOCK = { D: 0, C: 0, B: 2, A: 3, S: 5 };
export const RESALE = 0.6;
/** A boss's car sold straight to the yard instead of kept: this share of its value. */
export const SLIP_SALE = 0.85;

export const BASE_LOOK = { plate: 'MIDNITE' };

/** Where each track sits on the board's city map (district keys of the map). */
export const TRACK_DISTRICT = {
  downtown: 'downtown', downtown_r: 'downtown', uptown: 'downtown',
  oldtown: 'chinatown', oldtown_r: 'chinatown', chinatown: 'chinatown',
  harbor: 'docks', pier9: 'docks', shipyard: 'docks',
  interstate: 'bayshore', skyline: 'bayshore', bayshore: 'bayshore',
  redwood: 'raceway', crestwood: 'raceway', ironwood: 'raceway',
  kaido: 'pass', summit: 'pass', ridgeline: 'pass',
  route99: 'desert', redrock: 'desert', drylake: 'desert', ghosttown: 'desert',
};
