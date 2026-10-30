// Every item in DRIP LINE is wearable and paid for in tokens. Edit freely:
// names, prices, rarity, which car sells it, and the `art` spec (drawing type
// + colors; see src/art/figure.js for the types and options).
//
// Where an item can come from:
//   shop      car whose daily rotation can stock it
//   capsule   false keeps it out of the capsule machines (default true for shop items)
//   vault / ghost   sold only in that secret room
//   milestone streak day that awards it      secret  achievement that awards it

export const RARITIES = {
  common: { name: 'COMMON', color: '#cfc8b8', rank: 0, points: 1, scrap: 40 },
  uncommon: { name: 'UNCOMMON', color: '#6dff9a', rank: 1, points: 2, scrap: 100 },
  rare: { name: 'RARE', color: '#5aa0ff', rank: 2, points: 4, scrap: 250 },
  epic: { name: 'EPIC', color: '#b48cff', rank: 3, points: 8, scrap: 700 },
  legendary: { name: 'LEGENDARY', color: '#ffc93d', rank: 4, points: 16, scrap: 2000 },
  mythic: { name: 'MYTHIC', color: '#ff4f9a', rank: 5, points: 40, scrap: 6000 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const SLOTS = ['head', 'face', 'neck', 'top', 'bottom', 'feet', 'hand', 'aura'];
export const SLOT_NAMES = { head: 'HEAD', face: 'FACE', neck: 'NECK', top: 'TOP', bottom: 'BOTTOM', feet: 'FEET', hand: 'HAND', aura: 'AURA' };

// The shop cars. `slots` = what the car sells.
export const SHOPS = {
  threads: {
    name: 'THREADS', keeper: 'drippy', keeperName: 'DRIPPY', color: '#ff4f9a', slots: ['top', 'bottom'],
    hello: ['Oh! A fresh canvas walked in!', 'Mind the drips, they’re load-bearing.', 'Everything here is hand-splashed. Mostly by accident.'],
    browse: 'Today’s rack is wet and ready. Try anything on.',
    bye: ['Stay splashy!', 'Go drip somewhere.', 'Come back when the paint dries. It won’t.'],
  },
  kicks: {
    name: 'KICKS & DECKS', keeper: 'lace', keeperName: 'LACE', color: '#ff8a3d', slots: ['feet', 'hand'],
    hello: ['Yo. Laces up, eyes up.', 'Fresh pairs every morning. I sleep in a shoebox.', 'You walk like you need new soles.'],
    browse: 'Wall of heat, right there. Pick a pair.',
    bye: ['Step light.', 'Don’t crease ’em. Okay, crease ’em a little.', 'Laters.'],
  },
  lids: {
    name: 'LIDS', keeper: 'cone', keeperName: 'CONE', color: '#ffd23f', slots: ['head', 'face'],
    hello: ['Caution: fresh headwear ahead.', 'I’m basically a hat already. Let me help you.', 'Detour! Right this way to the lids.'],
    browse: 'Hats up top, shades on the rack. Proceed with style.',
    bye: ['Drive safe. You’re on a train, but still.', 'Watch your head.', 'Cone out.'],
  },
  ice: {
    name: 'ICE', keeper: 'mira', keeperName: 'MIRA', color: '#5af0dc', slots: ['neck', 'face', 'hand'],
    hello: ['Darling, you’re glowing. Let’s make it shine.', 'Every piece reflects you. Literally. I’m a mirror.', 'Welcome to the cold case. The ice is very real. Ish.'],
    browse: 'Chains, grills, bags. Touch the glass, I dare you.',
    bye: ['Sparkle on.', 'Ciao, shiny.', 'Catch the light, darling.'],
  },
  ghost: {
    name: 'THE GHOST CAR', keeper: 'static', keeperName: 'STATIC', color: '#9ad8c8', slots: [], secret: true,
    hello: ['...kkzzt... a living passenger... how novel...', 'This car was retired in 1931. I was not.', 'Mind the gap. It is rather wider for me.'],
    browse: 'Left behind on the last run. Their owners shan’t need them.',
    bye: ['...kzzt... all aboard who’s going aboard...', 'The ghost car waits for no one.', 'Do mind the gap.'],
  },
  vault: {
    name: 'THE VAULT', keeper: 'plug', keeperName: 'PLUG', color: '#ff4f9a', slots: [], secret: true,
    hello: ['You found the vault. I’m impressed. And slightly nervous.', 'Nobody gets back here without the word. You’re somebody.'],
    browse: 'One of everything, nothing for cheap. Save up.',
    bye: ['You were never here.', 'Keep the word to yourself.'],
  },
};

const I = (id, slot, name, rarity, price, art, desc, o = {}) => ({
  id, slot, name, rarity, price, art, desc,
  shop: o.shop || null,
  capsule: o.capsule ?? !!o.shop,
  vault: !!o.vault, ghost: !!o.ghost,
  milestone: o.milestone || null, secret: o.secret || null,
  starter: !!o.starter,
  seed: o.seed || ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 997),
});

export const ITEMS = [
  // ---------------------------------------------------------------- THREADS (tops + bottoms)
  I('t-blank', 'top', 'Blank Canvas Tee', 'common', 150, { type: 'tee', c: '#f4efe6', a: '#140f26' },
    'A white tee. A blank canvas. I’m already itching to splash it.', { shop: 'threads', starter: true }),
  I('t-drip', 'top', 'Drip Tee', 'common', 220, { type: 'tee', c: '#1d1830', a: '#ff4f9a', g: 'drop' },
    'One drop on the chest. The original. The classic. The drip.', { shop: 'threads' }),
  I('t-stripe', 'top', 'Line 9 Stripe Tee', 'common', 240, { type: 'tee', c: '#f4efe6', a: '#3ec7b0', p: 'stripes', p2: '#3ec7b0' },
    'Stripes like the safety line on a platform. Stand behind them. Or in them.', { shop: 'threads' }),
  I('t-splat', 'top', 'Splatter Tee', 'uncommon', 450, { type: 'tee', c: '#ffd23f', a: '#140f26', p: 'splatter', p2: '#ff4f9a' },
    'I sneezed while holding a pink can. You’re welcome.', { shop: 'threads' }),
  I('t-dye', 'top', 'Tunnel Dye Tee', 'uncommon', 520, { type: 'tee', c: '#7ed957', a: '#140f26', p: 'tiedye', p2: '#3ec7b0' },
    'Dyed in a bucket I swear was clean. Every swirl is one of a kind.', { shop: 'threads' }),
  I('t-night', 'top', 'Night Shift Hoodie', 'uncommon', 600, { type: 'hoodie', c: '#1d1830', a: '#ffd23f', g: 'bolt' },
    'Heavy fleece for the 3 a.m. loop. The bolt glows when the lights flicker.', { shop: 'threads' }),
  I('t-gum', 'top', 'Bubblegum Hoodie', 'uncommon', 650, { type: 'hoodie', c: '#ff8fc0', a: '#fffaf0', g: 'heart' },
    'Soft, pink, and a little bit sticky. Like the seats.', { shop: 'threads' }),
  I('t-track', 'top', 'Express Track Jacket', 'rare', 1100, { type: 'jacket', c: '#d4473f', a: '#f4efe6' },
    'Red with white rails down the arms. Skips every local stop.', { shop: 'threads' }),
  I('t-wind', 'top', 'Third Rail Windbreaker', 'rare', 1250, { type: 'windbreaker', c: '#3ec7b0', c2: '#7b5cff' },
    'Swishy, two-tone, built for the tunnel draft and a dramatic exit.', { shop: 'threads' }),
  I('t-camo', 'top', 'Concrete Camo Hoodie', 'rare', 1400, { type: 'hoodie', c: '#8a8a9a', a: '#140f26', p: 'camo', p2: '#5a5a6e' },
    'Lean on any wall down here and you vanish. Great for awkward conversations.', { shop: 'threads' }),
  I('t-jersey', 'top', 'Last Stop Jersey', 'rare', 1500, { type: 'jersey', c: '#2b6cff', a: '#ffd23f', num: '00' },
    'Number double zero, for the stop at the end of the line.', { shop: 'threads' }),
  I('t-puffer', 'top', 'Big Puff Puffer', 'epic', 2800, { type: 'puffer', c: '#ff8a3d', a: '#140f26' },
    'So puffy you can sleep standing up. I have. Twice.', { shop: 'threads' }),
  I('t-flame', 'top', 'Hot Rail Hoodie', 'epic', 3400, { type: 'hoodie', c: '#140f26', a: '#ff8a3d', p: 'flames', p2: '#ff8a3d' },
    'Flames licking up from the hem. Do not stand near the third rail in this.', { shop: 'threads' }),
  I('t-galaxy', 'top', 'Deep Tunnel Hoodie', 'legendary', 9000, { type: 'hoodie', c: '#1d1438', a: '#b48cff', p: 'galaxy', p2: '#b48cff' },
    'Painted from memory of the one time I saw the stars. Took nine tries.', { shop: 'threads' }),
  I('t-gold', 'top', 'Solid Gold Puffer', 'legendary', 12000, { type: 'puffer', c: '#ffd23f', a: '#c8901a', finish: 'gold' },
    'Not actually solid gold. Actually solid gold paint. Heavier than it looks.', { shop: 'threads' }),
  I('b-jeans', 'bottom', 'Raw Denim', 'common', 180, { type: 'jeans', c: '#3e6fd8', a: '#ffd23f' },
    'Stiff now, perfect in a month. Like most relationships.', { shop: 'threads', starter: true }),
  I('b-cargo', 'bottom', 'Service Delay Cargos', 'common', 260, { type: 'cargos', c: '#6b7a4a' },
    'Eight pockets, one for every minute you’ve waited on a platform.', { shop: 'threads' }),
  I('b-shorts', 'bottom', 'Heat Wave Shorts', 'common', 200, { type: 'shorts', c: '#ff4f9a', a: '#fffaf0' },
    'For when the car’s AC is “being looked at.”', { shop: 'threads' }),
  I('b-track', 'bottom', 'Platform Track Pants', 'uncommon', 480, { type: 'trackpants', c: '#1d1830', a: '#f4efe6' },
    'Snap buttons all the way down for emergency exits.', { shop: 'threads' }),
  I('b-check', 'bottom', 'Checkerboard Shorts', 'uncommon', 560, { type: 'shorts', c: '#140f26', a: '#f4efe6', p: 'check', p2: '#f4efe6' },
    'Black, white, and pure skate park energy.', { shop: 'threads' }),
  I('b-paint', 'bottom', 'Paint Day Jeans', 'rare', 1200, { type: 'jeans', c: '#3e6fd8', a: '#ffd23f', p: 'splatter', p2: '#ff4f9a' },
    'Worn during the great Car 2 paint flood. Those stains are history.', { shop: 'threads' }),
  I('b-nightcamo', 'bottom', 'Night Camo Cargos', 'rare', 1300, { type: 'cargos', c: '#2a2238', p: 'camo', p2: '#4a4560' },
    'Camo for the dark car with the broken lights.', { shop: 'threads' }),
  I('b-burn', 'bottom', 'Burnout Track Pants', 'epic', 3000, { type: 'trackpants', c: '#140f26', a: '#ff8a3d', p: 'flames', p2: '#ff4f9a' },
    'Fast pants. You can hear them coming.', { shop: 'threads' }),
  I('b-chrome', 'bottom', 'Chrome Cargos', 'legendary', 8500, { type: 'cargos', c: '#c8c8e0', finish: 'chrome' },
    'You can check your hair in them. Your pockets reflect your future.', { shop: 'threads' }),

  // ---------------------------------------------------------------- KICKS & DECKS (feet + decks)
  I('f-whites', 'feet', 'Fresh Whites', 'common', 200, { type: 'low', c: '#f4efe6', a: '#f4efe6', s: '#f4efe6' },
    'Clean whites. Stay away from puddles. There are only puddles.', { shop: 'kicks', starter: true }),
  I('f-canvas', 'feet', 'Canvas Highs', 'common', 260, { type: 'high', c: '#d4473f', a: '#f4efe6', s: '#f4efe6' },
    'Red canvas high-tops. Classic for a reason. The reason is they’re red.', { shop: 'kicks' }),
  I('f-slides', 'feet', 'Pool Slides', 'common', 150, { type: 'slides', c: '#3ec7b0' },
    'Socks optional. Confidence mandatory.', { shop: 'kicks' }),
  I('f-rail', 'feet', 'Rail Runner Lows', 'uncommon', 520, { type: 'low', c: '#f4efe6', a: '#d4473f', s: '#f4efe6' },
    'Clean whites with a red bolt. Cushioned for long transfers.', { shop: 'kicks' }),
  I('f-tunnel', 'feet', 'Tunnel Vision Highs', 'uncommon', 640, { type: 'high', c: '#1d1830', a: '#7b5cff', s: '#f4efe6' },
    'So dark you only see them under the flicker lights.', { shop: 'kicks' }),
  I('f-boots', 'feet', 'Work Order Boots', 'uncommon', 700, { type: 'boots', c: '#a0623a', a: '#ffd23f' },
    'Steel toe, yellow laces, absolutely no plans to work.', { shop: 'kicks' }),
  I('f-puddle', 'feet', 'Puddle Jumpers', 'rare', 1100, { type: 'high', c: '#ffd23f', a: '#1d1830', s: '#3a3456' },
    'Waterproof yellow highs for the one leak in Car 4 that never dries.', { shop: 'kicks' }),
  I('f-checker', 'feet', 'Checker Skates', 'rare', 1300, { type: 'low', c: '#140f26', a: '#f4efe6', s: '#f4efe6', p: 'check', p2: '#f4efe6' },
    'Board-tested in the aisle at 3 a.m. The conductor did not approve.', { shop: 'kicks' }),
  I('f-concrete', 'feet', 'Concrete Boots', 'rare', 1500, { type: 'boots', c: '#8a8a9a', a: '#140f26', p: 'camo', p2: '#5a5a6e' },
    'Heavy. Grey. Indestructible. Like the station walls.', { shop: 'kicks' }),
  I('f-hotfoot', 'feet', 'Hot Foot Highs', 'epic', 3200, { type: 'high', c: '#140f26', a: '#ff8a3d', s: '#ffd23f', p: 'flames', p2: '#ff4f9a' },
    'Flames up the sides. Not recommended near spilled soda. Or anything.', { shop: 'kicks' }),
  I('f-glow', 'feet', 'Glow Lows', 'epic', 3800, { type: 'low', c: '#c8ff6a', a: '#140f26', s: '#c8ff6a', finish: 'glow' },
    'They glow in the tunnel. Every rider will know exactly where you are.', { shop: 'kicks' }),
  I('f-gold', 'feet', 'Solid Gold Highs', 'legendary', 11000, { type: 'high', c: '#ffd23f', a: '#c8901a', s: '#fffaf0', finish: 'gold' },
    'Gold uppers, pearl soles. I keep these in a box inside a box.', { shop: 'kicks' }),
  I('h-deck', 'hand', 'Blank Deck', 'common', 280, { type: 'deck', c: '#c89a62', a: '#140f26' },
    'Plain maple. Write your own story on the bottom.', { shop: 'kicks' }),
  I('h-dripdeck', 'hand', 'Drip Deck', 'uncommon', 620, { type: 'deck', c: '#ff4f9a', a: '#ffd23f', g: 'drop' },
    'Pink deck, one big drop. Rolls fast down an empty car.', { shop: 'kicks' }),
  I('h-flamedeck', 'hand', 'Flame Deck', 'rare', 1400, { type: 'deck', c: '#140f26', a: '#ff8a3d', g: 'flame' },
    'Grip tape on top, inferno on the bottom.', { shop: 'kicks' }),
  I('h-cosmos', 'hand', 'Cosmic Deck', 'epic', 3600, { type: 'deck', c: '#1d1438', a: '#b48cff', g: 'star', p: 'galaxy', p2: '#b48cff' },
    'Painted like the night sky we never see down here.', { shop: 'kicks' }),

  // ---------------------------------------------------------------- LIDS (head + face)
  I('hd-beanie', 'head', 'Platform Beanie', 'common', 180, { type: 'beanie', c: '#ff8a3d', a: '#d4473f' },
    'Thick knit. Keeps the tunnel wind off your thoughts.', { shop: 'lids' }),
  I('hd-cap', 'head', 'Daily Cap', 'common', 200, { type: 'cap', c: '#2a2238', a: '#3ec7b0' },
    'For every day. Hence the name. I’m a cone, not a poet.', { shop: 'lids' }),
  I('hd-bucket', 'head', 'Night Bus Bucket', 'uncommon', 480, { type: 'bucket', c: '#f4efe6', a: '#140f26', p: 'check', p2: '#140f26' },
    'Checkerboard bucket for when the train stops and you take the night bus.', { shop: 'lids' }),
  I('hd-dripcap', 'head', 'Drip Snapback', 'uncommon', 520, { type: 'cap', c: '#ffd23f', a: '#140f26', g: 'drop' },
    'Yellow snapback, one drop on the front. Adjustable for big heads.', { shop: 'lids' }),
  I('hd-durag', 'head', 'Silk Durag', 'uncommon', 560, { type: 'durag', c: '#7b5cff', a: '#b48cff' },
    'Violet silk. Waves protected. Tails flowing in the tunnel breeze.', { shop: 'lids' }),
  I('hd-phones', 'head', 'Echo Cans', 'rare', 1200, { type: 'headphones', c: '#3ec7b0', a: '#140f26' },
    'Block out a passing express. And small talk.', { shop: 'lids' }),
  I('hd-fedora', 'head', 'Conductor’s Fedora', 'rare', 1350, { type: 'fedora', c: '#2a2238', a: '#d4473f' },
    'A conductor left it on a seat in 1998. I’ve been waiting for the right head.', { shop: 'lids' }),
  I('hd-camobucket', 'head', 'Camo Bucket', 'rare', 1100, { type: 'bucket', c: '#6b7a4a', a: '#2a2238', p: 'camo', p2: '#4a5a3a' },
    'Blend into a jungle. There are no jungles. Blend anyway.', { shop: 'lids' }),
  I('hd-flamecap', 'head', 'Hot Rail Cap', 'epic', 2900, { type: 'cap', c: '#140f26', a: '#ff8a3d', p: 'flames', p2: '#ff8a3d' },
    'Flames on the crown, cool head underneath.', { shop: 'lids' }),
  I('hd-crown', 'head', 'Tunnel King Crown', 'legendary', 14000, { type: 'crown', c: '#ffd23f', a: '#ff4f9a' },
    'Every line has a king. Some days it’s whoever bought this.', { shop: 'lids' }),
  I('fc-round', 'face', 'Round Shades', 'common', 220, { type: 'shades', c: '#140f26', a: '#3ec7b0', style: 'round' },
    'Round lenses, teal tint. Makes the fluorescent lights look like a sunset.', { shop: 'lids' }),
  I('fc-bandana', 'face', 'Map Bandana', 'common', 240, { type: 'bandana', c: '#d4473f', a: '#f4efe6' },
    'The whole line printed on it. Never get lost. Unless you lose the bandana.', { shop: 'lids' }),
  I('fc-heart', 'face', 'Heart Shades', 'uncommon', 520, { type: 'shades', c: '#ff4f9a', a: '#ff8fc0', style: 'heart' },
    'Everything looks lovely. Even Car 4.', { shop: 'lids' }),
  I('fc-goggles', 'face', 'Track Goggles', 'rare', 1150, { type: 'goggles', c: '#ffd23f', a: '#5aa0ff' },
    'Blue lenses, yellow strap. Dust-proof for the deep tunnel.', { shop: 'lids' }),
  I('fc-shield', 'face', 'Shield Shades', 'rare', 1400, { type: 'shades', c: '#c8c8e0', a: '#7b5cff', style: 'shield' },
    'One wraparound lens. You look fast standing still.', { shop: 'lids' }),
  I('fc-visor', 'face', 'Cyber Visor', 'epic', 3300, { type: 'visor', c: '#140f26', a: '#5af0dc' },
    'Scans the car, finds nothing, looks incredible doing it.', { shop: 'lids' }),
  I('fc-star', 'face', 'Star Power Shades', 'legendary', 9500, { type: 'shades', c: '#ffd23f', a: '#ff4f9a', style: 'star', finish: 'gold' },
    'Gold star frames. People will ask for your autograph. Give it to them.', { shop: 'lids' }),

  // ---------------------------------------------------------------- ICE (neck + grills + bags)
  I('n-chain', 'neck', 'Token Chain', 'common', 250, { type: 'chain', c: '#ffd23f', g: 'token' },
    'A little token on a little chain. Every story starts somewhere, darling.', { shop: 'ice' }),
  I('n-scarf', 'neck', 'Tunnel Scarf', 'common', 220, { type: 'scarf', c: '#7b5cff', a: '#ffd23f', p: 'stripes', p2: '#ffd23f' },
    'Striped, cozy, extremely long. Mind it in the doors.', { shop: 'ice' }),
  I('n-heart', 'neck', 'Heart Pendant', 'uncommon', 540, { type: 'pendant', c: '#ff8fc0', g: 'heart' },
    'A pink heart that catches the light just so.', { shop: 'ice' }),
  I('n-silver', 'neck', 'Silver Line Chain', 'uncommon', 680, { type: 'chain', c: '#c8c8e0', g: 'train', finish: 'chrome' },
    'A tiny train on a silver chain. Always on time.', { shop: 'ice' }),
  I('h-bag', 'hand', 'Line Crossbody', 'uncommon', 600, { type: 'bag', c: '#1d1830', a: '#d4473f' },
    'Fits tokens, a phone and one secret. Two if they’re small.', { shop: 'ice' }),
  I('n-rope', 'neck', 'Gold Rope', 'rare', 1600, { type: 'rope', c: '#ffd23f', g: 'drop', finish: 'gold' },
    'Thick gold rope with a drop medallion. People step aside for this.', { shop: 'ice' }),
  I('fc-grill', 'face', 'Gold Grill', 'rare', 1500, { type: 'grill', c: '#ffd23f', a: '#fffaf0', finish: 'gold' },
    'Smile and the whole car lights up.', { shop: 'ice' }),
  I('h-sling', 'hand', 'Camo Sling Bag', 'rare', 1200, { type: 'bag', c: '#6b7a4a', a: '#2a2238', p: 'camo', p2: '#4a5a3a' },
    'Camo sling for carrying very important nothing.', { shop: 'ice' }),
  I('n-skull', 'neck', 'Skull Pendant', 'epic', 2600, { type: 'pendant', c: '#f4efe6', g: 'skull' },
    'A bone-white skull. Tough on the outside, glamorous on the inside.', { shop: 'ice' }),
  I('fc-icegrill', 'face', 'Iced-Out Grill', 'epic', 3900, { type: 'grill', c: '#c8f0ff', a: '#5af0dc', finish: 'chrome' },
    'Diamonds. Fine, crystals. Fine, very shiny plastic. Still blinding.', { shop: 'ice' }),
  I('n-chromerope', 'neck', 'Chrome Rope', 'legendary', 10000, { type: 'rope', c: '#c8c8e0', g: 'eightball', finish: 'chrome' },
    'Chrome links, eight-ball medallion. It knows things.', { shop: 'ice' }),
  I('n-crownchain', 'neck', 'Crown Chain', 'legendary', 13000, { type: 'chain', c: '#ffd23f', g: 'crown', finish: 'gold' },
    'A gold crown on a gold chain. Royalty of the 3 a.m. loop.', { shop: 'ice' }),

  // ---------------------------------------------------------------- capsule exclusives
  I('h-spray', 'hand', 'Spray Can', 'uncommon', null, { type: 'spraycan', c: '#7ed957' },
    'Green can, fat cap. Shakes like a maraca.', { capsule: true }),
  I('h-boombox', 'hand', 'Platform Boombox', 'rare', null, { type: 'boombox', c: '#d4473f', a: '#140f26' },
    'Tape deck, big bass, carried on the shoulder like it’s 1987.', { capsule: true }),
  I('a-sparkle', 'aura', 'Stardust Aura', 'legendary', null, { type: 'sparkle', c: '#fffaf0' },
    'Tiny stars follow you around. Nobody knows where they came from.', { capsule: true }),
  I('m-lightning', 'aura', 'Third Rail Aura', 'mythic', null, { type: 'lightning', c: '#bfe9ff' },
    'Crackling blue electricity, everywhere you go. Do not touch anyone.', { capsule: true }),
  I('m-inferno', 'aura', 'Inferno Aura', 'mythic', null, { type: 'flame', c: '#ff8a3d', a: '#ffd23f' },
    'You walk in, the temperature goes up four degrees.', { capsule: true }),
  I('m-prism', 'aura', 'Prism Aura', 'mythic', null, { type: 'rainbow' },
    'A rainbow halo that bends around you. Rarest light on the line.', { capsule: true }),
  I('m-goldbox', 'hand', 'Golden Boombox', 'mythic', null, { type: 'boombox', c: '#ffd23f', a: '#140f26', finish: 'gold' },
    'Solid gold speakers. Plays only bangers. Physically cannot play anything else.', { capsule: true }),
  I('m-infinite', 'hand', 'Infinite Can', 'mythic', null, { type: 'spraycan', c: '#ff4f9a', finish: 'holo' },
    'A spray can that never runs out. Every color at once.', { capsule: true }),

  // ---------------------------------------------------------------- the ghost car (Static)
  I('g-lantern', 'hand', 'Platform Lantern', 'rare', 1600, { type: 'lantern', c: '#bff8ec' },
    '...kzzt... for walking the tracks after the lights go out...', { ghost: true }),
  I('g-hoodie', 'top', 'Phantom Hoodie', 'epic', 3500, { type: 'hoodie', c: '#bff8ec', a: '#2a5a5e', g: 'ghost', finish: 'ghost' },
    'You can see right through it. Your friends will see right through you.', { ghost: true }),
  I('g-lows', 'feet', 'Phantom Lows', 'epic', 3800, { type: 'low', c: '#bff8ec', a: '#9ad8c8', s: '#f4efe6', finish: 'ghost' },
    'Left on the last run by a passenger who walked straight through the doors.', { ghost: true }),
  I('g-cap', 'head', 'Last Conductor’s Cap', 'legendary', 9000, { type: 'fedora', c: '#24506a', a: '#ffd23f', finish: 'ghost' },
    'It was mine. I insist you take it. ...kzzt... I insist.', { ghost: true }),
  I('g-glow', 'aura', 'Ghost Glow', 'legendary', 12000, { type: 'ghostglow', c: '#9affe0' },
    'A minty glow that hangs around you. Like me.', { ghost: true }),

  // ---------------------------------------------------------------- the vault (Plug)
  I('v-holopuff', 'top', 'Hologram Puffer', 'mythic', 50000, { type: 'puffer', c: '#e8e0ff', a: '#b48cff', finish: 'holo' },
    'Shifts color with every step. There’s maybe three of these in the world. This is one.', { vault: true }),
  I('v-infinity', 'neck', 'Infinity Rope', 'mythic', 45000, { type: 'rope', c: '#e8e0ff', g: 'star', finish: 'holo' },
    'A rope chain that loops forever. Like this train.', { vault: true }),
  I('v-chromecrown', 'head', 'Chrome Crown', 'mythic', 60000, { type: 'crown', c: '#c8c8e0', a: '#5af0dc', finish: 'chrome' },
    'Forget gold. Chrome is forever. And it reflects your enemies.', { vault: true }),
  I('v-rain', 'aura', 'Make It Rain', 'mythic', 80000, { type: 'moneyrain' },
    'Tokens fall around you wherever you stand. They’re not real. Don’t tell anyone.', { vault: true }),

  // ---------------------------------------------------------------- streak milestones
  I('ms-30', 'face', 'Rush Hour Visor', 'legendary', null, { type: 'visor', c: '#ffd23f', a: '#ff4f9a', finish: 'gold' },
    'Awarded for 30 days in a row on the Drip Line. You’re a regular now.', { milestone: 30 }),
  I('ms-100', 'head', 'Hundred Halo', 'mythic', null, { type: 'halo', c: '#ffe68a' },
    'One hundred days straight. The train itself crowns you.', { milestone: 100 }),
  I('ms-365', 'aura', 'Eternal Line', 'mythic', null, { type: 'lightning', c: '#ffd23f' },
    'A full year on the line. Golden current, forever.', { milestone: 365 }),

  // ---------------------------------------------------------------- achievements
  I('sx-goldcan', 'hand', 'Golden Can', 'legendary', null, { type: 'spraycan', c: '#ffd23f', finish: 'gold' },
    'Awarded for an S on the Tag Wall. A true writer.', { secret: 'tagS' }),
  I('sx-runner', 'feet', 'Tunnel Runner Highs', 'epic', null, { type: 'high', c: '#5af0dc', a: '#140f26', s: '#f4efe6', p: 'stripes', p2: '#140f26' },
    'Awarded for running 1,200m in Tunnel Run.', { secret: 'run1200' }),
  I('sx-eight', 'neck', 'Lucky Eight Pendant', 'epic', null, { type: 'pendant', c: '#140f26', g: 'eightball' },
    'Awarded for beating Eight’s shell game three times in one day.', { secret: 'shell3' }),
  I('sx-driver', 'head', 'Driver’s Cap', 'epic', null, { type: 'cap', c: '#24506a', a: '#ffd23f', g: 'train' },
    'Found in the lockbox in the driver’s cab. Nobody has driven this train in years.', { secret: 'cab' }),
];

export const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const STARTERS = ITEMS.filter((i) => i.starter).map((i) => i.id);

export function sourceOf(item) {
  if (item.vault) return 'The Vault';
  if (item.ghost) return 'The Ghost Car';
  if (item.milestone) return `${item.milestone}-day streak`;
  if (item.secret) return 'Secret achievement';
  if (item.shop) return SHOPS[item.shop].name + (item.capsule ? ' · capsules' : '');
  if (item.capsule) return 'Capsules only';
  return 'Unknown';
}
