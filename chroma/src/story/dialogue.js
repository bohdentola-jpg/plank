// Story text. Lines are { who, text, radio? }; text may contain <b>…</b>.
export const SPEAKERS = {
  veil: { name: 'Captain Veil', color: '#a46bff', badge: 'V', pitch: 0.8 },
  baron: { name: 'Baron Grisaille', color: '#b9b5c4', badge: 'G', pitch: 0.62 },
  unknown: { name: '???', color: '#a46bff', badge: '?', pitch: 0.8 },
};

export const INTRO = [
  { who: 'unknown', text: 'Psst. Over here, rookie. And mind the gray puddles. They <b>bite</b>.' },
  { who: 'veil', text: 'Name\'s Veil. <b>Captain Veil</b>, Chroma Guard. Retired. Well… un-retired, as of this morning.' },
  { who: 'veil', text: 'Noticed the plaza looking a little washed out lately? Faded awnings, beige fountain spray? That\'s no accident.' },
  { who: 'veil', text: 'You\'re standing in the <b>Underside</b>: the old paint works that gave this city its color. Something moved in down here. We call them the <b>Drab</b>.' },
  { who: 'veil', text: 'Gray goo with a grudge. They\'re draining the city\'s color into stolen <b>Hue Cores</b> and hauling them off to their boss, <b>Baron Grisaille</b>.' },
  { who: 'veil', text: 'Five cores, five sealed hatches. Bring the cores home and the color comes back. Lose them and… well. Hope you like beige.' },
  { who: 'veil', text: 'Your ink is the one thing the Drab can\'t stand. Paint, swim, climb. Splash anything gray that moves.' },
  { who: 'veil', text: 'Start with <b>hatch one</b>. I\'ll be on the radio. Oh, and keep your eyes peeled for <b>Lost Swatches</b>. The old crew hid one in every sector.' },
];

const IDLE = [
  ['Hatch one is open. The mixing floor is a good place to stretch your fins.', 'Swim in your own ink to refill. Old trick, still the best one.'],
  ['One core home already! Hatch two leads to the Ghost Walk. Shoot first, step second.', 'The old crew painted those catwalks with invisible primer. Ink makes them show.'],
  ['Turret Alley is next. Blotters can\'t turn fast. Flank \'em.', 'Their blobs fly high. Dive into your ink and let \'em sail over you.'],
  ['Drone Heights. Watch the floor for warning rings. Those drones drop like clockwork.', 'Climbing is quicker than you\'d think. Paint the wall, swim straight up.'],
  ['The Gray Engine is beyond hatch five. Grisaille himself is down there.', 'His sweep beam is nasty. Paint the floor first so you can swim under it.'],
  ['All five cores home. The plaza\'s never looked brighter, rookie.', 'Grisaille will be back. His kind always is. But so will we.'],
];

export function veilTalk(progress, i) {
  const set = IDLE[Math.min(progress, IDLE.length - 1)];
  return [{ who: 'veil', text: set[i % set.length] }];
}

export const ENDING = [
  { who: 'veil', text: 'All five cores. Look at that glow. You hear that? That\'s the plaza getting its color back.' },
  { who: 'veil', text: 'The Baron slithered off, but his Engine\'s in pieces. The Chroma Guard owes you one. …Fine. Two.' },
  { who: 'veil', text: 'Come back anytime. The Underside could use a splash now and then.' },
];

export const LEVEL_RADIO = {
  l1: [
    { who: 'veil', radio: true, text: 'Radio check. This is the old mixing floor. Perfect place to learn the ropes.' },
    { who: 'veil', radio: true, text: 'Paint the floor, then hold <b>SHIFT</b> to swim through it. Fast, quiet, and it refills your tank.' },
  ],
  l2: [
    { who: 'veil', radio: true, text: 'The Ghost Walk. These catwalks are coated in invisible primer.' },
    { who: 'veil', radio: true, text: '<b>Shoot ink ahead</b> of you to see where it\'s safe to step. Watch for the sparkles.' },
  ],
  l3: [
    { who: 'veil', radio: true, text: 'Blotters ahead. Stationary turrets with nasty aim.' },
    { who: 'veil', radio: true, text: 'Use cover, take the side catwalks to <b>flank</b> \'em, or swim in your ink so their shots sail overhead.' },
  ],
  l4: [
    { who: 'veil', radio: true, text: 'Drone Heights: the old pigment silo. It\'s a long way up.' },
    { who: 'veil', radio: true, text: 'Drones drop gray bombs. When you see a <b>warning ring</b> under you, move!' },
  ],
  l5: [
    { who: 'veil', radio: true, text: 'This is it, rookie. The Gray Engine is through that doorway.' },
    { who: 'veil', radio: true, text: 'Grab anything useful before you go in. Once that door shuts, it stays shut.' },
  ],
};

export const BOSS_INTRO = [
  { who: 'baron', text: 'Ah. A splash of <b>noise</b> in my beautiful, quiet works.' },
  { who: 'baron', text: 'Color is CHAOS, child. Gray is order. Gray is calm. Gray is… <b>everything</b>.' },
  { who: 'baron', text: 'My Engine will drink every last hue from that garish plaza. Do try not to stain the floor.' },
  { who: 'veil', radio: true, text: 'Four <b>pressure valves</b> on the base! Paint the shutters to crack them open, then burst the valves!' },
];

export const LOCKED = 'Sealed tight. Recover the previous Hue Core first.';
