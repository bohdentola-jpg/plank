// Story text. Lines are { who, text, radio? }; text may contain <b>…</b>.
export const SPEAKERS = {
  veil: { name: 'Captain Veil', color: '#a46bff', badge: 'V', pitch: 0.8 },
  baron: { name: 'Baron Grisaille', color: '#b9b5c4', badge: 'G', pitch: 0.62 },
  unknown: { name: '???', color: '#a46bff', badge: '?', pitch: 0.8 },
  dabble: { name: 'Dabble', color: '#ff8ccf', badge: 'D', pitch: 1.35 },
  tint: { name: 'Agent Tint', color: '#2ee6c8', badge: 'T', pitch: 1.05 },
  static: { name: '??? (static)', color: '#5fa8a0', badge: '~', pitch: 1.0 },
  pa: { name: 'Manor P.A.', color: '#8b8794', badge: '♪', pitch: 0.62 },
};
const V = (text) => ({ who: 'veil', text });
const VR = (text) => ({ who: 'veil', radio: true, text });
const B = (text) => ({ who: 'baron', text });
const BR = (text) => ({ who: 'baron', radio: true, text });
const T = (text) => ({ who: 'tint', text });
const TR = (text) => ({ who: 'tint', radio: true, text });
const DB = (text) => ({ who: 'dabble', text });

export const INTRO = [
  { who: 'unknown', text: 'Psst. Over here, rookie. And mind the gray puddles. They <b>bite</b>.' },
  V('Name\'s Veil. <b>Captain Veil</b>, Chroma Guard. Retired. Well… un-retired, as of this morning.'),
  V('Noticed the plaza looking a little washed out lately? Faded awnings, beige fountain spray? That\'s no accident.'),
  V('You\'re standing in the <b>Underside</b>: the old paint works that gave this city its color. Something moved in down here. We call them the <b>Drab</b>.'),
  V('Gray goo with a grudge. They\'re draining the city\'s color into stolen <b>Hue Cores</b> and hauling them off to their boss, <b>Baron Grisaille</b>.'),
  V('Five cores are hidden down here in the Paint Works, behind five sealed hatches. And the Drab\'s tunnels go a lot deeper than that.'),
  V('Your ink is the one thing the Drab can\'t stand. Paint, swim, climb. Splash anything gray that moves. And grab the <b>Hue Shards</b> you find. They\'re worth something.'),
  V('Start with <b>hatch one</b>. I\'ll be on the radio. Oh, and keep your eyes peeled for <b>Lost Swatches</b>. The old crew hid a few in every sector.'),
];

export const DABBLE_INTRO = [
  V('Rookie! Before you ask: yes, that\'s a Smudge. No, don\'t splash it.'),
  DB('Hi hi hi! I\'m <b>Dabble</b>! You splashed me back there and now I\'m <b>PINK</b>! Look at me! I\'m so PINK!'),
  V('Turns out a good splash knocks the gray right out of \'em. This one followed you home.'),
  DB('I don\'t wanna be gray anymore. Gray is boring. So I opened a <b>shop</b>!'),
  DB('Bring me <b>Hue Shards</b> and I\'ll trade you upgrades. Tougher scales! Faster ink! Big sparkly specials!'),
  V('Shards are the little crystals the Drab chip off the stolen cores. Pick up every one you see.'),
];
export const DABBLE_FIRST = [
  DB('Welcome to <b>Dabble\'s Swap Shop</b>! Shards in, upgrades out! No refunds! Okay, maybe hugs.'),
];
const DABBLE_LINES = [
  'Shards are shiny. Upgrades are shinier! Trust me, I\'m an expert in shiny now.',
  'Tough Scales are my bestseller. The Drab bite. Hard. I would know.',
  'Prism Burst makes your special go KABOOM, and then a second, smaller, rainbow-er KABOOM!',
  'Shard Magnet! For the busy hero on the go!',
  'You smell like adventure. And a little like paint thinner.',
];
export function dabbleLine(st) {
  const n = (st.shardsTotal || 0) + Object.values(st.up || {}).reduce((a, b) => a + b, 0);
  return DABBLE_LINES[n % DABBLE_LINES.length];
}

export const SECTOR1_DONE = [
  V('The Prism Heart! Rookie, you actually did it. Look at this place. You can almost see the color seeping back in.'),
  V('But the Baron got away. My scouts saw him slither down the old <b>Rinse Reservoir</b> gate. That\'s <b>Sector 2</b>.'),
  V('There\'s something else. My old partner, <b>Agent Tint</b>, went down there a month ago chasing the Drab. She never came back.'),
  V('The reservoir gate is open now, over by the west wall. Find the next Hue Cores. And if you find Tint… bring her home.'),
];
export const TINT_RESCUED = [
  T('Captain! Ha! You look terrible. You look <b>wonderful</b>.'),
  V('Tint. They had you plugged into that overgrown worm like a <b>battery</b>.'),
  T('The Grimewyrm. Grisaille\'s pet. He was feeding it my color one drop at a time. Thanks to you, rookie, I still have most of it.'),
  T('I learned a few things while I was stuck in there. Grisaille wasn\'t always a villain. He was the <b>head colorist</b> of these works, back when they were famous.'),
  T('Then came the accident. A vat of solvent, right in the face. When he woke up, he couldn\'t see color anymore. Not one hue.'),
  V('So he decided nobody else should either. Hmph. Doesn\'t make it right.'),
  T('No. His manor is above the old works: <b>Grisaille Manor</b>, Sector 3. The last cores are up there, and so is he. I\'ll be on the radio.'),
  V('The Sector 3 gate is up on the east gantry. Go get him, rookie. Bring every last color home.'),
];

export const SECTOR_INTRO = {
  hub2: [
    VR('The Rinse Reservoir. The old crew washed the brushes down here. Now it\'s all gray sludge and puddles.'),
    VR('Five hatches again. Watch the water lines, and remember: <b>paint everything</b>. Things down here react to ink.'),
  ],
  hub3: [
    TR('Grisaille Manor, servants\' stair. I\'ll guide you from here. Veil\'s monitoring from the hideout.'),
    TR('It gets <b>dark</b> up there, rookie. Good news: your ink glows in the dark. Bad news: so do the Drab\'s eyes.'),
  ],
};

const IDLE = [
  ['Hatch one is open. The mixing floor is a good place to stretch your fins.', 'Swim in your own ink to refill. Old trick, still the best one.'],
  ['One core home already! Hatch two leads to the Ghost Walk. Shoot first, step second.', 'The old crew painted those catwalks with invisible primer. Ink makes them show.'],
  ['Turret Alley is next. Blotters can\'t turn fast. Flank \'em.', 'See a panel with a glowing frame? That\'s a <b>paint switch</b>. Cover it in ink and something opens.'],
  ['Drone Heights. Watch the floor for warning rings. Those drones drop like clockwork.', 'The old silo lifts still work. Step on a platform with yellow trim and it\'ll carry you.'],
  ['The Gray Engine is beyond hatch five. Grisaille himself is down there.', 'His sweep beam is nasty. Paint the floor first so you can swim under it.'],
  ['Sector 2: the Rinse Reservoir. Through the gate on the west wall.', 'Yellow sponge blocks down there soak up ink and <b>grow</b>. Paint \'em and climb.'],
  ['The reservoir floods when the Drab open the valves. Paint the <b>drains</b> and the gray goes down.', 'Dabble says you\'ve been spending shards. Good. Tough Scales never hurt anybody.'],
  ['Ink rails! Jump up and grab one and it carries you. Jump again to let go.', 'Rumblers charge in straight lines. Sidestep, and let \'em kiss a wall.'],
  ['Pump Station. If the Drab swamp that pump, it\'s back to square one. Stay close to it.', 'Pilfers steal your ink. Splash \'em before they get close.'],
  ['Something big is moving in the reservoir. Something with <b>teeth</b>. Be careful.', 'If Tint\'s still down there, she\'s close.'],
  ['Tint\'s back, the manor\'s open. Sector 3 is up the east gantry.', 'It\'s dark up there. Paint the floor under the old lanterns to light them.'],
  ['The manor gallery is falling to pieces. Cracked floors don\'t hold you long. Keep moving.', 'Wardens carry shields. Go around \'em, or lob something over.'],
  ['Those shimmering films are <b>chroma membranes</b>. Dive into your ink and swim right through.', 'Timed switches reset if you dawdle. Plan your route first.'],
  ['The Grand Ascent goes all the way to the Baron\'s throne room. Everything you\'ve learned, rookie. All of it.', 'Stock up at Dabble\'s before you go. You\'ll want every edge.'],
  ['This is it. Baron Grisaille. Hatch five, up in the manor.', 'Whatever happens up there… I\'m proud of you, rookie.'],
  ['All fifteen cores home. The plaza\'s never looked brighter, rookie.', 'Still a few Lost Swatches out there. The Swatch Book knows which.'],
];

export function veilTalk(st, i) {
  const n = Array.isArray(st) ? st.length : st.cleared.length;
  const set = IDLE[Math.min(n, IDLE.length - 1)];
  return [{ who: 'veil', text: set[i % set.length] }];
}

const TINT_IDLE = [
  'Grisaille\'s manor has three floors of traps and one very bad mood. We go floor by floor.',
  'The gray goo burns, but your ink beats it. Paint first, step second. Veil taught us both that.',
  'Glints are snipers. When the laser turns <b>red</b>, dive into your ink or duck behind something.',
  'I still have nightmares about that worm. Thanks again for the rescue, rookie.',
  'Veil pretends she\'s retired. She has never once been retired.',
];
export function tintTalk(st, i) {
  if ((Array.isArray(st) ? st.length : st.cleared.length) >= 15) return [T('You did it, rookie. Captain of the Chroma Guard has a nice ring to it… for me, I mean. You can be my favorite agent.')];
  return [T(TINT_IDLE[i % TINT_IDLE.length])];
}

export const ENDING = [
  V('Look at that. <b>Look at it</b>, rookie. The hideout\'s glowing. The plaza must be lit up like a festival.'),
  T('Every core home. And Grisaille? Last I saw, he was staring at a pink puddle like it was the first sunrise of his life.'),
  DB('I\'m still pink! Everybody\'s pink! Well, not everybody. But some! And that\'s a START!'),
  V('The Chroma Guard owes you one. …Fine. <b>Fifteen</b>.'),
  V('Come back anytime. The Underside could use a splash now and then. And keep an eye out for those Lost Swatches.'),
];

export const LEVEL_RADIO = {
  l1: [VR('Radio check. This is the old mixing floor. Perfect place to learn the ropes.'), VR('Paint the floor, then hold <b>SHIFT</b> to swim through it. Fast, quiet, and it refills your tank.')],
  l2: [VR('The Ghost Walk. These catwalks are coated in invisible primer.'), VR('<b>Shoot ink ahead</b> of you to see where it\'s safe to step. Watch for the sparkles.')],
  l3: [VR('Blotters ahead. Stationary turrets with nasty aim.'), VR('Use cover, take the side catwalks to <b>flank</b> \'em, or swim in your ink so their shots sail overhead.')],
  l4: [VR('Drone Heights: the old pigment silo. It\'s a long way up.'), VR('Drones drop gray bombs. When you see a <b>warning ring</b> under you, move!')],
  l5: [VR('This is it, rookie. The Gray Engine is through that doorway.'), VR('Grab anything useful before you go in. Once that door shuts, it stays shut.')],
  l6: [VR('The Sponge Sluice. The old crew used giant sponges to mop the vats.'), VR('Those yellow blocks soak up ink and <b>swell up</b>. Paint one and it becomes a step.')],
  l7: [VR('Rising Tide. The Drab opened the floodgates. The gray will climb as you do.'), VR('Find the <b>drains</b>: panels with a grille. Paint them and the goo goes down.')],
  l8: [VR('The Bottling Line. Conveyor belts, ink rails, and a lot of noise.'), VR('Jump up to an <b>ink rail</b> and it whisks you along. Belts push you, so lean into them.')],
  l9: [VR('Pump Station. Somewhere in here is the pump the Drab use to fill their tanks.'), VR('If we get it pumping <b>our</b> way, the core chamber unseals. They won\'t like that.')],
  l10: [VR('The main reservoir. Something huge just moved under the surface.'), VR('Tint\'s signal is coming from right above it. Careful, rookie.')],
  l11: [TR('Lights Out. Grisaille cut the power on this whole floor.'), TR('Your ink <b>glows</b>. Paint as you go and you\'ll light your own way. Paint under the old <b>lanterns</b> to light them up.')],
  l12: [TR('The Crumbling Gallery. Grisaille\'s collection of gray paintings. All of them gray. Every single one.'), TR('The floor is rotten. <b>Cracked tiles crumble</b> a moment after you land, so keep moving. Fans will lift you over the gaps.')],
  l13: [TR('Chroma Locks. The Baron\'s vault floor. Lots of locks, lots of timers.'), TR('Shimmering <b>membranes</b> block the halls. Dive into your ink and swim straight through.')],
  l14: [TR('The Grand Ascent. The tower up to the throne room.'), TR('Everything you\'ve learned, all at once. And the gray is going to <b>chase you up</b>.')],
  l15: [TR('The throne room is just ahead. Grisaille is in there. I can hear him… humming?'), VR('Whatever you need, rookie. We\'re right here with you.')],
};

export const BOSS_INTRO = [
  B('Ah. A splash of <b>noise</b> in my beautiful, quiet works.'),
  B('Color is CHAOS, child. Gray is order. Gray is calm. Gray is… <b>everything</b>.'),
  B('My Engine will drink every last hue from that garish plaza. Do try not to stain the floor.'),
  VR('Four <b>pressure valves</b> on the base! Paint the shutters to crack them open, then burst the valves!'),
];

export const WYRM_INTRO = [
  B('Oh, it\'s <b>you</b>. The little stain that broke my Engine.'),
  B('Allow me to introduce my darling <b>Grimewyrm</b>. It has been SO hungry. And look: I brought it a snack.'),
  { who: 'tint', text: 'Rookie! Up here! Don\'t worry about me, just hit that thing in the <b>eyes</b>!' },
  B('Feed well, my pet. I shall be upstairs, sipping something beige.'),
  VR('That\'s Tint! She\'s caged above the pool. Hit the glowing <b>eye</b> when it surfaces, and stay off the gray!'),
];

export const BARON_INTRO = [
  B('So. The rookie who would not stay gray.'),
  B('Do you know what color <b>is</b>, child? It\'s noise. It\'s screaming. Every hue shouting over every other hue.'),
  B('I had color once. I mixed the reds of this city with my own two hands. And then… silence. Gray. And it was <b>peaceful</b>.'),
  B('I will not give that peace back. Come, then. Let us settle this, colorist to colorist.'),
  TR('He\'s shielded! Paint the three <b>easels</b> around the room to break the shield, then hit him hard!'),
];

export const LOCKED = 'Sealed tight. Recover the previous Hue Core first.';
export function gateLocked(n) {
  return n === 2 ? 'The reservoir gate is sealed. Defeat the <b>Gray Engine</b> first (hatch 5).' : 'The manor gate is sealed. Clear <b>Sector 2</b> first.';
}

// mid-level radio chatter (used by the level builders via course.say)
export const SAY = {
  l1_switch: [VR('See that panel with the glowing frame? That\'s a <b>paint switch</b>. Cover it in ink and the door opens.')],
  l1_arena: [VR('Smudges! Little biters. Paint around you, keep moving, and splash \'em!')],
  l1_special: [VR('Your <b>special meter</b> fills while you paint. When it\'s ready, hit <b>Q</b>. Go on, show off.')],
  l2_mover: [VR('That catwalk is <b>moving</b>. Paint it, hop on and ride it across. It carries you.')],
  l2_maze: [VR('Branching paths. The old crew loved hiding things down the dead ends.')],
  l3_switch: [VR('The gate\'s locked from this side. Two <b>switches</b> on the walls, and they\'re covered by turrets. Have fun!')],
  l3_alley: [VR('The back alley\'s crawling with Blotters. Swim low and they\'ll shoot right over you.')],
  l4_lift: [VR('Old silo lift. Step on and it\'ll carry you up. Mind the drones on the way.')],
  l4_nest: [VR('That\'s a drone nest up ahead. Clear it out and the way to the top opens.')],
  l6_gooper: [VR('Watch the puddles! Something\'s <b>hiding in that goo</b>. Paint over its puddle to flush it out.')],
  l6_tall: [VR('Big sponge. Paint it all over and it\'ll make a whole staircase.')],
  l7_rise: [VR('Here comes the tide! <b>Paint the drains</b> and keep climbing!')],
  l7_split: [VR('Splotches split when you splash \'em. Little ones are fast. Keep your distance.')],
  l8_rail: [VR('That glowing line is an <b>ink rail</b>. Jump up to it and hold on. Press <b>SPACE</b> to let go.')],
  l8_rumbler: [VR('Rumbler! When it revs up, get out of its line. If it hits a wall, it\'s dizzy. Then let it have it.')],
  l9_pilfer: [VR('Little sneak with a sack? That\'s a <b>Pilfer</b>. It steals ink. Splash it before it gets close!')],
  l9_distress: [{ who: 'static', radio: true, text: '…anyone… this is Agent Tint… they\'re feeding me to the… <b>wyrm</b>… …reservoir…' }, VR('Tint! She\'s alive! Hang on, partner. We\'re coming.')],
  l9_pump: [VR('There\'s the pump. Step onto the platform to start it, then keep the Drab off it until the tank fills.')],
  l11_glint: [TR('Red laser! That\'s a <b>Glint</b>. When the beam flashes red, dive or duck. Then rush it while it reloads.')],
  l11_baron: [{ who: 'pa', radio: true, text: '<i>Attention, intruder. The manor is closed to visitors. And to color. Please wipe your feet.</i>' }],
  l12_warden: [TR('A <b>Warden</b>. That shield stops everything from the front. Circle around, or bomb it.')],
  l12_fans: [TR('Updrafts from the old heating vents. Jump in and ride them over the gaps.')],
  l12_story: [TR('These portraits… they used to be colorful. You can see brush strokes under the gray. He painted over his own work.')],
  l13_membrane: [TR('Membrane ahead. <b>Dive</b> and swim through. It only lets your ink pass.')],
  l13_timer: [TR('Timed lock. Once you hit that switch, the door stays open for a few seconds only. Map the route first.')],
  l13_spin: [TR('Rotating platforms! Time your jumps.')],
  l14_flood: [TR('The gray is pouring in from below! Go up, go up, <b>GO UP</b>!')],
  l14_top: [{ who: 'pa', radio: true, text: '<i>The Baron will see you now. Reluctantly.</i>' }, TR('That\'s the throne room door. Get the core, then it\'s just you and him.')],
};
