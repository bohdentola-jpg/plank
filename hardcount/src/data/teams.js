// The league. Every team is plain data: identity, colours, helmet, home and
// away uniforms, logo, playstyle and home venue. Rosters are generated from
// the team (roster.js) so a team always fields the same players.
//
// SCHEMA (every field is used by the 3D kit, the menus or the sim):
// team = {
//   id: 'pht',                      // stable key (saves, records)
//   level: 'pro' | 'college' | 'hs',
//   city: 'Port Halcyon', name: 'Tide', abbr: 'PHT',
//   colors: { primary, secondary, accent, dark },   // '#rrggbb'
//   logo: { emblem, fg, bg, ring },  // logos.js draws it: emblem id + colours
//   helmet: {
//     shell, finish: 'gloss'|'matte'|'pearl'|'chrome',
//     stripe: 'none'|'single'|'double'|'triple'|'skunk'|'bolt'|'wings', stripeColors: [..],
//     facemask, logo: true (side decals), number: false (back of helmet number),
//   },
//   uniform: {
//     home: kit, away: kit,
//   },
//   kit = {
//     jersey, numbers, numberOutline (or null), numberFont: 'block'|'pro'|'college'|'italic'|'stencil',
//     sleeve: 'none'|'stripes2'|'stripes3'|'cuff'|'shoulder'|'bolt'|'yoke', sleeveColors: [..],
//     collar, sideColor (jersey side panel, null = none),
//     pants, pantStripe: 'none'|'single'|'double'|'triple'|'bolt', pantStripeColors: [..],
//     socks, sockStripes: [..] (colours of hoops near the top, may be empty),
//     shoes: 'black'|'white'|'team', gloves: '#rrggbb', nameOnBack: true,
//   },
//   style: { offense: 'spread'|'airraid'|'option'|'power'|'balanced', defense: 'blitz'|'zone'|'man'|'balanced', tempo: 0..1 },
//   strength: 0..1,                 // talent level (drives generated ratings)
//   venue: 'venueId',               // home stadium (gfx/stadium venues)
// }

export const TEAMS = [
  {
    id: 'pht', level: 'pro', city: 'Port Halcyon', name: 'Tide', abbr: 'PHT',
    colors: { primary: '#0d2a52', secondary: '#1fb5b0', accent: '#c9d2dc', dark: '#06142a' },
    logo: { emblem: 'wave', fg: '#1fb5b0', bg: '#0d2a52', ring: '#c9d2dc' },
    helmet: { shell: '#0d2a52', finish: 'pearl', stripe: 'double', stripeColors: ['#1fb5b0', '#c9d2dc'], facemask: '#c9d2dc', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#0d2a52', numbers: '#ffffff', numberOutline: '#1fb5b0', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#1fb5b0', '#ffffff'], collar: '#1fb5b0', sideColor: null,
        pants: '#c9d2dc', pantStripe: 'double', pantStripeColors: ['#0d2a52', '#1fb5b0'],
        socks: '#0d2a52', sockStripes: ['#1fb5b0'], shoes: 'black', gloves: '#0d2a52', nameOnBack: true,
      },
      away: {
        jersey: '#f4f6f8', numbers: '#0d2a52', numberOutline: '#1fb5b0', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#0d2a52', '#1fb5b0'], collar: '#0d2a52', sideColor: null,
        pants: '#0d2a52', pantStripe: 'double', pantStripeColors: ['#1fb5b0', '#c9d2dc'],
        socks: '#0d2a52', sockStripes: ['#1fb5b0'], shoes: 'black', gloves: '#1fb5b0', nameOnBack: true,
      },
    },
    style: { offense: 'spread', defense: 'zone', tempo: 0.6 },
    strength: 0.78,
    venue: 'bayside',
  },
  {
    id: 'det', level: 'pro', city: 'Detroit', name: 'Motormen', abbr: 'DET',
    colors: { primary: '#26282b', secondary: '#f26a1b', accent: '#ffffff', dark: '#111214' },
    logo: { emblem: 'gear', fg: '#f26a1b', bg: '#26282b', ring: '#ffffff' },
    helmet: { shell: '#26282b', finish: 'matte', stripe: 'triple', stripeColors: ['#f26a1b', '#ffffff', '#f26a1b'], facemask: '#f26a1b', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#f26a1b', numbers: '#26282b', numberOutline: '#ffffff', numberFont: 'block',
        sleeve: 'stripes3', sleeveColors: ['#26282b', '#ffffff', '#26282b'], collar: '#26282b', sideColor: null,
        pants: '#26282b', pantStripe: 'triple', pantStripeColors: ['#f26a1b', '#ffffff', '#f26a1b'],
        socks: '#26282b', sockStripes: ['#f26a1b', '#ffffff'], shoes: 'black', gloves: '#26282b', nameOnBack: true,
      },
      away: {
        jersey: '#ffffff', numbers: '#f26a1b', numberOutline: '#26282b', numberFont: 'block',
        sleeve: 'stripes3', sleeveColors: ['#26282b', '#f26a1b', '#26282b'], collar: '#f26a1b', sideColor: null,
        pants: '#26282b', pantStripe: 'triple', pantStripeColors: ['#f26a1b', '#ffffff', '#f26a1b'],
        socks: '#26282b', sockStripes: ['#f26a1b'], shoes: 'black', gloves: '#f26a1b', nameOnBack: true,
      },
    },
    style: { offense: 'power', defense: 'blitz', tempo: 0.35 },
    strength: 0.72,
    venue: 'foundry',
  },
  {
    id: 'hou', level: 'pro', city: 'Houston', name: 'Wildcatters', abbr: 'HOU',
    colors: { primary: '#6b1220', secondary: '#d4a43a', accent: '#f2ead8', dark: '#2a070c' },
    logo: { emblem: 'derrick', fg: '#d4a43a', bg: '#6b1220', ring: '#f2ead8' },
    helmet: { shell: '#d4a43a', finish: 'gloss', stripe: 'single', stripeColors: ['#6b1220'], facemask: '#6b1220', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#6b1220', numbers: '#f2ead8', numberOutline: '#d4a43a', numberFont: 'college',
        sleeve: 'cuff', sleeveColors: ['#d4a43a'], collar: '#d4a43a', sideColor: '#d4a43a',
        pants: '#d4a43a', pantStripe: 'single', pantStripeColors: ['#6b1220'],
        socks: '#6b1220', sockStripes: [], shoes: 'white', gloves: '#6b1220', nameOnBack: true,
      },
      away: {
        jersey: '#f2ead8', numbers: '#6b1220', numberOutline: '#d4a43a', numberFont: 'college',
        sleeve: 'cuff', sleeveColors: ['#6b1220'], collar: '#6b1220', sideColor: '#6b1220',
        pants: '#d4a43a', pantStripe: 'single', pantStripeColors: ['#6b1220'],
        socks: '#6b1220', sockStripes: [], shoes: 'white', gloves: '#d4a43a', nameOnBack: true,
      },
    },
    style: { offense: 'airraid', defense: 'man', tempo: 0.8 },
    strength: 0.7,
    venue: 'dome',
  },
  {
    id: 'slc', level: 'pro', city: 'Salt Lake', name: 'Summit', abbr: 'SLC',
    colors: { primary: '#bfe3f5', secondary: '#13294b', accent: '#ffffff', dark: '#0a1830' },
    logo: { emblem: 'mountain', fg: '#ffffff', bg: '#13294b', ring: '#bfe3f5' },
    helmet: { shell: '#ffffff', finish: 'gloss', stripe: 'wings', stripeColors: ['#13294b', '#bfe3f5'], facemask: '#13294b', logo: true, number: true },
    uniform: {
      home: {
        jersey: '#13294b', numbers: '#bfe3f5', numberOutline: '#ffffff', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#bfe3f5', '#ffffff'], collar: '#bfe3f5', sideColor: '#bfe3f5',
        pants: '#ffffff', pantStripe: 'double', pantStripeColors: ['#13294b', '#bfe3f5'],
        socks: '#13294b', sockStripes: ['#bfe3f5', '#ffffff'], shoes: 'black', gloves: '#13294b', nameOnBack: true,
      },
      away: {
        jersey: '#ffffff', numbers: '#13294b', numberOutline: '#bfe3f5', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#13294b', '#bfe3f5'], collar: '#13294b', sideColor: '#13294b',
        pants: '#13294b', pantStripe: 'double', pantStripeColors: ['#bfe3f5', '#ffffff'],
        socks: '#13294b', sockStripes: ['#bfe3f5'], shoes: 'white', gloves: '#bfe3f5', nameOnBack: true,
      },
    },
    style: { offense: 'option', defense: 'balanced', tempo: 0.5 },
    strength: 0.66,
    venue: 'snowbowl',
  },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

export function getTeam(id) {
  return TEAM_BY_ID[id] || TEAMS[0];
}

/** Pick the away team's kit: away whites unless they'd clash with the home kit. */
export function kitsFor(home, away) {
  return { home: home.uniform.home, away: away.uniform.away };
}
