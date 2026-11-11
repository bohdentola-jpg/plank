// Consumables, clubhouse decor, diner meals and fish.
export const ITEMS = {
  orange: { name: 'Orange Slices', icon: '🍊', desc: 'Restores 40 stamina to one teammate.', heal: 40, price: 8 },
  drink: { name: 'Sports Drink', icon: '🧃', desc: 'Restores 25 stamina to the whole squad.', healAll: 25, price: 18 },
  cocoa: { name: 'Thermos of Cocoa', icon: '☕', desc: 'Fully restores one teammate.', heal: 999, price: 30 },
  salts: { name: 'Smelling Salts', icon: '🧂', desc: 'Clears every status effect on the squad.', cure: true, price: 12 },
  gum: { name: 'Sticky Gum', icon: '🍬', desc: 'Wider catch windows for the rest of this drive.', buff: 'sticky', price: 20 },
  cider: { name: 'Hot Cider', icon: '🍎', desc: 'The whole squad starts the next play Hyped.', buff: 'hype', price: 22 },
};

export const DECOR = {
  rug_team: { name: 'Team Rug', icon: '🟠', prop: 'rug', opts: { color: 0xf08a24, color2: 0xffd45a }, price: 30, flat: true },
  rug_blue: { name: 'Pond-Blue Rug', icon: '🔵', prop: 'rug', opts: { color: 0x2a6f77, color2: 0x58b8c9 }, price: 30, flat: true },
  beanbag: { name: 'Beanbag', icon: '🫘', prop: 'beanbag', opts: {}, price: 40 },
  beanbag_red: { name: 'Maple Beanbag', icon: '🍁', prop: 'beanbag', opts: { color: 0xd4502f }, price: 40 },
  plant: { name: 'Potted Fern', icon: '🪴', prop: 'plant', opts: {}, price: 25 },
  shelf: { name: 'Bookshelf', icon: '📚', prop: 'shelf', opts: {}, price: 60 },
  jukebox: { name: 'Jukebox', icon: '🎵', prop: 'jukebox', opts: {}, price: 120 },
  cabinet: { name: 'Arcade Cabinet', icon: '🕹️', prop: 'arcadeCabinet', opts: {}, price: 150 },
  trophy_borough: { name: 'Borough Pennant Trophy', icon: '🏆', prop: 'trophy', opts: {} },
  trophy_fair: { name: 'Blue-Ribbon Trophy', icon: '🏆', prop: 'trophy', opts: { color: 0x58b8c9 } },
  trophy_frost: { name: 'Icicle Trophy', icon: '🏆', prop: 'trophy', opts: { color: 0xbfe6f5 } },
  trophy_neon: { name: 'Neon Trophy', icon: '🏆', prop: 'trophy', opts: { color: 0xff5ad0 } },
  trophy_bowl: { name: 'The Midnight Bowl', icon: '🌙', prop: 'trophy', opts: { color: 0xcfd8ff } },
  trophy_cup: { name: 'The Hollow Cup', icon: '🕹️', prop: 'trophy', opts: { color: 0xb07aff } },
  pumpkin: { name: 'Prize Pumpkin', icon: '🎃', prop: 'pumpkin', opts: { s: 1.4 }, price: 20 },
  dummy: { name: 'Tackling Dummy', icon: '🥊', prop: 'tackleDummy', opts: {}, price: 70 },
  gnome: { name: 'Captured Garden Gnome', icon: '🧙', prop: 'gnomeStatue', opts: {} },
  cooler: { name: 'Water Cooler', icon: '🚰', prop: 'waterCooler', opts: {}, price: 55 },
  table: { name: 'Round Table', icon: '🪑', prop: 'table', opts: {}, price: 45 },
};

// Diner meals: one active at a time, lasts until your next rival match ends.
export const MEALS = {
  pancakes: { name: 'Pancake Stack', icon: '🥞', desc: '+2 Strength for the whole team.', stat: 'str', amt: 2, price: 25 },
  carrot_cake: { name: 'Carrot Cake', icon: '🥕', desc: '+1 Speed for the whole team.', stat: 'spd', amt: 1, price: 25 },
  grilled_cheese: { name: 'Grilled Cheese', icon: '🧀', desc: '+2 Hands for the whole team.', stat: 'hnd', amt: 2, price: 25 },
  moonpie: { name: 'Moon Pie', icon: '🌙', desc: '+20 max Stamina for the whole team.', stat: 'sta', amt: 20, price: 30, recipe: true },
  chili: { name: 'Halftime Chili', icon: '🌶️', desc: '+2 Arm for the whole team.', stat: 'arm', amt: 2, price: 30, recipe: true },
  cocoa_float: { name: 'Cocoa Float', icon: '🍨', desc: '+2 Agility for the whole team.', stat: 'agi', amt: 2, price: 30, recipe: true },
};

export const FISH = {
  bluegill: { name: 'Bluegill', icon: '🐟', value: 6, w: 40, size: [10, 22], diff: 1 },
  perch: { name: 'Pumpkinseed Perch', icon: '🐠', value: 9, w: 28, size: [12, 26], diff: 1.3 },
  catfish: { name: 'Whisker Catfish', icon: '🐡', value: 16, w: 14, size: [30, 70], diff: 1.8 },
  boot: { name: 'Old Cleat', icon: '👢', value: 2, w: 12, size: [28, 30], diff: 0.7 },
  mouthguard: { name: 'Lost Mouthguard', icon: '🦷', value: 4, w: 8, size: [6, 7], diff: 0.8 },
  koi: { name: 'Lantern Koi', icon: '🎏', value: 30, w: 6, size: [40, 80], diff: 2.3, night: true },
  whistle_fish: { name: 'Whistle Trout', icon: '🎣', value: 22, w: 8, size: [25, 50], diff: 2 },
  ghost_carp: { name: 'Ghost Carp', icon: '👻', value: 45, w: 3, size: [50, 90], diff: 2.8, night: true },
};
